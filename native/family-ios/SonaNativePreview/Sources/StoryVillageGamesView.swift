import SwiftUI
import UIKit
import Combine

enum StoryVillageGame: String, CaseIterable {
    case waterwheel, postboat, bakery, frontdoor, lantern

    fileprivate var title: String {
        switch self {
        case .waterwheel: return "The Thirsty Waterwheel Garden"
        case .postboat: return "The Little Island Postboat"
        case .bakery: return "Breakfast at the Moonberry Bakery"
        case .frontdoor: return "Tortoise’s New Front Door"
        case .lantern: return "The Glowworm Lantern Walk"
        }
    }

    fileprivate var instruction: String {
        switch self {
        case .waterwheel: return "Connect the troughs. Open the water gate."
        case .postboat: return "Steer beside each dock, then carry its parcel home."
        case .bakery: return "Pour, mix, shape and bake breakfast."
        case .frontdoor: return "Lift, turn and lower the bridge pieces."
        case .lantern: return "Join both cords, then close each switch."
        }
    }

    fileprivate var finish: String {
        switch self {
        case .waterwheel: return "The waterwheel turns!"
        case .postboat: return "Every parcel is home!"
        case .bakery: return "Breakfast is ready!"
        case .frontdoor: return "Welcome home, Tortoise!"
        case .lantern: return "The lantern walk is glowing!"
        }
    }
}

/// Local finger-only development previews. The production daily scheduler,
/// clinical turns, game reps and rewards are deliberately outside this view.
struct StoryVillageGamesView: View {
    let game: StoryVillageGame
    let onRoundFinished: () -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var finished = false
    @State private var roundID = UUID()

    init(game: StoryVillageGame, onRoundFinished: @escaping () -> Void = {}) {
        self.game = game
        self.onRoundFinished = onRoundFinished
    }

    var body: some View {
        GeometryReader { geo in
            Group {
                if geo.size.height < 510 || typeSize.isAccessibilitySize {
                    ScrollView { content(height: max(390, geo.size.height - 205)) }
                } else {
                    content(height: max(320, geo.size.height - 205))
                }
            }
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .background(VillageStyle.paper.ignoresSafeArea())
        .foregroundStyle(VillageStyle.ink)
        .preferredColorScheme(.light)
        .overlay { if finished { finishCard } }
    }

    private func content(height: CGFloat) -> some View {
        VStack(spacing: 12) {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark").font(.body.bold())
                        .frame(width: 46, height: 46).background(.white, in: Circle())
                }
                .accessibilityLabel("Back to adventures")
                .accessibilityIdentifier("nativeVillageClose")
                Spacer()
                Text("ECHO’S VILLAGE").font(.caption.bold()).tracking(1.3)
                    .foregroundStyle(VillageStyle.teal)
            }
            HStack(spacing: 13) {
                Image("daily-\(game.rawValue)")
                    .resizable().scaledToFill().frame(width: 88, height: 82)
                    .clipShape(RoundedRectangle(cornerRadius: 17)).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 5) {
                    Text(game.title).font(.system(.title3, design: .rounded, weight: .heavy))
                        .accessibilityAddTraits(.isHeader)
                        .accessibilityIdentifier("nativeVillage-\(game.rawValue)")
                    Text(game.instruction).font(.subheadline).fixedSize(horizontal: false, vertical: true)
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
            board.id(roundID).frame(height: height)
                .background(VillageStyle.sky, in: RoundedRectangle(cornerRadius: 25))
                .clipShape(RoundedRectangle(cornerRadius: 25))
                .disabled(finished).accessibilityHidden(finished)
        }
        .padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 12)
    }

    @ViewBuilder private var board: some View {
        switch game {
        case .waterwheel: VillageWaterwheel(onComplete: complete)
        case .postboat: VillagePostboat(onComplete: complete)
        case .bakery: VillageBakery(onComplete: complete)
        case .frontdoor: VillageBridge(onComplete: complete)
        case .lantern: VillageLantern(onComplete: complete)
        }
    }

    private var finishCard: some View {
        ZStack {
            Color.black.opacity(0.26).ignoresSafeArea().accessibilityHidden(true)
            VStack(spacing: 18) {
                Image("daily-\(game.rawValue)").resizable().scaledToFill()
                    .frame(width: 160, height: 100).clipShape(RoundedRectangle(cornerRadius: 19))
                    .accessibilityHidden(true)
                Text(game.finish).font(.system(.title, design: .rounded, weight: .heavy))
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("nativeVillageFinish")
                VillageButton(title: "Play again", symbol: "arrow.clockwise") {
                    finished = false
                    roundID = UUID()
                }.accessibilityIdentifier("nativeVillageReplay")
                Button("Back to adventures") { dismiss() }.font(.body.bold()).frame(minHeight: 44)
                    .accessibilityIdentifier("nativeVillageHome")
            }
            .padding(26).frame(maxWidth: 370)
            .background(VillageStyle.paper, in: RoundedRectangle(cornerRadius: 28))
            .padding(24).accessibilityElement(children: .contain).accessibilityAddTraits(.isModal)
        }
    }

    private func complete() {
        guard !finished else { return }
        finished = true
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        onRoundFinished()
    }
}

