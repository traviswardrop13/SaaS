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
on Capacitor 8.4, whose template has no scene setup. A build from the older
SDK (1.0.1) keeps working; any build from Xcode 27 does not, on iOS 27.
Phones still on iOS 26 should open it, which is how a build can pass review
and still fail for families.

**The fix is `scripts/install-ios-lifecycle.py`** (#149, 25 Sep 2026; see
"Required scene lifecycle" below). It adds the scene manifest and Sona's own
`SceneDelegate` (`native/ios/App/SceneDelegate.swift`, compiled through
AppDelegate.swift), keeps Main.storyboard (so `MainViewController` and the
SonaAudio plugin stay) and **needs no Capacitor upgrade**: it uses
`ApplicationDelegateProxy`, which Capacitor 8.4 has. An earlier version of
this section said to upgrade to 8.5.2 and run `npx cap migrate`; do not do
both — the script is the one fix.

**Then ship it:**
1. Run the script, then App target → General: Version **1.0.3**, Build one
   higher than 1.0.2's.
2. Run it on an iOS 27 iPhone: Sona must open on Home ("Pick a game!"). Start
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

## Apple's listening check (28 Sep 2026)

**What happened.** Apple's on-device speech check (the SonaSpeech plugin, in
`plugins/sona-speech`) was written on 31 Aug and never reached the app. Nothing
compiled it, nothing registered it, and Info.plist had no speech-permission
text. So every build through 1.0.3 judged each practice try by the sound-shape
check alone, and a child who said "taco" for R got it counted.

**The fix is one script, then a new build:**
```bash
python3 scripts/install-ios-speech.py
```
It compiles the plugin through AppDelegate.swift (like the scene fix above),
registers it (in MainViewController if the storyboard loads one, otherwise
through a small SonaBridgeViewController it points the storyboard at, and any
code that builds Capacitor's controller: Capacitor 8.5's SceneDelegate does), and
adds NSSpeechRecognitionUsageDescription. `--check` shows what it would change.
**Build 6 opened to a black screen** (28 Sep 2026): the script's first version
named SonaBridgeViewController in the storyboard by a bare name, which iOS
cannot resolve for a subclass of Capacitor's binary framework until Swift code
has touched it. It now names the app's module, as Capacitor does for
MainViewController; running it again repairs a project left the old way. Then build to a real iPhone, check
`window.Capacitor.Plugins.SonaSpeech` in Safari's Web Inspector, and run the
device checklist in `SPEECH_PLUGIN.md` before archiving. The judging rules
live in `public/sona.js` and go live with the website; only the plugin needs
the new build.

## Sona's own microphone (12 Oct 2026)

**What a family notices today.** The moment Echo listens, the iPhone app acts
as if it were on a phone call: the volume buttons move call volume, and
AirPods drop to phone-call quality. WebKit does that whenever a web page uses
the mic, and the app cannot change it. In the next build, the SonaSpeech
plugin opens the mic itself in ordinary recording mode and hands the sound to
the page; every "did that count" bar is unchanged, and no audio leaves the
phone.

It needs a **new iPhone build**. Builds already in the App Store do not have
it, so the website can go live first and those phones keep today's mic. The
Mac steps (one line in `ios/App/App/capacitor.config.json`, the speech
script again, and deleting `configureAudioForAutoplay` if it is there), the
phone checklist, the gate before submitting and the off switch
(`NATIVE_MIC_ON` in `public/sona.js`, a website deploy) are in
`SPEECH_PLUGIN.md`, "Sona's own microphone". No Info.plist change:
`NSMicrophoneUsageDescription` is already required (below), and the mic is
never used in the background.

## The trial reminder (22 Oct 2026, iOS 1.0.9)

