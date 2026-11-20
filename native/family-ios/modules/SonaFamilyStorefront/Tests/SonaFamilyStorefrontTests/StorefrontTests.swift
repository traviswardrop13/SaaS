import XCTest
import SonaFamilyMigration
import SonaFamilyAccess
@testable import SonaFamilyStorefront

private actor SyntheticStoreClient: FamilyStorefrontClient {
    var configureCount = 0, lookupCount = 0, catalogCount = 0, buyCount = 0, restoreCount = 0
    var answer = FamilyPurchaseCustomerInfo()
    var restored = FamilyPurchaseCustomerInfo()
    var bought = FamilyPurchaseCustomerInfo(activeEntitlements: ["full": .init(productIdentifier: FamilyStoreProductID.monthly)])
    var lookupError: FamilyPurchaseFailure?
    var buyError: FamilyPurchaseFailure?
    var catalogValue: FamilyStorefrontCatalog
    init(_ catalog: FamilyStorefrontCatalog) { catalogValue = catalog }
    func configurePreservingIdentity() async throws { configureCount += 1 }
    func customerInfo() async throws -> FamilyPurchaseCustomerInfo {
        lookupCount += 1; if let lookupError { throw lookupError }; return answer
    }
    func restorePurchases() async throws -> FamilyPurchaseCustomerInfo { restoreCount += 1; return restored }
    func purchase(product: SonaFamilyMigration.FamilyStoreProduct) async throws -> FamilyPurchaseCustomerInfo {
        buyCount += 1; if let buyError { throw buyError }; return bought
    }
    func catalog(configuration: FamilyAccessConfiguration) async throws -> FamilyStorefrontCatalog { catalogCount += 1; return catalogValue }
    func setLookupError(_ error: FamilyPurchaseFailure?) { lookupError = error }
    func setBuyError(_ error: FamilyPurchaseFailure?) { buyError = error }
    func setRestored(_ info: FamilyPurchaseCustomerInfo) { restored = info }
    func setAnswer(_ info: FamilyPurchaseCustomerInfo) { answer = info }
    func counts() -> [Int] { [configureCount, lookupCount, catalogCount, buyCount, restoreCount] }
}

