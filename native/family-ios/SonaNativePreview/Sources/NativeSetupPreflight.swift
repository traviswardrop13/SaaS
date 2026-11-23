import Foundation
import Combine
import SonaFamilyAccess
import SonaFamilyMigration
import SonaFamilyStorefront

/// A single device-owned reminder service supplies these actions. Merely
/// entering setup never asks permission or schedules a notification.
@MainActor struct NativeSetupReminderActions {
    var refreshAuthorization: () async -> Void
    var shouldOfferSetup: (_ priceFollows: Bool, _ confirmedFreeTrial: Bool) -> Bool
    var enableReminders: () async -> Bool

    static var unavailable: Self {
        .init(refreshAuthorization: {}, shouldOfferSetup: { _, _ in false }, enableReminders: { false })
    }
}

/// Ready starts three independent quiet reads. A timeout releases Continue,
/// while a late answer can update facts without taking a navigation action.
@MainActor final class NativeSetupPreflight: ObservableObject {
    @Published private(set) var busy = false
    @Published private(set) var confirmedFreeTrial = false
    private var owner: String?
    private var generation: UUID?
    private var remaining = 0
    private var jobs: [Task<Void, Never>] = []
    private var deadline: Task<Void, Never>?
    private let wait: (Double) async -> Void

    init(wait: @escaping (Double) async -> Void = { milliseconds in
        try? await Task.sleep(nanoseconds: UInt64(max(0, milliseconds) * 1_000_000))
    }) { self.wait = wait }

    deinit { jobs.forEach { $0.cancel() }; deadline?.cancel() }

    func start(owner: String, eligiblePath: Bool,
               isCurrent: @escaping () -> Bool,
               ownership: @escaping () async -> Void,
               monthlyTrial: @escaping () async -> Bool,
               notificationStatus: @escaping () async -> Void) {
        guard self.owner != owner else { return }
        reset()
        self.owner = owner
        guard eligiblePath else { return }
        let token = UUID()
        generation = token; remaining = 3; busy = true
        let wait = self.wait
        deadline = Task { [weak self] in
            await wait(2_500)
            guard !Task.isCancelled, let self, self.generation == token else { return }
            self.busy = false
        }
        jobs = [
            Task { [weak self] in
                await ownership()
                self?.finished(token)
            },
            Task { [weak self] in
                let answer = await monthlyTrial()
                guard !Task.isCancelled, let self, self.generation == token else { return }
                if isCurrent() { self.confirmedFreeTrial = answer }
                self.finished(token)
            },
            Task { [weak self] in
                await notificationStatus()
                self?.finished(token)
            }
        ]
    }

    func reset() {
        generation = nil; owner = nil
        jobs.forEach { $0.cancel() }; jobs = []
        deadline?.cancel(); deadline = nil
        busy = false; confirmedFreeTrial = false; remaining = 0
    }

    private func finished(_ token: UUID) {
        guard generation == token else { return }
        remaining -= 1
        if remaining == 0 { deadline?.cancel(); deadline = nil; busy = false }
    }
}

/// Uses the existing configured identity, catalog validation and persistent
/// Apple revision fence. This quiet probe never calls Restore or purchase.
@MainActor final class NativeSetupStoreProbe {
    private let client: (any FamilyStorefrontClient)?
    private let configuration: FamilyAccessConfiguration
    private let readRevision: () async throws -> UUID?
    private let persist: (FamilyAppleAccessUpdate) async throws -> Void
    private let isCurrent: () -> Bool
    private let now: () -> Date
    private var configuring: Task<Void, Error>?

    init(client: (any FamilyStorefrontClient)?, configuration: FamilyAccessConfiguration,
         readRevision: @escaping () async throws -> UUID?,
         persist: @escaping (FamilyAppleAccessUpdate) async throws -> Void,
         isCurrent: @escaping () -> Bool, now: @escaping () -> Date = { Date() }) {
        self.client = client; self.configuration = configuration
        self.readRevision = readRevision; self.persist = persist
        self.isCurrent = isCurrent; self.now = now
    }

    private func configured() async throws -> any FamilyStorefrontClient {
        guard let client else { throw FamilyPurchaseFailure.unavailable }
        if configuring == nil { configuring = Task { try await client.configurePreservingIdentity() } }
        try await configuring!.value
        try Task.checkCancellation()
        return client
    }

    func checkOwnership() async {
        do {
            let revision = try await readRevision()
            let client = try await configured()
            let info = try await client.customerInfo()
            try Task.checkCancellation()
            guard isCurrent() else { return }
            try await persist(.init(active: info.hasFullEntitlement, lastAuthoritativeRefresh: now(),
                                    source: .refresh(expectedRevision: revision)))
        } catch { /* An unanswered lookup never becomes a negative answer. */ }
    }

    func confirmedMonthlyTrial() async -> Bool {
        do {
            let client = try await configured()
            let catalog = try await client.catalog(configuration: configuration)
            try Task.checkCancellation()
            guard isCurrent(), !configuration.freeMode else { return false }
            let products = catalog.products.filter {
                $0.purchase.isRecognizedAndPriced && $0.purchase.identifier == $0.display.identifier &&
                $0.purchase.localizedPrice == $0.display.localizedPrice
            }
            let offers = FamilyStoreCompatibility.offers(configuration: configuration,
                products: products.map(\.display), offeringProductIDs: catalog.offeringProductIDs)
            guard let monthly = offers.first(where: { $0.kind == .monthly }),
                  case .freeTrial(let shown, confirmedEligible: true) = monthly.terms,
                  let product = products.first(where: { $0.purchase.identifier == monthly.productID }),
                  case .free(let actual)? = product.purchase.introductoryOffer,
                  let unit = FamilyTrialUnit(rawValue: shown.unit.rawValue),
                  let actualText = actual.displayText,
                  actualText == FamilyTrialPeriod(count: shown.count, unit: unit).displayText else { return false }
            return true
        } catch { return false }
    }
}
