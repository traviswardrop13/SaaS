// Standalone mocked adapter test. No live requests, OS permissions or audio.
import Foundation
import SonaSpeechCore

@MainActor private final class GuidedTestDriver: PracticeAudioDriver {
    var permission = true
    var permissionCalls = 0
    var opens = 0
    var live = false
    var prompts: [PracticePrompt] = []
    var transcript = ""
    var sayingAnswers: [PracticeRecognitionResult] = []
    var recognitionStarts: [[String]] = []
    var finishCalls = 0
    var closeCalls = 0
    var stopCalls = 0
    var interruptWhenText: String?
    var frames: (@MainActor (PracticeAcousticFrame) -> Void)?
    var interruption: (@MainActor () -> Void)?
    func setInterruptionHandler(_ handler: (@MainActor () -> Void)?) { interruption = handler }
    func requestPermissions() async -> Bool { permissionCalls += 1; return permission }
    func openMicrophone(onFrame: @escaping @MainActor (PracticeAcousticFrame) -> Void,
                        onInterruption: @escaping @MainActor () -> Void) async throws {
        opens += 1; live = true; frames = onFrame
    }
    func startRecognition(words: [String], maxMilliseconds: Double) async -> Bool {
        recognitionStarts.append(words); return live
    }
    func finishRecognition() async -> PracticeRecognitionResult {
        finishCalls += 1
        return sayingAnswers.isEmpty ? .unavailable : sayingAnswers.removeFirst()
    }
    func closeMicrophone() async -> String {
        closeCalls += 1
        live = false; frames = nil
        defer { transcript = "" }
        return transcript
    }
    func playPrompt(_ prompt: PracticePrompt) async throws {
        precondition(!live, "Model must never play over an open microphone")
        prompts.append(prompt)
        if interruptWhenText == prompt.text {
            interruptWhenText = nil; interruption?(); throw CancellationError()
        }
    }
    func stopPlayback() { stopCalls += 1 }
}

@MainActor private final class GuidedTestProvider: GuidedPracticePromptProviding {
    var fails = false
    var count = 0
    var modes: [GuidedPracticeVoiceMode] = []
    func prepare(_ request: GuidedPracticeVoiceRequest, plan: GuidedPracticePlan) async throws -> PracticePrompt {
        count += 1
        if fails { throw GuidedPracticeNarration.Failure.unavailable }
        let text: String
        switch request {
        case .turn(let turn, let mode):
            modes.append(mode)
            text = mode == .initial ? turn.prompt : turn.content.initialPrompt(requiredReps: plan.requiredReps, includeFirstCue: false)
        case .feedback(.finalFailure): text = PracticeFlowContent.finalFailurePrompt
        case .feedback(.successfulLaunch): text = PracticeFlowContent.successfulLaunchPrompt
        case .feedback(.stepDownPraise): text = PracticeFlowContent.stepDownSuccessFallbackPrompt
        case .quietNotice: text = PracticeFlowContent.quiet.spoken ?? ""
        }
        return PracticePrompt(text: text, parts: [], isMuted: true)
    }
}

@main struct GuidedPracticeContract {
    @MainActor static var checks = 0
    @MainActor static func check(_ value: Bool, _ label: String) {
        checks += 1
        precondition(value, "FAIL: " + label)
    }
    @MainActor static func drain() async { for _ in 0..<160 { await Task.yield() } }
    static func frame(_ time: Double, voiced: Bool) -> PracticeAcousticFrame {
        let rate = 48_000.0
        var samples = [Float](repeating: 0, count: 1024)
        var bins = [Float](repeating: -100, count: 512)
        var shape = [UInt8](repeating: 0, count: 256)
        for index in samples.indices {
            let phase = 2 * Double.pi * 187.5 * Double(index) / rate
            samples[index] = voiced ? Float((1...24).reduce(0.0) { $0 + 0.12 / Double($1) * sin(Double($1) * phase) }) : (index.isMultiple(of: 2) ? 0.005 : -0.005)
        }
        if voiced {
            for index in bins.indices where Double(index) * rate / 1024 < 6000 { bins[index] = index.isMultiple(of: 4) ? -40 : -70 }
            for index in [2, 4, 6, 8] { shape[index] = 230 }
        }
        return PracticeAcousticFrame(timestampMilliseconds: time, sampleRate: rate, samples: samples,
            spectrumDecibels: bins, energyRMS: voiced ? 0.17 : 0.005, shapeSpectrumBytes: shape)
    }

