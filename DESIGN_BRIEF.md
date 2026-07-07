# Sona design brief — for any design session/tool

Paste this (plus screenshots) into the design session. Anything produced to
these specs drops straight into the app with zero rework.

## Product in one line
Kids' (3-8) speech-practice arcade: say your sound → games load/revive.
Style: flat vector, thick rounded shapes, Duolingo/Toca-Boca warmth. No text
baked into art — code draws all words, buttons, numbers, locks, UI.

## Brand tokens
- Fonts: "Baloo 2" 700/800 (display), "Nunito" 600-800 (body)
- Core colors: blue #1cb0f6 / #1597d4 · green #58cc02 / #46a302 ·
  orange #ff9600 / #e08600 · gold #ffd21c · ink #3c3c3c · street #5b6a76
- Shape language: corner radius 12-26px, chunky 0 5px 0 button shadows,
  soft top-left light, same-hue shading (no outlines, no gradients on small shapes)
- Mascot: Leo the lion (public/coach/leo.png) — never redraw him, place him

## Deliverable formats (best → acceptable)
1. **SVG markup** — the gold standard. Scenes: viewBox "0 0 440 780",
   bottom-anchored (street strip at y648-780), hero centered x220,
   neighbor slivers cropped at edges. Sprites: viewBox "0 0 100 100",
   subject centered, clear of edges. I paste these directly into
   public/scenes.js / game sprite tables.
2. HTML/CSS mockups of screens — I translate to the real pages.
3. PNG only for painterly raster scenes: 1024×1536 (2:3), no transparency,
   hero in the center ~70% (tall phones crop the sides), no text/UI/characters.

## Current state (reference source of truth)
- public/scenes.js — the whole vector city in one self-contained file
  (palette table + shape kit + 7 hero builders). Paste it into the design
  session as the style reference and starting point.
- public/coach/ART_MANIFEST.md — file-drop contract for any raster art.
- Live app: speaksona.com (branch previews look identical).

## Open art wishlist
- Scene upgrades: any of the 7 heroes richer (props, awnings, signage)
- Vocabulary pictures: coach/items/<word>.png or 100×100 SVGs (rabbit, cake…)
- Mouth-shape cue cards: coach/mouth/<SOUND>.png, friendly diagram style
- Story Time backdrops: coach/story/lvl1-10.png, full-bleed 9:16
- Piano Tiles / Block Stacker in-game sprite sets (100×100 SVGs)

## Hard rules
- Scenery only — anything tappable or with text is built in code
- No characters in scenes (Leo is placed by code)
- Kid-safe, bright, nothing scary; consistent palette above