private enum VillageStyle {
    static let paper = Color(red: 1, green: 0.98, blue: 0.94)
    static let ink = Color(red: 0.20, green: 0.19, blue: 0.24)
    static let teal = Color(red: 0.04, green: 0.46, blue: 0.49)
    static let sky = Color(red: 0.90, green: 0.95, blue: 0.95)
    static let wood = Color(red: 0.57, green: 0.38, blue: 0.23)
    static func tick() { UIImpactFeedbackGenerator(style: .light).impactOccurred(intensity: 0.6) }
}

private struct VillageButton: View {
    let title: String
    var symbol: String = "hand.tap.fill"
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Label(title, systemImage: symbol).font(.system(.body, design: .rounded, weight: .bold))
                .frame(maxWidth: .infinity, minHeight: 50).padding(.horizontal, 12)
                .foregroundStyle(.white)
                .background(VillageStyle.teal, in: RoundedRectangle(cornerRadius: 16))
        }.buttonStyle(.plain)
    }
}

private struct VillageCaption: View {
    let text: String
    var body: some View {
        Text(text).font(.system(.subheadline, design: .rounded, weight: .bold))
            .multilineTextAlignment(.center).padding(11)
            .background(.white.opacity(0.95), in: RoundedRectangle(cornerRadius: 13))
            .padding(10).allowsHitTesting(false)
    }
}

private struct VillageWaterwheel: View {
    let onComplete: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var placed: Set<Int> = []
    @State private var turns = [0, 0, 0]
    @State private var offsets = [CGSize](repeating: .zero, count: 3)
    @State private var selected = 0
    @State private var gate = false

