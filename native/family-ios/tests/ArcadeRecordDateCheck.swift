import Foundation

@main enum ArcadeRecordDateCheck {
    @MainActor static func main() async {
        let zone = TimeZone(secondsFromGMT: -7 * 3_600)!
        let midnight = ISO8601DateFormatter().date(from: "2026-11-20T07:00:00Z")!
        var now = midnight.addingTimeInterval(-1)
        var attempts: [(Int, String)] = []
        let record = NativeArcadeRoundRecord(metric: .stars, startingBest: 0, occurrenceNow: {
            .capture(date: now, timeZone: zone)
        }, offer: { count, occurrence in
            attempts.append((count, occurrence.localDay))
            if attempts.count == 1 { throw CocoaError(.fileWriteOutOfSpace) }
            return .init(best: count, prev: 0, isNew: true)
        })
        record.recordStars()
        now = midnight.addingTimeInterval(1)
        await record.flush()
        await record.flush()
        precondition(attempts.count == 2)
        precondition(attempts[0].0 == 1 && attempts[0].1 == "2026-11-19" &&
                     attempts[1].0 == 1 && attempts[1].1 == "2026-11-19",
                     "Neither a queued motor best nor its retry can move the earned day")
        record.recordStars()
        await record.flush()
        precondition(attempts.last?.0 == 2 && attempts.last?.1 == "2026-11-20",
                     "A new actual best uses the new day")
        print("A queued and retried arcade best preserves the day it was earned")
    }
}
