# Round games A: Fruit Slice, Piano Tiles, Block Stacker

## In five lines
- The three games are solid. Hearts, the new-life card, Echo's mid-round ask, the best line and Levels 2 and 3 all trace cleanly and I found no way to lose a family's data or get a child stuck.
- Biggest problem: Fruit Slice is the first game for every age (even 3 and 4 year olds), and a child who does not touch the screen loses all three hearts in about 7.5 seconds and is asked for their sound for a "new life" before anyone has shown them how to swipe (confirmed).
- If the phone's mic is refused, every round of all three games ends at the first break (about 15 to 20 seconds) with a "So fun!" card and no hint why. A tired parent will think the game is broken.
- Fruit Slice can run behind the "needs a ticket" card; the new-life card and the mic then open with no ticket (confirmed, rare path).
- Fun is good in Slice and Tiles, thinnest in Block Stacker (almost every drop is "PERFECT" or forgiven, so it plays itself). The sound feels like a toll booth in Stack and Slice, and like part of the music only in Tiles.

## Bugs

### P1
**1. Fruit Slice opens a new child with a very short fuse (first game for every age).**
- Sees: nobody touches the screen, three fruit fall, hearts go 3, 2, 1, 0. At about 7.5 seconds the "Say rrrr for a new life!" card opens and Echo asks. Say it, hearts come back, the next 8 seconds repeat. A 4-year-old has been told nothing about swiping except a small sign that says "Swipe to slice!" that they cannot read.
- Steps: open Slice with a play token, do not touch. Measured on the fake phone: hearts 2 at 3.5 s, 1 at 6.0 s, 0 and the card at 7.55 s.
- Where: `public/arcade-slice.html:405-409` (loseHeart, 1.5 s gap only), `:1059` (a fallen fruit costs a heart from the first wave), `:1066` (game over goes straight to `lifeOrEnd`). First game: `public/sona.js:6552` (`firstGameKey` is "slice" for everyone).
- Status: CONFIRMED (timeline above).
- Fix: no heart cost in the child's first round or first wave (or ages 2 to 4), and show a drawn finger swiping across the first fruit. Because the sound asked and the number of asks are Rachel's call, her sign-off is needed on anything that changes when the sound is asked.

**2. Mic refused (or no mic) quietly ends every round after the first break.**
- Sees: the child plays about 15 to 20 seconds, then the end card says "I saw the fruit fly! So fun!" (Tiles: "What beautiful music we made!"; Stack: "Look at our tower!"). Play again does the same. Nothing says the microphone is off or how to turn it on. Echo's small pill says "Microphone is off" for a moment only.
- Steps: deny the microphone; reach the end of wave 1 / song 1 / floor 1. The say-it card tries `openReviveMic`, the request fails, `endRound()` runs.
- Where: Slice `arcade-slice.html:782-789`; Tiles `arcade-tiles.html:791-800`; Stack same block (`arcade-stack.html:560-610`); `sayCard` also ends the round if `!CAN_LISTEN` (`:596`, tiles `:491`, stack `:361`). Today's adventure day is also marked finished by that early end (`questEnd`, `sona.js:6131`).
- Status: LIKELY (traced start to end; I did not make the browser deny the mic).
- Fix: when the round ends for this reason, show one plain line ("Echo can't hear right now. A grown-up can turn on the microphone in Settings.") and do not count the adventure day. Whether a game should be playable without the mic at all is Travis and Rachel's call (see Decisions).

### P2
**3. Fruit Slice runs behind the "needs a ticket" card.**
- Sees: reach `arcade-slice.html?from=charge` with no ticket (e.g. the iPhone swipe-back from the practice page after "Play again", which first removes `sona.play.active`). The "Fruit Slice needs a ticket!" card shows, but fruit keep flying behind it. After about 8 seconds the new-life card and the mic open. Saying the sound adds a rep and "I'm done playing" runs `endRound`, which finishes the day's adventure, all without the 5-sayings ticket.
- Steps: open the page with `?from=charge` and no `sona.play.*` in sessionStorage; wait 8 to 40 seconds. Confirmed: `needOvl` and `revOvl` both showing, hearts 0, one mic request opened.
- Where: `arcade-slice.html:263-264` (tok false only shows the card) then `:1102-1103` (`startWave(0); draw()` run anyway), `:1066`.
- Status: CONFIRMED on the fake phone. Tiles and Stack do the same but nothing costs a heart without a touch, so they stay quiet.
- Fix: when `!tok`, do not start the loop (`playing=false`, skip `startWave`/`draw`) in all three pages.

