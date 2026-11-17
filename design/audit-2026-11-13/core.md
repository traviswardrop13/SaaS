# Core (storage, loading, offline, tracking, old pages)

## In five lines
1. Both claims from the other auditor are TRUE (confirmed on the fake phone): removing the first child leaves their name, parent email and progress on the phone and in the next backup; "Undo last restore" leaves a restored child in place (for the most common family, one child who never added a second).
2. With no internet the iPhone app has nothing: no offline page, no service worker, no `errorPath`. The family sees iOS's own error, and a mid-session tap on a game that fails to load can do the same.
3. Two old pages still on the site send a child's first name to our server: `story.html` (to an AI writer) and `coach-call.html` (to the voice server). Both open by typed address.
4. Speed is acceptable (Home is 17 requests, sona.js is the one heavy file, no stuck-on-old-copy risk). The cheap wins are caching fonts/pictures and trimming dead code out of sona.js.
5. Storage code, sweeps, dates and the Board are in good shape. The Board is fully off on a real phone. No missing `Sona.*` names (one is feature-checked).

## Bugs

### P1
**B1. Removing the FIRST child deletes nothing (CONFIRMED).**
- Sees: a parent taps Remove on the first child in Settings. The child vanishes from the list. But the name, the parent's email (which can also drive the weekly report address), practice history, trophies and goal days are all still in storage and go into the next "Moving to a new phone?" backup. The privacy page and the "Remove" wording say the data goes.
- Steps: set up Mia, add Leo, switch to Mia, Remove Mia. Fake phone result: the list is `[Leo]`, but `sona.profile.v1`, `sona.attempts.v1`, `sona.quest.v1` still hold Mia / `mom@example.com`; `exportString()` still contains the email.
- Where: `public/sona.js:462` — `if (slot) { PER_KID.forEach(... removeItem(k+"@"+slot)) }` skips slot `""` because the first child owns the plain, unsuffixed keys. The comment at 459 says "only a suffixed slot is safe to clear", but nothing clears it afterwards, and `_dropRecordings` only clears clips.
- Also: a corrupt/empty `sona.kids.v1` makes `_kids()` re-seed slot `""` from those leftover keys (line 328-331), so the removed child can come back.
- Fix: when slot is `""`, `removeItem` the plain PER_KID keys too, but only after the next child has been moved to a suffixed slot or after copying (the first-child keys are shared with nothing else, so simply delete them; keep the global keys). Add a test that exports after removal and finds no name/email.

**B2. "Undo last restore" does not remove a child the restore added (CONFIRMED).**
- Sees: a one-child family restores a backup that had two children, sees "Leo" appear, taps Undo ("Put this device back the way it was"). Message says "Put back". Leo is still there with all his data.
- Why: the snapshot is taken with `exportString()`; a family who never added a second child has no `sona.kids.v1` key at all (`_kids()` makes the list in memory only), so the snapshot has no child list. Undo is another `importData` (merge), and a merge never deletes keys. Fake phone: after restore + undo the list is still `["Mia","Leo"]`, and `sona.profile.v1@k2` stays.
- Where: `public/settings.html:962-1014` (snapshot at the restore button, undo at `undoRestore`), `public/sona.js:2716` `importData` (only ever `setItem`).
- Also true for any key the backup had that the phone did not: undo cannot remove it. Even when a child list exists, the added child's `@k2` data keys stay as invisible leftovers that ride into later backups. A second restore overwrites the snapshot, so only one step back exists.
- Fix: for undo, delete every `sona.*` key not in the snapshot (except NO_EXPORT/NO_IMPORT keys) before importing it; or snapshot `localStorage` as raw key/value pairs and put it back exactly.

**B3. `story.html` sends the child's first name to a server and an AI service (CONFIRMED by reading; not run).**
- Sees: nothing; a typed `/story.html` (the hidden Library tile `#advTile` can also open it) writes a themed story. It posts `{name: NAME, interest, sound ...}` to `/api/story`, which builds a prompt "The hero is the child, named ${name}" for the Anthropic SDK.
- Where: `public/story.html:137` (NAME from profile or `?name=`), `:173` (fetch), `app/api/story/route.ts:75-93,205`.
- Rule broken: a child's name never leaves the phone. Gate: `Sona.gated("story")` only blocks after the demonstration ends, so a new family can open it. It also opens the mic with no `MIC_PROMISE`.
- Fix: delete `story.html`, `/api/story` and the hidden tile (nothing links to them; `chapter.html` too). If kept, drop the name.

