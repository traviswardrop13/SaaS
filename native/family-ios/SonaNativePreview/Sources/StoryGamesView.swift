import SwiftUI
import UIKit
import Combine

/// The original story games' core finger mechanics, isolated from speech,
/// entitlements, quest state, stickers, and practice accounting. The host
/// receives a preview-only callback after an explicitly finished round.
enum NativeStoryGame: String, CaseIterable, Identifiable {
    case lighthouse, windup, bridge
    var id: String { rawValue }
    var title: String {
        switch self {
        case .lighthouse: return "Light the Way"
        case .windup: return "Wind-Up Toys"
        case .bridge: return "Puzzle Bridge"
        }
    }
    fileprivate var ending: String {
        switch self {
        case .lighthouse: return "Every boat is home!"
        case .windup: return "The parade is on!"
        case .bridge: return "The bridge is whole again!"
        }
    }
    fileprivate var detail: String {
        switch self {
        case .lighthouse: return "You lit the way through the fog."
        case .windup: return "You woke up every toy."
        case .bridge: return "Every stone is back where it belongs."
        }
    }
}

struct StoryGamesView: View {
    let game: NativeStoryGame
    let onComplete: () -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var finished = false
    @State private var reported = false

    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 12) {
                HStack(spacing: 10) {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").font(.body.weight(.bold))
                            .frame(width: 46, height: 46).background(.white, in: Circle())
                    }
                    .accessibilityLabel("Close game").accessibilityIdentifier("story-game-close")
                    VStack(alignment: .leading, spacing: 2) {
                        Text(game.title)
                            .font(.system(.title3, design: .rounded).weight(.heavy))
                            .accessibilityAddTraits(.isHeader)
                            .accessibilityIdentifier("story-game-\(game.rawValue)")
                        Text("Native play preview").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                }
                if finished {
                    Spacer(minLength: 0)
                    Image(systemName: "sparkles").font(.system(size: 44)).foregroundStyle(StoryGameStyle.gold)
                    Text(game.ending).font(.system(.title, design: .rounded).weight(.heavy)).multilineTextAlignment(.center)
                        .accessibilityIdentifier("story-game-finished")
                    Text(game.detail).font(.body).multilineTextAlignment(.center)
                    Spacer(minLength: 0)
                    Button {
                        guard !reported else { return }
                        reported = true
                        onComplete()
                    } label: {
                        Text("Continue").font(.headline).frame(maxWidth: .infinity).frame(minHeight: 52)
                    }
                    .buttonStyle(.borderedProminent).tint(StoryGameStyle.ink)
                    .disabled(reported).accessibilityIdentifier("story-game-continue")
                } else {
                    Group {
                        switch game {
                        case .lighthouse: NativeLighthouseRound { finished = true }
                        case .windup: NativeWindupRound { finished = true }
                        case .bridge: NativeBridgeRound { finished = true }
                        }
                    }
                    .frame(maxHeight: .infinity)
                }
            }
            .padding(16)
            .frame(maxWidth: 720, maxHeight: .infinity)
            .frame(maxWidth: .infinity)
        }
        .background(StoryGameStyle.paper.ignoresSafeArea())
        .foregroundStyle(StoryGameStyle.ink)
        .preferredColorScheme(.light)
    }
}

private enum StoryGameStyle {
    static let ink = Color(red: 0.13, green: 0.20, blue: 0.27)
    static let paper = Color(red: 0.97, green: 0.96, blue: 0.92)
    static let gold = Color(red: 0.94, green: 0.68, blue: 0.22)
    static let teal = Color(red: 0.13, green: 0.48, blue: 0.46)
}

/// Original assets only. Bundled originals work offline; a missing bundle
/// entry may use the same authored asset from the existing family host.
private struct StoryGameArt: View {
    let name: String
    var symbol = "sparkles"
    var body: some View {
        Group {
            if let image = UIImage(named: name) {
                Image(uiImage: image).resizable().scaledToFit()
            } else {
                AsyncImage(url: URL(string: "https://app.speaksona.com/assets/crafted/game/\(name).webp")) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFit()
                    } else {
                        Image(systemName: symbol).resizable().scaledToFit().padding(8)
                            .foregroundStyle(StoryGameStyle.gold)
                    }
                }
            }
        }
        .accessibilityHidden(true)
    }
}

