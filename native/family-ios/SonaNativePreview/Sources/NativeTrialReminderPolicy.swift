import Foundation

public enum NativeTrialReminderAuthorization: String, Codable, Sendable {
    case unknown, prompt, granted, denied, unavailable
}

public struct NativeTrialReminderRequest: Codable, Equatable, Sendable {
    public let id: String
    public let at: Double
    public let title: String
    public let body: String
    public init(id: String, at: Double, title: String, body: String) {
        self.id = id; self.at = at; self.title = title; self.body = body
    }
}

public struct NativeTrialReminderPending: Codable, Equatable, Sendable {
    public let id: String
    public let at: Double
    public init(id: String, at: Double) { self.id = id; self.at = at }
}

/// The completed store answer only. A failed/unavailable lookup is nil instead.
public struct NativeTrialReminderStatus: Equatable, Sendable {
    public let hasFullEntitlement: Bool
    public let periodType: String
    public let expirationMilliseconds: Double?
    public let willRenew: Bool?
    public init(hasFullEntitlement: Bool, periodType: String = "", expirationMilliseconds: Double? = nil, willRenew: Bool? = nil) {
        self.hasFullEntitlement = hasFullEntitlement; self.periodType = periodType
        self.expirationMilliseconds = expirationMilliseconds; self.willRenew = willRenew
    }
    public enum Answer: Equatable, Sendable { case on(Double?), unsure, off, paid, cancelled }
    public var answer: Answer {
        guard hasFullEntitlement else { return .off }
        let period = periodType.uppercased()
        guard !period.isEmpty else { return .unsure }
        guard period == "TRIAL" else { return .paid }
        guard willRenew != false else { return .cancelled }
        let end = expirationMilliseconds.flatMap { $0.isFinite && $0 > 0 ? $0 : nil }
        return .on(end)
    }
}

public struct NativeTrialReminderPurchase: Sendable {
    public let periodType: String
    public let expirationMilliseconds: Double?
    /// Only the selected offer's actual, confirmed-eligible free period may supply this.
    public let sureFreeEndMilliseconds: Double?
    /// An available free period may supply the end when Apple explicitly says TRIAL.
    public let offerFreeEndMilliseconds: Double?
    public init(periodType: String, expirationMilliseconds: Double?, sureFreeEndMilliseconds: Double?, offerFreeEndMilliseconds: Double? = nil) {
        self.periodType = periodType; self.expirationMilliseconds = expirationMilliseconds
        self.sureFreeEndMilliseconds = sureFreeEndMilliseconds
        self.offerFreeEndMilliseconds = offerFreeEndMilliseconds
    }
}

public enum NativeTrialReminderPolicy {
    public static let day = 86_400_000.0
    public static let hour = 3_600_000.0
    public static let trialLead = 30 * hour
    public static let trialID = "sona-trial-end"
    public static let trialTitle = "Sona"
    public static let trialBody = "Your free trial ends tomorrow."
    public static let nudgeTitle = "Sona"
    public static let nudgeBody = "Ready for 5 minutes of practice? Echo is waiting to play."

    public static func trial(end: Double, now: Double) -> NativeTrialReminderRequest? {
        guard end.isFinite, end > 0 else { return nil }
        let at = (end - trialLead).rounded()
        guard at > now + hour, at <= now + 400 * day else { return nil }
        return .init(id: trialID, at: at, title: trialTitle, body: trialBody)
    }
    public static func localDay(_ milliseconds: Double, timeZone: TimeZone) -> String {
        let p = calendar(timeZone).dateComponents([.year, .month, .day], from: Date(timeIntervalSince1970: milliseconds / 1_000))
        return String(format: "%04d-%02d-%02d", p.year!, p.month!, p.day!)
    }
    public static func nudgeID(_ milliseconds: Double, timeZone: TimeZone) -> String {
        "sona-nudge-" + localDay(milliseconds, timeZone: timeZone).replacingOccurrences(of: "-", with: "")
    }
    public static func clock(_ milliseconds: Double, timeZone: TimeZone) -> Int {
        let p = calendar(timeZone).dateComponents([.hour, .minute], from: Date(timeIntervalSince1970: milliseconds / 1_000))
        return max(930, min(1170, p.hour! * 60 + p.minute!))
    }
    public static func nudges(start: Double, end: Double, clock: Int?, now: Double, timeZone: TimeZone) -> [NativeTrialReminderRequest] {
        guard start.isFinite, end.isFinite, now.isFinite else { return [] }
        let c = calendar(timeZone), s = Date(timeIntervalSince1970: start / 1_000)
        let parts = c.dateComponents([.year, .month, .day], from: s)
        let minute = max(930, min(1170, clock ?? self.clock(start, timeZone: timeZone)))
        let last = localDay(end, timeZone: timeZone), remind = localDay(end - trialLead, timeZone: timeZone)
        guard let midnight = c.date(from: parts) else { return [] }
        var result: [NativeTrialReminderRequest] = []
        for k in 1...14 {
            guard let date = c.date(byAdding: .day, value: k, to: midnight),
                  let when = c.date(bySettingHour: minute / 60, minute: minute % 60, second: 0, of: date) else { continue }
            let at = when.timeIntervalSince1970 * 1_000, day = localDay(at, timeZone: timeZone)
            if day >= last || at >= end { break }
            if day == remind || at <= now + 600_000 { continue }
            result.append(.init(id: nudgeID(at, timeZone: timeZone), at: at, title: nudgeTitle, body: nudgeBody))
        }
        return result
    }
    static func calendar(_ timeZone: TimeZone) -> Calendar {
        var c = Calendar(identifier: .gregorian); c.timeZone = timeZone; return c
    }
}