    @MainActor static func main() async throws {
        let cue = "Pull your tongue back and up like a tiger growl — rrr!"
        let content = PracticeFlowContent(sound: "R", rung: .isolation, text: "rrrr", cueTip: cue)
        let plan = GuidedPracticePlan(content: content, masteredRung: 0, gameTitle: "Fruit Slice")
        let provider = GuidedTestProvider()

        for unsupported in [nil,
            GuidedPracticePlan(content: PracticeFlowContent(sound: "R", rung: .word, text: "", cueTip: cue), masteredRung: 0, gameTitle: "Fruit Slice"),
            GuidedPracticePlan(content: PracticeFlowContent(sound: "R", rung: .sentence, text: "I see a rabbit.", cueTip: ""), masteredRung: 0, gameTitle: "Fruit Slice")] {
            let driver = GuidedTestDriver()
            let model = GuidedPracticeController(plan: unsupported, isCurrent: { true }, apply: { _ in fatalError("closed input cannot save") }, onReady: { _ in fatalError("closed input cannot launch") }, driver: driver, provider: provider)
            model.startAfterConsent(); await drain()
            check(model.presentation == .unavailable && driver.permissionCalls == 0 && driver.opens == 0, "missing canonical target or cue stays closed")
            await model.close()
        }

        let deniedDriver = GuidedTestDriver(); deniedDriver.permission = false
        let denied = GuidedPracticeController(plan: plan, isCurrent: { true }, apply: { _ in fatalError("denied mic cannot save") }, onReady: { _ in fatalError("denied mic cannot launch") }, driver: deniedDriver, provider: provider)
        check(deniedDriver.permissionCalls == 0 && provider.count == 0, "boot asks no permission and plays no voice")
        denied.startAfterConsent(); await drain()
        check(deniedDriver.permissionCalls == 1 && deniedDriver.opens == 0 && denied.presentation == .quiet, "denial uses existing unavailable card with zero input")
        denied.setForeground(false); denied.setForeground(true); await drain()
        check(deniedDriver.permissionCalls == 1 && deniedDriver.opens == 0, "foreground never resumes by itself")
        await denied.close()

        var now = 0.0
        var applied: [PracticeFlowMachine.Effect] = []
        var launched = 0
        let driver = GuidedTestDriver()
        let model = GuidedPracticeController(plan: plan, isCurrent: { true }, apply: { applied.append($0) }, onReady: { _ in launched += 1 }, driver: driver, provider: provider,
            automaticallyAdvance: false, nowMilliseconds: { now })
        model.startAfterConsent(); await drain()
        check(driver.opens == 1 && applied.isEmpty, "explicit Start only opens known-silent room measurement")
        for tick in stride(from: 0.0, through: 300, by: 20) { now = tick; driver.frames?(frame(tick, voiced: false)) }
        await drain(); now = 500; model.advance(); await drain()
        check(driver.prompts.first?.text == content.initialPrompt(), "actual adapter receives exact first source prompt")
        check(!driver.live && applied.isEmpty, "no model audio enters input and no timer earns credit")
        now = 750; model.advance(); await drain()
        check(driver.opens == 2 && driver.live, "listening starts only after prompt and quiet tail")
        for index in 0..<5 {
            let start = 900 + Double(index) * 650
            for tick in stride(from: start, through: start + 240, by: 20) { now = tick; driver.frames?(frame(tick, voiced: true)) }
            for tick in stride(from: start + 260, through: start + 600, by: 20) { now = tick; driver.frames?(frame(tick, voiced: false)) }
        }
        check(model.reps == 5, "five separate PCM sayings produce five observed reps")
        driver.interruptWhenText = PracticeFlowContent.successfulLaunchPrompt
        driver.transcript = "Rrrr"; model.advance(); await drain()
        check(applied.isEmpty, "verified ledger waits until input closes and settles")
        now += 200; model.advance(); await drain()
        try await Task.sleep(nanoseconds: 2_000_000_000)
        check(model.presentation == .paused && launched == 0 && !driver.live, "terminal launch-voice interruption is paused and resumable with input closed")
        model.resumeAfterTap()
        try await Task.sleep(nanoseconds: 2_000_000_000)
        let attempts = applied.compactMap { effect -> PracticeFlowMachine.VerifiedAttempt? in if case .saveVerifiedAttempt(let value) = effect { return value }; return nil }
        check(attempts.count == 1 && attempts[0].result.reps == 5 && attempts[0].result.verdict == .pass, "actual Core result reaches ledger once with five verified reps")
        check(launched == 1 && !driver.live && model.presentation == .finished, "handoff waits for exact feedback and awaited cleanup")
        check(driver.prompts.filter { $0.text == PracticeFlowContent.successfulLaunchPrompt }.count == 1, "interrupted terminal speech is optional and never replayed on Resume")
        now += 20_000; model.advance(); await drain()
        check(applied.count == 3 && launched == 1, "later ticks cannot double-save, win or launch")
        await model.close()

        // Exercise the actual advanced-rung driver seam, not a pre-computed
        // result: every accepted saying needs its own local final transcript.
        for rung in [PracticeRung.word, .sentence] {
            var wordNow = 0.0
            var wordEffects: [PracticeFlowMachine.Effect] = []
            var wordLaunches = 0
            let wordDriver = GuidedTestDriver()
            let line = rung == .word ? "rabbit" : "I see a rabbit."
            let spoken = rung == .word ? "rabbit" : "I see a rabbit"
            let item = PracticeFlowContent(sound: "R", rung: rung, text: line, word: "rabbit", cueTip: cue, position: "i")
            let wordPlan = GuidedPracticePlan(content: item, masteredRung: rung.index, gameTitle: "Fruit Slice")
            wordDriver.sayingAnswers = Array(repeating: .onDevice(spoken), count: 5)
            let wordModel = GuidedPracticeController(plan: wordPlan, isCurrent: { true }, apply: { wordEffects.append($0) },
                onReady: { _ in wordLaunches += 1 }, driver: wordDriver, provider: provider,
                automaticallyAdvance: false, nowMilliseconds: { wordNow })
            check(wordModel.presentation == .ready && wordDriver.permissionCalls == 0, "canonical advanced rung is enabled without starting input")
            wordModel.startAfterConsent(); await drain()
            for t in stride(from: 0.0, through: 300, by: 20) { wordNow = t; wordDriver.frames?(frame(t, voiced: false)) }
            await drain(); wordNow = 500; wordModel.advance(); await drain()
            wordNow = 750; wordModel.advance(); await drain()
            for index in 0..<5 {
                let start = 900 + Double(index) * 850
                for t in stride(from: start, through: start + 240, by: 20) { wordNow = t; wordDriver.frames?(frame(t, voiced: true)) }
                check(wordModel.reps == index, "a nominated saying is not credited before its own local word result")
                for t in stride(from: start + 260, through: start + 460, by: 20) { wordNow = t; wordDriver.frames?(frame(t, voiced: false)) }
                await drain()
                for t in stride(from: start + 480, through: start + 700, by: 20) { wordNow = t; wordDriver.frames?(frame(t, voiced: false)) }
                await drain()
            }
            check(wordDriver.finishCalls == 5 && wordModel.reps == 5 && wordDriver.recognitionStarts.allSatisfy { $0.isEmpty }, "five independent unbiased local word checks earn five advanced reps")
            wordNow += 400; wordModel.advance(); await drain(); wordNow += 200; wordModel.advance(); await drain()
            try await Task.sleep(nanoseconds: 2_000_000_000)
            let saved = wordEffects.compactMap { effect -> PracticeFlowMachine.VerifiedAttempt? in if case .saveVerifiedAttempt(let value) = effect { return value }; return nil }
            check(saved.count == 1 && saved.first?.result.reps == 5 && wordLaunches == 1, "advanced verified attempt saves once before one handoff")
            let stopsAfterHandoff = wordDriver.stopCalls
            let closesAfterHandoff = wordDriver.closeCalls
            await wordModel.close()
            check(wordDriver.stopCalls == stopsAfterHandoff && wordDriver.closeCalls == closesAfterHandoff,
                  "disappearing practice no longer touches the next game’s audio")
        }

        // A slow replay selected before interruption stays that same replay,
        // rather than silently returning at normal speed on the next tap.
        let replayDriver = GuidedTestDriver()
        var replayFlow = try PracticeFlowMachine(content: content, masteredRung: 0)
        _ = replayFlow.send(.start)
        let replayTurn = replayFlow.currentTurn!
        let replayProvider = GuidedTestProvider()
        let replayWrapper = GuidedPracticeAudioDriver(base: replayDriver, provider: replayProvider, plan: plan, turn: replayTurn, isCurrent: { true })
        replayWrapper.nextMode = .slow
        replayDriver.interruptWhenText = content.initialPrompt(includeFirstCue: false)
        do { try await replayWrapper.playPrompt(.init(text: replayTurn.prompt, parts: [])); fatalError("Expected interruption") } catch {}
        check(replayWrapper.nextMode == .slow, "selected slow replay survives canceled playback")
        try await replayWrapper.playPrompt(.init(text: replayTurn.prompt, parts: []))
        check(replayWrapper.nextMode == nil && replayProvider.modes == [.slow, .slow], "only completed playback consumes pending replay mode")

        var identity = true
        let staleDriver = GuidedTestDriver()
        let stale = GuidedPracticeController(plan: plan, isCurrent: { identity }, apply: { _ in fatalError("stale identity cannot save") }, onReady: { _ in fatalError("stale identity cannot launch") }, driver: staleDriver, provider: provider)
        identity = false; stale.startAfterConsent(); await drain()
        check(staleDriver.permissionCalls == 0 && staleDriver.opens == 0, "stale child/target cannot start")
        await stale.close()
        print("PASS: \(checks) Guided Practice adapter checks; actual synthetic PCM, zero live network/mic/audio")
    }
}
