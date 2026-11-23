import SwiftUI
import SonaSpeechCore

@MainActor struct GuidedPracticeView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var model: GuidedPracticeController

    init(plan: GuidedPracticePlan?, isCurrent: @escaping @MainActor () -> Bool,
         apply: @escaping @MainActor (PracticeFlowMachine.Effect) async throws -> Void,
         onReady: @escaping @MainActor (PracticeFlowMachine.Ready) -> Void) {
        _model = StateObject(wrappedValue: GuidedPracticeController(plan: plan, isCurrent: isCurrent, apply: apply, onReady: onReady))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                HStack {
                    Button {
                        Task { await model.close(); dismiss() }
                    } label: {
                        Image(systemName: "xmark").font(.body.weight(.bold))
                            .frame(width: 46, height: 46).background(.white, in: Circle())
                    }
                    .accessibilityLabel("Back to games")
                    .accessibilityIdentifier("guided-close")
                    Spacer()
                    Text("Practice")
                        .font(.system(.headline, design: .rounded))
                    Spacer()
                    Button { model.pause() } label: {
                        Image(systemName: "pause.fill").frame(width: 46, height: 46)
                    }
                    .accessibilityLabel("Pause practice")
                    .disabled([.ready, .unavailable, .paused, .closed, .finished].contains(model.presentation))
                    .accessibilityIdentifier("guided-pause")
                }

                if model.presentation != .unavailable {
                    Image(echoArt)
                        .resizable().scaledToFit().frame(height: 160)
                        .accessibilityHidden(true)
                    VStack(spacing: 10) {
                        Text("Say")
                            .font(.system(.title3, design: .rounded).weight(.semibold))
                        Text(model.targetText)
                            .font(.system(size: model.targetText.count > 20 ? 30 : 56, weight: .heavy, design: .rounded))
                            .foregroundStyle(Color(red: 0.78, green: 0.34, blue: 0.15))
                            .multilineTextAlignment(.center)
                            .accessibilityIdentifier("guided-target")
                        Text("\(model.reps) of \(model.requiredReps)")
                            .font(.system(.title2, design: .rounded).weight(.bold))
                            .monospacedDigit()
                            .accessibilityLabel("\(model.reps) of \(model.requiredReps) sayings heard in this turn")
                            .accessibilityIdentifier("guided-count")
                        ProgressView(value: Double(model.reps), total: Double(model.requiredReps))
                            .tint(Color(red: 0.067, green: 0.498, blue: 0.518))
                    }
                    .frame(maxWidth: .infinity).padding(24)
                    .background(.white, in: RoundedRectangle(cornerRadius: 27))
                }

                Text(model.status)
                    .font(.system(.headline, design: .rounded))
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("guided-status")

                controls
            }
            .padding(22)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .foregroundStyle(Color(red: 0.153, green: 0.137, blue: 0.216))
        .background(Color(red: 1, green: 0.961, blue: 0.914).ignoresSafeArea())
        .preferredColorScheme(.light)
        .onChange(of: scenePhase) { model.setForeground($0 == .active) }
        .nativeReminderAudioOwner(model) { await $0.close() }
        .onDisappear { Task { await model.close() } }
        .accessibilityIdentifier("guided-practice")
    }

    @ViewBuilder private var controls: some View {
        switch model.presentation {
        case .ready:
            Text("Grown-ups: audio is never uploaded or saved.")
                .font(.footnote).multilineTextAlignment(.center)
            action("Start practice", icon: "mic.fill") { model.startAfterConsent() }
                .accessibilityIdentifier("guided-start")
        case .paused:
            action("Resume", icon: "play.fill") { model.resumeAfterTap() }
                .accessibilityIdentifier("guided-resume")
        case .failure:
            action("Try again", icon: "arrow.clockwise") { model.resumeAfterTap() }
                .accessibilityIdentifier("guided-retry")
        case .quiet:
            Text(model.quietMessage.body).font(.body).multilineTextAlignment(.center)
            action(model.quietMessage.retryTitle, icon: "arrow.clockwise") { model.retryQuietAfterTap() }
                .accessibilityIdentifier("guided-retry")
            Button(model.quietMessage.laterTitle) { Task { await model.close(); dismiss() } }
                .frame(minHeight: 44)
        case .unavailable:
            Text("Go back to pick a game. This step will stay closed until its original practice rules are ready.")
                .font(.body).multilineTextAlignment(.center)
            Button("Back to games") { Task { await model.close(); dismiss() } }.frame(minHeight: 44)
        default:
            HStack(spacing: 12) {
                action("Hear again", icon: "speaker.wave.2.fill") { model.replay(slow: false) }
                    .accessibilityIdentifier("guided-replay")
                action("Slower", icon: "tortoise.fill") { model.replay(slow: true) }
                    .accessibilityIdentifier("guided-slow")
            }
            .disabled(!model.canReplay)
            .opacity(model.canReplay ? 1 : 0.45)
        }
    }

    private var echoArt: String {
        switch model.presentation {
        case .speaking: return "echo-talk"
        case .listening: return "echo-listen"
        case .checking, .quiet, .paused, .failure: return "echo-think"
        case .launching, .finished: return "echo-cheer"
        default: return "echo-welcome"
        }
    }

    private func action(_ title: String, icon: String, perform: @escaping () -> Void) -> some View {
        Button(action: perform) {
            Label(title, systemImage: icon)
                .font(.system(.body, design: .rounded).weight(.bold))
                .frame(maxWidth: .infinity, minHeight: 50)
                .padding(.horizontal, 10)
                .foregroundStyle(.white)
                .background(Color(red: 0.067, green: 0.498, blue: 0.518), in: RoundedRectangle(cornerRadius: 18))
        }
        .buttonStyle(.plain)
    }
}
