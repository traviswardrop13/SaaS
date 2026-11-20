import Foundation
import StoreKit
import RevenueCat
import SonaFamilyMigration
import SonaFamilyAccess
import SonaFamilyStorefront

// Public StoreKit1 fixtures wrapped by the ACTUAL pinned RevenueCat SDK.
// No Purchases.configure, offerings lookup, receipt, or account is used.
final class SyntheticPeriod: SKProductSubscriptionPeriod, @unchecked Sendable {
    let n: Int; let kind: SKProduct.PeriodUnit
    init(_ n: Int = 1, _ kind: SKProduct.PeriodUnit = .month) { self.n = n; self.kind = kind; super.init() }
    override var numberOfUnits: Int { n }
    override var unit: SKProduct.PeriodUnit { kind }
}
final class SyntheticDiscount: SKProductDiscount, @unchecked Sendable {
    let mode: SKProductDiscount.PaymentMode
    let period: SKProductSubscriptionPeriod
    let count: Int
    init(mode: SKProductDiscount.PaymentMode = .freeTrial, period: SKProductSubscriptionPeriod = SyntheticPeriod(1, .week), count: Int = 1) {
        self.mode = mode; self.period = period; self.count = count; super.init()
    }
    override var identifier: String? { nil }
    override var type: SKProductDiscount.`Type` { .introductory }
    override var price: NSDecimalNumber { mode == .freeTrial ? .zero : NSDecimalNumber(string: "2.50") }
    override var priceLocale: Locale { Locale(identifier: "en_CH") }
    override var paymentMode: SKProductDiscount.PaymentMode { mode }
    override var subscriptionPeriod: SKProductSubscriptionPeriod { period }
    override var numberOfPeriods: Int { count }
}
final class SyntheticProduct: SKProduct, @unchecked Sendable {
    let sku: String; let period: SKProductSubscriptionPeriod?; let intro: SKProductDiscount?
    init(_ sku: String = FamilyStoreProductID.monthly, period: SKProductSubscriptionPeriod? = SyntheticPeriod(), intro: SKProductDiscount? = nil) {
        self.sku = sku; self.period = period; self.intro = intro; super.init()
    }
    override var productIdentifier: String { sku }
    override var localizedTitle: String { "Synthetic product" }
    override var localizedDescription: String { "Synthetic product fixture" }
    override var price: NSDecimalNumber { NSDecimalNumber(string: "12.34") }
    override var priceLocale: Locale { Locale(identifier: "en_CH") }
    override var subscriptionPeriod: SKProductSubscriptionPeriod? { period }
    override var introductoryPrice: SKProductDiscount? { intro }
}
@main struct ProjectionProbe {
    static func main() async {
        var checks = 0
        func require(_ condition: Bool, _ message: String) {
            checks += 1
            if !condition { print("FAIL: " + message); exit(1) }
        }
        func project(_ product: SyntheticProduct, _ eligibility: IntroEligibilityStatus = .noIntroOfferExists) -> FamilyStorefrontProduct? {
            RevenueCatFamilyStorefrontClient.project(StoreProduct(sk1Product: product), eligibility: eligibility)
        }
        let source = StoreProduct(sk1Product: SyntheticProduct())
        let month = RevenueCatFamilyStorefrontClient.project(source, eligibility: .noIntroOfferExists)
        require(month != nil, "actual pinned SDK monthly subscription was rejected")
        require(month?.purchase.localizedPrice == source.localizedPriceString, "store localized price changed")
        require(month?.purchase.billingPeriod == .month, "monthly period changed")
        require(project(SyntheticProduct(FamilyStoreProductID.annual, period: SyntheticPeriod(1, .year)))?.purchase.billingPeriod == .year, "legacy annual period rejected")
        require(project(SyntheticProduct(FamilyStoreProductID.lifetime, period: nil))?.purchase.billingPeriod == .once, "nonconsumable rejected")
        require(project(SyntheticProduct("synthetic.unrecognized")) == nil, "unrecognized SKU accepted")
        require(project(SyntheticProduct(period: nil)) == nil, "monthly missing period accepted")
        require(project(SyntheticProduct(period: SyntheticPeriod(2, .month))) == nil, "two-month product mislabeled monthly")
        require(project(SyntheticProduct(FamilyStoreProductID.annual, period: SyntheticPeriod())) == nil, "monthly period mislabeled annual")
        require(project(SyntheticProduct(intro: SyntheticDiscount(mode: .payUpFront))) == nil, "paid intro falsely represented as trial")
        require(project(SyntheticProduct(FamilyStoreProductID.lifetime, period: nil, intro: SyntheticDiscount())) == nil, "one-payment intro accepted")
        let free = project(SyntheticProduct(intro: SyntheticDiscount()), .eligible)
        require(free?.purchase.introductoryOffer == .free(.init(count: 1, unit: .week)), "actual SDK free period changed")
        let multiple = project(SyntheticProduct(intro: SyntheticDiscount(count: 2)), .eligible)
        require(multiple?.purchase.introductoryOffer == .free(.init(count: 2, unit: .week)), "store period count lost")
        let unknown = project(SyntheticProduct(intro: SyntheticDiscount()), .unknown)
        var config = try! FamilyAccessConfiguration.bundled(); config.freeMode = false; config.sellYearly = false
        let unknownOffer = FamilyStoreCompatibility.offers(configuration: config, products: unknown.map { [$0.display] } ?? [], offeringProductIDs: [])
        require(unknownOffer.first?.terms == .freeTrial(.init(count: 1, unit: .week), confirmedEligible: false), "unknown eligibility promised a sure trial")
        let used = project(SyntheticProduct(intro: SyntheticDiscount()), .ineligible)
        let usedOffer = FamilyStoreCompatibility.offers(configuration: config, products: used.map { [$0.display] } ?? [], offeringProductIDs: [])
        require(usedOffer.first?.terms == .chargedToday, "ineligible subscriber offered free days")
        require(!Purchases.isConfigured, "fixture configured SDK")
        let guarded = RevenueCatFamilyStorefrontClient(existingPublicAPIKey: "appl_synthetic_not_a_live_account")
        do { try await guarded.configurePreservingIdentity(); require(false, "wrong host configured SDK") }
        catch { require((error as? FamilyPurchaseFailure) == .unavailable, "wrong-host failure category") }
        require(!Purchases.isConfigured, "wrong host changed SDK identity")
        print("PASS: \(checks) actual pinned SDK product/eligibility/preview-isolation checks; zero configured SDKs")
    }
}
