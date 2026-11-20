import Foundation
import XCTest
@testable import SonaSpeechCore

final class PracticeFlowContentTests: XCTestCase {
    // Evaluated from the unchanged charge.html soundName/sayLine/soundSlot
    // functions, with every existing Sona.CUES and SOUND_SAY entry. These are
    // existing source words, never recordings or newly selected child targets.
    func testAllExistingSoundPromptParity() throws {
        struct Fixture: Decodable {
            let sound: String, text: String, cueTip: String
            let initial: String, replay: String, retry: String, stepDown: String
            let before: String, after: String
        }
        let fixtures = try JSONDecoder().decode([Fixture].self, from: Data(Self.soundFixtures.utf8))
        XCTAssertEqual(fixtures.count, 19)
        for fixture in fixtures {
            let content = PracticeFlowContent(sound: fixture.sound, rung: .isolation,
                                              text: fixture.text, cueTip: fixture.cueTip)
            XCTAssertEqual(content.initialPrompt(), fixture.initial, fixture.sound)
            XCTAssertEqual(content.initialPrompt(includeFirstCue: false), fixture.replay, fixture.sound)
            XCTAssertEqual(content.retryPrompt(), fixture.retry, fixture.sound)
            XCTAssertEqual(content.stepDownPrompt(), fixture.stepDown, fixture.sound)
            let slot = try XCTUnwrap(content.soundSlot(in: fixture.initial))
            XCTAssertEqual(slot.before, fixture.before, fixture.sound)
            XCTAssertEqual(slot.after, fixture.after, fixture.sound)
            XCTAssertEqual(slot.recordingPath, "/coach/say-echo/" + fixture.sound + "-sound.wav")
            XCTAssertEqual(slot.wholeFallbackPath, "/coach/say-echo/" + fixture.sound + ".mp3")
            XCTAssertNil(content.soundSlot(in: fixture.initial, humanClipsEnabled: false))
        }
    }

    func testRungsKeepTheSuppliedTargetAndWord() {
        let cue = "Pull your tongue back and up like a tiger growl — rrr!"
        let syllable = PracticeFlowContent(sound: "R", rung: .syllable, text: "ree", cueTip: cue)
        XCTAssertEqual(syllable.initialPrompt(), "Ready? Say ree, five times. Go!")
        XCTAssertEqual(syllable.stepDownPrompt(), "I have an idea. Let's try this one. Say ree. Go!")
        XCTAssertNil(syllable.soundSlot(in: syllable.initialPrompt()))
        let word = PracticeFlowContent(sound: "R", rung: .word, text: "rabbit", cueTip: cue)
        XCTAssertEqual(word.initialPrompt(requiredReps: 3), "Ready? Say rabbit, three times. Go!")
        XCTAssertEqual(word.target.word, "rabbit")
        XCTAssertEqual(word.target.sentence, "")
        let sentence = PracticeFlowContent(sound: "R", rung: .sentence, text: "Here is a rabbit.",
                                           word: "rabbit", cueTip: cue)
        // The sentence's existing punctuation remains untouched, including the
        // period before the current page's comma in its initial prompt.
        XCTAssertEqual(sentence.initialPrompt(), "Ready? Say Here is a rabbit., five times. Go!")
        XCTAssertEqual(sentence.target.word, "rabbit")
        XCTAssertEqual(sentence.target.sentence, "Here is a rabbit.")
        XCTAssertEqual(sentence.rung, .sentence)
        XCTAssertEqual(PracticeRung.allCases.map(\.index), [0, 1, 2, 3])
        XCTAssertNil(PracticeRung.isolation.previous)
        XCTAssertEqual(PracticeRung.sentence.previous, .word)
    }

    func testSourceFallbacksAndTheUncuedReplay() {
        let target = PracticeTarget(sound: "THV", word: "thuh", level: "isolation")
        let content = PracticeFlowContent(target: target, text: "thuh")
        XCTAssertEqual(content.soundName, "T H")
        XCTAssertEqual(content.initialPrompt(), "Ready? Make your T H sound, five times. Go!")
        XCTAssertEqual(content.retryPrompt(), "Let's try that one again. Let's try our T H sound again. Go!")
        XCTAssertNil(content.soundSlot(in: "Good practicing. Let's play."))
        let emptyAlternatives = PracticeFlowContent(sound: "R", rung: .word, text: "rabbit", say: "", display: "", word: "")
        XCTAssertEqual(emptyAlternatives.initialPrompt(), "Ready? Say rabbit, five times. Go!")
        XCTAssertEqual(emptyAlternatives.stepDownPrompt(), "I have an idea. Let's try this one. Say rabbit. Go!")
        XCTAssertEqual(emptyAlternatives.target.word, "rabbit")
        let differentFields = PracticeFlowContent(sound: "R", rung: .word, text: "rabbit", say: "red", display: "rain")
        // sayLine uses say/display/t; step-down uses say/t.
        XCTAssertEqual(differentFields.initialPrompt(), "Ready? Say red, five times. Go!")
        XCTAssertEqual(differentFields.stepDownPrompt(), "I have an idea. Let's try this one. Say red. Go!")
    }

