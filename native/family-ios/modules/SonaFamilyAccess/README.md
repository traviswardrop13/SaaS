# Native family access compatibility

Pure Swift rules and store-answer parsing for the separate native rebuild. No purchase, restore, network call, tracking, price UI, audio, or source-data write runs in this module.

`Resources/FamilyAccessCatalog.json` is generated from the current `public/sona.js`. It contains both pricing switches, catalog tiers/parking, free-book titles, story keys, restore product IDs, sale flags, and existing clock bounds. It contains no hand-typed storefront price or introductory-offer eligibility.

```sh
node native/family-ios/tools/export-family-access.mjs --check
swift test --package-path native/family-ios/modules/SonaFamilyAccess
```

## Integration

1. Link the local `SonaFamilyAccess` package. Load `FamilyAccessConfiguration.bundled()`; an unreadable catalog is a build/configuration error, not a reason to guess access or prices.
2. After verified same-device migration, derive access from `FamilyEntitlementState.legacy(origin.evaluatingLegacyPromises(), configuration: config)`. This reuses `SonaFamilyMigration.LegacyPromiseCompatibility`; it does not duplicate the five sweeps. Keep origins separate. Ordinary family backup JSON must never enter this trusted path. Persist derived state only with the host's verified native-data transaction; leave captured web state untouched.
3. Use `FamilyAccessPolicy` for practice, each catalog game, books, and daily stories. `canSellHere` means the build has a functioning purchase integration, not that the latest product request happened to succeed. A failed product lookup must not silently reclassify a selling build as an old no-purchase build.
4. Pass actual, independently verified Apple/Stripe/clinician answers through `state.apply`. A failed/refused/unreadable response is `.unavailable`: it revokes nothing and stamps no check clock. An authoritative no removes only that source. A negative Stripe result needs the same cached account. Clinician access and sharing consent are separate; this module contains no consent state.
5. An already-earned game/run must be explicit `FamilyGamePermission`, created by the in-memory turn coordinator. Library entry uses `.library`; URL text, backups, an unrelated game, or a finished turn must never become that permission. Check access at entry; do not interrupt an authorized round halfway through.
6. `FamilyStoreCompatibility.offers` accepts actual localized store metadata and RevenueCat offering IDs. It requires the exact monthly SKU and a readable first charge, preserves unknown eligibility as unconfirmed, and keeps annual restore support even when annual is not sold. The one-payment row has no free trial or renewal. `products.restorableIDs` includes all legacy SKUs.

The native app's current `FamilyLibraryAccess` preview gate is not replaced automatically. The host still needs to link this package, combine verified household state with its clinician store, and route every entry through this policy. It must retain source identity when refreshing each grant.

## Remaining purchase work

The preview has no native RevenueCat Swift SDK integration or verified StoreKit transaction pipeline yet. Add that separately with the existing App Store app identity and `full` entitlement, then validate restore/reinstall, old annual subscribers, lifetime buyers, trial eligibility, cancellations/refunds, offline cached grants, and purchase pending/cancellation. This package deliberately exposes no method that can spend money or manufacture a trial. Prices and the current 7-day monthly introductory offer come from App Store Connect through RevenueCat, not this resource. No store UI should sell while product/ownership answers are uncertain.

Tests exercise both values of the free-mode switch without pinning its business setting. They cover independent grants, free-version promises, exact old trial expiry, parked/unknown games, story/book gates that ignore demo/earned-turn exemptions, matching run permissions, offline and authoritative revocations, current typed migration bridging, exact product IDs, optional offered rows, and uncertain introductory terms.
