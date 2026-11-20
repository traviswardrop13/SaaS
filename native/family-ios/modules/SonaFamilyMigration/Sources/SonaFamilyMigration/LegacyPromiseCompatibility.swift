import Foundation
import CoreFoundation

/// A derived copy of trusted same-device evidence after the shipping promise
/// sweeps. This is not a backup importer, purchase verifier or pricing policy.
/// The original capture stays immutable; persist neither this result nor a
/// completion mark until the host's native-data transaction is ready.
public struct LegacyPromiseCompatibility: Sendable {
    public let storage: [String: String]
    public let hasFreeEraPromise: Bool
    public let hasFoundingPromise: Bool
    public let keepsFreeVersion: Bool
    public let keepsLegacyBuddies: Bool

    // Internal on purpose: callers obtain trusted evidence through ImportedOrigin,
    // not a pasted dictionary that can manufacture missing first-load stamps.
    static func evaluate(storage original: [String: String]) -> LegacyPromiseCompatibility {
        var copy = PromiseStorage(values: original)
        // public/sona.js's boot order is material: era two reads era one's result.
        copy.eraOne()
        copy.eraTwo()
        copy.onboardedEra(stamp: "sona.freeera3.v1", mark: "freeEra3")
        copy.eraFour()
        copy.onboardedEra(stamp: "sona.freeera5.v1", mark: "freeEra5")
        copy.keepFreeVersion()
        copy.keepBuddies()
        return LegacyPromiseCompatibility(storage: copy.values,
            hasFreeEraPromise: copy.earlyAdopterAnyKid(),
            hasFoundingPromise: copy.foundingPilot(),
            keepsFreeVersion: copy.values["sona.freever.v1"] == "kept",
            keepsLegacyBuddies: copy.values["sona.buddyset.v1"] != "post")
    }
}

public extension ImportedOrigin {
    /// Evaluate only this captured origin. Never combine another origin's stamps
    /// with this one's profiles, and never feed ordinary family backups here.
    func evaluatingLegacyPromises() -> LegacyPromiseCompatibility {
        LegacyPromiseCompatibility.evaluate(storage: storage)
    }
}

private struct PromiseStorage {
    var values: [String: String]
    private let profile = "sona.profile.v1", roster = "sona.kids.v1"
    private let era = "sona.freeera.v1"
    private let legacy: [String: [String]] = [
        "characters": ["fox", "bunny", "dragon", "cat", "bee", "octopus", "dino", "panda"],
        "outfits": ["none", "crown", "tophat", "cap", "shades", "bow", "party"],
        "backdrops": ["sky", "jungle", "forest", "mountain", "space", "beach"]
    ]

