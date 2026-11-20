import Foundation
import Security
import SonaFamilyAccess
import SonaFamilyMigration
import SwiftUI

struct FamilyLibraryAccess {
    private static let configuration = try? FamilyAccessConfiguration.bundled()
    private static let policy = configuration.map(FamilyAccessPolicy.init)
    private let state: FamilyEntitlementState
    private let canSellHere: Bool
    private let now = Date()

    init(link: FamilyLink?, state: FamilyEntitlementState = .init(), canSellHere: Bool? = nil) {
        var merged = state
        if let link {
            merged.verifiedClinician = true
            if let checkedAt = link.coverageCheckedAt {
                merged.apply(.confirmed(active: link.covered), source: .clinician, at: checkedAt)
            }
        }
        self.state = merged
        self.canSellHere = canSellHere ?? false
    }
    var allowsStory: Bool { Self.policy?.story(state, at: now) ?? false }
    var allowsPractice: Bool { Self.policy?.practice(state, canSellHere: canSellHere, at: now) ?? false }
    var offersLockedContent: Bool { Self.policy?.offersLockedContent(state, canSellHere: canSellHere, at: now) ?? false }
    var premium: Bool { state.premium }
    var requiresTrialFirst: Bool { Self.policy?.requiresTrialFirst(state, canSellHere: canSellHere, at: now) ?? false }
    func allows(_ game: NativeGame) -> Bool {
        let shippingID = game == .sprint ? "run" : game.rawValue
        return Self.policy?.game(shippingID, state: state, canSellHere: canSellHere, at: now).allowed ?? false
    }
    func allowsBook(named title: String) -> Bool {
        Self.policy?.book(title, state: state, canSellHere: canSellHere, at: now) ?? false
    }
}

@MainActor
final class FamilyConnectionStore: ObservableObject {
    private struct SavedConnection: Codable {
        var owner: String?
        var link: FamilyLink
        var needsSharingChoice: Bool
        var homework: FamilyHomework?
        var homeworkKnown: Bool? = nil
        var consentDecisionAt: Date? = nil
    }
    private struct Binding { let owner: FamilyConnectionOwner; let childID: String }
    @Published private var saved: SavedConnection?
    @Published private(set) var change: FamilyConnectionChange?
    @Published private(set) var storageUnavailable = false
    private var pendingChanges: [FamilyConnectionChange] = []
    private let client: FamilyLoginClient
    private let defaults: UserDefaults
    private let storage: any FamilyConnectionStorage
    private var binding: Binding?
    @Published private var baseAccess = FamilyEntitlementState()
    @Published private var canSellHere = false
    private var userOperations = Set<String>()
    private var coverageOperations = Set<String>()
    private var homeworkSync: [String: Date] = [:]
    private var lastProgressSent: [String: Date] = [:]
    private var progressFlights: [String: (id: UUID, task: Task<Void, Error>)] = [:]

    var link: FamilyLink? { saved?.link }
    var needsSharingChoice: Bool { saved?.needsSharingChoice ?? false }
    var libraryAccess: FamilyLibraryAccess { FamilyLibraryAccess(link: link, state: baseAccess, canSellHere: canSellHere) }

    init(client: FamilyLoginClient = FamilyLoginClient(), defaults: UserDefaults = .standard,
         storage: (any FamilyConnectionStorage)? = nil) {
        self.client = client
        self.defaults = defaults
        self.storage = storage ?? FamilyKeychain()
        // No device-wide credential is read before the host names its owner.
    }

