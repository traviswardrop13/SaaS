# Clinician (the page that sells Sona Pro, sign-in, the dashboard, the family's join link)

## In five lines
1. A parent who says "Yes, share progress" has no way to stop: the only "Stop sharing" button lives on a page (`pilot.html`) that nothing links to, yet the join page, the privacy page and the for-slps FAQ all promise it.
2. The dashboard only ever hears the FIRST try of each practice session (confirmed: 5 tries sent, 1 post), so a therapist always sees the latest session as "1 try".
3. A new account whose trial ends is locked out of Caseload and child pages, so it cannot remove a child or clear homework from the screen, even though the FAQ says removal "works whether or not Sona Pro is on".
4. The therapist's message sends parents to Safari first and the App Store second; the iPhone app can never see the link, so a covered family opening the app meets a fresh setup and a price screen (a known gap, but Sona Pro's "unlimited families get every game" promise makes it the biggest hole).
5. Solid: the dashboard's register (pass rate, "too few to read" under 20), escaping of every roster value, the note's hedge, community and feedback code, error banners, the plan page states, and the phone fit of Today/child pages are all careful work.

## Bugs

### P0
**B1. A family cannot stop sharing.** (LIKELY, traced; I grepped every page)
- Sees: join page says "You can stop any time, and stopping deletes everything they could see." for-slps FAQ says "the parent taps 'stop sharing'". privacy.html says "Open the grown-ups' area and choose 'Stop sharing with your speech therapist'". The grown-ups area (Settings, Progress, Talk to us) has no such button.
- Steps: join through a link, tap Yes, then look in Grown-ups, Settings and Progress. The button exists only at `public/pilot.html:134` (+ code 167-196). `grep "pilot.html"` finds no link to it anywhere. It was lost in the Settings simplification (22 Oct) or never linked.
- Where: `public/settings.html` (missing), `public/pilot.html:131-194`, `public/join.html:198`, `public/privacy.html:124`, `public/for-slps.html:463`.
- Fix: add a "Sharing with your speech therapist: Stop sharing" row to Settings that calls the existing `/api/pilot/forget` code (move the pilot.html block). Until then the promises are false.

### P1
**B2. The dashboard only receives the first try of every session.** (CONFIRMED)
- Sees: a child practises 5 words; the therapist's dashboard shows 1 attempt for that day, and "n" and pass rates trail a whole session behind. A child who practised once this week shows "n=1" on Friday.
- Steps: fake phone, `startPilot`, ticket set, `Sona.logAttempt` x5 over 1.5 s, count POSTs to `/api/pilot`: exactly 1, carrying `R:1`. The rest are dropped by the 60-second throttle and nothing flushes when the page closes or the practice ends. The next send is the first try of the next session.
- Where: `public/sona.js:10249` (`now - _lastSent < 60000` return), only caller of "auto" is `logAttempt` at `sona.js:4699`.
- Fix: debounce instead of drop (send 60 s after the last try and on `pagehide`/`visibilitychange`), and send once when a practice run ends.

**B3. A locked account cannot remove a child, cancel an invite or clear homework from the screen.** (CONFIRMED on the fake dashboard)
- Sees: a post-12-Nov account whose trial ended is bounced to Sona Pro from Today, Caseload and every child page; Settings has no remove or clear control. The sidebar still lists Today and Caseload (dead links: a click silently returns to Sona Pro). The server's roster answers 402, so the page has no children to click.
- Steps: plan with `dashboard.open:false`, open `#caseload` or `#child/x`: hash flips to `#premium`.
- Where: `public/slp.html:1446` (route lock), `1399` (402 empties KIDS), `2025` (`LOCK_OPEN_PAGES`). `lib/proGate.ts` says removal must always work; the page makes that untrue. for-slps FAQ (`for-slps.html:463`) repeats it. "Download CSV" also exports nothing while locked.
- Fix: when locked, still let `GET /api/slp` return a minimal list (id, label, joined date) and show a "Remove" screen; hide Today/Caseload in the sidebar while locked.

**B4. The family link ends in Safari; the iPhone app never sees it.** (LIKELY; recorded as a known gap, but Pro raises the stakes)
- Sees: the copied message says "Open it on the phone your child will use... Download for iPhone or iPad". On an iPhone the link opens Safari (no deep link: no associated-domains anywhere), the parent connects and sets up the child in the browser, then installs the app, which has separate storage: fresh setup, a price screen for a family the clinician already pays for, and the therapist sees nothing from the app. Only "Moving to a new phone?" buried in Settings bridges it, and neither the message nor join.html mentions it.
- Where: `public/slp.html:1812,1827` (message text), `public/join.html:102-105` (`go()`), `NATIVE.md:601`, CLAUDE.md "Known and left for Travis".
- Fix: put "Connect with my speech therapist" (opens `/join.html`, which already has a code + key form) in the app's grown-ups Settings and setup, put "Code: X  Key: Y" in the message, and tell the parent on join.html to open the app and use it.

