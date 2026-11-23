import SwiftUI
import SonaSpeechCore
#if os(iOS)
import AVFoundation
#endif

enum NativeSetupMicrophoneResult { case granted, denied, unavailable }

/// Permissions only: this does not open an input stream or save microphone
/// samples. Tests always supply their own permission closure.
enum NativeSetupMicrophonePermission {
    @MainActor static func request() async -> NativeSetupMicrophoneResult {
        #if os(iOS)
        let driver = ApplePracticeAudioDriver()
        let allowed = await driver.requestPermissions()
        guard !Task.isCancelled else { return .unavailable }
        if allowed { return .granted }
        return AVAudioSession.sharedInstance().recordPermission == .denied ? .denied : .unavailable
        #else
        return .unavailable
        #endif
    }
}

@MainActor final class NativeSetupContinuationController: ObservableObject {
    enum Phase: Equatable { case microphone, requesting, denied, unavailable, handoff, finished, cancelled }
    @Published private(set) var phase: Phase = .microphone
    @Published private(set) var settling = true
    private let isCurrent: () -> Bool
    private let requestPermission: () async -> NativeSetupMicrophoneResult
    private let onPlay: () -> Void
    private let wait: (Double) async -> Void
    private var generation = UUID()
    private var request: Task<Void, Never>?
    private var settle: Task<Void, Never>?

    init(isCurrent: @escaping () -> Bool, requestPermission: @escaping () async -> NativeSetupMicrophoneResult,
         wait: @escaping (Double) async -> Void = { ms in try? await Task.sleep(nanoseconds: UInt64(max(0, ms) * 1_000_000)) },
         onPlay: @escaping () -> Void) {
        self.isCurrent = isCurrent; self.requestPermission = requestPermission
        self.wait = wait; self.onPlay = onPlay
    }
    deinit { request?.cancel(); settle?.cancel() }

    func begin() {
        guard isCurrent(), phase == .microphone else { return }
        applySettle()
    }
    func allowMicrophone() {
        guard isCurrent(), !settling, [.microphone, .denied, .unavailable].contains(phase) else { return }
        phase = .requesting
        let token = generation
        request = Task { [weak self] in
            guard let self else { return }
            let answer = await self.requestPermission()
            guard !Task.isCancelled, self.generation == token, self.isCurrent(), self.phase == .requesting else { return }
            switch answer {
            case .granted: self.showHandoff()
            case .denied: self.phase = .denied; self.applySettle()
            case .unavailable: self.phase = .unavailable; self.applySettle()
            }
        }
    }
    func notNow() {
        guard isCurrent(), !settling, [.microphone, .denied, .unavailable, .requesting].contains(phase) else { return }
        generation = UUID(); request?.cancel(); request = nil
        showHandoff()
    }
    func play() {
        guard isCurrent(), !settling, phase == .handoff else { return }
        phase = .finished
        onPlay()
    }
    func cancel() {
        generation = UUID(); request?.cancel(); request = nil
        settle?.cancel(); settle = nil; phase = .cancelled
    }
    func background() {
        guard phase == .requesting else { return }
        generation = UUID(); request?.cancel(); request = nil
        phase = .microphone; applySettle()
    }
    private func showHandoff() { phase = .handoff; applySettle() }
    private func applySettle() {
        settling = true; settle?.cancel()
        let token = generation, wait = self.wait
        settle = Task { [weak self] in
            await wait(450)
            guard !Task.isCancelled, let self, self.generation == token, self.isCurrent() else { return }
            self.settling = false
        }
    }
}

@MainActor struct NativeSetupContinuationView: View {
    let childName: String
    @StateObject private var controller: NativeSetupContinuationController
    @Environment(\.scenePhase) private var scenePhase

    init(childName: String, isCurrent: @escaping () -> Bool,
         requestPermission: @escaping () async -> NativeSetupMicrophoneResult = NativeSetupMicrophonePermission.request,
         onPlay: @escaping () -> Void) {
        self.childName = childName
        _controller = StateObject(wrappedValue: .init(isCurrent: isCurrent, requestPermission: requestPermission, onPlay: onPlay))
    }
    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 24) {
                    if controller.phase == .handoff || controller.phase == .finished {
                        Text("Hand the phone to \(childName)!")
                            .font(.system(.largeTitle, design: .rounded).weight(.heavy))
                            .privacySensitive().accessibilityAddTraits(.isHeader)
                            .accessibilityIdentifier("setup-handoff-title")
                        NativeSetupArtworkImage(path: "/assets/crafted/echo-wave.webp")
                            .frame(maxHeight: 280).accessibilityHidden(true)
                        Text("Ready to play?").font(.headline)
                    } else {
                        NativeSetupArtworkImage(path: "/assets/crafted/echo-listen.webp")
                            .frame(maxHeight: 240).accessibilityHidden(true)
                        Text("Let Echo hear \(childName)")
                            .font(.system(.largeTitle, design: .rounded).weight(.heavy))
                            .privacySensitive().accessibilityAddTraits(.isHeader)
                            .accessibilityIdentifier("setup-microphone-title")
                        if controller.phase == .denied {
                            Text("You can turn the microphone on in your phone's Settings, or choose Not now.")
                                .font(.body).accessibilityIdentifier("setup-microphone-status")
                        } else if controller.phase == .unavailable {
                            Text("The microphone isn't ready. Another app may be using it. Try again, or choose Not now.")
                                .font(.body).accessibilityIdentifier("setup-microphone-status")
                        } else if controller.phase == .requesting {
                            Text("Your phone may ask for permission.")
                                .font(.body).accessibilityIdentifier("setup-microphone-status")
                        }
                        Button("Not now") { controller.notNow() }
                            .frame(minHeight: 44).accessibilityIdentifier("setup-microphone-no")
                            .disabled(controller.settling)
                    }
                }
                .multilineTextAlignment(.center).frame(maxWidth: 500)
                .frame(maxWidth: .infinity).padding(24)
            }
            Button(controller.phase == .handoff || controller.phase == .finished ? "Let’s play!" : "Turn on Echo’s ears") {
                if controller.phase == .handoff { controller.play() } else { controller.allowMicrophone() }
            }
            .font(.system(.headline, design: .rounded).weight(.bold))
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(SonaPalette.teal, in: Capsule()).foregroundStyle(.white)
            .disabled(controller.settling || [.requesting, .finished, .cancelled].contains(controller.phase))
            .accessibilityIdentifier(controller.phase == .handoff || controller.phase == .finished ? "setup-handoff-play" : "setup-microphone-yes")
            .padding(24)
        }
        .background(SonaPalette.paper.ignoresSafeArea()).foregroundStyle(SonaPalette.ink)
        .interactiveDismissDisabled()
        .onAppear { controller.begin() }
        .onChange(of: scenePhase) { if $0 != .active { controller.background() } }
        .onDisappear { controller.cancel() }
    }
}
