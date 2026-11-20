import Foundation
import CryptoKit
import CoreFoundation

/// A portable, progress-only file. Never encode NativeFamilyDocument here.
public struct NativeFamilyPortableBackup: Codable, Equatable, Sendable {
    public let app: String
    public let v: Int
    public let data: [String: String]
    public let native: NativeMetadata?

    public struct NativeMetadata: Codable, Equatable, Sendable {
        public let version: Int
        public let children: [String: Child]
        /// A portable format hint, not a device grant or access promise.
        public let ownership: String?
        public init(children: [String: Child], ownership: String? = "explicit") {
            version = 1; self.children = children; self.ownership = ownership
        }
    }
    public struct Child: Codable, Equatable, Sendable {
        public let books: [String: NativeFamilyReadingPlace]
        public let games: Set<String>
        public init(books: [String: NativeFamilyReadingPlace], games: Set<String>) {
            self.books = books; self.games = games
        }
        private enum CodingKeys: String, CodingKey { case books, games }
        public init(from decoder: Decoder) throws {
            let fields = try decoder.container(keyedBy: CodingKeys.self)
            books = try fields.decode([String: NativeFamilyReadingPlace].self, forKey: .books)
            let list = try fields.decode([String].self, forKey: .games)
            guard list.count <= 1_000, Set(list).count == list.count else { throw NativeFamilyBackupError.invalidBackup }
            games = Set(list)
        }
        public func encode(to encoder: Encoder) throws {
            var fields = encoder.container(keyedBy: CodingKeys.self)
            try fields.encode(books, forKey: .books)
            try fields.encode(games.sorted(), forKey: .games)
        }
    }
    public init(data: [String: String], native: NativeMetadata? = nil) {
        app = "sona"; v = 1; self.data = data; self.native = native
    }
    public func encoded() throws -> Data {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(self)
    }
    /// Accept the existing wrapper and the old bare string dictionary, but never
    /// the trusted same-device capture, blobs, or a private native document.
    public static func decode(_ bytes: Data) throws -> Self {
        guard bytes.count <= 10_000_000,
              let root = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any] else {
            throw NativeFamilyBackupError.invalidBackup
        }
        if let metadata = root["native"] as? [String: Any] {
            guard Set(metadata.keys).isSubset(of: ["version", "children", "ownership"]),
                  let children = metadata["children"] as? [String: [String: Any]],
                  children.values.allSatisfy({ Set($0.keys).isSubset(of: ["books", "games"]) }) else {
                throw NativeFamilyBackupError.invalidBackup
            }
        }
        let backup: Self
        if root["data"] != nil {
            guard Set(root.keys).isSubset(of: ["app", "v", "data", "native"]),
                  root["app"] as? String == "sona", root["v"] as? Int == 1,
                  let value = try? JSONDecoder().decode(Self.self, from: bytes) else {
                throw NativeFamilyBackupError.invalidBackup
            }
            backup = value
        } else {
            guard let data = root as? [String: String] else { throw NativeFamilyBackupError.invalidBackup }
            backup = Self(data: data)
        }
        try backup.validate()
        return backup
    }
    func validate() throws {
        guard app == "sona", v == 1, data.count <= 4_096,
              data.allSatisfy({ key, value in
                  key.hasPrefix("sona.") && key.utf8.count <= 256 && value.utf8.count <= 1_000_000 &&
                  !key.contains("\0") && !value.contains("\0")
              }) else { throw NativeFamilyBackupError.invalidBackup }
        for (key, value) in data where LegacyKeys.parts(key).base == LegacyKeys.profile {
            guard NativeFamilyOrigin.object(value) != nil else { throw NativeFamilyBackupError.invalidBackup }
        }
        if let native {
            guard native.version == 1, (native.ownership == nil || native.ownership == "explicit"), native.children.count <= 100,
                  native.children.allSatisfy({ slot, child in
                      LegacyKeys.slotNumber(slot) != nil && child.books.count <= 1_000 && child.games.count <= 1_000 &&
                      child.books.allSatisfy({ NativeFamilyReadingPlace.valid(id: $0.key, page: $0.value.page) }) &&
                      child.games.allSatisfy(NativeFamilyRepository.validGameID)
                  }) else { throw NativeFamilyBackupError.invalidBackup }
        }
    }
}

