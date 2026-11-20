import Foundation
import XCTest
@testable import SonaFamilyRules

final class NativeFamilyRulesTests: XCTestCase {
    private let profile = #"{"childName":"Player","childAge":"7","focusSounds":["R","S"],"targetSound":"S","onboarded":true}"#

    private var family: [String: String] {
        ["sona.profile.v1": profile, "sona.freeera.v1": "post", "sona.freeera2.v1": "done",
         "sona.freeera3.v1": "done", "sona.freeera4.v1": "done", "sona.freeera5.v1": "done"]
    }

    private func value(_ result: NativeFamilyRules.Outcome) throws -> [String: Any] {
        try XCTUnwrap(JSONSerialization.jsonObject(with: result.value) as? [String: Any])
    }

    func testReadOnlySummaryKeepsKnownSoundAndDoesNotPersistBootChanges() throws {
        let result = try NativeFamilyRules.evaluate(.summary, input: [String: String](), storage: family)
        XCTAssertEqual(try value(result)["sound"] as? String, "S")
        XCTAssertTrue(result.changes.isEmpty)
        XCTAssertTrue(result.removals.isEmpty)
    }

    func testParentProgressSeparatesPracticeAndGameRepCountsByChild() throws {
        var storage = family
        storage["sona.profile.v1@k2"] = profile
        storage["sona.kids.v1"] = #"{"list":[{"slot":""},{"slot":"k2"}],"active":"k2","hi":2}"#
        struct Attempt: Encodable {
            let sound = "S", word = "s", level = "isolation", pos = ""
            let pass = true, reps = 3
        }
        let practiced = try NativeFamilyRules.evaluate(.attempt, input: Attempt(), storage: storage)
        storage.merge(practiced.changes) { _, new in new }
        let game = try NativeFamilyRules.evaluate(.gameRep, input: ["sound": "S"], storage: storage)
        storage.merge(game.changes) { _, new in new }
        let sibling = try value(NativeFamilyRules.evaluate(.summary, input: [String: String](), storage: storage))
        let siblingProgress = try XCTUnwrap(sibling["parentProgress"] as? [String: Any])
        XCTAssertEqual(siblingProgress["thisWeek"] as? Int, 3)
        XCTAssertEqual(siblingProgress["gameWeek"] as? Int, 1)
        XCTAssertEqual((siblingProgress["days"] as? [Bool])?.count, 7)
        XCTAssertEqual((siblingProgress["sounds"] as? [[String: Any]])?.first?["id"] as? String, "S")
        storage["sona.kids.v1"] = #"{"list":[{"slot":""},{"slot":"k2"}],"active":"","hi":2}"#
        let original = try value(NativeFamilyRules.evaluate(.summary, input: [String: String](), storage: storage))
        let originalProgress = try XCTUnwrap(original["parentProgress"] as? [String: Any])
        XCTAssertEqual(originalProgress["thisWeek"] as? Int, 0)
        XCTAssertEqual(originalProgress["gameWeek"] as? Int, 0)
    }

