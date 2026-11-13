# Grown-ups pages (Settings, Progress, Talk to us, the check, the backup)

## In five lines
1. Settings is tidy and every control saves itself; I found no crash in normal use and no sideways scroll at 375x667 or 320x568.
2. Two things in Settings do not do what they say: in the iPhone app "Restore" only checks the web (Stripe) by email and never asks the App Store, and "Undo last restore" does not undo a restore that changed the list of children.
3. Removing the first child does not delete them: name, age, the parent's email and all progress stay on the phone and go into the next backup.
4. Progress shows different numbers from the Monday email, and "Reset progress" leaves Progress saying "0 days practiced" next to "12 tries".
5. The "move to a new phone" backup is a long text code a parent must copy and paste. Nobody will finish that unaided; an account or iCloud would be the real fix.

## Bugs

### P1 - "Restore" in the iPhone app never asks the App Store (CONFIRMED)
- Sees: a parent in the app taps Settings > Account > Restore. A box asks "Email you subscribed with". They type it and get "No active subscription for that email" or "Couldn't check right now". The App Store is never asked, so a parent who paid on another iPhone or after a reinstall is told they have nothing.
- Steps: fake phone `app:"buy"`, `restore:"finds"`, `sync:"finds"` (the store HAS a purchase), set-up child, no plan. Open settings.html, tap Restore, type any email, tap Restore access. Store restore calls = 0, message "Couldn't check right now." (script `audit/grownups/t4.mjs`).
- Where: `public/settings.html:1132-1143` (restoreBtn calls `Sona.restore(email)`), `public/sona.js:3263` (that function only calls `/api/subscription?email=` which is Stripe, the website's checkout, which is switched off for families).
- Fix: in the app, make Settings' Restore call the same store restore the price screen uses (`iapRestore`) and show the email box only on the web. The price screen does have a working Restore Purchases, so Apple's rule is met; this is a trap, not a rejection risk.

### P1 - "Undo last restore" does not undo a restore that changes the children (CONFIRMED)
- Sees: a parent restores a backup (it brings a second child, "Leo"), changes their mind, taps Undo. The phone still shows two children and Leo is the active child. Page says "Put back".
- Steps: phone with one child (no children list saved yet), restore a backup made on a two-child phone, then Undo last restore. After Undo: kids = Mia + Leo, active = Leo (`audit/grownups/t2.mjs`).
- Why: the snapshot only holds keys that existed before. Undo writes them back but never removes keys the restore added (`sona.kids.v1`, the second child's slot). The confirm text promises "Puts this device back the way it was".
- Where: `public/settings.html:962-1014`, `public/sona.js` importData (~2688). A single-child phone has no `sona.kids.v1` at all, so this is the common case.
- Fix: before a restore, record the key list; on Undo delete every key that was not in the snapshot, then write the snapshot.

### P1 - Removing the FIRST child leaves all their data behind (CONFIRMED)
- Sees: parent taps Remove on the first child; dialog says "Their practice history is deleted from this device and can't be undone." It is not. The child's name, age, the parent's email, trophies, progress and tries all stay in storage, and "Copy backup code" includes them. The weekly report silently stops (its address lived on that child's profile).
- Steps: add a second child, switch to them, Remove the first. Afterwards `sona.profile.v1` (Mia, age, `parent@example.com`) and `sona.outcomes.v1` are still there and in `Sona.exportString()` (`t1.mjs`).
- Where: `public/sona.js:~486` in removeKid: `if (slot) { ... removeItem(k+"@"+slot) }` skips slot "" because the first child owns the plain keys; nothing else clears them.
- Fix: for slot "", delete the plain per-child keys too, but only after the next child no longer uses them (they never do; slots are never reused). Also this is a privacy-promise issue (privacy page and the dialog both say deleted).

### P1 - Child can reach Reset / Remove / Restore for 10 minutes after the parent leaves (LIKELY)
- Sees: parent opens Settings, taps "Back to play", hands the phone over. The child swipes back and is in Settings with no check. They can tap Reset progress or Remove (native OK/Cancel box only).
- Why: the pass lasts 10 minutes and renews on every tap on those pages; "Back to play" does not clear it. Settings re-checks only the timestamp (`settings.html:22-38`, `sona.js:3434-3470`).
- Fix: clear the pass when the parent taps "Back to play" (and on Home load), and cap one pass to about 5 minutes absolute.

### P2 - Reset progress leaves Progress contradicting itself (CONFIRMED)
- Sees: Progress "Practice this week: 12 tries, 0 days practiced" with all bubbles empty, after Reset. Tries come from one ledger (not reset), the day bubbles from another (reset). The dialog says only "practice steps and coins".
- Where: `sona.js:4695 resetProgress` (saves the default progress record, which also holds `practiceDays` and the streak); `progress.html:164-182`.
- Fix: say "and this week's practice days" in the dialog, or stop Reset clearing `practiceDays`.

### P2 - Progress and the Monday email count "days" differently (LIKELY)
- Sees: a child plays games every day (goal met 5 days). The email says "Said their sound out loud on 5 days". Progress says "1 day practiced" (or 0). Headline "tries" counts only the practice page; the games number is a small grey line.
- Where: `sona.js:_reportKid ~9300` counts every rep; `progress.html:164-182`, `momWeek()` count only practice-page days.
- Status of the rule: Travis chose the bubbles ("a bubble is a day with practice"). See Decisions.

### P2 - A hand-made or damaged backup can break Settings (CONFIRMED)
- Steps: restore `{"data":{"sona.kids.v1":"{\"active\":\"\",\"list\":[null]}"}}`. "Restored 1 items", then Settings throws `Cannot read properties of null (reading 'slot')`; the family list is empty and the page half-works. A cut-off code gets "Couldn't read that backup code." (fine but could say "looks cut off").
- Where: `sona.js _kids()` (~line 291) trusts the list; `importData` writes any `sona.*` key as-is.
- Fix: in `_kids()` keep only entries that are objects with a string `slot`; in importData validate `sona.kids.v1` shape before writing.

### P2 - "Add a kid" makes the new child the one playing before their setup is done (LIKELY)
- Sees: parent adds a sister, setup opens, parent gets interrupted and closes the app. Next launch the unfinished child (default sounds R,S,L,K) is the active player; first child's practice is credited to her until someone returns to Settings and taps Switch.
- Where: `settings.html:1201-1212`, `sona.js addKid ~330` (sets active at once).
- Fix: only make the new child active when setup finishes; or on Home, if the active child is not set up, offer to go back.

### P2 - Age and name accept anything and say "Saved" (LIKELY)
- Age 0, 1, 40 or 4.5 saves silently (4.5 counts as "not a little kid" because `playStyle` needs a whole number 2-4). A blank name saves. Changing age 4 to 5 silently swaps the child's game shelf, book word asks and first games, with no hint on the page.
- Where: `settings.html:514-540`, `sona.js:1758 playStyle`.
- Fix: clamp 2-14 whole numbers on save; under the age box say what it changes ("Age 5 and up shows the bigger-kid games").

### P2 - Talk to us is not "one screen" on small phones (CONFIRMED)
- At 320x568 the page is 830px tall; the email placeholder is cut ("Want a reply? Your email (optio"); "Co-founder" wraps under Rachel's name; the message box is one line tall with a resize handle. At 375x667 it is 705px: Send sits at the fold.
- Where: `talk.html` CSS (`textarea{height:46px}`, avatar rows). Picture: `audit/grownups/s-talk-320.png`.

### P2 - Backup safety copy can eat storage and is never cleaned (LIKELY)
- The restore stores a full copy of the old data under `_sonaPreRestore` forever (it holds names and the parent's email). On a near-full phone the copy silently fails, the restore goes ahead, and Undo is simply missing. Restore also reports "Restored N items" without saying if some did not fit.
- Where: `settings.html:992`, `sona.js importData`.

## Experience problems
- **Progress after week one (picture grown-progress-full.png).** A new parent sees an empty page: "0 tries this week", seven empty circles, "Last week: 0 tries", "Accuracy by sound - Coming soon", "Sounds appear here after sound practice." In ten seconds they learn nothing. After a week they learn: tries, which days, and a row like "R sound - 12 tries - Sound". "Sound" as a level name is unexplained. The tries on that row are all-time, not this week, with no label saying so.
- **Games-only children look like they did nothing.** The big number is practice-page tries only. The honest total is a small 12.5px grey line.
- **Practice levels** show a ladder step ("Words") but not what the next step is or that steps rise; no "what to do next".
- **Two or more children:** Progress has no child picker. A parent must go to Settings, Switch, reload, open Progress, and repeat for the sibling.
- **Settings > Weekly progress report (picture grown-settings-full.png):** the "We'll also send occasional tips from Rachel" line sits glued under the Turn on button in a bigger font than the helper text above it.
- **What is missing that a parent looks for:** a Sona version number (needed for bug reports), a way to delete everything (only "Reset progress"; the only child cannot be removed), the daily goal (removed on purpose), sound on/off for Echo (only "Turn sound on" appears, and only when muted), a daily reminder time after the free trial, a "how it works / help" page, and a plain "Cancel subscription" in Settings (it is two taps away on the plan screen, not here).
- **The Account line for a free-version family** is long: "Plan: none yet - Sona Premium opens daily practice, every game and every book - See Premium - Restore" wraps to three lines and Restore looks like a body-text link.
- **Backup wording:** "Moving to a new phone?" is a quiet underlined link at the very bottom; the steps ("Copy the code here, then paste it on the new phone under 'Restore from a backup code'") need two phones and clipboard know-how.
- **The check (four number words):** words are ZERO..NINE in capitals plus a 0-9 pad. A 6-year-old who reads number words passes it, and wrong answers allow unlimited retries with the same question. It is in line with Apple's gate style, but it keeps a 6-7 year old reader out only until they read. Pass lasts 10 minutes, renewed by any tap on a grown-up page (no absolute limit).

## Improvements, ranked
1. **Make Settings' Restore ask the App Store in the app.** Why: a paying parent on a new phone is told they have nothing. High / Small / engineering.
2. **Real Undo and real delete.** Undo removes keys the restore added; removing a child deletes slot-"" keys; add a plain "Delete everything on this phone" in Settings (twice-confirmed). High / Small-Med / engineering (Travis for the wording of the delete).
3. **Replace the pasted code with something a parent can finish.** Best options: (a) a short "send to my new phone" link using iCloud key-value storage in the app shell; (b) "Sign in with Apple" with a tiny server record of the backup (needs a privacy-policy change: today nothing about a child is held by Sona); (c) at the least, "Share" button (iOS share sheet) and a QR/short code. Also say plainly that an iPhone-to-iPhone transfer or iCloud backup usually carries Sona (UNSURE: I could not check where the app shell's web storage lives). High / Large / Travis.
4. **Close the grown-up pass when the parent leaves** ("Back to play" clears it, 5-minute absolute cap) so a back-swipe cannot reach Reset or Remove. High / Small / engineering.
5. **Give Progress a story in ten seconds.** One sentence on top in plain words ("Mia practiced on 4 days this week and said her sound 86 times"), one line "what's next" from the step ladder ("Next: words"), a child picker on the page, and the same day count as the Monday email. No percentages, no grades. Med-High / Med / Travis + Rachel (wording).
6. **Fix Progress vs email day counts** (use the same ledger, label which). Med / Small / Travis.
7. **Settings footer facts:** version, "How to cancel" link to the Apple subscriptions page, "Help", and auto-attach version and app/web to a "Something's broken" message (never anything about the child). Med / Small / engineering.
8. **Backup hygiene:** validate the backup's shape, clean `_sonaPreRestore` after 30 days, warn when part of a restore did not fit. Med / Small / engineering.
9. **Validate age (2-14, whole number) and say what changes with it.** Low-Med / Small / engineering; the age rules are Rachel's.
10. **Talk to us at 320 wide:** shorten Rachel's card, bigger message box. Low / Small.

## Versus the best apps
- **Duolingo / Khan Kids / Lingokids:** a parent account (email or Apple sign-in) means a new phone just works and progress is on any device. Sona is the only one here where the family's history lives on one phone plus a pasted text. Fits Sona's rules only with a clear privacy-policy change; the minimal form is iCloud inside the app shell.
- **Lingokids / Khan Kids parent zone:** progress by skill with "what they're learning now" and a plain sentence. Sona's Progress has the data but shows numbers without a sentence. No grades needed: "Mia said her R sound 86 times on 4 days" is a count, not a verdict.
- **Speech Blubs:** a weekly milestone recap the parent can share. Sona already has the Monday email; Progress should echo it (and match it).
- **Headspace/Calm:** a Settings footer with version, support, cancel, delete account. Sona lacks delete and version.
- **Apple Kids guidance:** a parental gate should be randomly worded and not retry-able forever; Sona's is random but unlimited. A short lockout (3 wrong tries, new question, 30 seconds) costs a parent nothing.

## Decisions worth another look
- **Bubbles = practice-page days, tries = practice-page only (Travis, 5 Nov; CLAUDE.md "The grown-ups' pages, simplified").** The Monday email, the Home ring and the goal all count games and books. A family that mostly plays games sees a thin Progress next to a full ring. Reason to revisit: the same parent sees two different "days" numbers in one week. Could keep "practice" bubbles and add a second line "Active days: N" without changing any clinical count.
- **No daily goal control anywhere (Travis, 5 Nov).** A parent who chose 15 minutes in setup, or 5, cannot change it later. A reason to allow it back inside Settings behind the check.
- **"Each day's practice starts with" lets a parent skip the sound and syllable steps (Travis 22 Oct, Rachel approved 9 Nov).** Already Rachel's; just noting this is a real clinical lever sitting in a plain dropdown.
- **The backup code includes the child's name, age and the parent's email in plain text** (the code says it is a text you copy). Setup's two private answers are kept out for the same reason; the name and email are not. Rachel/Travis may want the code to leave the name out.

## Already good (keep)
- Autosave on every control with a "Saved ✓" pill beside what changed, and the stale-page guards (a back-swiped Settings for another child reloads rather than saving over them).
- One-line sounds summary with a Change button; "Keep at least one sound"; target sound can only be one of the picked sounds; homework locks the pickers and says why.
- Weekly report switch: nothing is sent until the address confirms, offline Turn off is remembered and retried, the card hides where it cannot apply.
- Backup refuses entitlements, free-era stamps and board keys; bad JSON, empty and cut-off codes fail cleanly with no data written.
- Talk to us posts only a fixed set of fields (never a name or code), honeypot, rate limit, origin check, keeps the draft on a failed send, and never joins a mailing list.
- No horizontal scroll at 375x667 or 320x568 on any of the three pages.

## Not checked
- Whether the iPhone app's web storage is carried by iCloud/iPhone-to-iPhone transfer (needs a real device).
- The "Founder key" and mic-numbers taps, the Practice Board card (switched off), the clinician card.
- A very large backup against the phone's storage limit.
- The grown-up gate on a real iPhone (hold-to-pass, VoiceOver). I read `today.html:765-835` only.
- listen.html beyond its header (it is an internal syllable audition page, behind the same check).
- Stripe-side `/api/subscription` and what a real web buyer sees on Restore.
