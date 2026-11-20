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
    @Environment(\.speechGameProgress) private var speechGameProgress
    @Environment(\.guidedReplay) private var guidedReplay
    @State private var roundID = UUID()
    @State private var finished = false
    @State private var completedMoves = 0
    private var goal: Int { max(1, speechGameProgress?.count ?? 3) }

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
        case .balloon: MeadowBalloon(goal: goal, onMove: successfulMove, onComplete: complete)
        case .flower: MeadowFlower(goal: goal, onMove: successfulMove, onComplete: complete)
        case .rocket: MeadowRocket(goal: goal, onMove: successfulMove, onComplete: complete)
        case .snowman: MeadowSnowman(goal: goal, onMove: successfulMove, onComplete: complete)
        case .train: MeadowTrain(goal: goal, onMove: successfulMove, onComplete: complete)
        case .stars: MeadowStars(goal: goal, guided: speechGameProgress != nil, onMove: successfulMove, onComplete: complete)
        case .cake: MeadowCake(goal: goal, guided: speechGameProgress != nil, onMove: successfulMove, onComplete: complete)
        }
    }

    private var finishCard: some View {
        ZStack {
            Color.black.opacity(0.28).ignoresSafeArea().accessibilityHidden(true)
            VStack(spacing: 18) {
                Image(systemName: "sparkles")
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundStyle(MeadowStyle.teal).accessibilityHidden(true)
                Text(speechGameProgress == nil ? game.finish : game == .balloon ? "Balloons, up and away!" : game == .rocket ? "Every planet explored!" : game.finish)
                    .font(.system(.title, design: .rounded).weight(.heavy))
                    .multilineTextAlignment(.center)
                if speechGameProgress == nil || guidedReplay != nil {
                    MeadowButton(title: "Play again", symbol: "arrow.clockwise") {
                        if let guidedReplay { guidedReplay() }
                        else { finished = false; completedMoves = 0; roundID = UUID() }
                    }
                    .accessibilityIdentifier("nativeMeadowReplay")
                }
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

    private func successfulMove() {
        guard !finished, completedMoves < goal else { return }
        completedMoves += 1
        speechGameProgress?.advance()
        if speechGameProgress != nil, completedMoves == goal { complete() }
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

// BEGIN MEADOW_HELP_POLICY
private final class MeadowOptionalPower: ObservableObject {
    @Published private(set) var remaining = 0.0
    private(set) var armed = true
    var active: Bool { remaining > 0 }
    func grant(waitForTouch: Bool = false) { remaining = 10; armed = !waitForTouch }
    func touch() { armed = true }
    func clear() { remaining = 0 }
    func tick(_ delta: Double, canAdvance: Bool, maximumDelta: Double = 0.05) {
        guard canAdvance, armed, delta.isFinite, delta >= 0 else { return }
        remaining = max(0, remaining - min(maximumDelta, delta))
    }
}
private enum MeadowHelpPhysics {
    static func pumpIncrement(powered: Bool) -> Int { powered ? 2 : 1 }
    static func balloonRingScale(powered: Bool) -> CGFloat { powered ? 1.3 : 1 }
    static func rocketRadius(base: CGFloat, powered: Bool) -> CGFloat { powered ? base * (0.125 / 0.085) : base }
    static func snowGrowth(powered: Bool) -> CGFloat { powered ? 2 : 1 }
    static func snowMagnet(base: CGFloat, accessory: Bool, powered: Bool) -> CGFloat {
        powered ? base * (accessory ? 1.2 / 0.85 : 0.85 / 0.6) : base
    }
    static func starReach(base: CGFloat, powered: Bool) -> CGFloat { powered ? base * (0.085 / 0.05) : base }
    static func stirGain(powered: Bool) -> CGFloat { powered ? 1.7 : 1 }
    static func cakeCatch(base: CGFloat, width: CGFloat, candles: Bool, powered: Bool) -> CGFloat {
        base + (powered ? width * (candles ? 0.08 - 0.045 : 0.05 - 0.01) : 0)
    }
}
// END MEADOW_HELP_POLICY

private struct MeadowHelpControls: ViewModifier {
    @ObservedObject var power: MeadowOptionalPower
    let title: String
    let id: String
    var enabled = true
    var waitForTouch = false
    var maximumDelta = 0.05
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.speechGameProgress) private var speechGameProgress
    @State private var previous: Date?
    @State private var visible = false
    private let clock = Timer.publish(every: 1.0 / 30, on: .main, in: .common).autoconnect()
    func body(content: Content) -> some View {
        content.safeAreaInset(edge: .bottom, spacing: 0) {
            if let request = speechGameProgress?.requestHelp {
                HStack(spacing: 12) {
                    Button(title) { guard enabled else { return }; _ = request { earned in if earned { power.grant(waitForTouch: waitForTouch) } } }
                        .buttonStyle(.bordered).frame(minHeight: 46)
                        .disabled(!enabled)
                        .accessibilityLabel("Extra help: say your word for " + title.lowercased())
                        .accessibilityIdentifier(id)
                    if power.active {
                        ProgressView(value: power.remaining, total: 10).tint(MeadowStyle.teal)
                            .accessibilityLabel(title + " remaining")
                    }
                }.font(.system(.subheadline, design: .rounded).weight(.bold))
                .padding(.horizontal, 12).background(.white.opacity(0.94))
                .accessibilityElement(children: .contain)
            }
        }
        .onReceive(clock) { now in
            let active = visible && scenePhase == .active && isEnabled && speechGameProgress?.isMoveActive == true && speechGameProgress?.isHelpActive != true
            guard active else { previous = nil; return }
            let delta = now.timeIntervalSince(previous ?? now); previous = now
            power.tick(delta, canAdvance: active, maximumDelta: maximumDelta)
        }
        .onAppear { visible = true; previous = nil }
        .onChange(of: scenePhase) { _ in previous = nil }
        .onChange(of: speechGameProgress?.isMoveActive) { _ in previous = nil }
        .onChange(of: speechGameProgress?.isHelpActive) { _ in previous = nil }
        .onDisappear { visible = false; previous = nil }
    }
}

private struct MeadowBalloon: View {
    let goal: Int
    let onMove: () -> Void
    let onComplete: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var power = MeadowOptionalPower()
    @GestureState private var dragging = false
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
                    .frame(width: 112 * MeadowHelpPhysics.balloonRingScale(powered: power.active), height: 112 * MeadowHelpPhysics.balloonRingScale(powered: power.active)).position(ring)
                    .accessibilityHidden(true)
                Image("meadow-balloon")
                    .resizable().scaledToFit()
                    .frame(width: CGFloat(48 + pumps * 8), height: CGFloat(85 + pumps * 12))
                    .position(x: home.x + offset.width, y: home.y + offset.height)
                    .gesture(DragGesture(minimumDistance: 0).updating($dragging) { _, active, _ in active = true }.onChanged { value in
                        guard pumps == 6 else { return }
                        offset = value.translation
                    }.onEnded { _ in
                        guard pumps == 6 else { return }
                        let end = CGPoint(x: home.x + offset.width, y: home.y + offset.height)
                        if MeadowGeometry.distance(end, ring) < 70 * MeadowHelpPhysics.balloonRingScale(powered: power.active) { deliver() }
                        else { withAnimation(reduceMotion ? nil : .spring(response: 0.35)) { offset = .zero } }
                    })
                    .accessibilityLabel(pumps == 6 ? "Full balloon. Drag to the ring." : "Balloon, \(pumps) of 6 pumps")
                    .accessibilityAction(named: "Move balloon into ring") { if pumps == 6 { deliver() } }
                    .accessibilityIdentifier("meadow-balloon-drag")
                VStack {
                    MeadowCaption(text: pumps < 6 ? "\(min(delivered + 1, goal)) of \(goal) · Tap the pump" : "Pull your balloon into the ring")
                    Spacer()
                    Button {
                        guard pumps < 6 else { return }
                        pumps = min(6, pumps + MeadowHelpPhysics.pumpIncrement(powered: power.active))
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
        .modifier(MeadowHelpControls(power: power, title: pumps < 6 ? "Big pumps" : "Big ring", id: "meadow-balloon-help", enabled: !dragging))
        .accessibilityElement(children: .contain)
    }

    private func deliver() {
        guard pumps == 6, delivered < goal else { return }
        delivered += 1
        power.clear()
        pumps = 0
        offset = .zero
        MeadowStyle.tick()
        onMove()
        if delivered == goal { onComplete() }
    }
}

private struct MeadowFlower: View {
    let onMove: () -> Void
    let onComplete: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @State private var water: [Double]
    @State private var watering: Int?
    @State private var previousTick: Date?
    private let clock = Timer.publish(every: 1.0 / 30, on: .main, in: .common).autoconnect()

    init(goal: Int, onMove: @escaping () -> Void, onComplete: @escaping () -> Void) {
        self.onMove = onMove; self.onComplete = onComplete
        _water = State(initialValue: [Double](repeating: 0, count: goal))
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .top) {
                MeadowCaption(text: "\(water.filter { $0 >= 1 }.count) of \(water.count) flowers blooming")
                ForEach(water.indices, id: \.self) { index in
                    let x = geo.size.width * (water.count <= 3 ? (0.18 + CGFloat(index) * 0.32) : (0.18 + CGFloat(index % 3) * 0.32))
                    let y = geo.size.height * (water.count <= 3 ? (index == 1 ? 0.58 : 0.68) : (0.35 + CGFloat(index / 3) * 0.34))
                    VStack(spacing: 6) {
                        Image(water[index] >= 1 ? "meadow-bloom" : "meadow-sprout")
                            .resizable().scaledToFit().frame(width: geo.size.width * (water.count <= 3 ? 0.29 : 0.26), height: water.count <= 3 ? 140 : 90)
                        ProgressView(value: water[index]).tint(MeadowStyle.teal).frame(width: 64)
                    }
                    .padding(.vertical, water.count <= 3 ? 15 : 10).contentShape(Rectangle())
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
                        .position(x: min(geo.size.width - 52, geo.size.width * (0.25 + CGFloat(index % 3) * 0.27)), y: geo.size.height * (water.count <= 3 ? 0.34 : 0.18 + CGFloat(index / 3) * 0.34))
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
            onMove()
            if water.allSatisfy({ $0 >= 1 }) { onComplete() }
        }
    }
}

private struct MeadowRocket: View {
    let goal: Int
    let onMove: () -> Void
    let onComplete: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var power = MeadowOptionalPower()
    @GestureState private var dragging = false
    @State private var planets = 0
    @State private var misses = 0
    @State private var pull = CGSize.zero
    @State private var flight: CGPoint?
    @State private var flying = false
    @State private var flightTask: Task<Void, Never>?

    var body: some View {
        GeometryReader { geo in
            let start = CGPoint(x: geo.size.width * 0.5, y: geo.size.height * 0.73)
            let target = CGPoint(x: geo.size.width * [0.5, 0.29, 0.71][planets % 3], y: geo.size.height * 0.22)
            ZStack(alignment: .top) {
                Image("meadow-planet").resizable().scaledToFit().frame(width: MeadowHelpPhysics.rocketRadius(base: 120, powered: power.active), height: MeadowHelpPhysics.rocketRadius(base: 120, powered: power.active)).position(target)
                    .accessibilityHidden(true)
                if pull.height > 10 || misses > 0 || power.active {
                    Path { path in path.move(to: start); path.addLine(to: predicted(start: start, pull: pull, size: geo.size, target: target)) }
                        .stroke(.white.opacity(0.8), style: StrokeStyle(lineWidth: 3, dash: [5, 8]))
                        .allowsHitTesting(false)
                }
                Image("meadow-rocket").resizable().scaledToFit().frame(width: 78, height: 120)
                    .position(flight ?? CGPoint(x: start.x + pull.width, y: start.y + pull.height))
                    .gesture(DragGesture(minimumDistance: 2).updating($dragging) { _, active, _ in active = true }.onChanged { value in
                        guard !flying else { return }
                        pull = CGSize(width: max(-75, min(75, value.translation.width)), height: max(0, min(100, value.translation.height)))
                    }.onEnded { _ in
                        guard !flying, pull.height > 18 else { pull = .zero; return }
                        launch(start: start, end: predicted(start: start, pull: pull, size: geo.size, target: target), target: target)
                    })
                    .accessibilityLabel("Rocket. Pull down to aim, then release.")
                    .accessibilityAction(named: "Launch toward the planet") { launch(start: start, end: target, target: target) }
                    .accessibilityIdentifier("meadow-rocket-launch")
                MeadowCaption(text: "\(planets) of \(goal) planets · \(misses == 0 ? "Pull down to aim" : "Try the dotted path")")
                VStack { Spacer(); MeadowCaption(text: "Pull away from the planet, then let go") }
            }
        }
        .modifier(MeadowHelpControls(power: power, title: "Big ring", id: "meadow-rocket-help", enabled: !flying && !dragging, maximumDelta: 0.045))
        .accessibilityElement(children: .contain)
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
        guard !flying, planets < goal else { return }
        flying = true
        flight = start
        pull = .zero
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.65)) { flight = end }
        let landingRadius = max(misses > 0 ? 95 : 72, MeadowHelpPhysics.rocketRadius(base: 72, powered: power.active))
        flightTask = Task { @MainActor in
            do { try await Task.sleep(nanoseconds: reduceMotion ? 120_000_000 : 700_000_000) }
            catch { return }
            guard !Task.isCancelled else { return }
            if MeadowGeometry.distance(end, target) < landingRadius {
                planets += 1
                misses = 0
                MeadowStyle.tick()
                onMove()
            } else { misses += 1 }
            flying = false
            flight = nil
            if planets == goal { onComplete() }
        }
    }
}

private struct MeadowSnowman: View {
    let goal: Int
    let onMove: () -> Void
    let onComplete: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var power = MeadowOptionalPower()
    @GestureState private var rolling = false
    @State private var stacked = 0
    @State private var travel: CGFloat = 0
    @State private var offset = CGSize.zero
    @State private var previous = CGSize.zero
    @State private var face: Set<String> = []
    @State private var clothes: Set<String> = []
    @State private var heldPiece: String?
    @State private var pieceOffset = CGSize.zero

    var body: some View {
        GeometryReader { geo in
            let home = CGPoint(x: geo.size.width * 0.23, y: geo.size.height * 0.84)
            let targets = [CGPoint(x: geo.size.width * 0.58, y: geo.size.height * 0.67),
                           CGPoint(x: geo.size.width * 0.58, y: geo.size.height * 0.47),
                           CGPoint(x: geo.size.width * 0.58, y: geo.size.height * 0.31)]
            let diameters: [CGFloat] = [118, 92, 70]
            ZStack(alignment: .top) {
                MeadowCaption(text: stacked < 3 ? (travel < 180 ? "Roll your snowball · \(stacked) of 3 stacked" : "Lift it onto the glowing spot") : stacked == 3 ? "Drag the coal face and carrot onto the little snowball." : "Add a hat, a bow tie and twig arms")
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
                        .gesture(DragGesture(minimumDistance: 0).updating($rolling) { _, active, _ in active = true }.onChanged { value in
                            guard scenePhase == .active else { return }
                            power.touch()
                            travel = min(180, travel + hypot(value.translation.width - previous.width, value.translation.height - previous.height) * MeadowHelpPhysics.snowGrowth(powered: power.active))
                            previous = value.translation
                            offset = value.translation
                        }.onEnded { _ in
                            guard scenePhase == .active, stacked < 3 else { return }
                            let end = CGPoint(x: home.x + offset.width, y: home.y + offset.height)
                            if travel >= 180 && MeadowGeometry.distance(end, targets[stacked]) < MeadowHelpPhysics.snowMagnet(base: diameters[stacked] * 0.65, accessory: false, powered: power.active) { stack() }
                            offset = .zero
                            previous = .zero
                        })
                        .accessibilityLabel("Snowball, \(Int(min(1, travel / 180) * 100)) percent rolled")
                        .accessibilityAction(named: "Roll snowball") { power.touch(); travel = min(180, travel + 60 * MeadowHelpPhysics.snowGrowth(powered: power.active)) }
                        .accessibilityAction(named: "Stack snowball") { if travel >= 180 { stack() } }
                        .accessibilityIdentifier("meadow-snowman-ball")
                }
                if goal > 3 {
                    let head = targets[2]
                    ForEach(Array(face), id: \.self) { part in
                        MeadowSnowPiece(kind: part).frame(width: 40, height: 40)
                            .position(x: head.x, y: head.y + (part == "nose" ? 6 : 0))
                            .accessibilityHidden(true)
                    }
                    ForEach(Array(clothes), id: \.self) { part in
                        MeadowSnowPiece(kind: part).frame(width: part == "arms" ? 156 : 78, height: 78)
                            .position(pieceTarget(part, size: geo.size)).accessibilityHidden(true)
                    }
                    if stacked >= 3, stacked < goal {
                        let parts = stacked == 3 ? ["coal", "nose"] : ["hat", "bow", "arms"]
                        ForEach(Array(parts.enumerated()), id: \.element) { index, part in
                            if !(stacked == 3 ? face : clothes).contains(part) {
                                let home = CGPoint(x: geo.size.width * (CGFloat(index) + 0.5) / CGFloat(parts.count), y: geo.size.height * 0.87)
                                MeadowSnowPiece(kind: part).frame(width: 64, height: 70)
                                    .padding(6).background(.white.opacity(0.85), in: RoundedRectangle(cornerRadius: 15))
                                    .position(x: home.x + (heldPiece == part ? pieceOffset.width : 0), y: home.y + (heldPiece == part ? pieceOffset.height : 0))
                                    .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                                        guard scenePhase == .active, heldPiece == nil || heldPiece == part else { return }
                                        power.touch(); heldPiece = part; pieceOffset = value.translation
                                    }.onEnded { _ in
                                        guard scenePhase == .active, heldPiece == part else { return }
                                        let end = CGPoint(x: home.x + pieceOffset.width, y: home.y + pieceOffset.height)
                                        if MeadowGeometry.distance(end, pieceTarget(part, size: geo.size)) < MeadowHelpPhysics.snowMagnet(base: 70, accessory: true, powered: power.active) { place(part) }
                                        heldPiece = nil; pieceOffset = .zero
                                    })
                                    .accessibilityLabel(MeadowSnowPiece.name(part))
                                    .accessibilityAction(named: "Place on the snowman") { place(part) }
                                    .accessibilityIdentifier("meadow-snowman-\(part)")
                            }
                        }
                    }
                }
            }
        }
        .modifier(MeadowHelpControls(power: power, title: "Snowy help", id: "meadow-snowman-help", enabled: !rolling && heldPiece == nil, waitForTouch: true))
        .accessibilityElement(children: .contain)
        .onChange(of: scenePhase) { _ in heldPiece = nil; pieceOffset = .zero; offset = .zero; previous = .zero }
    }

    private func stack() {
        guard stacked < 3 else { return }
        power.touch()
        stacked += 1
        travel = 0
        offset = .zero
        MeadowStyle.tick()
        onMove()
        if stacked == goal { onComplete() }
    }

    private func pieceTarget(_ part: String, size: CGSize) -> CGPoint {
        let y: CGFloat = part == "hat" ? 0.22 : part == "bow" ? 0.40 : part == "arms" ? 0.47 : 0.31
        return CGPoint(x: size.width * 0.58, y: size.height * y)
    }
    private func place(_ part: String) {
        guard stacked >= 3, stacked < goal else { return }
        power.touch()
        if stacked == 3 {
            guard ["coal", "nose"].contains(part), !face.contains(part) else { return }
            face.insert(part); MeadowStyle.tick()
            if face.count == 2 { stacked += 1; onMove(); if stacked == goal { onComplete() } }
        } else {
            guard ["hat", "bow", "arms"].contains(part), !clothes.contains(part) else { return }
            clothes.insert(part); MeadowStyle.tick()
            if clothes.count == 3 { stacked += 1; onMove(); if stacked == goal { onComplete() } }
        }
    }
}

