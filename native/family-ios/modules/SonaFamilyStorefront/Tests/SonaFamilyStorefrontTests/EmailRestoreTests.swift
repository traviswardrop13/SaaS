import XCTest
import Foundation
@testable import SonaFamilyMigration
import SonaFamilyAccess
@testable import SonaFamilyStorefront

private final class EmailMemoryStore: NativeFamilyDocumentStore, @unchecked Sendable {
    var value: NativeFamilyDocument?
    var failBefore = false, failAfter = false
    enum Failure: Error { case write, acknowledgement }
    func read() throws -> NativeFamilyDocument? { value }
    func commit(_ document: NativeFamilyDocument) throws {
        if failBefore { throw Failure.write }
        value = document
        if failAfter { throw Failure.acknowledgement }
    }
}
private actor EmailReply: FamilyEmailRestoreClient {
    var answer: Bool
    var fails = false
    var hold = false
    var continuation: CheckedContinuation<Bool, Error>?
    var addresses: [String] = []
    init(_ answer: Bool, hold: Bool = false, fails: Bool = false) { self.answer = answer; self.hold = hold; self.fails = fails }
    func subscriptionActive(email: String) async throws -> Bool {
        addresses.append(email)
        if fails { throw FamilyEmailRestoreError.unavailable }
        if hold { return try await withCheckedThrowingContinuation { continuation = $0 } }
        return answer
    }
    func release() { continuation?.resume(returning: answer); continuation = nil }
    func count() -> Int { addresses.count }
    func held() -> Bool { continuation != nil }
    func received() -> [String] { addresses }
}
private final class SyntheticSubscriptionHTTP: URLProtocol {
    static var status = 200
    static var body = #"{"ok":true,"active":true}"#
    static var failure = false
    static var requests: [URLRequest] = []
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.requests.append(request)
        if Self.failure { client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet)); return }
        let response = HTTPURLResponse(url: request.url!, statusCode: Self.status, httpVersion: nil,
                                       headerFields: ["Content-Type":"application/json", "Location":"https://example.invalid/must-not-follow"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(Self.body.utf8)); client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

@MainActor final class EmailRestoreTests: XCTestCase {
    private func fixture(_ subscription: String? = nil) async throws -> (NativeFamilyRepository, EmailMemoryStore) {
        var archive = MigrationArchive()
        for origin in LegacyOrigin.allCases {
            var storage = ["sona.freeera.v1":"post", "sona.freeera2.v1":"done", "sona.freeera3.v1":"done",
                           "sona.freeera4.v1":"done", "sona.freeera5.v1":"done", "sona.freever.v1":"post", "sona.buddyset.v1":"post"]
            if origin == .www || origin == .app {
                storage["sona.profile.v1"] = #"{"childName":"Fictional A","onboarded":true,"focusSounds":["R"]}"#
                storage["sona.profile.v1@k2"] = #"{"childName":"Fictional B","onboarded":true,"focusSounds":["S"]}"#
                storage["sona.kids.v1"] = #"{"active":"","hi":2,"list":[{"slot":"","name":"Fictional A"},{"slot":"k2","name":"Fictional B"}]}"#
                storage["sona.progress.v1"] = #"{"totals":{"coins":17,"reps":21}}"#
                if let subscription { storage["sona.sub.v1"] = subscription }
            }
            archive.origins[origin.rawValue] = try SnapshotImporter.prepare(.init(origin: origin, storage: storage))
        }
        let disk = EmailMemoryStore(), repo = NativeFamilyRepository(store: disk)
        _ = try await repo.seed(from: archive, primaryOrigin: .www)
        return (repo, disk)
    }
    private func service(_ repo: NativeFamilyRepository, _ client: EmailReply, origin: LegacyOrigin = .www,
                         bundle: String = "com.speaksona.app") -> FamilyEmailRestoreStore {
        .init(repository: repo, origin: origin, client: client, actualBundleIdentifier: bundle)
    }
    private func access(_ document: NativeFamilyDocument, origin: LegacyOrigin = .www) throws -> FamilyEntitlementState {
        let family = try XCTUnwrap(document.origins[origin.rawValue])
        var access = FamilyEntitlementState.legacy(family.accessEvidence(), configuration: try .bundled())
        if let saved = document.websiteAccess?[origin.rawValue] { access.applyWebsiteAccess(saved) }
        if let apple = document.appleAccess?[origin.rawValue] {
            if apple.active { access.grants.insert(.apple) } else { access.grants.remove(.apple) }
        }
        return access
    }
    private func waitHeld(_ client: EmailReply) async throws {
        for _ in 0..<500 {
            if await client.held() { return }
            try await Task.sleep(nanoseconds: 1_000_000)
        }
        XCTFail("Synthetic request did not reach holder")
    }

    func testFixedRequestTrimsAndEncodesPlusAmpersandUnicodeWithoutExtraQuery() throws {
        let request = try FamilyWebsiteSubscriptionClient.request(email: " \nparent+tag&家@example.invalid\t ")
        let url = try XCTUnwrap(request.url), parts = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false))
        XCTAssertEqual(url.scheme, "https"); XCTAssertEqual(url.host, "app.speaksona.com")
        XCTAssertEqual(url.path, "/api/subscription"); XCTAssertNil(url.user); XCTAssertNil(url.password)
        XCTAssertEqual(parts.queryItems, [.init(name: "email", value: "parent+tag&家@example.invalid")])
        XCTAssertTrue(parts.percentEncodedQuery!.contains("%2B")); XCTAssertTrue(parts.percentEncodedQuery!.contains("%26"))
        XCTAssertEqual(request.httpMethod, "GET"); XCTAssertNil(request.httpBody); XCTAssertFalse(request.httpShouldHandleCookies)
        XCTAssertThrowsError(try FamilyWebsiteSubscriptionClient.request(email: "bad address"))
    }
    func testActualClientAcceptsOnlyConfirmedBooleansAndNeverUsesLiveNetwork() async throws {
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [SyntheticSubscriptionHTTP.self]
        let session = URLSession(configuration: config); defer { session.invalidateAndCancel() }
        let client = FamilyWebsiteSubscriptionClient(session: session)
        SyntheticSubscriptionHTTP.requests = []; SyntheticSubscriptionHTTP.failure = false
        for active in [true, false] {
            SyntheticSubscriptionHTTP.status = 200; SyntheticSubscriptionHTTP.body = "{\"ok\":true,\"active\":" + String(active) + "}"
            let answer = try await client.subscriptionActive(email: "parent+old@example.invalid")
            XCTAssertEqual(answer, active)
        }
        for (status, body) in [(503, #"{"ok":true,"active":true}"#), (302, #"{"ok":true,"active":true}"#),
                               (200, #"{"ok":false,"active":true,"error":"private server detail"}"#),
                               (200, #"{"ok":true,"active":"true"}"#), (200, #"{"ok":true}"#), (200, "not json")] {
            SyntheticSubscriptionHTTP.status = status; SyntheticSubscriptionHTTP.body = body
            do { _ = try await client.subscriptionActive(email: "parent@example.invalid"); XCTFail("accepted \(status) \(body)") } catch {}
        }
        SyntheticSubscriptionHTTP.failure = true
        do { _ = try await client.subscriptionActive(email: "parent@example.invalid"); XCTFail("offline accepted") } catch {}
        SyntheticSubscriptionHTTP.failure = false
        XCTAssertEqual(SyntheticSubscriptionHTTP.requests.count, 9)
        XCTAssertTrue(SyntheticSubscriptionHTTP.requests.allSatisfy { $0.url?.host == "app.speaksona.com" && $0.httpMethod == "GET" })
    }
    func testPreviewAndInvalidEmailMakeNoRequestOrWrite() async throws {
        let (repo, disk) = try await fixture(), before = disk.value
        let client = EmailReply(true), preview = service(repo, client, bundle: "com.speaksona.family.native-preview")
        await preview.restore(email: "parent@example.invalid")
        XCTAssertFalse(preview.isAvailable)
        let live = service(repo, client); await live.restore(email: "wrong")
        XCTAssertEqual(live.notice, .invalidEmail); XCTAssertEqual(disk.value, before)
        let count = await client.count(); XCTAssertEqual(count, 0)
    }
    func testPositiveRestorePersistsOnlyWebsiteGrantForCapturedOriginAndPreservesApple() async throws {
        let (repo, disk) = try await fixture(#"{"active":true,"source":"apple","email":"old@example.invalid"}"#)
        let before = try XCTUnwrap(disk.value), client = EmailReply(true), store = service(repo, client)
        await store.restore(email: "  parent+tag@example.invalid\n")
        XCTAssertEqual(store.notice, .restored)
        let after = try XCTUnwrap(disk.value), grant = try XCTUnwrap(after.websiteAccess?[LegacyOrigin.www.rawValue])
        XCTAssertTrue(grant.active); XCTAssertEqual(grant.email, "parent+tag@example.invalid")
        let emails = await client.received(); XCTAssertEqual(emails, ["parent+tag@example.invalid"])
        XCTAssertEqual(after.origins, before.origins); XCTAssertEqual(after.sourceFingerprints, before.sourceFingerprints)
        XCTAssertEqual(after.householdPromises, before.householdPromises); XCTAssertEqual(after.appleAccess, before.appleAccess)
        XCTAssertNil(after.websiteAccess?[LegacyOrigin.app.rawValue])
        XCTAssertEqual(try access(after).grants, [.apple, .stripe])
        let bytes = try await repo.portableBackup(origin: .www).encoded()
        XCTAssertFalse(String(decoding: bytes, as: UTF8.self).contains("parent+tag@example.invalid"))
        XCTAssertFalse(String(decoding: bytes, as: UTF8.self).contains("websiteAccess"))
    }
    func testMatchingInactiveRevokesStripeAndUnknownCachesButPreservesIndependentGrants() async throws {
        for source in ["stripe", "missing", "unknown"] {
            var cache: [String: Any] = ["active":true,"email":"Parent@example.invalid"]
            if source != "missing" { cache["source"] = source }
            let raw = String(decoding: try JSONSerialization.data(withJSONObject: cache), as: UTF8.self)
            let (repo, disk) = try await fixture(raw), before = disk.value
            let store = service(repo, EmailReply(false)); await store.restore(email: "PARENT@example.invalid")
            XCTAssertEqual(store.notice, .noSubscription)
            let saved = try XCTUnwrap(disk.value)
            var projected = try access(saved); projected.grants.formUnion([.apple, .founder, .freeEra, .foundingFamily, .clinicianCoverage])
            projected.applyWebsiteAccess(try XCTUnwrap(saved.websiteAccess?[LegacyOrigin.www.rawValue]))
            XCTAssertEqual(projected.grants, [.apple, .founder, .freeEra, .foundingFamily, .clinicianCoverage])
            XCTAssertEqual(saved.origins, before?.origins)
        }
    }
    func testInactiveOtherAddressAndAppleOnlyCacheNeverChangeAnyGrantOrClock() async throws {
        for raw in [#"{"active":true,"source":"stripe","email":"owner@example.invalid"}"#,
                    #"{"active":true,"email":"owner@example.invalid"}"#,
                    #"{"active":true,"source":"apple","email":"other@example.invalid"}"#] {
            let (repo, disk) = try await fixture(raw), before = disk.value
            let store = service(repo, EmailReply(false)); await store.restore(email: "other@example.invalid")
            XCTAssertEqual(store.notice, .noSubscription); XCTAssertEqual(disk.value, before)
        }
    }
    func testFailedRequestDoesNotRevokeOrStampOrCreatePendingGrant() async throws {
        let (repo, disk) = try await fixture(#"{"active":true,"email":"parent@example.invalid"}"#), before = disk.value
        let store = service(repo, EmailReply(false, fails: true)); await store.restore(email: "parent@example.invalid")
        XCTAssertEqual(store.notice, .unavailable); XCTAssertFalse(store.needsSaveRetry); XCTAssertEqual(disk.value, before)
    }
    func testLaterNegativeDoesNotResurrectSupersededRawLegacyAccount() async throws {
        let (repo, disk) = try await fixture(#"{"active":true,"email":"old@example.invalid"}"#)
        await service(repo, EmailReply(true)).restore(email: "new@example.invalid")
        XCTAssertEqual(try access(disk.value!).grants, [.stripe])
        await service(repo, EmailReply(false)).restore(email: "new@example.invalid")
        XCTAssertTrue(try access(disk.value!).grants.isEmpty)
        XCTAssertEqual(disk.value!.primaryFamily!.storage["sona.sub.v1"], #"{"active":true,"email":"old@example.invalid"}"#)
    }
    func testHeldNegativeCannotEraseSuccessfulApplePurchase() async throws {
        let (repo, disk) = try await fixture(#"{"active":true,"source":"stripe","email":"parent@example.invalid"}"#)
        let client = EmailReply(false, hold: true), store = service(repo, client)
        let request = Task { await store.restore(email: "parent@example.invalid") }; try await waitHeld(client)
        _ = try await repo.recordAppleAccess(.init(active: true, checkedAt: nil), origin: .www, source: .purchaseOrRestore)
        let apple = disk.value!.appleAccess
        await client.release(); await request.value
        XCTAssertEqual(disk.value!.appleAccess, apple); XCTAssertEqual(try access(disk.value!).grants, [.apple])
    }
    func testStaleNegativeFromAnotherControllerCannotEraseLaterWebsiteRestore() async throws {
        let (repo, disk) = try await fixture(#"{"active":true,"email":"parent@example.invalid"}"#)
        let client = EmailReply(false, hold: true), old = service(repo, client)
        let request = Task { await old.restore(email: "parent@example.invalid") }; try await waitHeld(client)
        await service(repo, EmailReply(true)).restore(email: "parent@example.invalid")
        let newer = disk.value!.websiteAccess
        await client.release(); await request.value
        XCTAssertEqual(old.notice, .changed); XCTAssertEqual(disk.value!.websiteAccess, newer)
        XCTAssertEqual(try access(disk.value!).grants, [.stripe])
    }
    func testFamilyAndChildSwitchDuringRequestCannotRetargetRestore() async throws {
        let (repo, disk) = try await fixture(), before = disk.value!
        let client = EmailReply(true, hold: true), store = service(repo, client)
        let request = Task { await store.restore(email: "parent@example.invalid") }; try await waitHeld(client)
        try await repo.switchChild(.init(origin: .www, slot: "k2")); try await repo.selectOrigin(.app)
        let switched = disk.value!
        await client.release(); await request.value
        XCTAssertEqual(disk.value!.primaryOrigin, .app)
        XCTAssertEqual(disk.value!.origins, switched.origins)
        XCTAssertEqual(disk.value!.origins[LegacyOrigin.app.rawValue], before.origins[LegacyOrigin.app.rawValue])
        XCTAssertNotNil(disk.value!.websiteAccess?[LegacyOrigin.www.rawValue]); XCTAssertNil(disk.value!.websiteAccess?[LegacyOrigin.app.rawValue])
    }
    func testConcurrentTapIsCoalescedWithoutSecondRequest() async throws {
        let (repo, _) = try await fixture(), client = EmailReply(true, hold: true), store = service(repo, client)
        let first = Task { await store.restore(email: "first@example.invalid") }; try await waitHeld(client)
        await store.restore(email: "second@example.invalid")
        let count = await client.count(); XCTAssertEqual(count, 1)
        await client.release(); await first.value
        XCTAssertEqual(store.notice, .restored)
    }
    func testFailedCommitAndLostAcknowledgementRetryNeverRepeatNetworkOrChangeReceipt() async throws {
        for lostAcknowledgement in [false, true] {
            let (repo, disk) = try await fixture(), client = EmailReply(true), store = service(repo, client)
            disk.failBefore = !lostAcknowledgement; disk.failAfter = lostAcknowledgement
            await store.restore(email: "parent@example.invalid")
            XCTAssertEqual(store.notice, .savePending); XCTAssertTrue(store.needsSaveRetry)
            let prior = disk.value!.websiteAccess
            if !lostAcknowledgement { XCTAssertNil(prior) }
            disk.failBefore = false; disk.failAfter = false
            await store.retrySave()
            XCTAssertEqual(store.notice, .restored); XCTAssertFalse(store.needsSaveRetry)
            if lostAcknowledgement { XCTAssertEqual(disk.value!.websiteAccess, prior) }
            let count = await client.count(); XCTAssertEqual(count, 1)
        }
    }
    func testRawCacheChangeInvalidatesAnEarlierEmailAnswer() async throws {
        let (repo, disk) = try await fixture(#"{"active":true,"email":"parent@example.invalid"}"#)
        let client = EmailReply(false, hold: true), store = service(repo, client)
        let request = Task { await store.restore(email: "parent@example.invalid") }; try await waitHeld(client)
        try await repo.change { document in
            var family = document.origins[LegacyOrigin.www.rawValue]!
            family.storage["sona.sub.v1"] = #"{"active":true,"source":"apple"}"#
            document.origins[LegacyOrigin.www.rawValue] = family
        }
        let current = disk.value
        await client.release(); await request.value
        XCTAssertEqual(store.notice, .changed); XCTAssertEqual(disk.value, current)
    }
    func testCancellationBeforeAnswerCannotPersistVerifiedGrant() async throws {
        let (repo, disk) = try await fixture(), before = disk.value
        let client = EmailReply(true, hold: true), store = service(repo, client)
        let request = Task { await store.restore(email: "parent@example.invalid") }; try await waitHeld(client)
        request.cancel(); await client.release(); await request.value
        XCTAssertEqual(disk.value, before); XCTAssertFalse(store.needsSaveRetry)
    }
}

private actor NoOffersAppleClient: FamilyStorefrontClient {
    var restoreCount = 0
    func configurePreservingIdentity() async throws {}
    func customerInfo() async throws -> FamilyPurchaseCustomerInfo { .init() }
    func restorePurchases() async throws -> FamilyPurchaseCustomerInfo {
        restoreCount += 1
        return .init(activeEntitlements: ["full": .init(productIdentifier: FamilyStoreProductID.annual)])
    }
    func purchase(product: SonaFamilyMigration.FamilyStoreProduct) async throws -> FamilyPurchaseCustomerInfo {
        XCTFail("Restore cannot start a purchase"); throw FamilyPurchaseFailure.failed
    }
    func catalog(configuration: FamilyAccessConfiguration) async throws -> FamilyStorefrontCatalog { .init(products: [], offeringProductIDs: []) }
    func restores() -> Int { restoreCount }
}

extension EmailRestoreTests {
    func testPublicEmailInitializerCannotOverrideActualBundleWithInjectedClient() async throws {
        let (repo, disk) = try await fixture(), before = disk.value, client = EmailReply(true)
        let store = FamilyEmailRestoreStore(repository: repo, origin: .www, client: client)
        await store.restore(email: "parent@example.invalid")
        XCTAssertFalse(store.isAvailable); XCTAssertEqual(disk.value, before)
        let count = await client.count(); XCTAssertEqual(count, 0)
    }
    func testAppleRestoreRemainsAvailableWithNoOffersAndDoesNotPurchase() async throws {
        var config = try FamilyAccessConfiguration.bundled(); config.freeMode = false
        let client = NoOffersAppleClient()
        let store = FamilyStorefrontStore(configuration: config, initialAccess: .init(), client: client,
            actualBundleIdentifier: "com.speaksona.app", persistAppleAccess: { patch in .init(active: patch.active, checkedAt: patch.lastAuthoritativeRefresh) })
        await store.load()
        XCTAssertEqual(store.phase, .unavailable); XCTAssertTrue(store.canRestore); XCTAssertFalse(store.canPurchase)
        await store.restore()
        XCTAssertEqual(store.notice, .restored); XCTAssertTrue(store.access.grants.contains(.apple))
        let count = await client.restores(); XCTAssertEqual(count, 1)
    }
}
