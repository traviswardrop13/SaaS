import { createHmac } from "crypto";
import { kvCmd } from "@/lib/slpAuth";

/**
 * THE WELCOME SERIES, on Sona's own server (Travis, 6 Oct 2026: "new sign-ups
 * automatically get [the welcome] right away and the 5-minute email the next
 * day, with a real unsubscribe link. That's it."). It replaces hand-sending a
 * Kit export every day, and keeps working after Kit is cancelled (24 Oct).
 *
 * Two emails, both from Rachel, both carrying a one-tap unsubscribe link
 * (/api/email/unsub, the same HMAC token the Friday email uses) and the
 * mailing address (EMAIL_POSTAL) — CAN-SPAM. Nothing about a child, ever:
 * the only thing this file knows about anyone is an email address.
 *
 * - step 0, the welcome: sent by /api/lead the moment a grown-up gives their
 *   email. Once per address, ever (`nurture:0:<email>`, set NX before sending,
 *   so a double tap or a retry cannot send two).
 * - step 1, "The 5-minute trick": scheduled for ~24 h later in the sorted set
 *   `nurture:due`; /api/cron/nurture sends what is due once a day. ZREM is the
 *   claim, so two overlapping runs cannot both send it.
 * Anyone in `email:unsub` (the Friday email's suppression set) gets neither.
 *
 * The people who signed up before this shipped were emailed by hand from a
 * Kit export (5–6 Oct 2026), so there is no back-fill here: it starts with
 * the next sign-up.
 */

export const APP_URL = "https://apps.apple.com/us/app/sona-speech/id6785755867";
export const DAY_MS = 24 * 60 * 60 * 1000;
export const DUE_KEY = "nurture:due";

type Kv = (cmd: (string | number)[]) => Promise<unknown>;
type Fetch = typeof fetch;

export type Step = 0 | 1;

type Content = { subject: string; preview: string; paras: string[]; button: string; after: string[]; ps?: string };

// The copy Travis approved and sent by hand on 6 Oct 2026. Rachel's claims
// ("one of the trickiest sounds", "like riding a bike") are hers to confirm.
export const CONTENT: Record<Step, Content> = {
  0: {
    subject: "Tricky R? Let’s make practice fun \u{1F3C0}",
    preview: "Games your kiddo will actually ask to play",
    paras: [
      "Hi! It’s Rachel \u{1F44B}",
      "R is one of the trickiest sounds for kiddos, and one of the most common ones parents ask me about. The good news: a little practice every day really adds up.",
      "That’s why we made Sona. Your child says their R words to earn a ball, then takes a shot! Or they slice fruit and dig for dinosaurs, with a little talking along the way.",
      "You can sit together, cheer them on, and see which game becomes their favorite. \u{1F49B}",
    ],
    button: "Start practicing R →",
    after: ["Try Sona free for 3 days. Cancel anytime.", "Then hit reply and tell me how it went!"],
  },
  1: {
    subject: "The 5-minute trick \u{1F6B2}",
    preview: "Speech sounds work like riding a bike",
    paras: [
      "Hi there,",
      "Tricky sounds like R, S, and L are a lot like riding a bike for kiddos.",
      "You don’t learn to ride by practicing once a week for an hour. You learn by doing a little every day.",
      "That’s the whole idea behind Sona: short daily practice that adds up.",
    ],
    button: "\u{1F449} Start today’s 5 minutes",
    after: [],
    ps: "Already practicing? Keep the streak going!",
  },
};

