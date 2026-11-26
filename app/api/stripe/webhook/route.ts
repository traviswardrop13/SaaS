import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { kvCmd, kvConfigured, randomToken, hashToken, sendMagicEmail } from "@/lib/slpAuth";
import { proEventFor, ghlBody, ghlUrl, proProductIds, untaggedProSub } from "@/lib/stripeHook";
import { PRO_PLAN, PRO_NAME, planKey } from "@/lib/caseload";
import { linkOrigin } from "@/lib/site";
import { plansSignInMail } from "@/lib/plansMail";
import { claimPlansSub, plansUnclaimed } from "@/lib/plansClaim";

/**
 * STRIPE'S WEBHOOK (STRIPEHOOK1, 17 Nov 2026; lib/stripeHook.ts says what each
 * event means). Stripe posts here when a Sona Pro subscription starts,
 * changes, is charged or ends, and Sona passes the one line that matters to
 * GoHighLevel (LEAD_WEBHOOK_URL, the same Inbound Webhook /api/lead uses).
 *
 * Set up (Travis, once): Stripe › Developers › Webhooks › Add endpoint,
 * https://app.speaksona.com/api/stripe/webhook (APPHOST1), events
 * customer.subscription.created, customer.subscription.updated,
 * customer.subscription.deleted and invoice.paid; then its signing secret
 * (whsec_…) in Vercel as STRIPE_WEBHOOK_SECRET (to change it without a gap,
 * move the old one to STRIPE_WEBHOOK_SECRET_PREV first), and redeploy.
 *
 * Answers: 200 for anything dealt with or ignored on purpose; 400 for a
 * signature that does not check out; 503 when the secret is not set, the
 * store did not answer or GoHighLevel refused (Stripe tries again for up to
 * three days, so a retry can still land). Each event acts once (its id is
 * kept 14 days). Nothing about an event is logged, and no address ever is.
 */
export const runtime = "nodejs";

const MAX_BODY = 256 * 1024;
const DAY = 86400;

/** Founder health check: presence booleans only, never values. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "stripe-webhook", secret: secrets().length > 0, store: kvConfigured(), crm: !!process.env.LEAD_WEBHOOK_URL });
}

function secrets(): string[] {
  return [process.env.STRIPE_WEBHOOK_SECRET || "", process.env.STRIPE_WEBHOOK_SECRET_PREV || ""].filter((s) => s.startsWith("whsec_"));
}

const ok = (what: string) => NextResponse.json({ ok: true, [what === "sent" ? "sent" : "ignored"]: what === "sent" ? true : what });
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  const want = secrets();
  if (!want.length) return fail("Set STRIPE_WEBHOOK_SECRET (whsec_…) in Vercel, then redeploy.", 503);
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY) return fail("too large", 413);
  const raw = await req.text();
  if (raw.length > MAX_BODY) return fail("too large", 413);
  const sig = req.headers.get("stripe-signature") || "";
  if (!sig) return fail("no signature", 400);

  // Checking a signature needs no API key: any client will do.
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_unused");
  let evt: Stripe.Event | null = null;
  for (const secret of want) {
    try { evt = stripe.webhooks.constructEvent(raw, sig, secret); break; } catch { /* the next secret */ }
  }
  if (!evt) return fail("bad signature", 400);
  if (evt.livemode === false && process.env.VERCEL_ENV === "production" && process.env.STRIPE_WEBHOOK_TEST !== "1") return ok("test-mode");

  // GHLPRO1: a Sona Pro bought on the GoHighLevel checkout carries no Sona
  // metadata. Stamp it (the clinician's email from the Stripe customer), so
  // the dashboard, coverage and everything below read it as Sona Pro.
  let claimed = "";
  if ((evt.type === "customer.subscription.created" || evt.type === "customer.subscription.updated") &&
      untaggedProSub(evt.data.object, proProductIds())) {
    const r = await claimProSub(evt.data.object as Stripe.Subscription);
    if (r === undefined) return fail("stripe", 503);
    if (r) {
      claimed = r;
      const o = evt.data.object as Stripe.Subscription;
      o.metadata = { ...(o.metadata || {}), plan: PRO_PLAN, slp: r, source: "ghl" };
    }
  }
  if (claimed && evt.type === "customer.subscription.created") {
    await signInEmail(claimed, String((evt.data.object as Stripe.Subscription).id || ""), (evt.data.object as Stripe.Subscription).status === "trialing");
  }

  // A /plans checkout opened with no email (26 Nov 2026): stamp the owner
  // from the Stripe customer first, so everything below reads it.
  if ((evt.type === "customer.subscription.created" || evt.type === "customer.subscription.updated") &&
      plansUnclaimed((evt.data.object as Stripe.Subscription).metadata)) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return fail("stripe", 503);
    const r = await claimPlansSub(new Stripe(key, { httpClient: Stripe.createFetchHttpClient() }), evt.data.object as Stripe.Subscription);
    if (r === undefined) return fail("stripe", 503);
  }

  // BUYNOW1: a Sona Pro bought on /plans signed nobody in. Its return page
  // emails the sign-in link; this sends it for a buyer who closed Stripe
  // and never came back (lib/plansMail: one email, whichever comes first).
  // A send that did not go (or is still going, from the return page) is a
  // 503, so Stripe's retry sends it or finds it sent.
  // Only as the plan comes on: created already on, or updated from not on
  // (a card that needed a second step); never a renewal or other change.
  if (evt.type === "customer.subscription.created" || evt.type === "customer.subscription.updated") {
    const o = evt.data.object as Stripe.Subscription;
    const md = o.metadata || {};
    const who = String(md.slp || "").trim().toLowerCase();
    const on = (st: unknown) => st === "active" || st === "trialing";
    const prev = (evt.data as { previous_attributes?: { status?: unknown } }).previous_attributes;
    const cameOn = on(o.status) && (evt.type === "customer.subscription.created" || (!!prev && "status" in prev && !on(prev.status)));
    // (`source: plans` is the first cut of this flow, #317's /api/slp/buy.)
    if ((md.from === "plans" || md.source === "plans") && md.plan === PRO_PLAN && cameOn &&
        who.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(who)) {
      const mail = await plansSignInMail({ email: who, sub: String(o.id || ""), trial: o.status === "trialing", ref: md.ref, origin: linkOrigin("https://app.speaksona.com") });
      if (mail === "failed" || mail === "busy") return fail("mail", 503);
      // The checkout asked Stripe for this address a moment ago and may have
      // cached "no plan" (a minute at most): drop it, so the first sign-in
      // finds the plan.
      if (mail === "sent") await kvCmd(["DEL", planKey(who, "pro")]);
    }
  }

  const p = proEventFor(evt);
  if (!p) return ok("not-sona-pro");
  const hook = process.env.LEAD_WEBHOOK_URL;
  if (!hook) return ok("no-crm");
  if (!kvConfigured()) return fail("no data store", 503);

  // Once per event; and a start shares the checkout return's mark, so a
  // clinician whose return page already told GoHighLevel is not told twice.
  const evKey = "stripe:evt:" + evt.id;
  const startKey = p.event === "started" && p.sub ? "slpcrm-pro:" + p.sub : "";
  // kvCmd answers undefined when the store did not answer, null when NX lost.
  const mine = await kvCmd(["SET", evKey, "1", "NX", "EX", 14 * DAY]);
  if (mine === undefined) return fail("store", 503);
  if (mine !== "OK") return ok("duplicate");
  if (startKey) {
    const first = await kvCmd(["SET", startKey, p.plan, "NX", "EX", 365 * DAY]);
    if (first === undefined) { await kvCmd(["DEL", evKey]); return fail("store", 503); }
    if (first !== "OK") return ok("already-told");
  }

  const ctl = new AbortController();
  const fuse = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(ghlUrl(hook, p.email), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ghlBody(p, new Date().toISOString())),
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error("crm " + r.status);
  } catch (e) {
    // Give the marks back, so Stripe's retry sends it.
    await kvCmd(["DEL", evKey]);
    if (startKey) await kvCmd(["DEL", startKey]);
    console.error("[stripe webhook] GoHighLevel did not take the event:", e instanceof Error ? e.message : String(e));
    return fail("crm", 503);
  } finally {
    clearTimeout(fuse);
  }
  return ok("sent");
}

