import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { readSession, kvConfigured } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import {
  planStatus, activateFromSession, selfAccess, readAcct, dashboardOpen, freeDashboard, StoreUnavailable,
  PLANS, planId, CLINIC_SEATS, CASELOAD_PLAN, SOLO_PLAN, CLINIC_PLAN, type PlanId,
} from "@/lib/caseload";

/**
 * THE CLINICIAN'S PLAN — Solo ($19.99 a month) or Clinic ($99 a month), each
 * with a 14-day free trial, card up front (Travis, 17 Nov 2026; lib/caseload
 * says who is covered and why). The $79.99-a-year caseload plan is retired
 * from this route: its holders are still read as covered, nobody new buys it.
 *
 *   GET  /api/slp/plan[?session=cs_…] → where this clinician stands, whether
 *        the dashboard is open to them, the two offers, and whether their own
 *        phone may have Premium (`self`).
 *   POST /api/slp/plan { plan: "solo" | "clinic" } → a Stripe Checkout link.
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
    const acct = await readAcct(s.email);
    const [plan, self] = await Promise.all([planStatus(s.email, { acct }), selfAccess(s.email)]);
    const dashboard = await dashboardOpen(s.email, { acct, plan });
    const kind = plan.source !== "paid" ? null
      : plan.plan === CLINIC_PLAN ? "clinic" : plan.plan === SOLO_PLAN ? "solo" : plan.plan === CASELOAD_PLAN ? "caseload" : null;
    return NextResponse.json({
      ok: true,
      active: plan.active,
      source: plan.source,
      kind,                                   // which paid plan: "solo" | "clinic" | "caseload" (retired) | null
      trialing: !!plan.trialing,
      periodEnd: plan.periodEnd,
      cancelAtPeriodEnd: plan.cancelAtPeriodEnd,
      dashboard,                              // may this clinician use the dashboard right now
      freeDashboard: freeDashboard(acct),     // signed up when the dashboard was free: it stays free
      trialAvailable: !plan.hadPlan && plan.source !== "paid",
      plans: {
        solo: { name: PLANS.solo.name, price: PLANS.solo.price, trialDays: PLANS.solo.trialDays },
        clinic: { name: PLANS.clinic.name, price: PLANS.clinic.price, trialDays: PLANS.clinic.trialDays, seats: CLINIC_SEATS },
      },
      ...(plan.source === "clinic" ? { owner: plan.owner } : {}),
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

  let body: { plan?: unknown } = {};
  try { body = await req.json(); } catch { body = {}; }
  const want: PlanId | null = planId(body.plan);
  if (!want) return NextResponse.json({ ok: false, error: "Pick Solo or Clinic." }, { status: 400 });
  const offer = PLANS[want];

  // Asked of Stripe afresh (force), not the ten-minute mirror: a clinician
  // who paid in another tab a minute ago must not be sold a second plan.
  let acct: Record<string, unknown> | null;
  let trial = false;
  try {
    acct = await readAcct(s.email);
    const plan = await planStatus(s.email, { stripe, acct, force: true });
    if (plan.source === "paid") {
      // Moving between plans is a billing change Stripe has to prorate, and
      // until there is a button for it, a person does it by hand.
      return NextResponse.json({
        ok: false, already: true,
        error: "You already have a plan. To switch between Solo and Clinic, email hello@speaksona.com and we'll move it over — you won't pay twice.",
      }, { status: 409 });
    }
    if (plan.source === "clinic") {
      return NextResponse.json({ ok: false, already: true, error: "Your clinic's plan already covers you." }, { status: 409 });
    }
    // A grandfathered clinician's caseload is covered, free, forever — Solo
    // would sell them what they have. Clinic adds what they don't: colleagues.
    if (plan.source === "grandfathered" && want === "solo") {
      return NextResponse.json({
        ok: false, already: true,
        error: "Your caseload is already covered, free, as promised when you signed up.",
      }, { status: 409 });
    }
    // One trial per clinician: Stripe has never sold them a clinician plan.
    trial = !plan.hadPlan;
  } catch (e) {
    if (e instanceof StoreUnavailable) return storeDown();
    throw e;
  }

  const origin = originOf(req);
  // A fixed Stripe Price when one is configured (so the Stripe dashboard's
  // product reporting lines up); otherwise the amount from lib/caseload, the
  // same constant every surface prints.
  const priceId = want === "clinic" ? process.env.STRIPE_PRICE_ID_SLP_CLINIC : process.env.STRIPE_PRICE_ID_SLP_SOLO;
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: offer.cents,
          recurring: { interval: "month" },
          product_data: {
            name: offer.name,
            description: want === "clinic"
              ? `Every clinician at your practice (up to ${CLINIC_SEATS}) gets their own Sona dashboard, and every family they send home gets the full Sona app. Renews monthly; cancel anytime.`
              : "Your Sona dashboard, and the full Sona app for every family you send home. Renews monthly; cancel anytime.",
          },
        },
      }];
  // The two stamps lib/caseload reads, on the session (for activation) AND
  // on the subscription (for the re-check and the search recovery). Never a
  // `tier`: lib/charter counts `tier: charter` subscriptions as the fifty
  // FAMILY spots, and this is not one of them.
  const metadata = { plan: offer.stripePlan, slp: s.email };
  const code = String((acct && acct.code) || "");

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items,
      // 14 days free, card up front (Travis, 17 Nov 2026): Stripe takes the
      // card now and charges on day 15 unless they cancel first. The trial is
      // how a clinician tries the dashboard, which is no longer free; one per
      // clinician, so a lapsed plan restarts without one.
      subscription_data: trial
        ? { metadata, trial_period_days: offer.trialDays, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } }
        : { metadata },
      payment_method_collection: "always",
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
