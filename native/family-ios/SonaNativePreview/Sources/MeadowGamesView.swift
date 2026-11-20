import SwiftUI
import UIKit
import Combine

enum MeadowGame: String, CaseIterable {
    case balloon, flower, rocket, snowman, train, stars, cake

    var title: String {
        switch self {
        case .balloon: return "Balloon Party"
        case .flower: return "Grow a Flower"
        case .rocket: return "Rocket Blast"
        case .snowman: return "Build a Snowman"
        case .train: return "Choo-Choo Train"
        case .stars: return "Bedtime Stars"
        case .cake: return "Birthday Cake"
        }
    }

    fileprivate var instruction: String {
        switch self {
        case .balloon: return "Pump it up. Pull it into the ring."
        case .flower: return "Hold each sprout to give it a drink."
        case .rocket: return "Pull the rocket back. Let it fly!"
        case .snowman: return "Roll a snowball. Lift it onto the snowman."
        case .train: return "Hold to drive. Let go at each station."
        case .stars: return "Follow the glowing star with your finger."
        case .cake: return "Stir the bowl, then decorate your cake."
        }
    }

    fileprivate var background: String {
        switch self {
        case .balloon: return "meadow-balloon-bg"
        case .flower: return "meadow-flower-bg"
        case .rocket: return "meadow-rocket-bg"
        case .snowman: return "meadow-snowman-bg"
        case .train: return "meadow-train-bg"
        case .stars: return "meadow-stars-bg"
        case .cake: return ""
        }
    }

    fileprivate var finish: String {
        switch self {
        case .balloon: return "Three balloons, up and away!"
        case .flower: return "Your garden is blooming!"
        case .rocket: return "Three planets explored!"
        case .snowman: return "A snowy new friend!"
        case .train: return "Everyone made it to the station!"
        case .stars: return "You lit up the night!"
        case .cake: return "Ready for a birthday!"
        }
    }
}

/// Finger-only development rounds. This view has no speech, rep, reward,
/// entitlement, persistence or network behavior. Release entry belongs to the app.
struct MeadowGamesView: View {
    let game: MeadowGame
    let onRoundFinished: () -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var roundID = UUID()
    @State private var finished = false

    init(game: MeadowGame, onRoundFinished: @escaping () -> Void = {}) {
        self.game = game
        self.onRoundFinished = onRoundFinished
    }