    func bind(child: NativeFamilyChild, household: NativeFamilyOrigin, isPreview: Bool,
              access: FamilyEntitlementState? = nil, canSellHere: Bool? = nil) {
        let owner = FamilyConnectionOwner(child: child.id, isPreview: isPreview, generation: UUID())
        guard child.id.origin == household.origin, household.slots.contains(child.id.slot) else {
            binding = nil; saved = nil; storageUnavailable = true; return
        }
        let merged = access ?? (binding?.owner.sameChild(as: owner) == true ? baseAccess : .init())
        if baseAccess != merged { baseAccess = merged }
        if let canSellHere, self.canSellHere != canSellHere { self.canSellHere = canSellHere }
        if binding?.owner.sameChild(as: owner) == true && !storageUnavailable { return }
        binding = nil
        saved = nil
        let archived = ArchivedFamilyConnection(child: child, household: household)
        do {
            var restored = try read(owner: owner)
            if restored == nil && owner.canReadOriginalPreview,
               let legacyData = try storage.read(account: "therapist-connection-v1") {
                let legacy = try JSONDecoder().decode(SavedConnection.self, from: legacyData)
                let oldID = defaults.string(forKey: "sona.preview.family.childID")
                let matchingID = archived.childID ?? oldID
                if matchingID == nil || matchingID == legacy.link.childID { restored = legacy }
            }
            let idKey = "sona.native.family.childID." + owner.account
            let candidate = archived.childID ?? restored?.link.childID ?? defaults.string(forKey: idKey)
            let childID = candidate.flatMap { ArchivedFamilyConnection.validChildID($0) ? $0 : nil }
                ?? UUID().uuidString.lowercased()
            if let restored, restored.link.childID != childID { throw FamilyConnectionError.storage }
            if restored == nil, let link = archived.link {
                restored = SavedConnection(owner: owner.account, link: link,
                                           needsSharingChoice: archived.requiresConsentRepair,
                                           homework: link.consentAt != nil ? archived.homework : nil)
            }
            if var restored {
                restored.owner = owner.account
                // A scoped, durable adult choice can be newer than the native
                // document after an interrupted handoff. Never roll Yes back
                // merely because that document still has an older No flag.
                if archived.sharingDeclined && restored.consentDecisionAt == nil && restored.link.consentAt == nil {
                    restored.homework = nil
                }
                try storage.write(JSONEncoder().encode(restored), account: owner.account)
                saved = restored
            }
            defaults.set(childID, forKey: idKey)
            binding = Binding(owner: owner, childID: childID)
            storageUnavailable = false
            if archived.childID == nil { emit(owner: owner, pilotPatch: ["childId": .string(childID)]) }
            // Reconcile durable scoped credentials after a host crash before its
            // repository acknowledged a prior handoff. No network call or enrollment.
            if let restored {
                var pilot: [String: FamilyJSONValue] = ["childId": .string(childID)]
                if let date = restored.link.consentAt {
                    pilot.merge(consentPatch(restored.link, date: date)) { _, new in new }
                }
                var profile: [String: FamilyJSONValue] = ["slpCode": .string(restored.link.code)]
                if !restored.needsSharingChoice { profile["slpShare"] = .bool(restored.link.consentAt != nil) }
                var household = credentialValues(restored.link)
                if let date = restored.link.coverageCheckedAt {
                    household["sona.caseplan.v1"] = try coverageJSON(restored.link, checkedAt: date)
                }
                let known = restored.homeworkKnown == true || restored.homework != nil
                    || (!restored.needsSharingChoice && restored.link.consentAt == nil)
                let childValues = known ? ["sona.homework.v1": try homeworkJSON(restored.homework)] : [:]
                emit(owner: owner, household: household, child: childValues, pilotPatch: pilot, profilePatch: profile)
            }
        } catch {
            // An inaccessible/corrupt scoped Keychain is a hold, never a fresh child.
            binding = nil; saved = nil; storageUnavailable = true
        }
    }

    func acknowledgeChange(_ id: UUID) {
        guard pendingChanges.first?.id == id else { return }
        pendingChanges.removeFirst()
        change = pendingChanges.first
    }

    func discardRemovedChild(_ child: NativeFamilyChildID, isPreview: Bool) throws {
        let owner = FamilyConnectionOwner(child: child, isPreview: isPreview, generation: UUID())
        let key = owner.account
        guard binding?.owner.sameChild(as: owner) != true, !userOperations.contains(key),
              !coverageOperations.contains(key), progressFlights[key] == nil else {
            progressFlights[key]?.task.cancel()
            throw FamilyConnectionError.ownerChanged
        }
        try storage.delete(account: key)
        pendingChanges.removeAll { $0.child == child && $0.isPreview == isPreview }
        change = pendingChanges.first
        homeworkSync.removeValue(forKey: key)
        lastProgressSent.removeValue(forKey: key)
    }
    func assignedHomework(on date: Date) -> FamilyHomework? {
        guard let saved, saved.link.consentAt != nil, !saved.needsSharingChoice,
              let assignment = saved.homework, assignment.isCurrent(on: date) else { return nil }
        return assignment
    }

