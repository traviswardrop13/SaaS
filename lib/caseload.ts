import Stripe from "stripe";
import { kvCmd } from "@/lib/slpAuth";
import { isWorkEmail } from "@/lib/workEmail";

/**
 * SONA PRO: THE ONE PLAN A CLINICIAN CAN BUY NOW (Travis, 12 Nov 2026: "i
 * needa get this setup to sell to slps ... price it between 15 and 30 a month
 * for the dashboard and unlimited accounts for clients"; he chose $19.99 a
 * month, a 14-day free trial, no cap on families, and the page findable).
 *
 *  - "Sona Pro", $19.99 a month (`plan: slp-pro`): the dashboard, every game
 *    on the clinician's own phone or tablet, and every game for every family
 *    who joins through their link, with no cap on how many.
 *  - A 14-day free trial, card up front, once per clinician: the first Pro
 *    subscription an email ever has. Stripe charges on day 15 unless they
 *    cancel; cancelled during the trial, nothing is charged.
 *  - THE DASHBOARD IS PART OF THE PLAN, for accounts made from this build
 *    (`terms: PRO_TERMS`), and since 17 Nov 2026 for the free-dashboard
 *    signups of 13 to 17 Nov too (SLPPRO1). Every account made before 12 Nov
 *    keeps the free dashboard it was promised; see dashboardOpen(). Sona
 *    Clinic (below, 17 Nov 2026) opens it too, for the owner and every
 *    clinician who joined their team.
 *
 * The two yearly plans below are RETIRED FROM SALE, not cancelled: anyone
 * holding one keeps it, renewing at the price they bought it at, and it keeps
 * covering what it covered. Only the purchase path lost them
 * (app/api/slp/plan refuses them), the same rule the family plan's monthly
 * price went by.
 *
 * THE TWO RETIRED PLANS, one on top of the other
 * (24 Sep 2026; re-priced by Travis, 29 Sep 2026; sold until 12 Nov 2026).
 *
 *  - "Sona Premium for you", $59.99 a year: every game on the clinician's
 *    own phone or tablet, reached by the single-use link /api/slp/self
 *    emails to the account's own address.
 *  - "Sona Premium for your caseload", $59.99 a year MORE: every family who
 *    joins through that clinician's link gets Premium, whether or not they
 *    say "Yes, share progress" (access and sharing are separate promises).
 *    It is an add-on. It is sold only to a clinician whose own Premium is
 *    already on ("they're going to still pay the 60 bucks for an account,
 *    and they can pay an extra 60 bucks a year for all of their caseload").
 *
 * Until 29 Sep the caseload plan was $79.99 and the clinician's own Premium
 * was free with a work email. Both of those promises are kept for the people
 * they were made to; see WHO IS COVERED.
 *
 * The clinician earns nothing on their caseload, ever (CLAUDE.md: a
 * per-family payment to a clinician is a referral fee under several state
 * practice acts), and nothing here counts families toward anything a
 * clinician is paid.
 *
 * WHO IS COVERED. Every rule is STRUCTURAL: the `terms` stamp an account was
 * made with, or a Stripe subscription. No clock to get wrong, no cut-off to
 * argue about.
 *  - NO `terms` (signed up before 24 Sep 2026). Promised "Free forever,
 *    unlimited families, for you and every kid on your caseload". Their
 *    caseload AND their own phone are covered, free, forever.
 *  - `terms: FREE_SELF_TERMS` (24 to 29 Sep 2026). Told their own Premium was
 *    free with a work email (or the founder's approval). It still is. Their
 *    caseload is the add-on, bought at today's price.
 *  - `terms: CASELOAD_TERMS` (from 29 Sep 2026). They buy Premium for
 *    themselves, then may add their caseload.
 *  - PAID CASELOAD. A live subscription stamped `plan: slp-caseload` and
 *    `slp: <email>`. One sold before 29 Sep (no `addon` stamp) was the whole
 *    $79.99 plan and has always switched on the clinician's own phone too, so
 *    it still does, at the price they subscribed at. One sold from 29 Sep
 *    carries `addon: "1"` and covers the caseload only.
 *  - PAID SELF. A live subscription stamped `plan: slp-self`.
 *  - `terms: PRO_TERMS` (from 12 Nov 2026). Nothing until they start Sona
 *    Pro or join Sona Clinic: not the dashboard, not their own phone, not
 *    their caseload.
 *  - SONA PRO. A live subscription stamped `plan: slp-pro`. Covers all three,
 *    whatever the account's stamp. A month cancelled ends at the end of the
 *    month paid for (the billing page cancels at period end), so families
 *    keep every game to then.
 *  - SONA CLINIC (17 Nov 2026). A live subscription stamped `plan:
 *    slp-clinic` and `slp: <owner>`. Covers all three for the owner AND for
 *    every clinician who joined the owner's team (clinicStatus), whatever
 *    their stamps, for as long as it is live.
 *  - `terms: FREE_DASHBOARD_TERMS` (13 to 17 Nov 2026), or a Pro-era
 *    account carrying `freeDashboard: true` (opted in then). Told the
 *    dashboard was free; since 17 Nov 2026 (SLPPRO1, "Move them to the
 *    trial") they are treated exactly as PRO_TERMS: nothing until a plan.
 * Stripe keeps a cancelled-at-period-end subscription `active` until the
 * year that was paid for runs out, so families keep Premium to the end of
 * the paid year, then drop to the free version. past_due counts too: that is
 * the card-retry grace, and a declined renewal must not knock forty families
 * off Premium the same afternoon.
 *
 * WHERE THE PAID STATE LIVES. One mirror per plan: `slpplan:<email>` for the
 * caseload, `slpplan-self:<email>` for the clinician's own, `slpplan-pro:`
 * and `slpplan-clinic:` (the owner's) for the two monthly plans. Never on the
 * slpacct JSON, which two routes rewrite whole (a plan written there would be
 * erased by the next profile save), and never a key starting "slpacct:",
 * which lib/founder.ts scans as the list of clinician accounts. Each is a
 * MIRROR of Stripe, re-read when it is ten minutes old; when Stripe cannot be
 * reached the last known answer stands, so a Stripe outage never takes
 * Premium away from someone who paid for it.
 *
 * NEVER A CHARTER SPOT. Neither subscription's metadata carries a `tier` key:
 * lib/charter.ts counts `tier: charter` subscriptions as the fifty family
 * spots, and a clinician's plan is not a family's. That is also why the
 * clinician's own $59.99 is its own product and not the family plan at the
 * same figure: it never takes a charter spot, and never becomes $99.99 when
 * the spots run out.
 */

