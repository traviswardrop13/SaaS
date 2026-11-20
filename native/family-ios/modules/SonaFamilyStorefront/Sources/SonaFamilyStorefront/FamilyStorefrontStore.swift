import Foundation
import Combine
import SonaFamilyMigration
import SonaFamilyAccess

/// One actual store product, projected into both existing compatibility models.
/// The live adapter creates these exclusively from RevenueCat StoreProduct.
public struct FamilyStorefrontProduct: Sendable {
    public let purchase: SonaFamilyMigration.FamilyStoreProduct
    public let display: SonaFamilyAccess.FamilyStoreProduct
    public init(purchase: SonaFamilyMigration.FamilyStoreProduct, display: SonaFamilyAccess.FamilyStoreProduct) {
        self.purchase = purchase; self.display = display
    }
}

public struct FamilyStorefrontCatalog: Sendable {
    public let products: [FamilyStorefrontProduct]
    public let offeringProductIDs: Set<String>
    public init(products: [FamilyStorefrontProduct], offeringProductIDs: Set<String>) {
        self.products = products; self.offeringProductIDs = offeringProductIDs
    }
}

public protocol FamilyStorefrontClient: FamilyPurchaseClient {
    func catalog(configuration: FamilyAccessConfiguration) async throws -> FamilyStorefrontCatalog
}

/// Persist this patch against the captured household/origin, not whichever child
/// is currently selected. It contains no identity, email, price or other grants.
public struct FamilyAppleAccessUpdate: Equatable, Sendable {
    public let active: Bool
    public let lastAuthoritativeRefresh: Date?
    public let source: NativeFamilyAppleWrite
    public init(active: Bool, lastAuthoritativeRefresh: Date?, source: NativeFamilyAppleWrite) {
        self.active = active; self.lastAuthoritativeRefresh = lastAuthoritativeRefresh; self.source = source
    }
}

public enum FamilyStorefrontPhase: Equatable, Sendable {
    case preview, idle, loading, ready, alreadyOpen, unavailable
}
public enum FamilyStorefrontOperation: Equatable, Sendable { case loading, purchasing, restoring, saving }
public enum FamilyStorefrontNotice: Equatable, Sendable {
    case purchased, restored, noActivePurchase, cancelled, pending, savePending
    case failure(FamilyPurchaseFailure)
    public var text: String {
        switch self {
        case .purchased: return "Sona Premium is ready."
        case .restored: return "Your purchase is restored."
        case .noActivePurchase: return "No active Sona purchase was found for this Apple Account."
        case .cancelled: return "Purchase cancelled."
        case .pending: return "Your purchase is waiting for approval. No need to buy again."
        case .savePending: return "Sona couldn’t save this access check on your device yet. Try saving again."
        case .failure(let error):
            switch error {
            case .offline: return "We couldn’t reach the App Store. Try again when you’re online."
            case .notAllowed: return "Purchases aren’t allowed on this device."
            case .busy: return "Another purchase is still in progress."
            case .verificationPending: return "Apple is still confirming your purchase. Try Restore Purchases later."
            case .notEntitled: return "We couldn’t confirm an active Sona purchase. Try Restore Purchases."
            default: return "The App Store couldn’t finish this request. Please try again."
            }
        }
    }
}

/// No SDK is configured by initialization. Only the unchanged release bundle,
/// a supplied live adapter and a deliberate Grown-ups presentation can load it.
@MainActor
public final class FamilyStorefrontStore: ObservableObject {
    @Published public private(set) var phase: FamilyStorefrontPhase
    @Published public private(set) var operation: FamilyStorefrontOperation?
    @Published public private(set) var notice: FamilyStorefrontNotice?
    @Published public private(set) var access: FamilyEntitlementState
    @Published public private(set) var offers: [FamilyStoreOffer] = []
    @Published public var selectedProductID: String?
    @Published public private(set) var needsSaveRetry = false
    @Published public private(set) var awaitingApproval = false

    public var busy: Bool { operation != nil }
    public var canPurchase: Bool {
        authorized && phase == .ready && !busy && !needsSaveRetry && !awaitingApproval && !configuration.freeMode &&
        !access.premium && selectedOffer != nil
    }
    public var canRestore: Bool { authorized && !busy && !needsSaveRetry }
    public var selectedOffer: FamilyStoreOffer? { offers.first { $0.productID == selectedProductID } }
    public var freeMode: Bool { configuration.freeMode }