**What a family sees.** Near the end of setup, after "<Name>'s practice is
ready", one screen asks "Want a reminder before your free trial ends?". "Turn
on reminders" shows iOS's own Allow box. If they allow it and start the free
trial, the phone shows one notification the day before the trial ends: "Sona /
Your free trial ends tomorrow." (Travis: "notify them a day before their
trial ends"). It comes 30 hours before the end, not 24: Apple counts a cancel
only at least 24 hours before the end, so a reminder at exactly a day before
came too late to act on. So it shows six hours before the time of day the
trial started, and it shows even
while Sona is open (as a silent banner then: a game's mic may be listening). Each day Sona is opened it checks the trial with
RevenueCat: once the parent has cancelled it, or it has become a paid plan
(a switch to the yearly plan, say), the reminder is taken back.

**It is a local notification, not a push.** The phone sets it and the phone
shows it, through Sona's own plugin (SonaSpeech: `notifyStatus`, `notifyAsk`,
`notifySchedule`, `notifyCancel`). No server sends it, there is no device
token, and nothing about the family leaves the phone for it. So **nothing to
turn on in Xcode or at Apple**: no Push Notifications capability, no APNs key,
no Background Modes, no Info.plist text (the Allow box is iOS's own words).
"Phase 2 — Push notifications" below is a different, later thing and is not
needed for this.

**On the Mac, for 1.0.9:** `git pull`, then
`python3 scripts/install-ios-speech.py --check` and the same without
`--check` (it copies the new plugin in between its markers in
AppDelegate.swift, exactly as for the mic), Version **1.0.9**, Build one
higher, run on the iPhone, and the phone checklist in `SPEECH_PLUGIN.md`
("The trial reminder"). The website half (the setup screen, when to set the
reminder and its words) goes live with a normal merge; older builds have no
reminder methods, so they never show the screen.

**App Store Connect:** App Privacy has nothing new for this (nothing is
collected). In the review notes for 1.0.9: "During setup the app offers to
turn on notifications so it can remind the parent once, the day before the
App Store free trial ends (30 hours before, so cancelling still counts). It is a local notification scheduled on the
device; there is no push service and nothing is sent to a server."

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

## Cream behind the page, not white (27 Sep 2026)

Travis saw white strips at the top and bottom of Home when he scrolled past
either end. Two halves fix it:

- **Web, already live:** `public/sona.css` sets `overscroll-behavior: none`, so
  app pages stop at their ends instead of bouncing. Capacitor sets
  `bounces = false`, but from iOS 16 WebKit takes bounce from this CSS
  property, so the native setting alone stopped holding.
- **Native, next iPhone build:** `ios.backgroundColor` in `capacitor.config.json`
  is `#fff6e9`, Home's cream. Capacitor paints the web view and its scroll view
  with it. Without it they use the system background: white, or black in dark
  mode. That is what any bounce shows, and it is also the flash before the
  first page draws. `npx cap sync ios` copies the setting into
  `ios/App/App/capacitor.config.json`; check that file has it before archiving.

Check on the phone: pull Home down past the top and up past the bottom. No
white.

## In Xcode
1. **App** target → **Signing & Capabilities** → check **Automatically manage signing** → choose your **Team** (your Apple account).
2. **Bundle Identifier** = `com.speaksona.app` (matches `appId`; Xcode can create the App ID for you).
3. **General** → Display Name **Sona**, Version 1.0.
4. Add your **app icon** (1024×1024) in Assets.
5. Pick a simulator or your plugged-in iPhone → **Run ▶**. It should open and load Sona.

## Required permission (or it crashes on mic use)
In `Info.plist` add:
- **NSMicrophoneUsageDescription** = "Sona uses the microphone so your child can practice saying their sounds."
- **NSSpeechRecognitionUsageDescription** — `scripts/install-ios-speech.py` adds it. iOS closes the app if the speech permission is asked without it.

## Echo's real voice on auto-spoken lines (nothing to add in Xcode)

**Symptom:** lines the app speaks *by itself* on opening a screen — charge.html's
"Ready? Say rrrr… Go!" — come out in the flat robot voice, while the same line
tapped by hand sounds like Echo.

**Cause:** not ElevenLabs credits. `/api/tts` answers 200 the whole time. Every
page load creates a NEW `AudioContext`, and WKWebView starts it *suspended*
until a user gesture, so `sona.js` cannot play the fetched audio and falls back
to `speechSynthesis`.

The web fix already shipped — an auto-spoken line now WAITS for the first tap
and then speaks in Echo's voice, instead of robot-voicing immediately. That
alone fixes it everywhere.

**Nothing to add in Xcode for the wait.** The setting that removes it in the
app is the web view's `mediaTypesRequiringUserActionForPlayback = []`, with
`allowsInlineMediaPlayback = true`. It is not in `capacitor.config.json`, but
Capacitor's own bridge already sets both (`CAPBridgeViewController.swift`,
Capacitor 8.4.1), so every build has it.

