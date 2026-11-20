import Foundation
import XCTest
@testable import SonaSpeechCore

final class ReadingSpeechDetectorTests: XCTestCase {
    private func frame(_ time: Double, loud: Bool = false, wrong: Bool = false, available: Bool = true) -> PracticeAcousticFrame {
        var shape = [UInt8](repeating: 0, count: 256)
        for i in wrong ? [70, 80, 90] : [2, 4, 6] { shape[i] = 245 }
        return .init(timestampMilliseconds: time, sampleRate: 48_000,
            samples: [0.005, -0.005, 0.005, -0.005], spectrumDecibels: [-80, -80],
            energyRMS: loud ? 0.15 : 0.005, shapeSpectrumBytes: shape, isAvailable: available)
    }
    func testQuietOrHeldVoiceCannotFinishAWord() {
        var quiet = ReadingSpeechDetector(sound: "R")
        for t in stride(from: 0.0, through: 13_000, by: 20) { XCTAssertNil(quiet.ingest(frame(t))) }
        XCTAssertTrue(quiet.listeningReady); XCTAssertFalse(quiet.hasCandidate)
        var held = ReadingSpeechDetector(sound: "R", roomFloor: 0.005)
        for t in stride(from: 0.0, through: 13_000, by: 20) { XCTAssertNil(held.ingest(frame(t, loud: true))) }
        XCTAssertTrue(held.hasCandidate)
    }
    func testNativeCandidateNeedsFiveFramesThen200msFreshQuiet() {
        var value = ReadingSpeechDetector(sound: "R", roomFloor: 0.005)
        for t in stride(from: 0.0, through: 60, by: 20) { XCTAssertNil(value.ingest(frame(t, loud: true))) }
        XCTAssertFalse(value.hasCandidate)
        XCTAssertNil(value.ingest(frame(80, loud: true))); XCTAssertTrue(value.hasCandidate)
        for t in stride(from: 100.0, through: 280, by: 20) { XCTAssertNil(value.ingest(frame(t))) }
        XCTAssertEqual(value.ingest(frame(300)), .candidate)
        XCTAssertNil(value.ingest(frame(320)))
    }
    func testOtherFamilyIsNativeWordFailureAfter400msNotShapeFallback() {
        var value = ReadingSpeechDetector(sound: "R", roomFloor: 0.005)
        for t in stride(from: 0.0, through: 100, by: 20) { XCTAssertNil(value.ingest(frame(t, loud: true, wrong: true))) }
        XCTAssertTrue(value.sawWrongFamily); XCTAssertFalse(value.hasCandidate)
        for t in stride(from: 120.0, through: 480, by: 20) { XCTAssertNil(value.ingest(frame(t))) }
        XCTAssertEqual(value.ingest(frame(500)), .differentWord)
        var progress = ReadingSpeechProgress(requiredSayings: 1)
        for _ in 0..<3 { XCTAssertEqual(progress.accept(.word), .waitForTap) }
        XCTAssertFalse(progress.finished); XCTAssertEqual(progress.sayings, 0); XCTAssertEqual(progress.shapeTries, 0)
    }
    func testMissingCaptureCannotSupplyWordTailOrBetweenSayingGap() {
        var value = ReadingSpeechDetector(sound: "R", roomFloor: 0.005)
        for t in stride(from: 0.0, through: 100, by: 20) { _ = value.ingest(frame(t, loud: true)) }
        _ = value.ingest(frame(120)); _ = value.ingest(frame(280, available: false))
        XCTAssertNil(value.ingest(frame(300))); XCTAssertNil(value.ingest(frame(480)))
        XCTAssertEqual(value.ingest(frame(500)), .candidate)
        value.beginGap()
        XCTAssertFalse(value.ingestGap(frame(600)))
        XCTAssertFalse(value.ingestGap(frame(780, available: false)))
        XCTAssertFalse(value.ingestGap(frame(800))); XCTAssertFalse(value.ingestGap(frame(980)))
        XCTAssertTrue(value.ingestGap(frame(1_000)))
    }
    func testStoryNeedsAllSayingsAndFinalEventCannotRepeat() {
        var progress = ReadingSpeechProgress(requiredSayings: 3)
        XCTAssertEqual(progress.accept(.heard), .listenAgain)
        XCTAssertEqual(progress.accept(.quiet), .waitForTap)
        XCTAssertEqual(progress.accept(.unverified), .waitForTap)
        XCTAssertEqual(progress.accept(.heard), .listenAgain)
        XCTAssertEqual(progress.accept(.heard), .advanceHeard)
        XCTAssertEqual(progress.sayings, 3)
        XCTAssertEqual(progress.accept(.heard), .waitForTap)
        XCTAssertEqual(progress.sayings, 3)
    }
    func testBrowserShapeExitStaysExplicitAndNeverCreditsASaying() {
        var browser = ReadingSpeechProgress(requiredSayings: 1, requiresNativeWordCheck: false)
        XCTAssertEqual(browser.accept(.shape), .askAgain)
        XCTAssertEqual(browser.accept(.shape), .askAgain)
        XCTAssertEqual(browser.accept(.shape), .advanceWithoutCredit)
        XCTAssertEqual(browser.sayings, 0)
        var native = ReadingSpeechProgress(requiredSayings: 1)
        for _ in 0..<10 { XCTAssertEqual(native.accept(.shape), .waitForTap) }
        XCTAssertFalse(native.finished); XCTAssertEqual(native.sayings, 0)
    }
}
