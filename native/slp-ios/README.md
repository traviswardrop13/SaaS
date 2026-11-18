# Sona for SLPs — the clinicians' iPhone app (SLPAPP1, 16 Nov 2026)

Travis, 14 Nov 2026: "everything that is in the SLP dashboard, I want ... to be
a mobile app eventually"; 16 Nov 2026: "start building the SLP dashboard
mobile app". Asked, he chose **its own App Store app** and **never sell in the
app**.

It is a second Capacitor shell, like the family app: it loads the live
dashboard (`https://www.speaksona.com/slp.html`), so a website change is an app
change with no new App Store build. This folder holds everything that is not
the website: its config, the two offline pages, the draft icon and these
steps. The Xcode project (`ios/`) is made on a Mac and never committed.

## What makes it the clinicians' app

- `appendUserAgent: "SonaSLPApp/1"` in `capacitor.config.json`. That word is
  how the website knows it is in this app (`lib/slpApp.ts`):
  - the dashboard and its sign-in render (the family app is still sent home
    from them);
  - every other page goes to the dashboard (the middleware, `sona.js`, and the
    two front pages all check). `sona.js` also lets `/slps` through, because
    `/slp.html` redirects there: before 17 Nov 2026 the app reloaded forever;
  - every price, offer, checkout and Manage billing door is hidden
    (`[data-sells]` in `slp.html`). Sona Pro is bought on the website
    (`/plans`, since 18 Nov 2026 never inside the dashboard, web or app); a
    plan bought there still works in the app. Sona Clinic is hidden from sale
    since 18 Nov 2026; were one on, its "Your clinic" page and a member's
    clinic card would show, with no plan name, price or billing.
- Sign-in is the 6-digit code from the email (`/api/slp/auth/code`), because
  the emailed link opens in Safari and an app keeps its own cookies.
- **The dashboard needs Sona Pro** (or a Sona Clinic plan, hidden from sale since 18 Nov 2026) (SLPPRO1, 17 Nov 2026,
  Travis: "now they have to have a trial to be inside there"). An account
  without either (and without a free dashboard promised before 12 Nov 2026)
  sees one plain card in the app: "Your account doesn't have Sona Pro yet."
  and what Sona Pro opens, with Sign out and Settings. No price, no trial, no
  button or link to buy or to the website (App Store rule 3.1.1). App
  Review's account (`SLP_REVIEW_EMAIL`) stays open.
- Settings has **Delete your account** (Apple requires it for an app that
  makes accounts). **The community, and its Block, were removed on 17 Nov
  2026**: the app has no posts people write.
- **Session games** (SLPPRO1): the clinician picks a sound, word position,
  age band and session length, and may type a few words on what the child
  loves; those go to Anthropic to pick three of Sona's own games. **Play now
  opens the game in the app** (SESSPLAY1), set to that sound, with a
  temporary profile: nothing is saved to a family and nothing is sent. The
  game listens to the child, so the app now uses the **microphone**.

## Build it on the Mac (one time)

1. `cd native/slp-ios && npm install`
2. `npm run setup` (runs `npx cap add ios && npx cap sync ios`)
3. `npm run open` (opens Xcode)
4. In Xcode, target **App**:
   - **Signing & Capabilities:** your team; bundle id `com.speaksona.slp`.
   - **General › Display Name:** `Sona for SLPs` (Travis's to change).
   - **App icon:** drag `assets/icon-1024.png` into `App/Assets.xcassets/AppIcon`
     (a draft: Echo on the dashboard's navy; Travis's to replace).
   - **Info.plist:** add `NSMicrophoneUsageDescription` (Privacy -
     Microphone Usage Description): "Sona listens to the child's practice
     words during a game. Audio stays on this device and is never saved."
     Session games' Play now runs Sona's games in the app, and they listen.
     The app uses no camera, location or notifications. (The Xcode project is
     made on the Mac and never committed, so this is a step, not a file.)
5. Run it on your iPhone. Check:
   - it opens on the sign-in screen; "Email me a code"; the code from the
     email signs you in; Sign out and back in;
   - no price, "Start my free trial" or "Manage billing" anywhere (the side
     menu, the top bar, Settings);
   - the top of every screen sits below the clock and the camera (the web
     view is inset for them: `contentInset: automatic`);
   - Settings › Your data › "Share CSV" opens the share sheet;
   - Session games: pick a sound and age, Find Sona games, then Play now on
     a pick. iOS asks for the microphone once; the game listens; its ✕ (or
     Back home) returns to Session games. Nothing in the game shows a price,
     setup or Home;
   - an account with no Sona Pro: the one plain card, no price, Sign out works;
   - airplane mode: the "Can't reach Sona" page, and Try again works.

## App Store Connect

1. **New app**: platform iOS, name "Sona for SLPs" (or Travis's pick), bundle
   id `com.speaksona.slp`, SKU `sona-slp`.
2. **Category:** Medical or Education (Travis's call); **age rating:**
   answer "user-generated content: no" (the community was removed on 17 Nov
   2026; Session games' picks are shown only to the clinician who asked),
   everything else no. If "yes" was already answered, change it.
3. **App Privacy:** Contact Info › Email Address (App Functionality, linked to
   the user); User Content › Other (the few words a clinician types into
   Session games about what a child loves, sent to the AI provider to pick
   games, not stored; Travis's call whether it is "linked"); Audio: none
   collected (a game listens on the device and keeps nothing); no tracking.
   (User Content › Other no longer means community posts: those are gone.)
   The caseload the app shows (children's first names and practice) comes
   from families' phones with their consent, not from the clinician's phone:
   how to label it is Travis's call (with whoever advises him on privacy).
4. **Review information:** App Review cannot read an email, so give it a
   demo account:
   - in Vercel, set `SLP_REVIEW_EMAIL` (an address only you use, e.g.
     `appreview@speaksona.com`) and `SLP_REVIEW_CODE` (6 digits). That one
     address gets an open dashboard, so the reviewer sees a working app; the
     server recognises it by the address, never by anything the app sends;
   - in the review notes: "Sign in: type the email, tap Email me a code, then
     type the code. Email: … Code: …";
   - after approval, delete both variables (the door closes) or keep them for
     the next review.
5. **Review notes**, to paste: "Sona for SLPs is the free companion app for
   speech-language pathologists who use Sona with families. Clinicians sign
   in with a code sent to their email. The app sells nothing: there are no
   purchases, prices or links to purchase. Session games picks Sona games
   for a speech session with AI and plays them on the device, listening to the
   child's practice words on the device only. An account needs a Sona Pro
   subscription bought on speaksona.com; the review account below has one. Settings › Delete your account deletes the account and its data."

## Known and left

- **Apple's "minimum functionality" rule (4.2):** an app that shows a website
  can be refused as "a repackaged website". The family app passed with
  native parts (the microphone, notifications); this one has none yet. If
  review refuses it, the usual fix is one native feature (for example, a
  notification when a child practices); that is a next step, not built.
- A clinician whose paid plan still renews cannot delete the account until the
  plan is cancelled (on the website: Settings › Manage billing), or by email.
  Being on someone else's Sona Clinic plan never stops it: only a plan the
  clinician pays for themselves does.
- Nothing here is Rachel's: the dashboard's words and rules are unchanged.
