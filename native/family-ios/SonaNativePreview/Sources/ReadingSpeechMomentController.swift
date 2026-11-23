import Foundation
import Combine
import SonaSpeechCore

/// A SayCheck page moment, not a game gate or a charge turn. Each accepted
/// saying closes input, credits only play, and keeps the same source page.
@MainActor final class ReadingSpeechMomentController: ObservableObject {
    enum Phase { case unavailable, primer, waiting, speaking, opening, gap, listening, checking, saving, nudge, paused, heard, readOnly, closed }
    @Published private(set) var phase: Phase = .unavailable
    @Published private(set) var sayings = 0
    @Published private(set) var status = ""
    let plan: ReadingSpeechMomentPlan?
    private let driver: PracticeAudioDriver
    private let voice: GameSpeechNarration
    private let isCurrent: @MainActor () -> Bool
    private let credit: @MainActor (GameSayingCredit) async throws -> Void
    private let onAdvance: @MainActor (ReadingSpeechAdvance) -> Void
    private let onReadOnly: @MainActor (ReadingSpeechReadOnlyScope) -> Void
    private let onMicrophoneAllowed: @MainActor () -> Void
    private let now: () -> Double
    private let occurrenceNow: () -> NativePracticeOccurrence
    private let modelPrompt: (@MainActor (String) async throws -> PracticePrompt)?
    private var detector: ReadingSpeechDetector
    private var generation: UInt64 = 0
    private var work: Task<Void, Never>?
    private var closing: Task<Void, Never>?
    private var permissionOperation: Task<Bool, Never>?
    private var finalClose: Task<Void, Never>?
    private var releasedAudio = false
    private var clock: Task<Void, Never>?
    private var lastClosed = -Double.infinity
    private var deadline = Double.infinity
    private var foreground = true
    private var began = false
    private var permitted = false
    private let acousticCarry: ReadingSpeechAcousticCarry
    private var wordNeedsGap: Bool {
        get { acousticCarry.needsQuietGap }
        set { if newValue { acousticCarry.requireQuietGap() } else { acousticCarry.observedQuietGap() } }
    }
    private var pending: GameSayingCredit?
    private var pendingOccurrence: NativePracticeOccurrence?
    var needsToSave: Bool { pending != nil }
    private var advanced = false
    private var readOnlySent = false
    private let automaticClock: Bool

    init(plan: ReadingSpeechMomentPlan?, isCurrent: @escaping @MainActor () -> Bool,
         creditPlayRep: @escaping @MainActor (GameSayingCredit) async throws -> Void,
         onAdvance: @escaping @MainActor (ReadingSpeechAdvance) -> Void,
         onReadOnly: @escaping @MainActor (ReadingSpeechReadOnlyScope) -> Void,
         onMicrophoneAllowed: @escaping @MainActor () -> Void = {},
         acousticCarry: ReadingSpeechAcousticCarry? = nil,
         driver: PracticeAudioDriver? = nil, voice: GameSpeechNarration? = nil,
         modelPrompt: (@MainActor (String) async throws -> PracticePrompt)? = nil,
         automaticallyAdvance: Bool = true,
         nowMilliseconds: @escaping () -> Double = { ProcessInfo.processInfo.systemUptime * 1_000 },
         occurrenceNow: @escaping () -> NativePracticeOccurrence = { .capture() }) {
        self.plan = plan; self.isCurrent = isCurrent; self.credit = creditPlayRep
        self.onAdvance = onAdvance; self.onReadOnly = onReadOnly
        self.onMicrophoneAllowed = onMicrophoneAllowed; self.now = nowMilliseconds; self.occurrenceNow = occurrenceNow
        self.voice = voice ?? GameSpeechNarration(); self.modelPrompt = modelPrompt
        self.automaticClock = automaticallyAdvance
        #if os(iOS)
        self.driver = driver ?? ApplePracticeAudioDriver()
        #else
        precondition(driver != nil, "A test audio driver is required")
        self.driver = driver!
        #endif
        let carry = acousticCarry ?? ReadingSpeechAcousticCarry()
        self.acousticCarry = carry
        detector = .init(sound: plan?.sound ?? "", roomFloor: carry.roomFloor)
        if plan?.isSupported == true { phase = .waiting; status = "Listen…" }
        self.driver.setInterruptionHandler { [weak self] in self?.pause() }
    }

