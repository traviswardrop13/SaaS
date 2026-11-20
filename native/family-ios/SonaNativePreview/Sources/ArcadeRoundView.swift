import AVFoundation
import Combine
import SwiftUI

struct ArcadeRoundView: View {
    let game: NativeGame
    let onRoundFinished: () -> Void
    var stage: Int = 0
    var onLifeLost: (() -> Void)?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.guidedReplay) private var guidedReplay
    @Environment(\.guidedArcadeExit) private var guidedArcadeExit
    @Environment(\.guidedArcadeRestoredLives) private var restoredLives
    @Environment(\.arcadePowerEffect) private var power
    @Environment(\.arcadeStartingHearts) private var startingHearts
    @Environment(\.speechGameProgress) private var speechGameProgress
    @Environment(\.scenePhase) private var scenePhase

    @StateObject private var piano = PianoVoice()
    @State private var round = 0
    @State private var moves = 0
    @State private var lives = NativeArcadeLives()
    @State private var preparedHearts = false

    private var powerBoard: Bool { [.tiles, .stack].contains(game) && onLifeLost != nil }
    private var finale: Bool { game == .tiles && stage == 3 }

    private var goal: Int {
        if let progress = speechGameProgress { return progress.count }
        return game == .tiles ? PianoBoard.songs[stage].notes.count : 5 + stage
    }

    var body: some View {
        VStack(spacing: 14) {
            HStack {
                Button(action: close) {
                    Image(systemName: "xmark")
                        .font(.system(size: 19, weight: .bold))
                        .frame(width: 48, height: 48)
                        .background(.white, in: Circle())
                }
                .accessibilityLabel("Back to games")
                .accessibilityIdentifier("arcade-close")
                Spacer()
                Text(game.title)
                    .font(.system(.title2, design: .rounded).weight(.heavy))
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                VStack(spacing: 6) {
                    ProgressView(value: Double(moves), total: Double(goal))
                        .frame(width: 48)
                        .tint(SonaPalette.teal)
                        .accessibilityLabel("Round progress")
                    if powerBoard && moves < goal && !finale { NativeArcadeHearts(count: lives.hearts) }
                }
            }
            .buttonStyle(SonaPressStyle())

            if moves == goal {
                finishCard
            } else {
                Text(game.instruction)
                    .font(.system(.headline, design: .rounded).weight(.bold))
                    .multilineTextAlignment(.center)

                board.id(round).allowsHitTesting(lives.hearts > 0)
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .frame(maxWidth: 600)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .foregroundStyle(SonaPalette.ink)
        .background(SonaPalette.paper.ignoresSafeArea())
        .onAppear {
            if !preparedHearts { lives = NativeArcadeLives(startingHearts: startingHearts); preparedHearts = true }
        }
        .onDisappear { piano.stop() }
        .onChange(of: scenePhase) { phase in if phase != .active { piano.stop() } }
        .onChange(of: restoredLives) { _ in lives.restore(at: ProcessInfo.processInfo.systemUptime) }
        .preference(key: NativeArcadePowerBoardPreference.self, value: NativeArcadePowerBoard(
            playing: powerBoard && moves < goal && lives.hearts > 0 && !finale,
            fractionComplete: Double(moves) / Double(goal), clearsPower: finale, hearts: powerBoard ? lives.hearts : nil))
    }

    @ViewBuilder
    private var board: some View {
        switch game {
        case .tiles:
            PianoBoard(song: PianoBoard.songs[stage], move: moves, stage: stage, running: lives.hearts > 0,
                       piano: piano, hit: advance, miss: miss)
        case .stack:
            StackerBoard(running: lives.hearts > 0, advance: advance, onMiss: miss)
        case .hoops, .soccer:
            TargetBoard(isSoccer: game == .soccer, advance: advance)
        default:
            EmptyView()
        }
    }

    private func advance() {
        guard moves < goal, lives.hearts > 0 else { return }
        moves += 1
        speechGameProgress?.advance()
        if moves == goal { onRoundFinished() }
    }

    @discardableResult private func miss() -> Bool {
        guard let onLifeLost, !finale else { return false }
        let hit = lives.miss(at: ProcessInfo.processInfo.systemUptime, protected: power.protectsHearts)
        if hit && lives.hearts == 0 { piano.stop(); onLifeLost() }
        return lives.hearts == 0
    }

    private func close() { if let guidedArcadeExit { guidedArcadeExit() } else { dismiss() } }

    private var finishCard: some View {
        ScrollView {
            VStack(spacing: 16) {
                Image("echo-cheer")
                    .resizable()
                    .scaledToFit()
                    .frame(height: 172)
                    .accessibilityHidden(true)
                Text("You did it!")
                    .font(.system(.largeTitle, design: .rounded).weight(.heavy))
                    .accessibilityIdentifier("arcade-complete")
                Button("Play again") {
                    if let guidedReplay { guidedReplay() }
                    else { moves = 0; round += 1 }
                }
                    .buttonStyle(RoundActionStyle())
                Button("Back to games", action: close)
                    .font(.system(.headline, design: .rounded).weight(.bold))
                    .frame(minHeight: 48)
            }
            .padding(20)
            .frame(maxWidth: .infinity)
        }
    }
}

private struct GuidedReplayKey: EnvironmentKey {
    static let defaultValue: (() -> Void)? = nil
}

extension EnvironmentValues {
    var guidedReplay: (() -> Void)? {
        get { self[GuidedReplayKey.self] }
        set { self[GuidedReplayKey.self] = newValue }
    }
}

struct RoundActionStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(.headline, design: .rounded).weight(.heavy))
            .foregroundStyle(.white)
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(SonaPalette.teal.opacity(configuration.isPressed ? 0.8 : 1), in: RoundedRectangle(cornerRadius: 16))
    }
}

