import Foundation
import Combine
import XCTest
@testable import SetupPreflightHarness
import SonaFamilyAccess
@testable import SonaFamilyMigration
import SonaFamilyStorefront

@MainActor private final class Held<Value> {
    let started: XCTestExpectation
    var continuation: CheckedContinuation<Value, Never>?
    init(_ name: String) { started = XCTestExpectation(description: name) }
    func read() async -> Value {
        started.fulfill()
        return await withCheckedContinuation { continuation = $0 }
    }
    func reply(_ value: Value) { continuation?.resume(returning: value); continuation = nil }
}
@MainActor private final class ManualClock {
    let started = XCTestExpectation(description: "deadline wait began")
    var requested: [Double] = []
    var waits: [CheckedContinuation<Void, Never>] = []
    func wait(_ milliseconds: Double) async {
        guard !Task.isCancelled else { return }
        requested.append(milliseconds)
        started.fulfill()
        await withCheckedContinuation { waits.append($0) }
    }
    func fire() { let pending = waits; waits = []; pending.forEach { $0.resume() } }
}

private actor QuietStoreClient: FamilyStorefrontClient {
    struct Counts: Sendable { var configure = 0, info = 0, catalog = 0, restore = 0, buy = 0 }
    var counts = Counts()
    var info: FamilyPurchaseCustomerInfo
    var products: FamilyStorefrontCatalog
    var infoFailure: FamilyPurchaseFailure?
    var holdConfiguration = false, holdInfo = false
    var configurationStarted: XCTestExpectation?, infoStarted: XCTestExpectation?
    var configurationWaiter: CheckedContinuation<Void, Never>?
    var infoWaiter: CheckedContinuation<FamilyPurchaseCustomerInfo, Error>?
    init(info: FamilyPurchaseCustomerInfo = .init(), catalog: FamilyStorefrontCatalog) { self.info = info; products = catalog }
    func setHeldConfiguration(_ started: XCTestExpectation) { holdConfiguration = true; configurationStarted = started }
    func setHeldInfo(_ started: XCTestExpectation) { holdInfo = true; infoStarted = started }
    func failInfo(_ failure: FamilyPurchaseFailure) { infoFailure = failure }
    func releaseConfiguration() { configurationWaiter?.resume(); configurationWaiter = nil }
    func replyInfo(_ value: FamilyPurchaseCustomerInfo) { infoWaiter?.resume(returning: value); infoWaiter = nil }
    func snapshot() -> Counts { counts }
    func configurePreservingIdentity() async throws {
        counts.configure += 1; configurationStarted?.fulfill()
        if holdConfiguration { await withCheckedContinuation { configurationWaiter = $0 } }
    }
    func customerInfo() async throws -> FamilyPurchaseCustomerInfo {
        counts.info += 1; infoStarted?.fulfill()
        if holdInfo { return try await withCheckedThrowingContinuation { infoWaiter = $0 } }
        if let infoFailure { throw infoFailure }
        return info
    }
    func catalog(configuration: FamilyAccessConfiguration) async throws -> FamilyStorefrontCatalog { counts.catalog += 1; return products }
    func restorePurchases() async throws -> FamilyPurchaseCustomerInfo { counts.restore += 1; throw FamilyPurchaseFailure.parentActionRequired }
    func purchase(product: SonaFamilyMigration.FamilyStoreProduct) async throws -> FamilyPurchaseCustomerInfo { counts.buy += 1; throw FamilyPurchaseFailure.parentActionRequired }
}
private final class PreflightDisk: NativeFamilyDocumentStore, @unchecked Sendable {
    var document: NativeFamilyDocument?
    func read() throws -> NativeFamilyDocument? { document }
    func commit(_ value: NativeFamilyDocument) throws { document = value }
}

