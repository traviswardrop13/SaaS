// Fictional speech evidence only. No device microphone, saved audio or network.
import Foundation
import SonaSpeechCore

@MainActor private final class PowerDriver: PracticeAudioDriver {
    var accepted = true, recognizes = true, live = false
    var transcript = "", events: [String] = [], recognitionHints: [[String]] = []
    var frame: (@MainActor (PracticeAcousticFrame) -> Void)?
    var blockedPermission: CheckedContinuation<Bool, Never>?
    var waitForPermission = false

    func setInterruptionHandler(_ handler: (@MainActor () -> Void)?) {}
    func requestPermissions() async -> Bool {
        events.append("permission")
        let allowed = waitForPermission ? await withCheckedContinuation { blockedPermission = $0 } : accepted
        return allowed && !Task.isCancelled
    }
    func playPrompt(_ prompt: PracticePrompt) async throws {
        precondition(!live)
        events.append(prompt.text)
    }
    func stopPlayback() { events.append("stop") }
    func openMicrophone(onFrame: @escaping @MainActor (PracticeAcousticFrame) -> Void,
                        onInterruption: @escaping @MainActor () -> Void) async throws {
        live = true; frame = onFrame; events.append("open")
    }
    func startRecognition(words: [String], maxMilliseconds: Double) async -> Bool {
        precondition(maxMilliseconds == 8_000)
        recognitionHints.append(words)
        return recognizes
    }
    func closeMicrophone() async -> String {
        live = false; frame = nil; events.append("close")
        return transcript
    }
}

@MainActor private final class PowerProvider: NativeArcadePowerPromptProviding {
    func lead(_ text: String, selection: NativeArcadeCheckpointSelection) async -> PracticePrompt? {
        .init(text: text, encodedAudio: Data([0, 1]))
    }
    func bareTake(selection: NativeArcadeCheckpointSelection) -> PracticePrompt? {
        .init(text: selection.bare.text, encodedAudio: Data([0, 1]))
    }
    func handoff(selection: NativeArcadeCheckpointSelection) async -> PracticePrompt? {
        .init(text: selection.goText, encodedAudio: Data([0, 1]))
    }
}

@MainActor private final class PowerFixture {
    let driver = PowerDriver(), provider = PowerProvider()
    var now = 0.0, current = true
    var credits: [GameSayingCredit] = [], waits: [Double] = []
    lazy var controller = NativeArcadePowerController(isCurrent: { [unowned self] in current }, credit: { [unowned self] value in
        precondition(!driver.live)
        precondition(waits.last == 200, "The input route must settle before recording a play rep")
        credits.append(value)
    }, driver: driver, provider: provider, automaticallyTimeOut: false, nowMilliseconds: { [unowned self] in now },
       wait: { [unowned self] duration in waits.append(duration); try Task.checkCancellation() })

    init(game: String = "slice", voiceOn: Bool = true) {
        let ask = NativeArcadeCheckpointSelection.Ask(rung: 0, level: "isolation", text: "rrrr", position: "",
            markedHTML: "rrrr", clip: "/coach/say-echo/R-sound.wav", modelText: "", title: "Say “rrrr” for a new life!")
        controller.install(.init(gameID: game, sound: "R", family: "low", voiceID: "", card: 0,
            voiceOn: voiceOn, humanClipsEnabled: true, volume: voiceOn ? 0.8 : 0,
            intro: "For a new life, say", stepBackLine: "I have an idea. Let's try this one.", goText: "Go!", desired: ask, bare: ask,
            modelWaitMilliseconds: 3_000, voiceTailMilliseconds: 250, bareLineWaitMilliseconds: 2_500, takeStartMilliseconds: 3_000))
        controller.poll(playing: true)
    }

    func play(_ milliseconds: Int, remaining: Double? = nil, eligible: Bool = true) {
        for _ in 0..<(milliseconds / 200) {
            now += 200
            controller.poll(playing: true, eligible: eligible, legMillisecondsLeft: remaining)
        }
    }
    func emit(_ count: Int, level: Double) {
        for _ in 0..<count {
            now += 20
            driver.frame?(.init(timestampMilliseconds: now, sampleRate: 48_000,
                samples: (0..<512).map { $0.isMultiple(of: 2) ? 0.01 : -0.01 },
                spectrumDecibels: Array(repeating: -100, count: 256), energyRMS: level))
        }
    }
    func lapse() async {
        now += 8_000
        controller.poll(playing: true)
        await until { !controller.isAsking }
    }
    func start() async {
        controller.tap()
        await until { controller.phase == .listening }
    }
}

@MainActor private func until(_ predicate: () -> Bool) async {
    for _ in 0..<400 {
        if predicate() { return }
        try? await Task.sleep(nanoseconds: 2_000_000)
    }
}

