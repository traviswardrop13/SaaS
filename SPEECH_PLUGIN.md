# SonaSpeech — Apple's on-device listening check, Sona's own microphone, and the trial reminder (Xcode handoff)

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

Since 12 Oct 2026 the same plugin also **owns the microphone in the iPhone
app**: `micPermission`, `micOpen` and `micClose`. See "Sona's own microphone"
below. Since 22 Oct 2026 (iOS 1.0.9) it also sets **the trial reminder**, one
local notification the day before the free trial ends (30 hours before, so a
cancel then still counts): `notifyStatus`,
`notifyAsk`, `notifySchedule` and `notifyCancel`. See "The trial reminder".

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
   added) is swapped for a small `SonaBridgeViewController` that registers it,
   in the storyboard and in any code that builds Capacitor's controller itself
   (a project made with Capacitor 8.5 or later builds it in `SceneDelegate.swift`,
   and that is the one on screen). Running it again is safe.
   The storyboard names it with the app's module ("Inherit Module From
   Target"), never by a bare name. Build 6 (28 Sep) opened to a black screen
   because the script's first version used the bare name: the class's parent
   comes from Capacitor's binary framework, so iOS cannot look it up that way
   until Swift code has touched it, and the storyboard fell back to an empty
   controller. Running the script again repairs a project left that way. It stops, changing nothing, on a project it does
   not understand, and says what it found.
2. Open Xcode, bump the Build number, and build to a **real iPhone** (the
   simulator has no usable on-device model).
3. In Safari → Develop → your iPhone → Sona, check
   `window.Capacitor.Plugins.SonaSpeech` is defined (not `undefined`).
4. Run the checklist below, then Archive and upload as usual (NATIVE.md).

The website half (the rules in `sona.js`, the listening time in `charge.html`)
goes live with a normal merge; only the plugin itself needs the new build.

## Sona's own microphone (12 Oct 2026)

**What a family notices today.** The moment Echo listens, the iPhone app acts
as if it were on a phone call: the volume buttons move call volume, and
AirPods drop to phone-call sound quality. That is WebKit (the browser engine
inside the app) doing what it always does when a web page asks for the mic,
and the app cannot change it.

**What this build does instead.** The page asks the plugin for the mic, and
the plugin listens itself, in ordinary recording mode: one AVAudioEngine,
`.playAndRecord` with mode `.default`, mixable, no hands-free Bluetooth, no
voice processing, on only while a listen is open. Each chunk of sound goes to
the page as a `micpcm` event, through Capacitor into this phone's own web
view, where every "did that count" bar is the same as before. Apple's word
check hears the same chunks. Nothing is saved or sent: the plugin has no
network or file code (`heartest` pins that). It never reopens the mic by
itself; a call, Siri, locking the screen, leaving the page, or 5 minutes
ends a listen, and the page decides what happens next.

**Older app builds are unaffected.** The website uses Sona's own mic only
when the app's plugin has `micOpen`. No build in the App Store does, so the
website can go live first and every phone keeps today's microphone until it
updates.