**4. Block Stacker: any tap in the first second of a new block is a miss.**
- Sees: a fast double-tap (a 5 or 6 year old does this) lands the first block, then the next block is still mostly off the left edge and the second tap drops it into nothing. The block tumbles, a heart is lost, the speed slows. Tiles has a guard for exactly this bounce (`DOUBLE_MS`); Stack has none.
- Steps: tap, tap again within about 0.25 s. The next block is made at `x=-0.6*w` (`:312`) and needs about a second at the starting speed to get 50% over the tower.
- Where: `arcade-stack.html:312` (start position), `:430` (needs at least 50% overlap), `:480` (no bounce guard).
- Status: LIKELY. In my harness the second drop succeeded because headless frames run faster than a phone; the geometry (top block 211 px wide at x=89, new block at x=-127, about 1.8 px a frame) says a phone tap inside the first second misses.
- Fix: ignore a tap for about 350 ms after a landing, as Tiles does for its bounce.

**5. Fruit Slice with two fingers: one lifting stops the other, and the line jumps.**
- Sees: a child using two fingers or a palm. When one finger lifts, `pDown` turns false for both (`window pointerup`, `:942`), so the other finger's swipe does nothing until it lifts and touches again. And while two fingers move, `lx,ly` flip between them, so one long invisible "slice" runs between the two fingers and cuts whatever fruit it crosses.
- Where: `arcade-slice.html:902-942` (one shared `pDown`, `lx`, `ly`).
- Status: LIKELY (not run).
- Fix: track the pointer id that started the swipe and ignore the others.

**6. The "ask" clock counts while a child has not started (Tiles) or is still learning (Slice).**
- Sees: in Piano Tiles the first three tiles wait for a tap and the song stands still, but the ask timer (`slowAskReady`) keeps counting play time, so Echo can ask for the sound at 6 seconds while the child is still looking at the first tile. In Slice the first ask lands about 6 seconds into the child's very first swipes.
- Where: `public/arcade-speech-help.js:284-286, 323` (nothing checks "a tile is waiting"); Slice `arcade-slice.html:165` (`first:6000`).
- Status: LIKELY. This is also "when and how often a child is asked", so For Rachel, not a plain fix.

## Experience problems
- **A 4-year-old opening Fruit Slice** (picture `slice-320-play.png`): a pretty orchard, but the only instruction is a small sign "Swipe to slice!" and the top bar has a big "rrrr" pill with a mic. No hand, no moving finger, no voice line before the first fruit. Compare Sound Sprint, which has a spoken how-to. The pill's words "Say rrrr when Echo asks" are unreadable to the child and the pill is also a button (a tap on it asks at once).
- **Piano Tiles has no how-to at all.** One tile falls in the far-left lane (picture `tiles-320-play.png`) and a tiny "Tap!" shows only when it reaches the keys. Works for a 7-year-old; a 4-year-old gets no pointing.
- **Block Stacker is clear (the plaque says "Tap to drop the block!" and a dotted line shows the landing), but too easy to be exciting:** a drop within 12 to 18% of the width snaps and says PERFECT, anything over 50% overlap is kept, and a block is never narrower than 60% of the first. A 7-year-old will win without trying, and it plays slowly.
- **The sound is a toll in Stack and Slice.** Stack floors last about 15 to 25 seconds, Echo's mid-floor ask is held back when under 7 seconds are left, so most children meet the sound only on the card between floors. The power it buys ("Slow blocks") is not needed in a game that is already forgiving. In Tiles the sound-slowed keys are a real benefit.
- **Echo's voice over the music in Tiles:** while he asks (about 10 seconds) the notes go silent (`tone()` returns while `slowTurn`), so the song the child just built goes quiet in the middle of a phrase.
- **No Echo on the board in Tiles**; in Slice and Stack he cheers at the side. Tiles' end looks the same as the others.
- **After a round:** "Play again" sends the child back through the "Say it 5 times" page every time; "Back home" lands on Home with no nudge to today's story. There is no end-card bridge to tomorrow. The best-line is nice and kind ("3 away!").
- **Rotation:** Slice and Stack compute gravity / block size once at load and do not rescale on resize. Fine on a locked phone; an iPad turned mid-round would look wrong (UNSURE, not run).

