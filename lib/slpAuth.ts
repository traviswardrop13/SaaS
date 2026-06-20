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
// token (already a stable per-deploy secret) so this works without extra setup.
const SECRET =
  process.env.SLP_AUTH_SECRET ||
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  "sona-dev-insecure-secret";

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

export function randomToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}
export function hashToken(t: string): string {
  return crypto.createHash("sha256").update(t).digest("hex");
}

export type Session = { email: string; code?: string; iat?: number; exp?: number };

export function signSession(payload: Session): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return body + "." + sig;
}

export function verifySession(token: string | undefined | null): Session | null {
  if (!token || token.indexOf(".") < 0) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    if (obj.exp && Date.now() > obj.exp) return null;
    return obj;
  } catch {
    return null;
  }
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
export async function sendMagicEmail(
  email: string,
  link: string,
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
        subject: "Your Sona sign-in link",
        html:
          `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;font-size:15px;color:#16384f;line-height:1.5;">` +
          `<p>Here's your sign-in link for your Sona SLP account:</p>` +
          `<p><a href="${link}" style="display:inline-block;background:#1cb0f6;color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;">Sign in to Sona</a></p>` +
          `<p style="color:#6b86a3;font-size:13px;">This link expires in 15 minutes. If you didn't request it, you can ignore this email.</p>` +
          `</div>`,
      }),
    });
    return { sent: r.ok, devLink: null };
  } catch {
    return { sent: false, devLink: null };
  }
}
