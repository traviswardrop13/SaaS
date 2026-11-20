import crypto from "node:crypto";
import {
  kvCmd, hashToken, safeEqualStr, signSession, sessionCookie, SESSION_MAX_AGE,
  readFreeDashboardSignup, replaceSlpAccount, signFreeDashboardSignup,
} from "@/lib/slpAuth";
import { PRO_TERMS, reviewEmail } from "@/lib/caseload";
import { safeAttrib, tellCrm } from "@/lib/slpLead";
import { referrerFor, recordReferral } from "@/lib/referral";

/**
 * SIGNING IN INSIDE AN APP (SLPAPP1, 16 Nov 2026; Travis: "start building the
 * SLP dashboard mobile app"). The emailed link opens in Safari, and an iPhone
 * app keeps its own cookies, so a link can never sign the app in. The same
 * email now carries a six-digit code too, typed on the sign-in screen: it
 * proves the inbox exactly as the link does, and signs in whatever screen it
 * is typed on (the app, or a browser on another computer).
 *
 * One live code an email (`slpsignin:<email>`), 15 minutes, used once, and
 * five wrong tries end it (`slpsignintry:<email>`): with at most five emails
 * an hour per address, that is 25 guesses an hour at a million codes. Only a
 * hash of the code is kept, and the code route has its own per-IP limit.
 */
export const SIGNIN_CODE_TTL = 900;
export const SIGNIN_CODE_TRIES = 5;
export const signInCodeKey = (email: string) => "slpsignin:" + email;
export const signInTryKey = (email: string) => "slpsignintry:" + email;

export function makeSignInCode(): string {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}
/** Only the digits a person typed: "482 913" and "482-913" are 482913. */
export function cleanSignInCode(v: unknown): string {
  const d = String(v == null ? "" : v).replace(/[\s-]/g, "");
  return /^\d{6}$/.test(d) ? d : "";
}
const codeHash = (email: string, code: string) => hashToken("signin:" + email + ":" + code);

/** Keep a fresh code for this email, beside the link token it was sent with. */
export async function storeSignInCode(email: string, code: string, stored: string, linkKey: string): Promise<boolean> {
  const rec = JSON.stringify({ h: codeHash(email, code), p: stored, k: linkKey });
  const ok = await kvCmd(["SET", signInCodeKey(email), rec, "EX", SIGNIN_CODE_TTL]);
  if (ok !== "OK") return false;
  await kvCmd(["DEL", signInTryKey(email)]);
  return true;
}

/**
 * THE REVIEWER'S DOOR (App Review cannot read an email). Only while both
 * SLP_REVIEW_EMAIL and SLP_REVIEW_CODE are set in Vercel, and only for that
 * one address: no email is sent to it, and its fixed code signs it in like any
 * other. Its dashboard stays open without Sona Pro (dashboardOpen in
 * lib/caseload, where reviewEmail lives since SLPPRO1, 17 Nov 2026), so Apple
 * can review an app that sells nothing. Unset either and it is gone. The
 * five-tries rule holds for it too.
 */
export { reviewEmail };

export type CodeCheck =
  | { ok: true; stored: string }
  | { ok: false; why: "wrong" | "gone" | "tries" | "store" };

export async function checkSignInCode(email: string, code: string): Promise<CodeCheck> {
  const n = await kvCmd(["INCR", signInTryKey(email)]);
  if (typeof n !== "number") return { ok: false, why: "store" };
  if (n === 1) await kvCmd(["EXPIRE", signInTryKey(email), SIGNIN_CODE_TTL]);
  if (n > SIGNIN_CODE_TRIES) {
    await kvCmd(["DEL", signInCodeKey(email)]);
    return { ok: false, why: "tries" };
  }
  const review = reviewEmail();
  if (review && email === review) {
    if (!safeEqualStr(code, cleanSignInCode(process.env.SLP_REVIEW_CODE))) return { ok: false, why: "wrong" };
    await kvCmd(["DEL", signInTryKey(email)]);
    return { ok: true, stored: signFreeDashboardSignup({ email, source: "app-review", attrib: {} }) };
  }
  const raw = await kvCmd(["GET", signInCodeKey(email)]);
  if (raw === undefined) return { ok: false, why: "store" };
  let rec: { h?: string; p?: string; k?: string } | null = null;
  try { rec = typeof raw === "string" ? JSON.parse(raw) : null; } catch { rec = null; }
  if (!rec || typeof rec.h !== "string" || typeof rec.p !== "string") return { ok: false, why: "gone" };
  if (!safeEqualStr(rec.h, codeHash(email, code))) return { ok: false, why: "wrong" };
  // Used once: of two right answers at the same moment, one signs in.
  const won = await kvCmd(["GETDEL", signInCodeKey(email)]);
  if (typeof won !== "string") return { ok: false, why: "gone" };
  await kvCmd(["DEL", signInTryKey(email)]);
  if (typeof rec.k === "string" && rec.k.startsWith("slptok:")) await kvCmd(["DEL", rec.k]);
  return { ok: true, stored: rec.p };
}

