import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { readSession, kvConfigured } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import {
  planStatus, activateFromSession, selfAccess, readAcct, StoreUnavailable,
  CASELOAD_CENTS, CASELOAD_PRICE, CASELOAD_PER_MONTH, CASELOAD_PLAN, CASELOAD_NAME,
} from "@/lib/caseload";

/**
 * THE CLINICIAN'S PLAN — "Sona Premium for your caseload", $79.99 a year
 * (lib/caseload says who is covered and why).
 *
 *   GET  /api/slp/plan[?session=cs_…] → where this clinician stands, and
 *        whether their own phone may have Premium (`self`).
 *   POST /api/slp/plan                → a Stripe Checkout link to buy it.
 *
 * Signed-in clinicians only; the email is the SESSION's, never the body's or
 * the URL's. The success redirect brings a Checkout Session id back on the
 * URL, and that id is only a question to ask Stripe: the plan is stored when
 * Stripe says the session is ours, finished, and bought by this clinician.
 *
 * DELIBERATELY NOT READING FREE_MODE. That switch is the FAMILY paywall —
 * whether a parent is asked for $59.99 — and it has flipped eleven times in
 * seven weeks. The caseload plan is a separate product sold to a clinician;
 * tying it to the family switch would make every flip silently open or shut
 * a clinician's checkout, which nobody would think to check.
 *
 * Web only, like every buy button a clinician sees: the dashboard never
 * renders inside the iOS app, so this never meets Apple's rules on in-app
 * purchases.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_ID = /^cs_[A-Za-z0-9_]{10,240}$/;
const NO_STORE = { "Cache-Control": "no-store" };

function originOf(req: NextRequest): string {
  return req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
}

function storeDown(): NextResponse {
  return NextResponse.json({ ok: false, error: "Couldn't check your plan just now — try again in a moment." }, { status: 503, headers: NO_STORE });
}

export async function GET(req: NextRequest) {
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  const rl = await rateLimit(req, { key: "slpplan-read", limit: 120, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });

  // The success redirect. Stored only if Stripe vouches for it (lib/caseload
  // activateFromSession); a refused or unreadable session stores nothing
  // and the answer below is simply what was already true.
  //
  // RETRYABLE (24 Sep 2026). Asking again with the same id is always safe —
  // activation stores the same mirror twice — and when Stripe could not be
  // READ (a blip, not a refusal) the answer says `retry: true`, so the
  // dashboard keeps the id and "Check again" asks Stripe about this session
  // directly instead of waiting on the search index. A refusal (another
  // clinician's session, a family's, an unfinished one) never says retry.
  const sid = (new URL(req.url).searchParams.get("session") || "").trim();
  let activated: boolean | undefined;
  let retry = false;
  if (sid) {
    activated = false;
    if (SESSION_ID.test(sid)) {
      try {
        activated = (await activateFromSession(s.email, sid)).activated;
      } catch (e) {
        retry = true;
        console.error("[slp plan] could not read the checkout session:", e instanceof Error ? e.message : String(e));
      }
    }
  }

  try {
    const [plan, self] = await Promise.all([planStatus(s.email), selfAccess(s.email)]);
    return NextResponse.json({
      ok: true,
      active: plan.active,
      source: plan.source,
      periodEnd: plan.periodEnd,
      cancelAtPeriodEnd: plan.cancelAtPeriodEnd,
      price: CASELOAD_PRICE,
      perMonth: CASELOAD_PER_MONTH,
      self,
      ...(sid ? { activated } : {}),
      ...(retry ? { retry: true } : {}),
    }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof StoreUnavailable) return storeDown();
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  const rl = await rateLimit(req, { key: "slpplan", limit: 20, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "Server is missing STRIPE_SECRET_KEY." }, { status: 500 });
  const stripe = new Stripe(key);

  // Asked of Stripe afresh (force), not the ten-minute mirror: a clinician
  // who paid in another tab a minute ago must not be sold a second year.
  let acct: Record<string, unknown> | null;
  try {
    acct = await readAcct(s.email);
    const plan = await planStatus(s.email, { stripe, acct, force: true });
    if (plan.active) {
      return NextResponse.json({
        ok: false, already: true,
        error: plan.source === "grandfathered"
          ? "Your caseload is already covered, free, as promised when you signed up."
          : "Your caseload is already covered.",
      }, { status: 409 });
    }
  } catch (e) {
    if (e instanceof StoreUnavailable) return storeDown();
    throw e;
  }

  const origin = originOf(req);
  // A fixed Stripe Price when one is configured (so the Stripe dashboard's
  // product reporting lines up); otherwise the amount from lib/caseload, the
  // same constant every surface prints.
  const priceId = process.env.STRIPE_PRICE_ID_SLP_CASELOAD;
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: CASELOAD_CENTS,
          recurring: { interval: "year" },
          product_data: {
            name: CASELOAD_NAME,
            description: "Premium for every family who joins Sona through your link: every game, every sound. Renews yearly; cancel anytime.",
          },
        },
      }];
  // The two stamps lib/caseload reads, on the session (for activation) AND
  // on the subscription (for the re-check and the search recovery). Never a
  // `tier`: lib/charter counts `tier: charter` subscriptions as the fifty
  // FAMILY spots, and this is not one of them.
  const metadata = { plan: CASELOAD_PLAN, slp: s.email };
  const code = String((acct && acct.code) || "");

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items,
      // No trial (Travis, 24 Sep 2026): a clinician buying for a caseload
      // has already used the free dashboard and watched families practice.
      subscription_data: { metadata },
      metadata,
      customer_email: s.email,
      client_reference_id: code || s.email,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${origin}/slp.html?plan_session={CHECKOUT_SESSION_ID}#premium`,
      cancel_url: `${origin}/slp.html#premium`,
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Checkout failed." }, { status: 502 });
  }
}
