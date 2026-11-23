import Combine
import Foundation
import SonaSpeechCore

@MainActor protocol NativeArcadePowerPromptProviding {
    func lead(_ text: String, selection: NativeArcadeCheckpointSelection) async -> PracticePrompt?
    func bareTake(selection: NativeArcadeCheckpointSelection) -> PracticePrompt?
    func handoff(selection: NativeArcadeCheckpointSelection) async -> PracticePrompt?
}

extension NativeArcadeCheckpointAudio: NativeArcadePowerPromptProviding {}

/// The optional live sound turn in the six charge-start games. It never
/// advances a board, changes hearts, or asks for a new practice target.
@MainActor final class NativeArcadePowerController: ObservableObject {
    enum Phase { case idle, asking, listening, checking }

    @Published private(set) var title = ""
    @Published private(set) var buttonLabel = ""
    @Published private(set) var status = ""
    @Published private(set) var phase = Phase.idle
    @Published private(set) var canTap = false
    @Published private(set) var powerRemaining = 0.0
    @Published private(set) var powerRevision = 0

    var isAsking: Bool { phase != .idle }
    var suppressesGameAudio: Bool { isAsking }
    var speedFactor: Double { powerRemaining > 0 ? 0.55 : 1 }
    var powerDuration: Double { game?.duration ?? 0 }

    private struct Game {
        let action, reason, earned: String
        let duration: Double

        init(action: String, earned: String, reason: String? = nil, duration: Double = 8_000) {
            self.action = action
            self.reason = reason ?? "To " + action + ", say"
            self.earned = earned
            self.duration = duration
        }

        // SLOW_HELP in the six arcade-*.html pages.
        static let definitions: [String: Self] = [
            "slice": .init(action: "get Super Slice", earned: "SUPER SLICE!", reason: "Super Slice! Say", duration: 10_000),
            "glide": .init(action: "slow the beams", earned: "Slow beams!"),
            "rise": .init(action: "slow the falling blocks", earned: "Slow blocks!"),
            "run": .init(action: "slow the course", earned: "Slow course!"),
            "tiles": .init(action: "slow the keys", earned: "Slow keys!"),
            "stack": .init(action: "slow the block", earned: "Slow blocks!")
        ]
    }

    private struct Narration {
        let reason: PracticePrompt?
        let go: PracticePrompt?
    }

    private enum Heard {
        case sound(useRecognition: Bool)
        case silence
        case microphoneUnavailable
        case cancelled
    }

    private let isCurrent: () -> Bool
    private let credit: (GameSayingCredit) async throws -> Void
    private let driver: PracticeAudioDriver
    private let provider: NativeArcadePowerPromptProviding
    private let carry: NativeArcadeCheckpointCarry
    private let now: () -> Double
    private let occurrenceNow: () -> NativePracticeOccurrence
    private let wait: (Double) async throws -> Void
    private let automaticallyTimeOut: Bool
    private var selection: NativeArcadeCheckpointSelection?
    private var game: Game?
    private var schedule = NativeArcadePowerSchedule()
    private var boardPlaying = false
    private var boardEligible = false
    private var microphoneUnavailable = false
    private var reasonHeard = false
    private var gameplayAudioEnd = -Double.infinity
    private var audioRouteTouched = false
    private var warmedNarration: Task<Narration, Never>?
    private var prefetchFinished = false
    private var turn: Task<Void, Never>?
    private var turnID: UUID?
    private var listenTimer: Task<Void, Never>?
    private var listenDeadline = Double.infinity
    private var heard: Bool?
    private var heardContinuation: CheckedContinuation<Bool, Never>?
    private var detector = ArcadeCheckpointDetector(family: "any", requiresWord: false, timing: .livePower)

    init(isCurrent: @escaping () -> Bool, credit: @escaping (GameSayingCredit) async throws -> Void,
         carry: NativeArcadeCheckpointCarry? = nil, driver: PracticeAudioDriver? = nil,
         provider: NativeArcadePowerPromptProviding? = nil, automaticallyTimeOut: Bool = true,
         nowMilliseconds: @escaping () -> Double = { ProcessInfo.processInfo.systemUptime * 1_000 },
         occurrenceNow: @escaping () -> NativePracticeOccurrence = { .capture() },
         wait: @escaping (Double) async throws -> Void = { milliseconds in
            if milliseconds > 0 { try await Task.sleep(nanoseconds: UInt64(milliseconds * 1_000_000)) }
            try Task.checkCancellation()
         }) {
        let carry = carry ?? NativeArcadeCheckpointCarry()
        self.isCurrent = isCurrent; self.credit = credit; self.carry = carry
        self.provider = provider ?? carry.provider()
        self.automaticallyTimeOut = automaticallyTimeOut
        self.now = nowMilliseconds; self.occurrenceNow = occurrenceNow; self.wait = wait
        #if os(iOS)
        self.driver = driver ?? ApplePracticeAudioDriver()
        #else
        precondition(driver != nil, "A test driver is required outside iOS")
        self.driver = driver!
        #endif
    }

