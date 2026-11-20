import Foundation

/// The app supplies its existing approved words and recorded sound. This package
/// neither invents a cue nor fetches a voice. Parts must already be on this device.
public struct PracticePrompt: Equatable, Sendable {
    public struct Part: Equatable, Sendable {
        public let fileURL: URL
        public let rate: Float

        public init(fileURL: URL, rate: Float = 1) {
            precondition(fileURL.isFileURL, "Practice audio must be a local file")
            precondition(rate.isFinite && rate > 0)
            self.fileURL = fileURL
            self.rate = rate
        }
    }

    /// An exact authored line for the installed on-device narrator. The
    /// optional Go clip is never synthesized through this fallback.
    public struct SystemSpeech: Equatable, Sendable {
        public let text: String
        public let relativeRate: Float
        public let pitch: Float
        public init(text: String, slow: Bool = false) {
            self.text = text
            self.relativeRate = slow ? 0.62 : 0.95
            self.pitch = 1.05
        }
    }

    public let text: String
    public let parts: [Part]
    public let isMuted: Bool
    /// Approved model/narration playback bytes only; never microphone input.
    /// The data path permits media playback without creating an audio file.
    public let encodedAudio: Data?
    public let systemSpeech: SystemSpeech?
    public let volume: Float
    public let playbackRate: Float

    public init(text: String, parts: [Part], isMuted: Bool = false,
                volume: Float = 0.8, playbackRate: Float = 1) {
        self.text = text
        self.parts = parts
        self.isMuted = isMuted
        self.encodedAudio = nil
        self.systemSpeech = nil
        self.volume = volume.isFinite ? max(0, min(1, volume)) : 0.8
        self.playbackRate = playbackRate.isFinite && playbackRate > 0 ? playbackRate : 1
    }

    public init(text: String, encodedAudio: Data, isMuted: Bool = false,
                volume: Float = 0.8, playbackRate: Float = 1) {
        self.text = text
        self.parts = []
        self.isMuted = isMuted
        self.encodedAudio = encodedAudio
        self.systemSpeech = nil
        self.volume = volume.isFinite ? max(0, min(1, volume)) : 0.8
        self.playbackRate = playbackRate.isFinite && playbackRate > 0 ? playbackRate : 1
    }

    public init(text: String, systemSpeech: SystemSpeech, volume: Float = 0.8) {
        self.text = text; self.parts = []; self.encodedAudio = nil
        self.systemSpeech = systemSpeech; self.isMuted = false
        self.volume = volume.isFinite ? max(0, min(1, volume)) : 0.8
        self.playbackRate = 1
    }

}

/// A single owner for the mic, recognizer and prompt. All callbacks and calls are
/// on main. A close must stop input, remove the tap and finish recognition before
/// it returns; the final transcript is ephemeral and never part of a result.
@MainActor
public protocol PracticeAudioDriver: AnyObject {
    /// Session-scoped, including playback and permission waits. An interruption
    /// must reach the turn even after the preceding microphone has closed.
    func setInterruptionHandler(_ handler: (@MainActor () -> Void)?)
    /// Call only after the grown-up's explicit yes. Ask for mic first; recognition
    /// permission follows it. Recognition denial must still allow acoustic checks.
    func requestPermissions() async -> Bool
    func playPrompt(_ prompt: PracticePrompt) async throws
    func stopPlayback()
    func openMicrophone(
        onFrame: @escaping @MainActor (PracticeAcousticFrame) -> Void,
        onInterruption: @escaping @MainActor () -> Void
    ) async throws
    /// Optional check: on-device only, at most 15 seconds across this attempt.
    func startRecognition(words: [String], maxMilliseconds: Double) async -> Bool
    /// Finish only the current on-device saying, keeping the input tap running.
    /// No recognizer/model or a replaced capture is unavailable, never a pass.
    func finishRecognition() async -> PracticeRecognitionResult
    /// Idempotent; return final/best local transcript after at most 800 ms.
    func closeMicrophone() async -> String
}

public enum PracticeRecognitionResult: Equatable, Sendable {
    case onDevice(String)
    case unavailable
}

public extension PracticeAudioDriver {
    func finishRecognition() async -> PracticeRecognitionResult { .unavailable }
}
