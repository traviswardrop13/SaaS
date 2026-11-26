import SwiftUI
import SonaFamilyAccess
import SonaFamilyMigration
import SonaFamilyStorefront

/// Apple pricing is shared with setup and locked content. Only the existing
/// Grown-ups Settings route enables website subscription Restore.
struct NativeStorefrontHost: View {
    @StateObject private var store: FamilyStorefrontStore
    @StateObject private var websiteRestore: FamilyEmailRestoreStore
    @ObservedObject private var records: NativeFamilyState
    private let origin: LegacyOrigin
    private let allowsWebsiteRestore: Bool
    private let reminders: NativeTrialReminderStore?
    private let headline: String

    @MainActor
    init(records: NativeFamilyState, configuration: FamilyAccessConfiguration, origin: LegacyOrigin, allowsWebsiteRestore: Bool = false, reminders: NativeTrialReminderStore? = nil, childName: String? = nil) {
        // The offer names the child when the family gave a name; never "Player 2".
        let name = childName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        self.headline = name.isEmpty ? "Unlock every game" : "Unlock every game for \(name)"
        self.records = records
        self.reminders = reminders
        self.origin = origin
        self.allowsWebsiteRestore = allowsWebsiteRestore
        _websiteRestore = StateObject(wrappedValue: records.websiteRestoreStore(for: origin))
        _store = StateObject(wrappedValue: FamilyStorefrontStore(
            configuration: configuration, initialAccess: records.entitlement(for: origin),
            client: Self.makeClient(),
            readAppleRevision: { try await records.appleAccessRevision(for: origin) },
            onReminderEvent: { event in reminders?.receiveStorefront(event) },
            persistAppleAccess: { patch in
                try await records.recordAppleAccess(active: patch.active, checkedAt: patch.lastAuthoritativeRefresh,
                                                    origin: origin, source: patch.source)
            }
        ))
    }

    var body: some View {
        Group {
            if let reminders {
                NativeReminderStorefrontContent(store: store, websiteRestore: allowsWebsiteRestore ? websiteRestore : nil, headline: headline, reminders: reminders)
            } else {
                FamilyStorefrontView(store: store, websiteRestore: allowsWebsiteRestore ? websiteRestore : nil, headline: headline)
            }
        }.onChange(of: records.entitlement(for: origin)) { state in store.updateAccess(state) }
    }

    static var canSell: Bool {
        #if canImport(RevenueCat)
        Bundle.main.bundleIdentifier == "com.speaksona.app" && publicKey != nil
        #else
        false
        #endif
    }

    private static var publicKey: String? {
        let key = Bundle.main.object(forInfoDictionaryKey: "SonaRevenueCatPublicKey") as? String
        return key?.hasPrefix("appl_") == true ? key : nil
    }

    static func makeClient() -> (any FamilyStorefrontClient)? {
        #if canImport(RevenueCat)
        guard canSell, let publicKey else { return nil }
        return RevenueCatFamilyStorefrontClient(existingPublicAPIKey: publicKey)
        #else
        return nil
        #endif
    }
}

private struct NativeReminderStorefrontContent: View {
    let store: FamilyStorefrontStore
    let websiteRestore: FamilyEmailRestoreStore?
    let headline: String
    @ObservedObject var reminders: NativeTrialReminderStore
    var body: some View {
        FamilyStorefrontView(store: store, websiteRestore: websiteRestore, headline: headline,
            reminderOn: { reminders.canPromiseTrialReminder(for: $0) })
            .task {
                _ = await reminders.refreshAuthorization()
                _ = await reminders.syncIfDue(context: .nonHome)
            }
    }
}
