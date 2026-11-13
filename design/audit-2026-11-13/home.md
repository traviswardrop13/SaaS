# Home

Home is the screen a child sees every day (`public/today.html`, one page with
two views: Home, and the list of every game, which the code calls the Arcade
and the door calls "Games"). I read all of `today.html`, `crafted-home.css`,
the two redirect pages and the parts of `sona.js` that feed Home, then made
24 states on the tests' fake phone and looked at each. My pictures are in
`audit/home/png/`
(the scripts that made them are one folder up: `states.mjs`, `arcade.mjs`,
`confirm.mjs`).

## In five lines

1. The big card's picture is almost the same on 13 of the 14 story days: a
   pelican and Echo outside the same cottage. To a child who cannot read,
   "a new story every day" looks like the same story every day.
2. When a free trial ends, Home still says "Start today" and "Included" on
   the first visit; the child's tap then opens the price screen.
3. Families from before the paywall get a grown-ups' survey popping up over
   the child's Home, in the iPhone app too.
4. The coral "Practice" bar looks like the biggest button after Start and
   does nothing; the finished-day card is a big dark locked box. Home never
   says "you can keep playing".
5. The plumbing is solid: one screen with no scroll on every size I tried,
   no date bug found in the day's card, no tap target under 44 px on Home,
   double taps handled, light to download.

## Bugs

No P0 found in this area.

### P1

**1. The day's big picture is the same scene every day.**
- Sees: from Day 2 on (and Day 1 for a child whose sound has no talking
  story), the big card shows Pelly the pelican and Echo in front of the same
  cottage. Only the small thing in Pelly's beak changes. The finished-day
  card ("Tomorrow") shows the same scene again, dark. Travis asked on 28 Oct
  for the card to be "different every day"; the title now changes but the
  picture does not.
