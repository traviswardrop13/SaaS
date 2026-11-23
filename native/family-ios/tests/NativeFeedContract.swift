import Foundation
import SonaSpeechCore

@MainActor private final class FeedDriver: PracticeAudioDriver {
    var permissions = 0, speechPermissionChecks = 0, opens = 0, closes = 0
    var live = false, allowed = true, recognitionAvailable = true
    var holdPermission = false, holdRecognition = false, holdClose = false
    var asking: CheckedContinuation<Bool, Never>?
    var recognizing: CheckedContinuation<PracticeRecognitionResult, Never>?
    var closing: CheckedContinuation<Void, Never>?
    var answers: [PracticeRecognitionResult] = []
    var playingConcert: CheckedContinuation<Void, Error>?
    var stoppedConcerts = 0
    var prompts: [String] = [], recognitionHints: [[String]] = []
    var frames: (@MainActor (PracticeAcousticFrame) -> Void)?
    func setInterruptionHandler(_ handler: (@MainActor () -> Void)?) {}
    func requestPermissions() async -> Bool {
        permissions += 1
        let granted: Bool
        if holdPermission { granted = await withCheckedContinuation { asking = $0 } }
        else { granted = allowed }
        if granted && !Task.isCancelled { speechPermissionChecks += 1 }
        return granted && !Task.isCancelled
    }
    func playPrompt(_ prompt: PracticePrompt) async throws {
        precondition(!live, "Feed cannot model over its mic")
        prompts.append(prompt.text)
        if prompt.text == "feed-concert" {
            try await withCheckedThrowingContinuation { playingConcert = $0 }
        }
    }
    func stopPlayback() {
        if let playingConcert {
            self.playingConcert = nil
            stoppedConcerts += 1
            playingConcert.resume(throwing: CancellationError())
        }
    }
    func openMicrophone(onFrame: @escaping @MainActor (PracticeAcousticFrame) -> Void,
                        onInterruption: @escaping @MainActor () -> Void) async throws {
        opens += 1; live = true; frames = onFrame
    }
    func startRecognition(words: [String], maxMilliseconds: Double) async -> Bool {
        precondition(live && maxMilliseconds == 15_000)
        recognitionHints.append(words); return recognitionAvailable
    }
    func finishRecognition() async -> PracticeRecognitionResult {
        if holdRecognition { return await withCheckedContinuation { recognizing = $0 } }
        return answers.isEmpty ? .unavailable : answers.removeFirst()
    }
    func closeMicrophone() async -> String {
        closes += 1
        if holdClose { await withCheckedContinuation { closing = $0 } }
        live = false; frames = nil; return ""
    }
}

@MainActor private final class FeedProvider: NativeFeedPromptProviding {
    var repeats: [Bool] = []
    func ask(selection: NativeFeedSelection, turn: NativeFeedSelection.Turn, repeatAsk: Bool) async throws -> PracticePrompt? {
        repeats.append(repeatAsk)
        return .init(text: repeatAsk ? turn.repeatAsk : turn.ask, parts: [], isMuted: true)
    }
    func go(selection: NativeFeedSelection) async -> PracticePrompt? { .init(text: "Go!", parts: [], isMuted: true) }
}

private func feedSelection(micReady: Bool = true, soundOn: Bool = false) -> NativeFeedSelection {
    let target = NativeFeedSelection.Word(word: "rabbit", emoji: "🐰", position: "i")
    let wrong = NativeFeedSelection.Word(word: "sun", emoji: "☀️", position: "i")
    let turn = NativeFeedSelection.Turn(target: target, choices: [target, wrong],
        ask: "Where is the rabbit? Say... rabbit.", repeatAsk: "Say... rabbit.", markedWord: "<b class=\"snd\">r</b>abbit")
    return .init(title: "Feed Echo", sound: "R", soundLabel: "R", family: "low", voice: "echo",
        voiceOn: true, soundOn: soundOn, micReady: micReady, volume: 0.8,
        microphonePromise: "audio is never uploaded or saved.", lifetimeFed: 12,
        turns: Array(repeating: turn, count: 5), policy: .init(floorMilliseconds: 250,
            historyMilliseconds: 3_000, listenMilliseconds: 8_000, minimumRMS: 0.035,
            roomMultiplier: 3, voicedFrames: 4, quietMilliseconds: 200,
            settleMilliseconds: 200, soundQuietMilliseconds: 900, voiceTailMilliseconds: 250,
            roomPercentile: 0.2, lowMaximumCentroid: 1_800, lowMaximumHighFraction: 0.22,
            hissMinimumCentroid: 1_100, hissMinimumHighFraction: 0.10))
}

