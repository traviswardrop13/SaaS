import SwiftUI
import SpriteKit
import UIKit

struct FruitSliceView: View {
    let stage: Int
    let onRoundFinished: () -> Void
    let onLifeLost: (() -> Void)?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.guidedReplay) private var guidedReplay
    @Environment(\.guidedArcadeExit) private var guidedArcadeExit
    @Environment(\.guidedArcadeRestoredLives) private var restoredLives
    @Environment(\.arcadePowerEffect) private var power
    @Environment(\.arcadeRoundContext) private var arcadeRound
    @Environment(\.arcadeStartingHearts) private var startingHearts
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var game: FruitSliceGame
    private let sand = Color(red: 1, green: 0.98, blue: 0.93)

    /// The host remounts this view for stages 0, 1 and 2, keeping the two
    /// between-wave speech checkpoints outside the gesture-only game scene.
    init(stage: Int = 0, onLifeLost: (() -> Void)? = nil, onRoundFinished: @escaping () -> Void = {}) {
        self.stage = min(2, max(0, stage))
        self.onRoundFinished = onRoundFinished
        self.onLifeLost = onLifeLost
        _game = StateObject(wrappedValue: FruitSliceGame(stage: min(2, max(0, stage))))
    }

    var body: some View {
        ZStack {
            SpriteView(scene: game.scene)
                .ignoresSafeArea()
                .accessibilityLabel("Fruit Slice. Swipe across the fruit to slice it.")
                .accessibilityIdentifier("nativeFruitSliceBoard")
                .accessibilityValue(game.finished ? "\(game.sliced) fruit sliced" : (game.isFinale ? "\(game.finaleCuts) of \(game.giantGoal) watermelon swipes" : "\(game.sliced) of \(game.normalGoal) fruit"))
                .allowsHitTesting(!game.finished)

            VStack(spacing: 16) {
                HStack {
                    Button(action: close) {
                        Image(systemName: "xmark")
                            .font(.system(size: 20, weight: .bold))
                            .frame(width: 48, height: 48)
                            .background(sand, in: Circle())
                            .shadow(color: .black.opacity(0.10), radius: 8, y: 3)
                    }
                    .accessibilityLabel("Back home")
                    .accessibilityIdentifier("nativeFruitSliceClose")

                    Spacer()

                    VStack(alignment: .leading, spacing: 6) {
                        Text(game.isFinale ? "Watermelon \(game.finaleCuts)/\(game.giantGoal)" : "\(game.sliced) fruit sliced")
                            .font(.system(size: 18, weight: .bold, design: .rounded))
                            .accessibilityIdentifier("nativeFruitSliceCount")
                        ProgressView(value: Double(game.isFinale ? game.finaleCuts : min(game.sliced, game.normalGoal)), total: Double(game.isFinale ? game.giantGoal : game.normalGoal))
                            .tint(SonaPalette.teal)
                            .frame(width: 126)
                            .accessibilityLabel(game.isFinale ? "Watermelon cuts" : "Round progress")
                            .accessibilityValue(game.finished ? "Complete" : (game.isFinale ? "\(game.finaleCuts) of \(game.giantGoal) swipes" : "\(game.sliced) of \(game.normalGoal) fruit"))
                        if onLifeLost != nil && !game.isFinale && !game.finished {
                            NativeArcadeHearts(count: game.hearts)
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                    .background(sand, in: RoundedRectangle(cornerRadius: 20))
                    .shadow(color: .black.opacity(0.10), radius: 8, y: 3)
                }

                if game.isFinale || game.sliced == 0 {
                    VStack(spacing: 3) {
                        Text(game.isFinale ? "One big watermelon!" : "Fruit Slice")
                            .font(.system(size: 28, weight: .heavy, design: .rounded))
                        if game.sliced == 0 {
                            Text("Swipe across the apple")
                                .font(.system(size: 17, weight: .semibold, design: .rounded))
                        }
                    }
                    .padding(.horizontal, 22)
                    .padding(.vertical, 12)
                    .background(sand, in: RoundedRectangle(cornerRadius: 20))
                    .shadow(color: .black.opacity(0.08), radius: 10, y: 4)
                    .allowsHitTesting(false)
                }
                Spacer()
            }
            .foregroundStyle(SonaPalette.ink)
            .padding(.horizontal, 20)
            .padding(.top, 8)

            if game.finished && game.isFinalStage {
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
                    Button("Play again") {
                        if let guidedReplay { guidedReplay() }
                        else { game.restart() }
                    }
                        .buttonStyle(FruitSliceButtonStyle(reduceMotion: reduceMotion))
                        .accessibilityIdentifier("nativeFruitSliceReplay")
                    Button("Back home", action: close)
                        .font(.system(size: 21, weight: .bold, design: .rounded))
                        .frame(minHeight: 48)
                        .accessibilityIdentifier("nativeFruitSliceHome")
                }
                .foregroundStyle(SonaPalette.ink)
                .padding(28)
                .frame(maxWidth: 340)
                .background(sand, in: RoundedRectangle(cornerRadius: 28))
                .shadow(color: .black.opacity(0.18), radius: 28, y: 12)
                .padding(24)
                .transition(reduceMotion ? .opacity : .scale(scale: 0.94).combined(with: .opacity))
            }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.22), value: game.finished)
        .onAppear {
            game.configure(level: arcadeRound?.level ?? 1, record: arcadeRound?.record)
            game.scene.setReduceMotion(reduceMotion)
            game.scene.resetClock()
            game.scene.isPaused = false
            game.scene.enablesLives = onLifeLost != nil
            game.scene.prepareHearts(startingHearts)
            game.scene.setPower(power, allowBurst: false)
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
        .onChange(of: power) { game.scene.setPower($0, allowBurst: true) }
        .onChange(of: restoredLives) { _ in game.scene.restoreLife() }
        .onChange(of: game.hearts) { if $0 == 0 { onLifeLost?() } }
        .preference(key: NativeArcadePowerBoardPreference.self, value: NativeArcadePowerBoard(
            playing: !game.isFinale && !game.finished && game.hearts > 0,
            fractionComplete: Double(game.sliced) / Double(game.normalGoal),
            clearsPower: game.isFinale, hearts: game.hearts))
    }

    private func close() { if let guidedArcadeExit { guidedArcadeExit() } else { dismiss() } }
}

