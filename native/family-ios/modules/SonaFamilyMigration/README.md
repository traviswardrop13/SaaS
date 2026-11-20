# Same-device family state migration

This local Swift package reads the existing Sona localStorage keys through an isolated WebKit reader and archives their exact values. The archive commits data and its receipts atomically, verifies the saved bytes, and treats a second import of the same origin as a retry. Each child remains scoped to its origin and slot. Historical free-era, founding and kept-buddy rules have differential tests against the shipping code.

The capture has no IndexedDB or microphone-recording access. It accepts a read-only capture of `sona.*` state. A legacy payload that advertises recordings is rejected. The old app's stored audio is outside the migration and stays untouched by this package. The store uses app-private protection on iOS and excludes the archive from cloud backups.

`MigrationRunCoordinator` is the host-facing run boundary. Inject one existing `MigrationEngine`, a `LegacyOriginCapturing` adapter, and a fixed set of required origins (all known origins by default). `run()` checks the archive, gathers every required capture, verifies each origin, then passes the entire batch to the engine for one atomic import. Its actor-isolated `status` exposes the current phase and its returned receipt comes directly from the engine. Call `run()` again for an explicit retry; there is no separate saved completion flag. Concurrent calls cannot overlap captures.

Capture, validation and storage errors stop the run. They never mean empty storage, a fresh install or permission to show a new-family screen. Typed failures contain only fixed categories and known origins, never raw adapter errors or family values. Cancellation while collecting discards the batch. Once the engine begins its atomic commit, the engine's verified receipt decides the result; cancellation is not a rollback.

The iOS `LegacyUpgradeCapture` adapter is restricted to the existing `com.speaksona.app` bundle. It assigns each exact legacy origin to an inert local HTML document in the app’s default WebKit store. The document has no external resources. The isolated reader performs a read-only capture. Wrong origins, unreadable storage, and failed writes stop the run. A genuinely empty origin still requires a successful capture.

Local WebKit checks recovered synthetic state at both HTTPS and Capacitor origins. An iPhone Simulator update preserved the seeded records from all four origins, confirmed that retry imports nothing twice, and retained an intervening edit to the native records. The release still needs to invoke the adapter from the actual upgrade host with existing writers stopped and verify an in-place update on physical iPhones. The separate preview has its own container.

`NativeFamilyRepository` seeds editable native records from the verified archive. It keeps each child scoped to the original storage location and slot. Reopening the migration keeps intervening native edits and the selected child. The native document contains family records and commitments, with no audio fields.

`FamilyPurchaseContinuity` coordinates refresh, purchase and parent-initiated Restore using an injected client. It keeps each access source independent and separates stale responses, network failures and verified ownership. Store product prices and trial eligibility come from the store. The [RevenueCat adapter](../../adapters/RevenueCatFamilyPurchaseClient.swift) retains the existing anonymous identity and uses the SDK’s current ownership response. The preview has no purchase screen, and release still needs to connect these components to the actual App Store app.

Run the package and storage checks from the project root.

```sh
swift test --package-path native/family-ios/modules/SonaFamilyMigration
node native/family-ios/modules/SonaFamilyMigration/Tests/capture-contract.test.mjs
```
