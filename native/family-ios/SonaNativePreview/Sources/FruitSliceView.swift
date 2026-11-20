import SwiftUI
import SpriteKit
import UIKit

struct FruitSliceView: View {
    let onRoundFinished: () -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var game = FruitSliceGame()

    init(onRoundFinished: @escaping () -> Void = {}) {
        self.onRoundFinished = onRoundFinished
    }

    var body: some View {
        ZStack {
            SpriteView(scene: game.scene)
                .ignoresSafeArea()
                .accessibilityLabel("Fruit Slice. Swipe across the fruit to slice it.")
                .accessibilityIdentifier("nativeFruitSliceBoard")

            VStack(spacing: 16) {
                HStack {
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark")
                            .font(.system(size: 20, weight: .bold))
                            .frame(width: 48, height: 48)
                            .background(.white, in: Circle())
                            .shadow(color: .black.opacity(0.10), radius: 8, y: 3)
                    }
                    .accessibilityLabel("Back home")
                    .accessibilityIdentifier("nativeFruitSliceClose")

                    Spacer()

                    VStack(alignment: .leading, spacing: 6) {
                        Text("\(game.sliced) fruit sliced")
                            .font(.system(size: 18, weight: .bold, design: .rounded))
                            .accessibilityIdentifier("nativeFruitSliceCount")
                        ProgressView(value: Double(game.sliced), total: Double(game.goal))
                            .tint(Color(red: 0.04, green: 0.48, blue: 0.51))
                            .frame(width: 126)
                            .accessibilityLabel("Round progress")
                            .accessibilityValue("\(game.sliced) of \(game.goal) fruit")
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                    .background(.white, in: RoundedRectangle(cornerRadius: 20))
                    .shadow(color: .black.opacity(0.10), radius: 8, y: 3)
                }

                VStack(spacing: 3) {
                    Text(game.sliced == game.goal - 1 ? "One big watermelon!" : "Fruit Slice")
                        .font(.system(size: 28, weight: .heavy, design: .rounded))
                    if game.sliced == 0 {
                        Text("Swipe across the apple")
                            .font(.system(size: 17, weight: .semibold, design: .rounded))
                    }
                }
                .padding(.horizontal, 22)
                .padding(.vertical, 12)
                .background(.white.opacity(0.95), in: RoundedRectangle(cornerRadius: 20))
                .shadow(color: .black.opacity(0.08), radius: 10, y: 4)
                .allowsHitTesting(false)
                Spacer()
            }
            .foregroundStyle(Color(red: 0.20, green: 0.15, blue: 0.13))
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .allowsHitTesting(!game.finished)

            if game.finished {
                Color.black.opacity(0.22).ignoresSafeArea()
                VStack(spacing: 16) {
                    Image("giant-watermelon")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 150, height: 136)
                        .accessibilityHidden(true)
                    Text("You sliced \(game.sliced) fruit!")
                        .font(.system(size: 30, weight: .heavy, design: .rounded))
                        .multilineTextAlignment(.center)
                        .accessibilityIdentifier("nativeFruitSliceFinish")
                    Button("Play again") { game.restart() }
                        .buttonStyle(FruitSliceButtonStyle(reduceMotion: reduceMotion))
                        .accessibilityIdentifier("nativeFruitSliceReplay")
                    Button("Back home") { dismiss() }
                        .font(.system(size: 21, weight: .bold, design: .rounded))
                        .frame(minHeight: 48)
                        .accessibilityIdentifier("nativeFruitSliceHome")
                }
                .foregroundStyle(Color(red: 0.20, green: 0.15, blue: 0.13))
                .padding(28)
                .frame(maxWidth: 340)
                .background(Color(red: 1, green: 0.97, blue: 0.91), in: RoundedRectangle(cornerRadius: 28))
                .shadow(color: .black.opacity(0.18), radius: 28, y: 12)
                .padding(24)
                .transition(reduceMotion ? .opacity : .scale(scale: 0.94).combined(with: .opacity))
            }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.22), value: game.finished)
        .onAppear {
            game.scene.setReduceMotion(reduceMotion)
            game.scene.resetClock()
            game.scene.isPaused = false
            game.prepareHaptics()
        }
        .onDisappear {
            game.scene.isPaused = true
            game.scene.resetClock()
        }
        .onChange(of: reduceMotion) { game.scene.setReduceMotion($0) }
        .onChange(of: game.finished) { finished in
            if finished { onRoundFinished() }
        }
        .onChange(of: scenePhase) { phase in
            game.scene.isPaused = phase != .active
            game.scene.resetClock()
        }
    }
}

