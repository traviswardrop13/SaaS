import Stripe from "stripe";
import { kvCmd } from "@/lib/slpAuth";
import { isWorkEmail } from "@/lib/workEmail";

/**
 * SONA PREMIUM FOR YOUR CASELOAD — the clinician's plan (24 Sep 2026).
 *
 * $79.99 a year, bought on the web by the clinician, and every family who
 * joins through that clinician's link gets Premium — whether or not they say
 * "Yes, share progress", because access and sharing are separate promises.
 * The clinician earns nothing on their caseload, ever (CLAUDE.md: a
 * per-family payment to a clinician is a referral fee under several state
 * practice acts), and nothing here counts families toward anything a
 * clinician is paid.
 *
 * WHO IS COVERED, and the two ways in:
 *  - GRANDFATHERED. Clinicians who signed up before this build were promised
 *    "Free forever, unlimited families — for you and every kid on your
 *    caseload". They keep it. The rule is STRUCTURAL, not a date: every
 *    account created from this build on carries `terms: CASELOAD_TERMS`, so
 *    an account WITHOUT a `terms` field predates it. No clock to get wrong,
 *    no cut-off to argue about.
 *  - PAID. A live Stripe subscription stamped `plan: slp-caseload` and
 *    `slp: <clinician email>`. Stripe keeps a cancelled-at-period-end
 *    subscription `active` until the year that was paid for runs out, which
 *    is exactly decision 5: families keep Premium to the end of the paid
 *    year, then drop to the free version. past_due counts too — that is the
 *    card-retry grace, and a declined renewal must not knock forty families
 *    off Premium the same afternoon.
 *
 * WHERE THE PAID STATE LIVES. `slpplan:<email>`, its own key — never on the
 * slpacct JSON, which two routes rewrite whole (a plan written there would
 * be erased by the next profile save), and never a key starting "slpacct:",
 * which lib/founder.ts scans as the list of clinician accounts. It is a
 * MIRROR of Stripe, re-read when it is ten minutes old; when Stripe cannot be
 * reached the last known answer stands, so a Stripe outage never takes
 * Premium away from a caseload that paid for it.
 *
 * NEVER A CHARTER SPOT. The subscription's metadata never carries a `tier`
 * key: lib/charter.ts counts `tier: charter` subscriptions as the fifty
 * family spots, and a clinician's plan is not a family's.
 */

export const CASELOAD_CENTS = 7999;
export const CASELOAD_PRICE = "$79.99";
// $79.99 / 12 = $6.6658. Never "$6.67 a month" (that is $80.04 a year) nor
// "$6.66" (a rounding a reader can check and catch) — the same rule that
// made the family price "under $5 a month".
export const CASELOAD_PER_MONTH = "under $7 a month";
export const CASELOAD_PLAN = "slp-caseload";            // Stripe metadata.plan, on the session AND the subscription
export const CASELOAD_TERMS = "caseload-2026-09";       // stamped on every NEW slpacct
export const CASELOAD_NAME = "Sona Premium for your caseload";
// A covered code may redeem up to 300 families; an uncovered one keeps the
// ordinary 60 (app/api/slp/redeem). Copy says "every family on your
// caseload", never "unlimited" — there is a number, and it is this one.
export const COVERED_REDEEM_CAP = 300;

/** Stripe statuses under which a caseload is covered. Everything else is not. */
export const COVERED_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "past_due"]);
/** How old the mirror may be before Stripe is asked again. */
export const RECHECK_MS = 10 * 60 * 1000;
/**
 * How long "Stripe has no plan for this clinician" is believed (24 Sep 2026).
 * A negative answer is the one most likely to be about to change — the
 * clinician may be paying in the other tab — and every family who asks while
 * it stands is told "not covered" and keeps that answer on the device for six
 * hours. Ten minutes of that, after a lost success redirect, was a paid
 * caseload told it was unpaid; a minute is a cache, not a verdict.
 */
export const NEGATIVE_MS = 60 * 1000;
/** A clinician-sent parent invite email: at most this many a day. */
export const PARENT_EMAILS_PER_DAY = 30;
/** The clinician's own-phone link: at most this many a day (each works once — so never "one phone" in copy). */
export const SELF_LINKS_PER_DAY = 3;
/** The own-phone link lives thirty days, and works once. */
export const SELF_TOKEN_TTL = 60 * 60 * 24 * 30;

export type Kv = (cmd: (string | number)[]) => Promise<unknown>;

