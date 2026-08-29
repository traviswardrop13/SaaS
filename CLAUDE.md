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

## Pricing — settled
Pricing is **live**: **$9.99/month** billed at purchase with **no trial**, and
**$59.99/year** after a **3-day free trial**. `FREE_MODE = false` in `sona.js` is
the only switch; every purchase surface reads it and `gated()` short-circuits on
`isFree()` before anything else.

**The free-mode half of the switch stays wired.** `trial.html`'s `isFree()`
bounce and `today.html`'s plan-note guard are inert while priced. They are not
dead code — they are the other direction of the switch, and deleting them is how
the next free window ships a paywall link to a family who was promised free.

Four cohorts are free regardless of the switch: SLP-referred families (the
server-verified `?slp=` credential — that promise IS the SLP channel), pilots,
founders, and **everyone who used Sona during EITHER free era**.

Two things that follow, and are not up for quiet reinterpretation:
- **Both free eras' families keep it free.** Enforced by
  `_grandfatherFreeEra()` and `_grandfatherFreeEra2()`, pinned in
  `tests/iaptest.mjs`. Do not "clean it up".
  There have been TWO free windows: the original, and nine days in August
  (20–28). Era one was judged structurally — an onboarded device carrying no
  stamp predates pricing. Era two was told a REVOCABLE thing ("the app is
  free", not "free forever") and was originally left to meet the paywall;
  Travis chose to keep it for them anyway, and `_grandfatherFreeEra2()` sweeps
  them in.
  **The sweep is one-shot and structural, and that is load-bearing.** An
  era-two family and a family arriving tomorrow are both stamped `post`,
  because a new device is stamped on its very first load, before it onboards.
  No date on the device separates them — `practiceDays` is pruned at 130 days
  and a family who set up but never practised has none. So the sweep runs once,
  on the first load of the build carrying it, and grandfathers any device that
  is ALREADY onboarded: such a device necessarily predates that build. A family
  who onboards afterwards is stamped and swept before they ever have a profile,
  and correctly still pays. Both directions are pinned — get it wrong one way
  and you break a promise, the other way and you give the app away.
- Don't re-open the pricing question in passing. It has cost several reversals
  and a lot of paywall plumbing while the clinical work sat in the TODO list
  below. If it changes, it changes deliberately and once — and the bar for
  changing it back is a number decided in advance, not a fresh argument.
  Note what the two grandfather sweeps cost: every free window permanently
  removes its own cohort from ever paying. That is the honest price of going
  free, and it is a reason to mean it the next time.

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
