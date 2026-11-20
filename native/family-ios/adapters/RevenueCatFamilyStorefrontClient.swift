#if canImport(RevenueCat)
import Foundation
import RevenueCat
import SonaFamilyMigration
import SonaFamilyAccess
import SonaFamilyStorefront

/// Add this file and the existing RevenueCatFamilyPurchaseClient.swift only to
/// the SDK-enabled release target. Pin purchases-ios-spm to exactly 5.80.3.
/// No SDK initialization or network work happens in this initializer.
public actor RevenueCatFamilyStorefrontClient: FamilyStorefrontClient {
    private let purchases: RevenueCatFamilyPurchaseClient
    private let keyIsCanonical: Bool
    private var registered: [String: SonaFamilyMigration.FamilyStoreProduct] = [:]

    public init(existingPublicAPIKey: String) {
        // Publishable iOS configuration from public/sona.js, not a secret key.
        // Refuse another project's key; never reset an already configured SDK.
        keyIsCanonical = existingPublicAPIKey == "appl_nONRfALUCMiZczeCggXKEusmVtl"
        purchases = RevenueCatFamilyPurchaseClient(publicAPIKey: existingPublicAPIKey)
    }

    private func requireReleaseIdentity() throws {
        guard Bundle.main.bundleIdentifier == "com.speaksona.app", keyIsCanonical else {
            throw FamilyPurchaseFailure.unavailable
        }
    }
    public func configurePreservingIdentity() async throws {
        try requireReleaseIdentity()
        try await purchases.configurePreservingIdentity()
    }
    public func customerInfo() async throws -> FamilyPurchaseCustomerInfo {
        try requireReleaseIdentity()
        return try await purchases.customerInfo()
    }
    public func restorePurchases() async throws -> FamilyPurchaseCustomerInfo {
        try requireReleaseIdentity()
        return try await purchases.restorePurchases()
    }
    public func purchase(product: SonaFamilyMigration.FamilyStoreProduct) async throws -> FamilyPurchaseCustomerInfo {
        try requireReleaseIdentity()
        guard registered[product.identifier] == product else { throw FamilyPurchaseFailure.unavailable }
        return try await purchases.purchase(product: product)
    }

    public func catalog(configuration: FamilyAccessConfiguration) async throws -> FamilyStorefrontCatalog {
        try await configurePreservingIdentity()
        guard configuration.entitlement == "full",
              configuration.products.monthly == FamilyStoreProductID.monthly,
              configuration.products.annual == FamilyStoreProductID.annual,
              configuration.products.lifetime == FamilyStoreProductID.lifetime else { throw FamilyPurchaseFailure.unavailable }
        // Monthly is the shipping prerequisite even when absent from an
        // offering. Optional lifetime/yearly rows require CURRENT membership.
        let offerings: Offerings
        do { offerings = try await Purchases.shared.offerings() }
        catch { throw RevenueCatFamilyPurchaseClient.failure(from: error) }
        let offered = Set(offerings.current?.availablePackages.map { $0.storeProduct.productIdentifier } ?? [])
        var ids = [configuration.products.monthly]
        if offered.contains(configuration.products.lifetime) { ids.append(configuration.products.lifetime) }
        if configuration.sellYearly && offered.contains(configuration.products.annual) { ids.append(configuration.products.annual) }
        let actual = await Purchases.shared.products(ids)
        let eligible = await Purchases.shared.checkTrialOrIntroDiscountEligibility(productIdentifiers: actual.map(\.productIdentifier))
        let projected = actual.compactMap { Self.project($0, eligibility: eligible[$0.productIdentifier]?.status ?? .unknown) }
        registered = Dictionary(projected.map { ($0.purchase.identifier, $0.purchase) }, uniquingKeysWith: { _, last in last })
        await purchases.register(products: actual.filter { registered[$0.productIdentifier] != nil })
        return FamilyStorefrontCatalog(products: projected, offeringProductIDs: offered)
    }

    /// Public StoreProduct fields only. Unsupported paid intros or unexpected
    /// subscription periods fail closed; no handwritten prices/trial lengths.
    public nonisolated static func project(_ product: StoreProduct, eligibility: IntroEligibilityStatus) -> FamilyStorefrontProduct? {
        let billing: FamilyBillingPeriod
        switch product.productIdentifier {
        case FamilyStoreProductID.monthly:
            // StoreKit1's productType is the SDK's default nonConsumable, even
            // for a subscription. Its category+period are authoritative here.
            guard product.productCategory == .subscription,
                  product.subscriptionPeriod?.unit == .month, product.subscriptionPeriod?.value == 1 else { return nil }
            billing = .month
        case FamilyStoreProductID.annual:
            guard product.productCategory == .subscription,
                  product.subscriptionPeriod?.unit == .year, product.subscriptionPeriod?.value == 1 else { return nil }
            billing = .year
        case FamilyStoreProductID.lifetime:
            guard product.productType == .nonConsumable, product.subscriptionPeriod == nil, product.introductoryDiscount == nil else { return nil }
            billing = .once
        default: return nil
        }
        guard !product.localizedPriceString.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        let intro: FamilyIntroductoryOffer?
        let displayIntro: FamilyStoreIntro
        if let discount = product.introductoryDiscount {
            guard discount.paymentMode == .freeTrial, discount.price == 0,
                  discount.numberOfPeriods > 0, discount.subscriptionPeriod.value > 0,
                  discount.subscriptionPeriod.value <= Int.max / discount.numberOfPeriods else { return nil }
            let count = discount.subscriptionPeriod.value * discount.numberOfPeriods
            let trialUnit: FamilyTrialUnit
            let displayUnit: FamilyStorePeriod.Unit
            switch discount.subscriptionPeriod.unit {
            case .day: trialUnit = .day; displayUnit = .day
            case .week: trialUnit = .week; displayUnit = .week
            case .month: trialUnit = .month; displayUnit = .month
            case .year: trialUnit = .year; displayUnit = .year
            @unknown default: return nil
            }
            let period = FamilyTrialPeriod(count: count, unit: trialUnit)
            guard period.displayText != nil else { return nil }
            intro = .free(period); displayIntro = .free(.init(count: count, unit: displayUnit))
        } else { intro = nil; displayIntro = .none }
        let displayEligibility: FamilyIntroEligibility
        switch eligibility {
        case .eligible: displayEligibility = .eligible
        case .ineligible, .noIntroOfferExists: displayEligibility = .ineligible
        case .unknown: displayEligibility = .unknown
        @unknown default: displayEligibility = .unknown
        }
        return FamilyStorefrontProduct(
            purchase: SonaFamilyMigration.FamilyStoreProduct(identifier: product.productIdentifier,
                localizedPrice: product.localizedPriceString, billingPeriod: billing, introductoryOffer: intro),
            display: SonaFamilyAccess.FamilyStoreProduct(identifier: product.productIdentifier,
                localizedPrice: product.localizedPriceString, introduction: displayIntro, eligibility: displayEligibility))
    }
}
#endif