// SONA PRO. A monthly price, printed as it is charged: "$19.99 a month",
// never rounded to "$20" and never divided into anything. The trial length is
// the one number checkout, the dashboard, for-slps and the Terms all read.
export const PRO_CENTS = 1999;
export const PRO_PRICE = "$19.99";
export const PRO_PER = "a month";
export const PRO_INTERVAL = "month" as const;            // Stripe recurring.interval
export const PRO_TRIAL_DAYS = 14;
export const PRO_PLAN = "slp-pro";                       // Stripe metadata.plan, on the session AND the subscription
export const PRO_NAME = "Sona Pro";

/**
 * BLACK FRIDAY (BF1, Travis, 24 Nov 2026: "a fresh optin and website to use
 * this week for black friday! with a countdown to sunday at 11:59 pm"; asked,
 * he chose 50% off Sona Pro for 3 months, ending at 11:59 PM Mountain time,
 * then "but no free trial on the promo"). Every Sona Pro checkout opened
 * before BF_ENDS_AT carries BF_COUPON and no trial (charged that day):
 * BF_OFF_CENTS off each of the first BF_MONTHS months,
 * so $19.99 becomes BF_PRICE, $9.99, an exact figure ("half" of $19.99 is
 * not one). The checkout's own words say so (/api/slp/plan). The pages that
 * advertise it (bf.html at /blackfriday, for-slps.html's Black Friday mode)
 * carry the same end and figures, pinned equal by tests/shiptest.mjs. After
 * the end nothing changes back by hand: checkouts stop carrying it, Stripe
 * refuses the coupon (its redeem_by), and the pages show it is over. A
 * subscription that has it keeps its three months (Stripe counts them).
 */
export const BF_ON = true;
/** Sunday 29 Nov 2026, 11:59 PM in Boise (MST, UTC-7): 06:59 UTC on Monday 30 Nov. */
export const BF_ENDS_AT = Date.UTC(2026, 10, 30, 6, 59, 0);
export const BF_OFF_CENTS = 1000;
export const BF_PRICE = "$9.99";
export const BF_MONTHS = 3;
/** The coupon's id in Stripe, made by ensureBfCoupon the first time a checkout needs it. */
export const BF_COUPON = "sona-pro-bf-2026";
/** Stamped on the subscription (metadata.offer) of a Sona Pro bought with it. */
export const BF_OFFER = "bf-2026";

/**
 * Is the Black Friday price on for a checkout opened now? Production reads
 * the switch and the clock. Anywhere else (a laptop, a test; never a Vercel
 * build, previews included) it is off unless SONA_BF_FORCE=1, so the suites
 * that pin Sona Pro's ordinary checkout hold whatever the date, and the
 * Black Friday ones turn it on and move the clock themselves.
 */
export function bfOn(now: number = Date.now()): boolean {
  const on = process.env.NODE_ENV === "production" ? BF_ON : BF_ON && process.env.SONA_BF_FORCE === "1";
  return on && now < BF_ENDS_AT;
}

/**
 * The Black Friday coupon's id, making it in Stripe the first time: $10 off,
 * for 3 months, redeemable only until BF_ENDS_AT. "" when Stripe has it but
 * will not take it any more (past its end, or switched off there). Anything
 * else Stripe says is thrown: the caller sells at the ordinary price then,
 * and its checkout says that price.
 */
export async function ensureBfCoupon(stripe: Stripe): Promise<string> {
  try {
    const c = await stripe.coupons.retrieve(BF_COUPON);
    return c && c.valid ? c.id : "";
  } catch (e) {
    if (!e || (e as { code?: string }).code !== "resource_missing") throw e;
  }
  try {
    // Stripe refuses a coupon name over 40 characters, and then every
    // checkout fell back to the trial (25 Nov 2026: "Black Friday: Sona Pro
    // $9.99 for 3 months" is 41). This one is 32; caseloadtest's Stripe
    // holds the limit.
    const made = await stripe.coupons.create({
      id: BF_COUPON,
      name: "Black Friday: " + BF_PRICE + " for " + BF_MONTHS + " months",
      amount_off: BF_OFF_CENTS,
      currency: "usd",
      duration: "repeating",
      duration_in_months: BF_MONTHS,
      redeem_by: Math.floor(BF_ENDS_AT / 1000),
    });
    return made.id;
  } catch (e) {
    // Two checkouts made it at once: the other one's is the coupon.
    if (!e || (e as { code?: string }).code !== "resource_already_exists") throw e;
    const c = await stripe.coupons.retrieve(BF_COUPON);
    return c && c.valid ? c.id : "";
  }
}