    var body: some View {
        GeometryReader { geometry in
            Group {
                if geometry.size.height < 490 || typeSize.isAccessibilitySize {
                    ScrollView { content(height: max(390, geometry.size.height - 150)) }
                } else {
                    content(height: max(290, geometry.size.height - 155))
                }
            }
            .frame(maxWidth: 700)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .foregroundStyle(MeadowStyle.ink)
        .background(MeadowStyle.cream.ignoresSafeArea())
        .preferredColorScheme(.light)
        .overlay { if finished { finishCard } }
    }

    private func content(height: CGFloat) -> some View {
        VStack(spacing: 12) {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.body.weight(.bold))
                        .frame(width: 46, height: 46)
                        .background(.white, in: Circle())
                }
                .accessibilityLabel("Back to games")
                .accessibilityIdentifier("nativeMeadowClose")
                Spacer()
            }
            VStack(spacing: 4) {
                Text(game.title)
                    .font(.system(.title, design: .rounded).weight(.heavy))
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityIdentifier("nativeMeadow-\(game.rawValue)")
                Text(game.instruction)
                    .font(.subheadline.weight(.medium))
                    .multilineTextAlignment(.center)
            }
            board.id(roundID)
                .disabled(finished)
                .accessibilityHidden(finished)
                .frame(maxWidth: .infinity)
                .frame(height: height)
                .background {
                    if !game.background.isEmpty {
                        Image(game.background)
                            .resizable().scaledToFill()
                            .allowsHitTesting(false)
                            .accessibilityHidden(true)
                    } else {
                        Color(red: 0.98, green: 0.90, blue: 0.93)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 28))
                .overlay {
                    RoundedRectangle(cornerRadius: 28).strokeBorder(.white.opacity(0.8), lineWidth: 3)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
        }
        .padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 12)
    }

    @ViewBuilder private var board: some View {
        switch game {
        case .balloon: MeadowBalloon(onComplete: complete)
        case .flower: MeadowFlower(onComplete: complete)
        case .rocket: MeadowRocket(onComplete: complete)
        case .snowman: MeadowSnowman(onComplete: complete)
        case .train: MeadowTrain(onComplete: complete)
        case .stars: MeadowStars(onComplete: complete)
        case .cake: MeadowCake(onComplete: complete)
        }
    }

    private var finishCard: some View {
        ZStack {
            Color.black.opacity(0.28).ignoresSafeArea().accessibilityHidden(true)
            VStack(spacing: 18) {
                Image(systemName: "sparkles")
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundStyle(MeadowStyle.teal).accessibilityHidden(true)
                Text(game.finish)
                    .font(.system(.title, design: .rounded).weight(.heavy))
                    .multilineTextAlignment(.center)
                MeadowButton(title: "Play again", symbol: "arrow.clockwise") {
                    finished = false
                    roundID = UUID()
                }
                .accessibilityIdentifier("nativeMeadowReplay")
                Button("Back to games") { dismiss() }
                    .font(.body.weight(.semibold)).frame(minHeight: 44)
                    .accessibilityIdentifier("nativeMeadowHome")
            }
            .padding(26).frame(maxWidth: 370)
            .background(MeadowStyle.cream, in: RoundedRectangle(cornerRadius: 28))
            .padding(24)
            .accessibilityAddTraits(.isModal)
            .accessibilityIdentifier("nativeMeadowFinish")
        }
    }

    private func complete() {
        guard !finished else { return }
        finished = true
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        onRoundFinished()
    }
}

private enum MeadowStyle {
    static let ink = Color(red: 0.20, green: 0.18, blue: 0.25)
    static let teal = Color(red: 0.04, green: 0.46, blue: 0.49)
    static let cream = Color(red: 1, green: 0.98, blue: 0.94)
    static func tick() { UIImpactFeedbackGenerator(style: .light).impactOccurred(intensity: 0.65) }
}

private struct MeadowButton: View {
    let title: String
    var symbol: String = "hand.tap.fill"
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .font(.system(.body, design: .rounded).weight(.bold))
                .frame(maxWidth: .infinity, minHeight: 50)
                .padding(.horizontal, 12)
                .foregroundStyle(.white)
                .background(MeadowStyle.teal, in: RoundedRectangle(cornerRadius: 17))
        }
        .buttonStyle(.plain)
    }
}

private struct MeadowCaption: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.system(.subheadline, design: .rounded).weight(.bold))
            .multilineTextAlignment(.center)
            .padding(.horizontal, 14).padding(.vertical, 9)
            .background(.white.opacity(0.96), in: RoundedRectangle(cornerRadius: 15))
            .padding(12).allowsHitTesting(false)
    }
}

private struct MeadowBalloon: View {
    let onComplete: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pumps = 0
    @State private var delivered = 0
    @State private var offset = CGSize.zero