private struct PianoBoard: View {
    struct Song {
        let title: String
        let notes: [Int]
        let fall: TimeInterval

        init(_ title: String, _ tune: String, fall: TimeInterval) {
            self.title = title
            self.fall = fall
            let pitches = Array("CDEFGA")
            notes = tune.compactMap { pitches.firstIndex(of: $0) }
        }
    }

    static let songs = [
        Song("Twinkle Twinkle", "CCGGAAG FFEEDDC", fall: 2.5),
        Song("Mary Had a Little Lamb", "EDCDEEE DDD EGG", fall: 2.3),
        Song("Row, Row, Row Your Boat", "CCCDE EDEFG", fall: 2.1),
        Song("Ode to Joy", "EEFGGFED CCDEEDD", fall: 2.2)
    ]
    let song: Song
    let move: Int
    let stage: Int
    let running: Bool
    let piano: PianoVoice
    let hit: () -> Void
    let miss: () -> Bool

    @State private var lastKey: Int?
    @State private var clock = NativeArcadeMotionClock()
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.arcadePowerEffect) private var power
    @Environment(\.willPlayArcadeGameAudio) private var willPlayAudio
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOver
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let timer = Timer.publish(every: 1.0 / 30, on: .main, in: .common).autoconnect()

    private let names = ["C", "D", "E", "F", "G", "A"]
    private let colors = [SonaPalette.yellow, SonaPalette.mint, SonaPalette.lavender]
    private var waitsAtKeys: Bool { stage == 3 || (stage == 0 && move < 3) || voiceOver }
    private var playbackSpeed: Double { running && scenePhase == .active ? power.speed : 0 }
    private var now: TimeInterval { Date().timeIntervalSinceReferenceDate }

    var body: some View {
        let expected = song.notes[move]
        VStack(spacing: 15) {
            Spacer()
            Text(song.title)
                .font(.system(.title3, design: .rounded).weight(.heavy))
                .multilineTextAlignment(.center)
            HStack(spacing: 4) {
                ForEach(song.notes.indices, id: \.self) { index in
                    Capsule()
                        .fill(index < move ? SonaPalette.teal : SonaPalette.ink.opacity(0.13))
                        .frame(height: 7)
                }
            }
            TimelineView(.animation(minimumInterval: 1.0 / 30)) { timeline in
                GeometryReader { geometry in
                    let span = max(0, geometry.size.height - 34)
                    let fraction = min(1, clock.position(at: timeline.date.timeIntervalSinceReferenceDate) / song.fall)
                    let width = geometry.size.width / CGFloat(names.count)
                    RoundedRectangle(cornerRadius: 9)
                        .fill(colors[expected % colors.count])
                        .overlay(Image(systemName: "music.note").font(.headline))
                        .frame(width: max(16, width - 8), height: 31)
                        .position(x: width * (0.5 + CGFloat(expected)), y: 17 + span * (reduceMotion ? 1 : fraction))
                }
            }
            .frame(minHeight: 68, maxHeight: 112)
            .accessibilityHidden(true)
            HStack(alignment: .top, spacing: 5) {
                ForEach(names.indices, id: \.self) { key in
                    Button {
                        guard running else { return }
                        if willPlayAudio(PianoVoice.noteDuration) { piano.play(key) }
                        if key == expected { lastKey = nil; hit() }
                        else { lastKey = key; if !waitsAtKeys { _ = miss() } }
                    } label: {
                        VStack {
                            Spacer()
                            if key == expected {
                                Image(systemName: "star.fill")
                                    .font(.system(size: 16))
                                    .accessibilityHidden(true)
                            }
                            Text(names[key])
                                .font(.system(.subheadline, design: .rounded).weight(.heavy))
                        }
                        .padding(.bottom, 14)
                        .frame(maxWidth: .infinity, minHeight: 103)
                        .background(key == expected ? colors[key % colors.count] : .white, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(
                            key == expected ? SonaPalette.teal : SonaPalette.ink.opacity(0.11),
                            lineWidth: key == expected ? 3 : 1
                        ))
                    }
                    .buttonStyle(SonaPressStyle())
                    .accessibilityLabel(key == expected ? "Play \(names[key]), highlighted" : "Play \(names[key])")
                    .accessibilityIdentifier("piano-key-\(names[key])")
                }
            }
            Text(lastKey == nil ? "Follow the star." : "Try the key with the star.")
                .font(.system(.subheadline, design: .rounded))
                .foregroundStyle(SonaPalette.muted)
            Spacer()
        }
        .padding(16)
        .background(SonaPalette.mint.opacity(0.42), in: RoundedRectangle(cornerRadius: 25))
        .onAppear { clock.restart(at: now, speed: playbackSpeed) }
        .onChange(of: move) { _ in clock.restart(at: now, speed: playbackSpeed) }
        .onChange(of: playbackSpeed) { clock.setSpeed($0, at: now) }
        .onReceive(timer) { date in
            guard playbackSpeed > 0, !waitsAtKeys,
                  clock.position(at: date.timeIntervalSinceReferenceDate) >= song.fall + 0.65 else { return }
            clock.restart(at: now, speed: playbackSpeed)
            if !miss() { hit() }
        }
    }
}

