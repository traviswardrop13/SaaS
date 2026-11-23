import Foundation
import CoreGraphics

// These visual recipes are ported from the two onboarding-only canvas
// controllers, not from the games. Their constants and painted crops are the
// current authored demos; no gesture can create a saying, score or reward.
struct NativeSetupFruitScene {
    struct Kind {
        let name: String, color: UInt32
        let crop: CGRect
    }
    static let kinds = [
        Kind(name: "apple", color: 0xef5b48, crop: CGRect(x: 40, y: 33, width: 305, height: 319)),
        Kind(name: "orange", color: 0xffb72f, crop: CGRect(x: 38, y: 33, width: 315, height: 330)),
        Kind(name: "watermelon", color: 0xff6573, crop: CGRect(x: 13, y: 43, width: 360, height: 305)),
        Kind(name: "grapes", color: 0xab70dc, crop: CGRect(x: 38, y: 16, width: 321, height: 356)),
        Kind(name: "lemon", color: 0xffd85a, crop: CGRect(x: 49, y: 32, width: 325, height: 321))
    ]
    struct Fruit {
        let kind: Int
        var x, y, vx, vy, gravity, size, age, angle, spin, sliceAt: Double
        var side = 0
    }
    struct Drop { var x, y, vx, vy, radius, age, life: Double; let color: UInt32 }
    struct Swipe { let from, to: CGPoint; var age: Double; let life: Double }
    private(set) var fruits: [Fruit] = [], halves: [Fruit] = []
    private(set) var drops: [Drop] = [], swipes: [Swipe] = []
    private(set) var time = 0.0
    private var nextFruit = 0.0, serial = 0

