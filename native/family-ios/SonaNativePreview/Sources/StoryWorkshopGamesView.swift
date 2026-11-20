import Combine
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
    @Environment(\.scenePhase) private var scene
    @State private var track: [Int]
    @State private var route = 0
    @State private var station = 0
    @State private var travel = 0.0
    @State private var driving = false
    @State private var trackDrag: (index: Int, distance: CGFloat)?
    @State private var previous: Date?
    @StateObject private var power = StoryMovePower()
    private let timer = Timer.publish(every: 1.0 / 30, on: .main, in: .common).autoconnect()
    private let destination = [1, 2, 0]
    private let names = ["Snowdrop", "Pine Grove", "Hilltop"]
    private let platform = 0.75
    private var atPlatform: Bool {
        abs(travel - platform) <= WorkshopPowerGeometry.trainBerth(young: speechGameProgress?.count == 5, powered: power.active)
    }

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
                        turnTrack(index)
                    } label: {
                        Image(systemName: "line.3.horizontal")
                            .font(.title2.weight(.semibold))
                            .rotationEffect(.degrees(railAngle(index)))
                            .frame(maxWidth: .infinity, minHeight: 55)
                            .background(track[index] == 0 ? SonaPalette.mint : SonaPalette.yellow,
                                        in: RoundedRectangle(cornerRadius: 13))
                            .overlay {
                                if power.active && track[index] == 1 {
                                    RoundedRectangle(cornerRadius: 13).strokeBorder(SonaPalette.teal, lineWidth: 3)
                                }
                            }
                    }
                    .buttonStyle(.plain)
                    .disabled(joined || (speechGameProgress != nil && track[index] == 0))
                    .simultaneousGesture(DragGesture(minimumDistance: 5).onChanged { touch in
                        guard track[index] == 1 else { return }
                        trackDrag = (index, abs(touch.translation.width))
                    }.onEnded { touch in
                        trackDrag = nil
                        let distance = abs(touch.translation.width)
                        let room = WorkshopPowerGeometry.railJoin(young: speechGameProgress?.count == 5, powered: power.active)
                        if distance >= 65 - room { turnTrack(index) }
                    })
                    .accessibilityLabel("Track \(index + 1), \(track[index] == 0 ? "joined" : "turned")")
                }
            }
            if joined {
                Picker("Station signal", selection: $route) {
                    ForEach(names.indices, id: \.self) { Text(names[$0]).tag($0) }
                }
                .pickerStyle(.segmented)
                GeometryReader { geometry in
                    let width = geometry.size.width
                    let berth = WorkshopPowerGeometry.trainBerth(young: speechGameProgress?.count == 5, powered: power.active)
                    Capsule().fill(SonaPalette.lavender).frame(height: 5).position(x: width / 2, y: 20)
                    Capsule().fill(SonaPalette.yellow).frame(width: width * berth * 2, height: 8)
                        .position(x: width * platform, y: 20)
                    Image(systemName: "tram.fill").font(.title3).foregroundStyle(SonaPalette.teal)
                        .position(x: min(width - 12, max(12, width * travel)), y: 20)
                }
                .frame(height: 40)
                .accessibilityLabel(atPlatform ? "Train at the platform" : "Train away from the platform")
                Text("Hold to drive")
                    .font(.headline).foregroundStyle(SonaPalette.ink)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(SonaPalette.lavender, in: RoundedRectangle(cornerRadius: 16))
                    .contentShape(Rectangle())
                    .gesture(DragGesture(minimumDistance: 0).onChanged { _ in driving = true }
                        .onEnded { _ in stopDrive() })
                    .accessibilityAddTraits(.isButton)
                    .accessibilityAction { driveBy(0.10) }
                    .accessibilityHint("Drive the train toward the yellow platform.")
                    .accessibilityIdentifier("workshop-train-drive")
                Button("Stop at \(names[route])") {
                    guard speechGameProgress?.isMoveActive != false, !driving, atPlatform, route == destination[station] else { return }
                    speechGameProgress?.advance()
                    if station == destination.count - 1 { onFinish() }
                    else { station += 1; travel = 0 }
                }
                .buttonStyle(WorkshopAction())
                .disabled(driving || !atPlatform || route != destination[station])
                if travel > platform && !atPlatform {
                    Button("Back up") { travel = max(0, travel - 0.12) }
                        .buttonStyle(.bordered)
                }
                Text("\(station) of \(destination.count) stops").font(.subheadline)
            }
        }
        .modifier(StoryMovePowerControls(power: power, title: "Easy stops", id: "workshop-train-help",
                                        enabled: !driving && trackDrag == nil))
        .onReceive(timer) { now in
            guard driving && scene == .active && speechGameProgress?.isMoveActive != false else {
                previous = nil
                return
            }
            let dt = max(0, min(0.05, now.timeIntervalSince(previous ?? now)))
            previous = now
            driveBy(0.30 * dt)
        }
        .onChange(of: scene) { _ in stopDrive(); trackDrag = nil }
        .onChange(of: speechGameProgress?.isMoveActive) { _ in stopDrive(); trackDrag = nil }
        .onDisappear(perform: stopDrive)
    }

    private func stopDrive() { driving = false; previous = nil }
    private func turnTrack(_ index: Int) {
        guard speechGameProgress?.isMoveActive != false, speechGameProgress == nil || track[index] == 1 else { return }
        track[index] = 1 - track[index]
        speechGameProgress?.advance()
    }
    private func railAngle(_ index: Int) -> Double {
        guard track[index] == 1 else { return 0 }
        let distance = trackDrag?.index == index ? trackDrag?.distance ?? 0 : 0
        return max(0, 90 - Double(distance) * 90 / 65)
    }
    private func driveBy(_ distance: Double) {
        guard scene == .active, speechGameProgress?.isMoveActive != false else { return }
        travel = min(1, travel + distance * WorkshopPowerGeometry.trainSpeed(powered: power.active))
    }
}

