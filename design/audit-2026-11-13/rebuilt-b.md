# Seven Say & Play games: Space Trip, Bedtime Stars, Pizza Chef, Treasure Map (rebuilt) and Race Car, Castle Builder, Grow a Flower (not rebuilt)

## In five lines
- The four rebuilt games are clean: saying the word gives no power (confirmed, power reads 0 after the word in all four), every round is different, every step can always be finished, and they fit at 390x844 and 320x568.
- The three old games still hand out a power just for the word: Race Car (7.5 s slow road), Castle Builder (9.5 s steady rope), Grow a Flower (9.5 s gentle shower). Confirmed on the fake phone.
- Grow a Flower has Echo say the same direction after every single word (confirmed: 3 of 3 steps). Race Car and Castle Builder play the same every round; so does the flower.
- No crashes or stuck states found in any of the seven. No page errors in any run.
- Bedtime Stars is a 3-4 game but every round ends on a 6-7 line picture; worth Rachel's look.

## Bugs
No P0. No P1 beyond the "not rebuilt" gaps below, which are product gaps rather than breakage.

### P1
1. **The word still gives a power in three games** (a child who talks gets an easier game for 8-10 seconds; the rebuilt games removed exactly this).
   - Sees: after "rain" said twice, Race Car's road slows for 8 s, Castle's rope goes steady and the slot is 2.2x wider for 10 s, the flower's shower is double width for 10 s.
   - Steps: open the game, say the word twice, read the game state. CONFIRMED (fake phone): racecar 7.52, castle 9.52, flower 9.52; space, stars, pizza, treasure all 0.
   - Where: `public/racecar.js:183` (onWord calls power), `public/castle.js:381` (earnPower(SAY.slide)), `public/flower.js:314` (earnPower()).
   - Fix: onWord starts the step only; keep the help pill's own word for the power (same as the four rebuilds). Race Car's ring (`racecar.js:36`) already counts slow>0 as a ladder step, remove that too.
2. **Grow a Flower: Echo says the same line after every word.** "Hold the can over the glowing soil." was spoken after each of the first 3 words (CONFIRMED, speech log). Cause: `said = {}` is reset in every onWord (`flower.js:314`). Fix: keep `said` for the visit, reset only in reset(), as Pizza's `told` does.

### P2
3. **Race Car: a ring can finish with no touch.** The ring sits at 0 on legs 3, 6 and 8; a child who kept the car in the middle to dodge cones is already inside when the road ends, so the leg completes at once (`racecar.js:140`, `arrived` flag). LIKELY. Fix: pick the ring lane away from where the car is (and vary it per round).
4. **Race Car: Echo repeats "Drag to steer into the glowing ring." on every leg** where the child lingers 4 s at the ring, because `told` resets each word (`racecar.js:177`, `:143`). LIKELY. Fix: keep `told` for the visit.
5. **Bedtime Stars is a 3-4 game (group "simple") but every round has one picture of 6-7 lines** (fish, heart, cat, crown) and no little-kid ladder (`stars.js:52` ROUND_TIERS, no setLittle). The help always arrives (4 s / 8 s), so no child gets stuck, but a 3-year-old drags a long path. UNSURE: For Rachel.
6. **Per-frame work on the main thread.** Pizza builds a ~170-cell grid object every frame (`pizza.js:393`, called from hud() in tick `:598`); Bedtime Stars redraws up to four little canvases with glow every frame (`stars.js:115`); Space builds its whole state object every frame. Could stutter on older iPhones. LIKELY, not measured.
7. **Pizza bake has no real timing.** Heat never cools, so tapping Bake in small bursts reaches the green every time; only holding too long counts as too hot (`pizza.js:594`). It cannot fail a child who taps, which is kind, but "let go in the green" is not a skill step. Design note, not a defect.
8. **Treasure Map: starting a line is fussy on a 4-inch phone.** The finger must start within about 27 px of the boat at 320x568 (`treasure.js:151`, grab 0.12 of a 225 px map). A start elsewhere shows "Start your line at the boat" and, if dragged, counts as a miss. Fix: bigger boat grab (like 0.18) from the first try.
9. **Resizing mid-move drops what the child holds.** Pizza's fit() calls stopGesture(), so a held topping vanishes back to the tray if the window resizes (Safari bars on the website). UNSURE, not reproduced.
10. **Treasure Map pagehide sets paused with no matching un-pause** (`treasure.js:161`); SayPlay's resume covers the normal path, a bfcache return may need a tap. UNSURE.

## Experience problems
- **Space Trip (5-8):** Engine to lift, slide thumb to steer, two arrows, an Easy flight pill and a glowing pad is a lot with no spoken how-to (Echo never explains). The play area is only about 190 px tall on a 320x568 phone (picture: stages-space 320). The ladder always finishes it, but the first two tries will feel hard.
- **Race Car:** cones and rival cars cost nothing but a short slowdown, so the first 12 s of every leg is only watching; the one real action is the ring. STOP button is never explained (start card says nothing about it). Star count "0" is shown top right (play, not a grade, but a number).
- **Race Car at 320x568:** the "Slow road" bar and banner stack in the upper road, fine; controls and car are close.
- **Castle Builder:** the piece must land within about 12 px of the slot while the load swings; without the word's power it will feel much harder, so removing the power needs the first-try swing gentled (see plan).
- **Grow a Flower:** the same pink flower, same place, 5 times; banner wraps to 2 lines at 320 and 390.
- **Treasure Map:** the map shrinks to 225 px wide on a 4-inch phone; ring numbers 1-8 need reading (fine for 5-8).
- **Bedtime Stars:** the start card shows all 12 pictures as faint shapes, which hints at what the surprises are. Small thing.

