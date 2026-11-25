import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  kvCmd, kvConfigured, randomToken, hashToken, sendMagicEmail, signFreeDashboardSignup, authSecretOk,
} from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { foreignOrigin } from "@/lib/origin";
import { cleanRef } from "@/lib/referral";
import { safeAttrib } from "@/lib/slpLead";
import { linkOrigin } from "@/lib/site";
import {
  proStatus, readPlan, activateFromSession, StoreUnavailable,
  PRO_CENTS, PRO_PRICE, PRO_PER, PRO_INTERVAL, PRO_TRIAL_DAYS, PRO_PLAN, PRO_NAME,
  BF_PRICE, BF_MONTHS, BF_OFFER, bfOn, ensureBfCoupon,
} from "@/lib/caseload";

/**
 * BUY SONA PRO STRAIGHT FROM THE PLANS PAGE (BUYNOW1, Travis, 25 Nov 2026:
 * "the button on the purchase page goes to a Stripe checkout. Not the SLP
 * dashboard"). Until now /plans emailed a sign-in link and the dashboard
 * opened Stripe (TRIALGO1); a clinician from an ad had to leave for their
 * inbox before they could pay.
 *
 *  POST { email, ref?, attrib? } → { url }: a Stripe Checkout for Sona Pro,
 *    no sign-in first. The same offer /api/slp/plan sells (lib/caseload's
 *    figures; the Black Friday coupon and no trial while bfOn(), else the
 *    14-day trial once per clinician), stamped `plan: slp-pro, slp: <email>`
 *    so the dashboard finds it by that email (proStatus). The email is only
 *    who the plan is for: it opens nothing until its inbox signs in.
 *  GET ?session=cs_… → back from Stripe: the plan is stored only when Stripe
 *    says the session is ours and complete (activateFromSession, for the
 *    email Stripe holds, never one from the address bar), and the buyer is
 *    emailed ONE sign-in link (`slpbuymail:<session>`), which carries a
 *    referral code from the page in its signed pending sign-up.
 *
 * Never Sona Clinic (hidden, SLPSITE1). Refused when that email already has
 * Sona Pro, so nobody pays twice. 10 checkouts an hour per IP.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const SESSION_ID = /^cs_[A-Za-z0-9_]{10,240}$/;
const DAY = 86400;

function cleanEmail(raw: unknown): string {
  const e = String(raw || "").trim().toLowerCase();
  return e.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : "";
}

function origin(req: NextRequest): string {
  try { return new URL(req.url).origin; } catch { return "https://www.speaksona.com"; }
}

export async function POST(req: NextRequest) {
  if (foreignOrigin(req)) return NextResponse.json({ ok: false, error: "Bad request." }, { status: 403, headers: NO_STORE });
  const rl = await rateLimit(req, { key: "slpbuy", limit: 10, windowSec: 3600, v6prefix: true });
  if (rl) return rl;
  let body: { email?: unknown; ref?: unknown } = {};
  try { body = (await req.json()) || {}; } catch { body = {}; }
  const email = cleanEmail(body.email);
  if (!email) return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400, headers: NO_STORE });
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "Checkout isn't available right now. Try again soon." }, { status: 503, headers: NO_STORE });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "Server is missing STRIPE_SECRET_KEY." }, { status: 500, headers: NO_STORE });
  const stripe = new Stripe(key);

  // Asked of Stripe afresh: one Sona Pro per email, and the trial only on
  // Stripe's own word that this address never had one.
  let trial = false;
  let customer = "";
  try {
    const pro = await proStatus(email, { stripe, force: true });
    if (pro.active) {
      return NextResponse.json({
        ok: false, already: true,
        error: PRO_NAME + " is already on for that email. Sign in to your dashboard with it.",
      }, { status: 409, headers: NO_STORE });
    }
    trial = pro.trialAvailable;
    for (const k of ["pro", "clinic", "self", "caseload"] as const) {
      const m = await readPlan(email, undefined, k);
      if (m && m.customer) { customer = m.customer; break; }
    }
  } catch (e) {
    if (e instanceof StoreUnavailable) return NextResponse.json({ ok: false, error: "Couldn't start checkout just now. Try again in a moment." }, { status: 503, headers: NO_STORE });
    throw e;
  }

  // Black Friday (BF1): the coupon and no trial, exactly as /api/slp/plan.
  let bfCoupon = "";
  if (bfOn()) {
    try { bfCoupon = await ensureBfCoupon(stripe); }
    catch (e) { console.error("[slp buy] the Black Friday coupon is unavailable:", e instanceof Error ? e.message : String(e)); }
  }
  if (bfCoupon) trial = false;

  const priceId = process.env.STRIPE_PRICE_ID_SLP_PRO;
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [{
        quantity: 1,
        price_data: {
          currency: "usd", unit_amount: PRO_CENTS, recurring: { interval: PRO_INTERVAL },
          product_data: {
            name: PRO_NAME,
            description: "Your Sona dashboard, every game on your own phone or tablet, and every game for every family who joins through your link. Renews monthly; cancel anytime.",
          },
        },
      }];
  const ref = cleanRef(body.ref);
  const metadata: Record<string, string> = {
    plan: PRO_PLAN, slp: email, source: "plans",
    ...(bfCoupon ? { offer: BF_OFFER } : {}),
    ...(ref ? { ref } : {}),
  };
  const keeps = "your families keep every game to the end of the month you paid for.";
  const terms = trial
    ? "No charge today. Your free trial lasts " + PRO_TRIAL_DAYS + " days; after that, " + PRO_PRICE + " " + PRO_PER + " until you cancel. Cancel before the trial ends and you pay nothing."
    : bfCoupon
      ? BF_PRICE + " a month for your first " + BF_MONTHS + " months (Black Friday), then " + PRO_PRICE + " " + PRO_PER + ". Charged today and every month until you cancel. Cancel anytime: " + keeps
      : PRO_PRICE + " " + PRO_PER + ", charged today and every month until you cancel. Cancel anytime: " + keeps;
  const here = origin(req);
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items,
      subscription_data: trial
        ? { metadata, trial_period_days: PRO_TRIAL_DAYS, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } }
        : { metadata },
      payment_method_collection: "always",
      custom_text: { submit: { message: terms } },
      metadata,
      ...(customer ? { customer } : { customer_email: email }),
      client_reference_id: email,
      ...(bfCoupon ? { discounts: [{ coupon: bfCoupon }] } : { allow_promotion_codes: true }),
      billing_address_collection: "auto",
      success_url: `${here}/plans?bought={CHECKOUT_SESSION_ID}`,
      cancel_url: `${here}/plans#pricing`,
    });
    return NextResponse.json({ ok: true, url: session.url, trial, bf: !!bfCoupon }, { headers: NO_STORE });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Checkout failed." }, { status: 502, headers: NO_STORE });
  }
}

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, { key: "slpbuy-back", limit: 60, windowSec: 3600, v6prefix: true });
  if (rl) return rl;
  const sid = req.nextUrl.searchParams.get("session") || "";
  if (!SESSION_ID.test(sid)) return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400, headers: NO_STORE });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !kvConfigured()) return NextResponse.json({ ok: false, error: "Not available." }, { status: 503, headers: NO_STORE });
  const stripe = new Stripe(key);
  let email = "", trial = false, ref = "";
  try {
    const cs = await stripe.checkout.sessions.retrieve(sid);
    const md = cs.metadata || {};
    if (md.plan !== PRO_PLAN || md.source !== "plans") return NextResponse.json({ ok: false, error: "Not a Sona Pro checkout." }, { status: 404, headers: NO_STORE });
    email = cleanEmail(md.slp);
    ref = cleanRef(md.ref);
    if (!email) return NextResponse.json({ ok: false, error: "Not a Sona Pro checkout." }, { status: 404, headers: NO_STORE });
    if (cs.status !== "complete") return NextResponse.json({ ok: true, done: false }, { headers: NO_STORE });
    const got = await activateFromSession(email, sid, { stripe });
    trial = got.status === "trialing";
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Couldn't read your checkout. Sign in with your email to get started." }, { status: 502, headers: NO_STORE });
  }
  // One sign-in link per checkout: the inbox, not this page, opens the dashboard.
  let mailed = false;
  try {
    if (authSecretOk() && (await kvCmd(["SET", "slpbuymail:" + sid, "1", "NX", "EX", 30 * DAY])) === "OK") {
      const token = randomToken();
      const pending = signFreeDashboardSignup({ email, source: "plans-buy", attrib: safeAttrib({}), ...(ref ? { ref } : {}) });
      if ((await kvCmd(["SET", "slptok:" + hashToken(token), pending, "EX", 900])) === "OK") {
        const link = linkOrigin(origin(req)) + "/api/slp/auth/verify?token=" + encodeURIComponent(token);
        const res = await sendMagicEmail(email, link, "", { started: { name: PRO_NAME, trial } });
        mailed = res.sent;
        if (!res.sent) await kvCmd(["DEL", "slpbuymail:" + sid]);
      }
    }
  } catch { /* they can still sign in by email at /slp-login.html */ }
  // Only the domain is said back, never the whole address: a session id in
  // someone else's history tells them nothing.
  const at = email.slice(email.indexOf("@"));
  return NextResponse.json({ ok: true, done: true, mailed, trial, to: at }, { headers: NO_STORE });
}