**Do not add the `configureAudioForAutoplay()` this section once suggested; if
it is in `ios/App/App/AppDelegate.swift`, delete it and the line that calls
it** (12 Oct 2026). It put the whole app's audio session into `.playAndRecord`
with `.measurement` and `.allowBluetooth` at launch: measurement mode (no
automatic gain on the mic) and hands-free Bluetooth, which drops AirPods to
phone-call sound quality. That is what Sona's own microphone exists to remove
(its section is above). The SonaSpeech plugin sets the session itself, only
while a listen is open, and afterwards leaves it as `.ambient`: plain media
that follows the ring/silent switch (15 Oct 2026, Travis: "Everything off" on
silent; it was `.playback`, which ignores the switch, until then). That is
what the robot fallback voice plays on. WebKit's own sounds (Echo's voice, the
chimes) follow the switch through the page instead: on Sona's own mic every
page sets `navigator.audioSession.type` to `"transient-solo"` (`sona.js`, THE
SILENT SWITCH). The page half is a web deploy; the `.ambient` half needs a
new App Store build. To take the page half out, set `AUDIO_SESSION_TYPE` to
`"auto"` and deploy. Never revert it, or roll the website back past it, while
a build with `micOpen` is in families' hands: WebKit would refuse its own
mic, the off switch's included, until the app is closed and opened again
(`SPEECH_PLUGIN.md`, "Taking it out").

