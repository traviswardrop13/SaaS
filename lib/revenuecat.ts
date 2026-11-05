import { createHash } from "crypto";
import { kvCmd } from "@/lib/slpAuth";
import { APP_URL, DAY_MS, config, esc, stopSeries, unsubToken } from "@/lib/nurture";
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
 *     trial, paid, cancelled, billing, ended, moved; `ts` is RevenueCat's own
 *     event time, and an older event never overwrites a newer one
 *     (RevenueCat sends in no particular order, and more than once);
 *   - the welcome series stops for that address (lib/nurture.ts
 *     stopSeries, its mark kept for good), as the phone's own plan post
 *     already does: a buyer is sold nothing more;
 *   - "Your free days end soon": queued in `rc:remind` for 50 hours before
 *     the free days end, and sent by the daily run (/api/cron/nurture, 16:00
 *     UTC, which Vercel may start up to an hour late) only while the plan is
 *     still on its free days (not cancelled, not already paid, not moved) and
 *     more than 24 hours remain, Apple's own line for a cancel to count. That
 *     window is 26 hours, so at least one run always lands in it: a family
 *     hears between 24 and 50 hours before the end, once per free-days end.
 *     A send Resend turns away for a moment is tried twice more in that run;
 *   - "We miss you at Sona": queued in `rc:miss` a day after a plan ends, sent
 *     only if it is still ended then, at most once a year an address.
 *
 * WHEN A SUBSCRIPTION MOVES. A family that sets Sona up on a second device
 * with the same Apple ID (the child's iPad, say) can move the subscription
 * to that device's RevenueCat customer, which may have no email. RevenueCat
 * then sends TRANSFER, and every later message is about the other customer.
 * So Sona remembers which customer each address came from (`rc:uid:<id>`,
 * 400 days), and a TRANSFER away from one marks that address "moved" and
 * drops its reminder: a parent who then cancels on the iPad is never told
 * "your plan carries on". RevenueCat sends in no particular order, so the
 * TRANSFER's time is kept against the customers it left (`rc:moved:<id>`,
 * 400 days) too: a purchase message from before it that arrives after it
 * (a retry) records the address as "moved", never as on its free days.
 *
 * WHO MAY BE EMAILED. Only an address that joined Sona's own list (setup's
 * email step, through /api/lead: `nurture:0:<email>`), and never one in
 * `email:unsub` (its exact form or its plain mailbox). RevenueCat's
 * attributes can be set by anyone holding the app's public key, so an email
 * there is not proof of anything: it can only ever reach an address that
 * already gave Sona its email, with Rachel's unsubscribe link.
 *
 * WHAT IS KEPT. Of each message only its id (a mark against doing it twice,
 * kept 14 days, written once everything else is), what it means (the state
 * above), when the plan ends, RevenueCat's event time, and which RevenueCat
 * customer the address belongs to (its random app user id); never the
 * price, the country, a transaction id or any other attribute. A message
 * about an address on the list also keeps that address on the list
 * (`nurture:0:<email>`'s year starts again; it is never created here). Messages from Apple's sandbox (TestFlight, App
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
export const uidKey = (id: string) => "rc:uid:" + id;
/** When the subscription last left this RevenueCat customer (a TRANSFER's time), for a message about it that arrives late. */
export const movedKey = (id: string) => "rc:moved:" + id;
export const EVT_KEEP_SEC = 14 * 24 * 60 * 60;
export const UID_KEEP_SEC = 400 * 24 * 60 * 60;
export const LIST_KEEP_SEC = 365 * 24 * 60 * 60; // nurture:0's own year (lib/nurture.ts enroll)
export const REMIND_BEFORE_MS = 50 * 60 * 60 * 1000; // queued for 50 hours before the free days end: a 26-hour window always holds a daily run
export const REMIND_LATE_MS = 24 * 60 * 60 * 1000; // less than this left: too late to cancel in time, so nothing is sent
export const MISS_AFTER_MS = DAY_MS; // a day after a plan ends
export const REMIND_SENT_SEC = 30 * 24 * 60 * 60;
export const MISS_SENT_SEC = 365 * 24 * 60 * 60;
export const MAX_BODY = 64 * 1024;
/** Apple's page for a parent's own subscriptions (opens Settings › Subscriptions on an iPhone). */
export const SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

export type RcState = "trial" | "paid" | "cancelled" | "billing" | "ended" | "moved";
/** `uids`: the customer ids this message is about; `from`: on a TRANSFER, the ones it moved away from. */
export type RcEvent = { id: string; type: string; ts: number; sandbox: boolean; email: string; exp: number; state: RcState | null; uids: string[]; from: string[]; fid: string; days: number };
export type Plan = { s: RcState; exp: number; ts: number; at: string };

const STATES: readonly string[] = ["trial", "paid", "cancelled", "billing", "ended", "moved"];

/**
 * What a message means for a family, from its type and the period it is in
 * (and why, for a cancellation). null: a message Sona has no use for (TEST,
 * a temporary grant, paywall and web-billing events, any type RevenueCat
 * adds later). TRANSFER is null here too: it carries no email, and the
 * route hands it to `moveAway`.
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

/** A RevenueCat customer id ("$RCAnonymousID:…" or an app's own): printable ASCII, or "". */
const uid = (v: unknown): string => {
  const s = str(v, 200);
  return s && /^[\x21-\x7e]+$/.test(s) ? s : "";
};

/**
 * TRIAL1: the anonymous family id the phone handed RevenueCat (`sona_fid`,
 * sona.js _rcEmail), or "": random, minted on the phone, never a name.
 */
function fidOf(attrs: unknown): string {
  if (!attrs || typeof attrs !== "object") return "";
  const a = (attrs as Record<string, unknown>)["sona_fid"];
  const v = a && typeof a === "object" ? (a as Record<string, unknown>).value : a;
  return typeof v === "string" && /^[A-Za-z0-9_-]{8,40}$/.test(v) ? v : "";
}

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
  const uids: string[] = [];
  for (const v of [ev.app_user_id, ev.original_app_user_id]) {
    const u = uid(v);
    if (u && !uids.includes(u)) uids.push(u);
  }
  const from: string[] = [];
  if (Array.isArray(ev.transferred_from)) {
    for (const v of ev.transferred_from.slice(0, 10)) {
      const u = uid(v);
      if (u && !from.includes(u)) from.push(u);
    }
  }
  return {
    id, type,
    ts: ms(ev.event_timestamp_ms),
    sandbox: str(ev.environment, 20).toUpperCase() !== "PRODUCTION",
    email: emailOf(ev.subscriber_attributes),
    exp: ms(ev.expiration_at_ms),
    state: stateFor(type, period, reason),
    uids, from,
    fid: fidOf(ev.subscriber_attributes),
    // how long the free days are, for a trial starting (TRIAL1)
    days: period === "TRIAL" && ms(ev.expiration_at_ms) > ms(ev.purchased_at_ms) && ms(ev.purchased_at_ms) > 0
      ? Math.max(1, Math.min(31, Math.round((ms(ev.expiration_at_ms) - ms(ev.purchased_at_ms)) / DAY_MS))) : 0,
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

/** Keep the latest TRANSFER time against a customer: 1 when this one is newer. */
const MOVED_SCRIPT = `-- rc:moved
local cur = tonumber(redis.call('GET', KEYS[1]) or '0')
if cur and cur >= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
return 1`;

/** Take a settled note off its queue, only if nobody queued it again (a new score) meanwhile. */
const DONE_SCRIPT = `-- rc:done
local s = redis.call('ZSCORE', KEYS[1], ARGV[1])
if s and tonumber(s) == tonumber(ARGV[2]) then return redis.call('ZREM', KEYS[1], ARGV[1]) end
return 0`;

/**
 * One message, once. Every write here is safe to do twice (the watermark
 * script rewrites the same record, SET and ZADD set the same values), so the
 * mark that it is done (`rc:evt:<id>`) is written last: a delivery that
 * stalls or is cut off part-way leaves no mark, and RevenueCat's retry does
 * it all again. "ok": acted on; "dup": already done; "stale": older than
 * what Sona has (the series still stops, and the customer link holds); "retry":
 * the store did not answer, answer 503.
 */
export async function apply(ev: RcEvent & { state: RcState }, kv: Kv = kvCmd, now: number = Date.now()): Promise<"ok" | "dup" | "stale" | "retry"> {
  const seen = await kv(["EXISTS", evtKey(ev.id)]);
  if (seen === undefined || seen === null) return "retry";
  if (Number(seen) === 1) return "dup";
  // the subscription left this customer after this message happened (its
  // TRANSFER came first): what this address holds is "moved", as of then
  let moved = 0;
  for (const u of ev.uids) {
    const m = await kv(["GET", movedKey(u)]);
    if (m === undefined) return "retry";
    const t = ms(m);
    if (t > ev.ts && t > moved) moved = t;
  }
  const rec: Plan = moved
    ? { s: "moved", exp: 0, ts: moved, at: new Date(now).toISOString() }
    : { s: ev.state, exp: ev.exp, ts: ev.ts, at: new Date(now).toISOString() };
  const put = await kv(["EVAL", PLAN_SCRIPT, 1, PLANS_KEY, ev.email, rec.ts, JSON.stringify(rec)]);
  if (put === undefined || put === null) return "retry";
  // every state is someone who started Premium at some point: no more welcome series
  if (!(await stopSeries(ev.email, kv))) return "retry";
  // still on the list while RevenueCat still talks about them; EXPIRE never creates the key
  if ((await kv(["EXPIRE", "nurture:0:" + ev.email, LIST_KEEP_SEC])) === undefined) return "retry";
  for (const u of ev.uids) {
    if ((await kv(["SET", uidKey(u), ev.email, "EX", UID_KEEP_SEC])) !== "OK") return "retry";
  }
  const fresh = Number(put) === 1 && !moved;
  if (fresh && ev.state === "trial" && ev.exp > 0) {
    if ((await kv(["ZADD", REMIND_KEY, ev.exp - REMIND_BEFORE_MS, ev.email])) === undefined) return "retry";
  }
  if (fresh && ev.state === "ended") {
    if ((await kv(["ZADD", MISS_KEY, Math.max(now, ev.ts) + MISS_AFTER_MS, ev.email])) === undefined) return "retry";
  }
  if ((await kv(["SET", evtKey(ev.id), "1", "EX", EVT_KEEP_SEC])) !== "OK") return "retry";
  return fresh || (moved && Number(put) === 1) ? "ok" : "stale";
}

/**
 * A TRANSFER: the subscription left the customers in `from`. The time is
 * kept against each of them (for a message about them that arrives later),
 * and each address Sona linked to one of them is marked "moved" (unless a
 * newer message already said something) and loses its queued reminder.
 * "none": no address Sona knows was on those customers yet.
 */
export async function moveAway(ev: RcEvent, kv: Kv = kvCmd, now: number = Date.now()): Promise<"ok" | "dup" | "none" | "retry"> {
  const seen = await kv(["EXISTS", evtKey(ev.id)]);
  if (seen === undefined || seen === null) return "retry";
  if (Number(seen) === 1) return "dup";
  const emails: string[] = [];
  for (const u of ev.from) {
    if ((await kv(["EVAL", MOVED_SCRIPT, 1, movedKey(u), ev.ts, UID_KEEP_SEC])) === undefined) return "retry";
    const e = await kv(["GET", uidKey(u)]);
    if (e === undefined) return "retry";
    const a = addressOk(e);
    if (a && !emails.includes(a)) emails.push(a);
  }
  for (const email of emails) {
    const rec: Plan = { s: "moved", exp: 0, ts: ev.ts, at: new Date(now).toISOString() };
    const put = await kv(["EVAL", PLAN_SCRIPT, 1, PLANS_KEY, email, ev.ts, JSON.stringify(rec)]);
    if (put === undefined || put === null) return "retry";
    if (Number(put) === 1 && (await kv(["ZREM", REMIND_KEY, email])) === undefined) return "retry";
  }
  if ((await kv(["SET", evtKey(ev.id), "1", "EX", EVT_KEEP_SEC])) !== "OK") return "retry";
  return emails.length ? "ok" : "none";
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
    preview: "Come back to Sona any time",
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
 * The daily run (/api/cron/nurture, before the welcome series, with `now` the
 * moment the run started): every queued note that is due, if it is still
 * true. A note leaves its queue only once it is settled (sent, refused for
 * good, or no longer true), and only if nobody queued it again meanwhile; a
 * store that stops answering part-way leaves it where it was, so the next
 * run checks it all again. The sent mark is the claim: two runs at once
 * cannot both send. A send Resend turns away for a moment (busy, down, no
 * answer) is tried twice more, a little apart; a reminder that has become
 * too late is dropped.
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
      const email = String(due[i]), score = String(due[i + 1]);
      if (tries >= SEND_CAP) { res.stopped = "cap"; break; } // the next run picks up the rest
      if (opts.deadline && Date.now() > opts.deadline) { res.stopped = "time"; break; }
      const settle = async () => { await kv(["EVAL", DONE_SCRIPT, 1, key, email, score]); };
      const rawPlan = await kv(["HGET", PLANS_KEY, email]);
      if (rawPlan === undefined) continue; // the store did not answer: still queued
      const plan = parsePlan(rawPlan);
      let exp = 0;
      if (kind === "remind") {
        // still on the free days (not cancelled, not paid, not moved), and still time to cancel
        if (!plan || plan.s !== "trial" || !plan.exp || plan.exp - now <= REMIND_LATE_MS) { res.skipped++; await settle(); continue; }
        if (plan.exp - REMIND_BEFORE_MS > now) { await kv(["ZADD", key, plan.exp - REMIND_BEFORE_MS, email]); continue; } // a later end: not yet
        exp = plan.exp;
      } else if (!plan || plan.s !== "ended") { res.skipped++; await settle(); continue; } // back already, or never ended
      // only an address that joined Sona's list, and never one that left it
      const joined = await kv(["EXISTS", "nurture:0:" + email]);
      if (joined === undefined || joined === null) continue;
      if (Number(joined) !== 1) { res.skipped++; await settle(); continue; }
      const unsub = await suppressed(email, kv);
      if (unsub === null) continue;
      if (unsub) { res.skipped++; await settle(); continue; }
      const mark = await kv(["SET", sentKey(kind, email, exp), String(now), "NX", "EX", kind === "remind" ? REMIND_SENT_SEC : MISS_SENT_SEC]);
      if (mark === null) { res.skipped++; await settle(); continue; } // already sent (this free-days end, or this year)
      if (mark !== "OK") continue;
      tries++;
      // busy, down or no answer: worth another try; anything else (a bad address) is final
      const again = (st: number) => st === 0 || st === 429 || st >= 500;
      let r = { ok: false, status: 0 };
      for (let attempt = 0; attempt < 3; attempt++) {
        await sleep(attempt ? PACE_MS * 3 * attempt : PACE_MS);
        r = await send(f, cfg, kind, email, exp); // the same Idempotency-Key each time: never two emails
        if (r.ok || !again(r.status)) break;
      }
      if (r.ok) { if (kind === "remind") res.reminded++; else res.missed++; await settle(); continue; }
      res.failed++;
      await kv(["DEL", sentKey(kind, email, exp)]);
      // still busy or down: it stays queued for the next run; refused for good: dropped
      if (!again(r.status)) await settle();
      if (r.status === 429) { res.stopped = "rate"; break; }
    }
  }
  return res;
}
