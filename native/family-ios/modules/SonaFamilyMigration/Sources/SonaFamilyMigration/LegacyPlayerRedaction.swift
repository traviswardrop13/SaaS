import Foundation

/// Removes an explicitly deleted player's old local records using the original
/// origin and slot. Other families and the household's access remain intact.
enum LegacyPlayerRedaction {
    static func redactUndo(_ source: String, child: NativeFamilyChildID) throws -> String {
        guard var object = NativeFamilyOrigin.object(source) else { throw MigrationError.invalidCapture }
        let hasEnvelope = object["data"] != nil
        let entries = hasEnvelope ? object["data"] as? [String: Any] : object
        guard let entries else { throw MigrationError.invalidCapture }
        let selected = entries.filter { $0.key.hasPrefix("sona.") }
        guard let storage = selected as? [String: String] else { throw MigrationError.invalidCapture }
        let cleaned = try redact(storage, child: child)
        guard cleaned != storage else { return source }
        var other = entries.filter { !$0.key.hasPrefix("sona.") }
        for (key, value) in cleaned { other[key] = value }
        if hasEnvelope { object["data"] = other }
        else { object = other }
        return try NativeFamilyOrigin.json(object)
    }

    static func redact(_ storage: [String: String], child: NativeFamilyChildID) throws -> [String: String] {
        let current = try SnapshotImporter.prepare(.init(origin: child.origin, storage: storage))
        var result = storage
        for key in storage.keys where LegacyKeys.isOwned(key, by: child.slot) {
            result.removeValue(forKey: key)
        }
        guard result != storage || current.children.contains(where: { $0.slot == child.slot }) else { return result }

        let survivors = current.children.filter { $0.slot != child.slot }.map(\.slot)
        if var roster = NativeFamilyOrigin.object(storage[LegacyKeys.roster]),
           let rows = roster["list"] as? [[String: Any]] {
            if survivors.isEmpty {
                result.removeValue(forKey: LegacyKeys.roster)
            } else {
                roster["list"] = rows.filter { ($0["slot"] as? String) != child.slot }
                roster["active"] = survivors.contains(current.activeSlot ?? "") ? current.activeSlot : survivors.first
                roster["hi"] = current.slotHighWaterMark
                result[LegacyKeys.roster] = try NativeFamilyOrigin.json(roster)
            }
        }
        if current.evaluatingLegacyPromises().hasFreeEraPromise,
           !LegacyPromiseCompatibility.evaluate(storage: result).hasFreeEraPromise {
            for slot in survivors {
                let key = NativeFamilyOrigin.key(LegacyKeys.profile, slot)
                guard var profile = NativeFamilyOrigin.object(result[key]) else { throw MigrationError.missingProfile }
                profile["earlyAdopter"] = true
                result[key] = try NativeFamilyOrigin.json(profile)
            }
        }
        let pilotKey = NativeFamilyOrigin.key("sona.pilot.v1", child.slot)
        if result["sona.founding.v1"] == nil, let pilot = NativeFamilyOrigin.object(storage[pilotKey]),
           NativeFamilyOrigin.isTrue(pilot["consent"]), let code = pilot["code"] as? String, code.hasPrefix("ff-") {
            result["sona.founding.v1"] = try NativeFamilyOrigin.json(["code": code, "at": ISO8601DateFormatter().string(from: Date())])
        }
        return result
    }
}