    var body: some View {
        GeometryReader { geo in
            let home = CGPoint(x: geo.size.width * 0.29, y: geo.size.height * 0.48)
            let ring = CGPoint(x: geo.size.width * 0.73, y: geo.size.height * 0.23)
            ZStack(alignment: .top) {
                Circle().strokeBorder(.white, lineWidth: 11)
                    .background(Circle().fill(MeadowStyle.teal.opacity(0.22)))
                    .frame(width: 112, height: 112).position(ring)
                    .accessibilityHidden(true)
                Image("meadow-balloon")
                    .resizable().scaledToFit()
                    .frame(width: CGFloat(48 + pumps * 8), height: CGFloat(85 + pumps * 12))
                    .position(x: home.x + offset.width, y: home.y + offset.height)
                    .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                        guard pumps == 6 else { return }
                        offset = value.translation
                    }.onEnded { _ in
                        guard pumps == 6 else { return }
                        let end = CGPoint(x: home.x + offset.width, y: home.y + offset.height)
                        if MeadowGeometry.distance(end, ring) < 70 { deliver() }
                        else { withAnimation(reduceMotion ? nil : .spring(response: 0.35)) { offset = .zero } }
                    })
                    .accessibilityLabel(pumps == 6 ? "Full balloon. Drag to the ring." : "Balloon, \(pumps) of 6 pumps")
                    .accessibilityAction(named: "Move balloon into ring") { if pumps == 6 { deliver() } }
                    .accessibilityIdentifier("meadow-balloon-drag")
                VStack {
                    MeadowCaption(text: pumps < 6 ? "\(delivered + 1) of 3 · Tap the pump" : "Pull your balloon into the ring")
                    Spacer()
                    Button {
                        guard pumps < 6 else { return }
                        pumps += 1
                        MeadowStyle.tick()
                    } label: {
                        VStack(spacing: 4) {
                            Image("meadow-pump").resizable().scaledToFit().frame(width: 78, height: 113)
                            Text(pumps < 6 ? "Pump · \(pumps)/6" : "All filled up!")
                                .font(.system(.body, design: .rounded).weight(.bold))
                                .padding(8).background(.white, in: Capsule())
                        }
                        .frame(minWidth: 110, minHeight: 145)
                    }
                    .buttonStyle(.plain).disabled(pumps == 6)
                    .accessibilityLabel("Pump balloon, \(pumps) of 6")
                    .accessibilityIdentifier("meadow-balloon-pump")
                    .padding(.bottom, 12)
                }
            }
        }
    }

    private func deliver() {
        guard pumps == 6 else { return }
        delivered += 1
        pumps = 0
        offset = .zero
        MeadowStyle.tick()
        if delivered == 3 { onComplete() }
    }
}

private struct MeadowFlower: View {
    let onComplete: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @State private var water = [Double](repeating: 0, count: 3)
    @State private var watering: Int?
    @State private var previousTick: Date?
    private let clock = Timer.publish(every: 1.0 / 30, on: .main, in: .common).autoconnect()

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .top) {
                MeadowCaption(text: "\(water.filter { $0 >= 1 }.count) of 3 flowers blooming")
                ForEach(0..<3) { index in
                    let x = geo.size.width * (0.18 + CGFloat(index) * 0.32)
                    let y = geo.size.height * (index == 1 ? 0.58 : 0.68)
                    VStack(spacing: 6) {
                        Image(water[index] >= 1 ? "meadow-bloom" : "meadow-sprout")
                            .resizable().scaledToFit().frame(width: geo.size.width * 0.29, height: 140)
                        ProgressView(value: water[index]).tint(MeadowStyle.teal).frame(width: 64)
                    }
                    .padding(.vertical, 15).contentShape(Rectangle())
                    .position(x: x, y: y)
                    .gesture(DragGesture(minimumDistance: 0).onChanged { _ in
                        if water[index] < 1 { watering = index }
                    }.onEnded { _ in watering = nil; previousTick = nil })
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Flower \(index + 1), \(Int(water[index] * 100)) percent watered")
                    .accessibilityAction(named: "Water flower") { addWater(index, amount: 0.25) }
                    .accessibilityIdentifier("meadow-flower-\(index)")
                }
                if let index = watering, water[index] < 1 {
                    Image("meadow-can").resizable().scaledToFit().frame(width: 104, height: 100)
                        .position(x: geo.size.width * (0.25 + CGFloat(index) * 0.27), y: geo.size.height * 0.34)
                        .allowsHitTesting(false).accessibilityHidden(true)
                }
                VStack { Spacer(); MeadowCaption(text: "Hold a sprout until it blooms") }
            }
        }
        .onReceive(clock) { now in
            guard scenePhase == .active, let index = watering else { previousTick = nil; return }
            let dt = min(0.06, now.timeIntervalSince(previousTick ?? now))
            previousTick = now
            addWater(index, amount: dt / 1.6)
        }
        .onChange(of: scenePhase) { _ in watering = nil; previousTick = nil }
        .onDisappear { watering = nil; previousTick = nil }
    }

    private func addWater(_ index: Int, amount: Double) {
        guard water[index] < 1 else { return }
        water[index] = min(1, water[index] + amount)
        if water[index] >= 1 {
            watering = nil
            MeadowStyle.tick()
            if water.allSatisfy({ $0 >= 1 }) { onComplete() }
        }
    }
}

