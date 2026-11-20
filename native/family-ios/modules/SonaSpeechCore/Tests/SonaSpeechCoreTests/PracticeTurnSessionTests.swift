import Foundation
import XCTest
@testable import SonaSpeechCore

@MainActor
private final class SyntheticAudioDriver: PracticeAudioDriver {
    var permission = true
    var permissionCalls = 0
    var opens = 0
    var closes = 0
    var prompts: [PracticePrompt] = []
    var recognitionBudgets: [Double] = []
    var finalTranscript = ""
    var microphoneLive = false
    var holdOpen = false
    var holdPermission = false
    var openContinuation: CheckedContinuation<Void, Never>?
    var permissionContinuation: CheckedContinuation<Bool, Never>?
    var sessionInterruption: (@MainActor () -> Void)?
    var frames: (@MainActor (PracticeAcousticFrame) -> Void)?
    var oldFrames: [@MainActor (PracticeAcousticFrame) -> Void] = []

    func setInterruptionHandler(_ handler: (@MainActor () -> Void)?) { sessionInterruption = handler }
    func requestPermissions() async -> Bool {
        permissionCalls += 1
        if holdPermission { return await withCheckedContinuation { permissionContinuation = $0 } }
        return permission
    }
    func playPrompt(_ prompt: PracticePrompt) async throws {
        XCTAssertFalse(microphoneLive, "Echo may never play into the microphone")
        prompts.append(prompt)
    }
    func stopPlayback() {}
    func openMicrophone(onFrame: @escaping @MainActor (PracticeAcousticFrame) -> Void,
                        onInterruption: @escaping @MainActor () -> Void) async throws {
        opens += 1
        frames = onFrame
        oldFrames.append(onFrame)
        if holdOpen { await withCheckedContinuation { openContinuation = $0 } }
        microphoneLive = true
    }
    func startRecognition(words: [String], maxMilliseconds: Double) async -> Bool {
        XCTAssertTrue(microphoneLive)
        recognitionBudgets.append(maxMilliseconds)
        return true
    }
    func closeMicrophone() async -> String {
        closes += 1
        microphoneLive = false
        frames = nil
        defer { finalTranscript = "" }
        return finalTranscript
    }
}

final class PracticeTurnSessionTests: XCTestCase {
    @MainActor private func drain() async { for _ in 0..<40 { await Task.yield() } }

    /// Synthetic periodic waveform plus its analyser fixture. No mic, recording,
    /// file, account or network is touched by this end-to-end turn.
    private func frame(at time: Double, voiced: Bool) -> PracticeAcousticFrame {
        let rate = 48_000.0
        var samples = [Float](repeating: 0, count: 1024)
        var bins = [Float](repeating: -100, count: 512)
        var shape = [UInt8](repeating: 0, count: 256)
        for index in samples.indices {
            if voiced {
                let phase = 2 * Double.pi * 187.5 * Double(index) / rate
                samples[index] = Float((1...24).reduce(0.0) { $0 + 0.12 / Double($1) * sin(Double($1) * phase) })
            } else { samples[index] = index.isMultiple(of: 2) ? 0.005 : -0.005 }
        }
        if voiced {
            for index in bins.indices where Double(index) * rate / 1024 < 6000 {
                bins[index] = index.isMultiple(of: 4) ? -40 : -70
            }
            for index in [2, 4, 6, 8] { shape[index] = 230 }
        }
        return PracticeAcousticFrame(timestampMilliseconds: time, sampleRate: rate, samples: samples,
                                     spectrumDecibels: bins, energyRMS: voiced ? 0.17 : 0.005,
                                     shapeSpectrumBytes: shape)
    }