**Check it on the phone:** open a practice round *without touching the screen*.
If "Ready? Say rrrr… Go!" is Echo, the setting applies. If it is still the
robot, the web fallback is doing its job and the page waits for a tap; tell
Claude, because the fix is not in AppDelegate.

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
- **Coins (Trophy Road, 11 Oct 2026):** Coins are earned only through daily chests and Trophy Road gifts and are never sold: no consumable in-app purchase, and no random rewards (every prize is shown before it opens).
- **Session recording (15 Oct 2026, REPLAY1):** PostHog may record parent setup (until the hand-off) and the plan screen's offer when a grown-up opened it (from setup, or after the first practice run) inside the app, as a replay of the page and where it was tapped, under the anonymous device id. The child's name is recorded only as "[child]", a piece of recording that would still hold a child's name or a parent's email is not sent, and every typed box is an empty shape; the speech therapy question and the ready screen are never in a recording; no child's practice, game or book screen ever is. In App Privacy that is *Usage Data → Product Interaction* (App Functionality / Analytics, not tracking), with the device id as the identifier: add it when the answers below are filed.
- **RevenueCat webhook (16 Oct 2026, RCHOOK1):** a parent's email (setup's email step or, since 23 Oct 2026, the weekly report's switch in Settings, only if given) now goes to RevenueCat too, and RevenueCat tells Sona's server when that parent's Premium starts, renews, is cancelled or ends. In App Privacy: *Contact Info → Email Address* (already there for the list; add App Functionality, since RevenueCat links it to the purchase) and *Purchases → Purchase History*, linked to the user, purposes App Functionality and Developer's Advertising or Marketing (it decides which of Sona's own emails a parent gets), not tracking. No review needed.
- **Free-week report (30 Oct 2026, TRIAL1):** the app now also gives RevenueCat the anonymous device id (the `sona_fid` attribute), so RevenueCat's webhook can say how a free trial went for a family who gave no email; Sona's server keeps, per trial, which days had practice (yes or no) and how it ended, for 120 days. In App Privacy: *Identifiers → Device ID*, linked to *Purchases → Purchase History*, purposes Analytics and App Functionality, not tracking. No review needed, and no new build: the phone side is a web change. The daily practice reminder (NUDGE1) uses the 1.0.9 notification methods already in the build, so it needs no new build either.
- **App Privacy, owed (not yet answered in App Store Connect):** the anonymous device id and the product-interaction events `/api/track` already relays (practice started and completed, the daily goal, the plan funnel), now including the chest, Trophy Road gift, month gift, Buddy Shop ("shop item got") and game-level events. None carries a name, a count of trophies or coins held, or audio. The practice and daily-goal events do carry the sound being practised (for example "R"), as the privacy page says, and "shop item got" carries the item and its price in coins, never a balance.

## Apple Guideline 4.2 ("minimum functionality")
A pure website-in-a-box can be rejected. Your app has native value (mic-based practice; push next), which helps it pass. If review pushes back, the fix is more native features → do phase 2.

## Phase 2 — Push notifications (the retention lever; after v1 ships)
Not needed for the trial reminder (above): that one is local and set on the
phone. This is for messages a server sends.
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

## Making the app the only shop for families (built 1 Oct 2026; switched on 2 Oct 2026)

**2 Oct 2026: `WEB_SALES` is `false`** (Travis: "turn off payments on
website"). That day both products were attached to RevenueCat's `full`
entitlement, the yearly price was set to $59.99 from 4 Oct with a 3-day free
trial, `com.speaksona.app.monthly` was created at $9.99, a sandbox purchase on
his iPhone unlocked Premium, and 1.0.5 (build 8, with the purchase plugin)
went to App Review. Until 1.0.5 is live nobody can buy Premium anywhere. The
rest of this section is the 1 Oct record of why it first shipped `true`.

Travis: "i dont want them paying on the website". `WEB_SALES`
(`lib/pricing.ts`, `public/sona.js`) set to `false` switches the family web
checkout off: the website refuses to start a purchase, and a browser family
is told Premium is in the iPhone and iPad app. Nothing in the app reads that
switch. **It shipped `true`**, because on 1 Oct 2026 the app could not sell at
all, and switching the website off too would have left no way to buy. What has
to be true of this build before it goes `false`:

1. **Every purchase is Apple's**, so three checks that used to matter only
   for iPhone families decide whether anyone can buy at all:
   - **The build carries the purchase plugin.** `subscribe.html` shows the
     Apple card only when `Capacitor.Plugins.Purchases` exists
     (`Sona.iapAvailable()`). The App Store's 1.0.4 does not have it: the iOS
     project in `~/Documents/SaaS` lists only `@capacitor/keyboard` in
     `package.json` and `ios/App/CapApp-SPM/Package.swift`, and the 1.0.4
     archives hold no RevenueCat code (1.0.3 build 6 did, so it was dropped
     between 25 and 28 Sep). The fix is in that project, then a new build
     through App Review: `npm i @revenuecat/purchases-capacitor`, `npx cap
     sync ios`, check `packageClassList` in the built app's
     `capacitor.config.json` names `PurchasesPlugin`. To check any archive:
     `strings <App.app>/App | grep -ci revenuecat` (0 means no buy button).
   - **App Store Connect:** the product is approved and on sale, at the price
     Travis wants. On 1 Oct 2026 the App Store listing showed "Sona Yearly" at
     **$79.99**, while its description said $59.99 a year.
   - **RevenueCat:** the product is attached to the `full` entitlement. On
     1 Oct 2026 `com.speaksona.app.annual` was attached to **no** entitlement
     (only `com.speaksona.app.lifetime` unlocked `full`), so a purchase would
     have been taken by Apple and left the app locked. Anyone can check this
     without the dashboard: `GET https://api.revenuecat.com/v1/product_entitlement_mapping`
     with the app's public key (`IAP_KEY` in `sona.js`) as the bearer token.
2. **A purchase in the app unlocks the app, not the website.** The browser
   only ever learns of a purchase from Stripe.
3. **Settings › Account's "See Premium" opens the plan screen**
   (`/subscribe.html`, the Apple card). It used to open the web `/subscribe`
   page, which sent the app back to Home.

## The charter price on iOS

(With web sales off, see above, nobody new can take a charter spot: the
charter was a web price. What follows is how the tiers worked while the
website sold, and still does if the switch goes back.)

The web sells the yearly plan at two tiers — $59.99 for the first 50 families,
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

## The iPhone sells one plan: Sona Monthly, 3 days free (5 Oct 2026)

**Since the option-B setup (5 Oct 2026) the card is painted by `sona.js`, not
by the page.** `Sona.storePlan()` asks for the monthly product (the same
`iapProduct("monthly")` call), asks the plugin whether this Apple ID can still
have the free days (`checkTrialOrIntroductoryPriceEligibility`) and whether it
already holds `full` (one `syncPurchases` per app launch at most), and
`Sona.planWords()` gives the card its words. The two screens that used to come
before the price are gone: a two-row timeline on the price screen replaces
them. What follows describes the same rules; where it says `paintIap()`, read
`storePlan()` + `planWords()`. Worth one run on a real phone after any change
here: a paying family who reinstalls should skip the price; cancelling Apple's
sheet should show nothing; a purchase on the setup price screen should come
back to the microphone screen.

Travis, 5 Oct 2026: "get rid of the annual option and update the copy so that
it says three days free, then $9.99 a month". The same day he gave
`com.speaksona.app.monthly` an introductory offer in App Store Connect (free
for the first 3 days, from 4 Oct, no end date); 1.0.5 was Ready for
Distribution. What has to stay true on the store side:

1. **App Store Connect:** `com.speaksona.app.monthly` approved and on sale at
   the monthly price, with its 3-day free introductory offer. An introductory
   offer is a price setting: adding, changing or ending one needs no app build
   and no review. Each Apple ID gets one introductory offer per subscription
   group, so someone who already used free days (on either product) is
   charged at once; Apple's sheet says so before anyone pays.
2. **RevenueCat:** that product attached to the `full` entitlement. If it is
   not, Apple takes the payment and the app stays locked (the card then says
   to tap Restore Purchases, never "nothing was charged").
3. **The yearly product is NOT removed from sale.** Apple's help says removing
   a subscription from sale stops renewals as well as sign-ups, so anyone who
   bought it would lose it; it costs nothing to leave it listed. The plan
   screen simply no longer offers it, and `IAP_PRODUCTS.annual` stays in
   `sona.js` so a yearly buyer is still recognised on a restore.

`subscribe.html`'s Apple card is one box: the price and the free days in its
markup are placeholders ($9.99, 3 days), repainted from
`Sona.iapProduct("monthly")` the moment the store answers. A monthly product
with no free trial turns every line into "charged today" (and the two screens
before the price at the end of setup are skipped). A store that has no
monthly product, or answers with the yearly one, sells nothing in its place.
The card never states a saving: the price is Apple's.

## Two rows: monthly on top, the one payment under it (23 Oct 2026)

Travis, 23 Oct 2026: "get rid of the yearly option. I just want two payment
options", then "can we just have the ... a month as the top default option and
then below it is the pay one time?". The Apple card shows no yearly row,
whatever RevenueCat's offering lists (`IAP_SELL_YEARLY = false` in
`public/sona.js`; the yearly product stays in App Store Connect and in
`IAP_PRODUCTS` so a yearly buyer still restores). Monthly is on top and picked
when the screen opens (its free trial), the one payment under it. A web
deploy only: no app build, no store change. Taking the yearly package out of
the current offering in RevenueCat is tidy but not needed. **Phone check:**
the price screen shows two rows, Monthly (picked) then One payment, and no
"/yr" anywhere.

## Two plans again, and the store's free days (19 Oct 2026)

Travis, 19 Oct 2026, "yes" to a funnel review: the price screen offers yearly
above monthly again, yearly picked, and the free days are whatever the store
says. This replaces "one plan" above for the Apple card only; the web card is
unchanged. Nothing here needs an app build: it is all store settings and a
web deploy.

1. **App Store Connect:** give both products a one-week free introductory
   offer (`com.speaksona.app.monthly`, and `com.speaksona.app.annual`). The
   card reads each product's own offer, so a row shows "7 days" once its
   product has a week, and "3 days" while it still has three. Apple gives one
   introductory offer per subscription group, so someone who used free days
   on either product is charged at once; Apple's sheet says so first.
2. **RevenueCat, in this order:** attach `com.speaksona.app.annual` to the
   `full` entitlement, **then** add it to the current offering. The card
   shows the yearly row only when `getOfferings()` lists it in the current
   offering; attached to `full` but not offered, nothing changes. Offered but
   not attached, Apple would take a parent's money and unlock nothing, which
   is why the order matters.
3. **The yearly price:** check it is still the one Travis wants (set to
   $59.99 from 4 Oct 2026, above). The card shows
   "Best value" only when Apple's yearly price is below twelve monthly ones,
   and never a saving in dollars or a ratio.

To take the yearly row off again, remove the product from the current
offering in RevenueCat: the card goes back to the monthly row alone, and a
yearly buyer is still recognised on a restore.

## One payment, a third row (22 Oct 2026, for iOS 1.0.9)

Travis, 22 Oct 2026: "ok go build it all", the one-time purchase on the price
screen; "i dont wanna say lifetime". The card can show a third row under
monthly: **"One payment"**, "Yours to keep. No subscription.", the App
Store's price with no period; picked, the button says "Get Sona Premium —
$59.99" (the store's price). It is never picked when the screen opens
(monthly is), never says "lifetime", "free" or "Best
value", and has no free days. The web card is unchanged: the website sells
subscriptions only. Nothing here needs code: the row appears by itself once
these are true, in this order (the same order as the yearly row, for the
same reason: offered but not attached, Apple would take a parent's money and
unlock nothing):

1. **App Store Connect:** the Non-Consumable with product ID
   `com.speaksona.app.lifetime` **already exists**: it is July 2026's "Sona
   Lifetime" ($79.99), and App Store Connect never lets a product id be used
   twice. So EDIT it, do not create one: reference name "Sona Premium, One
   Payment", display name (App Store Localization) "Sona Premium, One
   Payment", price $59.99 (or the price Travis wants: the card shows whatever
   Apple answers). Apple's own buy sheet shows the display name, so a
   leftover "Sona Lifetime" would put the word on screen. (22 Oct 2026:
   Travis's App Store Connect showed it being edited, "Ready for Review", in
   the 1.0.9 draft.) A non-consumable has no introductory offer; if one ever
   came back with free days, the card would show no row. Submit it with the
   build (a first in-app purchase goes to review with an app version). If the
   old product was ever deleted, make a new one with a NEW id and keep the old
   id in `IAP_PRODUCTS` so a July buyer still restores.
