# Sona: crafted-world redesign

User direction, 28 September 2026: redesign the family app to match these exact concept boards, including a complete onboarding redesign. This replaces the speech-check task for this session.

## Original artwork

All five source PNGs were recovered from `/Users/traviswardrop/.codex/generated_images/01a0e0be-c91e-7a82-88ba-8bea7061dcdf/` and copied unchanged into `references/`. Each original is 1536 × 1024. Board 05 matches the supplied screenshot. Board 01 is an earlier version of those same three screens, not three additional screens. No original onboarding board was found.

| Saved board | Original filename | Screens |
| --- | --- | --- |
| 01-library-practice-feed-original.png | exec-714df3ee-54bc-4d72-bf52-d178080366fa.png | Home, practice, Feed Echo (earlier) |
| 02-fruit-stack-piano.png | exec-9c457009-d90c-48fc-8e2b-a6b5ef28e35b.png | Fruit Slice, Block Stacker, Piano Tiles |
| 03-sprint-glide-retry.png | exec-7345e630-95ce-4bc1-996e-88147e26e37f.png | Sound Sprint, Flappy Glide, retry |
| 04-grownups-and-results.png | exec-b9e256b1-42ee-4fca-aa89-a82cf46949ad.png | Parent overview, settings, results |
| 05-library-practice-feed-final.png | exec-2f140596-d422-4dd6-9df2-0708ac4febda.png | Home, practice, Feed Echo (final reference) |

## Visual contract

Warm ivory `#fff6e9` base, deep cocoa rounded headings, soft brown text, teal primary controls, subtly raised cream cards, and detailed tactile storybook scenery. Echo is a plump cyan bird with coral/yellow crest, pale cyan belly, pink cheeks, navy pupils, and golden-orange beak/feet. Artwork must match the boards rather than reuse the current flat icon assets. Keep real HTML controls and game objects separate from illustrated scenery. No screenshot-as-interface, emoji substitutes, made-up progress or decorative fake controls.

The reference images are visual directions, not functional specifications: current available games, books, age ordering, purchase entitlements, speech rules, privacy protections, and parent gates must keep working. Do not park Books merely because the older mockup shows Coming soon.

## Completed first batch

- Recovered all five originals and made `index.html` a reference gallery.
- Created `public/assets/crafted/welcome-orchard.png` using built-in image generation with board 05 as the strict visual reference. Original generated file is `exec-9e5ca9f0-664a-4f88-9195-e421da35cb28.png` in this chat’s generated_images directory. No original image was modified.
- Updated only the welcome screen’s visual presentation in `public/onboarding.html` and a scoped `public/onboarding-crafted.css`. The rest of the onboarding flow remains functional and unchanged.
- Captured `welcome-iphone-preview.png` at 393 × 852. Existing onboarding suite: 75 assertions passed, including name/age, R default, sound selection, permissions, skip, keyboard, backup restoration and phone fit.
- Local preview: http://127.0.0.1:8258/onboarding.html (only available while its local server runs).

This is a local first-screen implementation, not the completed app redesign. No push, merge or release. Full release battery and real iPhone verification remain required.

## Next batches

1. Finish onboarding visuals: name/age, sounds, microphone, optional email, transitions and keyboard layout. A question was sent about the proposed short flow welcome → name/age → sounds → microphone → Fruit Slice, with optional email. Current implementation still ends at Home. Pricing must remain as currently authorized; do not introduce a paywall incidentally.
2. Home library (`public/today.html`): create faithful landscape artwork for cards, use title strips and a wide Glide card, horizontal Feed Echo row. Preserve all current catalog entries and gates. Existing marketing game WebPs are flat icons and do not match these references.
3. Fruit Slice practice (`public/charge.html`) then its game (`public/arcade-slice.html`): orchard layers, Echo, tray, fruit, HUD, microphone and spoken prompts. Practice screen and game are distinct surfaces.
4. Feed Echo picnic: background, plate, character states and clear illustrated choices.
5. Each remaining released game: distinct background, play objects, UI and results matching its board. Preserve playable mechanics.
6. Grown-up overview/settings and results using board 04. Extend same visual system to books when reached; no existing book redesign board was recovered.

For each batch: verify native safe areas, small phones, keyboard, reduced motion, selected/disabled/loading/error states and intended game behavior. Run full `node tests/run-all.mjs` and TypeScript check before any push. Merge only on Travis’s explicit instruction.

## Welcome artwork prompt

Built-in image generator; board 05 supplied as reference; opaque 1024 × 1536 portrait output. Create a standalone production orchard scene, faithful 3D handmade/clay-toy storybook Echo, soft daylight, tactile foliage, orange trees, small white fence, daisies, sandy path. Echo full-body centered in lower-middle waving; upper 35% calm sky for real HTML text; lower 15% sandy space for controls. No lettering, UI, microphone, cards, phone frame, watermark or additional mascot. Character: round cyan/teal body, coral-red/yellow crest, white eyes/navy pupils, golden-orange beak and feet, cyan belly, pink cheeks, darker teal wings. The exact tool invocation remains in the chat history.

Session started 15:32:44 UTC; maximum deadline 15:52:44 UTC. Work was intentionally limited to recovery and a first welcome-screen implementation.