**B4. `coach-call.html` speaks lines that contain the child's name through `/api/tts` (LIKELY).**
- Lines like "Well HI, Mia! …" (`public/coach-call.html:166,290-305`) are posted to `/api/tts` at `:202`. Opens the mic (`:418`), no promise line. Nothing links to it except `tests/calltest.mjs`.
- Fix: delete, or say the name only in recorded/fixed lines.

### P2
**B5. `check.html` (Speech Check) loads the Meta pixel with automatic matching on, on a page with a "Child's first name" box and an email box (UNSURE).** `public/check.html:17-18,78`. Setup turns Meta's auto-read off for exactly this reason (`data-autoconfig="off"`); this page does not. Page is `noindex` and nothing links to it. Fix: delete it, or add `data-autoconfig="off"`.

**B6. A family's streak can restart once a year at the autumn clock change (LIKELY).** `bumpStreak` works out "yesterday" as now minus 86,400,000 ms (`sona.js:769`). On the 25-hour day, late evening minus 24 hours is still the same date, so a child who practiced the day before gets streak 1. Fix: use `new Date(y,m,d-1)` for yesterday. Only an hour of one night; low harm (and streak is not shown to the child as guilt).

**B7. Silent data loss when storage is full or blocked.** `save()` (`sona.js:350`) swallows every error. A full phone or a private window quietly stops saving practice, trophies and goal days; nothing tells a parent. Fix: have `save()` set a flag; show one grown-up-only line in Settings ("This phone can't save practice right now").

**B8. Sticker sheet is injected without checking the response (LIKELY).** `sona.js:6740` `fetch(...).then(r=>r.text())` has no `r.ok`; during a Vercel error/outage the error page's HTML is put into every page's body (hidden at 0x0, but junk in the DOM). Fix: `if(!r.ok) throw`.

**B9. Subscribe page's "one reader of free time" is not one reader.** `subscribe.html:1435` calls `Sona.planFree`, but sona.js never exports it (`planFree` exists at `sona.js:8857`, not in the export list at 10412), so the page always uses its own days/weeks-only copy; a "1 month" offer reads as "odd" there but may read fine in sona.js. Fix: export `planFree`.

## Experience problems
- **No internet:** open the app on a plane: iOS shows its own "can't load page" screen (no Sona face, no retry, no "practice your downloaded words"). A child (or a parent) hits this on every flight and in any dead spot. Nothing is saved on the phone to open instead.
- **Every page change is a network round-trip.** Home, a game and the practice page are full page loads; sona.js (and each CSS/picture) is re-asked on each ("no-cache"): 304s are small but each one is a wait on cellular.
- **Setup, price and tapping a game all assume the net.** The price screen handles "couldn't reach the App Store" well (a real card). Home does not say anything when pictures don't arrive.

