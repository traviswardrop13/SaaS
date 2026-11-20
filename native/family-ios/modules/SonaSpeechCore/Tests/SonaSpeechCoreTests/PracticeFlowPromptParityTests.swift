import XCTest
@testable import SonaSpeechCore

final class PracticeFlowPromptParityTests: XCTestCase {
    // These are the output of the shipping charge.html sayLine function,
    // with its actual authored say/display distinction, not new cue wording.
    func testVocalicSpokenFormWinsOverPrintedForm() {
        let item = PracticeFlowContent(sound: "R", rung: .syllable, text: "ar", say: "are", display: "ar")
        XCTAssertEqual(item.initialPrompt(), "Ready? Say are, five times. Go!")
    }

    func testSentenceUsesAuthoredSayWithoutThePrintedFullStop() {
        let item = PracticeFlowContent(sound: "R", rung: .sentence,
                                       text: "I see a car.", say: "I see a car", display: "I see a car.", word: "car")
        XCTAssertEqual(item.initialPrompt(), "Ready? Say I see a car, five times. Go!")
        XCTAssertEqual(item.target.sentence, "I see a car.")
    }

    func testEmptySpokenFormFallsBackToPrintedThenRawSource() {
        let printed = PracticeFlowContent(sound: "R", rung: .word, text: "raw", say: "", display: "rabbit")
        XCTAssertEqual(printed.initialPrompt(), "Ready? Say rabbit, five times. Go!")
        let raw = PracticeFlowContent(sound: "R", rung: .word, text: "rabbit", say: "", display: "")
        XCTAssertEqual(raw.initialPrompt(), "Ready? Say rabbit, five times. Go!")
    }

    func testSourceCueFirstRidesOnlyTheFirstHigherRungAsk() {
        let cue = "Pull your tongue back and up like a tiger growl — rrr!"
        let item = PracticeFlowContent(sound: "R", rung: .word, text: "car", cueTip: cue,
                                       position: "f", cueFirst: true)
        XCTAssertEqual(item.initialPrompt(), "Ready? Pull your tongue back and up, and say car, five times. Go!")
        XCTAssertEqual(item.initialPrompt(includeFirstCue: false), "Ready? Say car, five times. Go!")
        XCTAssertEqual(item.position, "f")
        let ordinary = PracticeFlowContent(sound: "R", rung: .word, text: "car", cueTip: cue)
        XCTAssertEqual(ordinary.initialPrompt(), "Ready? Say car, five times. Go!")
    }
}
