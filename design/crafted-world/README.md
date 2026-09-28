# Sona: crafted-world redesign

User direction, 28 September 2026: redesign the family app to match these exact concept boards, including a complete onboarding redesign. This replaces the speech-check task for this session.

## Current implementation — 28 September 2026

Travis explicitly expanded this work to the full family app and removed the 20-minute session cap. Books remain owned by the other worktree. The earlier batch notes below are historical; this section describes the current branch.

- **Home:** illustrated landscape cards for the seven released games, cream title strips, a wide Glide card, and horizontal Feed Echo/Hoops cards. Age ordering, all existing catalog entries, parked-game availability, parent gates and the Books link keep their existing behavior.
- **Onboarding:** every setup step uses the crafted palette and artwork. The purpose-selection page is removed; sound choices are large letters only with R selected first. Name/age and email controls stay reachable with a keyboard. Email is optional and has a close control. The latest main-branch flow is retained: younger children enter Feed Echo, older children enter Fruit Slice practice, and clinician setup ends at Home. The existing first-game offer and free-mode rules remain intact.
- **Practice and games:** Fruit Slice, Piano Tiles, Block Stacker, Sound Sprint, Flappy Glide, Feed Echo and Hoops receive the new scenery, controls, character treatment, retry and finish surfaces. Fruit, runner and balloon artwork replace flat drawings where appropriate. The new main-branch multi-round game behavior and Apple speech-check integration are retained; the redesign adds presentation without replacing those rules.
- **Feed Echo:** all 294 existing word-bank entries have matching object illustrations in 33 transparent WebP atlases. Per-word crops are validated and preserve aspect ratio. This changes pictures, not vocabulary or answer rules. Atlas loading is on demand through the displayed choices, not an all-at-once download.
- **Family screens:** settings, progress, customization, stickers, plans/trial, voice selection and family invitation use the same visual system. Consent, purchase/restore, free-mode and sharing behavior are preserved.
- **Books:** no book pages, content, assets, generator, reader or shared Sona files are edited. Coming-soon games remain parked.

### Review

`app-preview.html` contains 32 actual app screenshots grouped by Home, Onboarding, Practice, Games and Grown-ups. The local review URL is `http://127.0.0.1:8259/design/crafted-world/app-preview.html`; live app pages use port 8258. These require the local preview servers to remain running.

Artwork is production WebP. The former welcome PNGs were converted, and every active consumer was updated. Scene/mascot/game-object art totals approximately 1.9 MB; all word atlases together total approximately 10 MB. Each game fetches only its own imagery. Source paths, crop maps and generation briefs are recorded in the adjacent asset documents.

### Verification status

Browser checks cover 320×568 and 393×852 layouts, simulated native safe areas, keyboard space, menus, parent gates, game entry, listening/earned pieces, retry/finish, and family screens. The comprehensive release battery is being completed on isolated test ports to avoid interrupting other worktrees. TypeScript passed. The new illustration-coverage check and onboarding layout regressions were demonstrated failing against their pre-fix versions.

Physical-device keyboard, audio routing and visual review remain necessary before release; desktop simulations do not replace them. No merge or production release is authorized for this redesign.

---

## Original artwork

All five source PNGs were recovered from `/Users/traviswardrop/.codex/generated_images/01a0e0be-c91e-7a82-88ba-8bea7061dcdf/` and copied unchanged into `references/`. Each original is 1536 × 1024. Board 05 matches the supplied screenshot. Board 01 is an earlier version of those same three screens, not three additional screens. No original onboarding board was found.

| Saved board | Original filename | Screens |
| --- | --- | --- |
| 01-library-practice-feed-original.png | exec-714df3ee-54bc-4d72-bf52-d178080366fa.png | Home, practice, Feed Echo (earlier) |
| 02-fruit-stack-piano.png | exec-9c457009-d90c-48fc-8e2b-a6b5ef28e35b.png | Fruit Slice, Block Stacker, Piano Tiles |
| 03-sprint-glide-retry.png | exec-7345e630-95ce-4bc1-996e-88147e26e37f.png | Sound Sprint, Flappy Glide, retry |
| 04-grownups-and-results.png | exec-b9e256b1-42ee-4fca-aa89-a82cf46949ad.png | Parent overview, settings, results |
| 05-library-practice-feed-final.png | exec-2f140596-d422-4dd6-9df2-0708ac4febda.png | Home, practice, Feed Echo (final reference) |

