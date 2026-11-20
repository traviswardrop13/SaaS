import Foundation
import XCTest
@testable import SonaFamilyMigration

private enum CoordinatorFixtureError: Error { case inaccessibleSource, writeFailed, lostAcknowledgement }

private func runSnapshot(_ origin: LegacyOrigin, count: Int = 7) -> LegacySnapshot {
    LegacySnapshot(origin: origin, storage: [
        LegacyKeys.profile: #"{"childName":"Synthetic child","onboarded":true}"#,
        "sona.progress.v1": "{\"coins\":\(count)}"
    ])
}

private final class RunMemoryStore: MigrationArchiveStore, @unchecked Sendable {
    var value: MigrationArchive?
    var commits = 0
    var failBeforeWrite = false
    var failAfterWrite = false
    var failRead = false
    func read() throws -> MigrationArchive? {
        if failRead { throw CoordinatorFixtureError.inaccessibleSource }
        return value
    }
    func commit(_ archive: MigrationArchive) throws {
        commits += 1
        if failBeforeWrite { throw CoordinatorFixtureError.writeFailed }
        value = archive
        if failAfterWrite { throw CoordinatorFixtureError.lostAcknowledgement }
    }
}

private actor RunCaptureAdapter: LegacyOriginCapturing {
    var snapshots: [LegacyOrigin: LegacySnapshot]
    var failures: Set<LegacyOrigin> = []
    var calls: [LegacyOrigin] = []

    init(_ snapshots: [LegacyOrigin: LegacySnapshot]) { self.snapshots = snapshots }

    func capture(origin: LegacyOrigin) async throws -> LegacySnapshot {
        calls.append(origin)
        if failures.contains(origin) { throw CoordinatorFixtureError.inaccessibleSource }
        guard let snapshot = snapshots[origin] else { throw CoordinatorFixtureError.inaccessibleSource }
        return snapshot
    }

    func fail(_ origin: LegacyOrigin) { failures.insert(origin) }
    func recover(_ origin: LegacyOrigin) { failures.remove(origin) }
    func replace(_ origin: LegacyOrigin, with snapshot: LegacySnapshot) { snapshots[origin] = snapshot }
}

private actor HeldCaptureAdapter: LegacyOriginCapturing {
    private var held: CheckedContinuation<Void, Never>?
    private var observers: [CheckedContinuation<Void, Never>] = []
    private var started = false

    func capture(origin: LegacyOrigin) async throws -> LegacySnapshot {
        await withCheckedContinuation { continuation in
            held = continuation
            started = true
            observers.forEach { $0.resume() }
            observers = []
        }
        return runSnapshot(origin)
    }

    func waitForCapture() async {
        if started { return }
        await withCheckedContinuation { observers.append($0) }
    }

    func release() { held?.resume(); held = nil }
}

final class MigrationRunCoordinatorTests: XCTestCase {
    func testEveryRequiredCaptureCommitsTogetherAndReturnsEngineReceipt() async throws {
        let store = RunMemoryStore()
        let capture = RunCaptureAdapter([.www: runSnapshot(.www), .app: runSnapshot(.app)])
        let coordinator = MigrationRunCoordinator(engine: MigrationEngine(store: store), captureAdapter: capture,
                                                   requiredOrigins: [.www, .app])
        let receipt = try await coordinator.run()
        XCTAssertEqual(receipt.imported, [.www, .app])
        XCTAssertEqual(receipt.checkedOrigins, [.www, .app])
        XCTAssertEqual(store.commits, 1)
        XCTAssertEqual(store.value?.origins.count, 2)
        let calls = await capture.calls
        XCTAssertEqual(calls, [.www, .app])
        let status = await coordinator.status
        XCTAssertEqual(status, .completed(receipt))
    }

    func testSecondCaptureFailureNeverPartiallyImportsOrPretendsFreshInstall() async throws {
        let store = RunMemoryStore()
        let capture = RunCaptureAdapter([.www: runSnapshot(.www), .app: runSnapshot(.app)])
        await capture.fail(.app)
        let coordinator = MigrationRunCoordinator(engine: MigrationEngine(store: store), captureAdapter: capture,
                                                   requiredOrigins: [.www, .app])
        do { _ = try await coordinator.run(); XCTFail("An inaccessible origin must hold the upgrade") }
        catch { XCTAssertEqual(error as? MigrationRunFailure, .captureUnavailable(.app)) }
        XCTAssertNil(store.value)
        XCTAssertEqual(store.commits, 0)
        let status = await coordinator.status
        XCTAssertEqual(status, .failed(.captureUnavailable(.app)))
    }

