import SwiftUI

enum MakerGame {
    case robot, castle, pizza

    fileprivate var title: String {
        switch self {
        case .robot: return "Robot Builder"
        case .castle: return "Castle Builder"
        case .pizza: return "Pizza Chef"
        }
    }

    fileprivate var hint: String {
        switch self {
        case .robot: return "Turn the tiles. Bring your robot to life."
        case .castle: return "Move the crane. Build a little castle."
        case .pizza: return "Roll, spread, sprinkle… delicious!"
        }
    }

    fileprivate var id: String {
        switch self {
        case .robot: return "robot"
        case .castle: return "castle"
        case .pizza: return "pizza"
        }
    }
}

/// The maker boards report completed moves to the parent round.
struct MakerGamesView: View {
    let game: MakerGame
    let onRoundFinished: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.speechGameProgress) private var speechGameProgress
    @Environment(\.guidedReplay) private var guidedReplay
    @State private var roundID = UUID()
    @State private var finished = false
    @State private var circuits = 0

    var body: some View {
        GeometryReader { geometry in
            Group {
                if typeSize.isAccessibilitySize || geometry.size.height < 470 {
                    ScrollView { content(height: max(430, geometry.size.height - 154)) }
                } else {
                    content(height: max(310, geometry.size.height - 154))
                }
            }
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .background(MakerPalette.paper.ignoresSafeArea())
        .foregroundStyle(MakerPalette.ink)
        .preferredColorScheme(.light)
        .overlay { if finished { finishCard } }
    }

    private func content(height: CGFloat) -> some View {
        VStack(spacing: 14) {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.body.weight(.bold))
                        .frame(width: 46, height: 46)
                        .background(.white, in: Circle())
                }
                .accessibilityLabel("Back to games")
                .accessibilityIdentifier("maker-close")
                Spacer()
            }
            VStack(spacing: 4) {
                Text(game.title)
                    .font(.system(.largeTitle, design: .rounded).weight(.heavy))
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityIdentifier("maker-\(game.id)")
                Text(game.hint)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(MakerPalette.muted)
                    .multilineTextAlignment(.center)
            }
            Group {
                switch game {
                case .robot: RobotCircuitRound(part: speechGameProgress == nil ? nil : circuits, onComplete: finishCircuit)
                    .id(circuits)
                case .castle: CastleCraneRound(onComplete: complete)
                case .pizza: PizzaKitchenRound(onComplete: complete)
                }
            }
            .id(roundID)
            .frame(height: height)
            .disabled(finished)
            .accessibilityHidden(finished)
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 14)
    }

    private var finishCard: some View {
        ZStack {
            Color.black.opacity(0.24).ignoresSafeArea().accessibilityHidden(true)
            VStack(spacing: 18) {
                Image(systemName: game == .pizza ? "flame.fill" : "star.fill")
                    .font(.system(size: 46))
                    .foregroundStyle(MakerPalette.orange)
                    .accessibilityHidden(true)
                Text(game == .pizza ? "Pizza’s ready!" : "Look what you made!")
                    .font(.system(.title, design: .rounded).weight(.heavy))
                    .multilineTextAlignment(.center)
                Text("\(game.title) round finished.")
                    .foregroundStyle(MakerPalette.muted)
                    .multilineTextAlignment(.center)
                MakerAction("Make another", icon: "arrow.clockwise") {
                    if let guidedReplay { guidedReplay() }
                    else { roundID = UUID(); circuits = 0; finished = false }
                }
                .accessibilityIdentifier("maker-replay")
                Button("Back to games") { dismiss() }
                    .font(.body.weight(.semibold))
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("maker-finish-close")
            }
            .padding(28)
            .frame(maxWidth: 370)
            .background(.white, in: RoundedRectangle(cornerRadius: 30))
            .padding(24)
            .accessibilityAddTraits(.isModal)
        }
    }

    private func complete() {
        guard !finished else { return }
        finished = true
        onRoundFinished()
    }

    private func finishCircuit() {
        guard let speechGameProgress else { complete(); return }
        circuits += 1
        speechGameProgress.advance()
        if circuits == speechGameProgress.count { complete() }
    }
}

