import Foundation

/// Native UI adapter for one practice attempt. The host retains this session,
/// observes `onChange`, and handles the result in its existing practice flow.
/// No persistence, analytics, reward, game unlock or audio retention lives here.
@MainActor
public final class PracticeTurnSession {
    public private(set) var machine: PracticeTurnMachine
    public private(set) var acoustics: PracticeAcoustics
    public var onChange: ((PracticeTurnMachine) -> Void)?
    public var onResult: ((PracticeAttemptResult) -> Void)?
    private let driver: PracticeAudioDriver
    private let prompt: PracticePrompt
    private let now: () -> Double
    private let automaticClock: Bool
    private var ticker: Task<Void, Never>?
    private var permissionTask: Task<Void, Never>?
    private var playbackTask: Task<Void, Never>?
    private var audioOperations: Task<Void, Never>?

    public init(
        target: PracticeTarget,
        prompt: PracticePrompt,
        requiredReps: Int = 5,
        driver: PracticeAudioDriver,
        automaticallyAdvance: Bool = true,
        nowMilliseconds: @escaping () -> Double = { ProcessInfo.processInfo.systemUptime * 1_000 }
    ) {
        self.machine = PracticeTurnMachine(target: target, requiredReps: requiredReps)
        self.acoustics = PracticeAcoustics()
        self.driver = driver
        self.prompt = prompt
        self.now = nowMilliseconds
        self.automaticClock = automaticallyAdvance
    }

    /// Start only from the grown-up's yes, after presenting the existing mic
    /// promise. A completed/cancelled instance never starts another attempt.
    public func startAfterGrownUpConsent() {
        guard machine.phase == .idle else { return }
        driver.setInterruptionHandler { [weak self] in self?.pause() }
        acoustics.beginAttempt(requiredReps: machine.requiredReps)
        dispatch(.start)
        if automaticClock {
            ticker = Task { [weak self] in
                while !Task.isCancelled {
                    do { try await Task.sleep(nanoseconds: 16_666_667) } catch { return }
                    guard let self else { return }
                    self.advance()
                    if [.completed, .cancelled].contains(self.machine.phase) { return }
                }
            }
        }
    }

    public func advance() { dispatch(.tick) }
    public func pause() { dispatch(.pause) }
    public func setForeground(_ value: Bool) { dispatch(.foreground(value)) }
    /// Foreground recovery is deliberately a separate tap. setForeground(true)
    /// alone neither plays a model nor requests/opens the microphone.
    public func resumeAfterTap() { dispatch(.resume) }
    public func replayPromptAfterTap() { dispatch(.replayPrompt) }
    public func retryQuietAfterTap() {
        guard [.quiet, .microphoneUnavailable].contains(machine.phase) else { return }
        acoustics.beginAttempt(requiredReps: machine.requiredReps)
        dispatch(.retryQuiet)
    }

    /// Await this before navigation or handing audio ownership to another game.
    /// Pending authorization cannot open the mic; pending opens are followed by
    /// their own close before this returns.
    public func cancelAndClose() async {
        dispatch(.cancel)
        permissionTask?.cancel()
        playbackTask?.cancel()
        ticker?.cancel()
        await audioOperations?.value
        driver.setInterruptionHandler(nil)
    }

    private func dispatch(_ event: PracticeTurnMachine.Event) {
        let effects = machine.send(event, atMilliseconds: now())
        // UI observers can synchronously pause or leave. Finish this event's
        // effects first, so that observer cannot revive its old permission job.
        for effect in effects { execute(effect) }
        onChange?(machine)
    }

    private func execute(_ effect: PracticeTurnMachine.Effect) {
        switch effect {
        case let .requestPermissions(token):
            permissionTask?.cancel()
            permissionTask = Task { [weak self] in
                guard let self, token == self.machine.generation, self.machine.phase == .permission else { return }
                let granted = await self.driver.requestPermissions()
                guard !Task.isCancelled else { return }
                self.dispatch(.permission(token: token, granted: granted))
            }
        case let .openMicrophone(token, measuring):
            let previous = audioOperations
            audioOperations = Task { [weak self] in
                await previous?.value
                guard let self, token == self.machine.generation else { return }
                do {
                    try await self.driver.openMicrophone(
                        onFrame: { [weak self] frame in self?.receive(frame, token: token, measuring: measuring) },
                        onInterruption: { [weak self] in
                            guard let self, token == self.machine.generation else { return }
                            self.pause()
                        }
                    )
                    guard token == self.machine.generation else {
                        // A route/permission completion from an abandoned open
                        // must release its input before the next operation runs.
                        _ = await self.driver.closeMicrophone()
                        return
                    }
                    // Opening a route may take time. Calibration belongs to
                    // running input, never to permission/engine startup time.
                    if measuring { self.acoustics.beginRoomMeasurement(atMilliseconds: self.now()) }
                    else { self.acoustics.beginWindow(atMilliseconds: self.now()) }
                    self.dispatch(.opened(token: token))
                    if !measuring, self.machine.phase == .listening,
                       self.machine.recognitionRemainingMilliseconds > 0 {
                        _ = await self.driver.startRecognition(
                            words: [self.machine.target.word.lowercased()],
                            maxMilliseconds: self.machine.recognitionRemainingMilliseconds
                        )
                    }
                } catch {
                    self.dispatch(.microphoneFailed(token: token))
                }
            }
        case let .closeMicrophone(token):
            permissionTask?.cancel()
            let previous = audioOperations
            audioOperations = Task { [weak self] in
                await previous?.value
                guard let self else { return }
                let transcript = await self.driver.closeMicrophone()
                self.acoustics.endRoomMeasurement()
                self.dispatch(.closed(token: token, transcript: transcript))
            }
        case let .playPrompt(token):
            playbackTask?.cancel()
            playbackTask = Task { [weak self] in
                guard let self, token == self.machine.generation else { return }
                // A missing local voice falls through, as the existing bounded
                // playback does. It cannot keep the child waiting forever.
                do { try await self.driver.playPrompt(self.prompt) }
                catch is CancellationError {
                    if token == self.machine.generation, self.machine.phase == .prompting { self.pause() }
                    return
                } catch {}
                guard !Task.isCancelled else { return }
                self.dispatch(.promptEnded(token: token))
            }
        case .stopPlayback:
            playbackTask?.cancel()
            driver.stopPlayback()
        case .resetBurst:
            acoustics.resetBurst()
        case let .finishPending(token):
            let observation = acoustics.finishPending(atMilliseconds: now())
            dispatch(.pendingFinished(token: token, countedRep: observation.countedRep,
                                      shapeVerdict: verdict(observation.shape)))
        case let .commit(result):
            ticker?.cancel()
            onResult?(result)
        }
    }

    private func receive(_ frame: PracticeAcousticFrame, token: UInt64, measuring: Bool) {
        guard token == machine.generation else { return }
        if measuring {
            guard machine.phase == .measuringRoom else { return }
            if acoustics.measureRoom(frame) { dispatch(.roomMeasured(token: token)) }
        } else {
            guard machine.phase == .listening else { return }
            let observation = acoustics.process(frame)
            dispatch(.acoustic(token: token, countedRep: observation.countedRep,
                               ready: observation.listeningReady, shapeVerdict: verdict(observation.shape)))
        }
    }

    private func verdict(_ shape: PracticeShapeSnapshot) -> PracticeWordVerdict {
        PracticeWordVerdict(rawValue: shape.verdict(for: machine.target.sound).rawValue) ?? .unknown
    }

    deinit {
        ticker?.cancel()
        permissionTask?.cancel()
        playbackTask?.cancel()
    }
}