    func testExplicitRetryRecapturesWholeBatchAndCommitsOnlyOnce() async throws {
        let store = RunMemoryStore()
        let capture = RunCaptureAdapter([.www: runSnapshot(.www), .app: runSnapshot(.app)])
        await capture.fail(.app)
        let coordinator = MigrationRunCoordinator(engine: MigrationEngine(store: store), captureAdapter: capture,
                                                   requiredOrigins: [.www, .app])
        do { _ = try await coordinator.run(); XCTFail("Capture should fail") } catch {}
        await capture.recover(.app)
        let receipt = try await coordinator.run()
        XCTAssertEqual(receipt.imported, [.www, .app])
        XCTAssertEqual(store.commits, 1)
        let calls = await capture.calls
        XCTAssertEqual(calls, [.www, .app, .www, .app])
    }

    func testWrongOriginFromAdapterIsRejectedWithoutAnImport() async throws {
        let store = RunMemoryStore()
        let capture = RunCaptureAdapter([.www: runSnapshot(.bare)])
        let coordinator = MigrationRunCoordinator(engine: MigrationEngine(store: store), captureAdapter: capture,
                                                   requiredOrigins: [.www])
        do { _ = try await coordinator.run(); XCTFail("Aliases cannot replace an origin") }
        catch { XCTAssertEqual(error as? MigrationRunFailure, .captureRejected(.www, .wrongOrigin)) }
        XCTAssertEqual(store.commits, 0)
        XCTAssertNil(store.value)
    }

    func testInvalidSecondSnapshotIsValidatedByEngineBeforeAnyWrite() async throws {
        let store = RunMemoryStore()
        let bad = LegacySnapshot(origin: .app, storage: [LegacyKeys.profile: "not JSON"])
        let capture = RunCaptureAdapter([.www: runSnapshot(.www), .app: bad])
        let coordinator = MigrationRunCoordinator(engine: MigrationEngine(store: store), captureAdapter: capture,
                                                   requiredOrigins: [.www, .app])
        do { _ = try await coordinator.run(); XCTFail("Bad snapshot must hold the whole batch") }
        catch { XCTAssertEqual(error as? MigrationRunFailure, .importRejected(.missingProfile)) }
        XCTAssertNil(store.value)
        XCTAssertEqual(store.commits, 0)
    }

    func testCorruptDestinationBlocksCaptureAndNeverBecomesEmptyData() async throws {
        let store = RunMemoryStore()
        var future = MigrationArchive(); future.version = 999
        store.value = future
        let capture = RunCaptureAdapter([.www: runSnapshot(.www)])
        let coordinator = MigrationRunCoordinator(engine: MigrationEngine(store: store), captureAdapter: capture,
                                                   requiredOrigins: [.www])
        do { _ = try await coordinator.run(); XCTFail("An unreadable destination must block upgrade") }
        catch { XCTAssertEqual(error as? MigrationRunFailure, .archiveRejected(.unsupportedVersion)) }
        let calls = await capture.calls
        XCTAssertTrue(calls.isEmpty)
        XCTAssertEqual(store.value, future)
        XCTAssertEqual(store.commits, 0)
    }

    func testEmptyRequiredSetIsNotSuccessfulFreshStart() async throws {
        let store = RunMemoryStore()
        let capture = RunCaptureAdapter([:])
        let coordinator = MigrationRunCoordinator(engine: MigrationEngine(store: store), captureAdapter: capture,
                                                   requiredOrigins: [])
        do { _ = try await coordinator.run(); XCTFail("A host must require an origin") }
        catch { XCTAssertEqual(error as? MigrationRunFailure, .noRequiredOrigins) }
        XCTAssertNil(store.value)
        XCTAssertEqual(store.commits, 0)
    }

    func testInaccessibleDestinationStopsBeforeCaptureAndPreservesExistingData() async throws {
        let store = RunMemoryStore()
        let engine = MigrationEngine(store: store)
        _ = try await engine.ingest([runSnapshot(.www)])
        let original = store.value
        store.failRead = true
        let capture = RunCaptureAdapter([.www: runSnapshot(.www)])
        let coordinator = MigrationRunCoordinator(engine: engine, captureAdapter: capture, requiredOrigins: [.www])
        do { _ = try await coordinator.run(); XCTFail("Unreadable storage cannot mean a new install") }
        catch { XCTAssertEqual(error as? MigrationRunFailure, .storageUnavailable) }
        let calls = await capture.calls
        XCTAssertTrue(calls.isEmpty)
        XCTAssertEqual(store.value, original)
        XCTAssertEqual(store.commits, 1)
    }

    func testDefaultRequiresRealCaptureOfAllKnownOriginsIncludingEmptyOnes() async throws {
        let store = RunMemoryStore()
        let capture = RunCaptureAdapter(Dictionary(uniqueKeysWithValues: LegacyOrigin.allCases.map {
            ($0, LegacySnapshot(origin: $0, storage: [:]))
        }))
        let coordinator = MigrationRunCoordinator(engine: MigrationEngine(store: store), captureAdapter: capture)
        let receipt = try await coordinator.run()
        XCTAssertTrue(receipt.capturedAllKnownOrigins)
        XCTAssertEqual(receipt.imported, Set(LegacyOrigin.allCases))
        XCTAssertEqual(store.value?.origins.count, LegacyOrigin.allCases.count)
        XCTAssertEqual(store.commits, 1)
    }