## Improvements, ranked
1. **A friendly "no connection" screen** (High impact, Small effort, engineering). `server.errorPath` in `capacitor.config.json` (Capacitor 8 supports it) pointing at one small local HTML page: Echo, "No internet right now. Try again", a retry button. Needs an app build (Travis's App Store task).
2. **Fix B1 and B2** (High, Small, engineering): data-deletion promises must be true.
3. **Delete the dead pages and routes** (High on privacy, Small): `story.html`, `chapter.html`, `coach-call.html`, `check.html`, `pilot.html` (kept only for clinician links; check), `founders.html` if unused, `map.html` stub, `app/api/story`, `app/api/chat`/`coach` if unused. Remove `advTile` in library.
4. **Cache fonts and pictures.** `/fonts/*` and `/assets/**` now revalidate on every load (Vercel default). `Cache-Control: public, max-age=31536000, immutable` for fonts, and `max-age=86400, stale-while-revalidate` for `/assets/**` (art files that change get a new name, as the `-v2/-v3` files already do). Cuts about 20-45 conditional requests per page (Medium, Small, engineering).
5. **Trim sona.js (713 KB, 230 KB gzipped, on every page).** The line ranges you listed for old engines (1188-1877, 2210-2613, 2823-2940, 3833-4290) are about 130 KB of source (18%). The exports `episode*`, `dailyStory`, `chapterScene`, `storyRead`, `dailyGames`, `mysteryGame`, `pathState`, `GAME_LEVELS`, `markLevelDone` etc. are used by no html page. Verify each against tests, then cut. Also `defer` the script where the page allows (Medium, Medium).
6. **A tiny offline shell via service worker** (Medium, Large, UNSURE): iOS web views only allow service workers on "app-bound domains"; check before promising. Without it, a native-bundled "last words" page is the alternative.
7. **A "can't save" notice** (B7) (Low-Med, Small).
8. **Practice-board and old-story code in the phone file:** the Board's phone half (about 360 lines) is OFF and shipped to every phone; consider loading only when `BOARD_LIVE` (Low, Medium).

## Versus the best apps
- **Khan Academy Kids, Pok Pok, Toca Boca, Sago Mini** download their content to the phone and run offline; a child can play on a plane. Sona is a website in a frame. Fits Sona's rules; needs bundling a small free set (Fruit Slice, Feed Echo, the free book) in the app or a service worker.
- **Duolingo** keeps a lesson queue and syncs later; a lost connection never ends a lesson. Sona's practice page and most games already run on-device after loading, but a page change needs the net.
- **Headspace/Calm** "download for offline". A parent-facing "Download for the car" could fit Premium later (Travis's call).

## Decisions worth another look
- The first-child unsuffixed key design (`sona.js:263-272`) is why B1 happened. Moving the first child to a suffixed slot is a migration; deleting the unsuffixed keys on removal is the simple route.
- `check.html` / `pilot.html` / `founding.html` / `founders.html` / `trial.html` / `coach-call.html` still carry the old business (free-forever promises, $4.99 and $59.99 text in `trial.html:96-129`, which the Terms and App Store flow no longer match). Travis/Rachel to decide delete vs keep. `trial.html` is still linked from `for-slps.html`, `premium.html`, `slp.html` and `subscribe.html`, so check before deleting.
- Error beacon `/api/log` (every page, first-party) sends raw error messages (`sona.js:4560`); today it holds no name, but an error that quotes the page could. Low.

## Already good (keep)
- Storage layer: `load/save/kkey/saveFor` are consistent; `PER_KID` matches what pages write (I found no per-child key outside it); attempts log capped at 600; sessions at 50; practice days pruned at 130 days. Broken JSON returns the default and never crashes a page.
- Backup/restore lists: `NO_EXPORT`/`NO_IMPORT` are complete and match; entitlement stamps, era stamps, Board keys never cross.
- The five era sweeps, `_keepFreeVersion`, `_keepBuddies` are one-shot, read only their own stamp (or none), run before setup, and can't be set by a backup (all on NO_IMPORT).
- Dates are the phone's local day almost everywhere (`_localDay`), with weeks from local Mondays; no UTC mixing found except the one DST hour in B6.
- Tracking: kid pages load no third-party script; `analytics.js`/`pixel.js` are only on check, for-slps, onboarding, parents, settings, subscribe, try; pixel is off in the app; PostHog autocapture/replay off by default, a hard property whitelist, name blocker in recordings.
- Cache headers use `no-cache` (revalidate), so a deploy is live on the next load and a phone cannot get stuck on an old copy (no service worker exists).
- The Board is fully dark: `BOARD_LIVE=false`, `boardLive()` only true on localhost with a session flag.
- No `Sona.*` call to a missing function (checked all 402 exports against every page; `planFree` is the only drift, B9).

## Not checked
- `pilot.html`, `founding.html`, `founders.html`, `listen.html`, `trial.html` were only scanned for hosts, mic, price and name (they do not post a child's name); `app/api/chat` and `app/api/coach` use not traced.
- Real iOS behaviour of `errorPath` and service workers inside the Capacitor web view (no device).
- Gzip/brotli sizes on Vercel (the fake phone serves uncompressed; I used `gzip` locally: sona.js 230 KB).
- Whole-battery runs (not allowed). Cold-open numbers from the fake phone (uncompressed): Home 17 requests / 1.2 MB (sona.js 697 KB); practice page 44 requests / 2.4 MB (33 pictures, 1.4 MB); Fruit Slice 24 / 1.4 MB; Library 23 / 1.8 MB; Settings 11 / 1.0 MB.
- The ghost-data-reuse chain (undo leftovers inherited by a later new child with the same slot) is reasoned from `addKid`, not reproduced.