- Steps: open Home on any story day but the talking Day 1. Compare pictures
  `png/s01-sheet.png` (top rows: what Home shows for Days 1 to 14; the small
  rows under them: each story's own Home picture, which is not used) and
  `png/found5-320.png`, `png/done-story.png`, `png/ipad-small.png`.
- Where: `public/today.html:519-521`. The card loads the story's first
  scene (`/assets/adventure/<id>/s01.webp`); in every story scenes 1 and 2
  are "Pelly brings a letter". The story's own picture
  (`home-<id>.webp`: a lighthouse, a toy shop, a bakery ...) is only the
  fallback. `tests/homestorytest.mjs:109,169` pins the first scene, so this
  was chosen on purpose (31 Oct, "the original portrait"); the sameness is
  the side effect nobody saw.
- Status: CONFIRMED (looked at all 14 first scenes side by side).
- Fix: show scene 3 (`s03.webp`, the first picture at the story's own place:
  see `png/s02-sheet.png`, second row), or let each story name its cover
  scene. Same tall shape, no new art.

**2. A trial that has ended still looks open, and the tap opens the price.**
- Sees: the first time Home opens after a trial or subscription ends, the
  card says "Start today", the Books door says "Included" and no "Premium"
  tag shows. The child taps Start and lands on the price screen. One visit
  later Home is correctly locked. It also happens the other way round: a
  family whose Premium the phone finds on that visit still sees "Unlock
  adventure" and "Premium" until the next visit.
- Steps: a phone that remembers Premium; Apple now answers "no" and the last
  check is over six hours old; open Home; tap the card. Picture
  `png/lapse-same-load.png` (taken after Apple had already said no).
- Where: `public/today.html:746`. Home asks the store in the background
  (`iapRefresh`) and never repaints when the answer changes. Three lines
  lower (`:749-753`) the therapist-coverage check does reload on a change.
  The tap itself re-checks access (`:347-353`), so nobody gets in free; only
  the words on screen are stale.
- Status: CONFIRMED on the fake phone, both directions (`confirm.mjs`).
- Fix: when the store's answer changes what is open, reload Home, the way
  line 752 already does.

**3. A grown-ups' survey pops up in front of the child.**
- Sees: about a second after Home opens, a box covers the screen: "YOU'RE
  BUILDING SONA WITH US. What should we build next?" with six buttons. It
  lands under a finger that was going for Start. The only way out without
  answering is a small X (36 px). A child who taps a button gets a text box and "Send it".
- Who: every family set up before 30 Sep 2026 (the families who keep
  Premium for good), on the website and in the iPhone app. It comes on every
  third opening of Home, at most once in 20 hours, then rests 14 days after
  an X or a Send.
- Where: `public/today.html:913-920` (the automatic ask), `:876-911`. It
  also saves a visit count on every Home load (`:915`) and can post from
  Home (`:904`), which breaks "Home only reads". CLAUDE.md never mentions
  it; only `tests/betatest.mjs:540-585` does.
- Status: CONFIRMED (`png/pulse-app.png` in the app, `png/pulse.png` on the
  web).
- Fix: take the automatic pop-up off Home; ask in Settings or Talk to us,
  behind the grown-ups check.

### P2

**4. If one small file fails to load, the Grown-ups button is dead.**
- Sees: on a patchy connection the gear does nothing, the reward ring stays
  empty and the buddy picture is missing, until the next visit.
- Where: `public/today.html:743` uses `SonaCraftedBuddies` after checking a
  different thing (`S.buddyMarkup`); if `/crafted-buddies.js` did not arrive
  the rest of that script stops, and the gate, the ring, homework sync and
  the store check are all in it.
- Status: CONFIRMED by blocking that one file (error "SonaCraftedBuddies is
  not defined", gate never opens).
- Fix: check `window.SonaCraftedBuddies` and wrap that line in try/catch.

**5. Two close buttons are under 44 px.** The X on "Pick a level"
(`today.html:156`, 36x36) and the X on the survey (`:272`, 36x36; its
buttons are 41 px tall). CONFIRMED by measuring. Fix: 44 px.

**6. On the smallest phone the Games door's picture covers its own words.**
At 320x568 "All the games" runs under the tilted picture
(`png/crop-320-doors.png`). `public/crafted-home.css:168-169` with `:220`
and `:262`. CONFIRMED. Fix: hide the caption or narrow it at that size.

**7. A "New" tag can only ever show in Today's picks.** The shelf cards
never get one (`public/sona.js:4177,4191` mark only the two picks;
`today.html:461` draws it), and none of the ten games rebuilt this month
carries a release date, so no child can see what is new. LIKELY (read from
the code; no game has a date to test with). Fix: mark shelf cards too and
give rebuilt games a date.

## Experience problems

- **"Practice" looks like a button and is not one** (`png/home-premium.png`
  in the shots folder, every Home picture). It is the brightest thing on the
  screen, has the same dark outline and shadow as the two doors, and says
  "Practice" in a speech-practice app. A tap does nothing (confirmed: it is
  a plain block, `today.html:209`). A recorded choice of 4 Nov; see
  "Decisions worth another look".
- **The finished day feels like a locked door, not a win**
  (`png/done-story.png`, `png/nobuy-gamedone.png`). The biggest thing on
  screen turns dark grey with a padlock and "Come back tomorrow!". A tap on
  it does nothing. With the Practice bar that makes the two biggest things
  on the screen dead. Nothing says "you can still play": the Games and Books
  doors are the same as before, and "Your games" is a small row at the foot.
- **A locked family's Home is all price screens** (`home-locked.png`). The
  story, every game and every book each open the price on one tap. The Buddy
  Shop and the Trophy Road are the only things left to do. Recorded choice.
- **Nothing shows whose turn it is.** With two children on one phone, Home
  shows no name, and the only way to switch is the gear, four number words,
  Settings. A sister can play a week on her brother's sound and story.
- **After any game the child lands on Home, not back in the list of games.**
  Picking a second game is: Games, scroll, tap.
- **Too much reading for a four-year-old.** A fresh Home has about 35 words
  and no play triangle. The whole card is the button (good) but the teal bar
  is words and a thin arrow. Home is silent by rule, so nothing tells a
  non-reader what to do, and nothing moves.
- **The chest being ready is a 14 px dot.** The daily reward is the reason
  to say 30 sounds; Home whispers it.
- **Day 1 can be missed for two weeks.** Set up yesterday, did not play the
  story: today's card is Day 2 (confirmed, `png/skipped-day1.png`). Day 1 is
  the talking story in the child's own sound, built to be the "wow". Setup
  sends the child to Fruit Slice first, so skipping it on day one is likely.
- **"Included" 25 times.** For a family with everything, every game card
  wears an "Included" tag (`arcade-premium-top.png`). It means nothing to a
  child and tells the parent nothing new.
- **Once a level is picked, the list of games cannot change it.** The "2"
  badge is not a button; the only place is "Game levels" on the Trophy Road
  page. A child who picked a level that is too hard is stuck unless they
  find it.
- **Home and the games list look like two apps.** Home is dark outlines,
  hard shadows, lilac, yellow and coral; the list is soft cream cards with
  brown type (`home-premium.png` beside `arcade-premium-top.png`).
- **After all 14 stories, "Your games" is 14 tiles in one sideways strip**
  with two and a bit showing (`png/trio.png`, left).
- **Today's picks are two cards that appear again a few rows below**; on the
  little kids' picture they are the very same two as the first row
  (`arcade-little-top.png`). Travis asked for the row; it is just thin.

## Improvements, ranked

| # | What | Why it matters | Impact | Effort | Whose call |
|---|------|----------------|--------|--------|------------|
| 1 | A different picture on the card each day (scene 3, or bring the 3-second clip back) | The one thing Travis asked for on 28 Oct; a non-reader sees the same card daily | High | Small | engineering; Travis picks picture or clip |
| 2 | Repaint Home when the store's answer changes | A child should never tap "Start today" and get a price | High | Small | engineering |
| 3 | Move the survey off Home | A pop-up under a child's finger, on the most used screen | High | Small | Travis |
| 4 | Keep Day 1 on the card until it is played (then a new story daily) | The first-week "wow" story is the one most likely to be skipped | High | Small | Travis |
| 5 | Make the finished day a bright "done" and point at more play ("Play your games", the Games door) | Ends the session on a win, keeps a keen child talking | High | Medium | Travis |
| 6 | Practice bar: either make it open something or flatten it to a label | Removes the most tempting dead tap | Med | Small | Travis (Rachel too if it opens practice) |
| 7 | Come back to the games list after a game started there | One tap less every game, every day | Med | Small | Travis (CLAUDE.md already names the way) |
| 8 | "Who's playing?": tap the buddy to see each child's buddy and name | Stops brothers and sisters mixing their practice | Med | Medium | Travis |
| 9 | A pass for non-readers: a play triangle on Start, fewer words, a gentle wiggle on the Start arrow and on a ready chest (off under Reduce Motion) | Silent Home needs pictures and motion to do the talking | Med | Small to Medium | Travis |
| 10 | "New!" on new and rebuilt games in the list | Ten games were rebuilt this month and nothing says so | Med | Small | engineering + Travis |
| 11 | Hide "Included" when everything is included; keep "Free" and "Premium" | Less clutter on 25 cards | Low | Small | engineering |
| 12 | Let a tap on the level badge reopen "Pick a level" | A way back down for a level that is too hard | Low | Small | Travis |
| 13 | Stop downloading three hidden pictures on Home (about 110 KB) and shrink the 512 px chest used at 30 px; long-cache `/assets` | Faster first open; fewer round trips every visit | Low | Small | engineering |
| 14 | One look for Home and the games list | It reads as one app | Med | Medium to Large | Travis |

## Versus the best apps

- **Duolingo / Duolingo ABC:** one glowing "start" node, and a finished
  lesson turns gold with a tick, then offers the next thing. Sona's finished
  day turns grey with a padlock. A gold "done" fits every rule (no guilt, no
  timer).
- **Khan Academy Kids:** each child's picture and name sit on Home and a tap
  switches child; the big button always has a next activity. Sona shows no
  name and has no switch outside Settings. Fits the rules (names stay on the
  phone).
- **Lingokids, Pok Pok, Sago Mini, Toca Boca:** Home needs no reading and is
  never still: characters blink, doors wobble. Sona's Home has no motion
  except one dot. Silent motion fits the rules.
- **Pok Pok, Sago Mini, Lingokids:** a child never meets a price; buying sits
  behind a grown-ups check. In Sona a child's tap on a grey card opens the
  price at once (Travis's choice of 4 Oct).
- **Duolingo, Khan Kids:** after an activity you return to where you were.
  Sona always returns to Home.
- **Headspace / Calm:** "today" done shows a calm tick and one soft
  suggestion, never a lock.
- **What Sona already does better:** one honest daily item, no streak
  guilt, no countdown, no random prize, and a Home that fits one screen.

## Decisions worth another look

- **Nothing free once the trial ends** (3 Oct, "home locked"). A lapsed
  family has no reason to open the app again, and every tap a child makes is
  a price screen. One free thing a day (the game of the day, or the one free
  book) would keep the habit alive; the free round built on 2 Nov is still
  switched off. Travis's pricing call.
- **A child's tap opens the price with no grown-ups check** (4 Oct). Apple
  only requires the check in its Kids category, but the best kids' apps do
  it anyway, and here the child is the one holding the phone.
- **A new story every day even if yesterday's was skipped** (28 Oct), set
  against "Day 1 has to be awesome" (31 Oct). See improvement 4.
- **"Practice" as a landmark that opens nothing** (4 Nov). See improvement 6.
- **The 3-second clip is gone from Home.** Travis asked for it on 28 Oct and
  said "merge and go" to clips for the talking stories on 4 Nov; the Home he
  approved the same day has no video, and 35 filmed clips sit unused in
  `public/assets/home/reel/`. Worth asking him whether he meant to lose it.
  It would also cure bug 1.
- **Four number words as the grown-ups check.** A six to eight year old can
  read TWO, THREE, NINE. Behind it sit "Reset progress" and "Remove child".
- **Home is silent.** Keep it; it is why the fix for non-readers has to be
  pictures and motion, not Echo's voice.

## Already good (keep)

- **One screen, measured.** Home did not scroll at 390x844, 375x667,
  320x568, 768x1024 or 1024x768 in any state I made (fresh, done, five and
  fourteen found games, locked, cannot buy), and every Home tap target was
  44 px or more.
- **The day's card is correct.** I traced the scheduler (`_questOn`,
  `questToday`, `questEnd`) and made its states: fresh, skipped, done, game
  day after 14 stories, a phone that cannot buy. No date bug: days are
  counted as whole calendar days, so daylight saving cannot merge two; a
  clock set ahead is ignored and repaired; each child has their own record;
  Home reloads at midnight and when it comes back on a new day.
- **Access is checked again at the tap**, never trusted from what was
  painted, so the stale words in bug 2 never let anyone in free.
- **No dead end where Sona cannot sell.** A phone that cannot buy gets a game
  it can open as the day's card, and the note on a grey card says the free
  games are still ready.
- **Double taps.** Games door, "Home" pill and the level sheet each ignore
  the second tap (confirmed on the pill; read in the code for the other
  two).
- **The games list is tidy.** The child's own age shelf first, hidden games
  really hidden, all 25 card pictures exist, "Best" tags only where a child
  has played, an old Sound Sprint best in metres correctly not shown.
- **"Pick a level" is clear** without reading: picture, big numeral, dots, a
  padlock with the trophy number (`png/level-sheet.png`).
- **Light.** A cold open of Home is 17 files, about 1.2 MB before
  compression (the one big file is `sona.js`, 697 KB, about 229 KB zipped).
- **The grown-ups door is silent** and its keys are big (88x60).

## Not checked

- A real iPhone or iPad: notch and home-bar insets, Safari's bars, Low Power
  Mode, VoiceOver. All of the above is desktop Chromium at phone sizes, with
  Reduce Motion on.
- The live site's cache headers (I believe pictures are re-checked with the
  server on every visit, but did not ask speaksona.com).
- The pages Home opens: the story player, the bookshelf, the Trophy Road,
  the Buddy Shop, the price screen, Settings (other auditors).
- Backups and restore, the parked `story.html` bounce (`?locked=1` shows no
  note, but nothing reaches that page), a play-mode child's "Your sound"
  label, a phone held sideways.
- One rare clock case I only reasoned about: a story finished while the
  clock was wrongly days ahead can show "done" again on that later date if
  nothing else is finished in between.
- I ran no test suite; nothing here says the suites pass or fail.