final class PianoVoice: ObservableObject {
    static let noteDuration: TimeInterval = 0.55
    private let frequencies = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0]
    private var notes: [Int: AVAudioPlayer] = [:]

    func play(_ key: Int) {
        guard frequencies.indices.contains(key) else { return }
        do {
            try AVAudioSession.sharedInstance().setCategory(.soloAmbient)
            if notes[key] == nil {
                notes[key] = try AVAudioPlayer(data: tone(frequency: frequencies[key]))
            }
            guard let player = notes[key] else { return }
            player.currentTime = 0
            player.play()
        } catch {
            return
        }
    }

    func stop() { notes.values.forEach { $0.stop() } }

    private func tone(frequency: Double) -> Data {
        let sampleRate = 22050
        let frames = Int(Double(sampleRate) * Self.noteDuration)
        var data = Data()
        func append<T: FixedWidthInteger>(_ value: T) {
            var little = value.littleEndian
            withUnsafeBytes(of: &little) { data.append(contentsOf: $0) }
        }
        data.append(contentsOf: "RIFF".utf8); append(UInt32(36 + frames * 2))
        data.append(contentsOf: "WAVEfmt ".utf8); append(UInt32(16))
        append(UInt16(1)); append(UInt16(1))
        append(UInt32(sampleRate)); append(UInt32(sampleRate * 2))
        append(UInt16(2)); append(UInt16(16))
        data.append(contentsOf: "data".utf8); append(UInt32(frames * 2))
        for index in 0..<frames {
            let time = Double(index) / Double(sampleRate)
            let phase = 2 * Double.pi * frequency * time
            let envelope = min(1, time * 100) * exp(-9 * time)
            let sample = (sin(phase) + 0.23 * sin(phase * 2)) * envelope * 9000
            append(Int16(sample))
        }
        return data
    }
}