**B5. "No thanks" does not switch sharing off on a device that already said Yes.** (LIKELY, traced)
- Sees: a family re-opens a re-sent link, taps "No thanks"; the page says "Nothing will be shared", but `sendProgress` only checks `isPilot()` (still true) and keeps posting.
- Where: `public/join.html:208-215` writes `slpShare:false` only; `public/sona.js:10248` ignores it.
- Fix: make `sendProgress` and `syncHomework` require `slpShare !== false`, and have "No thanks" call the forget route when the device is already enrolled.

**B6. Archive exists on the server but has no button.** (CONFIRMED by grep)
- Sees: "show archived" checkbox and an "archived" tag exist, but no way to archive or un-archive. A discharged child stays in "Gone quiet" forever; the only exit is "Remove from my caseload", which deletes the history.
- Where: `app/api/slp/child/route.ts:68-84` (POST archive); `public/slp.html:907,1550` read it. Nothing posts it.
- Fix: add Archive/Unarchive on the child page and a "Archive" row action.

**B7. A single-use sign-in link is burned by email scanners.** (LIKELY; depends on the school's mail filter)
- Sees: returning therapists with Microsoft Safe Links or similar open the email and get "That link expired".
- Where: `app/api/slp/auth/verify/route.ts:14` consumes the token on GET (`GETDEL`). The repo already knows the fix: the weekly-report confirm uses a button that POSTs.
- Fix: GET shows a "Continue to Sona" page, POST consumes.

**B8. An expired session looks like a flaky network.** (CONFIRMED with a 401 roster)
- Sees: after 30 days (or a cleared cookie) every action says "Couldn't refresh... try again" or "Couldn't assign... try again" forever; only the plan page handles 401.
- Where: `public/slp.html:1395-1412`, `1787`, `1851`, `1702`.
- Fix: one `fetch` wrapper: on 401, go to `/slp-login.html`.

**B9. A family that just joined is "Gone quiet" the same minute.** (CONFIRMED on the fake dashboard; a test pins it, see Decisions)
- Sees: Today's top group says "New family, no practice yet, Copy check-in message" and the sidebar badge turns on, minutes after consent.
- Where: `public/slp.html:1370` (`quiet = joined && lastN==null`), `1361` (`joined` is true from `meta.joinedAt`).
- Fix: count "quiet" only 3+ days after `joinedAt`.

### P2
- **B10. Note labels a sound-wide rate as "in the middle of words".** The note puts the homework's position on every line (`slp.html:1654-1659`) but `windowStats` counts every try for the sound, including "rrrr" and syllable tries that the pass-rate-by-position grid deliberately leaves out (`sona.js:4676-4687`). LIKELY. For Rachel.
- **B11. "No thanks"/consent text says "recordings stay on this device".** Nothing is saved any more (5 Nov). `public/join.html:197`. Say "audio is never saved or sent".
- **B12. Join links a household's active child only.** No "which child?" question for two children on one phone (`join.html:201`, `sona.js:3391`).
- **B13. A typo email makes an account you cannot get back into.** New accounts are signed in with no proof of inbox, then go to Stripe under that address (`app/api/slp/auth/request/route.ts` by design; the page says "We've also emailed X" but offers no "wrong address?").
- **B14. Bulk assign has no "select all".** With 60 children you tick 60 boxes (`slp.html:1561`). Confirmed no header checkbox.
- **B15. Child page lists the 8 weeks oldest first,** so on a phone the current week is at the bottom (`slp.html:1593`).
- **B16. Bulk composer renders under the first child's overview,** headed "Same homework for N children" (confusing).

## Experience problems
- **First 10 minutes (the school therapist).** About 8 forms: email, plan page, Stripe card, "Set up your family link" (name, clinic, code), Add a child (initials, age, sounds, position, reps, note, parent email), copy message, paste. Realistically 8 to 12 minutes before the first link is sent, and the card comes before she has seen one real screen. The hero "Start free trial" only creates an account; the trial starts at a second "Start my free trial" button, then Stripe. Nothing on the page before the fine print says a card is needed.
- **Locked page.** Clear on price, trial and cancel; the button is below the fold at 1280x800 (`dash-locked-d-today.png`), and the brightest button in the bar is "Download the app" (family app, wrong action for a clinician who has not started).
- **Message to parents** says "set them up in about 30 seconds" (`slp.html:1827`, `for-slps.html:369`): setup is about 11 screens.
- **Terms mix:** "Words a day" (quick), "Reps a day" (custom), "tries" (note), "attempts" (grid). Pick one.
- **slp-login.html** is the old blue/green look (`slp-login.html:30-76`), off-brand next to the cream and teal pages; "SLP toolkit" and "Patient dashboard" chips name things that do not exist or break the register ("children", never "patient").
- **60 children** works (table, filters, search, sort, Today groups cap at 10 with "See all"), but there is no bulk invite, no select-all, and no archive.
- **Phone:** Today, child, plan and Settings fit at 390px. Row actions are small (about 36px).

## Improvements, ranked
1. **Put Stop sharing in Settings** (B1). Why: a consent promise that cannot be kept. High / Small / engineering (Travis to confirm).
2. **Send progress when a session ends** (B2). Why: the product's one job is "see who practiced"; today it is a session late. High / Small / engineering.
3. **Bridge the app** (B4): "Connect with my speech therapist" in the app, code and key in the message. High / Medium / Travis.
4. **Let a locked or lapsed clinician remove children and export** (B3). High / Medium / engineering.
5. **Show a sample caseload before the card.** The three made-up children on the landing page, as a clickable demo dashboard on the plan page. SLP Toolkit, Boom Learning and Seesaw let you look before you pay. High / Medium / Travis.
6. **Add Archive** (B6) and a **bulk add** ("MK, JT, AB" with one sound) plus a printable/QR handout, as ClassDojo and Seesaw do with class codes and invite sheets. High / Medium / engineering.
7. **Scanner-safe sign-in** (B7) and **session-expired redirect** (B8). Medium / Small / engineering.
8. **Fix the "quiet" rule for new joiners** (B9). Medium / Small / Travis.
9. **Tidy claims** (see Decisions) and reword the parent message. Medium / Small / Rachel+Travis.

## Versus the best apps
- ClassDojo / Seesaw / Duolingo for Schools: one class code or QR joins a whole class; Sona needs one link per child, one form per child. They also show a first-run sample class.
- SLP Toolkit, Boom Learning: try before paying, and Boom hands out an assignment link that opens in the browser with no install; Sona's link ends in a split between browser and app.
- Duolingo's teacher view shows recent activity in near real time; Sona's lags a session (B2).
- All of them let a teacher archive a student at year end (B6).
All of these fit Sona's rules (none needs audio, scores, or child data beyond what is already consented).

## Decisions worth another look
- **Card up front on a 14-day trial** (Travis, 12 Nov) means no look before paying; a sample dashboard would lower the ask without changing the price.
- **"Gone quiet" for a brand-new family** is pinned by `slpdesigntest` (attention filter lists "New family"). Reason to change: it trains therapists to ignore the badge.
- **"Sona holds a sound back until a child is typically old enough" is false** (for-slps `:433`, also parents.html `:589,731`). `SOUND_NORM` only drives grey labels and the books' word moment (`library.html:1779`, `settings.html:548`); a 3-year-old can be given R. CLAUDE.md itself says there is no gate. A district reader testing this finds it. For Rachel: build the gate or change the words.
- **Known Safari/app gap** (B4): now more important than when it was "left for Travis".
- **Home calls `syncHomework`** (`today.html:745`), which writes the homework cache and posts reps for enrolled children; the rule says Home writes and sends nothing.
- **Progress payload** also carries per-word results (`byWord`) and sessions/streak (`sona.js:10261`); consent text lists "pass rate per sound" only.
- **"Cancel anytime... keep everything to the end of the month you paid for"** reads oddly in a trial (nothing paid yet).

## Already good (keep)
- Honest register: "pass rate", "too few to read" under 20, the copied note's hedge, the CSV's header line.
- No audio language is consistent and true on for-slps; first name only, entered by the parent; initials-only invites; the invite email is used once and not kept.
- Plan page: every state (trial, paid, cancelling, past due, yearly, grandfathered, locked) has its own words; the Stripe return and "Check again" are careful.
- Everything from the roster is escaped; copy buttons confirm only when the clipboard accepted; loading, empty and error states exist; Today caps lists and offers "See all".
- Removing a child tombstones them so the family's phone cannot rebuild the row; rotate-key warns plainly.

## Not checked
- Stripe checkout, portal and webhook routes, and the server side of `/api/pilot`, `/api/homework`, `/api/slp/*` (another auditor).
- Real email delivery, Safari/iPhone behaviour of join, and a real mail scanner (B7 is traced, not run).
- The unit suites (`hwtest`, `caseloadtest`, `landingtest`); the 320px width; screen-reader use; a second tab racing a write.
- Pictures taken in `audit/clinician/` (script `probe.mjs`, `probe2.mjs`).
