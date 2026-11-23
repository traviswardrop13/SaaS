import Combine
import SwiftUI

@MainActor struct NativeGuidedArcadeView<Content: View>: View {
    private let game: NativeGame
    private let isCurrent: () -> Bool
    private let load: (Int) async throws -> NativeArcadeCheckpointSelection
    private let credit: (GameSayingCredit) async throws -> Void
    private let onFinish: () -> Void
    private let onReplay: () -> Void
    private let onExit: () -> Void
    private let board: (Int, @escaping () -> Void, @escaping () -> Void) -> Content
    @State private var run: NativeArcadeRun
    @State private var carry: NativeArcadeCheckpointCarry
    @State private var heldAsk: NativeArcadeCheckpointSelection.Ask?
    @State private var motor = NativeArcadePowerBoard()
    @State private var segmentPlayed: TimeInterval = 0
    @State private var lastPlayTick: TimeInterval?
    @State private var startingHearts = 3
    @State private var leavingBoard = false
    @StateObject private var power: NativeArcadePowerController
    @Environment(\.scenePhase) private var scenePhase
    private let timer = Timer.publish(every: 0.2, on: .main, in: .common).autoconnect()

    init(game: NativeGame, isCurrent: @escaping () -> Bool,
         load: @escaping (Int) async throws -> NativeArcadeCheckpointSelection,
         credit: @escaping (GameSayingCredit) async throws -> Void, onFinish: @escaping () -> Void,
         onReplay: @escaping () -> Void, onExit: @escaping () -> Void,
         @ViewBuilder board: @escaping (Int, @escaping () -> Void, @escaping () -> Void) -> Content) {
        self.game = game; self.isCurrent = isCurrent; self.load = load; self.credit = credit
        self.onFinish = onFinish; self.onReplay = onReplay; self.onExit = onExit; self.board = board
        let carry = NativeArcadeCheckpointCarry()
        _carry = State(initialValue: carry)
        _run = State(initialValue: NativeArcadeRun(stageCount: game == .tiles ? 4 : 3))
        _power = StateObject(wrappedValue: NativeArcadePowerController(isCurrent: isCurrent, credit: credit, carry: carry))
    }

    private var activeBoard: NativeArcadeRun.Board? {
        switch run.phase {
        case .board(let segment): return segment
        case .checkpoint(let checkpoint): return checkpoint.kind == .newLife ? checkpoint.board : nil
        case .endedEarly: return nil
        }
    }

    var body: some View {
        ZStack {
            if let activeBoard {
                playBoard(activeBoard)
                    .allowsHitTesting(run.phase == .board(activeBoard))
                    .accessibilityHidden(run.phase != .board(activeBoard))
            }
            overlay
        }
        .onPreferenceChange(NativeArcadePowerBoardPreference.self) { report in
            let board = report ?? NativeArcadePowerBoard()
            let wasPlaying = motor.playing
            motor = board
            if !board.playing && wasPlaying { power.cancel() }
            if board.clearsPower { power.clearPower() }
        }
        .onReceive(timer) { _ in updatePower() }
        .onChange(of: scenePhase) { phase in
            if phase != .active {
                power.cancel()
                updatePower()
            }
        }
        .task {
            guard let selection = try? await load(0), isCurrent(), !Task.isCancelled else { return }
            power.install(selection)
        }
        .nativeReminderAudioOwner(power) { await $0.interrupt() }
        .onDisappear { power.cancel() }
    }

    private func playBoard(_ segment: NativeArcadeRun.Board) -> some View {
        board(segment.stage, {
            finishBoard(segment, lost: false)
        }, {
            finishBoard(segment, lost: true)
        })
        .id(segment)
        .environment(\.guidedReplay, { depart(to: onReplay) })
        .environment(\.guidedArcadeExit, { depart(to: onExit) })
        .environment(\.guidedArcadeRestoredLives, run.restoredLives)
        .environment(\.arcadeStartingHearts, startingHearts)
        .environment(\.arcadePowerEffect, NativeArcadePowerEffect(
            speed: power.speedFactor, suppressesAudio: power.suppressesGameAudio, revision: power.powerRevision))
        .environment(\.willPlayArcadeGameAudio, { power.willPlayGameAudio(duration: $0) })
        .safeAreaInset(edge: .bottom) {
            if !run.didFinish {
                powerBar(segment.stage)
            }
        }
    }

    private var hasActiveBoard: Bool {
        guard case .board = run.phase else { return false }
        return isCurrent() && !run.didFinish && !leavingBoard && scenePhase == .active
    }

    private func updatePower() {
        let playing = hasActiveBoard && motor.playing
        let now = ProcessInfo.processInfo.systemUptime
        if playing, let lastPlayTick { segmentPlayed += min(1, max(0, now - lastPlayTick)) }
        lastPlayTick = playing ? now : nil
        let estimated = motor.fractionComplete.flatMap { fraction -> Double? in
            guard fraction > 0 else { return nil }
            return segmentPlayed * (1 - min(fraction, 1)) / fraction
        }
        let seconds = motor.secondsLeft ?? estimated
        power.poll(playing: playing, eligible: motor.eligible, legMillisecondsLeft: seconds.map { $0 * 1_000 })
    }

    private func finishBoard(_ board: NativeArcadeRun.Board, lost: Bool) {
        guard isCurrent(), !leavingBoard, run.phase == .board(board), !run.didFinish else { return }
        let nextHearts = motor.hearts
        leavingBoard = true
        power.cancel()
        Task {
            await power.interrupt()
            guard isCurrent(), run.phase == .board(board) else { leavingBoard = false; return }
            let complete = lost ? run.loseLife(board) : run.finishBoard(board)
            if !lost {
                if let nextHearts, nextHearts > 0 { startingHearts = nextHearts }
                power.stageChanged()
            }
            motor = NativeArcadePowerBoard()
            if !lost { segmentPlayed = 0 }
            lastPlayTick = nil
            leavingBoard = false
            if complete { onFinish() }
        }
    }

