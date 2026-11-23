#if os(iOS)
import SwiftUI

/// Uses the existing parent gate; no deep-link or child screen constructs it.
struct FamilyEmailRestoreView: View {
    @ObservedObject var store: FamilyEmailRestoreStore
    @State private var email = ""
    var body: some View {
        DisclosureGroup("Already paid on speaksona.com?") {
            VStack(alignment: .leading, spacing: 12) {
                Text("Restore your website subscription with the email you subscribed with.")
                    .font(.subheadline).foregroundStyle(.secondary)
                TextField("Email you subscribed with", text: $email)
                    .keyboardType(.emailAddress).textContentType(.emailAddress)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder).privacySensitive()
                    .disabled(store.busy || store.needsSaveRetry)
                    .accessibilityIdentifier("family-website-restore-email")
                if store.needsSaveRetry {
                    Button("Try saving again") { Task { await store.retrySave() } }
                        .disabled(store.busy).accessibilityIdentifier("family-website-restore-save")
                } else {
                    Button { Task { await store.restore(email: email) } } label: {
                        HStack {
                            if store.busy { ProgressView() }
                            Text("Restore access")
                        }.frame(minHeight: 44)
                    }.disabled(!store.canRestore).accessibilityIdentifier("family-website-restore-submit")
                }
                if let notice = store.notice {
                    Text(notice.text).font(.subheadline).accessibilityIdentifier("family-website-restore-status")
                }
            }.padding(.top, 10)
        }.accessibilityIdentifier("family-website-restore")
    }
}
#endif