@MainActor final class SetupPreflightTests: XCTestCase {
    private func config() throws -> FamilyAccessConfiguration { var value = try FamilyAccessConfiguration.bundled(); value.freeMode = false; return value }
    private func catalog(purchaseID: String = FamilyStoreProductID.monthly, displayID: String = FamilyStoreProductID.monthly,
                         billing: FamilyBillingPeriod = .month, purchasePrice: String = "Synthetic price", displayPrice: String = "Synthetic price",
                         purchaseIntro: FamilyIntroductoryOffer? = .free(.init(count: 7, unit: .day)),
                         displayIntro: FamilyStoreIntro = .free(.init(count: 7, unit: .day)),
                         eligibility: FamilyIntroEligibility = .eligible) -> FamilyStorefrontCatalog {
        .init(products: [.init(purchase: .init(identifier: purchaseID, localizedPrice: purchasePrice, billingPeriod: billing, introductoryOffer: purchaseIntro),
                               display: .init(identifier: displayID, localizedPrice: displayPrice, introduction: displayIntro, eligibility: eligibility))],
              offeringProductIDs: [purchaseID])
    }
    private func readOnly(_ client: QuietStoreClient, file: StaticString = #filePath, line: UInt = #line) async {
        let n = await client.snapshot(); XCTAssertEqual(n.restore, 0, file: file, line: line); XCTAssertEqual(n.buy, 0, file: file, line: line)
    }
    private func settle(_ predicate: () -> Bool, file: StaticString = #filePath, line: UInt = #line) async {
        for _ in 0..<100 where !predicate() { await Task.yield() }
        XCTAssertTrue(predicate(), file: file, line: line)
    }
    private func probe(_ client: QuietStoreClient?, persist: @escaping (FamilyAppleAccessUpdate) async throws -> Void = { _ in },
                       current: @escaping () -> Bool = { true }) throws -> NativeSetupStoreProbe {
        .init(client: client, configuration: try config(), readRevision: { nil }, persist: persist, isCurrent: current,
              now: { Date(timeIntervalSince1970: 5_000) })
    }

    func testThreeReadsRunInParallelAnd2500MillisecondDeadlineReleasesContinueWithoutWaitingForThem() async {
        let ownership = Held<Void>("ownership began"), monthly = Held<Bool>("monthly began"), status = Held<Void>("status began")
        let clock = ManualClock(), model = NativeSetupPreflight(wait: clock.wait)
        var waiting = true, navigationCount = 0, wasBusy = false
        let observation = model.$busy.sink { busy in
            if wasBusy && !busy && waiting { waiting = false; navigationCount += 1 }
            wasBusy = busy
        }
        model.start(owner: "fictional|first", eligiblePath: true, isCurrent: { true },
                    ownership: { await ownership.read() }, monthlyTrial: { await monthly.read() }, notificationStatus: { await status.read() })
        await fulfillment(of: [ownership.started, monthly.started, status.started, clock.started], timeout: 3)
        XCTAssertTrue(model.busy); XCTAssertFalse(model.confirmedFreeTrial)
        XCTAssertEqual(clock.requested, [2_500])
        clock.fire(); await settle { !model.busy }
        XCTAssertEqual(navigationCount, 1)
        monthly.reply(true); ownership.reply(()); status.reply(())
        await settle { model.confirmedFreeTrial }
        XCTAssertFalse(model.busy); XCTAssertEqual(navigationCount, 1, "A late fact does not navigate again")
        observation.cancel(); model.reset(); clock.fire()
    }

    func testCompletedReadsReleaseEarlyAndUnknownAnswerCannotClaimATrial() async {
        let clock = ManualClock(), model = NativeSetupPreflight(wait: clock.wait)
        model.start(owner: "fictional|first", eligiblePath: true, isCurrent: { true }, ownership: {}, monthlyTrial: { false }, notificationStatus: {})
        await settle { !model.busy }
        XCTAssertFalse(model.confirmedFreeTrial)
        clock.fire(); model.reset()
    }

    func testNoEligibleStorePathMakesNoQuietReadOrPermissionCall() async {
        let clock = ManualClock(), model = NativeSetupPreflight(wait: clock.wait)
        var calls = 0
        model.start(owner: "fictional|first", eligiblePath: false, isCurrent: { true }, ownership: { calls += 1 },
                    monthlyTrial: { calls += 1; return true }, notificationStatus: { calls += 1 })
        await Task.yield()
        XCTAssertEqual(calls, 0); XCTAssertTrue(clock.requested.isEmpty); XCTAssertFalse(model.busy); XCTAssertFalse(model.confirmedFreeTrial)
        let unavailable = NativeSetupReminderActions.unavailable
        await unavailable.refreshAuthorization()
        XCTAssertFalse(unavailable.shouldOfferSetup(true, true))
    }

