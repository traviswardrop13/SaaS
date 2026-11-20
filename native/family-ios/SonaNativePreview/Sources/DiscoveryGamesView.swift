import SwiftUI

enum DiscoveryGame {
    case bubbles, peekaboo, dino

    fileprivate var title: String {
        switch self {
        case .bubbles: return "Bubble Pop"
        case .peekaboo: return "Peekaboo"
        case .dino: return "Dino Dig"
        }
    }

    fileprivate var instruction: String {
        switch self {
        case .bubbles: return "A sky full of bubbles. Pop them all!"
        case .peekaboo: return "Watch the fox. Where will it hide?"
        case .dino: return "Brush the sand to find hidden bones."
        }
    }

    fileprivate var identifier: String {
        switch self {
        case .bubbles: return "bubbles"
        case .peekaboo: return "peekaboo"
        case .dino: return "dino"
        }
    }
}

/// Native boards; the voice host owns each move's speaking turn.
struct DiscoveryGamesView: View {
    let game: DiscoveryGame
    let onRoundFinished: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.guidedReplay) private var guidedReplay
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var roundID = UUID()
    @State private var finished = false

    var body: some View {
        GeometryReader { geometry in
            Group {
                if typeSize.isAccessibilitySize || geometry.size.height < 460 {
                    ScrollView {
                        content(boardHeight: max(390, geometry.size.height - 145))
                    }
                } else {
                    content(boardHeight: max(270, geometry.size.height - 157))
                }
            }
            .frame(maxWidth: 680)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .background(background.ignoresSafeArea())
        .foregroundStyle(DiscoveryPalette.ink)
        .preferredColorScheme(.light)
        .overlay {
            if finished { finishCard }
        }
        .accessibilityIdentifier("discovery-\(game.identifier)")
    }

    private var background: Color {
        switch game {
        case .bubbles: return Color(red: 0.90, green: 0.96, blue: 1)
        case .peekaboo: return Color(red: 0.96, green: 0.93, blue: 1)
        case .dino: return Color(red: 1, green: 0.96, blue: 0.87)
        }
    }

    private func content(boardHeight: CGFloat) -> some View {
        VStack(spacing: 14) {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.body.weight(.bold))
                        .frame(width: 46, height: 46)
                        .background(.white.opacity(0.9), in: Circle())
                }
                .accessibilityLabel("Back to games")
                .accessibilityIdentifier("discovery-close")
                Spacer()
                Text("LET’S PLAY")
                    .font(.caption.weight(.heavy))
                    .tracking(1.5)
                    .foregroundStyle(DiscoveryPalette.muted)
            }

            VStack(spacing: 5) {
                Text(game.title)
                    .font(.system(.largeTitle, design: .rounded).weight(.heavy))
                    .accessibilityAddTraits(.isHeader)
                Text(game.instruction)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(DiscoveryPalette.muted)
                    .multilineTextAlignment(.center)
            }

            Group {
                switch game {
                case .bubbles: BubblePopRound(onComplete: complete)
                case .peekaboo: PeekabooRound(onComplete: complete)
                case .dino: DinoDigRound(onComplete: complete)
                }
            }
            .id(roundID)
            .frame(height: boardHeight)
            .disabled(finished)
            .accessibilityHidden(finished)
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 14)
    }

    private var finishCard: some View {
        ZStack {
            Color.black.opacity(0.25)
                .ignoresSafeArea()
                .accessibilityHidden(true)
            VStack(spacing: 18) {
                Image(systemName: "sparkles")
                    .font(.system(size: 45, weight: .semibold))
                    .foregroundStyle(DiscoveryPalette.teal)
                    .accessibilityHidden(true)
                Text("You did it!")
                    .font(.system(.largeTitle, design: .rounded).weight(.heavy))
                Text("\(game.title) round finished.")
                    .font(.body)
                    .foregroundStyle(DiscoveryPalette.muted)
                    .multilineTextAlignment(.center)
                DiscoveryAction(title: "Play again", systemImage: "arrow.clockwise") {
                    if let guidedReplay { guidedReplay() }
                    else { finished = false; roundID = UUID() }
                }
                .accessibilityIdentifier("discovery-replay")
                Button("Back to games") { dismiss() }
                    .font(.body.weight(.semibold))
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("discovery-finish-close")
            }
            .padding(28)
            .frame(maxWidth: 370)
            .background(.white, in: RoundedRectangle(cornerRadius: 30))
            .padding(24)
            .accessibilityElement(children: .contain)
            .accessibilityAddTraits(.isModal)
            .accessibilityIdentifier("discovery-finished")
        }
    }

    private func complete() {
        guard !finished else { return }
        finished = true
        onRoundFinished()
    }
}

