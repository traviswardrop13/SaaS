import SwiftUI
import Combine
import UIKit
import SonaFamilyRules

/// A native map surface over the exact local Treasure motor engine. The
/// existing SayPlay host alone grants each sail and owns game saying credit.
@MainActor
struct NativeTreasureBoard: View {
    let turn: Int
    let advance: () -> Void
    @Environment(\.scenePhase) private var scene
    @Environment(\.isEnabled) private var enabled
    @Environment(\.speechGameProgress) private var progress
    @State private var motion: NativeTreasureMotion? = nil
    @State private var state: NativeTreasureMotion.Snapshot? = nil
    @State private var startedLeg: Int? = nil
    @State private var previousTime: TimeInterval? = nil
    @State private var heardArrival = 0
    @State private var reportedCompletion = 0
    @State private var visible = false
    @State private var failed = false
    @State private var chime = NativeMotorChime()
    private let timer = Timer.publish(every: 1.0 / 60, on: .main, in: .common).autoconnect()

    private var playing: Bool {
        visible && enabled && scene == .active && progress?.isMoveActive != false && progress?.isHelpActive != true
    }
    var body: some View {
        VStack(spacing: 12) {
            if failed {
                Text("The map couldn’t open. Try again.")
                if motion == nil { Button("Try again", action: open).buttonStyle(RoundActionStyle()) }
                else { Text("Close this game and open it again.").font(.footnote) }
            } else if let state {
                Text(state.banner).font(.system(.headline, design: .rounded).weight(.bold))
                    .multilineTextAlignment(.center).accessibilityIdentifier("treasure-banner")
                GeometryReader { geometry in
                    let width = min(geometry.size.width, geometry.size.height / 1.5)
                    let size = CGSize(width: width, height: width * 1.5)
                    map(state, size: size)
                        .frame(width: size.width, height: size.height)
                        .position(x: geometry.size.width / 2, y: geometry.size.height / 2)
                        .onAppear { resize(width) }
                        .onChange(of: width) { resize($0) }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("A treasure map. Draw a route from your boat to the glowing ring, around the islands.")
                .accessibilityIdentifier("treasure-map")
                controls(state)
            } else { ProgressView("Opening the map") }
        }
        .onAppear { visible = true; open() }
        .onReceive(timer) { _ in tick() }
        .onChange(of: playing) { _ in synchronize() }
        .onChange(of: turn) { _ in synchronize() }
        .onDisappear { visible = false; previousTime = nil; chime.stop(); update { try $0.pause() } }
    }

    private func point(_ p: NativeTreasureMotion.Point, _ size: CGSize) -> CGPoint {
        CGPoint(x: p.x * size.width, y: p.y * size.height)
    }
    private func path(_ points: [NativeTreasureMotion.Point], _ size: CGSize) -> Path {
        Path { path in
            guard let first = points.first else { return }
            path.move(to: point(first, size))
            for p in points.dropFirst() { path.addLine(to: point(p, size)) }
        }
    }
    private func map(_ s: NativeTreasureMotion.Snapshot, size: CGSize) -> some View {
        let ringScale = [1.0, 1.5, 2.25, 2.5][min(3, max(0, s.ladder))]
        let boatWidth = max(30, min(size.width, size.height) * 0.13)
        return ZStack {
            Color(red: 0.56, green: 0.80, blue: 0.82)
            ForEach(s.islands.indices, id: \.self) { index in
                let island = s.islands[index]
                Ellipse().fill(Color(red: 0.90, green: 0.83, blue: 0.65))
                    .frame(width: island.rx * size.width * 2, height: island.ry * size.height * 2)
                    .position(x: island.x * size.width, y: island.y * size.height)
            }
            NativeTreasureAsset(path: "/assets/crafted/game/treasure-map-play-v2.webp")
            ForEach(s.trailPoints.indices, id: \.self) { index in
                if s.trailPoints[index].count > 1 && (index < s.trailPoints.count - 1 || !s.active) {
                    path(s.trailPoints[index], size).stroke(Color(red: 0.59, green: 0.20, blue: 0.16).opacity(0.78),
                        style: StrokeStyle(lineWidth: 4, lineCap: .round, dash: [2, 9]))
                }
            }
            if s.active && s.hintPoints.count > 1 && (s.calm > 0 || s.misses >= 1) {
                path(s.hintPoints, size).stroke(Color(red: 1, green: 0.98, blue: 0.85).opacity(s.hintShown == "bold" ? 0.95 : 0.6),
                    style: StrokeStyle(lineWidth: s.hintShown == "bold" ? 6 : 4, lineCap: .round, dash: [3, 10]))
            }
            path(s.wake, size).stroke(.white.opacity(0.7), lineWidth: 2)
            if !s.route.isEmpty {
                path([s.boat] + s.route, size).stroke(SonaPalette.teal, style: StrokeStyle(lineWidth: 4, lineCap: .round, dash: [6, 5]))
            }
            path(s.draft, size).stroke(Color(red: 0.97, green: 0.96, blue: 0.86), style: StrokeStyle(lineWidth: 5, lineCap: .round))
            if !s.finished {
                Ellipse().stroke(Color(red: 1, green: 0.98, blue: 0.85), lineWidth: s.misses >= 2 ? 6 : 4)
                    .frame(width: max(26, size.width * 0.09) * ringScale, height: max(18, size.width * 0.064) * ringScale)
                    .shadow(color: s.misses >= 2 ? .yellow : .teal, radius: s.misses >= 2 ? 22 : 12)
                    .position(point(s.goal, size))
                Text(s.leg == 7 ? "X" : String(s.leg + 1)).font(.system(size: 17, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color(red: 0.36, green: 0.18, blue: 0.02))
                    .position(point(s.goal, size)).offset(y: -18)
            }
            ZStack {
                Image(systemName: "sailboat.fill").resizable().scaledToFit().foregroundStyle(SonaPalette.teal)
                NativeTreasureAsset(path: "/assets/crafted/game/treasure-boat.webp")
            }
            .frame(width: boatWidth, height: boatWidth * 1.13)
            .rotationEffect(.radians(sin(s.heading) * 0.13))
            .position(point(s.boat, size)).offset(y: -boatWidth * 1.13 * 0.15)
            if s.active && !s.moving && s.draft.isEmpty {
                Circle().stroke(.white.opacity(0.9), lineWidth: 3).frame(width: boatWidth * 1.4, height: boatWidth * 1.4)
                    .position(point(s.boat, size))
            }
            if s.active && s.misses >= 2 && !s.moving && s.draft.isEmpty && s.hintPoints.count > 1 {
                let a = point(s.hintPoints[0], size), b = point(s.hintPoints[1], size)
                let angle = atan2(b.y - a.y, b.x - a.x)
                Image(systemName: "arrow.right").font(.system(size: 27, weight: .heavy))
                    .foregroundStyle(Color(red: 1, green: 0.98, blue: 0.85))
                    .rotationEffect(.radians(angle))
                    .position(x: a.x + cos(angle) * boatWidth, y: a.y + sin(angle) * boatWidth)
            }
            if s.finished {
                NativeTreasureAsset(path: "/assets/crafted/game/treasure-chest.webp")
                    .frame(width: size.width * 0.26, height: size.width * 0.26).position(point(s.goal, size))
            }
        }
        .clipped().contentShape(Rectangle())
        .overlay(NativeTreasurePointerSurface(enabled: playing,
            down: { p in update { try $0.pointerDown(normalized(p, size)) } },
            move: { p in update { try $0.pointerMove(normalized(p, size)) } },
            up: { p in update { try $0.pointerUp(normalized(p, size)) } },
            cancel: { update { try $0.cancelDrawing() } }))
    }

    private func normalized(_ p: CGPoint, _ size: CGSize) -> NativeTreasureMotion.Point {
        .init(x: min(1, max(0, Double(p.x / max(1, size.width)))),
              y: min(1, max(0, Double(p.y / max(1, size.height)))))
    }
    private func controls(_ s: NativeTreasureMotion.Snapshot) -> some View {
        HStack {
            Button { update { try $0.resetHarbour() } } label: { Image(systemName: "arrow.counterclockwise").frame(width: 48, height: 44) }
                .accessibilityLabel("Return to this harbour and draw a fresh route")
                .accessibilityIdentifier("treasure-reset")
                .disabled(!playing || !s.active || s.finished)
            Spacer()
            if progress?.requestHelp != nil {
                Button("Calm seas", action: requestHelp)
                    .buttonStyle(.bordered).frame(minHeight: 44)
                    .accessibilityIdentifier("treasure-help")
                    .disabled(!playing || !s.active || s.calm > 10 || s.finished)
            }
        }
    }
    private func open() {
        guard motion == nil else { synchronize(); return }
        do { motion = try NativeTreasureMotion(); state = motion?.snapshot; failed = false; synchronize() }
        catch { failed = true }
    }
    private func synchronize() {
        previousTime = nil
        if playing {
            if startedLeg != turn {
                update { try $0.beginLeg(turn) }
                if !failed { startedLeg = turn }
            } else { update { try $0.resume() } }
        } else {
            chime.stop(); update { try $0.pause() }
        }
    }
    private func resize(_ width: CGFloat) {
        guard width >= 1 else { return }
        update { try $0.resize(unit: Double(width)) }
    }
    private func tick() {
        guard playing, motion != nil, !failed else { previousTime = nil; return }
        let now = ProcessInfo.processInfo.systemUptime
        defer { previousTime = now }
        guard let before = previousTime else { return }
        update { try $0.step(seconds: min(0.04, max(0, now - before))) }
        guard let state else { return }
        if state.arrivals > heardArrival {
            heardArrival = state.arrivals
            chime.playCorrect(volume: progress?.effectsVolume)
        }
        if state.completions > reportedCompletion {
            reportedCompletion = state.completions
            if turn == state.leg, startedLeg == turn {
                if turn == 7 { update { try $0.finale() } }
                advance()
            }
        }
    }
    private func requestHelp() {
        guard playing, let request = progress?.requestHelp, let motion, let state,
              state.active, state.calm <= 10 else { return }
        let requestedLeg = turn
        chime.stop(); previousTime = nil
        update { try $0.pause() }
        let accepted = request { earned in
            guard self.motion === motion, self.turn == requestedLeg, self.startedLeg == requestedLeg else { return }
            self.previousTime = nil
            if earned && self.visible && self.scene == .active { self.update { try $0.grantHelp() } }
            else { self.synchronize() }
        }
        if !accepted { synchronize() }
    }
    private func update(_ operation: (NativeTreasureMotion) throws -> NativeTreasureMotion.Snapshot) {
        guard let motion, !failed else { return }
        do { state = try operation(motion) }
        catch { failed = true; previousTime = nil; chime.stop() }
    }
}

/// UIKit supplies a single explicit down/move/up/cancel stream. In particular,
/// an interrupted drag cancels its draft without turning it into a route.
private struct NativeTreasurePointerSurface: UIViewRepresentable {
    let enabled: Bool
    let down, move, up: (CGPoint) -> Void
    let cancel: () -> Void
    func makeUIView(context: Context) -> TreasureTouchView { TreasureTouchView() }
    func updateUIView(_ view: TreasureTouchView, context: Context) {
        if !enabled { view.clearCallbacks(); view.isUserInteractionEnabled = false; return }
        view.down = down; view.move = move; view.up = up; view.cancel = cancel
        view.isUserInteractionEnabled = true
    }
    static func dismantleUIView(_ view: TreasureTouchView, coordinator: ()) { view.clearCallbacks() }
}
private final class TreasureTouchView: UIView {
    var down: ((CGPoint) -> Void)?
    var move: ((CGPoint) -> Void)?
    var up: ((CGPoint) -> Void)?
    var cancel: (() -> Void)?
    private weak var pointer: UITouch?
    init() { super.init(frame: .zero); backgroundColor = .clear; isOpaque = false; isMultipleTouchEnabled = false }
    required init?(coder: NSCoder) { nil }
    func clearCallbacks() { pointer = nil; down = nil; move = nil; up = nil; cancel = nil }
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard pointer == nil, let touch = touches.first else { return }
        pointer = touch; down?(touch.location(in: self))
    }
    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let pointer, touches.contains(pointer) else { return }; move?(pointer.location(in: self))
    }
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let pointer, touches.contains(pointer) else { return }
        up?(pointer.location(in: self)); self.pointer = nil
    }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let pointer, touches.contains(pointer) else { return }; self.pointer = nil; cancel?()
    }
}

private struct NativeTreasureAsset: View {
    let path: String
    @State private var image: UIImage? = nil
    var body: some View {
        Group {
            if let image { Image(uiImage: image).resizable().scaledToFit() }
            else { Color.clear }
        }
        .task(id: path) {
            do {
                let value = try await NativeArtworkLoader.shared.image(path: path)
                guard !Task.isCancelled else { return }
                image = value
            } catch { /* The source's visible map/boat fallback stays underneath. */ }
        }
    }
}
