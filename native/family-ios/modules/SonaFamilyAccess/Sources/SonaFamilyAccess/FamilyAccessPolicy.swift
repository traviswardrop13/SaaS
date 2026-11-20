import Foundation
import CoreFoundation
import SonaFamilyMigration

/// Exported from public/sona.js, including the switches. Regenerate with
/// tools/export-family-access.mjs; never type a price or free-day offer here.
public struct FamilyAccessConfiguration: Codable, Sendable {
    public var version: Int
    public var sourceSHA256: String
    public var freeMode: Bool
    public var webSales: Bool
    public var freeBooks: [String]
    public var games: [FamilyCatalogGame]
    public var storyKeys: [String]
    public var products: FamilyStoreProducts
    public var entitlement: String
    public var sellYearly: Bool
    public var localTrialFallbackDays: Double
    public var demoWindowSeconds: TimeInterval
    public var rotationLength: Int
    public var appleRecheckSeconds: TimeInterval
    public var clinicianRecheckSeconds: TimeInterval

    public static func bundled() throws -> Self {
        guard let url = Bundle.module.url(forResource: "FamilyAccessCatalog", withExtension: "json") else {
            throw FamilyAccessError.invalidConfiguration
        }
        return try decode(Data(contentsOf: url))
    }

    public static func decode(_ data: Data) throws -> Self {
        let value = try JSONDecoder().decode(Self.self, from: data)
        guard value.version == 1, value.rotationLength > 0,
              value.localTrialFallbackDays > 0, value.demoWindowSeconds > 0,
              Set(value.games.map(\.id)).count == value.games.count else {
            throw FamilyAccessError.invalidConfiguration
        }
        return value
    }
}

public struct FamilyCatalogGame: Codable, Sendable {
    public var id: String
    public var tier: FamilyGameTier
    public var available: Bool
    public var parked: Bool
}
public enum FamilyGameTier: String, Codable, Sendable { case free, premium }
public enum FamilyAccessError: Error { case invalidConfiguration }

/// Independent sources matter: an Apple expiry may never clear a founding
/// promise, a web subscription or the clinician's separate coverage.
public enum FamilyPremiumGrant: String, Codable, CaseIterable, Sendable {
    case founder, freeEra, foundingFamily, apple, stripe, legacySubscription, clinicianCoverage
}

public struct FamilyEntitlementState: Codable, Equatable, Sendable {
    public var grants: Set<FamilyPremiumGrant> = []
    public var keepsFreeVersion = false
    public var verifiedClinician = false
    public var localTrialEnd: Date?
    public var stripeAccount: String?
    public var appleCheckedAt: Date?
    public var clinicianCheckedAt: Date?
    public var legacyDemoStarted: Date?
    public var legacyDemoFinished = false

    public init() {}
    public var premium: Bool { !grants.isEmpty }
    public func trialActive(at date: Date) -> Bool { localTrialEnd.map { date < $0 } ?? false }