    func testResetAndChangedOwnerRejectOldLateAnswers() async {
        let monthly = Held<Bool>("old monthly began"), clock = ManualClock(), model = NativeSetupPreflight(wait: clock.wait)
        model.start(owner: "fictional|first", eligiblePath: true, isCurrent: { true }, ownership: {},
                    monthlyTrial: { await monthly.read() }, notificationStatus: {})
        await fulfillment(of: [monthly.started], timeout: 3)
        model.start(owner: "fictional|sibling", eligiblePath: true, isCurrent: { true }, ownership: {}, monthlyTrial: { false }, notificationStatus: {})
        monthly.reply(true); await settle { !model.busy }
        XCTAssertFalse(model.confirmedFreeTrial); model.reset(); clock.fire()
    }

    func testOwnershipAndCatalogShareExactlyOneIdentityPreservingConfiguration() async throws {
        let client = QuietStoreClient(catalog: catalog()), began = expectation(description: "single configuration began")
        await client.setHeldConfiguration(began)
        var persisted: [FamilyAppleAccessUpdate] = []
        let value = try probe(client, persist: { persisted.append($0) })
        let own = Task { await value.checkOwnership() }, month = Task { await value.confirmedMonthlyTrial() }
        await fulfillment(of: [began], timeout: 3)
        let before = await client.snapshot(); XCTAssertEqual(before.configure, 1); XCTAssertEqual(before.info, 0); XCTAssertEqual(before.catalog, 0)
        await client.releaseConfiguration(); await own.value
        let free = await month.value; XCTAssertTrue(free)
        let after = await client.snapshot(); XCTAssertEqual(after.configure, 1); XCTAssertEqual(after.info, 1); XCTAssertEqual(after.catalog, 1)
        XCTAssertEqual(persisted.count, 1); XCTAssertFalse(persisted[0].active)
        XCTAssertEqual(persisted[0].lastAuthoritativeRefresh, Date(timeIntervalSince1970: 5_000))
        await readOnly(client)
    }

    func testAbsentSDKCannotPersistOwnershipOrPromiseAFreeTrial() async throws {
        var writes = 0
        let value = try probe(nil, persist: { _ in writes += 1 })
        await value.checkOwnership(); let free = await value.confirmedMonthlyTrial()
        XCTAssertFalse(free); XCTAssertEqual(writes, 0)
    }

    func testOnlyDefiniteEligibleMonthlyFreeTermsConfirmATrial() async throws {
        for (eligibility, expected) in [(FamilyIntroEligibility.eligible, true), (.unknown, false), (.ineligible, false)] {
            let client = QuietStoreClient(catalog: catalog(eligibility: eligibility))
            let value = try probe(client), answer = await value.confirmedMonthlyTrial()
            XCTAssertEqual(answer, expected); await readOnly(client)
        }
        let noIntro = QuietStoreClient(catalog: catalog(purchaseIntro: nil, displayIntro: .none))
        let answer = await (try probe(noIntro)).confirmedMonthlyTrial(); XCTAssertFalse(answer); await readOnly(noIntro)
    }

    func testWrongSKUWrongBillingPeriodMissingPriceAndProjectionPriceMismatchAreRejected() async throws {
        for malformed in [catalog(purchaseID: "fictional.wrong.sku"), catalog(displayID: "fictional.wrong.display"),
                          catalog(billing: .year), catalog(purchasePrice: "", displayPrice: ""),
                          catalog(displayPrice: "A different synthetic price"),
                          catalog(purchaseID: FamilyStoreProductID.annual, displayID: FamilyStoreProductID.annual, billing: .year)] {
            let client = QuietStoreClient(catalog: malformed)
            let answer = await (try probe(client)).confirmedMonthlyTrial()
            XCTAssertFalse(answer); await readOnly(client)
        }
    }

    func testContradictoryOrUnreadableFreeIntroProjectionCannotPromiseATrial() async throws {
        for malformed in [catalog(purchaseIntro: nil), catalog(purchaseIntro: .paid),
                          catalog(purchaseIntro: .free(.init(count: 3, unit: .day))),
                          catalog(displayIntro: .free(.init(count: 99, unit: .month)))] {
            let client = QuietStoreClient(catalog: malformed)
            let answer = await (try probe(client)).confirmedMonthlyTrial()
            XCTAssertFalse(answer, "Display free terms must match the actual purchased product's readable free time")
            await readOnly(client)
        }
    }