    @MainActor func testSyntheticVoicingFlowsFromPCMToOnePracticeResult() async {
        var time = 0.0
        let driver = SyntheticAudioDriver()
        let approvedText = "Ready? Make your R sound, five times. Go!"
        let prompt = PracticePrompt(text: approvedText, parts: [])
        let session = PracticeTurnSession(target: .init(sound: "R", word: "rrrr", level: "isolation"),
                                          prompt: prompt, driver: driver, automaticallyAdvance: false,
                                          nowMilliseconds: { time })
        var results: [PracticeAttemptResult] = []
        session.onResult = { results.append($0) }
        session.startAfterGrownUpConsent()
        await drain()
        XCTAssertEqual(session.machine.phase, .measuringRoom)
        for tick in stride(from: 0.0, through: 300, by: 20) {
            time = tick
            driver.frames?(frame(at: tick, voiced: false))
        }
        await drain()
        XCTAssertFalse(driver.microphoneLive)
        time = 499; session.advance(); await drain()
        XCTAssertTrue(driver.prompts.isEmpty)
        time = 500; session.advance(); await drain()
        XCTAssertEqual(driver.prompts, [prompt], "the approved prompt is passed through verbatim")
        XCTAssertEqual(session.machine.phase, .quietTail)
        time = 749; session.advance(); await drain()
        XCTAssertEqual(driver.opens, 1)
        time = 750; session.advance(); await drain()
        XCTAssertEqual(driver.opens, 2)
        XCTAssertEqual(driver.recognitionBudgets, [15_000])
        for index in 0..<5 {
            let start = 900 + Double(index) * 650
            for tick in stride(from: start, through: start + 240, by: 20) {
                time = tick; driver.frames?(frame(at: tick, voiced: true))
            }
            for tick in stride(from: start + 260, through: start + 600, by: 20) {
                time = tick; driver.frames?(frame(at: tick, voiced: false))
            }
        }
        XCTAssertEqual(session.machine.reps, 5)
        driver.finalTranscript = "Rrrr"
        session.advance()
        await drain()
        XCTAssertFalse(driver.microphoneLive)
        XCTAssertTrue(results.isEmpty, "no completion over a mic or inside its 200 ms settle")
        time += 200; session.advance(); await drain()
        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results.first?.reps, 5)
        XCTAssertEqual(results.first?.verdict, .pass)
        time += 10_000; session.advance(); await drain()
        XCTAssertEqual(results.count, 1)
        await session.cancelAndClose()
    }

    @MainActor func testReentrantObserverCannotStartPermissionAfterCancellation() async {
        let driver = SyntheticAudioDriver()
        let session = PracticeTurnSession(target: .init(sound: "R", word: "rrrr", level: "isolation"),
                                          prompt: .init(text: "", parts: []), driver: driver,
                                          automaticallyAdvance: false, nowMilliseconds: { 0 })
        session.onChange = { state in if state.phase == .permission { session.pause() } }
        session.startAfterGrownUpConsent()
        await drain()
        XCTAssertEqual(driver.permissionCalls, 0)
        XCTAssertEqual(driver.opens, 0)
        XCTAssertEqual(session.machine.phase, .paused)
        await session.cancelAndClose()
    }

    @MainActor func testLateAuthorizationNeverOpensAClosedSession() async {
        let driver = SyntheticAudioDriver()
        driver.holdPermission = true
        let session = PracticeTurnSession(target: .init(sound: "R", word: "rrrr", level: "isolation"),
                                          prompt: .init(text: "", parts: []), driver: driver,
                                          automaticallyAdvance: false, nowMilliseconds: { 0 })
        session.startAfterGrownUpConsent()
        await drain()
        XCTAssertEqual(driver.permissionCalls, 1)
        await session.cancelAndClose()
        driver.permissionContinuation?.resume(returning: true)
        driver.permissionContinuation = nil
        await drain()
        XCTAssertEqual(session.machine.phase, .cancelled)
        XCTAssertEqual(driver.opens, 0)
        XCTAssertTrue(driver.prompts.isEmpty)
    }

    @MainActor func testLateMicrophoneOpenClosesBeforeCancelReturns() async {
        let driver = SyntheticAudioDriver()
        driver.holdOpen = true
        let session = PracticeTurnSession(target: .init(sound: "R", word: "rrrr", level: "isolation"),
                                          prompt: .init(text: "", parts: []), driver: driver,
                                          automaticallyAdvance: false, nowMilliseconds: { 0 })
        session.startAfterGrownUpConsent()
        await drain()
        XCTAssertNotNil(driver.openContinuation)
        let close = Task { await session.cancelAndClose() }
        await drain()
        driver.openContinuation?.resume()
        driver.openContinuation = nil
        await close.value
        XCTAssertFalse(driver.microphoneLive)
        XCTAssertTrue(driver.recognitionBudgets.isEmpty)
        XCTAssertEqual(session.machine.phase, .cancelled)
        XCTAssertTrue(driver.prompts.isEmpty)
    }

    @MainActor func testAudioInterruptionAfterRoomStillRequiresExplicitResume() async {
        var time = 0.0
        let driver = SyntheticAudioDriver()
        let session = PracticeTurnSession(target: .init(sound: "R", word: "rrrr", level: "isolation"),
                                          prompt: .init(text: "", parts: []), driver: driver,
                                          automaticallyAdvance: false, nowMilliseconds: { time })
        session.startAfterGrownUpConsent(); await drain()
        for tick in stride(from: 0.0, through: 300, by: 20) {
            time = tick; driver.frames?(frame(at: tick, voiced: false))
        }
        await drain()
        time = 500; session.advance(); await drain()
        XCTAssertEqual(session.machine.phase, .quietTail)
        driver.sessionInterruption?(); await drain()
        XCTAssertEqual(session.machine.phase, .paused)
        time = 30_000; session.setForeground(true); session.advance(); await drain()
        XCTAssertEqual(session.machine.phase, .paused)
        XCTAssertEqual(driver.opens, 1)
        await session.cancelAndClose()
    }
}
