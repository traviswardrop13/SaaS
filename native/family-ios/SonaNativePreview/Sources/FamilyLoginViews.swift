import SwiftUI

@MainActor
struct FamilyLoginView: View {
    let onLogin: (String, String) async throws -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var username = ""
    @State private var password = ""
    @State private var busy = false
    @State private var errorMessage: String?
    @State private var request: Task<Void, Never>?
    @FocusState private var focus: LoginField?
    private enum LoginField { case username, password }

    var body: some View {
        FamilyFormShell(
            title: "Log in",
            message: "Type the username and password your speech therapist gave you.",
            symbol: "key.fill", busy: busy
        ) {
            VStack(alignment: .leading, spacing: 18) {
                FamilyFieldLabel("Username") {
                    TextField("e.g. otter4827", text: $username)
                        .textContentType(.username)
                        .keyboardType(.asciiCapable)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.next)
                        .focused($focus, equals: .username)
                        .onSubmit { focus = .password }
                        .privacySensitive()
                        .accessibilityIdentifier("family-username")
                }

                FamilyFieldLabel("Password") {
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.go)
                        .focused($focus, equals: .password)
                        .onSubmit(submit)
                        .privacySensitive()
                        .accessibilityIdentifier("family-password")
                }

                if let errorMessage {
                    FamilyFormError(message: errorMessage, identifier: "family-login-error")
                }

                FamilySubmitButton(title: busy ? "Checking…" : "Log in", busy: busy, action: submit)
                    .accessibilityIdentifier("family-login-submit")
            }
            .disabled(busy)
        }
        .interactiveDismissDisabled(busy)
        .onDisappear {
            request?.cancel()
            password = ""
        }
    }

    private func submit() {
        guard !busy else { return }
        let user = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !user.isEmpty, !password.isEmpty else {
            errorMessage = "Type both, just as your speech therapist wrote them."
            focus = user.isEmpty ? .username : .password
            return
        }
        focus = nil
        errorMessage = nil
        busy = true
        // Passwords are passed exactly as typed. The server owns whether a
        // generated password forgives formatting; a parent's own one is exact.
        let suppliedPassword = password
        request = Task { @MainActor in
            defer { busy = false }
            do {
                try await onLogin(user, suppliedPassword)
                guard !Task.isCancelled else { return }
                password = ""
                dismiss()
            } catch is CancellationError {
                // Leaving this screen is not a failed login.
            } catch {
                guard !Task.isCancelled else { return }
                errorMessage = error.localizedDescription
            }
        }
    }
}

@MainActor
struct FamilyConsentView: View {
    let clinicianName: String
    let hasCoverage: Bool
    let onChoose: (Bool) async throws -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var choosing: Bool?
    @State private var errorMessage: String?
    @State private var request: Task<Void, Never>?

    private var therapist: String {
        let name = clinicianName.trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? "your child's speech therapist" : name
    }

    // Exact consent disclosure from public/join.html askConsent(). Logging
    // in and receiving access never stand in for this separate choice.
    private var disclosure: String {
        "If you say yes, " + therapist + " will see your child's first name and age as you entered them, "
        + "which sounds they are practicing, practice days and how many tries each day, and a rough pass rate per sound. "
        + "They can also send practice assignments and a short note to this app. Never any audio: it is never uploaded or saved. "
        + "You can stop any time, and stopping deletes everything they could see. Saying no changes nothing; Sona stays free for you."
    }

