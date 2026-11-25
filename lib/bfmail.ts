/**
 * THE BLACK FRIDAY EMAIL (BFMAIL1, Travis, 25 Nov 2026: "set up resend to
 * send them an email once they opt in as a lead. And these emails right now,
 * I want to be focusing on the Black Friday promotion").
 *
 * A speech therapist (role "slp") who gives an email on either opt-in (/ or
 * /blackfriday) while the deal is on (lib/caseload's bfOn: Sona Pro $9.99 a
 * month for 3 months, no free trial, until Sunday 29 Nov 11:59 PM Mountain)
 * gets ONE email from Rachel, at once: the deal, what Sona Pro does, when it
 * ends, and a button to the deal's plans. Once per address (`bfmail:<email>`,
 * set before the send, given back if the send fails), never to an address
 * that unsubscribed, always with the unsubscribe link and the mailing
 * address. After the end nothing is sent. Never anything about a child.
 *
 * Then one email a day, Thursday to Sunday, to every speech therapist on the
 * list (runBfDaily, below). Since 25 Nov 2026 (Travis) each says 50% off,
 * names no trial either way, sets Sona Pro beside Sona Lite, and carries
 * one 🎉.
 *
 * It goes through lib/mail's one door (Resend while GoHighLevel is off,
 * GHLEXIT1). Every word is Travis's to change; the figures are lib/caseload's.
 */
import { kvCmd } from "@/lib/slpAuth";
import { sendMail } from "@/lib/mail";
import { config, esc, unsubToken } from "@/lib/nurture";
import { suppressed } from "@/lib/report";
import { APP_ORIGIN } from "@/lib/site";
import { BF_ENDS_AT, BF_MONTHS, BF_PRICE, PRO_PRICE, bfOn, readPlan } from "@/lib/caseload";

type Kv = (cmd: (string | number)[]) => Promise<unknown>;
type Fetch = typeof fetch;

/** The deal's plans, on the website (the marketing pages live on www). */
export const BF_PLANS_URL = "https://www.speaksona.com/blackfriday/plans?utm_source=email&utm_campaign=bf-2026#pricing";

export const bfKey = (email: string) => "bfmail:" + email;

type Content = { subject: string; preview: string; paras: string[]; button: string; after: string[] };

/**
 * The line every email shares: Sona Pro next to Sona Lite (the kids' app
 * alone, $9.99 a month in the iPhone app, see /plans). This week Sona Pro
 * costs what one Lite account does (Travis, 25 Nov 2026: "unlimited
 * accounts, a dashboard for the price of 1 app account").
 */
const VS_LITE = `For the price of one Sona Lite account (${BF_PRICE} a month, just the kids’ app), Sona Pro gives you the dashboard and unlimited family accounts: every family on your caseload gets every game, and you see who practiced at home.`;
const ENDS = "The deal ends Sunday, November 29 at 11:59 PM Mountain. Cancel anytime.";
const DEAL = `${BF_PRICE} a month for your first ${BF_MONTHS} months (normally ${PRO_PRICE} a month)`;

/** The opt-in email: sent once, the moment a speech therapist gives an email. */
export function bfContent(): Content {
  return {
    subject: "🎉 Sona Pro is 50% off until Sunday",
    preview: `${DEAL}. Ends Sunday at 11:59 PM Mountain.`,
    paras: [
      "Hi! Thanks for checking out Sona.",
      `This week only, Sona Pro is 50% off: ${DEAL}.`,
      VS_LITE,
      "Get in while the offer is here!",
      ENDS,
    ],
    button: "Get 50% off Sona Pro",
    after: ["Questions? Just reply to this email."],
  };
}

/**
 * One email a day, Thursday to Sunday, by the Mountain date (Travis, 25 Nov
 * 2026: "emails every day through Sunday ... Or let's just do 1 a day").
 * Null on any other day.
 */
export const BF_DAYS = ["2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"];
/**
 * Days whose email only a founder's press sends (Travis, 25 Nov 2026: "I want
 * to send them today's email too. not yet tho just get it ready"): the daily
 * cron never sends these, /leads.html's Black Friday button does.
 */
