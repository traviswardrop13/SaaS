import Foundation

/// The current six-page clock in arcade-speech-help.js. The board owns the
/// gameplay clock and hearts, while the sound turn owns its listening deadline.
struct NativeArcadePowerSchedule {
    enum Outcome { case earned, unanswered, cancelled }

    private(set) var powerRemaining = 0.0
    private var nextAsk = 6_000.0
    private var eligiblePlay = 0.0
    private var missed = 0
    private var heldForEndOfStage = false
    private var lastTick: Double?
    private var wasPlaying = false

    mutating func poll(at time: Double, playing: Bool, canAsk: Bool,
                       remainingInStage: Double?, reasonHeard: Bool) -> Bool {
        guard time.isFinite, time >= (lastTick ?? time) else { return false }
        let elapsed = lastTick.map { min(time - $0, 1_000) } ?? 0
        lastTick = time
        let activeElapsed = playing && wasPlaying ? elapsed : 0
        wasPlaying = playing
        if powerRemaining > 0 {
            powerRemaining = max(0, powerRemaining - activeElapsed)
            return false
        }
        guard playing, canAsk else { return false }
        eligiblePlay += activeElapsed
        guard eligiblePlay >= nextAsk else { return false }
        let requiredRoom = reasonHeard ? 5_000.0 : 7_000.0
        heldForEndOfStage = remainingInStage.map { !$0.isNaN && $0 < requiredRoom } ?? false
        return !heldForEndOfStage
    }

    mutating func begin() {
        eligiblePlay = 0
        heldForEndOfStage = false
    }

    mutating func complete(_ outcome: Outcome, duration: Double, at time: Double) {
        switch outcome {
        case .earned: missed = 0; powerRemaining = duration
        case .unanswered: missed = min(2, missed + 1)
        case .cancelled: break
        }
        if time.isFinite, time >= (lastTick ?? time) { lastTick = time }
        restartAskClock()
    }

    mutating func stageChanged(clearPower: Bool) {
        if heldForEndOfStage { restartAskClock() }
        if clearPower { clearEarnedPower() }
    }

    mutating func clearEarnedPower() { powerRemaining = 0 }

    private mutating func restartAskClock() {
        eligiblePlay = 0
        heldForEndOfStage = false
        nextAsk = missed >= 2 ? 40_000 : 20_000
    }
}
