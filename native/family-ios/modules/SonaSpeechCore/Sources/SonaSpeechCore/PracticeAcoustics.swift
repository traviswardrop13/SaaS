import Foundation

/// One analyser tick. Evidence uses unsmoothed float samples and dB bins from
/// the same FFT. Energy and shape deliberately keep the web page's separate
/// 512-sample analyser; a capture adapter should supply those two arguments.
/// No samples are saved, uploaded, or exposed in observations.
public struct PracticeAcousticFrame: Sendable {
    public let timestampMilliseconds: Double
    public let sampleRate: Double
    public let samples: [Float]
    public let spectrumDecibels: [Float]
    public let energyRMS: Double?
    public let shapeSpectrumBytes: [UInt8]
    public let isAvailable: Bool

    public init(timestampMilliseconds: Double, sampleRate: Double, samples: [Float],
                spectrumDecibels: [Float], energyRMS: Double? = nil,
                shapeSpectrumBytes: [UInt8] = [], isAvailable: Bool = true) {
        self.timestampMilliseconds = timestampMilliseconds
        self.sampleRate = sampleRate
        self.samples = samples
        self.spectrumDecibels = spectrumDecibels
        self.energyRMS = energyRMS
        self.shapeSpectrumBytes = shapeSpectrumBytes
        self.isAvailable = isAvailable
    }

    fileprivate var isValid: Bool {
        isAvailable && timestampMilliseconds.isFinite && sampleRate.isFinite && sampleRate > 0 &&
        samples.count >= 4 && spectrumDecibels.count == samples.count / 2 &&
        samples.allSatisfy { $0.isFinite } &&
        spectrumDecibels.allSatisfy { $0.isFinite || $0 == -.infinity } &&
        (energyRMS == nil || (energyRMS!.isFinite && energyRMS! >= 0))
    }

    fileprivate var rms: Double {
        if let energyRMS { return energyRMS }
        return sqrt(samples.reduce(0) { $0 + Double($1) * Double($1) } / Double(samples.count))
    }

    /// A missing/starved feed is not observed quiet. Word-tail and between-word
    /// clocks use this observation, never elapsed time without fresh input.
    public func quietObservation(threshold: Double) -> Bool? {
        guard isValid, !isStarved, threshold.isFinite, threshold > 0 else { return nil }
        return rms <= threshold
    }

    /// charge.html:1660–1681. A gap is audio-path starvation, never room noise.
    fileprivate var isStarved: Bool {
        guard rms > 0 else { return false }
        var run = 0
        for sample in samples {
            run = sample == 0 ? run + 1 : 0
            if run >= 96 { return true }
        }
        return false
    }
}

public enum PracticeEvidenceRoute: String, Sendable, Equatable {
    case voiced, sibilant, short, changing
}

public enum PracticeAcousticVerdict: String, Sendable, Equatable {
    case pass, fail, unknown
}

/// Aggregate shape numbers only. This is the existing broad-family check,
/// never a claim that a word was pronounced correctly (charge.html:1314–1344).
public struct PracticeShapeSnapshot: Sendable, Equatable {
    public fileprivate(set) var centroidNumerator = 0.0
    public fileprivate(set) var magnitude = 0.0
    public fileprivate(set) var highMagnitude = 0.0
    public fileprivate(set) var frames = 0
    public var centroidHertz: Double { magnitude > 0 ? centroidNumerator / magnitude : 0 }
    public var highBandFraction: Double { magnitude > 0 ? highMagnitude / magnitude : 0 }

    public init() {}

    public func verdict(for sound: String) -> PracticeAcousticVerdict {
        guard frames >= 12, magnitude > 0 else { return .unknown }
        let sound = sound.uppercased()
        let low: Set<String> = ["R", "L", "M", "N", "B", "D", "G", "V", "THV"]
        let hiss: Set<String> = ["S", "Z", "SH", "CH", "J", "F", "TH"]
        if low.contains(sound), centroidHertz > 1800, highBandFraction > 0.22 { return .fail }
        if hiss.contains(sound), centroidHertz < 1100, highBandFraction < 0.10 { return .fail }
        return .pass
    }

