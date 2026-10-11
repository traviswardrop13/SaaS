# Buddies v3: playing as your buddy, and the Trophy Road's chests (11 Oct 2026)

Travis, 9 Oct 2026: "a currency so they can buy stuff like characters, and they
actually BE the character in the game." This is the painted art for that (the
spec's art list, P1: A2 to A13). It is what the games will show; placing it in
the games is the next step, and nothing here is on a child's screen until it is.

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

## Where each game puts them (for the next step; measured, not yet used)

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

Not drawn in this step: the four new buddies, the hats and the new places
(P2 and P3), which ship only once their art is on disk.
