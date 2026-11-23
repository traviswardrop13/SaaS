import SwiftUI

struct NativeSpeechGameSelection: Decodable {
    struct Target: Decodable {
        let word, emoji, position: String
        let promptPieces: [NativeSpeechEmphasis]

        var markedWord: AttributedString {
            NativeSpeechEmphasis.formatted(promptPieces, fallback: word)
        }
    }
    let title: String
    let intro: String?
    let sayings: Int
    let targets: [Target]
    let sound, voice: String
    let voiceOn: Bool
    let soundOn: Bool?
    let isSimple: Bool?
    let volume: Float
}

/// Keeps the game scene alive between words. A native board reports one
/// completed move before the next original word is shown.
@MainActor struct NativeSayPlayRound<Board: View>: View {
    let gameID: String
    let selection: NativeSpeechGameSelection
    let isCurrent: @MainActor () -> Bool
    let credit: @MainActor (GameSayingCredit) async throws -> Void
    let onFinish: @MainActor () -> Void
    let onReplay: (@MainActor () -> Void)?
    let onExit: @MainActor () -> Void
    @ViewBuilder let board: () -> Board

    private struct Help {
        let id = UUID()
        let step: Int
        let returnPower: (Bool) -> Void
    }
    @State private var help: Help?
    @State private var acousticCarry = GameSpeechAcousticCarry()
    @State private var narration = GameSpeechNarration()
    @State private var lastHelpSwitch = -Double.infinity
    @State private var step = 0
    @State private var gateID = UUID()
    @State private var moveEarned = false
    private var finished: Bool { step >= selection.targets.count }
    private var boardEnabled: Bool { finished || (moveEarned && help == nil) }
    // Current shipping boards which implement G.play.onHelp. Hoops/Soccer
    // deliberately have none; no helper is invented for those scenes.
    private var supportsHelp: Bool {
        switch gameID {
        case "cake", "balloon", "castle", "bridge", "fishtank", "monster", "flower",
             "lighthouse", "gifts", "rocket", "train", "robot", "racecar", "peekaboo",
             "puppy", "treasure", "pizza", "stars", "space", "snowman", "windup",
             "waterwheel", "postboat", "bakery", "frontdoor", "lantern", "trainline",
             "kite", "nestlift", "concert", "rooftops", "observatory": return true
        default: return false
        }
    }

    private var boardProgress: NativeSpeechGameProgress {
        let requester: ((@escaping (Bool) -> Void) -> Bool)?
        if supportsHelp { requester = { callback in requestHelp(callback) } }
        else { requester = nil }
        return NativeSpeechGameProgress(count: selection.targets.count, advance: advance,
            isHelpActive: help != nil, isMoveActive: boardEnabled && !finished, wordIndex: step,
            isSimple: selection.isSimple == true, effectsVolume: selection.soundOn == true ? selection.volume : nil,
            requestHelp: requester)
    }

    var body: some View {
        ZStack {
            board()
                .environment(\.speechGameProgress, boardProgress)
                .environment(\.guidedReplay, onReplay)
                .allowsHitTesting(boardEnabled)
                .accessibilityHidden(!boardEnabled)
            speechOverlay
        }
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder private var speechOverlay: some View {
        if let pending = help, selection.targets.indices.contains(pending.step) {
            helpGate(pending)
        } else if !boardEnabled, selection.targets.indices.contains(step) {
            regularGate
        }
    }

    private func helpGate(_ pending: Help) -> some View {
        let target = selection.targets[pending.step]
        let plan = GameSpeechGatePlan(id: pending.id, gameID: gameID, sound: selection.sound,
            word: target.word, position: target.position, sayTimes: selection.sayings,
            emoji: target.emoji, voiceID: selection.voice, volume: selection.volume, voiceOn: selection.voiceOn)
        return GameSpeechGateView(plan: plan, markedWord: target.markedWord,
            isCurrent: { help?.id == pending.id && step == pending.step && moveEarned && isCurrent() },
            creditPlayRep: credit,
            onEarnedMove: { finishHelp(pending.id, earned: true) },
            onExit: { finishHelp(pending.id, earned: false); onExit() },
            onOptionalReturn: { finishHelp(pending.id, earned: false) }, acousticCarry: acousticCarry, provider: narration)
            .id(pending.id)
    }

    private var regularGate: some View {
        let target = selection.targets[step], turn = gateID
        let plan = GameSpeechGatePlan(id: turn, gameID: gameID, sound: selection.sound,
            word: target.word, position: target.position, sayTimes: selection.sayings,
            intro: step == 0 ? selection.intro : nil, emoji: target.emoji,
            voiceID: selection.voice, volume: selection.volume, voiceOn: selection.voiceOn)
        return GameSpeechGateView(plan: plan, markedWord: target.markedWord,
            isCurrent: { turn == gateID && !moveEarned && isCurrent() }, creditPlayRep: credit,
            onEarnedMove: { if turn == gateID && isCurrent() { moveEarned = true } }, onExit: onExit, acousticCarry: acousticCarry, provider: narration)
            .id(turn)
    }

    private func requestHelp(_ returnPower: @escaping (Bool) -> Void) -> Bool {
        let now = ProcessInfo.processInfo.systemUptime
        guard supportsHelp, help == nil, moveEarned, !finished, isCurrent(), now - lastHelpSwitch >= 0.5 else { return false }
        lastHelpSwitch = now
        help = Help(step: step, returnPower: returnPower)
        return true
    }

    private func finishHelp(_ id: UUID, earned: Bool) {
        guard let pending = help, pending.id == id else { return }
        help = nil; lastHelpSwitch = ProcessInfo.processInfo.systemUptime
        pending.returnPower(earned && pending.step == step && isCurrent())
    }

    private func advance() {
        guard moveEarned, help == nil, !finished, isCurrent() else { return }
        moveEarned = false
        step += 1
        if finished { onFinish() }
        else { gateID = UUID() }
    }
}
