import Combine
import SwiftUI
import UIKit

struct NativeSpaceFlightBoard: View {
    let turn: Int
    let trip: NativeSpaceFlight.Trip
    let little: Bool
    let advance: () -> Void

    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.speechGameProgress) private var speechGameProgress
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var flight: NativeSpaceFlight
    @State private var size = CGSize.zero
    @State private var lastTick: TimeInterval?
    @State private var left = false
    @State private var right = false
    @State private var engine = false
    @State private var inputEpoch = 0
    @State private var thumbSteering = 0.0
    @State private var accessiblePulse: (control: Control, until: TimeInterval)?
    @State private var pictures: [String: UIImage] = [:]
    @State private var chime = NativeMotorChime()

    private let clock = Timer.publish(every: 1.0 / 60, on: .main, in: .common).autoconnect()
    private static let assetNames = ["space-bg", "space-moon-ground-v1", "space-rock-v1", "space-lander-idle-v1"]
    private enum Control: Equatable { case left, engine, right }

    init(turn: Int, trip: NativeSpaceFlight.Trip, little: Bool, advance: @escaping () -> Void) {
        self.turn = turn
        self.trip = trip
        self.little = little
        self.advance = advance
        _flight = State(initialValue: .init(stage: turn, little: little, trip: trip))
    }

    private var enabled: Bool { scenePhase == .active && speechGameProgress?.isMoveActive != false }
    private var controllable: Bool { enabled && (flight.phase == .ready || flight.phase == .flying) }

    var body: some View {
        VStack(spacing: 8) {
            NativeSpacePlanets(trip: trip, landed: turn + (flight.phase == .celebrating ? 1 : 0))
            Text(flight.message)
                .font(.system(.headline, design: .rounded).weight(.bold))
                .multilineTextAlignment(.center)
                .frame(minHeight: 46)
                .accessibilityIdentifier("space-status")
            GeometryReader { geo in
                scene(in: geo.size)
                    .onAppear { configure(geo.size) }
                    .onChange(of: geo.size) { configure($0) }
            }
            .frame(minHeight: 180)
            .clipShape(RoundedRectangle(cornerRadius: 24))
            .accessibilityHidden(true)
            HStack(spacing: 10) {
                control("Left", icon: "arrow.left", kind: .left)
                control("Engine", icon: "flame.fill", kind: .engine)
                control("Right", icon: "arrow.right", kind: .right)
            }
            .id(inputEpoch)
            if let help = speechGameProgress?.requestHelp {
                Button("Easy flight") { _ = help { if $0 { flight.easyFlight() } } }
                    .buttonStyle(.bordered)
                    .frame(minHeight: 44)
                    .disabled(!controllable || left || right || engine || accessiblePulse != nil)
                    .accessibilityIdentifier("space-help")
            }
        }
        .onReceive(clock) { _ in tick() }
        .onChange(of: enabled) { active in
            stopInputs()
            if !active { chime.stop() }
        }
        .onChange(of: turn) { stage in
            flight = .init(stage: stage, little: little, trip: trip)
            configure(size)
        }
        .onDisappear { stopInputs(); chime.stop() }
        .task {
            for name in Self.assetNames {
                if let image = try? await NativeArtworkLoader.shared.image(path: "/assets/crafted/game/\(name).webp"),
                   !Task.isCancelled {
                    pictures[name] = image
                }
            }
        }
    }

    private func scene(in size: CGSize) -> some View {
        let ground = flight.ground * size.height
        let padX = flight.padX * size.width
        let padWidth = flight.padWidth * size.width
        let glow = Color(spaceRGB: flight.world.color)
        let stage = flight.ladder
        return ZStack {
            picture("space-bg", fallback: "sparkles", fill: true)
                .frame(width: size.width, height: size.height)
                .clipped()
            LinearGradient(colors: [.clear, glow.opacity(0.55)], startPoint: .center, endPoint: .bottom)
            picture("space-moon-ground-v1", fallback: "mountain.2.fill", fill: true)
                .frame(width: size.width, height: max(48, size.height * 0.25))
                .clipped()
                .overlay(Rectangle().fill(glow.opacity(0.24)).blendMode(.color))
                .position(x: size.width / 2, y: ground + size.height * 0.055)
            if stage >= 3 {
                LinearGradient(colors: [.clear, Color.mint.opacity(0.37)], startPoint: .top, endPoint: .bottom)
                    .frame(width: padWidth, height: ground * 0.86)
                    .position(x: padX, y: ground * 0.57)
            }
            Ellipse().fill(.mint.opacity(stage >= 2 ? 0.6 : 0.3))
                .frame(width: padWidth + 26, height: 27).position(x: padX, y: ground + 2)
            Capsule().fill(.yellow)
                .overlay(Capsule().strokeBorder(.white, lineWidth: 2))
                .frame(width: padWidth, height: 11).position(x: padX, y: ground)
            if stage >= 2 && flight.phase != .celebrating {
                VStack(spacing: 3) {
                    Image(systemName: "arrow.down").font(.title2.bold()).foregroundStyle(.white)
                    picture("space-lander-idle-v1", fallback: "airplane").opacity(0.45)
                        .frame(width: flight.shipWidth, height: flight.shipHeight)
                }
                .position(x: padX, y: ground - flight.shipHeight * 0.75)
            }
            ForEach(Array(flight.rocks.enumerated()), id: \.offset) { _, rock in
                picture("space-rock-v1", fallback: "circle.fill")
                    .frame(width: rock.radius * 2, height: rock.radius * 2)
                    .position(x: size.width * rock.x, y: size.height * rock.y)
            }
            ZStack(alignment: .bottom) {
                if flight.cushions {
                    Ellipse().fill(.mint.opacity(0.5))
                        .frame(width: flight.shipWidth * 1.26, height: 12).offset(y: 6)
                }
                if flight.phase == .flying && (engine || accessiblePulse?.control == .engine) && enabled {
                    Image(systemName: "flame.fill").foregroundStyle(.yellow)
                        .rotationEffect(.degrees(180)).offset(y: 13)
                }
                picture("space-lander-idle-v1", fallback: "airplane")
                    .frame(width: flight.shipWidth, height: flight.shipHeight)
            }
            .position(x: size.width * flight.x, y: size.height * flight.y)
            if flight.phase == .celebrating {
                let spread = reduceMotion ? 1.5 : 1 + flight.celebration * 2.1
                Ellipse().stroke(.yellow.opacity(reduceMotion ? 0.85 : 1 - flight.celebration / 1.15), lineWidth: 4)
                    .frame(width: flight.shipWidth * spread, height: flight.shipWidth * spread * 0.55)
                    .position(x: padX, y: ground - 15)
            }
        }
        .clipped()
        .background(SonaPalette.ink)
    }

    @ViewBuilder private func picture(_ name: String, fallback: String, fill: Bool = false) -> some View {
        if let image = pictures[name] {
            Image(uiImage: image).resizable().aspectRatio(contentMode: fill ? .fill : .fit)
        } else {
            Image(systemName: fallback).resizable().scaledToFit().foregroundStyle(Color.white.opacity(0.7))
        }
    }

    private func control(_ label: String, icon: String, kind: Control) -> some View {
        Label(label, systemImage: icon)
            .font(.system(.subheadline, design: .rounded).weight(.heavy))
            .lineLimit(1).minimumScaleFactor(0.7)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(SonaPalette.teal.opacity(controllable ? 1 : 0.5), in: Capsule())
            .contentShape(Rectangle())
            .modifier(SpaceHeldControl(change: { distance in
                guard controllable else { return }
                flight.start()
                switch kind {
                case .left: left = true
                case .right: right = true
                case .engine:
                    engine = true
                    thumbSteering = abs(distance) < 7 ? 0 : max(-1, min(1, distance / max(1, size.width * 0.18)))
                }
            }, release: {
                switch kind {
                case .left: left = false
                case .right: right = false
                case .engine: engine = false; thumbSteering = 0
                }
            }))
            .accessibilityAddTraits(.isButton)
            .accessibilityAction {
                guard controllable else { return }
                flight.start()
                accessiblePulse = (kind, ProcessInfo.processInfo.systemUptime + 0.24)
            }
            .accessibilityIdentifier("space-\(kind)")
    }

    private func configure(_ size: CGSize) {
        self.size = size
        flight.resize(width: size.width, height: size.height)
        stopInputs()
    }

    private func stopInputs() {
        inputEpoch += 1
        left = false; right = false; engine = false; thumbSteering = 0
        accessiblePulse = nil
        lastTick = nil
    }

    private func tick() {
        guard enabled, flight.phase == .flying || flight.phase == .celebrating else { return }
        let now = ProcessInfo.processInfo.systemUptime
        let elapsed = lastTick.map { now - $0 } ?? 0
        lastTick = now
        if let pulse = accessiblePulse, now >= pulse.until { accessiblePulse = nil }
        let leftHeld = left || accessiblePulse?.control == .left
        let rightHeld = right || accessiblePulse?.control == .right
        let steer = Double((rightHeld ? 1 : 0) - (leftHeld ? 1 : 0)) + thumbSteering
        switch flight.step(seconds: elapsed, steering: steer,
                           thrust: engine || accessiblePulse?.control == .engine, active: enabled) {
        case .none: break
        case .retry: stopInputs()
        case .touchdown: stopInputs(); chime.playCorrect(volume: speechGameProgress?.effectsVolume)
        case .done: advance()
        }
    }
}