export const BF_MANUAL_DAYS = ["2026-11-25"];
export function bfDayContent(day: string): Content | null {
  const after = ["Questions? Just reply to this email."];
  if (day === "2026-11-25") return {
    subject: "🎉 Black Friday came early: Sona Pro is 50% off",
    preview: `${DEAL}. Through Sunday.`,
    paras: [
      "Hi! Black Friday came early at Sona.",
      `This week only, Sona Pro is 50% off: ${DEAL}.`,
      VS_LITE,
      "Get in while the offer is here!",
      ENDS,
    ],
    button: "Get 50% off Sona Pro", after,
  };
  if (day === "2026-11-26") return {
    subject: "🎉 Happy Thanksgiving! Sona Pro is 50% off",
    preview: `${DEAL}. Through Sunday.`,
    paras: [
      "Happy Thanksgiving! We’re thankful for every SLP who sends practice home.",
      `Through Sunday, Sona Pro is 50% off: ${DEAL}.`,
      VS_LITE,
      ENDS,
    ],
    button: "Get 50% off Sona Pro", after,
  };
  if (day === "2026-11-27") return {
    subject: "🎉 It’s Black Friday: Sona Pro is 50% off",
    preview: `One plan, your whole caseload. ${BF_PRICE} a month for ${BF_MONTHS} months.`,
    paras: [
      `It’s Black Friday, and Sona Pro is 50% off: ${DEAL}!`,
      VS_LITE,
      "No limit on families: one plan covers your whole caseload. Use the games in your sessions, then send them home.",
      ENDS,
    ],
    button: "Get 50% off Sona Pro", after,
  };
  if (day === "2026-11-28") return {
    subject: "2 days left: Sona Pro is 50% off",
    preview: `${BF_PRICE} a month for your first ${BF_MONTHS} months, until Sunday night.`,
    paras: [
      `🎉 Quick reminder: Sona Pro is 50% off for 2 more days. That’s ${DEAL}.`,
      "Picture next week: you pick a Sona game for each session, send it home, and see who kept practicing.",
      VS_LITE,
      "Get in while the offer is here!",
      ENDS,
    ],
    button: "Get 50% off Sona Pro", after,
  };
  if (day === "2026-11-29") return {
    subject: "Last day! Sona Pro is 50% off until midnight",
    preview: `At 11:59 PM Mountain tonight it goes back to ${PRO_PRICE} a month.`,
    paras: [
      `Today is the last day to get Sona Pro at 50% off. At 11:59 PM Mountain tonight it goes back to ${PRO_PRICE} a month.`,
      `🎉 Get in now: ${DEAL}.`,
      VS_LITE,
      "Cancel anytime.",
    ],
    button: "Get 50% off before midnight", after,
  };
  return null;
}

