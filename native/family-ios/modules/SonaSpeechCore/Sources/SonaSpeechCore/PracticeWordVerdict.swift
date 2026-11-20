import Foundation

/// The local recognizer's existing three-way listening result. Unknown must
/// fall through to the acoustic check; it must never fail an unclear voice.
///
/// Exact HEAR2 port: `public/sona.js:7440–7595`. This describes a close try,
/// not pronunciation accuracy, and does not decide whether a rep was voiced.
public enum PracticeWordVerdict: String, Sendable, Codable {
    case pass
    case fail
    case unknown

    public static func evaluate(
        transcript: String,
        sound: String,
        word: String,
        level: String? = nil,
        frame: String? = nil
    ) -> PracticeWordVerdict {
        let sound = sound.uppercased()
        let originalTokens = tokens(transcript)
        guard !originalTokens.isEmpty else { return .unknown }

        // A parent's "say rabbit" is coaching, not the child's production.
        var said: [String] = []
        var index = 0
        while index < originalTokens.count {
            if ["say", "said", "saying"].contains(originalTokens[index]) {
                index += 2
            } else {
                said.append(originalTokens[index])
                index += 1
            }
        }
        let word = replacing(word.lowercased(), "[^a-z']", with: "")
        if let frame, !frame.isEmpty {
            let skip = Set(tokens(frame).filter { $0 != word })
            said = said.filter { !skip.contains($0) }
        }
        let content = said.filter { !filler.contains($0) || containsSound($0, sound: sound) }
        guard !content.isEmpty else { return .unknown }

        let bare = level == "isolation" || word.isEmpty || word == (soundSay[sound] ?? "")
        if bare {
            let own = Set(replacing(soundSay[sound] ?? sound.lowercased(), "[aeiou]", with: ""))
            for token in content where containsSound(token, sound: sound) {
                let count = token.filter { own.contains($0) }.count
                if token.count <= 3 || count * 2 >= token.count { return .pass }
            }
            return .fail
        }

        let variants = variants(word, sound: sound)
        let near = max(1, word.count / 3)
        let substitutions = substitutions[sound] ?? []
        for token in content {
            for variant in variants {
                if token == variant || token == variant + "s" || token == variant + "es" || token == variant + "'s" {
                    return .pass
                }
            }
            let carries = containsSound(token, sound: sound) || substitutions.contains { !$0.isEmpty && token.contains($0) }
            if carries && isNear(token, word, distance: near) { return .pass }
        }
        return .fail
    }

    private static let spelling: [String: String] = [
        "R": "r", "L": "l", "S": "s(?!h)|c(?=[eiy])", "Z": "z", "SH": "sh", "CH": "t?ch", "J": "dge|j|g(?=[eiy])",
        "K": "ck|k|q|c(?![eiyh])", "G": "g", "F": "ph|f", "V": "v", "TH": "th", "THV": "th",
        "P": "p", "B": "b", "M": "m", "N": "n", "T": "t(?!h)", "D": "d"
    ]
    private static let substitutions: [String: [String]] = [
        "R": ["w", "l"], "L": ["w", "y"], "S": ["th", "t", "sh"], "Z": ["th", "d", "s"], "SH": ["s", "ch"],
        "CH": ["sh", "t", "ts"], "J": ["d", "z", "ch"], "TH": ["f", "s", "t", "d"], "THV": ["d", "v", "z"],
        "K": ["t"], "G": ["d"], "F": ["p", "b"], "V": ["b", "f"]
    ]
    private static let finalSubstitutions: [String: [String]] = ["R": ["", "h", "w"], "L": ["", "w", "o"]]
    private static let filler: Set<String> = [
        "a", "uh", "uhh", "um", "umm", "ah", "ahh", "aah", "eh", "oh", "ooh", "oo", "hmm", "hm", "mm", "mmm",
        "huh", "ha", "hah", "mhm", "er", "erm", "err", "aw", "ew", "whoa", "woah"
    ]
    private static let numbers = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"]
    // Kept identical to the existing SOUND_SAY table (`sona.js:3986`).
    private static let soundSay: [String: String] = [
        "R": "rrrr", "S": "sss", "L": "lll", "K": "kuh", "G": "guh", "F": "ffff", "V": "vvvv",
        "SH": "shhh", "CH": "chuh", "J": "juh", "TH": "thhh", "THV": "thuh", "Z": "zzz",
        "P": "puh", "B": "buh", "M": "mmm", "N": "nnn", "T": "tuh", "D": "duh"
    ]

    private static func replacing(_ string: String, _ pattern: String, with replacement: String) -> String {
        string.replacingOccurrences(of: pattern, with: replacement, options: .regularExpression)
    }

    private static func containsSound(_ string: String, sound: String) -> Bool {
        guard let pattern = spelling[sound], !string.isEmpty else { return false }
        return string.range(of: pattern, options: .regularExpression) != nil
    }

    private static func variants(_ word: String, sound: String) -> [String] {
        var result = [word]
        guard let pattern = spelling[sound], let expression = try? NSRegularExpression(pattern: pattern) else { return result }
        let string = word as NSString
        for match in expression.matches(in: word, range: NSRange(location: 0, length: string.length)) {
            let at = match.range.location
            let length = max(1, match.range.length)
            let substitutions = (substitutions[sound] ?? []) + (at + length >= string.length ? finalSubstitutions[sound] ?? [] : [])
            for substitution in substitutions {
                let variant = string.substring(to: at) + substitution + string.substring(from: at + length)
                if variant.count >= 2 { result.append(variant) }
            }
        }
        return result
    }

    private static func isNear(_ first: String, _ second: String, distance: Int) -> Bool {
        let first = Array(first.utf8), second = Array(second.utf8)
        guard abs(first.count - second.count) <= distance else { return false }
        var previous = Array(0...second.count)
        if first.isEmpty { return second.count <= distance }
        for i in 1...first.count {
            var row = [i]
            for j in 1...second.count {
                row.append(min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (first[i - 1] == second[j - 1] ? 0 : 1)))
            }
            previous = row
        }
        return previous[second.count] <= distance
    }

    private static func tokens(_ text: String) -> [String] {
        var text = text.lowercased()
        if let digits = try? NSRegularExpression(pattern: "[0-9]+") {
            let original = text as NSString
            // Replace from the end to preserve the original match ranges.
            for match in digits.matches(in: text, range: NSRange(location: 0, length: original.length)).reversed() {
                let value = original.substring(with: match.range)
                let name: String
                if let number = Int(value), numbers.indices.contains(number) { name = numbers[number] }
                else { name = value }
                if let range = Range(match.range, in: text) { text.replaceSubrange(range, with: " " + name + " ") }
            }
        }
        text = replacing(text, "[^a-z' ]+", with: " ")
        return text.split(separator: " ").map { replacing(String($0), "^'+|'+$", with: "") }.filter { !$0.isEmpty }
    }
}
