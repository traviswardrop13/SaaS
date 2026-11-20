// Synthetic driver evidence only: no real microphone, network or audio files.
import Foundation
import SonaSpeechCore

@MainActor private final class CheckpointDriver: PracticeAudioDriver {
    var allowed = true, available = true, live = false, holdPermission = false, holdFinish = false
    var asking: CheckedContinuation<Bool, Never>?
    var finishing: CheckedContinuation<PracticeRecognitionResult, Never>?
    var result: PracticeRecognitionResult = .unavailable
    var starts: [[String]] = [], prompts: [String] = []
    var opens = 0, closes = 0, stops = 0, lateSpeechPrompts = 0
    var failText: String?
    var frames: (@MainActor (PracticeAcousticFrame) -> Void)?
    func setInterruptionHandler(_ handler: (@MainActor () -> Void)?) {}
    func requestPermissions() async -> Bool {
        let answer = holdPermission ? await withCheckedContinuation { asking = $0 } : allowed
        guard answer, !Task.isCancelled else { return false }
        lateSpeechPrompts += 1; return true
    }
    func playPrompt(_ prompt: PracticePrompt) async throws {
        precondition(!live, "No model may overlap input")
        prompts.append(prompt.text)
        if prompt.text == failText { throw TestFailure.playback }
    }
    func stopPlayback() { stops += 1 }
    func openMicrophone(onFrame: @escaping @MainActor (PracticeAcousticFrame) -> Void,
                        onInterruption: @escaping @MainActor () -> Void) async throws {
        live = true; opens += 1; frames = onFrame
    }
    func startRecognition(words: [String], maxMilliseconds: Double) async -> Bool {
        precondition(maxMilliseconds == 15_000); starts.append(words); return available
    }
    func finishRecognition() async -> PracticeRecognitionResult {
        if holdFinish { return await withCheckedContinuation { finishing = $0 } }
        return result
    }
    func closeMicrophone() async -> String {
        closes += 1; live = false; frames = nil; return ""
    }
}
private enum TestFailure: Error { case playback, save }
@MainActor private final class CheckpointProvider: NativeArcadeCheckpointPromptProviding {
    var harderAvailable = true, systemHarder = false
    var leads: [(Bool, Bool)] = []
    func harderModel(selection: NativeArcadeCheckpointSelection,
                     ask: NativeArcadeCheckpointSelection.Ask) async -> PracticePrompt? {
        guard harderAvailable else { return nil }
        if systemHarder { return .init(text: ask.modelText, systemSpeech: .init(text: ask.modelText)) }
        return .init(text: ask.modelText, encodedAudio: Data([1, 2]))
    }
    func bareModels(selection: NativeArcadeCheckpointSelection, idea: Bool,
                    includeLead: Bool) async -> [PracticePrompt] {
        leads.append((idea, includeLead))
        guard selection.voiceOn && selection.volume > 0 else { return [] }
        var result: [PracticePrompt] = []
        if includeLead { result.append(.init(text: idea ? selection.stepBackLine : selection.intro, encodedAudio: Data([1,2]))) }
        if selection.humanClipsEnabled { result.append(.init(text: selection.bare.text, encodedAudio: Data([1,2]))) }
        return result
    }
    func handoff(selection: NativeArcadeCheckpointSelection) async -> PracticePrompt? { nil }
}
@MainActor private final class CheckpointHarness {
    let driver = CheckpointDriver(), provider = CheckpointProvider(), carry = NativeArcadeCheckpointCarry()
    var now = 0.0, owner = true, earned = 0, ended = 0, failSave = false
    var credits: [GameSayingCredit] = []
    var held: [NativeArcadeCheckpointSelection.Ask] = []
    let selection: NativeArcadeCheckpointSelection
    var incoming: NativeArcadeCheckpointSelection.Ask?
    lazy var model: NativeArcadeCheckpointController = make()
    init(rung: Int = 0, card: Int = 1, voiceOn: Bool = true) { selection = Self.selection(rung: rung, card: card, voiceOn: voiceOn) }
    func make() -> NativeArcadeCheckpointController {
        NativeArcadeCheckpointController(id: UUID(), selection: selection,
            isCurrent: { [unowned self] in owner }, credit: { [unowned self] value in
                precondition(!driver.live, "Input must close before writing")
                if failSave { throw TestFailure.save }
                if !credits.contains(value) { credits.append(value) }
            }, onEarned: { [unowned self] in precondition(!driver.live); earned += 1 },
            onEnd: { [unowned self] in precondition(!driver.live); ended += 1 }, carry: carry,
            onStepBack: { [unowned self] in held.append($0) }, heldAsk: incoming,
            driver: driver, provider: provider, automaticallyAdvance: false,
            nowMilliseconds: { [unowned self] in now })
    }
    static func selection(rung: Int, card: Int, voiceOn: Bool) -> NativeArcadeCheckpointSelection {
        let bare = NativeArcadeCheckpointSelection.Ask(rung: 0, level: "isolation", text: "rrrr", position: "", markedHTML: "<b class=\"snd\">rrrr</b>", clip: "/coach/say-echo/R-sound.wav", modelText: "", title: card == 0 ? "Say “rrrr” for a new life!" : "Say “rrrr” for wave 2!")
        let text = rung == 1 ? "ree" : "rabbit"
        let desired = rung == 0 || card == 0 ? bare : .init(rung: rung, level: rung == 1 ? "syllable" : "word", text: text, position: "i", markedHTML: "<b class=\"snd\">r</b>" + String(text.dropFirst()), clip: "", modelText: "To keep playing, say... " + text + ".", title: "Say “" + text + "” for wave 2!")
        return .init(gameID: "slice", sound: "R", family: "low", voiceID: "", card: card,
            voiceOn: voiceOn, humanClipsEnabled: true, volume: 0.8,
            intro: card == 0 ? "For a new life, say" : "To keep playing, say",
            stepBackLine: "I have an idea. Let's try this one.", goText: "Go!", desired: desired, bare: bare,
            modelWaitMilliseconds: 3_000, voiceTailMilliseconds: 1, bareLineWaitMilliseconds: 2_500, takeStartMilliseconds: 3_000)
    }
    func start() async { model.startAfterConsent(); await until { model.phase == .listening || model.phase == .closed } }
    func emit(time: Double, level: Double, available: Bool = true) {
        now = time; driver.frames?(frame(time, level, available: available))
    }
    func saying() async {
        for i in 0...30 { emit(time: Double(i) * 20, level: 0.01) }
        for i in 31...45 { emit(time: Double(i) * 20, level: 0.2) }
        for i in 46...95 { emit(time: Double(i) * 20, level: 0.01) }
        await settle()
    }
}
private func frame(_ time: Double, _ level: Double, available: Bool = true) -> PracticeAcousticFrame {
    .init(timestampMilliseconds: time, sampleRate: 48_000,
          samples: (0..<512).map { $0.isMultiple(of: 2) ? 0.01 : -0.01 },
          spectrumDecibels: Array(repeating: -100, count: 256), energyRMS: level, isAvailable: available)
}
@MainActor private func settle() async { try? await Task.sleep(nanoseconds: 15_000_000) }
@MainActor private func until(_ predicate: () -> Bool) async {
    for _ in 0..<500 { if predicate() { return }; try? await Task.sleep(nanoseconds: 2_000_000) }
}
@main struct NativeArcadeCheckpointContract {
    @MainActor static func main() async {
        var failures = 0, checks = 0
        func check(_ pass: Bool, _ name: String) { checks += 1; print("\(pass ? "PASS" : "FAIL") \(name)"); if !pass { failures += 1 } }
        let bare = CheckpointHarness()
        await bare.start()
        check(bare.model.phase == .listening && bare.driver.starts == [[]], "native starts with no answer hints")
        for i in 0...500 { bare.emit(time: Double(i) * 20, level: 0.01) }
        bare.now = 30_000; bare.model.advance(); await settle()
        check(bare.earned == 0 && bare.credits.isEmpty && bare.model.phase == .listening, "silence and bare timeout never advance")
        await bare.model.close()

        let voiced = CheckpointHarness()
        voiced.driver.available = false
        await voiced.start(); await voiced.saying(); await until { voiced.earned == 1 }
        check(voiced.earned == 1 && voiced.credits.count == 1, "voiced bare may retain original unavailable-transcript fallback")
        check(voiced.credits.first?.sequence == 1 && voiced.credits.first?.word == "rrrr", "one checkpoint earns exactly one game credit")
        let stops = voiced.driver.stops, closes = voiced.driver.closes
        await voiced.model.close(); await voiced.model.close()
        check(voiced.driver.stops == stops && voiced.driver.closes == closes, "late disappearance cannot touch next audio owner")

        let word = CheckpointHarness(rung: 2)
        word.driver.result = .onDevice("rabbit")
        await word.start()
        check(word.model.ask == word.selection.desired && word.provider.leads.isEmpty, "real prepared model enables exact harder ask only")
        await word.saying(); await until { word.earned == 1 }
        check(word.earned == 1 && word.credits.first?.word == "rabbit", "native harder word requires local matching transcript")
        await word.model.close()

        let unavailable = CheckpointHarness(rung: 2)
        unavailable.driver.available = false
        await unavailable.start(); await unavailable.saying(); await until { unavailable.model.phase == .listening && unavailable.model.ask.rung == 0 }
        check(unavailable.earned == 0 && unavailable.credits.isEmpty && unavailable.held == [unavailable.selection.desired], "unavailable harder word steps back with no rep and retains same ask")
        check(unavailable.provider.leads.last?.0 == true && unavailable.provider.leads.last?.1 == true, "clinical step-back uses only original idea line")
        await unavailable.model.close()

        let missing = CheckpointHarness(rung: 1)
        missing.provider.harderAvailable = false
        await missing.start()
        check(missing.model.ask.rung == 0 && missing.provider.leads.first?.1 == false && missing.held.isEmpty, "missing harder bytes use take without intro or held-demotion")
        await missing.model.close()
        let fabricated = CheckpointHarness(rung: 1)
        fabricated.provider.systemHarder = true
        await fabricated.start()
        check(fabricated.model.ask.rung == 0, "installed speech never stands in for harder real-byte model")
        await fabricated.model.close()
        let refused = CheckpointHarness(rung: 1)
        refused.driver.failText = refused.selection.desired.modelText
        await refused.start()
        check(refused.model.ask.rung == 0 && refused.provider.leads.first?.1 == false && refused.held.isEmpty, "failed harder playback returns bare with no extra intro")
        await refused.model.close()

        let timeout = CheckpointHarness(rung: 1)
        await timeout.start()
        for i in 0...30 { timeout.emit(time: Double(i) * 20, level: 0.01) }
        timeout.now = 8_449; timeout.model.advance(); await settle()
        check(timeout.model.ask.rung == 1, "harder timeout starts only after actual floor-ready time")
        timeout.now = 8_461; timeout.model.advance(); await until { timeout.model.phase == .listening }
        check(timeout.model.ask.rung == 0 && timeout.held == [timeout.selection.desired] && timeout.credits.isEmpty, "eight-second unanswered harder card steps down without reward")
        await timeout.model.close()

        let lateWord = CheckpointHarness(rung: 2)
        lateWord.driver.holdFinish = true
        await lateWord.start(); await lateWord.saying(); await until { lateWord.driver.finishing != nil }
        lateWord.now = 8_461; lateWord.model.advance(); await settle()
        lateWord.driver.finishing?.resume(returning: .onDevice("rabbit")); await settle()
        check(lateWord.earned == 0 && lateWord.credits.isEmpty && lateWord.held == [lateWord.selection.desired], "eight-second watch cancels even a word still finalizing")
        await lateWord.model.close()

        let paused = CheckpointHarness()
        await paused.start(); paused.model.pause(); await settle()
        check(paused.model.phase == .paused && !paused.driver.live, "pause closes actual input")
        let opens = paused.driver.opens
        paused.model.setForeground(false); paused.model.setForeground(true); await settle()
        check(paused.driver.opens == opens && paused.credits.isEmpty, "foreground cannot reopen or earn")
        paused.model.startAfterConsent(); await until { paused.model.phase == .listening }
        check(paused.driver.opens == opens + 1, "explicit resume can listen again")
        paused.model.endPlaying(); await until { paused.ended == 1 }
        check(paused.ended == 1 && paused.earned == 0 && !paused.driver.live, "Done ends the round and never awards a segment")

        let permission = CheckpointHarness()
        permission.driver.holdPermission = true; permission.model.startAfterConsent()
        await until { permission.driver.asking != nil }
        permission.model.pause(); permission.driver.asking?.resume(returning: true); await settle()
        check(permission.driver.lateSpeechPrompts == 0 && permission.driver.opens == 0, "late permission grant after Pause opens no Speech prompt or input")
        await permission.model.close()

        let stale = CheckpointHarness()
        stale.driver.holdFinish = true
        await stale.start(); await stale.saying(); await until { stale.driver.finishing != nil }
        stale.owner = false; stale.driver.finishing?.resume(returning: .onDevice("rrrr")); await settle()
        check(stale.credits.isEmpty && stale.earned == 0 && !stale.driver.live, "identity change during final recognition discards stale credit")
        await stale.model.close()

        let denied = CheckpointHarness(); denied.driver.allowed = false
        await denied.start(); await until { denied.ended == 1 }
        check(denied.ended == 1 && denied.driver.opens == 0 && denied.credits.isEmpty, "permission denial ends kindly without progressing")

        let save = CheckpointHarness(); save.failSave = true
        await save.start(); await save.saying(); await until { save.model.phase == .retry }
        check(save.earned == 0 && save.credits.isEmpty, "failed canonical save cannot grant a stage")
        save.failSave = false; save.model.startAfterConsent(); await until { save.earned == 1 }
        check(save.credits.count == 1 && save.driver.opens == 1, "same pending credit retries without another saying or duplicate")
        await save.model.close()

        let life = CheckpointHarness(card: 0); life.incoming = word.selection.desired
        await life.start()
        check(life.model.ask.rung == 0 && life.provider.leads.first?.1 == true && life.driver.prompts.first == "For a new life, say", "new-life card ignores held harder target and keeps authored life lead")
        await life.model.close()
        print("Checkpoint controller: \(checks-failures)/\(checks) checks passed")
        if failures > 0 { exit(1) }
    }
}
