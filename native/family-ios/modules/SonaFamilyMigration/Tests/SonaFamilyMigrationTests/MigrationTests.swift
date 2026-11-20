import Foundation
import XCTest
#if os(macOS)
import Darwin
#endif
@testable import SonaFamilyMigration

// Every name, address, token, byte and count in this file is synthetic.
private enum Synthetic {
    static func snapshot(_ origin: LegacyOrigin = .www, extra: [String: String] = [:]) -> LegacySnapshot {
        var storage: [String: String] = [
            LegacyKeys.roster: #"{"active":"k4","hi":9,"list":[{"slot":"","name":"Sample A"},{"slot":"k4","name":"Sample B"}]}"#,
            LegacyKeys.profile: #"{"childName":"Sample A","onboarded":true,"focusSounds":["R","S"],"targetSound":"S","dailyGoal":30,"weeklyGoal":4,"volume":0,"earlyAdopter":true,"freeEra3":true,"owned":{"buddies":["dragon"],"hats":["sun"]},"email":"synthetic@example.invalid","weeklyReport":true}"#,
            LegacyKeys.profile + "@k4": #"{"childName":"Sample B","onboarded":true,"focusSounds":["K"],"dailyGoal":18,"childAge":"4"}"#,
            "sona.progress.v1": #"{"coins":143,"practiceDays":["2026-10-03"]}"#,
            "sona.progress.v1@k4": #"{"coins":23,"practiceDays":["2026-10-05"]}"#,
            "sona.homework.v1@k4": #"{"sound":"K","position":"f","words":["book"],"goal":10,"until":"2026-12-01"}"#,
            "sona.pilot.v1": #"{"consent":true,"code":"ff-synthetic","childId":"synthetic-a"}"#,
            "sona.pilot.v1@k4": #"{"consent":false,"code":"synthetic-clinic","childId":"synthetic-b"}"#,
            "sona.freeera.v1": "grandfathered", "sona.freeera2.v1": "done",
            "sona.freeera3.v1": "done", "sona.freeera4.v1": "done", "sona.freeera5.v1": "done",
            "sona.freever.v1": "kept", "sona.buddyset.v1": "kept",
            "sona.founder": "1", "sona.founding.v1": #"{"code":"ff-synthetic"}"#,
            "sona.sub.v1": #"{"active":true,"source":"apple","checked":1700000000000}"#,
            "sona.slp": "SYNTHETIC", "sona.slpok": "SYNTHETIC", "sona.slpunlock": "1",
            "sona.slpticket": "synthetic-ticket-never-valid", "sona.caseplan.v1": #"{"active":true,"code":"SYNTHETIC"}"#,
            "sona.trial.v1": #"{"start":1700000000000,"days":3}"#,
            "sona.report.v1": #"{"dev":"synthetic-report-device","offs":[{"email":"synthetic@example.invalid"}]}"#,
            "sona.notify.v1": #"{"nudge":1,"arm":1700000000000,"nudges":["sona-nudge-synthetic"]}"#,
            "sona.boardleave.v1": #"{"owed":["synthetic-deletion"]}"#,
            "sona.board.v1@k4": #"{"token":"synthetic-board-token"}"#,
            "sona.freeplay.v1": "spent", "sona.offerseen.v1": "yes", "sona.planmoment.v1": "1",
            "sona.setupasks.v1": #"{"therapy":"t_no"}"#,
            "sona.future.v19@k4": "unknown value preserved exactly"
        ]
        // Populate every present per-child family field with distinct data.
        for key in LegacyKeys.perChild where storage[key] == nil { storage[key] = #"{"synthetic":1}"# }
        for key in LegacyKeys.perChild where storage[key + "@k4"] == nil {
            storage[key + "@k4"] = #"{"synthetic":4}"#
        }
        storage["sona.quest.v1"] = #"{"f":[0,3],"t1":"robo","a":"2026-10-01","sv":"2026-10-01","got":["shell"]}"#
        storage["sona.trophy.v1"] = #"{"v":1,"t":750,"d":"2026-10-01","dn":30,"m":"2026-10","mn":300}"#
        storage["sona.road.v1"] = #"{"open":[1,2,3,10]}"#
        storage["sona.lib.read.v1@k4"] = #"{"Kiki":true}"#
        storage.merge(extra) { _, new in new }
        return LegacySnapshot(origin: origin, storage: storage)
    }
}

private enum TestFailure: Error { case writeFailed, lostAcknowledgement }
private final class MemoryStore: MigrationArchiveStore, @unchecked Sendable {
    // Access serialized by one engine; direct fixture writes only outside calls.
    var value: MigrationArchive?
    var failBeforeWrite = false, failAfterWrite = false, discardWrite = false
    var commits = 0
    func read() throws -> MigrationArchive? { value }
    func commit(_ archive: MigrationArchive) throws {
        commits += 1
        if failBeforeWrite { throw TestFailure.writeFailed }
        if !discardWrite { value = archive }
        if failAfterWrite { throw TestFailure.lostAcknowledgement }
    }
}

final class MigrationTests: XCTestCase {
    func testEveryChildFieldAndHouseholdPromiseSurvivesVerbatim() async throws {
        let fixture = Synthetic.snapshot(), engine = MigrationEngine(store: MemoryStore())
        let result = try await engine.ingest([fixture])
        let archive = try await engine.archive(), imported = try XCTUnwrap(archive.origins[LegacyOrigin.www.rawValue])
        XCTAssertEqual(imported.storage, fixture.storage)
        XCTAssertEqual(imported.children.map(\.slot), ["", "k4"])
        XCTAssertEqual(imported.activeSlot, "k4")
        XCTAssertEqual(imported.slotHighWaterMark, 9)
        XCTAssertEqual(Set(imported.children[0].keys.keys), LegacyKeys.perChild)
        XCTAssertEqual(Set(imported.children[1].keys.keys), LegacyKeys.perChild)
        XCTAssertEqual(imported.children[1].keys["sona.homework.v1"], fixture.storage["sona.homework.v1@k4"])
        XCTAssertEqual(result.imported, [.www])
        XCTAssertFalse(result.capturedAllKnownOrigins)
    }

