import SwiftUI
import Combine
import UIKit
import AVFoundation

private struct NativeDinoCollectionKey: EnvironmentKey { static let defaultValue: NativeDinoCollectionAccess? = nil }
extension EnvironmentValues {
    var dinoCollectionAccess: NativeDinoCollectionAccess? {
        get { self[NativeDinoCollectionKey.self] }
        set { self[NativeDinoCollectionKey.self] = newValue }
    }
}

struct NativeDinoDigRound: View {
    let onFound: (NativeDinoCompletion) -> Void
    let onComplete: () -> Void
    @Environment(\.speechGameProgress) private var progress
    @Environment(\.arcadeRoundContext) private var arcadeRound
    @Environment(\.dinoCollectionAccess) private var access
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var motor: NativeDinoDig?
    @State private var failed = false
    @State private var lastTick: TimeInterval?
    @State private var roundID = UUID()
    @State private var audio = NativeDinoEffects()
    private let clock = Timer.publish(every: 1.0 / 60, on: .main, in: .common).autoconnect()
    var body: some View {
        Group {
            if let motor {
                VStack(spacing: 8) {
                    Text("Today: \(motor.dino.name)").font(.headline).accessibilityIdentifier("dino-name")
                    NativeDinoCollectionRow(catalog: motor.catalog, collection: motor.collection)
                        .frame(height: 55)
                    GeometryReader { geometry in
                        let drawSize = CGSize(width: min(geometry.size.width, geometry.size.height * 440 / 560), height: geometry.size.height)
                        Canvas { context, size in NativeDinoDrawing.scene(motor, context: context, size: size, reduceMotion: reduceMotion) }
                            .clipShape(RoundedRectangle(cornerRadius: 22))
                            .contentShape(Rectangle())
                            .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                                guard progress?.isMoveActive != false, scenePhase == .active else { return }
                                self.motor?.rub(at: value.location)
                            }.onEnded { _ in self.motor?.endStroke() })
                            .frame(width: drawSize.width, height: drawSize.height)
                            .position(x: geometry.size.width / 2, y: geometry.size.height / 2)
                            .onAppear { self.motor?.resize(drawSize) }
                            .onChange(of: drawSize) { self.motor?.resize($0) }
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel("A sandy dig site with the outline of \(motor.dino.a) \(motor.dino.name) skeleton")
                            .accessibilityValue("\(motor.found) bones placed")
                            .accessibilityAction(named: "Brush next patch", brush)
                            .accessibilityIdentifier("dino-sand")
                    }
                    HStack {
                        Text(status(motor)).font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity, alignment: .leading)
                        Button("Brush next patch", action: brush).buttonStyle(.bordered)
                            .disabled(motor.phase != .ready || progress?.isMoveActive == false)
                            .accessibilityIdentifier("dino-brush")
                    }
                }
            } else if failed {
                VStack(spacing: 12) { Text("Sona couldn’t open the dig."); Button("Try again") { roundID = UUID() } }
            } else { ProgressView("Opening the dig") }
        }
        .task(id: roundID) { await load() }
        .onReceive(clock) { _ in tick() }
        .onChange(of: progress?.isMoveActive) { active in
            if active != false { earnBrush() }
            else if motor?.phase != .awake { audio.stop() }
        }
        .onChange(of: scenePhase) { phase in
            lastTick = nil
            if phase != .active { motor?.endStroke(); audio.stop() }
            else { earnBrush() }
        }
        .onDisappear { lastTick = nil; audio.stop() }
    }
    private func load() async {
        failed = false; motor = nil; lastTick = nil
        do {
            let catalog = try NativeDinoCatalog.load()
            let collection = try await access?.load() ?? .empty
            guard !Task.isCancelled, access?.isCurrent() != false else { return }
            motor = NativeDinoDig(catalog: catalog, collection: collection, level: arcadeRound?.level ?? 1)
            earnBrush()
        } catch { if !Task.isCancelled { failed = true } }
    }
    private func earnBrush() {
        guard progress?.isMoveActive != false, scenePhase == .active else { return }
        if motor?.earnBrush() == true { audio.play("brush", volume: progress?.effectsVolume) }
    }
    private func brush() {
        guard progress?.isMoveActive != false, scenePhase == .active else { return }
        motor?.accessibleBrush(); audio.play("brush", volume: progress?.effectsVolume)
    }
    private func tick() {
        let now = ProcessInfo.processInfo.systemUptime
        guard scenePhase == .active, access?.isCurrent() != false else { lastTick = nil; return }
        let dt = lastTick.map { now - $0 } ?? 0; lastTick = now
        guard let event = motor?.advance(seconds: dt) else { return }
        switch event {
        case .boneFound: audio.play("pop", volume: progress?.effectsVolume)
        case .flying: audio.play("whoosh", volume: progress?.effectsVolume)
        case .placed: audio.play("clack", volume: progress?.effectsVolume)
        case .moveCompleted(let final):
            audio.stop()
            if let progress { progress.advance() }
            if final, let completion = motor?.wake() {
                onFound(completion)
                audio.play("roar", volume: progress?.effectsVolume)
                if let access { let receipt = "\(roundID.uuidString)/dino/\(completion.dino.id)"; Task { @MainActor in await access.save(completion.collection, receipt) } }
            } else if progress == nil { earnBrush() }
        case .roundCompleted: audio.stop(); onComplete()
        }
    }
    private func status(_ motor: NativeDinoDig) -> String {
        switch motor.phase {
        case .idle: return "Say the word to get a brush."
        case .ready: return "Rub the sand to dig!"
        case .found: return motor.currentBone?.shout ?? (motor.found == 7 ? "The skull!" : ["A bone!","Found one!","Look!"][motor.found % 3])
        case .flying, .placed: return "You found it!"
        case .awake, .complete: return "ROAR!"
        }
    }
}

