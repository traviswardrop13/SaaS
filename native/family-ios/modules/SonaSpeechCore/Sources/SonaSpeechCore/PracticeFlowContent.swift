import Foundation

/// The existing four practice rungs, in their current order. The app supplies
/// the approved content for each rung; this type selects no new target.
public enum PracticeRung: String, CaseIterable, Codable, Sendable {
    case isolation, syllable, word, sentence

    public var index: Int {
        switch self {
        case .isolation: return 0
        case .syllable: return 1
        case .word: return 2
        case .sentence: return 3
        }
    }

    public var previous: PracticeRung? {
        index > 0 ? Self.allCases[index - 1] : nil
    }
}

/// Exact prompt formatting from charge.html:610–689, 2240–2282, 2376–2399
/// and 2411–2459. All words/cues and the local audio assets remain the host's
/// existing approved content. Nothing here synthesizes or downloads a model.
public struct PracticeFlowContent: Equatable, Sendable {
    public let target: PracticeTarget
    public let rung: PracticeRung
    /// The source ITEM.t, including the complete sentence on a sentence rung.
    public let text: String
    public let say: String?
    public let display: String?
    public let cueTip: String
    /// The source ITEM.pos; it must not be guessed from the target's text.
    public let position: String
    /// The source ITEM.cueFirst when a day's first ask starts above isolation.
    public let cueFirst: Bool

    public init(target: PracticeTarget, text: String, say: String? = nil,
                display: String? = nil, cueTip: String = "", position: String = "", cueFirst: Bool = false) {
        guard let rung = PracticeRung(rawValue: target.level) else {
            preconditionFailure("Practice content must use an existing rung")
        }
        let resolvedPosition = position.isEmpty ? target.position : position
        self.target = PracticeTarget(sound: target.sound, word: target.word, level: target.level,
                                     sentence: target.sentence, position: resolvedPosition)
        self.rung = rung
        self.text = text
        self.say = say
        self.display = display
        self.cueTip = cueTip
        self.position = resolvedPosition
        self.cueFirst = cueFirst
    }

    public init(sound: String, rung: PracticeRung, text: String, say: String? = nil,
                display: String? = nil, word: String? = nil, cueTip: String = "",
                position: String = "", cueFirst: Bool = false) {
        self.init(target: PracticeTarget(sound: sound, word: Self.nonempty(word) ?? text,
                                        level: rung.rawValue, sentence: rung == .sentence ? text : "", position: position),
                  text: text, say: say, display: display, cueTip: cueTip, position: position, cueFirst: cueFirst)
    }

    public var soundName: String {
        let upper = target.sound.uppercased()
        let name = upper == "THV" ? "TH" : upper
        return name.count > 1 ? name.map(String.init).joined(separator: " ") : name
    }

    /// The exact compact mouth cue shown by the current practice page.
    public var shortCue: String {
        let first = cueTip.components(separatedBy: "—")[0]
            .components(separatedBy: " like ")[0]
            .components(separatedBy: ",")[0]
        return Self.trim(first).replacingOccurrences(of: "[.!]+$", with: "", options: .regularExpression)
    }

    /// The caller keeps the visit's one-shot first-cue flag. Replaying a model
    /// passes false. cueFirst is supplied by the source's selected first item;
    /// this helper never chooses a new carrier phrase or a target.
    public func initialPrompt(requiredReps: Int = 5, includeFirstCue: Bool = true) -> String {
        let numbers = [2: "two", 3: "three", 4: "four", 5: "five", 6: "six"]
        let times = (numbers[requiredReps] ?? String(requiredReps)) + " times"
        let ask = rung == .isolation
            ? "make your " + soundName + " sound"
            : "say " + (Self.nonempty(say) ?? Self.nonempty(display) ?? text)
        if includeFirstCue, !shortCue.isEmpty, rung == .isolation || cueFirst {
            return "Ready? " + shortCue + ", and " + ask + ", " + times + ". Go!"
        }
        let upperAsk = ask.prefix(1).uppercased() + ask.dropFirst()
        return "Ready? " + upperAsk + ", " + times + ". Go!"
    }