    func install(_ selection: NativeArcadeCheckpointSelection) {
        guard self.selection == nil, selection.isSupported, isCurrent(),
              let game = Game.definitions[selection.gameID] else { return }
        self.selection = selection; self.game = game
        title = selection.bare.text
        buttonLabel = "Say " + title + " to " + game.action
        status = idleStatus
        if selection.voiceOn, selection.volume > 0 {
            let provider = self.provider
            warmedNarration = Task { @MainActor [weak self] in
                async let reason = provider.lead(game.reason, selection: selection)
                async let go = provider.handoff(selection: selection)
                let result = await Narration(reason: reason, go: go)
                self?.prefetchFinished = true
                return result
            }
        }
        updateButton()
    }

    /// The board reports only active gameplay and optional ask eligibility.
    /// Fine-grained note or gesture callbacks never themselves nominate speech.
    func poll(playing: Bool, eligible: Bool = true, legMillisecondsLeft: Double? = nil) {
        let playing = playing && isCurrent()
        boardPlaying = playing; boardEligible = eligible
        if !playing { cancelTurn() }
        let time = now()
        expireListen(at: time)
        let due = schedule.poll(at: time, playing: playing && selection != nil, canAsk: eligibleNow,
                                remainingInStage: legMillisecondsLeft, reasonHeard: reasonHeard)
        updatePower()
        if due { beginTurn() }
        updateButton()
    }

    func tap() {
        // The source button bypasses only the automatic near-finish check.
        guard eligibleNow else { return }
        beginTurn()
    }

    /// Checks the live route synchronously before any gameplay sound starts.
    /// The next ask waits only for an already playing sound's real tail.
    func willPlayGameAudio(duration: TimeInterval) -> Bool {
        guard !suppressesGameAudio else { return false }
        if duration.isFinite, duration > 0 {
            gameplayAudioEnd = max(gameplayAudioEnd, now() + duration * 1_000)
        }
        return true
    }

    func cancel() { poll(playing: false) }

    func interrupt() async {
        cancel()
        await turn?.value
    }

    func stageChanged() {
        cancel()
        // These two pages clear the previous power at startFloor/startSong.
        schedule.stageChanged(clearPower: selection?.gameID == "stack" || selection?.gameID == "tiles")
        updatePower()
    }

    func clearPower() {
        schedule.clearEarnedPower()
        updatePower()
        updateButton()
    }

    private var idleStatus: String { title.isEmpty ? "" : "Say " + title + " when Echo asks" }
    private var eligibleNow: Bool {
        boardPlaying && boardEligible && selection != nil && !isAsking
            && schedule.powerRemaining == 0 && !microphoneUnavailable && isCurrent()
    }

    private func updateButton() {
        let allowed = eligibleNow
        if canTap != allowed { canTap = allowed }
    }

    private func updatePower() {
        let previous = powerRemaining
        if previous != schedule.powerRemaining { powerRemaining = schedule.powerRemaining }
        if previous > 0, powerRemaining == 0, !isAsking { status = idleStatus }
    }

    private func beginTurn() {
        guard let selection, let game, eligibleNow else { return }
        let id = UUID()
        schedule.begin()
        turnID = id
        heard = nil
        phase = .asking; status = "Listen to Echo…"
        updateButton()
        turn = Task { [weak self] in await self?.performTurn(id, selection: selection, game: game) }
    }

    private func cancelTurn() {
        guard let turn, !turn.isCancelled else { return }
        turn.cancel()
        if audioRouteTouched { driver.stopPlayback() }
        resolveListen(false)
    }

    private func live(_ id: UUID) -> Bool {
        turnID == id && boardPlaying && isCurrent() && !Task.isCancelled
    }

    private func performTurn(_ id: UUID, selection: NativeArcadeCheckpointSelection, game: Game) async {
        driver.setInterruptionHandler { [weak self] in self?.cancelTurn() }
        let result = await modelAndListen(id, selection: selection, game: game)
        listenTimer?.cancel(); listenTimer = nil
        let transcript: String
        let occurrence: NativePracticeOccurrence?
        if audioRouteTouched {
            transcript = await driver.closeMicrophone()
            occurrence = occurrenceNow()
            // An interrupted turn still owes the route this same settle time
            // before the board or a checkpoint can start playing its audio.
            let wait = self.wait
            await Task { @MainActor in try? await wait(200) }.value
        } else { transcript = ""; occurrence = nil }
        audioRouteTouched = false
        driver.setInterruptionHandler(nil)

        var outcome = NativeArcadePowerSchedule.Outcome.cancelled
        if live(id) {
            switch result {
            case .sound(let useRecognition):
                let vetoed = useRecognition && PracticeWordVerdict.evaluate(
                    transcript: transcript, sound: selection.sound, word: selection.bare.text,
                    level: "isolation", position: selection.bare.position) == .fail
                outcome = .unanswered
                if !vetoed {
                    let value = GameSayingCredit(gateID: id, sequence: 1, gameID: selection.gameID,
                                                 sound: selection.sound, word: selection.bare.text,
                                                 position: selection.bare.position)
                    // The power follows the accepted sound. Saving the rep is
                    // best effort, as in the original Arcade games.
                    outcome = .earned
                    try? await NativePracticeOccurrenceScope.$current.withValue(occurrence) { try await credit(value) }
                }
            case .silence: outcome = .unanswered
            case .microphoneUnavailable:
                microphoneUnavailable = true
                outcome = .unanswered
            case .cancelled: break
            }
        }
        if !live(id) { outcome = .cancelled }
        schedule.complete(outcome, duration: game.duration, at: now())
        updatePower()
        if outcome == .earned { powerRevision += 1 }
        turnID = nil
        turn = nil
        phase = .idle
        status = outcome == .earned ? game.earned : microphoneUnavailable ? "Microphone is off" : idleStatus
        updateButton()
    }

