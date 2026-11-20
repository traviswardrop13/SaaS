# Same-device family state migration

This local Swift package reads the existing Sona localStorage keys through an isolated WebKit reader and archives their exact values. The archive commits data and its receipts atomically, verifies the saved bytes, and treats a second import of the same origin as a retry. Each child remains scoped to its origin and slot. Historical free-era, founding and kept-buddy rules have differential tests against the shipping code.

The capture has no IndexedDB or microphone-recording access. It accepts a read-only capture of `sona.*` state. A legacy payload that advertises recordings is rejected. The old app's stored audio is outside the migration and stays untouched by this package. The store uses app-private protection on iOS and excludes the archive from cloud backups.

`MigrationRunCoordinator` is the host-facing run boundary. Inject one existing `MigrationEngine`, a `LegacyOriginCapturing` adapter, and a fixed set of required origins (all known origins by default). `run()` checks the archive, gathers every required capture, verifies each origin, then passes the entire batch to the engine for one atomic import. Its actor-isolated `status` exposes the current phase and its returned receipt comes directly from the engine. Call `run()` again for an explicit retry; there is no separate saved completion flag. Concurrent calls cannot overlap captures.

Capture, validation and storage errors stop the run. They never mean empty storage, a fresh install or permission to show a new-family screen. Typed failures contain only fixed categories and known origins, never raw adapter errors or family values. Cancellation while collecting discards the batch. Once the engine begins its atomic commit, the engine's verified receipt decides the result; cancellation is not a rollback.

The iOS `LegacyUpgradeCapture` adapter is restricted to the existing `com.speaksona.app` bundle. It assigns each exact legacy origin to an inert local HTML document in the app’s default WebKit store. The document has no external resources. The isolated reader performs a read-only capture. Wrong origins, unreadable storage, and failed writes stop the run. A genuinely empty origin still requires a successful capture.

The release still needs to invoke this from the actual upgrade host while existing writers are stopped, then open the native app after data and access have been verified. A local WebKit fixture verified that two inert HTTPS documents share the original origin's stored state. The iOS source compiles. The bundled Capacitor origin and an actual in-place update on physical iPhones need verification. The separate preview has its own container.

Run the package and storage checks from the project root.

```sh
swift test --package-path native/family-ios/modules/SonaFamilyMigration
node native/family-ios/modules/SonaFamilyMigration/Tests/capture-contract.test.mjs
```