    private func key(_ base: String, _ slot: String) -> String { slot.isEmpty ? base : base + "@" + slot }
    private func parsed(_ raw: String?) -> Any? {
        guard let raw, let data = raw.data(using: .utf8) else { return nil }
        return try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
    }
    private func object(_ key: String) -> [String: Any]? { parsed(values[key]) as? [String: Any] }
    private func truthy(_ value: Any?) -> Bool {
        guard let value, !(value is NSNull) else { return false }
        if let text = value as? String { return !text.isEmpty }
        if let number = value as? NSNumber { return number.doubleValue != 0 }
        return true // JavaScript arrays and objects, including empty ones, are truthy.
    }
    private func jsString(_ value: Any?) -> String {
        guard let value else { return "undefined" }
        if value is NSNull { return "null" }
        if let value = value as? String { return value }
        if let value = value as? NSNumber {
            if CFGetTypeID(value) == CFBooleanGetTypeID() { return value.boolValue ? "true" : "false" }
            return value.stringValue
        }
        if let list = value as? [Any] {
            return list.map { $0 is NSNull ? "" : jsString($0) }.joined(separator: ",")
        }
        return "[object Object]"
    }
    private func property(_ value: Any, _ name: String) -> Any? { (value as? [String: Any])?[name] }
    private func isSetUp(_ value: Any?) -> Bool {
        guard let value else { return false }
        return truthy(property(value, "onboarded")) || truthy(property(value, "childName"))
    }
    private mutating func write(_ object: Any, at key: String) {
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys, .fragmentsAllowed]),
              let text = String(data: data, encoding: .utf8) else { return }
        values[key] = text
    }
    private func stamped(_ key: String) -> Bool { !(values[key] ?? "").isEmpty }

    // The sweeps' inline roster reader falls back to the original slot if the
    // map throws. The read-only entitlement readers instead stop on a bad row.
    private func entries() -> [Any] {
        guard let list = object(roster)?["list"] as? [Any], !list.isEmpty else { return [["slot": ""]] }
        return list
    }
    private func sweepSlots() -> [String] {
        var result: [String] = []
        for entry in entries() {
            if entry is NSNull { return [""] }
            let slot = property(entry, "slot")
            result.append(truthy(slot) ? jsString(slot) : "")
        }
        return result
    }
    private mutating func markSetUp(_ slot: String, _ mark: String?) -> Bool {
        let target = key(profile, slot)
        guard let value = parsed(values[target]), isSetUp(value), var child = value as? [String: Any] else { return false }
        child["earlyAdopter"] = true; child["freeEra"] = true
        if let mark { child[mark] = true }
        write(child, at: target)
        return true
    }
    mutating func eraOne() {
        guard !stamped(era) else { return }
        let pre = isSetUp(parsed(values[profile]))
        values[era] = pre ? "grandfathered" : "post"
        if pre { _ = markSetUp("", nil) }
    }
    mutating func eraTwo() {
        let stamp = "sona.freeera2.v1"
        guard !stamped(stamp) else { return }
        values[stamp] = "done"
        guard values[era] == "post" else { return }
        var any = false
        for slot in sweepSlots() { if markSetUp(slot, "freeEra2") { any = true } }
        if any { values[era] = "grandfathered" }
    }
    mutating func onboardedEra(stamp: String, mark: String) {
        guard !stamped(stamp) else { return }
        values[stamp] = "done"
        var any = false
        for slot in sweepSlots() { if markSetUp(slot, mark) { any = true } }
        if any { values[era] = "grandfathered" }
    }
    mutating func eraFour() {
        let stamp = "sona.freeera4.v1"
        guard !stamped(stamp) else { return }
        values[stamp] = "done"
        let slots = sweepSlots()
        let onboarded = slots.contains { isSetUp(parsed(values[key(profile, $0)])) }
        let redeemed = values["sona.slpunlock"] == "1" || stamped("sona.slpok")
        guard onboarded || redeemed else { return }
        for slot in slots {
            let target = key(profile, slot), value = parsed(values[target])
            // Arrays satisfy JS's typeof-object check; assigned named properties
            // aren't emitted by JSON.stringify, so preserve their array contents.
            if let array = value as? [Any] { write(array, at: target); continue }
            var child = value as? [String: Any] ?? [:]
            child["earlyAdopter"] = true; child["freeEra"] = true; child["freeEra4"] = true
            write(child, at: target)
        }
        values[era] = "grandfathered"
    }
    mutating func keepFreeVersion() {
        let stamp = "sona.freever.v1"
        guard !stamped(stamp) else { return }
        values[stamp] = sweepSlots().contains { isSetUp(parsed(values[key(profile, $0)])) } ? "kept" : "post"
    }
    mutating func keepBuddies() {
        let stamp = "sona.buddyset.v1"
        guard !stamped(stamp) else { return }
        var setUp = false
        for slot in sweepSlots() {
            let target = key(profile, slot)
            guard var child = object(target), isSetUp(child) else { continue }
            setUp = true
            var owned = child["owned"] as? [String: Any] ?? [:]
            for (kind, ids) in legacy {
                var have = owned[kind] as? [Any] ?? []
                for id in ids where !have.contains(where: { ($0 as? String) == id }) { have.append(id) }
                owned[kind] = have
            }
            child["owned"] = owned; write(child, at: target)
        }
        values[stamp] = setUp ? "kept" : "post"
    }
    func earlyAdopterAnyKid() -> Bool {
        for entry in entries() {
            if entry is NSNull { return false }
            let slot = property(entry, "slot"), target = key(profile, truthy(slot) ? jsString(slot) : "")
            guard let raw = values[target], !raw.isEmpty else { continue }
            // Its original outer try/catch aborts the whole scan at invalid JSON
            // or null; skipping a broken earlier child would widen the grant.
            guard let value = parsed(raw), !(value is NSNull) else { return false }
            if truthy(property(value, "earlyAdopter")) { return true }
        }
        return false
    }
    func foundingPilot() -> Bool {
        if let value = parsed(values["sona.founding.v1"]), truthy(value) {
            let code = property(value, "code")
            if jsString(truthy(code) ? code : "").hasPrefix("ff-") { return true }
        }
        for entry in entries() {
            if entry is NSNull { return false }
            let slot = property(entry, "slot"), target = key("sona.pilot.v1", truthy(slot) ? jsString(slot) : "")
            guard let raw = values[target], !raw.isEmpty else { continue }
            guard let value = parsed(raw) else { return false }
            let code = property(value, "code")
            if truthy(value), truthy(property(value, "consent")),
               jsString(truthy(code) ? code : "").hasPrefix("ff-") { return true }
        }
        return false
    }
}
