import SwiftUI
import SpriteKit
import UIKit

enum FlyingGame {
    case glide
    case rise

    var title: String { self == .glide ? "Flappy Glide" : "Rise Up" }
    var instruction: String {
        self == .glide ? "Tap to float through the gaps." : "Drag the shield to push blocks away."
    }
    var goal: Int { self == .glide ? 6 : 8 }
    var balloonAsset: String { self == .glide ? "flying-glide-balloon" : "flying-rise-balloon" }
}

struct FlyingGamesView: View {
    let game: FlyingGame
    let onRoundFinished: () -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var round: FlyingRound

    init(game: FlyingGame, onRoundFinished: @escaping () -> Void = {}) {
        self.game = game
        self.onRoundFinished = onRoundFinished
        _round = StateObject(wrappedValue: FlyingRound(game: game))
    }

    var body: some View {
        ZStack {
            SpriteView(scene: round.scene)
                .ignoresSafeArea()
                .accessibilityLabel(game.title + ". " + game.instruction)
                .accessibilityIdentifier(game == .glide ? "nativeGlideBoard" : "nativeRiseBoard")

            VStack {
                HStack(alignment: .top) {
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark")
                            .font(.system(size: 20, weight: .bold))
                            .frame(width: 48, height: 48)
                            .background(.white, in: Circle())
                    }
                    .accessibilityLabel("Back home")
                    .accessibilityIdentifier("nativeFlyingClose")
                    Spacer()
                    VStack(alignment: .leading, spacing: 7) {
                        Text(game == .glide ? "\(round.progress) gaps crossed" : "\(round.progress) blocks moved")
                            .font(.system(size: 17, weight: .bold, design: .rounded))
                            .accessibilityIdentifier("nativeFlyingCount")
                        HStack(spacing: 6) {
                            ForEach(0..<3, id: \.self) { heart in
                                Image(systemName: heart < round.hearts ? "heart.fill" : "heart")
                                    .foregroundStyle(heart < round.hearts ? Color(red: 0.85, green: 0.29, blue: 0.30) : .gray)
                            }
                        }
                        .font(.system(size: 15))
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(round.hearts) hearts")
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 11)
                    .background(.white, in: RoundedRectangle(cornerRadius: 18))
                }
                .shadow(color: .black.opacity(0.10), radius: 8, y: 3)
                Spacer()
                if round.phase == .playing {
                    Text(game.instruction)
                        .font(.system(size: 16, weight: .semibold, design: .rounded))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 10)
                        .background(.white.opacity(0.95), in: Capsule())
                        .allowsHitTesting(false)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 20)
            .foregroundStyle(Color(red: 0.20, green: 0.17, blue: 0.15))

            if round.phase != .playing {
                Color.black.opacity(0.15).ignoresSafeArea()
                VStack(spacing: 17) {
                    Image(round.phase == .finished ? "flying-star" : game.balloonAsset)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 105, height: 124)
                        .accessibilityHidden(true)
                    Text(panelTitle)
                        .font(.system(size: 30, weight: .heavy, design: .rounded))
                        .multilineTextAlignment(.center)
                        .accessibilityIdentifier("nativeFlyingTitle")
                    Text(panelMessage)
                        .font(.system(size: 18, weight: .medium, design: .rounded))
                        .multilineTextAlignment(.center)
                    Button(round.phase == .ready ? "Let's play" : "Play again") { round.start() }
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 58)
                        .background(Color(red: 0.04, green: 0.48, blue: 0.51), in: RoundedRectangle(cornerRadius: 18))
                        .accessibilityIdentifier("nativeFlyingPlay")
                    Button("Back home") { dismiss() }
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .frame(minHeight: 44)
                        .accessibilityIdentifier("nativeFlyingHome")
                }
                .foregroundStyle(Color(red: 0.20, green: 0.17, blue: 0.15))
                .padding(26)
                .frame(maxWidth: 340)
                .background(Color(red: 1, green: 0.97, blue: 0.92), in: RoundedRectangle(cornerRadius: 28))
                .shadow(color: .black.opacity(0.16), radius: 20, y: 8)
                .padding(24)
                .transition(.opacity)
            }
        }
        .onAppear {
            round.scene.reduceMotion = reduceMotion
            round.scene.resetClock()
            round.scene.isPaused = false
        }
        .onDisappear { round.scene.isPaused = true }
        .onChange(of: scenePhase) { phase in
            round.scene.isPaused = phase != .active
            round.scene.resetClock()
        }
        .onChange(of: reduceMotion) { round.scene.reduceMotion = $0 }
        .onChange(of: round.phase) { phase in
            if phase == .finished { onRoundFinished() }
        }
    }

    private var panelTitle: String {
        switch round.phase {
        case .ready: return game.title
        case .retry: return "Let's try another flight"
        case .finished: return game == .glide ? "Through every gap!" : "You cleared the sky!"
        case .playing: return ""
        }
    }

    private var panelMessage: String {
        if round.phase == .finished {
            return game == .glide ? "You crossed all \(game.goal) gaps." : "You moved \(game.goal) blocks out of the way."
        }
        return game.instruction
    }
}

