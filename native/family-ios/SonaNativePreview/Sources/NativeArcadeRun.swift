import Foundation

/// The game may keep its own mechanics, but the two source intermissions
/// still require a separate saying before the next board can open.
struct NativeArcadeRun {
    struct Board: Equatable, Hashable {
        let stage: Int
    }

    struct Checkpoint: Equatable, Identifiable {
        enum Kind: Equatable { case nextStage, newLife }
        let id: UUID
        let board: Board
        let kind: Kind

        /// Fruit Slice's authored harder cards are numbered one and two.
        var number: Int { kind == .newLife ? 0 : board.stage + 1 }
    }

    enum Phase: Equatable {
        case board(Board)
        case checkpoint(Checkpoint)
        case endedEarly
    }

    let stageCount: Int
    private(set) var phase: Phase = .board(.init(stage: 0))
    private(set) var remainingSayings = 3
    private(set) var restoredLives = 0
    private(set) var didFinish = false

    init(stageCount: Int) { self.stageCount = stageCount }

    /// Returns true once, when the original round can be saved as finished.
    mutating func finishBoard(_ board: Board, checkpointID: UUID = UUID()) -> Bool {
        guard phase == .board(board), !didFinish else { return false }
        if board.stage == stageCount - 1 {
            didFinish = true
            return true
        }
        if board.stage < 2 {
            return stopForCheckpoint(board, kind: .nextStage, id: checkpointID)
        }
        phase = .board(.init(stage: board.stage + 1))
        return false
    }

    mutating func loseLife(_ board: Board, checkpointID: UUID = UUID()) -> Bool {
        guard phase == .board(board), !didFinish else { return false }
        return stopForCheckpoint(board, kind: .newLife, id: checkpointID)
    }

    mutating func earn(_ checkpoint: Checkpoint) {
        guard phase == .checkpoint(checkpoint), remainingSayings > 0 else { return }
        if checkpoint.kind == .newLife {
            restoredLives += 1
            phase = .board(checkpoint.board)
        } else {
            remainingSayings -= 1
            phase = .board(.init(stage: checkpoint.board.stage + 1))
        }
    }

    mutating func end(_ checkpoint: Checkpoint) -> Bool {
        guard phase == .checkpoint(checkpoint) else { return false }
        phase = .endedEarly
        didFinish = true
        return true
    }

    private mutating func stopForCheckpoint(_ board: Board, kind: Checkpoint.Kind, id: UUID) -> Bool {
        if remainingSayings == 0 {
            phase = .endedEarly
            didFinish = true
            return true
        }
        phase = .checkpoint(.init(id: id, board: board, kind: kind))
        return false
    }
}
