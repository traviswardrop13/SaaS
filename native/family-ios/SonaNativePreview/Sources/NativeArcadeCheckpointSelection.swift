import Foundation

/// Authored card content from the original six charge-start pages. Selection
/// grants no move/rep and never chooses a sound after the charge sound rotated.
struct NativeArcadeCheckpointSelection: Decodable {
    struct Request: Encodable {
        let game: String
        let sound: String
        let card: Int
        let boostLevel: String?
        let boostAsk: String?
        let boostPosition: String?
        init(game: String, sound: String, card: Int, boostLevel: String? = nil,
             boostAsk: String? = nil, boostPosition: String? = nil) {
            self.game = game; self.sound = sound; self.card = card
            self.boostLevel = boostLevel; self.boostAsk = boostAsk; self.boostPosition = boostPosition
        }
    }
    struct Ask: Decodable, Equatable {
        let rung: Int
        let level, text, position, markedHTML, clip, modelText, title: String
        var requiresPreparedModel: Bool { rung > 0 }
    }
    let gameID, sound, family, voiceID: String
    let card: Int
    let voiceOn, humanClipsEnabled: Bool
    let volume: Float
    let intro, stepBackLine, goText: String
    let desired, bare: Ask
    let modelWaitMilliseconds, voiceTailMilliseconds, bareLineWaitMilliseconds, takeStartMilliseconds: Double

    var isSupported: Bool {
        ["slice", "tiles", "stack", "run", "glide", "rise"].contains(gameID)
            && [0, 1, 2].contains(card) && !sound.isEmpty && volume.isFinite && (0...1).contains(volume)
            && bare.rung == 0 && bare.level == "isolation" && !bare.text.isEmpty
            && bare.clip == "/coach/say-echo/" + sound + "-sound.wav" && bare.modelText.isEmpty
            && (0...2).contains(desired.rung) && !desired.text.isEmpty
            && desired.level == ["isolation", "syllable", "word"][desired.rung]
            && (desired.rung == 0 ? desired == bare : gameID == "slice" && desired.clip.isEmpty && !desired.modelText.isEmpty)
            && modelWaitMilliseconds > 0 && voiceTailMilliseconds > 0 && takeStartMilliseconds > 0
    }

    /// A harder card must stay hidden until this exact model has played from
    /// real bytes. A system-voice substitute or a failed playback is not enough.
    func ask(afterPreparedModel text: String?, played: Bool) -> Ask {
        desired.requiresPreparedModel && (!played || text != desired.modelText) ? bare : desired
    }

    /// Source askHeld retains the target, while paintAsk uses this card's new
    /// tail (for example wave 3). Do not retain an earlier card's title.
    func title(for ask: Ask) -> String {
        bare.title.replacingOccurrences(of: "“" + bare.text + "”", with: "“" + ask.text + "”")
    }
}
