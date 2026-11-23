import Foundation
import CryptoKit
import CoreFoundation

/// Private native-document container history. This is not a physical purge
/// receipt, an access grant, or a value accepted from a portable backup.
public enum NativeFamilyBootstrapProvenance: String, Codable, Equatable, Sendable {
    case emptyNativePreviewWithoutLegacy = "native-preview-empty-without-legacy-v1"
}

/// Values accepted under the shipping setup screens. This is device-local
/// consent, not an access grant, clinician-sharing choice, or transport request.
public struct NativeFamilySetupConsent: Codable, Equatable, Sendable {
    public let askQuestions: Bool
    public let therapy: String
    public let displayedUpdates: Bool
    public let acceptedReportEmail: String?

    public init(askQuestions: Bool, therapy: String = "", displayedUpdates: Bool = false,
                acceptedReportEmail: String? = nil) {
        self.askQuestions = askQuestions; self.therapy = therapy
        self.displayedUpdates = displayedUpdates; self.acceptedReportEmail = acceptedReportEmail
    }
}

public extension NativeFamilyRepository {
    /// Reads only the accepted specialized receipt and its exact saved child.
    /// An onboarded rewalk or an old generic receipt alone proves no accepted
    /// setup submission. This never evaluates rules, grants access or writes.
    func hasAcceptedFamilySetup(to child: NativeFamilyChildID, receiptID: String) throws -> Bool {
        guard let document = try snapshot(),
              let receipt = document.ruleReceipts?[receiptID], receipt.child == child,
              receipt.setupDigest != nil,
              let family = document.origins[child.origin.rawValue],
              let savedChild = family.children.first(where: { $0.id == child }) else { return false }
        return NativeFamilyOrigin.isTrue(NativeFamilyOrigin.object(savedChild.profileJSON)?["onboarded"])
    }

    /// Default local preview follows regular first-family setup. It opens no
    /// legacy origin and creates neither a child nor a permanent free promise.
    /// The separate explicit demo-roster seed remains unchanged.
    func seedEmptyPreview() throws -> NativeFamilyDocument {
        guard Bundle.main.bundleIdentifier == "com.speaksona.family.native-preview" else {
            throw NativeFamilyRuleError.invalidPreviewContainer
        }
        if let current = try snapshot() { return current }
        return try seed(from: Self.emptyPreviewArchive(), primaryOrigin: .app,
                        bootstrapProvenance: .emptyNativePreviewWithoutLegacy)
    }

    /// Completes only a known-fresh preview's native cleanup. Release cleanup
    /// still requires actual legacy redaction and its separate audio receipt.
    func acknowledgePreviewPlayerRemoval(_ child: NativeFamilyChildID) throws {
        guard Bundle.main.bundleIdentifier == "com.speaksona.family.native-preview" else {
            throw NativeFamilyRuleError.invalidPreviewContainer
        }
        try change { document in try Self.completeEmptyPreviewRemoval(child, document: &document) }
    }

