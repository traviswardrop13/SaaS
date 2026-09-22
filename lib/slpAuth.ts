import crypto from "node:crypto";

/**
 * Magic-link auth for the free SLP master account — the app's first real login.
 *
 * Flow: request a link (email) → we store a single-use token hash in KV and email
 * the link → verify the token → issue a signed, httpOnly session cookie.
 *
 * No passwords. Accounts + tokens live in the same KV store the roster uses, so
 * SLP accounts require KV to be configured (kvConfigured()).
 */

// Stable HMAC secret for sessions. Prefer a dedicated secret; fall back to the KV
// token (already a stable per-deploy secret) so this works without extra setup
// on a preview or a laptop.
const SECRET = () =>
  process.env.SLP_AUTH_SECRET ||
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  "sona-dev-insecure-secret";

/**
 * THE SECRETS A SIGNATURE MAY STILL BE VERIFIED AGAINST, newest first.
 *
 * Adding SLP_AUTH_SECRET CHANGES the key everything was signed with. New
 * signatures are always made with SECRET() — but a family enrolled last month
 * is holding a 400-day ticket signed with the KV token, and their device
 * never asks for a new one. Verify against the new secret alone and every
 * enrolled family stops syncing the moment the secret is set: no homework
 * arrives, no practice reports back, no error anyone would see. The clinician
 * would watch a live caseload go quiet and conclude the families stopped
 * practising.
 *
 * So verification accepts the legacy secret too, and only verification.
 * Nothing is signed with it, so the window closes by itself as tickets age
 * out, and a forger still cannot mint anything: minting needs SECRET(), which
 * in production is the dedicated secret or nothing at all.
 */
function verifySecrets(): string[] {
  const out = [SECRET()];
  const legacy = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (legacy && legacy !== out[0]) out.push(legacy);
  return out;
}

/** True when `body` carries a valid signature from any secret we still honour. */
function sigOk(body: string, sig: string): boolean {
  const given = Buffer.from(sig);
  for (const secret of verifySecrets()) {
    const expected = Buffer.from(crypto.createHmac("sha256", secret).update(body).digest("base64url"));
    if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return true;
  }
  return false;
}

/**
 * IN PRODUCTION THE SIGNING SECRET MUST BE ITS OWN SECRET. The KV bearer
 * token is shared with every route that talks to the store and with the
 * store's own dashboard; the dev string is public in this file. A session
 * or a ticket signed with either would let anyone who ever saw the KV token
 * mint a clinician's login or a family's enrolment. So on production with no
 * SLP_AUTH_SECRET set, nothing is signed and nothing verifies: every SLP
 * route fails closed until the secret exists. Preview and local keep the
 * fallback, which is what makes the test suites run without setup.
 *
 * Read at call time, not import time, so a suite can flip it.
 */
export function authSecretOk(): boolean {
  return !!process.env.SLP_AUTH_SECRET || process.env.VERCEL_ENV !== "production";
}
function requireAuthSecret(): void {
  if (!authSecretOk()) throw new Error("SLP_AUTH_SECRET is not set: refusing to sign with a shared or dev secret in production");
}

const COOKIE = "slp_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function kvConfigured(): boolean {
  return !!(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
    (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

export async function kvCmd(cmd: (string | number)[]): Promise<unknown> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !tok) return undefined;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    });
    if (!r.ok) return undefined;
    const j = (await r.json()) as { result?: unknown };
    return j.result;
  } catch {
    return undefined;
  }
}

/** A clinician-supplied name lands in an HTML email; escape it. */
function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export function randomToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// The FAMILY KEY — the "password" half of the credential an SLP hands to a
// family (the code is the username half). 8 chars from an unambiguous
// alphabet: long enough that guessing is hopeless at the redeem endpoint's
// rate limits, short enough to read off a clinic handout over the phone.
const KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function makeFamilyKey(): string {
  const bytes = crypto.randomBytes(8);
  let k = "";
  for (let i = 0; i < 8; i++) k += KEY_ALPHABET[bytes[i] % KEY_ALPHABET.length];
  return k;
}
export function safeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
export function hashToken(t: string): string {
  return crypto.createHash("sha256").update(t).digest("hex");
}

export type Session = { email: string; code?: string; iat?: number; exp?: number };

export function signSession(payload: Session): string {
  requireAuthSecret();
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET()).update(body).digest("base64url");
  return body + "." + sig;
}

