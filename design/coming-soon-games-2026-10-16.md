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
| Space Trip | 5–8 | Built and browser-verified; production still parked |
| Pizza Chef | 5–8 | Built and browser-verified; production still parked |
| Monster Makeover | 5–8 | Built and browser-verified; production still parked |
| Peekaboo | 3–4 | Queued |
| Balloon Party | 3–4 | Built and browser-verified; production still parked |
| Grow a Flower | 3–4 | Built and browser-verified; production still parked |
| Rocket Blast | 3–4 | Built and browser-verified; production still parked |
| Build a Snowman | 3–4 | Built and browser-verified; production still parked |
| Choo-Choo Train | 3–4 | Built and browser-verified; production still parked |
| Puppy Bath | 3–4 | Built and browser-verified; production still parked |
| Bedtime Stars | 3–4 | Built and browser-verified; production still parked |
| Birthday Cake | 3–4 | Built and browser-verified; production still parked |
| Surprise Boxes | 3–4 | Built and browser-verified; production still parked |
| Fish Tank | 3–4 | Built and browser-verified; production still parked |

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

## Pizza Chef

One pizza moves through eight real cooking actions: roll dough with strokes,
brush sauce, move to sprinkle cheese, drag three groups of toppings, control
the oven and deliberately take the pizza out, then make four different
full cuts. A held still tool, a cold oven, a short swipe or a repeated cut
cannot finish the relevant task. Missed or interrupted toppings return to
their tray without spending another word. An overheated oven offers a retry.

The existing eight targets and two sayings remain. Speech gives stronger
rolling, wider brushes and topping landing areas, a slower heat gauge, and
more forgiving cut guides. Help keeps all committed cooking work. The oven's
ready band stays fixed, so power expiry never invalidates a ready pizza.

Nonreaders hear eight short mechanical directions, with a Hear-step button.
The new SayPlay-owned instruct API uses the existing voice cache, quiet
tails and cancellation generation. It cannot speak beside a microphone.
Interrupted directions remain owed to their current move and replay after
help or return; completed directions do not repeat, and finishing a move
cancels any pending direction. No controller owns a microphone or voice.

The new painted kitchen and nine transparent food/tool assets match the
existing home card and total 380,918 bytes. Alpha-preserving exports, exact
prompts and origins are in design/coming-soon-games/pizza-art-notes.txt.
Original art is unchanged. All spoken lines are in the recording inventory.

Verification: the full cooking/lifecycle run passed all 75 checks, covering
all eight actions, actual speech benefits, missed/interrupted toppings,
overheat/retry, ready-state preservation, knife guards, keyboard rolling,
late voice responses, interrupted-direction replay, quiet microphones,
fallback art and 320px/393px/iPad fit. A focused ready-band regression also
passed both checks and rejects the previous variable ready band: power
changes timing without moving the target. The new game
test rejects the old reveal scene; the voice test rejects the previous owner
without instruction support. The shared speech suite passed all 305
assertions after its generic pause/permission checks were moved to the
existing fixed scene fixtures. No speech thresholds or repetitions changed.
Syntax, protected-art and recording-inventory checks passed. The source
stays parked for phone review; nothing is pushed or released.

## Space Trip

Eight real piloted landings: gravity, inertia, a held engine, steering and
soft contact with a glowing pad. One thumb can hold Engine and slide sideways
to steer; separate arrows and keyboard controls also work. Physics waits for
the first deliberate input, so neither the accepted word nor an idle scene
can land the rocket. Hard landings and asteroid bumps retry the same flight
without spending another word. The eight sites vary their pad, gravity and
obstacles; fuel never runs out.

The same eight targets and two sayings remain. Speech earns ten seconds of
lower gravity, stronger damping and a more forgiving landing window/speed.
Help preserves the rocket's position and momentum. Backgrounding releases
held controls and keeps the same flight. All voice and microphone ownership
remain with SayPlay.

