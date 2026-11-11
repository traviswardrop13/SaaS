import { createHmac } from "crypto";
import { kvCmd } from "@/lib/slpAuth";

/**
 * THE WELCOME SERIES, on Sona's own server (Travis, 6 Oct 2026: "new sign-ups
 * automatically get [the welcome] right away and the 5-minute email the next
 * day, with a real unsubscribe link. That's it."). It replaces hand-sending a
 * Kit export every day, and keeps working after Kit is cancelled (24 Oct).
 *
 * Three emails from Rachel (CONTENT below: one at sign-up, then day 1 and
 * day 2), each with a one-tap unsubscribe link (/api/email/unsub, the same
 * HMAC token the Friday email uses) and the mailing address (EMAIL_POSTAL) —
 * CAN-SPAM. Nothing about a child, ever: the only thing this file knows is an
 * email address. After the third, a parent hears from Sona once a week, on
 * Mondays (lib/weekly.ts).
 *
 * - the first: sent by /api/lead the moment a grown-up gives their email.
 *   Once per address, ever (`nurture:0:<email>`, set NX before sending, so a
 *   double tap or a retry cannot send two; its value is the sign-up time).
 *   An email given INSIDE the app (IN_APP_SOURCES: setup's email step,
 *   Settings' weekly report switch, or a purchase's plan post) starts with
 *   "The 5-minute trick" instead of "Here's Sona", whose whole point is the
 *   App Store link they have no use for (Travis, 13 Oct 2026, with setup's
 *   email box moved before the price).
 * - the rest: the next one's time sits in the sorted set `nurture:due` and
 *   its name in `nurture:next:<email>`; /api/cron/nurture sends what is due
 *   once a day. ZREM is the claim, so two overlapping runs cannot both send.
 * Anyone in `email:unsub` (the Friday email's suppression set) leaves it.
 * A parent who starts Sona Premium leaves it too (stopSeries, 16 Oct 2026),
 * once the phone tells /api/lead or RevenueCat's own message names their
 * email (lib/revenuecat.ts); a purchase with no email anywhere (none on the
 * phone, so none at RevenueCat) is not seen, so the last email still says
 * "Already started? You can ignore the button." rather than assume. Someone who
 * started Premium and gives their email again later (`nurture:0` long
 * gone) gets day 0's tip and nothing else: never "Here's Sona", which sells
 * free days Apple will not give twice.
 *
 * The people who signed up before this shipped were emailed by hand from a
 * Kit export (5–6 Oct 2026), so there is no back-fill here: it starts with
 * the next sign-up.
 */

export const APP_URL = "https://apps.apple.com/us/app/sona-speech/id6785755867";
export const DAY_MS = 24 * 60 * 60 * 1000;
export const DUE_KEY = "nurture:due";

/**
 * Leads posted from inside the app: they already have it, so no download
 * email. `app-setup` is setup's email step (also the Android web app, whose
 * parents have Sona too); `app-trial` / `app-paid` are a purchase's plan post
 * (sona.js _tellPlan), which can be the first time the server hears the
 * address if the setup post never arrived.
 */
export const IN_APP_SOURCES = ["app-setup", "app-settings", "app-trial", "app-paid"] as const;
export const inAppSource = (s: unknown): boolean => typeof s === "string" && (IN_APP_SOURCES as readonly string[]).includes(s);
/** The day-0 email: "Here's Sona" (the App Store link) from the website, "The 5-minute trick" from inside the app. */
export const WEB_START: Id = "hello";
export const IN_APP_START: Id = "trick";

type Kv = (cmd: (string | number)[]) => Promise<unknown>;
type Fetch = typeof fetch;

/** Each email by name, so a reworded or dropped email never shifts another's place. */
export type Id = "hello" | "trick" | "recast" | "answers";
export type Step = Id;

type Content = { id: Id; day: number; next?: Id; subject: string; preview: string; paras: string[]; button: string; after: string[]; ps?: string };

/**
 * THE SEQUENCE (Travis, 7 Oct 2026: "a super short email ... to send them
 * directly to the app store and then a second email that's like the five
 * minute trick ... then day two day three day five"; cut to three on 23 Oct
 * 2026: "we send them one an email immediately, the next day, and then one
 * more day ... I want to send less emails in the sequence. So just 3, and
 * then afterwards, I want to do 1 email a week"). Built from his spec
 * (sona-email-system.md, A1-A5), with what is not true of the app today
 * taken out: no cup tower, no "correct" or scoring (Sona hears "a voice of
 * the right kind", never grades), no yearly price and no "free forever"
 * games (a new family meets the trial first; the price is Apple's, so no
 * figure is typed), no testimonial (none exists yet). `day` is days after
 * sign-up, `next` the email after it. From the website: "Here's Sona", the
 * recast tip, the quick answers; from inside the app: "The 5-minute trick"
 * in place of the first. "The balloon problem" (day 3) and the website's
 * second day-0 email went on 23 Oct 2026. Rachel's claims (the bike, the
 * recast tip, the ages) are hers to confirm.
 */
