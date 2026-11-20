# Sona native design review

This is the review log for the family app branch `codex/sona-native-family`. Update it whenever a visible design or interaction changes. Travis and Rachel review it before the rebuild ships. The preview has a separate app identity.

## Current native preview

| Area | Design change | Review status |
| --- | --- | --- |
| First launch | Short illustrated welcome, Explore first shortcut, and optional choice of Echo, Pip, or Hops. The welcome leads to Home so the child can choose an activity. | Preview |
| First launch | The therapist-issued family login takes priority on the opening screen. It uses the existing server and existing sharing decision. Its live dashboard test is in progress. | In development |
| Home | Sona wordmark and selected buddy, Grown-ups and collection in the header, a Games entrance and direct Books and Practice entrances. The selected sound is read-only on Home. | Preview |
| Navigation | Four native tabs for Home, Games, Books and Practice. Games open in full-screen rounds. | Preview |
| Books | A native illustrated shelf and reader using the existing titles, page text, and artwork. The shelf filters to the selected sound and respects seasonal availability. A bookmark reopens the last page. The review build has manual page turning. | Preview. Spoken book prompts, gates and paid-access parity still need their existing behavior. |
| Practice | A native visual tile for hearing the selected sound, using the current authored sound models. A Grown-ups link appears before a sound is picked. Listening to the model in this preview records zero reps. | Preview. Full practice, cues and verified speech behavior are release requirements. |
| Grown-ups | A native sheet with the four-number-word check, a sound picker and a true game completion line. The scope is preview preferences. | Preview. Existing family profiles, account controls and practice reporting still need parity. |
| Games shelf | illustrated native cards, All games and No rush filters, and a mark on games that actually finished. | Preview |
| Play collection | The chest opens a native list of games completed in this preview. | Preview. Existing awards, Trophy Road and per-child reward balances are release requirements. |
| Fruit Slice | Original orchard art, an opening fruit, a short swipe round, haptic and visual slice feedback, a final giant watermelon and replay. | Gameplay preview. The existing speech and round entry rules still need parity. |
| Flappy Glide | Native tap flight through moving gaps, collisions, hearts and replay. | Gameplay preview |
| Rise Up | Native drag shield and falling blocks with real deflections and retry. | Gameplay preview |
| Bubble Pop | Two rounds of bobbing bubbles and native tap feedback. | Gameplay preview |
| Peekaboo | Three doors shuffle over a picture, then the child chooses the door. Three finds finish the round. | Gameplay preview |
| Dino Dig | Rub the sand to uncover bones or use the accessible brush control. | Gameplay preview |
| Piano Tiles | Highlighted native keys guide a short melody, and each key plays a synthesized note. | Gameplay preview |
| Block Stacker | A moving block drops over the stack. Six aligned blocks finish the round. | Gameplay preview |
| Hoops | Swipe toward a moving hoop, with a timing control for a straight shot. | Gameplay preview |
| Soccer Goal | Swipe into the goal away from the moving keeper. | Gameplay preview |
| Sound Sprint | Move between three lanes to catch stars, with tap, swipe and labeled lane controls. | Gameplay preview |

## Release checks

- Existing profile, progress, homework, settings, rewards, paid purchases, and every free-era and founding-family promise survive same-device upgrade and repeated launches. Test with fixtures from every supported legacy path, then verify an actual in-place update.
- Check prices, billing periods, eligibility, and restore against the existing App Store and RevenueCat products. Use the current server decision for clinician coverage. Keep old paid and earned access.
- Preserve the current approved words, cue audio, speech timing, rep rules, and Rachel's wording. Keep microphone audio entirely on-device and in memory. Keep existing sharing consent and withdrawal behavior.
- Test the live therapist login from the first screen with a disposable dashboard-created credential and verify consent, access, relaunch, and password change. Keep credentials out of source, transcripts, and test artifacts.
- Approve the design log before merging, then wait for Travis's explicit “merge.”

## Therapist login additions

- The first welcome screen adds a dedicated “I have a login from my speech therapist” button. Grown-ups also offers that same path after the adult check.
- Username and password open in a native form. The existing sharing disclosure and Yes and No decisions appear after successful sign-in. A pending sharing decision survives a restart.
- The game and book cards use the clinician coverage response. Covered content opens directly, with no offer shown in the login flow. The separate preview still contains only the currently built native games.
- Settings shows the connected username and a Change password form. Passwords stay in memory only while submitted to the current Sona server. The verified device ticket is kept in this device’s Keychain.

The signed iPhone Simulator build was exercised with fictional credentials. The test reached the sharing choice, restarted at that choice, then confirmed an enabled covered game. A connected session opened an included book and completed the Change password form against the local fixture. The endpoint contract passed 32 mocked assertions. Live dashboard verification is pending a disposable covered clinician login.
