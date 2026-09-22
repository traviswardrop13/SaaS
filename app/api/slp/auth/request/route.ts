import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  kvCmd, kvConfigured, randomToken, hashToken, sendMagicEmail,
  signSession, sessionCookie, SESSION_MAX_AGE,
} from "@/lib/slpAuth";

export const runtime = "nodejs";

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
