import Foundation
import CryptoKit
import SonaFamilyMigration

/// An on-device persistence handoff, never an analytics event. The host merges
/// patches into this exact origin/slot in its atomic native repository.
struct FamilyConnectionChange: Identifiable, Equatable {
    let id = UUID()
    let child: NativeFamilyChildID
    let isPreview: Bool
    let householdValues: [String: String]
    let childValues: [String: String]
    let pilotPatch: [String: FamilyJSONValue]
    let profilePatch: [String: FamilyJSONValue]
}

struct FamilyConnectionOwner: Equatable {
    let child: NativeFamilyChildID
    let isPreview: Bool
    let generation: UUID

    var account: String {
        let bytes = Data((child.origin.rawValue + "\n" + child.slot + "\n" + String(isPreview)).utf8)
        return "therapist-connection-v2-" + SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    }
    var canReadOriginalPreview: Bool { isPreview && child.origin == .app && child.slot.isEmpty }
    func sameChild(as other: Self) -> Bool { child == other.child && isPreview == other.isPreview }
}

/// Parses only same-device native repository values. No backup importer or
/// credential verification is exposed here; the server remains authoritative.
struct ArchivedFamilyConnection {
    let childID: String?
    let link: FamilyLink?
    let homework: FamilyHomework?
    let sharingDeclined: Bool
    let requiresConsentRepair: Bool

    init(child: NativeFamilyChild, household: NativeFamilyOrigin) {
        let pilot = Self.object(child.keys["sona.pilot.v1"])
        let profile = Self.object(child.profileJSON)
        let candidate = Self.string(pilot["childId"])
        childID = Self.validChildID(candidate) ? candidate : nil
        sharingDeclined = profile["slpShare"] == .bool(false)
        let consented = pilot["consent"] == .bool(true) && !sharingDeclined
        let consentDate = Self.date(Self.string(pilot["consentAt"]))
        requiresConsentRepair = consented && consentDate == nil
        homework = Self.homework(child.keys["sona.homework.v1"])

        let code = (household.storage["sona.slpok"] ?? "").isEmpty
            ? (household.storage["sona.slpunlock"] == "1" ? household.storage["sona.slp"] ?? "" : "")
            : household.storage["sona.slpok"] ?? ""
        let ticket = household.storage["sona.slpticket"] ?? ""
        guard let childID, !code.isEmpty, code.count <= 24,
              !ticket.isEmpty, ticket.utf8.count < 4096,
              Self.ticketCanBelong(ticket, code: code, childID: childID) else {
            link = nil
            return
        }
        let coverage = Self.object(household.storage["sona.caseplan.v1"])
        let sameCode = Self.string(coverage["code"]).uppercased() == code.uppercased()
        let checked: Date?
        if sameCode, case .number(let milliseconds) = coverage["checked"], milliseconds > 0, milliseconds.isFinite {
            checked = Date(timeIntervalSince1970: milliseconds / 1000)
        } else { checked = nil }
        let user = household.storage["sona.login"] ?? ""
        let validUser = user.count <= 24 && user.unicodeScalars.allSatisfy { CharacterSet.alphanumerics.contains($0) && $0.isASCII }
        link = FamilyLink(user: validUser ? user : "", clinician: "", code: code.uppercased(), ticket: ticket,
                          invite: "", childID: childID,
                          covered: sameCode && coverage["active"] == .bool(true), coverageCheckedAt: checked,
                          consentAt: consented ? consentDate : nil)
    }

    static func validChildID(_ value: String) -> Bool {
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-")
        return !value.isEmpty && value.count <= 48 && value.unicodeScalars.allSatisfy { allowed.contains($0) }
    }

    /// Read an unsigned routing hint only to reject an obvious sibling mismatch.
    /// It never proves a signature, grants Premium, or authorizes a server write.
    static func ticketCanBelong(_ token: String, code: String, childID: String) -> Bool {
        let parts = token.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 2, !parts[1].isEmpty else { return false }
        var body = String(parts[0]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        body += String(repeating: "=", count: (4 - body.count % 4) % 4)
        guard let data = Data(base64Encoded: body),
              let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              payload["t"] as? String == "enrol",
              (payload["code"] as? String)?.uppercased() == code.uppercased() else { return false }
        if let bound = payload["cid"] { return bound as? String == childID }
        return true // Legacy code-only tickets still need the server's ownership check.
    }

    static func object(_ raw: String?) -> [String: FamilyJSONValue] {
        guard let raw, let data = raw.data(using: .utf8) else { return [:] }
        return (try? JSONDecoder().decode([String: FamilyJSONValue].self, from: data)) ?? [:]
    }
    private static func string(_ value: FamilyJSONValue?) -> String { if case .string(let s) = value { return s }; return "" }
    private static func date(_ raw: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: raw) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: raw)
    }
    private static func homework(_ raw: String?) -> FamilyHomework? {
        struct Wrapper: Decodable { let hw: FamilyHomework? }
        guard let raw, let data = raw.data(using: .utf8) else { return nil }
        return (try? JSONDecoder().decode(Wrapper.self, from: data))?.hw
    }
}

/// Injectable for synthetic tests. Production uses device-only scoped Keychain
/// items; test implementations never need to touch the user's Keychain.
protocol FamilyConnectionStorage {
    func read(account: String) throws -> Data?
    func write(_ data: Data, account: String) throws
    func delete(account: String) throws
}
