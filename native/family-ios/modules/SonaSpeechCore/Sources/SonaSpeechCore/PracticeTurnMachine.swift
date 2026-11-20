import Foundation

public struct PracticeTarget: Equatable, Sendable {
    public let sound: String
    public let word: String
    public let level: String
    public let sentence: String
    public let position: String

    public init(sound: String, word: String, level: String, sentence: String = "", position: String = "") {
        self.sound = sound
        self.word = word
        self.level = level
        self.sentence = sentence
        self.position = position
    }
}

/// A voiced practice attempt, rather than a clinical assessment. Games/books
/// must use their separate play-rep ledger; this type never writes either one.
public struct PracticeAttemptResult: Equatable, Sendable {
    public let reps: Int
    public let verdict: PracticeWordVerdict
    public let interrupted: Bool
}

/// Deterministic clock-driven turn, ported from public/charge.html:427–480,
/// 715–725, 1730–2080 and 2096–2128. Times are monotonic milliseconds.
/// The acoustic detector, not a transcript or a deadline, creates each rep.
public struct PracticeTurnMachine {
    public enum Phase: String, Equatable, Sendable {
        case idle, permission, openingRoom, measuringRoom, closing, settlingOutput
        case prompting, quietTail, openingMicrophone, listening, finishingEvidence
        case quiet, microphoneUnavailable, paused, completed, cancelled
    }

    public enum Effect: Equatable {
        case requestPermissions(token: UInt64)
        case openMicrophone(token: UInt64, measuringRoom: Bool)
        case closeMicrophone(token: UInt64)
        case playPrompt(token: UInt64)
        case stopPlayback
        case resetBurst
        case finishPending(token: UInt64)
        case commit(PracticeAttemptResult)
    }

    public enum Event {
        case start
        case permission(token: UInt64, granted: Bool)
        case opened(token: UInt64)
        case microphoneFailed(token: UInt64)
        case roomMeasured(token: UInt64)
        case promptEnded(token: UInt64)
        case acoustic(token: UInt64, countedRep: Bool, ready: Bool, shapeVerdict: PracticeWordVerdict)
        case pendingFinished(token: UInt64, countedRep: Bool, shapeVerdict: PracticeWordVerdict)
        case verifiedSaying(token: UInt64, accepted: Bool)
        case wordCheckUnavailable(token: UInt64)
        case closed(token: UInt64, transcript: String)
        case tick
        case pause
        case foreground(Bool)
        case resume
        case retryQuiet
        case replayPrompt
        case cancel
    }

    private enum AfterClose { case prompt, outcome, pause, cancel, unavailable }
    public let target: PracticeTarget
    public let requiredReps: Int
    public private(set) var phase: Phase = .idle
    public private(set) var generation: UInt64 = 0
    public private(set) var reps = 0
    public private(set) var listeningReady = false
    public private(set) var activeListeningMilliseconds: Double = 0
    public private(set) var recognitionRemainingMilliseconds: Double = 15_000
    public private(set) var result: PracticeAttemptResult?
    public private(set) var isForeground = true
    public private(set) var interrupted = false
    public private(set) var wordCheckIssue = false
    public var requiresPerSayingVerification: Bool { target.level == "word" || target.level == "sentence" }
    private var foregroundPausePhase: Phase = .idle
    private var afterClose: AfterClose = .prompt
    private var deadline: Double = .infinity
    private var windowStarted: Double?
    private var shapeVerdict: PracticeWordVerdict = .unknown
    private var transcripts: [String] = []
    private var lastTime: Double = 0
    private var earnedAt: Double?
    private var settledDestination: AfterClose = .prompt
    private var authorized = false
    private var pendingResult: PracticeAttemptResult?
    private var pendingDestination: AfterClose = .outcome

    public init(target: PracticeTarget, requiredReps: Int = 5) {
        precondition(requiredReps > 0)
        self.target = target
        self.requiredReps = requiredReps
    }

