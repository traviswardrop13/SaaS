import XCTest
@testable import SonaSpeechCore

final class ArcadeCheckpointDetectorTests: XCTestCase {
    private func frame(_ time: Double, _ level: Double, shape: [UInt8] = [], available: Bool = true) -> PracticeAcousticFrame {
        .init(timestampMilliseconds: time, sampleRate: 48_000,
              samples: (0..<512).map { $0.isMultiple(of: 2) ? 0.01 : -0.01 },
              spectrumDecibels: Array(repeating: -100, count: 256), energyRMS: level,
              shapeSpectrumBytes: shape, isAvailable: available)
    }
    func testSixConsecutiveFramesNotFiveAndQuietTail() {
        var detector = ArcadeCheckpointDetector(family: "any", requiresWord: false, roomFloor: 0.01)
        for i in 0..<5 { XCTAssertNil(detector.ingest(frame(Double(i) * 20, 0.2))) }
        for i in 5...40 { XCTAssertNil(detector.ingest(frame(Double(i) * 20, 0.01))) }
        XCTAssertFalse(detector.hasBurst)
        for i in 41...46 { XCTAssertNil(detector.ingest(frame(Double(i) * 20, 0.2))) }
        XCTAssertTrue(detector.hasBurst)
        for i in 47..<74 { XCTAssertNil(detector.ingest(frame(Double(i) * 20, 0.01))) }
        XCTAssertNotNil(detector.ingest(frame(1_480, 0.01)))
    }
    func testExactPoint05AndThreePoint5Floor() {
        var detector = ArcadeCheckpointDetector(family: "any", requiresWord: false, roomFloor: 0.02)
        for i in 0...12 { XCTAssertNil(detector.ingest(frame(Double(i) * 20, 0.065))) }
        XCTAssertFalse(detector.hasBurst, "Unlike SayPlay, 3x floor is insufficient")
        for i in 13...18 { _ = detector.ingest(frame(Double(i) * 20, 0.071)) }
        XCTAssertTrue(detector.hasBurst)
        var minimum = ArcadeCheckpointDetector(family: "any", requiresWord: false, roomFloor: 0)
        for i in 0...12 { _ = minimum.ingest(frame(Double(i) * 20, 0.049)) }
        XCTAssertFalse(minimum.hasBurst)
    }
    func testBareHeldFallbackButWordMustReachQuiet() {
        var bare = ArcadeCheckpointDetector(family: "any", requiresWord: false, roomFloor: 0.01)
        var word = ArcadeCheckpointDetector(family: "any", requiresWord: true, roomFloor: 0.01)
        var bareResult: ArcadeCheckpointDetector.Candidate?
        for i in 0...150 {
            let value = frame(Double(i) * 20, 0.2)
            bareResult = bareResult ?? bare.ingest(value)
            XCTAssertNil(word.ingest(value))
        }
        XCTAssertNotNil(bareResult)
        var wordResult: ArcadeCheckpointDetector.Candidate?
        for i in 151...162 { wordResult = wordResult ?? word.ingest(frame(Double(i) * 20, 0.01)) }
        XCTAssertNotNil(wordResult)
    }
    func testMissingFramesEraseNominationNotRoomFloor() {
        var detector = ArcadeCheckpointDetector(family: "any", requiresWord: false, roomFloor: 0.01)
        for i in 0...7 { _ = detector.ingest(frame(Double(i) * 20, 0.2)) }
        XCTAssertTrue(detector.hasBurst)
        XCTAssertNil(detector.ingest(frame(200, 0, available: false)))
        for i in 11...100 { XCTAssertNil(detector.ingest(frame(Double(i) * 20, 0.01))) }
        XCTAssertFalse(detector.hasBurst)
        XCTAssertEqual(detector.roomFloor, 0.01)
    }
    func testPageFloorOnlyFallsAndEarlySayingIsRejudged() {
        var detector = ArcadeCheckpointDetector(family: "any", requiresWord: false)
        for i in 0...35 { _ = detector.ingest(frame(Double(i) * 20, 0.2)) }
        XCTAssertEqual(detector.roomFloor, 0.2)
        XCTAssertFalse(detector.hasBurst)
        for i in 36...45 { _ = detector.ingest(frame(Double(i) * 20, 0.01)) }
        XCTAssertEqual(detector.roomFloor, 0.01)
        XCTAssertTrue(detector.hasBurst, "A quiet breath can repair eager-child calibration")
        for i in 46...65 { _ = detector.ingest(frame(Double(i) * 20, 0.2)) }
        XCTAssertEqual(detector.roomFloor, 0.01)
    }
    func testShapeFamilyRejectsOppositeFamily() {
        var lowShape = Array(repeating: UInt8(0), count: 256); lowShape[3] = 255
        var hissShape = Array(repeating: UInt8(0), count: 256); hissShape[80] = 255
        var r = ArcadeCheckpointDetector(family: "low", requiresWord: false, roomFloor: 0.01)
        var s = ArcadeCheckpointDetector(family: "hiss", requiresWord: false, roomFloor: 0.01)
        for i in 0...20 {
            _ = r.ingest(frame(Double(i) * 20, 0.2, shape: hissShape))
            _ = s.ingest(frame(Double(i) * 20, 0.2, shape: lowShape))
        }
        XCTAssertFalse(r.hasBurst); XCTAssertFalse(s.hasBurst)
    }
}