    /// The host mounts/calls this only after its page narration has stopped.
    func beginAfterNarration() {
        guard !began, let plan, plan.isSupported, current() else { return }
        began = true
        guard plan.eligible else { readOnly(.page); return }
        if plan.consent == .ask { phase = .primer; status = "Let's get a grown-up" }
        else { allowMicrophone() }
    }

    func allowMicrophone() {
        guard [.primer, .waiting].contains(phase), foreground, current() else { return }
        generation &+= 1; let token = generation
        phase = .waiting; status = "Listen…"
        work = Task { [weak self] in
            guard let self else { return }
            await self.closeInput()
            guard self.live(token) else { return }
            let driver = self.driver
            let permission = Task { @MainActor in await driver.requestPermissions() }
            self.permissionOperation = permission
            let granted = await permission.value
            guard self.live(token) else { return }
            guard granted else { self.readOnly(.visit); return }
            self.permitted = true; self.onMicrophoneAllowed()
            guard self.live(token) else { return }
            await self.ask(token, again: false)
        }
        startClock()
    }
    func decline() { guard phase == .primer else { return }; readOnly(.visit) }
    func retryAfterTap() {
        guard [.nudge, .paused].contains(phase), foreground, current() else { return }
        if !permitted {
            phase = .primer
            allowMicrophone()
            return
        }
        generation &+= 1; let token = generation
        work?.cancel(); phase = .waiting; status = ""
        work = Task { [weak self] in
            guard let self else { return }
            await self.closeInput()
            guard self.live(token) else { return }
            if self.pending != nil { await self.save(token); return }
            if let plan = self.plan, self.sayings >= plan.sayTimes { await self.finishPage(token); return }
            await self.listen(token)
        }
        startClock()
    }
    func hearAgain() {
        guard permitted, ![.closed, .heard, .readOnly, .primer, .unavailable, .saving].contains(phase), foreground, current() else { return }
        generation &+= 1; let token = generation
        work?.cancel(); driver.stopPlayback(); phase = .waiting; deadline = .infinity
        work = Task { [weak self] in await self?.replayPage(token) }
        startClock()
    }
    func pause() {
        guard ![.closed, .readOnly, .primer, .unavailable, .paused].contains(phase), !advanced else { return }
        generation &+= 1; work?.cancel(); permissionOperation?.cancel(); clock?.cancel(); driver.stopPlayback()
        phase = .paused; status = "Tap the mic, then say it"; deadline = .infinity
        work = Task { [weak self] in await self?.closeInput() }
    }
    func setForeground(_ value: Bool) { foreground = value; if !value { pause() } }
    func close() async {
        if let finalClose { await finalClose.value; return }
        guard !releasedAudio else { return }
        generation &+= 1; work?.cancel(); permissionOperation?.cancel(); clock?.cancel(); driver.stopPlayback()
        phase = .closed; deadline = .infinity
        let closing = Task { [weak self] in
            guard let self else { return }
            await self.closeInput()
            self.releaseAudio()
        }
        finalClose = closing
        await closing.value
    }
    func advance() {
        guard current(), foreground else { return }
        if [.listening, .gap].contains(phase), now() >= deadline {
            nudge(detector.hasCandidate || phase == .gap ? "unverified" : detector.sawWrongFamily ? "word" : "quiet")
        }
    }

