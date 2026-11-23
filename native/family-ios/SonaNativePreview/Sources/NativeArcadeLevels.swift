import Foundation

/// Canonical LEVELS1 projection. These are finger-play levels, separate from
/// the clinical practice ladder and from a game's stage/song/wave index.
struct NativeArcadeLevelInfo: Codable, Equatable, Sendable {
    struct Level: Codable, Equatable, Identifiable, Sendable {
        let n: Int
        let line: String
        let open: Bool
        let at: Int
        let have: Int
        var id: Int { n }
    }
    let key: String
    let pick: Int
    let levels: [Level]
}

struct NativeArcadeLevelCatalog: Decodable, Equatable, Sendable {
    struct Game: Decodable, Equatable, Identifiable, Sendable {
        let key: String
        let name: String
        let allowed: Bool
        let info: NativeArcadeLevelInfo
        let best: Int
        var id: String { key }
    }
    let open: Int
    let games: [Game]
}

struct NativeArcadeBestOffer: Codable, Equatable, Sendable {
    let best: Int
    let prev: Int
    let isNew: Bool
}

/// Only these six canonical pages report a visible motor best. Never turn a
/// completed round, a spoken saying, or weighted coins into an invented score.
enum NativeArcadeBestMetric: String, Sendable {
    case fruitInRow, notesInRow, blocksInRow, stars, gatesInRow, blocksPushed
    static func metric(for game: String) -> Self? {
        switch game {
        case "slice": return .fruitInRow
        case "tiles": return .notesInRow
        case "stack": return .blocksInRow
        case "run": return .stars
        case "glide": return .gatesInRow
        case "rise": return .blocksPushed
        default: return nil
        }
    }
}

/// Capture once when a game opens. Retain its level through that round's
/// practice retries, stages, new lives and Play again; Home's next tap reads
/// the canonical preference again. Boards consume .level, never a voice rung.
struct NativeArcadeRoundContext {
    let gameID: String
    let level: Int
    let startingBest: Int
    let bestMetric: NativeArcadeBestMetric?
    let record: NativeArcadeRoundRecord?
    let offerBest: (@MainActor (Int) async throws -> NativeArcadeBestOffer)?
}

/// The app supplies child/access-bound canonical read/write closures. The
/// coordinator rechecks ownership after every await and never owns a ledger.
struct NativeArcadeLevelsAccess {
    let scope: String
    let revision: Int
    let isCurrent: @MainActor () -> Bool
    let canOpen: @MainActor (String) -> Bool
    let catalog: @MainActor () async throws -> NativeArcadeLevelCatalog
    let info: @MainActor (String) async throws -> NativeArcadeLevelInfo
    let ask: @MainActor (String) async throws -> Bool
    let set: @MainActor (String, Int) async throws -> Bool
    let best: @MainActor (String, Int) async throws -> Int
    let offer: @MainActor (String, Int, Int, String, NativePracticeOccurrence) async throws -> NativeArcadeBestOffer
}

@MainActor final class NativeArcadeLevels {
    enum Preparation {
        case choose(NativeArcadeLevelInfo)
        case launch(NativeArcadeRoundContext)
    }
    enum Failure: Error { case unavailable, locked, notSaved, invalidProjection }
    let access: NativeArcadeLevelsAccess
    private let occurrenceNow: () -> NativePracticeOccurrence

    init(access: NativeArcadeLevelsAccess, occurrenceNow: @escaping () -> NativePracticeOccurrence = { .capture() }) {
        self.access = access; self.occurrenceNow = occurrenceNow
    }

    /// A pure shelf/road refresh never marks playLevelAsk as seen.
    func catalog() async throws -> NativeArcadeLevelCatalog {
        guard access.isCurrent() else { throw CancellationError() }
        let value = try await access.catalog()
        guard access.isCurrent(), !Task.isCancelled else { throw CancellationError() }
        return value
    }

    func prepare(gameID: String, askIfNew: Bool = true, retainingLevel: Int? = nil) async throws -> Preparation {
        try current(gameID)
        let info = try await access.info(gameID)
        try current(gameID)
        guard (1...3).contains(info.pick), info.key == gameID else { throw Failure.invalidProjection }
        if retainingLevel == nil, askIfNew, !info.levels.isEmpty {
            let shouldAsk = try await access.ask(gameID)
            try current(gameID)
            if shouldAsk {
                let fresh = try await access.info(gameID)
                try current(gameID)
                guard (1...3).contains(fresh.pick), fresh.key == gameID else { throw Failure.invalidProjection }
                return .choose(fresh)
            }
        }
        return .launch(try await round(gameID: gameID, level: retainingLevel ?? info.pick))
    }

    /// Home's open choice persists and launches. The view owns the canonical
    /// 500 ms settling window; a locked choice remains on the sheet.
    func chooseForLaunch(gameID: String, level: Int) async throws -> NativeArcadeRoundContext {
        let info = try await set(gameID: gameID, level: level)
        return try await round(gameID: gameID, level: info.pick)
    }

