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
    two front pages all check);
  - every price, offer, checkout and Manage billing door is hidden
    (`[data-sells]` in `slp.html`). Sona Pro is bought on the web; a plan
    bought there still works in the app.
- Sign-in is the 6-digit code from the email (`/api/slp/auth/code`), because
  the emailed link opens in Safari and an app keeps its own cookies.
- The app's sign-in opens the **free dashboard** (the homepage's door), so no
  clinician meets a locked dashboard they cannot unlock in the app.
- Settings has **Delete your account** (Apple requires it for an app that
  makes accounts). Since SLPCLEAN1 (17 Nov 2026) the dashboard shows no
  community, so the app carries no posts by other people (the server still
  keeps report, block and delete for posts made before).
- **Plan activities** sends the text a clinician types to Anthropic to write
  activity ideas; the page asks them not to type a child's name.
- **Share with family** opens the iOS share sheet with the existing invite
  message. The clinician chooses the recipient and delivery app. Today
  shows invite creation, joining, and the first shared practice from the
  caseload. A family has to opt into sharing before practice can appear.

## Build it on the Mac (one time)

1. `cd native/slp-ios && npm install`
2. `npm run setup` (runs `npx cap add ios && npx cap sync ios`)
3. `npm run open` (opens Xcode)
4. In Xcode, target **App**:
   - **Signing & Capabilities:** your team; bundle id `com.speaksona.slp`.
   - **General › Display Name:** `Sona for SLPs` (Travis's to change).
   - **App icon:** drag `assets/icon-1024.png` into `App/Assets.xcassets/AppIcon`
     (a draft: Echo on the dashboard's navy; Travis's to replace).
   - **Info.plist:** nothing to add. The app uses no microphone, camera,
     location or notifications.
5. Run it on your iPhone. Check:
   - it opens on the sign-in screen; "Email me a code"; the code from the
     email signs you in; Sign out and back in;
   - no price, "Sona Pro", "Start my free trial" or "Manage billing" anywhere
     (the side menu, the top bar, Settings);
   - the top of every screen sits below the clock and the camera (the web
     view is inset for them: `contentInset: automatic`);
   - Settings › Your data › "Share CSV" opens the share sheet;
   - Add a family and Add a child show "Share with family" on their result
     screens. Dismissing the share sheet leaves Copy message available.
   - Today shows Family progress after the caseload loads.
   - airplane mode: the "Can't reach Sona" page, and Try again works.

## App Store Connect

1. **New app**: platform iOS, name "Sona for SLPs" (or Travis's pick), bundle
   id `com.speaksona.slp`, SKU `sona-slp`.
2. **Category:** Medical or Education (Travis's call); **age rating:**
   answer "user-generated content: no" (the community left the dashboard on
   17 Nov 2026; the AI's activity ideas are shown only to the clinician who
   asked), everything else no.
3. **App Privacy:** Contact Info › Email Address (App Functionality, linked to
   the user); User Content › Other (what a clinician types into Plan
   activities, sent to the AI provider to answer it, not stored; Travis's
   call whether it is "linked"); no tracking.
   The caseload the app shows (children's first names and practice) comes
   from families' phones with their consent, not from the clinician's phone:
   how to label it is Travis's call (with whoever advises him on privacy).
4. **Review information:** App Review cannot read an email, so give it a
   demo account:
   - in Vercel, set `SLP_REVIEW_EMAIL` (an address only you use, e.g.
     `appreview@speaksona.com`) and `SLP_REVIEW_CODE` (6 digits);
   - in the review notes: "Sign in: type the email, tap Email me a code, then
     type the code. Email: … Code: …";
   - after approval, delete both variables (the door closes) or keep them for
     the next review.
5. **Review notes**, to paste: "Sona for SLPs is the free companion app for
   speech-language pathologists who use Sona with families. Clinicians sign
   in with a code sent to their email. The app sells nothing: there are no
   purchases, prices or links to purchase. Plan activities writes in-session
   activity ideas with AI from a short description the clinician types.
   The family invite opens the iOS share sheet, and Today shows the stages
   of an invite and whether a consenting family has shared practice.
   Settings › Delete your account deletes the account and its data."

## Known and left

- Apple evaluates the complete iPhone experience under its minimum
  functionality guideline (4.2), including the native share sheet.
- A clinician whose paid plan still renews cannot delete the account until the
  plan is cancelled (on the website: Sona Pro › Manage billing), or by email.
