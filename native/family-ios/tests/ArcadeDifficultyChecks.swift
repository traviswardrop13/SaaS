import Foundation

@main enum ArcadeDifficultyChecks {
    static func main() {
        let levels = [1, 2, 3]
        let data: [[String: Any]] = levels.map { level in
            let stages = [0, 1, 2]
            return [
                "songs": NativeArcadeDifficulty.songs(level: level).map { [
                    "name": $0.title, "notes": $0.melody, "beat": Int(($0.beat * 1000).rounded()), "fall": $0.fall,
                    "finale": $0.finale
                ] as [String: Any] },
                "slice": stages.map {
                    let wave = NativeArcadeDifficulty.sliceWave(level: level, stage: $0)
                    return ["goal": wave.goal, "every": Int((wave.tossInterval * 1000).rounded()),
                            "most": wave.maximumPerToss, "gold": wave.goldChance] as [String: Any]
                },
                "giantCuts": NativeArcadeDifficulty.watermelonCuts(level: level),
                "fruitScale": NativeArcadeDifficulty.fruitSize(level: level),
                "stack": stages.map { ["goal": NativeArcadeDifficulty.stackGoal(level: level, stage: $0),
                                       "speed": NativeArcadeDifficulty.stackSpeed(level: level, stage: $0)] as [String: Any] },
                "glide": stages.map { ["goal": NativeArcadeDifficulty.glideGoal(level: level, stage: $0)] },
                "glideShrink": stages.map { NativeArcadeDifficulty.glideShrink(level: level, stage: $0) },
                "glideEvery": Int((NativeArcadeDifficulty.glideSpacing(level: level) * 1000).rounded()),
                "glideSpeed": NativeArcadeDifficulty.glideSpeed(level: level),
                "run": stages.map { NativeArcadeDifficulty.sprintSpeed(level: level, stage: $0) },
                "bubbles": (0..<5).map { NativeArcadeDifficulty.bubbleCount(level: level, wave: $0) }
            ]
        }
        let bytes = try! JSONSerialization.data(withJSONObject: data, options: [.sortedKeys])
        print(String(decoding: bytes, as: UTF8.self))
    }
}
