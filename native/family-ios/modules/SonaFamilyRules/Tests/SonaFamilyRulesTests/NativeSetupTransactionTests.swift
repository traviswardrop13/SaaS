import Foundation
import XCTest
@testable import SonaFamilyRules
@testable import SonaFamilyMigration

private final class SetupTransactionDisk: NativeFamilyDocumentStore, @unchecked Sendable {
    var value: NativeFamilyDocument?
    var failBefore = false, failAfter = false
    enum Failure: Error { case before, after }
    func read() throws -> NativeFamilyDocument? { value }
    func commit(_ document: NativeFamilyDocument) throws {
        if failBefore { throw Failure.before }
        value = document
        if failAfter { throw Failure.after }
    }
}

final class NativeSetupTransactionTests: XCTestCase {
    private let owner = NativeFamilyChildID(origin: .app, slot: "")
    private let email = "Synthetic+Setup@Example.invalid"
    private struct Input: Encodable, Sendable {
        var name = "Private synthetic nickname", age = "6", mode = "speech", pathReason = "", character = "fox"
        var focusSounds = ["S"]
        var minutes: Int? = 5
    }
    private func seeded(profile: String = #"{"onboarded":false,"focusSounds":["R"],"weeklyReport":false,"weeklyEmail":false,"reportId":"aaaaaaaaaaaaaaaa","earlyAdopter":true}"#,
                        extra: [String: String] = [:]) async throws -> (SetupTransactionDisk, NativeFamilyRepository) {
        let disk = SetupTransactionDisk(), repo = NativeFamilyRepository(store: disk)
        var storage = ["sona.profile.v1": profile,
                       "sona.freeera.v1":"post", "sona.freeera2.v1":"done", "sona.freeera3.v1":"done",
                       "sona.freeera4.v1":"done", "sona.freeera5.v1":"done", "sona.sdk.synthetic":"keep",
                       "sona.buddyset.v1":"post", "sona.freever.v1":"post"]
        storage.merge(extra) { _, new in new }
        var archive = MigrationArchive()
        for origin in LegacyOrigin.allCases {
            archive.origins[origin.rawValue] = try SnapshotImporter.prepare(.init(origin: origin, storage: origin == .app ? storage : [:]))
        }
        _ = try await repo.seed(from: archive, primaryOrigin: .app)
        return (disk, repo)
    }
    private func mutation(_ family: NativeFamilyOrigin, input: Input = Input()) throws -> NativeFamilyRuleMutation {
        let result = try NativeFamilyRules.evaluate(.completeSetup, input: input, storage: family.storage)
        return .init(value: result.value, changes: result.changes, removals: result.removals)
    }
    private func commit(_ repo: NativeFamilyRepository, input: Input = Input(), receipt: String = "setup/synthetic",
                        consent: NativeFamilySetupConsent) async throws {
        let payload = try JSONEncoder().encode(input)
        _ = try await repo.applyFamilySetup(to: owner, receiptID: receipt, input: payload, consent: consent) { family in
            let result = try NativeFamilyRules.evaluate(.completeSetup, input: input, storage: family.storage)
            return .init(value: result.value, changes: result.changes, removals: result.removals)
        }
    }
    private func profile(_ disk: SetupTransactionDisk) throws -> [String: Any] {
        try XCTUnwrap(disk.value?.primaryFamily?.activeChild.flatMap { NativeFamilyOrigin.object($0.profileJSON) })
    }
    private var optIn: NativeFamilySetupConsent {
        .init(askQuestions: true, therapy: "t_no", displayedUpdates: true, acceptedReportEmail: "  " + email + "  ")
    }

