import AVFoundation

/// Plays the original short success effect after an earned move. The board
/// owns this player and stops it before the next speaking turn may start.
final class NativeMotorChime {
    private var player: AVAudioPlayer?

    func playCorrect(volume: Float?) {
        guard let volume, volume.isFinite, volume > 0,
              let url = Bundle.main.url(forResource: "feed-bite", withExtension: "wav") else { return }
        stop()
        do {
            try AVAudioSession.sharedInstance().setCategory(.soloAmbient)
            let audio = try AVAudioPlayer(contentsOf: url)
            audio.volume = min(1, volume)
            audio.play()
            player = audio
        } catch {}
    }

    func stop() { player?.stop(); player = nil }
}
