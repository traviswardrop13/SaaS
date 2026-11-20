import Foundation
import Combine
import SonaSpeechCore

/// One original between-segment card. Touch, silence, model playback and elapsed
/// time cannot earn it. The host commits only canonical gameRep, never charge.
@MainActor final class NativeArcadeCheckpointController: ObservableObject {
    enum Phase: String { case unavailable, ready, permission, preparing, speaking, opening, listening, checking, saving, retry, paused, earned, closed }
    @Published private(set) var phase: Phase
    @Published private(set) var ask: NativeArcadeCheckpointSelection.Ask
    @Published private(set) var status = "Get ready…"
    @Published private(set) var listeningReady = false
    let selection: NativeArcadeCheckpointSelection
    private let id: UUID
    private let driver: PracticeAudioDriver
    private let provider: NativeArcadeCheckpointPromptProviding
    private let carry: NativeArcadeCheckpointCarry
    private let isCurrent: @MainActor () -> Bool
    private let credit: @MainActor (GameSayingCredit) async throws -> Void
    private let onEarned: @MainActor () -> Void
    private let onEnd: @MainActor () -> Void
    private let onStepBack: (@MainActor (NativeArcadeCheckpointSelection.Ask) -> Void)?
    private let now: () -> Double
    private let automaticClock: Bool
    private var detector: ArcadeCheckpointDetector
    private var generation: UInt64 = 0
    private var work: Task<Void, Never>?
    private var clock: Task<Void, Never>?
    private var closing: Task<Void, Never>?
    private var permissionOperation: Task<Bool, Never>?
    private var foreground = true
    private var permissionGranted = false
    private var recognitionStarted = false
    private var firstAsk: NativeArcadeCheckpointSelection.Ask?
    private var deadline = Double.infinity
    private var lastClosed = -Double.infinity
    private var pendingCredit: GameSayingCredit?
    private var credited = false
    private var earnedSent = false
    private var ended = false
    private var audioReleased = false

    init(id: UUID, selection: NativeArcadeCheckpointSelection,
         isCurrent: @escaping @MainActor () -> Bool,
         credit: @escaping @MainActor (GameSayingCredit) async throws -> Void,
         onEarned: @escaping @MainActor () -> Void,
         onEnd: @escaping @MainActor () -> Void,
         carry: NativeArcadeCheckpointCarry? = nil,
         onStepBack: (@MainActor (NativeArcadeCheckpointSelection.Ask) -> Void)? = nil,
         heldAsk: NativeArcadeCheckpointSelection.Ask? = nil,
         driver: PracticeAudioDriver? = nil,
         provider: NativeArcadeCheckpointPromptProviding? = nil,
         automaticallyAdvance: Bool = true,
         nowMilliseconds: @escaping () -> Double = { ProcessInfo.processInfo.systemUptime * 1_000 }) {
        self.id = id; self.selection = selection; self.isCurrent = isCurrent
        self.credit = credit; self.onEarned = onEarned; self.onEnd = onEnd
        self.onStepBack = onStepBack; self.now = nowMilliseconds; self.automaticClock = automaticallyAdvance
        let carry = carry ?? NativeArcadeCheckpointCarry()
        self.carry = carry; self.provider = provider ?? carry.provider()
        #if os(iOS)
        self.driver = driver ?? ApplePracticeAudioDriver()
        #else
        precondition(driver != nil, "A test driver is required outside iOS")
        self.driver = driver!
        #endif
        ask = selection.bare
        // The host retains this same source ask only inside the same game.
        // Reject a malformed foreign held value rather than inventing a cue.
        if let heldAsk, selection.card > 0, selection.gameID == "slice", (1...2).contains(heldAsk.rung),
           heldAsk.level == ["isolation", "syllable", "word"][heldAsk.rung],
           !heldAsk.text.isEmpty, heldAsk.clip.isEmpty, !heldAsk.modelText.isEmpty {
            firstAsk = heldAsk
        } else { firstAsk = selection.desired }
        detector = .init(family: selection.family, requiresWord: false, roomFloor: carry.roomFloor)
        phase = selection.isSupported ? .ready : .unavailable
        self.driver.setInterruptionHandler { [weak self] in self?.pause() }
    }

    func startAfterConsent() {
        guard [.ready, .retry, .paused].contains(phase), foreground, current() else { return }
        restart(idea: false)
    }

    func hearAgain() {
        guard [.listening, .retry, .opening].contains(phase), foreground, current() else { return }
        restart(idea: false)
    }

    func setForeground(_ value: Bool) {
        foreground = value
        if !value { pause() }
        // An explicit Resume is required; foreground never opens input.
    }

