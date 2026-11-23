import Foundation

@main enum NativeSpaceFlightChecks {
    static func check(_ condition: Bool, _ message: String) {
        precondition(condition, message)
    }

    // Step the exact board model with controlled time and no device input.
    static func stepUntilEvent(_ flight: inout NativeSpaceFlight, steering: Double = 0,
                               thrust: Bool = false) -> NativeSpaceFlight.Event {
        for _ in 0..<1_440 {
            let event = flight.step(seconds: 1 / 120, steering: steering, thrust: thrust, active: true)
            if event != .none { return event }
        }
        return .none
    }

    static func main() {
        let trip = NativeSpaceFlight.Trip(worlds: NativeSpaceFlight.worlds,
            pads: [0.42, 0.72, 0.28, 0.58, 0.22, 0.78, 0.4, 0.6])
        var flight = NativeSpaceFlight(stage: 0, little: false, trip: trip)
        let startX = flight.x, startY = flight.y
        flight.easyFlight()
        for _ in 0..<60 { _ = flight.step(seconds: 1 / 60, steering: 1, thrust: true, active: true) }
        check(flight.x == startX && flight.y == startY && flight.power == 10 && flight.misses == 0,
              "A held timer and earned help alone leave an untouched flight at its start")

        flight.start()
        for _ in 0..<30 { _ = flight.step(seconds: 1 / 60, steering: -1, thrust: true, active: true) }
        check(flight.x < startX && flight.y < startY && flight.power < 10, "Holding the engine and steering changes velocity")
        let (stoppedX, stoppedY, heldHelp) = (flight.x, flight.y, flight.power)
        for _ in 0..<60 { _ = flight.step(seconds: 1 / 60, steering: 1, thrust: true, active: false) }
        check(flight.x == stoppedX && flight.y == stoppedY && flight.power == heldHelp,
              "Speech help and background freeze the same flight, including its remaining boost")

        flight = .init(stage: 0, little: false, trip: trip)
        for expected in 1...3 {
            flight.start()
            let event = stepUntilEvent(&flight)
            check(event == .retry && flight.misses == expected && flight.ladder == expected && flight.phase == .ready,
                  "Only a real off-pad contact increments the assistance ladder, without moving to a new planet")
        }
        flight.start()
        let landing = stepUntilEvent(&flight)
        check(landing == .touchdown && flight.phase == .celebrating && abs(flight.x - flight.padX) <= flight.onPad + 0.0001,
              "Attainable pull follows three actual misses and still requires a piloted pad contact")
        for _ in 0..<90 { _ = flight.step(seconds: 1 / 60, steering: 0, thrust: false, active: false) }
        check(flight.celebration == 0, "Pausing with a landed rocket holds the celebration")
        check(stepUntilEvent(&flight) == .done && stepUntilEvent(&flight) == .none,
              "The active 1.15 second celebration reports one move exactly once")

        var little = NativeSpaceFlight(stage: 0, little: true, trip: trip)
        little.start()
        check(stepUntilEvent(&little) == .retry && little.ladder == 2, "Younger players get the beacon after one real miss")
        check(little.world.id == "moon" && little.stage == 0, "A retry retains the same planet and word boundary")

        let late = NativeSpaceFlight(stage: 7, little: false, trip: trip)
        check(late.rocks.count == 2 && late.padWidth == 0.26 && late.world.id == "rainbow",
              "The eighth flight has its own original pad, planet, and two physical rocks")
        let shuffled = NativeSpaceFlight.Trip.random(excluding: "moon")
        check(Set(shuffled.worlds.map(\.id)).count == 8 && shuffled.worlds.first?.id != "moon",
              "A replay visits eight distinct planets with a different opening planet")
        check((0.4...0.6).contains(shuffled.pads[0]) && shuffled.pads.dropFirst().allSatisfy { (0.22...0.78).contains($0) },
              "Pads are sampled separately within the original reachable ranges")
        print("Space Trip flight checks passed")
    }
}
