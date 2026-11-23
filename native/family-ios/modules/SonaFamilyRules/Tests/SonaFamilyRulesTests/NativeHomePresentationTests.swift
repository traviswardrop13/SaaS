import XCTest
import JavaScriptCore
@testable import SonaFamilyRules

/// Current today.html:533–562,603–609; presentation reads never mark an intro seen.
final class NativeHomePresentationTests: XCTestCase {
    private let stamps = ["sona.freeera.v1":"post", "sona.freeera2.v1":"done", "sona.freeera3.v1":"done",
                          "sona.freeera4.v1":"done", "sona.freeera5.v1":"done", "sona.freever.v1":"kept"]
    private func storage(sound: String = "R", premium: Bool = true, play: Bool = false) -> [String:String] {
        var s = stamps
        s["sona.profile.v1"] = #"{"childName":"Synthetic","childAge":"7","onboarded":true,"focusSounds":["SOUND"],"targetSound":"SOUND","mode":"speech"}"#.replacingOccurrences(of: "SOUND", with: sound)
        if play { s["sona.profile.v1"] = #"{"childName":"Synthetic","childAge":"7","onboarded":true,"focusSounds":["R","S"],"mode":"play"}"# }
        if premium { s["sona.founder"] = "1" }
        return s
    }
    private func summary(_ s: [String:String], canSell: Bool = false) throws -> [String:Any] {
        let result = try NativeFamilyRules.evaluate(.summary, input: [String:String](), storage: s, canSell: canSell)
        XCTAssertTrue(result.changes.isEmpty, "Home reads must not persist setup/calendar/seen changes")
        XCTAssertTrue(result.removals.isEmpty)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: result.value) as? [String:Any])
    }
    private func canonical(_ expression: String, _ s: [String:String], canSell: Bool = false) throws -> Any? {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Sources/SonaFamilyRules/Rules")
        let js = try XCTUnwrap(JSContext()); var failed = false
        js.exceptionHandler = { _, _ in failed = true }
        defer { js.exceptionHandler = nil }
        js.evaluateScript(try String(contentsOf: root.appendingPathComponent("host.js")))
        let env = String(decoding: try JSONSerialization.data(withJSONObject: ["storage": s, "canSell":canSell]), as: UTF8.self)
        js.objectForKeyedSubscript("nativeInstall").call(withArguments: [env])
        for name in ["sona", "gamecontent"] { js.evaluateScript(try String(contentsOf: root.appendingPathComponent(name + ".js"))) }
        let result = js.evaluateScript(expression)?.toObject()
        XCTAssertFalse(failed)
        return result
    }
    private func home(_ summary: [String:Any]) throws -> [String:Any] { try XCTUnwrap(summary["home"] as? [String:Any]) }
    private func card(_ summary: [String:Any]) throws -> [String:Any] { try XCTUnwrap(try home(summary)["card"] as? [String:Any]) }
    private func mutate(_ operation: NativeFamilyRules.Operation, input: [String:String], _ s: [String:String]) throws -> [String:String] {
        let result = try NativeFamilyRules.evaluate(operation, input: input, storage: s)
        var next = s; next.merge(result.changes) { _, value in value }; result.removals.forEach { next.removeValue(forKey:$0) }
        return next
    }
    func testUnseenStoryUsesCanonicalDayHookAndStillPictureWithoutMarkingSeen() throws {
        let s = storage(); let value = try summary(s)
        let quest = try XCTUnwrap(value["quest"] as? [String:Any]); let story = try XCTUnwrap(quest["story"] as? [String:Any])
        let shown = try card(value)
        XCTAssertEqual(shown["title"] as? String, story["title"] as? String)
        XCTAssertEqual(shown["hook"] as? String, quest["line"] as? String)
        XCTAssertEqual(shown["dayLabel"] as? String, "Day \(try XCTUnwrap(quest["day"] as? Int))")
        XCTAssertEqual(shown["actionLabel"] as? String, "Start today")
        XCTAssertEqual(shown["done"] as? Bool, false)
        XCTAssertEqual(shown["locked"] as? Bool, false)
        XCTAssertEqual(try summary(s)["quest"] as? NSDictionary, quest as NSDictionary)
    }
    func testOnlyActualSeenMutationChangesActionToKeepGoing() throws {
        let s = storage(); let first = try summary(s)
        let quest = try XCTUnwrap(first["quest"] as? [String:Any]); let story = try XCTUnwrap(quest["story"] as? [String:Any])
        let id = try XCTUnwrap(story["id"] as? String)
        XCTAssertEqual(try card(first)["actionLabel"] as? String, "Start today")
        let seen = try mutate(.storySeen, input: ["id":id], s)
        XCTAssertEqual(try card(summary(seen))["actionLabel"] as? String, "Keep going")
        XCTAssertEqual(try card(summary(s))["actionLabel"] as? String, "Start today", "Reading another household snapshot must not mark this one")
    }
    func testCompletedStoryShowsInertTomorrowAndDoesNotChangeSavedCalendar() throws {
        let s = storage(); let first = try summary(s)
        let q = try XCTUnwrap(first["quest"] as? [String:Any]); let game = try XCTUnwrap(q["game"] as? String)
        let completed = try mutate(.questFinish, input: ["game":game], s)
        let value = try summary(completed); let quest = try XCTUnwrap(value["quest"] as? [String:Any])
        let next = try XCTUnwrap(quest["next"] as? [String:Any]); let shown = try card(value)
        XCTAssertEqual(shown["done"] as? Bool, true)
        XCTAssertEqual(shown["label"] as? String, "Tomorrow")
        XCTAssertEqual(shown["title"] as? String, "Day \(try XCTUnwrap(quest["day"] as? Int)) done!")
        XCTAssertEqual(shown["dayLabel"] as? String, "")
        XCTAssertEqual(shown["actionLabel"] as? String, "")
        if next["kind"] as? String == "story" {
            XCTAssertEqual(shown["hook"] as? String, "Come back tomorrow for Day \(try XCTUnwrap(next["day"] as? Int)) and a new game!")
            let story = try XCTUnwrap(next["story"] as? [String:Any]); let id = try XCTUnwrap(story["id"] as? String)
            let expectedFirst = story["talk"] as? Bool == true ? story["pic"] as? String : "/assets/adventure/\(id)/s01.webp"
            XCTAssertEqual((shown["imagePaths"] as? [String])?.first, expectedFirst)
        } else { XCTAssertEqual(shown["hook"] as? String, "Come back tomorrow for a new adventure!") }
    }
    func testLockedStoryKeepsCanonicalTitleAndOffersUnlockWithoutMarkingSeen() throws {
        let s = storage(premium:false); let value = try summary(s, canSell:true)
        let q = try XCTUnwrap(value["quest"] as? [String:Any]); XCTAssertEqual(q["kind"] as? String, "story")
        let shown = try card(value)
        let open = try canonical("Sona.storyOpen()", s, canSell:true) as? Bool
        XCTAssertEqual(shown["locked"] as? Bool, open != true)
        XCTAssertEqual(shown["actionLabel"] as? String, open == true ? "Start today" : "Unlock adventure")
        XCTAssertEqual(shown["done"] as? Bool, false)
    }
    func testBooksTagCountsOnlyCurrentShelfAndRetainsUnpinnedPlayBrowse() throws {
        for s in [storage(sound:"R",premium:false), storage(sound:"S",premium:false), storage(premium:false,play:true), storage(premium:true)] {
            let value = try summary(s)
            let expected = try canonical("Sona.isFree() ? 'Free' : Sona.booksOpen() ? 'Included' : Sona.freeBooksOnShelf() ? (Sona.freeBooksOnShelf() === 1 ? '1 free book' : Sona.freeBooksOnShelf() + ' free books') : 'Premium'", s) as? String
            XCTAssertEqual(try home(value)["booksTag"] as? String, expected)
        }
    }
    func testGameDayUsesActualGameAccessAndCanonicalPictureNotAStoryPlaceholder() throws {
        var s = storage()
        s["sona.quest.v1"] = #"{"f":[0,1,2,3,4,5,6,7,8,9,10,11,12,13],"last":0}"#
        let value = try summary(s); let q = try XCTUnwrap(value["quest"] as? [String:Any])
        XCTAssertEqual(q["kind"] as? String, "game")
        let key = try XCTUnwrap(q["game"] as? String); let shown = try card(value)
        XCTAssertEqual(shown["title"] as? String, try canonical("Sona.gameAct('\(key)').name", s) as? String)
        XCTAssertEqual(shown["hook"] as? String, q["line"] as? String)
        XCTAssertEqual(shown["dayLabel"] as? String, "")
        XCTAssertEqual((shown["imagePaths"] as? [String])?.first, try canonical("'/assets/crafted/home-' + Sona.CRAFTED_CARDS['\(key)'] + '.webp'", s) as? String)
    }
}
