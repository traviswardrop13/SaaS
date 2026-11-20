import Foundation

/// The six charge-start pages' keep-playing ear, distinct from SayPlay and
/// charge. Stores only aggregate analyser numbers; no microphone audio.
/// Source: arcade-slice.html listenFor and arcade-speech-help.js cardSpeechWait.
public struct ArcadeCheckpointDetector {
    public enum Timing: Sendable {
        case checkpoint
        case livePower
    }
    public struct Candidate: Equatable, Sendable {
        public let nominatedAtMilliseconds: Double
    }
    private struct Shape {
        var magnitude = 0.0, frequency = 0.0, high = 0.0
        mutating func add(_ other: Shape) {
            magnitude += other.magnitude; frequency += other.frequency; high += other.high
        }
    }
    private struct Sample { let time: Double; let level: Double; let shape: Shape }
    public let family: String
    public let requiresWord: Bool
    private let timing: Timing
    public private(set) var roomFloor: Double?
    public private(set) var listeningReady = false
    public private(set) var hasBurst = false
    private var history: [Sample] = []
    private var lastTime: Double?
    private var heardAt: Double?
    private var lastLoud = 0.0
    private var finished = false

    public init(family: String, requiresWord: Bool, roomFloor: Double? = nil, timing: Timing = .checkpoint) {
        self.family = family; self.requiresWord = requiresWord
        self.timing = timing
        self.roomFloor = roomFloor.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
    }

    public mutating func ingest(_ frame: PracticeAcousticFrame) -> Candidate? {
        guard !finished else { return nil }
        guard frame.quietObservation(threshold: 0.05) != nil else {
            // Both ears drop unavailable frames. For an optional power, the
            // eight-second deadline still honors an already heard real burst.
            history.removeAll(keepingCapacity: true)
            if timing == .checkpoint { heardAt = nil; hasBurst = false }
            lastLoud = frame.timestampMilliseconds; lastTime = nil
            return nil
        }
        guard lastTime == nil || frame.timestampMilliseconds > lastTime! else { return nil }
        lastTime = frame.timestampMilliseconds
        let value = sample(frame), now = value.time
        history.append(value)
        while let first = history.first, now - first.time > 3_000 { history.removeFirst() }
        if let first = history.first, now - first.time >= 450 {
            let levels = history.filter { now - $0.time <= 450 }.map(\.level).sorted()
            if !levels.isEmpty {
                let observed = levels[Int(floor(Double(levels.count - 1) * 0.2))]
                roomFloor = min(roomFloor ?? observed, observed)
            }
        }
        guard let roomFloor else { return nil }
        listeningReady = true
        let threshold = max(0.05, roomFloor * 3.5)
        var voiced = 0, shape = Shape(), burst = false
        // Rejudge an early saying after a quiet breath repairs the floor.
        for item in history {
            if item.level > threshold {
                voiced += 1; shape.add(item.shape)
                if voiced >= 6 {
                    if familyAllows(shape) { burst = true; break }
                    voiced = 0; shape = Shape()
                }
            } else { voiced = 0; shape = Shape() }
        }
        guard burst else { return nil }
        hasBurst = true
        if heardAt == nil { heardAt = now; lastLoud = now }
        if value.level > threshold { lastLoud = now }
        guard let heardAt, now - heardAt >= 550 else { return nil }
        if timing == .checkpoint {
            guard now - lastLoud >= 200 || (!requiresWord && now - heardAt >= 2_500) else { return nil }
        }
        finished = true
        return Candidate(nominatedAtMilliseconds: heardAt)
    }

    private func sample(_ frame: PracticeAcousticFrame) -> Sample {
        let level = frame.energyRMS ?? sqrt(frame.samples.reduce(0) { $0 + Double($1) * Double($1) } / Double(frame.samples.count))
        let bytes = frame.shapeSpectrumBytes
        var shape = Shape()
        if !bytes.isEmpty {
            let bin = frame.sampleRate / Double(bytes.count * 2)
            let lo = max(1, Int((90 / bin).rounded()))
            let hi = min(bytes.count - 1, Int((12_000 / bin).rounded()))
            let upper = Int((3_500 / bin).rounded())
            if lo <= hi {
                for i in lo...hi {
                    let value = pow(10, (-100 + Double(bytes[i]) * 70 / 255) / 20)
                    shape.magnitude += value; shape.frequency += value * Double(i) * bin
                    if i >= upper { shape.high += value }
                }
            }
        }
        return Sample(time: frame.timestampMilliseconds, level: level, shape: shape)
    }

    private func familyAllows(_ shape: Shape) -> Bool {
        guard shape.magnitude > 0 else { return true }
        let centroid = shape.frequency / shape.magnitude, high = shape.high / shape.magnitude
        if family == "low" { return !(centroid > 1_800 && high > 0.22) }
        if family == "hiss" { return !(centroid < 1_100 && high < 0.10) }
        return true
    }
}