private struct RobotCircuitRound: View {
    let onComplete: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.speechGameProgress) private var speechGameProgress
    @Environment(\.scenePhase) private var scenePhase
    @State private var blueprintSeconds = 0.0
    private var blueprintTicking: Bool { blueprintSeconds > 0 && scenePhase == .active && speechGameProgress?.isHelpActive != true }
    @State private var turns: [Int]
    // Clockwise arms: top=1, right=2, bottom=4, left=8. The finished route
    // snakes across all nine tiles, from the top-left battery to the robot.
    private let pipes = [10, 10, 12, 6, 10, 9, 3, 10, 10]

    init(part: Int?, onComplete: @escaping () -> Void) {
        self.onComplete = onComplete
        var turns = Array(repeating: 0, count: 9)
        if let part {
            let routes = [2, 5, 3, 6, 0, 1, 4, 7, 8]
            turns[routes[part % routes.count]] = part < 4 ? 3 : 1
        } else {
            turns = (0..<9).map { _ in Int.random(in: 1...3) }
        }
        _turns = State(initialValue: turns)
    }

    private func mask(_ index: Int) -> Int {
        let rotation = turns[index] % 4
        return ((pipes[index] << rotation) | (pipes[index] >> (4 - rotation))) & 15
    }

    private var powered: Set<Int> {
        guard mask(0) & 8 != 0 else { return [] }
        var seen: Set<Int> = [0]
        var queue = [0]
        let directions = [(-1, 0, 1, 4), (0, 1, 2, 8), (1, 0, 4, 1), (0, -1, 8, 2)]
        while !queue.isEmpty {
            let index = queue.removeFirst()
            for (dy, dx, arm, opposite) in directions where mask(index) & arm != 0 {
                let row = index / 3 + dy, column = index % 3 + dx
                if (0..<3).contains(row), (0..<3).contains(column) {
                    let next = row * 3 + column
                    if mask(next) & opposite != 0, seen.insert(next).inserted { queue.append(next) }
                }
            }
        }
        return seen
    }

    private var connected: Bool { powered.count == 9 && mask(8) & 2 != 0 }

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Label("Start here", systemImage: "battery.100")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(MakerPalette.teal)
                Spacer()
                RobotFace(lit: connected).frame(width: 64, height: 54)
            }
            GeometryReader { geometry in
                let edge = min(geometry.size.width, geometry.size.height)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                    ForEach(0..<9) { index in
                        Button {
                            turns[index] += 1
                        } label: {
                            ZStack {
                                if blueprintSeconds > 0 {
                                    CircuitPipe(mask: pipes[index])
                                        .stroke(MakerPalette.orange.opacity(0.30), style: StrokeStyle(lineWidth: 20, lineCap: .round, dash: [4, 4]))
                                }
                                CircuitPipe(mask: pipes[index])
                                    .stroke(powered.contains(index) ? MakerPalette.teal : Color(red: 0.60, green: 0.63, blue: 0.64), style: StrokeStyle(lineWidth: 11, lineCap: .round, lineJoin: .round))
                                    .rotationEffect(.degrees(Double(turns[index]) * 90))
                                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.18), value: turns[index])
                            }
                                .frame(maxWidth: .infinity)
                                .aspectRatio(1, contentMode: .fit)
                                .background(powered.contains(index) ? MakerPalette.mint : .white, in: RoundedRectangle(cornerRadius: 18))
                                .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(MakerPalette.teal.opacity(0.12), lineWidth: 1.5))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Circuit tile \(index + 1)")
                        .accessibilityValue(armDescription(mask(index)))
                        .accessibilityHint("Tap to turn clockwise")
                        .accessibilityIdentifier("robot-tile-\(index)")
                    }
                }
                .frame(width: edge, height: edge)
                .position(x: geometry.size.width / 2, y: geometry.size.height / 2)
            }
            MakerProgress(value: powered.count, total: 9, label: "tiles connected")
                .accessibilityIdentifier("robot-progress")
            Text(blueprintSeconds > 0 ? "Blueprint! Turn the wires to match" : "Tap the tiles to join every wire.")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(MakerPalette.muted)
                .multilineTextAlignment(.center)
            if let request = speechGameProgress?.requestHelp {
                Button("Blueprint") {
                    guard !connected else { return }
                    _ = request { earned in if earned { blueprintSeconds = 10 } }
                }
                .disabled(connected)
                .frame(maxWidth: .infinity, minHeight: 48)
                .accessibilityLabel("Extra help: say your word for a blueprint")
                .accessibilityIdentifier("robot-help")
            }
        }
        .accessibilityElement(children: .contain)
        .task(id: blueprintTicking) {
            guard blueprintTicking else { return }
            while blueprintSeconds > 0 {
                do { try await Task.sleep(nanoseconds: 100_000_000) } catch { return }
                guard !Task.isCancelled, blueprintTicking else { return }
                blueprintSeconds = max(0, blueprintSeconds - 0.1)
            }
        }
        .onChange(of: connected) { ready in if ready { onComplete() } }
    }

    private func armDescription(_ value: Int) -> String {
        [(1, "top"), (2, "right"), (4, "bottom"), (8, "left")]
            .filter { value & $0.0 != 0 }.map(\.1).joined(separator: " and ")
    }
}

