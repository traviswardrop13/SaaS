# Sona — external code-review brief

You are reviewing the codebase behind **speaksona.com** — a kids' speech-practice
product (web PWA + iOS Capacitor shell that remote-loads the site). Your job:
find **real bugs** and **high-leverage improvements**. This brief tells you how
the system works, what is deliberately unusual (do not "fix" those), where the
known soft spots are, and the output format we need.

## The product in one paragraph

Kids (4–9) practice speech sounds (currently focused on /r/) through mic-driven
games. A parent buys a subscription on the web (Stripe) or in-app (Apple IAP via
RevenueCat). The core loop: `charge.html` asks the child to say the target 5
times (on-device voice detection counts reps), then launches an arcade game as
the reward. Progress, plans, and reports live in localStorage; a handful of
Next.js API routes handle TTS (ElevenLabs), scoring (SpeechAce), payments,
and anonymous aggregate stats (Upstash KV). Built and shipped by one founder +
a licensed SLP; no framework in the web app, no build step, ES5-style JS.

## Architecture

- `public/*.html` + `public/sona.js` — the entire product. Static pages served
  by Next on Vercel. `sona.js` (~1,600 lines) is the shared "backend in the
  browser": profile/progress storage, rotation/ladder, trial/sub/IAP, parent
  gate, stickers, analytics wrapper hooks.
- `app/` — Next.js App Router: marketing landing (`page.tsx`), subscribe
  success page, and ~30 small API routes (`app/api/*/route.ts`).
- iOS app = Capacitor shell (`capacitor.config.json`, `native/`) that loads the
  live site; the `ios/` Xcode project is generated on the founder's Mac and is
  not in the repo. RevenueCat purchase plugin is the only native SDK.
- Tests: `tests/*.mjs` — 12 Playwright suites run by `node tests/run-all.mjs`
  against a throwaway static server; API routes are stubbed in-process.

## READ FIRST — deliberate invariants. These are NOT bugs. Do not "fix" them.

1. **The speaker guard.** While ANY app audio plays (TTS, model clip, slow
   replay), the mic loop drops every frame (`if(speaking||ttsPlaying)` in
   `charge.html`). The device's own speaker must never count as a rep.
2. **Silence never counts.** A rep requires ~4 consecutive voiced frames above
   an ambient-calibrated threshold. Anything that would count silence, or turn
   loudness into a score, is a regression — the product's honesty is the brand.
3. **Recordings stay on the device.** Game pages record nothing; practice-word
   clips go to `/api/score` for scoring only and are never stored server-side;
   the one kept daily clip lives in IndexedDB locally. Any "improvement" that
   uploads or persists child audio server-side is an automatic rejection.
4. **Zero third-party scripts on kid pages.** `progtest.mjs` scans 10 kid pages
   for pixel/analytics/fbevents and fails the build if found. Kid-page telemetry
   goes first-party through `/api/track` (whitelisted events/props only).
5. **Two-fail mercy / step-down.** After two honest scoring failures the round
   still opens the game (kids are never hard-stuck), but stats record the truth
   and the difficulty rung cannot advance from a mercy path.
6. **ES5, no build step, no frameworks in `public/`.** Pages must run as-is off
   a static server, including old iOS Safari. Do not propose TypeScript,
   bundlers, or module systems for `public/`.
7. **`window.Sona` is a public API.** The iOS shell remote-loads the site;
   cached/old pages may call current `sona.js`. Renaming or removing `Sona.*`
   exports is a breaking change — additive evolution only.
8. **Native paywall copy/price ($69.99 IAP) is frozen** while v1.0.1 is in App
   Review. Web pricing ($79.99 anchored from $119.99) is current and intended —
   the two differing is deliberate for now.
9. **Client-side entitlements are a known, accepted trade-off** (`sona.sub.v1`
   is a local cache; Stripe/Apple are the source of truth). Flag concrete abuse
   vectors if you see cheap fixes, but "move all gating server-side" is not
   actionable feedback for this stage.
10. **No streak-shame mechanics, no prices/dollar signs on kid-facing pages,
    "practice/coach" language never "therapy/treatment."** Copy suggestions must
    respect this.

## Repo map (line counts approximate)

- `public/sona.js` 1,636 — shared core (see above). Highest-value review target.
- `public/charge.html` 897 — the rep-counting state machine: AnalyserNode VAD,
  burst detection, on-device sound-shape gate, one SpeechAce spot-check per
  round, TTS with IndexedDB clip cache. Second highest-value target.
- `public/today.html` 626 — kid home: activity deck, Practice Path strip,
  parent corner, gate.
- `public/progress.html` 853 — parent dashboard; `public/slp.html` 772 — SLP
  portal; `public/onboarding.html` 460; `public/subscribe.html` 363 (web Stripe
  picker + native IAP card branches).
- Mic games (~300–550 lines each, `bubble/builder/chat/cupstack/grocery/match/
  racer/story/train/whack.html`): each inlines a copy of the record→score
  pipeline. Arcade games (`arcade-*.html`): loudness-only, consume a one-shot
  `sessionStorage` play token.
