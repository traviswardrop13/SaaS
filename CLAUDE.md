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

**Two people work in this repo.** Travis builds. Rachel is a pediatric
speech-language pathologist and co-founder — she owns clinical correctness.

**Her credential wording is settled — say exactly this.** Rachel holds an
**Idaho CF licence** (confirmed by Travis, 1 Sep 2026) and is a **Clinical
Fellow (CF-SLP)**: master's complete, supervised fellowship year in progress.
She does **not** hold ASHA's CCC.

So: **"licensed speech-language pathologist" is TRUE** and is used across the
app — under-claiming a real credential is not a virtue. State the fellowship
beside it where there is room ("licensed pediatric speech-language pathologist
(Clinical Fellow)"), and always on the SLP-facing pages, where a peer will read
"CF" precisely and would notice its absence.

**Never "CCC", "certified", "board-certified" or "ASHA-certified".** The
landing page claimed "Licensed & board-certified (CCC-SLP)" until it was caught
— a specific, checkable false claim about a trademarked certification, on the
page that sells the app. `tests/iaptest.mjs` fails if it comes back, and if
the licence ever lapses or she moves state, that pin is where to start.
If a change
touches what a child is asked to say, how a sound is cued, what counts as
practice, or what an SLP is shown, it is Rachel's call, not an engineering
one. Surface those in the PR body so she can review them without reading
the diff.

## Pricing — paid, and the three free eras that are not
Pricing is **live**: **$59.99/year** after a **3-day free trial**, or
**$9.99/month** billed at purchase with **no trial**. `FREE_MODE = false` in
`sona.js` is the only switch, mirrored by `lib/pricing.ts` for the Next.js
half; `gated()` short-circuits on `isFree()` before anything else, and
`tests/freetest.mjs` fails if the two copies ever disagree.

**The four figures, and the arithmetic that ties them together.** They appear
on five surfaces and they must always agree: 12 × $9.99 = **$119.88**;
$119.88 − $59.99 = **$59.89** saved by going yearly; $59.99 ÷ 12 = **$4.9991**,
which is why every surface says "**under $5 a month**" and never "$4.99 a
month" — the rounded figure implies $59.88 a year and is not true. Change a
price and all four move, in the same commit, on all five surfaces
(`app/page.tsx`, `public/subscribe.html`, `public/trial.html`,
`app/subscribe/page.tsx`, `app/terms/page.tsx`).

**The iOS price does not live in this repo.** `subscribe.html` overwrites the
figures with whatever RevenueCat reports from App Store Connect, so the native
card states the saving as a RATIO ("roughly half") and never as dollars — a
hard-coded number there can contradict the button two lines above it. Change
ASC, not this repo.

**Both halves of the switch stay wired.** `trial.html`'s `isFree()` bounce and
`today.html`'s plan-note guard are inert while priced, and the `?paid=1` /
`sona.paidui` seam keeps the purchase rails exercised in tests. Deleting either
direction is how the next flip becomes archaeology instead of a boolean.

### Three free eras, three sweeps, all permanent
`_grandfatherFreeEra()`, `_grandfatherFreeEra2()` and `_grandfatherFreeEra3()`
all run at load and are pinned in `tests/iaptest.mjs` and `tests/freetest.mjs`.
**Do not "clean them up".** Each is a promise to a real cohort:
- **Era one** — before pricing ever existed. Judged structurally: an onboarded
  device carrying no stamp predates pricing.
- **Era two** — nine days in August (20–28). Told a REVOCABLE thing ("the app
  is free"), and Travis chose to keep it for them anyway.
- **Era three** — 31 Aug to 15 Sep 2026, and the most explicit of the three:
  that window was announced as PERMANENT, and `/api/checkout` refused money
  outright. Pricing returned on 15 Sep; those families did not pay for the
  change of mind.

**The sweeps are one-shot and structural, and that is load-bearing.** A device
that is ALREADY onboarded on the first load of the build carrying a sweep
necessarily predates that build. A family arriving afterwards is stamped before
they ever onboard and correctly still pays. Era three deliberately does NOT
read the earlier stamps: a device whose first load happened during the third
window carries `freeera.v1 = "post"` AND `freeera2.v1 = "done"` and belongs to
no earlier cohort, so gating on those keys would skip exactly the families it
exists for.

**Test seeds must set all THREE stamps.** An onboarded seed missing
`sona.freeera3.v1` looks exactly like a third-era family, gets grandfathered,
and silently disables the paywall inside that test. This has now bitten twice —
once per new era — across `iaptest`, `progtest`, `loadtest` and `hwtest`.

Still free regardless of the switch: SLP-referred families (the server-verified
`?slp=` credential — that promise IS the SLP channel), pilots and founders. And
entitlement is never granted from a URL parameter.

**Don't re-open the pricing question in passing.** It has now flipped four
times, and each free window permanently removes its own cohort from ever
paying. That is the honest price, and it is the reason to mean it. **If it goes
free again, the next return to pricing needs `_grandfatherFreeEra4()` written
first** — the precedent is now set three times and the families are told free
on the page that sells the app.

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
