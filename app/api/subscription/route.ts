import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Returns whether an email has an active (or trialing) Sona subscription.
 * Stripe is the source of truth, so we don't need our own database to gate
 * access for the MVP — the app calls this to decide if a returning user is
 * paid. Later this can be backed by real accounts.
 *
 * SECURITY (interim): knowing a subscriber's email is currently enough to
 * unlock a new device (review item F7). Rate-limited here to stop email
 * enumeration / Stripe-call abuse; a proper emailed one-time restore code is
 * the real fix and is queued for review.
 *
 * GET /api/subscription?email=foo@bar.com  ->  { ok, active }
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
      if (active) return NextResponse.json({ ok: true, active: true });
    }
    return NextResponse.json({ ok: true, active: false });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Lookup failed." },
      { status: 502 },
    );
  }
}
