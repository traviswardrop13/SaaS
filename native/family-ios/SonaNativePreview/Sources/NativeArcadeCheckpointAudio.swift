import Foundation
import CryptoKit
import SonaSpeechCore

@MainActor protocol NativeArcadeCheckpointPromptProviding {
    func harderModel(selection: NativeArcadeCheckpointSelection,
                     ask: NativeArcadeCheckpointSelection.Ask) async -> PracticePrompt?
    func bareModels(selection: NativeArcadeCheckpointSelection, idea: Bool,
                    includeLead: Bool) async -> [PracticePrompt]
    func handoff(selection: NativeArcadeCheckpointSelection) async -> PracticePrompt?
}

/// Only authored output text enters narration. A harder ask may never use an
/// installed-voice substitute: the source falls back to Rachel's bare sound.
@MainActor final class NativeArcadeCheckpointAudio: NativeArcadeCheckpointPromptProviding {
    private let narration: GameSpeechNarration
    private let bundle: Bundle
    private let catalog: PracticeDialogueCatalog?
    private var harder: [String: PracticePrompt] = [:]

    init(narration: GameSpeechNarration? = nil, bundle: Bundle = .main,
         catalog: PracticeDialogueCatalog? = nil) {
        self.narration = narration ?? GameSpeechNarration()
        self.bundle = bundle; self.catalog = catalog ?? (try? PracticeDialogueCatalog.load(bundle: bundle))
    }

    func harderModel(selection: NativeArcadeCheckpointSelection,
                     ask: NativeArcadeCheckpointSelection.Ask) async -> PracticePrompt? {
        guard selection.voiceOn, selection.volume > 0, ask.requiresPreparedModel,
              !ask.modelText.isEmpty else { return nil }
        let key = selection.voiceID + "|" + ask.modelText
        if let cached = harder[key] { return cached }
        let narration = self.narration
        let result = await bounded(selection.modelWaitMilliseconds) {
            try? await narration.authoredPrompt(ask.modelText, voice: selection.voiceID, volume: selection.volume)
        }
        guard let result, result.systemSpeech == nil, !result.isMuted,
              result.encodedAudio?.isEmpty == false || !result.parts.isEmpty else { return nil }
        harder[key] = result
        return result
    }

    func bareModels(selection: NativeArcadeCheckpointSelection, idea: Bool,
                    includeLead: Bool) async -> [PracticePrompt] {
        guard selection.voiceOn, selection.volume > 0 else { return [] }
        var prompts: [PracticePrompt] = []
        if includeLead {
            let text = idea ? selection.stepBackLine : selection.intro
            if let line = await lead(text, selection: selection) { prompts.append(line) }
        }
        if let take = bareTake(selection: selection) { prompts.append(take) }
        return prompts
    }

    func lead(_ text: String, selection: NativeArcadeCheckpointSelection) async -> PracticePrompt? {
        guard selection.voiceOn, selection.volume > 0 else { return nil }
        let narration = self.narration
        let line = await bounded(selection.bareLineWaitMilliseconds) {
            try? await narration.authoredPrompt(text, voice: selection.voiceID, volume: selection.volume)
        }
        // Like SayIt.line: missing bytes skip this optional line. A failed
        // playback of available bytes may use the installed voice.
        guard let line, line.systemSpeech == nil else { return nil }
        return line
    }

    func bareTake(selection: NativeArcadeCheckpointSelection) -> PracticePrompt? {
        guard selection.voiceOn, selection.volume > 0, selection.humanClipsEnabled,
              let expected = catalog?.sound(selection.sound)?.clips.sound,
              expected.path == selection.bare.clip,
              let url = bundle.url(forResource: selection.sound + "-sound", withExtension: "wav"),
              let bytes = try? Data(contentsOf: url), bytes.count == expected.bytes,
              SHA256.hash(data: bytes).map({ String(format: "%02x", $0) }).joined() == expected.sha256 else { return nil }
        return .init(text: selection.bare.text, encodedAudio: bytes, volume: selection.volume)
    }

    func handoff(selection: NativeArcadeCheckpointSelection) async -> PracticePrompt? {
        guard selection.voiceOn, selection.volume > 0 else { return nil }
        return await narration.goPrompt(voice: selection.voiceID, volume: selection.volume)
    }

    private func bounded(_ milliseconds: Double,
                         operation: @escaping @MainActor () async -> PracticePrompt?) async -> PracticePrompt? {
        await withTaskGroup(of: PracticePrompt?.self) { group in
            group.addTask { await operation() }
            group.addTask {
                try? await Task.sleep(nanoseconds: UInt64(max(0, milliseconds) * 1_000_000))
                return nil
            }
            let result = await group.next() ?? nil
            group.cancelAll()
            return result
        }
    }
}

/// Page-scope quiet number only. No samples, transcript, elapsed saying or
/// nomination is shared across a checkpoint/life card or a child's session.
@MainActor final class NativeArcadeCheckpointCarry {
    private(set) var roomFloor: Double?
    fileprivate var audio: NativeArcadeCheckpointAudio?
    func observeFloor(_ value: Double?) {
        guard let value, value.isFinite, value >= 0 else { return }
        roomFloor = min(roomFloor ?? value, value)
    }
    func provider() -> NativeArcadeCheckpointAudio {
        if let audio { return audio }
        let value = NativeArcadeCheckpointAudio(); audio = value
        return value
    }
}
