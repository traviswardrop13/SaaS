import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Returns whether an email has bought Sona. Stripe is the source of truth, so
 * we don't need our own database to gate access for the MVP — the app calls
 * this to decide if a returning user is paid.
 *
 * Sona sells ONE subscription; the price and trial length live in
 * /api/checkout and lib/pricing.ts and are deliberately not restated here, so
 * this file cannot drift out of date with them. We honour any active or
 * trialing subscription — including the retired $9.99 monthly ones people
 * still hold — and ALSO genuine one-time purchases: the brief
 * lifetime-pricing window sold a handful, and a subscription-only lookup
 * would strand every one of those buyers. Neither check may be dropped
 * without stranding real, paying customers.
 *
 * SECURITY (interim): knowing a buyer's email is currently enough to unlock a
 * new device (review item F7). Rate-limited here to stop email enumeration /
 * Stripe-call abuse; a proper emailed one-time restore code is the real fix and
 * is queued for review.
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
  const wanted = email.toLowerCase();

  // A paid Checkout Session is a receipt for something that happened ONCE. It
  // is not evidence of live access, and conflating the two was the bug here:
  // the lifetime block below returns immediately, before the subscription
  // lookup ever runs, so matching on payment_status alone let a subscription
  // checkout — which also leaves a "paid" session behind, forever — restore
  // full access to someone who cancelled months ago. The liveness check was
  // never reached.
  //
  // So: only a one-time purchase (Stripe mode "payment") may mean "lifetime".
  // mode "subscription" sessions are ignored here on purpose and decided in
  // (2) by current entitlement, which is the only thing that can expire.
  const isLifetimeBuy = (s: Stripe.Checkout.Session) =>
    s.mode === "payment" &&
    s.payment_status === "paid" &&
    (s.customer_details?.email || s.customer_email || "").toLowerCase() === wanted;

  // Walk a filtered session list newest-first. `pages` is a ceiling, not a
  // target — see the caller for why it stopped being reachable.
  const scanFor = async (filter: Stripe.Checkout.SessionListParams, pages: number) => {
    let page = await stripe.checkout.sessions.list({ ...filter, limit: 100 });
    for (let guard = 0; guard < pages; guard++) {
      if (page.data.some(isLifetimeBuy)) return true;
      if (!page.has_more || page.data.length === 0) return false;
      page = await stripe.checkout.sessions.list({
        ...filter,
        limit: 100,
        starting_after: page.data[page.data.length - 1].id,
      });
    }
    return false;
  };

  try {
    // 1) Genuine one-time purchases from the brief lifetime-pricing window.
    // Checkout Sessions carry the buyer's email in customer_details even when
    // no Customer was created, which is why this — not a customer lookup — is
    // the reliable path for them.
    //
    // Stripe does the email filtering (customer_details[email]), so we page
    // through ONE buyer's handful of sessions instead of the account's newest
    // 500. That old ceiling was a slow fuse: fine at launch, and as volume
    // grew it would quietly push real lifetime buyers off the end of the list
    // — access vanishing with no error and no deploy to blame it on.
    //
    // The filter is an exact string match and Checkout stores the address as
    // the buyer typed it, so a capitalised email gets a second look rather
    // than a wrong "no".
    const probes = email === wanted ? [email] : [email, wanted];
    let lifetime = false;
    try {
      for (const probe of probes) {
        if (await scanFor({ customer_details: { email: probe } }, 5)) {
          lifetime = true;
          break;
        }
      }
    } catch (e: unknown) {
      // If Stripe ever stops accepting that filter (an API-version bump, say),
      // fall back to the old account-wide walk rather than 502-ing a paying
      // family out of their own app. Same mode/payment checks either way.
      if (!(e instanceof Stripe.errors.StripeInvalidRequestError)) throw e;
      lifetime = await scanFor({}, 5);
    }
    if (lifetime) return NextResponse.json({ ok: true, active: true, kind: "lifetime" });

    // 2) The current product: a live subscription. Interval-agnostic on
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
        (s) => s.status === "active" || s.status === "trialing",
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
