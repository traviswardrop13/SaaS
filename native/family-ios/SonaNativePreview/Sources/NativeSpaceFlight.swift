import Foundation

/// Space Trip's original normalized flight mechanics (public/space.js).
/// One instance is one authorized motor leg. Contacts never earn speech.
struct NativeSpaceFlight {
    struct World: Identifiable, Equatable {
        let id, name: String
        let color: UInt32
        let gravity: Double
    }

    struct Trip {
        let worlds: [World]
        let pads: [Double]

        static func random(excluding previousFirst: String? = nil) -> Self {
            var generator = SystemRandomNumberGenerator()
            var worlds = NativeSpaceFlight.worlds.shuffled(using: &generator)
            if worlds.first?.id == previousFirst { worlds.append(worlds.removeFirst()) }
            var pads = [Double.random(in: 0.4...0.6, using: &generator)]
            for _ in 1..<worlds.count {
                let prior = pads.last!
                var pad = prior
                for _ in 0..<40 {
                    pad = Double.random(in: 0.22...0.78, using: &generator)
                    if abs(pad - prior) >= 0.2 { break }
                }
                pads.append(pad)
            }
            return .init(worlds: worlds, pads: pads)
        }
    }

    struct Rock {
        let x, y, radius: Double
    }

    enum Phase: Equatable { case ready, flying, celebrating, reported }
    enum Event: Equatable { case none, retry, touchdown, done }

    static let worlds: [World] = [
        .init(id: "moon", name: "the Moon", color: 0xe4d8c2, gravity: 1),
        .init(id: "mint", name: "the Mint Planet", color: 0x7fd9c4, gravity: 0.9),
        .init(id: "candy", name: "the Candy Planet", color: 0xf5a8cb, gravity: 0.85),
        .init(id: "ice", name: "the Ice Planet", color: 0xa9daf5, gravity: 1.1),
        .init(id: "purple", name: "the Purple Planet", color: 0xbba4ea, gravity: 1),
        .init(id: "sandy", name: "the Sandy Planet", color: 0xf0cd6a, gravity: 1.15),
        .init(id: "blue", name: "the Blue Planet", color: 0x7ea9f2, gravity: 0.95),
        .init(id: "rainbow", name: "the Rainbow Planet", color: 0xbba4ea, gravity: 1.05)
    ]
    private static let padWidths = [0.32, 0.3, 0.3, 0.28, 0.29, 0.28, 0.27, 0.26]
    private static let gravity = [0.1, 0.11, 0.115, 0.13, 0.125, 0.14, 0.13, 0.145]
    private static let rockLayout: [[(Double, Double, Double)]] = [
        [], [], [(0.49, 0.54, 0.045)], [(0.03, 0.62, 0.05)], [(0.29, 0.54, 0.045)],
        [(0.4, 0.57, 0.04)], [(0.16, 0.64, 0.04)], [(0.03, 0.5, 0.04), (1.8, 0.58, 0.04)]
    ]

    let stage: Int
    let little: Bool
    let world: World
    let padX: Double
    let ground = 0.84
    let skyTop = 0.05
    private(set) var x = 0.77, y = 0.23, vx = 0.0, vy = 0.0
    private(set) var width = 390.0, height = 480.0
    private(set) var shipHeight = 74.0
    private(set) var phase = Phase.ready
    private(set) var misses = 0
    private(set) var power = 0.0
    private(set) var cushions = false
    private(set) var celebration = 0.0
    private(set) var message = "A new planet! Steer to the glow"

    init(stage: Int, little: Bool, trip: Trip) {
        self.stage = stage
        self.little = little
        world = trip.worlds[stage]
        padX = trip.pads[stage]
        resetShip()
    }

    var shipWidth: Double { shipHeight * 367 / 512 }
    var padWidth: Double { Self.padWidths[stage] }
    var ladder: Int { little ? (misses >= 2 ? 3 : misses == 1 ? 2 : 0) : min(3, misses) }
    var onPad: Double { max(0.02, padWidth / 2 - shipWidth * 0.35 / width) }
    var tolerance: Double {
        let bonus = onPad + (power > 0 ? 0.035 : 0)
        switch ladder {
        case 3: return max(bonus, padWidth / 2 + 0.15)
        case 2: return max(bonus, onPad * 2.2)
        case 1: return max(bonus, onPad * 1.5)
        default: return bonus
        }
    }

    private var spawnX: Double { padX > 0.5 ? 0.23 : 0.77 }
    private var ceiling: Double { skyTop + shipHeight / 2 / height }
    private var bottom: Double { y + shipHeight / 2 / height }
    private var safeVy: Double { ladder >= 2 ? 0.3 : ladder == 1 ? 0.21 : power > 0 ? 0.19 : 0.135 }
    private var safeVx: Double { ladder >= 2 ? 0.27 : ladder == 1 ? 0.18 : power > 0 ? 0.18 : 0.12 }

    var rocks: [Rock] {
        let room = (ground - skyTop) * height
        return Self.rockLayout[stage].map { route, elevation, size in
            var left = spawnX + (padX - spawnX) * route
            if !(0.1...0.9).contains(left) { left = 2 * padX - left }
            let radius = size * min(width, room * 1.2)
            var top = skyTop * height + room * elevation
            if abs(left - spawnX) * width < radius + shipWidth * 0.3 + 8 {
                top = max(top, ceiling * height + 16 + shipHeight * 0.42 + radius + 12)
            }
            return Rock(x: left, y: top / height, radius: radius)
        }
    }