## Improvements, ranked
1. Take the free power off the word in Race Car, Castle, Flower. High, Small, engineering (Travis already ruled this for the rest).
2. Stop Echo repeating directions (Flower every step, Race Car every leg). Med, Small, engineering.
3. Race Car rebuild (plan below). High, Med, Travis to agree.
4. Castle Builder rebuild (plan below). Med, Med, Travis.
5. Grow a Flower rebuild (plan below). Med, Med, Travis.
6. Rachel to look at Bedtime Stars' 6-7 line picture for 3-year-olds. Med, Small, Rachel.
7. Space Trip: one spoken how-to the first time (Echo, once a visit) and a bigger flight area on short phones. Med, Small, engineering.
8. Bigger boat grab on Treasure Map for small phones. Low, Small, engineering.
9. Trim the per-frame state building (Pizza grid, Stars kept pictures). Low, Small, engineering.

### Rebuild plans (plain words)
**Race Car.** The word only starts the stretch. The road is different every race: the ring is in a new lane each stretch and never where the car already is, cones and rivals are in new lanes, and each stretch has one star trail you can follow (the star count goes). What the child sees: a hill-road with a gate far ahead that shows its lane early, "Steer to the ring" said once by Echo. What the finger does: slides left and right; a rival car sits in the lane next to the ring, so reaching it means passing it. A bump costs a short wobble. The ring still widens after misses. Each round: new lanes, a new order of stretches, a new rival colour; the end card names the car colour won ("A green finish!") without a count.

**Castle Builder.** The word only brings the piece. The build is different every round: choose a castle from a few (keep and two towers, a long wall with a gate, a tall tower with flags), pieces come in a new order, and the slot is new each time (not always keep first). The ghost shows the slot; first tries swing less than today because the word no longer calms the rope. What the child sees: the crane, the ghost, a rope that sways gently. What the finger does: slide the crane, hold Lower. After a miss the rope calms and the slot glows, as now. Echo explains once a visit. The finished castles join a "my castles" row like Bedtime Stars' sky (a collection, no count).

**Grow a Flower.** The word only fills the can. A different garden every round: the flower is one of several (a tulip, a sunflower, a daisy) in a new spot, and each of the five steps asks a different job: water the seed, then water a sprout that moves a little left and right, then a second pot appears. What the finger does: carry and tip the can, tap Refill when empty. The step ends as today (help after misses). Echo explains each kind once a visit. A child's flowers collect in a garden on the start card, like the sky in Bedtime Stars.

## Ratings (1-5): clear / fun to repeat / the word feels part of the game / fits small phones / bug-free
- **Space Trip:** 3 / 4 / 3 / 4 / 5. Real flying, new planets and pads each trip; no how-to, small play area at 320.
- **Bedtime Stars:** 4 / 4 / 3 / 5 / 5. Surprise pictures and a growing sky; the word only opens the picture.
- **Pizza Chef:** 5 / 4 / 4 / 5 / 5. Best of the seven: the silly topping is the word itself; bake is too easy.
- **Treasure Map:** 4 / 4 / 3 / 3 / 4. Route planning is a real puzzle; small boat target at 320.
- **Race Car:** 4 / 2 / 1 / 4 / 4. Same every round, power just for the word, mostly watching.
- **Castle Builder:** 4 / 2 / 1 / 4 / 5. Same castle every time, power for the word.
- **Grow a Flower:** 4 / 2 / 1 / 4 / 4. Same flower, repeated Echo line, power for the word.

## Versus the best apps
- Pok Pok and Toca Boca change the toy each time you open it; Sona's three old games do not. The four rebuilds do.
- Sago Mini keeps what you made (a house, a pet); Bedtime Stars' sky does this. Castle and Flower could keep a castle or garden (fits Sona's rules: a collection, no count).
- Duolingo-style streaks do not fit; "a new thing waiting next time" (a new castle, a new flower) does.

## Decisions worth another look
- Bedtime Stars asking 3-4 year olds for a 6-7 line picture every round (Rachel).
- The Race Car star count on screen (Travis).
- Whether the "Easy flight / Slow road / Steady rope" help pills should stay on the screen for everyone from the first second, or appear only after a first miss (Travis; the word for it is Rachel's).

## Already good (keep)
- Every step in all seven always ends without speech: the miss ladders, glow, arrow, snap or pull all work and use finger work or real misses, never idle time.
- Reduce Motion, pause and return, two-finger ownership, and per-child sky storage (`sona.stars.v1` is in the per-child list).
- Pizza's silly topping made from the child's own word; Space Trip's eight differently coloured planets and moving pads; Treasure Map's red trail of the child's route; Echo explaining once a visit in Pizza and Stars.
- Words on screen are kind (no "missed" or "wrong") and fit one line at 320 except the flower's banner.

## Not checked
- Real touch play with two fingers, and audio (no sound on the fake phone).
- Full rounds of Space, Stars, Treasure, Race and Castle by finger (only the first word and the stage layouts were played; Flower was played 3 steps).
- Bedtime Stars kept-picture slots on a phone on its side, landscape layouts in general.
- Frame speed on a real older iPhone (perf finding is from reading code).
