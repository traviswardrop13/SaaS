# rebuilt-a: Rocket Blast, Build a Snowman, Robot Builder, Choo-Choo Train, Birthday Cake, Balloon Party

## In five lines
1. All six are real finger games now: the word starts the step and the finger does the work. Every step has a ladder that ends, and I found no step that can hang a child.
2. Best two: Balloon Party and Birthday Cake (a buddy with a party hat, new colours/fruit/candles each round, a clear finish).
3. The most real problem is the Rocket planet collection: only 3 planets are in, so a child finds all of them in the FIRST round and the "collection" is over.
4. Leftover "help power" carries into the next step in Rocket, Snowman and Cake (Train and Balloon clear it; Robot clears it on solve).
5. Start cards are still paragraphs of text; only Echo's spoken intro helps a child who cannot read. Train starts with no friend on screen.

## Bugs
### P1
- Rocket: the planet collection ends in one round. Sees: after the first round of five trips, every planet (Bumpy, Purple, Ring) is in colour and no new planet can ever appear. Steps: first play; plan() gives up to 3 new planets on a first round (`unseen.slice(0,newCount)`). Where: public/rocket.js:40-52 and :98-113. Status: LIKELY (traced). Fix: do not ship the collection hook until about 8 planets exist, or hide the planet rows and "found" title while fewer than ~6 planets are in.
### P2
- Leftover help power carries into the next step. Sees: a child who used "Big ring / Snowy help / Cooking help" and finished with seconds left starts the next word with the easy ring/spots/cooking power still on and the power bar frozen on screen. Steps: ask for help, finish the step fast, say the next word. Where: rocket.js:393 (onWord does not zero `power`), snowman.js:335-340, cake.js:315 (go() does not zero it; the countdown only runs while canPlay). Train (train.js:345) and Balloon (balloon.js:456) do zero it. Status: LIKELY. Fix: set power = 0 in each onWord.
- Rocket: two taps on the rocket with no pull count as two misses, so the ladder jumps to "any downward pull flies in". Sees: a 3-year-old poking the rocket twice gets auto-aim. Where: rocket.js:319-325 (launch() calls miss() on a too-small pull). Status: LIKELY. Fix: a pull under minPull that never moved should only show the banner, not count a miss.
- Balloon: the lit ring on the two outer positions slides sideways at the first miss (edge clamp grows with ringScale), 11-15 px, while the child is aiming. Where: balloon.js:113-117, :87. Status: LIKELY. Fix: clamp using the largest ringScale from the start.
- Rocket title is cut to "Rocket Bl..." at 320x568 (picture rocket-320-1play.png). Where: arcade-rocket.html top bar. Status: CONFIRMED (screenshot). Fix: shorter title in the pill ("Rocket").
- Train: Echo repeats a different how-to line on every one of the five trips. Where: train.js:345. Snowman, Cake and Balloon say each kind once a visit. Status: CONFIRMED by reading. Fix: say once per kind.

