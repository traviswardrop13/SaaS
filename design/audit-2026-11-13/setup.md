# Setup (first launch to the first game)

How I checked: read all of `public/onboarding.html`, its three style sheets, the two demo scripts and the listed parts of `sona.js`; looked at every setup picture; then ran the real pages on the tests' fake iPhone (scripts and pictures in `audit/setup/`, pictures in `audit/setup/png/`). "CONFIRMED" below means I made it happen there.

## In five lines
- Setup is solid and safe: nothing crashes, a child's name is never put on a page as raw code, every wait has a limit, and the answers survive an interruption.
- It is long before anyone plays: **12 screens and at least 13 taps to reach the price, 17 screens and at least 16 taps (plus 3 or 4 iPhone pop-ups and five spoken tries) before fruit flies.** The progress bar says "done" at screen 9.
- Two questions change nothing at all ("What does Mia love?" and "Is Mia in speech therapy?"), and one answer can never be changed later (minutes a day).
- The sound picker opens with **R already ticked**. A parent who taps only their child's sound ends up with R plus that sound, and the first thing the child is asked is "rrrr".
- The free round before the price (built, switched off) looks safe to turn on; three small things to settle first are listed under bug 10 and in "Improvements".

### The count (question 1)
Walk today on an iPhone that can buy: hello > name and age > Fruit Slice demo > Piano Tiles demo > Rachel > what they love > speech therapy > sounds > minutes > email > ("Building…" 2.2 s) > ready > reminders > **price** > microphone > hand the phone over > "Say it 5 times" page > **Fruit Slice**.