private enum FlyingPhase {
    case ready, playing, retry, finished
}

private final class FlyingRound: ObservableObject {
    @Published var phase: FlyingPhase = .ready
    @Published var progress = 0
    @Published var hearts = 3
    let scene: FlyingScene
    private let haptic = UIImpactFeedbackGenerator(style: .light)

    init(game: FlyingGame) {
        scene = FlyingScene(game: game)
        scene.onProgress = { [weak self] count in
            DispatchQueue.main.async {
                self?.progress = count
                self?.haptic.impactOccurred(intensity: 0.65)
            }
        }
        scene.onHearts = { [weak self] count in
            DispatchQueue.main.async { self?.hearts = count }
        }
        scene.onStop = { [weak self] finished in
            DispatchQueue.main.async { self?.phase = finished ? .finished : .retry }
        }
    }

    func start() {
        phase = .playing
        progress = 0
        hearts = 3
        haptic.prepare()
        scene.start()
    }
}

private final class FlyingScene: SKScene {
    private struct Gate {
        let node: SKNode
        let lower: CGRect
        let upper: CGRect
        let middle: CGFloat
        var crossed = false
    }

    private struct Block {
        let node: SKSpriteNode
        let radius: CGFloat
        var velocity: CGVector
        var pushed = false
    }

    var onProgress: ((Int) -> Void)?
    var onHearts: ((Int) -> Void)?
    var onStop: ((Bool) -> Void)?
    var reduceMotion = false
    private let game: FlyingGame
    private let world = SKNode()
    private let background: SKSpriteNode
    private let balloon: SKSpriteNode
    private let shield = SKSpriteNode(imageNamed: "flying-shield")
    private var gates: [Gate] = []
    private var blocks: [Block] = []
    private var playing = false
    private var progress = 0
    private var hearts = 3
    private var previousTime: TimeInterval?
    private var elapsed: TimeInterval = 0
    private var nextSpawn: TimeInterval = 0
    private var invulnerableUntil: TimeInterval = 0
    private var verticalSpeed: CGFloat = 0
    private var lastTouch: CGPoint?
    private var activeTouch: UITouch?
    private var spawned = 0

    init(game: FlyingGame) {
        self.game = game
        background = SKSpriteNode(imageNamed: game == .glide ? "flying-glide-bg" : "flying-rise-bg")
        balloon = SKSpriteNode(imageNamed: game.balloonAsset)
        super.init(size: CGSize(width: 390, height: 844))
        scaleMode = .resizeFill
        backgroundColor = .init(red: 0.78, green: 0.91, blue: 0.96, alpha: 1)
    }

    required init?(coder: NSCoder) { fatalError("FlyingScene is created in code.") }

    override func didMove(to view: SKView) {
        guard background.parent == nil else { return }
        background.zPosition = -20
        balloon.zPosition = 8
        shield.zPosition = 12
        addChild(background)
        addChild(world)
        addChild(balloon)
        if game == .rise { addChild(shield) }
        layoutBoard()
    }

    override func didChangeSize(_ oldSize: CGSize) { layoutBoard() }

    private func layoutBoard() {
        if let texture = background.texture {
            let original = texture.size()
            let scale = max(size.width / max(1, original.width), size.height / max(1, original.height))
            background.size = CGSize(width: original.width * scale, height: original.height * scale)
        }
        background.position = CGPoint(x: size.width / 2, y: size.height / 2)
        if game == .glide {
            balloon.size = CGSize(width: 104, height: 104)
            balloon.anchorPoint = CGPoint(x: 0.5, y: 0.5)
            balloon.position = CGPoint(x: size.width * 0.27, y: size.height * 0.47)
        } else {
            balloon.size = CGSize(width: 66, height: 66 * 918 / 320)
            balloon.anchorPoint = CGPoint(x: 0.5, y: 0.81)
            balloon.position = CGPoint(x: size.width / 2, y: size.height * 0.30)
        }
        shield.size = CGSize(width: 72, height: 70)
        shield.position = CGPoint(x: size.width * 0.20, y: balloon.position.y + 135)
    }

