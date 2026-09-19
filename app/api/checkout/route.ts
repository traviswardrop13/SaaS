import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { FREE_MODE } from "@/lib/pricing";
import { charterSpots, CHARTER_CENTS, STANDARD_CENTS, CHARTER_CAP, CHARTER_LABEL } from "@/lib/charter";

/**
 * Creates a Stripe Checkout Session for Sona.
 *
 * TWO offers: $59.99/year with a 3-day free trial, or $9.99/month billed
 * immediately (no trial — the trial is the yearly plan's perk). Charging on
 * the web (Stripe) keeps ~97% of revenue vs Apple's cut. `plan` picks the
 * tier ("monthly"/"month" → monthly, anything else → annual, so every old
 * link still resolves). Existing $39.99 subscribers keep renewing at their
 * price — a Stripe subscription carries its own price forever.
 *
 * Deliberately NOT reading the old STRIPE_PRICE_ID_ANNUAL79 env: a stale
 * Price object in Vercel would silently override this file's amounts. New
 * env names or inline price_data only.
 *
 * Needs env: STRIPE_SECRET_KEY (live). Optional: STRIPE_PRICE_ID_MONTHLY999,
 * STRIPE_PRICE_ID_ANNUAL5999.
 */
export const runtime = "nodejs";

const TRIAL_DAYS = 3;
// ONE PLAN. Monthly ($9.99) was retired on 18 Sep 2026 — Sona sells the yearly
// plan only. Anyone still holding a monthly subscription from an earlier window
// keeps it: this table is the PURCHASE path, and removing a plan from it does
// not cancel a live Stripe subscription. /api/subscription must go on
// recognising `month` intervals, or an existing subscriber loses their access
// the moment they reinstall.
const PLANS = {
  annual: {
    cents: 5999,
    interval: "year" as const,
    name: "Sona — Yearly",
    desc: "At-home speech-practice games, built with a licensed pediatric speech-language pathologist. Every game, every sound, every update. 3 days free — cancel anytime.",
    env: "STRIPE_PRICE_ID_ANNUAL5999",
  },
} as const;
// Every old ?plan=monthly link — ads, emails, bookmarks — still resolves,
// quietly, to the only plan there is. A 400 here would turn a stale link into
// a dead end for someone actively trying to pay.
function pickPlan(_v: unknown): keyof typeof PLANS {
  return "annual";
}

export async function POST(req: NextRequest) {
  // Sona is free. Nothing here may take money — and the refusal lives on the
  // server because the buttons are not the only way in: a bookmark, a stale
  // tab or an old ad link reaches this endpoint directly.
  if (FREE_MODE) {
    return NextResponse.json(
      { ok: false, error: "Sona is free — there is nothing to buy." },
      { status: 410 },
    );
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Server is missing STRIPE_SECRET_KEY." },
      { status: 500 },
    );
  }
  const stripe = new Stripe(key);

  let email: string | undefined;
  let planKey: keyof typeof PLANS = "annual";
  try {
    const b = await req.json();
    email = typeof b?.email === "string" ? b.email.trim() : undefined;
    planKey = pickPlan(b?.plan);
  } catch {
    // no body — fine; Checkout will collect the email
  }
  const PLAN = PLANS[planKey];

  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    new URL(req.url).origin;

  const priceId = process.env[PLAN.env];
  // THE TIER IS DECIDED HERE, FROM THE REAL COUNT, at the moment of purchase.
  // Every price surface in the product says "$59.99 for the first 50 families,
  // then $99.99" — and this is the one line that makes that sentence true:
  // spot 51 is charged the standard price whatever any page happened to show.
  // The count is memoised for a minute and falls OPEN if Stripe cannot be
  // reached, so a lookup failure never costs a family $40.
  const spots = await charterSpots(stripe);
  const tier: "charter" | "standard" = spots.open ? "charter" : "standard";
  const cents = tier === "charter" ? CHARTER_CENTS : STANDARD_CENTS;
  const tierName = tier === "charter" ? `${PLAN.name} (${CHARTER_LABEL} price)` : PLAN.name;
  const tierDesc = tier === "charter"
    ? `${CHARTER_LABEL} price for the first ${CHARTER_CAP} families — yours for as long as you keep Sona. ` + PLAN.desc
    : PLAN.desc;
  // A fixed Stripe Price from the environment can only ever be the charter
  // price (that is the amount it was created with), so it is used only while
  // the charter is open; the standard tier is always inline price_data.
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = (priceId && tier === "charter")
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: cents,
            recurring: { interval: PLAN.interval },
            product_data: { name: tierName, description: tierDesc },
          },
        },
      ];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items,
      // the 3-day trial is the YEARLY plan's perk; monthly bills at purchase
      // metadata.tier on the SUBSCRIPTION is what lib/charter.ts counts: a
      // standard-tier sale is excluded from the fifty, everything else is one
      // of them. On the session too, so the success page can say which.
      subscription_data: planKey === "annual" ? { trial_period_days: TRIAL_DAYS, metadata: { tier } } : { metadata: { tier } },
      metadata: { tier },
      customer_email: email,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}&plan=${planKey}&tier=${tier}`,
      cancel_url: `${origin}/subscribe.html?canceled=1`,
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Checkout failed." },
      { status: 502 },
    );
  }
}

/**
 * GET /api/checkout — plain-link checkout for landing-page CTAs (no client
 * JS): creates the session and 303s straight to Stripe. Any ?plan= value,
 * including the retired ?plan=monthly, resolves to the yearly plan.
 */
export async function GET(req: NextRequest) {
  // A click on an old ad or a stale "Start 3 days free" link lands on the
  // marketing page, which now says the app is free — never on a Stripe form.
  if (FREE_MODE) return NextResponse.redirect(new URL("/", req.url), 303);
  const plan = new URL(req.url).searchParams.get("plan") || "";
  const proxied = new NextRequest(req.url, { method: "POST", headers: req.headers, body: JSON.stringify({ plan }) });
  const res = await POST(proxied);
  const j = (await res.json()) as { ok?: boolean; url?: string };
  if (j?.ok && j.url) return NextResponse.redirect(j.url, 303);
  // cold ad traffic must land back on the marketing page — subscribe.html is
  // parent-gated and would bounce a fresh visitor into the app's first-run flow
  return NextResponse.redirect(new URL("/?checkout=failed", req.url), 303);
}