private struct FruitSliceButtonStyle: ButtonStyle {
    let reduceMotion: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 23, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 58)
            .background(SonaPalette.teal, in: RoundedRectangle(cornerRadius: 18))
            .shadow(color: Color.black.opacity(0.12), radius: 0, y: configuration.isPressed ? 1 : 4)
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.97 : 1)
    }
}

// MARK: - Gesture-earned stage progress

/// Fruit and giant cuts require intersections. The original active-time
/// cap can end a normal wave without awarding a slice or a speech rep.
private struct FruitSliceStageProgress {
    let stage: Int
    let normalGoal: Int
    let giantGoal: Int
    private(set) var normalEnded = false
    private(set) var normalSliced = 0
    private(set) var giantCuts = 0
    private var giantEntryStroke = 0
    private var lastGiantStroke = 0

    init(stage: Int, level: Int = 1) {
        self.stage = min(2, max(0, stage))
        normalGoal = NativeArcadeDifficulty.sliceWave(level: level, stage: self.stage).goal
        giantGoal = self.stage == 2 ? NativeArcadeDifficulty.watermelonCuts(level: level) : 0
    }
    var isFinale: Bool { giantGoal > 0 && normalEnded && giantCuts < giantGoal }
    var isComplete: Bool { normalEnded && (giantGoal == 0 || giantCuts == giantGoal) }

    mutating func endNormal(at stroke: Int) {
        guard !normalEnded else { return }
        normalEnded = true
        giantEntryStroke = stroke
    }
    var slicedFruit: Int { normalSliced + (giantGoal > 0 && giantCuts == giantGoal ? 1 : 0) }

