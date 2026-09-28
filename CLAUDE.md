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

So: **"licensed speech-language pathologist" is TRUE** and is used across the
app — under-claiming a real credential is not a virtue. **The fellowship is no
longer named in product copy** (Travis, 23 Sep 2026: "we can take out clinical
fellow") — "licensed pediatric speech-language pathologist" and nothing after
it. She still is a Clinical Fellow: if an SLP, a district or a board asks, the
answer is yes, and no copy may imply otherwise — never "fully licensed", never
anything that suggests the fellowship is behind her.

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

## Pricing — a free version, Premium, and the cohorts no flip can take back
**Current release: the family app is free again (Travis, 24 Sep 2026, after the
Caseload Premium merge).** `FREE_MODE = true` in `public/sona.js` and
`lib/pricing.ts`. Do not make family pricing live until Travis explicitly
approves it. All six released games are available; Bubble Pop and Peekaboo
are disabled “Coming soon” cards, regardless of subscription, free mode,
trial, or earned access. The books are on (Travis, 26 Sep 2026: "yes turn
them on"): Premium content, free while the app is free.

The dormant paid rail remains tested: daily practice and the free games
(Fruit Slice and Feed Echo; Block Stacker joined Premium on 27 Sep 2026)
stay free, while `premium()` recognizes subscriptions, founders, free-era
families, founding pilots, and covered caseloads. Never a fixed count of free
games: the plan screen names them from the catalog. Clinician dashboard and
Caseload Premium work from the earlier merge stays separate and intact.

The earlier paid release shipped `_grandfatherFreeEra4()`; preserve all four
sweeps. This newly restored free window needs its own sweep in the future
build that turns pricing on, never before. `tests/freetest.mjs` checks that
both pricing switches agree. Planned prices remain on the dormant rail.

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
The switch has changed **twelve times in eight weeks** (`git log -G'const
FREE_MODE = (true|false)' -- public/sona.js`) — twice on the same day, twice on
consecutive days. Every purchase surface now branches on the switch and keeps
BOTH states: `app/families/page.tsx`, `app/terms/page.tsx`, `app/subscribe/page.tsx`,
`public/subscribe.html`, `public/trial.html`, `public/today.html`. Flipping
pricing is **one boolean in two files**. If you find yourself rewriting a price
into a page, stop — you are undoing this.

**The iOS price does not live in this repo.** `subscribe.html` overwrites the
figures with whatever RevenueCat reports from App Store Connect, so the native
card states the saving as a RATIO ("roughly half"), never as dollars. Change
ASC, not this repo. And **flipping to free here cancels no Apple or Stripe
subscription** — anyone who bought during a paid window keeps being billed
until it is stopped in those dashboards. That is an operations task.

**The ask happens after the product proves itself.** Setup goes straight into
the first game (Travis, 27 Sep 2026: "it will choose feed echo for the littles
and fruit slice for ages five and up ... when they finish the game, that is
when I want the paywall to come up"): Feed Echo for ages 3-4, Fruit Slice (its
practice page first) from 5, a clinician's own setup still ends on Home. That
first game's end card is where the offer is made, once: "Show a grown-up →"
to `/subscribe.html?first=1` while `planEligible()` says so, else the usual
end. `Sona.firstGameStart()` marks the game for this tab and
`firstGameEnd(key)` answers once; `tests/firstgametest.mjs` pins it. Never
during onboarding, which used to end at a price screen before the child had
said a word. It is an offer, not a wall, it is inert while free, and it never
fires for anyone already entitled. Declining leaves Home with every game but
the two free ones greyed out (still tappable: "ask a grown-up").

**Eligibility and impression are two functions, and merging them is the bug.**
`planEligible()` answers "should we take them to the plan screen" and changes
nothing; `planShown(surface)` is called by the paywall once it has actually
rendered, and is the only thing that spends the one-shot and logs "plan moment
shown". They were one function (`planMoment()`, now an unused shim) that
decided and consumed in the same breath — so a parent who backed out of the
grown-ups gate in between lost the only ask Sona will ever make, while the
funnel counted an impression nobody saw. `iaptest.mjs` pins both halves.

### Caseload Premium — the clinician's plan
**"Sona Premium for your caseload": $79.99 a year, bought on the web by the
clinician** (Travis, 24 Sep 2026 — this reverses "there is no payment path for
an SLP or clinic"). Stripe hosted checkout from the dashboard's Caseload
Premium page, **no trial**, renews yearly, cancel anytime in Stripe's billing
portal. Every family who joins through that clinician's link gets Premium —
whether or not they say "Yes, share progress": access and sharing are separate
promises. $79.99 ÷ 12 = $6.6658, so "**under $7 a month**", never "$6.67".
`lib/caseload.ts` holds every constant; the static landing page cannot import
it, so `shiptest` pins its copy to it.
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
- **Clinicians who signed up before this build keep "free forever".** They were
  promised "Free forever, unlimited families — for you and every kid on your
  caseload", and their caseload stays covered, free. Structural, no dates:
  every account this build creates carries `terms: "caseload-2026-09"`, and an
  account with no `terms` predates it. Never backfill that field.
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
- **Their own phone needs a work email.** The dashboard stays open to any email
  (the landing page collects every one), but the clinician's own free Premium
  link is emailed only to a work address; free-mail domains get "No work
  email? Request access", approved by hand on `/leads.html`. Approval sends
  no email, so the card says "Requested — once we approve it, this button will
  work." beside the greyed-out button. **Never "one phone":** each link works
  once, but three can be sent a day and none is retired, so the copy is
  "Premium on your own phone or tablet. Each link works once." How many
  devices a clinician may have is Travis's open call.
- **Web only.** Clinician pages never render in the iOS shell, so this plan has
  no App Store product and meets no in-app purchase rule (`NATIVE.md`). It
  does not read `FREE_MODE`, which is the FAMILY paywall switch.

### Four free eras, and the sweeps that honour them
`_grandfatherFreeEra()` through `_grandfatherFreeEra4()` run at load and are
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

Free regardless of the switch: practice and the free games (Fruit Slice and
Feed Echo), for every family; founding pilots (`ff-` codes) and founders; every device onboarded, or
that redeemed a clinician's link, before the Caseload Premium build. **Not**
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
is now reversed: the clinician door is back on the first setup screen — it is
the only entrance to `ORDER_SLP`, so removing it again makes that whole
branch dead code — `for-slps.html` is indexable and linked from the landing
footer, and `betatest` pins the door OPEN. Since 24 Sep 2026 the channel can
also pay: the dashboard and the free version stay free, and a clinician who
wants every game for their families buys Caseload Premium — one yearly price,
never per family, never to the clinician.

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
the page says so.

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

**While the app is not ready, nobody is sent to the App Store** (Travis, 25
Sep 2026: "the app launches next week"; the iOS 27 build closes on launch).
`APP_READY = false` in `lib/launch.ts` and `var APP_READY` in `parents.html`
and `for-slps.html`, pinned equal by `shiptest`. A parent or "other" is thanked
on the page ("The Sona app launches next week. We'll email you the moment
it's ready.") and emailed the same once through Resend (`/api/lead`,
`launchmail:<email>`; a reply goes to `RESEND_REPLY_TO` when it is set, and
nowhere otherwise); a speech therapist goes to their dashboard's
community (`/slp.html#community`) and their sign-in email carries the same
P.S. Not the web app: Travis chose to wait for the app. When the app is
live, set all three switches to true.

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
→ Caseload Premium (its own page, 24 Sep 2026: Today keeps exactly its four
cards, and no price ever appears there; viewing it only reads) → Settings.
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
entry there. The reader tints only the start of each book's listed `words`.
Every page is a drawn scene: Rory and the Rainbow's were drawn by hand on a
Claude Design canvas (`public/assets/books/rory-rainbow/`); the other 18 are
built from one shared cast by `node tools/bookart/build.mjs`. Edit the layouts
in `tools/bookart/`, rebuild, and commit the SVGs; the app only loads files.
**The books are on** (Travis, 26 Sep 2026: "yes turn them on"): Home's Books
card opens `library.html`. Books are Premium content (`Sona.gated("books")`),
free while the app is free; a locked family gets the grown-up message, and
`library.html` sends a typed address back to Home (`?locked=books`).

**The books open a few a week** (Travis, 27 Sep 2026: "a solid book for the
top four or five most popular letters... everything else, we can just set a
date on it... new drops every week"). R, S, L, SH and TH are open. Every
other book in `STORIES` carries `opens` (a Sunday, at most three a week) and
waits on the shelf greyed, "Coming Oct 4", until that day on the phone's own
calendar; a tap or `openBook()` does nothing before it. The six-page emoji
books come after every twelve-page one: they put the sound anywhere in a word
and are last in line to be redone. A child whose sounds have nothing open yet
sees every open book first, then their own, coming. Home's card and the
website say "new ones every week", never "a book for every sound".
`readtest` pins the dates and the shelf; `landingtest` the website's count.

**Say & Play** (Travis, 26 Sep 2026: "10 more games for ages 3-4 and 10
more games for ages 5-8 ... incorporating practice into it"): twenty games
where every word the child says moves the game one step, five words for 3-4
(Simple play) and eight for 5-8 (Arcade). One engine, `public/sayplay.js`;
each `arcade-<key>.html` is written by `node tools/gameart/build.mjs` from
`tools/gameart/little.mjs` and `big.mjs` (edit there and rebuild:
`sayplaytest` fails if a page drifts), and `node tools/gameart/cards.mjs`
draws their Home cards. Only a voice moves a game: no tap stands in for
talking, and the mic button only listens again (in a play game like Hoops
a finger plays the move, but only a move a word has earned). The mic keeps every quiet
rule the other games keep. A spoken move is play, never practice data:
whether it should count toward the day's practice is Rachel's call, and until
she makes it, it doesn't. They open straight from Home and never join the
daily adventure.

**All twenty are parked as Coming soon** (Travis, 26 Sep 2026: "these games
are not good. they are essentially all the exact same but with a different
look ... if its basketball, we want them shooting a hoop", then "put the 20
games as coming soon. so show them but greyed out. except for old ones like
fruit slice and piano tiles that actually work. leave those"). The child only
talked and watched; nothing let them *play*. Each comes back **one at a
time**, rebuilt as a real game — what the child sees, what their finger does
and what saying the word does, agreed with Travis in plain words first, then
played by him on his phone — by taking `comingSoon` off its own line in
`GAME_ACTS`. Home lists playable games before parked ones. `sayplaytest`
still plays the engine, on a copy of `sona.js` with the parking lifted, and
checks every parked page sends a typed address home before any mic or sound.

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
itself; `tools/gameart/cards.mjs` points `sp-hoops` at it.

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
note: `micquietgamestest` pins its loudness to the Sound setting.
`tests/tilestest.mjs` plays a whole round.

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

Bubble Pop and Peekaboo stay visible only as disabled “Coming soon” cards,
with no New shelf promotion and no direct-link, paid or earned bypass.
Their engines remain in the repo for future work. The adventure
(`story.html`) and chapter readers are still parked: their engines and tests
stay, but no public menu opens them, and the bookshelf hides its adventure tile.
The existing practice, honest-rep, rotation and earned arcade-turn rules
still apply after a child chooses an available game.

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
  cannot use it and still judges by sound shape, and the games do not use it
  yet. Which errors count as close (`HEAR_SUBS`) is Rachel's call;
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