    func signIn(username: String, password: String) async throws {
        let bound = try requireBinding()
        try beginUserOperation(bound.owner)
        defer { userOperations.remove(bound.owner.account) }
        let previous = try latest(owner: bound.owner)
        var fresh = try await client.login(username: username, password: password, childID: bound.childID)
        if let previous, previous.link.code == fresh.code, previous.link.childID == fresh.childID {
            fresh.covered = previous.link.covered
            fresh.coverageCheckedAt = previous.link.coverageCheckedAt
            fresh.consentAt = previous.link.consentAt
        }
        let homework = previous?.link.code == fresh.code ? previous?.homework : nil
        // Persist verification before asking separately about coverage.
        try save(SavedConnection(owner: bound.owner.account, link: fresh, needsSharingChoice: true, homework: homework,
                                 homeworkKnown: previous?.homeworkKnown, consentDecisionAt: previous?.consentDecisionAt), owner: bound.owner)
        emit(owner: bound.owner, household: credentialValues(fresh), pilotPatch: ["childId": .string(bound.childID)],
             profilePatch: ["slpCode": .string(fresh.code)])
        await refreshCoverage(owner: bound.owner, force: true)
    }

    func chooseSharing(_ share: Bool, snapshot: FamilyEnrollmentSnapshot? = nil) async throws {
        let bound = try requireBinding()
        guard let current = saved, current.needsSharingChoice else { return }
        if share && snapshot == nil { throw FamilyClientError.snapshotRequired }
        try beginUserOperation(bound.owner)
        defer { userOperations.remove(bound.owner.account) }
        let result = try await client.setSharing(current.link, consent: share ? .yes : .no, snapshot: share ? snapshot : nil)
        guard let latest = try latest(owner: bound.owner), sameCredential(latest.link, current.link, ticket: false) else { return }
        var updated = result.link
        updated.covered = latest.link.covered
        updated.coverageCheckedAt = latest.link.coverageCheckedAt
        updated.ticket = latest.link.ticket
        try save(SavedConnection(owner: bound.owner.account, link: updated, needsSharingChoice: false,
                                 homework: share ? latest.homework : nil,
                                 homeworkKnown: share ? latest.homeworkKnown : true, consentDecisionAt: Date()), owner: bound.owner)
        let pilot = share ? updated.consentAt.map { consentPatch(updated, date: $0) } ?? [:] : [:]
        emit(owner: bound.owner, child: share ? [:] : ["sona.homework.v1": try homeworkJSON(nil)],
             pilotPatch: pilot, profilePatch: ["slpCode": .string(updated.code), "slpShare": .bool(share)])
        if share { await refreshHomework(owner: bound.owner, force: true) }
    }

    func changePassword(current: String, replacement: String) async throws {
        let bound = try requireBinding()
        guard let link = saved?.link, !link.user.isEmpty else { throw FamilyConnectionError.notSignedIn }
        try beginUserOperation(bound.owner)
        defer { userOperations.remove(bound.owner.account) }
        try await client.changePassword(link, currentPassword: current, newPassword: replacement)
        guard binding?.owner.sameChild(as: bound.owner) == true else { throw FamilyConnectionError.ownerChanged }
    }

    func stopSharing() async throws {
        let bound = try requireBinding()
        guard let current = saved, current.link.consentAt != nil, !current.needsSharingChoice else { return }
        try beginUserOperation(bound.owner)
        defer { userOperations.remove(bound.owner.account) }
        _ = try await client.setSharing(current.link, consent: .no)
        guard var latest = try latest(owner: bound.owner), sameCredential(latest.link, current.link, ticket: false) else { return }
        latest.link.consentAt = nil
        latest.homework = nil
        latest.homeworkKnown = true
        latest.consentDecisionAt = Date()
        try save(latest, owner: bound.owner)
        // Shipping withdrawal keeps the consent record/ticket for access; this
        // explicit profile flag stops sends and the private assignment is cleared.
        emit(owner: bound.owner, child: ["sona.homework.v1": try homeworkJSON(nil)], profilePatch: ["slpShare": .bool(false)])
    }

