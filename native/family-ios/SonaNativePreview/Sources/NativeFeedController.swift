import Foundation
import Combine
import SonaSpeechCore
#if os(iOS)
import AVFAudio
#endif

@MainActor protocol NativeFeedPromptProviding {
    func ask(selection: NativeFeedSelection, turn: NativeFeedSelection.Turn, repeatAsk: Bool) async throws -> PracticePrompt?
    func go(selection: NativeFeedSelection) async -> PracticePrompt?
}

@MainActor final class NativeFeedNarration: NativeFeedPromptProviding {
    private let service = GameSpeechNarration()
    func ask(selection: NativeFeedSelection, turn: NativeFeedSelection.Turn, repeatAsk: Bool) async throws -> PracticePrompt? {
        guard selection.voiceOn && selection.volume != 0 else { return nil }
        let text = repeatAsk ? turn.repeatAsk : turn.ask
        do { return try await service.authoredPrompt(text, voice: selection.voice, volume: selection.volume) }
        catch is CancellationError { throw CancellationError() }
        catch {
            try Task.checkCancellation()
            // The page's speakFallback keeps this same line, rate and pitch.
            // Go remains an optional recording and is never synthesized.
            return .init(text: text, systemSpeech: .init(text: text), volume: selection.volume)
        }
    }
    func go(selection: NativeFeedSelection) async -> PracticePrompt? {
        guard selection.voiceOn && selection.volume != 0 else { return nil }
        return await service.goPrompt(voice: selection.voice, volume: selection.volume)
    }
}

/// One owner for Feed's word-first flow. A picture never substitutes for speech,
/// and accepted game sayings never enter the practice/outcomes ledger.
@MainActor final class NativeFeedController: ObservableObject {
    enum Phase: Equatable { case unavailable, ready, permission, preparing, speaking, opening, listening, checking, saving, choosing, feeding, waiting, paused, finished, farewell, closed }
    @Published private(set) var phase: Phase
    @Published private(set) var status = "Listen…"
    @Published private(set) var fed = 0
    @Published private(set) var heardCount = 0
    @Published private(set) var heard = false
    @Published private(set) var lifetimeFed: Int
    @Published private(set) var fedPictures: [NativeFeedSelection.Word] = []
    let selection: NativeFeedSelection
    private let driver: PracticeAudioDriver
    private let provider: NativeFeedPromptProviding
    private let isCurrent: @MainActor () -> Bool
    private let credit: @MainActor (GameSayingCredit) async throws -> Void
    private let onFeed: @MainActor (UUID) async throws -> Int
    private let onFinish: @MainActor () -> Void
    private let onReplay: @MainActor () -> Void
    private let onExit: @MainActor () -> Void
    private let now: () -> Double
    private let wait: @MainActor (Double) async throws -> Void
    private let permissionAlreadyGranted: @MainActor () -> Bool
    private let automaticClock: Bool
    private var detector: NativeFeedBurstDetector
    private var generation: UInt64 = 0
    private var work: Task<Void, Never>?
    private var clock: Task<Void, Never>?
    private var closing: Task<Void, Never>?
    private var finalClose: Task<Void, Never>?
    private var lastClosed = -Double.infinity
    private var deadline = Double.infinity
    private var foreground = true
    private var permissionGranted = false
    private var permissionRequest: Task<Bool, Never>?
    private var automaticRepeatUsed = false
    private var gateID = UUID()
    private var pendingCredit: GameSayingCredit?
    private var pendingMove: UUID?
    private var finishedSent = false

    var turn: NativeFeedSelection.Turn? { selection.turns.indices.contains(fed) ? selection.turns[fed] : nil }
    var needsSaveRetry: Bool { pendingCredit != nil || pendingMove != nil }

