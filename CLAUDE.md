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

## Pricing — one switch, and the cohorts it can never take back
**Sona is PAID: one plan, $59.99/year after a 3-day free trial.** `FREE_MODE =
false` in `sona.js`, mirrored by `lib/pricing.ts`. `gated()` short-circuits on
`isFree()` before anything else, and `tests/freetest.mjs` fails if the two
copies disagree.

**MONTHLY IS RETIRED** (18 Sep 2026). There is one plan. What went with it, and
must not come back as decoration: **$119.88** and **"save $59.89"** were only
ever 12 × $9.99, so with no monthly plan to buy, a struck-through price is an
anchor against a number nobody can pay — an invented was-price, not a discount.
`tests/progtest.mjs` fails if a second plan card or either figure returns.

What survives is checkable on its own: **$59.99 ÷ 12 = $4.9991**, so every
surface says "**under $5 a month**" and never "$4.99 a month" (which would
imply $59.88 a year).

**Retiring a plan does not cancel a subscription.** Anyone still on $9.99/month
keeps it. So: `/api/subscription` must go on recognising `month` intervals,
`IAP_PRODUCTS.monthly` stays in `sona.js` so RevenueCat can restore them on a
reinstall, and the Terms still describe the monthly plan for the people holding
one. Only the PURCHASE path lost it. Old `?plan=monthly` links resolve quietly
to yearly rather than erroring, because a stale link belongs to someone
actively trying to pay.

**Do not hand-edit copy for a pricing flip. The surfaces read the switch.**
The switch has changed **eleven times in seven weeks** (`git log -G'const
FREE_MODE = (true|false)' -- public/sona.js`) — twice on the same day, twice on
consecutive days. Every purchase surface now branches on the switch and keeps
BOTH states: `app/page.tsx`, `app/terms/page.tsx`, `app/subscribe/page.tsx`,
`public/subscribe.html`, `public/trial.html`, `public/today.html`. Flipping
pricing is **one boolean in two files**. If you find yourself rewriting a price
into a page, stop — you are undoing this.

**The iOS price does not live in this repo.** `subscribe.html` overwrites the
figures with whatever RevenueCat reports from App Store Connect, so the native
card states the saving as a RATIO ("roughly half"), never as dollars. Change
ASC, not this repo. And **flipping to free here cancels no Apple or Stripe
subscription** — anyone who bought during a paid window keeps being billed
until it is stopped in those dashboards. That is an operations task.

**The ask happens after the product proves itself.** `planMoment()` fires once,
on the first COMPLETED practice run — never during onboarding, which used to
end at a price screen before the child had said a word. It is an offer, not a
wall, it is inert while free, and it never fires for anyone already entitled.

### Four free eras, and the sweeps that honour them
`_grandfatherFreeEra()`, `_grandfatherFreeEra2()` and `_grandfatherFreeEra3()`
run at load and are pinned in `iaptest.mjs` and `freetest.mjs`. **Do not "clean
them up".** Each is a promise to a real cohort that no later flip can revoke:
- **Era one** — before pricing existed. An onboarded device carrying no stamp
  predates pricing.
- **Era two** — nine days in August (20–28).
- **Era three** — 31 Aug to 15 Sep, announced as permanent.
- **Era four — NEVER HAPPENED.** The switch was flipped free on 17 Sep and back
  to paid on 18 Sep, and the free build was never merged to main in between, so
  production stayed paid throughout and no family was ever told Sona was free.
  There is no era-four cohort, and `_grandfatherFreeEra4()` is deliberately NOT
  written. **The rule still stands for next time:** if a free window actually
  SHIPS, the sweep for it must exist before pricing returns — and "shipped"
  means merged to main, not merged into a branch.

**The sweeps are one-shot and structural, and that is load-bearing.** A device
already onboarded on the first load of the build carrying a sweep necessarily
predates that build; a family arriving afterwards is stamped before they
onboard and correctly still pays. Each new sweep must NOT read the earlier
stamps — a device whose first load happened during a later window carries all
the earlier ones and belongs to no earlier cohort.

**Test seeds must set EVERY era stamp.** An onboarded seed missing the newest
`sona.freeeraN.v1` looks exactly like that era's cohort, gets grandfathered,
and silently disables the paywall inside that test. This has bitten once per
era across `iaptest`, `progtest`, `loadtest` and `hwtest`.

**Tests do not pin the switch's value.** They pin that the two copies agree,
and they exercise the purchase rails through the `?paid=1` / `sona.paidui` seam
so they hold in either state. A test that must be hand-edited on a business
decision guards nothing and taxes every flip. `IS_FREE_NOW` in `iaptest.mjs`
reads the live state from source where a suite genuinely needs it.

Still free regardless of the switch: SLP-referred families (server-verified
`?slp=` — **that promise IS the SLP channel**, and it is free *forever* in
writing on `for-slps.html`), pilots and founders. There is no payment path for
an SLP or clinic anywhere in the product: the SLP channel produces engaged
families and zero revenue by design. Entitlement is never granted from a URL
parameter.

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
