import Foundation
import XCTest
@testable import SonaFamilyMigration

private actor SyntheticPurchaseGate {
    private var held = false
    private var released = false
    private var waiters: [CheckedContinuation<Void, Never>] = []
    private var entered: [CheckedContinuation<Void, Never>] = []
    func hold() async {
        if released { return }
        held = true; entered.forEach { $0.resume() }; entered = []
        await withCheckedContinuation { waiters.append($0) }
    }
    func waitUntilHeld() async {
        if held { return }
        await withCheckedContinuation { entered.append($0) }
    }
    func release() { released = true; waiters.forEach { $0.resume() }; waiters = [] }
}

private actor SyntheticPurchaseClient: FamilyPurchaseClient {
    // All products, receipts, account labels and counts here are synthetic.
    private(set) var configureCalls = 0, infoCalls = 0, restoreCalls = 0, purchaseCalls = 0
    private(set) var existingAnonymousIdentity = "$RCAnonymousID:synthetic-existing"
    private(set) var purchasedIdentifiers: [String] = []
    private let infoResult: Result<FamilyPurchaseCustomerInfo, FamilyPurchaseFailure>
    private let restoreResult: Result<FamilyPurchaseCustomerInfo, FamilyPurchaseFailure>
    private let purchaseResult: Result<FamilyPurchaseCustomerInfo, FamilyPurchaseFailure>
    private let restoreGate: SyntheticPurchaseGate?
    private let infoGate: SyntheticPurchaseGate?
    private let purchaseGate: SyntheticPurchaseGate?
    private let configurationFailure: FamilyPurchaseFailure?
    init(info: Result<FamilyPurchaseCustomerInfo, FamilyPurchaseFailure> = .success(FamilyPurchaseCustomerInfo()),
         restore: Result<FamilyPurchaseCustomerInfo, FamilyPurchaseFailure> = .success(FamilyPurchaseCustomerInfo()),
         purchase: Result<FamilyPurchaseCustomerInfo, FamilyPurchaseFailure> = .success(FamilyPurchaseCustomerInfo()),
         restoreGate: SyntheticPurchaseGate? = nil, purchaseGate: SyntheticPurchaseGate? = nil,
         infoGate: SyntheticPurchaseGate? = nil,
         configurationFailure: FamilyPurchaseFailure? = nil) {
        infoResult = info; restoreResult = restore; purchaseResult = purchase
        self.restoreGate = restoreGate; self.purchaseGate = purchaseGate
        self.infoGate = infoGate
        self.configurationFailure = configurationFailure
    }
    func configurePreservingIdentity() async throws {
        configureCalls += 1
        if let configurationFailure { throw configurationFailure }
    }
    func customerInfo() async throws -> FamilyPurchaseCustomerInfo {
        infoCalls += 1; await infoGate?.hold(); return try infoResult.get()
    }
    func restorePurchases() async throws -> FamilyPurchaseCustomerInfo {
        restoreCalls += 1
        await restoreGate?.hold()
        return try restoreResult.get()
    }
    func purchase(product: FamilyStoreProduct) async throws -> FamilyPurchaseCustomerInfo {
        purchaseCalls += 1; purchasedIdentifiers.append(product.identifier)
        await purchaseGate?.hold()
        return try purchaseResult.get()
    }
    func counts() -> [Int] { [configureCalls, infoCalls, restoreCalls, purchaseCalls] }
}

final class FamilyPurchaseContinuityTests: XCTestCase {
    private let instant = Date(timeIntervalSince1970: 1_800_000_000)
    private let monthly = FamilyStoreProduct(identifier: FamilyStoreProductID.monthly,
        localizedPrice: "CHF 12.40", billingPeriod: .month,
        introductoryOffer: .free(FamilyTrialPeriod(count: 1, unit: .week)))
    private func full(_ product: String = FamilyStoreProductID.monthly) -> FamilyPurchaseCustomerInfo {
        FamilyPurchaseCustomerInfo(activeEntitlements: ["full": FamilyPurchaseEntitlement(productIdentifier: product)])
    }
    private var allGrants: FamilyAccessState {
        FamilyAccessState(grants: Set(FamilyAccessGrant.allCases), stripeEmail: "synthetic@example.invalid",
                          lastAppleRefresh: instant.addingTimeInterval(-100_000))
    }