public enum NativeFamilyBackupError: Error, Equatable, LocalizedError {
    case invalidBackup, noProgress, wrongOrigin, invalidRuleResult, operationConflict, noUndo, sharingChildChanged
    public var errorDescription: String? {
        switch self {
        case .invalidBackup: return "That backup didn’t look right. Please choose a Sona backup."
        case .noProgress: return "There wasn’t any Sona progress in that backup."
        case .wrongOrigin: return "The family changed. Close this screen and try again."
        case .invalidRuleResult: return "The restore couldn’t be completed. Nothing was changed."
        case .operationConflict: return "That restore request has already been used. Please try again."
        case .noUndo: return "There isn’t a restore to undo."
        case .sharingChildChanged: return "This backup changes a child who is sharing progress. Stop sharing in Settings before replacing that child."
        }
    }
}

public enum NativeFamilyBackupAction: Sendable { case restore, undo, withdrawReport }
public struct NativeFamilyBackupMutation: Sendable {
    public let value: Data
    public let changes: [String: String]
    public let removals: [String]
    public init(value: Data, changes: [String: String], removals: [String]) {
        self.value = value; self.changes = changes; self.removals = removals
    }
}
public struct NativeFamilyBackupResult: Codable, Equatable, Sendable {
    public let restored: Int
    public let removed: Int
    public let skipped: Int
}

/// Only a portable snapshot, never protected capture/provenance or account data.
/// Remains local in the protected document and is replaced by the next restore.
struct NativeFamilyBackupJournal: Codable, Equatable, Sendable {
    var before: NativeFamilyPortableBackup?
    let operationID: UUID
    let digest: String
    let result: NativeFamilyBackupResult
    var undoID: UUID?
    var undoResult: NativeFamilyBackupResult?
    var previousReceipts: [String: NativeFamilyBackupReceipt]?
    var previousUndoReceipts: [String: NativeFamilyBackupResult]?
}
struct NativeFamilyBackupReceipt: Codable, Equatable, Sendable {
    let digest: String
    let result: NativeFamilyBackupResult
}

public extension NativeFamilyRepository {
    func portableBackup(origin: LegacyOrigin) throws -> NativeFamilyPortableBackup {
        guard let document = try snapshot(), document.primaryOrigin == origin,
              let family = document.origins[origin.rawValue] else { throw NativeFamilyBackupError.wrongOrigin }
        return try Self.portableSnapshot(document: document, family: family)
    }
    func canUndoPortableBackup(origin: LegacyOrigin) throws -> Bool {
        guard let document = try snapshot(), document.primaryOrigin == origin else { return false }
        return document.backupJournal?[origin.rawValue]?.before != nil
    }

    /// One origin, one atomic commit. The supplied evaluator runs the unchanged
    /// shipping importData/undoImport in an isolated in-memory rules context.
    /// Reusing operationID after a lost acknowledgement returns the saved result.
    @discardableResult
    func restorePortableBackup(_ bytes: Data, origin: LegacyOrigin, operationID: UUID,
        evaluate: @Sendable (NativeFamilyBackupAction, Data, [String: String]) throws -> NativeFamilyBackupMutation
    ) throws -> NativeFamilyBackupResult {
        let decoded = try NativeFamilyPortableBackup.decode(bytes)
        let digest = Self.backupDigest(bytes)
        return try change { document in
            guard document.primaryOrigin == origin, let family = document.origins[origin.rawValue] else {
                throw NativeFamilyBackupError.wrongOrigin
            }
            if let journal = document.backupJournal?[origin.rawValue] {
                if journal.operationID == operationID {
                    guard journal.digest == digest else { throw NativeFamilyBackupError.operationConflict }
                    return journal.result
                }
                if let receipt = journal.previousReceipts?[operationID.uuidString] {
                    guard receipt.digest == digest else { throw NativeFamilyBackupError.operationConflict }
                    return receipt.result
                }
            }
            let before = try Self.portableSnapshot(document: document, family: family)
            var sanitized = try Self.sanitize(decoded)
            if decoded.native == nil, decoded.data["sona.buddyset.v1"] == "post" {
                sanitized = .init(data: sanitized.data, native: .init(children: [:]))
            }
            guard !sanitized.data.isEmpty else { throw NativeFamilyBackupError.noProgress }
            let result = try Self.applyPortable(sanitized, action: .restore, document: &document,
                                               origin: origin, evaluate: evaluate)
            var journals = document.backupJournal ?? [:]
            var receipts = journals[origin.rawValue]?.previousReceipts ?? [:]
            if let old = journals[origin.rawValue] { receipts[old.operationID.uuidString] = .init(digest: old.digest, result: old.result) }
            var undos = journals[origin.rawValue]?.previousUndoReceipts ?? [:]
            if let old = journals[origin.rawValue], let id = old.undoID, let result = old.undoResult { undos[id.uuidString] = result }
            journals[origin.rawValue] = .init(before: before, operationID: operationID,
                digest: digest, result: result, previousReceipts: receipts, previousUndoReceipts: undos)
            document.backupJournal = journals
            return result
        }
    }