    init(selection: NativeFeedSelection, isCurrent: @escaping @MainActor () -> Bool,
         credit: @escaping @MainActor (GameSayingCredit) async throws -> Void,
         onFeed: @escaping @MainActor (UUID) async throws -> Int,
         onFinish: @escaping @MainActor () -> Void,
         onReplay: @escaping @MainActor () -> Void, onExit: @escaping @MainActor () -> Void,
         driver: PracticeAudioDriver? = nil, provider: NativeFeedPromptProviding? = nil,
         automaticallyAdvance: Bool = true,
         nowMilliseconds: @escaping () -> Double = { ProcessInfo.processInfo.systemUptime * 1000 },
         waitMilliseconds: @escaping @MainActor (Double) async throws -> Void = { ms in
             if ms > 0 { try await Task.sleep(nanoseconds: UInt64(ms * 1_000_000)) }
         }, permissionAlreadyGranted: @escaping @MainActor () -> Bool = NativeFeedController.systemPermissionGranted) {
        self.selection = selection; self.isCurrent = isCurrent; self.credit = credit; self.onFeed = onFeed
        self.onFinish = onFinish; self.onReplay = onReplay; self.onExit = onExit
        self.now = nowMilliseconds; self.wait = waitMilliseconds; self.automaticClock = automaticallyAdvance
        self.permissionAlreadyGranted = permissionAlreadyGranted
        self.provider = provider ?? NativeFeedNarration()
        #if os(iOS)
        self.driver = driver ?? ApplePracticeAudioDriver()
        #else
        precondition(driver != nil, "Feed tests require an injected audio driver")
        self.driver = driver!
        #endif
        detector = NativeFeedBurstDetector(policy: selection.policy, family: selection.family)
        lifetimeFed = selection.lifetimeFed
        phase = selection.isSupported ? .ready : .unavailable
        self.driver.setInterruptionHandler { [weak self] in self?.pause() }
    }

    func start() {
        guard phase == .ready, foreground, isCurrent() else { return }
        if selection.micReady || permissionAlreadyGranted() { ask(repeating: false) }
        else { phase = .permission }
    }
    func enableMicrophone() { guard phase == .permission else { return }; ask(repeating: false) }
    func notNow() {
        generation &+= 1; work?.cancel(); driver.stopPlayback(); phase = .farewell
        work = Task { [weak self] in await self?.closeInput() }
    }

    func listenAgain() {
        guard [.waiting, .paused].contains(phase), foreground, isCurrent() else { return }
        if pendingMove != nil { resumeMove() }
        else if pendingCredit != nil { resumeCredit() }
        else if heard { phase = .choosing; status = "Tap the glowing picture!" }
        else { ask(repeating: true) }
    }

    func pick(_ word: NativeFeedSelection.Word) {
        guard isCurrent(), foreground, let turn, ![.ready, .permission, .feeding, .finished, .closed].contains(phase) else { return }
        guard heard else {
            status = phase == .waiting || phase == .paused ? "Tap the mic, then say “\(turn.target.word)”" : "Say “\(turn.target.word)” first!"
            return
        }
        guard word.word == turn.target.word else { status = "Almost! Where’s the \(turn.target.word)?"; return }
        guard phase == .choosing, pendingMove == nil else { return }
        pendingMove = UUID()
        resumeMove()
    }

    func setForeground(_ value: Bool) {
        foreground = value
        if !value { pause() }
        else if phase == .paused {
            if fed >= selection.turns.count { finishRound() }
            else if heard && pendingMove == nil { phase = .choosing; status = "Tap the glowing picture!" }
            else { phase = .waiting; status = turn.map { "Tap the mic, then say “\($0.target.word)”" } ?? "Listen…" }
        }
    }
    func pause() {
        guard ![.closed, .finished, .unavailable, .ready, .permission, .farewell].contains(phase) else { return }
        generation &+= 1; work?.cancel(); driver.stopPlayback(); deadline = .infinity; phase = .paused
        work = Task { [weak self] in await self?.closeInput() }
    }
    func close() async {
        if let finalClose { await finalClose.value; return }
        generation &+= 1; work?.cancel(); clock?.cancel(); driver.stopPlayback(); deadline = .infinity
        phase = .closed
        let permission = permissionRequest
        permission?.cancel()
        let operation = Task { [weak self] in
            guard let self else { return }
            _ = await permission?.value
            await self.closeInput()
            self.driver.setInterruptionHandler(nil)
        }
        finalClose = operation
        await operation.value
    }
    func exit() async { await close(); onExit() }
    func replay() async { await close(); onReplay() }

