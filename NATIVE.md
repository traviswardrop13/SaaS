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
