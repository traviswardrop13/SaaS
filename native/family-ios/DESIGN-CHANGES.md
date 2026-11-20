# Sona native design review

This is the review log for the family app branch `codex/sona-native-family`. Update it whenever a visible design or interaction changes. Travis and Rachel review it before the rebuild ships. The preview has a separate app identity.

## Current native preview

| Area | Design change | Review status |
| --- | --- | --- |
| First launch | Short illustrated welcome, Explore first shortcut, and optional choice of Echo, Pip, or Hops. The welcome leads to Home so the child can choose an activity. | Preview |
| First launch | The therapist-issued family login takes priority on the opening screen. It uses the existing server and existing sharing decision. | Tested with fictional credentials in the iPhone Simulator. Live dashboard verification is pending. |
| Home | The buddy, gift chest and Grown-ups stay in the header. A large illustrated Today’s adventure card leads, with Games and Books directly below. The selected sound is read-only. The screen fits without scrolling at ordinary text sizes and scrolls as needed for larger text or a smaller window. | Preview |
| Navigation | Four native tabs for Home, Games, Books and Practice. Games open in full-screen rounds. On iOS 15, the app uses the system’s older single-column navigation and a scroll view when Home needs more room. | Preview |
| Books | A native illustrated shelf and reader using the existing titles, page text, and artwork. The shelf filters to the selected sound and respects seasonal availability. A bookmark reopens the last page. The review build has manual page turning. | Preview. Spoken book prompts, gates and paid-access parity still need their existing behavior. |
| Practice | A native visual tile for hearing the selected sound, using the current authored sound models. A Grown-ups link appears before a sound is picked. Listening to the model in this preview records zero reps. | Preview. Full practice, cues and verified speech behavior are release requirements. |
| Grown-ups | The four-number-word check protects Players, sound choices, clinician account settings and Preview progress. The progress panel shows actual game finishes and last open book pages for the current preview player. | Preview. Live speech records, reward balances and migrated profiles still require an in-place upgrade. |
| Players | Grown-ups can add and switch numbered local players. Each keeps a separate buddy, sound choice, game completions, bookmarks and start date. The original preview player keeps their saved preferences and records. | Preview. Local players have no separate clinician identity. |
| Clinician homework | The signed-in primary player can see their existing assigned sound. The Grown-ups view shows the therapist’s homework and keeps the family’s saved choice for later. | Preview. Fetches after consent using the existing family endpoint. Speech position, goals and word drills are part of the release flow. |
| Games shelf | Illustrated native cards for all 25 released games, All games and No rush filters, and a mark on games that finished. The four parked games are omitted. | Preview |
| Play collection | The chest opens the current player’s list of finished games. Trophy Road opens from there as a preview of the six original lands, their 28 milestones and the eight monthly steps, with original pictures and fixed gift values. | Preview. Balances, opening gifts, streaks, buddy ownership and historical claims need release integration. |
| Daily adventures | Home rotates existing illustrated stories by local date. The story view carries the 14 calendar stories and 10 sound-specific Day 1 choices, using the exact text and artwork. Page buttons and a separate end card let the family preview the story. | Preview. Full calendar history, narration, guided speaking and quest rewards still require parity. |
| Adventure games, days 1–3 | Guide boats with the held lighthouse beam and light the town windows. Wind up the toys and music box. Turn and fit the eight bridge stones. | Gameplay previews |
| Adventure games, days 4–8 | Fit the waterwheel troughs and open the gate. Steer the postboat and deliver parcels. Mix and bake buns. Build Tortoise’s bridge with a crane and move the cart across. Wire both sides of each lantern and close the switches. | Gameplay previews |
| Adventure games, days 9–14 | Join the train track and choose each station. Trace kite stitches and balance its tail. Balance the nest lift and deliver bundles to three levels. Play three pond concert patterns. Aim seeds into the rooftop planters. Fit the gears and turn the observatory wheel. | Gameplay previews |
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
| Feed Echo | Match the fruit Echo wants, with a new picture after each correct choice. | Gameplay preview |
| Race Car | Steer through moving gates with drag and directional controls. | Gameplay preview |
| Treasure Map | Pick the next landing and sail the boat through the islands. | Gameplay preview |
| Space Trip | Steer a rocket into glowing landing pads, using drag or the steering and landing buttons. | Gameplay preview |
| Balloon Party | Pump each balloon and drag it into the ring. | Gameplay preview |
| Grow a Flower | Hold to water the sprouts and watch them bloom. | Gameplay preview |
| Rocket Blast | Aim by pulling back the rocket and releasing toward the planet. | Gameplay preview |
| Build a Snowman | Roll snowballs, then lift them onto the snowman. | Gameplay preview |
| Choo-Choo Train | Hold to drive, release and brake at the stations. | Gameplay preview |
| Bedtime Stars | Draw a picture by following the stars in sequence. | Gameplay preview |
| Birthday Cake | Stir the bowl, then decorate the cake and add candles. | Gameplay preview |
| Robot Builder | Turn circuit tiles until the connections power the robot. | Gameplay preview |
| Castle Builder | Align and lower pieces from the crane, then bridge the towers. | Gameplay preview |
| Pizza Chef | Roll dough, spread sauce, place the toppings and bake. | Gameplay preview |

## Release checks

- Existing profile, progress, homework, settings, rewards, paid purchases, and every free-era and founding-family promise survive same-device upgrade and repeated launches. Test with fixtures from every supported legacy path, then verify an actual in-place update.
- Check prices, billing periods, eligibility, and restore against the existing App Store and RevenueCat products. Use the current server decision for clinician coverage. Keep old paid and earned access.
- Preserve the current approved words, cue audio, speech timing, rep rules, and Rachel's wording. Keep microphone audio entirely on-device and in memory. Keep existing sharing consent and withdrawal behavior.
- Test the live therapist login from the first screen with a disposable dashboard-created credential and verify consent, access, relaunch, and password change. Keep credentials out of source, transcripts, and test artifacts.
- Approve the design log before merging, then wait for Travis's explicit “merge.”

The native game previews use touch or accessible controls. Their finishes do not enter the speech ledger or grant existing rewards. The original browser game flows, scoring ownership, calibrated microphone timing, and age-specific clinical prompts remain the reference for the release.

## Therapist login additions

- The first welcome screen adds a dedicated “I have a login from my speech therapist” button. Grown-ups also offers that same path after the adult check.
- Username and password open in a native form. The existing sharing disclosure and Yes and No decisions appear after successful sign-in. A pending sharing decision survives a restart.
- The game and book cards use the clinician coverage response and the existing content access rules. Covered content opens directly. The login path has no offer screen.
- Settings shows the connected username and a Change password form. Passwords stay in memory only while submitted to the current Sona server. The verified device ticket is kept in this device’s Keychain.
- Stop sharing in Grown-ups uses the existing clinician deletion endpoint, switches off future assignment pulls and leaves the family’s access intact. Homework pulls require consent and carry the child’s existing connection proof. Preview interactions never report practice.

The signed iPhone Simulator build was exercised with fictional credentials. The test reached the sharing choice, restarted at that choice, then confirmed an enabled covered game. A connected session opened an included book and completed the Change password form against the local fixture. The endpoint contract passed 32 mocked assertions. Live dashboard verification is pending a disposable covered clinician login.
