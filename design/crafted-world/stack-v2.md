# Block Stacker: original board fidelity pass

Implemented September 28, 2026 in `public/arcade-stack.html` and the new page-scoped `public/crafted-stack.css`. No shared game CSS, speech rules, entitlement logic, other games or books were edited.

The original middle screen in `references/02-fruit-stack-piano.png` remains the reference and is unchanged. The new scene restores the two cheering characters, a warm wooden workbench and blank chalk plaque against the moonlit village. The eight real block sprites have visible grain, paint wear and bevels. A few blocks have friendly faces. The active block floats above a dotted landing line and warm overlap glow; these are visual guides only. The finale uses a painted toy rocket carrying Echo.

## Behavior retained

Three floors of 5, 6 and 7 blocks; five starting blocks from practice; 60% minimum width; close-drop snap; slower/wider assistance after misses; golden block width restoration; speech cards between floors; all audio quiet rules, scoring, saved best, token consumption and rocket launch/automatic launch are unchanged. No scoring or input code was replaced.

The visual tower base is aligned with the new table at 80% of the portrait height. Canvas rendering narrows horizontally around the center to fit between the helpers, without changing the underlying drop positions or snap windows. Block height now scales with screen height (30–52 px), preserving comfortable proportions on both phones. Scrolling lower blocks are clipped behind the workbench so they never cover the instruction plaque. The original instruction and praise now render on that plaque instead of covering moving blocks.

## Assets and sources

`stack-v2-assets.json` contains all three exact imagegen prompts, source paths, and the eight block extraction rectangles. Built-in imagegen was used; sources are retained under the Codex generated-images directory. The original reference board was not cropped or altered.

Production assets in `public/assets/crafted/`:

- `stack-workshop-v2.webp`: portrait scene, 768×1536, 79,842 bytes.
- `stack-block-{coral,orange,yellow,green,blue,purple,pink,gold}-v2.webp`: eight transparent sprites, 480 px wide, about 197 KB combined.
- `stack-rocket-v2.webp`: transparent painted rocket, 267×400, 20,246 bytes.

Approximate total art transfer: 297 KB. All sprite code retains a painted canvas fallback while an image loads or if it fails.

## Verification

- `tests/stacktest.mjs`, unchanged assertions, run on isolated port 28364: **29 passed**, exit 0. It plays all three floors, checks snap/miss/width assistance, both speech checkpoints, rocket tap and automatic launch, quiet mic/audio behavior, token consumption, and runtime errors.
- Focused Chromium touch QA at **393×852** (59/34 px safe areas) and **320×568** (20/0 px safe areas): five real touch taps land five blocks, the actual floor-two speech card opens and fits within the safe area, then the existing simulated-heard path closes the card. The rocket is then staged for its visual capture and launched by a real tap. No horizontal overflow and no page exceptions on either phone.
- Final captures and logs: `stack-v2/` (initial, after three taps, floor card, rocket, finish, both sizes).
- `git diff --check -- public/arcade-stack.html`: passed.

The focused QA stages the rocket after the first floor for screenshots; the separate regression suite verifies the full eighteen-block route to it. Physical iPhone audio/input verification remains a release check. No full battery, push or commit was performed by this subtask; the parent task owns combined verification and release.