private struct KiteRound: View {
    let onFinish: () -> Void
    @Environment(\.speechGameProgress) private var speechGameProgress
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scene
    @State private var seam = 0
    @State private var weight = 0
    @StateObject private var power = StoryMovePower()
    private var knots: [CGPoint] {
        if speechGameProgress?.count == 8 {
            return [.init(x: 0.50, y: 0.12), .init(x: 0.66, y: 0.27), .init(x: 0.77, y: 0.40),
                    .init(x: 0.64, y: 0.64), .init(x: 0.50, y: 0.86), .init(x: 0.36, y: 0.64), .init(x: 0.23, y: 0.40)]
        }
        return [.init(x: 0.50, y: 0.12), .init(x: 0.77, y: 0.40), .init(x: 0.50, y: 0.86), .init(x: 0.23, y: 0.40)]
    }

    var body: some View {
        WorkshopCard(seam < knots.count ? "Follow the stitches around the kite" : "Balance the tail before you fly") {
            TimelineView(.animation(minimumInterval: 1.0 / 30,
                                    paused: scene != .active || speechGameProgress?.isMoveActive == false || reduceMotion)) { tick in
                GeometryReader { geometry in
                    let amplitude = WorkshopPowerGeometry.clothFlutter(powered: power.active)
                    let drift = reduceMotion ? 0 : sin(tick.date.timeIntervalSinceReferenceDate * 1.8) * amplitude
                    seamBoard(knots.map { CGPoint(x: $0.x * geometry.size.width + drift, y: $0.y * geometry.size.height) })
                }
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
        .modifier(StoryMovePowerControls(power: power, title: "Steady cloth", id: "workshop-kite-help",
                                        enabled: seam < knots.count))
    }

    private func seamBoard(_ points: [CGPoint]) -> some View {
                ZStack {
                    Path { path in
                        path.addLines(points)
                        path.closeSubpath()
                    }
                    .fill(SonaPalette.lavender)
                    Path { path in path.addLines(points) }
                        .stroke(SonaPalette.teal, style: StrokeStyle(lineWidth: power.active ? 3 : 2, dash: [4, 5]))
                    ForEach(points.indices, id: \.self) { index in
                        Button { stitch(index) } label: {
                            Circle()
                                .fill(index < seam ? SonaPalette.teal : index == seam ? SonaPalette.yellow : .white)
                                .overlay {
                                    if power.active && index == seam {
                                        Circle().strokeBorder(SonaPalette.teal, lineWidth: 3)
                                    }
                                }
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
                    if hypot(target.x - event.location.x, target.y - event.location.y) <= WorkshopPowerGeometry.stitchCatch(powered: power.active) {
                        stitch(seam)
                    }
                })
    }

    private func stitch(_ index: Int) {
        guard speechGameProgress?.isMoveActive != false, index == seam else { return }
        seam += 1
        speechGameProgress?.advance()
    }
}

private struct NestLiftRound: View {
    let onFinish: () -> Void
    @Environment(\.speechGameProgress) private var speechGameProgress
    @Environment(\.scenePhase) private var scene
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var delivery = 0
    @State private var weights = 0
    @State private var lift = 0.0
    @State private var sway = 0.0
    @State private var previous: Date?
    @StateObject private var power = StoryMovePower()
    private let timer = Timer.publish(every: 1.0 / 30, on: .main, in: .common).autoconnect()
    private let bundleWeights = [2, 1, 3]
    private let levels = [2, 1, 3]
    private let names = ["Blanket", "Soft toy", "Pillow"]

    var body: some View {
        let bundle = delivery % levels.count
        let young = speechGameProgress?.count == 5
        let target = Double(levels[bundle])
        let balanced = weights == bundleWeights[bundle]
        let close = abs(lift - target) <= 0.16 && abs(sway) <= 0.18
        return WorkshopCard("\(names[bundle]) goes to nest \(levels[bundle])") {
            VStack(alignment: .leading, spacing: 10) {
                Stepper("Counterweights: \(weights)", value: $weights, in: 0...3)
                Label(weights == bundleWeights[bundle] ? "Basket balanced" : "Match the bundle’s weight",
                      systemImage: "balance.scale")
                Text("Bundle weighs \(bundleWeights[bundle])")
                    .font(.subheadline)
                    .foregroundStyle(SonaPalette.muted)
                Slider(value: $lift, in: 0...3) { Text("Lift height") }
                    .disabled(!balanced)
                GeometryReader { geometry in
                    let depth = geometry.size.height - 24
                    let center = geometry.size.width / 2
                    let landing = depth * (1 - target / 3) + 12
                    let basket = depth * (1 - lift / 3) + 12
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(power.active ? SonaPalette.teal : SonaPalette.muted,
                                      style: StrokeStyle(lineWidth: 2, dash: [4, 4]))
                        .frame(width: power.active ? 110 : 62, height: 20)
                        .position(x: center, y: landing)
                    Image(systemName: "basket.fill").foregroundStyle(SonaPalette.teal)
                        .rotationEffect(.radians(reduceMotion ? 0 : sway))
                        .position(x: center + (reduceMotion ? 0 : sway * 60), y: basket)
                }
                .frame(height: 115)
                .accessibilityLabel(close ? "Basket lined up with the nest" : "Basket away from the nest")
                Text("Basket height \(lift.formatted(.number.precision(.fractionLength(1))))")
            }
            Button("Unload bundle") {
                guard speechGameProgress?.isMoveActive != false, balanced, close else { return }
                speechGameProgress?.advance()
                if delivery == (speechGameProgress?.count ?? levels.count) - 1 { onFinish() }
                else { delivery += 1; lift = 0; weights = 0; sway = 0 }
            }
            .buttonStyle(WorkshopAction())
            .disabled(!balanced || !close)
        }
        .modifier(StoryMovePowerControls(power: power, title: "Steady lift", id: "workshop-lift-help"))
        .onChange(of: lift) { value in
            // Motion starts only from a move of the height control. Reduce
            // Motion keeps the illustrated basket and its landing steady.
            if !reduceMotion && balanced && speechGameProgress?.isMoveActive != false {
                sway = max(-0.38, min(0.38, sway + (value - previousHeight) * 0.35))
            }
            previousHeight = value
        }
        .onReceive(timer) { now in
            guard scene == .active, speechGameProgress?.isMoveActive != false, abs(sway) > 0.001 else {
                previous = nil
                return
            }
            let dt = max(0, min(0.05, now.timeIntervalSince(previous ?? now)))
            previous = now
            sway *= exp(-WorkshopPowerGeometry.liftDamping(young: young, powered: power.active) * dt)
        }
        .onChange(of: scene) { _ in previous = nil }
        .onChange(of: speechGameProgress?.isMoveActive) { _ in previous = nil }
        .onDisappear { previous = nil }
    }

    @State private var previousHeight = 0.0
}

private struct ConcertRound: View {
    let onFinish: () -> Void
    @Environment(\.speechGameProgress) private var speechGameProgress
    @Environment(\.scenePhase) private var scene
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOver
    @State private var verse = 0
    @State private var beat = 0
    @State private var beatPhase = 0.5
    @State private var previous: Date?
    @StateObject private var power = StoryMovePower()
    @StateObject private var notes = PianoVoice()
    private let timer = Timer.publish(every: 1.0 / 30, on: .main, in: .common).autoconnect()
    private let patterns = [[0, 1, 0], [1, 2, 1, 0], [2, 0, 1, 2, 2]]
    private let names = ["Drum", "Harp", "Chimes"]
    private let icons = ["circle.inset.filled", "harp", "bell.fill"]
    private var pattern: [Int] { patterns[verse % patterns.count] }
    private var goal: Int { speechGameProgress?.count ?? patterns.count }
    private var young: Bool { speechGameProgress?.count == 5 }
    private var window: Double { WorkshopPowerGeometry.concertWindow(young: young, powered: power.active) }
    private var onBeat: Bool { abs(beatPhase - 0.5) <= window }

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
            GeometryReader { geometry in
                let width = geometry.size.width
                Capsule().fill(SonaPalette.mint).frame(height: 5).position(x: width / 2, y: 12)
                Capsule().fill(SonaPalette.yellow).frame(width: 2 * width * window, height: 10)
                    .position(x: width / 2, y: 12)
                if !reduceMotion {
                    Circle().fill(SonaPalette.teal).frame(width: 12, height: 12)
                        .position(x: min(width - 6, max(6, width * beatPhase)), y: 12)
                }
            }
            .frame(height: 24).accessibilityHidden(true)
            Text(onBeat ? "Play the highlighted note" : "Follow the beat")
                .font(.subheadline.weight(.semibold))
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
        .modifier(StoryMovePowerControls(power: power, title: "Gentle beat", id: "workshop-concert-help"))
        .onReceive(timer) { now in
            guard scene == .active, speechGameProgress?.isMoveActive != false else { previous = nil; return }
            let dt = max(0, min(0.05, now.timeIntervalSince(previous ?? now)))
            previous = now
            beatPhase = (beatPhase + dt / WorkshopPowerGeometry.concertPeriod(young: young, powered: power.active))
                .truncatingRemainder(dividingBy: 1)
        }
        .onChange(of: scene) { _ in notes.stop(); previous = nil }
        .onChange(of: speechGameProgress?.isMoveActive) { active in
            notes.stop(); previous = nil
            if active == true { beatPhase = 0.5 }
        }
        .onDisappear { notes.stop(); previous = nil }
    }

    private func play(_ index: Int) {
        guard scene == .active, speechGameProgress?.isMoveActive != false else { return }
        notes.play([0, 2, 5][index])
        guard pattern[beat] == index else { beat = 0; return }
        // VoiceOver retains a deliberate untimed tap for each existing note.
        guard onBeat || voiceOver else { return }
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
    @StateObject private var power = StoryMovePower()
    private let targets = [0.46, 0.69, 0.84]
    private let gusts = [-0.045, 0.09, -0.065]

    private var throwDistance: Double { strength * sin(aim * .pi / 90) }
    private var breeze: Double { gusts[planting % gusts.count] * WorkshopPowerGeometry.windScale(powered: power.active) }
    private var landing: Double { horizontalFlight(at: 1) }
    private var target: Double { targets[planting % targets.count] }

    private func horizontalFlight(at flightTime: Double) -> Double {
        flightTime * throwDistance + breeze * flightTime * flightTime
    }

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
                    let point = CGPoint(x: x(horizontalFlight(at: t)), y: baseline - size.height * height)
                    if n == 0 { arc.move(to: point) } else { arc.addLine(to: point) }
                }
                context.stroke(arc, with: .color(SonaPalette.teal), style: StrokeStyle(lineWidth: 3, dash: [4, 6]))
                let planter = CGRect(x: planterX - 18, y: baseline - 7, width: 36, height: 24)
                context.fill(Path(roundedRect: planter, cornerRadius: 5), with: .color(SonaPalette.teal))
                let end = CGRect(x: x(landing) - 5, y: baseline - 5, width: 10, height: 10)
                context.fill(Path(ellipseIn: end), with: .color(SonaPalette.ink))
            }
            .frame(height: 128)
            .background(SonaPalette.mint, in: RoundedRectangle(cornerRadius: 16))
            .accessibilityLabel(abs(landing - target) < 0.07 ? "Seed aimed at the planter" : "Seed aimed away from the planter")
            Label(power.active ? "Calm breeze" : (breeze > 0 ? "Breeze to the right" : "Breeze to the left"),
                  systemImage: "wind")
                .font(.subheadline)
            Slider(value: $aim, in: 15...75) { Text("Aim angle") }
            Slider(value: $strength, in: 0.1...1) { Text("Spring strength") }
            if missed {
                Text("Try moving the dotted line to the planter.")
                    .font(.subheadline).foregroundStyle(SonaPalette.muted)
            }
            Button("Launch seed") {
                guard speechGameProgress?.isMoveActive != false else { return }
                guard abs(landing - target) < 0.07 else { missed = true; return }
                missed = false
                speechGameProgress?.advance()
                if planting == (speechGameProgress?.count ?? targets.count) - 1 { onFinish() }
                else { planting += 1 }
            }
            .buttonStyle(WorkshopAction())
        }
        .modifier(StoryMovePowerControls(power: power, title: "Calm breeze", id: "workshop-rooftops-help"))
    }
}