    func resetClock() {
        previousTime = nil
        activeTouch = nil
        lastTouch = nil
    }

    func start() {
        world.removeAllChildren()
        balloon.removeAllActions()
        balloon.alpha = 1
        balloon.zRotation = 0
        gates.removeAll()
        blocks.removeAll()
        playing = true
        progress = 0
        hearts = 3
        spawned = 0
        elapsed = 0
        nextSpawn = game == .glide ? 0.3 : 0.8
        invulnerableUntil = 0
        verticalSpeed = game == .glide ? 110 : 0
        resetClock()
        layoutBoard()
    }

    override func update(_ currentTime: TimeInterval) {
        guard playing else { return }
        let seconds = CGFloat(max(0, min(0.04, currentTime - (previousTime ?? currentTime))))
        previousTime = currentTime
        elapsed += Double(seconds)
        if game == .glide { updateGlide(seconds) }
        else { updateRise(seconds) }
    }

    private func updateGlide(_ seconds: CGFloat) {
        verticalSpeed = max(-230, verticalSpeed - 220 * seconds)
        balloon.position.y += verticalSpeed * seconds
        if !reduceMotion { balloon.zRotation = max(-0.18, min(0.16, verticalSpeed / 1200)) }
        let bottom: CGFloat = 95
        let top = size.height - 155
        if balloon.position.y < bottom || balloon.position.y > top {
            balloon.position.y = min(top, max(bottom, balloon.position.y))
            verticalSpeed = balloon.position.y == bottom ? 135 : -65
            bump()
        }
        if elapsed >= nextSpawn && spawned < game.goal {
            addGate()
            nextSpawn = elapsed + 2.5
        }
        let speed: CGFloat = hearts == 3 ? 86 : 74
        let body = CGRect(x: balloon.position.x - 25, y: balloon.position.y - 43, width: 50, height: 86)
        for index in gates.indices {
            gates[index].node.position.x -= speed * seconds
            let origin = gates[index].node.position.x
            if body.intersects(gates[index].lower.offsetBy(dx: origin, dy: 0)) ||
                body.intersects(gates[index].upper.offsetBy(dx: origin, dy: 0)) {
                if elapsed >= invulnerableUntil {
                    balloon.position.y = gates[index].middle
                    verticalSpeed = 95
                    bump()
                }
            }
            if !gates[index].crossed && origin + 26 < balloon.position.x - 25 {
                gates[index].crossed = true
                advance()
            }
        }
        gates.removeAll { gate in
            if gate.node.position.x < -70 { gate.node.removeFromParent(); return true }
            return false
        }
    }

    private func addGate() {
        let node = SKNode()
        let bottom: CGFloat = 60
        let top = max(bottom + 260, size.height - 130)
        let gap = min(265, (top - bottom) * 0.55)
        let center = (bottom + top) / 2 + sin(CGFloat(spawned) * 1.3) * min(75, size.height * 0.08)
        let lower = CGRect(x: -25, y: 0, width: 50, height: center - gap / 2)
        let upper = CGRect(x: -25, y: center + gap / 2, width: 50, height: size.height - center - gap / 2)
        for rect in [lower, upper] {
            let beam = SKSpriteNode(imageNamed: "flying-beam")
            beam.size = rect.size
            beam.position = CGPoint(x: 0, y: rect.midY)
            node.addChild(beam)
        }
        let star = SKSpriteNode(imageNamed: "flying-star")
        star.size = CGSize(width: 30, height: 34)
        star.position = CGPoint(x: 0, y: center)
        node.addChild(star)
        node.position.x = size.width + 65
        world.addChild(node)
        gates.append(Gate(node: node, lower: lower, upper: upper, middle: center))
        spawned += 1
    }

