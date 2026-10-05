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
One of those places is setup (Travis, 29 Sep 2026: a Meet Rachel screen with
her photo). **Since 5 Oct 2026 (option B) she is on setup's "<Name>'s practice
is ready" screen**, in a box of her own titled "About Sona", apart from what
the parent picked: her photo and the settled line word for word, "Built with
Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical
fellowship." Her separate screen is gone. Where her credential sits beside a
list a parent picked is hers and Travis's to change. She still is a
Clinical Fellow: if an SLP, a district or a board asks, the answer is yes.

**Never "CCC", "certified", "board-certified" or "ASHA-certified".** The
landing page claimed "Licensed & board-certified (CCC-SLP)" until it was caught
— a specific, checkable false claim about a trademarked certification, on the
page that sells the app. `tests/iaptest.mjs` fails if it comes back, and if
the licence ever lapses or she moves state, that pin is where to start — and
setup's ready screen (`onboarding.html`, her line pinned word for word in
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
trial or earned access. **Since 3 Oct 2026 the free version is not every
family's:** where Sona can sell, a family set up from then on starts with the
trial (see "TRIAL FIRST" right below).

**TRIAL FIRST: THE PRICE BEFORE THE FIRST GAME, NOTHING FREE WHERE SONA CAN
SELL** (Travis, 3 Oct 2026: "lets add the paywall before they try anything in
the app. and then they unlock everything. so fruit slice and piano tiles and
feed echo and bubble pop are all part of paid or needing to start a trial";
then, with ReciMe's onboarding screenshots, "something like this. yeah home
locked", and "using chatgpt art"). One rule in `sona.js`, `freeVersion()`:
the free version (the free-tier games, `FREE_BOOKS`, and the practice that
opens them) is open only to
- **a phone that cannot buy:** an app build with no purchase plugin (the App
  Store's 1.0.4) or a browser while the website does not sell
  (`canSellHere()`). A wall nobody can pass is a broken app, not a paywall;
- **a household already set up on this build's first load:** the one-shot
  sweep `_keepFreeVersion()` stamps `sona.freever.v1` "kept" (set up: it was
  told those games were free) or "post" (not set up yet: it starts with the
  trial). It keeps the free version, never Premium; it reads no free era's
  stamp; and it is on `NO_IMPORT`, so a backup never brings it;
- **a family who joined through their speech therapist** (`slpVerified()`):
  every clinician page promises those families the free version. A pasted
  backup can carry `sona.slpok` and with it the free version (never Premium):
  accepted, since that is what those pages promise.
Premium from any source, a trial, or Sona being free open everything, as
before. These three were defaults Travis did not pick; ask him before
changing one. What follows from the rule:
- **SETUP IS OPTION B: FOUR QUESTIONS, THE PRICE, THEN THE PHONE IS HANDED
  OVER** (Travis, 4-5 Oct 2026: "number B would be good ... you can do a full
  reset i don't really care i'm not married to anything"). A parent's setup is
  hello → name and age → **"What brings you to Sona?"** → sounds →
  **"How does practice go at home now?"** → **"<Name>'s practice is ready"** →
  the price → microphone → "Hand the phone to <Name>!" → the first game. The
  old order told a parent to hand the phone over and tap "Let's play!", and
  then showed three money screens to the child holding it.
  - **The two new questions are one tap each, can be skipped, and change
    nothing a child is given** (no sounds, mode or goal). Each puts one true
    sentence about SONA on the ready screen, never one about the child. Their
    wording, the eight sentences and the ready screen are Rachel's to change.
  - **The answers stay on the phone**: a household key
    (`sona.setupasks.v1`, `Sona.setupAsks()`), not in the profile, not in a
    backup (`NO_EXPORT`), in no request, event, title or log. In a browser
    Meta's pixel reports the words on tapped buttons by itself, so the setup
    page's pixel tag carries `data-autoconfig="off"` (that page only; whether
    the landing pages should too is Travis's call). Asked once per family.
  - **The ready screen** repeats only what the parent said (name, age group
    if given, the sounds, or "Every sound, easiest first") with "Sona
    practices — it doesn't test or diagnose." Never "plan" beside Rachel's
    name, never an age norm, a result or a price. **The profile is saved when
    the parent leaves it**, before the price and before the microphone.
  - **Its Continue goes to `/subscribe.html?setup=1` when `trialFirst()` says
    so** (after asking the store once whether this Apple ID already has
    Premium, `Sona.setupWall()`, 2.5 s at most; the grown-ups check is marked
    passed), else on, in the page, to the microphone. A clinician's own setup
    still ends on Home.
  - **A purchase or a restore comes BACK to setup** for the microphone and the
    hand-off: a tab-only marker (`sona.setupafter.v1`, `Sona.setupAfter()`)
    written when setup leaves for the price. The marker picks a screen and
    grants nothing; without it (app closed on the price) the family lands on
    Home and the games ask for the microphone themselves.
    `Sona.firstGameStart()`'s mark is written by the hand-off's last tap.
  - **Nothing moves under a finger:** for about half a second after a setup
    step changes, and after the price card changes shape, taps are ignored.
- **The price is ONE screen** (the two ReciMe-style screens before it are
  gone): a two-row timeline, **Today** ("Everything opens. Nothing to pay
  today.") and **the billing day** (the store's price starts "unless you
  cancel at least 24 hours before", Apple's own measure), one button, and
  "Not now" in plain sight. See "THE IPHONE SELLS ONE PLAN" for where every
  word comes from. **No reminder is promised:** Sona sends none, so the words
  email, remind and notify may not appear on the price screen
  (`pricescreentest`, `setupbuytest`). A real reminder (Resend, fed by
  RevenueCat) is a later change that adds a third row for a family it is
  truly armed for, and is Travis's to approve: it changes what the privacy
  page says. "Paywall viewed" and the one-shot (`planShown`) count only once
  a priced card is on screen.
- **"Not now" goes to Home with everything locked:** every game and book is
  "Premium" and the Books card says "Premium"; no microphone ask and no
  hand-off. Settings then says "Plan: none yet", never "free version".
- **A tap on a grey game or book opens the price at once** (Travis, 4 Oct
  2026: "I want it to open automatically if they click on a game that is
  grayed out"): no "Ask a grown-up" note, no grown-ups check, straight to the
  plan screen as the offer on that game (`?from=<game>`, a book `?from=library`),
  for any family Sona can sell to (`offerOnLock()`), free version or not. The
  plan screen asks no check for a `?from=` visit that shows the offer: Apple
  wants a parental gate before a buy screen only in its Kids category, which
  Sona is not in, and Apple's own sheet asks for Face ID or the password
  before anything is bought. A `?from=` visit that shows no offer (Premium
  already, a phone that cannot buy, an unknown game) is Settings › Your plan
  and goes through the check. On a phone that cannot buy, the note stays:
  there is nothing to open. A typed address to a grey game (`?locked=` from a
  bounce) still shows the note: it is not a tap.
- **No surface tells such a family something stays free.** Home's "Free"
  label and "1 free book", the plan screen's third check, its card lines, its
  header line, "What stays free", the decline ("Not now", never "keep the free
  version"), the Premium page's notes: each asks the rule. The website's cost
  answer (`parents.html`) no longer promises free games ("Sona is free to
  download …"), and the Terms say who keeps the free version. The old
  `/families` page, the Next `/subscribe` page and `trial.html` still describe
  the free version: true in a browser (which cannot sell), and nothing in the
  app links to them.
- **Known and left for Travis:** a family sent by a speech therapist who
  opens the iPhone app (not the website) meets the trial too, unless they
  bring their link across (Settings › Moving to a new phone?), though the
  clinician pages promise them the free version. (The Apple card's "3 days
  free" tag and button were typed until 5 Oct 2026; since then every line on
  it is painted from the monthly product's own answer.)
`tests/trialfirsttest.mjs` plays the rule on every kind of phone, setup's last
tap, both screens, "Not now", the first game after the free days start, a
store that sells no free days or never answers, and the smallest phones.

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

**Before families can buy on the iPhone** (Travis's tasks, not this repo).
On 1 Oct 2026 none of the three was true, so **only the web checkout sold**:
1. **The app build must carry the purchase plugin.** 1.0.4, the build on the
   App Store, does not (`@revenuecat/purchases-capacitor` is missing from the
   iOS project in `~/Documents/SaaS`; 1.0.3 build 6 had it). Without it the
   app has no buy button: `Sona.iapAvailable()` is false.
2. **RevenueCat:** the yearly product attached to the `full` entitlement. It
   was attached to none (only an old `lifetime` product was), so a purchase
   would have been taken by Apple and left the app locked.
3. **App Store Connect:** the yearly subscription approved at the price he
   wants. It was listed at $79.99, under a description saying $59.99.
`NATIVE.md` says how to check each. **Since 5 Oct 2026 the iPhone sells the
monthly plan alone**, with 3 free days (see "THE IPHONE SELLS ONE PLAN"
below): `com.speaksona.app.monthly` approved in App Store Connect at the
monthly price with its free introductory offer, and in RevenueCat's `full`
entitlement. All three were true that day (1.0.5 Ready for Distribution).

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
  $9.99 a month"), the billing line and "no charge today" (yearly only),
  "charged today" (monthly only), the small print and the heading. Nothing
  yearly stays on screen beside a button that charges today. The monthly box
  says **"Charged today"**, never "no free trial" (Travis, 1 Oct 2026: "dont
  say no free trial at the bottom"), and never the word "free" at all.
- **Under the button, one line: the day they are billed** (Travis, 2 Oct
  2026: "there's still too much information ... just briefly say like what
  day they'll be billed on the bottom"). Yearly: "Free until October 5, then
  $X a year." and, on Apple's card, "Renews unless canceled in Settings →
  Subscriptions." (on the web, "Cancel anytime.": a web buyer has no cancel
  button "in your account", and Stripe's page spells out the renewal). The
  date is the same +3 days the charge uses; the price is the store's string
  on Apple's card and the charter figure on the web, so the line never names
  a different number from the box above it, and it never promises a reminder
  (there is no trial mailer). It replaced a dated three-row timeline and the
  Apple card's paragraph of small print, and the web's yearly small print
  steps aside for it; monthly keeps its own line, which says how to cancel.
  What Apple requires stays: each plan's price and period, the renewal, where
  to cancel, and Restore Purchases, Terms and Privacy as links. The button is
  setup's lighter teal (`.planbuy .btn.go` in `crafted-family.css`, "for
  now": painted art for it has not arrived).
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
- **On the iPhone the store owns every figure.** Since 5 Oct 2026 the Apple
  card is not two ways to pay but one plan (see "THE IPHONE SELLS ONE PLAN"
  right below); the web card, which sells nothing while `WEB_SALES` is off,
  keeps both. No dollar saving and no ratio on the Apple card.
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

**THE IPHONE SELLS ONE PLAN: 3 DAYS FREE, THEN $9.99 A MONTH** (Travis, 5 Oct
2026: "get rid of the annual option and update the copy so that it says three
days free, then $9.99 a month", after giving `com.speaksona.app.monthly` a
free 3-day introductory offer in App Store Connect). On the Apple card of
`subscribe.html` (offer and Settings views):
- **One plan, no pick:** the tile says "3 days free, then $9.99 a month."
  (Travis's words, built from the store's answer), the button "Start 3 days
  free", and the two-row timeline above it. Charged today: "$9.99 a month,
  charged today." and "Subscribe — $9.99 a month", no timeline.
- **The store decides every word, and the page types none.**
  `Sona.storePlan()` asks for the monthly product only, through
  `iapProduct("monthly")` (which refuses any other id), and answers one of
  `free` / `paid` / `none` / `owned`; `Sona.planWords(plan)` returns every
  sentence the card may show. `subscribe.html` ships no price, no day count
  and no "free" of its own: until the store answers the button reads
  "Checking the App Store…", and with no answer in 4 seconds the card says
  "We couldn't reach the App Store." with Try again and Not now. A store with
  no monthly product, or one that answers with the yearly product, sells
  nothing in its place. A late answer repaints the card by itself.
- **The buyer's own eligibility is asked** (the plugin's
  `checkTrialOrIntroductoryPriceEligibility`; Apple gives free days once per
  subscription group). A definite "not eligible" removes the free days. When
  the phone cannot tell (the call is missing, slow or unsure) the free days
  still show, but nothing is stated as plain fact: the rows say "new
  subscribers" and a line says "Only new subscribers get 3 days free.
  Otherwise Apple charges $9.99 today. Apple shows your exact terms before
  you confirm." An Apple ID that already holds Premium is told "You already
  have Sona Premium. Welcome back!" and sold nothing.
- **Never less able to sell than before:** purchase goes through the calls
  real phones already use; every new native call is optional and may only
  ever leave the card as if it did not exist.
- **The yearly product is not removed from sale in App Store Connect:** Apple
  says that also stops renewals for anyone who bought it. It is only no
  longer offered, and `IAP_PRODUCTS.annual` stays in `sona.js` for restore.
- **Not changed:** the web card and `/api/checkout` (the website sells
  nothing while `WEB_SALES` is off; turning it on would sell the yearly plan
  and a pay-today monthly, as built on 1 Oct), the clinician plans, the
  Terms (which name no Apple price or trial length). The Premium page says
  "One plan, month by month" in the app, and names the free days only once
  the store reports them.
`planwordstest` plays the store answer and every sentence; `pricescreentest`
the card in each store state (trial, none, no monthly product, the wrong
product, not eligible, unsure, already owned, the store silent) and that it
ships no typed figure; `setupbuytest` a new family from setup through a
purchase to the first game; `iaptest` and `trialfirsttest` the rails around
it; `chartertest` that the card's price span ships empty.

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

**The ask happens after the product proves itself** (for a family who keeps
the free version; since 3 Oct 2026 a family set up where Sona can sell meets
the price at the end of setup instead: see "TRIAL FIRST"). Setup goes straight into
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
`/subscribe.html?from=<game>` or `?from=library`). Since 4 Oct 2026, wherever
Sona can sell, the tap itself opens that offer, with no note and no check in
between (see "A tap on a grey game or book opens the price at once" under
"TRIAL FIRST"); the note and `premium.html` remain for a phone that cannot buy. Never during onboarding,
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
decline, word for word, and the note under the decline steps aside (2 Oct
2026). Settings › Your plan (no flag) is the page as it was.
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
  `sona.slpticket`) **travels through backups** (Settings › Moving to a new
  phone?; setup has had no code box since 2 Oct 2026), because
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
era across `iaptest`, `progtest`, `loadtest` and `hwtest`. The trial-first
stamp works the other way round: an onboarded seed without `sona.freever.v1`
is judged "kept" and has the free version, as every suite before it assumed;
a test about trial first seeds "post".

**Tests do not pin the switch's value.** They pin that the two copies agree,
and they exercise the purchase rails through the `?paid=1` / `sona.paidui` seam
so they hold in either state. A test that must be hand-edited on a business
decision guards nothing and taxes every flip. `IS_FREE_NOW` in `iaptest.mjs`
reads the live state from source where a suite genuinely needs it.

Free regardless of the switch: practice, the free games (Fruit Slice, Piano
Tiles, Feed Echo and Bubble Pop) and the free book (Rory and the Rainbow), for every
family that keeps the free version (since 3 Oct 2026 not every family: see
"TRIAL FIRST"); founding pilots (`ff-` codes) and founders; every device onboarded, or
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
is now reversed. **Setup itself is for parents** (Travis, 5 Oct 2026: "I want
to take out the button of who's setting up Sona because it's just for the
parents"): the "Who's setting up Sona?" screen of 1 Oct is gone, and the
hello (Echo in his world, one Continue) goes straight to the child's name. A
speech therapist signs up at speaksona.com/for-slps. The clinician's own
setup (`ORDER_SLP`) is kept, and kept tested, behind its own address,
`/onboarding.html?slp=1`, which nothing in the app links to (in the iPhone
app that address sets the app up for a child in a clinician's words, with no
price, and ends on Home). `for-slps.html` is indexable and linked from the
landing footer, and `betatest` pins that setup asks no such question. Since 24 Sep 2026 the channel can
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
root is `parents.html`: the headline "Speech practice kids love." (Travis, 4
Oct 2026: "I want to make the website say speech practice kids love"; until
then it was the parent ads' "Speech practice kids ask for.", which the ads
and the app's welcome screen still say),
the new Echo and the two game screens from those ads, one email box and one
button (role `parent`, nothing else — no name, no "I'm a…"), then the App
Store (Android: the web app). **Right under the top come the sliding games
and books, then Rachel** (the same day: "I want that a lot higher up ... and
I also want Rachel's bio higher up"), then the rest in its old order. **The
email goes straight to the App Store** ("I just want it to go immediately"):
once the server says yes the Lead fires, the button reads "Opening the App
Store…" and the page leaves 150 ms later (`LEAVE_MS`, the time the pixel's
request needs to get out). No panel and no second button come first; the
"You're in" panel with "Get the app" is only what an iPhone visitor finds
when they come back from the App Store. `landingtest` plays it. No Sign in in its header; the footer sends a
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
the shelf lock under them), greyed and marked "Premium", and a tap opens the
plan screen at once where Sona can sell (4 Oct 2026, see "TRIAL FIRST"), or
elsewhere shows the grown-up message ("Ask a
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
Halloween one"). They are closed, not gone, so a child meets their own first
(Travis, the same day: "less easy to find or less in your face ... the kids
just seeing books based on their letter/s"). The top shelf is chosen as
before: the child's own sounds' books, plus the limited-time book(s)
`Sona.seasonPick` gives them (in October the Halloween book in their own
sound, or Boo the Bat when their sounds have none; see "Every book that is
made is live"), and the free book first when their own have nothing to read.
**With more than one sound, the one practice is on now leads** (main's #184,
1 Oct 2026): a child on R and S whose practice is on S today
(`Sona.rotSound()`) sees the S books first, then the R ones. Only the order
moves, inside "readable, then Premium", so without Premium the free book
still leads; a homework sound that is not one of the child's own brings no
books up. Home's What's new row
follows the same rule: books in the child's own sounds only, that sound's
first (`HOME_BOOKS` in sona.js names each book's sound; play mode and a child
with no sounds yet see them all). Under the shelf sits one cream pill, "More
books (N)", N being how many books are behind it for this child, closed on every
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
copy of the button. **And never a second More books:** two sessions each built
one on 1 Oct 2026 (this pill, and a `<details>` drop-down under the same
shelf), and with both on the page every other book was there twice. The pill
is the one that stayed; `readtest` fails if a second control comes back.
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
  stickers, and no clinical practice key changes. Each accepted key word adds
  one `gameRep` toward the daily goal, once per page. Skips, silence and the
  third-shape retry turn add none. It never means the word was pronounced right.
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
pass rate, no clinician sees it), but each saying Echo hears is one rep on the
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
Its gym wall, ball and (since 4 Oct 2026) backboard are painted
(`public/assets/crafted/game/`); the rim, net and floor stay drawn.
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
through `PLAYED`), and painted art drops in at that name. Inside the game the stadium, Bo and the ball are
painted (4 Oct 2026, `tools/art/game-sprites.json`, cut to
`public/assets/crafted/game/soccer-*.webp`); the pitch, goal and net stay
drawn, because they move and carry the perspective. On Home the eight big-kid games fill four even rows of two, so
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

**Dino Dig has four dinosaurs** (Travis, 1 Oct 2026: "i want to build different
types of dinosaurs to look for not just one"): T. rex, Triceratops,
Stegosaurus, Brontosaurus, dug in that order, a new one each finished round,
round again after the last. Each has its own skeleton outline, its own eight
bones and places in the pit, and its own body and colour when it wakes (data in
`DINOS` in `dino.js`, drawn from one small kit). Since 4 Oct 2026 the dig
site, the sand, the earth and each woken dinosaur are painted (`ART`,
`public/assets/crafted/game/dino-*.webp`); a painted dinosaur is fitted to its
skeleton's outline and its bones fade as it wakes, since a painting never
lines up bone for bone. The skeleton, its outline and the bones stay drawn.
The round is the child's (`sona.dino.v1`, one of `PER_KID`, kept by the page
through `Sona.kkey`; `dino.js` never touches storage): a brother or sister
starts at the T. rex, and one left half dug waits, from its first bone. The
start card shows the one to look for as a dashed outline ("Today: T. rex"),
the end card says "You found a T. rex!", and both show the row of four, found
ones filled in. **No count is ever shown** ("2 of 4" would read as a grade).
A collection, never practice data. `tests/dinotest.mjs` digs all four.

**The word is said two times** (Travis, 1 Oct 2026: "ask them to say it two
times. and if they say it once to have it say '1 more time'"). In the Say &
Play word games (`sayplay.js`: Hoops, Soccer Goal, Dino Dig and the parked
ones) a turn needs two sayings. It is one setting a game, `game.sayTimes`, and
two unless the game's page says otherwise. **Bubble Pop asks once**
(`sayTimes: 1` in `arcade-bubbles.html`): it is the littles' game, built on
main to be said once, and whether a three-year-old should say a word twice is
Rachel's call, so it stays at one until she says. With one there are no dots,
no "Say it 2 times" and no "1 more time!": one saying earns the bubbles, one
rep. `sayplaytest` pins which game asks how many times. With two:
- **Echo still says the word alone** ("Say... rabbit."). Hoops, Soccer Goal
  and Dino Dig first say a separate instruction: "Say each word two times
  to get a ball" (a brush in Dino Dig). It plays once per visit, before the
  first isolated word, never between the first and second saying. The start
  card and the two dots also explain it. Interrupted instructions cancel
  with the existing audio generation and replay before a resumed target.
- **Words that fit the game** are selected from existing painted bank
  entries (`GAME_WORDS`/`gameWords`), before a vowel with no blend, at turns
  1, 4 and 7 when available, without repeating a themed word. Other turns
  use the existing beginning-position pool. Named clinician homework always
  overrides themes. No new word, speech gate or practice outcome is added.
  `soundmarktest`, `soundmap`, `hwtest` and `sayplaytest` check the words,
  artwork and precedence; Rachel reviews the exact table in the PR.
- **The first saying only paints**: its dot is ticked and "1 more time!" shows
  in the same frame, with no voice and no chime, because the mic is still open.
  Only the second saying earns the move.
- **One word is one saying.** The second counts only after 200 ms under the
  loudness bar (`GAP_MS`) and never sooner than 450 ms after the first
  (`APART_MS`): "rock...et" has a hard stop in its middle.
- **A saying already heard belongs to the word**: the mic button, "Hear it" and
  a pause keep it. After one saying and 12 quiet seconds the mic closes and
  says "1 more time! Tap the mic". Silence never earns the move.
- **Each saying heard is one rep** on the week's count (two a word); still
  never practice data. Whether two is right, whether the littles should say it
  twice too (Bubble Pop asks once; the ten parked games for ages 3-4 would ask
  twice as built, so settle it before one comes back), whether Echo should
  model the word again before the second, and whether both count as reps are
  Rachel's calls.
- **The wait a child feels is before the mic can hear, not after the word**
  (Echo's word, 250 ms of quiet, the mic opening, and on a game's first word
  450 ms to measure the room). Each is a guard: do not shorten them.

**Bubble Pop is rebuilt to be played** (Travis, 1 Oct 2026: "more like the
feed echo vibe ... we want to have more bubbles to pop", then "yeah B", the
plan called "Say it, and Echo blows bubbles"). It was one bubble at a time,
five taps a round, and a child never had to say anything. Now, for ages 3-4:
Echo holds a bubble wand; say the word and Echo blows six to eight bubbles;
pop them all; the gold one has the word's picture inside and drops it into
the basket; five words fill the basket, then Echo floats up inside one giant
bubble, and popping it ends the round (about 37 pops, where there were 5).
`public/bubbles.js` draws the sky on a canvas; `public/arcade-bubbles.html` is
written by hand; the word turn, the mic and its quiet rules are `sayplay.js`'s,
on the same play-game hook as Hoops. What it keeps:
- **The word blows the bubbles; the finger pops them.** No bubble before the
  word, so a tap on the empty sky pops nothing, and the step counts only when
  every bubble is popped and the picture is in the basket. A finger dragged
  across the sky pops what it crosses.
- **Every round ends.** Bubbles bob in place and never float away; a touch
  near one counts; left alone for about eight seconds the ones left glow and
  take a wider touch; after about fifteen, a touch anywhere pops the nearest,
  and once that help is on it stays on for that word (a beat between pops, so
  one dragged finger cannot empty the sky). A bubble never pops by itself. The
  giant one is the fifth step: the end card waits for its pop, and after six
  seconds a touch anywhere pops it.
- **One picture, not three.** The plan said "three picture cards, like Feed
  Echo's choices"; the child never picks a card here, so the two extra ones
  had no job. The asked word's picture is in the word panel, inside the gold
  bubble, then in the basket.
- **It is NOT a catalog `say` game.** It stays on the little kids' shelf with
  its own Home card, and stays in their old five-round adventure
  (`charge.html?daily=1`): the page banks a finished round and sends the end
  card's button back to it, as Feed Echo does. Adding `say: true` would list
  it twice on Home and point its sticker at one that does not exist.
- **In the iPhone app the pops are media**, as Piano Tiles' notes are: each
  sound is built once on the phone and played as a media element, because a
  pop comes seconds after the mic closes, when an iPhone plays Web Audio as a
  quiet phone call (and not at all with the ringer off). A browser keeps Web
  Audio. How loud they are on a real phone is `MEDIA_PEAK` in the page: it was
  set without a phone to listen on. A muted Sona (volume 0) plays none.
- **Its sky, wand, bubble and basket are painted** (4 Oct 2026,
  `public/assets/crafted/game/bubbles-*.webp`; the basket is
  `crafted-bubbles.css`'s background); the word pictures are Feed Echo's.
- **Nothing is practice data**; each heard word is one rep on the week's
  count, a pop is nothing. **For Rachel:** the ask is the engine's "Say...
  <word>." with start-of-word words for the child's sound, and "heard" is a
  voice of the right broad kind, exactly as in Hoops.
Peekaboo still runs on `simple-play.js`, so the old engine's tests moved to
it. `bubblestest` (its own suite: the three other played games already fill
most of a suite's five minutes) plays a whole round, the smallest phone, the
app's sounds, a slow microphone and a page hidden at the wrong moment.
**That last one was an engine bug every played game had:** a page hidden in
the quarter second after a move finished came back to no next word and no way
on. `sayplay.js` now calls that moment `step`, which `resume()` reads as "the
next word".

**Arcade lives and a real ending** (Travis, 4 Oct 2026, in the 5 Oct handoff:
"They need to be able to actually die or lose in the game ... say their target
sound to get a new life ... start easier and get progressively a little trickier").
This replaces the five round games' earlier promise of an automatic win. It
changes finger play, never what passes the speech check:
- Fruit Slice, Piano Tiles, Block Stacker, Sound Sprint and Flappy Glide start
  with three hearts. A real gameplay miss costs one. No miss opens the
  between-round say-it card. At zero hearts the round ends on a kind card,
  with Play again and Back home; it does not claim the finale was completed.
  A retry goes through the existing five-tries practice page.
- One accepted sound-power turn restores one heart, up to three, as well as
  earning that game's power. Tapping Echo, silence, an unrelated word and a
  cancelled ask restore nothing and count no rep. The Apple isolation verdict
  and the existing sound-shape fallback are unchanged. A heard power is one
  game rep; a heart or gameplay miss is never speech practice data.
- No heart is lost while Echo asks or listens, while the earned power is on,
  in a finale, or on a hidden page. Nearby misses are protected from emptying
  all three hearts at once. Losing a heart brings the next ask forward by
  about 1.5 seconds of eligible play, while respecting the longer quiet
  back-off after two unanswered asks; it never opens an always-on microphone.
- Echo explains the reward before the recorded sound and Go! The ordinary
  and heart-restoring reasons are each spoken once per visit, only marked
  said after a line finishes. Both download as the page loads. A slow or
  failed voice uses the existing bounded fallback, so play never freezes.
- The pace starts at the existing easy speed and rises within a capped range;
  a miss eases it. The sound power still slows motion to 55%. Exact pacing,
  grace windows and the heart lines are play defaults for Travis to hear and
  play on his phone. Rachel should review the frequency and wording of asks,
  and the effect on children the phone hears poorly.

**The clinical success rule below still applies to speech-practice rounds:**
step the target down rather than end on failed speech. An arcade round may
end because of finger play; that is not a grade of the child's sound.

**Fruit Slice is a round now** (Travis, 27 Sep 2026, yes to: "three waves of
fruit, then one giant watermelon to finish. It always ends in a win. Missing is
OK... The talking moves to between waves"). The six first games are being made
solid one at a time, and this is the first:
- **A wave ends** when its fruit are sliced (6, 8, then 10; a golden fruit
  counts three) or after 45 seconds of play, whatever the count.
- **A missed ordinary fruit costs a heart** during active play, outside an
  ask or earned Super Slice. Misses ease the pace; Super Slice extras cost
  nothing. The board keeps moving until the last heart is gone.
- **The say-it card shows only between waves** ("Say “rrrr” for wave 2!";
  for a child on R it may ask a syllable or a short word, see "Games ask for
  more than the sound"), never after a miss. Its listening and quiet rules are the ones every arcade
  card shares (`micquietgamestest`); `crash()` is kept as the card's old name
  because those suites open it through it.
- **The fruit are thrown from the stand** at the bottom of the screen. The first
  five are the five the "Say it 5 times" page filled, in its order, and on that
  page each heard try now drops its fruit onto the counter.
- **Reaching the end of wave 3 opens the giant watermelon:** five swipes
  across it and it bursts. Its finale costs no hearts; a round that runs out
  earlier ends without claiming that win.
`tests/slicetest.mjs` plays a whole round.
The market has more open sky, with a smaller fox and Echo behind a low counter.

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
keys, so reaching it ends in a win. A tile that slips by costs a heart
outside an ask or earned slow keys; remaining tiles get a safe landing after
a miss so one fumble cannot empty the hearts. The first three tiles wait
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
The painted notes are wide, rounded tiles that fill most of each lane.

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

**Piano slow keys** (Travis, 28 Sep 2026: “inside the game ... they say the sound to slow down the keys”). Since 3 Oct 2026 Echo asks for it by himself mid-song, and the song keeps going while he asks and listens (see "Echo asks, then listens"); a tap on Echo still asks at once. Its notes are silent from his first word until the mic closes. A voiced, family-checked attempt earns eight active gameplay seconds at 55% speed, including the arrival of new tiles. Native Apple recognition, when available, uses the existing isolation verdict to reject a clear unrelated word; unknown keeps the existing sound-shape fallback. Tapping, silence and timeout earn nothing. No ask in the Ode to Joy finale. Both microphone owners must close before music or navigation resumes. The between-song prompts remain. These in-game attempts are play, not SLP practice data. It runs on the shared helper (`arcade-speech-help.js`) since that day; `tests/tilesspeechtest.mjs` checks the mechanic and interruption cleanup.

**Sound-powered help across live games** (28 Sep 2026): Fruit Slice slows fruit motion and spawning, Block Stacker slows the moving block, Sound Sprint slows its course and progress, and Flappy Glide slows hedges and their arrival while preserving balloon control. Each uses `arcade-speech-help.js`/`.css`: Echo asks (by himself since 3 Oct 2026, see "Echo asks, then listens"; a tap still asks at once), the child hears the existing target recording, then a qualifying attempt earns eight active seconds at 55% speed. The scene keeps going during speech; only its sounds hold. Between-round prompts remain. Permission/native cleanup completes before resuming audio or navigating. No gameplay attempts enter practice records. Hoops already requires a word to earn each shot. `arcadespeechhelptest` drives the four new helpers. Books and parked games are outside this change.

**Echo asks, then listens: nobody taps for a sound power** (Travis, 3 Oct
2026: "I don't want them to have to tap echo to then say the sound ... I want
them to be able to just be playing the game and at any given point say the
sound to slow the game ... have 11 Labs voice maybe say that like mid game").
All five round games (Fruit Slice, Piano Tiles, Block Stacker, Sound Sprint,
Flappy Glide), from one copy in `arcade-speech-help.js`:
- **Echo asks by himself, mid-round:** all five pages first ask after about
  six seconds of play (`SLOW_HELP.first`); the shared fallback remains ten. Later asks wait 20 seconds of eligible
  play (`SLOW_ASK`), with a heart loss bringing the next forward by 1.5
  seconds. The first ask for each distinct reason in a visit is the game's
  line ("Super Slice! Say", "To slow the keys, say", or its heart reason),
  then Rachel's one take, then "Go!"; later asks for that same reason are her
  take and "Go!". Each reason is preloaded through `SayIt.line`. It is the
  say-it card's voice (`SayIt.voice`, through its `ask` hook): media in the
  app, Web Audio on the website, the mic only after "Go!" and its tail.
- **The game keeps going.** Nothing holds, dims or waits, and the game's
  banners still show; Echo's button breathes while he asks and listens. Only
  the game's own sounds (its chimes, Piano Tiles' notes) stop, from his first
  word until the mic has closed, so nothing plays over him or into the mic.
- **He listens 8 seconds** (`SLOW_ASK.listen`). One heard sound earns the
  power at once, exactly as before (Super Slice ten seconds, the others eight
  at 55%), restores one missing heart up to three, and is one rep. Nothing
  heard: the mic closes quietly and play goes on. Two quiet asks in a row and the next waits 40 seconds
  (`SLOW_ASK.quiet`), so a child who isn't playing along isn't asked every
  20 seconds; a heard one goes back to 20.
- **Play time only.** No ask during a say-it card, a break, a finale, while
  the power is on, on a hidden page, or once the phone has refused the mic
  (then not again that visit). A round that ends while he asks ends his turn
  first, and that turn is not counted as a quiet one.
- **A tap on Echo still asks at once**, the same way: a shortcut, never
  needed. "Keep playing" is gone: there is nothing to cancel.
- **What Travis chose, and its cost.** A mic left open the whole game would
  make an iPhone play everything like a phone call (quieter, the side buttons
  moving call volume), so he chose this over that. The cost is about eleven
  quiet seconds (his ask and his listening) in every half minute or so of
  play: no swish, no piano notes. The timings are the numbers in `SLOW_ASK`,
  plus each page's earlier first ask.
- **Rachel's to rule on:** a child is now asked for the bare sound about
  every 20 seconds inside these games, on top of the cards between rounds;
  whether that is too often, and whether "Go!" belongs there. What counts is
  unchanged ("a voice of the right kind", Apple's check where it can; "taco"
  and "wow" still fail), and it is still play, never practice data.
`arcadespeechhelptest` plays the ask in all five games, with
`tilesspeechtest`, `superslicetest` and `micquietgamestest`; the five round
suites, `sayitcardtest` and `micquietgamestest` hold it so each plays just its
round (`micquietgamestest` then makes one ask due on purpose).

**Feed Echo needs the word** (Travis, 1 Oct 2026: "all that it does is ask you to click. we need to get the kid to have to say it!"). "Let's play" starts the round (so the first ask is heard on an iPhone), and a grown-up says yes to the mic first, the Say & Play way; "Not now" goes home, because Echo needs to hear the word to eat. Each turn the pictures wait, locked, until a voice burst of the right broad sound family is heard ("Echo heard you!", never "correct"); then the asked picture glows and a tap feeds it. A tap before the word wobbles and says "Say it first!"; silence never unlocks anything: after 8 seconds the mic closes and a mic button waits, which says the word again and listens again. The mic now opens straight after Echo's ask (and, since 2 Oct 2026, his "Go!"): it used to wait for `navigator.permissions` to say "granted", which the iPhone app's web view does not reliably say, so on the phone it never listened; a permissions question that has not answered within a second now means "ask the grown-up" (Say & Play too), never a Let's play that does nothing. Still play, never practice data: one rep per heard word. `feedtest` and `micquietgamestest` play it.

**Echo says the say-it card out loud, and "Go!" hands over the turn** (Travis,
2 Oct 2026: "when a game will pause and ask them to say the target sound, I
want the 11 Labs voice to say out loud ... to keep playing ... Most of these
kids can't read", and "i also wanna try to have the 11 labs voice say
"Go!""). Only Fruit Slice spoke its card; now all five round games do, from
one copy, `public/arcade-sayit.js` (`SayIt.voice`): "To keep playing, say",
Rachel's one take of the sound, then "Go!", and only then the mic, 250 ms
after his last word (`VOICE_TAIL_MS`, the tail every listening page keeps),
never into a sound. It can never look frozen: the two lines are asked for as
the page loads and kept in the phone's voice cache; a line still on its way
gets 2.5 s, a media element that never starts 4 s, her take 3 s, then the card
goes on without it; on the website the lines play through the page's own Web
Audio (a browser refuses an `<audio>` started between rounds), in the app as
media; a mic the phone has refused gets no ask at all. Fruit Slice's cards
that ask a syllable or a word (see "Games ask for more than the sound") say
Echo's one line for it in place of the first two, through the helper's
`ask` hook, then "Go!"; its step-back says "I have an idea. Let's try this
one.", her take, then "Go!". "Go!" also follows
every ask that hands a child the turn: the practice page's prompt, a tap on
Echo, the turtle and its two retry lines ("… five times. Go!", joined on as
one clip after the words, so the quiet before the mic still starts at its
end), every Say & Play word (Bubble Pop, Hoops, Soccer Goal, Dino Dig) and
Feed Echo's ask. Not the books (their ask is pinned) and not parked Peekaboo.
"Go!" is ONE clip, `Sona.goClip`: this page's copy or the phone's saved one,
asked for on its own so every saved ask stays valid, never a wait on the
network after a visit's first ask (that one waits `GO_WAIT_MS`, 1.5 s, at
most), and never the browser's robot voice (no clip, no "Go!"). Known and
kept: the mic opens after "Go!", so a child who answers the instant they hear
it can be talking before the mic listens (`micquietgamestest` pins that a
word said over "Go!" is not heard; on the practice page the next of their
five tries is). The 24 Sep 2026 calm rule took "Go!" out for sounding jumpy;
it is back as Travis's try, and whether it stays is his ear and Rachel's
call (a turn cue): taking it out is one line in each place. What counts as
the child is unchanged by any of this. `sayitcardtest` plays the card in all
five games, `voicetest3`, `chargepacingtest`, `sayplaytest`, `feedtest`,
`micquietgamestest` and `iphonepolishtest` the "Go!".

**Hearing a child from further away: paused, numbers first** (Travis, 2 Oct
2026: "I have to say the word super close to the phone or else it won't seem
to hear it ... Sock.", then, about 13 hours of helper work later, stop and
ship only the safe parts). Every bar is as it was. What the work found: every
way of hearing a quieter voice also let quieter noise count (a fan, a tap or
shower, a clap, a machine's hum, Echo's own ring after "Go!"), because the
web pages hear loudness and rough sound shape only. A likely cause, still
unchecked on a phone, is not a bar at all: in the iPhone app, Apple's
listening check (SonaSpeech) sets the audio session to `.measurement` mode,
which turns off the phone's automatic gain (`SPEECH_PLUGIN.md` lists the
audio session as the known risk; a fix there needs an App Store build). So
measure before changing anything: say "sock" at arm's length on speaksona.com in
Safari, then in the app, then in the app with Speech Recognition off for Sona
(iPhone Settings, Privacy & Security; quit the app first). **The mic numbers**
show what the phone hears: five quick taps on "Account" in Settings (behind
the grown-ups check, because the app keeps its own storage) switch on a box
at the top of the practice page with the level now, the loudest moment of the
last two seconds, the bar, the room, each sound that cleared the bar (how loud,
counted or not), the frame rate and what the phone says it does to the mic.
It changes nothing that counts, never takes a tap, and nothing it shows is
saved or sent (`micquietpracticetest`, `familynavtest`).

**Super Slice: Fruit Slice's sound power** (Travis, 29 Sep 2026: "give them an
option to say the sound to slow the game down ... they go into some frenzy
mode or easy mode or beast mode when they say their target sounds ... one at
a time", then "1 time to get it slow mode is fine ... or just to say it and
hold"). Fruit Slice's help became a mode a child wants to earn, and the other
games copy it one at a time:
- **Echo asks mid-wave and the child says the sound once**, quick or held
  (since 3 Oct 2026 nobody taps: see "Echo asks, then listens"; a tap on
  him still asks at once). The fruit keep flying; the page's own sounds stop
  while he asks and listens (the mic may only open while nothing plays). The
  first ask in a visit Echo says "Super Slice! Say", then one take of
  Rachel's recorded sound (`{SND}-sound.wav`, as the say-it card does), then
  "Go!"; later asks play only the sound and "Go!". A heard try shows "Got
  it!" and ends the turn after the 550 ms Apple's recognizer gets. Silence
  and (on the iPhone) a clearly different word earn nothing. **"wow" for "rrrr" does not count**
  (Travis, 29 Sep 2026: "no wow should not count"): `hearVerdict` keeps
  failing it.
- **Ten seconds of Super Slice:** the fruit slow to 55%, the stand throws
  five at once (one golden), every toss after is two or three (it outranks
  the two-miss help), the swipe becomes a wide rainbow blade (it slices 34 px
  past a fruit's edge, not 16), and the screen edge glows gold. Its fruit are
  extras: they add to the row of fruit but never to the wave, and nothing
  dropped while it lasts breaks the row (see "Beat Your Best"). Time left
  when a wave ends waits through the break and carries into the next wave
  (a wave can still end while it is on: its 45 seconds, or the last ordinary
  fruit in the air); the giant watermelon ends it.
- **Every earned turn is a rep** on the week's count (see "The week's reps");
  still never practice data. The round still ends on the giant watermelon
  whether or not a child ever says a word. The retired names (STAR MODE,
  FRUIT FRENZY, SLOW-MO…) stay banned. `tests/superslicetest.mjs` plays it;
  Block Stacker, Sound Sprint and Flappy Glide keep the eight-second slow
  help (now with the same one-take sound) until each gets its own mode.

**Games ask for more than the sound: Fruit Slice first, R first** (Travis, 1
Oct 2026, by voice: "we need to add back the increase of complexity to the
sounds in the games and start with isolation then ree rah roh then rot. and
maybe have that be something to update in settings"). "Add back": in June the
old speech games asked for the level a child had earned; they were deleted in
August, and since then only the "Say it 5 times" page climbed. Every say-it
card between rounds said the bare sound. What is built is the first slice:
- **One reader, `Sona.gameAsk(sound, card)`** (and `gameTop`). Card 0 is the
  bare sound; cards 1 and 2 are the two cards between rounds. The steps: the
  sound alone ("rrrr"), then **one syllable a card** ("ree", "rah" or "roh",
  moving on one each calendar day, so nothing is stored; never three in a
  breath, which confused children in July), then **a short word** ("rot",
  Travis's word: it is in no word bank and has no picture, so only a text
  card may ask it).
- **How far a child's cards go:** one step past what they have earned on the
  practice page (so a new child gets a syllable on both cards, and the word
  after two clean practice rounds), or what a grown-up picked in Settings.
  Never below what the "Say it 5 times" page just asked: that page hands over
  the step it ended on and its item (`sona.boost.level`, `sona.boost.ask`),
  and a card repeats that syllable or word instead of adding a new target.
- **Two kinds of child never get the harder cards** (`Sona.gameHold` says which, and
  the Settings line reads it): **a child aged 2 to 4**, whatever was earned
  or saved (Home shows a four-year-old Fruit Slice too, and Settings hides
  the picker for that age, so the cards had to stay on the bare sound for
  hiding it to be honest), and **any child while Sona's sound is off**
  (only Echo's voice can model a syllable).
- **Switched on one sound at a time.** `gamecontent.js` holds three lists
  Rachel can read: `GAME_SYL_ON` (today `["R"]`), `GAME_SKIP` (never asked:
  "pee"; "gee", which Echo's voice reads "jee"; the quiet th's "thee", which
  it reads as the loud th) and `GAME_SHORT` (today `R: "rot"`). A sound goes
  into `GAME_SYL_ON` only after someone has **listened** to its lines on a
  phone. A sound that is not in it asks the bare sound exactly as before, so
  nothing changed for any child who is not on R.
- **An SLP's homework wins.** Its own words are the word card's words. When
  its position is not the start of a word (end of word, "er, ar, or") there
  is no syllable step, because "ree" is a start-of-word R, not her target:
  the sound, then one of the homework's words if it names any.
- **Fruit Slice's card is the only one that does it.** It shows the ask with
  only the sound's letters orange and says it in ONE line of Echo's own voice
  ("To keep playing, say... ree."), because nothing past the bare sound is
  recorded. **A harder ask is never shown unless Echo says it.** His line
  starts downloading as the wave ends (about 2.6 seconds before the card),
  and the syllable is painted only once the line is in hand, just before it
  plays. Until then the card shows the bare sound; if the line has not come
  about three seconds after the card opens, or will not play, it stays on
  the bare sound and plays Rachel's recording. (The first cut painted "ree"
  and then waited up to seven seconds for a voice.) **A card nobody
  answers** for about eight seconds closes its mic and steps back to the bare
  sound ("I have an idea. Let's try this one.", then her recording), **and
  the next card that round does not climb**: it asks that same syllable or
  word again, never the next step. Echo's power button (Super Slice) still
  asks the bare sound: Travis wanted it quick, and Apple's listener would
  turn away a good "ree" it wrote down as "we".
- **Honest limits.** A card hears only "a voice of the right kind". It cannot
  tell "ree" from "rrrr" or "rot", so harder means what Echo asks, never what
  is checked, and Echo never says "correct". Nothing said in a game moves the
  earned level, and a heard card is exactly one game rep, never practice data.
- **Settings has one picker** under Word position: "Between rounds in a game,
  Echo asks for" (Sona decides · Just the sound · Sound, then syllables ·
  Sound, syllables, word), saved per child as `profile.gameLevel`. It is a
  ceiling for the cards and never writes the earned level. The choices are
  short on purpose: a phone's closed picker cut the longer ones off ("Sona
  decides (starts easy, gets h…") and two of them then read the same;
  `kidtest` measures them at 320 px. The wording is Travis's to change. Its
  grey line is painted from the same reader, for the sound a game will
  really ask (the homework's sound first), so it shows only what will be
  asked, and it names Fruit Slice because that is the only game that does
  this yet. When something holds the cards to the bare sound the line says
  what: Sona's sound is off, the sound is not switched on yet, or a speech
  therapist's homework is for another part of the word. Hidden for a child
  aged 2 to 4, whose cards keep the bare sound whatever is saved.
- **Not built yet:** the other four round games (Piano Tiles, Block Stacker,
  Sound Sprint, Flappy Glide: their cards are silent, so each page's mic must
  first learn to wait for Echo's voice); the other 18 sounds; the picture
  games, which keep whole words. Travis plays Fruit Slice on his phone and
  hears "ree", "rah", "roh" and "rot" before any of that starts.
- **Rachel's calls, built on defaults until she answers:** which syllables
  and in what order; whether "rot" is the word (and the list for the other
  sounds); the pace (syllables from day one, the word once earned, the
  eight-second step back, and whether the card after a step back should
  repeat the same ask, as built, or go lower); Echo's computer voice
  modelling "ree" and "rot" rather than her own recordings; that a card asks
  for "rot" but cannot check it; whether a grown-up may set the step by hand;
  what the cards ask under end-of-word homework; and whether a child aged 2
  to 4 should ever be asked a syllable (today: never).
`tests/gameasktest.mjs` holds the reader to these rules; `slicetest`,
`micquietgamestest` and `iphonepolishtest` play the card; `soundmap` pins the
three lists and `kidtest` the picker.

**The week's reps** (Travis, 28-29 Sep 2026). Home's top corner shows today toward the daily goal; Settings keeps the
week-by-week total, and Progress keeps sound practice apart from play. One count, `Sona.repWeeks`/`weekReps`:
the practice page's voiced tries (`outcomes().days[].tries`, only days since
tries were counted, 22 Sep 2026) **plus every sound a game asked for and
heard** (`Sona.gameRep`, Travis: "yeah count as reps"): the say-it card
between rounds, Echo's sound powers, each saying of a Hoops, Soccer Goal or
Dino Dig word (two a word), a Bubble Pop word (said once), Feed Echo's heard
word and each accepted book key word (one a page).
Game reps live in their own per-child ledger (`sona.gamereps.v1`) and never
enter `outcomes()`, so no pass rate, clinician's note, shared progress or
coin sees them: the hard rule "voice boosts never logged as SLP data" holds.
Only a voiced try that passed the game's own check counts, once per ask;
silence never does. **Progress keeps practice apart:** its "tries" and
everything it hands a clinician (the summary, the card, "Free-play games are
not included") are the practice page's alone (`weekReps(offset, sound,
true)`), with a "Plus N said out loud in games and books" line so the week still adds
up to the Settings weekly total. `tests/repweektest.mjs` pins it.


**Sound Sprint is the same round, as a race** (27 Sep 2026): the park, the
beach and the forest, a checkpoint between each with the say-it card ("Say
“rrrr” to run to the beach!"), and a finish line that ends a completed race in a win; three lost hearts
can end it earlier. A rock is a tumble (a second off the road, ten metres back), never the
card; after two tumbles in a stretch the rocks thin out and the road slows.
The child taps the lane they want or swipes (a tap used to count only as the
left or right half of the screen). A golden coin is a coin magnet. The top
bar shows coins and the stretch; the end card counts metres (it said
"treats"). `tests/runtest.mjs` runs a whole race.

**Sound Sprint opens on Echo's how-to-play** (Travis, 1 Oct 2026: "when a kid
is about to start playing sound sprint, we want the voice ... to say
instructions ... so that they have instruction on what to do"). A child's
first three races open on a start card: Echo waving, three pictures from the
race itself (the runner in the lanes, a rock and a cactus, a gold coin) and one
teal button, "Let's run!". An iPhone plays nothing on a new page until a tap,
so the tap is the button: Echo says "Tap a lane to move side to side. Dodge
the rocks and the cactus, and grab the gold coins!" (true to the race: there
is no gold star), the button becomes a cream "Skip", and the race starts the
moment he stops. The race is held behind the card (nothing moves, spawns or
counts; both clocks start with the race). Three races, counted per child
(`sona.sprintintro.v1`); a suite that needs the race running seeds it to 3.
The line plays as media inside the tap (`Sona.mediaPCM`), with the browser
voice as the fallback, and never leaves a dead end: sound off starts the race
at once, a voice that never comes starts it within seven seconds, and locking
the phone mid-line stops Echo and keeps the race held. No microphone, no rep,
no practice data. `tests/runtest.mjs` plays all of it.

**Flappy Glide is the same round, as a flight** (27 Sep 2026): three legs of
6, 7 and 8 gaps, a rest on a cloud between each with the say-it card ("Say
“rrrr” to fly on!"), and a fireworks landing for a completed flight; three lost hearts can
end it earlier. The review found it the hardest of the six (a steady tap every
half-second, hedges nearly back to back), so the balloon floats and sinks
slowly (a tap about every second holds it level), the gaps are wider and
further apart, and a hedge is a soft bounce back into the gap, never the card;
after two bumps in a leg the gaps open wider and the hedges slow. Stars in the
gaps can be caught. **Hold-to-rise**, the review's other idea, changes the
control, so it waits for Travis. `tests/glidetest.mjs` flies a whole flight.

**Beat Your Best: each child's own best in a game** (Travis, 1-2 Oct 2026:
"whatever you think is best for kids you can do"). A game counts ONE real
thing the child's finger did and remembers that child's best. The win card
still says they won, then adds one line; the top button is "Play again"; and
Home's picture of the game carries a small "Best 17". **Step one is built:**
the shared store, Home's tag, Piano Tiles (notes in a row) and Fruit Slice
(fruit in a row). Block Stacker, Sound Sprint, Flappy Glide, Hoops and Soccer
Goal follow after Travis has played these two; Dino Dig gets no number.
- **What binds every game that gets one.** Every ending remains kind; a
  completed finale celebrates a win, and zero hearts ends the round without
  claiming completion. The number on screen never goes
  down during play. It counts the finger, never the voice: nothing grades
  speech, nothing is practice data, and nothing reaches Progress, the week's
  reps, coins, a clinician or the server. No child sees another child's.
  Never "score", "points" or "high score" to a child, and never "you
  missed": under the best is an invitation ("3 away!"). A game never played
  shows nothing. Saying the sound is the best way to go higher, because it
  earns the help (slow keys, Super Slice); the sound itself is never counted.
- **The store** is `Sona.gameBest(key)` and `Sona.gameBestOffer(key, n)` in
  `sona.js` (block `BESTS1`). `gameBest` answers a whole number from 1, or 0
  for a game never played. `gameBestOffer` keeps `n` only when it beats the
  best and answers `{ best, prev, isNew }`: `prev` 0 is a first ever round,
  matching the best is not new, and `best` is never below a valid `n` even
  when the phone cannot save. Only whole numbers 1 to 99,999 and real game
  keys count. One record per child, `sona.bests.v1` in `PER_KID` (`{ tiles:
  { n: 38, at: "2026-10-02" } }`): a brother or sister starts with none, it
  goes when the child is removed, and it rides in a backup. The old
  one-per-phone keys (`sona.best.<game>`) counted the hidden score: they are
  never read and not carried over. Pages ask for the store first
  (`CAN_BEST`), so an older cached `sona.js` still plays the game.
- **Home's tag** (`paintBest` in `today.html`, `.game-best` in
  `crafted-home.css`): a game the child can open shows "Best 17" with the
  app's small star, top left of its picture; the Free / Included badge keeps
  the bottom right. No tag for a game never played, a greyed Premium game or
  a Coming soon game. The card's spoken label adds "Your best: 17." Home
  reads the tags again when it comes back to the front.
- **In the game.** The top-left number is the longest row of this round
  (`rowBest`), not the row they are on, so it never drops; a broken row just
  starts again underneath it. "New best!" pops once a round, the moment the
  row passes the best the child came in with, never on a first ever round;
  the round's own banners wait for it. The best is kept the moment it is
  passed, at each wave or song end, when the phone is locked, on the ✕ and
  at the end.
- **The win card's line** (`bestLine()` in each page): first ever "14 fruit
  in a row. Your best: 14!"; beaten "17 fruit in a row. A new best!"; close
  under "14 fruit in a row. Your best: 17. 3 away!"; more than `AWAY_NEAR`
  (10) under, "5 fruit in a row. Your best: 38." with no gap (a big gap is a
  measure, not a dare); level "The same as your best!". One thing is "1
  fruit", never a row. A round that counted nothing keeps "Good try! Wanna go
  again?" and shows no line. The title carries no number, so the row is the
  only count on the card (Fruit Slice's early-stop title is "I saw the fruit
  fly! So fun!", no longer "I saw 12 fruits fly!").
- **"Play again" on top, "Back home" under it.** Another go is earned the
  way every turn is, back through that game's say-it-five-times page
  (`charge.html?game=…`). The game-to-game "WOOHOO! Next →" is gone from
  these two; `micquietgamestest` lists them in `PLAYS_AGAIN`. Fruit Slice
  still calls `Sona.firstGameEnd("slice")`, because asking spends the
  first-game mark.
- **Piano Tiles: notes in a row.** Tiles tapped with none slipping past and
  no wrong key (a tap on a key with no tile there). The row carries on from
  song to song; the top is every note of the four songs (`ROW_TOP`, 52), and
  a child there again is told "That is every note!". A second tap on the key
  just played, within `DOUBLE_MS` (300 ms), is a bounce and does nothing; any
  other empty key still ends the row, so mashing the keys can't build one.
  The row flash is "8 in a row!" and the gold one "GOLDEN NOTE!" with no
  "+3".
- **Fruit Slice: fruit in a row.** Fruit sliced without one hitting the
  ground. A golden fruit is one, the giant watermelon is one, and the row
  carries on from wave to wave. **Super Slice's fruit are extras** (the two
  rules Travis left to us): a fruit thrown while the power lasts adds to the
  row when sliced but never to the wave, so saying the sound no longer ends
  the wave sooner; and nothing that lands while the power lasts, and no
  extra ever, breaks the row or feeds the two-miss help. A wave's 45 seconds
  now count real seconds of play (`wavePlay`), not the clock Super Slice
  slows, so no round runs on: three waves of at most 45 seconds, then the
  giant. Every fifth fruit flashes the row ("5 in a row!"); the quick-slice
  "N COMBO!" and the "+3" are gone.
- **The old five-game run's card** (`?daily=1`; Home never opens it, a saved
  run or a typed address still can) banks the round and moves on as before;
  it says "Great round!" and "On to the next game…", never "+N points!".
  Block Stacker, Sound Sprint and Flappy Glide still say "points" there and
  still write the old shared keys until their turn.
- **Rachel's to rule on:** children will say the bare sound more often in a
  round, alone and quickly, because it is the best helper; whether that
  wants a limit. And a child the phone hears poorly earns less help, so
  their number may sit lower.
`tests/besttest.mjs` pins the store, the leaks and Home's tag; `tilestest`
and `slicetest` play each game's row and every line; `superslicetest` plays
the extras through the real earned turn.

Peekaboo stays visible only as a disabled "Coming …" card, with no New
shelf promotion and no direct-link, paid or earned bypass; its engine
(`simple-play.js`) remains in the repo. **Bubble Pop is back** (Travis, 30 Sep
2026), free, the second game for ages 3-4 beside Feed Echo (rebuilt on 1 Oct
2026; see "Bubble Pop is rebuilt to be played"): a full-width Home card like
Feed Echo's
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
  score (a golden fruit or tile scores 3 and the giant's cuts score 5): Fruit
  Slice counts fruit in a row and Piano Tiles notes in a row, each beside the
  child's own best in that same thing (see "Beat Your Best"; the old "Best"
  was the hidden score, which is why it was taken off). Block Stacker counts
  blocks and Sound Sprint metres until their own bests land.
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
  no mechanism to break it, not because a checkbox is off. Its short form, the
  grown-ups line on every mic ask (`MIC_PROMISE`), is "audio is never
  uploaded. One try a day is saved on this phone so you can listen back."
  (Travis, 2 Oct 2026, asked for "audio is never recorded or uploaded"):
  never "never recorded", which that one saved try would make false. `mictest` pins the
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
- **End every speech-practice round on a success.** Step the target down
  rather than let a child fail out of speaking — the last thing they do is
  the thing they remember. An arcade round can end at zero gameplay hearts
  under Travis's 4 Oct rule; it never marks the child's speech as a loss.
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
    loud, in practice, a game or a book. Silence never counts." (`repweektest`.)
  - No volume slider: the phone's side buttons set the level ("why can't we
    just use our phones to adjust volume on the side of our iphone?").
    `getProfile()` plays any saved level above zero at the one normal level,
    0.8; a volume of 0 stays muted, and only then Settings shows "Sound is off
    in Sona." with "Turn sound on". Never bring back a level control: a saved
    level nobody can change is how families got stuck at 30% once.
  - No parent code: the grown-ups check is always four number words (it stays
    for Settings, Progress and Talk to us). Apple wants a check before a buy
    screen only in its Kids category, which Sona is not in, so since 4 Oct
    2026 the offer a grey game or book opens skips it (see "TRIAL FIRST").
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
- **So do Sona's chimes** (2 Oct 2026): the "heard you" chime rings the moment
  the mic closes, exactly when Web Audio is a quiet phone call. `Sona.sfx`
  decides, once, for every page: in the app each chime is written down from
  its own recipe as a short recording and played as a media element (one
  element a chime, the level in the samples, `CHIME_MEDIA` in `sona.js`, set
  without a phone to listen on); a refused element falls back to Web Audio,
  never to silence; a muted Sona plays none; the browser keeps Web Audio. When
  a chime may ring is still each page's own rule (never over a mic). Piano
  Tiles' notes and Bubble Pop's pops are media in their own pages. **Still Web
  Audio in the app:** the sounds Hoops, Soccer Goal, Dino Dig and Fruit Slice
  make themselves (the swish, the kick, the roar, the splat).
- Comments explain *why*, especially where the obvious implementation is
  wrong. Match the surrounding density.


**Daily rep goals and weekly goal days** (Travis handoff, 5 Oct 2026).
Home uses the shared read-only `dayGoal()` count: today's practice tries plus
accepted game and book asks. Defaults are 30 for ages 3–4 and 50 for ages 5–8,
4 days a week; grown-ups choose 3/4/5 days and a daily number in Settings. An
active clinician assignment keeps precedence over the family's daily number.
These are product defaults, not a research-established treatment dose.

`sona.goaldays.v1` is per child, backed up and removed with that child. It
stamps a day once when a real counted rep reaches the goal. Raising the goal
later cannot erase it. A DOM-only status appears once that day, for four
seconds, without audio, confetti, a focus change or any interception of play.
An invisible page stamps without displaying it. Opening Home earns nothing.
Monday–Sunday goal stamps feed the weekly goal streak, with earlier practice
days (before 5 Oct 2026) preserving existing weeks. An unfinished week does not
break the prior completed-week streak. `momWeek().days/done` remain actual
practice days for the clinical summary; `.metDays/.goalDone` serve the goal.
Game and book reps remain outside outcomes, clinician summaries, shared
progress, practice coins and homework reports. Settings explicitly explains
the homework report's practice-only count. No child name enters goal analytics.
`dailygoaltest`, `repweektest`, `momweek` and `booktest` pin the boundaries.

Rachel's follow-up review belongs in the development record, not a warning
flow or an approval screen for families:

| Review question | Product behavior shipping |
|---|---|
| Daily defaults and the age split |30 at ages 3–4; 50 at ages 5–8, adjustable|
| What a rep means |Voiced practice try, accepted game ask or accepted book word; no silence|
| Homework and play |Home includes play toward the displayed goal; clinician report stays practice-only|
| Weekly target |4 days by default, choice of 3/4/5; earned-day stamps|
| Book check limitations |One accepted word is a play rep, without a clinical correctness claim|