private struct StoryGameBackdrop: View {
    let name: String
    let color: Color
    var body: some View {
        GeometryReader { geo in
            color
            StoryGameArt(name: name, symbol: "").frame(width: geo.size.width, height: geo.size.height)
        }.clipped().allowsHitTesting(false)
    }
}

private struct StoryGameInstruction: View {
    let text: String
    var body: some View {
        Text(text).font(.system(.body, design: .rounded).weight(.bold))
            .multilineTextAlignment(.center).frame(maxWidth: .infinity, minHeight: 48)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityIdentifier("story-game-instruction")
    }
}

private struct NativeLighthouseRound: View {
    let onFinish: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @State private var stage = 0
    @State private var finger: CGPoint?
    @State private var held: Double = 0
    @State private var lit: Set<Int> = []
    @State private var boardSize: CGSize = .zero
    @State private var lastTick: Date?
    private let clock = Timer.publish(every: 1 / 30, on: .main, in: .common).autoconnect()
    private let boats = ["tug", "row", "sail", "banana", "teacup", "bathtub", "ferry"]
    private let names = ["tugboat", "rowboat", "sailboat", "banana boat", "teacup boat", "bathtub boat", "big ferry"]
    // Exact authored directions from lighthouse.js STEP_LINES.
    private let lines = [
        "Move the light over the fog. Find the tugboat!",
        "Find the rowboat with the three mice!",
        "The sailboat is drifting. Find it with the light!",
        "Find the banana boat! Something big is napping out there.",
        "Uh oh, the moon went behind a cloud. Look by the big rocks for the teacup boat!",
        "Find the bathtub boat. Rub-a-dub!",
        "Find the big ferry and bring everyone home!",
        "Now shine the light on the town. Light up every window!"
    ]
    private let anchors: [CGPoint] = [
        .init(x: 0.30, y: 0.68), .init(x: 0.58, y: 0.45), .init(x: 0.70, y: 0.45),
        .init(x: 0.38, y: 0.575), .init(x: 0.15, y: 0.455), .init(x: 0.60, y: 0.415), .init(x: 0.30, y: 0.66)
    ]
    private let windows: [CGPoint] = [
        .init(x: 0.6439, y: 0.5658), .init(x: 0.7283, y: 0.5656), .init(x: 0.8231, y: 0.5659), .init(x: 0.9180, y: 0.5654),
        .init(x: 0.5912, y: 0.6253), .init(x: 0.6993, y: 0.6253), .init(x: 0.8048, y: 0.6254), .init(x: 0.9079, y: 0.6254),
        .init(x: 0.5604, y: 0.6971), .init(x: 0.6698, y: 0.6971), .init(x: 0.7778, y: 0.6971), .init(x: 0.8915, y: 0.6971)
    ]