private struct CircuitPipe: Shape {
    let mask: Int
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let ends = [(1, CGPoint(x: rect.midX, y: rect.minY)), (2, CGPoint(x: rect.maxX, y: rect.midY)),
                    (4, CGPoint(x: rect.midX, y: rect.maxY)), (8, CGPoint(x: rect.minX, y: rect.midY))]
        for (arm, end) in ends where mask & arm != 0 { path.move(to: center); path.addLine(to: end) }
        return path
    }
}

private struct RobotFace: View {
    let lit: Bool
    var body: some View {
        RoundedRectangle(cornerRadius: 15)
            .fill(MakerPalette.teal)
            .overlay {
                VStack(spacing: 8) {
                    HStack(spacing: 16) {
                        ForEach(0..<2) { _ in Circle().fill(lit ? Color.yellow : .white).frame(width: 9, height: 9) }
                    }
                    Capsule().fill(.white.opacity(0.9)).frame(width: 22, height: 4)
                }
            }
            .accessibilityLabel(lit ? "Robot powered on" : "Robot waiting for power")
    }
}

private struct CastleCraneRound: View {
    let onComplete: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.speechGameProgress) private var speechGameProgress
    @State private var craneX = 0.5
    @GestureState private var craneDragging = false
    @State private var craneSliding = false
    @State private var pieceY = 0.16
    @State private var placed = 0
    @State private var dropping = false
    @State private var steadySeconds = 0.0
    private var steadyTicking: Bool { steadySeconds > 0 && scenePhase == .active && speechGameProgress?.isHelpActive != true }
    @State private var lands = false
    @State private var message = "Move the block over the outline."
    private var slots: [CGPoint] {
        let preview: [CGPoint] = [.init(x: 0.24, y: 0.80), .init(x: 0.50, y: 0.80), .init(x: 0.76, y: 0.80),
                                  .init(x: 0.24, y: 0.63), .init(x: 0.76, y: 0.63), .init(x: 0.50, y: 0.46)]
        guard let speechGameProgress else { return preview }
        return Array((preview + [.init(x: 0.24, y: 0.44), .init(x: 0.76, y: 0.44)]).prefix(speechGameProgress.count))
    }
    private let colors = [Color(red: 0.89, green: 0.60, blue: 0.46), Color(red: 0.94, green: 0.75, blue: 0.48),
                          Color(red: 0.78, green: 0.66, blue: 0.86)]

    var body: some View {
        VStack(spacing: 12) {
            MakerProgress(value: placed, total: slots.count, label: "castle pieces")
                .accessibilityIdentifier("castle-progress")
            GeometryReader { geometry in
                ZStack {
                    LinearGradient(colors: [Color(red: 0.80, green: 0.91, blue: 0.97), .white], startPoint: .top, endPoint: .bottom)
                    Ellipse().fill(MakerPalette.mint)
                        .frame(width: geometry.size.width * 1.4, height: geometry.size.height * 0.20)
                        .position(x: geometry.size.width / 2, y: geometry.size.height * 0.98)
                    crane(in: geometry.size)
                    ForEach(0..<min(placed, slots.count), id: \.self) { index in
                        castleBlock(index)
                            .frame(width: geometry.size.width * blockWidth(index), height: geometry.size.height * 0.16)
                            .position(x: slots[index].x * geometry.size.width, y: slots[index].y * geometry.size.height)
                    }
                    if placed < slots.count {
                        RoundedRectangle(cornerRadius: 9)
                            .stroke(MakerPalette.teal.opacity(0.7), style: StrokeStyle(lineWidth: 2.5, dash: [6, 5]))
                            .background(.white.opacity(0.4), in: RoundedRectangle(cornerRadius: 9))
                            .frame(width: geometry.size.width * blockWidth(placed), height: geometry.size.height * 0.16)
                            .position(x: slots[placed].x * geometry.size.width, y: slots[placed].y * geometry.size.height)
                        castleBlock(placed)
                            .frame(width: geometry.size.width * blockWidth(placed), height: geometry.size.height * 0.16)
                            .position(x: craneX * geometry.size.width, y: pieceY * geometry.size.height)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 25))
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 0).updating($craneDragging) { _, active, _ in active = true }.onChanged { value in
                    guard !dropping else { return }
                    craneX = min(0.86, max(0.14, value.location.x / geometry.size.width))
                })
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Castle building site")
                .accessibilityHint("Move the crane with the slider, then drop the block")
                .accessibilityIdentifier("castle-site")
            }
            Text(message)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(MakerPalette.muted)
                .multilineTextAlignment(.center)
                .frame(minHeight: 38)
            Slider(value: $craneX, in: 0.14...0.86, onEditingChanged: { craneSliding = $0 })
                .tint(MakerPalette.teal)
                .disabled(dropping)
                .accessibilityLabel("Crane position")
                .accessibilityValue("\(Int(craneX * 100)) percent from the left")
                .accessibilityIdentifier("castle-crane")
            MakerAction("Drop the block", icon: "arrow.down") { drop() }
                .disabled(dropping || placed >= slots.count)
                .opacity(dropping ? 0.6 : 1)
                .accessibilityIdentifier("castle-drop")
            if let request = speechGameProgress?.requestHelp {
                Button("Steady rope") {
                    guard !dropping, !craneDragging, !craneSliding else { return }
                    _ = request { earned in
                        if earned { steadySeconds = 10; message = "Steady rope. Line up the block." }
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 48)
                .disabled(dropping || craneDragging || craneSliding || placed >= slots.count)
                .accessibilityLabel("Extra help: say your word for a steady rope")
                .accessibilityIdentifier("castle-help")
            }
        }
        .accessibilityElement(children: .contain)
        .task(id: steadyTicking) {
            guard steadyTicking else { return }
            while steadySeconds > 0 {
                do { try await Task.sleep(nanoseconds: 100_000_000) } catch { return }
                guard !Task.isCancelled, steadyTicking else { return }
                steadySeconds = max(0, steadySeconds - 0.1)
            }
        }
        .task(id: dropping) {
            guard dropping else { return }
            do { try await Task.sleep(nanoseconds: 620_000_000) } catch { return }
            guard !Task.isCancelled, scenePhase == .active else { return }
            if lands {
                placed += 1
                steadySeconds = 0
                message = "Nice fit! Here comes another."
                speechGameProgress?.advance()
            } else {
                message = "Try lining up with the outline."
            }
            pieceY = 0.16
            dropping = false
            if placed == slots.count { onComplete() }
        }
        .onChange(of: scenePhase) { state in
            if state != .active && dropping { dropping = false; pieceY = 0.16 }
        }
    }

    private func drop() {
        guard !dropping, placed < slots.count else { return }
        lands = abs(craneX - slots[placed].x) <= 0.095 * (steadySeconds > 0 ? 2.2 : 1)
        if lands { craneX = slots[placed].x }
        dropping = true
        withAnimation(reduceMotion ? nil : .easeIn(duration: 0.55)) {
            pieceY = lands ? slots[placed].y : 1.15
        }
    }

    private func crane(in size: CGSize) -> some View {
        Path { path in
            path.move(to: CGPoint(x: 15, y: size.height))
            path.addLine(to: CGPoint(x: 15, y: 12))
            path.addLine(to: CGPoint(x: size.width - 15, y: 12))
            path.move(to: CGPoint(x: craneX * size.width, y: 12))
            path.addLine(to: CGPoint(x: craneX * size.width, y: pieceY * size.height))
        }
        .stroke(Color(red: 0.60, green: 0.49, blue: 0.36), style: StrokeStyle(lineWidth: 4, lineCap: .round))
    }

    private func castleBlock(_ index: Int) -> some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(colors[index % colors.count].tileGradient)
            .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(.white.opacity(0.6), lineWidth: 2))
            .overlay {
                if index >= 3 {
                    if index == 5 {
                        Image(systemName: "flag.fill").font(.title3).foregroundStyle(MakerPalette.ink.opacity(0.6))
                    } else {
                        RoundedRectangle(cornerRadius: 7)
                            .fill(MakerPalette.ink.opacity(0.6))
                            .frame(width: 17, height: 25)
                    }
                } else {
                    Rectangle().fill(.white.opacity(0.35)).frame(height: 2)
                }
            }
    }

    private func blockWidth(_ index: Int) -> CGFloat { index == 5 ? 0.55 : 0.235 }
}