@MainActor private final class FeedHarness {
    let driver = FeedDriver(), provider = FeedProvider()
    var now = 0.0, owner = true
    var credits: [GameSayingCredit] = [], moves: [UUID] = [], finishes = 0, exits = 0
    var failCredit = false, failMove = false
    var holdCelebration = false
    var celebrating: CheckedContinuation<Void, Never>?
    let selection: NativeFeedSelection
    lazy var model = NativeFeedController(selection: selection, isCurrent: { [unowned self] in owner },
        credit: { [unowned self] credit in
            precondition(!driver.live)
            credits.append(credit)
            if failCredit { throw GameSpeechNarration.Failure.unavailable }
        }, onFeed: { [unowned self] id in
            precondition(!driver.live)
            moves.append(id)
            if failMove { throw GameSpeechNarration.Failure.unavailable }
            return 12 + Set(moves).count
        }, onFinish: { [unowned self] in finishes += 1 }, onReplay: {},
        onExit: { [unowned self] in exits += 1 }, driver: driver, provider: provider,
        automaticallyAdvance: false, nowMilliseconds: { [unowned self] in now },
        waitMilliseconds: { [unowned self] ms in
            try Task.checkCancellation()
            if ms == 900 && holdCelebration { await withCheckedContinuation { celebrating = $0 } }
            now += ms
        },
        permissionAlreadyGranted: { false }, soundResource: { URL(fileURLWithPath: "/synthetic/\($0).wav") })
    init(micReady: Bool = true, soundOn: Bool = false) { selection = feedSelection(micReady: micReady, soundOn: soundOn) }
    func start() async throws { model.start(); try await until { self.model.phase == .listening || self.model.phase == .permission } }
    func send(_ time: Double, loud: Bool = false, available: Bool = true) {
        now = time
        var shape = [UInt8](repeating: 0, count: 256)
        for i in [2, 4, 6] { shape[i] = 240 }
        driver.frames?(.init(timestampMilliseconds: time, sampleRate: 48_000,
            samples: [0.005, -0.005, 0.005, -0.005], spectrumDecibels: [-80, -80],
            energyRMS: loud ? 0.15 : 0.005, shapeSpectrumBytes: shape, isAvailable: available))
    }
    func room(_ start: Double) { for t in stride(from: start, through: start + 300, by: 20) { send(t) } }
    func word(_ start: Double) {
        for t in stride(from: start, through: start + 100, by: 20) { send(t, loud: true) }
        for t in stride(from: start + 120, through: start + 320, by: 20) { send(t) }
    }
}

@MainActor private func drain() async { for _ in 0..<100 { await Task.yield() } }
@MainActor private func until(_ condition: @escaping () -> Bool) async throws {
    for _ in 0..<1_500 {
        if condition() { return }
        try await Task.sleep(nanoseconds: 1_000_000)
    }
    preconditionFailure("Expected Feed state did not arrive")
}

