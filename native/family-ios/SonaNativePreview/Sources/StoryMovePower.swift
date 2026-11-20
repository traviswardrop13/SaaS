import Combine
import SwiftUI

/// A clock scoped to one accepted move. On the shipping story boards a heard
/// word starts the assistance, and the optional same-word turn renews it.
struct StoryMovePowerClock {
    let duration: TimeInterval
    private(set) var remaining: TimeInterval = 0
    private var word: Int?
    private var previousSample: TimeInterval?

    mutating func observe(word next: Int?, playing: Bool, now: TimeInterval) {
        guard let next else {
            word = nil
            remaining = 0
            suspend()
            return
        }
        guard now.isFinite else { suspend(); return }
        if word != next {
            word = nil
            remaining = 0
            suspend()
            if playing {
                word = next
                remaining = duration
            }
        }
        guard playing else { suspend(); return }
        if let previousSample, now >= previousSample {
            remaining = max(0, remaining - min(0.05, now - previousSample))
        }
        previousSample = now
    }

    mutating func grant(word requested: Int?, earned: Bool) {
        guard let requested, word == requested, earned else { return }
        remaining = duration
        suspend()
    }

    mutating func suspend() { previousSample = nil }
}

final class StoryMovePower: ObservableObject {
    @Published private(set) var remaining: TimeInterval = 0
    var active: Bool { remaining > 0 }
    let duration: TimeInterval
    private var state: StoryMovePowerClock

    init(duration: TimeInterval = 12) {
        self.duration = duration
        state = StoryMovePowerClock(duration: duration)
    }

    func observe(_ word: Int?, playing: Bool, now: TimeInterval) {
        state.observe(word: word, playing: playing, now: now)
        publish()
    }

    func grant(_ word: Int?, earned: Bool) {
        state.grant(word: word, earned: earned)
        publish()
    }

    func suspend() { state.suspend() }

    private func publish() {
        if remaining != state.remaining { remaining = state.remaining }
    }
}

struct StoryMovePowerControls: ViewModifier {
    @ObservedObject var power: StoryMovePower
    let title: String
    let id: String
    var enabled = true

    @Environment(\.scenePhase) private var scene
    @Environment(\.speechGameProgress) private var progress
    @Environment(\.isEnabled) private var boardEnabled
    @State private var visible = false

    private let timer = Timer.publish(every: 1.0 / 30, on: .main, in: .common).autoconnect()

    private var playing: Bool {
        visible && scene == .active && boardEnabled && progress?.isMoveActive == true
            && progress?.isHelpActive != true
    }

    func body(content: Content) -> some View {
        content.safeAreaInset(edge: .bottom, spacing: 0) {
            if let request = progress?.requestHelp {
                HStack(spacing: 12) {
                    Button(title) {
                        guard enabled, playing else { return }
                        let word = progress?.wordIndex
                        _ = request { accepted in power.grant(word, earned: accepted) }
                    }
                    .buttonStyle(.bordered)
                    .disabled(!enabled || !playing)
                    .frame(minHeight: 44)
                    .accessibilityIdentifier(id)
                    .accessibilityHint("Say your word again for extra help.")
                    if power.active {
                        ProgressView(value: power.remaining, total: power.duration)
                            .tint(SonaPalette.teal)
                            .accessibilityLabel("\(title) remaining")
                    }
                }
                .font(.system(.subheadline, design: .rounded).weight(.bold))
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity)
                .background(SonaPalette.paper)
            }
        }
        .onReceive(timer) { _ in tick() }
        .onAppear { visible = true; tick() }
        .onChange(of: playing) { _ in tick() }
        .onChange(of: progress?.wordIndex) { _ in tick() }
        .onDisappear { visible = false; power.suspend() }
    }

    private func tick() {
        power.observe(progress?.wordIndex, playing: playing, now: ProcessInfo.processInfo.systemUptime)
    }
}
