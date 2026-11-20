import Foundation
import CryptoKit

/// Origins are identities, not interchangeable host aliases. Never follow a redirect to read one.
public enum LegacyOrigin: String, Codable, CaseIterable, Sendable {
    case www = "https://www.speaksona.com"
    case app = "https://app.speaksona.com"
    case bare = "https://speaksona.com"
    case bundled = "capacitor://localhost"
}

public enum MigrationError: Error, Equatable, Sendable {
    case invalidCapture
    case wrongOrigin
    case unstableSource
    case unsupportedVersion
    case malformedRoster
    case missingProfile
    case unexpectedAudioPayload
    case duplicateOrigin
    case sourceChangedAfterImport
    case destinationCorrupt
    case verificationFailed
}

/// Intentionally has no public initializer or Decodable conformance. A pasted family
/// backup must never enter the same-device path and acquire device-only access marks.
public struct LegacySnapshot: Sendable {
    public let origin: LegacyOrigin
    public let storage: [String: String]

    init(origin: LegacyOrigin, storage: [String: String]) {
        self.origin = origin
        self.storage = storage
    }

    // Called only by the same-container WebKit reader. Not a backup-import API.
    static func decodeCapture(_ data: Data, expectedOrigin: LegacyOrigin) throws -> LegacySnapshot {
        struct CaptureFields: Decodable {
            let includesRecordings: Bool
            enum Key: String, CodingKey { case recordings }
            init(from decoder: Decoder) throws {
                includesRecordings = try decoder.container(keyedBy: Key.self).contains(.recordings)
            }
        }
        // Refuse the old audio-capture format without decoding any recordings.
        if let fields = try? JSONDecoder().decode(CaptureFields.self, from: data),
           fields.includesRecordings {
            throw MigrationError.unexpectedAudioPayload
        }
        struct Wire: Decodable {
            let schema: Int
            let origin: String
            let stable: Bool
            let storage: [String: String]
        }
        guard let wire = try? JSONDecoder().decode(Wire.self, from: data) else {
            throw MigrationError.invalidCapture
        }
        guard wire.schema == 1 else { throw MigrationError.unsupportedVersion }
        guard wire.origin == expectedOrigin.rawValue else { throw MigrationError.wrongOrigin }
        guard wire.stable else { throw MigrationError.unstableSource }
        return LegacySnapshot(origin: expectedOrigin, storage: wire.storage)
    }
}

public struct ImportedChild: Codable, Equatable, Sendable {
    /// Stable identity = origin + slot. Names are not identity; siblings can share names.
    public let slot: String
    public let keys: [String: String]

    public var profileJSON: String? { keys[LegacyKeys.profile] }
}

/// Every original key/value survives verbatim, including unknown future keys and
/// orphaned data. Only roster children are exposed; removed slots aren't resurrected.
public struct ImportedOrigin: Codable, Equatable, Sendable {
    public let origin: LegacyOrigin
    public let fingerprint: String
    public let storage: [String: String]
    public let children: [ImportedChild]
    public let activeSlot: String?
    public let slotHighWaterMark: Int
    public let hasOrphanedChildData: Bool
}

public enum LegacyKeys {
    public static let profile = "sona.profile.v1"
    public static let roster = "sona.kids.v1"
    // Mirrors PER_KID in public/sona.js. The contract check catches new entries.
    public static let perChild: Set<String> = [
        profile, "sona.progress.v1", "sona.rotation.v1", "sona.today.v1", "sona.episode.v2",
        "sona.reps.v1", "sona.day.v2", "sona.coinmint.v1", "sona.tickets.v1", "sona.charge.v1",
        "sona.daily.v1", "sona.session.v1", "sona.levels.v1", "sona.campaign.v1",
        "sona.stickers.v1", "sona.attempts.v1", "sona.outcomes.v1", "sona.gamereps.v1",
        "sona.goaldays.v1", "sona.lib.read.v1", "sona.feed.v1", "sona.call.v1",
        "sona.callhist.v1", "sona.games.v1", "sona.homework.v1", "sona.reclast",
        "sona.dino.v1", "sona.sprintintro.v1", "sona.quest.v1", "sona.bests.v1",
        "sona.trophy.v1", "sona.chest.v1", "sona.road.v1", "sona.playlevel.v1",
        "sona.board.v1", "sona.boardcache.v1", "sona.pilot.v1",
        "sona.firsts.v1", "sona.rocket.v1", "sona.stars.v1"
    ]

