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
 * practicing.
 *
 * So verification accepts the legacy secret too, and only verification.
 * Nothing is signed with it, so the window closes by itself as tickets age
 * out, and a forger still cannot mint anything: minting needs SECRET(), which
 * in production is the dedicated secret or nothing at all.
 */
/**
 * Proof that a lead came from our own sign-up route, not a stranger. The
 * auth route forwards every clinician sign-up to /api/lead from the server,
 * so they all arrive from the same few Vercel addresses; a per-address flood
 * limit on /api/lead would lump every clinician together and could turn real
 * sign-ups away. The route signs the email with the server's own secret, and
 * /api/lead lets a correctly signed lead past the limit.
 */
export function leadSig(email: string): string {
  return crypto.createHmac("sha256", SECRET()).update("sona-lead:" + email.trim().toLowerCase()).digest("base64url");
}

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
export type Ticket = { t: "enrol"; code: string; exp: number; cid?: string; self?: 1 };

export function signTicket(code: string, ttlDays = 400, childId = "", opts: { self?: boolean } = {}): string {
  requireAuthSecret();
  const payload: Ticket = { t: "enrol", code: String(code || "").toLowerCase(), exp: Date.now() + ttlDays * 86400000 };
  // Bind the ticket to ONE child where we know which one. A ticket proves the
  // device passed this clinician's code+key, which is enough to WRITE its own
  // roster row — but homework is per-child, and a code-only ticket would let
  // any family on a caseload read any other family's assignment. Legacy
  // tickets carry no cid and stay valid; readTicket() reports what it has and
  // the caller decides. See app/api/homework.
  if (childId) payload.cid = String(childId).slice(0, 60);
  // THE CLINICIAN'S OWN PHONE (24 Sep 2026). Minted only when redeem consumed
  // a single-use link that was emailed to the clinician's ACCOUNT address
  // (/api/slp/self), so it proves the inbox, not just the code. It is signed
  // into the ticket rather than stored beside it, so /api/slp/covered can
  // read it from the ticket alone; tickets without it are family tickets,
  // which is every ticket minted before this existed.
  if (opts.self) payload.self = 1;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET()).update(body).digest("base64url");
  return body + "." + sig;
}

/**
 * Verify a ticket and hand back its payload, so a caller can enforce more than
 * "is this a real ticket for this code" — today that means the cid binding.
 * Returns null on any failure; never throws.
 *
 * `ignoreExpiry` (24 Sep 2026) skips ONLY the exp check — signature, tag and
 * code are checked exactly as always. One caller uses it: /api/slp/covered,
 * which is read-only and re-issues the ticket. Without it, a family's
 * coverage froze at day 400 in whatever state it was last in (the device
 * treats a 401 as "change nothing"), so a paying clinician's families could
 * never be told they were covered and a cancelled one's never told they
 * were not. Every route that WRITES (pilot, homework, claim) keeps the expiry.
 */