    /// Bad clocks cannot fast-forward an attempt or run its budget backwards.
    public mutating func send(_ event: Event, atMilliseconds time: Double) -> [Effect] {
        guard time.isFinite, time >= lastTime else { return [] }
        lastTime = time
        switch event {
        case .start:
            guard phase == .idle, isForeground else { return [] }
            phase = .permission
            return [.requestPermissions(token: nextGeneration())]
        case let .permission(token, granted):
            guard matches(token, .permission) else { return [] }
            authorized = granted
            guard granted else { phase = .microphoneUnavailable; return [] }
            return openRoom()
        case let .opened(token):
            guard token == generation, isForeground else { return [] }
            if phase == .openingRoom {
                phase = .measuringRoom
                // 600 ms startup + 300 ms known-silent reading + 400 ms spare.
                deadline = time + 1_300
            } else if phase == .openingMicrophone {
                phase = .listening
                windowStarted = time
                deadline = time + min(20_000 - activeListeningMilliseconds,
                                      earnedAt.map { max(0, $0 - activeListeningMilliseconds) } ?? .infinity)
            }
            return []
        case let .roomMeasured(token):
            guard matches(token, .measuringRoom) else { return [] }
            return close(to: .prompt, at: time)
        case let .microphoneFailed(token):
            guard token == generation,
                  [.openingRoom, .measuringRoom, .openingMicrophone, .listening, .finishingEvidence].contains(phase) else { return [] }
            interrupted = true
            return close(to: .unavailable, at: time)
        case let .promptEnded(token):
            guard matches(token, .prompting) else { return [] }
            phase = .quietTail
            deadline = time + 250
            return []
        case let .acoustic(token, counted, ready, shape):
            guard matches(token, .listening) else { return [] }
            listeningReady = ready
            shapeVerdict = shape
            if !requiresPerSayingVerification, counted, ready, reps < requiredReps {
                reps += 1
                if reps == requiredReps {
                    earnedAt = activeMs(at: time) + 350
                    deadline = min(deadline, time + 350)
                }
            }
            return []
        case let .verifiedSaying(token, accepted):
            guard matches(token, .listening), requiresPerSayingVerification else { return [] }
            if !accepted { wordCheckIssue = true; return [] }
            guard reps < requiredReps else { return [] }
            reps += 1
            if reps == requiredReps {
                earnedAt = activeMs(at: time) + 350
                deadline = min(deadline, time + 350)
            }
            return []
        case let .wordCheckUnavailable(token):
            guard matches(token, .listening), requiresPerSayingVerification else { return [] }
            wordCheckIssue = true
            return close(to: .outcome, at: time)
        case let .pendingFinished(token, counted, shape):
            guard matches(token, .finishingEvidence) else { return [] }
            shapeVerdict = shape
            if !requiresPerSayingVerification, counted, reps < requiredReps {
                reps += 1
                if reps == requiredReps, pendingDestination == .prompt { earnedAt = activeMs(at: time) + 350 }
            }
            return close(to: pendingDestination, at: time)
        case let .closed(token, transcript):
            guard matches(token, .closing) else { return [] }
            // Permission, frames, partials and playback from an older generation
            // can never reach this point. Cancellation discards its transcript.
            if !requiresPerSayingVerification, afterClose != .cancel, !transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                transcripts.append(transcript)
            }
            if afterClose == .pause {
                phase = .paused
                return []
            }
            if afterClose == .cancel { phase = .cancelled; transcripts = []; return [] }
            if afterClose == .unavailable { phase = .microphoneUnavailable; return [] }
            if afterClose == .outcome {
                guard reps > 0 else { enterQuiet(); return [] }
                let wordVerdict = PracticeWordVerdict.evaluate(
                    transcript: transcripts.joined(separator: " "), sound: target.sound,
                    word: target.word, level: target.level, frame: target.sentence, position: target.position
                )
                // Native words have already passed their own fresh on-device
                // checks. Never approve several acoustic bursts with one
                // round-wide transcript or fall back from unknown to shape.
                let verdict: PracticeWordVerdict = requiresPerSayingVerification ? .pass : wordVerdict == .unknown ? shapeVerdict : wordVerdict
                guard verdict != .unknown else { enterQuiet(); return [] }
                let value = PracticeAttemptResult(reps: reps, verdict: verdict, interrupted: interrupted)
                pendingResult = value
                phase = .settlingOutput
                settledDestination = .outcome
                deadline = time + 200
                transcripts = []
                return []
            }
            phase = .settlingOutput
            settledDestination = afterClose
            deadline = time + 200
            return []
        case .tick:
            guard isForeground, time >= deadline else { return [] }
            switch phase {
            case .measuringRoom: return close(to: .prompt, at: time)
            case .settlingOutput:
                if settledDestination == .outcome, let value = pendingResult {
                    result = value
                    pendingResult = nil
                    phase = .completed
                    return [.commit(value)]
                }
                guard settledDestination == .prompt else { return [] }
                phase = .prompting
                return [.playPrompt(token: nextGeneration())]
            case .quietTail: return openListening()
            case .listening:
                pendingDestination = .outcome
                phase = .finishingEvidence
                listeningReady = false
                return [.finishPending(token: generation)]
            default: return []
            }
        case .pause:
            return pause(at: time)
        case let .foreground(value):
            isForeground = value
            return value ? [] : pause(at: time)
        case .resume:
            guard phase == .paused, isForeground else { return [] }
            if foregroundPausePhase == .permission || !authorized {
                phase = .permission
                return [.requestPermissions(token: nextGeneration())]
            }
            if [.openingRoom, .measuringRoom].contains(foregroundPausePhase) { return openRoom() }
            if foregroundPausePhase == .quiet { phase = .quiet; return [] }
            if foregroundPausePhase == .microphoneUnavailable { phase = .microphoneUnavailable; return [] }
            if foregroundPausePhase == .settlingOutput, pendingResult != nil {
                phase = .settlingOutput
                settledDestination = .outcome
                deadline = time + 200
                return []
            }
            if [.prompting, .settlingOutput, .quietTail].contains(foregroundPausePhase) {
                // A cut-off model is replayed in full. A listened-to try keeps
                // its reps and remaining active budget when the window reopens.
                phase = .settlingOutput
                settledDestination = .prompt
                deadline = time + 200
                return []
            }
            phase = .quietTail
            deadline = time + 250
            return [.resetBurst]
        case .retryQuiet:
            guard [.quiet, .microphoneUnavailable].contains(phase), isForeground else { return [] }
            reps = 0
            earnedAt = nil
            activeListeningMilliseconds = 0
            recognitionRemainingMilliseconds = 15_000
            transcripts = []
            shapeVerdict = .unknown
            result = nil
            interrupted = false
            wordCheckIssue = false
            // The host starts a fresh detector attempt for this effect.
            if !authorized {
                phase = .permission
                return [.resetBurst, .requestPermissions(token: nextGeneration())]
            }
            phase = .settlingOutput
            settledDestination = .prompt
            deadline = time + 200
            return [.resetBurst]
        case .replayPrompt:
            guard [.listening, .quietTail, .openingMicrophone].contains(phase), isForeground else { return [] }
            if reps > 0 { interrupted = true }
            if phase == .listening {
                pendingDestination = .prompt
                phase = .finishingEvidence
                listeningReady = false
                return [.finishPending(token: generation)]
            }
            return close(to: .prompt, at: time)
        case .cancel:
            guard ![.cancelled, .completed].contains(phase) else { return [] }
            if phase == .closing {
                afterClose = .cancel
                return [.stopPlayback, .resetBurst]
            }
            return close(to: .cancel, at: time)
        }
    }

    private func matches(_ token: UInt64, _ expected: Phase) -> Bool { token == generation && phase == expected }
    private mutating func nextGeneration() -> UInt64 { generation &+= 1; return generation }
    private func activeMs(at time: Double) -> Double {
        activeListeningMilliseconds + (windowStarted.map { max(0, time - $0) } ?? 0)
    }
    private mutating func openRoom() -> [Effect] {
        phase = .openingRoom
        return [.openMicrophone(token: nextGeneration(), measuringRoom: true)]
    }
    private mutating func openListening() -> [Effect] {
        phase = .openingMicrophone
        listeningReady = false
        return [.resetBurst, .openMicrophone(token: nextGeneration(), measuringRoom: false)]
    }
    private mutating func close(to destination: AfterClose, at time: Double) -> [Effect] {
        if let started = windowStarted {
            let spent = max(0, time - started)
            activeListeningMilliseconds = min(20_000, activeListeningMilliseconds + spent)
            recognitionRemainingMilliseconds = max(0, recognitionRemainingMilliseconds - spent)
            windowStarted = nil
        }
        afterClose = destination
        phase = .closing
        listeningReady = false
        return [.stopPlayback, .resetBurst, .closeMicrophone(token: nextGeneration())]
    }
    private mutating func pause(at time: Double) -> [Effect] {
        guard ![.idle, .paused, .completed, .cancelled].contains(phase) else { return [] }
        if phase == .closing, [.pause, .cancel].contains(afterClose) { return [] }
        foregroundPausePhase = phase == .closing ? (afterClose == .outcome ? .listening : .prompting) : phase
        interrupted = true
        if let value = pendingResult {
            pendingResult = PracticeAttemptResult(reps: value.reps, verdict: value.verdict, interrupted: true)
        }
        if phase == .closing {
            afterClose = .pause
            return [.stopPlayback, .resetBurst]
        }
        return close(to: .pause, at: time)
    }
    private mutating func enterQuiet() {
        phase = .quiet
        listeningReady = false
        transcripts = []
    }
}