private struct StackerBoard: View {
    let running: Bool
    let advance: () -> Void
    let onMiss: () -> Bool
    @State private var blocks = [Block(center: 0.5, width: 0.58)]
    @State private var clock = NativeArcadeMotionClock()
    @State private var missed = false
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.arcadePowerEffect) private var power

    private struct Block {
        let center: CGFloat
        let width: CGFloat
    }

    private let colors = [SonaPalette.lavender, SonaPalette.yellow, SonaPalette.teal, SonaPalette.mint]
    private var now: TimeInterval { Date().timeIntervalSinceReferenceDate }
    private var speed: Double { running && scenePhase == .active ? power.speed * (missed ? 0.36 : 0.51) : 0 }

    var body: some View {
        VStack(spacing: 12) {
            TimelineView(.animation(minimumInterval: 1.0 / 45)) { time in
                GeometryReader { geometry in
                    let width = geometry.size.width
                    let step = max(5, min(34, (geometry.size.height - 32) / 9))
                    let floor = geometry.size.height - step
                    let nextWidth = blocks.last?.width ?? 0.58

                    ZStack {
                        SonaPalette.lavender.opacity(0.45)
                        ForEach(blocks.indices, id: \.self) { index in
                            RoundedRectangle(cornerRadius: 8)
                                .fill(colors[index % colors.count])
                                .frame(width: width * blocks[index].width, height: step - 3)
                                .position(x: width * blocks[index].center, y: floor - CGFloat(index) * step)
                        }
                        RoundedRectangle(cornerRadius: 8)
                            .fill(colors[blocks.count % colors.count])
                            .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(SonaPalette.ink, style: StrokeStyle(lineWidth: 2, dash: [5, 4])))
                            .frame(width: width * nextWidth, height: step - 3)
                            .position(x: width * movingCenter(at: time.date), y: floor - CGFloat(blocks.count) * step)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 25))
                }
                .accessibilityHidden(true)
            }
            Text(missed ? "Try again when the blocks line up." : "Line up the next block.")
                .font(.system(.subheadline, design: .rounded))
            Button("Drop block") { drop() }
                .buttonStyle(RoundActionStyle())
                .accessibilityIdentifier("stacker-drop")
        }
        .onAppear { clock.restart(at: now, speed: speed) }
        .onChange(of: speed) { clock.setSpeed($0, at: now) }
    }

    private func movingCenter(at date: Date) -> CGFloat {
        let fraction = clock.position(at: date.timeIntervalSinceReferenceDate)
        let phase = fraction.truncatingRemainder(dividingBy: 2)
        return 0.24 + (phase <= 1 ? phase : 2 - phase) * 0.52
    }

    private func drop() {
        guard running, let top = blocks.last else { return }
        let center = movingCenter(at: Date())
        let lower = max(top.center, center) - top.width / 2
        let upper = min(top.center, center) + top.width / 2
        let shared = upper - lower
        guard shared >= min(0.12, top.width * 0.55) else {
            missed = true
            _ = onMiss()
            clock.restart(at: now, speed: speed)
            return
        }
        let base = Block(center: (lower + upper) / 2, width: max(shared, 0.17))
        blocks.append(base)
        missed = false
        clock.restart(at: now, speed: speed)
        advance()
    }
}

private struct TargetBoard: View {
    let isSoccer: Bool
    let advance: () -> Void
    @State private var started = Date()
    @State private var ballPosition: CGPoint?
    @State private var feedback = ""
    @State private var shotTask: Task<Void, Never>?
    @State private var boardSize: CGSize = .zero
    @State private var missedShots = 0

    private var icon: String { isSoccer ? "⚽" : "🏀" }