export function verifySession(token: string | undefined | null): Session | null {
  if (!authSecretOk()) return null;
  if (!token || token.indexOf(".") < 0) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!sigOk(body, sig)) return null;
  try {
    const obj = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    if (obj.exp && Date.now() > obj.exp) return null;
    return obj;
  } catch {
    return null;
  }
}

/**
 * Enrolment ticket — proof that THIS device passed the code+key check at
 * /api/slp/redeem. It is what stands between "knows an SLP's code" and "can
 * write a child into that SLP's roster": the code travels in share links and
 * is derived from the clinician's email stem, so it is close to public, while
 * the family key is rate-limited and capped at the redeem endpoint.
 *
 * Tagged `t: "enrol"` and verified as such, so a clinician's session cookie
 * can never be replayed as a family ticket (or the reverse). Long-lived on
 * purpose — a family keeps syncing progress for months, and the thing that
 * bounds abuse is the redeem endpoint's per-IP limit and per-code cap, not a
 * short expiry that would silently stop a real child's data.
 */
export type Ticket = { t: "enrol"; code: string; exp: number; cid?: string };

export function signTicket(code: string, ttlDays = 400, childId = ""): string {
  requireAuthSecret();
  const payload: Ticket = { t: "enrol", code: String(code || "").toLowerCase(), exp: Date.now() + ttlDays * 86400000 };
  // Bind the ticket to ONE child where we know which one. A ticket proves the
  // device passed this clinician's code+key, which is enough to WRITE its own
  // roster row — but homework is per-child, and a code-only ticket would let
  // any family on a caseload read any other family's assignment. Legacy
  // tickets carry no cid and stay valid; readTicket() reports what it has and
  // the caller decides. See app/api/homework.
  if (childId) payload.cid = String(childId).slice(0, 60);
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET()).update(body).digest("base64url");
  return body + "." + sig;
}

/**
 * Verify a ticket and hand back its payload, so a caller can enforce more than
 * "is this a real ticket for this code" — today that means the cid binding.
 * Returns null on any failure; never throws.
 */
export function readTicket(token: string | undefined | null, code: string): Ticket | null {
  if (!authSecretOk()) return null;
  if (!token || token.indexOf(".") < 0) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!sigOk(body, sig)) return null;
  try {
    const t = JSON.parse(Buffer.from(body, "base64url").toString()) as Ticket;
    if (t.t !== "enrol") return null;                        // not a session cookie
    if (!t.exp || Date.now() > t.exp) return null;
    if (!safeEqualStr(String(t.code || ""), String(code || "").toLowerCase())) return null;
    return t;
  } catch {
    return null;
  }
}

/**
 * THE canonical roster key. A clinic code reaches the server in whatever case
 * the caller happened to use: the client uppercases it (`slpJoinCaseload`),
 * account creation slugifies it to lowercase, and tickets are signed and
 * verified lowercased. Redis keys are case-sensitive, so before this existed
 * a family enrolling through the normal link wrote `slp:RACHEL-K4` while the
 * clinician's dashboard read `slp:rachel-k4` — the write succeeded, the ticket
 * verified (because ticket checks normalise), and the roster stayed EMPTY.
 * Silent, and it broke the SLP channel end to end.
 *
 * Every read and every write of a roster goes through here. Nothing should
 * ever build "slp:" + code by hand again.
 */
export function rosterKey(code: string): string {
  return "slp:" + String(code || "").toLowerCase();
}

/**
 * Recover families enrolled while the bug above was live. Their rows sit under
 * the uppercase key and are invisible to the clinician. This merges them into
 * the canonical key and removes the stray, WITHOUT overwriting anything that
 * already exists there — a row written since the fix is the newer truth.
 *
 * Idempotent and cheap: after the first successful heal the legacy key is gone
 * and this costs one EXISTS. Safe to call on every dashboard read, which is
 * exactly where a clinician would otherwise be staring at an empty caseload.
 */
export async function healLegacyRoster(code: string): Promise<number> {
  const canon = rosterKey(code);
  const legacy = "slp:" + String(code || "").toUpperCase();
  if (legacy === canon) return 0;                       // already canonical
  try {
    const flat = await kvCmd(["HGETALL", legacy]);
    if (!Array.isArray(flat) || flat.length === 0) return 0;
    let moved = 0;
    for (let i = 0; i < flat.length; i += 2) {
      const field = String(flat[i]);
      const value = String(flat[i + 1]);
      // HSETNX: never clobber a row the family has already re-written under
      // the correct key since the fix shipped.
      const wrote = await kvCmd(["HSETNX", canon, field, value]);
      if (wrote === 1) moved++;
    }
    await kvCmd(["EXPIRE", canon, 60 * 60 * 24 * 150]);
    await kvCmd(["DEL", legacy]);
    return moved;
  } catch {
    return 0;                                           // never break a read
  }
}

