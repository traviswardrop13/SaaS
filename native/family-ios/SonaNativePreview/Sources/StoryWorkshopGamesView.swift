import SwiftUI

enum StoryWorkshopGame: String {
    case trainline, kite, nestlift, concert, rooftops, observatory

    var title: String {
        switch self {
        case .trainline: return "Valley Train"
        case .kite: return "Patchwork Kite"
        case .nestlift: return "Nest Lift"
        case .concert: return "Pond Concert"
        case .rooftops: return "Seed Launcher"
        case .observatory: return "Star Machine"
        }
    }
}

struct StoryWorkshopGamesView: View {
    let game: StoryWorkshopGame
    let onRoundFinished: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.speechGameProgress) private var speechGameProgress
    @Environment(\.guidedReplay) private var guidedReplay
    @State private var finished = false
    @State private var round = UUID()

    var body: some View {
        SonaNavigation {
            ScrollView {
                VStack(spacing: 16) {
                    Image("daily-\(game.rawValue)")
                        .resizable().scaledToFill()
                        .frame(height: 125).frame(maxWidth: .infinity)
                        .clipShape(RoundedRectangle(cornerRadius: 24))
                        .accessibilityHidden(true)
                    if finished {
                        Image(systemName: "star.circle.fill")
                            .font(.system(size: 54)).foregroundStyle(SonaPalette.teal)
                            .accessibilityHidden(true)
                        Text("Round finished")
                            .font(.system(.title, design: .rounded).weight(.heavy))
                        Button("Back to story") { dismiss() }.buttonStyle(WorkshopAction())
                        if speechGameProgress == nil || guidedReplay != nil {
                            Button("Play again") {
                                if let guidedReplay { guidedReplay() }
                                else { round = UUID(); finished = false }
                            }
                                .buttonStyle(WorkshopAction(secondary: true))
                        }
                    } else {
                        board.id(round)
                    }
                }
                .padding(20)
                .frame(maxWidth: 530)
                .frame(maxWidth: .infinity)
            }
            .foregroundStyle(SonaPalette.ink)
            .background(SonaPalette.paper.ignoresSafeArea())
            .navigationTitle(game.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    @ViewBuilder private var board: some View {
        switch game {
        case .trainline: RailwayRound(turns: speechGameProgress?.count, onFinish: finish)
        case .kite: KiteRound(onFinish: finish)
        case .nestlift: NestLiftRound(onFinish: finish)
        case .concert: ConcertRound(onFinish: finish)
        case .rooftops: RooftopRound(onFinish: finish)
        case .observatory: ObservatoryRound(onFinish: finish)
        }
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        onRoundFinished()
    }
}

private struct RailwayRound: View {
    let onFinish: () -> Void
    @Environment(\.speechGameProgress) private var speechGameProgress
    @State private var track: [Int]
    @State private var route = 0
    @State private var station = 0
    private let destination = [1, 2, 0]
    private let names = ["Snowdrop", "Pine Grove", "Hilltop"]

    init(turns: Int?, onFinish: @escaping () -> Void) {
        self.onFinish = onFinish
        let pattern = turns.map { Array(repeating: 1, count: max(1, $0 - 3)) } ?? [1, 0, 1, 1]
        _track = State(initialValue: pattern)
    }

    private var joined: Bool { !track.contains(1) }

    var body: some View {
        WorkshopCard(joined ? "Route the train to \(names[destination[station]])" : "Turn the tracks to join the rails") {
            HStack(spacing: 7) {
                ForEach(track.indices, id: \.self) { index in
                    Button {
                        guard speechGameProgress == nil || track[index] == 1 else { return }
                        track[index] = 1 - track[index]
                        speechGameProgress?.advance()
                    } label: {
                        Image(systemName: "line.3.horizontal")
                            .font(.title2.weight(.semibold))
                            .rotationEffect(.degrees(track[index] == 0 ? 0 : 90))
                            .frame(maxWidth: .infinity, minHeight: 55)
                            .background(track[index] == 0 ? SonaPalette.mint : SonaPalette.yellow,
                                        in: RoundedRectangle(cornerRadius: 13))
                    }
                    .buttonStyle(.plain)
                    .disabled(joined || (speechGameProgress != nil && track[index] == 0))
                    .accessibilityLabel("Track \(index + 1), \(track[index] == 0 ? "joined" : "turned")")
                }
            }
            if joined {
                Picker("Station signal", selection: $route) {
                    ForEach(names.indices, id: \.self) { Text(names[$0]).tag($0) }
                }
                .pickerStyle(.segmented)
                Button("Stop at \(names[route])") {
                    guard route == destination[station] else { return }
                    speechGameProgress?.advance()
                    if station == destination.count - 1 { onFinish() }
                    else { station += 1 }
                }
                .buttonStyle(WorkshopAction())
                .disabled(route != destination[station])
                Text("\(station) of \(destination.count) stops").font(.subheadline)
            }
        }
    }
}

private struct KiteRound: View {
    let onFinish: () -> Void
    @Environment(\.speechGameProgress) private var speechGameProgress
    @State private var seam = 0
    @State private var weight = 0
    private var knots: [CGPoint] {
        if speechGameProgress?.count == 8 {
            return [.init(x: 0.50, y: 0.12), .init(x: 0.66, y: 0.27), .init(x: 0.77, y: 0.40),
                    .init(x: 0.64, y: 0.64), .init(x: 0.50, y: 0.86), .init(x: 0.36, y: 0.64), .init(x: 0.23, y: 0.40)]
        }
        return [.init(x: 0.50, y: 0.12), .init(x: 0.77, y: 0.40), .init(x: 0.50, y: 0.86), .init(x: 0.23, y: 0.40)]
    }

    var body: some View {
        WorkshopCard(seam < knots.count ? "Follow the stitches around the kite" : "Balance the tail before you fly") {
            GeometryReader { geometry in
                let points = knots.map { CGPoint(x: $0.x * geometry.size.width, y: $0.y * geometry.size.height) }
                ZStack {
                    Path { path in
                        path.addLines(points)
                        path.closeSubpath()
                    }
                    .fill(SonaPalette.lavender)
                    Path { path in path.addLines(points) }
                        .stroke(SonaPalette.teal, style: StrokeStyle(lineWidth: 2, dash: [4, 5]))
                    ForEach(points.indices, id: \.self) { index in
                        Button { stitch(index) } label: {
                            Circle()
                                .fill(index < seam ? SonaPalette.teal : index == seam ? SonaPalette.yellow : .white)
                                .shadow(radius: 1).frame(width: 29, height: 29)
                                .frame(width: 48, height: 48)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .position(points[index])
                        .accessibilityLabel("Stitch \(index + 1)")
                    }
                }
                .contentShape(Rectangle())
                .simultaneousGesture(DragGesture(minimumDistance: 3).onChanged { event in
                    guard seam < points.count else { return }
                    let target = points[seam]
                    if hypot(target.x - event.location.x, target.y - event.location.y) <= 28 { stitch(seam) }
                })
            }
            .frame(height: 200)
            if seam == knots.count {
                Slider(value: Binding(get: { Double(weight) }, set: { weight = Int($0) }), in: 0...4, step: 1) {
                    Text("Tail weight")
                }
                Label(weight == 2 ? "Balanced" : "Find the middle", systemImage: "balance.scale")
                Button("Fly the kite") { speechGameProgress?.advance(); onFinish() }
                    .buttonStyle(WorkshopAction()).disabled(weight != 2)
            }
        }
    }

    private func stitch(_ index: Int) {
        guard index == seam else { return }
        seam += 1
        speechGameProgress?.advance()
    }
}

private struct NestLiftRound: View {
    let onFinish: () -> Void
    @Environment(\.speechGameProgress) private var speechGameProgress
    @State private var delivery = 0
    @State private var weights = 0
    @State private var lift = 0.0
    private let bundleWeights = [2, 1, 3]
    private let levels = [2, 1, 3]
    private let names = ["Blanket", "Soft toy", "Pillow"]

    var body: some View {
        let bundle = delivery % levels.count
        return WorkshopCard("\(names[bundle]) goes to nest \(levels[bundle])") {
            VStack(alignment: .leading, spacing: 10) {
                Stepper("Counterweights: \(weights)", value: $weights, in: 0...3)
                Label(weights == bundleWeights[bundle] ? "Basket balanced" : "Match the bundle’s weight",
                      systemImage: "balance.scale")
                Text("Bundle weighs \(bundleWeights[bundle])")
                    .font(.subheadline)
                    .foregroundStyle(SonaPalette.muted)
                Slider(value: $lift, in: 0...3, step: 1) { Text("Lift height") }
                    .disabled(weights != bundleWeights[bundle])
                Text("Basket at level \(Int(lift))")
            }
            Button("Unload bundle") {
                speechGameProgress?.advance()
                if delivery == (speechGameProgress?.count ?? levels.count) - 1 { onFinish() }
                else { delivery += 1; lift = 0; weights = 0 }
            }
            .buttonStyle(WorkshopAction())
            .disabled(weights != bundleWeights[bundle] || Int(lift) != levels[bundle])
        }
    }
}

private struct ConcertRound: View {
    let onFinish: () -> Void
    @Environment(\.speechGameProgress) private var speechGameProgress
    @State private var verse = 0
    @State private var beat = 0
    @StateObject private var notes = PianoVoice()
    private let patterns = [[0, 1, 0], [1, 2, 1, 0], [2, 0, 1, 2, 2]]
    private let names = ["Drum", "Harp", "Chimes"]
    private let icons = ["circle.inset.filled", "harp", "bell.fill"]
    private var pattern: [Int] { patterns[verse % patterns.count] }
    private var goal: Int { speechGameProgress?.count ?? patterns.count }

    var body: some View {
        WorkshopCard("Play the musicians’ pattern") {
            HStack(spacing: 6) {
                ForEach(pattern.indices, id: \.self) { position in
                    Image(systemName: icons[pattern[position]])
                        .font(.title3)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(position < beat ? SonaPalette.mint : position == beat ? SonaPalette.yellow : .white,
                                    in: RoundedRectangle(cornerRadius: 12))
                        .accessibilityLabel(names[pattern[position]])
                }
            }
            HStack(spacing: 8) {
                ForEach(names.indices, id: \.self) { index in
                    Button {
                        play(index)
                    } label: {
                        Label(names[index], systemImage: icons[index])
                            .labelStyle(.iconOnly).font(.title.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 66)
                            .background(SonaPalette.lavender, in: RoundedRectangle(cornerRadius: 16))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(names[index])
                }
            }
            Text("\(verse + 1) of \(goal) patterns").font(.subheadline)
        }
        .onDisappear { notes.stop() }
    }

    private func play(_ index: Int) {
        notes.play([0, 2, 5][index])
        guard pattern[beat] == index else { beat = 0; return }
        if beat == pattern.count - 1 {
            speechGameProgress?.advance()
            if verse == goal - 1 { onFinish() }
            else { verse += 1; beat = 0 }
        } else { beat += 1 }
    }
}

private struct RooftopRound: View {
    let onFinish: () -> Void
    @Environment(\.speechGameProgress) private var speechGameProgress
    @State private var planting = 0
    @State private var strength = 0.35
    @State private var aim = 45.0
    @State private var missed = false
    private let targets = [0.46, 0.69, 0.84]

    private var range: Double { strength * sin(aim * .pi / 90) }
    private var target: Double { targets[planting % targets.count] }

    var body: some View {
        WorkshopCard("Aim a seed into the rooftop planter") {
            Canvas { context, size in
                let x = { (unit: Double) in size.width * (0.07 + unit * 0.86) }
                let baseline = size.height * 0.83
                let planterX = x(target)
                var arc = Path()
                for n in 0...24 {
                    let t = Double(n) / 24
                    let height = 4 * t * (1 - t) * (aim / 80) * strength
                    let point = CGPoint(x: x(t * range), y: baseline - size.height * height)
                    if n == 0 { arc.move(to: point) } else { arc.addLine(to: point) }
                }
                context.stroke(arc, with: .color(SonaPalette.teal), style: StrokeStyle(lineWidth: 3, dash: [4, 6]))
                let planter = CGRect(x: planterX - 18, y: baseline - 7, width: 36, height: 24)
                context.fill(Path(roundedRect: planter, cornerRadius: 5), with: .color(SonaPalette.teal))
                let end = CGRect(x: x(range) - 5, y: baseline - 5, width: 10, height: 10)
                context.fill(Path(ellipseIn: end), with: .color(SonaPalette.ink))
            }
            .frame(height: 128)
            .background(SonaPalette.mint, in: RoundedRectangle(cornerRadius: 16))
            .accessibilityLabel(abs(range - target) < 0.07 ? "Seed aimed at the planter" : "Seed aimed away from the planter")
            Slider(value: $aim, in: 15...75) { Text("Aim angle") }
            Slider(value: $strength, in: 0.1...1) { Text("Spring strength") }
            if missed {
                Text("Try moving the dotted line to the planter.")
                    .font(.subheadline).foregroundStyle(SonaPalette.muted)
            }
            Button("Launch seed") {
                guard abs(range - target) < 0.07 else { missed = true; return }
                missed = false
                speechGameProgress?.advance()
                if planting == (speechGameProgress?.count ?? targets.count) - 1 { onFinish() }
                else { planting += 1 }
            }
            .buttonStyle(WorkshopAction())
        }
    }
}

private struct ObservatoryRound: View {
    let onFinish: () -> Void
    @Environment(\.speechGameProgress) private var speechGameProgress
    @State private var selected = 0
    @State private var installed: Set<Int> = []
    @State private var wheelTurns = 0
    private let required = [1, 0, 2]
    private let names = ["Small", "Medium", "Large"]
    private let lights = ["sun.max.fill", "moon.fill", "star.fill"]
    private var turnsNeeded: Int { (speechGameProgress?.count ?? 6) - required.count }

    var body: some View {
        WorkshopCard(installed.count == 3 ? "Turn the wheel to move the sky" : "Fit a gear for each sky piece") {
            Picker("Gear size", selection: $selected) {
                ForEach(names.indices, id: \.self) { Text(names[$0]).tag($0) }
            }
            .pickerStyle(.segmented)
            HStack(spacing: 8) {
                ForEach(lights.indices, id: \.self) { index in
                    Button {
                        guard selected == required[index], installed.insert(index).inserted else { return }
                        speechGameProgress?.advance()
                    } label: {
                        VStack(spacing: 7) {
                            Image(systemName: installed.contains(index) ? lights[index] : "gearshape")
                                .font(.system(size: CGFloat(25 + 8 * required[index]), weight: .bold))
                                .rotationEffect(.degrees(Double(wheelTurns) * 24))
                                .frame(height: 51)
                            Text(names[required[index]]).font(.caption)
                        }
                        .frame(maxWidth: .infinity, minHeight: 76)
                        .background(installed.contains(index) ? SonaPalette.yellow : SonaPalette.mint,
                                    in: RoundedRectangle(cornerRadius: 16))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(names[required[index]]) gear socket")
                    .accessibilityValue(installed.contains(index) ? "Filled" : "Empty")
                }
            }
            Button("Turn the wheel · \(wheelTurns)/\(turnsNeeded)") {
                wheelTurns += 1
                speechGameProgress?.advance()
                if wheelTurns == turnsNeeded { onFinish() }
            }
            .buttonStyle(WorkshopAction())
            .disabled(installed.count < required.count)
        }
    }
}

private struct WorkshopCard<Content: View>: View {
    let prompt: String
    let content: Content

    init(_ prompt: String, @ViewBuilder content: () -> Content) {
        self.prompt = prompt
        self.content = content()
    }

    var body: some View {
        VStack(spacing: 14) {
            Text(prompt).font(.system(.title3, design: .rounded).weight(.heavy))
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .background(.white, in: RoundedRectangle(cornerRadius: 22))
    }
}

private struct WorkshopAction: ButtonStyle {
    var secondary = false
    @Environment(\.isEnabled) private var enabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(.headline, design: .rounded).weight(.heavy))
            .frame(maxWidth: .infinity, minHeight: 48)
            .foregroundStyle(secondary ? SonaPalette.ink : .white)
            .background(secondary ? SonaPalette.mint : SonaPalette.teal, in: RoundedRectangle(cornerRadius: 14))
            .opacity(!enabled ? 0.5 : configuration.isPressed ? 0.8 : 1)
    }
}
