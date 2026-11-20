import XCTest
import JavaScriptCore
import SonaFamilyRules
@testable import SonaFamilyMigration
@testable import SonaFamilyBackup

private final class BackupMemoryStore: NativeFamilyDocumentStore, @unchecked Sendable {
    var value: NativeFamilyDocument?
    var commits = 0
    var failBefore = false
    var failAfter = false
    func read() throws -> NativeFamilyDocument? { value }
    func commit(_ document: NativeFamilyDocument) throws {
        commits += 1
        if failBefore { throw Failure.write }
        value = document
        if failAfter { throw Failure.ack }
    }
    enum Failure: Error { case write, ack }
}

private enum BackupFixture {
    static let stamps = ["sona.freeera.v1":"post", "sona.freeera2.v1":"done", "sona.freeera3.v1":"done",
                         "sona.freeera4.v1":"done", "sona.freeera5.v1":"done", "sona.freever.v1":"post", "sona.buddyset.v1":"post"]
    static func seeded() async throws -> (NativeFamilyRepository, BackupMemoryStore) {
        var archive = MigrationArchive()
        for origin in LegacyOrigin.allCases {
            var storage = stamps
            if origin == .www || origin == .app {
                storage[LegacyKeys.roster] = #"{"active":"k2","hi":2,"list":[{"slot":"","name":"Fictional A"},{"slot":"k2","name":"Fictional B"}]}"#
                storage[LegacyKeys.profile] = #"{"childName":"Fictional A","onboarded":true,"focusSounds":["S"],"targetSound":"S","earlyAdopter":true,"reportId":"aaaaaaaaaaaaaaaa","slpShare":false}"#
                storage[LegacyKeys.profile + "@k2"] = #"{"childName":"Fictional B","onboarded":true,"focusSounds":["R"],"targetSound":"R"}"#
                storage["sona.progress.v1"] = #"{"totals":{"coins":41}}"#
                storage["sona.progress.v1@k2"] = #"{"totals":{"coins":7}}"#
                storage["sona.fid.v1"] = "fictional-device-id"
                storage["sona.founder"] = "1"
                storage["sona.sub.v1"] = #"{"active":true,"source":"apple"}"#
                storage["sona.slpticket"] = "fictional-destination-ticket"
                storage["sona.slp"] = "FICTIONAL"
                storage["sona.slpok"] = "1"
                storage["sona.login"] = "fictional-login"
                storage["sona.pilot.v1"] = #"{"consent":false,"childId":"fictional-native-id"}"#
                storage["sona.report.v1"] = #"{"dev":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","offs":[]}"#
                storage["sona.nativemic"] = "fictional-setting"
                storage["sona.future.v99"] = "future portable progress"
            }
            archive.origins[origin.rawValue] = try SnapshotImporter.prepare(.init(origin: origin, storage: storage))
        }
        let store = BackupMemoryStore(), repository = NativeFamilyRepository(store: store)
        _ = try await repository.seed(from: archive, primaryOrigin: .www)
        try await repository.recordReadingPlace(.init(page: 3, finished: true), bookID: "fictional-book", owner: .init(origin: .www, slot: ""))
        return (repository, store)
    }
    struct Arguments: Encodable { let payload: String }
    static let evaluate = FamilyPortableBackupRules.evaluate
    static func snapshot(_ repository: NativeFamilyRepository) async throws -> NativeFamilyDocument {
        let value = try await repository.snapshot(); return try XCTUnwrap(value)
    }
    static func canonicalSharing(_ storage: [String: String]) throws -> Bool {
        let modules = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let directory = modules.appendingPathComponent("SonaFamilyRules/Sources/SonaFamilyRules/Rules")
        let js = try XCTUnwrap(JSContext()); var failed = false
        js.exceptionHandler = { _, _ in failed = true }; defer { js.exceptionHandler = nil }
        js.evaluateScript(try String(contentsOf: directory.appendingPathComponent("host.js")))
        let env = String(decoding: try JSONSerialization.data(withJSONObject: ["storage":storage,"canSell":false]), as: UTF8.self)
        js.objectForKeyedSubscript("nativeInstall").call(withArguments: [env])
        js.evaluateScript(try String(contentsOf: directory.appendingPathComponent("sona.js")))
        let result = js.evaluateScript("Sona.slpSharing()")
        guard !failed, let result, result.isBoolean else { throw NativeFamilyBackupError.invalidRuleResult }
        return result.toBool()
    }
    static func file(_ data: [String: String], children: [String: NativeFamilyPortableBackup.Child]? = nil) throws -> Data {
        try NativeFamilyPortableBackup(data: data, native: children.map { .init(children: $0) }).encoded()
    }
}

