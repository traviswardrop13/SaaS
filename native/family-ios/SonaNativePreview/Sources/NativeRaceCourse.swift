import Foundation

/// Race Car's local road, pit rings, steering and assistance (public/racecar.js).
/// The surrounding Say & Play controller owns authorized moves and every rep.
struct NativeRaceCourse {
    enum Event { case arrived, done }
    enum Kind { case rival, cone, star }
    struct RoadItem: Identifiable {
        let id: Int
        let kind: Kind
        let x: Double
        var z: Double
        var hit = false
    }

    private static let rings: [Double] = [-0.58, 0.56, 0, 0.56, -0.58, 0, -0.58, 0]
    let count = 8
    let legLength = 150.0
    private(set) var leg = 0
    private(set) var car = 0.0
    private(set) var target = 0.0
    private(set) var distance = 0.0
    private(set) var travel = 0.0
    private(set) var stars = 0
    private(set) var items: [RoadItem] = []
    private(set) var slow = 0.0
    private(set) var atRing = false
    private(set) var driving = false
    private(set) var misses = 0
    private(set) var celebration = 0.0
    private(set) var message = "Your very own race day"
    private var little = false
    private var clock = 0.0
    private var bump = 0.0
    private var spawn = 24.0
    private var serial = 0
    private var gateWait = 0.0
    private var activeGate = 0.0
    private var missAt = 0.0
    private var nudged = false

    var ringX: Double { Self.rings[leg] }
    var assistance: Int {
        let time = activeGate >= 8 ? 3 : activeGate >= 4 ? 2 : activeGate >= 2 ? 1 : 0
        let base = max(misses, time)
        let young = little && base > 0 ? base + 1 : base
        return min(3, max(young, slow > 0 && atRing ? 1 : 0))
    }
    var arrow: Bool { atRing && (assistance >= 2 || gateWait >= 6) }

    mutating func startLeg(_ leg: Int, little: Bool) {
        guard Self.rings.indices.contains(leg) else { return }
        self.leg = leg
        self.little = little
        distance = 0; items = []; spawn = 24; atRing = false; celebration = 0
        misses = 0; gateWait = 0; activeGate = 0; missAt = 0; nudged = false
        slow = 8; driving = true; message = "Go! Drag to steer."
    }

    mutating func grantHelp() {
        guard driving else { return }
        slow = 8
        message = atRing ? "Slow road! The ring is bigger." : "Slow road! You’ve got this."
    }

    mutating func steer(to value: Double) {
        guard driving else { return }
        var aim = clamp(value, -0.82, 0.82)
        if atRing && assistance >= 3 && (abs(ringX - car) < 0.05 || (aim - car) * (ringX - car) > 0 || abs(aim - ringX) < 0.6) {
            aim = ringX
        }
        target = aim
        nudged = true
        missAt = 0
    }

    mutating func finishSteering() {
        if driving && atRing { missAt = clock + 0.45 }
    }

    mutating func freezeInput() { missAt = 0; nudged = false }

    func xForTouch(_ x: Double, width: Double) -> Double {
        guard width > 0 else { return 0 }
        return (x - width / 2 - bend(distance: 15, width: width) * 0.15) / (width * (0.40 * 0.85 * 0.85 + 0.025))
    }

    func project(_ x: Double, _ distance: Double, width: Double, height: Double) -> (x: Double, y: Double, scale: Double) {
        let p = clamp(1 - distance / 100, 0, 1), q = p * p
        let horizon = height * 0.27
        return (width / 2 + bend(distance: distance, width: width) * (1 - p) + x * width * (0.40 * q + 0.025),
                horizon + (height * 1.02 - horizon) * q, max(0.06, p))
    }

    func ringRadius(width: Double) -> Double {
        width * 0.30 * 0.81 * 0.58 * [1, 1.5, 2.25, 3][assistance]
    }

    mutating func tick(seconds: Double, width: Double, active: Bool, steering: Bool, braking: Bool) -> Event? {
        guard active, seconds.isFinite, seconds > 0, width > 0 else { return nil }
        let dt = min(0.04, seconds)
        if celebration > 0 {
            celebration = max(0, celebration - dt)
            return celebration == 0 ? .done : nil
        }
        guard driving else { return nil }
        clock += dt
        slow = max(0, slow - dt)
        bump = max(0, bump - dt)
        car += (target - car) * min(1, dt * 9)
        let factor = (slow > 0 ? 0.48 : 1) * (braking ? 0.42 : 1) * (bump > 0 ? 0.4 : 1)
        let delta = atRing ? 0 : (19 + Double(leg) * 0.65) * factor * dt
        travel += delta
        distance = min(legLength, distance + delta)
        spawn -= delta
        if spawn <= 0 && distance < legLength - 55 { addItems(); spawn = 30 }

        for i in items.indices.reversed() {
            items[i].z -= delta * (items[i].kind == .rival ? 0.75 : 1)
            if items[i].z < 19 && !items[i].hit {
                items[i].hit = true
                let item = items[i]
                if abs(item.x - car) < (item.kind == .star ? 0.25 : 0.23) {
                    if item.kind == .star { stars += 1; items.remove(at: i); continue }
                    bump = 0.8; message = "A little bump. Keep going!"
                    items.removeAll { $0.z <= 22 && $0.id != item.id }
                    spawn = 45
                    break
                }
            }
            if items[i].z < -9 { items.remove(at: i) }
        }

        if distance >= legLength {
            let arrival = !atRing
            if arrival {
                atRing = true
                message = leg == count - 1 ? "Drive into the finish ring!" : "Steer into the glowing ring"
            }
            gateWait += dt
            if steering { activeGate += dt }
            let carX = project(car, 15, width: width, height: 1).x
            let gateX = project(ringX, 19, width: width, height: 1).x
            if (arrival || nudged || abs(target - car) > 0.01) && abs(carX - gateX) < ringRadius(width: width) * 0.85 {
                driving = false; atRing = false; items = []; slow = 0; missAt = 0; nudged = false
                celebration = 1.15
                message = leg == count - 1 ? "Finish line!" : "Pit stop! Great driving!"
                return .arrived
            }
            if missAt > 0 && clock >= missAt {
                missAt = 0; misses += 1
                message = assistance >= 3 ? "Nearly! Drag toward the ring." : assistance == 2
                    ? "So close! Follow the arrow." : "So close! Try again!"
            }
        }
        nudged = false
        return nil
    }

    private mutating func addItems() {
        let lanes = [-0.65, 0.0, 0.65]
        let lane = (serial * 2 + leg) % 3
        let id = serial; serial += 1
        let rival = serial % 3 == 0
        items.append(.init(id: id, kind: rival ? .rival : .cone, x: lanes[lane], z: rival ? 55 : 70))
        items.append(.init(id: serial, kind: .star, x: lanes[(lane + 1) % 3], z: 55))
        serial += 1
    }
    private func bend(distance: Double, width: Double) -> Double {
        sin((travel + distance) / 95) * min(width * 0.095, 45)
    }
    private func clamp(_ value: Double, _ lower: Double, _ upper: Double) -> Double {
        max(lower, min(upper, value))
    }
}
