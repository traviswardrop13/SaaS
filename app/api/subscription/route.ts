import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Returns whether an email has bought Sona. Stripe is the source of truth, so
 * we don't need our own database to gate access for the MVP — the app calls
 * this to decide if a returning user is paid.
 *
 * Sona now sells ONE thing: a $79.99 one-time lifetime unlock (checkout runs in
 * mode:"payment"). That creates NO Subscription object, so a subscription-only
 * lookup could never return true for a real buyer — every lifetime customer who
 * cleared their browser or switched devices was told "no active subscription".
 * We therefore check paid one-time Checkout Sessions FIRST and keep the
 * subscription scan as a fallback for legacy annual/monthly customers.
 *
 * SECURITY (interim): knowing a buyer's email is currently enough to unlock a
 * new device (review item F7). Rate-limited here to stop email enumeration /
 * Stripe-call abuse; a proper emailed one-time restore code is the real fix and
 * is queued for review.
 *
 * GET /api/subscription?email=foo@bar.com  ->  { ok, active, kind? }
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, { key: "subscription-lookup", limit: 8, windowSec: 60 });
  if (limited) return limited;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Server is missing STRIPE_SECRET_KEY." },
      { status: 500 },
    );
  }
  const email = new URL(req.url).searchParams.get("email")?.trim();
  if (!email) {
    return NextResponse.json({ ok: false, error: "email is required" }, { status: 400 });
  }

  const stripe = new Stripe(key);
  try {
    // 1) The current product: a paid one-time purchase. Checkout Sessions carry
    // the buyer's email in customer_details even when no Customer was created,
    // which is why this scan — not a customer lookup — is the reliable path.
    const wanted = email.toLowerCase();
    let page = await stripe.checkout.sessions.list({ limit: 100 });
    for (let guard = 0; guard < 5; guard++) {
      for (const s of page.data) {
        if (s.payment_status !== "paid") continue;
        const got = (s.customer_details?.email || s.customer_email || "").toLowerCase();
        if (got && got === wanted) {
          return NextResponse.json({ ok: true, active: true, kind: "lifetime" });
        }
      }
      if (!page.has_more || page.data.length === 0) break;
      page = await stripe.checkout.sessions.list({
        limit: 100,
        starting_after: page.data[page.data.length - 1].id,
      });
    }

    // 2) Legacy annual/monthly subscribers from before the lifetime-only switch.
    const customers = await stripe.customers.list({ email, limit: 10 });
    for (const c of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: c.id,
        status: "all",
        limit: 10,
      });
      const active = subs.data.some(
        (s) => s.status === "active" || s.status === "trialing",
      );
      if (active) return NextResponse.json({ ok: true, active: true, kind: "subscription" });
    }
    return NextResponse.json({ ok: true, active: false });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Lookup failed." },
      { status: 502 },
    );
  }
}