    /// Use the migration module's trusted, same-device promise evaluation.
    /// This has no ordinary-backup dictionary initializer and reruns no sweeps.
    public static func legacy(_ promises: LegacyPromiseCompatibility, configuration: FamilyAccessConfiguration) -> Self {
        var result = Self()
        if promises.hasFreeEraPromise { result.grants.insert(.freeEra) }
        if promises.hasFoundingPromise { result.grants.insert(.foundingFamily) }
        result.keepsFreeVersion = promises.keepsFreeVersion
        let storage = promises.storage
        if storage["sona.founder"] == "1" { result.grants.insert(.founder) }
        result.verifiedClinician = storage["sona.slpunlock"] == "1" || !(storage["sona.slpok"] ?? "").isEmpty
        if let sub = object(storage["sona.sub.v1"]), truthy(sub["active"]) {
            switch sub["source"] as? String {
            case "apple": result.grants.insert(.apple)
            case "stripe": result.grants.insert(.stripe)
            default: result.grants.insert(.legacySubscription)
            }
            result.stripeAccount = sub["email"] as? String
        }
        if let plan = object(storage["sona.caseplan.v1"]), strictTrue(plan["active"]) {
            result.grants.insert(.clinicianCoverage)
        }
        if let trial = object(storage["sona.trial.v1"]), let start = number(trial["start"]), start != 0 {
            let days = number(trial["days"]).flatMap { $0 == 0 ? nil : $0 } ?? configuration.localTrialFallbackDays
            result.localTrialEnd = Date(timeIntervalSince1970: start / 1000 + days * 86400)
        }
        if let check = storage["sona.iapcheck.v1"].flatMap(Double.init), check > 0 {
            result.appleCheckedAt = Date(timeIntervalSince1970: check / 1000)
        }
        if let plan = object(storage["sona.caseplan.v1"]), let checked = number(plan["checked"]), checked > 0 {
            result.clinicianCheckedAt = Date(timeIntervalSince1970: checked / 1000)
        }
        if let demo = object(storage["sona.demo.v1"]) {
            if let start = number(demo["started"]), start != 0 { result.legacyDemoStarted = Date(timeIntervalSince1970: start / 1000) }
            result.legacyDemoFinished = truthy(demo["done"])
        }
        return result
    }

    /// Only confirmed service answers may revoke their own grant. A failure
    /// changes neither access nor the last successful check's clock.
    public mutating func apply(_ answer: FamilyVerification, source: FamilyVerifiedSource, at now: Date) {
        guard case .confirmed(let active) = answer else { return }
        switch source {
        case .apple:
            appleCheckedAt = now
            if active { grants.insert(.apple) } else { grants.remove(.apple) }
        case .clinician:
            clinicianCheckedAt = now
            if active { grants.insert(.clinicianCoverage) } else { grants.remove(.clinicianCoverage) }
        case .stripe(let account):
            if active {
                stripeAccount = account
                grants.insert(.stripe)
            } else if let stripeAccount, stripeAccount.lowercased() == account.lowercased() {
                grants.remove(.stripe)
            }
        }
    }

    private static func object(_ raw: String?) -> [String: Any]? {
        guard let data = raw?.data(using: .utf8) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }
    private static func truthy(_ value: Any?) -> Bool {
        guard let value, !(value is NSNull) else { return false }
        if let text = value as? String { return !text.isEmpty }
        if let number = value as? NSNumber { return number.doubleValue != 0 }
        return true
    }
    private static func strictTrue(_ value: Any?) -> Bool {
        guard let value = value as? NSNumber, CFGetTypeID(value) == CFBooleanGetTypeID() else { return false }
        return value.boolValue
    }
    private static func number(_ value: Any?) -> Double? {
        if let number = value as? NSNumber { return number.doubleValue.isFinite ? number.doubleValue : nil }
        if let text = value as? String, let number = Double(text), number.isFinite { return number }
        return nil
    }
}

public enum FamilyVerification: Equatable, Sendable { case confirmed(active: Bool), unavailable }
public enum FamilyVerifiedSource: Equatable, Sendable { case apple, clinician, stripe(account: String) }
public enum FamilyAccessReason: String, Codable, Sendable {
    case free, freeMode, entitled, trial, earned, run, completed, premium, parked, unknown
}
public struct FamilyAccessDecision: Equatable, Sendable {
    public let allowed: Bool
    public let reason: FamilyAccessReason
}

/// A validated, in-memory earned run. Do not persist it as a subscription or
/// reconstruct it from a URL; it is limited to the already-authorized sitting.
public struct FamilySavedRun: Equatable, Sendable {
    public let games: [String]
    public let round: Int
    public let pending: Bool
    public let readyRound: Int?
    public let completedRound: Int?

    public init?(games: [String], round: Int, pending: Bool, readyRound: Int? = nil,
                 completedRound: Int? = nil, configuration: FamilyAccessConfiguration) {
        let released = Set(configuration.games.filter { $0.available && !$0.parked }.map(\.id))
        guard games.count == configuration.rotationLength, games.allSatisfy(released.contains),
              (0...games.count).contains(round) else { return nil }
        self.games = games; self.round = round; self.pending = pending
        self.readyRound = readyRound; self.completedRound = completedRound
    }
}

