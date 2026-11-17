# Onboarding final review

The prior crafted-world onboarding was retained. This pass corrected two remaining phone-layout problems:

- Sound selection overlapped the Continue footer or scrolled unnecessarily when the real iPhone top/bottom safe areas were included. Its header and card spacing now fit 393×852 (59/34 insets), 375×812 (50/34), and 375×667 (20/0). Letters and tap areas stay large.
- At the name step, the keyboard covered the age choices. Compact keyboard-only spacing now keeps the name and age choices above Continue.

The existing short setup flow, default R, sound ordering, privacy text, microphone permission handling, optional email skip, saved answers, and Home destination remain intact. No book files or shared app logic changed.

## Verification

- `node tests/onboardingtest.mjs`: 85 assertions passed (exit 0).
- The new sound safe-area assertions failed against the pre-fix CSS on all three sizes.
- The new keyboard assertion failed before its spacing fix, with the age row below Continue.
- All 14 saved visual captures have no horizontal overflow and retain the primary button on screen. Smaller 320×568 layouts and permission recovery may scroll internally.
- Chromium browser capture with native bridge/permission fakes; a physical iPhone pass is still required for actual iOS keyboard/permission presentation.

Open `index.html` to compare the screens.