private struct FruitSliceButtonStyle: ButtonStyle {
    let reduceMotion: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 23, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 58)
            .background(Color(red: 0.04, green: 0.48, blue: 0.51), in: RoundedRectangle(cornerRadius: 18))
            .shadow(color: Color.black.opacity(0.12), radius: 0, y: configuration.isPressed ? 1 : 4)
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.97 : 1)
    }
}

private final class FruitSliceGame: ObservableObject {
    let goal = FruitSliceScene.goal
    @Published var sliced = 0
    @Published var finished = false
    let scene = FruitSliceScene()
    private let sliceHaptic = UIImpactFeedbackGenerator(style: .light)
    private let finishHaptic = UINotificationFeedbackGenerator()
    private var lastHaptic: TimeInterval = 0

    init() {
        scene.onSlice = { [weak self] count in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.sliced = count
                let now = ProcessInfo.processInfo.systemUptime
                if count < self.goal && now - self.lastHaptic > 0.07 {
                    self.sliceHaptic.impactOccurred(intensity: 0.7)
                    self.sliceHaptic.prepare()
                    self.lastHaptic = now
                }
            }
        }
        scene.onFinish = { [weak self] in
            DispatchQueue.main.async {
                self?.finished = true
                self?.finishHaptic.notificationOccurred(.success)
            }
        }
    }

    func prepareHaptics() {
        sliceHaptic.prepare()
        finishHaptic.prepare()
    }

    func restart() {
        sliced = 0
        finished = false
        scene.restart()
        prepareHaptics()
    }
}

private final class FruitSliceScene: SKScene {
    static let goal = 12

    private struct Fruit {
        let node: SKSpriteNode
        let radius: CGFloat
        var velocity: CGVector
        let spin: CGFloat
        let held: Bool
    }

    var onSlice: ((Int) -> Void)?
    var onFinish: (() -> Void)?
    private let orchard = SKSpriteNode(imageNamed: "orchard")
    private let counter = SKSpriteNode(imageNamed: "fruit-stand")
    private let fruitNames = ["fruit-apple", "fruit-orange", "fruit-strawberry", "fruit-kiwi", "fruit-watermelon"]
    private var fruit: [Fruit] = []
    private var previousTime: TimeInterval?
    private var spawnTime: TimeInterval = 0.25
    private var sliced = 0
    private var thrown = 0
    private var completed = false
    private var reduceMotion = false
    private var activeTouch: UITouch?
    private var lastPoint: CGPoint?

    override init() {
        super.init(size: CGSize(width: 390, height: 844))
        scaleMode = .resizeFill
        backgroundColor = SKColor(red: 0.98, green: 0.93, blue: 0.82, alpha: 1)
    }

    required init?(coder: NSCoder) {
        fatalError("FruitSliceScene is created in code.")
    }

    override func didMove(to view: SKView) {
        guard orchard.parent == nil else { return }
        orchard.zPosition = -20
        counter.zPosition = -10
        addChild(orchard)
        addChild(counter)
        layoutArt()
        serveFruit(named: "fruit-apple", radiusScale: 1.15)
    }

    override func didChangeSize(_ oldSize: CGSize) {
        layoutArt()
    }

    private func layoutArt() {
        guard size.width > 0, size.height > 0 else { return }
        if let texture = orchard.texture {
            let original = texture.size()
            let scale = max(size.width / max(original.width, 1), size.height / max(original.height, 1))
            orchard.size = CGSize(width: original.width * scale, height: original.height * scale)
        }
        orchard.position = CGPoint(x: size.width / 2, y: size.height / 2)
        if let texture = counter.texture {
            let original = texture.size()
            let width = size.width * 1.08
            counter.size = CGSize(width: width, height: width * original.height / max(original.width, 1))
        }
        counter.anchorPoint = CGPoint(x: 0.5, y: 0)
        counter.position = CGPoint(x: size.width / 2, y: -size.height * 0.03)
    }

