# Sona

A speech-practice app for kids, at [speaksona.com](https://speaksona.com).
A child practices a target sound in short rounds, earns arcade time by doing
it, and a grown-up gets a practice snapshot they can share with their SLP.

Built with Rachel, a licensed pediatric speech-language pathologist (Clinical
Fellow) and co-founder, who owns what the app asks a child to do.

> **This file was wrong for a long time.** It described "SpeakUp Kids" — a
> Next.js/Tailwind skill tree that transcribed with the Web Speech API and
> posted recordings to a Speechace scoring API. None of that is the product,
> and `/api/score` does not exist. If something below ever stops matching the
> code, fix this file; a README nobody trusts is worse than none.

## How it is actually built

Two halves in one repository, and the split matters:

- **`public/` — the app itself.** 31 static pages of plain ES5, no build
  step, no framework, no bundler. It is deployed as-is, and the iOS shell
  remote-loads the same live site, so **a change in `public/` is a shipped app
  change with no App Store review.** A file broken here is a blank screen on a
  child's device — `story.html` sat dead for about a month exactly that way.
- **`app/` — Next.js (App Router).** The marketing pages (landing, pricing,
  terms, privacy, support), the Stripe checkout and subscription routes, the
  clinician dashboard API, and the server side of everything the static app
  calls. 36 route handlers under `app/api/`.

`public/sona.js` is the single source of truth for state, entitlement and
content — pages read it, they do not reimplement it.

Also here: `plugins/sona-speech`, a small Capacitor plugin wrapping Apple's
on-device speech recognizer. The Xcode project itself is not in this repo;
`NATIVE.md` documents the native-side settings the web app depends on.

## How a verdict is decided

**No audio ever leaves the device.** There is no cloud scorer. A round is
judged on the phone: the on-device recognizer's transcript when it is
available, and the spectral shape of what was said when it is not. One passed
clip a day may be kept in local IndexedDB so a parent can hear it back — it is
never uploaded. The consent copy says exactly this, and it is true because
there is no mechanism to break it.

A child's name never leaves the device to any CRM, ad pixel or analytics
payload. Practice progress leaves only with a grown-up's explicit consent, and
never as audio.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000 — the Next.js half
```

The static app is served from `public/`, so `http://localhost:3000/today.html`
is the app itself. Chrome gives the best microphone behaviour.

## Verifying it

**There is no `npm test`.** The suites are plain Node scripts driving real
pages in Playwright:

```bash
node tests/run-all.mjs      # all 25 suites
node tests/iaptest.mjs      # or any one of them
```

`tests/_env.mjs` handles the Playwright setup. **Check the exit code, not the
output** — a suite that crashes prints a stack trace and no `FAIL` line, which
is how a broken suite once read as passing.

Both halves run in CI on every pull request: `tests.yml` installs Chromium and
runs the full battery, `ci.yml` runs the typecheck and production build.

A new test should be shown failing against the code *before* the fix. Several
of these suites went green for months while the bug they were meant to catch
was live.

## Pricing

One plan: **$59.99/year after a 3-day free trial** ($59.99 ÷ 12, so every
surface says "under $5 a month"). Monthly was retired in September 2026;
existing monthly subscribers keep their plan and can still restore it.

Free regardless: families referred by an SLP (free forever, in writing), plus
pilots, founders, and three grandfathered cohorts from earlier free windows.
There is no payment path for an SLP or a clinic anywhere in the product — that
channel produces engaged families and zero revenue, by design.

Whether the app is free or paid is **one boolean in two files**
(`FREE_MODE` in `public/sona.js`, mirrored by `lib/pricing.ts`). Every purchase
surface branches on it and keeps both states. If you find yourself rewriting a
price into a page, stop.

## Working in here

- `CLAUDE.md` — the working agreement: the hard rules, the clinical rules
  Rachel owns, and the landmines that look like dead code but are promises to
  real families.
- `AGENTS.md` — the same ground for an outside coding agent.
- `NATIVE.md` — what the iOS shell must do that the web app cannot.

Read `CLAUDE.md` before changing anything about pricing, entitlement, or what
a child is asked to say.