private struct MeadowRocket: View {
    let onComplete: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var planets = 0
    @State private var misses = 0
    @State private var pull = CGSize.zero
    @State private var flight: CGPoint?
    @State private var flying = false
    @State private var flightTask: Task<Void, Never>?

    var body: some View {
        GeometryReader { geo in
            let start = CGPoint(x: geo.size.width * 0.5, y: geo.size.height * 0.73)
            let target = CGPoint(x: geo.size.width * [0.5, 0.29, 0.71][min(planets, 2)], y: geo.size.height * 0.22)
            ZStack(alignment: .top) {
                Image("meadow-planet").resizable().scaledToFit().frame(width: 120, height: 120).position(target)
                    .accessibilityHidden(true)
                if pull.height > 10 || misses > 0 {
                    Path { path in path.move(to: start); path.addLine(to: predicted(start: start, pull: pull, size: geo.size, target: target)) }
                        .stroke(.white.opacity(0.8), style: StrokeStyle(lineWidth: 3, dash: [5, 8]))
                        .allowsHitTesting(false)
                }
                Image("meadow-rocket").resizable().scaledToFit().frame(width: 78, height: 120)
                    .position(flight ?? CGPoint(x: start.x + pull.width, y: start.y + pull.height))
                    .gesture(DragGesture(minimumDistance: 2).onChanged { value in
                        guard !flying else { return }
                        pull = CGSize(width: max(-75, min(75, value.translation.width)), height: max(0, min(100, value.translation.height)))
                    }.onEnded { _ in
                        guard !flying, pull.height > 18 else { pull = .zero; return }
                        launch(start: start, end: predicted(start: start, pull: pull, size: geo.size, target: target), target: target)
                    })
                    .accessibilityLabel("Rocket. Pull down to aim, then release.")
                    .accessibilityAction(named: "Launch toward the planet") { launch(start: start, end: target, target: target) }
                    .accessibilityIdentifier("meadow-rocket-launch")
                MeadowCaption(text: "\(planets) of 3 planets · \(misses == 0 ? "Pull down to aim" : "Try the dotted path")")
                VStack { Spacer(); MeadowCaption(text: "Pull away from the planet, then let go") }
            }
        }
        .onDisappear { flightTask?.cancel(); flightTask = nil }
        .onChange(of: scenePhase) { phase in
            if phase != .active {
                flightTask?.cancel()
                flightTask = nil
                flying = false
                flight = nil
                pull = .zero
            }
        }
    }

    private func predicted(start: CGPoint, pull: CGSize, size: CGSize, target: CGPoint) -> CGPoint {
        if misses >= 2 { return target }
        return CGPoint(x: min(size.width - 25, max(25, start.x - pull.width * 3.5)),
                       y: max(40, start.y - pull.height * 4.2))
    }

    private func launch(start: CGPoint, end: CGPoint, target: CGPoint) {
        guard !flying else { return }
        flying = true
        flight = start
        pull = .zero
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.65)) { flight = end }
        flightTask = Task { @MainActor in
            do { try await Task.sleep(nanoseconds: reduceMotion ? 120_000_000 : 700_000_000) }
            catch { return }
            guard !Task.isCancelled else { return }
            if MeadowGeometry.distance(end, target) < (misses > 0 ? 95 : 72) {
                planets += 1
                misses = 0
                MeadowStyle.tick()
            } else { misses += 1 }
            flying = false
            flight = nil
            if planets == 3 { onComplete() }
        }
    }
}