    private func replayPage(_ token: UInt64) async {
        guard let plan, live(token) else { return }
        await closeInput()
        guard live(token) else { return }
        do {
            try await wait(max(0, lastClosed + 200 - now()))
            guard live(token) else { return }
            if let caption = plan.replayCaption, !caption.isEmpty, plan.voiceOn && plan.volume != 0 {
                phase = .speaking; status = "Listen…"
                let prompt = try await authoredPrompt(caption, plan: plan)
                guard live(token) else { return }
                try await driver.playPrompt(prompt)
            }
            guard live(token) else { return }
            await ask(token, again: false, closedForCaption: true)
        } catch { if live(token) { nudge("quiet") } }
    }

    private func authoredPrompt(_ text: String, plan: ReadingSpeechMomentPlan) async throws -> PracticePrompt {
        if let modelPrompt { return try await modelPrompt(text) }
        return try await voice.authoredPrompt(text, voice: plan.voiceID, volume: plan.volume)
    }

    private func ask(_ token: UInt64, again: Bool, closedForCaption: Bool = false) async {
        guard let plan, live(token) else { return }
        if !closedForCaption { driver.stopPlayback(); await closeInput() }
        guard live(token) else { return }
        do {
            if !closedForCaption { try await wait(max(0, lastClosed + 200 - now())) }
            guard live(token) else { return }
            phase = .speaking; status = again ? "One more time…" : "Listen…"
            if plan.voiceOn && plan.volume != 0 {
                let text = plan.ask(again: again)
                let prompt = try await authoredPrompt(text, plan: plan)
                guard live(token) else { return }
                try await driver.playPrompt(prompt)
            }
            try await wait(250)
            guard live(token) else { return }
            if pending != nil { await save(token); return }
            if sayings >= plan.sayTimes { await finishPage(token); return }
            await listen(token)
        } catch { if live(token) { nudge("quiet") } }
    }