## Ownership boundary — 28 September

**Books are owned by another worktree. Do not edit book pages, book content, book artwork, reader logic, or book-generation tools in this redesign branch.** Travis explicitly assigned this chat games, onboarding and the main homepage only. A Books link on Home must preserve its existing behavior.

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
6. Grown-up overview/settings and results using board 04. Books are excluded and belong to the separate books worktree.

For each batch: verify native safe areas, small phones, keyboard, reduced motion, selected/disabled/loading/error states and intended game behavior. Run full `node tests/run-all.mjs` and TypeScript check before any push. Merge only on Travis’s explicit instruction.

## Welcome artwork prompt

Built-in image generator; board 05 supplied as reference; opaque 1024 × 1536 portrait output. Create a standalone production orchard scene, faithful 3D handmade/clay-toy storybook Echo, soft daylight, tactile foliage, orange trees, small white fence, daisies, sandy path. Echo full-body centered in lower-middle waving; upper 35% calm sky for real HTML text; lower 15% sandy space for controls. No lettering, UI, microphone, cards, phone frame, watermark or additional mascot. Character: round cyan/teal body, coral-red/yellow crest, white eyes/navy pupils, golden-orange beak and feet, cyan belly, pink cheeks, darker teal wings. The exact tool invocation remains in the chat history.

Session started 15:32:44 UTC; maximum deadline 15:52:44 UTC. Work was intentionally limited to recovery and a first welcome-screen implementation.


## Second batch — onboarding visuals (28 September)

Start 15:49:04 UTC, hard deadline 16:09:04 UTC. Only onboarding files, onboarding tests, onboarding assets and these design notes changed. No shared application code or books changed.

- Added transparent crafted Echo artwork at `public/assets/crafted/echo-welcome.png`, generated with built-in image generation using board 05 as reference. Source: `exec-45e14ae6-4e0c-4455-8d51-ab488e0ba386.png`. Prompt: a single faithful full-body front-view cutout of the reference’s round teal clay/storybook Echo; coral/yellow crest, white/navy eyes, pink cheeks, cyan belly, gold beak/feet, one raised wing; transparent alpha, centered, no scene, text, UI, props, floor or extra character. Exact invocation is in chat history.
- Restyled name/age, sound choices, microphone, optional email, build transition and microphone-denial recovery. Cream cards, teal selection/actions, cocoa text; visible labels for name and email.
- Large sound letters only; R remains selected first, followed by S, L and TH. The longer TH(v) choice spans two columns to avoid wrapping.
- On short viewports, redundant decorative header artwork is hidden to leave room for real controls. Keyboard layouts retain scrolling for focused inputs, visible Continue/skip controls, and the email close button.
- Existing permission, skip, profile, clinician path, free/paid behavior and completion destination are unchanged. The desired future first-game handoff still needs separate implementation; today’s setup continues to Home.
- `onboarding-preview.html` shows the actual rendered screens. The `onboarding/` folder includes 393×852 and 320×568 screenshots, microphone recovery, and 393×430 keyboard space.
- Final onboarding suite: 77 assertions passed. Fixed a delayed autofocus race that could reopen the keyboard after a quick Done press; the new deterministic regression failed before the fix and passed afterward. Syntax check and git diff whitespace check passed. Additional visual-flow checks passed for both phone sizes and keyboard layouts with no runtime errors. At 320×568, optional content/recovery may still scroll inside the page; controls stay visible. Real iPhone keyboard and safe-area testing remains required.

The next implementation batch is the main game library, followed by individual games. Before pushing, run the full release battery and TypeScript check. No merge/release has been requested for this redesign.
