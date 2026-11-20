import Foundation

/// The host supplies a controlled, quiesced document in the old app's default
/// WebKit store and delegates capture to LegacyWebViewReader. This protocol does
/// not load a URL, follow redirects, authorize origins or turn on the native app.
/// An adapter must throw for an offline, redirected or inaccessible source;
/// only a successful same-origin read may return a genuinely empty snapshot.
public protocol LegacyOriginCapturing: Sendable {
    func capture(origin: LegacyOrigin) async throws -> LegacySnapshot
}

/// Fixed categories only. Underlying adapter/store errors may contain file paths,
/// credentials or family data, so they never cross the coordinator boundary.
public enum MigrationRunFailure: Error, Equatable, Sendable {
    case noRequiredOrigins
    case alreadyRunning
    case cancelled
    case captureUnavailable(LegacyOrigin)
    case captureRejected(LegacyOrigin, MigrationError)
    case archiveRejected(MigrationError)
    case importRejected(MigrationError)
    case storageUnavailable
}

/// Ephemeral host progress, not a second migration ledger. Completion means the
/// requested captures are in the verified archive; it is not a release gate.
public enum MigrationRunStatus: Equatable, Sendable {
    case idle
    case checkingArchive
    case capturing(origin: LegacyOrigin, completed: Int, total: Int)
    case importing
    case completed(MigrationReceipt)
    case failed(MigrationRunFailure)
}

/// Collects every required capture before asking the existing engine for one
/// atomic import. Receipts and idempotence remain owned solely by that engine.
/// Keep one coordinator/engine for a destination; retry by calling run again.
public actor MigrationRunCoordinator {
    private let engine: MigrationEngine
    private let captureAdapter: any LegacyOriginCapturing
    private let requiredOrigins: [LegacyOrigin]
    private var running = false
    public private(set) var status: MigrationRunStatus = .idle

    /// The host chooses the full required set once, before the first attempt.
    /// Retry cannot silently weaken it. Default coverage includes all known
    /// legacy origins; choosing a smaller set requires host-side evidence.
    public init(engine: MigrationEngine, captureAdapter: any LegacyOriginCapturing,
                requiredOrigins: Set<LegacyOrigin> = Set(LegacyOrigin.allCases)) {
        self.engine = engine
        self.captureAdapter = captureAdapter
        self.requiredOrigins = LegacyOrigin.allCases.filter { requiredOrigins.contains($0) }
    }

    public func run() async throws -> MigrationReceipt {
        // Reentrant actor calls cannot overlap a pending capture. This rejection
        // must not replace the real run's current phase with a failure screen.
        guard !running else { throw MigrationRunFailure.alreadyRunning }
        running = true
        defer { running = false }

        do {
            guard !requiredOrigins.isEmpty else { throw MigrationRunFailure.noRequiredOrigins }
            try Task.checkCancellation()
            status = .checkingArchive
            do { _ = try await engine.archive() }
            catch let reason as MigrationError { throw MigrationRunFailure.archiveRejected(reason) }
            catch { throw MigrationRunFailure.storageUnavailable }

            var snapshots: [LegacySnapshot] = []
            for origin in requiredOrigins {
                try Task.checkCancellation()
                status = .capturing(origin: origin, completed: snapshots.count, total: requiredOrigins.count)
                let snapshot: LegacySnapshot
                do { snapshot = try await captureAdapter.capture(origin: origin) }
                catch is CancellationError { throw MigrationRunFailure.cancelled }
                catch let reason as MigrationError { throw MigrationRunFailure.captureRejected(origin, reason) }
                catch { throw MigrationRunFailure.captureUnavailable(origin) }
                try Task.checkCancellation()
                guard snapshot.origin == origin else {
                    throw MigrationRunFailure.captureRejected(origin, .wrongOrigin)
                }
                snapshots.append(snapshot)
            }

            // Cancellation is honored while gathering, never reported as an
            // aborted import after the engine has already committed a receipt.
            try Task.checkCancellation()
            status = .importing
            let receipt: MigrationReceipt
            do { receipt = try await engine.ingest(snapshots) }
            catch let reason as MigrationError { throw MigrationRunFailure.importRejected(reason) }
            catch { throw MigrationRunFailure.storageUnavailable }
            status = .completed(receipt)
            return receipt
        } catch {
            let failure = error as? MigrationRunFailure ?? (error is CancellationError ? .cancelled : .storageUnavailable)
            status = .failed(failure)
            throw failure
        }
    }
}