- `app/api/*/route.ts` (~30): tts, score, chat/coach (LLM), checkout +
  checkout/session + portal (Stripe), pair (move-in codes), reps (weekly
  percentile), track (kid-page telemetry relay), lead/feedback/founders/log,
  slp/* (portal auth), stt, story, trial, subscription, heygen/* (experiments).
- `tests/*.mjs` — 12 suites; `tests/run-all.mjs` runs all.

## The storage schema (localStorage unless noted)

`sona.profile.v1` (child profile/settings) · `sona.progress.v1` (sessions,
totals, streaks, per-sound stage/rung, practiceDays) · `sona.rotation.v1` ·
`sona.today.v1` (daily ring) · `sona.soundcheck.v1` + `sona.plan.v1` ·
`sona.sub.v1` / `sona.trial.v1` (entitlement caches) · `sona.tickets.v1`,
`sona.charge.v1`, `sona.daily.v1`, `sona.run.v1` · `sona.attempts.v1` /
`sona.outcomes.v1` (scored history/rollups) · `sona.fid.v1` (anonymous family
id) · `sona.games.v1` (written by ~10 game pages) · `sona.stickers.v1`,
`sona.feed.v1`, `sona.call.v1`/`sona.callhist.v1` · assorted one-shots
(`sona.micok`, `sona.pulse.v1`, `sona.comeback.v1`, `sona.rateask.v1`,
`sona.firsts.v1`, `sona.soundvote.v1`, `sona.offer.v1`, `sona.slp`).
SessionStorage: `sona.gate.v1` (parent-gate pass, 10-min TTL),
`sona.play.token` (one-shot arcade unlock), `sona.boost.sound`.
IndexedDB: `sona-tts` (cached TTS clips), `sona` → `recordings` (local clips).

All access is load→mutate→save JSON with defaults-merge; there is no versioned
migration system. Multi-tab clobbering is theoretically possible everywhere.

## Known soft spots — aim your effort here

1. **Parent-gate logic exists in 5+ copies** (`sona.js` `requireGate` + inline
   fail-closed copies in progress/settings/voices/subscribe heads). Drift here
   means either a child reaching a parent page or a parent locked out. Verify
   the copies agree (TTL, key, redirect) and flag divergence precisely.
2. **The record→score pipeline is copy-pasted across ~14 pages.** Bugs found in
   one copy almost certainly exist in siblings — check all copies before
   reporting one, and report the full set of affected files.
3. **Date/week math is implemented 4+ ways** (local-day strings for streaks,
   Monday-start weeks for the parent goal, ISO weeks for the reps beacon,
   ad-hoc week keys in today/coach-call). Timezone and week-rollover edge cases
   (Sunday nights, DST) are prime bug territory.
4. **`charge.html` async interleavings**: TTS playback, mic engine, MediaRecorder,
   scoring fetch, and navigation all overlap. Look for: double-launches, engine
   running after navigation, cache-key races in the IndexedDB TTS store,
   `NEED` mutation during retry rounds.
5. **`sona.js` dual meaning of `g.stage[sound]`** — legacy 0..3 stage and 0..6
   ladder rung share a field. Look for reads that assume the wrong scale.
6. **Arcade play token is consumed on load** — a refresh mid-game eats the
   reward. Any cheap idempotency win here is valuable.
7. **`gamecontent.js`** uses unseeded `Math.random` while `sona.js` uses seeded
   daily picks; `chats()` can repeat items. Low stakes, easy wins.
8. **`?ff=CODE`** auto-enrolls a pilot and beacons child name/age on URL visit —
   review the consent posture and suggest hardening.
9. **`founders.html` keeps an API key in localStorage** — assess exposure.
10. **Coverage gaps**: 37 of ~55 pages and ALL API routes have zero tests. The
    API routes especially (`score`, `checkout`, `pair`, `reps`, `track`,
    `slp/auth`) have never been executed by the suite — input validation and
    error paths there are fresh territory. Proposing small, runnable route
    tests (same style as `tests/*.mjs`) counts as a high-value improvement.

## Running the tests

```
node tests/run-all.mjs        # all 12 suites, ~6 min
node tests/progtest.mjs       # or any single suite
```
Requires Playwright + Chromium (`tests/_env.mjs` resolves the browser via
`CHROMIUM_PATH` or default install). Suites are deterministic; a red suite is a
real finding (or your regression).

## Output format we need

Rank findings by severity. For each:

1. **Title** (one line) · severity (crash / correctness / money / privacy /
   UX / cleanup)
2. **File:line** for every affected copy (see soft spot #2 — list all siblings)
3. **Repro or trigger conditions** — concrete inputs/state, not "could maybe"
4. **Why it's wrong** (one or two sentences)
5. **Minimal fix** — smallest change that resolves it, respecting the
   invariants above. Diff snippets welcome; wholesale rewrites are not.

Separate clearly: **Bugs** (something misbehaves today) vs **Improvements**
(better, safer, faster). Do not report: style preferences, framework
migrations, TypeScript conversions, "add a build step," or anything that
violates the READ FIRST list. If a finding touches pricing, entitlements, or
child data, mark it **[FOUNDER REVIEW]** — those changes are decided by the
founder, not applied by reviewers.