/**
 * Stamped on every NEW slpacct from 12 Nov 2026: the dashboard is part of a
 * plan for them (Sona Pro or Sona Clinic). Still the stamp for every new
 * account after the free dashboard was reversed (17 Nov 2026), and on
 * purpose: dashboardOpen() opens any stamp that is not this one, so a new
 * stamp would quietly hand every new account a free dashboard.
 */
export const PRO_TERMS = "pro-2026-11-12";
/**
 * Verified signups from the homepage's free-dashboard offer, 13 to 17 Nov
 * 2026. SUPERSEDED (SLPPRO1, 17 Nov 2026, Travis: "i want this to be sona pro
 * tho. this is what they access when they create a free trial", and, of these
 * accounts, "Move them to the trial"): they now need Sona Pro (or Sona
 * Clinic) like PRO_TERMS accounts, and no door makes this stamp any more.
 * Kept for the records that carry it.
 */
export const FREE_DASHBOARD_TERMS = "free-dashboard-2026-11-13";

// SONA CLINIC (Travis, 17 Nov 2026: "$99 a month"; every clinician at the
// practice gets everything Sona Pro gives, and the owner sees the clinicians
// as sub-accounts). One price for the practice, printed as it is charged:
// "$99 a month", never "$99.00", never "$100", and never divided into a
// per-clinician figure (the seat count is a ceiling, not a unit price).
// The trial is Sona Pro's fourteen days, and it is ONE trial per clinician
// across both plans (proStatus().trialAvailable). Never a `tier` key: see
// NEVER A CHARTER SPOT above.
export const CLINIC_CENTS = 9900;
export const CLINIC_PRICE = "$99";
export const CLINIC_PER = "a month";
export const CLINIC_INTERVAL = "month" as const;          // Stripe recurring.interval
export const CLINIC_TRIAL_DAYS = PRO_TRIAL_DAYS;
export const CLINIC_PLAN = "slp-clinic";                  // Stripe metadata.plan, on the session AND the subscription; metadata.slp is the OWNER
export const CLINIC_NAME = "Sona Clinic";
/** Clinicians on one Clinic plan, the owner included; invited and joined both hold a seat. "Email us to add more." */
export const CLINIC_SEATS = 25;
/**
 * SONA CLINIC IS HIDDEN (Travis, 18 Nov 2026: "i actually wanna get rid of
 * the 99 or hide it for now"). Hidden, not deleted: while this is false
 * nothing sells it or names it to a clinician. /api/slp/plan refuses a
 * Clinic checkout and offers none, /api/slp/team adds nobody, the Terms
 * render no Clinic paragraph, and every "comes with" line names Sona Pro
 * alone (planNames). Everything that would honour a Clinic plan (coverage,
 * the team's removals, leaving, deleting an account) stays as built, so a
 * plan that somehow exists is still kept, and removing a clinician always
 * works. Turning it on is this value and `var CLINIC_ON` in
 * public/for-slps.html (tests/shiptest.mjs pins the two equal), plus the
 * Clinic lines put back in public/privacy.html (CLAUDE.md says which).
 */
export const CLINIC_ON = false;

/**
 * Is Sona Clinic on sale here? The constant, or, on a developer's machine or
 * in a test (never a production build: Vercel builds previews with
 * NODE_ENV=production too), SONA_CLINIC_FORCE=1, so the Clinic suites keep
 * exercising the dormant code. Read on every call, never cached.
 */
export function clinicOn(): boolean {
  return CLINIC_ON || (process.env.NODE_ENV !== "production" && process.env.SONA_CLINIC_FORCE === "1");
}

/** What the dashboard "comes with", in a clinician's words: "Sona Pro", or "Sona Pro or Sona Clinic" while Clinic is on sale. */
export function planNames(): string {
  return clinicOn() ? PRO_NAME + " or " + CLINIC_NAME : PRO_NAME;
}

// The add-on. $59.99 / 12 = $4.9991, so "under $5 a month": never "$4.99 a
// month" (that is $59.88 a year) nor "$5.00" (a rounding a reader can check
// and catch). The same rule made the family price "under $5 a month".
export const CASELOAD_CENTS = 5999;
export const CASELOAD_PRICE = "$59.99";
export const CASELOAD_PER_MONTH = "under $5 a month";
export const CASELOAD_PLAN = "slp-caseload";            // Stripe metadata.plan, on the session AND the subscription
export const CASELOAD_NAME = "Sona Premium for your caseload";
/** metadata.addon on every caseload subscription sold from 29 Sep 2026: covers the caseload, not the clinician's own phone. */
export const CASELOAD_ADDON = "1";
// The clinician's own. The same figure as the add-on, and the same reading.
export const SELF_CENTS = 5999;
export const SELF_PRICE = "$59.99";
export const SELF_PER_MONTH = "under $5 a month";
export const SELF_PLAN = "slp-self";                    // Stripe metadata.plan
export const SELF_NAME = "Sona Premium for you";
/** What the caseload plan cost before 29 Sep 2026. Those subscriptions renew at it; the Terms say so. */
export const LEGACY_CASELOAD_PRICE = "$79.99";
// Both: $119.98 / 12 = $9.998, so "under $10 a month".
export const BOTH_PRICE = "$119.98";
export const BOTH_PER_MONTH = "under $10 a month";
/** The 29 Sep to 12 Nov 2026 stamp: a free dashboard, both yearly plans bought. An account never gains or loses its stamp. */
export const CASELOAD_TERMS = "premium-2026-09-29";
/** The 24 to 29 Sep 2026 stamp: own Premium free with a work email, as those clinicians were told. */
export const FREE_SELF_TERMS = "caseload-2026-09";
// NO CAP ON A COVERED CASELOAD (Travis, 12 Nov 2026: "Remove the limit").
// Until then a covered code stopped at 300 sign-ups a year and the copy could
// not say "unlimited"; now a covered clinician's link has no number at all,
// so "unlimited families" is true. An UNCOVERED code keeps the ordinary 60
// (app/api/slp/redeem), which is what bounds a link posted in public by
// someone who is not paying. The accepted risk: a paying clinician's link
// posted in public gives strangers every game on that clinician's plan, and
// the remedy is the clinician's Rotate button (Settings), not a number.

