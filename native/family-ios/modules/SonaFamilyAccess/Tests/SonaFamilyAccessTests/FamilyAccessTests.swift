import XCTest
@testable import SonaFamilyAccess

final class FamilyAccessTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)
    private func configuration() throws -> FamilyAccessConfiguration {
        var config = try FamilyAccessConfiguration.bundled()
        config.freeMode = false // Exercise both policies, not the current business choice.
        config.sellYearly = false
        return config
    }

    func testFreshBuyCapableFamilyIsTrialFirstWithoutInventingATrial() throws {
        let policy = FamilyAccessPolicy(configuration: try configuration()), state = FamilyEntitlementState()
        XCTAssertTrue(policy.requiresTrialFirst(state, canSellHere: true, at: now))
        XCTAssertFalse(policy.practice(state, canSellHere: true, at: now))
        XCTAssertFalse(policy.game("slice", state: state, canSellHere: true, at: now).allowed)
        XCTAssertFalse(policy.book("Rory and the Rainbow", state: state, canSellHere: true, at: now))
        XCTAssertNil(state.localTrialEnd)
    }

    func testOldBuildThatCannotSellGetsOnlyTheFreeVersion() throws {
        let policy = FamilyAccessPolicy(configuration: try configuration()), state = FamilyEntitlementState()
        XCTAssertTrue(policy.practice(state, canSellHere: false, at: now))
        XCTAssertTrue(policy.game("slice", state: state, canSellHere: false, at: now).allowed)
        XCTAssertTrue(policy.game("tiles", state: state, canSellHere: false, at: now).allowed)
        XCTAssertTrue(policy.game("feed", state: state, canSellHere: false, at: now).allowed)
        XCTAssertTrue(policy.game("bubbles", state: state, canSellHere: false, at: now).allowed)
        XCTAssertFalse(policy.game("glide", state: state, canSellHere: false, at: now).allowed)
        XCTAssertTrue(policy.book("Rory and the Rainbow", state: state, canSellHere: false, at: now))
        XCTAssertFalse(policy.book("Sid the Seagull", state: state, canSellHere: false, at: now))
        XCTAssertFalse(policy.storyShown(state, canSellHere: false, at: now))
    }

    func testVerifiedClinicianAndKeptFreeVersionAreNotPremiumOrConsent() throws {
        let policy = FamilyAccessPolicy(configuration: try configuration())
        for kept in [false, true] {
            var state = FamilyEntitlementState()
            state.keepsFreeVersion = kept; state.verifiedClinician = !kept
            XCTAssertFalse(state.premium)
            XCTAssertTrue(policy.practice(state, canSellHere: true, at: now))
            XCTAssertFalse(policy.requiresTrialFirst(state, canSellHere: true, at: now))
            XCTAssertFalse(policy.story(state, at: now))
            XCTAssertTrue(policy.offersLockedContent(state, canSellHere: true, at: now))
        }
    }

    func testEveryIndependentPremiumGrantOpensReleasedContent() throws {
        let policy = FamilyAccessPolicy(configuration: try configuration())
        for grant in FamilyPremiumGrant.allCases {
            var state = FamilyEntitlementState(); state.grants.insert(grant)
            XCTAssertTrue(policy.story(state, at: now), grant.rawValue)
            XCTAssertTrue(policy.book("Sid the Seagull", state: state, canSellHere: true, at: now), grant.rawValue)
            XCTAssertTrue(policy.game("glide", state: state, canSellHere: true, at: now).allowed, grant.rawValue)
        }
    }

    func testParkedAndUnknownGamesStayClosedEvenInFreeMode() throws {
        var config = try configuration(); config.freeMode = true
        let policy = FamilyAccessPolicy(configuration: config)
        var state = FamilyEntitlementState(); state.grants = Set(FamilyPremiumGrant.allCases)
        for game in config.games.filter(\.parked) {
            XCTAssertFalse(policy.game(game.id, state: state, canSellHere: false, permission: .init(earnedGameID: game.id), at: now).allowed)
        }
        XCTAssertFalse(policy.game("unknown", state: state, canSellHere: false, at: now).allowed)
        XCTAssertTrue(policy.story(state, at: now))
    }

    func testOldLocalTrialHonoredUntilItsExactEnd() throws {
        let policy = FamilyAccessPolicy(configuration: try configuration())
        var state = FamilyEntitlementState(); state.localTrialEnd = now.addingTimeInterval(1)
        XCTAssertTrue(policy.story(state, at: now))
        XCTAssertTrue(policy.game("glide", state: state, canSellHere: true, at: now).allowed)
        XCTAssertFalse(policy.story(state, at: now.addingTimeInterval(1)))
    }

    func testEarnedGameIsMatchingOnlyAndNeverOpensAStory() throws {
        let policy = FamilyAccessPolicy(configuration: try configuration()), state = FamilyEntitlementState()
        let earned = FamilyGamePermission(earnedGameID: "glide")
        XCTAssertTrue(policy.game("glide", state: state, canSellHere: true, permission: earned, at: now).allowed)
        XCTAssertFalse(policy.game("stack", state: state, canSellHere: true, permission: earned, at: now).allowed)
        XCTAssertFalse(policy.game("robo", state: state, canSellHere: true, permission: .init(earnedGameID: "robo"), at: now).allowed)
        XCTAssertFalse(policy.game("glide", state: state, canSellHere: true, at: now).allowed)
    }

    func testSavedRunCannotOpenUnrelatedOrCompletedRounds() throws {
        let config = try configuration(), policy = FamilyAccessPolicy(configuration: config), state = FamilyEntitlementState()
        let games = ["slice", "tiles", "stack", "run", "glide"]
        let run = try XCTUnwrap(FamilySavedRun(games: games, round: 2, pending: true, configuration: config))
        XCTAssertTrue(policy.game("stack", state: state, canSellHere: true, permission: .init(run: run), at: now).allowed)
        XCTAssertFalse(policy.game("glide", state: state, canSellHere: true, permission: .init(run: run), at: now).allowed)
        let done = try XCTUnwrap(FamilySavedRun(games: games, round: 2, pending: true, completedRound: 2, configuration: config))
        XCTAssertEqual(policy.game("stack", state: state, canSellHere: true, permission: .init(earnedGameID: "stack", run: done), at: now).reason, .completed)
        XCTAssertNil(FamilySavedRun(games: ["stack"], round: 0, pending: true, configuration: config))
        XCTAssertNil(FamilySavedRun(games: games, round: -1, pending: true, configuration: config))
        XCTAssertTrue(policy.practice(state, canSellHere: true, activeRun: true, at: now))
    }

    func testDemoCompatibilityCannotUnlockBooksStoriesOrCatalog() throws {
        let config = try configuration(), policy = FamilyAccessPolicy(configuration: config)
        var state = FamilyEntitlementState(); state.legacyDemoStarted = now
        XCTAssertTrue(policy.legacyPremiumRoute(state, activeRun: false, at: now))
        XCTAssertFalse(policy.story(state, at: now))
        XCTAssertFalse(policy.book("Sid the Seagull", state: state, canSellHere: true, at: now))
        XCTAssertFalse(policy.game("glide", state: state, canSellHere: true, at: now).allowed)
        XCTAssertTrue(policy.legacyPremiumRoute(state, activeRun: false, at: now.addingTimeInterval(config.demoWindowSeconds)))
        XCTAssertFalse(policy.legacyPremiumRoute(state, activeRun: false, at: now.addingTimeInterval(config.demoWindowSeconds + 1)))
    }

    func testNetworkFailureNeverRevokesOrStampsCheck() {
        var state = FamilyEntitlementState(); state.grants = [.apple, .clinicianCoverage, .founder, .stripe]
        let before = state
        for source in [FamilyVerifiedSource.apple, .clinician, .stripe(account: "parent@example.invalid")] {
            state.apply(.unavailable, source: source, at: now)
            XCTAssertEqual(state, before)
        }
    }

    func testAuthoritativeAnswersRevokeOnlyTheirOwnGrant() {
        var state = FamilyEntitlementState(); state.grants = Set(FamilyPremiumGrant.allCases)
        state.stripeAccount = "parent@example.invalid"
        state.apply(.confirmed(active: false), source: .apple, at: now)
        XCTAssertFalse(state.grants.contains(.apple)); XCTAssertTrue(state.grants.contains(.stripe)); XCTAssertTrue(state.grants.contains(.freeEra))
        state.apply(.confirmed(active: false), source: .clinician, at: now)
        XCTAssertFalse(state.grants.contains(.clinicianCoverage)); XCTAssertTrue(state.grants.contains(.foundingFamily))
        state.apply(.confirmed(active: false), source: .stripe(account: "other@example.invalid"), at: now)
        XCTAssertTrue(state.grants.contains(.stripe))
        state.apply(.confirmed(active: false), source: .stripe(account: "PARENT@example.invalid"), at: now)
        XCTAssertFalse(state.grants.contains(.stripe)); XCTAssertTrue(state.premium)
    }

    func testRevenueCatRequiresActualCustomerInfoAndFullEntitlement() throws {
        let config = try configuration()
        XCTAssertEqual(FamilyStoreCompatibility.customerInfoAnswer(Data("{}".utf8), entitlementID: config.entitlement), .unavailable)
        let malformed = try JSONSerialization.data(withJSONObject: ["entitlements": ["active": [config.entitlement: false]]])
        XCTAssertEqual(FamilyStoreCompatibility.customerInfoAnswer(malformed, entitlementID: config.entitlement), .unavailable)
        XCTAssertEqual(FamilyStoreCompatibility.customerInfoAnswer(Data("{\"entitlements\":{\"active\":{}}}".utf8), entitlementID: config.entitlement), .confirmed(active: false))
        let data = try JSONSerialization.data(withJSONObject: ["customerInfo": ["entitlements": ["active": [config.entitlement: ["periodType": "TRIAL"]]]]])
        XCTAssertEqual(FamilyStoreCompatibility.customerInfoAnswer(data, entitlementID: config.entitlement), .confirmed(active: true))
    }

    func testStoreTermsNeverInventPriceEligibilityOrFreeDays() throws {
        let config = try configuration(), period = FamilyStorePeriod(count: 7, unit: .day)
        let month = FamilyStoreProduct(identifier: config.products.monthly, localizedPrice: "store month", introduction: .free(period), eligibility: .unknown)
        let once = FamilyStoreProduct(identifier: config.products.lifetime, localizedPrice: "store once")
        let year = FamilyStoreProduct(identifier: config.products.annual, localizedPrice: "store year")
        let offers = FamilyStoreCompatibility.offers(configuration: config, products: [month, once, year], offeringProductIDs: config.products.restorableIDs)
        XCTAssertEqual(offers.map(\.kind), [.monthly, .lifetime])
        XCTAssertEqual(offers[0].terms, .freeTrial(period, confirmedEligible: false))
        XCTAssertEqual(offers[0].localizedPrice, "store month")
        XCTAssertEqual(offers[1].terms, .onePayment)
        XCTAssertTrue(config.products.restorableIDs.contains(config.products.annual))
    }

    func testWrongMissingOrUnreadableMonthlyProductSellsNothing() throws {
        let config = try configuration()
        let once = FamilyStoreProduct(identifier: config.products.lifetime, localizedPrice: "store once")
        XCTAssertTrue(FamilyStoreCompatibility.offers(configuration: config, products: [once], offeringProductIDs: config.products.restorableIDs).isEmpty)
        let noPrice = FamilyStoreProduct(identifier: config.products.monthly, localizedPrice: " ")
        XCTAssertTrue(FamilyStoreCompatibility.offers(configuration: config, products: [noPrice, once], offeringProductIDs: config.products.restorableIDs).isEmpty)
        let paidIntro = FamilyStoreProduct(identifier: config.products.monthly, localizedPrice: "store month", introduction: .other)
        XCTAssertTrue(FamilyStoreCompatibility.offers(configuration: config, products: [paidIntro, once], offeringProductIDs: config.products.restorableIDs).isEmpty)
        let charged = FamilyStoreProduct(identifier: config.products.monthly, localizedPrice: "store month", introduction: .free(.init(count: 7, unit: .day)), eligibility: .ineligible)
        XCTAssertEqual(FamilyStoreCompatibility.offers(configuration: config, products: [charged], offeringProductIDs: []).first?.terms, .chargedToday)
    }
}