    func refreshHomework(force: Bool = false) async {
        guard let bound = binding else { return }
        await refreshHomework(owner: bound.owner, force: force)
    }
    private func refreshHomework(owner: FamilyConnectionOwner, force: Bool) async {
        guard let current = try? latest(owner: owner), !current.needsSharingChoice, let consent = current.link.consentAt else { return }
        let now = Date()
        guard force || homeworkSync[owner.account].map({ now.timeIntervalSince($0) >= 3600 }) ?? true else { return }
        homeworkSync[owner.account] = now
        do {
            let assignment = try await client.fetchHomework(for: current.link)
            guard var latest = try latest(owner: owner), sameCredential(latest.link, current.link, ticket: true),
                  latest.link.consentAt == consent, !latest.needsSharingChoice else { return }
            latest.homework = assignment
            latest.homeworkKnown = true
            try save(latest, owner: owner)
            emit(owner: owner, child: ["sona.homework.v1": try homeworkJSON(assignment)])
        } catch { /* Keep this owner's current assignment through transport failure. */ }
    }

    func refreshCoverage() async {
        guard let bound = binding else { return }
        await refreshCoverage(owner: bound.owner, force: false)
    }

    /// The host calls this after storing a real practice attempt. An old child's
    /// callback cannot send a different child's snapshot after a selection change.
    @discardableResult
    func shareProgress(snapshot: FamilyEnrollmentSnapshot, owner: NativeFamilyChildID, manual: Bool = false) async -> Bool {
        guard let bound = binding, bound.owner.child == owner,
              !storageUnavailable, !userOperations.contains(bound.owner.account), progressFlights[bound.owner.account] == nil,
              let current = saved, !current.needsSharingChoice,
              current.link.consentAt != nil, !current.link.ticket.isEmpty else { return false }
        let key = bound.owner.account, now = Date()
        guard manual || (lastProgressSent[key].map({ now.timeIntervalSince($0) >= 60 }) ?? true) else { return false }
        // Like shipping sendProgress, a transport retry cannot exceed the minute.
        lastProgressSent[key] = now
        let id = UUID()
        let task = Task { try await client.sendProgress(current.link, snapshot: snapshot) }
        progressFlights[key] = (id, task)
        defer { if progressFlights[key]?.id == id { progressFlights.removeValue(forKey: key) } }
        do { try await task.value; return true }
        catch { return false } // Local practice survives any service failure.
    }
    private func refreshCoverage(owner: FamilyConnectionOwner, force: Bool) async {
        guard !coverageOperations.contains(owner.account), let current = try? latest(owner: owner) else { return }
        var state = FamilyEntitlementState()
        state.clinicianCheckedAt = current.link.coverageCheckedAt
        let due = (try? FamilyAccessConfiguration.bundled()).map {
            FamilyStoreCompatibility.clinicianRefreshDue(state: state, configuration: $0, at: Date())
        } ?? true
        guard force || due else { return }
        coverageOperations.insert(owner.account)
        defer { coverageOperations.remove(owner.account) }
        guard let checked = try? await client.checkCoverage(current.link),
              var latest = try? latest(owner: owner), sameCredential(latest.link, current.link, ticket: true) else { return }
        latest.link.covered = checked.covered
        latest.link.coverageCheckedAt = checked.coverageCheckedAt
        latest.link.ticket = checked.ticket
        do {
            try save(latest, owner: owner)
            emit(owner: owner, household: ["sona.caseplan.v1": try coverageJSON(checked, checkedAt: checked.coverageCheckedAt ?? Date()), "sona.slpticket": checked.ticket])
        } catch { /* Storage failure never applies a new unpersisted grant. */ }
    }