private struct MeadowSnowPiece: View {
    let kind: String
    static func name(_ kind: String) -> String {
        ["coal": "Coal face", "nose": "Carrot nose", "hat": "Top hat", "bow": "Bow tie", "arms": "Twig arms"][kind] ?? kind
    }
    var body: some View {
        Group {
            if kind == "hat" || kind == "bow" {
                Image(kind == "hat" ? "hat-tophat" : "hat-bow").resizable().scaledToFit()
            } else if kind == "nose" {
                Image(systemName: "triangle.fill").resizable().scaledToFit().rotationEffect(.degrees(90))
                    .foregroundStyle(.orange).padding(8)
            } else if kind == "coal" {
                GeometryReader { geo in
                    Path { path in
                        for p in [CGPoint(x: 0.28,y: 0.3),.init(x: 0.72,y: 0.3),.init(x: 0.3,y: 0.67),.init(x: 0.5,y: 0.75),.init(x: 0.7,y: 0.67)] {
                            path.addEllipse(in: CGRect(x: p.x * geo.size.width - 3, y: p.y * geo.size.height - 3, width: 6, height: 6))
                        }
                    }.fill(Color.black.opacity(0.85))
                }
            } else {
                GeometryReader { geo in
                    Path { path in
                        for sign in [CGFloat(-1), CGFloat(1)] {
                            let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
                            path.move(to: center)
                            path.addLine(to: .init(x: center.x + sign * geo.size.width * 0.45, y: geo.size.height * 0.22))
                            path.move(to: .init(x: center.x + sign * geo.size.width * 0.28, y: geo.size.height * 0.33))
                            path.addLine(to: .init(x: center.x + sign * geo.size.width * 0.28, y: geo.size.height * 0.10))
                        }
                    }.stroke(Color.brown, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                }
            }
        }
    }
}

private struct MeadowTrain: View {
    let goal: Int
    let onMove: () -> Void
    let onComplete: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.speechGameProgress) private var speechGameProgress
    @State private var position = 0.08
    @State private var station = 0
    @State private var driving = false
    @State private var misses = 0
    @State private var previousTick: Date?
    @State private var easyStops: TimeInterval = 0
    private var stops: [Double] {
        if goal == 3 { return [0.30, 0.57, 0.84] }
        return (0..<goal).map { 0.20 + Double($0) * 0.64 / Double(max(1, goal - 1)) }
    }
    private let clock = Timer.publish(every: 1.0 / 30, on: .main, in: .common).autoconnect()

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .top) {
                MeadowCaption(text: "\(station) of \(goal) stations · \(easyStops > 0 ? "Wider stops" : driving ? "Let go at the flag" : "Hold the drive button")")
                Path { path in
                    path.move(to: CGPoint(x: 0, y: geo.size.height * 0.63))
                    path.addLine(to: CGPoint(x: geo.size.width, y: geo.size.height * 0.63))
                }.stroke(MeadowStyle.ink.opacity(0.7), style: StrokeStyle(lineWidth: 9, dash: [4, 9]))
                ForEach(0..<goal, id: \.self) { index in
                    VStack(spacing: 8) {
                        Image(systemName: index < station ? "checkmark.circle.fill" : "flag.fill")
                            .font(.system(size: goal <= 3 ? 31 : 23, weight: .bold))
                        Text("\(index + 1)").font(.caption.bold())
                    }
                    .foregroundStyle(index <= station ? MeadowStyle.teal : .gray)
                    .padding(goal <= 3 ? 9 : 4).background(.white.opacity(index == station ? 1 : 0.7), in: RoundedRectangle(cornerRadius: 12))
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
                        .accessibilityLabel("Drive train. Stop at station \(min(station + 1, goal)).")
                        .accessibilityAction { nudge() }
                        .accessibilityIdentifier("meadow-train-drive")
                    Button("Brake") { stop() }.font(.body.bold()).frame(minHeight: 44)
                        .accessibilityIdentifier("meadow-train-brake")
                    if let requestHelp = speechGameProgress?.requestHelp {
                        Button("Easy stops") {
                            _ = requestHelp { earned in
                                if earned { easyStops = 10 }
                            }
                        }
                        .buttonStyle(.bordered)
                        .frame(minHeight: 44)
                        .accessibilityIdentifier("meadow-train-help")
                    }
                }.padding(16)
            }
        }
        .onReceive(clock) { now in
            guard scenePhase == .active, driving, station < goal, speechGameProgress?.isHelpActive != true
            else { previousTick = nil; return }
            let dt = min(0.06, now.timeIntervalSince(previousTick ?? now))
            previousTick = now
            let velocity = easyStops > 0 ? 0.07 : misses > 0 ? 0.10 : 0.14
            easyStops = max(0, easyStops - dt)
            advance(dt * velocity)
        }
        .onChange(of: scenePhase) { _ in driving = false; previousTick = nil }
        .onChange(of: speechGameProgress?.isHelpActive) { _ in driving = false; previousTick = nil }
        .onDisappear { driving = false; previousTick = nil }
    }

    private func advance(_ amount: Double) {
        guard station < goal else { return }
        position += amount
        if position > stops[station] + (easyStops > 0 ? 0.14 : 0.08) {
            driving = false
            misses += 1
            position = max(0.08, stops[station] - 0.20)
        }
    }

    private func nudge() {
        guard station < goal else { return }
        advance(0.03)
        if abs(position - stops[station]) < 0.05 { stop() }
    }

    private func stop() {
        driving = false
        previousTick = nil
        guard station < goal, speechGameProgress?.isHelpActive != true,
              abs(position - stops[station]) < (easyStops > 0 ? 0.14 : misses > 0 ? 0.075 : 0.055) else { return }
        position = stops[station]
        station += 1
        misses = 0
        easyStops = 0
        MeadowStyle.tick()
        onMove()
        if station == goal { onComplete() }
    }
}

