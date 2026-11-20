import Combine
import SwiftUI

struct SprintView: View {
    let onRoundFinished: () -> Void
    var stage: Int = 0
    @Environment(\.guidedReplay) private var guidedReplay

    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start: Date?
    @State private var progress: TimeInterval = 0
    @State private var lane = 1
    @State private var nextItem = 0
    @State private var stars = 0
    @State private var finished = false

    private static let courses = [
        [1, 0, 2, 1, 2, 0, 0, 2, 1, 2, 1, 0],
        [0, 1, 2, 2, 0, 1, 0, 2, 1, 1, 0, 2],
        [2, 1, 0, 2, 2, 1, 0, 0, 2, 1, 0, 1]
    ]
    private var rhythm: [Int] { Self.courses[stage] }
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
                        Button("Back to games") { dismiss() }
                            .font(.system(.headline, design: .rounded).weight(.bold))
                            .frame(minHeight: 48)
                    }
                    .padding(20)
                }
            } else {
                Text(start == nil ? "Catch the stars in your lane." : "Tap a lane or swipe to switch.")
                    .font(.system(.headline, design: .rounded).weight(.bold))
                    .multilineTextAlignment(.center)

                track
                    .frame(minHeight: 140)

                if start == nil {
                    Button(nextItem == 0 ? "Start run" : "Continue run") { resume() }
                        .buttonStyle(RoundActionStyle())
                        .accessibilityIdentifier("sprint-start")
                } else {
                    laneButtons
                }
            }
        }
        .padding(18)
        .frame(maxWidth: 520)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .foregroundStyle(SonaPalette.ink)
        .background(SonaPalette.paper.ignoresSafeArea())
        .onReceive(timer, perform: advance)
        .onChange(of: scenePhase) { phase in
            if phase != .active { start = nil }
        }
    }

    private var header: some View {
        HStack {
            Button { dismiss() } label: {
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
            Label("\(stars)", systemImage: "star.fill")
                .font(.system(.headline, design: .rounded).weight(.heavy))
                .padding(10)
                .background(SonaPalette.yellow, in: Capsule())
                .accessibilityLabel("\(stars) stars")
                .accessibilityIdentifier("sprint-stars")
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

                Image("buddy-fox")
                    .resizable()
                    .scaledToFit()
                    .frame(width: min(78, width * 0.83), height: min(78, height * 0.26))
                    .position(x: width * (CGFloat(lane) + 0.5), y: height * 0.83)
            }
            .clipShape(RoundedRectangle(cornerRadius: 22))
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onEnded { value in
                guard start != nil else { return }
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

    private func advance(to now: Date) {
        guard let start else { return }
        progress = now.timeIntervalSince(start)
        while rhythm.indices.contains(nextItem), progress >= arrival(at: nextItem) {
            if lane == rhythm[nextItem] { stars += 1 }
            nextItem += 1
        }
        if nextItem == rhythm.count {
            self.start = nil
            finished = true
            onRoundFinished()
        }
    }

    private func resume() { start = Date().addingTimeInterval(-progress) }

    private func launch() {
        stars = 0
        nextItem = 0
        lane = 1
        progress = 0
        finished = false
        resume()
    }
}