The existing painted galaxy is reused, with three new transparent assets:
an upright idle lander, lunar foreground and rounded asteroid (179,176 bytes).
The engine flame appears only under actual thrust. The art preserves its
proportions and visible feet/horizon line up with physical contact. Exact
prompts and exports are in design/coming-soon-games/space-art-notes.txt.

The browser checks exercise actual thrust and steering through all eight
landings, missed landings, one-thumb steering and unrelated pointer release,
speech benefits, interrupted held controls, help/background/resume, quiet
microphones, missing art, restart and small-screen fit. A review caught rocks
scaled too large on short landscape fields: responsive radii and explicit
spawn clearance now keep every launch safe. Later short-screen landings are
included in the regression checks behind a verified portrait guard.

All 85 browser checks passed, exit 0, including all eight landings on both
short screens. The test rejects the original reveal scene. Syntax, protected
art and recording-inventory checks passed. The catalog stays parked for phone
play review; nothing is pushed or released.

## Rocket Blast

A preschool pull-back rocket toy: drag the rocket down and sideways, follow
the aiming dots, then release it into a real ballistic flight. Five different
planet rings require actual launches and physical contact. Tiny/upward pulls,
canceled gestures and idle scenes never launch or earn an arrival. Misses
return to the pad for unlimited retries on the same accepted word; the child
can also deliberately use Try again. Arrows and Enter operate the same toy.

The existing five targets and two sayings remain. Speech widens the landing
ring, calms the slight wind and reveals the full predicted arc for ten
seconds. A launched flight keeps its earned assistance after expiry. Help
parks the same flight, preserving position and velocity, then widens/calms
it through the shared quiet word owner. Backgrounding an unfinished pull
cancels it safely; backgrounding a flight preserves it.

The painted sunset launchpad and Saturn are reused, as is the clean upright
lander made for Space Trip. Two new transparent mint/lavender planets total
75,028 bytes; exact prompts and exports are in
design/coming-soon-games/rocket-art-notes.txt. True image proportions and
the launchpad/rocket foot anchor match the live geometry.

All 51 browser checks passed, exit 0. An independent closed-form calculation
aims actual pointer launches; it never calls a completion callback. Checks
cover all five planets at regular phone, 320px and iPad sizes, 393px fit,
silence, tiny/backward pulls, owned-pointer cancel, missed-flight retry,
keyboard flight, help/background recovery, latched assistance, missing-art
fallback, restart and quiet microphones. The new test fails on the original
countdown scene. Syntax, protected-art and recording-inventory checks passed.
The catalog stays parked for phone play review; nothing is pushed or released.

## Monster Makeover

A tactile salon keeps one friendly monster's changes across eight actions:
scrub five patches of mud, hold and aim the shower to rinse the soap, brush
three curls downward, snip three tufts, choose and stamp four colored spots,
then drag on a bow, glasses and crown. A still sponge, off-target rinse,
upward brush, tiny snip, off-stencil paint or misplaced accessory cannot
finish its action. Actual path contact is required for brushing and cutting;
two endpoints around a detour cannot stand in for touching the fur.

The existing eight targets and two sayings remain. Speech grants ten seconds
of broader cleaning tools, faster rinsing, shorter/more forgiving guided
strokes and wider accessory placement. Help preserves the makeover and tool
position; interrupted accessories return safely to their tray. Keyboard
controls operate the same real tools. SayPlay owns all eight spoken mechanical
directions and the Hear-step button; no second voice or microphone exists.

Six new painted assets total 199,120 bytes: salon, monster, shower, comb,
scissors and clear-lens glasses. The existing sponge, bow and crown are
reused unchanged. Anatomy and tool contact anchors match the actual art;
the monster keeps its true aspect ratio. Organic shaded mud and animated
fur respond to the child's work. Exact prompts, exports and alpha checks are
in design/coming-soon-games/monster-art-notes.txt.