private struct MeadowStars: View {
    let goal: Int
    let guided: Bool
    let onMove: () -> Void
    let onComplete: () -> Void
    @StateObject private var power = MeadowOptionalPower()
    @GestureState private var tracing = false
    @State private var picture = 0
    @State private var connected = 0
    @State private var lastTouch: CGPoint?
    private let previewPictures: [[CGPoint]] = [
        [CGPoint(x: 0.18, y: 0.65), CGPoint(x: 0.50, y: 0.25), CGPoint(x: 0.82, y: 0.65), CGPoint(x: 0.18, y: 0.65)],
        [CGPoint(x: 0.20, y: 0.70), CGPoint(x: 0.20, y: 0.42), CGPoint(x: 0.50, y: 0.20), CGPoint(x: 0.80, y: 0.42), CGPoint(x: 0.80, y: 0.70), CGPoint(x: 0.20, y: 0.70)],
        [CGPoint(x: 0.50, y: 0.18), CGPoint(x: 0.82, y: 0.48), CGPoint(x: 0.50, y: 0.80), CGPoint(x: 0.18, y: 0.48), CGPoint(x: 0.50, y: 0.18)]
    ]
    private let previewNames = ["A mountain!", "A little house!", "A bright kite!"]
    // Additional paths are authored public/stars.js pictures, not new prompts.
    private var pictures: [[CGPoint]] {
        if !guided { return previewPictures }
        return [
            [.init(x: 0.2,y: 0.84),.init(x: 0.5,y: 0.16),.init(x: 0.8,y: 0.84),.init(x: 0.2,y: 0.84)],
            [.init(x: 0.28,y: 0.86),.init(x: 0.28,y: 0.14),.init(x: 0.8,y: 0.3),.init(x: 0.28,y: 0.46)],
            [.init(x: 0.5,y: 0.12),.init(x: 0.84,y: 0.46),.init(x: 0.5,y: 0.84),.init(x: 0.16,y: 0.46),.init(x: 0.5,y: 0.12)],
            [.init(x: 0.2,y: 0.84),.init(x: 0.2,y: 0.42),.init(x: 0.5,y: 0.14),.init(x: 0.8,y: 0.42),.init(x: 0.8,y: 0.84),.init(x: 0.2,y: 0.84)],
            [.init(x: 0.5,y: 0.14),.init(x: 0.5,y: 0.66),.init(x: 0.84,y: 0.66),.init(x: 0.7,y: 0.86),.init(x: 0.28,y: 0.86),.init(x: 0.14,y: 0.66)]
        ]
    }
    private var names: [String] { guided ? ["A tent!", "A flag!", "A bright kite!", "A little house!", "A boat!"] : previewNames }

