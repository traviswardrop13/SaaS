# AGENTS.md — read this before you change anything

You are working on **Sona** (speaksona.com), a kids' speech-practice app.
This file is the agent brief. `CLAUDE.md` is the fuller version of the same
rules; if the two ever disagree, `CLAUDE.md` wins.

> **`README.md` is stale.** It describes an older product ("SpeakUp Kids", a
> Next.js/Tailwind skill tree using the Web Speech API). That is not what this
> repo is any more. Do not build a mental model from it.

## The one thing most likely to cause real harm

**`public/` ships straight to production.** It is static ES5 with no build
step, no bundler and no framework. The live site serves it directly, **and the
iOS app is a Capacitor shell that remote-loads that same site** — so a change
to `public/` is a shipped app change, on real children's devices, with no App
Store review and no staging gate between you and them.

A broken file there is not a failed build. It is a child opening the app to a
blank screen. This has happened: a refactor once deleted the opening line of a
page's boot IIFE, leaving a top-level `await` in a classic script. Browsers
reject the *entire* script at parse time, so Story Time rendered its shell and
did nothing — for a month — with every test still green, because no suite drove
that page. `tests/syntaxtest.mjs` exists because of it.

## How to verify your work

```bash
npm i --no-save playwright && npx playwright install chromium   # first time
node tests/run-all.mjs        # THE battery: 25 suites, ~900 assertions, ~9 min
npx tsc --noEmit -p tsconfig.json
```

There is **no `npm test` script** — `node tests/run-all.mjs` is the battery, and
it must pass before any push. Two things learned the hard way:

- **Check the exit code, not the output.** A crashing suite prints a stack
  trace, not a `FAIL` line, so `| grep FAIL` reports success for a suite that
  died. `run-all.mjs` checks status properly; ad-hoc greps do not.
- **A new test must be shown to fail against the pre-fix code.** A pin that
  passes either way pins nothing. Stage the old tree and run it.

## Hard rules — these are not style preferences

1. **No audio ever leaves the device.** There is no cloud scorer. Every verdict
   is computed on the phone from the spectral shape of what was said. One clip
   a day may sit in local IndexedDB so a parent can listen back; it is never
   uploaded. This is true because no mechanism exists to break it — keep it
   that way, and never write copy claiming otherwise (the privacy policy
   described an upload that had been deleted, and that counted as a bug).
2. **A child's name never reaches a CRM, ad pixel or analytics payload.**
   `/api/lead` and `/api/track` both use **allow-lists**, and unlisted keys are
   dropped silently. Never convert either to a deny-list: one was, and a field
   added later sailed straight through it.
3. **Silence is never a rep.** A practice rep requires detected voicing. A
   round that advances on a timer teaches a child that not talking works.
4. **Never merge to main.** Merges are Travis's call, on his explicit word.
   Open a PR and stop.
5. **Never rewrite pushed history.**

## Landmines — code that looks redundant and is not

- **`_grandfatherFreeEra()`, `…2()`, `…3()`** in `sona.js` look like dead
  migration code. They are promises to three cohorts of families who were told
  Sona was free. Deleting them charges people who were told they'd never pay.
  Each is one-shot and structural; read the CLAUDE.md section before touching.
- **`FREE_MODE`** (`sona.js` + `lib/pricing.ts`, kept in sync, test-pinned) is
  the single pricing switch. It has flipped eleven times. **Every purchase
  surface branches on it and keeps BOTH the paid and free copy.** If you find
  yourself rewriting a price into a page, stop — you are undoing that.
- **The `?paid=1` / `sona.paidui` seam** exists so the purchase rails stay
  testable while the app is free. It only controls visibility; it grants
  nothing.
- **Tests do not pin business decisions.** Don't add an assertion recording
  which way the pricing switch points — those were removed for taxing every
  flip while guarding nothing.

## Credentials and claims — checkable, and checked

Rachel is a co-founder and a **licensed pediatric speech-language pathologist
(Clinical Fellow)**, Idaho. She does **not** hold ASHA's CCC. **Never write
"CCC", "certified", "board-certified" or "ASHA-certified"** — a false
board-certification claim shipped once on the page that sells the app.
`tests/iaptest.mjs` fails if it returns.

Also never invent: testimonials, user counts, ratings, or outcome claims
("fixes R in 30 days"). None exist. The `214 reps this week` chart on the
landing page is hard-coded sample UI, not a metric.

## What is Rachel's call, not yours

Anything touching **what a child is asked to say, how a sound is cued, what
counts as practice, or what an SLP is shown** is a clinical decision. Propose
it in the PR body; do not ship it. Sona is practice — never therapy,
treatment, diagnosis, or an evaluation.

## Orientation

- `public/sona.js` — single source of truth: state, entitlement, content,
  the daily story rotation, speech verdicts. Pages read it; they never
  reimplement it.
- `public/*.html` — one file per screen (`today`, `charge` = practice,
  `chapter` = story, `arcade-*` = games, `slp.html` = clinician dashboard).
- `app/` — Next.js API routes and the marketing site.
- `tests/*.mjs` — Playwright suites; they drive real pages, not mocks.
