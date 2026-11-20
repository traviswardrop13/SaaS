import Foundation
import XCTest
@testable import SonaSpeechCore

final class PracticeTurnMachineTests: XCTestCase {
    private let target = PracticeTarget(sound: "R", word: "rrrr", level: "isolation")

    private func listeningMachine() -> PracticeTurnMachine {
        var machine = PracticeTurnMachine(target: target)
        XCTAssertEqual(machine.send(.start, atMilliseconds: 0), [.requestPermissions(token: 1)])
        XCTAssertEqual(machine.send(.permission(token: 1, granted: true), atMilliseconds: 0),
                       [.openMicrophone(token: 2, measuringRoom: true)])
        _ = machine.send(.opened(token: 2), atMilliseconds: 0)
        _ = machine.send(.roomMeasured(token: 2), atMilliseconds: 300)
        _ = machine.send(.closed(token: 3, transcript: ""), atMilliseconds: 300)
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 499), [])
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 500), [.playPrompt(token: 4)])
        _ = machine.send(.promptEnded(token: 4), atMilliseconds: 1_000)
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 1_249), [])
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 1_250),
                       [.resetBurst, .openMicrophone(token: 5, measuringRoom: false)])
        _ = machine.send(.opened(token: 5), atMilliseconds: 1_250)
        XCTAssertEqual(machine.phase, .listening)
        return machine
    }

    func testCurrentFamilyAttemptParityFixtures() throws {
        struct Fixture: Decodable {
            let name: String
            let reps: Int
            let transcript: String
            let shape: PracticeWordVerdict
            let expectedPhase: String
            let expectedVerdict: PracticeWordVerdict?
        }
        let url = try XCTUnwrap(Bundle.module.url(forResource: "turn-parity", withExtension: "json", subdirectory: "Fixtures"))
        let fixtures = try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: url))
        for fixture in fixtures {
            var machine = listeningMachine()
            for index in 0..<fixture.reps {
                _ = machine.send(.acoustic(token: 5, countedRep: true, ready: true, shapeVerdict: fixture.shape),
                                 atMilliseconds: 1_800 + Double(index) * 400)
            }
            let end = fixture.reps == 5 ? 3_750.0 : 21_250.0
            XCTAssertEqual(machine.send(.tick, atMilliseconds: end), [.finishPending(token: 5)], fixture.name)
            _ = machine.send(.pendingFinished(token: 5, countedRep: false, shapeVerdict: fixture.shape), atMilliseconds: end)
            _ = machine.send(.closed(token: 6, transcript: fixture.transcript), atMilliseconds: end)
            XCTAssertEqual(machine.send(.tick, atMilliseconds: end + 199), [], fixture.name)
            let effects = machine.send(.tick, atMilliseconds: end + 200)
            XCTAssertEqual(machine.phase.rawValue, fixture.expectedPhase, fixture.name)
            XCTAssertEqual(machine.result?.verdict, fixture.expectedVerdict, fixture.name)
            if let result = machine.result {
                XCTAssertEqual(result.reps, fixture.reps, fixture.name)
                XCTAssertEqual(effects, [.commit(result)], fixture.name)
            } else { XCTAssertEqual(effects, [], fixture.name) }
            XCTAssertEqual(machine.send(.tick, atMilliseconds: end + 500), [], "commit must be once: \(fixture.name)")
        }
    }

    func testQuietWindowRequiresAnotherTap() {
        var machine = listeningMachine()
        _ = machine.send(.tick, atMilliseconds: 21_250)
        _ = machine.send(.pendingFinished(token: 5, countedRep: false, shapeVerdict: .unknown), atMilliseconds: 21_250)
        _ = machine.send(.closed(token: 6, transcript: ""), atMilliseconds: 21_250)
        XCTAssertEqual(machine.phase, .quiet)
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 50_000), [])
        _ = machine.send(.foreground(false), atMilliseconds: 50_001)
        _ = machine.send(.closed(token: 7, transcript: ""), atMilliseconds: 50_001)
        XCTAssertEqual(machine.send(.foreground(true), atMilliseconds: 80_000), [])
        XCTAssertEqual(machine.phase, .paused)
        _ = machine.send(.resume, atMilliseconds: 80_001)
        XCTAssertEqual(machine.phase, .quiet)
        XCTAssertEqual(machine.reps, 0)
        _ = machine.send(.retryQuiet, atMilliseconds: 80_002)
        XCTAssertEqual(machine.phase, .settlingOutput)
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 80_202), [.playPrompt(token: 8)])
    }

    func testPauseKeepsHeardTriesButForegroundAloneDoesNothing() {
        var machine = listeningMachine()
        for time in [1_800.0, 2_200.0] {
            _ = machine.send(.acoustic(token: 5, countedRep: true, ready: true, shapeVerdict: .pass), atMilliseconds: time)
        }
        _ = machine.send(.foreground(false), atMilliseconds: 2_500)
        XCTAssertEqual(machine.phase, .closing)
        XCTAssertEqual(machine.reps, 2)
        _ = machine.send(.closed(token: 6, transcript: "Rrrr"), atMilliseconds: 2_600)
        XCTAssertEqual(machine.phase, .paused)
        XCTAssertEqual(machine.activeListeningMilliseconds, 1_250)
        XCTAssertEqual(machine.recognitionRemainingMilliseconds, 13_750)
        XCTAssertEqual(machine.send(.acoustic(token: 5, countedRep: true, ready: true, shapeVerdict: .pass), atMilliseconds: 2_700), [])
        XCTAssertEqual(machine.reps, 2)
        XCTAssertEqual(machine.send(.foreground(true), atMilliseconds: 60_000), [])
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 60_100), [])
        XCTAssertEqual(machine.phase, .paused)
        XCTAssertEqual(machine.send(.resume, atMilliseconds: 60_200), [.resetBurst])
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 60_449), [])
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 60_450),
                       [.resetBurst, .openMicrophone(token: 7, measuringRoom: false)])
        _ = machine.send(.opened(token: 7), atMilliseconds: 60_450)
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 61_000), [])
        XCTAssertEqual(machine.phase, .listening)
        XCTAssertEqual(machine.reps, 2)
        XCTAssertTrue(machine.interrupted)
    }

    func testInterruptedPromptReplaysOnlyAfterResumeAndSettle() {
        var machine = PracticeTurnMachine(target: target)
        _ = machine.send(.start, atMilliseconds: 0)
        _ = machine.send(.permission(token: 1, granted: true), atMilliseconds: 0)
        _ = machine.send(.opened(token: 2), atMilliseconds: 0)
        _ = machine.send(.roomMeasured(token: 2), atMilliseconds: 300)
        _ = machine.send(.closed(token: 3, transcript: ""), atMilliseconds: 300)
        _ = machine.send(.tick, atMilliseconds: 500)
        _ = machine.send(.pause, atMilliseconds: 600)
        _ = machine.send(.closed(token: 5, transcript: ""), atMilliseconds: 600)
        XCTAssertEqual(machine.send(.promptEnded(token: 4), atMilliseconds: 700), [])
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 8_000), [])
        _ = machine.send(.resume, atMilliseconds: 8_001)
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 8_200), [])
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 8_201), [.playPrompt(token: 6)])
    }

    func testCancelInvalidatesPendingAuthorizationAndAllLateEvents() {
        var machine = PracticeTurnMachine(target: target)
        _ = machine.send(.start, atMilliseconds: 0)
        _ = machine.send(.cancel, atMilliseconds: 1)
        XCTAssertEqual(machine.phase, .closing)
        _ = machine.send(.closed(token: 2, transcript: "taco"), atMilliseconds: 2)
        XCTAssertEqual(machine.phase, .cancelled)
        for event in [PracticeTurnMachine.Event.permission(token: 1, granted: true), .opened(token: 1),
                      .promptEnded(token: 1), .foreground(true), .resume, .retryQuiet, .start, .tick] {
            XCTAssertEqual(machine.send(event, atMilliseconds: 5_000), [])
        }
        XCTAssertEqual(machine.reps, 0)
        XCTAssertNil(machine.result)
    }

    func testPauseDuringFinalCloseKeepsTranscriptAndDoesNotCloseTwice() {
        var machine = listeningMachine()
        _ = machine.send(.acoustic(token: 5, countedRep: true, ready: true, shapeVerdict: .pass), atMilliseconds: 2_000)
        _ = machine.send(.tick, atMilliseconds: 21_250)
        _ = machine.send(.pendingFinished(token: 5, countedRep: false, shapeVerdict: .pass), atMilliseconds: 21_250)
        let effects = machine.send(.pause, atMilliseconds: 21_251)
        XCTAssertEqual(effects, [.stopPlayback, .resetBurst])
        _ = machine.send(.closed(token: 6, transcript: "taco"), atMilliseconds: 21_300)
        XCTAssertEqual(machine.phase, .paused)
        _ = machine.send(.resume, atMilliseconds: 21_500)
        _ = machine.send(.tick, atMilliseconds: 21_750)
        _ = machine.send(.opened(token: 7), atMilliseconds: 21_750)
        _ = machine.send(.tick, atMilliseconds: 21_750)
        _ = machine.send(.pendingFinished(token: 7, countedRep: false, shapeVerdict: .pass), atMilliseconds: 21_750)
        _ = machine.send(.closed(token: 8, transcript: ""), atMilliseconds: 21_750)
        _ = machine.send(.tick, atMilliseconds: 21_950)
        XCTAssertEqual(machine.result?.verdict, .fail)
        XCTAssertEqual(machine.result?.reps, 1)
    }

    func testPromptReplayPreservesCountsAndNeverOpensBeforeItsTail() {
        var machine = listeningMachine()
        _ = machine.send(.acoustic(token: 5, countedRep: true, ready: true, shapeVerdict: .pass), atMilliseconds: 2_000)
        _ = machine.send(.replayPrompt, atMilliseconds: 2_100)
        _ = machine.send(.pendingFinished(token: 5, countedRep: false, shapeVerdict: .pass), atMilliseconds: 2_100)
        _ = machine.send(.closed(token: 6, transcript: "Rrrr"), atMilliseconds: 2_200)
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 2_399), [])
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 2_400), [.playPrompt(token: 7)])
        _ = machine.send(.promptEnded(token: 7), atMilliseconds: 4_000)
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 4_249), [])
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 4_250),
                       [.resetBurst, .openMicrophone(token: 8, measuringRoom: false)])
        XCTAssertEqual(machine.reps, 1)
        XCTAssertEqual(machine.activeListeningMilliseconds, 850)
    }

    func testDeniedOrMissingMicrophoneNeverCountsOrStartsPrompt() {
        var machine = PracticeTurnMachine(target: target)
        _ = machine.send(.start, atMilliseconds: 0)
        XCTAssertEqual(machine.send(.permission(token: 1, granted: false), atMilliseconds: 1), [])
        XCTAssertEqual(machine.phase, .microphoneUnavailable)
        XCTAssertEqual(machine.reps, 0)
        XCTAssertEqual(machine.send(.tick, atMilliseconds: 30_000), [])
        _ = machine.send(.retryQuiet, atMilliseconds: 30_001)
        XCTAssertEqual(machine.phase, .permission)
    }

    func testUnreadyFramesAndBackwardsClockCannotCount() {
        var machine = listeningMachine()
        _ = machine.send(.acoustic(token: 5, countedRep: true, ready: false, shapeVerdict: .pass), atMilliseconds: 1_400)
        _ = machine.send(.acoustic(token: 5, countedRep: true, ready: true, shapeVerdict: .pass), atMilliseconds: 1_300)
        _ = machine.send(.tick, atMilliseconds: .infinity)
        XCTAssertEqual(machine.reps, 0)
        XCTAssertNil(machine.result)
    }
}