private struct BubblePopRound: View {
    let onComplete: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.speechGameProgress) private var speechGameProgress
    @State private var wave = 0
    @State private var popped: Set<Int> = []
    private let colors: [Color] = [.cyan, .pink, .purple, .orange, .teal, .blue]
    private var waves: Int { speechGameProgress?.count ?? 2 }

    var body: some View {
        VStack(spacing: 12) {
            DiscoveryProgress(value: wave * 6 + popped.count, total: waves * 6, label: "bubbles popped")
                .accessibilityIdentifier("bubbles-progress")
            TimelineView(.animation(minimumInterval: 1.0 / 30, paused: reduceMotion || scenePhase != .active)) { timeline in
                GeometryReader { geometry in
                    let size = min(96, geometry.size.width * 0.29, geometry.size.height / 3 - 10)
                    let time = reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate
                    ZStack {
                        ForEach(0..<6) { index in
                            let x = geometry.size.width * (index % 2 == 0 ? 0.27 : 0.73)
                            let y = geometry.size.height * (CGFloat(index / 2) + 0.5) / 3
                            if popped.contains(index) {
                                Image(systemName: "sparkle")
                                    .font(.title)
                                    .foregroundStyle(colors[index].opacity(0.45))
                                    .position(x: x, y: y)
                                    .accessibilityHidden(true)
                            } else {
                                Button { pop(index) } label: {
                                    Circle()
                                        .fill(LinearGradient(colors: [colors[index].opacity(0.12), colors[index].opacity(0.28)],
                                                             startPoint: .top, endPoint: .bottom))
                                        .overlay(Circle().strokeBorder(colors[index].opacity(0.65), lineWidth: 2.5))
                                        .overlay(alignment: .topLeading) {
                                            Capsule()
                                                .fill(.white.opacity(0.95))
                                                .frame(width: size * 0.26, height: 7)
                                                .rotationEffect(.degrees(-38))
                                                .offset(x: size * 0.19, y: size * 0.16)
                                        }
                                        .overlay(alignment: .bottomTrailing) {
                                            Circle().fill(.white.opacity(0.7))
                                                .frame(width: 8, height: 8)
                                                .offset(x: -size * 0.20, y: -size * 0.17)
                                        }
                                        .frame(width: size, height: size)
                                        .shadow(color: colors[index].opacity(0.13), radius: 8, y: 5)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Pop bubble \(index + 1)")
                                .accessibilityIdentifier("bubble-\(index)")
                                .position(
                                    x: x + (reduceMotion ? 0 : sin(time * 0.9 + Double(index)) * 5),
                                    y: y + (reduceMotion ? 0 : cos(time * 1.15 + Double(index) * 1.7) * 8)
                                )
                            }
                        }
                    }
                }
            }
            if popped.count == 6 && wave < waves - 1 {
                DiscoveryAction(title: "More bubbles!", systemImage: "sparkles") {
                    wave += 1
                    popped = []
                }
                .accessibilityIdentifier("bubbles-next")
            } else {
                Text(wave == waves - 1 ? "One more bunch!" : "Pop this bunch…")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(DiscoveryPalette.muted)
                    .frame(minHeight: 48)
            }
        }
    }

    private func pop(_ index: Int) {
        guard !popped.contains(index) else { return }
        popped.insert(index)
        if popped.count == 6 {
            speechGameProgress?.advance()
            if wave == waves - 1 { onComplete() }
        }
    }
}