    var body: some View {
        VStack(spacing: 10) {
            StoryGameInstruction(text: lines[min(stage, 7)])
            GeometryReader { geo in
                let rect = picture(in: geo.size)
                ZStack {
                    Color(red: 0.05, green: 0.10, blue: 0.29)
                    StoryGameArt(name: "lighthouse-sea", symbol: "moon.stars.fill")
                        .frame(width: rect.width, height: rect.height).position(x: rect.midX, y: rect.midY)
                    Color.black.opacity(finger == nil ? 0.30 : 0.10)
                    ForEach(0..<min(stage, 7), id: \.self) { index in
                        StoryGameArt(name: "lighthouse-boat-\(boats[index])", symbol: "ferry.fill")
                            .frame(width: max(28, geo.size.width * 0.10), height: 34)
                            .position(x: geo.size.width * (0.37 + CGFloat(index % 4) * 0.12), y: geo.size.height * (0.86 + CGFloat(index / 4) * 0.07))
                    }
                    if stage < 7 {
                        let target = point(anchors[stage], in: geo.size)
                        StoryGameArt(name: "lighthouse-boat-\(boats[stage])", symbol: "ferry.fill")
                            .frame(width: max(66, geo.size.width * (stage == 6 ? 0.25 : 0.19)), height: 92)
                            .position(target)
                        Circle().trim(from: 0, to: held / 0.5).stroke(StoryGameStyle.gold, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                            .frame(width: 78, height: 78).rotationEffect(.degrees(-90)).position(target)
                    } else {
                        ForEach(windows.indices, id: \.self) { index in
                            Circle().fill(lit.contains(index) ? StoryGameStyle.gold : .white.opacity(0.18))
                                .frame(width: 15, height: 15)
                                .shadow(color: lit.contains(index) ? .yellow.opacity(0.8) : .clear, radius: 7)
                                .position(point(windows[index], in: geo.size))
                        }
                    }
                    if let finger {
                        Circle().fill(RadialGradient(colors: [.yellow.opacity(0.46), .yellow.opacity(0.12), .clear], center: .center, startRadius: 8, endRadius: 86))
                            .frame(width: 172, height: 172).position(x: finger.x, y: finger.y - 56)
                            .allowsHitTesting(false)
                    }
                }
                .contentShape(Rectangle()).clipped()
                .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                    finger = value.location
                    boardSize = geo.size
                }.onEnded { _ in finger = nil; held = 0 })
                .onAppear { boardSize = geo.size }
                .onChange(of: geo.size) { boardSize = $0 }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(stage < 7 ? "Lost boat: the \(names[stage])" : "Town windows")
                .accessibilityHint("Move and hold the light on the picture.")
                .accessibilityIdentifier("lighthouse-sea")
            }
            .clipShape(RoundedRectangle(cornerRadius: 24))
            HStack {
                Image(systemName: "light.beacon.max.fill").foregroundStyle(StoryGameStyle.gold)
                Text(stage < 7 ? "\(stage) of 7 boats home" : "\(lit.count) of 12 windows lit")
                    .font(.subheadline.weight(.semibold)).monospacedDigit()
                Spacer()
            }.frame(minHeight: 30)
        }
        .onReceive(clock) { now in
            let dt = min(0.1, max(0, now.timeIntervalSince(lastTick ?? now)))
            lastTick = now
            guard scenePhase == .active, let finger, boardSize.width > 0 else { return }
            if stage < 7 {
                if illuminated(point(anchors[stage], in: boardSize), by: finger) {
                    held += dt
                    if held >= 0.5 { stage += 1; held = 0; self.finger = nil }
                } else { held = 0 }
            } else {
                for index in windows.indices where illuminated(point(windows[index], in: boardSize), by: finger) { lit.insert(index) }
                if lit.count == windows.count { self.finger = nil; onFinish() }
            }
        }
        .onChange(of: scenePhase) { phase in if phase != .active { finger = nil; held = 0; lastTick = nil } }
        .onDisappear { finger = nil; held = 0 }
    }
    private func picture(in size: CGSize) -> CGRect {
        let scale = min(size.width / 800, size.height / 1200)
        return CGRect(x: (size.width - 800 * scale) / 2, y: (size.height - 1200 * scale) / 2, width: 800 * scale, height: 1200 * scale)
    }
    private func point(_ anchor: CGPoint, in size: CGSize) -> CGPoint {
        let r = picture(in: size)
        return CGPoint(x: r.minX + anchor.x * r.width, y: r.minY + anchor.y * r.height)
    }
    private func illuminated(_ point: CGPoint, by finger: CGPoint) -> Bool {
        // The original light sits 56 points above the finger; the find zone
        // includes the fingertip so touching a visible boat also finds it.
        let beam = CGPoint(x: finger.x, y: finger.y - 56)
        return hypot(point.x - beam.x, point.y - beam.y) < 66 || hypot(point.x - finger.x, point.y - finger.y) < 47
    }
}