**Steps on the Mac**, in the checkout that owns `ios/`:
1. `git pull`.
2. Open `ios/App/App/capacitor.config.json` and, inside `"ios"`, add
   `"loggingBehavior": "none"` (the repo's copy has it). Without it a Debug
   build prints every chunk, 10 to 50 a second, and slows the phone. Do not
   run a full `npx cap sync` over the app's bundled files (NATIVE.md).
3. `python3 scripts/install-ios-speech.py --check`, then the same without
   `--check`. It replaces the plugin between its markers in AppDelegate.swift;
   the script itself needs no change.
4. Open `ios/App/App/AppDelegate.swift` and search for
   `configureAudioForAutoplay`. If it is there, delete it and the line that
   calls it: it puts the whole app into measurement mode with hands-free
   Bluetooth at launch, which is the call-quality AirPods this build removes.
5. Bump the Build number and run on the iPhone (a Debug build is fine now).
6. Run the checklist below and send Claude the numbers.

**The gate before submitting.** In the mic numbers (checklist), "close" is
how long the phone takes to let go of the mic after a listen. It must be
150 ms or less. Over 50 ms, tell Claude: a small website change then makes
Echo wait for the phone to finish closing, and it can ship before or after
the build. "gaps" should stay near 0 once a listen has started.

**If something goes wrong after release:** set `NATIVE_MIC_ON = false` in
`public/sona.js` and deploy the website. The new build then listens through
the web page exactly as today, and Apple's check opens the mic its old way.
No App Store review. One phone alone: in Safari's Web Inspector console,
`localStorage.setItem("sona.nativemic","off")`, then reload. Turn things off
with these switches, never by reverting the code or rolling the website back:
see "Taking it out" under the silent switch, below.

**A call for Rachel, not engineering.** Today the phone call mode also turns
quiet voices up and steady room noise down. Sona's own mic does neither, so
the bars stay the same but the sound reaching them is plainer: a soft or
far-away "sock" may count less often, and a TV or fan in the room reaches the
bar louder. If the app's levels come out lower, the fix is one website
number, the mic boost (it starts at ×1.0, no boost). The checklist measures
first; whether to boost is Rachel's call, because it changes what counts as
practice.

**The silent switch (15 Oct 2026).** Travis picked "Everything off": with the
phone's side switch on silent, Sona plays nothing, Echo included, like most
iPhone games. It comes in two halves that ship separately:
- **The page: a web deploy, no App Store review.** In an app build with Sona's
  own mic, every page sets `navigator.audioSession.type` to `"transient-solo"`
  as it loads. Echo's voice, Rachel's sound, "Go!", the chimes, Piano Tiles'
  notes, Bubble Pop's pops and the games' own sounds then all follow the
  switch, and Spotify still pauses when Echo talks, as today. WebKit refuses
  its own mic while the type is set, so before WebKit's mic is used (the
  phone says not now, a fault, the off switch) the page sets it back to
  `"auto"` for the rest of that page; that page then plays through the switch
  as before. A build without `micOpen` (every App Store build on 15 Oct) and
  Safari on speaksona.com are never touched.
- **The plugin: needs a new App Store build.** After a listen,
  `sessionOff()` now leaves the app's session `.ambient` (it was `.playback`,
  which ignores the switch). The robot fallback voice plays there. A build
  with Sona's own mic but the old `sessionOff()` plays the robot voice even on
  silent.
- **Taking it out: set `AUDIO_SESSION_TYPE` to `"auto"`** in
  `public/sona.js` and deploy the website. Every page then writes `"auto"` as
  it loads, which also clears the setting a family's open app still holds,
  and Sona plays through the switch as before. **Never revert the block, and
  never roll speaksona.com back to a deployment from before it (Vercel's
  Instant Rollback included), while an app build with `micOpen` is in
  families' hands.** WebKit keeps `"transient-solo"` for as long as the app
  stays open, across page loads, and code without the block never gives it
  back. WebKit then refuses its own mic: every fallback, and every listen
  once `NATIVE_MIC_ON` is `false`, so the off switch above gives no mic at
  all. It lasts until the family closes the app fully and opens it again.
  The off switch works only on code that has this block.

**For Rachel:** on a silenced phone a child hears no Echo and no sound to copy
until a grown-up flips the switch, and nothing on screen says why.

## The trial reminder (22 Oct 2026, iOS 1.0.9)

Travis, 22 Oct 2026: "can we add push notifications and have that be a step
in the onboarding where we ask them to turn it on to notify them a day
before their trial ends". It is a **local** notification: the page
(`public/sona.js`, block NOTIFY1) picks the moment and the words, and the
plugin hands iOS one request (`UNUserNotificationCenter`, a one-time calendar
trigger). No server sends it, there is no device token and no Apple push
service, and the request holds only a title and a sentence ("Sona" / "Your
free trial ends tomorrow.", never a child's name).

- `notifyStatus()` → `{ status }`: "granted", "denied", "prompt" (never
  asked) or "provisional". Asks nothing.
- `notifyAsk()` → `{ granted }`: iOS's own Allow box, alerts and a sound (no
  badge). An answered setting resolves at once, with no box.
