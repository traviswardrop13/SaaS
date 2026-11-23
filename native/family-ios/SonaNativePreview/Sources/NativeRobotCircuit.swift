import Foundation

/// Robot Builder's rotate-and-test circuit (public/robot.js). A connected
/// wire is still just a wire until the player presses Test power.
struct NativeRobotCircuit {
    struct Tile {
        let wire: Int
        let correct: Int
        let inRoute: Bool
        fileprivate(set) var rotation: Int
        var mask: Int { NativeRobotCircuit.rotate(wire, rotation) }
        var correctMask: Int { NativeRobotCircuit.rotate(wire, correct) }
    }

    static let parts = ["leg-left", "leg-right", "torso", "arm-left", "arm-right", "head", "antenna", "heart"]
    static let partNames = ["left leg", "right leg", "body", "left arm", "right arm", "head", "antenna", "heart"]
    private static let lengths = [3, 4, 5, 5, 6, 7, 8, 9]
    private static let neighbors = [[1, 3], [0, 2, 4], [1, 5], [0, 4, 6], [1, 3, 5, 7],
                                    [2, 4, 8], [3, 7], [4, 6, 8], [5, 7]]
    private static let allRoutes: [[Int]] = {
        var routes: [[Int]] = []
        func walk(_ path: [Int]) {
            let tile = path.last!
            if tile % 3 == 2 { routes.append(path) }
            for next in neighbors[tile] where !path.contains(next) { walk(path + [next]) }
        }
        for start in [0, 3, 6] { walk([start]) }
        return routes
    }()

    let route: [Int]
    let little: Bool
    private(set) var tiles: [Tile]
    private(set) var powered: Set<Int> = []
    private(set) var misses = 0
    private(set) var rotations = 0
    private(set) var blueprint = 0.0
    private(set) var hint: Int?
    private(set) var solved = false
    private(set) var reported = false
    private(set) var message = "Join the wires, battery to bulb"
    private var clock = 0.0
    private var lastTap = -99.0
    private var idleSince = 0.0
    private var work = 0.0
    private var doneAt = 0.0

    init(part: Int, count: Int, little: Bool, previousRoute: [Int]) {
        self.little = little
        let index = min(7, Int((Double(part) * 7 / Double(max(1, count - 1))).rounded()))
        let candidates = Self.allRoutes.filter { $0.count == Self.lengths[index] }
        let fresh = candidates.filter { $0 != previousRoute }
        let path = (fresh.isEmpty ? candidates : fresh).randomElement()!
        route = path
        tiles = (0..<9).map { tile in
            let position = path.firstIndex(of: tile)
            let mask: Int
            if let position {
                let incoming = position == 0 ? 8 : Self.direction(from: tile, to: path[position - 1])
                let outgoing = position == path.count - 1 ? 2 : Self.direction(from: tile, to: path[position + 1])
                mask = incoming | outgoing
            } else {
                mask = Self.rotate(Bool.random() ? 3 : 5, Int.random(in: 0...3))
            }
            let wire = mask == 5 || mask == 10 ? 5 : 3
            let correct = (0...3).first { Self.rotate(wire, $0) == mask }!
            let wrong = wire == 5 ? (Bool.random() ? 1 : 3) : Int.random(in: 1...3)
            return Tile(wire: wire, correct: correct, inRoute: position != nil, rotation: (correct + wrong) % 4)
        }
        let battery = path[0]
        while tiles[battery].mask & 8 != 0 { tiles[battery].rotation = (tiles[battery].rotation + 1) % 4 }
        updatePower()
    }

    var sourceRow: Int { route[0] / 3 }
    var socketRow: Int { route.last! / 3 }
    var connected: Bool { powered.contains(socketRow * 3 + 2) && tiles[socketRow * 3 + 2].mask & 2 != 0 }
    var assistance: Int {
        let timeLevel = work >= 20 ? 3 : work >= 12 ? 2 : work >= 6 ? 1 : 0
        let base = min(3, max(misses, timeLevel))
        return little && base > 0 ? min(3, base + 1) : base
    }
    var showsGuide: Bool { blueprint > 0 || assistance >= 2 }

    mutating func turn(_ index: Int) {
        guard !solved, tiles.indices.contains(index) else { return }
        let tile = tiles[index]
        if assistance >= 3 && tile.inRoute && tile.mask != tile.correctMask {
            tiles[index].rotation = tile.correct
        } else { tiles[index].rotation = (tile.rotation + 1) % 4 }
        rotations += 1
        lastTap = clock; idleSince = clock
        updatePower()
        if hint != nil || assistance > 0 { updateHint() }
        message = connected ? "It’s connected! Press Test power" : "Join the wires, battery to bulb"
    }

    mutating func testPower(part: Int) -> Bool {
        guard !solved else { return false }
        idleSince = clock
        if !connected {
            misses += 1
            updateHint()
            message = misses >= 3 ? "Nearly! Tap the glowing wire" : misses == 2
                ? "So close! Match the pale lines" : "So close! Try this wire"
            return false
        }
        solved = true
        hint = nil
        blueprint = 0
        message = "The \(Self.partNames[part]) is ready!"
        doneAt = clock + 1.15
        return true
    }

    mutating func showBlueprint() {
        guard !solved else { return }
        blueprint = 10
        message = "Blueprint! Turn the wires to match"
    }

    mutating func step(seconds: Double, active: Bool) -> Bool {
        guard active, !reported, seconds.isFinite, seconds > 0 else { return false }
        let dt = min(0.1, seconds)
        clock += dt
        if solved {
            if clock >= doneAt { reported = true; return true }
            return false
        }
        let before = assistance
        blueprint = max(0, blueprint - dt)
        if !connected && clock - lastTap < 2.5 { work += dt }
        if assistance > before || (!connected && hint == nil && clock - idleSince >= 8) { updateHint() }
        return false
    }

    private mutating func updateHint() {
        hint = connected ? nil : route.first { tiles[$0].mask != tiles[$0].correctMask }
    }

    private mutating func updatePower() {
        let start = sourceRow * 3
        powered = []
        guard tiles[start].mask & 8 != 0 else { return }
        var queue = [start]
        powered.insert(start)
        var head = 0
        while head < queue.count {
            let tile = queue[head]
            head += 1
            for next in Self.neighbors[tile] {
                let toward = Self.direction(from: tile, to: next)
                let back = Self.direction(from: next, to: tile)
                if tiles[tile].mask & toward != 0 && tiles[next].mask & back != 0 && powered.insert(next).inserted {
                    queue.append(next)
                }
            }
        }
    }

    private static func direction(from: Int, to: Int) -> Int {
        switch to - from {
        case -3: return 1
        case 1: return 2
        case 3: return 4
        default: return 8
        }
    }
    private static func rotate(_ mask: Int, _ count: Int) -> Int {
        let turns = count & 3
        return ((mask << turns) | (mask >> (4 - turns))) & 15
    }
}