    func advance() {
        guard foreground, ownerCurrent(), phase == .listening else { return }
        if now() >= deadline { retry(held: detector.hasBurst) }
    }

    private func ask(repeating: Bool) {
        guard foreground, isCurrent(), let turn else { return }
        generation &+= 1; let token = generation
        work?.cancel(); driver.stopPlayback(); deadline = .infinity
        phase = permissionGranted ? .preparing : .opening; status = "Listen…"
        startClock()
        work = Task { [weak self] in
            guard let self else { return }
            if !self.permissionGranted {
                let request: Task<Bool, Never>
                if let pending = self.permissionRequest { request = pending }
                else {
                    request = Task { @MainActor [driver = self.driver] in await driver.requestPermissions() }
                    self.permissionRequest = request
                }
                let allowed = await request.value
                // A replaced permission waiter never owned an input tap. It
                // must not close the newer turn after the same sheet answers.
                guard self.live(token) else { return }
                self.permissionRequest = nil
                guard allowed else { await self.waitForTap(token); return }
                self.permissionGranted = true
            }
            await self.closeInput()
            guard self.live(token) else { return }
            do {
                try await self.wait(max(0, self.lastClosed + self.selection.policy.settleMilliseconds - self.now()))
                guard self.live(token) else { return }
                self.phase = .preparing
                let prompt = try await self.provider.ask(selection: self.selection, turn: turn, repeatAsk: repeating)
                guard self.live(token) else { return }
                self.phase = .speaking
                if let prompt { try await self.driver.playPrompt(prompt) }
                guard self.live(token) else { return }
                if let go = await self.provider.go(selection: self.selection) {
                    guard self.live(token) else { return }
                    try await self.driver.playPrompt(go)
                }
                try await self.wait(self.selection.policy.voiceTailMilliseconds)
                guard self.live(token) else { return }
                await self.openInput(token)
            } catch { if self.live(token) { await self.waitForTap(token) } }
        }
    }

    private func openInput(_ token: UInt64) async {
        phase = .opening
        do {
            try await driver.openMicrophone(onFrame: { [weak self] frame in self?.frame(frame, token: token) },
                                            onInterruption: { [weak self] in self?.pause() })
            guard live(token) else { await closeInput(); return }
            // No answer hints: the recognized word must be the child's own.
            let available = await driver.startRecognition(words: [], maxMilliseconds: 15_000)
            guard live(token) else { await closeInput(); return }
            guard available else { retry(held: false); return }
            detector.beginWord(); deadline = now() + selection.policy.listenMilliseconds
            phase = .listening; status = turn.map { "Your turn! Say “\($0.target.word)”" } ?? "Listen…"
        } catch { if live(token) { retry(held: false) } }
    }

    private func frame(_ frame: PracticeAcousticFrame, token: UInt64) {
        guard live(token), phase == .listening else { return }
        if detector.ingest(frame) {
            phase = .checking; status = "Listening check…"; deadline = .infinity
            work = Task { [weak self] in await self?.verify(token) }
        }
    }

    private func verify(_ token: UInt64) async {
        guard let turn, live(token) else { return }
        let recognition = await driver.finishRecognition()
        guard live(token) else { await closeInput(); return }
        guard case .onDevice(let text) = recognition,
              PracticeWordVerdict.evaluate(transcript: text, sound: selection.sound,
                                           word: turn.target.word, level: "word", position: turn.target.position) == .pass else {
            retry(held: false); return
        }
        await closeInput()
        guard live(token) else { return }
        pendingCredit = GameSayingCredit(gateID: gateID, sequence: 1, gameID: "feed", sound: selection.sound,
                                        word: turn.target.word, position: turn.target.position)
        await saveCredit(token)
    }

