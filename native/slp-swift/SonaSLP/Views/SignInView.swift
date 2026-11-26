import SwiftUI

/// Sign in with the 6-digit code from the email (an emailed link opens in
/// Safari, which cannot sign an app in). The same two routes the web's
/// sign-in page uses: /api/slp/auth/request with wantCode, then /auth/code.
struct SignInView: View {
    @Environment(AppModel.self) private var model
    @State private var email = ""
    @State private var code = ""
    @State private var sent = false
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focus: Field?
    enum Field { case email, code }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 10) {
                    Image("Echo").resizable().scaledToFit().frame(width: 44, height: 44)
                    Text("Sona").font(.system(.title, design: .rounded, weight: .bold))
                    Text("for SLPs").font(.caption.weight(.semibold)).padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Color.sonaTeal.opacity(0.12), in: Capsule()).foregroundStyle(Color.sonaTeal)
                }
                .padding(.top, 40)

                if !sent {
                    Text("Sign in").font(.system(.largeTitle, design: .rounded, weight: .bold))
                    Text("Use the email your Sona account is under. We'll email you a 6-digit code.")
                        .foregroundStyle(Color.sonaMuted)
                    TextField("you@yourclinic.org", text: $email)
                        .textContentType(.emailAddress).keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                        .focused($focus, equals: .email).submitLabel(.send).onSubmit(send)
                        .padding(14).background(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.3)))
                    PrimaryButton(title: busy ? "Sending…" : "Email me a code", busy: busy, action: send)
                } else {
                    Text("Check your email").font(.system(.largeTitle, design: .rounded, weight: .bold))
                    Text("We sent a 6-digit code to \(email). Type it here.").foregroundStyle(Color.sonaMuted)
                    TextField("123456", text: $code)
                        .textContentType(.oneTimeCode).keyboardType(.numberPad)
                        .font(.system(.title, design: .monospaced, weight: .semibold))
                        .focused($focus, equals: .code)
                        .padding(14).background(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.3)))
                        .onChange(of: code) { _, v in
                            let d = v.filter(\.isNumber).prefix(6); if d != v { code = String(d) }
                            if d.count == 6 && !busy { verify() }
                        }
                    PrimaryButton(title: busy ? "Signing in…" : "Sign in", busy: busy, action: verify)
                    Button("Use a different email") { sent = false; code = ""; error = nil; focus = .email }
                        .font(.subheadline)
                }
                if let error { Text(error).font(.subheadline).foregroundStyle(.red) }
            }
            .padding(24)
        }
        .scrollDismissesKeyboard(.interactively)
        .onAppear { focus = .email }
    }

    private func send() {
        let e = email.trimmingCharacters(in: .whitespaces).lowercased()
        guard e.range(of: #"^[^@\s]+@[^@\s]+\.[^@\s]+$"#, options: .regularExpression) != nil else { error = "Enter a valid email."; return }
        busy = true; error = nil
        Task { @MainActor in
            defer { busy = false }
            do {
                _ = try await API.shared.call("api/slp/auth/request", method: "POST", body: ["email": e, "wantCode": true, "source": "slp-app"])
                email = e; sent = true; focus = .code
            } catch { self.error = error.localizedDescription }
        }
    }

    private func verify() {
        guard code.count == 6 else { error = "Type the 6-digit code from the email."; return }
        busy = true; error = nil
        Task { @MainActor in
            defer { busy = false }
            do {
                _ = try await API.shared.call("api/slp/auth/code", method: "POST", body: ["email": email, "code": code])
                await model.start()
            } catch { self.error = error.localizedDescription; code = "" }
        }
    }
}

struct PrimaryButton: View {
    let title: String
    var busy = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack {
                if busy { ProgressView().tint(.white) }
                Text(title).fontWeight(.semibold)
            }
                .frame(maxWidth: .infinity).padding(.vertical, 14)
        }
        .buttonStyle(.borderedProminent).tint(.sonaTeal).clipShape(RoundedRectangle(cornerRadius: 12))
        .disabled(busy)
    }
}

/// A new account picks its name, clinic and family code once (the web's
/// onboarding form, POST /api/slp/account).
struct ProfileSetupView: View {
    @Environment(AppModel.self) private var model
    @State private var name = ""
    @State private var clinic = ""
    @State private var code = ""
    @State private var codeTouched = false
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Your name", text: $name).textContentType(.name)
                        .onChange(of: name) { _, v in if !codeTouched { code = slug(v) } }
                    TextField("Clinic or school", text: $clinic).textContentType(.organizationName)
                } header: { Text("About you") }
                Section {
                    TextField("e.g. sarah-smith", text: Binding(get: { code }, set: { code = $0; codeTouched = true }))
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                } header: { Text("Your code") } footer: {
                    Text("It goes in every family link you share. Letters, numbers and dashes.")
                }
                if let error { Text(error).foregroundStyle(.red) }
                Button(busy ? "Saving…" : "Continue") { save() }.disabled(busy).fontWeight(.semibold)
                Button("Sign out", role: .destructive) { Task { await model.signOut() } }
            }
            .navigationTitle("Welcome")
        }
    }

    private func slug(_ s: String) -> String {
        let lower = s.lowercased().replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
        return String(lower.trimmingCharacters(in: CharacterSet(charactersIn: "-")).prefix(40))
    }

    private func save() {
        let c = slug(code)
        guard !c.isEmpty else { error = "Pick a short code."; return }
        busy = true; error = nil
        Task { @MainActor in
            defer { busy = false }
            do {
                _ = try await API.shared.call("api/slp/account", method: "POST", body: ["name": name.trimmingCharacters(in: .whitespaces), "clinic": clinic.trimmingCharacters(in: .whitespaces), "code": c])
                await model.start()
            } catch { self.error = error.localizedDescription }
        }
    }
}

/// An account with no Sona Pro. The clinicians' app may not say how to buy
/// (App Store rule 3.1.1), so: the fact, Sign out, and Delete my account.
struct LockedView: View {
    @Environment(AppModel.self) private var model
    @State private var deleting = false

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            Image("Echo").resizable().scaledToFit().frame(width: 96, height: 96)
            Text("Your account doesn't have Sona Pro yet.")
                .font(.system(.title2, design: .rounded, weight: .bold)).multilineTextAlignment(.center)
            Text("Sona Pro opens the dashboard, every game for you, and every game for families on your link.")
                .foregroundStyle(Color.sonaMuted).multilineTextAlignment(.center)
            Spacer()
            Button("Check again") { Task { await model.load() } }.buttonStyle(.bordered)
            Button("Sign out") { Task { await model.signOut() } }
            Button("Delete my account", role: .destructive) { deleting = true }.font(.footnote)
        }
        .padding(28)
        .sheet(isPresented: $deleting) { DeleteAccountView() }
    }
}
