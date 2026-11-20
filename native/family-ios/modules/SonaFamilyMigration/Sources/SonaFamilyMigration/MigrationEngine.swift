import Foundation

/// One atomic envelope holds content AND completion receipts. Never mark an origin
/// complete in UserDefaults before its child data is durable.
public struct MigrationArchive: Codable, Equatable, Sendable {
    public var version: Int = 1
    public var origins: [String: ImportedOrigin] = [:]
    public init() {}

    public var checkedOrigins: Set<LegacyOrigin> {
        Set(origins.keys.compactMap(LegacyOrigin.init(rawValue:)))
    }
    /// This reports capture coverage, not permission to turn on the unfinished native app.
    public var capturedAllKnownOrigins: Bool { checkedOrigins == Set(LegacyOrigin.allCases) }
}

/// The host must provide atomic replacement, keep the previous document on failure,
/// and use one MigrationEngine instance. No networking or analytics belongs here.
public protocol MigrationArchiveStore: Sendable {
    func read() throws -> MigrationArchive?
    func commit(_ archive: MigrationArchive) throws
}

public struct MigrationReceipt: Equatable, Sendable {
    public let imported: Set<LegacyOrigin>
    public let alreadyImported: Set<LegacyOrigin>
    public let checkedOrigins: Set<LegacyOrigin>
    public let capturedAllKnownOrigins: Bool
}

public actor MigrationEngine {
    private let store: any MigrationArchiveStore
    public init(store: any MigrationArchiveStore) { self.store = store }

    public func archive() throws -> MigrationArchive { try checkedArchive() }

    public func redactRemovedChild(_ child: NativeFamilyChildID) throws {
        var next = try checkedArchive()
        guard let prior = next.origins[child.origin.rawValue] else { return }
        let redacted = try LegacyPlayerRedaction.redact(prior.storage, child: child)
        guard redacted != prior.storage else { return }
        next.origins[child.origin.rawValue] = try SnapshotImporter.prepare(.init(origin: child.origin, storage: redacted))
        try store.commit(next)
        guard try store.read() == next else { throw MigrationError.verificationFailed }
    }

    /// Only accepts snapshots created by the same-container capture adapter.
    /// A changed second snapshot is held for reconciliation, never written over
    /// native progress or added to counters that might already include it.
    public func ingest(_ snapshots: [LegacySnapshot]) throws -> MigrationReceipt {
        var next = try checkedArchive()
        var imported = Set<LegacyOrigin>(), repeated = Set<LegacyOrigin>(), seen = Set<LegacyOrigin>()
        for snapshot in snapshots {
            guard seen.insert(snapshot.origin).inserted else { throw MigrationError.duplicateOrigin }
            let prepared = try SnapshotImporter.prepare(snapshot)
            if let existing = next.origins[snapshot.origin.rawValue] {
                guard existing.fingerprint == prepared.fingerprint else { throw MigrationError.sourceChangedAfterImport }
                repeated.insert(snapshot.origin)
            } else {
                next.origins[snapshot.origin.rawValue] = prepared
                imported.insert(snapshot.origin)
            }
        }
        if !imported.isEmpty {
            try store.commit(next)
            // A lost acknowledgement after commit is safe: retry reads the receipt
            // beside the data and does no work. No coins, reps or grants are replayed.
            guard try store.read() == next else { throw MigrationError.verificationFailed }
        }
        return MigrationReceipt(imported: imported, alreadyImported: repeated,
                                checkedOrigins: next.checkedOrigins,
                                capturedAllKnownOrigins: next.capturedAllKnownOrigins)
    }

    private func checkedArchive() throws -> MigrationArchive {
        let archive = try store.read() ?? MigrationArchive()
        guard archive.version == 1 else { throw MigrationError.unsupportedVersion }
        for (key, value) in archive.origins {
            guard key == value.origin.rawValue,
                  try SnapshotImporter.prepare(LegacySnapshot(origin: value.origin, storage: value.storage)) == value else {
                throw MigrationError.destinationCorrupt
            }
        }
        return archive
    }
}

/// Files stay inside the existing app container and are excluded from iCloud backup:
/// this archive contains device-only promises and original family settings.
/// No fallback to a temporary/shared/cloud folder, and no "empty" on corrupt data.
public struct LocalMigrationArchiveStore: MigrationArchiveStore {
    public let directory: URL
    private var file: URL { directory.appendingPathComponent("same-device-v1.json") }

    public init(directory: URL) { self.directory = directory }

    public func read() throws -> MigrationArchive? {
        do { return try JSONDecoder().decode(MigrationArchive.self, from: Data(contentsOf: file)) }
        catch let error as CocoaError where error.code == .fileReadNoSuchFile { return nil }
        catch { throw MigrationError.destinationCorrupt }
    }

    public func commit(_ archive: MigrationArchive) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var folder = directory
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try folder.setResourceValues(values)
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        #if os(iOS)
        try encoder.encode(archive).write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try encoder.encode(archive).write(to: file, options: [.atomic])
        #endif
        var destination = file
        try destination.setResourceValues(values)
    }
}