    var body: some View {
        GeometryReader { geo in
            let nodes = [CGPoint(x: geo.size.width * 0.14, y: geo.size.height * 0.24),
                         CGPoint(x: geo.size.width * 0.37, y: geo.size.height * 0.34),
                         CGPoint(x: geo.size.width * 0.60, y: geo.size.height * 0.44),
                         CGPoint(x: geo.size.width * 0.83, y: geo.size.height * 0.54)]
            ZStack(alignment: .top) {
                VillageCaption(text: gate ? "The garden has water!" : "\(placed.count) of 3 troughs · Turn, then drag")
                ForEach(0..<3) { index in
                    let a = nodes[index], b = nodes[index + 1]
                    let target = CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2)
                    let tray = CGPoint(x: geo.size.width * (0.20 + CGFloat(index) * 0.30), y: geo.size.height * 0.77)
                    let length = VillageGeometry.distance(a, b)
                    let angle = atan2(b.y - a.y, b.x - a.x)
                    RoundedRectangle(cornerRadius: 6).strokeBorder(VillageStyle.wood.opacity(0.45), style: StrokeStyle(lineWidth: 3, dash: [5, 4]))
                        .frame(width: length, height: 26).rotationEffect(.radians(Double(angle)))
                        .position(target).accessibilityHidden(true)
                    RoundedRectangle(cornerRadius: 6).fill(VillageStyle.wood)
                        .overlay(RoundedRectangle(cornerRadius: 3).fill(gate ? .cyan : .black.opacity(0.13)).padding(6))
                        .frame(width: length, height: 26)
                        .rotationEffect(.radians(Double(angle + (placed.contains(index) ? 0 : CGFloat(turns[index] - 1) * .pi / 2))))
                        .overlay {
                            if selected == index && !placed.contains(index) {
                                Circle().strokeBorder(VillageStyle.teal, lineWidth: 3).frame(width: 46, height: 46)
                            }
                        }
                        .position(placed.contains(index) ? target : CGPoint(x: tray.x + offsets[index].width, y: tray.y + offsets[index].height))
                        .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                            guard !placed.contains(index) else { return }
                            selected = index
                            offsets[index] = value.translation
                        }.onEnded { value in
                            guard !placed.contains(index) else { return }
                            let end = CGPoint(x: tray.x + value.translation.width, y: tray.y + value.translation.height)
                            if turns[index] % 4 == 1 && VillageGeometry.distance(end, target) < 43 { place(index) }
                            offsets[index] = .zero
                        })
                        .accessibilityLabel("Wooden trough \(index + 1)\(placed.contains(index) ? ", placed" : "")")
                        .accessibilityAction(named: "Turn trough") { selected = index; turn() }
                        .accessibilityAction(named: "Place on matching outline") { if turns[index] % 4 == 1 { place(index) } }
                        .accessibilityIdentifier("village-water-trough-\(index)")
                }
                TimelineView(.animation(minimumInterval: 1.0 / 30, paused: !gate || reduceMotion || scenePhase != .active)) { timeline in
                    Image(systemName: "gearshape.fill").font(.system(size: 62)).foregroundStyle(VillageStyle.wood)
                        .rotationEffect(.radians(gate && !reduceMotion ? timeline.date.timeIntervalSinceReferenceDate : 0))
                }.position(x: geo.size.width * 0.82, y: geo.size.height * 0.62).allowsHitTesting(false)
                HStack(spacing: 22) {
                    ForEach(0..<3) { _ in Image(systemName: gate ? "camera.macro" : "leaf.fill").font(.system(size: 29)).foregroundStyle(gate ? .pink : VillageStyle.teal) }
                }.position(x: geo.size.width * 0.40, y: geo.size.height * 0.56).accessibilityHidden(true)
                VStack { Spacer()
                    if gate {
                        VillageButton(title: "The garden is watered", symbol: "checkmark") { onComplete() }
                    } else if placed.count == 3 {
                        VillageButton(title: "Open the water gate", symbol: "drop.fill") { gate = true; VillageStyle.tick() }
                            .accessibilityIdentifier("village-water-gate")
                    } else {
                        VillageButton(title: "Turn trough \(selected + 1)", symbol: "rotate.right") { turn() }
                            .accessibilityIdentifier("village-water-turn")
                    }
                }.padding(14)
            }
        }
    }

    private func turn() { guard !placed.contains(selected) else { return }; turns[selected] = (turns[selected] + 1) % 4; VillageStyle.tick() }
    private func place(_ index: Int) {
        guard !placed.contains(index) else { return }
        placed.insert(index)
        selected = (0..<3).first { !placed.contains($0) } ?? index
        VillageStyle.tick()
    }
}

private struct VillagePostboat: View {
    let onComplete: () -> Void
    @State private var boat = CGPoint(x: 0.57, y: 0.84)
    @State private var anchor: CGPoint?
    @State private var delivered = 0
    @State private var parcelOffset = CGSize.zero
    private let docks = [CGPoint(x: 0.23, y: 0.24), CGPoint(x: 0.78, y: 0.48), CGPoint(x: 0.24, y: 0.68)]