    func testParentActionIsRequiredBeforeRestoreOrPurchase() async {
        let client = SyntheticPurchaseClient(), controller = FamilyPurchaseContinuity(client: client)
        let restore = await controller.restore(parentInitiated: false)
        let buy = await controller.purchase(product: monthly, parentInitiated: false)
        XCTAssertEqual(restore, .failed(.parentActionRequired))
        XCTAssertEqual(buy, .failed(.parentActionRequired))
        let counts = await client.counts(); XCTAssertEqual(counts, [0, 0, 0, 0])
    }

    func testRestoreRecognizesMonthlyAnnualAndLifetimeThroughFullEntitlement() async {
        for product in [FamilyStoreProductID.monthly, FamilyStoreProductID.annual, FamilyStoreProductID.lifetime] {
            let info = full(product), client = SyntheticPurchaseClient(restore: .success(full(product)))
            let controller = FamilyPurchaseContinuity(client: client)
            let result = await controller.restore(parentInitiated: true)
            XCTAssertEqual(result, .restored(info))
            let access = await controller.accessState()
            XCTAssertEqual(access.grants, [.apple])
            XCTAssertNil(access.lastAppleRefresh) // Restore does not stamp quiet refresh's check clock.
            let counts = await client.counts(); XCTAssertEqual(counts, [1, 0, 1, 0])
        }
    }

    func testFalseRestorePreservesCachedAppleAndEveryOtherGrant() async {
        let client = SyntheticPurchaseClient(), original = allGrants
        let controller = FamilyPurchaseContinuity(client: client, initialAccess: original)
        let result = await controller.restore(parentInitiated: true)
        XCTAssertEqual(result, .noActivePurchase)
        let access = await controller.accessState(); XCTAssertEqual(access, original)
    }

    func testWrongEntitlementOrKnownProductWithoutFullNeverGrants() async {
        let info = FamilyPurchaseCustomerInfo(activeEntitlements: [
            "premium": FamilyPurchaseEntitlement(productIdentifier: FamilyStoreProductID.lifetime)
        ])
        let client = SyntheticPurchaseClient(restore: .success(info))
        let controller = FamilyPurchaseContinuity(client: client)
        let result = await controller.restore(parentInitiated: true)
        XCTAssertEqual(result, .noActivePurchase)
        let access = await controller.accessState(); XCTAssertFalse(access.premium)
    }

    func testAuthoritativeInactiveRefreshRemovesOnlyAppleAndStampsRealAnswer() async {
        let at = instant, controller = FamilyPurchaseContinuity(client: SyntheticPurchaseClient(), initialAccess: allGrants, now: { at })
        let result = await controller.refresh(force: true)
        XCTAssertTrue(result.authoritative)
        XCTAssertEqual(result.access.grants, allGrants.grants.subtracting([.apple]))
        XCTAssertEqual(result.access.lastAppleRefresh, instant)
        XCTAssertTrue(result.access.premium)
    }

    func testOfflineRefreshAndRestorePreserveGrantsAndDoNotStampAttempt() async {
        let client = SyntheticPurchaseClient(info: .failure(.offline), restore: .failure(.offline))
        let at = instant, original = allGrants
        let controller = FamilyPurchaseContinuity(client: client, initialAccess: original, now: { at })
        let first = await controller.refresh(force: true)
        XCTAssertFalse(first.authoritative)
        XCTAssertEqual(first.failure, .offline)
        XCTAssertEqual(first.access, original)
        let restored = await controller.restore(parentInitiated: true)
        XCTAssertEqual(restored, .failed(.offline))
        let second = await controller.refresh()
        XCTAssertEqual(second.access, original)
        let counts = await client.counts(); XCTAssertEqual(counts, [1, 2, 1, 0])
    }

