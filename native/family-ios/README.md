# Sona native family rebuild

Open `SonaNativePreview.xcodeproj` in Xcode, select **SonaNativePreview** and an iPhone Simulator, and press Run. The preview uses a separate bundle ID and builds with the current app’s iOS 15 minimum. Work stays on `codex/sona-native-family`. [Design changes for review](DESIGN-CHANGES.md)

The first screen offers both regular setup and **I have a login from my speech therapist**. The local build uses the existing family-login, clinician coverage, consent enrollment, and family-password endpoints on `app.speaksona.com`. A verified covered household goes directly to its games and books after making the sharing choice. An unconfirmed or uncovered connection does not confer Premium.

The SwiftUI and SpriteKit preview includes Home, 25 released Arcade titles, 55 books with 554 original pages, 24 illustrated adventure stories, 14 separate story-game boards, guided practice, Players, Progress, the Buddy Shop, and Trophy Road. Grown-ups also includes support, removal of an inactive player, and backup codes and files with Undo. The four parked Arcade games stay hidden under the current release rules. Book and story captions and artwork come from the current app.

The native [speech package](modules/SonaSpeechCore) keeps microphone input in memory. It drives the four existing rungs of guided practice, timed speaking turns in games and stories, and keyed book words. [Approved practice dialogue](PRACTICE-DIALOGUE.md) comes from the current app and its existing clip references. The [rules package](modules/SonaFamilyRules) runs unchanged content and ledger rules in an isolated local context. Family records, accepted reps, reading positions, gifts, and confirmed coverage are applied to the owning child or household. [Migration](modules/SonaFamilyMigration) verifies the four possible storage locations, keeps archived records intact, and refuses recording payloads.

The [storefront](modules/SonaFamilyStorefront) uses the existing App Store products and terms. The ordinary preview has no active App Store connection. [Store compatibility tests](revenuecat-storefront-harness/README.md) use the pinned purchase library and synthetic products. The compile-only `tools/stage-store-build.py` can stage the SDK-enabled code under a temporary directory while keeping the preview identity.

## Release checks

1. Verify a dedicated, dashboard-issued family login with confirmed Premium coverage on the live server. Exercise both sharing decisions on dedicated test slots, confirm the consented row in the dashboard, verify the assignment attaches when the invitation carries one, confirm restart state, and verify changing the disposable password. Local tests use fictional credentials.
2. Finish and verify each original speaking turn in the Arcade, story games, talking stories and book reader. Verify all four practice rungs, goal and reward timing, quiet behavior and replay on physical iPhones with Rachel. Microphone input stays on the phone and in memory.
3. Verify repeatable migration for each legacy origin, child, free-era and founding promise, paid purchase, assignment, and reward balance with an in-place upgrade. Local tests cover the records and atomic writes. [Private iPhone upgrade test](IPHONE-UPGRADE-TEST.md)
4. Connect native RevenueCat/StoreKit and validate the same products, prices, terms, intro eligibility, existing subscribers, and Restore Purchases in the correct App Store app. Review the design changes with Travis and Rachel before an explicit “merge.”
5. Review remaining game assists and sound effects where the native controls differ from their original boards.
6. Verify a new weekly report confirmation and an existing subscription with a consented test household before release. All local delivery tests use fictional data. [Weekly-report parity](WEEKLY-REPORT-PARITY.md)

## Local login contract test

Run the following from this checkout. The test intercepts requests with fictional responses and makes zero live calls.

```sh
test_dir=$(mktemp -d)
swiftc native/family-ios/SonaNativePreview/Sources/FamilyLoginClient.swift \
  native/family-ios/tests/FamilyLoginContract.swift \
  -o "$test_dir/family-login-contract"
"$test_dir/family-login-contract"
```

The signed preview built for iPhone Simulator. A fictional family login resumed at the pending sharing choice after a restart, then opened covered Home, Practice and Trophy Road. Other simulator passes covered Games and Feed Echo, and verified that declining a book’s microphone question and turning the page left practice at zero. A synthetic in-place update recovered eight fictional profiles across four legacy storage locations and cleared the retired recording store without reading clips. The removal fixture verified on a cold restart that the selected player’s old copies were gone and the surviving player’s progress and the household’s promises stayed intact.