    func testRepeatedImportAfterRelaunchDoesNotReplayCounters() async throws {
        let store = MemoryStore(), fixture = Synthetic.snapshot()
        _ = try await MigrationEngine(store: store).ingest([fixture])
        let first = store.value
        let repeated = try await MigrationEngine(store: store).ingest([fixture])
        XCTAssertEqual(first, store.value)
        XCTAssertEqual(store.commits, 1)
        XCTAssertEqual(repeated.alreadyImported, [.www])
        XCTAssertTrue(repeated.imported.isEmpty)
    }

    func testConcurrentRetriesUseOneCommit() async throws {
        let store = MemoryStore(), engine = MigrationEngine(store: store), fixture = Synthetic.snapshot()
        async let first = engine.ingest([fixture])
        async let second = engine.ingest([fixture])
        let receipts = try await [first, second]
        XCTAssertEqual(receipts.reduce(0) { $0 + $1.imported.count }, 1)
        XCTAssertEqual(store.commits, 1)
    }

    func testWriteFailureLeavesNothingMarkedAndRetrySucceeds() async throws {
        let store = MemoryStore(), fixture = Synthetic.snapshot(), engine = MigrationEngine(store: store)
        store.failBeforeWrite = true
        do { _ = try await engine.ingest([fixture]); XCTFail("write should fail") } catch TestFailure.writeFailed {}
        XCTAssertNil(store.value)
        store.failBeforeWrite = false
        let receipt = try await engine.ingest([fixture])
        XCTAssertEqual(receipt.imported, [.www])
        XCTAssertEqual(store.value?.origins[LegacyOrigin.www.rawValue]?.storage, fixture.storage)
    }

    func testLostAcknowledgementAfterAtomicCommitIsSafeToRetry() async throws {
        let store = MemoryStore(), engine = MigrationEngine(store: store)
        store.failAfterWrite = true
        do { _ = try await engine.ingest([Synthetic.snapshot()]); XCTFail("ack should fail") }
        catch TestFailure.lostAcknowledgement {}
        let saved = store.value
        store.failAfterWrite = false
        let result = try await engine.ingest([Synthetic.snapshot()])
        XCTAssertEqual(result.alreadyImported, [.www])
        XCTAssertEqual(store.value, saved)
        XCTAssertEqual(store.commits, 1)
    }

