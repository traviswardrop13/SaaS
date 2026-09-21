# Working with Travis (and Rachel)

## Communication style
- Be concise. Default to a few sentences; use short bullets when listing.
- Lead with the answer or the thing that happened. Cut background, caveats,
  and strategy essays unless asked.
- One recommendation, not a menu. No recaps of prior context.
- Long-form only when explicitly asked ("go deep", "full plan").

**Concise is not the same as compressed.** Travis is the founder, not a reader
of this codebase. He has not memorised the function names, the file names, or
the internal shorthand for things — and a sentence he cannot act on because he
does not know what it points at is not brief, it is just short.

Asked for outright, 19 Sep 2026. Three decisions had been flagged as needing
him or Rachel, written as "the not-sure routing", "whether accuracy by sound
stays a percentage", and "the replay boundary". All three were real,
load-bearing questions. None of them meant anything to him, so none of them
could be answered. Four hours of correct work sat waiting on three phrases.

So:
- **Name things by what a parent or a child SEES**, not by the function or the
  storage key that implements it. "The button under the win screen", not
  "planEligible()". Internal names are fine *after* the plain version, or in a
  commit message or PR body where the diff is sitting right there.
- **The first time an internal word appears in chat, define it in one clause.**
  "The demonstration — the one free run a new family gets before any price —"
- **When something needs his decision or Rachel's, give three things:** what
  happens today, what would change if they chose differently, and why it is a
  person's call rather than an engineering one. A decision he cannot picture is
  a decision he cannot make.
- **Explain it the way you would to a smart fifth grader.** That is a clarity
  bar, not a length one — it usually costs a clause, not a paragraph. Being
  brief and being clear are not in tension; being brief and being cryptic is
  just a failure with fewer words.

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
**Sona is FREE** (Travis, 20 Sep 2026: "make it free" — the long game is
SLPs championing it, families practising free, and a paid parent view of
progress later). **When it is paid, it is one plan, yearly, after a 3-day free
trial — $59.99 for the first 50 families (the charter price), $99.99 after
that**, and every rule below is written for that state. `FREE_MODE = true` in
`sona.js`, mirrored by `lib/pricing.ts`. `gated()` short-circuits on
`isFree()` before anything else, and `tests/freetest.mjs` fails if the two
copies disagree.

**THE CHARTER PRICE IS TRUE BY CONSTRUCTION, OR IT IS THE BANNED ANCHOR AGAIN
(19 Sep 2026).** This repo already threw out one struck-through price
($119.88) for anchoring against a number nobody could pay. "$59.99 for the
first 50 families, regular price $99.99" is honest only because spot 51 really
is charged $99.99: `/api/checkout` reads `charterSpots()` (`lib/charter.ts` —
Stripe `subscriptions.search`, memoised a minute, falls OPEN if Stripe is
unreachable so a lookup failure never costs a family $40) and picks the tier
at the moment of purchase, whatever any page showed. Every surface reads that
same count — `/api/charter` for the static pages, `charterSpots()` for the
landing page — and the in-app plan screen disables its button until the count
answers, so a parent never taps $59.99 and meets $99.99 on the Stripe page.
A spots-left number is printed ONLY when Stripe answered it; a fallback count
is a guess, and a guessed scarcity number is the one thing no surface may show.
A spot is a subscription that checkout stamped `tier: charter`, in any status
but the two "never finished paying" ones; the yearly subscriptions from before
the offer existed carry no stamp and are not spots — they are Travis's own
test purchases ("dont count", 19 Sep 2026).
`tests/chartertest.mjs` pins the counting rule and every surface.

The word is **charter**, never **founding**: "founding family" already means
the free SLP-referred cohort, with a banner on Home saying so, and one word
for a paid tier and a free one is a support ticket. `CHARTER_LABEL` in
`lib/charter.ts` is the one user-facing constant. The arithmetic rule extends:
$99.99 ÷ 12 = $8.3325, so "**under $8.50 a month**" and never "$8.33".

The native card shows none of this. App Store Connect owns the iOS price;
mirroring the charter tier there is an ASC introductory offer, not a change in
this repo — `NATIVE.md` says what and why.

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

**The ask happens after the product proves itself.** The offer fires once, on
the first COMPLETED practice run — never during onboarding, which used to end
at a price screen before the child had said a word. It is an offer, not a wall,
it is inert while free, and it never fires for anyone already entitled.

**Eligibility and impression are two functions, and merging them is the bug.**
`planEligible()` answers "should we take them to the plan screen" and changes
nothing; `planShown(surface)` is called by the paywall once it has actually
rendered, and is the only thing that spends the one-shot and logs "plan moment
shown". They were one function (`planMoment()`, now an unused shim) that
decided and consumed in the same breath — so a parent who backed out of the
grown-ups gate in between lost the only ask Sona will ever make, while the
funnel counted an impression nobody saw. `iaptest.mjs` pins both halves.

### Four free eras, and the sweeps that honour them
`_grandfatherFreeEra()`, `_grandfatherFreeEra2()` and `_grandfatherFreeEra3()`
run at load and are pinned in `iaptest.mjs` and `freetest.mjs`. **Do not "clean
them up".** Each is a promise to a real cohort that no later flip can revoke:
- **Era one** — before pricing existed. An onboarded device carrying no stamp
  predates pricing.