    func testRecentSubscriptionCacheUsesSixHourCadenceAndForceStillAsks() async {
        let client = SyntheticPurchaseClient(), at = instant
        let cached = FamilyAccessState(grants: [.apple], lastAppleRefresh: instant.addingTimeInterval(-60))
        let controller = FamilyPurchaseContinuity(client: client, initialAccess: cached, now: { at })
        let first = await controller.refresh()
        XCTAssertTrue(first.usedRecentCache)
        XCTAssertEqual(first.access, cached)
        let before = await client.counts(); XCTAssertEqual(before, [0, 0, 0, 0])
        let second = await controller.refresh(force: true)
        XCTAssertTrue(second.authoritative)
        XCTAssertFalse(second.access.grants.contains(.apple))
        let after = await client.counts(); XCTAssertEqual(after, [1, 1, 0, 0])
    }

    func testExactlySixHoursRechecksAndPermanentPromiseAloneDoesNotSkipLookup() async {
        let at = instant
        for grants: Set<FamilyAccessGrant> in [[.apple], [.grandfathered]] {
            let client = SyntheticPurchaseClient()
            let state = FamilyAccessState(grants: grants, lastAppleRefresh: instant.addingTimeInterval(-FamilyPurchaseContinuity.refreshInterval))
            let controller = FamilyPurchaseContinuity(client: client, initialAccess: state, now: { at })
            let result = await controller.refresh()
            XCTAssertTrue(result.authoritative)
            let counts = await client.counts(); XCTAssertEqual(counts[1], 1)
        }
    }

    func testConcurrentRestoreTapsCoalesceAndIdentityIsUnchanged() async throws {
        let gate = SyntheticPurchaseGate(), info = full()
        let client = SyntheticPurchaseClient(restore: .success(info), restoreGate: gate)
        let controller = FamilyPurchaseContinuity(client: client)
        let first = Task { await controller.restore(parentInitiated: true) }
        await gate.waitUntilHeld()
        let others = (0..<12).map { _ in Task { await controller.restore(parentInitiated: true) } }
        // Client is deliberately held, allowing all concurrent callers to join.
        try await Task.sleep(for: .milliseconds(20))
        let during = await client.counts(); XCTAssertEqual(during, [1, 0, 1, 0])
        await gate.release()
        let firstResult = await first.value; XCTAssertEqual(firstResult, .restored(info))
        for other in others { let result = await other.value; XCTAssertEqual(result, .restored(info)) }
        let after = await client.counts(); XCTAssertEqual(after, [1, 0, 1, 0])
        let identity = await client.existingAnonymousIdentity
        XCTAssertEqual(identity, "$RCAnonymousID:synthetic-existing")
    }

    func testNegativeRefreshStartedBeforeRestoreCannotEraseNewGrantButLaterNegativeCan() async throws {
        let gate = SyntheticPurchaseGate(), at = instant
        let client = SyntheticPurchaseClient(restore: .success(full()), infoGate: gate)
        let initial = FamilyAccessState(grants: [.stripe, .grandfathered], lastAppleRefresh: instant.addingTimeInterval(-100_000))
        let controller = FamilyPurchaseContinuity(client: client, initialAccess: initial, now: { at })
        let first = Task { await controller.refresh(force: true) }
        await gate.waitUntilHeld()
        let coalesced = Task { await controller.refresh(force: true) }
        try await Task.sleep(for: .milliseconds(20))
        let restored = await controller.restore(parentInitiated: true)
        XCTAssertEqual(restored, .restored(full()))
        await gate.release()
        for result in [await first.value, await coalesced.value] {
            XCTAssertTrue(result.ignoredObsoleteAnswer)
            XCTAssertFalse(result.authoritative)
            XCTAssertEqual(result.access.grants, [.apple, .stripe, .grandfathered])
            XCTAssertEqual(result.access.lastAppleRefresh, initial.lastAppleRefresh)
        }
        let later = await controller.refresh(force: true)
        XCTAssertTrue(later.authoritative); XCTAssertFalse(later.ignoredObsoleteAnswer)
        XCTAssertEqual(later.access.grants, [.stripe, .grandfathered])
        XCTAssertEqual(later.access.lastAppleRefresh, instant)
        let counts = await client.counts(); XCTAssertEqual(counts, [1, 2, 1, 0])
    }

