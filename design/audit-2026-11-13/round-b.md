# Round games B: Sound Sprint, Flappy Glide, Rise Up, Feed Echo

## In five lines
1. Rise Up is the best built of the four: it moves by real time, has a clean finger-drag, and every heart / new-life / best-line rule held up when I traced it.
2. Sound Sprint and Flappy Glide move by FRAMES, not by seconds, so on a phone that draws more or fewer than 60 frames a second the games play at the wrong speed. This is the one real bug I found that a child would feel.
3. Feed Echo is gentle and the "say it first" lock works, but a child the phone cannot hear gets text-only help and no way out; and the glowing right picture makes the picture choice pointless.
4. The new-life, Echo-ask, sound-power, best-line and "mic refused" paths all follow CLAUDE.md as written. I found no heart, rep or best-score double-count.
5. Ratings (1-5 clear / fun again / sound is part of the game / fits small phones / bug-free): Sprint 4/3/3/3/3, Glide 3/3/3/4/3, Rise Up 4/4/3/4/4, Feed Echo 4/2/4/4/4.

## Bugs

### P1
**B1. Sprint and Glide run at the wrong speed on phones that are not 60 frames a second.**
- Sees: on an iPhone Pro or iPad Pro (screens that can draw 120 times a second) the road, rocks, hedges and the falling balloon could go about twice as fast as on Travis-tested 60 Hz; on a phone in Low Power Mode (30 times a second) everything goes half speed. Rise Up does not have this problem.
- Why: the road/hedge movement is "a fixed number of pixels per frame" while the stretches and gate spawns are timed in real seconds. Sprint: `speed0=H*0.0029` (arcade-run.html:264) and `step=speed*...` (:556) are added once per frame, and the lane glide `laneX+(lane-laneX)*0.25` (:577) is per frame. Glide: hedges `g.x-=gspeed*pace` (arcade-glide.html:445) and gravity/flap `vy=Math.min(VMAX,vy+G); py+=vy` (:460) are per frame, while gates appear on a `dt` clock (:439). At 120 Hz gravity effects roughly quadruple per second and flaps double, so "a tap about every second holds it level" (the design) no longer holds. Rise Up's board uses `dt` (rise.js:181-207), so it is fine.
- Steps: play either game on a 120 Hz or Low-Power-Mode phone. Status: LIKELY. I read the arithmetic and measured 60 frames a second and 2.45 px/frame (Sprint), 1.01 px/frame (Glide) on the fake phone; I could not make the fake browser run at 120 Hz (CPU throttling did not lower the frame rate), so I did not see it on screen.
- Fix: multiply every per-frame step, gravity, flap impulse and the lane glide by `dt/16.67` (capped), as Rise Up does.

### P2
**B2. Sprint start card: a second finger can send the runner to the wrong lane.** Swipe direction is measured from the LAST finger that touched down (arcade-run.html:483-488), so when two thumbs overlap, lifting the first finger compares against the second finger's start point and can jump a lane the child did not ask for. Fix: track start point per `pointerId`. Status: LIKELY.
**B3. Sprint and Glide never re-measure speed after a turn/resize.** `speed0`, `G`, `FLAP`, `gspeed0` are fixed from the window size at load (arcade-run.html:264, arcade-glide.html:230-232) while `fit()` runs on resize; an iPad turned mid-game plays with the old numbers on a different-size board. Fix: recompute on resize (Rise Up already does `Rise.resize`). Status: LIKELY (small).
**B4. At 320 wide Sprint's top bar is crowded:** the stretch pill ("Park" + bar) is clipped against the right edge (I looked at a 320x568 picture). Status: CONFIRMED (picture), cosmetic.

No heart, new-life, rep, best-line or end-card bug found in any of the four (traced every path; details under "Already good").

