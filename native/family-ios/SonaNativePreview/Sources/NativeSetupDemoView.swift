#if canImport(UIKit)
import SwiftUI
import UIKit
import QuartzCore

/// The current two silent, painted comparisons. This renders its own preview
/// scene and has no game controller, speech service, storage or credit callback.
struct NativeSetupDemoView: View {
    typealias Kind = NativeSetupDemoKind
    let kind: Kind
    var compact = false
    @StateObject private var driver: NativeSetupDemoDriver
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reducedMotion
    @State private var lastDrag: CGPoint?

    init(kind: Kind, compact: Bool = false) {
        self.kind = kind; self.compact = compact
        _driver = StateObject(wrappedValue: NativeSetupDemoDriver(kind: kind))
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("See speech help").tracking(1.5).textCase(.uppercase)
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .foregroundStyle(NativeSetupArtworkStyle.coral)
            Text(kind == .fruit ? "Speech practice.\nThrough play." : "Say the sound\nto slow the keys.")
                .font(.system(size: compact ? 28 : 32, weight: .heavy, design: .rounded))
                .foregroundStyle(NativeSetupArtworkStyle.ink)
                .accessibilityAddTraits(.isHeader)
            scene.frame(height: compact ? 255 : 340)
            HStack(spacing: 7) {
                phaseButton(.normal, title: "Normal speed")
                phaseButton(.afterPractice, title: "After practice")
            }
        }
        .accessibilityIdentifier("setup-demo-" + kind.rawValue)
        .onAppear { driver.appear(kind: kind, foreground: scenePhase == .active, reducedMotion: reducedMotion) }
        .onDisappear { driver.disappear(); lastDrag = nil }
        .onChange(of: kind) { driver.appear(kind: $0, foreground: scenePhase == .active, reducedMotion: reducedMotion); lastDrag = nil }
        .onChange(of: scenePhase) { driver.foreground($0 == .active); lastDrag = nil }
        .onChange(of: reducedMotion) { driver.reducedMotion($0); lastDrag = nil }
    }
    private var scene: some View {
        GeometryReader { geometry in
            ZStack(alignment: .top) {
                Group {
                    if kind == .fruit {
                        Image("fruit-slice-coast").resizable().scaledToFill()
                    } else {
                        NativeSetupArtworkImage(path: "/assets/crafted/piano-stage-v2.webp", contentMode: .fill)
                    }
                }
                .frame(width: geometry.size.width, height: geometry.size.height).clipped()
                .accessibilityHidden(true)
                Canvas { context, size in
                    NativeSetupDemoDrawing.draw(driver.session, context: context, size: size)
                }
                .accessibilityHidden(true)
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 0).onChanged { event in
                    if kind == .fruit {
                        if let lastDrag { driver.swipe(from: lastDrag, to: event.location) }
                        lastDrag = event.location
                    } else if lastDrag == nil { driver.tap(event.location); lastDrag = event.location }
                }.onEnded { _ in lastDrag = nil })
                VStack {
                    HStack {
                        pill(kind == .fruit ? "Fruit Slice" : "Piano Tiles")
                        Spacer()
                        pill(driver.session.clock.phase == .normal ? "Normal speed" : "After practice")
                    }
                    HStack(spacing: 10) {
                        NativeSetupArtworkImage(path: "/assets/crafted/echo-listen.webp").frame(width: 36, height: 36)
                        Text("rrrr").font(.system(size: 23, weight: .heavy, design: .rounded))
                        Image(systemName: "mic.fill").font(.system(size: 16))
                    }
                    .foregroundStyle(NativeSetupArtworkStyle.color(0x6c4c31))
                    .padding(.horizontal, 12).padding(.vertical, 3)
                    .background(driver.session.clock.phase == .normal ? NativeSetupArtworkStyle.color(0xfffaf1) : NativeSetupArtworkStyle.color(0xddf7ee), in: Capsule())
                    .overlay(Capsule().stroke(driver.session.clock.phase == .normal ? NativeSetupArtworkStyle.color(0xe7d6b8) : NativeSetupArtworkStyle.color(0x56b4a9)))
                    Spacer()
                    pill(message).padding(.bottom, kind == .piano ? 52 : 0)
                }
                .padding(10).allowsHitTesting(false).accessibilityHidden(true)
            }
            .background(kind == .fruit ? NativeSetupArtworkStyle.color(0xbbe6e8) : NativeSetupArtworkStyle.color(0x302361))
            .clipped()
            .onAppear { driver.resize(geometry.size) }
            .onChange(of: geometry.size) { driver.resize($0) }
        }
        .clipShape(RoundedRectangle(cornerRadius: 23))
        .overlay(RoundedRectangle(cornerRadius: 23).stroke(NativeSetupArtworkStyle.color(0xffe09a), lineWidth: 5))
        .overlay(RoundedRectangle(cornerRadius: 21).stroke(driver.session.clock.phase == .afterPractice ? NativeSetupArtworkStyle.color(0x61c3b0) : .clear, lineWidth: 2).padding(4))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(kind == .fruit ? "Fruit launches upward and is sliced." : "Notes fall toward the keyboard and are tapped.")
        .accessibilityValue(driver.session.clock.phase == .normal ? "Normal speed" : "After practice")
    }
    private var message: String {
        if kind == .fruit { return driver.session.clock.phase == .normal ? "Swipe to slice." : "Slower fruit." }
        return driver.session.clock.phase == .normal ? "Tap the keys." : "Slower keys."
    }
    private func pill(_ text: String) -> some View {
        Text(text).font(.system(size: 11, weight: .heavy, design: .rounded))
            .foregroundStyle(NativeSetupArtworkStyle.ink).padding(.horizontal, 9).padding(.vertical, 6)
            .background(NativeSetupArtworkStyle.color(0xfffaf1), in: Capsule())
    }
    private func phaseButton(_ phase: NativeSetupDemoPhase, title: String) -> some View {
        let selected = driver.session.clock.phase == phase
        return Button { driver.select(phase) } label: {
            Text(title).font(.system(size: 13, weight: .heavy, design: .rounded))
                .frame(maxWidth: .infinity, minHeight: 46)
                .foregroundStyle(selected ? NativeSetupArtworkStyle.color(0x93422f) : NativeSetupArtworkStyle.muted)
                .background(selected ? NativeSetupArtworkStyle.color(0xffe4cc) : .white, in: Capsule())
                .overlay(Capsule().stroke(selected ? NativeSetupArtworkStyle.coral : NativeSetupArtworkStyle.color(0xead7bf)))
        }
        .buttonStyle(.plain)
        .accessibilityValue(selected ? "Selected" : "Not selected")
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityIdentifier("setup-demo-" + kind.rawValue + "-" + phase.rawValue)
    }
}

