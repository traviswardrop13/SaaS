# Buddies v3: playing as your buddy, and the Trophy Road's chests (11 Oct 2026)

Travis, 9 Oct 2026: "a currency so they can buy stuff like characters, and they
actually BE the character in the game." This is the painted art for that (the
spec's art list, P1: A2 to A13). The games place it since the next step (BUDDY2
in CLAUDE.md, "Play as your buddy"), with the numbers below.

What landed, all in `public/assets/crafted/`:

- **For each of the 8 buddies** (fox, bunny, dragon, cat, bee, octopus, dino,
  panda): `buddy-<id>-rest.webp` (standing, facing us, like `echo-welcome`) and
  `buddy-<id>-cheer.webp` (arms up, like `echo-cheer`), 512 x 512.
- **For the 7 that are not the fox**: `buddy-<id>-run.webp` (from behind, Sound
  Sprint, 480 x 840), `buddy-<id>-peek.webp` (over Fruit Slice's counter, 512 x
  384) and `buddy-<id>-sit.webp` (on Block Stacker's bench, 512 x 512). The fox
  runs as `fox-runner.webp` always has, and keeps its painted counter and bench.
- **The Trophy Road's chests**: `road-chest.webp`, `road-chest-open.webp`,
  `road-bigchest.webp`, `road-bigchest-open.webp`, 512 x 512.
- **The three scenes without the fox (or Echo)**, each the size of the picture
  it stands in for: `fruit-stand-v2.webp` (1440 x 545), `stack-workshop-v3.webp`
  (768 x 1536), `stack-rocket-v3.webp` (267 x 400).

`BUDDY_ART` in `public/sona.js` (block BUDDY2) lists every buddy picture, and
`tests/trophytest.mjs` (section 14) holds each one to its file and its frame.
45 files, 2.2 MB together; a game will load only its child's own buddy's few.

## How they were drawn

Every model-drawn picture has its entry in `tools/art/game-sprites.json`: its
size, its reference pictures (`refs`, in the order the prompt names them, "the
first picture", "the second picture"…) and its exact prompt. They go through
`NODE_USE_ENV_PROXY=1 node tools/art/gen-sprites.mjs <name>` (OpenAI
`images/edits`, `chatgpt-image-latest`, quality high), which puts its STYLE line
in front of every prompt: soft 3D clay, smooth clean finish, warm sunny colours,
gentle even light, friendly and simple for 3 to 8 year olds, no text. Then
`python3 tools/art/cut-buddies.py <name>` cuts each to its frame.

**No model sheets (A1).** The plan was to draw a three-view sheet per buddy
first and attach it to every pose. The lead engineer's eye check had already
passed a cheer pose for every buddy, each drawn from that buddy's own round
badge, so the cheer pose plays the sheet's part: it rides along as the body
reference in every later pose of that buddy (rest, peek, sit), with the badge
beside it for the face. Every pose below was checked against both.

**Drawn earlier the same day, reused as they were (A4, A2, A10, A12).** The 8
cheer poses, the 7 runners and the two closed chests were drawn, checked and
passed by the lead engineer that morning, through a scratch copy of
`gen-sprites.mjs` with the same STYLE line, model, quality and references. One
difference, recorded in each entry's `note`: its transparent line read "the
character alone" where the tool's reads "the object alone". They were cut, not
redrawn.

| Pose | References, in order | Prompt (the entries hold each in full) |
|---|---|---|
| cheer (A4) | `echo-cheer.webp`, `buddy-<id>-v2.webp` | "{Name} the {animal} from the second picture as a full-body clay toy facing us, cheering with both arms up and a big open smile, with the pose energy and soft finish of the bird in the first picture. Same face, colours and proportions as the portrait: {colours}. Small body with short arms and feet. Centred, about 85% of the square, feet at the bottom. No ground, no shadow, no confetti, no sparkles." |
| run (A2) | `fox-runner.webp`, `buddy-<id>-v2.webp` | "{Name} the {animal} from the second picture, as a full-body clay toy seen from directly behind, running away from us: exactly the pose, framing, size and light of the fox in the first picture (one foot lifted mid-step, arms swinging, the back of the head with one cheek just showing; ears and tail seen from behind). Same colours as the portrait: {colours}. Centred, feet near the bottom, about 70% of the frame height. No ground, no shadow." |
| rest (A3) | `echo-welcome.webp`, `buddy-<id>-cheer.webp`, `buddy-<id>-v2.webp` | "{Name} the {animal} from the second picture, the same character as the round badge in the third picture, as a full-body clay toy facing us, standing calmly with a friendly smile, both arms relaxed and resting down at its sides: the calm pose and soft finish of the bird in the first picture. Same face, colours and proportions as the second picture: {colours}. …" |
| peek (A5) | the fox as Fruit Slice shows it (`scene-edit.py cut fox-peek-ref`), `buddy-<id>-cheer.webp`, `buddy-<id>-v2.webp` | "… peeking over a counter exactly as the fox in the first picture does: its head, the tops of its shoulders and both front paws resting side by side on the ledge … Everything below the paws is cut off in one straight, flat, horizontal line across the bottom. No counter, no ledge, no wood drawn: only the character, alone." |
| sit (A6) | the fox as Block Stacker shows it (`scene-edit.py cut fox-sit-ref`), `buddy-<id>-cheer.webp`, `buddy-<id>-v2.webp` | "… sitting exactly as the fox in the first picture does: sitting down, facing us, both front paws resting together in front of it, a big happy smile … Only the character, alone: no bench, no wood, no night sky, no background, no shadow." |
| chests (A10, A12) | `tools/art/refs/approved-style.png` | "A small closed wooden treasure chest, honey wood with rounded gold corners and a round gold clasp…"; "A bigger treasure chest: teal painted wood with cream trim…" |
| open chests (A11, A13) | `road-chest.webp`, `road-bigchest.webp` | "The same chest as the attached picture, lid open, a warm golden glow and a few plain gold coins inside…"; the big one adds "gold coins and a little rolled-up sticker". |

{colours}, read off each badge: fox "bright orange fur, a white muzzle and white
chest, dark brown paws and ear tips, a bushy orange tail with a white tip";
bunny (Miso) "cream-white fur, pink inner ears, pink nose, rosy cheeks, a round
white cotton tail"; dragon (Ziggy, a little dragon) "mint-green body, a
pale-green belly and snout, cream horns, small dark-green back spines, a short
mint tail"; cat (Mochi) "peach-orange fur, a white muzzle and chest, pointy
peach ears with pale pink insides, a peach tail"; bee (Buzz) "round yellow body
with dark brown stripes, small white see-through wings, two black antennae with
round tips"; octopus (Otto) "purple body with lilac spots, four short round
tentacles as legs and two as arms"; dino (Rocky, a baby dinosaur) "teal body, a
pale cream belly, small cream spikes down the back, a short teal tail"; panda
(Bao) "white fur with black ears, black eye patches, black arms and legs, a
small white tail".

**Redrawn after the eye check**, each with one sentence added to its prompt
(the entries hold the prompt that drew the picture that shipped):
- `buddy-cat-sit` (2nd drawing): the first had the fox's dark brown paws. Added
  "Its four paws are peach with cream-white tips…; nothing about it is brown."
- `buddy-bee-sit` (3rd drawing): the first two had brown hands and feet.
  Added "Its round hands resting in its lap and its two round feet are bright
  sunny yellow… not brown, not black."
- `buddy-octopus-rest` and `buddy-octopus-sit` (2nd drawings): the first had
  no lilac spots, so the 900 ms swap to the cheer pose (which has them) would
  have made spots appear. Added "Round lilac spots dot its head and tentacles."

## How they were cut (`tools/art/cut-buddies.py`)

| Kind | Frame | Rule | Drawings, as cut (width x height of the drawing in the model's 1024 px picture) |
|---|---|---|---|
| run | 480 x 840 | cropped to the drawing, padded to 4:7, feet 4% above the bottom edge, at least 2% over the head and 3% each side (the fox's runner is the same frame, cut from `fox-runner.webp` at 390, 205, 480, 840) | bunny 506 x 1049 (94% of the frame's height), dragon 515 x 869 (91%), cat 457 x 716 (84%), bee 504 x 837 (89%), octopus 802 x 1010 (68%: it is wide), dino 560 x 926 (89%), panda 524 x 812 (83%) |
| rest, cheer, sit | 512 x 512 | cropped, padded to a square with a 6% margin, standing (or sitting) on the bottom margin | rest: fox 614 x 867, bunny 425 x 936, dragon 525 x 859, cat 587 x 872, bee 715 x 890, octopus 647 x 806, dino 559 x 908, panda 537 x 872; cheer: fox 780 x 931, bunny 685 x 941, dragon 761 x 902, cat 712 x 834, bee 711 x 850, octopus 789 x 707, dino 761 x 879, panda 786 x 860; sit: bunny 512 x 885, dragon 601 x 764, cat 637 x 857, bee 783 x 858, octopus 644 x 663, dino 573 x 863, panda 649 x 807 |
| peek | 512 x 384 | cropped, the drawing's bottom edge on the frame's bottom edge, 6% over the ears, 4% each side | bunny 728 x 844, dragon 687 x 587, cat 784 x 696, bee 871 x 696, octopus 771 x 540, dino 695 x 701, panda 801 x 673 |
| road | 512 x 512 | the whole picture, as drawn, so a chest and its open self keep the same size and place | |

The peek cut prints a warning for all seven ("the bottom row is only 0-3%
drawn"). It is the paws: each body is cut by one straight horizontal line, and
the rounded tips of the two front paws reach 1 to 2.5% of the picture lower,
as the fox's paws hang over the ledge. At the size Fruit Slice shows them that
is 1 to 2 px. Checked by eye at 2x over a wood colour.

## The three scenes (`tools/art/scene-edit.py`)

Every edit prints the pixels it changed outside its box: **0 for all three**.
Each scene is then written as WebP at the quality of the picture it stands in
for, and the encoder's own rounding (on average 1.2 to 1.6 levels out of 255,
at most 28 to 35) is printed beside it;
`--lossless` makes that 0 too, at about three times the file size (348 KB for
the counter instead of 122 KB). Nobody sees both pictures at once: a fox child
gets the old one, any other buddy the new one.

- **A7 `fruit-stand-v2.webp`**, scripted, no model:
  `python3 tools/art/scene-edit.py clear fruit-stand-v2`, then `clone`. The
  counter's ledge starts at row 244 in every column (opaque from 245), so the
  fox above it is cleared (x 0-319, y 0-243: 47,363 pixels) and the ledge rows
  under its paws are copied from just to their right (rows 244-263, x 320-639
  over x 0-319: 6,398 pixels). Checked at phone size and at 2x for a seam in
  the ledge: none. Same size and ledge line, so `STAND_LEDGE` (0.1979) and the
  fruit wells hold.
- **A8 `stack-workshop-v3.webp`**, scripted, no model:
  `python3 tools/art/scene-edit.py mirror stack-workshop-v3`. The plan was a
  masked model edit, and it was drawn twice: both times the model redrew the
  whole night brighter and greener, and the first time it also put a new step
  on the bench, so what it painted inside the box could never meet what is
  around it (a hard edge at x 250 and a bright patch on a dark scene). R15
  allows a scripted edit of the picture's own paint, so the box (x 0-249, rows
  860-1243) is now the strip just right of it (x 250-499) flipped left to right:
  at x 250 the copy's edge is the very column it meets, so there is no seam, and
  over its top 40 rows it fades in from the picture, so the bushes run on into
  the trees above (94,883 pixels changed). The bench's top and its edge run on
  unbroken. Same size and bench line.
- **A9 `stack-rocket-v3.webp`**, a masked model edit:
  `scene-edit.py prep stack-rocket-v3`, `gen-sprites.mjs stack-rocket-v3`,
  `scene-edit.py apply stack-rocket-v3`. Prompt: "Make the round porthole
  window empty: pale blue glass with a soft white shine, nothing inside. Change
  nothing else." The model drew a clean empty porthole but smaller and higher
  than the original's (its glass centred at 135.1, 162.1 with radius 32.3 in
  the rocket's own pixels, against 133, 167 and about 40), so the plain apply
  showed two gold rings at the bottom of the window. A second drawing with
  "keep the gold ring … exactly as they are" did the same. `apply` now takes
  the entry's `fit`: it scales the model's picture by 1.238 and moves it so its
  glass lands on the original's, then keeps only the masked circle (133, 167,
  r 43; 5,795 pixels): one ring, one set of rivets, empty glass. The first
  drawing is the one that shipped.

## Where each game puts them (measured here, used by the games)

- **Fruit Slice (peek).** The counter (`fruit-stand-v2.webp`) spans the full
  width at the bottom. The fox it replaces spans x 12-315 and y 5-256 of the
  1440 x 545 picture: 21% of the counter's width, its paws' bottom at row 256,
  which is 289 rows (53.0% of the counter's height, 20.1% of its width) above
  its bottom edge. A peek frame **23% of the counter's width** (the drawing
  fills 92% of it when it is wide), **left 0**, its **bottom edge on row 256**
  puts the paws where the fox's were. Checked at 390 px wide: the panda reads
  the fox's size, the bunny a little smaller (its ears make it tall, so it
  fills its frame by height).
