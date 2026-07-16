import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * Read-back for the post-checkout confirmation page.
 *
 * GET /api/checkout/session?id=cs_…  ->  { ok, email, amountCents, interval,
 * trialEnd, periodEnd } — the real numbers off the Stripe subscription, so the
 * success page can show the LITERAL charge date ("First charge: $69.99 on
 * July 23") instead of a vague promise. The Mobbin trial-reassurance study
 * found the exact calendar date is the single most consistent trust element
 * (15 of 22 screens); this route is what makes it real data, not client math.
 *
 * The session id is the bearer secret here: it's high-entropy, only ever
 * handed to the buyer by Stripe's redirect, and the response contains only
 * their own purchase facts.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: "Server is missing STRIPE_SECRET_KEY." }, { status: 500 });
  }
  const id = (new URL(req.url).searchParams.get("id") || "").trim();
  if (!/^cs_[A-Za-z0-9_]{10,240}$/.test(id)) {
    return NextResponse.json({ ok: false, error: "Bad session id." }, { status: 400 });
  }

  const stripe = new Stripe(key);
  try {
    const s = await stripe.checkout.sessions.retrieve(id, { expand: ["subscription"] });
    const sub = (s.subscription && typeof s.subscription !== "string" ? s.subscription : null) as Stripe.Subscription | null;
    const item = sub?.items?.data?.[0];
    // current_period_end lives on the subscription in older API versions and on
    // the subscription item in newer ones — read both, prefer the item.
    const periodEnd =
      (item as unknown as { current_period_end?: number } | undefined)?.current_period_end ??
      (sub as unknown as { current_period_end?: number } | null)?.current_period_end ??
      null;
    return NextResponse.json({
      ok: true,
      email: s.customer_details?.email || s.customer_email || null,
      amountCents: item?.price?.unit_amount ?? s.amount_total ?? null,
      interval: item?.price?.recurring?.interval ?? null,
      trialEnd: sub?.trial_end ?? null,
      periodEnd,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
  }
}