    func testAcceptedSetupReceiptReadIsTrueAndNeverMutatesRecords() async throws {
        let (disk, repo) = try await seeded()
        let pending = try await repo.hasAcceptedFamilySetup(to: owner, receiptID: "setup/synthetic")
        XCTAssertFalse(pending)
        try await commit(repo, consent: optIn)
        let accepted = disk.value
        for _ in 0..<2 {
            let found = try await repo.hasAcceptedFamilySetup(to: owner, receiptID: "setup/synthetic")
            XCTAssertTrue(found)
            XCTAssertEqual(disk.value, accepted)
        }
    }

    func testOnboardedRewalkAndLegacyGenericReceiptDoNotProveAcceptedSetup() async throws {
        let (disk, repo) = try await seeded(profile: #"{"onboarded":true,"focusSounds":["S"],"weeklyReport":false}"#)
        let missing = try await repo.hasAcceptedFamilySetup(to: owner, receiptID: "setup/unaccepted-rewalk")
        XCTAssertFalse(missing)
        disk.value?.ruleReceipts = ["setup/legacy": .init(child: owner)]
        let before = disk.value
        let generic = try await repo.hasAcceptedFamilySetup(to: owner, receiptID: "setup/legacy")
        XCTAssertFalse(generic)
        XCTAssertEqual(disk.value, before)
    }

    func testAcceptedSetupReceiptCannotMatchAnotherChildOriginOrReceipt() async throws {
        let (disk, repo) = try await seeded()
        try await commit(repo, consent: optIn)
        let sibling = try await repo.addChild(name: "Fictional sibling", age: "4", operationID: UUID())
        let before = disk.value
        let foreignChild = try await repo.hasAcceptedFamilySetup(to: sibling, receiptID: "setup/synthetic")
        let foreignOrigin = try await repo.hasAcceptedFamilySetup(to: .init(origin: .www, slot: owner.slot), receiptID: "setup/synthetic")
        let foreignReceipt = try await repo.hasAcceptedFamilySetup(to: owner, receiptID: "setup/other")
        let acceptedChild = try await repo.hasAcceptedFamilySetup(to: owner, receiptID: "setup/synthetic")
        XCTAssertFalse(foreignChild); XCTAssertFalse(foreignOrigin); XCTAssertFalse(foreignReceipt)
        XCTAssertTrue(acceptedChild, "The exact saved child is independent of which sibling is selected")
        XCTAssertEqual(disk.value, before)
    }

    func testTypedSetupReceiptWithoutAnOnboardedChildIsStillUnaccepted() async throws {
        let (disk, repo) = try await seeded()
        disk.value?.ruleReceipts = ["setup/unfinished": .init(child: owner, setupDigest: String(repeating: "a", count: 64))]
        let before = disk.value
        let unfinished = try await repo.hasAcceptedFamilySetup(to: owner, receiptID: "setup/unfinished")
        XCTAssertFalse(unfinished)
        XCTAssertEqual(disk.value, before)
    }

    func testCanonicalChildSetupAnswerAndExplicitReportSignupCommitTogether() async throws {
        let (disk, repo) = try await seeded()
        let initial = try XCTUnwrap(disk.value)
        try await commit(repo, consent: optIn)
        let saved = try profile(disk)
        XCTAssertEqual(saved["childName"] as? String, "Private synthetic nickname")
        XCTAssertEqual(saved["focusSounds"] as? [String], ["S"])
        XCTAssertEqual(saved["dailyGoal"] as? Int, 30)
        XCTAssertEqual(saved["weeklyReport"] as? Bool, true)
        XCTAssertEqual(saved["weeklyEmail"] as? Bool, true)
        XCTAssertEqual(saved["email"] as? String, email)
        XCTAssertEqual(saved["reportId"] as? String, "aaaaaaaaaaaaaaaa")
        XCTAssertEqual(saved["earlyAdopter"] as? Bool, true)
        let answer = NativeFamilyOrigin.object(disk.value?.primaryFamily?.storage["sona.setupasks.v1"])
        XCTAssertEqual(answer?["v"] as? Int, 2)
        XCTAssertEqual(answer?["therapy"] as? String, "t_no")
        let signup = try XCTUnwrap(disk.value?.weeklyReportJournal?[LegacyOrigin.app.rawValue]?.signup)
        XCTAssertEqual(signup.email, email); XCTAssertEqual(signup.source, .appSetup)
        XCTAssertNil(disk.value?.weeklyReportJournal?[LegacyOrigin.app.rawValue]?.packet)
        XCTAssertNil(disk.value?.primaryFamily?.storage["sona.report.v1"])
        XCTAssertEqual(disk.value?.sourceFingerprints, initial.sourceFingerprints)
        XCTAssertEqual(disk.value?.householdPromises, initial.householdPromises)
        XCTAssertEqual(disk.value?.primaryFamily?.storage["sona.sdk.synthetic"], "keep")
        for origin in LegacyOrigin.allCases where origin != .app {
            XCTAssertEqual(disk.value?.origins[origin.rawValue], initial.origins[origin.rawValue])
        }
    }

    func testSkipKeepsWithdrawnFalseAndDoesNotCreateASignup() async throws {
        let (disk, repo) = try await seeded()
        try await commit(repo, consent: .init(askQuestions: true, displayedUpdates: true))
        let saved = try profile(disk)
        XCTAssertEqual(saved["weeklyReport"] as? Bool, false)
        XCTAssertEqual(saved["weeklyEmail"] as? Bool, false)
        XCTAssertNil(saved["email"])
        XCTAssertNil(disk.value?.weeklyReportJournal)
        XCTAssertEqual(NativeFamilyOrigin.object(disk.value?.primaryFamily?.storage["sona.setupasks.v1"])?["therapy"] as? String, "")
    }

    func testPreviouslyAskedPathPreservesExactStampAndConsentBytes() async throws {
        let stamp = #"{ "v": 2, "therapy": "t_yes", "legacy": "keep" }"#
        let (disk, repo) = try await seeded(extra: ["sona.setupasks.v1": stamp])
        var input = Input(); input.minutes = nil
        try await commit(repo, input: input, consent: .init(askQuestions: false))
        XCTAssertEqual(disk.value?.primaryFamily?.storage["sona.setupasks.v1"], stamp)
        XCTAssertEqual(try profile(disk)["weeklyReport"] as? Bool, false)
        XCTAssertNil(disk.value?.weeklyReportJournal)
    }

    func testBeforeWriteFailureLeavesEveryPartUnchangedAndRetryCommitsOnce() async throws {
        let (disk, repo) = try await seeded(); let before = disk.value
        disk.failBefore = true
        do { try await commit(repo, consent: optIn); XCTFail("expected save failure") }
        catch SetupTransactionDisk.Failure.before {}
        XCTAssertEqual(disk.value, before)
        disk.failBefore = false
        try await commit(repo, consent: optIn)
        let accepted = disk.value
        do { try await commit(repo, consent: optIn); XCTFail("accepted retry must be replayed") }
        catch NativeFamilyRuleError.replayed {}
        XCTAssertEqual(disk.value, accepted)
    }

    func testLostAcknowledgmentRetryCannotDuplicateSignupOrReevaluateSetup() async throws {
        let (disk, repo) = try await seeded(); disk.failAfter = true
        do { try await commit(repo, consent: optIn); XCTFail("expected lost acknowledgment") }
        catch SetupTransactionDisk.Failure.after {}
        let accepted = disk.value; disk.failAfter = false
        do { try await commit(NativeFamilyRepository(store: disk), consent: optIn); XCTFail("expected replay") }
        catch NativeFamilyRuleError.replayed {}
        XCTAssertEqual(disk.value, accepted)
    }

    func testAcceptedReceiptRejectsChangedInputOrChangedConsentButAllowsJSONKeyOrderRetry() async throws {
        let (disk, repo) = try await seeded()
        try await commit(repo, consent: optIn); let accepted = disk.value
        var changed = Input(); changed.name = "Another synthetic nickname"
        do { try await commit(repo, input: changed, consent: optIn); XCTFail("changed payload") }
        catch NativeFamilyRepositoryError.operationConflict {}
        do { try await commit(repo, consent: .init(askQuestions: true, therapy: "t_yes", displayedUpdates: true, acceptedReportEmail: "  " + email + "  ")); XCTFail("changed consent") }
        catch NativeFamilyRepositoryError.operationConflict {}
        let bytes = try JSONSerialization.data(withJSONObject: JSONSerialization.jsonObject(with: JSONEncoder().encode(Input())), options: [.prettyPrinted, .sortedKeys])
        do {
            _ = try await repo.applyFamilySetup(to: owner, receiptID: "setup/synthetic", input: bytes, consent: optIn) { _ in
                XCTFail("replay must not evaluate"); return .init(value: Data(), changes: [:], removals: [])
            }; XCTFail("expected replay")
        } catch NativeFamilyRuleError.replayed {}
        XCTAssertEqual(disk.value, accepted)
    }

    func testGenericRulesRemainStrictAndSpecializedSetupRejectsForeignHouseholdOrSiblingWrites() async throws {
        for key in ["sona.setupasks.v1", "sona.sub.v1", "sona.report.v1", "sona.profile.v1@k2"] {
            let (disk, repo) = try await seeded(); let before = disk.value
            do {
                _ = try await repo.applyRules(to: owner) { _ in .init(value: Data(), changes: [key: "{}"], removals: []) }
                XCTFail("generic writer must remain child-only")
            } catch NativeFamilyRuleError.invalidKey {}
            do {
                _ = try await repo.applyFamilySetup(to: owner, receiptID: "setup/bad", input: Data("{}".utf8), consent: .init(askQuestions: true)) { _ in
                    .init(value: Data(), changes: [key: "{}"], removals: [])
                }; XCTFail("specialized writer must reject foreign/wrong stamp")
            } catch NativeFamilyRuleError.invalidKey {}
            XCTAssertEqual(disk.value, before)
        }
    }

    func testNoDisplayedEmailOrIneligibleHouseholdCanManufactureOptIn() async throws {
        for consent in [NativeFamilySetupConsent(askQuestions: true, acceptedReportEmail: email),
                        .init(askQuestions: false, displayedUpdates: true, acceptedReportEmail: email),
                        .init(askQuestions: true, therapy: "private free text")] {
            let (disk, repo) = try await seeded(); let before = disk.value
            do { try await commit(repo, consent: consent); XCTFail("invalid consent") } catch {}
            XCTAssertEqual(disk.value, before)
        }
        let (disk, repo) = try await seeded(extra: ["sona.sub.v1": #"{"email":"existing-parent@example.invalid","active":false}"#])
        let before = disk.value
        do { try await commit(repo, consent: optIn); XCTFail("existing parent email hides updates") }
        catch NativeFamilyRuleError.playerChanged {}
        XCTAssertEqual(disk.value, before)
    }

    func testUndisplayedQuestionCannotRewriteStampOrWithdrawnConsentOrReportIdentity() async throws {
        for patch in [["weeklyReport": true] as [String: Any], ["weeklyEmail": true],
                      ["email": email], ["reportId": "bbbbbbbbbbbbbbbb"], ["weeklyReport": 0]] {
            let (disk, repo) = try await seeded(extra: ["sona.setupasks.v1": #"{"v":2,"therapy":"t_none"}"#])
            let before = disk.value
            do {
                _ = try await repo.applyFamilySetup(to: owner, receiptID: "setup/bad", input: Data("{}".utf8), consent: .init(askQuestions: false)) { family in
                    var profile = NativeFamilyOrigin.object(family.storage["sona.profile.v1"])!
                    profile["onboarded"] = true; profile.merge(patch) { _, new in new }
                    return .init(value: Data(), changes: ["sona.profile.v1": try NativeFamilyOrigin.json(profile)], removals: [])
                }; XCTFail("consent is not owned by generic child changes")
            } catch NativeFamilyRuleError.invalidKey {}
            XCTAssertEqual(disk.value, before)
        }
    }

    func testSetupDoesNotResetExistingReportOffStateAndWithdrawnSignupCannotSend() async throws {
        let report = #"{"dev":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","off":"synthetic+setup@example.invalid","offAt":100,"pend":99,"offs":[]}"#
        let (disk, repo) = try await seeded(extra: ["sona.report.v1": report])
        try await commit(repo, consent: optIn)
        XCTAssertEqual(disk.value?.primaryFamily?.storage["sona.report.v1"], report)
        let pendingSignup = try await repo.prepareWeeklyReportSignup(origin: .app, now: Date(timeIntervalSince1970: 1000))
        let signup = try XCTUnwrap(pendingSignup)
        let allowed = try await repo.weeklyReportMaySendSignup(signup); XCTAssertTrue(allowed)
        var stopped = try profile(disk); stopped["weeklyReport"] = false
        try await repo.updateChildKey("sona.profile.v1", value: try NativeFamilyOrigin.json(stopped), child: owner)
        let afterStop = try await repo.weeklyReportMaySendSignup(signup); XCTAssertFalse(afterStop)
        let next = try await repo.prepareWeeklyReportSignup(origin: .app, now: Date(timeIntervalSince1970: 2000))
        XCTAssertNil(next)
    }

    func testSwitchedOrRemovedOwnerCannotCommitAndAnotherOriginCannotSendSignup() async throws {
        let (disk, repo) = try await seeded()
        try await commit(repo, consent: optIn)
        let pendingSignup = try await repo.prepareWeeklyReportSignup(origin: .app, now: Date(timeIntervalSince1970: 1000))
        let signup = try XCTUnwrap(pendingSignup)
        try await repo.selectOrigin(.www)
        let otherOrigin = try await repo.weeklyReportMaySendSignup(signup); XCTAssertFalse(otherOrigin)
        try await repo.selectOrigin(.app)
        _ = try await repo.addChild(name: "Fictional sibling", age: "4", operationID: UUID())
        let before = disk.value
        do { try await commit(repo, receipt: "setup/stale", consent: optIn); XCTFail("switched owner") }
        catch NativeFamilyRuleError.playerChanged {}
        XCTAssertEqual(disk.value, before)
        _ = try await repo.removeChild(owner, operationID: UUID())
        let maySend = try await repo.weeklyReportMaySendSignup(signup); XCTAssertFalse(maySend)
        do { try await commit(repo, receipt: "setup/removed", consent: optIn); XCTFail("removed owner") }
        catch NativeFamilyRuleError.playerChanged {}
    }

    func testNewSignupSourceIsConstrainedAndOldJournalDefaultsToSettings() throws {
        let old = try JSONSerialization.data(withJSONObject: ["id": UUID().uuidString, "origin": LegacyOrigin.app.rawValue,
            "email": "synthetic-settings@example.invalid", "premium": true])
        let signup = try JSONDecoder().decode(NativeFamilyReportSignup.self, from: old)
        XCTAssertEqual(signup.source, .appSettings)
        let encoded = try JSONSerialization.jsonObject(with: JSONEncoder().encode(signup)) as? [String: Any]
        XCTAssertEqual(encoded?["source"] as? String, "app-settings")
        var invalid = try XCTUnwrap(encoded); invalid["source"] = "invented-origin"
        XCTAssertThrowsError(try JSONDecoder().decode(NativeFamilyReportSignup.self, from: JSONSerialization.data(withJSONObject: invalid)))
    }

    func testEmptyPreviewFixtureSeedsFourEmptyOriginsWithoutChildrenOrPromisesAndStandardAddRunsOnce() async throws {
        let disk = SetupTransactionDisk(), repo = NativeFamilyRepository(store: disk)
        let archive = try NativeFamilyRepository.emptyPreviewArchive()
        XCTAssertEqual(Set(archive.origins.keys), Set(LegacyOrigin.allCases.map(\.rawValue)))
        XCTAssertTrue(archive.origins.values.allSatisfy { $0.storage.isEmpty && $0.children.isEmpty })
        let seeded = try await repo.seed(from: archive, primaryOrigin: .app)
        XCTAssertEqual(seeded.primaryOrigin, .app)
        XCTAssertNil(seeded.activeChild)
        XCTAssertTrue(seeded.families.allSatisfy { $0.children.isEmpty })
        XCTAssertEqual(seeded.householdPromises, NativeFamilyHouseholdPromises())
        XCTAssertNil(seeded.appleAccess); XCTAssertNil(seeded.websiteAccess)
        let operation = UUID()
        let child = try await repo.addChild(name: "", age: "", operationID: operation)
        let same = try await repo.addChild(name: "", age: "", operationID: operation)
        XCTAssertEqual(child, same)
        XCTAssertEqual(disk.value?.primaryFamily?.children.count, 1)
        let profile = try profile(disk)
        XCTAssertNotEqual(profile["onboarded"] as? Bool, true)
        XCTAssertNotEqual(profile["earlyAdopter"] as? Bool, true)
        XCTAssertNotEqual(profile["founding"] as? Bool, true)
        XCTAssertNil(profile["email"])
        XCTAssertEqual(disk.value?.householdPromises, NativeFamilyHouseholdPromises())
        let first = disk.value
        _ = try await repo.seed(from: archive, primaryOrigin: .app)
        XCTAssertEqual(disk.value, first)
    }

    func testPublicEmptyPreviewSeedRefusesAnyNonPreviewProcessIdentity() async throws {
        guard Bundle.main.bundleIdentifier != "com.speaksona.family.native-preview" else { return }
        let disk = SetupTransactionDisk(), repo = NativeFamilyRepository(store: disk)
        do { _ = try await repo.seedEmptyPreview(); XCTFail("actual bundle guard must refuse this test host") }
        catch NativeFamilyRuleError.invalidPreviewContainer {}
        XCTAssertNil(disk.value)
    }

    func testPreviewCleanupRequiresTypedEmptyBootstrapAndNeverCreatesAPurgeReceipt() async throws {
        let disk = SetupTransactionDisk(), repo = NativeFamilyRepository(store: disk)
        _ = try await repo.seed(from: NativeFamilyRepository.emptyPreviewArchive(), primaryOrigin: .app)
        let first = try await repo.addChild(name: "Fictional first", age: "4", operationID: UUID())
        _ = try await repo.addChild(name: "Fictional second", age: "6", operationID: UUID())
        try await repo.removeChild(first, operationID: UUID(), removeLocalCopies: true)
        var unmarked = try XCTUnwrap(disk.value)
        let original = unmarked
        XCTAssertNil(unmarked.previewBootstrapProvenance)
        XCTAssertThrowsError(try NativeFamilyRepository.completeEmptyPreviewRemoval(first, document: &unmarked))
        XCTAssertEqual(unmarked, original)
        var marked = unmarked
        // This is a pure private-document fixture, not a public authorization
        // override. Public seed/ack still check the actual host Bundle below.
        marked.bootstrapProvenance = .emptyNativePreviewWithoutLegacy
        var wrongSource = marked; wrongSource.sourceFingerprints[LegacyOrigin.www.rawValue] = String(repeating: "0", count: 64)
        XCTAssertThrowsError(try NativeFamilyRepository.completeEmptyPreviewRemoval(first, document: &wrongSource))
        try NativeFamilyRepository.completeEmptyPreviewRemoval(first, document: &marked)
        XCTAssertFalse(marked.pendingLocalPlayerRemovals?.contains(first) ?? true)
        XCTAssertNil(marked.retiredRecordingOrigins, "No physical purge was performed")
        XCTAssertEqual(marked.previewBootstrapProvenance, .emptyNativePreviewWithoutLegacy)
        XCTAssertThrowsError(try NativeFamilyRepository.completeEmptyPreviewRemoval(first, document: &marked))
        disk.value = original
        if Bundle.main.bundleIdentifier != "com.speaksona.family.native-preview" {
            do { try await repo.acknowledgePreviewPlayerRemoval(first); XCTFail("public ack requires actual preview identity") }
            catch NativeFamilyRuleError.invalidPreviewContainer {}
            XCTAssertEqual(disk.value, original)
            do {
                _ = try await repo.seed(from: NativeFamilyRepository.emptyPreviewArchive(), primaryOrigin: .app,
                                       bootstrapProvenance: .emptyNativePreviewWithoutLegacy)
                XCTFail("internal typed seed also refuses a non-preview process")
            } catch NativeFamilyRuleError.invalidPreviewContainer {}
            XCTAssertEqual(disk.value, original)
        }
    }

    func testPortableBackupCannotExportOrMintBootstrapAndRestoreUndoRetainDestinationProvenance() async throws {
        for provenance in [nil, NativeFamilyBootstrapProvenance.emptyNativePreviewWithoutLegacy] {
            let disk = SetupTransactionDisk(), repo = NativeFamilyRepository(store: disk)
            _ = try await repo.seed(from: NativeFamilyRepository.emptyPreviewArchive(), primaryOrigin: .app)
            let child = try await repo.addChild(name: "Fictional local", age: "6", operationID: UUID())
            try await repo.updateChildKey("sona.profile.v1", value: #"{"childName":"Fictional local","onboarded":true,"focusSounds":["S"],"weeklyReport":false}"#, child: child)
            disk.value?.bootstrapProvenance = provenance
            let portable = try await repo.portableBackup(origin: .app)
            let exported = try portable.encoded(), text = String(decoding: exported, as: UTF8.self)
            XCTAssertFalse(text.contains("bootstrapProvenance"))
            XCTAssertFalse(text.contains(NativeFamilyBootstrapProvenance.emptyNativePreviewWithoutLegacy.rawValue))
            var forged = try XCTUnwrap(JSONSerialization.jsonObject(with: exported) as? [String: Any])
            forged["bootstrapProvenance"] = NativeFamilyBootstrapProvenance.emptyNativePreviewWithoutLegacy.rawValue
            XCTAssertThrowsError(try NativeFamilyPortableBackup.decode(JSONSerialization.data(withJSONObject: forged)))
            let incoming = try NativeFamilyPortableBackup(data: ["sona.profile.v1": #"{"childName":"Fictional incoming","onboarded":true,"focusSounds":["L"]}"#]).encoded()
            let evaluate: @Sendable (NativeFamilyBackupAction, Data, [String: String]) throws -> NativeFamilyBackupMutation = { action, bytes, storage in
                guard action != .withdrawReport else { throw NativeFamilyReportError.invalidProjection }
                let result = try NativeFamilyRules.evaluate(action == .restore ? .backupImport : .backupUndo,
                    input: ["payload": String(decoding: bytes, as: UTF8.self)], storage: storage)
                return .init(value: result.value, changes: result.changes, removals: result.removals)
            }
            _ = try await repo.restorePortableBackup(incoming, origin: .app, operationID: UUID(), evaluate: evaluate)
            XCTAssertEqual(disk.value?.previewBootstrapProvenance, provenance)
            _ = try await repo.undoPortableBackup(origin: .app, operationID: UUID(), evaluate: evaluate)
            XCTAssertEqual(disk.value?.previewBootstrapProvenance, provenance)
            XCTAssertNil(disk.value?.retiredRecordingOrigins)
        }
    }
}
