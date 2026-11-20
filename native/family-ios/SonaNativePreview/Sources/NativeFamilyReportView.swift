import SwiftUI

struct NativeFamilyReportView: View {
    @ObservedObject var store: NativeFamilyReportStore
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Weekly progress report").font(.headline).accessibilityIdentifier("native-report-title")
            if !store.deliveryConnected {
                if let status = store.status, status.on {
                    Text("Saved on this phone: on for \(status.email).")
                    Text("This preview keeps your saved settings. It does not send weekly reports.").font(.footnote)
                    Button("Turn off saved setting") { Task { await store.turnOff() } }
                        .accessibilityIdentifier("native-report-off")
                } else {
                    Text("Saved on this phone: off.")
                    if store.status?.owed == true {
                        Text("Your request to turn off the report is saved on this phone. It has not been sent.").font(.footnote)
                    }
                }
            } else if let status = store.status, status.on {
                Text("On. It goes to \(status.email) every Monday.")
                if status.off {
                    Text("This email unsubscribed from Sona’s emails. Reply to one to get them back.").font(.footnote)
                } else if status.pending || !status.sent {
                    Text("Check your email: tap the link we sent to start it. No email? Look in spam. Unsubscribed from Sona’s emails? Reply to one to get them back.").font(.footnote)
                }
                Button("Turn off") { Task { await store.turnOff() } }.accessibilityIdentifier("native-report-off")
                Button("Check status") { Task { await store.sync(trigger: .settings) } }
                    .disabled(store.busy).accessibilityIdentifier("native-report-check")
            } else {
                Text("Off on this phone.")
                if store.status?.owed == true {
                    Text("Turned off. Sona will send this request when practice resumes online or when you tap Try again.").font(.footnote)
                    Button("Try again") { Task { await store.sync(trigger: .settings) } }
                        .disabled(store.busy).accessibilityIdentifier("native-report-retry")
                }
            }
            if store.busy { ProgressView().accessibilityLabel("Updating weekly report") }
            if let error = store.error { Text(error).font(.footnote).accessibilityIdentifier("native-report-error") }
        }.task { await store.refresh() }
    }
}
