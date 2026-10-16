import { createHash } from "crypto";
import { kvCmd } from "@/lib/slpAuth";
import { APP_URL, DAY_MS, config, esc, markBuyer, unsubToken } from "@/lib/nurture";
import { PACE_MS, SEND_CAP, addressOk, suppressed } from "@/lib/report";

/**
 * REVENUECAT TELLS SONA (RCHOOK1, Travis, 16 Oct 2026: "build the revcat
 * webhook", then: show the parent's email in RevenueCat, stop the sales
 * emails for buyers, a note before the free days end, a note when a plan
 * has ended, and Kit turned off).
 *
 * Apple never tells an app who bought. RevenueCat does know when a purchase
 * starts, renews, is cancelled or ends, and since this change the phone
 * hands it the parent's email (sona.js `_rcEmail`, the address the parent
 * typed on setup's email step, never anything about a child). So each
 * message RevenueCat posts to /api/revenuecat carries that email
 * (`subscriber_attributes.$email`), and Sona acts on it:
 *
 *   - what RevenueCat last said, per address, in `rc:plans` (a hash: email
 *     to {s, exp, ts, at}), for /leads.html's Premium column. `s` is one of
 *     trial, paid, cancelled, billing, ended; `ts` is RevenueCat's own event
 *     time, and an older event never overwrites a newer one (RevenueCat
 *     sends in no particular order, and more than once);
 *   - a buyer mark (`nurture:buyer:<email>`, lib/nurture.ts): the welcome
 *     series skips its two sales emails;
 *   - "Your free days end soon": queued in `rc:remind` for 48 hours before
 *     the free days end, and sent by the daily run (/api/cron/nurture, 16:00
 *     UTC) only while the plan is still on its free days (not cancelled, not
 *     already paid) and more than 24 hours remain, Apple's own line for a
 *     cancel to count. One run lands in every 24 hours, so a family hears
 *     between 24 and 48 hours before the end, once per free-days end;
 *   - "We miss you at Sona": queued in `rc:miss` a day after a plan ends, sent
 *     only if it is still ended then, at most once a year an address.
 *
 * WHO MAY BE EMAILED. Only an address that joined Sona's own list (setup's
 * email step, through /api/lead: `nurture:0:<email>`), and never one in
 * `email:unsub` (its exact form or its plain mailbox). RevenueCat's
 * attributes can be set by anyone holding the app's public key, so an email
 * there is not proof of anything: it can only ever reach an address that
 * already gave Sona its email, with Rachel's unsubscribe link.
 *
 * WHAT IS KEPT. Of each message only its id (a mark against doing it twice,
 * kept 14 days), what it means (the state above), when the plan ends and
 * RevenueCat's event time; never the price, the country, a transaction id or
 * any other attribute. Messages from Apple's sandbox (TestFlight, App
 * Review, Travis's own tests) are ignored unless REVENUECAT_SANDBOX=1.
 *
 * The route answers 200 to anything it has dealt with or chooses to ignore
 * (a TEST, a type Sona has no use for, a message with no email), and 503
 * when the store did not answer, so RevenueCat tries again (5 times, over
 * about two and a half hours). The emails' words are Rachel's to change.
 */

type Kv = (cmd: (string | number)[]) => Promise<unknown>;
type Fetch = typeof fetch;

export const PLANS_KEY = "rc:plans";
export const REMIND_KEY = "rc:remind";
export const MISS_KEY = "rc:miss";
export const evtKey = (id: string) => "rc:evt:" + id;
export const sentKey = (kind: "remind" | "miss", email: string, exp: number) =>
  kind === "remind" ? "rc:sent:remind:" + email + ":" + exp : "rc:sent:miss:" + email;
export const EVT_KEEP_SEC = 14 * 24 * 60 * 60;
export const REMIND_BEFORE_MS = 48 * 60 * 60 * 1000; // queued for 48 hours before the free days end
export const REMIND_LATE_MS = 24 * 60 * 60 * 1000; // less than this left: too late to cancel in time, so nothing is sent
export const MISS_AFTER_MS = DAY_MS; // a day after a plan ends
export const REMIND_SENT_SEC = 30 * 24 * 60 * 60;
export const MISS_SENT_SEC = 365 * 24 * 60 * 60;
export const MAX_BODY = 64 * 1024;
/** Apple's page for a parent's own subscriptions (opens Settings › Subscriptions on an iPhone). */
export const SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

export type RcState = "trial" | "paid" | "cancelled" | "billing" | "ended";
export type RcEvent = { id: string; type: string; ts: number; sandbox: boolean; email: string; exp: number; state: RcState | null };
export type Plan = { s: RcState; exp: number; ts: number; at: string };

const STATES: readonly string[] = ["trial", "paid", "cancelled", "billing", "ended"];

