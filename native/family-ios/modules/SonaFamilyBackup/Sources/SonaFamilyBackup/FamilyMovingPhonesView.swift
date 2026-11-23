
#if os(iOS)
import SwiftUI
import UIKit
import UniformTypeIdentifiers
import SonaFamilyMigration

public struct FamilyMovingPhonesView: View {
    @ObservedObject private var service: FamilyMovingPhonesService
    @State private var document = PortableFile(bytes: Data())
    @State private var exporting = false
    @State private var importing = false
    @State private var copyMessage: String?
    @State private var pasteCode = ""
    @State private var pending: Data?
    @State private var confirmRestore = false
    @State private var confirmUndo = false
    @State private var error: String?
    public init(service: FamilyMovingPhonesService) { self.service = service }

    public var body: some View {
        Form {
            Section {
                Text("Save a backup on your old phone, then restore it on your new one.")
                Text("This moves progress for this family. It does not move recordings, purchases, device promises or therapist sign-in. Sign in again in Settings, or use Restore purchases for an App Store purchase.")
                    .font(.footnote).foregroundColor(.secondary)
            }
            Section("Save a backup") {
                Button {
                    Task { await perform {
                        document = PortableFile(bytes: try await service.exportFile())
                        exporting = true
                    } }
                } label: { Label("Save backup file", systemImage: "square.and.arrow.up") }
                .accessibilityIdentifier("backup-export")
                Button {
                    Task { await perform {
                        UIPasteboard.general.string = try await service.exportCode()
                        copyMessage = "Backup code copied."
                    } }
                } label: { Label("Copy backup code", systemImage: "doc.on.doc") }
                .accessibilityIdentifier("backup-copy")
                if let copyMessage { Text(copyMessage).accessibilityIdentifier("backup-copy-result") }
            }
            Section("Restore a backup") {
                Button { importing = true } label: { Label("Choose backup file", systemImage: "folder") }
                    .accessibilityIdentifier("backup-choose")
                DisclosureGroup("Have a backup code?") {
                    TextEditor(text: $pasteCode)
                        .font(.system(.body, design: .monospaced)).frame(minHeight: 100)
                        .textInputAutocapitalization(.never).disableAutocorrection(true)
                        .privacySensitive().accessibilityLabel("Backup code")
                        .accessibilityIdentifier("backup-code")
                    Button("Restore code") { prepare(Data(pasteCode.utf8)) }
                        .disabled(pasteCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .accessibilityIdentifier("backup-restore-code")
                }
            }
            if service.canUndo {
                Section {
                    Button("Undo last restore", role: .destructive) { confirmUndo = true }
                        .accessibilityIdentifier("backup-undo")
                    Text("Puts progress back to the copy saved just before your last restore. Children you explicitly removed stay removed.")
                        .font(.footnote).foregroundColor(.secondary)
                }
            }
            if service.busy { ProgressView("Working…").accessibilityIdentifier("backup-busy") }
            if let message = service.message { Text(message).accessibilityIdentifier("backup-result") }
        }
        .disabled(service.busy)
        .navigationTitle("Moving phones")
        .task { await service.refresh() }
        .fileExporter(isPresented: $exporting, document: document, contentType: .json,
                      defaultFilename: "Sona-backup") { result in
            document = PortableFile(bytes: Data())
            if case .failure(let failure) = result { error = failure.localizedDescription }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json, .plainText], allowsMultipleSelection: false) { result in
            do {
                guard let url = try result.get().first else { return }
                let scoped = url.startAccessingSecurityScopedResource()
                defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size <= 10_000_000 else { throw NativeFamilyBackupError.invalidBackup }
                prepare(try Data(contentsOf: url))
            } catch { self.error = error.localizedDescription }
        }
        .alert("Restore this backup?", isPresented: $confirmRestore) {
            Button("Cancel", role: .cancel) { pending = nil }
            Button("Restore", role: .destructive) {
                guard let bytes = pending else { return }; pending = nil; pasteCode = ""
                Task { await perform { try await service.restore(bytes) } }
            }.accessibilityIdentifier("backup-confirm-restore")
        } message: {
            Text("Everything the backup contains overwrites what is on this device. Anything it does not contain is left as it is.")
        }
        .alert("Undo last restore?", isPresented: $confirmUndo) {
            Button("Cancel", role: .cancel) {}
            Button("Undo", role: .destructive) { Task { await perform { try await service.undo() } } }
                .accessibilityIdentifier("backup-confirm-undo")
        } message: { Text("This replaces progress changed since that restore with the saved copy.") }
        .alert("Couldn’t finish", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
            Button("OK", role: .cancel) { error = nil }
        } message: { Text(error ?? "Please try again.") }
    }
    private func prepare(_ bytes: Data) {
        do { _ = try NativeFamilyPortableBackup.decode(bytes); pending = bytes; confirmRestore = true }
        catch { self.error = error.localizedDescription }
    }
    @MainActor private func perform(_ operation: () async throws -> Void) async {
        do { try await operation() } catch { self.error = error.localizedDescription }
    }
}

private struct PortableFile: FileDocument {
    static let readableContentTypes: [UTType] = [.json]
    var bytes: Data
    init(bytes: Data) { self.bytes = bytes }
    init(configuration: ReadConfiguration) throws { bytes = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: bytes) }
}

#endif
