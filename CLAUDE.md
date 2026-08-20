# Working with Travis (and Rachel)

## Communication style
- Be concise. Default to a few sentences; use short bullets when listing.
- Lead with the answer or the thing that happened. Cut background, caveats,
  and strategy essays unless asked.
- One recommendation, not a menu. No recaps of prior context.
- Long-form only when explicitly asked ("go deep", "full plan").

## Project
Sona (speaksona.com) — kids' speech-practice PWA in public/, Next.js API
routes, Capacitor iOS shell that remote-loads the site. Solo founder, ships
fast.

**Two people work in this repo.** Travis builds. Rachel is a licensed
pediatric SLP and co-founder — she owns clinical correctness. If a change
touches what a child is asked to say, how a sound is cued, what counts as
practice, or what an SLP is shown, it is Rachel's call, not an engineering
one. Surface those in the PR body so she can review them without reading
the diff.

## Pricing — Sona is free
**Sona is 100% free.** No paywall, no trial, no plan, nothing to buy.
`FREE_MODE = true` in `sona.js` is the only switch; every purchase surface reads
it and `gated()` short-circuits on `isFree()` before anything else.

**The payment rails stay.** RevenueCat, both IAP product ids, the three Stripe
routes, `subscribe.html`, the trial timer — all wired, none reachable. The
`?paid=1` QA seam (session-scoped, visibility only — it grants nothing and
moves no money) keeps them under test in `iaptest`/`progtest`/`slpcode`/`day1`,
so pricing is one boolean away instead of one archaeology project away. Do not
delete them to tidy up. Likewise do not delete the App Store Connect products:
deletion is effectively permanent, and re-creating them means new product ids
and losing the legacy-price grandfathering.

Three cohorts stay free even when the switch flips back: SLP-referred families
(the server-verified `?slp=` credential — that promise IS the SLP channel),
pilots, and founders. Plus the fourth, below.

Two things that follow, and are not up for quiet reinterpretation:
- **Anyone who used Sona during the FIRST free era keeps it free.** Enforced by
  `_grandfatherFreeEra()` and pinned in `tests/iaptest.mjs`. It is a promise to
  those families, not a growth tactic. Do not "clean it up".
  That function now runs **on free builds too**, deliberately. It used to
  return early while free, which meant nothing was stamped until a paid build
  loaded — so this second free period would have been swept into a promise only
  ever made to the first one, and pricing could never have reached anyone who
  joined during it. The evidence that separates the two cohorts (an onboarded
  device carrying no stamp) exists only until the free build lands, so the line
  is drawn now. Families arriving during this free period are free because the
  app is free: a different promise, and a revocable one.
- Don't re-open the pricing question in passing. It has cost several reversals
  and a lot of paywall plumbing while the clinical work sat in the TODO list
  below. If it changes, it changes deliberately and once — and the bar for
  changing it back is a number decided in advance, not a fresh argument.

**The iOS price does not live in this repo.** `subscribe.html` overwrites the
figures with whatever RevenueCat reports from App Store Connect, so editing
numbers here does not change what an iPhone shows. Change ASC.

## Hard rules
- Merges to main/prod only on Travis's explicit go ("merge").
- **No audio ever leaves the device.** There is no cloud scorer: every verdict
  is decided on the phone from the spectral shape of what was said. One clip a
  day may be kept in local IndexedDB so a parent can listen back — it is never
  uploaded. The consent copy says exactly this, and it is true because there is
  no mechanism to break it, not because a checkbox is off.
- No silence counted as reps; voice boosts never logged as SLP data.
- Never rewrite pushed git history. Push after every verified milestone.
- A child's name never leaves the device to any CRM, ad pixel or analytics
  payload. Progress leaves only with a grown-up's explicit consent, and
  never as audio.
- Run the full battery (`node tests/run-all.mjs`) before every push.

## Clinical rules (Rachel owns these)
The app must not teach a child something an SLP would have to undo. These
are enforced in code and pinned by tests — change them only on Rachel's say-so.

- **One target, said in isolation, before anything else.** Never glue a
  carrier phrase onto a practice word. "a rain" and "one robot" shipped once
  because a rotating carrier was applied blindly to the whole word bank; a
  child was being shown ungrammatical English to imitate. Sentences may be
  sentences; single words stay single words.
- **Silence is never a rep.** A rep requires detected voicing. A round that
  advances on a timer teaches a child that not talking works.
- **End every round on a success.** Step the target down rather than let a
  child fail out — the last thing they do is the thing they remember.
- **Developmental order is real.** Sounds are gated by `SOUND_NORM` (the age
  a sound is typically acquired). Do not offer a 4-year-old /r/ drills
  because the parent picked it.
- **Nothing in the app is an evaluation.** No grades, no diagnosis, no
  "score" a parent could mistake for an assessment. Parent-facing summaries
  carry the practice-snapshot hedge and Rachel's byline.
- **What the accuracy number now means — Rachel to confirm.** With the cloud
  scorer gone, pass/fail comes from an on-device spectral check: it asks "did
  that sound like this sound", not "was that word correct". Any percentage
  shown to a parent or an SLP is built on that narrower signal. Rachel decides
  whether it should still be shown as a percentage, softened, or dropped.
- **Cueing** — TODO, Rachel to specify. Her highest-value ask was the
  "sssoup" prompt: model the target sound stretched and attached to the word
  rather than saying the word cold. Needs her exact wording and which sounds
  it applies to (stretchers vs. poppers) before it ships.
- **Auditory bombardment warm-up** — TODO, Rachel to specify. Hearing the
  target sound many times before producing it. Needs: how many exposures,
  where in the flow, and whether the child responds or only listens.
- **Speech-rate control** — TODO, Rachel to specify. Slowing the model so a
  child has time to plan the motor movement. Needs her target rate and
  whether it changes by age or ladder rung.

## Code conventions
- `public/` is static ES5 — no build step, no framework, no bundler. It ships
  to the live site and the iOS shell reads that same site, so a web change is
  a shipped app change with no App Store review.
- `sona.js` is the single source of truth for state, entitlement and content.
  Pages read it; they don't reimplement it. One switch, honoured everywhere —
  when a rule lives in two places it drifts, and drifted rules are how the
  paywall and the free-mode copy ended up contradicting each other.
- Per-child data routes through `load()`/`save()` or `Sona.kkey()`. Anything
  in `PER_KID` that bypasses them is a promise the code doesn't keep.
- Entitlement is never granted from a URL parameter or an unverified page
  load. If a link unlocks something, a server verified it first.
- Comments explain *why*, especially where the obvious implementation is
  wrong. Match the surrounding density.
