import Foundation
import XCTest
@testable import SonaFamilyRules

final class NativeArcadeCheckpointTests: XCTestCase {
    struct Input: Encodable {
        let game, sound: String
        let card: Int
        var boostLevel: String? = nil
        var boostAsk: String? = nil
        var boostPosition: String? = nil
    }
    private func storage(_ patch: [String: Any] = [:]) throws -> [String: String] {
        let profile: [String: Any] = ["childName":"Synthetic", "childAge":"7", "onboarded":true,
            "focusSounds":["R"], "targetSound":"R", "voiceOn":true, "volume":0.8, "wordPosition":"i"]
        return ["sona.profile.v1":String(decoding: try JSONSerialization.data(withJSONObject: profile.merging(patch) { _, b in b }), as: UTF8.self),
            "sona.freeera.v1":"post","sona.freeera2.v1":"done","sona.freeera3.v1":"done","sona.freeera4.v1":"done","sona.freeera5.v1":"done"]
    }
    private func selection(_ p: Input, patch: [String: Any] = [:]) throws -> [String: Any]? {
        let result = try NativeFamilyRules.evaluate(.arcadeCheckpoint, input: p, storage: storage(patch))
        XCTAssertTrue(Set(result.changes.keys).isSubset(of: ["sona.profile.v1"]), "Only the source's legacy audio-flag healing may write; no rep/progress/game grant")
        XCTAssertTrue(result.removals.isEmpty)
        return try JSONSerialization.jsonObject(with: result.value, options: .fragmentsAllowed) as? [String: Any]
    }
    func testFiveGamesKeepTheChargedSoundAndOriginalTitles() throws {
        let titles = ["tiles":"Say “sss” for song 2!", "stack":"Say “sss” for floor 2!",
            "run":"Say “sss” to run to the beach!", "glide":"Say “sss” to fly on!", "rise":"Say “sss” to rise higher!"]
        for (game, title) in titles {
            let value = try XCTUnwrap(selection(.init(game:game,sound:"S",card:1,boostLevel:"word",boostAsk:"rabbit",boostPosition:"i")))
            let desired = try XCTUnwrap(value["desired"] as? [String: Any]), bare = try XCTUnwrap(value["bare"] as? [String: Any])
            XCTAssertEqual(value["sound"] as? String, "S")
            XCTAssertEqual(desired["text"] as? String, "sss")
            XCTAssertEqual(desired["level"] as? String, "isolation")
            XCTAssertEqual(desired["clip"] as? String, "/coach/say-echo/S-sound.wav")
            XCTAssertEqual(desired["modelText"] as? String, "")
            XCTAssertEqual(desired["title"] as? String, title)
            XCTAssertEqual(try JSONSerialization.data(withJSONObject: desired, options: .sortedKeys), try JSONSerialization.data(withJSONObject: bare, options: .sortedKeys))
            XCTAssertEqual(value["intro"] as? String, "To keep playing, say")
        }
    }
    func testSlicePreservesTheChargedSyllableAndWord() throws {
        for (level, word) in [("syllable", "rah"), ("word", "rabbit")] {
            let value = try XCTUnwrap(selection(.init(game:"slice",sound:"R",card:1,boostLevel:level,boostAsk:word,boostPosition:"i"),
                patch: level == "word" ? ["ladderStart":"word"] : [:]))
            let ask = try XCTUnwrap(value["desired"] as? [String: Any])
            XCTAssertEqual(ask["level"] as? String, level); XCTAssertEqual(ask["text"] as? String, word)
            XCTAssertEqual(ask["modelText"] as? String, "To keep playing, say... \(word).")
            XCTAssertEqual(ask["title"] as? String, "Say “\(word)” for wave 2!")
            XCTAssertEqual(ask["clip"] as? String, "")
            XCTAssertEqual(value["modelWaitMilliseconds"] as? Int, 3_000)
            XCTAssertEqual(value["voiceTailMilliseconds"] as? Int, 250)
        }
    }
    func testSourceHoldsAndPositionMismatchCannotReuseAHarderTarget() throws {
        for patch: [String: Any] in [["childAge":"4"], ["volume":0]] {
            let value = try XCTUnwrap(selection(.init(game:"slice",sound:"R",card:2,boostLevel:"word",boostAsk:"rabbit",boostPosition:"i"), patch: patch))
            XCTAssertEqual((value["desired"] as? [String: Any])?["level"] as? String, "isolation")
        }
        let changed = try XCTUnwrap(selection(.init(game:"slice",sound:"R",card:1,boostLevel:"word",boostAsk:"rabbit",boostPosition:"m")))
        XCTAssertNotEqual((changed["desired"] as? [String: Any])?["text"] as? String, "rabbit")
        let end = try XCTUnwrap(selection(.init(game:"slice",sound:"R",card:1,boostLevel:"word",boostAsk:"car",boostPosition:"f"), patch:["wordPosition":"f"]))
        XCTAssertEqual((end["desired"] as? [String: Any])?["text"] as? String, "car")
        XCTAssertEqual((end["desired"] as? [String: Any])?["position"] as? String, "f")
        let legacy = try XCTUnwrap(selection(.init(game:"slice",sound:"R",card:1), patch:["voiceOn":false]))
        XCTAssertEqual(legacy["voiceOn"] as? Bool, true)
        XCTAssertEqual((legacy["desired"] as? [String: Any])?["level"] as? String, "syllable")
    }
    func testNewLifeAlwaysUsesRecordedBareSoundAndAuthoredLifeLine() throws {
        for game in ["slice","tiles","stack","run","glide","rise"] {
            let value = try XCTUnwrap(selection(.init(game:game,sound:"R",card:0,boostLevel:"word",boostAsk:"rabbit",boostPosition:"i")))
            XCTAssertEqual(value["intro"] as? String, "For a new life, say")
            let ask = try XCTUnwrap(value["desired"] as? [String: Any])
            XCTAssertEqual(ask["level"] as? String, "isolation")
            XCTAssertEqual(ask["text"] as? String, "rrrr")
            XCTAssertEqual(ask["title"] as? String, "Say “rrrr” for a new life!")
        }
    }
    func testUnsupportedGameSoundCardAndMalformedHandoverFailClosed() throws {
        for p in [Input(game:"feed",sound:"R",card:1), .init(game:"slice",sound:"../../x",card:1),
                  .init(game:"glide",sound:"R",card:3), .init(game:"slice",sound:"R",card:1,boostLevel:"invented",boostAsk:"taco")] {
            XCTAssertNil(try selection(p))
        }
    }
}
