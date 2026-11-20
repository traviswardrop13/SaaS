# Weekly progress report: native release gate

The native rebuild preserves migrated report records, uses the existing policy
and household journal, and connects previously opted-in households to Sona's
current report endpoint under the existing app identity. The separate preview
labels its saved setting as local and has delivery disabled. All verification
to date uses fictional data.

## Existing consent and identity

- `public/sona.js:9540` finds the household address only when a child's profile
  contains the literal boolean `weeklyReport: true` and a valid email. An email,
  `weeklyEmail`, clinician enrollment or clinician sharing alone is insufficient.
- `sona.report.v1` belongs to one device and origin. Same-device migration must
  preserve its `dev`, `onFor`, `off`/`offAt`, `pend`/`pendFor`, `gaveUp`, last-send
  time and outstanding `offs`/legacy `offOwed`. A fresh random device ID would
  lose the previous device's confirmation and pending withdrawal obligations.
  A family **backup restore**, unlike this in-place migration, intentionally
  gets a new device ID (`public/sona.js:2722`, `:2788`).
- Each child's 16-hex `profile.reportId` travels with that child and must not be
  regenerated when present. It lets the server count a moved child once.
- The migration archive retains raw household and child keys, including these
  values. Removing the child holding the only consented address already creates
  a durable `NativeFamilyRemovalObligation.reportEmail` in
  `modules/SonaFamilyMigration/.../NativeFamilyRepository.swift:286`.

## Local implementation and remaining connection

1. `NativeFamilyWeeklyReport.swift` adds a dedicated **origin-scoped household**
   transaction for `sona.report.v1`, metadata-only profile patches and its
   device-local journal. Ordinary game/practice `applyRules` remains restricted
   to the active child's own keys. Invalid or incomplete mutations commit nothing.
2. `NativeWeeklyReportPolicy.swift` loads unchanged shipping `sona.js` and adds
   narrowly anchored in-memory hooks. The original REPORT1 functions prepare
   requests; its actual response callbacks handle acknowledgments. All fetches
   in this context are captured unresolved requests, never network calls.
3. `NativeFamilyReportStore.swift` journals a prepared packet before transport
   can send it. Turn off persists its queue before waiting for
   an older update; a restart after withdrawal discards an old active packet
   without resending child numbers. Removal obligations queue the original off.
4. The request description fixes `https://app.speaksona.com/api/report` and its
   matching Origin, and the repository enforces an explicit field allow-list and
   4,000-byte cap. The dedicated HTTPS transport rejects redirects and disables
   cookies, credential storage and caching. It is enabled only for the original
   app identity. The test fixture intercepts all requests.
5. Host wiring uses explicit Settings recheck, a counted rep after the goal
   stamp, and leaving or backgrounding a dirty practice or game. Opening Home
   sends nothing. A withdrawal can flush
   without current report consent, because it deletes previously authorized data.
   New-family opt-in/Turn on has not been added; a bare email or clinician consent
   cannot activate this service.
6. The unchanged policy supplies the full household: at most eight set-up family children,
   excluding clinician or unfinished profiles, for this local Monday and last.
   Do not send one selected child's numbers as though they represent the household.

The body contains only address, 32-hex device ID and weekly anonymous child
records: `i`, `d`, `g`, `r`, `p`, `s`, and `gw` only for a grown-up's actual
3/4/5/7-day choice. It contains no child name, age, word, transcript, audio,
clinical accuracy or invented default plan. Existing `off`/`gaveUp` quiet checks
contain no child numbers. `on: true` is needed until the server has acknowledged
activation for the exact address; an ordinary late update cannot lift server off.

Keep the original 30-minute send interval, five-minute failed/off retries,
14-day pending slowdown, 56-day give-up, and 30-day off/quiet rechecks.
Responses distinguish pending, confirmed and off; pending never clears off.
The server still requires the email's confirmation before retaining numbers.

## Local proof and live verification

- A migrated confirmed device keeps its original device and child IDs.
- `weeklyEmail` alone, numeric truthy consent, an absent report opt-in and an
  unselected origin produce no report request. Clinician consent is never read
  as report permission.
- All and only eligible siblings appear, with original local-week totals.
- Offline off queues, the older `offOwed`, different addresses and Gmail aliases
  survive restart and drain only on their own successful acknowledgments.
- Delayed update → Turn off, restart after withdrawal, child removal and origin switching
  cannot reorder, lose or cross-apply consent/state.
- New-family Turn on and an explicit off → Turn on flow remain unimplemented.
- Pending/off/give-up and retry schedules match the existing REPORT1 tests.
- Only allow-listed fields cross the mocked request boundary. A temporary-copy
  negative control removing the field allow-list fails the new privacy test.
  Local transport tests verify the exact URL, no cookies and refusal to redirect.
  Live delivery and withdrawal still need a dedicated, consented test household.

Reference tests: `tests/reporttest.mjs`, `tests/weeklytest.mjs`, and
`NativeFamilyRepositoryTests.testReportDeletionRequiresOriginalStrictBooleanConsent`.
No live address, account or request was used for this audit.

Run `python3 native/family-ios/tests/run-weekly-report-tests.py` for the mock
host and canonical policy tests. Set `SONA_REPORT_NEGATIVE_CONTROL=unlisted-field`
only to demonstrate the expected failure in a temporary source copy.
