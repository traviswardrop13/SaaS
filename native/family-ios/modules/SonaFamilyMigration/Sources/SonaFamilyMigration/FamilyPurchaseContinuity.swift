import Foundation

public enum FamilyAccessGrant: String, Codable, CaseIterable, Sendable {
    case apple, stripe, founder, founding, grandfathered, caseload
}

/// Grants remain independent. An Apple answer cannot revoke a web purchase,
/// permanent promise or clinician's coverage, even when they coexist.
public struct FamilyAccessState: Codable, Equatable, Sendable {
    public let grants: Set<FamilyAccessGrant>
    public let stripeEmail: String?
    public let lastAppleRefresh: Date?

    public init(grants: Set<FamilyAccessGrant> = [], stripeEmail: String? = nil,
                lastAppleRefresh: Date? = nil) {
        self.grants = grants; self.stripeEmail = stripeEmail
        self.lastAppleRefresh = lastAppleRefresh
    }
    public var premium: Bool { !grants.isEmpty }
    public var subscriptionActive: Bool { grants.contains(.apple) || grants.contains(.stripe) }

    public func applying(_ event: FamilyAccessEvent) -> FamilyAccessState {
        var next = grants, email = stripeEmail, checked = lastAppleRefresh
        switch event {
        case let .appleRefresh(info, at):
            checked = at // Only an answered customer-info refresh stamps the clock.
            if info.hasFullEntitlement { next.insert(.apple) } else { next.remove(.apple) }
        case let .appleRestore(info), let .applePurchase(info):
            // Shipping Restore only grants. A successful Restore with no full
            // entitlement does not perform quiet refresh's revocation.
            if info.hasFullEntitlement { next.insert(.apple) }
        case let .stripeVerification(active, address):
            if let active {
                if active { next.insert(.stripe); email = address }
                else if let email, email.lowercased() == address.lowercased() { next.remove(.stripe) }
            }
        case let .caseloadVerification(active):
            if let active {
                if active { next.insert(.caseload) } else { next.remove(.caseload) }
            }
        case .lookupFailed:
            break // Network errors never become authoritative cancellations.
        }
        return FamilyAccessState(grants: next, stripeEmail: email, lastAppleRefresh: checked)
    }
}

public enum FamilyAccessEvent: Equatable, Sendable {
    case appleRefresh(FamilyPurchaseCustomerInfo, at: Date)
    case appleRestore(FamilyPurchaseCustomerInfo)
    case applePurchase(FamilyPurchaseCustomerInfo)
    /// nil = failed/non-authoritative lookup. Address identifies the verified
    /// account, so checking a partner's email cannot revoke another grant.
    case stripeVerification(active: Bool?, email: String)
    case caseloadVerification(active: Bool?)
    case lookupFailed
}

public struct FamilyPurchaseEntitlement: Codable, Equatable, Sendable {
    public let productIdentifier: String?
    public let periodType: String
    public let expirationDate: Date?
    public let willRenew: Bool?
    public init(productIdentifier: String?, periodType: String = "", expirationDate: Date? = nil,
                willRenew: Bool? = nil) {
        self.productIdentifier = productIdentifier; self.periodType = periodType
        self.expirationDate = expirationDate; self.willRenew = willRenew
    }
}

/// Adapter supplies only ACTIVE entitlements from the existing purchase SDK.
/// Do not manufacture `full` from a product ID, URL, backup or cached email.
public struct FamilyPurchaseCustomerInfo: Codable, Equatable, Sendable {
    public let activeEntitlements: [String: FamilyPurchaseEntitlement]
    public init(activeEntitlements: [String: FamilyPurchaseEntitlement] = [:]) {
        self.activeEntitlements = activeEntitlements
    }
    public var fullEntitlement: FamilyPurchaseEntitlement? { activeEntitlements["full"] }
    public var hasFullEntitlement: Bool { fullEntitlement != nil }
}

public enum FamilyPurchaseFailure: String, Error, Equatable, Sendable {
    case cancelled, pending, offline, unavailable, notAllowed, alreadyPurchased
    case busy, notEntitled, verificationPending, parentActionRequired, failed
}

