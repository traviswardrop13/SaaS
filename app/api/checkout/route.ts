import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * Creates a Stripe Checkout Session for the Sona subscription ($99/mo).
 *
 * Charging on the web (Stripe) instead of in-app keeps ~97% of revenue vs.
 * Apple's cut. Uses an inline price ($99/mo) by default so no Stripe dashboard
 * setup is required to test; set STRIPE_PRICE_ID to use a real Price object.
 *
 * Needs env: STRIPE_SECRET_KEY (test or live). Optional: STRIPE_PRICE_ID.
 */
export const runtime = "nodejs";

const PRICE_CENTS = 9900; // $99.00 / month

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

  const priceId = process.env.STRIPE_PRICE_ID;
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: PRICE_CENTS,
            recurring: { interval: "month" },
            product_data: {
              name: "Sona — Premium",
              description:
                "Your child's at-home speech coach. Live coaching sessions, personalized plan, and parent progress.",
            },
          },
        },
      ];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items,
      customer_email: email,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/subscribe?canceled=1`,
      subscription_data: {
        // a few days to try; remove or tune as you like
        trial_period_days: 7,
      },
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Checkout failed." },
      { status: 502 },
    );
  }
}
