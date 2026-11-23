import Foundation
import Combine
import SonaSpeechCore

/// Owns one original SayPlay word gate. The scene remains mounted behind this
/// owner; it receives an earned move only after real input and mic cleanup.
@MainActor final class GameSpeechGateController: ObservableObject {
    enum Phase: String { case unavailable, ready, permission, preparing, speaking, opening, listening, checking, gap, saving, retry, paused, earned, closed }
    @Published private(set) var phase: Phase
    @Published private(set) var sayings = 0
    @Published private(set) var listeningReady = false
    @Published private(set) var status = ""
    let plan: GameSpeechGatePlan?
    private let driver: PracticeAudioDriver
    private let provider: GameSpeechPromptProviding
    private let isCurrent: @MainActor () -> Bool
    private let credit: @MainActor (GameSayingCredit) async throws -> Void
    private let onEarned: @MainActor () -> Void
    private let onOptionalReturn: (@MainActor () -> Void)?
    private var optionalReturned = false
    private let now: () -> Double
    private let occurrenceNow: () -> NativePracticeOccurrence
    private var detector: SpeechGameBurstDetector
    private let acousticCarry: GameSpeechAcousticCarry
    private var generation: UInt64 = 0
    private var work: Task<Void, Never>?
    private var clock: Task<Void, Never>?
    private var closing: Task<Void, Never>?
    private var permissionOperation: Task<Bool, Never>?
    private var finalClose: Task<Void, Never>?
    private var releasedAudio = false
    private var lastClosed = -Double.infinity
    private var deadline = Double.infinity
    private var foreground = true
    private var hasPermission = false
    private var introSaid = false
    private var automaticRepeatUsed = false
    private var earnedSent = false
    private var pendingCredit: GameSayingCredit?
    private var pendingOccurrence: NativePracticeOccurrence?
    private var notBefore = 0.0
    private let automaticClock: Bool

    init(plan: GameSpeechGatePlan?, isCurrent: @escaping @MainActor () -> Bool,
         creditPlayRep: @escaping @MainActor (GameSayingCredit) async throws -> Void,
         onEarnedMove: @escaping @MainActor () -> Void,
         onOptionalReturn: (@MainActor () -> Void)? = nil,
         acousticCarry: GameSpeechAcousticCarry? = nil,
         driver: PracticeAudioDriver? = nil, provider: GameSpeechPromptProviding? = nil,
         automaticallyAdvance: Bool = true,
         nowMilliseconds: @escaping () -> Double = { ProcessInfo.processInfo.systemUptime * 1_000 },
         occurrenceNow: @escaping () -> NativePracticeOccurrence = { .capture() }) {
        self.plan = plan; self.isCurrent = isCurrent; self.credit = creditPlayRep
        self.onEarned = onEarnedMove; self.now = nowMilliseconds; self.occurrenceNow = occurrenceNow
        self.onOptionalReturn = onOptionalReturn
        self.automaticClock = automaticallyAdvance
        self.provider = provider ?? GameSpeechNarration()
        #if os(iOS)
        self.driver = driver ?? ApplePracticeAudioDriver()
        #else
        precondition(driver != nil, "A test driver is required outside iOS")
        self.driver = driver!
        #endif
        let carry = acousticCarry ?? GameSpeechAcousticCarry()
        self.acousticCarry = carry
        detector = .init(sound: plan?.sound ?? "", roomFloor: carry.roomFloor)
        phase = plan?.isSupported == true ? .ready : .unavailable
        status = phase == .ready ? "Listen, then say it" : "Practice is unavailable"
        self.driver.setInterruptionHandler { [weak self] in self?.pause() }
    }

    func startAfterConsent() {
        guard [.ready, .retry, .paused].contains(phase), foreground, current() else { return }
        restart(model: phase != .retry)
    }

    func hearAgain() {
        guard ![.unavailable, .ready, .permission, .earned, .closed, .paused, .saving].contains(phase), foreground, current() else { return }
        restart(model: true)
    }

    func pause() {
        if onOptionalReturn != nil { returnToMove(); return }
        guard ![.unavailable, .earned, .closed, .paused].contains(phase) else { return }
        generation &+= 1; work?.cancel(); permissionOperation?.cancel(); clock?.cancel(); driver.stopPlayback()
        deadline = .infinity; listeningReady = false; phase = .paused; status = "Paused"
        work = Task { [weak self] in await self?.closeInput() }
    }

