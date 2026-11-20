import SwiftUI
import SonaFamilyRules
import SonaFamilyMigration

private struct NativeFamilyPreferences: Decodable {
    struct Position: Decodable { let value: String; let enabled: Bool }
    let name, age, position, start: String
    let assignmentPosition: String?
    let sound: Bool
    let positions: [Position]
}

struct NativeFamilyPreferencesView: View {
    @ObservedObject var records: NativeFamilyState
    @State private var preferences: NativeFamilyPreferences?
    @State private var name = ""
    @State private var age = ""
    @State private var position = "i"
    @State private var start = ""
    @State private var message = ""
    @State private var working = false
    @State private var loadedOwner: NativeFamilyChildID?
    @State private var confirmingReset = false

    private let labels = ["i": "Beginning of word", "m": "Middle of word", "f": "End of word",
                          "v": "Vocalic R (er, ar, or…)", "b": "Blends (tr, st, bl…)", "mix": "Mixed (all positions)"]

    var body: some View {
        Form {
            if let preferences, loadedOwner == records.activeID {
                Section("About your child") {
                    TextField("Name", text: $name).textContentType(.givenName).privacySensitive()
                    TextField("Age", text: $age).keyboardType(.numberPad).privacySensitive()
                }
                Section("Practice") {
                    if let assignment = preferences.assignmentPosition {
                        LabeledPracticeSetting(title: "Word position", value: labels[assignment] ?? assignment)
                        Text("Set by the speech therapist’s homework.").font(.footnote).foregroundStyle(.secondary)
                    } else {
                        Picker("Word position", selection: $position) {
                            ForEach(preferences.positions.filter { $0.enabled || $0.value == position }, id: \.value) { option in
                                Text(labels[option.value] ?? option.value).tag(option.value)
                            }
                        }
                        Picker("Each day’s practice starts with", selection: $start) {
                            Text("The sound").tag("")
                            Text("Syllables").tag("syllable")
                            Text("Words").tag("word")
                            Text("Sentences").tag("sentence")
                        }
                    }
                }
                if !preferences.sound {
                    Section("Audio") {
                        Button("Turn sound on") { Task { await save(.turnSoundOn) } }
                    }
                }
                Button("Save") { Task { await save(.savePreferences) } }
                    .disabled(working || !validAge)
                    .accessibilityIdentifier("family-settings-save")
                Section {
                    Button("Reset progress", role: .destructive) { confirmingReset = true }
                        .disabled(working)
                }
            } else if message.isEmpty { ProgressView("Opening settings") }
            else { Button("Try again") { Task { await load() } } }
            if !message.isEmpty { Text(message).font(.footnote).accessibilityAddTraits(.updatesFrequently) }
        }
        .navigationTitle("Player settings")
        .task(id: records.activeID) { await load() }
        .alert("Reset practice steps and coins?", isPresented: $confirmingReset) {
            Button("Cancel", role: .cancel) {}
            Button("Reset progress", role: .destructive) { Task { await save(.resetProgress) } }
        } message: { Text("Trophies, buddies and stickers stay. This cannot be undone.") }
    }

    private var validAge: Bool { age.isEmpty || Int(age).map { (2...14).contains($0) } == true }

    private func load() async {
        guard let owner = records.activeID else { return }
        message = ""
        preferences = nil
        loadedOwner = nil
        do {
            let value: NativeFamilyPreferences = try await records.read(.preferences)
            guard !Task.isCancelled, records.activeID == owner else { return }
            loadedOwner = owner
            display(value)
        } catch {
            if !Task.isCancelled && records.activeID == owner { message = "Sona couldn’t open these settings." }
        }
    }

    private func save(_ action: NativeFamilyRules.Operation) async {
        guard !working, let owner = loadedOwner, records.activeID == owner else { return }
        working = true
        defer { working = false }
        do {
            let input = NativeRuleFields(pos: position, name: name, age: age, start: start)
            let result: NativeFamilyPreferences = try await records.write(action, input: input, owner: owner)
            guard owner == records.activeID else { return }
            if action == .turnSoundOn || action == .resetProgress { preferences = result }
            else { display(result) }
            message = action == .resetProgress ? "Progress reset." : "Saved."
        } catch { message = "Sona couldn’t save your changes. Try again." }
    }

    private func display(_ value: NativeFamilyPreferences) {
        preferences = value
        name = value.name
        age = value.age
        position = value.position
        start = value.start
    }
}

private struct LabeledPracticeSetting: View {
    let title: String
    let value: String
    var body: some View { HStack { Text(title); Spacer(); Text(value).foregroundStyle(.secondary) } }
}