    mutating func resize(width: Double, height: Double) {
        guard width > 0, height > 65 else { return }
        self.width = width
        self.height = height
        shipHeight = min(90, width * 0.22, (ground - skyTop) * height * 0.28)
        if phase == .ready { resetShip() }
        else if phase == .flying {
            let edge = shipWidth / width / 2 + 0.012
            x = clamp(x, edge, 1 - edge)
            y = clamp(y, ceiling, ground - shipHeight / 2 / height)
        } else { y = ground - shipHeight / 2 / height }
    }

    mutating func start() {
        guard phase == .ready else { return }
        phase = .flying
        if ladder < 2 { message = "Aim for the glow. Land gently" }
    }

    mutating func easyFlight() {
        guard phase == .ready || phase == .flying else { return }
        power = 10
        if ladder < 2 { message = "Easy flight! Aim for the glow" }
    }

    /// Only active elapsed time may advance flight, help or the 1.15s win beat.
    mutating func step(seconds: Double, steering: Double, thrust: Bool, active: Bool) -> Event {
        guard active, seconds.isFinite, seconds > 0 else { return .none }
        let dt = min(0.04, seconds)
        if phase == .celebrating {
            celebration = min(1.15, celebration + dt)
            guard celebration >= 1.15 else { return .none }
            phase = .reported
            return .done
        }
        guard phase == .flying else { return .none }
        power = max(0, power - dt)
        let direction = clamp(steering, -1, 1), lv = ladder
        let damping = max(power > 0 ? 1.6 : 0.65, lv >= 2 ? 1.6 : lv == 1 ? 1.1 : 0)
        let verticalDamping = max(power > 0 ? 0.18 : 0.05, lv >= 1 ? 0.1 : 0)
        let fraction = min(power > 0 ? 0.55 : 1, lv >= 3 ? 0.42 : lv >= 2 ? 0.45 : lv == 1 ? 0.5 : 1)
        let gravity = Self.gravity[stage] * (stage < 2 ? min(1, world.gravity) : world.gravity) * fraction
        var ax = direction * 0.36 - vx * damping
        if lv >= 3 {
            ax = direction * 0.18 + (clamp((padX - x) * 1.4, -0.22, 0.22) - vx) * 2.2
        }
        vx += ax * dt
        vy += (gravity - (thrust ? 0.34 : 0) - vy * verticalDamping) * dt
        let cap = safeVy * 0.75
        cushions = lv >= 2 && ground - bottom < 0.2 && abs(x - padX) <= tolerance + 0.04 && vy > 0
        if cushions && vy > cap { vy -= (vy - cap) * min(1, dt * 8) }
        vx = clamp(vx, -0.45, 0.45)
        vy = clamp(vy, -0.48, 0.55)
        x += vx * dt
        y += vy * dt

        let edge = shipWidth / width / 2 + 0.012
        if x < edge { x = edge; vx = max(0, vx * -0.15) }
        else if x > 1 - edge { x = 1 - edge; vx = min(0, vx * -0.15) }
        if y < ceiling { y = ceiling; vy = max(0, vy) }
        for rock in rocks {
            if let contact = rockContact(rock) {
                guard lv >= 2 else { return retry("Go around the rock. Try again!") }
                nudge(rock, contact: contact)
            }
        }
        guard bottom >= ground else { return .none }
        let centered = abs(x - padX) <= tolerance
        guard centered, lv >= 3 || (abs(vx) <= safeVx && vy <= safeVy) else {
            return retry(centered ? "So close! Tap Engine to slow down" : "So close! Aim for the glow")
        }
        x = clamp(x, padX - onPad, padX + onPad)
        y = ground - shipHeight / 2 / height
        vx = 0; vy = 0; cushions = false; power = 0
        phase = .celebrating
        message = stage == 7 ? "Eight planets! What a trip!" : "You landed on \(world.name)!"
        return .touchdown
    }

    private func rockContact(_ rock: Rock) -> (x: Double, y: Double, distance: Double)? {
        let centerX = x * width, centerY = y * height
        let rockX = rock.x * width, rockY = rock.y * height
        let dx = clamp(rockX, centerX - shipWidth * 0.3, centerX + shipWidth * 0.3) - rockX
        let dy = clamp(rockY, centerY - shipHeight * 0.4, centerY + shipHeight * 0.42) - rockY
        let distance = hypot(dx, dy)
        return distance < rock.radius ? (dx, dy, distance) : nil
    }

    private mutating func nudge(_ rock: Rock, contact: (x: Double, y: Double, distance: Double)) {
        let (dx, dy, distance) = contact
        let nx = distance > 0.001 ? dx / distance : 0
        let ny = distance > 0.001 ? dy / distance : -1
        let offset = rock.radius - distance + 0.5
        x += nx * offset / width
        y += ny * offset / height
        var px = vx * width, py = vy * height
        let inward = px * nx + py * ny
        if inward < 0 { px -= inward * nx; py -= inward * ny }
        if ny < -0.5 {
            let side = padX >= rock.x ? 1.0 : -1.0
            if px * side < 30 { px = side * 30 }
        }
        vx = px / width; vy = py / height
    }

    private mutating func retry(_ reason: String) -> Event {
        misses += 1
        resetShip()
        message = ladder >= 3 ? "Tap Engine, then let go" : ladder == 2 ? "Nearly! Land by the arrow" : reason
        return .retry
    }

    private mutating func resetShip() {
        x = spawnX; y = ceiling + 16 / height; vx = 0; vy = 0
        phase = .ready; cushions = false
    }

    private func clamp(_ value: Double, _ lower: Double, _ upper: Double) -> Double {
        max(lower, min(upper, value))
    }
}
