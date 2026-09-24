import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  kvCmd, kvConfigured, randomToken, hashToken, sendMagicEmail,
  signSession, sessionCookie, SESSION_MAX_AGE, authSecretOk, leadSig,
} from "@/lib/slpAuth";
import { kitConfigured } from "@/lib/kit";
import { CASELOAD_TERMS } from "@/lib/caseload";

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
    // The lead reaches an email list. Kit since 24 Sep 2026; the webhook is
    // the retired GoHighLevel rail, so deleting LEAD_WEBHOOK_URL must not
    // turn this false while Kit is taking every sign-up.
    crm: kitConfigured() || Boolean(process.env.LEAD_WEBHOOK_URL),
    kit: kitConfigured(),
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
 * Which ad produced this clinician. An ALLOW-LIST, copied in spirit from
 * /api/lead's safeLead: the object arrives from a page a stranger can put any
 * query string on, so a field that is not named here does not travel. A
 * deny-list is how `name: child` once sailed into a marketing payload.
 */
const ATTRIB_KEYS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "fbclid", "referrer", "landing",
] as const;

function safeAttrib(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;
  for (const k of ATTRIB_KEYS) {
    const v = src[k];
    if (typeof v === "string" && v) out[k] = v.slice(0, k === "referrer" ? 200 : 120);
  }
  return out;
}

/**
 * Tell the founder's email list that a clinician signed up. /api/lead is
 * the one place any opt-in goes (it sends to Kit; GoHighLevel, the list before
 * it, was deleted 24 Sep 2026), so this reuses it rather than growing a
 * second rail.
 *
 * AWAITED, WITH A SHORT FUSE — NOT FIRE-AND-FORGET. This used to be
 * `void fetch(...)` so a CRM hiccup could never cost a clinician their
 * sign-in. But on Vercel a function can be frozen the moment its response
 * is sent, and a fetch nobody awaits may never leave: the clinician signs up,
 * the dashboard works, and GoHighLevel never hears about them. Nothing
 * errors, so nothing says so. The fuse keeps the first promise — after
 * CRM_TIMEOUT_MS the sign-in goes ahead regardless — and awaiting keeps the
 * second. It runs alongside the rest of sign-up, so it costs nothing on the
 * usual path.
 *
 * The clinician's OWN first name — the one they typed about themselves.
 * Never a child's, which is the rule everywhere and has no exception in a
 * marketing payload of all places.
 */
// Long enough for Kit's create + form + tag calls (lib/kit fuses each at
// 2.5s, run side by side), which usually finish in well under a second.
const CRM_TIMEOUT_MS = 8000;
async function tellCrm(
  origin: string, email: string, source: string, name: string, attrib: Record<string, string>,
): Promise<boolean> {
  const ctl = new AbortController();
  const fuse = setTimeout(() => ctl.abort(), CRM_TIMEOUT_MS);
  try {
    const r = await fetch(origin + "/api/lead", {
      method: "POST",
      // signed, so /api/lead's per-address flood limit never catches it
      headers: { "Content-Type": "application/json", "x-sona-lead-sig": leadSig(email) },
      body: JSON.stringify({ email, name, source, role: "slp", summary: "New SLP signup", ...attrib }),
      signal: ctl.signal,
    });
    const j = (await r.json().catch(() => null)) as { captured?: boolean } | null;
    if (!r.ok || !j || !j.captured) console.error("[slp signup] CRM did not capture the lead:", r.status, j);
    return !!(r.ok && j && j.captured);
  } catch (e) {
    console.error("[slp signup] CRM call failed:", e instanceof Error ? e.message : String(e));
    return false; /* never blocks sign-in */
  } finally {
    clearTimeout(fuse);
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
  let body: { email?: string; adminKey?: string; source?: string; name?: string; attrib?: unknown };
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
   *
   * "Does not exist" means the store SAID so (null). A store that did not
   * answer (undefined) is treated as "exists" — the emailed-link path, which
   * writes nothing — because the new-account branch below would overwrite a
   * real clinician's account whole: their code, their family key and, since
   * 24 Sep 2026, the missing `terms` field that is their grandfathered
   * "free forever" promise.
   */
  let acctRaw: unknown = null;
  let acctExists = false;
  try { acctRaw = await kvCmd(["GET", "slpacct:" + email]); acctExists = acctRaw !== null; } catch { acctExists = true; }

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
    if (acct && !acct.crmAt) {
      const crmName = String(acct.name || body.name || "").trim().slice(0, 60);
      if (await tellCrm(origin, email, String(body.source || "slp-signup").slice(0, 40), crmName, safeAttrib(body.attrib))) {
        acct.crmAt = new Date().toISOString();
        await kvCmd(["SET", "slpacct:" + email, JSON.stringify(acct)]);
      }
    }
    return NextResponse.json({ ok: true, sent: res.sent, signedIn: false, devLink: isAdmin ? link : res.devLink });
  }

  // The name they gave at sign-up is the name on their homework notes, so the
  // dashboard does not have to ask for it a second time.
  //
  // `terms` is the caseload-plan rule (lib/caseload, 24 Sep 2026): an account
  // made from this build on carries it and its caseload is covered only by
  // the $79.99 plan. An account WITHOUT it predates the plan and keeps the
  // "free forever, every kid on your caseload" promise it signed up under.
  // Structural, not a date — so it is stamped on every new account, here and
  // in the verify and account routes, and never on an existing one.
  const name = String(body.name || "").trim().slice(0, 60);
  const acctNew = {
    email, name, clinic: "", code: "", createdAt: new Date().toISOString(),
    source: String(body.source || "").slice(0, 40),
    terms: CASELOAD_TERMS,
  };
  await kvCmd(["SET", "slpacct:" + email, JSON.stringify(acctNew)]);
  const crm = tellCrm(origin, email, String(body.source || "slp-signup").slice(0, 40), name, safeAttrib(body.attrib));

  const session = signSession({ email, code: "", iat: Date.now(), exp: Date.now() + SESSION_MAX_AGE * 1000 });
  // Stamped only when the CRM took it: a miss is retried on the next sign-in.
  const captured = await crm;
  if (captured) await kvCmd(["SET", "slpacct:" + email, JSON.stringify({ ...acctNew, crmAt: new Date().toISOString() })]);
  const out = NextResponse.json({ ok: true, sent: res.sent, signedIn: true, devLink: isAdmin ? link : res.devLink });
  out.headers.set("Set-Cookie", sessionCookie(session, SESSION_MAX_AGE));
  return out;
}
