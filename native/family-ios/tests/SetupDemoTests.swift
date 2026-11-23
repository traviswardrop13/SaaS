import Foundation
import CoreGraphics
import XCTest
@testable import SonaSetupDemoHarness

final class NativeSetupDemoTests: XCTestCase {
    func testCurrentTwoSecondComparisonUsesFreshIntervalAfterDelayedFrame() {
        var clock = NativeSetupDemoClock()
        clock.appear(now: 0, foreground: true, reducedMotion: false)
        XCTAssertEqual(clock.phase, .normal)
        clock.advance(now: 1.999); XCTAssertEqual(clock.phase, .normal)
        clock.advance(now: 2); XCTAssertEqual(clock.phase, .afterPractice)
        clock.advance(now: 3.999); XCTAssertEqual(clock.phase, .afterPractice)
        clock.advance(now: 4); XCTAssertEqual(clock.phase, .normal)
        clock.advance(now: 25); XCTAssertEqual(clock.phase, .afterPractice)
        XCTAssertEqual(clock.nextSwap, 27)
    }
    func testTapOnEitherSideIncludingSelectedSideRestartsItsFullTwoSeconds() {
        var clock = NativeSetupDemoClock()
        clock.appear(now: 0, foreground: true, reducedMotion: false)
        clock.select(.normal, now: 1.9)
        clock.advance(now: 2.1); XCTAssertEqual(clock.phase, .normal)
        clock.advance(now: 3.9); XCTAssertEqual(clock.phase, .afterPractice)
        clock.select(.afterPractice, now: 5.8)
        clock.advance(now: 6); XCTAssertEqual(clock.phase, .afterPractice)
        clock.advance(now: 7.8); XCTAssertEqual(clock.phase, .normal)
        clock.select(.afterPractice, now: 8)
        clock.advance(now: 9.999); XCTAssertEqual(clock.phase, .afterPractice)
        clock.advance(now: 10); XCTAssertEqual(clock.phase, .normal)
    }
    func testBackgroundAndDepartureStopComparisonsAndReturningSceneStartsNormal() {
        var clock = NativeSetupDemoClock()
        clock.appear(now: 0, foreground: true, reducedMotion: false)
        clock.advance(now: 2); XCTAssertEqual(clock.phase, .afterPractice)
        clock.setForeground(false, now: 2.1)
        XCTAssertFalse(clock.isAnimating); XCTAssertNil(clock.nextSwap)
        clock.advance(now: 200); XCTAssertEqual(clock.phase, .afterPractice)
        clock.select(.normal, now: 201); XCTAssertEqual(clock.phase, .afterPractice)
        clock.setForeground(true, now: 202)
        XCTAssertEqual(clock.phase, .normal); XCTAssertEqual(clock.nextSwap, 204)
        clock.disappear(); clock.advance(now: 500)
        XCTAssertFalse(clock.isAnimating); XCTAssertNil(clock.nextSwap)
        clock.appear(now: 600, foreground: true, reducedMotion: false)
        XCTAssertEqual(clock.phase, .normal); XCTAssertEqual(clock.nextSwap, 602)
    }
    func testReduceMotionIsStaticManualComparisonAndResumeKeepsChosenSide() {
        var clock = NativeSetupDemoClock()
        clock.appear(now: 0, foreground: true, reducedMotion: true)
        XCTAssertFalse(clock.isAnimating); XCTAssertNil(clock.nextSwap)
        clock.advance(now: 100); XCTAssertEqual(clock.phase, .normal)
        clock.select(.afterPractice, now: 101)
        clock.advance(now: 200); XCTAssertEqual(clock.phase, .afterPractice)
        XCTAssertNil(clock.nextSwap)
        clock.setReducedMotion(false, now: 201)
        XCTAssertTrue(clock.isAnimating); XCTAssertEqual(clock.phase, .afterPractice)
        clock.advance(now: 202.999); XCTAssertEqual(clock.phase, .afterPractice)
        clock.advance(now: 203); XCTAssertEqual(clock.phase, .normal)
        clock.setReducedMotion(true, now: 203.1)
        clock.advance(now: 1000); XCTAssertEqual(clock.phase, .normal)
    }
    func testHiddenMountNeverRunsAndCannotBeRearmedByLateTap() {
        var clock = NativeSetupDemoClock()
        clock.appear(now: 0, foreground: false, reducedMotion: false)
        clock.select(.afterPractice, now: 0.5); clock.advance(now: 3)
        XCTAssertEqual(clock.phase, .normal); XCTAssertFalse(clock.isAnimating)
        clock.disappear(); clock.select(.afterPractice, now: 8)
        XCTAssertNil(clock.nextSwap); XCTAssertEqual(clock.phase, .normal)
    }
    func testFruitUsesAuthoredCropAndSpeedRatioAndOnlyVisualSwipePieces() {
        var normal = NativeSetupFruitScene(), slow = NativeSetupFruitScene()
        let size = CGSize(width: 320, height: 340)
        for _ in 0..<10 { normal.advance(0.02, slow: false, size: size); slow.advance(0.02, slow: true, size: size) }
        XCTAssertEqual(normal.time, 0.2, accuracy: 0.0001)
        XCTAssertEqual(slow.time, 0.09, accuracy: 0.0001)
        XCTAssertEqual(NativeSetupFruitScene.kinds.map(\.name), ["apple", "orange", "watermelon", "grapes", "lemon"])
        XCTAssertEqual(NativeSetupFruitScene.kinds[2].crop, CGRect(x: 13, y: 43, width: 360, height: 305))
        let target = normal.fruits[0]
        normal.swipe(from: CGPoint(x: target.x - 50, y: target.y), to: CGPoint(x: target.x + 50, y: target.y))
        XCTAssertTrue(normal.fruits.isEmpty); XCTAssertEqual(normal.halves.count, 2)
        XCTAssertEqual(normal.drops.count, 10)
    }
    func testPianoUsesOriginalPatternAndSlowerTravelWithoutAnyPracticeLedger() {
        var normal = NativeSetupPianoScene(), slow = NativeSetupPianoScene()
        let size = CGSize(width: 320, height: 340)
        for _ in 0..<10 { normal.advance(0.02, slow: false, size: size); slow.advance(0.02, slow: true, size: size) }
        XCTAssertEqual(normal.songTime, 0.99, accuracy: 0.0001)
        XCTAssertEqual(slow.songTime, 0.79 + 0.2 * 1.05 / 2.65, accuracy: 0.0001)
        XCTAssertEqual(normal.notes.prefix(3).map(\.lane), [0, 2, 1])
        normal.hit(lane: 3, size: size, reducedMotion: false)
        XCTAssertEqual(normal.flashes[3], 1); XCTAssertEqual(normal.sparks.count, 7)
    }
    func testSessionClearsAllVisualWorkAndNeverAdvancesAfterBackgroundOrLeave() {
        for kind in NativeSetupDemoKind.allCases {
            var session = NativeSetupDemoSession(kind: kind)
            session.appear(now: 0, foreground: true, reducedMotion: false)
            for i in 0..<50 { session.advance(now: Double(i) / 30) }
            if kind == .fruit { XCTAssertGreaterThan(session.fruit.time, 1) }
            else { XCTAssertGreaterThan(session.piano.songTime, 1) }
            session.foreground(false, now: 2)
            XCTAssertTrue(session.fruit.fruits.isEmpty); XCTAssertTrue(session.piano.notes.isEmpty)
            session.advance(now: 500)
            XCTAssertEqual(session.fruit.time, 0); XCTAssertEqual(session.piano.songTime, 0.79)
            session.foreground(true, now: 501)
            session.advance(now: 501); session.advance(now: 501.02)
            XCTAssertEqual(session.clock.phase, .normal)
            session.disappear(); session.advance(now: 1000)
            XCTAssertTrue(session.fruit.fruits.isEmpty); XCTAssertTrue(session.fruit.swipes.isEmpty)
            XCTAssertTrue(session.piano.notes.isEmpty); XCTAssertTrue(session.piano.sparks.isEmpty)
        }
    }
    func testReduceMotionSessionDrawsStableAuthoredStillAndAcceptsOnlyVisualKeyTap() {
        var fruit = NativeSetupDemoSession(kind: .fruit)
        fruit.appear(now: 0, foreground: true, reducedMotion: true)
        let positions = fruit.fruit.fruits.map { CGPoint(x: $0.x, y: $0.y) }
        fruit.advance(now: 100)
        fruit.swipe(from: .zero, to: CGPoint(x: 400, y: 400))
        XCTAssertEqual(fruit.fruit.fruits.map { CGPoint(x: $0.x, y: $0.y) }, positions)
        XCTAssertEqual(fruit.fruit.time, 0)
        var piano = NativeSetupDemoSession(kind: .piano)
        piano.appear(now: 0, foreground: true, reducedMotion: true)
        piano.tap(CGPoint(x: 300, y: 310)); piano.advance(now: 500)
        XCTAssertEqual(piano.piano.flashes[3], 1); XCTAssertTrue(piano.piano.sparks.isEmpty)
        XCTAssertEqual(piano.piano.songTime, 0.79)
    }
    func testReusedViewPositionReconfiguresKindAndClearsPriorComparisonAndScene() {
        var scene = NativeSetupDemoSession(kind: .fruit)
        scene.resize(CGSize(width: 280, height: 255))
        scene.appear(now: 0, foreground: true, reducedMotion: false)
        scene.advance(now: 0); scene.advance(now: 0.03)
        scene.select(.afterPractice, now: 0.1)
        XCTAssertFalse(scene.fruit.fruits.isEmpty)
        scene.reconfigure(kind: .piano, now: 1, foreground: true, reducedMotion: false)
        XCTAssertEqual(scene.size, CGSize(width: 280, height: 255))
        XCTAssertEqual(scene.kind, .piano); XCTAssertEqual(scene.clock.phase, .normal)
        XCTAssertEqual(scene.clock.nextSwap, 3)
        XCTAssertTrue(scene.fruit.fruits.isEmpty); XCTAssertTrue(scene.fruit.halves.isEmpty)
        scene.advance(now: 1); scene.advance(now: 1.03)
        XCTAssertFalse(scene.piano.notes.isEmpty)
        XCTAssertEqual(scene.fruit.time, 0)
        scene.reconfigure(kind: .fruit, now: 2, foreground: true, reducedMotion: true)
        XCTAssertEqual(scene.kind, .fruit); XCTAssertFalse(scene.clock.isAnimating)
        XCTAssertEqual(scene.fruit.fruits.count, 2); XCTAssertTrue(scene.piano.notes.isEmpty)
    }
}
