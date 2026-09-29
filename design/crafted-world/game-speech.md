# Sound-powered help in live games

28 September 2026. Follow-up to the crafted-world redesign and Piano Tiles slow keys.

## What the child does

- Fruit Slice: tap Echo, say the selected sound, earn slower flying fruit.
- Block Stacker: say the sound to slow the block moving across the tower.
- Sound Sprint: say the sound to slow the course and its obstacles.
- Flappy Glide: say the sound to slow approaching hedges; balloon controls stay responsive.
- Piano Tiles: the previously implemented sound turn slows falling keys and their arrival.
- Feed Echo: a spoken attempt reveals a glowing matching picture, then the child taps it to feed Echo.
- Hoops: its existing spoken-word turn earns a ball, then the child shoots.

The four new arcade helpers last eight active seconds at 55% speed. Spawn timing slows with motion so objects do not bunch together. The board, score, and progress hold still during the spoken turn. Cancel, silence, and a rejected native transcript earn nothing. Between-round practice stays in place. The normal game can continue after cancellation. Books and Coming Soon games are unchanged.

## Speech boundaries

The arcade helper reuses the selected sound, existing model recording, sound-family gate, and native isolation verdict. TTS speaks the instruction prefix only. Native recognition, when available, rejects a clearly unrelated transcript. The browser fallback cannot reliably reject every unrelated word. Feed Echo's new hint uses voice activity and broad sound family; it is participation feedback, not a pronunciation grade or word-transcription check.

No child recording/transcript is uploaded; no gameplay hint/slowdown is written as clinical or practice progress. Speaker playback waits for both browser and native microphone cleanup, including delayed permission/start responses.

## Validation and release

Focused automated checks cover actual simulated speech triggering a boost, rejecting unrelated native words, object/spawn speed, frozen progress while listening, cancellation, backgrounding, delayed microphone cleanup, small-phone layout, and spoken model ordering. New regressions fail against the original four pages. Existing complete rounds, Feed Echo, microphone/audio isolation, page syntax, and TypeScript are also checked.

Passing checks: new shared-game speech suite 134 assertions; microphone/audio isolation 317; Say & Play/Hoops 299; Fruit Slice 26, Block Stacker 29, Sound Sprint 20, Flappy Glide 17; Feed Echo, script syntax, TypeScript, and whitespace checks. Final 320px captures confirm speaking controls do not overlap the round banners.

These tests use simulated microphone frames and native transcripts, not a physical iPhone. A real-device speech and speaker check remains necessary. This batch is local; it is not merged or deployed. The full release battery must run again before pushing.
