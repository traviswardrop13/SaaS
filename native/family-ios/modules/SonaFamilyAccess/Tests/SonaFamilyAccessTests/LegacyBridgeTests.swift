import XCTest
@testable import SonaFamilyAccess
@testable import SonaFamilyMigration

final class LegacyBridgeTests: XCTestCase {
    private var stamps: [String: String] {
        ["sona.freeera.v1": "post", "sona.freeera2.v1": "done", "sona.freeera3.v1": "done",
         "sona.freeera4.v1": "done", "sona.freeera5.v1": "done", "sona.freever.v1": "post", "sona.buddyset.v1": "post"]
    }

    func testBridgeKeepsIndependentTrustedEvidenceAndOldTrial() throws {
        let config = try FamilyAccessConfiguration.bundled()
        var storage = stamps
        storage["sona.profile.v1"] = #"{"onboarded":true,"earlyAdopter":true}"#
        storage["sona.founding.v1"] = #"{"code":"ff-existing"}"#
        storage["sona.founder"] = "1"
        storage["sona.sub.v1"] = #"{"active":true,"source":"apple"}"#
        storage["sona.caseplan.v1"] = #"{"active":true,"checked":1000}"#
        storage["sona.slpok"] = "VERIFIED"
        storage["sona.trial.v1"] = #"{"start":1000000,"days":0}"#
        let trusted = LegacyPromiseCompatibility.evaluate(storage: storage)
        let state = FamilyEntitlementState.legacy(trusted, configuration: config)
        XCTAssertEqual(state.grants, [.freeEra, .foundingFamily, .founder, .apple, .clinicianCoverage])
        XCTAssertTrue(state.verifiedClinician)
        XCTAssertFalse(state.keepsFreeVersion)
        XCTAssertEqual(state.localTrialEnd, Date(timeIntervalSince1970: 1000 + config.localTrialFallbackDays * 86400))
        XCTAssertEqual(state.clinicianCheckedAt, Date(timeIntervalSince1970: 1))
        // The access bridge does not change or persist the migration result.
        XCTAssertEqual(trusted.storage["sona.sub.v1"], storage["sona.sub.v1"])
    }

    func testTypedCoverageAndBareCodeCannotInventPremium() throws {
        let config = try FamilyAccessConfiguration.bundled()
        var storage = stamps
        storage["sona.profile.v1"] = #"{"onboarded":true}"#
        storage["sona.slp"] = "BARE-CODE"
        storage["sona.caseplan.v1"] = #"{"active":1}"#
        storage["sona.sub.v1"] = #"{"active":true,"source":"older-build"}"#
        var state = FamilyEntitlementState.legacy(LegacyPromiseCompatibility.evaluate(storage: storage), configuration: config)
        XCTAssertEqual(state.grants, [.legacySubscription])
        XCTAssertFalse(state.verifiedClinician)
        state.apply(.confirmed(active: false), source: .apple, at: Date())
        XCTAssertTrue(state.grants.contains(.legacySubscription))
    }
}
