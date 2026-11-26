import Stripe from "stripe";
import { kvCmd } from "@/lib/slpAuth";
import { PRO_PLAN, planKey } from "@/lib/caseload";

/**
 * A SONA PRO BOUGHT ON /plans WITH NO EMAIL GETS ITS OWNER FROM STRIPE
 * (Travis, 26 Nov 2026: "Remove the email entry on the checkout page").
 *
 * /plans now opens Stripe without an email (unless the visitor typed one at
 * the opt-in), so the checkout's subscription carries `from: plans` and no
 * `slp`. Once Stripe has the email its page asked for, it is written onto
 * the subscription as `slp`, exactly as /api/slp/checkout stamps a checkout
 * that had one, and everything after (the dashboard, coverage, the sign-in
 * email) reads it the same way. Two doors call this, whichever comes first,
 * and the same stamp written twice is harmless:
 *   - the page Stripe returns to (/api/slp/checkout/done), with the email
 *     from the checkout session (`customer_details.email`);
 *   - Stripe's webhook, with the email on the Stripe customer.
 *
 * Answers the owner's email; "" when this is not such a subscription or no
 * usable email exists (nothing to unlock); undefined when Stripe did not
 * answer (the caller tries again). A subscription already stamped is never
 * changed: its `slp` is answered as it is.
 */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function plansUnclaimed(md: Record<string, string> | null | undefined): boolean {
  const m = md || {};
  return (m.from === "plans" || m.source === "plans") && m.plan === PRO_PLAN && !String(m.slp || "").trim();
}

function usable(e: unknown): string {
  const s = typeof e === "string" ? e.trim().toLowerCase() : "";
  return s.length <= 254 && EMAIL.test(s) ? s : "";
}

export async function claimPlansSub(
  stripe: Stripe, sub: Stripe.Subscription, email?: unknown,
  kv: (cmd: (string | number)[]) => Promise<unknown> = kvCmd,
): Promise<string | undefined> {
  const md = sub.metadata || {};
  if (!plansUnclaimed(md)) return md.from === "plans" || md.source === "plans" ? usable(md.slp) : "";
  try {
    let who = usable(email);
    if (!who) {
      const c = sub.customer as unknown;
      if (c && typeof c === "object" && "email" in (c as object)) who = usable((c as { email?: unknown }).email);
      else if (typeof c === "string" && c) {
        const cust = await stripe.customers.retrieve(c);
        if (!("deleted" in cust && cust.deleted)) who = usable((cust as Stripe.Customer).email);
      }
    }
    if (!who) return "";
    // Stripe merges metadata keys, so the rest of the stamp stays.
    await stripe.subscriptions.update(sub.id, { metadata: { slp: who } });
    sub.metadata = { ...md, slp: who };
    // The dashboard may have cached "no plan" for this address a moment ago.
    try { await kv(["DEL", planKey(who, "pro")]); } catch { /* a minute at most */ }
    return who;
  } catch (e) {
    console.error("[plans claim] could not stamp a /plans subscription:", e instanceof Error ? e.message : String(e));
    return undefined;
  }
}