private struct MeadowSnowman: View {
    let onComplete: () -> Void
    @State private var stacked = 0
    @State private var travel: CGFloat = 0
    @State private var offset = CGSize.zero
    @State private var previous = CGSize.zero

    var body: some View {
        GeometryReader { geo in
            let home = CGPoint(x: geo.size.width * 0.23, y: geo.size.height * 0.84)
            let targets = [CGPoint(x: geo.size.width * 0.58, y: geo.size.height * 0.67),
                           CGPoint(x: geo.size.width * 0.58, y: geo.size.height * 0.47),
                           CGPoint(x: geo.size.width * 0.58, y: geo.size.height * 0.31)]
            let diameters: [CGFloat] = [118, 92, 70]
            ZStack(alignment: .top) {
                MeadowCaption(text: travel < 180 ? "Roll your snowball · \(stacked) of 3 stacked" : "Lift it onto the glowing spot")
                ForEach(0..<3) { index in
                    if index < stacked {
                        Image("meadow-snowball").resizable().scaledToFit()
                            .frame(width: diameters[index], height: diameters[index]).position(targets[index])
                    } else if index == stacked {
                        Circle().strokeBorder(MeadowStyle.teal, style: StrokeStyle(lineWidth: 4, dash: [6, 5]))
                            .background(Circle().fill(.white.opacity(0.5)))
                            .frame(width: diameters[index], height: diameters[index]).position(targets[index])
                    }
                }.accessibilityHidden(true)
                if stacked < 3 {
                    Image("meadow-snowball").resizable().scaledToFit()
                        .frame(width: 44 + min(1, travel / 180) * 48, height: 44 + min(1, travel / 180) * 48)
                        .position(x: home.x + offset.width, y: home.y + offset.height)
                        .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                            travel = min(180, travel + hypot(value.translation.width - previous.width, value.translation.height - previous.height))
                            previous = value.translation
                            offset = value.translation
                        }.onEnded { _ in
                            let end = CGPoint(x: home.x + offset.width, y: home.y + offset.height)
                            if travel >= 180 && MeadowGeometry.distance(end, targets[stacked]) < diameters[stacked] * 0.65 { stack() }
                            offset = .zero
                            previous = .zero
                        })
                        .accessibilityLabel("Snowball, \(Int(min(1, travel / 180) * 100)) percent rolled")
                        .accessibilityAction(named: "Roll snowball") { travel = min(180, travel + 60) }
                        .accessibilityAction(named: "Stack snowball") { if travel >= 180 { stack() } }
                        .accessibilityIdentifier("meadow-snowman-ball")
                }
            }
        }
    }

    private func stack() {
        guard stacked < 3 else { return }
        stacked += 1
        travel = 0
        offset = .zero
        MeadowStyle.tick()
        if stacked == 3 { onComplete() }
    }
}

