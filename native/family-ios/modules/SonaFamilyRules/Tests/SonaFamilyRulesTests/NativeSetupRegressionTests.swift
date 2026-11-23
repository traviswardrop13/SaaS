import Foundation
import XCTest
@testable import SonaFamilyRules

final class NativeSetupRegressionTests: XCTestCase {
    private struct Setup: Encodable {
        var name = "A synthetic nickname"
        var age = "6"
        var focusSounds = ["S"]
        var mode = "speech"
        var pathReason = ""
        var minutes: Int? = 5
        var character = "fox"
    }

    private var fresh: [String: String] {
        ["sona.profile.v1": #"{"onboarded":false,"focusSounds":["R"],"earlyAdopter":true,"weeklyGoal":3}"#,
         "sona.freeera.v1":"post", "sona.freeera2.v1":"done", "sona.freeera3.v1":"done",
         "sona.freeera4.v1":"done", "sona.freeera5.v1":"done"]
    }

    private func profile(_ result: NativeFamilyRules.Outcome, key: String = "sona.profile.v1") throws -> [String: Any] {
        let raw = try XCTUnwrap(result.changes[key])
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any])
    }

    func testSetupSavesOnlyTheChosenSoundAndSuppliedOptionalAgeAndMinuteGoal() throws {
        for (minutes, goal) in [(3, 18), (5, 30), (10, 60)] {
            var input = Setup(); input.minutes = minutes
            let output = try NativeFamilyRules.evaluate(.completeSetup, input: input, storage: fresh)
            let saved = try profile(output)
            XCTAssertEqual(saved["childName"] as? String, input.name)
            XCTAssertEqual(saved["childAge"] as? String, "6")
            XCTAssertEqual(saved["focusSounds"] as? [String], ["S"])
            XCTAssertEqual(saved["dailyMinutes"] as? Int, minutes)
            XCTAssertEqual(saved["dailyGoal"] as? Int, goal)
            XCTAssertEqual(saved["mode"] as? String, "speech")
            XCTAssertEqual(saved["character"] as? String, "fox")
            XCTAssertEqual(saved["onboarded"] as? Bool, true)
            XCTAssertEqual(saved["earlyAdopter"] as? Bool, true)
            XCTAssertEqual(saved["weeklyGoal"] as? Int, 3)
            XCTAssertNil(output.changes["sona.sub.v1"])
            XCTAssertNil(output.changes["sona.pilot.v1"])
            XCTAssertTrue(output.removals.isEmpty)
        }
    }

    func testOptionalAgeAndSkippedMinutesNeverGuessOrOverwriteAnExistingGoal() throws {
        var storage = fresh
        storage["sona.profile.v1"] = #"{"onboarded":false,"dailyGoal":40,"dailyMinutes":7,"weeklyGoal":2}"#
        var input = Setup(); input.age = ""; input.minutes = nil
        let saved = try profile(NativeFamilyRules.evaluate(.completeSetup, input: input, storage: storage))
        XCTAssertEqual(saved["childAge"] as? String, "")
        XCTAssertEqual(saved["dailyGoal"] as? Int, 40)
        XCTAssertEqual(saved["dailyMinutes"] as? Int, 7)
        XCTAssertEqual(saved["weeklyGoal"] as? Int, 2)
    }

    func testNotSureUsesCanonicalGeneralPlayOrderInsteadOfAnInventedTarget() throws {
        var input = Setup(); input.focusSounds = []; input.mode = "play"; input.pathReason = "unsure"
        let saved = try profile(NativeFamilyRules.evaluate(.completeSetup, input: input, storage: fresh))
        XCTAssertEqual(saved["focusSounds"] as? [String], ["P","B","M","N","T","D","K","G","F","V","CH","J","S","Z","SH","L","TH","THV","R"])
        XCTAssertEqual(saved["mode"] as? String, "play")
        XCTAssertEqual(saved["pathReason"] as? String, "unsure")
    }

    func testMissingChoiceOrMalformedFieldsCannotMarkSetupComplete() throws {
        var invalid = [Setup]()
        var input = Setup(); input.name = "   "; invalid.append(input)
        input = Setup(); input.age = "99"; invalid.append(input)
        input = Setup(); input.focusSounds = []; invalid.append(input)
        input = Setup(); input.focusSounds = ["R", "UNKNOWN"]; invalid.append(input)
        input = Setup(); input.minutes = 4; invalid.append(input)
        input = Setup(); input.mode = "assessment"; invalid.append(input)
        input = Setup(); input.mode = "play"; input.pathReason = "unsure"; invalid.append(input)
        for input in invalid {
            XCTAssertThrowsError(try NativeFamilyRules.evaluate(.completeSetup, input: input, storage: fresh))
        }
        XCTAssertThrowsError(try NativeFamilyRules.evaluate(.completeSetup, input: [String: String](), storage: fresh))
    }

    func testSecondChildSkipsMinutesAndKeepsSiblingAndHouseholdBytes() throws {
        var storage = fresh
        storage["sona.kids.v1"] = #"{"list":[{"slot":""},{"slot":"k2"}],"active":"k2","hi":2}"#
        storage["sona.profile.v1@k2"] = #"{"onboarded":false,"dailyGoal":36,"founding":true}"#
        let original = storage["sona.profile.v1"]
        var input = Setup(); input.minutes = nil
        let output = try NativeFamilyRules.evaluate(.completeSetup, input: input, storage: storage)
        let saved = try profile(output, key: "sona.profile.v1@k2")
        XCTAssertEqual(saved["childName"] as? String, input.name)
        XCTAssertEqual(saved["dailyGoal"] as? Int, 36)
        XCTAssertEqual(saved["founding"] as? Bool, true)
        XCTAssertNil(output.changes["sona.profile.v1"])
        XCTAssertEqual(storage["sona.profile.v1"], original)
        XCTAssertNil(output.changes["sona.kids.v1"])
        input.minutes = 10
        XCTAssertThrowsError(try NativeFamilyRules.evaluate(.completeSetup, input: input, storage: storage))
    }

    func testReturningSetupCannotRewriteAnAlreadyOnboardedFamily() throws {
        var storage = fresh
        storage["sona.profile.v1"] = #"{"childName":"Kept","onboarded":true,"dailyGoal":45,"focusSounds":["L"],"founding":true}"#
        let output = try NativeFamilyRules.evaluate(.completeSetup, input: Setup(), storage: storage)
        XCTAssertTrue(output.changes.isEmpty)
        XCTAssertTrue(output.removals.isEmpty)
    }

    func testSetupFormUsesTheAuthoredSoundWordsAndDoesNotPersistAnyRead() throws {
        let output = try NativeFamilyRules.evaluate(.setupForm, input: [String: String](), storage: fresh)
        let form = try XCTUnwrap(JSONSerialization.jsonObject(with: output.value) as? [String: Any])
        let sounds = try XCTUnwrap(form["sounds"] as? [[String: Any]])
        XCTAssertEqual(sounds.prefix(4).compactMap { $0["id"] as? String }, ["R", "S", "L", "TH"])
        XCTAssertEqual(sounds.count, 19)
        for sound in sounds {
            let pieces = try XCTUnwrap(sound["pieces"] as? [[String: Any]])
            XCTAssertFalse(pieces.compactMap { $0["text"] as? String }.joined().isEmpty)
        }
        XCTAssertEqual(form["askMinutes"] as? Bool, true)
        XCTAssertEqual(form["focusSounds"] as? [String], [])
        XCTAssertTrue(output.changes.isEmpty)
        XCTAssertTrue(output.removals.isEmpty)
    }

    func testPreviouslyAskedHouseholdKeepsItsShortPathAndCannotRewriteMinutes() throws {
        var storage = fresh
        storage["sona.setupasks.v1"] = #"{"v":2,"therapy":"t_no"}"#
        let form = try NativeFamilyRules.evaluate(.setupForm, input: [String: String](), storage: storage)
        let value = try XCTUnwrap(JSONSerialization.jsonObject(with: form.value) as? [String: Any])
        XCTAssertEqual(value["askMinutes"] as? Bool, false)
        var input = Setup(); input.minutes = nil
        let output = try NativeFamilyRules.evaluate(.completeSetup, input: input, storage: storage)
        XCTAssertNil(output.changes["sona.setupasks.v1"])
        input.minutes = 3
        XCTAssertThrowsError(try NativeFamilyRules.evaluate(.completeSetup, input: input, storage: storage))
    }
}
