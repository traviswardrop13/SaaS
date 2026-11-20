# SonaSpeechCore

Local Swift package for one native family practice attempt. Nothing here is connected to the shipping app or the preview Xcode project. It has no package dependencies, network client, recorder, analytics or storage. All microphone samples and recognition text stay in memory on this device. Tests synthesize their input.

## Integration

Add this folder as a local Swift package and link `SonaSpeechCore`. The module targets iOS 15 and later. `ApplePracticeAudioDriver` is available on iOS. The state machine, acoustic detector and word check also run on macOS for tests.

The host supplies the selected child’s existing target, its approved prompt and already-local audio assets. Keep the current mouth cue, Rachel’s existing recorded sound, the isolated target and the existing “Go!” handover. `PracticePrompt` passes these through; it generates no new words and accepts only file URLs. A prompt may contain one already-joined clip or ordered local parts. Set `isMuted` from the existing family sound setting. Do not replace Rachel’s sound with synthesized speech.

```swift
import SonaSpeechCore

// Retain the session in the practice screen's main-actor model.
let turn = PracticeTurnSession(
    target: PracticeTarget(sound: selectedSound, word: targetWord,
                           level: targetLevel, sentence: sentenceFrame),
    prompt: PracticePrompt(text: approvedPrompt,
                           parts: [.init(fileURL: approvedLocalClip)]),
    requiredReps: 5,
    driver: ApplePracticeAudioDriver()
)
turn.onChange = { state in
    // Render state.phase, state.reps and state.listeningReady.
    // A rep updates the picture only; no sound during listening.
}
turn.onResult = { result in
    // Route once through the existing practice-only save/retry flow.
    // result contains reps, pass/fail and whether input was interrupted.
    // It contains no PCM or transcript.
}
// Only after the existing grown-up mic explanation and explicit yes:
turn.startAfterGrownUpConsent()
```

The app needs `NSMicrophoneUsageDescription` and `NSSpeechRecognitionUsageDescription` in its Info.plist, using the existing approved on-device wording. The driver asks for the microphone first, then optional speech recognition. A denied or unavailable recognition service uses the existing sound-shape check. Every Apple request requires on-device recognition; no server fallback exists. A denied/missing microphone enters `microphoneUnavailable`, with no practice result.

Forward background and foreground changes with `setForeground(false/true)`. Returning to the foreground leaves `paused` on screen. Only the child's **Resume** tap calls `resumeAfterTap()`. Audio interruptions, route changes, media resets and starved input also pause; none automatically reopens the microphone. Use `replayPromptAfterTap()` for the existing model replay and `retryQuietAfterTap()` for the quiet screen’s explicit retry. Before leaving or handing audio to Fruit Slice, **await `cancelAndClose()`**.

`PracticeTurnMachine` is a deterministic reducer for custom hosts/tests: `send(event, atMilliseconds:)` returns tokenized effects. Times must be monotonic, not calendar dates. `PracticeAudioDriver` is the injectable main-actor transport. `PracticeAcoustics` takes matching float samples/spectrum plus the separate 512-point energy/shape analysis; its output contains only counts and aggregate shape numbers. `PracticeWordVerdict.evaluate` is the existing HEAR2 rule port.

## Preserved boundaries

- A known-silent room probe precedes the model: 300 ms of running input, up to 600 ms to start. Startup zeros, starved input and a voice cannot become the room floor. Reopened windows sample their first 250 ms and may only lower the carried floor.
- Nothing plays over an open mic. The first prompt waits for confirmed close plus 200 ms; listening starts at least 250 ms after the prompt ends. The final result also waits 200 ms after confirmed cleanup.
- A turn listens for at most 20 seconds of active input. Five heard tries start the existing 350 ms final evidence tail. Permission, playback and a background pause do not spend that listening time. Apple's check has its separate 15-second attempt budget and at most 800 ms to finish after input ends.
- Reps require the existing energy onset plus qualified voiced, sibilant, short-release or changing-hold evidence. A continuous hold counts once. Silence, a timer, a tap and a transcript alone count nothing. Partial voiced windows retain actual tries when interrupted; unfinished bursts must qualify again.
- Apple’s clear word verdict wins; unknown uses the existing broad sound-family check. An unrelated spoken word can be a voiced **practice try** with a failing verdict, exactly as on the current practice page. Unknown or silent attempts return to the quiet state and emit no practice result.
- This is one attempt, **not the whole five-try/retry/step-down/game-access flow**. A host must retain the existing three-try retry, target step-down, earned-rung rules, quiet copy, clinical snapshots and final game handoff. A failed attempt is not a new speech-loss screen or a game unlock. The module does not choose sounds, change age/position/homework rules or create new prompts.
- Practice results belong only in the existing practice ledger. Games/books require their own accepted-play-rep path; this package does not log them as clinician practice. The package never saves microphone samples or transcripts.

