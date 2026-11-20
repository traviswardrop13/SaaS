import Foundation

/// Generated wording and clip references, with no playback, microphone,
/// target selection, verdict or rep-accounting behavior of its own.
struct PracticeDialogueCatalog: Decodable {
    struct Source: Decodable { let path: String; let sha256: String }
    struct Reference: Decodable { let path: String; let line: Int }
    struct Timing: Decodable {
        let echoTailMS, microphoneSettleMS, afterChimeMS, goWaitMS, goGapSamples: Int
        let slowPlaybackRate: Double
    }
    struct Clip: Decodable { let path: String; let sha256: String; let bytes: Int }
    struct Clips: Decodable { let sound: Clip; let fallbackLine: Clip }
    struct SoundSlot: Decodable {
        let before, clip, after, whole: String
    }
    struct Utterance: Decodable {
        let fullText, bodyText: String
        let handoff: String?
        let soundSlot: SoundSlot?
    }
    struct Prompt: Decodable {
        let repetitions: Int
        let first, repeated: Utterance
    }
    struct Sound: Decodable, Identifiable {
        let id, label, soundText, cue, shortCue, retryCue: String
        let clips: Clips
        let prompts: [Prompt]
        let coaching, stepDownToSound: Utterance

        /// Unknown counts return nil; this reader never invents a new ask.
        func prompt(repetitions: Int, first: Bool) -> Utterance? {
            guard let prompt = prompts.first(where: { $0.repetitions == repetitions }) else { return nil }
            return first ? prompt.first : prompt.repeated
        }
    }
    struct TargetTemplate: Decodable {
        let repetitions: Int
        let firstWithCue, repeated: String
    }
    struct Lines: Decodable {
        let afterMisses, win, chest, adventureEnd, quiet, praiseFallback: String
    }

    let version: Int
    let scope: String
    let sources: [Source]
    let references: [String: Reference]
    let defaultRepetitions: Int
    let retryRepetitions: [Int]
    let humanClipsEnabled: Bool
    let timing: Timing
    let lines: Lines
    let praise: [String]
    let sounds: [Sound]
    let targetTemplates: [TargetTemplate]
    let stepDownTargetTemplate: String

    enum CatalogError: Error { case missingResource, incompatibleVersion, incompleteCatalog }

    static func load(bundle: Bundle = .main) throws -> PracticeDialogueCatalog {
        guard let url = bundle.url(forResource: "PracticeDialogue", withExtension: "json") else {
            throw CatalogError.missingResource
        }
        return try decode(Data(contentsOf: url))
    }

    static func decode(_ data: Data) throws -> PracticeDialogueCatalog {
        let value = try JSONDecoder().decode(Self.self, from: data)
        guard value.version == 1 else { throw CatalogError.incompatibleVersion }
        guard !value.sounds.isEmpty, Set(value.sounds.map(\.id)).count == value.sounds.count,
              value.defaultRepetitions > 0,
              value.sounds.allSatisfy({ !$0.cue.isEmpty && $0.prompt(repetitions: value.defaultRepetitions, first: true) != nil }) else {
            throw CatalogError.incompleteCatalog
        }
        return value
    }

    func sound(_ id: String) -> Sound? { sounds.first { $0.id == id.uppercased() } }
}
