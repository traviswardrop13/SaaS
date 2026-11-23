import Combine
import SwiftUI

struct SprintView: View {
    let onRoundFinished: () -> Void
    var stage: Int = 0
    var onLifeLost: (() -> Void)?
    @Environment(\.guidedReplay) private var guidedReplay
    @Environment(\.guidedArcadeExit) private var guidedArcadeExit
    @Environment(\.guidedArcadeRestoredLives) private var restoredLives
    @Environment(\.arcadePowerEffect) private var power
    @Environment(\.arcadeRoundContext) private var arcadeRound
    @Environment(\.arcadeStartingHearts) private var startingHearts

    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var running = false
    @State private var motion = NativeArcadeMotionClock()
    @State private var lives = NativeArcadeLives()
    @State private var preparedHearts = false
    @State private var progress: TimeInterval = 0
    @State private var lane = 1
    @State private var nextItem = 0
    @State private var nextRock = 0
    @State private var stars = 0
    @State private var helpUntil: TimeInterval = 0
    @State private var finished = false

    private static let courses = [
        [1, 0, 2, 1, 2, 0, 0, 2, 1, 2, 1, 0],
        [0, 1, 2, 2, 0, 1, 0, 2, 1, 1, 0, 2],
        [2, 1, 0, 2, 2, 1, 0, 0, 2, 1, 0, 1]
    ]
    private var rhythm: [Int] { Self.courses[stage] }
    private var level: Int { arcadeRound?.level ?? 1 }
    private var runningSpeed: Double {
        power.speed * NativeArcadeDifficulty.sprintSpeed(level: progress < helpUntil ? 1 : level, stage: stage)
    }
    private let rockAfter = [0, 3, 6, 9]
    private let timer = Timer.publish(every: 1.0 / 30, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 14) {
            header

            if finished {
                ScrollView {
                    VStack(spacing: 18) {
                        Image("echo-cheer")
                            .resizable()
                            .scaledToFit()
                            .frame(height: 150)
                            .accessibilityHidden(true)
                        Text("You caught \(stars) stars!")
                            .font(.system(.title, design: .rounded).weight(.heavy))
                        Button("Play again") {
                            if let guidedReplay { guidedReplay() }
                            else { launch() }
                        }
                            .buttonStyle(RoundActionStyle())
                        Button("Back to games", action: close)
                            .font(.system(.headline, design: .rounded).weight(.bold))
                            .frame(minHeight: 48)
                    }
                    .padding(20)
                }
            } else {
                Text(running ? "Tap a lane or swipe to switch." :
                        onLifeLost == nil ? "Catch the stars in your lane." : "Catch stars and dodge rocks.")
                    .font(.system(.headline, design: .rounded).weight(.bold))
                    .multilineTextAlignment(.center)

                track
                    .frame(minHeight: 140)

                if !running && lives.hearts > 0 {
                    Button(nextItem == 0 ? "Start run" : "Continue run") { resume() }
                        .buttonStyle(RoundActionStyle())
                        .accessibilityIdentifier("sprint-start")
                } else if running {
                    laneButtons
                }
            }
        }
        .padding(18)
        .frame(maxWidth: 520)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .foregroundStyle(SonaPalette.ink)
        .background(SonaPalette.paper.ignoresSafeArea())
        .onAppear {
            if !preparedHearts { lives = NativeArcadeLives(startingHearts: startingHearts); preparedHearts = true }
        }
        .onReceive(timer) { _ in advance() }
        .onChange(of: scenePhase) { phase in
            if phase != .active { pause() }
        }
        .onChange(of: runningSpeed) { if running { motion.setSpeed($0, at: now) } }
        .onChange(of: restoredLives) { _ in
            guard lives.hearts == 0 else { return }
            lives.restore(at: now)
            resume()
        }
        .preference(key: NativeArcadePowerBoardPreference.self, value: NativeArcadePowerBoard(
            playing: running && !finished,
            secondsLeft: max(0, ((arrival(at: rhythm.count - 1) - progress) * 4).rounded() / 4),
            hearts: lives.hearts))
    }

    private var header: some View {
        HStack {
            Button(action: close) {
                Image(systemName: "xmark")
                    .frame(width: 48, height: 48)
                    .font(.system(size: 20, weight: .bold))
                    .background(.white, in: Circle())
            }
            .accessibilityLabel("Back to games")
            Spacer()
            Text("Sound Sprint")
                .font(.system(.title2, design: .rounded).weight(.heavy))
                .accessibilityAddTraits(.isHeader)
            Spacer()
            VStack(spacing: 4) {
                Label("\(stars)", systemImage: "star.fill")
                    .font(.system(.headline, design: .rounded).weight(.heavy))
                    .accessibilityLabel("\(stars) stars")
                    .accessibilityIdentifier("sprint-stars")
                if onLifeLost != nil && !finished { NativeArcadeHearts(count: lives.hearts) }
            }
            .padding(8)
            .background(SonaPalette.yellow, in: RoundedRectangle(cornerRadius: 13))
        }
        .buttonStyle(SonaPressStyle())
    }

    private var track: some View {
        GeometryReader { geometry in
            let width = geometry.size.width / 3
            let height = geometry.size.height

            ZStack {
                HStack(spacing: 0) {
                    ForEach(0..<3) { track in
                        Rectangle()
                            .fill(track == lane ? SonaPalette.mint : .white.opacity(0.75))
                            .overlay(alignment: .trailing) {
                                if track < 2 { Rectangle().fill(SonaPalette.ink.opacity(0.10)).frame(width: 2) }
                            }
                    }
                }

                ForEach(rhythm.indices.filter { $0 >= nextItem }, id: \.self) { index in
                    let distance = arrival(at: index) - progress
                    if (0...2.6).contains(distance) {
                        let fraction = CGFloat(max(0.07, 0.81 - distance / 3.55))
                        Image(systemName: "star.fill")
                            .font(.system(size: reduceMotion ? 30 : 29 + 20 * fraction, weight: .heavy))
                            .foregroundStyle(Color(red: 0.77, green: 0.46, blue: 0.02))
                            .padding(4)
                            .background(SonaPalette.yellow, in: Circle())
                            .position(x: width * (CGFloat(rhythm[index]) + 0.5), y: height * fraction)
                    }
                }

                if onLifeLost != nil {
                    ForEach(rockAfter.indices.filter { $0 >= nextRock }, id: \.self) { index in
                        let distance = rockArrival(index) - progress
                        if (0...2.6).contains(distance) {
                            let fraction = CGFloat(max(0.07, 0.81 - distance / 3.55))
                            Image(systemName: "mountain.2.fill")
                                .font(.system(size: 26, weight: .heavy))
                                .foregroundStyle(SonaPalette.ink)
                                .padding(6)
                                .background(.white, in: Circle())
                                .position(x: width * (CGFloat(rockLane(index)) + 0.5), y: height * fraction)
                        }
                    }
                }

                Image("buddy-fox")
                    .resizable()
                    .scaledToFit()
                    .frame(width: min(78, width * 0.83), height: min(78, height * 0.26))
                    .position(x: width * (CGFloat(lane) + 0.5), y: height * 0.83)
            }
            .clipShape(RoundedRectangle(cornerRadius: 22))
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onEnded { value in
                guard running else { return }
                if abs(value.translation.width) > 25 {
                    lane = min(2, max(0, lane + (value.translation.width > 0 ? 1 : -1)))
                } else {
                    lane = min(2, max(0, Int(value.location.x / max(1, width))))
                }
            })
            .accessibilityHidden(true)
        }
    }

    private var laneButtons: some View {
        HStack(spacing: 8) {
            ForEach(Array(["Left", "Middle", "Right"].enumerated()), id: \.offset) { index, title in
                Button { lane = index } label: {
                    Text(title)
                        .font(.system(.subheadline, design: .rounded).weight(.bold))
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(lane == index ? SonaPalette.teal : .white, in: RoundedRectangle(cornerRadius: 11))
                        .foregroundStyle(lane == index ? .white : SonaPalette.ink)
                }
                .buttonStyle(SonaPressStyle())
                .accessibilityAddTraits(lane == index ? .isSelected : [])
            }
        }
    }

    private func arrival(at index: Int) -> TimeInterval { 1.75 + Double(index) * 1.18 }

    private var now: TimeInterval { ProcessInfo.processInfo.systemUptime }
    private func rockArrival(_ index: Int) -> TimeInterval {
        let gap = [0.56, 0.47, 0.39][level - 1]
        return arrival(at: rockAfter[index]) + (progress < helpUntil ? 0.56 : gap)
    }
    private func rockLane(_ index: Int) -> Int { (rhythm[rockAfter[index]] + 1) % 3 }

    private func advance() {
        guard running else { return }
        let time = now
        progress = motion.position(at: time)
        if let onLifeLost {
            while rockAfter.indices.contains(nextRock), progress >= rockArrival(nextRock) {
                let collision = lane == rockLane(nextRock)
                nextRock += 1
                if collision && lives.miss(at: time, protected: power.protectsHearts) {
                    helpUntil = progress + 4.7
                    motion.setSpeed(runningSpeed, at: time)
                    if lives.hearts == 0 {
                        pause()
                        onLifeLost()
                        return
                    }
                }
            }
        }
        while rhythm.indices.contains(nextItem), progress >= arrival(at: nextItem) {
            if lane == rhythm[nextItem] { stars += 1; _ = arcadeRound?.record?.recordStars() }
            nextItem += 1
        }
        if nextItem == rhythm.count {
            pause()
            finished = true
            onRoundFinished()
        }
    }

    private func resume() { motion.setSpeed(runningSpeed, at: now); running = true }
    private func pause() { motion.setSpeed(0, at: now); running = false }
    private func close() { if let guidedArcadeExit { guidedArcadeExit() } else { dismiss() } }

    private func launch() {
        stars = 0
        helpUntil = 0
        nextItem = 0
        nextRock = 0
        lane = 1
        progress = 0
        motion.restart(at: now, speed: 0)
        lives = NativeArcadeLives()
        finished = false
        resume()
    }
}