@main struct NativeFeedContract {
    @MainActor static var checks = 0
    @MainActor static func check(_ value: Bool, _ message: String) {
        checks += 1; precondition(value, "FAIL: " + message)
    }
    @MainActor static func main() async throws {
        let primer = FeedHarness(micReady: false)
        check(primer.model.phase == .ready && primer.driver.permissions == 0 && primer.provider.repeats.isEmpty, "boot neither speaks nor asks for mic")
        try await primer.start()
        check(primer.model.phase == .permission && primer.driver.permissions == 0, "source primer precedes system permission")
        primer.model.notNow(); await drain()
        check(primer.model.phase == .farewell && primer.driver.opens == 0 && primer.credits.isEmpty, "declining cannot unlock a picture")
        await primer.model.exit(); check(primer.exits == 1, "decline has a working exit")

        let h = FeedHarness(); h.driver.answers = Array(repeating: .onDevice("wabbit"), count: 5)
        try await h.start(); let target = h.selection.turns[0].target
        h.model.pick(target); check(h.moves.isEmpty && h.credits.isEmpty, "picture taps before voicing feed nothing")
        check(h.driver.prompts == ["Where is the rabbit? Say... rabbit.", "Go!"] && h.driver.recognitionHints == [[]], "authored ask and optional Go precede fresh unbiased recognition")
        for round in 0..<5 {
            let start = h.now + 20
            h.room(start); h.word(start + 320)
            try await until { h.model.phase == .choosing }
            check(h.credits.count == round + 1 && h.model.heard && !h.driver.live, "verified close try unlocks once only after mic cleanup")
            h.model.pick(h.selection.turns[round].choices[1]); check(h.moves.count == round, "wrong picture never grows Echo")
            h.model.pick(target); h.model.pick(target)
            try await until { h.model.phase == (round == 4 ? .finished : .listening) }
            check(h.model.fed == round + 1 && Set(h.moves).count == round + 1, "correct picture advances once")
        }
        check(h.finishes == 1 && h.model.lifetimeFed == 17 && h.model.heardCount == 5, "five actual sayings and feeds finish without invented growth")
        check(h.credits.allSatisfy { $0.position == "i" && $0.gameID == "feed" && $0.sequence == 1 } && Set(h.credits.map(\.gateID)).count == 5, "source position and separate per-word credit IDs survive")
        h.model.advance(); check(h.finishes == 1, "completion cannot repeat")
        check(!h.driver.prompts.contains("feed-bite") && !h.driver.prompts.contains("feed-concert"), "muted Feed plays no effects")
        await h.model.close()

        let concert = FeedHarness(soundOn: true)
        concert.driver.answers = Array(repeating: .onDevice("wabbit"), count: 5)
        try await concert.start()
        for round in 0..<5 {
            let start = concert.now + 20
            concert.room(start); concert.word(start + 320)
            try await until { concert.model.phase == .choosing }
            concert.model.pick(target)
            try await until { concert.model.phase == (round == 4 ? .finished : .listening) }
        }
        try await until { concert.driver.playingConcert != nil }
        let effects = concert.driver.prompts.filter { $0.hasPrefix("feed-") }
        check(effects == Array(repeating: "feed-bite", count: 5) + ["feed-concert"], "five verified bites and one concert play in order")
        check(!concert.driver.live && concert.finishes == 1 && concert.driver.opens == 5, "concert starts only after the final microphone closed")
        concert.model.setForeground(false)
        check(concert.driver.playingConcert == nil && concert.driver.stoppedConcerts == 1, "backgrounding stops the concert immediately")
        concert.model.setForeground(true); await drain()
        check(concert.driver.prompts.filter { $0 == "feed-concert" }.count == 1 && concert.driver.opens == 5,
              "returning to the end card restarts neither music nor the microphone")
        await concert.model.close()

        let quiet = FeedHarness(); try await quiet.start()
        quiet.room(quiet.now + 20); quiet.now += 8_001; quiet.model.advance()
        try await until { quiet.model.phase == .listening && quiet.provider.repeats.count == 2 }
        quiet.room(quiet.now + 20); quiet.now += 8_001; quiet.model.advance(); await drain()
        check(quiet.model.phase == .waiting && quiet.provider.repeats == [false, true] && quiet.credits.isEmpty, "silence repeats once, then waits with zero sayings")
        quiet.model.setForeground(false); quiet.model.setForeground(true); await drain()
        check(quiet.driver.opens == 2, "foreground never reopens a mic automatically")
        await quiet.model.close()

        let bad = FeedHarness(); bad.driver.answers = [.unavailable, .onDevice("taco")]
        try await bad.start(); bad.room(bad.now + 20); bad.word(bad.now + 20)
        try await until { bad.model.phase == .listening && bad.provider.repeats.count == 2 }
        bad.room(bad.now + 20); bad.word(bad.now + 20); try await until { bad.model.phase == .waiting }
        check(bad.credits.isEmpty && bad.moves.isEmpty, "unavailable and unrelated words fail closed, not acoustic fallback")
        await bad.model.close()

        let held = FeedHarness(); try await held.start(); held.room(held.now + 20)
        let heldStart = held.now + 20
        for t in stride(from: heldStart, through: heldStart + 8_020, by: 20) { held.send(t, loud: true) }
        held.model.advance(); await drain()
        check(held.model.phase == .waiting && held.provider.repeats == [false] && held.credits.isEmpty, "held voice cannot pass on time or trigger a model over it")
        await held.model.close()

        for ownerChanges in [false, true] {
            let late = FeedHarness(); late.driver.holdRecognition = true
            try await late.start(); late.room(late.now + 20); late.word(late.now + 20)
            try await until { late.driver.recognizing != nil }
            if ownerChanges { late.owner = false; late.model.advance() } else { late.model.pause() }
            late.driver.recognizing?.resume(returning: .onDevice("rabbit")); late.driver.recognizing = nil
            await drain()
            check(late.credits.isEmpty && late.moves.isEmpty && !late.driver.live, "late recognition after pause or child switch is discarded")
            await late.model.close()
        }

        let retry = FeedHarness(); retry.driver.answers = [.onDevice("rabbit")]; retry.failCredit = true
        try await retry.start(); retry.room(retry.now + 20); retry.word(retry.now + 20)
        try await until { retry.model.phase == .waiting }
        check(!retry.model.heard && retry.moves.isEmpty, "a failed canonical write does not unlock pictures")
        retry.failCredit = false; retry.model.listenAgain(); try await until { retry.model.phase == .choosing }
        check(retry.credits.count == 2 && retry.credits[0] == retry.credits[1] && retry.model.heardCount == 1, "storage retry retains the same idempotent saying")
        retry.failMove = true; retry.model.pick(target); try await until { retry.model.phase == .waiting }
        retry.failMove = false; retry.model.listenAgain(); try await until { retry.model.phase == .listening }
        check(retry.moves.count == 2 && retry.moves[0] == retry.moves[1] && retry.model.fed == 1, "growth retry retains the same operation and advances once")
        await retry.model.close()

        let transition = FeedHarness(); transition.driver.answers = [.onDevice("rabbit"), .onDevice("rabbit")]
        transition.holdCelebration = true
        try await transition.start(); transition.room(transition.now + 20); transition.word(transition.now + 20)
        try await until { transition.model.phase == .choosing }
        transition.model.pick(target); try await until { transition.celebrating != nil }
        transition.model.setForeground(false); await drain()
        transition.celebrating?.resume(); transition.celebrating = nil; transition.holdCelebration = false
        transition.model.setForeground(true); transition.model.listenAgain()
        try await until { transition.model.phase == .listening }
        transition.room(transition.now + 20); transition.word(transition.now + 20)
        try await until { transition.model.phase == .choosing }
        check(transition.credits.count == 2 && transition.credits[0].gateID != transition.credits[1].gateID,
              "pause during a persisted feed's celebration cannot reuse the prior saying ID")
        await transition.model.close()

        let permission = FeedHarness(); permission.driver.holdPermission = true
        permission.model.start(); try await until { permission.driver.asking != nil }
        permission.model.pause(); permission.model.listenAgain(); await drain()
        check(permission.driver.permissions == 1 && permission.driver.opens == 0,
              "pause and explicit resume share a pending system permission request")
        permission.driver.holdPermission = false; permission.driver.asking?.resume(returning: true); permission.driver.asking = nil
        try await until { permission.model.phase == .listening }
        check(permission.driver.live && permission.credits.isEmpty, "late old permission cannot close the replacement capture")
        await permission.model.close()

        let exited = FeedHarness(); exited.driver.holdPermission = true
        exited.model.start(); try await until { exited.driver.asking != nil }
        let leaving = Task { await exited.model.close() }
        try await until { exited.model.phase == .closed }
        exited.driver.asking?.resume(returning: true); exited.driver.asking = nil
        await leaving.value
        check(exited.driver.speechPermissionChecks == 0 && exited.driver.opens == 0,
              "closing Feed cancels the pending second permission before leaving")
        let closed = exited.driver.closes
        await exited.model.close()
        check(exited.driver.closes == closed, "disappearing Feed after an explicit exit does not close the next audio owner")

        let cleanup = FeedHarness(); cleanup.driver.answers = [.onDevice("rabbit")]
        try await cleanup.start(); cleanup.driver.holdClose = true
        cleanup.room(cleanup.now + 20); cleanup.word(cleanup.now + 20)
        try await until { cleanup.driver.closing != nil }
        check(cleanup.credits.isEmpty && !cleanup.model.heard, "pending native close blocks credit and glowing pictures")
        cleanup.driver.holdClose = false; cleanup.driver.closing?.resume(); cleanup.driver.closing = nil
        try await until { cleanup.model.phase == .choosing }
        check(cleanup.credits.count == 1 && !cleanup.driver.live, "only completed microphone cleanup permits credit")
        await cleanup.model.close()

        var detector = NativeFeedBurstDetector(policy: feedSelection().policy, family: "low")
        detector.beginWord()
        func frame(_ t: Double, _ loud: Bool = false, _ valid: Bool = true) -> PracticeAcousticFrame {
            .init(timestampMilliseconds: t, sampleRate: 48_000, samples: [0.005, -0.005, 0.005, -0.005],
                  spectrumDecibels: [-80, -80], energyRMS: loud ? 0.15 : 0.005, isAvailable: valid)
        }
        for t in stride(from: 0.0, through: 300, by: 20) { _ = detector.ingest(frame(t)) }
        for t in [320.0, 340, 360] { _ = detector.ingest(frame(t, true)) }
        check(!detector.hasBurst && !detector.ingest(frame(600)), "three loud frames are insufficient")
        for t in [620.0, 640, 660, 680] { _ = detector.ingest(frame(t, true)) }
        check(detector.hasBurst && !detector.ingest(frame(879)), "four frames still require the complete quiet tail")
        check(detector.ingest(frame(880)) && !detector.ingest(frame(900)), "observed 200ms quiet nominates exactly once")
        detector.beginWord(); _ = detector.ingest(frame(1_000, false, false))
        check(!detector.hasBurst && !detector.listeningReady, "starvation cannot be a quiet tail")
        print("Feed native contracts: \(checks) checks passed")
    }
}
