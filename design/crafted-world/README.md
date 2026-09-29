# Sona crafted-world redesign

Current implementation: 28 September 2026, branch `codex/crafted-redesign`.

The local family app now follows the five recovered concept boards: warm ivory surfaces, cocoa headings, teal controls, illustrated scenery and tactile game objects. The full active non-book surface is implemented. It is not merged or deployed. Original boards remain unchanged in `references/`.

## Included

- **Home:** illustrated cards for all seven released games, age-appropriate ordering, parent gate, resume state and preserved Coming Soon entries.
- **Onboarding:** welcome, name/age, large letter-only sound choices with R first/preselected, microphone, optional email with close control, and first-game transition. No “What brings you here?” step. Keyboard and microphone-denial states are included.
- **Practice:** all five arcade charging scenes, active microphone/replay controls, earned objects, permission recovery, pause, retry, completed adventure and illustrated treasure rewards.
- **Games:** Fruit Slice, Piano Tiles, Block Stacker, Sound Sprint, Flappy Glide, Feed Echo and Hoops. Each retains its distinct gameplay, scoring, assistance and speech checkpoints. Fruit Slice has its original market setting; Piano has carved keys; Stack has wooden blocks and a rocket; Sprint has painted obstacles; Glide has leafy hedges; Feed has its picnic and all 294 word illustrations; Hoops has a painted court and actual swipe shooting.
- **Family screens:** progress, settings, customization, Sticker Book, plans/trial, voice selection and family invitation. Optional consent, purchases/restoration, free mode, saved choices and profile isolation are preserved.

Books remain owned by the separate books worktree. No book pages, content, artwork, reader or generation files were edited. The twenty parked games remain Coming Soon; their inaccessible screens were not reactivated as part of a visual redesign. Speech scoring and ElevenLabs content were not redesigned or represented as newly verified by this work.

## Review locally

- [Full screen review](http://127.0.0.1:8259/design/crafted-world/app-preview.html): 38 current screenshots, grouped by Home, Onboarding, Practice, Games, Game breaks and Grown-ups.
- [Live onboarding](http://127.0.0.1:8258/onboarding.html)
- [Live game library](http://127.0.0.1:8258/today.html)
- [Original five boards](http://127.0.0.1:8259/design/crafted-world/index.html)
- [Fruit Slice comparison and real gameplay recording](http://127.0.0.1:8259/design/crafted-world/fruit-slice-review.html)

Local URLs require the preview servers to stay running. Practice screenshots use a simulated microphone; earned-piece screenshots are documented example states. Game playthrough checks use actual taps/swipes. No screenshot is used as the app interface: controls, game objects, scoring and text remain real HTML/canvas elements.

## Verification

All 63 regression suites passed with zero failed suites. TypeScript and whitespace checks passed. The battery used unchanged test assertions with isolated local server ports. After the final shared portrait integration, the affected child flow (37 checks), customization (30), Sprint (20), Glide (17), Home captures and all five practice scenes were checked again. Focused checks also covered Slice (26), Piano (21), Stack (29), Hoops (34) and parent progress (33). Phone checks cover 393×852 and 320×568, simulated native safe areas, keyboard layouts, earned pieces, retries, finales, save/reload and family screens. See `final-validation.json` for the suite results.

Physical iPhone verification of keyboard behavior, microphone recognition and speaker levels remains a release check. Browser simulation does not establish real-device speech accuracy. The redesign has not changed purchase or free-mode policy.

## Visual source notes

- `fruit-market-v2.md` — Fruit Slice source and renderer correction.
- `piano-v2.md` — stage and shared timber texture.
- `stack-v2.md` and `stack-v2-assets.json` — blocks, workshop and rocket.
- `sprint-glide-practice-v2.md` — sprite atlas, hedges, practice materials and reward renderer.
- `hoops-v2.md` — court, ball, word art and live-shot checks.
- `customize-v2.md` and `customize-v2-assets.json` — landscapes, buddy presentation and selection checks.
- `implementation-history.md` — earlier batch notes and source-board filenames; historical statements there do not override this current handoff.

Maintain the user’s ownership boundary: do not edit books while continuing this branch. Review the current repository instructions before merging or releasing.