    func testRelaunchRetryUsesEngineReceiptsAndDoesNotPayCountersAgain() async throws {
        let store = RunMemoryStore()
        let capture = RunCaptureAdapter([.www: runSnapshot(.www)])
        _ = try await MigrationRunCoordinator(engine: MigrationEngine(store: store), captureAdapter: capture,
                                             requiredOrigins: [.www]).run()
        let first = store.value
        let retry = try await MigrationRunCoordinator(engine: MigrationEngine(store: store), captureAdapter: capture,
                                                      requiredOrigins: [.www]).run()
        XCTAssertTrue(retry.imported.isEmpty)
        XCTAssertEqual(retry.alreadyImported, [.www])
        XCTAssertEqual(store.value, first)
        XCTAssertEqual(store.commits, 1)
    }

    func testChangedSourceAfterImportIsHeldForReconciliation() async throws {
        let store = RunMemoryStore()
        let capture = RunCaptureAdapter([.www: runSnapshot(.www)])
        let coordinator = MigrationRunCoordinator(engine: MigrationEngine(store: store), captureAdapter: capture,
                                                   requiredOrigins: [.www])
        _ = try await coordinator.run()
        let first = store.value
        await capture.replace(.www, with: runSnapshot(.www, count: 999))
        do { _ = try await coordinator.run(); XCTFail("Changed source cannot overwrite imported progress") }
        catch { XCTAssertEqual(error as? MigrationRunFailure, .importRejected(.sourceChangedAfterImport)) }
        XCTAssertEqual(store.value, first)
        XCTAssertEqual(store.commits, 1)
    }

    func testWriteFailureCanRetryWithoutInventingAnEmptyReceipt() async throws {
        let store = RunMemoryStore(); store.failBeforeWrite = true
        let capture = RunCaptureAdapter([.www: runSnapshot(.www)])
        let coordinator = MigrationRunCoordinator(engine: MigrationEngine(store: store), captureAdapter: capture,
                                                   requiredOrigins: [.www])
        do { _ = try await coordinator.run(); XCTFail("Write must fail") }
        catch { XCTAssertEqual(error as? MigrationRunFailure, .storageUnavailable) }
        XCTAssertNil(store.value)
        store.failBeforeWrite = false
        let receipt = try await coordinator.run()
        XCTAssertEqual(receipt.imported, [.www])
        XCTAssertEqual(store.commits, 2)
    }

    func testLostAcknowledgementAfterAtomicCommitIsSafeOnRetry() async throws {
        let store = RunMemoryStore(); store.failAfterWrite = true
        let capture = RunCaptureAdapter([.www: runSnapshot(.www)])
        let coordinator = MigrationRunCoordinator(engine: MigrationEngine(store: store), captureAdapter: capture,
                                                   requiredOrigins: [.www])
        do { _ = try await coordinator.run(); XCTFail("Lost acknowledgement is not success") }
        catch { XCTAssertEqual(error as? MigrationRunFailure, .storageUnavailable) }
        let first = store.value
        XCTAssertNotNil(first)
        store.failAfterWrite = false
        let receipt = try await coordinator.run()
        XCTAssertEqual(receipt.alreadyImported, [.www])
        XCTAssertEqual(store.value, first)
        XCTAssertEqual(store.commits, 1)
    }

    func testCancellationWhileCaptureIsPendingNeverImports() async throws {
        let store = RunMemoryStore(), capture = HeldCaptureAdapter()
        let coordinator = MigrationRunCoordinator(engine: MigrationEngine(store: store), captureAdapter: capture,
                                                   requiredOrigins: [.www])
        let run = Task { try await coordinator.run() }
        await capture.waitForCapture()
        run.cancel()
        await capture.release()
        do { _ = try await run.value; XCTFail("Cancelled run cannot commit") }
        catch { XCTAssertEqual(error as? MigrationRunFailure, .cancelled) }
        XCTAssertNil(store.value)
        XCTAssertEqual(store.commits, 0)
        let status = await coordinator.status
        XCTAssertEqual(status, .failed(.cancelled))
    }

    func testConcurrentRunCannotStartAnotherCaptureOrOverwriteCurrentPhase() async throws {
        let store = RunMemoryStore(), capture = HeldCaptureAdapter()
        let coordinator = MigrationRunCoordinator(engine: MigrationEngine(store: store), captureAdapter: capture,
                                                   requiredOrigins: [.www])
        let first = Task { try await coordinator.run() }
        await capture.waitForCapture()
        do { _ = try await coordinator.run(); XCTFail("A run is already collecting data") }
        catch { XCTAssertEqual(error as? MigrationRunFailure, .alreadyRunning) }
        let pending = await coordinator.status
        XCTAssertEqual(pending, .capturing(origin: .www, completed: 0, total: 1))
        await capture.release()
        let receipt = try await first.value
        XCTAssertEqual(receipt.imported, [.www])
        XCTAssertEqual(store.commits, 1)
    }
}
