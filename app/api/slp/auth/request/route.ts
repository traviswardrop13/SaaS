import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  kvCmd, kvConfigured, randomToken, hashToken, sendMagicEmail,
  signSession, sessionCookie, SESSION_MAX_AGE, authSecretOk,
} from "@/lib/slpAuth";

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
    crm: Boolean(process.env.LEAD_WEBHOOK_URL),     // the lead reaches GoHighLevel
  });
}

// Constant-time string compare (avoids leaking the admin key via timing).
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Tell the founder's CRM that a clinician signed up. /api/lead is already
 * wired to LEAD_WEBHOOK_URL (a GoHighLevel inbound workflow) and is the one
 * place any opt-in goes, so this reuses it rather than growing a second rail.
 *
 * Fire-and-forget and never awaited into the response: a CRM hiccup must not
 * cost a clinician their sign-in link. An email and a role — never a child's
 * name, which is the rule everywhere else and has no exception here.
 */
function tellCrm(origin: string, email: string, source: string, name: string): void {
  try {
    void fetch(origin + "/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The clinician's OWN first name — the one they typed about themselves.
      // Never a child's, which is the rule everywhere and has no exception in
      // a marketing payload of all places.
      body: JSON.stringify({ email, name, source, role: "slp", summary: "New SLP signup" }),
    }).catch(() => {});
  } catch {
    /* never blocks sign-in */
  }
}

// POST { email, adminKey?, source? } → email a single-use magic sign-in link,
// and, for an account that does not exist yet, sign the clinician straight in.
//
// Admin override: when SLP_ADMIN_KEY is set (>= 8 chars) AND a matching adminKey
// is supplied, the link is returned in the response so the operator can hand it
// to a pilot SLP directly — before Resend/email is configured. Without the key
// the link is only ever emailed; it is never returned to the caller.
export async function POST(req: NextRequest) {
  let body: { email?: string; adminKey?: string; source?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
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
      return NextResponse.json({ ok: true, sent: true, devLink: null }); // silently cap
    }
  }

  const origin = new URL(req.url).origin;
  const token = randomToken();
  await kvCmd(["SET", "slptok:" + hashToken(token), email, "EX", 900]); // 15 min
  const link = origin + "/api/slp/auth/verify?token=" + encodeURIComponent(token);
  const res = await sendMagicEmail(email, link, String(body.name || "").trim().slice(0, 60));

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
   */
  let acctExists = false;
  try { acctExists = !!(await kvCmd(["GET", "slpacct:" + email])); } catch { acctExists = true; }

  if (acctExists) {
    return NextResponse.json({ ok: true, sent: res.sent, signedIn: false, devLink: isAdmin ? link : res.devLink });
  }

  // The name they gave at sign-up is the name on their homework notes, so the
  // dashboard does not have to ask for it a second time.
  const name = String(body.name || "").trim().slice(0, 60);
  await kvCmd(["SET", "slpacct:" + email, JSON.stringify({
    email, name, clinic: "", code: "", createdAt: new Date().toISOString(),
    source: String(body.source || "").slice(0, 40),
  })]);
  tellCrm(origin, email, String(body.source || "slp-signup").slice(0, 40), name);

  const session = signSession({ email, code: "", iat: Date.now(), exp: Date.now() + SESSION_MAX_AGE * 1000 });
  const out = NextResponse.json({ ok: true, sent: res.sent, signedIn: true, devLink: isAdmin ? link : res.devLink });
  out.headers.set("Set-Cookie", sessionCookie(session, SESSION_MAX_AGE));
  return out;
}