    private func requireBinding() throws -> Binding {
        guard !storageUnavailable, let binding else { throw FamilyConnectionError.storage }
        return binding
    }
    private func beginUserOperation(_ owner: FamilyConnectionOwner) throws {
        guard userOperations.insert(owner.account).inserted else { throw FamilyConnectionError.busy }
        // Stop/No blocks both a new send and an already waiting URLSession turn.
        progressFlights[owner.account]?.task.cancel()
    }
    private func read(owner: FamilyConnectionOwner) throws -> SavedConnection? {
        guard let data = try storage.read(account: owner.account) else { return nil }
        let value = try JSONDecoder().decode(SavedConnection.self, from: data)
        guard value.owner == owner.account, ArchivedFamilyConnection.validChildID(value.link.childID),
              !value.link.code.isEmpty, !value.link.ticket.isEmpty else { throw FamilyConnectionError.storage }
        return value
    }
    private func latest(owner: FamilyConnectionOwner) throws -> SavedConnection? {
        if binding?.owner.sameChild(as: owner) == true { return saved }
        return try read(owner: owner)
    }
    private func save(_ value: SavedConnection, owner: FamilyConnectionOwner) throws {
        var scoped = value
        scoped.owner = owner.account
        try storage.write(JSONEncoder().encode(scoped), account: owner.account)
        if binding?.owner.sameChild(as: owner) == true { saved = scoped }
    }
    private func credentialValues(_ link: FamilyLink) -> [String: String] {
        var values = ["sona.slp": link.code, "sona.slpok": link.code, "sona.slpunlock": "1", "sona.slpticket": link.ticket]
        if !link.user.isEmpty { values["sona.login"] = link.user }
        return values
    }
    private func sameCredential(_ a: FamilyLink, _ b: FamilyLink, ticket: Bool) -> Bool {
        a.code == b.code && a.childID == b.childID && (!ticket || a.ticket == b.ticket)
    }
    private func emit(owner: FamilyConnectionOwner, household: [String: String] = [:], child: [String: String] = [:],
                      pilotPatch: [String: FamilyJSONValue] = [:], profilePatch: [String: FamilyJSONValue] = [:]) {
        pendingChanges.append(FamilyConnectionChange(child: owner.child, isPreview: owner.isPreview, householdValues: household,
                                                     childValues: child, pilotPatch: pilotPatch, profilePatch: profilePatch))
        if change == nil { change = pendingChanges.first }
    }
    private func consentPatch(_ link: FamilyLink, date: Date) -> [String: FamilyJSONValue] {
        ["code": .string(link.code), "childId": .string(link.childID), "consent": .bool(true),
         "consentAt": .string(Self.isoString(date)), "ver": .number(1)]
    }
    private func homeworkJSON(_ assignment: FamilyHomework?) throws -> String {
        struct Wrapper: Encodable {
            let hw: FamilyHomework?; let at: Double
            enum CodingKeys: String, CodingKey { case hw, at }
            func encode(to encoder: Encoder) throws {
                var c = encoder.container(keyedBy: CodingKeys.self)
                try c.encode(hw, forKey: .hw)
                try c.encode(at, forKey: .at)
            }
        }
        return String(decoding: try JSONEncoder().encode(Wrapper(hw: assignment, at: Date().timeIntervalSince1970 * 1000)), as: UTF8.self)
    }
    private func coverageJSON(_ link: FamilyLink, checkedAt: Date) throws -> String {
        let data = try JSONSerialization.data(withJSONObject: ["active": link.covered, "code": link.code,
            "checked": checkedAt.timeIntervalSince1970 * 1000], options: [.sortedKeys])
        return String(decoding: data, as: UTF8.self)
    }
    private static func isoString(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}

private enum FamilyConnectionError: LocalizedError {
    case notSignedIn, storage, busy, ownerChanged
    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "Sign in with your family login first."
        case .storage: return "Sona couldn’t open this child’s connection on this phone. Please try again."
        case .busy: return "Please let the current connection finish first."
        case .ownerChanged: return "The selected child changed. Open their settings to continue."
        }
    }
}

private struct FamilyKeychain: FamilyConnectionStorage {
    private func identity(_ account: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "com.speaksona.family.native-preview",
         kSecAttrAccount as String: account, kSecAttrSynchronizable as String: false]
    }
    func read(account: String) throws -> Data? {
        var request = identity(account)
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &value)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = value as? Data else { throw FamilyConnectionError.storage }
        return data
    }
    func write(_ data: Data, account: String) throws {
        let status = SecItemUpdate(identity(account) as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecSuccess { return }
        guard status == errSecItemNotFound else { throw FamilyConnectionError.storage }
        var added = identity(account)
        added[kSecValueData as String] = data
        added[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        guard SecItemAdd(added as CFDictionary, nil) == errSecSuccess else { throw FamilyConnectionError.storage }
    }
    func delete(account: String) throws {
        let status = SecItemDelete(identity(account) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw FamilyConnectionError.storage }
    }
}
