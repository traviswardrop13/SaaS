import Foundation
import XCTest
@testable import SonaFamilyMigration
#if canImport(JavaScriptCore)
import JavaScriptCore
#endif

private enum NativeFixture {
    static let stamps = ["sona.freeera.v1": "post", "sona.freeera2.v1": "done", "sona.freeera3.v1": "done",
        "sona.freeera4.v1": "done", "sona.freeera5.v1": "done", "sona.freever.v1": "post", "sona.buddyset.v1": "post"]

    static func archive(twoFamilies: Bool = false, changes: [String: String] = [:]) throws -> MigrationArchive {
        var data = stamps
        data[LegacyKeys.roster] = #"{"active":"k4","hi":9,"list":[{"slot":"","name":"Synthetic A"},{"slot":"k4","name":"Synthetic B"}],"futureRosterField":"keep"}"#
        data[LegacyKeys.profile] = #"{"childName":"Synthetic A","earlyAdopter":true,"onboarded":true,"focusSounds":["R","S"],"targetSound":"S","email":"synthetic@example.invalid","weeklyReport":true,"reportId":"synthetic-report-a"}"#
        data[LegacyKeys.profile + "@k4"] = #"{"childName":"Synthetic B","onboarded":true,"focusSounds":["K"],"targetSound":"K","reportId":"synthetic-report-b"}"#
        for key in LegacyKeys.perChild where data[key] == nil { data[key] = #"{"synthetic":1}"# }
        for key in LegacyKeys.perChild where data[key + "@k4"] == nil { data[key + "@k4"] = #"{"synthetic":4}"# }
        data["sona.progress.v1"] = #"{"totals":{"coins":53},"sessions":[{"sound":"R","tries":5}]}"#
        data["sona.homework.v1@k4"] = #"{"sound":"K","position":"f","goal":10,"words":["book"]}"#
        data["sona.pilot.v1@k4"] = #"{"consent":true,"childId":"synthetic-b","code":"SYNTHETIC"}"#
        data["sona.lib.read.v1@k4"] = #"{"synthetic-book":{"page":4}}"#
        data["sona.trophy.v1@k4"] = #"{"t":750,"m":"2026-10","mn":75}"#
        data["sona.board.v1"] = #"{"token":"synthetic-board-a"}"#
        data["sona.future.v19@k4"] = "future child data retained"
        data["sona.profile.v1@k11"] = #"{"childName":"Removed synthetic child"}"#
        data["sona.sub.v1"] = #"{"active":true,"source":"apple"}"#
        data["sona.slpticket"] = "synthetic-invalid-ticket"
        data["sona.caseplan.v1"] = #"{"active":true}"#
        data["sona.report.v1"] = #"{"dev":"synthetic-device","offs":[]}"#
        data["sona.notify.v1"] = #"{"nudge":1}"#
        data.merge(changes) { _, next in next }
        var archive = MigrationArchive()
        for origin in LegacyOrigin.allCases {
            let source: [String: String]
            if origin == .www { source = data }
            else if origin == .app && twoFamilies {
                var app = stamps
                app[LegacyKeys.profile] = #"{"childName":"Synthetic other family","onboarded":true,"focusSounds":["F"],"reportId":"synthetic-other-report"}"#
                app["sona.progress.v1"] = #"{"totals":{"coins":7}}"#
                source = app
            } else { source = [:] }
            archive.origins[origin.rawValue] = try SnapshotImporter.prepare(LegacySnapshot(origin: origin, storage: source))
        }
        return archive
    }
}

private enum NativeTestFailure: Error { case beforeWrite, afterWrite }
private final class NativeMemoryStore: NativeFamilyDocumentStore, @unchecked Sendable {
    var value: NativeFamilyDocument?
    var commits = 0
    var failBefore = false, failAfter = false, discard = false
    func read() throws -> NativeFamilyDocument? { value }
    func commit(_ document: NativeFamilyDocument) throws {
        commits += 1
        if failBefore { throw NativeTestFailure.beforeWrite }
        if !discard { value = document }
        if failAfter { throw NativeTestFailure.afterWrite }
    }
}

final class NativeFamilyRepositoryTests: XCTestCase {
    private let first = NativeFamilyChildID(origin: .www, slot: "")
    private let second = NativeFamilyChildID(origin: .www, slot: "k4")
    private func current(_ repository: NativeFamilyRepository) async throws -> NativeFamilyDocument {
        let value = try await repository.snapshot()
        return try XCTUnwrap(value)
    }

    func testSeedPreservesWholeAppChildAndHouseholdDataAndRawCapture() async throws {
        let original = try NativeFixture.archive(), store = NativeMemoryStore()
        let repository = NativeFamilyRepository(store: store)
        let document = try await repository.seed(from: original)
        let family = try XCTUnwrap(document.primaryFamily)
        XCTAssertEqual(document.primaryOrigin, .www)
        XCTAssertEqual(document.activeChild?.id, second)
        XCTAssertEqual(family.storage, original.origins[LegacyOrigin.www.rawValue]?.storage)
        XCTAssertEqual(family.children[1].keys["sona.homework.v1"], original.origins[LegacyOrigin.www.rawValue]?.storage["sona.homework.v1@k4"])
        XCTAssertEqual(family.children[1].keys["sona.lib.read.v1"], #"{"synthetic-book":{"page":4}}"#)
        XCTAssertEqual(family.children[1].keys["sona.trophy.v1"], #"{"t":750,"m":"2026-10","mn":75}"#)
        XCTAssertEqual(family.slotHighWaterMark, 11)
        XCTAssertTrue(document.householdPromises.grandfathered)
        XCTAssertEqual(original, try NativeFixture.archive())
        XCTAssertEqual(document.sourceFingerprints, original.origins.mapValues(\.fingerprint))
    }

    func testOriginCollisionRequiresSelectionAndNeverMergesData() async throws {
        let repository = NativeFamilyRepository(store: NativeMemoryStore())
        let document = try await repository.seed(from: NativeFixture.archive(twoFamilies: true))
        XCTAssertNil(document.primaryOrigin)
        XCTAssertTrue(document.requiresPrimaryOriginSelection)
        XCTAssertEqual(document.origins[LegacyOrigin.www.rawValue]?.children.count, 2)
        XCTAssertEqual(document.origins[LegacyOrigin.app.rawValue]?.children.count, 1)
        do { _ = try await repository.addChild(name: "Synthetic", age: "4", operationID: UUID()); XCTFail("origin must be chosen") }
        catch { XCTAssertEqual(error as? NativeFamilyRepositoryError, .primaryOriginRequired) }
        try await repository.selectOrigin(.app)
        let selected = try await current(repository)
        XCTAssertEqual(selected.activeChild?.keys["sona.progress.v1"], #"{"totals":{"coins":7}}"#)
        XCTAssertEqual(selected.activeChild?.id, .init(origin: .app, slot: ""))
        XCTAssertTrue(selected.householdPromises.grandfathered) // www's promise survives app selection
    }

    func testNewSiblingHasFreshIdentityNoInheritedConsentOrHistoryAndNeverReusesSlot() async throws {
        let repository = NativeFamilyRepository(store: NativeMemoryStore())
        _ = try await repository.seed(from: NativeFixture.archive())
        let operation = UUID()
        let child = try await repository.addChild(name: "Synthetic new sibling", age: "4", operationID: operation)
        XCTAssertEqual(child.slot, "k12")
        let document = try await current(repository), added = try XCTUnwrap(document.activeChild)
        XCTAssertEqual(added.id, child)
        XCTAssertEqual(Set(added.keys.keys), [LegacyKeys.profile])
        let profile = try XCTUnwrap(NativeFamilyOrigin.object(added.profileJSON))
        XCTAssertEqual(profile["earlyAdopter"] as? Bool, true)
        for key in ["reportId", "weeklyReport", "email", "focusSounds", "targetSound"] { XCTAssertNil(profile[key]) }
        let repeated = try await repository.addChild(name: "Synthetic new sibling", age: "4", operationID: operation)
        XCTAssertEqual(repeated, child)
        try await repository.removeChild(child, operationID: UUID())
        let later = try await repository.addChild(name: "Synthetic later sibling", age: "6", operationID: UUID())
        XCTAssertEqual(later.slot, "k13")
    }

    func testNativeWritesRemainWithOriginalChildEvenAfterSwitch() async throws {
        let repository = NativeFamilyRepository(store: NativeMemoryStore())
        _ = try await repository.seed(from: NativeFixture.archive())
        try await repository.switchChild(first)
        try await repository.updateChildKey("sona.gamereps.v1", value: #"{"syntheticAbsoluteCount":31}"#, child: second)
        let document = try await current(repository), family = try XCTUnwrap(document.primaryFamily)
        XCTAssertEqual(document.activeChild?.id, first)
        XCTAssertEqual(family.children[1].keys["sona.gamereps.v1"], #"{"syntheticAbsoluteCount":31}"#)
        XCTAssertEqual(family.children[0].keys["sona.gamereps.v1"], #"{"synthetic":1}"#)
    }

    func testNewSiblingKeepsOnlyPromisedLegacyOwnership() async throws {
        let repository = NativeFamilyRepository(store: NativeMemoryStore())
        _ = try await repository.seed(from: NativeFixture.archive(changes: ["sona.buddyset.v1": "kept"]))
        _ = try await repository.addChild(name: "Synthetic kept sibling", age: "4", operationID: UUID())
        let document = try await current(repository)
        let profile = try XCTUnwrap(NativeFamilyOrigin.object(document.activeChild?.profileJSON))
        XCTAssertEqual(profile["owned"] as? [String: [String]], NativeFamilyOrigin.legacyKeptOwnership)
        XCTAssertNil(profile["reportId"])
        XCTAssertNil(profile["weeklyReport"])
        #if canImport(JavaScriptCore)
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<7 { root.deleteLastPathComponent() }
        let source = try String(contentsOf: root.appendingPathComponent("public/sona.js"), encoding: .utf8)
        let expression = try NSRegularExpression(pattern: "const LEGACY_SET = \\{[\\s\\S]*?\\};")
        let match = try XCTUnwrap(expression.firstMatch(in: source, range: NSRange(source.startIndex..., in: source)))
        let declaration = String(source[try XCTUnwrap(Range(match.range, in: source))])
        let context = try XCTUnwrap(JSContext())
        context.evaluateScript(declaration)
        let expected = try XCTUnwrap(context.evaluateScript("JSON.stringify(LEGACY_SET)")?.toString())
        let inventory = try JSONDecoder().decode([String: [String]].self, from: Data(expected.utf8))
        XCTAssertEqual(NativeFamilyOrigin.legacyKeptOwnership, inventory)
        #endif
    }

    func testRemovingOriginalChildKeepsHouseholdPromisesAndOwedDeletions() async throws {
        let repository = NativeFamilyRepository(store: NativeMemoryStore()), original = try NativeFixture.archive()
        _ = try await repository.seed(from: original)
        let operation = UUID()
        try await repository.removeChild(first, operationID: operation)
        let document = try await current(repository), family = try XCTUnwrap(document.primaryFamily)
        XCTAssertEqual(family.slots, ["k4"])
        XCTAssertNil(family.storage[LegacyKeys.profile])
        XCTAssertTrue(document.householdPromises.grandfathered)
        XCTAssertEqual(document.removalObligations.count, 1)
        XCTAssertEqual(document.removalObligations[0].reportEmail, "synthetic@example.invalid")
        XCTAssertEqual(document.removalObligations[0].boardEntryJSON, #"{"token":"synthetic-board-a"}"#)
        try await repository.removeChild(first, operationID: operation) // lost acknowledgement retry
        let repeated = try await repository.snapshot()
        XCTAssertEqual(repeated?.removalObligations.count, 1)
        try await repository.acknowledgeRemovalObligation(operation)
        let settled = try await repository.snapshot()
        XCTAssertEqual(settled?.removalObligations.count, 0)
    }

    func testRemovingSuffixedChildDropsUnknownChildFieldsButNeverHouseholdKeys() async throws {
        let repository = NativeFamilyRepository(store: NativeMemoryStore())
        _ = try await repository.seed(from: NativeFixture.archive())
        try await repository.removeChild(second, operationID: UUID())
        let document = try await current(repository), family = try XCTUnwrap(document.primaryFamily)
        XCTAssertNil(family.storage["sona.future.v19@k4"])
        XCTAssertEqual(family.storage["sona.sub.v1"], #"{"active":true,"source":"apple"}"#)
        XCTAssertEqual(family.storage["sona.slpticket"], "synthetic-invalid-ticket")
        do { try await repository.removeChild(first, operationID: UUID()); XCTFail("last child") }
        catch { XCTAssertEqual(error as? NativeFamilyRepositoryError, .cannotRemoveLastChild) }
    }

    func testReportDeletionRequiresOriginalStrictBooleanConsent() async throws {
        let archive = try NativeFixture.archive(changes: [LegacyKeys.profile:
            #"{"childName":"Synthetic no report consent","onboarded":true,"email":"synthetic@example.invalid","weeklyReport":1}"#])
        let repository = NativeFamilyRepository(store: NativeMemoryStore())
        _ = try await repository.seed(from: archive)
        try await repository.removeChild(first, operationID: UUID())
        let document = try await current(repository)
        XCTAssertEqual(document.removalObligations.count, 1) // board errand still owed
        XCTAssertNil(document.removalObligations.first?.reportEmail)
    }

    func testReseedingNeverOverwritesNativeEditsOrSelectedChild() async throws {
        let archive = try NativeFixture.archive(), store = NativeMemoryStore()
        let repository = NativeFamilyRepository(store: store)
        _ = try await repository.seed(from: archive)
        try await repository.switchChild(first)
        try await repository.updateChildKey("sona.progress.v1", value: #"{"totals":{"coins":91}}"#, child: first)
        let before = try await repository.snapshot(), commits = store.commits
        let after = try await NativeFamilyRepository(store: store).seed(from: archive)
        XCTAssertEqual(after, before)
        XCTAssertEqual(store.commits, commits)
        let changed = try NativeFixture.archive(changes: ["sona.progress.v1": #"{"totals":{"coins":999}}"#])
        do { _ = try await repository.seed(from: changed); XCTFail("changed source") }
        catch { XCTAssertEqual(error as? NativeFamilyRepositoryError, .sourceChangedAfterSeed) }
        let afterRefusal = try await repository.snapshot()
        XCTAssertEqual(afterRefusal, before)
    }

    func testFailedSeedAndLostAddAcknowledgementAreSafeToRetry() async throws {
        let store = NativeMemoryStore(), repository = NativeFamilyRepository(store: store), archive = try NativeFixture.archive()
        store.failBefore = true
        do { _ = try await repository.seed(from: archive); XCTFail("failed commit") } catch NativeTestFailure.beforeWrite {}
        XCTAssertNil(store.value)
        store.failBefore = false
        _ = try await repository.seed(from: archive)
        store.failAfter = true
        let request = UUID()
        do { _ = try await repository.addChild(name: "Synthetic interrupted", age: "4", operationID: request); XCTFail("lost ack") }
        catch NativeTestFailure.afterWrite {}
        store.failAfter = false
        let commits = store.commits
        let child = try await NativeFamilyRepository(store: store).addChild(name: "Synthetic interrupted", age: "4", operationID: request)
        XCTAssertEqual(child.slot, "k12")
        XCTAssertEqual(store.value?.primaryFamily?.slots.count, 3)
        XCTAssertEqual(store.commits, commits)
        do { _ = try await repository.addChild(name: "Different synthetic request", age: "4", operationID: request); XCTFail("operation conflict") }
        catch { XCTAssertEqual(error as? NativeFamilyRepositoryError, .operationConflict) }
    }

    func testIncompleteOrForgedCaptureCannotSeedNativeUI() async throws {
        let store = NativeMemoryStore(), repository = NativeFamilyRepository(store: store)
        var archive = try NativeFixture.archive()
        archive.origins.removeValue(forKey: LegacyOrigin.app.rawValue)
        do { _ = try await repository.seed(from: archive); XCTFail("incomplete archive") }
        catch { XCTAssertEqual(error as? NativeFamilyRepositoryError, .incompleteMigration) }
        archive = try NativeFixture.archive()
        archive.origins[LegacyOrigin.app.rawValue] = archive.origins[LegacyOrigin.www.rawValue]
        do { _ = try await repository.seed(from: archive); XCTFail("forged projection") }
        catch { XCTAssertEqual(error as? NativeFamilyRepositoryError, .invalidArchive) }
        XCTAssertNil(store.value)
    }

    func testHouseholdAndMalformedKeysCannotBeWrittenThroughChildAPI() async throws {
        let repository = NativeFamilyRepository(store: NativeMemoryStore())
        _ = try await repository.seed(from: NativeFixture.archive())
        for key in ["sona.sub.v1", "sona.founder", "sona.profile.v1@k4", "sona.future.v19"] {
            do { try await repository.updateChildKey(key, value: "1", child: first); XCTFail("wrong child key") }
            catch { XCTAssertEqual(error as? NativeFamilyRepositoryError, .invalidChildKey) }
        }
        do { try await repository.updateChildKey(LegacyKeys.profile, value: "[]", child: first); XCTFail("invalid profile") }
        catch { XCTAssertEqual(error as? NativeFamilyRepositoryError, .invalidProfile) }
    }

    func testLocalNativeStateSurvivesRelaunchAndCorruptReadIsNeverFresh() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("sona-native-synthetic-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = LocalNativeFamilyDocumentStore(directory: directory), repository = NativeFamilyRepository(store: store)
        _ = try await repository.seed(from: NativeFixture.archive())
        try await repository.updateChildKey("sona.lib.read.v1", value: #"{"synthetic-book":{"page":7}}"#, child: second)
        let before = try await repository.snapshot()
        let relaunched = try await NativeFamilyRepository(store: store).snapshot()
        let reseeded = try await NativeFamilyRepository(store: store).seed(from: NativeFixture.archive())
        XCTAssertEqual(relaunched, before)
        XCTAssertEqual(reseeded, before)
        try Data("broken".utf8).write(to: directory.appendingPathComponent("native-family-v1.json"))
        XCTAssertThrowsError(try store.read()) { XCTAssertEqual($0 as? NativeFamilyRepositoryError, .destinationCorrupt) }
    }

    func testReadbackMismatchCannotReturnSuccess() async throws {
        let store = NativeMemoryStore(); store.discard = true
        do { _ = try await NativeFamilyRepository(store: store).seed(from: NativeFixture.archive()); XCTFail("discarded write") }
        catch { XCTAssertEqual(error as? NativeFamilyRepositoryError, .verificationFailed) }
    }
}
