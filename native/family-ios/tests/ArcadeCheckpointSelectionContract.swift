import Foundation

@main struct ArcadeCheckpointSelectionContract {
    static func main() throws {
        let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
        let selections = try JSONDecoder().decode([NativeArcadeCheckpointSelection].self, from: data)
        var failures = 0, checks = 0
        func check(_ value: Bool, _ label: String) {
            checks += 1
            if !value { failures += 1; print("FAIL: " + label) }
        }
        check(selections.count == 18 && selections.allSatisfy(\.isSupported), "all six source games and three original card contexts decode")
        for selection in selections {
            check(selection.ask(afterPreparedModel: nil, played: false) == selection.bare,
                  "an unavailable model cannot paint a harder target")
            if selection.desired.requiresPreparedModel {
                check(selection.ask(afterPreparedModel: selection.desired.modelText, played: false) == selection.bare,
                      "downloaded bytes without successful playback are insufficient")
                check(selection.ask(afterPreparedModel: "A different model", played: true) == selection.bare,
                      "another cached line cannot unlock this target")
                check(selection.ask(afterPreparedModel: selection.desired.modelText, played: true) == selection.desired,
                      "the exact prepared and played model permits its original target")
            } else {
                check(selection.desired == selection.bare, "five games and every life card keep the recorded bare sound")
            }
        }
        let request = NativeArcadeCheckpointSelection.Request(game: "slice", sound: "R", card: 1,
            boostLevel: "word", boostAsk: "rabbit", boostPosition: "i")
        let fields = try JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as! [String: Any]
        check(fields["sound"] as? String == "R" && fields["boostAsk"] as? String == "rabbit", "host request carries the charge sound and item without reselecting")
        if let first = selections.first(where: { $0.gameID == "slice" && $0.card == 1 }),
           let second = selections.first(where: { $0.gameID == "slice" && $0.card == 2 }) {
            check(second.title(for: first.desired) == "Say “rabbit” for wave 3!", "a held target retains the new card's original wave title")
        } else { check(false, "both source Slice checkpoint cards are available") }
        print("Checkpoint selection: \(checks) checks, \(failures) failures")
        exit(failures == 0 ? 0 : 1)
    }
}
