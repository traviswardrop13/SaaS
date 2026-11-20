import XCTest
@testable import SonaSpeechCore

/// All input is synthesized in memory. These expected routes/counts also
/// replay against charge.html's unchanged speechEvidence() in the local
/// parity audit; no child's recording or microphone is used.
/// Reference body SHA-256: b1e07ac3420a6dc822729610c0023708267f94d145dd67d9e9e19225ba2d1fca
final class PracticeAcousticsTests: XCTestCase {
    private enum Signal { case room, zero, voice, tone, hiss, broadNoise }
    private let rate = 48000.0

    private func frame(_ signal: Signal, _ time: Double, level: Double? = nil,
                       available: Bool = true, starved: Bool = false) -> PracticeAcousticFrame {
        var samples = [Float](repeating: 0, count: 1024)
        var bins = [Float](repeating: -110, count: 512)
        var shape = [UInt8](repeating: 0, count: 256)
        for index in samples.indices {
            let phase = 2 * Double.pi * 187.5 * Double(index) / rate
            switch signal {
            case .room: samples[index] = index.isMultiple(of: 2) ? 0.005 : -0.005
            case .zero: break
            case .voice:
                samples[index] = Float((1...24).reduce(0.0) { $0 + 0.12 / Double($1) * sin(Double($1) * phase) })
            case .tone: samples[index] = Float(0.2 * sin(2 * Double.pi * 440 * Double(index) / rate))
            case .hiss, .broadNoise:
                // A deterministic, non-periodic sequence; reset per frame is
                // intentional because the detector sees analyser snapshots.
                let value = UInt32(truncatingIfNeeded: index &* 1664525 &+ 1013904223)
                samples[index] = Float(Double(value) / Double(UInt32.max) * 0.4 - 0.2)
            }
        }
        switch signal {
        case .room: bins = [Float](repeating: -100, count: 512)
        case .zero: bins = [Float](repeating: -.infinity, count: 512)
        case .voice:
            for index in bins.indices where Double(index) * rate / 1024 < 6000 { bins[index] = index.isMultiple(of: 4) ? -40 : -70 }
            for index in [2, 4, 6, 8] { shape[index] = 230 }
        case .tone:
            for index in 8...11 { bins[index] = -20 }
            shape[5] = 230
        case .hiss:
            for index in bins.indices { bins[index] = index >= 54 && index <= 170 ? -30 : -70 }
            for index in 40...100 { shape[index] = 230 }
        case .broadNoise:
            bins = [Float](repeating: -30, count: 512)
            shape = [UInt8](repeating: 200, count: 256)
        }
        if starved { for index in 100..<196 { samples[index] = 0 } }
        let energy: Double
        switch signal { case .room: energy = 0.005; case .zero: energy = 0; default: energy = 0.17 }
        return PracticeAcousticFrame(timestampMilliseconds: time, sampleRate: rate, samples: samples,
                                     spectrumDecibels: bins, energyRMS: level ?? energy,
                                     shapeSpectrumBytes: shape, isAvailable: available)
    }

    private func prepared(requiredReps: Int = 5) -> PracticeAcoustics {
        var detector = PracticeAcoustics(requiredReps: requiredReps)
        detector.beginRoomMeasurement(atMilliseconds: 0)
        for time in stride(from: 0.0, through: 300, by: 20) { _ = detector.measureRoom(frame(.room, time)) }
        detector.beginWindow(atMilliseconds: 1000)
        return detector
    }

    @discardableResult private func feed(_ signal: Signal, from: Double, through: Double,
                                         every: Double = 20, detector: inout PracticeAcoustics) -> [PracticeAcousticObservation] {
        stride(from: from, through: through, by: every).map { detector.process(frame(signal, $0)) }
    }

    func testSilenceAndMatchingWordsCannotCreateAcousticReps() {
        var detector = prepared()
        let observations = feed(.zero, from: 1000, through: 21000, detector: &detector)
        XCTAssertTrue(observations.allSatisfy { !$0.countedRep })
        XCTAssertEqual(detector.totalReps, 0)
        XCTAssertEqual(detector.shape.verdict(for: "R"), .unknown)
        XCTAssertFalse(detector.finishPending(atMilliseconds: 21000).countedRep)
    }

