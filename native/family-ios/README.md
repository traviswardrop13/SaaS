# Sona native family rebuild

Open `SonaNativePreview.xcodeproj` in Xcode, select **SonaNativePreview** and an iPhone Simulator, and press Run. The preview uses a separate bundle ID. Work stays on `codex/sona-native-family`. [Design changes for review](DESIGN-CHANGES.md)

The first screen offers both regular setup and **I have a login from my speech therapist**. The local build uses the existing family-login, clinician coverage, consent enrollment, and family-password endpoints on `app.speaksona.com`. A verified covered household goes directly to its games and books after making the sharing choice. An unconfirmed or uncovered connection does not confer Premium.

The SwiftUI and SpriteKit preview includes Home, all 25 released Arcade titles, 55 books with 554 original pages, 24 illustrated adventure stories and native rounds for their 14 separate games, sound-model playback, player switching, parent progress, and a Trophy Road preview. The books and adventures use the original captions and artwork. The preview logs its own game finishes and manual reading positions. It does not credit speech or track actual quest and reward completion.

The native [speech package](modules/SonaSpeechCore) contains on-device capture, acoustic checks and word verdicts. It has no audio persistence or network code. [Approved practice dialogue](PRACTICE-DIALOGUE.md) comes from the current application source and existing clip references. [Migration](modules/SonaFamilyMigration) verifies an atomic archive of the original household and child records and refuses recording payloads. The [access package](modules/SonaFamilyAccess) keeps the original content rules and storefront products, and the preview uses it to read current access. The preview does not sell a plan or modify purchase, trial, or historical ownership records.

## Release checks

1. Verify a dedicated, dashboard-issued family login with confirmed Premium coverage on the live server. Exercise both sharing decisions on dedicated test slots, confirm the consented row in the dashboard, verify the assignment attaches when the invitation carries one, confirm restart state, and verify changing the disposable password. Local tests use fictional credentials.
2. Connect the approved clinical word selection, models, full practice, game and book listening turns, daily goals, and the story and reward records. Verify the current approved behavior on physical iPhones with Rachel. Microphone input stays on the phone and in memory.
3. Invoke the local migration adapter during an in-place upgrade under `com.speaksona.app`. Verify repeatable migration for each legacy origin, child, free-era and founding promise, paid purchase, assignment, and reward balance. Local tests cover the records and atomic writes. The separate preview has its own container.
4. Connect native RevenueCat/StoreKit and validate the same products, prices, terms, intro eligibility, existing subscribers, and Restore Purchases in the correct App Store app. Review the design changes with Travis and Rachel before an explicit “merge.”

## Local login contract test

Run the following from this checkout. The test intercepts requests with fictional responses and makes zero live calls.

```sh
test_dir=$(mktemp -d)
swiftc native/family-ios/SonaNativePreview/Sources/FamilyLoginClient.swift \
  native/family-ios/tests/FamilyLoginContract.swift \
  -o "$test_dir/family-login-contract"
"$test_dir/family-login-contract"
```