    func pause() {
        guard ![.unavailable, .closed, .earned, .paused].contains(phase) else { return }
        invalidate(); phase = .paused; status = "Paused"
        work = Task { [weak self] in await self?.closeInput() }
    }

    func endPlaying() {
        guard !ended, !earnedSent else { return }
        ended = true
        invalidate(); phase = .closed
        Task { [weak self] in
            guard let self else { return }
            await self.close()
            self.onEnd()
        }
    }

    func close() async {
        guard !audioReleased else { phase = .closed; return }
        invalidate(); phase = .closed
        await closeInput()
        driver.setInterruptionHandler(nil)
        audioReleased = true
    }

    /// Only Slice's unanswered harder card has an eight-second step-back.
    /// A bare card waits for actual sound or the child's Done action forever.
    func advance() {
        guard [.listening, .checking].contains(phase), foreground, current(), now() >= deadline else { return }
        stepBack()
    }

    private func restart(idea: Bool) {
        invalidate(); let token = generation
        phase = permissionGranted ? .preparing : .permission; status = "Get ready…"
        if automaticClock {
            clock = Task { [weak self] in
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: 16_666_667)
                    guard !Task.isCancelled else { break }
                    self?.advance()
                }
            }
        }
        work = Task { [weak self] in
            guard let self else { return }
            await self.closeInput()
            guard self.live(token) else { return }
            if self.credited { await self.finishEarned(token); return }
            if self.pendingCredit != nil { await self.savePending(token); return }
            if !self.permissionGranted {
                let driver = self.driver
                let request = Task { @MainActor in await driver.requestPermissions() }
                self.permissionOperation = request
                let allowed = await request.value
                self.permissionOperation = nil
                guard self.live(token) else { return }
                // The source ends the round kindly when it cannot listen.
                guard allowed else { self.endPlaying(); return }
                self.permissionGranted = true
            }
            do {
                try await self.wait(max(0, self.lastClosed + 200 - self.now()))
                guard self.live(token) else { return }
                let wanted = self.firstAsk ?? self.ask
                self.phase = .preparing
                var usedHarder = false
                async let preparedGo = self.provider.handoff(selection: self.selection)
                if self.selection.voiceOn && self.selection.volume > 0 && wanted.requiresPreparedModel {
                    if let model = await self.provider.harderModel(selection: self.selection, ask: wanted),
                       model.text == wanted.modelText, model.systemSpeech == nil,
                       !model.isMuted, model.encodedAudio?.isEmpty == false || !model.parts.isEmpty {
                        guard self.live(token) else { return }
                        self.ask = wanted; self.phase = .speaking; self.status = "Listen to Echo…"
                        do {
                            try await self.driver.playPrompt(model)
                            guard self.live(token) else { return }
                            usedHarder = true
                        } catch {
                            guard self.live(token) else { return }
                            // A failed model never leaves an unspoken harder ask.
                            self.ask = self.selection.bare
                        }
                    }
                }
                guard self.live(token) else { return }
                self.firstAsk = nil
                if !usedHarder {
                    self.ask = self.selection.bare
                    let prompts = await self.provider.bareModels(selection: self.selection, idea: idea,
                        includeLead: !wanted.requiresPreparedModel || idea)
                    guard self.live(token) else { return }
                    self.phase = .speaking; self.status = "Listen to Echo…"
                    for prompt in prompts {
                        do { try await self.driver.playPrompt(prompt) }
                        catch {
                            guard self.live(token) else { return }
                            // SayIt permits the installed voice only after an
                            // actual lead clip failed to start. Never for a take.
                            if prompt.text == (idea ? self.selection.stepBackLine : self.selection.intro),
                               prompt.systemSpeech == nil {
                                let fallback = PracticePrompt(text: prompt.text,
                                    systemSpeech: .init(text: prompt.text), volume: self.selection.volume)
                                _ = try? await self.driver.playPrompt(fallback)
                            }
                        }
                        guard self.live(token) else { return }
                    }
                }
                if let go = await preparedGo {
                    guard self.live(token) else { return }
                    _ = try? await self.driver.playPrompt(go)
                }
                guard self.live(token) else { return }
                // SayIt.voice calls listen(true) after a voice-on ask even
                // when optional bytes are unavailable; muted cards skip it.
                if self.selection.voiceOn && self.selection.volume > 0 {
                    try await self.wait(self.selection.voiceTailMilliseconds)
                }
                guard self.live(token) else { return }
                await self.listen(token)
            } catch { if self.live(token) { self.waitForTap(token) } }
        }
    }

    private func listen(_ token: UInt64) async {
        guard live(token) else { return }
        phase = .opening; status = "Get ready…"
        do {
            try await driver.openMicrophone(onFrame: { [weak self] value in self?.frame(value, token: token) },
                onInterruption: { [weak self] in self?.pause() })
            guard live(token) else { await closeInput(); return }
            // The original native card uses no answer-biased contextual words.
            recognitionStarted = await driver.startRecognition(words: [], maxMilliseconds: 15_000)
            guard live(token) else { return }
            detector = .init(family: selection.family, requiresWord: requiresWord, roomFloor: carry.roomFloor)
            listeningReady = false; deadline = .infinity; phase = .listening
        } catch {
            guard live(token) else { return }
            endPlaying()
        }
    }

    private var requiresWord: Bool { ask.level == "word" || ask.level == "sentence" }

    private func frame(_ value: PracticeAcousticFrame, token: UInt64) {
        guard phase == .listening, live(token) else { return }
        let candidate = detector.ingest(value)
        carry.observeFloor(detector.roomFloor)
        if detector.listeningReady && !listeningReady {
            listeningReady = true; status = "I'm listening…"
            if ask.rung > 0 { deadline = now() + 8_000 }
        }
        if candidate != nil {
            phase = .checking; status = "Listening check…"; listeningReady = false
            work = Task { [weak self] in await self?.finishSaying(token) }
        }
    }

    private func finishSaying(_ token: UInt64) async {
        let heardAsk = ask
        let result = await driver.finishRecognition()
        guard live(token), phase == .checking else { return }
        // The source eight-second askWatch also cancels a recognizer still
        // finalizing; a late word cannot sneak through the step-back.
        if heardAsk.rung > 0 && now() >= deadline { stepBack(); return }
        deadline = .infinity
        let accepted: Bool
        if recognitionStarted, case let .onDevice(text) = result {
            let verdict = PracticeWordVerdict.evaluate(transcript: text, sound: selection.sound,
                word: heardAsk.text, level: heardAsk.level, position: heardAsk.position)
            accepted = requiresWord ? verdict == .pass : verdict != .fail
        } else { accepted = !requiresWord }
        await closeInput()
        guard live(token), phase == .checking else { return }
        if !accepted {
            if requiresWord && heardAsk.rung > 0 { stepBack() }
            else { restart(idea: false) }
            return
        }
        pendingCredit = .init(gateID: id, sequence: 1, gameID: selection.gameID,
            sound: selection.sound, word: heardAsk.text, position: heardAsk.position)
        await savePending(token)
    }

    private func savePending(_ token: UInt64) async {
        guard live(token), let value = pendingCredit else { return }
        phase = .saving; status = "Get ready…"
        do { try await credit(value) }
        catch { if live(token) { waitForTap(token) }; return }
        guard pendingCredit == value else { return }
        pendingCredit = nil; credited = true
        guard live(token) else { return }
        await finishEarned(token)
    }

    private func finishEarned(_ token: UInt64) async {
        await closeInput()
        do { try await wait(max(0, lastClosed + 200 - now())) } catch { return }
        guard live(token), !earnedSent else { return }
        earnedSent = true; phase = .earned; clock?.cancel()
        driver.setInterruptionHandler(nil); audioReleased = true
        onEarned()
    }

    private func stepBack() {
        guard ask.rung > 0, current() else { return }
        let held = ask
        ask = selection.bare; firstAsk = nil
        onStepBack?(held)
        restart(idea: true)
    }

    private func waitForTap(_ token: UInt64) {
        guard live(token) else { return }
        invalidate(); phase = .retry; status = "Tap to try again"
        work = Task { [weak self] in await self?.closeInput() }
    }

    private func invalidate() {
        generation &+= 1; work?.cancel(); clock?.cancel()
        // Cancellation precedes waiting for OS permission. A late mic grant
        // must not request Speech permission after the card has disappeared.
        permissionOperation?.cancel(); driver.stopPlayback()
        listeningReady = false; deadline = .infinity
    }

    private func closeInput() async {
        guard !audioReleased else { return }
        let previous = closing, permission = permissionOperation, driver = driver
        let operation = Task { @MainActor in
            await previous?.value
            _ = await permission?.value
            _ = await driver.closeMicrophone()
        }
        closing = operation
        await operation.value
        lastClosed = now()
    }

    private func current() -> Bool {
        guard isCurrent() else {
            if phase != .closed { Task { [weak self] in await self?.close() } }
            return false
        }
        return true
    }
    private func live(_ token: UInt64) -> Bool {
        generation == token && foreground && !Task.isCancelled && current() && ![.closed, .paused, .earned].contains(phase)
    }
    private func wait(_ milliseconds: Double) async throws {
        if milliseconds > 0 { try await Task.sleep(nanoseconds: UInt64(milliseconds * 1_000_000)) }
        try Task.checkCancellation()
    }
}
