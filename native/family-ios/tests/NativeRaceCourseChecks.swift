import Foundation

@main enum NativeRaceCourseChecks {
    static func main() {
        var car = NativeRaceCourse()
        for _ in 0..<120 {
            precondition(car.tick(seconds: 1.0/60, width: 390, active: true, steering: false, braking: false) == nil)
        }
        precondition(car.distance == 0, "The road never runs before the word opens this leg")
        car.startLeg(0, little: false)
        var braking = car
        for _ in 0..<90 {
            _ = car.tick(seconds: 1.0/60, width: 390, active: true, steering: false, braking: false)
            _ = braking.tick(seconds: 1.0/60, width: 390, active: true, steering: false, braking: true)
        }
        precondition(car.distance > braking.distance * 2 && car.slow < 8, "Braking changes motor travel during the original earned slow road")
        let parkedDistance = car.distance, parkedSlow = car.slow
        for _ in 0..<120 { _ = car.tick(seconds: 1.0/60, width: 390, active: false, steering: true, braking: false) }
        precondition(car.distance == parkedDistance && car.slow == parkedSlow, "Pausing retains travel and help")

        for _ in 0..<3_000 where !car.atRing {
            precondition(car.tick(seconds: 1.0/60, width: 390, active: true, steering: false, braking: false) == nil)
        }
        precondition(car.atRing && car.distance == 150 && car.driving)
        for _ in 0..<540 {
            precondition(car.tick(seconds: 1.0/60, width: 390, active: true, steering: false, braking: false) == nil)
        }
        precondition(car.misses == 0 && car.arrow, "A waiting car stays outside the ring even when the arrow appears")
        for miss in 1...3 {
            car.steer(to: 0.81); car.finishSteering()
            for _ in 0..<40 { _ = car.tick(seconds: 1.0/60, width: 390, active: true, steering: true, braking: false) }
            precondition(car.misses == miss)
        }
        precondition(car.assistance == 3)
        car.steer(to: car.ringX)
        var events: [NativeRaceCourse.Event] = []
        for _ in 0..<240 {
            if let event = car.tick(seconds: 1.0/60, width: 390, active: true, steering: true, braking: false) {
                events.append(event)
            }
        }
        precondition(events == [.arrived, .done], "A real steering move and celebration are required to report one leg")
        for leg in 1..<car.count {
            let priorTravel = car.travel, priorStars = car.stars, priorCar = car.car
            car.startLeg(leg, little: true)
            precondition(car.travel == priorTravel && car.car == priorCar && car.stars == priorStars && car.slow == 8)
            car.steer(to: car.ringX)
            var arrived = false
            for _ in 0..<3_000 where !arrived {
                arrived = car.tick(seconds: 1.0/60, width: 390, active: true, steering: true, braking: false) == .done
            }
            precondition(arrived, "Every pit stop or finish ring can be driven")
        }
        print("Race Car checks passed for all eight sections, real ring arrival, braking and pause")
    }
}
