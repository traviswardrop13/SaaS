# Daily games B: Kite (day 10), Nest Lift (11), Pond Concert (12), Rooftops (13), Observatory (14)

## In five lines
- The five games are solidly built: access, pause, resize, mic quiet rules and "nothing finishes a move by itself" all hold, and each has a thorough test suite. I found one real "child gets stuck" bug (Observatory) and a few smaller ones.
- The big weakness is not bugs, it is the little-kid (3-4) version: it uses the same grown-up directions and the same tools as the 5-8 version, just with fewer moves. Words like "counterweights", "golden rail", "conduct" and two sliders for aiming are not for a 3-year-old.
- In every game the spoken word is a gate in front of the game, not part of it (the word is said 3 times, then play starts and the word does nothing until the next move). Same as the rest of the app, but it is most visible here.
- Day 14 (Observatory) is not a finale: the last turn of the wheel ends, the machine stops, and the end card covers it. Nothing celebrates "the last adventure".
- narration.js and stories.js (about 1,000 lines) are not loaded by any app page; they are only used by tests. Dead weight on the live site.

## Bugs

### P1 — Observatory: a wrong gear blocks the right one (CONFIRMED)
- Sees: a child puts the wrong size gear on a glowing axle. The gears turn red and the banner says "The gears squeeze. Try another size." The child takes the right gear from the tray and drops it on the same axle. The gear jumps back, and the banner says "Place the gear over a glowing axle." although the child IS over the axle. Again and again. The "Bright edges" help does not fix it.
- Steps: age 3 (or any age), start Observatory, say the word 3 times, drag the LARGE gear onto the first axle (S1), then drag the SMALL gear onto the same axle. I did this 6 times on the fake phone: the axle stayed large, misses went to 6, help level went to 2, banner stayed "Place the gear over a glowing axle."
- Where: `public/daily-adventures/observatory.js` line 45 (`drop()`): a gear from the tray can only land on an EMPTY axle (`!s.size||s.id===g.from`). The only way out is to drag the placed gear down into the thin tray strip (`H-126..H-56`), and only the Turn button's jam banner (line 36, "Lift one back to the tray.") says so. The drop banner (line 45) says "Try another size", which sends the child down the blocked path.
- Fix: let a tray gear dropped on an occupied, unlocked axle REPLACE the gear there (swap it back to the tray). Also change the jam message to "Drag the gear back to the tray."
- Why it matters: a 3-year-old who guessed wrong first (1 in 3 chance each time, 5 moves) can be stuck on a move that never finishes by itself.

### P1 (experience bug) — Observatory: the "glowing axle" cannot be seen (CONFIRMED by picture)
- Sees: Echo says "Fit a gear on the glowing axle", but the target is an 8 pixel pale dot with a faint ring on tan wood (picture `obs-crop.png`). At 320x568 it is smaller still. A 3-year-old cannot find where to put the first gear.
- Where: `observatory.js` `drawAxles` (line 62): live axle radius 11 world units (about 4 px on a phone), ring 31 (about 11 px), colours `#e8d49a` and `rgba(234,212,154,.08)`.
- Fix: draw a bigger, pulsing, high-contrast ring (teal, 30+ px) on the axle the current job needs, not only when the help is on.

### P2 — Observatory: Echo repeats the same direction after every help turn and every pause (CONFIRMED)
- Sees/hears: after the help word, and after returning from a pause, Echo says "Fit a gear on the glowing axle. Hold the round arrow to turn the wheel." again, even though the child heard it. In my run the line was said 3 times in one move.
- Steps: start, say the word, wait, tap the help pill, say the word 3 times (or tap "Back to the game"), then pause and resume.
- Where: `observatory.js` lines 76-78: `onHelp` and `resume` both call `resumeInstruction()` which speaks unconditionally. Nest Lift does not do this (checked: no repeat).
- Fix: speak it on resume/help only if it was cut off (the engine already has `replayInstruction()` for that), or say it once per move.