@MainActor final class StorefrontTests: XCTestCase {
    private func configuration() throws -> FamilyAccessConfiguration {
        var c = try FamilyAccessConfiguration.bundled(); c.freeMode = false; c.sellYearly = false; return c
    }
    private func product(_ id: String, price: String = "CHF 12.34", eligibility: FamilyIntroEligibility = .eligible) -> FamilyStorefrontProduct {
        let once = id == FamilyStoreProductID.lifetime
        let annual = id == FamilyStoreProductID.annual
        return .init(purchase: .init(identifier: id, localizedPrice: price, billingPeriod: once ? .once : annual ? .year : .month,
                                    introductoryOffer: once ? nil : .free(.init(count: 1, unit: .week))),
                     display: .init(identifier: id, localizedPrice: price,
                                    introduction: once ? .none : .free(.init(count: 1, unit: .week)), eligibility: eligibility))
    }
    private func catalog() -> FamilyStorefrontCatalog {
        let p = [product(FamilyStoreProductID.monthly), product(FamilyStoreProductID.annual), product(FamilyStoreProductID.lifetime)]
        return .init(products: p, offeringProductIDs: Set(p.map { $0.purchase.identifier }))
    }
    private func make(_ client: SyntheticStoreClient, access: FamilyEntitlementState = .init(),
                      persist: @escaping @MainActor (FamilyAppleAccessUpdate) async throws -> Void = { _ in }) throws -> FamilyStorefrontStore {
        FamilyStorefrontStore(configuration: try configuration(), initialAccess: access, client: client,
                              actualBundleIdentifier: "com.speaksona.app", persistAppleAccess: { patch in
                                  try await persist(patch)
                                  return .init(active: patch.active, checkedAt: patch.lastAuthoritativeRefresh)
                              })
    }
    func testPreviewBundleMakesZeroCallsEvenWhenClientIsSupplied() async throws {
        let client = SyntheticStoreClient(catalog())
        let store = FamilyStorefrontStore(configuration: try configuration(), initialAccess: .init(), client: client,
            actualBundleIdentifier: "com.speaksona.family.native-preview", persistAppleAccess: { _ in
                XCTFail("Preview persisted"); throw FamilyPurchaseFailure.failed
            })
        await store.load(); await store.restore(); await store.purchaseSelected()
        XCTAssertEqual(store.phase, .preview); XCTAssertFalse(store.canRestore); XCTAssertFalse(store.canPurchase)
        let counts = await client.counts(); XCTAssertEqual(counts, [0,0,0,0,0])
    }
    func testPublicInitializerCannotOverrideActualHostIdentity() async throws {
        let client = SyntheticStoreClient(catalog())
        let store = FamilyStorefrontStore(configuration: try configuration(), initialAccess: .init(), client: client,
            readAppleRevision: { XCTFail("Preview loaded a revision"); return nil }, persistAppleAccess: { _ in
                XCTFail("Preview persisted"); throw FamilyPurchaseFailure.failed
            })
        await store.load(); await store.restore()
        XCTAssertEqual(store.phase, .preview)
        let counts = await client.counts(); XCTAssertEqual(counts, [0,0,0,0,0])
    }
    func testMonthlyFirstOptionalLifetimeAnnualHiddenButConfigurationRetainsRestoreID() async throws {
        let client = SyntheticStoreClient(catalog()); let store = try make(client)
        await store.load()
        XCTAssertEqual(store.phase, .ready)
        XCTAssertEqual(store.offers.map(\.kind), [.monthly, .lifetime])
        XCTAssertEqual(store.selectedProductID, FamilyStoreProductID.monthly)
        XCTAssertTrue(try configuration().products.restorableIDs.contains(FamilyStoreProductID.annual))
    }
    func testLifetimeNotInCurrentOfferingIsNeverSold() async throws {
        let value = catalog()
        let client = SyntheticStoreClient(.init(products: value.products, offeringProductIDs: []))
        let store = try make(client); await store.load()
        XCTAssertEqual(store.offers.map(\.kind), [.monthly])
    }
    func testMissingMonthlySuppressesAllRows() async throws {
        let client = SyntheticStoreClient(.init(products: [product(FamilyStoreProductID.lifetime)], offeringProductIDs: [FamilyStoreProductID.lifetime]))
        let store = try make(client); await store.load()
        XCTAssertEqual(store.phase, .unavailable); XCTAssertTrue(store.offers.isEmpty); XCTAssertFalse(store.canPurchase)
    }
    func testUnknownEligibilityRemainsQualified() async throws {
        let client = SyntheticStoreClient(.init(products: [product(FamilyStoreProductID.monthly, eligibility: .unknown)], offeringProductIDs: []))
        let store = try make(client); await store.load()
        XCTAssertEqual(store.offers.first?.terms, .freeTrial(.init(count: 1, unit: .week), confirmedEligible: false))
    }
    func testMismatchedDisplayedAndPurchasablePriceFailsClosed() async throws {
        let first = product(FamilyStoreProductID.monthly)
        let bad = FamilyStorefrontProduct(purchase: first.purchase, display: .init(identifier: first.display.identifier, localizedPrice: "different"))
        let client = SyntheticStoreClient(.init(products: [bad], offeringProductIDs: []))
        let store = try make(client); await store.load()
        XCTAssertTrue(store.offers.isEmpty); XCTAssertFalse(store.canPurchase)
    }
    func testAuthoritativeAppleNegativePreservesEveryOtherGrant() async throws {
        var access = FamilyEntitlementState(); access.grants = Set(FamilyPremiumGrant.allCases)
        let client = SyntheticStoreClient(catalog()); var updates: [FamilyAppleAccessUpdate] = []
        let store = try make(client, access: access) { updates.append($0) }
        await store.load()
        XCTAssertFalse(store.access.grants.contains(.apple))
        XCTAssertEqual(store.access.grants, access.grants.subtracting([.apple]))
        XCTAssertEqual(updates.count, 1); XCTAssertFalse(updates[0].active)
        XCTAssertNotNil(updates[0].lastAuthoritativeRefresh)
    }