    var body: some View {
        FamilyFormShell(
            title: "Share progress with your therapist?",
            message: hasCoverage ? "Daily practice is free, with every game in Sona Premium included." : nil,
            symbol: "person.2.fill", busy: choosing != nil,
            allowsCancel: false
        ) {
            VStack(alignment: .leading, spacing: 22) {
                Text(disclosure)
                    .font(.system(.body, design: .rounded))
                    .foregroundStyle(FamilyFormColors.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .privacySensitive()
                    .accessibilityIdentifier("family-consent-disclosure")

                if let errorMessage {
                    FamilyFormError(message: errorMessage, identifier: "family-consent-error")
                }

                VStack(spacing: 12) {
                    FamilySubmitButton(
                        title: choosing == true ? "Saving…" : "Yes, share progress",
                        busy: choosing == true
                    ) { choose(true) }
                    .accessibilityIdentifier("family-consent-yes")

                    Button { choose(false) } label: {
                        HStack(spacing: 10) {
                            if choosing == false { ProgressView().tint(FamilyFormColors.ink) }
                            Text(choosing == false ? "Saving…" : "No thanks — just use Sona")
                                .multilineTextAlignment(.center)
                        }
                        .font(.system(.body, design: .rounded, weight: .bold))
                        .foregroundStyle(FamilyFormColors.ink)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(.white, in: RoundedRectangle(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(FamilyFormColors.line))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("family-consent-no")
                }
                .disabled(choosing != nil)
            }
        }
        // An explicit yes or no, rather than closing the sheet, settles this
        // question. Both paths await the store, and either can be retried.
        .interactiveDismissDisabled(true)
        .onDisappear { request?.cancel() }
    }

    private func choose(_ answer: Bool) {
        guard choosing == nil else { return }
        choosing = answer
        errorMessage = nil
        request = Task { @MainActor in
            defer { choosing = nil }
            do {
                try await onChoose(answer)
                guard !Task.isCancelled else { return }
                dismiss()
            } catch is CancellationError {
            } catch {
                guard !Task.isCancelled else { return }
                errorMessage = error.localizedDescription
            }
        }
    }
}

@MainActor
struct FamilyChangePasswordView: View {
    let onChangePassword: (String, String) async throws -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmation = ""
    @State private var busy = false
    @State private var errorMessage: String?
    @State private var request: Task<Void, Never>?
    @FocusState private var focus: PasswordField?
    private enum PasswordField { case current, new, confirmation }

    var body: some View {
        FamilyFormShell(title: "Change password", message: nil, symbol: "lock.fill", busy: busy) {
            VStack(alignment: .leading, spacing: 18) {
                FamilyFieldLabel("Current password") {
                    SecureField("Current password", text: $currentPassword)
                        .textContentType(.password)
                        .focused($focus, equals: .current)
                        .onSubmit { focus = .new }
                        .submitLabel(.next)
                        .accessibilityIdentifier("family-password-current")
                }

                FamilyFieldLabel("New password") {
                    SecureField("At least 8 characters", text: $newPassword)
                        .textContentType(.newPassword)
                        .focused($focus, equals: .new)
                        .onSubmit { focus = .confirmation }
                        .submitLabel(.next)
                        .accessibilityIdentifier("family-password-new")
                }

                FamilyFieldLabel("Confirm new password") {
                    SecureField("Confirm new password", text: $confirmation)
                        .textContentType(.newPassword)
                        .focused($focus, equals: .confirmation)
                        .onSubmit(submit)
                        .submitLabel(.done)
                        .accessibilityIdentifier("family-password-confirmation")
                }

                if let errorMessage {
                    FamilyFormError(message: errorMessage, identifier: "family-password-error")
                }

                FamilySubmitButton(title: busy ? "Saving…" : "Save new password", busy: busy, action: submit)
                    .accessibilityIdentifier("family-password-submit")
            }
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .privacySensitive()
            .disabled(busy)
        }
        .interactiveDismissDisabled(busy)
        .onDisappear {
            request?.cancel()
            clearPasswords()
        }
    }

    private func submit() {
        guard !busy else { return }
        guard !currentPassword.isEmpty else {
            errorMessage = "Type your current password."
            focus = .current
            return
        }
        guard newPassword.utf16.count >= 8 else {
            errorMessage = "Use at least 8 characters."
            focus = .new
            return
        }
        guard newPassword == confirmation else {
            errorMessage = "The new passwords don't match."
            focus = .confirmation
            return
        }
        errorMessage = nil
        focus = nil
        busy = true
        let current = currentPassword, next = newPassword
        request = Task { @MainActor in
            defer { busy = false }
            do {
                try await onChangePassword(current, next)
                guard !Task.isCancelled else { return }
                clearPasswords()
                dismiss()
            } catch is CancellationError {
            } catch {
                guard !Task.isCancelled else { return }
                errorMessage = error.localizedDescription
            }
        }
    }

    private func clearPasswords() {
        currentPassword = ""
        newPassword = ""
        confirmation = ""
    }
}

private enum FamilyFormColors {
    static let paper = Color(red: 1, green: 0.969, blue: 0.933)
    static let ink = Color(red: 0.153, green: 0.137, blue: 0.216)
    static let secondary = Color(red: 0.40, green: 0.37, blue: 0.43)
    static let teal = Color(red: 0.067, green: 0.498, blue: 0.518)
    static let line = Color(red: 0.83, green: 0.82, blue: 0.78)
    static let error = Color(red: 0.67, green: 0.12, blue: 0.12)
}

private struct FamilyFormShell<Content: View>: View {
    let title: String
    let message: String?
    let symbol: String
    let busy: Bool
    var allowsCancel = true
    @ViewBuilder let content: () -> Content
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Image(systemName: symbol)
                        .font(.system(size: 25, weight: .semibold))
                        .foregroundStyle(FamilyFormColors.teal)
                        .frame(width: 62, height: 62)
                        .background(FamilyFormColors.teal.opacity(0.10), in: RoundedRectangle(cornerRadius: 20))
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: 12) {
                        Text(title)
                            .font(.system(.largeTitle, design: .rounded, weight: .bold))
                            .foregroundStyle(FamilyFormColors.ink)
                            .accessibilityAddTraits(.isHeader)
                        if let message {
                            Text(message)
                                .font(.system(.body, design: .rounded))
                                .foregroundStyle(FamilyFormColors.secondary)
                        }
                    }
                    .fixedSize(horizontal: false, vertical: true)

                    content()
                }
                .padding(24)
                .frame(maxWidth: 540)
                .frame(maxWidth: .infinity, alignment: .top)
            }
            .background(FamilyFormColors.paper)
            .navigationTitle("Sona")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if allowsCancel {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                            .disabled(busy)
                    }
                }
            }
            .tint(FamilyFormColors.teal)
        }
    }
}

