# Sona — Native app (iOS) runbook

Ship the existing web app as a native iOS app via **Capacitor** — a thin native shell around `speaksona.com`. Lean free v1: **App Store presence first; push notifications as phase 2.**

`capacitor.config.json` (in the repo) already points the app at `https://speaksona.com`, so the app loads your real site + all features — and **most web updates appear instantly with no resubmission** to Apple.

---

## Prereqs (on your Mac)
- macOS + **Xcode** (free from the App Store) + Command Line Tools
- **Node 22+** (required by the pinned Capacitor 8 CLI)
- **CocoaPods**: `sudo gem install cocoapods`
- Your **Apple Developer account** ✅

## One-time setup (run in the repo root on your Mac)
```bash
npm ci               # installs the pinned Capacitor 8 + Keyboard packages
npx cap add ios       # generates the ios/ Xcode project
npx cap sync ios
npx cap open ios      # opens Xcode
```
> `npm install` updates `package.json` + `package-lock.json` together — commit those. (`/ios` is gitignored; commit it later only if you want CI builds.)

## Onboarding keyboard (25 Sep 2026)

The iPhone build includes `@capacitor/keyboard` 8.0.5 alongside Capacitor
8.4.1. Its config is `resize: "native"`, `style: "LIGHT"`, and
`autoBackdropColor: "dom"`. That gives the form room above the keyboard and
matches the exposed keyboard backdrop to the page. `resizeOnFullScreen` is an
Android-only workaround and is intentionally omitted.

`public/onboarding.html` hides the extra form-navigation toolbar only when the
native iOS Keyboard plugin is available. Safari and older app builds keep
working without it. The page handles safe areas itself, with
`ios.contentInset: "never"`, so do not also add automatic native insets.

This needs a **new iPhone build**, not just a website deployment. The existing
Xcode project on Travis's Mac lives at
`/Users/traviswardrop/Documents/SaaS/ios/App/App.xcodeproj`; `ios/` is ignored by
Git and is not automatically present in a worktree.

For future native updates, first bring the reviewed app code into the checkout
that owns `ios/`, preserve its icon, signing, version/build and iPad settings,
then run `npm ci` and `npx cap sync ios`. Do not sync an old checkout's `public/`
over the app's bundled files. `npx cap update ios` updates plugin registration
without copying existing bundled web files, but does **not** copy new plugin
configuration; the generated `ios/App/App/capacitor.config.json` must also
contain the Keyboard settings above. The local project was updated this way
for this keyboard change, without replacing its bundled pages.

Before submitting that build, check an actual iPhone: type a name and email;
the field and Continue button remain reachable, the extra up/down/Done toolbar
is hidden, and closing the keyboard restores the screen without a blank gap.
Repeat with a hardware keyboard or VoiceOver if used. Browser tests cannot
verify the iOS keyboard itself.

Official plugin reference: https://capacitorjs.com/docs/apis/keyboard

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