    var body: some View {
        GeometryReader { geo in
            let points = pictures[picture % pictures.count].map { CGPoint(x: $0.x * geo.size.width, y: $0.y * geo.size.height) }
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
                    .gesture(DragGesture(minimumDistance: 0).updating($tracing) { _, active, _ in active = true }.onChanged { value in
                        guard connected < points.count else { return }
                        let previous = lastTouch ?? value.location
                        var next = connected
                        while next < points.count && MeadowGeometry.segmentDistance(points[next], from: previous, to: value.location) < MeadowHelpPhysics.starReach(base: 32, powered: power.active) { next += 1 }
                        if next != connected { connected = next; MeadowStyle.tick() }
                        lastTouch = value.location
                    }.onEnded { _ in lastTouch = nil })
                    .accessibilityLabel("Trace picture \(picture + 1). \(connected) of \(points.count) stars connected.")
                    .accessibilityAction(named: "Connect next star") { if !done { connected += 1; MeadowStyle.tick() } }
                    .accessibilityIdentifier("meadow-stars-trace")
                MeadowCaption(text: done ? names[picture % names.count] : "Picture \(picture + 1) of \(goal) · Follow the glowing star")
                if done {
                    VStack { Spacer(); MeadowButton(title: picture == goal - 1 ? "All lit up!" : "Next picture", symbol: "star.fill") {
                        if picture == goal - 1 { onComplete() }
                        else { power.clear(); picture += 1; connected = 0; lastTouch = nil }
                    }.padding(16) }
                    .accessibilityIdentifier("meadow-stars-next")
                }
            }
            .onChange(of: connected) { value in
                if value == points.count { onMove() }
            }
        }
        .modifier(MeadowHelpControls(power: power, title: "Glowing path", id: "meadow-stars-help", enabled: !tracing && connected < pictures[picture % pictures.count].count))
        .accessibilityElement(children: .contain)
    }
}