Reference sources: `public/charge.html` (turn, REPGUARD1, room and shape rules), `public/sona.js` (HEAR2), and `plugins/sona-speech/ios/Sources/SonaSpeechPlugin/SonaSpeechPlugin.swift` (local Apple recognition, mic ownership and cleanup). These remain unchanged.

## Local verification

Verified locally: **58 Swift tests pass**, including 215 word-verdict fixtures, and all eight JavaScript acoustic replay scripts pass. The device source typechecks at the same iOS 15 minimum as the current app. The temporary copy with the earlier observer-order bug fails its regression assertion. The suite uses synthetic input. The full practice decisions and remaining device checks are described in [FLOW-PARITY.md](FLOW-PARITY.md).

From this folder:

```sh
swift test
node Tools/check-acoustic-parity.mjs
```

In a restricted workspace, keep SwiftPM caches and output in a writable temporary folder:

```sh
CLANG_MODULE_CACHE_PATH=/private/tmp/sona-speech-core-module-cache \
SWIFTPM_MODULECACHE_OVERRIDE=/private/tmp/sona-speech-core-module-cache \
swift test --disable-sandbox \
  --scratch-path /private/tmp/sona-speech-core-build \
  --cache-path /private/tmp/sona-speech-core-cache \
  --config-path /private/tmp/sona-speech-core-config \
  --security-path /private/tmp/sona-speech-core-security \
  --manifest-cache local
```

The synthetic suite covers voiced input, silence with a matching transcript, wrong words, quiet windows, paused clocks, explicit foreground recovery, stale permission/open/frame callbacks, reentrant UI cancellation, prompt replay and exactly-once completion. There are 215 word-verdict cases evaluated against unchanged JavaScript. Acoustic fixtures compare positive/negative counts, evidence routes and timing against the unchanged web detector. Analysis tests cover FFT normalization, energy quantization, batched tap delivery, missing/repeated buffers, discontinuity and overrun. Reintroducing the earlier observer-order bug makes its regression test fail; deliberately restoring stale PCM polling also fails its check.

The native analyser uses the web Blackman window, 1/N FFT magnitude, 512-point byte energy/shape and the separate unsmoothed evidence FFT. Distinct 60 Hz sample positions are consumed once, even when iOS batches tap buffers. This is a verified synthetic implementation, **not proof of microphone or browser/hardware parity**. Valid float evidence is required; the old web-only no-float loudness fallback is deliberately absent.

## Next physical-device checks

1. Use an older supported iPhone and a current iPhone; compare the same existing targets and prompt assets with the shipping app. Measure mic startup, room level, count onset and the final 350 ms tail. Listen to every prompt part with Rachel before release.
2. Test real quiet, arm’s-length speech, a fan and a TV. Confirm silence earns nothing and that the current broad sound-family limitations remain. No acoustic threshold or gain was tuned here; any such change is Rachel’s decision.
3. Start a turn, then lock the phone, open Siri, receive a call, change audio routes and return. The mic must stop, heard tries must remain, partial bursts must reset, and nothing may resume before a tap.
4. Leave while each OS permission box or audio open is pending. A late answer must never reopen the old turn. Test denied/restricted permissions and unavailable on-device speech models; recognition must never use a server.
5. Verify the silent switch silences Echo and every sound, the side buttons control ordinary media, and other music pauses before Echo/capture. Check built-in speaker, wired audio and AirPods without hands-free call quality.
6. Say a target, an approved close try, “taco” and filler. Check the final local transcript/result, including a word at the end of a window and a second attempt reusing the driver. No old transcript may carry over.
7. Run the full practice retry/step-down flow around this attempt, plus Fruit Slice’s first turn, on device. Verify the original prompts, five/three requested tries, ledger boundaries and game access with the main app owners.

No physical device, microphone or real child audio was used for these local checks. No commit, push, merge or deployment is part of this workstream.
