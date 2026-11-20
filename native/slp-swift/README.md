# Sona for SLPs, in Swift (SLPSWIFT1, 20 Nov 2026)

Travis: "I want to do a Swift build of the mobile app. For the SLP dashboard.
This one shouldn't be nearly as intensive as the kids app." Asked, he chose
**I write it, he builds it on his Mac**, and these screens for version one:
**Sign in, Today, Caseload (and a child's page), Add a family, Settings and
the chat.** Session games stay on the web dashboard for now.

It is a real SwiftUI app (iOS 17+, iPhone and iPad), not a web page in a
frame. It talks to the same server as the web dashboard (app.speaksona.com),
with the same routes, so nothing new on the server holds data. It replaces the
Capacitor shell in `native/slp-ios` (same bundle id, `com.speaksona.slp`).

## Build it on the Mac (one time)

```bash
brew install xcodegen
```

```bash
cd native/slp-swift && xcodegen
```

```bash
open SonaSLP.xcodeproj
```

In Xcode: target **SonaSLP** › **Signing & Capabilities** › pick your team.
Then pick an iPhone simulator (or your phone) and press **Run** (⌘R).

If Xcode shows a red error, copy its text to Claude. That is the normal loop:
this code was written on a computer with no Xcode, so it has never been
compiled.

To try it against a Vercel preview instead of the live site, in Xcode:
**Product › Scheme › Edit Scheme › Run › Arguments › Environment Variables**,
add `SONA_API_BASE` = the preview's address (debug builds only).

## What it does

- **Sign in** with the 6-digit code from the email (`/api/slp/auth/request`
  with `wantCode`, then `/api/slp/auth/code`). The session cookie lives in the
  app's cookie store, so it stays signed in.
- **A new account** picks its name, clinic and code once (`/api/slp/account`).
- **Today**: how many children practiced in the last 7 days, then Gone quiet,
  Homework ending soon or missed, Practiced in the last 7 days, and invites
  not joined yet. The same rules as the web (`Derive.swift` mirrors
  `derive()` in `public/slp.html`): no ranking, no caseload average.
- **Caseload**: search, All / Needs attention / Practiced, archived on a
  switch. A child's page: last practiced, last 7 days, a pass rate only from
  20 attempts (`SMALL_N`), homework, eight weeks, and **Copy note** (the web's
  note with its hedge; the position breakdown and homework-target line are
  left out for now).
- **Add a family**: the parent's email, and only if given initials, an age
  and up to three sounds, never a name (`/api/slp/family`). The username and
  password show once, with Copy message, Text it and Share. The message is
  the web's, word for word (the server now also says whether the caseload is
  covered, `covered`, so the Premium line is true).
- **Settings**: who is signed in, Message the Sona team, Privacy, Terms, Sign
  out, **Delete my account** (Apple requires it; `/api/slp/account` DELETE,
  the email typed back).
- **The chat** (the speech bubble, top left on every tab): Help / Idea /
  Problem and a text box. The mic is the keyboard's own dictation key; the app
  never listens itself, so it asks for no microphone.
- **No Sona Pro**: one plain card, "Your account doesn't have Sona Pro yet.",
  with Check again, Sign out and Delete my account. **The app sells nothing**
  (App Store rule 3.1.1): no price, no trial words, no link to buy, and no
  Share & earn (it pays money; web only).

## Not in version one

Session games, assigning homework, archiving, notes, the clinic page and
Share & earn: all still on the web dashboard.

## App Store

Same listing as `native/slp-ios/README.md` describes (App Review's sign-in,
App Privacy, the review note). Differences: **no microphone** now (no
Session games in the app), so no `NSMicrophoneUsageDescription`, and Apple's
4.2 worry ("a repackaged website") no longer applies: every screen is native.
Version 2.0, build 1 (`project.yml`).
