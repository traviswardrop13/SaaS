# Sona — audit brief

Written for an outside reviewer (human or agent) doing a bug hunt. It tells you
what this app is, what must never break, where the bodies are buried, and what
a useful finding looks like.

---

## What it is

Sona is a speech-practice app for kids aged 4–9 who are working on a specific
sound (/r/, /s/, /l/ …), usually alongside a real speech-language pathologist.
A child opens it daily, reads a short story chapter, then plays games that only
advance when they actually say the target sound out loud.

Two founders: one engineer, one licensed pediatric SLP. Roughly 2,100 lines of
`public/sona.js` plus 56 static pages and 35 API routes.

## Architecture — the one thing to understand first

```
public/            static ES5. No build step, no framework, no bundler.
app/               Next.js App Router — 35 API routes + a few marketing pages.
capacitor.config   server.url → https://speaksona.com
```

The iOS app is a Capacitor shell whose `server.url` points at the **live
website**. It does not bundle `public/`; it loads it over the network.

**A change to `public/` is a shipped iOS app change with no App Store review.**
That is the project's biggest advantage and its biggest hazard: a bug in
`public/` reaches every installed phone the moment it deploys. Weight your
severity accordingly — a client-side flaw here is not "just the web".

`public/sona.js` is the single source of truth for state, entitlement, content
and per-child storage. Pages read it; they are not supposed to reimplement it.
Wherever a page reimplements something `sona.js` already does, that is a
finding in itself — every such duplication in this codebase's history has
eventually drifted.

## Invariants — a violation of any of these is a critical finding

**Entitlement**
1. Access is never granted from a URL parameter, a page load, or any
   client-supplied value. If a link unlocks something, a server verified it.
2. `gated()` in `sona.js` is the only gate. `FREE_MODE` is the only switch.
3. The `?paid=1` / `sona.paidui` QA seam controls **visibility only**. If you
   can make it grant entitlement, that is critical.

**Child safety / privacy**
4. A child's name never leaves the device to any CRM, ad pixel, or analytics
   payload.
5. Practice progress leaves the device only after a grown-up's explicit
   consent, and never as audio.
6. In-game voice detection records and uploads nothing — local loudness only.
7. Kid-facing pages load no tracking scripts. Check what each page imports.

**Clinical (these are the SLP's rules; breaking them teaches a child something
a therapist then has to undo)**
8. Silence is never a rep. A rep requires detected voicing. Any path where a
   counter advances on a timer is a bug, not a feature.
9. Never glue a carrier phrase onto a single practice word. "a rain" and
   "one robot" shipped once — a rotating carrier applied blindly to the whole
   word bank. Sentences may be sentences; single words stay single words.
10. Sounds are gated by developmental norms (`SOUND_NORM`). A 4-year-old is
    not offered /r/ drills.
11. Nothing in the app is an evaluation. No grades, no diagnosis, no score a
    parent could mistake for an assessment.

**Per-child data**
12. Two siblings share one device. Anything in the `PER_KID` set must route
    through `load()` / `save()` / `Sona.kkey()`. A key that bypasses them
    silently merges two children's data — or locks one out of something the
    other paid for.

## Known scar tissue — the *classes* of bug this codebase produces

These are all real and already fixed. They are listed because the same shapes
keep recurring, and they tell you where to point your attention.

| What happened | The shape of it |
|---|---|
| `/pilot.html` called `startPilot()` straight off a URL parameter, and `isPilot()` short-circuits `gated()` — the link was a free subscription for anyone who had it | entitlement from an unverified client value |
| `/subscribe/success` wrote `{active:true}` on mount, so loading the URL granted a plan | granting before verifying |
| `earlyAdopter` lives on the per-kid profile, so a referred family's second child hit a paywall while the first played free | per-kid storage for a household-level fact |
| The free build wrote `sona.slpok`; the paid gate read `sona.slpunlock` — families silently locked out on a flag rename | two names for one fact |
| The daily counter read `todayRing().n` while the ladder read `rotRound()` — two counters for one concept, and the test pinned the buggy formula | duplicated derivation |
| Removing a ladder rung silently shifted every stored `g.stage[sound]` index | array-index migration with no version guard |
| A carrier phrase was rotated onto the whole word bank | a content rule applied where it doesn't hold |

## Where I would look first

- **Gating coverage.** `Sona.gated()` is called on only 5 of 56 pages. Several
  game pages are reachable by direct URL. Work out which of those are genuinely
  meant to be open and which are holes.
- **The 35 API routes.** Several call paid vendors (`tts`, `stt`, `score`,
  `story`, `chat`, `isolate`, `voice-change`). Check every one for
  authentication, rate limiting, and input bounds. An unauthenticated route
  that calls a metered vendor is someone else's bill.
- **`lib/rateLimit.ts` and `lib/slpAuth.ts`** — the shared security helpers.
- **Storage key handling across `PER_KID`** — grep for any `localStorage`
  access in `public/*.html` that does not go through `Sona.kkey()`.
- **The daily gate added recently** (`dailyStory`, `markStoryRead`,
  `dailyGames`, `buyMystery` in `sona.js`; `chapter.html`; `today.html`) — it
  is the newest code and has had the least real-world exposure.
- **Timezone and midnight rollover.** Almost everything is keyed on a local
  day string. Look for anything that breaks across midnight, across a DST
  shift, or when a device's clock changes.

## How to run it

```bash
npm install
npm run build          # Next build + typecheck
node tests/run-all.mjs # 17 Playwright suites, ~500 assertions
node tests/day1.mjs    # or any single suite
```

Tests drive real Chromium against a local static server. They are the current
safety net — but **do not treat a green run as evidence of correctness.** Every
bug in the table above shipped with the suite green, and one of them was
actively pinned in place by a test asserting the buggy formula. Assume the
tests encode what was believed, not what is true.

## What a useful finding looks like

State the concrete failing sequence: who does what, in what order, and what
goes wrong. "This could be unsafe" is not actionable; "a parent taps X while
the trial is expired, and Y grants access" is.

Rank by what actually reaches a family:
1. anything that grants access without payment or a verified credential
2. anything that sends a child's data anywhere it shouldn't go
3. anything that teaches a child a wrong speech habit
4. anything that locks out a paying or SLP-referred family
5. crashes and dead ends on kid-facing pages
6. everything else

Please skip: style preferences, "consider adding TypeScript", suggestions to
introduce a build step or framework to `public/` (the no-build constraint is
deliberate — it is what makes App Store review unnecessary), and test-coverage
notes unless you have identified a specific untested behaviour that is broken.
