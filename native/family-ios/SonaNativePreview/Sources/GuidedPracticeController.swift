import Foundation
import Combine
import SonaSpeechCore

@MainActor final class GuidedPracticeController: ObservableObject {
    enum Presentation { case unavailable, ready, preparing, speaking, listening, checking, paused, quiet, failure, launching, finished, closed }
    @Published private(set) var presentation: Presentation = .unavailable
    @Published private(set) var status = "This practice step isn’t ready yet."
    @Published private(set) var reps = 0
    @Published private(set) var requiredReps = 5
    @Published private(set) var targetText = ""
    @Published private(set) var quietMessage = PracticeFlowContent.quiet
    @Published private(set) var canReplay = false
    let gameTitle: String

    private let plan: GuidedPracticePlan?
    private let isCurrent: @MainActor () -> Bool
    private let apply: @MainActor (PracticeFlowMachine.Effect) async throws -> Void
    private let onReady: @MainActor (PracticeFlowMachine.Ready) -> Void
    private let driver: PracticeAudioDriver?
    private let provider: GuidedPracticePromptProviding?
    private let automaticClock: Bool
    private let nowMilliseconds: () -> Double
    private var flow: PracticeFlowMachine?
    private var session: PracticeTurnSession?
    private var wrapper: GuidedPracticeAudioDriver?
    private var work: Task<Void, Never>?
    private var effectGeneration = UUID()
    private var effects: [PracticeFlowMachine.Effect] = []
    private var cursor = 0
    private var foreground = true
    private var closed = false
    private var handedOffAudio = false
    private var audioFailed = false
    private var appliedReadyFlows = Set<UUID>()
    private var startedTerminalLines = Set<String>()

    init(plan: GuidedPracticePlan?, isCurrent: @escaping @MainActor () -> Bool,
         apply: @escaping @MainActor (PracticeFlowMachine.Effect) async throws -> Void,
         onReady: @escaping @MainActor (PracticeFlowMachine.Ready) -> Void,
         driver: PracticeAudioDriver? = nil, provider: GuidedPracticePromptProviding? = nil,
         automaticallyAdvance: Bool = true,
         nowMilliseconds: @escaping () -> Double = { ProcessInfo.processInfo.systemUptime * 1000 }) {
        self.plan = plan; self.isCurrent = isCurrent; self.apply = apply; self.onReady = onReady
        self.gameTitle = plan?.gameTitle ?? "Games"
        self.automaticClock = automaticallyAdvance
        self.nowMilliseconds = nowMilliseconds
        #if os(iOS)
        self.driver = driver ?? ApplePracticeAudioDriver()
        #else
        self.driver = driver
        #endif
        self.provider = provider ?? (try? GuidedPracticeNarration())
        guard let plan, plan.hasSupportedEvidence, self.driver != nil, self.provider != nil,
              !plan.content.text.isEmpty, !plan.content.cueTip.isEmpty,
              let value = try? PracticeFlowMachine(content: plan.content, masteredRung: plan.masteredRung,
                  stepNext: plan.stepNext, requiredReps: plan.requiredReps,
                  demoReplay: plan.demoReplay, alreadyRinged: plan.alreadyRinged, isDaily: plan.isDaily) else { return }
        self.flow = value
        self.requiredReps = plan.requiredReps
        self.targetText = displayText(plan.content)
        presentation = .ready
        status = "Ready when you are."
    }

    func startAfterConsent() {
        guard presentation == .ready, current(), var flow else { return }
        let next = flow.send(.start)
        self.flow = flow
        enqueue(next)
    }

    /// The production session owns its automatic clock. An explicitly supplied
    /// clock can be advanced deterministically without a timer manufacturing reps.
    func advance() { session?.advance() }

    func replay(slow: Bool) {
        guard canReplay, current() else { return }
        wrapper?.nextMode = slow ? .slow : .replay
        session?.replayPromptAfterTap()
    }

    func pause() {
        guard ![.unavailable, .ready, .finished, .closed].contains(presentation) else { return }
        work?.cancel()
        driver?.stopPlayback()
        session?.pause()
        canReplay = false
        presentation = .paused
        status = "Practice paused"
    }

