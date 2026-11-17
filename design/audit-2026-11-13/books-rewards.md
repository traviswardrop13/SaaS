# Books and rewards (bookshelf, book reader, Trophy Road, daily chest, Buddy Shop, sticker book)

## In five lines
1. The money rules are mostly tight: coins are paid once, "Give it back" works once, a chest or a road gift can't be opened twice in one tab, and each child has their own wallet. One real hole: moving the phone's date back and forward pays trophies and chests again (confirmed).
2. In the iPhone app, a book page can never turn on its own if the phone hears a different word. The "three tries, then Echo is kind and turns the page" rule only works in the browser. A child the phone mishears is stuck until a grown-up taps Skip.
3. Seven of ten free-week reward moments are fine, but the first thing a child can afford (a 40-coin hat, day 2) shows up nowhere except inside the shop. Hats and places are never drawn in a game or on Home. That is 12 of the 18 shop items.
4. The Trophy Road shows 8 things at once for a child who can't read; the "Talk > Trophies > Chest > Coins > Shop" strip is the best part and should lead.
5. The shelf is never empty (every sound has at least one book), but 8 sounds (P, M, N, T, D, V, J, voiced TH) have exactly one book, and a family without Premium sees only locked books for every sound except R.

## Bugs

### P1
**B1. In the iPhone app a wrong word never ends a book page.**
- Sees: the child says "rocket" a few ways; Echo keeps saying "Let's try 'rocket' again. Tap the mic." forever. Only the small grown-ups' Skip turns the page.
- Steps: iPhone app with word checking, open any book with keys, say anything the phone hears as another word (or unclear), repeat.
- Where: `public/saycheck.js:323,367` returns "word" (not "shape") when `turn.required`; `public/library.html:1942-1948` ("word"/"unverified" only nudge, never count a try); the three-try turn is only on "shape" (`library.html:1937-1944`). The suite pins it: `tests/booktest.mjs:264-271`.
- Status: LIKELY (traced, and the test is written to expect it). Not run on a real phone.
- Fix: count "word" and "unverified" tries (still no rep, no cheer), and after three say the kind line and turn. FOR RACHEL: it is the same "end on a success, never fail out of speaking" rule the practice page follows, and Apple's listener mishears small children often.

### P2
**B2. Clock moved back and forward farms trophies and chests.**
- Sees: coins and trophies jump again each time the date flips.
- Steps: finish the goal on two days; set the date back one day, say one word, open the chest; set the date forward, say one word, open the chest; repeat.
- Where: the chest remembers only its last date, `sona.js:4917` (`opened = c.last === today()`, written at 4924); the trophy ledger zeroes today's count whenever the date changes, `sona.js:4897` (`s.dn = 0`).
- Status: CONFIRMED on the fake phone (my script `books-rewards/clock.mjs`: one rep per flip gave +30 trophies each flip, and chests of 10, 10, 25+sticker, 10 coins in four flips).
- Fix: treat any date on or after the last chest date as opened; never reset `dn` for a date before the ledger's newest day (keep a per-day map).
- Who can do it: a parent, or a flight across a time zone with automatic time. A child can't, in practice.