    private func resumeCredit() {
        generation &+= 1; let token = generation; phase = .saving
        work = Task { [weak self] in await self?.saveCredit(token) }
    }
    private func saveCredit(_ token: UInt64) async {
        guard let value = pendingCredit, live(token) else { return }
        phase = .saving; status = "Echo heard you!"
        do { try await credit(value) }
        catch { if live(token) { phase = .waiting }; return }
        guard pendingCredit == value else { return }
        pendingCredit = nil; heard = true; heardCount += 1
        guard live(token) else { return }
        phase = .choosing; status = "Tap the glowing picture!"
    }

    private func resumeMove() {
        guard pendingMove != nil, foreground, isCurrent() else { return }
        generation &+= 1; let token = generation; phase = .feeding
        work = Task { [weak self] in await self?.saveMove(token) }
    }
    private func saveMove(_ token: UInt64) async {
        guard let id = pendingMove, let turn, live(token) else { return }
        let actual: Int
        do { actual = try await onFeed(id) }
        catch { if live(token) { phase = .waiting }; return }
        guard pendingMove == id else { return }
        guard actual >= 0 else { if live(token) { phase = .waiting }; return }
        pendingMove = nil; lifetimeFed = actual; fed += 1; fedPictures.append(turn.target); heard = false
        // This move is durable even if backgrounding cancels its celebration.
        // The next word must never reuse the prior word's idempotent credit ID.
        gateID = UUID(); automaticRepeatUsed = false
        guard live(token) else { return }
        status = fed >= selection.turns.count ? "YUM! All full!" : ["Yum!", "Nice one!", "So tasty!", "Great!"][fed % 4]
        do { try await wait(900) } catch { return }
        guard live(token) else { return }
        if fed >= selection.turns.count { finishRound() }
        else { ask(repeating: false) }
    }

    private func retry(held: Bool) {
        guard foreground, isCurrent(), ![.closed, .finished].contains(phase) else { return }
        if !held && !automaticRepeatUsed {
            automaticRepeatUsed = true
            ask(repeating: true)
        } else {
            generation &+= 1; work?.cancel(); deadline = .infinity; phase = .waiting
            status = turn.map { "Tap the mic, then say “\($0.target.word)”" } ?? "Listen…"
            work = Task { [weak self] in await self?.closeInput() }
        }
    }
    private func waitForTap(_ token: UInt64) async {
        await closeInput()
        guard live(token) else { return }
        phase = .waiting; status = turn.map { "Tap the mic, then say “\($0.target.word)”" } ?? "Listen…"
    }
    private func finishRound() {
        guard isCurrent(), !finishedSent else { return }
        finishedSent = true; phase = .finished; clock?.cancel(); onFinish()
    }
    private func live(_ token: UInt64) -> Bool { token == generation && foreground && ownerCurrent() && phase != .closed }
    private func ownerCurrent() -> Bool {
        if isCurrent() { return true }
        if phase != .closed {
            generation &+= 1; work?.cancel(); clock?.cancel(); driver.stopPlayback(); phase = .closed; deadline = .infinity
            work = Task { [weak self] in await self?.closeInput() }
        }
        return false
    }
    private func startClock() {
        guard automaticClock, clock == nil || clock?.isCancelled == true else { return }
        clock = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 16_666_667)
                guard !Task.isCancelled else { break }
                self?.advance()
            }
        }
    }
    private func closeInput() async {
        let previous = closing, driver = driver
        let operation = Task { @MainActor in await previous?.value; _ = await driver.closeMicrophone() }
        closing = operation
        await operation.value
        lastClosed = now()
    }
    private static func systemPermissionGranted() -> Bool {
        #if os(iOS)
        if #available(iOS 17, *) { return AVAudioApplication.shared.recordPermission == .granted }
        return AVAudioSession.sharedInstance().recordPermission == .granted
        #else
        return false
        #endif
    }
}