- **Block Stacker (sit).** The workshop is stretched to `#app` (`100% 100%`).
  The fox sat in x 0-235 and y 915-1228 of the 768 x 1536 picture (the bench
  top starts at row 1214; its paws reach 1228, 79.9% down). A sit frame **40 to
  44% of `#app`'s width**, **left -4%**, placed so the drawing's feet (the
  frame's bottom 6%) stand on row 1228: the frame's bottom at **20.05% of the
  height minus 6% of the frame's own height**. Checked at 390 x 844 with the
  bunny, the octopus and the panda.
- **The rocket (portrait in the porthole).** `ctx.drawImage(ROCKET_ART, -41,
  -119, 82, 123)` draws the 267 x 400 picture at 0.3071 x 0.3075, so the glass
  (133, 167, r 40) is at **(-0.15, -67.65), radius 12.3** in that drawing's
  units. A round portrait of **size 23** there (`drawCircle(ctx, img, -0.15,
  -67.65, 23)`) leaves a thin ring of glass inside the gold rim; 24.6 fills it
  to the rim.
- **Sound Sprint (run).** Every runner but the fox's is already cut to the
  fox's 480 x 840 frame, so `drawBuddy` draws any of them in the box the fox
  uses today.
- **Hoops, Soccer Goal, Dino Dig, Feed Echo (rest, swapped with cheer for 900
  ms).** Same 512 x 512 frame as Echo's poses, the figure standing on the
  bottom margin, so the two swap without a jump.

As built (BUDDY2, `tests/buddyplaytest.mjs` holds each):
- Fruit Slice: `#sliceBuddy` 23% wide, `left:0`, its bottom
  `min(100vw,560px) * 0.2007` above #app's (289 / 1440 of the width).
- Block Stacker: `#stackBuddy` is the 42% frame from -4%, drawn as a 38% box
  at `left:0` whose `object-fit:cover; object-position:right bottom` cuts the
  4% beyond the edge, so the element itself stays on screen; its bottom at
  `20.05% - min(100vw,560px) * 0.0252` puts the seat on row 1228.
- The rocket: `drawCircle(ctx, portrait, -0.15, -67.65, 23)` right after the
  rocket is drawn.
- Hoops, Soccer Goal: Echo's frame mirrored (`right:3%; bottom:2%`, 16%
  wide, at most 74 px). Dino Dig: `left:3%; top:44%`, 15%, at most 70 px,
  above the pit and clear of every woken dinosaur.