    static func parts(_ key: String) -> (base: String, slot: String) {
        let pieces = key.split(separator: "@", maxSplits: 1, omittingEmptySubsequences: false)
        return (String(pieces[0]), pieces.count == 2 ? String(pieces[1]) : "")
    }

    static func isOwned(_ key: String, by slot: String) -> Bool {
        if !slot.isEmpty { return key.hasSuffix("@\(slot)") }
        let identity = parts(key)
        return identity.slot.isEmpty && perChild.contains(identity.base)
    }

    static func slotNumber(_ slot: String) -> Int? {
        if slot.isEmpty { return 1 }
        guard slot.first == "k", let n = Int(slot.dropFirst()), n >= 2, slot == "k\(n)" else { return nil }
        return n
    }
}

enum SnapshotImporter {
    static func prepare(_ snapshot: LegacySnapshot) throws -> ImportedOrigin {
        // Do not normalize profiles, apply defaults, rerun pricing sweeps, mint
        // rewards or copy across origins here. That would change product behavior.
        guard snapshot.storage.keys.allSatisfy({ $0.hasPrefix("sona.") }) else {
            throw MigrationError.invalidCapture
        }
        let storage = snapshot.storage
        var slots: [String] = [], active: String?, high = 1
        if let raw = storage[LegacyKeys.roster] {
            struct Roster: Decodable {
                struct Child: Decodable { let slot: String }
                let list: [Child]; let active: String; let hi: Int?
            }
            guard let data = raw.data(using: .utf8), let roster = try? JSONDecoder().decode(Roster.self, from: data),
                  !roster.list.isEmpty else { throw MigrationError.malformedRoster }
            slots = roster.list.map(\.slot)
            guard Set(slots).count == slots.count, slots.allSatisfy({ LegacyKeys.slotNumber($0) != nil }),
                  slots.contains(roster.active), (roster.hi ?? 1) >= 1 else {
                throw MigrationError.malformedRoster
            }
            active = roster.active
            high = max(high, roster.hi ?? 1)
        } else if storage[LegacyKeys.profile] != nil {
            slots = [""]; active = ""
        }
        for slot in slots {
            let key = LegacyKeys.profile + (slot.isEmpty ? "" : "@\(slot)")
            guard let raw = storage[key], let data = raw.data(using: .utf8),
                  (try? JSONSerialization.jsonObject(with: data)) is [String: Any] else {
                throw MigrationError.missingProfile
            }
            high = max(high, LegacyKeys.slotNumber(slot) ?? 1)
        }
        var orphaned = false
        for key in storage.keys {
            let parts = LegacyKeys.parts(key)
            if key.contains("@"), let n = LegacyKeys.slotNumber(parts.slot) { high = max(high, n) }
            if LegacyKeys.perChild.contains(parts.base),
               !slots.contains(parts.slot) || key != parts.base + (parts.slot.isEmpty ? "" : "@\(parts.slot)") {
                orphaned = true
            }
        }
        let children = slots.map { slot in
            var keys: [String: String] = [:]
            for (key, value) in storage {
                let parts = LegacyKeys.parts(key)
                // Old pasted backups could contain a trailing "@". Keep it in
                // the archive, but never let that alias shadow the first child.
                let canonical = parts.base + (slot.isEmpty ? "" : "@\(slot)")
                if LegacyKeys.perChild.contains(parts.base), key == canonical { keys[parts.base] = value }
            }
            return ImportedChild(slot: slot, keys: keys)
        }
        // Stable bytes ignore dictionary enumeration order.
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        let canonical = try encoder.encode(storage)
        let digest = SHA256.hash(data: canonical).map { String(format: "%02x", $0) }.joined()
        return ImportedOrigin(origin: snapshot.origin, fingerprint: digest, storage: storage,
                              children: children,
                              activeSlot: active, slotHighWaterMark: high, hasOrphanedChildData: orphaned)
    }
}
