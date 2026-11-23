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
    @Environment(\.speechGameProgress) private var speechGameProgress
    @Environment(\.guidedReplay) private var guidedReplay
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
                        if speechGameProgress == nil { Text("Play preview").font(.caption.weight(.semibold)).foregroundStyle(.secondary) }
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
                    if let guidedReplay { Button("Play again", action: guidedReplay).frame(minHeight: 44) }
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

/// Uses the existing asset catalog first, then original artwork bundled by path.
private struct StoryGameArt: View {
    let name: String
    var symbol = "sparkles"
    @State private var bundledName: String?
    @State private var bundledImage: UIImage?

    var body: some View {
        Group {
            if let image = UIImage(named: name) ?? (bundledName == name ? bundledImage : nil) {
                Image(uiImage: image).resizable().scaledToFit()
            } else if !symbol.isEmpty {
                Image(systemName: symbol).resizable().scaledToFit().padding(8)
                    .foregroundStyle(StoryGameStyle.gold)
            }
        }
        .accessibilityHidden(true)
        .task(id: name) {
            guard UIImage(named: name) == nil else { return }
            let image = try? await NativeArtworkLoader.shared.image(path: "/assets/crafted/game/\(name).webp")
            guard !Task.isCancelled else { return }
            bundledName = name
            bundledImage = image
        }
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
    @Environment(\.speechGameProgress) private var speechGameProgress
    @State private var stage = 0
    @State private var finger: CGPoint?
    @State private var held: Double = 0
    @State private var lit: Set<Int> = []
    @State private var boardSize: CGSize = .zero
    @State private var lastTick: Date?
    @State private var bright: TimeInterval = 0
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
    private var boatCount: Int { min(boats.count, (speechGameProgress?.count ?? 8) - 1) }

    var body: some View {
        VStack(spacing: 10) {
            StoryGameInstruction(text: lines[stage < boatCount ? stage : lines.count - 1])
            GeometryReader { geo in
                let rect = picture(in: geo.size)
                ZStack {
                    Color(red: 0.05, green: 0.10, blue: 0.29)
                    StoryGameArt(name: "lighthouse-sea", symbol: "moon.stars.fill")
                        .frame(width: rect.width, height: rect.height).position(x: rect.midX, y: rect.midY)
                    Color.black.opacity(bright > 0 ? 0.04 : finger == nil ? 0.30 : 0.10)
                    ForEach(0..<min(stage, boatCount), id: \.self) { index in
                        StoryGameArt(name: "lighthouse-boat-\(boats[index])", symbol: "ferry.fill")
                            .frame(width: max(28, geo.size.width * 0.10), height: 34)
                            .position(x: geo.size.width * (0.37 + CGFloat(index % 4) * 0.12), y: geo.size.height * (0.86 + CGFloat(index / 4) * 0.07))
                    }
                    if stage < boatCount {
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
                        let radius: CGFloat = bright > 0 ? 172 : 86
                        Circle().fill(RadialGradient(colors: [.yellow.opacity(0.46), .yellow.opacity(0.12), .clear], center: .center, startRadius: 8, endRadius: radius))
                            .frame(width: radius * 2, height: radius * 2).position(x: finger.x, y: finger.y - 56)
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
                .accessibilityLabel(stage < boatCount ? "Lost boat: the \(names[stage])" : "Town windows")
                .accessibilityHint("Move and hold the light on the picture.")
                .accessibilityIdentifier("lighthouse-sea")
            }
            .clipShape(RoundedRectangle(cornerRadius: 24))
            HStack {
                Image(systemName: "light.beacon.max.fill").foregroundStyle(StoryGameStyle.gold)
                Text(stage < boatCount ? "\(stage) of \(boatCount) boats home" : "\(lit.count) of \(windows.count) windows lit")
                    .font(.subheadline.weight(.semibold)).monospacedDigit()
                Spacer()
            }.frame(minHeight: 30)
            if finger == nil, bright == 0, let requestHelp = speechGameProgress?.requestHelp {
                Button("Bright beam") { _ = requestHelp { earned in if earned { bright = 10 } } }
                    .buttonStyle(.bordered).frame(minHeight: 44)
                    .accessibilityIdentifier("lighthouse-help")
            }
        }
        .onReceive(clock) { now in
            guard scenePhase == .active, speechGameProgress?.isMoveActive != false,
                  finger != nil || bright > 0 else {
                if lastTick != nil { lastTick = nil }
                return
            }
            let dt = min(0.1, max(0, now.timeIntervalSince(lastTick ?? now)))
            lastTick = now
            if bright > 0 { bright = max(0, bright - dt) }
            guard let finger, boardSize.width > 0 else { return }
            if stage < boatCount {
                if illuminated(point(anchors[stage], in: boardSize), by: finger) {
                    held += dt
                    if held >= 0.5 {
                        stage += 1; held = 0; self.finger = nil; bright = 0
                        speechGameProgress?.advance()
                    }
                } else { held = 0 }
            } else {
                for index in windows.indices where illuminated(point(windows[index], in: boardSize), by: finger) { lit.insert(index) }
                if lit.count == windows.count { self.finger = nil; speechGameProgress?.advance(); onFinish() }
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
        let fold: CGFloat = bright > 0 ? 2 : 1
        return hypot(point.x - beam.x, point.y - beam.y) < 66 * fold ||
               hypot(point.x - finger.x, point.y - finger.y) < 47 * fold
    }
}

private struct NativeWindupRound: View {
    let onFinish: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.speechGameProgress) private var speechGameProgress
    @State private var stage = 0
    @State private var turns: Double = 0
    @State private var misses = 0
    @State private var previousAngle: Double?
    @State private var previousPoint: CGPoint?
    @State private var fingerStart: CGPoint?
    @State private var sweep: Double = 0
    @State private var origin: Double = 0
    @State private var credit: Double = 0
    @State private var effort: Double = 0
    @State private var effortAtTouch: Double = 0
    @State private var woundTotal: Double = 0
    @State private var lastMovement: TimeInterval = -.infinity
    @State private var lastQuarterTurn: TimeInterval = -.infinity
    @State private var lastTick: TimeInterval?
    @State private var feedback = ""
    @State private var awake = false
    @State private var oiled: TimeInterval = 0
    private let oilClock = Timer.publish(every: 0.05, on: .main, in: .common).autoconnect()
    private let bigToys = ["bunny", "frog", "top", "croc", "elephant", "jack-closed", "hippo", "musicbox"]
    private let littleToys = ["bunny", "frog", "elephant", "hippo", "top", "musicbox"]
    // Exact authored directions from windup.js STEP_LINES.
    private let bigLines = [
        "Draw circles around the key to wind it. Let go at the star!",
        "Wind up the frog. Let go when the needle reaches the star!",
        "Wind up the spinning top. Round and round, then let go at the star!",
        "Wind up the crocodile. Clack, clack!",
        "Cuckoo! Now the big toys on the top shelf. Their keys need more turns.",
        "Wind up the jack-in-the-box. Let go at the star, and pop!",
        "Wind up the hippo. She wants to dance!",
        "Turn the big crank on the music box to start the parade!"
    ]
    private let littleLines = [
        "Draw circles on the key until it rings!",
        "Wind up the frog until it rings!",
        "Wind up the elephant. Round and round!",
        "Wind up the hippo. She wants to dance!",
        "Wind up the spinning top!",
        "Turn the big crank to start the parade!"
    ]
    private var little: Bool { speechGameProgress?.count == littleToys.count }
    private var toys: [String] { little ? littleToys : bigToys }
    private var lines: [String] { little ? littleLines : bigLines }
    private var lastToy: Bool { stage == toys.count - 1 }
    private var hasStar: Bool { !little && !lastToy }
    private var onUpperShelf: Bool { !little && stage >= 4 && !lastToy }
    private var need: Double { little ? 2 : lastToy ? 4 : stage >= 4 ? 3.5 : 2.5 }
    private var halfStar: Double { (stage >= 4 ? 0.25 : 0.3) * (oiled > 0 ? 1.8 : misses > 0 ? 1.6 : 1) }
    private var top: Double { hasStar ? need / 0.7 : need }

    var body: some View {
        VStack(spacing: 10) {
            StoryGameInstruction(text: lines[stage])
            GeometryReader { geo in
                let radius = min(82.0, geo.size.width * 0.27, geo.size.height * 0.24)
                let center = CGPoint(x: geo.size.width / 2, y: geo.size.height * 0.72)
                ZStack {
                    StoryGameBackdrop(name: onUpperShelf ? "windup-shelf" : "windup-shop", color: Color(red: 0.84, green: 0.66, blue: 0.45))
                    Color.brown.opacity(0.08)
                    StoryGameArt(name: "windup-\(awake && toys[stage] == "jack-closed" ? "jack-open" : toys[stage])", symbol: lastToy ? "music.note.house.fill" : "teddybear.fill")
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
                        Text(lastToy ? "The parade is on!" : little ? "Ding! Wake up!" : "Just right!")
                            .font(.title3.bold()).padding(10)
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
                .accessibilityHint(hasStar ? "Draw circles around the key, then let go at the star." : lines[stage])
                .accessibilityIdentifier("windup-dial")
            }
            .clipShape(RoundedRectangle(cornerRadius: 24))
            meter
            Text(feedback.isEmpty ? "\(stage) of \(toys.count) toys awake" : feedback)
                .font(.subheadline.weight(.semibold)).frame(minHeight: 22).multilineTextAlignment(.center)
            if awake {
                Button(lastToy ? "Finish parade" : "Next toy") { advance() }
                    .font(.headline).frame(maxWidth: .infinity, minHeight: 48)
                    .background(StoryGameStyle.ink, in: Capsule()).foregroundStyle(.white)
                    .accessibilityIdentifier("windup-next")
            } else if previousPoint == nil, oiled == 0, let requestHelp = speechGameProgress?.requestHelp {
                Button("Oil the key") {
                    _ = requestHelp { earned in if earned { oiled = 10; feedback = "The key turns more easily." } }
                }.buttonStyle(.bordered).frame(minHeight: 44)
                    .accessibilityIdentifier("windup-help")
            }
        }
        .onReceive(oilClock) { _ in updateClock() }
        .onChange(of: scenePhase) { phase in if phase != .active { resetFinger(); lastTick = nil } }
    }
    private var meter: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.black.opacity(0.08))
                Capsule().fill(awake ? StoryGameStyle.teal : StoryGameStyle.gold)
                    .frame(width: max(0, geo.size.width * min(1, turns / top)))
                if hasStar {
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
        let now = ProcessInfo.processInfo.systemUptime
        if fingerStart == nil { fingerStart = p; effortAtTouch = effort }
        let distance = hypot(p.x - center.x, p.y - center.y)
        let angle = atan2(Double(p.y - center.y), Double(p.x - center.x))
        let inRing = distance >= radius * 0.15 && distance <= radius * 1.4
        var gained: Double = 0
        if let previousPoint {
            let travel = hypot(p.x - previousPoint.x, p.y - previousPoint.y)
            if travel > 0.5 { lastMovement = now }
            let previousDistance = hypot(previousPoint.x - center.x, previousPoint.y - center.y)
            let rubbingTheDial = (little || effort >= 8) && max(previousDistance, distance) <= radius * 1.4
            if rubbingTheDial || effort >= (little ? 6 : 12) {
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
        let biggerGain = (little && effort >= 4) || (lastToy && effort >= 12)
        let amount = gained * (misses > 0 ? 0.75 : 1) * (oiled > 0 ? 2 : 1) * (biggerGain ? 2 : 1)
        if floor((woundTotal + amount) * 4) > floor(woundTotal * 4) { lastQuarterTurn = now }
        woundTotal += amount
        turns = min(top, turns + amount)
        if little && effort >= 6, let fingerStart, hypot(fingerStart.x - p.x, fingerStart.y - p.y) > 30 {
            turns = need
        }
        if misses >= 2 { turns = min(turns, need) }
        if !hasStar && turns >= need {
            awake = true; feedback = lastToy ? "The parade is on!" : "Ding! Wake up!"; resetFinger()
        } else if little && effort >= 6 { feedback = "One big drag!" }
        else if little && effort >= 4 { feedback = "Rub the key fast!" }
        else if effort >= 12 { feedback = "Drag anywhere to wind!" }
        else if effort >= 8 { feedback = "Rub the dial to wind it" }
    }

    private func updateClock() {
        let now = ProcessInfo.processInfo.systemUptime
        guard scenePhase == .active, speechGameProgress?.isMoveActive != false, !awake else {
            lastTick = nil
            return
        }
        let dt = min(0.1, max(0, now - (lastTick ?? now)))
        lastTick = now
        if oiled > 0 { oiled = max(0, oiled - dt) }
        if previousPoint != nil, now - lastMovement < 0.3, now - lastQuarterTurn > 0.4 {
            effort += dt
        }
    }

    private func release() {
        if let fingerStart, let previousPoint, hypot(fingerStart.x - previousPoint.x, fingerStart.y - previousPoint.y) < 10 {
            effort = max(effort, effortAtTouch + 0.5)
        }
        resetFinger()
        guard !awake, scenePhase == .active, hasStar, turns >= (need - halfStar) * 0.3 else { return }
        if misses >= 3 || abs(turns - need) <= halfStar {
            awake = true; feedback = "Just right!"
        } else if turns < need {
            misses += 1; feedback = "A little more winding!"
        } else {
            misses += 1; turns = max(need * 0.3, need - halfStar - 0.05)
            feedback = "Whoa, dizzy! Let go a bit sooner"
        }
    }
    private func resetFinger() {
        previousAngle = nil; previousPoint = nil; fingerStart = nil
        sweep = 0; origin = 0; credit = 0; lastMovement = -.infinity
    }
    private func advance() {
        guard awake else { return }
        speechGameProgress?.advance()
        if lastToy { onFinish(); return }
        stage += 1
        turns = 0; misses = 0; effort = 0; feedback = ""; awake = false; oiled = 0
        woundTotal = 0; lastQuarterTurn = -.infinity; resetFinger()
    }
}

private struct NativeBridgeRound: View {
    let onFinish: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.speechGameProgress) private var speechGameProgress
    @State private var stage = 0
    @State private var quarterTurns = 1
    @State private var stone: CGPoint?
    @State private var dragStart: CGPoint?
    @State private var touchBegan: Date?
    @State private var misses = 0
    @State private var feedback = ""
    @State private var seated = false
    @State private var calmRiver: TimeInterval = 0
    private let riverClock = Timer.publish(every: 0.25, on: .main, in: .common).autoconnect()
    private let initialTurns = [1, 1, 2, 1, 2, 3, 2, 1]
    private let littleLines = [
        "Slide the stone into the hole with the same shape!",
        "Which hole is the same shape? Slide it in!",
        "Find the hole that matches. Click!",
        "Look, ducks! Slide the stone into its hole.",
        "Find the same shape and slide it in!",
        "The heart goes on top. Slide it in!"
    ]
    private var little: Bool { speechGameProgress?.count == littleLines.count }
    private var count: Int { little ? littleLines.count : initialTurns.count }
    private var shapeIndex: Int { little && stage == littleLines.count - 1 ? 7 : stage }
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
            StoryGameInstruction(text: little ? littleLines[stage] : lines[stage])
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
                    StoryBridgeStone(index: shapeIndex).fill(Color(red: 0.20, green: 0.23, blue: 0.22))
                        .frame(width: side, height: side).position(hole)
                    StoryBridgeStone(index: shapeIndex).stroke(.white.opacity(misses > 0 ? 0.9 : 0.45), style: StrokeStyle(lineWidth: 3, dash: [6, 5]))
                        .frame(width: side, height: side).position(hole)
                    if calmRiver > 0 {
                        StoryBridgeStone(index: shapeIndex).fill(StoryGameStyle.gold.opacity(0.48))
                            .frame(width: side, height: side).position(hole).allowsHitTesting(false)
                    }
                    if !seated {
                        Image(systemName: "arrow.up").font(.system(size: 26, weight: .bold)).foregroundStyle(.white.opacity(0.75))
                            .position(x: geo.size.width / 2, y: geo.size.height * 0.58).allowsHitTesting(false)
                    }
                    StoryBridgeStone(index: shapeIndex).fill(seated ? StoryGameStyle.gold : Color(red: 0.91, green: 0.75, blue: 0.52))
                        .overlay(StoryBridgeStone(index: shapeIndex).stroke(Color.brown.opacity(0.5), lineWidth: 2))
                        .frame(width: side, height: side).rotationEffect(.degrees(little ? 0 : Double(quarterTurns * 90)))
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
                                if !little && hypot(value.translation.width, value.translation.height) < 12 && value.time.timeIntervalSince(touchBegan ?? value.time) < 0.3 {
                                    stone = dragStart; turn()
                                } else { drop(at: stone ?? start, hole: hole, side: side) }
                                dragStart = nil; touchBegan = nil
                            })
                        .accessibilityLabel("Bridge stone")
                        .accessibilityHint(little ? "Drag to the matching hole." : "Tap to turn. Drag to the matching hole.")
                        .accessibilityIdentifier("bridge-stone")
                }
                .coordinateSpace(name: "bridge-board").clipped()
                .accessibilityIdentifier("bridge-board")
                .onChange(of: geo.size) { _ in stone = nil; dragStart = nil }
            }
            .clipShape(RoundedRectangle(cornerRadius: 24))
            HStack {
                Text(feedback.isEmpty ? "\(stage) of \(count) stones fitted" : feedback)
                    .font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity, alignment: .leading)
                if seated {
                    Button(stage + 1 == count ? "Finish bridge" : "Next stone") { advance() }
                        .font(.headline).padding(.horizontal, 16).frame(minHeight: 48)
                        .background(StoryGameStyle.ink, in: Capsule()).foregroundStyle(.white)
                        .accessibilityIdentifier("bridge-next")
                } else if !little {
                    Button { turn() } label: {
                        Label("Turn", systemImage: "rotate.right").font(.headline).padding(.horizontal, 18).frame(minHeight: 48)
                    }.background(.white, in: Capsule()).accessibilityIdentifier("bridge-turn")
                }
            }
            if !seated, dragStart == nil, calmRiver == 0, let requestHelp = speechGameProgress?.requestHelp {
                Button("Calm river") {
                    _ = requestHelp { earned in if earned { calmRiver = 10; feedback = "Calm river! The water is still." } }
                }.buttonStyle(.bordered).frame(minHeight: 44)
                    .accessibilityIdentifier("bridge-help")
            }
        }
        .onReceive(riverClock) { _ in
            if scenePhase == .active && speechGameProgress?.isMoveActive != false && calmRiver > 0 {
                calmRiver = max(0, calmRiver - 0.25)
            }
        }
        .onChange(of: scenePhase) { phase in if phase != .active { stone = nil; dragStart = nil } }
    }
    private func turn() {
        guard !little, !seated else { return }
        quarterTurns = (quarterTurns + 1) % 4
        feedback = ""
    }
    private func drop(at p: CGPoint, hole: CGPoint, side: CGFloat) {
        guard hypot(p.x - hole.x, p.y - hole.y) < side * (misses >= 2 ? 1.1 : 0.72) else { stone = nil; return }
        if little || quarterTurns % 4 == 0 || misses >= 2 {
            quarterTurns = 0; stone = hole; seated = true; feedback = "Click!"
        } else {
            misses += 1; stone = nil; feedback = "Almost! Give it a turn."
        }
    }
    private func advance() {
        guard seated else { return }
        speechGameProgress?.advance()
        if stage + 1 == count { onFinish(); return }
        stage += 1; quarterTurns = initialTurns[stage]; stone = nil; dragStart = nil
        misses = 0; feedback = ""; seated = false; calmRiver = 0
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
