import SwiftUI
import SonaSpeechCore

/// Inline overlay: the host retains its gameplay scene and controls dismissal.
/// This gate cannot give a move or a saying through a tap or elapsed time.
@MainActor struct GameSpeechGateView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var model: GameSpeechGateController
    private let markedWord: AttributedString
    private let onExit: @MainActor () -> Void
    private let isOptionalHelp: Bool

    init(plan: GameSpeechGatePlan?, markedWord: AttributedString,
         isCurrent: @escaping @MainActor () -> Bool,
         creditPlayRep: @escaping @MainActor (GameSayingCredit) async throws -> Void,
         onEarnedMove: @escaping @MainActor () -> Void,
         onExit: @escaping @MainActor () -> Void,
         onOptionalReturn: (@MainActor () -> Void)? = nil,
         acousticCarry: GameSpeechAcousticCarry? = nil,
         provider: GameSpeechPromptProviding? = nil) {
        _model = StateObject(wrappedValue: GameSpeechGateController(
            plan: plan, isCurrent: isCurrent, creditPlayRep: creditPlayRep, onEarnedMove: onEarnedMove, onOptionalReturn: onOptionalReturn, acousticCarry: acousticCarry, provider: provider))
        self.markedWord = markedWord
        self.onExit = onExit; self.isOptionalHelp = onOptionalReturn != nil
    }

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(spacing: 16) {
                    HStack {
                        Button { Task { await model.close(); onExit() } } label: {
                            Image(systemName: "xmark").font(.body.weight(.bold))
                                .frame(width: 44, height: 44)
                        }
                        .accessibilityLabel("Leave game")
                        .accessibilityIdentifier("game-speech-close")
                        Spacer()
                        Text("Say & play").font(.system(.headline, design: .rounded))
                        Spacer()
                        Button { model.pause() } label: {
                            Image(systemName: "pause.fill").frame(width: 44, height: 44)
                        }
                        .disabled([.ready, .paused, .earned, .closed, .unavailable].contains(model.phase))
                        .accessibilityLabel("Pause")
                        .accessibilityIdentifier("game-speech-pause")
                    }
                    Image(echoArt).resizable().scaledToFit()
                        .frame(height: geometry.size.height < 600 ? 92 : 134)
                        .accessibilityHidden(true)
                    if let plan = model.plan, plan.isSupported {
                        VStack(spacing: 12) {
                            if let emoji = plan.emoji, !emoji.isEmpty {
                                Text(emoji).font(.system(size: 54)).accessibilityHidden(true)
                            }
                            Text(markedWord)
                                .font(.system(size: plan.word.count > 14 ? 32 : 44, weight: .heavy, design: .rounded))
                                .multilineTextAlignment(.center)
                                .accessibilityIdentifier("game-speech-word")
                            if plan.sayTimes > 1 {
                                HStack(spacing: 12) {
                                    ForEach(0..<plan.sayTimes, id: \.self) { index in
                                        Image(systemName: index < model.sayings ? "checkmark.circle.fill" : "circle")
                                            .font(.title2).foregroundStyle(teal)
                                    }
                                }
                                .accessibilityElement(children: .ignore)
                                .accessibilityLabel("\(model.sayings) of \(plan.sayTimes) sayings heard")
                                .accessibilityIdentifier("game-speech-count")
                                Text("Say it \(plan.sayTimes) times").font(.subheadline.weight(.semibold))
                            }
                        }
                        .padding(20).frame(maxWidth: .infinity)
                        .background(Color.white, in: RoundedRectangle(cornerRadius: 25))
                    }
                    Text(model.status).font(.system(.headline, design: .rounded))
                        .multilineTextAlignment(.center).frame(minHeight: 26)
                        .accessibilityIdentifier("game-speech-status")
                    controls
                    if isOptionalHelp {
                        Button("Back to the game") { model.returnToMove() }
                            .font(.system(.body, design: .rounded).weight(.bold))
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .accessibilityIdentifier("game-speech-help-back")
                    }
                }
                .padding(20).frame(maxWidth: 440)
                .frame(maxWidth: .infinity, minHeight: geometry.size.height)
            }
        }
        .foregroundStyle(Color(red: 0.15, green: 0.14, blue: 0.22))
        .background(Color(red: 1, green: 0.96, blue: 0.91).ignoresSafeArea())
        .preferredColorScheme(.light)
        .onAppear { if isOptionalHelp { model.startAfterConsent() } }
        .onChange(of: scenePhase) { model.setForeground($0 == .active) }
        .nativeReminderAudioOwner(model) { await $0.close() }
        .onDisappear { Task { await model.close() } }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("game-speech-gate")
    }

    @ViewBuilder private var controls: some View {
        switch model.phase {
        case .ready:
            Text("Grown-ups: audio is never uploaded or saved.")
                .font(.footnote).multilineTextAlignment(.center)
            action("Let's play", symbol: "mic.fill") { model.startAfterConsent() }
                .accessibilityIdentifier("game-speech-start")
        case .paused:
            action("Resume", symbol: "play.fill") { model.startAfterConsent() }
                .accessibilityIdentifier("game-speech-resume")
        case .retry:
            action("Try again", symbol: "mic.fill") { model.startAfterConsent() }
                .accessibilityIdentifier("game-speech-retry")
            Button("Hear it") { model.hearAgain() }.frame(minHeight: 44)
                .accessibilityIdentifier("game-speech-replay")
        case .unavailable:
            Button("Back to games") { Task { await model.close(); onExit() } }.frame(minHeight: 44)
        case .earned, .closed:
            EmptyView()
        default:
            action("Hear it", symbol: "speaker.wave.2.fill") { model.hearAgain() }
                .disabled([.permission, .preparing, .saving].contains(model.phase))
                .accessibilityIdentifier("game-speech-replay")
        }
    }

    private var echoArt: String {
        switch model.phase {
        case .speaking: return "echo-talk"
        case .listening, .gap: return "echo-listen"
        case .checking, .retry, .paused: return "echo-think"
        case .earned: return "echo-cheer"
        default: return "echo-welcome"
        }
    }
    private var teal: Color { Color(red: 0.067, green: 0.498, blue: 0.518) }
    private func action(_ title: String, symbol: String, perform: @escaping () -> Void) -> some View {
        Button(action: perform) {
            Label(title, systemImage: symbol).font(.system(.body, design: .rounded).weight(.bold))
                .frame(maxWidth: .infinity, minHeight: 50).padding(.horizontal, 12)
                .foregroundStyle(.white).background(teal, in: RoundedRectangle(cornerRadius: 17))
        }.buttonStyle(.plain)
    }
}
