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
        case .racecar: return 4
        case .treasure: return 3
        case .space: return 3
        }
    }
}

struct JourneyGamesView: View {
    let game: JourneyGame
    let onRoundFinished: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var turn = 0
    @State private var playthrough = 0

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
                    .font(.system(.title2, design: .rounded, weight: .heavy))
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                ProgressView(value: Double(turn), total: Double(game.goal))
                    .frame(width: 48)
                    .tint(SonaPalette.teal)
                    .accessibilityLabel("Round progress")
            }
            .buttonStyle(SonaPressStyle())

            if turn == game.goal {
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
    }

    @ViewBuilder
    private var activity: some View {
        switch game {
        case .feed: FeedBoard(turn: turn, advance: advance)
        case .racecar: RaceBoard(turn: turn, advance: advance)
        case .treasure: TreasureBoard(turn: turn, advance: advance)
        case .space: LandingBoard(turn: turn, advance: advance)
        }
    }

    private func advance() {
        guard turn < game.goal else { return }
        turn += 1
        if turn == game.goal { onRoundFinished() }
    }

    private var finishView: some View {
        ScrollView {
            VStack(spacing: 16) {
                Image("echo-cheer")
                    .resizable()
                    .scaledToFit()
                    .frame(height: 178)
                    .accessibilityHidden(true)
                Text("You did it!")
                    .font(.system(.largeTitle, design: .rounded, weight: .heavy))
                    .accessibilityIdentifier("journey-complete")
                Button("Play again") {
                    playthrough += 1
                    turn = 0
                }
                .buttonStyle(RoundActionStyle())
                Button("Back to games") { dismiss() }
                    .font(.system(.headline, design: .rounded, weight: .bold))
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
                .font(.system(.headline, design: .rounded, weight: .bold))
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

private struct RaceBoard: View {
    let turn: Int
    let advance: () -> Void

    @Environment(\.scenePhase) private var scenePhase
    @State private var start: Date?
    @State private var elapsed: TimeInterval = 0
    @State private var car: CGFloat = 0.5
    @State private var message = "Steer through the glowing gate."
    private let beat = Timer.publish(every: 1.0 / 38, on: .main, in: .common).autoconnect()
    private let crossing: TimeInterval = 2.7
    private let course: [CGFloat] = [0.50, 0.24, 0.74, 0.42]

    var body: some View {
        VStack(spacing: 12) {
            Text(message)
                .font(.system(.headline, design: .rounded, weight: .bold))
                .multilineTextAlignment(.center)

            GeometryReader { geometry in
                let width = geometry.size.width
                let height = geometry.size.height
                let gateY = height * CGFloat(0.13 + 0.66 * min(1, elapsed / crossing))
                let target = course[turn]
                ZStack {
                    SonaPalette.ink
                    Path { path in
                        for x in [0.12, 0.88] {
                            path.move(to: CGPoint(x: x * width, y: 0))
                            path.addLine(to: CGPoint(x: x * width, y: height))
                        }
                    }
                    .stroke(.white.opacity(0.28), style: StrokeStyle(lineWidth: 3, dash: [12, 10]))

                    Capsule()
                        .fill(SonaPalette.mint.opacity(0.9))
                        .overlay(Capsule().strokeBorder(.white.opacity(0.72), lineWidth: 3))
                        .frame(width: width * 0.24, height: 24)
                        .position(x: target * width, y: gateY)

                    Image(systemName: "car.top.fill")
                        .font(.system(size: 53, weight: .bold))
                        .foregroundStyle(SonaPalette.yellow)
                        .position(x: car * width, y: height * 0.82)
                }
                .clipShape(RoundedRectangle(cornerRadius: 22))
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0).onChanged { value in
                        guard width > 0 else { return }
                        car = max(0.15, min(0.85, value.location.x / width))
                    }
                )
                .accessibilityHidden(true)
            }
            HStack {
                steering("Left", direction: -0.13)
                steering("Right", direction: 0.13)
            }
            if start == nil {
                Button(turn == 0 ? "Drive" : "Drive on") {
                    message = "Steer through the glowing gate."
                    start = Date().addingTimeInterval(-elapsed)
                }
                .buttonStyle(RoundActionStyle())
                .accessibilityIdentifier("race-drive")
            }
        }
        .onReceive(beat) { now in
            guard let start else { return }
            elapsed = now.timeIntervalSince(start)
            guard elapsed >= crossing else { return }
            self.start = nil
            elapsed = 0
            if abs(car - course[turn]) <= 0.13 {
                message = "Nice driving!"
                advance()
            } else {
                message = "Try the glowing lane again."
            }
        }
        .onChange(of: scenePhase) { phase in
            if phase != .active { start = nil }
        }
    }

    private func steering(_ label: String, direction: CGFloat) -> some View {
        Button(label) { car = min(0.85, max(0.15, car + direction)) }
            .buttonStyle(RoundActionStyle())
            .accessibilityHint(direction < 0 ? "Steer left" : "Steer right")
    }
}

private struct TreasureBoard: View {
    let turn: Int
    let advance: () -> Void
    @State private var next = 1

    private let maps = [
        [CGPoint(x: 0.15, y: 0.7), CGPoint(x: 0.38, y: 0.47), CGPoint(x: 0.65, y: 0.64), CGPoint(x: 0.82, y: 0.24)],
        [CGPoint(x: 0.20, y: 0.28), CGPoint(x: 0.70, y: 0.22), CGPoint(x: 0.72, y: 0.68), CGPoint(x: 0.29, y: 0.76)],
        [CGPoint(x: 0.15, y: 0.75), CGPoint(x: 0.41, y: 0.27), CGPoint(x: 0.59, y: 0.64), CGPoint(x: 0.85, y: 0.24)]
    ]

    var body: some View {
        VStack(spacing: 14) {
            Text("Sail to each glowing island.")
                .font(.system(.headline, design: .rounded, weight: .bold))

            GeometryReader { geometry in
                let points = maps[turn].map {
                    CGPoint(x: $0.x * geometry.size.width, y: $0.y * geometry.size.height)
                }
                ZStack {
                    Color(red: 0.71, green: 0.89, blue: 0.91)
                    Path { path in
                        path.addLines(Array(points.prefix(next)))
                    }
                    .stroke(.white, style: StrokeStyle(lineWidth: 7, lineCap: .round, dash: [3, 10]))
                    ForEach(points.indices, id: \.self) { index in
                        Circle()
                            .fill(index == next ? SonaPalette.yellow : SonaPalette.mint)
                            .overlay(Circle().strokeBorder(.white, lineWidth: index == next ? 4 : 2))
                            .overlay {
                                Image(systemName: index == points.count - 1 ? "flag.fill" : "leaf.fill")
                                    .foregroundStyle(SonaPalette.teal)
                            }
                            .frame(width: 51, height: 51)
                            .position(points[index])
                    }
                    Image(systemName: "sailboat.fill")
                        .font(.system(size: 41, weight: .heavy))
                        .foregroundStyle(SonaPalette.teal)
                        .position(points[next - 1])
                }
                .clipShape(RoundedRectangle(cornerRadius: 24))
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0).onChanged { value in
                        guard points.indices.contains(next),
                              hypot(points[next].x - value.location.x, points[next].y - value.location.y) < 36
                        else { return }
                        sail()
                    }
                )
                .accessibilityHidden(true)
            }
            Button("Sail to the next island") { sail() }
                .buttonStyle(RoundActionStyle())
                .accessibilityIdentifier("treasure-sail")
        }
    }

    private func sail() {
        if next < maps[turn].count - 1 {
            next += 1
        } else {
            next = 1
            advance()
        }
    }
}

