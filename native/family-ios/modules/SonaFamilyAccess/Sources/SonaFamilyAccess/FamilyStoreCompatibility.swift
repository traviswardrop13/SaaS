import Foundation

public enum FamilyProductKind: String, Codable, CaseIterable, Sendable { case monthly, lifetime, annual }
public struct FamilyStoreProducts: Codable, Sendable {
    public var annual: String
    public var monthly: String
    public var lifetime: String
    public func id(for kind: FamilyProductKind) -> String {
        switch kind { case .monthly: return monthly; case .annual: return annual; case .lifetime: return lifetime }
    }
    public var restorableIDs: Set<String> { [annual, monthly, lifetime] }
}

public struct FamilyStorePeriod: Equatable, Sendable {
    public enum Unit: String, Sendable { case day, week, month, year }
    public var count: Int
    public var unit: Unit
    public init(count: Int, unit: Unit) { self.count = count; self.unit = unit }
}
public enum FamilyIntroEligibility: Sendable { case eligible, ineligible, unknown }
public enum FamilyStoreIntro: Sendable { case none, free(FamilyStorePeriod), other }

/// Populate only from the actual App Store/RevenueCat product, not a URL,
/// marketing default or a locally typed price. There is no buying API here.
public struct FamilyStoreProduct: Sendable {
    public var identifier: String
    public var localizedPrice: String
    public var introduction: FamilyStoreIntro
    public var eligibility: FamilyIntroEligibility
    public init(identifier: String, localizedPrice: String, introduction: FamilyStoreIntro = .none,
                eligibility: FamilyIntroEligibility = .unknown) {
        self.identifier = identifier; self.localizedPrice = localizedPrice
        self.introduction = introduction; self.eligibility = eligibility
    }
}
public enum FamilyOfferTerms: Equatable, Sendable {
    case freeTrial(FamilyStorePeriod, confirmedEligible: Bool)
    case chargedToday
    case onePayment
}
public struct FamilyStoreOffer: Equatable, Sendable {
    public let kind: FamilyProductKind
    public let productID: String
    public let localizedPrice: String
    public let terms: FamilyOfferTerms
}

public enum FamilyStoreCompatibility {
    /// Monthly is the anchor/default. A missing/wrong monthly product or an
    /// unreadable paid introductory charge suppresses the whole card. Annual
    /// remains restorable even while the canonical sale switch hides its row.
    public static func offers(configuration: FamilyAccessConfiguration, products: [FamilyStoreProduct],
                              offeringProductIDs: Set<String>, alreadyPremium: Bool = false) -> [FamilyStoreOffer] {
        guard !alreadyPremium,
              let month = product(.monthly, configuration: configuration, products: products),
              let terms = subscriptionTerms(month) else { return [] }
        var result: [FamilyStoreOffer] = [.init(kind: .monthly, productID: month.identifier, localizedPrice: month.localizedPrice, terms: terms)]
        if configuration.sellYearly, offeringProductIDs.contains(configuration.products.annual),
           let year = product(.annual, configuration: configuration, products: products),
           let terms = subscriptionTerms(year) {
            result.append(.init(kind: .annual, productID: year.identifier, localizedPrice: year.localizedPrice, terms: terms))
        }
        if offeringProductIDs.contains(configuration.products.lifetime),
           let once = product(.lifetime, configuration: configuration, products: products) {
            result.append(.init(kind: .lifetime, productID: once.identifier, localizedPrice: once.localizedPrice, terms: .onePayment))
        }
        return result
    }

    /// Parse only a completed SDK CustomerInfo answer. Malformed/missing data
    /// is unavailable, never evidence to revoke an existing purchase.
    public static func customerInfoAnswer(_ json: Data, entitlementID: String) -> FamilyVerification {
        guard let root = (try? JSONSerialization.jsonObject(with: json)) as? [String: Any] else { return .unavailable }
        let info = (root["customerInfo"] as? [String: Any]) ?? root
        guard let entitlements = info["entitlements"] as? [String: Any],
              let active = entitlements["active"] as? [String: Any] else { return .unavailable }
        if let entitlement = active[entitlementID] {
            guard entitlement is [String: Any] else { return .unavailable }
            return .confirmed(active: true)
        }
        return .confirmed(active: false)
    }

    public static func appleRefreshDue(state: FamilyEntitlementState, configuration: FamilyAccessConfiguration, at now: Date) -> Bool {
        guard state.grants.contains(.apple), let checked = state.appleCheckedAt else { return true }
        return now.timeIntervalSince(checked) >= configuration.appleRecheckSeconds
    }
    public static func clinicianRefreshDue(state: FamilyEntitlementState, configuration: FamilyAccessConfiguration, at now: Date) -> Bool {
        guard let checked = state.clinicianCheckedAt else { return true }
        return now.timeIntervalSince(checked) >= configuration.clinicianRecheckSeconds
    }

    private static func product(_ kind: FamilyProductKind, configuration: FamilyAccessConfiguration, products: [FamilyStoreProduct]) -> FamilyStoreProduct? {
        products.first { $0.identifier == configuration.products.id(for: kind) && !$0.localizedPrice.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }
    private static func subscriptionTerms(_ product: FamilyStoreProduct) -> FamilyOfferTerms? {
        if product.eligibility == .ineligible { return .chargedToday }
        switch product.introduction {
        case .none: return .chargedToday
        case .other: return nil
        case .free(let period):
            guard period.count > 0 else { return nil }
            return .freeTrial(period, confirmedEligible: product.eligibility == .eligible)
        }
    }
}