- Feed Echo: inside `#echoSpot`, 72 px, its box ending 10 px inside Echo's
  (its drawing has a quarter of its width empty on each side), its feet at
  the plate's rim (`crafted-games.css`: the crafted Echo is
  `clamp(116px,19dvh,180px)` and the plate 45 px tall, 110 px and 35 px under
  700 px of height). The spec's numbers (`right: calc(50% + 62px); bottom:
  4%`) were read off the page's own sheet, which the crafted one overrides:
  with them the buddy stood behind the plate with only its head showing.

## Eye check (each picture, by eye, at full size and at game size, over a light and a dark ground)

The questions: the same character as its badge and its other poses; a runner
from behind; a flat peek with its paws where the fox's were; no text; clean
edges; for the scenes, nothing changed outside the box.

| File | Verdict |
|---|---|
| buddy-fox-rest, buddy-fox-cheer | pass |
| buddy-bunny-rest, buddy-bunny-cheer, buddy-bunny-run, buddy-bunny-peek, buddy-bunny-sit | pass |
| buddy-dragon-rest, buddy-dragon-cheer, buddy-dragon-run, buddy-dragon-peek, buddy-dragon-sit | pass |
| buddy-cat-rest, buddy-cat-cheer, buddy-cat-run, buddy-cat-peek | pass (the runner shows the tips of its whiskers and one cheek, as asked) |
| buddy-cat-sit | pass on the 2nd drawing (the 1st had brown paws) |
| buddy-bee-rest, buddy-bee-cheer, buddy-bee-run, buddy-bee-peek | pass (the runner's legs are dark, as a bee's are; it is never shown beside the others) |
| buddy-bee-sit | pass on the 3rd drawing (the first two had brown hands and feet) |
| buddy-octopus-cheer, buddy-octopus-run, buddy-octopus-peek | pass |
| buddy-octopus-rest, buddy-octopus-sit | pass on the 2nd drawing (the 1st had no lilac spots) |
| buddy-dino-rest, buddy-dino-cheer, buddy-dino-run, buddy-dino-peek, buddy-dino-sit | pass |
| buddy-panda-rest, buddy-panda-cheer, buddy-panda-run, buddy-panda-peek, buddy-panda-sit | pass |
| road-chest, road-bigchest | pass (a faint soft shade under each, inside the picture) |
| road-chest-open, road-bigchest-open | pass (the lids carry a second keyhole clasp; the coins and the rolled sticker are plain, no text) |
| fruit-stand-v2 | pass: 0 pixels outside the boxes, no seam in the ledge at phone size or at 2x |
| stack-workshop-v3 | pass as a scripted mirror (two model drawings failed: lighting and a new step) |
| stack-rocket-v3 | pass with `fit` (two plain applies showed a doubled ring) |

# Part two: the Trophy Road's own buddies, the painted hats and three new places (11 Oct 2026)

The spec's art list, P2 and P3 (A14 to A23), drawn the same day through the
same tool and the same STYLE line. With them on disk the items joined the
catalog (`CHARACTERS`, `OUTFITS`, `BACKDROPS` in `public/sona.js`), their
road stops (`ROAD_STOPS`) and `BUDDY_ART`. 37 files, 1.4 MB together.

- **Four new buddies**, each a round badge `buddy-<id>-v2.webp` (288 x 288)
  and the five poses, `buddy-<id>-{rest,cheer,run,peek,sit}.webp`, in the
  same frames as the first eight: **Hops the frog** (`frog`, road stop 10,
  750 trophies), **Pebble the penguin** (`penguin`, stop 16, 1,350), **Sunny
  the lion** (`lion`, stop 22, 2,100), **Luna the unicorn** (`unicorn`, stop
  28, 3,000). Never Bo (the bear in goal) or Robot (Robot Builder).
- **Ten painted hats**, `hat-<id>.webp` (256 x 256): the six the shop used to
  draw (cap, bow, top hat, shades, crown, party) and four new ones: the
  **Flower crown** (shop, 150 coins), the **Sun hat** (road stop 6), the
  **Star clip** (stop 15) and **Headphones** (stop 25).
- **Three places**, `customize-<id>-v2.webp` (600 x 399): **Candy land**
  (shop, 250 coins), **Snow** (road stop 12) and **Under the sea** (stop 19).
  Snow and Under the sea are also the Trophy Road's Snowy Peak and Under the
  Sea bands (`ROAD_LANDS[].art`), which showed only their colours until now.

## How they were drawn

Every picture's entry in `tools/art/game-sprites.json` holds its size, its
reference pictures in the order its prompt names them, its exact prompt, and,
where a picture was drawn more than once, a `note` saying why.

| What | References, in order | Prompt (in full in each entry) |
|---|---|---|
| badge (A14) | `buddy-fox-v2.webp` | "A round portrait badge in exactly the style, framing and background of the attached picture: an off-white square with a painted coloured disc filling it edge to edge, a friendly clay {animal} head and tiny shoulders filling the disc, facing front, big happy eyes. {Name} the {animal}: {colours}. The disc is {disc}. Not a fox: only the {animal}. No text." |
| cheer (A18) | `echo-cheer.webp`, the new badge | as the first eight's (part one), with the new buddy's colours |
| rest, run, peek, sit (A16, A17, A19, A20) | the pose's model picture (`echo-welcome.webp`; `fox-runner.webp`; the fox cut from Fruit Slice and from Block Stacker by `scene-edit.py cut`), then the buddy's own cheer, then its badge | as the first eight's, with the new buddy's colours; the runner's reference list gains the cheer too |
| a hat the shop drew (A21) | the shop's own drawing of it (`node tools/art/hat-refs.mjs` renders `customize.html`'s `outfitArt()` SVGs to `tools/art/out/edit/hat-<id>-ref.png`), `tools/art/refs/approved-style.png` | "One {hat} for a small round clay toy to wear, with the shape and colours of the flat drawing in the first picture, made in the soft clay look of the second picture: front view from slightly above, centred, about 80% of the square, soft clay finish. No head, no character, no face: only the hat, alone." |
| a new hat (A22) | `approved-style.png` | "One {hat} for a small round clay toy to wear, front view from slightly above, centred, about 80% of the square, soft clay finish. No head, no character, no face: only the hat, alone." |
| a place (A23) | `customize-sky-v2.webp` | "A wide children's backdrop in exactly the style and soft light of the attached picture, leaving the lower middle plain where a little character will stand: {scene}." |

**No model sheets (A15)**, as in part one: each new buddy's own checked
cheer pose is its body reference in every later pose, beside its own new
badge for the face (the lead engineer's call for this step).

{colours}: frog (Hops) "lime-green clay skin, a pale yellow-green tummy and
chin, two big round eyes sitting up on two bumps on top of its head, a wide
happy smile, rosy cheeks", disc pastel sky blue; penguin (Pebble) a navy-blue
head, back and flippers, a white face and tummy, an orange beak and feet,
rosy cheeks, disc pale icy blue; lion (Sunny, a lion cub) "golden-yellow fur,
a big round fluffy orange mane all around its face, small round golden ears,
a cream muzzle, a little brown nose, rosy cheeks", disc pale buttery yellow;
unicorn (Luna) "white fur, a golden spiral horn, a soft rainbow mane in pink,
orange, yellow, mint and lilac, pink inside its ears, rosy cheeks, small
pale-pink hooves", disc pale pink.

**Hats:** a teal baseball cap; a pink bow; a purple top hat with a gold band;
round grey sunglasses; a gold crown with a teal gem; a lilac party hat with
cream stripes and a gold pom-pom; a ring of small pink, yellow and white
flowers with green leaves; a wide straw sun hat with a coral ribbon; a gold
star hair clip; round teal headphones with cream ear cushions. (The shop's
own party-hat drawing filled one of its stripes black, an SVG path with no
`fill`; it is `fill="none"` now, in the page and so in its reference.)

**Places:** candy "a pastel candy land: lollipop trees, gumdrop hills, a
soft pink sky"; snow "snowy hills with pine trees, a little snowman, gentle
snowfall, a pale blue sky"; sea "under the sea: soft blue water, sea grass,
shells, a few round friendly fish, light rays from above".

**Redrawn after the eye check** (each entry's `note` says why):
- `buddy-unicorn-cheer` (2nd drawing): the 1st sat down, so the 900 ms swap
  from its standing rest pose would have jumped.
- `buddy-penguin-cheer` (3rd): the first two were a bright royal blue beside
  the badge's dusty navy. The prompt now names the navy (and #45608f); the
  model still draws it a little brighter (about 68, 107, 168 against the
  badge's 73, 99, 143), which reads as the same penguin. Its rest, sit and
  peek were drawn again from this cheer.
- `buddy-penguin-peek` (3rd): the 2nd drew a thin wooden strip under the
  flippers.
- `buddy-penguin-run`: **the first drawing ships.** It was drawn with the
  first, brighter cheer as its reference; three drawings with the darker
  prompt failed (one with a cat's ears, one a fake checkerboard behind a
  blurred penguin, one a grey photo). Its blue (about 74, 124, 199) sits
  beside the rest pose's (85, 125, 180), and a runner is never shown beside
  the other poses.
- `buddy-lion-sit` (2nd): the 1st had the fox's dark brown paws, as the
  cat's first sit did in part one.
- `buddy-unicorn-peek` (3rd): the 1st had see-through eyes (the ground
  showed through them); the 2nd a thin wooden strip under its hooves.
- `hat-starclip` (2nd): the 1st was a beanie with a small star on it.
- `hat-headphones` (2nd): the 1st turned its ear cushions towards us, so on
  the badge they covered the buddy's cheeks and eyes at any size.

## How they were cut

`python3 tools/art/cut-buddies.py <name>`, every rule as in part one, and
one new: **the badge.** The model drew each disc with a margin of paper
(about 5% a side, and not quite round, 886 to 922 px across), where the
existing eight fill their square edge to edge. The cut now finds the disc
(everything unlike the corners' paper) and cuts the square to its smaller
side before sizing to 288 and painting the corners off-white: frog 910 x
886 cut to 886, penguin 906 x 884 to 884, lion 922 x 909 to 909, unicorn
893 x 875 to 875. The existing eight were never cut by it.

| Kind | Drawings, as cut (width x height in the model's picture) |
|---|---|
| run (480 x 840) | frog 639 x 892 (75% of the frame's height), penguin 732 x 973 (71%), lion 662 x 951 (77%), unicorn 630 x 1043 (89%) |
| rest (512 x 512) | frog 570 x 805, penguin 581 x 802, lion 663 x 862, unicorn 511 x 907 |
| cheer | frog 739 x 721, penguin 748 x 778, lion 770 x 861, unicorn 640 x 947 |
| sit | frog 541 x 647, penguin 623 x 830, lion 757 x 859, unicorn 640 x 898 |
| peek (512 x 384) | frog 696 x 574, penguin 778 x 560, lion 758 x 622, unicorn 744 x 799 |
| hat (256 x 256) | cap 660 x 632, bow 799 x 558, top hat 838 x 703, shades 907 x 393, crown 791 x 723, party 692 x 892, flower crown 844 x 444, sun hat 898 x 628, star clip 565 x 505, headphones 643 x 523 |
| place (600 x 399) | the whole 1536 x 1024 picture |

The peek cut warns, as in part one, that the bottom row is barely drawn: the
rounded tips of the paws, flippers or hooves reach 1 to 1.3% of the frame
below the straight body line (about 1 px in the game). The unicorn's last 4
rows are a faint soft shade. Re-cutting all 37 from the drawings reproduces
the committed files byte for byte.

## Where they go

- **The buddies** take the first eight's places in every game unchanged
  (part one's numbers): the frames are the same, so a game places any of
  them the same way. Checked by eye at 390 x 844 and 320 x 568 in all ten
  games: the peek's paws on Fruit Slice's ledge, the sit on Block Stacker's
  bench, the badge in the rocket's porthole, the runner in Sound Sprint's
  lane, the rest pose beside Echo in Hoops, Soccer Goal, Dino Dig and Feed
  Echo.
- **The painted hats** sit on the Buddy Shop preview's badge, each in a
  square box of its own (`#heroOutfit.painted[data-outfit=…]` in
  `crafted-customize.css`; `customize.html` marks a hat with a picture
  `painted`, so a phone holding an older `sona.js`, whose hats have no
  picture, keeps the drawn hats in their old places). Each box's side, then
  its top in px from the top of the badge's wooden ring (centred unless
  said): crown 60, 4; top hat 62, -4; cap 66, 4; shades 98, 32 (over the
  eyes); bow 50, 12, centred 68% across; party hat 62, -14; flower crown 96,
  -2; sun hat 104, -22; star clip 40, 22, centred 70% across; headphones
  150, 4 (the band over the head, the cups at its sides). Placed by eye over all twelve
  badges at 390 px. The shop's tiles show each at 48 px.