    fileprivate mutating func add(_ bytes: [UInt8], sampleRate: Double) {
        guard !bytes.isEmpty else { return }
        let binHz = sampleRate / Double(bytes.count * 2)
        let low = max(1, Int((90 / binHz).rounded()))
        let high = min(bytes.count - 1, Int((12000 / binHz).rounded()))
        let highStart = Int((3500 / binHz).rounded())
        guard low <= high else { return }
        var total = 0.0, frequency = 0.0, upper = 0.0
        for index in low...high {
            let value = pow(10, (-100 + Double(bytes[index]) * 70 / 255) / 20)
            total += value
            frequency += value * Double(index) * binHz
            if index >= highStart { upper += value }
        }
        if total > 0 {
            centroidNumerator += frequency
            magnitude += total
            highMagnitude += upper
            frames += 1
        }
    }
}

public struct PracticeRoomSnapshot: Sendable, Equatable {
    public let rms: Double
    public let backgroundDecibels: [Float]
    public let backgroundRMS: Double
}

public struct PracticeAcousticObservation: Sendable, Equatable {
    public let countedRep: Bool
    public let totalReps: Int
    public let listeningReady: Bool
    public let evidenceRoute: PracticeEvidenceRoute?
    public let threshold: Double
    public let shape: PracticeShapeSnapshot
    /// In native word/sentence mode, speech evidence nominates one saying;
    /// only its own accepted on-device word check can credit a rep.
    public let nominatedSaying: Bool
}

/// Deterministic port of public/charge.html's REPGUARD1 detector. These are
/// existing clinical thresholds, not tuning knobs. Caller owns quiet windows,
/// the 20-second active clock, cancellation and the 350 ms final evidence tail.
/// beginWindow drops an unfinished burst while preserving heard reps and shape.
public struct PracticeAcoustics: Sendable {
    public private(set) var totalReps = 0
    public private(set) var shape = PracticeShapeSnapshot()
    public private(set) var room: PracticeRoomSnapshot?
    public private(set) var roomWasTooLoud = false
    public private(set) var listeningReady = false
    public private(set) var threshold = 0.0
    public private(set) var requiredReps: Int
    public private(set) var requiresWordVerification = false

    private var evidence = SpeechEvidence()
    private var windowStartedAt: Double?
    private var windowHasReadRoom = false
    private var windowRMS: [Double] = []
    private var learningRoom: [Double]?
    private var voicedFrames = 0
    private var silentFrames = 0
    private var inBurst = false
    private var counted = false
    private var burstAt = 0.0
    private var lastRepAt = 0.0
    private var pendingShape: [([UInt8], Double)] = []
    private var lastFrameTime: Double?
    private var probeStartedAt: Double?
    private var probeFirstAudioAt: Double?
    private var probeRMS: [Double] = []
    private var probeEvidence = SpeechEvidence()
    private var pendingSayingAt: Double?
    private var nominatedSaying = false

    public init(requiredReps: Int = 5) { self.requiredReps = max(1, requiredReps) }

    /// A new attempt clears counts/shape but retains this visit's known room.
    public mutating func beginAttempt(requiredReps: Int = 5, requiresWordVerification: Bool = false) {
        self.requiredReps = max(1, requiredReps)
        self.requiresWordVerification = requiresWordVerification
        totalReps = 0
        shape = PracticeShapeSnapshot()
        threshold = 0
        lastRepAt = 0
        evidence = SpeechEvidence()
        windowStartedAt = nil
        listeningReady = false
        resetBurst()
    }

    /// Measure in known silence before the first model, never during a prompt.
    /// charge.html:1545–1582, 1687–1727: 300 ms of running input, 600 ms startup.
    public mutating func beginRoomMeasurement(atMilliseconds time: Double) {
        probeStartedAt = time
        probeFirstAudioAt = nil
        probeRMS = []
        probeEvidence = SpeechEvidence()
    }

