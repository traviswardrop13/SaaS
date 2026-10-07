import { createHmac } from "crypto";
import { kvCmd } from "@/lib/slpAuth";

/**
 * THE WELCOME SERIES, on Sona's own server (Travis, 6 Oct 2026: "new sign-ups
 * automatically get [the welcome] right away and the 5-minute email the next
 * day, with a real unsubscribe link. That's it."). It replaces hand-sending a
 * Kit export every day, and keeps working after Kit is cancelled (24 Oct).
 *
 * Five emails from Rachel (CONTENT below: day 0, 1, 2, 3 and 5), each with a
 * one-tap unsubscribe link (/api/email/unsub, the same HMAC token the Friday
 * email uses) and the mailing address (EMAIL_POSTAL) — CAN-SPAM. Nothing
 * about a child, ever: the only thing this file knows is an email address.
 *
 * - the first: sent by /api/lead the moment a grown-up gives their email.
 *   Once per address, ever (`nurture:0:<email>`, set NX before sending, so a
 *   double tap or a retry cannot send two; its value is the sign-up time).
 * - the rest: the next one's time sits in the sorted set `nurture:due` and
 *   its number in `nurture:next:<email>`; /api/cron/nurture sends what is due
 *   once a day. ZREM is the claim, so two overlapping runs cannot both send.
 * Anyone in `email:unsub` (the Friday email's suppression set) leaves it.
 * Not yet: stopping when a family starts a trial. Sona can't see that until
 * RevenueCat tells the server, so day 3 and day 5 say "already started? ignore
 * the button" rather than assume.
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

export type Step = number;

type Content = { day: number; subject: string; preview: string; paras: string[]; button: string; after: string[]; ps?: string };

/**
 * THE SEQUENCE (Travis, 7 Oct 2026: "a super short email ... to send them
 * directly to the app store and then a second email that's like the five
 * minute trick ... then day two day three day five"). Built from his spec
 * (sona-email-system.md, A1-A5), with what is not true of the app today
 * taken out: no cup tower, no "correct" or scoring (Sona hears "a voice of
 * the right kind", never grades), no yearly price and no "free forever"
 * games (a new family meets the trial first; the price is Apple's, so no
 * figure is typed), no testimonial (none exists yet). `day` is days after
 * sign-up. Rachel's claims (the bike, the recast tip, the ages) are hers to
 * confirm.
 */
export const CONTENT: Content[] = [
  {
    day: 0,
    subject: "Here\u2019s Sona \u{1F389}",
    preview: "Your download link, and what to do tonight",
    paras: [
      "Hi there,",
      "Thanks for signing up! Here\u2019s your link to get Sona on your iPhone or iPad.",
    ],
    button: "Get Sona on the App Store",
    after: [
      "Try Sona free for 3 days. Apple shows the price before you confirm.",
      "Tonight, hand your child the phone for one round. That\u2019s it.",
      "Hit reply and tell me what sound your child is working on.",
    ],
  },
  {
    day: 1,
    subject: "The 5-minute trick \u{1F6B2}",
    preview: "Speech sounds work like riding a bike",
    paras: [
      "Hi there,",
      "Tricky sounds like R, S, and L are a lot like riding a bike for kiddos.",
      "You don\u2019t learn to ride by practicing once a week for an hour. You learn by doing a little every day.",
      "That\u2019s the whole idea behind Sona: short daily practice that adds up.",
    ],
    button: "\u{1F449} Start today\u2019s 5 minutes",
    after: [],
    ps: "Already practicing? Keep the streak going!",
  },
  {
    day: 2,
    subject: "Try this the next time they say \u201cwabbit\u201d",
    preview: "One small habit that helps a lot",
    paras: [
      "Hi there,",
      "Here\u2019s my favorite tip for parents: don\u2019t correct. Say it back the right way.",
      "If your child says \u201cLook, a wabbit!\u201d, skip \u201cNo, say rabbit.\u201d Instead, say: \u201cYes! A rabbit! The rabbit is hopping!\u201d",
      "They hear the sound the right way, and they don\u2019t feel like they made a mistake. Do it a few times a day, and it adds up.",
      "Sona handles the practice. You just keep it light and fun.",
    ],
    button: "\u{1F449} Open Sona",
    after: [],
  },
  {
    day: 3,
    subject: "The balloon problem",
    preview: "A lot of speech apps let kids skip the talking",
    paras: [
      "Hi there,",
      "A lot of kids\u2019 speech apps let children tap their way through without ever saying a word. It looks like practice, but it\u2019s really just a game.",
      "Sona asks for the sound, and listens. In Hoops, saying the word is what earns the ball. Silence never counts.",
      "So the minutes your child spends in Sona are minutes spent talking. That\u2019s screen time you don\u2019t have to feel guilty about.",
    ],
    button: "\u{1F449} Try Sona free for 3 days",
    after: [],
    ps: "Already started? You can ignore the button.",
  },
  {
    day: 5,
    subject: "Quick answers before you decide",
    preview: "What it costs, how to cancel, and what Sona is (and isn\u2019t)",
    paras: [
      "Hi there,",
      "Here\u2019s what parents ask me most:",
      "What does it cost? 3 days free, then Apple shows the price before you confirm.",
      "Can I cancel? Yes, anytime: iPhone Settings \u2192 your name \u2192 Subscriptions \u2192 Sona.",
      "How long a day? About 5 minutes.",
      "What ages? About 3 to 8, for kids who talk but are hard to understand: \u201cwabbit,\u201d a lisp, trouble with R, S, or L.",
      "Is my child\u2019s voice uploaded? No. Sona listens on the phone, and audio is never uploaded.",
      "Is it the same as seeing a speech therapist? No. Sona is practice at home. It doesn\u2019t test your child, and it doesn\u2019t replace a speech therapist.",
    ],
    button: "\u{1F449} Start your free trial",
    after: [],
  },
];

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
    `<p style="margin:24px 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;">Rachel, MS, CF-SLP<br>Sona co-founder</p>` +
    (c.ps ? `<p ${P}><em>${esc(c.ps)}</em></p>` : "") +
    "<br>".repeat(18) +
    `<p style="margin:0;font-size:12px;line-height:1.5;color:#8a8a8a;">You’re getting this because you gave Sona your email.<br>Sona · ${esc(postal)}<br><a href="${unsubUrl}" style="color:#8a8a8a;">Unsubscribe</a></p>` +
    `</div></body></html>`;
  const text =
    c.paras.join("\n\n") + `\n\n${c.button}: ${APP_URL}\n\n` +
    (c.after.length ? c.after.join("\n\n") + "\n\n" : "") +
    "Rachel, MS, CF-SLP\nSona co-founder\n" +
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
    from: process.env.NURTURE_FROM || "Rachel from Sona <rachel@speaksona.com>",
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

