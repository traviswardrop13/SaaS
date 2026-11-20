# Native Moving Phones

Local-only native progress backup, restore and Undo. This package does not use a WebView, audio, analytics, purchase SDK, credentials or a network transport. It depends on the isolated shipping `SonaFamilyRules` and the protected `SonaFamilyMigration` repository.

## Host integration

Link product `SonaFamilyBackup`. From the existing Grown-ups gate, retain one service for the selected origin:

```swift
FamilyMovingPhonesService(repository: repository, origin: selectedOrigin,
                         onChanged: { await reloadFamily() })
FamilyMovingPhonesView(service: service)
```

The view owns file import/export, optional legacy pasted code, confirmation and error UI. Its identifiers start `backup-`. No child name appears in the filename. Selected-origin validation is repeated at commit.

## Boundary

- Same-device upgrade is the only trusted capture path. These files never enter it, replace capture fingerprints or establish household promises.
- Portable wrapper is source-compatible `{app:"sona",v:1,data:{...}}`; old bare string maps are accepted. Optional `native` version 1 explicitly carries per-slot book bookmarks and native gesture-game completion IDs. Sorted game arrays make encoding stable. Neither field grants speech reps, rewards or access.
- Device-only NO_EXPORT/NO_IMPORT fields, raw family/device IDs, active clinician credentials, consent and purchase records never appear in exported bytes or the local Undo snapshot. Old files containing these fields cannot change destination security.
- Unlike web ticket-transfer behavior, native phone moves are progress-only: use existing therapist sign-in in Settings on the new phone. Existing verified destination links, paid/free-era/founding promises and authoritative Apple records are preserved.
- The source's validated 16-hex `profile.reportId` pseudonym DOES travel with its child, to avoid double-counting after a move. It is separate from the forbidden raw `sona.report.v1.dev`. It never enables email or clinical sharing. A changed child never inherits the slot's old report ID.
- An existing explicit clinician-sharing withdrawal (`slpShare:false`) stays false across both Restore and Undo while destination evidence remains. The App Store verification time `sona.iapcheck.v1` is also destination-only and never travels.
- Current destination weekly-report consent and address stay only for the same name+age profile identity; a pasted file cannot opt in, change that opted-in address, or resurrect an opt-in after Off. Existing device off queues and the independent report journal are retained. Dropped address owners queue exact REPORT1 withdrawal errands atomically; no captured request is sent here.
- A currently clinician-sharing child cannot be replaced/removed by a progress file. The predicate is the existing source consent/childId/non-`ff-` code/`slpShare !== false`/destination ticket combination. Stopped-sharing and founding pilots retain access without blocking a restore.
- `importData` merges supplied keys. `undoImport` removes new keys/children as well as restoring the safety copy. Native transaction preserves slot high-water and all unrelated origins, journals, access and removal obligations. Old formats lacking native metadata clear overwritten children's old native-only state rather than inheriting it.
- Explicit deletion calls `NativeFamilyRepository.redactBackupUndo(for:from:)` inside the same atomic deletion transaction. It removes personal keys, roster names and native extras from the safety copy. Completed Undo deletes that personal snapshot and retains only operation receipts. Retrying acknowledged or interrupted restore/Undo is idempotent.

## Verification

```sh
swift test --disable-sandbox --package-path native/family-ios/modules/SonaFamilyBackup --scratch-path /private/tmp/sona-moving-phones/build
node native/family-ios/modules/SonaFamilyBackup/tools/check-policy.mjs
```

All fixtures are fictional; no real user account/data or external report transport is used. Two consent tests first failed seven assertions; report-pseudonym and withdrawn/founding fixtures also first failed against the preceding draft. The IAP timestamp and sticky-withdrawal fixtures also failed first; the withdrawal probe calls actual `Sona.slpSharing()` on synthetic copied state. Logs are in `/private/tmp/sona-moving-phones/`. iOS 15 module compilation is checked separately. Real Files/iCloud-provider UI and physical-device end-to-end restore remain host integration checks.