export const CONTENT: Content[] = [
  {
    id: "hello",
    day: 0,
    next: "recast",
    subject: "Here\u2019s Sona",
    preview: "Your download link, and what to do tonight",
    paras: [
      "Hi there,",
      "Thanks for signing up! Here\u2019s your link to get Sona on your iPhone or iPad.",
    ],
    button: "Get Sona on the App Store",
    after: [
      "Try Sona free. Apple shows the price and the free days before you confirm.",
      "Tonight, hand your child the phone for one round. That\u2019s it.",
      "Hit reply and tell me what sound your child is working on.",
    ],
  },
  {
    id: "trick",
    day: 0,
    next: "recast",
    subject: "The 5-minute trick",
    preview: "Speech sounds work like riding a bike",
    paras: [
      "Hi there,",
      "Tricky sounds like R, S, and L are a lot like riding a bike for kiddos.",
      "You don\u2019t learn to ride by practicing once a week for an hour. You learn by doing a little every day.",
      "That\u2019s the whole idea behind Sona: short daily practice that adds up.",
    ],
    button: "Start today\u2019s 5 minutes",
    after: [],
    ps: "Already practicing? Keep the streak going!",
  },
  {
    // day 1 since 17 Oct 2026 (Travis: "day zero, day one, day three, day
    // five. So just move day two to day one")
    id: "recast",
    day: 1,
    next: "answers",
    subject: "Try this the next time they say \u201cwabbit\u201d",
    preview: "One small habit that helps a lot",
    paras: [
      "Hi there,",
      "Here\u2019s my favorite tip for parents: don\u2019t correct. Say it back the right way.",
      "If your child says \u201cLook, a wabbit!\u201d, skip \u201cNo, say rabbit.\u201d Instead, say: \u201cYes! A rabbit! The rabbit is hopping!\u201d",
      "They hear the sound the right way, and they don\u2019t feel like they made a mistake. Do it a few times a day, and it adds up.",
      "Sona handles the practice. You just keep it light and fun.",
    ],
    button: "Open Sona",
    after: [],
  },
  {
    // day 2 since 23 Oct 2026 (it was day 5, after "The balloon problem")
    id: "answers",
    day: 2,
    subject: "Quick answers before you decide",
    preview: "What it costs, how to cancel, and what Sona is (and isn\u2019t)",
    paras: [
      "Hi there,",
      "Here\u2019s what parents ask me most:",
      "What does it cost? The first days are free, then Apple shows the price before you confirm.",
      "Can I cancel? Yes, anytime: iPhone Settings \u2192 your name \u2192 Subscriptions \u2192 Sona.",
      "How long a day? About 5 minutes.",
      "What ages? About 3 to 8, for kids who talk but are hard to understand: \u201cwabbit,\u201d a lisp, trouble with R, S, or L.",
      "Is my child\u2019s voice uploaded? No. Sona listens on the phone, and audio is never uploaded.",
      "Is it the same as seeing a speech therapist? No. Sona is practice at home. It doesn\u2019t test your child, and it doesn\u2019t replace a speech therapist.",
    ],
    button: "Start your free trial",
    after: [],
    // "The balloon problem" carried this line until 23 Oct 2026
    ps: "Already started? You can ignore the button.",
  },
];

const BY_ID = new Map<string, Content>(CONTENT.map((c) => [c.id, c]));
export const mailOf = (id: unknown): Content | undefined => (typeof id === "string" ? BY_ID.get(id) : undefined);
/** The emails one path gets, in order: the day-0 email, then each `next`. */
export function series(first: Id): Id[] {
  const out: Id[] = [];
  for (let c = mailOf(first); c && out.length < CONTENT.length; c = mailOf(c.next)) out.push(c.id);
  return out;
}

/**
 * `nurture:next` as the five-email build kept it, a number (its place in the
 * old list), for an address that was part-way through on 23 Oct 2026: 0 was
 * "Here's Sona" and 1 "The 5-minute trick" (each a day-0 email Resend turned
 * away, due now), 2 the recast tip, and 3 ("The balloon problem") and 4 the
 * quick answers, which is now the last. Nobody is sent an email twice or
 * jumps back; someone waiting for the balloon gets the answers on that day.
 */
