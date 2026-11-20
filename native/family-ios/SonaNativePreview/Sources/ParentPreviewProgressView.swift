import SwiftUI

struct ParentProgressSummary: Decodable, Equatable {
    struct Sound: Decodable, Equatable, Identifiable {
        struct Step: Decodable, Equatable, Identifiable {
            let id: String
            let position: String
            let label: String
        }

        let id: String
        let title: String
        let count: Int
        let steps: [Step]
    }

    let thisWeek: Int
    let lastWeek: Int
    let gameWeek: Int
    let days: [Bool]
    let daysPracticed: Int
    let todayIndex: Int
    let sounds: [Sound]
}

struct ParentProgressView: View {
    let selectedSound: String
    let snapshot: ParentProgressSummary?
    var savedGameRecords: [SavedGameRecord] = []
    var onSendProgress: (() async -> Bool)?

    @State private var sending = false
    @State private var sendMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Practice progress")
                    .font(.system(.largeTitle, design: .rounded).bold())
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityIdentifier("parent-preview-progress")
                if !selectedSound.isEmpty {
                    Label("Selected sound: \(selectedSound)", systemImage: "waveform")
                        .foregroundStyle(SonaPalette.teal)
                }
                if let snapshot {
                    thisWeek(snapshot)
                    soundSteps(snapshot.sounds)
                } else {
                    Text("Practice progress will appear here.").foregroundStyle(.secondary)
                }
                if let onSendProgress {
                    Button {
                        sending = true
                        Task {
                            let sent = await onSendProgress()
                            sendMessage = sent ? "Progress sent." : "Sona couldn’t send progress. Try again."
                            sending = false
                        }
                    } label: {
                        Label(sending ? "Sending…" : "Send progress to speech therapist", systemImage: "paperplane")
                    }
                    .buttonStyle(.bordered)
                    .disabled(sending)
                    if let sendMessage { Text(sendMessage).font(.footnote) }
                }
                if !savedGameRecords.isEmpty { savedRecords }
            }
            .padding(24)
            .frame(maxWidth: 660, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .top)
        }
        .background(SonaPalette.paper.ignoresSafeArea())
        .foregroundStyle(SonaPalette.ink)
        .navigationTitle("Progress")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var savedRecords: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Saved game records")
                .font(.title3.bold()).accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("saved-game-records")
            Text("Play records from the original games, saved separately from practice progress.")
                .font(.footnote).foregroundStyle(.secondary)
            ForEach(savedGameRecords) { record in
                VStack(alignment: .leading, spacing: 5) {
                    Text(record.gameTitle).font(.headline)
                    Text(record.sourceLabel).font(.subheadline).foregroundStyle(.secondary)
                    Text(record.resultLabel).font(.headline).monospacedDigit()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(.white, in: RoundedRectangle(cornerRadius: 17))
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("saved-game-record-\(record.gameID)-\(record.level)-\(record.metric.rawValue)")
            }
        }
    }

    private func thisWeek(_ snapshot: ParentProgressSummary) -> some View {
        let names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        return VStack(alignment: .leading, spacing: 13) {
            Text("This week").font(.title3.bold()).accessibilityAddTraits(.isHeader)
            Text("\(snapshot.thisWeek.formatted()) practice reps")
                .font(.system(.title, design: .rounded).bold())
                .accessibilityIdentifier("parent-week-reps")
            Text("\(snapshot.lastWeek.formatted()) last week")
                .font(.subheadline).foregroundStyle(.secondary)
            if snapshot.gameWeek > 0 {
                Text("\(snapshot.gameWeek.formatted()) reps in games and books this week")
                    .font(.subheadline)
            }
            HStack(spacing: 5) {
                ForEach(names.indices, id: \.self) { index in
                    let active = snapshot.days.indices.contains(index) && snapshot.days[index]
                    VStack(spacing: 6) {
                        Image(systemName: active ? "checkmark.circle.fill" : "circle")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(active ? SonaPalette.teal : SonaPalette.ink.opacity(0.35))
                        Text(String(names[index].prefix(1)))
                            .font(.caption.weight(index == snapshot.todayIndex ? .bold : .regular))
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(names[index] + (active ? ", practiced" : ", no practice"))
                }
            }
            Text("\(snapshot.daysPracticed) days practiced")
                .font(.footnote).foregroundStyle(.secondary)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white, in: RoundedRectangle(cornerRadius: 22))
    }

    private func soundSteps(_ sounds: [ParentProgressSummary.Sound]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("By sound").font(.title3.bold()).accessibilityAddTraits(.isHeader)
            if sounds.isEmpty {
                Text("Practice steps will appear here as your child practices.").foregroundStyle(.secondary)
            }
            ForEach(sounds) { sound in
                VStack(alignment: .leading, spacing: 5) {
                    Text("\(sound.title) · \(sound.count.formatted()) \(sound.count == 1 ? "try" : "tries")")
                        .font(.headline)
                    ForEach(sound.steps) { step in
                        Text(step.position.isEmpty ? step.label : "\(step.position) · \(step.label)")
                            .font(.subheadline)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(.white, in: RoundedRectangle(cornerRadius: 17))
            }
        }
    }
}
