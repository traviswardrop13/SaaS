import Foundation
import SonaSpeechCore

/// Generated from the live Feed Echo page by export-feed-selection.mjs.
/// No word, distractor, position, cue or threshold is chosen by the native UI.
struct NativeFeedSelection: Decodable {
    struct Word: Decodable, Equatable {
        let word, emoji, position: String
    }
    struct Turn: Decodable, Equatable {
        let target: Word
        let choices: [Word]
        let ask, repeatAsk, markedWord: String
    }
    struct Policy: Decodable {
        let floorMilliseconds, historyMilliseconds, listenMilliseconds: Double
        let minimumRMS, roomMultiplier: Double
        let voicedFrames: Int
        let quietMilliseconds, settleMilliseconds, soundQuietMilliseconds, voiceTailMilliseconds: Double
        let roomPercentile, lowMaximumCentroid, lowMaximumHighFraction: Double
        let hissMinimumCentroid, hissMinimumHighFraction: Double
    }
    let title, sound, soundLabel, family, voice: String
    let voiceOn, soundOn, micReady: Bool
    let volume: Float
    let microphonePromise: String
    let lifetimeFed: Int
    let turns: [Turn]
    let policy: Policy

    var isSupported: Bool {
        !sound.isEmpty && !turns.isEmpty && policy.floorMilliseconds > 0
            && policy.historyMilliseconds >= policy.floorMilliseconds && policy.listenMilliseconds > 0
            && policy.minimumRMS > 0 && policy.roomMultiplier > 0 && policy.voicedFrames > 0
            && policy.quietMilliseconds > 0 && (0...1).contains(policy.roomPercentile)
            && turns.allSatisfy { turn in
                !turn.target.word.isEmpty && turn.choices.contains { $0.word == turn.target.word }
            }
    }
}

/// Feed's four-frame detector is deliberately separate from charge and SayPlay.
/// It keeps only bounded level/shape aggregates. Only a subsequent on-device
/// word verdict can turn a nominated burst into an accepted game saying.
struct NativeFeedBurstDetector {
    private struct Shape {
        var magnitude = 0.0, frequency = 0.0, high = 0.0
        mutating func add(_ other: Self) {
            magnitude += other.magnitude; frequency += other.frequency; high += other.high
        }
    }
    private struct Sample { let time, level: Double; let shape: Shape }
    private let policy: NativeFeedSelection.Policy
    private let family: String
    private(set) var roomFloor: Double?
    private(set) var hasBurst = false
    private(set) var listeningReady = false
    private var history: [Sample] = []
    private var lastTime: Double?
    private var lastLoud = 0.0
    private var nominated = false

    init(policy: NativeFeedSelection.Policy, family: String) { self.policy = policy; self.family = family }

    mutating func beginWord() {
        history.removeAll(keepingCapacity: true)
        hasBurst = false; listeningReady = false; nominated = false; lastTime = nil
    }

    mutating func ingest(_ frame: PracticeAcousticFrame) -> Bool {
        guard frame.quietObservation(threshold: policy.minimumRMS) != nil else {
            history.removeAll(keepingCapacity: true); hasBurst = false; nominated = false; listeningReady = false
            return false
        }
        let now = frame.timestampMilliseconds
        guard lastTime == nil || now > lastTime! else { return false }
        lastTime = now
        let rms = frame.energyRMS ?? sqrt(frame.samples.reduce(0) { $0 + Double($1) * Double($1) } / Double(frame.samples.count))
        history.append(Sample(time: now, level: rms, shape: shape(frame)))
        while let first = history.first, now - first.time > policy.historyMilliseconds { history.removeFirst() }
        if let first = history.first, now - first.time >= policy.floorMilliseconds {
            let levels = history.filter { now - $0.time <= policy.floorMilliseconds }.map(\.level).sorted()
            if !levels.isEmpty {
                let index = Int(floor(Double(levels.count - 1) * policy.roomPercentile))
                roomFloor = min(roomFloor ?? levels[index], levels[index])
            }
        }
        guard let roomFloor, !nominated else { return false }
        listeningReady = true
        let threshold = max(policy.minimumRMS, roomFloor * policy.roomMultiplier)
        if hasBurst {
            if rms > threshold { lastLoud = now }
            if now - lastLoud >= policy.quietMilliseconds { nominated = true; return true }
        } else {
            var voiced = 0, sum = Shape()
            for item in history {
                if item.level > threshold {
                    voiced += 1; sum.add(item.shape)
                    if voiced >= policy.voicedFrames {
                        if !allows(sum) { voiced = 0; sum = Shape() }
                        else { hasBurst = true; lastLoud = now; break }
                    }
                } else { voiced = 0; sum = Shape() }
            }
        }
        return false
    }

    private func allows(_ shape: Shape) -> Bool {
        guard shape.magnitude > 0 else { return true }
        let centroid = shape.frequency / shape.magnitude, high = shape.high / shape.magnitude
        if family == "low" { return !(centroid > policy.lowMaximumCentroid && high > policy.lowMaximumHighFraction) }
        if family == "hiss" { return !(centroid < policy.hissMinimumCentroid && high < policy.hissMinimumHighFraction) }
        return true
    }

    private func shape(_ frame: PracticeAcousticFrame) -> Shape {
        let bytes = frame.shapeSpectrumBytes
        guard !bytes.isEmpty else { return Shape() }
        let binHz = frame.sampleRate / Double(bytes.count * 2)
        let lower = max(1, Int((90 / binHz).rounded()))
        let upper = min(bytes.count - 1, Int((12_000 / binHz).rounded()))
        let highBand = Int((3_500 / binHz).rounded())
        var result = Shape()
        if lower <= upper {
            for index in lower...upper {
                let value = pow(10, (-100 + Double(bytes[index]) * 70 / 255) / 20)
                result.magnitude += value; result.frequency += value * Double(index) * binHz
                if index >= highBand { result.high += value }
            }
        }
        return result
    }
}