    func testNegativeRefreshStartedBeforePurchaseCannotEraseNewFullEntitlement() async {
        let gate = SyntheticPurchaseGate()
        let client = SyntheticPurchaseClient(purchase: .success(full()), infoGate: gate)
        let controller = FamilyPurchaseContinuity(client: client)
        let refresh = Task { await controller.refresh(force: true) }
        await gate.waitUntilHeld()
        let purchased = await controller.purchase(product: monthly, parentInitiated: true)
        XCTAssertEqual(purchased, .purchased(full()))
        await gate.release()
        let result = await refresh.value
        XCTAssertTrue(result.ignoredObsoleteAnswer)
        XCTAssertEqual(result.access.grants, [.apple])
        XCTAssertNil(result.access.lastAppleRefresh)
    }

    func testCancellationPendingAndFailuresNeverMakeASecondPurchaseOrRestore() async {
        for failure: FamilyPurchaseFailure in [.cancelled, .pending, .offline, .failed, .notAllowed, .unavailable] {
            let client = SyntheticPurchaseClient(purchase: .failure(failure))
            let controller = FamilyPurchaseContinuity(client: client, initialAccess: allGrants)
            let result = await controller.purchase(product: monthly, parentInitiated: true)
            XCTAssertEqual(result, .failed(failure))
            let access = await controller.accessState(); XCTAssertEqual(access, allGrants)
            let counts = await client.counts(); XCTAssertEqual(counts, [1, 0, 0, 1])
        }
    }

    func testPurchaseFullGrantsAppleAndPreservesOtherSources() async {
        let info = full(), client = SyntheticPurchaseClient(purchase: .success(full()))
        let initial = FamilyAccessState(grants: [.stripe, .founder], stripeEmail: "synthetic@example.invalid")
        let controller = FamilyPurchaseContinuity(client: client, initialAccess: initial)
        let result = await controller.purchase(product: monthly, parentInitiated: true)
        XCTAssertEqual(result, .purchased(info))
        let access = await controller.accessState(); XCTAssertEqual(access.grants, [.stripe, .founder, .apple])
        let ids = await client.purchasedIdentifiers; XCTAssertEqual(ids, [FamilyStoreProductID.monthly])
        let counts = await client.counts(); XCTAssertEqual(counts, [1, 0, 0, 1])
    }

    func testMissingPurchaseEntitlementPerformsOneRefreshInsteadOfBuyingAgain() async {
        let info = full(), client = SyntheticPurchaseClient(info: .success(full()))
        let controller = FamilyPurchaseContinuity(client: client)
        let result = await controller.purchase(product: monthly, parentInitiated: true)
        XCTAssertEqual(result, .purchased(info))
        let counts = await client.counts(); XCTAssertEqual(counts, [1, 1, 0, 1])
    }

    func testMissingPurchaseAndAuthoritativeNoFullIsNotEntitledAndRevokesOnlyApple() async {
        let client = SyntheticPurchaseClient(), controller = FamilyPurchaseContinuity(client: client, initialAccess: allGrants)
        let result = await controller.purchase(product: monthly, parentInitiated: true)
        XCTAssertEqual(result, .failed(.notEntitled))
        let access = await controller.accessState()
        XCTAssertEqual(access.grants, allGrants.grants.subtracting([.apple]))
        let counts = await client.counts(); XCTAssertEqual(counts, [1, 1, 0, 1])
    }