@main struct NativeArcadePowerContract {
    @MainActor static func main() async {
        var failures = 0, checks = 0
        func expect(_ success: Bool, _ line: String) {
            checks += 1
            if !success { failures += 1 }
            print("\(success ? "PASS" : "FAIL") \(line)")
        }

        let cadence = PowerFixture()
        cadence.play(10_000, eligible: false)
        cadence.play(5_800)
        expect(!cadence.controller.isAsking, "first timer counts only eligible play")
        cadence.play(200)
        expect(cadence.controller.isAsking, "automatic ask starts at six seconds")
        await until { cadence.controller.phase == .listening }
        expect(cadence.driver.events == ["permission", "Super Slice! Say", "rrrr", "Go!", "open"],
               "order is exact reason, human bare take, Go, quiet tail, mic")
        expect(cadence.waits.contains(250) && cadence.driver.recognitionHints == [["rrrr"]],
               "voice tail and original contextual isolation hint")
        expect(!cadence.controller.willPlayGameAudio(duration: 0.55), "piano and game effects stay silent while input owns audio")
        cadence.emit(15, level: 0.01)
        await cadence.lapse()
        expect(cadence.credits.isEmpty && cadence.controller.powerRemaining == 0, "silence is never a rep or a power")
        cadence.play(19_800)
        expect(!cadence.controller.isAsking, "first quiet ask waits twenty seconds")
        cadence.play(200)
        await until { cadence.controller.phase == .listening }
        expect(cadence.driver.events.filter { $0 == "Super Slice! Say" }.count == 1,
               "explanatory line plays to completion once per visit")
        await cadence.lapse()
        cadence.play(39_800)
        expect(!cadence.controller.isAsking, "two silent asks increase the wait to forty seconds")
        cadence.play(200)
        expect(cadence.controller.isAsking, "the next ask starts on the longer beat")
        await cadence.controller.interrupt()

        let nearFinish = PowerFixture()
        nearFinish.play(6_000, remaining: 6_999)
        expect(!nearFinish.controller.isAsking, "first automatic model needs seven seconds remaining")
        nearFinish.controller.stageChanged()
        nearFinish.controller.poll(playing: true)
        nearFinish.play(19_800)
        expect(!nearFinish.controller.isAsking, "new stage resets an ask held for a checkpoint to twenty seconds")
        nearFinish.play(200, remaining: 100)
        expect(!nearFinish.controller.isAsking, "a short stage defers a due automatic ask")
        await nearFinish.start()
        expect(nearFinish.controller.phase == .listening, "Echo's button bypasses only the end-of-stage guard")
        await nearFinish.controller.interrupt()
        expect(!nearFinish.driver.live && !nearFinish.controller.suppressesGameAudio,
               "checkpoint handoff waits for optional audio cleanup")

        let heard = PowerFixture()
        heard.driver.recognizes = false
        expect(heard.controller.willPlayGameAudio(duration: 0.55), "ordinary board sound passes when no turn owns audio")
        await heard.start()
        expect(heard.waits.first == 550, "the model waits for a prior note to finish")
        heard.emit(31, level: 0.01)
        heard.emit(6, level: 0.2)
        expect(heard.credits.isEmpty, "the six-frame onset leaves 550ms for the local recognizer")
        heard.emit(27, level: 0.2)
        expect(heard.credits.isEmpty, "a held sound cannot finish before the recognition tail")
        heard.emit(1, level: 0.2)
        await until { heard.controller.powerRevision == 1 }
        expect(heard.credits.count == 1 && heard.credits.first?.sequence == 1 && heard.credits.first?.word == "rrrr",
               "voiced isolation fallback credits exactly one canonical play saying")
        expect(heard.controller.powerRemaining == 10_000 && heard.controller.speedFactor == 0.55,
               "Super Slice grants ten seconds at fifty-five percent speed")
        heard.controller.poll(playing: false)
        heard.now += 60_000
        heard.controller.poll(playing: false)
        expect(heard.controller.powerRemaining == 10_000 && heard.controller.willPlayGameAudio(duration: 0),
               "hidden and break time freeze earned power and do not keep the speaker muted")
        heard.controller.poll(playing: true)
        heard.play(10_000)
        expect(heard.controller.powerRemaining == 0 && heard.controller.speedFactor == 1, "ten active seconds restore normal motion")

        let late = PowerFixture(game: "tiles", voiceOn: false)
        late.driver.recognizes = false
        await late.start()
        late.emit(31, level: 0.01)
        late.now = 7_850
        late.emit(6, level: 0.2)
        late.now = 8_001
        late.controller.poll(playing: true)
        await until { !late.controller.isAsking }
        expect(late.credits.count == 1 && late.controller.powerRemaining == 8_000,
               "the eight-second limit honors the real burst heard just before it")
        expect(late.driver.events == ["permission", "open", "close"], "muted voice opens input without spoken prompt or Go")
        late.controller.stageChanged()
        expect(late.controller.powerRemaining == 0, "Piano resets slow keys on entering another song")

        let unrelated = PowerFixture(game: "glide")
        unrelated.driver.transcript = "taco"
        await unrelated.start()
        unrelated.emit(31, level: 0.01)
        unrelated.emit(40, level: 0.2)
        await until { !unrelated.controller.isAsking }
        expect(unrelated.credits.isEmpty && unrelated.controller.powerRemaining == 0,
               "a clear unrelated local transcript vetoes the acoustic nomination")

        let denied = PowerFixture(game: "rise")
        denied.driver.accepted = false
        denied.controller.tap()
        await until { !denied.controller.isAsking }
        denied.play(60_000)
        expect(denied.driver.events == ["permission"] && !denied.controller.canTap,
               "refused mic leaves motor play active and stops asks for that visit")
        let departing = PowerFixture(game: "run")
        departing.driver.waitForPermission = true
        departing.controller.tap()
        await until { departing.driver.blockedPermission != nil }
        departing.current = false
        departing.controller.poll(playing: false)
        expect(departing.controller.suppressesGameAudio, "permission cancellation keeps old audio owner fenced")
        departing.driver.blockedPermission?.resume(returning: true)
        await departing.controller.interrupt()
        expect(departing.credits.isEmpty && departing.driver.events == ["permission"] && !departing.controller.isAsking,
               "late permission cannot open the old mic or grant a different child's power")

        print("Live Arcade power contract: \(checks - failures)/\(checks) checks passed")
        if failures > 0 { exit(1) }
    }
}