    public func retryPrompt() -> String {
        let first = cueTip.components(separatedBy: "—")[0]
        let tip = Self.trim(first).replacingOccurrences(of: "[.!,]+$", with: "", options: .regularExpression)
        let spoken = tip.isEmpty ? "Let's try our " + soundName + " sound again" : tip
        return "Let's try that one again. " + spoken + ". Go!"
    }

    /// The existing easier target is supplied by the host, from one rung down.
    public func stepDownPrompt() -> String {
        let ask = rung == .isolation
            ? "Make your " + soundName + " sound"
            : "Say " + (Self.nonempty(say) ?? text)
        return "I have an idea. Let's try this one. " + ask + ". Go!"
    }

    public var retryLabel: String { "Almost! " + (shortCue.isEmpty ? "listen close" : shortCue) + " —" }
    public static let retryStatus = "Try again — you've got this!"
    public static let stepDownLabel = "Echo's idea — say"
    public static let stepDownStatus = "An easier one — you've got this!"
    public static let stepDownSuccessStatus = "YES! That's the one!"
    public static let stepDownSuccessFallbackPrompt = "You did it."
    public static let finalFailurePrompt = "Good practicing. Let's play."
    public static let successfulLaunchPrompt = "You did it. Let's play."
    public static let launchTitle = "Here we go!"
    public static let simpleLaunchTitle = "Let’s play together!"
    public static let launchKicker = "Up next"
    public static let afterChimeMilliseconds = 600.0
    public static let launchDelayMilliseconds = 1_200.0

    public struct QuietMessage: Equatable, Sendable {
        public let title: String
        public let body: String
        public let spoken: String?
        public let retryTitle: String
        public let laterTitle: String
    }

    public static let quiet = QuietMessage(
        title: "I couldn't hear you!", body: "Say it big — I'm all ears!",
        spoken: "I couldn't hear you! Say it big — I'm all ears!",
        retryTitle: "Try again", laterTitle: "Maybe later"
    )
    public static let wordCheckQuiet = QuietMessage(
        title: "Let's try that word again.", body: "Try the word in Echo's bubble, or come back later.",
        spoken: nil, retryTitle: "Try again", laterTitle: "Maybe later"
    )
    public static let microphoneUnavailable = QuietMessage(
        title: "Let's get a grown-up", body: "Another app may be using the microphone. Close it, then try again.",
        spoken: nil, retryTitle: "Try again", laterTitle: "Maybe later"
    )

    /// Describes where Rachel's existing sound take replaces the letter name.
    /// These are source asset identifiers, not URLs to fetch. The host resolves
    /// each to an approved local file before constructing PracticePrompt.parts.
    public struct SoundSlot: Equatable, Sendable {
        public let before: String
        public let recordingPath: String
        public let after: String
        public let wholeFallbackPath: String
    }

    public func soundSlot(in prompt: String, humanClipsEnabled: Bool = true) -> SoundSlot? {
        guard humanClipsEnabled, rung == .isolation else { return nil }
        let marker = "your " + soundName + " sound"
        guard let range = prompt.range(of: marker) else { return nil }
        // Same cuts as soundSlot(): keep "your" before the recording and
        // "sound" after it. Do not ask a synthesized voice to perform the sound.
        let beforeEnd = prompt.index(range.lowerBound, offsetBy: 4)
        let afterStart = prompt.index(range.upperBound, offsetBy: -5)
        return SoundSlot(before: String(prompt[..<beforeEnd]),
                         recordingPath: "/coach/say-echo/" + target.sound + "-sound.wav",
                         after: Self.trim(String(prompt[afterStart...])),
                         wholeFallbackPath: "/coach/say-echo/" + target.sound + ".mp3")
    }

    private static func trim(_ string: String) -> String { string.trimmingCharacters(in: .whitespacesAndNewlines) }
    private static func nonempty(_ string: String?) -> String? { string.flatMap { $0.isEmpty ? nil : $0 } }
}