    func testCachedStripeOrAppleOnFailedPurchaseVerificationCannotClaimANewSale() async {
        // The shipping fallback returns cached isSubscribed() on network failure;
        // this local core deliberately reports pending verification instead of
        // counting a sale from unrelated cache, without removing any grant.
        for grant: FamilyAccessGrant in [.stripe, .apple] {
            let client = SyntheticPurchaseClient(info: .failure(.offline))
            let initial = FamilyAccessState(grants: [grant])
            let controller = FamilyPurchaseContinuity(client: client, initialAccess: initial)
            let result = await controller.purchase(product: monthly, parentInitiated: true)
            XCTAssertEqual(result, .failed(.verificationPending))
            let access = await controller.accessState(); XCTAssertEqual(access, initial)
            let counts = await client.counts(); XCTAssertEqual(counts, [1, 1, 0, 1])
        }
    }

    func testAlreadyPurchasedRecoversWithRestoreButDoesNotCountNewSale() async {
        let info = full(FamilyStoreProductID.lifetime)
        let client = SyntheticPurchaseClient(restore: .success(info), purchase: .failure(.alreadyPurchased))
        let controller = FamilyPurchaseContinuity(client: client)
        let result = await controller.purchase(product: monthly, parentInitiated: true)
        XCTAssertEqual(result, .restored(info))
        let counts = await client.counts(); XCTAssertEqual(counts, [1, 0, 1, 1])
    }

    func testAlreadyPurchasedWithNoFullPreservesCacheAndReportsNotEntitled() async {
        let client = SyntheticPurchaseClient(purchase: .failure(.alreadyPurchased))
        let controller = FamilyPurchaseContinuity(client: client, initialAccess: allGrants)
        let result = await controller.purchase(product: monthly, parentInitiated: true)
        XCTAssertEqual(result, .failed(.notEntitled))
        let access = await controller.accessState(); XCTAssertEqual(access, allGrants)
        let counts = await client.counts(); XCTAssertEqual(counts, [1, 0, 1, 1])
    }

    func testPurchaseInFlightBlocksAnotherPurchaseAndRestoreWithoutOpeningSheets() async {
        let gate = SyntheticPurchaseGate(), client = SyntheticPurchaseClient(purchase: .success(full()), purchaseGate: gate)
        let controller = FamilyPurchaseContinuity(client: client), product = monthly
        let first = Task { await controller.purchase(product: product, parentInitiated: true) }
        await gate.waitUntilHeld()
        let second = await controller.purchase(product: product, parentInitiated: true)
        let restored = await controller.restore(parentInitiated: true)
        XCTAssertEqual(second, .failed(.busy)); XCTAssertEqual(restored, .failed(.busy))
        await gate.release(); _ = await first.value
        let counts = await client.counts(); XCTAssertEqual(counts, [1, 0, 0, 1])
    }

    func testConfigureFailureDoesNotResetIdentityOrPreventAlreadyWorkingOperation() async {
        let client = SyntheticPurchaseClient(restore: .success(full()), configurationFailure: .failed)
        let controller = FamilyPurchaseContinuity(client: client)
        let result = await controller.restore(parentInitiated: true)
        XCTAssertEqual(result, .restored(full()))
        let identity = await client.existingAnonymousIdentity
        XCTAssertEqual(identity, "$RCAnonymousID:synthetic-existing")
    }

    func testStripeAccountMatchingAndCaseloadRevocationNeverTouchOtherGrants() {
        let original = allGrants
        XCTAssertEqual(original.applying(.stripeVerification(active: false, email: "partner@example.invalid")), original)
        let stripeOff = original.applying(.stripeVerification(active: false, email: "SYNTHETIC@EXAMPLE.INVALID"))
        XCTAssertEqual(stripeOff.grants, original.grants.subtracting([.stripe]))
        let caseloadOff = original.applying(.caseloadVerification(active: false))
        XCTAssertEqual(caseloadOff.grants, original.grants.subtracting([.caseload]))
        XCTAssertEqual(original.applying(.stripeVerification(active: nil, email: "synthetic@example.invalid")), original)
        XCTAssertEqual(original.applying(.caseloadVerification(active: nil)), original)
        XCTAssertEqual(original.applying(.lookupFailed), original)
    }

