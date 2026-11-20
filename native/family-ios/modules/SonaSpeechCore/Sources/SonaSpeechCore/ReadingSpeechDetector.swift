import Foundation

/// Exact native SayCheck nomination/quiet behavior, kept distinct from both
/// SayPlay and charge. Source: public/saycheck.js listen(), 28 Sep–13 Nov.
/// Native opposite-family speech is `word`, never the browser's `shape` try.
public struct ReadingSpeechDetector {
    public enum Observation: Equatable { case candidate, differentWord }
    private struct Shape {
        var m = 0.0, fm = 0.0, hm = 0.0
        mutating func add(_ value: Shape) { m += value.m; fm += value.fm; hm += value.hm }
    }
    private struct Sample { let time: Double; let rms: Double; let shape: Shape }
    public let sound: String
    public private(set) var roomFloor: Double?
    public private(set) var listeningReady = false
    public private(set) var hasCandidate = false
    public private(set) var sawWrongFamily = false
    private var history: [Sample] = []
    private var quietAt: Double?
    private var lastLoud = 0.0
    private var lastTime: Double?
    private var finished = false
    private var gapAt: Double?

    public init(sound: String, roomFloor: Double? = nil) {
        self.sound = sound.uppercased()
        self.roomFloor = roomFloor.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
    }
    public mutating func begin() {
        history.removeAll(keepingCapacity: true); quietAt = nil; lastLoud = 0
        lastTime = nil; finished = false; hasCandidate = false
        sawWrongFamily = false; listeningReady = false; gapAt = nil
    }
    public mutating func beginGap() { gapAt = nil; lastTime = nil }
    public mutating func ingestGap(_ frame: PracticeAcousticFrame) -> Bool {
        guard let sample = sample(frame) else { gapAt = nil; return false }
        if sample.rms > max(0.04, (roomFloor ?? -1) * 3) { gapAt = nil; return false }
        if let gapAt { return sample.time - gapAt >= 200 }
        gapAt = sample.time; return false
    }
    public mutating func ingest(_ frame: PracticeAcousticFrame) -> Observation? {
        guard !finished else { return nil }
        guard let sample = sample(frame) else {
            history.removeAll(keepingCapacity: true); quietAt = nil; return nil
        }
        let now = sample.time
        history.append(sample)
        while let first = history.first, now - first.time > 3_000 { history.removeFirst() }
        if let first = history.first, now - first.time >= 450 {
            let values = history.filter { now - $0.time <= 450 }.map(\.rms).sorted()
            if !values.isEmpty {
                let value = values[Int(floor(Double(values.count - 1) * 0.2))]
                roomFloor = min(roomFloor ?? value, value)
            }
        }
        guard let roomFloor else { return nil }
        listeningReady = true
        let threshold = max(0.04, roomFloor * 3)
        var voiced = 0, shape = Shape()
        for value in history {
            if value.rms > threshold {
                voiced += 1; shape.add(value.shape)
                if voiced >= 5 {
                    if !familyAllows(shape) { voiced = 0; shape = Shape(); sawWrongFamily = true }
                    else { hasCandidate = true; break }
                }
            } else { voiced = 0; shape = Shape() }
        }
        if sample.rms > threshold { lastLoud = now; quietAt = nil }
        else if quietAt == nil { quietAt = now }
        if hasCandidate, let quietAt, now - quietAt >= 200 {
            finished = true; return .candidate
        }
        if sawWrongFamily, !hasCandidate, now - lastLoud >= 400 {
            finished = true; return .differentWord
        }
        return nil
    }
    private mutating func sample(_ frame: PracticeAcousticFrame) -> Sample? {
        guard frame.quietObservation(threshold: 0.04) != nil,
              lastTime == nil || frame.timestampMilliseconds > lastTime! else { return nil }
        lastTime = frame.timestampMilliseconds
        let rms = frame.energyRMS ?? sqrt(frame.samples.reduce(0) { $0 + Double($1) * Double($1) } / Double(frame.samples.count))
        var shape = Shape()
        let bytes = frame.shapeSpectrumBytes
        if !bytes.isEmpty {
            let bin = frame.sampleRate / Double(bytes.count * 2)
            let low = max(1, Int((90 / bin).rounded()))
            let high = min(bytes.count - 1, Int((12_000 / bin).rounded()))
            let upper = Int((3_500 / bin).rounded())
            if low <= high {
                for i in low...high {
                    let value = pow(10, (-100 + Double(bytes[i]) * 70 / 255) / 20)
                    shape.m += value; shape.fm += value * Double(i) * bin
                    if i >= upper { shape.hm += value }
                }
            }
        }
        return Sample(time: frame.timestampMilliseconds, rms: rms, shape: shape)
    }
    private func familyAllows(_ shape: Shape) -> Bool {
        guard shape.m > 0 else { return true }
        let center = shape.fm / shape.m, high = shape.hm / shape.m
        if ["R", "L", "M", "N", "B", "D", "G", "V", "THV"].contains(sound) { return !(center > 1_800 && high > 0.22) }
        if ["S", "Z", "SH", "CH", "J", "F", "TH"].contains(sound) { return !(center < 1_100 && high < 0.10) }
        return true
    }
}

/// The reader's original page policy includes a browser-only three-shape-try
/// fallback. A native word check must not turn unrelated words into that exit.
public struct ReadingSpeechProgress {
    public enum Outcome { case heard, shape, word, unverified, quiet }
    public enum Decision: Equatable { case listenAgain, askAgain, waitForTap, advanceHeard, advanceWithoutCredit }
    public let requiredSayings: Int
    public let requiresNativeWordCheck: Bool
    public private(set) var sayings = 0
    public private(set) var shapeTries = 0
    public private(set) var finished = false
    public init(requiredSayings: Int, requiresNativeWordCheck: Bool = true) {
        precondition(requiredSayings > 0)
        self.requiredSayings = requiredSayings; self.requiresNativeWordCheck = requiresNativeWordCheck
    }
    public mutating func accept(_ outcome: Outcome) -> Decision {
        guard !finished else { return .waitForTap }
        switch outcome {
        case .heard:
            sayings += 1
            if sayings >= requiredSayings { finished = true; return .advanceHeard }
            return .listenAgain
        case .shape:
            guard !requiresNativeWordCheck else { return .waitForTap }
            shapeTries += 1
            if shapeTries >= 3 { finished = true; return .advanceWithoutCredit }
            return .askAgain
        case .word, .unverified, .quiet: return .waitForTap
        }
    }
}