### P2 — Kite: the help word barely helps ribbon threading (LIKELY)
- Sees: ribbon threading is the hardest finger task (follow 6 dots in order, with a loop). The help pill says "steady the cloth and widen the stitching path", but the dot size is capped: `ringRadius()` is `min(27*.70, 17*...)` = 18.9 px for 3-4 and 16.1 px for 5-8 whatever the help or misses (base 17 and 13). So the miss ladder and the help word add at most 11% (3-4) or 24% (5-8) to the dots.
- Where: `public/daily-adventures/kite.js` line 21.
- Fix: raise the cap (or scale the ring with assistance) so the third miss really makes the dots forgiving. Not verified by playing it.

### P2 — Observatory help pill says two different things (CONFIRMED by reading)
- Start card text and pill label say "Bright teeth" (`pages.js` observatory `helpText`), the game then relabels the pill to "Bright edges" (`observatory.js` line 44) and uses a different spoken label. Harmless, but the words a parent reads on the start card do not match the button.
- Fix: one word in both places.

### P2 — Concert: tapping instruments does nothing while Echo speaks his direction (LIKELY)
- Sees: after a word is earned, Echo reads the direction (about 5 s on a real voice) and the drum, reeds and chimes are disabled (`musicReady()` needs `!voiceBusy`, concert.js line 17). A child who taps at once gets no reaction and no explanation. The beat timeline also freezes (line 108).
- Fix: dim the controls visibly while Echo talks, or let the first touch play. Not run with a real-length voice (the fake phone speaks in 100 ms).

### P2 — Title pill is cut off on every phone: "The Hilltop Patch…", "The Sandstone N…", "The Lily-Pad Con…", "Seeds Across the…", "The Moving-Star…" (CONFIRMED by pictures at 390 and 320 wide)
- It is the game's name in the top bar (`story-game.html` `#ttl`); the end of every title is lost. Fix: use the short name from `STORY_DAYS` ("Patchwork Kite", "Nest Lift"...).

