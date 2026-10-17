# Coming Soon rebuilds — 16 October 2026

Travis removed the default work deadline and asked for the unfinished games
to be built one at a time, with distinct real gameplay and meaningful speech
help. This branch starts from `origin/main` at `e258d888`.

Build and browser-verify each game before beginning the next. Preserve
existing isolated targets, two-saying turns, homework priority, speech checks,
local-only microphones, and privacy boundaries. No book edits, pricing changes
or unrelated redesign. Main merges still need Travis's explicit instruction.

## Queue

| Game | Audience | State |
| --- | --- | --- |
| Race Car | 5–8 | Built and browser-verified; preview open, production still parked |
| Treasure Map | 5–8 | Queued |
| Robot Builder | 5–8 | Queued |
| Castle Builder | 5–8 | Queued |
| Space Trip | 5–8 | Queued |
| Pizza Chef | 5–8 | Queued |
| Monster Makeover | 5–8 | Queued |
| Peekaboo | 3–4 | Queued |
| Balloon Party | 3–4 | Queued |
| Grow a Flower | 3–4 | Queued |
| Rocket Blast | 3–4 | Queued |
| Build a Snowman | 3–4 | Queued |
| Choo-Choo Train | 3–4 | Queued |
| Puppy Bath | 3–4 | Queued |
| Bedtime Stars | 3–4 | Queued |
| Birthday Cake | 3–4 | Queued |
| Surprise Boxes | 3–4 | Queued |
| Fish Tank | 3–4 | Queued |

## Race Car

Free-position drag/keyboard steering, perspective road bends, reachable cones
and opponent cars, collectable stars, a held brake, eight pit stops and a final
finish arch. The child must steer into each glowing gate; waiting cannot
complete the race. Bumps ease the car briefly and leave a clear path.

The existing eight word targets and two accepted sayings remain. Accepted
speech earns eight seconds of road motion at 48% speed. The optional Slow road
button parks the same leg, reuses the same isolated-word speech owner, and
returns to the same distance with renewed help. Backgrounding during that
word must keep the car parked until speech is complete.

Art reuses the existing painted track, car, cone and finish line. New UI uses
the existing teal/cream action tokens; no emoji art. The generator no longer
owns this page. Its generic speech fixtures use a still-generated scene.

### Review and release

The source catalog stays Coming Soon while the build is reviewed. Local
browser tests unpark only their served fixture, never production access.
New instruction: “Say each word two times to slow the road. Then drag to steer.
Follow the glowing ring.” Targets, repetition count and acceptance thresholds
are unchanged; the new mechanic/reward wording belongs in Rachel's review.

Browser checks cover silence, two sayings, real movement reduction, continuous
steering, brakes, help without stage credit, background/resume during help,
actual finish/restart, quiet microphones, and fit at 320×568, 393×852,
844×390 and 768×1024. Real iPhone feel/audio still require a physical playtest.

Verification so far: 29 gameplay/fit checks passed; the failed-art fallback
check exposed a colour-filter mismatch and passed after the fix. Existing
Say & Play regression suite: 359 assertions, exit 0. Syntax, art generators,
recording-script freshness and whitespace checks passed. The new test fails
against the original Race Car, which has no playable racing canvas. The full
release battery is still required before any push.
