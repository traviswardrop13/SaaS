import SwiftUI
import SonaSpeechCore

struct NativeReadingPageInput: Equatable {
    let title, sound, caption: String
    let word: String?
    var captions: [String] = []
}

struct NativeReadingSelection: Decodable {
    let word: String?
    let sound, position, voiceID: String
    let sayings: Int
    let voiceOn: Bool
    let volume: Float
    let promptPieces, captionPieces: [NativeSpeechEmphasis]
}

struct NativeSpeechEmphasis: Decodable {
    let text: String
    let marked: Bool
    let key: Bool?

    static func formatted(_ pieces: [Self], fallback: String) -> AttributedString {
        guard !pieces.isEmpty else { return AttributedString(fallback) }
        return pieces.reduce(into: AttributedString()) { result, piece in
            var run = AttributedString(piece.text)
            if piece.key == true || piece.marked { run.inlinePresentationIntent = .stronglyEmphasized }
            if piece.marked { run.foregroundColor = Color(red: 0.64, green: 0.25, blue: 0.03) }
            result += run
        }
    }
}

struct NativeReadingAccess {
    let selection: @MainActor (NativeReadingPageInput) async throws -> NativeReadingSelection
    let isCurrent: @MainActor () -> Bool
    let consent: @MainActor () -> ReadingSpeechConsent
    let rememberPermission: @MainActor () -> Void
    let credit: @MainActor (GameSayingCredit) async throws -> Void
}

/// The narrator owns speaker output only. The reader mounts the separate
/// microphone view after the caption's output has finished.
@MainActor final class NativeReadingPlayback: ObservableObject {
    enum Mode { case book, talkingStory }
    @Published private(set) var moment: ReadingSpeechMomentPlan?
    @Published private(set) var captionPieces: [NativeSpeechEmphasis] = []
    @Published private(set) var needsResume = false
    @Published private(set) var canReplayCaption = false
    private(set) var promptPieces: [NativeSpeechEmphasis] = []
    let acousticCarry = ReadingSpeechAcousticCarry()
    private let driver = ApplePracticeAudioDriver()
    private let narration = GameSpeechNarration()
    private var generation = UUID()
    private var narrating = false

    init() {
        driver.setInterruptionHandler { [weak self] in self?.pauseNarration() }
    }

    func prepare(_ page: NativeReadingPageInput, using access: NativeReadingAccess,
                 mode: Mode, readOnly: Bool) async {
        stop()
        let current = generation
        guard let selection = try? await access.selection(page), current == generation, access.isCurrent(), !Task.isCancelled else { return }
        if !readOnly { captionPieces = selection.captionPieces }
        canReplayCaption = selection.voiceOn && selection.volume > 0 && !page.caption.isEmpty
        if canReplayCaption {
            narrating = true
            do {
                let prompt = try await narration.authoredPrompt(page.caption, voice: selection.voiceID, volume: selection.volume)
                guard current == generation, access.isCurrent(), !Task.isCancelled else { return }
                try await driver.playPrompt(prompt)
            } catch is CancellationError {
                if current == generation && !Task.isCancelled { pauseNarration() }
                return
            } catch {
                // The printed page is available when the authored voice is offline.
            }
            if current == generation { narrating = false }
        }
        guard let word = selection.word, !readOnly, current == generation, access.isCurrent(), !Task.isCancelled else { return }
        promptPieces = selection.promptPieces
        moment = ReadingSpeechMomentPlan(kind: mode == .book ? .book : .talkingStory, sound: selection.sound, word: word,
            position: selection.position, sayTimes: selection.sayings, consent: access.consent(),
            voiceID: selection.voiceID, volume: selection.volume, voiceOn: selection.voiceOn, replayCaption: page.caption)
    }

    func stop(keepCaptionReplay: Bool = false) {
        generation = UUID()
        narrating = false
        driver.stopPlayback()
        moment = nil
        captionPieces = []
        promptPieces = []
        needsResume = false
        if !keepCaptionReplay { canReplayCaption = false }
    }

    func pauseNarration() {
        guard narrating else { return }
        generation = UUID()
        narrating = false
        driver.stopPlayback()
        needsResume = true
    }
}
