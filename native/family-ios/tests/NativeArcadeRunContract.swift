import Foundation

@main struct NativeArcadeRunContract {
    static func main() throws {
        try finishesOnlyAfterVerifiedCheckpoints(stageCount: 3)
        try finishesOnlyAfterVerifiedCheckpoints(stageCount: 4)
        try aNewLifeUsesTheSameBoardAndARealSaying()
        try endingAtACardNeverReopensPlay()
        print("Native Arcade run contract passed")
    }

    private enum Failure: Error { case contract(String) }

    private static func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
        guard condition() else { throw Failure.contract(message) }
    }

    private static func board(_ run: NativeArcadeRun) throws -> NativeArcadeRun.Board {
        guard case let .board(board) = run.phase else { throw Failure.contract("Expected a board") }
        return board
    }

    private static func card(_ run: NativeArcadeRun) throws -> NativeArcadeRun.Checkpoint {
        guard case let .checkpoint(card) = run.phase else { throw Failure.contract("Expected a speaking checkpoint") }
        return card
    }

    private static func finishesOnlyAfterVerifiedCheckpoints(stageCount: Int) throws {
        var run = NativeArcadeRun(stageCount: stageCount)
        for stage in 0..<2 {
            let current = try board(run)
            try expect(current.stage == stage, "Wrong board order")
            try expect(!run.finishBoard(current), "A checkpoint marked the run finished")
            let checkpoint = try card(run)
            try expect(checkpoint.kind == .nextStage && checkpoint.number == stage + 1, "Wrong checkpoint")
            let stale = NativeArcadeRun.Checkpoint(id: UUID(), board: current, kind: .nextStage)
            run.earn(stale)
            try expect(run.phase == .checkpoint(checkpoint), "A stale saying opened the next board")
            try expect(!run.finishBoard(current), "A stale board bypassed a checkpoint")
            run.earn(checkpoint)
            run.earn(checkpoint)
            try expect(run.remainingSayings == 2 - stage, "A saying was used twice")
        }
        if stageCount == 4 {
            let third = try board(run)
            try expect(!run.finishBoard(third), "The third song ended the round before the finale")
        }
        let last = try board(run)
        try expect(last.stage == stageCount - 1, "Wrong final board")
        try expect(run.finishBoard(last), "The final board did not finish the run")
        try expect(!run.finishBoard(last) && run.didFinish, "Completion happened twice")
    }

    private static func aNewLifeUsesTheSameBoardAndARealSaying() throws {
        var run = NativeArcadeRun(stageCount: 3)
        for restored in 1...4 {
            let current = try board(run)
            try expect(!run.loseLife(current), "A new-life checkpoint ended the run")
            let checkpoint = try card(run)
            try expect(checkpoint.number == 0 && checkpoint.kind == .newLife, "A life had the wrong prompt number")
            run.earn(checkpoint)
            run.earn(checkpoint)
            let retry = try board(run)
            try expect(retry == current, "A new life reset the board")
            try expect(run.restoredLives == restored, "A new life was restored more than once")
            try expect(run.remainingSayings == 3, "A new life spent the next stage’s saying")
        }
        let current = try board(run)
        try expect(!run.finishBoard(current), "Restoring lives bypassed the next stage’s checkpoint")
        let next = try card(run)
        try expect(next.kind == .nextStage, "The next stage’s speaking turn was lost")
        run.earn(next)
        try expect(run.remainingSayings == 2, "The next stage did not spend its own speaking turn")
    }

    private static func endingAtACardNeverReopensPlay() throws {
        var run = NativeArcadeRun(stageCount: 3)
        let current = try board(run)
        _ = run.finishBoard(current)
        let checkpoint = try card(run)
        try expect(run.end(checkpoint), "The child could not finish from a speech card")
        run.earn(checkpoint)
        try expect(run.phase == .endedEarly, "Late speech re-opened a finished game")
        try expect(run.remainingSayings == 3 && !run.end(checkpoint), "Leaving a card used speech or finished twice")
    }
}