    mutating func sliceNormal(stroke: Int) -> Bool {
        guard stroke > 0, !normalEnded else { return false }
        normalSliced += 1
        if normalSliced == normalGoal { endNormal(at: stroke) }
        return true
    }
    mutating func cutGiant(stroke: Int) -> Bool {
        guard isFinale, stroke > giantEntryStroke, stroke > lastGiantStroke else { return false }
        lastGiantStroke = stroke
        giantCuts += 1
        return true
    }
}

private final class FruitSliceGame: ObservableObject {
    let stage: Int
    @Published private(set) var normalGoal: Int
    @Published private(set) var giantGoal = 5
    @Published var sliced = 0
    @Published var finaleCuts = 0
    @Published var finished = false
    @Published var hearts = 3
    let scene: FruitSliceScene
    var isFinalStage: Bool { stage == 2 }
    @Published private(set) var isFinale = false
    private let sliceHaptic = UIImpactFeedbackGenerator(style: .light)
    private let finishHaptic = UINotificationFeedbackGenerator()
    private var lastHaptic: TimeInterval = 0

    init(stage: Int) {
        let plan = FruitSliceStageProgress(stage: stage)
        self.stage = plan.stage
        normalGoal = plan.normalGoal
        scene = FruitSliceScene(stage: plan.stage)
        scene.onProgress = { [weak self] progress in
            DispatchQueue.main.async {
                guard let self else { return }
                self.sliced = progress.slicedFruit
                self.finaleCuts = progress.giantCuts
                self.isFinale = progress.isFinale
                let now = ProcessInfo.processInfo.systemUptime
                if !progress.isComplete && now - self.lastHaptic > 0.07 {
                    self.sliceHaptic.impactOccurred(intensity: 0.7)
                    self.sliceHaptic.prepare()
                    self.lastHaptic = now
                }
            }
        }
        scene.onFinish = { [weak self] in
            DispatchQueue.main.async {
                guard let self, !self.finished else { return }
                self.finished = true
                self.finishHaptic.notificationOccurred(.success)
            }
        }
        scene.onHearts = { [weak self] count in
            DispatchQueue.main.async { self?.hearts = count }
        }
    }

    func configure(level: Int, record: NativeArcadeRoundRecord?) {
        normalGoal = NativeArcadeDifficulty.sliceWave(level: level, stage: stage).goal
        giantGoal = NativeArcadeDifficulty.watermelonCuts(level: level)
        scene.configure(level: level, record: record)
    }

    func prepareHaptics() {
        sliceHaptic.prepare()
        finishHaptic.prepare()
    }

    func restart() {
        sliced = 0
        finaleCuts = 0
        isFinale = false
        finished = false
        hearts = 3
        lastHaptic = 0
        scene.restart()
        prepareHaptics()
    }
}

private final class FruitSliceScene: SKScene {

    private struct Fruit {
        let node: SKSpriteNode
        let radius: CGFloat
        var velocity: CGVector
        let spin: CGFloat
        let held: Bool
        let isFinale: Bool
        let isBonus: Bool
    }

    var onProgress: ((FruitSliceStageProgress) -> Void)?
    var onFinish: (() -> Void)?
    var onHearts: ((Int) -> Void)?
    var enablesLives = false
    private let coast = SKSpriteNode(imageNamed: "fruit-slice-coast")
    private let fruitNames = ["fruit-apple", "fruit-orange", "fruit-strawberry", "fruit-kiwi", "fruit-watermelon"]
    private var fruit: [Fruit] = []
    private var previousTime: TimeInterval?
    private var spawnTime: TimeInterval = 0.25
    private var progress: FruitSliceStageProgress
    private var thrown = 0
    private var level = 1
    private var wavePlay: TimeInterval = 0
    private var missRun = 0
    private var record: NativeArcadeRoundRecord?
    private var wave: NativeArcadeDifficulty.Wave { NativeArcadeDifficulty.sliceWave(level: level, stage: progress.stage) }
    private var sentFinish = false
    private var reduceMotion = false
    private var activeTouch: UITouch?
    private var lastPoint: CGPoint?
    private var stroke = 0
    private var strokeTravel: CGFloat = 0
    private var lives = NativeArcadeLives()
    private var preparedHearts = false
    private var power = NativeArcadePowerEffect()
    private var isSuperSlice: Bool { power.speed < 1 && !progress.isFinale }
    private var gravity: CGFloat { max(620, size.height * 0.88) }

