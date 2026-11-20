import Foundation
import XCTest
@testable import SonaSpeechCore

final class SpeechGameBurstDetectorTests: XCTestCase {
    private func frame(_ time: Double, level: Double = 0.005, family: String = "low", available: Bool = true) -> PracticeAcousticFrame {
        var bytes = [UInt8](repeating: 0, count: 256)
        for i in family == "low" ? [2, 3, 4] : [70, 80, 90, 100] { bytes[i] = 245 }
        return .init(timestampMilliseconds: time, sampleRate: 48_000,
                     samples: [0.005, -0.005, 0.005, -0.005],
                     spectrumDecibels: [-80, -80], energyRMS: level,
                     shapeSpectrumBytes: bytes, isAvailable: available)
    }
    private func quiet(_ detector: inout SpeechGameBurstDetector, through: Double = 500) {
        for t in stride(from: 0.0, through: through, by: 20) { XCTAssertNil(detector.ingest(frame(t))) }
    }

    func testSilenceNeverNominatesEvenAfterLongListening() {
        var value = SpeechGameBurstDetector(sound: "R")
        for t in stride(from: 0.0, through: 15_000, by: 20) { XCTAssertNil(value.ingest(frame(t))) }
        XCTAssertTrue(value.listeningReady); XCTAssertFalse(value.hasBurst)
    }
    func testFiveFramesRequireWholeWordTailAndNominateOnlyOnce() {
        var value = SpeechGameBurstDetector(sound: "R"); quiet(&value)
        for t in stride(from: 520.0, through: 580, by: 20) { XCTAssertNil(value.ingest(frame(t, level: 0.15))) }
        XCTAssertFalse(value.hasBurst)
        XCTAssertNil(value.ingest(frame(600, level: 0.15))); XCTAssertTrue(value.hasBurst)
        for t in stride(from: 620.0, through: 780, by: 20) { XCTAssertNil(value.ingest(frame(t))) }
        XCTAssertEqual(value.ingest(frame(800)), .init(burstAtMilliseconds: 600))
        XCTAssertNil(value.ingest(frame(820)))
    }
    func testBroadFamilyStillRejectsOppositeFamilyBeforeWordCheck() {
        var low = SpeechGameBurstDetector(sound: "R"); quiet(&low)
        var hiss = SpeechGameBurstDetector(sound: "S"); quiet(&hiss)
        for t in stride(from: 520.0, through: 1_000, by: 20) {
            XCTAssertNil(low.ingest(frame(t, level: 0.15, family: "hiss")))
            XCTAssertNil(hiss.ingest(frame(t, level: 0.15, family: "low")))
        }
        XCTAssertFalse(low.hasBurst); XCTAssertFalse(hiss.hasBurst)
    }
    func testHeldWordNeverEndsFromElapsedTimeOrDeadline() {
        var value = SpeechGameBurstDetector(sound: "R"); quiet(&value)
        for t in stride(from: 520.0, through: 13_000, by: 20) { XCTAssertNil(value.ingest(frame(t, level: 0.15))) }
        XCTAssertTrue(value.hasBurst)
    }
    func testMissingCaptureCannotStandInForWordTail() {
        var value = SpeechGameBurstDetector(sound: "R"); quiet(&value)
        for t in stride(from: 520.0, through: 620, by: 20) { _ = value.ingest(frame(t, level: 0.15)) }
        XCTAssertTrue(value.hasBurst)
        XCTAssertNil(value.ingest(frame(900, available: false)))
        XCTAssertFalse(value.hasBurst)
        for t in stride(from: 920.0, through: 1_500, by: 20) { XCTAssertNil(value.ingest(frame(t))) }
    }
    func testFreshQuietGapAndMinimumSeparationAreBothRequired() {
        var value = SpeechGameBurstDetector(sound: "R", roomFloor: 0.005)
        value.beginGap()
        XCTAssertFalse(value.ingestGap(frame(100), notBeforeMilliseconds: 450))
        XCTAssertFalse(value.ingestGap(frame(300), notBeforeMilliseconds: 450))
        XCTAssertFalse(value.ingestGap(frame(440), notBeforeMilliseconds: 450))
        XCTAssertTrue(value.ingestGap(frame(460), notBeforeMilliseconds: 450))
        value.beginGap()
        XCTAssertFalse(value.ingestGap(frame(600), notBeforeMilliseconds: 0))
        XCTAssertFalse(value.ingestGap(frame(780, level: 0.15), notBeforeMilliseconds: 0))
        XCTAssertFalse(value.ingestGap(frame(800), notBeforeMilliseconds: 0))
        XCTAssertFalse(value.ingestGap(frame(990), notBeforeMilliseconds: 0))
        XCTAssertTrue(value.ingestGap(frame(1_000), notBeforeMilliseconds: 0))
    }
    func testUnavailableGapResetsQuietAndEarlyFramesAreNotReused() {
        var value = SpeechGameBurstDetector(sound: "R", roomFloor: 0.005)
        value.beginGap()
        XCTAssertFalse(value.ingestGap(frame(100), notBeforeMilliseconds: 0))
        XCTAssertFalse(value.ingestGap(frame(280, available: false), notBeforeMilliseconds: 0))
        XCTAssertFalse(value.ingestGap(frame(300), notBeforeMilliseconds: 0))
        XCTAssertFalse(value.ingestGap(frame(480), notBeforeMilliseconds: 0))
        XCTAssertTrue(value.ingestGap(frame(500), notBeforeMilliseconds: 0))
        value.beginSaying(notBeforeMilliseconds: 600)
        for t in stride(from: 520.0, through: 580, by: 20) { XCTAssertNil(value.ingest(frame(t, level: 0.15))) }
        XCTAssertFalse(value.hasBurst)
    }
    func testPageFloorOnlyDecreasesAndSurvivesNewSaying() {
        var value = SpeechGameBurstDetector(sound: "R", roomFloor: 0.01)
        for t in stride(from: 0.0, through: 600, by: 20) { _ = value.ingest(frame(t, level: 0.02)) }
        XCTAssertEqual(value.roomFloor, 0.01)
        value.beginSaying()
        for t in stride(from: 700.0, through: 1_300, by: 20) { _ = value.ingest(frame(t)) }
        XCTAssertEqual(value.roomFloor, 0.005)
    }
}