/**
 * `fresh`: this sign-in made the account (TRIALGO1, 17 Nov 2026). A brand-new
 * clinician on the web goes straight from the email to Stripe's card page for
 * Sona Pro's free trial, with no stop on the locked dashboard first.
 */
export type SignInResult = { ok: true; cookie: string; email: string; fresh: boolean } | { ok: false; err: "expired" | "store" };

/**
 * What the emailed link, or the code, has proved: the inbox is real. Make the
 * account if the store says there is none, end every session from before the
 * inbox was first proved, and sign in. Moved here from /api/slp/auth/verify
 * unchanged (16 Nov 2026), so the link and the code share it. (The Sona
 * Clinic invite link signed in through it from 17 to 18 Nov 2026; it only
 * joins now: /api/slp/team/accept says why.)
 *
 * EVERY NEW ACCOUNT IS SONA PRO'S (SLPPRO1, 17 Nov 2026, Travis: "i want this
 * to be sona pro tho. this is what they access when they create a free
 * trial"). From 13 to 17 Nov the homepage's door made free-dashboard accounts
 * (FREE_DASHBOARD_TERMS) and opened a returning Pro-era account's dashboard
 * for good (`freeDashboard: true`); now every door makes PRO_TERMS, keeps
 * where the clinician came from (source, role, setting), and opens nothing:
 * the dashboard asks for Sona Pro or Sona Clinic, whose first 14 days are
 * free. App Review's address is no exception here: its dashboard is opened by
 * dashboardOpen (lib/caseload reviewEmail), keyed on that server-held
 * address, never on the payload's `source`, which is anyone's to send.
 */
export async function finishSignIn(origin: string, stored: unknown): Promise<SignInResult> {
  const signup = typeof stored === "string" ? readFreeDashboardSignup(stored) : null;
  const email = signup?.email ?? stored;
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, err: "expired" };

  const acctKey = "slpacct:" + email;
  let acct: Record<string, unknown> | null = null;
  let raw: unknown = null;
  let fresh = false;
  try {
    raw = await kvCmd(["GET", acctKey]);
    if (raw) acct = JSON.parse(String(raw));
  } catch {
    acct = null;
  }
  // A NEW account only when the store SAID there is none (null). When it did
  // not answer (undefined) nothing is written: an existing account rewritten
  // from scratch would lose its code, its family key and — the absent `terms`
  // field being the whole of it — its grandfathered caseload. They are
  // signed in regardless; the dashboard reads the account itself.
  if (!acct && raw === null) {
    // SHARE & EARN (REFER1): a code from another clinician's link, read once,
    // here, at creation. Never your own, never added to an existing account.
    let referredBy = "";
    if (signup?.ref) { try { referredBy = await referrerFor(signup.ref, email); } catch { referredBy = ""; } }
    const newAccount = {
      email, name: "", clinic: "", code: "", createdAt: new Date().toISOString(),
      terms: PRO_TERMS,
      ...(signup ? {
        ...(signup.clinicianRole ? { clinicianRole: signup.clinicianRole } : {}),
        ...(signup.workSetting ? { workSetting: signup.workSetting } : {}),
        source: signup.source,
      } : {}),
      ...(referredBy ? { referredBy } : {}),
    };
    const snapshot = JSON.stringify(newAccount);
    const created = await kvCmd(["SET", acctKey, snapshot, "NX"]);
    if (created === "OK") {
      acct = newAccount;
      fresh = true;
      if (referredBy) { try { await recordReferral(referredBy, email); } catch { /* the account still says who */ } }
      // Every new account is made here now (13 Nov 2026: the sign-in page no
      // longer makes one before the inbox is proved), so the CRM hears of it
      // here, awaited, once the inbox is real.
      // The sign-in request may already have told the CRM (16 Nov 2026,
      // `slpcrm:` in the request route): then stamp, never send it twice.
      const toldAtRequest = typeof (await kvCmd(["GET", "slpcrm:" + email])) === "string";
      if (toldAtRequest || await tellCrm(origin, email, signup ? signup.source : "slp-signup", "", safeAttrib(signup?.attrib))) {
        // The dashboard may already have been opened using another valid
        // link. Stamp CRM only if the account is still the same snapshot.
        await replaceSlpAccount(acctKey, snapshot, { ...newAccount, crmAt: new Date().toISOString() });
      }
    } else if (created === null) {
      // Another valid link created the account. Load its terms and code.
      const winner = await kvCmd(["GET", acctKey]);
      try { if (typeof winner === "string") acct = JSON.parse(winner); } catch { acct = null; }
    }
  }
  if (signup && !acct) return { ok: false, err: "store" };
  if (!acct) acct = { code: "" };

  // The first sign-in that proved the inbox ends every session issued before
  // it (liveSession in lib/slpAuth). NX: a later sign-in on another device
  // never logs this one out. Its own key, so the account is never rewritten.
  const now = Date.now();
  await kvCmd(["SET", "slpsessfrom:" + email, String(now), "NX"]);
  const session = signSession({
    email,
    code: (acct.code as string) || "",
    iat: now,
    exp: now + SESSION_MAX_AGE * 1000,
  });
  return { ok: true, cookie: sessionCookie(session, SESSION_MAX_AGE), email, fresh };
}
