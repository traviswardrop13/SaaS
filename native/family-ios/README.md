# Sona native family rebuild

Open `SonaNativePreview.xcodeproj` in Xcode, select **SonaNativePreview** and an iPhone Simulator, and press Run. The preview uses a separate bundle ID and builds with the current app’s iOS 15 minimum. The rebuild is on `codex/sona-swift-rebuild`. [Design changes for review](DESIGN-CHANGES.md)

The first screen offers both regular setup and **I have a login from my speech therapist**. The local build uses the existing family-login, clinician coverage, consent enrollment, and family-password endpoints on `app.speaksona.com`. A verified covered household goes directly to its games and books after making the sharing choice. An unconfirmed or uncovered connection does not confer Premium.

Regular setup follows the current welcome, nickname and optional age, silent game previews, Rachel, interests, therapy, sounds, goal where eligible, optional parent email, and the build and ready screens. The age bands **2–4 / 5–6 / 7+** save **4 / 6 / 8**. The completed draft saves once. The current access and trial rules select the reminder, storefront and first-game screens. If a family reaches the guided Fruit Slice turn, the existing retry and step-down rules apply. The fictional review roster is available with the explicit `--demo-roster` launch argument.

The SwiftUI and SpriteKit preview includes Home, 25 released Arcade titles, 55 books with 554 original pages, 24 illustrated adventure stories, 14 separate story-game boards, guided practice, Players, Progress, the Buddy Shop, and Trophy Road. Grown-ups also includes support, removal of an inactive player, and backup codes and files with Undo. The four parked Arcade games stay hidden under the current release rules. Book and story captions come from the current app. The build includes the original book, adventure and game artwork for local use. The games use the existing unlocks, selected difficulty and personal-best rules.

Home opens with **Pick a game**, followed by **Books** and **Practice**. The optional adventure sits below these choices and follows the saved calendar without showing a day number on Home. It shows **Keep going** for a story already started and disables the card after completion. Save or copy a local backup under **Moving phones**. Progress shows weekly practice, days practiced and practice steps by sound, with game and book rep totals kept separate. Saved game records remain in the family ledger; Progress has no separate game-records panel. The Buddy Shop offers **Oops? Give it back** for the canonical ten seconds after a confirmed coin purchase; one successful refund removes the item and restores the coins.

The native [speech package](modules/SonaSpeechCore) keeps microphone input in memory. It drives the four existing rungs of guided practice, timed speaking turns in games and stories, and keyed book words. [Approved practice dialogue](PRACTICE-DIALOGUE.md) comes from the current app and its existing clip references. The [rules package](modules/SonaFamilyRules) runs unchanged content and ledger rules in an isolated local context. Family records, accepted reps, reading positions, gifts, and confirmed coverage are applied to the owning child or household. [Migration](modules/SonaFamilyMigration) captures only metadata from the four possible storage locations and refuses recording payloads. Retired recording stores are cleared and count-verified without reading clips. Native removal stays queued until its origin's verified purge receipt is durable and the old roster entry, child keys and archived copies have been cleared; a failed step remains pending for retry.

The [storefront](modules/SonaFamilyStorefront) uses the existing App Store products and terms. The ordinary preview has no active App Store connection. [Store compatibility tests](revenuecat-storefront-harness/README.md) use the pinned purchase library and synthetic products. The compile-only `tools/stage-store-build.py` stages the SDK-enabled code under a temporary directory. It also supports an unsigned build under the installed family app identity using the existing local pinned SDK. [Private iPhone upgrade test](IPHONE-UPGRADE-TEST.md)

Website-purchase restoration by email is enabled only through the Grown-ups Settings route, **Sona Premium and Restore Purchases**. Setup and locked-content purchase screens do not offer website restoration. Apple **Restore Purchases** retains its existing storefront behavior.

## Release checks

1. Verify a dedicated, dashboard-issued family login with confirmed Premium coverage on the live server. Exercise both sharing decisions on dedicated test slots, confirm the consented row in the dashboard, verify the assignment attaches when the invitation carries one, confirm restart state, and verify changing the disposable password. Local tests use fictional credentials.
2. Finish and verify each original speaking turn in the Arcade, story games, talking stories and book reader. Verify all four practice rungs, goal and reward timing, quiet behavior and replay on physical iPhones with Rachel. Microphone input stays on the phone and in memory.
3. Verify repeatable migration for each legacy origin, child, free-era and founding promise, paid purchase, assignment, and reward balance with an in-place upgrade. Include a failed recording purge and interrupted child removal: retry must finish old-copy deletion before removal is acknowledged. Local tests cover the records and atomic writes. [Private iPhone upgrade test](IPHONE-UPGRADE-TEST.md)
4. Connect native RevenueCat/StoreKit and validate the same products, prices, terms, intro eligibility, existing subscribers, and Restore Purchases in the correct App Store app. Review the design changes with Travis and Rachel before an explicit “merge.”
5. Review remaining game assists and sound effects where the native controls differ from their original boards.
6. Verify a new weekly report confirmation and an existing subscription with a consented test household before release. All local delivery tests use fictional data. [Weekly-report parity](WEEKLY-REPORT-PARITY.md)
7. Verify optional reminders on an iPhone with the App Store trial status and the system permissions flow. Verify reminder delivery and the return to Home, including a quiet exit from an open speaking screen.

## Local login contract test

Run the following from this checkout. The test intercepts requests with fictional responses and makes zero live calls.

```sh
test_dir=$(mktemp -d)
swiftc native/family-ios/SonaNativePreview/Sources/FamilyLoginClient.swift \
  native/family-ios/tests/FamilyLoginContract.swift \
  -o "$test_dir/family-login-contract"
"$test_dir/family-login-contract"
```

Earlier local validation used an installed iPhone Simulator build. A fictional family login resumed at the pending sharing choice after a restart, then opened covered Home, Practice and Trophy Road. Other simulator passes covered Games and Feed Echo, and verified that declining a book’s microphone question and turning the page left practice at zero. A synthetic in-place update recovered eight fictional profiles across four legacy storage locations and cleared the retired recording store without reading clips. The removal fixture verified on a cold restart that the selected player’s old copies were gone and the surviving player’s progress and the household’s promises stayed intact.

The integrated Main modules passed 45 Rules, 95 Migration and 14 Backup tests with fictional data. Separate exact-host removal checks covered failed-purge retry and interruption between roster update and key deletion. Installed simulator checks also cover fresh setup and restart, one saved child, completed Home, parent screens, book navigation without credit, sibling switching, the immediate coin refund, and a website Restore failure handled by an explicitly local transport. See [the local validation record](LOCAL-VALIDATION-2026-11-20.md) for exact source snapshots, final results, corrected harness failures and remaining release checks.