private struct LandingBoard: View {
    let turn: Int
    let advance: () -> Void

    @State private var rocket = CGPoint(x: 0.50, y: 0.23)
    @State private var message = "Guide the rocket onto the lit pad."
    private let pads: [CGFloat] = [0.30, 0.70, 0.51]

    var body: some View {
        VStack(spacing: 12) {
            Text(message)
                .font(.system(.headline, design: .rounded, weight: .bold))
                .multilineTextAlignment(.center)

            GeometryReader { geometry in
                let width = geometry.size.width
                let height = geometry.size.height
                ZStack {
                    LinearGradient(colors: [SonaPalette.ink, SonaPalette.teal], startPoint: .top, endPoint: .bottom)
                    ForEach(0..<15) { index in
                        Circle()
                            .fill(.white.opacity(0.68))
                            .frame(width: 3, height: 3)
                            .position(x: CGFloat((index * 7) % 17 + 1) * width / 19,
                                      y: CGFloat((index * 11) % 21 + 1) * height / 24)
                    }
                    Circle()
                        .fill(SonaPalette.lavender)
                        .frame(width: width * 0.33)
                        .position(x: width * 0.77, y: height * 0.22)
                    Capsule()
                        .fill(SonaPalette.yellow)
                        .overlay(Capsule().strokeBorder(.white, lineWidth: 3))
                        .frame(width: width * 0.24, height: 20)
                        .position(x: width * pads[turn], y: height * 0.84)
                    Image(systemName: "airplane")
                        .rotationEffect(.degrees(90))
                        .font(.system(size: 43, weight: .heavy))
                        .foregroundStyle(.white)
                        .position(x: width * rocket.x, y: height * rocket.y)
                }
                .clipShape(RoundedRectangle(cornerRadius: 24))
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            guard width > 0, height > 0 else { return }
                            rocket = CGPoint(
                                x: max(0.09, min(0.91, value.location.x / width)),
                                y: max(0.1, min(0.8, value.location.y / height))
                            )
                        }
                        .onEnded { _ in land() }
                )
                .accessibilityHidden(true)
            }
            HStack {
                steering("Left", direction: -0.10)
                Button("Land") {
                    rocket.y = 0.8
                    land()
                }
                .buttonStyle(RoundActionStyle())
                .accessibilityIdentifier("space-land")
                steering("Right", direction: 0.10)
            }
        }
    }

    private func steering(_ title: String, direction: CGFloat) -> some View {
        Button(title) { rocket.x = min(0.9, max(0.1, rocket.x + direction)) }
            .buttonStyle(RoundActionStyle())
    }

    private func land() {
        guard rocket.y >= 0.68 else { return }
        if abs(rocket.x - pads[turn]) < 0.13 {
            rocket = CGPoint(x: 0.50, y: 0.23)
            message = "Touchdown!"
            advance()
        } else {
            rocket.y = 0.44
            message = "Try landing on the yellow pad."
        }
    }
}
