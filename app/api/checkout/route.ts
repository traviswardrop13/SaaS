import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * Creates a Stripe Checkout Session for Sona.
 *
 * ONE offer: a $79.99 one-time payment that unlocks Sona forever — no
 * subscription, no trial, no renewal. Charging on the web (Stripe) keeps
 * ~97% of revenue vs Apple's cut. Any legacy `plan` value (annual, monthly,
 * founding — retired tiers from before the lifetime-only simplification)
 * is ignored; every checkout sells the same lifetime unlock, so old links
 * never break. Set STRIPE_PRICE_ID_LIFETIME to use a real Price object
 * instead of the inline price below.
 *
 * Needs env: STRIPE_SECRET_KEY (live). Optional: STRIPE_PRICE_ID_LIFETIME.
 */
export const runtime = "nodejs";

const LIFETIME = {
  cents: 7999,
  name: "Sona — Lifetime",
  desc: "One payment, Sona forever — every game, every future sound and update. No subscription, no renewals.",
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

  const priceId = process.env.STRIPE_PRICE_ID_LIFETIME;
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: LIFETIME.cents,
            product_data: { name: LIFETIME.name, description: LIFETIME.desc },
          },
        },
      ];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      customer_email: email,
      // one-time payments don't create a Customer by default; without one there
      // is no durable email->purchase link for Settings -> Restore access
      customer_creation: "always",
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}&plan=lifetime`,
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
 * JS): creates the lifetime session and 303s straight to Stripe. The `plan`
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