    init(stage: Int) {
        progress = FruitSliceStageProgress(stage: stage)
        super.init(size: CGSize(width: 390, height: 844))
        scaleMode = .resizeFill
        backgroundColor = SKColor(red: 0.73, green: 0.90, blue: 0.91, alpha: 1)
    }

    required init?(coder: NSCoder) {
        fatalError("FruitSliceScene is created in code.")
    }

    override func didMove(to view: SKView) {
        guard coast.parent == nil else { return }
        coast.zPosition = -20
        addChild(coast)
        layoutArt()
        serveFruit(named: "fruit-apple", radiusScale: 1.15)
    }

    override func didChangeSize(_ oldSize: CGSize) {
        layoutArt()
    }

    private func layoutArt() {
        guard size.width > 0, size.height > 0, let texture = coast.texture else { return }
        let original = texture.size()
        let scale = max(size.width / max(original.width, 1), size.height / max(original.height, 1))
        coast.size = CGSize(width: original.width * scale, height: original.height * scale)
        // Keep the cottages in frame on a narrow phone and the surf on a wide tablet.
        coast.position = CGPoint(x: size.width / 2 - max(0, coast.size.width - size.width) * 0.32,
                                 y: size.height / 2 + max(0, coast.size.height - size.height) * 0.18)
    }

    func configure(level: Int, record: NativeArcadeRoundRecord?) {
        self.record = record
        guard self.level != level, !progress.normalEnded, progress.normalSliced == 0 else { return }
        self.level = level
        progress = FruitSliceStageProgress(stage: progress.stage, level: level)
    }

    func resetClock() {
        previousTime = nil
        activeTouch = nil
        lastPoint = nil
        strokeTravel = 0
    }

    func setReduceMotion(_ enabled: Bool) {
        reduceMotion = enabled
        fruit.filter { $0.held }.forEach { $0.node.removeAction(forKey: "float") }
    }

    func restart() {
        children.filter { $0 !== coast }.forEach { $0.removeFromParent() }
        fruit.removeAll()
        progress = FruitSliceStageProgress(stage: progress.stage, level: level)
        thrown = 0; missRun = 0; wavePlay = 0
        lives = NativeArcadeLives()
        sentFinish = false
        stroke = 0
        spawnTime = 0.25
        resetClock()
        serveFruit(named: "fruit-apple", radiusScale: 1.15)
    }

    func prepareHearts(_ count: Int) {
        guard !preparedHearts else { return }
        preparedHearts = true
        lives = NativeArcadeLives(startingHearts: count)
        onHearts?(lives.hearts)
    }

