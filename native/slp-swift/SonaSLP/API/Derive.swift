import Foundation

/// The same per-child facts the web dashboard derives (public/slp.html,
/// derive()), so the app and the web never disagree about who practiced.
/// The register rules hold here too: "pass rate" (did that sound like the
/// sound), never accuracy or a score, and no percentage under SMALL_N tries.
enum Day {
    static let fmt: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
    static func today() -> String { fmt.string(from: Date()) }
    static func add(_ iso: String, _ n: Int) -> String {
        guard let d = fmt.date(from: String(iso.prefix(10))) else { return iso }
        return fmt.string(from: Calendar(identifier: .gregorian).date(byAdding: .day, value: n, to: d) ?? d)
    }
    static func between(_ a: String, _ b: String) -> Int {
        guard let x = fmt.date(from: String(a.prefix(10))), let y = fmt.date(from: String(b.prefix(10))) else { return 0 }
        return Calendar(identifier: .gregorian).dateComponents([.day], from: x, to: y).day ?? 0
    }
    static func nice(_ iso: String) -> String {
        guard let d = fmt.date(from: String(iso.prefix(10))) else { return "" }
        let f = DateFormatter(); f.setLocalizedDateFormatFromTemplate("MMM d")
        return f.string(from: d)
    }
    static func ago(_ iso: String?) -> String {
        guard let iso, !iso.isEmpty else { return "never" }
        let n = between(iso, today())
        return n <= 0 ? "today" : n == 1 ? "yesterday" : "\(n) days ago"
    }
}

let SMALL_N = 20
let POSITION = ["i": "beginning", "m": "middle", "f": "end", "v": "vocalic R", "b": "blends", "mix": "anywhere"]
let ALL_SOUNDS = ["P", "B", "M", "N", "T", "D", "K", "G", "F", "V", "S", "Z", "SH", "CH", "J", "L", "R", "TH", "THV"]
func soundLabel(_ s: String) -> String { s == "THV" ? "TH (v)" : s }

struct WindowStats { var attempts = 0, passes = 0, days = 0, reps = 0
    var rate: Int? { attempts > 0 ? Int((Double(passes) / Double(attempts) * 100).rounded()) : nil }
}

extension Kid {
    var name: String {
        if let n = child, !n.isEmpty { return n }
        if let n = meta?.child, !n.isEmpty { return n }
        return synced == false ? "New family" : "Child"
    }
    var ageText: String { age?.text.isEmpty == false ? age!.text : (meta?.age?.text ?? "") }
    var archived: Bool { meta?.archived == true }
    var hwStatus: String { hw?.status ?? "none" }

    var targets: [String] {
        if hwStatus == "active", let s = hw?.hw?.sounds, !s.isEmpty { return s.map { $0.uppercased() } }
        let f = (focus ?? "").split(whereSeparator: { $0 == "," || $0 == " " }).map { $0.trimmingCharacters(in: .whitespaces).uppercased() }.filter { ALL_SOUNDS.contains($0) }
        if !f.isEmpty { return f }
        let out = outcomes ?? [:]
        return out.keys.sorted { (out[$0]?.attempts ?? 0) > (out[$1]?.attempts ?? 0) }.prefix(2).map { $0 }
    }

    func window(_ from: String, _ to: String, _ sounds: [String]? = nil) -> WindowStats {
        var w = WindowStats(); var days = Set<String>(); var reps = 0
        for (s, o) in outcomes ?? [:] {
            if let sounds, !sounds.isEmpty, !sounds.contains(s) { continue }
            for (day, d) in o.days ?? [:] where day >= from && day <= to {
                w.attempts += d.a ?? 0; w.passes += d.p ?? 0
                if (d.a ?? 0) > 0 { days.insert(day) }
            }
        }
        for (day, n) in hw?.days ?? [:] where day >= from && day <= to {
            reps += n; if n > 0 { days.insert(day) }
        }
        w.days = days.count; w.reps = max(reps, w.attempts)
        return w
    }

    var lastPracticed: String {
        var last = ""
        for (_, o) in outcomes ?? [:] {
            if let l = o.lastAt?.prefix(10), String(l) > last { last = String(l) }
            for (day, d) in o.days ?? [:] where (d.a ?? 0) > 0 && day > last { last = day }
        }
        for (day, n) in hw?.days ?? [:] where n > 0 && day > last { last = day }
        return last
    }
    var joined: Bool { !(outcomes ?? [:]).isEmpty || meta?.joinedAt != nil || at != nil }
    var lastDaysAgo: Int? { lastPracticed.isEmpty ? nil : Day.between(lastPracticed, Day.today()) }
    var week: WindowStats { let t = Day.today(); return window(Day.add(t, -6), t) }
    var twoWeeks: WindowStats { let t = Day.today(); return window(Day.add(t, -13), t, targets) }
    var quiet: Bool { joined && (lastDaysAgo == nil || lastDaysAgo! >= 7) }
    var due: String { hw?.hw?.due ?? "" }

    /// The fixed note a clinician pastes into their notes. Word for word the
    /// web's noteFor(), hedge included.
    var note: String {
        let t = Day.today(); let active = hwStatus == "active" ? hw?.hw : nil
        let from = (active?.start).flatMap { $0 <= t ? $0 : nil } ?? Day.add(t, -13)
        let n = Day.between(from, t) + 1
        let s = window(from, t)
        var lines = ["Between \(Day.nice(from)) and \(Day.nice(t)), \(name) practiced on \(s.days) of \(n) days" + (s.days > 0 ? " (\(Int((Double(s.reps) / Double(s.days)).rounded())) tries a day)" : "") + "."]
        let pos: String = { if let p = active?.pos ?? hw?.hw?.pos, p != "mix", let w = POSITION[p] { return " in " + w } ; return "" }()
        for snd in targets {
            let w = window(from, t, [snd])
            guard w.attempts > 0 else { continue }
            if w.attempts < SMALL_N { lines.append("\(soundLabel(snd))\(pos): too few attempts to read yet (\(w.attempts)).") }
            else { lines.append("\(soundLabel(snd))\(pos): \(w.rate ?? 0)% pass rate over \(w.attempts) attempts.") }
        }
        lines.append("A practice snapshot from at-home listening on the family's device; not an evaluation.")
        return lines.joined(separator: " ")
    }
}