    @discardableResult
    func undoPortableBackup(origin: LegacyOrigin, operationID: UUID,
        evaluate: @Sendable (NativeFamilyBackupAction, Data, [String: String]) throws -> NativeFamilyBackupMutation
    ) throws -> NativeFamilyBackupResult {
        try change { document in
            guard document.primaryOrigin == origin else { throw NativeFamilyBackupError.wrongOrigin }
            guard var journal = document.backupJournal?[origin.rawValue] else { throw NativeFamilyBackupError.noUndo }
            if journal.undoID == operationID, let result = journal.undoResult { return result }
            if let result = journal.previousUndoReceipts?[operationID.uuidString] { return result }
            guard let before = journal.before else { throw NativeFamilyBackupError.noUndo }
            let result = try Self.applyPortable(before, action: .undo, document: &document,
                                               origin: origin, evaluate: evaluate)
            // Erase the personal safety copy once Undo has completed. Only the
            // operation receipt remains to make an interrupted acknowledgement safe.
            journal.before = nil; journal.undoID = operationID; journal.undoResult = result
            var journals = document.backupJournal ?? [:]; journals[origin.rawValue] = journal
            document.backupJournal = journals
            return result
        }
    }

    /// Call inside the same transaction as explicit child deletion. Redacts all
    /// owned keys, roster names and native extras in the Undo snapshot. No name or
    /// progress survives here, and Undo cannot bring the removed child back.
    static func redactBackupUndo(for child: NativeFamilyChildID, from document: inout NativeFamilyDocument) throws {
        guard var journal = document.backupJournal?[child.origin.rawValue], let before = journal.before else { return }
        var storage = before.data
        for key in storage.keys where LegacyKeys.isOwned(key, by: child.slot) { storage.removeValue(forKey: key) }
        if var roster = NativeFamilyOrigin.object(storage[LegacyKeys.roster]),
           let list = roster["list"] as? [[String: Any]] {
            let kept = list.filter { $0["slot"] as? String != child.slot }
            if kept.isEmpty { storage.removeValue(forKey: LegacyKeys.roster) }
            else {
                roster["list"] = kept
                if roster["active"] as? String == child.slot { roster["active"] = kept[0]["slot"] }
                storage[LegacyKeys.roster] = try NativeFamilyOrigin.json(roster)
            }
        }
        var children = before.native?.children ?? [:]; children.removeValue(forKey: child.slot)
        journal.before = .init(data: storage, native: .init(children: children))
        var journals = document.backupJournal ?? [:]; journals[child.origin.rawValue] = journal
        document.backupJournal = journals
    }
}