private struct MeadowTrain: View {
    let onComplete: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @State private var position = 0.08
    @State private var station = 0
    @State private var driving = false
    @State private var misses = 0
    @State private var previousTick: Date?
    private let stops = [0.30, 0.57, 0.84]
    private let clock = Timer.publish(every: 1.0 / 30, on: .main, in: .common).autoconnect()

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .top) {
                MeadowCaption(text: "\(station) of 3 stations · \(driving ? "Let go at the flag" : "Hold the drive button")")
                Path { path in
                    path.move(to: CGPoint(x: 0, y: geo.size.height * 0.63))
                    path.addLine(to: CGPoint(x: geo.size.width, y: geo.size.height * 0.63))
                }.stroke(MeadowStyle.ink.opacity(0.7), style: StrokeStyle(lineWidth: 9, dash: [4, 9]))
                ForEach(0..<3) { index in
                    VStack(spacing: 8) {
                        Image(systemName: index < station ? "checkmark.circle.fill" : "flag.fill")
                            .font(.system(size: 31, weight: .bold))
                        Text("\(index + 1)").font(.caption.bold())
                    }
                    .foregroundStyle(index <= station ? MeadowStyle.teal : .gray)
                    .padding(9).background(.white.opacity(index == station ? 1 : 0.7), in: RoundedRectangle(cornerRadius: 12))
                    .position(x: 50 + (geo.size.width - 100) * stops[index], y: geo.size.height * 0.38)
                    .accessibilityHidden(true)
                }
                Image("meadow-train").resizable().scaledToFit().frame(width: 126, height: 106)
                    .position(x: 50 + (geo.size.width - 100) * position, y: geo.size.height * 0.55)
                    .accessibilityHidden(true)
                VStack {
                    Spacer()
                    Text("Hold to drive").font(.system(.title3, design: .rounded).weight(.bold))
                        .foregroundStyle(.white).frame(maxWidth: .infinity, minHeight: 70)
                        .background(driving ? MeadowStyle.teal.opacity(0.75) : MeadowStyle.teal, in: RoundedRectangle(cornerRadius: 22))
                        .contentShape(RoundedRectangle(cornerRadius: 22))
                        .gesture(DragGesture(minimumDistance: 0).onChanged { _ in driving = true }.onEnded { _ in stop() })
                        .accessibilityAddTraits(.isButton)
                        .accessibilityLabel("Drive train. Stop at station \(min(station + 1, 3)).")
                        .accessibilityAction { nudge() }
                        .accessibilityIdentifier("meadow-train-drive")
                    Button("Brake") { stop() }.font(.body.bold()).frame(minHeight: 44)
                        .accessibilityIdentifier("meadow-train-brake")
                }.padding(16)
            }
        }
        .onReceive(clock) { now in
            guard scenePhase == .active, driving, station < 3 else { previousTick = nil; return }
            let dt = min(0.06, now.timeIntervalSince(previousTick ?? now))
            previousTick = now
            advance(dt * (misses > 0 ? 0.10 : 0.14))
        }
        .onChange(of: scenePhase) { _ in driving = false; previousTick = nil }
        .onDisappear { driving = false; previousTick = nil }
    }

    private func advance(_ amount: Double) {
        guard station < 3 else { return }
        position += amount
        if position > stops[station] + 0.08 {
            driving = false
            misses += 1
            position = max(0.08, stops[station] - 0.20)
        }
    }

    private func nudge() {
        guard station < 3 else { return }
        advance(0.03)
        if abs(position - stops[station]) < 0.05 { stop() }
    }

    private func stop() {
        driving = false
        previousTick = nil
        guard station < 3, abs(position - stops[station]) < (misses > 0 ? 0.075 : 0.055) else { return }
        position = stops[station]
        station += 1
        misses = 0
        MeadowStyle.tick()
        if station == 3 { onComplete() }
    }
}

private struct MeadowStars: View {
    let onComplete: () -> Void
    @State private var picture = 0
    @State private var connected = 0
    @State private var lastTouch: CGPoint?
    private let pictures: [[CGPoint]] = [
        [CGPoint(x: 0.18, y: 0.65), CGPoint(x: 0.50, y: 0.25), CGPoint(x: 0.82, y: 0.65), CGPoint(x: 0.18, y: 0.65)],
        [CGPoint(x: 0.20, y: 0.70), CGPoint(x: 0.20, y: 0.42), CGPoint(x: 0.50, y: 0.20), CGPoint(x: 0.80, y: 0.42), CGPoint(x: 0.80, y: 0.70), CGPoint(x: 0.20, y: 0.70)],
        [CGPoint(x: 0.50, y: 0.18), CGPoint(x: 0.82, y: 0.48), CGPoint(x: 0.50, y: 0.80), CGPoint(x: 0.18, y: 0.48), CGPoint(x: 0.50, y: 0.18)]
    ]
    private let names = ["A mountain!", "A little house!", "A bright kite!"]

