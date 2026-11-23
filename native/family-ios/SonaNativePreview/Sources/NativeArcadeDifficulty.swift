import Foundation

/// The shipped LEVELS1 finger-play settings. Word counts, clinical practice,
/// prompts, lives and access are owned by their existing routes.
enum NativeArcadeDifficulty {
    struct Song: Equatable {
        let title, melody: String
        let beat, fall: TimeInterval
        let finale: Bool
        var notes: [Int] { melody.compactMap { Self.pitches.firstIndex(of: $0) } }
        private static let pitches = Array("CDEFGAB")

        init(_ title: String, _ melody: String, _ beatMS: Int, _ fall: TimeInterval, finale: Bool = false) {
            self.title = title; self.melody = melody; beat = Double(beatMS) / 1000
            self.fall = fall; self.finale = finale
        }
    }

    struct Wave: Equatable {
        let goal: Int
        let tossInterval: TimeInterval
        let maximumPerToss: Int
        let goldChance: Double
        init(_ goal: Int, _ interval: TimeInterval, _ maximum: Int, _ goldChance: Double) {
            self.goal = goal; tossInterval = interval; maximumPerToss = maximum; self.goldChance = goldChance
        }
    }

    static func normalized(_ level: Int) -> Int { (1...3).contains(level) ? level : 1 }
    private static func index(_ level: Int) -> Int { normalized(level) - 1 }

    static func songs(level: Int) -> [Song] {
        tilesSongs[index(level)]
    }

    private static let tilesSongs: [[Song]] = [
        [
            .init("Twinkle Twinkle", "CCGGAAG FFEEDDC", 760, 2.5),
            .init("Mary Had a Little Lamb", "EDCDEEE DDD EGG", 700, 2.3),
            .init("Row, Row, Row Your Boat", "CCCDE EDEFG", 660, 2.1),
            .init("Ode to Joy", "EEFGGFED CCDEEDD", 620, 2.2, finale: true)
        ], [
            .init("Hot Cross Buns", "EDC EDC CCCCDDDD EDC", 700, 2.3),
            .init("Old MacDonald", "CCCGAAG EEDDC", 660, 2.2),
            .init("London Bridge", "GAGFEFG DEF EFG", 640, 2.1),
            .init("Au Clair de la Lune", "CCCDED CEDDC", 600, 2.1, finale: true)
        ], [
            .init("Are You Sleeping", "CDEC CDEC EFG EFG", 640, 2.1),
            .init("This Old Man", "GEG GEG AGFEDEF", 620, 2.0),
            .init("Lightly Row", "GEE FDD CDEFGGG", 600, 1.95),
            .init("Itsy Bitsy Spider", "CFFFGAA AGFGAF", 580, 2.0, finale: true)
        ]
    ]

    static func sliceWave(level: Int, stage: Int) -> Wave { sliceWaves[index(level)][stage] }
    static func watermelonCuts(level: Int) -> Int { 5 + index(level) }
    static func fruitSize(level: Int) -> Double { [1, 1, 0.85][index(level)] }

    private static let sliceWaves: [[Wave]] = [
        [.init(6, 1.9, 1, 0), .init(8, 1.7, 2, 0.12), .init(10, 1.5, 3, 0.16)],
        [.init(7, 1.75, 2, 0.08), .init(9, 1.55, 2, 0.14), .init(11, 1.4, 3, 0.18)],
        [.init(8, 1.6, 2, 0.10), .init(10, 1.45, 3, 0.16), .init(12, 1.3, 4, 0.20)]
    ]

    static func stackGoal(level: Int, stage: Int) -> Int { 5 + stage + index(level) }
    static func stackSpeed(level: Int, stage: Int) -> Double { [0.85, 1.1, 1.35][stage] + Double(index(level)) * 0.1 }
    static func sprintSpeed(level: Int, stage: Int) -> Double { [1, 1.15, 1.3][stage] + Double(index(level)) * 0.1 }

    static func glideGoal(level: Int, stage: Int) -> Int { 6 + stage + index(level) }
    static func glideSpacing(level: Int) -> TimeInterval { [2.9, 2.7, 2.5][index(level)] }
    static func glideSpeed(level: Int) -> Double { [1, 1.1, 1.2][index(level)] }
    static func glideShrink(level: Int, stage: Int) -> Double { [0, 0.06, 0.12][stage] + Double(index(level)) * 0.04 }

    static func bubbleCount(level: Int, wave: Int) -> Int {
        index(level) == 0 ? [6, 7, 7, 8, 8][min(max(wave, 0), 4)] : 8
    }
}