    var body: some View {
        GeometryReader { geo in
            let dock = docks[min(delivered, 2)]
            let atDock = VillageGeometry.distance(boat, dock) < 0.20
            let reeds = CGRect(x: geo.size.width * 0.44, y: geo.size.height * 0.34, width: geo.size.width * 0.11, height: geo.size.height * 0.26)
            let boatPoint = pixel(boat, geo.size)
            let parcel = CGPoint(x: boatPoint.x + 25, y: boatPoint.y - 38)
            ZStack(alignment: .top) {
                Color(red: 0.73, green: 0.89, blue: 0.94)
                VillageCaption(text: "\(delivered) of 3 deliveries · \(atDock ? "Carry the parcel to its flag" : "Steer around the reeds")")
                RoundedRectangle(cornerRadius: 22).fill(VillageStyle.teal.opacity(0.5))
                    .frame(width: reeds.width, height: reeds.height).position(x: reeds.midX, y: reeds.midY)
                    .overlay { Image(systemName: "leaf.fill").foregroundStyle(.white.opacity(0.8)).position(x: reeds.midX, y: reeds.midY) }
                    .accessibilityHidden(true)
                ForEach(0..<3) { index in
                    VStack(spacing: 5) {
                        Image(systemName: index < delivered ? "checkmark.circle.fill" : "flag.fill").font(.title2)
                        Text("\(index + 1)").font(.caption.bold())
                    }
                    .foregroundStyle(index <= delivered ? VillageStyle.teal : .gray)
                    .frame(width: 76, height: 74).background(VillageStyle.paper, in: RoundedRectangle(cornerRadius: 24))
                    .position(pixel(docks[index], geo.size)).accessibilityHidden(true)
                }
                Image(systemName: "ferry.fill").font(.system(size: 55)).foregroundStyle(VillageStyle.ink)
                    .frame(width: 80, height: 80).contentShape(Rectangle()).position(boatPoint)
                    .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                        let start = anchor ?? boat
                        if anchor == nil { anchor = boat }
                        let next = CGPoint(x: max(0.10, min(0.90, start.x + value.translation.width / geo.size.width)),
                                           y: max(0.17, min(0.87, start.y + value.translation.height / geo.size.height)))
                        if !VillageGeometry.crosses(pixel(boat, geo.size), pixel(next, geo.size), rect: reeds.insetBy(dx: -18, dy: -18)) { boat = next }
                    }.onEnded { _ in anchor = nil })
                    .accessibilityLabel("Postboat. Drag around the reeds to dock \(min(delivered + 1, 3)).")
                    .accessibilityAction(named: "Steer beside the next dock") { boat = CGPoint(x: dock.x + (dock.x < 0.5 ? 0.15 : -0.15), y: dock.y) }
                    .accessibilityIdentifier("village-postboat-steer")
                if atDock && delivered < 3 {
                    Image(systemName: "shippingbox.fill").font(.system(size: 32)).foregroundStyle(VillageStyle.wood)
                        .frame(width: 58, height: 58).background(.white, in: RoundedRectangle(cornerRadius: 12))
                        .position(x: parcel.x + parcelOffset.width, y: parcel.y + parcelOffset.height)
                        .gesture(DragGesture(minimumDistance: 0).onChanged { parcelOffset = $0.translation }.onEnded { value in
                            let end = CGPoint(x: parcel.x + value.translation.width, y: parcel.y + value.translation.height)
                            if VillageGeometry.distance(end, pixel(dock, geo.size)) < 52 { deliver() }
                            parcelOffset = .zero
                        })
                        .accessibilityLabel("Parcel for dock \(delivered + 1)")
                        .accessibilityAction(named: "Carry parcel to dock") { deliver() }
                        .accessibilityIdentifier("village-postboat-parcel")
                }
                VStack { Spacer(); VillageCaption(text: "Drag the boat. The reeds block its path.") }
            }
        }
    }

    private func pixel(_ point: CGPoint, _ size: CGSize) -> CGPoint { CGPoint(x: point.x * size.width, y: point.y * size.height) }
    private func deliver() { guard delivered < 3 else { return }; delivered += 1; VillageStyle.tick(); if delivered == 3 { onComplete() } }
}

private struct VillageBakery: View {
    let onComplete: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @State private var stage = 0
    @State private var jug = CGSize.zero
    @State private var stirred: CGFloat = 0
    @State private var previousAngle: CGFloat?
    @State private var shaped: Set<Int> = []
    @State private var dough = CGSize.zero
    @State private var heat = 0.20
    @State private var holding = false
    @State private var baked = 0.0
    @State private var previousTick: Date?
    private let clock = Timer.publish(every: 1.0 / 30, on: .main, in: .common).autoconnect()

