# Piano Tiles — reference fidelity pass, 28 September 2026

The rightmost Piano Tiles screen on `references/02-fruit-stack-piano.png` is the visual source. This pass replaces the smooth candy-button look with the reference's painted wooden objects and rich theater curtains. It does not change lane widths, note tile height, hit regions, the keys' hit line, note timing, the four songs, sound volume, the speech cards, rewards or finale.

## Production assets

- `public/assets/crafted/piano-stage-v2.webp`: 800 × 1600 illustrated stage, displayed edge to edge without cropping out curtains. New sibling; old stage remains available.
- `public/assets/crafted/painted-wood-ivory.webp`: 512 × 512 neutral material. Canvas caches tinted variants once, then clips them to live objects. Also available for matching wooden practice objects.
- `public/crafted-tiles.css`: page-only background and compact song HUD.
- `public/arcade-tiles.html`: tactile ivory/ebony keys, coral/lavender/green/gold note tiles, drawn musical symbols, carved colored edges, actual tap glow and sparkles. Decorative Echo no longer sits over a playable lane; speech and finish cards retain Echo.

Both images were generated with the built-in imagegen tool. Source images remain untouched in:
`/Users/traviswardrop/.codex/generated_images/01a0e9df-6f27-77a2-9a2b-9a6e99f0ffac/`

### Stage prompt

Source: `exec-c3a9a9e2-d71e-49d8-80f5-d5b936f85883.png`.
Reference: `design/crafted-world/references/02-fruit-stack-piano.png`.

> Create a production 2D game background extracted and faithfully expanded from ONLY the RIGHTMOST Piano Tiles phone scene in this reference. Portrait 1024x2048. Match exactly the tactile hand-painted children's storybook aesthetic: rich purple velvet curtains hanging at both extreme sides and short scalloped valance along the top, soft golden theater spotlights from top corners, indigo-violet painted stage backdrop with tiny scattered gold sparkles and a couple large decorative gold stars tucked at outer edges. Central 84% of width is mostly clear indigo-violet for moving game objects; side curtains can be only 8% wide each. Golden wooden floor only in bottom 12% (keys will be drawn there dynamically). Frontal flat game stage view, NOT a phone mockup. Remove all text, numbers, HUD buttons, hearts, piano keys, musical note tiles, note symbols, grid lines, mascot and UI. Reconstruct the empty space cleanly. No labels at all. Keep brush marks, soft dramatic lighting and plush draped velvet. This is the final background for a live playable piano game. Fill the entire image edge to edge without margins.

### Material prompt

Source: `exec-569a6963-21e6-499c-8d34-79969212354e.png`.

> Use case: stylized-concept. Asset type: game material texture to be clipped to hand-painted wooden piano keys, musical note tiles and toy blocks. Create a seamless flat orthographic square material swatch of fine-grained sanded wood under warm neutral ivory paint, with visible subtle horizontal wood fibers, small warm ochre streaks and tactile drybrush painted strokes. Cream/off-white monochromatic, calm material detail, medium-fine scale that remains visible at 90px wide. It must feel like the surface of an artist-painted wooden children's toy, not plastic, not glossy glass, not a photo of raw timber. Even illumination, no direction gradient, no shadows, no edges, no bevels, no objects, no plank divisions, no knots, no writing. Texture fills image fully. Will be tinted coral, lavender, sage green and golden yellow by a live game renderer.

## Checks

- Existing `tilestest.mjs`: 21 assertions passed, exit 0. It plays the songs through actual pointer taps, verifies speech between songs and the waiting finale, checks timing on phone/tablet sizes and watches runtime errors.
- Additional real pointer captures at 393 × 852 (safe areas 59/34) and 320 × 568 (20/0): four taps scored four notes on each, no runtime errors or horizontal overflow.
- Safe-area screenshots are in `/private/tmp/sona-piano-v2-{393,320}-{waiting,tap,playing}.png`.
- Physical iPhone render and sound remain to be reviewed with the user. This scoped work does not publish changes.