public struct FamilyGamePermission: Sendable {
    public var earnedGameID: String?
    public var run: FamilySavedRun?
    public init(earnedGameID: String? = nil, run: FamilySavedRun? = nil) {
        self.earnedGameID = earnedGameID; self.run = run
    }
    public static let library = Self()
}

public struct FamilyAccessPolicy: Sendable {
    public let configuration: FamilyAccessConfiguration
    public init(configuration: FamilyAccessConfiguration) { self.configuration = configuration }

    public func freeVersion(_ state: FamilyEntitlementState, canSellHere: Bool) -> Bool {
        !canSellHere || state.keepsFreeVersion || state.verifiedClinician
    }
    public func offersLockedContent(_ state: FamilyEntitlementState, canSellHere: Bool, at date: Date) -> Bool {
        !configuration.freeMode && canSellHere && !state.premium && !state.trialActive(at: date)
    }
    public func requiresTrialFirst(_ state: FamilyEntitlementState, canSellHere: Bool, at date: Date) -> Bool {
        offersLockedContent(state, canSellHere: canSellHere, at: date) && !freeVersion(state, canSellHere: canSellHere)
    }
    public func practice(_ state: FamilyEntitlementState, canSellHere: Bool, activeRun: Bool = false, at date: Date) -> Bool {
        configuration.freeMode || freeVersion(state, canSellHere: canSellHere) || state.premium || state.trialActive(at: date) || activeRun
    }
    public func story(_ state: FamilyEntitlementState, at date: Date) -> Bool {
        configuration.freeMode || state.premium || state.trialActive(at: date)
    }
    public func storyShown(_ state: FamilyEntitlementState, canSellHere: Bool, at date: Date) -> Bool {
        story(state, at: date) || offersLockedContent(state, canSellHere: canSellHere, at: date)
    }
    public func book(_ title: String, state: FamilyEntitlementState, canSellHere: Bool, at date: Date) -> Bool {
        (configuration.freeBooks.contains(title) && freeVersion(state, canSellHere: canSellHere)) || story(state, at: date)
    }
    public func game(_ id: String, state: FamilyEntitlementState, canSellHere: Bool,
                     permission: FamilyGamePermission = .library, at date: Date) -> FamilyAccessDecision {
        func answer(_ allowed: Bool, _ reason: FamilyAccessReason) -> FamilyAccessDecision { .init(allowed: allowed, reason: reason) }
        if configuration.storyKeys.contains(id) {
            return answer(story(state, at: date), configuration.freeMode ? .freeMode : state.premium ? .entitled : state.trialActive(at: date) ? .trial : .premium)
        }
        guard let game = configuration.games.first(where: { $0.id == id }), game.available else { return answer(false, .unknown) }
        guard !game.parked else { return answer(false, .parked) }
        if game.tier == .free && freeVersion(state, canSellHere: canSellHere) { return answer(true, .free) }
        if configuration.freeMode { return answer(true, .freeMode) }
        if state.premium { return answer(true, .entitled) }
        if state.trialActive(at: date) { return answer(true, .trial) }
        if let run = permission.run, run.completedRound == run.round { return answer(false, .completed) }
        if permission.earnedGameID == id { return answer(true, .earned) }
        if let run = permission.run, run.games.indices.contains(run.round), run.games[run.round] == id,
           run.pending || run.readyRound == run.round { return answer(true, .run) }
        return answer(false, .premium)
    }

    /// Compatibility for old generic routes only. Books, stories and catalog
    /// game entry must use their stricter functions above, never this demo seam.
    public func legacyPremiumRoute(_ state: FamilyEntitlementState, activeRun: Bool, at date: Date) -> Bool {
        if configuration.freeMode || state.premium || activeRun || state.trialActive(at: date) { return true }
        if state.legacyDemoFinished { return false }
        guard let began = state.legacyDemoStarted else { return true }
        return date.timeIntervalSince(began) <= configuration.demoWindowSeconds
    }
}