/// SDK-neutral seam. The host adapter retains the existing App Store identity,
/// RevenueCat project/key and default UserDefaults suite. Configure once with
/// no new appUserID; do not log in/out, reset identity or clear SDK caches.
/// There is deliberately no identity, child, email or analytics parameter here.
public protocol FamilyPurchaseClient: Sendable {
    func configurePreservingIdentity() async throws
    func customerInfo() async throws -> FamilyPurchaseCustomerInfo
    func restorePurchases() async throws -> FamilyPurchaseCustomerInfo
    /// The adapter selects one supported purchase API before starting. A thrown
    /// cancellation, pending approval or error must never trigger another API.
    func purchase(product: FamilyStoreProduct) async throws -> FamilyPurchaseCustomerInfo
}

public struct FamilyPurchaseRefreshResult: Equatable, Sendable {
    public let access: FamilyAccessState
    public let customerInfo: FamilyPurchaseCustomerInfo?
    public let usedRecentCache: Bool
    public let ignoredObsoleteAnswer: Bool
    public let failure: FamilyPurchaseFailure?
    public var authoritative: Bool { customerInfo != nil }
}

public enum FamilyPurchaseRestoreResult: Equatable, Sendable {
    case restored(FamilyPurchaseCustomerInfo)
    case noActivePurchase
    case failed(FamilyPurchaseFailure)
}

public enum FamilyPurchaseResult: Equatable, Sendable {
    case purchased(FamilyPurchaseCustomerInfo)
    /// Existing ownership was recovered, not a new sale or trial to count.
    case restored(FamilyPurchaseCustomerInfo)
    case failed(FamilyPurchaseFailure)
}

