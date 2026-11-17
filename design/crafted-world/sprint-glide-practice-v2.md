# Sprint, Glide and practice artwork — 28 September 2026

The live games follow the original `03-sprint-glide-retry.png` board. The character, scoring, obstacle footprints, controls, speech checkpoints and round progression remain unchanged.

## Visual changes

- Sound Sprint uses painted toy obstacles, gold coins and three kinds of passing trees. The illustrated roadside remains visible. The default fox runs at a clearer size.
- Flappy Glide uses dense painted foliage instead of cylindrical pipe surfaces. The balloon retains its proper artwork aspect ratio. The chosen buddy sits behind the basket rim. SVG portraits now have the required namespace when decoded as canvas images, avoiding the previous emoji fallback.
- Fruit, Piano and Stack practice rewards use the same painted wood material as gameplay. Glide practice uses the same balloon as its game.
- Treasure-chest rewards use the identical SVG illustrations as the Sticker Book through `crafted-rewards.js`.
- Feed Echo already matched the approved picnic direction; it was checked at both phone sizes without changing its word pools or scoring.

## Generated source and asset preparation

Built-in ImageGen was used with the original Sprint/Glide/retry board as a visual reference. These are source/provenance notes, not reconstructed verbatim prompts.

- Foliage direction: dense, seamless, softly modeled matte leaves in varied warm greens, small white daisies, no pipe caps, characters, lettering or UI. Source: `/Users/traviswardrop/.codex/generated_images/01a0c118-8a57-7ac3-8eb5-db31649118c4/exec-1b96fde8-31ee-4627-a098-00ce426400bc.png`. Optimized to `public/assets/crafted/hedge-leaves-v2.webp` at512 square.
- Sprint sprite direction: transparent3×3 atlas of tactile painted toys—rock, cactus, traffic cone; horizontal log, star coin, leafy tree; palm, pine, daisy bush. Strong silhouettes with separate transparent cells. Source: `/Users/traviswardrop/.codex/generated_images/01a0c118-8a57-7ac3-8eb5-db31649118c4/exec-4aed3ed3-29ac-486c-8b2b-4963a7543247.png`. Cropped to individual `run-*-v2.webp` sprites at256 maximum dimension; alpha borders trimmed to avoid neighboring cells.
- The practice balloon is a resized crop of the existing `balloon-craft.webp`; no new character or scenery was generated for it.
- Practice timber reuses `painted-wood-ivory.webp`; see `piano-v2.md` for its source.

## Verification

Focused Sound Sprint test:20/20 assertions; focused Flappy Glide test:17/17 assertions. Both completed real round logic with preserved microphone/audio boundaries. Browser phone captures use393×852 with59/34 safe areas and320×568 with20/0 safe areas. Actual lane taps and balloon taps were exercised. All12 initial layout captures had zero overflow, missing assets or JavaScript errors. Final full-suite results are recorded in the main redesign handoff.

Browser checks simulate speech input and device safe areas; they do not establish real iPhone microphone accuracy or perceived speaker volume.