private struct PeekabooRound: View {
    private enum Phase: Equatable { case watch, shuffling, guess, found }
    let onComplete: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.speechGameProgress) private var speechGameProgress
    @State private var phase: Phase = .watch
    @State private var order = [0, 1, 2]
    @State private var hidingDoor = Int.random(in: 0..<3)
    @State private var wrongDoor: Int?
    @State private var finds = 0
    @State private var clue = false
    private let colors: [Color] = [Color(red: 0.96, green: 0.66, blue: 0.61), Color(red: 0.58, green: 0.80, blue: 0.85), Color(red: 0.97, green: 0.82, blue: 0.43)]
    private var goal: Int { speechGameProgress?.count ?? 3 }

    var body: some View {
        VStack(spacing: 14) {
            DiscoveryProgress(value: finds, total: goal, label: "foxes found")
                .accessibilityIdentifier("peekaboo-progress")
            Text(status)
                .font(.system(.title3, design: .rounded).weight(.bold))
                .multilineTextAlignment(.center)
                .frame(minHeight: 50)
                .accessibilityIdentifier("peekaboo-status")
            GeometryReader { geometry in
                let width = min(140, (geometry.size.width - 24) / 3)
                let height = min(195, geometry.size.height - 12)
                ZStack {
                    ForEach(0..<3) { door in
                        let open = ((phase == .watch || phase == .found) && door == hidingDoor) || wrongDoor == door
                        Button { guess(door) } label: {
                            ZStack {
                                RoundedRectangle(cornerRadius: 22)
                                    .fill(colors[door].opacity(0.28))
                                if open {
                                    if door == hidingDoor {
                                        Image("buddy-fox").resizable().scaledToFit().padding(7)
                                    } else {
                                        Image(systemName: "leaf.fill")
                                            .font(.largeTitle)
                                            .foregroundStyle(DiscoveryPalette.teal.opacity(0.6))
                                    }
                                } else {
                                    RoundedRectangle(cornerRadius: 19)
                                        .fill(colors[door].tileGradient)
                                        .padding(5)
                                        .overlay {
                                            Image(systemName: "star.fill")
                                                .font(.system(size: 26))
                                                .foregroundStyle(.white.opacity(0.85))
                                        }
                                        .overlay(alignment: .trailing) {
                                            Circle().fill(DiscoveryPalette.ink.opacity(0.55))
                                                .frame(width: 9, height: 9).padding(14)
                                        }
                                }
                            }
                            .frame(width: width, height: max(90, height))
                            .overlay(RoundedRectangle(cornerRadius: 22)
                                .strokeBorder(clue && door == hidingDoor ? .yellow : .white, lineWidth: clue && door == hidingDoor ? 8 : 3))
                            .shadow(color: DiscoveryPalette.ink.opacity(0.08), radius: 6, y: 5)
                        }
                        .buttonStyle(.plain)
                        .disabled(phase != .guess || wrongDoor == door)
                        .accessibilityLabel("Door \((order.firstIndex(of: door) ?? 0) + 1)")
                        .accessibilityHint(phase == .guess
                            ? (clue && door == hidingDoor ? "This door is glowing." : "Look for the fox")
                            : "Watch the fox before the doors shuffle")
                        .accessibilityIdentifier("peekaboo-door-\(door)")
                        .position(x: geometry.size.width * (CGFloat(order.firstIndex(of: door) ?? 0) + 0.5) / 3, y: geometry.size.height / 2)
                    }
                }
                .animation(reduceMotion ? nil : .easeInOut(duration: 0.38), value: order)
            }
            .frame(minHeight: 130)
            Group {
                switch phase {
                case .watch:
                    DiscoveryAction(title: "Ready to shuffle", systemImage: "arrow.left.arrow.right") { phase = .shuffling }
                        .accessibilityIdentifier("peekaboo-shuffle")
                case .found:
                    DiscoveryAction(title: "Find it again", systemImage: "arrow.right") { nextFind() }
                        .accessibilityIdentifier("peekaboo-next")
                case .guess:
                    Text("Tap a door.").font(.body.weight(.semibold)).frame(minHeight: 50)
                case .shuffling:
                    Text("Keep watching…").font(.body.weight(.semibold)).frame(minHeight: 50)
                }
            }
            if phase == .guess, !clue, let requestHelp = speechGameProgress?.requestHelp {
                Button("Echo's clue") { _ = requestHelp { earned in if earned { clue = true } } }
                    .buttonStyle(.bordered).frame(minHeight: 44)
                    .accessibilityIdentifier("peekaboo-help")
            }
        }
        .task(id: phase) {
            guard phase == .shuffling else { return }
            for _ in 0..<3 {
                do { try await Task.sleep(nanoseconds: 540_000_000) } catch { return }
                guard !Task.isCancelled, phase == .shuffling, scenePhase == .active else { return }
                let a = Int.random(in: 0..<3)
                let b = (a + Int.random(in: 1...2)) % 3
                order.swapAt(a, b)
            }
            do { try await Task.sleep(nanoseconds: 420_000_000) } catch { return }
            guard !Task.isCancelled, scenePhase == .active else { return }
            phase = .guess
        }
        .onChange(of: scenePhase) { state in
            if state != .active && phase == .shuffling { phase = .watch }
        }
    }

    private var status: String {
        switch phase {
        case .watch: return "There’s the fox!"
        case .shuffling: return "Follow its door…"
        case .guess: return clue ? "Look for the glowing door." : wrongDoor == nil ? "Where is the fox?" : "Try another door."
        case .found: return "Found it!"
        }
    }

    private func guess(_ door: Int) {
        guard phase == .guess else { return }
        if door == hidingDoor {
            finds += 1
            phase = .found
            speechGameProgress?.advance()
            if finds == goal { onComplete() }
        } else {
            wrongDoor = door
        }
    }

    private func nextFind() {
        wrongDoor = nil
        clue = false
        hidingDoor = Int.random(in: 0..<3)
        order = [0, 1, 2]
        phase = .watch
    }
}