private struct FamilyFieldLabel<Field: View>: View {
    let title: String
    @ViewBuilder let field: () -> Field

    init(_ title: String, @ViewBuilder field: @escaping () -> Field) {
        self.title = title
        self.field = field
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(.subheadline, design: .rounded, weight: .bold))
                .foregroundStyle(FamilyFormColors.ink)
            field()
                .font(.system(.body, design: .rounded))
                .foregroundStyle(FamilyFormColors.ink)
                .padding(.horizontal, 15)
                .padding(.vertical, 15)
                .frame(minHeight: 52)
                .background(.white, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(FamilyFormColors.line))
                .accessibilityLabel(title)
        }
    }
}

private struct FamilySubmitButton: View {
    let title: String
    let busy: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if busy { ProgressView().tint(.white).accessibilityHidden(true) }
                Text(title).multilineTextAlignment(.center)
            }
            .font(.system(.body, design: .rounded, weight: .bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 18)
            .padding(.vertical, 15)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(FamilyFormColors.teal, in: RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .disabled(busy)
    }
}

private struct FamilyFormError: View {
    let message: String
    let identifier: String

    var body: some View {
        Label {
            Text(message).fixedSize(horizontal: false, vertical: true)
        } icon: {
            Image(systemName: "exclamationmark.circle.fill")
        }
        .font(.system(.subheadline, design: .rounded))
        .foregroundStyle(FamilyFormColors.error)
        .accessibilityIdentifier(identifier)
    }
}