| | Screens | Taps (fewest) | Time |
|---|---|---|---|
| App open to the price | 12, plus the 2-second "Building…" | 13 and typing a name (14 with "Turn on reminders", plus iPhone's Allow box) | 12.5 s is the floor a machine can do (each screen locks taps for half a second, the build beat is 2.2 s). A parent who reads: about 60 to 90 s. |
| App open to the child playing | 17 | 16, plus Apple's buy sheet, the microphone box, the speech box, then the child says the sound five times | About 2.5 to 3.5 minutes at best (my estimate; the five tries were not timed). |

### Does every answer do something? (question 2)
| Answer | Where it is used later |
|---|---|
| Name | Every heading, the price screen's headline, Home. Never leaves the phone. |
| Age (2–4, 5–6, 7+) | Little-kid or big-kid games first, short or long stories, the protections for ages 2–4 (no syllable cards, no blends). Can be skipped: then the child counts as 5 or older. |
| **What they love** | **Nothing.** Saved on the profile (`profile.interests`); the only readers are two parked pages no child can open (`library.html:297`, `story.html:146`). |
| **In speech therapy?** | **Nothing a family sees.** Saved (`sona.setupasks.v1`); the only thing read back is "was this family asked", so it is not asked twice (`sona.js:10231`). |
| Sounds | The practice sound, Day 1's story, Home's "Your sound" badge, the bookshelf, the games' words. |
| Minutes a day | The daily goal (3, 5, 10 minutes = 18, 30, 60 reps): Home's gift ring, the daily chest, trophies. **No page can change it afterwards.** |
| Email | The weekly report (after a confirm email), the welcome emails, RevenueCat. |
| Reminders yes/no | The daily nudge and the "trial ends tomorrow" notification, during the free trial only. |
| Microphone yes/no | The iPhone permission. |

## Bugs

No P0 found.

### P1

**1. The sound picker opens with R already ticked, so many children start on R by accident. (For Rachel and Travis: it changes what a child is asked to say.)**
- Sees: on "Which sounds?" the R tile is already picked. A parent whose child works on S taps S and Continue. The ready screen says "Sounds: R · S", Home's Day 1 becomes the R story, and the first page the child gets says **"Say rrrr"**. A parent who just taps Continue gets R alone. It happens for a 2–4 year old too.
- Steps: new setup, age 2–4, on the sounds screen tap only S, Continue, go on to the first game.
- Where: `public/onboarding.html:602` (a new family's list starts as `["R"]`), `:934`, `:1098` (the sounds are saved in the order picked, so R is first).
- Status: CONFIRMED (picture `s9-sounds-R-and-S.png`; saved sounds `["R","S"]`, story `robo`, practice page "Say rrrr", age 4).
- Fix: start with nothing ticked; Continue stays grey until a sound is tapped ("Not sure? Pick all sounds" stays as the way out).

### P2

**2. Closing the app in the middle of setup sends the parent back to the first screen.**
- Sees: the answers are still filled in, but the app opens on "Little sounds. Big adventures." again and every screen has to be tapped through again (seven taps to get back to the sounds).
- Steps: walk to "Which sounds?", reload the page (what an iPhone does after the app is closed or the page is thrown out of memory).
- Where: `public/onboarding.html:799` (always starts at screen 0); the saved draft (`:630-648`) holds answers, not the place.
- Status: CONFIRMED.
- Fix: keep the screen's name in the draft and open on it.

**3. "Not sure? Pick all sounds", then Back, shows nothing picked and a Continue that does nothing.**
- Sees: after choosing all sounds and coming Back, no tile is lit, nothing says "all sounds", and Continue is grey. The only way on is to find the small link again.
- Where: `public/onboarding.html:955-960`, `:934`, `:826`.
- Status: CONFIRMED (picture `s3-sounds-after-pickall-back.png`).
- Fix: show "All sounds" as chosen and let Continue go on.

**4. A brother or sister added in Settings, whose setup is not finished, gets Home with four sounds nobody picked.**
- Sees: a parent adds "Ben" in Settings, the app opens setup, the parent closes the app. Next time Home opens for Ben with "Your sound: R" and the R story. Ben's sounds are R, S, L and K, the old built-in list.
- Where: `public/today.html:24` and `:291` (Home only sends a child to setup when there is no name, and Settings always gives one); `public/sona.js:427-431` (`addKid`), `:254` (the default list).
- Status: CONFIRMED (picture `s4-home-unsetup-sibling.png`).
- Fix: Home sends an added child who is not set up back to setup.

**5. The age can be skipped, and then a little child is treated as 5 or older.**
- Sees: Continue works with a name and no age. The child then gets the big-kid games first and the long stories, and none of the protections meant for ages 2–4.
- Where: `public/onboarding.html:1329` (only the name is checked); `public/sona.js:1758-1761`.
- Status: CONFIRMED (saved age "", play style "arcade").
- Fix: ask for the age before Continue goes on (it is one tap). For Rachel to know: the 2–4 protections depend on it.

**6. The weekly report needs a confirm email, and setup never says so.**
- Sees: "See their progress every Monday", "Get the report". Nothing arrives unless the parent finds a second email ("Confirm your weekly progress report") and taps its button. A parent who misses it gets, on Mondays, an example email with made-up numbers.
- Where: `public/onboarding.html:304-318` (no such line), `:1503-1508` (the confirm email is sent as setup ends).
- Status: LIKELY (traced in the code and the rulebook; no email was sent here).
- Fix: one line where the parent will see it, for example on the ready screen: "Check your email to start the weekly report."

**7. The hand-off says "Hand the phone to Mia!" even when the microphone was skipped or refused.**
- Sees: the parent taps "Not now" on the microphone, then hands the phone over. The child lands on "Let Echo hear you! … Turn on Echo's ears / Not now", a grown-up's question, followed by iPhone's own Allow box in a child's hands.
- Where: `public/onboarding.html:863`, `:1612-1619`.
- Status: CONFIRMED for what the practice page shows (picture `r2-practice-no-mic-yet.png`); the iPhone box itself cannot be shown here.
- Fix: when the microphone is not on, the last screen should ask the grown-up to turn it on (or go Home), not hand the phone over.

**8. The reminder always says "5 minutes", whatever the parent picked.**
- Sees: a parent picks 3 or 10 minutes; the example on the reminder screen and the real notification both say "Ready for 5 minutes of practice?".
- Where: `public/onboarding.html:383`, `public/sona.js:9883`.
- Status: CONFIRMED by reading (fixed words).
- Fix: "Ready to practice? Echo is waiting to play." (Travis's and Rachel's words.)

**9. The name box takes any length in setup; Settings stops at 24 letters.**
- Sees: a 66-letter name is saved and wraps to five lines on the ready screen and four on the price screen (nothing overlaps at 390×844).
- Where: `public/onboarding.html:185` (no `maxlength`); `public/settings.html:165`, `:185` have 24.
- Status: CONFIRMED (pictures `s2-ready-evilname.png`, `s2-price-evilname.png`).
- Fix: `maxlength="24"` on the box.

**10. The free round (switched off today): three things to know before it is switched on.**
- (a) A parent who taps "Not now" on the microphone still gets the round, and six seconds in the game asks iPhone for the microphone by itself. If they say no again, the round ends after the first wave and the price shows, without the parent ever seeing what Sona does. CONFIRMED that the game asks (one microphone request 9 s into the round; picture `s7-freeround-9s.png`); the ending is from the code (`public/arcade-sayit.js:304-307`; `public/arcade-slice.html:782-788`, a failed microphone request ends the round).
- (b) The reminder screen ("Want reminders during your free trial?") then comes before the free round, two screens further from the price than today. `public/onboarding.html:754`.
- (c) Reloading the page in the middle of the round starts a fresh round. CONFIRMED. There is no reload in the iPhone app and closing the app ends it, so no family can use this; it is only a correction to the rulebook's "a reload never makes another". `public/arcade-slice.html:263`.

**11. On a 4-inch phone (320×568) with a long name, "Skip" on the "love" screen sits under the Continue button.** CONFIRMED (picture `s6-320x568-interests.png`; the screen scrolls 41 px). `public/onboarding-studio.css:134-136`. Only the oldest small iPhones.

## Experience problems

- **Too long before anything happens.** Twelve screens of slides and questions, then a price, then permissions, then a practice page. Nobody plays until screen 17. This is the same pattern as Speech Blubs and Calm, but they show a result built from the answers; here two of the answers show up nowhere.
- **The progress bar fills up too early** (pictures `setup-09-minutes.png`, `setup-10-updates.png`). It has five parts and is full at "How long each day?". Then come the email, "Building…", ready, reminders, the price, the microphone and the hand-off. It also disappears on the two demos and Rachel and comes back later. `public/onboarding.html:808-817`.
- **"Mia's practice is ready!" is said twice in a row**: once as the ready screen, again as the price screen's headline (pictures `setup-11-ready.png`, `price-setup.png`).
- **The demos do not say the cause** (pictures `setup-03-reel.png`, `setup-04-piano.png`). "See speech help", "Normal speed", "After practice": nothing on the Fruit Slice screen says that the child's voice slows the game. "After practice" can be read as "after weeks of practice". Only the second demo's heading says it ("Say the sound to slow the keys."). The demos also slow down more than the real game does (to about 40–45% speed; the game slows to 55%): `public/onboarding-fruit-demo.js:187`, `public/onboarding-piano-demo.js:179`.
- **"What does Mia love?" promises a choice that changes nothing** (picture `setup-06-interests.png`). A parent who picks Dinosaurs expects dinosaurs.
- **The microphone screen gives no reason and no promise** (picture `audit/setup/png/s1-mic.png`): "Let Echo hear Mia", "Turn on Echo's ears", "Not now". This is the one permission Sona cannot work without. After the tap, iPhone shows two boxes one after the other, the microphone and then Speech Recognition (`public/onboarding.html:834-845`). The practice page's own version of this screen does carry "Grown-ups: audio is never uploaded or saved."
- **The reminder screen talks about "your free trial" before any trial has been offered** (picture `audit/setup/png/s1-remind.png`). It is the first time the parent hears of one.
- **The name screen does not say the name stays on the phone.** The therapy screen (whose answer does nothing) says "Your answer stays on this phone."; the name screen, where it matters most, says nothing.
- **An empty name only turns the box's edge red.** No words say why Continue did nothing (`public/onboarding.html:1329`).
- **Grey words on the yellow circle are faint**: "Skip" on the email screen and the small line on the reminder screen sit on the yellow shape at about 3.9 to 1 contrast (pictures `setup-10-updates.png`, `s1-remind.png`).
- **For the child (4 or 7 years old):** setup itself is all for the grown-up, which is right. But the child's first screen after "Let's play!" is a practice page ("Say rrrr" five times), not the fruit game the grown-up was shown twice. The child chooses nothing: the buddy picker is built and hidden.
- **For Rachel:** R ticked for every family (bug 1); the age can be skipped (bug 5); every parent is shown "rrrr" in both demos before any sound is picked (already noted in the rulebook).

## Improvements, ranked

| # | What | Why it matters | Impact | Effort | Whose call |
|---|---|---|---|---|---|
| 1 | Sound picker starts with nothing ticked | The wrong sound means the whole app is wrong for that child, from the first minute | High | Small | Rachel and Travis |
| 2 | Read the funnel before changing setup again: in PostHog, the event "setup step" has one count per screen (`welcome`, `name`, `reel` … `ready`, `remind`, `mic`, `handoff`), then "plan moment shown", "free trial started", "onboarding completed", "practice started" | Setup was re-cut six times between 22 Oct and 5 Nov without this number. It shows exactly which screen loses parents | High | Small | Travis |
| 3 | Let the parent feel it before the price: switch on the free round once 10(a) and 10(b) are settled | "They want to try it first" (Travis's own words). Every screen before the price is watching, never doing | High | Small | Travis (Rachel to know) |
| 4 | Cut "What does Mia love?" and "Is Mia in speech therapy?", or give them a job (the love pick could choose Today's picks; the child could make it after the hand-off) | Two screens and two taps that buy nothing, and one of them looks like a promise | Med–High | Small | Travis (Rachel for the therapy words) |
| 5 | Microphone screen: one line of why, the promise back ("Audio never leaves this phone"), and "your iPhone will ask twice" | If this permission is refused, Sona cannot work at all | Med–High | Small | Travis (he took the line off on 31 Oct) |
| 6 | Make minutes a day changeable in Settings (one row), and ask it for a second child | Today it is a one-time choice with no way back; 10 minutes means 60 reps a day for good | Med | Small | Travis (Rachel for the numbers) |
| 7 | A daily practice reminder that carries on after the free trial, at a time the parent picks | The reminders stop the day the trial ends. Duolingo's daily reminder is its strongest habit tool | High for keeping families | Med | Travis and Rachel (words) |
| 8 | Tell the parent to confirm the weekly report (bug 6) | The report is the one thing that brings a parent back each week, and it silently never starts | Med | Small | Travis |
| 9 | Open setup where the parent left off (bug 2) | An interrupted parent at 8 pm will not tap through eight screens again | Med | Small | Engineering |
| 10 | One demo screen, with the cause in words ("When Mia says her sound, the game slows down") | Two screens say one thing, and the first never says it | Med | Small | Travis |
| 11 | Fold the ready screen into the price screen's top (same sentence), and make the progress bar cover every screen to the price | One screen fewer; an honest bar | Low–Med | Med | Travis |
| 12 | Let the child pick their buddy right after the hand-off (three starters; the step is already built) | The child's first act is a choice of their own, not a test | Med | Small–Med | Travis |
| 13 | The small fixes: age before Continue (5), "All sounds" stays chosen (3), the added-child guard (4), the hand-off knows about the microphone (7), `maxlength` (9), "5 minutes" (8) | Each is a quiet wrong turn | Low–Med each | Small | Engineering (5 and 8 with Rachel and Travis) |

A leaner walk the best apps would recognise: hello > name and age > sounds > one demo or the free round > ready and price together > microphone > play. Seven screens. The email, the minutes and the reminder can be asked after the first game, when the parent has seen the child play.

## Versus the best apps
- **Duolingo:** a first lesson before any sign-up or price; every answer is shown back ("Here's what you can achieve"); the progress bar covers the whole flow; the notification ask gives a reason and a time, and the reminders never stop; "I already have an account" on the first screen. Sona: no play before the price (the free round fixes this), two answers shown nowhere, a bar that ends early, reminders only during the trial, and a family on a new phone must walk all of setup before they can reach Settings to bring their save over. All would fit Sona's rules.
- **Duolingo ABC, Khan Academy Kids, Endless Alphabet:** the child is doing something within about 30 seconds; Khan Kids lets the child pick a character first. Sona's child does nothing until screen 16. A buddy pick after the hand-off fits the rules.
- **Speech Blubs:** the closest match (a parent quiz, then a price with a free trial). Its quiz ends on a "plan" made from the answers. Sona must never claim an evaluation, but it could show the non-clinical answers back (what the child loves).
- **Calm, Headspace, Blinkist:** the trial timeline with "we'll remind you" is on the price screen itself, and the permission is asked after the trial starts. Sona asks on its own screen before the price (so the promise is true when shown); that is honest, at the cost of one more screen and one more iPhone box before the price.
- **Pok Pok, Toca Boca, Sago Mini:** no questions at all; after buying, play starts at once. Sona has the microphone, the hand-off and the five-tries page between buying and playing.
- **Accounts:** every one of these keeps progress in an account. Sona keeps everything on the phone on purpose, so a reinstall starts from zero unless the parent saved a backup. A copy kept in the family's own iCloud would fit the rules (nothing reaches Sona's server) but needs app work.

## Decisions worth another look
- **R ticked from the start.** Not one of Travis's quoted decisions; it is an old default in the code, and the rulebook already lists "setup picks R for 2–4 year olds" as an open question for Rachel (31 Oct). Today it decides the sound for every parent who does not look closely.
- **"No goal can be changed on any grown-up page" (5 Nov).** Together with setup asking the minutes once, the daily goal is now fixed for life at whatever was tapped in setup, with 5 already picked. A second child is never asked.
- **The microphone screen without its promise (31 Oct).** The line was short and it is Sona's strongest true claim. It sits on every other microphone ask in the app.
- **Two demo screens with "Normal speed / After practice" (4 and 5 Nov).** Travis preferred them to the three-step version; the three-step one said the cause ("Says rrrr", "Slows down") and these do not.
- **The therapy question (kept 4 Nov, shown nowhere).** The rulebook itself says "whether the question stays is Travis's call". It also switches session recording off for two screens.
- **The email step no longer says the address joins the email list (4 Nov).** It still joins, and three welcome emails start. "Unsubscribe anytime." is there; the tips are unsaid.
- **The price before any play (3 Oct).** The free round is the answer already built.
- **"Let's play!" opens the five-tries page first (8 Oct, "I still want them to say the sound beforehand").** For the very first run only, going straight into the fruit (as the free round does) would match what the two demos promised.

## Already good (keep)
- A child's name is safe everywhere: I saved a name full of code, quotes, an apostrophe and an emoji and opened 16 pages. It was shown as plain words every time and nothing ran.
- Double taps never skip a screen (taps pause for half a second after each change).
- The answers survive a reload; the profile is saved before the price, so a parent who quits there finds Home, not a setup that forgot them.
- Every wait on the App Store has a limit: "One moment…" lasted 1.2 s and 2.6 s with a store that never answered, then setup went on. No reminder screen is shown on a guess.
- The email step's messages are clear ("Add your email, or tap Skip.", "That email doesn't look right."), and Back keeps what was typed.
- Each sound tile shows a word with the sound's letters marked; "Sona practices — it doesn't test or diagnose." is said once, in the right place.
- A refused microphone gets its own recovery screen.
- Everything fits with no scrolling at 390×844 and 375×667; nothing moves under Reduce Motion.
- No sound in setup, no ad pixel in the iPhone app, the therapy answer never leaves the phone.
- The second-child path is short (hello, name, sounds, ready, microphone), and the clinician door (`?slp=1`) works in a browser and in the app with no errors.

## Not checked
- A real iPhone: the keyboard on the name and email screens (the suite `setupsteadytest` measures it; I did not rerun it), Apple's buy sheet, and the real wording of iPhone's own boxes. Worth one look on a phone: the second box at the microphone step (Speech Recognition), which may carry Apple's own sentence about speech data beside Sona's "no audio is sent anywhere".
- The price screen itself and the practice page's inner workings (other auditors), beyond what the parent meets on arrival.
- The free round played to its end card (the suite `freeplaytest` does that); I walked into it, reloaded it and read its code.
- Session recording, VoiceOver, iPad layouts, a slow or missing connection on first launch (the app loads the live site through three pages in a row, with no offline page), and real drop-off numbers (see improvement 2).