private extension NativeFamilyRepository {
    static func backupIsFalse(_ value: Any?) -> Bool {
        guard let number = value as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() else { return false }
        return !number.boolValue
    }
    static func backupTruthy(_ value: Any?) -> Bool {
        guard let value, !(value is NSNull) else { return false }
        if let text = value as? String { return !text.isEmpty }
        if let number = value as? NSNumber { return number.doubleValue != 0 && !number.doubleValue.isNaN }
        return true
    }
    static func backupReportID(_ value: Any?) -> String? {
        guard let id = value as? String, id.range(of: "^[a-f0-9]{16}$", options: .regularExpression) != nil else { return nil }
        return id
    }
    static func backupDigest(_ bytes: Data) -> String {
        SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    }
    static func sanitize(_ backup: NativeFamilyPortableBackup) throws -> NativeFamilyPortableBackup {
        var storage: [String: String] = [:]
        for (key, value) in backup.data {
            let base = LegacyKeys.parts(key).base
            guard !NativeFamilyBackupPolicy.excluded.contains(base) else { continue }
            if base == LegacyKeys.profile {
                guard var profile = NativeFamilyOrigin.object(value) else { throw NativeFamilyBackupError.invalidBackup }
                for field in NativeFamilyBackupPolicy.profilePrivate { profile.removeValue(forKey: field) }
                if profile["reportId"] != nil { profile["reportId"] = backupReportID(profile["reportId"]) }
                storage[key] = try NativeFamilyOrigin.json(profile)
            } else { storage[key] = value }
        }
        return .init(data: storage, native: backup.native)
    }
    static func portableSnapshot(document: NativeFamilyDocument, family: NativeFamilyOrigin) throws -> NativeFamilyPortableBackup {
        // Stale orphan child data is not surfaced as a child and does not travel.
        let data = family.storage.filter { key, _ in
            let part = LegacyKeys.parts(key)
            // A future per-player base is still owned by its suffix. Orphaned
            // unknown fields stay in same-device storage, never a phone backup.
            if key.contains("@"), LegacyKeys.slotNumber(part.slot) != nil {
                return family.slots.contains(part.slot) && key == NativeFamilyOrigin.key(part.base, part.slot)
            }
            return !LegacyKeys.perChild.contains(part.base) ||
                (family.slots.contains(part.slot) && key == NativeFamilyOrigin.key(part.base, part.slot))
        }
        let children = Dictionary(uniqueKeysWithValues: family.slots.map { slot in
            let id = NativeFamilyChildID(origin: family.origin, slot: slot)
            return (slot, NativeFamilyPortableBackup.Child(books: document.bookmarks(for: id), games: document.completedGames(for: id)))
        })
        return try sanitize(.init(data: data, native: .init(children: children)))
    }
    static func applyPortable(_ backup: NativeFamilyPortableBackup, action: NativeFamilyBackupAction,
        document: inout NativeFamilyDocument, origin: LegacyOrigin,
        evaluate: @Sendable (NativeFamilyBackupAction, Data, [String: String]) throws -> NativeFamilyBackupMutation
    ) throws -> NativeFamilyBackupResult {
        guard var family = document.origins[origin.rawValue] else { throw NativeFamilyBackupError.wrongOrigin }
        try backup.validate()
        let old = family
        var rulesData = backup.data
        if backup.native?.ownership == "explicit" { rulesData["sona.buddyset.v1"] = "post" }
        let rulesPayload = try NativeFamilyPortableBackup(data: rulesData).encoded()
        let mutation = try evaluate(action, rulesPayload, family.storage)
        guard let wire = try? JSONSerialization.jsonObject(with: mutation.value) as? [String: Any],
              NativeFamilyOrigin.isTrue(wire["ok"]),
              mutation.changes.keys.allSatisfy({ $0.hasPrefix("sona.") }),
              mutation.removals.allSatisfy({ $0.hasPrefix("sona.") }) else { throw NativeFamilyBackupError.invalidRuleResult }
        for (key, value) in mutation.changes { family.storage[key] = value }
        for key in mutation.removals { family.storage.removeValue(forKey: key) }
        // Every destination-only receipt, identity and grant is held exactly.
        // Canonical board/report cleanup may write its local queues; it is not
        // imported from the file. Sharing consent itself is never transferred.
        for key in Set(old.storage.keys).union(family.storage.keys) where NativeFamilyBackupPolicy.immutable.contains(LegacyKeys.parts(key).base) {
            family.storage[key] = old.storage[key]
        }
        let profileSlots = Set(old.slots).union(backup.data.keys.compactMap { key -> String? in
            let part = LegacyKeys.parts(key); return part.base == LegacyKeys.profile ? part.slot : nil
        })
        for slot in profileSlots {
            let key = NativeFamilyOrigin.key(LegacyKeys.profile, slot)
            guard var profile = NativeFamilyOrigin.object(family.storage[key]) else { continue }
            let prior = NativeFamilyOrigin.object(old.storage[key]) ?? [:]
            let sameIdentity = profile["childName"] as? String == prior["childName"] as? String &&
                profile["childAge"] as? String == prior["childAge"] as? String
            for field in NativeFamilyBackupPolicy.profileSecurity {
                profile[field] = sameIdentity ? prior[field] : nil
            }
            // An explicit withdrawal is sticky while destination pilot/ticket
            // evidence is retained, even when the imported profile is different.
            // Omitting false would make shipping slpSharing treat it as sharing.
            if backupIsFalse(prior["slpShare"]) { profile["slpShare"] = false }
            // An opted-in address cannot be changed by pasted profile data.
            if sameIdentity { profile["email"] = prior["email"] }
            if let imported = NativeFamilyOrigin.object(backup.data[key]) {
                // REPORT1 deliberately carries this pseudonym with the child so
                // one child's progress is not counted twice after a phone move.
                // It is not the raw device ID and can never enable reporting.
                profile["reportId"] = backupReportID(imported["reportId"]) ?? (sameIdentity ? backupReportID(prior["reportId"]) : nil)
            }
            family.storage[key] = try NativeFamilyOrigin.json(profile)
        }
        guard let projection = try? SnapshotImporter.prepare(LegacySnapshot(origin: origin, storage: family.storage)) else {
            throw NativeFamilyBackupError.invalidBackup
        }
        // A portable file cannot rebind a verified sharing child to a new person.
        for slot in old.slots {
            let pilot = NativeFamilyOrigin.object(old.storage[NativeFamilyOrigin.key("sona.pilot.v1", slot)]) ?? [:]
            let key = NativeFamilyOrigin.key(LegacyKeys.profile, slot)
            let prior = NativeFamilyOrigin.object(old.storage[key]) ?? [:]
            // Literal shipping slpSharing predicate. A withdrawn or founding
            // pilot can still preserve access without sharing clinical progress.
            let shares = backupTruthy(pilot["consent"]) && backupTruthy(pilot["childId"]) &&
                !(pilot["code"] as? String ?? "").hasPrefix("ff-") &&
                !backupIsFalse(prior["slpShare"]) &&
                !(old.storage["sona.slpticket"] ?? "").isEmpty
            if shares {
                guard projection.children.contains(where: { $0.slot == slot }),
                      NativeFamilyOrigin.object(old.storage[key])?["childName"] as? String == NativeFamilyOrigin.object(family.storage[key])?["childName"] as? String else {
                    throw NativeFamilyBackupError.sharingChildChanged
                }
            }
        }
        family.slots = projection.children.map(\.slot); family.activeSlot = projection.activeSlot
        family.slotHighWaterMark = max(old.slotHighWaterMark, projection.slotHighWaterMark)
        if !family.slots.isEmpty { try family.writeRoster() }
        // Queue each withdrawn address using the original REPORT1 policy in
        // this same transaction. Never erase old off errands or send a request.
        func reportAddresses(_ storage: [String: String], _ slots: [String]) -> Set<String> {
            Set(slots.compactMap { slot in
                let profile = NativeFamilyOrigin.object(storage[NativeFamilyOrigin.key(LegacyKeys.profile, slot)]) ?? [:]
                guard NativeFamilyOrigin.isTrue(profile["weeklyReport"]), let email = profile["email"] as? String else { return nil }
                let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                return normalized.isEmpty ? nil : normalized
            })
        }
        let withdrawn = reportAddresses(old.storage, old.slots).subtracting(reportAddresses(family.storage, family.slots))
        for email in withdrawn.sorted() {
            let queued = try evaluate(.withdrawReport, Data(email.utf8), family.storage)
            guard queued.removals.isEmpty, Set(queued.changes.keys).isSubset(of: ["sona.report.v1"]),
                  queued.changes.values.allSatisfy({ NativeFamilyOrigin.object($0) != nil }) else {
                throw NativeFamilyBackupError.invalidRuleResult
            }
            family.storage.merge(queued.changes) { _, value in value }
        }
        document.origins[origin.rawValue] = family
        // Only explicit, versioned metadata can transfer native-only state.
        let importedSlots = Set(backup.data.keys.compactMap { key -> String? in
            let part = LegacyKeys.parts(key); return part.base == LegacyKeys.profile ? part.slot : nil
        })
        let allSlots = Set(old.slots).union(family.slots)
        for slot in allSlots {
            let id = NativeFamilyChildID(origin: origin, slot: slot)
            if !family.slots.contains(slot) || importedSlots.contains(slot) || action == .undo {
                document.readingPlaces?.removeValue(forKey: id); document.gameCompletions?.removeValue(forKey: id)
            }
            if let extra = backup.native?.children[slot] {
                guard family.slots.contains(slot) else { throw NativeFamilyBackupError.invalidBackup }
                var books = document.readingPlaces ?? [:]; books[id] = extra.books; document.readingPlaces = books
                var games = document.gameCompletions ?? [:]; games[id] = extra.games; document.gameCompletions = games
            }
        }
        guard Set(backup.native?.children.keys.map { $0 } ?? []).isSubset(of: Set(family.slots)) else { throw NativeFamilyBackupError.invalidBackup }
        return .init(restored: (wire["restored"] as? Int) ?? 0, removed: (wire["removed"] as? Int) ?? 0,
                     skipped: (wire["skipped"] as? Int) ?? 0)
    }
}
