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

    public let text: String
    public let parts: [Part]
    public let isMuted: Bool

    public init(text: String, parts: [Part], isMuted: Bool = false) {
        self.text = text
        self.parts = parts
        self.isMuted = isMuted
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
    /// Idempotent; return final/best local transcript after at most 800 ms.
    func closeMicrophone() async -> String
}