    var body: some View {
        GeometryReader { geo in
            let points = pictures[picture].map { CGPoint(x: $0.x * geo.size.width, y: $0.y * geo.size.height) }
            let done = connected == points.count
            ZStack(alignment: .top) {
                Path { path in
                    guard connected > 0 else { return }
                    path.move(to: points[0])
                    for point in points.prefix(connected).dropFirst() { path.addLine(to: point) }
                }.stroke(Color.yellow, style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round))
                ForEach(Array(points.enumerated()), id: \.offset) { index, point in
                    Image(systemName: "star.fill")
                        .font(.system(size: index == connected ? 32 : 22))
                        .foregroundStyle(index <= connected ? Color.yellow : Color.white.opacity(0.55))
                        .padding(9).background(Circle().fill(index == connected ? .white.opacity(0.18) : .clear))
                        .position(point).accessibilityHidden(true)
                }
                Rectangle().fill(.clear).contentShape(Rectangle())
                    .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                        guard connected < points.count else { return }
                        let previous = lastTouch ?? value.location
                        var next = connected
                        while next < points.count && MeadowGeometry.segmentDistance(points[next], from: previous, to: value.location) < 32 { next += 1 }
                        if next != connected { connected = next; MeadowStyle.tick() }
                        lastTouch = value.location
                    }.onEnded { _ in lastTouch = nil })
                    .accessibilityLabel("Trace picture \(picture + 1). \(connected) of \(points.count) stars connected.")
                    .accessibilityAction(named: "Connect next star") { if !done { connected += 1; MeadowStyle.tick() } }
                    .accessibilityIdentifier("meadow-stars-trace")
                MeadowCaption(text: done ? names[picture] : "Picture \(picture + 1) of 3 · Follow the glowing star")
                if done {
                    VStack { Spacer(); MeadowButton(title: picture == 2 ? "All lit up!" : "Next picture", symbol: "star.fill") {
                        if picture == 2 { onComplete() }
                        else { picture += 1; connected = 0; lastTouch = nil }
                    }.padding(16) }
                    .accessibilityIdentifier("meadow-stars-next")
                }
            }
        }
    }
}

private struct MeadowCake: View {
    let onComplete: () -> Void
    @State private var stage = 0
    @State private var stirred: CGFloat = 0
    @State private var lastAngle: CGFloat?
    @State private var spoonAngle: CGFloat = 0
    @State private var decorations: Set<Int> = []
    @State private var candles: Set<Int> = []

