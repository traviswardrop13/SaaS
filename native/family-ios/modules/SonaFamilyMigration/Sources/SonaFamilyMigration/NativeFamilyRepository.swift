import Foundation
import CryptoKit
import CoreFoundation

public struct NativeFamilyChildID: Codable, Hashable, Sendable {
    public let origin: LegacyOrigin
    public let slot: String
    public init(origin: LegacyOrigin, slot: String) { self.origin = origin; self.slot = slot }
}

/// Evidence retained from the original same-device captures. These flags do not
/// verify a purchase or answer the pricing switch. They are never derived again
/// from native edits, so removing the profile that held a promise cannot revoke it.
public struct NativeFamilyHouseholdPromises: Codable, Equatable, Sendable {
    public internal(set) var founder = false
    public internal(set) var founding = false
    public internal(set) var grandfathered = false
    public internal(set) var keptFreeVersion = false
    public internal(set) var keptLegacyBuddies = false

    init() {}
    init(origin: ImportedOrigin, compatibility: LegacyPromiseCompatibility) {
        founder = origin.storage["sona.founder"] == "1"
        founding = compatibility.hasFoundingPromise
        grandfathered = compatibility.hasFreeEraPromise
        keptFreeVersion = compatibility.keepsFreeVersion
        keptLegacyBuddies = compatibility.keepsLegacyBuddies
    }
    mutating func include(_ other: NativeFamilyHouseholdPromises) {
        founder = founder || other.founder; founding = founding || other.founding
        grandfathered = grandfathered || other.grandfathered
        keptFreeVersion = keptFreeVersion || other.keptFreeVersion
        keptLegacyBuddies = keptLegacyBuddies || other.keptLegacyBuddies
    }
}

public struct NativeFamilyChild: Equatable, Sendable {
    public let id: NativeFamilyChildID
    public let keys: [String: String]
    public var profileJSON: String? { keys[LegacyKeys.profile] }
}

/// Effective native data stays origin-scoped, including ALL household keys.
/// `sourceFingerprint` identifies the immutable raw capture, not this editable copy.
public struct NativeFamilyOrigin: Codable, Equatable, Sendable {
    public let origin: LegacyOrigin
    public let sourceFingerprint: String
    public internal(set) var storage: [String: String]
    public internal(set) var activeSlot: String?
    public internal(set) var slots: [String]
    public internal(set) var slotHighWaterMark: Int
    public let promises: NativeFamilyHouseholdPromises

    public var children: [NativeFamilyChild] {
        slots.map { slot in
            let keys = Dictionary(uniqueKeysWithValues: LegacyKeys.perChild.compactMap { base in
                storage[Self.key(base, slot)].map { (base, $0) }
            })
            return NativeFamilyChild(id: NativeFamilyChildID(origin: origin, slot: slot), keys: keys)
        }
    }
    public var activeChild: NativeFamilyChild? { children.first { $0.id.slot == activeSlot } }
    public func accessEvidence() -> LegacyPromiseCompatibility {
        LegacyPromiseCompatibility(storage: storage, hasFreeEraPromise: promises.grandfathered,
                                   hasFoundingPromise: promises.founding, keepsFreeVersion: promises.keptFreeVersion,
                                   keepsLegacyBuddies: promises.keptLegacyBuddies)
    }
    static func key(_ base: String, _ slot: String) -> String { slot.isEmpty ? base : base + "@" + slot }
    // The owned set promised to new siblings on a kept household. The differential
    // test pins this asset inventory to shipping LEGACY_SET; shop/road items added
    // later are never inherited from another child's profile.
    static let legacyKeptOwnership = [
        "characters": ["fox", "bunny", "dragon", "cat", "bee", "octopus", "dino", "panda"],
        "outfits": ["none", "crown", "tophat", "cap", "shades", "bow", "party"],
        "backdrops": ["sky", "jungle", "forest", "mountain", "space", "beach"]
    ]