    func testReadbackMustAgreeBeforeReturningSuccess() async throws {
        let store = MemoryStore(); store.discardWrite = true
        do { _ = try await MigrationEngine(store: store).ingest([Synthetic.snapshot()]); XCTFail("discarded write") }
        catch { XCTAssertEqual(error as? MigrationError, .verificationFailed) }
    }

    func testBadSecondOriginDoesNotPartiallyCommitBatch() async throws {
        let store = MemoryStore(), bad = Synthetic.snapshot(.app, extra: [LegacyKeys.roster: "bad"])
        do { _ = try await MigrationEngine(store: store).ingest([Synthetic.snapshot(), bad]); XCTFail("bad roster") }
        catch { XCTAssertEqual(error as? MigrationError, .malformedRoster) }
        XCTAssertNil(store.value)
        XCTAssertEqual(store.commits, 0)
    }

    func testOriginsNeverMergeChildrenOrSumEconomies() async throws {
        let store = MemoryStore(), engine = MigrationEngine(store: store)
        let app = Synthetic.snapshot(.app, extra: ["sona.progress.v1": #"{"coins":7}"#])
        _ = try await engine.ingest([Synthetic.snapshot(.www), app])
        let archive = try await engine.archive()
        XCTAssertEqual(archive.origins.count, 2)
        XCTAssertEqual(archive.origins[LegacyOrigin.www.rawValue]?.children.count, 2)
        XCTAssertEqual(archive.origins[LegacyOrigin.app.rawValue]?.children.count, 2)
        XCTAssertEqual(archive.origins[LegacyOrigin.app.rawValue]?.children[0].keys["sona.progress.v1"], #"{"coins":7}"#)
        XCTAssertEqual(archive.origins[LegacyOrigin.www.rawValue]?.children[0].keys["sona.progress.v1"], Synthetic.snapshot().storage["sona.progress.v1"])
    }

    func testAllOriginsNeedRealCapturesIncludingEmptyOnes() async throws {
        let engine = MigrationEngine(store: MemoryStore())
        _ = try await engine.ingest([Synthetic.snapshot()])
        let receipt = try await engine.ingest(LegacyOrigin.allCases.filter { $0 != .www }.map {
            LegacySnapshot(origin: $0, storage: [:])
        })
        XCTAssertTrue(receipt.capturedAllKnownOrigins)
        XCTAssertEqual(receipt.checkedOrigins, Set(LegacyOrigin.allCases))
    }

    func testChangedSourceNeverOverwritesPreviouslyImportedProgress() async throws {
        let store = MemoryStore(), engine = MigrationEngine(store: store)
        _ = try await engine.ingest([Synthetic.snapshot()])
        let original = store.value
        do { _ = try await engine.ingest([Synthetic.snapshot(extra: ["sona.progress.v1": #"{"coins":999}"#])]); XCTFail("source changed") }
        catch { XCTAssertEqual(error as? MigrationError, .sourceChangedAfterImport) }
        XCTAssertEqual(store.value, original)
    }

    func testNoRosterLegacyFirstChildAndMissingSweepStampsArePreserved() async throws {
        let engine = MigrationEngine(store: MemoryStore())
        let original = [LegacyKeys.profile: #"{"childName":"Synthetic pre-pricing child"}"#]
        _ = try await engine.ingest([LegacySnapshot(origin: .bare, storage: original)])
        let archive = try await engine.archive(), origin = try XCTUnwrap(archive.origins[LegacyOrigin.bare.rawValue])
        XCTAssertEqual(origin.children.map(\.slot), [""])
        XCTAssertEqual(origin.storage, original) // no invented free-era or buddy sweeps
    }

    func testRemovedFirstChildIsNotResurrectedAndSlotsAreNeverReused() async throws {
        let fixture = Synthetic.snapshot(extra: [
            LegacyKeys.roster: #"{"active":"k4","hi":9,"list":[{"slot":"k4"}]}"#,
            "sona.profile.v1@k12": #"{"childName":"Removed synthetic child"}"#
        ])
        let engine = MigrationEngine(store: MemoryStore()); _ = try await engine.ingest([fixture])
        let archive = try await engine.archive(), origin = try XCTUnwrap(archive.origins[LegacyOrigin.www.rawValue])
        XCTAssertEqual(origin.children.map(\.slot), ["k4"])
        XCTAssertEqual(origin.slotHighWaterMark, 12)
        XCTAssertTrue(origin.hasOrphanedChildData)
        XCTAssertEqual(origin.storage[LegacyKeys.profile], fixture.storage[LegacyKeys.profile])
    }

    func testInvalidRosterIsHeldWithoutGuessingChildOwnership() throws {
        let badRosters = [
            #"{"active":"","list":[{"slot":""},{"slot":""}]}"#,
            #"{"active":"k2","list":[{"slot":""}]}"#,
            #"{"active":"k1","list":[{"slot":"k1"}]}"#,
            #"{"active":"","list":[]}"#
        ]
        for raw in badRosters {
            XCTAssertThrowsError(try SnapshotImporter.prepare(Synthetic.snapshot(extra: [LegacyKeys.roster: raw]))) {
                XCTAssertEqual($0 as? MigrationError, .malformedRoster)
            }
        }
    }

    func testMissingOrInvalidProfileBlocksCaptureWithoutDeletingSource() throws {
        for raw in ["[]", "bad", "null"] {
            XCTAssertThrowsError(try SnapshotImporter.prepare(Synthetic.snapshot(extra: [LegacyKeys.profile: raw]))) {
                XCTAssertEqual($0 as? MigrationError, .missingProfile)
            }
        }
    }

    func testDuplicateOriginRejectedBeforeWriting() async throws {
        let store = MemoryStore()
        do { _ = try await MigrationEngine(store: store).ingest([Synthetic.snapshot(), Synthetic.snapshot()]); XCTFail("duplicate") }
        catch { XCTAssertEqual(error as? MigrationError, .duplicateOrigin) }
        XCTAssertEqual(store.commits, 0)
    }


    func testFingerprintDoesNotDependOnCaptureEnumerationOrder() throws {
        let original = Synthetic.snapshot()
        let reordered = LegacySnapshot(origin: .www, storage: Dictionary(uniqueKeysWithValues: original.storage.sorted { $0.key > $1.key }))
        XCTAssertEqual(try SnapshotImporter.prepare(original), try SnapshotImporter.prepare(reordered))
    }

    func testNoncanonicalTrailingAtKeysNeverShadowOriginalChild() throws {
        let fixture = Synthetic.snapshot(extra: [
            "sona.profile.v1@": #"{"childName":"Wrong synthetic alias"}"#,
            "sona.progress.v1@": #"{"coins":99999}"#
        ])
        let origin = try SnapshotImporter.prepare(fixture)
        XCTAssertEqual(origin.children[0].profileJSON, fixture.storage[LegacyKeys.profile])
        XCTAssertEqual(origin.children[0].keys["sona.progress.v1"], fixture.storage["sona.progress.v1"])
        XCTAssertTrue(origin.hasOrphanedChildData)
        XCTAssertEqual(origin.storage["sona.profile.v1@"], fixture.storage["sona.profile.v1@"])
        let withoutCanonicalProgress = LegacySnapshot(origin: .www,
            storage: fixture.storage.filter { $0.key != "sona.progress.v1" })
        XCTAssertNil(try SnapshotImporter.prepare(withoutCanonicalProgress).children[0].keys["sona.progress.v1"])
    }

    func testInaccessibleArchiveIsNeverTreatedAsFreshInstall() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("sona-synthetic-inaccessible-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer {
            try? FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: directory.path)
            try? FileManager.default.removeItem(at: directory)
        }
        let store = LocalMigrationArchiveStore(directory: directory)
        try store.commit(MigrationArchive())
        try FileManager.default.setAttributes([.posixPermissions: 0], ofItemAtPath: directory.path)
        XCTAssertThrowsError(try store.read()) { XCTAssertEqual($0 as? MigrationError, .destinationCorrupt) }
    }

    func testCorruptOrFutureArchiveNeverLooksLikeFreshInstall() async throws {
        let store = MemoryStore(); var archive = MigrationArchive(); archive.version = 2; store.value = archive
        do { _ = try await MigrationEngine(store: store).archive(); XCTFail("future version") }
        catch { XCTAssertEqual(error as? MigrationError, .unsupportedVersion) }
        archive.version = 1
        archive.origins[LegacyOrigin.app.rawValue] = try SnapshotImporter.prepare(Synthetic.snapshot(.www))
        store.value = archive
        do { _ = try await MigrationEngine(store: store).archive(); XCTFail("wrong receipt") }
        catch { XCTAssertEqual(error as? MigrationError, .destinationCorrupt) }
    }

    func testAtomicFileStoreSurvivesNewEngineAndRejectsCorruptFile() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("sona-synthetic-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = LocalMigrationArchiveStore(directory: directory)
        _ = try await MigrationEngine(store: store).ingest([Synthetic.snapshot()])
        let receipt = try await MigrationEngine(store: store).ingest([Synthetic.snapshot()])
        XCTAssertEqual(receipt.alreadyImported, [.www])
        #if os(macOS)
        // On this macOS SDK, resourceValues returns false for /tmp even when
        // the backup-exclusion attribute was written. Verify that actual marker.
        XCTAssertGreaterThan(getxattr(directory.path, "com.apple.metadata:com_apple_backup_excludeItem", nil, 0, 0, 0), 0)
        XCTAssertGreaterThan(getxattr(directory.appendingPathComponent("same-device-v1.json").path,
                                     "com.apple.metadata:com_apple_backup_excludeItem", nil, 0, 0, 0), 0)
        #else
        XCTAssertEqual(try directory.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup, true)
        #endif
        try Data("bad".utf8).write(to: directory.appendingPathComponent("same-device-v1.json"))
        XCTAssertThrowsError(try store.read()) { XCTAssertEqual($0 as? MigrationError, .destinationCorrupt) }
    }

    func testWireDecoderRejectsBackupWrongOriginUnstableAndAudioPayloads() throws {
        XCTAssertThrowsError(try LegacySnapshot.decodeCapture(Data(#"{"app":"sona","v":1,"data":{}}"#.utf8), expectedOrigin: .www))
        let good = #"{"schema":1,"origin":"https://www.speaksona.com","stable":true,"storage":{}}"#
        XCTAssertEqual(try LegacySnapshot.decodeCapture(Data(good.utf8), expectedOrigin: .www).storage, [:])
        XCTAssertThrowsError(try LegacySnapshot.decodeCapture(Data(good.utf8), expectedOrigin: .app)) {
            XCTAssertEqual($0 as? MigrationError, .wrongOrigin)
        }
        XCTAssertThrowsError(try LegacySnapshot.decodeCapture(Data(good.replacingOccurrences(of: "true", with: "false").utf8), expectedOrigin: .www)) {
            XCTAssertEqual($0 as? MigrationError, .unstableSource)
        }
        let broken = String(good.dropLast()) + #","recordings":[{"base64":"not-retained"}]}"#
        XCTAssertThrowsError(try LegacySnapshot.decodeCapture(Data(broken.utf8), expectedOrigin: .www)) {
            XCTAssertEqual($0 as? MigrationError, .unexpectedAudioPayload)
        }
    }

    #if canImport(WebKit)
    @MainActor func testReaderChecksExactOriginAndRejectsAliasesAndCredentials() {
        XCTAssertTrue(LegacyWebViewReader.matches(URL(string: "https://www.speaksona.com/migration"), .www))
        for raw in ["https://app.speaksona.com", "http://www.speaksona.com", "https://www.speaksona.com:444", "https://www.speaksona.com.attacker.invalid", "https://user@www.speaksona.com"] {
            XCTAssertFalse(LegacyWebViewReader.matches(URL(string: raw), .www))
        }
    }
    #endif
}