    var body: some View {
        GeometryReader { geo in
            let center = CGPoint(x: geo.size.width * 0.5, y: geo.size.height * 0.46)
            let tray = CGPoint(x: geo.size.width * 0.24, y: geo.size.height * 0.76)
            ZStack(alignment: .top) {
                Color(red: 0.97, green: 0.90, blue: 0.84)
                VillageCaption(text: ["Drag the jug over the bowl", "Stir the dough in circles", "Shape three buns on the tray", "Keep the oven in the warm band"][stage])
                if stage < 2 {
                    Image("meadow-bowl").resizable().scaledToFit().frame(width: geo.size.width * 0.80, height: 190).position(center)
                        .accessibilityHidden(true)
                    if stage == 0 {
                        Image(systemName: "mug.fill").font(.system(size: 64)).foregroundStyle(VillageStyle.teal)
                            .frame(width: 90, height: 110).position(x: tray.x + jug.width, y: tray.y + jug.height)
                            .gesture(DragGesture(minimumDistance: 0).onChanged { jug = $0.translation }.onEnded { value in
                                if VillageGeometry.distance(CGPoint(x: tray.x + value.translation.width, y: tray.y + value.translation.height), center) < 75 { stage = 1; VillageStyle.tick() }
                                jug = .zero
                            })
                            .accessibilityLabel("Jug of ingredients")
                            .accessibilityAction(named: "Pour into bowl") { stage = 1; VillageStyle.tick() }
                            .accessibilityIdentifier("village-bakery-pour")
                    } else {
                        Circle().fill(.clear).contentShape(Circle()).frame(width: geo.size.width * 0.9, height: geo.size.width * 0.9)
                            .position(center)
                            .gesture(DragGesture(minimumDistance: 0, coordinateSpace: .named("village-bakery")).onChanged { value in
                                let dx = value.location.x - center.x, dy = value.location.y - center.y
                                guard hypot(dx, dy) > 24 else { previousAngle = nil; return }
                                let angle = atan2(dy, dx)
                                if let previous = previousAngle {
                                    let delta = VillageGeometry.angleDifference(angle, previous)
                                    if abs(delta) < .pi / 2 { stir(abs(delta)) }
                                }
                                previousAngle = angle
                            }.onEnded { _ in previousAngle = nil })
                            .accessibilityLabel("Mixing bowl. Stir in circles.")
                            .accessibilityAction(named: "Stir a quarter turn") { stir(.pi / 2) }
                            .accessibilityIdentifier("village-bakery-stir")
                        ProgressView(value: Double(stirred), total: Double(3 * CGFloat.pi)).tint(VillageStyle.teal)
                            .frame(width: geo.size.width * 0.65).position(x: center.x, y: geo.size.height * 0.75)
                    }
                } else if stage == 2 {
                    RoundedRectangle(cornerRadius: 19).fill(VillageStyle.ink.opacity(0.75))
                        .frame(width: geo.size.width * 0.92, height: 138).position(center)
                    ForEach(0..<3) { index in
                        Ellipse().fill(shaped.contains(index) ? Color(red: 0.91, green: 0.70, blue: 0.43) : .white.opacity(0.16))
                            .overlay(Ellipse().strokeBorder(.white.opacity(0.8), style: StrokeStyle(lineWidth: 2, dash: [4, 4])))
                            .frame(width: 66, height: 90).position(x: geo.size.width * (0.22 + CGFloat(index) * 0.28), y: center.y)
                    }.accessibilityHidden(true)
                    Circle().fill(Color(red: 0.97, green: 0.82, blue: 0.59)).frame(width: 72, height: 72)
                        .position(x: tray.x + dough.width, y: tray.y + dough.height)
                        .gesture(DragGesture(minimumDistance: 0).onChanged { dough = $0.translation }.onEnded { value in
                            let end = CGPoint(x: tray.x + value.translation.width, y: tray.y + value.translation.height)
                            if let index = (0..<3).first(where: { !shaped.contains($0) && VillageGeometry.distance(end, CGPoint(x: geo.size.width * (0.22 + CGFloat($0) * 0.28), y: center.y)) < 46 }) { shape(index) }
                            dough = .zero
                        })
                        .accessibilityLabel("Soft dough. Drag into a bun outline.")
                        .accessibilityAction(named: "Shape next bun") { if let next = (0..<3).first(where: { !shaped.contains($0) }) { shape(next) } }
                        .accessibilityIdentifier("village-bakery-shape")
                } else {
                    VStack(spacing: 18) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 15).fill(VillageStyle.wood)
                            RoundedRectangle(cornerRadius: 8).fill(VillageStyle.ink).padding(12)
                            HStack(spacing: 9) {
                                ForEach(0..<3) { _ in
                                    Ellipse().fill(Color(red: 0.91, green: 0.70, blue: 0.43)).frame(width: 23, height: 29)
                                }
                            }
                        }.frame(width: 130, height: 100).accessibilityHidden(true)
                        Text(heat >= 0.42 && heat <= 0.68 ? "A lovely warm oven" : "Move the heat into the middle")
                            .font(.subheadline.bold())
                        Slider(value: $heat, in: 0...1).tint(VillageStyle.teal)
                            .accessibilityLabel("Oven heat. The warm band is 42 to 68 percent.")
                            .accessibilityIdentifier("village-bakery-heat")
                        ProgressView(value: baked).tint(VillageStyle.teal).accessibilityLabel("Baking progress")
                        Text("Hold to bake").font(.body.bold()).foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 60)
                            .background(VillageStyle.teal, in: RoundedRectangle(cornerRadius: 17))
                            .contentShape(Rectangle())
                            .gesture(DragGesture(minimumDistance: 0).onChanged { _ in holding = true }.onEnded { _ in holding = false; previousTick = nil })
                            .accessibilityAddTraits(.isButton)
                            .accessibilityAction { bake(0.25) }
                            .accessibilityIdentifier("village-bakery-bake")
                    }.padding(24).frame(maxHeight: .infinity)
                }
            }.coordinateSpace(name: "village-bakery")
        }
        .onReceive(clock) { now in
            guard scenePhase == .active, holding, stage == 3 else { previousTick = nil; return }
            let dt = min(0.06, now.timeIntervalSince(previousTick ?? now))
            previousTick = now
            bake(dt / 2.3)
        }
        .onChange(of: scenePhase) { _ in holding = false; previousTick = nil; previousAngle = nil }
        .onDisappear { holding = false; previousTick = nil }
    }

    private func stir(_ amount: CGFloat) { guard stage == 1 else { return }; stirred += amount; if stirred >= 3 * .pi { stage = 2; VillageStyle.tick() } }
    private func shape(_ index: Int) { guard !shaped.contains(index) else { return }; shaped.insert(index); VillageStyle.tick(); if shaped.count == 3 { stage = 3 } }
    private func bake(_ amount: Double) {
        guard stage == 3, heat >= 0.42, heat <= 0.68, baked < 1 else { return }
        baked = min(1, baked + amount)
        if baked == 1 { holding = false; onComplete() }
    }
}

