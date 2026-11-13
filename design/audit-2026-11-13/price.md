# Price screen, buying, restoring, and who has access

Read in full: `public/subscribe.html`, `public/premium.html`, `public/trial.html` (script half), `public/onboarding-price-studio.css`, the plan rules in `public/crafted-family.css`, and every part of `public/sona.js` on the list. Looked at all seven `price-*` pictures, `premium-page.png` and `home-locked.png`. Ran three small scripts on the tests' fake phone (in `audit/price/`, pictures in `audit/price/png/`). No test suite was run.

## In five lines
1. The buying code itself is careful and I could not make it charge a family and leave them locked, or sell a plan twice. Prices and free days really do come only from the App Store.
2. The weak spot is **Home after something changes**: Home checks the App Store in the background but never repaints. A family who just paid can see everything locked, and a family whose plan just ended sees everything open until the child taps and lands on a price.
3. **"Restore" in Settings is the old website restore** (it asks for an email and checks Stripe). In the iPhone app, where everyone buys through Apple, it tells a paying parent "no subscription".
4. When the free week ends there is **no "welcome back"**: the child meets a cold price screen on every tap, and "Your plan" tells a paying parent nothing (no trial end date, no renew date, no button to manage it).
5. The screen looks clean and fits every phone I tried. What it lacks next to the best apps: proof, a person behind it, anything about *this* child beyond the name, a yearly plan, and a soft landing for "not now".

## Bugs

### P0
None found. I could not produce "charged but locked", "unlocked from a link", or a lost purchase.

### P1

**1. A family who has paid can open Home and see everything locked.**
- Sees: "Today's adventure … Premium … Unlock adventure", Books "Premium", every game grey, although the plan is on.
- Steps: any time the purchase finishes away from the price screen. (a) A child's Apple ID with Ask to Buy: parent approves an hour later. (b) The app is closed while Apple's sheet is finishing. (c) The phone lost its saved "subscribed" note. Open Sona → Home.
- Where: `public/today.html:746` calls `S.iapRefresh()` and throws the answer away. Six lines down (`:750-753`) the therapist-plan check does it right: if the answer changed, it reloads Home.
- Status: **CONFIRMED** on the fake phone (store says "has Premium", phone had no note): after Home loaded, `Sona.isSubscribed()` was true and the card still said "Premium / Unlock adventure" (`audit/price/png/late-1-home-paid-but-looks-locked.png`). A tap does open the game, and the next visit to Home is right.
- Fix: copy the pattern at `today.html:750-753`: remember `S.premium()` before, and reload Home if it changed when `iapRefresh()` answers.

**2. The morning after a plan ends, Home looks open and the child's first tap lands on a price.**
- Sees: Home with the big card saying "Start today" as usual. Child taps it. Instead of the story: "Unlock today's story, and every game", "Monthly, Charged today, $9.99/mo", button "Subscribe — $9.99 a month".
- Steps: free week ends (or the plan is cancelled and runs out) → open Sona 6+ hours after its last check → tap the day's card or any game.
- Where: same line, `public/today.html:746` (Home is painted from the saved note, then `iapRefresh` in `public/sona.js:8745-8772` clears the note without repainting).
- Status: **CONFIRMED** (`audit/price/png/lapse-1-home-first-load.png` then `lapse-2-after-tap.png`).
- Fix: the same reload as bug 1, so Home shows the truth before a finger lands. (See "Experience" for what that truth should look like.)

