# Sona — Native app (iOS) runbook

Ship the existing web app as a native iOS app via **Capacitor** — a thin native shell around `speaksona.com`. Lean free v1: **App Store presence first; push notifications as phase 2.**

`capacitor.config.json` (in the repo) already points the app at `https://speaksona.com`, so the app loads your real site + all features — and **most web updates appear instantly with no resubmission** to Apple.

---

## Prereqs (on your Mac)
- macOS + **Xcode** (free from the App Store) + Command Line Tools
- **Node 18+**
- **CocoaPods**: `sudo gem install cocoapods`
- Your **Apple Developer account** ✅

## One-time setup (run in the repo root on your Mac)
```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap add ios       # generates the ios/ Xcode project
npx cap sync ios
npx cap open ios      # opens Xcode
```
> `npm install` updates `package.json` + `package-lock.json` together — commit those. (`/ios` is gitignored; commit it later only if you want CI builds.)

## In Xcode
1. **App** target → **Signing & Capabilities** → check **Automatically manage signing** → choose your **Team** (your Apple account).
2. **Bundle Identifier** = `com.speaksona.app` (matches `appId`; Xcode can create the App ID for you).
3. **General** → Display Name **Sona**, Version 1.0.
4. Add your **app icon** (1024×1024) in Assets.
5. Pick a simulator or your plugged-in iPhone → **Run ▶**. It should open and load Sona.

## Required permission (or it crashes on mic use)
In `Info.plist` add:
- **NSMicrophoneUsageDescription** = "Sona uses the microphone so your child can practice saying their sounds."

## Echo's real voice on auto-spoken lines (Xcode, 5 minutes)

**Symptom:** lines the app speaks *by itself* on opening a screen — charge.html's
"Ready? Say rrrr… Go!" — come out in the flat robot voice, while the same line
tapped by hand sounds like Echo.

**Cause:** not ElevenLabs credits. `/api/tts` answers 200 the whole time. Every
page load creates a NEW `AudioContext`, and WKWebView starts it *suspended*
until a user gesture, so `sona.js` cannot play the fetched audio and falls back
to `speechSynthesis`.

The web fix already shipped — an auto-spoken line now WAITS for the first tap
and then speaks in Echo's voice, instead of robot-voicing immediately. That
alone fixes it everywhere. The change below removes the wait in the iOS app, so
the line plays the moment the screen opens.

**This cannot be done in `capacitor.config.json`** — Capacitor does not expose
`mediaTypesRequiringUserActionForPlayback`. It is a few lines in the Xcode
project. In your Capacitor iOS app, edit `ios/App/App/AppDelegate.swift` (or a
`CAPBridgeViewController` subclass if you have one):

```swift
import Capacitor
import AVFoundation

// Let the web layer start audio without a tap, and keep it audible with the
// ringer switch off — Sona's whole point is a child hearing the model sound.
extension AppDelegate {
  func configureAudioForAutoplay() {
    try? AVAudioSession.sharedInstance().setCategory(
      .playAndRecord,                 // .playAndRecord: practice needs the mic too
      mode: .measurement,             // matches the clean-capture mode the scorer wants
      options: [.defaultToSpeaker, .allowBluetooth]
    )
    try? AVAudioSession.sharedInstance().setActive(true)
  }
}
```

and, where the bridge view controller is created, before it loads:

```swift
webView.configuration.allowsInlineMediaPlayback = true
webView.configuration.mediaTypesRequiringUserActionForPlayback = []   // [] = none
```

**Verify it worked:** open a practice round *without touching the screen*. If
"Ready? Say rrrr… Go!" is Echo, it took. If it is still the robot, the web
fallback is doing its job and the WKWebView setting did not apply — check that
you edited the controller that actually loads the bridge.

**Caveat worth knowing:** `mediaTypesRequiringUserActionForPlayback` is
documented for media *elements*. Web Audio (which is what Sona uses) usually
follows it in WKWebView, but Apple has changed autoplay behaviour between iOS
versions. That is exactly why the web-side wait shipped too — it is the fix
that cannot regress out from under you.

## Ship it
1. Xcode → **Product → Archive**
2. **Distribute App → App Store Connect → Upload**
3. In **App Store Connect**: create the app, add the build, fill the listing (below), submit for review (Apple review ≈ 1–3 days).

## Listing (have these ready)
- **Name:** Sona — Speech Practice for Kids
- **Category:** Education · **Age rating:** 4+
- **Screenshots:** required sizes (capture from a device/simulator)
- **Privacy "nutrition label" (be accurate):** collect **email** (account); audio is **processed for scoring**; recordings **stay on the device**; no in-app third-party ad tracking
- **URLs:** Privacy `speaksona.com/privacy`, Support `speaksona.com/support`

## Apple Guideline 4.2 ("minimum functionality")
A pure website-in-a-box can be rejected. Your app has native value (mic-based practice; push next), which helps it pass. If review pushes back, the fix is more native features → do phase 2.

## Phase 2 — Push notifications (the retention lever; after v1 ships)
```bash
npm install @capacitor/push-notifications
npx cap sync ios
```
- Create an **APNs Auth Key** in Apple Developer; add the **Push Notifications** capability in Xcode.
- Register the device token, store it, and send daily nudges ("Time to practice with Leo!"). **OneSignal** is the easiest way to send.
- This is what makes native worth it for retention — but ship the wrapper first.

## Updating later
The app loads `speaksona.com`, so **web deploys update the app with no resubmission.** You only resubmit to Apple when you change native bits (icon, push, plugins, config).

## Android (optional — no Mac needed, cheaper, faster review)
```bash
npm install @capacitor/android
npx cap add android
npx cap open android   # Android Studio
```
Same config; Google Play is $25 once and reviews faster.