    func testQuietAndLaunchCopyStaysWordForWord() {
        XCTAssertEqual(PracticeFlowContent.quiet.title, "I couldn't hear you!")
        XCTAssertEqual(PracticeFlowContent.quiet.body, "Say it big — I'm all ears!")
        XCTAssertEqual(PracticeFlowContent.quiet.spoken, "I couldn't hear you! Say it big — I'm all ears!")
        XCTAssertEqual(PracticeFlowContent.quiet.retryTitle, "Try again")
        XCTAssertEqual(PracticeFlowContent.quiet.laterTitle, "Maybe later")
        XCTAssertEqual(PracticeFlowContent.microphoneUnavailable.title, "Let's get a grown-up")
        XCTAssertEqual(PracticeFlowContent.microphoneUnavailable.body, "Another app may be using the microphone. Close it, then try again.")
        XCTAssertNil(PracticeFlowContent.microphoneUnavailable.spoken)
        XCTAssertEqual(PracticeFlowContent.successfulLaunchPrompt, "You did it. Let's play.")
        XCTAssertEqual(PracticeFlowContent.finalFailurePrompt, "Good practicing. Let's play.")
        XCTAssertEqual(PracticeFlowContent.stepDownSuccessFallbackPrompt, "You did it.")
        XCTAssertEqual(PracticeFlowContent.launchTitle, "Here we go!")
        XCTAssertEqual(PracticeFlowContent.simpleLaunchTitle, "Let’s play together!")
        XCTAssertEqual(PracticeFlowContent.launchKicker, "Up next")
        XCTAssertEqual(PracticeFlowContent.afterChimeMilliseconds, 600)
        XCTAssertEqual(PracticeFlowContent.launchDelayMilliseconds, 1200)
    }