    func testPeriodicVoicingCountsOnceAndHeldSoundKeepsShapeTail() {
        var detector = prepared(requiredReps: 1)
        let observations = feed(.voice, from: 1100, through: 1800, detector: &detector)
        XCTAssertEqual(observations.filter(\.countedRep).count, 1)
        XCTAssertEqual(observations.first(where: \.countedRep)?.evidenceRoute, .voiced)
        XCTAssertEqual(observations.firstIndex(where: \.countedRep), 3, "web reference counts at 1160 ms")
        XCTAssertEqual(detector.totalReps, 1)
        XCTAssertGreaterThanOrEqual(detector.shape.frames, 12)
        XCTAssertEqual(detector.shape.verdict(for: "R"), .pass)
        XCTAssertEqual(detector.shape.verdict(for: "S"), .fail)
    }

    func testFiveSeparateVoicedAttemptsCountFiveWithoutAChimeOrTimerRep() {
        var detector = prepared()
        for index in 0..<5 {
            let start = 1100 + Double(index) * 650
            feed(.voice, from: start, through: start + 240, detector: &detector)
            feed(.room, from: start + 260, through: start + 600, detector: &detector)
        }
        XCTAssertEqual(detector.totalReps, 5)
        feed(.voice, from: 4600, through: 5000, detector: &detector)
        XCTAssertEqual(detector.totalReps, 5)
    }

    func testLowPowerFrameRateKeepsVoicedTriesAndRejectsNoise() {
        for interval in [1000.0 / 60, 1000.0 / 30] {
            var detector = prepared()
            for index in 0..<3 {
                let start = 1100 + Double(index) * 800
                feed(.voice, from: start, through: start + 300, every: interval, detector: &detector)
                feed(.room, from: start + 320, through: start + 760, every: interval, detector: &detector)
            }
            XCTAssertEqual(detector.totalReps, 3)
            var noise = prepared()
            feed(.broadNoise, from: 1100, through: 3000, every: interval, detector: &noise)
            feed(.room, from: 3020, through: 3400, every: interval, detector: &noise)
            XCTAssertEqual(noise.totalReps, 0)
        }
    }

    func testLongBroadHoldNeedsExistingLoudnessChangeEvidence() {
        var detector = prepared()
        var route: PracticeEvidenceRoute?
        for time in stride(from: 1100.0, through: 2600, by: 20) {
            let base = frame(.broadNoise, time)
            let gain = pow(10, 4 * sin((time - 1100) / 160) / 20)
            let scaled = PracticeAcousticFrame(timestampMilliseconds: time, sampleRate: rate,
                                               samples: base.samples.map { Float(Double($0) * gain) },
                                               spectrumDecibels: base.spectrumDecibels,
                                               energyRMS: 0.17 * gain, shapeSpectrumBytes: base.shapeSpectrumBytes)
            let result = detector.process(scaled)
            if result.countedRep { route = result.evidenceRoute }
        }
        XCTAssertEqual(detector.totalReps, 1)
        XCTAssertEqual(route, .changing)
    }

    func testPureToneAndSteadyBroadNoiseEarnNothing() {
        for signal in [Signal.tone, .broadNoise] {
            var detector = prepared()
            feed(signal, from: 1100, through: 3600, detector: &detector)
            feed(.room, from: 3620, through: 3900, detector: &detector)
            XCTAssertEqual(detector.totalReps, 0)
            XCTAssertEqual(detector.shape.frames, 0)
        }
    }

    func testSibilantHoldAndBriefBroadReleaseUseExistingEvidencePaths() {
        var hiss = prepared()
        let held = feed(.hiss, from: 1100, through: 2500, detector: &hiss)
        XCTAssertEqual(hiss.totalReps, 1)
        XCTAssertEqual(held.first(where: \.countedRep)?.evidenceRoute, .sibilant)
        XCTAssertEqual(held.firstIndex(where: \.countedRep), 8, "web reference counts at 1260 ms")
        XCTAssertEqual(hiss.shape.verdict(for: "S"), .pass)
        XCTAssertEqual(hiss.shape.verdict(for: "R"), .fail)

        var release = prepared()
        feed(.broadNoise, from: 1100, through: 1280, detector: &release)
        XCTAssertEqual(release.totalReps, 0, "a brief broad event waits until it actually ends")
        let closed = feed(.room, from: 1300, through: 1450, every: 10, detector: &release)
        XCTAssertEqual(release.totalReps, 1)
        XCTAssertEqual(closed.firstIndex(where: \.countedRep), 7, "web reference counts at 1370 ms")
        XCTAssertEqual(closed.first(where: \.countedRep)?.evidenceRoute, .short)
    }

