# Sona — native iOS audio (`SonaAudio` Capacitor plugin)

Clean-mic capture for the iOS app so pronunciation scoring sees real fricative
detail (see `Sona-AppStore-NativeAudio-Spec.md` for the why). `/ios` is generated
on the Mac and git-ignored, so the plugin **source** lives here; you add it to the
Xcode project once.

> ⚠️ Written carefully but **not yet compiled on a Mac** — build in Xcode and test
> on a device.

## Files
- `ios/SonaAudio/SonaAudioPlugin.swift` — AVAudioEngine capture in
  `AVAudioSession.measurement` mode (no auto-gain / noise-suppression / high-pass),
  float→16-bit PCM, simple voice-activity auto-stop, returns a base64 WAV.
- `ios/SonaAudio/SonaAudioPlugin.m` — Capacitor registration (`SonaAudio`).

## Add it to the iOS project (one time, on your Mac)
1. Generate the project if you haven't: `npx cap add ios && npx cap sync ios`.
2. `npx cap open ios` → in Xcode, drag **both** files in
   `native/ios/SonaAudio/` into the **App** target (check "Copy items if needed"
   and the App target). Accept the Objective-C bridging header prompt if asked.
3. **Info.plist** → add `NSMicrophoneUsageDescription` =
   "Sona uses the microphone so your child can practice saying their sounds."
4. Build/run on a device. Verify in Safari Web Inspector:
   `window.Capacitor.Plugins.SonaAudio` is defined.

## How the web uses it (already wired in `public/sona.js`)
- `Sona.hasNativeAudio()` → true only inside the native app with the plugin present.
- `Sona.captureClip({ maxMs })` → resolves `{ blob, transcript, spoke }`:
  - **native:** calls `SonaAudio.record()` (clean PCM WAV),
  - **web:** falls back to `MediaRecorder` on `opts.stream`.
  The `blob` is what `/api/score` already accepts — no server change needed.

## Activate it in a game (one line per recorder)
Each game has a `recordTurn()` that builds a web `MediaRecorder`. To use native
capture when available, add this at the very top of that function:

```js
if (window.Sona && Sona.hasNativeAudio && Sona.hasNativeAudio()) {
  return Sona.captureClip({ maxMs: maxMs || 6000 });   // {blob, transcript, spoke}
}
```

(The web path — waveform UI, tap-to-stop — stays unchanged for browser users.)
Games to wire: racer, bubble, grocery, cupstack, builder, train, whack, match,
story, chat, lesson, warmup. Ask Claude to "wire captureClip into every game's
recorder" to do them all at once.

## Honest expectation
A real **input-quality + reliability** upgrade (best on /s, z, sh, ch, th/ and on
"it didn't hear me"). It does **not** change SpeechAce's underlying accuracy ceiling
on young kids' voices — validate the gain with the 1-hour codec A/B (current web
recording vs native WAV through `/api/score`).