    private static let soundFixtures = #"""
[
  {
    "sound": "R",
    "text": "rrrr",
    "cueTip": "Pull your tongue back and up like a tiger growl — rrr!",
    "initial": "Ready? Pull your tongue back and up, and make your R sound, five times. Go!",
    "replay": "Ready? Make your R sound, five times. Go!",
    "retry": "Let's try that one again. Pull your tongue back and up like a tiger growl. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your R sound. Go!",
    "before": "Ready? Pull your tongue back and up, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "S",
    "text": "sss",
    "cueTip": "Teeth together, big smile, let the air hiss out — sss like a snake.",
    "initial": "Ready? Teeth together, and make your S sound, five times. Go!",
    "replay": "Ready? Make your S sound, five times. Go!",
    "retry": "Let's try that one again. Teeth together, big smile, let the air hiss out. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your S sound. Go!",
    "before": "Ready? Teeth together, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "L",
    "text": "lll",
    "cueTip": "Tongue tip up behind your top teeth — lll, la la la.",
    "initial": "Ready? Tongue tip up behind your top teeth, and make your L sound, five times. Go!",
    "replay": "Ready? Make your L sound, five times. Go!",
    "retry": "Let's try that one again. Tongue tip up behind your top teeth. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your L sound. Go!",
    "before": "Ready? Tongue tip up behind your top teeth, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "K",
    "text": "kuh",
    "cueTip": "The back of your tongue pops up in the back — k! k! k!",
    "initial": "Ready? The back of your tongue pops up in the back, and make your K sound, five times. Go!",
    "replay": "Ready? Make your K sound, five times. Go!",
    "retry": "Let's try that one again. The back of your tongue pops up in the back. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your K sound. Go!",
    "before": "Ready? The back of your tongue pops up in the back, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "G",
    "text": "guh",
    "cueTip": "Like K, but turn your voice on — g! g! g!",
    "initial": "Ready? Like K, and make your G sound, five times. Go!",
    "replay": "Ready? Make your G sound, five times. Go!",
    "retry": "Let's try that one again. Like K, but turn your voice on. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your G sound. Go!",
    "before": "Ready? Like K, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "F",
    "text": "ffff",
    "cueTip": "Top teeth on your bottom lip, blow soft — ffff.",
    "initial": "Ready? Top teeth on your bottom lip, and make your F sound, five times. Go!",
    "replay": "Ready? Make your F sound, five times. Go!",
    "retry": "Let's try that one again. Top teeth on your bottom lip, blow soft. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your F sound. Go!",
    "before": "Ready? Top teeth on your bottom lip, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "V",
    "text": "vvvv",
    "cueTip": "Like F, but buzz your voice — vvvv.",
    "initial": "Ready? Like F, and make your V sound, five times. Go!",
    "replay": "Ready? Make your V sound, five times. Go!",
    "retry": "Let's try that one again. Like F, but buzz your voice. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your V sound. Go!",
    "before": "Ready? Like F, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "SH",
    "text": "shhh",
    "cueTip": "Round your lips and whisper quiet — shhh.",
    "initial": "Ready? Round your lips and whisper quiet, and make your S H sound, five times. Go!",
    "replay": "Ready? Make your S H sound, five times. Go!",
    "retry": "Let's try that one again. Round your lips and whisper quiet. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your S H sound. Go!",
    "before": "Ready? Round your lips and whisper quiet, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "CH",
    "text": "chuh",
    "cueTip": "Pop it like a little train — ch! ch! ch!",
    "initial": "Ready? Pop it, and make your C H sound, five times. Go!",
    "replay": "Ready? Make your C H sound, five times. Go!",
    "retry": "Let's try that one again. Pop it like a little train. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your C H sound. Go!",
    "before": "Ready? Pop it, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "J",
    "text": "juh",
    "cueTip": "Like CH, but turn your voice on — j! j! j!",
    "initial": "Ready? Like CH, and make your J sound, five times. Go!",
    "replay": "Ready? Make your J sound, five times. Go!",
    "retry": "Let's try that one again. Like CH, but turn your voice on. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your J sound. Go!",
    "before": "Ready? Like CH, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "TH",
    "text": "thhh",
    "cueTip": "Peek your tongue between your teeth and blow soft — th.",
    "initial": "Ready? Peek your tongue between your teeth and blow soft, and make your T H sound, five times. Go!",
    "replay": "Ready? Make your T H sound, five times. Go!",
    "retry": "Let's try that one again. Peek your tongue between your teeth and blow soft. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your T H sound. Go!",
    "before": "Ready? Peek your tongue between your teeth and blow soft, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "THV",
    "text": "thuh",
    "cueTip": "Tongue between your teeth and buzz — th, like in 'the'.",
    "initial": "Ready? Tongue between your teeth and buzz, and make your T H sound, five times. Go!",
    "replay": "Ready? Make your T H sound, five times. Go!",
    "retry": "Let's try that one again. Tongue between your teeth and buzz. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your T H sound. Go!",
    "before": "Ready? Tongue between your teeth and buzz, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "Z",
    "text": "zzz",
    "cueTip": "Teeth together and buzz like a bee — zzzz.",
    "initial": "Ready? Teeth together and buzz, and make your Z sound, five times. Go!",
    "replay": "Ready? Make your Z sound, five times. Go!",
    "retry": "Let's try that one again. Teeth together and buzz like a bee. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your Z sound. Go!",
    "before": "Ready? Teeth together and buzz, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "P",
    "text": "puh",
    "cueTip": "Press your lips and pop a little puff — p! p! p!",
    "initial": "Ready? Press your lips and pop a little puff, and make your P sound, five times. Go!",
    "replay": "Ready? Make your P sound, five times. Go!",
    "retry": "Let's try that one again. Press your lips and pop a little puff. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your P sound. Go!",
    "before": "Ready? Press your lips and pop a little puff, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "B",
    "text": "buh",
    "cueTip": "Lips together, turn your voice on — b! b! b!",
    "initial": "Ready? Lips together, and make your B sound, five times. Go!",
    "replay": "Ready? Make your B sound, five times. Go!",
    "retry": "Let's try that one again. Lips together, turn your voice on. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your B sound. Go!",
    "before": "Ready? Lips together, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "M",
    "text": "mmm",
    "cueTip": "Lips together and hum — mmmm.",
    "initial": "Ready? Lips together and hum, and make your M sound, five times. Go!",
    "replay": "Ready? Make your M sound, five times. Go!",
    "retry": "Let's try that one again. Lips together and hum. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your M sound. Go!",
    "before": "Ready? Lips together and hum, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "N",
    "text": "nnn",
    "cueTip": "Tongue up behind your teeth and hum — nnnn.",
    "initial": "Ready? Tongue up behind your teeth and hum, and make your N sound, five times. Go!",
    "replay": "Ready? Make your N sound, five times. Go!",
    "retry": "Let's try that one again. Tongue up behind your teeth and hum. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your N sound. Go!",
    "before": "Ready? Tongue up behind your teeth and hum, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "T",
    "text": "tuh",
    "cueTip": "Tongue taps behind your top teeth — t! t! t!",
    "initial": "Ready? Tongue taps behind your top teeth, and make your T sound, five times. Go!",
    "replay": "Ready? Make your T sound, five times. Go!",
    "retry": "Let's try that one again. Tongue taps behind your top teeth. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your T sound. Go!",
    "before": "Ready? Tongue taps behind your top teeth, and make your",
    "after": "sound, five times. Go!"
  },
  {
    "sound": "D",
    "text": "duh",
    "cueTip": "Like T, but turn your voice on — d! d! d!",
    "initial": "Ready? Like T, and make your D sound, five times. Go!",
    "replay": "Ready? Make your D sound, five times. Go!",
    "retry": "Let's try that one again. Like T, but turn your voice on. Go!",
    "stepDown": "I have an idea. Let's try this one. Make your D sound. Go!",
    "before": "Ready? Like T, and make your",
    "after": "sound, five times. Go!"
  }
]
"""#
}
