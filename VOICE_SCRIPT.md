# Echo's Recording Script

Every line Echo — the app's voice — can say out loud, in the exact words the code
sends to the voice, with the file and line each one comes from. Generated from the
live code by `node tools/voicedoc.mjs > VOICE_SCRIPT.md` (or `--write`); the
generator stops with an error if a line it knows disappears or a new spoken line
appears, so this sheet cannot drift from the app.

Five parts. **A** — the 19 sound models Rachel already recorded. **B** — the fixed
lines to record, numbered. **C** — the lines with a blank in them (the prompt with a
sound name and a count, Feed Echo's ask) with every blank filled in. **D** — the
word bank. **E** — what NOT to record: parked, unlinked and dead lines.

## How to record

- **One take per row, a beat of silence at each end.** Trailing silence gets
  trimmed; a clipped word ending cannot be recovered.
- **Room tone matters more than the mic.** Soft furnishings, no fan, no laptop on
  the table, phone on silent. Same room, same distance, for the whole set.
- **Talk to one small child sitting next to you.** Calm, warm, unhurried. Full
  stops, not exclamation marks — every live line was rewritten on 24 Sep 2026 so
  the voice does not jump. The one "!" line left is the quiet screen (row noted).
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

Switch state right now: `HUMAN_CLIPS = true` (public/sona.js:3707) — the re-voiced sound models of Part A are ON, and replace the C1 prompt for their sound; every other line below is spoken through TTS.

---

## Part A — The 19 sound models (already recorded by Rachel)

**Do not re-record these unless Rachel says so — they are the clinical model.** She
recorded them in July (`git show 7ad8219`): 19 practice prompts and 19 bare-sound
demos in `public/coach/say/`. Each prompt clip is the whole opening line with the
sound actually performed in it (her "Ready?" stitched on the front, a "Go" at the
end — July wording, before the calm rewrite), because TTS cannot perform a stretched
or popped sound. Her raw voice never plays: `tools/revoice.mjs` runs each take through
ElevenLabs speech-to-speech into Echo's voice, into `public/coach/say-echo/` (25 Sep
2026) — her pacing and the performed sound survive, the timbre is Echo's. With the
switch on, `say-echo/<SOUND>.mp3` plays *in place of* the C1 prompt for that sound
(public/charge.html:628); `say-echo/<SOUND>-demo.mp3` is used only by the parked Coach Call.

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