/** Stripe statuses under which a plan is live. Everything else is not. */
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

/**
 * Is this Stripe object (a subscription or a checkout session) one of the
 * clinician plans? The family surfaces (restore-by-email, the family billing
 * page, the family success page) refuse both: a clinician's receipt unlocks
 * no device and opens no family billing page.
 */
export function isClinicianPlan(md: Record<string, string> | null | undefined): boolean {
  const plan = md && md.plan;
  return plan === CASELOAD_PLAN || plan === SELF_PLAN || plan === PRO_PLAN || plan === CLINIC_PLAN;
}

export type Kv = (cmd: (string | number)[]) => Promise<unknown>;

export type PlanKind = "caseload" | "self" | "pro" | "clinic";
const PLAN_OF: Record<PlanKind, string> = { caseload: CASELOAD_PLAN, self: SELF_PLAN, pro: PRO_PLAN, clinic: CLINIC_PLAN };

export type PlanRecord = {
  sub: string;                 // "" when Stripe was asked and had nothing
  customer: string;
  status: string;              // Stripe's own word, or "none"
  periodEnd: number | null;    // unix seconds
  cancelAtPeriodEnd: boolean;
  checkedAt: number;           // ms — when Stripe last answered
  // Caseload only: sold as the add-on (29 Sep 2026 on). Absent on a mirror
  // written before then, which is the older plan and reads as not an add-on.
  addon?: boolean;
  // Pro and Clinic only: when the free trial ends (unix seconds), while there is one.
  trialEnd?: number | null;
};

export type PlanStatus = {
  active: boolean;
  source: "paid" | "grandfathered" | "pro" | "clinic" | "none";
  periodEnd: number | null;
  cancelAtPeriodEnd: boolean;
};

export type SelfAccess = { eligible: boolean; workEmail: boolean; approved: boolean; requested: boolean };

/**
 * The clinician's own Premium, and why. `canRequest` is true only for a
 * 24 to 29 Sep account without a work email: the one kind of clinician who
 * was told "No work email? Request access" and can still be approved by hand.
 */
export type SelfStatus = {
  active: boolean;
  source: "grandfathered" | "work-email" | "paid" | "caseload" | "pro" | "clinic" | "none";
  periodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  canRequest: boolean;
  workEmail: boolean;
  approved: boolean;
  requested: boolean;
};

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

export function planKey(email: string, kind: PlanKind = "caseload"): string {
  return (kind === "self" ? "slpplan-self:" : kind === "pro" ? "slpplan-pro:" : kind === "clinic" ? "slpplan-clinic:" : "slpplan:") + norm(email);
}

/**
 * SONA CLINIC'S TEAM (17 Nov 2026). Who is on whose Clinic plan, in two keys
 * that must agree, never on the slpacct JSON (rewritten whole by two routes)
 * and never under "slpacct:" (lib/founder SCANs that as the account list):
 *  - `slpteam:<owner>`: a HASH, member email → {state, addedAt, acceptedAt?, inv?}.
 *    The owner's typing makes a row "invited"; only the member's own press
 *    of Join on the emailed link's page (lib/team acceptInvite) makes it
 *    "active".
 *  - `slpteam-of:<member>`: the owner's email, written only on that press.
 * In the code the membership is "team", because `acct.clinic` already means
 * the practice's NAME; the plan is "clinic" (Stripe metadata) and the page
 * says "Sona Clinic" and "Your clinic".
 */
export function teamKey(owner: string): string { return "slpteam:" + norm(owner); }
export function teamOfKey(member: string): string { return "slpteam-of:" + norm(member); }

// `inv` (18 Nov 2026, review): an INVITED row names the one emailed link
// that may still join it, by the hash its `slpteaminv:` key is stored under.
// A Resend mints a new link and retires the last one, so only the newest
// email works; a joined row carries none. Never sent to any page.
export type TeamRow = { state: "invited" | "active"; addedAt: string; acceptedAt?: string; inv?: string };

