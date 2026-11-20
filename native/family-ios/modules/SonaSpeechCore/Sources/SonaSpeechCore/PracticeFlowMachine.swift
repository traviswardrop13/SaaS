import Foundation

/// The decision layer around charge.html's existing flow()/burstAndVerify().
/// A host supplies the already-selected content and any existing stepDown
/// result. This reducer never selects a sound/word, runs audio, persists data,
/// calculates a verdict, changes a goal, or grants game access itself.
public struct PracticeFlowMachine {
    public enum Phase: Equatable, Sendable { case idle, awaitingTurn, quiet, ready, cancelled }
    public enum Stage: Equatable, Sendable { case initial, retry, stepDown }

    /// Capture the whole ID in a PracticeTurnSession callback. A late result
    /// from an older flow cannot become this flow's first attempt.
    public struct TurnID: Equatable, Sendable {
        public let flow: UUID
        public let sequence: UInt64
    }
    public struct Turn: Equatable, Sendable {
        public let id: TurnID
        public let stage: Stage
        public let content: PracticeFlowContent
        public let requiredReps: Int
        public let prompt: String
    }
    public struct VerifiedAttempt: Equatable, Sendable {
        public let id: TurnID
        public let content: PracticeFlowContent
        public let result: PracticeAttemptResult
    }
    public enum Feedback: Equatable, Sendable {
        /// Host uses its existing Sona.praiseLine selection, not new text.
        case stepDownPraise
        /// PracticeFlowContent.finalFailurePrompt, before the game launch.
        case finalFailure
        /// Existing completion chime, then successfulLaunchPrompt after its gap.
        case successfulLaunch
    }
    public struct Ready: Equatable, Sendable {
        public let flowID: UUID
        public let content: PracticeFlowContent
        public let verifiedReps: Int
        public let lastVerdict: PracticeWordVerdict
        public let advanceRing: Bool
        public let markDailyReady: Bool
        /// The source records a practice session only outside a daily run.
        public let practiceSessionTries: Int?
        /// Ordered existing feedback. The host awaits it before navigating.
        public let feedback: [Feedback]

        /// flow() awaits coaching/praise before practiceReady, ring and ready
        /// writes. Cancellation/child ownership must be re-checked afterwards.
        public var feedbackBeforeBookkeeping: [Feedback] {
            feedback.filter { $0 != .successfulLaunch }
        }
        /// launchGame() then plays its completion chime, waits the existing
        /// after-chime gap, and says the successful launch line only on pass.
        public var feedbackAfterBookkeeping: [Feedback] {
            feedback.filter { $0 == .successfulLaunch }
        }
    }
    public enum Effect: Equatable, Sendable {
        case beginTurn(Turn)
        /// Exactly one ledger request per accepted, voiced, known verdict.
        /// Host applies existing logAttempt + bumpReps (+ run.tries for daily).
        case saveVerifiedAttempt(VerifiedAttempt)
        case recordRungWin(PracticeFlowContent)
        case showQuiet(PracticeFlowContent.QuietMessage)
        /// Host applies ring/ready/session bookkeeping once before its existing
        /// game handoff. Re-check phase and child ownership after awaiting
        /// feedback; cancel can still stop navigation. This event saves nothing.
        case readyForGame(Ready)
        case cancelTurn(TurnID)
    }
    public enum Event {
        case start
        case completed(TurnID, PracticeAttemptResult)
        /// From the session's quiet/microphoneUnavailable phase, which emits
        /// no result. This never creates an attempt from a timeout.
        case quiet(TurnID, microphoneUnavailable: Bool)
        case retryQuiet
        case cancel
    }
    public enum ConfigurationError: Error { case invalidRepetitionCount, invalidStepDown }

    public private(set) var phase: Phase = .idle
    public private(set) var currentTurn: Turn?
    public private(set) var anyReps = false
    public private(set) var verifiedReps = 0
    public private(set) var lastVerdict: PracticeWordVerdict = .unknown
    private let initialContent: PracticeFlowContent
    private let masteredRung: Int
    private let stepNext: PracticeFlowContent?
    private let requiredReps: Int
    private let demoReplay: Bool
    private let isDaily: Bool
    private let alreadyRinged: Bool
    private let flowID: UUID
    private var sequence: UInt64 = 0

