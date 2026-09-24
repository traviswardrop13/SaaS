import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { rateLimit } from "@/lib/rateLimit";
import { CASELOAD_PLAN } from "@/lib/caseload";

/**
 * Returns whether an email has bought Sona. Stripe is the source of truth, so
 * we don't need our own database to gate access for the MVP — the app calls
 * this to decide if a returning user is paid.
 *
 * Sona sells ONE subscription; the price and trial length live in
 * /api/checkout and lib/pricing.ts and are deliberately not restated here, so
 * this file cannot drift out of date with them. We honour any active or
 * trialing subscription — including the retired $9.99 monthly ones people
 * still hold, because retiring a plan removed it from the PURCHASE path, not
 * from the people billed on it.
 *
 * THERE IS NO LIFETIME PRODUCT (Travis, 19 Sep 2026). This route used to scan
 * Checkout Sessions for a one-time purchase and answer kind: "lifetime". No
 * such product exists anywhere in this codebase — /api/checkout has never sold
 * one — so the scan could only ever match something bought outside the app,
 * and its original form matched paid SUBSCRIPTION sessions too, which is how a
 * cancelled subscriber restored permanent access. Access now comes from one
 * place: a live subscription, which is the only thing that can expire.
 *
 * If a genuine one-time purchase ever does surface in Stripe, it is a support
 * task — grant it through the founder or pilot path — not a branch here.
 *
 * SECURITY (interim): knowing a buyer's email is currently enough to unlock a
 * new device (review item F7). Rate-limited here to stop email enumeration /
 * Stripe-call abuse; a proper emailed one-time restore code is the real fix and
 * is queued for review.
 *
 * NOT THE CLINICIAN'S PLAN (24 Sep 2026). A clinician who bought "Sona
 * Premium for your caseload" holds a live subscription under their own
 * email, and that plan covers the families who join through their link —
 * not whichever device types that email into Restore. Their own phone has
 * its own door (a work email, or the founder's approval, via /api/slp/self);
 * restore-by-email must not be a way around it. Skipped by its metadata,
 * the stamp /api/slp/plan puts on every caseload subscription — never by
 * price or billing period, which is how a family's plan is told apart from
 * nothing at all.
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
    // A live subscription, and nothing else. Interval-agnostic on
    // purpose — retiring the monthly plan removed it from the PURCHASE path,
    // not from the people still billed on it, and a `month` subscriber who
    // reinstalls must still come back paid.
    const customers = await stripe.customers.list({ email, limit: 10 });
    for (const c of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: c.id,
        status: "all",
        limit: 10,
      });
      const active = subs.data.some(
        (s) => s.metadata?.plan !== CASELOAD_PLAN && (s.status === "active" || s.status === "trialing"),
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