    func testIsolatedTransientAndStillSpeakingDeadlineEarnNothing() {
        var transient = prepared()
        feed(.broadNoise, from: 1100, through: 1120, detector: &transient)
        feed(.room, from: 1140, through: 1500, detector: &transient)
        XCTAssertEqual(transient.totalReps, 0)

        var underway = prepared()
        feed(.broadNoise, from: 1100, through: 1280, detector: &underway)
        XCTAssertFalse(underway.finishPending(atMilliseconds: 1300).countedRep)
        _ = underway.process(frame(.room, 1300))
        XCTAssertTrue(underway.finishPending(atMilliseconds: 1300).countedRep)
        XCTAssertFalse(underway.finishPending(atMilliseconds: 1300).countedRep)
    }

    func testWindowReplacementKeepsHeardRepsButCannotJoinPartialBursts() {
        var detector = prepared()
        feed(.voice, from: 1100, through: 1400, detector: &detector)
        XCTAssertEqual(detector.totalReps, 1)
        let shapeFrames = detector.shape.frames
        detector.beginWindow(atMilliseconds: 2000)
        feed(.voice, from: 2000, through: 2020, detector: &detector)
        detector.resetBurst()
        detector.beginWindow(atMilliseconds: 5000)
        feed(.voice, from: 5000, through: 5020, detector: &detector)
        feed(.room, from: 5040, through: 5400, detector: &detector)
        XCTAssertEqual(detector.totalReps, 1)
        XCTAssertEqual(detector.shape.frames, shapeFrames)
        feed(.voice, from: 5500, through: 5800, detector: &detector)
        XCTAssertEqual(detector.totalReps, 2)
    }

    func testUnavailableAndMalformedSamplesNeverCountOrBecomeTheRoom() {
        var detector = PracticeAcoustics()
        detector.beginRoomMeasurement(atMilliseconds: 0)
        for time in stride(from: 0.0, through: 400, by: 20) {
            _ = detector.measureRoom(frame(.voice, time, available: false))
        }
        XCTAssertNil(detector.room)
        detector.endRoomMeasurement()
        detector.beginWindow(atMilliseconds: 1000)
        for time in stride(from: 1000.0, through: 2000, by: 20) {
            XCTAssertFalse(detector.process(frame(.voice, time, available: false)).countedRep)
        }
        XCTAssertEqual(detector.totalReps, 0)
        XCTAssertNil(detector.room)
        XCTAssertFalse(detector.listeningReady)
        let malformed = PracticeAcousticFrame(timestampMilliseconds: 2100, sampleRate: 0,
                                              samples: [Float.nan], spectrumDecibels: [])
        XCTAssertFalse(detector.process(malformed).countedRep)
    }

    func testRoomProbeStartsAfterDigitalWarmupAndRejectsStarvedOrVoicedRoom() {
        var detector = PracticeAcoustics()
        detector.beginRoomMeasurement(atMilliseconds: 0)
        for time in stride(from: 0.0, through: 280, by: 20) { XCTAssertFalse(detector.measureRoom(frame(.zero, time))) }
        for time in stride(from: 300.0, through: 580, by: 20) { XCTAssertFalse(detector.measureRoom(frame(.room, time))) }
        XCTAssertTrue(detector.measureRoom(frame(.room, 600)))
        XCTAssertEqual(detector.room?.rms ?? 0, 0.005, accuracy: 0.00001)

        var starved = PracticeAcoustics()
        starved.beginRoomMeasurement(atMilliseconds: 0)
        for time in stride(from: 0.0, through: 620, by: 20) { _ = starved.measureRoom(frame(.room, time, starved: true)) }
        XCTAssertNil(starved.room)

        var voice = PracticeAcoustics()
        voice.beginRoomMeasurement(atMilliseconds: 0)
        for time in stride(from: 0.0, through: 300, by: 20) { _ = voice.measureRoom(frame(.voice, time)) }
        XCTAssertNil(voice.room)
        XCTAssertTrue(voice.roomWasTooLoud)
        voice.beginWindow(atMilliseconds: 1000)
        feed(.voice, from: 1000, through: 1500, detector: &voice)
        XCTAssertEqual(voice.totalReps, 0, "learning mode requires a real end")
        feed(.room, from: 1520, through: 1900, detector: &voice)
        XCTAssertEqual(voice.totalReps, 1)
        XCTAssertLessThanOrEqual(voice.threshold, 0.09)
    }
}