/**
 * Ownership of a child's roster row, for tickets that carry no `cid`.
 *
 * Tickets minted before the binding existed — and, until this shipped, tickets
 * minted TODAY when the caller omitted childId — prove only "this device
 * passed a clinic's code+key". That is enough to write a row; it is NOT enough
 * to choose WHICH row, or one family on a caseload could overwrite another
 * child's name, outcomes and streak.
 *
 * So an unbound ticket binds itself on first use: the child it claims first is
 * the child it may write for, forever. Legitimate families are unaffected (they
 * always send their own id); an attacker with a stolen unbound ticket is
 * confined to whatever it already claimed. New tickets carry `cid` and never
 * reach this path.
 */
export async function ticketOwnsChild(ticket: string, childId: string): Promise<boolean> {
  if (!childId) return false;
  const key = "tktcid:" + hashToken(ticket);
  try {
    const seen = await kvCmd(["GET", key]);
    if (seen) return String(seen) === childId;
    // first use: claim it, and only accept the claim if we won the race
    const won = await kvCmd(["SET", key, childId, "NX", "EX", 60 * 60 * 24 * 400]);
    if (won) return true;
    const now = await kvCmd(["GET", key]);
    return String(now || "") === childId;
  } catch {
    // KV unreachable: fail CLOSED. A roster write that cannot be attributed to
    // a child is exactly the write this function exists to refuse.
    return false;
  }
}

export function verifyTicket(token: string | undefined | null, code: string): boolean {
  return !!readTicket(token, code);
}

export function readSession(req: Request): Session | null {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)slp_session=([^;]+)/);
  if (!m) return null;
  return verifySession(decodeURIComponent(m[1]));
}

export function sessionCookie(token: string, maxAgeSec: number): string {
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}`;
}
export function clearCookie(): string {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

/**
 * Send the sign-in link via Resend. Until RESEND_API_KEY is set, return the link
 * directly so it can be tested on preview — but never leak it on production.
 */
/**
 * THIS EMAIL IS THE DELIVERY MECHANISM, not a receipt. An SLP signs up from an
 * ad, and this is what arrives — so it says what is behind the link and what to
 * do first, rather than "here is your sign-in link" over a bare button. The
 * name is the one they typed about themselves at sign-up; a child's name has no
 * business in an outbound email and none is available here.
 */
export async function sendMagicEmail(
  email: string,
  link: string,
  name = "",
): Promise<{ sent: boolean; devLink: string | null }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Sona <login@speaksona.com>";
  if (!key) {
    return { sent: false, devLink: process.env.VERCEL_ENV === "production" ? null : link };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your Sona dashboard is ready",
        html:
          `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;font-size:15px;color:#16384f;line-height:1.6;max-width:520px;">` +
          `<p>${name ? "Hi " + esc(name) + "," : "Hi,"}</p>` +
          `<p>Your Sona dashboard is ready — it's free for you and for every family on your caseload.</p>` +
          `<p><a href="${link}" style="display:inline-block;background:#58cc02;color:#fff;font-weight:700;text-decoration:none;padding:14px 26px;border-radius:12px;font-size:16px;">Open my dashboard</a></p>` +
          `<p style="margin-top:22px;"><b>What to do first</b></p>` +
          `<ol style="padding-left:18px;color:#46627a;">` +
          `<li>Add a child — initials are enough. You pick the sound and the position.</li>` +
          `<li>Send their family the link. They set up in about 30 seconds, on their own phone.</li>` +
          `<li>Come back and see the days they practised — and copy a line for your progress note.</li>` +
          `</ol>` +
          `<p style="color:#6b86a3;font-size:13px;margin-top:22px;">This link expires in 15 minutes — if it does, just enter your email again at speaksona.com and we'll send a fresh one. If you didn't ask for this, you can ignore it.</p>` +
          `</div>`,
      }),
    });
    return { sent: r.ok, devLink: null };
  } catch {
    return { sent: false, devLink: null };
  }
}