export type SendResult = "sent" | "unsub" | "failed";

export async function sendStep(email: string, step: Step, kv: Kv = kvCmd, f: Fetch = fetch): Promise<SendResult> {
  const cfg = config();
  if (!cfg || !CONTENT[step]) return "failed";
  const unsub = await unsubscribed(email, kv);
  if (unsub === true) return "unsub";
  if (unsub !== false) return "failed";
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
    return r.ok ? "sent" : "failed";
  } catch (e) {
    console.error("[nurture] send threw:", e instanceof Error ? e.message : String(e));
    return "failed";
  }
}

export const nextKey = (email: string) => "nurture:next:" + email;

/** /api/lead: a new grown-up's email. Welcome now, schedule the next. Never throws. */
export async function enroll(rawEmail: string, kv: Kv = kvCmd, f: Fetch = fetch, now: number = Date.now()): Promise<boolean> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !configured()) return false;
  try {
    const first = await kv(["SET", "nurture:0:" + email, new Date(now).toISOString(), "NX", "EX", 31536000]);
    if (first !== "OK") return false;
    const r = await sendStep(email, 0, kv, f);
    if (r !== "unsub") {
      await kv(["SET", nextKey(email), 1, "EX", 31536000]);
      await kv(["ZADD", DUE_KEY, now + CONTENT[1].day * DAY_MS, email]);
    }
    return r === "sent";
  } catch {
    return false;
  }
}

/**
 * /api/cron/nurture: send every email that is due, then schedule the one
 * after it from the sign-up time (so a late run never pushes the rest back).
 * ZREM is the claim. An address enrolled before the sequence grew has no
 * `nurture:next` and is on step 1, which is what it was waiting for. An
 * unsubscribed address leaves the sequence; a failed send moves on, so one
 * bad address can never loop.
 */
export async function runDue(kv: Kv = kvCmd, f: Fetch = fetch, now: number = Date.now()): Promise<{ due: number; sent: number }> {
  const due = (await kv(["ZRANGEBYSCORE", DUE_KEY, "-inf", now, "LIMIT", 0, 500])) as unknown;
  if (!Array.isArray(due)) return { due: 0, sent: 0 };
  let sent = 0;
  for (const raw of due as string[]) {
    const e = String(raw);
    const claimed = await kv(["ZREM", DUE_KEY, e]);
    if (Number(claimed) !== 1) continue; // another run took it
    const step = Number((await kv(["GET", nextKey(e)])) ?? 1) || 1;
    const r = await sendStep(e, step, kv, f);
    if (r === "sent") sent++;
    const next = step + 1;
    if (r === "unsub" || !CONTENT[next]) {
      await kv(["DEL", nextKey(e)]);
      continue;
    }
    const startedIso = (await kv(["GET", "nurture:0:" + e])) as string | null;
    const started = startedIso ? Date.parse(startedIso) : NaN;
    const at = Number.isFinite(started) ? started + CONTENT[next].day * DAY_MS : now + (CONTENT[next].day - CONTENT[step].day) * DAY_MS;
    await kv(["SET", nextKey(e), next, "EX", 31536000]);
    await kv(["ZADD", DUE_KEY, Math.max(at, now + 1), e]);
  }
  return { due: due.length, sent };
}