    func setForeground(_ value: Bool) {
        foreground = value
        session?.setForeground(value)
        if !value { pause() }
        // Returning alone never requests permission, plays a voice or opens input.
    }

    func resumeAfterTap() {
        guard [.paused, .failure].contains(presentation), foreground, current() else { return }
        audioFailed = false
        if cursor < effects.count { continueEffects(); return }
        if session?.machine.phase == .paused { session?.resumeAfterTap(); return }
        if session?.machine.phase == .quiet || session?.machine.phase == .microphoneUnavailable { retryQuietAfterTap(); return }
    }

    func retryQuietAfterTap() {
        guard [.quiet, .failure, .paused].contains(presentation), foreground, current(), var flow else { return }
        let next = flow.send(.retryQuiet)
        self.flow = flow
        enqueue(next)
    }

    /// The view awaits this before dismissing. A stale OS grant/open cannot
    /// revive an old turn, and pending input finishes closing before return.
    func close() async {
        guard !closed else { return }
        closed = true
        work?.cancel()
        if handedOffAudio { return }
        driver?.stopPlayback()
        _ = flow?.send(.cancel)
        await session?.cancelAndClose()
        _ = await driver?.closeMicrophone()
        canReplay = false
        presentation = .closed
    }

    private func current() -> Bool {
        guard !closed, isCurrent() else {
            if !closed { Task { await self.close() } }
            return false
        }
        return true
    }

    private func enqueue(_ next: [PracticeFlowMachine.Effect]) {
        guard !next.isEmpty else { return }
        work?.cancel()
        effects = next
        cursor = 0
        continueEffects()
    }

    private func continueEffects() {
        work?.cancel()
        let generation = UUID()
        effectGeneration = generation
        work = Task { [weak self] in
            guard let self else { return }
            do {
                while self.cursor < self.effects.count {
                    try Task.checkCancellation()
                    guard generation == self.effectGeneration, self.foreground, self.current() else { return }
                    let effect = self.effects[self.cursor]
                    switch effect {
                    case .beginTurn(let turn):
                        await self.begin(turn)
                    case .saveVerifiedAttempt, .recordRungWin:
                        self.presentation = .checking
                        self.status = "Echo is checking…"
                        // The rules bridge verifies ownership and applies the
                        // existing logAttempt/bumpReps atomically and idempotently.
                        try await self.apply(effect)
                    case .showQuiet(let message):
                        self.quietMessage = message
                        self.presentation = .quiet
                        self.status = message.title
                        self.canReplay = false
                        if message == PracticeFlowContent.quiet, let plan = self.plan,
                           let provider = self.provider, let driver = self.driver {
                            do {
                                let prompt = try await provider.prepare(.quietNotice, plan: plan)
                                try Task.checkCancellation()
                                guard self.current(), self.foreground else { return }
                                try await driver.playPrompt(prompt)
                            } catch is CancellationError { throw CancellationError() }
                            catch { /* The same quiet message remains available in print. */ }
                        }
                    case .readyForGame(let ready):
                        try await self.handoff(ready)
                    case .cancelTurn:
                        await self.session?.cancelAndClose()
                    }
                    try Task.checkCancellation()
                    self.cursor += 1
                }
            } catch is CancellationError {
                // A route may cancel terminal feedback after its turn's
                // session is complete. Keep this same effect cursor resumable.
                guard generation == self.effectGeneration, self.current() else { return }
                if self.presentation != .paused {
                    self.presentation = .paused; self.status = "Practice paused"
                    self.canReplay = false
                }
            } catch {
                guard generation == self.effectGeneration, self.current() else { return }
                self.presentation = .failure
                self.status = "That didn’t finish. Tap Try again."
                self.canReplay = false
            }
        }
    }