    func resetClock() {
        previousTime = nil
        activeTouch = nil
        lastPoint = nil
    }

    func setReduceMotion(_ enabled: Bool) {
        reduceMotion = enabled
        fruit.filter { $0.held }.forEach { $0.node.removeAction(forKey: "float") }
    }

    func restart() {
        children.filter { $0 !== orchard && $0 !== counter }.forEach { $0.removeFromParent() }
        fruit.removeAll()
        sliced = 0
        thrown = 0
        completed = false
        spawnTime = 0.25
        resetClock()
        serveFruit(named: "fruit-apple", radiusScale: 1.15)
    }

    override func update(_ currentTime: TimeInterval) {
        guard !completed else { return }
        let delta = min(currentTime - (previousTime ?? currentTime), 0.05)
        previousTime = currentTime
        let seconds = CGFloat(max(delta, 0))
        let gravity = max(620, size.height * 0.88)
        for index in fruit.indices {
            if fruit[index].held { continue }
            fruit[index].velocity.dy -= gravity * seconds
            fruit[index].node.position.x += fruit[index].velocity.dx * seconds
            fruit[index].node.position.y += fruit[index].velocity.dy * seconds
            fruit[index].node.zRotation += fruit[index].spin * seconds
        }
        fruit.removeAll { item in
            let gone = item.node.position.y < -item.radius * 3 && item.velocity.dy < 0
            if gone { item.node.removeFromParent() }
            return gone
        }
        guard sliced > 0 && sliced < Self.goal - 1 else { return }
        spawnTime -= delta
        if spawnTime <= 0 && fruit.count < 3 {
            throwFruit(gravity: gravity)
            spawnTime = 0.72
        }
    }

    private func throwFruit(gravity: CGFloat) {
        let name = fruitNames[thrown % fruitNames.count]
        thrown += 1
        let radius = min(max(size.width * 0.11, 30), 54)
        let node = SKSpriteNode(imageNamed: name)
        node.size = CGSize(width: radius * 2, height: radius * 2)
        let margin = radius + 12
        let left = min(margin, size.width / 2)
        let right = max(left, size.width - margin)
        node.position = CGPoint(x: CGFloat.random(in: left...right), y: -radius)
        node.zPosition = 5
        addChild(node)
        let rise = max(160, min(size.height * 0.67, size.height - 170))
        let velocity = CGVector(dx: (size.width / 2 - node.position.x) * 0.32, dy: sqrt(2 * gravity * rise))
        fruit.append(Fruit(node: node, radius: radius, velocity: velocity,
                           spin: reduceMotion ? 0 : CGFloat.random(in: -1.5...1.5), held: false))
    }

    private func serveFruit(named name: String, radiusScale: CGFloat) {
        let radius = min(max(size.width * 0.11, 30), 54) * radiusScale
        let node = SKSpriteNode(imageNamed: name)
        node.size = CGSize(width: radius * 2, height: radius * 2)
        node.position = CGPoint(x: size.width / 2, y: size.height * 0.47)
        node.zPosition = 5
        addChild(node)
        fruit.append(Fruit(node: node, radius: radius, velocity: .zero, spin: 0, held: true))
        if !reduceMotion {
            node.run(.repeatForever(.sequence([
                .moveBy(x: 0, y: 7, duration: 0.7),
                .moveBy(x: 0, y: -7, duration: 0.7)
            ])), withKey: "float")
        }
    }

    private func serveFinale() {
        fruit.forEach { $0.node.removeFromParent() }
        fruit.removeAll()
        serveFruit(named: "giant-watermelon", radiusScale: 1.85)
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first, !completed else { return }
        activeTouch = touch
        let point = touch.location(in: self)
        lastPoint = point
        slice(from: point, to: point)
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = activeTouch, touches.contains(touch), let start = lastPoint, !completed else { return }
        let end = touch.location(in: self)
        drawTrail(from: start, to: end)
        slice(from: start, to: end)
        lastPoint = end
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = activeTouch, touches.contains(touch) else { return }
        if let start = lastPoint, !completed {
            slice(from: start, to: touch.location(in: self))
        }
        activeTouch = nil
        lastPoint = nil
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        activeTouch = nil
        lastPoint = nil
    }