    override func update(_ currentTime: TimeInterval) {
        guard !progress.isComplete, lives.hearts > 0 else { return }
        let delta = min(currentTime - (previousTime ?? currentTime), 0.05)
        previousTime = currentTime
        if !progress.normalEnded {
            wavePlay += max(0, delta)
            if wavePlay >= 45 {
                progress.endNormal(at: stroke)
                if progress.isFinale { serveFinale() }
                reportProgress()
                return
            }
        }
        let seconds = CGFloat(max(delta, 0) * (isSuperSlice ? power.speed : 1))
        let fall = gravity
        for index in fruit.indices {
            if fruit[index].held { continue }
            fruit[index].velocity.dy -= fall * seconds
            fruit[index].node.position.x += fruit[index].velocity.dx * seconds
            fruit[index].node.position.y += fruit[index].velocity.dy * seconds
            fruit[index].node.zRotation += fruit[index].spin * seconds
        }
        var missedNormalFruit = false
        fruit.removeAll { item in
            let gone = item.node.position.y < -item.radius * 3 && item.velocity.dy < 0
            if gone {
                item.node.removeFromParent()
                if !item.isBonus { missedNormalFruit = true }
            }
            return gone
        }
        guard !progress.normalEnded else { return }
        if missedNormalFruit && !isSuperSlice {
            missRun += 1
            _ = record?.recordMove(qualifies: false)
        }
        if missedNormalFruit && progress.normalSliced > 0 && enablesLives && lives.miss(at: currentTime, protected: power.protectsHearts) {
            onHearts?(lives.hearts)
            if lives.hearts == 0 { resetClock(); return }
        }
        spawnTime -= Double(seconds)
        if spawnTime <= 0 {
            if isSuperSlice && fruit.count < 8 {
                let bonusCount = thrown.isMultiple(of: 2) ? 3 : 2
                for _ in 0..<bonusCount { throwFruit(bonus: true) }
                spawnTime = wave.tossInterval * 0.45
            } else if !isSuperSlice {
                let help = missRun >= 2
                let limit = help ? 1 : wave.maximumPerToss
                let normal = fruit.filter { !$0.isBonus && !$0.held }.count
                if normal < limit {
                    let requested = help ? 1 : 1 + (Bool.random() ? 1 : 0) + (Bool.random() ? 1 : 0)
                    for _ in 0..<min(limit - normal, requested) {
                        throwFruit(gold: !help && Double.random(in: 0..<1) < wave.goldChance, assisted: help)
                    }
                    spawnTime = help ? NativeArcadeDifficulty.sliceWave(level: 1, stage: progress.stage).tossInterval * 1.25 : wave.tossInterval
                }
            }
        }
    }

    func setPower(_ effect: NativeArcadePowerEffect, allowBurst: Bool) {
        let oldRevision = power.revision
        power = effect
        guard allowBurst, isSuperSlice, oldRevision != effect.revision, lives.hearts > 0, !progress.isComplete else { return }
        for index in 0..<5 { throwFruit(bonus: true, gold: index == 2) }
        spawnTime = wave.tossInterval * 0.45
    }

    func restoreLife() {
        guard lives.hearts == 0 else { return }
        lives.restore(at: ProcessInfo.processInfo.systemUptime)
        onHearts?(lives.hearts)
        resetClock()
    }

