import Foundation

/// The local recognizer's existing three-way listening result. Sound/syllable
/// callers may use acoustic fallback; native words require a positive match.
///
/// Exact HEAR2 port, including current positional syllables/blend drops.
/// This describes a close try,
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
        frame: String? = nil,
        position: String = ""
    ) -> PracticeWordVerdict {
        let sound = sound.uppercased()
        let originalTokens = tokens(transcript)
        guard !originalTokens.isEmpty else { return .unknown }

        // Source coaching can span two syllable beats. "Say" may itself be
        // part of a medial syllable's target or its usual-error form.
        let originalWord = word.lowercased()
        let parts = max(1, originalWord.components(separatedBy: CharacterSet(charactersIn: "- ").union(.whitespacesAndNewlines)).filter { !$0.isEmpty }.count)
        let wordFlat = flat(originalWord)
        var mine = Set<String>()
        if level == "syllable", !position.isEmpty, position != "i", position != "mix" {
            for part in originalWord.components(separatedBy: CharacterSet(charactersIn: "- ").union(.whitespacesAndNewlines)).filter({ !$0.isEmpty }) {
                mine.insert(part)
                mine.formUnion(variants(part, sound: sound))
            }
        }
        var said: [String] = []
        var index = 0
        while index < originalTokens.count {
            if ["say", "said", "saying"].contains(originalTokens[index]), !mine.contains(originalTokens[index]) {
                var n = 1
                if parts > 1 {
                    var got = ""
                    n = 0
                    var j = index + 1
                    while j < originalTokens.count, n < parts {
                        let next = got + flat(originalTokens[j])
                        if next.isEmpty || !wordFlat.hasPrefix(next) { break }
                        got = next; n += 1
                        if got == wordFlat { break }
                        j += 1
                    }
                    n = max(1, n)
                }
                index += n + 1
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

        let dropped = position == "b" ? droppedForms(word, sound: sound) : []
        if level == "syllable", !position.isEmpty, position != "i", position != "mix" {
            return place(said, word: originalWord, sound: sound, dropped: dropped, position: position)
        }
        let variants = variants(word, sound: sound)
        let near = max(1, word.count / 3)
        let substitutions = substitutions[sound] ?? []
        for token in content {
            if dropped.contains(token) || dropped.contains(where: { token == $0 + "s" }) { continue }
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

    private static func droppedForms(_ word: String, sound: String) -> [String] {
        guard let pattern = spelling[sound], let expression = try? NSRegularExpression(pattern: pattern) else { return [] }
        let string = word as NSString
        var out: [String] = []
        func consonant(_ index: Int) -> Bool {
            guard index >= 0, index < string.length else { return false }
            return string.substring(with: NSRange(location: index, length: 1)).range(of: "[b-df-hj-np-tv-z]", options: .regularExpression) != nil
        }
        for match in expression.matches(in: word, range: NSRange(location: 0, length: string.length)) {
            let at = match.range.location, length = max(1, match.range.length)
            if consonant(at - 1) || consonant(at + length) {
                out.append(string.substring(to: at) + string.substring(from: at + length))
            }
        }
        return out
    }

    private static func flat(_ text: String) -> String {
        replacing(replacing(text, "[^a-z]", with: ""), "([aeiou])h(?![aeiou])", with: "$1")
    }
    private static func hasConsonant(_ text: String) -> Bool {
        let clean = replacing(replacing(text, "e$", with: ""), "[wy](?![aeiou])", with: "")
        return clean.range(of: "[b-df-gj-np-tv-z]", options: .regularExpression) != nil
    }

    private static let alike: [String: [String]] = [
        "ar": ["are", "r"], "or": ["ore", "oar"], "air": ["heir", "ere", "eyre"],
        "ate": ["eight"], "kray": ["cray"], "grew": ["grue"], "clue": ["klue"], "flee": ["flea"], "ski": ["skee"]
    ]
    private static let letters: [String: String] = [
        "b":"bee", "c":"see", "d":"dee", "e":"ee", "f":"ef", "g":"jee", "h":"aitch", "j":"jay", "k":"kay", "l":"el", "m":"em", "n":"en", "o":"oh", "p":"pee", "r":"ar", "s":"es", "t":"tee", "u":"you", "v":"vee", "z":"zee"
    ]

    private struct SyllableCatalog: Decodable {
        let version: Int
        let tables: [SyllableTable]
    }
    private struct SyllableTable: Decodable {
        let sound: String, position: String
        let items: [SyllableItem]
    }
    private struct SyllableItem: Decodable { let text: String, say: String }
    private static let syllableTables: [SyllableTable]? = {
        guard let url = Bundle.module.url(forResource: "PracticeSyllableTables", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let catalog = try? JSONDecoder().decode(SyllableCatalog.self, from: data),
              catalog.version == 1, !catalog.tables.isEmpty else { return nil }
        return catalog.tables
    }()

    /// Literal _hearPlace: cover the ENTIRE transcript with authored syllable
    /// forms, rather than finding a target substring in unrelated speech.
    private static func place(_ heard: [String], word: String, sound: String, dropped: [String], position: String) -> PracticeWordVerdict {
        guard let catalog = syllableTables else { return .unknown }
        let tokens = heard.map { $0.count == 1 ? letters[$0] ?? $0 : $0 }
        func saysSomething(_ token: String) -> Bool { !filler.contains(token) || containsSound(token, sound: sound) }
        let w = replacing(word, "[^a-z]", with: ""), wf = flat(w)
        var errors = (substitutions[sound] ?? []).map { $0.uppercased() }
        if (substitutions[sound] ?? []).contains("th") { errors.append("THV") }
        var table: [String] = [], elsewhere: [String] = []
        for entry in catalog {
            if entry.sound == sound, entry.position == position {
                for item in entry.items { table.append(item.text); table.append(item.say) }
            } else if entry.sound != sound, !errors.contains(entry.sound) {
                elsewhere += entry.items.map { flat($0.text) }
            }
        }
        let all = variants(w, sound: sound).map(flat) + (alike[w] ?? []).map(flat)
        let forms = all.filter { hasConsonant($0) && ($0 == wf || !elsewhere.contains($0)) }
        let gone = dropped.map(flat)
        let parts = max(1, word.components(separatedBy: CharacterSet(charactersIn: "- ").union(.whitespacesAndNewlines)).filter { !$0.isEmpty }.count)
        func covered(_ accepts: (String) -> Bool) -> Bool {
            var reach = [Int](repeating: 0, count: tokens.count + 1)
            reach[0] = 1
            for i in tokens.indices {
                if reach[i] == 0 { continue }
                if !saysSomething(tokens[i]) { reach[i + 1] = max(reach[i + 1], reach[i]) }
                for n in 1...min(parts, tokens.count - i) {
                    if n > 1, !saysSomething(tokens[i + n - 1]) { continue }
                    if accepts(flat(tokens[i..<(i + n)].joined())) { reach[i + n] = 2 }
                }
            }
            return reach[tokens.count] == 2
        }
        if covered({ forms.contains($0) && !gone.contains($0) }) { return .pass }
        if sound == "R", position == "v" || position == "f" { table += ["er", "err", "ur"] }
        var others = gone
        for entry in table {
            let value = replacing(entry.lowercased(), "[^a-z]", with: "")
            for candidate in [value] + (alike[value] ?? []) {
                let f = flat(candidate)
                if !f.isEmpty, !forms.contains(f), f != wf, !others.contains(f) { others.append(f) }
            }
        }
        if covered({ others.contains($0) }) { return .fail }
        let subs = substitutions[sound] ?? []
        func k(_ value: String) -> String { value.replacingOccurrences(of: "c", with: "k") }
        let cluster = (w.range(of: "^[^aeiouy]+", options: .regularExpression)).map { String(w[$0]) } ?? ""
        let partner = position == "b" ? k(replacing(cluster, spelling[sound] ?? "$^", with: "")) : ""
        let melts = (position == "f" || position == "v") && finalSubstitutions[sound] != nil
        for token in tokens {
            let f = flat(token)
            if !saysSomething(token) || gone.contains(f) { continue }
            if melts, !f.isEmpty, !hasConsonant(f) { return .unknown }
            let own = all.contains { !$0.isEmpty && f.hasPrefix($0) } || containsSound(token, sound: sound)
            if !own, !partner.isEmpty, partner.contains(where: { !k(token).contains($0) }) { continue }
            let carries = own || subs.contains { !$0.isEmpty && token.contains($0) }
            if carries { return .unknown }
        }
        return .fail
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