    mutating func still(size: CGSize) {
        let w = Double(size.width), h = Double(size.height), s = max(40, min(68, w * 0.175))
        func fruit(_ kind: Int, _ x: Double, _ y: Double, _ size: Double, _ angle: Double, side: Int = 0) -> Fruit {
            Fruit(kind: kind, x: x, y: y, vx: 0, vy: 0, gravity: 0, size: size,
                  age: 0, angle: angle, spin: 0, sliceAt: 10, side: side)
        }
        fruits = [fruit(1, w * 0.27, h * 0.69, s, -0.22), fruit(2, w * 0.72, max(125, h * 0.50), s * 1.08, 0.22)]
        halves = []
        for side in [-1, 1] {
            let direction = Double(side)
            let x = w * 0.46 + direction * s * 0.18
            let y = max(145, h * 0.61) - direction * 7
            halves.append(fruit(0, x, y, s, direction * 0.18, side: side))
        }
        drops = []
        swipes = [.init(from: CGPoint(x: w * 0.27, y: h * 0.69), to: CGPoint(x: w * 0.66, y: max(125, h * 0.51)), age: 0, life: 1)]
    }
    mutating func advance(_ seconds: Double, slow: Bool, size: CGSize) {
        let dt = max(0, min(0.035, seconds)) * (slow ? 0.45 : 1)
        let w = Double(size.width), h = Double(size.height)
        time += dt
        if time >= nextFruit {
            let n = serial; serial += 1
            let s = max(40, min(68, w * 0.175)), top = min(h * 0.40, max(110, h * 0.36))
            let rise = max(80, h + s - top), total = 1.32
            fruits.append(.init(kind: n % 5, x: w * [0.28, 0.67, 0.44, 0.76, 0.24][n % 5], y: h + s * 0.55,
                vx: w * [0.16, -0.17, 0.11, -0.23, 0.19][n % 5], vy: -4 * rise / total,
                gravity: 8 * rise / (total * total), size: s, age: 0, angle: Double(n % 3 - 1) * 0.25,
                spin: (n % 2 == 1 ? -1 : 1) * 1.6, sliceAt: 0.60 + Double(n % 3) * 0.045))
            nextFruit = time + [0.38, 0.31, 0.49, 0.34][serial % 4]
        }
        var remaining: [Fruit] = []
        for var fruit in fruits {
            fruit.age += dt; fruit.vy += fruit.gravity * dt
            fruit.x += fruit.vx * dt; fruit.y += fruit.vy * dt; fruit.angle += fruit.spin * dt
            if fruit.age >= fruit.sliceAt { slice(fruit) }
            else if fruit.age < 1.6 { remaining.append(fruit) }
        }
        fruits = remaining
        for index in halves.indices {
            halves[index].age += dt; halves[index].x += halves[index].vx * dt
            halves[index].vy += halves[index].gravity * dt
            halves[index].y += halves[index].vy * dt; halves[index].angle += halves[index].spin * dt
        }
        halves.removeAll { $0.age >= 0.8 || $0.y >= h + $0.size }
        for index in drops.indices {
            drops[index].age += dt; drops[index].x += drops[index].vx * dt
            drops[index].vy += 280 * dt; drops[index].y += drops[index].vy * dt
        }
        drops.removeAll { $0.age >= $0.life }
        for index in swipes.indices { swipes[index].age += dt }
        swipes.removeAll { $0.age >= $0.life }
    }
    mutating func swipe(from: CGPoint, to: CGPoint) {
        let dx = Double(to.x - from.x), dy = Double(to.y - from.y), length = dx * dx + dy * dy
        guard length >= 4 else { return }
        var keep: [Fruit] = []
        for fruit in fruits {
            let t = max(0, min(1, ((fruit.x - from.x) * dx + (fruit.y - from.y) * dy) / length))
            if hypot(fruit.x - from.x - t * dx, fruit.y - from.y - t * dy) < fruit.size * 0.55 { slice(fruit, from: from, to: to) }
            else { keep.append(fruit) }
        }
        fruits = keep
        swipes.append(.init(from: from, to: to, age: 0, life: 0.13))
    }
    private mutating func slice(_ fruit: Fruit, from: CGPoint? = nil, to: CGPoint? = nil) {
        swipes.append(.init(from: from ?? CGPoint(x: fruit.x - fruit.size * 1.1, y: fruit.y + fruit.size * 0.55),
                           to: to ?? CGPoint(x: fruit.x + fruit.size * 1.1, y: fruit.y - fruit.size * 0.55), age: 0, life: 0.19))
        for side in [-1, 1] {
            var half = fruit; half.x += Double(side) * 5; half.vx += Double(side) * 88
            half.vy = -78 + Double(side) * 18; half.spin = Double(side) * 3.2
            half.gravity *= 0.65; half.side = side; half.age = 0
            halves.append(half)
        }
        for i in 0..<10 {
            let angle = Double(i) * .pi * 2 / 10, speed = Double(42 + i % 4 * 21)
            drops.append(.init(x: fruit.x, y: fruit.y, vx: cos(angle) * speed, vy: sin(angle) * speed - 22,
                               radius: Double(2 + i % 3), age: 0, life: 0.45 + Double(i % 3) * 0.06,
                               color: Self.kinds[fruit.kind].color))
        }
    }
}