private struct VillageBridge: View {
    let onComplete: () -> Void
    @State private var placed = 0
    @State private var turned = false
    @State private var lifted = false
    @State private var offset = CGSize.zero
    @State private var cart = CGSize.zero

    var body: some View {
        GeometryReader { geo in
            let source = CGPoint(x: geo.size.width * 0.20, y: geo.size.height * 0.78)
            let target = CGPoint(x: geo.size.width * (0.23 + CGFloat(min(placed, 2)) * 0.27), y: geo.size.height * 0.46)
            let load = CGPoint(x: source.x + offset.width, y: source.y + offset.height)
            ZStack(alignment: .top) {
                Color(red: 0.86, green: 0.93, blue: 0.82)
                Rectangle().fill(Color.cyan.opacity(0.5)).frame(width: geo.size.width * 0.47)
                    .position(x: geo.size.width * 0.50, y: geo.size.height * 0.50).accessibilityHidden(true)
                VillageCaption(text: placed < 3 ? "\(placed) of 3 pieces · Lift, turn, then lower" : "Guide Tortoise’s cart across the bridge")
                ForEach(0..<3) { index in
                    RoundedRectangle(cornerRadius: 5)
                        .fill(index < placed ? VillageStyle.wood : .white.opacity(0.5))
                        .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(VillageStyle.wood, style: StrokeStyle(lineWidth: 2, dash: index < placed ? [] : [5, 4])))
                        .frame(width: geo.size.width * 0.28, height: 38)
                        .position(x: geo.size.width * (0.23 + CGFloat(index) * 0.27), y: geo.size.height * 0.46)
                }.accessibilityHidden(true)
                if placed < 3 {
                    Path { path in path.move(to: CGPoint(x: load.x, y: geo.size.height * 0.13)); path.addLine(to: load) }
                        .stroke(VillageStyle.ink, style: StrokeStyle(lineWidth: 3, dash: [4, 3])).allowsHitTesting(false)
                    RoundedRectangle(cornerRadius: 6).fill(VillageStyle.wood)
                        .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(.white, lineWidth: 2))
                        .frame(width: geo.size.width * 0.28, height: 38)
                        .rotationEffect(.degrees(turned ? 0 : 90)).position(load)
                        .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                            offset = value.translation
                            if source.y + offset.height < target.y - 30 { lifted = true }
                        }.onEnded { value in
                            let end = CGPoint(x: source.x + value.translation.width, y: source.y + value.translation.height)
                            if lifted && turned && VillageGeometry.distance(end, target) < 42 { place() }
                            offset = .zero
                        })
                        .accessibilityLabel("Crane load. Lift above the supports, turn and lower.")
                        .accessibilityAction(named: "Lift above supports") { lifted = true }
                        .accessibilityAction(named: "Turn load") { turned.toggle() }
                        .accessibilityAction(named: "Lower onto supports") { if lifted && turned { place() } }
                        .accessibilityIdentifier("village-bridge-load")
                    VStack { Spacer(); VillageButton(title: turned ? "Load is level" : "Turn load", symbol: "rotate.right") { turned.toggle(); VillageStyle.tick() } }.padding(14)
                } else {
                    HStack(spacing: 2) {
                        Image(systemName: "tortoise.fill").font(.system(size: 36)).foregroundStyle(VillageStyle.teal)
                        Image(systemName: "shippingbox.fill").font(.title2).foregroundStyle(VillageStyle.wood)
                    }
                    .frame(width: 92, height: 70).contentShape(Rectangle())
                    .position(x: geo.size.width * 0.12 + cart.width, y: geo.size.height * 0.43 + cart.height)
                    .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                        guard abs(value.translation.height) < 46 else { return }
                        cart = CGSize(width: max(0, min(geo.size.width * 0.78, value.translation.width)), height: 0)
                    }.onEnded { value in
                        if value.translation.width > geo.size.width * 0.68 && abs(value.translation.height) < 46 { onComplete() }
                        else { cart = .zero }
                    })
                    .accessibilityLabel("Tortoise’s moving cart")
                    .accessibilityAction(named: "Guide cart across the finished bridge") { onComplete() }
                    .accessibilityIdentifier("village-bridge-cart")
                }
            }
        }
    }

    private func place() { guard placed < 3 else { return }; placed += 1; offset = .zero; turned = false; lifted = false; VillageStyle.tick() }
}

