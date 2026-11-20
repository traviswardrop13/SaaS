import AVFoundation
import SwiftUI

struct ArcadeRoundView: View {
    let game: NativeGame
    let onRoundFinished: () -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase

    @StateObject private var piano = PianoVoice()
    @State private var round = 0
    @State private var moves = 0

    private var goal: Int { game == .tiles ? PianoBoard.melody.count : 6 }

    var body: some View {
        VStack(spacing: 14) {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 19, weight: .bold))
                        .frame(width: 48, height: 48)
                        .background(.white, in: Circle())
                }
                .accessibilityLabel("Back to games")
                .accessibilityIdentifier("arcade-close")
                Spacer()
                Text(game.title)
                    .font(.system(.title2, design: .rounded, weight: .heavy))
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                ProgressView(value: Double(moves), total: Double(goal))
                    .frame(width: 48)
                    .tint(SonaPalette.teal)
                    .accessibilityLabel("Round progress")
            }
            .buttonStyle(SonaPressStyle())

            if moves == goal {
                finishCard
            } else {
                Text(game.instruction)
                    .font(.system(.headline, design: .rounded, weight: .bold))
                    .multilineTextAlignment(.center)

                board.id(round)
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .frame(maxWidth: 600)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .foregroundStyle(SonaPalette.ink)
        .background(SonaPalette.paper.ignoresSafeArea())
        .onDisappear { piano.stop() }
        .onChange(of: scenePhase) { phase in if phase != .active { piano.stop() } }
    }

    @ViewBuilder
    private var board: some View {
        switch game {
        case .tiles:
            PianoBoard(move: moves, piano: piano, advance: advance)
        case .stack:
            StackerBoard(advance: advance)
        case .hoops, .soccer:
            TargetBoard(isSoccer: game == .soccer, advance: advance)
        default:
            EmptyView()
        }
    }

    private func advance() {
        guard moves < goal else { return }
        moves += 1
        if moves == goal { onRoundFinished() }
    }

    private var finishCard: some View {
        ScrollView {
            VStack(spacing: 16) {
                Image("echo-cheer")
                    .resizable()
                    .scaledToFit()
                    .frame(height: 172)
                    .accessibilityHidden(true)
                Text("You did it!")
                    .font(.system(.largeTitle, design: .rounded, weight: .heavy))
                    .accessibilityIdentifier("arcade-complete")
                Button("Play again") { moves = 0; round += 1 }
                    .buttonStyle(RoundActionStyle())
                Button("Back to games") { dismiss() }
                    .font(.system(.headline, design: .rounded, weight: .bold))
                    .frame(minHeight: 48)
            }
            .padding(20)
            .frame(maxWidth: .infinity)
        }
    }
}

struct RoundActionStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(.headline, design: .rounded, weight: .heavy))
            .foregroundStyle(.white)
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(SonaPalette.teal.opacity(configuration.isPressed ? 0.8 : 1), in: RoundedRectangle(cornerRadius: 16))
    }
}

private struct PianoBoard: View {
    static let melody = [0, 0, 4, 4, 5, 5, 4, 3, 3, 2, 2, 1, 1, 0]
    let move: Int
    let piano: PianoVoice
    let advance: () -> Void

    @State private var lastKey: Int?

    private let names = ["C", "D", "E", "F", "G", "A"]
    private let colors = [SonaPalette.yellow, SonaPalette.mint, SonaPalette.lavender]

    var body: some View {
        let expected = Self.melody[move]
        VStack(spacing: 15) {
            Spacer()
            Image(systemName: "music.note.list")
                .font(.system(size: 66, weight: .regular))
                .foregroundStyle(SonaPalette.teal)
                .accessibilityHidden(true)
            Text("Twinkle, Twinkle, Little Star")
                .font(.system(.title3, design: .rounded, weight: .heavy))
                .multilineTextAlignment(.center)
            HStack(spacing: 4) {
                ForEach(Self.melody.indices, id: \.self) { index in
                    Capsule()
                        .fill(index < move ? SonaPalette.teal : SonaPalette.ink.opacity(0.13))
                        .frame(height: 7)
                }
            }
            HStack(alignment: .top, spacing: 5) {
                ForEach(names.indices, id: \.self) { key in
                    Button {
                        piano.play(key)
                        if key == expected {
                            lastKey = nil
                            advance()
                        } else {
                            lastKey = key
                        }
                    } label: {
                        VStack {
                            Spacer()
                            if key == expected {
                                Image(systemName: "star.fill")
                                    .font(.system(size: 16))
                                    .accessibilityHidden(true)
                            }
                            Text(names[key])
                                .font(.system(.subheadline, design: .rounded, weight: .heavy))
                        }
                        .padding(.bottom, 14)
                        .frame(maxWidth: .infinity, minHeight: 142)
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
    }
}

final class PianoVoice: ObservableObject {
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
        let frames = 7200
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
    let advance: () -> Void
    @State private var blocks = [Block(center: 0.5, width: 0.58)]
    @State private var began = Date()
    @State private var missed = false

    private struct Block {
        let center: CGFloat
        let width: CGFloat
    }

    private let colors = [SonaPalette.lavender, SonaPalette.yellow, SonaPalette.teal, SonaPalette.mint]

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
    }

    private func movingCenter(at date: Date) -> CGFloat {
        let fraction = date.timeIntervalSince(began) * (missed ? 0.36 : 0.51)
        let phase = fraction.truncatingRemainder(dividingBy: 2)
        return 0.24 + (phase <= 1 ? phase : 2 - phase) * 0.52
    }

    private func drop() {
        guard let top = blocks.last else { return }
        let center = movingCenter(at: Date())
        let lower = max(top.center, center) - top.width / 2
        let upper = min(top.center, center) + top.width / 2
        let shared = upper - lower
        guard shared >= min(0.12, top.width * 0.55) else {
            missed = true
            return
        }
        let base = Block(center: (lower + upper) / 2, width: max(shared, 0.17))
        blocks.append(base)
        missed = false
        began = Date()
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
                        guard value.startLocation.y > height * 0.66, value.translation.height < -20 else { return }
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
        let hit = isSoccer
            ? position >= 0.16 && position <= 0.84 && abs(target - position) > 0.13
            : abs(target - position) <= 0.13
        withAnimation(.easeOut(duration: flight)) {
            ballPosition = CGPoint(x: position * width, y: height * 0.27)
        }
        shotTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 430_000_000)
            guard !Task.isCancelled else { return }
            ballPosition = nil
            feedback = hit ? (isSoccer ? "Goal!" : "Nice shot!") : "Try another shot."
            shotTask = nil
            if hit { advance() }
        }
    }
}