private struct MeadowCake: View {
    let goal: Int
    let guided: Bool
    let onMove: () -> Void
    let onComplete: () -> Void
    @StateObject private var power = MeadowOptionalPower()
    @GestureState private var stirring = false
    @State private var placingTopping = false
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
                MeadowCaption(text: stage == 0 ? "Stir in big circles" : guided && stage == 1 ? "Hold the jug over the tin to pour." : stage == (guided ? 2 : 1) ? "Add six stars to the icing" : guided && stage == 3 ? "Drag four fruits onto your cake." : guided ? "Drag the candles onto the cake." : "Place three birthday candles")
                if guided && stage == 1 {
                    MeadowCakePour(onComplete: advanceStep)
                } else if guided && stage >= 3 {
                    Image("meadow-cake").resizable().scaledToFit()
                        .frame(width: geo.size.width * 0.9, height: geo.size.height * 0.55).position(center)
                        .accessibilityHidden(true)
                    MeadowCakeToppings(isCandles: stage >= 4, power: power, placing: $placingTopping, onComplete: advanceStep).id(stage)
                } else if stage == 0 {
                    Image("meadow-bowl").resizable().scaledToFit()
                        .frame(width: geo.size.width * 0.9, height: geo.size.height * 0.55).position(center)
                        .accessibilityHidden(true)
                    Image("meadow-spoon").resizable().scaledToFit().frame(width: 72, height: 158)
                        .rotationEffect(.radians(Double(spoonAngle) + .pi / 4))
                        .position(x: center.x + cos(spoonAngle) * 50, y: center.y + sin(spoonAngle) * 32)
                        .allowsHitTesting(false).accessibilityHidden(true)
                    Circle().fill(.clear).contentShape(Circle()).frame(width: geo.size.width * 0.94, height: geo.size.width * 0.94)
                        .position(center)
                        .gesture(DragGesture(minimumDistance: 0, coordinateSpace: .named("meadow-cake-board")).updating($stirring) { _, active, _ in active = true }.onChanged { value in
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
                            guard stage == (guided ? 2 : 1), !decorations.contains(index) else { return }
                            decorations.insert(index)
                            MeadowStyle.tick()
                            if decorations.count == 6 { advanceStep() }
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
                    if !guided && stage == 2 {
                        ForEach(0..<3) { index in
                            Button {
                                guard !candles.contains(index) else { return }
                                candles.insert(index)
                                MeadowStyle.tick()
                                if candles.count == 3 { advanceStep() }
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
        .modifier(MeadowHelpControls(power: power, title: "Cooking help", id: "meadow-cake-help", enabled: !stirring && !placingTopping && (stage == 0 || (guided && stage >= 3)), maximumDelta: 0.045))
        .accessibilityElement(children: .contain)
    }

    private func stir(_ amount: CGFloat) {
        guard stage == 0 else { return }
        stirred += amount * MeadowHelpPhysics.stirGain(powered: power.active)
        if stirred >= 4 * .pi { lastAngle = nil; MeadowStyle.tick(); advanceStep() }
    }

    private func advanceStep() {
        guard stage < goal else { return }
        stage += 1
        onMove()
        if stage == goal { onComplete() }
    }
}

/// The original cake's second authored move is a held pour. Work advances only
/// under the child's finger; elapsed time with no held jug fills nothing.
private struct MeadowCakePour: View {
    let onComplete: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @State private var fill = 0.0
    @State private var pouring = false
    @State private var previousTick: Date?
    private let clock = Timer.publish(every: 1 / 30, on: .main, in: .common).autoconnect()
    var body: some View {
        GeometryReader { geo in
            ZStack {
                Image("meadow-bowl").resizable().scaledToFit()
                    .frame(width: geo.size.width * 0.55, height: 150)
                    .rotationEffect(.degrees(pouring ? -25 : 0))
                    .position(x: geo.size.width * 0.66, y: geo.size.height * 0.33)
                    .accessibilityHidden(true)
                RoundedRectangle(cornerRadius: 15).fill(Color.gray.opacity(0.5))
                    .frame(width: geo.size.width * 0.64, height: 88)
                    .overlay(RoundedRectangle(cornerRadius: 12).fill(MeadowStyle.cream)
                        .padding(7).opacity(fill))
                    .position(x: geo.size.width * 0.43, y: geo.size.height * 0.59)
                    .accessibilityHidden(true)
                if pouring {
                    RoundedRectangle(cornerRadius: 8).fill(Color(red: 0.92, green: 0.71, blue: 0.47))
                        .frame(width: 15, height: geo.size.height * 0.20)
                        .position(x: geo.size.width * 0.49, y: geo.size.height * 0.46)
                        .accessibilityHidden(true)
                }
                VStack {
                    Spacer()
                    Text("Hold to pour").font(.headline).foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 60).background(MeadowStyle.teal, in: Capsule())
                        .contentShape(Capsule())
                        .gesture(DragGesture(minimumDistance: 0).onChanged { _ in if fill < 1 { pouring = true } }
                            .onEnded { _ in pouring = false; previousTick = nil })
                        .accessibilityAddTraits(.isButton)
                        .accessibilityAction { add(0.25) }
                        .accessibilityIdentifier("meadow-cake-pour")
                    ProgressView(value: fill).tint(MeadowStyle.teal).padding(.top, 10)
                }.padding(22)
            }
        }
        .onReceive(clock) { now in
            guard scenePhase == .active, pouring, fill < 1 else { previousTick = nil; return }
            let dt = min(0.06, max(0, now.timeIntervalSince(previousTick ?? now)))
            previousTick = now
            add(dt / 1.6)
        }
        .onChange(of: scenePhase) { _ in pouring = false; previousTick = nil }
        .onDisappear { pouring = false; previousTick = nil }
    }
    private func add(_ amount: Double) {
        guard fill < 1 else { return }
        fill = min(1, fill + amount)
        if fill >= 1 { pouring = false; MeadowStyle.tick(); onComplete() }
    }
}

/// Cake's fourth/fifth authored groups: four actual fruit placements, then
/// actual candle placements. Each whole group reports one move, never a rep.
private struct MeadowCakeToppings: View {
    let isCandles: Bool
    @ObservedObject var power: MeadowOptionalPower
    @Binding var placing: Bool
    let onComplete: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @State private var placed: Set<Int> = []
    @State private var owner: Int?
    @State private var offset = CGSize.zero
    private let fruits = ["strawberry", "kiwi", "orange", "apple"]
    private var count: Int { isCandles ? 3 : 4 }
    var body: some View {
        GeometryReader { geo in
            let center = CGPoint(x: geo.size.width * 0.5, y: geo.size.height * 0.53)
            ZStack {
                ForEach(0..<count, id: \.self) { index in
                    let target = CGPoint(x: center.x + (isCandles ? CGFloat(index - 1) * 48 : (index % 2 == 0 ? -1 : 1) * geo.size.width * 0.18),
                                         y: center.y - (isCandles ? 65 : 30 - CGFloat(index / 2) * 40))
                    let home = CGPoint(x: geo.size.width * (CGFloat(index) + 0.5) / CGFloat(count), y: geo.size.height * 0.87)
                    if !placed.contains(index) {
                        Circle().stroke(.white.opacity(0.85), style: StrokeStyle(lineWidth: 2, dash: [5,4]))
                            .frame(width: 44, height: 44).position(target).accessibilityHidden(true)
                    }
                    topping(index)
                        .frame(width: 58, height: isCandles ? 76 : 58)
                        .background(placed.contains(index) ? .clear : .white.opacity(0.85), in: RoundedRectangle(cornerRadius: 12))
                        .position(x: placed.contains(index) ? target.x : home.x + (owner == index ? offset.width : 0),
                                  y: placed.contains(index) ? target.y : home.y + (owner == index ? offset.height : 0))
                        .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                            guard scenePhase == .active, !placed.contains(index), owner == nil || owner == index else { return }
                            placing = true; owner = index; offset = value.translation
                        }.onEnded { _ in
                            guard scenePhase == .active, owner == index, !placed.contains(index) else { return }
                            let end = CGPoint(x: home.x + offset.width, y: home.y + offset.height)
                            if MeadowGeometry.distance(end, target) < MeadowHelpPhysics.cakeCatch(base: 65, width: geo.size.width, candles: isCandles, powered: power.active) { place(index) }
                            placing = false; owner = nil; offset = .zero
                        })
                        .accessibilityLabel(isCandles ? "Birthday candle \(index + 1)" : fruits[index])
                        .accessibilityAction(named: "Place on the cake") { place(index) }
                        .accessibilityIdentifier("meadow-cake-\(isCandles ? "guided-candle" : "fruit")-\(index)")
                }
            }
        }
        .onChange(of: scenePhase) { _ in placing = false; owner = nil; offset = .zero }
    }
    @ViewBuilder private func topping(_ index: Int) -> some View {
        if isCandles {
            VStack(spacing: 0) {
                Image(systemName: "flame.fill").font(.system(size: 22)).foregroundStyle(.yellow)
                RoundedRectangle(cornerRadius: 4).fill(Color(red: 0.42, green: 0.37, blue: 0.73))
                    .frame(width: 11, height: 42)
            }
        } else { Image("fruit-\(fruits[index])").resizable().scaledToFit().padding(5) }
    }
    private func place(_ index: Int) {
        guard !placed.contains(index) else { return }
        placed.insert(index); MeadowStyle.tick()
        if placed.count == count { onComplete() }
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
