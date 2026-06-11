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

## Notes

- The price ($99/mo) and 7-day trial are set in `app/api/checkout/route.ts`.
- Email is the account key for the MVP. When you add real logins later, store the
  Stripe customer ID alongside the user and gate on that instead.
