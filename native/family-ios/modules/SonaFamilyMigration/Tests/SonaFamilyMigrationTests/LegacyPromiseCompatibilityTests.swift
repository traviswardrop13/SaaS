import Foundation
import XCTest
@testable import SonaFamilyMigration
#if canImport(JavaScriptCore)
import JavaScriptCore
#endif

final class LegacyPromiseCompatibilityTests: XCTestCase {
    private let profile = "sona.profile.v1"
    private var stamped: [String: String] { [
        "sona.freeera.v1": "post", "sona.freeera2.v1": "done", "sona.freeera3.v1": "done",
        "sona.freeera4.v1": "done", "sona.freeera5.v1": "done",
        "sona.freever.v1": "post", "sona.buddyset.v1": "post"
    ] }
    private func evaluate(_ storage: [String: String]) -> LegacyPromiseCompatibility {
        LegacyPromiseCompatibility.evaluate(storage: storage)
    }
    private func object(_ raw: String?) throws -> [String: Any] {
        try XCTUnwrap(JSONSerialization.jsonObject(with: Data(try XCTUnwrap(raw).utf8)) as? [String: Any])
    }

    func testEachOfFiveSyntheticCohortsGetsItsOwnPromiseAndEvaluationIsRepeatable() throws {
        let stamps = ["sona.freeera.v1", "sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"]
        let marks = ["freeEra", "freeEra2", "freeEra3", "freeEra4", "freeEra5"]
        for (index, stamp) in stamps.enumerated() {
            var source = stamped
            source[stamp] = nil
            source[profile] = #"{"childName":"Synthetic cohort","focusSounds":["R"],"owned":{"characters":["dragon"]}}"#
            let original = source, result = evaluate(source)
            XCTAssertTrue(result.hasFreeEraPromise, stamp)
            XCTAssertEqual(try object(result.storage[profile])[marks[index]] as? Bool, true, stamp)
            XCTAssertEqual(try object(result.storage[profile])["focusSounds"] as? [String], ["R"])
            XCTAssertEqual(evaluate(result.storage).storage, result.storage, stamp)
            XCTAssertEqual(source, original) // value-copy evaluation never edits captured evidence
        }
    }