Sources: models public/sona.js:2888 (`SOUND_SAY`, shown on the practice card and the games' keep-playing card, never sent to TTS); cues public/sona.js:2811 (`CUES`).

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
| B1 | praise-1.mp3 | Nice one. | After the easier target (the "I have an idea" line, B3/C5) passes — one of the five, picked at random. The only spoken praise in the live app, and the win line (B45) follows it; a normal pass gets only the win line. | Soft and pleased, a small smile in it. Not a cheer. | public/sona.js:2908; spoken at public/charge.html:2009 |
| B2 | praise-2.mp3 | Good job. | Same moment, random pick of five. | Soft and pleased, a small smile in it. Not a cheer. | public/sona.js:2908; spoken at public/charge.html:2009 |
| B3 | praise-3.mp3 | I heard that. | Same moment, random pick of five. | Soft and pleased, a small smile in it. Not a cheer. | public/sona.js:2908; spoken at public/charge.html:2009 |
| B4 | praise-4.mp3 | That was lovely. | Same moment, random pick of five. | Soft and pleased, a small smile in it. Not a cheer. | public/sona.js:2908; spoken at public/charge.html:2009 |
| B5 | praise-5.mp3 | Well done. | Same moment, random pick of five. | Soft and pleased, a small smile in it. Not a cheer. | public/sona.js:2908; spoken at public/charge.html:2009 |

### B2 — Coaching after a miss (19)

`Let's try that one again. {tip}.` — the tip is Rachel's mouth cue cut at the dash (rule at public/charge.html:1980).

| # | File | Say this | When Echo says it | Delivery | Source |
|---|---|---|---|---|---|
| B6 | coach-P.mp3 | Let's try that one again. Press your lips and pop a little puff. | Once per round, when the on-device check heard a clearly different sound on P. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B7 | coach-B.mp3 | Let's try that one again. Lips together, turn your voice on. | Once per round, when the on-device check heard a clearly different sound on B. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B8 | coach-M.mp3 | Let's try that one again. Lips together and hum. | Once per round, when the on-device check heard a clearly different sound on M. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B9 | coach-N.mp3 | Let's try that one again. Tongue up behind your teeth and hum. | Once per round, when the on-device check heard a clearly different sound on N. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B10 | coach-T.mp3 | Let's try that one again. Tongue taps behind your top teeth. | Once per round, when the on-device check heard a clearly different sound on T. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B11 | coach-D.mp3 | Let's try that one again. Like T, but turn your voice on. | Once per round, when the on-device check heard a clearly different sound on D. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B12 | coach-K.mp3 | Let's try that one again. The back of your tongue pops up in the back. | Once per round, when the on-device check heard a clearly different sound on K. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B13 | coach-G.mp3 | Let's try that one again. Like K, but turn your voice on. | Once per round, when the on-device check heard a clearly different sound on G. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B14 | coach-F.mp3 | Let's try that one again. Top teeth on your bottom lip, blow soft. | Once per round, when the on-device check heard a clearly different sound on F. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B15 | coach-V.mp3 | Let's try that one again. Like F, but buzz your voice. | Once per round, when the on-device check heard a clearly different sound on V. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B16 | coach-S.mp3 | Let's try that one again. Teeth together, big smile, let the air hiss out. | Once per round, when the on-device check heard a clearly different sound on S. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B17 | coach-Z.mp3 | Let's try that one again. Teeth together and buzz like a bee. | Once per round, when the on-device check heard a clearly different sound on Z. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B18 | coach-SH.mp3 | Let's try that one again. Round your lips and whisper quiet. | Once per round, when the on-device check heard a clearly different sound on SH. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B19 | coach-CH.mp3 | Let's try that one again. Pop it like a little train. | Once per round, when the on-device check heard a clearly different sound on CH. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B20 | coach-J.mp3 | Let's try that one again. Like CH, but turn your voice on. | Once per round, when the on-device check heard a clearly different sound on J. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B21 | coach-L.mp3 | Let's try that one again. Tongue tip up behind your top teeth. | Once per round, when the on-device check heard a clearly different sound on L. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B22 | coach-R.mp3 | Let's try that one again. Pull your tongue back and up like a tiger growl. | Once per round, when the on-device check heard a clearly different sound on R. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B23 | coach-TH.mp3 | Let's try that one again. Peek your tongue between your teeth and blow soft. | Once per round, when the on-device check heard a clearly different sound on TH (as in 'thumb'). Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |
| B24 | coach-THV.mp3 | Let's try that one again. Tongue between your teeth and buzz. | Once per round, when the on-device check heard a clearly different sound on TH (voiced, as in 'the'). Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries. | Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word. | public/charge.html:1984 |

### B3 — Echo's idea, sound alone (19)

`I have an idea. Let's try this one. Make your {sound} sound.` — the same line with a syllable or a word in it is a template (C5). Where the code spells the letter name ("S H", "C H", "T H"), say the sound name as a person would.

| # | File | Say this | When Echo says it | Delivery | Source |
|---|---|---|---|---|---|
| B25 | idea-P.mp3 | I have an idea. Let's try this one. Make your P sound. | After the retry ALSO missed on a syllable round of P: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B26 | idea-B.mp3 | I have an idea. Let's try this one. Make your B sound. | After the retry ALSO missed on a syllable round of B: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B27 | idea-M.mp3 | I have an idea. Let's try this one. Make your M sound. | After the retry ALSO missed on a syllable round of M: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B28 | idea-N.mp3 | I have an idea. Let's try this one. Make your N sound. | After the retry ALSO missed on a syllable round of N: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B29 | idea-T.mp3 | I have an idea. Let's try this one. Make your T sound. | After the retry ALSO missed on a syllable round of T: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B30 | idea-D.mp3 | I have an idea. Let's try this one. Make your D sound. | After the retry ALSO missed on a syllable round of D: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B31 | idea-K.mp3 | I have an idea. Let's try this one. Make your K sound. | After the retry ALSO missed on a syllable round of K: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B32 | idea-G.mp3 | I have an idea. Let's try this one. Make your G sound. | After the retry ALSO missed on a syllable round of G: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B33 | idea-F.mp3 | I have an idea. Let's try this one. Make your F sound. | After the retry ALSO missed on a syllable round of F: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B34 | idea-V.mp3 | I have an idea. Let's try this one. Make your V sound. | After the retry ALSO missed on a syllable round of V: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B35 | idea-S.mp3 | I have an idea. Let's try this one. Make your S sound. | After the retry ALSO missed on a syllable round of S: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B36 | idea-Z.mp3 | I have an idea. Let's try this one. Make your Z sound. | After the retry ALSO missed on a syllable round of Z: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B37 | idea-SH.mp3 | I have an idea. Let's try this one. Make your S H sound. | After the retry ALSO missed on a syllable round of SH: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B38 | idea-CH.mp3 | I have an idea. Let's try this one. Make your C H sound. | After the retry ALSO missed on a syllable round of CH: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B39 | idea-J.mp3 | I have an idea. Let's try this one. Make your J sound. | After the retry ALSO missed on a syllable round of J: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B40 | idea-L.mp3 | I have an idea. Let's try this one. Make your L sound. | After the retry ALSO missed on a syllable round of L: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B41 | idea-R.mp3 | I have an idea. Let's try this one. Make your R sound. | After the retry ALSO missed on a syllable round of R: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B42 | idea-TH.mp3 | I have an idea. Let's try this one. Make your T H sound. | After the retry ALSO missed on a syllable round of TH (as in 'thumb'): Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |
| B43 | idea-THV.mp3 | I have an idea. Let's try this one. Make your T H sound. | After the retry ALSO missed on a syllable round of TH (voiced, as in 'the'): Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries. | Bright and easy, like a good idea just arrived. Not a consolation. | public/charge.html:2005 |

### B4 — Round end, win, chest, adventure end, quiet screen (5)

| # | File | Say this | When Echo says it | Delivery | Source |
|---|---|---|---|---|---|
| B44 | roundend.mp3 | Good practicing. Let's play. | Round end when the retry (and the easier target, if there was one) still came back as the wrong sound. The game opens anyway; the win line is NOT spoken in this case. | Warm and light. There is no disappointment in it — the child practised, and now they play. | public/charge.html:2013 |
| B45 | win.mp3 | You did it. Let's play. | The win: five tries heard and the last check passed. Spoken 600 ms after the win chime; the game loads 1.2 s later. | Quietly delighted. A full stop, not a fanfare. | public/charge.html:2140 |
| B46 | chest.mp3 | Look what we found. | The treasure chest at the end of the adventure: after the child's third tap opens it, 600 ms after the tap chime, while the sticker shows. | A small wonder, like peeking into a box together. | public/charge.html:2088 |
| B47 | adventure-end.mp3 | We finished the whole adventure. | Adventure end: when the fifth round's game hands back and the "Adventure complete!" card appears, 600 ms after its chime. | Proud and settled, winding down. | public/charge.html:2201 |
| B48 | quiet.mp3 | I couldn't hear you! Say it big — I'm all ears! | The quiet screen: a listening window ended with nothing heard. Mic already closed. Screen: "I couldn't hear you!" / "Say it big — I'm all ears!" with Try again / Maybe later. Tapping Try again reopens the mic without re-speaking the prompt. | Gentle and playful. This is the one line that kept its "!" on 24 Sep — "Say it big" is a production cue, so give it a little lift without shouting. Any rewording is Rachel's call. | public/charge.html:2116 |

Not in this list because they speak nothing: Home, setup, settings, the voice
picker, the five arcade games (Fruit Slice, Piano Tiles, Block Stacker, Sound
Sprint, Flappy Glide — their "Say “rrrr” to keep playing!" card is text only: arcade-slice.html:211, arcade-tiles.html:190, arcade-stack.html:173, arcade-run.html:167, arcade-glide.html:165),
the mic-permission screens, the chest captions and every in-round label. See E8.

---

## Part C — Templates, with every blank filled

These lines have a blank in them. The template comes first, then the fillers, then
the lines fully written out where the set is small enough to record as fixed clips.
Numbered like Part B so they can be ticked off.

### C1 — The first prompt of a sound-alone round

`Ready? {cue}, and make your {sound} sound, {n} times.` (public/charge.html:1938, built at public/charge.html:593)

Spoken once, into a closed mic, right after the mic opens and the room is measured.
Every session's first round is a sound-alone round, so a child hears this every day.
With the sound models on, `/coach/say-echo/{SOUND}.mp3` (Part A) plays instead (public/charge.html:629).

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

{n}: the number words the page knows are 2 → "two", 3 → "three", 4 → "four", 5 → "five", 6 → "six" (public/charge.html:587). The ones actually used: **five** on every normal prompt (`CHARGE_NEED = 5`, public/sona.js:1702) and **three** during a retry window after a miss (`burstAndVerify(3)`, public/charge.html:1986). The cued form can fire with "three" only when a syllable round stepped down to the sound and the child then tapped Echo.

Worth Rachel's eye: the comma/"like" cut leaves "Lips together" (B), "Like T" (D), "Like K" (G), "Like F" (V), "Teeth together" (S), "Pop it" (CH), "Like CH" (J) — a G round opens "Ready? Like K, and make your G sound, five times.". TH and THV are both spelled "T H", so only the cue tells them apart.

**All 38 lines.** Where the code says "make your R sound" you may perform the sound instead — that is the whole reason for a human recording. Delivery: even and calm; a short beat after "Ready?", the cue as a friendly reminder, the count plain.

| # | File | Say this | When | Source |
|---|---|---|---|---|
| C1 | prompt-P-cued-5.mp3 | Ready? Press your lips and pop a little puff, and make your P sound, five times. | First prompt of a P sound-alone round. | public/charge.html:593 |
| C2 | prompt-B-cued-5.mp3 | Ready? Lips together, and make your B sound, five times. | First prompt of a B sound-alone round. | public/charge.html:593 |
| C3 | prompt-M-cued-5.mp3 | Ready? Lips together and hum, and make your M sound, five times. | First prompt of a M sound-alone round. | public/charge.html:593 |
| C4 | prompt-N-cued-5.mp3 | Ready? Tongue up behind your teeth and hum, and make your N sound, five times. | First prompt of a N sound-alone round. | public/charge.html:593 |
| C5 | prompt-T-cued-5.mp3 | Ready? Tongue taps behind your top teeth, and make your T sound, five times. | First prompt of a T sound-alone round. | public/charge.html:593 |
| C6 | prompt-D-cued-5.mp3 | Ready? Like T, and make your D sound, five times. | First prompt of a D sound-alone round. | public/charge.html:593 |
| C7 | prompt-K-cued-5.mp3 | Ready? The back of your tongue pops up in the back, and make your K sound, five times. | First prompt of a K sound-alone round. | public/charge.html:593 |
| C8 | prompt-G-cued-5.mp3 | Ready? Like K, and make your G sound, five times. | First prompt of a G sound-alone round. | public/charge.html:593 |
| C9 | prompt-F-cued-5.mp3 | Ready? Top teeth on your bottom lip, and make your F sound, five times. | First prompt of a F sound-alone round. | public/charge.html:593 |
| C10 | prompt-V-cued-5.mp3 | Ready? Like F, and make your V sound, five times. | First prompt of a V sound-alone round. | public/charge.html:593 |
| C11 | prompt-S-cued-5.mp3 | Ready? Teeth together, and make your S sound, five times. | First prompt of a S sound-alone round. | public/charge.html:593 |
| C12 | prompt-Z-cued-5.mp3 | Ready? Teeth together and buzz, and make your Z sound, five times. | First prompt of a Z sound-alone round. | public/charge.html:593 |
| C13 | prompt-SH-cued-5.mp3 | Ready? Round your lips and whisper quiet, and make your S H sound, five times. | First prompt of a SH sound-alone round. | public/charge.html:593 |
| C14 | prompt-CH-cued-5.mp3 | Ready? Pop it, and make your C H sound, five times. | First prompt of a CH sound-alone round. | public/charge.html:593 |
| C15 | prompt-J-cued-5.mp3 | Ready? Like CH, and make your J sound, five times. | First prompt of a J sound-alone round. | public/charge.html:593 |
| C16 | prompt-L-cued-5.mp3 | Ready? Tongue tip up behind your top teeth, and make your L sound, five times. | First prompt of a L sound-alone round. | public/charge.html:593 |
| C17 | prompt-R-cued-5.mp3 | Ready? Pull your tongue back and up, and make your R sound, five times. | First prompt of a R sound-alone round. | public/charge.html:593 |
| C18 | prompt-TH-cued-5.mp3 | Ready? Peek your tongue between your teeth and blow soft, and make your T H sound, five times. | First prompt of a TH (as in 'thumb') sound-alone round. | public/charge.html:593 |
| C19 | prompt-THV-cued-5.mp3 | Ready? Tongue between your teeth and buzz, and make your T H sound, five times. | First prompt of a TH (voiced, as in 'the') sound-alone round. | public/charge.html:593 |
| C20 | prompt-P-cued-3.mp3 | Ready? Press your lips and pop a little puff, and make your P sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C21 | prompt-B-cued-3.mp3 | Ready? Lips together, and make your B sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C22 | prompt-M-cued-3.mp3 | Ready? Lips together and hum, and make your M sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C23 | prompt-N-cued-3.mp3 | Ready? Tongue up behind your teeth and hum, and make your N sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C24 | prompt-T-cued-3.mp3 | Ready? Tongue taps behind your top teeth, and make your T sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C25 | prompt-D-cued-3.mp3 | Ready? Like T, and make your D sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C26 | prompt-K-cued-3.mp3 | Ready? The back of your tongue pops up in the back, and make your K sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C27 | prompt-G-cued-3.mp3 | Ready? Like K, and make your G sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C28 | prompt-F-cued-3.mp3 | Ready? Top teeth on your bottom lip, and make your F sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C29 | prompt-V-cued-3.mp3 | Ready? Like F, and make your V sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C30 | prompt-S-cued-3.mp3 | Ready? Teeth together, and make your S sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C31 | prompt-Z-cued-3.mp3 | Ready? Teeth together and buzz, and make your Z sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C32 | prompt-SH-cued-3.mp3 | Ready? Round your lips and whisper quiet, and make your S H sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C33 | prompt-CH-cued-3.mp3 | Ready? Pop it, and make your C H sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C34 | prompt-J-cued-3.mp3 | Ready? Like CH, and make your J sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C35 | prompt-L-cued-3.mp3 | Ready? Tongue tip up behind your top teeth, and make your L sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C36 | prompt-R-cued-3.mp3 | Ready? Pull your tongue back and up, and make your R sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C37 | prompt-TH-cued-3.mp3 | Ready? Peek your tongue between your teeth and blow soft, and make your T H sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |
| C38 | prompt-THV-cued-3.mp3 | Ready? Tongue between your teeth and buzz, and make your T H sound, three times. | Same, tapped during a retry window (three tries). | public/charge.html:593 |

### C2 — The prompt again (tap on Echo)

`Ready? Make your {sound} sound, {n} times.` (tap: public/charge.html:1095; built at public/charge.html:593)

Every later prompt of the same sound-alone round: the child taps Echo ("Tap Echo to
hear it again"). With Rachel's clips on, the tap replays her clip instead.
**All 38 lines.**

| # | File | Say this | When | Source |
|---|---|---|---|---|
| C39 | prompt-P-5.mp3 | Ready? Make your P sound, five times. | Repeat prompt, P. | public/charge.html:593 |
| C40 | prompt-B-5.mp3 | Ready? Make your B sound, five times. | Repeat prompt, B. | public/charge.html:593 |
| C41 | prompt-M-5.mp3 | Ready? Make your M sound, five times. | Repeat prompt, M. | public/charge.html:593 |
| C42 | prompt-N-5.mp3 | Ready? Make your N sound, five times. | Repeat prompt, N. | public/charge.html:593 |
| C43 | prompt-T-5.mp3 | Ready? Make your T sound, five times. | Repeat prompt, T. | public/charge.html:593 |
| C44 | prompt-D-5.mp3 | Ready? Make your D sound, five times. | Repeat prompt, D. | public/charge.html:593 |
| C45 | prompt-K-5.mp3 | Ready? Make your K sound, five times. | Repeat prompt, K. | public/charge.html:593 |
| C46 | prompt-G-5.mp3 | Ready? Make your G sound, five times. | Repeat prompt, G. | public/charge.html:593 |
| C47 | prompt-F-5.mp3 | Ready? Make your F sound, five times. | Repeat prompt, F. | public/charge.html:593 |
| C48 | prompt-V-5.mp3 | Ready? Make your V sound, five times. | Repeat prompt, V. | public/charge.html:593 |
| C49 | prompt-S-5.mp3 | Ready? Make your S sound, five times. | Repeat prompt, S. | public/charge.html:593 |
| C50 | prompt-Z-5.mp3 | Ready? Make your Z sound, five times. | Repeat prompt, Z. | public/charge.html:593 |
| C51 | prompt-SH-5.mp3 | Ready? Make your S H sound, five times. | Repeat prompt, SH. | public/charge.html:593 |
| C52 | prompt-CH-5.mp3 | Ready? Make your C H sound, five times. | Repeat prompt, CH. | public/charge.html:593 |
| C53 | prompt-J-5.mp3 | Ready? Make your J sound, five times. | Repeat prompt, J. | public/charge.html:593 |
| C54 | prompt-L-5.mp3 | Ready? Make your L sound, five times. | Repeat prompt, L. | public/charge.html:593 |
| C55 | prompt-R-5.mp3 | Ready? Make your R sound, five times. | Repeat prompt, R. | public/charge.html:593 |
| C56 | prompt-TH-5.mp3 | Ready? Make your T H sound, five times. | Repeat prompt, TH (as in 'thumb'). | public/charge.html:593 |
| C57 | prompt-THV-5.mp3 | Ready? Make your T H sound, five times. | Repeat prompt, TH (voiced, as in 'the'). | public/charge.html:593 |
| C58 | prompt-P-3.mp3 | Ready? Make your P sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C59 | prompt-B-3.mp3 | Ready? Make your B sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C60 | prompt-M-3.mp3 | Ready? Make your M sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C61 | prompt-N-3.mp3 | Ready? Make your N sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C62 | prompt-T-3.mp3 | Ready? Make your T sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C63 | prompt-D-3.mp3 | Ready? Make your D sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C64 | prompt-K-3.mp3 | Ready? Make your K sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C65 | prompt-G-3.mp3 | Ready? Make your G sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C66 | prompt-F-3.mp3 | Ready? Make your F sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C67 | prompt-V-3.mp3 | Ready? Make your V sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C68 | prompt-S-3.mp3 | Ready? Make your S sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C69 | prompt-Z-3.mp3 | Ready? Make your Z sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C70 | prompt-SH-3.mp3 | Ready? Make your S H sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C71 | prompt-CH-3.mp3 | Ready? Make your C H sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C72 | prompt-J-3.mp3 | Ready? Make your J sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C73 | prompt-L-3.mp3 | Ready? Make your L sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C74 | prompt-R-3.mp3 | Ready? Make your R sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C75 | prompt-TH-3.mp3 | Ready? Make your T H sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |
| C76 | prompt-THV-3.mp3 | Ready? Make your T H sound, three times. | Repeat prompt during a retry window (three tries). | public/charge.html:593 |

### C3 — The prompt on a syllable, word or sentence round

`Ready? Say {target}, {n} times.` (public/charge.html:593; targets from `ladderContent`)

Round two onward of an adventure climbs sound → syllable → word → sentence, capped
one rung above what the child has mastered. One target per round; the same line
repeats on a tap. {n} as in C1. **Best left to TTS in the cloned voice** — the
blank is a word, and words render fine; only bare sounds do not. Listed so nothing
is hidden.

**{target} = a syllable** — the sound's onset plus ah / ee / oo / oh / ay (public/gamecontent.js:30); 19 × 5 = 95 (TH and THV share the same five):

| Sound | Syllables |
|---|---|
| P | pah, pee, poo, poh, pay |
| B | bah, bee, boo, boh, bay |
| M | mah, mee, moo, moh, may |
| N | nah, nee, noo, noh, nay |
| T | tah, tee, too, toh, tay |
| D | dah, dee, doo, doh, day |
| K | kah, kee, koo, koh, kay |
| G | gah, gee, goo, goh, gay |
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

**{target} = a word** — by default the sound's Beginning-position words (THV has none, so all ten); any other bank word reaches this prompt when an SLP's homework names it. The whole bank is Part D (public/sona.js:1416).

**{target} = a sentence** — one of 5 frames with a bank word dropped in (public/gamecontent.js:34): "I see a ___.", "I have a ___.", "Look at the ___.", "Here is a ___.", "I like my ___.". The word comes from the position chosen in Settings (default Beginning; "Mixed" opens the whole bank), so 5 × 356 = 1780 sentences are possible; not expanded here.

Two things for Rachel here: the frames are applied blindly, so "I have a rain" and "Here is a bathe" are reachable — the same carrier-phrase problem the word bank once had; and the sentence's own full stop survives into the prompt ("Ready? Say I see a robot., five times." — `display` keeps it), harmless for TTS, but a recording should drop it.

### C4 — Hear it slooow (the turtle)

Not a separate recording. The turtle pill replays the current line slowed to 0.7× by the app (public/charge.html:780); on a sound-alone round that is the C1/C2 text, on any other round it is just the target — syllable, word, or sentence without its full stop (public/charge.html:1088). Always the TTS text today, even with Rachel's clips on; if recordings ship, the turtle needs to slow the recording.

### C5 — Echo's idea, with a syllable or a word

`I have an idea. Let's try this one. Say {target}.` (public/charge.html:2005)

The step-down after two misses on a word or sentence round: {target} is a syllable
(C3 list) or a Beginning-position word (Part D) from one rung down. (Rarely — the
fifth round for a child who has already mastered sentences — it can be a sentence.)
The sound-alone form is fixed and sits in B3. Best left to TTS.

### C6 — Feed Echo

`Where is the {word}? Say... {word}.` (public/arcade-feed.html:401)

Live, free, opened straight from Home. Echo asks this at the start of each of the
five turns, before the child taps one of four pictures; nothing is spoken on a right
tap, a wrong tap or at the finish. The sound is the one the child's rotation is on that
round (homework sounds first, else the child's focus sounds, else R); the pool is that sound's shortest
eight Beginning-position words with a picture (public/arcade-feed.html:221). The screen says "Where's" while the voice says "Where is".

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

134 lines if recorded as fixed clips (`feed-<word>.mp3`); best left to TTS.

---

## Part D — The word bank

Every practice word, by sound and by where the sound sits in the word (public/sona.js:1416).
**Best left to TTS in the cloned voice** — words render fine; only bare sounds do
not. Listed so nothing is hidden, and because a word can reach the child three ways:
the word rung of a practice round (Beginning words by default; any word an SLP's
homework names), the sentence rung (the position chosen in Settings), and Feed Echo
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

The books were parked on 19 Sep 2026 ("coming soon" on Home); `tests/day1.mjs` pins that Home has no door. When the page opens, each page is read aloud as it turns — the chapter's opening line, then its six beats (public/chapter.html:122, public/chapter.html:172); "Read it to me" says the same page again (public/chapter.html:201). Tomorrow's hook is shown on the finish card, not spoken. The table is `EPISODES` (public/sona.js:683). Read as a bedtime story if they ever come back: slower than the prompts, the last line of each page landing softly.

One fixed line: "You did it! Three games are unlocked." — the finish card (public/chapter.html:194). Still has its "!" — the parked pages never got the calm rewrite.

**Chapter 1 — The Star That Fell** (public/sona.js:684)

1. You are in the meadow when the sky drops something. It lands in the tall grass with a soft whump. The grass around it starts to glow.
2. It is a star. A small one, about the size of your two hands together. It is shaking.
3. Echo lands beside it and says hello. The star does not answer. Stars do not know words yet.
4. But when you speak, the star brightens. It has never heard a voice before. It likes yours.
5. The more you say, the warmer it gets. Warm stars can float. Cold ones cannot.
6. It lifts off the grass. Just a little. Just enough to show you it wants to go home.
7. Home is a very long way up. Echo looks at the sky, then at you. This is going to take a while.

**Chapter 2 — The Bramble Path** (public/sona.js:696)

1. The only way out of the meadow is one narrow path. Overnight, the brambles have grown all the way across it.
2. Thorns as long as your finger. Echo tries to squeeze through and comes back with one feather missing.
3. The star floats up to look. From above, the path is a green tangle with no gap anywhere in it.
4. Then the star does something new. It hums one low note, and a single bramble curls away from the sound.
5. So you help. Every sound you make bends another branch back, and a gap opens up in the green.
6. You go through in a line. Echo first, then you, then the star bobbing along behind.
7. On the other side there is a noise like a hundred spoons in a hundred cups. Water. A lot of water.

**Chapter 3 — The River Crossing** (public/sona.js:708)

1. The river is wide, loud, and moving fast. There is no bridge. There is no boat. There is just you.
2. The star floats out over the water to have a look, and the wind pushes it straight back to you.
3. Echo spots something under the surface. Flat stones, one after another, like a path somebody hid on purpose.
4. They are too deep to stand on. But when you speak, the nearest one rises up out of the water.
5. One stone at a time. A sound, a stone, a step. A sound, a stone, a step.
6. Halfway across, a fish comes up beside you and just listens. Then another one. Then eleven more.
7. You reach the far bank with wet shoes and a small crowd of fish watching you go.

**Chapter 4 — The Whispering Woods** (public/sona.js:720)

1. The trees here are old and standing close together. Say one word and the woods say it back to you, twice.
2. Echo goes absolutely wild. A parrot in a place that repeats things is a parrot in heaven.
3. The star hides in your pocket. It is not used to hearing itself yet.
4. You try a sound. The woods answer. You try another one. The woods answer that one too.
5. Then a third voice joins in. Small, wobbly, half a beat behind. That one is not a tree.
6. Something is following you and copying you. Echo stops laughing and steps in front of you.
7. It comes out of the ferns. It is about the size of a teacup, and it is extremely fluffy.

**Chapter 5 — Pip** (public/sona.js:732)

1. It is a baby owl. It has one feather sticking straight up off its head, and it will not stop staring at you.
2. Echo asks its name. The owl copies the question back instead of answering it. It is learning too.
3. You make a sound. The owl tries the same one. It comes out sideways, but it comes out.
4. You make it again. This time the owl lands much closer to it, and its one feather quivers with the effort.
5. You share your snack. The owl decides you are family now and climbs into your hood.
6. Echo names it Pip, on the grounds that it makes a sound like pip whenever it is pleased.
7. Pip points a wing at the hills. There is a black opening in the rock, and the path goes straight into it.

**Chapter 6 — The Cave of Echoes** (public/sona.js:744)

1. Inside the cave it is black. Not dim. Black. You cannot see your own hands in front of you.
2. Then Pip makes one small nervous pip, and a ring of blue light spreads across the ceiling.
3. The rock in here answers sound with light. Every noise you make lights up the part of the wall it touches.
4. So you talk your way in. The cave glows ahead of you, one patch at a time, like stepping stones made of light.
5. The star sits on your shoulder and hums along. Between the two of you, it is almost bright.
6. The light reaches a wall that is not rock. It is flat, and somebody has drawn on it.
7. Hundreds of drawings. And in every single one, somebody is holding a star.

**Chapter 7 — The Drawings** (public/sona.js:756)

1. The drawings go on for further than you can walk in one go. They tell a story, left to right, like a very long comic.
2. First panel: a person in a meadow, and a star falling out of the sky. That one looks familiar.
3. Then a river. Then woods. Then a cave, with a small round shape riding on somebody's shoulder.
4. Pip looks at the shoulder shape, then down at itself, then back at the shoulder shape.
5. The last panel is a ladder. It starts on the ground and it goes up and up into the clouds.
6. There is no drawing of what happens after the ladder. Whoever drew all this never came back to finish it.
7. Echo is very quiet, which for a parrot is unusual. Then Echo says: well. We had better go and look.

**Chapter 8 — The Cloud Ladder** (public/sona.js:768)

1. The ladder is exactly where the drawing said it would be. Rungs of white cloud, going up and up until they are too small to see.
2. Echo tests the bottom rung with one foot. It goes straight through it. Cloud is cloud.
3. Then the star drifts down and rests on the rung, and the cloud puffs solid, like bread rising.
4. Warmth is what makes cloud firm. And your voice is what keeps the star warm.
5. So you climb and you talk. Rung, sound, rung, sound. The meadow shrinks to a green thumbprint underneath you.
6. Pip refuses to fly and rides in your hood the whole way, which is somehow more tiring for you than for Pip.
7. Near the top the air changes. It is moving. It is moving very fast.

**Chapter 9 — The Windy Ridge** (public/sona.js:780)

1. The top of the ladder comes out on a thin ridge of cloud, and the wind up here does not stop for a second.
2. It pulls at your sleeves. It pulls at Echo's tail. It pulls sounds right out of the air and carries them off sideways.
3. The star dims. Up here it is losing warmth faster than you can give it back.
4. So you tuck it inside your coat, against you, where the wind cannot get at it.
5. It works. You can feel it glowing through the fabric, steady as a heartbeat.
6. Pip flies ahead to scout, gets blown backwards past your head, and returns to the hood without comment.
7. Through the blur you see it. Something enormous standing out in the open sky, and the wind is going around it.

**Chapter 10 — The Sky Door** (public/sona.js:792)

1. It is a door. It is taller than a tree and it is standing in the open air with nothing holding it up.
2. No handle. No lock. No keyhole. Carved in the middle of it, at exactly your height, there is an ear.
3. Echo knocks. Nothing. Pip pips at it. Nothing. The star bumps into it and slides slowly down.
4. So you lean close to the carved ear, and you say something to it.
5. The door listens. That is the whole trick. It has been waiting a very long time for somebody to talk to it.
6. It swings open onto the night sky, closer than you have ever seen it, every star the size of a lamp.
7. Your star leaps out of your coat and races for a gap in the pattern. And that is when you see the other gaps.

**Chapter 11 — The Star Comes Back** (public/sona.js:808)

1. Your star is home. It sits in its gap in the sky, blazing away, exactly the right shape for the space it left.
2. You are about to go when it pops straight back out of the gap and lands on your shoulder.
3. Echo says that is not how going home works. The star does not appear to care.
4. Then you look properly at the sky, and you understand why it came back.
5. There are gaps everywhere. Dark shapes where stars should be. You count them twice to be sure.
6. Eleven. Eleven stars that fell somewhere and never got back up.
7. Pip is already looking down through the open door. Somewhere under all that cloud, eleven lights are waiting.

**Chapter 12 — The Lantern City** (public/sona.js:820)

1. You come down out of the clouds over a city made of lanterns. Thousands of them, strung between the rooftops, glowing orange.
2. It is night here, but nobody has noticed. In a city of lanterns, night is just when the lights look nicer.
3. Echo asks a pigeon for directions. The pigeon is not helpful. Pigeons rarely are.
4. Then Pip pips once, and the two of you see it at the same time.
5. One lantern in the middle of the city is far, far too bright. Nobody has thought to ask why.
6. It is up at the very top of the tallest post, above all the washing lines and the cats.
7. So you start to climb. Twelve floors of ladders and roof tiles, and the light gets whiter the higher you go.

**Chapter 13 — The Longest Night** (public/sona.js:832)

1. At the top of the post, inside a glass lantern the size of a bathtub, a star is sitting with its arms around its knees.
2. It has been in there so long that it thinks the lantern is the sky.
3. The glass is warm. When you speak near it, the star turns its head.
4. It will not come out. Everything out there is dark and everything in here is bright, and it is not moving.
5. So you sit down on the roof tiles and you talk to it. Not to make it do anything. Just so it is not on its own.
6. The glass cools. The star stands up. It comes over to the little door in the side and looks out at you.
7. As it steps out, every lantern in the city dims by exactly the same amount, and for the first time in years the people below look up.

**Chapter 14 — Under the Ice** (public/sona.js:844)

1. A frozen lake, flat and grey and bigger than the city was. Under your boots you can hear the ice creak.
2. Something down there is glowing green through the ice, about the size of a dinner plate.
3. It is not green. It is a star, and the ice is what is making it look that way.
4. Echo taps the surface with one claw. The ice is thicker than Echo is tall.
5. But your two stars are warm. You lie flat and hold them against the surface, and the ice begins to give.
6. A hole opens, no bigger than a plate. The green light comes up through it and turns gold in the air.
7. Three stars now. Pip's hood is getting crowded, and Pip is very clear about it.

**Chapter 15 — The Music Box** (public/sona.js:856)

1. The house has been empty a long time. The attic ladder comes down when you pull it, and dust falls on all three of you.
2. In the corner, under a sheet, something is playing. Six notes, over and over, very slowly.
3. It is a music box. The lid is shut, and the little brass key on the back is turning all by itself.
4. Echo lands on the lid and gets carried around in a slow circle, which Echo finds undignified.
5. You lift the lid. Inside, where the dancer should be, there is a star going round and round.
6. It has been keeping time in here for years. Nobody ever told it how to stop.
7. So you learn the six notes and say them back, and on the last one the star steps off the spindle and into your hand.

**Chapter 16 — The Orchard** (public/sona.js:868)

1. Rows and rows of trees, all the same height, all quiet. Somewhere in the middle, one branch is bent almost to the ground.
2. On the end of it hangs a fruit the size of your head, and it is glowing faintly through the skin.
3. Echo tries to eat it. Echo is stopped.
4. You cut it down carefully. It is warm in your hands, and heavier than a fruit has any business being.
5. Inside there is a star, curled up, fast asleep. It fell in the spring and the tree simply grew around it.
6. You wake it the polite way, which is with your voice and not with your hands.
7. The branch springs straight the moment the fruit leaves it, and every other tree in the row shivers once, in order, all the way down.

**Chapter 17 — The Ferry** (public/sona.js:880)

1. The road ends at the sea. There is a jetty, and a boat, and a very large creature asleep across the whole of it.
2. It has whiskers like broom handles and it is snoring in a way that moves the water.
3. Echo suggests going around. There is no around. There is sea in both directions as far as anybody can see.
4. Pip lands on its nose. One eye opens. The eye is the size of a dinner plate and it looks straight at you.
5. It is the ferry. It has been the ferry for a very long time, and nobody has asked it for a ride in years.
6. You share what is left of your food, and you tell it where you are going and why.
7. It slides off the jetty without a word and floats there, waiting, with its back flat like a raft.

**Chapter 18 — The Deep** (public/sona.js:892)

1. Out where the water goes from green to black, the ferry stops and points its nose straight down.
2. Far below, so far it might be your eyes making it up, there is one small light.
3. You cannot swim that deep. Nobody can. But your four stars can, and they will not go without you.
4. So they make a bubble. Four stars in a ring, warm air between them, and you inside it, going down.
5. Kelp closes over the top. Fish you have no names for come to look at you, and then leave again.
6. The light gets bigger. It is shut inside a shell the size of a door.
7. You say something to the shell, the way you did to the sky door, and it opens without any fuss at all.

**Chapter 19 — The Nest** (public/sona.js:904)

1. On the cliffs above the beach there is a nest, and the nest is glittering.
2. Bottle caps. Spoons. A watch. A doorknob. And near the middle, two lights that are none of those things.
3. Pip goes completely still, the way small birds do when a big bird is somewhere close.
4. It lands behind you. It is black and enormous and its head tilts all the way over to look at you.
5. It is not angry. It just likes bright things, and two of the brightest things it ever found were lying in a field.
6. So you trade. You give it the shiniest thing you are carrying, which is the little brass key off the back of the music box.
7. It takes the key, and it lets you take the two stars, and it watches you the whole way down the cliff path.

**Chapter 20 — The Loose Thread** (public/sona.js:916)

1. Seven stars now. They ride in a loose cloud around your head, and you have stopped being able to count them without help.
2. You are walking back towards the cloud ladder when Echo stops dead in the air.
3. Hanging down out of the sky, swaying, there is a single silver thread. It goes up further than you can see.
4. You touch it. It hums the same six notes as the music box, and every star you are carrying hums back.
5. Echo says the thing you are both thinking. The sky is not a picture. The sky is something somebody made.
6. And somewhere up there a thread has come loose, and the stars have been slipping through the gap it left.
7. The thread twitches once, all on its own, as though something at the far end of it just noticed you holding on.

**Chapter 21 — Following the Thread** (public/sona.js:932)

1. You wrap the thread around your hand and it lifts, gently, the way a kite pulls just before it goes.
2. The ground drops away. The orchard, then the lake, then the lantern city, all of it going small underneath you.
3. Pip flies alongside for the first time in the whole journey, which Pip would like noted.
4. The stars come too, in a long line behind you, like beads on a string.
5. Above the clouds the thread stops being silver and starts being light, and it is warm to hold.
6. You go up through the place where the sky door was and out the other side, and there is no other side. There is just more sky.
7. The thread ends at a stair. A spiral stair with no building around it, going up into the dark.

**Chapter 22 — The Weaver's Stair** (public/sona.js:944)

1. The stair is made of the same silver as the thread, and every step gives a little under your weight, like rope.
2. There is no rail. There is nothing to fall onto either, which Echo points out and immediately regrets pointing out.
3. You climb. The stars go on ahead and light three steps at a time.
4. Halfway up, you pass a step with a bird's nest on it. Old, empty, and very carefully made.
5. Pip looks at that nest for a long moment and does not say anything at all.
6. The stair narrows near the top, until it is one step wide and you are going up it sideways.
7. Then the dark opens out, and there is a room, and in the room there is a loom the size of a house.

**Chapter 23 — The Weaver** (public/sona.js:956)

1. She is very old and very small, and she is sitting at the loom with her hands in her lap, not weaving.
2. The cloth on the loom is the night sky. You are seeing it from underneath, which nobody has ever done.
3. She says hello without turning around. She says she wondered when somebody would come.
4. Echo, for once, has nothing to say. Pip climbs out of your hood and sits on the arm of her chair.
5. There is a gap in the weave the size of a door. Around it, threads hang loose in every direction.
6. She has not stopped because she is tired, although she is. She has stopped because she cannot do it on her own any more.
7. You put your seven stars down on the floor of the room, and the whole place fills up with light.

**Chapter 24 — What the Loom Needs** (public/sona.js:968)

1. She picks up the shuttle and holds it out to you. It is wooden, worn smooth, and lighter than it looks.
2. She says the loom does not run on hands. It never has.
3. She sings one note, and a thread pulls itself across the frame and lies down flat.
4. That is why the stars go warm when you talk to them. That is why the door opened. That is why the cave lit up.
5. The whole sky is woven out of sound, and it has been quiet up here for a very long time.
6. Her voice went a while ago. That is the night the thread came loose, and every night since has been a little darker.
7. She puts the shuttle into your hand and closes your fingers around it, and she does not say anything else.

**Chapter 25 — The Eighth Star** (public/sona.js:980)

1. You find the eighth star before you work out how to weave. It is tangled in the loose threads at the edge of the gap.
2. It has been stuck there since the night it slipped, holding on so it would not fall like the others.
3. The threads have grown right around it, the way the orchard tree grew around its fruit.
4. You work it free one strand at a time while it hums the six notes at you, over and over, nervously.
5. When it comes loose it does not fly off. It stays exactly where it is, because it is already in its own place.
6. One star back in the sky, and the smallest patch of the dark shape closes up around it.
7. The Weaver laughs, which is a sound like a door that has not been opened in years.

**Chapter 26 — The Unravelling** (public/sona.js:992)

1. You wake up to a sound like a zip. Along the far edge of the loom, the weave is coming apart on its own.
2. Threads are letting go one after another, faster than anybody could tie them back.
3. Through the widening gap you can see the ground, extremely far away, and none of it is cloud.
4. Echo goes one way and Pip goes the other and you go straight down the middle, catching threads.
5. You get six of them in one fist and it is nowhere near enough. There are hundreds.
6. Then the Weaver says your name, and tells you to stop grabbing and start talking.
7. So you do. And the threads you speak to stop moving, and hang still, and wait.

**Chapter 27 — The Two in the Dark** (public/sona.js:1004)

1. There is a corner of the sky where three stars fell on the same night, and nothing has ever been put back.
2. It is the darkest place you have ever stood. Darker than the cave, because in the cave there was rock to touch.
3. Your stars will not go in. They hang at the edge of it, dimming, like a hand held over a candle.
4. So you go in without them, with Pip on your shoulder and Echo somewhere just above your head.
5. You find the first one by sound. It has been humming the whole time, very quietly, for a very long while.
6. The second one is holding on to the first one and will not let go, so you carry the pair of them together.
7. Coming out, you count. Two in your arms. One still missing. And no corner of the world left that you have not looked in.

**Chapter 28 — The Last One** (public/sona.js:1016)

1. You look everywhere for the eleventh star. The Weaver studies the sky from underneath. Echo asks every bird between here and the sea.
2. Nothing. Ten found, one gap left, and not one single idea between the four of you.
3. Then Pip flies off without telling anybody, which Pip has never once done, and is gone until morning.
4. Pip comes back with a single blade of grass in its beak. Long, green, and slightly scorched at the tip.
5. You know that grass. You have sat in that grass. It is the meadow, from the very first night.
6. The last star never went anywhere at all. It landed where the first one landed, on the same night, and it has been under the grass ever since, waiting for somebody to come back for it.
7. It is small and it is cold, and when you pick it up it fits in one hand, exactly the way the first one did.

**Chapter 29 — The Long Way Back Up** (public/sona.js:1028)

1. Ten stars. You have ten stars and one spiral stair, and the stair is one step wide at the top.
2. Echo carries two, badly. Pip carries one and will not be talked out of it.
3. The rest go in your coat, in your hood, and in both hands, and you go up sideways the way you did before.
4. Halfway, at the step with the old nest on it, you stop to rest and count them all again.
5. Pip puts its star down in the nest for a moment, just to see how it looks. It looks very good.
6. Then Pip picks it up again, because it is not Pip's star, and there is a sky waiting for it.
7. At the top, the Weaver has the loom open and the shuttle ready. She has been up all night clearing the frame.

**Chapter 30 — The Sky, Mended** (public/sona.js:1040)

1. The gap in the weave is the size of a door, and there are ten stars sitting on the floor of the room waiting to go through it.
2. The Weaver cannot sing it shut. You already knew that. It is the reason you are the one holding the shuttle.
3. So you say the first thing that comes into your head, and a thread lies itself flat across the frame.
4. Then another. Then another. It is slow, and it is not neat, and it holds.
5. One at a time the stars step up into the weave and find their gaps, and one at a time the dark shapes close.
6. The last one is the star from the meadow. It waits until the very end. Then it goes up, and the sky is whole.
7. From underneath, the new patch does not match. It is brighter than the rest, and rougher, and the Weaver says that is how everybody will know that somebody mended it.

### E2 — Your Adventure (`story.html`, parked)

Reachable only from the parked books page and gated behind `Sona.gated('story')`. Each page is read aloud when it opens (public/story.html:236) and on "Hear it" (public/story.html:291); then "Now you! Say... {word}!" (public/story.html:238); a heard try gets one of the five praise lines (public/story.html:262); a missed one gets the bare word again (public/story.html:271). The pages are normally an AI-written story from `/api/story` — unbounded text that cannot be pre-recorded. The fallback pages are 5 frames with a bank word (public/gamecontent.js:41): "Once, Echo saw a ___.", "He really liked the ___.", "Then came a big ___.", "Echo and the ___ played all day.", "What a fun ___!".

### E3 — Books (`library.html`, parked): 13 books, 78 pages

Cover: "{title}! A story full of {sound} sounds." (public/library.html:448) — the sound is read as its letter, "R sounds". Each page is read aloud as it opens and on "Hear it" (public/library.html:478, public/library.html:490); tapping any word says that word (public/library.html:476); the word box at the bottom says any bank word alone (public/library.html:517). Last page: "The end! Great listening!" (public/library.html:460).

**Rory the Rabbit** — R (public/library.html:142)

1. Rory the rabbit rides a red rocket.
2. The rocket roars over the rainbow.
3. Rory sees a robot on a rock.
4. The robot gives Rory a ring.
5. They race around the river.
6. Rory roars: hooray, hooray!

**Reba the Robot** — R (public/library.html:149)

1. Reba the robot runs on a road.
2. Reba rolls past a red rose.
3. A rabbit races right by.
4. Reba wraps it in a ribbon.
5. Rain! They run for the roof.
6. Reba the robot: ready, ready!

**Ruby the Rooster** — R (public/library.html:156)

1. Ruby the rooster rises at dawn.
2. Ruby crows: rise and shine!
3. She runs around the red barn.
4. Ruby finds a wriggly worm.
5. The rooster pecks rows of corn.
6. Ruby rests. What a great run!

**Remy the Raccoon** — R (public/library.html:163)

1. Remy the raccoon roams the river.
2. He reaches under a round rock.
3. Remy grabs a ripe, red grape.
4. He rows a raft in the rain.
5. Remy rests in the reeds.
6. Remy the raccoon: hooray!

**Rex the Rhino** — R (public/library.html:170)

1. Rex the rhino runs really fast.
2. He roars down the rocky road.
3. Rex rolls in the rich, green grass.
4. He reaches for a red apple.
5. Rex meets a friendly rabbit.
6. Run, Rex, run! Hooray!

**Sunny the Seal** — S (public/library.html:177)

1. Sunny the seal sits in the sun.
2. Sunny sees a silly snake.
3. The snake slides on the soft sand.
4. They sip soup with a silver spoon.
5. Sunny sings a silly song.
6. So sleepy! Sunny says goodnight.

**Lily the Lion** — L (public/library.html:184)

1. Lily the lion licks a lemon lollipop.
2. Lily leaps over a little log.
3. A ladybug lands on a leaf.
4. Lily laughs: la la la!
5. They look at a yellow balloon.
6. Lily loves to play all day.

**Kiki the Koala** — K (public/library.html:191)

1. Kiki the koala bakes a cake.
2. A kind king comes with a key.
3. The king flies a colorful kite.
4. Kiki gives the king a cookie.
5. A cat and a cow come to play.
6. What a cool day for Kiki!

**Shelly the Sheep** — SH (public/library.html:198)

1. Shelly the sheep shines her shoes.
2. She shows a shiny shell to a fish.
3. They sail on a big ship. Shhh!
4. Shelly makes a wish on a star.
5. She sips a milkshake — so fresh.
6. Shhh… Shelly is sleeping now.

**Charlie the Chick** — CH (public/library.html:205)

1. Charlie the chick chews chewy cherries.
2. Charlie rides the choo-choo train.
3. He munches cheese at lunch.
4. A chipmunk sits on a chair.
5. They share chocolate chips. Crunch!
6. Charlie chirps: cheep, cheep, cheep.

**Theo the Sloth** — TH (public/library.html:212)

1. Theo the sloth thinks happy thoughts.
2. Theo counts: one, two, three!
3. He gives a big thumbs up.
4. Theo brushes his three teeth.
5. Then a warm bath — both feet in.
6. Thank you, moon. Theo says goodnight.

**Gus the Goat** — G (public/library.html:219)

1. Gus the goat grows a green garden.
2. A goose gives Gus a gift.
3. Gus plays a goofy guitar.
4. They gobble grapes by the gate.
5. A bug giggles on the grass.
6. Good game, Gus. Goodnight!

**Fifi the Fox** — F (public/library.html:226)

1. Fifi the fox finds four feathers.
2. Fifi feeds a funny fish.
3. They warm five feet by the fire.
4. A butterfly flies fast — wow!
5. Fifi has fun with her friends.
6. Fifi waves: farewell, farewell!

### E4 — Bubble Pop and Peekaboo (`simple-play.js`, parked)

Both are "coming soon" in the catalog and their Home cards are disabled. The only spoken line is the bare **{word}** when the bubble pops or the door opens, and on "Hear it" (public/simple-play.js:305) — the same per-sound pools as Feed Echo (C6).

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
| [excited] Well HI, {name}! I'm Echo! I've been waiting ALL day to meet you! | public/coach-call.html:283 | opener |
| [excited] Well HI, {name}! I was hoping you would call me all day! | public/coach-call.html:284 | opener |
| [excited] {name}! There you are! I told {buddy} how amazing your {letter} sound was last time — he almost didn't believe me! | public/coach-call.html:286 | opener |
| [excited] Back already?! Best part of my day. I think your {letter} sound got stronger overnight! | public/coach-call.html:287 | opener |
| [excited] {name}! I missed you! I kept your spot on my branch warm. | public/coach-call.html:288 | opener |
| First, a big dragon breath. [whispers] Breathe in… and blow it out. One more big one… [happy] Wonderful! | public/coach-call.html:291 | warmups |
| Warm-up time! Wiggle your lips — blblblbl! Now a big lion yawn… aaah. [happy] Perfect. Your mouth is awake! | public/coach-call.html:292 | warmups |
| Quick! Drumroll on your knees… faster… and FREEZE. [whispers] Wow, you're so focused today. | public/coach-call.html:293 | warmups |
| [happy] This was my favorite call ALL day. Practice in the games, and call me again soon. Bye bye, superstar! | public/coach-call.html:296 | byes |
| [happy] {buddy} says thank you for the lesson! Same branch, next call? Bye bye, {name}! | public/coach-call.html:297 | byes |
| [happy] Case closed, detective {name}! Go play the games — I'll be listening for that famous {letter} sound. Bye bye! | public/coach-call.html:298 | byes |
| {buddy} is on the call too! [whispers] Psst — {buddy} keeps getting the {letter} sound wrong. Can you teach him? | public/coach-call.html:301 | Echo says |
| Show {buddy} your very best your {letter} sound, three times. Teach him. Go! | public/coach-call.html:302 | ask |
| [excited] LOOK! {buddy} just said it! You TAUGHT him, {name}! You're a {letter} teacher now! | public/coach-call.html:303 | if the try passed |
| Almost! {buddy} is watching your mouth. {cue} — go again! | public/coach-call.html:303 | if the try missed |
| Word time! Say {word1}, three times. Go! | public/coach-call.html:306 | ask |
| That was a PERFECT {word1}! | public/coach-call.html:307 | if the try passed |
| So close! Break it in half with me — {word1}. Again, go! | public/coach-call.html:307 | if the try missed |
| One more word. Say {word2}, three times. Go! | public/coach-call.html:308 | ask |
| You are on FIRE today! | public/coach-call.html:309 | if the try passed |
| Good trying! That one's tricky — we'll practice it in the games too. | public/coach-call.html:309 | if the try missed |
| Last one. Show me how BIG-KID {name} says it — one giant your {letter} sound. GO! | public/coach-call.html:311 | ask |
| THERE it is! That's the big-kid sound right there! | public/coach-call.html:312 | if the try passed |
| I heard it in there! It's getting stronger every single day. | public/coach-call.html:312 | if the try missed |
| Okay, {name}, listen to MY practice today: wuh… wuh… [curious] hmm. That is NOT the {letter} sound, is it? | public/coach-call.html:319 | Echo says |
| Fix me! Say the REAL your {letter} sound, three times, so I can copy you. Go! | public/coach-call.html:320 | ask |
| [laughs] THAT'S the one! No wonder you're the teacher around here. | public/coach-call.html:321 | if the try passed |
| Ooh, close! {cue}. Show me again — go! | public/coach-call.html:321 | if the try missed |
| Today we're sound detectives. [whispers] The mystery sound is… the {letter} sound! Here's my evidence: | public/coach-call.html:326 | Echo says |
| Case number one: say your {letter} sound three times so I know you're on the case. Go! | public/coach-call.html:327 | ask |
| [excited] Case CRACKED! You're the best detective I know. | public/coach-call.html:328 | if the try passed |
| Hmm, the clue slipped away! {cue} — go! | public/coach-call.html:328 | if the try missed |
| Clue word! Say {word1}, three times. Go! | public/coach-call.html:329 | ask |
| Another clue solved! | public/coach-call.html:330 | if the try passed |
| Tricky clue! We'll crack it in the games too. | public/coach-call.html:330 | if the try missed |
| Today is {letter} day! I have been practicing SO hard. Want to hear my try first? | public/coach-call.html:335 | Echo says |
| Now the real expert. Say your {letter} sound three times so I can hear how it's really done. Go! | public/coach-call.html:336 | ask |
| [excited] WOW. That was even better than I imagined! | public/coach-call.html:337 | if the try passed |
| Ooh, so close! {cue}. One more time — go! | public/coach-call.html:337 | if the try missed |
| I couldn't hear you that time — scoot a little closer and we'll keep going! | public/coach-call.html:356 | runStep |
| {praise} — one of the five praise lines (fallback "You got it!") | public/coach-call.html:363 | a retry passed, or the check could not tell |
| You know what? That try made {buddy} smile. We'll get it next call! | public/coach-call.html:364 | runStep |
| {praise} — one of the five praise lines (fallback "Nice one!") | public/coach-call.html:365 | a retry passed, or the check could not tell |

### E7 — Dead code: never spoken

- **The idle nudge** (public/charge.html:1599): would replay the prompt after 8 s of silence, up to twice. `armIdle()` is defined but never called; the not-heard path is the quiet screen (B4).
- **"You did it."** (public/charge.html:2009): fallback praise only if `praiseLine` were missing — `sona.js` always provides it.
- **"Let's try our {sound} sound again"** (public/charge.html:1980): fallback coaching only for a sound with no tip — all 19 have one.
- **"Listen to Echo, then copy the sound!"** (public/sona.js:2832): the default cue for an unknown sound; the practice page forces the sound to one of the 19.
- **`actionCue`, `repeatCue`, `coachLine`** (public/sona.js:2896, public/sona.js:2901, public/sona.js:2912): exported, no caller anywhere. Pre-calm wording — e.g. "Are you ready? Say rrrr 5 times!", "Repeat after me… rrrr!  Now you try — rrrr!", "Let's try again. Say rrrr! Pull your tongue back and up like a tiger growl — rrr!".
- **The conversation rung** (public/gamecontent.js:47): "Which do you like — a ___ or a ___?", "Do you want the ___ or the ___?", "Pick one — ___ or ___!", "Hmm… a ___ or a ___?" — the practice page keeps only items with a target (`it.t`) and these have none, so a conversation round falls back to the bare sound.
- **The sound models as text** (public/sona.js:2888): puh, buh, mmm, nnn, tuh, duh, kuh, guh, ffff, vvvv, sss, zzz, shhh, chuh, juh, lll, rrrr, thhh, thuh — shown on screen, never sent to TTS, because a synthesized "rrrr" comes out mangled. The performed sound is Rachel's clip (Part A).

### E8 — Shown on screen, never spoken (so nobody records them by mistake)

The mic primer ("Let Echo hear you practice!"), the "That's okay!" decline card, the
mic-denied screen ("Echo can't hear you yet!"), the grown-up variant of the quiet
screen ("Let's get a grown-up" / "Another app may be using the microphone"), the
"Adventure complete!" / "See you next time!" cards, the chest captions ("A treasure
chest! Tap, tap, tap to open!", "Tap, tap!", "One more tap!", "You found the {sticker}
sticker!"), the in-round labels ("Say", "Almost! {cue} —", "Try again — you've got
this!", "Echo's idea — say", "YES! That's the one!", "Here we go!", "Say it {n}
times", "Just 1 more!", "Tap Echo to hear it again", "Your turn", "Listen to Echo"),
the games' "Say “rrrr” to keep playing!" card and their end cards, and Feed Echo's
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

**Totals.** Part A: 19 sound models (38 files, Rachel's). Part B: **48 fixed clips** to record. Part C: **76 template lines written out** (C1 38 + C2 38) plus 272 fillers listed (19 cues, 19 sound names, 95 syllables, 5 sentence frames, 134 Feed Echo words). Part D: **356 bank entries, 294 distinct words** (TTS). Part E: 362 parked/unlinked lines not to record (210 chapter pages, 78 book pages, 43 Coach Call, 9 Speech Check, the rest single lines).

Record B first (48 lines — an hour), then C1 and C2 (76 lines, where you perform the sound), and stop there: Parts C3–C6 and D are words, and words are what TTS already does well.
