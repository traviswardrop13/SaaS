import Foundation

/// A value the server may send as a string or a number (a child's age is
/// typed by a parent on one device and by a clinician on another).
struct Flex: Decodable, Hashable {
    let text: String
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let s = try? c.decode(String.self) { text = s }
        else if let i = try? c.decode(Int.self) { text = String(i) }
        else if let d = try? c.decode(Double.self) { text = String(Int(d)) }
        else { text = "" }
    }
}

struct Me: Decodable {
    let ok: Bool
    var email: String?
    var code: String?
    var name: String?
    var clinic: String?
}

struct DayStat: Decodable { var a: Int?; var p: Int? }
struct Outcome: Decodable {
    var attempts: Int?
    var passes: Int?
    var lastAt: String?
    var days: [String: DayStat]?
}
struct Homework: Decodable {
    var title: String?
    var sounds: [String]?
    var pos: String?
    var start: String?
    var due: String?
    var repsPerDay: Int?
}
struct HomeworkState: Decodable {
    var status: String?
    var hw: Homework?
    var days: [String: Int]?
}
struct ChildMeta: Decodable {
    var child: String?
    var age: Flex?
    var archived: Bool?
    var joinedAt: String?
}

/// One row of the caseload, as GET /api/slp returns it. The device's practice
/// row and the clinician's own notes ride side by side (see app/api/slp/route.ts).
struct Kid: Decodable, Identifiable {
    var childId: String
    var id: String { childId }
    var child: String?
    var age: Flex?
    var focus: String?
    var at: String?
    var synced: Bool?
    var outcomes: [String: Outcome]?
    var hw: HomeworkState?
    var meta: ChildMeta?
}

struct Invite: Decodable, Identifiable {
    var token: String
    var id: String { token }
    var label: String?
    var sounds: [String]?
    var createdAt: String?
    var expiresAt: String?
}

/// One odd row (a field of an unexpected type from an old device) is
/// skipped, never the whole caseload.
private struct Lossy<T: Decodable>: Decodable {
    let value: T?
    init(from decoder: Decoder) throws { value = try? T(from: decoder) }
}

struct Roster: Decodable {
    var kids: [Kid]
    var invites: [Invite]
    var configured: Bool?
    enum CodingKeys: String, CodingKey { case kids, invites, configured }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kids = (try c.decodeIfPresent([Lossy<Kid>].self, forKey: .kids) ?? []).compactMap(\.value)
        invites = (try c.decodeIfPresent([Lossy<Invite>].self, forKey: .invites) ?? []).compactMap(\.value)
        configured = try c.decodeIfPresent(Bool.self, forKey: .configured)
    }
}