private struct NativeWindupRound: View {
    let onFinish: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var stage = 0
    @State private var turns: Double = 0
    @State private var misses = 0
    @State private var previousAngle: Double?
    @State private var previousPoint: CGPoint?
    @State private var sweep: Double = 0
    @State private var origin: Double = 0
    @State private var credit: Double = 0
    @State private var effort: Double = 0
    @State private var feedback = ""
    @State private var awake = false
    private let toys = ["bunny", "frog", "top", "croc", "elephant", "jack-closed", "hippo", "musicbox"]
    // Exact authored directions from windup.js STEP_LINES.
    private let lines = [
        "Draw circles around the key to wind it. Let go at the star!",
        "Wind up the frog. Let go when the needle reaches the star!",
        "Wind up the spinning top. Round and round, then let go at the star!",
        "Wind up the crocodile. Clack, clack!",
        "Cuckoo! Now the big toys on the top shelf. Their keys need more turns.",
        "Wind up the jack-in-the-box. Let go at the star, and pop!",
        "Wind up the hippo. She wants to dance!",
        "Turn the big crank on the music box to start the parade!"
    ]
    private var need: Double { stage == 7 ? 4 : stage >= 4 ? 3.5 : 2.5 }
    private var halfStar: Double { (stage >= 4 ? 0.25 : 0.3) * (misses > 0 ? 1.6 : 1) }
    private var top: Double { need + 1 }

    var body: some View {
        VStack(spacing: 10) {
            StoryGameInstruction(text: lines[stage])
            GeometryReader { geo in
                let radius = min(82.0, geo.size.width * 0.27, geo.size.height * 0.24)
                let center = CGPoint(x: geo.size.width / 2, y: geo.size.height * 0.72)
                ZStack {
                    StoryGameBackdrop(name: stage >= 4 && stage < 7 ? "windup-shelf" : "windup-shop", color: Color(red: 0.84, green: 0.66, blue: 0.45))
                    Color.brown.opacity(0.08)
                    StoryGameArt(name: "windup-\(awake && stage == 5 ? "jack-open" : toys[stage])", symbol: stage == 7 ? "music.note.house.fill" : "teddybear.fill")
                        .frame(width: min(210, geo.size.width * 0.57), height: geo.size.height * 0.43)
                        .scaleEffect(awake && !reduceMotion ? 1.08 : 1)
                        .position(x: geo.size.width / 2, y: geo.size.height * 0.26)
                    Circle().fill(Color(red: 0.94, green: 0.76, blue: 0.39)).shadow(color: .brown.opacity(0.3), radius: 8, y: 5)
                        .frame(width: radius * 2.3, height: radius * 2.3).position(center)
                    Circle().stroke(.white.opacity(0.45), style: StrokeStyle(lineWidth: 3, dash: [6, 7]))
                        .frame(width: radius * 1.8, height: radius * 1.8).position(center)
                    StoryGameArt(name: "windup-dial", symbol: "arrow.trianglehead.2.clockwise.rotate.90")
                        .frame(width: radius * 1.6, height: radius * 1.6)
                        .rotationEffect(.radians(reduceMotion ? 0 : turns * .pi * 2)).position(center)
                    Image(systemName: "arrow.clockwise").font(.system(size: 28, weight: .heavy))
                        .foregroundStyle(Color.brown.opacity(0.65)).position(x: center.x, y: center.y - radius * 0.72)
                    if awake {
                        Text("Just right!").font(.title3.bold()).padding(10)
                            .background(.ultraThinMaterial, in: Capsule()).position(x: center.x, y: geo.size.height * 0.48)
                    }
                }
                .contentShape(Rectangle()).clipped()
                .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                    guard !awake, scenePhase == .active else { return }
                    wind(value.location, center: center, radius: radius)
                }.onEnded { _ in release() })
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Winding key")
                .accessibilityHint("Draw circles around the key, then let go at the star.")
                .accessibilityIdentifier("windup-dial")
            }
            .clipShape(RoundedRectangle(cornerRadius: 24))
            meter
            Text(feedback.isEmpty ? "\(stage) of 8 toys awake" : feedback)
                .font(.subheadline.weight(.semibold)).frame(minHeight: 22).multilineTextAlignment(.center)
            if awake {
                Button(stage == 7 ? "Finish parade" : "Next toy") { advance() }
                    .font(.headline).frame(maxWidth: .infinity, minHeight: 48)
                    .background(StoryGameStyle.ink, in: Capsule()).foregroundStyle(.white)
                    .accessibilityIdentifier("windup-next")
            }
        }
        .onChange(of: scenePhase) { phase in if phase != .active { resetFinger() } }
    }
    private var meter: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.black.opacity(0.08))
                Capsule().fill(awake ? StoryGameStyle.teal : StoryGameStyle.gold)
                    .frame(width: max(0, geo.size.width * min(1, turns / top)))
                if stage < 7 {
                    RoundedRectangle(cornerRadius: 5).fill(StoryGameStyle.gold.opacity(0.35))
                        .frame(width: max(24, geo.size.width * halfStar * 2 / top))
                        .position(x: geo.size.width * need / top, y: 14)
                    Image(systemName: "star.fill").foregroundStyle(Color.brown)
                        .position(x: geo.size.width * need / top, y: 14)
                }
            }
        }.frame(height: 28).accessibilityLabel("Spring meter").accessibilityValue("\(Int(min(1, turns / need) * 100)) percent")
    }
    private func wind(_ p: CGPoint, center: CGPoint, radius: CGFloat) {
        let distance = hypot(p.x - center.x, p.y - center.y)
        let angle = atan2(Double(p.y - center.y), Double(p.x - center.x))
        let inRing = distance >= radius * 0.15 && distance <= radius * 1.4
        var gained: Double = 0
        if let previousPoint {
            let travel = hypot(p.x - previousPoint.x, p.y - previousPoint.y)
            if travel > 0.5 { effort += Double(travel) / 80 }
            if effort >= 8 && distance <= radius * 1.4 || effort >= 12 {
                gained = Double(travel / (2 * .pi * radius))
            }
        }
        if inRing, let previousAngle {
            var delta = angle - previousAngle
            while delta > .pi { delta -= 2 * .pi }
            while delta < -.pi { delta += 2 * .pi }
            if abs(delta) <= 1.2 {
                sweep += delta
                let far = abs(sweep - origin)
                if far > credit { gained = max(gained, (far - credit) / (2 * .pi)); credit = far }
                else if credit - far > .pi * 1.5 { origin = sweep; credit = 0 }
            }
        }
        previousAngle = inRing ? angle : nil
        previousPoint = p
        turns = min(top, turns + gained * (misses > 0 ? 0.75 : 1))
        if misses >= 2 { turns = min(turns, need) }
        if stage == 7 && turns >= need { awake = true; feedback = "The parade is on!"; resetFinger() }
        else if effort >= 12 { feedback = "Drag anywhere to wind!" }
        else if effort >= 8 { feedback = "Rub the dial to wind it" }
    }
    private func release() {
        resetFinger()
        guard !awake, scenePhase == .active, turns >= need * 0.3, stage < 7 else { return }
        if misses >= 3 || abs(turns - need) <= halfStar {
            awake = true; feedback = "Just right!"
        } else if turns < need {
            misses += 1; feedback = "A little more winding!"
        } else {
            misses += 1; turns = max(need * 0.3, need - halfStar - 0.05)
            feedback = "Whoa, dizzy! Let go a bit sooner"
        }
    }
    private func resetFinger() { previousAngle = nil; previousPoint = nil; sweep = 0; origin = 0; credit = 0 }
    private func advance() {
        guard awake else { return }
        if stage == 7 { onFinish(); return }
        stage += 1; turns = 0; misses = 0; effort = 0; feedback = ""; awake = false; resetFinger()
    }
}

