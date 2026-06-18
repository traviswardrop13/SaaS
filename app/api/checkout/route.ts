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

const MONTHLY_CENTS = 450;  // $4.50/mo — unused while we preorder annual-only
const ANNUAL_CENTS = 3999;  // $39.99/yr founding price (67% off the $119.99 anchor)

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
  let plan = "monthly";
  try {
    const b = await req.json();
    email = typeof b?.email === "string" ? b.email.trim() : undefined;
    if (b?.plan === "annual") plan = "annual";
  } catch {
    // no body — fine; Checkout will collect the email
  }
  const annual = plan === "annual";

  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    new URL(req.url).origin;

  const priceId = annual ? process.env.STRIPE_PRICE_ID_ANNUAL : process.env.STRIPE_PRICE_ID;
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: annual ? ANNUAL_CENTS : MONTHLY_CENTS,
            recurring: { interval: annual ? "year" : "month" },
            product_data: {
              name: annual ? "Sona — Founding Member (Yearly)" : "Sona — Monthly",
              description:
                "Sona founding membership — your child's at-home speech-practice games, built with a licensed SLP. Locks in the founding price (67% off) for life.",
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
      // No free trial — this is a founder preorder; the 50%-off price IS the offer.
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Checkout failed." },
      { status: 502 },
    );
  }
}