    func testEquivalentOneWeekAndSevenDayStorePeriodsRemainValid() async throws {
        let client = QuietStoreClient(catalog: catalog(purchaseIntro: .free(.init(count: 1, unit: .week))))
        let answer = await (try probe(client)).confirmedMonthlyTrial(); XCTAssertTrue(answer); await readOnly(client)
    }

    func testChangedOwnerOrCancellationDropsHeldOwnershipAnswer() async throws {
        for cancel in [false, true] {
            let client = QuietStoreClient(catalog: catalog()), began = expectation(description: "held info began")
            await client.setHeldInfo(began)
            var current = true, writes = 0
            let value = try probe(client, persist: { _ in writes += 1 }, current: { current })
            let task = Task { await value.checkOwnership() }
            await fulfillment(of: [began], timeout: 3)
            if cancel { task.cancel() } else { current = false }
            await client.replyInfo(.init(activeEntitlements: ["full": .init(productIdentifier: FamilyStoreProductID.monthly)]))
            await task.value; XCTAssertEqual(writes, 0); await readOnly(client)
        }
    }

    func testOfflineOwnershipDoesNotWriteANegativeAnswerOrCheckClock() async throws {
        let client = QuietStoreClient(catalog: catalog()); await client.failInfo(.offline)
        var writes = 0
        let value = try probe(client, persist: { _ in writes += 1 })
        await value.checkOwnership(); XCTAssertEqual(writes, 0); await readOnly(client)
    }

    func testPersistentRevisionRejectsOldNegativeAfterPurchaseButAcceptsALaterActualNegative() async throws {
        let disk = PreflightDisk(), repository = NativeFamilyRepository(store: disk)
        var archive = MigrationArchive()
        for origin in LegacyOrigin.allCases {
            archive.origins[origin.rawValue] = try SnapshotImporter.prepare(.init(origin: origin, storage: origin == .app ? [
                "sona.profile.v1": #"{"onboarded":true,"earlyAdopter":true}"#,
                "sona.freeera.v1":"post", "sona.freeera2.v1":"done", "sona.freeera3.v1":"done", "sona.freeera4.v1":"done", "sona.freeera5.v1":"done"] : [:]))
        }
        _ = try await repository.seed(from: archive, primaryOrigin: .app)
        let promises = disk.document?.householdPromises
        let client = QuietStoreClient(catalog: catalog()), began = expectation(description: "old empty customer info began")
        await client.setHeldInfo(began)
        let value = NativeSetupStoreProbe(client: client, configuration: try config(),
            readRevision: { try await repository.appleAccessRevision(for: .app) },
            persist: { patch in _ = try await repository.recordAppleAccess(.init(active: patch.active, checkedAt: patch.lastAuthoritativeRefresh), origin: .app, source: patch.source) },
            isCurrent: { true }, now: { Date(timeIntervalSince1970: 5_000) })
        let task = Task { await value.checkOwnership() }
        await fulfillment(of: [began], timeout: 3)
        let purchased = try await repository.recordAppleAccess(.init(active: true, checkedAt: nil), origin: .app, source: .purchaseOrRestore)
        await client.replyInfo(.init()); await task.value
        XCTAssertEqual(disk.document?.appleAccess?[LegacyOrigin.app.rawValue], purchased)
        XCTAssertEqual(disk.document?.householdPromises, promises)
        let later = QuietStoreClient(catalog: catalog())
        let subsequent = NativeSetupStoreProbe(client: later, configuration: try config(),
            readRevision: { try await repository.appleAccessRevision(for: .app) },
            persist: { patch in _ = try await repository.recordAppleAccess(.init(active: patch.active, checkedAt: patch.lastAuthoritativeRefresh), origin: .app, source: patch.source) },
            isCurrent: { true })
        await subsequent.checkOwnership()
        XCTAssertEqual(disk.document?.appleAccess?[LegacyOrigin.app.rawValue]?.active, false)
        XCTAssertEqual(disk.document?.householdPromises, promises)
        await readOnly(client); await readOnly(later)
    }
}
