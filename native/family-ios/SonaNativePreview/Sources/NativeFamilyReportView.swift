import SwiftUI

struct NativeFamilyReportView: View {
    @ObservedObject var store: NativeFamilyReportStore
    var premium = false
    @Environment(\.scenePhase) private var scenePhase
    @FocusState private var emailFocused: Bool
    @State private var email = ""
    @State private var editedEmail = false
    @State private var switchLocked = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Weekly progress report").font(.headline).accessibilityIdentifier("native-report-title")
            if !store.deliveryConnected {
                Text("This preview saves the setting on this phone. Delivery is off.").font(.footnote)
            }
            if let status = store.status {
                if status.on { enabledReport(status) }
                else {
                    if status.can { signup }
                    if status.owed {
                        Text("Turned off on this phone.").font(.footnote)
                        if store.deliveryConnected {
                            Text("Sona will finish this the next time it’s online.").font(.footnote)
                            Button("Try again") { Task { await store.sync(trigger: .settingsVisit) } }
                                .disabled(store.busy).accessibilityIdentifier("native-report-retry")
                        }
                    }
                }
            }
            if store.busy { ProgressView().accessibilityLabel("Updating weekly report") }
            if let error = store.error { Text(error).font(.footnote).accessibilityIdentifier("native-report-error") }
        }
        .task { await store.settingsAppeared() }
        .onChange(of: scenePhase) { phase in
            if phase == .active { Task { await store.settingsAppeared() } }
        }
        .onReceive(store.$status) { status in
            guard let status else { return }
            if status.on { editedEmail = false }
            else if !editedEmail { email = status.suggestedEmail }
        }
    }

    private var signup: some View {
        Group {
            Text("Every Monday, an email with last week’s practice: how many days, how many reps and which sounds. Never your child’s name or voice.")
                .font(.footnote)
            TextField("Grown-up’s email", text: Binding(
                get: { email }, set: { email = $0; editedEmail = true }
            ))
            .keyboardType(.emailAddress)
            .textContentType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .focused($emailFocused)
            .privacySensitive()
            .accessibilityIdentifier("native-report-email")
            .submitLabel(.go)
            .onSubmit(turnOn)
            Text("We’ll also send occasional tips from Rachel. Unsubscribe anytime.").font(.footnote)
            Button("Turn on", action: turnOn)
                .disabled(switchLocked)
                .accessibilityIdentifier("native-report-on")
        }
    }

    @ViewBuilder private func enabledReport(_ status: NativeFamilyReportStatus) -> some View {
        if !store.deliveryConnected {
            Text("Saved on this phone for \(status.email).").privacySensitive()
        } else if status.off {
            Text("This email unsubscribed from Sona’s emails. Reply to one to get them back.").font(.footnote)
        } else if status.pending {
            Text("Check \(status.email) for Sona’s link and tap it to start. No email? Look in spam. Unsubscribed from Sona’s emails? Reply to one to get them back.")
                .font(.footnote).privacySensitive()
        } else if status.sent {
            Text("On. It goes to \(status.email) every Monday.").privacySensitive()
        } else {
            Text("Saved on this phone. Sona will request the confirmation link when it’s online.").font(.footnote)
        }
        Button("Turn off") { changeSwitch { await store.turnOff() } }
            .disabled(switchLocked).accessibilityIdentifier("native-report-off")
        if store.deliveryConnected {
            Button(status.sent ? "Check status" : "Try again") { Task { await store.sync(trigger: .settings) } }
                .disabled(store.busy).accessibilityIdentifier("native-report-check")
        }
    }

    private func turnOn() {
        let address = email
        changeSwitch {
            emailFocused = false
            await store.turnOn(email: address, premium: premium)
            if store.status?.on == false, store.error != nil { emailFocused = true }
        }
    }

    private func changeSwitch(_ change: @escaping @MainActor () async -> Void) {
        guard !switchLocked else { return }
        switchLocked = true
        Task {
            try? await Task.sleep(nanoseconds: 600_000_000)
            switchLocked = false
        }
        Task { await change() }
    }
}
