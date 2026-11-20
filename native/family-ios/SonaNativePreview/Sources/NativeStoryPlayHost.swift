import SwiftUI

struct NativeAdventureGameAccess {
    let load: @MainActor (String) async throws -> NativeSpeechGameSelection?
    let isCurrent: @MainActor () -> Bool
    let credit: @MainActor (GameSayingCredit) async throws -> Void
    let finish: @MainActor (String, UUID) async throws -> Void
}

struct NativeStoryPlayHost<Board: View>: View {
    let game: String
    let access: NativeAdventureGameAccess
    let onFinish: @MainActor () -> Void
    let onExit: @MainActor () -> Void
    var onReplay: (@MainActor () -> Void)?
    @ViewBuilder let board: () -> Board

    @State private var selection: NativeSpeechGameSelection?
    @State private var unavailable = false
    @State private var receipt = UUID()
    @State private var finishState: FinishState = .playing

    private enum FinishState { case playing, saving, failed, saved }

    var body: some View {
        Group {
            if let selection {
                NativeSayPlayRound(gameID: game, selection: selection, isCurrent: access.isCurrent, credit: access.credit,
                    onFinish: finish, onReplay: onReplay, onExit: onExit, board: board)
                    .allowsHitTesting(finishState == .playing || finishState == .saved)
                    .accessibilityHidden(finishState == .saving || finishState == .failed)
                    .overlay { saveStatus }
            } else if unavailable {
                VStack(spacing: 18) {
                    Text("Sona couldn’t open this game.").font(.headline)
                    Button("Try again") { Task { await load() } }
                    Button("Back to story", action: onExit)
                }
                .padding(24)
            } else {
                ProgressView("Opening the game")
            }
        }
        .task { await load() }
    }

    private func load() async {
        unavailable = false
        do {
            guard access.isCurrent(), let found = try await access.load(game), !found.targets.isEmpty else {
                unavailable = true
                return
            }
            selection = found
        } catch { unavailable = true }
    }

    private func finish() {
        guard access.isCurrent(), finishState == .playing || finishState == .failed else { return }
        finishState = .saving
        Task {
            do {
                try await access.finish(game, receipt)
                finishState = .saved
                if access.isCurrent() { onFinish() }
            } catch { finishState = .failed }
        }
    }

    @ViewBuilder private var saveStatus: some View {
        if finishState == .saving || finishState == .failed {
            VStack(spacing: 15) {
                if finishState == .saving {
                    ProgressView("Saving the adventure")
                } else {
                    Text("Sona couldn’t save this adventure.").font(.headline)
                    Button("Retry save", action: finish).buttonStyle(.borderedProminent)
                    Button("Back to story", action: onExit)
                }
            }
            .padding(24)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22))
            .accessibilityAddTraits(.isModal)
        }
    }
}
