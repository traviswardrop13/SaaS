import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { readSession, liveSession, kvConfigured } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import {
  planStatus, selfStatus, proStatus, dashboardOpen, activateFromSession, readAcct, readPlan, grandfathered, StoreUnavailable,
  PRO_CENTS, PRO_PRICE, PRO_PER, PRO_INTERVAL, PRO_TRIAL_DAYS, PRO_PLAN, PRO_NAME,
} from "@/lib/caseload";

/**
 * SONA PRO, THE ONE CLINICIAN PLAN ON SALE (Travis, 12 Nov 2026; lib/caseload
 * says who is covered and why): $19.99 a month for the dashboard, every game
 * on the clinician's own phone, and every game for every family on their
 * link, with a 14-day free trial the first time.
 *
 *   GET  /api/slp/plan[?session=cs_…] → where this clinician stands: the
 *        caseload at the top level (as before), their own Premium in `self`,
 *        Sona Pro in `pro`, and whether the dashboard is open.
 *   POST /api/slp/plan { plan: "pro" } → a Stripe Checkout link for Sona Pro.
 *        The two yearly plans sold until 12 Nov 2026 ("self", "caseload", or
 *        no `plan` from a page cached before 29 Sep) are refused with
 *        `retired: true`: a stale page showing $59.99 a year must not open a
 *        checkout for a different price. Anyone already holding one keeps it.
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
  const s = await liveSession(readSession(req));
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
  let activatedPlan: string | undefined;
  let retry = false;
  if (sid) {
    activated = false;
    if (SESSION_ID.test(sid)) {
      try {
        const got = await activateFromSession(s.email, sid);
        activated = got.activated;
        if (got.activated) activatedPlan = got.kind;
      } catch (e) {
        retry = true;
        console.error("[slp plan] could not read the checkout session:", e instanceof Error ? e.message : String(e));
      }
    }
  }

  try {
    // One after the other, not together: the own-Premium answer reads the
    // caseload mirror too, and asked second it finds it fresh instead of
    // sending Stripe the same search twice.
    // Pro first, so the two answers after it find its mirror fresh.
    const acct = await readAcct(s.email);
    const pro = await proStatus(s.email);
    const plan = await planStatus(s.email, { acct });
    const self = await selfStatus(s.email, { acct });
    const open = await dashboardOpen(s.email, { acct });
    return NextResponse.json({
      ok: true,
      active: plan.active,
      source: plan.source,
      periodEnd: plan.periodEnd,
      cancelAtPeriodEnd: plan.cancelAtPeriodEnd,
      // `eligible` keeps its old meaning for the page: "may this clinician
      // email themselves an own-phone link right now".
      self: { ...self, eligible: self.active },
      pro: {
        ...pro,
        name: PRO_NAME, price: PRO_PRICE, per: PRO_PER, trialDays: PRO_TRIAL_DAYS,
        // Is there anything Pro would add? Not for a clinician whose caseload
        // AND own phone are already on some other way (free as promised, or
        // a retired yearly plan still renewing): the page sells them nothing.
        offer: !pro.active && !(plan.active && self.active),
      },
      dashboard: { open },
      grandfathered: grandfathered(acct),
      ...(sid ? { activated } : {}),
      ...(activatedPlan ? { activatedPlan } : {}),
      ...(retry ? { retry: true } : {}),
    }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof StoreUnavailable) return storeDown();
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const s = await liveSession(readSession(req));
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  const rl = await rateLimit(req, { key: "slpplan", limit: 20, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "Server is missing STRIPE_SECRET_KEY." }, { status: 500 });
  const stripe = new Stripe(key);

  let body: { plan?: unknown } = {};
  try { body = (await req.json()) || {}; } catch { body = {}; }
  // RETIRED (12 Nov 2026). Only Sona Pro is sold. A tab opened before then
  // still shows "$59.99 a year" on its buttons; the checkout it would open
  // must not be a monthly price the clinician never read.
  if (body.plan !== "pro") {
    return NextResponse.json({
      ok: false, retired: true,
      error: "Sona's plan for speech therapists has changed. Reload this page to see " + PRO_NAME + ".",
    }, { status: 409 });
  }

  // Asked of Stripe afresh (force), not the ten-minute mirror: a clinician
  // who started Pro in another tab a minute ago must not be sold a second
  // one, and the trial is given only on Stripe's own word that this address
  // never had one. Every check here is forced, the yearly plans' too: a
  // forced "no plan" is never remembered, and an unforced one would be — a
  // cached negative the moment before the clinician pays, the race
  // NEGATIVE_MS is about (caseloadtest plays it).
  let acct: Record<string, unknown> | null;
  let customer = "";
  let trial = false;
  try {
    acct = await readAcct(s.email);
    const pro = await proStatus(s.email, { stripe, force: true });
    if (pro.active) {
      return NextResponse.json({ ok: false, already: true, error: PRO_NAME + " is already on." }, { status: 409 });
    }
    const plan = await planStatus(s.email, { stripe, acct, force: true });
    const self = await selfStatus(s.email, { stripe, acct, force: true });
    if (plan.active && self.active) {
      return NextResponse.json({
        ok: false, already: true,
        error: plan.source === "grandfathered"
          ? "Your dashboard, your own phone and your caseload are already free, as promised when you signed up."
          : "You already have everything " + PRO_NAME + " includes.",
      }, { status: 409 });
    }
    trial = pro.trialAvailable;
    // The same Stripe customer as any plan they already hold, so Manage
    // billing shows everything they pay for on one page. Read from the
    // stored mirrors only (the forced checks above wrote any plan they
    // found): asking Stripe here would cache a "no plan" the moment before
    // the clinician pays, which is the race NEGATIVE_MS is about.
    for (const kind of ["pro", "self", "caseload"] as const) {
      const m = await readPlan(s.email, undefined, kind);
      if (m && m.customer) { customer = m.customer; break; }
    }
  } catch (e) {
    if (e instanceof StoreUnavailable) return storeDown();
    throw e;
  }

  const origin = originOf(req);
  // A fixed Stripe Price when one is configured (so the Stripe dashboard's
  // product reporting lines up); otherwise the amount from lib/caseload, the
  // same constant every surface prints. Its own variable: neither of the
  // retired plans' Price ids can ever be charged under this page.
  const priceId = process.env.STRIPE_PRICE_ID_SLP_PRO;
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: PRO_CENTS,
          recurring: { interval: PRO_INTERVAL },
          product_data: {
            name: PRO_NAME,
            description: "Your Sona dashboard, every game on your own phone or tablet, and every game for every family who joins through your link. Renews monthly; cancel anytime.",
          },
        },
      }];
  // The stamps lib/caseload reads, on the session (for activation) AND on
  // the subscription (for the re-check and the search recovery). Never a
  // `tier`: lib/charter counts `tier: charter` subscriptions as the fifty
  // FAMILY spots, and this is not one.
  const metadata: Record<string, string> = { plan: PRO_PLAN, slp: s.email };
  const code = String((acct && acct.code) || "");
  // WHAT THE CLINICIAN AGREES TO, said beside the button they press (an
  // automatic renewal after a free trial is the thing a state's renewal law
  // asks to be spelled out at the point of purchase). Stripe prints the
  // dates; this says the terms in the same words for-slps and the Terms use.
  const terms = trial
    ? "No charge today. Your free trial lasts " + PRO_TRIAL_DAYS + " days; after that, " + PRO_PRICE + " " + PRO_PER + " until you cancel. Cancel before the trial ends and you pay nothing."
    : PRO_PRICE + " " + PRO_PER + ", charged today and every month until you cancel. Cancel anytime: your families keep every game to the end of the month you paid for.";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items,
      // A 14-DAY FREE TRIAL, ONCE (Travis, 12 Nov 2026), card up front: a
      // new clinician has not seen the dashboard yet, and fourteen days is
      // time to send a few families home and watch them practice. A trial
      // that ends with no card on file cancels rather than lingering.
      subscription_data: trial
        ? { metadata, trial_period_days: PRO_TRIAL_DAYS, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } }
        : { metadata },
      payment_method_collection: "always",
      custom_text: { submit: { message: terms } },
      metadata,
      ...(customer ? { customer } : { customer_email: s.email }),
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
