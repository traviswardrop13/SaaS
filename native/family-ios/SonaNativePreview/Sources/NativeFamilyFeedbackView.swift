import SwiftUI

/// A voluntary message to the existing family support endpoint.
struct NativeFamilyFeedbackView: View {
    private let topics = ["More games", "New sounds to practice", "Progress reports",
                          "Easier for my kid", "Something's broken", "Something else"]
    @State private var selected: Set<String> = []
    @State private var note = ""
    @State private var email = ""
    @State private var sending = false
    @State private var message = ""

    var body: some View {
        Form {
            Section {
                HStack(alignment: .top, spacing: 12) {
                    Image("rachel-wardrop-profile")
                        .resizable().scaledToFill().frame(width: 52, height: 52)
                        .clipShape(Circle()).accessibilityLabel("Rachel Wardrop")
                    VStack(alignment: .leading, spacing: 5) {
                        Text("Rachel, MS, CF-SLP · Co-founder").font(.headline)
                        Text("I'm a pediatric speech-language pathologist in my clinical fellowship.")
                            .font(.subheadline)
                    }
                }
            }
            Section("What would make Sona better?") {
                ForEach(topics, id: \.self) { topic in
                    Toggle(topic, isOn: Binding(get: { selected.contains(topic) }, set: { enabled in
                        if enabled { selected.insert(topic) } else { selected.remove(topic) }
                    }))
                }
                TextEditor(text: $note)
                    .frame(minHeight: 96)
                    .accessibilityLabel("Anything else? Optional.")
                TextField("Your email for a reply (optional)", text: $email)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                Text("We use your email only to reply.").font(.footnote).foregroundStyle(.secondary)
            }
            .disabled(sending)
            Section {
                Button(sending ? "Sending…" : "Send feedback") { Task { await send() } }
                    .disabled(sending || (selected.isEmpty && note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty))
                if !message.isEmpty { Text(message).font(.footnote) }
            }
        }
        .navigationTitle("Talk to us")
    }

    private func send() async {
        guard !sending else { return }
        sending = true
        defer { sending = false }
        do {
            try await FamilyLoginClient().sendFamilyFeedback(chips: topics.filter(selected.contains), text: note, email: email)
            selected.removeAll()
            note = ""
            message = "Thank you. Your message reached the Sona team."
        } catch {
            message = error.localizedDescription
        }
    }
}
