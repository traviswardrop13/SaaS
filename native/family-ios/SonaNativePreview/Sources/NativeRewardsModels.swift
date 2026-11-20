import Foundation

/// A projection of the canonical shipping Sona policy, never a native reward ledger.
struct NativeRewardsSnapshot: Decodable, Equatable {
    let scope: String
    let road: NativeRewardRoadState
    let goal: NativeRewardDayGoal
    let stops: [NativeRewardStop]
    let stickers: [NativeRewardSticker]

    static func decode(_ data: Data) throws -> Self {
        let value = try JSONDecoder().decode(Self.self, from: data)
        try value.validate()
        return value
    }

    func validate() throws {
        guard !scope.isEmpty, road.trophies >= 0, road.coins >= 0, goal.n >= 0, goal.goal > 0,
              Set(stops.map(\.n)).count == stops.count,
              stops.allSatisfy({ $0.n > 0 && $0.at >= 0 }),
              Set(road.month.steps.map(\.n)).count == road.month.steps.count,
              Set(stickers.map(\.id)).count == stickers.count else { throw NativeRewardsDataError.invalidProjection }
    }
}

enum NativeRewardsDataError: Error { case invalidProjection }

struct NativeRewardRoadState: Decodable, Equatable {
    let trophies: Int
    let coins: Int
    let land: NativeRewardLand
    let stop: Int
    let next: NativeRewardStop
    let waiting: Int
    let lowestWaiting: Int?
    let month: NativeRewardMonth
    let chest: NativeRewardChest
    let rolled: [NativeRewardRolledMonth]
}

struct NativeRewardLand: Decodable, Equatable {
    let id: String
    let name: String
    let art: String
}

struct NativeRewardDayGoal: Decodable, Equatable {
    let n: Int
    let goal: Int
    let done: Bool
}

struct NativeRewardChest: Decodable, Equatable {
    let ready: Bool
    let opened: Bool
    let big: Bool
    let coins: Int
    let sticker: Bool
    let openedBig: Bool
}

struct NativeRewardMonth: Decodable, Equatable {
    let ym: String
    let name: String
    let count: Int
    let steps: [NativeRewardStop]
}

struct NativeRewardRolledMonth: Decodable, Equatable {
    let m: String
    let gifts: [NativeRewardGift]
}

struct NativeRewardStop: Decodable, Equatable, Identifiable {
    let n: Int
    let at: Int
    let gift: [NativeRewardGift]
    let big: Bool
    let reached: Bool
    let got: Bool
    var id: Int { n }
    var canOpen: Bool { reached && !got }

    enum CodingKeys: String, CodingKey { case n, at, gift, big, reached, got }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        n = try c.decode(Int.self, forKey: .n)
        at = try c.decode(Int.self, forKey: .at)
        gift = try c.decode([NativeRewardGift].self, forKey: .gift)
        big = try c.decodeIfPresent(Bool.self, forKey: .big) ?? false
        // Sona.roadState().next has no flags. Absence never becomes permission.
        reached = try c.decodeIfPresent(Bool.self, forKey: .reached) ?? false
        got = try c.decodeIfPresent(Bool.self, forKey: .got) ?? false
    }
}

/// Authored gift promises. A numeric sticker here means an unspecified future
/// sticker. It is distinct from an actual grant's string sticker ID below.
struct NativeRewardGift: Decodable, Equatable {
    let coins: Int?
    let sticker: Int?
    let level: Int?
    let land: String?
    let buddy: String?
    let hat: String?
    let place: String?
    let name: String?

    var label: String {
        if let coins { return "\(coins) coins" }
        if sticker != nil { return "A sticker" }
        if let level { return "Level \(level) in every game" }
        if let name, !name.isEmpty { return name }
        if buddy != nil { return "A buddy" }
        if hat != nil { return "A hat" }
        if place != nil { return "A place" }
        if land != nil { return "A new land" }
        return "Gift details unavailable"
    }
}

struct NativeRewardSticker: Decodable, Equatable, Identifiable {
    let id: String
    let name: String
    let e: String
    let earned: Bool
}

/// These fields match actual _roadGive/_grantSticker/chestOpen results. The UI
/// does not convert promises to grants or decide any duplicate-item payment.
struct NativeRewardGrant: Decodable, Equatable {
    struct Item: Decodable, Equatable {
        let kind: String
        let id: String
        let name: String
    }
    struct Alternative: Decodable, Equatable {
        let kind: String
        let id: String
        let name: String
        let coins: Int
    }

    let coins: Int?
    let sticker: String?
    let name: String?
    let level: Int?
    let land: String?
    let item: Item?
    let alt: Alternative?
    let full: Bool?

    var hasGiftDetails: Bool {
        if let coins, coins > 0 { return true }
        if let alt, alt.coins > 0 { return true }
        if let item, !item.id.isEmpty && !item.name.isEmpty { return true }
        if let sticker, !sticker.isEmpty { return true }
        if let level, level > 0 { return true }
        if let land, !land.isEmpty { return true }
        return false
    }

    var message: String {
        if let alt { return "You have this one! Here are \(alt.coins) coins!" }
        if let item {
            if item.kind == "characters" { return "\(item.name) joined you!" }
            if item.kind == "outfits" { return "You got the \(item.name)!" }
            return "You got \(item.name)!"
        }
        if full == true, let coins { return "Your sticker book is full! Here are \(coins) coins!" }
        if sticker != nil { return "You found the \(name ?? "new") sticker!" }
        if let level { return "Level \(level) is open!" }
        if let land { return land == "champ" ? "You reached the Champion Trail!" : "Welcome to \(name ?? "a new land")!" }
        if let coins { return "+\(coins) coins!" }
        return "Gift details couldn’t load."
    }
}

struct NativeRewardsRequest: Encodable, Equatable {
    enum Action: Equatable {
        case settle
        case openRoad(Int)
        case openMonth(Int)
        case openChest
        case markRolledSeen
    }
    let scope: String
    let action: Action

    var method: String {
        switch action {
        case .settle: return "roadSettle"
        case .openRoad: return "roadOpen"
        case .openMonth: return "monthOpen"
        case .openChest: return "chestOpen"
        case .markRolledSeen: return "roadRolledSeen"
        }
    }
    var number: Int? {
        switch action {
        case .openRoad(let n), .openMonth(let n): return n
        default: return nil
        }
    }

    enum CodingKeys: String, CodingKey { case scope, method, n }
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(scope, forKey: .scope)
        try c.encode(method, forKey: .method)
        try c.encodeIfPresent(number, forKey: .n)
    }
}

struct NativeRewardsUpdate: Decodable, Equatable {
    let accepted: Bool
    let snapshot: NativeRewardsSnapshot
    let gifts: [NativeRewardGrant]
    let reason: String?

    static func decode(_ data: Data) throws -> Self {
        let value = try JSONDecoder().decode(Self.self, from: data)
        // Use the same projection checks even when decoding a bridge update.
        try value.snapshot.validate()
        guard value.accepted || value.gifts.isEmpty,
              value.gifts.allSatisfy(\.hasGiftDetails) else { throw NativeRewardsDataError.invalidProjection }
        return value
    }
}

typealias NativeRewardsPerformer = @MainActor (NativeRewardsRequest) async throws -> NativeRewardsUpdate
