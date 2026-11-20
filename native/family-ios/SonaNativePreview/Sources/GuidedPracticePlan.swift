import Foundation
import SonaSpeechCore

/// Immutable input from the original rules, never an independently selected
/// target. The host must retain its child/target snapshot for isCurrent checks.
struct GuidedPracticePlan {
    let content: PracticeFlowContent
    let masteredRung: Int
    let stepNext: PracticeFlowContent?
    let requiredReps: Int
    let demoReplay: Bool
    let isDaily: Bool
    let alreadyRinged: Bool
    let voiceID: String
    let volume: Float
    let voiceOn: Bool
    let gameTitle: String
    let humanClipsEnabled: Bool
    let praiseLine: String?

    init(content: PracticeFlowContent, masteredRung: Int, stepNext: PracticeFlowContent? = nil,
         requiredReps: Int = 5, demoReplay: Bool = false, isDaily: Bool = false,
         alreadyRinged: Bool = false, voiceID: String = "", volume: Float = 0.8,
         voiceOn: Bool = true, gameTitle: String, humanClipsEnabled: Bool = true,
         praiseLine: String? = nil) {
        self.content = content; self.masteredRung = masteredRung; self.stepNext = stepNext
        self.requiredReps = requiredReps; self.demoReplay = demoReplay; self.isDaily = isDaily
        self.alreadyRinged = alreadyRinged; self.voiceID = voiceID; self.volume = volume
        self.voiceOn = voiceOn; self.gameTitle = gameTitle
        self.humanClipsEnabled = humanClipsEnabled; self.praiseLine = praiseLine
    }

    /// All four original rungs now use the approved local turn transport.
    /// Word/sentence reps require each saying's own position-aware HEAR2 pass;
    /// recognition denial, unknown input and missing canonical data stay closed.
    var hasSupportedEvidence: Bool {
        PracticeRung.allCases.contains(content.rung)
            && stepNext.map { PracticeRung.allCases.contains($0.rung) } != false
    }
}

enum GuidedPracticeVoiceMode: Equatable { case initial, replay, slow }
enum GuidedPracticeVoiceRequest {
    case turn(PracticeFlowMachine.Turn, GuidedPracticeVoiceMode)
    case feedback(PracticeFlowMachine.Feedback)
    case quietNotice
}

@MainActor protocol GuidedPracticePromptProviding {
    func prepare(_ request: GuidedPracticeVoiceRequest, plan: GuidedPracticePlan) async throws -> PracticePrompt
}