    /// Commits canonical setup child writes, its once-per-household answer and
    /// an explicitly requested report signup together. No HTTP is performed or
    /// prepared here. The host may start the existing report queue afterwards.
    /// `input` is the JSON-encoded canonical setup input used by `evaluate`.
    /// Only its digest is retained, so a retry cannot change an accepted choice.
    func applyFamilySetup(to child: NativeFamilyChildID, receiptID: String, input: Data,
                          consent: NativeFamilySetupConsent,
                          evaluate: @Sendable (NativeFamilyOrigin) throws -> NativeFamilyRuleMutation) throws -> Data {
        guard !receiptID.isEmpty, receiptID.count <= 120,
              let request = try JSONSerialization.jsonObject(with: input) as? [String: Any],
              ["", "t_yes", "t_none", "t_no"].contains(consent.therapy),
              consent.askQuestions || (consent.therapy.isEmpty && !consent.displayedUpdates),
              consent.displayedUpdates || consent.acceptedReportEmail == nil else {
            throw NativeFamilyRuleError.invalidKey
        }
        let email: String?
        if let raw = consent.acceptedReportEmail {
            guard let address = Self.setupEmail(raw) else { throw NativeFamilyReportError.invalidAddress }
            email = address
        } else { email = nil }
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        let canonicalInput = try JSONSerialization.data(withJSONObject: request, options: [.sortedKeys])
        let digestInput = try encoder.encode([receiptID, canonicalInput.base64EncodedString(),
                                              encoder.encode(consent).base64EncodedString()])
        let digest = SHA256.hash(data: digestInput).map { String(format: "%02x", $0) }.joined()
        return try change { document in
            guard document.activeChild?.id == child,
                  var family = document.origins[child.origin.rawValue] else { throw NativeFamilyRuleError.playerChanged }
            if let receipt = document.ruleReceipts?[receiptID] {
                guard receipt.child == child, receipt.setupDigest == nil || receipt.setupDigest == digest else {
                    throw NativeFamilyRepositoryError.operationConflict
                }
                throw NativeFamilyRuleError.replayed
            }
            let profileKey = NativeFamilyOrigin.key(LegacyKeys.profile, child.slot)
            guard let oldProfile = NativeFamilyOrigin.object(family.storage[profileKey]) else {
                throw NativeFamilyRepositoryError.invalidProfile
            }
            if consent.askQuestions {
                guard family.slots.count < 2, family.storage["sona.setupasks.v1"] == nil,
                      oldProfile["role"] as? String != "slp" else { throw NativeFamilyRuleError.playerChanged }
            }
            if consent.displayedUpdates {
                guard consent.askQuestions, Self.setupParentEmail(in: family).isEmpty else {
                    throw NativeFamilyRuleError.playerChanged
                }
            }
            let output = try evaluate(family)
            let allowed = Set(LegacyKeys.perChild.map { NativeFamilyOrigin.key($0, child.slot) })
            let answerKey = "sona.setupasks.v1"
            let childChanges = output.changes.filter { $0.key != answerKey }
            guard Set(childChanges.keys).isSubset(of: allowed), Set(output.removals).isSubset(of: allowed),
                  Set(output.changes.keys).isDisjoint(with: output.removals),
                  !output.removals.contains(profileKey) else { throw NativeFamilyRuleError.invalidKey }
            if let raw = output.changes[answerKey] {
                guard consent.askQuestions, let answer = NativeFamilyOrigin.object(raw),
                      Set(answer.keys) == Set(["v", "therapy"]),
                      let version = answer["v"] as? NSNumber, CFGetTypeID(version) != CFBooleanGetTypeID(),
                      version.doubleValue == 2, answer["therapy"] as? String == consent.therapy else {
                    throw NativeFamilyRuleError.invalidKey
                }
            }
            for (key, raw) in childChanges { family.storage[key] = raw }
            for key in output.removals { family.storage.removeValue(forKey: key) }
            guard var profile = NativeFamilyOrigin.object(family.storage[profileKey]),
                  NativeFamilyOrigin.isTrue(profile["onboarded"]) else { throw NativeFamilyRepositoryError.invalidProfile }
            // Child rules do not own email/report consent or its stable identity.
            // A skipped step cannot silently reactivate withdrawn consent.
            for field in ["email", "weeklyEmail", "weeklyReport", "reportId"] {
                guard Self.setupEqual(oldProfile[field], profile[field]) else { throw NativeFamilyRuleError.invalidKey }
            }
            if let email {
                profile["email"] = email; profile["weeklyEmail"] = true; profile["weeklyReport"] = true
                family.storage[profileKey] = try NativeFamilyOrigin.json(profile)
                var journals = document.weeklyReportJournal ?? [:]
                var journal = journals[child.origin.rawValue] ?? NativeFamilyReportJournal()
                journal.signup = .init(id: UUID(), origin: child.origin, email: email, premium: false, source: .appSetup)
                journals[child.origin.rawValue] = journal; document.weeklyReportJournal = journals
            }
            if consent.askQuestions {
                family.storage[answerKey] = try NativeFamilyOrigin.json(["v": 2, "therapy": consent.therapy])
            }
            if oldProfile["childName"] as? String != profile["childName"] as? String { try family.writeRoster() }
            document.origins[child.origin.rawValue] = family
            var receipts = document.ruleReceipts ?? [:]
            receipts[receiptID] = .init(child: child, setupDigest: digest)
            document.ruleReceipts = receipts
            return output.value
        }
    }
}

extension NativeFamilyRepository {
    /// Pure local fixture, also used by tests without bypassing the public
    /// initializer's actual-process bundle guard.
    static func emptyPreviewArchive() throws -> MigrationArchive {
        var archive = MigrationArchive()
        for origin in LegacyOrigin.allCases {
            archive.origins[origin.rawValue] = try SnapshotImporter.prepare(.init(origin: origin, storage: [:]))
        }
        return archive
    }

    static func completeEmptyPreviewRemoval(_ child: NativeFamilyChildID, document: inout NativeFamilyDocument) throws {
        let expected = try emptyPreviewArchive().origins.mapValues(\.fingerprint)
        guard document.bootstrapProvenance == .emptyNativePreviewWithoutLegacy,
              document.sourceFingerprints == expected,
              document.pendingLocalPlayerRemovals?.contains(child) == true,
              let family = document.origins[child.origin.rawValue], !family.slots.contains(child.slot) else {
            throw NativeFamilyRuleError.playerChanged
        }
        document.pendingLocalPlayerRemovals?.remove(child)
    }

    /// Same validation/trim as onboarding's Get the report button. REPORT1 has
    /// its separate, narrower printable-ASCII/120-character delivery address.
    static func setupEmail(_ raw: String) -> String? {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.range(of: #"^\S+@\S+\.\S+$"#, options: .regularExpression) != nil ? value : nil
    }
    private static func setupParentEmail(in family: NativeFamilyOrigin) -> String {
        func good(_ raw: Any?) -> String? {
            guard let raw = raw as? String, let value = setupEmail(raw), value.utf16.count <= 254 else { return nil }
            return value
        }
        if let active = family.activeChild, let email = good(NativeFamilyOrigin.object(active.profileJSON)?["email"]) { return email }
        for child in family.children {
            if let email = good(NativeFamilyOrigin.object(child.profileJSON)?["email"]) { return email }
        }
        for key in ["sona.trial.v1", "sona.sub.v1"] {
            if let email = good(NativeFamilyOrigin.object(family.storage[key])?["email"]) { return email }
        }
        return ""
    }
    private static func setupEqual(_ lhs: Any?, _ rhs: Any?) -> Bool {
        switch (lhs, rhs) {
        case (nil, nil): return true
        case let (a?, b?):
            return (try? JSONSerialization.data(withJSONObject: ["v": a], options: [.sortedKeys])) ==
                   (try? JSONSerialization.data(withJSONObject: ["v": b], options: [.sortedKeys]))
        default: return false
        }
    }
}