private struct ObservatoryRound: View {
    let onFinish: () -> Void
    @Environment(\.speechGameProgress) private var speechGameProgress
    @State private var selected = 0
    @State private var installed: Set<Int> = []
    @State private var wheelTurns = 0
    @State private var gearLocation: CGPoint?
    @StateObject private var power = StoryMovePower()
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
            gears
            Button("Turn the wheel · \(wheelTurns)/\(turnsNeeded)") {
                wheelTurns += 1
                speechGameProgress?.advance()
                if wheelTurns == turnsNeeded { onFinish() }
            }
            .buttonStyle(WorkshopAction())
            .disabled(installed.count < required.count)
        }
        .modifier(StoryMovePowerControls(power: power, title: "Bright edges", id: "workshop-observatory-help",
                                        enabled: gearLocation == nil && installed.count < required.count))
        .onChange(of: speechGameProgress?.isMoveActive) { _ in gearLocation = nil }
    }

    private var gears: some View {
        GeometryReader { geometry in
            let span = geometry.size.width / CGFloat(required.count)
            ZStack {
                ForEach(required.indices, id: \.self) { index in
                    socket(index).frame(width: max(0, span - 8), height: 79)
                        .position(socketCenter(index, span: span))
                }
                if installed.count < required.count {
                    Image(systemName: "gearshape.fill")
                        .font(.system(size: CGFloat(18 + 5 * selected), weight: .bold))
                        .foregroundStyle(SonaPalette.teal)
                        .frame(width: 50, height: 50)
                        .background(SonaPalette.yellow, in: Circle())
                        .position(gearLocation ?? CGPoint(x: geometry.size.width / 2, y: 121))
                        .gesture(DragGesture(minimumDistance: 3, coordinateSpace: .named("observatory-gears"))
                            .onChanged { gearLocation = $0.location }
                            .onEnded { end in
                                gearLocation = nil
                                guard let index = required.firstIndex(of: selected) else { return }
                                let socket = socketCenter(index, span: span)
                                let distance = hypot(end.location.x - socket.x, end.location.y - socket.y)
                                let radius = WorkshopPowerGeometry.gearCatch(young: speechGameProgress?.count == 5,
                                                                             powered: power.active)
                                if distance <= radius { install(index) }
                            })
                        .accessibilityLabel("\(names[selected]) gear")
                        .accessibilityHint("Drag it to its matching socket or tap the socket.")
                }
            }
            .coordinateSpace(name: "observatory-gears")
        }
        .frame(height: installed.count < required.count ? 150 : 87)
    }

    private func socketCenter(_ index: Int, span: CGFloat) -> CGPoint {
        CGPoint(x: (CGFloat(index) + 0.5) * span, y: 44)
    }

    private func socket(_ index: Int) -> some View {
        let filled = installed.contains(index)
        let useful = power.active && !filled && selected == required[index]
        return Button { install(index) } label: {
            VStack(spacing: 7) {
                Image(systemName: filled ? lights[index] : "gearshape")
                    .font(.system(size: CGFloat(25 + 8 * required[index]), weight: .bold))
                    .rotationEffect(.degrees(Double(wheelTurns) * 24))
                    .frame(height: 51)
                Text(names[required[index]]).font(.caption)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(filled ? SonaPalette.yellow : SonaPalette.mint, in: RoundedRectangle(cornerRadius: 16))
            .overlay {
                if useful {
                    RoundedRectangle(cornerRadius: 16).strokeBorder(SonaPalette.teal,
                        style: StrokeStyle(lineWidth: 3, dash: [4, 3]))
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(names[required[index]]) gear socket")
        .accessibilityValue(filled ? "Filled" : useful ? "Matching socket highlighted" : "Empty")
    }

    private func install(_ index: Int) {
        guard speechGameProgress?.isMoveActive != false,
              selected == required[index], installed.insert(index).inserted else { return }
        speechGameProgress?.advance()
    }
}

// BEGIN WORKSHOP_POWER_GEOMETRY
private enum WorkshopPowerGeometry {
    static func trainSpeed(powered: Bool) -> Double { powered ? 0.58 : 1 }
    static func trainBerth(young: Bool, powered: Bool) -> Double {
        (young ? 0.108 : 0.076) * (powered ? 1.12 : 1)
    }
    static func railJoin(young: Bool, powered: Bool) -> CGFloat {
        (young ? 17 : 12) * (powered ? 1.4 : 1)
    }
    static func stitchCatch(powered: Bool) -> CGFloat { 28 * (powered ? 1.45 : 1) }
    static func clothFlutter(powered: Bool) -> Double { 9 * (powered ? 0.08 : 1) }
    static func liftDamping(young: Bool, powered: Bool) -> Double {
        (young ? 3.5 : 1.8) + (powered ? 7 : 0)
    }
    static func concertPeriod(young: Bool, powered: Bool) -> Double {
        (young ? 1.02 : 0.84) * (powered ? 1.45 : 1)
    }
    static func concertWindow(young: Bool, powered: Bool) -> Double {
        min(0.42, (young ? 0.20 : 0.14) * (powered ? 1.65 : 1))
    }
    static func windScale(powered: Bool) -> Double { powered ? 0.22 : 1 }
    static func gearCatch(young: Bool, powered: Bool) -> CGFloat {
        (young ? 18 : 12) * (powered ? 1.65 : 1)
    }
}
// END WORKSHOP_POWER_GEOMETRY

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