**B3. A road gift that arrives late shows no celebration if the app comes back to the front.**
- `road.html:437` calls `roadSettle()` on coming back but drops its answer, so a late item (or a month's gifts) is handed over silently; only a page load shows the "gifts are in your wallet" notice. Status: LIKELY. Fix: use the return value like the load path does.

**B4. "Skip" sits beside the mic, 44 px, and is not behind the grown-ups check** (`library.html:187,268`). A 4-year-old can tap it on every page and never say a word. No rep is paid, so it is harmless for rewards, but it removes the point of the word moment. Status: LIKELY. Fix: hold-to-skip or only after one quiet try.

## Experience problems
- **Hold to get it.** Buying needs a one-second hold on "Get it" (`customize.html` hold code). The words say "Hold to get it!", which a 4-year-old can't read; a plain tap just starts a ring and cancels. Add a pulsing finger or the ring already filling on its own.
- **Trophy Road for a non-reader** (`kid-road-full.png`): a strip, a hero, a chest, an 8-tile month path, then 14 numbered stops, then levels and two links. The Talk > Trophies > Chest > Coins > Shop strip tells the whole story. Cut or fold: the month path (a second, calendar-based set of gifts that resets on the 1st, so a family starting on 13 Nov only gets a short November), and show only the next 3 stops.
- **Opening a gift takes many taps.** Finish the goal (a text banner), Home, gift button, Road, "Open it", three taps on the chest, then "Yay!" per gift. A child who finishes day 1 may never find it.
- **Sticker book** (`stickers.html`): names are 10 px, and "Next!" glows on a sticker with no way to earn it other than "open gifts". Stickers are plain emoji-like art; the book has no "new" moment on opening a chest beyond the gift card.
- **Finishing a book gives no moment of its own**: The End shows confetti and a star on the cover, nothing on Home or the road.
- **Locked shelf**: a family without Premium on S, L, B etc. sees a shelf where every book says "Premium". True to the recorded decision, but it is the opposite of a treat.
- Not run: timing of a whole book (estimate: about 3 minutes for 12 pages with the mic, 1.5 for 6), fit at 320x568 and iPad.

## Improvements, ranked
1. Make wrong-word and unclear tries count toward three in the iPhone app, then kindly turn the page. High, Small, Rachel (clinical) plus engineering.
2. Make hats and places visible somewhere a child plays: the buddy on Home, and a place as the Home or game backdrop. Until then, sell the 100-coin buddies first (they ARE drawn in 8 games) and put the cheap hats later. High, Medium, Travis.
3. Fix the date farm (B2). Medium, Small, engineering.
4. Land the first reward on day 1 at the place the child already is: show the chest right on the goal banner ("Open it" button) instead of sending them to the Road. High, Small to Medium, Travis. Must stay silent-compliant and non-random.
5. Make the first week feel full: the plan gives 7 chests, 3 stops and 3 month steps, but nothing to buy before day 2 and nothing worth buying (see 2) before day 5, when Level 2 opens, which is the best moment of the week. Move Level 2 or a first buddy earlier (for example stop 2 at 60). High, Small, Travis.
6. Slim the Road: strip first, next gift, chest, next 3 stops. Drop the month path or move it to a grown-up view. Medium, Small, Travis.
7. A tap-to-buy hint for non-readers (pulsing finger on Get it). Medium, Small.
8. Give a finished book a prize: a sticker for the first 3 books read to The End, or a book "shelf star count" on Home. Medium, Small, Travis.

## Versus the best apps
- Duolingo: first lesson gives instant XP and a visible streak/chest on the same screen. Sona sends a child on a trip to another page. Duolingo's first week also drops something new almost daily; Sona's first week has stickers on days 3 and 4, a level on day 5, and nothing visible between.
- Khan Academy Kids / Pok Pok: collected items appear in the world the child plays in. Sona's hats and places do not. That is the single biggest gap.
- Epic / Vooks / Khan reading: they reward finishing a book (a badge, a shelf). Sona's book ends with confetti only.
- All of these fit Sona's rules if nothing is random, timed, or a "you missed".

## Decisions worth another look
- Wrong-word handling in the app (B1): a recorded rule ("taco must not count") is kept, but the same rule leaves a child stuck. Rachel and Travis should say how many wrong tries before a kind turn.
- Hats and places cost coins and road gifts but are not shown in any game ("later" in CLAUDE.md). Consider pausing their sale and road slots until they appear.
- The month path resets by calendar month, so day 14 of a family's trial may be a new month with a fresh empty path.
- Daily goal minimum: a parent can set the goal very low and still earn 30 trophies and a chest a day ("a day at the goal is always 30 trophies"). Intended, but it is the one farm that needs only a few words.

## Already good (keep)
- Coins and chest ledgers write first, so a crash under-pays but never double-pays; `undoBuy` is bounded by the catalog price and works once.
- Per-child wallets, owned items, chest and road (`PER_KID`); the OWN1 sweep protects existing families.
- Nothing random, no timers, no "you missed"; gifts are shown before they are reached; the Talk > Trophies > Chest > Coins > Shop strip.
- Shelf logic: filtered to the target sound, never empty, free book rules and sort order are consistent; the locked tap goes straight to the price.
- Silence never turns a page or counts a rep; the mic sheet, "Not now", back and Hear it paths are carefully guarded.

## Not checked
- Timing of a whole book on the fake phone (two books, with the mic and with "Not now"); fit of the reader, road, shop and stickers at 375x667 and 320x568 and on an iPad (I read the code and the 390x844 pictures only); the shop's hold-to-buy behaviour on a touch phone; backup restore of coins/road (code read only); `saycheck.js` internals (another auditor's).
