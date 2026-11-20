import Foundation
import CoreFoundation

/// Device-local only. This is never included in the family backup format.
struct NativeFamilyReportJournal: Codable, Equatable, Sendable {
    var packet: NativeFamilyReportPacket?
    var queuedRemovals: Set<UUID> = []
}

public struct NativeFamilyReportPacket: Codable, Equatable, Sendable {
    public let id: UUID
    public let origin: LegacyOrigin
    public let body: Data
    public let context: Data
    public let preparedAt: Date
}

public struct NativeFamilyReportMutation: Sendable {
    public let reportState: String?
    public let profilePatches: [String: String]
    public let body: Data?
    public let context: Data?
    public init(reportState: String?, profilePatches: [String: String], body: Data? = nil, context: Data? = nil) {
        self.reportState = reportState; self.profilePatches = profilePatches
        self.body = body; self.context = context
    }
}
public enum NativeFamilyReportAction: Sendable { case flush, sync, queueOff(String?) }
public enum NativeFamilyReportError: Error { case wrongOrigin, invalidProjection, invalidPacket, changed }

public extension NativeFamilyRepository {
    /// One complete household projection and its anonymous request are committed
    /// together before transport. The policy closure is the canonical REPORT1.
    func prepareWeeklyReport(origin: LegacyOrigin, now: Date,
        policy: @Sendable (NativeFamilyOrigin, NativeFamilyReportAction) throws -> NativeFamilyReportMutation) throws -> NativeFamilyReportPacket? {
        try change { document in
            guard document.primaryOrigin == origin, var family = document.origins[origin.rawValue] else { throw NativeFamilyReportError.wrongOrigin }
            var journal = document.weeklyReportJournal?[origin.rawValue] ?? NativeFamilyReportJournal()
            let removals = document.removalObligations.filter { $0.childID.origin == origin && !journal.queuedRemovals.contains($0.operationID) }
            let report = NativeFamilyOrigin.object(family.storage["sona.report.v1"]) ?? [:]
            let hasQueuedOff = report["offOwed"] is [String: Any] || (report["offs"] as? [[String: Any]])?.isEmpty == false
            guard journal.packet != nil || hasQueuedOff || removals.contains(where: { $0.reportEmail != nil }) ||
                  family.children.contains(where: { Self.reportConsentAddress($0) != nil }) else { return nil }
            // Removing the address owner owes the same off as Settings. Keep
            // the original obligation for the host's separate board cleanup.
            for obligation in removals {
                if let email = obligation.reportEmail {
                    let queued = try policy(family, .queueOff(email))
                    try Self.applyReport(queued, family: &family)
                    journal.queuedRemovals.insert(obligation.operationID)
                }
            }
            if let packet = journal.packet {
                document.origins[origin.rawValue] = family
                var journals = document.weeklyReportJournal ?? [:]; journals[origin.rawValue] = journal; document.weeklyReportJournal = journals
                return packet
            }
            var prepared = try policy(family, .flush)
            try Self.applyReport(prepared, family: &family)
            if prepared.body == nil {
                prepared = try policy(family, .sync)
                try Self.applyReport(prepared, family: &family)
            }
            if let body = prepared.body {
                guard let context = prepared.context else { throw NativeFamilyReportError.invalidProjection }
                try Self.validateReportBody(body, family: family)
                journal.packet = .init(id: UUID(), origin: origin, body: body, context: context, preparedAt: now)
            }
            document.origins[origin.rawValue] = family
            var journals = document.weeklyReportJournal ?? [:]; journals[origin.rawValue] = journal; document.weeklyReportJournal = journals
            return journal.packet
        }
    }

    /// Consent is cleared and its off queue persisted even while an older
    /// request is in flight. A restart cannot resend that older active report.
    func queueWeeklyReportOff(origin: LegacyOrigin,
        policy: @Sendable (NativeFamilyOrigin, NativeFamilyReportAction) throws -> NativeFamilyReportMutation) throws {
        try change { document in
            guard document.primaryOrigin == origin, var family = document.origins[origin.rawValue] else { throw NativeFamilyReportError.wrongOrigin }
            let mutation = try policy(family, .queueOff(nil))
            guard mutation.body == nil else { throw NativeFamilyReportError.invalidProjection }
            try Self.applyReport(mutation, family: &family)
            document.origins[origin.rawValue] = family
        }
    }

    func weeklyReportMaySend(_ packet: NativeFamilyReportPacket) throws -> Bool {
        guard let document = try snapshot(), document.primaryOrigin == packet.origin,
              document.weeklyReportJournal?[packet.origin.rawValue]?.packet == packet,
              let family = document.origins[packet.origin.rawValue] else { return false }
        return (try? Self.validateReportBody(packet.body, family: family)) != nil
    }

    func acknowledgeWeeklyReport(_ packet: NativeFamilyReportPacket,
        policy: @Sendable (NativeFamilyOrigin) throws -> NativeFamilyReportMutation) throws {
        try change { document in
            guard var journal = document.weeklyReportJournal?[packet.origin.rawValue], journal.packet == packet,
                  var family = document.origins[packet.origin.rawValue] else { throw NativeFamilyReportError.changed }
            let mutation = try policy(family)
            guard mutation.body == nil else { throw NativeFamilyReportError.invalidProjection }
            try Self.applyReport(mutation, family: &family)
            journal.packet = nil
            var journals = document.weeklyReportJournal ?? [:]; journals[packet.origin.rawValue] = journal; document.weeklyReportJournal = journals
            document.origins[packet.origin.rawValue] = family
        }
    }
}

