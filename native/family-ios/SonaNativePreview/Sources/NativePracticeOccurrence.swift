import Foundation

/// Immutable result-time metadata. It is never a selection/start timestamp.
struct NativePracticeOccurrence: Sendable {
    let occurredAtMilliseconds: Double
    let localDay: String
    let timeZoneIdentifier: String
    let timezoneOffsetMinutes: Int
    static func capture(date: Date = Date(), timeZone: TimeZone = .current) -> Self {
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = timeZone
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return .init(occurredAtMilliseconds: date.timeIntervalSince1970 * 1_000,
            localDay: String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!),
            timeZoneIdentifier: timeZone.identifier,
            timezoneOffsetMinutes: -timeZone.secondsFromGMT(for: date) / 60)
    }
}
enum NativePracticeOccurrenceScope {
    @TaskLocal static var current: NativePracticeOccurrence?
}