    private func throwFruit(bonus: Bool = false, gold: Bool = false, assisted: Bool = false) {
        let name = fruitNames[thrown % fruitNames.count]
        thrown += 1
        let sizeScale = assisted ? 1.3 : NativeArcadeDifficulty.fruitSize(level: level)
        let radius = min(max(size.width * 0.11, 30), 54) * sizeScale
        let node = SKSpriteNode(imageNamed: name)
        if gold { node.color = .yellow; node.colorBlendFactor = 0.55 }
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
                           spin: reduceMotion ? 0 : CGFloat.random(in: -1.5...1.5), held: false, isFinale: false, isBonus: bonus))
    }

    private func serveFruit(named name: String, radiusScale: CGFloat, isFinale: Bool = false) {
        let radius = min(max(size.width * 0.11, 30), 54) * radiusScale
        let node = SKSpriteNode(imageNamed: name)
        node.size = CGSize(width: radius * 2, height: radius * 2)
        node.position = CGPoint(x: size.width / 2, y: size.height * 0.47)
        node.zPosition = 5
        addChild(node)
        fruit.append(Fruit(node: node, radius: radius, velocity: .zero, spin: 0, held: true, isFinale: isFinale, isBonus: false))
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
        serveFruit(named: "giant-watermelon", radiusScale: 1.85, isFinale: true)
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        // A second finger cannot manufacture another distinct slash.
        guard activeTouch == nil, let touch = touches.first, !progress.isComplete, lives.hearts > 0 else { return }
        activeTouch = touch
        stroke += 1
        strokeTravel = 0
        lastPoint = touch.location(in: self)
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = activeTouch, touches.contains(touch), !progress.isComplete else { return }
        moveTouch(to: touch.location(in: self))
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = activeTouch, touches.contains(touch) else { return }
        if !progress.isComplete { moveTouch(to: touch.location(in: self)) }
        activeTouch = nil
        lastPoint = nil
        strokeTravel = 0
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = activeTouch, touches.contains(touch) else { return }
        activeTouch = nil
        lastPoint = nil
        strokeTravel = 0
    }

    private func moveTouch(to end: CGPoint) {
        guard let start = lastPoint else { return }
        let dx = end.x - start.x, dy = end.y - start.y
        strokeTravel += sqrt(dx * dx + dy * dy)
        drawTrail(from: start, to: end)
        // Touch-down, a tap, or a stationary held finger never slices anything.
        if strokeTravel >= 18 { slice(from: start, to: end) }
        lastPoint = progress.isComplete ? nil : end
    }

    private func slice(from start: CGPoint, to end: CGPoint) {
        let hits = fruit.filter { item in
            let radius = item.radius + (isSuperSlice ? 16 : 0)
            return distanceSquared(from: item.node.position, to: start, end) <= radius * radius
        }
        for hit in hits {
            guard !progress.isComplete else { break }
            if hit.isFinale {
                guard progress.cutGiant(stroke: stroke) else { continue }
                splash(at: hit.node.position)
                if progress.isComplete {
                    _ = record?.recordMove(qualifies: true)
                    split(hit.node)
                    fruit.removeAll { $0.node === hit.node }
                    hit.node.removeFromParent()
                } else { markFinaleCut(on: hit.node, number: progress.giantCuts) }
            } else if hit.isBonus {
                fruit.removeAll { $0.node === hit.node }
                split(hit.node)
                splash(at: hit.node.position)
                hit.node.removeFromParent()
                continue
            } else {
                guard progress.sliceNormal(stroke: stroke) else { continue }
                missRun = 0
                _ = record?.recordMove(qualifies: true)
                fruit.removeAll { $0.node === hit.node }
                split(hit.node)
                splash(at: hit.node.position)
                hit.node.removeFromParent()
                if progress.isFinale {
                    serveFinale()
                    reportProgress()
                    break
                }
            }
            reportProgress()
        }
    }

    private func reportProgress() {
        onProgress?(progress)
        guard progress.isComplete, !sentFinish else { return }
        sentFinish = true
        activeTouch = nil
        lastPoint = nil
        onFinish?()
    }

    private func markFinaleCut(on node: SKSpriteNode, number: Int) {
        let width = node.size.width * 0.62
        let y = node.size.height * (CGFloat(number) - 2.5) * 0.12
        let path = CGMutablePath()
        path.move(to: CGPoint(x: -width * 0.5, y: y - 9))
        path.addLine(to: CGPoint(x: width * 0.5, y: y + 9))
        let mark = SKShapeNode(path: path)
        mark.strokeColor = .white
        mark.lineWidth = 4
        mark.lineCap = .round
        mark.alpha = 0.85
        mark.zPosition = 2
        node.addChild(mark)
        if !reduceMotion {
            node.run(.sequence([.scale(to: 1.04, duration: 0.06), .scale(to: 1, duration: 0.08)]), withKey: "cut")
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
        trail.strokeColor = isSuperSlice
            ? SKColor(hue: CGFloat(strokeTravel.truncatingRemainder(dividingBy: 150)) / 150, saturation: 0.9, brightness: 1, alpha: 1)
            : .white
        trail.lineWidth = isSuperSlice ? 26 : 7
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
            drop.fillColor = SKColor(red: 0.86, green: 1, blue: 0.97, alpha: 1)
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