    func testFirstLoadOrderSkipsEraTwoForAnOriginalEraOneFamily() throws {
        let result = evaluate([profile: #"{"childName":"Synthetic original"}"#])
        let child = try object(result.storage[profile])
        XCTAssertTrue(result.hasFreeEraPromise)
        XCTAssertNil(child["freeEra2"])
        for mark in ["freeEra", "freeEra3", "freeEra4", "freeEra5"] { XCTAssertEqual(child[mark] as? Bool, true) }
        XCTAssertEqual(result.storage["sona.freeera2.v1"], "done")
        XCTAssertEqual(evaluate(result.storage).storage, result.storage)
    }

    func testNewDeviceStampedBeforeSetupNeverGainsGrandfatheringOrKeptItems() {
        let first = evaluate([:])
        XCTAssertEqual(first.storage, stamped)
        var afterSetup = first.storage
        afterSetup[profile] = #"{"onboarded":true,"childName":"Synthetic new child"}"#
        let result = evaluate(afterSetup)
        XCTAssertFalse(result.hasFreeEraPromise)
        XCTAssertFalse(result.hasFoundingPromise)
        XCTAssertFalse(result.keepsFreeVersion)
        XCTAssertFalse(result.keepsLegacyBuddies)
        XCTAssertEqual(result.storage, afterSetup)
    }

    func testClinicianOnlyEraFourCreatesFirstProfileButOtherErasDoNot() throws {
        for credential in ["sona.slpok": "SYNTHETIC", "sona.slpunlock": "1"] {
            var source = stamped
            source["sona.freeera4.v1"] = nil
            source[credential.key] = credential.value
            let result = evaluate(source), child = try object(result.storage[profile])
            XCTAssertTrue(result.hasFreeEraPromise)
            XCTAssertEqual(child["freeEra4"] as? Bool, true)
            XCTAssertNil(child["onboarded"])
            XCTAssertFalse(result.keepsFreeVersion)
            XCTAssertEqual(evaluate(result.storage).storage, result.storage)
            for era in [2, 3, 5] {
                source = stamped; source["sona.freeera\(era).v1"] = nil
                source[credential.key] = credential.value
                XCTAssertFalse(evaluate(source).hasFreeEraPromise)
                XCTAssertNil(evaluate(source).storage[profile])
            }
        }
    }

    func testEraFourMarksWholeRosterIncludingAnUnfinishedSibling() throws {
        var source = stamped; source["sona.freeera4.v1"] = nil
        source["sona.kids.v1"] = #"{"active":"k7","list":[{"slot":""},{"slot":"k7"}]}"#
        source[profile] = #"{"onboarded":true}"#
        source[profile + "@k7"] = #"{"onboarded":false,"coinsMustRemain":17}"#
        let result = evaluate(source)
        XCTAssertEqual(try object(result.storage[profile + "@k7"])["freeEra4"] as? Bool, true)
        XCTAssertEqual(try object(result.storage[profile + "@k7"])["coinsMustRemain"] as? Int, 17)
    }

    func testEraOneReadsOriginalProfileWhileLaterErasReadEveryRosterSlot() throws {
        var source = stamped; source["sona.freeera.v1"] = nil
        source["sona.kids.v1"] = #"{"active":"k7","list":[{"slot":"k7"}]}"#
        source[profile + "@k7"] = #"{"onboarded":true}"#
        XCTAssertFalse(evaluate(source).hasFreeEraPromise)
        source["sona.freeera3.v1"] = nil
        let result = evaluate(source)
        XCTAssertTrue(result.hasFreeEraPromise)
        XCTAssertEqual(try object(result.storage[profile + "@k7"])["freeEra3"] as? Bool, true)
    }

    func testHouseholdReadersUseInactiveChildrenButNeverRemovedSlots() {
        var source = stamped
        source["sona.kids.v1"] = #"{"active":"k7","list":[{"slot":""},{"slot":"k7"}]}"#
        source[profile] = #"{"earlyAdopter":true}"#
        source[profile + "@k7"] = "{}"
        XCTAssertTrue(evaluate(source).hasFreeEraPromise)
        source["sona.kids.v1"] = #"{"active":"k7","list":[{"slot":"k7"}]}"#
        XCTAssertFalse(evaluate(source).hasFreeEraPromise)
    }

    func testFoundingHouseholdMarkAndConsentedLegacyFallbackAreSeparateFromClinicianCodes() {
        var source = stamped
        source["sona.founding.v1"] = #"{"code":"ff-synthetic"}"#
        source["sona.pilot.v1"] = #"{"consent":true,"code":"SYNTHETIC-CLINIC"}"#
        XCTAssertTrue(evaluate(source).hasFoundingPromise)
        source["sona.founding.v1"] = nil
        XCTAssertFalse(evaluate(source).hasFoundingPromise)
        source["sona.kids.v1"] = #"{"active":"","list":[{"slot":""},{"slot":"k7"}]}"#
        source["sona.pilot.v1@k7"] = #"{"consent":true,"code":"ff-synthetic"}"#
        XCTAssertTrue(evaluate(source).hasFoundingPromise)
        source["sona.pilot.v1@k7"] = #"{"consent":false,"code":"ff-synthetic"}"#
        XCTAssertFalse(evaluate(source).hasFoundingPromise)
        source["sona.pilot.v1@k7"] = #"{"consent":true,"code":"FF-synthetic"}"#
        XCTAssertFalse(evaluate(source).hasFoundingPromise)
    }

    func testReadOnlyHouseholdReadersPreserveOriginalOuterCatchBehavior() {
        var source = stamped
        source["sona.kids.v1"] = #"{"active":"k7","list":[{"slot":""},{"slot":"k7"}]}"#
        source[profile] = "invalid"
        source[profile + "@k7"] = #"{"earlyAdopter":true}"#
        source["sona.pilot.v1"] = "invalid"
        source["sona.pilot.v1@k7"] = #"{"consent":true,"code":"ff-synthetic"}"#
        XCTAssertFalse(evaluate(source).hasFreeEraPromise)
        XCTAssertFalse(evaluate(source).hasFoundingPromise)
        source["sona.pilot.v1"] = "null" // founding checks null before reading fields
        XCTAssertTrue(evaluate(source).hasFoundingPromise)
        source[profile] = "null" // earlyAdopter reads its property and aborts
        XCTAssertFalse(evaluate(source).hasFreeEraPromise)
    }

    func testMissingFreeVersionAndBuddyStampsKeepExistingOwnershipWithoutDuplicates() throws {
        var source = stamped; source["sona.freever.v1"] = nil; source["sona.buddyset.v1"] = nil
        source[profile] = #"{"childName":"Synthetic owner","owned":{"characters":["dragon","future-buddy"],"outfits":["none"],"custom":["untouched"]},"targetSound":"S"}"#
        let result = evaluate(source), child = try object(result.storage[profile])
        XCTAssertFalse(result.hasFreeEraPromise)
        XCTAssertTrue(result.keepsFreeVersion)
        XCTAssertTrue(result.keepsLegacyBuddies)
        let owned = try XCTUnwrap(child["owned"] as? [String: Any])
        let characters = try XCTUnwrap(owned["characters"] as? [String])
        XCTAssertEqual(characters.filter { $0 == "dragon" }.count, 1)
        XCTAssertEqual(characters.first, "dragon")
        XCTAssertTrue(characters.contains("future-buddy"))
        XCTAssertEqual(owned["custom"] as? [String], ["untouched"])
        XCTAssertEqual((owned["outfits"] as? [String])?.count, 7)
        XCTAssertEqual((owned["backdrops"] as? [String])?.count, 6)
        XCTAssertEqual(child["targetSound"] as? String, "S")
        XCTAssertEqual(evaluate(result.storage).storage, result.storage)
    }

    func testNonemptyStampsIncludingFalseWordAreNeverRejudgedAndEmptyStampsAre() {
        var source = stamped
        for key in source.keys { source[key] = "false" }
        source[profile] = #"{"onboarded":true}"#
        XCTAssertEqual(evaluate(source).storage, source)
        source["sona.freeera5.v1"] = ""
        XCTAssertTrue(evaluate(source).hasFreeEraPromise)
    }

    func testImportedOriginEntryPointLeavesRawCaptureAndUnrelatedAccessCountersUntouched() throws {
        let original = [profile: #"{"childName":"Synthetic raw"}"#,
            "sona.sub.v1": #"{"active":true,"source":"stripe"}"#,
            "sona.caseplan.v1": #"{"active":false}"#,
            "sona.report.v1": "synthetic-consent-state", "sona.outcomes.v1": "synthetic-counts",
            "sona.future.v19": "verbatim"]
        let origin = try SnapshotImporter.prepare(LegacySnapshot(origin: .www, storage: original))
        let result = origin.evaluatingLegacyPromises()
        XCTAssertEqual(origin.storage, original)
        for key in original.keys where key != profile { XCTAssertEqual(result.storage[key], original[key]) }
        XCTAssertTrue(result.hasFreeEraPromise)
    }

    #if canImport(JavaScriptCore)
    func testSwiftCompatibilityMatchesActualShippingJavaScriptAcrossSyntheticFixtures() throws {
        // Read functions from the shipping file, never a second handwritten oracle.
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<7 { root.deleteLastPathComponent() }
        let source = try String(contentsOf: root.appendingPathComponent("public/sona.js"), encoding: .utf8)
        let context = try XCTUnwrap(JSContext())
        var failure: String?
        context.exceptionHandler = { _, exception in failure = exception?.toString() }
        var script = ""
        for name in ["PKEY", "KIDSKEY", "GFKEY", "GF2KEY", "GF3KEY", "GF4KEY", "GF5KEY", "FREEVER_KEY", "BUDDYSET_KEY", "FOUNDKEY", "PILOTKEY"] {
            let expression = try NSRegularExpression(pattern: "(?m)^  const " + name + " = [^\\n]+")
            let match = try XCTUnwrap(expression.firstMatch(in: source, range: NSRange(source.startIndex..., in: source)))
            script += String(source[try XCTUnwrap(Range(match.range, in: source))]) + "\n"
        }
        let legacy = try NSRegularExpression(pattern: "const LEGACY_SET = \\{[\\s\\S]*?\\};")
        let legacyMatch = try XCTUnwrap(legacy.firstMatch(in: source, range: NSRange(source.startIndex..., in: source)))
        script += String(source[try XCTUnwrap(Range(legacyMatch.range, in: source))]) + "\n"
        let functions = ["_kids", "_grandfatherFreeEra", "_grandfatherFreeEra2", "_grandfatherFreeEra3", "_grandfatherFreeEra4", "_grandfatherFreeEra5", "_keepFreeVersion", "_legacyInto", "_keepBuddies", "earlyAdopterAnyKid", "foundingPilot"]
        for name in functions {
            let expression = try NSRegularExpression(pattern: "(?m)^  function " + name + "\\([^\\n]*\\) \\{[\\s\\S]*?^  \\}")
            let match = try XCTUnwrap(expression.firstMatch(in: source, range: NSRange(source.startIndex..., in: source)))
            script += String(source[try XCTUnwrap(Range(match.range, in: source))]) + "\n"
        }
        script += """
        function oracle(seed) {
          var saved = Object.assign({}, seed);
          localStorage = { getItem: function(k) { return Object.prototype.hasOwnProperty.call(saved,k) ? saved[k] : null; },
            setItem: function(k,v) { saved[k] = String(v); } };
          _grandfatherFreeEra(); _grandfatherFreeEra2(); _grandfatherFreeEra3();
          _grandfatherFreeEra4(); _grandfatherFreeEra5(); _keepFreeVersion(); _keepBuddies();
          return {storage:saved, era:earlyAdopterAnyKid(), founding:foundingPilot(),
            free:saved[FREEVER_KEY] === 'kept', buddies:saved[BUDDYSET_KEY] !== 'post'};
        }
        """
        context.evaluateScript(script)
        XCTAssertNil(failure)
        var fixtures: [[String: String]] = [[:], [profile: #"{"childName":"Synthetic original"}"#]]
        for missing in stamped.keys {
            for raw in [#"{"onboarded":true}"#, #"{"childName":"Synthetic name"}"#, "{}", "null", "invalid"] {
                var fixture = stamped; fixture[missing] = nil; fixture[profile] = raw
                fixtures.append(fixture)
            }
        }
        for credential in ["sona.slpok": "SYNTHETIC", "sona.slpunlock": "1"] {
            var fixture = stamped; fixture["sona.freeera4.v1"] = nil; fixture[credential.key] = credential.value
            fixtures.append(fixture)
        }
        for raw in ["invalid", "null", "{}", #"{"earlyAdopter":true}"#] {
            var fixture = stamped
            fixture["sona.kids.v1"] = #"{"active":"k7","list":[{"slot":""},{"slot":"k7"}]}"#
            fixture[profile] = raw; fixture[profile + "@k7"] = #"{"earlyAdopter":true}"#
            fixture["sona.pilot.v1"] = raw; fixture["sona.pilot.v1@k7"] = #"{"consent":true,"code":"ff-synthetic"}"#
            fixtures.append(fixture)
        }
        for (index, fixture) in fixtures.enumerated() {
            let result = evaluate(fixture)
            let js = try XCTUnwrap(context.objectForKeyedSubscript("oracle")?.call(withArguments: [fixture]).toDictionary())
            XCTAssertNil(failure, "fixture \(index)")
            let expected = try XCTUnwrap(js["storage"] as? [String: String])
            XCTAssertEqual(Set(result.storage.keys), Set(expected.keys), "fixture \(index)")
            for key in expected.keys {
                if result.storage[key] == expected[key] { continue }
                let swiftValue = try JSONSerialization.jsonObject(with: Data(try XCTUnwrap(result.storage[key]).utf8), options: [.fragmentsAllowed]) as? NSObject
                let jsValue = try JSONSerialization.jsonObject(with: Data(try XCTUnwrap(expected[key]).utf8), options: [.fragmentsAllowed]) as? NSObject
                XCTAssertEqual(swiftValue, jsValue, "fixture \(index), \(key)")
            }
            XCTAssertEqual(result.hasFreeEraPromise, js["era"] as? Bool, "fixture \(index)")
            XCTAssertEqual(result.hasFoundingPromise, js["founding"] as? Bool, "fixture \(index)")
            XCTAssertEqual(result.keepsFreeVersion, js["free"] as? Bool, "fixture \(index)")
            XCTAssertEqual(result.keepsLegacyBuddies, js["buddies"] as? Bool, "fixture \(index)")
        }
    }
    #endif
}
