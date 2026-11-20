import SwiftUI

struct NativeArcadePowerBoard: Equatable {
    var playing = false
    var eligible = true
    var fractionComplete: Double?
    var secondsLeft: Double?
    var clearsPower = false
    var hearts: Int?
}

struct NativeArcadePowerBoardPreference: PreferenceKey {
    static let defaultValue: NativeArcadePowerBoard? = nil
    static func reduce(value: inout NativeArcadePowerBoard?, nextValue: () -> NativeArcadePowerBoard?) {
        if let next = nextValue() { value = next }
    }
}

struct NativeArcadePowerEffect: Equatable {
    var speed = 1.0
    var suppressesAudio = false
    var revision = 0
    var protectsHearts: Bool { suppressesAudio || speed < 1 }
}

private struct NativeArcadePowerEffectKey: EnvironmentKey {
    static let defaultValue = NativeArcadePowerEffect()
}

private struct GuidedArcadeExitKey: EnvironmentKey {
    static let defaultValue: (() -> Void)? = nil
}

private struct ArcadeStartingHeartsKey: EnvironmentKey {
    static let defaultValue = 3
}

private struct ArcadeGameAudioGateKey: EnvironmentKey {
    static let defaultValue: @MainActor (TimeInterval) -> Bool = { _ in true }
}

extension EnvironmentValues {
    var arcadePowerEffect: NativeArcadePowerEffect {
        get { self[NativeArcadePowerEffectKey.self] }
        set { self[NativeArcadePowerEffectKey.self] = newValue }
    }

    var guidedArcadeExit: (() -> Void)? {
        get { self[GuidedArcadeExitKey.self] }
        set { self[GuidedArcadeExitKey.self] = newValue }
    }

    var willPlayArcadeGameAudio: @MainActor (TimeInterval) -> Bool {
        get { self[ArcadeGameAudioGateKey.self] }
        set { self[ArcadeGameAudioGateKey.self] = newValue }
    }

    var arcadeStartingHearts: Int {
        get { self[ArcadeStartingHeartsKey.self] }
        set { self[ArcadeStartingHeartsKey.self] = newValue }
    }
}

struct NativeArcadeHearts: View {
    let count: Int

    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<3, id: \.self) { index in
                Image(systemName: index < count ? "heart.fill" : "heart")
                    .foregroundStyle(index < count ? Color(red: 0.85, green: 0.29, blue: 0.30) : .gray)
            }
        }
        .font(.system(size: 13, weight: .semibold))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(count) of 3 hearts")
        .accessibilityIdentifier("guided-arcade-hearts")
    }
}
