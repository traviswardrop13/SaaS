# Practice page ("Say it 5 times") and the steps
## In five lines
1. The page is calm, clear and well guarded: a pause screen for locks and calls, a mic-refused screen, no counting of silence, and Echo never lets his own voice count. I found no way to lose a family's data and no state with no way out.
2. The real weak spot is the quiet child: 20 seconds of glowing mic with no second prompt, then "I couldn't hear you!", and "Try again" does not play Echo's model again (CONFIRMED on the fake phone).
3. A round can "pass" and open the game with 1 to 4 tries out of 5 (20-second cap), show the jar as full, and count toward a step win (LIKELY, from code). That is a Rachel question.
4. The wait before every game is about 25 to 40 seconds with 5 spoken tries. Nothing is preloaded while the child talks. Small changes can cut 3 to 5 seconds without touching what is asked.
5. A non-reader gets no picture of the word and no picture of the mouth (mouthcue.js is dead code); the cue is only spoken, and only on the first line.

## Bugs
### P1
**B1. "Try again" after the quiet screen does not model the sound again, and no 8-second nudge ever fires.**
- Sees: a 4-year-old hears Echo's line once, the mic glows, they do not know what to do, 20 seconds pass, "I couldn't hear you! Say it big." They tap Try again and get silence: Echo says nothing, the mic just opens.
- Steps (CONFIRMED, fake phone, age 5, R, silent mic): open `/charge.html?game=arcade-slice.html`; Echo says the line once; at about 21 s the quiet card shows; tap Try again; the list of spoken lines stays at 2 (the quiet line was the second one).
- Where: `public/charge.html:1958` `armIdle()` is written but never called (a test comment at `tests/micquietpracticetest.mjs:355` says "not armed today", so it is a choice, but the CLAUDE.md-era comment at `charge.html:1600` still talks about "Echo's 8-second nudge"). Retry is `charge.html:2243` / `2249` (`continue` straight into `startEngine`, no `playPrompt`).
- Fix: on Try again, play the short line ("Make your R sound, five times. Go!") before reopening the mic. Keep the nudge off if Travis wants (it is a how-often decision, Rachel's).

**B2. A round can open the game on 1 to 4 of 5 tries and still count as a win toward the step.** (LIKELY)
- Sees: the child says the sound twice, 20 seconds run out, the five slots all fill, "Here we go!", "You did it. Let's play." The jar looked 2 of 5, then jumped to 5 of 5.
- Where: cap at `charge.html:2135` (`deadline`, ends with "done" whatever `reps` is); `verifyClip` judges the tries heard; `charge.html:2358` `v==="pass" && useRung>=RUNG` -> `Sona.rungWin` (two such wins move the step up, `sona.js:927`); `paintReps(NEED)` in `launchGame` at `charge.html:2534` paints 5 of 5.
- Not run live (needs synthetic voiced audio); traced end to end.
- Fix: require `reps>=3` (or NEED) for a step win; paint the real count in the jar. Whether a part-round still opens the game is a mercy call (Rachel/Travis).

### P2
**B3. Plosive sounds (T, K, P, B, D, G, CH, J) can get "I couldn't hear you!" after five counted tries.** (UNSURE)
- `shapeVerdict` (`charge.html:1383`) says "unknown" under 12 voiced frames in total. One short "t" is about 3 frames at 60 fps and about 1.5 at 30 fps (Low Power Mode). Five tries at 30 fps is about 7 frames, so the whole round is thrown away (reps never booked, `charge.html:2249`). In the app, isolation and syllable rounds fall to this check when Apple gives no clear text. Could not check on a phone.
- Fix: count frames in time (ms), or treat 5 accepted SHORT events as enough to judge.

**B4. The quiet card for a word round is silent, and the retry card never uses the speaker for a non-reader.**
- `charge.html:2521`: for cause "word" and "microphone" Echo says nothing. "Let's try that word again. Try the word in Echo's bubble, or come back later." is text a 4-year-old cannot read, on the one screen that blocks them. Fix: Echo says "Let's try that word again. Go!" for the word cause.

**B5. Tries said before the verdict are lost if the child leaves or the check says "unknown".** The tries are booked only after `verifyClip` (`charge.html:2250`). Leaving with X, "Maybe later", or an unknown verdict drops them: no rep, no trophy, no goal progress. Honest for silence, harsh for a child who really spoke. Fix (small): book reps for an "unknown" round as practice tries without a pass/fail (Rachel: does an unjudged try count?).

**B6. Mic-refused screen uses an off-brand blue, shouty button** (`sona.js:2888`, `#1cb0f6`, uppercase "I TURNED IT ON") and a plain white card. It is the one screen a parent must act on; it does not look like Sona. Also no word for a family whose phone will not give the mic: every round game is shut (all six need this page). Fix: restyle with the teal/cream tokens; keep it, but add a line "Sona needs the microphone to play".

**B7. A new sound can start at a syllable, not the sound alone, on its first round.** `ROUNDIX` is today's ring count (`charge.html:630`) while the sound comes from the persistent rotation, so when the rotation moves from R to S in the middle of a day, S's first round is ring round 3 (capped by S's earned step, so at most one step above). Not harmful (capped), but the "warm up on the sound" promise in the comment at `charge.html:621` is not always true. For Rachel.

## Experience problems
- **The wait (kid-practice, 390x844).** For a 5-year-old on R: page open, 0.3 s boot, about 1 s room measure, Echo's line (first line of a round at the sound step is the long one: "Ready? Pull your tongue back and up, and make your R sound, five times. Go!", about 6 s with Rachel's recorded R; the short form is about 3.5 s), a quarter-second gap, 5 spoken tries (8 to 12 s for a quick child, 15 to 20 s for a 4-year-old), 0.35 s tail, checking, chime, "You did it. Let's play." (about 2 s), 1.2 s fixed wait, then a full page load of the game. Honest range: about 25 to 40 s, 5 things said, 2 things to listen to, 0 taps (hands-free), before every game and every Play again. Nothing is preloaded (no prefetch of the game page, checked by grep).
- **No mouth picture.** `public/mouthcue.js` (the side-view tongue drawing) is loaded by no page (only `tools/bundle.mjs`). The mouth cue is spoken once, only on isolation rounds, never shown. A 4-year-old and a parent cannot see what to do with the tongue.
- **No picture of the word.** On the word step the card shows the word as text (`paintCard`, `charge.html:1318`); Feed Echo and the books show a picture. A non-reader gets the word only by ear. The page has the data: bank words carry a picture (`ITEM.e`).
- **Two hints for the same thing** at the bottom ("Hear it slooow" turtle plus "Tap Echo to hear it again") plus the mic: three controls for "hear it". The turtle is the better word for a child; the line under the mic is for readers.
- **The status line "Getting ready…" / "Listen to Echo" / "Your turn"** is text; Echo's pose and the glowing mic carry it for non-readers, which works. Good.
- **After a quiet card, "Say it big" tells a child how to speak louder** (Rachel's wording, noted in code) and says nothing to the grown-up about moving the phone closer, which is what Travis hit.

## Improvements, ranked
1. **Replay Echo's short line on "Try again", and add one grown-up hint after the second quiet card ("Hold the phone a hand away from the mouth").** Impact High, effort Small, engineering for the replay; Rachel for any new words.
2. **Preload the game page and its pictures while the child is saying the five tries** (a `<link rel=prefetch>` or hidden fetch for `/arcade-<game>.html` plus its sheets), and start the game the moment the chime ends. Cuts the dead wait at the end by 1 to 3 s. Impact Med, effort Small, engineering.
3. **Drop the fixed 1.2 s wait and the spoken "You did it. Let's play." for a repeat round in the same sitting** (keep it for the first). Cuts about 3 s per round. Impact Med, effort Small, Travis/Rachel (it is a line Echo says).
4. **Show the word's picture on the word and sentence steps** (existing bank pictures, same painted style as Feed Echo). Impact High for non-readers, effort Small to Med, Travis (look) and Rachel (picture shown with a target).
5. **Show a simple mouth picture for the first round of a sound** (the old `mouthcue.js` is drawn but orphaned; better a short painted clip or 2-frame picture). Impact High for parents who can't tell what the voice means, effort Med, Rachel (placement) and Travis.
6. **Let the 5 tries pace themselves: once 3 are counted, say "Two more!" in sound only** (already shows "Just 1 more!"). Low priority.
7. **Real jar and a real win rule for B2.** Impact Med (clinical honesty), effort Small, Rachel.
8. **Book a counted, unjudged round (B5).** Impact Low-Med, effort Small, Rachel.
9. **A "this phone cannot hear me" way through for a grown-up** (after two quiet cards, offer "Skip practice for now" behind the grown-ups check, game opens without a counted try, no reps). Today a child the phone cannot hear cannot play any of six games. Impact High for the Travis case, effort Med, Rachel/Travis (it breaks "only a voice moves a game" unless the game itself keeps its voice cards).

## Versus the best apps
- **Speech Blubs**: the child sees real children's mouths and hears the model; the practice is the game, not a gate. Sona could show a mouth picture and let the first three tries be the game's own first moves.
- **Duolingo / Duolingo ABC**: each lesson is 3 to 5 quick steps with a visible progress bar and a skip ("I can't speak now" for speaking exercises). Sona has the progress (5 slots filling) and no skip; the grown-up skip in idea 9 is the equivalent, kept behind the check.
- **Khan Academy Kids / Lingokids / Toca**: a tap-to-hear animal or object for every word. Sona has the turtle but no word picture.
- **Pok Pok / Sago Mini**: no gate before play; the game is the activity. Travis decided the charge-up stays; the cheapest honest compromise is the shorter repeat round and the preload.

## Decisions worth another look
- The charge-up before every round (Travis's, "charge up"): the cost is the 25 to 40 s above, about a third of the time a child spends with a short game round. I would keep it and cut the dead time (ideas 2 and 3), not the tries.
- Two syllable wins from a brand-new start write "words next" and skip winning the sound alone (`sona.js:927`, recorded as deliberate). For Rachel to re-confirm.
- A voiced try counts toward the goal even when the phone heard a clearly different word (recorded as a Rachel question).

## Already good (keep)
- Lock, call, app-switch and Home-swipe all pause and ask for an explicit Resume; no stale mic, no double count (`pausePractice`, `practiceReady`).
- Echo's voice never reaches the mic (quiet gaps, settle time, mic closed during speech); counting is per child (`kkey`), per sound and per place (`stageAt`, `rungWins` stored inside the child's own progress).
- Step down stays on target, never below a child's step on a lower place; a fail-then-pass does not earn a step win; silence never counts; a round that heard nothing does not rotate the sound or ring.
- The page is calm: one target in orange, five slots filling, no timer on screen.

## Not checked
- Real audio on a phone (low-volume voices, plosives); the native Apple recognizer path (`hearVerdict`, another auditor).
- B2 and B3 were traced in code, not driven with synthetic voice.
- The 25 to 40 s figure is from code and typical speaking time, not a stopwatch on a phone (the fake phone has no real speech length).
- Homework word sets and the four Echo lines under homework were read, not driven; the other five games' own start cards were not part of this area.

## For Rachel: every place this page decides something clinical
1. What is asked each round: one target said 5 times, the climb sound -> syllable -> word -> sentence, one step per round, capped one step past what is earned (`charge.html:631`).
2. A fresh child's two syllable wins write "words next" without winning the sound alone.
3. What counts as heard: a voice-like sound by acoustic evidence; on the web, any voiced sound passes unless it is clearly the wrong family (R/L/M/N hissy, S/SH/F voiced) (`shapeVerdict`, 1382). In the app, Apple's text for word and sentence rounds.
4. When to step down: after two failed bursts (first 5, then 3), to an easier same-sound target, spoken as "I have an idea. Let's try this one."; an isolation-level fail ends "Good practicing. Let's play." with no easier step and the game still opens (`charge.html:2417`).
5. A round opens the game on any heard try (1 to 4 of 5, B2), and on two misses.
6. Echo's wording: "Let's try that one again. <tip>. Go!"; "Say it big — I'm all ears!"; "Good practicing. Let's play."; "You did it. Let's play."; the praise line.
7. The cue: only on the first prompt of a page and only on isolation (or the day's first round if the day starts higher), first clause of the CUES text.
8. Tries from fail rounds still count as reps, trophies and goal days (effort, not accuracy).
9. The sound shown to a 2 to 4 year old: R, L, S are asked of any age; no `SOUND_NORM` gate on this page (CLAUDE.md says families see the sound they picked).
