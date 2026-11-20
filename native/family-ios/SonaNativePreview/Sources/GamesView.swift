import SwiftUI

enum NativeGame: String, CaseIterable, Identifiable {
    case slice, bubbles, peekaboo, tiles, stack, sprint, glide, rise, hoops, soccer, dino

    var id: String { rawValue }
    var cover: String { "game-\(rawValue)" }

    var title: String {
        switch self {
        case .slice: "Fruit Slice"
        case .bubbles: "Bubble Pop"
        case .peekaboo: "Peekaboo"
        case .tiles: "Piano Tiles"
        case .stack: "Block Stacker"
        case .sprint: "Sound Sprint"
        case .glide: "Flappy Glide"
        case .rise: "Rise Up"
        case .hoops: "Hoops"
        case .soccer: "Soccer Goal"
        case .dino: "Dino Dig"
        }
    }

    var instruction: String {
        switch self {
        case .slice: "Swipe through the fruit."
        case .bubbles: "Pop the bubbles."
        case .peekaboo: "Find the picture behind its door."
        case .tiles: "Tap each bright key to play a song."
        case .stack: "Drop the blocks to build a tower."
        case .sprint: "Switch lanes to catch stars."
        case .glide: "Tap to fly through the gaps."
        case .rise: "Drag the shield to protect your balloon."
        case .hoops: "Swipe the ball toward the hoop."
        case .soccer: "Swipe past the keeper to score."
        case .dino: "Brush away the sand to find bones."
        }
    }

    var gentle: Bool {
        self == .bubbles || self == .peekaboo || self == .dino || self == .tiles
    }
}

struct GamesView: View {
    let completed: Set<String>
    let access: FamilyLibraryAccess
    let onPlay: (NativeGame) -> Void

    @State private var quietGames = false
    @Environment(\.dynamicTypeSize) private var typeSize

    private var games: [NativeGame] {
        NativeGame.allCases.filter { !quietGames || $0.gentle }
    }

    private var columns: [GridItem] {
        if typeSize.isAccessibilitySize { return [GridItem(.flexible())] }
        return [GridItem(.adaptive(minimum: 148, maximum: 280), spacing: 14, alignment: .top)]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Games")
                    .font(.system(.largeTitle, design: .rounded, weight: .heavy))
                    .accessibilityAddTraits(.isHeader)

                HStack(spacing: 8) {
                    filterButton("All games", showsGentle: false)
                    filterButton("No rush", showsGentle: true)
                }

                LazyVGrid(columns: columns, alignment: .leading, spacing: 16) {
                    ForEach(games) { game in
                        let unlocked = access.allows(game)
                        Button {
                            onPlay(game)
                        } label: {
                            VStack(alignment: .leading, spacing: 0) {
                                Image(game.cover)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(height: 110)
                                    .frame(maxWidth: .infinity)
                                    .clipped()
                                    .accessibilityHidden(true)
                                VStack(alignment: .leading, spacing: 5) {
                                    HStack(alignment: .top) {
                                        Text(game.title)
                                            .font(.system(.headline, design: .rounded, weight: .heavy))
                                            .fixedSize(horizontal: false, vertical: true)
                                        if completed.contains(game.id) {
                                            Image(systemName: "star.fill")
                                                .font(.caption)
                                                .foregroundStyle(SonaPalette.teal)
                                                .accessibilityHidden(true)
                                        }
                                    }
                                    Text(unlocked ? game.instruction : "Premium")
                                        .font(.system(.footnote, design: .rounded))
                                        .foregroundStyle(SonaPalette.muted)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .padding(12)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .background(.white, in: RoundedRectangle(cornerRadius: 20))
                            .clipShape(RoundedRectangle(cornerRadius: 20))
                            .contentShape(RoundedRectangle(cornerRadius: 20))
                            .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(SonaPalette.ink.opacity(0.10)))
                        }
                        .buttonStyle(SonaPressStyle())
                        .disabled(!unlocked)
                        .opacity(unlocked ? 1 : 0.60)
                        .accessibilityElement(children: .combine)
                        .accessibilityValue(completed.contains(game.id) ? "Finished" : "")
                        .accessibilityIdentifier("play-\(game.id)")
                    }
                }
            }
            .frame(maxWidth: 760)
            .padding(20)
            .frame(maxWidth: .infinity)
        }
        .foregroundStyle(SonaPalette.ink)
        .background(SonaPalette.paper.ignoresSafeArea())
    }

    private func filterButton(_ title: String, showsGentle: Bool) -> some View {
        Button { quietGames = showsGentle } label: {
            Text(title)
                .font(.system(.subheadline, design: .rounded, weight: .bold))
                .padding(.horizontal, 14)
                .frame(minHeight: 44)
                .background(quietGames == showsGentle ? SonaPalette.mint : .white, in: Capsule())
        }
        .buttonStyle(SonaPressStyle())
        .accessibilityAddTraits(quietGames == showsGentle ? .isSelected : [])
    }
}