2. **RevenueCat:** the product is likely already there and already in the
   **`full`** entitlement (on 1 Oct 2026 it was the one product attached to
   it). Check it is attached to **`full`**
   (the one every Premium check reads), **then** add a package for it to the
   **current offering**: the built-in **Lifetime** package type (`$rc_lifetime`)
   or a custom one, either works. The card shows the row only when the current
   offering lists the product; attached but not offered, nothing changes.
3. **Check on a phone** (TestFlight, a sandbox Apple ID): the three rows,
   then a tap on "One payment" and the button. Premium switches on, and
   Restore Purchases on a reinstall finds it again (the same `full`
   entitlement). The webhook needs nothing new: RevenueCat tells Sona of it as
   a `NON_RENEWING_PURCHASE`, which `lib/revenuecat.ts` already files as
   "paid" (so the welcome emails stop, and no free-days note is ever queued).

To take the row off again, remove the package from the current offering in
RevenueCat. Never remove the product itself from sale in a way that breaks
restores: anyone who bought it keeps Premium, and `IAP_PRODUCTS.lifetime`
stays in `sona.js` so a restore recognises them.

App Store Connect's App Privacy answers need no new line for it: it is a
purchase, already listed with the subscriptions.

## RevenueCat webhook (16 Oct 2026, RCHOOK1)

