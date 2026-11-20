import Foundation
import XCTest
@testable import SonaSpeechCore

@MainActor private final class SayingDriver: PracticeAudioDriver {
    var frames: (@MainActor (PracticeAcousticFrame) -> Void)?
    var recognizerStarts: [[String]] = []
    var finishCalls = 0
    var startSucceeds = true
    var words: [PracticeRecognitionResult] = []
    var closeTranscript = ""
    var holdFinish = false
    var finishing: CheckedContinuation<PracticeRecognitionResult, Never>?
    func setInterruptionHandler(_ handler: (@MainActor () -> Void)?) {}
    func requestPermissions() async -> Bool { true }
    func playPrompt(_ prompt: PracticePrompt) async throws {}
    func stopPlayback() {}
    func openMicrophone(onFrame: @escaping @MainActor (PracticeAcousticFrame) -> Void,
                        onInterruption: @escaping @MainActor () -> Void) async throws { frames = onFrame }
    func startRecognition(words: [String], maxMilliseconds: Double) async -> Bool {
        recognizerStarts.append(words); return startSucceeds
    }
    func finishRecognition() async -> PracticeRecognitionResult {
        finishCalls += 1
        if holdFinish { return await withCheckedContinuation { finishing = $0 } }
        return words.isEmpty ? .unavailable : words.removeFirst()
    }
    func closeMicrophone() async -> String { frames = nil; return closeTranscript }
}

@MainActor private final class SayingHarness {
    var time = 0.0
    let driver = SayingDriver()
    var results: [PracticeAttemptResult] = []
    lazy var session: PracticeTurnSession = {
        let value = PracticeTurnSession(target: target, prompt: .init(text: "Existing approved model", parts: []),
            requiredReps: required, driver: driver, automaticallyAdvance: false, nowMilliseconds: { [unowned self] in time })
        value.onResult = { [weak self] in self?.results.append($0) }
        return value
    }()
    let target: PracticeTarget
    let required: Int
    init(level: String = "word", required: Int = 1, sound: String = "R", word: String = "rabbit", position: String = "") {
        target = .init(sound: sound, word: word, level: level, sentence: level == "sentence" ? "Here is a \(word)." : "", position: position)
        self.required = required
    }
    func drain() async { for _ in 0..<60 { await Task.yield() } }
    func start() async {
        session.startAfterGrownUpConsent(); await drain()
        send(from: 0, through: 300, voiced: false); await drain()
        time = 500; session.advance(); await drain()
        time = 750; session.advance(); await drain()
    }
    func send(from start: Double, through end: Double, voiced: Bool, available: Bool = true) {
        for tick in stride(from: start, through: end, by: 20) {
            time = tick; driver.frames?(Self.frame(tick, voiced: voiced, available: available))
        }
    }
    static func frame(_ time: Double, voiced: Bool, available: Bool = true) -> PracticeAcousticFrame {
        let rate = 48_000.0
        var samples = [Float](repeating: 0, count: 1024)
        var bins = [Float](repeating: -100, count: 512)
        var shape = [UInt8](repeating: 0, count: 256)
        for i in samples.indices {
            if voiced {
                let phase = 2 * Double.pi * 187.5 * Double(i) / rate
                samples[i] = Float((1...24).reduce(0.0) { $0 + 0.12 / Double($1) * sin(Double($1) * phase) })
            } else { samples[i] = i.isMultiple(of: 2) ? 0.005 : -0.005 }
        }
        if voiced {
            for i in bins.indices where Double(i) * rate / 1024 < 6000 { bins[i] = i.isMultiple(of: 4) ? -40 : -70 }
            for i in [2,4,6,8] { shape[i] = 230 }
        }
        return .init(timestampMilliseconds: time, sampleRate: rate, samples: samples,
            spectrumDecibels: bins, energyRMS: voiced ? 0.17 : 0.005,
            shapeSpectrumBytes: shape, isAvailable: available)
    }
}

