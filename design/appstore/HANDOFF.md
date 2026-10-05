# Handoff: Piano Tiles, Fruit Slice and the App Store screenshots (paused 5 Oct 2026)

Paused by Travis to save Claude usage. Everything below is on branch `games/tiles-slice-appstore`.

## Done (needs one last check, then merge)
- **Piano Tiles: wide notes.** The painted note pictures had empty space around them, so each note showed at half its
  lane's width. `tools/art/cut-tiles.py` reshapes the five paintings; `public/arcade-tiles.html` draws them across the lane.
  Target look: Travis's concept board (Piano Tiles phone: fat rounded tiles, ~85-90% of the lane). Lanes, timing, keys,
  songs, sounds, say-it cards and slow keys are unchanged. `tilestest` and `tilesspeechtest` pass.
- **Fruit Slice: calmer screen.** New background `public/assets/crafted/fruit-market-v3.webp` + `fruit-stand.webp`
  (`tools/art/cut-slice.py`, `public/crafted-slice.css`, `public/arcade-slice.html`): the fox and Echo are about half their
  old size, peeking over a low counter; crates and market stalls are gone; more open sky. Gameplay unchanged.
  `slicetest` and `superslicetest` pass.

## Draft (not reviewed yet)
- **App Store screenshots**, iPhone 6.9" (1320x2868): `design/appstore/draft-2026-10-05/01..08.png`, made from real
  captures by `node tools/appstore/capture.mjs && node tools/appstore/compose.mjs` (copy in `tools/appstore/slides.json`).
  Order: 1 Fruit Slice, 2 practice, 3 Piano Tiles, 4 Hoops, 5 books, 6 Home, 7 Progress, 8 Rachel.

## Left to do
1. Run the full battery (`node tests/run-all.mjs`); fix anything red (`micquietgamestest`, `loadtest`, `craftedarttest`,
   `arcadespeechhelptest`, `arttooltest` touch these games and have not been run on this branch yet).
2. Check every screenshot line against CLAUDE.md (Rachel's exact line, no score/certified/free/prices/game counts, only
   games a child can open, "Audio is never uploaded." never "never recorded"), and that each screen is the real app today.
3. Make the iPad 13" set (2064x2752, the kit supports it) — Apple requires iPad screenshots because Sona runs on iPad.
4. Add a line to CLAUDE.md's Piano Tiles and Fruit Slice sections describing the new look.
5. Merge only on Travis's "merge".

## Prompt for ChatGPT (Codex, with this repo)
> You're picking up paused work in the Sona repo on branch `games/tiles-slice-appstore`. Read CLAUDE.md first (its rules are
> binding) and design/appstore/HANDOFF.md. Then: (1) run `node tests/run-all.mjs` and fix anything that fails because of this
> branch's Piano Tiles / Fruit Slice changes, without changing gameplay, timing or mic behaviour; (2) re-run
> `node tools/appstore/capture.mjs && node tools/appstore/compose.mjs`, look at every slide at full size, and fix anything
> cropped, unreadable, busy or untrue; check every line against CLAUDE.md (Rachel's exact credential line, no
> score/points/certified/free/prices/game counts, "Audio is never uploaded."); (3) produce the iPad 13-inch set (2064x2752,
> no alpha) as well as the iPhone 6.9-inch set (1320x2868); (4) add one plain line each to CLAUDE.md's Piano Tiles and Fruit
> Slice sections about the new look; (5) push the branch and open a pull request, but do not merge — Travis says "merge".