private extension NativeFamilyRepository {
    static func applyReport(_ mutation: NativeFamilyReportMutation, family: inout NativeFamilyOrigin) throws {
        let allowed = Set(family.slots.map { NativeFamilyOrigin.key(LegacyKeys.profile, $0) })
        guard Set(mutation.profilePatches.keys).isSubset(of: allowed) else { throw NativeFamilyReportError.invalidProjection }
        for (key, raw) in mutation.profilePatches {
            guard let patch = NativeFamilyOrigin.object(raw), var profile = NativeFamilyOrigin.object(family.storage[key]),
                  Set(patch.keys).isSubset(of: ["weeklyReport", "reportId"]) else { throw NativeFamilyReportError.invalidProjection }
            if let id = patch["reportId"] {
                let old = profile["reportId"] as? String
                let validOld = old?.range(of: "^[a-f0-9]{16}$", options: .regularExpression) != nil
                guard let id = id as? String, id.range(of: "^[a-f0-9]{16}$", options: .regularExpression) != nil,
                      !validOld || old == id else { throw NativeFamilyReportError.invalidProjection }
            }
            if let report = patch["weeklyReport"] {
                guard let number = report as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID(), !number.boolValue else {
                    throw NativeFamilyReportError.invalidProjection
                }
            }
            profile.merge(patch) { _, value in value }
            family.storage[key] = try NativeFamilyOrigin.json(profile)
        }
        if let raw = mutation.reportState {
            guard NativeFamilyOrigin.object(raw) != nil else { throw NativeFamilyReportError.invalidProjection }
            family.storage["sona.report.v1"] = raw
        }
    }

    static func reportAddress(_ raw: Any?) -> String? {
        guard let raw = raw as? String else { return nil }
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard value.utf8.count <= 120, value.range(of: "^[\\x21-\\x7e]+$", options: .regularExpression) != nil,
              value.range(of: "^[^@]+@[^@]+\\.[^@]+$", options: .regularExpression) != nil else { return nil }
        return value
    }

    static func reportConsentAddress(_ child: NativeFamilyChild) -> String? {
        let profile = NativeFamilyOrigin.object(child.profileJSON) ?? [:]
        guard NativeFamilyOrigin.isTrue(profile["weeklyReport"]) else { return nil }
        return reportAddress(profile["email"])
    }

    static func validateReportBody(_ data: Data, family: NativeFamilyOrigin) throws {
        guard data.count <= 4_000, let body = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              Set(body.keys).isSubset(of: ["email", "dev", "weeks", "quiet", "off", "on"]),
              let email = reportAddress(body["email"]), body["email"] as? String == email,
              let dev = body["dev"] as? String, dev.range(of: "^[a-f0-9]{32}$", options: .regularExpression) != nil,
              let weeks = body["weeks"] as? [[String: Any]], weeks.count == 2 else { throw NativeFamilyReportError.invalidPacket }
        let off = NativeFamilyOrigin.isTrue(body["off"]), quiet = NativeFamilyOrigin.isTrue(body["quiet"])
        for flag in ["off", "quiet", "on"] where body[flag] != nil {
            guard let number = body[flag] as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID(), number.boolValue else { throw NativeFamilyReportError.invalidPacket }
        }
        let state = NativeFamilyOrigin.object(family.storage["sona.report.v1"]) ?? [:]
        if off {
            var owed = state["offs"] as? [[String: Any]] ?? []
            if let old = state["offOwed"] as? [String: Any] { owed.append(old) }
            guard quiet, owed.contains(where: { $0["e"] as? String == email && $0["d"] as? String == dev }) else { throw NativeFamilyReportError.invalidPacket }
        } else {
            let consented = family.children.contains { reportConsentAddress($0) == email }
            guard consented, state["dev"] as? String == dev else { throw NativeFamilyReportError.invalidPacket }
        }
        let sounds: Set<String> = ["P","B","M","N","T","D","K","G","F","V","S","Z","SH","CH","J","L","R","TH","THV"]
        for week in weeks {
            guard Set(week.keys) == ["wk", "kids"], let date = week["wk"] as? String,
                  date.range(of: "^\\d{4}-\\d{2}-\\d{2}$", options: .regularExpression) != nil,
                  let kids = week["kids"] as? [[String: Any]], kids.count <= 8,
                  !(off || quiet) || kids.isEmpty else { throw NativeFamilyReportError.invalidPacket }
            for kid in kids {
                guard Set(kid.keys).isSubset(of: ["i","d","g","r","p","s","gw"]),
                      let id = kid["i"] as? String, id.range(of: "^[a-f0-9]{16}$", options: .regularExpression) != nil,
                      let practiceSounds = kid["s"] as? [String], Set(practiceSounds).isSubset(of: sounds)
                else { throw NativeFamilyReportError.invalidPacket }
                for name in ["d","g","r","p"] {
                    guard let n = kid[name] as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), n.doubleValue.isFinite,
                          n.doubleValue >= 0, n.doubleValue.rounded(.down) == n.doubleValue else { throw NativeFamilyReportError.invalidPacket }
                }
                if let plan = kid["gw"] { guard let n = plan as? Int, [3,4,5,7].contains(n) else { throw NativeFamilyReportError.invalidPacket } }
            }
        }
    }
}