private struct NativeBridgeRound: View {
    let onFinish: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @State private var stage = 0
    @State private var quarterTurns = 1
    @State private var stone: CGPoint?
    @State private var dragStart: CGPoint?
    @State private var touchBegan: Date?
    @State private var misses = 0
    @State private var feedback = ""
    @State private var seated = false
    private let initialTurns = [1, 1, 2, 1, 2, 3, 2, 1]
    // Exact authored directions from bridge.js STEP_LINES.
    private let lines = [
        "Tap the stone to turn it. Then slide it into its hole!",
        "Turn the stone the right way, then slide it in. Click!",
        "This one looks like a boot! Turn it and fit it.",
        "Look at the hole. Turn the stone to match, then slide it in.",
        "The river is rising! Grab the stone from the water. Then turn it and fit it.",
        "Catch the floating stone. Turn it, and slide it in!",
        "Up high now! Turn the stone and fit it in the arch.",
        "The last stone is the heart. Put it at the very top!"
    ]

    var body: some View {
        VStack(spacing: 10) {
            StoryGameInstruction(text: lines[stage])
            GeometryReader { geo in
                let side = min(110, geo.size.width * 0.31)
                let hole = CGPoint(x: geo.size.width * (stage % 2 == 0 ? 0.34 : 0.66), y: geo.size.height * 0.35)
                let start = CGPoint(x: geo.size.width * 0.50, y: geo.size.height * 0.78)
                let position = seated ? hole : stone ?? start
                ZStack {
                    StoryGameBackdrop(name: "bridge-canyon-wide", color: Color(red: 0.55, green: 0.77, blue: 0.76))
                    Canvas { context, size in
                        var deck = Path()
                        deck.move(to: CGPoint(x: 0, y: size.height * 0.52))
                        deck.addQuadCurve(to: CGPoint(x: size.width, y: size.height * 0.52), control: CGPoint(x: size.width / 2, y: size.height * 0.02))
                        context.stroke(deck, with: .color(Color(red: 0.76, green: 0.59, blue: 0.39)), style: StrokeStyle(lineWidth: 58, lineCap: .round))
                        for index in 0..<stage {
                            let x = size.width * (0.10 + CGFloat(index) * 0.11)
                            let y = size.height * (0.36 + 0.16 * pow((x / size.width - 0.5) * 2, 2))
                            let r = CGRect(x: x - 12, y: y - 12, width: 24, height: 24)
                            context.fill(StoryBridgeStone(index: index).path(in: r), with: .color(StoryGameStyle.gold))
                        }
                    }.allowsHitTesting(false)
                    StoryBridgeStone(index: stage).fill(Color(red: 0.20, green: 0.23, blue: 0.22))
                        .frame(width: side, height: side).position(hole)
                    StoryBridgeStone(index: stage).stroke(.white.opacity(misses > 0 ? 0.9 : 0.45), style: StrokeStyle(lineWidth: 3, dash: [6, 5]))
                        .frame(width: side, height: side).position(hole)
                    if !seated {
                        Image(systemName: "arrow.up").font(.system(size: 26, weight: .bold)).foregroundStyle(.white.opacity(0.75))
                            .position(x: geo.size.width / 2, y: geo.size.height * 0.58).allowsHitTesting(false)
                    }
                    StoryBridgeStone(index: stage).fill(seated ? StoryGameStyle.gold : Color(red: 0.91, green: 0.75, blue: 0.52))
                        .overlay(StoryBridgeStone(index: stage).stroke(Color.brown.opacity(0.5), lineWidth: 2))
                        .frame(width: side, height: side).rotationEffect(.degrees(Double(quarterTurns * 90)))
                        .shadow(color: .black.opacity(0.20), radius: seated ? 1 : 7, y: seated ? 0 : 5)
                        .position(position)
                        .gesture(DragGesture(minimumDistance: 0, coordinateSpace: .named("bridge-board"))
                            .onChanged { value in
                                guard !seated, scenePhase == .active else { return }
                                if dragStart == nil { dragStart = stone ?? start; touchBegan = value.time }
                                stone = CGPoint(x: (dragStart?.x ?? start.x) + value.translation.width,
                                                y: (dragStart?.y ?? start.y) + value.translation.height)
                            }
                            .onEnded { value in
                                guard !seated, scenePhase == .active else { dragStart = nil; return }
                                if hypot(value.translation.width, value.translation.height) < 12 && value.time.timeIntervalSince(touchBegan ?? value.time) < 0.3 {
                                    stone = dragStart; turn()
                                } else { drop(at: stone ?? start, hole: hole, side: side) }
                                dragStart = nil; touchBegan = nil
                            })
                        .accessibilityLabel("Bridge stone")
                        .accessibilityHint("Tap to turn. Drag to the matching hole.")
                        .accessibilityIdentifier("bridge-stone")
                }
                .coordinateSpace(name: "bridge-board").clipped()
                .accessibilityIdentifier("bridge-board")
                .onChange(of: geo.size) { _ in stone = nil; dragStart = nil }
            }
            .clipShape(RoundedRectangle(cornerRadius: 24))
            HStack {
                Text(feedback.isEmpty ? "\(stage) of 8 stones fitted" : feedback)
                    .font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity, alignment: .leading)
                if seated {
                    Button(stage == 7 ? "Finish bridge" : "Next stone") { advance() }
                        .font(.headline).padding(.horizontal, 16).frame(minHeight: 48)
                        .background(StoryGameStyle.ink, in: Capsule()).foregroundStyle(.white)
                        .accessibilityIdentifier("bridge-next")
                } else {
                    Button { turn() } label: {
                        Label("Turn", systemImage: "rotate.right").font(.headline).padding(.horizontal, 18).frame(minHeight: 48)
                    }.background(.white, in: Capsule()).accessibilityIdentifier("bridge-turn")
                }
            }
        }
        .onChange(of: scenePhase) { phase in if phase != .active { stone = nil; dragStart = nil } }
    }
    private func turn() {
        guard !seated else { return }
        quarterTurns = (quarterTurns + 1) % 4
        feedback = ""
    }
    private func drop(at p: CGPoint, hole: CGPoint, side: CGFloat) {
        guard hypot(p.x - hole.x, p.y - hole.y) < side * (misses >= 2 ? 1.1 : 0.72) else { stone = nil; return }
        if quarterTurns % 4 == 0 || misses >= 2 {
            quarterTurns = 0; stone = hole; seated = true; feedback = "Click!"
        } else {
            misses += 1; stone = nil; feedback = "Almost! Give it a turn."
        }
    }
    private func advance() {
        guard seated else { return }
        if stage == 7 { onFinish(); return }
        stage += 1; quarterTurns = initialTurns[stage]; stone = nil; dragStart = nil
        misses = 0; feedback = ""; seated = false
    }
}