- **The places** fill the shop's preview and tiles like the first six, and
  the Trophy Road's Snowy Peak and Under the Sea bands.

## Eye check (part two)

The questions as in part one; for a badge also "fills its square like the
first eight", for a hat "reads as that hat, and sits on a head", for a place
"the lower middle plain".

| File | Verdict |
|---|---|
| buddy-frog-v2, buddy-penguin-v2, buddy-lion-v2, buddy-unicorn-v2 | pass, cut to the disc (a slightly softer, felted finish than the first eight at full size; at badge size they sit in the set) |
| buddy-frog-rest, buddy-frog-cheer, buddy-frog-run, buddy-frog-peek, buddy-frog-sit | pass |
| buddy-penguin-rest, buddy-penguin-sit | pass on the 2nd drawing (drawn from the shipped cheer) |
| buddy-penguin-cheer | pass on the 3rd drawing (a little brighter blue than the badge; the same penguin) |
| buddy-penguin-run | pass, the 1st drawing (three later ones failed) |
| buddy-penguin-peek | pass on the 3rd drawing (the 2nd had a strip under it) |
| buddy-lion-rest, buddy-lion-cheer, buddy-lion-run, buddy-lion-peek | pass |
| buddy-lion-sit | pass on the 2nd drawing (the 1st had brown paws) |
| buddy-unicorn-rest, buddy-unicorn-run, buddy-unicorn-sit | pass |
| buddy-unicorn-cheer | pass on the 2nd drawing (the 1st sat) |
| buddy-unicorn-peek | pass on the 3rd drawing (see-through eyes, then a strip) |
| hat-cap, hat-bow, hat-tophat, hat-shades, hat-crown, hat-party | pass (each the shop's drawn hat, in clay) |
| hat-flowercrown, hat-sunhat | pass |
| hat-starclip, hat-headphones | pass on the 2nd drawing (a beanie; cushions over the face) |
| customize-candy-v2, customize-snow-v2, customize-sea-v2 | pass (the candy sun has a smiling face; the snowman wears a red woolly hat and scarf) |