    /// Trophy Road changes only the preference: no ask mark and no launch.
    func chooseOnRoad(gameID: String, level: Int) async throws -> NativeArcadeLevelCatalog {
        _ = try await set(gameID: gameID, level: level)
        return try await catalog()
    }

    private func set(gameID: String, level: Int) async throws -> NativeArcadeLevelInfo {
        try current(gameID)
        let before = try await access.info(gameID)
        try current(gameID)
        guard before.levels.contains(where: { $0.n == level && $0.open }) else { throw Failure.locked }
        guard try await access.set(gameID, level) else { throw Failure.notSaved }
        try current(gameID)
        let fresh = try await access.info(gameID)
        try current(gameID)
        return fresh
    }

    private func round(gameID: String, level: Int) async throws -> NativeArcadeRoundContext {
        try current(gameID)
        guard (1...3).contains(level) else { throw Failure.invalidProjection }
        let best = try await access.best(gameID, level)
        try current(gameID)
        let metric = NativeArcadeBestMetric.metric(for: gameID), id = UUID()
        guard let metric else {
            return .init(gameID: gameID, level: level, startingBest: best, bestMetric: nil, record: nil, offerBest: nil)
        }
        let access = access, occurrenceNow = occurrenceNow
        let save: @MainActor (Int, NativePracticeOccurrence) async throws -> NativeArcadeBestOffer = { count, occurrence in
            guard access.isCurrent(), access.canOpen(gameID), !Task.isCancelled else { throw CancellationError() }
            let receipt = "\(id.uuidString)/best/\(gameID)/\(level)/\(count)"
            let result = try await access.offer(gameID, level, count, receipt, occurrence)
            guard access.isCurrent(), access.canOpen(gameID), !Task.isCancelled else { throw CancellationError() }
            return result
        }
        let record = NativeArcadeRoundRecord(metric: metric, startingBest: best, occurrenceNow: occurrenceNow, offer: save)
        return .init(gameID: gameID, level: level, startingBest: best, bestMetric: metric, record: record,
                     offerBest: { count in try await save(count, occurrenceNow()) })
    }

    private func current(_ gameID: String) throws {
        guard access.isCurrent(), !Task.isCancelled else { throw CancellationError() }
        guard access.canOpen(gameID) else { throw Failure.unavailable }
    }
}

/// One page-length motor count, independent of mounted board/stage state.
/// The four streak games reset only their current row on a real miss. Run and
/// Rise count actual stars/blocks cumulatively, including after a new life.
@MainActor final class NativeArcadeRoundRecord {
    let metric: NativeArcadeBestMetric
    let startingBest: Int
    private(set) var currentCount = 0
    private(set) var roundBest = 0
    private(set) var best: Int
    private var savedPeak = 0
    private var peakOccurrence: NativePracticeOccurrence?
    private let occurrenceNow: () -> NativePracticeOccurrence
    private var pending: Task<Void, Never>?
    private let offer: @MainActor (Int, NativePracticeOccurrence) async throws -> NativeArcadeBestOffer

    init(metric: NativeArcadeBestMetric, startingBest: Int,
         occurrenceNow: @escaping () -> NativePracticeOccurrence = { .capture() },
         offer: @escaping @MainActor (Int, NativePracticeOccurrence) async throws -> NativeArcadeBestOffer) {
        self.metric = metric; self.startingBest = startingBest
        self.best = startingBest; self.occurrenceNow = occurrenceNow; self.offer = offer
    }

    @discardableResult func recordMove(qualifies: Bool) -> Int {
        guard metric != .stars, metric != .blocksPushed else { return roundBest }
        if qualifies { add(1) } else { currentCount = 0 }
        return roundBest
    }

    @discardableResult func recordStars(adding count: Int = 1) -> Int {
        guard metric == .stars else { return roundBest }
        add(count); return roundBest
    }

    @discardableResult func recordPushedBlock() -> Int {
        guard metric == .blocksPushed else { return roundBest }
        add(1); return roundBest
    }

    /// A failed save remains retryable. Ownership/access are checked by the
    /// captured canonical offer, including after its awaited storage work.
    func flush() async {
        enqueue()
        let current = pending
        await current?.value
    }

    private func add(_ count: Int) {
        guard count > 0, count <= 99_999, currentCount <= 99_999 - count else { return }
        currentCount += count
        if currentCount > roundBest {
            roundBest = currentCount
            peakOccurrence = occurrenceNow()
        }
        enqueue()
    }

    private func enqueue() {
        guard pending == nil, roundBest > savedPeak else { return }
        pending = Task { @MainActor [self] in
            defer { pending = nil }
            while roundBest > savedPeak, let occurrence = peakOccurrence {
                let count = roundBest
                do {
                    let result = try await offer(count, occurrence)
                    best = max(best, result.best); savedPeak = count
                } catch { return }
            }
        }
    }
}
