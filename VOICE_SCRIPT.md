# Echo's Recording Script

Every line Echo — the app's voice — can say out loud, in the exact words the code
sends to the voice, with the file and line each one comes from. Generated from the
live code by `node tools/voicedoc.mjs > VOICE_SCRIPT.md` (or `--write`); the
generator stops with an error if a line it knows disappears or a new spoken line
appears, so this sheet cannot drift from the app.

Five parts. **A** — the 19 sound models Rachel already recorded. **B** — the fixed
lines to record, numbered. **C** — the lines with a blank in them (the prompt with a
sound name and a count, the games' asks, the books) with the blanks filled in. **D** —
the word bank. **E** — what NOT to record: parked, unlinked and dead lines.

## How to record

- **One take per row, a beat of silence at each end.** Trailing silence gets
  trimmed; a clipped word ending cannot be recovered.
- **Room tone matters more than the mic.** Soft furnishings, no fan, no laptop on
  the table, phone on silent. Same room, same distance, for the whole set.
- **Talk to one small child sitting next to you.** Calm, warm, unhurried. Full
  stops, not exclamation marks — the practice lines were rewritten on 24 Sep 2026 so
  the voice does not jump. The fixed lines that still carry a "!": "I couldn't hear you! Say it big — I'm all ears!", "Go!", "Super Slice! Say", "Tap a lane to move side to side. Dodge the rocks and the cactus, and grab the gold stars!", "The end! Great listening!".
- **These get re-voiced afterwards** (ElevenLabs speech-to-speech). That keeps your
  pacing, stress and warmth and changes only who it sounds like — so deliver for the
  child, not for the mic. Timbre does not matter; timing and kindness do.
- **Say the text exactly as printed.** Tests pin these strings character for
  character (`tests/voicetest3.mjs`, `tests/micquietpracticetest.mjs`); a recording
  that says something else needs a code change to match, which is fine — but it is
  a decision, not an accident. Where the code says a letter name ("make your R
  sound") you may perform the sound instead; which wording per sound is Rachel's call.
- **Save as `<File name>.mp3`** (44.1 kHz, mono is fine), then run
  `node tools/levelclips.mjs <folder>`: it brings every file to the loudness of a TTS
  line (−20 dB RMS / −3 dB peak, with `/api/tts`'s own levelling), because a file
  plays as-is, and an unlevelled one is the one sound that can still jump.

Switch state right now: `HUMAN_CLIPS = true` (public/sona.js:7429) — Rachel's recorded sounds (Part A) are ON: one take of the sound plays in the letter's place in the practice prompt (C1, C2, the turtle, B3) and after the games' "…say" lines (B5); every word below is spoken through TTS.

---

## Part A — The 19 sound models (already recorded by Rachel)

**Do not re-record these unless Rachel says so — they are the clinical model.** She
recorded them in July (`git show 7ad8219`): 19 practice prompts and 19 bare-sound
demos in `public/coach/say/`. Each prompt clip is the whole opening line with the
sound actually performed in it (her "Ready?" stitched on the front, a "Go" at the
end — July wording, before the calm rewrite), because TTS cannot perform a stretched
or popped sound. The one take of each sound that every game and the practice page play
is cut from these, in her own voice (`tools/soundclips.mjs`, all 19 since 2 Oct 2026:
re-voicing turned her L into an "ee" and her R toward W). Her whole lines and demos are
also run through ElevenLabs speech-to-speech into Echo's voice by `tools/revoice.mjs`, into
`public/coach/say-echo/` (25 Sep 2026). With the
switch on, the C1 prompt for a sound is Echo's words with her one take in the letter's
place, and `say-echo/<SOUND>.mp3` plays in its stead only when the voice service is down
(public/charge.html:1027); `say-echo/<SOUND>-demo.mp3` is used only by the parked Coach Call.

Continuants are **stretched** (held about 1.5 s); stops are **popped** (one crisp
burst, never held — a held /p/ teaches a schwa the child then has to unlearn).

| # | Sound | On screen it shows | Stretch / pop | Rachel's files | Her mouth cue (shown under the target) |
|---|---|---|---|---|---|
| A1 | P | **puh** | POP — crisp, no schwa | `P.mp3`, `P-demo.mp3` | Press your lips and pop a little puff — p! p! p! |
| A2 | B | **buh** | POP — crisp, no schwa | `B.mp3`, `B-demo.mp3` | Lips together, turn your voice on — b! b! b! |
| A3 | M | **mmm** | STRETCH ~1.5 s | `M.mp3`, `M-demo.mp3` | Lips together and hum — mmmm. |
| A4 | N | **nnn** | STRETCH ~1.5 s | `N.mp3`, `N-demo.mp3` | Tongue up behind your teeth and hum — nnnn. |
| A5 | T | **tuh** | POP — crisp, no schwa | `T.mp3`, `T-demo.mp3` | Tongue taps behind your top teeth — t! t! t! |
| A6 | D | **duh** | POP — crisp, no schwa | `D.mp3`, `D-demo.mp3` | Like T, but turn your voice on — d! d! d! |
| A7 | K | **kuh** | POP — crisp, no schwa | `K.mp3`, `K-demo.mp3` | The back of your tongue pops up in the back — k! k! k! |
| A8 | G | **guh** | POP — crisp, no schwa | `G.mp3`, `G-demo.mp3` | Like K, but turn your voice on — g! g! g! |
| A9 | F | **ffff** | STRETCH ~1.5 s | `F.mp3`, `F-demo.mp3` | Top teeth on your bottom lip, blow soft — ffff. |
| A10 | V | **vvvv** | STRETCH ~1.5 s | `V.mp3`, `V-demo.mp3` | Like F, but buzz your voice — vvvv. |
| A11 | S | **sss** | STRETCH ~1.5 s | `S.mp3`, `S-demo.mp3` | Teeth together, big smile, let the air hiss out — sss like a snake. |
| A12 | Z | **zzz** | STRETCH ~1.5 s | `Z.mp3`, `Z-demo.mp3` | Teeth together and buzz like a bee — zzzz. |
| A13 | SH | **shhh** | STRETCH ~1.5 s | `SH.mp3`, `SH-demo.mp3` | Round your lips and whisper quiet — shhh. |
| A14 | CH | **chuh** | POP — crisp, no schwa | `CH.mp3`, `CH-demo.mp3` | Pop it like a little train — ch! ch! ch! |
| A15 | J | **juh** | POP — crisp, no schwa | `J.mp3`, `J-demo.mp3` | Like CH, but turn your voice on — j! j! j! |
| A16 | L | **lll** | STRETCH ~1.5 s | `L.mp3`, `L-demo.mp3` | Tongue tip up behind your top teeth — lll, la la la. |
| A17 | R | **rrrr** | STRETCH ~1.5 s | `R.mp3`, `R-demo.mp3` | Pull your tongue back and up like a tiger growl — rrr! |
| A18 | TH (as in 'thumb') | **thhh** | STRETCH ~1.5 s | `TH.mp3`, `TH-demo.mp3` | Peek your tongue between your teeth and blow soft — th. |
| A19 | TH (voiced, as in 'the') | **thuh** | STRETCH ~1.5 s | `THV.mp3`, `THV-demo.mp3` | Tongue between your teeth and buzz — th, like in 'the'. |

Sources: models public/sona.js:3909 (`SOUND_SAY`, shown on the practice card and the games' keep-playing card, never sent to TTS); cues public/sona.js:3820 (`CUES`).

---

## Part B — Fixed lines to record

Every live line that never changes. Today TTS speaks all of them; nothing in the
app plays a file for these yet, so the file names are a proposal (one folder,
`public/coach/lines/`) that the player can be built against. Numbered so you can
tick them off. Delivery notes are one line each; the register for all of them is
a grown-up talking softly to a small child.

### B1 — Praise (5)

Pinned as exactly this list with no "!" (`tests/voicetest3.mjs`).

| # | File | Say this | When Echo says it | Delivery | Source |
|---|---|---|---|---|---|
| B1 | praise-1.mp3 | Nice one. | After the easier target (the "I have an idea" line, B3/C5) passes — one of the five, picked at random. The only spoken praise in the live app, and the win line (B45) follows it; a normal pass gets only the win line. | Soft and pleased, a small smile in it. Not a cheer. | public/sona.js:4070; spoken at public/charge.html:2281 |
| B2 | praise-2.mp3 | Good job. | Same moment, random pick of five. | Soft and pleased, a small smile in it. Not a cheer. | public/sona.js:4070; spoken at public/charge.html:2281 |
| B3 | praise-3.mp3 | I heard that. | Same moment, random pick of five. | Soft and pleased, a small smile in it. Not a cheer. | public/sona.js:4070; spoken at public/charge.html:2281 |
| B4 | praise-4.mp3 | That was lovely. | Same moment, random pick of five. | Soft and pleased, a small smile in it. Not a cheer. | public/sona.js:4070; spoken at public/charge.html:2281 |
| B5 | praise-5.mp3 | Well done. | Same moment, random pick of five. | Soft and pleased, a small smile in it. Not a cheer. | public/sona.js:4070; spoken at public/charge.html:2281 |

### B2 — Coaching after a miss (19)

`Let's try that one again. {tip}.`, then "Go!" (B49) — the tip is Rachel's mouth cue cut at the dash (rule at public/charge.html:2249).

| # | File | Say this | When Echo says it | Delivery | Source |
|---|---|---|---|---|---|
| B6 | coach-P.mp3 | Let's try that one again. Press your lips and pop a little puff. | Once per round, when the on-device check heard a clearly different sound on P. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B7 | coach-B.mp3 | Let's try that one again. Lips together, turn your voice on. | Once per round, when the on-device check heard a clearly different sound on B. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B8 | coach-M.mp3 | Let's try that one again. Lips together and hum. | Once per round, when the on-device check heard a clearly different sound on M. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B9 | coach-N.mp3 | Let's try that one again. Tongue up behind your teeth and hum. | Once per round, when the on-device check heard a clearly different sound on N. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B10 | coach-T.mp3 | Let's try that one again. Tongue taps behind your top teeth. | Once per round, when the on-device check heard a clearly different sound on T. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B11 | coach-D.mp3 | Let's try that one again. Like T, but turn your voice on. | Once per round, when the on-device check heard a clearly different sound on D. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B12 | coach-K.mp3 | Let's try that one again. The back of your tongue pops up in the back. | Once per round, when the on-device check heard a clearly different sound on K. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B13 | coach-G.mp3 | Let's try that one again. Like K, but turn your voice on. | Once per round, when the on-device check heard a clearly different sound on G. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B14 | coach-F.mp3 | Let's try that one again. Top teeth on your bottom lip, blow soft. | Once per round, when the on-device check heard a clearly different sound on F. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B15 | coach-V.mp3 | Let's try that one again. Like F, but buzz your voice. | Once per round, when the on-device check heard a clearly different sound on V. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B16 | coach-S.mp3 | Let's try that one again. Teeth together, big smile, let the air hiss out. | Once per round, when the on-device check heard a clearly different sound on S. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B17 | coach-Z.mp3 | Let's try that one again. Teeth together and buzz like a bee. | Once per round, when the on-device check heard a clearly different sound on Z. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B18 | coach-SH.mp3 | Let's try that one again. Round your lips and whisper quiet. | Once per round, when the on-device check heard a clearly different sound on SH. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B19 | coach-CH.mp3 | Let's try that one again. Pop it like a little train. | Once per round, when the on-device check heard a clearly different sound on CH. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B20 | coach-J.mp3 | Let's try that one again. Like CH, but turn your voice on. | Once per round, when the on-device check heard a clearly different sound on J. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B21 | coach-L.mp3 | Let's try that one again. Tongue tip up behind your top teeth. | Once per round, when the on-device check heard a clearly different sound on L. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B22 | coach-R.mp3 | Let's try that one again. Pull your tongue back and up like a tiger growl. | Once per round, when the on-device check heard a clearly different sound on R. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B23 | coach-TH.mp3 | Let's try that one again. Peek your tongue between your teeth and blow soft. | Once per round, when the on-device check heard a clearly different sound on TH (as in 'thumb'). Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |
| B24 | coach-THV.mp3 | Let's try that one again. Tongue between your teeth and buzz. | Once per round, when the on-device check heard a clearly different sound on TH (voiced, as in 'the'). Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2255 |

### B3 — Echo's idea, sound alone (19)

`I have an idea. Let's try this one. Make your {sound} sound.`, then "Go!" (B49) — the same line with a syllable or a word in it is a template (C5). Where the code spells the letter name ("S H", "C H", "T H"), say the sound name as a person would.

| # | File | Say this | When Echo says it | Delivery | Source |
|---|---|---|---|---|---|
| B25 | idea-P.mp3 | I have an idea. Let's try this one. Make your P sound. | After the retry ALSO missed on a syllable round of P: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B26 | idea-B.mp3 | I have an idea. Let's try this one. Make your B sound. | After the retry ALSO missed on a syllable round of B: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B27 | idea-M.mp3 | I have an idea. Let's try this one. Make your M sound. | After the retry ALSO missed on a syllable round of M: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B28 | idea-N.mp3 | I have an idea. Let's try this one. Make your N sound. | After the retry ALSO missed on a syllable round of N: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B29 | idea-T.mp3 | I have an idea. Let's try this one. Make your T sound. | After the retry ALSO missed on a syllable round of T: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B30 | idea-D.mp3 | I have an idea. Let's try this one. Make your D sound. | After the retry ALSO missed on a syllable round of D: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B31 | idea-K.mp3 | I have an idea. Let's try this one. Make your K sound. | After the retry ALSO missed on a syllable round of K: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B32 | idea-G.mp3 | I have an idea. Let's try this one. Make your G sound. | After the retry ALSO missed on a syllable round of G: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B33 | idea-F.mp3 | I have an idea. Let's try this one. Make your F sound. | After the retry ALSO missed on a syllable round of F: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B34 | idea-V.mp3 | I have an idea. Let's try this one. Make your V sound. | After the retry ALSO missed on a syllable round of V: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B35 | idea-S.mp3 | I have an idea. Let's try this one. Make your S sound. | After the retry ALSO missed on a syllable round of S: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B36 | idea-Z.mp3 | I have an idea. Let's try this one. Make your Z sound. | After the retry ALSO missed on a syllable round of Z: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B37 | idea-SH.mp3 | I have an idea. Let's try this one. Make your S H sound. | After the retry ALSO missed on a syllable round of SH: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B38 | idea-CH.mp3 | I have an idea. Let's try this one. Make your C H sound. | After the retry ALSO missed on a syllable round of CH: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B39 | idea-J.mp3 | I have an idea. Let's try this one. Make your J sound. | After the retry ALSO missed on a syllable round of J: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B40 | idea-L.mp3 | I have an idea. Let's try this one. Make your L sound. | After the retry ALSO missed on a syllable round of L: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B41 | idea-R.mp3 | I have an idea. Let's try this one. Make your R sound. | After the retry ALSO missed on a syllable round of R: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B42 | idea-TH.mp3 | I have an idea. Let's try this one. Make your T H sound. | After the retry ALSO missed on a syllable round of TH (as in 'thumb'): Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |
| B43 | idea-THV.mp3 | I have an idea. Let's try this one. Make your T H sound. | After the retry ALSO missed on a syllable round of TH (voiced, as in 'the'): Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2277 |

### B4 — Round end, win, chest, adventure end, quiet screen, "Go!" (6)

| # | File | Say this | When Echo says it | Delivery | Source |
|---|---|---|---|---|---|
| B44 | roundend.mp3 | Good practicing. Let's play. | Round end when the retry (and the easier target, if there was one) still came back as the wrong sound. The game opens anyway; the win line is NOT spoken in this case. | Warm and light. There is no disappointment in it — the child practised, and now they play. | public/charge.html:2285 |
| B45 | win.mp3 | You did it. Let's play. | The win: five tries heard and the last check passed. Spoken 600 ms after the win chime; the game loads 1.2 s later. | Quietly delighted. A full stop, not a fanfare. | public/charge.html:2430 |
| B46 | chest.mp3 | Look what we found. | The treasure chest at the end of the adventure: after the child's third tap opens it, 600 ms after the tap chime, while the sticker shows. | A small wonder, like peeking into a box together. | public/charge.html:2360 |
| B47 | adventure-end.mp3 | We finished the whole adventure. | Adventure end: when the fifth round's game hands back and the "Adventure complete!" card appears, 600 ms after its chime. | Proud and settled, winding down. | public/charge.html:2491 |
| B48 | quiet.mp3 | I couldn't hear you! Say it big — I'm all ears! | The quiet screen: a listening window ended with nothing heard. Mic already closed. Screen: "I couldn't hear you!" / "Say it big — I'm all ears!" with Try again / Maybe later. Tapping Try again reopens the mic without re-speaking the prompt. | Gentle and playful. This is the one line that kept its "!" on 24 Sep — "Say it big" is a production cue, so give it a little lift without shouting. Any rewording is Rachel's call. | public/charge.html:2388 |
| B49 | go.mp3 | Go! | After every ask that hands the child the turn, as its own short clip joined on after the words: the practice prompt and a tap on Echo (C1, C2, C3), the turtle on a sound-alone round, the retry lines (B2, B3, C5), every round game's say-it card (B5, C7) and sound power (B5), every picture-game word (C8) and Feed Echo's asks (C6). Not the books or Sound Sprint's how-to-play. Then the mic opens. | Bright and short: it hands over the turn. It was taken out on 24 Sep for sounding jumpy and is back as Travis's try (2 Oct 2026); whether it stays is his ear and Rachel's call. | public/sona.js:634 (Sona.goClip; the say-it card asks for the same "Go!" at public/arcade-sayit.js:50); joined on at public/charge.html:1026 |


### B5 — The round games (10)

The say-it card in all six round games (one voice for all six, `arcade-sayit.js`), their shared new-life instruction, Echo's power button in all six (instruction at public/arcade-speech-help.js:39, her sound at public/arcade-speech-help.js:101), and Sound Sprint's how-to-play line. None of them is spoken while Sona's sound is off (arcade-sayit.js:302, arcade-sayit.js:302, arcade-run.html:702). The lines ending in "say" are followed by the sound itself, which is Rachel's recording (Part A), never TTS.

| # | File | Say this | When Echo says it | Delivery | Source |
|---|---|---|---|---|---|
| B50 | card-say.mp3 | To keep playing, say | The say-it card between rounds in all six round games (Fruit Slice, Piano Tiles, Block Stacker, Sound Sprint, Flappy Glide, Rise Up): Echo says this, then Rachel's recording of the sound plays (`say-echo/<SOUND>-sound.wav`, Part A), then "Go!" (B49), then the mic opens. Screen: "Say “rrrr” for wave 2!" (each game its own words). On Fruit Slice, a card that asks a syllable or a word says one line instead of this and her recording (C7). | Friendly and plain. It runs straight into the sound, so leave it open at the end. | public/arcade-sayit.js:50; in this order at public/arcade-sayit.js:329 |
| B51 | card-idea.mp3 | I have an idea. Let's try this one. | Fruit Slice's card, when a syllable or a word got no answer for 8 s: the mic closes, the card goes back to the sound alone, Echo says this, then Rachel's recording, then "Go!". The practice page's own words for the same move (B3). | As B3: a good idea just arrived. Not a consolation. | public/arcade-slice.html:664; said at public/arcade-slice.html:694; the step back at public/arcade-slice.html:733 |
| B52 | card-new-life.mp3 | For a new life, say | All six round games: after the last gameplay heart is lost, the round stops on the new-life card. Echo says this, then Rachel's sound, then "Go!", then the mic. An accepted sound restores all three hearts and resumes that same round; silence restores nothing. This is separate from mid-game sound powers, which restore no hearts. | Friendly and encouraging. It runs straight into the sound, so leave it open at the end. | public/arcade-speech-help.js:55; Fruit Slice at public/arcade-slice.html:694; other cards at public/arcade-tiles.html:728, public/arcade-stack.html:527, public/arcade-run.html:775, public/arcade-glide.html:537, public/arcade-rise.html:582 |
| B53 | power-slice.mp3 | Super Slice! Say | Fruit Slice: Echo asks automatically during play; a tap on him asks at once too. The board keeps moving, but its sounds wait. He says each distinct reason once per visit, only marking it said after it finishes, then Rachel's sound and "Go!", then the mic. Later asks for the same reason play just the sound and "Go!". A heard try earns the power only, never a heart. A lost heart does not bring the next ask forward. | Short and bright. It runs straight into the sound, so leave it open at the end. Has a "!": a little lift, not a shout. | public/arcade-slice.html:164 |
| B54 | power-tiles.mp3 | To slow the keys, say | Piano Tiles: Echo asks automatically during play; a tap on him asks at once too. The board keeps moving, but its sounds wait. He says each distinct reason once per visit, only marking it said after it finishes, then Rachel's sound and "Go!", then the mic. Later asks for the same reason play just the sound and "Go!". A heard try earns the power only, never a heart. A lost heart does not bring the next ask forward. | Short and bright. It runs straight into the sound, so leave it open at the end. | public/arcade-tiles.html:137 |
| B55 | power-stack.mp3 | To slow the block, say | Block Stacker: Echo asks automatically during play; a tap on him asks at once too. The board keeps moving, but its sounds wait. He says each distinct reason once per visit, only marking it said after it finishes, then Rachel's sound and "Go!", then the mic. Later asks for the same reason play just the sound and "Go!". A heard try earns the power only, never a heart. A lost heart does not bring the next ask forward. | Short and bright. It runs straight into the sound, so leave it open at the end. | public/arcade-stack.html:135 |
| B56 | power-run.mp3 | To slow the course, say | Sound Sprint: Echo asks automatically during play; a tap on him asks at once too. The board keeps moving, but its sounds wait. He says each distinct reason once per visit, only marking it said after it finishes, then Rachel's sound and "Go!", then the mic. Later asks for the same reason play just the sound and "Go!". A heard try earns the power only, never a heart. A lost heart does not bring the next ask forward. | Short and bright. It runs straight into the sound, so leave it open at the end. | public/arcade-run.html:188 |
| B57 | power-glide.mp3 | To slow the beams, say | Flappy Glide: Echo asks automatically during play; a tap on him asks at once too. The board keeps moving, but its sounds wait. He says each distinct reason once per visit, only marking it said after it finishes, then Rachel's sound and "Go!", then the mic. Later asks for the same reason play just the sound and "Go!". A heard try earns the power only, never a heart. A lost heart does not bring the next ask forward. | Short and bright. It runs straight into the sound, so leave it open at the end. | public/arcade-glide.html:144 |
| B58 | power-rise.mp3 | To slow the falling blocks, say | Rise Up: Echo asks automatically during play; a tap on him asks at once too. The board keeps moving, but its sounds wait. He says each distinct reason once per visit, only marking it said after it finishes, then Rachel's sound and "Go!", then the mic. Later asks for the same reason play just the sound and "Go!". A heard try earns the power only, never a heart. A lost heart does not bring the next ask forward. | Short and bright. It runs straight into the sound, so leave it open at the end. | public/arcade-rise.html:144 |
| B59 | sprint-howto.mp3 | Tap a lane to move side to side. Dodge the rocks and the cactus, and grab the gold stars! | Sound Sprint's start card, on a child's first three races: after the tap on "Let's run!" Echo says this while the card stays, and the race starts when he stops ("Skip" ends it early). | Clear and easy, one instruction at a time. Ends on a "!": a little lift, not a shout. | public/arcade-run.html:622; asked for at public/arcade-run.html:643 |

### B6 — Books (2)

| # | File | Say this | When Echo says it | Delivery | Source |
|---|---|---|---|---|---|
| B60 | book-end.mp3 | The end! Great listening! | The last page of every book ("The End!"), with the star and the chime. | Warm and pleased, winding down. Still has its "!". | public/library.html:1695 |
| B61 | book-turn.mp3 | Great trying. Let's turn the page. | A book page's key word (C9): after three tries that were a voice but not the book's kind of sound, Echo says this and the page turns. Screen: "Great trying! Let's turn the page." | Kind and light. The page turns on a good note. | public/library.html:1920 |

### B7 — Picture-game instructions (37)

The two-times sentence a picture game's page gives the engine (`intro:`); Days 4-14 of the daily story share one page, `story-game.html`, which hands the engine that day's `intro` from `daily-adventures/pages.js`. Queued games are explicitly marked Coming soon; their instructions are listed for preview review and do not mean the game is released.

| # | File | Say this | When Echo says it | Delivery | Source |
|---|---|---|---|---|---|
| B62 | picture-two-times-1.mp3 | Say each word two times to get a balloon. Pump it up. Then pull it into the glowing ring and let go. | Balloon Party: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-balloon.html:32; played at public/sayplay.js:546 |
| B63 | picture-two-times-2.mp3 | Say each word two times to start each cooking step. Then your hands make the cake! Tap Cooking help for extra help. | Birthday Cake: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-cake.html:88; played at public/sayplay.js:546 |
| B64 | picture-two-times-3.mp3 | Say each word two times to get a castle piece. Slide the crane over the glow, then hold Lower. | Castle Builder: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-castle.html:33; played at public/sayplay.js:546 |
| B65 | picture-two-times-4.mp3 | Say each word two times to get a brush. | Dino Dig: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-dino.html:141; played at public/sayplay.js:546 |
| B66 | picture-two-times-5.mp3 | Say each word two times to get fish food. | Fish Tank: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-fishtank.html:80; played at public/sayplay.js:546 |
| B67 | picture-two-times-6.mp3 | Say each word two times to fill your watering can. Then hold the can over the glowing soil. Tap the water drop for more water. | Grow a Flower: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-flower.html:29; played at public/sayplay.js:546 |
| B68 | picture-two-times-7.mp3 | Say each word two times to get a present. | Surprise Boxes: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-gifts.html:83; played at public/sayplay.js:546 |
| B69 | picture-two-times-8.mp3 | Say each word two times to get a ball. | Hoops, Soccer Goal: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-hoops.html:144; public/arcade-soccer.html:144; played at public/sayplay.js:546 |
| B70 | picture-two-times-9.mp3 | Say each word two times to get the next salon tool. Then use your finger to style our monster. | Monster Makeover: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-monster.html:30; played at public/sayplay.js:546 |
| B71 | picture-two-times-10.mp3 | Say each word two times to hide a picture. | Peekaboo: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-peekaboo.html:100; played at public/sayplay.js:546 |
| B72 | picture-two-times-11.mp3 | Say each word two times to start the next step. Then your hands make the pizza! Tap Chef power for extra help. | Pizza Chef: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-pizza.html:37; played at public/sayplay.js:546 |
| B73 | picture-two-times-12.mp3 | Say each word two times for a muddy spot. Then touch the glowing spot and hold to wash it. Tap Steady puppy for extra help. | Puppy Bath: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-puppy.html:82; played at public/sayplay.js:546 |
| B74 | picture-two-times-13.mp3 | Say each word two times to drive. Then drag to steer into the glowing ring. | Race Car: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-racecar.html:31; played at public/sayplay.js:546 |
| B75 | picture-two-times-14.mp3 | Say each word two times to open a circuit. Tap the wires to turn them, then press Test power. | Robot Builder: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-robot.html:55; played at public/sayplay.js:546 |
| B76 | picture-two-times-15.mp3 | Say your word two times to get a rocket. Then pull it down and let go! | Rocket Blast: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-rocket.html:81; played at public/sayplay.js:546 |
| B77 | picture-two-times-16.mp3 | Say your word two times to get a snowball. Roll it big, and stack it! | Build a Snowman: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-snowman.html:83; played at public/sayplay.js:546 |
| B78 | picture-two-times-17.mp3 | Say each word two times to start a flight. Hold the engine to lift, slide to steer, and land softly on the glowing pad. | Space Trip: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-space.html:32; played at public/sayplay.js:546 |
| B79 | picture-two-times-18.mp3 | Say each word two times to start a picture. Then draw it: slide from star to star. Glowing path is extra help. | Bedtime Stars: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-stars.html:80; played at public/sayplay.js:546 |
| B80 | picture-two-times-19.mp3 | Say your word two times to start the train. Then drive, stop, and help a friend aboard. | Choo-Choo Train: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-train.html:85; played at public/sayplay.js:546 |
| B81 | picture-two-times-20.mp3 | Say each word two times to set sail. Then draw a line from your boat to the glowing ring. | Treasure Map: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-treasure.html:17; played at public/sayplay.js:546 |
| B82 | picture-two-times-21.mp3 | Say each word two times to light the lamp. Then move the light to find a lost boat. Tap Bright beam for extra help. | Light the Way (Day 1 of the daily story), ages 5-8: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-lighthouse.html:195; played at public/sayplay.js:546 |
| B83 | picture-two-times-22.mp3 | Say each word two times to light the lamp. Then touch the glowing boat with the light. | Light the Way (Day 1 of the daily story), ages 3-4: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-lighthouse.html:195; played at public/sayplay.js:546 |
| B84 | picture-two-times-23.mp3 | Say each word two times to find a toy's key. Wind it with circles, and let go at the star. Tap Oil can for extra help. | Wind-Up Toys (Day 2 of the daily story), ages 5-8: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-windup.html:40; played at public/sayplay.js:546 |
| B85 | picture-two-times-24.mp3 | Say each word two times to find a toy's key. Then draw circles on the key until it rings. | Wind-Up Toys (Day 2 of the daily story), ages 3-4: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-windup.html:40; played at public/sayplay.js:546 |
| B86 | picture-two-times-25.mp3 | Say each word two times to call a stone up. Then turn it and slide it into its hole. Tap Calm river for extra help. | Puzzle Bridge (Day 3 of the daily story), ages 5-8: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-bridge.html:202; played at public/sayplay.js:546 |
| B87 | picture-two-times-26.mp3 | Say each word two times to call a stone up. Then slide it into the hole with the same shape. | Puzzle Bridge (Day 3 of the daily story), ages 3-4: once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/arcade-bridge.html:202; played at public/sayplay.js:546 |
| B88 | picture-two-times-27.mp3 | Say each word two times to get the water route ready. Connect the troughs and open the water gate. | The Thirsty Waterwheel Garden (Day 4 of the daily story): once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/daily-adventures/pages.js:15 via public/story-game.html:91; played at public/sayplay.js:546 |
| B89 | picture-two-times-28.mp3 | Say each word two times to get the postboat ready. Steer beside the right dock and move the parcel. | The Little Island Postboat (Day 5 of the daily story): once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/daily-adventures/pages.js:24 via public/story-game.html:91; played at public/sayplay.js:546 |
| B90 | picture-two-times-29.mp3 | Say each word two times to get the next bakery job ready. Use the pictures to pour, mix, shape and bake. | Breakfast at the Moonberry Bakery (Day 6 of the daily story): once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/daily-adventures/pages.js:33 via public/story-game.html:91; played at public/sayplay.js:546 |
| B91 | picture-two-times-30.mp3 | Say each word two times to get the next bridge job ready. Lift, turn and lower the pieces onto their supports. | Tortoise's New Front Door (Day 7 of the daily story): once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/daily-adventures/pages.js:42 via public/story-game.html:91; played at public/sayplay.js:546 |
| B92 | picture-two-times-31.mp3 | Say each word two times. Join the waiting cords, then close the switches to light the path. | The Glowworm Lantern Walk (Day 8 of the daily story): once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/daily-adventures/pages.js:51 via public/story-game.html:91; played at public/sayplay.js:546 |
| B93 | picture-two-times-32.mp3 | Say each word two times. Join the rails, set the switches, and stop beside the passenger pictures. | All Aboard for Snowdrop Valley (Day 9 of the daily story): once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/daily-adventures/pages.js:60 via public/story-game.html:91; played at public/sayplay.js:546 |
| B94 | picture-two-times-33.mp3 | Say each word two times. Fit patches, follow the stitches, thread the ribbons, and balance the kite tail. | The Hilltop Patchwork Kite (Day 10 of the daily story): once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/daily-adventures/pages.js:69 via public/story-game.html:91; played at public/sayplay.js:546 |
| B95 | picture-two-times-34.mp3 | Say each word two times. Load the basket, move the counterweights, and guide each bundle into its nest. | The Sandstone Nest Lift (Day 11 of the daily story): once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/daily-adventures/pages.js:78 via public/story-game.html:91; played at public/sayplay.js:546 |
| B96 | picture-two-times-35.mp3 | Say each word two times. Try the instruments, play their patterns, and guide the pond concert. | The Lily-Pad Concert (Day 12 of the daily story): once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/daily-adventures/pages.js:87 via public/story-game.html:91; played at public/sayplay.js:546 |
| B97 | picture-two-times-36.mp3 | Say each word two times. Aim and pull the springboard to send seeds into rooftop soil. | Seeds Across the Rooftops (Day 13 of the daily story): once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/daily-adventures/pages.js:96 via public/story-game.html:91; played at public/sayplay.js:546 |
| B98 | picture-two-times-37.mp3 | Say each word two times. Choose and place gears to move the sun, moon, and stars. | The Moving-Star Observatory (Day 14 of the daily story): once before the first isolated word ask of a visit; never between the first and second saying. | Clear and friendly, its own sentence. Leave a short natural pause before the target word. | public/daily-adventures/pages.js:105 via public/story-game.html:91; played at public/sayplay.js:546 |


### B8 — Picture-game directions (250)

Every line each picture game's play script can hand to `api.instruct()` (for Days 4-14 of the daily story, the controller in `daily-adventures/` that `story-game.html` inserts), worked out from its code: a literal, every line in a table it reads (so where a table also feeds the on-screen banner, a line can be listed that a child only sees), or every line a helper can return or a variable can hold (so a line can be listed for a moment that rarely comes). None is a speech target, none is counted, and none plays between the two sayings of a word.

| # | File | Say this | When Echo says it | Delivery | Source |
|---|---|---|---|---|---|
| B99 | picture-balloon-help-1.mp3 | Now pull your balloon into the ring. | Balloon Party: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/balloon.js:158; owned at public/sayplay.js:684 |
| B100 | picture-balloon-help-2.mp3 | Pull it up to the glowing ring, then let go. | Balloon Party: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/balloon.js:189; owned at public/sayplay.js:684 |
| B101 | picture-balloon-help-3.mp3 | Tap the pump to fill your balloon. | Balloon Party: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/balloon.js:284; owned at public/sayplay.js:684 |
| B102 | picture-cake-step-1.mp3 | Move the spoon all the way around the bowl to stir the batter. | Birthday Cake: the direction for step 1. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/cake.js:33; said at public/cake.js:211, public/cake.js:239; owned at public/sayplay.js:684 |
| B103 | picture-cake-step-2.mp3 | Pick up the jug and hold it over the tin. Keep holding to pour. | Birthday Cake: the direction for step 2. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/cake.js:33; said at public/cake.js:211, public/cake.js:239; owned at public/sayplay.js:684 |
| B104 | picture-cake-step-3.mp3 | Hold the icing bag on each glowing swirl to pipe some icing. | Birthday Cake: the direction for step 3. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/cake.js:33; said at public/cake.js:211, public/cake.js:239; owned at public/sayplay.js:684 |
| B105 | picture-cake-step-4.mp3 | Choose four pieces of fruit. Drag them anywhere on top of your cake. | Birthday Cake: the direction for step 4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/cake.js:33; said at public/cake.js:211, public/cake.js:239; owned at public/sayplay.js:684 |
| B106 | picture-cake-step-5.mp3 | Drag candles to the shapes. Swipe the fan across the flames. | Birthday Cake: the direction for step 5. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/cake.js:33; said at public/cake.js:211, public/cake.js:239; owned at public/sayplay.js:684 |
| B107 | picture-fishtank-step-1.mp3 | Drag the food up above the fish. Then let go. | Fish Tank: the direction for step 1. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/fishtank.js:10; said at public/fishtank.js:90, public/fishtank.js:91; owned at public/sayplay.js:684 |
| B108 | picture-fishtank-step-2.mp3 | Drag the food above this fish. Then let go. | Fish Tank: the direction for step 2. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/fishtank.js:10; said at public/fishtank.js:90, public/fishtank.js:91; owned at public/sayplay.js:684 |
| B109 | picture-fishtank-step-3.mp3 | Drag the food above the little fish. Let go. | Fish Tank: the direction for step 3. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/fishtank.js:10; said at public/fishtank.js:90, public/fishtank.js:91; owned at public/sayplay.js:684 |
| B110 | picture-fishtank-step-4.mp3 | Drag the food above the bobbing fish. Let go. | Fish Tank: the direction for step 4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/fishtank.js:10; said at public/fishtank.js:90, public/fishtank.js:91; owned at public/sayplay.js:684 |
| B111 | picture-fishtank-step-5.mp3 | Drag food above the last fish. Let go. | Fish Tank: the direction for step 5. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/fishtank.js:10; said at public/fishtank.js:90, public/fishtank.js:91; owned at public/sayplay.js:684 |
| B112 | picture-fishtank-help-1.mp3 | So close! Let go higher, at the arrow. | Fish Tank: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/fishtank.js:18; said at public/fishtank.js:69, public/fishtank.js:90; owned at public/sayplay.js:684 |
| B113 | picture-fishtank-help-2.mp3 | Nearly! Drag the food up and let go. | Fish Tank: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/fishtank.js:18; said at public/fishtank.js:69, public/fishtank.js:90; owned at public/sayplay.js:684 |
| B114 | picture-flower-help-1.mp3 | Tap the water drop to fill your can. | Grow a Flower: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/flower.js:265; owned at public/sayplay.js:684 |
| B115 | picture-flower-help-2.mp3 | Move the can over the glow. | Grow a Flower: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/flower.js:281; owned at public/sayplay.js:684 |
| B116 | picture-flower-help-3.mp3 | Pour anywhere. The water will find the flower! | Grow a Flower: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/flower.js:282; owned at public/sayplay.js:684 |
| B117 | picture-flower-help-4.mp3 | Hold the can over the glowing soil. | Grow a Flower: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/flower.js:297; owned at public/sayplay.js:684 |
| B118 | picture-gifts-step-1.mp3 | Pull the ribbon tail to untie the bow. Then lift the lid. | Surprise Boxes: the direction for step 1. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/gifts.js:10; said at public/gifts.js:105, public/gifts.js:110; owned at public/sayplay.js:684 |
| B119 | picture-gifts-step-2.mp3 | Peel the corner of the paper along the glowing arrow. Then lift the lid. | Surprise Boxes: the direction for step 2. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/gifts.js:10; said at public/gifts.js:105, public/gifts.js:110; owned at public/sayplay.js:684 |
| B120 | picture-gifts-step-3.mp3 | Slide both little latches up. Then lift the lid. | Surprise Boxes: the direction for step 3. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/gifts.js:10; said at public/gifts.js:105, public/gifts.js:110; owned at public/sayplay.js:684 |
| B121 | picture-gifts-step-4.mp3 | Move the handle around the circle to twist the lid. Then lift it up. | Surprise Boxes: the direction for step 4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/gifts.js:10; said at public/gifts.js:105, public/gifts.js:110; owned at public/sayplay.js:684 |
| B122 | picture-gifts-step-5.mp3 | Slide this lid to the side. Then lift it up. | Surprise Boxes: the direction for step 5. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/gifts.js:10; said at public/gifts.js:105, public/gifts.js:110; owned at public/sayplay.js:684 |
| B123 | picture-monster-step-1.mp3 | Move the sponge back and forth over each muddy patch. | Monster Makeover: the direction for step 1. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:18; said at public/monster.js:371, public/monster.js:397; owned at public/sayplay.js:684 |
| B124 | picture-monster-step-2.mp3 | Hold the shower over each bubbly patch to rinse it away. | Monster Makeover: the direction for step 2. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:18; said at public/monster.js:371, public/monster.js:397; owned at public/sayplay.js:684 |
| B125 | picture-monster-step-3.mp3 | Brush down each curly bit of fur. | Monster Makeover: the direction for step 3. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:18; said at public/monster.js:371, public/monster.js:397; owned at public/sayplay.js:684 |
| B126 | picture-monster-step-4.mp3 | Swipe the scissors across each dotted tuft. | Monster Makeover: the direction for step 4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:18; said at public/monster.js:371, public/monster.js:397; owned at public/sayplay.js:684 |
| B127 | picture-monster-step-5.mp3 | Choose a color, then tap each glowing spot. | Monster Makeover: the direction for step 5. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:18; said at public/monster.js:371, public/monster.js:397; owned at public/sayplay.js:684 |
| B128 | picture-monster-step-6.mp3 | Drag the bow to the glowing spot below the smile. | Monster Makeover: the direction for step 6. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:18; said at public/monster.js:371, public/monster.js:397; owned at public/sayplay.js:684 |
| B129 | picture-monster-step-7.mp3 | Drag the glasses onto the monster's face. | Monster Makeover: the direction for step 7. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:18; said at public/monster.js:371, public/monster.js:397; owned at public/sayplay.js:684 |
| B130 | picture-monster-step-8.mp3 | Drag the crown onto the monster's head. | Monster Makeover: the direction for step 8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:18; said at public/monster.js:371, public/monster.js:397; owned at public/sayplay.js:684 |
| B131 | picture-monster-help-1.mp3 | Scrub the muddy fur | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B132 | picture-monster-help-2.mp3 | Keep scrubbing the mud | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B133 | picture-monster-help-3.mp3 | Scrub the glowing mud | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B134 | picture-monster-help-4.mp3 | Scrub anywhere on our friend | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B135 | picture-monster-help-5.mp3 | Rinse the bubbles | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B136 | picture-monster-help-6.mp3 | Hold the shower on bubbles | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B137 | picture-monster-help-7.mp3 | Hold the shower on the glow | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B138 | picture-monster-help-8.mp3 | Hold the shower on our friend | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B139 | picture-monster-help-9.mp3 | Brush down along an arrow | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B140 | picture-monster-help-10.mp3 | So close! Brush down an arrow | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B141 | picture-monster-help-11.mp3 | Brush down the glowing curl | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B142 | picture-monster-help-12.mp3 | Brush down on our friend | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B143 | picture-monster-help-13.mp3 | Swipe across a dotted tuft | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B144 | picture-monster-help-14.mp3 | So close! Swipe across a tuft | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B145 | picture-monster-help-15.mp3 | Swipe across the glowing tuft | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B146 | picture-monster-help-16.mp3 | Swipe sideways on our friend | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B147 | picture-monster-help-17.mp3 | Try another glowing fur spot | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B148 | picture-monster-help-18.mp3 | So close! Tap a glowing spot | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B149 | picture-monster-help-19.mp3 | Nearly! Tap the big glow | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B150 | picture-monster-help-20.mp3 | Tap anywhere on our friend | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B151 | picture-monster-help-21.mp3 | Still yours. Try the glowing spot | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B152 | picture-monster-help-22.mp3 | So close! Try the glowing spot | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B153 | picture-monster-help-23.mp3 | Follow the arrow to the glow | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B154 | picture-monster-help-24.mp3 | Drop it anywhere on our friend | Monster Makeover: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/monster.js:43; said at public/monster.js:264, public/monster.js:269, public/monster.js:371; owned at public/sayplay.js:684 |
| B155 | picture-peekaboo-help-1.mp3 | Watch the doors! | Peekaboo: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/peekaboo.js:43; said at public/peekaboo.js:246, public/peekaboo.js:331; owned at public/sayplay.js:684 |
| B156 | picture-peekaboo-help-2.mp3 | Tap the glowing door! | Peekaboo: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/peekaboo.js:43; said at public/peekaboo.js:261, public/peekaboo.js:267, public/peekaboo.js:287, public/peekaboo.js:331, public/peekaboo.js:352, public/peekaboo.js:360; owned at public/sayplay.js:684 |
| B157 | picture-peekaboo-help-3.mp3 | Tap the door it is behind! | Peekaboo: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/peekaboo.js:43; said at public/peekaboo.js:261, public/peekaboo.js:267, public/peekaboo.js:331, public/peekaboo.js:360; owned at public/sayplay.js:684 |
| B158 | picture-pizza-step-1.mp3 | Drag the rolling pin back and forth over the dough. | Pizza Chef: the direction for step 1. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/pizza.js:36; said at public/pizza.js:502, public/pizza.js:548; owned at public/sayplay.js:684 |
| B159 | picture-pizza-step-2.mp3 | Spread the sauce all over. | Pizza Chef: the direction for step 2. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/pizza.js:36; said at public/pizza.js:502, public/pizza.js:548; owned at public/sayplay.js:684 |
| B160 | picture-pizza-step-3.mp3 | Move your finger to sprinkle cheese all over. | Pizza Chef: the direction for step 3. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/pizza.js:36; said at public/pizza.js:502, public/pizza.js:548; owned at public/sayplay.js:684 |
| B161 | picture-pizza-step-4.mp3 | Drag each pepperoni to a glowing spot. | Pizza Chef: the direction for step 4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/pizza.js:36; said at public/pizza.js:502, public/pizza.js:548; owned at public/sayplay.js:684 |
| B162 | picture-pizza-step-5.mp3 | Drag each pepper ring to a glowing spot. | Pizza Chef: the direction for step 5. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/pizza.js:36; said at public/pizza.js:502, public/pizza.js:548; owned at public/sayplay.js:684 |
| B163 | picture-pizza-step-6.mp3 | Drag each mushroom to a glowing spot. | Pizza Chef: the direction for step 6. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/pizza.js:36; said at public/pizza.js:502, public/pizza.js:548; owned at public/sayplay.js:684 |
| B164 | picture-pizza-step-7.mp3 | Hold Bake, let go in the green, tap Take out. | Pizza Chef: the direction for step 7. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/pizza.js:36; said at public/pizza.js:502, public/pizza.js:548; owned at public/sayplay.js:684 |
| B165 | picture-pizza-step-8.mp3 | Swipe along each dotted line to cut your pizza. | Pizza Chef: the direction for step 8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/pizza.js:36; said at public/pizza.js:502, public/pizza.js:548; owned at public/sayplay.js:684 |
| B166 | picture-puppy-step-1.mp3 | Touch the glowing muddy spot and hold to wash it. | Puppy Bath: the direction for step 1. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/puppy.js:28; said at public/puppy.js:155, public/puppy.js:185; owned at public/sayplay.js:684 |
| B167 | picture-puppy-step-2.mp3 | Touch the next glowing spot. Hold until the mud is gone. | Puppy Bath: the direction for step 2. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/puppy.js:28; said at public/puppy.js:155, public/puppy.js:185; owned at public/sayplay.js:684 |
| B168 | picture-puppy-step-3.mp3 | The puppy wiggles! Keep your finger on the glowing spot. | Puppy Bath: the direction for step 3. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/puppy.js:28; said at public/puppy.js:155, public/puppy.js:185; owned at public/sayplay.js:684 |
| B169 | picture-puppy-step-4.mp3 | Touch the glowing spot and hold for a gentle shower. | Puppy Bath: the direction for step 4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/puppy.js:28; said at public/puppy.js:155, public/puppy.js:185; owned at public/sayplay.js:684 |
| B170 | picture-puppy-step-5.mp3 | Last muddy spot! Touch it and hold to finish the bath. | Puppy Bath: the direction for step 5. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/puppy.js:28; said at public/puppy.js:155, public/puppy.js:185; owned at public/sayplay.js:684 |
| B171 | picture-racecar-help-1.mp3 | Follow the arrow into the ring. | Race Car: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/racecar.js:96; owned at public/sayplay.js:684 |
| B172 | picture-racecar-help-2.mp3 | Drag to steer into the glowing ring. | Race Car: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/racecar.js:96, public/racecar.js:123; owned at public/sayplay.js:684 |
| B173 | picture-robot-help-1.mp3 | Now press Test power! | Robot Builder: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/robot.js:301; owned at public/sayplay.js:684 |
| B174 | picture-rocket-help-1.mp3 | Pull the rocket down to the dots, then let go! | Rocket Blast: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/rocket.js:202; owned at public/sayplay.js:684 |
| B175 | picture-snowman-step-1.mp3 | Roll it back and forth. When it is big, lift it to the glowing circle. | Build a Snowman: the direction for step 1. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/snowman.js:5; said at public/snowman.js:214, public/snowman.js:232; owned at public/sayplay.js:684 |
| B176 | picture-snowman-step-2.mp3 | Roll another snowball, then lift it onto the middle circle. | Build a Snowman: the direction for step 2. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/snowman.js:5; said at public/snowman.js:214, public/snowman.js:232; owned at public/sayplay.js:684 |
| B177 | picture-snowman-step-3.mp3 | Roll the little snowball, then lift it onto the head circle. | Build a Snowman: the direction for step 3. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/snowman.js:5; said at public/snowman.js:214, public/snowman.js:232; owned at public/sayplay.js:684 |
| B178 | picture-snowman-step-4.mp3 | Drag the coal face and carrot onto the little snowball. | Build a Snowman: the direction for step 4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/snowman.js:5; said at public/snowman.js:214, public/snowman.js:232; owned at public/sayplay.js:684 |
| B179 | picture-snowman-step-5.mp3 | Drag the hat, scarf, and twig arms onto your snowman. | Build a Snowman: the direction for step 5. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/snowman.js:5; said at public/snowman.js:214, public/snowman.js:232; owned at public/sayplay.js:684 |
| B180 | picture-stars-step-1.mp3 | Start at the glowing star. Slide along the path to the next star. | Bedtime Stars: the direction for step 1. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/stars.js:21; said at public/stars.js:116, public/stars.js:126; owned at public/sayplay.js:684 |
| B181 | picture-stars-step-2.mp3 | Let's make a kite. Keep your finger on the glowing path. | Bedtime Stars: the direction for step 2. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/stars.js:21; said at public/stars.js:116, public/stars.js:126; owned at public/sayplay.js:684 |
| B182 | picture-stars-step-3.mp3 | A little house! Start at the bright star and follow each path. | Bedtime Stars: the direction for step 3. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/stars.js:21; said at public/stars.js:116, public/stars.js:126; owned at public/sayplay.js:684 |
| B183 | picture-stars-step-4.mp3 | Trace a sleepy little boat. Go from one glowing star to the next. | Bedtime Stars: the direction for step 4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/stars.js:21; said at public/stars.js:116, public/stars.js:126; owned at public/sayplay.js:684 |
| B184 | picture-stars-step-5.mp3 | One more picture. Follow the stars to make a little fish. | Bedtime Stars: the direction for step 5. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/stars.js:21; said at public/stars.js:116, public/stars.js:126; owned at public/sayplay.js:684 |
| B185 | picture-stars-help-1.mp3 | So close! Press the glowing star and follow the arrow. | Bedtime Stars: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/stars.js:50; owned at public/sayplay.js:684 |
| B186 | picture-stars-help-2.mp3 | Press the glowing star and slide toward the next one. | Bedtime Stars: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/stars.js:50; owned at public/sayplay.js:684 |
| B187 | picture-train-step-1.mp3 | Hold Forward. Let go by the friend. Then drag them into the door. | Choo-Choo Train: the direction for step 1. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/train.js:26; said at public/train.js:249, public/train.js:300; owned at public/sayplay.js:684 |
| B188 | picture-train-step-2.mp3 | Drive to the next friend, and let go. | Choo-Choo Train: the direction for step 2. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/train.js:26; said at public/train.js:249, public/train.js:300; owned at public/sayplay.js:684 |
| B189 | picture-train-step-3.mp3 | Next stop! Let go by the friend. | Choo-Choo Train: the direction for step 3. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/train.js:26; said at public/train.js:249, public/train.js:300; owned at public/sayplay.js:684 |
| B190 | picture-train-step-4.mp3 | Drive, stop, and help the next friend in. | Choo-Choo Train: the direction for step 4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/train.js:26; said at public/train.js:249, public/train.js:300; owned at public/sayplay.js:684 |
| B191 | picture-train-step-5.mp3 | One more friend! Stop, then drag them in. | Choo-Choo Train: the direction for step 5. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/train.js:26; said at public/train.js:249, public/train.js:300; owned at public/sayplay.js:684 |
| B192 | picture-train-help-1.mp3 | So close! Hold Back. | Choo-Choo Train: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/train.js:219; said at public/train.js:223; owned at public/sayplay.js:684 |
| B193 | picture-train-help-2.mp3 | Nearly! Hold Forward. | Choo-Choo Train: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/train.js:219; said at public/train.js:223; owned at public/sayplay.js:684 |
| B194 | picture-train-help-3.mp3 | So close! Drag them into the door. | Choo-Choo Train: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/train.js:219; said at public/train.js:223; owned at public/sayplay.js:684 |
| B195 | picture-treasure-help-1.mp3 | Follow the glowing line from your boat. | Treasure Map: a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/treasure.js:92; owned at public/sayplay.js:684 |
| B196 | picture-lighthouse-step-1.mp3 | Move the light over the fog. Find the tugboat! | Light the Way (Day 1 of the daily story): the direction for step 1 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/lighthouse.js:39; said at public/lighthouse.js:865, public/lighthouse.js:885; owned at public/sayplay.js:684 |
| B197 | picture-lighthouse-step-2.mp3 | Find the rowboat with the three mice! | Light the Way (Day 1 of the daily story): the direction for step 2 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/lighthouse.js:39; said at public/lighthouse.js:865, public/lighthouse.js:885; owned at public/sayplay.js:684 |
| B198 | picture-lighthouse-step-3.mp3 | The sailboat is drifting. Find it with the light! | Light the Way (Day 1 of the daily story): the direction for step 3 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/lighthouse.js:39; said at public/lighthouse.js:865, public/lighthouse.js:885; owned at public/sayplay.js:684 |
| B199 | picture-lighthouse-step-4.mp3 | Find the banana boat! Something big is napping out there. | Light the Way (Day 1 of the daily story): the direction for step 4 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/lighthouse.js:39; said at public/lighthouse.js:865, public/lighthouse.js:885; owned at public/sayplay.js:684 |
| B200 | picture-lighthouse-step-5.mp3 | Uh oh, the moon went behind a cloud. Look by the big rocks for the teacup boat! | Light the Way (Day 1 of the daily story): the direction for step 5 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/lighthouse.js:39; said at public/lighthouse.js:865, public/lighthouse.js:885; owned at public/sayplay.js:684 |
| B201 | picture-lighthouse-step-6.mp3 | Find the bathtub boat. Rub-a-dub! | Light the Way (Day 1 of the daily story): the direction for step 6 for ages 5-8 and step 4 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/lighthouse.js:49; public/lighthouse.js:39; said at public/lighthouse.js:865, public/lighthouse.js:885; owned at public/sayplay.js:684 |
| B202 | picture-lighthouse-step-7.mp3 | Find the big ferry and bring everyone home! | Light the Way (Day 1 of the daily story): the direction for step 7 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/lighthouse.js:39; said at public/lighthouse.js:865, public/lighthouse.js:885; owned at public/sayplay.js:684 |
| B203 | picture-lighthouse-step-8.mp3 | Now shine the light on the town. Light up every window! | Light the Way (Day 1 of the daily story): the direction for step 8 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/lighthouse.js:39; said at public/lighthouse.js:865, public/lighthouse.js:885; owned at public/sayplay.js:684 |
| B204 | picture-lighthouse-little-step-1.mp3 | Touch the glowing tugboat with the light! | Light the Way (Day 1 of the daily story): the direction for step 1 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/lighthouse.js:49; said at public/lighthouse.js:865, public/lighthouse.js:885; owned at public/sayplay.js:684 |
| B205 | picture-lighthouse-little-step-2.mp3 | Now the rowboat! Touch it with the light. | Light the Way (Day 1 of the daily story): the direction for step 2 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/lighthouse.js:49; said at public/lighthouse.js:865, public/lighthouse.js:885; owned at public/sayplay.js:684 |
| B206 | picture-lighthouse-little-step-3.mp3 | Find the banana boat with the light! | Light the Way (Day 1 of the daily story): the direction for step 3 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/lighthouse.js:49; said at public/lighthouse.js:865, public/lighthouse.js:885; owned at public/sayplay.js:684 |
| B207 | picture-lighthouse-little-step-5.mp3 | Find the sailboat with the light! | Light the Way (Day 1 of the daily story): the direction for step 5 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/lighthouse.js:49; said at public/lighthouse.js:865, public/lighthouse.js:885; owned at public/sayplay.js:684 |
| B208 | picture-lighthouse-little-step-6.mp3 | Touch every window with the light! | Light the Way (Day 1 of the daily story): the direction for step 6 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/lighthouse.js:49; said at public/lighthouse.js:865, public/lighthouse.js:885; owned at public/sayplay.js:684 |
| B209 | picture-windup-step-1.mp3 | Draw circles around the key to wind it. Let go at the star! | Wind-Up Toys (Day 2 of the daily story): the direction for step 1 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/windup.js:73; said at public/windup.js:935, public/windup.js:1066; owned at public/sayplay.js:684 |
| B210 | picture-windup-step-2.mp3 | Wind up the frog. Let go when the needle reaches the star! | Wind-Up Toys (Day 2 of the daily story): the direction for step 2 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/windup.js:73; said at public/windup.js:935, public/windup.js:1066; owned at public/sayplay.js:684 |
| B211 | picture-windup-step-3.mp3 | Wind up the spinning top. Round and round, then let go at the star! | Wind-Up Toys (Day 2 of the daily story): the direction for step 3 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/windup.js:73; said at public/windup.js:935, public/windup.js:1066; owned at public/sayplay.js:684 |
| B212 | picture-windup-step-4.mp3 | Wind up the crocodile. Clack, clack! | Wind-Up Toys (Day 2 of the daily story): the direction for step 4 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/windup.js:73; said at public/windup.js:935, public/windup.js:1066; owned at public/sayplay.js:684 |
| B213 | picture-windup-step-5.mp3 | Cuckoo! Now the big toys on the top shelf. Their keys need more turns. | Wind-Up Toys (Day 2 of the daily story): the direction for step 5 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/windup.js:73; said at public/windup.js:935, public/windup.js:1066; owned at public/sayplay.js:684 |
| B214 | picture-windup-step-6.mp3 | Wind up the jack-in-the-box. Let go at the star, and pop! | Wind-Up Toys (Day 2 of the daily story): the direction for step 6 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/windup.js:73; said at public/windup.js:935, public/windup.js:1066; owned at public/sayplay.js:684 |
| B215 | picture-windup-step-7.mp3 | Wind up the hippo. She wants to dance! | Wind-Up Toys (Day 2 of the daily story): the direction for step 7 for ages 5-8 and step 4 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/windup.js:83; public/windup.js:73; said at public/windup.js:935, public/windup.js:1066; owned at public/sayplay.js:684 |
| B216 | picture-windup-step-8.mp3 | Turn the big crank on the music box to start the parade! | Wind-Up Toys (Day 2 of the daily story): the direction for step 8 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/windup.js:73; said at public/windup.js:935, public/windup.js:1066; owned at public/sayplay.js:684 |
| B217 | picture-windup-little-step-1.mp3 | Draw circles on the key until it rings! | Wind-Up Toys (Day 2 of the daily story): the direction for step 1 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/windup.js:83; said at public/windup.js:935, public/windup.js:1066; owned at public/sayplay.js:684 |
| B218 | picture-windup-little-step-2.mp3 | Wind up the frog until it rings! | Wind-Up Toys (Day 2 of the daily story): the direction for step 2 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/windup.js:83; said at public/windup.js:935, public/windup.js:1066; owned at public/sayplay.js:684 |
| B219 | picture-windup-little-step-3.mp3 | Wind up the elephant. Round and round! | Wind-Up Toys (Day 2 of the daily story): the direction for step 3 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/windup.js:83; said at public/windup.js:935, public/windup.js:1066; owned at public/sayplay.js:684 |
| B220 | picture-windup-little-step-5.mp3 | Wind up the spinning top! | Wind-Up Toys (Day 2 of the daily story): the direction for step 5 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/windup.js:83; said at public/windup.js:935, public/windup.js:1066; owned at public/sayplay.js:684 |
| B221 | picture-windup-little-step-6.mp3 | Turn the big crank to start the parade! | Wind-Up Toys (Day 2 of the daily story): the direction for step 6 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/windup.js:83; said at public/windup.js:935, public/windup.js:1066; owned at public/sayplay.js:684 |
| B222 | picture-bridge-step-1.mp3 | Tap the stone to turn it. Then slide it into its hole! | Puzzle Bridge (Day 3 of the daily story): the direction for step 1 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/bridge.js:36; said at public/bridge.js:1049, public/bridge.js:1079; owned at public/sayplay.js:684 |
| B223 | picture-bridge-step-2.mp3 | Turn the stone the right way, then slide it in. Click! | Puzzle Bridge (Day 3 of the daily story): the direction for step 2 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/bridge.js:36; said at public/bridge.js:1049, public/bridge.js:1079; owned at public/sayplay.js:684 |
| B224 | picture-bridge-step-3.mp3 | This one looks like a boot! Turn it and fit it. | Puzzle Bridge (Day 3 of the daily story): the direction for step 3 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/bridge.js:36; said at public/bridge.js:1049, public/bridge.js:1079; owned at public/sayplay.js:684 |
| B225 | picture-bridge-step-4.mp3 | Look at the hole. Turn the stone to match, then slide it in. | Puzzle Bridge (Day 3 of the daily story): the direction for step 4 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/bridge.js:36; said at public/bridge.js:1049, public/bridge.js:1079; owned at public/sayplay.js:684 |
| B226 | picture-bridge-step-5.mp3 | The river is rising! Grab the stone from the water. Then turn it and fit it. | Puzzle Bridge (Day 3 of the daily story): the direction for step 5 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/bridge.js:36; said at public/bridge.js:1049, public/bridge.js:1079; owned at public/sayplay.js:684 |
| B227 | picture-bridge-step-6.mp3 | Catch the floating stone. Turn it, and slide it in! | Puzzle Bridge (Day 3 of the daily story): the direction for step 6 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/bridge.js:36; said at public/bridge.js:1049, public/bridge.js:1079; owned at public/sayplay.js:684 |
| B228 | picture-bridge-step-7.mp3 | Up high now! Turn the stone and fit it in the arch. | Puzzle Bridge (Day 3 of the daily story): the direction for step 7 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/bridge.js:36; said at public/bridge.js:1049, public/bridge.js:1079; owned at public/sayplay.js:684 |
| B229 | picture-bridge-step-8.mp3 | The last stone is the heart. Put it at the very top! | Puzzle Bridge (Day 3 of the daily story): the direction for step 8 for ages 5-8. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/bridge.js:36; said at public/bridge.js:1049, public/bridge.js:1079; owned at public/sayplay.js:684 |
| B230 | picture-bridge-little-step-1.mp3 | Slide the stone into the hole with the same shape! | Puzzle Bridge (Day 3 of the daily story): the direction for step 1 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/bridge.js:46; said at public/bridge.js:1049, public/bridge.js:1079; owned at public/sayplay.js:684 |
| B231 | picture-bridge-little-step-2.mp3 | Which hole is the same shape? Slide it in! | Puzzle Bridge (Day 3 of the daily story): the direction for step 2 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/bridge.js:46; said at public/bridge.js:1049, public/bridge.js:1079; owned at public/sayplay.js:684 |
| B232 | picture-bridge-little-step-3.mp3 | Find the hole that matches. Click! | Puzzle Bridge (Day 3 of the daily story): the direction for step 3 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/bridge.js:46; said at public/bridge.js:1049, public/bridge.js:1079; owned at public/sayplay.js:684 |
| B233 | picture-bridge-little-step-4.mp3 | Look, ducks! Slide the stone into its hole. | Puzzle Bridge (Day 3 of the daily story): the direction for step 4 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/bridge.js:46; said at public/bridge.js:1049, public/bridge.js:1079; owned at public/sayplay.js:684 |
| B234 | picture-bridge-little-step-5.mp3 | Find the same shape and slide it in! | Puzzle Bridge (Day 3 of the daily story): the direction for step 5 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/bridge.js:46; said at public/bridge.js:1049, public/bridge.js:1079; owned at public/sayplay.js:684 |
| B235 | picture-bridge-little-step-6.mp3 | The heart goes on top. Slide it in! | Puzzle Bridge (Day 3 of the daily story): the direction for step 6 for ages 3-4. Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | lines at public/bridge.js:46; said at public/bridge.js:1049, public/bridge.js:1079; owned at public/sayplay.js:684 |
| B236 | picture-waterwheel-help-1.mp3 | Match the trough outlines. Curved arrows turn them. Tap the water drop to open the gate. | The Thirsty Waterwheel Garden (Day 4 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/waterwheel.js:97; owned at public/sayplay.js:684 |
| B237 | picture-waterwheel-help-2.mp3 | Add the pond trough. Tap the water drop, then the split stream. | The Thirsty Waterwheel Garden (Day 4 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/waterwheel.js:97; owned at public/sayplay.js:684 |
| B238 | picture-waterwheel-help-3.mp3 | Add the pond trough. Open the water and share it. | The Thirsty Waterwheel Garden (Day 4 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/waterwheel.js:97; owned at public/sayplay.js:684 |
| B239 | picture-waterwheel-help-4.mp3 | Join the spring to the wheel, then open the water. | The Thirsty Waterwheel Garden (Day 4 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/waterwheel.js:97; owned at public/sayplay.js:684 |
| B240 | picture-waterwheel-help-5.mp3 | Catch the lifted water in the little tank. | The Thirsty Waterwheel Garden (Day 4 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/waterwheel.js:97; owned at public/sayplay.js:684 |
| B241 | picture-waterwheel-help-6.mp3 | Build a route to the last bed. Keep the fork for the pond. | The Thirsty Waterwheel Garden (Day 4 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/waterwheel.js:97; owned at public/sayplay.js:684 |
| B242 | picture-waterwheel-help-7.mp3 | Move the troughs to the outlines, then open the water. | The Thirsty Waterwheel Garden (Day 4 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/waterwheel.js:97; owned at public/sayplay.js:684 |
| B243 | picture-waterwheel-help-8.mp3 | Move each trough once more. The leaves will guide it into place. | The Thirsty Waterwheel Garden (Day 4 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/waterwheel.js:123; owned at public/sayplay.js:684 |
| B244 | picture-waterwheel-help-9.mp3 | Match the glowing outlines. Turn the trough with the curved arrows. | The Thirsty Waterwheel Garden (Day 4 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/waterwheel.js:124; owned at public/sayplay.js:684 |
| B245 | picture-waterwheel-help-10.mp3 | Follow the water to the gap. Move or turn that trough, then try the gate again. | The Thirsty Waterwheel Garden (Day 4 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/waterwheel.js:428; owned at public/sayplay.js:684 |
| B246 | picture-postboat-help-1.mp3 | Follow three buoys through the reeds. Stop beside the last buoy, then check the channel. | The Little Island Postboat (Day 5 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/postboat.js:88; owned at public/sayplay.js:684 |
| B247 | picture-postboat-help-2.mp3 | Take the wide channel. The raft follows. Pass the buoys, stop, then steady the tow. | The Little Island Postboat (Day 5 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/postboat.js:88; owned at public/sayplay.js:684 |
| B248 | picture-postboat-help-3.mp3 | Stop by the floating jetty. Tap the rope loop, then the linked ropes to attach. | The Little Island Postboat (Day 5 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/postboat.js:88; owned at public/sayplay.js:684 |
| B249 | picture-postboat-help-4.mp3 | Approach Beaver from the left. Follow the arrow. Stop, dock with the rope loop, then unload. | The Little Island Postboat (Day 5 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/postboat.js:88; owned at public/sayplay.js:684 |
| B250 | picture-postboat-help-5.mp3 | Hold arrows or drag. Stop by the dock. Tap the rope loop, then the parcel. | The Little Island Postboat (Day 5 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/postboat.js:88; owned at public/sayplay.js:684 |
| B251 | picture-postboat-help-6.mp3 | Stop by the jetty. Tap the rope loop to dock, then each parcel to load. | The Little Island Postboat (Day 5 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/postboat.js:88; owned at public/sayplay.js:684 |
| B252 | picture-postboat-help-7.mp3 | Follow the parcel picture. Follow the dock arrow. Stop, tap the rope loop, then unload. | The Little Island Postboat (Day 5 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/postboat.js:88; owned at public/sayplay.js:684 |
| B253 | picture-postboat-help-8.mp3 | Tap the square stop button. Then tap the rope-loop picture to dock. | The Little Island Postboat (Day 5 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/postboat.js:149; owned at public/sayplay.js:684 |
| B254 | picture-postboat-help-9.mp3 | Turn the boat's point along the pale arrow. Then tap the rope-loop picture to dock. | The Little Island Postboat (Day 5 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/postboat.js:150; owned at public/sayplay.js:684 |
| B255 | picture-postboat-help-10.mp3 | Steer a little closer to the rope-loop picture. Then try again. | The Little Island Postboat (Day 5 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/postboat.js:151; owned at public/sayplay.js:684 |
| B256 | picture-postboat-help-11.mp3 | The current is gentler now. Follow the open water to the glowing dock. | The Little Island Postboat (Day 5 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/postboat.js:260; owned at public/sayplay.js:684 |
| B257 | picture-bakery-help-1.mp3 | Hold the flour cup over the bowl. Pour to the picture line. Let go, then tap the check. | Breakfast at the Moonberry Bakery (Day 6 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bakery.js:105; owned at public/sayplay.js:684 |
| B258 | picture-bakery-help-2.mp3 | Hold the jug over the bowl. Pour to the picture line. Let go, then tap the check. | Breakfast at the Moonberry Bakery (Day 6 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bakery.js:105; owned at public/sayplay.js:684 |
| B259 | picture-bakery-help-3.mp3 | Hold the spoon. Stir in circles around the bowl until the dough comes together. | Breakfast at the Moonberry Bakery (Day 6 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bakery.js:105; owned at public/sayplay.js:684 |
| B260 | picture-bakery-help-4.mp3 | Rub the little dough dots. Pick up the round bun and drag it onto the tray. | Breakfast at the Moonberry Bakery (Day 6 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bakery.js:105; owned at public/sayplay.js:684 |
| B261 | picture-bakery-help-5.mp3 | Follow the curling rope from its glowing tip. Drag the finished bun onto the tray. | Breakfast at the Moonberry Bakery (Day 6 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bakery.js:105; owned at public/sayplay.js:684 |
| B262 | picture-bakery-help-6.mp3 | Rub a well in the middle. Add berries with the spoon, then drag the bun onto its tray. | Breakfast at the Moonberry Bakery (Day 6 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bakery.js:105; owned at public/sayplay.js:684 |
| B263 | picture-bakery-help-7.mp3 | Drag a tray into the oven. Set heat to gold. When golden, drag it onto the rack. | Breakfast at the Moonberry Bakery (Day 6 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bakery.js:105; owned at public/sayplay.js:684 |
| B264 | picture-bakery-help-8.mp3 | Match each bun to its picture basket. The little bun pictures choose the next tray. | Breakfast at the Moonberry Bakery (Day 6 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bakery.js:105; owned at public/sayplay.js:684 |
| B265 | picture-bakery-help-9.mp3 | Take your time. The glowing picture gives your hands more room. | Breakfast at the Moonberry Bakery (Day 6 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bakery.js:113; owned at public/sayplay.js:684 |
| B266 | picture-bakery-help-10.mp3 | A little more. Hold the cup above the bowl until it reaches the picture line. | Breakfast at the Moonberry Bakery (Day 6 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bakery.js:116; owned at public/sayplay.js:684 |
| B267 | picture-bakery-help-11.mp3 | Tap the flat spoon picture to level off the extra. Your dough stays in the bowl. | Breakfast at the Moonberry Bakery (Day 6 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bakery.js:117; owned at public/sayplay.js:684 |
| B268 | picture-bakery-help-12.mp3 | Pick up the berry spoon and put its berries in the little well. | Breakfast at the Moonberry Bakery (Day 6 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bakery.js:147; owned at public/sayplay.js:684 |
| B269 | picture-bakery-help-13.mp3 | The buns need a little more golden warmth. Your tray is safe in the oven. | Breakfast at the Moonberry Bakery (Day 6 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bakery.js:191; owned at public/sayplay.js:684 |
| B270 | picture-frontdoor-help-1.mp3 | Drag the hook onto wood. Link, lift above the glow, turn, lower, then unlink. | Tortoise's New Front Door (Day 7 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bridge.js:88; owned at public/sayplay.js:684 |
| B271 | picture-frontdoor-help-2.mp3 | Hold arrows or drag along the dotted path. Stop at the green door, then tap the bell. | Tortoise's New Front Door (Day 7 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bridge.js:88; owned at public/sayplay.js:684 |
| B272 | picture-frontdoor-help-3.mp3 | The glowing landing is wider. Keep the hook over the picture and lower slowly. | Tortoise's New Front Door (Day 7 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bridge.js:90; owned at public/sayplay.js:684 |
| B273 | picture-frontdoor-help-4.mp3 | Lower the hook until it touches the waiting wood, then tap the rope link. | Tortoise's New Front Door (Day 7 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bridge.js:93; owned at public/sayplay.js:684 |
| B274 | picture-frontdoor-help-5.mp3 | Lift the wood a little higher than its glowing place. Then lower it onto the supports. | Tortoise's New Front Door (Day 7 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bridge.js:95; owned at public/sayplay.js:684 |
| B275 | picture-frontdoor-help-6.mp3 | Tap the turning arrows until the wood matches the glowing shape. Your piece stays on the hook. | Tortoise's New Front Door (Day 7 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bridge.js:96; owned at public/sayplay.js:684 |
| B276 | picture-frontdoor-help-7.mp3 | Bring the cart to the green door. Tap the square stop picture, then the bell. | Tortoise's New Front Door (Day 7 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bridge.js:103; owned at public/sayplay.js:684 |
| B277 | picture-frontdoor-help-8.mp3 | Keep the wheels between the rails. Follow the dotted path to the green door. | Tortoise's New Front Door (Day 7 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/bridge.js:147; owned at public/sayplay.js:684 |
| B278 | picture-lantern-help-1.mp3 | Drag both cord ends to their sockets. Add the return cord, then close the pictured switch. | The Glowworm Lantern Walk (Day 8 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/lantern.js:59; owned at public/sayplay.js:684 |
| B279 | picture-lantern-help-2.mp3 | Match the socket circles. The glowing pulse shows where the connected cord can reach. | The Glowworm Lantern Walk (Day 8 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/lantern.js:61; owned at public/sayplay.js:684 |
| B280 | picture-lantern-help-3.mp3 | A wire went around the bulb. Lift that cord end, then follow the lamp picture. | The Glowworm Lantern Walk (Day 8 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/lantern.js:62; owned at public/sayplay.js:684 |
| B281 | picture-lantern-help-4.mp3 | Follow the return cord back to the power box. A gap keeps the lamp dark. | The Glowworm Lantern Walk (Day 8 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/lantern.js:62; owned at public/sayplay.js:684 |
| B282 | picture-lantern-help-5.mp3 | Pick up a cord end, then drag it onto a socket circle. | The Glowworm Lantern Walk (Day 8 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/lantern.js:75; owned at public/sayplay.js:684 |
| B283 | picture-trainline-help-1.mp3 | Stop at the sled sign. Move Squirrel onto the platform. | All Aboard for Snowdrop Valley (Day 9 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/trainline.js:99; owned at public/sayplay.js:684 |
| B284 | picture-trainline-help-2.mp3 | Stop at the cottage sign. Move Badger onto the platform. | All Aboard for Snowdrop Valley (Day 9 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/trainline.js:99; owned at public/sayplay.js:684 |
| B285 | picture-trainline-help-3.mp3 | Stop at the pond sign. Move the duck family onto the platform. | All Aboard for Snowdrop Valley (Day 9 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/trainline.js:99; owned at public/sayplay.js:684 |
| B286 | picture-trainline-help-4.mp3 | The rails stop here. Stop, then use the back arrow or build the next track. | All Aboard for Snowdrop Valley (Day 9 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/trainline.js:100; owned at public/sayplay.js:684 |
| B287 | picture-trainline-help-5.mp3 | Drag all three neighbour pictures into the carriage. Hold the forward arrow when everyone is aboard. | All Aboard for Snowdrop Valley (Day 9 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/trainline.js:102; owned at public/sayplay.js:684 |
| B288 | picture-trainline-help-6.mp3 | Turn the track to match. Drag it until both rail ends join their glowing circles. | All Aboard for Snowdrop Valley (Day 9 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/trainline.js:109; owned at public/sayplay.js:684 |
| B289 | picture-trainline-help-7.mp3 | Bring the train home. Board the crew, choose the hill picture, then drive past every stop. | All Aboard for Snowdrop Valley (Day 9 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/trainline.js:109; owned at public/sayplay.js:684 |
| B290 | picture-trainline-help-8.mp3 | Board the neighbours. Choose the sled picture. Hold Go, stop, then move Squirrel onto its platform. | All Aboard for Snowdrop Valley (Day 9 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/trainline.js:109; owned at public/sayplay.js:684 |
| B291 | picture-trainline-help-9.mp3 | Back to the fork. Choose the cottage picture, drive, stop, then move Badger onto the platform. | All Aboard for Snowdrop Valley (Day 9 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/trainline.js:109; owned at public/sayplay.js:684 |
| B292 | picture-trainline-help-10.mp3 | Follow the pond rails. Stop the train, then move the duck family onto the pond platform. | All Aboard for Snowdrop Valley (Day 9 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/trainline.js:109; owned at public/sayplay.js:684 |
| B293 | picture-trainline-help-11.mp3 | Turn the track to match, then put both ends inside the glowing circles. | All Aboard for Snowdrop Valley (Day 9 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/trainline.js:118; owned at public/sayplay.js:684 |
| B294 | picture-trainline-help-12.mp3 | Tap Stop beside the matching picture platform. Then drag the passenger onto it. | All Aboard for Snowdrop Valley (Day 9 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/trainline.js:122; owned at public/sayplay.js:684 |
| B295 | picture-trainline-help-13.mp3 | The crew is home. Ring the home bell! | All Aboard for Snowdrop Valley (Day 9 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/trainline.js:128; owned at public/sayplay.js:684 |
| B296 | picture-trainline-help-14.mp3 | Bring the crew past all three picture stops. Stop at home, then ring the bell. | All Aboard for Snowdrop Valley (Day 9 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/trainline.js:131; owned at public/sayplay.js:684 |
| B297 | picture-kite-help-1.mp3 | Drag each cloth picture onto its matching pale picture on the kite. | The Hilltop Patchwork Kite (Day 10 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/kite.js:68; owned at public/sayplay.js:684 |
| B298 | picture-kite-help-2.mp3 | Hold the needle. Follow every bend, then lift at the last dot. | The Hilltop Patchwork Kite (Day 10 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/kite.js:68; owned at public/sayplay.js:684 |
| B299 | picture-kite-help-3.mp3 | Follow the dots. Take the ribbon through the hole, around, and back through. | The Hilltop Patchwork Kite (Day 10 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/kite.js:68; owned at public/sayplay.js:684 |
| B300 | picture-kite-help-4.mp3 | Tap the test kite. Move the heavy bows between hooks, then test again. | The Hilltop Patchwork Kite (Day 10 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/kite.js:68; owned at public/sayplay.js:684 |
| B301 | picture-kite-help-5.mp3 | Hold Up or pull the kite upward. Steer through the breeze circles, then tap the hand. | The Hilltop Patchwork Kite (Day 10 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/kite.js:68; owned at public/sayplay.js:684 |
| B302 | picture-kite-help-6.mp3 | One side dips. Move a heavy bow towards the other side, then test again. | The Hilltop Patchwork Kite (Day 10 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/kite.js:85; owned at public/sayplay.js:684 |
| B303 | picture-kite-help-7.mp3 | Guide the kite through every breeze circle, then tap the hand inside the last one. | The Hilltop Patchwork Kite (Day 10 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/kite.js:86; owned at public/sayplay.js:684 |
| B304 | picture-kite-help-8.mp3 | Give the ribbon a small pull, then lift your finger. | The Hilltop Patchwork Kite (Day 10 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/kite.js:102; owned at public/sayplay.js:684 |
| B305 | picture-nestlift-help-1.mp3 | Hold the basket. Slide it along the golden rail into the top nest, then lift your finger. | The Sandstone Nest Lift (Day 11 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/nestlift.js:57; owned at public/sayplay.js:684 |
| B306 | picture-nestlift-help-2.mp3 | Hold Up to lift. Stop beside the glowing nest, then drag the bundle inside. | The Sandstone Nest Lift (Day 11 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/nestlift.js:57; owned at public/sayplay.js:684 |
| B307 | picture-nestlift-help-3.mp3 | Lower the basket. Drag this bundle inside. Move stones until the beam lies level. | The Sandstone Nest Lift (Day 11 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/nestlift.js:57; owned at public/sayplay.js:684 |
| B308 | picture-nestlift-help-4.mp3 | Let the beam settle. Tap Stop beside the top nest. | The Sandstone Nest Lift (Day 11 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/nestlift.js:61; owned at public/sayplay.js:684 |
| B309 | picture-nestlift-help-5.mp3 | Drag the bundle from its basket into the glowing nest. | The Sandstone Nest Lift (Day 11 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/nestlift.js:61; owned at public/sayplay.js:684 |
| B310 | picture-nestlift-help-6.mp3 | Both sides match. Hold Up. Tap Stop beside the glowing nest. | The Sandstone Nest Lift (Day 11 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/nestlift.js:69; owned at public/sayplay.js:684 |
| B311 | picture-nestlift-help-7.mp3 | Move stones into the other basket. Match the bundle's weight dots. | The Sandstone Nest Lift (Day 11 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/nestlift.js:70; owned at public/sayplay.js:684 |
| B312 | picture-nestlift-help-8.mp3 | Give the basket a small slide, then lift your finger inside the doorway. | The Sandstone Nest Lift (Day 11 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/nestlift.js:91; owned at public/sayplay.js:684 |
| B313 | picture-nestlift-help-9.mp3 | Match the bundle's weight dots with stones in the other basket. | The Sandstone Nest Lift (Day 11 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/nestlift.js:112; owned at public/sayplay.js:684 |
| B314 | picture-concert-help-1.mp3 | Your places are safe. Seat the musicians, then choose the opening and ending. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:28; owned at public/sayplay.js:684 |
| B315 | picture-concert-help-2.mp3 | Listen to the pictured pattern. Then play its notes on the beat. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:28; owned at public/sayplay.js:684 |
| B316 | picture-concert-help-3.mp3 | Your notes are safe. Follow the next picture dot on the beat. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:28; owned at public/sayplay.js:684 |
| B317 | picture-concert-help-4.mp3 | Your music is safe. Guide your hand into the glowing instrument on the beat. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:28; owned at public/sayplay.js:684 |
| B318 | picture-concert-help-5.mp3 | Raise your hand into the pale circle, then lift your finger. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:28; owned at public/sayplay.js:684 |
| B319 | picture-concert-help-6.mp3 | Choose a bell or drum ending, then raise your hand. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:28; owned at public/sayplay.js:684 |
| B320 | picture-concert-help-7.mp3 | Your sounds are safe. Try the pictured instruments. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:28; owned at public/sayplay.js:684 |
| B321 | picture-concert-help-8.mp3 | Listen. Pull the pictured reed sideways. Release it when the dot reaches the leaf. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:40; owned at public/sayplay.js:684 |
| B322 | picture-concert-help-9.mp3 | Listen. Touch the pictured bell when the dot reaches the leaf. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:40; owned at public/sayplay.js:684 |
| B323 | picture-concert-help-10.mp3 | Listen. Tap the drum when each bouncing dot reaches the leaf. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:40; owned at public/sayplay.js:684 |
| B324 | picture-concert-help-11.mp3 | Touch both bells. Listen for their low and high sounds. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:46; owned at public/sayplay.js:684 |
| B325 | picture-concert-help-12.mp3 | Tap the drum. Pull each reed sideways, then lift to hear its note. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:46; owned at public/sayplay.js:684 |
| B326 | picture-concert-help-13.mp3 | Tap the drum. Pull a reed sideways, then lift. Touch the little bells. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:46; owned at public/sayplay.js:684 |
| B327 | picture-concert-help-14.mp3 | Drag each musician onto an empty leaf circle. Then choose which instrument begins. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:46; owned at public/sayplay.js:684 |
| B328 | picture-concert-help-15.mp3 | Raise your hand into the pale circle. Then guide it into each glowing instrument on the beat. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:46; owned at public/sayplay.js:684 |
| B329 | picture-concert-help-16.mp3 | Choose a bell or drum ending. Raise your hand into the pale circle, then lift. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:46; owned at public/sayplay.js:684 |
| B330 | picture-concert-help-17.mp3 | Guide your hand into the glowing instrument when the dot touches its leaf. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:61; owned at public/sayplay.js:684 |
| B331 | picture-concert-help-18.mp3 | Give your hand a small lift, then lift your finger. | The Lily-Pad Concert (Day 12 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/concert.js:86; owned at public/sayplay.js:684 |
| B332 | picture-rooftops-help-1.mp3 | The rooftop gardens are waiting for their seeds. | Seeds Across the Rooftops (Day 13 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/rooftops.js:32, public/daily-adventures/rooftops.js:64; owned at public/sayplay.js:684 |
| B333 | picture-rooftops-help-2.mp3 | Watch the pod. The gutter brings every missed seed back. | Seeds Across the Rooftops (Day 13 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/rooftops.js:32, public/daily-adventures/rooftops.js:64; owned at public/sayplay.js:684 |
| B334 | picture-rooftops-help-3.mp3 | Bounce the pod on the striped awning. Let it fall into the sheltered soil. | Seeds Across the Rooftops (Day 13 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/rooftops.js:32, public/daily-adventures/rooftops.js:64; owned at public/sayplay.js:684 |
| B335 | picture-rooftops-help-4.mp3 | Load a curled seed. Aim for the glowing arch planter. | Seeds Across the Rooftops (Day 13 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/rooftops.js:32, public/daily-adventures/rooftops.js:64; owned at public/sayplay.js:684 |
| B336 | picture-rooftops-help-5.mp3 | Turn the arrow. Pull the spring. Tap the launch picture. | Seeds Across the Rooftops (Day 13 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/rooftops.js:32, public/daily-adventures/rooftops.js:43, public/daily-adventures/rooftops.js:64; owned at public/sayplay.js:684 |
| B337 | picture-rooftops-help-6.mp3 | Put a seed in the cup. Turn the arrow, pull the spring, then tap launch. | Seeds Across the Rooftops (Day 13 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/rooftops.js:32, public/daily-adventures/rooftops.js:64; owned at public/sayplay.js:684 |
| B338 | picture-rooftops-help-7.mp3 | Put the pod inside the little cup. | Seeds Across the Rooftops (Day 13 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/rooftops.js:43; owned at public/sayplay.js:684 |
| B339 | picture-rooftops-help-8.mp3 | Bounce on the striped awning before landing in the sheltered planter. | Seeds Across the Rooftops (Day 13 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/rooftops.js:61; owned at public/sayplay.js:684 |
| B340 | picture-rooftops-help-9.mp3 | Aim for the glowing planter. The gutter will return this pod. | Seeds Across the Rooftops (Day 13 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/rooftops.js:61; owned at public/sayplay.js:684 |
| B341 | picture-rooftops-help-10.mp3 | The shelter roof stopped that pod. Try the striped awning. | Seeds Across the Rooftops (Day 13 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/rooftops.js:61; owned at public/sayplay.js:684 |
| B342 | picture-rooftops-help-11.mp3 | That pod met the roof. Turn the arrow for another curved flight. | Seeds Across the Rooftops (Day 13 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/rooftops.js:61; owned at public/sayplay.js:684 |
| B343 | picture-rooftops-help-12.mp3 | The gutter brings it back. Try another angle or spring pull. | Seeds Across the Rooftops (Day 13 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/rooftops.js:61; owned at public/sayplay.js:684 |
| B344 | picture-observatory-help-1.mp3 | Lift the middle gear back to the tray. Two small gears change the moon's direction. | The Moving-Star Observatory (Day 14 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/observatory.js:25, public/daily-adventures/observatory.js:72; owned at public/sayplay.js:684 |
| B345 | picture-observatory-help-2.mp3 | Fit the last gear. Hold the round arrow to move sun, moon and stars together. | The Moving-Star Observatory (Day 14 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/observatory.js:25, public/daily-adventures/observatory.js:72; owned at public/sayplay.js:684 |
| B346 | picture-observatory-help-3.mp3 | Fit a gear on the glowing axle. Hold the round arrow to turn the wheel. | The Moving-Star Observatory (Day 14 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/observatory.js:25, public/daily-adventures/observatory.js:72; owned at public/sayplay.js:684 |
| B347 | picture-observatory-help-4.mp3 | Try another gear size. Its teeth must touch without squeezing. | The Moving-Star Observatory (Day 14 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/observatory.js:36; owned at public/sayplay.js:684 |
| B348 | picture-observatory-help-5.mp3 | Hold the round arrow. Watch which gears and sky pictures move. | The Moving-Star Observatory (Day 14 of the daily story): a direction said during play (the next move, a nudge, or help after a miss: see where it is said). Through Say & Play's instruction owner: never into an open microphone; help, a pause and finishing the move cancel it. | Short, playful and clear. This describes the finger action, not a speech target. | said at public/daily-adventures/observatory.js:46; owned at public/sayplay.js:684 |


### B9 — The daily story (260)

Echo reads every scene of the day's story (`adventure.html`; the scenes are `adventures.js`, the days sona.js's `STORY_DAYS`): Pelly's letter and the problem before the game, the happy ending after it. Ages 3-4 skip the scenes marked ages 5-8 and hear the short lines (public/adventure.html:138, public/adventure.html:139). No scene asks the child to speak; the game's own word turn does (C8). Unlike B1-B8 these already have a player: a line plays from `public/assets/adventure/voice/<file>` when `/assets/adventure/voice/manifest.js` lists exactly those words (the file is named by the voice version and the words, public/adventure.html:201, so a re-worded line has no file and plays in the live voice: public/adventure.html:208); there is no manifest yet, so every line plays in the live voice (public/adventure.html:226), the browser's own voice the last resort (public/adventure.html:372). Nothing is said while Sona's sound is off (public/adventure.html:412). Read at public/adventure.html:416; the lines ahead are fetched two at a time (public/adventure.html:245).

| # | File | Say this | When Echo says it | Delivery | Source |
|---|---|---|---|---|---|
| B349 | adventure/voice/dce9f013.mp3 | Look! Pelly the pelican brought us a letter. Oops. That's a fish! | Day 1 ("The Lighthouse Sneeze"), the story, s01, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:43 |
| B350 | adventure/voice/f79396b8.mp3 | Here's the real letter. It's from Captain Wally at the lighthouse. He needs our help tonight! | Day 1 ("The Lighthouse Sneeze"), the story, s02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:46 |
| B351 | adventure/voice/67d0c22b.mp3 | Here's the real letter. Captain Wally at the lighthouse needs our help! | Day 1 ("The Lighthouse Sneeze"), the story, s02, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:46 |
| B352 | adventure/voice/2435f132.mp3 | Captain Wally keeps the light that helps the boats get home. But he has a cold. Sniff, sniff! | Day 1 ("The Lighthouse Sneeze"), the story, s03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:50 |
| B353 | adventure/voice/2cae69a6.mp3 | This is Captain Wally. He has a cold. Sniff, sniff! | Day 1 ("The Lighthouse Sneeze"), the story, s03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:50 |
| B354 | adventure/voice/4e1ae031.mp3 | We climb up, up, up the twisty stairs to the big lamp. Puff, puff, puff! | Day 1 ("The Lighthouse Sneeze"), the story, s04, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:54 |
| B355 | adventure/voice/545883b4.mp3 | Ah... ah... ah-choo! Oh no! Captain Wally sneezed the lamp right out! | Day 1 ("The Lighthouse Sneeze"), the story, s05, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:57 |
| B356 | adventure/voice/062872d2.mp3 | Out on the sea, the little boats are coming home. But it's dark and foggy. Toot, toot? Which way? | Day 1 ("The Lighthouse Sneeze"), the story, s06, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:60 |
| B357 | adventure/voice/d8b13b54.mp3 | The little boats can't find their way home. It's too dark! | Day 1 ("The Lighthouse Sneeze"), the story, s06, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:60 |
| B358 | adventure/voice/205a2709.mp3 | Wally can't find his glasses. They're on his head! And if he gets near the lamp... ah-choo! Out it goes. | Day 1 ("The Lighthouse Sneeze"), the story, s07, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:64 |
| B359 | adventure/voice/44f42e04.mp3 | So it's up to us! Let's light the lamp, find every boat, and shine them all the way home. | Day 1 ("The Lighthouse Sneeze"), the story, s08, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:67 |
| B360 | adventure/voice/4b5385ef.mp3 | Let's light the lamp and find the little boats! | Day 1 ("The Lighthouse Sneeze"), the story, s08, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:67 |
| B361 | adventure/voice/827594cd.mp3 | Toot, toot, hooray! Every little boat is safe at home. | Day 1 ("The Lighthouse Sneeze"), the ending, e01, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:74 |
| B362 | adventure/voice/af6aea4e.mp3 | Even the sleepy whale woke up to say thank you. Splash! | Day 1 ("The Lighthouse Sneeze"), the ending, e02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:77 |
| B363 | adventure/voice/c1a6d059.mp3 | We found Wally's glasses. And this time, his sneeze was a teeny one. Achoo! | Day 1 ("The Lighthouse Sneeze"), the ending, e03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:80 |
| B364 | adventure/voice/0f0795d7.mp3 | Look! Wally's glasses were on his head the whole time. Silly Wally! | Day 1 ("The Lighthouse Sneeze"), the ending, e03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:80 |
| B365 | adventure/voice/84dc0e1c.mp3 | Cocoa for the heroes! You lit the way home. Our helper map gets its first gold star. | Day 1 ("The Lighthouse Sneeze"), the ending, e04, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:84 |
| B366 | adventure/voice/1d6ea599.mp3 | Pelly the pelican is back with a letter! Oops. That's a rubber duck. Squeak! | Day 2 ("Grandpa Bear's Sleepy Toys"), the story, s01, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:94 |
| B367 | adventure/voice/31964853.mp3 | It's from Grandpa Bear's toy shop. The Toy Parade is today! Hooray! | Day 2 ("Grandpa Bear's Sleepy Toys"), the story, s02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:97 |
| B368 | adventure/voice/a065ad92.mp3 | Grandpa Bear's toys have a parade today. Hooray! | Day 2 ("Grandpa Bear's Sleepy Toys"), the story, s02, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:97 |
| B369 | adventure/voice/013297ba.mp3 | The whole town is waiting in the square for the parade. But where are the toys? | Day 2 ("Grandpa Bear's Sleepy Toys"), the story, s03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:101 |
| B370 | adventure/voice/75add3e1.mp3 | Everyone is waiting for the parade. Where are the toys? | Day 2 ("Grandpa Bear's Sleepy Toys"), the story, s03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:101 |
| B371 | adventure/voice/5bb17f18.mp3 | Shh! The toys are fast asleep. They had a secret party all night long! | Day 2 ("Grandpa Bear's Sleepy Toys"), the story, s04, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:105 |
| B372 | adventure/voice/1b4b9aa3.mp3 | Now they're all out of wind. Their little keys won't turn by themselves. | Day 2 ("Grandpa Bear's Sleepy Toys"), the story, s05, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:108 |
| B373 | adventure/voice/983aed6c.mp3 | And Grandpa Bear is asleep too. He snores like a tuba! Honk-shoo, honk-shoo. | Day 2 ("Grandpa Bear's Sleepy Toys"), the story, s06, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:111 |
| B374 | adventure/voice/4798f0aa.mp3 | A wind-up toy needs just the right winding. Too little, it yawns. Too much, it spins! Just right, it marches. | Day 2 ("Grandpa Bear's Sleepy Toys"), the story, s07, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:114 |
| B375 | adventure/voice/c2f7522b.mp3 | Let's wind up every toy and get this parade going. Ready? | Day 2 ("Grandpa Bear's Sleepy Toys"), the story, s08, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:117 |
| B376 | adventure/voice/d3ed251b.mp3 | Let's wind up the toys for the parade. Ready? | Day 2 ("Grandpa Bear's Sleepy Toys"), the story, s08, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:117 |
| B377 | adventure/voice/52d401cc.mp3 | Here comes the Toy Parade! Rat-a-tat, toot, hop, twirl. Everybody cheers! | Day 2 ("Grandpa Bear's Sleepy Toys"), the ending, e01, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:124 |
| B378 | adventure/voice/8253891b.mp3 | Grandpa Bear woke up and ran out in his pajamas. Is it parade time? Yes, it is! | Day 2 ("Grandpa Bear's Sleepy Toys"), the ending, e02, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:127 |
| B379 | adventure/voice/0ffd90d8.mp3 | Look who came to watch! Captain Wally, with his glasses on, and the three little mice. | Day 2 ("Grandpa Bear's Sleepy Toys"), the ending, e03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:130 |
| B380 | adventure/voice/b1d499aa.mp3 | Two gold stars on our helper map! What a day. | Day 2 ("Grandpa Bear's Sleepy Toys"), the ending, e04, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:133 |
| B381 | adventure/voice/9992f569.mp3 | Pelly is here with a letter. Oops. That's a banana. Pelly, you silly bird! | Day 3 ("The Puzzle Bridge"), the story, s01, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:143 |
| B382 | adventure/voice/4c5ebb1d.mp3 | Here's the real letter. Grandma Tortoise is one hundred years old today! The party is on Blossom Island. | Day 3 ("The Puzzle Bridge"), the story, s02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:146 |
| B383 | adventure/voice/ccb8650a.mp3 | It's Grandma Tortoise's birthday! The party is on Blossom Island. | Day 3 ("The Puzzle Bridge"), the story, s02, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:146 |
| B384 | adventure/voice/63a7ecc9.mp3 | Everyone is going. Captain Wally has the cake, and Grandpa Bear's toys will play the music! | Day 3 ("The Puzzle Bridge"), the story, s03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:150 |
| B385 | adventure/voice/c5730563.mp3 | But look! Last night's storm shook the old bridge. Its stones fell in the river! | Day 3 ("The Puzzle Bridge"), the story, s04, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:153 |
| B386 | adventure/voice/9ef3b2fc.mp3 | Oh no! The storm broke the bridge. Its stones fell in the river! | Day 3 ("The Puzzle Bridge"), the story, s04, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:153 |
| B387 | adventure/voice/82cd0a3a.mp3 | Grandma Tortoise is waving from the island. Nobody can get across to the party! | Day 3 ("The Puzzle Bridge"), the story, s05, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:157 |
| B388 | adventure/voice/896995b5.mp3 | The stones are asleep on the river bottom. When they hear a word, up they float! | Day 3 ("The Puzzle Bridge"), the story, s06, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:160 |
| B389 | adventure/voice/b98e8b39.mp3 | Every stone fits just one hole. Turn it the right way, then slide it in. Click! | Day 3 ("The Puzzle Bridge"), the story, s07, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:163 |
| B390 | adventure/voice/8297a47e.mp3 | Every stone fits the hole with the same shape. Click! | Day 3 ("The Puzzle Bridge"), the story, s07, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:163 |
| B391 | adventure/voice/02cf6329.mp3 | Let's build the bridge back, stone by stone. Ready? | Day 3 ("The Puzzle Bridge"), the story, s08, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:167 |
| B392 | adventure/voice/e9665a35.mp3 | Let's fix the bridge, stone by stone. Ready? | Day 3 ("The Puzzle Bridge"), the story, s08, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:167 |
| B393 | adventure/voice/f5ed2a1b.mp3 | Click! The last stone fits. The bridge is whole again! | Day 3 ("The Puzzle Bridge"), the ending, e01, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:174 |
| B394 | adventure/voice/59c1e96e.mp3 | Everyone crosses. Captain Wally carries the cake, and the toys march and play! | Day 3 ("The Puzzle Bridge"), the ending, e02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:179 |
| B395 | adventure/voice/815eb96e.mp3 | Happy birthday, Grandma Tortoise! Everybody sings, and she blows out her candles. Whoosh! | Day 3 ("The Puzzle Bridge"), the ending, e03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:182 |
| B396 | adventure/voice/66424b09.mp3 | Happy birthday, Grandma Tortoise! Whoosh go the candles! | Day 3 ("The Puzzle Bridge"), the ending, e03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:182 |
| B397 | adventure/voice/8dde5aa6.mp3 | Three gold stars on our helper map! You're a super helper. | Day 3 ("The Puzzle Bridge"), the ending, e04, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:186 |
| B398 | adventure/voice/90379766.mp3 | Here comes Pelly with a letter! Oops. That's a striped sock. Pelly, where's the other one? | Day 4 ("The Thirsty Waterwheel Garden"), the story, s01, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:201 |
| B399 | adventure/voice/db16129f.mp3 | Here's the real letter. It's from Gardener Mouse. Her flowers are thirsty, and her waterwheel has stopped! | Day 4 ("The Thirsty Waterwheel Garden"), the story, s02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:204 |
| B400 | adventure/voice/4d943b41.mp3 | Here's the real letter, from Gardener Mouse. Her flowers need a drink! | Day 4 ("The Thirsty Waterwheel Garden"), the story, s02, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:204 |
| B401 | adventure/voice/044246db.mp3 | Up the hill we go, to Gardener Mouse's garden. Oh dear. The flowers are droopy, and the pond is dry. | Day 4 ("The Thirsty Waterwheel Garden"), the story, s03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:208 |
| B402 | adventure/voice/75e3578e.mp3 | Oh dear. Droopy flowers, an empty pond, and a wheel that won't turn! | Day 4 ("The Thirsty Waterwheel Garden"), the story, s03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:208 |
| B403 | adventure/voice/7297738b.mp3 | Two ducks sit in the empty pond with their towels, ready for a swim. Quack? Where's the water? | Day 4 ("The Thirsty Waterwheel Garden"), the story, s04, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:212 |
| B404 | adventure/voice/9a46ae21.mp3 | Gardener Mouse is watering the whole garden with a teeny watering can. One drop for you. One drop for you! | Day 4 ("The Thirsty Waterwheel Garden"), the story, s05, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:215 |
| B405 | adventure/voice/c0a70405.mp3 | Gardener Mouse has a teeny watering can. Drip, drip! | Day 4 ("The Thirsty Waterwheel Garden"), the story, s05, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:215 |
| B406 | adventure/voice/7b8ffd5c.mp3 | She took her wooden troughs apart to scrub them. Now they're in a heap, and she can't remember how they go! | Day 4 ("The Thirsty Waterwheel Garden"), the story, s06, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:219 |
| B407 | adventure/voice/d3ddbdc0.mp3 | The wooden troughs are slides for the water. Now they're all in a heap! | Day 4 ("The Thirsty Waterwheel Garden"), the story, s06, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:219 |
| B408 | adventure/voice/0cae6571.mp3 | Water runs down the troughs to the wheel, and the wheel scoops it up for the plants. A gap? Splish! It spills out. | Day 4 ("The Thirsty Waterwheel Garden"), the story, s07, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:223 |
| B409 | adventure/voice/89d2c89f.mp3 | Let's fit the troughs back together, open the water gate, and get that wheel turning. Ready? | Day 4 ("The Thirsty Waterwheel Garden"), the story, s08, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:226 |
| B410 | adventure/voice/91cd1b8f.mp3 | Let's fix the troughs and get the wheel turning. Ready? | Day 4 ("The Thirsty Waterwheel Garden"), the story, s08, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:226 |
| B411 | adventure/voice/f6e7dd46.mp3 | Gurgle, gurgle! The wheel turns, the water runs, and every droopy flower stands up tall. | Day 4 ("The Thirsty Waterwheel Garden"), the ending, e01, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:233 |
| B412 | adventure/voice/22085a5f.mp3 | Gurgle, gurgle! The wheel turns, and the flowers get a big drink! | Day 4 ("The Thirsty Waterwheel Garden"), the ending, e01, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:233 |
| B413 | adventure/voice/b0768985.mp3 | The pond fills right up, and in jump the ducks with a big splash. Quack, quack, hooray! | Day 4 ("The Thirsty Waterwheel Garden"), the ending, e02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:237 |
| B414 | adventure/voice/a4f9bb2b.mp3 | Gardener Mouse puts her feet up. And look! A little frog found Pelly's other sock. It makes a cozy sleeping bag! | Day 4 ("The Thirsty Waterwheel Garden"), the ending, e03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:240 |
| B415 | adventure/voice/73aaf186.mp3 | Look! A little frog found Pelly's other sock! | Day 4 ("The Thirsty Waterwheel Garden"), the ending, e03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:240 |
| B416 | adventure/voice/b1ccc8f7.mp3 | Four gold stars on our helper map! And not one droopy flower left in the garden. | Day 4 ("The Thirsty Waterwheel Garden"), the ending, e04, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:244 |
| B417 | adventure/voice/b80570df.mp3 | Pelly waddles up with a letter! Oops. That's a teapot. And it's still warm! | Day 5 ("The Little Island Postboat"), the story, s01, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:254 |
| B418 | adventure/voice/6a80d4d1.mp3 | Here's the real letter. It's from Postmaster Otter, down by the sea. He needs our help! | Day 5 ("The Little Island Postboat"), the story, s02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:257 |
| B419 | adventure/voice/3181c44e.mp3 | Here's the real letter. Postmaster Otter needs our help! | Day 5 ("The Little Island Postboat"), the story, s02, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:257 |
| B420 | adventure/voice/45b3b380.mp3 | Otter has parcels for everybody on the little islands. Look at that pile! | Day 5 ("The Little Island Postboat"), the story, s03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:261 |
| B421 | adventure/voice/4262227b.mp3 | Postmaster Otter has a big pile of parcels! | Day 5 ("The Little Island Postboat"), the story, s03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:261 |
| B422 | adventure/voice/ae8d518c.mp3 | But his big red boat is too wide for the reeds. It got stuck! Squish, squelch. | Day 5 ("The Little Island Postboat"), the story, s04, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:265 |
| B423 | adventure/voice/6fe9e2df.mp3 | Lucky for us, Otter has a little postboat too. It fits right through the reeds! | Day 5 ("The Little Island Postboat"), the story, s05, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:268 |
| B424 | adventure/voice/3caf033a.mp3 | Otter's big boat won't fit in the reeds. This little one will! | Day 5 ("The Little Island Postboat"), the story, s05, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:268 |
| B425 | adventure/voice/c0db562e.mp3 | Mouse's little blue house has no curtains. Heron keeps getting rained on. And Turtle has read all his books, twice! | Day 5 ("The Little Island Postboat"), the story, s06, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:272 |
| B426 | adventure/voice/90e804dc.mp3 | Then there's Beaver. He nibbled his own front door by mistake. Crunch! His new one is on that raft. | Day 5 ("The Little Island Postboat"), the story, s07, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:275 |
| B427 | adventure/voice/29132a73.mp3 | Silly Beaver nibbled his door. Crunch! His new one is on a raft. | Day 5 ("The Little Island Postboat"), the story, s07, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:275 |
| B428 | adventure/voice/7b8a25d6.mp3 | Let's steer the little postboat to every island, and pull Beaver's raft behind us. Ready? | Day 5 ("The Little Island Postboat"), the story, s08, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:279 |
| B429 | adventure/voice/297597a0.mp3 | Let's steer the boat to every island. Ready? | Day 5 ("The Little Island Postboat"), the story, s08, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:279 |
| B430 | adventure/voice/04d9e201.mp3 | Beaver's new door fits just right. Open, shut, open, shut. He loves it! | Day 5 ("The Little Island Postboat"), the ending, e01, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:286 |
| B431 | adventure/voice/ce261640.mp3 | Beaver's new door fits. Hooray! | Day 5 ("The Little Island Postboat"), the ending, e01, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:286 |
| B432 | adventure/voice/0043fc3b.mp3 | Mouse hangs up her curtains. Turtle starts a new book. And Heron splashes in his new raincoat! | Day 5 ("The Little Island Postboat"), the ending, e02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:290 |
| B433 | adventure/voice/06874d2d.mp3 | Tea for everyone from Pelly's teapot! And Beaver nibbles a stick, not his new door. | Day 5 ("The Little Island Postboat"), the ending, e03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:293 |
| B434 | adventure/voice/373d753a.mp3 | Tea for everyone from Pelly's teapot! | Day 5 ("The Little Island Postboat"), the ending, e03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:293 |
| B435 | adventure/voice/54d775db.mp3 | Our helper map has five gold stars now! You and the little postboat did it. | Day 5 ("The Little Island Postboat"), the ending, e04, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:297 |
| B436 | adventure/voice/ddd45f25.mp3 | Pelly is up early with a letter. Oops. That's a pinecone! What a prickly letter, Pelly. | Day 6 ("Breakfast at the Moonberry Bakery"), the story, s01, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:307 |
| B437 | adventure/voice/d08c140d.mp3 | Here's the real letter. It's from Baker Badger. His new bakery opens this morning, and he needs more paws! | Day 6 ("Breakfast at the Moonberry Bakery"), the story, s02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:310 |
| B438 | adventure/voice/893d227a.mp3 | Here's the real letter. Baker Badger's new bakery opens today! | Day 6 ("Breakfast at the Moonberry Bakery"), the story, s02, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:310 |
| B439 | adventure/voice/dafb84ed.mp3 | The neighbors are already lining up at the Moonberry Bakery. Grandpa Bear brought a very big basket! | Day 6 ("Breakfast at the Moonberry Bakery"), the story, s03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:314 |
| B440 | adventure/voice/60740fad.mp3 | Everyone is hungry, but there are no buns yet. Rumble, rumble go their tummies! | Day 6 ("Breakfast at the Moonberry Bakery"), the story, s03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:314 |
| B441 | adventure/voice/61abff0b.mp3 | Inside, every tray is empty. Badger is so excited about his new bakery, his paws won't stop wiggling! | Day 6 ("Breakfast at the Moonberry Bakery"), the story, s04, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:318 |
| B442 | adventure/voice/1a9a31fc.mp3 | Wobble, wobble, poof! The flour goes everywhere. Where did Badger's stripes go? | Day 6 ("Breakfast at the Moonberry Bakery"), the story, s05, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:321 |
| B443 | adventure/voice/77362aeb.mp3 | Poof! Flour everywhere. Where did Badger's stripes go? | Day 6 ("Breakfast at the Moonberry Bakery"), the story, s05, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:321 |
| B444 | adventure/voice/3448226b.mp3 | The recipe is all pictures. Pour to the line, stir, then shape round buns, curled buns and berry buns. | Day 6 ("Breakfast at the Moonberry Bakery"), the story, s06, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:325 |
| B445 | adventure/voice/2ed44a3e.mp3 | The recipe is all pictures. Pour it, stir it, shape the buns! | Day 6 ("Breakfast at the Moonberry Bakery"), the story, s06, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:325 |
| B446 | adventure/voice/d54201df.mp3 | Sniff, sniff. Grandpa Bear's nose is squished on the window. Not yet, Grandpa Bear. We haven't even started! | Day 6 ("Breakfast at the Moonberry Bakery"), the story, s07, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:329 |
| B447 | adventure/voice/62159d82.mp3 | Let's mix the dough, shape the buns and bake them golden for the whole street. Ready? | Day 6 ("Breakfast at the Moonberry Bakery"), the story, s08, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:332 |
| B448 | adventure/voice/cdc1c645.mp3 | Let's bake breakfast for everyone. Ready? | Day 6 ("Breakfast at the Moonberry Bakery"), the story, s08, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:332 |
| B449 | adventure/voice/8c4f2d1b.mp3 | Ta-da! Round buns, curled buns and berry buns, each in its own basket. Breakfast is ready! | Day 6 ("Breakfast at the Moonberry Bakery"), the ending, e01, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:339 |
| B450 | adventure/voice/515df069.mp3 | Ta-da! Breakfast is ready. Warm buns, fresh from the oven! | Day 6 ("Breakfast at the Moonberry Bakery"), the ending, e01, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:339 |
| B451 | adventure/voice/ac959afa.mp3 | Badger opens the door, and in come the neighbors. Good thing Grandpa Bear brought that very big basket! | Day 6 ("Breakfast at the Moonberry Bakery"), the ending, e02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:343 |
| B452 | adventure/voice/5f2331ef.mp3 | Pelly flies in for breakfast too. She tucks a bun in her pouch, and out pops another pinecone. Bonk! | Day 6 ("Breakfast at the Moonberry Bakery"), the ending, e03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:346 |
| B453 | adventure/voice/0992466c.mp3 | Pelly puts a bun in her pouch. Out pops another pinecone! | Day 6 ("Breakfast at the Moonberry Bakery"), the ending, e03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:346 |
| B454 | adventure/voice/ca260d0e.mp3 | Six gold stars on our helper map! Badger even gave us the very last curled bun. | Day 6 ("Breakfast at the Moonberry Bakery"), the ending, e04, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:350 |
| B455 | adventure/voice/cbd690be.mp3 | Pelly flew in with a letter. Oops. That's a toothbrush! Whose is it? | Day 7 ("Tortoise's New Front Door"), the story, s01, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:360 |
| B456 | adventure/voice/1e091b28.mp3 | Here's the real letter. It's from Tortoise. He's moving to a new house today, and he needs our help! | Day 7 ("Tortoise's New Front Door"), the story, s02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:363 |
| B457 | adventure/voice/883f5b0a.mp3 | Here's the real letter. Tortoise has a new house, and he needs our help! | Day 7 ("Tortoise's New Front Door"), the story, s02, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:363 |
| B458 | adventure/voice/0e327140.mp3 | Meet Tortoise and his moving cart. His new house is just over the stream. See the green door? | Day 7 ("Tortoise's New Front Door"), the story, s03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:367 |
| B459 | adventure/voice/bdffcf41.mp3 | This is Tortoise and his cart. His new house is over the stream, but there's no bridge! | Day 7 ("Tortoise's New Front Door"), the story, s03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:367 |
| B460 | adventure/voice/d8f3f6c4.mp3 | Tortoise packed his chair, his books and his cozy blanket. But where is his toothbrush? | Day 7 ("Tortoise's New Front Door"), the story, s04, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:371 |
| B461 | adventure/voice/fc600c64.mp3 | Oh no, there's no bridge! The new one is still in pieces, all in a big pile by the water. | Day 7 ("Tortoise's New Front Door"), the story, s05, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:374 |
| B462 | adventure/voice/ff864f3e.mp3 | Tortoise tries to carry a long plank on his shell. Round and round he spins! Whoa, whoops! | Day 7 ("Tortoise's New Front Door"), the story, s06, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:377 |
| B463 | adventure/voice/7f6731bf.mp3 | Tortoise tries to carry a big piece of wood. Round and round he spins. Whoops! | Day 7 ("Tortoise's New Front Door"), the story, s06, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:377 |
| B464 | adventure/voice/ce4ad640.mp3 | Here's a crane to help! Hook the wood, lift it, turn it to fit, and lower it onto its glowing spot. | Day 7 ("Tortoise's New Front Door"), the story, s07, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:381 |
| B465 | adventure/voice/7843beae.mp3 | Here's a crane! It lifts the wood. Turn it to fit, then down it goes. Clunk! | Day 7 ("Tortoise's New Front Door"), the story, s07, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:381 |
| B466 | adventure/voice/6a463630.mp3 | Let's put the bridge together, roll Tortoise's cart to his green door, and ring his doorbell. Ready? | Day 7 ("Tortoise's New Front Door"), the story, s08, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:385 |
| B467 | adventure/voice/3cabf051.mp3 | Let's build a bridge, then roll Tortoise's cart to his door. Ready? | Day 7 ("Tortoise's New Front Door"), the story, s08, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:385 |
| B468 | adventure/voice/9a88cb2e.mp3 | Ding-dong! Tortoise's cart rolls across our new bridge, all the way to his green door. | Day 7 ("Tortoise's New Front Door"), the ending, e01, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:392 |
| B469 | adventure/voice/5aedc044.mp3 | Ding-dong! Tortoise's cart made it to his green door! | Day 7 ("Tortoise's New Front Door"), the ending, e01, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:392 |
| B470 | adventure/voice/3eea0a58.mp3 | Chair by the window, books on the shelf, blanket on the bed. Tortoise does a happy dance, a very slow one! | Day 7 ("Tortoise's New Front Door"), the ending, e02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:396 |
| B471 | adventure/voice/213d3056.mp3 | Pelly is back, and look! That toothbrush is Tortoise's. He sent it with his letter by mistake! | Day 7 ("Tortoise's New Front Door"), the ending, e03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:399 |
| B472 | adventure/voice/1c8392fc.mp3 | Pelly brings the toothbrush. It's Tortoise's! Brush, brush! | Day 7 ("Tortoise's New Front Door"), the ending, e03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:399 |
| B473 | adventure/voice/15559547.mp3 | Tortoise is home, and that makes seven gold stars on our helper map! | Day 7 ("Tortoise's New Front Door"), the ending, e04, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:403 |
| B474 | adventure/voice/4b3e06b2.mp3 | Pelly swoops down with a letter! Oops. That's a carrot! Somebody is going to love that. | Day 8 ("The Glowworm Lantern Walk"), the story, s01, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:413 |
| B475 | adventure/voice/fb29faec.mp3 | Here's the real letter. It's from Glowworm in the Mushroom Woods. He needs our help with his lamps tonight! | Day 8 ("The Glowworm Lantern Walk"), the story, s02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:416 |
| B476 | adventure/voice/c989c499.mp3 | Here's the real letter. Glowworm needs our help with his lamps! | Day 8 ("The Glowworm Lantern Walk"), the story, s02, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:416 |
| B477 | adventure/voice/47c2c40b.mp3 | Into the Mushroom Woods we go. Hello, Glowworm! Rabbit and Hedgehog are here for the lantern walk too. | Day 8 ("The Glowworm Lantern Walk"), the story, s03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:420 |
| B478 | adventure/voice/df9f21a0.mp3 | Hello, Glowworm! Hello, Rabbit and Hedgehog! | Day 8 ("The Glowworm Lantern Walk"), the story, s03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:420 |
| B479 | adventure/voice/f295ceeb.mp3 | Every evening, Glowworm leads a walk down the lamp path to the big lantern, to hear the crickets sing. | Day 8 ("The Glowworm Lantern Walk"), the story, s04, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:424 |
| B480 | adventure/voice/c2d6e1a6.mp3 | Oh dear, Glowworm has the hiccups. And every hiccup makes him hop! Hic, hop! Hic, hop! | Day 8 ("The Glowworm Lantern Walk"), the story, s05, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:427 |
| B481 | adventure/voice/6dde1fcf.mp3 | Glowworm has the hiccups! Hic, hop! Hic, hop! | Day 8 ("The Glowworm Lantern Walk"), the story, s05, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:427 |
| B482 | adventure/voice/ac0f3686.mp3 | He hopped right into the lamp cords. Pop, pop, pop! Now every plug is out, and the lamps won't light. | Day 8 ("The Glowworm Lantern Walk"), the story, s06, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:431 |
| B483 | adventure/voice/ef1282aa.mp3 | He hopped on the cords. Pop, pop, pop! Out came the plugs. The lamps won't light! | Day 8 ("The Glowworm Lantern Walk"), the story, s06, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:431 |
| B484 | adventure/voice/2d1d584f.mp3 | Every light needs two cords. One takes the power in, one brings it back. Then flip the switch. Click! | Day 8 ("The Glowworm Lantern Walk"), the story, s07, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:435 |
| B485 | adventure/voice/f2f0de72.mp3 | Let's plug in every cord and flip every switch, lamp by lamp, right up to the big lantern. Ready? | Day 8 ("The Glowworm Lantern Walk"), the story, s08, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:438 |
| B486 | adventure/voice/88b61ab4.mp3 | Let's plug in the cords and switch on the lamps. Ready? | Day 8 ("The Glowworm Lantern Walk"), the story, s08, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:438 |
| B487 | adventure/voice/ddbefb6b.mp3 | Click! The great big lantern glows gold. Every lamp shines, and the stepping stones glow like little moons! | Day 8 ("The Glowworm Lantern Walk"), the ending, e01, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:445 |
| B488 | adventure/voice/5aba6af2.mp3 | Click! The big lantern glows. Every lamp is shining! | Day 8 ("The Glowworm Lantern Walk"), the ending, e01, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:445 |
| B489 | adventure/voice/570e8e08.mp3 | Glowworm leads the walk down the shining path. Then we all sit and listen to the crickets. Chirp, chirp! | Day 8 ("The Glowworm Lantern Walk"), the ending, e02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:449 |
| B490 | adventure/voice/1a781f8a.mp3 | Pelly's carrot was for Rabbit all along! Crunch, crunch. And Glowworm's hiccups are almost gone... hic! | Day 8 ("The Glowworm Lantern Walk"), the ending, e03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:452 |
| B491 | adventure/voice/e103de65.mp3 | Pelly's carrot was for Rabbit! Crunch, crunch! | Day 8 ("The Glowworm Lantern Walk"), the ending, e03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:452 |
| B492 | adventure/voice/5913854b.mp3 | Goodnight, Glowworm! Now there are eight gold stars on our helper map. | Day 8 ("The Glowworm Lantern Walk"), the ending, e04, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:456 |
| B493 | adventure/voice/cc07bbd8.mp3 | Pelly lands on the doorstep with a letter. Oops. That's a fuzzy red mitten! Pelly, it isn't even snowing here. | Day 9 ("All Aboard for Snowdrop Valley"), the story, s01, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:466 |
| B494 | adventure/voice/fffb50ea.mp3 | Here's the real letter. It's from Hare in snowy Snowdrop Valley. She needs help with her brand-new train! | Day 9 ("All Aboard for Snowdrop Valley"), the story, s02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:469 |
| B495 | adventure/voice/f044f836.mp3 | Here's the real letter. It's from Hare, out in the snow! | Day 9 ("All Aboard for Snowdrop Valley"), the story, s02, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:469 |
| B496 | adventure/voice/aeb929b5.mp3 | Hare and Frog are the train crew. Here's their shiny new train. But look! There are no tracks! | Day 9 ("All Aboard for Snowdrop Valley"), the story, s03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:473 |
| B497 | adventure/voice/9ee9274f.mp3 | Hare and Frog have a shiny new train. But it has no tracks! | Day 9 ("All Aboard for Snowdrop Valley"), the story, s03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:473 |
| B498 | adventure/voice/fd3d926e.mp3 | Hare and Frog polished the train all week. They forgot the tracks! They're still on the cart, under the snow. | Day 9 ("All Aboard for Snowdrop Valley"), the story, s04, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:477 |
| B499 | adventure/voice/ab659baa.mp3 | Squirrel wants to go sledding. Baker Badger has a day off and wants a nap. The duck family wants a swim! | Day 9 ("All Aboard for Snowdrop Valley"), the story, s05, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:480 |
| B500 | adventure/voice/d20874bc.mp3 | Squirrel, Badger and the duck family all need a ride! | Day 9 ("All Aboard for Snowdrop Valley"), the story, s05, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:480 |
| B501 | adventure/voice/71c86daf.mp3 | Frog gave Badger a ride home on his back. One hop, two hops, plop! They landed in a snowdrift, giggling. | Day 9 ("All Aboard for Snowdrop Valley"), the story, s06, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:484 |
| B502 | adventure/voice/97f22d6d.mp3 | Frog gave Badger a ride. One hop, two hops, plop! Into the snow! | Day 9 ("All Aboard for Snowdrop Valley"), the story, s06, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:484 |
| B503 | adventure/voice/966ece58.mp3 | Every stop has a picture sign. A sled for the hill, a little house for Badger, and a duck for the pond. | Day 9 ("All Aboard for Snowdrop Valley"), the story, s07, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:488 |
| B504 | adventure/voice/30dcadfc.mp3 | Let's lay the tracks and drive everyone to their stop. Then Hare and Frog get a ride too. Ready? | Day 9 ("All Aboard for Snowdrop Valley"), the story, s08, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:491 |
| B505 | adventure/voice/c5d35bf0.mp3 | Let's build the tracks and give everyone a ride. Ready? | Day 9 ("All Aboard for Snowdrop Valley"), the story, s08, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:491 |
| B506 | adventure/voice/0eb4902c.mp3 | Ding, ding! Everyone is at their stop. And Hare and Frog got their ride too, round the valley and home! | Day 9 ("All Aboard for Snowdrop Valley"), the ending, e01, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:498 |
| B507 | adventure/voice/17393aa2.mp3 | Ding, ding! Everyone got a ride on the train! | Day 9 ("All Aboard for Snowdrop Valley"), the ending, e01, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:498 |
| B508 | adventure/voice/bb3e2761.mp3 | Down the hill zooms Squirrel! Badger waves from his door in his slippers, and the ducklings paddle in the pond. | Day 9 ("All Aboard for Snowdrop Valley"), the ending, e02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:502 |
| B509 | adventure/voice/47cb27fe.mp3 | Hot cocoa and cookies at the station! And here comes Pelly, wearing that red mitten as a cozy hat. | Day 9 ("All Aboard for Snowdrop Valley"), the ending, e03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:505 |
| B510 | adventure/voice/8283dd6a.mp3 | Look! Pelly is wearing the mitten as a hat! | Day 9 ("All Aboard for Snowdrop Valley"), the ending, e03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:505 |
| B511 | adventure/voice/0e0dff39.mp3 | The whole valley can ride the train now. Nine gold stars on our helper map! | Day 9 ("All Aboard for Snowdrop Valley"), the ending, e04, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:509 |
| B512 | adventure/voice/b31a4e4a.mp3 | Pelly sails in on the breeze with a letter. Oops. That's an umbrella! How did it ever fit in her pouch? | Day 10 ("The Hilltop Patchwork Kite"), the story, s01, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:519 |
| B513 | adventure/voice/df3f3af3.mp3 | Here's the real letter. It's from Goat on Breezy Hill. His giant kite needs our help! | Day 10 ("The Hilltop Patchwork Kite"), the story, s02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:522 |
| B514 | adventure/voice/cc3841ad.mp3 | Here's the real letter. Goat's giant kite needs our help! | Day 10 ("The Hilltop Patchwork Kite"), the story, s02, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:522 |
| B515 | adventure/voice/7e504f7f.mp3 | Up on windy Breezy Hill, Goat shows us his giant kite. All his friends painted pictures for it! | Day 10 ("The Hilltop Patchwork Kite"), the story, s03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:526 |
| B516 | adventure/voice/97356953.mp3 | Goat shows us his giant kite. His friends painted pictures for it! | Day 10 ("The Hilltop Patchwork Kite"), the story, s03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:526 |
| B517 | adventure/voice/338aaded.mp3 | Lamb painted a flower for the kite. And Beetle painted a picture of herself! | Day 10 ("The Hilltop Patchwork Kite"), the story, s04, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:530 |
| B518 | adventure/voice/1a73f191.mp3 | But the pictures aren't sewn on yet. Whoosh! Every time the wind blows, up they flip and flap. | Day 10 ("The Hilltop Patchwork Kite"), the story, s05, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:533 |
| B519 | adventure/voice/13c205dd.mp3 | The pictures aren't sewn on. Whoosh! Up they flap! | Day 10 ("The Hilltop Patchwork Kite"), the story, s05, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:533 |
| B520 | adventure/voice/5a8f2cdc.mp3 | Goat grabbed a needle to sew them on. But that's tricky with hooves! Now he's wrapped up like a present. | Day 10 ("The Hilltop Patchwork Kite"), the story, s06, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:537 |
| B521 | adventure/voice/c6a52362.mp3 | Sewing is tricky with hooves. Goat is all tangled up! | Day 10 ("The Hilltop Patchwork Kite"), the story, s06, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:537 |
| B522 | adventure/voice/e792ee9e.mp3 | A kite's tail has to hang even. Too many bows on one side, and it tips over! Spread them out, and it flies straight. | Day 10 ("The Hilltop Patchwork Kite"), the story, s07, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:541 |
| B523 | adventure/voice/fec22172.mp3 | Let's sew every picture in its place, thread the ribbons, balance the tail and fly the kite. Ready? | Day 10 ("The Hilltop Patchwork Kite"), the story, s08, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:544 |
| B524 | adventure/voice/15be552a.mp3 | Let's sew on the pictures, add the ribbon tail and fly! Ready? | Day 10 ("The Hilltop Patchwork Kite"), the story, s08, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:544 |
| B525 | adventure/voice/cf3e241e.mp3 | Look at it go! Up goes the patchwork kite, straight and steady, with every picture flying high! | Day 10 ("The Hilltop Patchwork Kite"), the ending, e01, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:551 |
| B526 | adventure/voice/e9340c0d.mp3 | Up goes the kite! Every picture is flying! | Day 10 ("The Hilltop Patchwork Kite"), the ending, e01, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:551 |
| B527 | adventure/voice/94f55be9.mp3 | Lamb waves up at her flower. And Beetle waves up at herself, flying high! | Day 10 ("The Hilltop Patchwork Kite"), the ending, e02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:555 |
| B528 | adventure/voice/b8ff816e.mp3 | Pelly comes to watch. Pop! Her umbrella opens, and the breeze lifts her up like a kite. Hold on, Pelly! | Day 10 ("The Hilltop Patchwork Kite"), the ending, e03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:558 |
| B529 | adventure/voice/0c19e711.mp3 | Pop! Pelly's umbrella opens. Up she floats like a kite! | Day 10 ("The Hilltop Patchwork Kite"), the ending, e03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:558 |
| B530 | adventure/voice/6f92fefd.mp3 | Hooray for Goat's kite, and for ten gold stars on our helper map! | Day 10 ("The Hilltop Patchwork Kite"), the ending, e04, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:562 |
| B531 | adventure/voice/d4ccbabd.mp3 | Pelly has the mail! Oops. That's a wooden spoon. Are you making soup, Pelly? | Day 11 ("The Sandstone Nest Lift"), the story, s01, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:572 |
| B532 | adventure/voice/b63cce31.mp3 | Pelly has the mail! Oops. That's a wooden spoon. Silly Pelly! | Day 11 ("The Sandstone Nest Lift"), the story, s01, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:572 |
| B533 | adventure/voice/a096c5c8.mp3 | Here's the real letter. It's from Mama Swallow. Her family is moving into new nests on a cliff! | Day 11 ("The Sandstone Nest Lift"), the story, s02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:576 |
| B534 | adventure/voice/d792ae4a.mp3 | Here's the real letter. Mama Swallow is moving into new nests! | Day 11 ("The Sandstone Nest Lift"), the story, s02, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:576 |
| B535 | adventure/voice/de81eef0.mp3 | This is Sandstone Cliff, with little round nests all the way up. Mama Swallow and her chicks wave hello! | Day 11 ("The Sandstone Nest Lift"), the story, s03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:580 |
| B536 | adventure/voice/d98caa28.mp3 | Look! Mama Swallow and her three chicks. Their new nests are way up high! | Day 11 ("The Sandstone Nest Lift"), the story, s03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:580 |
| B537 | adventure/voice/ff58afcb.mp3 | Uh-oh! The blankets and toys are all bundled up, and the bundles can't squeeze up the little cliff stairs. | Day 11 ("The Sandstone Nest Lift"), the story, s04, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:584 |
| B538 | adventure/voice/423ad1d7.mp3 | Oh no! The blankets and toys are too big for the stairs! | Day 11 ("The Sandstone Nest Lift"), the story, s04, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:584 |
| B539 | adventure/voice/b1ddff92.mp3 | Mama Swallow took off with the enormous quilt. Flap, flap, flop! Down it came, and now it's a quilt with feet. | Day 11 ("The Sandstone Nest Lift"), the story, s05, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:588 |
| B540 | adventure/voice/5150ca82.mp3 | Flap, flap, flop! The big quilt fell on Mama Swallow. A quilt with feet! | Day 11 ("The Sandstone Nest Lift"), the story, s05, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:588 |
| B541 | adventure/voice/e6a5d324.mp3 | Each chick wants its own toy in bed tonight. A rabbit, a teddy bear, and a very, very long snake! | Day 11 ("The Sandstone Nest Lift"), the story, s06, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:592 |
| B542 | adventure/voice/6d8ca424.mp3 | Here's the basket lift! A bundle in one basket, stones with just as many dots in the other. Then up it goes! | Day 11 ("The Sandstone Nest Lift"), the story, s07, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:595 |
| B543 | adventure/voice/2fb47131.mp3 | Let's balance each bundle with stones, wind it up, up, up, and pop it into its nest. Ready? | Day 11 ("The Sandstone Nest Lift"), the story, s08, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:598 |
| B544 | adventure/voice/dca1aee2.mp3 | Here's a basket lift! Let's carry the blankets and toys up to the nests. Ready? | Day 11 ("The Sandstone Nest Lift"), the story, s08, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:598 |
| B545 | adventure/voice/0c6b6e30.mp3 | Swoosh! The enormous quilt slides right into the top nest. Every nest has its bundle! | Day 11 ("The Sandstone Nest Lift"), the ending, e01, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:605 |
| B546 | adventure/voice/d5b2a578.mp3 | Swoosh! The big quilt fits in the top nest! | Day 11 ("The Sandstone Nest Lift"), the ending, e01, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:605 |
| B547 | adventure/voice/eaced922.mp3 | Soup's on! Pelly stirs berry soup with her wooden spoon. So that's what it was for! | Day 11 ("The Sandstone Nest Lift"), the ending, e02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:609 |
| B548 | adventure/voice/e619c074.mp3 | Bedtime! Each chick snuggles in its own nest with its toy. And up top, Mama Swallow is a quilt with feet again! | Day 11 ("The Sandstone Nest Lift"), the ending, e03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:612 |
| B549 | adventure/voice/529365bf.mp3 | Bedtime! Each chick hugs its toy in its own nest. And look, a quilt with feet! | Day 11 ("The Sandstone Nest Lift"), the ending, e03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:612 |
| B550 | adventure/voice/7ba8c0ab.mp3 | Eleven gold stars on our helper map! Every chick is snug in its new nest. | Day 11 ("The Sandstone Nest Lift"), the ending, e04, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:616 |
| B551 | adventure/voice/327eb42e.mp3 | Hello, Pelly! Is that a letter? Oops. That's a sandwich. One bite is already gone! | Day 12 ("The Lily-Pad Concert"), the story, s01, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:626 |
| B552 | adventure/voice/3d2aaa5a.mp3 | Here's the real letter. It's from our friend Frog. The pond concert is today, but his band can't get started! | Day 12 ("The Lily-Pad Concert"), the story, s02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:629 |
| B553 | adventure/voice/1917e90b.mp3 | Here's the real letter. Frog's band needs our help with their concert! | Day 12 ("The Lily-Pad Concert"), the story, s02, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:629 |
| B554 | adventure/voice/cfa86d32.mp3 | At Lily Pond, here's Frog with his band! He has a drum, Newt has a reed harp, and Duck has two little bells. | Day 12 ("The Lily-Pad Concert"), the story, s03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:633 |
| B555 | adventure/voice/15964337.mp3 | Here's the pond band! Frog has a drum, Newt has a harp, and Duck has bells. | Day 12 ("The Lily-Pad Concert"), the story, s03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:633 |
| B556 | adventure/voice/71c8eb80.mp3 | Each one knows a lovely tune. Boom, boom goes the drum. Plink, plonk go the reeds. Ding, ding go the bells! | Day 12 ("The Lily-Pad Concert"), the story, s04, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:637 |
| B557 | adventure/voice/fd776d36.mp3 | Nobody knows who goes first, so they all play at once. Boom, plink, ding! A bunny and a mouse cover their ears. | Day 12 ("The Lily-Pad Concert"), the story, s05, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:640 |
| B558 | adventure/voice/88570bea.mp3 | They all play at once. Boom, plink, ding! Oh dear, what a mix-up! | Day 12 ("The Lily-Pad Concert"), the story, s05, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:640 |
| B559 | adventure/voice/0a0d3378.mp3 | And Newt's curly tail keeps plucking the reeds all by itself. Plink, plonk! Oops, silly tail! | Day 12 ("The Lily-Pad Concert"), the story, s06, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:644 |
| B560 | adventure/voice/127df5d6.mp3 | And Newt's silly tail keeps plucking her harp. Plink, plink! | Day 12 ("The Lily-Pad Concert"), the story, s06, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:644 |
| B561 | adventure/voice/18f676b8.mp3 | Everyone needs their own seat, with room to play. Then a conductor waves a hand to show who goes next! | Day 12 ("The Lily-Pad Concert"), the story, s07, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:648 |
| B562 | adventure/voice/19be8c9b.mp3 | Let's play their tunes, give each one a seat, pick who goes first, and be the conductor. Ready? | Day 12 ("The Lily-Pad Concert"), the story, s08, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:651 |
| B563 | adventure/voice/016f2010.mp3 | Let's play their music and help them play together. Ready? | Day 12 ("The Lily-Pad Concert"), the story, s08, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:651 |
| B564 | adventure/voice/5377b4e0.mp3 | Everyone takes a turn, and the band plays one lovely song together. The last note floats across the pond. | Day 12 ("The Lily-Pad Concert"), the ending, e01, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:658 |
| B565 | adventure/voice/aeb7f4a1.mp3 | Everyone takes a turn. What a lovely song! | Day 12 ("The Lily-Pad Concert"), the ending, e01, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:658 |
| B566 | adventure/voice/b8be0eec.mp3 | The bunny and the mouse pat the water. Splish, splash! And this time, nobody covers their ears. | Day 12 ("The Lily-Pad Concert"), the ending, e02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:662 |
| B567 | adventure/voice/81a908ed.mp3 | Pelly shares her sandwich with the band. And Newt's tail plays one last plink, right on time! | Day 12 ("The Lily-Pad Concert"), the ending, e03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:665 |
| B568 | adventure/voice/f4ad44da.mp3 | Pelly shares her sandwich. And Newt's tail goes plink! | Day 12 ("The Lily-Pad Concert"), the ending, e03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:665 |
| B569 | adventure/voice/1056be02.mp3 | Take a bow, conductor! That's twelve gold stars on our helper map. | Day 12 ("The Lily-Pad Concert"), the ending, e04, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:669 |
| B570 | adventure/voice/18b42fb1.mp3 | Take a bow! That's twelve gold stars on our helper map. | Day 12 ("The Lily-Pad Concert"), the ending, e04, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:669 |
| B571 | adventure/voice/006c42e5.mp3 | Knock, knock! It's Pelly with a letter. Oops. That's a pancake, with butter on top! Silly Pelly. | Day 13 ("Seeds Across the Rooftops"), the story, s01, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:680 |
| B572 | adventure/voice/d0924ea8.mp3 | Here's the real letter. It's from Gardener Bird. Her rooftop gardens need seeds, and lots of them! | Day 13 ("Seeds Across the Rooftops"), the story, s02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:683 |
| B573 | adventure/voice/23d210b7.mp3 | Here's the real letter. Gardener Bird has seeds to plant! | Day 13 ("Seeds Across the Rooftops"), the story, s02, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:683 |
| B574 | adventure/voice/5960f52f.mp3 | Off we go to the hilltop town! Every rooftop has a planter full of soil. But nothing is growing. | Day 13 ("Seeds Across the Rooftops"), the story, s03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:687 |
| B575 | adventure/voice/de83d5da.mp3 | Look at all the rooftop pots. Lots of soil, but no plants! | Day 13 ("Seeds Across the Rooftops"), the story, s03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:687 |
| B576 | adventure/voice/9bb8b5ad.mp3 | The seed pods are too heavy for Gardener Bird to fly up. And her cart gets stuck at the narrow stairs. Bump! | Day 13 ("Seeds Across the Rooftops"), the story, s04, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:691 |
| B577 | adventure/voice/0f57648a.mp3 | The seed cart gets stuck at the skinny stairs. Bump! | Day 13 ("Seeds Across the Rooftops"), the story, s04, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:691 |
| B578 | adventure/voice/a0379d1e.mp3 | Gardener Bird loves watering so much, she waters everything. The stairs, the cart, and us! Sprinkle! | Day 13 ("Seeds Across the Rooftops"), the story, s05, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:695 |
| B579 | adventure/voice/0cae640a.mp3 | Gardener Bird waters everything. Even us! Sprinkle, sprinkle! | Day 13 ("Seeds Across the Rooftops"), the story, s05, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:695 |
| B580 | adventure/voice/bb2ff278.mp3 | Beside the cart stands a springboard for seed pods. Pop one in the cup, pull the spring, and boing! Up it flies. | Day 13 ("Seeds Across the Rooftops"), the story, s06, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:699 |
| B581 | adventure/voice/430ddd8a.mp3 | One planter hides under a little roof. So we bounce a pod off the striped awning. Boing, plop! | Day 13 ("Seeds Across the Rooftops"), the story, s07, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:702 |
| B582 | adventure/voice/fd76b118.mp3 | Let's aim the springboard, send a seed pod to every rooftop planter, and make the old arch bloom. Ready? | Day 13 ("Seeds Across the Rooftops"), the story, s08, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:705 |
| B583 | adventure/voice/eaad6a58.mp3 | Boing! This springboard sends seeds up high. Let's fill every rooftop pot. Ready? | Day 13 ("Seeds Across the Rooftops"), the story, s08, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:705 |
| B584 | adventure/voice/941c2c71.mp3 | Plop! Every seed is planted. Green leaves on every rooftop, and flowers all over the old arch! | Day 13 ("Seeds Across the Rooftops"), the ending, e01, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:712 |
| B585 | adventure/voice/003fc198.mp3 | Plop! Green leaves and flowers on every rooftop! | Day 13 ("Seeds Across the Rooftops"), the ending, e01, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:712 |
| B586 | adventure/voice/d1a51d0e.mp3 | Gardener Bird loops through the flowery arch, watering every new plant. Quick, a leaf umbrella! | Day 13 ("Seeds Across the Rooftops"), the ending, e02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:716 |
| B587 | adventure/voice/c1d08719.mp3 | Out of Pelly's pouch comes a whole stack of pancakes! A rooftop picnic for everyone. Yum! | Day 13 ("Seeds Across the Rooftops"), the ending, e03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:719 |
| B588 | adventure/voice/6b133185.mp3 | Pelly brought pancakes for everyone. Yum! | Day 13 ("Seeds Across the Rooftops"), the ending, e03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:719 |
| B589 | adventure/voice/3fecb3d4.mp3 | A garden on every rooftop, and thirteen gold stars on our helper map! | Day 13 ("Seeds Across the Rooftops"), the ending, e04, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:723 |
| B590 | adventure/voice/cb7dcd60.mp3 | Pelly brought us another letter! Oops. That's a fluffy slipper. Pelly, you don't wear slippers! | Day 14 ("The Moving-Star Observatory"), the story, s01, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:733 |
| B591 | adventure/voice/5d227c11.mp3 | Here's the real letter. It's from Owl at the Moving-Star Observatory. Her stars have stopped moving! | Day 14 ("The Moving-Star Observatory"), the story, s02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:736 |
| B592 | adventure/voice/ab555770.mp3 | Here's the real letter, from Owl. Her stars are stuck! | Day 14 ("The Moving-Star Observatory"), the story, s02, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:736 |
| B593 | adventure/voice/1abe83dd.mp3 | Owl opens the round doors in just one fluffy slipper. So that's whose it is! Here you go, Owl. | Day 14 ("The Moving-Star Observatory"), the story, s03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:740 |
| B594 | adventure/voice/765e18ca.mp3 | Owl has one fluffy slipper on. Here's the other one! | Day 14 ("The Moving-Star Observatory"), the story, s03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:740 |
| B595 | adventure/voice/9e4cabeb.mp3 | Owl sleeps all day, so now it's her breakfast time. At night! Good morning, Owl! | Day 14 ("The Moving-Star Observatory"), the story, s04, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:744 |
| B596 | adventure/voice/7b117a1f.mp3 | After breakfast, look at Owl's wooden sky! A painted sun, a silver moon and a ring of golden stars. | Day 14 ("The Moving-Star Observatory"), the story, s05, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:747 |
| B597 | adventure/voice/b833d225.mp3 | Look up! A wooden sun, a moon and lots of stars. | Day 14 ("The Moving-Star Observatory"), the story, s05, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:747 |
| B598 | adventure/voice/5ae21c8f.mp3 | Tonight is the Sky Show. Owl turns the big wheel, but nothing moves. The gears are still in their tray! | Day 14 ("The Moving-Star Observatory"), the story, s06, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:751 |
| B599 | adventure/voice/0b025605.mp3 | Owl turns the big wheel. Nothing moves! The gears are in a pile. | Day 14 ("The Moving-Star Observatory"), the story, s06, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:751 |
| B600 | adventure/voice/92972a6c.mp3 | Owl shows us the trick. Too small, a gear can't reach. Too big, it squeezes! Just right, round they go. | Day 14 ("The Moving-Star Observatory"), the story, s07, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:755 |
| B601 | adventure/voice/787122d0.mp3 | Let's fit the gears and turn the big wheel, so the sun, moon and stars move again. Ready? | Day 14 ("The Moving-Star Observatory"), the story, s08, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:758 |
| B602 | adventure/voice/c1693167.mp3 | Let's fit the gears and turn the wheel. Ready? | Day 14 ("The Moving-Star Observatory"), the story, s08, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. | public/adventures.js:758 |
| B603 | adventure/voice/4dd385d8.mp3 | The sun goes up, the moon goes round, and the stars spin. And the roof opens to the real stars! | Day 14 ("The Moving-Star Observatory"), the ending, e01, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:765 |
| B604 | adventure/voice/d8c1f3e8.mp3 | The sun goes up, and the moon and stars go round! | Day 14 ("The Moving-Star Observatory"), the ending, e01, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:765 |
| B605 | adventure/voice/9031df00.mp3 | Look at the little pictures going round! A boat, a bridge, a flower and a kite. Just like our adventures! | Day 14 ("The Moving-Star Observatory"), the ending, e02, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:769 |
| B606 | adventure/voice/0b4df576.mp3 | Everyone comes to the Sky Show. And Owl dances under the stars in both fluffy slippers! | Day 14 ("The Moving-Star Observatory"), the ending, e03, ages 5-8. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:772 |
| B607 | adventure/voice/79bac1bd.mp3 | Owl dances in her two fluffy slippers. Shuffle, shuffle! | Day 14 ("The Moving-Star Observatory"), the ending, e03, ages 3-4. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:772 |
| B608 | adventure/voice/c40ca0c2.mp3 | Fourteen gold stars on our helper map, all shining bright. What a helper you've been! | Day 14 ("The Moving-Star Observatory"), the ending, e04, both ages. | A picture book read to one small child: warm, unhurried, a beat at each full stop. The story's own sounds ("Ah-choo!", "Honk-shoo") are story words, never a speech target. Has a "!": a little lift, not a shout. | public/adventures.js:776 |

Not in this list because they speak nothing: Home, setup, settings, the voice
picker, the mic-permission screens, the chest captions and every in-round label.
See E8.

---

## Part C — Templates, with every blank filled

These lines have a blank in them. The template comes first, then the fillers, then
the lines fully written out where the set is small enough to record as fixed clips.
Numbered like Part B so they can be ticked off.

### C1 — The first prompt of a sound-alone round

`Ready? {cue}, and make your {sound} sound, {n} times.`, then "Go!" (B49) (public/charge.html:2207, built at public/charge.html:622)

Spoken once, into a closed mic, right after the mic opens and the room is measured.
Every session's first round is a sound-alone round, so a child hears this every day.
With the sound models on, Echo says the words and one take of Rachel's recorded sound (`/coach/say-echo/{SOUND}-sound.wav`, Part A) plays in the letter's place: "Ready? Pull your tongue back and up, and make your [rrrr] sound, five times." (public/charge.html:677; spoken at public/charge.html:685).

**Fillers.**

| Sound | {cue} — Rachel's tip cut at the first dash, " like " or comma | {sound} as the code spells it for TTS |
|---|---|---|
| P | Press your lips and pop a little puff | P |
| B | Lips together | B |
| M | Lips together and hum | M |
| N | Tongue up behind your teeth and hum | N |
| T | Tongue taps behind your top teeth | T |
| D | Like T | D |
| K | The back of your tongue pops up in the back | K |
| G | Like K | G |
| F | Top teeth on your bottom lip | F |
| V | Like F | V |
| S | Teeth together | S |
| Z | Teeth together and buzz | Z |
| SH | Round your lips and whisper quiet | S H |
| CH | Pop it | C H |
| J | Like CH | J |
| L | Tongue tip up behind your top teeth | L |
| R | Pull your tongue back and up | R |
| TH (as in 'thumb') | Peek your tongue between your teeth and blow soft | T H |
| TH (voiced, as in 'the') | Tongue between your teeth and buzz | T H |

{n}: the number words the page knows are 2 → "two", 3 → "three", 4 → "four", 5 → "five", 6 → "six" (public/charge.html:615). The ones actually used: **five** on every normal prompt (`CHARGE_NEED = 5`, public/sona.js:2377) and **three** during a retry window after a miss (`burstAndVerify(3)`, public/charge.html:2257). The cued form can fire with "three" only when a syllable round stepped down to the sound and the child then tapped Echo.

Worth Rachel's eye: the comma/"like" cut leaves "Lips together" (B), "Like T" (D), "Like K" (G), "Like F" (V), "Teeth together" (S), "Pop it" (CH), "Like CH" (J) — a G round opens "Ready? Like K, and make your G sound, five times.". TH and THV are both spelled "T H", so only the cue tells them apart.

**All 38 lines.** Where the code says "make your R sound" you may perform the sound instead — that is the whole reason for a human recording. Delivery: even and calm; a short beat after "Ready?", the cue as a friendly reminder, the count plain.

| # | File | Say this | When | Source |
|---|---|---|---|---|
| C1 | prompt-P-cued-5.mp3 | Ready? Press your lips and pop a little puff, and make your P sound, five times. | First prompt of a P sound-alone round. | public/charge.html:622 |
| C2 | prompt-B-cued-5.mp3 | Ready? Lips together, and make your B sound, five times. | First prompt of a B sound-alone round. | public/charge.html:622 |
| C3 | prompt-M-cued-5.mp3 | Ready? Lips together and hum, and make your M sound, five times. | First prompt of a M sound-alone round. | public/charge.html:622 |
| C4 | prompt-N-cued-5.mp3 | Ready? Tongue up behind your teeth and hum, and make your N sound, five times. | First prompt of a N sound-alone round. | public/charge.html:622 |
| C5 | prompt-T-cued-5.mp3 | Ready? Tongue taps behind your top teeth, and make your T sound, five times. | First prompt of a T sound-alone round. | public/charge.html:622 |
| C6 | prompt-D-cued-5.mp3 | Ready? Like T, and make your D sound, five times. | First prompt of a D sound-alone round. | public/charge.html:622 |
| C7 | prompt-K-cued-5.mp3 | Ready? The back of your tongue pops up in the back, and make your K sound, five times. | First prompt of a K sound-alone round. | public/charge.html:622 |
| C8 | prompt-G-cued-5.mp3 | Ready? Like K, and make your G sound, five times. | First prompt of a G sound-alone round. | public/charge.html:622 |
| C9 | prompt-F-cued-5.mp3 | Ready? Top teeth on your bottom lip, and make your F sound, five times. | First prompt of a F sound-alone round. | public/charge.html:622 |
| C10 | prompt-V-cued-5.mp3 | Ready? Like F, and make your V sound, five times. | First prompt of a V sound-alone round. | public/charge.html:622 |
| C11 | prompt-S-cued-5.mp3 | Ready? Teeth together, and make your S sound, five times. | First prompt of a S sound-alone round. | public/charge.html:622 |
| C12 | prompt-Z-cued-5.mp3 | Ready? Teeth together and buzz, and make your Z sound, five times. | First prompt of a Z sound-alone round. | public/charge.html:622 |
| C13 | prompt-SH-cued-5.mp3 | Ready? Round your lips and whisper quiet, and make your S H sound, five times. | First prompt of a SH sound-alone round. | public/charge.html:622 |
| C14 | prompt-CH-cued-5.mp3 | Ready? Pop it, and make your C H sound, five times. | First prompt of a CH sound-alone round. | public/charge.html:622 |
| C15 | prompt-J-cued-5.mp3 | Ready? Like CH, and make your J sound, five times. | First prompt of a J sound-alone round. | public/charge.html:622 |
| C16 | prompt-L-cued-5.mp3 | Ready? Tongue tip up behind your top teeth, and make your L sound, five times. | First prompt of a L sound-alone round. | public/charge.html:622 |
| C17 | prompt-R-cued-5.mp3 | Ready? Pull your tongue back and up, and make your R sound, five times. | First prompt of a R sound-alone round. | public/charge.html:622 |
| C18 | prompt-TH-cued-5.mp3 | Ready? Peek your tongue between your teeth and blow soft, and make your T H sound, five times. | First prompt of a TH (as in 'thumb') sound-alone round. | public/charge.html:622 |
| C19 | prompt-THV-cued-5.mp3 | Ready? Tongue between your teeth and buzz, and make your T H sound, five times. | First prompt of a TH (voiced, as in 'the') sound-alone round. | public/charge.html:622 |
| C20 | prompt-P-cued-3.mp3 | Ready? Press your lips and pop a little puff, and make your P sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C21 | prompt-B-cued-3.mp3 | Ready? Lips together, and make your B sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C22 | prompt-M-cued-3.mp3 | Ready? Lips together and hum, and make your M sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C23 | prompt-N-cued-3.mp3 | Ready? Tongue up behind your teeth and hum, and make your N sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C24 | prompt-T-cued-3.mp3 | Ready? Tongue taps behind your top teeth, and make your T sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C25 | prompt-D-cued-3.mp3 | Ready? Like T, and make your D sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C26 | prompt-K-cued-3.mp3 | Ready? The back of your tongue pops up in the back, and make your K sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C27 | prompt-G-cued-3.mp3 | Ready? Like K, and make your G sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C28 | prompt-F-cued-3.mp3 | Ready? Top teeth on your bottom lip, and make your F sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C29 | prompt-V-cued-3.mp3 | Ready? Like F, and make your V sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C30 | prompt-S-cued-3.mp3 | Ready? Teeth together, and make your S sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C31 | prompt-Z-cued-3.mp3 | Ready? Teeth together and buzz, and make your Z sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C32 | prompt-SH-cued-3.mp3 | Ready? Round your lips and whisper quiet, and make your S H sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C33 | prompt-CH-cued-3.mp3 | Ready? Pop it, and make your C H sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C34 | prompt-J-cued-3.mp3 | Ready? Like CH, and make your J sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C35 | prompt-L-cued-3.mp3 | Ready? Tongue tip up behind your top teeth, and make your L sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C36 | prompt-R-cued-3.mp3 | Ready? Pull your tongue back and up, and make your R sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C37 | prompt-TH-cued-3.mp3 | Ready? Peek your tongue between your teeth and blow soft, and make your T H sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |
| C38 | prompt-THV-cued-3.mp3 | Ready? Tongue between your teeth and buzz, and make your T H sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:622 |

### C2 — The prompt again (tap on Echo)

`Ready? Make your {sound} sound, {n} times.`, then "Go!" (tap: public/charge.html:1310; built at public/charge.html:622)

Every later prompt of the same sound-alone round: the child taps Echo ("Tap Echo to
hear it again"). With the sound models on, her take sits in the letter's place here too.
**All 38 lines.**

| # | File | Say this | When | Source |
|---|---|---|---|---|
| C39 | prompt-P-5.mp3 | Ready? Make your P sound, five times. | Repeat prompt, P. | public/charge.html:622 |
| C40 | prompt-B-5.mp3 | Ready? Make your B sound, five times. | Repeat prompt, B. | public/charge.html:622 |
| C41 | prompt-M-5.mp3 | Ready? Make your M sound, five times. | Repeat prompt, M. | public/charge.html:622 |
| C42 | prompt-N-5.mp3 | Ready? Make your N sound, five times. | Repeat prompt, N. | public/charge.html:622 |
| C43 | prompt-T-5.mp3 | Ready? Make your T sound, five times. | Repeat prompt, T. | public/charge.html:622 |
| C44 | prompt-D-5.mp3 | Ready? Make your D sound, five times. | Repeat prompt, D. | public/charge.html:622 |
| C45 | prompt-K-5.mp3 | Ready? Make your K sound, five times. | Repeat prompt, K. | public/charge.html:622 |
| C46 | prompt-G-5.mp3 | Ready? Make your G sound, five times. | Repeat prompt, G. | public/charge.html:622 |
| C47 | prompt-F-5.mp3 | Ready? Make your F sound, five times. | Repeat prompt, F. | public/charge.html:622 |
| C48 | prompt-V-5.mp3 | Ready? Make your V sound, five times. | Repeat prompt, V. | public/charge.html:622 |
| C49 | prompt-S-5.mp3 | Ready? Make your S sound, five times. | Repeat prompt, S. | public/charge.html:622 |
| C50 | prompt-Z-5.mp3 | Ready? Make your Z sound, five times. | Repeat prompt, Z. | public/charge.html:622 |
| C51 | prompt-SH-5.mp3 | Ready? Make your S H sound, five times. | Repeat prompt, SH. | public/charge.html:622 |
| C52 | prompt-CH-5.mp3 | Ready? Make your C H sound, five times. | Repeat prompt, CH. | public/charge.html:622 |
| C53 | prompt-J-5.mp3 | Ready? Make your J sound, five times. | Repeat prompt, J. | public/charge.html:622 |
| C54 | prompt-L-5.mp3 | Ready? Make your L sound, five times. | Repeat prompt, L. | public/charge.html:622 |
| C55 | prompt-R-5.mp3 | Ready? Make your R sound, five times. | Repeat prompt, R. | public/charge.html:622 |
| C56 | prompt-TH-5.mp3 | Ready? Make your T H sound, five times. | Repeat prompt, TH (as in 'thumb'). | public/charge.html:622 |
| C57 | prompt-THV-5.mp3 | Ready? Make your T H sound, five times. | Repeat prompt, TH (voiced, as in 'the'). | public/charge.html:622 |
| C58 | prompt-P-3.mp3 | Ready? Make your P sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C59 | prompt-B-3.mp3 | Ready? Make your B sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C60 | prompt-M-3.mp3 | Ready? Make your M sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C61 | prompt-N-3.mp3 | Ready? Make your N sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C62 | prompt-T-3.mp3 | Ready? Make your T sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C63 | prompt-D-3.mp3 | Ready? Make your D sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C64 | prompt-K-3.mp3 | Ready? Make your K sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C65 | prompt-G-3.mp3 | Ready? Make your G sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C66 | prompt-F-3.mp3 | Ready? Make your F sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C67 | prompt-V-3.mp3 | Ready? Make your V sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C68 | prompt-S-3.mp3 | Ready? Make your S sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C69 | prompt-Z-3.mp3 | Ready? Make your Z sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C70 | prompt-SH-3.mp3 | Ready? Make your S H sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C71 | prompt-CH-3.mp3 | Ready? Make your C H sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C72 | prompt-J-3.mp3 | Ready? Make your J sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C73 | prompt-L-3.mp3 | Ready? Make your L sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C74 | prompt-R-3.mp3 | Ready? Make your R sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C75 | prompt-TH-3.mp3 | Ready? Make your T H sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |
| C76 | prompt-THV-3.mp3 | Ready? Make your T H sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:622 |

### C3 — The prompt on a syllable, word or sentence round

`Ready? Say {target}, {n} times.`, then "Go!" (public/charge.html:622; targets from `ladderContent`)

Round two onward of an adventure climbs sound → syllable → word → sentence, capped
one rung above what the child has mastered. One target per round; the same line
repeats on a tap. {n} as in C1. **Best left to TTS in the cloned voice** — the
blank is a word, and words render fine; only bare sounds do not. Listed so nothing
is hidden.

**{target} = a syllable** — the sound's onset plus ah / ee / oo / oh / ay (public/gamecontent.js:40), except G's "gay" is "guy" and P's "poo" is "pie": two words a child is never asked to say (Travis, 30 Sep 2026); 19 × 5 = 95 (TH and THV share the same five):

| Sound | Syllables |
|---|---|
| P | pah, pee, pie, poh, pay |
| B | bah, bee, boo, boh, bay |
| M | mah, mee, moo, moh, may |
| N | nah, nee, noo, noh, nay |
| T | tah, tee, too, toh, tay |
| D | dah, dee, doo, doh, day |
| K | kah, kee, koo, koh, kay |
| G | gah, gee, goo, goh, guy |
| F | fah, fee, foo, foh, fay |
| V | vah, vee, voo, voh, vay |
| S | sah, see, soo, soh, say |
| Z | zah, zee, zoo, zoh, zay |
| SH | shah, shee, shoo, shoh, shay |
| CH | chah, chee, choo, choh, chay |
| J | jah, jee, joo, joh, jay |
| L | lah, lee, loo, loh, lay |
| R | rah, ree, roo, roh, ray |
| TH (as in 'thumb') | thah, thee, thoo, thoh, thay |
| TH (voiced, as in 'the') | thah, thee, thoo, thoh, thay |

**{target} = a word** — the sound's words at the practice position: an SLP's homework position first, then the one chosen in Settings (`Sona.practicePos()`; default Beginning, and THV has no Beginning words, so all ten); any other bank word reaches this prompt when an SLP's homework names it. The whole bank is Part D (public/sona.js:1880).

**{target} = a sentence** — one of 5 frames with a bank word dropped in (public/gamecontent.js:76): "I see a ___.", "I have a ___.", "Look at the ___.", "Here is a ___.", "I like my ___.". The word comes from the same practice position as the word round (homework first, then Settings; default Beginning; "Mixed" opens the whole bank), so 5 × 356 = 1780 sentences are possible; not expanded here.

Two things for Rachel here: the frames are applied blindly, so "I have a rain" and "Here is a bathe" are reachable — the same carrier-phrase problem the word bank once had; and the sentence's own full stop survives into the prompt ("Ready? Say I see a robot., five times." — `display` keeps it), harmless for TTS, but a recording should drop it.

### C4 — Hear it slooow (the turtle)

Not a separate recording. The turtle pill replays the current line slowed to 0.7× by the app (public/charge.html:957); on a sound-alone round that is the C1/C2 text, on any other round it is just the target — syllable, word, or sentence without its full stop (public/charge.html:1303). On a sound-alone round the slowed line ends on "Go!", and with the sound models on it has Rachel's take in the letter's place, slowed with it.

### C5 — Echo's idea, with a syllable or a word

`I have an idea. Let's try this one. Say {target}.`, then "Go!" (public/charge.html:2277)

The step-down after two misses on a word or sentence round: {target} is a syllable
(C3 list) or a word at the practice position (Part D) from one rung down. (Rarely — the
fifth round for a child who has already mastered sentences — it can be a sentence.)
The sound-alone form is fixed and sits in B3. Best left to TTS.

### C6 — Feed Echo

`Where is the {word}? Say... {word}.` (public/arcade-feed.html:576)

Live, free, opened straight from Home. Echo asks this, then "Go!" (B49), at the start of
each of the five turns; the four pictures stay locked until he hears the word, and nothing is
spoken on a right tap, a wrong tap or at the finish. If nothing is heard for
8 s the mic closes and a mic button waits; a tap on it says `Say... {word}.` and "Go!"
(public/arcade-feed.html:535) and listens again. The sound is the one the child's rotation is on that
round (homework sounds first, else the child's focus sounds, else R); the pool is that sound's shortest
eight Beginning-position words with a picture (public/arcade-feed.html:294). The screen says "Where's" while the voice says "Where is".

| Sound | {word} pool |
|---|---|
| P | pig, pen, pie, pan, pizza, paint, pumpkin |
| B | bus, bed, bee, ball, bear, book, boat, banana |
| M | mom, mug, moon, milk, mouse, monkey, mountain |
| N | net, nut, nose, nest, nail, nine, noodle |
| T | top, toe, toy, ten, tiger, tooth, table, turtle |
| D | dog, dad, duck, door, doll, deer, desk, dinosaur |
| K | cat, key, cow, cake, kite, king, cookie |
| G | goat, girl, gift, game, gate, goose, guitar |
| F | fox, fan, fish, fire, foot, fork, farm |
| V | van, vase, vest, video, violin, volcano, vegetable |
| S | sun, soap, sock, soup, seal, sand, sandwich |
| Z | zoo, zip, zero, zebra, zipper, zigzag |
| SH | shoe, ship, shark, sheep, shell, shirt, shower |
| CH | chair, chips, cheese, cherry, chicken, chocolate |
| J | jam, jet, jar, jeep, juice, jacket, giraffe |
| L | lion, leaf, lamp, lock, lemon, ladder, lollipop |
| R | ring, rain, rose, rock, robot, rabbit, rocket |
| TH (as in 'thumb') | thumb, three, think, thorn, thread, thirty |
| TH (voiced, as in 'the') | bathe, mother, father, smooth, teethe, brother, feather, weather |

134 words, two lines each, if recorded as fixed clips (`feed-<word>.mp3`, `feed-again-<word>.mp3`); best left to TTS.

### C7 — Fruit Slice's say-it card, with a syllable or a word

`To keep playing, say... {ask}.` (public/arcade-slice.html:575)

The card between rounds of Fruit Slice. When it asks for more than the sound alone, Echo
says the whole ask as ONE line in his own voice, the syllable or word last and after
a pause, because nothing past the bare sound is recorded; then "Go!". The line is downloaded
before the syllable is shown; if it does not come, or will not play, the card stays on the
sound alone and "To keep playing, say" plus Rachel's recording plays instead (B5). What a card
asks comes from one reader, `Sona.gameAsk` (public/sona.js:1821; which voice at public/sona.js:1810):
the sound alone, then one syllable a card, then a short word, as far as that child's
cards go. Screen: "Say “ree” for wave 2!". The card hears only a voice of the right
kind — it cannot tell a syllable from the bare sound — and nothing here says "correct".
The other five round games' cards ask only the sound (B5).

**{ask} = a syllable or the short word** — only for the sounds switched on in `GAME_SYL_ON` (public/gamecontent.js:61); today: R. One syllable a card, moving on one each day. The short word is `GAME_SHORT` (public/gamecontent.js:63). Never asked, `GAME_SKIP` (public/gamecontent.js:62): P "pee"; G "gee"; TH "thee".

| Sound | Syllables, in order | Short word |
|---|---|---|
| R | ree, rah, roh | rot |

**{ask} can also be** a word from a speech therapist's homework for that sound, or the syllable or word the "Say it 5 times" page just ended on (it hands it over, so a card never asks below it). Those are C3's syllables and Part D's words; not expanded here.

Rachel's calls, built on defaults until she answers: which syllables and in what order, whether "rot" is the word, the lists for the other 18 sounds, and Echo's TTS voice modelling a syllable at all.

**All 4 lines for the sounds switched on.** Best left to TTS; listed so nothing is hidden.

| # | File | Say this | When | Source |
|---|---|---|---|---|
| C77 | card-R-ree.mp3 | To keep playing, say... ree. | Fruit Slice's card asks R in a syllable. | public/arcade-slice.html:575 |
| C78 | card-R-rah.mp3 | To keep playing, say... rah. | Fruit Slice's card asks R in a syllable. | public/arcade-slice.html:575 |
| C79 | card-R-roh.mp3 | To keep playing, say... roh. | Fruit Slice's card asks R in a syllable. | public/arcade-slice.html:575 |
| C80 | card-R-rot.mp3 | To keep playing, say... rot. | Fruit Slice's card asks R in a short word. | public/arcade-slice.html:575 |

### C8 — The picture games (Say & Play)

`Say... {word}.` (public/sayplay.js:550)

One shared script (`sayplay.js`) runs every picture game. Each turn shows a picture and
its word, Echo models the word with this line, then "Go!" (B49), then the mic opens. Balloon Party, Birthday Cake, Castle Builder, Dino Dig, Fish Tank, Grow a Flower, Surprise Boxes, Hoops, Monster Makeover, Peekaboo, Pizza Chef, Puppy Bath, Race Car, Robot Builder, Rocket Blast, Build a Snowman, Soccer Goal, Space Trip, Bedtime Stars, Choo-Choo Train, Treasure Map, Light the Way (Day 1 of the daily story), Wind-Up Toys (Day 2 of the daily story), Puzzle Bridge (Day 3 of the daily story), The Thirsty Waterwheel Garden (Day 4 of the daily story), The Little Island Postboat (Day 5 of the daily story), Breakfast at the Moonberry Bakery (Day 6 of the daily story), Tortoise's New Front Door (Day 7 of the daily story), The Glowworm Lantern Walk (Day 8 of the daily story), All Aboard for Snowdrop Valley (Day 9 of the daily story), The Hilltop Patchwork Kite (Day 10 of the daily story), The Sandstone Nest Lift (Day 11 of the daily story), The Lily-Pad Concert (Day 12 of the daily story), Seeds Across the Rooftops (Day 13 of the daily story), The Moving-Star Observatory (Day 14 of the daily story) first explain that each word is said two times, in a separate sentence (B7). Nothing plays between the two sayings. The cheers ("Yes!", "You did it!") are text. The sound is the one the
child's rotation is on (else R); the pool is up to ten of that sound's shortest
Beginning-position words with a picture (public/sayplay.js:467). **Best left to TTS.**

Live today (22): Balloon Party, Bubble Pop, Birthday Cake, Castle Builder, Dino Dig, Fish Tank, Grow a Flower, Surprise Boxes, Hoops, Monster Makeover, Peekaboo, Pizza Chef, Puppy Bath, Race Car, Robot Builder, Rocket Blast, Build a Snowman, Soccer Goal, Space Trip, Bedtime Stars, Choo-Choo Train, Treasure Map. Coming soon (0), the same line when they open: none.

In the daily story (14), reached only from that day's story and never from a shelf: Light the Way (Day 1, "The Lighthouse Sneeze"), Wind-Up Toys (Day 2, "Grandpa Bear's Sleepy Toys"), Puzzle Bridge (Day 3, "The Puzzle Bridge"), The Thirsty Waterwheel Garden (Day 4, "The Thirsty Waterwheel Garden"), The Little Island Postboat (Day 5, "The Little Island Postboat"), Breakfast at the Moonberry Bakery (Day 6, "Breakfast at the Moonberry Bakery"), Tortoise's New Front Door (Day 7, "Tortoise's New Front Door"), The Glowworm Lantern Walk (Day 8, "The Glowworm Lantern Walk"), All Aboard for Snowdrop Valley (Day 9, "All Aboard for Snowdrop Valley"), The Hilltop Patchwork Kite (Day 10, "The Hilltop Patchwork Kite"), The Sandstone Nest Lift (Day 11, "The Sandstone Nest Lift"), The Lily-Pad Concert (Day 12, "The Lily-Pad Concert"), Seeds Across the Rooftops (Day 13, "Seeds Across the Rooftops"), The Moving-Star Observatory (Day 14, "The Moving-Star Observatory"). Days 1-3: ages 5-8 say eight words a round, ages 3-4 six; Days 4-14: ages 5-8 say eight words a round, ages 3-4 five. Each word two times.

| Sound | {word} pool |
|---|---|
| P | pig, pen, pie, pan, pizza, paint, pumpkin |
| B | bus, bed, bee, ball, bear, book, boat, banana |
| M | mom, mug, moon, milk, mouse, monkey, mountain |
| N | net, nut, nose, nest, nail, nine, noodle |
| T | top, toe, toy, ten, tiger, tooth, table, turtle |
| D | dog, dad, duck, door, doll, deer, desk, dinosaur |
| K | cat, key, cow, cake, kite, king, cookie |
| G | goat, girl, gift, game, gate, goose, guitar |
| F | fox, fan, fish, fire, foot, fork, farm |
| V | van, vase, vest, video, violin, volcano, vegetable |
| S | sun, soap, sock, soup, seal, sand, sandwich |
| Z | zoo, zip, zero, zebra, zipper, zigzag |
| SH | shoe, ship, shark, sheep, shell, shirt, shower |
| CH | chair, chips, cheese, cherry, chicken, chocolate |
| J | jam, jet, jar, jeep, juice, jacket, giraffe |
| L | lion, leaf, lamp, lock, lemon, ladder, lollipop |
| R | ring, rain, rose, rock, robot, rabbit, rocket |
| TH (as in 'thumb') | thumb, three, think, thorn, thread, thirty |
| TH (voiced, as in 'the') | bathe, mother, father, smooth, teethe, brother, feather, weather, leather, breathe |

**Game words, when available.** Existing illustrated bank words, selected at turns 1, 4 and 7 without repeating an already used themed word. Homework words replace this selection. Rachel reviews these lists before release.
| Game | Sound | Themed words |
|---|---|---|
| Soccer Goal | B | ball, bear |
| Soccer Goal | N | net |
| Soccer Goal | T | toe |
| Soccer Goal | F | foot |
| Soccer Goal | S | sock |
| Soccer Goal | SH | shoe, shirt |
| Soccer Goal | K | cup |
| Soccer Goal | M | medal |
| Soccer Goal | L | leg |
| Hoops | B | ball |
| Hoops | N | net |
| Hoops | S | sock |
| Hoops | SH | shoe, shirt |
| Hoops | K | cup |
| Hoops | M | medal |
| Hoops | L | leg |
| Dino Dig | B | bone, bucket |
| Dino Dig | R | rock |
| Dino Dig | M | mountain, map |
| Dino Dig | N | nest |
| Dino Dig | T | tooth |
| Dino Dig | D | dinosaur |
| Dino Dig | K | cave |
| Dino Dig | F | foot |
| Dino Dig | V | volcano |
| Dino Dig | S | sand, sun |
| Dino Dig | SH | shell |
| Dino Dig | L | leaf, lizard |
| Dino Dig | TH (as in 'thumb') | thorn |
| Light the Way | B | boat |
| Light the Way | M | moon, mouse |
| Light the Way | N | net |
| Light the Way | F | fish |
| Light the Way | SH | ship, shell |
| Light the Way | S | seal |
| Light the Way | R | rock, rain |
| Light the Way | L | lamp, ladder |
| Light the Way | D | duck |
| Light the Way | T | turtle |
| Light the Way | P | pig |
| Wind-Up Toys | B | ball, bear, bus |
| Wind-Up Toys | M | monkey, mouse |
| Wind-Up Toys | F | fox |
| Wind-Up Toys | SH | ship |
| Wind-Up Toys | R | robot, rocket |
| Wind-Up Toys | L | lion |
| Wind-Up Toys | D | doll, duck |
| Wind-Up Toys | T | toy, top |
| Wind-Up Toys | K | key, kite |
| Wind-Up Toys | G | game, gift |
| Wind-Up Toys | Z | zebra |
| Wind-Up Toys | J | jeep, jet |
| Wind-Up Toys | V | van |
| Puzzle Bridge | B | boat, bee |
| Puzzle Bridge | M | mug |
| Puzzle Bridge | N | nest, net |
| Puzzle Bridge | F | fish |
| Puzzle Bridge | SH | shell, ship |
| Puzzle Bridge | S | sand, seal |
| Puzzle Bridge | R | rock, rain, rose |
| Puzzle Bridge | L | leaf |
| Puzzle Bridge | D | duck |
| Puzzle Bridge | T | turtle |
| Puzzle Bridge | K | cake, cookie |
| Puzzle Bridge | G | gift, gate |
| Puzzle Bridge | P | pie |
| Puzzle Bridge | J | jam, juice |
| Puzzle Bridge | CH | cherry, cheese |
| Puzzle Bridge | V | vase |

### C9 — Books (`library.html`): 48 books, 498 pages

Live: Home's Books door opens the shelf. Echo reads everything in a book aloud.
**Best left to TTS** — it is a lot of text, and it changes when a book does. Listed so
nothing is hidden. Four templates, and two fixed lines (B6):

- **The cover:** `{title}! A story full of {sound} sounds.` (public/library.html:1682) — {sound} is read as its letters ("R", "SH", "TH"). Written out under each book below.
- **A page:** the page's text, read as the page opens (public/library.html:1729) and again on "Hear it" (public/library.html:1958).
- **A tapped word:** that word alone (public/library.html:1937).
- **The key word:** 498 of the 498 pages have one, shown in bold below. After reading the page Echo asks `Can you say... {word}.`; after a try that was a voice but not the book's kind of sound, `One more time... {word}.` (public/library.html:1888); after three of those, the B6 line and the page turns. A name keeps its capital. Silence never turns the page. A child younger than the age the book's sound usually arrives is never asked (public/library.html:1766), and the first ask of a visit waits for a grown-up's yes to the mic. Screen: "Can you say {word}?".

**Rory and the Rainbow** — R (public/library.html:372). Cover: "Rory and the Rainbow! A story full of R sounds."

1. Rain taps on the roof. Rory the rabbit looks up. — **rabbit**
2. The rain stops. Look, a rainbow! — **rain**
3. Rory runs down the road to reach it. — **reach**
4. The road ends at a rushing river. — **rushing**
5. Rory ties reeds into a raft. — **reeds**
6. He rows the raft on the river. — **river**
7. Remy the raccoon waves. "Room on the raft?" — **raccoon**
8. Then they see a robot, stuck in the mud. — **robot**
9. Rory and Remy pull him out with a red ribbon. — **ribbon**
10. "Thank you! Ride in my rocket!" says the robot. — **rocket**
11. They land by the rainbow, in a field of roses. — **rainbow**
12. Rory, Remy, and the robot run and play! — **robot**

**Rosie and the Red Wagon** — R (public/library.html:401). Cover: "Rosie and the Red Wagon! A story full of R sounds."

1. Rosie has a red wagon. — **red**
2. She ties a rope on it. — **rope**
3. Rosie rolls the wagon up a hill. — **rolls**
4. A rabbit sits by the road. — **rabbit**
5. "Can I ride?" asks the rabbit. — **ride**
6. "Yes! Hop in!" says Rosie. — **Rosie**
7. Then a raccoon waves. — **raccoon**
8. The raccoon rides in the wagon, too. — **rides**
9. Rain falls on them all. — **rain**
10. Rosie holds a big leaf up on top. — **Rosie**
11. The rain stops. The sun comes out. — **rain**
12. Rosie, the rabbit and the raccoon wave. What a ride! — **ride**

**Ray and the Lost Ring** — R (public/library.html:417). Cover: "Ray and the Lost Ring! A story full of R sounds."

1. Ray the robin has a ring. — **ring**
2. It is a shiny ring. — **ring**
3. One day, the ring is gone! — **ring**
4. Ray looks by the river. — **river**
5. Ray looks on the roof. — **roof**
6. Ray looks in the reeds. — **reeds**
7. A red ladybug says, "Look up high!" — **red**
8. Ray sees a raccoon on a log. — **raccoon**
9. The raccoon has the ring! — **raccoon**
10. "Is this ring lost?" asks the raccoon. — **ring**
11. "Yes! Thank you!" sings Ray. — **Ray**
12. Ray gives the raccoon a ribbon to say thank you. — **ribbon**

**Boo the Bat on Halloween** — B, on the shelf 2026-10-01 to 2026-10-31 (public/library.html:433). Cover: "Boo the Bat on Halloween! A story full of B sounds."

1. Boo the bat wakes up at night. — **bat**
2. It is Halloween! Boo gets his bucket. — **bucket**
3. Boo puts on a big hat. — **big**
4. Boo flies past the moon. — **Boo**
5. Boo sees a pumpkin with a happy face. — **Boo**
6. A cat in a cape waves at Boo. — **Boo**
7. "Trick or treat!" says Boo. — **Boo**
8. A candy drops in his bucket. — **bucket**
9. Then a little ghost says, "Boo!" — **Boo**
10. Boo jumps. Then he laughs. — **Boo**
11. Boo and the ghost share the candy. — **Boo**
12. Boo goes to bed. Happy Halloween! — **bed**

**Rory the Rabbit on Halloween** — R, on the shelf 2026-10-01 to 2026-10-31 (public/library.html:449). Cover: "Rory the Rabbit on Halloween! A story full of R sounds."

1. Rory the rabbit wakes up. It is Halloween! — **rabbit**
2. Rory puts on his robot costume. — **robot**
3. He gets a bucket with a red ribbon. — **ribbon**
4. Rory runs down the road. The moon is round. — **road**
5. The real robot comes too. He is a rocket! — **rocket**
6. Rory sees a house with a red roof. — **roof**
7. Ring, ring! "Happy Halloween!" says Rory. — **ring**
8. Plop! Raisins land in his bucket. Yum! — **raisins**
9. Rory rests on a rock. A ghost says, "Boo!" — **rock**
10. Rory jumps. The ghost is Remy the raccoon! — **raccoon**
11. They laugh. Rory gives Remy half his raisins. — **raisins**
12. Rory the rabbit goes to bed. Happy Halloween! — **rabbit**

**Sid the Seagull on Halloween** — S, on the shelf 2026-10-01 to 2026-10-31 (public/library.html:466). Cover: "Sid the Seagull on Halloween! A story full of S sounds."

1. The sun goes down by the sea. — **sun**
2. It is Halloween! Sid has a sack for candy. — **sack**
3. Sid wears a silly pumpkin suit. — **suit**
4. Sid flies by the big round moon. — **Sid**
5. Seven happy pumpkins sit on a wall. — **seven**
6. Sadie waves at Sid. She is a little witch! — **Sadie**
7. "Trick or treat!" say Sid and Sadie. — **Sid**
8. Candy falls into Sid's sack. — **sack**
9. Then a seal in a sheet says, "Boo!" — **seal**
10. It is Sam! Sid and Sam giggle and giggle. — **Sam**
11. They sit on the sand and share the candy. — **sand**
12. Sid goes to bed by the sea. Happy Halloween! — **Sid**

**Leon's Trick-or-Treat Night** — L, on the shelf 2026-10-01 to 2026-10-31 (public/library.html:482). Cover: "Leon's Trick-or-Treat Night! A story full of L sounds."

1. Leon the lion wakes up from his nap. — **lion**
2. It is trick-or-treat night! Leon gets his lantern. — **lantern**
3. Leon puts on a ladybug costume. — **ladybug**
4. Lucky the puppy is a lemon! — **lemon**
5. They walk by the lake under the moon. — **lake**
6. A happy pumpkin sits on a big log. — **log**
7. "Trick or treat!" says Leon. — **Leon**
8. A kind lady drops candy in his bucket. — **lady**
9. Then a ghost jumps out of the leaves. "Boo!" — **leaves**
10. It is Libby the lamb! Leon laughs. — **lamb**
11. They sit by the lantern and share the candy. — **lantern**
12. Leon goes to bed. Good night, Leon! — **Leon**

**Zoe the Zebra on Halloween** — Z, on the shelf 2026-10-01 to 2026-10-31 (public/library.html:498). Cover: "Zoe the Zebra on Halloween! A story full of Z sounds."

1. Zoe the zebra woke up from her nap. — **zebra**
2. It's Halloween at the zoo! Zoe got her bucket. — **zoo**
3. Zoe put on a zucchini suit. How silly! — **zucchini**
4. Zoe pulled the zipper up. Zip! — **zipper**
5. Zoe zoomed out under the big round moon. — **zoomed**
6. Zack the zookeeper held a glowing pumpkin. — **zookeeper**
7. "Trick or treat!" said Zoe. — **Zoe**
8. Zack put some candy in her bucket. — **zack**
9. Then a little ghost said, "Boo!" Zoe jumped! — **Zoe**
10. Zoe laughed. "It's a little zebra in a sheet!" — **zebra**
11. Zoe and the little zebra shared the candy. — **Zoe**
12. Zoe the zebra went to bed. Happy Halloween! — **zebra**

**Finn the Fish on Halloween** — F, on the shelf 2026-10-01 to 2026-10-31 (public/library.html:514). Cover: "Finn the Fish on Halloween! A story full of F sounds."

1. Finn the fish wakes up at night. — **fish**
2. It is Halloween! Finn puts on fairy wings. — **fairy**
3. Finn gets a bucket with a funny face. — **face**
4. Finn waves a fin at the big moon. — **fin**
5. Five happy pumpkins glow by the sea. — **five**
6. The duck family swims by, dressed as bats! — **family**
7. Finn calls to a gull, "Trick or treat!" — **Finn**
8. The gull drops fudge in Finn's bucket. — **fudge**
9. Then a ghost with a furry tail says, "Boo!" — **furry**
10. Finn jumps! It is Fay the fox. — **fox**
11. Finn and Fay share the fudge. — **fudge**
12. Finn falls asleep by his rock. Happy Halloween! — **Finn**

**Penny's Pebble Party** — P (public/library.html:530). Cover: "Penny's Pebble Party! A story full of P sounds."

1. Penny the penguin has a pink pail. — **penguin**
2. Penny waddles down to the pond. — **pond**
3. Penny finds a pebble. Then another pebble! — **pebble**
4. Penny puts the pebbles in the pail. — **pebbles**
5. Pat the pig peeks in. "Can I paint them?" — **paint**
6. Penny and Pat paint the pebbles. — **paint**
7. Pink pebbles! Peach pebbles! — **pink**
8. Polly the parrot lands on a pole. — **parrot**
9. "Polly! Come to our party!" says Penny. — **party**
10. Polly brings a pie to the party. — **pie**
11. They put the pebbles in a row by the pond. — **pebbles**
12. Penny, Pat, and Polly have a pebble party! — **Penny**

**Bo's Beach Day** — B (public/library.html:546). Cover: "Bo's Beach Day! A story full of B sounds."

1. Bo the bear has a big boat. — **bear**
2. Bo puts a basket in the boat. — **boat**
3. In the basket: berries, buns, and a banana. — **banana**
4. Bo rows the boat to the beach. — **boat**
5. A bee buzzes by. Buzz, buzz! — **bee**
6. "Can I come?" asks Bella the bee. — **bee**
7. Bo and Bella sit on the beach. — **beach**
8. A ball bounces by the boat. — **ball**
9. Ben the bunny wants the ball back. — **ball**
10. Bo bumps the ball to Ben. — **bumps**
11. Ben and Bella and Bo eat berries and buns. — **berries**
12. What a fun day at the beach, Bo! — **Bo**

**Mia Makes Muffins** — M (public/library.html:562). Cover: "Mia Makes Muffins! A story full of M sounds."

1. Mia the mouse wants to make muffins. — **mouse**
2. Mia gets milk and a mixing bowl. — **milk**
3. Mia mixes and mixes. What a mess! — **mixes**
4. Max the mole peeks in. "More milk?" — **milk**
5. Max adds melon. Mia adds maple syrup. — **melon**
6. Mia puts the muffins in the oven. — **muffins**
7. The moon rises over the meadow. — **moon**
8. The muffins are ready at last! — **muffins**
9. Max and Mia munch muffins. — **munch**
10. "Mia, may I take one to Molly?" asks Max. — **Molly**
11. Molly the moose says, "Many thanks!" — **moose**
12. Mia, Max, and Molly share a meal under the moon. — **moon**

**Ned Needs a Net** — N (public/library.html:578). Cover: "Ned Needs a Net! A story full of N sounds."

1. Nora the newt has a nice, neat nest. — **nest**
2. Nora takes a nap. — **nap**
3. Knock, knock! A noise wakes Nora. — **knock**
4. It is Ned the newt. "My net is lost!" — **net**
5. Nora looks near the nest. — **nest**
6. Ned looks by the old log. — **Ned**
7. "No net here," says Ned. — **net**
8. Nora spots a net up a tree. — **net**
9. Nora nudges it with her nose. — **nose**
10. The net drops. "Neat!" says Ned. — **neat**
11. Night falls. Nora makes noodles. — **noodles**
12. Ned eats noodles with Nora. What a nice night! — **night**

**Toby's Tiny Tuba** — T (public/library.html:594). Cover: "Toby's Tiny Tuba! A story full of T sounds."

1. Toby the tiger has a tiny tuba. — **tiger**
2. Toby taps his toes. — **taps**
3. "Too, too, too!" goes the tuba. — **tuba**
4. Tia the toucan comes by. — **toucan**
5. Tia likes the tune. She taps along. — **tune**
6. Toby and Tia play for the town. — **town**
7. Ten turkeys come to hear. — **ten**
8. The turkeys tap their toes too. — **turkeys**
9. A tiny toad jumps on the tuba. — **toad**
10. The toad sings a tune. — **toad**
11. Everyone claps. Toby takes a bow. — **Toby**
12. "Time for tea!" says Toby. — **tea**

**Dot Digs a Pool** — D (public/library.html:610). Cover: "Dot Digs a Pool! A story full of D sounds."

1. Dot the duck wants a pool to dive in. — **duck**
2. Dot digs a hole. Dig, dig, dig! — **digs**
3. Dan the dog comes to help. — **dog**
4. Dan digs too. Dust flies! — **dust**
5. The hole gets deep. — **deep**
6. Down comes the rain. — **down**
7. The rain fills the hole all day. — **day**
8. Now Dot has a deep pool! — **Dot**
9. Dot dips her toes. — **dips**
10. "Dan, let's dive!" says Dot. — **dive**
11. Dot dives. Dan dives. Splash! — **dives**
12. Dot is a happy duck. Dan is a happy dog! — **duck**

**Kip's Kite** — K (public/library.html:626). Cover: "Kip's Kite! A story full of K sounds."

1. Kip the kangaroo has a kite. — **kangaroo**
2. The kite has a long tail. — **kite**
3. Kip hops up the hill. — **Kip**
4. Whoosh! The wind catches the kite. — **kite**
5. Up, up, up goes Kip's kite! — **kite**
6. Cody the cow comes to see. — **cow**
7. "Can I hold it?" says Cody. — **Cody**
8. Cody holds the kite. The wind gets strong! — **kite**
9. The kite carries Cody up in the air! — **carries**
10. "Come down, Cody!" calls Kip. — **come**
11. Cody comes down in the corn. — **corn**
12. Kip gives Cody a carrot. What a day! — **carrot**

**Goldie's Guitar** — G (public/library.html:642). Cover: "Goldie's Guitar! A story full of G sounds."

1. Goldie the goose gets a gift. — **goose**
2. The gift is a guitar! — **guitar**
3. Goldie goes to the garden. — **garden**
4. Goldie plays a happy tune. — **Goldie**
5. Gus the goat comes to the gate. — **goat**
6. "Goldie, can I have a go?" asks Gus. — **Gus**
7. Gus gets the guitar. — **guitar**
8. Gus is no good at it! — **good**
9. Goldie shows Gus how. — **Goldie**
10. Gus gets better and better. — **gets**
11. The garden gophers come to hear. — **gophers**
12. Goldie and Gus give a garden show! — **garden**

**Finn Finds a Feather** — F (public/library.html:658). Cover: "Finn Finds a Feather! A story full of F sounds."

1. Finn the fish lives by a big rock. — **fish**
2. Finn has fast fins. — **fins**
3. One day, Finn finds a feather. — **feather**
4. "Whose feather?" asks Finn. — **Finn**
5. Finn swims far and fast. — **fast**
6. Finn meets Fay the fox by the shore. — **fox**
7. "Not my feather," says Fay. — **Fay**
8. Finn meets a family of ducks. — **family**
9. "Not our feather," they say. — **feather**
10. Then a gull swoops down. It has no tail feather! — **feather**
11. Finn gives the feather back. "Thank you!" says the gull. — **Finn**
12. Finn feels fine. What a fun day! — **fine**

**Val the Van** — V (public/library.html:674). Cover: "Val the Van! A story full of V sounds."

1. Val the van is in a valley. — **van**
2. Val goes to the village. — **village**
3. "Beep, beep!" goes Val. — **Val**
4. Val takes a vase to Vicky. — **vase**
5. Vicky puts a violet in the vase. — **vase**
6. Val takes vegetables to the vet. — **vegetables**
7. The vet shares them with the animals. — **vet**
8. Val takes a violin to Vince. — **violin**
9. Vince plays a very sweet tune. — **Vince**
10. The village comes to hear. — **village**
11. Vicky washes Val. Val looks very shiny. — **Vicky**
12. "Thank you, Val!" says the village. — **Val**

**Sid the Seagull** — S (public/library.html:690). Cover: "Sid the Seagull! A story full of S sounds."

1. Sid the seagull lives by the sea. — **seagull**
2. The sun is up. The sand is warm. — **sand**
3. Sid sees a sandwich on a seat. — **sandwich**
4. "Sadie, may I have some?" says Sid. — **Sadie**
5. Sadie gives Sid a bite. — **Sid**
6. "Thank you, Sadie!" Sid sings a song. — **sings**
7. Sadie and Sid sit in the sand. — **sand**
8. They dig a big sand hill. — **sand**
9. Sid adds a seashell on top. — **seashell**
10. Oh no! The sea rolls in. — **sea**
11. The sand hill is gone. Sid is sad. — **sad**
12. "Silly Sid! We can make one more!" says Sadie. — **silly**

**Sam's Sailboat** — S (public/library.html:706). Cover: "Sam's Sailboat! A story full of S sounds."

1. Sam the seal has a sailboat. — **sailboat**
2. The sun is up. Sam sails out. — **sun**
3. The sea is calm and blue. — **sea**
4. Sam sees a little fish. — **sees**
5. The fish is sad. "I can't find my home!" — **sad**
6. "Sit in my boat," says Sam. — **sit**
7. They sail by a seagull. — **sail**
8. The seagull says, "Go that way!" — **seagull**
9. Sam sails and sails. — **sails**
10. Soon, they see a big reef. — **soon**
11. The mom fish is there! She is so happy. — **so**
12. Sam sings a song all the way home. — **song**

**Sophie's Silly Soup** — S (public/library.html:722). Cover: "Sophie's Silly Soup! A story full of S sounds."

1. Sophie is making soup. — **soup**
2. Sophie adds a carrot. — **Sophie**
3. Sophie adds a big potato. — **Sophie**
4. Then Sophie adds a sock! — **sock**
5. "Oh no, a sock in the soup is silly!" — **silly**
6. Sophie pulls the sock out. — **sock**
7. She adds salt. — **salt**
8. She adds some seeds. — **seeds**
9. Sophie gives the soup a sip. — **sip**
10. "Yummy soup!" says Sophie. — **soup**
11. Sophie calls her pals to the table. — **Sophie**
12. They sit and sip the soup together. — **sip**

**Zoe and the Zipper** — Z (public/library.html:738). Cover: "Zoe and the Zipper! A story full of Z sounds."

1. Zoe the zebra woke up at the zoo. — **zebra**
2. It felt cold. Zoe got her coat. — **Zoe**
3. Zoe pulled the zipper. Zip! — **zipper**
4. Oh no! The zipper got stuck. — **zipper**
5. Zoe called Zack the zookeeper. — **zookeeper**
6. Zack tugged the zipper. Zip, zip! — **zip**
7. Zap! The zipper went up. — **zipper**
8. "Thank you, Zack!" said Zoe. — **Zack**
9. Zoe zoomed out to play. — **zoomed**
10. Zoom, zoom, all around the zoo! — **zoo**
11. Zack gave Zoe a zucchini for lunch. — **zucchini**
12. Zoe the zebra felt warm and happy. — **zebra**

**Shay the Shy Shark** — SH (public/library.html:754). Cover: "Shay the Shy Shark! A story full of SH sounds."

1. Shay the shark is shy. — **shark**
2. Shay hides in the shadow of a ship. — **ship**
3. "Come and see the show!" shout the crabs. — **shout**
4. Shay shakes her head. — **shakes**
5. Shimmer the seahorse swims by. — **Shimmer**
6. "Shay, come with me to the show!" says Shimmer. — **Shay**
7. Shay is not sure. — **sure**
8. Shimmer shows Shay a shiny shell. — **shell**
9. "Shake it in the show!" says Shimmer. — **shake**
10. Shay shakes the shell. Shh, shh, shh! — **shell**
11. The crabs cheer. "Shay, you are a star!" — **Shay**
12. Shay is not shy now. She shines! — **shines**

**Shane and the Shiny Shell** — SH (public/library.html:770). Cover: "Shane and the Shiny Shell! A story full of SH sounds."

1. Shane is at the sea. — **Shane**
2. He sees a shiny shell. — **shell**
3. Shane picks up the shell. — **shell**
4. He shows it to his mom. — **shows**
5. "Shake it!" she says. — **shake**
6. Shane shakes the shell. A crab comes out! — **shakes**
7. The crab is shy. — **shy**
8. Shane sits very still. — **Shane**
9. The crab peeks out of the shell. — **shell**
10. Shane shares a snack with the crab. — **shares**
11. The crab is not shy now. — **shy**
12. Shane and the crab are pals. Shane shouts, "Yay!" — **shouts**

**Shawn and His Shadow** — SH (public/library.html:786). Cover: "Shawn and His Shadow! A story full of SH sounds."

1. Shawn has a shadow. — **shadow**
2. The shadow is on the wall. — **shadow**
3. Shawn waves. The shadow waves. — **shadow**
4. Shawn hops. The shadow hops. — **shadow**
5. Shawn shakes. The shadow shakes. — **shakes**
6. Then the sun goes down. Where is the shadow? — **shadow**
7. Shawn is sad. The shadow is gone. — **shadow**
8. Mom shines a lamp. — **shines**
9. The shadow is back! Shawn cheers. — **shadow**
10. Shawn makes a shadow dog with his hands. — **shadow**
11. The shadow dog shakes its tail. — **shakes**
12. Shawn and his shadow go to bed. — **shadow**

**Chip the Chipmunk** — CH (public/library.html:802). Cover: "Chip the Chipmunk! A story full of CH sounds."

1. Chip the chipmunk has chubby cheeks. — **chipmunk**
2. Chip chews on chestnuts. — **chestnuts**
3. It is chilly. Chip needs a cozy spot. — **chilly**
4. Chip checks the old chimney. — **chimney**
5. A chick is in the chimney! — **chick**
6. "Cheep, cheep!" says the chick. — **cheep**
7. The chick is chilly too. — **chilly**
8. Chip shares his chestnuts. — **Chip**
9. Chip and the chick chat and chew. — **chat**
10. They find a comfy chair. — **chair**
11. Chip and the chick cuddle up in the chair. — **chair**
12. "Cheers for a new pal!" chirps the chick. — **chirps**

**Jax and the Jam Jar** — J (public/library.html:818). Cover: "Jax and the Jam Jar! A story full of J sounds."

1. Jax the jaguar lives in the jungle. — **jaguar**
2. Jax likes to jump and jog. — **jump**
3. One day, Jax finds a jar of jam. — **jar**
4. "Yum, jam!" Jax jumps for joy. — **jam**
5. Jax cannot get the lid off the jar. — **jar**
6. Along comes Jill the giraffe. — **giraffe**
7. Jill gives the jar a twist. — **jar**
8. Pop! The jar is open. — **jar**
9. "Join me for jam!" says Jax. — **jam**
10. Jax and Jill eat jam and drink juice. — **juice**
11. Jill tells a joke. Jax giggles. — **joke**
12. What a jolly day in the jungle! — **jungle**

**Leo's Lucky Leaf** — L (public/library.html:834). Cover: "Leo's Lucky Leaf! A story full of L sounds."

1. Leo the lamb likes to leap. — **lamb**
2. Leo leaps by the lake. — **leaps**
3. A leaf lands on Leo's head. — **leaf**
4. "A lucky leaf!" Leo laughs. — **leaf**
5. Leo takes the leaf to Lucy. — **leaf**
6. Lucy is a lazy lizard on a log. — **lizard**
7. "Look, Lucy! A lucky leaf!" says Leo. — **lucky**
8. Lucy licks her lips. "Is it lunch?" — **licks**
9. "No, Lucy! Let's make a leaf boat!" — **Lucy**
10. They lay the leaf on the lake. — **lake**
11. A ladybug rides the leaf boat. — **ladybug**
12. Leo and Lucy wave. What luck! — **luck**

**Libby and the Lemon** — L (public/library.html:850). Cover: "Libby and the Lemon! A story full of L sounds."

1. Libby the lamb is hungry. — **lamb**
2. Libby wants lunch. — **lunch**
3. She finds a lemon. — **lemon**
4. The lemon is sour! Libby makes a face. — **lemon**
5. Next, she finds some lettuce. — **lettuce**
6. Libby likes the lettuce. — **likes**
7. Then Libby sees a ladybug. — **ladybug**
8. "Can I have some lunch too?" asks the ladybug. — **lunch**
9. Libby gives her a leaf. — **leaf**
10. They eat lunch on a log. — **log**
11. Libby laughs. Lunch is more fun with a friend. — **laughs**
12. Libby and the ladybug lie down to rest. — **lie**

**Leon's Lantern** — L (public/library.html:866). Cover: "Leon's Lantern! A story full of L sounds."

1. Leon the lion has a lantern. — **lion**
2. It is night. Leon cannot see. — **Leon**
3. He turns on his lantern. — **lantern**
4. Now Leon can see the lake. — **lake**
5. Where is his pet, Lucky? Leon looks. — **Lucky**
6. Leon looks by the logs. — **logs**
7. Leon looks under a leaf. — **leaf**
8. Leon hears a noise. Woof! — **Leon**
9. It is Lucky! Lucky licks Leon. — **licks**
10. Leon laughs and hugs Lucky. — **laughs**
11. They go home by the light of the lantern. — **light**
12. Leon and Lucky rest by the lantern. — **lantern**

**Theo's Thunder Day** — TH (public/library.html:882). Cover: "Theo's Thunder Day! A story full of TH sounds."

1. Theo thinks it is a fun day. — **Theo**
2. Theo is thirsty. He sips a big drink. — **thirsty**
3. Thump! Thud! What is it? — **thump**
4. It is thunder! Theo hides his head. — **thunder**
5. Theo feels a bit scared. — **Theo**
6. Theo's pal Thea comes over. — **Thea**
7. "Theo, think of a fun thing!" says Thea. — **think**
8. Theo thinks of a thick, warm blanket. — **thick**
9. Theo and Thea sit under a thick blanket. — **thick**
10. Thea hums a tune. Theo taps his thumb. — **thumb**
11. Soon, no more thunder. — **thunder**
12. "Thanks, Thea!" Theo gives a big thumbs up. — **thumbs**

**Thor Says Thank You** — TH (public/library.html:899). Cover: "Thor Says Thank You! A story full of TH sounds."

1. Thor is a big, kind bear. — **Thor**
2. Thor thinks of his pals. — **thinks**
3. "I want to thank my pals," says Thor. — **thank**
4. Thor picks a thick red flower. — **thick**
5. He gives it to Fox. "Thank you, Fox!" — **thank**
6. Thor finds a thimble of honey. — **thimble**
7. He gives it to Bee. "Thank you, Bee!" — **thank**
8. Thor is thirsty. He sips some water. — **thirsty**
9. He thinks of one more pal. — **thinks**
10. It is Owl! Owl helps Thor every day. — **Thor**
11. Thor gives Owl a big thumbs up. — **thumbs**
12. "Thanks, Thor!" his pals say. Thor is so happy. — **thanks**

**Thelma's Thirsty Plant** — TH (public/library.html:915). Cover: "Thelma's Thirsty Plant! A story full of TH sounds."

1. Thelma has a plant. — **Thelma**
2. Thelma's plant is thirsty. — **thirsty**
3. Its leaves look thin and sad. — **thin**
4. Thelma thinks. — **thinks**
5. "I know! It needs water!" thinks Thelma. — **thinks**
6. Thelma fills a cup. Thud! It falls. — **thud**
7. Thelma tries again. — **Thelma**
8. Thelma gives her plant a big drink. — **Thelma**
9. Thelma waits and thinks. — **thinks**
10. Soon, a thick bud pops up. — **thick**
11. Thelma says thanks to her plant. — **thanks**
12. It is a big pink flower! Thelma gives it a thumbs up. — **thumbs**

**This Bear, That Bee** — TH (v) (public/library.html:931). Cover: "This Bear, That Bee! A story full of TH sounds."

1. This is a big bear. That is a little bee. — **this**
2. They are pals. They like to play. — **they**
3. "Let's go there!" says the bear. — **there**
4. There is a pond by the hill. — **the**
5. Then they see the ducks. — **then**
6. "Look at those ducks!" says the bee. — **those**
7. The ducks swim in a line. — **the**
8. "These seeds are for them," says the bee. — **these**
9. They toss the seeds to the ducks. — **they**
10. The ducks quack, "Yum, yum!" — **the**
11. Then the sun sets. — **then**
12. "That was the best day!" say the pals. — **that**

**Rory the Rabbit** — R (public/library.html:948). Cover: "Rory the Rabbit! A story full of R sounds."

1. Rory the rabbit rides a red rocket. — **rabbit**
2. The rocket roars over the rainbow. — **rainbow**
3. Rory sees a robot on a rock. — **robot**
4. The robot gives Rory a ring. — **ring**
5. They race around the river. — **race**
6. Rory roars: hooray, hooray! — **Rory**

**Reba the Robot** — R (public/library.html:956). Cover: "Reba the Robot! A story full of R sounds."

1. Reba the robot runs on a road. — **robot**
2. Reba rolls past a red rose. — **rose**
3. A rabbit races right by. — **rabbit**
4. Reba wraps it in a ribbon. — **ribbon**
5. Rain! They run for the roof. — **rain**
6. Reba the robot: ready, ready! — **ready**

**Ruby the Rooster** — R (public/library.html:964). Cover: "Ruby the Rooster! A story full of R sounds."

1. Ruby the rooster rises at dawn. — **Ruby**
2. Ruby crows: rise and shine! — **rise**
3. She runs around the red barn. — **red**
4. Ruby finds a wriggly worm. — **Ruby**
5. The rooster pecks rows of corn. — **rows**
6. Ruby rests. What a great run! — **run**

**Remy the Raccoon** — R (public/library.html:972). Cover: "Remy the Raccoon! A story full of R sounds."

1. Remy the raccoon roams the river. — **raccoon**
2. He reaches under a round rock. — **rock**
3. Remy grabs a ripe, red grape. — **red**
4. He rows a raft in the rain. — **rain**
5. Remy rests in the reeds. — **reeds**
6. Remy the raccoon: hooray! — **Remy**

**Rex the Rhino** — R (public/library.html:980). Cover: "Rex the Rhino! A story full of R sounds."

1. Rex the rhino runs really fast. — **rhino**
2. He roars down the rocky road. — **road**
3. Rex rolls in the rich, green grass. — **rolls**
4. He reaches for a red apple. — **red**
5. Rex meets a friendly rabbit. — **rabbit**
6. Run, Rex, run! Hooray! — **run**

**Sunny the Seal** — S (public/library.html:988). Cover: "Sunny the Seal! A story full of S sounds."

1. Sunny the seal sits in the sun. — **seal**
2. Sunny sees a silly snake. — **silly**
3. The snake slides on the soft sand. — **sand**
4. They sip soup with a silver spoon. — **soup**
5. Sunny sings a silly song. — **song**
6. So sleepy! Sunny says goodnight. — **Sunny**

**Lily the Lion** — L (public/library.html:996). Cover: "Lily the Lion! A story full of L sounds."

1. Lily the lion licks a lemon lollipop. — **lion**
2. Lily leaps over a little log. — **log**
3. A ladybug lands on a leaf. — **leaf**
4. Lily laughs: la la la! — **laughs**
5. They look at a yellow balloon. — **look**
6. Lily loves to play all day. — **Lily**

**Kiki the Koala** — K (public/library.html:1004). Cover: "Kiki the Koala! A story full of K sounds."

1. Kiki the koala bakes a cake. — **cake**
2. A kind king comes with a key. — **king**
3. The king flies a colorful kite. — **kite**
4. Kiki gives the king a cookie. — **cookie**
5. A cat and a cow come to play. — **cow**
6. What a cool day for Kiki! — **Kiki**

**Shelly the Sheep** — SH (public/library.html:1012). Cover: "Shelly the Sheep! A story full of SH sounds."

1. Shelly the sheep shines her shoes. — **sheep**
2. She shows a shiny shell to a fish. — **shell**
3. They sail on a big ship. Shhh! — **ship**
4. Shelly makes a wish on a star. — **Shelly**
5. She sips a milkshake — so fresh. — **she**
6. Shhh… Shelly is sleeping now. — **Shelly**

**Charlie the Chick** — CH (public/library.html:1020). Cover: "Charlie the Chick! A story full of CH sounds."

1. Charlie the chick chews chewy cherries. — **chick**
2. Charlie rides the choo-choo train. — **Charlie**
3. He munches cheese at lunch. — **cheese**
4. A chipmunk sits on a chair. — **chair**
5. They share chocolate chips. Crunch! — **chips**
6. Charlie chirps: cheep, cheep, cheep. — **cheep**

**Theo the Sloth** — TH (public/library.html:1028). Cover: "Theo the Sloth! A story full of TH sounds."

1. Theo the sloth thinks happy thoughts. — **thinks**
2. Theo counts: one, two, three! — **Theo**
3. He gives a big thumbs up. — **thumbs**
4. Theo brushes his three teeth. — **Theo**
5. Then a warm bath — both feet in. — **bath**
6. Thank you, moon. Theo says goodnight. — **thank**

**Gus the Goat** — G (public/library.html:1036). Cover: "Gus the Goat! A story full of G sounds."

1. Gus the goat grows a green garden. — **goat**
2. A goose gives Gus a gift. — **goose**
3. Gus plays a goofy guitar. — **guitar**
4. They gobble grapes by the gate. — **gate**
5. A bug giggles on the grass. — **giggles**
6. Good game, Gus. Goodnight! — **Gus**

**Fifi the Fox** — F (public/library.html:1044). Cover: "Fifi the Fox! A story full of F sounds."

1. Fifi the fox finds four feathers. — **fox**
2. Fifi feeds a funny fish. — **fish**
3. They warm five feet by the fire. — **fire**
4. A butterfly flies fast — wow! — **fast**
5. Fifi has fun with her friends. — **fun**
6. Fifi waves: farewell, farewell! — **Fifi**

---

## Part D — The word bank

Every practice word, by sound and by where the sound sits in the word (public/sona.js:1880).
**Best left to TTS in the cloned voice** — words render fine; only bare sounds do
not. Listed so nothing is hidden, and because a word can reach the child three ways:
the word rung and the sentence rung of a practice round (both at the practice position:
homework's, else Settings', Beginning by default; any word an SLP's homework names), and Feed Echo
(the shortest eight Beginning words with a picture).

**P (18)** — Beginning (7): pig, pizza, pen, paint, pumpkin, pie, pan · Middle (5): apple, puppy, happy, zipper, paper · End (6): cup, map, soap, sheep, rope, top

**B (18)** — Beginning (8): ball, banana, bear, bus, bed, book, bee, boat · Middle (5): baby, rabbit, ribbon, robot, table · End (5): crab, web, tub, cob, cab

**M (18)** — Beginning (7): moon, mouse, milk, mom, monkey, mountain, mug · Middle (5): hammer, camel, lemon, tomato, drummer · End (6): drum, gum, ham, broom, arm, jam

**N (18)** — Beginning (7): nose, nest, net, nut, noodle, nail, nine · Middle (5): banana, peanut, panda, dinner, tennis · End (6): sun, can, train, pin, bone, lion

**T (19)** — Beginning (8): top, toe, tiger, tooth, toy, ten, turtle, table · Middle (5): water, guitar, potato, button, letter · End (6): cat, hat, boat, gate, kite, foot

**D (19)** — Beginning (8): dog, duck, door, doll, deer, dinosaur, desk, dad · Middle (5): ladder, spider, radio, medal, soda · End (6): bed, road, cloud, hand, food, salad

**K (18)** — Beginning (7): cat, key, cake, kite, king, cow, cookie · Middle (5): monkey, bucket, pumpkin, jacket, rocket · End (6): book, duck, sock, truck, cake, milk

**G (19)** — Beginning (7): goat, girl, gift, game, guitar, goose, gate · Middle (5): wagon, tiger, dragon, magnet, finger · End (7): dog, frog, pig, bug, egg, bag, leg

**F (18)** — Beginning (7): fish, fox, fan, fire, foot, fork, farm · Middle (5): elephant, telephone, muffin, sofa, coffee · End (6): leaf, knife, wolf, roof, scarf, giraffe

**V (18)** — Beginning (7): van, violin, vase, vest, volcano, vegetable, video · Middle (5): river, oven, seven, gloves, driver · End (6): five, cave, glove, wave, dove, stove

**S (24)** — Beginning (7): sun, soap, sock, soup, seal, sandwich, sand · Middle (4): pencil, bicycle, dinosaur, castle · End (6): bus, house, glass, dress, ice, mouse · Blends (7): star, spoon, snake, school, smile, spider, stop

**Z (16)** — Beginning (6): zebra, zoo, zipper, zero, zigzag, zip · Middle (5): lizard, puzzle, dizzy, scissors, bulldozer · End (5): nose, rose, cheese, hose, bees

**SH (17)** — Beginning (7): shoe, ship, shark, sheep, shell, shirt, shower · Middle (4): ocean, dishes, washing, tissue · End (6): fish, brush, dish, wash, leash, trash

**CH (16)** — Beginning (6): cheese, chair, cherry, chicken, chocolate, chips · Middle (4): teacher, kitchen, sandwich, ketchup · End (6): beach, peach, watch, lunch, branch, couch

**J (17)** — Beginning (7): jam, juice, jet, jeep, jar, jacket, giraffe · Middle (5): magic, pajamas, engine, pigeon, angel · End (5): cage, page, bridge, orange, badge

**L (25)** — Beginning (7): lion, leaf, lemon, ladder, lamp, lollipop, lock · Middle (5): balloon, yellow, pillow, koala, color · End (6): ball, bell, owl, snail, whale, doll · Blends (7): clock, flag, glove, plate, sled, blocks, plane

**R (33)** — Beginning (7): rabbit, rocket, ring, rain, robot, rose, rock · Middle (5): carrot, arrow, parrot, kangaroo, zero · End (5): car, star, door, four, bear · Vocalic R (9): bird, girl, shark, fork, corn, chair, ear, water, tiger · Blends (7): tree, frog, drum, crab, grapes, train, dragon

**TH (as in 'thumb') (15)** — Beginning (6): thumb, three, thread, think, thirty, thorn · Middle (3): toothbrush, birthday, bathtub · End (6): bath, tooth, mouth, math, moth, teeth

**TH (voiced, as in 'the') (10)** — Middle (6): mother, father, brother, feather, weather, leather · End (4): bathe, smooth, teethe, breathe

356 entries, 294 distinct words (a word can sit in more than one sound's list).

---

## Part E — Do not record yet: parked, unlinked and dead lines

Listed so nothing is hidden. **Parked** = the page exists but no page links to it
(reachable only by a typed URL) or it shows "coming soon". **Unlinked** = same, for a
page that was never in the app's flow. **Dead** = code that nothing calls. None of
these reach a child today; if one comes back, its lines move up into B or C.

### E1 — Today's chapter (`chapter.html`, parked): 30 chapters, 210 spoken pages

The chapter reader was parked on 19 Sep 2026 and stayed parked when the picture books came back (C9); `tests/day1.mjs` pins that Home has no door to it. When the page opens, each page is read aloud as it turns — the chapter's opening line, then its six beats (public/chapter.html:124, public/chapter.html:174); "Read it to me" says the same page again (public/chapter.html:203). Tomorrow's hook is shown on the finish card, not spoken. The table is `EPISODES` (public/sona.js:1021). Read as a bedtime story if they ever come back: slower than the prompts, the last line of each page landing softly.

One fixed line: "You did it! Three games are unlocked." — the finish card (public/chapter.html:196). Still has its "!" — the parked pages never got the calm rewrite.

**Chapter 1 — The Star That Fell** (public/sona.js:1022)

1. You are in the meadow when the sky drops something. It lands in the tall grass with a soft whump. The grass around it starts to glow.
2. It is a star. A small one, about the size of your two hands together. It is shaking.
3. Echo lands beside it and says hello. The star does not answer. Stars do not know words yet.
4. But when you speak, the star brightens. It has never heard a voice before. It likes yours.
5. The more you say, the warmer it gets. Warm stars can float. Cold ones cannot.
6. It lifts off the grass. Just a little. Just enough to show you it wants to go home.
7. Home is a very long way up. Echo looks at the sky, then at you. This is going to take a while.

**Chapter 2 — The Bramble Path** (public/sona.js:1034)

1. The only way out of the meadow is one narrow path. Overnight, the brambles have grown all the way across it.
2. Thorns as long as your finger. Echo tries to squeeze through and comes back with one feather missing.
3. The star floats up to look. From above, the path is a green tangle with no gap anywhere in it.
4. Then the star does something new. It hums one low note, and a single bramble curls away from the sound.
5. So you help. Every sound you make bends another branch back, and a gap opens up in the green.
6. You go through in a line. Echo first, then you, then the star bobbing along behind.
7. On the other side there is a noise like a hundred spoons in a hundred cups. Water. A lot of water.

**Chapter 3 — The River Crossing** (public/sona.js:1046)

1. The river is wide, loud, and moving fast. There is no bridge. There is no boat. There is just you.
2. The star floats out over the water to have a look, and the wind pushes it straight back to you.
3. Echo spots something under the surface. Flat stones, one after another, like a path somebody hid on purpose.
4. They are too deep to stand on. But when you speak, the nearest one rises up out of the water.
5. One stone at a time. A sound, a stone, a step. A sound, a stone, a step.
6. Halfway across, a fish comes up beside you and just listens. Then another one. Then eleven more.
7. You reach the far bank with wet shoes and a small crowd of fish watching you go.

**Chapter 4 — The Whispering Woods** (public/sona.js:1058)

1. The trees here are old and standing close together. Say one word and the woods say it back to you, twice.
2. Echo goes absolutely wild. A parrot in a place that repeats things is a parrot in heaven.
3. The star hides in your pocket. It is not used to hearing itself yet.
4. You try a sound. The woods answer. You try another one. The woods answer that one too.
5. Then a third voice joins in. Small, wobbly, half a beat behind. That one is not a tree.
6. Something is following you and copying you. Echo stops laughing and steps in front of you.
7. It comes out of the ferns. It is about the size of a teacup, and it is extremely fluffy.

**Chapter 5 — Pip** (public/sona.js:1070)

1. It is a baby owl. It has one feather sticking straight up off its head, and it will not stop staring at you.
2. Echo asks its name. The owl copies the question back instead of answering it. It is learning too.
3. You make a sound. The owl tries the same one. It comes out sideways, but it comes out.
4. You make it again. This time the owl lands much closer to it, and its one feather quivers with the effort.
5. You share your snack. The owl decides you are family now and climbs into your hood.
6. Echo names it Pip, on the grounds that it makes a sound like pip whenever it is pleased.
7. Pip points a wing at the hills. There is a black opening in the rock, and the path goes straight into it.

**Chapter 6 — The Cave of Echoes** (public/sona.js:1082)

1. Inside the cave it is black. Not dim. Black. You cannot see your own hands in front of you.
2. Then Pip makes one small nervous pip, and a ring of blue light spreads across the ceiling.
3. The rock in here answers sound with light. Every noise you make lights up the part of the wall it touches.
4. So you talk your way in. The cave glows ahead of you, one patch at a time, like stepping stones made of light.
5. The star sits on your shoulder and hums along. Between the two of you, it is almost bright.
6. The light reaches a wall that is not rock. It is flat, and somebody has drawn on it.
7. Hundreds of drawings. And in every single one, somebody is holding a star.

**Chapter 7 — The Drawings** (public/sona.js:1094)

1. The drawings go on for further than you can walk in one go. They tell a story, left to right, like a very long comic.
2. First panel: a person in a meadow, and a star falling out of the sky. That one looks familiar.
3. Then a river. Then woods. Then a cave, with a small round shape riding on somebody's shoulder.
4. Pip looks at the shoulder shape, then down at itself, then back at the shoulder shape.
5. The last panel is a ladder. It starts on the ground and it goes up and up into the clouds.
6. There is no drawing of what happens after the ladder. Whoever drew all this never came back to finish it.
7. Echo is very quiet, which for a parrot is unusual. Then Echo says: well. We had better go and look.

**Chapter 8 — The Cloud Ladder** (public/sona.js:1106)

1. The ladder is exactly where the drawing said it would be. Rungs of white cloud, going up and up until they are too small to see.
2. Echo tests the bottom rung with one foot. It goes straight through it. Cloud is cloud.
3. Then the star drifts down and rests on the rung, and the cloud puffs solid, like bread rising.
4. Warmth is what makes cloud firm. And your voice is what keeps the star warm.
5. So you climb and you talk. Rung, sound, rung, sound. The meadow shrinks to a green thumbprint underneath you.
6. Pip refuses to fly and rides in your hood the whole way, which is somehow more tiring for you than for Pip.
7. Near the top the air changes. It is moving. It is moving very fast.

**Chapter 9 — The Windy Ridge** (public/sona.js:1118)

1. The top of the ladder comes out on a thin ridge of cloud, and the wind up here does not stop for a second.
2. It pulls at your sleeves. It pulls at Echo's tail. It pulls sounds right out of the air and carries them off sideways.
3. The star dims. Up here it is losing warmth faster than you can give it back.
4. So you tuck it inside your coat, against you, where the wind cannot get at it.
5. It works. You can feel it glowing through the fabric, steady as a heartbeat.
6. Pip flies ahead to scout, gets blown backwards past your head, and returns to the hood without comment.
7. Through the blur you see it. Something enormous standing out in the open sky, and the wind is going around it.

**Chapter 10 — The Sky Door** (public/sona.js:1130)

1. It is a door. It is taller than a tree and it is standing in the open air with nothing holding it up.
2. No handle. No lock. No keyhole. Carved in the middle of it, at exactly your height, there is an ear.
3. Echo knocks. Nothing. Pip pips at it. Nothing. The star bumps into it and slides slowly down.
4. So you lean close to the carved ear, and you say something to it.
5. The door listens. That is the whole trick. It has been waiting a very long time for somebody to talk to it.
6. It swings open onto the night sky, closer than you have ever seen it, every star the size of a lamp.
7. Your star leaps out of your coat and races for a gap in the pattern. And that is when you see the other gaps.

**Chapter 11 — The Star Comes Back** (public/sona.js:1146)

1. Your star is home. It sits in its gap in the sky, blazing away, exactly the right shape for the space it left.
2. You are about to go when it pops straight back out of the gap and lands on your shoulder.
3. Echo says that is not how going home works. The star does not appear to care.
4. Then you look properly at the sky, and you understand why it came back.
5. There are gaps everywhere. Dark shapes where stars should be. You count them twice to be sure.
6. Eleven. Eleven stars that fell somewhere and never got back up.
7. Pip is already looking down through the open door. Somewhere under all that cloud, eleven lights are waiting.

**Chapter 12 — The Lantern City** (public/sona.js:1158)

1. You come down out of the clouds over a city made of lanterns. Thousands of them, strung between the rooftops, glowing orange.
2. It is night here, but nobody has noticed. In a city of lanterns, night is just when the lights look nicer.
3. Echo asks a pigeon for directions. The pigeon is not helpful. Pigeons rarely are.
4. Then Pip pips once, and the two of you see it at the same time.
5. One lantern in the middle of the city is far, far too bright. Nobody has thought to ask why.
6. It is up at the very top of the tallest post, above all the washing lines and the cats.
7. So you start to climb. Twelve floors of ladders and roof tiles, and the light gets whiter the higher you go.

**Chapter 13 — The Longest Night** (public/sona.js:1170)

1. At the top of the post, inside a glass lantern the size of a bathtub, a star is sitting with its arms around its knees.
2. It has been in there so long that it thinks the lantern is the sky.
3. The glass is warm. When you speak near it, the star turns its head.
4. It will not come out. Everything out there is dark and everything in here is bright, and it is not moving.
5. So you sit down on the roof tiles and you talk to it. Not to make it do anything. Just so it is not on its own.
6. The glass cools. The star stands up. It comes over to the little door in the side and looks out at you.
7. As it steps out, every lantern in the city dims by exactly the same amount, and for the first time in years the people below look up.

**Chapter 14 — Under the Ice** (public/sona.js:1182)

1. A frozen lake, flat and grey and bigger than the city was. Under your boots you can hear the ice creak.
2. Something down there is glowing green through the ice, about the size of a dinner plate.
3. It is not green. It is a star, and the ice is what is making it look that way.
4. Echo taps the surface with one claw. The ice is thicker than Echo is tall.
5. But your two stars are warm. You lie flat and hold them against the surface, and the ice begins to give.
6. A hole opens, no bigger than a plate. The green light comes up through it and turns gold in the air.
7. Three stars now. Pip's hood is getting crowded, and Pip is very clear about it.

**Chapter 15 — The Music Box** (public/sona.js:1194)

1. The house has been empty a long time. The attic ladder comes down when you pull it, and dust falls on all three of you.
2. In the corner, under a sheet, something is playing. Six notes, over and over, very slowly.
3. It is a music box. The lid is shut, and the little brass key on the back is turning all by itself.
4. Echo lands on the lid and gets carried around in a slow circle, which Echo finds undignified.
5. You lift the lid. Inside, where the dancer should be, there is a star going round and round.
6. It has been keeping time in here for years. Nobody ever told it how to stop.
7. So you learn the six notes and say them back, and on the last one the star steps off the spindle and into your hand.

**Chapter 16 — The Orchard** (public/sona.js:1206)

1. Rows and rows of trees, all the same height, all quiet. Somewhere in the middle, one branch is bent almost to the ground.
2. On the end of it hangs a fruit the size of your head, and it is glowing faintly through the skin.
3. Echo tries to eat it. Echo is stopped.
4. You cut it down carefully. It is warm in your hands, and heavier than a fruit has any business being.
5. Inside there is a star, curled up, fast asleep. It fell in the spring and the tree simply grew around it.
6. You wake it the polite way, which is with your voice and not with your hands.
7. The branch springs straight the moment the fruit leaves it, and every other tree in the row shivers once, in order, all the way down.

**Chapter 17 — The Ferry** (public/sona.js:1218)

1. The road ends at the sea. There is a jetty, and a boat, and a very large creature asleep across the whole of it.
2. It has whiskers like broom handles and it is snoring in a way that moves the water.
3. Echo suggests going around. There is no around. There is sea in both directions as far as anybody can see.
4. Pip lands on its nose. One eye opens. The eye is the size of a dinner plate and it looks straight at you.
5. It is the ferry. It has been the ferry for a very long time, and nobody has asked it for a ride in years.
6. You share what is left of your food, and you tell it where you are going and why.
7. It slides off the jetty without a word and floats there, waiting, with its back flat like a raft.

**Chapter 18 — The Deep** (public/sona.js:1230)

1. Out where the water goes from green to black, the ferry stops and points its nose straight down.
2. Far below, so far it might be your eyes making it up, there is one small light.
3. You cannot swim that deep. Nobody can. But your four stars can, and they will not go without you.
4. So they make a bubble. Four stars in a ring, warm air between them, and you inside it, going down.
5. Kelp closes over the top. Fish you have no names for come to look at you, and then leave again.
6. The light gets bigger. It is shut inside a shell the size of a door.
7. You say something to the shell, the way you did to the sky door, and it opens without any fuss at all.

**Chapter 19 — The Nest** (public/sona.js:1242)

1. On the cliffs above the beach there is a nest, and the nest is glittering.
2. Bottle caps. Spoons. A watch. A doorknob. And near the middle, two lights that are none of those things.
3. Pip goes completely still, the way small birds do when a big bird is somewhere close.
4. It lands behind you. It is black and enormous and its head tilts all the way over to look at you.
5. It is not angry. It just likes bright things, and two of the brightest things it ever found were lying in a field.
6. So you trade. You give it the shiniest thing you are carrying, which is the little brass key off the back of the music box.
7. It takes the key, and it lets you take the two stars, and it watches you the whole way down the cliff path.

**Chapter 20 — The Loose Thread** (public/sona.js:1254)

1. Seven stars now. They ride in a loose cloud around your head, and you have stopped being able to count them without help.
2. You are walking back towards the cloud ladder when Echo stops dead in the air.
3. Hanging down out of the sky, swaying, there is a single silver thread. It goes up further than you can see.
4. You touch it. It hums the same six notes as the music box, and every star you are carrying hums back.
5. Echo says the thing you are both thinking. The sky is not a picture. The sky is something somebody made.
6. And somewhere up there a thread has come loose, and the stars have been slipping through the gap it left.
7. The thread twitches once, all on its own, as though something at the far end of it just noticed you holding on.

**Chapter 21 — Following the Thread** (public/sona.js:1270)

1. You wrap the thread around your hand and it lifts, gently, the way a kite pulls just before it goes.
2. The ground drops away. The orchard, then the lake, then the lantern city, all of it going small underneath you.
3. Pip flies alongside for the first time in the whole journey, which Pip would like noted.
4. The stars come too, in a long line behind you, like beads on a string.
5. Above the clouds the thread stops being silver and starts being light, and it is warm to hold.
6. You go up through the place where the sky door was and out the other side, and there is no other side. There is just more sky.
7. The thread ends at a stair. A spiral stair with no building around it, going up into the dark.

**Chapter 22 — The Weaver's Stair** (public/sona.js:1282)

1. The stair is made of the same silver as the thread, and every step gives a little under your weight, like rope.
2. There is no rail. There is nothing to fall onto either, which Echo points out and immediately regrets pointing out.
3. You climb. The stars go on ahead and light three steps at a time.
4. Halfway up, you pass a step with a bird's nest on it. Old, empty, and very carefully made.
5. Pip looks at that nest for a long moment and does not say anything at all.
6. The stair narrows near the top, until it is one step wide and you are going up it sideways.
7. Then the dark opens out, and there is a room, and in the room there is a loom the size of a house.

**Chapter 23 — The Weaver** (public/sona.js:1294)

1. She is very old and very small, and she is sitting at the loom with her hands in her lap, not weaving.
2. The cloth on the loom is the night sky. You are seeing it from underneath, which nobody has ever done.
3. She says hello without turning around. She says she wondered when somebody would come.
4. Echo, for once, has nothing to say. Pip climbs out of your hood and sits on the arm of her chair.
5. There is a gap in the weave the size of a door. Around it, threads hang loose in every direction.
6. She has not stopped because she is tired, although she is. She has stopped because she cannot do it on her own any more.
7. You put your seven stars down on the floor of the room, and the whole place fills up with light.

**Chapter 24 — What the Loom Needs** (public/sona.js:1306)

1. She picks up the shuttle and holds it out to you. It is wooden, worn smooth, and lighter than it looks.
2. She says the loom does not run on hands. It never has.
3. She sings one note, and a thread pulls itself across the frame and lies down flat.
4. That is why the stars go warm when you talk to them. That is why the door opened. That is why the cave lit up.
5. The whole sky is woven out of sound, and it has been quiet up here for a very long time.
6. Her voice went a while ago. That is the night the thread came loose, and every night since has been a little darker.
7. She puts the shuttle into your hand and closes your fingers around it, and she does not say anything else.

**Chapter 25 — The Eighth Star** (public/sona.js:1318)

1. You find the eighth star before you work out how to weave. It is tangled in the loose threads at the edge of the gap.
2. It has been stuck there since the night it slipped, holding on so it would not fall like the others.
3. The threads have grown right around it, the way the orchard tree grew around its fruit.
4. You work it free one strand at a time while it hums the six notes at you, over and over, nervously.
5. When it comes loose it does not fly off. It stays exactly where it is, because it is already in its own place.
6. One star back in the sky, and the smallest patch of the dark shape closes up around it.
7. The Weaver laughs, which is a sound like a door that has not been opened in years.

**Chapter 26 — The Unravelling** (public/sona.js:1330)

1. You wake up to a sound like a zip. Along the far edge of the loom, the weave is coming apart on its own.
2. Threads are letting go one after another, faster than anybody could tie them back.
3. Through the widening gap you can see the ground, extremely far away, and none of it is cloud.
4. Echo goes one way and Pip goes the other and you go straight down the middle, catching threads.
5. You get six of them in one fist and it is nowhere near enough. There are hundreds.
6. Then the Weaver says your name, and tells you to stop grabbing and start talking.
7. So you do. And the threads you speak to stop moving, and hang still, and wait.

**Chapter 27 — The Two in the Dark** (public/sona.js:1342)

1. There is a corner of the sky where three stars fell on the same night, and nothing has ever been put back.
2. It is the darkest place you have ever stood. Darker than the cave, because in the cave there was rock to touch.
3. Your stars will not go in. They hang at the edge of it, dimming, like a hand held over a candle.
4. So you go in without them, with Pip on your shoulder and Echo somewhere just above your head.
5. You find the first one by sound. It has been humming the whole time, very quietly, for a very long while.
6. The second one is holding on to the first one and will not let go, so you carry the pair of them together.
7. Coming out, you count. Two in your arms. One still missing. And no corner of the world left that you have not looked in.

**Chapter 28 — The Last One** (public/sona.js:1354)

1. You look everywhere for the eleventh star. The Weaver studies the sky from underneath. Echo asks every bird between here and the sea.
2. Nothing. Ten found, one gap left, and not one single idea between the four of you.
3. Then Pip flies off without telling anybody, which Pip has never once done, and is gone until morning.
4. Pip comes back with a single blade of grass in its beak. Long, green, and slightly scorched at the tip.
5. You know that grass. You have sat in that grass. It is the meadow, from the very first night.
6. The last star never went anywhere at all. It landed where the first one landed, on the same night, and it has been under the grass ever since, waiting for somebody to come back for it.
7. It is small and it is cold, and when you pick it up it fits in one hand, exactly the way the first one did.

**Chapter 29 — The Long Way Back Up** (public/sona.js:1366)

1. Ten stars. You have ten stars and one spiral stair, and the stair is one step wide at the top.
2. Echo carries two, badly. Pip carries one and will not be talked out of it.
3. The rest go in your coat, in your hood, and in both hands, and you go up sideways the way you did before.
4. Halfway, at the step with the old nest on it, you stop to rest and count them all again.
5. Pip puts its star down in the nest for a moment, just to see how it looks. It looks very good.
6. Then Pip picks it up again, because it is not Pip's star, and there is a sky waiting for it.
7. At the top, the Weaver has the loom open and the shuttle ready. She has been up all night clearing the frame.

**Chapter 30 — The Sky, Mended** (public/sona.js:1378)

1. The gap in the weave is the size of a door, and there are ten stars sitting on the floor of the room waiting to go through it.
2. The Weaver cannot sing it shut. You already knew that. It is the reason you are the one holding the shuttle.
3. So you say the first thing that comes into your head, and a thread lies itself flat across the frame.
4. Then another. Then another. It is slow, and it is not neat, and it holds.
5. One at a time the stars step up into the weave and find their gaps, and one at a time the dark shapes close.
6. The last one is the star from the meadow. It waits until the very end. Then it goes up, and the sky is whole.
7. From underneath, the new patch does not match. It is brighter than the rest, and rougher, and the Weaver says that is how everybody will know that somebody mended it.

### E2 — Your Adventure (`story.html`, parked)

No page opens it: the Books page keeps its tile hidden (public/library.html:237), and it is gated behind `Sona.gated('story')`. Each page is read aloud when it opens (public/story.html:245) and on "Hear it" (public/story.html:300); then "Now you! Say... {word}!" (public/story.html:247); a heard try gets one of the five praise lines (public/story.html:271); a missed one gets the bare word again (public/story.html:280). The pages are normally an AI-written story from `/api/story` — unbounded text that cannot be pre-recorded. The fallback pages are 5 frames with a bank word (public/gamecontent.js:83): "Once, Echo saw a ___.", "He really liked the ___.", "Then came a big ___.", "Echo and the ___ played all day.", "What a fun ___!".

### E3 — Books: no longer parked

The picture books are live again; their lines are in B6 and C9. The number is kept so
the sections after it keep theirs.

### E4 — `simple-play.js`: nothing parked

Every page built on this script is live (C10) or has moved to another script.

### E5 — Speech Check (`check.html`, unlinked)

The ad-funnel page; nothing in the app links to it. "Say: {word}" for each of 9 words in this order (public/check.html:196): cat, goat, fish, lion, shoe, cheese, sun, rabbit, thumb. It sends no voice id, so it always uses the default voice.

### E6 — Coach Call (`coach-call.html`, parked): 43 lines

No page links to it and without `?dev=1` it shows "Coming soon". Its lines still carry
the old register — "Go!", CAPITALS, and [excited] / [whispers] / [happy] tags that are
sent to the voice as text — and three asks read "your very best your R sound"
because the sound phrase already starts with "your". Listed for completeness; skip
unless the feature is revived, and then rewrite first. Blanks: {name} the child's
name (default "friend"), {buddy} the buddy character (default "Pip"), {letter} the
sound's label, {cue} the C1 cue, {word1}/{word2} the first two ladder words, {praise}
one of the five praise lines.

| Line | Where | When |
|---|---|---|
| [excited] Well HI, {name}! I'm Echo! I've been waiting ALL day to meet you! | public/coach-call.html:290 | opener |
| [excited] Well HI, {name}! I was hoping you would call me all day! | public/coach-call.html:291 | opener |
| [excited] {name}! There you are! I told {buddy} how amazing your {letter} sound was last time — he almost didn't believe me! | public/coach-call.html:293 | opener |
| [excited] Back already?! Best part of my day. I think your {letter} sound got stronger overnight! | public/coach-call.html:294 | opener |
| [excited] {name}! I missed you! I kept your spot on my branch warm. | public/coach-call.html:295 | opener |
| First, a big dragon breath. [whispers] Breathe in… and blow it out. One more big one… [happy] Wonderful! | public/coach-call.html:298 | warmups |
| Warm-up time! Wiggle your lips — blblblbl! Now a big lion yawn… aaah. [happy] Perfect. Your mouth is awake! | public/coach-call.html:299 | warmups |
| Quick! Drumroll on your knees… faster… and FREEZE. [whispers] Wow, you're so focused today. | public/coach-call.html:300 | warmups |
| [happy] This was my favorite call ALL day. Practice in the games, and call me again soon. Bye bye, superstar! | public/coach-call.html:303 | byes |
| [happy] {buddy} says thank you for the lesson! Same branch, next call? Bye bye, {name}! | public/coach-call.html:304 | byes |
| [happy] Case closed, detective {name}! Go play the games — I'll be listening for that famous {letter} sound. Bye bye! | public/coach-call.html:305 | byes |
| {buddy} is on the call too! [whispers] Psst — {buddy} keeps getting the {letter} sound wrong. Can you teach him? | public/coach-call.html:308 | Echo says |
| Show {buddy} your very best your {letter} sound, three times. Teach him. Go! | public/coach-call.html:309 | ask |
| [excited] LOOK! {buddy} just said it! You TAUGHT him, {name}! You're a {letter} teacher now! | public/coach-call.html:310 | if the try passed |
| Almost! {buddy} is watching your mouth. {cue} — go again! | public/coach-call.html:310 | if the try missed |
| Word time! Say {word1}, three times. Go! | public/coach-call.html:313 | ask |
| That was a PERFECT {word1}! | public/coach-call.html:314 | if the try passed |
| So close! Break it in half with me — {word1}. Again, go! | public/coach-call.html:314 | if the try missed |
| One more word. Say {word2}, three times. Go! | public/coach-call.html:315 | ask |
| You are on FIRE today! | public/coach-call.html:316 | if the try passed |
| Good trying! That one's tricky — we'll practice it in the games too. | public/coach-call.html:316 | if the try missed |
| Last one. Show me how BIG-KID {name} says it — one giant your {letter} sound. GO! | public/coach-call.html:318 | ask |
| THERE it is! That's the big-kid sound right there! | public/coach-call.html:319 | if the try passed |
| I heard it in there! It's getting stronger every single day. | public/coach-call.html:319 | if the try missed |
| Okay, {name}, listen to MY practice today: wuh… wuh… [curious] hmm. That is NOT the {letter} sound, is it? | public/coach-call.html:326 | Echo says |
| Fix me! Say the REAL your {letter} sound, three times, so I can copy you. Go! | public/coach-call.html:327 | ask |
| [laughs] THAT'S the one! No wonder you're the teacher around here. | public/coach-call.html:328 | if the try passed |
| Ooh, close! {cue}. Show me again — go! | public/coach-call.html:328 | if the try missed |
| Today we're sound detectives. [whispers] The mystery sound is… the {letter} sound! Here's my evidence: | public/coach-call.html:333 | Echo says |
| Case number one: say your {letter} sound three times so I know you're on the case. Go! | public/coach-call.html:334 | ask |
| [excited] Case CRACKED! You're the best detective I know. | public/coach-call.html:335 | if the try passed |
| Hmm, the clue slipped away! {cue} — go! | public/coach-call.html:335 | if the try missed |
| Clue word! Say {word1}, three times. Go! | public/coach-call.html:336 | ask |
| Another clue solved! | public/coach-call.html:337 | if the try passed |
| Tricky clue! We'll crack it in the games too. | public/coach-call.html:337 | if the try missed |
| Today is {letter} day! I have been practicing SO hard. Want to hear my try first? | public/coach-call.html:342 | Echo says |
| Now the real expert. Say your {letter} sound three times so I can hear how it's really done. Go! | public/coach-call.html:343 | ask |
| [excited] WOW. That was even better than I imagined! | public/coach-call.html:344 | if the try passed |
| Ooh, so close! {cue}. One more time — go! | public/coach-call.html:344 | if the try missed |
| I couldn't hear you that time — scoot a little closer and we'll keep going! | public/coach-call.html:363 | runStep |
| {praise} — one of the five praise lines (fallback "You got it!") | public/coach-call.html:370 | a retry passed, or the check could not tell |
| You know what? That try made {buddy} smile. We'll get it next call! | public/coach-call.html:371 | runStep |
| {praise} — one of the five praise lines (fallback "Nice one!") | public/coach-call.html:372 | a retry passed, or the check could not tell |

### E7 — Dead code: never spoken

- **The idle nudge** (public/charge.html:1865): would replay the prompt after 8 s of silence, up to twice. `armIdle()` is defined but never called; the not-heard path is the quiet screen (B4).
- **"You did it."** (public/charge.html:2281): fallback praise only if `praiseLine` were missing — `sona.js` always provides it.
- **"Let's try our {sound} sound again"** (public/charge.html:2249): fallback coaching only for a sound with no tip — all 19 have one.
- **"Listen to Echo, then copy the sound!"** (public/sona.js:3841): the default cue for an unknown sound; the practice page forces the sound to one of the 19.
- **`actionCue`, `repeatCue`, `coachLine`** (public/sona.js:4058, public/sona.js:4063, public/sona.js:4074): exported, no caller anywhere. Pre-calm wording — e.g. "Are you ready? Say rrrr 5 times!", "Repeat after me… rrrr!  Now you try — rrrr!", "Let's try again. Say rrrr! Pull your tongue back and up like a tiger growl — rrr!".
- **The conversation rung** (public/gamecontent.js:89): "Which do you like — a ___ or a ___?", "Do you want the ___ or the ___?", "Pick one — ___ or ___!", "Hmm… a ___ or a ___?" — the practice page keeps only items with a target (`it.t`) and these have none, so a conversation round falls back to the bare sound.
- **The sound models as text** (public/sona.js:3909): puh, buh, mmm, nnn, tuh, duh, kuh, guh, ffff, vvvv, sss, zzz, shhh, chuh, juh, lll, rrrr, thhh, thuh — shown on screen, never sent to TTS, because a synthesized "rrrr" comes out mangled. The performed sound is Rachel's clip (Part A).

### E8 — Shown on screen, never spoken (so nobody records them by mistake)

The mic primer ("Let Echo hear you practice!"), the "That's okay!" decline card, the
mic-denied screen ("Echo can't hear you yet!"), the grown-up variant of the quiet
screen ("Let's get a grown-up" / "Another app may be using the microphone"), the
"Adventure complete!" / "See you next time!" cards, the chest captions ("A treasure
chest! Tap, tap, tap to open!", "Tap, tap!", "One more tap!", "You found the {sticker}
sticker!"), the in-round labels ("Say", "Almost! {cue} —", "Try again — you've got
this!", "Echo's idea — say", "YES! That's the one!", "Here we go!", "Say it {n}
times", "Just 1 more!", "Tap Echo to hear it again", "Your turn", "Listen to Echo"),
the round games' "Say “rrrr” to keep playing!" card title (Echo also says what it
asks: B5, C7) and their end cards, the picture games' cheers, the books' "Can you
say {word}?" bubble, "Your turn!" and "I heard you!", and Feed Echo's
"Where's the {word}?" / "Say it out loud, then tap it!" / "Echo heard you!".

### E9 — Rows retired from the previous version of this sheet

The old sheet listed round prompts ("Are you ready?", "Your turn!", "Now you try!"),
navigation lines ("Hi! I'm Echo. Let's practice together!", "Read today's story to
unlock your games!", "Bye for now!") and extra praise ("You filled it up! Open your
chest!", "That's three days in a row!") under folders `public/coach/model/`,
`public/coach/praise/`, `public/coach/ui/`. The app never spoke any of them (two survive
only as dead helpers, E7, and two as on-screen text) and never loaded audio from those
folders; they were a wish-list. They are gone, and so is the old `tools/voicepage.mjs`.

---

**Totals.** Part A: 19 sound models (38 files, Rachel's). Part B: **608 fixed clips** to record. Part C: **80 template lines written out** (C1 38 + C2 38 + C7 4) plus 1009 fillers listed (19 cues, 19 sound names, 95 syllables, 5 sentence frames, 134 Feed Echo words, 4 game-card asks, 235 picture-game words, 498 book pages in 48 books). Part D: **356 bank entries, 294 distinct words** (TTS). Part E: 269 parked/unlinked lines not to record (210 chapter pages, 43 Coach Call, 9 Speech Check, the rest single lines).

Record B first (608 lines — an hour), then C1 and C2 (76 lines, where you perform the sound), and stop there: the rest of Part C and Part D are words, and words are what TTS already does well.