private struct DinoDigRound: View {
    let onComplete: () -> Void
    @Environment(\.speechGameProgress) private var speechGameProgress
    @State private var cleared: Set<Int> = []
    @State private var found: Set<Int> = []
    private let columns = 22
    private let rows = 26
    private var bones: [CGPoint] {
        if speechGameProgress == nil {
            return [.init(x: 0.25, y: 0.19), .init(x: 0.74, y: 0.25), .init(x: 0.48, y: 0.49), .init(x: 0.24, y: 0.77), .init(x: 0.76, y: 0.76)]
        }
        let goal = speechGameProgress?.count ?? 8
        return (0..<goal).map { index in
            .init(x: index.isMultiple(of: 2) ? 0.26 : 0.74,
                  y: (CGFloat(index / 2) + 0.5) / CGFloat((goal + 1) / 2))
        }
    }
    private let turns: [Double] = [-22, 18, -38, 27, -12, 29, -16, 9]

    var body: some View {
        VStack(spacing: 14) {
            DiscoveryProgress(value: found.count, total: bones.count, label: "bones found")
                .accessibilityIdentifier("dino-progress")
            GeometryReader { geometry in
                ZStack {
                    Color(red: 0.77, green: 0.58, blue: 0.35)
                    ForEach(0..<bones.count, id: \.self) { index in
                        BoneShape()
                            .fill(Color(red: 1, green: 0.97, blue: 0.83))
                            .overlay(BoneShape().stroke(Color(red: 0.57, green: 0.40, blue: 0.24), lineWidth: 2))
                            .frame(width: geometry.size.width * 0.31, height: geometry.size.height * 0.105)
                            .rotationEffect(.degrees(turns[index % turns.count]))
                            .shadow(color: .black.opacity(0.18), radius: 3, y: 3)
                            .position(x: bones[index].x * geometry.size.width, y: bones[index].y * geometry.size.height)
                    }
                    Canvas { context, size in
                        let width = size.width / CGFloat(columns)
                        let height = size.height / CGFloat(rows)
                        for row in 0..<rows {
                            for column in 0..<columns {
                                let id = row * columns + column
                                if cleared.contains(id) { continue }
                                let rect = CGRect(x: CGFloat(column) * width, y: CGFloat(row) * height, width: width + 1, height: height + 1)
                                let shade = Double((id * 17 + row * 7) % 9) / 180
                                context.fill(Path(rect), with: .color(Color(red: 0.91 + shade, green: 0.73 + shade, blue: 0.45 + shade)))
                                if id % 3 == 0 {
                                    let dot = CGRect(x: rect.minX + width * 0.42, y: rect.minY + height * 0.40, width: 2, height: 2)
                                    context.fill(Path(ellipseIn: dot), with: .color(.brown.opacity(0.18)))
                                }
                            }
                        }
                    }
                    .allowsHitTesting(false)
                }
                .clipShape(RoundedRectangle(cornerRadius: 26))
                .overlay(RoundedRectangle(cornerRadius: 26).strokeBorder(.white.opacity(0.9), lineWidth: 4))
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                    brush(at: CGPoint(x: value.location.x / geometry.size.width, y: value.location.y / geometry.size.height))
                })
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Sand pit")
                .accessibilityValue("\(found.count) of \(bones.count) bones found")
                .accessibilityHint("Rub the sand, or use Brush next patch below")
                .accessibilityAction(named: "Brush next patch", brushNext)
                .accessibilityIdentifier("dino-sand")
            }
            DiscoveryAction(title: "Brush next patch", systemImage: "hand.draw") { brushNext() }
                .accessibilityIdentifier("dino-brush")
        }
    }

    private func brush(at point: CGPoint) {
        guard found.count < bones.count else { return }
        for row in 0..<rows {
            for column in 0..<columns {
                let dx = (CGFloat(column) + 0.5) / CGFloat(columns) - point.x
                let dy = (CGFloat(row) + 0.5) / CGFloat(rows) - point.y
                if dx * dx / 0.012 + dy * dy / 0.008 < 1 { cleared.insert(row * columns + column) }
            }
        }
        checkBones()
    }

    private func brushNext() {
        guard let index = bones.indices.first(where: { !found.contains($0) }) else { return }
        // The accessible control reveals the same sand cells as brushing.
        for row in 0..<rows {
            for column in 0..<columns where isOverBone(column: column, row: row, index: index) {
                cleared.insert(row * columns + column)
            }
        }
        checkBones()
    }

    private func isOverBone(column: Int, row: Int, index: Int) -> Bool {
        let dx = abs((CGFloat(column) + 0.5) / CGFloat(columns) - bones[index].x)
        let dy = abs((CGFloat(row) + 0.5) / CGFloat(rows) - bones[index].y)
        return dx < 0.19 && dy < 0.11
    }

    private func checkBones() {
        let wasComplete = found.count == bones.count
        for index in bones.indices where !found.contains(index) {
            var total = 0
            var visible = 0
            for row in 0..<rows {
                for column in 0..<columns where isOverBone(column: column, row: row, index: index) {
                    total += 1
                    if cleared.contains(row * columns + column) { visible += 1 }
                }
            }
            if total > 0 && Double(visible) / Double(total) >= 0.80 {
                found.insert(index)
                // Finish exposing the found bone so the reward is visible.
                for row in 0..<rows {
                    for column in 0..<columns where isOverBone(column: column, row: row, index: index) {
                        cleared.insert(row * columns + column)
                    }
                }
                if let speechGameProgress {
                    speechGameProgress.advance()
                    break
                }
            }
        }
        if !wasComplete && found.count == bones.count { onComplete() }
    }
}