The review caught an ordinary comb guide made too short by the final art's
aspect ratio, and endpoint-only brush/snips accepting detours. Both old-code
regression fixtures fail as expected. The corrected gameplay run passes all
52 checks, including full ordinary guides, directional path contact, a
near-miss accepted only with speech help, chosen colors, interrupted
accessories, actual keyboard tools, restart and quiet microphones. The
screen-fit/missing-art run also passed all 14 checks, exit 0, at 320px, 393px
and iPad widths. The original reveal scene fails the new game test. Syntax, protected
art and recording-inventory checks passed. Production stays parked for phone
play review; nothing is pushed or released.

## Build a Snowman

A preschool rolling-and-assembly toy. Real held travel through the lower
snow lane grows each of three snowballs; holding still or moving outside
the snow cannot grow one. The child releases each grown ball into its
stacking ghost, then places a coal face, carrot nose, hat, scarf and twig
arms. Missed drops keep the accumulated snow. Keyboard pickup, arrows and
drop operate the same ball and decorations.

The existing five targets and two sayings remain. Speech grants ten seconds
of faster growth and wider stacking/decorating contact. Help keeps snowball
size, distance, position and every committed decoration. Interrupted drags
release safely without discarding that work. Five step directions and the
Hear-step control use SayPlay's existing quiet voice owner.

Four painted cutouts total 91,918 bytes: a freely rotating clean snowball,
carrot, scarf and paired twig arms. The existing winter clearing and top hat
are reused; prompts, alpha bounds and attachment geometry are recorded in
design/coming-soon-games/snowman-art-notes.txt. The visual review corrected
the stack overlap so soft painted edges cannot leave a floating middle ball.

The final browser pass passed all 72 checks, including full five-activity
play at 320px, 393px and iPad widths, off-lane/static growth prevention,
undersized/missed drops, speech help, pause recovery, interrupted decoration,
missing-art fallback, restart, quiet microphones, physical stack overlap
and actual keyboard pickup/rolling/drop. The original reveal scene
fails the new test. Syntax, art protection and recording inventory checks
passed. Production stays parked for phone play review; nothing is pushed.

## Choo-Choo Train

A preschool railway trip with five real station pickups. Hold Forward to
accelerate, release to brake, and use Back to recover a missed station.
The carriage must stop beside the waiting friend before the child can drag
them through its boarding door. Neither driving past, waiting, nor saying a
word boards a passenger. Each boarded animal remains visible in the window.
Native arrow/Space controls drive the same engine and move the same friend.

The existing five targets and two sayings remain. Speech grants ten seconds
of slower top speed, a wider stopping berth and a larger visible door catch.
The assistance for a picked-up passenger lasts through that drag, so expiry
cannot invalidate a good drop. Help preserves train position, velocity and
boarded friends. Interruptions release controls safely and return an
unplaced friend to their platform. Five step directions and Hear-step use
SayPlay's quiet speech owner.

A new painted train with real transparent window/door openings and a quiet
countryside total 166,924 bytes. Five existing painted animal buddies are
reused. Wheel rotation, rail contact and window/door positions match the
actual image; prompts and export/alpha checks are recorded in
design/coming-soon-games/train-art-notes.txt. Visual review moved the waiting
platform below the rails; the initial geometry made the friend look perched
on the carriage roof. Both phone sizes fail the pre-fix regression fixture.

The final full browser run passed all 76 checks, exit 0. It covers the
corrected foreground platform and two visual geometry checks, alongside
five actual station trips on regular/320px/393px/iPad screens, reversals,
wrong drops, pointer ownership, background/help recovery, keyboard driving,
missing-art fallback, replay and quiet microphones. The original reveal
scene fails the new game test. Syntax, art protection and recording inventory
checks passed. Production stays parked for phone play review; nothing is pushed.

## Puppy Bath