struct NativeDinoCollectionRow: View {
    let catalog: NativeDinoCatalog
    let collection: NativeDinoCollection
    var body: some View {
        HStack(spacing: 5) {
            ForEach(catalog.dinos) { dino in
                NativeDinoPicture(dino: dino, found: collection.got.contains(dino.id))
                    .accessibilityLabel("\(dino.name), \(collection.got.contains(dino.id) ? "found" : "still to find")")
            }
        }.accessibilityElement(children: .contain).accessibilityIdentifier("dino-collection")
    }
}
struct NativeDinoPicture: View {
    let dino: NativeDinoDefinition
    let found: Bool
    var body: some View {
        Canvas { context, size in
            let k = min((size.width - 8) / dino.box.w, (size.height - 8) / dino.box.h)
            NativeDinoDrawing.look(dino, found: found, context: context, scale: k,
                origin: .init(x: size.width / 2 - dino.box.x * k, y: size.height / 2 - dino.box.y * k))
        }
    }
}

private enum NativeDinoDrawing {
    private static let images = NSCache<NSString, UIImage>()
    static func image(_ name: String) -> UIImage? {
        if let cached = images.object(forKey: name as NSString) { return cached }
        let file = name + ".webp"
        guard let url = Bundle.main.url(forResource: file, withExtension: nil, subdirectory: "ArcadeDino") ?? Bundle.main.url(forResource: name, withExtension: "webp") else { return nil }
        guard let image = UIImage(contentsOfFile: url.path) else { return nil }
        images.setObject(image, forKey: name as NSString); return image
    }
    static func color(_ hex: String) -> Color {
        let n = UInt32(hex.dropFirst(), radix: 16) ?? 0
        return Color(red: Double((n >> 16) & 255) / 255, green: Double((n >> 8) & 255) / 255, blue: Double(n & 255) / 255)
    }
    static func outline(_ pts: [[Double]]) -> Path {
        guard let a = pts.last, let b = pts.first else { return Path() }
        func p(_ v: [Double]) -> CGPoint { .init(x: v[0], y: v[1]) }
        func sharp(_ v: [Double]) -> Bool { v.count > 2 && v[2] != 0 }
        var path = Path()
        if sharp(a) { path.move(to: p(a)) } else if sharp(b) { path.move(to: p(b)) }
        else { path.move(to: .init(x: (a[0]+b[0])/2, y: (a[1]+b[1])/2)) }
        for i in pts.indices {
            let v = pts[i], next = pts[(i+1) % pts.count]
            if sharp(v) { path.addLine(to: p(v)) }
            else if sharp(next) { path.addQuadCurve(to: p(next), control: p(v)) }
            else { path.addQuadCurve(to: .init(x: (v[0]+next[0])/2, y: (v[1]+next[1])/2), control: p(v)) }
        }
        path.closeSubpath(); return path
    }
    static func part(_ part: NativeDinoPart) -> Path {
        switch part.geometry {
        case .outline(let pts): return outline(pts)
        case .ellipse(let n):
            guard n.count >= 4 else { return Path() }
            let transform = CGAffineTransform(translationX: n[0], y: n[1]).rotated(by: n.count > 4 ? n[4] : 0)
            return Path(ellipseIn: .init(x: -n[2], y: -n[3], width: n[2]*2, height: n[3]*2)).applying(transform)
        case .curve(let pts):
            var path = Path(); if pts.count == 3 { path.move(to: .init(x: pts[0][0], y: pts[0][1])); path.addQuadCurve(to: .init(x: pts[2][0], y: pts[2][1]), control: .init(x: pts[1][0], y: pts[1][1])) }; return path
        }
    }
    static func bone(_ bone: NativeDinoDefinition.Bone, context: GraphicsContext, origin: CGPoint, scale: Double, ghost: Bool, rotation: Double = 0) {
        let t = CGAffineTransform(translationX: origin.x, y: origin.y).rotated(by: rotation).scaledBy(x: scale, y: scale)
        var path = Path(); bone.parts.forEach { path.addPath(part($0)) }; path = path.applying(t)
        if ghost { context.stroke(path, with: .color(Color.brown.opacity(0.5)), style: StrokeStyle(lineWidth: 2, dash: [4,5])) }
        else {
            context.fill(path, with: .color(color("#FFF8EC")))
            context.stroke(path, with: .color(color("#B9A27E")), style: StrokeStyle(lineWidth: max(1.5,2.2*scale),lineJoin: .round))
            for mark in bone.marks ?? [] {
                let path = part(mark).applying(t)
                switch mark.geometry { case .curve: context.stroke(path, with: .color(color("#8A6F4E")), lineWidth: max(1.2,1.8*scale)); default: context.fill(path, with: .color(color("#6E5434"))) }
            }
        }
    }
    static func look(_ dino: NativeDinoDefinition, found: Bool, context: GraphicsContext, scale: Double, origin: CGPoint) {
        if found, let image = image("dino-" + dino.id) {
            let k = min(dino.box.w / image.size.width, dino.box.h / image.size.height) * scale
            let w = image.size.width*k, h = image.size.height*k
            context.draw(Image(uiImage: image), in: .init(x: origin.x+dino.box.x*scale-w/2, y: origin.y+(dino.box.y+dino.box.h/2)*scale-h, width: w, height: h)); return
        }
        let t = CGAffineTransform(translationX: origin.x, y: origin.y).scaledBy(x: scale, y: scale)
        for layer in dino.look where found || (layer.hush != 1 && layer.as != "white" && layer.as != "light") {
            let path = outline(layer.pts).applying(t)
            let fill: String
            switch layer.as { case "white": fill = "#FFFFFF"; case "bone": fill = "#F6E7CB"; case "accent": fill = dino.accent ?? dino.fill; case "light": fill = dino.light ?? dino.fill; case "far": fill = dino.far; default: fill = dino.fill }
            context.fill(path, with: .color(found ? color(fill) : color("#FFF4DF")))
            context.stroke(path, with: .color(found ? color(dino.edge) : color("#A07C58")), style: StrokeStyle(lineWidth: max(1.5,scale*3),lineJoin: .round,dash: found ? [] : [6,4]))
        }
        if found {
            let eye = CGRect(x: origin.x+(dino.eye[0]-3.6)*scale,y:origin.y+(dino.eye[1]-3.6)*scale,width:7.2*scale,height:7.2*scale)
            context.fill(Path(ellipseIn: eye),with:.color(color("#2D3642")))
        }
    }
    static func scene(_ m: NativeDinoDig, context: GraphicsContext, size: CGSize, reduceMotion: Bool) {
        if let site = image("dino-site") {
            let k = max(size.width/site.size.width,size.height/site.size.height)
            context.draw(Image(uiImage: site),in:.init(x:(size.width-site.size.width*k)/2,y:0,width:site.size.width*k,height:site.size.height*k))
        } else { context.fill(Path(CGRect(origin:.zero,size:size)),with:.color(color("#FFE2B8"))) }
        let awake = m.phase == .awake || m.phase == .complete
        if awake { var body=context; body.opacity = m.phase == .complete ? 1 : min(1,m.phaseProgress*1.35/0.8); look(m.dino,found:true,context:body,scale:m.boardScale,origin:m.boardOrigin) }
        for i in m.dino.bones.indices where !(m.phase == .flying && i == m.found) {
            let b=m.dino.bones[i]; var c=context
            if awake { c.opacity = m.phase == .complete ? 0 : 1 - min(1,m.phaseProgress*1.35/0.8) }
            bone(b,context:c,origin:.init(x:m.boardOrigin.x+b.at[0]*m.boardScale,y:m.boardOrigin.y+b.at[1]*m.boardScale),scale:m.boardScale*(b.size ?? 1),ghost:i>=m.found,rotation:b.rot ?? 0)
        }
        let pit=m.pit; var dig=context; dig.clip(to:Path(roundedRect:pit,cornerRadius:22))
        dig.fill(Path(pit),with:.color(color("#B97A45")))
        if let soil=image("dino-soil") { dig.draw(Image(uiImage:soil),in:pit) }
        if let b=m.currentBone, m.phase == .ready || m.phase == .found { bone(b,context:dig,origin:m.boneOrigin,scale:m.boneScale,ghost:false) }
        if m.phase == .ready || m.phase == .found {
            for row in 0..<NativeDinoDig.rows { for col in 0..<NativeDinoDig.columns where !m.cleared.contains(row*NativeDinoDig.columns+col) {
                let r=CGRect(x:pit.minX+Double(col)/28*pit.width,y:pit.minY+Double(row)/14*pit.height,width:pit.width/28+1,height:pit.height/14+1)
                dig.fill(Path(r),with:.color(color((row+col)%3==0 ? "#F6DCA8":"#EBC48A")))
            } }
        } else if m.phase == .idle {
            if let sand=image("dino-sand") { dig.draw(Image(uiImage:sand),in:pit) } else { dig.fill(Path(pit),with:.color(color("#EBC48A"))) }
        }
        context.stroke(Path(roundedRect:pit,cornerRadius:22),with:.color(color("#A8693A")),lineWidth:4)
        if m.glow { context.stroke(Path(ellipseIn:m.digRect.insetBy(dx:-6,dy:-8)),with:.color(.yellow),lineWidth:4) }
        if m.phase == .flying, let b=m.currentBone {
            let k=m.phaseProgress,e=reduceMotion ? 1:1-pow(1-k,3),target=CGPoint(x:m.boardOrigin.x+b.at[0]*m.boardScale,y:m.boardOrigin.y+b.at[1]*m.boardScale)
            let point=CGPoint(x:m.boneOrigin.x+(target.x-m.boneOrigin.x)*e,y:m.boneOrigin.y+(target.y-m.boneOrigin.y)*e-(reduceMotion ? 0:sin(k*Double.pi)*size.height*0.12))
            bone(b,context:context,origin:point,scale:m.boneScale+(m.boardScale*(b.size ?? 1)-m.boneScale)*e,ghost:false,rotation:(b.rot ?? 0)*e)
        }
    }
}

private final class NativeDinoEffects {
    private var player: AVAudioPlayer?
    func play(_ name: String, volume: Float?) {
        guard let volume, volume.isFinite, volume > 0,
              let url=Bundle.main.url(forResource:"dino-"+name,withExtension:"wav",subdirectory:"ArcadeDino") ?? Bundle.main.url(forResource:"dino-"+name,withExtension:"wav") else { return }
        stop()
        do { try AVAudioSession.sharedInstance().setCategory(.soloAmbient); let sound=try AVAudioPlayer(contentsOf:url); sound.volume=min(1,volume); sound.play(); player=sound } catch {}
    }
    func stop() { player?.stop(); player=nil }
}
