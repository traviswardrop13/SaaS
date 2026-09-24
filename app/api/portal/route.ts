import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { CASELOAD_PLAN } from "@/lib/caseload";

/**
 * Self-serve "Manage subscription" — turns a checkout session id into a Stripe
 * Billing Portal link where the buyer can cancel, change card, or see invoices
 * without emailing us. The honest cancel path the trial-reassurance study
 * demands: the success page promises "cancel anytime", and this is the button
 * that makes the promise real. Falls back gracefully client-side (mailto) if
 * the portal isn't configured on the Stripe account yet.
 *
 * POST { session_id } -> { ok, url }
 *
 * FAMILIES ONLY (24 Sep 2026). A clinician's caseload checkout returns to
 * slp.html?plan_session=cs_…, so that id sits in their address bar and their
 * browser history — and this route turns any session id into the keys to
 * its customer's billing, with no sign-in. A session stamped
 * metadata.plan "slp-caseload" is refused: a clinician manages their plan
 * from the dashboard (/api/slp/plan/portal), behind their own session.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: "Server is missing STRIPE_SECRET_KEY." }, { status: 500 });
  }
  let sid = "";
  try {
    const b = await req.json();
    sid = typeof b?.session_id === "string" ? b.session_id.trim() : "";
  } catch {
    // handled below
  }
  if (!/^cs_[A-Za-z0-9_]{10,240}$/.test(sid)) {
    return NextResponse.json({ ok: false, error: "Bad session id." }, { status: 400 });
  }

  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const stripe = new Stripe(key);
  try {
    const s = await stripe.checkout.sessions.retrieve(sid);
    if (s.metadata?.plan === CASELOAD_PLAN) {
      return NextResponse.json({ ok: false, error: "That's a clinician's plan — manage it from your Sona dashboard." }, { status: 403 });
    }
    const customer = typeof s.customer === "string" ? s.customer : s.customer?.id;
    if (!customer) return NextResponse.json({ ok: false, error: "No customer on session." }, { status: 404 });
    const portal = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${origin}/subscribe/success?session_id=${sid}`,
    });
    return NextResponse.json({ ok: true, url: portal.url });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Portal unavailable." },
      { status: 502 },
    );
  }
}
