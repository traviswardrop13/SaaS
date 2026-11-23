# Sona — completed local app validation, 19 November 2026

The native rebuild snapshot and existing web battery passed the local checks below. Fixtures contain fictional families, credentials and purchases. This run used a simulator and synthetic StoreKit products.

## Final results

| Check | Result |
| --- | --- |
| Complete existing web/API/browser battery | **178 suites; exit 0**; all source hashes unchanged |
| TypeScript | `tsc --noEmit -p tsconfig.json --incremental false` verified exit 0; relevant web source unchanged afterward |
| Final native app, iOS 15 minimum, arm64 Simulator | Both separate synthetic identities built; exit 0 |
| Unsigned iPhoneOS device-target build | arm64 executable, minimum iOS 15.0; exit 0; no signing or physical installation |
| Installed whole-app screen battery | **4 flows passed across retained runs**, with explicit local transports: three passed in the combined run; the corrected parent-navigation driver passed its affected retry (exit 0) |
| Actual Main packages | Rules **45**, Migration **95**, Backup **14**, SpeechCore **97**, Access **16**, Storefront **34**; all passed |
| Original speech adapter contracts | Guided **38**, reader **35**, checkpoint **25**, live power **32**, Feed **44** checks; all passed on compatible final inputs |
| Final game/book date and lifecycle regressions | **36 tests** passed, including **6** date/held-close/settle cases; all five controllers compiled |
| Practice date preservation | **5** cases passed: midnight, retry, known failure, round-ready and captured timezone |
| Family login / connection / report | **44** login assertions, **14** connection tests and **19** report tests passed; report-policy checks also included in Rules |
| Local Apple Store harness | **9** checks passed: initialization plus **8** StoreKit tests, synthetic products only |

Counts are per suite, not an inflated aggregate: some policy and lifecycle coverage overlaps. The separate Root migration package's 114 tests and another speech tree's 159 tests are **not** substituted for actual Main's 95 and 97.

## What the installed app verified

- An in-place synthetic upgrade recovered **8 children across 4 legacy origins**. Household promises and separate children survived. All four retired recording origins were verified; no recording payload entered native records.
- Home's completed adventure stays disabled, while Games and Books remain available. The same assertion fails against the saved pre-fix app.
- Games, the book shelf and reader, Grown-ups, Progress, player settings, Premium/Restore, weekly report, moving phones, support, child switching and cold restart opened successfully. Declining the book microphone question and navigating pages added no practice reps. Progress omitted the retired game-records panel even with valid saved records present.
- Fresh setup rejected a blank nickname, kept age optional, saved the chosen age/sound/minutes/goal, resumed its draft and created exactly **one** child and **one** setup receipt. The first guided handoff did not repeat after relaunch.
- Explicit owned-fictional fixtures set today’s completion, a 500-coin balance and a saved-record example; original upgrade captures and source fingerprints were retained. A Flower crown purchase and immediate Undo saved **500 → 350 → 500 coins**, removed the item, cleared `lastBuy`, and wrote exactly one purchase and one refund receipt. The separate record comparison preserved siblings, other origins, household promises and earlier receipts.
- Website Restore from Grown-ups used the real client with an explicitly intercepted local **503** response. The failure message appeared, and subscription `active`, website access, Apple access and permanent promises remained false or absent. Apple restore scenarios separately covered monthly, annual and lifetime, empty/repeated Restore, cancellation, pending approval, refund and offline behavior with local StoreKit products.

The final build had **220** verified native inputs. The **94** affected source and test inputs also matched that snapshot, including a final checkpoint rerun after its timestamp correction. Raw local evidence is retained separately.

## Fixes verified during this work

The local changes connect required setup, Settings-only website Restore, access projection, one-shot purchase/refund saving, slim Progress and completed Home. They also require a durable verified audio-purge receipt before old-child cleanup can be acknowledged, preserve report consent/identity boundaries through backup and restore, and keep accepted sayings on their occurrence day across delayed writes and timezone changes. The isolated rules host excludes only known browser transport/telemetry hooks; canonical clinical content and verdict rules remain unchanged.

Optional terminal feedback is one-shot across interruption. Required model playback keeps its existing retry behavior. This follows the explicit source comment and native contract; the shipping web's normal handoff does not consistently activate its terminal flag, so it is not claimed as exact current runtime parity in every path.

New regression checks were demonstrated failing on their pre-fix sources. Retained failures are evidence, not silently relabeled passes. Driver corrections included a shadowed SwiftUI email-field identifier, a one-second polling race, and a postflight assumption that empty captured legacy origins were invalid, and a down-first test swipe that dismissed the parent modal while searching for a lower row.

