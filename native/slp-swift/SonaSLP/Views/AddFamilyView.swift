import SwiftUI
import UIKit
import MessageUI

/// Add a family (the web's top-bar button): the parent's email, and only if
/// given, initials, an age and up to three sounds. Never a child's name.
/// POST /api/slp/family makes the invite and the login and emails it once;
/// the password shows here once, with Copy and Text.
struct AddFamilyView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var label = ""
    @State private var age = ""
    @State private var sounds: [String] = []
    @State private var busy = false
    @State private var error: String?
    @State private var made: Made?
    @State private var texting = false

    struct Made { let user: String; let password: String; let emailed: Bool; let emailError: String?; let message: String }

    static let appStore = "https://apps.apple.com/us/app/sona-speech/id6785755867"

    var body: some View {
        NavigationStack {
            Form {
                if let made { done(made) } else { form }
            }
            .navigationTitle("Add a family")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(made == nil ? "Cancel" : "Done") { dismiss() } } }
            .sheet(isPresented: $texting) { if let made { MessageSheet(body: made.message) } }
        }
    }

    @ViewBuilder private var form: some View {
        Section {
            TextField("parent@email.com", text: $email)
                .keyboardType(.emailAddress).textContentType(.emailAddress)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
        } header: { Text("Parent's email") } footer: {
            Text("We email them a username and password for the Sona app.")
        }
        Section {
            TextField("Initials or a nickname (optional)", text: $label)
            Picker("Age (optional)", selection: $age) {
                Text("—").tag("")
                ForEach(3...12, id: \.self) { Text("\($0)").tag(String($0)) }
            }
        } footer: { Text("Initials only. Never a child's full name.") }
        Section {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 5), spacing: 6) {
                ForEach(ALL_SOUNDS, id: \.self) { s in
                    let on = sounds.contains(s)
                    Button(soundLabel(s)) {
                        if on { sounds.removeAll { $0 == s } } else if sounds.count < 3 { sounds.append(s) }
                    }
                    .font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity, minHeight: 36)
                    .background(on ? Color.sonaTeal : Color.gray.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                    .foregroundStyle(on ? .white : .primary)
                    .buttonStyle(.plain)
                }
            }
        } header: { Text("Target sound (optional, up to 3)") }
        if let error { Section { Text(error).foregroundStyle(.red) } }
        Section { PrimaryButton(title: busy ? "Creating the login…" : "Create login and email it", busy: busy, action: create) }
            .listRowBackground(Color.clear).listRowInsets(EdgeInsets())
    }

    @ViewBuilder private func done(_ m: Made) -> some View {
        Section {
            Label(m.emailed ? "Sent to \(email)" : (m.emailError ?? "The email didn't go through."), systemImage: m.emailed ? "checkmark.circle.fill" : "exclamationmark.triangle")
                .foregroundStyle(m.emailed ? Color.sonaTeal : .orange)
        }
        Section {
            LabeledContent("Username") { Text(m.user).font(.title3.monospaced().weight(.semibold)).textSelection(.enabled) }
            LabeledContent("Password") { Text(m.password).font(.title3.monospaced().weight(.semibold)).textSelection(.enabled) }
        } footer: { Text("This password shows only now. You can make a new one from the dashboard on the web.") }
        Section {
            Button("Copy message") { UIPasteboard.general.string = m.message }
            if MFMessageComposeViewController.canSendText() { Button("Text it") { texting = true } }
            ShareLink("Share…", item: m.message)
        }
        Section {
            Button("Add another family") { made = nil; email = ""; label = ""; age = ""; sounds = []; error = nil }
        }
    }

    private func create() {
        let e = email.trimmingCharacters(in: .whitespaces)
        guard !e.isEmpty else { error = "Add the parent's email."; return }
        guard e.count <= 254, e.range(of: #"^[^@\s]+@[^@\s]+\.[^@\s]+$"#, options: .regularExpression) != nil else {
            error = "That email doesn't look right. Check it and try again."; return
        }
        var payload: [String: Any] = ["parentEmail": e]
        let l = label.trimmingCharacters(in: .whitespaces)
        if !l.isEmpty { payload["label"] = String(l.prefix(40)) }
        if !age.isEmpty { payload["age"] = age }
        if !sounds.isEmpty { payload["sounds"] = sounds }
        busy = true; error = nil
        Task { @MainActor in
            defer { busy = false }
            do {
                let j = try await API.shared.call("api/slp/family", method: "POST", body: payload)
                let user = j["user"] as? String ?? "", pass = j["password"] as? String ?? "", link = j["link"] as? String ?? ""
                let msg = Self.message(user: user, pass: pass, link: link, covered: j["covered"] as? Bool == true)
                made = Made(user: user, password: pass, emailed: j["emailed"] as? Bool == true, emailError: j["emailError"] as? String, message: msg)
                await model.load()
            } catch { self.error = error.localizedDescription }
        }
    }

    /// The web's loginMsg() + famMessage(), word for word.
    static func message(user: String, pass: String, link: String, covered: Bool) -> String {
        let offer = covered
            ? "It's free for your family, and Premium is included through me, so your child gets every game."
            : "It's free for your family: daily practice and free games."
        return "Hi! Here's your login for Sona, the speech-practice app I mentioned. \(offer)\n\n1. Get Sona for iPhone or iPad:\n\(appStore)\n2. Open it and tap Log in on the first screen.\n3. Username: \(user)\n   Password: \(pass)\n\nThen say yes to sharing practice with me, and your child can start today. You can change the password in Sona's Settings.\n\nNo iPhone or iPad? Start here instead:\n\(link)"
    }
}

struct MessageSheet: UIViewControllerRepresentable {
    let body: String
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIViewController(context: Context) -> MFMessageComposeViewController {
        let vc = MFMessageComposeViewController(); vc.body = body; vc.messageComposeDelegate = context.coordinator; return vc
    }
    func updateUIViewController(_ vc: MFMessageComposeViewController, context: Context) {}
    final class Coordinator: NSObject, MFMessageComposeViewControllerDelegate {
        func messageComposeViewController(_ c: MFMessageComposeViewController, didFinishWith result: MessageComposeResult) { c.dismiss(animated: true) }
    }
}