    private func begin(_ turn: PracticeFlowMachine.Turn) async {
        await session?.cancelAndClose()
        guard current(), foreground, let plan, let provider, let driver else { return }
        reps = 0; requiredReps = turn.requiredReps; targetText = displayText(turn.content)
        presentation = .preparing; status = "Getting ready…"; canReplay = false
        let wrapped = GuidedPracticeAudioDriver(base: driver, provider: provider, plan: plan, turn: turn,
            isCurrent: { [weak self] in self?.current() == true && self?.foreground == true })
        wrapped.onModelState = { [weak self] preparing in
            guard let self, self.current() else { return }
            self.presentation = preparing ? .preparing : .speaking
            self.status = preparing ? "Getting Echo ready…" : "Listen to Echo"
        }
        wrapped.onModelFailure = { [weak self] in
            guard let self else { return }
            self.audioFailed = true
            self.status = "Echo’s voice couldn’t load. Tap Try again."
            self.presentation = .failure
        }
        wrapper = wrapped
        let value = PracticeTurnSession(target: turn.content.target,
            prompt: PracticePrompt(text: turn.prompt, parts: []), requiredReps: turn.requiredReps, driver: wrapped,
            automaticallyAdvance: automaticClock, nowMilliseconds: nowMilliseconds)
        session = value
        value.onChange = { [weak self] machine in self?.observe(machine, id: turn.id) }
        value.onResult = { [weak self] result in
            guard let self, self.current(), var flow = self.flow else { return }
            let next = flow.send(.completed(turn.id, result))
            self.flow = flow
            self.enqueue(next)
        }
        value.startAfterGrownUpConsent()
    }

    private func observe(_ machine: PracticeTurnMachine, id: PracticeFlowMachine.TurnID) {
        guard current(), flow?.currentTurn?.id == id else { return }
        reps = machine.reps
        canReplay = foreground && machine.phase == .listening && machine.listeningReady
        switch machine.phase {
        case .quiet, .microphoneUnavailable:
            guard var flow else { return }
            let next = flow.send(.quiet(id, microphoneUnavailable: machine.phase == .microphoneUnavailable,
                                        wordCheckIssue: machine.wordCheckIssue))
            self.flow = flow
            enqueue(next)
        case .paused:
            presentation = audioFailed ? .failure : .paused
            if !audioFailed { status = "Practice paused" }
        case .listening:
            presentation = machine.listeningReady ? .listening : .preparing
            status = machine.listeningReady ? "Your turn" : "Getting ready…"
        case .prompting:
            if presentation != .preparing { presentation = .speaking; status = "Listen to Echo" }
        case .finishingEvidence, .completed:
            presentation = .checking; status = "Echo is checking…"
        case .permission, .openingRoom, .measuringRoom, .closing, .settlingOutput, .quietTail, .openingMicrophone:
            if !audioFailed { presentation = .preparing; status = "Getting ready…" }
        case .idle, .cancelled: break
        }
    }

    private func handoff(_ ready: PracticeFlowMachine.Ready) async throws {
        guard let plan, let provider, let driver, current() else { throw CancellationError() }
        presentation = .launching; status = "Game ready!"; canReplay = false
        await session?.cancelAndClose()
        driver.setInterruptionHandler { [weak self] in self?.pause() }
        for (index, feedback) in ready.feedbackBeforeBookkeeping.enumerated() {
            let key = ready.flowID.uuidString + "|before|" + String(index)
            if startedTerminalLines.contains(key) { continue }
            guard foreground, current() else { throw CancellationError() }
            let prompt = try await provider.prepare(.feedback(feedback), plan: plan)
            guard foreground, current() else { throw CancellationError() }
            try await driver.playPrompt(prompt)
            try Task.checkCancellation()
            guard foreground, current() else { throw CancellationError() }
            startedTerminalLines.insert(key)
        }
        try Task.checkCancellation()
        guard foreground, current(), flow?.phase == .ready else { throw CancellationError() }
        if !appliedReadyFlows.contains(ready.flowID) {
            try await apply(.readyForGame(ready))
            appliedReadyFlows.insert(ready.flowID)
        }
        if !ready.feedbackAfterBookkeeping.isEmpty {
            try await Task.sleep(nanoseconds: UInt64(PracticeFlowContent.afterChimeMilliseconds * 1_000_000))
            for (index, feedback) in ready.feedbackAfterBookkeeping.enumerated() {
                let key = ready.flowID.uuidString + "|after|" + String(index)
                if startedTerminalLines.contains(key) { continue }
                guard foreground, current() else { throw CancellationError() }
                let prompt = try await provider.prepare(.feedback(feedback), plan: plan)
                guard foreground, current() else { throw CancellationError() }
                try await driver.playPrompt(prompt)
                try Task.checkCancellation()
                guard foreground, current() else { throw CancellationError() }
                startedTerminalLines.insert(key)
            }
        }
        try await Task.sleep(nanoseconds: UInt64(PracticeFlowContent.launchDelayMilliseconds * 1_000_000))
        guard foreground, current(), flow?.phase == .ready else { throw CancellationError() }
        await session?.cancelAndClose()
        _ = await driver.closeMicrophone()
        guard current(), foreground else { throw CancellationError() }
        driver.setInterruptionHandler(nil)
        handedOffAudio = true
        presentation = .finished
        onReady(ready)
    }