    mutating func writeRoster() throws {
        // Preserve unknown roster fields; only explicit native mutations rewrite it.
        var roster = Self.object(storage[LegacyKeys.roster]) ?? [:]
        let oldRows = roster["list"] as? [[String: Any]] ?? []
        roster["list"] = slots.map { slot -> [String: Any] in
            var row = oldRows.first { ($0["slot"] as? String) == slot } ?? [:]
            row["slot"] = slot
            row["name"] = Self.object(storage[Self.key(LegacyKeys.profile, slot)])?["childName"] as? String ?? ""
            return row
        }
        roster["active"] = activeSlot ?? ""
        roster["hi"] = slotHighWaterMark
        storage[LegacyKeys.roster] = try Self.json(roster)
    }
    static func object(_ raw: String?) -> [String: Any]? {
        guard let raw, let data = raw.data(using: .utf8) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }
    static func json(_ value: [String: Any]) throws -> String {
        let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
        return String(decoding: data, as: UTF8.self)
    }
    static func isTrue(_ value: Any?) -> Bool {
        guard let number = value as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() else { return false }
        return number.boolValue
    }
}

/// A durable local errand, written in the same transaction that removes a child.
/// The host must fulfill existing board/report deletion promises before acknowledging
/// it. No child's name, voice, homework or progress is retained in this errand.
public struct NativeFamilyRemovalObligation: Codable, Equatable, Sendable {
    public let operationID: UUID
    public let childID: NativeFamilyChildID
    public let boardEntryJSON: String?
    public let reportEmail: String?
}

struct NativeFamilyMutationReceipt: Codable, Equatable, Sendable {
    enum Kind: String, Codable, Sendable { case add, remove }
    let kind: Kind
    let requestDigest: String
    let childID: NativeFamilyChildID
}

/// Private on-device native document. Do not expose this Codable document as a
/// family backup: it contains device-only access evidence and identities.
public struct NativeFamilyDocument: Codable, Equatable, Sendable {
    public internal(set) var version = 1
    public internal(set) var sourceFingerprints: [String: String] = [:]
    public internal(set) var origins: [String: NativeFamilyOrigin] = [:]
    public internal(set) var primaryOrigin: LegacyOrigin?
    public internal(set) var householdPromises = NativeFamilyHouseholdPromises()
    public internal(set) var removalObligations: [NativeFamilyRemovalObligation] = []
    public internal(set) var pendingLocalPlayerRemovals: Set<NativeFamilyChildID>?
    var mutationReceipts: [String: NativeFamilyMutationReceipt] = [:]
    var ruleReceipts: [String: NativeFamilyRuleReceipt]?
    /// Private container history, never a portable-backup value or purge receipt.
    var bootstrapProvenance: NativeFamilyBootstrapProvenance?
    public var previewBootstrapProvenance: NativeFamilyBootstrapProvenance? { bootstrapProvenance }
    public internal(set) var appleAccess: [String: NativeFamilyAppleAccess]?
    public internal(set) var websiteAccess: [String: NativeFamilyWebsiteAccess]?
    public internal(set) var retiredRecordingOrigins: Set<LegacyOrigin>?
    var weeklyReportJournal: [String: NativeFamilyReportJournal]?
    var backupJournal: [String: NativeFamilyBackupJournal]?
    var readingPlaces: [NativeFamilyChildID: [String: NativeFamilyReadingPlace]]?
    var gameCompletions: [NativeFamilyChildID: Set<String>]?
    init() {}

    public var families: [NativeFamilyOrigin] { LegacyOrigin.allCases.compactMap { origins[$0.rawValue] } }
    public var primaryFamily: NativeFamilyOrigin? { primaryOrigin.flatMap { origins[$0.rawValue] } }
    public var activeChild: NativeFamilyChild? { primaryFamily?.activeChild }
    public func bookmarks(for child: NativeFamilyChildID) -> [String: NativeFamilyReadingPlace] { readingPlaces?[child] ?? [:] }
    public func completedGames(for child: NativeFamilyChildID) -> Set<String> { gameCompletions?[child] ?? [] }
    public var requiresPrimaryOriginSelection: Bool {
        primaryOrigin == nil && families.filter { !$0.slots.isEmpty }.count > 1
    }
}

public enum NativeFamilyRepositoryError: Error, Equatable {
    case incompleteMigration, invalidArchive, unsupportedVersion, destinationCorrupt
    case notSeeded, originNotFound, primaryOriginRequired, conflictingPrimarySelection
    case sourceChangedAfterSeed, childNotFound, cannotRemoveLastChild
    case invalidChildKey, invalidProfile, slotLimitReached, operationConflict, verificationFailed
    case retiredRecordingsRequired
}