    /// True when the bounded probe has ended. An incomplete/unavailable probe
    /// adopts nothing. Digital startup zeros do not spend its 300 ms reading.
    @discardableResult public mutating func measureRoom(_ frame: PracticeAcousticFrame) -> Bool {
        guard room == nil, let started = probeStartedAt else { return true }
        guard frame.isValid else { return false }
        probeEvidence.configure(frame)
        let level = frame.rms
        let gap = frame.isStarved
        if probeFirstAudioAt == nil, level > 0, !gap { probeFirstAudioAt = frame.timestampMilliseconds }
        if let began = probeFirstAudioAt {
            if !gap {
                probeRMS.append(level)
                probeEvidence.calibrate(frame)
            }
            if frame.timestampMilliseconds - began >= 300 {
                let low = Self.roomLevel(probeRMS)
                if Self.roomUsable(probeRMS), let bg = probeEvidence.measured() {
                    if low <= 0.03 { room = PracticeRoomSnapshot(rms: low, backgroundDecibels: bg, backgroundRMS: low) }
                    else { roomWasTooLoud = true }
                }
                endRoomMeasurement()
                return true
            }
        } else if frame.timestampMilliseconds - started > 600 {
            endRoomMeasurement()
            return true
        }
        return false
    }

    public mutating func endRoomMeasurement() {
        probeStartedAt = nil
        probeFirstAudioAt = nil
        probeRMS = []
        probeEvidence = SpeechEvidence()
    }

    public mutating func beginWindow(atMilliseconds time: Double) {
        windowStartedAt = time
        lastFrameTime = nil
        windowRMS = []
        windowHasReadRoom = false
        evidence.resample()
        resetBurst()
        listeningReady = false
        learningRoom = threshold > 0 && room == nil && roomWasTooLoud ? [] : nil
    }

    /// Pause, mic replacement and unavailable feed must requalify the next
    /// burst; a half-spoken old burst cannot join a new one after Resume.
    public mutating func resetBurst() {
        pendingSayingAt = nil
        nominatedSaying = false
        resetEnergyBurst()
    }

    private mutating func resetEnergyBurst() {
        voicedFrames = 0
        silentFrames = 0
        inBurst = false
        counted = false
        pendingShape = []
        evidence.drop()
    }

    public mutating func process(_ frame: PracticeAcousticFrame) -> PracticeAcousticObservation {
        nominatedSaying = false
        guard let started = windowStartedAt, frame.isValid,
              lastFrameTime == nil || frame.timestampMilliseconds > lastFrameTime! else {
            if !frame.isValid { resetBurst(); listeningReady = false }
            return observation()
        }
        lastFrameTime = frame.timestampMilliseconds
        evidence.configure(frame)
        if let room, evidence.floor(room.backgroundDecibels) { threshold = Self.roomBar(room.rms) }
        let now = frame.timestampMilliseconds, level = frame.rms
        if now - started < 250 {
            if !frame.isStarved { windowRMS.append(level); evidence.calibrate(frame) }
            if threshold == 0 { return observation() }
        } else if !windowHasReadRoom {
            windowHasReadRoom = true
            readRoom()
        }
        listeningReady = true
        var didCount = false
        var countedRoute: PracticeEvidenceRoute?
        if level > threshold {
            voicedFrames += 1
            silentFrames = 0
            if !inBurst, voicedFrames >= 4,
               totalReps >= requiredReps || now - lastRepAt > 350 {
                inBurst = true
                burstAt = now
            }
            if !counted {
                pendingShape.append((frame.shapeSpectrumBytes, frame.sampleRate))
                if evidence.frame(frame), inBurst, learningRoom == nil { didCount = countRep() }
            } else if inBurst {
                shape.add(frame.shapeSpectrumBytes, sampleRate: frame.sampleRate)
            }
        } else {
            silentFrames += 1
            voicedFrames = 0
            if !inBurst {
                pendingShape = []
                evidence.drop()
                if learningRoom != nil, level <= 0.03, !frame.isStarved { learnRoom(frame) }
            }
            if inBurst, !counted,
               silentFrames >= 8 || evidence.quietFor(now) >= 130,
               heardTry() { didCount = countRep(); countedRoute = evidence.route }
            if silentFrames >= 8 { resetEnergyBurst() }
        }
        return observation(countedRep: didCount, countedRoute: countedRoute)
    }

    /// charge.html:1992–2002: a brief event that already ended can count at
    /// a deadline/model boundary. A sound still underway never becomes a rep
    /// merely because the caller is closing the microphone.
    public mutating func finishPending(atMilliseconds time: Double) -> PracticeAcousticObservation {
        var didCount = false
        if inBurst, !counted, heardTry(),
           learningRoom != nil ? (silentFrames >= 8 || evidence.quietFor(time) >= 130) : silentFrames > 0 {
            didCount = countRep()
        }
        return observation(countedRep: didCount)
    }

