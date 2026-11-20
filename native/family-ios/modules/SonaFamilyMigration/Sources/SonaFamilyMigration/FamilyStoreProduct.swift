import Foundation

public enum FamilyStoreProductID {
    public static let monthly = "com.speaksona.app.monthly"
    public static let annual = "com.speaksona.app.annual"
    public static let lifetime = "com.speaksona.app.lifetime"
}

public enum FamilyBillingPeriod: String, Codable, Sendable { case month, year, once }
public enum FamilyIntroductoryEligibility: String, Codable, Sendable {
    case eligible, ineligible, noIntroOffer, unknown
}
public enum FamilyTrialUnit: String, Codable, Sendable { case day, week, month, year }

/// A period read from the injected store product, never a typed trial length.
public struct FamilyTrialPeriod: Codable, Equatable, Sendable {
    public let count: Int
    public let unit: FamilyTrialUnit
    public init(count: Int, unit: FamilyTrialUnit) { self.count = count; self.unit = unit }
    public var displayText: String? {
        let n: Int, name: String
        switch unit {
        case .day: n = count; name = "day"
        case .week:
            guard (1...4).contains(count) else { return nil }
            n = count * 7; name = "day"
        case .month: n = count; name = "month"
        case .year: n = count; name = "year"
        }
        let limit = name == "day" ? 31 : name == "month" ? 12 : 1
        guard (1...limit).contains(n) else { return nil }
        return "\(n) \(name)\(n == 1 ? "" : "s")"
    }
}

public enum FamilyIntroductoryOffer: Codable, Equatable, Sendable {
    case free(FamilyTrialPeriod)
    case paid
    case unreadable
}

/// The host keeps the actual SDK product object keyed by identifier. This small
/// model supplies store-owned display terms and never contains billing identity.
public struct FamilyStoreProduct: Codable, Equatable, Sendable {
    public let identifier: String
    public let localizedPrice: String
    public let billingPeriod: FamilyBillingPeriod
    public let introductoryOffer: FamilyIntroductoryOffer?
    public init(identifier: String, localizedPrice: String, billingPeriod: FamilyBillingPeriod,
                introductoryOffer: FamilyIntroductoryOffer? = nil) {
        self.identifier = identifier; self.localizedPrice = localizedPrice
        self.billingPeriod = billingPeriod; self.introductoryOffer = introductoryOffer
    }
    public var isRecognizedAndPriced: Bool {
        let matches: Bool
        switch identifier {
        case FamilyStoreProductID.monthly: matches = billingPeriod == .month
        case FamilyStoreProductID.annual: matches = billingPeriod == .year
        case FamilyStoreProductID.lifetime: matches = billingPeriod == .once && introductoryOffer == nil
        default: matches = false
        }
        return matches && !localizedPrice.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Terms only; this does not decide which products are offered or picked.
    /// Annual stays recognizable for legacy Restore without adding a sale row.
    public func terms(eligibility: FamilyIntroductoryEligibility, alreadyOwned: Bool = false) -> FamilyStoreTerms {
        if alreadyOwned { return FamilyStoreTerms(state: .owned, product: nil, trial: nil, sure: false) }
        guard isRecognizedAndPriced else { return .unavailable }
        if billingPeriod == .once { return FamilyStoreTerms(state: .chargedToday, product: self, trial: nil, sure: false) }
        if eligibility == .ineligible || eligibility == .noIntroOffer || introductoryOffer == nil {
            return FamilyStoreTerms(state: .chargedToday, product: self, trial: nil, sure: false)
        }
        guard case let .free(trial)? = introductoryOffer, trial.displayText != nil else { return .unavailable }
        return FamilyStoreTerms(state: .freeTrial, product: self, trial: trial,
                                sure: eligibility == .eligible)
    }
}

public enum FamilyStoreTermsState: String, Codable, Sendable { case freeTrial, chargedToday, unavailable, owned }

public struct FamilyStoreTerms: Equatable, Sendable {
    public let state: FamilyStoreTermsState
    public let product: FamilyStoreProduct?
    public let trial: FamilyTrialPeriod?
    public let sure: Bool
    public var price: String? { product?.localizedPrice }
    public var qualifiesTrialForNewSubscribers: Bool { state == .freeTrial && !sure }
    /// A definite no-payment claim and a trial-reminder promise require `sure`.
    public var canPromiseNoPaymentToday: Bool { state == .freeTrial && sure }
    public var trialDisclosure: String? {
        guard let duration = trial?.displayText, state == .freeTrial else { return nil }
        if sure { return "\(duration) free" }
        return "Only new subscribers get \(duration) free. Otherwise Apple charges \(price ?? "") today. Apple shows your exact terms before you confirm."
    }
    static let unavailable = FamilyStoreTerms(state: .unavailable, product: nil, trial: nil, sure: false)
}