    func testTrialTermsUseInjectedPricesAndUnknownEligibilityIsQualified() {
        let unknown = monthly.terms(eligibility: .unknown)
        XCTAssertEqual(unknown.price, "CHF 12.40")
        XCTAssertEqual(unknown.trial?.displayText, "7 days")
        XCTAssertTrue(unknown.qualifiesTrialForNewSubscribers)
        XCTAssertFalse(unknown.canPromiseNoPaymentToday)
        XCTAssertEqual(unknown.trialDisclosure, "Only new subscribers get 7 days free. Otherwise Apple charges CHF 12.40 today. Apple shows your exact terms before you confirm.")
        let certain = monthly.terms(eligibility: .eligible)
        XCTAssertTrue(certain.sure); XCTAssertTrue(certain.canPromiseNoPaymentToday)
        XCTAssertFalse(certain.qualifiesTrialForNewSubscribers)
        for eligibility: FamilyIntroductoryEligibility in [.ineligible, .noIntroOffer] {
            let terms = monthly.terms(eligibility: eligibility)
            XCTAssertEqual(terms.state, .chargedToday)
            XCTAssertNil(terms.trial); XCTAssertNil(terms.trialDisclosure)
            XCTAssertEqual(terms.price, "CHF 12.40")
        }
    }

    func testInvalidOrUnpricedProductsAreNotSoldAndIntroductoryDiscountIsNotCalledFree() async {
        let invalid = [
            FamilyStoreProduct(identifier: "synthetic-wrong-product", localizedPrice: "¥1,234", billingPeriod: .month),
            FamilyStoreProduct(identifier: FamilyStoreProductID.monthly, localizedPrice: " ", billingPeriod: .month),
            FamilyStoreProduct(identifier: FamilyStoreProductID.annual, localizedPrice: "¥1,234", billingPeriod: .month),
            FamilyStoreProduct(identifier: FamilyStoreProductID.lifetime, localizedPrice: "¥1,234", billingPeriod: .once,
                introductoryOffer: .free(FamilyTrialPeriod(count: 2, unit: .day)))
        ]
        let client = SyntheticPurchaseClient(), controller = FamilyPurchaseContinuity(client: client)
        for product in invalid {
            XCTAssertEqual(product.terms(eligibility: .eligible).state, .unavailable)
            let result = await controller.purchase(product: product, parentInitiated: true)
            XCTAssertEqual(result, .failed(.unavailable))
        }
        let discounted = FamilyStoreProduct(identifier: FamilyStoreProductID.monthly, localizedPrice: "¥1,234", billingPeriod: .month, introductoryOffer: .paid)
        XCTAssertEqual(discounted.terms(eligibility: .unknown).state, .unavailable)
        XCTAssertEqual(discounted.terms(eligibility: .ineligible).state, .chargedToday)
        let counts = await client.counts(); XCTAssertEqual(counts, [0, 0, 0, 0])
    }

    func testTrialPeriodValidationAndLifetimeHasNoTrialOrEligibilityPromise() {
        XCTAssertEqual(FamilyTrialPeriod(count: 2, unit: .week).displayText, "14 days")
        XCTAssertNil(FamilyTrialPeriod(count: 5, unit: .week).displayText)
        XCTAssertNil(FamilyTrialPeriod(count: 0, unit: .day).displayText)
        XCTAssertNil(FamilyTrialPeriod(count: 13, unit: .month).displayText)
        let lifetime = FamilyStoreProduct(identifier: FamilyStoreProductID.lifetime, localizedPrice: "¥1,234", billingPeriod: .once)
        let terms = lifetime.terms(eligibility: .unknown)
        XCTAssertEqual(terms.state, .chargedToday); XCTAssertEqual(terms.price, "¥1,234")
        XCTAssertNil(terms.trial); XCTAssertFalse(terms.canPromiseNoPaymentToday)
        XCTAssertEqual(monthly.terms(eligibility: .eligible, alreadyOwned: true).state, .owned)
        XCTAssertNil(monthly.terms(eligibility: .eligible, alreadyOwned: true).price)
    }
}