export function renderBf(unsubUrl: string, postal: string, c: Content = bfContent()): { subject: string; html: string; text: string } {
  const P = 'style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;"';
  const html =
    `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;">` +
    `<div style="display:none;max-height:0;overflow:hidden;">${esc(c.preview)}</div>` +
    `<div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    c.paras.map((p) => `<p ${P}>${esc(p)}</p>`).join("") +
    `<p style="margin:24px 0 16px;"><a href="${BF_PLANS_URL}" style="display:inline-block;background:#1d2b4f;color:#ffffff;text-decoration:none;font-weight:700;font-size:17px;padding:13px 26px;border-radius:12px;">${esc(c.button)}</a></p>` +
    c.after.map((p) => `<p ${P}>${esc(p)}</p>`).join("") +
    `<p style="margin:24px 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;">Rachel, MS, CF-SLP<br>Sona co-founder</p>` +
    `<p style="margin:0;font-size:12px;line-height:1.5;color:#8a8a8a;">You’re getting this because you gave Sona your email.<br>Sona · ${esc(postal)}<br><a href="${unsubUrl}" style="color:#8a8a8a;">Unsubscribe</a></p>` +
    `</div></body></html>`;
  const text =
    c.paras.join("\n\n") + `\n\n${c.button}: ${BF_PLANS_URL}\n\n` +
    c.after.join("\n\n") + "\n\n" +
    "Rachel, MS, CF-SLP\nSona co-founder\n" +
    `--\nYou’re getting this because you gave Sona your email.\nSona · ${postal}\nUnsubscribe: ${unsubUrl}\n`;
  return { subject: c.subject, html, text };
}

/** Send one Black Friday email; the caller holds the once-only mark. */
async function sendOne(email: string, c: Content, idem: string, f: Fetch, cfg: NonNullable<ReturnType<typeof config>>): Promise<{ ok: boolean; status: number }> {
  const unsubUrl = `${APP_ORIGIN}/api/email/unsub?e=${encodeURIComponent(email)}&k=${unsubToken(email, cfg.secret)}`;
  const { subject, html, text } = renderBf(unsubUrl, cfg.postal, c);
  const r = await sendMail({
    from: cfg.from, to: email, replyTo: cfg.replyTo, subject, html, text,
    idempotencyKey: idem,
    headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  }, { fetch: f, retry429Ms: 1100 });
  return { ok: r.ok, status: r.status };
}

/**
 * Send the Black Friday email to a speech therapist's new lead, once. True
 * only when it was sent now. Never throws.
 */
export async function sendBfEmail(rawEmail: string, kv: Kv = kvCmd, f: Fetch = fetch, now: number = Date.now()): Promise<boolean> {
  try {
    const email = rawEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !bfOn(now)) return false;
    const cfg = config();
    if (!cfg) return false;
    if ((await suppressed(email, kv)) !== false) return false;
    const left = Math.max(60, Math.ceil((BF_ENDS_AT - now) / 1000) + 30 * 86400);
    const first = await kv(["SET", bfKey(email), new Date(now).toISOString(), "NX", "EX", left]);
    if (first !== "OK") return false;
    const r = await sendOne(email, bfContent(), `bfmail-2026-${email}`, f, cfg);
    if (!r.ok) {
      console.error("[bfmail] the email was refused", r.status);
      try { await kv(["DEL", bfKey(email)]); } catch { /* the next opt-in tries again */ }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** The Mountain date of `now` ("2026-11-26"), the day the deal's clock keeps. */
export function bfDay(now: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}

export type BfRun = { day: string; subject?: string; sent: number; skipped: number; failed: number; left: number; more?: boolean; stopped?: string };

const LIVE = new Set(["active", "trialing", "past_due"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * THE DAILY BLACK FRIDAY EMAIL (run by /api/cron/nurture, about 9 AM
 * Mountain, Thursday to Sunday). Every speech therapist on the list (role
 * "slp": a lead or a clinician account) gets that day's email, once
 * (`bfday:<day>:<email>`, given back when the send fails). Skipped: anyone
 * unsubscribed (exact or plain mailbox), anyone whose Sona Pro or Sona Clinic
 * is on (they have nothing to buy), and anyone sent the opt-in email in the
 * last 12 hours (one is enough for today). Nothing on another day or after
 * the end. Paced for Resend; stops at the deadline or on a second 429.
 */
export async function runBfDaily(
  list: () => Promise<{ email: string; role?: unknown }[]>,
  kv: Kv = kvCmd, f: Fetch = fetch, now: number = Date.now(),
  opts: { deadline?: number; pauseMs?: number; manual?: boolean; dry?: boolean } = {},
): Promise<BfRun> {
  const day = bfDay(now);
  const out: BfRun = { day, sent: 0, skipped: 0, failed: 0, left: 0 };
  // the cron sends Thursday to Sunday; a founder's press may also send a manual day
  const ok = BF_DAYS.includes(day) || (opts.manual === true && BF_MANUAL_DAYS.includes(day));
  const c = ok ? bfDayContent(day) : null;
  const cfg = config();
  if (!c || !bfOn(now) || !cfg) { out.stopped = "off"; return out; }
  out.subject = c.subject;
  const pause = opts.pauseMs ?? 550;
  const seen = new Set<string>();
  let busy = 0;
  for (const who of await list()) {
    if (!out.stopped && opts.deadline && Date.now() > opts.deadline) out.stopped = "time";
    // counting the rest has its own short limit, so a long list never runs the route out
    if (out.stopped && opts.deadline && Date.now() > opts.deadline + 20000) { out.more = true; break; }
    const email = String(who.email || "").trim().toLowerCase();
    if (who.role !== "slp" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || seen.has(email)) continue;
    seen.add(email);
    try {
      if ((await suppressed(email, kv)) !== false) { out.skipped++; continue; }
      const pro = await readPlan(email, kv, "pro"), clinic = await readPlan(email, kv, "clinic");
      if ((pro && LIVE.has(pro.status)) || (clinic && LIVE.has(clinic.status))) { out.skipped++; continue; }
      const optin = await kv(["GET", bfKey(email)]);
      const at = typeof optin === "string" ? Date.parse(optin) : NaN;
      if (Number.isFinite(at) && now - at < 12 * 3600 * 1000) { out.skipped++; continue; }
      const mark = `bfday:${day}:${email}`;
      // past the deadline (or a busy Resend), only count who is still owed it
      if (out.stopped || opts.dry) {
        const had = await kv(["GET", mark]);
        if (had === null || had === undefined) out.left++; else out.skipped++;
        continue;
      }
      if ((await kv(["SET", mark, "1", "NX", "EX", 10 * 86400])) !== "OK") { out.skipped++; continue; }
      if (pause) await sleep(pause);
      const r = await sendOne(email, c, `bfday-${day}-${email}`, f, cfg);
      if (!r.ok) {
        out.failed++;
        try { await kv(["DEL", mark]); } catch { /* tomorrow is another email */ }
        if (r.status === 429 && ++busy >= 2) { out.stopped = "busy"; out.left++; }
        continue;
      }
      out.sent++;
    } catch { out.failed++; }
  }
  return out;
}
