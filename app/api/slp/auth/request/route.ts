import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  kvCmd, kvConfigured, randomToken, hashToken, sendMagicEmail,
  authSecretOk, clinicianRole, clinicianWorkSetting, signFreeDashboardSignup, replaceSlpAccount,
} from "@/lib/slpAuth";
import { contactsConfigured } from "@/lib/contacts";
import { safeAttrib, tellCrm } from "@/lib/slpLead";
import { rateLimit } from "@/lib/rateLimit";

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

// POST { email, adminKey?, source?, clinicianRole?, workSetting?, flow? } → email a single-use magic sign-in link.
// Nobody is signed in here: only opening the emailed link signs in (13 Nov 2026).
//
// Admin override: when SLP_ADMIN_KEY is set (>= 8 chars) AND a matching adminKey
// is supplied, the link is returned in the response so the operator can hand it
// to a pilot SLP directly — before Resend/email is configured. Without the key
// the link is only ever emailed; it is never returned to the caller.
export async function POST(req: NextRequest) {
  let body: {
    email?: string; adminKey?: string; source?: string; attrib?: unknown;
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
  // Role and work setting are optional (Travis, 14 Nov 2026: the sign-up form
  // asks for an email only). A caller that sends one must send a real value.
  const role = clinicianRole(body.clinicianRole);
  if (body.clinicianRole !== undefined && !role) {
    return NextResponse.json({ ok: false, error: "Choose SLP or SLPA." }, { status: 400 });
  }
  const workSetting = clinicianWorkSetting(body.workSetting);
  if (body.workSetting !== undefined && workSetting !== "clinic" && workSetting !== "school") {
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

  // Every call emails someone, so one address (an IPv6 /64) may ask for at
  // most 20 links an hour, whatever emails it names (audit B2, 13 Nov 2026).
  // An hour at most: the privacy page keeps an IP no longer than that.
  if (!isAdmin) {
    const limited = await rateLimit(req, { key: "slpauth", limit: 20, windowSec: 3600, v6prefix: true });
    if (limited) return limited;
  }

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

  if (freeDashboard) {
    // The emailed token proves the inbox before an account or session exists.
    const token = randomToken();
    const pending = signFreeDashboardSignup({
      email,
      ...(role ? { clinicianRole: role } : {}),
      ...(workSetting === "clinic" || workSetting === "school" ? { workSetting } : {}),
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
   * EVERY EMAIL PROVES ITS INBOX FIRST (Travis, 13 Nov 2026). Until then a
   * brand-new email was given an account and signed in on the spot, so cold
   * traffic would not leak at the inbox step. But that let anyone sit in a
   * real clinician's future account under her address, with a cookie nothing
   * could take back (audit B3). Now this route only emails the link: no
   * account, no cookie, no CRM ping. The verify route makes the account
   * (Sona Pro terms, as before), tells the CRM, and ends every session issued
   * before that first inbox-proved sign-in.
   *
   * Nothing here writes an account, so a store that did not answer can no
   * longer overwrite a real one, or its grandfathered missing `terms`.
   */
  const acctKey = "slpacct:" + email;
  let acctRaw: unknown = null;
  try { acctRaw = await kvCmd(["GET", acctKey]); } catch { acctRaw = undefined; }
  let acct: Record<string, unknown> | null = null;
  try { acct = typeof acctRaw === "string" ? JSON.parse(acctRaw) : null; } catch { acct = null; }

  // The greeting is the name the account already holds, never one from this
  // request: a signed-out caller could make Sona email any clinician "Hi
  // <their words>," (audit B2).
  const name = acct ? String(acct.name || "").trim().slice(0, 60) : "";

  const token = randomToken();
  await kvCmd(["SET", "slptok:" + hashToken(token), email, "EX", 900]); // 15 min
  const link = origin + "/api/slp/auth/verify?token=" + encodeURIComponent(token);
  const res = await sendMagicEmail(email, link, name);

  /**
   * A CLINICIAN THE CRM HAS NEVER HEARD OF. The CRM was once told only when
   * this route created the account, so everyone whose account was made
   * another way — before the CRM was wired on 22 Sep 2026, say — was
   * invisible to GoHighLevel however often they signed in. Travis found it
   * signing up with his own address: the dashboard email arrived, and
   * GoHighLevel never heard of him. (Since 13 Nov 2026 a new account is
   * made, and the CRM told, by the verify route.)
   *
   * So the account carries crmAt once the CRM has taken the lead. Without
   * it, the lead goes on this sign-in, once; with it, never again, because
   * a daily sign-in is not a daily "new signup". The name sent is the one
   * already on the account — this request is not signed in, so it may
   * inform the CRM but never rewrites the account.
   */
  if (acct && !acct.crmAt && typeof acctRaw === "string") {
    if (await tellCrm(origin, email, String(body.source || "slp-signup").slice(0, 40), name, safeAttrib(body.attrib))) {
      acct.crmAt = new Date().toISOString();
      await replaceSlpAccount(acctKey, acctRaw, acct);
    }
  }
  return NextResponse.json({ ok: true, sent: res.sent, signedIn: false, devLink: isAdmin ? link : res.devLink });
}