    var body: some View {
        VStack(spacing: 12) {
            TimelineView(.animation(minimumInterval: 1.0 / 45)) { time in
                GeometryReader { geometry in
                    let width = geometry.size.width
                    let height = geometry.size.height
                    let targetX = movingTarget(at: time.date) * width
                    let ballHome = CGPoint(x: width * 0.5, y: height * 0.82)
                    let targetY = height * 0.27
                    let ball = ballPosition ?? ballHome

                    ZStack {
                        isSoccer ? SonaPalette.mint : SonaPalette.yellow.opacity(0.6)
                        if isSoccer {
                            RoundedRectangle(cornerRadius: 10)
                                .strokeBorder(.white, lineWidth: 5)
                                .frame(width: width * 0.7, height: 76)
                                .position(x: width * 0.5, y: targetY)
                            Text("🐻")
                                .font(.system(size: 43))
                                .position(x: targetX, y: targetY)
                        } else {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(.white)
                                .frame(width: 100, height: 61)
                                .overlay(alignment: .bottom) {
                                    Capsule()
                                        .fill(.orange)
                                        .frame(width: 60, height: 9)
                                }
                                .position(x: targetX, y: targetY - 16)
                        }
                        Circle()
                            .strokeBorder(.white.opacity(0.8), style: StrokeStyle(lineWidth: 3, dash: [7, 5]))
                            .frame(width: 77, height: 77)
                            .position(ballHome)
                        Text(icon)
                            .font(.system(size: 49))
                            .position(ball)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 25))
                    .gesture(DragGesture(minimumDistance: 17).onEnded { value in
                        guard value.startLocation.y > height * 0.60,
                              value.translation.height < -max(24, height * 0.05) else { return }
                        let horizontal = value.translation.width / max(25, -value.translation.height)
                        let x = min(width, max(0, ballHome.x + horizontal * (ballHome.y - targetY)))
                        fire(at: x / width, width: width, height: height)
                    })
                    .accessibilityHidden(true)
                    .onAppear { boardSize = geometry.size }
                    .onChange(of: geometry.size) { boardSize = $0 }
                }
            }
            Text(feedback.isEmpty ? (isSoccer ? "Aim away from the keeper." : "Aim for the moving hoop.") : feedback)
                .font(.system(.subheadline, design: .rounded))
            Button(isSoccer ? "Kick straight" : "Shoot straight") {
                fire(at: 0.5, width: boardSize.width, height: boardSize.height)
            }
            .buttonStyle(RoundActionStyle())
            .disabled(boardSize == .zero)
        }
        .onDisappear { shotTask?.cancel() }
    }

    private func movingTarget(at date: Date) -> CGFloat {
        0.5 + 0.24 * sin(date.timeIntervalSince(started) * (isSoccer ? 1.7 : 1.36))
    }

    private func fire(at position: CGFloat, width: CGFloat, height: CGFloat) {
        guard shotTask == nil else { return }
        let flight = 0.43
        let target = movingTarget(at: Date().addingTimeInterval(flight))
        let assistance = min(missedShots, 2)
        let post = [0.16, 0.13, 0.08][assistance]
        let reach = [0.13, 0.10, 0.07][assistance]
        let gap = abs(target - position)
        let aimedWell = isSoccer ? position >= post && position <= 1 - post && gap > reach
            : min(gap, abs(movingTarget(at: Date()) - position)) <= [0.13, 0.19, 0.30][assistance]
        let hit = missedShots >= 3 || aimedWell
        let landing: CGFloat
        if hit { landing = isSoccer ? (target >= 0.5 ? 0.28 : 0.72) : target }
        else { landing = position }
        withAnimation(.easeOut(duration: flight)) {
            ballPosition = CGPoint(x: landing * width, y: height * 0.27)
        }
        shotTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 430_000_000)
            guard !Task.isCancelled else { return }
            ballPosition = nil
            feedback = hit ? (isSoccer ? "Goal!" : "Nice shot!") : "Try another shot."
            shotTask = nil
            missedShots = hit ? 0 : missedShots + 1
            if hit { advance() }
        }
    }
}