final class FamilyMovingPhonesTests: XCTestCase {
    func testExportContainsOnlyPortableProgressAndExplicitNativeMetadata() async throws {
        let (repository, _) = try await BackupFixture.seeded()
        let backup = try await repository.portableBackup(origin: .www)
        let bytes = try backup.encoded(), text = String(decoding: bytes, as: UTF8.self)
        XCTAssertNil(backup.data["sona.sub.v1"])
        for forbidden in ["fictional-device-id", "fictional-destination-ticket", "fictional-login", "fictional-native-id", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "sourceFingerprint", "householdPromises", "appleAccess", "earlyAdopter", "sona.buddyset.v1"] {
            XCTAssertFalse(text.contains(forbidden), forbidden)
        }
        XCTAssertEqual(backup.data["sona.future.v99"], "future portable progress")
        XCTAssertEqual(backup.native?.version, 1)
        XCTAssertEqual(backup.native?.ownership, "explicit")
        XCTAssertEqual(backup.native?.children[""]?.books["fictional-book"]?.page, 3)
        XCTAssertEqual(try NativeFamilyPortableBackup.decode(bytes), backup)
    }

    func testUnknownSuffixOwnedOrphansNeverLeaveButCurrentPlayerFutureKeysDo() async throws {
        let (repository, store) = try await BackupFixture.seeded()
        try await repository.change { document in
            var family = document.origins[LegacyOrigin.www.rawValue]!
            family.storage["sona.future.v99@k9"] = "Fictional removed child detail"
            family.storage["sona.future.v99@k2"] = "Fictional current child detail"
            family.slotHighWaterMark = max(family.slotHighWaterMark, 9)
            document.origins[LegacyOrigin.www.rawValue] = family
        }
        let before = store.value
        let exported = try await repository.portableBackup(origin: .www)
        XCTAssertNil(exported.data["sona.future.v99@k9"])
        XCTAssertEqual(exported.data["sona.future.v99@k2"], "Fictional current child detail")
        XCTAssertEqual(store.value, before) // protected local state is untouched
        XCTAssertEqual(store.value!.primaryFamily!.storage["sona.future.v99@k9"], "Fictional removed child detail")
    }

    func testSourceWebExportHasNonportableFieldsButNativeExportDoesNot() async throws {
        let (repository, _) = try await BackupFixture.seeded()
        let original = try await BackupFixture.snapshot(repository)
        let source = try NativeFamilyRules.evaluate(.backupExport, input: [String:String](), storage: original.primaryFamily!.storage)
        let raw = try NativeFamilyPortableBackup.decode(source.value)
        XCTAssertEqual(raw.data["sona.fid.v1"], "fictional-device-id") // actual legacy source seam
        XCTAssertEqual(raw.data["sona.founder"], "1")
        let portable = try await repository.portableBackup(origin: .www)
        XCTAssertNil(portable.data["sona.fid.v1"])
        XCTAssertNil(portable.data["sona.founder"])
    }

