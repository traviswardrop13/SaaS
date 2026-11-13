# daily-a: story Days 4-9 games (Waterwheel, Postboat, Bakery, Front Door, Lantern, Trainline) and story-game.html

## In five lines
1. The page that hosts them (story-game.html) is solid: it checks access before any game file loads, unknown/locked/replay addresses go Home, replay finishes nothing, the end card hands back to the story. Help word, pause and return work in all six games at both ages (played on the fake phone).
2. One real bug found and confirmed: in Lantern, if a child taps an earlier lamp's switch off (very natural), the new lamp lights but the job never finishes and nothing says why.
3. The bigger problem is difficulty: Postboat, Front Door and Lantern are engineering toys (docking at the right speed and angle, a swinging crane, supply/return cords). A 4-year-old who cannot read will struggle, and the word is only a gate, not part of the play.
4. Rounds are long (about 5-10 minutes for ages 5-8) and nothing is saved: leave at job 6 and you restart at job 1 with new words.
5. Everything fits at 390x844, 375x667 and 320x568; title pills are cut off with "..." on every game.

## Bugs
### P1
- **Lantern: switching off an earlier lamp silently blocks the next job.** SEES: the new lamp glows, but no cheer, no next word, banner never changes, no miss counted. STEPS: finish lamp 1, say word 2, tap lamp 1's lever (opens it), wire the near stones' loop and close its switch. `tryComplete` requires every earlier lamp lit. WHERE: public/daily-adventures/lantern.js:57-58 (`allServedLit`, `tryComplete`), switches stay live at :71. STATUS: CONFIRMED on the fake phone (near lamp "near:CL" lit, completedGoals stayed [0], banner unchanged). The same happens if the power box's lever is tapped (banner then wrongly says "needs a way back to the power box", :62). FIX: don't require earlier lamps to stay lit (or lock/auto-close finished switches), and say "Turn the first lamp back on" / "Close the power box".

### P2
- **Bakery: oven heat never escalates help.** SEES: after the tray is in the oven, if the child does not touch the heat slider nothing bakes, ever; banner repeats. Misses and effort only count for pour/mix/shape/drag, not bake. WHERE: bakery.js:291 (bake needs `heatTouched`), :22 (assistance), :221. STATUS: CONFIRMED (20 s idle: assist 0, misses 0, bake 0.00). FIX: count idle seconds in the oven as effort, and pulse/move the slider thumb at assist 1.
- **Waterwheel: target outlines almost invisible.** SEES: the "glowing outline" to match is a 2.5 px pale-cream dashed line on sand/leaves; only the numbered dots can be seen. WHERE: waterwheel.js:362 (`drawSocket`). STATUS: CONFIRMED by picture (390x844). FIX: a darker or filled ghost trough with a glow.
- **Waterwheel: tray caption covered.** "Trough 1 . drag to its outline . arrows turn" sits under the three loose troughs at 375/390 wide (selectedLabel at toolbarY-22, tray at toolbarY-39). WHERE: waterwheel.js:220-223. STATUS: CONFIRMED by picture. FIX: move the label or drop it (a non-reader cannot use it).
- **Trainline: young kids' angle never widens.** `young?12:8+assistance()*4` only widens for older children. Harmless with 15 degree steps, but the ladder promise is not kept. trainline.js:20. LIKELY.
- **Typed address to a not-yet-reached day opens that game for a Premium family** (it finishes nothing, ending then bounces Home). Spoiler only. story-game.html:54-63. LIKELY.
- **A failed game file silently sends the child Home** (`js.onerror = away`). story-game.html:81. LIKELY.
- **Per-frame work in production:** each game rebuilds a large test snapshot (`publish()`, in waterwheel it also recomputes flow routes) every frame. Could cost battery on older iPhones. UNSURE (not measured).

