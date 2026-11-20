import Foundation

/// A speed change preserves the board's current position. Only subsequent
/// movement slows, so earning and losing the effect never jumps the board.
struct NativeArcadeMotionClock {
    private var elapsed: TimeInterval = 0
    private var anchor: TimeInterval = 0
    private var speed: Double = 0

    func position(at time: TimeInterval) -> TimeInterval {
        elapsed + max(0, time - anchor) * speed
    }

    mutating func setSpeed(_ speed: Double, at time: TimeInterval) {
        elapsed = position(at: time)
        anchor = time
        self.speed = speed
    }

    mutating func restart(at time: TimeInterval, speed: Double) {
        elapsed = 0
        anchor = time
        self.speed = speed
    }
}

/// A board decides which gesture or collision was an actual miss. The shared
/// state handles the existing grace window and the all-heart breath recovery.
struct NativeArcadeLives {
    private(set) var hearts: Int
    private var protectedUntil: TimeInterval = -.infinity

    init(startingHearts: Int = 3) { hearts = min(3, max(1, startingHearts)) }

    mutating func miss(at time: TimeInterval, protected: Bool) -> Bool {
        guard hearts > 0, !protected, time >= protectedUntil else { return false }
        hearts -= 1
        protectedUntil = time + 1.5
        return true
    }

    mutating func restore(at time: TimeInterval) {
        guard hearts == 0 else { return }
        hearts = 3
        protectedUntil = time + 1.5
    }
}
