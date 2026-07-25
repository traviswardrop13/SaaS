import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * Creates a Stripe Checkout Session for the Sona founding preorder.
 *
 * Pre-launch: the product is "coming soon", so this is a founder preorder — an
 * annual plan at 50% off ($39.99/yr, anchored against $79.99), charged now, with
 * NO free trial. Charging on the web (Stripe) keeps ~97% of revenue vs Apple's
 * cut. Set STRIPE_PRICE_ID_ANNUAL to use a real Price object instead of the
 * inline price below.
 *
 * Needs env: STRIPE_SECRET_KEY (live). Optional: STRIPE_PRICE_ID_ANNUAL.
 */
export const runtime = "nodejs";

// Plans: "annual" ($79.99/yr, 7-day trial — the ad-funnel default), "monthly"
// ($12.99/mo decoy), "founding" ($39.99/yr, no trial — the SLP/founding locked
// rate, kept as the default for legacy callers), and "lifetime" ($149.99 ONCE,
// mode:payment — the beta LTV booster; retired when beta pricing ends).
const PLANS = {
  annual: { cents: 7999, interval: "year" as const, trialDays: 7, name: "Sona — Yearly (Beta Price)", desc: "At-home speech-practice games, built with a licensed SLP. $6.67/mo billed yearly — beta price, $119.99 after launch. 7 days free — cancel anytime." },
  monthly: { cents: 1299, interval: "month" as const, trialDays: 0, name: "Sona — Monthly", desc: "At-home speech-practice games, built with a licensed SLP. Cancel anytime." },
  founding: { cents: 3999, interval: "year" as const, trialDays: 0, name: "Sona — Founding Member (Yearly)", desc: "Sona founding membership — your child's at-home speech-practice games, built with a licensed SLP. Locks in the founding price for life." },
  lifetime: { cents: 14999, interval: null, trialDays: 0, name: "Sona — Lifetime (Founding Families)", desc: "One payment, Sona forever — every game, every future sound and update. A founding-families offer while Sona is in beta." },
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
  let plan: keyof typeof PLANS = "founding";
  try {
    const b = await req.json();
    email = typeof b?.email === "string" ? b.email.trim() : undefined;
    if (b?.plan === "annual" || b?.plan === "monthly" || b?.plan === "founding" || b?.plan === "lifetime") plan = b.plan;
  } catch {
    // no body — fine; Checkout will collect the email
  }
  const P = PLANS[plan];

  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    new URL(req.url).origin;

  // Optional per-plan Price IDs; without them, inline price_data just works.
  // ANNUAL79: renamed on the $79.99 beta reprice so a stale $69.99 Price ID in
  // the env can't silently override the new price. Inline price_data is fine.
  const priceId = {
    annual: process.env.STRIPE_PRICE_ID_ANNUAL79,
    monthly: process.env.STRIPE_PRICE_ID_MONTHLY,
    founding: process.env.STRIPE_PRICE_ID_ANNUAL,
    lifetime: process.env.STRIPE_PRICE_ID_LIFETIME,
  }[plan];
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: P.cents,
            // lifetime is a ONE-TIME payment — no recurring block
            ...(P.interval ? { recurring: { interval: P.interval } } : {}),
            product_data: { name: P.name, description: P.desc },
          },
        },
      ];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: P.interval ? "subscription" : "payment",
      line_items,
      ...(P.trialDays > 0 ? { subscription_data: { trial_period_days: P.trialDays } } : {}),
      customer_email: email,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
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
 * GET /api/checkout?plan=annual — plain-link checkout for landing-page CTAs
 * (no client JS): creates the session and 303s straight to Stripe.
 */
export async function GET(req: NextRequest) {
  const plan = new URL(req.url).searchParams.get("plan") || "annual";
  const proxied = new NextRequest(req.url, { method: "POST", headers: req.headers, body: JSON.stringify({ plan }) });
  const res = await POST(proxied);
  const j = (await res.json()) as { ok?: boolean; url?: string };
  if (j?.ok && j.url) return NextResponse.redirect(j.url, 303);
  // cold ad traffic must land back on the marketing page — subscribe.html is
  // parent-gated and would bounce a fresh visitor into the app's first-run flow
  return NextResponse.redirect(new URL("/?checkout=failed", req.url), 303);
}
