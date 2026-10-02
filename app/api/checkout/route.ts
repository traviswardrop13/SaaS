import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { FREE_MODE } from "@/lib/pricing";
import { charterSpots, CHARTER_CENTS, STANDARD_CENTS, CHARTER_CAP, CHARTER_LABEL, MONTHLY_CENTS } from "@/lib/charter";

/**
 * Creates a Stripe Checkout Session for Sona.
 *
 * TWO offers (again, since 1 Oct 2026): the yearly plan with a 3-day free
 * trial at the charter or standard price, or $9.99 a month charged at
 * purchase with no trial — the trial is the yearly plan's perk. Only the
 * plan screen's POST can ask for monthly, and only by the exact word
 * "monthly"; everything else, and every plain GET link, is the yearly plan.
 * Existing subscribers keep renewing at their price — a Stripe subscription
 * carries its own price forever.
 *
 * Deliberately NOT reading the old STRIPE_PRICE_ID_ANNUAL79 env, and NOT
 * reading any env Price for monthly: a stale Price object in Vercel would
 * silently override this file's amounts. Monthly is inline price_data only.
 *
 * Needs env: STRIPE_SECRET_KEY (live). Optional: STRIPE_PRICE_ID_ANNUAL5999.
 */
export const runtime = "nodejs";

const TRIAL_DAYS = 3;
// TWO PLANS. Monthly ($9.99) was retired on 18 Sep 2026 and put back on sale
// on 1 Oct 2026 (Travis: "add to the paywall a $10 a month option ... that
// does not have a free trial. That's a pay today, but the $59.99 has a
// three-day trial"). This table is the PURCHASE path; /api/subscription goes
// on recognising every interval, so nobody's access depends on what is sold
// today.
const PLANS = {
  annual: {
    cents: 5999,
    interval: "year" as const,
    // What Stripe prints on its page and on the receipt. "Sona Premium" since
    // 1 Oct 2026, like every surface that sells it: it read "Sona — Yearly"
    // a week after the plan was renamed.
    name: "Sona Premium — Yearly",
    desc: "At-home speech-practice games, built with Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship. Every game, every sound, every update. 3 days free — cancel anytime.",
    env: "STRIPE_PRICE_ID_ANNUAL5999",
  },
  monthly: {
    cents: MONTHLY_CENTS,
    interval: "month" as const,
    name: "Sona Premium — Monthly",
    // No "free": this plan charges today. The words a parent reads on Stripe's
    // page must match what the plan screen told them.
    desc: "At-home speech-practice games, built with Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship. Every game, every sound, every update. Charged today, then every month — cancel anytime.",
  },
} as const;
// Monthly is sold only to someone who asked for it by name, on the plan
// screen, behind the grown-ups gate. Anything else — a missing plan, a typo,
// "month" from an August ad — is the yearly plan with its free days, because
// the one mistake this function must never make is charging someone today who
// expected three days free.
function pickPlan(v: unknown): keyof typeof PLANS {
  return v === "monthly" ? "monthly" : "annual";
}