    /// Optional help gives up only its power. It never spends the already
    /// earned move, nor rolls back a saying the original game already heard.
    func returnToMove() {
        guard onOptionalReturn != nil, !optionalReturned, phase != .earned else { return }
        optionalReturned = true
        generation &+= 1; work?.cancel(); permissionOperation?.cancel(); clock?.cancel(); driver.stopPlayback()
        phase = .closed; listeningReady = false; deadline = .infinity
        Task { [weak self] in
            guard let self else { return }
            await self.close()
            self.onOptionalReturn?()
        }
    }

    func setForeground(_ value: Bool) {
        foreground = value
        if !value { pause() }
        // Returning to the foreground never opens a microphone.
    }

    func close() async {
        if let finalClose { await finalClose.value; return }
        guard !releasedAudio else { return }
        generation &+= 1; work?.cancel(); permissionOperation?.cancel(); clock?.cancel(); driver.stopPlayback()
        phase = .closed; listeningReady = false; deadline = .infinity
        let final = Task { [weak self] in
            guard let self else { return }
            await self.closeInput()
            self.releaseAudio()
        }
        finalClose = final
        await final.value
    }

    func advance() {
        guard current(), foreground else { return }
        if [.listening, .gap].contains(phase), now() >= deadline {
            retry(held: phase == .listening && detector.hasBurst)
        }
    }

