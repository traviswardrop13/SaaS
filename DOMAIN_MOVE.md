# Moving the app to app.speaksona.com (APPHOST1)

> **Reversed for the website on 24 Nov 2026 (GHLEXIT1, CLAUDE.md):**
> speaksona.com points at Vercel again (apex A 216.198.79.1 and 64.29.17.1,
> www CNAME to Vercel, DNS only), so www runs this app once more and the
> copy below works for anyone who has not moved yet. The app itself stays at
> app.speaksona.com. Everything below is the 17 Nov history.

**Goal:** speaksona.com becomes your GoHighLevel website. The app (and
everything it needs: sign-in, payments, emails' links) lives at
**app.speaksona.com**.

**Why this needs an order:** a phone keeps each family's Sona (children,
progress, coins, the "free forever" marks) under the exact web address it was
used on. app.speaksona.com is a new address, so to that phone it's an empty
app. This build copies each family's Sona across the first time they open the
new address. The copy reads the old address, so **it only works while
www.speaksona.com still runs the app (on Vercel).** Point speaksona.com at
GoHighLevel too early and the copy has nothing to read.

## What this build does (once merged)
- Someone opening Sona in a browser at www.speaksona.com goes to the same page
  at app.speaksona.com. The first time, the page "Getting Sona ready…" shows
  for about a second while their Sona is copied across. That happens once per
  phone, never overwrites a child already set up on the new address, and only
  our own www page can send the copy.
- Every link Sona emails (unsubscribe, sign-in, report confirm, the practice
  board) points at app.speaksona.com.
- Both iPhone apps' **next** App Store builds load app.speaksona.com.
- Clinicians sign in once more on the new address: sign-in is a browser
  cookie, and cookies don't move between addresses.

**Who stays on www for now:** the iPhone apps already in the App Store (they
move when they update), and anyone who added Sona to their home screen from
Safari (that copy keeps separate storage, which the copy step may not be able
to read).

## Your steps, in order
1. **Say "merge"** when you've read the PR. Nothing changes for families until
   then.
2. **Stripe** → Developers › Webhooks: change the endpoint's URL to
   `https://app.speaksona.com/api/stripe/webhook` (the signing secret stays
   the same). Checkout returns people to whichever address they paid from.
3. **RevenueCat** → the webhook URL: `https://app.speaksona.com/api/revenuecat`.
4. **App Store**: build and submit **both** iPhone apps from this code (family
   app and Sona for SLPs). `NATIVE.md` and `native/slp-ios/README.md` have the
   Mac steps. App Store Connect's privacy and support links:
   `https://app.speaksona.com/privacy.html`.
   **You can put your website on speaksona.com right away, without waiting:**
   in GoHighLevel add only `speaksona.com` (not www), and change only that
   record in the DNS settings. www.speaksona.com stays on Vercel, so the
   iPhone apps already out, the copy step and old www links all keep
   working. The one catch: someone typing www.speaksona.com still sees the
   app's clinician page until step 6. Do step 7's forwards in GoHighLevel
   then too, since some old links use speaksona.com without www.
5. **Wait** until most families have the updated iPhone app and have opened
   Sona once. The longer you wait here, the fewer families lose anything.
6. **GoHighLevel**: build the website, then point www.speaksona.com (and
   speaksona.com, if you didn't already) at it. When you change the domain's DNS settings,
   **keep every email record** (the MX, SPF, DKIM and DMARC records for Resend
   and GoHighLevel). Delete those and sign-in emails stop.
7. **In GoHighLevel, forward the old app addresses** to the same path on
   app.speaksona.com, so old links in emails and texts still work:
   `/join.html`, `/join`, `/today.html`, `/progress.html`, `/settings.html`,
   `/subscribe.html`, `/subscribe`, `/slp.html`, `/slp`, `/slp-login.html`,
   `/onboarding.html`, `/privacy.html`, `/terms`, and `/api/*` (emailed
   unsubscribe and confirm links that were already sent).
8. **Your website's buttons**: "Log in" for clinicians →
   `https://app.speaksona.com/slp-login.html`. "Start free" for families →
   the App Store link, or `https://app.speaksona.com/onboarding.html`.

## What can't be saved
- A family that only ever used an iPhone app version from before step 4, and
  never updates it before step 6: that old app will open your GoHighLevel
  site instead of Sona. Their Sona isn't deleted (it's still on the phone
  under www), but there's no way to reach it after step 6.
- A home-screen copy from Safari: after step 6 it opens GoHighLevel. The
  family adds Sona again from app.speaksona.com and starts fresh.

## Later, once speaksona.com is GoHighLevel's
- `app.speaksona.com/` still shows the clinicians' page from this repo.
  It could open the family app instead. That's a small change; ask for it
  when the website is live.
- The pages for-slps.html, parents.html and try.html can retire from this
  repo once GoHighLevel has their replacements.
