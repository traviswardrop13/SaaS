// Deterministic adapter proof: no actual microphone, network, file recording or speech service.
import Foundation
import SonaSpeechCore

@MainActor private final class GateTestDriver: PracticeAudioDriver {
    var allowed = true
    var permissionCalls = 0
    var speechPermissionFollowups = 0
    var holdPermission = false
    var asking: CheckedContinuation<Bool, Never>?
    var live = false
    var opens = 0
    var recognitionStarts: [[String]] = []
    var prompts: [PracticePrompt] = []
    var answers: [PracticeRecognitionResult] = []
    var holdFinish = false
    var finishing: CheckedContinuation<PracticeRecognitionResult, Never>?
    var frames: (@MainActor (PracticeAcousticFrame) -> Void)?
    func setInterruptionHandler(_ handler: (@MainActor () -> Void)?) {}
    func requestPermissions() async -> Bool {
        permissionCalls += 1
        let result: Bool
        if holdPermission { result = await withCheckedContinuation { asking = $0 } }
        else { result = allowed }
        guard result, !Task.isCancelled else { return false }
        speechPermissionFollowups += 1
        return true
    }

    func playPrompt(_ prompt: PracticePrompt) async throws {
        precondition(!live, "A model can never play over the microphone")
        prompts.append(prompt)
    }
    func stopPlayback() {}
    func openMicrophone(onFrame: @escaping @MainActor (PracticeAcousticFrame) -> Void,
                        onInterruption: @escaping @MainActor () -> Void) async throws {
        opens += 1; live = true; frames = onFrame
    }
    func startRecognition(words: [String], maxMilliseconds: Double) async -> Bool {
        precondition(live && maxMilliseconds == 15_000)
        recognitionStarts.append(words); return true
    }
    func finishRecognition() async -> PracticeRecognitionResult {
        if holdFinish { return await withCheckedContinuation { finishing = $0 } }
        return answers.isEmpty ? .unavailable : answers.removeFirst()
    }
    func closeMicrophone() async -> String { live = false; frames = nil; return "" }
}
@MainActor private final class GateTestProvider: GameSpeechPromptProviding {
    var includesIntro: [Bool] = []
    var fails = false
    func prepare(plan: GameSpeechGatePlan, includeIntro: Bool) async throws -> [PracticePrompt] {
        includesIntro.append(includeIntro)
        if fails { throw GameSpeechNarration.Failure.unavailable }
        return [.init(text: "Say... " + plan.word + ".", parts: [], isMuted: true)]
    }
}
@MainActor private final class GateHarness {
    let driver = GateTestDriver()
    let provider = GateTestProvider()
    var now = 0.0
    var owner = true
    var credits: [GameSayingCredit] = []
    var earned = 0
    var failSave = false
    var returned = 0
    let optionalHelp: Bool
    let acousticCarry: GameSpeechAcousticCarry
    let count: Int
    lazy var model: GameSpeechGateController = makeModel()
    private func makeModel() -> GameSpeechGateController {
        let optionalReturn: (@MainActor () -> Void)?
        if optionalHelp { optionalReturn = { [unowned self] in precondition(!driver.live); returned += 1 } }
        else { optionalReturn = nil }
        return GameSpeechGateController(plan: .init(gameID: "robot", sound: "R", word: "rabbit", position: "i", sayTimes: count),
        isCurrent: { [unowned self] in owner }, creditPlayRep: { [unowned self] value in
            if failSave { throw GameSpeechNarration.Failure.unavailable }
            credits.append(value)
        }, onEarnedMove: { [unowned self] in precondition(!driver.live); earned += 1 },
        onOptionalReturn: optionalReturn, acousticCarry: acousticCarry,
        driver: driver, provider: provider, automaticallyAdvance: false, nowMilliseconds: { [unowned self] in now })
    }
    init(_ count: Int = 2, optionalHelp: Bool = false, acousticCarry: GameSpeechAcousticCarry? = nil) {
        self.count = count; self.optionalHelp = optionalHelp; self.acousticCarry = acousticCarry ?? GameSpeechAcousticCarry()
    }
    func start() async throws {
        model.startAfterConsent(); try await until { self.model.phase == .listening || self.model.phase == .retry }
    }
    func send(_ time: Double, loud: Bool = false, available: Bool = true) {
        now = time
        var shape = [UInt8](repeating: 0, count: 256)
        for i in [2, 4, 6] { shape[i] = 240 }
        driver.frames?(.init(timestampMilliseconds: time, sampleRate: 48_000,
            samples: [0.005, -0.005, 0.005, -0.005], spectrumDecibels: [-80, -80],
            energyRMS: loud ? 0.15 : 0.005, shapeSpectrumBytes: shape, isAvailable: available))
    }
    func room(_ start: Double) { for t in stride(from: start, through: start + 500, by: 20) { send(t) } }
    func word(_ start: Double) {
        for t in stride(from: start, through: start + 160, by: 20) { send(t, loud: true) }
        for t in stride(from: start + 180, through: start + 360, by: 20) { send(t) }
    }
    func gap(_ start: Double) async throws {
        send(start); send(start + 100); send(start + 200)
        try await until { self.model.phase == .listening }
    }
}