/** One row of `slpteam:<owner>`, or null when there is none (or it is unreadable). */
export function parseTeamRow(raw: unknown): TeamRow | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const r = JSON.parse(raw) as Partial<TeamRow>;
    if (!r || typeof r !== "object") return null;
    return {
      state: r.state === "active" ? "active" : "invited",
      addedAt: String(r.addedAt || ""),
      ...(r.acceptedAt ? { acceptedAt: String(r.acceptedAt) } : {}),
      ...(typeof r.inv === "string" && /^[0-9a-f]{64}$/.test(r.inv) ? { inv: r.inv } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * The owner whose Clinic plan this clinician JOINED, or "". Joined means both
 * keys agree: the reverse key names the owner AND the owner's row for them is
 * "active". An owner's typing alone never puts anyone on a team. Throws when
 * the store does not answer (an outage is not "no team").
 */
export async function teamOwnerOf(email: string, kv: Kv = kvCmd): Promise<string> {
  const me = norm(email);
  if (!me) return "";
  const owner = await kv(["GET", teamOfKey(me)]);
  if (owner === undefined) throw new StoreUnavailable("slpteam-of");
  const o = typeof owner === "string" ? norm(owner) : "";
  if (!o || o === me) return "";
  const row = await kv(["HGET", teamKey(o), me]);
  if (row === undefined) throw new StoreUnavailable("slpteam");
  const r = parseTeamRow(row);
  return r && r.state === "active" ? o : "";
}
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
export async function readPlan(email: string, kv: Kv = kvCmd, kind: PlanKind = "caseload"): Promise<PlanRecord | null> {
  return (await readJson(planKey(email, kind), kv)) as PlanRecord | null;
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

/**
 * Made from 12 Nov 2026 (`terms: PRO_TERMS`): the dashboard, their own phone
 * and their caseload all come with Sona Pro, and with nothing else — no
 * retired plan was ever sold to them, so none is looked for.
 */
export function proTerms(acct: unknown): boolean {
  return !!acct && typeof acct === "object" && !Array.isArray(acct) &&
    (acct as { terms?: unknown }).terms === PRO_TERMS;
}

function stripeClient(given?: Stripe | null): Stripe | null {
  if (given) return given;
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

/** Is this subscription the given clinician plan, sold to THIS clinician? */
export function isPlanFor(s: { metadata?: Record<string, string> | null } | null | undefined, email: string, kind: PlanKind): boolean {
  const md = (s && s.metadata) || {};
  return md.plan === PLAN_OF[kind] && norm(md.slp) === norm(email) && !!norm(email);
}

/** Is this subscription a caseload plan, sold to THIS clinician? */
export function isCaseloadFor(s: { metadata?: Record<string, string> | null } | null | undefined, email: string): boolean {
  return isPlanFor(s, email, "caseload");
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
  const rec: PlanRecord = {
    sub: String(s.id || ""),
    customer,
    status: String(s.status || "none"),
    periodEnd: typeof end === "number" ? end : null,
    cancelAtPeriodEnd: !!(s.cancel_at_period_end || s.cancel_at),
    checkedAt: now,
  };
  if (s.metadata && s.metadata.plan === CASELOAD_PLAN) rec.addon = s.metadata.addon === CASELOAD_ADDON;
  if (s.metadata && (s.metadata.plan === PRO_PLAN || s.metadata.plan === CLINIC_PLAN)) {
    const t = (s as unknown as { trial_end?: number | null }).trial_end;
    rec.trialEnd = s.status === "trialing" && typeof t === "number" ? t : null;
  }
  return rec;
}

/**
 * Is this plan live right now? The status decides — with one
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

async function writePlan(email: string, rec: PlanRecord, kv: Kv, kind: PlanKind): Promise<void> {
  // A "nothing found" record is only a cache of a negative answer, and it
  // lives a minute (NEGATIVE_MS says why). A real subscription's mirror
  // has no expiry — it is the customer id the billing portal needs.
  if (rec.sub) await kv(["SET", planKey(email, kind), JSON.stringify(rec)]);
  else await kv(["SET", planKey(email, kind), JSON.stringify(rec), "EX", Math.ceil(NEGATIVE_MS / 1000)]);
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
async function searchPlan(stripe: Stripe, email: string, now: number, kind: PlanKind): Promise<PlanRecord | null> {
  const res = await stripe.subscriptions.search({
    query: `metadata['slp']:'${q(norm(email))}' AND metadata['plan']:'${PLAN_OF[kind]}'`,
    limit: 20,
  });
  const mine = (res.data || []).filter((s) => isPlanFor(s, email, kind)).map((s) => recordFromSubscription(s, now));
  if (!mine.length) return null;
  mine.sort((a, b) =>
    (Number(recordActive(b, now)) - Number(recordActive(a, now))) || ((b.periodEnd || 0) - (a.periodEnd || 0)));
  return mine[0];
}

export type PlanOpts = { kv?: Kv; stripe?: Stripe | null; now?: number; force?: boolean; kind?: PlanKind };

/**
 * One of the clinician's paid plans (`kind`, the caseload by default), as the mirror knows it — refreshed from Stripe
 * when it is RECHECK_MS old (or `force`). A Stripe failure keeps the last
 * known record, so an outage never takes Premium from a caseload that paid.
 * Throws StoreUnavailable only when the store itself cannot be read.
 */
export async function currentPlan(email: string, opts: PlanOpts = {}): Promise<PlanRecord | null> {
  const kv = opts.kv || kvCmd;
  const now = opts.now ?? Date.now();
  const kind: PlanKind = opts.kind || "caseload";
  const stored = (await readJson(planKey(email, kind), kv)) as PlanRecord | null;
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
        if (isPlanFor(s, email, kind)) rec = recordFromSubscription(s, now);
      } catch (e) {
        // A subscription Stripe says does not exist is an answer, not an
        // outage: fall through to the search. Anything else is an outage.
        if ((e as { code?: string } | null)?.code !== "resource_missing") throw e;
      }
    }
    // Nothing stored, or the stored one no longer covers: look for another.
    if (!recordActive(rec, now)) {
      const found = await searchPlan(stripe, email, now, kind);
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
    if (next.sub || !opts.force) await writePlan(email, next, kv, kind);
    return next;
  } catch (e) {
    console.error("[caseload] Stripe re-check failed, keeping the last known " + kind + " plan:", e instanceof Error ? e.message : String(e));
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
  // Sona Pro first: it is the plan on sale, and it covers the caseload
  // whatever the account's stamp.
  const pro = await currentPlan(email, { ...opts, kv, now, kind: "pro" });
  if (recordActive(pro, now)) {
    return { active: true, source: "pro", periodEnd: pro!.periodEnd, cancelAtPeriodEnd: pro!.cancelAtPeriodEnd };
  }
  // Sona Clinic next (17 Nov 2026), the owner's own or the one they joined,
  // and BEFORE the Pro-era short-circuit below: a clinician made from 12 Nov
  // who joins a clinic is exactly who it covers.
  const clinic = await clinicStatus(email, { ...opts, kv, now });
  if (clinic.active) {
    return { active: true, source: "clinic", periodEnd: clinic.periodEnd, cancelAtPeriodEnd: clinic.cancelAtPeriodEnd };
  }
  // A Pro-era account was never sold the yearly caseload plan: no search.
  if (proTerms(acct) || acct?.terms === FREE_DASHBOARD_TERMS) return { active: false, source: "none", periodEnd: null, cancelAtPeriodEnd: false };
  const rec = await currentPlan(email, { ...opts, kv, now, kind: "caseload" });
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
 * The clinician's OWN Premium, and why (WHO IS COVERED, above). In the order
 * that needs the fewest questions: the account stamp, then the store, then
 * Stripe. A 24 to 29 Sep account with a work email (or an approval) never
 * costs a Stripe call; neither does a grandfathered one.
 */
export async function selfStatus(email: string, opts: PlanOpts & { acct?: Record<string, unknown> | null } = {}): Promise<SelfStatus> {
  const kv = opts.kv || kvCmd;
  const now = opts.now ?? Date.now();
  const off = { periodEnd: null, cancelAtPeriodEnd: false };
  if (!norm(email)) return { active: false, source: "none", ...off, canRequest: false, workEmail: false, approved: false, requested: false };
  const acct = opts.acct !== undefined ? opts.acct : await readAcct(email, kv);
  const access = await selfAccess(email, kv);
  const base = { workEmail: access.workEmail, approved: access.approved, requested: access.requested };
  const earlier = !!acct && (acct as { terms?: unknown }).terms === FREE_SELF_TERMS;
  if (grandfathered(acct)) return { active: true, source: "grandfathered", ...off, canRequest: false, ...base };
  if (earlier && access.eligible) return { active: true, source: "work-email", ...off, canRequest: false, ...base };
  const canRequest = earlier;
  const pro = await currentPlan(email, { ...opts, kv, now, kind: "pro" });
  if (recordActive(pro, now)) {
    return { active: true, source: "pro", periodEnd: pro!.periodEnd, cancelAtPeriodEnd: pro!.cancelAtPeriodEnd, canRequest, ...base };
  }
  // Every clinician on a Sona Clinic plan gets every game on their own phone,
  // as Sona Pro gives it; asked before the Pro-era short-circuit, as above.
  const clinic = await clinicStatus(email, { ...opts, kv, now });
  if (clinic.active) {
    return { active: true, source: "clinic", periodEnd: clinic.periodEnd, cancelAtPeriodEnd: clinic.cancelAtPeriodEnd, canRequest, ...base };
  }
  if (proTerms(acct) || acct?.terms === FREE_DASHBOARD_TERMS) return { active: false, source: "none", ...off, canRequest, ...base };
  const own = await currentPlan(email, { ...opts, kv, now, kind: "self" });
  if (recordActive(own, now)) {
    return { active: true, source: "paid", periodEnd: own!.periodEnd, cancelAtPeriodEnd: own!.cancelAtPeriodEnd, canRequest, ...base };
  }
  // The older $79.99 caseload plan always switched on the clinician's own
  // phone, and keeps doing so for as long as it renews. The add-on does not.
  const cl = await currentPlan(email, { ...opts, kv, now, kind: "caseload" });
  if (recordActive(cl, now) && cl!.addon !== true) {
    return { active: true, source: "caseload", periodEnd: cl!.periodEnd, cancelAtPeriodEnd: cl!.cancelAtPeriodEnd, canRequest, ...base };
  }
  return { active: false, source: "none", ...off, canRequest, ...base };
}

/**
 * SONA PRO, as the dashboard and checkout need it: whether it is on, and
 * whether this clinician may still start the free trial.
 */
export type ProStatus = {
  active: boolean;
  status: string;              // Stripe's word ("trialing", "active", "past_due", …) or "none"
  trialEnd: number | null;     // unix seconds, while trialing
  periodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  trialAvailable: boolean;     // never had a Pro OR a Clinic subscription: the one trial is for either plan
};

export async function proStatus(email: string, opts: PlanOpts = {}): Promise<ProStatus> {
  const now = opts.now ?? Date.now();
  if (!norm(email)) return { active: false, status: "none", trialEnd: null, periodEnd: null, cancelAtPeriodEnd: false, trialAvailable: false };
  const rec = await currentPlan(email, { ...opts, now, kind: "pro" });
  const active = recordActive(rec, now);
  // ONE TRIAL PER CLINICIAN, ACROSS BOTH PLANS. Any Pro or Clinic
  // subscription Stripe ever held for this address, in any status, spends
  // it: a trial that was cancelled, or ran out with a card that failed, is
  // not a second fourteen days, and neither is switching plans (17 Nov 2026:
  // two plans with a trial each would otherwise be twenty-eight days). The
  // Clinic mirror is asked only when the Pro one has not already spent it.
  let spent = !!(rec && rec.sub);
  if (!spent) {
    const clinic = await currentPlan(email, { ...opts, now, kind: "clinic" });
    spent = !!(clinic && clinic.sub);
  }
  return {
    active,
    status: (rec && rec.status) || "none",
    trialEnd: active && rec && rec.status === "trialing" ? rec.trialEnd ?? null : null,
    periodEnd: (rec && rec.periodEnd) || null,
    cancelAtPeriodEnd: !!(rec && rec.cancelAtPeriodEnd),
    trialAvailable: !spent,
  };
}

/**
 * BEFORE A SONA PRO CHECKOUT (PAID FOR EVERYONE, Travis, 25 Nov 2026: "no
 * just make it paid for everyone"). Every address may buy Sona Pro but two:
 * one whose Sona Pro is on (the caller has asked proStatus), and one a Sona
 * Clinic already covers. The Clinic is asked directly, never through
 * planStatus, whose "grandfathered" answer comes first and would hide it.
 * And the retired yearly plans' records are brought back from Stripe (forced:
 * a forced "no plan" is never remembered, NEGATIVE_MS), so the new plan goes
 * on the Stripe customer they already pay with and Manage billing shows both.
 * A Pro-era account was never sold a yearly plan: no search.
 */
export async function beforeProSale(
  email: string,
  opts: PlanOpts & { acct?: Record<string, unknown> | null } = {},
): Promise<{ clinic: ClinicStatus }> {
  const kv = opts.kv || kvCmd;
  const now = opts.now ?? Date.now();
  const clinic = await clinicStatus(email, { ...opts, kv, now, force: true });
  const acct = opts.acct !== undefined ? opts.acct : await readAcct(email, kv);
  if (!clinic.active && !proTerms(acct) && acct?.terms !== FREE_DASHBOARD_TERMS) {
    for (const kind of ["caseload", "self"] as const) await currentPlan(email, { ...opts, kv, now, force: true, kind });
  }
  return { clinic };
}

/**
 * DON'T PAY TWICE (18 Nov 2026). Since the dashboard stopped selling, a
 * clinician goes from /plans straight to Stripe, with no page in between to
 * warn that an older plan still renews beside the new one; and once the new
 * one is on, planStatus/selfStatus answer with it and hide the older one.
 * This says, for the dashboard's Settings, which older plan still renews:
 *  - "yearly": Sona Pro or Sona Clinic (owned) is on, and a retired yearly
 *    plan (the caseload plan or "Sona Premium for you") is still live and
 *    not set to end;
 *  - "pro": a Sona Clinic plan the clinician owns is on, and their Sona Pro
 *    still renews under it;
 *  - null otherwise (and always for a Pro-era account, which was never sold
 *    a yearly plan: no search).
 * Reads the mirrors the plan GET has just refreshed, so it costs no more
 * Stripe calls than they do.
 */
export async function alsoRenews(
  email: string,
  opts: PlanOpts & { acct?: Record<string, unknown> | null; pro: ProStatus; clinic: ClinicStatus },
): Promise<"yearly" | "pro" | null> {
  const kv = opts.kv || kvCmd;
  const now = opts.now ?? Date.now();
  const owner = opts.clinic.role === "owner" && opts.clinic.active;
  if (!opts.pro.active && !owner) return null;
  const acct = opts.acct !== undefined ? opts.acct : await readAcct(email, kv);
  if (!grandfathered(acct) && !proTerms(acct) && acct?.terms !== FREE_DASHBOARD_TERMS) {
    for (const kind of ["caseload", "self"] as const) {
      const rec = await currentPlan(email, { ...opts, kv, now, kind });
      if (recordActive(rec, now) && !rec!.cancelAtPeriodEnd) return "yearly";
    }
  }
  if (owner && opts.pro.active && !opts.pro.cancelAtPeriodEnd) return "pro";
  return null;
}

/**
 * SONA CLINIC, for one clinician (17 Nov 2026): whether a Clinic plan covers
 * them, and in what role.
 *  - "owner": this address bought a Clinic plan (`slpplan-clinic:<email>`,
 *    metadata.slp is the owner). A LAPSED owner is still "owner", with
 *    active false: removing a clinician from the team must always work.
 *  - "member": an owner added them AND they accepted from their own inbox
 *    (teamOwnerOf), AND that owner's Clinic plan is live. Only then; an
 *    invitation alone covers nobody, and a member's coverage ends the moment
 *    the owner removes them, they leave, or the owner's plan ends.
 * The dates and status are the plan's that covers them — the owner's, for a
 * member. A live plan wins over a lapsed one, whichever role it is in.
 */
export type ClinicStatus = {
  role: "owner" | "member" | null;
  owner: string;               // the owner's email ("" when role is null; the clinician's own for an owner)
  active: boolean;
  status: string;              // Stripe's word, or "none"
  trialEnd: number | null;     // unix seconds, while trialing
  periodEnd: number | null;
  cancelAtPeriodEnd: boolean;
};

export async function clinicStatus(email: string, opts: PlanOpts = {}): Promise<ClinicStatus> {
  const kv = opts.kv || kvCmd;
  const now = opts.now ?? Date.now();
  const me = norm(email);
  const none: ClinicStatus = { role: null, owner: "", active: false, status: "none", trialEnd: null, periodEnd: null, cancelAtPeriodEnd: false };
  if (!me) return none;
  const as = (rec: PlanRecord | null, role: "owner" | "member", owner: string): ClinicStatus => {
    const active = recordActive(rec, now);
    return {
      role, owner, active,
      status: (rec && rec.status) || "none",
      trialEnd: active && rec && rec.status === "trialing" ? rec.trialEnd ?? null : null,
      periodEnd: (rec && rec.periodEnd) || null,
      cancelAtPeriodEnd: !!(rec && rec.cancelAtPeriodEnd),
    };
  };
  const own = await currentPlan(me, { ...opts, kv, now, kind: "clinic" });
  if (recordActive(own, now)) return as(own, "owner", me);
  const owner = await teamOwnerOf(me, kv);
  if (owner) {
    const theirs = await currentPlan(owner, { ...opts, kv, now, kind: "clinic" });
    if (recordActive(theirs, now)) return as(theirs, "member", owner);
  }
  if (own && own.sub) return as(own, "owner", me);
  return none;
}

/**
 * App Review's account (SLPAPP1): only while SLP_REVIEW_EMAIL and a six-digit
 * SLP_REVIEW_CODE are both set in Vercel, that one address. lib/slpSignIn
 * signs it in with the fixed code; here its dashboard stays open, so Apple
 * can review the clinicians' app, which sells nothing (SLPPRO1). Unset either
 * and it is an ordinary account.
 */
export function reviewEmail(): string {
  const e = norm(process.env.SLP_REVIEW_EMAIL);
  const code = String(process.env.SLP_REVIEW_CODE || "").replace(/[\s-]/g, "");
  return /^\d{6}$/.test(code) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : "";
}

/**
 * THE PROMISED FREE DASHBOARDS, by the account's stamp alone (never
 * backfilled): no `terms` (before 24 Sep 2026: "free forever"), the 24 to 29
 * Sep stamp and the 29 Sep to 12 Nov stamp. Those clinicians were told the
 * dashboard was free, and it stays free for them, forever. Nothing else is.
 */
export function dashboardPromised(acct: unknown): boolean {
  if (!acct || typeof acct !== "object" || Array.isArray(acct)) return false;
  if (grandfathered(acct)) return true;
  const t = (acct as { terms?: unknown }).terms;
  return t === FREE_SELF_TERMS || t === CASELOAD_TERMS;
}

/**
 * IS THE DASHBOARD OPEN? Every account made before 12 Nov 2026 was told the
 * dashboard was free, and it stays free for them, forever: a clinician's
 * caseload, notes and homework are never held behind a price they were not
 * shown (dashboardPromised). Everyone else needs a plan: Sona Pro, or (17
 * Nov 2026) Sona Clinic, owned or joined (clinicStatus), each trialing,
 * active, or in the card-retry grace of past_due. That is the 12 Nov
 * accounts (`terms: PRO_TERMS`) and, since 17 Nov 2026 (SLPPRO1, Travis: "i
 * want this to be sona pro tho. this is what they access when they create a
 * free trial"), the homepage's free-dashboard signups of 13 to 17 Nov
 * (FREE_DASHBOARD_TERMS, "Move them to the trial") and any account a
 * free-dashboard link once opened (`freeDashboard: true`, no longer read).
 * One who never had Sona Pro or Sona Clinic is offered the 14-day trial
 * (proStatus).
 * A signed-in session with no account record at all is treated as new.
 * App Review's one account stays open (reviewEmail). The promised stamps
 * answer from the account alone, with no Stripe call, in that order: App
 * Review, the stamp, then Sona Pro, then Sona Clinic.
 */
export async function dashboardOpen(email: string, opts: PlanOpts & { acct?: Record<string, unknown> | null } = {}): Promise<boolean> {
  const kv = opts.kv || kvCmd;
  const review = reviewEmail();
  if (review && norm(email) === review) return true;
  const acct = opts.acct !== undefined ? opts.acct : await readAcct(email, kv);
  if (dashboardPromised(acct)) return true;
  if ((await proStatus(email, { ...opts, kv })).active) return true;
  return (await clinicStatus(email, { ...opts, kv })).active;
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
): Promise<{ activated: boolean; kind?: PlanKind; reason?: string; subId?: string; status?: string }> {
  const kv = opts.kv || kvCmd;
  const now = opts.now ?? Date.now();
  const stripe = stripeClient(opts.stripe);
  if (!stripe) return { activated: false, reason: "stripe not configured" };
  const cs = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  const md = cs.metadata || {};
  // A Clinic plan is the OWNER's (md.slp is the buyer), so it is activated
  // only for the owner's own session, like every other plan.
  const kind: PlanKind | null = md.plan === CASELOAD_PLAN ? "caseload" : md.plan === SELF_PLAN ? "self"
    : md.plan === PRO_PLAN ? "pro" : md.plan === CLINIC_PLAN ? "clinic" : null;
  if (!kind) return { activated: false, reason: "not a clinician plan" };
  // A /plans checkout opened with no email (26 Nov 2026) has no `slp` on the
  // session: its owner is the email Stripe's page asked for (lib/plansClaim
  // stamps it on the subscription, which isPlanFor below still checks).
  const owner = md.slp || (md.from === "plans" && md.plan === PRO_PLAN && cs.customer_details ? cs.customer_details.email || "" : "");
  if (!norm(email) || norm(owner) !== norm(email)) return { activated: false, reason: "bought by another account" };
  if (cs.status !== "complete") return { activated: false, reason: "checkout not complete" };
  let sub = cs.subscription as Stripe.Subscription | string | null;
  if (typeof sub === "string") sub = await stripe.subscriptions.retrieve(sub);
  if (!sub || !isPlanFor(sub, email, kind)) return { activated: false, reason: "no " + kind + " subscription" };
  await writePlan(email, recordFromSubscription(sub, now), kv, kind);
  return { activated: true, kind, subId: sub.id, status: sub.status };
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
 * The clinician's OWN free Premium, as the 24 to 29 Sep 2026 accounts were
 * promised it: a work address, or a founder's approval for someone who has
 * none (lib/workEmail says why). selfStatus() reads it for those accounts
 * only; from 29 Sep a clinician's own Premium is bought.
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
