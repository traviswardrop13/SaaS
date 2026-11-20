import XCTest
@testable import SonaSpeechCore

final class PracticeFlowMachineTests: XCTestCase {
    private func item(_ rung: PracticeRung = .word, sound: String = "R", text: String = "car", position: String = "f") -> PracticeFlowContent {
        PracticeFlowContent(sound: sound, rung: rung, text: text,
                            cueTip: "Pull your tongue back and up like a tiger growl — rrr!", position: position)
    }
    private func result(_ verdict: PracticeWordVerdict, _ reps: Int = 5, interrupted: Bool = false) -> PracticeAttemptResult {
        PracticeAttemptResult(reps: reps, verdict: verdict, interrupted: interrupted)
    }
    private func started(_ flow: inout PracticeFlowMachine) throws -> PracticeFlowMachine.Turn {
        _ = flow.send(.start)
        return try XCTUnwrap(flow.currentTurn)
    }
    private func saved(_ effects: [PracticeFlowMachine.Effect]) -> [PracticeFlowMachine.VerifiedAttempt] {
        effects.compactMap { if case .saveVerifiedAttempt(let value) = $0 { return value }; return nil }
    }
    private func ready(_ effects: [PracticeFlowMachine.Effect]) -> PracticeFlowMachine.Ready? {
        effects.compactMap { if case .readyForGame(let value) = $0 { return value }; return nil }.first
    }
    private func wins(_ effects: [PracticeFlowMachine.Effect]) -> Int {
        effects.filter { if case .recordRungWin = $0 { return true }; return false }.count
    }

    func testFirstFullPassBooksActualItemAndOneRungWinThenBecomesReady() throws {
        var flow = try PracticeFlowMachine(content: item(), masteredRung: 1)
        let turn = try started(&flow)
        let effects = flow.send(.completed(turn.id, result(.pass)))
        XCTAssertEqual(saved(effects).count, 1)
        XCTAssertEqual(saved(effects).first?.content.position, "f")
        XCTAssertEqual(saved(effects).first?.content.target.word, "car")
        XCTAssertEqual(wins(effects), 1)
        let end = try XCTUnwrap(ready(effects))
        XCTAssertTrue(end.advanceRing)
        XCTAssertEqual(end.practiceSessionTries, 5)
        XCTAssertEqual(end.feedback, [.successfulLaunch])
        XCTAssertEqual(end.feedbackBeforeBookkeeping, [])
        XCTAssertEqual(end.feedbackAfterBookkeeping, [.successfulLaunch])
        XCTAssertEqual(flow.phase, .ready)
        XCTAssertTrue(flow.send(.completed(turn.id, result(.pass))).isEmpty, "duplicate callback cannot save or win twice")
    }

    func testPartialPassStillOpensGameButDoesNotWinRung() throws {
        var flow = try PracticeFlowMachine(content: item(), masteredRung: 0)
        let turn = try started(&flow)
        let effects = flow.send(.completed(turn.id, result(.pass, 2)))
        XCTAssertEqual(saved(effects).first?.result.reps, 2)
        XCTAssertEqual(wins(effects), 0)
        XCTAssertTrue(try XCTUnwrap(ready(effects)).advanceRing)
    }

    func testPassBelowMasteredRungNeverWinsIt() throws {
        var flow = try PracticeFlowMachine(content: item(.syllable), masteredRung: 2)
        let turn = try started(&flow)
        XCTAssertEqual(wins(flow.send(.completed(turn.id, result(.pass)))), 0)
    }

