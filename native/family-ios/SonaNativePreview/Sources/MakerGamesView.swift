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

/// Finger-only native preview games. These completions are play records,
/// never speech sessions, practice attempts, microphone turns or rep credit.
struct MakerGamesView: View {
    let game: MakerGame
    let onRoundFinished: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var roundID = UUID()
    @State private var finished = false

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
                    .font(.system(.largeTitle, design: .rounded, weight: .heavy))
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityIdentifier("maker-\(game.id)")
                Text(game.hint)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(MakerPalette.muted)
                    .multilineTextAlignment(.center)
            }
            Group {
                switch game {
                case .robot: RobotCircuitRound(onComplete: complete)
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
                    .font(.system(.title, design: .rounded, weight: .heavy))
                    .multilineTextAlignment(.center)
                Text("\(game.title) round finished.")
                    .foregroundStyle(MakerPalette.muted)
                    .multilineTextAlignment(.center)
                MakerAction("Make another", icon: "arrow.clockwise") {
                    roundID = UUID()
                    finished = false
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
}

private struct RobotCircuitRound: View {
    let onComplete: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var turns = (0..<9).map { _ in Int.random(in: 1...3) }
    // Clockwise arms: top=1, right=2, bottom=4, left=8. The finished route
    // snakes across all nine tiles, from the top-left battery to the robot.
    private let pipes = [10, 10, 12, 6, 10, 9, 3, 10, 10]

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
                            CircuitPipe(mask: pipes[index])
                                .stroke(powered.contains(index) ? MakerPalette.teal : Color(red: 0.60, green: 0.63, blue: 0.64), style: StrokeStyle(lineWidth: 11, lineCap: .round, lineJoin: .round))
                                .rotationEffect(.degrees(Double(turns[index]) * 90))
                                .animation(reduceMotion ? nil : .easeInOut(duration: 0.18), value: turns[index])
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
            Text("Tap the tiles to join every wire.")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(MakerPalette.muted)
                .multilineTextAlignment(.center)
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
    @State private var craneX = 0.5
    @State private var pieceY = 0.16
    @State private var placed = 0
    @State private var dropping = false
    @State private var lands = false
    @State private var message = "Move the block over the outline."
    private let slots = [CGPoint(x: 0.24, y: 0.80), CGPoint(x: 0.50, y: 0.80), CGPoint(x: 0.76, y: 0.80),
                         CGPoint(x: 0.24, y: 0.63), CGPoint(x: 0.76, y: 0.63), CGPoint(x: 0.50, y: 0.46)]
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
                .gesture(DragGesture(minimumDistance: 0).onChanged { value in
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
            Slider(value: $craneX, in: 0.14...0.86)
                .tint(MakerPalette.teal)
                .disabled(dropping)
                .accessibilityLabel("Crane position")
                .accessibilityValue("\(Int(craneX * 100)) percent from the left")
                .accessibilityIdentifier("castle-crane")
            MakerAction("Drop the block", icon: "arrow.down") { drop() }
                .disabled(dropping || placed >= slots.count)
                .opacity(dropping ? 0.6 : 1)
                .accessibilityIdentifier("castle-drop")
        }
        .task(id: dropping) {
            guard dropping else { return }
            do { try await Task.sleep(nanoseconds: 620_000_000) } catch { return }
            guard !Task.isCancelled, scenePhase == .active else { return }
            if lands {
                placed += 1
                message = "Nice fit! Here comes another."
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
        lands = abs(craneX - slots[placed].x) <= 0.095
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
            .fill(colors[index % colors.count].gradient)
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
    private enum Step: Int { case roll, sauce, top, bake }
    private enum Topping: String, CaseIterable { case tomato = "Tomato", basil = "Basil", cheese = "Cheese" }
    let onComplete: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var step: Step = .roll
    @State private var rolled: CGFloat = 0
    @State private var previousPoint: CGPoint?
    @State private var sauce: Set<Int> = []
    @State private var toppings: [Int: Topping] = [:]
    @State private var selected: Topping = .tomato
    @State private var heat = 0
    private let spots = [CGPoint(x: 0.35, y: 0.30), CGPoint(x: 0.65, y: 0.32), CGPoint(x: 0.27, y: 0.58),
                         CGPoint(x: 0.51, y: 0.50), CGPoint(x: 0.72, y: 0.61), CGPoint(x: 0.48, y: 0.75)]
    private let cells = 19

    private var sauceTotal: Int {
        (0..<(cells * cells)).filter { cell in
            let x = (CGFloat(cell % cells) + 0.5) / CGFloat(cells) - 0.5
            let y = (CGFloat(cell / cells) + 0.5) / CGFloat(cells) - 0.5
            return x * x + y * y < 0.16
        }.count
    }
    private var enoughSauce: Bool { sauce.count >= Int(Double(sauceTotal) * 0.68) }
    private var baking: Bool { step == .bake && scenePhase == .active }

    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 7) {
                ForEach(0..<4) { index in
                    Text(["Roll", "Sauce", "Top", "Bake"][index])
                        .font(.caption.weight(.bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(step.rawValue == index ? MakerPalette.teal : .white, in: Capsule())
                        .foregroundStyle(step.rawValue == index ? .white : MakerPalette.muted)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Step \(step.rawValue + 1) of four: \(["roll the dough", "spread sauce", "add toppings", "bake"][step.rawValue])")
            .accessibilityIdentifier("pizza-step")

            GeometryReader { geometry in
                let edge = min(geometry.size.width, geometry.size.height)
                ZStack {
                    RoundedRectangle(cornerRadius: 26)
                        .fill(step == .bake ? Color(red: 0.29, green: 0.24, blue: 0.23) : Color(red: 0.91, green: 0.81, blue: 0.64))
                    pizza(edge: edge * 0.89)
                        .frame(width: edge * 0.89, height: edge * 0.89)
                        .scaleEffect(step == .roll ? 0.43 + min(1, rolled / 1000) * 0.57 : (step == .bake ? 0.84 : 1))
                        .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: step)
                    if step == .bake {
                        HStack(spacing: 25) {
                            ForEach(0..<3) { _ in Image(systemName: "flame.fill").foregroundStyle(.orange) }
                        }
                        .font(.title2)
                        .offset(y: edge * 0.37)
                    }
                }
                .frame(width: geometry.size.width, height: geometry.size.height)
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 0)
                    .onChanged { drag in
                        let origin = CGPoint(x: (geometry.size.width - edge * 0.89) / 2, y: (geometry.size.height - edge * 0.89) / 2)
                        let point = CGPoint(x: (drag.location.x - origin.x) / (edge * 0.89), y: (drag.location.y - origin.y) / (edge * 0.89))
                        if step == .roll {
                            if let previousPoint {
                                rolled = min(1000, rolled + min(45, hypot(drag.location.x - previousPoint.x, drag.location.y - previousPoint.y)))
                            }
                            previousPoint = drag.location
                        } else if step == .sauce { paintSauce(point) }
                    }
                    .onEnded { _ in previousPoint = nil },
                    including: step == .roll || step == .sauce ? .all : .subviews)
                .accessibilityElement(children: step == .top ? .contain : .ignore)
                .accessibilityLabel(step == .roll ? "Pizza dough" : step == .sauce ? "Spread sauce on the pizza" : "Pizza")
                .accessibilityAction(named: "Roll the dough") { if step == .roll { rolled = min(1000, rolled + 200) } }
                .accessibilityAction(named: "Spread more sauce") {
                    if step == .sauce {
                        let remaining = (0..<(cells * cells)).first { !sauce.contains($0) && insidePizza($0) }
                        if let remaining { paintSauce(CGPoint(x: CGFloat(remaining % cells) / CGFloat(cells), y: CGFloat(remaining / cells) / CGFloat(cells))) }
                    }
                }
                .accessibilityIdentifier("pizza-board")
            }

            controls
        }
        .task(id: baking) {
            guard baking else { return }
            while heat < 6 {
                do { try await Task.sleep(nanoseconds: 400_000_000) } catch { return }
                guard !Task.isCancelled, scenePhase == .active else { return }
                heat += 1
            }
            onComplete()
        }
    }

    private func pizza(edge: CGFloat) -> some View {
        ZStack {
            Circle().fill(Color(red: 0.92, green: 0.67, blue: 0.35).gradient)
                .shadow(color: .black.opacity(0.15), radius: 5, y: 4)
            Circle().fill(Color(red: 1, green: 0.89, blue: 0.63)).padding(edge * 0.055)
            if step != .roll {
                Canvas { context, size in
                    let unit = size.width / CGFloat(cells)
                    for cell in sauce {
                        let rect = CGRect(x: CGFloat(cell % cells) * unit - unit * 0.35, y: CGFloat(cell / cells) * unit - unit * 0.35,
                                          width: unit * 1.9, height: unit * 1.9)
                        context.fill(Path(ellipseIn: rect), with: .color(Color(red: 0.80, green: 0.24, blue: 0.16)))
                    }
                }
                .clipShape(Circle().inset(by: edge * 0.08))
                .allowsHitTesting(false)
                ForEach(0..<spots.count, id: \.self) { index in
                    if let kind = toppings[index] {
                        topping(kind).frame(width: edge * 0.17, height: edge * 0.17)
                            .position(x: spots[index].x * edge, y: spots[index].y * edge)
                            .accessibilityHidden(true)
                    } else if step == .top {
                        Button { toppings[index] = selected } label: {
                            Circle().strokeBorder(.white.opacity(0.85), style: StrokeStyle(lineWidth: 2, dash: [4, 4]))
                                .background(.white.opacity(0.1), in: Circle())
                                .frame(width: max(44, edge * 0.18), height: max(44, edge * 0.18))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Add \(selected.rawValue.lowercased()) at spot \(index + 1)")
                        .accessibilityIdentifier("pizza-top-\(index)")
                        .position(x: spots[index].x * edge, y: spots[index].y * edge)
                    }
                }
            }
        }
        .frame(width: edge, height: edge)
    }

    @ViewBuilder private var controls: some View {
        switch step {
        case .roll:
            MakerProgress(value: Int(rolled / 10), total: 100, label: "dough rolled")
            MakerAction(rolled >= 1000 ? "Add the sauce" : "Rub to roll the dough", icon: "hand.draw") {
                if rolled >= 1000 { step = .sauce }
            }
            .disabled(rolled < 1000)
            .opacity(rolled >= 1000 ? 1 : 0.65)
            .accessibilityIdentifier("pizza-next")
        case .sauce:
            MakerProgress(value: sauce.count, total: sauceTotal, label: "sauce spread")
            MakerAction(enoughSauce ? "Time for toppings" : "Spread the sauce with your finger", icon: "hand.draw") {
                if enoughSauce { step = .top }
            }
            .disabled(!enoughSauce)
            .opacity(enoughSauce ? 1 : 0.65)
            .accessibilityIdentifier("pizza-next")
        case .top:
            HStack(spacing: 8) {
                ForEach(Topping.allCases, id: \.self) { kind in
                    Button { selected = kind } label: {
                        VStack(spacing: 4) {
                            topping(kind).frame(width: 25, height: 25)
                            Text(kind.rawValue).font(.caption.weight(.semibold))
                        }
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .background(selected == kind ? MakerPalette.mint : .white, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(selected == kind ? MakerPalette.teal : .clear, lineWidth: 2))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(kind.rawValue)
                    .accessibilityAddTraits(selected == kind ? .isSelected : [])
                    .accessibilityIdentifier("pizza-ingredient-\(kind.rawValue.lowercased())")
                }
            }
            MakerAction(toppings.count == spots.count ? "Into the oven!" : "Tap the six topping spots", icon: "flame") {
                if toppings.count == spots.count { step = .bake }
            }
            .disabled(toppings.count != spots.count)
            .opacity(toppings.count == spots.count ? 1 : 0.65)
            .accessibilityIdentifier("pizza-bake")
        case .bake:
            MakerProgress(value: heat, total: 6, label: "baking")
            Text("A little heat… almost ready!")
                .font(.system(.headline, design: .rounded))
                .foregroundStyle(MakerPalette.muted)
                .frame(minHeight: 50)
        }
    }

    @ViewBuilder private func topping(_ kind: Topping) -> some View {
        switch kind {
        case .tomato:
            Circle().fill(Color(red: 0.94, green: 0.37, blue: 0.25))
                .overlay(Circle().strokeBorder(Color(red: 1, green: 0.64, blue: 0.39), lineWidth: 3))
                .overlay(Image(systemName: "asterisk").font(.caption).foregroundStyle(.white.opacity(0.55)))
        case .basil:
            Ellipse().fill(Color(red: 0.23, green: 0.57, blue: 0.29))
                .rotationEffect(.degrees(-35))
                .overlay(Capsule().fill(.white.opacity(0.45)).frame(width: 2).padding(6).rotationEffect(.degrees(-35)))
        case .cheese:
            RoundedRectangle(cornerRadius: 4).fill(Color(red: 1, green: 0.89, blue: 0.37))
                .rotationEffect(.degrees(20)).padding(3)
        }
    }

    private func insidePizza(_ cell: Int) -> Bool {
        let x = (CGFloat(cell % cells) + 0.5) / CGFloat(cells) - 0.5
        let y = (CGFloat(cell / cells) + 0.5) / CGFloat(cells) - 0.5
        return x * x + y * y < 0.16
    }

    private func paintSauce(_ point: CGPoint) {
        for cell in 0..<(cells * cells) where insidePizza(cell) {
            let x = (CGFloat(cell % cells) + 0.5) / CGFloat(cells) - point.x
            let y = (CGFloat(cell / cells) + 0.5) / CGFloat(cells) - point.y
            if x * x + y * y < 0.015 { sauce.insert(cell) }
        }
    }
}

private struct MakerProgress: View {
    let value: Int
    let total: Int
    let label: String
    var body: some View {
        HStack(spacing: 12) {
            Text("\(value) / \(total)").font(.system(.subheadline, design: .rounded, weight: .bold)).monospacedDigit()
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
                .font(.system(.body, design: .rounded, weight: .bold))
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
}