- **Era two** — nine days in August (20–28).
- **Era three** — 31 Aug to 15 Sep, announced as permanent.
- **Era four — began 20 Sep 2026**, the day "make it free" merged to main.
  (The 17–18 Sep flip is NOT this era: it never reached main, so no family was
  told anything.) Every family who onboards while this window is open is a
  promise. **`_grandfatherFreeEra4()` is deliberately NOT written yet, and it
  must ship in the SAME build that returns pricing — never earlier.** A sweep
  that ships during the free window stamps the very families it exists to
  protect, before they onboard, and they would pay. The rule: if a free window
  actually SHIPS — and "shipped" means merged to main — the sweep for it
  exists before pricing returns.

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

**THE SLP SIDE IS THE CHANNEL** (Travis, 21 Sep 2026: "im keeping it free.
targetting slps first"). It was hidden on 19 Sep as "not a priority" and that
is now reversed: the clinician door is back on the first setup screen — it is
the only entrance to `ORDER_SLP`, so removing it again makes that whole
branch dead code — `for-slps.html` is indexable and linked from the landing
footer, and `betatest` pins the door OPEN.

Still `noindex`, correctly: `slp.html` and `slp-login.html` (a private
dashboard and its login) and `join.html` (a family's redemption link, which
carries a credential in the URL). Those are surfaces, not marketing.

Not restored, deliberately: the "working with a speech therapist?" card on the
plan screen and the trial page. Sona is free, so neither screen renders —
bringing them back now would be copy nobody sees, and `progtest` and
`slpcode` pin their absence. They return with pricing, if at all.

## The clinician's dashboard: carryover, in the honest register
**The SLP dashboard (`public/slp.html`) is built around ONE problem — carryover
(Travis, 21 Sep 2026):** a child goes home, practises, and the clinician can
see that it happened and paste it into a note. Not "assigning homework"
(table stakes), not income. So the page is Today (who practised this week,
who went quiet, what ends soon — one action per row) → Caseload (every child,
oldest-practised first, **Copy note on every row**) → a child page (8-week
strip, pass rate by sound and position, the current homework, the composer)
→ Settings. Reviewed by three lenses — a school SLP, a district privacy
officer, an engineer — whose rulings are now rules:
- **Register.** "Pass rate" (defined on the page as "did that sound like this
  sound"), "practice", "homework". Never "accuracy", "score", "adherence",
  "therapy", "treatment", "diagnosis", and no credential in an example name.
  `tests/slptest.mjs` scans the page with comments stripped.
- **`SMALL_N = 20`.** Under twenty attempts a pass rate is "too few to read"
  and no percentage is shown — anywhere: table, grid, strip, note, CSV. One
  constant; whether a percentage is shown at all is Rachel's call.
- **The note is a fixed template** and carries its own hedge: "Between {start}
  and {end}, {Name} practised on {n} of {N} days ({avg} tries a day). {Sound}
  in {position}: {pass}% pass rate over {attempts} attempts. A practice
  snapshot from at-home listening on the family's device; not an evaluation."
  Window = the current homework, else the last 14 days. Never an age.
- **No caseload-wide average.** An unweighted mean of percentages across
  children is meaningless; the one number is "N of M children practised this
  week". No leaderboard, no ranking, no comparison across families — a
  district officer ends the app's use on that alone.
- **Invites hold initials, never a name.** The SLP may add a child before the
  family joins, but the placeholder is a label ("MK"), an optional age and a
  target; the family types the name when they join, so nobody at a school or
  clinic ever sends Sona a student's name. Unclaimed invites delete
  themselves after 30 days. The claim fires only on the parent's "Yes, share
  progress" — never on link open — and "No thanks" leaves the SLP seeing "not
  joined", never "declined".
- **Remove means delete.** Removing a child deletes the roster row and the
  homework AND tombstones the child (`slpgone:<code>`) so the device's next
  sync cannot resurrect them; the dialog promises exactly that, and that
  nothing on the family's device is touched. The words ship only with the
  routes.
- **One family door.** Every generated link is `join.html?slp=CODE&k=KEY`
  (`&inv=TOKEN` per child). The message says "free", never "pilot" or "trial".

**The affiliate program, when it is built, is CREATOR-ONLY** (Travis, 21 Sep
2026 — settled, do not re-open). An SLP who makes content and brings in
families from outside their own client base can earn on it. An SLP never
earns on a family from their own caseload: a clinician taking a per-sale
commission for recommending a product to their own clients is a referral fee
under several state practice acts, and two of those reach the party OFFERING
the payment as well as the clinician. So the rule is enforced in code, not by
trust — a payout is structurally impossible for any family that arrived
through that clinician's caseload code or sits on their roster — and the
clinician's free dashboard never depends on how many of their families
upgrade.

## The day: practice, then games
**The books are parked, and Home leads with practice (Travis, 19 Sep 2026).**
The stories "suck and don't even work"; they relaunch in Q4 once they are
good. Until then: Home opens on today's adventure (`charge.html?daily=1`), the
day's three games are open from the first tap (every door goes through
`charge.html`, which asks for the sound first — a typed game URL goes home),
the book button on the Home header says "coming soon" and goes nowhere, and no
page links to `chapter.html`, `story.html` or `library.html`. The reader pages
and the story engine stay in the repo: `dailyGames()` still draws the trio
from the day's chapter and the win screen still turns the page
(`episodeAdvance()`), which is what makes tomorrow's three different — but the
win screen shows no cliffhanger and the mystery game no longer waits on a
story being read. `day1`, `storytest` and `feedtest` pin the day; `readtest`
still pins the reader pages so they work the day they come back.

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