RevenueCat tells Sona's server whenever an App Store purchase of Sona Premium
starts, renews, is cancelled or ends (`app/api/revenuecat/route.ts`,
`lib/revenuecat.ts`). The app hands RevenueCat the parent's email (setup's
email step, or the weekly report's switch in Settings), so each message names the parent, and RevenueCat's own
dashboard shows that email instead of ANONYMOUS. Sona then stops the welcome
series for a buyer, sends "Your free days end soon" a day or
two before the free days end (only while they are still on them), and "We
miss you at Sona" a day after a plan ends. A family who gave no email stays
anonymous, and gets none of this. If the subscription later moves to
another device's RevenueCat customer (the child's iPad on the same Apple ID,
set up with no email: RevenueCat sends TRANSFER), Sona marks that address
"moved" on /leads.html and sends it no free-days note.

To switch it on (Travis, once; nothing to build in Xcode):

1. **Vercel:** add `REVENUECAT_WEBHOOK_AUTH`, a long random value (16+
   characters, for example `Bearer ` and 32 random letters and digits), and
   redeploy. Open https://www.speaksona.com/api/revenuecat: `"auth": true`.
2. **RevenueCat:** Integrations → Webhooks → add one. URL
   `https://www.speaksona.com/api/revenuecat` (with the www: the bare
   speaksona.com answers a 308 redirect, which RevenueCat does not follow, and
   its test event shows 308 instead of 200); **Authorization header value**:
   exactly the same value as in Vercel; environment **Production** (Apple's
   sandbox, TestFlight and App Review, is left out); every event type. To
   try it with a test purchase on a TestFlight build, it takes both: set
   `REVENUECAT_SANDBOX=1` in Vercel AND switch this webhook's environment
   to Sandbox (or both) in RevenueCat; put both back afterwards.