    private let configuration: FamilyAccessConfiguration
    private let client: (any FamilyStorefrontClient)?
    private let continuity: FamilyPurchaseContinuity?
    private let readAppleRevision: @MainActor () async throws -> UUID?
    private let persistAppleAccess: @MainActor (FamilyAppleAccessUpdate) async throws -> NativeFamilyAppleAccess
    private let authorized: Bool
    private var products: [FamilyStorefrontProduct] = []
    private var pendingPatch: FamilyAppleAccessUpdate?
    private var pendingSuccess: FamilyStorefrontNotice?
    private var loadingID: UUID?

    public convenience init(configuration: FamilyAccessConfiguration,
                            initialAccess: FamilyEntitlementState,
                            client: (any FamilyStorefrontClient)? = nil,
                            readAppleRevision: @escaping @MainActor () async throws -> UUID?,
                            persistAppleAccess: @escaping @MainActor (FamilyAppleAccessUpdate) async throws -> NativeFamilyAppleAccess) {
        self.init(configuration: configuration, initialAccess: initialAccess, client: client,
                  actualBundleIdentifier: Bundle.main.bundleIdentifier,
                  readAppleRevision: readAppleRevision, persistAppleAccess: persistAppleAccess)
    }

    // Internal environment seam is for synthetic tests. The public initializer
    // always checks the actual process bundle, never a caller-provided Boolean.
    init(configuration: FamilyAccessConfiguration, initialAccess: FamilyEntitlementState,
         client: (any FamilyStorefrontClient)?, actualBundleIdentifier: String?,
         readAppleRevision: @escaping @MainActor () async throws -> UUID? = { nil },
         persistAppleAccess: @escaping @MainActor (FamilyAppleAccessUpdate) async throws -> NativeFamilyAppleAccess) {
        self.configuration = configuration; self.access = initialAccess; self.client = client
        self.readAppleRevision = readAppleRevision
        self.persistAppleAccess = persistAppleAccess
        authorized = actualBundleIdentifier == "com.speaksona.app" && client != nil
        phase = authorized ? .idle : .preview
        if let client, authorized {
            var grants = Set<FamilyAccessGrant>()
            if initialAccess.grants.contains(.apple) { grants.insert(.apple) }
            if initialAccess.grants.contains(.stripe) { grants.insert(.stripe) }
            if initialAccess.grants.contains(.founder) { grants.insert(.founder) }
            if initialAccess.grants.contains(.foundingFamily) { grants.insert(.founding) }
            if initialAccess.grants.contains(.freeEra) { grants.insert(.grandfathered) }
            if initialAccess.grants.contains(.clinicianCoverage) { grants.insert(.caseload) }
            continuity = FamilyPurchaseContinuity(client: client,
                initialAccess: FamilyAccessState(grants: grants, stripeEmail: initialAccess.stripeAccount,
                                                lastAppleRefresh: initialAccess.appleCheckedAt))
        } else { continuity = nil }
    }

    /// The records store owns all persisted grants for this household,
    /// including changes made from outside this sheet.
    public func updateAccess(_ latest: FamilyEntitlementState) {
        access = latest
        if access.premium { offers = []; selectedProductID = nil; if !busy { phase = .alreadyOpen } }
        else if phase == .alreadyOpen, !configuration.freeMode { phase = .unavailable }
    }