    private func modelAndListen(_ id: UUID, selection: NativeArcadeCheckpointSelection, game: Game) async -> Heard {
        guard live(id) else { return .cancelled }
        // The grown-up already approved the charge-up mic for this visit.
        let permitted = await driver.requestPermissions()
        guard live(id) else { return .cancelled }
        guard permitted else { return .microphoneUnavailable }
        do {
            try await wait(max(0, gameplayAudioEnd - now()))
            guard live(id) else { return .cancelled }
            if selection.voiceOn, selection.volume > 0 {
                await playAsk(id, selection: selection, game: game)
                guard live(id) else { return .cancelled }
                try await wait(selection.voiceTailMilliseconds)
            }
            guard live(id) else { return .cancelled }
            detector = .init(family: selection.family, requiresWord: false, roomFloor: carry.roomFloor, timing: .livePower)
            audioRouteTouched = true
            try await driver.openMicrophone(onFrame: { [weak self] frame in self?.receive(frame, from: id) },
                                            onInterruption: { [weak self] in self?.cancelTurn() })
        } catch { return live(id) ? .microphoneUnavailable : .cancelled }
        guard live(id) else { return .cancelled }

        phase = .listening; status = "Say " + selection.bare.text + "!"
        listenDeadline = now() + 8_000
        if automaticallyTimeOut {
            listenTimer = Task { [weak self] in
                do { try await Task.sleep(nanoseconds: 8_000_000_000) } catch { return }
                guard let self, self.live(id) else { return }
                self.expireListen(at: self.now())
            }
        }
        // The live powers use this original optional isolation hint. Local
        // recognition may veto a clearly unrelated word, never replace a burst.
        let recognition = await driver.startRecognition(words: [selection.bare.text], maxMilliseconds: 8_000)
        guard live(id) else { return .cancelled }
        let qualified = await waitForListen()
        guard live(id) else { return .cancelled }
        phase = .checking; status = qualified ? "Listening check…" : idleStatus
        return qualified ? .sound(useRecognition: recognition) : .silence
    }

    private func playAsk(_ id: UUID, selection: NativeArcadeCheckpointSelection, game: Game) async {
        guard live(id) else { return }
        let couldRetryPrefetch = prefetchFinished
        let prefetched = await warmedNarration?.value
        guard live(id) else { return }
        if !reasonHeard {
            let reason: PracticePrompt?
            if let loaded = prefetched?.reason { reason = loaded }
            else if couldRetryPrefetch { reason = await provider.lead(game.reason, selection: selection) }
            else { reason = nil }
            if let reason, live(id) {
                audioRouteTouched = true
                do { try await driver.playPrompt(reason); if live(id) { reasonHeard = true } }
                catch {
                    // Only this authored reason may use an installed voice
                    // after playback refusal. The sound itself stays recorded.
                    if live(id) {
                        let fallback = PracticePrompt(text: game.reason, systemSpeech: .init(text: game.reason), volume: selection.volume)
                        if (try? await driver.playPrompt(fallback)) != nil, live(id) { reasonHeard = true }
                    }
                }
            }
        }
        guard live(id) else { return }
        if let take = provider.bareTake(selection: selection) {
            audioRouteTouched = true
            _ = try? await driver.playPrompt(take)
        }
        guard live(id), let go = prefetched?.go else { return }
        audioRouteTouched = true
        _ = try? await driver.playPrompt(go)
    }

    private func waitForListen() async -> Bool {
        if let heard { return heard }
        return await withCheckedContinuation { heardContinuation = $0 }
    }

    private func receive(_ frame: PracticeAcousticFrame, from id: UUID) {
        guard phase == .listening, heard == nil, live(id) else { return }
        if now() >= listenDeadline { expireListen(at: now()); return }
        let nomination = detector.ingest(frame)
        carry.observeFloor(detector.roomFloor)
        if detector.listeningReady, status.hasPrefix("Say ") { status = "I'm listening…" }
        if nomination != nil { resolveListen(true) }
    }

    private func expireListen(at time: Double) {
        guard phase == .listening, heard == nil, time >= listenDeadline else { return }
        resolveListen(detector.hasBurst)
    }

    private func resolveListen(_ qualified: Bool) {
        guard heard == nil else { return }
        heard = qualified
        let callback = heardContinuation
        heardContinuation = nil
        callback?.resume(returning: qualified)
    }
}