/// Local orchestration only: no SDK dependency, network, logs, pricing switch,
/// analytics or live storage writes. The host persists resulting access state.
/// Source behavior: public/sona.js iapRestore, iapRefresh and buyPlan.
public actor FamilyPurchaseContinuity {
    private let client: any FamilyPurchaseClient
    private let now: @Sendable () -> Date
    private var access: FamilyAccessState
    private var configuration: Task<Void, Never>?
    private var refreshInFlight: Task<FamilyPurchaseRefreshResult, Never>?
    private var restoreInFlight: Task<FamilyPurchaseRestoreResult, Never>?
    private var purchaseInFlight = false
    private var appleGrantRevision: UInt64 = 0
    public static let refreshInterval: TimeInterval = 6 * 60 * 60

    public init(client: any FamilyPurchaseClient, initialAccess: FamilyAccessState = FamilyAccessState(),
                now: @escaping @Sendable () -> Date = { Date() }) {
        self.client = client; access = initialAccess; self.now = now
    }
    public func accessState() -> FamilyAccessState { access }

    public func refresh(force: Bool = false) async -> FamilyPurchaseRefreshResult {
        if let work = refreshInFlight { return withCurrentAccess(await work.value) }
        if !force, access.subscriptionActive, let checked = access.lastAppleRefresh,
           now().timeIntervalSince(checked) < Self.refreshInterval {
            return FamilyPurchaseRefreshResult(access: access, customerInfo: nil,
                                               usedRecentCache: true, ignoredObsoleteAnswer: false, failure: nil)
        }
        let work = Task { await performRefresh() }
        refreshInFlight = work
        let result = await work.value
        refreshInFlight = nil
        return withCurrentAccess(result)
    }

    /// Only a deliberate parent's Restore action may reach the SDK's restore
    /// call, which may display Apple's account sheet. Concurrent taps share it.
    public func restore(parentInitiated: Bool) async -> FamilyPurchaseRestoreResult {
        guard parentInitiated else { return .failed(.parentActionRequired) }
        if let work = restoreInFlight { return await work.value }
        guard !purchaseInFlight else { return .failed(.busy) }
        let work = Task { await performRestore() }
        restoreInFlight = work
        let result = await work.value
        restoreInFlight = nil
        return result
    }

    public func purchase(product: FamilyStoreProduct, parentInitiated: Bool) async -> FamilyPurchaseResult {
        guard parentInitiated else { return .failed(.parentActionRequired) }
        guard !purchaseInFlight, restoreInFlight == nil else { return .failed(.busy) }
        guard product.isRecognizedAndPriced else { return .failed(.unavailable) }
        purchaseInFlight = true
        defer { purchaseInFlight = false }
        await configureOnce()
        do {
            let info = try await client.purchase(product: product) // Exactly one purchase attempt.
            if info.hasFullEntitlement {
                appleGrantRevision &+= 1
                access = access.applying(.applePurchase(info))
                return .purchased(info)
            }
            // Shipping asks customer info once if the purchase result omits
            // `full`. Local result-status correction: a failed verification plus
            // an unrelated cached Stripe grant must not claim a new sale.
            // Cached grants survive; no second purchase or new trial is minted.
            let result = await refresh(force: true)
            if let verified = result.customerInfo, verified.hasFullEntitlement { return .purchased(verified) }
            return .failed(result.authoritative ? .notEntitled : .verificationPending)
        } catch {
            let failure = Self.failure(error)
            if failure == .alreadyPurchased {
                // Shipping buyPlan's code-6 path restores once. This is recovery
                // from the same parent's buy action, never a second purchase.
                switch await performRestore() {
                case let .restored(info): return .restored(info)
                case .noActivePurchase, .failed: return .failed(.notEntitled)
                }
            }
            return .failed(failure)
        }
    }

    private func configureOnce() async {
        if let work = configuration { await work.value; return }
        let adapter = client
        // The shipping configure path absorbs its error and still attempts the
        // requested SDK operation. An existing configured client may still work.
        let work = Task<Void, Never> { _ = try? await adapter.configurePreservingIdentity() }
        configuration = work
        await work.value
    }
    private func performRefresh() async -> FamilyPurchaseRefreshResult {
        let startedRevision = appleGrantRevision
        await configureOnce()
        do {
            let info = try await client.customerInfo()
            // A request started before a successful purchase/Restore can return
            // its old empty snapshot afterwards. It cannot cancel the new grant
            // or stamp a fresh check clock. A subsequent real negative still can.
            if !info.hasFullEntitlement, startedRevision != appleGrantRevision {
                return FamilyPurchaseRefreshResult(access: access, customerInfo: nil,
                    usedRecentCache: false, ignoredObsoleteAnswer: true, failure: nil)
            }
            if info.hasFullEntitlement { appleGrantRevision &+= 1 }
            access = access.applying(.appleRefresh(info, at: now()))
            return FamilyPurchaseRefreshResult(access: access, customerInfo: info,
                                               usedRecentCache: false, ignoredObsoleteAnswer: false, failure: nil)
        } catch {
            return FamilyPurchaseRefreshResult(access: access, customerInfo: nil,
                                               usedRecentCache: false, ignoredObsoleteAnswer: false, failure: Self.failure(error))
        }
    }
    private func performRestore() async -> FamilyPurchaseRestoreResult {
        await configureOnce()
        do {
            let info = try await client.restorePurchases()
            if info.hasFullEntitlement { appleGrantRevision &+= 1 }
            access = access.applying(.appleRestore(info))
            return info.hasFullEntitlement ? .restored(info) : .noActivePurchase
        } catch { return .failed(Self.failure(error)) }
    }
    private func withCurrentAccess(_ result: FamilyPurchaseRefreshResult) -> FamilyPurchaseRefreshResult {
        // Coalesced callers resume separately; report current grants when each
        // caller returns, rather than a snapshot captured before another success.
        FamilyPurchaseRefreshResult(access: access, customerInfo: result.customerInfo,
            usedRecentCache: result.usedRecentCache, ignoredObsoleteAnswer: result.ignoredObsoleteAnswer,
            failure: result.failure)
    }
    private static func failure(_ error: Error) -> FamilyPurchaseFailure {
        if let failure = error as? FamilyPurchaseFailure { return failure }
        if error is CancellationError { return .cancelled }
        return .failed
    }
}
