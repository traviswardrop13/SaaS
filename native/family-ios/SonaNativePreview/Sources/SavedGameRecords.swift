import Foundation
import CoreFoundation
import SonaFamilyMigration

/// Read-only visibility for this child's original play records. These values
/// never unlock a level, count as speech practice, or enter a progress report.
struct SavedGameRecord: Identifiable, Equatable, Sendable {
    enum Metric: String, Sendable {
        case fruitRow, noteRow, blockRow, gapRow, pushedBlocks, stars, legacyMetres
    }
    let gameID: String
    let gameTitle: String
    let level: Int
    let count: Int
    let metric: Metric

    var id: String { "\(gameID)/\(level)/\(metric.rawValue)" }
    var sourceLabel: String {
        metric == .legacyMetres ? "Earlier Sound Sprint · Level \(level)" : "Original game · Level \(level)"
    }
    var resultLabel: String {
        let number = count.formatted()
        switch metric {
        case .fruitRow: return count == 1 ? "1 fruit" : "\(number) fruit in a row"
        case .noteRow: return count == 1 ? "1 note" : "\(number) notes in a row"
        case .blockRow: return count == 1 ? "1 block" : "\(number) blocks in a row"
        case .gapRow: return count == 1 ? "1 gap" : "\(number) gaps in a row"
        case .pushedBlocks: return count == 1 ? "1 block pushed" : "\(number) blocks pushed"
        case .stars: return count == 1 ? "1 star" : "\(number) stars"
        case .legacyMetres: return count == 1 ? "1 metre" : "\(number) metres"
        }
    }

    /// NativeFamilyChild already exposes only the requested origin+slot's base
    /// keys. Never scan another child's suffix or the raw migration archive.
    static func project(child: NativeFamilyChild?) -> [Self] {
        guard let child else { return [] }
        return project(scopedKeys: child.keys)
    }

    static func project(scopedKeys: [String: String]) -> [Self] {
        let first = object(scopedKeys["sona.bests.v1"]) ?? [:]
        let levels = (object(scopedKeys["sona.playlevel.v1"])?["best"] as? [String: Any]) ?? [:]
        let games: [(String, String, Metric, Bool)] = [
            ("slice", "Fruit Slice", .fruitRow, true),
            ("tiles", "Piano Tiles", .noteRow, true),
            ("stack", "Block Stacker", .blockRow, true),
            ("glide", "Flappy Glide", .gapRow, true),
            ("rise", "Rise Up", .pushedBlocks, false),
            ("run", "Sound Sprint", .stars, true)
        ]
        var rows: [Self] = []
        for (key, title, standardMetric, hasLevels) in games {
            func append(_ value: Any?, level: Int) {
                guard let record = value as? [String: Any], let count = validCount(record["n"]),
                      let savedMetric = metric(game: key, record: record, standard: standardMetric) else { return }
                rows.append(.init(gameID: key, gameTitle: title, level: level, count: count, metric: savedMetric))
            }
            append(first[key], level: 1)
            if hasLevels, let perGame = levels[key] as? [String: Any] {
                // Only the original supported levels, independent of today's
                // unlocks. Keeping a historical record never opens a level.
                for level in 2...3 { append(perGame[String(level)], level: level) }
            }
        }
        return rows
    }

    private static func object(_ raw: String?) -> [String: Any]? {
        guard let raw, let bytes = raw.data(using: .utf8) else { return nil }
        return (try? JSONSerialization.jsonObject(with: bytes)) as? [String: Any]
    }
    private static func validCount(_ raw: Any?) -> Int? {
        guard let number = raw as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID() else { return nil }
        let value = number.doubleValue
        guard value.isFinite, value >= 1, value <= 99_999, value.rounded(.down) == value else { return nil }
        return Int(value)
    }
    private static func metric(game: String, record: [String: Any], standard: Metric) -> Metric? {
        let raw = record["c"]
        let stamp: String?
        if raw == nil || raw is NSNull { stamp = nil }
        else { guard let text = raw as? String else { return nil }; stamp = text }
        if game == "run" {
            if stamp == "stars" { return .stars }
            // Before 5 November the original race recorded metres without a
            // stamp. Preserve it as distance, never as a current star score.
            if stamp == nil || stamp == "" || stamp == "metres" { return .legacyMetres }
            return nil
        }
        // A future unknown unit is retained in storage but never mislabeled.
        guard stamp == nil || stamp == "" else { return nil }
        return standard
    }
}
