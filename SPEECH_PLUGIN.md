# SonaSpeech — the on-device recognizer (Xcode handoff)

The repo now carries a local Capacitor plugin at `plugins/sona-speech`. It runs
Apple's `SFSpeechRecognizer` with `requiresOnDeviceRecognition = true` on every
request, and **refuses to start** when on-device recognition is unavailable —
it never falls back to Apple's servers. That is what keeps "no audio ever
leaves the device" true as a mechanism, not a promise.

The plugin returns **raw transcripts only**. Pass/fail lives in `sona.js`
(`hearVerdict`) so Rachel can tune what counts as an attempt without an App
Store review. `charge.html` starts a bounded listen each round, biased toward
the practice word, and `verifyClip()` prefers the transcript verdict; a child
the recognizer can't parse gets "unknown", which defers to the spectral check —
never a fail caused by the recognizer.

## Steps on the Mac

1. In the shell project's `package.json`, add:
       "sona-speech": "file:../SaaS/plugins/sona-speech"
   (adjust the relative path to wherever this repo sits next to the shell)
2. `npm install && npx cap sync ios`
3. In Xcode, add to `App/App/Info.plist`:
       <key>NSSpeechRecognitionUsageDescription</key>
       <string>Sona checks your child's practice sounds right on this device.
       Speech recognition runs on the phone — nothing is sent anywhere.</string>
   (`NSMicrophoneUsageDescription` already exists.)
4. Build to a REAL device (the simulator has no usable on-device model).

## Device test checklist — do these before submitting

- [ ] First practice round: mic prompt, then the speech prompt, both at setup.
- [ ] Say "poopoo" at an R word → the segment must NOT fill; Echo retries.
- [ ] Say the word (even imperfectly — "wabbit") → fills.
- [ ] Mumble something unintelligible → behaves exactly like the app did
      before this feature (spectral check decides). This is the "unknown" path.
- [ ] **Audio-session coexistence (the known risk):** while the recognizer is
      listening, the page's own rep counter (its getUserMedia stream) must
      keep counting, and Echo's TTS must still play afterwards. If either
      breaks, the fix is in `SonaSpeechPlugin.swift`'s AVAudioSession options —
      say so and we iterate there.
- [ ] Airplane mode ON: everything above still works identically. If it does
      not, on-device recognition is not actually on-device on that build.
- [ ] Settings → Privacy → Speech Recognition: toggle Sona OFF → the app keeps
      working on the spectral check alone.

## App Store notes

- App Privacy: no new data types — recognition is on-device and nothing is
  collected or transmitted.
- Review notes: mention the speech-recognition permission is used for
  child speech practice, processed entirely on device.

## What is deliberately NOT in the plugin

- No server fallback of any kind.
- No pass/fail logic (that is `hearVerdict` in `sona.js`).
- No audio retention — buffers go to the recognizer and nowhere else.
