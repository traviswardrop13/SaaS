import Foundation
import XCTest
@testable import SonaSpeechCore

final class PracticePromptMemoryTests: XCTestCase {
    func testApprovedEncodedPlaybackNeedsNoFileAndPreservesBytes() {
        let bytes = Data([0x52, 0x49, 0x46, 0x46, 0, 1, 2, 3])
        let prompt = PracticePrompt(text: "Go!", encodedAudio: bytes, volume: 0.4, playbackRate: 0.7)
        XCTAssertEqual(prompt.encodedAudio, bytes)
        XCTAssertTrue(prompt.parts.isEmpty)
        XCTAssertEqual(prompt.volume, 0.4)
        XCTAssertEqual(prompt.playbackRate, 0.7)
    }

    func testExistingFilePartAPIAndDefaultsRemainCompatible() {
        let file = URL(fileURLWithPath: "/test-only-model.wav")
        let part = PracticePrompt.Part(fileURL: file)
        let prompt = PracticePrompt(text: "Go!", parts: [part])
        XCTAssertEqual(prompt.parts, [part])
        XCTAssertNil(prompt.encodedAudio)
        XCTAssertEqual(prompt.volume, 0.8)
        XCTAssertEqual(prompt.playbackRate, 1)
        XCTAssertFalse(prompt.isMuted)
    }
    func testInstalledNarrationRetainsOnlyAuthoredTextAndSourceSlowRate() {
        let text = "Ready? Make your R sound, five times."
        let prompt = PracticePrompt(text: text, systemSpeech: .init(text: text, slow: true), volume: 0.4)
        XCTAssertEqual(prompt.systemSpeech?.text, text)
        XCTAssertEqual(prompt.systemSpeech?.relativeRate, 0.62)
        XCTAssertEqual(prompt.systemSpeech?.pitch, 1.05)
        XCTAssertTrue(prompt.parts.isEmpty)
        XCTAssertNil(prompt.encodedAudio)
        XCTAssertEqual(prompt.volume, 0.4)
    }

}