    private func depart(to action: @escaping () -> Void) {
        guard !leavingBoard else { return }
        leavingBoard = true
        power.cancel()
        Task {
            await power.interrupt()
            leavingBoard = false
            guard isCurrent() else { return }
            action()
        }
    }

    private func powerBar(_ stage: Int) -> some View {
        HStack(spacing: 10) {
            Text(stageLabel(stage))
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .accessibilityIdentifier("guided-arcade-stage")
            Spacer(minLength: 4)
            if motor.playing && !power.title.isEmpty {
                Button {
                    updatePower()
                    power.tap()
                } label: {
                    HStack(spacing: 6) {
                        Image(power.isAsking ? "echo-listen" : power.speedFactor < 1 ? "echo-cheer" : "echo-welcome")
                            .resizable().scaledToFit().frame(width: 34, height: 34)
                            .accessibilityHidden(true)
                        Text(power.status.isEmpty ? power.title : power.status)
                            .font(.system(.caption, design: .rounded).weight(.bold))
                            .multilineTextAlignment(.leading)
                    }
                    .padding(.horizontal, 8)
                    .frame(minHeight: 44)
                }
                .buttonStyle(SonaPressStyle())
                .disabled(!power.canTap || !hasActiveBoard)
                .accessibilityLabel(power.buttonLabel)
                .accessibilityValue(power.status)
                .accessibilityIdentifier("guided-arcade-sound-power")
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 2)
        .foregroundStyle(SonaPalette.ink)
        .background(SonaPalette.paper)
    }

    @ViewBuilder private var overlay: some View {
        switch run.phase {
        case .board: EmptyView()
        case .checkpoint(let checkpoint):
            NativeArcadeCheckpointHost(checkpoint: checkpoint,
                isCurrent: { isCurrent() && run.phase == .checkpoint(checkpoint) },
                load: { try await load(checkpoint.number) }, credit: credit,
                carry: carry, heldAsk: checkpoint.kind == .nextStage ? heldAsk : nil,
                onStepBack: { ask in heldAsk = ask },
                onEarned: { if isCurrent() { run.earn(checkpoint) } },
                onEnd: { if isCurrent(), run.end(checkpoint) { onFinish() } })
                .id(checkpoint.id)
        case .endedEarly:
            VStack(spacing: 18) {
                Image("echo-cheer").resizable().scaledToFit().frame(height: 145).accessibilityHidden(true)
                Text("Good try! Wanna go again?")
                    .font(.system(.title, design: .rounded).weight(.heavy))
                    .multilineTextAlignment(.center)
                Button("Play again", action: onReplay).buttonStyle(RoundActionStyle())
                Button("Back to games", action: onExit).frame(minHeight: 48)
            }
            .padding(25).frame(maxWidth: 440)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .foregroundStyle(SonaPalette.ink)
            .background(SonaPalette.paper.ignoresSafeArea())
        }
    }

    private func stageLabel(_ stage: Int) -> String {
        let n = stage + 1
        switch game {
        case .slice: return "Wave \(n) of 3"
        case .glide: return "Flight \(n) of 3"
        case .rise: return "Climb \(n) of 3"
        case .sprint: return "Stretch \(n) of 3"
        case .stack: return "Floor \(n) of 3"
        case .tiles: return n == 4 ? "Finale" : "Song \(n) of 3"
        default: return ""
        }
    }
}

private struct GuidedArcadeRestoredLivesKey: EnvironmentKey {
    static let defaultValue = 0
}

extension EnvironmentValues {
    var guidedArcadeRestoredLives: Int {
        get { self[GuidedArcadeRestoredLivesKey.self] }
        set { self[GuidedArcadeRestoredLivesKey.self] = newValue }
    }
}

@MainActor private struct NativeArcadeCheckpointHost: View {
    let checkpoint: NativeArcadeRun.Checkpoint
    let isCurrent: () -> Bool
    let load: () async throws -> NativeArcadeCheckpointSelection
    let credit: (GameSayingCredit) async throws -> Void
    let carry: NativeArcadeCheckpointCarry
    let heldAsk: NativeArcadeCheckpointSelection.Ask?
    let onStepBack: (NativeArcadeCheckpointSelection.Ask) -> Void
    let onEarned: () -> Void
    let onEnd: () -> Void
    @State private var selection: NativeArcadeCheckpointSelection?
    @State private var failed = false
    @State private var loadAttempt = 0

    var body: some View {
        if let selection {
            NativeArcadeCheckpointGate(id: checkpoint.id, selection: selection, isCurrent: isCurrent,
                credit: credit, onEarned: onEarned, onEnd: onEnd,
                carry: carry, onStepBack: onStepBack, heldAsk: heldAsk)
        } else {
            VStack(spacing: 18) {
                if failed {
                    Text("Sona couldn’t open the speaking turn.").font(.headline)
                    Button("Try again") { failed = false; loadAttempt += 1 }.buttonStyle(RoundActionStyle())
                } else {
                    ProgressView("Getting ready…")
                }
                Button("Finish for now", action: onEnd).frame(minHeight: 48)
            }
            .padding(24).frame(maxWidth: 440)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .foregroundStyle(SonaPalette.ink)
            .background(SonaPalette.paper.ignoresSafeArea())
            .task(id: loadAttempt) {
                do {
                    let next = try await load()
                    guard !Task.isCancelled, isCurrent() else { return }
                    selection = next
                } catch { if !Task.isCancelled, isCurrent() { failed = true } }
            }
        }
    }
}
