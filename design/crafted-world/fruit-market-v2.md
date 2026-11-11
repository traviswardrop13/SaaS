# Fruit Slice market scene, revision 2

Generated with the built-in imagegen tool on 2026-09-28.

- Reference: `references/02-fruit-stack-piano.png`, left Fruit Slice panel. Original preserved unchanged.
- Generated source: `/Users/traviswardrop/.codex/generated_images/01a0e9e0-7ac5-7820-ab1f-6abd92556547/exec-cc9748de-c1b3-49e0-ad77-b5afffcb7d36.png`
- Source dimensions: 887 × 1774.
- Production asset: `public/assets/crafted/fruit-market-v2.webp`, 768 × 1536, WebP quality 88.

## Observed geometry

Coordinates are fractions of the uncropped source image. Scale the scene to the same full portrait playfield as the game canvas.

- Primary animated fruit area: x 0.20–0.80, y 0.15–0.62, with the middle remaining clear to y 0.69.
- Fox silhouette: x 0.025–0.385, y 0.62–0.82; face center approximately (0.21, 0.72).
- Echo silhouette: x 0.60–0.985, y 0.625–0.835; face center approximately (0.81, 0.74).
- Counter ledge / characters' feet: y 0.81–0.83. Crates and counter fill bottom 19%.
- Blank plaque outer frame: x 0.19–0.81, y 0.865–0.975. Safe dark inner writing area: x 0.25–0.75, y 0.895–0.942; suggested centered instruction baseline y 0.929.

The supplied prompt requested heads around 70–77%; the visible ears/crest extend to ~62%, while faces land around 72–74%. No HUD, text, phone frame, or flying fruit is painted into the scene. Decorative fruit remains in the lower crates and edge trees.

## Final prompt

Use case: illustration-story.
Asset type: finished edge-to-edge portrait background painting for a real children's Fruit Slice game. Output a tall 1024x2048 portrait image (1:2).

Input image is a STYLE AND COMPOSITION REFERENCE ONLY. Recreate the LEFT Fruit Slice panel's tactile painted wooden market world and the two particular original characters. Deliver a new full-bleed game scene alone, never the three-phone board. No phones, frames, headings, captions, HUD, score, hearts, buttons or any lettering.

Scene: bright blue sky fading into warm buttery golden sunshine down the center. Orange trees with layered matte painted leaves hug the left and right edges, cropping outside the frame, and tasteful fluffy clouds at the periphery. Tiny softly painted orchard village and fencing low in the distance. This should have a warm handcrafted toy-world texture: painterly wood grain, brushed foliage, matte clay-and-wood character material. It must closely resemble the left reference rather than polished plastic or photorealism.

Composition with deliberate normalized anchors:
- Keep central x20%–80%, y15%–65% mostly open sky for animated fruit to fly. Do not paint any floating/sliced fruit, droplets or action lines there.
- The smiling little orange fox appears prominently at lower LEFT, x8%–35%, head around y70%–77%, paws resting on counter at y83%–84%. Match the reference fox: warm orange ears and fluffy cheeks, white muzzle/chest, dark-brown paws, gleeful open smiling mouth, sweet dark round eyes.
- Original cyan/teal Echo bird at lower RIGHT, x65%–92%, head around y70%–77%, golden feet on counter y83%–84%. Match reference: plump rounded cyan body, pale aqua belly, orange/yellow beak and feet, two coral-and-golden top feathers, two flipper-like wings, large friendly eyes and pink cheeks. Both characters wholly readable, not giant and not cut off.
- Wide rich wooden counter and foreground market crates span the entire bottom 18% of frame; realistic painterly honey wood grain and rounded corners, fruit like orange/watermelon/apple nestled inside those bottom crates only.
- A blank dark charcoal wooden-framed instruction plaque centered near y92%, about 55% frame width and 7% frame height, sits in front of the crates. Leave it completely blank so live code can draw the instruction.

Avoid: all text and numbers, UI, frames, logos, floating fruit or static gameplay objects, empty sandy-ground foreground, large flat gradients, generic shiny plastic, replacing the two characters with different mascots, clutter in the main play area. This is the finished background asset, not a screenshot or mockup.

## Implementation and validation

The scene is beneath the live canvas. Real HUD controls, instruction text, fruit stock, slicing and score remain code-driven. Static illustrated companions replace the old tiny hopping character on this screen. No new character animation is claimed. Fruit alpha bounds are cropped at draw time without changing collision geometry, trajectories, speech gates or round rules.

- Slice regression: 26/26 assertions passed.
- Microphone-quiet game regression: 315/315 assertions passed.
- Pointer gameplay at 393×852 (safe insets 59/34) and 320×568 (20/0): no runtime errors, missing assets or document overflow.
- `fruit-slice-v2/actual-gameplay.webm` is normal-speed pointer gameplay, muted, with an existing-profile/earned-entry fixture to reach the game. No fake fruit or scores were injected.
- `fruit-slice-v2/checks.json` records capture results.
- Full release battery and physical iPhone check still required before publication. No push or release performed.
