import Combine
import SwiftUI

enum JourneyGame {
    case feed, racecar, treasure, space

    var title: String {
        switch self {
        case .feed: return "Feed Echo"
        case .racecar: return "Race Car"
        case .treasure: return "Treasure Map"
        case .space: return "Space Trip"
        }
    }

    var goal: Int {
        switch self {
        case .feed: return 5
        case .racecar: return 8
        case .treasure: return 8
        case .space: return 8
        }
    }
}

struct JourneyGamesView: View {
    let game: JourneyGame
    let onRoundFinished: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.speechGameProgress) private var speechGameProgress
    @Environment(\.guidedReplay) private var guidedReplay
    @State private var turn = 0
    @State private var playthrough = 0
    @State private var spaceTrip: NativeSpaceFlight.Trip?

    private var goal: Int { speechGameProgress?.count ?? game.goal }

    var body: some View {
        VStack(spacing: 14) {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 18, weight: .bold))
                        .frame(width: 48, height: 48)
                        .background(.white, in: Circle())
                }
                .accessibilityLabel("Back to games")
                .accessibilityIdentifier("journey-close")
                Spacer()
                Text(game.title)
                    .font(.system(.title2, design: .rounded).weight(.heavy))
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                ProgressView(value: Double(turn), total: Double(goal))
                    .frame(width: 48)
                    .tint(SonaPalette.teal)
                    .accessibilityLabel("Round progress")
            }
            .buttonStyle(SonaPressStyle())

            if turn == goal {
                finishView
            } else {
                activity.id(playthrough)
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .frame(maxWidth: 600)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .foregroundStyle(SonaPalette.ink)
        .background(SonaPalette.paper.ignoresSafeArea())
        .onAppear {
            if game == .space, spaceTrip == nil { spaceTrip = .random() }
        }
    }

    @ViewBuilder
    private var activity: some View {
        switch game {
        case .feed: FeedBoard(turn: turn, advance: advance)
        case .racecar: NativeRaceBoard(turn: turn, advance: advance)
        case .treasure: NativeTreasureBoard(turn: turn, advance: advance)
        case .space:
            if let spaceTrip {
                NativeSpaceFlightBoard(turn: turn, trip: spaceTrip,
                    little: speechGameProgress?.isSimple == true, advance: advance)
            }
        }
    }

    private func advance() {
        guard turn < goal else { return }
        turn += 1
        speechGameProgress?.advance()
        if turn == goal { onRoundFinished() }
    }

    private var finishView: some View {
        ScrollView {
            VStack(spacing: 16) {
                Image("echo-cheer")
                    .resizable()
                    .scaledToFit()
                    .frame(height: 178)
                    .accessibilityHidden(true)
                if game == .space, let spaceTrip {
                    NativeSpacePlanets(trip: spaceTrip, landed: turn, finale: true)
                }
                Text(game == .space ? "A space trip, flown by you!" : "You did it!")
                    .font(.system(.largeTitle, design: .rounded).weight(.heavy))
                    .accessibilityIdentifier("journey-complete")
                Button("Play again") {
                    if let guidedReplay { guidedReplay() }
                    else {
                        if game == .space { spaceTrip = .random(excluding: spaceTrip?.worlds.first?.id) }
                        playthrough += 1; turn = 0
                    }
                }
                .buttonStyle(RoundActionStyle())
                Button("Back to games") { dismiss() }
                    .font(.system(.headline, design: .rounded).weight(.bold))
                    .frame(minHeight: 48)
            }
            .padding(18)
            .frame(maxWidth: .infinity)
        }
    }
}

private struct FeedBoard: View {
    let turn: Int
    let advance: () -> Void
    @State private var missed = false

    private let fruit = ["apple", "orange", "strawberry", "kiwi", "watermelon"]

    var body: some View {
        let target = fruit[turn % fruit.count]
        VStack(spacing: 18) {
            Spacer(minLength: 0)
            Text("Find the matching fruit.")
                .font(.system(.headline, design: .rounded).weight(.bold))
            ZStack(alignment: .topTrailing) {
                Image("echo-welcome")
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 198)
                    .accessibilityHidden(true)
                Image("fruit-\(target)")
                    .resizable()
                    .scaledToFit()
                    .padding(8)
                    .frame(width: 66, height: 66)
                    .background(.white, in: Circle())
                    .overlay(Circle().strokeBorder(SonaPalette.teal.opacity(0.2), lineWidth: 2))
                    .accessibilityLabel("Match the \(target)")
            }
            HStack(spacing: 8) {
                ForEach(0..<3) { index in
                    let step = index - turn % 3
                    let candidate = fruit[(fruit.count + turn + step) % fruit.count]
                    Button {
                        if candidate == target {
                            missed = false
                            advance()
                        } else {
                            missed = true
                        }
                    } label: {
                        Image("fruit-\(candidate)")
                            .resizable()
                            .scaledToFit()
                            .padding(10)
                            .frame(maxWidth: .infinity)
                            .frame(height: 80)
                            .background(.white, in: RoundedRectangle(cornerRadius: 17))
                    }
                    .buttonStyle(SonaPressStyle())
                    .accessibilityLabel(candidate.capitalized)
                    .accessibilityIdentifier("feed-\(candidate)")
                }
            }
            Text(missed ? "Look at the fruit beside Echo." : "Tap a fruit to feed Echo.")
                .font(.system(.subheadline, design: .rounded))
                .foregroundStyle(SonaPalette.muted)
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(SonaPalette.mint.opacity(0.55), in: RoundedRectangle(cornerRadius: 24))
    }
}
