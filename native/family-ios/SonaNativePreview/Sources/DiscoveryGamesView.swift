import Combine
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
    @State private var dinoCompletion: NativeDinoCompletion?

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
                case .dino: NativeDinoDigRound(onFound: { dinoCompletion = $0 }, onComplete: complete)
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
                Text(dinoCompletion.map { "You found \($0.dino.a) \($0.dino.name)!" } ?? "You did it!")
                    .font(.system(.largeTitle, design: .rounded).weight(.heavy))
                if let dinoCompletion {
                    NativeDinoPicture(dino: dinoCompletion.dino, found: true).frame(height: 125)
                    NativeDinoCollectionRow(catalog: (try? NativeDinoCatalog.load()) ?? NativeDinoCatalog(dinos: [dinoCompletion.dino]), collection: dinoCompletion.collection).frame(height: 64)
                }
                Text(game == .dino ? "Eight words, eight bones. What a digger!" : "\(game.title) round finished.")
                    .font(.body)
                    .foregroundStyle(DiscoveryPalette.muted)
                    .multilineTextAlignment(.center)
                DiscoveryAction(title: "Play again", systemImage: "arrow.clockwise") {
                    if let guidedReplay { guidedReplay() }
                    else { finished = false; dinoCompletion = nil; roundID = UUID() }
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
    @Environment(\.arcadeRoundContext) private var arcadeRound
    @State private var wave = 0
    @State private var popped: Set<Int> = []
    @State private var completedPops = 0
    @State private var bonus = false
    @State private var giant = false
    private let colors: [Color] = [.cyan, .pink, .purple, .orange, .teal, .blue]
    private var waves: Int { speechGameProgress?.count ?? 5 }
    private var level: Int { arcadeRound?.level ?? 1 }
    private var bubbles: Int { bonus ? 3 : NativeArcadeDifficulty.bubbleCount(level: level, wave: wave) }
    private var total: Int {
        (0..<waves).map { NativeArcadeDifficulty.bubbleCount(level: level, wave: $0) }.reduce(0, +)
            + (level == 3 ? max(0, waves - 1) * 3 : 0) + 1
    }

    var body: some View {
        VStack(spacing: 12) {
            DiscoveryProgress(value: completedPops, total: total, label: "bubbles popped")
                .accessibilityIdentifier("bubbles-progress")
            if giant {
                Button { finishGiant() } label: {
                    Image("echo-cheer").resizable().scaledToFit()
                        .padding(20)
                        .background(.cyan.opacity(0.21), in: Circle())
                        .overlay(Circle().strokeBorder(.cyan.opacity(0.75), lineWidth: 4))
                        .frame(width: 190, height: 190)
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .accessibilityLabel("Pop the big bubble")
                .accessibilityIdentifier("bubbles-giant")
            } else {
                TimelineView(.animation(minimumInterval: 1.0 / 30, paused: reduceMotion || scenePhase != .active)) { timeline in
                GeometryReader { geometry in
                    let rows = max(1, (bubbles + 1) / 2)
                    let size = max(24, min(96, geometry.size.width * 0.29, geometry.size.height / CGFloat(rows) - 10))
                    let time = reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate
                    ZStack {
                        ForEach(0..<bubbles, id: \.self) { index in
                            let x = geometry.size.width * (index % 2 == 0 ? 0.27 : 0.73)
                            let y = geometry.size.height * (CGFloat(index / 2) + 0.5) / CGFloat(rows)
                            if popped.contains(index) {
                                Image(systemName: "sparkle")
                                    .font(.title)
                                    .foregroundStyle(colors[index % colors.count].opacity(0.45))
                                    .position(x: x, y: y)
                                    .accessibilityHidden(true)
                            } else {
                                Button { pop(index) } label: {
                                    Circle()
                                        .fill(LinearGradient(colors: [colors[index % colors.count].opacity(0.12), colors[index % colors.count].opacity(0.28)],
                                                             startPoint: .top, endPoint: .bottom))
                                        .overlay(Circle().strokeBorder(colors[index % colors.count].opacity(0.65), lineWidth: 2.5))
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
                                        .shadow(color: colors[index % colors.count].opacity(0.13), radius: 8, y: 5)
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
            }
            Text(giant ? "Pop the big bubble!" : bonus ? "Pop the bonus bubbles!" : "Pop this bunch…")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(DiscoveryPalette.muted)
                .frame(minHeight: 48)
        }
    }

    private func pop(_ index: Int) {
        guard speechGameProgress?.isMoveActive != false, popped.insert(index).inserted else { return }
        completedPops += 1
        guard popped.count == bubbles else { return }
        if wave == waves - 1 { giant = true }
        else if level == 3 && !bonus { bonus = true; popped = [] }
        else {
            wave += 1; popped = []; bonus = false
            speechGameProgress?.advance()
        }
    }

    private func finishGiant() {
        guard giant, speechGameProgress?.isMoveActive != false else { return }
        giant = false
        completedPops += 1
        speechGameProgress?.advance()
        onComplete()
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