struct NativeSetupPianoScene {
    struct Note { let lane: Int, born: Double }
    struct Spark { var x, y, vx, vy, life: Double; let color: UInt32 }
    static let pattern = [0, 2, 1, 3, 2, 0, 3, 1, 0, 3, 2, 1]
    static let colors: [UInt32] = [0xee8a9a, 0xbfa3e2, 0xa9df8b, 0x86d9ef]
    private(set) var notes: [Note] = [], sparks: [Spark] = []
    private(set) var flashes = [0.0, 0, 0, 0], songTime = 0.79
    private var nextNote = 0.0, index = 0
    static func top(_ size: CGSize) -> Double { min(92, size.height * 0.3) }
    static func hitY(_ size: CGSize) -> Double { size.height - min(62, max(47, size.height * 0.17)) }
    mutating func hit(lane: Int, size: CGSize, reducedMotion: Bool) {
        guard (0..<4).contains(lane) else { return }
        flashes[lane] = 1
        guard !reducedMotion else { return }
        for i in 0..<7 {
            let angle = -.pi * (0.15 + Double(i) * 0.115)
            sparks.append(.init(x: (Double(lane) + 0.5) * size.width / 4, y: Self.hitY(size) + 2,
                vx: cos(angle) * Double(28 + i % 3 * 16), vy: sin(angle) * Double(64 + i % 2 * 25), life: 0.5,
                color: i % 2 == 1 ? 0xfff4ac : Self.colors[lane]))
        }
    }
    mutating func advance(_ seconds: Double, slow: Bool, size: CGSize) {
        let dt = max(0, min(0.05, seconds))
        songTime += dt * (slow ? 1.05 / 2.65 : 1)
        while songTime >= nextNote {
            notes.append(.init(lane: Self.pattern[index % Self.pattern.count], born: nextNote))
            index += 1; nextNote += 0.36
        }
        var keep: [Note] = []
        for note in notes {
            if songTime - note.born < 1.05 { keep.append(note) }
            else { hit(lane: note.lane, size: size, reducedMotion: false) }
        }
        notes = keep
        for lane in 0..<4 { flashes[lane] = max(0, flashes[lane] - dt * 3.3) }
        for i in sparks.indices {
            sparks[i].life -= dt; sparks[i].x += sparks[i].vx * dt
            sparks[i].y += sparks[i].vy * dt; sparks[i].vy += dt * 125
        }
        sparks.removeAll { $0.life <= 0 }
    }
    mutating func clearSparks() { sparks = [] }
}

struct NativeSetupDemoSession {
    let kind: NativeSetupDemoKind
    private(set) var clock = NativeSetupDemoClock()
    private(set) var size = CGSize(width: 320, height: 320)
    private(set) var fruit = NativeSetupFruitScene(), piano = NativeSetupPianoScene()
    private var lastFrame: Double?

    mutating func appear(now: Double, foreground: Bool, reducedMotion: Bool) {
        clock.appear(now: now, foreground: foreground, reducedMotion: reducedMotion)
        resetScene()
    }
    mutating func reconfigure(kind: NativeSetupDemoKind, now: Double, foreground: Bool, reducedMotion: Bool) {
        let currentSize = size
        self = NativeSetupDemoSession(kind: kind)
        resize(currentSize)
        appear(now: now, foreground: foreground, reducedMotion: reducedMotion)
    }
    mutating func disappear() { clock.disappear(); resetScene() }
    mutating func foreground(_ value: Bool, now: Double) {
        clock.setForeground(value, now: now); resetScene()
    }
    mutating func reducedMotion(_ value: Bool, now: Double) {
        clock.setReducedMotion(value, now: now); lastFrame = nil
        if value { fruit.still(size: size); piano.clearSparks() }
        else { fruit = .init() }
    }
    mutating func resize(_ value: CGSize) {
        guard value.width > 0, value.height > 0 else { return }
        size = value
        if clock.reducedMotion { fruit.still(size: size) }
    }
    mutating func select(_ value: NativeSetupDemoPhase, now: Double) { clock.select(value, now: now) }
    mutating func advance(now: Double) {
        guard clock.isAnimating, now.isFinite else { lastFrame = nil; return }
        clock.advance(now: now)
        let dt = lastFrame.map { max(0, now - $0) } ?? 0
        lastFrame = now
        if kind == .fruit { fruit.advance(dt, slow: clock.phase == .afterPractice, size: size) }
        else { piano.advance(dt, slow: clock.phase == .afterPractice, size: size) }
    }
    mutating func swipe(from: CGPoint, to: CGPoint) {
        guard clock.isAnimating, kind == .fruit else { return }
        fruit.swipe(from: from, to: to)
    }
    mutating func tap(_ point: CGPoint) {
        guard clock.mounted, clock.foreground, kind == .piano, point.y >= NativeSetupPianoScene.hitY(size) - 8 else { return }
        piano.hit(lane: min(3, max(0, Int(point.x / (size.width / 4)))), size: size, reducedMotion: clock.reducedMotion)
    }
    private mutating func resetScene() {
        lastFrame = nil; fruit = .init(); piano = .init()
        if clock.mounted && clock.foreground && clock.reducedMotion { fruit.still(size: size) }
    }
}