    private func observation(countedRep: Bool = false, countedRoute: PracticeEvidenceRoute? = nil) -> PracticeAcousticObservation {
        PracticeAcousticObservation(countedRep: countedRep, totalReps: totalReps,
                                   listeningReady: listeningReady, evidenceRoute: countedRoute ?? evidence.route,
                                   threshold: threshold, shape: shape, nominatedSaying: nominatedSaying)
    }

    private mutating func countRep() -> Bool {
        counted = true
        for (bytes, rate) in pendingShape { shape.add(bytes, sampleRate: rate) }
        pendingShape = []
        // Continue hearing the final target's shape without another rep.
        guard totalReps < requiredReps else { return false }
        if requiresWordVerification {
            if pendingSayingAt == nil { pendingSayingAt = burstAt; nominatedSaying = true }
            return false
        }
        totalReps += 1
        lastRepAt = burstAt
        return true
    }

    /// Called only after the fresh on-device recognizer accepts this exact
    /// nominated saying through the unchanged HEAR2 rule. Silence cannot call
    /// this successfully; a rejected saying is dropped through resetBurst().
    @discardableResult public mutating func acceptVerifiedSaying() -> Bool {
        guard requiresWordVerification, let at = pendingSayingAt, totalReps < requiredReps else { return false }
        pendingSayingAt = nil
        totalReps += 1
        lastRepAt = at
        return true
    }

    private func heardTry() -> Bool {
        if learningRoom != nil { return evidence.route == .voiced || evidence.route == .sibilant }
        return evidence.brief
    }

    private mutating func readRoom() {
        let low = Self.roomLevel(windowRMS), background = evidence.measured()
        let voice = low > 0.03
        if voice, Self.roomUsable(windowRMS) { roomWasTooLoud = true }
        let fits = room.map { $0.backgroundDecibels.count == background?.count } ?? false
        if !voice, Self.roomUsable(windowRMS), let background {
            if room == nil { room = PracticeRoomSnapshot(rms: low, backgroundDecibels: background, backgroundRMS: low) }
            else if let prior = room, low < prior.rms, fits {
                // charge.html:1638–1658: replace a WHOLE median only when the
                // new room is clearly quieter. Per-bin minima invent quiet.
                let replaceBackground = low < prior.backgroundRMS * sqrt(0.5)
                room = PracticeRoomSnapshot(rms: low,
                                            backgroundDecibels: replaceBackground ? background : prior.backgroundDecibels,
                                            backgroundRMS: replaceBackground ? low : prior.backgroundRMS)
            }
        }
        if let room, evidence.floor(room.backgroundDecibels) {
            threshold = Self.roomBar(room.rms)
            learningRoom = nil
        } else {
            if threshold == 0 { threshold = Self.roomBar(low) }
            if voice { evidence.resample(); learningRoom = [] }
        }
    }

    private mutating func learnRoom(_ frame: PracticeAcousticFrame) {
        learningRoom?.append(frame.rms)
        evidence.calibrate(frame)
        guard let learningRoom, learningRoom.count >= 8 else { return }
        let low = Self.roomLevel(learningRoom), background = evidence.measured()
        if room == nil, low <= 0.03, Self.roomUsable(learningRoom), let background {
            room = PracticeRoomSnapshot(rms: low, backgroundDecibels: background, backgroundRMS: low)
        }
        if let background { _ = evidence.floor(background) }
        threshold = Self.roomBar(low)
        self.learningRoom = nil
    }

    private static func roomLevel(_ readings: [Double]) -> Double {
        let usable = readings.filter { $0 > 0 }.sorted()
        return usable.isEmpty ? 0 : usable[Int(floor(Double(usable.count - 1) * 0.2))]
    }
    private static func roomUsable(_ readings: [Double]) -> Bool { readings.filter { $0 > 0 }.count >= 4 }
    private static func roomBar(_ level: Double) -> Double { min(0.09, max(0.035, level * 3)) }
}

