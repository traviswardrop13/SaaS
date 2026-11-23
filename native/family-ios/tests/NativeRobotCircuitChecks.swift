import Foundation

@main enum NativeRobotCircuitChecks {
    static func main() {
        let lengths = [3, 4, 5, 5, 6, 7, 8, 9]
        var previous: [Int] = []
        for part in lengths.indices {
            var circuit = NativeRobotCircuit(part: part, count: 8, little: false, previousRoute: previous)
            precondition(circuit.route.count == lengths[part] && circuit.route != previous)
            precondition(!circuit.connected && circuit.hint == nil && circuit.blueprint == 0)
            precondition(circuit.route.allSatisfy { circuit.tiles[$0].mask != circuit.tiles[$0].correctMask })
            precondition(!circuit.testPower(part: part) && circuit.assistance == 1 && circuit.hint != nil)
            precondition(!circuit.testPower(part: part) && circuit.showsGuide)
            precondition(!circuit.testPower(part: part) && circuit.assistance == 3)
            for tile in circuit.route where circuit.tiles[tile].mask != circuit.tiles[tile].correctMask {
                circuit.turn(tile)
                precondition(circuit.tiles[tile].mask == circuit.tiles[tile].correctMask)
            }
            precondition(circuit.connected && !circuit.solved, "Powering the wires never tests or awards a part")
            precondition(circuit.testPower(part: part) && circuit.solved)
            for _ in 0..<20 {
                precondition(!circuit.step(seconds: 0.1, active: false), "Paused celebrations cannot advance a word")
            }
            for _ in 0..<11 { precondition(!circuit.step(seconds: 0.1, active: true)) }
            precondition(circuit.step(seconds: 0.1, active: true))
            precondition(!circuit.step(seconds: 0.1, active: true), "Each tested part advances once")
            previous = circuit.route
        }
        var small = NativeRobotCircuit(part: 0, count: 8, little: true, previousRoute: [])
        for _ in 0..<100 { _ = small.step(seconds: 0.1, active: true) }
        precondition(small.assistance == 0 && small.hint != nil, "Idle time can point but cannot earn a ladder step")
        small.showBlueprint()
        for _ in 0..<20 { _ = small.step(seconds: 0.1, active: false) }
        precondition(small.blueprint == 10)
        precondition(!small.testPower(part: 0) && small.assistance == 2, "The little ladder has a blueprint after one test")
        print("Robot Builder checks passed for eight routes, manual testing and active-time assistance")
    }
}