    func testFailedFirstAndRetryUseSuppliedSameSoundStepDownWithoutWinningRung() throws {
        let easier = item(.syllable, text: "ar")
        var flow = try PracticeFlowMachine(content: item(), masteredRung: 1, stepNext: easier)
        let first = try started(&flow)
        let firstEffects = flow.send(.completed(first.id, result(.fail)))
        XCTAssertEqual(saved(firstEffects).count, 1)
        let retry = try XCTUnwrap(flow.currentTurn)
        XCTAssertEqual(retry.stage, .retry)
        XCTAssertEqual(retry.requiredReps, 3)
        XCTAssertEqual(retry.prompt, item().retryPrompt())
        XCTAssertTrue(flow.send(.completed(first.id, result(.pass))).isEmpty, "old initial result cannot save as a retry")
        let retryEffects = flow.send(.completed(retry.id, result(.fail, 3)))
        XCTAssertEqual(saved(retryEffects).count, 1)
        let down = try XCTUnwrap(flow.currentTurn)
        XCTAssertEqual(down.stage, .stepDown)
        XCTAssertEqual(down.content, easier)
        XCTAssertEqual(down.requiredReps, 3)
        XCTAssertEqual(down.prompt, easier.stepDownPrompt())
        let final = flow.send(.completed(down.id, result(.pass, 3)))
        XCTAssertEqual(wins(firstEffects + retryEffects + final), 0)
        XCTAssertEqual(saved(final).first?.content.rung, .syllable)
        let end = try XCTUnwrap(ready(final))
        XCTAssertEqual(end.verifiedReps, 11)
        XCTAssertEqual(end.feedback, [.stepDownPraise, .successfulLaunch])
        XCTAssertEqual(end.feedbackBeforeBookkeeping, [.stepDownPraise])
        XCTAssertEqual(end.feedbackAfterBookkeeping, [.successfulLaunch])
        XCTAssertTrue(end.advanceRing)
        XCTAssertTrue(flow.send(.completed(down.id, result(.pass, 3))).isEmpty)
    }

    func testTwoIsolationFailsStillOpenGameWithTruthfulLedgerAndRing() throws {
        var flow = try PracticeFlowMachine(content: item(.isolation, text: "rrrr", position: ""), masteredRung: 0)
        let first = try started(&flow)
        _ = flow.send(.completed(first.id, result(.fail)))
        let retry = try XCTUnwrap(flow.currentTurn)
        let effects = flow.send(.completed(retry.id, result(.fail, 3)))
        let end = try XCTUnwrap(ready(effects))
        XCTAssertEqual(end.lastVerdict, .fail)
        XCTAssertEqual(end.verifiedReps, 8)
        XCTAssertEqual(end.feedback, [.finalFailure])
        XCTAssertEqual(end.feedbackBeforeBookkeeping, [.finalFailure])
        XCTAssertTrue(end.feedbackAfterBookkeeping.isEmpty)
        XCTAssertTrue(end.advanceRing, "showing up counts after actual verified attempts, including misses")
        XCTAssertEqual(wins(effects), 0)
    }

    func testMissingStepNextNeverInventsAnEasierTarget() throws {
        var flow = try PracticeFlowMachine(content: item(), masteredRung: 0)
        let first = try started(&flow)
        _ = flow.send(.completed(first.id, result(.fail)))
        let retry = try XCTUnwrap(flow.currentTurn)
        let effects = flow.send(.completed(retry.id, result(.fail, 3)))
        XCTAssertEqual(ready(effects)?.content, item())
    }

    func testSilenceAndUnknownNeverSaveCountWinRingOrUnlock() throws {
        for attempt in [result(.pass, 0), result(.unknown, 5)] {
            var flow = try PracticeFlowMachine(content: item(.isolation), masteredRung: 0)
            let first = try started(&flow)
            let effects = flow.send(.completed(first.id, attempt))
            XCTAssertEqual(flow.phase, .quiet)
            XCTAssertTrue(saved(effects).isEmpty)
            XCTAssertEqual(wins(effects), 0)
            XCTAssertNil(ready(effects))
            XCTAssertFalse(flow.anyReps)
            XCTAssertEqual(flow.verifiedReps, 0)
            XCTAssertTrue(flow.send(.completed(first.id, result(.pass))).isEmpty)
        }
    }

    func testQuietReplayKeepsShippingFiveWordedPromptAndThreeRepRetryWindow() throws {
        var flow = try PracticeFlowMachine(content: item(.isolation, text: "rrrr"), masteredRung: 0)
        let first = try started(&flow)
        _ = flow.send(.completed(first.id, result(.fail)))
        let retry = try XCTUnwrap(flow.currentTurn)
        _ = flow.send(.quiet(retry.id, microphoneUnavailable: false))
        _ = flow.send(.retryQuiet)
        let replay = try XCTUnwrap(flow.currentTurn)
        XCTAssertEqual(replay.stage, .retry)
        XCTAssertEqual(replay.requiredReps, 3)
        XCTAssertEqual(replay.prompt, "Ready? Make your R sound, five times. Go!")
        XCTAssertNotEqual(replay.id, retry.id)
        XCTAssertTrue(flow.send(.completed(retry.id, result(.pass, 3))).isEmpty)
    }