export function unsubToken(email: string, secret: string): string {
  return createHmac("sha256", secret).update(email).digest("hex").slice(0, 24);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function render(step: Step, unsubUrl: string, postal: string): { subject: string; html: string; text: string } {
  const c = CONTENT[step];
  const P = 'style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;"';
  const html =
    `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;">` +
    `<div style="display:none;max-height:0;overflow:hidden;">${esc(c.preview)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>` +
    `<div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    c.paras.map((p) => `<p ${P}>${esc(p)}</p>`).join("") +
    `<p style="margin:24px 0 16px;"><a href="${APP_URL}" style="display:inline-block;background:#ff8a3d;color:#ffffff;text-decoration:none;font-weight:700;font-size:17px;padding:13px 26px;border-radius:12px;">${esc(c.button)}</a></p>` +
    c.after.map((p) => `<p ${P}>${esc(p)}</p>`).join("") +
    `<p style="margin:24px 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;">Rachel<br>MS, CF-SLP · Sona co-founder</p>` +
    (c.ps ? `<p ${P}><em>${esc(c.ps)}</em></p>` : "") +
    "<br>".repeat(18) +
    `<p style="margin:0;font-size:12px;line-height:1.5;color:#8a8a8a;">You’re getting this because you gave Sona your email.<br>Sona · ${esc(postal)}<br><a href="${unsubUrl}" style="color:#8a8a8a;">Unsubscribe</a></p>` +
    `</div></body></html>`;
  const text =
    c.paras.join("\n\n") + `\n\n${c.button}: ${APP_URL}\n\n` +
    (c.after.length ? c.after.join("\n\n") + "\n\n" : "") +
    "Rachel\nMS, CF-SLP · Sona co-founder\n" +
    (c.ps ? `\n${c.ps}\n` : "") +
    "\n".repeat(18) +
    `--\nYou’re getting this because you gave Sona your email.\nSona · ${postal}\nUnsubscribe: ${unsubUrl}\n`;
  return { subject: c.subject, html, text };
}

/** Everything a send needs, or null — and then nothing sends (no address, no link, no email). */
function config(): { key: string; secret: string; postal: string; from: string; replyTo: string } | null {
  const key = process.env.RESEND_API_KEY || "";
  const secret = process.env.UNSUB_SECRET || "";
  const postal = (process.env.EMAIL_POSTAL || "").trim();
  if (!key || !secret || !postal) return null;
  return {
    key, secret, postal,
    from: process.env.NURTURE_FROM || "Rachel at Sona <rachel@speaksona.com>",
    replyTo: process.env.NURTURE_REPLY_TO || "rachel@speaksona.com",
  };
}

export function configured(): boolean {
  return config() !== null;
}

async function unsubscribed(email: string, kv: Kv): Promise<boolean | null> {
  const r = await kv(["SISMEMBER", "email:unsub", email]);
  if (r === undefined || r === null) return null; // store didn't answer: fail closed
  return Number(r) === 1;
}

export async function sendStep(email: string, step: Step, kv: Kv = kvCmd, f: Fetch = fetch): Promise<boolean> {
  const cfg = config();
  if (!cfg) return false;
  const unsub = await unsubscribed(email, kv);
  if (unsub !== false) return false;
  const unsubUrl = `https://speaksona.com/api/email/unsub?e=${encodeURIComponent(email)}&k=${unsubToken(email, cfg.secret)}`;
  const { subject, html, text } = render(step, unsubUrl, cfg.postal);
  try {
    const r = await f("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json", "Idempotency-Key": `nurture-${step}-${email}` },
      body: JSON.stringify({
        from: cfg.from, to: [email], reply_to: cfg.replyTo, subject, html, text,
        headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      }),
    });
    if (!r.ok) console.error("[nurture] Resend refused step", step, r.status);
    return r.ok;
  } catch (e) {
    console.error("[nurture] send threw:", e instanceof Error ? e.message : String(e));
    return false;
  }
}

/** /api/lead: a new grown-up's email. Welcome now, schedule tomorrow's. Never throws. */
export async function enroll(rawEmail: string, kv: Kv = kvCmd, f: Fetch = fetch, now: number = Date.now()): Promise<boolean> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !configured()) return false;
  try {
    const first = await kv(["SET", "nurture:0:" + email, new Date(now).toISOString(), "NX", "EX", 31536000]);
    if (first !== "OK") return false;
    await kv(["ZADD", DUE_KEY, now + DAY_MS, email]);
    return await sendStep(email, 0, kv, f);
  } catch {
    return false;
  }
}

/** /api/cron/nurture: send every step-1 email that is due. */
export async function runDue(kv: Kv = kvCmd, f: Fetch = fetch, now: number = Date.now()): Promise<{ due: number; sent: number }> {
  const due = (await kv(["ZRANGEBYSCORE", DUE_KEY, "-inf", now, "LIMIT", 0, 500])) as unknown;
  if (!Array.isArray(due)) return { due: 0, sent: 0 };
  let sent = 0;
  for (const e of due as string[]) {
    const claimed = await kv(["ZREM", DUE_KEY, e]);
    if (Number(claimed) !== 1) continue; // another run took it
    if (await sendStep(String(e), 1, kv, f)) sent++;
  }
  return { due: due.length, sent };
}