## Local-only correction and limits

An earlier test-only global URLProtocol registration did **not** intercept the website client's separate ephemeral session. One confirmed lookup with `synthetic+restore@example.invalid` reached the subscription endpoint and returned no active subscription. No access or purchase was granted. Inspection of that GET handler showed subscription/customer list reads and no purchase or email action. The earlier global-only screen runs cannot prove complete network isolation and are excluded as that evidence.

The final screen runs explicitly bind the local protocol to **every app URLSession used by these flows**; original public artwork is served from **856 bundled local fixtures** and other HTTP(S) requests receive a local error. WebKit's migration capture remains inert with its existing CSP/resource blocks. Final captured requests and the transport audit accompany the result. The story-board AsyncImage loader is outside these four UI flows; this audit does not claim universal transport replacement for unvisited views. Production networking was not changed by these test seams.

This completes the requested **local synthetic** work. Physical speech/motor review with Rachel, production-identity/App Store verification, a consented live dashboard/report household, and review of the shorter native setup and documented motor/design differences remain release checks. No local test approves those clinical/design differences or authorizes a merge.

Machine receipt timestamps and evidence filenames use UTC (20 November); the local validation date is 19 November in America/Boise. The additional device-SDK check compiled the same 220 original inputs with existing local packages, without changing the completed test results.

## Native app follow-up, 20 November 2026

This follow-up covers the full setup, reminders, the installed-app build identity, and the restored Arcade features. The snapshot and results above describe the preceding local run.

- **Setup and access.** Current welcome and silent game previews, Rachel, interests, therapy, sounds, eligible goals, optional parent email, build and ready, eligible reminders and price, microphone choice, and the first guided Fruit Slice handoff. Setup writes the child and recorded consent together. Locally tested purchase fixtures cover durable access and the existing restore paths.
- **Arcade.** The 25 games currently offered by Sona are in the native app. Nine use the canonical difficulty levels and six save a personal best. The restored game work includes Feed Echo’s concert, Race Car’s eight legs, Treasure Map sailing, Space Trip landings, Robot Builder’s eight circuits, and Dino Dig’s four-species collection. The current story calendar, books, backup code, and parent settings use the existing family records.
- **On-device boundaries.** Speech and its ledger still use the existing voiced-attempt, retry and step-down rules. Quiet activity earns zero speech reps. The separate clinician dashboard remains on the web. The installed identity build is compile-only. Both the original web source and release branch are untouched.

### Local checks for this follow-up

| Check | Result |
| --- | --- |
| Native rules | 75 tests passed, including the four added setup receipt and retry cases |
| Family migration and Storefront packages | 95 migration and 34 Storefront tests passed on the integrated changes. The separate local reminder tests exercised purchase and recovery callbacks. |
| Reminders | 16 policy and service tests, five local Storefront integration tests and six tap routing tests passed. The recording driver fixture verified that Home opens after the outgoing input closes. |
| Arcade | Saved-level and personal-best tests passed. The newer motor checks include 391 Treasure Map comparisons, six Dino tests with original species and thresholds, all eight Race Car and Robot Builder legs, Space Trip flight, and 49 Feed Echo checks. |
| Bundled artwork | The compiled app includes 1,029 byte-matched original book, story and game files and all 37 Buddy Shop image names. The 29 repaired shop images match the original decoded pixels. |
| iPhone build | The arm64 app built under Sona’s existing bundle ID against the pinned local purchase library and the iOS 15 deployment target. |

The earlier upgrade simulation transferred eight fictional profiles across the four legacy storage origins. Physical microphone and gameplay review, a signed upgrade over a real installation, and live trial, restore, clinician and email behavior remain release checks. Legacy web marketing attribution is outside the family-facing flow exercised by these local fixtures.

### Fresh setup and Fruit Slice walkthrough

The final offline walkthrough passed the full setup, the working Start control for guided Fruit Slice and two relaunches to Home. Its saved journal held one fictional child and one setup receipt. No practice reps, microphone calls, recordings, new WebKit instances or web requests were observed. A failed control run reached guided practice with a closed controller and no Start button. The repair dismisses the setup cover before it mounts guided practice.

The final unsigned iPhone compile also includes the later Home layout with Pick a game first and the guard that clears a canceled first-game setup marker. The earlier simulator walkthrough verified the handoff before those two follow-up edits. Raw result and source receipts are retained locally.