private struct PizzaKitchenRound: View {
    private enum Step: Int {
        case roll, sauce, cheese, topFirst, topSecond, topThird, bake, cut

        var toppingGroup: Int? {
            switch self {
            case .topFirst: return 0
            case .topSecond: return 1
            case .topThird: return 2
            default: return nil
            }
        }

        var instruction: String {
            switch self {
            case .roll: return "Roll the dough"
            case .sauce: return "Spread the sauce"
            case .cheese: return "Sprinkle the cheese"
            case .topFirst, .topSecond, .topThird: return "Add toppings"
            case .bake: return "Watch the oven"
            case .cut: return "Slice your pizza"
            }
        }
    }

    private enum Topping: String, CaseIterable {
        case pepperoni = "Pepperoni", pepper = "Pepper rings", mushroom = "Mushrooms"
    }

    let onComplete: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.speechGameProgress) private var speechGameProgress
    @State private var step: Step = .roll
    @State private var rolled: CGFloat = 0
    @State private var previousPoint: CGPoint?
    @State private var sauce: Set<Int> = []
    @State private var cheese: Set<Int> = []
    @State private var toppings: [Int: Topping] = [:]
    @State private var order = Topping.allCases.shuffled()
    @State private var spots = [
        CGPoint(x: 0.32, y: 0.27), CGPoint(x: 0.66, y: 0.28), CGPoint(x: 0.49, y: 0.67),
        CGPoint(x: 0.28, y: 0.58), CGPoint(x: 0.68, y: 0.62), CGPoint(x: 0.49, y: 0.25),
        CGPoint(x: 0.22, y: 0.43), CGPoint(x: 0.77, y: 0.49), CGPoint(x: 0.48, y: 0.45)
    ].shuffled()
    @State private var heat = 0
    @State private var heating = false
    @State private var draggingPizza = false
    @State private var chefSeconds = 0.0
    private var chefPowered: Bool { chefSeconds > 0 }
    private var chefTicking: Bool { chefPowered && scenePhase == .active && speechGameProgress?.isHelpActive != true }
    @State private var cuts: Set<Int> = []
    @State private var cutMisses = 0
    private let cells = 19

    private var pizzaCells: [Int] { (0..<(cells * cells)).filter(insidePizza) }
    private var brushGoal: Int { Int(Double(pizzaCells.count) * 0.68) }
    private var warming: Bool { step == .bake && heating && scenePhase == .active && speechGameProgress?.isHelpActive != true }

    var body: some View {
        VStack(spacing: 12) {
            Text("Step \(step.rawValue + 1) of 8 · \(step.instruction)")
                .font(.subheadline.bold())
                .accessibilityIdentifier("pizza-step")
            GeometryReader { geometry in
                let edge = min(geometry.size.width, geometry.size.height) * 0.89
                let origin = CGPoint(x: (geometry.size.width - edge) / 2, y: (geometry.size.height - edge) / 2)
                ZStack {
                    RoundedRectangle(cornerRadius: 26)
                        .fill(step == .bake ? Color(red: 0.29, green: 0.24, blue: 0.23) : Color(red: 0.91, green: 0.81, blue: 0.64))
                    pizza(edge: edge)
                        .scaleEffect(step == .roll ? 0.43 + min(1, rolled / 1000) * 0.57 : (step == .bake ? 0.84 : 1))
                        .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: step)
                }
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 0)
                    .onChanged { drag in
                        draggingPizza = true
                        let point = CGPoint(x: (drag.location.x - origin.x) / edge, y: (drag.location.y - origin.y) / edge)
                        brush(point, physical: drag.location)
                    }
                    .onEnded { drag in
                        draggingPizza = false
                        previousPoint = nil
                        if step == .cut { slice(drag, edge: edge, origin: origin) }
                    }, including: step.toppingGroup == nil ? .all : .subviews)
                .accessibilityElement(children: step.toppingGroup == nil ? .ignore : .contain)
                .accessibilityLabel(step.instruction)
                .accessibilityIdentifier("pizza-board")
            }
            controls
            if let request = speechGameProgress?.requestHelp {
                Button("Chef power") {
                    guard !draggingPizza, !heating else { return }
                    _ = request { earned in if earned { chefSeconds = 10 } }
                }
                .frame(maxWidth: .infinity, minHeight: 48)
                .disabled(draggingPizza || heating)
                .accessibilityLabel("Extra help: say your word for chef power")
                .accessibilityIdentifier("pizza-help")
                if chefPowered {
                    Text("Chef power").font(.subheadline.bold()).foregroundStyle(MakerPalette.teal)
                        .accessibilityIdentifier("pizza-power")
                }
            }
        }
        .accessibilityElement(children: .contain)
        .task(id: chefTicking) {
            guard chefTicking else { return }
            while chefSeconds > 0 {
                do { try await Task.sleep(nanoseconds: 100_000_000) } catch { return }
                guard !Task.isCancelled, chefTicking else { return }
                chefSeconds = max(0, chefSeconds - 0.1)
            }
        }
        .task(id: warming) {
            guard warming else { return }
            while heat < 6 {
                do { try await Task.sleep(nanoseconds: NativeChefPower.ovenTickNanoseconds(powered: chefPowered)) } catch { return }
                guard !Task.isCancelled, warming else { return }
                heat += 1
            }
        }
        .onChange(of: scenePhase) { if $0 != .active { heating = false; draggingPizza = false; previousPoint = nil } }
        .onChange(of: speechGameProgress?.isHelpActive ?? false) { active in
            if active { heating = false; draggingPizza = false; previousPoint = nil }
        }
    }

    private func pizza(edge: CGFloat) -> some View {
        ZStack {
            Circle().fill(Color(red: 0.92, green: 0.67, blue: 0.35).tileGradient)
                .shadow(color: .black.opacity(0.15), radius: 5, y: 4)
            Circle().fill(Color(red: 1, green: 0.89, blue: 0.63)).padding(edge * 0.055)
            Canvas { context, size in
                let unit = size.width / CGFloat(cells)
                for cell in sauce {
                    let rect = CGRect(x: CGFloat(cell % cells) * unit - unit * 0.35, y: CGFloat(cell / cells) * unit - unit * 0.35,
                                      width: unit * 1.9, height: unit * 1.9)
                    context.fill(Path(ellipseIn: rect), with: .color(Color(red: 0.80, green: 0.24, blue: 0.16)))
                }
                for cell in cheese {
                    let rect = CGRect(x: CGFloat(cell % cells) * unit, y: CGFloat(cell / cells) * unit,
                                      width: unit * 0.75, height: unit * 0.22)
                    context.fill(Path(roundedRect: rect, cornerRadius: 2), with: .color(MakerPalette.cheese))
                }
            }
            .clipShape(Circle().inset(by: edge * 0.08))
            .allowsHitTesting(false)

            ForEach(spots.indices, id: \.self) { index in
                let point = CGPoint(x: spots[index].x * edge, y: spots[index].y * edge)
                if let kind = toppings[index] {
                    topping(kind).frame(width: edge * 0.14, height: edge * 0.14)
                        .position(point).accessibilityHidden(true)
                } else if let group = step.toppingGroup, index / 3 == group {
                    Button { placeTopping(at: index, group: group) } label: {
                        Circle().strokeBorder(.white, style: StrokeStyle(lineWidth: 2, dash: [4, 4]))
                            .background(.white.opacity(0.1), in: Circle())
                            .frame(width: max(44, edge * 0.14), height: max(44, edge * 0.14))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Add \(order[group].rawValue.lowercased()) at spot \(index % 3 + 1)")
                    .accessibilityIdentifier("pizza-top-\(index)")
                    .position(point)
                }
            }

            if step == .cut {
                ForEach(0..<4) { index in
                    let angle = Double(index) * .pi / 4
                    Path { path in
                        let x = cos(angle) * edge * 0.40, y = sin(angle) * edge * 0.40
                        path.move(to: CGPoint(x: edge / 2 - x, y: edge / 2 - y))
                        path.addLine(to: CGPoint(x: edge / 2 + x, y: edge / 2 + y))
                    }
                    .stroke(cuts.contains(index) ? MakerPalette.ink.opacity(0.8) : .white,
                            style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: cuts.contains(index) ? [] : [7, 6]))
                    .allowsHitTesting(false)
                }
            }
        }
        .frame(width: edge, height: edge)
    }

    @ViewBuilder private var controls: some View {
        switch step {
        case .roll:
            MakerProgress(value: Int(rolled / 10), total: 100, label: "dough rolled")
            MakerAction(rolled >= 1000 ? "Add the sauce" : "Roll a little more", icon: "hand.draw") {
                if rolled >= 1000 { advance(to: .sauce) }
                else { rolled = min(1000, rolled + 200 * NativeChefPower.rollingGain(powered: chefPowered)) }
            }.accessibilityIdentifier("pizza-next")
        case .sauce:
            brushControls(covered: sauce.count, display: "sauce spread", label: "Move on to cheese", next: .cheese)
        case .cheese:
            brushControls(covered: cheese.count, display: "cheese sprinkled", label: "Start toppings", next: .topFirst)
        case .topFirst, .topSecond, .topThird:
            if let group = step.toppingGroup {
                Text("Tap three glowing spots for \(order[group].rawValue.lowercased()).")
                    .font(.headline).multilineTextAlignment(.center)
            }
        case .bake:
            MakerProgress(value: heat, total: 6, label: "oven heat")
            if heat == 6 {
                MakerAction("Take out the pizza", icon: "checkmark") { advance(to: .cut) }
            } else {
                Text("Hold to bake")
                    .font(.headline).frame(maxWidth: .infinity, minHeight: 48)
                    .contentShape(Rectangle())
                    .background(.orange.opacity(0.22), in: RoundedRectangle(cornerRadius: 16))
                    .gesture(DragGesture(minimumDistance: 0).onChanged { _ in heating = true }.onEnded { _ in heating = false })
                    .accessibilityAddTraits(.isButton)
                    .accessibilityAction { heat = min(6, heat + 1) }
                    .accessibilityIdentifier("pizza-bake")
            }
        case .cut:
            MakerProgress(value: cuts.count, total: 4, label: "lines cut")
            MakerAction("Cut next line", icon: "scissors") {
                if let line = (0..<4).first(where: { !cuts.contains($0) }) { cut(line) }
            }
        }
    }

    private func brushControls(covered: Int, display: String, label: String, next: Step) -> some View {
        VStack(spacing: 8) {
            MakerProgress(value: covered, total: pizzaCells.count, label: display)
            MakerAction(covered >= brushGoal ? label : step.instruction, icon: "hand.draw") {
                if covered >= brushGoal { advance(to: next) }
                else if let nextCell = pizzaCells.first(where: { !(step == .sauce ? sauce : cheese).contains($0) }) {
                    brush(CGPoint(x: (CGFloat(nextCell % cells) + 0.5) / CGFloat(cells),
                                  y: (CGFloat(nextCell / cells) + 0.5) / CGFloat(cells)), physical: .zero)
                }
            }.accessibilityIdentifier("pizza-next")
        }
    }

    @ViewBuilder private func topping(_ kind: Topping) -> some View {
        switch kind {
        case .pepperoni:
            Circle().fill(Color(red: 0.83, green: 0.25, blue: 0.23))
                .overlay(Circle().strokeBorder(.orange.opacity(0.7), lineWidth: 3))
        case .pepper:
            Ellipse().strokeBorder(.green, lineWidth: 5).rotationEffect(.degrees(-35))
        case .mushroom:
            VStack(spacing: 0) {
                Capsule().fill(Color(red: 0.55, green: 0.36, blue: 0.20)).frame(height: 17)
                RoundedRectangle(cornerRadius: 3).fill(MakerPalette.cheese).frame(width: 11, height: 13)
            }
        }
    }

    private func insidePizza(_ cell: Int) -> Bool {
        let x = (CGFloat(cell % cells) + 0.5) / CGFloat(cells) - 0.5
        let y = (CGFloat(cell / cells) + 0.5) / CGFloat(cells) - 0.5
        return x * x + y * y < 0.16
    }

    private func brush(_ point: CGPoint, physical: CGPoint) {
        if step == .roll {
            guard hypot(point.x - 0.5, point.y - 0.5) <= 0.47 else { previousPoint = nil; return }
            if let previousPoint {
                rolled = min(1000, rolled + min(45, hypot(physical.x - previousPoint.x, physical.y - previousPoint.y)) * NativeChefPower.rollingGain(powered: chefPowered))
            }
            previousPoint = physical
        } else if step == .sauce || step == .cheese {
            for cell in pizzaCells {
                let x = (CGFloat(cell % cells) + 0.5) / CGFloat(cells) - point.x
                let y = (CGFloat(cell / cells) + 0.5) / CGFloat(cells) - point.y
                guard x * x + y * y < NativeChefPower.brushRadiusSquared(powered: chefPowered) else { continue }
                if step == .sauce { sauce.insert(cell) }
                else { cheese.insert(cell) }
            }
        }
    }

    private func placeTopping(at index: Int, group: Int) {
        guard step.toppingGroup == group, toppings[index] == nil else { return }
        toppings[index] = order[group]
        if ((group * 3)..<(group * 3 + 3)).allSatisfy({ toppings[$0] != nil }),
           let next = Step(rawValue: step.rawValue + 1) {
            advance(to: next)
        }
    }

    private func advance(to next: Step) {
        heating = false; chefSeconds = 0
        step = next
        speechGameProgress?.advance()
    }

    private func slice(_ drag: DragGesture.Value, edge: CGFloat, origin: CGPoint) {
        let dx = drag.translation.width, dy = drag.translation.height
        guard hypot(dx, dy) > edge * 0.26 else { return }
        let center = CGPoint(x: origin.x + edge / 2, y: origin.y + edge / 2)
        let middle = CGPoint(x: (drag.startLocation.x + drag.location.x) / 2, y: (drag.startLocation.y + drag.location.y) / 2)
        guard hypot(middle.x - center.x, middle.y - center.y) < edge * 0.43 else { return }
        let angle = atan2(dy, dx)
        let candidates = (0..<4).filter { !cuts.contains($0) }.map { (index: $0, alignment: abs(cos(angle - Double($0) * .pi / 4))) }
        guard let matched = candidates.max(by: { $0.alignment < $1.alignment }) else { return }
        if matched.alignment > NativeChefPower.minimumCutAlignment(base: [0.98, 0.93, 0.84, 0][min(cutMisses, 3)], powered: chefPowered) { cut(matched.index) }
        else { cutMisses += 1 }
    }

    private func cut(_ index: Int) {
        guard step == .cut, cuts.insert(index).inserted else { return }
        if cuts.count == 4 {
            chefSeconds = 0
            speechGameProgress?.advance()
            onComplete()
        }
    }
}

