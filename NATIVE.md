# Sona — Native app (iOS) runbook

Ship the existing web app as a native iOS app via **Capacitor** — a thin native shell around `speaksona.com`. Lean free v1: **App Store presence first; push notifications as phase 2.**

`capacitor.config.json` (in the repo) already points the app at `https://speaksona.com`, so the app loads your real site + all features — and **most web updates appear instantly with no resubmission** to Apple.

---

## iOS 27: the app must start through a "scene" (25 Sep 2026)

**What happened.** Version 1.0.2 opened to a black screen and closed about half
a second later, every time, on Travis's iPhone (screen recording, 25 Sep 2026).
It closes before it asks speaksona.com for anything, so no website change can
cause it or fix it.

**Why.** Apple's rule for this year: an app built with the iOS 27 SDK (Xcode 27)
must use UIKit's *scene* life cycle, or iOS 27 refuses to launch it —
"Application failed to launch: UIScene life cycle is required for apps built
with this SDK" (Apple technote TN3187). Sona's Xcode project was generated
before Capacitor 8.5 (31 Jul 2026), the first Capacitor whose iOS template has
a `SceneDelegate`. A build from the older SDK (1.0.1) keeps working; any build
from Xcode 27 does not, on iOS 27. Phones still on iOS 26 should open it,
which is how a build can pass review and still fail for families.

**Confirm (two minutes, before changing anything):**
- iPhone: Settings → General → About → iOS Version starts with 27.
- Mac: Xcode → About Xcode starts with 27.
- `ls ios/App/App/SceneDelegate.swift` says "No such file".
- Run the project on the phone from Xcode: the console prints the message above.

**Fix (on the Mac, in this repo's folder — the one with `ios/`).** Capacitor
8.5's tools need Node 22 or newer: check `node -v` first.
```bash
git pull
npm install @capacitor/core@8.5.2 @capacitor/ios@8.5.2 @capacitor/cli@8.5.2
npx cap migrate        # answer Y, Y, then NPM
```
Ignore a warning about JDK 21: that is for Android. The output must include
these four lines. If it says "partial state" instead, stop: something was
half-done by hand, and the output says what.
- Adding UIApplicationSceneManifest to Info.plist.
- Writing SceneDelegate.swift.
- Patching AppDelegate.swift with configurationForConnecting.
- Registering SceneDelegate.swift with the Xcode App target.

Commit `package.json` and `package-lock.json` afterwards. From here on
Capacitor must stay at **8.5 or newer**: the new `SceneDelegate.swift` calls
`SceneDelegateProxy`, which Capacitor 8.4 does not have, so pinning it back
to 8.4 would stop the project compiling.

Then `npx cap open ios` and:
1. App target → General: Version **1.0.3**, Build one higher than 1.0.2's.
2. Run ▶ on the iOS 27 iPhone. Sona must open on Home ("Pick a game!"). Start
   one practice round and check the mic hears the child.
3. Product → Archive → Distribute App → App Store Connect → Upload.
4. App Store Connect: version 1.0.3, pick the build, What's New: "Fixes the app
   closing as soon as it opens on iOS 27." Submit, then ask for an **Expedited
   Review** (developer.apple.com/contact/app-store/?topic=expedite): "1.0.2
   closes immediately on launch on iOS 27 because it was built with the iOS 27
   SDK without the UIScene life cycle. 1.0.3 adopts it. Families on iOS 27
   cannot open the app."
5. If 1.0.2 went out as a *phased release*, pause it in App Store Connect now:
   that stops more iPhones auto-updating into the broken build.

A family's progress is safe: an app that cannot open keeps its data, and the
update brings it back.

**One thing the migration changes, on purpose left alone.** Capacitor's new
`SceneDelegate` starts a plain `CAPBridgeViewController`, so
`native/ios/App/MainViewController.swift` (which registers the SonaAudio
plugin) no longer runs. Only the parked books page (`story.html`) calls
SonaAudio today, so nothing a family can open changes. When books come back,
change that one line in `ios/App/App/SceneDelegate.swift` to
`MainViewController()` and test on a device. It stays out of the emergency
build so that build is exactly Capacitor's tested template.

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

## Required scene lifecycle (iOS 27 launch fix)

After generating the iOS project, install Sona's scene lifecycle before building:

```bash
python3 scripts/install-ios-lifecycle.py
# If the generated project is in another checkout:
python3 scripts/install-ios-lifecycle.py /path/to/SaaS/ios/App/App
```

This adds the scene manifest and compiles `native/ios/App/SceneDelegate.swift`
through the existing AppDelegate source entry. It preserves the existing
Capacitor storyboard, plugins, icon, signing, permissions, and orientations.
Original files are backed up to a temporary directory; repeating it is safe.
Do not separately add SceneDelegate.swift to the Xcode target.

**A successful archive is not a launch test.** Before uploading, install and
launch the build on an iOS 27 simulator and a physical device. Verify a cold
launch, background/reopen, and arrival at the family library or first-run setup.
An app built against SDK 27 without a scene configuration exits immediately.
[Apple's migration guide](https://developer.apple.com/documentation/uikit/transitioning-to-the-uikit-scene-based-life-cycle)

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

## The charter price on iOS

The web sells one yearly plan at two tiers — $59.99 for the first 50 families,
$99.99 after — and `/api/checkout` decides which at the moment of purchase
from a live Stripe count (`lib/charter.ts`). None of that reaches the App
Store build, and it must not try to: the native paywall's figure comes from
App Store Connect through RevenueCat (`iapProduct` → `priceString`), and
`subscribe.html`'s native card deliberately states no dollars and no
comparison, because a number written in this repo would out-argue the one ASC
actually charges.

To mirror the charter tier on iOS, the work is in App Store Connect, not here:
either an **introductory offer** on `com.speaksona.app.annual` (a discounted
first year — but ASC applies it per Apple ID, not per "first 50", so the cap
cannot be enforced there), or a **second product** at the standard price that
the app switches to once the web count closes. Neither exists today. Until one
does, iOS simply sells the annual product at whatever ASC lists, and the
native card describes exactly that. Do not add charter copy to the native
card ahead of the ASC change: a card that says "first 50 families" over a
price ASC controls is the same untrue promise the web half was built to avoid.

## Caseload Premium is web-only (24 Sep 2026)

"Sona Premium for your caseload" ($79.99 a year) is sold to clinicians on
speaksona.com, from the dashboard — and the dashboard never renders in the
app: `slp.html` sends a native shell straight to Home before it draws or calls
anything. So no clinician buy button can appear in the iOS build, **there is no
App Store product for this plan, and none should be created.**

What reaches the app is the result, not the sale: a family whose clinician's
caseload is covered gets Premium from the server's coverage answer, the way a
web subscription is recognised. The clinician's link opens in Safari, and the
app keeps separate storage, so the link state (the code and the enrolment
ticket) travels into the app through the move-in code; the app then asks
`/api/slp/covered` itself. The cached answer never travels. A parent's own Premium in the app stays the
existing annual in-app purchase, priced in App Store Connect. Apple accepts
access bought elsewhere only while the app also sells Premium itself and never
points a parent at buying outside it — so no page inside the app may mention
the clinician plan or a web price.
