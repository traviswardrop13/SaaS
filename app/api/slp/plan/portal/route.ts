import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { readSession, kvConfigured } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { currentPlan, openCaseloadPortal, StoreUnavailable } from "@/lib/caseload";

/**
 * POST /api/slp/plan/portal → { ok, url }: Stripe's billing portal for the
 * clinician's own plan — cancel, change the card, see invoices — so "cancel
 * anytime" is a button and not an email to us.
 *
 * The customer comes from the plan mirror the signed-in account owns
 * (lib/caseload), never from the request: a portal link is the keys to
 * someone's billing. currentPlan() recovers a plan the dashboard never saw
 * activate (Stripe search) before answering "no plan".
 *
 * Opened under the caseload's OWN portal configuration (lib/caseload
 * openCaseloadPortal), whose cancel button cancels at the end of the paid
 * year — the written promise that families keep Premium until then rests on
 * that, not on the Stripe account's default settings.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  const rl = await rateLimit(req, { key: "slpplan-portal", limit: 20, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "Server is missing STRIPE_SECRET_KEY." }, { status: 500 });
  const stripe = new Stripe(key);

  let customer = "";
  try {
    const rec = await currentPlan(s.email, { stripe });
    customer = (rec && rec.customer) || "";
  } catch (e) {
    if (e instanceof StoreUnavailable) {
      return NextResponse.json({ ok: false, error: "Couldn't reach your plan just now — try again in a moment." }, { status: 503 });
    }
    throw e;
  }
  if (!customer) return NextResponse.json({ ok: false, error: "There's no plan on this account to manage." }, { status: 404 });

  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  try {
    const portal = await openCaseloadPortal(stripe, customer, `${origin}/slp.html#premium`);
    return NextResponse.json({ ok: true, url: portal.url });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Billing portal unavailable." }, { status: 502 });
  }
}