    private func slice(from start: CGPoint, to end: CGPoint) {
        let hits = fruit.filter { item in
            distanceSquared(from: item.node.position, to: start, end) <= item.radius * item.radius
        }
        for hit in hits {
            guard !completed else { break }
            fruit.removeAll { $0.node === hit.node }
            split(hit.node)
            splash(at: hit.node.position)
            hit.node.removeFromParent()
            sliced += 1
            onSlice?(sliced)
            if sliced == Self.goal - 1 {
                serveFinale()
                break
            }
            if sliced == Self.goal {
                completed = true
                activeTouch = nil
                lastPoint = nil
                onFinish?()
            }
        }
    }

    private func distanceSquared(from point: CGPoint, to start: CGPoint, _ end: CGPoint) -> CGFloat {
        let dx = end.x - start.x
        let dy = end.y - start.y
        let length = dx * dx + dy * dy
        let along = length > 0 ? min(1, max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length)) : 0
        let x = point.x - start.x - along * dx
        let y = point.y - start.y - along * dy
        return x * x + y * y
    }

    private func drawTrail(from start: CGPoint, to end: CGPoint) {
        let path = CGMutablePath()
        path.move(to: start)
        path.addLine(to: end)
        let trail = SKShapeNode(path: path)
        trail.strokeColor = .white
        trail.lineWidth = 7
        trail.lineCap = .round
        trail.zPosition = 20
        addChild(trail)
        trail.run(.sequence([.fadeOut(withDuration: 0.18), .removeFromParent()]))
    }

    private func split(_ original: SKSpriteNode) {
        guard let texture = original.texture else { return }
        if reduceMotion {
            let flash = SKSpriteNode(texture: texture)
            flash.size = original.size
            flash.position = original.position
            flash.zPosition = 8
            addChild(flash)
            flash.run(.sequence([.fadeOut(withDuration: 0.16), .removeFromParent()]))
            return
        }
        for side in 0..<2 {
            let direction: CGFloat = side == 0 ? -1 : 1
            let halfTexture = SKTexture(rect: CGRect(x: CGFloat(side) * 0.5, y: 0, width: 0.5, height: 1), in: texture)
            let half = SKSpriteNode(texture: halfTexture)
            half.size = CGSize(width: original.size.width / 2, height: original.size.height)
            half.position = CGPoint(x: original.position.x + direction * original.size.width / 4, y: original.position.y)
            half.zRotation = original.zRotation
            half.zPosition = 8
            addChild(half)
            half.run(.sequence([
                .group([
                    .moveBy(x: direction * 55, y: -100, duration: 0.48),
                    .rotate(byAngle: direction * 0.8, duration: 0.48),
                    .fadeOut(withDuration: 0.48)
                ]),
                .removeFromParent()
            ]))
        }
    }

    private func splash(at point: CGPoint) {
        let burst = SKShapeNode(circleOfRadius: 12)
        burst.position = point
        burst.fillColor = .white
        burst.strokeColor = .clear
        burst.alpha = 0.7
        burst.zPosition = 10
        addChild(burst)
        let actions: [SKAction] = reduceMotion
            ? [.fadeOut(withDuration: 0.12)]
            : [.scale(to: 3.5, duration: 0.20), .fadeOut(withDuration: 0.20)]
        burst.run(.sequence([.group(actions), .removeFromParent()]))
        guard !reduceMotion else { return }
        for index in 0..<6 {
            let angle = CGFloat(index) * .pi / 3
            let drop = SKShapeNode(circleOfRadius: 3.5)
            drop.position = point
            drop.fillColor = SKColor(red: 1, green: 0.9, blue: 0.57, alpha: 1)
            drop.strokeColor = .clear
            drop.zPosition = 9
            addChild(drop)
            drop.run(.sequence([.group([
                .moveBy(x: cos(angle) * 48, y: sin(angle) * 48 - 18, duration: 0.32),
                .fadeOut(withDuration: 0.32)
            ]), .removeFromParent()]))
        }
    }
}
