import AVFoundation
import CryptoKit
import SwiftUI

struct PracticeModelsView: View {
    let targetSound: String
    let onGrownUps: () -> Void
    let onPractice: () -> Void
    @StateObject private var voice = ModelVoicePlayer()

    private var label: String { targetSound == "THV" ? "TH (v)" : targetSound }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Practice")
                    .font(.system(.largeTitle, design: .rounded).weight(.heavy))
                    .accessibilityAddTraits(.isHeader)

                VStack(spacing: 15) {
                    Image(voice.playing ? "echo-talk" : "echo-welcome")
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: 220, maxHeight: 235)
                        .accessibilityHidden(true)
                    if targetSound.isEmpty {
                        Text("Choose a sound")
                            .font(.system(.title, design: .rounded).weight(.heavy))
                        Text("A grown-up can pick which sound you’ll hear here.")
                            .font(.system(.body, design: .rounded))
                            .foregroundStyle(SonaPalette.muted)
                            .multilineTextAlignment(.center)
                        Button(action: onGrownUps) {
                            primaryLabel("Grown-ups", icon: "lock.fill")
                        }
                        .accessibilityIdentifier("practice-grownups")
                    } else {
                        Text(label)
                            .font(.system(size: 57, weight: .heavy, design: .rounded))
                            .accessibilityLabel("Sound \(label)")
                        Button {
                            voice.play(targetSound)
                        } label: {
                            primaryLabel("Hear the sound", icon: "speaker.wave.2.fill")
                        }
                        .accessibilityIdentifier("practice-hear-sound")
                        Button(action: onPractice) {
                            primaryLabel("Practice my sound", icon: "mic.fill")
                        }
                        .accessibilityIdentifier("practice-open-guided")
                    }
                    if voice.failed {
                        Text("The recording couldn’t play. Try again.")
                            .font(.footnote)
                            .foregroundStyle(SonaPalette.muted)
                            .accessibilityAddTraits(.updatesFrequently)
                    }
                }
                .padding(23)
                .frame(maxWidth: .infinity)
                .background(.white, in: RoundedRectangle(cornerRadius: 27))
                .buttonStyle(SonaPressStyle())
            }
            .padding(20)
            .frame(maxWidth: 540)
            .frame(maxWidth: .infinity)
        }
        .foregroundStyle(SonaPalette.ink)
        .background(SonaPalette.paper.ignoresSafeArea())
        .nativeReminderAudioOwner(voice) { $0.stop() }
        .onDisappear { voice.stop() }
        .onChange(of: targetSound) { _ in voice.stop() }
    }

    private func primaryLabel(_ title: String, icon: String) -> some View {
        Label(title, systemImage: icon)
            .font(.system(.headline, design: .rounded).weight(.heavy))
            .frame(maxWidth: .infinity, minHeight: 54)
            .foregroundStyle(.white)
            .background(SonaPalette.teal, in: RoundedRectangle(cornerRadius: 16))
    }
}

private final class ModelVoicePlayer: NSObject, ObservableObject, AVAudioPlayerDelegate {
    private static let dialogue = try? PracticeDialogueCatalog.load()
    @Published private(set) var playing = false
    @Published private(set) var failed = false
    private var audio: AVAudioPlayer?

    func play(_ sound: String) {
        stop()
        failed = false
        guard let approvedClip = Self.dialogue?.sound(sound)?.clips.sound,
              let url = Bundle.main.url(forResource: "\(sound)-sound", withExtension: "wav"),
              let clip = try? Data(contentsOf: url), clip.count == approvedClip.bytes,
              SHA256.hash(data: clip).map({ String(format: "%02x", $0) }).joined() == approvedClip.sha256 else {
            failed = true
            return
        }
        do {
            try AVAudioSession.sharedInstance().setCategory(.soloAmbient)
            let player = try AVAudioPlayer(data: clip)
            player.delegate = self
            audio = player
            playing = player.play()
            failed = !playing
        } catch {
            failed = true
        }
    }

    func stop() {
        audio?.stop()
        audio = nil
        playing = false
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        guard player === audio else { return }
        stop()
        failed = !flag
    }
}
