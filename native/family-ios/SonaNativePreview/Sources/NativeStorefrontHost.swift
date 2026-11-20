import SwiftUI
import SonaFamilyAccess
import SonaFamilyMigration
import SonaFamilyStorefront

/// Constructed only inside the existing parent gate. The review build has no
/// RevenueCat dependency and cannot create a live store client.
struct NativeStorefrontHost: View {
    @StateObject private var store: FamilyStorefrontStore
    @ObservedObject private var records: NativeFamilyState
    private let origin: LegacyOrigin

    @MainActor
    init(records: NativeFamilyState, configuration: FamilyAccessConfiguration, origin: LegacyOrigin) {
        self.records = records
        self.origin = origin
        _store = StateObject(wrappedValue: FamilyStorefrontStore(
            configuration: configuration, initialAccess: records.entitlement(for: origin),
            client: Self.makeClient(),
            readAppleRevision: { try await records.appleAccessRevision(for: origin) },
            persistAppleAccess: { patch in
                try await records.recordAppleAccess(active: patch.active, checkedAt: patch.lastAuthoritativeRefresh,
                                                    origin: origin, source: patch.source)
            }
        ))
    }

    var body: some View {
        FamilyStorefrontView(store: store)
            .onChange(of: records.entitlement(for: origin)) { state in store.updateAccess(state) }
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