/// charge.html:1389–1533, translated without changing evidence constants.
private struct SpeechEvidence: Sendable {
    private struct Calibration: Sendable { var bins: [Float]; var power: Double }
    private struct Event: Sendable {
        var started: Double, last: Double
        var frames = 0, broadFrames = 0
        var voicedAt = -1.0, sibilantAt = -1.0
        var points: [(Double, Double)] = []
        var pointAt = -1e9
        var qualified = false
        var route: PracticeEvidenceRoute?
    }
    private var sampleCount = 0
    private var sampleRate = 48000.0
    private var binHz = 46.875
    private var calibration: [Calibration] = []
    private var calibrationAt = -1e9
    private var background: [Float]?
    private var current: Event?

    mutating func configure(_ frame: PracticeAcousticFrame) {
        sampleRate = frame.sampleRate
        binHz = frame.sampleRate / Double(frame.samples.count)
        if sampleCount != frame.samples.count {
            sampleCount = frame.samples.count
            calibration = []
            background = nil
        }
    }
    mutating func resample() { calibration = [] }
    mutating func drop() { current = nil }
    mutating func floor(_ bins: [Float]) -> Bool {
        guard sampleCount > 0, bins.count == sampleCount / 2 else { return false }
        background = bins
        return true
    }
    mutating func calibrate(_ frame: PracticeAcousticFrame) {
        guard calibration.count < 60, frame.timestampMilliseconds - calibrationAt >= 8,
              frame.spectrumDecibels.contains(where: { $0 > -.infinity }) else { return }
        calibrationAt = frame.timestampMilliseconds
        let power = frame.spectrumDecibels.reduce(0.0) { $0 + pow(10, Double($1) / 10) }
        calibration.append(Calibration(bins: frame.spectrumDecibels, power: power))
    }
    func measured() -> [Float]? { calibration.isEmpty ? nil : medianBackground() }
    private func medianBackground() -> [Float] {
        let powers = calibration.map(\.power).sorted()
        var use = calibration
        if !powers.isEmpty {
            let limit = powers[Int(Foundation.floor(Double(powers.count - 1) * 0.2))] * 4
            let quiet = calibration.filter { $0.power <= limit }
            if quiet.count >= 3 { use = quiet }
        }
        return (0..<(sampleCount / 2)).map { index in
            let column = use.map { $0.bins[index] }.sorted()
            return column.isEmpty ? -100 : max(-100, column[column.count / 2])
        }
    }
    var route: PracticeEvidenceRoute? { current?.route ?? (current == nil ? nil : .short) }
    func quietFor(_ time: Double) -> Double { current.map { time - $0.last } ?? 0 }
    var brief: Bool {
        guard let current else { return false }
        return current.last - current.started >= 45 && current.last - current.started <= 1000 &&
            current.broadFrames * 2 > current.frames
    }
    mutating func frame(_ frame: PracticeAcousticFrame) -> Bool {
        if background == nil { background = medianBackground() }
        let bins = frame.spectrumDecibels, bg = background!
        let now = frame.timestampMilliseconds
        var event = current ?? Event(started: now, last: now)
        let low = Int(ceil(90 / binHz)), high = min(bins.count - 1, Int(Foundation.floor(8000 / binHz)))
        var wide = 0
        if low <= high { for index in low...high { if bins[index] >= bg[index] + 12 { wide += 1 } } }
        let broad = Double(wide) * binHz >= 1200
        let fundamental = pitch(frame.samples)
        let voiced = fundamental >= 100 && fundamental <= 700 &&
            (broad || overtones(fundamental, bins: bins, background: bg) >= (fundamental >= 250 ? 2 : 3))
        let sibilant = broad && max(band(2500, 5000, bins: bins), band(5000, min(10000, sampleRate / 2 - 200), bins: bins)) - band(300, 1500, bins: bins) >= 8
        event.last = now
        event.frames += 1
        if broad { event.broadFrames += 1 }
        if !voiced { event.voicedAt = -1 } else if event.voicedAt < 0 { event.voicedAt = now }
        if !sibilant { event.sibilantAt = -1 } else if event.sibilantAt < 0 { event.sibilantAt = now }
        if now - event.pointAt >= 14 {
            let power = frame.samples.reduce(0.0) { $0 + Double($1) * Double($1) } / Double(frame.samples.count)
            event.points.append((now, max(-120, decibels(power))))
            event.pointAt = now
        }
        if !event.qualified {
            if event.voicedAt >= 0, now - event.voicedAt >= 45 { event.route = .voiced; event.qualified = true }
            else if event.sibilantAt >= 0, now - event.sibilantAt >= 150 { event.route = .sibilant; event.qualified = true }
            else if event.broadFrames * 2 > event.frames, now - event.started > 1000 {
                let points = event.points.filter { $0.0 >= event.started + 30 && $0.0 <= now - 30 && $0.0 >= now - 800 }
                var minimum = Double.infinity, maximum = -Double.infinity
                if points.count >= 3 {
                    for index in 2..<points.count {
                        let a = points[index - 2], b = points[index - 1], c = points[index]
                        let middle = c.0 - a.0 <= 45 ? max(min(a.1, b.1), min(max(a.1, b.1), c.1)) : b.1
                        minimum = min(minimum, middle); maximum = max(maximum, middle)
                    }
                }
                if maximum - minimum >= 4.5 { event.route = .changing; event.qualified = true }
            }
        }
        current = event
        return event.qualified
    }

