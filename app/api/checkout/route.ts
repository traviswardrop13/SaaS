import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * Creates a Stripe Checkout Session for Sona.
 *
 * ONE offer: $39.99 per year with a 7-day free trial. Charging on the web
 * (Stripe) keeps ~97% of revenue vs Apple's cut. Any legacy `plan` value
 * (monthly, founding, lifetime — retired tiers) is ignored; every checkout
 * sells the same yearly plan, so old links never break. Set
 * STRIPE_PRICE_ID_ANNUAL79 to use a real Price object instead of the inline
 * price below.
 *
 * Needs env: STRIPE_SECRET_KEY (live). Optional: STRIPE_PRICE_ID_ANNUAL79.
 */
export const runtime = "nodejs";

const PLAN = {
  cents: 3999,
  interval: "year" as const,
  trialDays: 7,
  name: "Sona — Yearly",
  desc: "At-home speech-practice games, built with a licensed SLP. Every game, every sound, every update. 7 days free — cancel anytime.",
} as const;

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Server is missing STRIPE_SECRET_KEY." },
      { status: 500 },
    );
  }
  const stripe = new Stripe(key);

  let email: string | undefined;
  try {
    const b = await req.json();
    email = typeof b?.email === "string" ? b.email.trim() : undefined;
  } catch {
    // no body — fine; Checkout will collect the email
  }

  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    new URL(req.url).origin;

  const priceId = process.env.STRIPE_PRICE_ID_ANNUAL79;
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
      subscription_data: { trial_period_days: PLAN.trialDays },
      customer_email: email,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}&plan=annual`,
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
 * JS): creates the yearly session and 303s straight to Stripe. The `plan`
 * query param is accepted but ignored (back-compat with old links).
 */
export async function GET(req: NextRequest) {
  const proxied = new NextRequest(req.url, { method: "POST", headers: req.headers, body: JSON.stringify({}) });
  const res = await POST(proxied);
  const j = (await res.json()) as { ok?: boolean; url?: string };
  if (j?.ok && j.url) return NextResponse.redirect(j.url, 303);
  // cold ad traffic must land back on the marketing page — subscribe.html is
  // parent-gated and would bounce a fresh visitor into the app's first-run flow
  return NextResponse.redirect(new URL("/?checkout=failed", req.url), 303);
}