private struct VillageLantern: View {
    let onComplete: () -> Void
    @State private var supply = [false, false, false]
    @State private var returns = [false, false, false]
    @State private var switches = [false, false, false]
    @State private var master = true
    @State private var offsets = [CGSize.zero, CGSize.zero]
    private let lamps = [CGPoint(x: 0.23, y: 0.25), CGPoint(x: 0.77, y: 0.25), CGPoint(x: 0.51, y: 0.57)]
    private var lit: [Bool] { (0..<3).map { master && supply[$0] && returns[$0] && switches[$0] } }
    private var current: Int { (0..<3).first { !supply[$0] || !returns[$0] } ?? 2 }

    var body: some View {
        GeometryReader { geo in
            let source = CGPoint(x: geo.size.width * 0.18, y: geo.size.height * 0.85)
            let index = current
            ZStack(alignment: .top) {
                Color(red: 0.14, green: 0.21, blue: 0.30)
                VillageCaption(text: "\(lit.filter { $0 }.count) of 3 lights · Each lamp needs a full loop")
                ForEach(0..<3) { lamp in
                    let point = CGPoint(x: lamps[lamp].x * geo.size.width, y: lamps[lamp].y * geo.size.height)
                    ForEach(0..<2) { role in
                        let pin = CGPoint(x: point.x + (role == 0 ? -23 : 23), y: point.y + 37)
                        if role == 0 ? supply[lamp] : returns[lamp] {
                            Path { path in
                                path.move(to: CGPoint(x: source.x + CGFloat(role) * 24, y: source.y))
                                path.addQuadCurve(to: pin, control: CGPoint(x: pin.x, y: source.y - 30))
                            }.stroke(role == 0 ? Color.pink : .cyan, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                            .allowsHitTesting(false)
                        }
                        Circle().fill(role == 0 ? .pink : .cyan).frame(width: 17, height: 17).position(pin).accessibilityHidden(true)
                    }
                    Button {
                        switches[lamp].toggle()
                        VillageStyle.tick()
                    } label: {
                        VStack(spacing: 6) {
                            Image(systemName: lit[lamp] ? "lightbulb.fill" : "lightbulb")
                                .font(.system(size: 45)).foregroundStyle(lit[lamp] ? .yellow : .white.opacity(0.5))
                                .shadow(color: lit[lamp] ? .yellow.opacity(0.5) : .clear, radius: 16)
                            Image(systemName: switches[lamp] ? "checkmark.circle.fill" : "circle").font(.caption)
                                .foregroundStyle(switches[lamp] ? .yellow : .white)
                        }.frame(width: 76, height: 89)
                    }
                    .buttonStyle(.plain).position(point)
                    .accessibilityLabel("Lamp \(lamp + 1), \(lit[lamp] ? "glowing" : "dark"), switch \(switches[lamp] ? "closed" : "open")")
                    .accessibilityHint("Both cords and the power box must be connected for light.")
                    .accessibilityIdentifier("village-lantern-switch-\(lamp)")
                }
                Button { master.toggle(); VillageStyle.tick() } label: {
                    Image(systemName: master ? "power.circle.fill" : "power.circle")
                        .font(.system(size: 52)).foregroundStyle(master ? .yellow : .white)
                        .frame(width: 70, height: 70).background(VillageStyle.ink, in: RoundedRectangle(cornerRadius: 16))
                }.position(source).buttonStyle(.plain)
                    .accessibilityLabel("Power box, \(master ? "on" : "off")")
                    .accessibilityIdentifier("village-lantern-power")
                if !supply[index] || !returns[index] {
                    ForEach(0..<2) { role in
                        if !(role == 0 ? supply[index] : returns[index]) {
                            let tray = CGPoint(x: geo.size.width * (role == 0 ? 0.67 : 0.84), y: geo.size.height * 0.82)
                            let target = CGPoint(x: lamps[index].x * geo.size.width + (role == 0 ? -23 : 23), y: lamps[index].y * geo.size.height + 37)
                            Circle().fill(role == 0 ? .pink : .cyan).frame(width: 44, height: 44)
                                .overlay(Image(systemName: "powerplug.fill").font(.body.bold()).foregroundStyle(.white))
                                .position(x: tray.x + offsets[role].width, y: tray.y + offsets[role].height)
                                .gesture(DragGesture(minimumDistance: 0).onChanged { offsets[role] = $0.translation }.onEnded { value in
                                    let end = CGPoint(x: tray.x + value.translation.width, y: tray.y + value.translation.height)
                                    if VillageGeometry.distance(end, target) < 34 { connect(role, lamp: index) }
                                    offsets[role] = .zero
                                })
                                .accessibilityLabel("\(role == 0 ? "Pink supply" : "Blue return") cord for lamp \(index + 1)")
                                .accessibilityAction(named: "Connect to matching socket") { connect(role, lamp: index) }
                                .accessibilityIdentifier("village-lantern-cord-\(role)")
                        }
                    }
                }
                if lit.allSatisfy({ $0 }) {
                    VStack { Spacer(); VillageButton(title: "The woodland is glowing", symbol: "sparkles") { onComplete() } }.padding(14)
                }
            }
        }
    }

    private func connect(_ role: Int, lamp: Int) { if role == 0 { supply[lamp] = true } else { returns[lamp] = true }; VillageStyle.tick() }
}

private enum VillageGeometry {
    static func distance(_ a: CGPoint, _ b: CGPoint) -> CGFloat { hypot(a.x - b.x, a.y - b.y) }
    static func angleDifference(_ a: CGFloat, _ b: CGFloat) -> CGFloat {
        var difference = a - b
        while difference > .pi { difference -= 2 * .pi }
        while difference < -.pi { difference += 2 * .pi }
        return difference
    }

    /// Clip the finger movement against the reed rectangle, including fast drags
    /// that cross the obstacle between two delivered touch positions.
    static func crosses(_ a: CGPoint, _ b: CGPoint, rect: CGRect) -> Bool {
        var lower: CGFloat = 0, upper: CGFloat = 1
        let dx = b.x - a.x, dy = b.y - a.y
        for (p, q) in [(-dx, a.x - rect.minX), (dx, rect.maxX - a.x), (-dy, a.y - rect.minY), (dy, rect.maxY - a.y)] {
            if p == 0 { if q < 0 { return false }; continue }
            let ratio = q / p
            if p < 0 { lower = max(lower, ratio) } else { upper = min(upper, ratio) }
            if lower > upper { return false }
        }
        return true
    }
}