A preschool hose toy. Hold and aim a stream of moving water at the current
glowing mud patch on a gently wriggling puppy. Only actual airborne droplets
that reach the patch gradually wash it away; aiming alone, holding off target
or waiting cannot clean it. Five real washouts leave a clean puppy, followed
by a happy shake. All mud follows the same body transform as the painted fur.
Direct touch-and-hold on the canvas and a native hose control both work;
keyboard arrows aim and Space holds the same spray.

The existing five targets and two sayings remain. Speech grants ten seconds
of slower, smaller wiggles and wider water droplets/fan. Help preserves each
patch's washing and the chosen aim. Backgrounding releases the hose and clears
airborne water while keeping accumulated washing. Spoken step directions and
Hear-step use SayPlay's existing quiet voice owner.

One new clean cream-puppy cutout totals 104,460 bytes and preserves its true
512×677 proportions. The old animal baked in its tub, foam and floating
bubbles, so it could not move independently. The original backyard is reused;
the hose, live water and removable mud are drawn. Safe ear, forehead and paw
anchors avoid the eyes, mouth and red bandana. Prompt, source, alpha checks
and anatomy are in design/coming-soon-games/puppy-art-notes.txt.

All 69 browser checks passed, exit 0. They play five actual washouts at regular,
320px, 393px and iPad sizes; require airborne impacts, prevent idle/off-target
washing, preserve partial work and aim across help/background, measure real
ordinary/assisted motion, operate the keyboard hose, and check missing-art
fallback, replay and quiet microphones. Source and visual review found the
mud aligned with the fur and no additional blocker. The new test rejects the
original soap-reveal scene. Syntax, art protection and recording inventory
checks passed. Production remains parked and nothing is pushed.

## Bedtime Stars

A calm preschool tracing game. Five small constellations form a tent, kite,
house, boat and fish. The child starts at the last lit star and draws the
actual next connection; future-star taps and detours outside the path cannot
stand in for drawing it. Completed connections remain after a slip or pause,
and each finished picture remains in the night sky. Keyboard pickup, arrows
and release move the same physical tracing pen.

The existing five targets and two sayings remain. Speech grants ten seconds
of a wider glowing corridor and easier star contact; it never draws the line.
Help retains the current picture and completed connections. Backgrounding
releases the current uncommitted stroke safely. Five spoken directions and
Hear-step use the existing shared voice owner.

One precise background edit removes baked stars/sparkles that could be
mistaken for touch targets. The original crescent, clouds, village and ledge
are preserved; the versioned 800×1200 export is 49,902 bytes. All interactive
stars and paths are live drawing. Exact prompt, source and usable sky geometry
are in design/coming-soon-games/stars-art-notes.txt.

All 76 browser checks passed, exit 0. The same off-route gesture is rejected
normally and accepted after earned speech help. All five pictures complete
in one uninterrupted ordinary stroke and one uninterrupted assisted stroke;
the review caught and fixed an early-snap finger offset that broke the house's
roof corner. The pre-fix version fails that regression. Checks also cover
five full pictures at 320px, 393px and iPad widths, preserved connections,
background/help recovery, owned pointers, keyboard, missing-art fallback,
replay and quiet microphones. The original reveal scene fails the new game
test. Source and visual review found no additional blocker; syntax, protected
art and recording inventory checks passed. Production remains parked.

## Birthday Cake

Five physical recipe activities: stir around the bowl, catch real falling
batter in a tin, pipe six icing swirls, place four freely chosen fruits,
and drag three candles before fanning their flames. Random taps, still tools
and idle time cannot complete the recipe. The final cake keeps the child's
chosen fruit types and positions.

The existing five turns and two sayings remain. Speech earns ten seconds of
stronger stirring, wider batter catch, broader piping contact, a decoration
magnet or gentler fanning. Extra help repeats the same target and retains
mix, caught batter, icing and placed decorations. A background interruption
releases tools and returns uncommitted fruit/candles without adding them.
Five directions use SayPlay's existing quiet voice owner.

