# Working with Travis (and Rachel)

## Communication style
**Talk to Travis like he's 10 years old, and keep it short** (Travis, 25 Sep
2026: "explain as if im 10 years old and be more concise"). Short sentences,
everyday words, no tech words unless explained in a few plain words. Say what
happened, what he needs to do, and stop. If a reply is more than a few short
lines, cut it.

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

So: **wherever Rachel is presented as an SLP, her name carries "MS, CF-SLP"**
(Travis, 29 Sep 2026: "make sure that it says everywhere that you're talking
about her being a SLP … that she's a CF. So like MS, CF-SLP" — reversing the
23 Sep call to leave the fellowship out). **The line is Travis's, word for
word** (1 Oct 2026: "need to add this to speaksona.com, the onboarding and
anywhere else where it mentions rachels credentials"): **"Built with Rachel,
MS, CF-SLP, a pediatric speech-language pathologist in her clinical
fellowship."** The plain words beside her name are always "a pediatric
speech-language pathologist in her clinical fellowship" ("in my clinical
fellowship" where she speaks): "Rachel Wardrop, MS, CF-SLP · Co-founder ·
Pediatric speech-language pathologist in her clinical fellowship", "Reviewed
by Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her
clinical fellowship", a sign-off "Rachel, MS, CF-SLP · Co-founder". It
replaced the 29 Sep line, "licensed pediatric speech-language pathologist",
which `shiptest` now keeps off every surface (her Idaho CF licence is still
real; the line just says where she is). **Wherever copy presents Sona's SLP,
it names her**: "Built with Rachel, MS, CF-SLP", "reviewed by Rachel, MS,
CF-SLP, a pediatric speech-language pathologist in her clinical fellowship" —
never an anonymous "built with a licensed SLP" or "our SLP". (A child's OWN therapist — "your SLP", "your
child's speech-language pathologist" — is someone else, and stays generic.)
**Her cards name nobody else** (Travis, 29 Sep 2026: "don't mention my name").
Never "fully licensed", never anything that suggests the fellowship is behind
her. `tests/shiptest.mjs` scans every public page, the manifest and every
`app/` and `lib/` source with comments stripped, and fails on: "Rachel" or
"Rachel Wardrop" followed by a clinician word without ", MS, CF-SLP"; an
anonymous "built / made / designed / shaped / reviewed with / by a (licensed)
(pediatric) SLP / speech-language pathologist" or "our SLP"; a page that puts
Rachel and "SLP" or "speech-language pathologist" in one sentence without
"MS, CF-SLP" somewhere on it; any CCC or "certified" claim; and any of the
pages that introduce her (parents, subscribe, trial, progress, talk, slp)
missing it.
One of those places is the Meet Rachel setup screen (Travis, 29 Sep 2026):
her photo, "Built with", "Rachel Wardrop, MS, CF-SLP", and one sentence,
"She is a pediatric speech-language pathologist in her clinical fellowship."
(Travis's line, 1 Oct 2026). Since 1 Oct 2026
it is the last screen before the first game, after the microphone (Travis:
"add the rachel slide right before it goes to the game"). She still is a
Clinical Fellow: if an SLP, a district or a board asks, the answer is yes.

**Never "CCC", "certified", "board-certified" or "ASHA-certified".** The
landing page claimed "Licensed & board-certified (CCC-SLP)" until it was caught
— a specific, checkable false claim about a trademarked certification, on the
page that sells the app. `tests/iaptest.mjs` fails if it comes back, and if
the licence ever lapses or she moves state, that pin is where to start — and
the Meet Rachel setup screen (`onboarding.html`, pinned in
`tests/onboardingtest.mjs`) shows her credential to every new family.
If a change
touches what a child is asked to say, how a sound is cued, what counts as
practice, or what an SLP is shown, it is Rachel's call, not an engineering
one. Surface those in the PR body so she can review them without reading
the diff.

## Pricing — a free version, Premium, and the cohorts no flip can take back
**Current release: pricing is ON (Travis, 30 Sep 2026: "separate free from
paid" ... "we add the paywall today").** `FREE_MODE = false` in
`public/sona.js` and `lib/pricing.ts`. Families first meet it on launch day,
when the launch lock lifts (see "The family app is locked until launch day").
**The free version:** daily practice, **two games for each age group**
(Travis, 30 Sep 2026: "the two free games for older kids, the two free games
for younger kids"): **Fruit Slice and Piano Tiles** for 5-8 (Piano Tiles
turned free that day; Block Stacker, Sound Sprint, Flappy Glide, Hoops, Soccer
Goal and Dino Dig are Premium), **Feed Echo and Bubble Pop** for 3-4 (Bubble Pop came back from
Coming soon that day), and **one book, Rory and the Rainbow** (`FREE_BOOKS`
in sona.js). Everything else is Premium and greyed out ("ask a grown-up");
buying opens every finished game and every book. Unfinished games stay
disabled "Coming …" cards (see "Two Fridays") regardless of subscription,
trial or earned access.

`premium()` recognizes subscriptions, founders, free-era families, founding
pilots, and covered caseloads. Never a fixed count of free games: the plan
screens name them from the catalog, and the free book from `FREE_BOOKS`.
Clinician dashboard and Caseload Premium work stays separate and intact.

**Era five shipped in this build:** `_grandfatherFreeEra5()` keeps Premium for
every device already onboarded when it first loads this build (the window
that opened when #140 restored free on 24 Sep 2026). Preserve all five
sweeps. `tests/freetest.mjs` checks that both pricing switches agree. The
next free window, if there is one, gets its own sweep in the build that ends
it, never before.

**Before families can buy on the iPhone** (Travis's App Store Connect task,
not this repo): the yearly subscription must be approved in App Store Connect
at $59.99. Until Apple approves it, the in-app purchase fails on the iPhone
and only the web checkout sells. **The monthly one too** (1 Oct 2026):
`com.speaksona.app.monthly` must be approved there, at the monthly price,
with **no introductory offer on it**, and sit in RevenueCat's `full`
entitlement. Until all of that is true the iPhone shows the yearly plan alone:
the monthly row appears only when the store hands back that product, priced,
with no free trial attached.

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

**TWO WAYS TO PAY: YEARLY, AND MONTHLY AGAIN** (Travis, 1 Oct 2026: "we need to
add to the paywall a $10 a month option. So that does not have a free trial.
That's a pay today, but the $59.99 has a three-day trial. And have that as the
default option selected"). Monthly was retired on 18 Sep 2026 and is back on
sale: **$9.99 a month, charged at purchase, no trial** (`MONTHLY_CENTS` /
`MONTHLY_PRICE` in `lib/charter.ts`, the one figure checkout, `/api/charter`,
the pages and the Terms use). The yearly plan keeps its 3 free days and the
charter price, and **it is the one picked when the plan screen opens**.
- **The plan screen** (`subscribe.html`, web and Apple cards, offer and
  Settings views): two boxes that are radios, yearly picked, **one button**
  under both. Everything true of only one plan follows the pick, from one
  paint function per card: the button ("Start 3 days free" / "Subscribe —
  $9.99 a month"), the free-days timeline and "no charge today" (yearly only),
  "charged today" (monthly only), the small print and the heading. Nothing
  yearly stays on screen beside a button that charges today. The monthly box
  says **"Charged today"**, never "no free trial" (Travis, 1 Oct 2026: "dont
  say no free trial at the bottom"), and never the word "free" at all.
- **Monthly never touches the charter.** `/api/checkout` has its own short
  branch for it — its own amount, a month interval, no `trial_period_days`,
  **no `tier` stamp**, inline `price_data` only (never an env Price), and it
  does not even call `charterSpots()`. Routed through the yearly block it
  would be charged $59.99 or $99.99 every month. Its price does not move when
  the charter closes, and no surface calls it "charter" or gives it a
  spots-left number.
- **Only the plan screen can ask for it, by the exact word.** `pickPlan` sells
  monthly for `"monthly"` and nothing else; a missing plan, a typo or "month"
  is the yearly plan. **A plain GET link is always yearly**, whatever its
  `?plan=` says: an old ad or email link has no plan screen and no grown-ups
  gate in front of it, and must never open a pay-today checkout.
- **On the iPhone the store owns every figure.** The monthly row ships hidden
  with no price in the markup; it appears only when RevenueCat returns the
  monthly product itself (`Sona.iapProduct` refuses any other id), with a
  price string and **no introductory offer**. No dollar saving and no ratio on
  the Apple card.
- **The comparison figures did NOT come back with it.** **$119.88** and
  **"save $59.89"** are still banned, on every surface, in both pricing
  states (`chartertest`). Twelve months of $9.99 is a real price again, but
  the saving is $59.89 only while the charter price lasts: at family
  fifty-one the yearly plan is $99.99 and the saving is $19.89, and on the
  iPhone the numbers are Apple's.
- **The receipt is Stripe's.** `/api/checkout/session` answers only a session
  Stripe marks `complete` (an opened, unpaid form used to unlock Premium), and
  the success page takes the plan from the subscription's interval, never
  from the address: a monthly buyer is never told "$0 charged" or shown the
  charter line.
`caseloadtest` plays the checkout route against a fake Stripe (what each plan
is charged, charter open and closed); `progtest` and `iaptest` play the pick on
both cards; `firstgametest` keeps both boxes and the button on the first
screen at seven phone sizes with the charter line showing, and re-prices
every yearly figure when the price check answers late.

What survives is checkable on its own: **$59.99 ÷ 12 = $4.9991**, so every
surface says "**under $5 a month**" and never "$4.99 a month" (which would
imply $59.88 a year) — and **always with "billed once a year"**, because
beside a real monthly plan a bare "under $5 a month" reads as a cheaper one.

**A plan off sale is not a cancelled subscription.** Anyone who bought
$9.99/month, in August or today, keeps it. So: `/api/subscription` must go on
recognising every interval, `IAP_PRODUCTS.monthly` stays in `sona.js` so
RevenueCat can restore them on a reinstall, and the Terms describe both plans.
**And a flip to free now leaves monthly buyers charged every month, not once a
year**, in an app that is free: stopping those subscriptions in Stripe and
App Store Connect is the first operations task of any flip (see "The iOS
price does not live in this repo").

**Known, and not fixed by the monthly change (1 Oct 2026) — Travis's call when:**
(1) A family who paid on the WEB has no cancel button: `/api/portal` (Stripe's
billing page) is built but nothing links to it. So the monthly plan's small
print says what is true ("To cancel, email hello@speaksona.com and we'll stop
it", pinned in `progtest`), as the Terms do; the yearly card still says
"cancel anytime in your account", which is the older, looser wording. A
pay-today monthly plan is the one people cancel most. (2) A web purchase is never re-checked on the
device: Home re-asks Apple and a clinician's coverage, but only a parent's tap
on Restore asks Stripe, so a web plan that was cancelled, or a trial that
never became a charge, stays unlocked on that phone.

**Do not hand-edit copy for a pricing flip. The surfaces read the switch.**
The switch has changed **twelve times in eight weeks** (`git log -G'const
FREE_MODE = (true|false)' -- public/sona.js`) — twice on the same day, twice on
consecutive days. Every purchase surface now branches on the switch and keeps
BOTH states: `app/families/page.tsx`, `app/terms/page.tsx`, `app/subscribe/page.tsx`,
`public/subscribe.html`, `public/trial.html`, `public/today.html`. Flipping
pricing is **one boolean in two files**. If you find yourself rewriting a price
into a page, stop — you are undoing this.

**The iOS price does not live in this repo.** `subscribe.html` overwrites the
figures with whatever RevenueCat reports from App Store Connect, so the native
card never states a saving at all, in dollars or as a ratio. Change
ASC, not this repo. And **flipping to free here cancels no Apple or Stripe
subscription** — anyone who bought during a paid window keeps being billed
until it is stopped in those dashboards. That is an operations task.

**The ask happens after the product proves itself.** Setup goes straight into
the first game (Travis, 27 Sep 2026: "it will choose feed echo for the littles
and fruit slice for ages five and up"): Feed Echo for ages 3-4, Fruit Slice (its
practice page first) from 5, a clinician's own setup still ends on Home.
**That first game ends with no price** (Travis, 30 Sep 2026, after playing the
27 Sep version where it did: "the top stays as play again ... when they see
home they see the other games they can play and that there are premium ones
... the flow was not good"): "Play again" on top, "Back home" under it.
`Sona.firstGameStart()` marks the game for this tab and `firstGameEnd(key)`
spends the mark once and always answers Home. The offer is made in exactly two
places, both behind the grown-ups gate: **once**, automatically, at the end of
the first completed practice run ("Show a grown-up →" to
`/subscribe.html?first=1` while `planEligible()` says so), and **whenever** a
grown-up answers a child's tap on a locked game or book ("Ask a grown-up" →
`premium.html`, which forwards a family it would offer to
`/subscribe.html?from=<game>` or `?from=library`). Never during onboarding,
which used to end at a price screen before the child had said a word. It is an
offer, not a wall, it is inert while free, and it never fires for anyone
already entitled. Declining leaves Home with every game but the free ones
greyed out (still tappable: "ask a grown-up"). `tests/firstgametest.mjs` pins
all of it.

**The plan screen reached as an offer is a moment, not Settings** (Travis, 30
Sep 2026: "this paywall is absolutely terrible!"). With `?first=1` or `?from=`
and a purchase card on screen, `subscribe.html` sets `body.offer`: the
grown-ups tabs, crumb, "Your plan" head and summary box step aside, and the page
leads with the Premium games in Home's own art (`Sona.CRAFTED_CARDS`, one map
for both pages), one line built only from what the device recorded ("Milo just
practiced the R sound — 12 words out loud!") or the tapped game ("Milo wants to
play Hoops"), a headline, three checks, then the plan card (two ways to pay
since 1 Oct 2026, above) with the button on the first screen at 360×740,
375×667 and up. **The fit is measured, never guessed from the screen's
height:** `fitOffer()` looks at where the button actually landed and takes
one step at a time (`body.fit1`…`fit5`: a smaller picture, a strip, tighter
type and boxes, then the third check gives way to the "What stays free" card
under the offer, and only last the picture goes) until it is on screen. A
height rule failed between 701 and 855 px tall with the charter line showing.
Everything it resizes has `transition:none`, because `sona.css` gives every
property a near-instant transition under Reduce Motion and a box
mid-transition reports the size it WAS. **The line under the headline says
who Premium's games are for, never how many** (Travis, 1 Oct 2026: "a
different way to say 6 more games today, like more games for littles and for
bigs ... new ones on the way is fine"), and it is read from the catalog so it
is true for the parent reading it: "More games for little kids and big kids,
and new ones on the way." only once BOTH age groups have a Premium game a
child can open. On 1 Oct every playable Premium game was a big-kid (Arcade)
one, so it says "More games for big kids, and new ones for little kids on the
way." and changes by itself the day a little-kid Premium game is released. No
date is promised. **Anything switched with the `hidden` attribute is hidden**
(`[hidden]{display:none !important}` on this page): a display rule on the same
element once showed an empty win pill and Rachel's line twice. Rachel's line moves under the
decline, word for word. Settings › Your plan (no flag) is the page as it was.
Every pricing rule in this section still applies to the card itself.

**Eligibility and impression are two functions, and merging them is the bug.**
`planEligible()` answers "should we take them to the plan screen" and changes
nothing; `planShown(surface)` is called by the paywall once it has actually
rendered, and is the only thing that spends the one-shot and logs "plan moment
shown". They were one function (`planMoment()`, now an unused shim) that
decided and consumed in the same breath — so a parent who backed out of the
grown-ups gate in between lost the only ask Sona will ever make, while the
funnel counted an impression nobody saw. `iaptest.mjs` pins both halves.

### Clinician Premium — for you, then for your caseload
**Two yearly plans, bought on the web by the clinician** (Travis, 24 Sep 2026
— this reversed "there is no payment path for an SLP or clinic"; re-priced 29
Sep 2026: "they're going to still pay the 60 bucks for an account, and they
can pay an extra 60 bucks a year for all of their caseload"):
- **"Sona Premium for you", $59.99 a year** (`plan: slp-self`): every game on
  the clinician's own phone or tablet, by the emailed own-phone link.
- **"Sona Premium for your caseload", $59.99 a year MORE** (`plan:
  slp-caseload, addon: "1"`): every family who joins through that clinician's
  link gets Premium — whether or not they say "Yes, share progress": access
  and sharing are separate promises. **An add-on:** `/api/slp/plan` refuses
  it (`needSelf`) until the clinician's own Premium is on, and the page and
  Settings say so. Its own subscription, under the same Stripe customer, so
  Manage billing shows both and each cancels on its own.
Stripe hosted checkout from the dashboard's Premium page or the Premium card
in Settings, **no trial**, renews yearly, cancel anytime in Stripe's billing
portal. $59.99 ÷ 12 = $4.9991, so "**under $5 a month**"; both, $119.98 ÷ 12
= $9.998, "**under $10 a month**". Neither is the family plan at the same
figure: never a charter spot, never $99.99 when the spots run out.
`lib/caseload.ts` holds every constant; the static landing page cannot import
it, so `shiptest` pins its copy to it. The caseload's fixed-Price env var is
`STRIPE_PRICE_ID_SLP_CASELOAD_ADDON` (new, so an old $79.99
`STRIPE_PRICE_ID_SLP_CASELOAD` can never be charged under a $59.99 page); the
own plan's is `STRIPE_PRICE_ID_SLP_SELF`. Both optional.
- **Three account eras, one `terms` stamp, never backfilled.** No `terms`
  (before 24 Sep): caseload AND own phone free forever. `terms:
  "caseload-2026-09"` (`FREE_SELF_TERMS`, 24–29 Sep): own Premium free with a
  work email or a founder's approval, as they were told; caseload is the
  add-on. `terms: "premium-2026-09-29"` (`CASELOAD_TERMS`, from 29 Sep): buy
  both. A caseload subscription sold before 29 Sep has no `addon` stamp: it
  keeps renewing at $79.99 (`LEGACY_CASELOAD_PRICE`) and keeps switching on the
  clinician's own phone. `selfStatus()` in `lib/caseload.ts` is the one place
  those rules live; `/api/slp/covered` reads it for an own-phone ticket.
- **Covered = paid or grandfathered.** Paid is a Stripe subscription stamped
  `plan: slp-caseload, slp: <email>` in active, trialing or past_due. Stripe
  keeps a cancelled plan active to its period end, so families keep Premium to
  the end of the year that was paid for, then drop to the free version — and
  that holds by construction, not by a dashboard toggle: **Manage billing opens
  the caseload's OWN billing-portal configuration, whose cancel button cancels
  at period end** (`openCaseloadPortal()` in `lib/caseload.ts` creates it once
  and reuses it — its id cached per Stripe mode in the `stripe:portalcfg:caseload`
  hash — or reads `STRIPE_PORTAL_CONFIG_CASELOAD`). A "no plan" answer is
  remembered for 60 seconds only, so a payment whose redirect was lost is
  found by the recovery search within a minute. The account's
  default portal, which the family billing page shares, is only the fallback
  if Stripe refuses that configuration. Never a `tier` stamp: only
  `tier: charter` is a charter spot.
- **Clinicians who signed up before 24 Sep keep "free forever".** They were
  promised "Free forever, unlimited families — for you and every kid on your
  caseload", and they and their caseload stay covered, free. Structural, no
  dates: an account with no `terms` predates it. Never backfill that field.
- **"Every family on your caseload", never "unlimited".** The redeem cap is
  300 for a covered clinician (60 uncovered), counted **per code AND per
  clinician** (`slpredeem:<code>` and `slpredeem-owner:<email>`, ~a year each)
  — a clinician can claim a new code at any time and every code shares one
  family key, so a per-code cap alone multiplied with every rename. It counts
  successful sign-ups, not distinct families (a second phone or a re-tapped
  link counts again), so the Terms say "a single link allows up to 300
  sign-ups a year … we raise it on request", and the error at the cap says
  "ask your speech therapist to contact Sona" — a fresh link hits the same
  wall.
- **Coverage rides the enrolment ticket, and the ticket never freezes.**
  `/api/slp/covered` answers a correctly signed ticket at any age and, past
  half its 400-day life, hands back a fresh one that `Sona.caseRefresh()`
  stores — before this, from day 400 a family's coverage stuck in whatever
  state it was last in. The SLP link state (`sona.slp`, `sona.slpok`,
  `sona.slpticket`) **travels through the move-in code and backups**, because
  the iOS app keeps separate storage from Safari and that is the only way a
  covered family's Premium reaches the iPhone app; the cached answer
  (`sona.caseplan.v1`) never travels, and the server is asked afresh.
- **The clinician earns nothing on their caseload, ever** — the creator-only
  rule below is unchanged, and the Premium page says so in words.
- **The family price, on the Premium page, comes with its conditions** —
  "on the web, $59.99 a year for the first 50 families" (price and cap from
  `/api/charter`), "on the web, $99.99 a year" once the charter spots are
  gone, and nothing when the route doesn't answer. A clinician repeats what
  she reads, and a bare launch price is a figure most families will not see.
- **Their own phone: bought, or free where it was promised.** The dashboard
  stays open to any email (the landing page collects every one). The
  own-phone link is emailed to anyone whose own Premium is on. Only a 24–29
  Sep account without a work email sees "No work email? Request access",
  approved by hand on `/leads.html` (which, and `/api/founders/approve`,
  refuse an approval for any other account: it would change nothing).
  Approval sends no email, so the card says "Requested — once we approve it,
  this button will work." beside the greyed-out button. **Never "one phone":**
  each link works once, but three can be sent a day and none is retired, so
  the copy is "Premium on your own phone or tablet. Each link works once."
  How many devices a clinician may have is Travis's open call.
- **The family surfaces refuse both clinician receipts** (`isClinicianPlan()`):
  restore-by-email, the family billing page and the family success page.
- **Web only.** Clinician pages never render in the iOS shell, so neither plan
  has an App Store product or meets an in-app purchase rule (`NATIVE.md`).
  They do not read `FREE_MODE`, which is the FAMILY paywall switch.

### Five free eras, and the sweeps that honour them
`_grandfatherFreeEra()` through `_grandfatherFreeEra5()` run at load and are
pinned in `iaptest.mjs` and `freetest.mjs`. **Do not "clean them up".** Each is
a promise to a real cohort that no later flip can revoke:
- **Era one** — before pricing existed. An onboarded device carrying no stamp
  predates pricing.
- **Era two** — nine days in August (20–28).
- **Era three** — 31 Aug to 15 Sep, announced as permanent.
- **Era four** — 20 Sep 2026 ("make it free" merged to main) to the Caseload
  Premium build of 24 Sep 2026. (The 17–18 Sep flip is NOT this era: it never
  reached main, so no family was told anything.) **`_grandfatherFreeEra4()`
  shipped in that same build**, as this rule required (Travis, 24 Sep 2026), and
  it also counts a device that had redeemed a clinician's link
  (`sona.slpunlock` / `sona.slpok`): before that build a redemption WAS
  free-forever access. The rule stands for the next window: a sweep ships in
  the build that ends a free window that actually SHIPPED (merged to main) —
  never earlier, because a sweep shipped during the window stamps the very
  families it exists to protect before they onboard, and they would pay.
- **Era five** — 24 Sep 2026 (#140 made the family app free again the
  afternoon Caseload Premium merged) to the paywall build of 30 Sep 2026.
  **`_grandfatherFreeEra5()` shipped in that build**: every device already
  onboarded on its first load keeps Premium for good (`freeEra5` on the
  profile, `sona.freeera5.v1` stamped). Unlike era four, a clinician's link on
  its own is not this era's evidence: since 24 Sep a redemption is a ticket
  whose Premium is the clinician's coverage, and that promise keeps itself.
  The launch lock means most families meet this sweep on launch day, their
  first load of the build.

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

Free regardless of the switch: practice, the free games (Fruit Slice, Piano
Tiles, Feed Echo and Bubble Pop) and the free book (Rory and the Rainbow), for every
family; founding pilots (`ff-` codes) and founders; every device onboarded, or
that redeemed a clinician's link, before the Caseload Premium build; every
device onboarded before the paywall build of 30 Sep 2026. **Not**
an SLP-code pilot: "Yes, share progress" makes every consenting family a
pilot, so counting `isPilot()` in `premium()` would hand every uncovered
clinician's families Premium and undo the caseload plan.
- **Founding status is the household's** (`sona.founding.v1`, written by the
  verified `?ff=` path — or carried out of a slot an older device's `ff-` code
  is about to be overwritten in — and on `NO_IMPORT`). It used to be read off the
  per-child pilot code, which "Yes, share progress" overwrites with the
  clinician's code — so a founding family lost every game the day they joined
  an uncovered clinician, and a second child never had them.
- **Grandfathering is the household's too.** `addKid()` copies `earlyAdopter`
  onto a new child, and an import never takes a free-era mark away from the
  device it lands on (it never brings one either). It is still a mark on the
  device the sweep ran on: it does not travel to a new phone. **What a clinician's link
brings changed on 24 Sep 2026 (Travis):** until then it was free-forever
access, in writing on `for-slps.html`; now it is the free version, plus every
game while that clinician's caseload is covered. Entitlement is never granted
from a URL parameter: coverage is the server's answer to the enrolment ticket
the device earned by redeeming code + key (`Sona.caseRefresh()`, re-asked every
6 hours; only an authoritative answer changes anything).

**THE SLP SIDE IS THE CHANNEL** (Travis, 21 Sep 2026: "im keeping it free.
targetting slps first"). It was hidden on 19 Sep as "not a priority" and that
is now reversed: the clinician door is on the first setup screen — since 1 Oct
2026 that screen IS the question, "Who's setting up Sona?", with two answers,
"Parent or caregiver" and "SLP or SLPA" (Travis: "have the very first step in
onboarding ask"). In a browser the SLP answer is the only entrance to
`ORDER_SLP`, so removing it makes that whole branch dead code; in the iPhone
app, which never opens clinician screens, it sets the app up for a child and
says the dashboard is on the web (no link, no price) — `for-slps.html` is indexable and linked from the landing
footer, and `betatest` pins the door OPEN. Since 24 Sep 2026 the channel can
also pay: the dashboard and the free version stay free, and a clinician who
wants every game for their families buys their own Premium and adds their
caseload — yearly prices, never per family, never to the clinician. **Parents come first now** (Travis,
29 Sep 2026: "lose my attachment in stop caring about the SLP stuff, but still
leave the $5 a day add on"): the SLP ad keeps running and the offer sits in
plain sight on the dashboard, but the new ads, and the work, go to parents.

**speaksona.com is for parents and caregivers** (Travis, 26 Sep 2026: "change
it to target parents and caregivers only. not slps"). Its yellow is pale
butter, not sun (27 Sep 2026: "the more pale yellow. to help the app icon in
top left stand out"), so Echo's bright tile is the yellowest thing on it. The
root is `parents.html`: the parent ads' headline ("Speech practice kids ask for."),
the new Echo and the two game screens from those ads, one email box and one
button (role `parent`, nothing else — no name, no "I'm a…"), then the App
Store (Android: the web app). No Sign in in its header; the footer sends a
speech therapist to `/for-slps`. Its pictures were cut from the ads and
changed only where the ads showed what the app no longer does — the STAR MODE
gold tile, gold key and star fruit, and the "Say rrrr for GOLDEN KEYS / a
FRENZY" banners are painted out — and the ads' text thread and "Max's" fridge
note are not used: they quote parents who do not exist. It never prints a
dollar figure; its cost answer reads the switch from `/api/charter`. Its
game count (every game Home opens, never a Coming soon one), its book count
(only the books the shelf has opened: each book tile carries its opening day,
and the page counts and tags them on the visitor's own calendar) and "19
speech sounds" are pinned to the catalog by `shiptest`, and its game strip
shows only games a child can open: bring a game back and the test fails until
the page says so. **The strip's game tiles are the app's own painted Home
cards** (1 Oct 2026; they were the old flat stickers and three frames of a
canvas court beside painted book covers): `python3 tools/art/site-tiles.py`
cuts each `public/assets/crafted/home-<name>.webp` to a square in
`public/assets/site/games/<key>.webp`. A new game on the strip is one line in
that script's `TILES`. The two phone screens (`/assets/site/slice.webp`,
`piano.webp`) are still the ads' flat pictures; fresh captures of the painted
games are owed.

**The clinician page lives at `/for-slps`** (the root from 22 to 26 Sep). It
still speaks to parents and SLPs alike (Travis, 25 Sep 2026: "I don't know
who my customer is"): the headline stays, and the one form asks for **an
email and "I'm a…"** (Parent or caregiver · Speech therapist (SLP or SLPA) ·
Other) and nothing else. The header is just Sign in (Travis, 26 Sep 2026:
"get rid of for parents"). An SLP or SLPA also gets their dashboard account
and sign-in email, because the iPhone app has no clinician side; everyone
else goes to `/api/lead` with their email and role. An ad aimed at speech
therapists belongs on speaksona.com/for-slps. `tests/landingtest.mjs` drives
both pages.

**The app is live, and the websites send people to the App Store** (Travis,
1 Oct 2026: "yeah send people to app store now!", with the listing checked:
a free download, not a pre-order). `APP_READY = true` in `lib/launch.ts` and
`var APP_READY` in `parents.html` and `for-slps.html`, pinned equal by
`shiptest`: the top line reads "Now on iPhone and iPad", Start free takes the
email and opens the App Store (Android: the web app), and the "launches
Friday" welcome email and the clinician's P.S. stop. **Nobody on the waiting
list is emailed by this**: they were promised an email "the moment it's
ready", and that is a Kit broadcast Travis sends. The switch stays, both
states built, for the next time the app is not ready (25 Sep 2026: "the app
launches next week"; the iOS 27 build closed on launch). While it is `false`,
nobody is sent to the App Store: a parent or "other" is thanked
on the page ("Sona launches Friday, October 2. We'll email you the moment it's
ready.", the date Travis emailed the list on 30 Sep) and emailed the same once through Resend (`/api/lead`,
`launchmail:<email>`; a reply goes to `RESEND_REPLY_TO` when it is set, and
nowhere otherwise); a speech therapist goes to their dashboard's
community (`/slp.html#community`) and their sign-in email carries the same
P.S. Not the web app: Travis chose to wait for the app. When the app is
live, set all three switches to true.

**The family app is locked until launch day** (Travis, 30 Sep 2026: "the
official V1 of Sona launches Friday, October 2nd ... lock the app until
Friday ... they can turn on a notification if they press notify me or ... put
in their email"). Until `LAUNCH_AT` in `lib/launch.ts` (midnight at the start
of Friday 2 October in Idaho, 06:00 UTC), `middleware.ts` answers every
family page, on the iPhone and the web, with `public/launching.html` at the
same address: the date and one email box (`/api/lead`, role `parent`, source
`app-launch`, the one launch email). `OPEN_PAGES` stay open: the two
websites, the clinician's dashboard and sign-in, the founder pages, privacy
and the lock page. Every other .html page locks, a new one included. At
`LAUNCH_AT` the app opens by itself with no deploy, and a phone left on the
lock page reloads into it. **The team door:** five taps on Echo, then the
founder key (`/api/launch/preview`, sent in a header, never the address)
sets an HttpOnly cookie that is an HMAC of the key; the iPhone app keeps its
own cookies, so open the door from inside the app. `APP_READY` still flips by
hand, once the App Store shows Get. An App Review build before launch sees the
lock page. `tests/launchtest.mjs` pins all of it.

**The lock was lifted early** (Travis, 30 Sep 2026: "Reopen the app so that I
can more easily edit", and yes to opening it for everyone now, before the
Friday launch he emailed). One switch, `LAUNCH_LOCK` in `lib/launch.ts`:
`false` opens every family page whatever the date; `true` locks them until
`LAUNCH_AT` again, as above. The date, the lock page and the team door stay,
unused, and the websites still say the app launches Friday. A lock page left
open (an iPhone app in the background) asks the server when it comes back to
the front and opens the app once Home is no longer the lock page.
`launchtest` tests the lock switched on and off, whichever way it ships.

**The SLP community shows who is there** (Travis, 25 Sep 2026): the real
number of SLP accounts and up to a dozen members' first names, newest first,
only to signed-in members, rebuilt every ten minutes
(`{slp-community}:members`). Never a last name, an email or an invented
member.

Still `noindex`, correctly: `slp.html` and `slp-login.html` (a private
dashboard and its login) and `join.html` (a family's redemption link, which
carries a credential in the URL). Those are surfaces, not marketing.

Still absent now that Premium is back (24 Sep 2026): the "working with a
speech therapist?" card on the plan screen and the trial page; `progtest`
pins its absence. Bringing it back is a product call, not a cleanup.

## The clinician's dashboard: carryover, in the honest register
**The SLP dashboard (`public/slp.html`) is built around ONE problem — carryover
(Travis, 21 Sep 2026):** a child goes home, practices, and the clinician can
see that it happened and paste it into a note. Not "assigning homework"
(table stakes), not income. So the page is Today (who practiced this week,
who went quiet, what ends soon — one action per row) → Caseload (every child,
oldest-practiced first, **Copy note on every row**) → a child page (8-week
strip, pass rate by sound and position, the current homework, the composer)
→ Premium (its own page, 24 Sep 2026: Today keeps exactly its four
cards, and no price ever appears in them; viewing it only reads) → Settings
(which carries a Premium card with the same two plans and buy buttons, 29 Sep
2026: "an upsell … in like the SLP settings").
Since 29 Sep 2026 (Travis: "yes add the $80 button to the first screen") a
button with the server's price sits in the top bar of every page but the
Premium page, because a clinician from the ad lands on Community and never
saw the price. It offers the next thing to buy: **Get Premium** (their own)
until that is on, then **Add your caseload**, then nothing. Only once the
plan has answered; `slptest` 9b pins it.
Reviewed by three lenses — a school SLP, a district privacy
officer, an engineer — whose rulings are now rules:
- **Register.** "Pass rate" (defined on the page as "did that sound like this
  sound"), "practice", "homework". Never "accuracy", "score", "adherence",
  "therapy", "treatment", "diagnosis", and no credential in an example name.
  `tests/slptest.mjs` scans the page with comments stripped.
- **`SMALL_N = 20`.** Under twenty attempts a pass rate is "too few to read"
  and no percentage is shown — anywhere: table, grid, strip, note, CSV. One
  constant; whether a percentage is shown at all is Rachel's call.
- **The note is a fixed template** and carries its own hedge: "Between {start}
  and {end}, {Name} practiced on {n} of {N} days ({avg} tries a day). {Sound}
  in {position}: {pass}% pass rate over {attempts} attempts. A practice
  snapshot from at-home listening on the family's device; not an evaluation."
  Window = the current homework, else the last 14 days. Never an age.
- **No caseload-wide average.** An unweighted mean of percentages across
  children is meaningless; the one number is "N of M children practiced this
  week". No leaderboard, no ranking, no comparison across families — a
  district officer ends the app's use on that alone.
- **Invites hold initials, never a name.** The SLP may add a child before the
  family joins, but the placeholder is a label ("MK"), an optional age and a
  target; the family types the name when they join, so nobody at a school or
  clinic ever sends Sona a student's name. Unclaimed invites delete
  themselves after 30 days. The claim fires only on the parent's "Yes, share
  progress" — never on link open — and "No thanks" leaves the SLP seeing "not
  joined", never "declined".
- **A parent's email, typed by the clinician, is used once** (Travis, 24 Sep
  2026). Add a child may carry it; Sona hands it to Resend to email the join
  link one time and keeps no copy — not on the invite, not in Kit or
  `/api/lead`, not in a log — at most 30 a day per clinician. Say "handed to
  Resend", never "kept nowhere": Resend has it, and a privacy officer checks.
  A parent joins the list only by typing their own email under the consent
  line (`join.html` → `/api/lead`).
- **Remove means delete.** Removing a child deletes the roster row and the
  homework AND tombstones the child (`slpgone:<code>`) so the device's next
  sync cannot resurrect them; the dialog promises exactly that, and that
  nothing on the family's device is touched. The words ship only with the
  routes.
- **One family door.** Every generated link is `join.html?slp=CODE&k=KEY`
  (`&inv=TOKEN` per child). The message says "free", never "pilot" or "trial",
  and promises what is true today: the free version, and Premium only while
  the caseload is covered. "Free forever" and "unlimited" are gone from every
  clinician surface (`slptest`, `shiptest`).

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

## The email list: Kit (GoHighLevel is gone)
**GoHighLevel was deleted on 24 Sep 2026; Kit replaced it.** Every grown-up's
email goes through one door, `/api/lead`: the SLP sign-up (via the auth
route's `tellCrm`), the app's setup (a clinician's account email, a parent's
weekly-summary email), the parent's optional box on `join.html` and the Speech
Check. An address a clinician types for a parent never reaches it. That route:
- **keeps every lead first** in the store (`leads:all`, capped), whether or not
  a list takes it — it once forwarded and forgot, and 26 "leads" were unfindable;
- sends it to **Kit** (`lib/kit.ts`: create the subscriber, then the optional
  `KIT_FORM_ID` form and a `sona-slp` / `sona-parent` tag). Only creating the
  subscriber counts as success; a failed form or tag step is logged, not lost;
- says `captured` only when a list actually said yes.

What reaches Kit: the email, a **clinician's own** first name, and the role tag
(`sona-slp`, `sona-parent`, `sona-other`).
Never anything about a child. Wherever an email joins the list, the page says
so first, in Travis's words: "We'll also send occasional tips from Rachel.
Unsubscribe anytime." **Except the landing pages**, where Travis took the line
out (25 Sep 2026: "get rid of this text"); their "What's stored" answers
still say the email goes to Kit. Meta's `Lead` fires only when an email was given.

`/leads.html` (private, behind `FOUNDER_KEY`) lists every captured email and
every clinician account, counts everyone since the "I'm a…" landing page
(25 Sep 2026) by what they chose, and its "Send everyone to Kit" button is the catch-up:
it re-sends everyone Sona holds, tagged `sona-slp` (a clinician account or an
SLP sign-up), `sona-other` (answered Other) or `sona-parent`, and is safe to
press again. Kit tags only add, so a wrong tag is fixed in Kit, not by
re-running.

## Home: choose a game, then practice
**Home is the silent Play library (Travis, 24 Sep 2026).** `today.html` opens
on “Pick a game!”; `activities.html` preserves old query/hash links by
redirecting there. Setup finishes in the first game (Feed Echo for 3-4,
Fruit Slice from 5; see "The ask happens after the product proves itself"),
and every visit after that opens on Home. There is no old adventure-map Home or menu narration. Voice remains
inside deliberate game/practice sessions. Parent settings, progress,
profiles, earned coins, homework and entitlement sync remain available.

**The fuller books** (Travis, 26 Sep 2026: "do one for each letter"): one
twelve-page story per sound, first on each sound's shelf in `library.html`.
Each puts its sound at the start of a word, before a vowel, on every page, and
nowhere else in the book (not mid-word, not at the end, not in a blend).
Spelling can't check that, so `readtest` checks every line against
`tests/booklex.json` (pronouncing-dictionary entries); a new word needs its
entry there (so does a six-page book's key word). The reader tints only the start of each book's listed `words`.
Every page is a picture in the crafted style: **all 19 fuller books were
redrawn on 1 Oct 2026** (Travis: "every design done by claude we will be done
with") as `cover.webp` + `p01..p12.webp` in `public/assets/books/<slug>/`.
They are made by `tools/art/` (README in each script's header):
`book-prompts.json` holds each book's character bible and one description per
page, built around that page's key word; `gen-books.mjs` draws a cover, a
character lineup, then every page as its own picture with the cover and lineup
attached (six pages on one sheet put 5-9 of 12 in the wrong place);
`cut-books.py` trims and sizes them; `wire-books.mjs` swaps a book in.
Every page was checked by eye against its line and key word; the pages the
check still questioned are listed on the review page (`tools/art/review/`)
for Travis and Rachel. **What a picture shows the child is Rachel's call**:
redraw a page through `gen-books.mjs --redo <slug>:pNN`, never by hand-editing
a prompt into a different word.
`tools/bookart/` (the old SVG builder) now builds no book — `handmade.mjs`
lists all 19 and `books1.mjs`/`books2.mjs` are empty — but stays because
`tools/gameart/` draws the parked games from its kit. The builder still never
draws over hand-made art and refuses a book name it doesn't build;
`tests/arttooltest.mjs` pins the lists against the shelf and every
book-picture path any page uses.
**The books are on** (Travis, 26 Sep 2026: "yes turn them on"), and **one is
free** (30 Sep 2026: "one book uh so like the letter r book ... to be free and
the rest is grayed out"). Home's Books card always opens `library.html` and
says "1 free book" to a family without Premium. On the shelf each book asks
`Sona.bookLocked(title)`: the books in `FREE_BOOKS` (Rory and the Rainbow) are
open in every pricing state, marked "Free" while others are locked; every
other book that is out is Premium and opens exactly when a Premium game does
(`booksOpen()`: Sona free, Premium from any source, or a trial; never the
three-day demonstration window `gated()` honours, or a new family would watch
the shelf lock under them), greyed and marked "Premium", and a tap shows the
grown-up message ("Ask a
grown-up to help open …", naming the free one) with the button to
`premium.html`, behind the grown-ups gate. `openBook()` refuses a locked book
too. A child whose own books are all locked or coming sees the free book first.
Rename Rory and the Rainbow and `FREE_BOOKS` must follow (`readtest` pins it).

**Every book that is made is live** (Travis, 1 Oct 2026: "if anything is
made ... let's just make it live", replacing the 9 Oct opening day). No book
in `STORIES` carries `opens`; the shelf's `opens` support stays, so a future
book can still wait for a day ("Coming Oct 9"). The six-page books (painted,
see below) sit after every twelve-page one in `STORIES`: they put the sound
anywhere in a word and are last in line to be redone. A limited-time book
carries `season` instead and is on the shelf, and Home's Limited time row,
only inside its window. **Halloween (October 2026) has one for six sounds**
(Travis, 2 Oct 2026: "take a popular book like the halloween and make a
version for other letter even just the popular ones like r s l z f"): Boo the
Bat (B, `anySound`), Rory the Rabbit (R), Sid the Seagull (S), Leon's
Trick-or-Treat Night (L), Zoe the Zebra (Z) and Finn the Fish (F), each
starring that sound's own hero under the same sound rule. A child sees the
one in their own sound; a child whose sounds have none sees Boo
(`Sona.seasonPick`, which the shelf and Home both ask); play mode and a child
with no sounds yet see them all. Home's card,
the website and the Premium page say "new ones on the way", never "every
week", "a book for every sound" or a weekday. `readtest` pins that nothing
waits; `landingtest` the website's count.

**The other sounds' books wait behind "More books"** (Travis, 1 Oct 2026: "it
displays the ones that are selected for the target letter and sound ... and
the other ones ... they're still there, but like closed up ... there's like a
button you can press to like drop down and then it shows the books for the
other letters ... a kid, like they might be like wanting to just do the
Halloween one"). The top shelf is chosen as before: the child's own sounds'
books, plus the limited-time book(s) `Sona.seasonPick` gives them (in October
the Halloween book in their own sound, or Boo the Bat when their sounds have
none; see "Every book that is made is live"), and the free book first when
their own have nothing to read. Under it sits one cream pill, "More books
(N)", N being how many books are behind it for this child, closed on every
load with nothing remembered; a tap opens "Books for other sounds", every
in-season book the top shelf left off, and a second tap closes it. **The other
sounds' Halloween books are behind it too**, so the Halloween one a child
"might be wanting to just do" is always one tap away, and the two shelves
together are the whole in-season list, each book once: 48 books in October
(42 and the six Halloween ones), so a child on R has 9 on top and 39 behind,
a child on K 3 on top (their two and Boo) and 45 behind; 42 the rest of the
year (8 and 34 for R). Play mode, or a child with no sounds picked, already
has the whole shelf, so the pill is not there. Behind it: readable first, then
Premium (nothing is "coming" since every book that is made is live), each
sound's books together in the order `STORIES` names the sounds. Both shelves
are built by one function (`addBook` in `library.html`), so a book there
opens, locks and asks for its word exactly as it would on top; never a second
copy of the button.
The second shelf's buttons are made on the first open, because a cover on the
page is downloaded whether or not it shows. Menus stay silent: the page's tap
chime, no voice. **A double tap opens it once, and opens no book:** opening
slides the pill to the top of the screen and closing lets the page spring
back, so a second quick tap used to land on whatever had moved under the
finger: a book the child never picked or, without Premium, "Ask a grown-up to
help open …" for one, a push toward the plan screen nobody asked for. So for
700 ms after either tap nothing on the page takes a tap, the pill included
(`.wrap.settling`, lifted by a timer; scrolling and the keyboard still work).
The pill's colours are action.css's cream pill and nothing else: the page's
own rules for `#moreBtn` set its size and place only, and `readtest` fails on
a colour, border or shadow there. **What this changes for a child is Rachel's
to know:** a child on R can now open an S book, and it asks them to say that
book's words if they are old enough for that sound (`Sona.soundNorm` of the
BOOK's sound, not the child's). Still play, never practice data. `readtest`
pins both shelves; `booktest` the word moment from the second one.

**The six-page books are painted** (Codex, 28 Sep 2026, with ChatGPT's image
tool; brought over 29 Sep): one picture per book in `public/assets/books/painted/`
holding its six scenes, three across and two down, in reading order, plus a
small `-cover` copy of scene 1 that the shelf shows like any drawn cover, so a
book that isn't open yet never pulls the big picture. The full-screen reader
cuts page i's scene out of that picture on the phone (a canvas, once per book,
one book kept at a time, still one download) and shows it exactly as it shows
a drawn page: whole at full width, its own top and bottom rows carried out to
the screen's edges, the cream card over its foot. The title page is scene 1
(the small copy until the full-size cut is ready). While the picture is on its
way a page shows its wash and fills in; if it never comes, the old emoji
sticker, never a blank page. The art was drawn for those exact 78 sentences,
so `readtest` pins them (change a sentence and redraw its scene) and checks,
by comparing pixels, that each page shows its own scene. Codex's own
say-a-word-to-turn-the-page prototype was not brought over; the books
branch's version below was, and it is ON for the twelve-page books (Travis,
29 Sep 2026: "On now", after being told it changes what a child is asked to
say) **and, since 1 Oct 2026, for these thirteen too** (Travis: "It's doing
it on some of the books. But we want to make that something that is happening
on every book"). Each carries six `keys`, one a page, and no `words`. They
put the sound anywhere in a word and their sentences can't change, but a key
is the one word the child is asked to say, so the keys keep the twelve-page
rule: a whole word on its own page, lower-case, that starts with the book's
sound before a vowel by its `tests/booklex.json` entry. Where a page had such
a word it is the key ("she", not "milkshake"; "ruby", not "rooster"). Two
words can't, and `readtest` lists them by name so the next one is a decision:
**"bath"** on the TH book's fifth page, where no word starts with that sound
(the one key in the app that isn't start-of-word, while Settings tells parents
"Sona practices each sound at the beginning of a word"; true of practice, and
a book word is play), and **"rory"**, an R on both sides of "or", on a page
with nothing easier. A key the reader can't find fails silently (Echo asks,
nothing glows), so `readtest` runs every key of every book through the
reader's own highlighter. Nothing about the moment changed for them, the age
rule least of all: a child of 6 is not asked on the five R books, and a child
of 4 only on the K, G and F ones. **On a six-page line only the key word has
orange letters**, the same ones Echo's bubble shows (`tintKey`, through
`Sona.soundMark`): those lines used to colour every letter equal to the
sound's first letter, which on 21 of the 78 words put the orange on the wrong
letters ("[s]heep", "[c]hi[c]k", "ba[t]h", "ca[k]e", a plain "cow") beside a
bubble marking the right ones. `readtest` holds the lit word and the bubble to
the same letters in every book. **Rachel's review is still owed**: the
twelve-page words, Echo's lines and what counts as a try are listed in that
PR's body, and these 78 words, the two named ones and the line's colouring in
this one's.

**The app's look is the crafted world** (Codex, 28 Sep 2026: Travis's five
concept boards, in `design/crafted-world/references/`). Painted scenes and game
objects live in `public/assets/crafted/`, each surface's styles in
`public/crafted-*.css`, and `design/crafted-world/README.md` is the handoff.
Real controls and game objects stay HTML and canvas; a picture is never the
interface. New art in this style comes from an image model (Travis generates
it in ChatGPT); the twelve-page books are still the simpler drawings.

**A book page fills the screen, and the child says one word to turn it** (the
family's redesign brief, 28 Sep 2026). The picture fills the screen and the
page's words sit on a cream card over its bottom; the shelf shows each fuller
book's drawn cover. Pictures pick their fit once loaded: portrait art (taller
than 1.2x its width, the designer's coming 1024x1536 pages) covers the screen;
today's wide SVGs are shown whole at full width, their own top and bottom rows
stretched to the edges. `#bkStage .bkart.scene img` stays the only picture
`<img>`. On a short phone the picture makes room for Echo's question
(`roomForAsk`): it slides up under the top bar first, then shrinks only by
what is still missing; its box must never animate, because sona.css makes
transitions near-instant under Reduce Motion and a box mid-transition reports
where it WAS (that once collapsed the picture to nothing).
Every book has `keys`, one word per page (Travis, 1 Oct 2026: "we want to
make that something that is happening on every book"). A twelve-page book's
are the brief's list, and readtest holds each to that book's rule: the sound
starts the word, before a vowel. A six-page book's keep the same rule but for
two words listed by name (see "The six-page books are painted"). After Echo
reads a page the key word glows, Echo asks "Can you say... <word>." and the teal mic listens:
- **The check is Say & Play's**, copied into `public/saycheck.js`
  (`window.SayCheck`) because `sayplaytest` pins `sayplay.js`'s source as it
  stands. `tests/booktest.mjs` fails if a timing, the loudness bar or the
  sound-type test drifts between them: change one, change both.
- **Heard means "a voice of the right kind"**, never "the word was right" (the
  phone can't tell words on the web), so Echo says "I heard you!", never
  "correct". Then a small celebration, and the page turns itself.
- **Silence never turns the page and is never a try.** A quiet window closes
  the mic and waits for a tap on it; the tap only listens again. A try is a
  loud sound of the wrong kind for the book; after 3, Echo says a kind line and
  the page turns. A grown-up's small Skip turns it any time.
- **A book word is play, not practice.** No logAttempt, bumpReps, coins or
  stickers, and no `sona.*` practice key changes. Whether it should count is
  Rachel's call.
- **The phone is asked for the mic only from the grown-up's "Yes, use the
  mic" tap inside the book.** "Not now", or a refused or missing mic, means
  the book reads with Next for the rest of that visit; never a dead end.
- **No word moment for a child younger than `Sona.soundNorm(book.sound)`**
  (setup stores the top of the age band: 2-4 is 4, 5-6 is 6, 7+ is 8).
- **Every way off the moment closes the mic first**, and nothing plays while
  it is on, while it is being asked for, or within 200 ms of its close,
  including the book's own reading voice. Stopping speech ends the line in
  flight at once, so a page turned mid-load never holds the next page's mic.

**Say & Play** (Travis, 26 Sep 2026: "10 more games for ages 3-4 and 10
more games for ages 5-8 ... incorporating practice into it"): twenty games
where every word the child says moves the game one step, five words for 3-4
(Simple play) and eight for 5-8 (Arcade). One engine, `public/sayplay.js`;
each `arcade-<key>.html` is written by `node tools/gameart/build.mjs` from
`tools/gameart/little.mjs` and `big.mjs` (edit there and rebuild:
`sayplaytest` and `arttooltest` fail if a page drifts). The builder overwrites
only pages that carry its marker (`MARK` in `tools/gameart/page.mjs`); if any
target page lacks it, it writes nothing, so a key that collides with Hoops or
an older hand-written arcade page can't overwrite it. The start card's button
is a teal pill, "Let's play" beside the play triangle (the triangle stays for
a three-year-old who can't read). `node tools/gameart/cards.mjs` draws their
Home cards, except the hand-drawn ones listed in `PLAYED` in
`tools/gameart/games.mjs`; if a new card picture (say `balloon.webp`) lands for
a game it still draws, it refuses and writes nothing until that game is added
to `PLAYED`. Only a voice moves a game: no tap stands in for
talking, and the mic button only listens again (in a play game like Hoops
a finger plays the move, but only a move a word has earned). The mic keeps every quiet
rule the other games keep. A spoken move is play, never practice data (no
pass rate, no clinician sees it), but each heard word is one rep on the
week's count (Travis, 29 Sep 2026; see "The week's reps"). They open straight
from Home and never join the daily adventure.

**All twenty were parked as Coming soon** (Travis, 26 Sep 2026: "these games
are not good. they are essentially all the exact same but with a different
look ... if its basketball, we want them shooting a hoop", then "put the 20
games as coming soon. so show them but greyed out. except for old ones like
fruit slice and piano tiles that actually work. leave those"). The child only
talked and watched; nothing let them *play*. Each comes back **one at a
time**, rebuilt as a real game — what the child sees, what their finger does
and what saying the word does, agreed with Travis in plain words first, then
played by him on his phone — by taking `comingSoon` off its own line in
`GAME_ACTS`. Hoops, Soccer Goal and Dino Dig are back; seventeen are still
parked, and with Peekaboo that is the eighteen in the queue below. Home lists
playable games before parked ones. `sayplaytest`
still plays the engine, on a copy of `sona.js` with the parking lifted, and
checks every parked page sends a typed address home before any mic or sound.

**Two Fridays for the unfinished games** (Travis, 30 Sep 2026: "games that
aren't finished ... label them ... coming October 8th or whatever"; then 1 Oct
2026: "everything that is currently in queue to just say for next Friday ...
split them and have like seven or eight for next Friday and then seven or
eight for the following Friday"). Every parked game carries `comingOn`, one
of exactly two days, nine games each: **9 Oct** for Peekaboo, Balloon Party,
Race Car, Puppy Bath, Rocket Blast, Treasure Map, Build a Snowman, Space Trip
and Grow a Flower; **16 Oct** for Robot Builder, Choo-Choo Train, Pizza Chef,
Birthday Cake, Castle Builder, Surprise Boxes, Monster Makeover, Fish Tank
and Bedtime Stars. Bubble Pop, Soccer Goal and Dino Dig came back early, so
they are open and carry no day. Home says "Coming Oct 9" or "Coming Oct 16"
until that day on the family's calendar, then "Coming soon" again if the game
still isn't ready; each shelf's parked games sit soonest first, in catalog
order within a day. **The date is a label, never a switch:** `gameAccess`
never reads it, and only taking `comingSoon` off (after Travis has played the
rebuilt game) opens one. Keeping those dates means finishing nine games a
week; move a date by editing it. `activitytest` pins the two days, the
nine-and-nine lists, the labels and the order.

**Hoops is the first one back, rebuilt to be played** (Travis, 26 Sep 2026:
"yes build hoops", to the plan: the hoop slides slowly side to side; say the
word and get a basketball; swipe it up to shoot; a miss bounces off and you
shoot again; eight words, eight baskets). `public/hoops.js` draws the court
on a canvas and flies the ball; `public/arcade-hoops.html` is written by
hand (the generator no longer makes it), and every word turn, the mic and
its quiet rules stay `sayplay.js`'s. What it keeps:
- **The word earns the ball; the finger shoots it.** No ball before the
  word, a swipe (or a tap) with no ball does nothing, and a miss never costs
  a word: the ball comes back. The step, and the dot, count on the basket.
  This is the engine's **play game** hook (`game.play`: `init`, `onWord`,
  `pause`, `resume`, `reset`, `finale`, calling back `api.done()`), so the
  next rebuilt game can use it too.
- **Every ball ends in a basket.** A swipe toward the hoop (where the child
  sees it; the ball is sent where it will be) with about the right strength
  goes in. After one miss the hoop slows and the window widens; after two it
  stops, glows, and an arrow points the way; from the third, any swipe up
  goes in. The hoop is still for the first two baskets and holds still while
  a word is said and while a basket is cheered.
- **Its sounds go through the engine** (`game.sounds`: swish, whoosh, clank,
  bounce, made on the phone), so each waits for a closed mic like a chime.
- **Nothing is practice data**, as in every Say & Play game.
Its Home card, `public/assets/games/hoops.webp`, is a frame of the court
itself; its `PLAYED` entry in `tools/gameart/games.mjs` makes
`tools/gameart/cards.mjs` point `sp-hoops` at it and never draw a card over it.

**Soccer Goal is the second one back** (Travis, 1 Oct 2026: "go finish
soccer"), on the same play-game hook: `public/soccer.js` draws a little
stadium and flies the ball; `public/arcade-soccer.html` is written by hand.
Say the word and a ball rolls to the spot; swipe up to kick it past Bo, the
bear in goal, who slides along the goal line. Where the swipe points is where
the ball goes. What it keeps, as Hoops does:
- **The word earns the ball; the finger kicks it.** No ball before the word,
  a tap is not a kick, and a save or a wide kick never costs a word: the ball
  rolls back. The step counts on the goal.
- **Every ball ends in a goal.** Bo stands to one side for the first two
  balls (straight up scores), then slides from post to post. A kick just
  past a post is pulled in. After one miss he slows and reaches less, and the
  pull reaches further; after two he dozes off by one post, the open side glows and an arrow points
  to it; from the third, any swipe up goes in while he dives the wrong way.
  A really hard flick can go over the bar; a soft one still rolls in.
- **Its sounds** (kick, net, save, bounce, whoosh, roll) go through the
  engine, and **nothing is practice data**.
Home's wide card is the painted one (`public/assets/crafted/home-soccer.webp`,
from main's covers, 1 Oct 2026), and the website tile is cut from it; the
sticker is still a frame of the pitch (`public/assets/games/soccer.webp`,
through `PLAYED`), and painted art drops in at that name. Bo's own picture drops in by setting
`KEEPER_PIC` in `soccer.js`. On Home the eight big-kid games fill four even rows of two, so
neither Flappy Glide nor Hoops is full-width any more. `sayplaytest` plays a
whole game.

**Dino Dig is the third one back** (Travis, 1 Oct 2026: "go to the next game"),
on the same hook: `public/dino.js` draws a cliff with a dinosaur skeleton's
outline and a sand pit below it; `public/arcade-dino.html` is written by hand.
Say the word and a brush comes out; rub the sand in the pit with a finger to
uncover the bone; once most of it shows it pops out and flies onto the
skeleton. Eight words, eight bones, then the dinosaur's body fills in and it
roars. What it keeps:
- **The word earns the brush; the finger digs.** Rubbing before the word moves
  no sand, a tap alone digs up nothing, and the step counts when the bone lands.
- **Every bone comes out.** The brush is wide; after about four seconds the
  bone's spot glows, and after about eight, rubbing anywhere in the pit wears
  the sand over the bone away. It never digs by itself: the help needs a
  rubbing finger.
- **Its sounds** (brush, pop, whoosh, clack, roar) go through the engine, and
  **nothing is practice data**.
Home's wide card is the painted one (`public/assets/crafted/home-dino.webp`,
from main's covers), and the website tile is cut from it; the sticker is still
a frame of the woken dinosaur (`public/assets/games/dino.webp`), replaced by
painted art at that name. `sayplaytest` plays a whole dig.

**Fruit Slice is a round now** (Travis, 27 Sep 2026, yes to: "three waves of
fruit, then one giant watermelon to finish. It always ends in a win. Missing is
OK... The talking moves to between waves"). The six first games are being made
solid one at a time, and this is the first:
- **A wave ends** when its fruit are sliced (6, 8, then 10; a golden fruit
  counts three) or after 45 seconds of play, whatever the count.
- **A missed fruit just falls.** Nothing stops and nothing is lost; after two
  misses in a row the fruit come one at a time, bigger and slower.
- **The say-it card shows only between waves** ("Say “rrrr” for wave 2!"),
  never after a miss. Its listening and quiet rules are the ones every arcade
  card shares (`micquietgamestest`); `crash()` is kept as the card's old name
  because those suites open it through it.
- **The fruit are thrown from the stand** at the bottom of the screen. The first
  five are the five the "Say it 5 times" page filled, in its order, and on that
  page each heard try now drops its fruit onto the counter.
- **Wave 3 ends in a giant watermelon:** five swipes across it and it bursts, so
  every round ends on a win.
`tests/slicetest.mjs` plays a whole round.

**Block Stacker is the same round, as a tower** (27 Sep 2026): it stands on the
five blocks the "Say it 5 times" page built; three floors of 5, 6 and 7 go on
top, with the say-it card between floors ("Say “rrrr” for floor 2!"). A missed
block tumbles off and a fresh one slides in, slower (and after two misses the
landing zone widens); a close drop snaps into place; no block is ever narrower
than 60% of the first (the old tower cut kids down to a sliver, and the card
handed the sliver back); a golden block makes the tower full width again. A
rocket on the top ends it: any tap launches it, and it goes by itself after a
few seconds. `tests/stacktest.mjs` plays a whole round.

**Piano Tiles is the same round, as songs** (27 Sep 2026): Twinkle Twinkle,
Mary Had a Little Lamb and Row, Row, Row Your Boat, each tile one note of the
tune in a lane by pitch, so tapping the tiles plays the song; the say-it card
between songs; then Ode to Joy as a grand finale whose tiles all wait on the
keys, so it ends in a win. A tile that slips by fades and the song plays on
(after two in a row the next tiles slow and wait); the first three tiles wait
on the keys until tapped; and a tile takes the song's fall time on every
screen (it was 2.2 s on a small iPhone and 0.5 s on a big iPad). One tap, one
note: `micquietgamestest` pins it: sound on plays at the one normal level, muted is silent.
**The notes are the music, and in the iPhone app they are media** (Travis, 1
Oct 2026: "there's no music with the tiles game. We want it to like play
little songs while you're playing"). Each tile was a thin beep through Web
Audio, which an iPhone's ring/silent switch silences and which a page that has
had the mic open plays as a quiet phone call, so on the phone the songs were
not there. Each note is now a piano note built on the phone (0.55 s, so the
mic's quiet window still holds), and the app plays it as a media element, one
kept per key, with the level in the samples (`MEDIA_PEAK`: an iPhone gives a
media element no volume). A refused element falls back to Web Audio, never to
silence. A browser keeps Web Audio at the level it had, so iPhone Safari with
the ringer off is still silent. The loudness in the app was set without a
phone to listen on: it is that one number.
`tests/tilestest.mjs` plays a whole round.

**Every sound is Rachel's own voice** (Travis, 1 Oct 2026, of the L on Fruit
Slice's practice page: "it said the weirdest sound. But it didn't say the
actual one ... we need to either insert her voice right there or re-record";
R went first that morning, "use number 4"). The one-take sound that plays in
the letter's place ("…and make your [lll] sound, five times."), on every
say-it card and in every sound power (`/coach/say-echo/<S>-sound.wav`) is cut
by `tools/soundclips.mjs` from her July recordings in `/coach/say/`: her short
demo of the sound where it is clean, else the same sound inside her whole July
line ("… — p! p! p!"), whose room noise is 20–30 dB lower. They used to be her
takes re-voiced into Echo's voice, and the voice changer bent the very cue a
child copies: her L became an "ee", her R moved toward W (the "wabbit" error),
her N and Z took a vowel's shape and Z lost its hiss; v4 Turbo's F (used for
the voiceless sounds) came out voiced. All 19 now come from her, R still the
take Travis picked, levelled to Echo's words to the ear. `storytest` holds
every take to her recordings and checks each still sounds like its sound:
voiced sounds voiced, hisses hissing, the L not an "ee". A new take is a new
window in the tool's `TAKES`, read off a spectrogram; which take is the model
is Rachel's call. Piano Tiles plays the same one take (it played the
three-take re-voiced demo). Her whole lines stay re-voiced: practice plays
one only when the voice service is down.

**Piano slow keys** (Travis, 28 Sep 2026: “inside the game ... they say the sound to slow down the keys”). The child taps Echo on the piano board. The current song holds while Echo speaks a short instruction and plays the existing recorded sound. A voiced, family-checked attempt earns eight active gameplay seconds at 55% speed, including the arrival of new tiles. Native Apple recognition, when available, uses the existing isolation verdict to reject a clear unrelated word; unknown keeps the existing sound-shape fallback. Tapping, silence, cancellation and timeout earn nothing. Both microphone owners must close before music or navigation resumes. The between-song prompts remain. These in-game attempts are play, not SLP practice data. `tests/tilesspeechtest.mjs` checks the mechanic and interruption cleanup.

**Sound-powered help across live games** (28 Sep 2026): Fruit Slice slows fruit motion and spawning, Block Stacker slows the moving block, Sound Sprint slows its course and progress, and Flappy Glide slows hedges and their arrival while preserving balloon control. Each uses `arcade-speech-help.js`/`.css`: tap Echo, hear the existing target recording, then a qualifying attempt earns eight active seconds at 55% speed. The scene holds during speech. Between-round prompts remain. Permission/native cleanup completes before resuming audio or navigating. No gameplay attempts enter practice records. Hoops already requires a word to earn each shot. `arcadespeechhelptest` drives the four new helpers. Books and parked games are outside this change.

**Feed Echo needs the word** (Travis, 1 Oct 2026: "all that it does is ask you to click. we need to get the kid to have to say it!"). "Let's play" starts the round (so the first ask is heard on an iPhone), and a grown-up says yes to the mic first, the Say & Play way; "Not now" goes home, because Echo needs to hear the word to eat. Each turn the pictures wait, locked, until a voice burst of the right broad sound family is heard ("Echo heard you!", never "correct"); then the asked picture glows and a tap feeds it. A tap before the word wobbles and says "Say it first!"; silence never unlocks anything: after 8 seconds the mic closes and a mic button waits, which says the word again and listens again. The mic now opens straight after Echo's ask: it used to wait for `navigator.permissions` to say "granted", which the iPhone app's web view does not reliably say, so on the phone it never listened. Still play, never practice data: one rep per heard word. `feedtest` and `micquietgamestest` play it.

**Super Slice: Fruit Slice's sound power** (Travis, 29 Sep 2026: "give them an
option to say the sound to slow the game down ... they go into some frenzy
mode or easy mode or beast mode when they say their target sounds ... one at
a time", then "1 time to get it slow mode is fine ... or just to say it and
hold"). Fruit Slice's help became a mode a child wants to earn, and the other
games copy it one at a time:
- **Tap Echo and say the sound once**, quick or held. The board holds and
  dims (the mic may only open while nothing plays). The first turn Echo says
  "Super Slice! Say" and then plays one take of Rachel's recorded sound
  (`{SND}-sound.wav`, as the say-it card does); later turns play only the
  sound. A heard try shows "Got it!" and ends the turn after the 550 ms
  Apple's recognizer gets. Silence, "Keep playing" and (on the iPhone) a
  clearly different word earn nothing. **"wow" for "rrrr" does not count**
  (Travis, 29 Sep 2026: "no wow should not count"): `hearVerdict` keeps
  failing it.
- **Ten seconds of Super Slice:** the fruit slow to 55%, the stand throws
  five at once (one golden), every toss after is two or three (it outranks
  the two-miss help), the swipe becomes a wide rainbow blade (it slices 34 px
  past a fruit's edge, not 16), and the screen edge glows gold. Time left
  when a wave ends waits through the break and carries into the next wave
  (the burst alone can finish wave 1); the giant watermelon ends it.
- **Every earned turn is a rep** on the week's count (see "The week's reps");
  still never practice data. The round still ends on the giant watermelon
  whether or not a child ever says a word. The retired names (STAR MODE,
  FRUIT FRENZY, SLOW-MO…) stay banned. `tests/superslicetest.mjs` plays it;
  Block Stacker, Sound Sprint and Flappy Glide keep the eight-second slow
  help (now with the same one-take sound) until each gets its own mode.

**The week's reps** (Travis, 28-29 Sep 2026). Home's top corner shows this
week's reps, the parent corner and Progress say the same number, and
Settings shows them week by week. One count, `Sona.repWeeks`/`weekReps`:
the practice page's voiced tries (`outcomes().days[].tries`, only days since
tries were counted, 22 Sep 2026) **plus every sound a game asked for and
heard** (`Sona.gameRep`, Travis: "yeah count as reps"): the say-it card
between rounds, Echo's sound powers, a Hoops or Soccer word, Feed Echo's heard word.
Game reps live in their own per-child ledger (`sona.gamereps.v1`) and never
enter `outcomes()`, so no pass rate, clinician's note, shared progress or
coin sees them: the hard rule "voice boosts never logged as SLP data" holds.
Only a voiced try that passed the game's own check counts, once per ask;
silence never does. **Progress keeps practice apart:** its "tries" and
everything it hands a clinician (the summary, the card, "Free-play games are
not included") are the practice page's alone (`weekReps(offset, sound,
true)`), with a "Plus N said out loud in games" line so the week still adds
up to Home's number. `tests/repweektest.mjs` pins it.


**Sound Sprint is the same round, as a race** (27 Sep 2026): the park, the
beach and the forest, a checkpoint between each with the say-it card ("Say
“rrrr” to run to the beach!"), and a finish line that always ends the race in
a win. A rock is a tumble (a second off the road, ten metres back), never the
card; after two tumbles in a stretch the rocks thin out and the road slows.
The child taps the lane they want or swipes (a tap used to count only as the
left or right half of the screen). A golden coin is a coin magnet. The top
bar shows coins and the stretch; the end card counts metres (it said
"treats"). `tests/runtest.mjs` runs a whole race.

**Flappy Glide is the same round, as a flight** (27 Sep 2026): three legs of
6, 7 and 8 gaps, a rest on a cloud between each with the say-it card ("Say
“rrrr” to fly on!"), and a fireworks landing that always ends the flight in a
win. The review found it the hardest of the six (a steady tap every
half-second, hedges nearly back to back), so the balloon floats and sinks
slowly (a tap about every second holds it level), the gaps are wider and
further apart, and a hedge is a soft bounce back into the gap, never the card;
after two bumps in a leg the gaps open wider and the hedges slow. Stars in the
gaps can be caught. **Hold-to-rise**, the review's other idea, changes the
control, so it waits for Travis. `tests/glidetest.mjs` flies a whole flight.

Peekaboo stays visible only as a disabled "Coming …" card, with no New
shelf promotion and no direct-link, paid or earned bypass; its engine
remains in the repo. **Bubble Pop is back** (Travis, 30 Sep 2026), free, the
second game for ages 3-4 beside Feed Echo: the same engine
(`simple-play.js`), a full-width Home card like Feed Echo's
(`crafted-home.css`), no release date so no New shelf, and a website tile
cut from that painted card (`/assets/site/games/bubbles.webp`). The adventure
(`story.html`) and chapter readers are still parked: their engines and tests
stay, but no public menu opens them, and the bookshelf hides its adventure tile.
The existing practice, honest-rep, rotation and earned arcade-turn rules
still apply after a child chooses an available game.

## The look: the family's redesign brief (28 Sep 2026)
The family sent a brief for a designer (ChatGPT) to redraw the whole app as
"a crafted little world" of soft clay toys. **The new art has not arrived.**
Build behaviour and layout so each picture drops in later; never invent art
to stand in for it. What was buildable was built on 28 Sep:
- **Teal, cream and orange.** Main buttons and the mic are teal; second
  choices are cream pills; no bright green button anywhere (the family named
  the green GO). The tokens live once, in `public/action.css`; `sona.css`,
  `sayplay.css` and `simple-play.css` `@import` it first, and the books,
  chapter/story pages, Feed Echo, Hoops and the Say & Play pages link it. The
  crafted pages (the five round games and the practice page `charge.html`)
  take their colours from `public/crafted-*.css` instead (see "The app's look
  is the crafted world"); where a crafted sheet repaints one of our rules, the
  crafted one wins, and our rule must add nothing that shows through (a teal
  text-shadow under the crafted cream "Share this week" button once did). Never paste the hex values into a page: a page that loses
  the tokens shows white text on nothing, and the values will change when the
  designer's STYLE.md arrives. `tests/loadtest.mjs` section 5 accepts either
  teal and bans, over both, Duolingo green and orange on a kid button or mic,
  pressed or not. It judges teal by hue and cream as a light warm colour, so a
  new value from the designer needs no test edit; for a crafted page it asks
  the browser what a child sees, at rest and pressed.
- **Orange means only the practice sound's letters** (the r in "rabbit").
  Show a practice word through `Sona.soundMark(text, sound, pos)`: escaped
  HTML with the letters that make the sound in `<b class="snd">`. When it
  can't prove which letters make the sound it colours the whole word, because
  a cue on the wrong letter is worse than none; a doubled letter is one sound.
  Which letters count is Rachel's call. `tests/soundmarktest.mjs` runs every
  bank word; `SOUNDMARK_TABLE=<file>` writes her review table.
- **The practice page is the crafted one** (`crafted-games.css` /
  `crafted-practice.css`). The target in Echo's bubble (`#bTarget`) marks only
  the practice sound's letters through `Sona.soundMark`, in the crafted
  practice orange, the rest of the word in the bubble's ink; a bare sound like
  "rrrr" is orange whole, and in a sentence only the practice word is marked.
  `paintCard()` stays self-contained (`voicetest3` runs its source), and the
  mic stays a status (`role=img` DIV).
- **The five round games wear the crafted cards.** The say-it card keeps the
  round's own title ("Say “rrrr” for wave 2!"); only its quoted sound's
  letters are orange (`Sona.soundMark`). A miss never opens it
  (`micquietgamestest`). The end card's count names real things, never the
  score: Fruit Slice counts fruit sliced (`FRUITN`, the giant is one fruit) and
  Piano Tiles notes played (`NOTESN`), because a golden fruit or tile scores 3
  and the giant's cuts score 5; neither shows a "Best" beside it, because the
  best is a score. Block Stacker counts blocks and Sound Sprint metres.
- **Say & Play and Feed Echo** show the word with only the sound's letters
  orange (`Sona.soundMark`) beside the crafted picture. Feed's ask keeps ONE
  `<b>`, the word itself, with the letters in a `<span class="snd">` inside it,
  because `craftedarttest` reads the asked word by `#bMain b`.

- **Echo's clay poses** (Travis's ChatGPT art, 29 Sep 2026; originals in
  `design/crafted-world/echo-2026-09-29/`). Six 512px transparent WebPs in
  `public/assets/crafted/`, one per thing Echo is doing: `echo-welcome`
  (resting, headers, brand marks), `echo-talk` (he is speaking: reading a
  page, modelling the word, an instruction), `echo-wave` (asking the child to
  have a go: "Can you say…?"), `echo-listen` (the mic is open), `echo-think`
  ("Almost!", a gentle try-again, can't hear you, paused) and `echo-cheer` (a
  heard word, a page turned, every end card). A page that swaps poses keeps
  its preloads in a variable (an unheld `new Image()` is thrown away and the
  swap loads late) and falls back to `echo-welcome.webp` on error. The old
  flat `/coach/echo/*.svg` remain only on parked or clinician pages.

## Talking to Sona: messages, never calls
**No call requests** (Travis, 30 Sep 2026: "I don't want request to call to be
an option. Rachel doesn't want to talk to people on the phone"). "Talk to us"
(`talk.html`, the grown-ups' tab) and "Talk to Rachel" (the clinician
dashboard) take written feedback only: no call tab, no "I'd love to talk"
link, no time or time zone asked. Both routes (`/api/family/feedback`,
`/api/slp/feedback`) refuse `kind: "call"` in words ("We don't take call
requests. Send us a message, and we'll reply by email.") and keep nothing, so
a page left open from before can't book one either. Old call requests still
show on `/leads.html`. A limited "ask Rachel" chat (WhatsApp, or messages in
the app) is a later idea, not built; it is Rachel's to shape.

## Hard rules
- Merges to main/prod only on Travis's explicit go ("merge").
- **No audio ever leaves the device.** There is no cloud scorer: every verdict
  is decided on the phone from the spectral shape of what was said. One clip a
  day may be kept in local IndexedDB so a parent can listen back — it is never
  uploaded. The consent copy says exactly this, and it is true because there is
  no mechanism to break it, not because a checkbox is off. `mictest` pins the
  mechanism's absence: no route but the two founder clip tools (`isolate`,
  `voice-change`, behind `FOUNDER_KEY`) accepts a file, and no family page
  posts to one. `/api/stt` was deleted on 25 Sep 2026 for exactly this.
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
- **Apple's listening check: in the ballpark, never "taco"** (Travis, 28 Sep
  2026: "I just don't want kids saying taco and getting a correct score. We
  want them to be in the ballpark"). In the iPhone app the practice page asks
  Apple's on-device recognizer what was said (SonaSpeech, never Apple's
  servers) and `hearVerdict` in sona.js decides. Pass: the word or a close
  try (each sound's typical errors, `HEAR_SUBS`: "wabbit", "wed", "cah"; or a
  letter or two off with the sound intact: "rainy", "parrot" for carrot), and
  nothing else. A different word does not count, even one starting with the
  sound (Travis: "ideally the exact / close word"; not "run" for rain). On a
  bare-sound round only a short sound or mostly the sound itself counts
  ("Er", "Rrrr"), never a word that merely has it. Fail: clear words that
  are none of those ("taco", "poop", "fridge", "Here is a taco", "sock" for
  rock). Unknown, handed to the sound-shape check: nothing clear (filler like
  "uh", or only the sentence's own words). A grown-up's "say rabbit" and a sentence's other
  words ("Here is a") are set aside first. The plugin was written in August
  but never reached the app until `scripts/install-ios-speech.py`; the website
  cannot use it and still judges by sound shape. The arcade slowdown turns
  now use it when available; older checkpoint and Feed/Hoops checks remain
  sound-shape based. Which errors count as close (`HEAR_SUBS`) is Rachel's call;
  `heartest` pins the rules.
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

- **A double tap never zooms the app** (Travis, 30 Sep 2026: "i double tapped
  the screen and it zoomed in"). Two locks, because an iPhone has two browsers:
  every kid page's viewport meta carries `maximum-scale=1, user-scalable=no`
  (the iOS app's web view obeys it), and since Safari ignores that, sona.js puts
  `*{touch-action:manipulation}` first in <head> on every page that loads it,
  except the clinician dashboard. Settings, Progress, Subscribe, Premium and
  Talk to us keep pinch zoom for parents. A page's own `touch-action:none`
  (Hoops' court, Fruit Slice's board) still wins. `tests/zoomtest.mjs` pins it;
  a new grown-up page that should keep pinch zoom goes in its `GROWNUP` list.
- **Grown-ups goes straight to Settings** (Travis, 30 Sep 2026: "when they
  click parents and put in code i want it to go straight to settings"). Home's
  Grown-ups button opens the grown-up check, then Settings, whose tab bar is
  Progress · Settings · Talk to us. The old three-door pop-up is gone; its plan
  and trial lines now live in Settings > Account.

- **Settings is short** (Travis, 30 Sep 2026).
  - Reps in one line: "A rep is one time <name> says their sound or word out
    loud, in practice or in a game. Silence never counts." (`repweektest`.)
  - No volume slider: the phone's side buttons set the level ("why can't we
    just use our phones to adjust volume on the side of our iphone?").
    `getProfile()` plays any saved level above zero at the one normal level,
    0.8; a volume of 0 stays muted, and only then Settings shows "Sound is off
    in Sona." with "Turn sound on". Never bring back a level control: a saved
    level nobody can change is how families got stuck at 30% once.
  - No parent code: the grown-ups check is always four number words (it stays:
    the paywall is on, and Apple wants a check before a buy screen).
  - Focus-sound buttons show a grey "by ~Ny" and nothing else. Nothing in the
    code gates a sound by age, despite "Developmental order is real" below;
    building a real gate is Rachel's call.
  - Backup & restore sits behind a closed "Moving to a new phone?" link at the
    foot of Settings (`#moveBox`, same ids inside). It is still the only way
    practice, and a clinician's link, reaches a new phone or the iPhone app.
- **Practice syllables never spell "gay" or "poo"** (Travis, 30 Sep 2026):
  `syllables()` in `gamecontent.js` swaps them for "guy" and "pie". `soundmap`
  checks a NEVER_SAY list; add to it, never drop a syllable.
- **The word position drives the practice page** (Travis, 30 Sep 2026): the
  word step, the sentence step and the step-down read `Sona.practicePos()`
  (homework position first, then the family's setting); a position with no
  words for that sound falls back to start-of-word words. The games keep
  start-of-word words until Rachel says otherwise (`progtest`, `hwtest`).
  **A family can pick only the start of a word for now** (Travis, 1 Oct 2026:
  "have the options listed but to not let them select other positioning
  because it's not built yet ... make it clear that it's just the initial
  position"). Settings and the pilot page list all six positions; the ones not
  in `FAMILY_POSITIONS` (sona.js, today just `"i"`) are greyed out and say
  "coming soon", with one line under the list saying so. A position a family
  saved before reads as the start of a word. A speech therapist's homework
  still names its own position. Add an id to that list to open one
  (`kidtest`).
- **Child slots are never reused, and a removed child takes their saved tries**
  (`addKid` high-water mark, `removeKid` deletes that slot's clips; a page that
  leaves right after either waits on `Sona.clipsSettled()`).

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
- **In the iPhone app, Echo's voice plays as media, never Web Audio**
  (Travis, 1 Oct 2026: "Sounds not working again on books", with the
  phone-call volume slider on screen). After a page has had the mic open, an
  iPhone plays Web Audio as a call: quiet, and the volume buttons move call
  volume. Web Audio is also silenced by the ring/silent switch. So a voice line
  goes through `Sona.mediaPCM(bytes, {volume})` when `Sona.voiceAsMedia()`
  says so (the app), and falls back to the browser voice when it reports
  "failed". The practice page, Fruit Slice, Feed Echo, the books, the Say &
  Play games and Bubble Pop all do; a new page that speaks does too. The
  browser keeps Web Audio, where a tap unlocks it. `iphonepolishtest` pins it.
  The chimes are still Web Audio; Piano Tiles' notes are not (see "The notes
  are the music").
- Comments explain *why*, especially where the obvious implementation is
  wrong. Match the surrounding density.