    func testOldPastedFieldsCannotGrantAccessOrChangeDestinationSharingOrIdentity() async throws {
        let (repository, _) = try await BackupFixture.seeded()
        let before = try await BackupFixture.snapshot(repository)
        let input = try BackupFixture.file([
            LegacyKeys.profile: #"{"childName":"Fictional A","onboarded":true,"earlyAdopter":true,"freeEra5":true,"slpShare":true,"slpCode":"FORGED","reportId":"forged"}"#,
            "sona.progress.v1": #"{"totals":{"coins":99}}"#,
            "sona.sub.v1": #"{"active":false}"#, "sona.founder":"0", "sona.pilot.v1":#"{"consent":true,"childId":"forged"}"#,
            "sona.slpticket":"forged", "sona.slp":"FORGED", "sona.slpok":"forged", "sona.login":"forged", "sona.fid.v1":"forged", "sona.caseplan.v1":"forged"
        ])
        _ = try await repository.restorePortableBackup(input, origin: .www, operationID: UUID(), evaluate: BackupFixture.evaluate)
        let after = try await BackupFixture.snapshot(repository)
        for key in ["sona.sub.v1", "sona.founder", "sona.pilot.v1", "sona.slpticket", "sona.slp", "sona.slpok", "sona.login", "sona.fid.v1", "sona.caseplan.v1"] {
            XCTAssertEqual(after.primaryFamily?.storage[key], before.primaryFamily?.storage[key], key)
        }
        let profile = NativeFamilyOrigin.object(after.primaryFamily?.storage[LegacyKeys.profile])!
        XCTAssertEqual(profile["earlyAdopter"] as? Bool, true)
        XCTAssertNil(profile["freeEra5"])
        XCTAssertEqual(profile["slpShare"] as? Bool, false)
        XCTAssertNil(profile["slpCode"])
        XCTAssertEqual(profile["reportId"] as? String, "aaaaaaaaaaaaaaaa")
        XCTAssertEqual(after.sourceFingerprints, before.sourceFingerprints)
        XCTAssertEqual(after.householdPromises, before.householdPromises)
        XCTAssertEqual(after.appleAccess, before.appleAccess)
        XCTAssertEqual(after.origins[LegacyOrigin.app.rawValue], before.origins[LegacyOrigin.app.rawValue])
        XCTAssertEqual(after.primaryFamily?.storage["sona.progress.v1"], #"{"totals":{"coins":99}}"#)
    }

    func testRealSourceRestoreMergesAndUndoRemovesAddedChildrenWithNativeState() async throws {
        let (repository, _) = try await BackupFixture.seeded()
        let before = try await BackupFixture.snapshot(repository)
        let payload = try BackupFixture.file([
            LegacyKeys.roster: #"{"active":"k6","hi":6,"list":[{"slot":"","name":"Fictional A"},{"slot":"k2","name":"Fictional B"},{"slot":"k6","name":"Fictional C"}]}"#,
            LegacyKeys.profile: #"{"childName":"Fictional A","onboarded":true}"#,
            LegacyKeys.profile + "@k6": #"{"childName":"Fictional C","onboarded":true}"#,
            "sona.progress.v1@k6": #"{"totals":{"coins":12}}"#
        ], children: ["k6": .init(books: ["new-book": .init(page: 2, finished: false)], games: ["slice"])])
        _ = try await repository.restorePortableBackup(payload, origin: .www, operationID: UUID(), evaluate: BackupFixture.evaluate)
        let restored = try await BackupFixture.snapshot(repository)
        XCTAssertEqual(restored.primaryFamily?.slots, ["", "k2", "k6"])
        XCTAssertEqual(restored.primaryFamily?.storage["sona.progress.v1@k2"], before.primaryFamily?.storage["sona.progress.v1@k2"])
        XCTAssertTrue(restored.bookmarks(for: .init(origin: .www, slot: "")).isEmpty)
        XCTAssertEqual(restored.completedGames(for: .init(origin: .www, slot: "k6")), ["slice"])
        let undoID = UUID()
        _ = try await repository.undoPortableBackup(origin: .www, operationID: undoID, evaluate: BackupFixture.evaluate)
        let undone = try await BackupFixture.snapshot(repository)
        XCTAssertEqual(undone.primaryFamily?.slots, before.primaryFamily?.slots)
        XCTAssertNil(undone.primaryFamily?.storage["sona.progress.v1@k6"])
        XCTAssertEqual(undone.primaryFamily?.slotHighWaterMark, 6)
        XCTAssertEqual(undone.bookmarks(for: .init(origin: .www, slot: "")), before.bookmarks(for: .init(origin: .www, slot: "")))
        XCTAssertTrue(undone.completedGames(for: .init(origin: .www, slot: "k6")).isEmpty)
        let secondUndo = try await repository.undoPortableBackup(origin: .www, operationID: undoID, evaluate: { _,_,_ in XCTFail("duplicate Undo evaluated"); throw NativeFamilyBackupError.invalidRuleResult })
        XCTAssertGreaterThan(secondUndo.removed, 0)
        let canUndo = try await repository.canUndoPortableBackup(origin: .www)
        XCTAssertFalse(canUndo)
    }

    func testAtomicFailureAndLostAcknowledgementRetryAreIdempotent() async throws {
        let (repository, store) = try await BackupFixture.seeded()
        let before = try await BackupFixture.snapshot(repository)
        let payload = try BackupFixture.file(["sona.progress.v1": #"{"totals":{"coins":91}}"#])
        let id = UUID(); store.failBefore = true
        do { _ = try await repository.restorePortableBackup(payload, origin: .www, operationID: id, evaluate: BackupFixture.evaluate); XCTFail("write failure") } catch {}
        XCTAssertEqual(store.value, before)
        store.failBefore = false; store.failAfter = true
        do { _ = try await repository.restorePortableBackup(payload, origin: .www, operationID: id, evaluate: BackupFixture.evaluate); XCTFail("ack failure") } catch {}
        let committed = store.value; store.failAfter = false
        _ = try await repository.restorePortableBackup(payload, origin: .www, operationID: id, evaluate: { _,_,_ in XCTFail("duplicate evaluated"); throw NativeFamilyBackupError.invalidRuleResult })
        XCTAssertEqual(store.value, committed)
        _ = try await repository.restorePortableBackup(BackupFixture.file(["sona.progress.v1":"{}"]), origin: .www, operationID: UUID(), evaluate: BackupFixture.evaluate)
        let newer = store.value
        _ = try await repository.restorePortableBackup(payload, origin: .www, operationID: id, evaluate: { _,_,_ in XCTFail("old duplicate evaluated"); throw NativeFamilyBackupError.invalidRuleResult })
        XCTAssertEqual(store.value, newer)
    }

    func testMalformedAndPrivateCaptureFormatsAreRejectedWithoutWrites() async throws {
        let (repository, store) = try await BackupFixture.seeded(); let before = store.value
        for text in ["{}", "[]", #"{"schema":1,"origin":"https://www.speaksona.com","storage":{}}"#, #"{"app":"sona","v":1,"data":{"sona.profile.v1":"no"}}"#, #"{"app":"sona","v":2,"data":{}}"#, #"{"app":"sona","v":1,"data":{},"recordings":[]}"#, #"{"app":"sona","v":1,"data":{"sona.progress.v1":4}}"#, #"{"app":"sona","v":1,"data":{},"native":{"version":99,"children":{}}}"#] {
            do { _ = try await repository.restorePortableBackup(Data(text.utf8), origin: .www, operationID: UUID(), evaluate: BackupFixture.evaluate); XCTFail(text) } catch {}
            XCTAssertEqual(store.value, before)
        }
        do { _ = try await repository.restorePortableBackup(BackupFixture.file(["sona.progress.v1":"{}"]), origin: .app, operationID: UUID(), evaluate: BackupFixture.evaluate); XCTFail("wrong origin") } catch {}
        XCTAssertEqual(store.value, before)
    }

    func testDeletionRedactsUndoAndCannotResurrectPersonalData() async throws {
        let (repository, store) = try await BackupFixture.seeded()
        _ = try await repository.restorePortableBackup(BackupFixture.file(["sona.progress.v1":"{}"]), origin: .www, operationID: UUID(), evaluate: BackupFixture.evaluate)
        let child = NativeFamilyChildID(origin: .www, slot: "")
        // Same atomic hook used by the host's explicit deletion transaction.
        try await repository.change { document in try NativeFamilyRepository.redactBackupUndo(for: child, from: &document) }
        try await repository.removeChild(child, operationID: UUID())
        let privateJSON = String(decoding: try JSONEncoder().encode(store.value!.backupJournal), as: UTF8.self)
        XCTAssertFalse(privateJSON.contains("Fictional A"))
        XCTAssertFalse(privateJSON.contains("fictional-book"))
        _ = try await repository.undoPortableBackup(origin: .www, operationID: UUID(), evaluate: BackupFixture.evaluate)
        let after = try await BackupFixture.snapshot(repository)
        XCTAssertEqual(after.primaryFamily?.slots, ["k2"])
        XCTAssertNil(after.primaryFamily?.storage[LegacyKeys.profile])
        XCTAssertTrue(after.bookmarks(for: child).isEmpty)
    }

    func testPastedWeeklyConsentCannotOptInAndUndoCannotResurrectOptIn() async throws {
        let (repository, store) = try await BackupFixture.seeded()
        let child = NativeFamilyChildID(origin: .www, slot: "")
        let initial = #"{"childName":"Fictional A","onboarded":true,"weeklyReport":false,"email":"current@example.invalid","reportId":"aaaaaaaaaaaaaaaa"}"#
        try await repository.updateChildKey(LegacyKeys.profile, value: initial, child: child)
        let payload = try BackupFixture.file([LegacyKeys.profile: #"{"childName":"Fictional A","onboarded":true,"weeklyReport":true,"email":"other@example.invalid","reportId":"forged"}"#])
        _ = try await repository.restorePortableBackup(payload, origin: .www, operationID: UUID(), evaluate: BackupFixture.evaluate)
        let current = NativeFamilyOrigin.object(store.value!.primaryFamily!.storage[LegacyKeys.profile])!
        XCTAssertEqual(current["weeklyReport"] as? Bool, false)
        XCTAssertEqual(current["email"] as? String, "current@example.invalid")
        XCTAssertEqual(current["reportId"] as? String, "aaaaaaaaaaaaaaaa")
        let bytes = try await repository.portableBackup(origin: .www).encoded()
        XCTAssertFalse(String(decoding: bytes, as: UTF8.self).contains("weeklyReport"))
        // A later local opt-in, followed by restore and then explicit Off. Undo
        // must hold Off rather than replay the older opt-in safety snapshot.
        try await repository.updateChildKey(LegacyKeys.profile, value: #"{"childName":"Fictional A","onboarded":true,"weeklyReport":true,"email":"current@example.invalid","reportId":"aaaaaaaaaaaaaaaa"}"#, child: child)
        _ = try await repository.restorePortableBackup(BackupFixture.file(["sona.progress.v1":"{}"]), origin: .www, operationID: UUID(), evaluate: BackupFixture.evaluate)
        try await repository.updateChildKey(LegacyKeys.profile, value: initial, child: child)
        _ = try await repository.undoPortableBackup(origin: .www, operationID: UUID(), evaluate: BackupFixture.evaluate)
        let final = NativeFamilyOrigin.object(store.value!.primaryFamily!.storage[LegacyKeys.profile])!
        XCTAssertEqual(final["weeklyReport"] as? Bool, false)
        XCTAssertEqual(final["email"] as? String, "current@example.invalid")
    }

    func testReplacingReportOwnerQueuesOffAndKeepsExistingOffs() async throws {
        let (repository, store) = try await BackupFixture.seeded()
        try await repository.updateChildKey(LegacyKeys.profile, value: #"{"childName":"Fictional A","onboarded":true,"weeklyReport":true,"email":"old@example.invalid","reportId":"aaaaaaaaaaaaaaaa"}"#, child: .init(origin: .www, slot: ""))
        try await repository.change { document in
            var family = document.origins[LegacyOrigin.www.rawValue]!
            family.storage["sona.report.v1"] = #"{"dev":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","offs":[{"e":"already@example.invalid","d":"cccccccccccccccccccccccccccccccc","t":1}]}"#
            document.origins[LegacyOrigin.www.rawValue] = family
            document.weeklyReportJournal = [LegacyOrigin.www.rawValue: .init(queuedRemovals: [UUID(uuidString: "00000000-0000-0000-0000-000000000001")!])]
        }
        let journal = store.value!.weeklyReportJournal
        let payload = try BackupFixture.file([LegacyKeys.profile: #"{"childName":"Different child","onboarded":true,"weeklyReport":true,"email":"new@example.invalid","reportId":"forged"}"#])
        _ = try await repository.restorePortableBackup(payload, origin: .www, operationID: UUID(), evaluate: BackupFixture.evaluate)
        let family = store.value!.primaryFamily!
        let profile = NativeFamilyOrigin.object(family.storage[LegacyKeys.profile])!
        XCTAssertNotEqual(profile["weeklyReport"] as? Bool, true)
        XCTAssertNil(profile["reportId"])
        let state = NativeFamilyOrigin.object(family.storage["sona.report.v1"])!
        let offs = state["offs"] as? [[String: Any]] ?? []
        XCTAssertTrue(offs.contains { $0["e"] as? String == "old@example.invalid" })
        XCTAssertTrue(offs.contains { $0["e"] as? String == "already@example.invalid" })
        XCTAssertEqual(store.value!.weeklyReportJournal, journal)
        XCTAssertEqual(state["dev"] as? String, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
    }

    func testAppleVerificationTimestampNeverTravelsOrChangesByRestoreAndUndo() async throws {
        let (repository, store) = try await BackupFixture.seeded()
        try await repository.change { document in
            var family = document.origins[LegacyOrigin.www.rawValue]!
            family.storage["sona.iapcheck.v1"] = "destination-verification"
            document.origins[LegacyOrigin.www.rawValue] = family
        }
        let exported = try await repository.portableBackup(origin: .www)
        XCTAssertNil(exported.data["sona.iapcheck.v1"])
        let payload = try BackupFixture.file(["sona.progress.v1":"{}", "sona.iapcheck.v1":"9999999999999999"])
        _ = try await repository.restorePortableBackup(payload, origin: .www, operationID: UUID(), evaluate: BackupFixture.evaluate)
        XCTAssertEqual(store.value!.primaryFamily!.storage["sona.iapcheck.v1"], "destination-verification")
        try await repository.change { document in
            var family = document.origins[LegacyOrigin.www.rawValue]!
            family.storage["sona.iapcheck.v1"] = "newer-destination-verification"
            document.origins[LegacyOrigin.www.rawValue] = family
        }
        _ = try await repository.undoPortableBackup(origin: .www, operationID: UUID(), evaluate: BackupFixture.evaluate)
        XCTAssertEqual(store.value!.primaryFamily!.storage["sona.iapcheck.v1"], "newer-destination-verification")
    }

    func testValidatedReportPseudonymTravelsWithChildWithoutConsent() async throws {
        let (repository, store) = try await BackupFixture.seeded()
        let exported = try await repository.portableBackup(origin: .www)
        XCTAssertEqual(NativeFamilyOrigin.object(exported.data[LegacyKeys.profile])?["reportId"] as? String, "aaaaaaaaaaaaaaaa")
        let payload = try BackupFixture.file([LegacyKeys.profile: #"{"childName":"Different child","onboarded":true,"weeklyReport":true,"reportId":"dddddddddddddddd"}"#])
        _ = try await repository.restorePortableBackup(payload, origin: .www, operationID: UUID(), evaluate: BackupFixture.evaluate)
        let profile = NativeFamilyOrigin.object(store.value!.primaryFamily!.storage[LegacyKeys.profile])!
        XCTAssertEqual(profile["reportId"] as? String, "dddddddddddddddd")
        XCTAssertNotEqual(profile["weeklyReport"] as? Bool, true)
        XCTAssertEqual(store.value!.primaryFamily!.storage["sona.report.v1"], #"{"dev":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","offs":[]}"#)
    }

    func testWithdrawnAndFoundingPilotDoNotBlockProgressRestoreOrLoseAccess() async throws {
        for (code, sharing) in [("FICTIONAL", false), ("ff-fictional", true)] {
            let (repository, store) = try await BackupFixture.seeded()
            let child = NativeFamilyChildID(origin: .www, slot: "")
            try await repository.updateChildKey("sona.pilot.v1", value: "{\"consent\":true,\"childId\":\"verified-destination\",\"code\":\"" + code + "\"}", child: child)
            try await repository.updateChildKey(LegacyKeys.profile, value: "{\"childName\":\"Fictional A\",\"slpShare\":" + String(sharing) + "}", child: child)
            let before = store.value!
            _ = try await repository.restorePortableBackup(BackupFixture.file([LegacyKeys.profile: #"{"childName":"Different child"}"#]), origin: .www, operationID: UUID(), evaluate: BackupFixture.evaluate)
            XCTAssertEqual(NativeFamilyOrigin.object(store.value!.primaryFamily!.storage[LegacyKeys.profile])?["childName"] as? String, "Different child")
            XCTAssertEqual(store.value!.primaryFamily!.storage["sona.pilot.v1"], before.primaryFamily!.storage["sona.pilot.v1"])
            XCTAssertEqual(store.value!.householdPromises, before.householdPromises)
            XCTAssertEqual(store.value!.primaryFamily!.storage["sona.sub.v1"], before.primaryFamily!.storage["sona.sub.v1"])
            if !sharing { XCTAssertEqual(NativeFamilyOrigin.object(store.value!.primaryFamily!.storage[LegacyKeys.profile])?["slpShare"] as? Bool, false) }
            var probe = store.value!.primaryFamily!.storage
            probe[LegacyKeys.roster] = #"{"active":"","hi":2,"list":[{"slot":"","name":"Different child"},{"slot":"k2","name":"Fictional B"}]}"#
            XCTAssertFalse(try BackupFixture.canonicalSharing(probe))
            _ = try await repository.undoPortableBackup(origin: .www, operationID: UUID(), evaluate: BackupFixture.evaluate)
            if !sharing { XCTAssertEqual(NativeFamilyOrigin.object(store.value!.primaryFamily!.storage[LegacyKeys.profile])?["slpShare"] as? Bool, false) }
            probe = store.value!.primaryFamily!.storage
            probe[LegacyKeys.roster] = #"{"active":"","hi":2,"list":[{"slot":"","name":"Fictional A"},{"slot":"k2","name":"Fictional B"}]}"#
            XCTAssertFalse(try BackupFixture.canonicalSharing(probe))
            XCTAssertEqual(store.value!.primaryFamily!.storage["sona.pilot.v1"], before.primaryFamily!.storage["sona.pilot.v1"])
            XCTAssertEqual(store.value!.primaryFamily!.storage["sona.slpticket"], before.primaryFamily!.storage["sona.slpticket"])
        }
    }

    func testConsentedDestinationChildCannotBeReboundByBackup() async throws {
        let (repository, store) = try await BackupFixture.seeded()
        try await repository.updateChildKey(LegacyKeys.profile, value: #"{"childName":"Fictional A","slpShare":true}"#, child: .init(origin: .www, slot: ""))
        try await repository.updateChildKey("sona.pilot.v1", value: #"{"consent":true,"childId":"verified-destination","code":"FICTIONAL"}"#, child: .init(origin: .www, slot: ""))
        let before = store.value
        do {
            _ = try await repository.restorePortableBackup(BackupFixture.file([LegacyKeys.profile: #"{"childName":"Different child"}"#]), origin: .www, operationID: UUID(), evaluate: BackupFixture.evaluate)
            XCTFail("sharing binding changed")
        } catch { XCTAssertEqual(error as? NativeFamilyBackupError, .sharingChildChanged) }
        XCTAssertEqual(store.value, before)
    }
}