export type PlanRecord = {
  sub: string;                 // "" when Stripe was asked and had nothing
  customer: string;
  status: string;              // Stripe's own word, or "none"
  periodEnd: number | null;    // unix seconds
  cancelAtPeriodEnd: boolean;
  checkedAt: number;           // ms — when Stripe last answered
};

export type PlanStatus = {
  active: boolean;
  source: "paid" | "grandfathered" | "none";
  periodEnd: number | null;
  cancelAtPeriodEnd: boolean;
};

export type SelfAccess = { eligible: boolean; workEmail: boolean; approved: boolean; requested: boolean };

/**
 * THE STORE DID NOT ANSWER. Distinct from "there is nothing there": kvCmd
 * returns null for a missing key and undefined when the store is
 * unreachable, and the difference is money. Read as "no account", a blip
 * would make a grandfathered clinician's forty families lose Premium on
 * their next check; read as "no plan", it would sell a covered clinician a
 * second subscription. Callers answer 503 instead, and a device that gets a
 * 503 keeps what it had.
 */
export class StoreUnavailable extends Error {
  constructor(what: string) {
    super("store unavailable: " + what);
    this.name = "StoreUnavailable";
  }
}

const norm = (email: unknown): string => String(email || "").trim().toLowerCase();

export function planKey(email: string): string { return "slpplan:" + norm(email); }
export function accessKey(email: string): string { return "slpaccess:" + norm(email); }
export function selfTokenKey(code: string, token: string): string { return "slpself:" + String(code || "").toLowerCase() + ":" + token; }

