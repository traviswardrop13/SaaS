import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  kvCmd, kvConfigured, randomToken, hashToken, sendMagicEmail,
  signSession, sessionCookie, SESSION_MAX_AGE, authSecretOk, clinicianRole, clinicianWorkSetting, signFreeDashboardSignup, replaceSlpAccount,
} from "@/lib/slpAuth";
import { contactsConfigured } from "@/lib/contacts";
import { PRO_TERMS } from "@/lib/caseload";
import { safeAttrib, tellCrm } from "@/lib/slpLead";

export const runtime = "nodejs";

/**
 * FOUNDER HEALTH CHECK — open it in a browser and see whether the sign-up
 * funnel is actually wired in THIS deployment. Presence booleans only, never
 * values, exactly as /api/lead does it.
 *
 * It exists because an ad can be live and spending while a missing
 * environment variable quietly fails every sign-up: the clinician sees a
 * shrug, and nothing in the logs says which rail is down. `ready` is the
 * one number that matters — false means do not spend.
 */
export async function GET() {
  const signing = authSecretOk();
  const store = kvConfigured();
  return NextResponse.json({
    ok: true,
    service: "slp-signup",
    ready: signing && store,
    signing,                                        // SLP_AUTH_SECRET (or non-production)
    store,                                          // KV / Upstash
    email: Boolean(process.env.RESEND_API_KEY),     // the link can actually be delivered
    // The lead reaches an email list: Resend's contacts since 16 Oct 2026
    // (Kit from 24 Sep); the webhook is the retired GoHighLevel rail, so
    // deleting LEAD_WEBHOOK_URL must not turn this false while Resend takes
    // every sign-up.
    crm: contactsConfigured() || Boolean(process.env.LEAD_WEBHOOK_URL),
    list: contactsConfigured(),
  });
}