private struct BoneShape: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + x * rect.width, y: rect.minY + y * rect.height) }
        p.move(to: point(0.24, 0.35))
        p.addCurve(to: point(0.07, 0.38), control1: point(0.20, -0.03), control2: point(-0.01, 0.03))
        p.addCurve(to: point(0.24, 0.65), control1: point(-0.09, 0.81), control2: point(0.16, 1.02))
        p.addLine(to: point(0.76, 0.65))
        p.addCurve(to: point(0.93, 0.62), control1: point(0.80, 1.03), control2: point(1.01, 0.97))
        p.addCurve(to: point(0.76, 0.35), control1: point(1.09, 0.19), control2: point(0.84, -0.02))
        p.closeSubpath()
        return p
    }
}

private struct DiscoveryProgress: View {
    let value: Int
    let total: Int
    let label: String

    var body: some View {
        HStack(spacing: 12) {
            Text("\(value) / \(total)")
                .font(.system(.headline, design: .rounded))
                .monospacedDigit()
            ProgressView(value: Double(value), total: Double(total))
                .tint(DiscoveryPalette.teal)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.white.opacity(0.8), in: Capsule())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(value) of \(total) \(label)")
    }
}

private struct DiscoveryAction: View {
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.system(.body, design: .rounded).weight(.bold))
                .frame(maxWidth: .infinity, minHeight: 50)
                .padding(.horizontal, 12)
                .foregroundStyle(.white)
                .background(DiscoveryPalette.teal, in: RoundedRectangle(cornerRadius: 18))
        }
        .buttonStyle(.plain)
    }
}

private enum DiscoveryPalette {
    static let ink = Color(red: 0.153, green: 0.137, blue: 0.216)
    static let muted = Color(red: 0.40, green: 0.36, blue: 0.46)
    static let teal = Color(red: 0.067, green: 0.498, blue: 0.518)
}