@MainActor private final class NativeSetupDemoDriver: ObservableObject {
    private(set) var session: NativeSetupDemoSession
    private var displayLink: CADisplayLink?
    private lazy var target = NativeSetupDemoTarget(owner: self)
    init(kind: NativeSetupDemoKind) { session = .init(kind: kind) }
    deinit { displayLink?.invalidate() }
    func appear(kind: NativeSetupDemoKind, foreground: Bool, reducedMotion: Bool) {
        change { $0.reconfigure(kind: kind, now: ProcessInfo.processInfo.systemUptime, foreground: foreground, reducedMotion: reducedMotion) }
    }
    func disappear() { change { $0.disappear() } }
    func foreground(_ value: Bool) { change { $0.foreground(value, now: ProcessInfo.processInfo.systemUptime) } }
    func reducedMotion(_ value: Bool) { change { $0.reducedMotion(value, now: ProcessInfo.processInfo.systemUptime) } }
    func select(_ value: NativeSetupDemoPhase) { change { $0.select(value, now: ProcessInfo.processInfo.systemUptime) } }
    func resize(_ size: CGSize) { change { $0.resize(size) } }
    func swipe(from: CGPoint, to: CGPoint) { change { $0.swipe(from: from, to: to) } }
    func tap(_ point: CGPoint) { change { $0.tap(point) } }
    func tick(_ now: Double) { objectWillChange.send(); session.advance(now: now) }
    private func change(_ body: (inout NativeSetupDemoSession) -> Void) {
        objectWillChange.send(); body(&session)
        if session.clock.isAnimating, displayLink == nil {
            let link = CADisplayLink(target: target, selector: #selector(NativeSetupDemoTarget.frame(_:)))
            link.preferredFramesPerSecond = 30; link.add(to: .main, forMode: .common); displayLink = link
        } else if !session.clock.isAnimating { displayLink?.invalidate(); displayLink = nil }
    }
}
@MainActor private final class NativeSetupDemoTarget: NSObject {
    weak var owner: NativeSetupDemoDriver?
    init(owner: NativeSetupDemoDriver) { self.owner = owner }
    @objc func frame(_ link: CADisplayLink) { owner?.tick(link.timestamp) }
}

private enum NativeSetupDemoDrawing {
    static func draw(_ scene: NativeSetupDemoSession, context: GraphicsContext, size: CGSize) {
        if scene.kind == .fruit { fruit(scene, context: context, size: size) }
        else { piano(scene, context: context, size: size) }
    }
    private static func fruit(_ scene: NativeSetupDemoSession, context: GraphicsContext, size: CGSize) {
        var canvas = context
        canvas.clip(to: Path(CGRect(x: 0, y: 92, width: size.width, height: max(0, size.height - 92))))
        for drop in scene.fruit.drops {
            var ink = canvas; ink.opacity = max(0, 1 - drop.age / drop.life)
            ink.fill(Path(ellipseIn: CGRect(x: drop.x - drop.radius, y: drop.y - drop.radius, width: drop.radius * 2, height: drop.radius * 2)), with: .color(NativeSetupArtworkStyle.color(drop.color)))
        }
        for fruit in scene.fruit.halves + scene.fruit.fruits {
            let kind = NativeSetupFruitScene.kinds[fruit.kind]
            var ink = canvas; ink.translateBy(x: fruit.x, y: fruit.y); ink.rotate(by: .radians(fruit.angle))
            if fruit.side != 0 { ink.clip(to: Path(CGRect(x: fruit.side < 0 ? -fruit.size : 0, y: -fruit.size, width: fruit.size, height: fruit.size * 2))) }
            let scale = fruit.size / max(kind.crop.width, kind.crop.height)
            let rect = CGRect(x: -kind.crop.width * scale / 2, y: -kind.crop.height * scale / 2, width: kind.crop.width * scale, height: kind.crop.height * scale)
            if let image = NativeSetupArtworkLoader.image(path: "/assets/crafted/fruit-" + kind.name + ".webp", crop: kind.crop) {
                ink.draw(Image(uiImage: image), in: rect)
            } else {
                let radius = fruit.size * 0.44
                ink.fill(Path(ellipseIn: CGRect(x: -radius, y: -radius, width: radius * 2, height: radius * 2)), with: .color(NativeSetupArtworkStyle.color(kind.color)))
                ink.translateBy(x: fruit.size * 0.12, y: -fruit.size * 0.42)
                ink.rotate(by: .radians(-0.5))
                ink.fill(Path(ellipseIn: CGRect(x: -fruit.size * 0.16, y: -fruit.size * 0.07, width: fruit.size * 0.32, height: fruit.size * 0.14)), with: .color(NativeSetupArtworkStyle.color(0x659b48)))
            }
        }
        for swipe in scene.fruit.swipes {
            var ink = canvas; ink.opacity = max(0, 1 - swipe.age / swipe.life)
            var line = Path(); line.move(to: swipe.from)
            line.addQuadCurve(to: swipe.to, control: CGPoint(x: (swipe.from.x + swipe.to.x) / 2, y: swipe.to.y + 7))
            ink.stroke(line, with: .color(NativeSetupArtworkStyle.color(0xffd47c)), style: StrokeStyle(lineWidth: 11, lineCap: .round))
            ink.stroke(line, with: .color(NativeSetupArtworkStyle.color(0xfffef2)), style: StrokeStyle(lineWidth: 4, lineCap: .round))
        }
    }
    private static func piano(_ scene: NativeSetupDemoSession, context: GraphicsContext, size: CGSize) {
        let w = size.width, h = size.height, laneW = w / 4
        let top = NativeSetupPianoScene.top(size), hitY = NativeSetupPianoScene.hitY(size)
        let colors = ["coral", "purple", "green", "blue"]
        for lane in 0..<4 {
            context.fill(Path(CGRect(x: Double(lane) * laneW, y: top, width: laneW, height: hitY - top)), with: .color(lane % 2 == 1 ? .white.opacity(0.018) : NativeSetupArtworkStyle.color(0x130930).opacity(0.06)))
            if lane > 0 { context.fill(Path(CGRect(x: Double(lane) * laneW - 0.6, y: top, width: 1.2, height: hitY - top)), with: .color(.white.opacity(0.13))) }
        }
        context.fill(Path(CGRect(x: 0, y: hitY - 3, width: w, height: h - hitY + 3)), with: .color(NativeSetupArtworkStyle.color(0x39284d)))
        for lane in 0..<4 {
            let glow = scene.piano.flashes[lane], x = Double(lane) * laneW + 2
            let y = hitY + glow * 4, keyW = laneW - 4, keyH = h - y - 5
            let key = CGRect(x: x, y: y, width: keyW, height: keyH - 4)
            context.fill(Path(roundedRect: CGRect(x: x, y: y + 5, width: keyW, height: keyH), cornerRadius: 7), with: .color(NativeSetupArtworkStyle.color(0xad8d5e)))
            var ink = context; ink.clip(to: Path(roundedRect: key, cornerRadius: 7))
            ink.fill(Path(key), with: .color(NativeSetupArtworkStyle.color(0xfff7df)))
            if let wood = NativeSetupArtworkLoader.image(path: "/assets/crafted/painted-wood-ivory.webp") {
                ink.draw(Image(uiImage: wood), in: key)
                ink.fill(Path(key), with: .color(NativeSetupArtworkStyle.color(0xfffbe5).opacity(0.48)))
            }
            if glow > 0 { ink.fill(Path(key), with: .color(NativeSetupArtworkStyle.color(0xffd867).opacity(glow * 0.75))) }
            context.stroke(Path(roundedRect: key.insetBy(dx: 2, dy: 2), cornerRadius: 5), with: .color(.white.opacity(0.8)), lineWidth: 1)
            if glow > 0 {
                let rx = laneW * (0.28 + (1 - glow) * 0.2), ry = 5 + (1 - glow) * 10
                let ring = CGRect(x: x + keyW / 2 - rx, y: hitY + 1 - ry, width: rx * 2, height: ry * 2)
                context.stroke(Path(ellipseIn: ring), with: .color(NativeSetupArtworkStyle.color(0xfff4b0).opacity(glow)), lineWidth: 2)
            }
        }
        for lane in 1..<4 {
            let key = CGRect(x: Double(lane) * laneW - laneW * 0.14, y: hitY - 1, width: laneW * 0.28, height: 27)
            context.fill(Path(roundedRect: key, cornerRadius: 3), with: .color(NativeSetupArtworkStyle.color(0x211b35)))
            let face = CGRect(x: key.minX + 2, y: hitY, width: key.width - 4, height: 22)
            context.fill(Path(roundedRect: face, cornerRadius: 2), with: .color(NativeSetupArtworkStyle.color(0x4b405f)))
        }
        var notes = context; notes.clip(to: Path(CGRect(x: 0, y: top - 2, width: w, height: hitY - top + 3)))
        let tileW = min(laneW - 14, 66), tileH = tileW * 1.25
        let visible: [(Int, Double)] = scene.clock.reducedMotion
            ? [(0, top + (hitY - top) * 0.08), (2, top + (hitY - top) * 0.44), (1, hitY - tileH + 8)]
            : scene.piano.notes.map { ($0.lane, top - tileH + min(1, (scene.piano.songTime - $0.born) / 1.05) * (hitY - top)) }
        for (lane, y) in visible {
            let rect = CGRect(x: Double(lane) * laneW + (laneW - tileW) / 2, y: y, width: tileW, height: tileH)
            var face = notes
            face.addFilter(.shadow(color: NativeSetupArtworkStyle.color(0x0e0826).opacity(0.3), radius: 7, x: 0, y: 4))
            if let image = NativeSetupArtworkLoader.image(path: "/assets/crafted/game/tile-" + colors[lane] + ".webp") { face.draw(Image(uiImage: image), in: rect) }
            else {
                face.fill(Path(roundedRect: rect, cornerRadius: 14), with: .color(NativeSetupArtworkStyle.color(NativeSetupPianoScene.colors[lane])))
                face.draw(Text("♪").font(.system(size: tileW * 0.72, weight: .bold)).foregroundColor(NativeSetupArtworkStyle.color(0xfff7d9)), at: CGPoint(x: rect.midX, y: rect.minY + tileH * 0.55))
            }
        }
        for spark in scene.piano.sparks {
            var ink = context; ink.opacity = max(0, spark.life * 2)
            ink.translateBy(x: spark.x, y: spark.y); ink.rotate(by: .radians(spark.life * 3))
            let r = 2.5 + spark.life * 3
            var path = Path(); path.move(to: CGPoint(x: 0, y: -r))
            for point in [CGPoint(x: r * 0.4, y: -r * 0.3), CGPoint(x: r, y: 0), CGPoint(x: r * 0.3, y: r * 0.3), CGPoint(x: 0, y: r), CGPoint(x: -r * 0.3, y: r * 0.3), CGPoint(x: -r, y: 0), CGPoint(x: -r * 0.3, y: -r * 0.3)] { path.addLine(to: point) }
            path.closeSubpath(); ink.fill(path, with: .color(NativeSetupArtworkStyle.color(spark.color)))
        }
    }
}
#endif
