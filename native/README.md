# Sona — native iOS audio (`SonaAudio` Capacitor plugin)

Clean-mic capture for the iOS app so pronunciation scoring sees real fricative
detail (see `Sona-AppStore-NativeAudio-Spec.md` for the why). `/ios` is generated
on the Mac and git-ignored, so the plugin **source** lives here; you add it to the
Xcode project once.

> ⚠️ Written carefully but **not yet compiled on a Mac** — build in Xcode and test
> on a device.

## Files
- `ios/SonaAudio/SonaAudioPlugin.swift` — the whole plugin: AVAudioEngine capture in
  `AVAudioSession.measurement` mode (no auto-gain / noise-suppression / high-pass),
  float→16-bit PCM, simple voice-activity auto-stop, returns a base64 WAV. Registers
  itself via `CAPBridgedPlugin` (`jsName = "SonaAudio"`), so **no `.m` file is needed**.

> **Capacitor 8 uses Swift Package Manager, not CocoaPods.** That's why `npx cap add ios`
> runs with no Podfile. Registration is the Swift `CAPBridgedPlugin` protocol — the old
> Objective-C `CAP_PLUGIN` macro / `<Capacitor/Capacitor.h>` import does **not** resolve
> under SPM, which is why this is a single Swift file.

## Add it to the iOS project (one time, on your Mac)
1. Generate the project if you haven't: `npx cap add ios && npx cap sync ios`.
2. `npx cap open ios` → in Xcode's left navigator, expand the **App** group, then drag
   `native/ios/SonaAudio/SonaAudioPlugin.swift` into it. In the dialog: check
   **"Copy items if needed"** and make sure the **App** target is ticked under
   "Add to targets". (No bridging-header prompt — it's pure Swift.)
3. **Info.plist** → add `NSMicrophoneUsageDescription` =
   "Sona uses the microphone so your child can practice saying their sounds."
4. Build/run on a device. Verify in Safari Web Inspector (Develop → your phone):
   `window.Capacitor.Plugins.SonaAudio` is defined.

## How the web uses it (already wired in `public/sona.js`)
- `Sona.hasNativeAudio()` → true only inside the native app with the plugin present.
- `Sona.captureClip({ maxMs })` → resolves `{ blob, transcript, spoke }`:
  - **native:** calls `SonaAudio.record()` (clean PCM WAV),
  - **web:** falls back to `MediaRecorder` on `opts.stream`.
  The `blob` is what `/api/score` already accepts — no server change needed.

## Game activation — already done ✅
All 12 game recorders already short-circuit to native capture when the plugin is
present (the guard below sits at the top of each `recordTurn()` / `listen()` /
`recordRep()`): racer, bubble, grocery, cupstack, builder, train, whack, match,
story, chat, lesson, warmup.

```js
if (window.Sona && Sona.hasNativeAudio && Sona.hasNativeAudio()) {
  return Sona.captureClip({ maxMs: maxMs || 6000 });   // {blob, transcript, spoke}
}
```

The web path (waveform UI, tap-to-stop) is unchanged for browser users, and this is
served from the live site (`server.url` in `capacitor.config.json` → speaksona.com),
so once the plugin builds, native capture is live across every game with no further
JS changes.

## Honest expectation
A real **input-quality + reliability** upgrade (best on /s, z, sh, ch, th/ and on
"it didn't hear me"). It does **not** change SpeechAce's underlying accuracy ceiling
on young kids' voices — validate the gain with the 1-hour codec A/B (current web
recording vs native WAV through `/api/score`).