    private func decibels(_ power: Double) -> Double { power > 0 ? 4.342944819 * log(power) : -.infinity }
    private func band(_ from: Double, _ through: Double, bins: [Float]) -> Double {
        let low = Int(ceil(from / binHz)), high = min(bins.count - 1, Int(Foundation.floor(through / binHz)))
        guard low >= 0, low <= high else { return -.infinity }
        var power = 0.0
        for index in low...high { power += pow(10, Double(bins[index]) / 10) }
        return decibels(power / Double(high - low + 1))
    }
    private func overtones(_ fundamental: Double, bins: [Float], background: [Float]) -> Int {
        func value(_ array: [Float], _ index: Int) -> Float { array.indices.contains(index) ? array[index] : -.infinity }
        var levels: [(Int, Float)] = [], top: Float = -.infinity
        for harmonic in 1...9 {
            if Double(harmonic) * fundamental >= 5000 { break }
            let center = Int((Double(harmonic) * fundamental / binHz).rounded())
            let magnitude = max(value(bins, center - 1), value(bins, center), value(bins, center + 1))
            levels.append((center, magnitude)); top = max(top, magnitude)
        }
        guard levels.count >= 2 else { return 0 }
        var count = 0
        for harmonic in 2...levels.count {
            let (center, magnitude) = levels[harmonic - 1]
            let left = Int(((Double(harmonic) - 0.5) * fundamental / binHz).rounded())
            let right = Int(((Double(harmonic) + 0.5) * fundamental / binHz).rounded())
            if magnitude >= value(background, center) + 6, magnitude >= top - 40,
               magnitude >= max(value(bins, left), value(bins, right)) + 3 { count += 1 }
        }
        return count
    }
    private func pitch(_ samples: [Float]) -> Double {
        let maxLag = min(Int(Foundation.floor(sampleRate / 100)), samples.count / 2), width = samples.count - maxLag
        guard maxLag >= 2, width > 0 else { return 0 }
        var run = 0.0, best = 0, bestDifference = 0.2, second = false, end = maxLag, alternate = 0, alternateDifference = 1.0
        var lag = 1
        while lag <= end {
            var difference = 0.0
            for index in 0..<width { let delta = Double(samples[index]) - Double(samples[index + lag]); difference += delta * delta }
            run += difference
            let normalized = run > 0 ? difference * Double(lag) / run : 1
            if lag >= 2 {
                if !second {
                    if normalized < bestDifference { best = lag; bestDifference = normalized }
                    else if best > 0 {
                        if bestDifference < 0.05 || Double(best) * 1.8 > Double(maxLag) { break }
                        second = true; end = min(maxLag, Int((Double(best) * 2.2).rounded()))
                    }
                } else if Double(lag) >= Double(best) * 1.8, normalized < alternateDifference {
                    alternate = lag; alternateDifference = normalized
                }
            }
            lag += 1
        }
        if alternate > 0, alternateDifference < bestDifference / 2 { best = alternate }
        return best > 0 ? sampleRate / Double(best) : 0
    }
}
