import Foundation

/// The native SayPlay gate's five-frame family check, not charge's practice
/// detector. Literal source: public/sayplay.js nativeWordListen/nativeWordGap.
/// It nominates a whole saying; only that saying's on-device HEAR2 pass may
/// credit play. The bounded history contains level/shape numbers, never audio.
public struct SpeechGameBurstDetector {
    public struct Candidate: Equatable, Sendable { public let burstAtMilliseconds: Double }
    private struct Shape {
        var magnitude = 0.0, frequency = 0.0, high = 0.0
        mutating func add(_ other: Shape) {
            magnitude += other.magnitude; frequency += other.frequency; high += other.high
        }
    }
    private struct Sample { let time: Double; let level: Double; let shape: Shape }
    public let sound: String
    public private(set) var roomFloor: Double?
    public private(set) var listeningReady = false
    public private(set) var hasBurst = false
    public private(set) var burstAtMilliseconds = 0.0
    private var history: [Sample] = []
    private var lastTime: Double?
    private var lastLoud = 0.0
    private var gapAt: Double?
    private var notBefore = 0.0
    private var nominated = false

    public init(sound: String, roomFloor: Double? = nil) {
        self.sound = sound.uppercased()
        self.roomFloor = roomFloor.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
    }

    public mutating func beginSaying(notBeforeMilliseconds: Double = 0) {
        history.removeAll(keepingCapacity: true); hasBurst = false; nominated = false
        listeningReady = false; lastLoud = 0; gapAt = nil; lastTime = nil
        notBefore = notBeforeMilliseconds
    }

    /// Feed each distinct native 60-Hz analyser position exactly once. A missing
    /// capture is not quiet, and a held word is not finished by a timer.
    public mutating func ingest(_ frame: PracticeAcousticFrame) -> Candidate? {
        guard let value = sample(frame) else { resetMissingInput(); return nil }
        let now = value.time
        history.append(value)
        while let first = history.first, now - first.time > 3_000 { history.removeFirst() }
        if let first = history.first, now - first.time >= 450 {
            let levels = history.filter { now - $0.time <= 450 }.map(\.level).sorted()
            if !levels.isEmpty {
                let observedFloor = levels[Int(floor(Double(levels.count - 1) * 0.2))]
                roomFloor = min(roomFloor ?? observedFloor, observedFloor)
            }
        }
        guard let roomFloor, !nominated else { return nil }
        listeningReady = true
        let threshold = max(0.04, roomFloor * 3)
        if hasBurst {
            if value.level > threshold { lastLoud = now }
            if now - lastLoud >= 200 {
                nominated = true
                return Candidate(burstAtMilliseconds: burstAtMilliseconds)
            }
        } else {
            var voiced = 0, shape = Shape()
            for item in history where item.time >= notBefore {
                if item.level > threshold {
                    voiced += 1; shape.add(item.shape)
                    if voiced >= 5 {
                        if !familyAllows(shape) { voiced = 0; shape = Shape() }
                        else {
                            hasBurst = true; burstAtMilliseconds = item.time; lastLoud = now
                            break
                        }
                    }
                } else { voiced = 0; shape = Shape() }
            }
        }
        return nil
    }

    /// Called after the preceding recognizer has finished. Even a quiet tail
    /// before that finish cannot stand in for these 200 ms of fresh quiet.
    public mutating func ingestGap(_ frame: PracticeAcousticFrame, notBeforeMilliseconds: Double) -> Bool {
        guard let value = sample(frame), let roomFloor else { gapAt = nil; return false }
        if value.level > max(0.04, roomFloor * 3) { gapAt = nil; return false }
        if let gapAt {
            return value.time - gapAt >= 200 && value.time >= notBeforeMilliseconds
        }
        gapAt = value.time
        return false
    }

    public mutating func beginGap() { gapAt = nil; lastTime = nil }

    private mutating func resetMissingInput() {
        history.removeAll(keepingCapacity: true); hasBurst = false; gapAt = nil
        nominated = false; listeningReady = false
    }

    private mutating func sample(_ frame: PracticeAcousticFrame) -> Sample? {
        guard frame.quietObservation(threshold: 0.04) != nil,
              lastTime == nil || frame.timestampMilliseconds > lastTime! else { return nil }
        lastTime = frame.timestampMilliseconds
        let level = frame.energyRMS ?? sqrt(frame.samples.reduce(0) { $0 + Double($1) * Double($1) } / Double(frame.samples.count))
        var shape = Shape()
        let bytes = frame.shapeSpectrumBytes
        if !bytes.isEmpty {
            let binHz = frame.sampleRate / Double(bytes.count * 2)
            let low = max(1, Int((90 / binHz).rounded()))
            let high = min(bytes.count - 1, Int((12_000 / binHz).rounded()))
            let upper = Int((3_500 / binHz).rounded())
            if low <= high {
                for i in low...high {
                    let value = pow(10, (-100 + Double(bytes[i]) * 70 / 255) / 20)
                    shape.magnitude += value; shape.frequency += value * Double(i) * binHz
                    if i >= upper { shape.high += value }
                }
            }
        }
        return Sample(time: frame.timestampMilliseconds, level: level, shape: shape)
    }

    private func familyAllows(_ shape: Shape) -> Bool {
        guard shape.magnitude > 0 else { return true }
        let centroid = shape.frequency / shape.magnitude, high = shape.high / shape.magnitude
        if ["R", "L", "M", "N", "B", "D", "G", "V", "THV"].contains(sound) {
            return !(centroid > 1_800 && high > 0.22)
        }
        if ["S", "Z", "SH", "CH", "J", "F", "TH"].contains(sound) {
            return !(centroid < 1_100 && high < 0.10)
        }
        return true
    }
}
