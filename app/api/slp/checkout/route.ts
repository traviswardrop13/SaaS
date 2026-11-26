import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { kvConfigured, kvCmd } from "@/lib/slpAuth";
import { tellCrm, safeAttrib } from "@/lib/slpLead";
import { rateLimit } from "@/lib/rateLimit";
import { foreignOrigin } from "@/lib/origin";
import { cleanRef } from "@/lib/referral";
import {
  beforeProSale, proStatus, readAcct, readPlan, StoreUnavailable,
  PRO_CENTS, PRO_PRICE, PRO_PER, PRO_INTERVAL, PRO_TRIAL_DAYS, PRO_PLAN, PRO_NAME,
  BF_PRICE, BF_MONTHS, BF_OFFER, bfOn, ensureBfCoupon,
} from "@/lib/caseload";

/**
 * STRAIGHT TO STRIPE FROM /plans (BUYNOW1, Travis, 25 Nov 2026: "the Get
 * Black Friday price button, along with Get Sona Pro for $9.99, needs to go
 * to like a Stripe checkout, not the SLP dashboard").
 *
 *   POST /api/slp/checkout { email, ref?, source?, attrib? } → { ok, url }
 *
 * A visitor who is NOT signed in types their email on /plans and goes
 * straight to Stripe's checkout for Sona Pro: no sign-in email first, no
 * dashboard on the way. (A signed-in visitor uses /api/slp/plan, as the
 * dashboard does.) The subscription is stamped for that email exactly as
 * /api/slp/plan stamps one (`plan: slp-pro`, `slp: <email>`), so the
 * dashboard finds it on the clinician's first sign-in; /api/slp/checkout/done
 * emails that sign-in link once Stripe says the checkout is complete.
 *
 * What did not change: the dashboard still opens only for whoever proves the
 * inbox (the sign-in link or code), so typing someone else's email buys
 * them a plan and opens nothing for the buyer. The email is not proved
 * before payment: a typo is a paid plan nobody can sign in to until support
 * moves it (Stripe's page shows the email above the button). That is the
 * trade Travis chose for a shorter way to pay.
 *
 * Sona Pro only (Sona Clinic is hidden, lib/caseload CLINIC_ON). Every figure
 * and every check is /api/slp/plan's Sona Pro branch, from the same
 * constants: never sold twice, one free trial per clinician (Stripe's own
 * word), the Black Friday coupon until its end with no trial, the terms
 * beside Stripe's button. Keep the two in step.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const NO_STORE = { "Cache-Control": "no-store" };

function reply(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  if (foreignOrigin(req)) return reply({ ok: false, error: "Open this from speaksona.com." }, 403);
  const rl = await rateLimit(req, { key: "slpcheckout", limit: 12, windowSec: 3600, v6prefix: true });
  if (rl) return rl;
  if (!kvConfigured()) return reply({ ok: false, error: "no data store connected" }, 503);
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return reply({ ok: false, error: "Server is missing STRIPE_SECRET_KEY." }, 500);

  let body: { email?: unknown; plan?: unknown; ref?: unknown; source?: unknown; attrib?: unknown } = {};
  try { body = (await req.json()) || {}; } catch { body = {}; }
  // Sona Pro only: anything else is bought signed in, from the dashboard's
  // own checkout (/api/slp/plan), which knows the buyer.
  if (body.plan !== undefined && body.plan !== "pro") return reply({ ok: false, unavailable: true, error: "Sign in to your Sona dashboard to buy this plan." }, 409);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL.test(email)) return reply({ ok: false, error: "Enter a valid email." }, 400);
  // One address, a few checkouts an hour: a page left open and pressed
  // again is fine, a script running through addresses is not.
  try {
    const n = await kvCmd(["EVAL", "local n=redis.call('INCR',KEYS[1]) if n==1 then redis.call('EXPIRE',KEYS[1],3600) end return n", 1, "slpcheckout:" + email]);
    if (typeof n === "number" && n > 6) return reply({ ok: false, error: "Too many tries. Try again in an hour." }, 429);
  } catch { /* the IP limit still holds */ }

  const stripe = new Stripe(key);
  let customer = "";
  let trial = false;
  try {
    const acct = await readAcct(email);
    // Asked of Stripe afresh (force), as /api/slp/plan does: never a second
    // Sona Pro, and the trial only on Stripe's word that this address never
    // had one.
    const pro = await proStatus(email, { stripe, force: true });
    if (pro.active) {
      return reply({ ok: false, already: true, error: PRO_NAME + " is already on for that email. Sign in to open your dashboard." }, 409);
    }
    // Paid for everyone (Travis, 25 Nov 2026), as /api/slp/plan: an account
    // promised a free dashboard, or on a yearly plan, may buy Sona Pro too.
    // Only a Sona Clinic that already covers this address is never sold over.
    const { clinic } = await beforeProSale(email, { stripe, acct });
    if (clinic.active) {
      return reply({ ok: false, already: true, error: "That email is on a Sona Clinic plan, which already includes " + PRO_NAME + ". Sign in to open your dashboard." }, 409);
    }
    trial = pro.trialAvailable;
    for (const k of ["pro", "clinic", "self", "caseload"] as const) {
      const m = await readPlan(email, undefined, k);
      if (m && m.customer) { customer = m.customer; break; }
    }
  } catch (e) {
    if (e instanceof StoreUnavailable) return reply({ ok: false, error: "Couldn't open checkout just now. Try again in a moment." }, 503);
    throw e;
  }

  // BLACK FRIDAY (BF1): the coupon until the end, and no free trial.
  let bfCoupon = "";
  if (bfOn()) {
    try { bfCoupon = await ensureBfCoupon(stripe); }
    catch (e) { console.error("[slp checkout] the Black Friday coupon is unavailable:", e instanceof Error ? e.message : String(e)); }
  }
  if (bfCoupon) trial = false;

  const origin = new URL(req.url).origin;
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
  // `from: plans` tells /api/slp/checkout/done and Stripe's webhook that this
  // checkout signed nobody in, so either may email the sign-in link
  // (lib/plansMail). A referral code (Share & earn) rides on the checkout
  // and the subscription until that email's sign-in makes the account.
  const ref = cleanRef(body.ref);
  const metadata: Record<string, string> = { plan: PRO_PLAN, slp: email, from: "plans", ...(bfCoupon ? { offer: BF_OFFER } : {}), ...(ref ? { ref } : {}) };
  const keeps = "your families keep every game to the end of the month you paid for.";
  const terms = trial
    ? "No charge today. Your free trial lasts " + PRO_TRIAL_DAYS + " days; after that, " + PRO_PRICE + " " + PRO_PER + " until you cancel. Cancel before the trial ends and you pay nothing."
    : bfCoupon
      ? BF_PRICE + " a month for your first " + BF_MONTHS + " months (Black Friday), then " + PRO_PRICE + " " + PRO_PER + ". Charged today and every month until you cancel. Cancel anytime: " + keeps
      : PRO_PRICE + " " + PRO_PER + ", charged today and every month until you cancel. Cancel anytime: " + keeps;

  let url = "";
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
      success_url: `${origin}/plans?paid={CHECKOUT_SESSION_ID}#pricing`,
      cancel_url: `${origin}/plans#pricing`,
    });
    url = session.url || "";
  } catch (e: unknown) {
    return reply({ ok: false, error: e instanceof Error ? e.message : "Checkout failed." }, 502);
  }
  if (!url) return reply({ ok: false, error: "Checkout failed." }, 502);

  // THE LEAD (as the sign-up form's was): the email list hears of a
  // clinician who opened checkout, once a year an address. Never blocks.
  try {
    if (typeof (await kvCmd(["GET", "slpcrm:" + email])) !== "string") {
      // Always "plans-checkout" (the ad's own tags ride in attrib): /api/lead
      // sends no Black Friday email to a lead with this source, since a buyer
      // is never sent the deal they are paying for that minute (#317).
      const source = "plans-checkout";
      if (await tellCrm(origin, email, source, "", safeAttrib(body.attrib))) await kvCmd(["SET", "slpcrm:" + email, new Date().toISOString(), "EX", 31536000]);
    }
  } catch { /* the checkout is open either way */ }

  return reply({ ok: true, url, trial });
}