final class PracticePerSayingTests: XCTestCase {
    @MainActor func testLocalVoiceOnlyNominatesUntilItsOwnUnbiasedTranscriptPasses() async {
        let h = SayingHarness(); h.driver.words = [.onDevice("rabbit")]
        await h.start()
        XCTAssertEqual(h.driver.recognizerStarts, [[]], "Checking must not hint the answer")
        h.send(from: 900, through: 1160, voiced: true)
        XCTAssertEqual(h.session.machine.reps, 0, "Acoustic evidence alone is only a word candidate")
        h.send(from: 1180, through: 1360, voiced: false); await h.drain()
        XCTAssertEqual(h.driver.finishCalls, 0, "Finish requires 200 ms observed quiet, not an early partial")
        h.send(from: 1380, through: 1400, voiced: false); await h.drain()
        XCTAssertEqual(h.driver.finishCalls, 1)
        XCTAssertEqual(h.session.machine.reps, 1)
        await h.session.cancelAndClose()
    }
    @MainActor func testUnknownWordCannotFallBackToBroadFamilyShape() async {
        let h = SayingHarness(); h.driver.words = [.onDevice("uh")]; h.driver.closeTranscript = "uh"
        await h.start()
        h.send(from: 900, through: 1160, voiced: true)
        h.send(from: 1180, through: 1600, voiced: false); await h.drain()
        XCTAssertEqual(h.session.machine.reps, 0)
        h.time = 20_750; h.session.advance(); await h.drain()
        h.time += 200; h.session.advance(); await h.drain()
        XCTAssertEqual(h.session.machine.phase, .quiet)
        XCTAssertTrue(h.results.isEmpty, "Unknown transcript must not approve a voiced word via shape")
        await h.session.cancelAndClose()
    }
    @MainActor func testEachSayingRequiresAFreshRecognizerAfterARealQuietGap() async {
        let h = SayingHarness(required: 2); h.driver.words = [.onDevice("wabbit"), .onDevice("rabbit")]
        await h.start()
        h.send(from: 900, through: 1160, voiced: true)
        h.send(from: 1180, through: 1400, voiced: false); await h.drain()
        XCTAssertEqual(h.session.machine.reps, 1)
        h.send(from: 1420, through: 1640, voiced: false); await h.drain()
        XCTAssertEqual(h.driver.recognizerStarts, [[], []])
        h.send(from: 1700, through: 1960, voiced: true)
        h.send(from: 1980, through: 2200, voiced: false); await h.drain()
        XCTAssertEqual(h.driver.finishCalls, 2)
        XCTAssertEqual(h.session.machine.reps, 2)
        await h.session.cancelAndClose()
    }
    @MainActor func testUnavailablePerWordRecognizerCannotCreditLocalShape() async {
        let h = SayingHarness(); h.driver.startSucceeds = false
        await h.start()
        h.send(from: 900, through: 1160, voiced: true)
        XCTAssertEqual(h.session.machine.reps, 0)
        XCTAssertEqual(h.session.machine.phase, .quiet)
        XCTAssertTrue(h.results.isEmpty)
        await h.session.cancelAndClose()
    }
    @MainActor func testSentenceRequiresItsTargetAndDoesNotCountTheFrameAlone() async {
        let h = SayingHarness(level: "sentence"); h.driver.words = [.onDevice("Here is a")]
        await h.start(); h.send(from: 900, through: 1160, voiced: true)
        h.send(from: 1180, through: 1400, voiced: false); await h.drain()
        XCTAssertEqual(h.driver.finishCalls, 1); XCTAssertEqual(h.session.machine.reps, 0)
        XCTAssertTrue(h.session.machine.wordCheckIssue)
        await h.session.cancelAndClose()
    }
    @MainActor func testUnrelatedWordNeverCountsThenNextFreshTargetMayCount() async {
        let h = SayingHarness(); h.driver.words = [.onDevice("taco"), .onDevice("rabbit")]
        await h.start(); h.send(from: 900, through: 1160, voiced: true)
        h.send(from: 1180, through: 1400, voiced: false); await h.drain()
        XCTAssertEqual(h.session.machine.reps, 0)
        h.send(from: 1420, through: 1640, voiced: false); await h.drain()
        h.send(from: 1700, through: 1960, voiced: true)
        h.send(from: 1980, through: 2200, voiced: false); await h.drain()
        XCTAssertEqual(h.session.machine.reps, 1); XCTAssertEqual(h.driver.finishCalls, 2)
        await h.session.cancelAndClose()
    }
    @MainActor func testOneMixedTranscriptCannotApproveSeveralReps() async {
        let h = SayingHarness(required: 5); h.driver.words = [.onDevice("rabbit taco taco")]
        await h.start(); h.send(from: 900, through: 1160, voiced: true)
        h.send(from: 1180, through: 1400, voiced: false); await h.drain()
        XCTAssertEqual(h.session.machine.reps, 1)
        h.time = 20_750; h.session.advance(); await h.drain()
        h.time += 200; h.session.advance(); await h.drain()
        XCTAssertEqual(h.results.first?.reps, 1); XCTAssertEqual(h.results.first?.verdict, .pass)
        XCTAssertEqual(h.results.count, 1)
        await h.session.cancelAndClose()
    }
    @MainActor func testAContinuousSoundAndElapsedTimeDoNotFinishTheWord() async {
        let h = SayingHarness(); h.driver.words = [.onDevice("rabbit")]
        await h.start(); h.send(from: 900, through: 1800, voiced: true); await h.drain()
        XCTAssertEqual(h.driver.finishCalls, 0); XCTAssertEqual(h.session.machine.reps, 0)
        h.time = 5000; h.session.advance(); await h.drain()
        XCTAssertEqual(h.driver.finishCalls, 0); XCTAssertEqual(h.session.machine.reps, 0)
        await h.session.cancelAndClose()
    }
    @MainActor func testUnavailableInputResetsObservedQuietTail() async {
        let h = SayingHarness(); h.driver.words = [.onDevice("rabbit")]
        await h.start(); h.send(from: 900, through: 1160, voiced: true)
        h.send(from: 1180, through: 1280, voiced: false)
        h.send(from: 1300, through: 1520, voiced: false, available: false)
        h.send(from: 1540, through: 1720, voiced: false); await h.drain()
        XCTAssertEqual(h.driver.finishCalls, 0); XCTAssertEqual(h.session.machine.reps, 0)
        h.send(from: 1740, through: 1760, voiced: false); await h.drain()
        XCTAssertEqual(h.driver.finishCalls, 1); XCTAssertEqual(h.session.machine.reps, 1)
        await h.session.cancelAndClose()
    }
    @MainActor func testLateOnDeviceResultAfterPauseCannotCreditTheOldSaying() async {
        let h = SayingHarness(); h.driver.holdFinish = true
        await h.start(); h.send(from: 900, through: 1160, voiced: true)
        h.send(from: 1180, through: 1400, voiced: false); await h.drain()
        XCTAssertEqual(h.driver.finishCalls, 1); XCTAssertNotNil(h.driver.finishing)
        h.session.pause()
        h.driver.finishing?.resume(returning: .onDevice("rabbit")); h.driver.finishing = nil
        await h.drain()
        XCTAssertEqual(h.session.machine.reps, 0); XCTAssertEqual(h.session.machine.phase, .paused)
        XCTAssertTrue(h.results.isEmpty)
        await h.session.cancelAndClose()
    }
    @MainActor func testUnavailableOnDeviceResultNeverUsesAWholeRoundTranscript() async {
        let h = SayingHarness(); h.driver.words = [.unavailable]; h.driver.closeTranscript = "rabbit"
        await h.start(); h.send(from: 900, through: 1160, voiced: true)
        h.send(from: 1180, through: 1400, voiced: false); await h.drain()
        h.time = 20_750; h.session.advance(); await h.drain()
        h.time += 200; h.session.advance(); await h.drain()
        XCTAssertEqual(h.session.machine.reps, 0); XCTAssertEqual(h.session.machine.phase, .quiet)
        XCTAssertTrue(h.results.isEmpty)
        await h.session.cancelAndClose()
    }
    @MainActor func testBlendPositionCannotBeLostBetweenContentAndPerSayingVerification() async {
        let h = SayingHarness(sound: "S", word: "stop", position: "b"); h.driver.words = [.onDevice("top")]
        await h.start(); h.send(from: 900, through: 1160, voiced: true)
        h.send(from: 1180, through: 1400, voiced: false); await h.drain()
        XCTAssertEqual(h.driver.finishCalls, 1)
        XCTAssertEqual(h.session.machine.target.position, "b")
        XCTAssertEqual(h.session.machine.reps, 0, "Dropping a blend's target sound is never an accepted close try")
        await h.session.cancelAndClose()
    }
    @MainActor func testLegacyIsolationRecognizerAlsoUsesNoAnswerHints() async {
        let h = SayingHarness(level: "isolation", word: "rrrr")
        await h.start()
        XCTAssertEqual(h.driver.recognizerStarts, [[]])
        await h.session.cancelAndClose()
    }
}