## Experience problems
- **Title pill cut: "The Thirsty Wa...", "All Aboard for ..."** on all six at every size (top bar). A non-reader gets nothing from it anyway; drop it or show the game picture.
- **Directions use grown-up words** (spoken by Echo): "supply cord", "return cord", "sockets" (Lantern); "rope loop", "dock" (Postboat); "picture line", "level off" (Bakery). Rachel/Travis wording call.
- **Lantern board shows all 12 sockets and 6 lamps at once**; only two get a dashed ring. The visible switch lever is about 12 px (touch area 44 px). Reads as a circuit diagram, not a toy.
- **Bakery:** flour cup is a plain tan box (only the jug is painted); bowl is a big empty pale circle; "Flour / Liquid" labels are about 10 px.
- **Trainline:** train drawn over the waiting passengers at the station (320 and 390 shots).
- **Complex first-job for ages 3-4:** Postboat's last job (tow a raft, then land it at Beaver's), Bakery's job 3 (six tasks), Front Door's rotate-in-15-degree-taps, Trainline's reverse-then-switch-then-drive. Five "moves" are not five small things.
- **No save:** the X top left exits without asking and the round restarts from job 1 (new words) next time.
- **The word is a gate, not part of the game.** Each job starts with 12 s of "easy mode" for just saying the word (wider catch, slower current, slower train), so the help pill is rarely needed and the first 12 s are easier for everyone. The Say & Play rebuilds removed exactly this ("the word starts the job and nothing else"). For Rachel/Travis.
- **Look:** painted Codex-style backgrounds with flat canvas-drawn pieces; coherent enough, calmer than the clay story pages around them. Trainline and Postboat match best; Bakery and Waterwheel least (bare middle).

## Improvements, ranked
1. Fix the Lantern silent block (above). High / Small / engineering.
2. Add a quiet idle ladder (seconds without progress widen help) to games that only count misses: Bakery bake, Postboat, Lantern, Waterwheel (tap-only child never records a miss, waterwheel.js:165). High / Med / engineering; thresholds are Rachel/Travis.
3. Make the 3-4 versions truly smaller: fewer tasks per word (split Bakery job 3, Postboat jobs 3/5, Front Door job 4), pre-rotated pieces everywhere, auto-dock when slow and near. High / Large / Travis.
4. Remove the 12 s "easy for saying the word" and let the help pill carry it, like the rebuilt games. Med / Small / Rachel+Travis.
5. Save progress per day (job index) so a quit resumes. Med / Med / Travis. Duolingo-style "pick up where you left".
6. Legibility pass: visible ghost outlines, bigger lamp levers, drop truncated titles, painted flour cup. Med / Small / engineering.
7. Shorten rounds for ages 5-8 (about 5 min), or let a day end after 5-6 jobs. Med / Med / Travis.

## Versus the best apps
- Pok Pok / Toca: one gesture per toy, instant feedback, no fail states, never more than 1-2 controls on screen. These games show 6-10 controls (Front Door: four arrows, stop, link, two turns).
- Duolingo: short lessons with a visible progress bar and a resume point; here the dots show moves, but quitting loses everything.
- Speech Blubs: the voice IS the play (say it, see it happen). Here saying is a ticket to a separate toy. Fits the rules: tie the word to an in-game effect (the word fills the water/lights the lamp) without changing what is asked.
- Sago Mini: big forgiving drag targets that snap; Waterwheel/Trainline are closest.

## Decisions worth another look
- 12 s power from the word itself (see above).
- Three sayings plus a long physical job per word means speaking is about 3 of every 20-60 s; Rachel may want more speaking per minute or fewer minutes in total.
- Lantern teaches series/parallel circuits (a real resistor simulation) to 5-8 and 3-4 year olds; Travis should decide if that is the story-day goal.

## Already good (keep)
- Access order, typed-address handling, replay, hand-back, one shell shared with the test host.
- Help word, pause/background, resume: all six, both ages, no errors.
- Echo's first direction plays after every word (verified in all six).
- Fits 320x568 and 375x667 with 44 px controls; Trainline and Postboat look polished.

## Ratings (clear / fun again / word fits / small phones / bug-free)
- Trainline: 3 / 4 / 2 / 4 / 4
- Waterwheel: 3 / 3 / 2 / 4 / 3 (faint outlines, covered caption)
- Postboat: 2 / 3 / 2 / 4 / 4
- Bakery: 3 / 2 / 2 / 4 / 3 (bake no ladder)
- Front Door: 2 / 3 / 2 / 4 / 4
- Lantern: 2 / 2 / 2 / 4 / 2 (silent block)
Ranking best to weakest: Trainline, Waterwheel, Postboat, Front Door, Bakery, Lantern.

## Not checked
Full playthroughs of each game's last jobs (tow, crane physics, full circuits); landscape/iPad; two-finger and fast-tap fuzzing; real Echo voice lengths and true round time (fake clock only); suites not run.