## Experience problems
- **Feed Echo, a child who is not heard (3-4 years old).** `LISTEN_MS=8000` (arcade-feed.html:478): after 8 quiet seconds the mic closes, a small mic button appears and a TEXT line says "Tap the mic, then say 'robot'" (`nudge`, :609). A 3-year-old cannot read that and Echo says nothing. There is also no grown-up "skip this one" like the books have, so a child whose voice is too soft for the loudness bar can sit on one picture forever. Echo should say the word again by himself (voice, not text) and, after two misses, offer a grown-up's skip (For Rachel: a skipped word must stay play, never a rep).
- **Feed Echo, tapping early.** A tap on a picture before the word is said only wobbles it and shows text "Say 'robot' first!" (:677). A non-reader hears nothing. Echo repeating "Say... robot" is the better answer.
- **Feed Echo, the choice is fake.** After the word is heard the right card gets a glowing outline (`speechHint`, :553) and the wrong pictures never hurt, so the pictures need no looking at. For a 3-year-old that is gentle, but it makes the "find the picture" half of the game pointless and the game ends after only 5 feeds (about a minute). The fun-the-10th-time answer is "no": same five-step loop, only Echo's size grows slowly.
- **Sprint** is clear in the first 10 seconds only for the first 3 races (Echo's start card with three pictures, no reading needed). After that, the child is dropped into the race with a text hint. Fun the 10th time: the three stretches are the same each race (park, beach, forest), obstacles are random rows. The one change that most improves the feel: obstacle "patterns" that build and release (like Subway Surfers: a train in one lane, ramp in another) instead of one random block per row, so the child feels they are reading the road, not just dodging dice.
- **Glide** needs a tap about every second to float level. That is the hardest control for a 5-year-old. Hold-to-rise (below) is the single change that most improves it.
- **Rise Up** has no start card and no spoken how-to ("Drag anywhere to move the shield!" is text, :hint). The relative-drag shield (it never jumps to the finger) is clever but not obvious to a 5-year-old, who expects the shield to go where the finger is. At 320x568 Echo's sound button sits right under where the first blocks appear (I saw two blocks peeking behind it).
- Sound feels part of the game: Echo's mid-round ask ("Super Slice" style) interrupts play for about 10 quiet seconds (no game sounds) in all three; fine as decided, but in Glide and Sprint it fires while the child's finger is busy, so a child must stop tapping to say it.

## Improvements, ranked
1. **Make Sprint and Glide time-based (B1).** Impact High, effort Small-Med, engineering. Without it, the games feel different on every phone.
2. **Feed Echo: Echo says it again, by voice, when a child is not heard or taps early; grown-up skip after two misses.** High, Small-Med, Rachel (what counts / skip) then engineering.
3. **Glide: hold-to-rise at Level 1** (finger down floats up gently, release sinks slowly). Would it help? Yes. Read the code: the one-tap-per-second control is why a hedge bump stops being fun, and holding takes away the frame-rate sensitivity if done by time. Risk: the game becomes too easy and loses a reason for Echo's slow power, so keep taps for Levels 2-3, or keep both (a tap lifts, a hold lifts steadily). Medium, Medium, Travis (changes the control).
4. **Rise Up: a first-visit start card with Echo's voice showing the shield following the finger** (like Sprint's). Medium, Small, engineering.
5. **Sprint: obstacle patterns instead of random single blocks** and a visible lane-change "swoosh". Medium, Medium, Travis.
6. Feed Echo: more than five feeds, or new foods and a growing plate (Echo's size already persists), so the 10th visit differs. Medium, Medium, Travis.
7. Sprint two-finger swipe (B2) and resize (B3). Low, Small, engineering.

## Versus the best apps
- **Subway Surfers / Flappy Bird feel:** their motion is locked to time and the control is forgiving. Ours is locked to frames (B1). Subway also gives rewards for reading patterns.
- **Toca Boca / Sago Mini / Pok Pok:** never a dead end for a small child; everything has a voice or a picture cue. Feed Echo's text-only nudges are the gap; Pok Pok would have Echo model the word again and wait.
- **Speech Blubs:** a child sees a model mouth saying the word. Echo only speaks it. Not in scope (clinical, Rachel).
- **Lingokids / Duolingo ABC:** a child can always move on with help from a grown-up. Feed Echo has no equivalent.
- **Duolingo:** short sessions with a visible reward every few seconds. Rise Up's "blocks pushed" counter and "Whoosh!" chain are the closest; Feed Echo's five feeds are too few and the same every time.

## Decisions worth another look
- **A day can be finished with no word said.** "I'm done playing" on the first say-it card, or a refused mic at the first checkpoint, calls `endRound` which calls `questEnd` (arcade-run.html:938, glide :687, rise :740) so today's story day counts as done and gives its sticker after about 25 seconds and zero words. CLAUDE.md says "a round, won or lost" finishes the day, so this is by design; worth Rachel and Travis deciding whether "done early with nothing said" should still earn the story's sticker.
- **Unlimited new lives.** A child who never steers but says the sound at every "new life" card can still finish Sprint, Glide or Rise (recorded in CLAUDE.md for Rise Up). It is play, not practice data, but it means winning is not about the finger. Rachel/Travis call.
- **Rise Up has no levels and Feed Echo none;** fine, but a child with a high best in Rise Up has nothing new to chase.

## Already good (keep)
- Hearts, the new-life card and its REV count: traced `lifeOrEnd`/`lifeTaken` against `doRevive` in all three round games; the card count nets out and a child can earn a new life as often as they lose (REV-- then REV++).
- A heart is never lost while Echo asks, while the power is on, in a rest, or within 1.5 s of the last (Sprint :289, Glide :259, Rise `loseHeart`). Nobody can lose all three hearts in one second.
- No-touch fairness: a child who never touches Sprint, Glide or Rise runs out of hearts; none can be won by standing still (Rise starts the shield beside the balloon on purpose).
- Rise Up: relative drag, each finger kept separately, a turned iPad gives 1.5 s grace, pause/background stops all clocks.
- Best lines: counts the finger, not the voice; "N away!" only within 10; level bests kept apart (arcade-run.html:302-333, glide :264-292, rise :213-225).
- Sprint's start card is fully readable by a non-reader (three pictures, Echo's voice, Skip) and never a dead end if the voice service is slow.
- Feed Echo: silence never unlocks a picture; the mic never opens over Echo; mic refused goes to a kind exit; pause/background closes the mic and shows the mic button.
- Wrong pictures never carry the practice sound (`hasSound`, :431 area), so there is never a second right answer.

## Not checked
- Any real phone: 120 Hz, Low Power Mode, native mic, the ring/silent switch.
- iPad layout and the 375x667 size (I looked at 320x568 for the four games' first screens only).
- Playing a full Sprint/Glide/Rise round through the fake voice (I read the code paths; I ran one Glide life-loss on the fake phone and saw the new-life card appear with no page error).
- Levels 2 and 3 numbers, sona.js BESTS1/LEVELS1 internals beyond what the pages call, and `crafted-words.js` beyond following the calls.
- Two-finger behaviour in Rise Up and Glide beyond reading the code.
