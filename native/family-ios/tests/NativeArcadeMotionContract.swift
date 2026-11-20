import Foundation

@main struct NativeArcadeMotionContract {
    static func main() {
        var clock = NativeArcadeMotionClock()
        clock.restart(at: 10, speed: 1)
        expect(clock.position(at: 14), 4)
        clock.setSpeed(0.55, at: 14)
        expect(clock.position(at: 14), 4)
        expect(clock.position(at: 22), 8.4)
        clock.setSpeed(0, at: 22)
        expect(clock.position(at: 100), 8.4)
        clock.setSpeed(1, at: 100)
        expect(clock.position(at: 102), 10.4)

        var hearts = NativeArcadeLives(startingHearts: 2)
        precondition(hearts.hearts == 2, "The next board refilled spent hearts")
        precondition(!hearts.miss(at: 10, protected: true), "A sound power charged a penalty")
        precondition(hearts.hearts == 2, "A sound power changed the heart count")
        precondition(hearts.miss(at: 11, protected: false) && hearts.hearts == 1, "A real miss did not spend one heart")
        precondition(!hearts.miss(at: 11.2, protected: false), "One collision spent multiple hearts")
        hearts.restore(at: 12)
        precondition(hearts.hearts == 1, "A non-terminal recovery refilled hearts")
        precondition(hearts.miss(at: 14, protected: false) && hearts.hearts == 0)
        precondition(!hearts.miss(at: 20, protected: false), "A stopped board accepted a hit")
        hearts.restore(at: 21)
        precondition(hearts.hearts == 3, "A verified new-life turn did not restore all hearts")
        precondition(!hearts.miss(at: 22, protected: false), "The restored round lost a heart during its grace window")
        print("Native Arcade movement and hearts contracts passed")
    }

    private static func expect(_ actual: Double, _ expected: Double) {
        precondition(abs(actual - expected) < 0.001, "Expected board position \(expected), got \(actual)")
    }
}