    func testStorefrontUsesPersistedPurchaseWhenItsOwnRefreshIsOld() async throws {
        let client = SyntheticStoreClient(catalog())
        let oldRevision = UUID()
        let verified = NativeFamilyAppleAccess(active: true, checkedAt: nil, revision: UUID())
        let store = FamilyStorefrontStore(configuration: try configuration(), initialAccess: .init(), client: client,
            actualBundleIdentifier: "com.speaksona.app", readAppleRevision: { oldRevision }, persistAppleAccess: { patch in
                XCTAssertEqual(patch.source, .refresh(expectedRevision: oldRevision))
                XCTAssertFalse(patch.active)
                return verified
            })
        await store.load()
        XCTAssertEqual(store.phase, .alreadyOpen)
        XCTAssertTrue(store.access.grants.contains(.apple))
        XCTAssertNil(store.access.appleCheckedAt)
        XCTAssertFalse(store.canPurchase)
        let counts = await client.counts()
        XCTAssertEqual(counts[2], 0)
    }
    func testOfflinePreservesCachedAppleAndOtherGrantsAndClock() async throws {
        var access = FamilyEntitlementState(); access.grants = [.apple, .founder, .stripe]
        access.appleCheckedAt = Date(timeIntervalSince1970: 1234)
        let client = SyntheticStoreClient(catalog()); await client.setLookupError(.offline)
        let store = try make(client, access: access) { _ in XCTFail("Offline persisted a new answer") }
        await store.load()
        XCTAssertEqual(store.access.grants, access.grants); XCTAssertEqual(store.access.appleCheckedAt, access.appleCheckedAt)
    }
    func testEmptyRestoreDoesNotRevokeCachedApple() async throws {
        var access = FamilyEntitlementState(); access.grants = [.apple, .stripe]
        let client = SyntheticStoreClient(catalog()); let store = try make(client, access: access) { _ in XCTFail("Empty restore persisted") }
        await store.restore()
        XCTAssertEqual(store.notice, .noActivePurchase); XCTAssertEqual(store.access.grants, access.grants)
        let counts = await client.counts(); XCTAssertEqual(counts[4], 1)
    }
    func testPurchasePersistsBeforeSuccessAndDoesNotOverwriteUpdatedTherapistAccess() async throws {
        let client = SyntheticStoreClient(catalog()); var persisted: [FamilyAppleAccessUpdate] = []
        let store = try make(client) { persisted.append($0) }
        await store.load()
        var fresh = store.access; fresh.verifiedClinician = true; fresh.keepsFreeVersion = true
        store.updateAccess(fresh)
        await store.purchaseSelected()
        XCTAssertEqual(store.notice, .purchased); XCTAssertTrue(store.access.grants.contains(.apple))
        XCTAssertTrue(store.access.verifiedClinician); XCTAssertTrue(store.access.keepsFreeVersion)
        XCTAssertTrue(persisted.last?.active == true)
        let counts = await client.counts(); XCTAssertEqual(counts[3], 1)
    }
    func testFailedSaveRetriesPersistenceWithoutBuyingTwice() async throws {
        let client = SyntheticStoreClient(catalog()); var fail = false; var saves = 0
        let store = try make(client) { _ in saves += 1; if fail { throw FamilyPurchaseFailure.failed } }
        await store.load(); fail = true; await store.purchaseSelected()
        XCTAssertTrue(store.needsSaveRetry); XCTAssertFalse(store.canPurchase); XCTAssertEqual(store.notice, .savePending)
        fail = false; await store.retrySave()
        XCTAssertFalse(store.needsSaveRetry); XCTAssertEqual(store.notice, .purchased)
        let counts = await client.counts(); XCTAssertEqual(counts[3], 1); XCTAssertEqual(saves, 3)
    }
    func testPendingCannotTriggerASecondPurchase() async throws {
        let client = SyntheticStoreClient(catalog()); await client.setBuyError(.pending)
        let store = try make(client); await store.load(); await store.purchaseSelected(); await store.purchaseSelected()
        XCTAssertEqual(store.notice, .pending); XCTAssertTrue(store.awaitingApproval); XCTAssertFalse(store.canPurchase)
        let counts = await client.counts(); XCTAssertEqual(counts[3], 1)
    }
    func testCancellationDoesNotInventAnAppleGrant() async throws {
        let client = SyntheticStoreClient(catalog()); await client.setBuyError(.cancelled)
        let store = try make(client); await store.load(); await store.purchaseSelected()
        XCTAssertEqual(store.notice, .cancelled); XCTAssertFalse(store.access.grants.contains(.apple))
        let counts = await client.counts(); XCTAssertEqual(counts[3], 1); XCTAssertEqual(counts[4], 0)
    }
    func testAnnualRestoreUsesFullEntitlementWithoutAnnualSaleRow() async throws {
        let client = SyntheticStoreClient(catalog())
        await client.setRestored(.init(activeEntitlements: ["full": .init(productIdentifier: FamilyStoreProductID.annual)]))
        let store = try make(client); await store.restore()
        XCTAssertEqual(store.notice, .restored); XCTAssertTrue(store.access.grants.contains(.apple))
        XCTAssertTrue(store.offers.isEmpty)
    }
    func testFreeModeDoesNotConfigureOrSell() async throws {
        var config = try configuration(); config.freeMode = true
        let client = SyntheticStoreClient(catalog())
        let store = FamilyStorefrontStore(configuration: config, initialAccess: .init(), client: client,
            actualBundleIdentifier: "com.speaksona.app", persistAppleAccess: { _ in
                XCTFail("Free mode persisted"); throw FamilyPurchaseFailure.failed
            })
        await store.load(); await store.purchaseSelected()
        XCTAssertEqual(store.phase, .alreadyOpen); XCTAssertFalse(store.canPurchase)
        let counts = await client.counts(); XCTAssertEqual(counts, [0,0,0,0,0])
    }
}
