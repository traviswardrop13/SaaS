import { PRO_PLAN } from "@/lib/caseload";

/**
 * STRIPE TELLS GOHIGHLEVEL ABOUT SONA PRO (STRIPEHOOK1, Travis, 17 Nov 2026:
 * "add the stripe webhook too"). The dashboard's checkout return already
 * tells GoHighLevel when a clinician starts Sona Pro (app/api/slp/plan); this
 * covers what only Stripe sees afterwards: the trial turning into a payment,
 * each monthly charge, a cancel, a card that fails, the plan ending, and a
 * start whose return page never loaded.
 *
 * Only Sona Pro subscriptions (metadata.plan === PRO_PLAN). A family plan, a
 * retired yearly clinician plan or anything else answers null and is left
 * alone. The address is the clinician's own (metadata.slp, which checkout
 * stamps from the signed-in session), never a family's.
 */

export type ProEvent = {
  email: string;
  event: "started" | "converted" | "renewed" | "cancelled" | "resumed" | "payment-problem" | "ended";
  plan: "trial" | "paid" | "cancelled" | "payment-problem" | "ended";
  summary: string;
  sub: string;
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const email = (v: unknown): string => {
  const e = str(v).trim().toLowerCase();
  return e.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : "";
};

const SUMMARY: Record<ProEvent["event"], string> = {
  started: "Started Sona Pro",
  converted: "Sona Pro trial turned into a paid plan",
  renewed: "Sona Pro renewed",
  cancelled: "Cancelled Sona Pro (runs to the end of the period)",
  resumed: "Took back a Sona Pro cancel",
  "payment-problem": "Sona Pro payment failed",
  ended: "Sona Pro ended",
};

function proSub(sub: Obj): { email: string; id: string } | null {
  const md = obj(sub.metadata);
  if (md.plan !== PRO_PLAN) return null;
  const e = email(md.slp);
  return e ? { email: e, id: str(sub.id) } : null;
}

const make = (who: { email: string; id: string }, event: ProEvent["event"], plan: ProEvent["plan"]): ProEvent =>
  ({ email: who.email, event, plan, summary: SUMMARY[event], sub: who.id });

/** What a Stripe event means for GoHighLevel, or null for nothing to say. */
export function proEventFor(evt: unknown): ProEvent | null {
  const e = obj(evt);
  const type = str(e.type);
  const data = obj(e.data);
  const o = obj(data.object);
  const prev = obj(data.previous_attributes);

  if (type.startsWith("customer.subscription.")) {
    const who = proSub(o);
    if (!who) return null;
    const status = str(o.status);
    const cancelling = !!(o.cancel_at_period_end || o.cancel_at);
    if (type === "customer.subscription.created") {
      return make(who, "started", status === "trialing" ? "trial" : "paid");
    }
    if (type === "customer.subscription.deleted") return make(who, "ended", "ended");
    if (type !== "customer.subscription.updated") return null;
    // Stripe lists only the fields that changed in previous_attributes.
    if ("status" in prev && prev.status === "trialing" && status === "active") return make(who, "converted", "paid");
    if (("cancel_at_period_end" in prev || "cancel_at" in prev)) {
      const was = !!("cancel_at_period_end" in prev ? prev.cancel_at_period_end : o.cancel_at_period_end) ||
        !!("cancel_at" in prev ? prev.cancel_at : o.cancel_at);
      if (cancelling && !was) return make(who, "cancelled", "cancelled");
      if (!cancelling && was) return make(who, "resumed", status === "trialing" ? "trial" : "paid");
    }
    if ("status" in prev && prev.status !== status && (status === "past_due" || status === "unpaid")) {
      return make(who, "payment-problem", "payment-problem");
    }
    return null;
  }

  if (type === "invoice.paid") {
    // Only a monthly charge after the first: the first charge is the start
    // (or, after a trial, "converted" from the subscription's own update).
    if (str(o.billing_reason) !== "subscription_cycle") return null;
    if (!(Number(o.amount_paid) > 0)) return null;
    const md = obj(obj(o.subscription_details).metadata);
    const md2 = obj(obj(obj(o.parent).subscription_details).metadata);
    const meta = md.plan ? md : md2;
    const subId = str(o.subscription) || str(obj(obj(o.parent).subscription_details).subscription);
    const who = proSub({ metadata: meta, id: subId });
    return who ? make(who, "renewed", "paid") : null;
  }
  return null;
}

/**
 * The body GoHighLevel's Inbound Webhook gets: the clinician's own email and
 * what happened, never a price, a card or anything about a family. The email
 * also rides in the address, as /api/lead's crmUrl does, because the
 * workflow reads it there.
 */
export function ghlBody(p: ProEvent, at: string): Record<string, string> {
  return { email: p.email, role: "slp", source: "sona-pro", event: p.event, plan: p.plan, summary: p.summary, at };
}

export function ghlUrl(base: string, emailAddr: string): string {
  return base + (base.includes("?") ? "&" : "?") + "email=" + encodeURIComponent(emailAddr);
}