## Experience problems
- 3-4 year olds get grown-up directions. The five Echo lines in Nest Lift include "Move stones until the beam lies level", "Match the bundle's weight dots"; Concert "Guide your hand into the glowing instrument when the dot touches its leaf"; Kite "Steer through the breeze circles". Days 1-3 have a separate short script for little kids; Days 4-14 do not (the strings are the same for both ages, see each game's `instruct(...)` calls). For Rachel: the words, and whether 3-4 year olds should do these tasks at all.
- Big jobs inside one move for the little version. Kite move 3 is five jobs in a row (two seams and three ribbons) after one word; Rooftops moves 3 and 5 are five seed flights each (about 16 flights in the round, each needing: drag seed, move two sliders, tap Launch). The word is said once per move, so the child plays for minutes between words (a 4-year-old's round is mostly not speaking). For Rachel/Travis: this is a design call.
- Rooftops needs precision aiming with two small sliders; at 320x568 the whole rooftop board is only about 230 px wide (picture `rooftops-a7-320-play.png`). A 3-year-old sees two unlabelled sliders with tiny icons.
- Observatory tray gears are 38 px on a 320 phone, and a plain tap on a tray gear does nothing (drag under 10 px is ignored). Add a tiny "wiggle toward the axle" on tap.
- Start cards are two paragraphs of reading ("Stuck? Say your word again for steadier cloth and an easier stitching path."). A 4-year-old cannot read it; Echo says the first part aloud.
- Kite flight and Rooftops are fun to watch (satisfying result: the kite flies, the seeds bloom). Nest Lift's beam physics is lovely but the pairing "load, weigh, balance, lift, stop, drop" is a lot of verbs for a young child.
- Replay: the games are deterministic (same puzzle every time). Rooftops' wind is fixed, Observatory's gears fit one way only. Second play is the same.

## Improvements, ranked
1. Observatory: let a tray gear replace a wrong gear on an axle; make the target axle big and bright. Impact High, effort Small, engineering.
2. A short script for ages 3-4 in all five (and all of Days 4-14): 8-word directions, one picture hint per job. Impact High, effort Med, Rachel and Travis.
3. Day 14 finale: when the last wheel turn finishes, let the sun rise, moon circle and stars spin on their own for 3 seconds with a soft chime, before the end card, and keep the machine visible beside the card. Impact High (it is the last story), effort Small, Travis.
4. Day 15: after Day 14 the Home card becomes the game of the day (existing rule). Add one "You finished all 14 adventures!" moment on Home or in the sticker card, and say what comes next (new adventures soon, or start again with a twist). Impact High for keeping families past 2 weeks, effort Small-Med, Travis (the "start again" choice is in CLAUDE.md as his call).
5. Split big little-kid moves: Kite move 3 and Rooftops moves 3/5 into shorter ones with a "Great!" beat between, or add one extra spoken word in the middle. Impact Med, effort Med, Rachel/Travis.
6. Kite ribbon dot cap (see P2). Impact Med, effort Small.
7. Concert: show that controls are waiting while Echo talks. Impact Low-Med, effort Small.
8. Delete or stop shipping `narration.js`, `narration.css`, `stories.js` from `public/` (tests only). Impact Low, effort Small.

## Ratings (1-5)
| Game | Clear in 10 s | Fun to repeat | Word is part of game | Fits small phones | Bug-free |
|---|---|---|---|---|---|
| Rooftops | 3 | 4 | 2 | 3 | 4 |
| Nest Lift | 3 | 4 | 2 | 4 | 4 |
| Pond Concert | 3 | 4 | 2 | 4 | 4 (not played in depth) |
| Kite | 3 | 3 | 2 | 4 | 4 |
| Observatory | 2 | 3 | 2 | 4 | 2 |

Ranking, best to weakest: 1 Rooftops, 2 Nest Lift, 3 Pond Concert, 4 Kite, 5 Observatory. Caveat: I played Observatory deeply and the others mostly by reading the code and the first screen; Concert's and Kite's ranking is the least certain.

## Versus the best apps
- Pok Pok / Toca Boca: one big obvious thing to touch, results shown at once, no instructions. Here each game has 4-6 verbs and a bar of text. A little-kid version should be one verb per move.
- Duolingo ABC: a celebration moment at the end of a unit with the whole thing animating. Observatory's finale should do that.
- Lingokids / Khan Kids: little characters point (a hand or arrow) at the next thing to touch when the child waits; here the only help is a wider catch. A pulsing pointer after about 6 seconds of no touch would fit the rules (it never finishes the move).
- Speech Blubs: the speaking is the play. Here speaking is a gate. A way to keep it Rachel-safe: a "say it again to power the machine" moment mid-move (the help pill already is that, but it is optional and invisible to a 4-year-old).

## Decisions worth another look
- Same directions for both ages (above). CLAUDE.md "Days 4-14" says the games take the 3-4 contract (five moves) but is silent on simpler words.
- "After Day 14 the card is the game of the day, a finished story is never on Home again" (CLAUDE.md, For Travis). The last adventure ending a family's story run with no celebration is the thing I would re-open.
- Three sayings per move plus five or eight moves means a 3-4 year old says 15 words for about 6-10 minutes of mostly finger play. For Rachel: whether the ratio of speaking to playing is right.

## Already good (keep)
- Every move gets easier with misses (wider catches, slower motion) and no help ever finishes a move by itself; the Observatory, Nest Lift and Kite designs have exactly one correct answer per slot and the maths of the gear layout checks out (I traced every slot distance).
- Pause, hidden page, rotation and resize cancel any finger in progress and keep the work.
- Access check before any file or microphone; hand-back to the story ending; ending lines are in the clay look beside the game art.
- Voice and sound stay silent while the mic listens (the suites check overlap).
- The art in all five is warm and matches the story pages.

## Not checked
- Real-voice timing (the fake phone speaks in 100 ms), a real iPhone's multi-touch, and rotation on a real iPad.
- Concert's conducting stage and arrange stage by playing (read only), Kite's sewing and flight by playing, Nest Lift's physics at low frame rates (dt is capped at 0.05 s a frame; not tried on a slow phone).
- I did not run the five full suites (each takes minutes); I played screens and probes only.
- The real `story-game.html` page (only the tests' host page was used; its end card showed "Play again / Back to games" here, the real page has a different end card).
