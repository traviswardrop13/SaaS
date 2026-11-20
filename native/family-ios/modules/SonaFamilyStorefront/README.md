# Native family storefront

This SDK-free package connects the existing `FamilyPurchaseContinuity` purchase coordinator and `FamilyStoreCompatibility` offer policy to a native Grown-ups screen. It is separate from the production purchase SDK, so the ordinary preview can build without downloading RevenueCat. No price, trial duration, offer membership, transaction, or eligibility answer is invented by the UI.

## Host integration

Link local product `SonaFamilyStorefront`. Present `FamilyStorefrontView(store:)` only after the existing Grown-ups check. Create one long-lived store for the selected migrated household/origin; never construct it per child or use a child's name as an identity.

```swift
let config = try FamilyAccessConfiguration.bundled()
let store = FamilyStorefrontStore(
    configuration: config,
    initialAccess: householdEntitlements,
    client: nil, // Separate preview: zero purchase SDK calls, no displayed prices.
    persistAppleAccess: { patch in
        // Capture the intended household/origin, read its LATEST access state,
        // apply this Apple-only patch, then durably commit that state.
        // Throw if the commit fails; do not show purchase success before it saves.
        try await saveApplePatchForCapturedHousehold(patch)
    })
```

`FamilyAppleAccessUpdate` has `active`, `lastAuthoritativeRefresh`, and `applying(to:)`. It changes only Apple access; a nil refresh timestamp keeps the previous timestamp. Founder, free-era, founding-family, old subscription, Stripe, clinician coverage, old local trial, and free-version promises remain independent. If clinician or web answers arrive while the sheet is open, call `store.updateNonAppleAccess(latest)`.

For the SDK-enabled release target ONLY, add both `adapters/RevenueCatFamilyPurchaseClient.swift` and `adapters/RevenueCatFamilyStorefrontClient.swift`, link RevenueCat **exactly 5.80.3**, and supply `RevenueCatFamilyStorefrontClient(existingPublicAPIKey:)` instead of nil. Use the existing publishable iOS key from shipping configuration. Both the store and SDK client require actual `com.speaksona.app`; the SDK adapter additionally refuses a different project's key. Do not rename the preview bundle, add a new SDK user ID/defaults suite, log in/out, clear purchase caches, or configure another RevenueCat project to make this work. The new adapter composes the unchanged existing purchase adapter.

The public store initializer checks the actual process bundle. Its internal environment seam exists only for synthetic tests. No SDK is configured by either initializer. The preview never fetches products or customer information, presents Apple purchase/restore UI, or persists an Apple grant.

## Behavior

- Monthly is first/default, and its actual store product is required. Optional one-payment/yearly rows require current offering membership. The canonical annual sale switch controls its row; annual remains restorable regardless.
- Price, subscription period, introductory period and eligibility come from actual public RevenueCat `StoreProduct` fields. Both StoreKit1 and StoreKit2 products are supported; the former's SDK `productType` is a default, so subscription validation uses its public category plus exact period.
- Unknown introductory eligibility stays qualified. Paid/unreadable introductory charges and unexpected product periods are not sold. No payment/reminder promise is made from unknown eligibility.
- Ownership must answer before new offers are sold. The loading screen stops waiting visibly after four seconds; a late result cannot replace the timed-out card. Retry does not reclassify the release app as a no-purchase build.
- Restore is a deliberate parent's action. Empty Restore revokes nothing. An authoritative customer-info refresh can remove Apple alone; offline answers preserve grants/check clocks.
- Cancellation/pending results do not manufacture access. Pending/verification-pending blocks a second buy in this store. Returning to the foreground checks again; Restore remains available. Purchase/Restore success is presented only after the Apple-only state patch saves. Save retry never purchases again.
- A long-lived host should also refresh Apple access on appropriate app lifecycle events outside the storefront. Reuse this coordinator rather than creating competing Apple writers. Consent, existing parent-email/household attributes, server trial hooks, notification/reminder integration, and final release-account validation remain host work; this package sends no analytics or email and promises no reminder.

## Checks

```sh
swift test --package-path native/family-ios/modules/SonaFamilyStorefront
```

The focused suite has 16 synthetic tests, with no RevenueCat dependency or account calls. The optional `revenuecat-storefront-harness` uses actual locally built pinned SDK objects, with outbound networking denied. See its README for scope and commands. These passes are not a live purchase/restore, signed upgrade, or App Store submission certification.