/** GET a JSON value: null when absent or unreadable, a throw when the store is down. */
async function readJson(key: string, kv: Kv): Promise<Record<string, unknown> | null> {
  const raw = await kv(["GET", key]);
  if (raw === undefined) throw new StoreUnavailable(key.split(":")[0]);
  if (raw === null || raw === "") return null;
  try {
    const v = JSON.parse(String(raw));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The clinician's account record, or null when there is none. Throws if the store is down. */
export async function readAcct(email: string, kv: Kv = kvCmd): Promise<Record<string, unknown> | null> {
  return readJson("slpacct:" + norm(email), kv);
}

/** The stored mirror as it stands — no Stripe call. Throws if the store is down. */
export async function readPlan(email: string, kv: Kv = kvCmd): Promise<PlanRecord | null> {
  return (await readJson(planKey(email), kv)) as PlanRecord | null;
}

/**
 * True when the account exists and carries no `terms` field — it was made
 * before this build, and was promised free forever for every family on the
 * caseload. A missing account is not grandfathered: there is nobody to have
 * promised anything to.
 */
export function grandfathered(acct: unknown): boolean {
  return !!acct && typeof acct === "object" && !Array.isArray(acct) &&
    !Object.prototype.hasOwnProperty.call(acct, "terms");
}

function stripeClient(given?: Stripe | null): Stripe | null {
  if (given) return given;
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

/** Is this subscription a caseload plan, sold to THIS clinician? */
export function isCaseloadFor(s: { metadata?: Record<string, string> | null } | null | undefined, email: string): boolean {
  const md = (s && s.metadata) || {};
  return md.plan === CASELOAD_PLAN && norm(md.slp) === norm(email) && !!norm(email);
}

/**
 * The mirror's shape, from a Stripe subscription. current_period_end moved
 * from the subscription to its items in newer API versions; read both and
 * prefer the item, as /api/checkout/session does.
 */
export function recordFromSubscription(s: Stripe.Subscription, now = Date.now()): PlanRecord {
  const item = s.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  const end = item?.current_period_end ?? (s as unknown as { current_period_end?: number }).current_period_end ?? null;
  const customer = typeof s.customer === "string" ? s.customer : (s.customer as { id?: string } | null)?.id || "";
  return {
    sub: String(s.id || ""),
    customer,
    status: String(s.status || "none"),
    periodEnd: typeof end === "number" ? end : null,
    cancelAtPeriodEnd: !!(s.cancel_at_period_end || s.cancel_at),
    checkedAt: now,
  };
}

/**
 * Does this mirror cover a caseload right now? The status decides — with one
 * belt. A subscription we already KNOW was set to end, whose end has passed,
 * is not covered even while Stripe is unreachable to confirm it: the paid
 * year is over, and "keep the last known status" must not quietly become
 * "keep it forever".
 */
export function recordActive(r: PlanRecord | null | undefined, now = Date.now()): boolean {
  if (!r || !COVERED_STATUSES.has(r.status)) return false;
  if (r.cancelAtPeriodEnd && r.periodEnd && now > r.periodEnd * 1000) return false;
  return true;
}

async function writePlan(email: string, rec: PlanRecord, kv: Kv): Promise<void> {
  // A "nothing found" record is only a cache of a negative answer, and it
  // lives a minute (NEGATIVE_MS says why). A real subscription's mirror
  // has no expiry — it is the customer id the billing portal needs.
  if (rec.sub) await kv(["SET", planKey(email), JSON.stringify(rec)]);
  else await kv(["SET", planKey(email), JSON.stringify(rec), "EX", Math.ceil(NEGATIVE_MS / 1000)]);
}

// Stripe's search language quotes with single quotes; an address is not
// supposed to hold one, but "supposed to" is not a query-injection defence.
const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/**
 * RECOVERY: the clinician paid, but the dashboard never saw the success
 * redirect (the tab closed, the network dropped). Stripe still holds the
 * subscription with our metadata, so ask it. Preference: a covering one,
 * then the latest to end, so a clinician who lapsed and re-subscribed is
 * read as the new subscription, not the old one.
 */
async function searchPlan(stripe: Stripe, email: string, now: number): Promise<PlanRecord | null> {
  const res = await stripe.subscriptions.search({
    query: `metadata['slp']:'${q(norm(email))}' AND metadata['plan']:'${CASELOAD_PLAN}'`,
    limit: 20,
  });
  const mine = (res.data || []).filter((s) => isCaseloadFor(s, email)).map((s) => recordFromSubscription(s, now));
  if (!mine.length) return null;
  mine.sort((a, b) =>
    (Number(recordActive(b, now)) - Number(recordActive(a, now))) || ((b.periodEnd || 0) - (a.periodEnd || 0)));
  return mine[0];
}

export type PlanOpts = { kv?: Kv; stripe?: Stripe | null; now?: number; force?: boolean };

/**
 * The clinician's paid plan, as the mirror knows it — refreshed from Stripe
 * when it is RECHECK_MS old (or `force`). A Stripe failure keeps the last
 * known record, so an outage never takes Premium from a caseload that paid.
 * Throws StoreUnavailable only when the store itself cannot be read.
 */
export async function currentPlan(email: string, opts: PlanOpts = {}): Promise<PlanRecord | null> {
  const kv = opts.kv || kvCmd;
  const now = opts.now ?? Date.now();
  const stored = (await readJson(planKey(email), kv)) as PlanRecord | null;
  // A negative is believed for a minute, a real mirror for ten. The store's
  // own expiry already drops a negative; this holds even where it has not.
  const fresh = stored && stored.sub ? RECHECK_MS : NEGATIVE_MS;
  if (stored && !opts.force && now - Number(stored.checkedAt || 0) < fresh) return stored;
  const stripe = stripeClient(opts.stripe);
  if (!stripe) return stored;                         // nobody to ask: the last answer stands
  try {
    let rec: PlanRecord | null = null;
    if (stored && stored.sub) {
      try {
        const s = await stripe.subscriptions.retrieve(stored.sub);
        if (isCaseloadFor(s, email)) rec = recordFromSubscription(s, now);
      } catch (e) {
        // A subscription Stripe says does not exist is an answer, not an
        // outage: fall through to the search. Anything else is an outage.
        if ((e as { code?: string } | null)?.code !== "resource_missing") throw e;
      }
    }
    // Nothing stored, or the stored one no longer covers: look for another.
    if (!recordActive(rec, now)) {
      const found = await searchPlan(stripe, email, now);
      if (found && (!rec || recordActive(found, now) || found.sub === rec.sub)) rec = found;
    }
    const next: PlanRecord = rec || {
      sub: "", customer: (stored && stored.customer) || "", status: "none",
      periodEnd: null, cancelAtPeriodEnd: false, checkedAt: now,
    };
    // A FORCED check that found nothing is not remembered (24 Sep 2026). The
    // one forced check is the Buy button's, asked the moment BEFORE the
    // clinician pays — so its "no plan" is stale by design, and cached it hid
    // the purchase that followed: if the success redirect was lost, every
    // family who asked in the next ten minutes was told "not covered".
    if (next.sub || !opts.force) await writePlan(email, next, kv);
    return next;
  } catch (e) {
    console.error("[caseload] Stripe re-check failed, keeping the last known plan:", e instanceof Error ? e.message : String(e));
    return stored;
  }
}

/**
 * Covered, and why. Grandfathered first: it needs no Stripe call and it
 * cannot lapse. `acct` may be passed by a caller that already read it.
 */
export async function planStatus(email: string, opts: PlanOpts & { acct?: Record<string, unknown> | null } = {}): Promise<PlanStatus> {
  const kv = opts.kv || kvCmd;
  const now = opts.now ?? Date.now();
  if (!norm(email)) return { active: false, source: "none", periodEnd: null, cancelAtPeriodEnd: false };
  const acct = opts.acct !== undefined ? opts.acct : await readAcct(email, kv);
  if (grandfathered(acct)) return { active: true, source: "grandfathered", periodEnd: null, cancelAtPeriodEnd: false };
  const rec = await currentPlan(email, { ...opts, kv, now });
  if (recordActive(rec, now)) {
    return { active: true, source: "paid", periodEnd: rec!.periodEnd, cancelAtPeriodEnd: rec!.cancelAtPeriodEnd };
  }
  return { active: false, source: "none", periodEnd: null, cancelAtPeriodEnd: false };
}

/** Is every family on this clinician's caseload covered? Grandfathered, or paid and live. */
export async function covered(email: string, opts: PlanOpts = {}): Promise<boolean> {
  return (await planStatus(email, opts)).active;
}

/**
 * ACTIVATION from the success redirect. The URL carries a Checkout Session
 * id, and the URL is never trusted on its own: the session is fetched from
 * Stripe, and the plan is stored ONLY when Stripe says it is ours
 * (metadata.plan), bought by THIS signed-in clinician (metadata.slp), and
 * finished (status "complete"). A session id pasted from someone else's
 * browser, or from a family's purchase, stores nothing.
 */
export async function activateFromSession(
  email: string, sessionId: string, opts: PlanOpts = {},
): Promise<{ activated: boolean; reason?: string }> {
  const kv = opts.kv || kvCmd;
  const now = opts.now ?? Date.now();
  const stripe = stripeClient(opts.stripe);
  if (!stripe) return { activated: false, reason: "stripe not configured" };
  const cs = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  const md = cs.metadata || {};
  if (md.plan !== CASELOAD_PLAN) return { activated: false, reason: "not a caseload plan" };
  if (!norm(email) || norm(md.slp) !== norm(email)) return { activated: false, reason: "bought by another account" };
  if (cs.status !== "complete") return { activated: false, reason: "checkout not complete" };
  let sub = cs.subscription as Stripe.Subscription | string | null;
  if (typeof sub === "string") sub = await stripe.subscriptions.retrieve(sub);
  if (!sub || !isCaseloadFor(sub, email)) return { activated: false, reason: "no caseload subscription" };
  await writePlan(email, recordFromSubscription(sub, now), kv);
  return { activated: true };
}

/**
 * THE BILLING PAGE'S CANCEL BUTTON ENDS THE PLAN AT THE END OF THE PAID YEAR
 * (24 Sep 2026). The Terms, for-slps and the dashboard all promise "if you
 * cancel, your families keep Premium to the end of the year you paid for".
 * That is true only if Stripe cancels at period end — and a portal session
 * with no `configuration` uses the account's DEFAULT settings, which the
 * family portal shares and a dashboard toggle can flip to "cancel
 * immediately". So the caseload portal carries its own configuration, and the
 * promise holds by construction rather than by a setting nobody pinned.
 *
 * Created once, then reused: STRIPE_PORTAL_CONFIG_CASELOAD when Travis sets
 * it, else the id kept under PORTAL_CFG_KEY. That key is a hash with one field
 * per Stripe mode ("live" / "test"): a preview and production that share a
 * store must not hand each other a configuration id the other mode has never
 * heard of. If Stripe will not create one, the portal still opens on the
 * default settings and the failure is logged — a clinician who wants to
 * cancel must never meet a dead button.
 */
export const PORTAL_CFG_KEY = "stripe:portalcfg:caseload";

export const CASELOAD_PORTAL_FEATURES = {
  subscription_cancel: { enabled: true, mode: "at_period_end" as const },
  payment_method_update: { enabled: true },
  invoice_history: { enabled: true },
};

function stripeMode(): "live" | "test" {
  return /^(sk|rk)_live_/.test(String(process.env.STRIPE_SECRET_KEY || "")) ? "live" : "test";
}

async function caseloadPortalConfig(stripe: Stripe, kv: Kv): Promise<{ id: string; from: "env" | "store" | "new" } | null> {
  const fromEnv = String(process.env.STRIPE_PORTAL_CONFIG_CASELOAD || "").trim();
  if (fromEnv) return { id: fromEnv, from: "env" };
  const mode = stripeMode();
  const cached = await kv(["HGET", PORTAL_CFG_KEY, mode]);
  if (typeof cached === "string" && cached) return { id: cached, from: "store" };
  try {
    const cfg = await stripe.billingPortal.configurations.create({
      name: CASELOAD_NAME,
      features: CASELOAD_PORTAL_FEATURES,
    });
    // Two clinicians pressing Manage at once may each create one; the first
    // stored wins, and the loser is an unused configuration, not a fault.
    await kv(["HSETNX", PORTAL_CFG_KEY, mode, cfg.id]);
    const won = await kv(["HGET", PORTAL_CFG_KEY, mode]);
    return { id: typeof won === "string" && won ? won : cfg.id, from: "new" };
  } catch (e) {
    console.error("[caseload] could not create the caseload billing-page configuration; opening the account default:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** The billing page for a clinician's plan, opened under the caseload configuration. */
export async function openCaseloadPortal(
  stripe: Stripe, customer: string, returnUrl: string, kv: Kv = kvCmd,
): Promise<{ url: string; configured: boolean }> {
  const cfg = await caseloadPortalConfig(stripe, kv);
  if (cfg) {
    try {
      const s = await stripe.billingPortal.sessions.create({ customer, return_url: returnUrl, configuration: cfg.id });
      return { url: s.url, configured: true };
    } catch (e) {
      // Only a refused CONFIGURATION falls through (deleted in the Stripe
      // dashboard, say). Forget a stored one so the next press makes a
      // fresh one; anything else — the customer, an outage — is the caller's.
      if ((e as { param?: string } | null)?.param !== "configuration") throw e;
      console.error("[caseload] Stripe refused the caseload billing-page configuration; opening the account default this once:", e instanceof Error ? e.message : String(e));
      if (cfg.from !== "env") await kv(["HDEL", PORTAL_CFG_KEY, stripeMode()]);
    }
  }
  const s = await stripe.billingPortal.sessions.create({ customer, return_url: returnUrl });
  return { url: s.url, configured: false };
}

/**
 * The clinician's OWN free Premium, on their own phone: a work address, or a
 * founder's approval for someone who has none (lib/workEmail says why).
 *
 * slpaccess:<email> is a HASH — requestedAt, approved, approvedAt — so the
 * clinician's "Request access" and the founder's "Approve" each write their
 * own field. As one JSON value, a request landing while the founder approved
 * would read the old value, write it back, and quietly un-approve them.
 */
function hashObj(flat: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(flat)) for (let i = 0; i + 1 < flat.length; i += 2) out[String(flat[i])] = String(flat[i + 1]);
  return out;
}

export async function readAccess(email: string, kv: Kv = kvCmd): Promise<{ requestedAt: string; approved: boolean; approvedAt: string }> {
  const flat = await kv(["HGETALL", accessKey(email)]);
  if (flat === undefined) throw new StoreUnavailable("slpaccess");
  const h = hashObj(flat);
  return { requestedAt: h.requestedAt || "", approved: h.approved === "1", approvedAt: h.approvedAt || "" };
}

export async function selfAccess(email: string, kv: Kv = kvCmd): Promise<SelfAccess> {
  const workEmail = isWorkEmail(email);
  const a = await readAccess(email, kv);
  return { eligible: workEmail || a.approved, workEmail, approved: a.approved, requested: !!a.requestedAt };
}

/** "No work email? Request access." The first request's time is kept — it is how long they have waited. */
export async function requestAccess(email: string, kv: Kv = kvCmd): Promise<void> {
  await kv(["HSETNX", accessKey(email), "requestedAt", new Date().toISOString()]);
}

/** The founder's hand approval (or its undoing), from /leads.html. */
export async function setApproved(email: string, approved: boolean, kv: Kv = kvCmd): Promise<void> {
  if (approved) {
    await kv(["HSET", accessKey(email), "approved", "1", "approvedAt", new Date().toISOString()]);
  } else {
    await kv(["HDEL", accessKey(email), "approved", "approvedAt"]);
  }
}

/**
 * A per-clinician daily counter. The key names the CLINICIAN and the day —
 * never the address being written to, which is used for one send and kept
 * nowhere. Returns the new count, or null when the store did not answer
 * (callers then refuse: an unmetered email door is a spam cannon).
 */
export async function bumpDaily(prefix: string, email: string, kv: Kv = kvCmd, now = Date.now()): Promise<number | null> {
  const key = prefix + ":" + norm(email) + ":" + new Date(now).toISOString().slice(0, 10);
  const n = await kv(["INCR", key]);
  if (typeof n !== "number") return null;
  if (n === 1) await kv(["EXPIRE", key, 60 * 60 * 48]);
  return n;
}
