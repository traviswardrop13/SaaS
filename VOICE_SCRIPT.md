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
  the voice does not jump. The fixed lines that still carry a "!": "I couldn't hear you! Say it big — I'm all ears!", "Go!", "Super Slice! Say", "Tap a lane to move side to side. Dodge the rocks and the cactus, and grab the gold coins!", "The end! Great listening!".
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

Switch state right now: `HUMAN_CLIPS = true` (public/sona.js:4857) — Rachel's recorded sounds (Part A) are ON: one take of the sound plays in the letter's place in the practice prompt (C1, C2, the turtle, B3) and after the games' "…say" lines (B5); every word below is spoken through TTS.

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
(public/charge.html:1016); `say-echo/<SOUND>-demo.mp3` is used only by the parked Coach Call.

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

Sources: models public/sona.js:3567 (`SOUND_SAY`, shown on the practice card and the games' keep-playing card, never sent to TTS); cues public/sona.js:3489 (`CUES`).

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
| B1 | praise-1.mp3 | Nice one. | After the easier target (the "I have an idea" line, B3/C5) passes — one of the five, picked at random. The only spoken praise in the live app, and the win line (B45) follows it; a normal pass gets only the win line. | Soft and pleased, a small smile in it. Not a cheer. | public/sona.js:3728; spoken at public/charge.html:2263 |
| B2 | praise-2.mp3 | Good job. | Same moment, random pick of five. | Soft and pleased, a small smile in it. Not a cheer. | public/sona.js:3728; spoken at public/charge.html:2263 |
| B3 | praise-3.mp3 | I heard that. | Same moment, random pick of five. | Soft and pleased, a small smile in it. Not a cheer. | public/sona.js:3728; spoken at public/charge.html:2263 |
| B4 | praise-4.mp3 | That was lovely. | Same moment, random pick of five. | Soft and pleased, a small smile in it. Not a cheer. | public/sona.js:3728; spoken at public/charge.html:2263 |
| B5 | praise-5.mp3 | Well done. | Same moment, random pick of five. | Soft and pleased, a small smile in it. Not a cheer. | public/sona.js:3728; spoken at public/charge.html:2263 |

### B2 — Coaching after a miss (19)

`Let's try that one again. {tip}.`, then "Go!" (B49) — the tip is Rachel's mouth cue cut at the dash (rule at public/charge.html:2231).

| # | File | Say this | When Echo says it | Delivery | Source |
|---|---|---|---|---|---|
| B6 | coach-P.mp3 | Let's try that one again. Press your lips and pop a little puff. | Once per round, when the on-device check heard a clearly different sound on P. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B7 | coach-B.mp3 | Let's try that one again. Lips together, turn your voice on. | Once per round, when the on-device check heard a clearly different sound on B. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B8 | coach-M.mp3 | Let's try that one again. Lips together and hum. | Once per round, when the on-device check heard a clearly different sound on M. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B9 | coach-N.mp3 | Let's try that one again. Tongue up behind your teeth and hum. | Once per round, when the on-device check heard a clearly different sound on N. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B10 | coach-T.mp3 | Let's try that one again. Tongue taps behind your top teeth. | Once per round, when the on-device check heard a clearly different sound on T. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B11 | coach-D.mp3 | Let's try that one again. Like T, but turn your voice on. | Once per round, when the on-device check heard a clearly different sound on D. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B12 | coach-K.mp3 | Let's try that one again. The back of your tongue pops up in the back. | Once per round, when the on-device check heard a clearly different sound on K. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B13 | coach-G.mp3 | Let's try that one again. Like K, but turn your voice on. | Once per round, when the on-device check heard a clearly different sound on G. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B14 | coach-F.mp3 | Let's try that one again. Top teeth on your bottom lip, blow soft. | Once per round, when the on-device check heard a clearly different sound on F. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B15 | coach-V.mp3 | Let's try that one again. Like F, but buzz your voice. | Once per round, when the on-device check heard a clearly different sound on V. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B16 | coach-S.mp3 | Let's try that one again. Teeth together, big smile, let the air hiss out. | Once per round, when the on-device check heard a clearly different sound on S. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B17 | coach-Z.mp3 | Let's try that one again. Teeth together and buzz like a bee. | Once per round, when the on-device check heard a clearly different sound on Z. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B18 | coach-SH.mp3 | Let's try that one again. Round your lips and whisper quiet. | Once per round, when the on-device check heard a clearly different sound on SH. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B19 | coach-CH.mp3 | Let's try that one again. Pop it like a little train. | Once per round, when the on-device check heard a clearly different sound on CH. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B20 | coach-J.mp3 | Let's try that one again. Like CH, but turn your voice on. | Once per round, when the on-device check heard a clearly different sound on J. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B21 | coach-L.mp3 | Let's try that one again. Tongue tip up behind your top teeth. | Once per round, when the on-device check heard a clearly different sound on L. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B22 | coach-R.mp3 | Let's try that one again. Pull your tongue back and up like a tiger growl. | Once per round, when the on-device check heard a clearly different sound on R. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B23 | coach-TH.mp3 | Let's try that one again. Peek your tongue between your teeth and blow soft. | Once per round, when the on-device check heard a clearly different sound on TH (as in 'thumb'). Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |
| B24 | coach-THV.mp3 | Let's try that one again. Tongue between your teeth and buzz. | Once per round, when the on-device check heard a clearly different sound on TH (voiced, as in 'the'). Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:2237 |

### B3 — Echo's idea, sound alone (19)

`I have an idea. Let's try this one. Make your {sound} sound.`, then "Go!" (B49) — the same line with a syllable or a word in it is a template (C5). Where the code spells the letter name ("S H", "C H", "T H"), say the sound name as a person would.

| # | File | Say this | When Echo says it | Delivery | Source |
|---|---|---|---|---|---|
| B25 | idea-P.mp3 | I have an idea. Let's try this one. Make your P sound. | After the retry ALSO missed on a syllable round of P: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B26 | idea-B.mp3 | I have an idea. Let's try this one. Make your B sound. | After the retry ALSO missed on a syllable round of B: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B27 | idea-M.mp3 | I have an idea. Let's try this one. Make your M sound. | After the retry ALSO missed on a syllable round of M: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B28 | idea-N.mp3 | I have an idea. Let's try this one. Make your N sound. | After the retry ALSO missed on a syllable round of N: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B29 | idea-T.mp3 | I have an idea. Let's try this one. Make your T sound. | After the retry ALSO missed on a syllable round of T: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B30 | idea-D.mp3 | I have an idea. Let's try this one. Make your D sound. | After the retry ALSO missed on a syllable round of D: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B31 | idea-K.mp3 | I have an idea. Let's try this one. Make your K sound. | After the retry ALSO missed on a syllable round of K: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B32 | idea-G.mp3 | I have an idea. Let's try this one. Make your G sound. | After the retry ALSO missed on a syllable round of G: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B33 | idea-F.mp3 | I have an idea. Let's try this one. Make your F sound. | After the retry ALSO missed on a syllable round of F: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B34 | idea-V.mp3 | I have an idea. Let's try this one. Make your V sound. | After the retry ALSO missed on a syllable round of V: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B35 | idea-S.mp3 | I have an idea. Let's try this one. Make your S sound. | After the retry ALSO missed on a syllable round of S: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B36 | idea-Z.mp3 | I have an idea. Let's try this one. Make your Z sound. | After the retry ALSO missed on a syllable round of Z: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B37 | idea-SH.mp3 | I have an idea. Let's try this one. Make your S H sound. | After the retry ALSO missed on a syllable round of SH: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B38 | idea-CH.mp3 | I have an idea. Let's try this one. Make your C H sound. | After the retry ALSO missed on a syllable round of CH: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B39 | idea-J.mp3 | I have an idea. Let's try this one. Make your J sound. | After the retry ALSO missed on a syllable round of J: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B40 | idea-L.mp3 | I have an idea. Let's try this one. Make your L sound. | After the retry ALSO missed on a syllable round of L: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B41 | idea-R.mp3 | I have an idea. Let's try this one. Make your R sound. | After the retry ALSO missed on a syllable round of R: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B42 | idea-TH.mp3 | I have an idea. Let's try this one. Make your T H sound. | After the retry ALSO missed on a syllable round of TH (as in 'thumb'): Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |
| B43 | idea-THV.mp3 | I have an idea. Let's try this one. Make your T H sound. | After the retry ALSO missed on a syllable round of TH (voiced, as in 'the'): Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2259 |

### B4 — Round end, win, chest, adventure end, quiet screen, "Go!" (6)

| # | File | Say this | When Echo says it | Delivery | Source |
|---|---|---|---|---|---|
| B44 | roundend.mp3 | Good practicing. Let's play. | Round end when the retry (and the easier target, if there was one) still came back as the wrong sound. The game opens anyway; the win line is NOT spoken in this case. | Warm and light. There is no disappointment in it — the child practised, and now they play. | public/charge.html:2267 |
| B45 | win.mp3 | You did it. Let's play. | The win: five tries heard and the last check passed. Spoken 600 ms after the win chime; the game loads 1.2 s later. | Quietly delighted. A full stop, not a fanfare. | public/charge.html:2406 |
| B46 | chest.mp3 | Look what we found. | The treasure chest at the end of the adventure: after the child's third tap opens it, 600 ms after the tap chime, while the sticker shows. | A small wonder, like peeking into a box together. | public/charge.html:2342 |
| B47 | adventure-end.mp3 | We finished the whole adventure. | Adventure end: when the fifth round's game hands back and the "Adventure complete!" card appears, 600 ms after its chime. | Proud and settled, winding down. | public/charge.html:2467 |
| B48 | quiet.mp3 | I couldn't hear you! Say it big — I'm all ears! | The quiet screen: a listening window ended with nothing heard. Mic already closed. Screen: "I couldn't hear you!" / "Say it big — I'm all ears!" with Try again / Maybe later. Tapping Try again reopens the mic without re-speaking the prompt. | Gentle and playful. This is the one line that kept its "!" on 24 Sep — "Say it big" is a production cue, so give it a little lift without shouting. Any rewording is Rachel's call. | public/charge.html:2370 |
| B49 | go.mp3 | Go! | After every ask that hands the child the turn, as its own short clip joined on after the words: the practice prompt and a tap on Echo (C1, C2, C3), the turtle on a sound-alone round, the retry lines (B2, B3, C5), every round game's say-it card (B5, C7) and sound power (B5), every picture-game word (C8) and Feed Echo's asks (C6). Not the books or Sound Sprint's how-to-play. Then the mic opens. | Bright and short: it hands over the turn. It was taken out on 24 Sep for sounding jumpy and is back as Travis's try (2 Oct 2026); whether it stays is his ear and Rachel's call. | public/sona.js:523 (Sona.goClip; the say-it card asks for the same "Go!" at public/arcade-sayit.js:50); joined on at public/charge.html:1015 |


### B5 — The round games (13)

The say-it card in all five round games (one voice for all five, `arcade-sayit.js`), Echo's power button in all five (instruction at public/arcade-speech-help.js:39, her sound at public/arcade-speech-help.js:79), and Sound Sprint's how-to-play line. None of them is spoken while Sona's sound is off (arcade-sayit.js:302, arcade-sayit.js:302, arcade-run.html:627). The lines ending in "say" are followed by the sound itself, which is Rachel's recording (Part A), never TTS.

| # | File | Say this | When Echo says it | Delivery | Source |
|---|---|---|---|---|---|
| B50 | card-say.mp3 | To keep playing, say | The say-it card between rounds in all five round games (Fruit Slice, Piano Tiles, Block Stacker, Sound Sprint, Flappy Glide): Echo says this, then Rachel's recording of the sound plays (`say-echo/<SOUND>-sound.wav`, Part A), then "Go!" (B49), then the mic opens. Screen: "Say “rrrr” for wave 2!" (each game its own words). On Fruit Slice, a card that asks a syllable or a word says one line instead of this and her recording (C7). | Friendly and plain. It runs straight into the sound, so leave it open at the end. | public/arcade-sayit.js:50; in this order at public/arcade-sayit.js:329 |
| B51 | card-idea.mp3 | I have an idea. Let's try this one. | Fruit Slice's card, when a syllable or a word got no answer for 8 s: the mic closes, the card goes back to the sound alone, Echo says this, then Rachel's recording, then "Go!". The practice page's own words for the same move (B3). | As B3: a good idea just arrived. Not a consolation. | public/arcade-slice.html:598; said at public/arcade-slice.html:628; the step back at public/arcade-slice.html:667 |
| B52 | power-slice.mp3 | Super Slice! Say | Fruit Slice: Echo asks automatically during play; a tap on him asks at once too. The board keeps moving, but its sounds wait. He says each distinct reason once per visit, only marking it said after it finishes, then Rachel's sound and "Go!", then the mic. Later asks for the same reason play just the sound and "Go!". A heard try earns the power and one heart back, up to three. | Short and bright. It runs straight into the sound, so leave it open at the end. Has a "!": a little lift, not a shout. | public/arcade-slice.html:158 |
| B53 | power-slice-heart.mp3 | For a heart and Super Slice, say | Fruit Slice: Echo asks automatically during play when a heart is missing; a tap on him asks at once too. The board keeps moving, but its sounds wait. He says each distinct reason once per visit, only marking it said after it finishes, then Rachel's sound and "Go!", then the mic. Later asks for the same reason play just the sound and "Go!". A heard try earns the power and one heart back, up to three. | Short and bright. It runs straight into the sound, so leave it open at the end. | public/arcade-slice.html:158 |
| B54 | power-tiles.mp3 | To slow the keys, say | Piano Tiles: Echo asks automatically during play; a tap on him asks at once too. The board keeps moving, but its sounds wait. He says each distinct reason once per visit, only marking it said after it finishes, then Rachel's sound and "Go!", then the mic. Later asks for the same reason play just the sound and "Go!". A heard try earns the power and one heart back, up to three. | Short and bright. It runs straight into the sound, so leave it open at the end. | public/arcade-tiles.html:137 |
| B55 | power-tiles-heart.mp3 | For a heart and slow keys, say | Piano Tiles: Echo asks automatically during play when a heart is missing; a tap on him asks at once too. The board keeps moving, but its sounds wait. He says each distinct reason once per visit, only marking it said after it finishes, then Rachel's sound and "Go!", then the mic. Later asks for the same reason play just the sound and "Go!". A heard try earns the power and one heart back, up to three. | Short and bright. It runs straight into the sound, so leave it open at the end. | public/arcade-tiles.html:137 |
| B56 | power-stack.mp3 | To slow the block, say | Block Stacker: Echo asks automatically during play; a tap on him asks at once too. The board keeps moving, but its sounds wait. He says each distinct reason once per visit, only marking it said after it finishes, then Rachel's sound and "Go!", then the mic. Later asks for the same reason play just the sound and "Go!". A heard try earns the power and one heart back, up to three. | Short and bright. It runs straight into the sound, so leave it open at the end. | public/arcade-stack.html:130 |
| B57 | power-stack-heart.mp3 | For a heart and slow blocks, say | Block Stacker: Echo asks automatically during play when a heart is missing; a tap on him asks at once too. The board keeps moving, but its sounds wait. He says each distinct reason once per visit, only marking it said after it finishes, then Rachel's sound and "Go!", then the mic. Later asks for the same reason play just the sound and "Go!". A heard try earns the power and one heart back, up to three. | Short and bright. It runs straight into the sound, so leave it open at the end. | public/arcade-stack.html:130 |
| B58 | power-run.mp3 | To slow the course, say | Sound Sprint: Echo asks automatically during play; a tap on him asks at once too. The board keeps moving, but its sounds wait. He says each distinct reason once per visit, only marking it said after it finishes, then Rachel's sound and "Go!", then the mic. Later asks for the same reason play just the sound and "Go!". A heard try earns the power and one heart back, up to three. | Short and bright. It runs straight into the sound, so leave it open at the end. | public/arcade-run.html:186 |
| B59 | power-run-heart.mp3 | For a heart and slow course, say | Sound Sprint: Echo asks automatically during play when a heart is missing; a tap on him asks at once too. The board keeps moving, but its sounds wait. He says each distinct reason once per visit, only marking it said after it finishes, then Rachel's sound and "Go!", then the mic. Later asks for the same reason play just the sound and "Go!". A heard try earns the power and one heart back, up to three. | Short and bright. It runs straight into the sound, so leave it open at the end. | public/arcade-run.html:186 |
| B60 | power-glide.mp3 | To slow the beams, say | Flappy Glide: Echo asks automatically during play; a tap on him asks at once too. The board keeps moving, but its sounds wait. He says each distinct reason once per visit, only marking it said after it finishes, then Rachel's sound and "Go!", then the mic. Later asks for the same reason play just the sound and "Go!". A heard try earns the power and one heart back, up to three. | Short and bright. It runs straight into the sound, so leave it open at the end. | public/arcade-glide.html:144 |
| B61 | power-glide-heart.mp3 | For a heart and slow beams, say | Flappy Glide: Echo asks automatically during play when a heart is missing; a tap on him asks at once too. The board keeps moving, but its sounds wait. He says each distinct reason once per visit, only marking it said after it finishes, then Rachel's sound and "Go!", then the mic. Later asks for the same reason play just the sound and "Go!". A heard try earns the power and one heart back, up to three. | Short and bright. It runs straight into the sound, so leave it open at the end. | public/arcade-glide.html:144 |
| B62 | sprint-howto.mp3 | Tap a lane to move side to side. Dodge the rocks and the cactus, and grab the gold coins! | Sound Sprint's start card, on a child's first three races: after the tap on "Let's run!" Echo says this while the card stays, and the race starts when he stops ("Skip" ends it early). | Clear and easy, one instruction at a time. Ends on a "!": a little lift, not a shout. | public/arcade-run.html:547; asked for at public/arcade-run.html:568 |

### B6 — Books (2)

| # | File | Say this | When Echo says it | Delivery | Source |
|---|---|---|---|---|---|
| B63 | book-end.mp3 | The end! Great listening! | The last page of every book ("The End!"), with the star and the chime. | Warm and pleased, winding down. Still has its "!". | public/library.html:1687 |
| B64 | book-turn.mp3 | Great trying. Let's turn the page. | A book page's key word (C9): after three tries that were a voice but not the book's kind of sound, Echo says this and the page turns. Screen: "Great trying! Let's turn the page." | Kind and light. The page turns on a good note. | public/library.html:1910 |

Not in this list because they speak nothing: Home, setup, settings, the voice
picker, the mic-permission screens, the chest captions and every in-round label.
See E8.

---

## Part C — Templates, with every blank filled

These lines have a blank in them. The template comes first, then the fillers, then
the lines fully written out where the set is small enough to record as fixed clips.
Numbered like Part B so they can be ticked off.

### C1 — The first prompt of a sound-alone round

`Ready? {cue}, and make your {sound} sound, {n} times.`, then "Go!" (B49) (public/charge.html:2189, built at public/charge.html:614)

Spoken once, into a closed mic, right after the mic opens and the room is measured.
Every session's first round is a sound-alone round, so a child hears this every day.
With the sound models on, Echo says the words and one take of Rachel's recorded sound (`/coach/say-echo/{SOUND}-sound.wav`, Part A) plays in the letter's place: "Ready? Pull your tongue back and up, and make your [rrrr] sound, five times." (public/charge.html:669; spoken at public/charge.html:677).

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

{n}: the number words the page knows are 2 → "two", 3 → "three", 4 → "four", 5 → "five", 6 → "six" (public/charge.html:607). The ones actually used: **five** on every normal prompt (`CHARGE_NEED = 5`, public/sona.js:2051) and **three** during a retry window after a miss (`burstAndVerify(3)`, public/charge.html:2239). The cued form can fire with "three" only when a syllable round stepped down to the sound and the child then tapped Echo.

Worth Rachel's eye: the comma/"like" cut leaves "Lips together" (B), "Like T" (D), "Like K" (G), "Like F" (V), "Teeth together" (S), "Pop it" (CH), "Like CH" (J) — a G round opens "Ready? Like K, and make your G sound, five times.". TH and THV are both spelled "T H", so only the cue tells them apart.

**All 38 lines.** Where the code says "make your R sound" you may perform the sound instead — that is the whole reason for a human recording. Delivery: even and calm; a short beat after "Ready?", the cue as a friendly reminder, the count plain.

| # | File | Say this | When | Source |
|---|---|---|---|---|
| C1 | prompt-P-cued-5.mp3 | Ready? Press your lips and pop a little puff, and make your P sound, five times. | First prompt of a P sound-alone round. | public/charge.html:614 |
| C2 | prompt-B-cued-5.mp3 | Ready? Lips together, and make your B sound, five times. | First prompt of a B sound-alone round. | public/charge.html:614 |
| C3 | prompt-M-cued-5.mp3 | Ready? Lips together and hum, and make your M sound, five times. | First prompt of a M sound-alone round. | public/charge.html:614 |
| C4 | prompt-N-cued-5.mp3 | Ready? Tongue up behind your teeth and hum, and make your N sound, five times. | First prompt of a N sound-alone round. | public/charge.html:614 |
| C5 | prompt-T-cued-5.mp3 | Ready? Tongue taps behind your top teeth, and make your T sound, five times. | First prompt of a T sound-alone round. | public/charge.html:614 |
| C6 | prompt-D-cued-5.mp3 | Ready? Like T, and make your D sound, five times. | First prompt of a D sound-alone round. | public/charge.html:614 |
| C7 | prompt-K-cued-5.mp3 | Ready? The back of your tongue pops up in the back, and make your K sound, five times. | First prompt of a K sound-alone round. | public/charge.html:614 |
| C8 | prompt-G-cued-5.mp3 | Ready? Like K, and make your G sound, five times. | First prompt of a G sound-alone round. | public/charge.html:614 |
| C9 | prompt-F-cued-5.mp3 | Ready? Top teeth on your bottom lip, and make your F sound, five times. | First prompt of a F sound-alone round. | public/charge.html:614 |
| C10 | prompt-V-cued-5.mp3 | Ready? Like F, and make your V sound, five times. | First prompt of a V sound-alone round. | public/charge.html:614 |
| C11 | prompt-S-cued-5.mp3 | Ready? Teeth together, and make your S sound, five times. | First prompt of a S sound-alone round. | public/charge.html:614 |
| C12 | prompt-Z-cued-5.mp3 | Ready? Teeth together and buzz, and make your Z sound, five times. | First prompt of a Z sound-alone round. | public/charge.html:614 |
| C13 | prompt-SH-cued-5.mp3 | Ready? Round your lips and whisper quiet, and make your S H sound, five times. | First prompt of a SH sound-alone round. | public/charge.html:614 |
| C14 | prompt-CH-cued-5.mp3 | Ready? Pop it, and make your C H sound, five times. | First prompt of a CH sound-alone round. | public/charge.html:614 |
| C15 | prompt-J-cued-5.mp3 | Ready? Like CH, and make your J sound, five times. | First prompt of a J sound-alone round. | public/charge.html:614 |
| C16 | prompt-L-cued-5.mp3 | Ready? Tongue tip up behind your top teeth, and make your L sound, five times. | First prompt of a L sound-alone round. | public/charge.html:614 |
| C17 | prompt-R-cued-5.mp3 | Ready? Pull your tongue back and up, and make your R sound, five times. | First prompt of a R sound-alone round. | public/charge.html:614 |
| C18 | prompt-TH-cued-5.mp3 | Ready? Peek your tongue between your teeth and blow soft, and make your T H sound, five times. | First prompt of a TH (as in 'thumb') sound-alone round. | public/charge.html:614 |
| C19 | prompt-THV-cued-5.mp3 | Ready? Tongue between your teeth and buzz, and make your T H sound, five times. | First prompt of a TH (voiced, as in 'the') sound-alone round. | public/charge.html:614 |
| C20 | prompt-P-cued-3.mp3 | Ready? Press your lips and pop a little puff, and make your P sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C21 | prompt-B-cued-3.mp3 | Ready? Lips together, and make your B sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C22 | prompt-M-cued-3.mp3 | Ready? Lips together and hum, and make your M sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C23 | prompt-N-cued-3.mp3 | Ready? Tongue up behind your teeth and hum, and make your N sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C24 | prompt-T-cued-3.mp3 | Ready? Tongue taps behind your top teeth, and make your T sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C25 | prompt-D-cued-3.mp3 | Ready? Like T, and make your D sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C26 | prompt-K-cued-3.mp3 | Ready? The back of your tongue pops up in the back, and make your K sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C27 | prompt-G-cued-3.mp3 | Ready? Like K, and make your G sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C28 | prompt-F-cued-3.mp3 | Ready? Top teeth on your bottom lip, and make your F sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C29 | prompt-V-cued-3.mp3 | Ready? Like F, and make your V sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C30 | prompt-S-cued-3.mp3 | Ready? Teeth together, and make your S sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C31 | prompt-Z-cued-3.mp3 | Ready? Teeth together and buzz, and make your Z sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C32 | prompt-SH-cued-3.mp3 | Ready? Round your lips and whisper quiet, and make your S H sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C33 | prompt-CH-cued-3.mp3 | Ready? Pop it, and make your C H sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C34 | prompt-J-cued-3.mp3 | Ready? Like CH, and make your J sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C35 | prompt-L-cued-3.mp3 | Ready? Tongue tip up behind your top teeth, and make your L sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C36 | prompt-R-cued-3.mp3 | Ready? Pull your tongue back and up, and make your R sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C37 | prompt-TH-cued-3.mp3 | Ready? Peek your tongue between your teeth and blow soft, and make your T H sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |
| C38 | prompt-THV-cued-3.mp3 | Ready? Tongue between your teeth and buzz, and make your T H sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:614 |

### C2 — The prompt again (tap on Echo)

`Ready? Make your {sound} sound, {n} times.`, then "Go!" (tap: public/charge.html:1293; built at public/charge.html:614)

Every later prompt of the same sound-alone round: the child taps Echo ("Tap Echo to
hear it again"). With the sound models on, her take sits in the letter's place here too.
**All 38 lines.**

| # | File | Say this | When | Source |
|---|---|---|---|---|
| C39 | prompt-P-5.mp3 | Ready? Make your P sound, five times. | Repeat prompt, P. | public/charge.html:614 |
| C40 | prompt-B-5.mp3 | Ready? Make your B sound, five times. | Repeat prompt, B. | public/charge.html:614 |
| C41 | prompt-M-5.mp3 | Ready? Make your M sound, five times. | Repeat prompt, M. | public/charge.html:614 |
| C42 | prompt-N-5.mp3 | Ready? Make your N sound, five times. | Repeat prompt, N. | public/charge.html:614 |
| C43 | prompt-T-5.mp3 | Ready? Make your T sound, five times. | Repeat prompt, T. | public/charge.html:614 |
| C44 | prompt-D-5.mp3 | Ready? Make your D sound, five times. | Repeat prompt, D. | public/charge.html:614 |
| C45 | prompt-K-5.mp3 | Ready? Make your K sound, five times. | Repeat prompt, K. | public/charge.html:614 |
| C46 | prompt-G-5.mp3 | Ready? Make your G sound, five times. | Repeat prompt, G. | public/charge.html:614 |
| C47 | prompt-F-5.mp3 | Ready? Make your F sound, five times. | Repeat prompt, F. | public/charge.html:614 |
| C48 | prompt-V-5.mp3 | Ready? Make your V sound, five times. | Repeat prompt, V. | public/charge.html:614 |
| C49 | prompt-S-5.mp3 | Ready? Make your S sound, five times. | Repeat prompt, S. | public/charge.html:614 |
| C50 | prompt-Z-5.mp3 | Ready? Make your Z sound, five times. | Repeat prompt, Z. | public/charge.html:614 |
| C51 | prompt-SH-5.mp3 | Ready? Make your S H sound, five times. | Repeat prompt, SH. | public/charge.html:614 |
| C52 | prompt-CH-5.mp3 | Ready? Make your C H sound, five times. | Repeat prompt, CH. | public/charge.html:614 |
| C53 | prompt-J-5.mp3 | Ready? Make your J sound, five times. | Repeat prompt, J. | public/charge.html:614 |
| C54 | prompt-L-5.mp3 | Ready? Make your L sound, five times. | Repeat prompt, L. | public/charge.html:614 |
| C55 | prompt-R-5.mp3 | Ready? Make your R sound, five times. | Repeat prompt, R. | public/charge.html:614 |
| C56 | prompt-TH-5.mp3 | Ready? Make your T H sound, five times. | Repeat prompt, TH (as in 'thumb'). | public/charge.html:614 |
| C57 | prompt-THV-5.mp3 | Ready? Make your T H sound, five times. | Repeat prompt, TH (voiced, as in 'the'). | public/charge.html:614 |
| C58 | prompt-P-3.mp3 | Ready? Make your P sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C59 | prompt-B-3.mp3 | Ready? Make your B sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C60 | prompt-M-3.mp3 | Ready? Make your M sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C61 | prompt-N-3.mp3 | Ready? Make your N sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C62 | prompt-T-3.mp3 | Ready? Make your T sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C63 | prompt-D-3.mp3 | Ready? Make your D sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C64 | prompt-K-3.mp3 | Ready? Make your K sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C65 | prompt-G-3.mp3 | Ready? Make your G sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C66 | prompt-F-3.mp3 | Ready? Make your F sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C67 | prompt-V-3.mp3 | Ready? Make your V sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C68 | prompt-S-3.mp3 | Ready? Make your S sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C69 | prompt-Z-3.mp3 | Ready? Make your Z sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C70 | prompt-SH-3.mp3 | Ready? Make your S H sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C71 | prompt-CH-3.mp3 | Ready? Make your C H sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C72 | prompt-J-3.mp3 | Ready? Make your J sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C73 | prompt-L-3.mp3 | Ready? Make your L sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C74 | prompt-R-3.mp3 | Ready? Make your R sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C75 | prompt-TH-3.mp3 | Ready? Make your T H sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |
| C76 | prompt-THV-3.mp3 | Ready? Make your T H sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:614 |

### C3 — The prompt on a syllable, word or sentence round

`Ready? Say {target}, {n} times.`, then "Go!" (public/charge.html:614; targets from `ladderContent`)

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

**{target} = a word** — the sound's words at the practice position: an SLP's homework position first, then the one chosen in Settings (`Sona.practicePos()`; default Beginning, and THV has no Beginning words, so all ten); any other bank word reaches this prompt when an SLP's homework names it. The whole bank is Part D (public/sona.js:1760).

**{target} = a sentence** — one of 5 frames with a bank word dropped in (public/gamecontent.js:76): "I see a ___.", "I have a ___.", "Look at the ___.", "Here is a ___.", "I like my ___.". The word comes from the same practice position as the word round (homework first, then Settings; default Beginning; "Mixed" opens the whole bank), so 5 × 356 = 1780 sentences are possible; not expanded here.

Two things for Rachel here: the frames are applied blindly, so "I have a rain" and "Here is a bathe" are reachable — the same carrier-phrase problem the word bank once had; and the sentence's own full stop survives into the prompt ("Ready? Say I see a robot., five times." — `display` keeps it), harmless for TTS, but a recording should drop it.

### C4 — Hear it slooow (the turtle)

Not a separate recording. The turtle pill replays the current line slowed to 0.7× by the app (public/charge.html:946); on a sound-alone round that is the C1/C2 text, on any other round it is just the target — syllable, word, or sentence without its full stop (public/charge.html:1286). On a sound-alone round the slowed line ends on "Go!", and with the sound models on it has Rachel's take in the letter's place, slowed with it.

### C5 — Echo's idea, with a syllable or a word

`I have an idea. Let's try this one. Say {target}.`, then "Go!" (public/charge.html:2259)

The step-down after two misses on a word or sentence round: {target} is a syllable
(C3 list) or a word at the practice position (Part D) from one rung down. (Rarely — the
fifth round for a child who has already mastered sentences — it can be a sentence.)
The sound-alone form is fixed and sits in B3. Best left to TTS.

### C6 — Feed Echo

`Where is the {word}? Say... {word}.` (public/arcade-feed.html:547)

Live, free, opened straight from Home. Echo asks this, then "Go!" (B49), at the start of
each of the five turns; the four pictures stay locked until he hears the word, and nothing is
spoken on a right tap, a wrong tap or at the finish. If nothing is heard for
8 s the mic closes and a mic button waits; a tap on it says `Say... {word}.` and "Go!"
(public/arcade-feed.html:506) and listens again. The sound is the one the child's rotation is on that
round (homework sounds first, else the child's focus sounds, else R); the pool is that sound's shortest
eight Beginning-position words with a picture (public/arcade-feed.html:267). The screen says "Where's" while the voice says "Where is".

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

`To keep playing, say... {ask}.` (public/arcade-slice.html:510)

The card between rounds of Fruit Slice. When it asks for more than the sound alone, Echo
says the whole ask as ONE line in his own voice, the syllable or word last and after
a pause, because nothing past the bare sound is recorded; then "Go!". The line is downloaded
before the syllable is shown; if it does not come, or will not play, the card stays on the
sound alone and "To keep playing, say" plus Rachel's recording plays instead (B5). What a card
asks comes from one reader, `Sona.gameAsk` (public/sona.js:1701; which voice at public/sona.js:1691):
the sound alone, then one syllable a card, then a short word, as far as that child's
cards go. Screen: "Say “ree” for wave 2!". The card hears only a voice of the right
kind — it cannot tell a syllable from the bare sound — and nothing here says "correct".
The other four round games' cards ask only the sound (B5).

**{ask} = a syllable or the short word** — only for the sounds switched on in `GAME_SYL_ON` (public/gamecontent.js:61); today: R. One syllable a card, moving on one each day. The short word is `GAME_SHORT` (public/gamecontent.js:63). Never asked, `GAME_SKIP` (public/gamecontent.js:62): P "pee"; G "gee"; TH "thee".

| Sound | Syllables, in order | Short word |
|---|---|---|
| R | ree, rah, roh | rot |

**{ask} can also be** a word from a speech therapist's homework for that sound, or the syllable or word the "Say it 5 times" page just ended on (it hands it over, so a card never asks below it). Those are C3's syllables and Part D's words; not expanded here.

Rachel's calls, built on defaults until she answers: which syllables and in what order, whether "rot" is the word, the lists for the other 18 sounds, and Echo's TTS voice modelling a syllable at all.

**All 4 lines for the sounds switched on.** Best left to TTS; listed so nothing is hidden.

| # | File | Say this | When | Source |
|---|---|---|---|---|
| C77 | card-R-ree.mp3 | To keep playing, say... ree. | Fruit Slice's card asks R in a syllable. | public/arcade-slice.html:510 |
| C78 | card-R-rah.mp3 | To keep playing, say... rah. | Fruit Slice's card asks R in a syllable. | public/arcade-slice.html:510 |
| C79 | card-R-roh.mp3 | To keep playing, say... roh. | Fruit Slice's card asks R in a syllable. | public/arcade-slice.html:510 |
| C80 | card-R-rot.mp3 | To keep playing, say... rot. | Fruit Slice's card asks R in a short word. | public/arcade-slice.html:510 |

### C8 — The picture games (Say & Play)

`Say... {word}.` (public/sayplay.js:521)

One shared script (`sayplay.js`) runs every picture game. Each turn shows a picture and
its word, Echo models the word with this line, then "Go!" (B49), then the mic opens. It is the only line
these games speak: the cheers ("Yes!", "You did it!") are text. The sound is the one the
child's rotation is on (else R); the pool is up to ten of that sound's shortest
Beginning-position words with a picture (public/sayplay.js:451). **Best left to TTS.**

Live today (4): Bubble Pop, Dino Dig, Hoops, Soccer Goal. Coming soon (17), the same line when they open: Balloon Party, Birthday Cake, Castle Builder, Fish Tank, Grow a Flower, Surprise Boxes, Monster Makeover, Pizza Chef, Puppy Bath, Race Car, Robot Builder, Rocket Blast, Build a Snowman, Space Trip, Bedtime Stars, Choo-Choo Train, Treasure Map.

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

### C9 — Books (`library.html`): 48 books, 498 pages

Live: Home's Books card opens the shelf. Echo reads everything in a book aloud.
**Best left to TTS** — it is a lot of text, and it changes when a book does. Listed so
nothing is hidden. Four templates, and two fixed lines (B6):

- **The cover:** `{title}! A story full of {sound} sounds.` (public/library.html:1674) — {sound} is read as its letters ("R", "SH", "TH"). Written out under each book below.
- **A page:** the page's text, read as the page opens (public/library.html:1721) and again on "Hear it" (public/library.html:1948).
- **A tapped word:** that word alone (public/library.html:1927).
- **The key word:** 498 of the 498 pages have one, shown in bold below. After reading the page Echo asks `Can you say... {word}.`; after a try that was a voice but not the book's kind of sound, `One more time... {word}.` (public/library.html:1880); after three of those, the B6 line and the page turns. A name keeps its capital. Silence never turns the page. A child younger than the age the book's sound usually arrives is never asked (public/library.html:1758), and the first ask of a visit waits for a grown-up's yes to the mic. Screen: "Can you say {word}?".

**Rory and the Rainbow** — R (public/library.html:365). Cover: "Rory and the Rainbow! A story full of R sounds."

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

**Rosie and the Red Wagon** — R (public/library.html:394). Cover: "Rosie and the Red Wagon! A story full of R sounds."

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

**Ray and the Lost Ring** — R (public/library.html:410). Cover: "Ray and the Lost Ring! A story full of R sounds."

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

**Boo the Bat on Halloween** — B, on the shelf 2026-10-01 to 2026-10-31 (public/library.html:426). Cover: "Boo the Bat on Halloween! A story full of B sounds."

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

**Rory the Rabbit on Halloween** — R, on the shelf 2026-10-01 to 2026-10-31 (public/library.html:442). Cover: "Rory the Rabbit on Halloween! A story full of R sounds."

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

**Sid the Seagull on Halloween** — S, on the shelf 2026-10-01 to 2026-10-31 (public/library.html:459). Cover: "Sid the Seagull on Halloween! A story full of S sounds."

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

**Leon's Trick-or-Treat Night** — L, on the shelf 2026-10-01 to 2026-10-31 (public/library.html:475). Cover: "Leon's Trick-or-Treat Night! A story full of L sounds."

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

**Zoe the Zebra on Halloween** — Z, on the shelf 2026-10-01 to 2026-10-31 (public/library.html:491). Cover: "Zoe the Zebra on Halloween! A story full of Z sounds."

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

**Finn the Fish on Halloween** — F, on the shelf 2026-10-01 to 2026-10-31 (public/library.html:507). Cover: "Finn the Fish on Halloween! A story full of F sounds."

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

**Penny's Pebble Party** — P (public/library.html:523). Cover: "Penny's Pebble Party! A story full of P sounds."

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

**Bo's Beach Day** — B (public/library.html:539). Cover: "Bo's Beach Day! A story full of B sounds."

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

**Mia Makes Muffins** — M (public/library.html:555). Cover: "Mia Makes Muffins! A story full of M sounds."

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

**Ned Needs a Net** — N (public/library.html:571). Cover: "Ned Needs a Net! A story full of N sounds."

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

**Toby's Tiny Tuba** — T (public/library.html:587). Cover: "Toby's Tiny Tuba! A story full of T sounds."

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

**Dot Digs a Pool** — D (public/library.html:603). Cover: "Dot Digs a Pool! A story full of D sounds."

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

**Kip's Kite** — K (public/library.html:619). Cover: "Kip's Kite! A story full of K sounds."

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

**Goldie's Guitar** — G (public/library.html:635). Cover: "Goldie's Guitar! A story full of G sounds."

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

**Finn Finds a Feather** — F (public/library.html:651). Cover: "Finn Finds a Feather! A story full of F sounds."

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

**Val the Van** — V (public/library.html:667). Cover: "Val the Van! A story full of V sounds."

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

**Sid the Seagull** — S (public/library.html:683). Cover: "Sid the Seagull! A story full of S sounds."

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

**Sam's Sailboat** — S (public/library.html:699). Cover: "Sam's Sailboat! A story full of S sounds."

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

**Sophie's Silly Soup** — S (public/library.html:715). Cover: "Sophie's Silly Soup! A story full of S sounds."

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

**Zoe and the Zipper** — Z (public/library.html:731). Cover: "Zoe and the Zipper! A story full of Z sounds."

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

**Shay the Shy Shark** — SH (public/library.html:747). Cover: "Shay the Shy Shark! A story full of SH sounds."

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

**Shane and the Shiny Shell** — SH (public/library.html:763). Cover: "Shane and the Shiny Shell! A story full of SH sounds."

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

**Shawn and His Shadow** — SH (public/library.html:779). Cover: "Shawn and His Shadow! A story full of SH sounds."

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

**Chip the Chipmunk** — CH (public/library.html:795). Cover: "Chip the Chipmunk! A story full of CH sounds."

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

**Jax and the Jam Jar** — J (public/library.html:811). Cover: "Jax and the Jam Jar! A story full of J sounds."

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

**Leo's Lucky Leaf** — L (public/library.html:827). Cover: "Leo's Lucky Leaf! A story full of L sounds."

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

**Libby and the Lemon** — L (public/library.html:843). Cover: "Libby and the Lemon! A story full of L sounds."

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

**Leon's Lantern** — L (public/library.html:859). Cover: "Leon's Lantern! A story full of L sounds."

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

**Theo's Thunder Day** — TH (public/library.html:875). Cover: "Theo's Thunder Day! A story full of TH sounds."

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

**Thor Says Thank You** — TH (public/library.html:892). Cover: "Thor Says Thank You! A story full of TH sounds."

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

**Thelma's Thirsty Plant** — TH (public/library.html:908). Cover: "Thelma's Thirsty Plant! A story full of TH sounds."

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

**This Bear, That Bee** — TH (v) (public/library.html:924). Cover: "This Bear, That Bee! A story full of TH sounds."

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

**Rory the Rabbit** — R (public/library.html:941). Cover: "Rory the Rabbit! A story full of R sounds."

1. Rory the rabbit rides a red rocket. — **rabbit**
2. The rocket roars over the rainbow. — **rainbow**
3. Rory sees a robot on a rock. — **robot**
4. The robot gives Rory a ring. — **ring**
5. They race around the river. — **race**
6. Rory roars: hooray, hooray! — **Rory**

**Reba the Robot** — R (public/library.html:949). Cover: "Reba the Robot! A story full of R sounds."

1. Reba the robot runs on a road. — **robot**
2. Reba rolls past a red rose. — **rose**
3. A rabbit races right by. — **rabbit**
4. Reba wraps it in a ribbon. — **ribbon**
5. Rain! They run for the roof. — **rain**
6. Reba the robot: ready, ready! — **ready**

**Ruby the Rooster** — R (public/library.html:957). Cover: "Ruby the Rooster! A story full of R sounds."

1. Ruby the rooster rises at dawn. — **Ruby**
2. Ruby crows: rise and shine! — **rise**
3. She runs around the red barn. — **red**
4. Ruby finds a wriggly worm. — **Ruby**
5. The rooster pecks rows of corn. — **rows**
6. Ruby rests. What a great run! — **run**

**Remy the Raccoon** — R (public/library.html:965). Cover: "Remy the Raccoon! A story full of R sounds."

1. Remy the raccoon roams the river. — **raccoon**
2. He reaches under a round rock. — **rock**
3. Remy grabs a ripe, red grape. — **red**
4. He rows a raft in the rain. — **rain**
5. Remy rests in the reeds. — **reeds**
6. Remy the raccoon: hooray! — **Remy**

**Rex the Rhino** — R (public/library.html:973). Cover: "Rex the Rhino! A story full of R sounds."

1. Rex the rhino runs really fast. — **rhino**
2. He roars down the rocky road. — **road**
3. Rex rolls in the rich, green grass. — **rolls**
4. He reaches for a red apple. — **red**
5. Rex meets a friendly rabbit. — **rabbit**
6. Run, Rex, run! Hooray! — **run**

**Sunny the Seal** — S (public/library.html:981). Cover: "Sunny the Seal! A story full of S sounds."

1. Sunny the seal sits in the sun. — **seal**
2. Sunny sees a silly snake. — **silly**
3. The snake slides on the soft sand. — **sand**
4. They sip soup with a silver spoon. — **soup**
5. Sunny sings a silly song. — **song**
6. So sleepy! Sunny says goodnight. — **Sunny**

**Lily the Lion** — L (public/library.html:989). Cover: "Lily the Lion! A story full of L sounds."

1. Lily the lion licks a lemon lollipop. — **lion**
2. Lily leaps over a little log. — **log**
3. A ladybug lands on a leaf. — **leaf**
4. Lily laughs: la la la! — **laughs**
5. They look at a yellow balloon. — **look**
6. Lily loves to play all day. — **Lily**

**Kiki the Koala** — K (public/library.html:997). Cover: "Kiki the Koala! A story full of K sounds."

1. Kiki the koala bakes a cake. — **cake**
2. A kind king comes with a key. — **king**
3. The king flies a colorful kite. — **kite**
4. Kiki gives the king a cookie. — **cookie**
5. A cat and a cow come to play. — **cow**
6. What a cool day for Kiki! — **Kiki**

**Shelly the Sheep** — SH (public/library.html:1005). Cover: "Shelly the Sheep! A story full of SH sounds."

1. Shelly the sheep shines her shoes. — **sheep**
2. She shows a shiny shell to a fish. — **shell**
3. They sail on a big ship. Shhh! — **ship**
4. Shelly makes a wish on a star. — **Shelly**
5. She sips a milkshake — so fresh. — **she**
6. Shhh… Shelly is sleeping now. — **Shelly**

**Charlie the Chick** — CH (public/library.html:1013). Cover: "Charlie the Chick! A story full of CH sounds."

1. Charlie the chick chews chewy cherries. — **chick**
2. Charlie rides the choo-choo train. — **Charlie**
3. He munches cheese at lunch. — **cheese**
4. A chipmunk sits on a chair. — **chair**
5. They share chocolate chips. Crunch! — **chips**
6. Charlie chirps: cheep, cheep, cheep. — **cheep**

**Theo the Sloth** — TH (public/library.html:1021). Cover: "Theo the Sloth! A story full of TH sounds."

1. Theo the sloth thinks happy thoughts. — **thinks**
2. Theo counts: one, two, three! — **Theo**
3. He gives a big thumbs up. — **thumbs**
4. Theo brushes his three teeth. — **Theo**
5. Then a warm bath — both feet in. — **bath**
6. Thank you, moon. Theo says goodnight. — **thank**

**Gus the Goat** — G (public/library.html:1029). Cover: "Gus the Goat! A story full of G sounds."

1. Gus the goat grows a green garden. — **goat**
2. A goose gives Gus a gift. — **goose**
3. Gus plays a goofy guitar. — **guitar**
4. They gobble grapes by the gate. — **gate**
5. A bug giggles on the grass. — **giggles**
6. Good game, Gus. Goodnight! — **Gus**

**Fifi the Fox** — F (public/library.html:1037). Cover: "Fifi the Fox! A story full of F sounds."

1. Fifi the fox finds four feathers. — **fox**
2. Fifi feeds a funny fish. — **fish**
3. They warm five feet by the fire. — **fire**
4. A butterfly flies fast — wow! — **fast**
5. Fifi has fun with her friends. — **fun**
6. Fifi waves: farewell, farewell! — **Fifi**

---

## Part D — The word bank

Every practice word, by sound and by where the sound sits in the word (public/sona.js:1760).
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

The chapter reader was parked on 19 Sep 2026 and stayed parked when the picture books came back (C9); `tests/day1.mjs` pins that Home has no door to it. When the page opens, each page is read aloud as it turns — the chapter's opening line, then its six beats (public/chapter.html:124, public/chapter.html:174); "Read it to me" says the same page again (public/chapter.html:203). Tomorrow's hook is shown on the finish card, not spoken. The table is `EPISODES` (public/sona.js:882). Read as a bedtime story if they ever come back: slower than the prompts, the last line of each page landing softly.

One fixed line: "You did it! Three games are unlocked." — the finish card (public/chapter.html:196). Still has its "!" — the parked pages never got the calm rewrite.

**Chapter 1 — The Star That Fell** (public/sona.js:883)

1. You are in the meadow when the sky drops something. It lands in the tall grass with a soft whump. The grass around it starts to glow.
2. It is a star. A small one, about the size of your two hands together. It is shaking.
3. Echo lands beside it and says hello. The star does not answer. Stars do not know words yet.
4. But when you speak, the star brightens. It has never heard a voice before. It likes yours.
5. The more you say, the warmer it gets. Warm stars can float. Cold ones cannot.
6. It lifts off the grass. Just a little. Just enough to show you it wants to go home.
7. Home is a very long way up. Echo looks at the sky, then at you. This is going to take a while.

**Chapter 2 — The Bramble Path** (public/sona.js:895)

1. The only way out of the meadow is one narrow path. Overnight, the brambles have grown all the way across it.
2. Thorns as long as your finger. Echo tries to squeeze through and comes back with one feather missing.
3. The star floats up to look. From above, the path is a green tangle with no gap anywhere in it.
4. Then the star does something new. It hums one low note, and a single bramble curls away from the sound.
5. So you help. Every sound you make bends another branch back, and a gap opens up in the green.
6. You go through in a line. Echo first, then you, then the star bobbing along behind.
7. On the other side there is a noise like a hundred spoons in a hundred cups. Water. A lot of water.

**Chapter 3 — The River Crossing** (public/sona.js:907)

1. The river is wide, loud, and moving fast. There is no bridge. There is no boat. There is just you.
2. The star floats out over the water to have a look, and the wind pushes it straight back to you.
3. Echo spots something under the surface. Flat stones, one after another, like a path somebody hid on purpose.
4. They are too deep to stand on. But when you speak, the nearest one rises up out of the water.
5. One stone at a time. A sound, a stone, a step. A sound, a stone, a step.
6. Halfway across, a fish comes up beside you and just listens. Then another one. Then eleven more.
7. You reach the far bank with wet shoes and a small crowd of fish watching you go.

**Chapter 4 — The Whispering Woods** (public/sona.js:919)

1. The trees here are old and standing close together. Say one word and the woods say it back to you, twice.
2. Echo goes absolutely wild. A parrot in a place that repeats things is a parrot in heaven.
3. The star hides in your pocket. It is not used to hearing itself yet.
4. You try a sound. The woods answer. You try another one. The woods answer that one too.
5. Then a third voice joins in. Small, wobbly, half a beat behind. That one is not a tree.
6. Something is following you and copying you. Echo stops laughing and steps in front of you.
7. It comes out of the ferns. It is about the size of a teacup, and it is extremely fluffy.

**Chapter 5 — Pip** (public/sona.js:931)

1. It is a baby owl. It has one feather sticking straight up off its head, and it will not stop staring at you.
2. Echo asks its name. The owl copies the question back instead of answering it. It is learning too.
3. You make a sound. The owl tries the same one. It comes out sideways, but it comes out.
4. You make it again. This time the owl lands much closer to it, and its one feather quivers with the effort.
5. You share your snack. The owl decides you are family now and climbs into your hood.
6. Echo names it Pip, on the grounds that it makes a sound like pip whenever it is pleased.
7. Pip points a wing at the hills. There is a black opening in the rock, and the path goes straight into it.

**Chapter 6 — The Cave of Echoes** (public/sona.js:943)

1. Inside the cave it is black. Not dim. Black. You cannot see your own hands in front of you.
2. Then Pip makes one small nervous pip, and a ring of blue light spreads across the ceiling.
3. The rock in here answers sound with light. Every noise you make lights up the part of the wall it touches.
4. So you talk your way in. The cave glows ahead of you, one patch at a time, like stepping stones made of light.
5. The star sits on your shoulder and hums along. Between the two of you, it is almost bright.
6. The light reaches a wall that is not rock. It is flat, and somebody has drawn on it.
7. Hundreds of drawings. And in every single one, somebody is holding a star.

**Chapter 7 — The Drawings** (public/sona.js:955)

1. The drawings go on for further than you can walk in one go. They tell a story, left to right, like a very long comic.
2. First panel: a person in a meadow, and a star falling out of the sky. That one looks familiar.
3. Then a river. Then woods. Then a cave, with a small round shape riding on somebody's shoulder.
4. Pip looks at the shoulder shape, then down at itself, then back at the shoulder shape.
5. The last panel is a ladder. It starts on the ground and it goes up and up into the clouds.
6. There is no drawing of what happens after the ladder. Whoever drew all this never came back to finish it.
7. Echo is very quiet, which for a parrot is unusual. Then Echo says: well. We had better go and look.

**Chapter 8 — The Cloud Ladder** (public/sona.js:967)

1. The ladder is exactly where the drawing said it would be. Rungs of white cloud, going up and up until they are too small to see.
2. Echo tests the bottom rung with one foot. It goes straight through it. Cloud is cloud.
3. Then the star drifts down and rests on the rung, and the cloud puffs solid, like bread rising.
4. Warmth is what makes cloud firm. And your voice is what keeps the star warm.
5. So you climb and you talk. Rung, sound, rung, sound. The meadow shrinks to a green thumbprint underneath you.
6. Pip refuses to fly and rides in your hood the whole way, which is somehow more tiring for you than for Pip.
7. Near the top the air changes. It is moving. It is moving very fast.

**Chapter 9 — The Windy Ridge** (public/sona.js:979)

1. The top of the ladder comes out on a thin ridge of cloud, and the wind up here does not stop for a second.
2. It pulls at your sleeves. It pulls at Echo's tail. It pulls sounds right out of the air and carries them off sideways.
3. The star dims. Up here it is losing warmth faster than you can give it back.
4. So you tuck it inside your coat, against you, where the wind cannot get at it.
5. It works. You can feel it glowing through the fabric, steady as a heartbeat.
6. Pip flies ahead to scout, gets blown backwards past your head, and returns to the hood without comment.
7. Through the blur you see it. Something enormous standing out in the open sky, and the wind is going around it.

**Chapter 10 — The Sky Door** (public/sona.js:991)

1. It is a door. It is taller than a tree and it is standing in the open air with nothing holding it up.
2. No handle. No lock. No keyhole. Carved in the middle of it, at exactly your height, there is an ear.
3. Echo knocks. Nothing. Pip pips at it. Nothing. The star bumps into it and slides slowly down.
4. So you lean close to the carved ear, and you say something to it.
5. The door listens. That is the whole trick. It has been waiting a very long time for somebody to talk to it.
6. It swings open onto the night sky, closer than you have ever seen it, every star the size of a lamp.
7. Your star leaps out of your coat and races for a gap in the pattern. And that is when you see the other gaps.

**Chapter 11 — The Star Comes Back** (public/sona.js:1007)

1. Your star is home. It sits in its gap in the sky, blazing away, exactly the right shape for the space it left.
2. You are about to go when it pops straight back out of the gap and lands on your shoulder.
3. Echo says that is not how going home works. The star does not appear to care.
4. Then you look properly at the sky, and you understand why it came back.
5. There are gaps everywhere. Dark shapes where stars should be. You count them twice to be sure.
6. Eleven. Eleven stars that fell somewhere and never got back up.
7. Pip is already looking down through the open door. Somewhere under all that cloud, eleven lights are waiting.

**Chapter 12 — The Lantern City** (public/sona.js:1019)

1. You come down out of the clouds over a city made of lanterns. Thousands of them, strung between the rooftops, glowing orange.
2. It is night here, but nobody has noticed. In a city of lanterns, night is just when the lights look nicer.
3. Echo asks a pigeon for directions. The pigeon is not helpful. Pigeons rarely are.
4. Then Pip pips once, and the two of you see it at the same time.
5. One lantern in the middle of the city is far, far too bright. Nobody has thought to ask why.
6. It is up at the very top of the tallest post, above all the washing lines and the cats.
7. So you start to climb. Twelve floors of ladders and roof tiles, and the light gets whiter the higher you go.

**Chapter 13 — The Longest Night** (public/sona.js:1031)

1. At the top of the post, inside a glass lantern the size of a bathtub, a star is sitting with its arms around its knees.
2. It has been in there so long that it thinks the lantern is the sky.
3. The glass is warm. When you speak near it, the star turns its head.
4. It will not come out. Everything out there is dark and everything in here is bright, and it is not moving.
5. So you sit down on the roof tiles and you talk to it. Not to make it do anything. Just so it is not on its own.
6. The glass cools. The star stands up. It comes over to the little door in the side and looks out at you.
7. As it steps out, every lantern in the city dims by exactly the same amount, and for the first time in years the people below look up.

**Chapter 14 — Under the Ice** (public/sona.js:1043)

1. A frozen lake, flat and grey and bigger than the city was. Under your boots you can hear the ice creak.
2. Something down there is glowing green through the ice, about the size of a dinner plate.
3. It is not green. It is a star, and the ice is what is making it look that way.
4. Echo taps the surface with one claw. The ice is thicker than Echo is tall.
5. But your two stars are warm. You lie flat and hold them against the surface, and the ice begins to give.
6. A hole opens, no bigger than a plate. The green light comes up through it and turns gold in the air.
7. Three stars now. Pip's hood is getting crowded, and Pip is very clear about it.

**Chapter 15 — The Music Box** (public/sona.js:1055)

1. The house has been empty a long time. The attic ladder comes down when you pull it, and dust falls on all three of you.
2. In the corner, under a sheet, something is playing. Six notes, over and over, very slowly.
3. It is a music box. The lid is shut, and the little brass key on the back is turning all by itself.
4. Echo lands on the lid and gets carried around in a slow circle, which Echo finds undignified.
5. You lift the lid. Inside, where the dancer should be, there is a star going round and round.
6. It has been keeping time in here for years. Nobody ever told it how to stop.
7. So you learn the six notes and say them back, and on the last one the star steps off the spindle and into your hand.

**Chapter 16 — The Orchard** (public/sona.js:1067)

1. Rows and rows of trees, all the same height, all quiet. Somewhere in the middle, one branch is bent almost to the ground.
2. On the end of it hangs a fruit the size of your head, and it is glowing faintly through the skin.
3. Echo tries to eat it. Echo is stopped.
4. You cut it down carefully. It is warm in your hands, and heavier than a fruit has any business being.
5. Inside there is a star, curled up, fast asleep. It fell in the spring and the tree simply grew around it.
6. You wake it the polite way, which is with your voice and not with your hands.
7. The branch springs straight the moment the fruit leaves it, and every other tree in the row shivers once, in order, all the way down.

**Chapter 17 — The Ferry** (public/sona.js:1079)

1. The road ends at the sea. There is a jetty, and a boat, and a very large creature asleep across the whole of it.
2. It has whiskers like broom handles and it is snoring in a way that moves the water.
3. Echo suggests going around. There is no around. There is sea in both directions as far as anybody can see.
4. Pip lands on its nose. One eye opens. The eye is the size of a dinner plate and it looks straight at you.
5. It is the ferry. It has been the ferry for a very long time, and nobody has asked it for a ride in years.
6. You share what is left of your food, and you tell it where you are going and why.
7. It slides off the jetty without a word and floats there, waiting, with its back flat like a raft.

**Chapter 18 — The Deep** (public/sona.js:1091)

1. Out where the water goes from green to black, the ferry stops and points its nose straight down.
2. Far below, so far it might be your eyes making it up, there is one small light.
3. You cannot swim that deep. Nobody can. But your four stars can, and they will not go without you.
4. So they make a bubble. Four stars in a ring, warm air between them, and you inside it, going down.
5. Kelp closes over the top. Fish you have no names for come to look at you, and then leave again.
6. The light gets bigger. It is shut inside a shell the size of a door.
7. You say something to the shell, the way you did to the sky door, and it opens without any fuss at all.

**Chapter 19 — The Nest** (public/sona.js:1103)

1. On the cliffs above the beach there is a nest, and the nest is glittering.
2. Bottle caps. Spoons. A watch. A doorknob. And near the middle, two lights that are none of those things.
3. Pip goes completely still, the way small birds do when a big bird is somewhere close.
4. It lands behind you. It is black and enormous and its head tilts all the way over to look at you.
5. It is not angry. It just likes bright things, and two of the brightest things it ever found were lying in a field.
6. So you trade. You give it the shiniest thing you are carrying, which is the little brass key off the back of the music box.
7. It takes the key, and it lets you take the two stars, and it watches you the whole way down the cliff path.

**Chapter 20 — The Loose Thread** (public/sona.js:1115)

1. Seven stars now. They ride in a loose cloud around your head, and you have stopped being able to count them without help.
2. You are walking back towards the cloud ladder when Echo stops dead in the air.
3. Hanging down out of the sky, swaying, there is a single silver thread. It goes up further than you can see.
4. You touch it. It hums the same six notes as the music box, and every star you are carrying hums back.
5. Echo says the thing you are both thinking. The sky is not a picture. The sky is something somebody made.
6. And somewhere up there a thread has come loose, and the stars have been slipping through the gap it left.
7. The thread twitches once, all on its own, as though something at the far end of it just noticed you holding on.

**Chapter 21 — Following the Thread** (public/sona.js:1131)

1. You wrap the thread around your hand and it lifts, gently, the way a kite pulls just before it goes.
2. The ground drops away. The orchard, then the lake, then the lantern city, all of it going small underneath you.
3. Pip flies alongside for the first time in the whole journey, which Pip would like noted.
4. The stars come too, in a long line behind you, like beads on a string.
5. Above the clouds the thread stops being silver and starts being light, and it is warm to hold.
6. You go up through the place where the sky door was and out the other side, and there is no other side. There is just more sky.
7. The thread ends at a stair. A spiral stair with no building around it, going up into the dark.

**Chapter 22 — The Weaver's Stair** (public/sona.js:1143)

1. The stair is made of the same silver as the thread, and every step gives a little under your weight, like rope.
2. There is no rail. There is nothing to fall onto either, which Echo points out and immediately regrets pointing out.
3. You climb. The stars go on ahead and light three steps at a time.
4. Halfway up, you pass a step with a bird's nest on it. Old, empty, and very carefully made.
5. Pip looks at that nest for a long moment and does not say anything at all.
6. The stair narrows near the top, until it is one step wide and you are going up it sideways.
7. Then the dark opens out, and there is a room, and in the room there is a loom the size of a house.

**Chapter 23 — The Weaver** (public/sona.js:1155)

1. She is very old and very small, and she is sitting at the loom with her hands in her lap, not weaving.
2. The cloth on the loom is the night sky. You are seeing it from underneath, which nobody has ever done.
3. She says hello without turning around. She says she wondered when somebody would come.
4. Echo, for once, has nothing to say. Pip climbs out of your hood and sits on the arm of her chair.
5. There is a gap in the weave the size of a door. Around it, threads hang loose in every direction.
6. She has not stopped because she is tired, although she is. She has stopped because she cannot do it on her own any more.
7. You put your seven stars down on the floor of the room, and the whole place fills up with light.

**Chapter 24 — What the Loom Needs** (public/sona.js:1167)

1. She picks up the shuttle and holds it out to you. It is wooden, worn smooth, and lighter than it looks.
2. She says the loom does not run on hands. It never has.
3. She sings one note, and a thread pulls itself across the frame and lies down flat.
4. That is why the stars go warm when you talk to them. That is why the door opened. That is why the cave lit up.
5. The whole sky is woven out of sound, and it has been quiet up here for a very long time.
6. Her voice went a while ago. That is the night the thread came loose, and every night since has been a little darker.
7. She puts the shuttle into your hand and closes your fingers around it, and she does not say anything else.

**Chapter 25 — The Eighth Star** (public/sona.js:1179)

1. You find the eighth star before you work out how to weave. It is tangled in the loose threads at the edge of the gap.
2. It has been stuck there since the night it slipped, holding on so it would not fall like the others.
3. The threads have grown right around it, the way the orchard tree grew around its fruit.
4. You work it free one strand at a time while it hums the six notes at you, over and over, nervously.
5. When it comes loose it does not fly off. It stays exactly where it is, because it is already in its own place.
6. One star back in the sky, and the smallest patch of the dark shape closes up around it.
7. The Weaver laughs, which is a sound like a door that has not been opened in years.

**Chapter 26 — The Unravelling** (public/sona.js:1191)

1. You wake up to a sound like a zip. Along the far edge of the loom, the weave is coming apart on its own.
2. Threads are letting go one after another, faster than anybody could tie them back.
3. Through the widening gap you can see the ground, extremely far away, and none of it is cloud.
4. Echo goes one way and Pip goes the other and you go straight down the middle, catching threads.
5. You get six of them in one fist and it is nowhere near enough. There are hundreds.
6. Then the Weaver says your name, and tells you to stop grabbing and start talking.
7. So you do. And the threads you speak to stop moving, and hang still, and wait.

**Chapter 27 — The Two in the Dark** (public/sona.js:1203)

1. There is a corner of the sky where three stars fell on the same night, and nothing has ever been put back.
2. It is the darkest place you have ever stood. Darker than the cave, because in the cave there was rock to touch.
3. Your stars will not go in. They hang at the edge of it, dimming, like a hand held over a candle.
4. So you go in without them, with Pip on your shoulder and Echo somewhere just above your head.
5. You find the first one by sound. It has been humming the whole time, very quietly, for a very long while.
6. The second one is holding on to the first one and will not let go, so you carry the pair of them together.
7. Coming out, you count. Two in your arms. One still missing. And no corner of the world left that you have not looked in.

**Chapter 28 — The Last One** (public/sona.js:1215)

1. You look everywhere for the eleventh star. The Weaver studies the sky from underneath. Echo asks every bird between here and the sea.
2. Nothing. Ten found, one gap left, and not one single idea between the four of you.
3. Then Pip flies off without telling anybody, which Pip has never once done, and is gone until morning.
4. Pip comes back with a single blade of grass in its beak. Long, green, and slightly scorched at the tip.
5. You know that grass. You have sat in that grass. It is the meadow, from the very first night.
6. The last star never went anywhere at all. It landed where the first one landed, on the same night, and it has been under the grass ever since, waiting for somebody to come back for it.
7. It is small and it is cold, and when you pick it up it fits in one hand, exactly the way the first one did.

**Chapter 29 — The Long Way Back Up** (public/sona.js:1227)

1. Ten stars. You have ten stars and one spiral stair, and the stair is one step wide at the top.
2. Echo carries two, badly. Pip carries one and will not be talked out of it.
3. The rest go in your coat, in your hood, and in both hands, and you go up sideways the way you did before.
4. Halfway, at the step with the old nest on it, you stop to rest and count them all again.
5. Pip puts its star down in the nest for a moment, just to see how it looks. It looks very good.
6. Then Pip picks it up again, because it is not Pip's star, and there is a sky waiting for it.
7. At the top, the Weaver has the loom open and the shuttle ready. She has been up all night clearing the frame.

**Chapter 30 — The Sky, Mended** (public/sona.js:1239)

1. The gap in the weave is the size of a door, and there are ten stars sitting on the floor of the room waiting to go through it.
2. The Weaver cannot sing it shut. You already knew that. It is the reason you are the one holding the shuttle.
3. So you say the first thing that comes into your head, and a thread lies itself flat across the frame.
4. Then another. Then another. It is slow, and it is not neat, and it holds.
5. One at a time the stars step up into the weave and find their gaps, and one at a time the dark shapes close.
6. The last one is the star from the meadow. It waits until the very end. Then it goes up, and the sky is whole.
7. From underneath, the new patch does not match. It is brighter than the rest, and rougher, and the Weaver says that is how everybody will know that somebody mended it.

### E2 — Your Adventure (`story.html`, parked)

No page opens it: the Books page keeps its tile hidden (public/library.html:237), and it is gated behind `Sona.gated('story')`. Each page is read aloud when it opens (public/story.html:238) and on "Hear it" (public/story.html:293); then "Now you! Say... {word}!" (public/story.html:240); a heard try gets one of the five praise lines (public/story.html:264); a missed one gets the bare word again (public/story.html:273). The pages are normally an AI-written story from `/api/story` — unbounded text that cannot be pre-recorded. The fallback pages are 5 frames with a bank word (public/gamecontent.js:83): "Once, Echo saw a ___.", "He really liked the ___.", "Then came a big ___.", "Echo and the ___ played all day.", "What a fun ___!".

### E3 — Books: no longer parked

The picture books are live again; their lines are in B6 and C9. The number is kept so
the sections after it keep theirs.

### E4 — Peekaboo (`simple-play.js`, coming soon)

"Coming soon" in the catalog, with a disabled Home card. The only spoken line is the bare **{word}** when the picture is revealed (public/simple-play.js:112) and on "Hear it" (public/simple-play.js:400) — the same per-sound pools as Feed Echo (C6).

### E5 — Speech Check (`check.html`, unlinked)

The ad-funnel page; nothing in the app links to it. "Say: {word}" for each of 9 words in this order (public/check.html:187): cat, goat, fish, lion, shoe, cheese, sun, rabbit, thumb. It sends no voice id, so it always uses the default voice.

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

- **The idle nudge** (public/charge.html:1847): would replay the prompt after 8 s of silence, up to twice. `armIdle()` is defined but never called; the not-heard path is the quiet screen (B4).
- **"You did it."** (public/charge.html:2263): fallback praise only if `praiseLine` were missing — `sona.js` always provides it.
- **"Let's try our {sound} sound again"** (public/charge.html:2231): fallback coaching only for a sound with no tip — all 19 have one.
- **"Listen to Echo, then copy the sound!"** (public/sona.js:3510): the default cue for an unknown sound; the practice page forces the sound to one of the 19.
- **`actionCue`, `repeatCue`, `coachLine`** (public/sona.js:3716, public/sona.js:3721, public/sona.js:3732): exported, no caller anywhere. Pre-calm wording — e.g. "Are you ready? Say rrrr 5 times!", "Repeat after me… rrrr!  Now you try — rrrr!", "Let's try again. Say rrrr! Pull your tongue back and up like a tiger growl — rrr!".
- **The conversation rung** (public/gamecontent.js:89): "Which do you like — a ___ or a ___?", "Do you want the ___ or the ___?", "Pick one — ___ or ___!", "Hmm… a ___ or a ___?" — the practice page keeps only items with a target (`it.t`) and these have none, so a conversation round falls back to the bare sound.
- **The sound models as text** (public/sona.js:3567): puh, buh, mmm, nnn, tuh, duh, kuh, guh, ffff, vvvv, sss, zzz, shhh, chuh, juh, lll, rrrr, thhh, thuh — shown on screen, never sent to TTS, because a synthesized "rrrr" comes out mangled. The performed sound is Rachel's clip (Part A).

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

**Totals.** Part A: 19 sound models (38 files, Rachel's). Part B: **64 fixed clips** to record. Part C: **80 template lines written out** (C1 38 + C2 38 + C7 4) plus 910 fillers listed (19 cues, 19 sound names, 95 syllables, 5 sentence frames, 134 Feed Echo words, 4 game-card asks, 136 picture-game words, 498 book pages in 48 books). Part D: **356 bank entries, 294 distinct words** (TTS). Part E: 270 parked/unlinked lines not to record (210 chapter pages, 43 Coach Call, 9 Speech Check, the rest single lines).

Record B first (64 lines — an hour), then C1 and C2 (76 lines, where you perform the sound), and stop there: the rest of Part C and Part D are words, and words are what TTS already does well.