    func testFeedBitesOnlyChangeTheActivePlayersLifetimeCount() throws {
        var storage = family
        storage["sona.profile.v1@k2"] = profile
        storage["sona.kids.v1"] = #"{"list":[{"slot":""},{"slot":"k2"}],"active":"k2","hi":2}"#
        storage["sona.feed.v1"] = #"{"fed":12}"#
        storage["sona.feed.v1@k2"] = #"{"fed":4}"#
        let moved = try NativeFamilyRules.evaluate(.feedGrowth, input: [String: String](), storage: storage)
        XCTAssertEqual(Set(moved.changes.keys), ["sona.feed.v1@k2"])
        storage.merge(moved.changes) { _, new in new }
        let feed = try value(NativeFamilyRules.evaluate(.feedGame, input: [String: String](), storage: storage))
        XCTAssertEqual(feed["lifetimeFed"] as? Int, 5)
        XCTAssertEqual(storage["sona.feed.v1"], #"{"fed":12}"#)
        XCTAssertTrue(moved.removals.isEmpty)
    }

    func testCalendarInitializesAndKeepsOnlyTheActiveSiblingAnchor() throws {
        var storage = family
        storage["sona.profile.v1@k2"] = profile
        storage["sona.kids.v1"] = #"{"list":[{"slot":""},{"slot":"k2"}],"active":"k2","hi":2}"#
        let result = try NativeFamilyRules.evaluate(.ensureCalendar, input: [String: String](), storage: storage, canSell: true)
        XCTAssertEqual(Set(result.changes.keys), ["sona.quest.v1@k2"])
        let saved = storage.merging(result.changes) { _, value in value }
        let readAgain = try NativeFamilyRules.evaluate(.ensureCalendar, input: [String: String](), storage: saved, canSell: true)
        XCTAssertTrue(readAgain.changes.isEmpty)
        let quest = try XCTUnwrap(try value(readAgain)["quest"] as? [String: Any])
        XCTAssertEqual(quest["day"] as? Int, 1)
    }

    func testTappingUnrelatedGameCannotFinishTodaysStory() throws {
        let denied = try NativeFamilyRules.evaluate(.questFinish, input: ["game": "pizza"], storage: family, canSell: true)
        XCTAssertTrue(denied.changes.isEmpty)
        XCTAssertTrue(denied.removals.isEmpty)
    }

    func testSayAndPlayUsesOriginalCountsAndTheAssignedWordPosition() throws {
        var storage = family
        storage["sona.homework.v1"] = #"{"hw":{"id":"assignment","sounds":["L"],"pos":"f","repsPerDay":40,"start":"2000-01-01","due":"2999-01-01"}}"#
        for (key, sayings, steps) in [("bubbles", 1, 5), ("peekaboo", 2, 5), ("robot", 2, 8), ("flower", 2, 5)] {
            let result = try value(NativeFamilyRules.evaluate(.speechGame, input: ["game": key], storage: storage))
            XCTAssertEqual(result["sound"] as? String, "L")
            XCTAssertEqual(result["sayings"] as? Int, sayings)
            let targets = try XCTUnwrap(result["targets"] as? [[String: String]])
            XCTAssertEqual(targets.count, steps)
            XCTAssertTrue(targets.allSatisfy { $0["position"] == "f" })
        }
    }

    func testStoryGamesAskThreeSayingsUsingTheOriginalAgeBranches() throws {
        for (age, firstCount, laterCount) in [("3", 6, 5), ("7", 8, 8)] {
            var storage = family
            storage["sona.profile.v1"] = profile.replacingOccurrences(of: #""childAge":"7""#, with: "\"childAge\":\"\(age)\"")
            for (key, count) in [("lighthouse", firstCount), ("windup", firstCount), ("frontdoor", laterCount), ("observatory", laterCount)] {
                let result = try value(NativeFamilyRules.evaluate(.speechGame, input: ["game": key], storage: storage))
                XCTAssertEqual(result["sayings"] as? Int, 3)
                XCTAssertEqual((result["targets"] as? [[String: String]])?.count, count)
                XCTAssertTrue((result["intro"] as? String)?.contains("three times") == true)
            }
        }
    }

    func testBookWordUsesTheAuthoredKeyAndDoesNotPromptBelowItsAgeNorm() throws {
        struct Input: Encodable {
            let title = "Rory and the Rainbow", word = "rory", sound = "R"
            let captions = ["Rory looked for a rainbow."]
            let caption = "Rory looked for Rory."
        }
        let chosen = try value(NativeFamilyRules.evaluate(.bookWord, input: Input(), storage: family))
        XCTAssertEqual(chosen["word"] as? String, "Rory")
        XCTAssertEqual(chosen["sayings"] as? Int, 1)
        let marked = try XCTUnwrap(chosen["promptPieces"] as? [[String: Any]])
        XCTAssertEqual(marked.compactMap { $0["text"] as? String }.joined(), "Rory")
        XCTAssertEqual(marked.first?["marked"] as? Bool, true)
        let caption = try XCTUnwrap(chosen["captionPieces"] as? [[String: Any]])
        XCTAssertEqual(caption.filter { $0["key"] as? Bool == true }.compactMap { $0["text"] as? String }, ["Rory"])
        var younger = family
        younger["sona.profile.v1"] = profile.replacingOccurrences(of: #""childAge":"7""#, with: #""childAge":"3""#)
        let reading = try value(NativeFamilyRules.evaluate(.bookWord, input: Input(), storage: younger))
        XCTAssertTrue(reading["word"] is NSNull)
        let talking = try value(NativeFamilyRules.evaluate(.storyWord, input: Input(), storage: younger))
        XCTAssertEqual(talking["word"] as? String, "rory")
        XCTAssertEqual(talking["sayings"] as? Int, 3)
    }

    func testShopCannotEquipARoadBuddyOrSpendUnownedCoins() throws {
        var storage = family
        storage["sona.buddyset.v1"] = "post"
        let locked = try NativeFamilyRules.evaluate(.equip, input: ["kind": "characters", "id": "unicorn"], storage: storage)
        XCTAssertEqual(try value(locked)["accepted"] as? Bool, false)
        XCTAssertTrue(locked.changes.isEmpty)
        let chosen = try NativeFamilyRules.evaluate(.equip, input: ["kind": "characters", "id": "bunny"], storage: storage)
        XCTAssertEqual(try value(chosen)["accepted"] as? Bool, true)
        XCTAssertEqual(Set(chosen.changes.keys), ["sona.profile.v1"])
    }

    func testChargePlannerUsesAssignedSoundAndOriginalFirstRung() throws {
        var storage = family
        storage["sona.homework.v1"] = #"{"hw":{"id":"assignment","sounds":["L"],"pos":"f","repsPerDay":40,"start":"2000-01-01","due":"2999-01-01"}}"#
        let result = try NativeFamilyRules.evaluate(.practiceTarget, input: ["game": "arcade-slice.html"], storage: storage)
        let decoded = try value(result)
        let target = try XCTUnwrap(decoded["target"] as? [String: Any])
        XCTAssertEqual(decoded["sound"] as? String, "L")
        XCTAssertEqual(decoded["practicePosition"] as? String, "f")
        XCTAssertEqual(target["level"] as? String, "isolation")
        XCTAssertTrue(result.changes.isEmpty)
    }

    func testVerifiedAttemptUpdatesOnlyTheChosenSibling() throws {
        struct Attempt: Encodable {
            let sound = "S", word = "ssss", level = "isolation", pos = ""
            let pass = true, reps = 2
        }
        var storage = family
        storage["sona.profile.v1@k2"] = profile
        storage["sona.kids.v1"] = #"{"list":[{"slot":""},{"slot":"k2"}],"active":"k2","hi":2}"#
        let result = try NativeFamilyRules.evaluate(.attempt, input: Attempt(), storage: storage)
        XCTAssertNotNil(result.changes["sona.outcomes.v1@k2"])
        XCTAssertNotNil(result.changes["sona.attempts.v1@k2"])
        XCTAssertNil(result.changes["sona.outcomes.v1"])
        let goal = try XCTUnwrap(try value(result)["goal"] as? [String: Any])
        XCTAssertEqual(goal["n"] as? Int, 2)
    }

    func testSilenceCannotGrantProgressOrOpenChest() throws {
        struct Attempt: Encodable {
            let sound = "S", word = "ssss", level = "isolation", pos = ""
            let pass = true, reps = 0
        }
        XCTAssertThrowsError(try NativeFamilyRules.evaluate(.attempt, input: Attempt(), storage: family))
        let denied = try NativeFamilyRules.evaluate(.chestOpen, input: ["scope": "fixture"], storage: family)
        XCTAssertEqual(try value(denied)["accepted"] as? Bool, false)
        XCTAssertTrue(denied.changes.isEmpty)
        XCTAssertTrue(denied.removals.isEmpty)
    }

    func testBookCompletionOnlyWritesTheReadFlagAndIsRepeatable() throws {
        let input = ["title": "Rory and the Rainbow"]
        let result = try NativeFamilyRules.evaluate(.bookRead, input: input, storage: family)
        XCTAssertEqual(Set(result.changes.keys), ["sona.lib.read.v1"])
        let next = family.merging(result.changes) { _, new in new }
        let repeated = try NativeFamilyRules.evaluate(.bookRead, input: input, storage: next)
        XCTAssertTrue(repeated.changes.isEmpty)
    }
}
