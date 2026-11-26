import SwiftUI

/// Settings: who is signed in, Talk to the team, Sign out, Delete my account.
/// Nothing here sells (no plan, price or billing in the clinicians' app).
struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Binding var chatOpen: Bool
    @State private var deleting = false

    var body: some View {
        NavigationStack {
            List {
                Section("Signed in as") {
                    if let n = model.me?.name, !n.isEmpty { Text(n).font(.headline) }
                    Text(model.me?.email ?? "").foregroundStyle(Color.sonaMuted)
                    if let c = model.me?.clinic, !c.isEmpty { LabeledContent("Clinic", value: c) }
                    if let c = model.me?.code, !c.isEmpty { LabeledContent("Your code", value: c) }
                }
                Section {
                    Button { chatOpen = true } label: { Label("Message the Sona team", systemImage: "bubble.left.and.text.bubble.right") }
                } footer: { Text("Homework, archiving and session games are on the dashboard on your computer.") }
                Section {
                    Link("Privacy", destination: URL(string: "https://app.speaksona.com/privacy.html")!)
                    Link("Terms", destination: URL(string: "https://app.speaksona.com/terms")!)
                }
                Section {
                    Button("Sign out") { Task { await model.signOut() } }
                    Button("Delete my account", role: .destructive) { deleting = true }
                }
            }
            .navigationTitle("Settings")
            .toolbar { ToolbarItem(placement: .topBarLeading) { ChatButton(open: $chatOpen) } }
            .sheet(isPresented: $deleting) { DeleteAccountView() }
        }
    }
}

/// Apple requires deleting an account from inside the app. The web's rule:
/// type your email back; refused while a paid plan still renews (the
/// server's words say so). DELETE /api/slp/account.
struct DeleteAccountView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var typed = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("This deletes your account, your caseload, homework, notes, invites and family logins, for good. Families keep the Sona app and their own practice on their phones.")
                }
                Section {
                    TextField(model.me?.email ?? "your email", text: $typed)
                        .keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                } header: { Text("Type your account's email to confirm") }
                if let error { Text(error).foregroundStyle(.red) }
                Button(busy ? "Deleting…" : "Delete for good", role: .destructive) { delete() }.disabled(busy || typed.isEmpty)
            }
            .navigationTitle("Delete my account").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }

    private func delete() {
        busy = true; error = nil
        Task { @MainActor in
            defer { busy = false }
            do {
                _ = try await API.shared.call("api/slp/account", method: "DELETE", body: ["confirm": typed.trimmingCharacters(in: .whitespaces).lowercased()])
                dismiss(); await model.signOut()
            } catch { self.error = error.localizedDescription }
        }
    }
}

/// The chat (CHAT1): Help / Idea / Problem and a plain text box. The mic is
/// the keyboard's own dictation key; the app never listens itself.
/// POST /api/slp/feedback, the same inbox as the web's chat button.
struct ChatView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var category = "question"
    @State private var text = ""
    @State private var busy = false
    @State private var status: String?
    @State private var sent = false
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                Text("We read every message and reply by email.").foregroundStyle(Color.sonaMuted)
                Picker("About", selection: $category) {
                    Text("Help").tag("question"); Text("Idea").tag("feature"); Text("Problem").tag("bug")
                }.pickerStyle(.segmented)
                TextEditor(text: $text)
                    .focused($focused).frame(minHeight: 160)
                    .padding(8).background(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.3)))
                    .overlay(alignment: .topLeading) {
                        if text.isEmpty { Text("Type here, or tap the mic on your keyboard and talk.").foregroundStyle(.tertiary).padding(16).allowsHitTesting(false) }
                    }
                Label("Rather talk? Tap the microphone on your keyboard and speak. It types for you. Please leave out children's names.", systemImage: "mic")
                    .font(.caption).foregroundStyle(Color.sonaMuted)
                if let status { Text(status).font(.subheadline).foregroundStyle(sent ? Color.sonaTeal : .red) }
                PrimaryButton(title: busy ? "Sending…" : "Send", busy: busy, action: send)
                Spacer()
            }
            .padding(20)
            .navigationTitle("Message the Sona team").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
            .onAppear { focused = true }
        }
        .presentationDetents([.large])
    }

    private func send() {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { status = "Write or say a message first."; sent = false; return }
        busy = true; status = "Sending…"
        Task { @MainActor in
            defer { busy = false }
            do {
                _ = try await API.shared.call("api/slp/feedback", method: "POST", body: ["kind": "feedback", "category": category, "text": String(t.prefix(2000))])
                text = ""; sent = true; status = "Sent. Thank you! We'll reply by email."
            } catch { sent = false; status = error.localizedDescription }
        }
    }
}
