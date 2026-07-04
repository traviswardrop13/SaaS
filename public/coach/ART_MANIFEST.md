# Sona art drop-in manifest

Every image below auto-loads the moment the file exists at the path — **zero code**.
Until then the app shows a placeholder (CSS kit / gradient / emoji). Names are exact,
lowercase, **no spaces**. All visuals are AI-generated PNGs; images are scenery only —
anything tappable or with text stays in code.

## 1. City houses — TOP PRIORITY  (the main screen)
`coach/houses/<key>.png` — transparent PNG, one house each. Replaces the CSS-kit
house on the Sound Town swipe city (today.html). Rendered ~300px wide with a CSS
drop-shadow; export **~1000px wide**, house centered, transparent background.

| key | house |
|---|---|
| `daily-0` … `daily-6` | Today's Run house — 7 color variants, one per weekday |
| `slice` | Fruit Slice (red roof, 🍉) |
| `tiles` | Piano Tiles (purple, 🎹) |
| `stack` | Block Stacker (blue, 🧱) |
| `run` | Sound Sprint (green, 🏃) |
| `glide` | Flappy Glide (sky blue, 🎈) |
| `story` | Story Time (yellow, 📖) |

13 files total. The CSS kit stays as fallback — a missing file just keeps the
current look, nothing breaks.

## 2. Story Time backdrops  (live from the city)
- `coach/story/lvl<n>.png` — per-level scene, n = 1…10 (preferred)
- `coach/story/bg.png` — generic fallback used when a level file is missing
Full-bleed 9:16 vertical, no transparency (it's `background-size: cover`).

## 3. Vocabulary pictures  (used by the charge screen prompts)
- `coach/items/<word>.png` — 512×512 keyed transparent PNG.
  Full word list + generation spec in `coach/items/README.md`.
  Generate on flat green `#00b140`; key with `node scripts/key-pose.js`.

## 4. Mouth-shape cue cards
- `coach/mouth/<SOUND>.png` — e.g. `R.png`, `S.png`, `TH.png`.
  Shown as a gentle hint after a few tries on the charge screen.

## Parked paths (loaders exist, but the pages are off the kid flow — skip for now)
- `coach/<game>/bg.png` for: grocery, racer, whack, cupstack, train, match,
  bubble, chat, builder — parked prototype games.
- `coach/worlds/<id>-bg.png` (world.html) and `coach/map/*.png` — the old
  campaign map. Note the `-bg` suffix; plain `coach/worlds/<id>.png` loads nowhere.

## Not hooked (needs a code change first — ask before generating)
- Backdrops behind the 5 arcade games (slice/tiles/stack/run/glide) and the
  charge screen: these draw gradient/canvas backgrounds in code today.

## Notes
- Transparent art: generate on flat green `#00b140`, object centered, clear of
  the edges; keyed with `scripts/key-pose.js`.
- Backdrops/scenes: full image, no transparency.
- Mascot/character poses: parked (Leo ships as `coach/leo.png` + poses/).
