import Combine
import SwiftUI
import UIKit

struct NativeRaceBoard: View {
    let turn: Int
    let advance: () -> Void
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.speechGameProgress) private var speech
    @State private var course = NativeRaceCourse()
    @State private var startedLeg: Int?
    @State private var lastTick: TimeInterval?
    @State private var width: Double = 390
    @State private var pictures: [String: UIImage] = [:]
    @State private var chime = NativeMotorChime()
    @State private var steeringUntil = 0.0
    @State private var brakeUntil = 0.0
    @GestureState private var steering = false
    @GestureState private var braking = false

    private let timer = Timer.publish(every: 1.0 / 45, on: .main, in: .common).autoconnect()
    private var active: Bool { scenePhase == .active && speech?.isMoveActive != false }
    private var now: TimeInterval { ProcessInfo.processInfo.systemUptime }

    var body: some View {
        VStack(spacing: 9) {
            HStack {
                Text(course.message).font(.headline).accessibilityIdentifier("race-status")
                Spacer()
                Label(String(course.stars), systemImage: "star.fill")
                    .accessibilityLabel("\(course.stars) stars caught")
                    .accessibilityIdentifier("race-stars")
            }
            GeometryReader { geo in
                Canvas { context, size in paint(context, size: size) }
                    .clipShape(RoundedRectangle(cornerRadius: 23))
                    .contentShape(Rectangle())
                    .gesture(DragGesture(minimumDistance: 0)
                        .updating($steering) { _, held, _ in held = true }
                        .onChanged { value in
                            guard active, course.driving else { return }
                            course.steer(to: course.xForTouch(value.location.x, width: geo.size.width))
                        }
                        .onEnded { _ in if active { course.finishSteering() } })
                    .accessibilityHidden(true)
                    .onAppear { width = geo.size.width }
                    .onChange(of: geo.size.width) { width = $0 }
            }
            .frame(minHeight: 165)
            HStack(spacing: 8) {
                Button("Left") { nudge(-1) }.buttonStyle(RoundActionStyle())
                    .accessibilityIdentifier("race-left")
                Text("Brake")
                    .font(.headline).foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(SonaPalette.teal, in: Capsule())
                    .gesture(DragGesture(minimumDistance: 0).updating($braking) { _, held, _ in held = true })
                    .accessibilityAddTraits(.isButton)
                    .accessibilityAction { if active { brakeUntil = now + 0.7 } }
                    .accessibilityIdentifier("race-brake")
                Button("Right") { nudge(1) }.buttonStyle(RoundActionStyle())
                    .accessibilityIdentifier("race-right")
            }
            .disabled(!active || !course.driving)
            if let help = speech?.requestHelp {
                Button("Pit crew") { _ = help { if $0 { course.grantHelp() } } }
                    .buttonStyle(.bordered)
                    .frame(minHeight: 44)
                    .disabled(!active || !course.driving || course.slow > 6)
                    .accessibilityIdentifier("race-help")
            }
        }
        .onAppear { startIfReady() }
        .onChange(of: turn) { _ in startIfReady() }
        .onChange(of: active) { active in
            lastTick = nil
            if active { startIfReady() }
            else { course.freezeInput(); steeringUntil = 0; brakeUntil = 0; chime.stop() }
        }
        .onDisappear { chime.stop() }
        .onReceive(timer) { _ in tick() }
        .task {
            for name in ["racecar-bg", "racecar-car", "racecar-cone", "racecar-finish", "star"] {
                if let image = try? await NativeArtworkLoader.shared.image(path: "/assets/crafted/game/\(name).webp"),
                   !Task.isCancelled { pictures[name] = image }
            }
        }
    }

    private func startIfReady() {
        guard active, startedLeg != turn else { return }
        startedLeg = turn
        course.startLeg(turn, little: speech?.isSimple == true)
        lastTick = nil
    }

    private func nudge(_ direction: Double) {
        guard active, course.driving else { return }
        course.steer(to: course.target + direction * 0.21)
        steeringUntil = now + 0.36
        course.finishSteering()
    }

    private func tick() {
        guard active, startedLeg == turn else { return }
        let time = now
        let elapsed = lastTick.map { time - $0 } ?? 0
        lastTick = time
        switch course.tick(seconds: elapsed, width: width, active: active,
                           steering: steering || steeringUntil > time, braking: braking || brakeUntil > time) {
        case .none: break
        case .arrived: chime.playCorrect(volume: speech?.effectsVolume)
        case .done: advance()
        }
    }

    private func paint(_ context: GraphicsContext, size: CGSize) {
        if let background = pictures["racecar-bg"] {
            context.draw(Image(uiImage: background), in: CGRect(origin: .zero, size: size))
        } else {
            context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(SonaPalette.mint))
        }
        func point(_ x: Double, _ distance: Double) -> CGPoint {
            let location = course.project(x, distance, width: size.width, height: size.height)
            return .init(x: location.x, y: location.y)
        }
        func strip(_ left: Double, _ right: Double, _ depth: Double, _ near: Double, _ color: Color) {
            let path = Path { path in
                path.move(to: point(left, depth))
                path.addLine(to: point(right, depth))
                path.addLine(to: point(right, near))
                path.addLine(to: point(left, near))
                path.closeSubpath()
            }
            context.fill(path, with: .color(color))
        }
        for depth in stride(from: 100, to: 0, by: -4) {
            let front = Double(depth), near = front - 4
            let band = Int((course.travel + front) / 5).isMultiple(of: 2)
            strip(-1, 1, front, near, Color(red: 0.61, green: 0.57, blue: 0.52))
            strip(-1.08, -1, front, near, band ? .white : .red)
            strip(1, 1.08, front, near, band ? .white : .red)
            if band {
                strip(-0.35, -0.33, front, near, .white)
                strip(0.33, 0.35, front, near, .white)
            }
        }
        for item in course.items.sorted(by: { $0.z > $1.z }) {
            let projected = course.project(item.x, item.z, width: size.width, height: size.height)
            let image = item.kind == .star ? "star" : item.kind == .rival ? "racecar-car" : "racecar-cone"
            let w = size.width * (item.kind == .rival ? 0.19 : 0.11) * projected.scale
            let h = w * (item.kind == .rival ? 0.74 : 1.04)
            let box = CGRect(x: projected.x - w / 2, y: projected.y - h, width: w, height: h)
            if let picture = pictures[image] {
                var tint = context
                if item.kind == .rival { tint.addFilter(.hueRotation(.degrees(200))) }
                tint.draw(Image(uiImage: picture), in: box)
            } else { context.fill(Path(roundedRect: box, cornerRadius: 5), with: .color(.yellow)) }
        }
        let car = point(course.car, 15)
        let gate = course.legLength - course.distance
        if gate < 58 || course.celebration > 0 {
            let ring = course.celebration > 0 ? car : point(course.ringX, max(19, gate))
            let radius = course.celebration > 0 ? size.width * 0.17 : course.ringRadius(width: size.width)
            let shape = Path(ellipseIn: CGRect(x: ring.x - radius, y: ring.y - 11, width: radius * 2, height: 22))
            if course.arrow || course.celebration > 0 { context.fill(shape, with: .color(.mint.opacity(0.5))) }
            context.stroke(shape, with: .color(.white), lineWidth: 3)
            if course.leg == 7, let finish = pictures["racecar-finish"] {
                context.draw(Image(uiImage: finish), in: CGRect(x: size.width * 0.17,
                    y: ring.y - size.width * 0.31, width: size.width * 0.66, height: size.width * 0.25))
            } else {
                context.draw(Text("PIT STOP").font(.caption.bold()).foregroundColor(.white),
                             at: .init(x: ring.x, y: ring.y - 32))
            }
            if course.arrow {
                let symbol = car.x + 12 < ring.x ? "arrow.right" : car.x - 12 > ring.x ? "arrow.left" : "arrow.down"
                context.draw(Image(systemName: symbol).renderingMode(.template), at: .init(x: ring.x, y: ring.y - 48))
            }
        }
        let carWidth = min(130, size.width * 0.29)
        let carBox = CGRect(x: car.x - carWidth / 2, y: car.y - carWidth * 0.74, width: carWidth, height: carWidth * 0.74)
        if let picture = pictures["racecar-car"] { context.draw(Image(uiImage: picture), in: carBox) }
        else { context.fill(Path(roundedRect: carBox, cornerRadius: 10), with: .color(.red)) }
    }
}