/**
 * What a message means for a family, from its type and the period it is in
 * (and why, for a cancellation). null: a message Sona has no use for (TEST,
 * TRANSFER, a temporary grant, paywall and web-billing events, any type
 * RevenueCat adds later).
 */
export function stateFor(type: string, period: string, reason: string): RcState | null {
  switch (type) {
    case "INITIAL_PURCHASE": // a free trial starting is an INITIAL_PURCHASE in its TRIAL period
    case "UNCANCELLATION":
    case "SUBSCRIPTION_EXTENDED":
      return period === "TRIAL" ? "trial" : "paid";
    case "RENEWAL": // the free days turning into a paid month, or a lapsed family coming back
    case "PRODUCT_CHANGE":
    case "NON_RENEWING_PURCHASE":
    case "REFUND_REVERSED":
      return "paid";
    case "CANCELLATION": // auto-renew off, or a refund; Premium lasts to its end either way
      return reason === "BILLING_ERROR" ? "billing" : "cancelled";
    case "BILLING_ISSUE":
      return "billing";
    case "EXPIRATION":
      return "ended";
    default:
      return null;
  }
}

const str = (v: unknown, max: number): string => (typeof v === "string" && v.length <= max ? v : "");
const ms = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 1e14 ? Math.floor(n) : 0;
};

/** The parent's email RevenueCat holds for this customer (`$email`), as Sona would use it, or "". */
function emailOf(attrs: unknown): string {
  if (!attrs || typeof attrs !== "object") return "";
  const a = (attrs as Record<string, unknown>)["$email"];
  const v = a && typeof a === "object" ? (a as Record<string, unknown>).value : a;
  return addressOk(v);
}

/**
 * The fields Sona keeps from a message, built one by one; anything else in
 * it (the price, the country, transaction ids, other attributes) never
 * leaves this function. null: not a RevenueCat message at all.
 */
export function readEvent(body: unknown): RcEvent | null {
  if (!body || typeof body !== "object") return null;
  const e = (body as Record<string, unknown>).event;
  if (!e || typeof e !== "object") return null;
  const ev = e as Record<string, unknown>;
  const id = str(ev.id, 200), type = str(ev.type, 60);
  if (!id || !/^[A-Za-z0-9_:.\-]+$/.test(id) || !/^[A-Z_]+$/.test(type)) return null;
  const period = str(ev.period_type, 20).toUpperCase();
  const reason = str(ev.cancel_reason, 40).toUpperCase();
  return {
    id, type,
    ts: ms(ev.event_timestamp_ms),
    sandbox: str(ev.environment, 20).toUpperCase() !== "PRODUCTION",
    email: emailOf(ev.subscriber_attributes),
    exp: ms(ev.expiration_at_ms),
    state: stateFor(type, period, reason),
  };
}

/**
 * Store the newest word per address, in one step: an event older than the
 * one already kept changes nothing (0); otherwise it is kept (1).
 */
const PLAN_SCRIPT = `-- rc:plan
local cur = redis.call('HGET', KEYS[1], ARGV[1])
if cur then
  local t = tonumber(string.match(cur, '"ts":(%d+)'))
  if t and t > tonumber(ARGV[2]) then return 0 end
end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[3])
return 1`;

/**
 * One message, once (`rc:evt:<id>`, released again if any write fails, so
 * RevenueCat's retry can redo it). "ok": acted on; "dup": already done;
 * "stale": older than what Sona has (the buyer mark still holds); "retry":
 * the store did not answer, answer 503.
 */
export async function apply(ev: RcEvent & { state: RcState }, kv: Kv = kvCmd, now: number = Date.now()): Promise<"ok" | "dup" | "stale" | "retry"> {
  const claim = await kv(["SET", evtKey(ev.id), "1", "NX", "EX", EVT_KEEP_SEC]);
  if (claim === null) return "dup";
  if (claim !== "OK") return "retry";
  let done = false;
  try {
    const rec: Plan = { s: ev.state, exp: ev.exp, ts: ev.ts, at: new Date(now).toISOString() };
    const put = await kv(["EVAL", PLAN_SCRIPT, 1, PLANS_KEY, ev.email, ev.ts, JSON.stringify(rec)]);
    if (put === undefined || put === null) return "retry";
    // every state is someone who started Premium at some point: no more sales emails
    if (!(await markBuyer(ev.email, kv))) return "retry";
    if (Number(put) !== 1) { done = true; return "stale"; }
    if (ev.state === "trial" && ev.exp > 0) {
      if ((await kv(["ZADD", REMIND_KEY, ev.exp - REMIND_BEFORE_MS, ev.email])) === undefined) return "retry";
    }
    if (ev.state === "ended") {
      if ((await kv(["ZADD", MISS_KEY, Math.max(now, ev.ts) + MISS_AFTER_MS, ev.email])) === undefined) return "retry";
    }
    done = true;
    return "ok";
  } finally {
    if (!done) await kv(["DEL", evtKey(ev.id)]);
  }
}