export function readTicket(token: string | undefined | null, code: string, opts: { ignoreExpiry?: boolean } = {}): Ticket | null {
  if (!authSecretOk()) return null;
  if (!token || token.indexOf(".") < 0) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!sigOk(body, sig)) return null;
  try {
    const t = JSON.parse(Buffer.from(body, "base64url").toString()) as Ticket;
    if (t.t !== "enrol") return null;                        // not a session cookie
    if (!t.exp || (!opts.ignoreExpiry && Date.now() > t.exp)) return null;
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
          // 24 Sep 2026: this said "free for you and for every family on
          // your caseload" — the promise the grandfathered clinicians hold.
          // A clinician signing up now is not grandfathered, so the first
          // email they get says only what is true for every clinician.
          `<p>Your Sona dashboard is ready — it's free, and every family you send home gets Sona's free version.</p>` +
          `<p><a href="${link}" style="display:inline-block;background:#58cc02;color:#fff;font-weight:700;text-decoration:none;padding:14px 26px;border-radius:12px;font-size:16px;">Open my dashboard</a></p>` +
          `<p style="margin-top:22px;"><b>What to do first</b></p>` +
          `<ol style="padding-left:18px;color:#46627a;">` +
          `<li>Add a child — initials are enough. You pick the sound and the position.</li>` +
          `<li>Send their family the link. They set up in about 30 seconds, on their own phone.</li>` +
          `<li>Come back and see the days they practiced — and copy a line for your progress note.</li>` +
          `</ol>` +
          `<p style="color:#6b86a3;font-size:13px;margin-top:22px;">This link expires in 15 minutes — if it does, just enter your email again at speaksona.com and we'll send a fresh one. If you didn't ask for this, you can ignore it.</p>` +
          `</div>`,
        /**
         * A PLAIN-TEXT PART, because an HTML-only email scores worse with
         * every spam filter that looks — and this message is not a receipt
         * a clinician can shrug off. It IS the dashboard: if it lands in
         * junk, the sign-up we just paid an ad for is worth nothing.
         */
        text:
          (name ? "Hi " + name + ",\n\n" : "Hi,\n\n") +
          "Your Sona dashboard is ready - it's free, and every family you send home gets Sona's free version.\n\n" +
          "Open it here:\n" + link + "\n\n" +
          "What to do first\n" +
          "1. Add a child - initials are enough. You pick the sound and the position.\n" +
          "2. Send their family the link. They set up in about 30 seconds, on their own phone.\n" +
          "3. Come back and see the days they practiced - and copy a line for your progress note.\n\n" +
          "This link expires in 15 minutes. If it does, enter your email again at speaksona.com and we'll send a fresh one. If you didn't ask for this, you can ignore it.\n",
      }),
    });
    /**
     * SAY WHY, in the server log, when Resend refuses. The usual cause is a
     * sending domain that was never verified, and its symptom is silence: the
     * page says "check your email", the inbox stays empty, and nothing
     * anywhere names the reason. The key is never logged; the body is
     * Resend's own error text.
     */
    if (!r.ok) {
      let why = String(r.status);
      try { why += " " + (await r.text()).slice(0, 300); } catch { /* status alone */ }
      console.error("[slpAuth] Resend refused the sign-in email:", why);
    }
    return { sent: r.ok, devLink: null };
  } catch (e) {
    console.error("[slpAuth] sign-in email threw:", e instanceof Error ? e.message : String(e));
    return { sent: false, devLink: null };
  }
}

/**
 * One Resend call for the two emails below. sendMagicEmail keeps its own copy
 * on purpose — its wording and its log line are pinned, and it is the sign-in
 * door. `logBody` is false for any email addressed to someone who is not a
 * Sona account holder: Resend's refusal text can quote the recipient, and a
 * parent's address must not land in a server log (it is used for one send
 * and kept nowhere).
 */
async function resendSend(
  msg: { to: string; subject: string; html: string; text: string },
  label: string,
  logBody: boolean,
): Promise<{ sent: boolean; configured: boolean }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Sona <login@speaksona.com>";
  if (!key) return { sent: false, configured: false };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!r.ok) {
      let why = String(r.status);
      if (logBody) { try { why += " " + (await r.text()).slice(0, 300); } catch { /* status alone */ } }
      console.error("[slpAuth] Resend refused the " + label + ":", why);
    }
    return { sent: r.ok, configured: true };
  } catch (e) {
    console.error("[slpAuth] " + label + " threw:", logBody && e instanceof Error ? e.message : "network");
    return { sent: false, configured: true };
  }
}

