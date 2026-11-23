import Foundation
struct RecordedNativeTreasure {
 var turn=0,next=1,calm=0,completions=0
    private let maps = [
        [CGPoint(x: 0.15, y: 0.7), CGPoint(x: 0.38, y: 0.47), CGPoint(x: 0.65, y: 0.64), CGPoint(x: 0.82, y: 0.24)],
        [CGPoint(x: 0.20, y: 0.28), CGPoint(x: 0.70, y: 0.22), CGPoint(x: 0.72, y: 0.68), CGPoint(x: 0.29, y: 0.76)],
        [CGPoint(x: 0.15, y: 0.75), CGPoint(x: 0.41, y: 0.27), CGPoint(x: 0.59, y: 0.64), CGPoint(x: 0.85, y: 0.24)]
    ]
    mutating func sail() {
        if next < maps[turn % maps.count].count - 1 {
            next += 1
        } else {
            next = 1
            calm = 0
            advance()
        }
    }
 mutating func advance(){ completions += 1 }
}
@main struct Check { static func main(){ var game=RecordedNativeTreasure();for _ in 0..<3 { game.sail() };if game.completions != 0 { print("FAIL: three target touch updates with zero sailing time completed \(game.completions) move; expected zero");exit(1) };print("PASS") } }