Five minimal recipe sprites total 152,302 bytes: plain sponge, circular
bowl, spoon, jug and piping bag. The existing kitchen and fruit are reused;
icing, fluid, candles and fan are live drawing. Exact prompts, sources,
transparent exports and measured tool/cake anchors are in
`design/coming-soon-games/cake-art-notes.txt`.

All 73 browser checks passed, exit 0: full actual recipes at 320px, 393px
and iPad widths, physical no-input/miss cases, speech powers, preserved work,
interruptions, quiet microphones, keyboard, missing-art fallback and replay.
The original reveal scene fails the new test. Syntax, protected art and voice
inventory checks pass; production remains parked for phone play review.

## Surprise Boxes

Five different physical presents: pull a bow tail, peel paper diagonally,
slide two separate latches, twist a circular lid, and slide a box top.
Each then needs a real upward lid drag and release. Words and idle time do
not open presents. Five discovered buddies remain on the shelf.

The existing five turns and two sayings remain. Speech earns ten seconds of
shorter pulls/lifts/turns and more forgiving paths. Help retains actual work
and already opened latches. Forgiveness is latched when a grip is picked up;
expiry cannot invalidate that gesture. Canceled final lid lifts do not reveal
anything. Five directions use SayPlay's existing quiet voice owner.

No new raster art: the quiet mint room, intro card and five sitting buddies
are reused unchanged. Moving wrapping, ribbons, latches and lids are native
drawing so the visible objects follow the real physical controls. Reuse and
shelf feet anchors are in `design/coming-soon-games/gifts-art-notes.txt`.

All 75 browser checks passed, exit 0: five different real mechanisms, wrong
directions and twist shortcuts, tiny gestures, canceled final lift, preserved
work/help/background behavior, quiet microphone, keyboard and replay. All
five ordinary presents finish at 320px and iPad widths; all five assisted
presents finish at 393px. Missing-art fallback also works. The old automatic
reveal scene fails the new test. Syntax, protected art and voice inventory
checks pass; production remains parked for phone play review.

## Fish Tank

Drag a food pinch from the jar to the water's surface and release a finite
five-pellet batch. Actual sinking pellets must reach the hungry fish's moving
mouth; three catches feed it. Missed pellets settle in sand, with unlimited
fresh attempts. Five visitors have distinct swimming paths. A physically fed
fish joins the school and the next waiting visitor appears before its word;
speech never adds a fish. Old food clears at completion so it cannot feed the
next visitor. The finished school keeps swimming while visible.

The existing five turns and two sayings remain. Speech earns ten seconds of
slower swimming and a wider visible catch halo. Help preserves released food,
caught bites and continuous swim phase. In-flight assisted food retains its
help; overlapping batches use the same visible halo. Backgrounding freezes
released food/fish and returns uncommitted pinches. Five directions use
SayPlay's existing quiet voice owner.

One transparent swimming actor is new: 31,750 bytes, with five runtime color
variants. The quiet room is reused; the live glass aquarium, food and plants
are native drawing. Exact prompt, origin, export and mouth anchor are in
`design/coming-soon-games/fishtank-art-notes.txt`.

All 76 browser checks passed, exit 0, including five ordinary feedings at
320px and iPad widths and five assisted feedings at 393px, real food misses,
physical swim slowing, preserved airborne food, interruption recovery,
keyboard, fallback, replay and quiet microphones. Review found and fixed a
post-expiry overlapping-batch halo mismatch; a real food drop inside the
surviving halo feeds correctly now and fails against the pre-fix version.
The old automatic reveal scene also fails. Source/art/voice checks pass.
All twenty former generated scenes now have hand-built pages/cards, and
empty-generator checks prove regenerating cannot overwrite any of them.
Production remains parked for phone play review.
