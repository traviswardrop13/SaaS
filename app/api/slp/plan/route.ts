import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { readSession, kvConfigured } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import {
  planStatus, selfStatus, activateFromSession, readAcct, readPlan, StoreUnavailable,
  CASELOAD_CENTS, CASELOAD_PRICE, CASELOAD_PER_MONTH, CASELOAD_PLAN, CASELOAD_NAME, CASELOAD_ADDON,
  SELF_CENTS, SELF_PRICE, SELF_PER_MONTH, SELF_PLAN, SELF_NAME, BOTH_PRICE, BOTH_PER_MONTH,
} from "@/lib/caseload";

/**
 * THE CLINICIAN'S TWO PLANS (lib/caseload says who is covered and why):
 * "Sona Premium for you", $59.99 a year, and "Sona Premium for your
 * caseload", $59.99 a year more, sold only on top of the first.
 *
 *   GET  /api/slp/plan[?session=cs_…] → where this clinician stands: the
 *        caseload at the top level (as before), their own Premium in `self`.
 *   POST /api/slp/plan { plan: "self" | "caseload" } → a Stripe Checkout
 *        link to buy one. No `plan` means the caseload, which is what a page
 *        cached from before 29 Sep 2026 is asking for.
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
    const acct = await readAcct(s.email);
    const plan = await planStatus(s.email, { acct });
    const self = await selfStatus(s.email, { acct });
    return NextResponse.json({
      ok: true,
      active: plan.active,
      source: plan.source,
      periodEnd: plan.periodEnd,
      cancelAtPeriodEnd: plan.cancelAtPeriodEnd,
      price: CASELOAD_PRICE,
      perMonth: CASELOAD_PER_MONTH,
      // `eligible` keeps its old meaning for the page: "may this clinician
      // email themselves an own-phone link right now".
      self: { ...self, eligible: self.active, price: SELF_PRICE, perMonth: SELF_PER_MONTH },
      both: { price: BOTH_PRICE, perMonth: BOTH_PER_MONTH },
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
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  const rl = await rateLimit(req, { key: "slpplan", limit: 20, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "Server is missing STRIPE_SECRET_KEY." }, { status: 500 });
  const stripe = new Stripe(key);

  let body: { plan?: unknown } = {};
  try { body = (await req.json()) || {}; } catch { body = {}; }
  if (body.plan !== undefined && body.plan !== "self" && body.plan !== "caseload") {
    return NextResponse.json({ ok: false, error: "Which plan?" }, { status: 400 });
  }
  const kind: "self" | "caseload" = body.plan === "self" ? "self" : "caseload";

  // Asked of Stripe afresh (force), not the ten-minute mirror: a clinician
  // who paid in another tab a minute ago must not be sold a second year.
  let acct: Record<string, unknown> | null;
  let customer = "";
  try {
    acct = await readAcct(s.email);
    const self = await selfStatus(s.email, { stripe, acct, force: true });
    if (kind === "self") {
      if (self.active) {
        return NextResponse.json({
          ok: false, already: true,
          error: self.source === "grandfathered" || self.source === "work-email"
            ? "Your own Premium is already on, free, as promised when you signed up."
            : "Your own Premium is already on.",
        }, { status: 409 });
      }
    } else {
      const plan = await planStatus(s.email, { stripe, acct, force: true });
      if (plan.active) {
        return NextResponse.json({
          ok: false, already: true,
          error: plan.source === "grandfathered"
            ? "Your caseload is already covered, free, as promised when you signed up."
            : "Your caseload is already covered.",
        }, { status: 409 });
      }
      // THE ADD-ON NEEDS THE ACCOUNT (Travis, 29 Sep 2026: "they're going to
      // still pay the 60 bucks for an account, and they can pay an extra 60
      // bucks a year for all of their caseload"). Checked here, not only on
      // the page, so a stale tab cannot buy the caseload alone.
      if (!self.active) {
        return NextResponse.json({
          ok: false, needSelf: true,
          error: "Your caseload is added to your own Premium. Get Premium for you first, then add your caseload.",
        }, { status: 409 });
      }
    }
    // The same Stripe customer for both plans, where one exists, so Manage
    // billing shows the clinician everything they pay for on one page. Read
    // from the stored mirrors only (the forced checks above wrote any plan
    // they found): asking Stripe here would cache a "no plan" the moment
    // before the clinician pays, which is the race NEGATIVE_MS is about.
    const other = await readPlan(s.email, undefined, kind === "self" ? "caseload" : "self");
    const mine = await readPlan(s.email, undefined, kind);
    customer = (other && other.customer) || (mine && mine.customer) || "";
  } catch (e) {
    if (e instanceof StoreUnavailable) return storeDown();
    throw e;
  }

  const origin = originOf(req);
  // A fixed Stripe Price when one is configured (so the Stripe dashboard's
  // product reporting lines up); otherwise the amount from lib/caseload, the
  // same constant every surface prints. The caseload's variable is NEW
  // (…_ADDON) on 29 Sep 2026: the old STRIPE_PRICE_ID_SLP_CASELOAD may name a
  // $79.99 Price, and reading it would charge that under a $59.99 page.
  const priceId = kind === "self" ? process.env.STRIPE_PRICE_ID_SLP_SELF : process.env.STRIPE_PRICE_ID_SLP_CASELOAD_ADDON;
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: kind === "self" ? SELF_CENTS : CASELOAD_CENTS,
          recurring: { interval: "year" },
          product_data: kind === "self"
            ? {
                name: SELF_NAME,
                description: "Every game, every sound, on your own phone or tablet. Renews yearly; cancel anytime.",
              }
            : {
                name: CASELOAD_NAME,
                description: "Premium for every family who joins Sona through your link: every game, every sound. Renews yearly; cancel anytime.",
              },
        },
      }];
  // The stamps lib/caseload reads, on the session (for activation) AND on
  // the subscription (for the re-check and the search recovery). A caseload
  // sold from 29 Sep carries `addon`, so it never switches on the
  // clinician's own phone the way the older $79.99 plan did. Never a `tier`:
  // lib/charter counts `tier: charter` subscriptions as the fifty FAMILY
  // spots, and neither of these is one.
  const metadata: Record<string, string> = kind === "self"
    ? { plan: SELF_PLAN, slp: s.email }
    : { plan: CASELOAD_PLAN, slp: s.email, addon: CASELOAD_ADDON };
  const code = String((acct && acct.code) || "");

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items,
      // No trial (Travis, 24 Sep 2026): a clinician buying has already used
      // the free dashboard and watched families practice.
      subscription_data: { metadata },
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