    public init(content: PracticeFlowContent, masteredRung: Int,
                stepNext: PracticeFlowContent? = nil, requiredReps: Int = 5,
                demoReplay: Bool = false, alreadyRinged: Bool = false,
                isDaily: Bool = false, flowID: UUID = UUID()) throws {
        guard requiredReps > 0 else { throw ConfigurationError.invalidRepetitionCount }
        if let stepNext {
            guard stepNext.target.sound.uppercased() == content.target.sound.uppercased(),
                  stepNext.rung.index < content.rung.index else {
                throw ConfigurationError.invalidStepDown
            }
        }
        self.initialContent = content
        self.masteredRung = masteredRung
        self.stepNext = stepNext
        self.requiredReps = requiredReps
        self.demoReplay = demoReplay
        self.alreadyRinged = alreadyRinged
        self.isDaily = isDaily
        self.flowID = flowID
    }

    public mutating func send(_ event: Event) -> [Effect] {
        switch event {
        case .start:
            guard phase == .idle else { return [] }
            return [begin(stage: .initial, content: initialContent)]

        case let .completed(id, result):
            guard phase == .awaitingTurn, let turn = currentTurn, turn.id == id else { return [] }
            // Defensive as well as source-equivalent: a transcript, a deadline
            // or an unknown acoustic result cannot manufacture saved practice.
            guard result.reps > 0, result.verdict != .unknown else {
                phase = .quiet
                return [.showQuiet(PracticeFlowContent.quiet)]
            }
            anyReps = true
            verifiedReps += result.reps
            lastVerdict = result.verdict
            var effects: [Effect] = demoReplay ? [] : [
                .saveVerifiedAttempt(VerifiedAttempt(id: turn.id, content: turn.content, result: result))
            ]
            // Only the first completed burst may win a rung. A partial round,
            // a coached retry, easier target, replay demo or mercy cannot.
            if turn.stage == .initial, result.verdict == .pass,
               result.reps >= requiredReps, turn.content.rung.index >= masteredRung, !demoReplay {
                effects.append(.recordRungWin(turn.content))
            }
            if result.verdict == .fail {
                if turn.stage == .initial {
                    effects.append(begin(stage: .retry, content: turn.content))
                    return effects
                }
                if turn.stage == .retry, initialContent.rung.index > 0, let stepNext {
                    effects.append(begin(stage: .stepDown, content: stepNext))
                    return effects
                }
            }
            phase = .ready
            let feedback: [Feedback]
            if result.verdict == .fail { feedback = [.finalFailure] }
            else if turn.stage == .stepDown { feedback = [.stepDownPraise, .successfulLaunch] }
            else { feedback = [.successfulLaunch] }
            effects.append(.readyForGame(Ready(
                flowID: flowID, content: turn.content, verifiedReps: verifiedReps, lastVerdict: lastVerdict,
                advanceRing: !demoReplay && anyReps && lastVerdict != .unknown && !alreadyRinged,
                markDailyReady: isDaily,
                practiceSessionTries: !demoReplay && !isDaily ? verifiedReps : nil,
                feedback: feedback)))
            return effects

        case let .quiet(id, unavailable):
            guard phase == .awaitingTurn, currentTurn?.id == id else { return [] }
            phase = .quiet
            return [.showQuiet(unavailable ? PracticeFlowContent.microphoneUnavailable : PracticeFlowContent.quiet)]

        case .retryQuiet:
            guard phase == .quiet, let turn = currentTurn else { return [] }
            return [begin(stage: turn.stage, content: turn.content, quietReplay: true)]

        case .cancel:
            guard phase != .cancelled else { return [] }
            phase = .cancelled
            return currentTurn.map { [.cancelTurn($0.id)] } ?? []
        }
    }

    private mutating func begin(stage: Stage, content: PracticeFlowContent, quietReplay: Bool = false) -> Effect {
        sequence &+= 1
        let prompt: String
        if quietReplay {
            // burstAndVerify restores global NEED before showQuiet/sayAgain:
            // a quiet retry's spoken regular ask uses that original count,
            // even when the retry listening window still needs three.
            prompt = content.initialPrompt(requiredReps: requiredReps, includeFirstCue: false)
        } else {
            switch stage {
            case .initial: prompt = content.initialPrompt(requiredReps: requiredReps)
            case .retry: prompt = content.retryPrompt()
            case .stepDown: prompt = content.stepDownPrompt()
            }
        }
        let turn = Turn(id: TurnID(flow: flowID, sequence: sequence), stage: stage, content: content,
                        requiredReps: stage == .initial ? requiredReps : 3, prompt: prompt)
        currentTurn = turn
        phase = .awaitingTurn
        return .beginTurn(turn)
    }
}