- `notifySchedule({ id, at, title, body })`: `at` in ms since 1970. One
  notification at that moment; the same id replaces the one waiting. A moment
  under a minute away, past, or more than 400 days away is refused; a family
  who has not allowed notifications gets `{ scheduled: false }`.
- `notifyCancel({ id })`: the waiting one is not shown.
- While Sona is open, iOS shows a notification only if the app says so. The
  plugin answers Capacitor's router (`localNotificationHandler`) for Sona's
  own ids ("sona-…") with a banner and the list, and **no sound**: the
  reminder comes 30 hours before the end (six hours before the time of day
  the trial started), which is often when the family plays, and a game's mic may be open then (iOS's chime would play
  into it). With Sona closed it comes with its sound as usual.

When the page sets it: at once after a purchase that started a free trial
(`Sona.buyPlan`), for the trial's end in the purchase's own record (else the
store's free time from now) minus 30 hours (Apple counts a cancel only at
least 24 hours before the end, so a reminder at exactly a day before came too
late to act on), before the price page leaves; and
once a day on an app page other than Home (`Sona.trialReminderSync`), which
sets it afresh while the trial is on and takes it back once no free trial is
(a paid plan, ended, or cancelled by the parent). Never within the hour,
never in the past.

**Steps on the Mac** (with the mic's steps above, if not done yet):
1. Pull this branch's code into the checkout that owns `ios/`.
2. `python3 scripts/install-ios-speech.py --check`, then the same without
   `--check`. It replaces the plugin between its markers in AppDelegate.swift;
   the script needs no change.
3. **Nothing to enable in Xcode:** local notifications need no Push
   Notifications capability, no APNs key, no Background Modes and no
   Info.plist text (the Allow box is iOS's own words). Do not add the Push
   capability for this.
4. Version **1.0.9**, Build one higher; run on the iPhone; the checklist
   below ("The trial reminder" items).

If the build shows an error naming `NotificationHandlerProtocol` or
`notificationRouter` (Capacitor's names for its notification router), send it
to Claude: that line is what shows the reminder while Sona is open.

## Device test checklist — do these before submitting

- [ ] Sona opens to its own screen, not a black one. Black means the
      storyboard cannot find `SonaBridgeViewController`; Xcode's console says
      "Unknown class". Run the script again.
- [ ] Delete and reinstall, then set up: iOS's mic prompt, then the speech
      prompt, both at setup. Read the speech prompt: note any sentence Apple
      adds about sending speech to Apple (the code keeps it on the phone; the
      prompt is Apple's text). Once more with the mic denied: practice says
      "Echo can’t hear you yet!" and points to Settings → Sona.
- [ ] At an R word, say "taco" → it must NOT count; Echo asks again.
- [ ] Say "Here is a taco" on a sentence round → must NOT count.
- [ ] Say the word, even imperfectly ("wabbit") → counts.
- [ ] Say the word as your last try, just before Echo ends the turn → counts
      (the final word used to be cut off).
- [ ] Mumble something unintelligible → behaves exactly like the app did
      before this feature (spectral check decides). This is the "unknown" path.
- [ ] The mic numbers: Settings → tap Account 5 times, then a practice round.
      The box gains a line like "mic: Sona's own · default mode · in iPhone
      Microphone · out Speaker · boost ×1.0 · chunk 100 ms · queue 190 ms ·
      gaps 0 · restarts 0 · close 30 ms". Write down chunk, queue, gaps and
      close (the gate above). fps should be where it was.
- [ ] Volume buttons, during and after a listen, move ordinary volume, not
      call volume. Echo's next line plays at normal loudness.
- [ ] AirPods in: Echo plays in the AirPods at music quality before and after
      a listen, and the box says "in iPhone Microphone" (the child speaks
      toward the phone). Put them in or take them out during a listen and note
      what happens: the listen carries on ("restarts 1"), or practice shows its
      grown-up card. If Echo comes out of the speaker instead of the AirPods,
      try `localStorage.setItem("sona.nativemic",'{"speaker":false}')`, reload,
      and note it.
- [ ] Interruptions: Siri during a say-it card and during practice; a phone
      call from another phone; locking the screen. The orange dot goes off;
      the card listens again afterwards without leaving the page; practice
      shows its normal grown-up card.
- [ ] **Side switch on silent: nothing plays** (Travis, 15 Oct 2026:
      "Everything off"). Switch to silent, then play a practice round, a
      Fruit Slice say-it card, a Piano Tiles song, Hoops and a book page:
      Echo, Rachel's sound, "Go!", the chimes, the piano notes and the game
      sounds are all silent, and saying the sound still counts. Flip the
      switch back: the next line plays, at normal loudness. In Safari's Web
      Inspector console, on any of those pages, the one-line check:
      `navigator.audioSession.type` must read `"transient-solo"`
      (`Sona.micStats().session` says the same). `"auto"` on a page that never
      fell back to the web mic (`Sona.micStats().broken` false, `busy` 0) is a
      bug: tell Claude. Spotify playing before practice still pauses when
      Echo speaks.
- [ ] Silent, with the robot voice: turn on airplane mode and open a page
      whose lines are not saved yet, so Echo's lines fail and the robot voice
      reads them. On this build it is silent too (`.ambient`). Note it if it
      plays: that is the old plugin.
- [ ] **The web mic, the off switch's path (the audio-session coexistence
      risk):** `localStorage.setItem("sona.nativemic","off")`, reload, and play
      one practice round. While Apple listens, the page's own rep counter must
      keep counting, and Echo's voice must still play afterwards. If either
      breaks, the fix is in `SonaSpeechPlugin.swift`'s AVAudioSession options.
      On this path `navigator.audioSession.type` reads `"auto"` (the web mic
      needs it), so Echo plays on silent here, as every build did before.
      `localStorage.removeItem("sona.nativemic")` afterwards, then load a
      page: it reads `"transient-solo"` again.
- [ ] Airplane mode ON: everything above still works identically. If it does
      not, on-device recognition is not actually on-device on that build. If
      the robot fallback voice plays, it plays at normal loudness, and AirPods
      stay at music quality.
- [ ] Settings → Privacy → Speech Recognition: toggle Sona OFF → the app keeps
      working on the spectral check alone.
- [ ] **The trial reminder** (1.0.9). In Safari's Web Inspector console:
      `typeof Capacitor.Plugins.SonaSpeech.notifySchedule` is "function" and
      `Sona.notifyAvailable()` is true.
- [ ] Delete and reinstall, then set up as a new family: after "<Name>'s
      practice is ready" the reminder screen shows; "Turn on reminders" shows
      iOS's Allow box once; Allow. `Sona.notifyState()` reads "granted", and
      iPhone Settings → Notifications lists Sona with notifications allowed.
      The price screen follows and, for a free trial, says "We'll remind you
      the day before it ends." under the button.
- [ ] Once more with Don't Allow: the price screen follows, and nothing on it
      says remind.
- [ ] A real notification, two minutes from now (a test id, so no trial is
      touched): `Capacitor.Plugins.SonaSpeech.notifySchedule({ id:
      "sona-test", at: Date.now() + 120000, title: "Sona", body: "Test" })`.
      Lock the phone: it arrives, with its sound. Again with Sona open on
      Home: it shows as a banner over the app, with NO sound. Again, then
      `Capacitor.Plugins.SonaSpeech.notifyCancel({ id: "sona-test" })` before
      the two minutes: nothing arrives.
- [ ] A sandbox trial (from setup's price screen): Apple's sandbox makes free
      days last minutes, so the reminder's moment (30 hours before) has already gone and nothing
      is set; that is expected. `await Sona.trialReminderSync(true)` reads
      "near" while the sandbox trial is on, and "cancelled" once it renews as a
      paid period. `await Sona.trialReminderArm(Date.now() + 32 * 3600e3)`
      gives true (the call working; it would show in two hours, so clear it
      with `Capacitor.Plugins.SonaSpeech.notifyCancel({ id: "sona-trial-end" })`).

## Numbers to send Claude (same build, same phone)

In Safari → Develop → the iPhone → Sona → Console:
1. `typeof Capacitor.Plugins.SonaSpeech.micOpen` is "function" and
   `Sona.micNative()` is true. After one practice round, `Sona.micStats()`
   shows native true and broken false.
2. Music: play Spotify, then start practice, and note whether it is still
   playing after Echo's first line (expected: Echo pauses it, as today). Then
   play a TV or a speaker in the room during practice and in Hoops, and note
   whether it ever counts a try.
3. "Sock" at arm's length, in a quiet room and again with a fan on, three
   ways: Safari on speaksona.com; the app as built; the app on the web mic
   (`localStorage.setItem("sona.nativemic","off")`, reload, `removeItem`
   afterwards). Each time, write down "now", "loudest in 2 s", "counts above"
   and "room".
4. Only if the app's numbers come out lower:
   `localStorage.setItem("sona.nativemic",'{"gain":1.5}')`, reload; the box
   shows "boost ×1.5". Measure only: nothing ships until Rachel decides.
5. Buffer trial: `localStorage.setItem("sona.nativemic",'{"ioMs":10}')`,
   reload. Note whether "chunk" drops below 100 ms and whether gaps change
   (about 100 ms is expected: Apple's tap hands over 100–400 ms buffers).
   `removeItem` afterwards, then swipe Sona closed and reopen it before
   step 6: the buffer request stays on the phone's audio session until the
   app restarts, so later numbers would be the trial's.
6. Each listening place hears a try: practice; the say-it card in Fruit Slice,
   Piano Tiles, Block Stack, Sound Sprint and Balloon Glide; Fruit Slice's
   sound power; Feed Echo; Hoops, Soccer and Dino. After a card in Fruit
   Slice, Hoops and Feed, run `Sona.micStats()`: leadZeroMs under 150, gaps
   about 0, queueMs about 250 or less, broken false.
7. A break mid-card: with a fan or a TV on low, open Fruit Slice's say-it
   card, hold the side button for Siri, cancel her, and come back to the
   card. It picks the mic up again, the fan or TV still answers nothing, and
   a try still does. `Sona.micStats()`: pauses 1 or more, broken false.

`sona.nativemic` is set only by hand like this, and never travels in a backup.

## App Store notes

- App Privacy: no new data types — recognition is on-device and nothing is
  collected or transmitted. The trial reminder adds none either: it is set
  and shown on the phone.
- Review notes for 1.0.9: "During setup the app offers to turn on
  notifications so it can remind the parent once, the day before the App
  Store free trial ends (30 hours before, so cancelling still counts). It is a local notification scheduled on the device;
  there is no push service and nothing is sent to a server."
- Review notes: mention the speech-recognition permission is used for
  child speech practice, processed entirely on device.

## What is deliberately NOT in the plugin

- No server fallback of any kind.
- No pass/fail logic (that is `hearVerdict` in `sona.js`).
- No push notifications: no device token, no registration with Apple's push
  service. The one reminder is local, and its words are the page's.
- No audio retention, and no network or file code. Each buffer goes to
  Apple's on-device recognizer and, on Sona's own mic, as a `micpcm` event
  into this phone's own web page, and nowhere else. What the page keeps (one
  keepsake clip a day, in the phone's own storage) is the page's rule, not
  the plugin's.