    private func displayText(_ content: PracticeFlowContent) -> String {
        if content.rung == .isolation { return content.text }
        return content.display.flatMap { $0.isEmpty ? nil : $0 } ?? content.text
    }
}

/// Text/model resolution runs inside playPrompt, after the turn has closed
/// input. The wrapper has no path from microphone frames to the voice service.
@MainActor final class GuidedPracticeAudioDriver: PracticeAudioDriver {
    var nextMode: GuidedPracticeVoiceMode?
    var onModelState: ((Bool) -> Void)?
    var onModelFailure: (() -> Void)?
    private let base: PracticeAudioDriver
    private let provider: GuidedPracticePromptProviding
    private let plan: GuidedPracticePlan
    private let turn: PracticeFlowMachine.Turn
    private let isCurrent: () -> Bool
    private var spokenInitial = false
    private var generation: UInt64 = 0

    init(base: PracticeAudioDriver, provider: GuidedPracticePromptProviding, plan: GuidedPracticePlan,
         turn: PracticeFlowMachine.Turn, isCurrent: @escaping () -> Bool) {
        self.base = base; self.provider = provider; self.plan = plan; self.turn = turn; self.isCurrent = isCurrent
    }
    func setInterruptionHandler(_ handler: (@MainActor () -> Void)?) { base.setInterruptionHandler(handler) }
    func requestPermissions() async -> Bool { guard isCurrent() else { return false }; return await base.requestPermissions() }
    func playPrompt(_ prompt: PracticePrompt) async throws {
        guard isCurrent(), prompt.text == turn.prompt else { throw CancellationError() }
        let token = generation
        let mode = nextMode ?? (spokenInitial ? .replay : .initial)
        onModelState?(true)
        do {
            let prepared = try await provider.prepare(.turn(turn, mode), plan: plan)
            try Task.checkCancellation()
            guard generation == token, isCurrent() else { throw CancellationError() }
            onModelState?(false)
            try await base.playPrompt(prepared)
            try Task.checkCancellation()
            guard generation == token, isCurrent() else { throw CancellationError() }
            nextMode = nil; spokenInitial = true
        } catch is CancellationError {
            if nextMode == nil { nextMode = mode }
            throw CancellationError()
        } catch {
            if nextMode == nil { nextMode = mode }
            onModelFailure?(); throw CancellationError()
        }
    }
    func stopPlayback() { generation &+= 1; base.stopPlayback() }
    func openMicrophone(onFrame: @escaping @MainActor (PracticeAcousticFrame) -> Void,
                        onInterruption: @escaping @MainActor () -> Void) async throws {
        guard isCurrent() else { throw CancellationError() }
        try await base.openMicrophone(onFrame: { [weak self] frame in
            guard let self else { return }
            if self.isCurrent() { onFrame(frame) } else { onInterruption() }
        }, onInterruption: onInterruption)
        if !isCurrent() { _ = await base.closeMicrophone(); throw CancellationError() }
    }
    func startRecognition(words: [String], maxMilliseconds: Double) async -> Bool {
        guard isCurrent() else { return false }
        return await base.startRecognition(words: words, maxMilliseconds: maxMilliseconds)
    }
    func finishRecognition() async -> PracticeRecognitionResult {
        guard isCurrent() else { return .unavailable }
        let result = await base.finishRecognition()
        return isCurrent() ? result : .unavailable
    }
    func closeMicrophone() async -> String { await base.closeMicrophone() }
}