    private func listen(_ token: UInt64) async {
        guard live(token) else { return }
        do {
            try await wait(max(0, lastClosed + 200 - now()))
            guard live(token) else { return }
            phase = .opening; status = ""
            try await driver.openMicrophone(onFrame: { [weak self] frame in self?.frame(frame, token) },
                                            onInterruption: { [weak self] in self?.pause() })
            guard live(token) else { await closeInput(); return }
            if wordNeedsGap {
                detector.beginGap(); phase = .gap; deadline = now() + 12_000
            } else { await beginRecognition(token) }
        } catch { if live(token) { readOnly(.page) } }
    }
    private func beginRecognition(_ token: UInt64) async {
        guard live(token) else { return }
        phase = .opening
        let ready = await driver.startRecognition(words: [], maxMilliseconds: 15_000)
        guard live(token) else { return }
        guard ready else { nudge("unverified"); return }
        wordNeedsGap = false; detector.begin(); phase = .listening; deadline = now() + 12_000
    }
    private func frame(_ value: PracticeAcousticFrame, _ token: UInt64) {
        guard live(token) else { return }
        if phase == .gap {
            if detector.ingestGap(value) {
                wordNeedsGap = false
                phase = .opening; deadline = .infinity
                work = Task { [weak self] in await self?.beginRecognition(token) }
            }
            return
        }
        guard phase == .listening else { return }
        let outcome = detector.ingest(value)
        acousticCarry.observeFloor(detector.roomFloor)
        if detector.listeningReady { status = sayings > 0 ? leftNote : "Your turn!" }
        if let outcome {
            phase = .checking; status = ""; deadline = .infinity
            if outcome == .differentWord { nudge("word") }
            else { wordNeedsGap = true; work = Task { [weak self] in await self?.finishWord(token) } }
        }
    }
    private func finishWord(_ token: UInt64) async {
        guard let plan, live(token) else { return }
        let result = await driver.finishRecognition()
        guard live(token) else { return }
        await closeInput()
        guard live(token) else { return }
        guard case let .onDevice(text) = result else { nudge("unverified"); return }
        let verdict = PracticeWordVerdict.evaluate(transcript: text, sound: plan.sound, word: plan.word, level: "word", position: plan.position)
        guard verdict == .pass else { nudge(verdict == .fail ? "word" : "unverified"); return }
        pendingOccurrence = occurrenceNow()
        pending = .init(gateID: plan.id, sequence: sayings + 1, gameID: plan.kind.rawValue,
                        sound: plan.sound, word: plan.word, position: plan.position)
        await save(token)
    }
    private func save(_ token: UInt64) async {
        guard let value = pending, let plan, live(token) else { return }
        phase = .saving
        do { try await NativePracticeOccurrenceScope.$current.withValue(pendingOccurrence) { try await credit(value) } }
        catch { if live(token) { nudge("save") }; return }
        guard pending == value else { return }
        sayings = value.sequence; pending = nil; pendingOccurrence = nil
        guard live(token) else { return }
        if sayings >= plan.sayTimes { await finishPage(token) }
        else { status = leftNote; await listen(token) }
    }
    private func finishPage(_ token: UInt64) async {
        await closeInput()
        guard live(token), !advanced else { return }
        phase = .heard; status = "I heard you!"
        // Existing reader delay; root owns chime/confetti and the actual turn.
        do { try await wait(plan?.kind == .book ? 1_200 : 1_300) } catch { return }
        guard foreground, current(), generation == token, !advanced else { return }
        advanced = true; clock?.cancel(); releaseAudio(); onAdvance(.heard)
    }
    private func nudge(_ reason: String) {
        guard current(), ![.closed, .readOnly, .heard].contains(phase) else { return }
        generation &+= 1; work?.cancel(); driver.stopPlayback(); deadline = .infinity
        phase = .nudge
        switch reason {
        case "save": status = "I heard you! Tap to try saving again."
        case "word", "unverified": status = "Let's try “\(plan?.word ?? "")” again. Tap the mic."
        default: status = "Tap the mic, then say it"
        }
        work = Task { [weak self] in await self?.closeInput() }
    }
    private func readOnly(_ scope: ReadingSpeechReadOnlyScope) {
        generation &+= 1; let token = generation
        work?.cancel(); clock?.cancel(); driver.stopPlayback(); phase = .readOnly
        work = Task { [weak self] in
            guard let self else { return }
            await self.closeInput()
            guard self.generation == token, self.current(), !self.readOnlySent else { return }
            self.readOnlySent = true; self.releaseAudio(); self.onReadOnly(scope)
        }
    }
    private var leftNote: String {
        let left = (plan?.sayTimes ?? 0) - sayings
        return "\(left) more \(left == 1 ? "time" : "times")!"
    }
    private func closeInput() async {
        let previous = closing, driver = driver, permission = permissionOperation
        let operation = Task { @MainActor in
            await previous?.value; _ = await permission?.value
            _ = await driver.closeMicrophone()
        }
        closing = operation; await operation.value; lastClosed = now()
    }
    private func releaseAudio() {
        releasedAudio = true
        driver.setInterruptionHandler(nil)
    }
    private func current() -> Bool {
        guard isCurrent() else { if phase != .closed { Task { [weak self] in await self?.close() } }; return false }
        return true
    }
    private func live(_ token: UInt64) -> Bool {
        generation == token && foreground && current() && !Task.isCancelled && ![.closed, .paused, .readOnly, .heard].contains(phase)
    }
    private func wait(_ milliseconds: Double) async throws {
        if milliseconds > 0 { try await Task.sleep(nanoseconds: UInt64(milliseconds * 1_000_000)) }
        try Task.checkCancellation()
    }
    private func startClock() {
        guard automaticClock, clock == nil || clock?.isCancelled == true else { return }
        clock = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 16_666_667)
                guard !Task.isCancelled else { return }
                self?.advance()
            }
        }
    }
}