const LEGACY: Record<string, Id> = { "0": "hello", "1": "trick", "2": "recast", "3": "answers", "4": "answers" };
function keptStep(kept: unknown): Id {
  const k = kept === null || kept === undefined ? "" : String(kept);
  return mailOf(k)?.id || LEGACY[k] || "recast";
}

export function unsubToken(email: string, secret: string): string {
  return createHmac("sha256", secret).update(email).digest("hex").slice(0, 24);
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function render(step: Step, unsubUrl: string, postal: string): { subject: string; html: string; text: string } {
  const c = mailOf(step) as Content;
  const P = 'style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;"';
  const html =
    `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;">` +
    `<div style="display:none;max-height:0;overflow:hidden;">${esc(c.preview)}</div>` +
    `<div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    c.paras.map((p) => `<p ${P}>${esc(p)}</p>`).join("") +
    `<p style="margin:24px 0 16px;"><a href="${APP_URL}" style="display:inline-block;background:#ff8a3d;color:#ffffff;text-decoration:none;font-weight:700;font-size:17px;padding:13px 26px;border-radius:12px;">${esc(c.button)}</a></p>` +
    c.after.map((p) => `<p ${P}>${esc(p)}</p>`).join("") +
    `<p style="margin:24px 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;">Rachel, MS, CF-SLP<br>Sona co-founder</p>` +
    (c.ps ? `<p ${P}><em>${esc(c.ps)}</em></p>` : "") +
    `<p style="margin:0;font-size:12px;line-height:1.5;color:#8a8a8a;">You’re getting this because you gave Sona your email.<br>Sona · ${esc(postal)}<br><a href="${unsubUrl}" style="color:#8a8a8a;">Unsubscribe</a></p>` +
    `</div></body></html>`;
  const text =
    c.paras.join("\n\n") + `\n\n${c.button}: ${APP_URL}\n\n` +
    (c.after.length ? c.after.join("\n\n") + "\n\n" : "") +
    "Rachel, MS, CF-SLP\nSona co-founder\n" +
    (c.ps ? `\n${c.ps}\n` : "") +
    `--\nYou’re getting this because you gave Sona your email.\nSona · ${postal}\nUnsubscribe: ${unsubUrl}\n`;
  return { subject: c.subject, html, text };
}

/**
 * Everything a send needs, or null — and then nothing sends (no address, no
 * link, no email). The weekly progress report (lib/report.ts) sends from the
 * same address, under the same rules.
 */
export function config():{ key: string; secret: string; postal: string; from: string; replyTo: string } | null {
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

export async function unsubscribed(email: string, kv: Kv): Promise<boolean | null> {
  const r = await kv(["SISMEMBER", "email:unsub", email]);
  if (r === undefined || r === null) return null; // store didn't answer: fail closed
  return Number(r) === 1;
}

export type SendResult = "sent" | "unsub" | "failed";

export async function sendStep(email: string, step: Step, kv: Kv = kvCmd, f: Fetch = fetch): Promise<SendResult> {
  const cfg = config();
  if (!cfg || !mailOf(step)) return "failed";
  const unsub = await unsubscribed(email, kv);
  if (unsub === true) return "unsub";
  if (unsub !== false) return "failed";
  const unsubUrl = `https://speaksona.com/api/email/unsub?e=${encodeURIComponent(email)}&k=${unsubToken(email, cfg.secret)}`;
  const { subject, html, text } = render(step, unsubUrl, cfg.postal);
  try {
    const send = () => f("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json", "Idempotency-Key": `nurture-${step}-${email}` },
      body: JSON.stringify({
        from: cfg.from, to: [email], reply_to: cfg.replyTo, subject, html, text,
        headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      }),
    });
    let r = await send();
    // Resend's two requests a second are shared with the contact list
    // (lib/contacts), which /api/lead fills in the same moment: a 429 is
    // tried once more, and the idempotency key makes a second send of the
    // same email impossible
    if (r.status === 429) {
      await new Promise((ok) => setTimeout(ok, 1100));
      r = await send();
    }
    if (!r.ok) console.error("[nurture] Resend refused step", step, r.status);
    return r.ok ? "sent" : "failed";
  } catch (e) {
    console.error("[nurture] send threw:", e instanceof Error ? e.message : String(e));
    return "failed";
  }
}

export const nextKey = (email: string) => "nurture:next:" + email;

export const stopKey = (email: string) => "nurture:stop:" + email;

