import Foundation
import SonaSpeechCore

enum ReadingSpeechConsent { case ask, allowed }
enum ReadingSpeechReadOnlyScope { case page, visit }
enum ReadingSpeechAdvance { case heard, shapeFallback }

/// The host supplies the original key, eligibility (including book age),
/// and canonical story repetition count. No word selection lives here.
struct ReadingSpeechMomentPlan {
    enum Kind: String { case book, talkingStory }
    let id: UUID
    let kind: Kind
    let sound: String
    let word: String
    let position: String
    let sayTimes: Int
    let eligible: Bool
    let consent: ReadingSpeechConsent
    let replayCaption: String?
    let voiceID: String
    let volume: Float
    let voiceOn: Bool
    init(id: UUID = UUID(), kind: Kind, sound: String, word: String, position: String = "",
         sayTimes: Int, eligible: Bool = true, consent: ReadingSpeechConsent = .ask,
         voiceID: String = "", volume: Float = 0.8, voiceOn: Bool = true, replayCaption: String? = nil) {
        self.id = id; self.kind = kind; self.sound = sound; self.word = word
        self.position = position; self.sayTimes = sayTimes; self.eligible = eligible
        self.consent = consent; self.voiceID = voiceID; self.volume = volume; self.voiceOn = voiceOn
        self.replayCaption = replayCaption
    }
    var isSupported: Bool {
        !word.isEmpty && word.utf16.count <= 100 && sayTimes > 0
            && (kind != .book || sayTimes == 1)
            && ["P", "B", "M", "N", "T", "D", "K", "G", "F", "V", "S", "Z", "SH", "CH", "J", "L", "R", "TH", "THV"].contains(sound)
    }
    func ask(again: Bool) -> String { (again ? "One more time... " : "Can you say... ") + word + "." }
    static let shapeFallbackLine = "Great trying. Let's turn the page."
}

/// One reader visit's non-audio state. Retain this across keyed pages, and
/// create a new owner when the child/book/story visit changes. No timestamps,
/// transcripts, sample buffers or saying counts cross page boundaries.
@MainActor final class ReadingSpeechAcousticCarry {
    private(set) var roomFloor: Double?
    private(set) var needsQuietGap = false
    func observeFloor(_ value: Double?) {
        guard let value, value.isFinite, value >= 0 else { return }
        roomFloor = min(roomFloor ?? value, value)
    }
    func requireQuietGap() { needsQuietGap = true }
    func observedQuietGap() { needsQuietGap = false }
}