/// Original bridge.js SHAPES polygons; the bridge is drawn in the shipping
/// game too, so the native piece and its matching hole share one exact path.
private struct StoryBridgeStone: Shape {
    let index: Int
    func path(in rect: CGRect) -> Path {
        let polygons: [[[Double]]] = [
            [[-0.5,-0.5],[-0.17,-0.5],[-0.17,0.17],[0.5,0.17],[0.5,0.5],[-0.5,0.5]],
            [[-0.5,-0.5],[0.5,-0.5],[0.5,-0.12],[0.17,-0.12],[0.17,0.5],[-0.17,0.5],[-0.17,-0.12],[-0.5,-0.12]],
            [[-0.44,-0.5],[-0.02,-0.5],[-0.02,0.04],[0.32,0.1],[0.5,0.28],[0.5,0.5],[-0.44,0.5]],
            [[-0.5,-0.17],[0.04,-0.17],[0.04,-0.5],[0.5,0],[0.04,0.5],[0.04,0.17],[-0.5,0.17]],
            [[-0.5,0.5],[-0.5,0.17],[-0.17,0.17],[-0.17,-0.17],[0.17,-0.17],[0.17,-0.5],[0.5,-0.5],[0.5,0.5]],
            [[0.17,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5],[-0.5,0.02],[-0.17,0.02],[-0.17,0.17],[0.17,0.17]]
        ]
        var points: [CGPoint]
        if index < polygons.count {
            points = polygons[index].map { CGPoint(x: $0[0], y: $0[1]) }
        } else if index == 6 {
            points = (0...24).map { i in
                let angle = Double(i) / 24 * .pi
                return CGPoint(x: 0.5 * cos(angle), y: -0.25 + 0.5 * sin(angle))
            }
        } else {
            let raw = (0..<40).map { i -> CGPoint in
                let t = Double(i) / 40 * .pi * 2
                return CGPoint(x: 16 * pow(sin(t), 3), y: -(13 * cos(t) - 5 * cos(2*t) - 2 * cos(3*t) - cos(4*t)))
            }
            let minX = raw.map(\.x).min() ?? -16, maxX = raw.map(\.x).max() ?? 16
            let minY = raw.map(\.y).min() ?? -16, maxY = raw.map(\.y).max() ?? 16
            points = raw.map { CGPoint(x: ($0.x - minX) / (maxX - minX) - 0.5, y: ($0.y - minY) / (maxY - minY) - 0.5) }
        }
        var path = Path()
        for (i, p) in points.enumerated() {
            let at = CGPoint(x: rect.midX + p.x * rect.width, y: rect.midY + p.y * rect.height)
            if i == 0 { path.move(to: at) } else { path.addLine(to: at) }
        }
        path.closeSubpath()
        return path
    }
}