    func testLeavingQuietAfterPriorMissDoesNotAwardRingOrLaunch() throws {
        var flow = try PracticeFlowMachine(content: item(), masteredRung: 0)
        let first = try started(&flow)
        _ = flow.send(.completed(first.id, result(.fail)))
        let retry = try XCTUnwrap(flow.currentTurn)
        _ = flow.send(.quiet(retry.id, microphoneUnavailable: false))
        XCTAssertTrue(flow.anyReps)
        let effects = flow.send(.cancel)
        XCTAssertNil(ready(effects))
        XCTAssertEqual(flow.phase, .cancelled)
        XCTAssertTrue(flow.send(.completed(retry.id, result(.pass, 3))).isEmpty)
        XCTAssertTrue(flow.send(.retryQuiet).isEmpty)
    }

    func testDemoReplayKeepsInteractionButEmitsNoPersistenceOrRing() throws {
        var flow = try PracticeFlowMachine(content: item(), masteredRung: 0, demoReplay: true, isDaily: true)
        let first = try started(&flow)
        let effects = flow.send(.completed(first.id, result(.pass)))
        XCTAssertTrue(saved(effects).isEmpty)
        XCTAssertEqual(wins(effects), 0)
        let end = try XCTUnwrap(ready(effects))
        XCTAssertFalse(end.advanceRing)
        XCTAssertTrue(end.markDailyReady)
        XCTAssertNil(end.practiceSessionTries)
    }

    func testAlreadyRingedDailyRoundDoesNotAdvanceAgain() throws {
        var flow = try PracticeFlowMachine(content: item(), masteredRung: 0, alreadyRinged: true, isDaily: true)
        let first = try started(&flow)
        let end = try XCTUnwrap(ready(flow.send(.completed(first.id, result(.pass)))))
        XCTAssertFalse(end.advanceRing)
        XCTAssertTrue(end.markDailyReady)
        XCTAssertNil(end.practiceSessionTries)
    }

    func testDifferentFlowIdentifierRejectsStaleTurnEvenAtSameOrdinal() throws {
        var old = try PracticeFlowMachine(content: item(), masteredRung: 0)
        let oldTurn = try started(&old)
        var current = try PracticeFlowMachine(content: item(sound: "S"), masteredRung: 0)
        _ = try started(&current)
        XCTAssertTrue(current.send(.completed(oldTurn.id, result(.pass))).isEmpty)
        XCTAssertFalse(current.anyReps)
    }

    func testSuppliedStepDownMustBeSameSoundAndEarlierRung() {
        XCTAssertThrowsError(try PracticeFlowMachine(content: item(), masteredRung: 0, stepNext: item(.syllable, sound: "S")))
        XCTAssertThrowsError(try PracticeFlowMachine(content: item(), masteredRung: 0, stepNext: item(.sentence)))
        XCTAssertThrowsError(try PracticeFlowMachine(content: item(), masteredRung: 0, stepNext: item()))
    }

    func testUnavailableMicUsesExistingMessageAndFirstPassAfterQuietCanWin() throws {
        var flow = try PracticeFlowMachine(content: item(), masteredRung: 0)
        let first = try started(&flow)
        let effects = flow.send(.quiet(first.id, microphoneUnavailable: true))
        XCTAssertEqual(effects, [.showQuiet(PracticeFlowContent.microphoneUnavailable)])
        _ = flow.send(.retryQuiet)
        let again = try XCTUnwrap(flow.currentTurn)
        let accepted = flow.send(.completed(again.id, result(.pass, 5, interrupted: true)))
        XCTAssertEqual(saved(accepted).first?.result.interrupted, true)
        XCTAssertEqual(wins(accepted), 1)
        XCTAssertNotNil(ready(accepted))
    }

    func testCancelCanStopPendingHandoffWithoutRewritingEarnedHistory() throws {
        var flow = try PracticeFlowMachine(content: item(), masteredRung: 0)
        let first = try started(&flow)
        _ = flow.send(.completed(first.id, result(.pass)))
        XCTAssertEqual(flow.phase, .ready)
        let cancelled = flow.send(.cancel)
        XCTAssertEqual(flow.phase, .cancelled)
        XCTAssertNil(ready(cancelled))
        XCTAssertTrue(saved(cancelled).isEmpty)
        XCTAssertEqual(flow.verifiedReps, 5)
        XCTAssertTrue(flow.send(.completed(first.id, result(.pass))).isEmpty)
    }
}
