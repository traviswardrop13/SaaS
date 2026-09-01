import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { FREE_MODE } from "@/lib/pricing";

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
const PLANS = {
  monthly: {
    cents: 999,
    interval: "month" as const,
    name: "Sona — Monthly",
    desc: "At-home speech-practice games, built with a licensed pediatric speech-language pathologist. Every game, every sound, every update. Cancel anytime.",
    env: "STRIPE_PRICE_ID_MONTHLY999",
  },
  annual: {
    cents: 5999,
    interval: "year" as const,
    name: "Sona — Yearly",
    desc: "At-home speech-practice games, built with a licensed pediatric speech-language pathologist. Every game, every sound, every update. 3 days free — cancel anytime.",
    env: "STRIPE_PRICE_ID_ANNUAL5999",
  },
} as const;
function pickPlan(v: unknown): keyof typeof PLANS {
  return /^month/i.test(String(v || "")) ? "monthly" : "annual";
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
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: PLAN.cents,
            recurring: { interval: PLAN.interval },
            product_data: { name: PLAN.name, description: PLAN.desc },
          },
        },
      ];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items,
      // the 3-day trial is the YEARLY plan's perk; monthly bills at purchase
      subscription_data: planKey === "annual" ? { trial_period_days: TRIAL_DAYS } : undefined,
      customer_email: email,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}&plan=${planKey}`,
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
 * JS): creates the session and 303s straight to Stripe. ?plan=monthly picks
 * the monthly tier; anything else (or nothing) is annual.
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
