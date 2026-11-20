import XCTest
@testable import SonaSpeechCore

final class PracticeAudioAnalysisTests: XCTestCase {
    /// Analytic Blackman-window spectra: independent expected values, including
    /// WebAudio's 1/N normalization and the negative-frequency sine partner.
    func testBlackmanConstantSpectrumMatchesAnalyticValues() {
        for size in [512, 1024, 2048] {
            let bins = PracticeWebAnalyser.magnitudes([Float](repeating: 1, count: size))
            XCTAssertEqual(bins.count, size / 2)
            XCTAssertEqual(bins[0], 0.42, accuracy: 1e-12)
            XCTAssertEqual(bins[1], 0.25, accuracy: 1e-12)
            XCTAssertEqual(bins[2], 0.04, accuracy: 1e-12)
            XCTAssertLessThan(bins.dropFirst(3).max() ?? 1, 1e-12)
        }
    }

    func testBinCentredSyntheticVoiceHarmonicHasExpectedSpectrum() {
        let size = 1024
        let samples = (0..<size).map { Float(0.6 * sin(2 * Double.pi * 12 * Double($0) / Double(size))) }
        let bins = PracticeWebAnalyser.magnitudes(samples)
        XCTAssertEqual(bins[12], 0.126, accuracy: 1e-8)
        XCTAssertEqual(bins[11], 0.075, accuracy: 1e-8)
        XCTAssertEqual(bins[13], 0.075, accuracy: 1e-8)
        XCTAssertEqual(bins[10], 0.012, accuracy: 1e-8)
        XCTAssertEqual(bins[14], 0.012, accuracy: 1e-8)
        XCTAssertLessThan(bins[20], 1e-8)
    }

    func testImpulseAtWindowCentreHasFlatSpectrum() {
        var samples = [Float](repeating: 0, count: 512)
        samples[256] = 1
        let bins = PracticeWebAnalyser.magnitudes(samples)
        for bin in bins { XCTAssertEqual(bin, 1.0 / 512, accuracy: 1e-12) }
    }

    func testEnergyUsesWebByteQuantizationWithoutGain() {
        XCTAssertEqual(PracticeWebAnalyser.byteEnergyRMS([0, 0]), 0)
        XCTAssertEqual(PracticeWebAnalyser.byteEnergyRMS([0.25, -0.25]), 0.25)
        XCTAssertEqual(PracticeWebAnalyser.byteEnergyRMS([0.001]), 0)
        XCTAssertEqual(PracticeWebAnalyser.byteEnergyRMS([-0.001]), 1.0 / 128)
        let clipped = sqrt((1 + pow(127.0 / 128, 2)) / 2)
        XCTAssertEqual(PracticeWebAnalyser.byteEnergyRMS([-4, 4]), clipped, accuracy: 1e-12)
    }

    func testRepeatedPollCannotCreateNewPCMFrame() {
        var stream = PracticePCMWindowStream()
        stream.append([Float](repeating: 0.2, count: 800), sampleRate: 48_000, startedAtMilliseconds: 1000)
        let first = stream.drain(windowSize: 1024)
        XCTAssertEqual(first.count, 1)
        XCTAssertEqual(first[0].timestampMilliseconds, 1000 + 1000.0 / 60, accuracy: 1e-8)
        XCTAssertTrue(stream.drain(windowSize: 1024).isEmpty)
        XCTAssertTrue(stream.drain(windowSize: 1024).isEmpty)
        stream.append([Float](repeating: 0.3, count: 800), sampleRate: 48_000,
                      startedAtMilliseconds: 1000 + 1000.0 / 60)
        let second = stream.drain(windowSize: 1024)
        XCTAssertEqual(second.count, 1)
        XCTAssertEqual(second[0].timestampMilliseconds, 1000 + 2000.0 / 60, accuracy: 1e-8)
        XCTAssertEqual(second[0].samples.suffix(800), [Float](repeating: 0.3, count: 800)[...])
    }

    func testBatchedTapPreservesSeparateAudioPositions() {
        var stream = PracticePCMWindowStream()
        let samples = (0..<4800).map { Float($0) / 4800 }
        stream.append(samples, sampleRate: 48_000, startedAtMilliseconds: 1000)
        let frames = stream.drain(windowSize: 1024)
        XCTAssertEqual(frames.count, 6)
        XCTAssertEqual(frames[0].samples.prefix(224), [Float](repeating: 0, count: 224)[...])
        XCTAssertEqual(frames[0].samples.suffix(800), samples.prefix(800))
        XCTAssertEqual(frames[5].samples, Array(samples.suffix(1024)))
        XCTAssertEqual(frames[5].timestampMilliseconds, 1100, accuracy: 1e-8)
        XCTAssertTrue(stream.drain(windowSize: 1024).isEmpty)
    }

    func testFrameCadenceDoesNotDriftAtFractionalHop() {
        var stream = PracticePCMWindowStream()
        stream.append([Float](repeating: 0.1, count: 22_050), sampleRate: 22_050, startedAtMilliseconds: 1000)
        let frames = stream.drain(windowSize: 512)
        XCTAssertEqual(frames.count, 60)
        XCTAssertEqual(frames.last?.timestampMilliseconds ?? 0, 2000, accuracy: 1e-8)
    }

    func testDiscontinuityDropsIncompleteInputBeforeNewAudio() {
        var stream = PracticePCMWindowStream()
        stream.append([Float](repeating: 0.1, count: 800), sampleRate: 48_000, startedAtMilliseconds: 1000)
        _ = stream.drain(windowSize: 1024)
        stream.append([Float](repeating: 0.2, count: 1600), sampleRate: 48_000, startedAtMilliseconds: 1400)
        let frames = stream.drain(windowSize: 1024)
        XCTAssertEqual(frames.count, 3)
        XCTAssertFalse(frames[0].isAvailable)
        XCTAssertEqual(frames[0].timestampMilliseconds, 1400)
        XCTAssertTrue(frames[1].isAvailable)
        XCTAssertEqual(frames[2].samples, [Float](repeating: 0.2, count: 1024))
    }

    func testOverrunIsUnavailableInsteadOfReplayingOverwrittenInput() {
        var stream = PracticePCMWindowStream()
        stream.append([Float](repeating: 0.1, count: 96_000), sampleRate: 48_000, startedAtMilliseconds: 1000)
        let frames = stream.drain(windowSize: 1024)
        XCTAssertFalse(frames[0].isAvailable)
        XCTAssertLessThan(frames.count, 43)
        for frame in frames.dropFirst() {
            XCTAssertTrue(frame.isAvailable)
            XCTAssertEqual(frame.samples, [Float](repeating: 0.1, count: 1024))
        }
    }
}