3. **Send test event** in RevenueCat: it should show 200. (A test changes
   nothing at Sona.)
4. To change the secret later without a gap: copy the old value to
   `REVENUECAT_WEBHOOK_AUTH_PREV`, set the new one in both places, then
   delete the old one.

Existing payers show up as they come: the next time the app opens, it hands
RevenueCat the email, and their next renewal brings it to Sona.

## The clinician plans are web-only (24 Sep 2026; re-priced 29 Sep 2026)

"Sona Premium for you" ($59.99 a year, the clinician's own phone) and "Sona
Premium for your caseload" ($59.99 a year more, every family on their link)
are sold to clinicians on speaksona.com, from the dashboard — and the
dashboard never renders in the app: `slp.html` sends a native shell straight
to Home before it draws or calls anything. So no clinician buy button can
appear in the iOS build, **there is no App Store product for either plan, and
none should be created.** The clinician's own Premium reaches their phone the
same way a family's coverage does: by a link, and the server's answer to the
ticket it earns.

What reaches the app is the result, not the sale: a family whose clinician's
caseload is covered gets Premium from the server's coverage answer, the way a
web subscription is recognised. The clinician's link opens in Safari, and the
app keeps separate storage, so the link state (the code and the enrolment
ticket) travels into the app through the move-in code; the app then asks
`/api/slp/covered` itself. The cached answer never travels. A parent's own Premium in the app stays the
existing in-app purchase (Sona Monthly since 5 Oct 2026, and Sona Yearly again once RevenueCat's current offering lists it, 19 Oct 2026), priced in App Store Connect. Apple accepts
access bought elsewhere only while the app also sells Premium itself and never
points a parent at buying outside it — so no page inside the app may mention
the clinician plan or a web price.
