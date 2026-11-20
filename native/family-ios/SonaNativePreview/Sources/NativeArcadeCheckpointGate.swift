import SwiftUI
import SonaSpeechCore

/// The host owns its retained board and canonical checkpoint. This overlay
/// cannot skip to the next segment; Done ends the round after audio cleanup.
@MainActor struct NativeArcadeCheckpointGate: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var model: NativeArcadeCheckpointController

    init(id: UUID, selection: NativeArcadeCheckpointSelection,
         isCurrent: @escaping @MainActor () -> Bool,
         credit: @escaping @MainActor (GameSayingCredit) async throws -> Void,
         onEarned: @escaping @MainActor () -> Void,
         onEnd: @escaping @MainActor () -> Void,
         carry: NativeArcadeCheckpointCarry? = nil,
         onStepBack: (@MainActor (NativeArcadeCheckpointSelection.Ask) -> Void)? = nil,
         heldAsk: NativeArcadeCheckpointSelection.Ask? = nil) {
        _model = StateObject(wrappedValue: NativeArcadeCheckpointController(id: id, selection: selection,
            isCurrent: isCurrent, credit: credit, onEarned: onEarned, onEnd: onEnd,
            carry: carry, onStepBack: onStepBack, heldAsk: heldAsk))
    }

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(spacing: 16) {
                    HStack {
                        Button { model.endPlaying() } label: {
                            Image(systemName: "xmark").font(.body.weight(.bold)).frame(width: 44, height: 44)
                        }.accessibilityLabel("I'm done playing")
                            .accessibilityIdentifier("arcade-checkpoint-close")
                        Spacer()
                        Button { model.pause() } label: {
                            Image(systemName: "pause.fill").frame(width: 44, height: 44)
                        }.accessibilityLabel("Pause")
                            .disabled([.ready, .paused, .earned, .closed, .unavailable].contains(model.phase))
                            .accessibilityIdentifier("arcade-checkpoint-pause")
                    }
                    Image(echoArt).resizable().scaledToFit()
                        .frame(height: geometry.size.height < 600 ? 90 : 138)
                        .accessibilityHidden(true)
                    Text(markedTitle)
                        .font(.system(size: 29, weight: .heavy, design: .rounded))
                        .multilineTextAlignment(.center).padding(22)
                        .frame(maxWidth: .infinity)
                        .background(.white, in: RoundedRectangle(cornerRadius: 25))
                        .accessibilityIdentifier("arcade-checkpoint-title")
                    Text(model.status).font(.system(.headline, design: .rounded))
                        .multilineTextAlignment(.center).frame(minHeight: 26)
                        .accessibilityIdentifier("arcade-checkpoint-status")
                    controls
                    Button("I'm done playing") { model.endPlaying() }
                        .font(.system(.body, design: .rounded).weight(.bold))
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .accessibilityIdentifier("arcade-checkpoint-done")
                }.padding(20).frame(maxWidth: 440)
                    .frame(maxWidth: .infinity, minHeight: geometry.size.height)
            }
        }
        .foregroundStyle(Color(red: 0.15, green: 0.14, blue: 0.22))
        .background(Color(red: 1, green: 0.96, blue: 0.91).ignoresSafeArea())
        .preferredColorScheme(.light)
        .onAppear { model.startAfterConsent() }
        .onChange(of: scenePhase) { model.setForeground($0 == .active) }
        .onDisappear { Task { await model.close() } }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("arcade-checkpoint-gate")
    }

    @ViewBuilder private var controls: some View {
        switch model.phase {
        case .paused:
            action("Resume", systemImage: "play.fill") { model.startAfterConsent() }
                .accessibilityIdentifier("arcade-checkpoint-resume")
        case .retry:
            action("Try again", systemImage: "mic.fill") { model.startAfterConsent() }
                .accessibilityIdentifier("arcade-checkpoint-retry")
        case .listening:
            action("Hear it", systemImage: "speaker.wave.2.fill") { model.hearAgain() }
                .accessibilityIdentifier("arcade-checkpoint-replay")
        case .unavailable:
            Text("Microphone unavailable").font(.headline)
        default: EmptyView()
        }
    }

    private func action(_ title: String, systemImage: String, perform: @escaping () -> Void) -> some View {
        Button(action: perform) {
            Label(title, systemImage: systemImage).font(.system(.body, design: .rounded).weight(.bold))
                .frame(maxWidth: .infinity, minHeight: 50)
                .foregroundStyle(.white)
                .background(Color(red: 0.067, green: 0.498, blue: 0.518), in: RoundedRectangle(cornerRadius: 17))
        }.buttonStyle(.plain)
    }
    private var echoArt: String {
        switch model.phase {
        case .speaking: return "echo-talk"
        case .listening: return "echo-listen"
        case .checking, .paused, .retry: return "echo-think"
        case .earned: return "echo-cheer"
        default: return "echo-welcome"
        }
    }

    private var markedTitle: AttributedString {
        let ask = model.ask
        let title = model.selection.title(for: ask)
        guard let quoted = title.range(of: "“\(ask.text)”") else { return AttributedString(title) }
        var result = AttributedString(String(title[..<title.index(after: quoted.lowerBound)]))
        result += marked(ask.markedHTML, fallback: ask.text)
        result += AttributedString(String(title[title.index(before: quoted.upperBound)...]))
        return result
    }

    /// Color only the source's marked letters, never a newly guessed span.
    private func marked(_ html: String, fallback: String) -> AttributedString {
        guard let expression = try? NSRegularExpression(pattern: "<b\\b[^>]*>(.*?)</b>|([^<]+)") else { return AttributedString(fallback) }
        var result = AttributedString()
        for match in expression.matches(in: html, range: NSRange(html.startIndex..., in: html)) {
            let marked = match.range(at: 1).location != NSNotFound
            let range = match.range(at: marked ? 1 : 2)
            guard let swiftRange = Range(range, in: html) else { continue }
            var text = String(html[swiftRange])
            for (entity, decoded) in [("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", "\""), ("&#39;", "'")] {
                text = text.replacingOccurrences(of: entity, with: decoded)
            }
            var run = AttributedString(text)
            if marked { run.foregroundColor = Color(red: 0.77, green: 0.33, blue: 0.16) }
            result += run
        }
        return result.characters.isEmpty ? AttributedString(fallback) : result
    }
}