private struct SpaceHeldControl: ViewModifier {
    let change: (CGFloat) -> Void
    let release: () -> Void
    @GestureState private var held = false

    func body(content: Content) -> some View {
        content.gesture(DragGesture(minimumDistance: 0)
            .updating($held) { _, state, _ in state = true }
            .onChanged { change($0.translation.width) })
            .onChange(of: held) { if !$0 { release() } }
    }
}

struct NativeSpacePlanets: View {
    let trip: NativeSpaceFlight.Trip
    let landed: Int
    var finale = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var visible = false

    var body: some View {
        HStack(spacing: finale ? 6 : 8) {
            ForEach(Array(trip.worlds.enumerated()), id: \.element.id) { index, world in
                let color = Color(spaceRGB: world.color)
                Circle().fill(world.id == "rainbow"
                    ? AnyShapeStyle(LinearGradient(colors: [.pink, .yellow, .mint, .blue, .purple], startPoint: .topLeading, endPoint: .bottomTrailing))
                    : AnyShapeStyle(RadialGradient(colors: [.white, color, color.opacity(0.6)], center: .topLeading, startRadius: 1, endRadius: finale ? 30 : 14)))
                    .frame(width: finale ? 27 : 15, height: finale ? 27 : 15)
                    .opacity(index < landed && (!finale || visible || reduceMotion) ? 1 : finale ? 0 : 0.25)
                    .animation(finale && !reduceMotion ? .easeOut(duration: 0.3).delay(Double(index) * 0.18) : nil, value: visible)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(landed) of \(trip.worlds.count) planets landed on")
        .onAppear { visible = true }
    }
}

private extension Color {
    init(spaceRGB rgb: UInt32) {
        self.init(red: Double((rgb >> 16) & 255) / 255, green: Double((rgb >> 8) & 255) / 255, blue: Double(rgb & 255) / 255)
    }
}
