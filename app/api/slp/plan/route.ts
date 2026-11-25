import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { readSession, liveSession, kvConfigured, kvCmd } from "@/lib/slpAuth";
import { tellCrm } from "@/lib/slpLead";
import { rateLimit } from "@/lib/rateLimit";
import {
  planStatus, selfStatus, proStatus, clinicStatus, beforeProSale, dashboardOpen, alsoRenews, activateFromSession, readAcct, readPlan, grandfathered, StoreUnavailable, clinicOn,
  PRO_CENTS, PRO_PRICE, PRO_PER, PRO_INTERVAL, PRO_TRIAL_DAYS, PRO_PLAN, PRO_NAME,
  BF_PRICE, BF_MONTHS, BF_OFFER, bfOn, ensureBfCoupon,
  CLINIC_CENTS, CLINIC_PRICE, CLINIC_PER, CLINIC_INTERVAL, CLINIC_TRIAL_DAYS, CLINIC_PLAN, CLINIC_NAME, CLINIC_SEATS,
} from "@/lib/caseload";

/**
 * THE TWO CLINICIAN PLANS ON SALE (lib/caseload says who is covered and why):
 *  - SONA PRO (Travis, 12 Nov 2026): $19.99 a month for the dashboard, every
 *    game on the clinician's own phone, and every game for every family on
 *    their link.
 *  - SONA CLINIC (Travis, 17 Nov 2026): $99 a month, everything Sona Pro
 *    gives for every clinician the owner adds (up to CLINIC_SEATS, the owner
 *    included), and the owner's view of them (/api/slp/team). HIDDEN since
 *    18 Nov 2026 (lib/caseload CLINIC_ON): while it is off, GET offers no
 *    Clinic and names no price (`clinic.on` false), and POST refuses a
 *    Clinic checkout and creates nothing.
 * Both with a 14-day free trial, card up front, and ONE trial per clinician
 * across the two (lib/caseload proStatus).
 *
 *   GET  /api/slp/plan[?session=cs_…] → where this clinician stands: the
 *        caseload at the top level (as before), their own Premium in `self`,
 *        Sona Pro in `pro`, Sona Clinic in `clinic`, and whether the
 *        dashboard is open.
 *   POST /api/slp/plan { plan: "pro" | "clinic" } → a Stripe Checkout link.
 *        The two yearly plans sold until 12 Nov 2026 ("self", "caseload", or
 *        no `plan` from a page cached before 29 Sep) are refused with
 *        `retired: true`: a stale page showing $59.99 a year must not open a
 *        checkout for a different price. Anyone already holding one keeps it.
 *        A Sona Pro holder may buy Sona Clinic (upgrading): Stripe cannot
 *        switch one for the other on the billing page, so it is a second
 *        subscription on the same customer, and the page tells them to
 *        cancel Sona Pro in Manage billing once Sona Clinic is on — the
 *        precedent the yearly holders set.
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
 * Web only, like every buy button a clinician sees: the clinicians' iPhone
 * app hides every price, offer and checkout door (data-sells, SLPAPP1) and
 * opens no checkout by itself (TRIALGO1 is the browser's), so this never
 * meets Apple's rules on in-app purchases.
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
        // TELL GOHIGHLEVEL ABOUT A NEW SONA PRO (Travis, 17 Nov 2026: trials
        // and new customers into the CRM). Once per subscription (SET NX), so
        // a reload or "Check again" never sends it twice; awaited with
        // tellCrm's own fuse, and a CRM hiccup never changes this answer.
        if (got.activated && got.kind === "pro" && got.subId) {
          const plan = got.status === "trialing" ? "trial" : "paid";
          const first = await kvCmd(["SET", "slpcrm-pro:" + got.subId, plan, "NX", "EX", 31536000]).catch(() => null);
          if (first === "OK") await tellCrm(new URL(req.url).origin, s.email, "sona-pro", "", {}, plan);
        }
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
    const clinic = await clinicStatus(s.email);
    const open = await dashboardOpen(s.email, { acct });
    // An older plan that still renews beside the one now on (18 Nov 2026):
    // Settings tells the clinician to cancel it, so they don't pay for both.
    const also = await alsoRenews(s.email, { acct, pro, clinic });
    // Who added a member, for "Your clinic's plan covers you": the owner's
    // own display name and practice name, never their email. The dates and
    // status in the block are the owner's plan's, because that plan is what
    // covers the member (a cancelled one ends their families' every game on
    // that date too).
    let who: { ownerName?: string; practiceName?: string } = {};
    if (clinic.role === "member") {
      const o = await readAcct(clinic.owner);
      who = { ownerName: String((o && o.name) || "").slice(0, 80), practiceName: String((o && o.clinic) || "").slice(0, 80) };
    }
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
        // AND own phone are already on some other way (free as promised, a
        // retired yearly plan still renewing, or a Sona Clinic plan): the
        // page sells them nothing.
        offer: !pro.active && !clinic.active && !(plan.active && self.active),
      },
      clinic: clinicOn()
        ? {
            on: true,
            name: CLINIC_NAME, price: CLINIC_PRICE, per: CLINIC_PER, trialDays: CLINIC_TRIAL_DAYS, seats: CLINIC_SEATS,
            role: clinic.role, active: clinic.active, status: clinic.status, trialEnd: clinic.trialEnd,
            periodEnd: clinic.periodEnd, cancelAtPeriodEnd: clinic.cancelAtPeriodEnd,
            // The one trial is for either plan: the same answer as Pro's.
            trialAvailable: pro.trialAvailable,
            ...who,
            // Offered to anyone it does not already cover, a Sona Pro holder
            // included (upgrading) — and a clinician covered free as promised,
            // since what it adds is their colleagues.
            offer: !clinic.active,
          }
        // HIDDEN (18 Nov 2026, lib/caseload CLINIC_ON): never offered, and no
        // price, seats or trial to print. A Clinic plan that somehow exists
        // is still reported (its role, its dates and, only then, its name),
        // because it still covers whoever it covers.
        : {
            on: false, offer: false,
            role: clinic.role, active: clinic.active, status: clinic.status, trialEnd: clinic.trialEnd,
            periodEnd: clinic.periodEnd, cancelAtPeriodEnd: clinic.cancelAtPeriodEnd,
            ...(clinic.role ? { name: CLINIC_NAME, ...who } : {}),
          },
      dashboard: { open },
      alsoRenews: also,
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

  let body: { plan?: unknown; back?: unknown } = {};
  try { body = (await req.json()) || {}; } catch { body = {}; }
  // RETIRED (12 Nov 2026). Only Sona Pro and (17 Nov 2026) Sona Clinic are
  // sold. A tab opened before then still shows "$59.99 a year" on its
  // buttons; the checkout it would open must not be a monthly price the
  // clinician never read.
  const kind = body && body.plan === "pro" ? "pro" : body && body.plan === "clinic" ? "clinic" : null;
  if (!kind) {
    return NextResponse.json({
      ok: false, retired: true,
      error: "Sona's plans for speech therapists have changed. Reload this page to see " + PRO_NAME + (clinicOn() ? " and " + CLINIC_NAME : "") + ".",
    }, { status: 409 });
  }
  // SONA CLINIC IS HIDDEN (Travis, 18 Nov 2026: "hide it for now"; lib/
  // caseload CLINIC_ON). Asked for anyway (a page cached while it was on
  // sale, a hand-made request), it is refused before Stripe or the store is
  // asked anything, and nothing is created.
  if (kind === "clinic" && !clinicOn()) {
    return NextResponse.json({ ok: false, unavailable: true, error: CLINIC_NAME + " isn't available right now." }, { status: 409 });
  }
  // What this checkout sells, from lib/caseload: the same constants every
  // surface prints, so a page and its checkout cannot disagree.
  const offer = kind === "clinic"
    ? {
        plan: CLINIC_PLAN, name: CLINIC_NAME, cents: CLINIC_CENTS, price: CLINIC_PRICE, per: CLINIC_PER, interval: CLINIC_INTERVAL,
        trialDays: CLINIC_TRIAL_DAYS, priceId: process.env.STRIPE_PRICE_ID_SLP_CLINIC,
        description: "Everything in " + PRO_NAME + " for every clinician at your practice, up to " + CLINIC_SEATS + " including you, and your clinic view. Renews monthly; cancel anytime.",
        keeps: "your clinicians and their families keep every game to the end of the month you paid for.",
      }
    : {
        plan: PRO_PLAN, name: PRO_NAME, cents: PRO_CENTS, price: PRO_PRICE, per: PRO_PER, interval: PRO_INTERVAL,
        trialDays: PRO_TRIAL_DAYS, priceId: process.env.STRIPE_PRICE_ID_SLP_PRO,
        description: "Your Sona dashboard, every game on your own phone or tablet, and every game for every family who joins through your link. Renews monthly; cancel anytime.",
        keeps: "your families keep every game to the end of the month you paid for.",
      };

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
  let upgrading = false;
  try {
    acct = await readAcct(s.email);
    const pro = await proStatus(s.email, { stripe, force: true });
    if (kind === "pro") {
      if (pro.active) {
        return NextResponse.json({ ok: false, already: true, error: PRO_NAME + " is already on." }, { status: 409 });
      }
      // PAID FOR EVERYONE (Travis, 25 Nov 2026: "no just make it paid for
      // everyone", of /plans telling his own early account "already free,
      // as promised"). An account promised a free dashboard, or still on a
      // yearly plan, may buy Sona Pro like anyone else: nothing it already
      // has is taken away, and Settings tells a yearly holder to cancel the
      // older plan (alsoRenews). Only a live Sona Pro, and a Sona Clinic
      // that already covers this clinician, are never sold over.
      const { clinic } = await beforeProSale(s.email, { stripe, acct });
      if (clinic.active) {
        return NextResponse.json({
          ok: false, already: true,
          error: "Your " + CLINIC_NAME + " plan already includes everything " + PRO_NAME + " does.",
        }, { status: 409 });
      }
    } else {
      // Sona Clinic: never twice, and never over a clinic that already
      // covers them. A clinician on someone else's clinic leaves it first
      // (their dashboard says how); a Pro holder may upgrade.
      const clinic = await clinicStatus(s.email, { stripe, force: true });
      if (clinic.active && clinic.role === "owner") {
        return NextResponse.json({ ok: false, already: true, error: CLINIC_NAME + " is already on." }, { status: 409 });
      }
      if (clinic.active && clinic.role === "member") {
        const o = await readAcct(clinic.owner);
        const name = String((o && o.name) || "").trim().slice(0, 80);
        return NextResponse.json({
          ok: false, already: true,
          error: "You're on " + (name ? name + "'s" : "your clinic's") + " " + CLINIC_NAME + " plan.",
        }, { status: 409 });
      }
      upgrading = pro.active;
    }
    trial = pro.trialAvailable;
    // The same Stripe customer as any plan they already hold, so Manage
    // billing shows everything they pay for on one page. Read from the
    // stored mirrors only (the forced checks above wrote any plan they
    // found): asking Stripe here would cache a "no plan" the moment before
    // the clinician pays, which is the race NEGATIVE_MS is about.
    for (const k of ["pro", "clinic", "self", "caseload"] as const) {
      const m = await readPlan(s.email, undefined, k);
      if (m && m.customer) { customer = m.customer; break; }
    }
  } catch (e) {
    if (e instanceof StoreUnavailable) return storeDown();
    throw e;
  }

  // BLACK FRIDAY (BF1, lib/caseload): a Sona Pro checkout opened before the
  // end carries the coupon, $9.99 for the first three months, whoever opens
  // it and from whichever page, and NO free trial (Travis: "but no free
  // trial on the promo"): charged today. If Stripe will not give the coupon,
  // the checkout is the ordinary one (the trial, if they have it) and its
  // words below say so.
  let bfCoupon = "";
  if (kind === "pro" && bfOn()) {
    try { bfCoupon = await ensureBfCoupon(stripe); }
    catch (e) { console.error("[slp plan] the Black Friday coupon is unavailable:", e instanceof Error ? e.message : String(e)); }
  }
  if (bfCoupon) trial = false;

  const origin = originOf(req);
  // A fixed Stripe Price when one is configured (so the Stripe dashboard's
  // product reporting lines up); otherwise the amount from lib/caseload, the
  // same constant every surface prints. Each plan its own variable
  // (STRIPE_PRICE_ID_SLP_PRO, STRIPE_PRICE_ID_SLP_CLINIC): neither of the
  // retired plans' Price ids can ever be charged under this page.
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = offer.priceId
    ? [{ price: offer.priceId, quantity: 1 }]
    : [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: offer.cents,
          recurring: { interval: offer.interval },
          product_data: { name: offer.name, description: offer.description },
        },
      }];
  // The stamps lib/caseload reads, on the session (for activation) AND on
  // the subscription (for the re-check and the search recovery). For Sona
  // Clinic `slp` is the OWNER, the clinician paying. Never a `tier`:
  // lib/charter counts `tier: charter` subscriptions as the fifty FAMILY
  // spots, and neither plan is one.
  const metadata: Record<string, string> = { plan: offer.plan, slp: s.email, ...(bfCoupon ? { offer: BF_OFFER } : {}) };
  const code = String((acct && acct.code) || "");
  // WHAT THE CLINICIAN AGREES TO, said beside the button they press (an
  // automatic renewal after a free trial is the thing a state's renewal law
  // asks to be spelled out at the point of purchase). Stripe prints the
  // dates; this says the terms in the same words /plans and the Terms use.
  // With the Black Friday coupon (never with a trial), its three months first.
  const bfThen = BF_PRICE + " a month for your first " + BF_MONTHS + " months (Black Friday), then ";
  const terms = trial
    ? "No charge today. Your free trial lasts " + offer.trialDays + " days; after that, " + offer.price + " " + offer.per + " until you cancel. Cancel before the trial ends and you pay nothing."
    : bfCoupon
      ? bfThen + offer.price + " " + offer.per + ". Charged today and every month until you cancel. Cancel anytime: " + offer.keeps
      : offer.price + " " + offer.per + ", charged today and every month until you cancel. Cancel anytime: " + offer.keeps;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items,
      // A 14-DAY FREE TRIAL, ONCE (Travis, 12 Nov 2026), card up front: a
      // new clinician has not seen the dashboard yet, and fourteen days is
      // time to send a few families home and watch them practice. A trial
      // that ends with no card on file cancels rather than lingering. Once
      // per clinician across both plans (17 Nov 2026): `trial` is proStatus'
      // answer, which counts a Sona Clinic subscription too.
      subscription_data: trial
        ? { metadata, trial_period_days: offer.trialDays, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } }
        : { metadata },
      payment_method_collection: "always",
      custom_text: { submit: { message: terms } },
      metadata,
      ...(customer ? { customer } : { customer_email: s.email }),
      client_reference_id: code || s.email,
      // Stripe takes a coupon or a box for codes, never both.
      ...(bfCoupon ? { discounts: [{ coupon: bfCoupon }] } : { allow_promotion_codes: true }),
      billing_address_collection: "auto",
      success_url: `${origin}/slp.html?plan_session={CHECKOUT_SESSION_ID}#premium`,
      // From /plans (BUYNOW1, 25 Nov 2026: the plan buttons open Stripe
      // straight away), Cancel goes back to /plans, never the dashboard.
      cancel_url: body.back === "plans" ? `${origin}/plans#pricing` : `${origin}/slp.html#premium`,
    });
    // `cancelPro`: they hold Sona Pro and are buying Sona Clinic. The page
    // says to cancel Sona Pro in Manage billing once Sona Clinic is on.
    return NextResponse.json({ ok: true, url: session.url, ...(upgrading ? { cancelPro: true } : {}) });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Checkout failed." }, { status: 502 });
  }
}