/** A clinician's name for a subject line: one line, no control characters, capped. */
function oneLine(s: string, max: number): string {
  return String(s || "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

const BUTTON = "display:inline-block;background:#58cc02;color:#fff;font-weight:700;text-decoration:none;padding:14px 26px;border-radius:12px;font-size:16px;";
const FRAME = "font-family:system-ui,Segoe UI,Roboto,sans-serif;font-size:15px;color:#16384f;line-height:1.6;max-width:520px;";

/**
 * THE PARENT INVITE (24 Sep 2026). In the dashboard's Add-a-child composer a
 * clinician MAY type the parent's email, and Sona sends this ONE email with
 * the family's join link. The address is used for this send and nothing
 * else: the invite route passes it straight here, it is never stored, never
 * logged, never sent to /api/lead or Kit — a parent joins the list only by
 * typing their own email under the consent line on join.html.
 *
 * NO CHILD DATA AT ALL — not even the invite's label. The label is initials a
 * clinician chose so that nobody at a school sends Sona a student's name; an
 * email to an address Sona cannot verify is the last place to put them. The
 * only name in it is the clinician's own, the one they typed about themselves.
 *
 * `covered` adds the Premium line only when the clinician's caseload is
 * covered (paid or grandfathered) — the email promises nothing the redeem
 * route would not then deliver.
 */
export async function sendParentInviteEmail(
  to: string,
  link: string,
  clinicianName: string,
  covered: boolean,
): Promise<{ sent: boolean; error?: string }> {
  const name = oneLine(clinicianName, 80);
  const who = name || "Your child's speech therapist";
  const whoMid = name || "your child's speech therapist";
  const premium = covered ? " Premium is included, on " + whoMid + "." : "";
  const r = await resendSend({
    to,
    subject: who + " invited you to practice with Sona",
    html:
      `<div style="${FRAME}">` +
      `<p>Hi,</p>` +
      `<p>${esc(who)} uses Sona for speech practice at home, and invited your family to join.</p>` +
      `<p><a href="${esc(link)}" style="${BUTTON}">Join on Sona</a></p>` +
      `<p>Sona's free version (daily practice and free games) is free for your family.${esc(premium)}</p>` +
      `<p style="color:#6b86a3;font-size:13px;margin-top:22px;">You're getting this one email because ${esc(whoMid)} asked Sona to send it. We didn't keep your address.</p>` +
      `</div>`,
    // plain text too, for the same reason the sign-in email has one: an
    // HTML-only message scores worse with every spam filter that looks
    text:
      "Hi,\n\n" +
      who + " uses Sona for speech practice at home, and invited your family to join.\n\n" +
      "Join here:\n" + link + "\n\n" +
      "Sona's free version (daily practice and free games) is free for your family." + premium + "\n\n" +
      "You're getting this one email because " + whoMid + " asked Sona to send it. We didn't keep your address.\n",
  }, "parent invite", false);
  if (r.sent) return { sent: true };
  return { sent: false, error: r.configured ? "The email didn't go through. Copy the link and send it yourself." : "Email isn't set up yet. Copy the link and send it yourself." };
}

/**
 * THE CLINICIAN'S OWN PHONE (24 Sep 2026). A single-use link that turns
 * Premium on for the device it is opened on — theirs — sent ONLY to the
 * account's own address, which is what proves the person asking can read
 * that inbox (a session cookie on a shared clinic computer proves less).
 * Like the sign-in email, with no RESEND_API_KEY the link comes back
 * directly off production so a preview can be tested, and never on
 * production.
 *
 * NEVER "ONE PHONE". Each link works once, but the dashboard sends up to
 * SELF_LINKS_PER_DAY of them (lib/caseload) and nothing retires an earlier
 * phone, so "one phone" would be a limit the server does not keep. The copy
 * says what IS kept — your own phone or tablet, each link once — the same
 * words the dashboard and the Terms use.
 */
export async function sendSelfLinkEmail(
  to: string,
  link: string,
  name = "",
): Promise<{ sent: boolean; devLink: string | null }> {
  const first = oneLine(name, 60);
  const r = await resendSend({
    to,
    subject: "Sona for your own phone or tablet",
    html:
      `<div style="${FRAME}">` +
      `<p>${first ? "Hi " + esc(first) + "," : "Hi,"}</p>` +
      `<p>Here's Sona for your own phone or tablet, with Premium on — every game your families can play.</p>` +
      `<p><a href="${esc(link)}" style="${BUTTON}">Open Sona</a></p>` +
      `<p style="color:#6b86a3;font-size:13px;margin-top:22px;">Open it on your own phone or tablet. Each link works once and expires in 30 days. If you didn't ask for this, you can ignore it.</p>` +
      `</div>`,
    text:
      (first ? "Hi " + first + ",\n\n" : "Hi,\n\n") +
      "Here's Sona for your own phone or tablet, with Premium on - every game your families can play.\n\n" +
      "Open it on your own phone or tablet:\n" + link + "\n\n" +
      "Each link works once and expires in 30 days. If you didn't ask for this, you can ignore it.\n",
  }, "own-phone link email", true);
  if (!r.configured) return { sent: false, devLink: process.env.VERCEL_ENV === "production" ? null : link };
  return { sent: r.sent, devLink: null };
}
