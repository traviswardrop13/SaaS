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
| Treasure Map | 5–8 | Built; sailing checks pass; shared regression verification in progress |
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

## Treasure Map

A route-drawing sailing puzzle: draw from the boat, release to sail, and steer
around solid islands to eight harbours and the final treasure. Routes are
physical: crossing land stops the boat. Returning to the dock gives another
attempt without spending an accepted word. A short straight drag works too.

The existing eight targets and two sayings remain. Speech earns twelve
seconds of calm currents and a safe channel drawn from the boat's actual
position. Help pauses the same voyage, uses the existing quiet word turn,
and returns to the same harbour. The hint never moves the boat by itself.

The original painted boat/chest are reused. A new versioned parchment map
removes the old static boats, chests and routes so the child's live boat and
route remain clear. Built-in image generation was used; the selected map is
`public/assets/crafted/game/treasure-map-play-v2.webp` (365 KiB). Prompt:
preserve parchment, compass, four island positions/style; remove boat,
chests, dotted routes, footprints and X. Original art is unchanged.

The catalog stays Coming Soon during review. New instruction: “Say each word
two times for calm seas. Then draw a line from your boat to the glowing ring.
Go around the islands.” Targets and acceptance thresholds are unchanged;
Rachel can review the mechanic/reward wording alongside the other games.

Verification: all 45 sailing/touch/fit checks passed, including all eight
voyages, a hint after an island bump, help/background/resume, restart,
microphone/audio separation, quick drags, unrelated pointer cancellation,
and narrow layouts. The test fails against the original animation (no sailing
canvas). Syntax, art-generator, voice-inventory freshness and whitespace
checks passed. The generic engine test keeps a frozen old scene fixture so
these checks survive each real-game replacement. Its full rerun is pending.
The source stays unpushed; a full current release battery is required.
