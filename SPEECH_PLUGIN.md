# SonaSpeech — Apple's on-device listening check (Xcode handoff)

The repo carries a local Capacitor plugin at `plugins/sona-speech`. It runs
Apple's `SFSpeechRecognizer` with `requiresOnDeviceRecognition = true` on every
request, and **refuses to start** when on-device recognition is unavailable —
it never falls back to Apple's servers. That is what keeps "no audio ever
leaves the device" true as a mechanism, not a promise.

The plugin returns **raw transcripts only**. Pass/fail lives in `sona.js`
(`hearVerdict`) so Rachel can tune what counts as a try without an App Store
review. `charge.html` listens during each practice attempt (up to 15 s), biased
toward the practice word, and `verifyClip()` prefers the transcript verdict; a
try the recognizer can't make out is "unknown", which defers to the spectral
check — never a fail caused by the recognizer.

## It was never switched on (found 28 Sep 2026)

The plugin was written on 31 Aug (#110) and never reached the app. Nothing in
the Xcode project compiled it, nothing registered it, and Info.plist had no
speech-permission text. So in every build up to 1.0.3, every practice try was
judged by the sound-shape check alone, which passes "taco" for R. The earlier
steps here also could not have worked as written: they added the plugin as an
npm package, and its `Package.swift` asks for Capacitor 6 while the app is on 8.

## Steps on the Mac (about 10 minutes)

In the checkout that owns `ios/` (`/Users/traviswardrop/Documents/SaaS`), with
this branch's code:

1. `python3 scripts/install-ios-speech.py` (add `--check` first to see what it
   would change without writing anything).
   It compiles the plugin through `AppDelegate.swift` (the way the iOS 27 scene
   fix is compiled), registers it, and adds
   `NSSpeechRecognitionUsageDescription` to Info.plist. Without that text iOS
   closes the app the moment the speech permission is asked. To register it,
   it reads which controller `Main.storyboard` loads: MainViewController gets
   the registration wherever the project compiles it from; Capacitor's own
   controller (Travis's project, 28 Sep: MainViewController had never been
   added) is swapped for a small `SonaBridgeViewController` that registers it.
   Running it again is safe. It stops, changing nothing, on a project it does
   not understand, and says what it found.
2. Open Xcode, bump the Build number, and build to a **real iPhone** (the
   simulator has no usable on-device model).
3. In Safari → Develop → your iPhone → Sona, check
   `window.Capacitor.Plugins.SonaSpeech` is defined (not `undefined`).
4. Run the checklist below, then Archive and upload as usual (NATIVE.md).

The website half (the rules in `sona.js`, the listening time in `charge.html`)
goes live with a normal merge; only the plugin itself needs the new build.

## Device test checklist — do these before submitting

- [ ] First practice round: mic prompt, then the speech prompt, both at setup.
      Read the speech prompt: note any sentence Apple adds about sending speech
      to Apple (the code keeps it on the phone; the prompt is Apple's text).
- [ ] At an R word, say "taco" → it must NOT count; Echo asks again.
- [ ] Say "Here is a taco" on a sentence round → must NOT count.
- [ ] Say the word, even imperfectly ("wabbit") → counts.
- [ ] Say the word as your last try, just before Echo ends the turn → counts
      (the final word used to be cut off).
- [ ] Mumble something unintelligible → behaves exactly like the app did
      before this feature (spectral check decides). This is the "unknown" path.
- [ ] **Audio-session coexistence (the known risk):** while the recognizer is
      listening, the page's own rep counter (its getUserMedia stream) must
      keep counting, and Echo's voice must still play afterwards. If either
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
