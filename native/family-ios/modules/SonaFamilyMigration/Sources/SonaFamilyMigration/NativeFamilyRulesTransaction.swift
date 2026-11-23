import Foundation

struct NativeFamilyRuleReceipt: Codable, Equatable, Sendable {
    let child: NativeFamilyChildID
    /// Only specialized setup commits use this. Old child-only receipts decode
    /// with nil and generic rule writes retain their existing behavior.
    let setupDigest: String?
    init(child: NativeFamilyChildID, setupDigest: String? = nil) {
        self.child = child; self.setupDigest = setupDigest
    }
}

public struct NativeFamilyRuleMutation: Sendable {
    public let value: Data
    public let changes: [String: String]
    public let removals: [String]

    public init(value: Data, changes: [String: String], removals: [String]) {
        self.value = value
        self.changes = changes
        self.removals = removals
    }
}

public enum NativeFamilyRuleError: Error {
    case playerChanged, invalidKey, replayed, invalidPreviewContainer
}

extension NativeFamilyRepository {
    /// Creates a distinct review container without opening any legacy origin.
    /// The installed release uses the verified capture path instead.
    public func seedPreview(sounds: [String], preferredSound: String) throws -> NativeFamilyDocument {
        guard Bundle.main.bundleIdentifier == "com.speaksona.family.native-preview" else {
            throw NativeFamilyRuleError.invalidPreviewContainer
        }
        if let current = try snapshot() { return current }
        var archive = MigrationArchive()
        let profile = try NativeFamilyOrigin.json(["onboarded": true, "focusSounds": sounds, "targetSound": preferredSound])
        let source = [
            LegacyKeys.profile: profile,
            "sona.freeera.v1": "post", "sona.freeera2.v1": "done", "sona.freeera3.v1": "done",
            "sona.freeera4.v1": "done", "sona.freeera5.v1": "done"
        ]
        for origin in LegacyOrigin.allCases {
            let imported = try SnapshotImporter.prepare(LegacySnapshot(origin: origin, storage: origin == .app ? source : [:]))
            archive.origins[origin.rawValue] = imported
        }
        return try seed(from: archive, primaryOrigin: .app)
    }

    /// Reads and changes the active native child's ledger as one transaction.
    /// The rules cannot write household grants, credentials or other children.
    /// A lost acknowledgment cannot replay an accepted attempt.
    public func applyRules(to child: NativeFamilyChildID, receiptID: String? = nil, gameCompletion: String? = nil,
                           _ evaluate: @Sendable (NativeFamilyOrigin) throws -> NativeFamilyRuleMutation) throws -> Data {
        try change { document in
            guard document.activeChild?.id == child,
                  var family = document.origins[child.origin.rawValue] else { throw NativeFamilyRuleError.playerChanged }
            if let receiptID {
                guard !receiptID.isEmpty, receiptID.count <= 120 else { throw NativeFamilyRepositoryError.operationConflict }
                if let receipt = document.ruleReceipts?[receiptID] {
                    guard receipt.child == child else { throw NativeFamilyRepositoryError.operationConflict }
                    throw NativeFamilyRuleError.replayed
                }
            }
            let output = try evaluate(family)
            let allowed = Set(LegacyKeys.perChild.map { NativeFamilyOrigin.key($0, child.slot) })
            guard Set(output.changes.keys).isSubset(of: allowed), Set(output.removals).isSubset(of: allowed),
                  Set(output.changes.keys).isDisjoint(with: output.removals),
                  !output.removals.contains(NativeFamilyOrigin.key(LegacyKeys.profile, child.slot))
            else { throw NativeFamilyRuleError.invalidKey }
            let key = NativeFamilyOrigin.key(LegacyKeys.profile, child.slot)
            let oldName = NativeFamilyOrigin.object(family.storage[key])?["childName"] as? String ?? ""
            for (key, raw) in output.changes { family.storage[key] = raw }
            for key in output.removals { family.storage.removeValue(forKey: key) }
            if let raw = output.changes[key], let profile = NativeFamilyOrigin.object(raw),
               oldName != (profile["childName"] as? String ?? "") {
                try family.writeRoster()
            }
            document.origins[child.origin.rawValue] = family
            if let gameCompletion {
                guard receiptID != nil, Self.validGameID(gameCompletion) else { throw NativeFamilyRuleError.invalidKey }
                var games = document.gameCompletions ?? [:]
                games[child, default: []].insert(gameCompletion)
                document.gameCompletions = games
            }
            if let receiptID {
                var receipts = document.ruleReceipts ?? [:]
                receipts[receiptID] = NativeFamilyRuleReceipt(child: child)
                document.ruleReceipts = receipts
            }
            return output.value
        }
    }
}
