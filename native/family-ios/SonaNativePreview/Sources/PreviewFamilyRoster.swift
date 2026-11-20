import SwiftUI

struct PreviewPlayer: Codable, Identifiable {
    let id: String
    let number: Int
    var buddy: PreviewBuddy = .echo
    var targetSound = ""
    var completedGames: Set<String> = []
    var bookmarks: [String: BookBookmark] = [:]
    var adventureStart: Date?

    var label: String { "Player \(number)" }
}

/// Preview players have local reading and gameplay records. They do not
/// represent server caseload children or receive a server child ID.
struct PreviewFamilyRoster: Codable {
    private(set) var players: [PreviewPlayer]
    private(set) var activeID: String

    init(primary: PreviewPlayer) {
        players = [primary]
        activeID = primary.id
    }

    subscript(id: String) -> PreviewPlayer? {
        players.first { $0.id == id }
    }

    mutating func update(_ player: PreviewPlayer) {
        guard let index = players.firstIndex(where: { $0.id == player.id }) else { return }
        players[index] = player
    }

    mutating func select(_ id: String) {
        guard self[id] != nil else { return }
        activeID = id
    }

    mutating func addPlayer() {
        let number = (players.map(\.number).max() ?? 0) + 1
        let player = PreviewPlayer(id: UUID().uuidString, number: number, adventureStart: Date())
        players.append(player)
        activeID = player.id
    }
}

struct PreviewPlayersView: View {
    let players: [PreviewPlayer]
    let activeID: String
    let onSelect: (String) -> Void
    let onAdd: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            Section {
                ForEach(players) { player in
                    Button {
                        onSelect(player.id)
                        dismiss()
                    } label: {
                        HStack(spacing: 12) {
                            Image(player.buddy.asset)
                                .resizable()
                                .scaledToFit()
                                .frame(width: 42, height: 42)
                                .accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(player.label).font(.headline)
                                if !player.targetSound.isEmpty {
                                    Text("Practice sound • \(player.targetSound == "THV" ? "TH (voiced)" : player.targetSound)")
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            if activeID == player.id {
                                Image(systemName: "checkmark.circle.fill")
                                    .accessibilityLabel("Current player")
                            }
                        }
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("preview-player-\(player.number)")
                }
            } footer: {
                Text("Each player keeps a separate buddy, sound, book position, and list of games finished on this phone.")
            }
            Section {
                Button {
                    onAdd()
                    dismiss()
                } label: {
                    Label("Add a player", systemImage: "plus.circle.fill")
                        .frame(minHeight: 44)
                }
                .accessibilityIdentifier("preview-add-player")
            }
        }
        .navigationTitle("Players")
    }
}