    private func updateRise(_ seconds: CGFloat) {
        if !reduceMotion {
            background.position.y = size.height / 2 - CGFloat(elapsed.truncatingRemainder(dividingBy: 5)) * 2
        }
        if elapsed >= nextSpawn {
            addBlock()
            nextSpawn = elapsed + 1.0
        }
        for index in blocks.indices {
            blocks[index].velocity.dy -= 65 * seconds
            blocks[index].node.position.x += blocks[index].velocity.dx * seconds
            blocks[index].node.position.y += blocks[index].velocity.dy * seconds
            if !reduceMotion { blocks[index].node.zRotation += seconds * 0.35 }
            let point = blocks[index].node.position
            if !blocks[index].pushed && distance(point, shield.position) < blocks[index].radius + 32 {
                // A still shield lets a block slide past without counting it.
                let side: CGFloat = point.x < shield.position.x ? -1 : 1
                blocks[index].velocity.dx = side * 95
            }
            if !blocks[index].pushed && distance(point, balloon.position) < blocks[index].radius + 30 {
                blocks[index].node.removeFromParent()
                bump()
            }
        }
        blocks.removeAll { block in
            let outside = block.node.position.y < -80 || block.node.position.x < -80 || block.node.position.x > size.width + 80
            if outside { block.node.removeFromParent() }
            return outside || block.node.parent == nil
        }
    }

    private func addBlock() {
        let names = ["flying-block-yellow", "flying-block-purple", "flying-block-bumpy"]
        let node = SKSpriteNode(imageNamed: names[spawned % names.count])
        let radius: CGFloat = 22
        node.size = CGSize(width: radius * 2, height: radius * 2)
        let offset = sin(CGFloat(spawned) * 1.7) * min(75, size.width * 0.20)
        node.position = CGPoint(x: size.width / 2 + offset, y: size.height - 100)
        node.zPosition = 6
        world.addChild(node)
        blocks.append(Block(node: node, radius: radius, velocity: CGVector(dx: -offset * 0.10, dy: -110)))
        spawned += 1
    }

    private func bump() {
        guard playing && elapsed >= invulnerableUntil else { return }
        invulnerableUntil = elapsed + 1.5
        hearts -= 1
        onHearts?(hearts)
        balloon.run(.sequence([.fadeAlpha(to: 0.35, duration: 0.1), .fadeAlpha(to: 1, duration: 0.3)]))
        if hearts == 0 { stop(finished: false) }
    }

    private func advance() {
        guard playing else { return }
        progress += 1
        onProgress?(progress)
        if progress == game.goal { stop(finished: true) }
    }

    private func stop(finished: Bool) {
        guard playing else { return }
        playing = false
        activeTouch = nil
        lastTouch = nil
        onStop?(finished)
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard playing, let touch = touches.first else { return }
        activeTouch = touch
        lastTouch = touch.location(in: self)
        if game == .glide { verticalSpeed = 165 }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard playing, game == .rise, let touch = activeTouch, touches.contains(touch), let previous = lastTouch else { return }
        let point = touch.location(in: self)
        let start = shield.position
        let dx = point.x - previous.x
        let dy = point.y - previous.y
        shield.position = CGPoint(
            x: min(size.width - 36, max(36, start.x + dx)),
            y: min(size.height - 140, max(balloon.position.y + 72, start.y + dy))
        )
        lastTouch = point
        guard abs(dx) + abs(dy) > 1 else { return }
        for index in blocks.indices {
            if !blocks[index].pushed && segmentDistance(blocks[index].node.position, start, shield.position) <= blocks[index].radius + 32 {
                blocks[index].pushed = true
                let side: CGFloat = blocks[index].node.position.x < shield.position.x ? -1 : 1
                blocks[index].velocity = CGVector(dx: side * 180, dy: 110)
                blocks[index].node.run(.sequence([.wait(forDuration: 0.9), .fadeOut(withDuration: 0.2), .removeFromParent()]))
                advance()
            }
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        if let touch = activeTouch, touches.contains(touch) { resetTouch() }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) { resetTouch() }

    private func resetTouch() { activeTouch = nil; lastTouch = nil }

    private func distance(_ a: CGPoint, _ b: CGPoint) -> CGFloat {
        hypot(a.x - b.x, a.y - b.y)
    }

    private func segmentDistance(_ point: CGPoint, _ start: CGPoint, _ end: CGPoint) -> CGFloat {
        let dx = end.x - start.x
        let dy = end.y - start.y
        let length = dx * dx + dy * dy
        let fraction = length > 0 ? min(1, max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length)) : 0
        return hypot(point.x - start.x - fraction * dx, point.y - start.y - fraction * dy)
    }
}
