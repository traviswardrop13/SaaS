import Foundation
import SonaSpeechCore

/// A canonical SayPlay word supplied by the original rules. This type never
/// picks words, changes their order, or treats a finger move as a saying.
struct GameSpeechGatePlan {
    let id: UUID
    let gameID: String
    let sound: String
    let word: String
    let position: String
    let sayTimes: Int
    let intro: String?
    let emoji: String?
    let voiceID: String
    let volume: Float
    let voiceOn: Bool

    init(id: UUID = UUID(), gameID: String, sound: String, word: String,
         position: String = "", sayTimes: Int, intro: String? = nil,
         emoji: String? = nil, voiceID: String = "", volume: Float = 0.8,
         voiceOn: Bool = true) {
        self.id = id; self.gameID = gameID; self.sound = sound; self.word = word
        self.position = position; self.sayTimes = sayTimes; self.intro = intro
        self.emoji = emoji; self.voiceID = voiceID; self.volume = volume
        self.voiceOn = voiceOn
    }

    var isSupported: Bool {
        [1, 2, 3].contains(sayTimes) && !gameID.isEmpty && !word.isEmpty
            && word.utf16.count <= 100 && (intro?.utf16.count ?? 0) <= 200
            && ["P", "B", "M", "N", "T", "D", "K", "G", "F", "V", "S", "Z", "SH", "CH", "J", "L", "R", "TH", "THV"].contains(sound)
    }
}

/// The host must atomically deduplicate (gateID, sequence), then call only the
/// original gameRep(sound). Never feed this into charge's practice ledger.
struct GameSayingCredit: Equatable {
    let gateID: UUID
    let sequence: Int
    let gameID: String
    let sound: String
    let word: String
    let position: String
}

@MainActor protocol GameSpeechPromptProviding {
    func prepare(plan: GameSpeechGatePlan, includeIntro: Bool) async throws -> [PracticePrompt]
}

/// One SayPlay round's room number only. Its model/microphone owner and every
/// saying count remain local to the current gate; no audio crosses gates.
@MainActor final class GameSpeechAcousticCarry {
    private(set) var roomFloor: Double?
    func observeFloor(_ value: Double?) {
        guard let value, value.isFinite, value >= 0 else { return }
        roomFloor = min(roomFloor ?? value, value)
    }
}
