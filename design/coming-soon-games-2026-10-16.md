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
| Treasure Map | 5–8 | Built and browser-verified; local preview available, production still parked |
| Robot Builder | 5–8 | Built and browser-verified; production still parked |
| Castle Builder | 5–8 | Built and browser-verified; production still parked |
| Space Trip | 5–8 | Queued |
| Pizza Chef | 5–8 | Queued |
| Monster Makeover | 5–8 | Queued |
| Peekaboo | 3–4 | Queued |
| Balloon Party | 3–4 | Built and browser-verified; production still parked |
| Grow a Flower | 3–4 | Built and browser-verified; production still parked |
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
are unchanged. These are gameplay instructions, with phone play review still required before reopening.

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
Phone play review is still required before reopening.

Verification: all 45 sailing/touch/fit checks passed, including all eight
voyages, a hint after an island bump, help/background/resume, restart,
microphone/audio separation, quick drags, unrelated pointer cancellation,
and narrow layouts. The test fails against the original animation (no sailing
canvas). Syntax, art-generator, voice-inventory freshness and whitespace
checks passed. The generic engine test keeps a frozen old scene fixture so
these checks survive each real-game replacement. The unchanged full engine rerun passed all 350 assertions, exit 0, when run alone.
The source stays unpushed; a full current release battery is required.

### Release check status

The fixed Race Car snapshot's full battery reached the existing repetition
checks, where a short real-time simulated response timed out under concurrent
browser load. The run was stopped and its log preserved; it is not a passing
release result. The unchanged shared speech suite then passed alone. No
scoring threshold or test timing was changed. Run the complete current-tree
battery without competing browser suites before any push.

## Robot Builder

Eight handmade circuit puzzles assemble a friendly toy robot. Tap a wire tile
to rotate it clockwise. Only reciprocal connections conduct power, and a real
battery-to-socket circuit still waits for the child to press Test power.
Wrong wiring offers a gentle visual nudge and never spends an earned word.
The first puzzle is a short straight path; the last visits all nine tiles.

The existing eight targets and two sayings remain. Speech earns ten seconds
of Blueprint: the solution route and connector orientations show as pale
lines. Help parks the same puzzle, preserves every rotation, and renews the
guide through the existing quiet word turn. It never rotates or solves a tile.

The workshop and eight separate robot pieces match the existing painted
home card. Selected files total 243,264 bytes and live under
`public/assets/crafted/game/robot-*-v1.webp`; the parts retain alpha. Built-in
image generation only. Exact prompts, origins and export metadata are in
`design/coming-soon-games/robot-art-notes.txt`. Existing art is unchanged.

New instruction: “Say each word two times for a blueprint. Tap the wires to
turn them. Connect the battery to the socket, then test the power.” It is in
the recording inventory and remains preview-only pending Travis's phone play review.

Verification: all 55 browser checks passed. They independently traverse the
wires rather than trusting the game's connected flag; rotate and test all
eight actual boards; verify speech/help, silence, background/resume, keyboard
controls, missing-art fallbacks, replay, quiet microphones, and 320px/393px/
iPad fit. The same test fails on the original robot animation. Syntax, art
generator and recording-inventory checks passed. No push or release yet.

### Why completed games stay parked during this build

`CLAUDE.md` lines1542–1546 requires each rebuilt game to be “played by him on
his phone” before taking `comingSoon` off. Lines1561–1563 repeats that opening
rule. This is the reason for the production gate; the short nonclinical
mechanic instructions do not create a new Rachel approval requirement. For
the younger games, lines1694–1699 separately records an unresolved decision
about asking twice. This build preserves the existing two sayings, and that
release question remains for Rachel before a younger game reopens.

## Balloon Party

A preschool pump-and-guide game. Real taps fill a balloon; the child grabs its
painted envelope and releases it inside a wide glowing garland ring. Five
physical deliveries fill the party garland. Missed drops keep the full
balloon and cost no new word. Wind and timers never attach one automatically.
Arrow keys move the same balloon; Enter/Space can attach it.

The existing five targets and two sayings remain. Accepted speech earns ten
seconds of big pumps (0.34 air per tap instead of0.17) and calm wind. Optional
help parks the same balloon and keeps its air, position and stage. All
microphones, model words and quiet tails stay with SayPlay.

Existing painted party, balloon and pump assets are reused. The envelope is
sized independently of the long string. Missing sprites have visible
fallbacks; the pump fallback hides once painted art has loaded.

New instruction: “Say each word two times for big pumps and calm wind. Pump
up your balloon. Then pull it into the glowing ring and let go.” Recording
inventory is updated. The source stays parked for phone review and the
already-documented younger repetition decision.

Verification: all 41 browser checks passed, including five real deliveries,
measured pump assistance, missed-drop retry, silence, help/background/resume,
keyboard movement, unrelated-pointer cancellation, asset failures, quiet
microphones and playable controls at320px/393px/iPad. The new test fails on
the original animation. Syntax and art-generator checks passed. The old
preschool scene is frozen for engine-only tests; protection checks now choose
a remaining generated scene rather than assuming Balloon is still generated.
No push or release yet.

## Grow a Flower

A held watering can pours actual falling drops. The child moves its spout
over the glowing soil; only caught drops grow the seed through five stages.
Water runs out, and a separate refill button preserves all earned growth.
Misses and refills cost no extra word. Idle animation cannot grow the plant.
Arrow keys move the same can; held Space or Enter pours.

The existing five targets and two sayings remain. Speech earns ten seconds
of a shower twice as wide and a larger reservoir. Help pauses the same
garden, including the can, water already caught and water left. Every word
and microphone turn still belongs to SayPlay.

The painted garden, sprout and bloom are reused. A new versioned transparent
watering can removes baked-in drops, so idle art never looks like running
water. Built-in image generation only; the selected WebP is 36,818 bytes.
Prompt and provenance are in design/coming-soon-games/flower-art-notes.txt.

Verification: all 38 main browser checks passed. The separate three-check
short-landscape rerun passed after fixing soil covered by the progress card.
Checks include five real waterings, a measured wider catch area, off-target
misses, refill/help preservation, background/resume, keyboard control,
fallback art, quiet microphones and 320px/393px/iPad fit. The new test fails
on the original animation. Syntax, art-generator and voice-inventory checks
passed. The source stays parked for phone review and the younger repetition
decision; nothing is pushed or released.

## Castle Builder

A real overhead crane carries eight architectural pieces into planned slots.
Slide the trolley, hold Lower and release to park the rope. An aligned bottom
contact places a piece; a miss hoists the same load back for another attempt.
Lift also lets the child retry without spending an accepted word. The child
builds a coherent castle, rather than a pile of identical blocks.

The existing eight targets and two sayings remain. Speech earns ten seconds
of a steadier pendulum and a placement window 2.2 times as wide. Optional
help preserves the trolley, rope and current load. SayPlay still owns all
speech, microphone and progress accounting.

Nine new painted assets match the existing sandcastle card: an empty beach
and eight transparent pieces. Their total payload is 232,622 bytes. Exact
built-in image-generation prompts, origins and alpha-preserving crop exports
are in design/coming-soon-games/castle-art-notes.txt. Original art is unchanged.

Verification: all 44 browser checks passed, including eight physical crane
placements, a measured swing reduction and wider acceptance window, misses,
held/released controls, help/background/resume, keyboard movement, fallback
art, quiet microphones, replay and 320px/393px/iPad fit. The test rejects the
old animation. Syntax, art ownership and voice-inventory checks passed.
The production catalog remains parked for phone play review. Nothing is
pushed or released; the full current release battery remains required.