export function parsePlan(raw: unknown): Plan | null {
  if (typeof raw !== "string") return null;
  try {
    const p = JSON.parse(raw) as Partial<Plan>;
    if (!p || typeof p.s !== "string" || !STATES.includes(p.s)) return null;
    return { s: p.s as RcState, exp: ms(p.exp), ts: ms(p.ts), at: typeof p.at === "string" ? p.at : "" };
  } catch {
    return null;
  }
}

/** Every address RevenueCat has told Sona about, for /leads.html: email to plan. */
export async function readPlans(kv: Kv = kvCmd): Promise<Record<string, Plan>> {
  const flat = await kv(["HGETALL", PLANS_KEY]);
  const out: Record<string, Plan> = {};
  if (Array.isArray(flat)) {
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const p = parsePlan(flat[i + 1]);
      if (p) out[String(flat[i])] = p;
    }
  }
  return out;
}

// ── the two emails ───────────────────────────────────────────────────────

type Mail = { subject: string; preview: string; paras: string[]; button: string; link: string; ps?: string };

/**
 * Rachel's words (hers to change). The house email rules hold here too
 * (rcwebhooktest): her byline, no clinical words, no emoji, no prices (the
 * price is Apple's and depends on the country), and no number of free days
 * (that is the App Store's too).
 */
export const MAILS: Record<"remind" | "miss", Mail> = {
  remind: {
    subject: "Your free days end soon",
    preview: "Nothing to do if you’re keeping Sona",
    paras: [
      "Hi there,",
      "A quick heads-up: your free days of Sona Premium end soon.",
      "Keeping Sona? There’s nothing to do. Your plan carries on, and Apple charges the price you saw when you started.",
      "Rather stop? Cancel at least 24 hours before your free days end: iPhone Settings → your name → Subscriptions → Sona. You keep Premium until they end.",
    ],
    button: "See your subscription",
    link: SUBSCRIPTIONS_URL,
    ps: "Questions? Just reply to this email.",
  },
  miss: {
    subject: "We miss you at Sona",
    preview: "Your child’s practice is still on your phone",
    paras: [
      "Hi there,",
      "Your Sona Premium has ended, and we miss you.",
      "If Sona is still on your phone, your child’s practice is saved there, so you can pick up right where you left off.",
      "A few minutes a day still adds up. To come back, open Sona and tap any game.",
      "If something wasn’t working, hit reply and tell me. I’d love to know.",
    ],
    button: "Open Sona",
    link: APP_URL,
  },
};

