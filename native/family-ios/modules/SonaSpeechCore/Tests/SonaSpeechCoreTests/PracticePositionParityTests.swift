import Foundation
import XCTest
@testable import SonaSpeechCore

final class PracticePositionParityTests: XCTestCase {
    private struct Reference: Decodable {
        let sourceFixtureCount: Int
        let fixtures: [Fixture]
    }
    private struct Fixture: Decodable {
        let text: String, sound: String, word: String, level: String, frame: String, position: String
        let expected: PracticeWordVerdict
    }
    func testCurrentShippingHEAR2IncludingEveryOriginalVerdictCaseAndPositionalTable() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "positional-hear-reference", withExtension: "json", subdirectory: "Fixtures"))
        let reference = try JSONDecoder().decode(Reference.self, from: Data(contentsOf: url))
        XCTAssertGreaterThan(reference.sourceFixtureCount, 0)
        for (index, f) in reference.fixtures.enumerated() {
            XCTAssertEqual(PracticeWordVerdict.evaluate(transcript: f.text, sound: f.sound, word: f.word,
                level: f.level, frame: f.frame, position: f.position), f.expected,
                "Source case \(index): [\(f.sound) \(f.position) \(f.level)] \(f.text) for \(f.word)")
        }
    }
    func testCanonicalItemPositionReachesBothFlowContentTargetInitializers() {
        let direct = PracticeFlowContent(sound: "S", rung: .word, text: "stop", position: "b")
        XCTAssertEqual(direct.position, "b"); XCTAssertEqual(direct.target.position, "b")
        let target = PracticeTarget(sound: "R", word: "tree", level: "word", position: "b")
        let carried = PracticeFlowContent(target: target, text: "tree")
        XCTAssertEqual(carried.position, "b"); XCTAssertEqual(carried.target.position, "b")
        let explicit = PracticeFlowContent(target: target, text: "tree", position: "i")
        XCTAssertEqual(explicit.position, "i"); XCTAssertEqual(explicit.target.position, "i")
    }
}
