# The 19 clips

Everything Leo says in Sona is generated except one thing: **the sound itself.**
TTS cannot perform a bare phoneme — a synthesized two-second "rrrr" comes out
mangled — which is why every isolation prompt currently says "make your R sound"
instead of modelling it. Nineteen human recordings fix that, and nothing else in
the app needs a human voice.

Session length: **~15 minutes.** One take per sound.

## Setup

- Quiet room. No fan, no AC, no dishwasher, phone on Do Not Disturb.
- Voice Memos is fine. Hold the phone about a hand's width from the mouth and
  **do not move it between sounds** — all 19 need the same distance and level.
- Record all 19 into **one long file** with a couple of seconds of silence
  between. Don't try to make 19 separate recordings; I'll cut them.

## What to say

Nothing but the sound. No "okay — R", no lead-in, no "like this." Each clip gets
spliced between TTS words, so any extra syllable lands in the middle of a
sentence.

**Stretchers (11) — hold it ~2 seconds, steady, no vowel on the end.**

| Sound | Say | The cue the child just read |
|---|---|---|
| R | rrrr | Pull your tongue back and up like a tiger growl |
| S | sss | Teeth together, big smile, let the air hiss out |
| L | lll | Tongue tip up behind your top teeth |
| F | ffff | Top teeth on your bottom lip, blow soft |
| V | vvvv | Like F, but buzz your voice |
| SH | shhh | Round your lips and whisper quiet |
| Z | zzz | Teeth together and buzz like a bee |
| M | mmm | Lips together and hum |
| N | nnn | Tongue up behind your teeth and hum |
| TH | thhh | Tongue between your teeth, blow soft — **voiceless**, as in *thumb* |
| THV | thhh (buzzed) | Same tongue, **voice on** — as in *the*, *mother* |

TH and THV are the same mouth, different voicing. They are separate files and
separate clips — record them back to back so the contrast is obvious.

**Poppers (8) — three crisp reps, about half a second apart.**

| Sound | Say | The cue the child just read |
|---|---|---|
| P | p · p · p | Press your lips and pop a little puff |
| B | b · b · b | Lips together, turn your voice on |
| T | t · t · t | Tongue taps behind your top teeth |
| D | d · d · d | Like T, but turn your voice on |
| K | k · k · k | The back of your tongue pops up in the back |
| G | g · g · g | Like K, but turn your voice on |
| CH | ch · ch · ch | Pop it like a little train |
| J | j · j · j | Like CH, but turn your voice on |

The shortest possible release — **"p·" not "PUH."** A stop with no release is
inaudible, so a whisper of schwa is unavoidable and correct; a full "puh" teaches
the child an extra vowel they then have to unlearn.

## Delivery

Child-directed: a little slower and clearer than conversation, warm, not
cartoonish. This is the model a five-year-old is about to imitate, so it should
sound like something a five-year-old *can* imitate — not a performance.

If a take is flubbed, pause two full seconds and do it again. Last clean take
wins.

## Where they go

`public/coach/model/<SOUND>.mp3` — 19 files:

```
P B M N T D K G F V S Z SH CH J L R TH THV
```

That is a **new** directory. `public/coach/say/` holds the old full-sentence
takes, which the app plays *instead of* the whole TTS prompt; dropping bare
sounds in there would replace "Ready? Make your R sound, five times. Go!" with a
naked "rrrr." Keep them separate.

## Re-voicing to the app's coach voice

`POST /api/voice-change` already targets the currently-selected voice
(`qBDvhofpxp92JgXJxDjB`) by default, via ElevenLabs speech-to-speech. The pacing
and delivery survive; the timbre becomes the coach's.

For **sentences** that is a clean win. For **these 19**, it is not automatic.
Speech-to-speech re-synthesizes through the target speaker's vocal-tract prior,
and a sustained isolated phoneme is out of distribution for that prior, so it
regularizes toward typical formants. Measured on our own R take: **F3 rose
1898 → 2470 Hz.** Low F3 approaching F2 *is* what makes an American /r/ an /r/ —
raising it moves the clip toward /w/, which is the exact substitution most R kids
already make. A mirrored clip that teaches /w/ is worse than no clip.

Risk splits by where the sound's identity lives:

- **Mirror freely — identity is in the noise burst or frication, which STS
  preserves:** S Z SH CH J F V TH THV P B T D K G
- **Verify before shipping — identity is formant-carried:** R L M N. R is the one
  that actually matters; it is the sound most of the caseload is here for.

Gentler settings keep more of the source's formant structure. The route now
accepts them per request, so the 19 can be processed differently from sentences:

```
similarity=0.35  style=0  speaker_boost=false
```

Then check it, don't assume: measure F3 on the source take and the mirrored take
**with the same analysis code at the same sample rate and LPC order**, and reject
the mirror if F3 rises more than ~10%. Absolute numbers are not portable — two
passes over the same R clip came out ~500 Hz apart purely from analysis settings,
so a threshold copied from another script means nothing. The comparison has to be
source-vs-mirror through one code path.

If R won't survive the mirror, one hired voice for a handful of clips is a
$20–50 problem, not a blocker.