**3. "Restore" in Settings does the wrong restore inside the iPhone app.**
- Sees: Settings › Account says "Plan: none yet … · See Premium → · Restore". Tapping Restore opens a box "Email you subscribed with". A parent who bought through Apple types their email and reads "No active subscription for that email."
- Steps: iPhone app → Grown-ups → Settings → Account → Restore.
- Where: `public/settings.html:296-303` and `:1136-1143` call `Sona.restore(email)` (`public/sona.js:3263`), which asks `/api/subscription`, and that route only looks in Stripe (the website's old checkout). Apple's real restore (`Sona.iapRestore`) exists only on the price screen's small "Restore Purchases" link.
- Status: **CONFIRMED** on the fake phone as the iPhone app: the tap sent `/api/subscription` and never asked Apple.
- Fix: in the app, make that link call `Sona.iapRestore()` and answer "Restored ✓" or "No purchases found on this Apple ID". Keep the email box only as a second line, "Paid on speaksona.com?".

**4. A pasted backup code can stop Sona from ever re-checking a plan, so a free trial can be kept forever.**
- Sees: nothing odd. The family starts the free week, pastes one short code under Settings › Moving to a new phone?, cancels, and keeps every game on that phone for good.
- Steps: with a plan on, restore this backup: `{"app":"sona","v":1,"data":{"sona.iapcheck.v1":"9999999999999"}}`.
- Where: Home trusts the saved "subscribed" note if the last check was under 6 hours ago (`public/sona.js:8749-8753`). A check time in the future always passes that test. The check-time key is missing from the list a backup may not bring (`NO_IMPORT`, `public/sona.js:2692`). A phone whose clock was wrong when it checked gets the same effect by accident.
- Status: **CONFIRMED**: without the code, Home asked the store and removed the ended plan; with it, the store was asked 0 times and the plan stayed on.
- Fix: treat a check time later than "now" as "never checked", and add `sona.iapcheck.v1` to `NO_IMPORT` and `NO_EXPORT`. It needs intent, but one code posted online would work for everyone, so I rank it P1.

### P2

**5. During "Waiting for approval", the buy button is still live and sends a second request.**
- Sees: after Ask to Buy, the line says "Waiting for approval…" but the button still says "Start practicing!". A second tap asks Apple again (the parent gets two requests).
- Where: `public/subscribe.html:1379-1381` (the button is only held while a purchase is open) and `:1585-1642`.
- Status: **CONFIRMED** (two purchase calls for two taps).
- Fix: while an approval is pending, grey the button and label it "Waiting for approval"; Restore and the X stay.

**6. Restore Purchases, Terms of Use and Privacy are tiny.**
- Measured on the fake phone at 320, 375 and 390 wide: "Restore Purchases" 108×25, "Terms of Use" 68×15, "Privacy" 38×15 points, side by side. The rule elsewhere in the app is 44. A thumb aiming at Restore can open the Terms.
- Where: `public/subscribe.html:615-619` (11 px text, 4 px padding). Status: **CONFIRMED**. Fix: give each a 44 px tall tap area (padding, not bigger text).

**7. A purchase that finishes away from the price screen gets no daily practice reminders and may be missing from the free-week report.**
- The reminders and the "free trial started" count are set only inside the buy call's own success (`public/sona.js:9537`). The daily check re-sets the "ends tomorrow" reminder but only re-sets the daily ones if some were already set (`public/sona.js:9803`). So Ask to Buy families and closed-mid-purchase families get none.
- Status: **LIKELY** (traced, not run). Fix: in the daily check, when a trial is on and no daily reminders are held, set them.

**8. The parked AI "Story" page is open to a family who has paid nothing.**
- Typing `/story.html` opens it on a phone that owes the price. The old gate only closes once the old "demonstration" was started, and nothing starts it any more, so it never closes (`public/sona.js:3076`; `public/story.html:131`).
- Status: **CONFIRMED** (`Sona.gated("story")` is false on an unpaid phone; the page stays). Only reachable by typed address, so not from inside the iPhone app. Flagging for whoever owns server cost. Fix: gate that page on the books' rule (`Sona.booksOpen()`).

## Experience problems

**The free week ends (question 2).** What a family gets, in order:
- About 30 hours before the end: the phone's own notice "Your free trial ends tomorrow." (only if they said yes to reminders in setup). An email "Your free days end soon" (only if they gave an email).
- At the end: nothing on screen. Home quietly turns into `home-locked.png`: "Unlock adventure", Books "Premium", every game grey. (After the confusing first visit in bug 2.)
- Every tap by the child opens the price screen. For this family it is the colder version: "Charged today", "Subscribe — $9.99 a month", no "Recommended" tag, no timeline (`audit/price/png/lapse-2-after-tap.png`). It does not say "welcome back", does not mention the week they just had, and does not say why the games closed.
- A day later: the email "We miss you at Sona" (only with an email).
- Settings says "Plan: none yet", which is not true of a family who just had one (`public/settings.html:1126-1130`).
- There is no kind path back. The phone still holds everything needed for one: stories finished, stickers, times the child said their sound.

**"Your plan" tells a paying parent nothing.** An active subscriber sees only "Your plan: Active ✓ — thank you for backing Sona" and a paragraph about how to cancel on the website or in iPhone Settings (**confirmed**, `audit/price/png/active-your-plan.png`). Not which plan, not "free until Thursday", not "renews Dec 12", no button to manage it. A parent in a free week who wants to know when they will be charged has to leave the app. That is exactly the moment refund requests and one-star reviews come from.

**A child who cannot read (question 5).** They tap a grey game. A new screen appears: game pictures, Echo cheering, and one huge button. The button is the most inviting thing on the screen and a 4-year-old reads it as "play". One tap opens Apple's payment sheet. The only way back is a small pale × in the corner, and it goes to Home, not back to the games they were choosing from. Nothing is said out loud and no picture says "get a grown-up". For a family that said "not now", *every* card on Home does this.
What actually stops a purchase: only Apple's own sheet (Face ID, Touch ID or the password), plus a one-second pause on the button after the card changes. That is enough on a parent's phone. It is thin on a family iPad where the child's finger or face is saved so they can unlock it: there the child can confirm $59.99 alone.

**The tapped game is not on the screen.** "Unlock Hoops, and every other game" sits under pictures of Fruit Slice, Piano Tiles, Block Stacker and the fox. Hoops is not shown (`price-from-game.png`; `public/subscribe.html:2011` shows the tapped game only on the old web card). And after the parent pays, they land on Home and must find Hoops again (**confirmed**; `public/subscribe.html:980-989`).

**The middle step says "Still free" for most doors.** The friendly "Day 6 · Reminder" only shows when the parent allowed notifications during setup. Everyone else reads "Day 6 · Still free", which promises nothing, and there is no way to switch the reminder on from here.

**A store hiccup during setup strands a new family.** If the App Store does not answer, the card says "We couldn't reach the App Store" with Try again (`price-store-silent.png`). The only other way out is the ×, which goes to a fully locked Home and skips the microphone step. They did nothing wrong and can play nothing.

**Words.** "UNLIMITED ACCESS" and "No ads, ever" are filler: every paid app says them. Nothing on the screen says what the child will actually do or get better at. On the smallest phone the three lines vanish entirely and the screen is just a title, two prices and a button (`audit/price/png/fit-320x568-unsure-fromgame.png`).

## Improvements, ranked

| # | What | Why it matters | Impact | Effort | Whose call |
|---|---|---|---|---|---|
| 1 | Make Home repaint when the store's answer changes (bugs 1 and 2) | A paying family never sees "locked"; a child never taps an open-looking card into a price | High | Small | engineering |
| 2 | Real Apple restore in Settings, and a real "Your plan": which plan, "free until <day>", "renews <day>" or "ends <day>", and a "Manage in App Store" button | Removes the two most common "I paid / how do I cancel" dead ends; the store already hands back all of it | High | Small–Med | engineering; words Travis |
| 3 | A "welcome back" price screen for a family whose plan ended: "Mia's games are waiting", her own numbers from the phone (stories finished, times she said her sound), then the same two rows | Today the lapsed family gets the coldest screen. Their child's own week is the best proof Sona has, and it never leaves the phone | High | Med | Travis (Rachel for the wording of the numbers) |
| 4 | When the free round (built, switched off, due about 16 Nov) hands over to the price, say what just happened: "Keep Mia playing" and "Mia just said her sound 4 times" | Right now that door would open on "Mia's practice is ready", which makes no sense after she has played. The line already exists for another door | High | Small | Travis |
| 5 | On doors a child opened (a grey game, a book, the story card), ask the four number words when the Buy button is tapped | Stops a child buying on a family iPad. Costs a parent four taps, only on those doors; setup's door stays one tap | Med–High | Small | Travis |
| 6 | Make the offer about this child: one line from setup's answers ("R sound · 5 minutes a day · a new story every day"), a small line with Rachel, and drop "Unlimited access" / "No ads, ever" | The best paywalls sell a result and a person, not a feature list. Sona asks eight questions and uses only the name | Med | Small | Travis; Rachel's line must be her exact settled wording |
| 7 | Test Yearly (with the free week) in place of, or beside, Lifetime; or raise Lifetime | See "Decisions". A config change in App Store Connect and RevenueCat plus one switch already in the code | High | Small | Travis |
| 8 | After a purchase from a grey game, open that game; show that game's picture first | The parent paid because the child wanted Hoops. Give them Hoops | Med | Small | engineering |
| 9 | Count what happens at the button: "buy tapped", how each attempt ended (cancelled, waiting, Screen Time, offline), and which row was picked | Today nobody can tell "saw the price and left" from "tapped and backed out at Apple's sheet", or how many pick Lifetime | Med | Small | engineering |
| 10 | Let the timeline's middle step turn the reminder on ("Remind me") for parents who were never asked | Turns "Still free" into the promise that lifts trial starts | Med | Med | Travis |
| 11 | Close the backup hole (bug 4); bigger legal links (bug 6); hold the button while waiting for approval (bug 5) | Small, safe | Low–Med | Small | engineering |
| 12 | In App Store Connect: turn on Family Sharing for both products and the billing grace period | A parent's purchase then covers a child's iPad on a child Apple ID; a failed card does not lock the app the same day | Med | Small | Travis (outside the repo; I could not see the current settings) |

## Versus the best apps

- **Duolingo Super.** Asks after the first lesson, not before it. Button says what it does ("Try 1 week free"). Shows a timeline (today, reminder, charge). "No thanks" leads to a real free app. Sona has the timeline; it asks before any play, its button says "Start practicing!", and "no" leads to a locked app.
- **Blinkist.** The "we'll remind you" timeline is the famous one; they reported more trial starts and far fewer complaints from it. Sona's is a good short copy, but the reminder step only appears for parents who said yes earlier. Blinkist asks on the paywall itself.
- **Headspace, Calm.** Lead with a yearly plan that carries the free trial; monthly is the small second choice. No lifetime on the main screen. Sona leads with monthly and offers lifetime at six months' price.
- **Lingokids.** Parent check before the buy button (a simple puzzle), then yearly and monthly with a free week, a line about how many families use it, and the experts behind it. Sona has no check on child-opened doors and no proof line.
- **Speech Blubs** (closest rival). Quiz, then "your child's plan" built from the answers, then a yearly trial with parent quotes and a therapist's face. Sona asks the questions and then does not use them on the price screen.
- **Khan Academy Kids.** Free. Not a model for the price, but it is what a parent compares a locked Home against.
- What Sona does better than most of them: every word about money is the store's own, a buyer Apple will charge today is never shown "free", and failure messages never claim "nothing was charged".

## Decisions worth another look

1. **Nothing to play after "not now" or after the week ends** (Travis, 3 Oct: "home locked"). Today: every card opens a price, for the child, every time. Different choice: keep one game open (the free games already exist for older families), or one game a day. Why it is his call: a hard wall can sell more in week one, but his own notes say "most of them cancel", and a dead app gives the "We miss you" email nothing to bring them back to.
2. **A child's tap opens the price with no grown-up check** (Travis, 4 Oct). Keep the screen opening by itself, as he asked, but check at the Buy button (improvement 5). The setup door is untouched.
3. **Lifetime at $59.99 next to $9.99 a month.** In plain words: Lifetime costs the same as six months. It earns more than monthly only if the average monthly family stays fewer than six paid months. It earns less from exactly the families Sona is built for (a sound like R takes many months; families with two children), it never renews, and those families keep using Echo's paid voice forever. It also has no free week, so it mostly sells to parents who were going to subscribe anyway. And it does not make monthly look cheap, which was the stated reason for it; it makes monthly look dear to anyone planning to stay. For it: parents dislike subscriptions, "pay once" is a strong line in an ad, and the money arrives today. Options: raise it to about 10–12 months' worth; or bring back Yearly at $59.99 with the free week (same money up front, and it renews); or keep it and check RevenueCat for the average paid months of a monthly family. If that number is under six, the current price is fine.
4. **"Start practicing!" on a button that charges $59.99 today** (Travis, 31 Oct). The price is on the row and Apple's sheet repeats it, so it is not hidden. But a button that says what it does ("Pay $59.99 once", "Try 7 days free") is what the trusted apps use, and it lowers "I didn't know I was charged" complaints.
5. **Rachel is not on the offer** (Travis, 6 Oct). From setup that is fine: her screen came five screens earlier. From a grey game weeks later, possibly held by the other parent, there is nobody behind the app. One short line with her photo would do it.
6. **The × goes to Home, not back to where the child was.** Small, but a child who was choosing in the games list is moved somewhere else.

## Already good (keep)

- **Every figure is the store's.** The page ships with no price, no day count and no "free". Checked states: sure of the free week, not sure ("for new subscribers", with the honest note), charged today, nothing to sell, already owned, store silent. A late answer repaints the card by itself.
- **Never sold twice, never stuck.** A family with Premium from any source is shown no buy card. An Apple ID that already has Premium gets "You already have Sona Premium. Welcome back!" and is sent on. One purchase at a time; a tap re-asks the store first and buys only what the card still says.
- **Every way out I played ends somewhere sensible:** buy (confetti, then on: back to setup for the microphone, else Home); cancel at Apple's sheet (nothing said, card stays); waiting for approval (says so, watches for 10 minutes); Screen Time ("Purchases are turned off on this device…"); offline ("We couldn't reach the App Store…"); Apple took the order but Premium is not on yet (points at Restore); store never answers (4 s, then "Try again"; a second safety net at 8 s); app closed on the price (lands on Home; the games ask for the microphone themselves).
- **Reinstall or second device:** setup asks the store first and skips the price for a family who already pays; if the store is slow, the price screen finds them and says welcome back. Offline the next day: the plan stays on; only a clear "no" from Apple removes it, and only Apple's own plan, never a therapist's plan or an old free-era promise.
- **Nothing unlocks from a link.** `?setup=1`, `?first=1`, `?from=…` only choose words and pictures; `?from=` is checked against the list of games; a parked game is refused. The founder key and a therapist's link are checked by the server.
- **A backup cannot forge Premium** (apart from bug 4): the subscription note, the therapist-plan note, the founder flag, the free-era stamps and the marks inside a child's profile are all refused.
- **It fits.** Measured at 375×667, 320×568 and 390×844 with a notch, with both rows, the timeline and the reminder step: the button and the Restore/Terms/Privacy row are on the first screen every time, and tapping Lifetime moves neither row by a single point. The × is a full 44×44 and clears the notch.
- **The reminder is honest:** shown only when the phone will really send it, 30 hours ahead so cancelling still counts, and taken back if the parent already cancelled.
- **Privacy on this screen:** the ad pixel is off inside the app; a child-opened visit is never recorded; events carry a door name and a plan, never the child.

## Not checked

- Anything only a real iPhone can show: Apple's sheet, Ask to Buy for real, what RevenueCat returns offline, and how often a real phone answers "not sure" about the free week (PostHog's "price state" event, `free-unsure` against `free-sure`, will tell Travis; if "not sure" is common, most parents see the wordier card with no timeline).
- App Store Connect and RevenueCat settings: Family Sharing, grace period, that the one-payment product is attached to Premium.
- The three price suites (`pricescreentest`, `setupbuytest`, `trialfirsttest`) were not run or read; my checks used their fake phone directly.
- The website's parked checkout (`/api/checkout`, Stripe pages), the clinician plans, the RevenueCat webhook and its emails.
- The top (markup) half of `trial.html`; the `?first=1` door (now only for older free-version families); motion (the fake phone runs with Reduce Motion).
- Whether Meta's pixel, which is on for the plan page in a browser, can pick up the child's name from the recap card there. Worth a look by whoever owns privacy.
- Sales numbers. Every judgment about what "lifts sales" is from how comparable apps work, not from Sona's data.
