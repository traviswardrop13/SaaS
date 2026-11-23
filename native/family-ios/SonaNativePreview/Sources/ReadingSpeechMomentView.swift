import SwiftUI
import SonaSpeechCore

/// Compact inline reader footer. The host supplies the page and owns actual
/// page/day completion; every way out awaits this owner's microphone cleanup.
@MainActor struct ReadingSpeechMomentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var model: ReadingSpeechMomentController
    private let onExit: @MainActor () -> Void
    private let onSkip: (@MainActor () -> Void)?
    private let emphasizedWord: AttributedString?
    init(plan: ReadingSpeechMomentPlan?, isCurrent: @escaping @MainActor () -> Bool,
         creditPlayRep: @escaping @MainActor (GameSayingCredit) async throws -> Void,
         onAdvance: @escaping @MainActor (ReadingSpeechAdvance) -> Void,
         onReadOnly: @escaping @MainActor (ReadingSpeechReadOnlyScope) -> Void,
         onExit: @escaping @MainActor () -> Void,
         onMicrophoneAllowed: @escaping @MainActor () -> Void = {},
         onSkip: (@MainActor () -> Void)? = nil,
         acousticCarry: ReadingSpeechAcousticCarry? = nil,
         emphasizedWord: AttributedString? = nil) {
        _model = StateObject(wrappedValue: ReadingSpeechMomentController(plan: plan,
            isCurrent: isCurrent, creditPlayRep: creditPlayRep, onAdvance: onAdvance,
            onReadOnly: onReadOnly, onMicrophoneAllowed: onMicrophoneAllowed, acousticCarry: acousticCarry))
        self.onExit = onExit; self.onSkip = onSkip; self.emphasizedWord = emphasizedWord
    }
    var body: some View {
        VStack(spacing: 12) {
            if let plan = model.plan {
                (Text("Can you say ") + Text(emphasizedWord ?? AttributedString(plan.word)) + Text("?"))
                    .font(.system(.title3, design: .rounded).weight(.bold))
                    .multilineTextAlignment(.center)
                    .accessibilityLabel("Can you say \(plan.word)?")
                    .accessibilityIdentifier("reading-speech-word")
                if plan.sayTimes > 1 {
                    HStack(spacing: 9) {
                        ForEach(0..<plan.sayTimes, id: \.self) { index in
                            Image(systemName: index < model.sayings ? "checkmark.circle.fill" : "circle")
                        }
                    }
                    .foregroundStyle(Color(red: 0.067, green: 0.498, blue: 0.518))
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(model.sayings) of \(plan.sayTimes) sayings heard")
                    .accessibilityIdentifier("reading-speech-count")
                }
            }
            Text(model.status).font(.system(.subheadline, design: .rounded).weight(.semibold))
                .multilineTextAlignment(.center).accessibilityIdentifier("reading-speech-status")
            controls
            HStack(spacing: 20) {
                if let onSkip {
                    Button { Task { await model.close(); onSkip() } } label: {
                        Text("Grown-ups: Skip").frame(minHeight: 44).contentShape(Rectangle())
                    }.accessibilityIdentifier("reading-speech-skip")
                }
                Button { Task { await model.close(); onExit() } } label: {
                    Text("Close").frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
                }.accessibilityIdentifier("reading-speech-close")
            }
            .font(.footnote).frame(minHeight: 44)
        }
        .padding(18).frame(maxWidth: .infinity)
        .foregroundStyle(Color(red: 0.15, green: 0.14, blue: 0.22))
        .background(Color(red: 1, green: 0.97, blue: 0.92), in: RoundedRectangle(cornerRadius: 24))
        .onAppear { model.beginAfterNarration() }
        .onChange(of: scenePhase) { model.setForeground($0 == .active) }
        .nativeReminderAudioOwner(model) { await $0.close() }
        .onDisappear { Task { await model.close() } }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("reading-speech-moment")
    }
    @ViewBuilder private var controls: some View {
        switch model.phase {
        case .primer:
            Text("Grown-ups: audio is never uploaded or saved.")
                .font(.footnote).multilineTextAlignment(.center)
            HStack {
                Button { model.decline() } label: {
                    Text("Not now").frame(maxWidth: .infinity, minHeight: 48).contentShape(Rectangle())
                }.buttonStyle(.plain).accessibilityIdentifier("reading-speech-decline")
                primary("Yes", symbol: "mic.fill") { model.allowMicrophone() }
                    .accessibilityIdentifier("reading-speech-allow")
            }
        case .nudge, .paused:
            primary(model.needsToSave ? "Try saving again" : "Tap the mic",
                    symbol: model.needsToSave ? "arrow.clockwise" : "mic.fill") { model.retryAfterTap() }
                .accessibilityIdentifier("reading-speech-retry")
            hearIt
        case .listening, .gap, .opening, .speaking:
            hearIt
        case .unavailable:
            Button("Keep reading") { Task { await model.close(); onExit() } }.frame(minHeight: 44)
        default:
            EmptyView()
        }
    }
    private var hearIt: some View {
        Button("Hear it") { model.hearAgain() }.frame(minHeight: 44)
            .accessibilityIdentifier("reading-speech-replay")
    }
    private func primary(_ title: String, symbol: String, perform: @escaping () -> Void) -> some View {
        Button(action: perform) {
            Label(title, systemImage: symbol).font(.system(.body, design: .rounded).weight(.bold))
                .frame(maxWidth: .infinity, minHeight: 48)
                .foregroundStyle(.white)
                .background(Color(red: 0.067, green: 0.498, blue: 0.518), in: RoundedRectangle(cornerRadius: 16))
        }.buttonStyle(.plain)
    }
}
