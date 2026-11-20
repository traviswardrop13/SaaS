import Foundation
import RevenueCat
import SonaFamilyMigration

/// App-level adapter for the pinned RevenueCat native SDK (5.80.3). Keep the
/// existing SDK project/key, app identity and default UserDefaults suite.
/// FamilyPurchaseContinuity owns parent actions, coalescing and grant policy.
public actor RevenueCatFamilyPurchaseClient: FamilyPurchaseClient {
    private let publicAPIKey: String
    private var registeredProducts: [String: StoreProduct] = [:]

    public init(publicAPIKey: String) { self.publicAPIKey = publicAPIKey }

    /// The host registers products it already obtained from the real SDK. No
    /// lookup or purchase is triggered here; each buy uses that exact object.
    public func register(products: [StoreProduct]) {
        for product in products { registeredProducts[product.productIdentifier] = product }
    }

    public func configurePreservingIdentity() async throws {
        let key = publicAPIKey
        try await MainActor.run {
            guard !Purchases.isConfigured else { return }
            guard !key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                throw FamilyPurchaseFailure.unavailable
            }
            // Deliberately the public no-appUserID overload: no new user ID,
            // defaults override, logIn/logOut, cache reset or identity migration.
            Purchases.configure(withAPIKey: key)
        }
    }

    public func customerInfo() async throws -> FamilyPurchaseCustomerInfo {
        try await configurePreservingIdentity()
        do {
            // A refresh result used for revocation must request current data,
            // rather than RevenueCat's default cached-or-fetched policy.
            return Self.snapshot(from: try await Purchases.shared.customerInfo(fetchPolicy: .fetchCurrent))
        } catch { throw Self.failure(from: error) }
    }

    public func restorePurchases() async throws -> FamilyPurchaseCustomerInfo {
        try await configurePreservingIdentity()
        do { return Self.snapshot(from: try await Purchases.shared.restorePurchases()) }
        catch { throw Self.failure(from: error) }
    }

    public func purchase(product: FamilyStoreProduct) async throws -> FamilyPurchaseCustomerInfo {
        guard product.isRecognizedAndPriced,
              let actual = registeredProducts[product.identifier],
              actual.productIdentifier == product.identifier else { throw FamilyPurchaseFailure.unavailable }
        try await configurePreservingIdentity()
        do {
            // One actual SDK purchase call. Never retry another API after Apple
            // returns cancellation, Ask to Buy, already-owned or any failure.
            let result = try await Purchases.shared.purchase(product: actual)
            if result.userCancelled { throw FamilyPurchaseFailure.cancelled }
            return Self.snapshot(from: result.customerInfo)
        } catch { throw Self.failure(from: error) }
    }

    /// Public SDK objects only. Inactive `full`, known product IDs and other
    /// entitlement names never become an active full entitlement by inference.
    public nonisolated static func snapshot(from info: CustomerInfo) -> FamilyPurchaseCustomerInfo {
        FamilyPurchaseCustomerInfo(activeEntitlements: info.entitlements.active.mapValues { entitlement in
            let period: String
            switch entitlement.periodType {
            case .normal: period = "NORMAL"
            case .intro: period = "INTRO"
            case .trial: period = "TRIAL"
            case .prepaid: period = "PREPAID"
            @unknown default: period = ""
            }
            return FamilyPurchaseEntitlement(productIdentifier: entitlement.productIdentifier,
                periodType: period, expirationDate: entitlement.expirationDate, willRenew: entitlement.willRenew)
        })
    }

    /// Fixed categories only. Do not log/forward SDK messages or userInfo, which
    /// may contain account/transaction details unrelated to family access UI.
    public nonisolated static func failure(from error: Error) -> FamilyPurchaseFailure {
        if let own = error as? FamilyPurchaseFailure { return own }
        if error is CancellationError { return .cancelled }
        let native = error as NSError
        if native.domain == ErrorCode.errorDomain, let code = ErrorCode(rawValue: native.code) {
            switch code {
            case .purchaseCancelledError: return .cancelled
            case .paymentPendingError: return .pending
            case .purchaseNotAllowedError: return .notAllowed
            case .productNotAvailableForPurchaseError: return .unavailable
            case .productAlreadyPurchasedError: return .alreadyPurchased
            case .networkError, .offlineConnectionError: return .offline
            case .operationAlreadyInProgressForProductError: return .busy
            default: return .failed
            }
        }
        if native.domain == NSURLErrorDomain {
            if native.code == URLError.cancelled.rawValue { return .cancelled }
            return .offline
        }
        return .failed
    }
}
