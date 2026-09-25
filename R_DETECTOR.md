# PROP1 — Sona's own R detector (v0 spec)

The long-term moat: understanding *children's* speech, starting with the one
sound we sell — /r/. Cloud scorers (SpeechAce) are built on adult speech and
are measurably unreliable on kids' isolation sounds (we already route those to
the on-device shape gate). This doc specs a proprietary, on-device R-scorer
that starts as a heuristic and grows into a trained model as consented data
accumulates.

## Why /r/ is detectable

/r/ has a famous acoustic fingerprint: **the third formant (F3) drops** —
correct American /r/ pulls F3 down near F2 (roughly < 2000 Hz in child
speech), while the classic errors keep it high:

- **w-for-r** ("wabbit"): F3 stays high (~2500–3500 Hz); F1/F2 glide like /w/
- **vowelized r**: weak F3 movement, steady vowel formants
- correct /r/: low F3, often F2–F3 pinch < 600 Hz

That's a *frequency-shape* judgment — exactly the kind of thing the existing
charge-screen analyser already does for the hiss/voiced gate. No audio leaves
the device; we only read spectral numbers.

## v0 — heuristic, on-device, shadow mode

1. **Signal**: reuse the practice-screen `AnalyserNode` (float frequency
   data, voiced frames only, same speaker-guard rules — Echo's own voice
   never scores).
2. **Feature per voiced frame**: estimate F2/F3 by spectral peak-picking in
   the 800–4000 Hz band (smoothed, tracked across frames). Round-level
   features: median F3, F3–F2 gap, F3 trajectory (falling vs flat).
3. **Verdict** (mirrors `shapeVerdict` semantics — never punish borderline):
   - `pass`: median F3 clearly low / pinched gap
   - `fail`: clearly high flat F3 with /w/-like glide
   - `unknown`: not enough voiced frames, mixed evidence → no judgment
4. **Calibration set (Rachel)**: ~20 correct /r/ productions (isolation,
   syllable, word position i/m/f) + deliberate error imitations (w-glide,
   vowelized), a few speakers/ages if possible. A dev-gated capture page
   (like the shape-gate calibration flow) prints per-clip feature stats;
   thresholds get set from the printed clusters, committed as constants.
5. **Shadow mode, no user impact**: run beside the existing scorers on R
   rounds and log agreement only — `/api/track` event `r shadow score`
   with props `{verdict, cloud_verdict, agree}` (whitelist extension
   needed). After ~2 weeks of live shadow data: if agreement with
   SpeechAce on words ≥ ~85% AND it catches w-for-r on isolation (where
   SpeechAce is blind), promote it to the isolation gate first.

## Growth path

- **v1**: replace isolation scoring entirely (SpeechAce never sees isolation
  clips again — saves credits and beats it on accuracy there).
- **v2**: consented, parent-opt-in labeled corpus (separate consent flow —
  requires Travis + Rachel sign-off; recordings-stay-on-device remains the
  default and the hard rule until then). Rachel labels; outcomes link
  exercises → improvement.
- **v3**: small trained classifier (on-device, WebAudio features or WASM)
  for /r/ correctness + distortion type; the labeled corpus is the moat no
  competitor can prompt into existence.

## Non-goals for v0

No new UI, no scoring behavior change, no audio upload, no model training.
Shadow numbers first; honesty gates (two-fail mercy, never-punish-honest)
unchanged forever.