export function renderMail(kind: "remind" | "miss", unsubUrl: string, postal: string): { subject: string; html: string; text: string } {
  const c = MAILS[kind];
  const P = 'style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;"';
  const html =
    `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;">` +
    `<div style="display:none;max-height:0;overflow:hidden;">${esc(c.preview)}</div>` +
    `<div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    c.paras.map((p) => `<p ${P}>${esc(p)}</p>`).join("") +
    `<p style="margin:24px 0 16px;"><a href="${c.link}" style="display:inline-block;background:#ff8a3d;color:#ffffff;text-decoration:none;font-weight:700;font-size:17px;padding:13px 26px;border-radius:12px;">${esc(c.button)}</a></p>` +
    `<p style="margin:24px 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;">Rachel, MS, CF-SLP<br>Sona co-founder</p>` +
    (c.ps ? `<p ${P}><em>${esc(c.ps)}</em></p>` : "") +
    `<p style="margin:0;font-size:12px;line-height:1.5;color:#8a8a8a;">You’re getting this because you gave Sona your email.<br>Sona · ${esc(postal)}<br><a href="${unsubUrl}" style="color:#8a8a8a;">Unsubscribe</a></p>` +
    `</div></body></html>`;
  const text =
    c.paras.join("\n\n") + `\n\n${c.button}: ${c.link}\n\n` +
    "Rachel, MS, CF-SLP\nSona co-founder\n" +
    (c.ps ? `\n${c.ps}\n` : "") +
    `--\nYou’re getting this because you gave Sona your email.\nSona · ${postal}\nUnsubscribe: ${unsubUrl}\n`;
  return { subject: c.subject, html, text };
}

/** A Resend Idempotency-Key with no address in it (a header carries ASCII only). */
const keyFor = (kind: string, email: string, exp: number) => `rc-${kind}-${createHash("sha256").update(email + " " + exp).digest("hex").slice(0, 32)}`;

async function send(f: Fetch, cfg: NonNullable<ReturnType<typeof config>>, kind: "remind" | "miss", email: string, exp: number): Promise<{ ok: boolean; status: number }> {
  const unsubUrl = `https://speaksona.com/api/email/unsub?e=${encodeURIComponent(email)}&k=${unsubToken(email, cfg.secret)}`;
  const m = renderMail(kind, unsubUrl, cfg.postal);
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await f("https://api.resend.com/emails", {
      method: "POST", signal: ctl.signal,
      headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json", "Idempotency-Key": keyFor(kind, email, exp) },
      body: JSON.stringify({
        from: cfg.from, to: [email], reply_to: cfg.replyTo, subject: m.subject, html: m.html, text: m.text,
        headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      }),
    });
    if (!r.ok) console.error("[revenuecat] Resend refused", kind, r.status);
    return { ok: r.ok, status: r.status };
  } catch (e) {
    console.error("[revenuecat] send threw:", e instanceof Error ? e.message : String(e));
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export type RcRun = { reminded: number; missed: number; skipped: number; failed: number; stopped?: string };

/**
 * The daily run (/api/cron/nurture, after the welcome series): every queued
 * note that is due, if it is still true. ZREM is the claim; a note that could
 * not be checked (the store did not answer) or sent (Resend busy or down)
 * goes back in its queue for the next run, which checks it all again; a
 * reminder that has become too late is dropped there.
 */
export async function runRc(kv: Kv = kvCmd, f: Fetch = fetch, now: number = Date.now(),
  opts: { deadline?: number; sleep?: (ms: number) => Promise<void> } = {}): Promise<RcRun> {
  const res: RcRun = { reminded: 0, missed: 0, skipped: 0, failed: 0 };
  const cfg = config();
  if (!cfg) return res;
  const sleep = opts.sleep || ((n: number) => new Promise<void>((r) => setTimeout(r, n)));
  let tries = 0;
  for (const kind of ["remind", "miss"] as const) {
    if (res.stopped) break;
    const key = kind === "remind" ? REMIND_KEY : MISS_KEY;
    const due = await kv(["ZRANGEBYSCORE", key, "-inf", now, "WITHSCORES", "LIMIT", 0, 300]);
    if (!Array.isArray(due)) continue;
    for (let i = 0; i + 1 < due.length; i += 2) {
      const email = String(due[i]), score = Number(due[i + 1]);
      if (tries >= SEND_CAP) { res.stopped = "cap"; break; } // the next run picks up the rest
      if (opts.deadline && Date.now() > opts.deadline) { res.stopped = "time"; break; }
      if (Number(await kv(["ZREM", key, email])) !== 1) continue; // another run took it
      const back = async () => { await kv(["ZADD", key, score, email]); };
      const rawPlan = await kv(["HGET", PLANS_KEY, email]);
      if (rawPlan === undefined) { await back(); continue; }
      const plan = parsePlan(rawPlan);
      let exp = 0;
      if (kind === "remind") {
        // still on the free days (not cancelled, not paid), and still time to cancel
        if (!plan || plan.s !== "trial" || !plan.exp || plan.exp - now <= REMIND_LATE_MS) { res.skipped++; continue; }
        if (plan.exp - REMIND_BEFORE_MS > now) { await kv(["ZADD", key, plan.exp - REMIND_BEFORE_MS, email]); continue; } // a later end: not yet
        exp = plan.exp;
      } else if (!plan || plan.s !== "ended") { res.skipped++; continue; } // back already, or never ended
      // only an address that joined Sona's list, and never one that left it
      const joined = await kv(["EXISTS", "nurture:0:" + email]);
      if (joined === undefined) { await back(); continue; }
      if (Number(joined) !== 1) { res.skipped++; continue; }
      const unsub = await suppressed(email, kv);
      if (unsub === null) { await back(); continue; }
      if (unsub) { res.skipped++; continue; }
      const mark = await kv(["SET", sentKey(kind, email, exp), String(now), "NX", "EX", kind === "remind" ? REMIND_SENT_SEC : MISS_SENT_SEC]);
      if (mark === null) { res.skipped++; continue; } // already sent (this free-days end, or this year)
      if (mark !== "OK") { await back(); continue; }
      tries++;
      let r = { ok: false, status: 0 };
      for (let attempt = 0; attempt < 2; attempt++) {
        await sleep(attempt ? PACE_MS * 3 : PACE_MS);
        r = await send(f, cfg, kind, email, exp);
        if (r.status !== 429) break;
      }
      if (r.ok) { if (kind === "remind") res.reminded++; else res.missed++; continue; }
      res.failed++;
      await kv(["DEL", sentKey(kind, email, exp)]);
      // busy or down: the next run tries again; refused for good (a bad address): dropped
      if (r.status === 0 || r.status === 429 || r.status >= 500) await back();
      if (r.status === 429) { res.stopped = "rate"; break; }
    }
  }
  return res;
}