// Constant-time string compare (avoids leaking the admin key via timing).
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// POST { email, adminKey?, source?, clinicianRole?, workSetting?, flow? } → email a single-use magic sign-in link,
// and, for an account that does not exist yet, sign the clinician straight in.
//
// Admin override: when SLP_ADMIN_KEY is set (>= 8 chars) AND a matching adminKey
// is supplied, the link is returned in the response so the operator can hand it
// to a pilot SLP directly — before Resend/email is configured. Without the key
// the link is only ever emailed; it is never returned to the caller.
export async function POST(req: NextRequest) {
  let body: {
    email?: string; adminKey?: string; source?: string; name?: string; attrib?: unknown;
    clinicianRole?: unknown; workSetting?: unknown; flow?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }
  const freeDashboard = body.flow === "free-dashboard";
  if (body.flow !== undefined && !freeDashboard) {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const role = clinicianRole(body.clinicianRole);
  if ((freeDashboard || body.clinicianRole !== undefined) && !role) {
    return NextResponse.json({ ok: false, error: "Choose SLP or SLPA." }, { status: 400 });
  }
  const workSetting = clinicianWorkSetting(body.workSetting);
  if ((freeDashboard || body.workSetting !== undefined) && workSetting !== "clinic" && workSetting !== "school") {
    return NextResponse.json({ ok: false, error: "Choose Clinic or School." }, { status: 400 });
  }
  if (!kvConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Accounts aren't enabled yet — a data store needs to be connected." },
      { status: 503 },
    );
  }

  /**
   * FAIL BEFORE ANYTHING IS WRITTEN, NOT HALFWAY THROUGH. Without a signing
   * secret, signSession() throws — but by then this route has already stored
   * the account, so the clinician's RETRY takes the "account exists" path and
   * only ever gets an emailed link, which cannot verify either. One missing
   * environment variable would lock a real clinician out permanently and give
   * them a network error to explain it.
   *
   * So the check happens first, above the token, the account and the CRM ping,
   * and says what it is in plain words. GET / on this route reports it too.
   */
  if (!authSecretOk()) {
    return NextResponse.json(
      { ok: false, error: "Sign-in isn't switched on for this deployment yet. Email hello@speaksona.com and we'll get you in." },
      { status: 503 },
    );
  }

  const adminSecret = process.env.SLP_ADMIN_KEY || "";
  const isAdmin =
    adminSecret.length >= 8 &&
    typeof body.adminKey === "string" &&
    safeEqual(body.adminKey, adminSecret);

  // Light rate limit: max 5 link requests per email per hour (admins bypass).
  if (!isAdmin) {
    const rl = "slprl:" + email;
    const n = await kvCmd(["INCR", rl]);
    if (n === 1) await kvCmd(["EXPIRE", rl, 3600]);
    if (typeof n === "number" && n > 5) {
      if (freeDashboard) {
        return NextResponse.json({ ok: false, error: "Too many links requested. Try again in an hour." }, { status: 429 });
      }
      return NextResponse.json({ ok: true, sent: true, devLink: null }); // silently cap
    }
  }

  const origin = new URL(req.url).origin;

  if (freeDashboard && role && (workSetting === "clinic" || workSetting === "school")) {
    // The emailed token proves the inbox before an account or session exists.
    const token = randomToken();
    const pending = signFreeDashboardSignup({
      email, clinicianRole: role, workSetting,
      source: String(body.source || "for-slps").slice(0, 40), attrib: safeAttrib(body.attrib),
    });
    const key = "slptok:" + hashToken(token);
    if (await kvCmd(["SET", key, pending, "EX", 900]) !== "OK") {
      return NextResponse.json({ ok: false, error: "Couldn't make your sign-in link. Try again." }, { status: 503 });
    }
    const link = origin + "/api/slp/auth/verify?token=" + encodeURIComponent(token);
    const res = await sendMagicEmail(email, link, "", { freeDashboard: true });
    const devLink = isAdmin ? link : res.devLink;
    if (!res.sent && !devLink) await kvCmd(["DEL", key]);
    return NextResponse.json({ ok: true, sent: res.sent, signedIn: false, devLink });
  }

  /**
   * A BRAND-NEW ACCOUNT IS SIGNED IN ON THE SPOT. Cold traffic off an ad does
   * not go to its inbox and come back — the email step is where a funnel
   * leaks — and on the very first request there is nothing behind the door to
   * protect: the account does not exist, so it has no code, no families and no
   * children. The link is still emailed, because that is how they get back in
   * tomorrow.
   *
   * An account that ALREADY EXISTS gets the link and nothing else. By then it
   * may hold a caseload, and a caseload is children — that door needs the
   * proof that someone can read the inbox.
   *
   * "Does not exist" means the store SAID so (null). A store that did not
   * answer (undefined) is treated as "exists" — the emailed-link path, which
   * writes nothing — because the new-account branch below would overwrite a
   * real clinician's account whole: their code, their family key and, since
   * 24 Sep 2026, the missing `terms` field that is their grandfathered
   * "free forever" promise.
   */
  const acctKey = "slpacct:" + email;
  let acctRaw: unknown = null;
  let acctExists = false;
  try { acctRaw = await kvCmd(["GET", acctKey]); acctExists = acctRaw !== null; } catch { acctExists = true; }

  // The name they gave at sign-up is the name on their homework notes, so the
  // dashboard does not have to ask for it a second time.
  //
  // The legacy signup path carries PRO_TERMS. Existing accounts keep their original
  // plan terms, including the free dashboard and grandfathered coverage.
  const name = String(body.name || "").trim().slice(0, 60);
  const acctNew = {
    email, name, clinic: "", code: "", createdAt: new Date().toISOString(),
    source: String(body.source || "").slice(0, 40),
    terms: PRO_TERMS,
    ...(role ? { clinicianRole: role } : {}),
    ...(workSetting ? { workSetting } : {}),
  };
  // Claim the new record before sending its link. A fast email verification
  // or another signup cannot create an empty record ahead of this write.
  const created = acctExists ? null : await kvCmd(["SET", "slpacct:" + email, JSON.stringify(acctNew), "NX"]);
  if (created !== "OK" && created !== null) {
    return NextResponse.json({ ok: false, error: "Couldn't save your account just now. Try again in a moment." }, { status: 503 });
  }

  const token = randomToken();
  await kvCmd(["SET", "slptok:" + hashToken(token), email, "EX", 900]); // 15 min
  const link = origin + "/api/slp/auth/verify?token=" + encodeURIComponent(token);
  const res = await sendMagicEmail(email, link, name);

  if (acctExists) {
    /**
     * A CLINICIAN THE CRM HAS NEVER HEARD OF. The CRM was told only when THIS
     * route created the account, so everyone whose account was made another
     * way — by the magic-link verify route, or before the CRM was wired on
     * 22 Sep 2026 — was invisible to GoHighLevel however often they signed
     * in. Travis found it signing up with his own address: the dashboard
     * email arrived, and GoHighLevel never heard of him.
     *
     * So the account carries crmAt once the CRM has taken the lead. Without
     * it, the lead goes on this sign-in, once; with it, never again, because
     * a daily sign-in is not a daily "new signup". The name sent is the one
     * already on the account when there is one — this request is not signed
     * in, so it may inform the CRM but never rewrites the account.
     */
    let acct: Record<string, unknown> | null = null;
    try { acct = acctRaw ? JSON.parse(String(acctRaw)) : null; } catch { acct = null; }
    if (acct && !acct.crmAt && typeof acctRaw === "string") {
      const crmName = String(acct.name || body.name || "").trim().slice(0, 60);
      if (await tellCrm(origin, email, String(body.source || "slp-signup").slice(0, 40), crmName, safeAttrib(body.attrib))) {
        acct.crmAt = new Date().toISOString();
        await replaceSlpAccount(acctKey, acctRaw, acct);
      }
    }
    return NextResponse.json({ ok: true, sent: res.sent, signedIn: false, devLink: isAdmin ? link : res.devLink });
  }

  // A concurrent request won the account. This request gets the email link.
  if (created !== "OK") {
    return NextResponse.json({ ok: true, sent: res.sent, signedIn: false, devLink: isAdmin ? link : res.devLink });
  }
  const crm = tellCrm(origin, email, String(body.source || "slp-signup").slice(0, 40), name, safeAttrib(body.attrib));

  const session = signSession({ email, code: "", iat: Date.now(), exp: Date.now() + SESSION_MAX_AGE * 1000 });
  // Stamped only when the CRM took it: a miss is retried on the next sign-in.
  const captured = await crm;
  if (captured) await replaceSlpAccount(acctKey, JSON.stringify(acctNew), { ...acctNew, crmAt: new Date().toISOString() });
  const out = NextResponse.json({ ok: true, sent: res.sent, signedIn: true, devLink: isAdmin ? link : res.devLink });
  out.headers.set("Set-Cookie", sessionCookie(session, SESSION_MAX_AGE));
  return out;
}