    public func load() async {
        guard authorized, let client, let continuity else { phase = .preview; return }
        guard !busy, !needsSaveRetry else { return }
        if configuration.freeMode { offers = []; phase = .alreadyOpen; return }
        notice = nil; phase = .loading; operation = .loading
        let request = UUID(); loadingID = request
        // Match the shipping price card's four-second visible wait. A late SDK
        // answer can finish its own work but cannot replace this screen's state.
        let watchdog = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            guard !Task.isCancelled, let self, self.loadingID == request else { return }
            self.loadingID = nil; self.operation = nil; self.phase = .unavailable
        }
        defer { watchdog.cancel(); if loadingID == request { loadingID = nil; operation = nil } }
        let revision: UUID?
        do { revision = try await readAppleRevision() }
        catch {
            guard loadingID == request, !Task.isCancelled else { return }
            phase = .unavailable; notice = .failure(.failed); return
        }
        guard loadingID == request, !Task.isCancelled else { return }
        let refreshed = await continuity.refresh(force: true)
        guard loadingID == request, !Task.isCancelled else { return }
        if let info = refreshed.customerInfo, !refreshed.ignoredObsoleteAnswer {
            let patch = FamilyAppleAccessUpdate(active: info.hasFullEntitlement,
                lastAuthoritativeRefresh: refreshed.access.lastAppleRefresh, source: .refresh(expectedRevision: revision))
            guard await saveApple(patch, success: nil), loadingID == request, !Task.isCancelled else { return }
            operation = .loading
        }
        if access.premium { phase = .alreadyOpen; offers = []; selectedProductID = nil; return }
        guard refreshed.failure == nil, refreshed.authoritative else {
            phase = .unavailable; notice = refreshed.failure.map(FamilyStorefrontNotice.failure); return
        }
        do {
            let catalog = try await client.catalog(configuration: configuration)
            guard loadingID == request, !Task.isCancelled else { return }
            if access.premium { phase = .alreadyOpen; return }
            // Reject model mismatches rather than displaying one SKU/price and
            // purchasing another. Require exact supported periods and prices.
            products = catalog.products.filter {
                $0.purchase.isRecognizedAndPriced && $0.purchase.identifier == $0.display.identifier &&
                $0.purchase.localizedPrice == $0.display.localizedPrice
            }
            offers = FamilyStoreCompatibility.offers(configuration: configuration,
                products: products.map(\.display), offeringProductIDs: catalog.offeringProductIDs,
                alreadyPremium: access.premium)
            selectedProductID = offers.first(where: { $0.productID == selectedProductID })?.productID ?? offers.first?.productID
            phase = offers.isEmpty ? .unavailable : .ready
        } catch {
            guard loadingID == request, !Task.isCancelled else { return }
            offers = []; selectedProductID = nil; phase = .unavailable
            notice = .failure(Self.failure(error))
        }
    }

    public func purchaseSelected() async {
        guard canPurchase, let continuity, let offer = selectedOffer,
              let product = products.first(where: { $0.purchase.identifier == offer.productID }) else { return }
        operation = .purchasing; notice = nil
        defer { operation = nil }
        switch await continuity.purchase(product: product.purchase, parentInitiated: true) {
        case .purchased:
            await saveVerifiedGrant(using: continuity, success: .purchased)
        case .restored:
            await saveVerifiedGrant(using: continuity, success: .restored)
        case .failed(let failure):
            if failure == .pending || failure == .verificationPending { awaitingApproval = true }
            notice = Self.notice(failure)
        }
    }

    public func restore() async {
        guard canRestore, let continuity else { return }
        operation = .restoring; notice = nil
        defer { operation = nil }
        switch await continuity.restore(parentInitiated: true) {
        case .restored:
            await saveVerifiedGrant(using: continuity, success: .restored)
        case .noActivePurchase: notice = .noActivePurchase
        case .failed(let failure): notice = Self.notice(failure)
        }
    }

    public func retrySave() async {
        guard !busy, let patch = pendingPatch else { return }
        operation = .saving
        defer { operation = nil }
        do {
            applyApple(try await persistAppleAccess(patch))
            pendingPatch = nil; needsSaveRetry = false; notice = pendingSuccess
            pendingSuccess = nil
            phase = access.premium ? .alreadyOpen : .unavailable
            if access.premium { offers = []; selectedProductID = nil }
        } catch { notice = .savePending }
    }

    private func saveVerifiedGrant(using continuity: FamilyPurchaseContinuity, success: FamilyStorefrontNotice) async {
        let state = await continuity.accessState()
        let patch = FamilyAppleAccessUpdate(active: true, lastAuthoritativeRefresh: state.lastAppleRefresh, source: .purchaseOrRestore)
        if await saveApple(patch, success: success) { phase = .alreadyOpen; offers = []; selectedProductID = nil }
    }

    private func saveApple(_ patch: FamilyAppleAccessUpdate, success: FamilyStorefrontNotice?) async -> Bool {
        do {
            applyApple(try await persistAppleAccess(patch))
            notice = success
            return true
        } catch {
            pendingPatch = patch; pendingSuccess = success; needsSaveRetry = true
            phase = .unavailable; notice = .savePending
            return false
        }
    }
    private func applyApple(_ saved: NativeFamilyAppleAccess) {
        if saved.active { access.grants.insert(.apple); awaitingApproval = false }
        else { access.grants.remove(.apple) }
        if let checked = saved.checkedAt { access.appleCheckedAt = checked }
    }
    private static func failure(_ error: Error) -> FamilyPurchaseFailure {
        (error as? FamilyPurchaseFailure) ?? .failed
    }
    private static func notice(_ failure: FamilyPurchaseFailure) -> FamilyStorefrontNotice {
        switch failure {
        case .cancelled: return .cancelled
        case .pending: return .pending
        default: return .failure(failure)
        }
    }
}