private struct MakerProgress: View {
    let value: Int
    let total: Int
    let label: String
    var body: some View {
        HStack(spacing: 12) {
            Text("\(value) / \(total)").font(.system(.subheadline, design: .rounded).weight(.bold)).monospacedDigit()
            ProgressView(value: Double(value), total: Double(total)).tint(MakerPalette.teal)
        }
        .padding(.horizontal, 15).padding(.vertical, 11)
        .background(.white, in: Capsule())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(value) of \(total) \(label)")
    }
}

private struct MakerAction: View {
    let title: String
    let icon: String
    let action: () -> Void
    init(_ title: String, icon: String, action: @escaping () -> Void) {
        self.title = title; self.icon = icon; self.action = action
    }
    var body: some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.system(.body, design: .rounded).weight(.bold))
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity, minHeight: 50)
                .padding(.horizontal, 10)
                .foregroundStyle(.white)
                .background(MakerPalette.teal, in: RoundedRectangle(cornerRadius: 17))
        }
        .buttonStyle(.plain)
    }
}

private enum MakerPalette {
    static let paper = Color(red: 1, green: 0.96, blue: 0.90)
    static let ink = Color(red: 0.153, green: 0.137, blue: 0.216)
    static let muted = Color(red: 0.40, green: 0.36, blue: 0.46)
    static let teal = Color(red: 0.067, green: 0.498, blue: 0.518)
    static let mint = Color(red: 0.85, green: 0.94, blue: 0.87)
    static let orange = Color(red: 0.95, green: 0.54, blue: 0.24)
    static let cheese = Color(red: 1, green: 0.88, blue: 0.52)
}