    private func restart(model: Bool) {
        generation &+= 1; let token = generation
        work?.cancel(); driver.stopPlayback(); listeningReady = false; deadline = .infinity
        phase = hasPermission ? .preparing : .permission; status = "Getting ready"
        if automaticClock, clock == nil || clock?.isCancelled == true {
            clock = Task { [weak self] in
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: 16_666_667)
                    guard !Task.isCancelled else { break }
                    self?.advance()
                }
            }
        }
        work = Task { [weak self] in
            guard let self, let plan = self.plan else { return }
            await self.closeInput()
            guard self.live(token) else { return }
            if !self.hasPermission {
                let driver = self.driver
                let permission = Task { @MainActor in await driver.requestPermissions() }
                self.permissionOperation = permission
                let allowed = await permission.value
                guard self.live(token) else { return }
                guard allowed else { await self.waitForTap(token, message: "Microphone is unavailable"); return }
                self.hasPermission = true
            }
            await self.closeInput()
            guard self.live(token) else { return }
            if self.sayings >= plan.sayTimes {
                await self.finishEarned(token); return
            }
            if self.pendingCredit != nil {
                await self.savePending(token)
                guard self.live(token), self.pendingCredit == nil, self.phase != .earned else { return }
            }
            do {
                try await self.wait(max(0, self.lastClosed + 200 - self.now()))
                guard self.live(token) else { return }
                if model {
                    self.phase = .preparing; self.status = "Listen"
                    let models = try await self.provider.prepare(plan: plan, includeIntro: !self.introSaid)
                    guard self.live(token) else { return }
                    self.phase = .speaking
                    for prompt in models {
                        try await self.driver.playPrompt(prompt)
                        guard self.live(token) else { return }
                    }
                    self.introSaid = true
                    try await self.wait(250)
                }
                guard self.live(token) else { return }
                await self.openInput(token)
            } catch {
                guard self.live(token) else { return }
                await self.waitForTap(token, message: "Tap Hear it to try again")
            }
        }
    }

    private func openInput(_ token: UInt64) async {
        guard live(token) else { return }
        phase = .opening; status = "Getting ready"
        detector.beginSaying()
        do {
            try await driver.openMicrophone(onFrame: { [weak self] frame in self?.frame(frame, token: token) },
                                            onInterruption: { [weak self] in self?.pause() })
            guard live(token) else { await closeInput(); return }
            await recognize(token)
        } catch { if live(token) { retry(held: false) } }
    }

    private func recognize(_ token: UInt64) async {
        guard live(token) else { return }
        phase = .opening; listeningReady = false
        // Empty hints are essential: the recognizer must not be told the answer.
        let available = await driver.startRecognition(words: [], maxMilliseconds: 15_000)
        guard live(token) else { return }
        guard available else { retry(held: false); return }
        detector.beginSaying(notBeforeMilliseconds: notBefore)
        phase = .listening; status = "Getting ready"; deadline = now() + 12_000
    }

    private func frame(_ value: PracticeAcousticFrame, token: UInt64) {
        guard live(token) else { return }
        if phase == .listening {
            let candidate = detector.ingest(value)
            acousticCarry.observeFloor(detector.roomFloor)
            listeningReady = detector.listeningReady
            if listeningReady { status = remainingLine }
            if let candidate {
                notBefore = candidate.burstAtMilliseconds + 450
                phase = .checking; status = "Listening check…"; listeningReady = false; deadline = .infinity
                work = Task { [weak self] in await self?.finishSaying(token) }
            }
        } else if phase == .gap {
            if detector.ingestGap(value, notBeforeMilliseconds: notBefore) {
                phase = .opening; deadline = .infinity
                work = Task { [weak self] in await self?.recognize(token) }
            }
        }
    }

    private func finishSaying(_ token: UInt64) async {
        guard let plan, live(token), phase == .checking else { return }
        let result = await driver.finishRecognition()
        guard live(token), phase == .checking else { return }
        guard case let .onDevice(text) = result,
              PracticeWordVerdict.evaluate(transcript: text, sound: plan.sound,
                  word: plan.word, level: "word", position: plan.position) == .pass else {
            retry(held: false); return
        }
        pendingOccurrence = occurrenceNow()
        pendingCredit = .init(gateID: plan.id, sequence: sayings + 1, gameID: plan.gameID,
                              sound: plan.sound, word: plan.word, position: plan.position)
        await savePending(token)
    }

    private func savePending(_ token: UInt64) async {
        guard let value = pendingCredit, let plan, live(token) else { return }
        phase = .saving; status = "Getting ready"; listeningReady = false
        do { try await NativePracticeOccurrenceScope.$current.withValue(pendingOccurrence) { try await credit(value) } }
        catch { if live(token) { await waitForTap(token, message: "Tap to try again") }; return }
        // A successful atomic write remains remembered even if pause occurred
        // while it awaited storage. The same ID is never credited as a new turn.
        guard pendingCredit == value else { return }
        sayings = value.sequence; pendingCredit = nil; pendingOccurrence = nil
        guard live(token) else { return }
        if sayings >= plan.sayTimes {
            await finishEarned(token)
        } else {
            phase = .gap; status = remainingLine; deadline = now() + 12_000
            detector.beginGap()
        }
    }

    private func finishEarned(_ token: UInt64) async {
        await closeInput()
        guard live(token), !earnedSent else { return }
        earnedSent = true; phase = .earned; status = "I heard you!"; clock?.cancel()
        releaseAudio()
        onEarned()
    }

    private func releaseAudio() {
        releasedAudio = true
        driver.setInterruptionHandler(nil)
    }

    private func retry(held: Bool) {
        if onOptionalReturn != nil { returnToMove(); return }
        guard current(), foreground, ![.closed, .paused, .earned].contains(phase) else { return }
        if !held && !automaticRepeatUsed {
            automaticRepeatUsed = true; restart(model: true)
        } else {
            generation &+= 1
            work?.cancel(); driver.stopPlayback(); deadline = .infinity; listeningReady = false
            phase = .retry
            status = sayings > 0 ? remainingLine + " Tap the mic" : "Tap the mic, then say it"
            work = Task { [weak self] in await self?.closeInput() }
        }
    }

    private func waitForTap(_ token: UInt64, message: String) async {
        if onOptionalReturn != nil { returnToMove(); return }
        await closeInput()
        guard live(token) else { return }
        phase = .retry; status = message; listeningReady = false; deadline = .infinity
    }

    private var remainingLine: String {
        guard let plan else { return "" }
        if sayings == 0 { return "Your turn" }
        let left = plan.sayTimes - sayings
        return "\(left) more \(left == 1 ? "time" : "times")!"
    }

    private func closeInput() async {
        let previous = closing
        let permission = permissionOperation
        let driver = driver
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
        generation == token && foreground && !Task.isCancelled && current() && ![.paused, .closed, .earned].contains(phase)
    }
    private func wait(_ milliseconds: Double) async throws {
        if milliseconds > 0 { try await Task.sleep(nanoseconds: UInt64(milliseconds * 1_000_000)) }
        try Task.checkCancellation()
    }
}