    var body: some View {
        GeometryReader { geo in
            let center = CGPoint(x: geo.size.width * 0.5, y: geo.size.height * 0.53)
            ZStack(alignment: .top) {
                MeadowCaption(text: stage == 0 ? "Stir in big circles" : (stage == 1 ? "Add six stars to the icing" : "Place three birthday candles"))
                if stage == 0 {
                    Image("meadow-bowl").resizable().scaledToFit()
                        .frame(width: geo.size.width * 0.9, height: geo.size.height * 0.55).position(center)
                        .accessibilityHidden(true)
                    Image("meadow-spoon").resizable().scaledToFit().frame(width: 72, height: 158)
                        .rotationEffect(.radians(Double(spoonAngle) + .pi / 4))
                        .position(x: center.x + cos(spoonAngle) * 50, y: center.y + sin(spoonAngle) * 32)
                        .allowsHitTesting(false).accessibilityHidden(true)
                    Circle().fill(.clear).contentShape(Circle()).frame(width: geo.size.width * 0.94, height: geo.size.width * 0.94)
                        .position(center)
                        .gesture(DragGesture(minimumDistance: 0, coordinateSpace: .named("meadow-cake-board")).onChanged { value in
                            let dx = value.location.x - center.x, dy = value.location.y - center.y
                            guard hypot(dx, dy) > 25 else { lastAngle = nil; return }
                            let angle = atan2(dy, dx)
                            if let previous = lastAngle {
                                let delta = MeadowGeometry.angleDifference(angle, previous)
                                if abs(delta) < .pi / 2 { stir(abs(delta)) }
                            }
                            lastAngle = angle
                            spoonAngle = angle
                        }.onEnded { _ in lastAngle = nil })
                        .accessibilityLabel("Mixing bowl. Stir in circles.")
                        .accessibilityAction(named: "Stir a quarter turn") { stir(.pi / 2) }
                        .accessibilityIdentifier("meadow-cake-stir")
                    VStack { Spacer(); ProgressView(value: Double(stirred), total: Double(4 * CGFloat.pi))
                        .tint(MeadowStyle.teal).padding(24).background(.white.opacity(0.9), in: Capsule()).padding(20) }
                } else {
                    Image("meadow-cake").resizable().scaledToFit()
                        .frame(width: geo.size.width * 0.9, height: geo.size.height * 0.55).position(center)
                        .accessibilityHidden(true)
                    ForEach(0..<6) { index in
                        let angle = CGFloat(index) * .pi / 3
                        let point = CGPoint(x: center.x + cos(angle) * geo.size.width * 0.27,
                                            y: center.y - 30 + sin(angle) * geo.size.width * 0.12)
                        Button {
                            guard stage == 1, !decorations.contains(index) else { return }
                            decorations.insert(index)
                            MeadowStyle.tick()
                            if decorations.count == 6 { stage = 2 }
                        } label: {
                            Image(systemName: decorations.contains(index) ? "star.fill" : "plus.circle.fill")
                                .font(.system(size: decorations.contains(index) ? 29 : 25))
                                .foregroundStyle(decorations.contains(index) ? Color(red: 0.75, green: 0.20, blue: 0.42) : MeadowStyle.teal)
                                .frame(width: 48, height: 48)
                                .background(Circle().fill(.white.opacity(decorations.contains(index) ? 0 : 0.85)))
                        }
                        .buttonStyle(.plain).position(point)
                        .accessibilityLabel("Icing star \(index + 1)\(decorations.contains(index) ? ", placed" : "")")
                        .accessibilityIdentifier("meadow-cake-star-\(index)")
                    }
                    if stage == 2 {
                        ForEach(0..<3) { index in
                            Button {
                                guard !candles.contains(index) else { return }
                                candles.insert(index)
                                MeadowStyle.tick()
                                if candles.count == 3 { onComplete() }
                            } label: {
                                VStack(spacing: 0) {
                                    Image(systemName: candles.contains(index) ? "flame.fill" : "plus.circle.fill")
                                        .font(.system(size: 23)).foregroundStyle(candles.contains(index) ? .yellow : MeadowStyle.teal)
                                    RoundedRectangle(cornerRadius: 4).fill(Color(red: 0.42, green: 0.37, blue: 0.73))
                                        .frame(width: 11, height: 42)
                                }.frame(width: 48, height: 76)
                            }
                            .buttonStyle(.plain)
                            .position(x: center.x + CGFloat(index - 1) * 48, y: center.y - 65)
                            .accessibilityLabel("Birthday candle \(index + 1)\(candles.contains(index) ? ", placed" : "")")
                            .accessibilityIdentifier("meadow-cake-candle-\(index)")
                        }
                    }
                }
            }
            .coordinateSpace(name: "meadow-cake-board")
        }
    }

    private func stir(_ amount: CGFloat) {
        guard stage == 0 else { return }
        stirred += amount
        if stirred >= 4 * .pi { stage = 1; lastAngle = nil; MeadowStyle.tick() }
    }
}

private enum MeadowGeometry {
    static func distance(_ a: CGPoint, _ b: CGPoint) -> CGFloat { hypot(a.x - b.x, a.y - b.y) }

    static func segmentDistance(_ point: CGPoint, from a: CGPoint, to b: CGPoint) -> CGFloat {
        let dx = b.x - a.x, dy = b.y - a.y
        let lengthSquared = dx * dx + dy * dy
        guard lengthSquared > 0 else { return distance(point, a) }
        let t = min(1, max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
        return distance(point, CGPoint(x: a.x + t * dx, y: a.y + t * dy))
    }

    static func angleDifference(_ a: CGFloat, _ b: CGFloat) -> CGFloat {
        var difference = a - b
        while difference > .pi { difference -= 2 * .pi }
        while difference < -.pi { difference += 2 * .pi }
        return difference
    }
}