public protocol NativeFamilyDocumentStore: Sendable {
    func read() throws -> NativeFamilyDocument?
    /// Must atomically replace the whole document and retain the previous one on failure.
    func commit(_ document: NativeFamilyDocument) throws
}

/// Own one instance in the host. All origin copies, source receipts, new slot
/// allocation and removal errands share one durable transaction. No game or reward
/// operation is run here, and no client, analytics or purchase service is called.
public actor NativeFamilyRepository {
    let store: any NativeFamilyDocumentStore
    public init(store: any NativeFamilyDocumentStore) { self.store = store }

    public func snapshot() throws -> NativeFamilyDocument? {
        guard let document = try store.read() else { return nil }
        try Self.validate(document)
        return document
    }

    /// Only the complete, validated same-device capture can seed native state.
    /// Repeating it returns the existing native document without replaying sweeps,
    /// replacing native progress, changing the selected child or granting a token.
    @discardableResult
    public func seed(from archive: MigrationArchive, primaryOrigin: LegacyOrigin? = nil) throws -> NativeFamilyDocument {
        try seed(from: archive, primaryOrigin: primaryOrigin, bootstrapProvenance: nil)
    }

    /// The only nonnil caller is the actual native-preview empty bootstrap.
    /// Existing documents always return untouched, including missing provenance.
    func seed(from archive: MigrationArchive, primaryOrigin: LegacyOrigin?,
              bootstrapProvenance: NativeFamilyBootstrapProvenance?) throws -> NativeFamilyDocument {
        guard archive.version == 1 else { throw NativeFamilyRepositoryError.unsupportedVersion }
        guard archive.capturedAllKnownOrigins else { throw NativeFamilyRepositoryError.incompleteMigration }
        if bootstrapProvenance != nil {
            guard Bundle.main.bundleIdentifier == "com.speaksona.family.native-preview",
                  primaryOrigin == .app, archive.origins.values.allSatisfy({ $0.storage.isEmpty && $0.children.isEmpty }) else {
                throw NativeFamilyRuleError.invalidPreviewContainer
            }
        }
        for (key, origin) in archive.origins {
            let expected = try? SnapshotImporter.prepare(LegacySnapshot(origin: origin.origin, storage: origin.storage))
            guard key == origin.origin.rawValue, expected == origin else { throw NativeFamilyRepositoryError.invalidArchive }
        }
        let fingerprints = archive.origins.mapValues(\.fingerprint)
        if let existing = try snapshot() {
            guard existing.sourceFingerprints == fingerprints else { throw NativeFamilyRepositoryError.sourceChangedAfterSeed }
            if let primaryOrigin, let selected = existing.primaryOrigin, primaryOrigin != selected {
                throw NativeFamilyRepositoryError.conflictingPrimarySelection
            }
            // Selecting a previously unresolved family must be explicit via selectOrigin.
            return existing
        }
        var document = NativeFamilyDocument()
        document.bootstrapProvenance = bootstrapProvenance
        document.sourceFingerprints = fingerprints
        for origin in archive.origins.values {
            let compatibility = origin.evaluatingLegacyPromises()
            let effective = try SnapshotImporter.prepare(LegacySnapshot(origin: origin.origin, storage: compatibility.storage))
            let promises = NativeFamilyHouseholdPromises(origin: origin, compatibility: compatibility)
            document.origins[origin.origin.rawValue] = NativeFamilyOrigin(origin: origin.origin,
                sourceFingerprint: origin.fingerprint, storage: compatibility.storage,
                activeSlot: effective.activeSlot, slots: effective.children.map(\.slot),
                slotHighWaterMark: max(origin.slotHighWaterMark, effective.slotHighWaterMark),
                promises: promises)
            document.householdPromises.include(promises)
        }
        if let primaryOrigin {
            guard document.origins[primaryOrigin.rawValue] != nil else { throw NativeFamilyRepositoryError.originNotFound }
            document.primaryOrigin = primaryOrigin
        } else {
            let occupied = document.families.filter { !$0.slots.isEmpty }
            if occupied.count == 1 { document.primaryOrigin = occupied[0].origin }
        }
        try Self.validate(document)
        try verifiedCommit(document)
        return document
    }

    public func selectOrigin(_ origin: LegacyOrigin) throws {
        try change { document in
            guard document.origins[origin.rawValue] != nil else { throw NativeFamilyRepositoryError.originNotFound }
            document.primaryOrigin = origin
        }
    }

    public func switchChild(_ child: NativeFamilyChildID) throws {
        try change { document in
            guard var family = document.origins[child.origin.rawValue], family.slots.contains(child.slot) else {
                throw NativeFamilyRepositoryError.childNotFound
            }
            family.activeSlot = child.slot
            try family.writeRoster()
            document.origins[child.origin.rawValue] = family
            document.primaryOrigin = child.origin
        }
    }

    /// The request ID must be reused after an interrupted acknowledgement. New
    /// children start with only their own name/age and inherited household promises;
    /// no sibling's consent, homework, report ID, progress or rewards is copied.
    @discardableResult
    public func addChild(name: String, age: String, operationID: UUID) throws -> NativeFamilyChildID {
        try change { document in
            guard let primary = document.primaryOrigin else { throw NativeFamilyRepositoryError.primaryOriginRequired }
            guard var family = document.origins[primary.rawValue] else { throw NativeFamilyRepositoryError.originNotFound }
            let digest = Self.requestDigest(["add", primary.rawValue, name, age])
            if let receipt = document.mutationReceipts[operationID.uuidString] {
                guard receipt.kind == .add, receipt.requestDigest == digest else { throw NativeFamilyRepositoryError.operationConflict }
                return receipt.childID
            }
            guard family.slotHighWaterMark < Int.max else { throw NativeFamilyRepositoryError.slotLimitReached }
            let next = family.slotHighWaterMark + 1, slot = "k\(next)"
            let child = NativeFamilyChildID(origin: primary, slot: slot)
            var profile: [String: Any] = ["childName": String(name.prefix(24)), "childAge": age, "onboarded": false]
            if document.householdPromises.grandfathered { profile["earlyAdopter"] = true }
            if document.householdPromises.keptLegacyBuddies { profile["owned"] = NativeFamilyOrigin.legacyKeptOwnership }
            family.storage[NativeFamilyOrigin.key(LegacyKeys.profile, slot)] = try NativeFamilyOrigin.json(profile)
            family.slots.append(slot); family.activeSlot = slot; family.slotHighWaterMark = next
            try family.writeRoster()
            document.origins[primary.rawValue] = family
            document.mutationReceipts[operationID.uuidString] = .init(kind: .add, requestDigest: digest, childID: child)
            return child
        }
    }

    public func removeChild(_ child: NativeFamilyChildID, operationID: UUID, removeLocalCopies: Bool = false) throws {
        try change { document in
            let components = ["remove", child.origin.rawValue, child.slot]
            let digest = Self.requestDigest(removeLocalCopies ? components + ["local"] : components)
            if let receipt = document.mutationReceipts[operationID.uuidString] {
                guard receipt.kind == .remove, receipt.requestDigest == digest else { throw NativeFamilyRepositoryError.operationConflict }
                return
            }
            guard var family = document.origins[child.origin.rawValue], family.slots.contains(child.slot) else {
                throw NativeFamilyRepositoryError.childNotFound
            }
            guard family.slots.count > 1 else { throw NativeFamilyRepositoryError.cannotRemoveLastChild }
            try Self.redactBackupUndo(for: child, from: &document)
            if removeLocalCopies {
                guard document.primaryOrigin == child.origin, family.activeSlot != child.slot else {
                    throw NativeFamilyRuleError.playerChanged
                }
                document.pendingLocalPlayerRemovals = (document.pendingLocalPlayerRemovals ?? []).union([child])
            }
            let profileKey = NativeFamilyOrigin.key(LegacyKeys.profile, child.slot)
            let removedProfile = NativeFamilyOrigin.object(family.storage[profileKey]) ?? [:]
            let board = family.storage[NativeFamilyOrigin.key("sona.board.v1", child.slot)]
            family.slots.removeAll { $0 == child.slot }
            if family.activeSlot == child.slot { family.activeSlot = family.slots.first }
            document.readingPlaces?.removeValue(forKey: child)
            document.gameCompletions?.removeValue(forKey: child)
            var reportEmail: String?
            if NativeFamilyOrigin.isTrue(removedProfile["weeklyReport"]),
               let email = removedProfile["email"] as? String, !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                let remains = family.slots.contains { slot in
                    let profile = NativeFamilyOrigin.object(family.storage[NativeFamilyOrigin.key(LegacyKeys.profile, slot)])
                    return NativeFamilyOrigin.isTrue(profile?["weeklyReport"]) &&
                        (profile?["email"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normalized
                }
                if !remains { reportEmail = normalized }
            }
            for key in family.storage.keys where LegacyKeys.isOwned(key, by: child.slot) {
                family.storage.removeValue(forKey: key)
            }
            if board != nil || reportEmail != nil {
                document.removalObligations.append(.init(operationID: operationID, childID: child,
                                                        boardEntryJSON: board, reportEmail: reportEmail))
            }
            try family.writeRoster()
            document.origins[child.origin.rawValue] = family
            document.mutationReceipts[operationID.uuidString] = .init(kind: .remove, requestDigest: digest, childID: child)
        }
    }

    /// Writes an absolute raw child value. This primitive does not decide whether
    /// speech counted or award anything; those remain the app's existing rules.
    /// Asynchronous callers must keep the child ID from when their work began.
    public func updateChildKey(_ base: String, value: String?, child: NativeFamilyChildID) throws {
        guard LegacyKeys.perChild.contains(base), !base.contains("@") else { throw NativeFamilyRepositoryError.invalidChildKey }
        if base == LegacyKeys.profile, NativeFamilyOrigin.object(value) == nil { throw NativeFamilyRepositoryError.invalidProfile }
        try change { document in
            guard var family = document.origins[child.origin.rawValue], family.slots.contains(child.slot) else {
                throw NativeFamilyRepositoryError.childNotFound
            }
            family.storage[NativeFamilyOrigin.key(base, child.slot)] = value
            if base == LegacyKeys.profile { try family.writeRoster() }
            document.origins[child.origin.rawValue] = family
        }
    }

    public func acknowledgeRemovalObligation(_ operationID: UUID) throws {
        try change { $0.removalObligations.removeAll { $0.operationID == operationID } }
    }

    public func acknowledgeLocalPlayerRemoval(_ child: NativeFamilyChildID) throws {
        try change { document in
            guard document.retiredRecordingOrigins?.contains(child.origin) == true else {
                throw NativeFamilyRepositoryError.retiredRecordingsRequired
            }
            document.pendingLocalPlayerRemovals?.remove(child)
        }
    }

    public func acknowledgeRetiredRecordings(origin: LegacyOrigin) throws {
        try change { document in
            guard document.origins[origin.rawValue] != nil else { throw NativeFamilyRepositoryError.originNotFound }
            var verified = document.retiredRecordingOrigins ?? []
            verified.insert(origin)
            document.retiredRecordingOrigins = verified
        }
    }

    func change<T>(_ mutation: (inout NativeFamilyDocument) throws -> T) throws -> T {
        guard var document = try snapshot() else { throw NativeFamilyRepositoryError.notSeeded }
        let original = document
        let result = try mutation(&document)
        try Self.validate(document)
        if document != original { try verifiedCommit(document) }
        return result
    }

    func verifiedCommit(_ document: NativeFamilyDocument) throws {
        try store.commit(document)
        guard try store.read() == document else { throw NativeFamilyRepositoryError.verificationFailed }
    }

    private static func requestDigest(_ components: [String]) -> String {
        let data = (try? JSONEncoder().encode(components)) ?? Data()
        return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    static func validate(_ document: NativeFamilyDocument) throws {
        guard document.version == 1 else { throw NativeFamilyRepositoryError.unsupportedVersion }
        guard Set(document.origins.keys) == Set(LegacyOrigin.allCases.map(\.rawValue)),
              Set(document.sourceFingerprints.keys) == Set(document.origins.keys),
              document.primaryOrigin == nil || document.origins[document.primaryOrigin!.rawValue] != nil else {
            throw NativeFamilyRepositoryError.destinationCorrupt
        }
        var promises = NativeFamilyHouseholdPromises()
        for (key, family) in document.origins {
            guard key == family.origin.rawValue,
                  document.sourceFingerprints[key] == family.sourceFingerprint,
                  family.sourceFingerprint.count == 64,
                  family.sourceFingerprint.allSatisfy({ $0.isHexDigit }) else { throw NativeFamilyRepositoryError.destinationCorrupt }
            let projection = try? SnapshotImporter.prepare(LegacySnapshot(origin: family.origin, storage: family.storage))
            guard let projection, projection.children.map(\.slot) == family.slots,
                  projection.activeSlot == family.activeSlot,
                  family.slotHighWaterMark >= projection.slotHighWaterMark else { throw NativeFamilyRepositoryError.destinationCorrupt }
            promises.include(family.promises)
        }
        guard promises == document.householdPromises else { throw NativeFamilyRepositoryError.destinationCorrupt }
        for (key, receipt) in document.mutationReceipts {
            guard UUID(uuidString: key) != nil, document.origins[receipt.childID.origin.rawValue] != nil,
                  LegacyKeys.slotNumber(receipt.childID.slot) != nil, receipt.requestDigest.count == 64 else {
                throw NativeFamilyRepositoryError.destinationCorrupt
            }
        }
        guard Set(document.removalObligations.map(\.operationID)).count == document.removalObligations.count else {
            throw NativeFamilyRepositoryError.destinationCorrupt
        }
        guard (document.pendingLocalPlayerRemovals ?? []).allSatisfy({ child in
            guard let family = document.origins[child.origin.rawValue] else { return false }
            return LegacyKeys.slotNumber(child.slot) != nil && !family.slots.contains(child.slot)
        }) else { throw NativeFamilyRepositoryError.destinationCorrupt }
        for (key, receipt) in document.ruleReceipts ?? [:] {
            guard key.count <= 120, !key.isEmpty, LegacyKeys.slotNumber(receipt.child.slot) != nil,
                  document.origins[receipt.child.origin.rawValue] != nil else {
                throw NativeFamilyRepositoryError.destinationCorrupt
            }
        }
        guard Set(document.appleAccess?.keys.map { $0 } ?? []).isSubset(of: Set(document.origins.keys)) else {
            throw NativeFamilyRepositoryError.destinationCorrupt
        }
        guard Set(document.websiteAccess?.keys.map { $0 } ?? []).isSubset(of: Set(document.origins.keys)),
              (document.websiteAccess?.values.allSatisfy {
                  NativeFamilyWebsiteAccess.normalizedEmail($0.email) == $0.email && $0.checkedAt.timeIntervalSince1970.isFinite
              } ?? true) else { throw NativeFamilyRepositoryError.destinationCorrupt }

        for (owner, books) in document.readingPlaces ?? [:] {
            guard document.origins[owner.origin.rawValue]?.slots.contains(owner.slot) == true,
                  books.allSatisfy({ NativeFamilyReadingPlace.valid(id: $0.key, page: $0.value.page) }) else {
                throw NativeFamilyRepositoryError.destinationCorrupt
            }
        }
        for (owner, games) in document.gameCompletions ?? [:] {
            guard document.origins[owner.origin.rawValue]?.slots.contains(owner.slot) == true,
                  games.allSatisfy(Self.validGameID) else { throw NativeFamilyRepositoryError.destinationCorrupt }
        }
    }
}

/// Point this at private Application Support inside the unchanged release app's
/// container. The document contains family state and device-only promises;
/// it is protected on iOS, excluded from backup, and never exported or uploaded.
public struct LocalNativeFamilyDocumentStore: NativeFamilyDocumentStore {
    public let directory: URL
    private var file: URL { directory.appendingPathComponent("native-family-v1.json") }
    public init(directory: URL) { self.directory = directory }
    public func read() throws -> NativeFamilyDocument? {
        do { return try JSONDecoder().decode(NativeFamilyDocument.self, from: Data(contentsOf: file)) }
        catch let error as CocoaError where error.code == .fileReadNoSuchFile { return nil }
        catch { throw NativeFamilyRepositoryError.destinationCorrupt }
    }
    public func commit(_ document: NativeFamilyDocument) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var folder = directory, values = URLResourceValues(); values.isExcludedFromBackup = true
        try folder.setResourceValues(values)
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        #if os(iOS)
        try encoder.encode(document).write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try encoder.encode(document).write(to: file, options: [.atomic])
        #endif
        var destination = file
        try destination.setResourceValues(values)
    }
}