## Experience problems
- 4-year-old, start cards: Rocket's card is two sentences plus "Big ring: say it again for extra help"; Snowman/Cake/Robot/Balloon similar. A child who cannot read depends on Echo's spoken intro and the picture. Cards should be a picture plus one short line (see pictures *-0start.png).
- Train (train-390-1play.png): at the first stop the friend is off-screen to the right; the screen shows only a train, an arrow button and "Hold Forward. Let go by our friend". A child sees no friend to aim for. Show the next friend's face peeking at the right edge from the start.
- Rocket: the planet is a glowing ring on an empty sky, the pull has a thin arrow. Pulling a pull-back toy is good, but the rocket is small (about 50 px) at 320x568.
- Robot: it is a logic puzzle (rotate wires). A 5-year-old can do circuits 1-3 (3 to 5 taps); circuits 7-8 (7 and 8 wires through the whole board) will be hard for a 6 year old, but help level 3 makes them finish. The word has no link to the puzzle (true of all six; the rule is the engine's).
- Balloon: tap the pump 6 times, drag, repeat 5 times. Pumping is the dull part; the buddy hop and colours carry it. The buddy sits next to the pump and under the home balloon at 320 wide (balloon-320-1play.png), close but readable.
- Fun the 10th time: Robot (new route every circuit), Balloon and Cake (new buddy/colours/fruit) change most. Rocket changes least once planets are found. Snowman has 3 hats x 2 neck pieces, nothing else changes.
- Miss feel: all use kind banners ("So close!"), no "wrong". Good.

## Improvements, ranked
1. Rocket: ship 6-10 planets before the collection shows (impact High, effort Medium, Travis: art credits).
2. Zero `power` in onWord for Rocket/Snowman/Cake (High-ish correctness, Small, engineering).
3. Start cards: one picture and one line, voice does the rest (High for non-readers, Small, Travis).
4. Train: show the friend peeking in at the start; say how-to once (Medium, Small, engineering).
5. Rocket: do not count a no-pull tap as a miss (Medium, Small, engineering).
6. Give every game a payoff on Home: the buddy/party/robot/snowman you made as a sticker or picture to keep (like Toca/Pok Pok keepsakes) (High, Large, Travis).
7. Robot: add a "paint your robot" reward when finished (colour pots exist; show the robot at the end card) (Low, Small, Travis).

## Versus the best apps
- Pok Pok / Toca Boca: wordless start. Sona games explain in text; Sago Mini lets the child act at once. Fits Sona: yes (voice intro is already there).
- Duolingo ABC / Speech Blubs: a keepsake or collection that keeps growing. Rocket's collection stops in one round; Cake/Balloon forget everything. A per-child keepsake would fit (no score, no streak).
- Endless Alphabet: each word's picture does something funny. Sona's word panel is separate from the game; the word only starts the step. That is the engine and Rachel's rule, so only the pictures could change.

## Decisions worth another look
- Words must be said twice before each of 5 steps, and Robot/Cake/Balloon steps take 15 to 30 seconds of finger play: ~10 minutes a round for a 4-year-old? Rachel's call on length and on whether the word should relate to the step.
- "Easy stops / Big ring / Snowy help" pill: 2 more sayings for a power on top of ladders that already guarantee success; kids learn they can skip it. Rachel/Travis.

## Already good (keep)
- The ladders: every step I traced ends (Rocket snap at 2 misses, Snowman release-anywhere at level 2, Robot snapping wires at level 3, Train holds drive to the friend at level 3, Cake effort ladder, Balloon float-in at level 2).
- Pause/resume handling, one-finger ownership, resize cancels the gesture cleanly in all six.
- Balloon and Train/Cake zero or clear state per word; Balloon's tinting avoids orange.
- Rocket's collection is saved per child (Sona.kkey("sona.rocket.v1")), read only in the page.
- 320x568 fits for all six; nothing under the top bar (sheet-320-1play.png).

## Not checked
- Ran only start and first-word screenshots at both sizes; did not play full rounds, two-finger, fast taps, or Play again twice on the fake phone. Power carry-over and the ring slide are traced from code, not run. Robot colour pots (hue-rotate on gold/rose art, possible orange tint) not looked at. sound/voice not audible here.

## Ratings (clear / fun to repeat / word part of game / small phones / bug-free)
- Rocket: 3 / 3 / 2 / 3 / 3 (aiming is good; collection ends fast; title cut at 320)
- Snowman: 3 / 3 / 2 / 4 / 3 (nice demos; same every round except hat; power carry-over)
- Robot: 3 / 4 / 1 / 5 / 4 (new puzzle each time; word unrelated; best fit)
- Train: 2 / 3 / 2 / 4 / 4 (friend not visible; repeats Echo each trip)
- Cake: 4 / 4 / 2 / 4 / 3 (buddy birthday, candles by age; power carry-over)
- Balloon: 4 / 3 / 2 / 3 / 4 (clear and cheerful; pumping is repetitive)
Best: Cake, then Balloon. A game a child asks for needs a keepsake and a word that does something in the picture.
