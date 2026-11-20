// Source-flow adapter proof with no actual microphone, TTS or network.
import Foundation
import SonaSpeechCore

@MainActor private final class ReaderTestDriver: PracticeAudioDriver {
    var granted = true
    var opens = 0
    var permissions = 0
    var holdPermission = false
    var asking: CheckedContinuation<Bool, Never>?
    var live = false
    var hints: [[String]] = []
    var models: [String] = []
    var answers: [PracticeRecognitionResult] = []
    var frames: (@MainActor (PracticeAcousticFrame) -> Void)?
    var hold = false
    var finishing: CheckedContinuation<PracticeRecognitionResult, Never>?
    func setInterruptionHandler(_ handler: (@MainActor () -> Void)?) {}
    func requestPermissions() async -> Bool {
        permissions += 1
        if holdPermission { return await withCheckedContinuation { asking = $0 } }
        return granted
    }
    func playPrompt(_ prompt: PracticePrompt) async throws { precondition(!live); models.append(prompt.text) }
    func stopPlayback() {}
    func openMicrophone(onFrame: @escaping @MainActor (PracticeAcousticFrame) -> Void,
                        onInterruption: @escaping @MainActor () -> Void) async throws { opens += 1; live = true; frames = onFrame }
    func startRecognition(words: [String], maxMilliseconds: Double) async -> Bool { hints.append(words); return true }
    func finishRecognition() async -> PracticeRecognitionResult {
        if hold { return await withCheckedContinuation { finishing = $0 } }
        return answers.isEmpty ? .unavailable : answers.removeFirst()
    }
    func closeMicrophone() async -> String { live = false; frames = nil; return "" }
}
@MainActor private final class ReaderHarness {
    let driver = ReaderTestDriver()
    var now = 0.0
    var owner = true
    var credited: [GameSayingCredit] = []
    var advanced: [ReadingSpeechAdvance] = []
    var readOnly: [ReadingSpeechReadOnlyScope] = []
    var allowed = 0
    let kind: ReadingSpeechMomentPlan.Kind
    let consent: ReadingSpeechConsent
    let eligible: Bool
    let carry: ReadingSpeechAcousticCarry
    let replayCaption: String?
    lazy var model = ReadingSpeechMomentController(plan: .init(kind: kind, sound: "R", word: "rabbit", sayTimes: kind == .book ? 1 : 3,
        eligible: eligible, consent: consent, replayCaption: replayCaption), isCurrent: { [unowned self] in owner },
        creditPlayRep: { [unowned self] value in precondition(!driver.live); credited.append(value) },
        onAdvance: { [unowned self] value in precondition(!driver.live); advanced.append(value) },
        onReadOnly: { [unowned self] value in precondition(!driver.live); readOnly.append(value) },
        onMicrophoneAllowed: { [unowned self] in allowed += 1 }, acousticCarry: carry, driver: driver,
        modelPrompt: { .init(text: $0, parts: [], isMuted: true) }, automaticallyAdvance: false,
        nowMilliseconds: { [unowned self] in now })
    init(kind: ReadingSpeechMomentPlan.Kind = .book, consent: ReadingSpeechConsent = .allowed, eligible: Bool = true, carry: ReadingSpeechAcousticCarry? = nil, replayCaption: String? = nil) {
        self.kind = kind; self.consent = consent; self.eligible = eligible; self.carry = carry ?? ReadingSpeechAcousticCarry(); self.replayCaption = replayCaption
    }
    func start() async throws {
        model.beginAfterNarration()
        if consent == .allowed && eligible { try await until { self.model.phase == .listening || self.model.phase == .readOnly } }
        else { await drain() }
    }
    func send(_ t: Double, loud: Bool = false, wrong: Bool = false, available: Bool = true) {
        now = t
        var shape = [UInt8](repeating: 0, count: 256)
        for i in wrong ? [70, 80, 90] : [2, 4, 6] { shape[i] = 245 }
        driver.frames?(.init(timestampMilliseconds: t, sampleRate: 48_000,
            samples: [0.005, -0.005, 0.005, -0.005], spectrumDecibels: [-80, -80],
            energyRMS: loud ? 0.15 : 0.005, shapeSpectrumBytes: shape, isAvailable: available))
    }
    func room(_ start: Double) { for t in stride(from: start, through: start + 500, by: 20) { send(t) } }
    func word(_ start: Double, wrong: Bool = false) {
        for t in stride(from: start, through: start + 160, by: 20) { send(t, loud: true, wrong: wrong) }
        for t in stride(from: start + 180, through: start + (wrong ? 600 : 380), by: 20) { send(t) }
    }
    func next(_ start: Double) async throws {
        try await until { self.model.phase == .gap }
        send(start); send(start + 100); send(start + 200)
        try await until { self.model.phase == .listening }
    }
}
@MainActor private func drain() async { for _ in 0..<140 { await Task.yield() } }
@MainActor private func until(_ condition: @escaping () -> Bool) async throws {
    for _ in 0..<500 {
        if condition() { return }
        try await Task.sleep(nanoseconds: 5_000_000)
    }
    preconditionFailure("Expected native reading state did not arrive")
}
@main struct ReadingSpeechMomentContract {
    @MainActor static var checks = 0
    @MainActor static func check(_ value: Bool, _ label: String) { checks += 1; precondition(value, "FAIL: " + label) }
    @MainActor static func main() async throws {
        let primer = ReaderHarness(consent: .ask)
        check(primer.driver.permissions == 0 && primer.driver.models.isEmpty, "constructing reader asks for no audio or permission")
        try await primer.start()
        check(primer.model.phase == .primer && primer.driver.permissions == 0, "grown-up primer precedes all system permission work")
        primer.model.decline(); await drain()
        check(primer.readOnly == [.visit] && primer.driver.permissions == 0 && primer.credited.isEmpty, "Not now reads on for the visit without any credit")
        await primer.model.close()
        let ineligible = ReaderHarness(eligible: false); try await ineligible.start()
        check(ineligible.readOnly == [.page] && ineligible.driver.permissions == 0, "source age/read-only eligibility never opens input")
        await ineligible.model.close()
        let denied = ReaderHarness(); denied.driver.granted = false; try await denied.start(); await drain()
        check(denied.readOnly == [.visit] && denied.allowed == 0 && denied.driver.opens == 0, "denied permission preserves reading, not a dead end")
        await denied.model.close()

        let book = ReaderHarness(); book.driver.answers = [.onDevice("rabbit")]
        try await book.start(); book.room(0)
        check(book.allowed == 1 && book.driver.models == ["Can you say... rabbit."] && book.driver.hints == [[]], "exact book ask then unbiased word checking, allowed callback once")
        book.word(520); await drain()
        check(book.credited.count == 1 && book.model.sayings == 1 && book.advanced.isEmpty && !book.driver.live, "accepted book word closes before one play rep and waits source page delay")
        try await until { !book.advanced.isEmpty }
        check(book.advanced == [.heard] && book.credited.first?.position == "", "one book saying advances once with original empty position")
        book.now += 20_000; book.model.advance(); await drain()
        check(book.advanced.count == 1 && book.credited.count == 1, "later ticks cannot re-credit or re-turn page")
        await book.model.close()

        let story = ReaderHarness(kind: .talkingStory); story.driver.answers = Array(repeating: .onDevice("rabbit"), count: 3)
        try await story.start(); story.room(0); story.word(520); await drain()
        try await story.next(1_000); story.word(1_220); await drain()
        try await story.next(1_700); story.word(1_920); await drain()
        check(story.credited.map(\.sequence) == [1, 2, 3] && story.driver.models.count == 1 && story.driver.hints == [[], [], []], "three independent story sayings reuse no transcript and add no voice between them")
        try await until { !story.advanced.isEmpty }
        check(story.advanced == [.heard] && story.credited.count == 3, "only full canonical story count turns the page")
        await story.model.close()

        for answer in [PracticeRecognitionResult.unavailable, .onDevice("banana")] {
            let wrong = ReaderHarness(); wrong.driver.answers = Array(repeating: answer, count: 3)
            try await wrong.start(); wrong.room(0)
            for index in 0..<3 {
                wrong.word(520 + Double(index) * 1_000); await drain()
                check(wrong.model.phase == .nudge && wrong.credited.isEmpty && wrong.advanced.isEmpty, "native unknown/unrelated words never become three-shape fallback")
                if index < 2 {
                    wrong.model.retryAfterTap(); try await wrong.next(1_000 + Double(index) * 1_000)
                }
            }
            await wrong.model.close()
        }
        let quiet = ReaderHarness(); try await quiet.start(); quiet.room(0)
        quiet.now = 12_001; quiet.model.advance(); await drain()
        check(quiet.model.phase == .nudge && quiet.credited.isEmpty && quiet.advanced.isEmpty && quiet.driver.models.count == 1, "quiet never counts a try or advances; tap listens again")
        quiet.model.setForeground(false); quiet.model.setForeground(true); await drain()
        check(!quiet.driver.live && quiet.driver.opens == 1, "returning to foreground never opens input")
        await quiet.model.close()
        let held = ReaderHarness(); try await held.start(); held.room(0)
        for t in stride(from: 520.0, through: 12_100, by: 20) { held.send(t, loud: true) }
        held.model.advance(); await drain()
        check(held.model.phase == .nudge && held.credited.isEmpty && held.advanced.isEmpty, "held cap is unverified, never a heard word")
        await held.model.close()
        let stale = ReaderHarness(); stale.driver.hold = true
        try await stale.start(); stale.room(0); stale.word(520); await drain()
        check(stale.driver.finishing != nil && stale.credited.isEmpty, "pending local final is not pre-credited")
        stale.owner = false; stale.model.advance()
        stale.driver.finishing?.resume(returning: .onDevice("rabbit")); stale.driver.finishing = nil
        await drain()
        check(stale.credited.isEmpty && stale.advanced.isEmpty && !stale.driver.live, "stale child/page cannot use a late final")
        await stale.model.close()
        let latePermission = ReaderHarness(); latePermission.driver.holdPermission = true
        latePermission.model.beginAfterNarration(); await drain()
        check(latePermission.driver.asking != nil, "reader OS permission may be pending")
        latePermission.owner = false; latePermission.model.advance(); await drain()
        latePermission.driver.asking?.resume(returning: true); latePermission.driver.asking = nil
        await drain()
        check(latePermission.allowed == 0 && latePermission.driver.opens == 0 && latePermission.credited.isEmpty, "late permission never marks consent or starts a stale page")
        await latePermission.model.close()

        let interruptedTurn = ReaderHarness(); interruptedTurn.driver.answers = [.onDevice("rabbit")]
        try await interruptedTurn.start(); interruptedTurn.room(0); interruptedTurn.word(520); await drain()
        interruptedTurn.model.setForeground(false)
        try await Task.sleep(nanoseconds: 1_400_000_000)
        check(interruptedTurn.credited.count == 1 && interruptedTurn.advanced.isEmpty, "background during heard delay retains rep but does not turn page")
        interruptedTurn.model.setForeground(true); await drain()
        check(interruptedTurn.advanced.isEmpty && !interruptedTurn.driver.live, "foreground does not finish a suspended page")
        interruptedTurn.model.retryAfterTap(); try await until { !interruptedTurn.advanced.isEmpty }
        check(interruptedTurn.credited.count == 1 && interruptedTurn.advanced.count == 1, "explicit resume finishes once without a new saying or credit")
        await interruptedTurn.model.close()
        let carry = ReadingSpeechAcousticCarry()
        let priorPage = ReaderHarness(carry: carry); priorPage.driver.answers = [.onDevice("rabbit")]
        try await priorPage.start(); priorPage.room(0); priorPage.word(520); await drain()
        check(carry.roomFloor == 0.005 && carry.needsQuietGap, "reader visit retains only aggregate floor and a required fresh-gap bit")
        await priorPage.model.close()
        let nextPage = ReaderHarness(carry: carry); nextPage.driver.answers = [.onDevice("rabbit")]
        nextPage.model.beginAfterNarration(); try await until { nextPage.model.phase == .gap }
        check(nextPage.driver.hints.isEmpty, "new keyed page cannot start recognition before its own quiet gap")
        for t in stride(from: 2_000.0, through: 2_600, by: 20) { nextPage.send(t, loud: true) }
        check(nextPage.driver.hints.isEmpty && nextPage.credited.isEmpty, "continuing prior-page speech cannot become new page saying")
        nextPage.send(2_620); nextPage.send(2_800)
        check(nextPage.driver.hints.isEmpty, "page carry still needs full 200ms observed quiet")
        nextPage.send(2_820); try await until { nextPage.model.phase == .listening }
        check(!carry.needsQuietGap && nextPage.driver.hints == [[]], "fresh quiet releases exactly one new unbiased recognizer")
        nextPage.word(2_840); await drain()
        check(nextPage.credited.count == 1 && nextPage.model.sayings == 1, "new page earns its own one saying without carrying old count")
        await nextPage.model.close()
        let replay = ReaderHarness(kind: .talkingStory, replayCaption: "A rabbit runs.")
        replay.driver.answers = [.onDevice("rabbit")]
        try await replay.start(); replay.room(0); replay.word(520); await drain()
        try await until { replay.model.phase == .gap }
        replay.model.hearAgain()
        try await until { replay.driver.models.count == 3 && replay.model.phase == .gap }
        check(replay.driver.models == ["Can you say... rabbit.", "A rabbit runs.", "Can you say... rabbit."], "Hear it closes input, reads exact page, then asks original word")
        check(replay.credited.count == 1 && replay.model.sayings == 1 && replay.driver.hints.count == 1, "page replay retains accepted saying and waits fresh gap without new credit")
        await replay.model.close()
        print("PASS: \(checks) native reader speech moment checks")
    }
}