export async function POST(req: NextRequest) {
  // Sona is free. Nothing here may take money — and the refusal lives on the
  // server because the buttons are not the only way in: a bookmark, a stale
  // tab or an old ad link reaches this endpoint directly.
  if (FREE_MODE) {
    return NextResponse.json(
      { ok: false, error: "Sona is free — there is nothing to buy." },
      { status: 410 },
    );
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Server is missing STRIPE_SECRET_KEY." },
      { status: 500 },
    );
  }
  const stripe = new Stripe(key);

  let email: string | undefined;
  let planKey: keyof typeof PLANS = "annual";
  try {
    const b = await req.json();
    email = typeof b?.email === "string" ? b.email.trim() : undefined;
    planKey = pickPlan(b?.plan);
  } catch {
    // no body — fine; Checkout will collect the email
  }
  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    new URL(req.url).origin;

  // MONTHLY NEVER TOUCHES THE CHARTER. The block below this one prices a sale
  // from the charter count, which is right for the yearly plan and would be a
  // disaster for this one: $59.99 or $99.99 charged every month. So monthly
  // has its own, shorter path — its own amount, a month interval, no trial
  // (Stripe then charges the first month at checkout), and no `tier` stamp,
  // on the subscription or the session: it is not one of the fifty, and its
  // buyer must never be told they got the charter price.
  if (planKey === "monthly") {
    const M = PLANS.monthly;
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: M.cents,
              recurring: { interval: M.interval },
              product_data: { name: M.name, description: M.desc },
            },
          },
        ],
        customer_email: email,
        allow_promotion_codes: true,
        billing_address_collection: "auto",
        success_url: `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}&plan=monthly`,
        cancel_url: `${origin}/subscribe.html?canceled=1`,
      });
      return NextResponse.json({ ok: true, url: session.url });
    } catch (e: unknown) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "Checkout failed." },
        { status: 502 },
      );
    }
  }

  const PLAN = PLANS.annual;
  const priceId = process.env[PLAN.env];
  // THE TIER IS DECIDED HERE, FROM THE REAL COUNT, at the moment of purchase.
  // Every price surface in the product says "$59.99 for the first 50 families,
  // then $99.99" — and this is the one line that makes that sentence true:
  // spot 51 is charged the standard price whatever any page happened to show.
  // The count is memoised for a minute and falls OPEN if Stripe cannot be
  // reached, so a lookup failure never costs a family $40.
  const spots = await charterSpots(stripe);
  const tier: "charter" | "standard" = spots.open ? "charter" : "standard";
  const cents = tier === "charter" ? CHARTER_CENTS : STANDARD_CENTS;
  const tierName = tier === "charter" ? `${PLAN.name} (${CHARTER_LABEL} price)` : PLAN.name;
  const tierDesc = tier === "charter"
    ? `${CHARTER_LABEL} price for the first ${CHARTER_CAP} families — yours for as long as you keep Sona. ` + PLAN.desc
    : PLAN.desc;
  // A fixed Stripe Price from the environment can only ever be the charter
  // price (that is the amount it was created with), so it is used only while
  // the charter is open; the standard tier is always inline price_data.
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = (priceId && tier === "charter")
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: cents,
            recurring: { interval: PLAN.interval },
            product_data: { name: tierName, description: tierDesc },
          },
        },
      ];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items,
      // the 3-day trial is the YEARLY plan's perk (monthly returned above).
      // metadata.tier on the SUBSCRIPTION is what lib/charter.ts counts: only
      // a charter-tier sale is one of the fifty — a standard-tier sale is not,
      // and neither is anything without the stamp (sold before the offer
      // existed, or monthly). On the session too, so the success page can say which.
      subscription_data: { trial_period_days: TRIAL_DAYS, metadata: { tier } },
      metadata: { tier },
      customer_email: email,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}&plan=annual&tier=${tier}`,
      cancel_url: `${origin}/subscribe.html?canceled=1`,
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Checkout failed." },
      { status: 502 },
    );
  }
}

/**
 * GET /api/checkout — plain-link checkout for landing-page CTAs (no client
 * JS): creates the session and 303s straight to Stripe. ALWAYS the yearly
 * plan, whatever ?plan= says. A link can be clicked by anyone, from an ad or
 * an email written in August, with no plan screen and no grown-ups gate in
 * front of it; the yearly plan charges nothing for three days, and monthly
 * charges on the spot. So monthly is sold by the plan screen's POST and by
 * nothing else — an old ?plan=monthly link still resolves, quietly, to yearly.
 */
export async function GET(req: NextRequest) {
  // A click on an old ad or a stale "Start 3 days free" link lands on the
  // marketing page, which now says the app is free — never on a Stripe form.
  if (FREE_MODE) return NextResponse.redirect(new URL("/", req.url), 303);
  const proxied = new NextRequest(req.url, { method: "POST", headers: req.headers, body: JSON.stringify({ plan: "annual" }) });
  const res = await POST(proxied);
  const j = (await res.json()) as { ok?: boolean; url?: string };
  if (j?.ok && j.url) return NextResponse.redirect(j.url, 303);
  // cold ad traffic must land back on the marketing page — subscribe.html is
  // parent-gated and would bounce a fresh visitor into the app's first-run flow
  return NextResponse.redirect(new URL("/?checkout=failed", req.url), 303);
}
