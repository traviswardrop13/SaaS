import crypto from "node:crypto";
import { kvCmd, replaceSlpAccount } from "@/lib/slpAuth";
import { currentPlan, type Kv, type PlanOpts } from "@/lib/caseload";

/**
 * SHARE & EARN (REFER1, 20 Nov 2026). Travis: "every person who creates a
 * trial like SLP or SLPA gets an affiliate link that they can share with
 * other SLPs to earn $8 a month per active customer so that they get the
 * product free as long as they have 3 active paying customers"; asked, he
 * chose real cash payouts (not a bill credit).
 *
 * THERAPIST TO THERAPIST ONLY. A clinician earns on another CLINICIAN who
 * signs up through their link and pays for Sona Pro (or owns Sona Clinic).
 * Never on a family: families buy Premium in the iPhone app, and nothing a
 * family does is ever looked at here, so the creator-only rule in CLAUDE.md
 * (no clinician earns on their own caseload) holds by construction.
 *
 * - Each account gets one code (`refCode` on the account, `slpref:<code>` →
 *   email), made the first time its dashboard asks. The link is
 *   app.speaksona.com/?ref=<code>.
 * - The trial page keeps the code for 60 days and sends it with the sign-up.
 *   Only a BRAND-NEW account takes it (`referredBy`, set once, at creation,
 *   lib/slpSignIn finishSignIn), never an existing one, never your own.
 * - "Paying" is a Sona Pro (or owned Sona Clinic) subscription in status
 *   `active`: past its free trial and paid. Trialing, past_due, cancelled
 *   and ended do not count.
 * - Nothing is paid by the code. /leads.html's "Referrals" lists who earned
 *   what this month; Travis pays by hand (and owes a 1099 for anyone paid
 *   $600 or more in a year).
 */
export const REFERRAL_CENTS = 800;
export const REFERRAL_PAY = "$8";
export const REF_RE = /^[a-z0-9]{8}$/;
const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";

export const refKey = (code: string) => "slpref:" + code;
export const referredKey = (email: string) => "slpreferred:" + email.trim().toLowerCase();
export const REFERRERS = "slpreferrers";

export function cleanRef(v: unknown): string {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return REF_RE.test(s) ? s : "";
}

function makeCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHA[crypto.randomInt(0, ALPHA.length)];
  return out;
}

/** This account's code, made once. "" when the store did not answer. */
export async function refCodeFor(email: string, kv: Kv = kvCmd): Promise<string> {
  const acctKey = "slpacct:" + email;
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await kv(["GET", acctKey]);
    if (typeof raw !== "string") return "";
    let acct: Record<string, unknown>;
    try { acct = JSON.parse(raw); } catch { return ""; }
    if (typeof acct.refCode === "string" && REF_RE.test(acct.refCode)) return acct.refCode;
    const code = makeCode();
    if ((await kv(["SET", refKey(code), email, "NX"])) !== "OK") continue;
    if ((await replaceSlpAccount(acctKey, raw, { ...acct, refCode: code })) === "OK") return code;
    await kv(["DEL", refKey(code)]);
  }
  return "";
}

/** Who a code belongs to, unless it is the new account's own. */
export async function referrerFor(ref: string, newEmail: string, kv: Kv = kvCmd): Promise<string> {
  const code = cleanRef(ref);
  if (!code) return "";
  const who = await kv(["GET", refKey(code)]);
  if (typeof who !== "string" || !who) return "";
  return who.toLowerCase() === newEmail.toLowerCase() ? "" : who;
}

/** Remember the link between the two, once the new account exists. */
export async function recordReferral(referrer: string, newEmail: string, kv: Kv = kvCmd): Promise<void> {
  await kv(["SADD", referredKey(referrer), newEmail]);
  await kv(["SADD", REFERRERS, referrer]);
}

export type ReferralStats = { signedUp: number; trialing: number; paying: number; monthlyCents: number };

/** A referred clinician pays when a Pro (or owned Clinic) plan is `active`. */
export async function referralStats(email: string, opts: PlanOpts = {}): Promise<ReferralStats> {
  const kv = opts.kv ?? kvCmd;
  const raw = await kv(["SMEMBERS", referredKey(email)]);
  const members = Array.isArray(raw) ? (raw as unknown[]).filter((m): m is string => typeof m === "string").slice(0, 300) : [];
  let trialing = 0, paying = 0;
  for (const m of members) {
    let pay = false, trial = false;
    for (const kind of ["pro", "clinic"] as const) {
      try {
        const rec = await currentPlan(m, { ...opts, kind });
        if (rec && rec.status === "active") pay = true;
        else if (rec && rec.status === "trialing") trial = true;
      } catch { /* one Stripe hiccup costs that row this time, never the page */ }
    }
    if (pay) paying++; else if (trial) trialing++;
  }
  return { signedUp: members.length, trialing, paying, monthlyCents: paying * REFERRAL_CENTS };
}

export function dollars(cents: number): string {
  return "$" + (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100));
}
