# Stripe checkout — setup (5 minutes)

The web subscription flow is fully built. It just needs your Stripe keys to go
live. Charging on the web (not in-app) keeps ~97% of revenue vs. Apple's cut.

## What's already built

- **`/subscribe`** — plan summary ($99/mo, 7-day trial) + email → secure checkout.
- **`/api/checkout`** — creates a Stripe Checkout Session (subscription).
- **`/subscribe/success`** — post-payment confirmation → onboarding.
- **`/api/subscription?email=…`** — returns `{ active }` so the app can gate
  access. Stripe is the source of truth, so no database is needed for the MVP.

The landing page **"Start 7-day free trial"** button links to `/subscribe`.

## Step 1 — get your keys

1. Create/log in at <https://dashboard.stripe.com>.
2. Start in **Test mode** (toggle, top right).
3. **Developers → API keys** → copy the **Secret key** (`sk_test_…`).

## Step 2 — add env vars in Vercel

Project **sona → Settings → Environment Variables** (Production **and** Preview):

| Name | Value | Required |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_…` (then `sk_live_…` for real charges) | ✅ |
| `NEXT_PUBLIC_SITE_URL` | your site URL, e.g. `https://getsona.com` | optional* |
| `STRIPE_PRICE_ID` | a Price ID, if you'd rather manage the price in Stripe | optional |
| `STRIPE_PRICE_ID_SLP_CASELOAD` | a yearly **$79.99** Price for Caseload Premium (below) | optional |
| `STRIPE_PORTAL_CONFIG_CASELOAD` | a billing-portal configuration id (`bpc_…`) for Caseload Premium — only if you'd rather make it yourself (below) | optional |

\*If unset, success/cancel redirects use the request origin, which is fine.

Then **push any commit** (or redeploy) so the new vars take effect.

## Step 3 — test it

1. Open `/subscribe`, enter an email, click **Start free trial**.
2. On Stripe's checkout, use test card **`4242 4242 4242 4242`**, any future
   expiry, any CVC/ZIP.
3. You'll land on `/subscribe/success`. The subscription shows in your Stripe
   Dashboard, and `/api/subscription?email=<that email>` returns `{ active:true }`.

## Going live

- Flip Stripe to **Live mode**, swap `STRIPE_SECRET_KEY` to the `sk_live_…` key.
- Optional but recommended later: a webhook (`checkout.session.completed`,
  `customer.subscription.updated/deleted`) if you move to a real accounts DB.
  For now, live lookups via `/api/subscription` are enough to gate access.

## Caseload Premium — the clinician plan (24 Sep 2026)

"Sona Premium for your caseload": **$79.99 a year, no trial**, bought by a
clinician from their dashboard (`/slp.html#premium` → `POST /api/slp/plan`).
Every family who joins through that clinician's link gets Premium.

- **Nothing to create to start selling.** Checkout uses an inline yearly price
  (7999 USD) from `lib/caseload.ts`, the same constant every page prints. If you
  want Stripe's product reports tidy, create a yearly $79.99 Price and set
  `STRIPE_PRICE_ID_SLP_CASELOAD` — it must be exactly $79.99/year, or the pages
  and the charge disagree.
- **The billing page cancels at period end, by construction.** The dashboard's
  **Manage billing** button (`POST /api/slp/plan/portal`) opens Stripe's
  billing portal under the caseload's OWN configuration — cancel **at the end
  of the billing period**, update payment method, invoice history — which the
  code creates on the first press and reuses after (`openCaseloadPortal()` in
  `lib/caseload.ts`; one per Stripe mode, live and test). Nothing to set up.
  Set `STRIPE_PORTAL_CONFIG_CASELOAD` only if you want to make that
  configuration yourself; if you do, its cancellation must be "At the end of
  the billing period". This is load-bearing: the Terms promise families keep
  Premium to the end of the paid year, and that is true only because Stripe
  keeps the subscription active until then. "Cancel immediately" would take a
  caseload's games away the same day.
- **Still set the default portal to cancel at period end** (Stripe →
  Settings → Billing → Customer portal). The family billing page uses it, and
  so does Manage billing whenever Stripe will not create or accept the
  caseload configuration (it was deleted in the dashboard, say — the code logs
  it and opens the default rather than a dead button) — so a cancel there must
  not be immediate either.
- **The stamps are the plan.** The session and the subscription carry
  `metadata.plan = "slp-caseload"` and `metadata.slp = <clinician email>`, and
  never `tier` — only `tier: charter` counts toward the 50 charter spots. Don't
  edit them by hand; coverage is read from them.
- **Web only.** There is no App Store product for this plan, and there should
  not be one (`NATIVE.md`).

## Notes

- The price ($99/mo) and 7-day trial are set in `app/api/checkout/route.ts`.
- Email is the account key for the MVP. When you add real logins later, store the
  Stripe customer ID alongside the user and gate on that instead.
