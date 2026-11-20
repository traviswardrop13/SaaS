import SwiftUI

@MainActor struct NativeGuidedArcadeView<Content: View>: View {
    private let game: NativeGame
    private let isCurrent: () -> Bool
    private let load: (NativeArcadeRun.Checkpoint) async throws -> NativeArcadeCheckpointSelection
    private let credit: (GameSayingCredit) async throws -> Void
    private let onFinish: () -> Void
    private let onReplay: () -> Void
    private let onExit: () -> Void
    private let board: (Int, @escaping () -> Void, @escaping () -> Void) -> Content
    @State private var run: NativeArcadeRun
    @State private var carry = NativeArcadeCheckpointCarry()
    @State private var heldAsk: NativeArcadeCheckpointSelection.Ask?

    init(game: NativeGame, isCurrent: @escaping () -> Bool,
         load: @escaping (NativeArcadeRun.Checkpoint) async throws -> NativeArcadeCheckpointSelection,
         credit: @escaping (GameSayingCredit) async throws -> Void, onFinish: @escaping () -> Void,
         onReplay: @escaping () -> Void, onExit: @escaping () -> Void,
         @ViewBuilder board: @escaping (Int, @escaping () -> Void, @escaping () -> Void) -> Content) {
        self.game = game; self.isCurrent = isCurrent; self.load = load; self.credit = credit
        self.onFinish = onFinish; self.onReplay = onReplay; self.onExit = onExit; self.board = board
        _run = State(initialValue: NativeArcadeRun(stageCount: game == .tiles ? 4 : 3))
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
    }

    private func playBoard(_ segment: NativeArcadeRun.Board) -> some View {
        board(segment.stage, {
            if isCurrent(), run.finishBoard(segment) { onFinish() }
        }, {
            if isCurrent(), run.loseLife(segment) { onFinish() }
        })
        .id(segment)
        .environment(\.guidedReplay, onReplay)
        .environment(\.guidedArcadeRestoredLives, run.restoredLives)
        .safeAreaInset(edge: .bottom) {
            if !run.didFinish {
                Text(stageLabel(segment.stage))
                    .font(.system(.subheadline, design: .rounded).weight(.semibold))
                    .foregroundStyle(SonaPalette.ink)
                    .padding(.vertical, 5).padding(.horizontal, 14)
                    .background(SonaPalette.paper, in: Capsule())
                    .accessibilityIdentifier("guided-arcade-stage")
            }
        }
    }

    @ViewBuilder private var overlay: some View {
        switch run.phase {
        case .board: EmptyView()
        case .checkpoint(let checkpoint):
            NativeArcadeCheckpointHost(checkpoint: checkpoint,
                isCurrent: { isCurrent() && run.phase == .checkpoint(checkpoint) },
                load: { try await load(checkpoint) }, credit: credit,
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
