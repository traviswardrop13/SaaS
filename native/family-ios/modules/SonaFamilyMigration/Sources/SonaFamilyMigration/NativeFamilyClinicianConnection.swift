import Foundation

public extension NativeFamilyRepository {
    /// Project the connection owner's verified server responses into the
    /// exact household and child fields read by the original practice rules.
    /// A completed request may be applied after switching to another child.
    func applyClinicianConnection(owner: NativeFamilyChildID, household: [String: String], child: [String: String],
                                  pilotPatch: Data, profilePatch: Data) throws {
        let householdKeys = Set(["sona.slp", "sona.slpok", "sona.slpunlock", "sona.slpticket", "sona.login", "sona.caseplan.v1"])
        let childKeys = Set(["sona.homework.v1"])
        guard Set(household.keys).isSubset(of: householdKeys), Set(child.keys).isSubset(of: childKeys),
              let pilot = try JSONSerialization.jsonObject(with: pilotPatch) as? [String: Any],
              let profile = try JSONSerialization.jsonObject(with: profilePatch) as? [String: Any],
              Set(pilot.keys).isSubset(of: ["code", "childId", "consent", "consentAt", "ver"]),
              Set(profile.keys).isSubset(of: ["slpShare", "slpCode"]) else {
            throw NativeFamilyRuleError.invalidKey
        }
        try change { document in
            guard var origin = document.origins[owner.origin.rawValue], origin.slots.contains(owner.slot) else {
                throw NativeFamilyRepositoryError.childNotFound
            }
            for (key, value) in household { origin.storage[key] = value }
            for (key, value) in child { origin.storage[NativeFamilyOrigin.key(key, owner.slot)] = value }
            for (base, patch) in [("sona.pilot.v1", pilot), (LegacyKeys.profile, profile)] where !patch.isEmpty {
                let key = NativeFamilyOrigin.key(base, owner.slot)
                let fields = NativeFamilyOrigin.object(origin.storage[key]) ?? [:]
                origin.storage[key] = try NativeFamilyOrigin.json(fields.merging(patch) { _, incoming in incoming })
            }
            document.origins[owner.origin.rawValue] = origin
        }
    }
}
