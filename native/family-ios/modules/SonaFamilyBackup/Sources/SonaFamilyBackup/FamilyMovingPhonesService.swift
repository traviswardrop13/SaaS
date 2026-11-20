import Foundation
import Combine
import SonaFamilyMigration
import SonaFamilyRules

/// Local files only. No audio, credentials, network request or purchase call.
/// Present from the existing Grown-ups gate for the selected household origin.
@MainActor public final class FamilyMovingPhonesService: ObservableObject {
    @Published public private(set) var busy = false
    @Published public private(set) var canUndo = false
    @Published public private(set) var message: String?
    public let origin: LegacyOrigin
    private let repository: NativeFamilyRepository
    private let onChanged: @MainActor () async -> Void
    private var restoreRequest: (bytes: Data, id: UUID)?
    private var undoRequest: UUID?

    public init(repository: NativeFamilyRepository, origin: LegacyOrigin,
                onChanged: @escaping @MainActor () async -> Void = {}) {
        self.repository = repository; self.origin = origin; self.onChanged = onChanged
    }
    public func refresh() async {
        canUndo = (try? await repository.canUndoPortableBackup(origin: origin)) ?? false
    }
    public func exportFile() async throws -> Data {
        guard !busy else { throw NativeFamilyBackupError.operationConflict }
        busy = true; defer { busy = false }
        return try await repository.portableBackup(origin: origin).encoded()
    }
    public func restore(_ bytes: Data) async throws {
        guard !busy else { throw NativeFamilyBackupError.operationConflict }
        // Parse before retaining a safety request, and preserve the same ID on
        // an interrupted acknowledgement so a retry never applies twice.
        _ = try NativeFamilyPortableBackup.decode(bytes)
        let request: (bytes: Data, id: UUID) = restoreRequest?.bytes == bytes ? restoreRequest! : (bytes, UUID())
        restoreRequest = request
        busy = true; defer { busy = false }
        let result = try await repository.restorePortableBackup(bytes, origin: origin, operationID: request.id,
                                                                 evaluate: FamilyPortableBackupRules.evaluate)
        restoreRequest = nil; undoRequest = nil
        message = "Progress restored. You can undo this restore below."
        if result.restored == 0 { message = "Backup restored. You can undo this restore below." }
        await refresh(); await onChanged()
    }
    public func undo() async throws {
        guard !busy else { throw NativeFamilyBackupError.operationConflict }
        let request = undoRequest ?? UUID(); undoRequest = request
        busy = true; defer { busy = false }
        _ = try await repository.undoPortableBackup(origin: origin, operationID: request, evaluate: FamilyPortableBackupRules.evaluate)
        undoRequest = nil; restoreRequest = nil
        message = "The last restore was undone."
        await refresh(); await onChanged()
    }

}

public enum FamilyPortableBackupRules {
    private struct Arguments: Encodable { let payload: String }
    public static let evaluate: @Sendable (NativeFamilyBackupAction, Data, [String: String]) throws -> NativeFamilyBackupMutation = { action, payload, storage in
        if action == .withdrawReport {
            let keys = storage.keys.filter { $0 == "sona.profile.v1" || $0.hasPrefix("sona.profile.v1@") }
            let projection = try NativeWeeklyReportPolicy.prepare(storage: storage, profileKeys: keys,
                action: .queueOff, force: false, removedEmail: String(decoding: payload, as: UTF8.self))
            let changes = projection.reportState.map { ["sona.report.v1": $0] } ?? [:]
            return .init(value: Data(#"{"ok":true}"#.utf8), changes: changes, removals: [])
        }
        let operation: NativeFamilyRules.Operation = action == .restore ? .backupImport : .backupUndo
        let result = try NativeFamilyRules.evaluate(operation,
            input: Arguments(payload: String(decoding: payload, as: UTF8.self)), storage: storage)
        return .init(value: result.value, changes: result.changes, removals: result.removals)
    }
}