## Improvements, ranked
1. **A first-ever-round gentle start in Fruit Slice** (no heart cost for the first wave or for ages 2 to 4, and a ghost finger that swipes across the first fruit). Why: it is every family's first game and the first 8 seconds decide the first impression. Impact High, Effort Small, Travis to approve; Rachel to confirm when the first sound ask comes.
2. **Say why when the mic is off** (one plain line plus do not count the adventure day), in all three games. High / Small / engineering, wording for Rachel.
3. **Stop the game loop when there is no ticket** (3 pages, one line each). Med / Small / engineering.
4. **A bridge on the end card:** if today's adventure is not done, "Next: today's story" under "Play again". Why: the loop right now ends at Home with nothing pulling toward tomorrow, and the day's adventure is where the reason to return lives. Duolingo's "Continue" does this. Med-High / Small / Travis.
5. **Block Stacker difficulty curve:** make the snap window shrink on later floors and let the block narrow below 60% on Level 2 and 3 only; add a gentle "wobble" at the top. Impact Med / Effort Med / Travis (finger play only, no speech change).
6. **A tap-bounce guard in Stack** (as Tiles has). Small / Small / engineering.
7. **Keep the notes playing in Tiles while Echo asks** (play them softly, or pause the song instead). Med / Med / Rachel (sound and mic rules).
8. **Per-pointer swipe in Slice** (see Bug 5). Low / Small / engineering.

## Versus the best apps
- **Fruit Ninja / Cut the Rope:** their first seconds teach by motion (a hand swipes across the first fruit; the first fruit never falls). Sona's first fruit just falls. Fits Sona's rules.
- **Piano Tiles / Magic Tiles:** the song speeds up and the stars build, and the notes you tap are the song. Sona's tiles do play the real notes, which is good; what is missing is a visible speed-up and the sound when you miss a note (a soft thud only on wrong keys).
- **Stack / Tower games:** the tower narrows when you are off, and the camera and block speed tighten, which is the whole tension. Sona's narrowing is capped at 60%, so tension never builds.
- **Duolingo ABC / Khan Academy Kids:** a spoken, pictured how-to before the first level, and a clear next step after each lesson. Sound Sprint has the spoken how-to; Slice, Tiles and Stack do not, and none of the three end cards points at what to do next.
- **Speech Blubs:** the child's voice makes the picture move at once. In Sona the sound is a mid-game toll, which is the heavier trade; Tiles' slow keys is the nearest to "the voice changes the game".

## Decisions worth another look
- **A round that ends because there is no mic, and still finishes the adventure day** (`questEnd` is called first thing in `endRound`). CLAUDE.md says "won or lost" is deliberate; a mic refusal is a third case it may not have meant.
- **Three hearts at once in the first game for 3 to 4 year olds.** Recorded as "Fruit Slice for everyone" (31 Oct 2026) and the hearts rule is 4 Oct; the pair may be harsher than either decision saw.
- **First ask at 6 s** (`first:6000`) was chosen by Travis for feel; the first-ever round may want a later first ask.

## Already good (keep)
- Hearts rules: the 1.5-second gap, tiles given a safe landing after a loss, no heart lost while Echo asks or the power is on, and the new-life card not spending a between-round card (`lifeTaken` adds the card back).
- Beat Your Best lines ("3 away!", "The same as your best!", "That is every note!") and the rule that a best only goes up. A round that counted nothing says no number.
- The Tiles bounce guard and the first three waiting tiles; the plumb line and glow in Stack; Slice's two-miss help and extras that never end a wave early.
- Fit at 320x568 and 375x667 is good in all three: the HUD, hearts, the Echo pill and the say-it card all fit (pictures `slice-320-card.png`, `tiles-320-play.png`, `stack-320-play.png` in the round-a folder).
- Pause/return: a hidden page freezes game time and the card re-asks on return.

## Not checked
- Real-phone feel (haptics, loudness of the notes, frame rate on an old iPhone).
- Rotation on an iPad mid-round; an iPad-size layout.
- Two-finger behaviour and a double tap in a real touch run (traced in code only).
- Echo's mid-round ask in all three games with a real voice (read `arcade-speech-help.js` and `arcade-sayit.js`, did not run them with audio).
- The "Say it 5 times" practice page that comes before every round (another auditor's area).

## Ratings (1 to 5)
| Game | Clear | Fun to repeat | Sound is part of the game | Fits small phones | Bug-free |
|---|---|---|---|---|---|
| Fruit Slice | 3 (sign only, no hand) | 4 (juice, trail, giant melon) | 3 (a toll mid-wave, but Super Slice feels good) | 4 | 3 (no-ticket run, 7-second fuse, two fingers) |
| Piano Tiles | 3 (no how-to, "Tap!" late) | 4 (real songs, bounce guard) | 4 (slow keys is real help; notes go silent while Echo asks) | 5 | 4 |
| Block Stacker | 5 (plaque and plumb line) | 3 (too forgiving, plays itself) | 3 (power not needed) | 4 | 3 (early-tap miss) |

Scratch scripts and pictures: `audit/round-a/` (t1.mjs, t3.mjs, fake.mjs, *.png).