/**
 * A parent who started Sona Premium (the phone's plan post, via /api/lead,
 * or RevenueCat's own message, lib/revenuecat.ts): the rest of the series is
 * taken off the schedule. `nurture:0` stays, so the address is never
 * enrolled again. The stop mark is for a daily run that had already claimed
 * this address when the post came: it puts the next email back on the
 * schedule, and the mark takes it off again unsent. It has no time limit:
 * Apple gives the free days once, so a family enrolled again years later (a
 * new phone, the same email, `nurture:0` long gone) is never sold them
 * again: enroll reads it, and sends day 0's tip alone. True when the store
 * took all three steps.
 */
export async function stopSeries(rawEmail: string, kv: Kv = kvCmd): Promise<boolean> {
  const email = rawEmail.trim().toLowerCase();
  const set = await kv(["SET", stopKey(email), "1"]);
  const off = await kv(["ZREM", DUE_KEY, email]);
  const del = await kv(["DEL", nextKey(email)]);
  return set === "OK" && off !== undefined && off !== null && del !== undefined && del !== null;
}

/**
 * /api/lead: a new grown-up's email. Welcome now, schedule the next. Never
 * throws. `inApp`: the address came from inside the app, so the series starts
 * at IN_APP_START (no App Store email); everything after it is unchanged.
 */
export async function enroll(rawEmail: string, kv: Kv = kvCmd, f: Fetch = fetch, now: number = Date.now(), opts: { inApp?: boolean } = {}): Promise<boolean> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !configured()) return false;
  try {
    const first = await kv(["SET", "nurture:0:" + email, new Date(now).toISOString(), "NX", "EX", 31536000]);
    if (first !== "OK") return false;
    // started Premium before (stopSeries' mark, kept for good): the tip only
    const stopped = Boolean(await kv(["GET", stopKey(email)]));
    // the one day-0 email goes now (it was two until 23 Oct 2026)
    const step: Id = opts.inApp || stopped ? IN_APP_START : WEB_START;
    const r = await sendStep(email, step, kv, f);
    // Resend busy (its two requests a second are shared with the contact
    // list): it waits for the next daily run instead of being lost
    const next = r === "failed" ? step : mailOf(step)?.next;
    if (r !== "unsub" && next && !stopped) {
      await kv(["SET", nextKey(email), next, "EX", 31536000]);
      await kv(["ZADD", DUE_KEY, r === "failed" ? now : now + (mailOf(next) as Content).day * DAY_MS, email]);
    }
    return r === "sent";
  } catch {
    return false;
  }
}

/**
 * /api/cron/nurture: send every email that is due, then schedule the one
 * after it from the sign-up time (so a late run never pushes the rest back).
 * ZREM is the claim. A kept step that is no email's name is read as the
 * five-email build kept it (LEGACY), and a missing one (a lost write) as the
 * recast tip, the email after either day-0 one. An unsubscribed address
 * leaves the sequence; a failed send moves on, so one bad address can never
 * loop.
 */
export async function runDue(kv: Kv = kvCmd, f: Fetch = fetch, now: number = Date.now(), opts: { deadline?: number } = {}): Promise<{ due: number; sent: number; left: number }> {
  const due = (await kv(["ZRANGEBYSCORE", DUE_KEY, "-inf", now, "LIMIT", 0, 500])) as unknown;
  if (!Array.isArray(due)) return { due: 0, sent: 0, left: 0 };
  let sent = 0, done = 0;
  for (const raw of due as string[]) {
    // out of time: stop before claiming, so the rest are still due tomorrow
    if (opts.deadline !== undefined && Date.now() > opts.deadline) break;
    done++;
    const e = String(raw);
    const claimed = await kv(["ZREM", DUE_KEY, e]);
    if (Number(claimed) !== 1) continue; // another run took it
    if (await kv(["GET", stopKey(e)])) { await kv(["DEL", nextKey(e)]); continue; } // started Premium
    // a kept day-0 email is one Resend turned away at sign-up: it goes now
    const step = keptStep(await kv(["GET", nextKey(e)]));
    const r = await sendStep(e, step, kv, f);
    if (r === "sent") sent++;
    const next = mailOf(mailOf(step)?.next);
    if (r === "unsub" || !next) {
      await kv(["DEL", nextKey(e)]);
      continue;
    }
    const startedIso = (await kv(["GET", "nurture:0:" + e])) as string | null;
    const started = startedIso ? Date.parse(startedIso) : NaN;
    const at = Number.isFinite(started) ? started + next.day * DAY_MS : now + (next.day - (mailOf(step) as Content).day) * DAY_MS;
    await kv(["SET", nextKey(e), next.id, "EX", 31536000]);
    await kv(["ZADD", DUE_KEY, Math.max(at, now + 1), e]);
  }
  return { due: due.length, sent, left: due.length - done };
}