@MainActor private func drain() async { for _ in 0..<120 { await Task.yield() } }
@MainActor private func until(_ condition: @escaping () -> Bool) async throws {
    for _ in 0..<400 {
        if condition() { return }
        try await Task.sleep(nanoseconds: 5_000_000)
    }
    preconditionFailure("Expected native gate state did not arrive")
}
@main struct GameSpeechGateContract {
    @MainActor static var checks = 0
    @MainActor static func check(_ value: Bool, _ label: String) {
        checks += 1; precondition(value, "FAIL: " + label)
    }
    @MainActor static func main() async throws {
        let invalidDriver = GateTestDriver()
        let invalid = GameSpeechGateController(plan: nil, isCurrent: { true }, creditPlayRep: { _ in fatalError() }, onEarnedMove: { fatalError() }, driver: invalidDriver, provider: GateTestProvider())
        invalid.startAfterConsent(); await drain()
        check(invalid.phase == .unavailable && invalidDriver.permissionCalls == 0, "missing canonical plan stays closed")
        await invalid.close()
        let h = GateHarness(); h.driver.answers = [.onDevice("rabbit"), .onDevice("rabbit")]
        check(h.model.phase == .ready && h.driver.permissionCalls == 0 && h.provider.includesIntro.isEmpty, "boot has no permissions or narration")
        try await h.start(); h.room(0)
        check(h.driver.recognitionStarts == [[]] && h.credits.isEmpty && h.model.listeningReady, "on-device word check has no answer hints and quiet creates no credit")
        h.word(520); await drain()
        check(h.credits.count == 1 && h.model.sayings == 1 && h.model.phase == .gap && h.earned == 0 && h.driver.live, "one verified whole saying earns one play rep but no move")
        h.send(900); h.send(1_080); await drain()
        check(h.driver.recognitionStarts.count == 1, "next recognizer waits for fresh 200ms quiet")
        h.send(1_100); try await until { h.model.phase == .listening }
        check(h.driver.recognitionStarts == [[], []], "each saying has a fresh unbiased recognizer")
        h.word(1_120); await drain()
        check(h.credits.map(\.sequence) == [1, 2] && h.credits.allSatisfy { $0.position == "i" }, "credit IDs and source position survive adapter")
        check(h.earned == 1 && h.model.phase == .earned && !h.driver.live, "second saying earns move only after microphone closes")
        h.now = 50_000; h.model.advance(); await drain()
        check(h.earned == 1 && h.credits.count == 2, "clock and duplicate delivery cannot earn again")
        await h.model.close()

        let held = GateHarness(1); held.driver.answers = [.onDevice("rabbit")]
        try await held.start(); held.room(0)
        for t in stride(from: 520.0, through: 12_100, by: 20) { held.send(t, loud: true) }
        held.model.advance(); await drain()
        check(held.credits.isEmpty && held.model.phase == .retry && held.provider.includesIntro.count == 1, "held cap never passes and does not automatically model over a held voice")
        await held.model.close()

        let quiet = GateHarness(1); try await quiet.start(); quiet.room(0)
        quiet.now = 12_001; quiet.model.advance()
        try await until { quiet.provider.includesIntro.count == 2 && quiet.model.phase == .listening }
        quiet.now += 12_001; quiet.model.advance(); await drain()
        check(quiet.credits.isEmpty && quiet.model.phase == .retry && quiet.provider.includesIntro == [true, false], "quiet only repeats same word once, then waits; no progress")
        await quiet.model.close()

        let denied = GateHarness(); denied.driver.allowed = false
        try await denied.start()
        denied.model.setForeground(false); denied.model.setForeground(true); await drain()
        check(denied.driver.opens == 0 && denied.driver.permissionCalls == 1 && denied.credits.isEmpty, "denied mic and foreground cannot create a saying")
        await denied.model.close()

        for replacedOwner in [false, true] {
            let stale = GateHarness(1); stale.driver.holdFinish = true
            try await stale.start(); stale.room(0); stale.word(520); await drain()
            check(stale.driver.finishing != nil && stale.credits.isEmpty, "pending transcript cannot be pre-credited")
            if replacedOwner { stale.owner = false; stale.model.advance() } else { stale.model.pause() }
            stale.driver.finishing?.resume(returning: .onDevice("rabbit")); stale.driver.finishing = nil
            await drain()
            check(stale.credits.isEmpty && stale.earned == 0 && !stale.driver.live, "late final after pause/owner change cannot credit")
            await stale.model.close()
        }

        let unavailable = GateHarness(1); unavailable.driver.answers = [.unavailable, .onDevice("banana")]
        try await unavailable.start(); unavailable.room(0); unavailable.word(520)
        try await until { unavailable.model.phase == .listening && unavailable.provider.includesIntro.count == 2 }
        unavailable.room(1_000); unavailable.word(1_520); await drain()
        check(unavailable.model.phase == .retry && unavailable.credits.isEmpty && unavailable.earned == 0, "unavailable and unrelated native words never use acoustic fallback")
        await unavailable.model.close()

        let partial = GateHarness(2); partial.driver.answers = [.onDevice("rabbit"), .onDevice("rabbit")]
        try await partial.start(); partial.room(0); partial.word(520); await drain()
        partial.model.pause(); await drain(); partial.model.setForeground(false); partial.model.setForeground(true); await drain()
        check(partial.model.sayings == 1 && partial.driver.recognitionStarts.count == 1, "pause preserves accepted saying and foreground stays silent")
        try await partial.start(); partial.room(1_000); partial.word(1_520); await drain()
        check(partial.credits.count == 2 && partial.earned == 1, "explicit resume keeps partial count without spending another word")
        await partial.model.close()

        let latePermission = GateHarness(); latePermission.driver.holdPermission = true
        latePermission.model.startAfterConsent(); await drain()
        check(latePermission.driver.asking != nil, "system permission can remain pending")
        latePermission.model.pause(); latePermission.model.startAfterConsent(); await drain()
        check(latePermission.driver.permissionCalls == 1 && latePermission.driver.opens == 0, "replacement turn waits for pending permission cleanup")
        latePermission.driver.holdPermission = false
        latePermission.driver.asking?.resume(returning: true); latePermission.driver.asking = nil
        try await until { latePermission.model.phase == .listening }
        check(latePermission.driver.live && latePermission.credits.isEmpty && latePermission.driver.speechPermissionFollowups == 1, "late old permission cannot close or credit the replacement capture")
        await latePermission.model.close()

        let failedModel = GateHarness(); failedModel.provider.fails = true
        try await failedModel.start()
        check(failedModel.driver.opens == 0 && failedModel.credits.isEmpty, "failed model cannot silently open mic")
        await failedModel.model.close()
        let quietHelp = GateHarness(optionalHelp: true); try await quietHelp.start(); quietHelp.room(0)
        quietHelp.now = 12_001; quietHelp.model.advance(); await drain()
        check(quietHelp.returned == 1 && quietHelp.earned == 0 && quietHelp.credits.isEmpty && quietHelp.provider.includesIntro.count == 1, "optional help quiet returns earned move without power, credit or automatic model")
        await quietHelp.model.close()
        let partialHelp = GateHarness(optionalHelp: true); partialHelp.driver.answers = [.onDevice("rabbit")]
        try await partialHelp.start(); partialHelp.room(0); partialHelp.word(520); await drain()
        partialHelp.now = 13_000; partialHelp.model.advance(); await drain()
        check(partialHelp.returned == 1 && partialHelp.earned == 0 && partialHelp.credits.count == 1, "accepted partial help saying remains a play rep but grants no power or next move")
        await partialHelp.model.close()
        for cancelWithPause in [false, true] {
            let help = GateHarness(1, optionalHelp: true); help.driver.holdFinish = true
            try await help.start(); help.room(0); help.word(520); await drain()
            if cancelWithPause { help.model.pause() } else { help.model.returnToMove() }
            help.driver.finishing?.resume(returning: .onDevice("rabbit")); help.driver.finishing = nil
            await drain()
            check(help.returned == 1 && help.earned == 0 && help.credits.isEmpty && !help.driver.live, "optional Back/Pause closes pending recognition and returns no power once")
            help.model.returnToMove(); await drain(); check(help.returned == 1, "repeated return cannot fire board callback twice")
            await help.model.close()
        }
        let earnedHelp = GateHarness(optionalHelp: true); earnedHelp.driver.answers = [.onDevice("rabbit"), .onDevice("rabbit")]
        try await earnedHelp.start(); earnedHelp.room(0); earnedHelp.word(520); await drain()
        try await earnedHelp.gap(1_000); earnedHelp.word(1_220); await drain()
        check(earnedHelp.earned == 1 && earnedHelp.returned == 0 && earnedHelp.credits.count == 2 && !earnedHelp.driver.live, "optional full same-word count grants its board callback only after cleanup")
        await earnedHelp.model.close()
        let failedHelp = GateHarness(optionalHelp: true); failedHelp.provider.fails = true
        failedHelp.model.startAfterConsent(); try await until { failedHelp.returned == 1 }
        check(failedHelp.earned == 0 && failedHelp.credits.isEmpty && failedHelp.driver.opens == 0, "help audio error returns existing move without a power or mic")
        await failedHelp.model.close()
        let sharedFloor = GameSpeechAcousticCarry()
        let ordinary = GateHarness(1, acousticCarry: sharedFloor); ordinary.driver.answers = [.onDevice("rabbit")]
        try await ordinary.start(); ordinary.room(0); ordinary.word(520); await drain()
        check(sharedFloor.roomFloor == 0.005 && ordinary.earned == 1, "round retains original aggregate floor after an earned move")
        await ordinary.model.close()
        let carriedHelp = GateHarness(1, optionalHelp: true, acousticCarry: sharedFloor)
        carriedHelp.driver.answers = [.onDevice("rabbit")]
        try await carriedHelp.start(); carriedHelp.word(2_000); await drain()
        check(carriedHelp.earned == 1 && carriedHelp.credits.count == 1 && carriedHelp.model.sayings == 1, "same-round help uses known floor but owns a fresh saying count")
        await carriedHelp.model.close()
        let closingPermission = GateHarness(); closingPermission.driver.holdPermission = true
        closingPermission.model.startAfterConsent(); await drain()
        let closePermissionJob = Task { await closingPermission.model.close() }; await drain()
        closingPermission.driver.asking?.resume(returning: true); closingPermission.driver.asking = nil
        await closePermissionJob.value
        check(closingPermission.driver.speechPermissionFollowups == 0 && closingPermission.driver.opens == 0, "close cancels permission child before late grant can ask for Speech")
        print("PASS: \(checks) native SayPlay gate lifecycle checks")
    }
}