/**
 * Stamp a GoHighLevel-sold Sona Pro subscription with Sona's metadata.
 * Answers the clinician's email, "" when the customer has no usable email
 * (nothing to unlock), or undefined when Stripe did not answer (a 503, so
 * Stripe tries again). Safe to repeat: the same stamp is written again.
 */
async function claimProSub(sub: Stripe.Subscription): Promise<string | "" | undefined> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !sub.id) return undefined;
  const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
  try {
    let email = "";
    const c = sub.customer as unknown;
    if (c && typeof c === "object" && typeof (c as { email?: unknown }).email === "string") email = String((c as { email: string }).email);
    else if (typeof c === "string") {
      const cust = await stripe.customers.retrieve(c);
      if (!("deleted" in cust && cust.deleted)) email = String((cust as Stripe.Customer).email || "");
    }
    email = email.trim().toLowerCase();
    if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "";
    await stripe.subscriptions.update(sub.id, { metadata: { plan: PRO_PLAN, slp: email, source: "ghl" } });
    // The dashboard may have cached "no plan" a moment ago (a minute at most);
    // drop it so the clinician is let in on their first sign-in.
    await kvCmd(["DEL", planKey(email, "pro")]);
    return email;
  } catch (e) {
    console.error("[stripe webhook] could not claim a Sona Pro subscription:", e instanceof Error ? e.message : String(e));
    return undefined;
  }
}

/**
 * The GoHighLevel checkout signs nobody in, so the clinician is emailed a
 * sign-in link once per subscription (`slpghlmail:<sub>`). A failure never
 * fails the webhook: they can still sign in at /slp-login.html.
 */
async function signInEmail(email: string, sub: string, trial: boolean): Promise<void> {
  try {
    if (!sub || (await kvCmd(["SET", "slpghlmail:" + sub, "1", "NX", "EX", 30 * DAY])) !== "OK") return;
    const token = randomToken();
    if ((await kvCmd(["SET", "slptok:" + hashToken(token), email, "EX", 900])) !== "OK") return;
    const link = linkOrigin("https://app.speaksona.com") + "/api/slp/auth/verify?token=" + encodeURIComponent(token);
    await sendMagicEmail(email, link, "", { started: { name: PRO_NAME, trial } });
  } catch { /* they can still sign in by email at /slp-login.html */ }
}
