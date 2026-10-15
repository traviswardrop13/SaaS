import { createHash, createHmac } from "crypto";
import { kvCmd } from "@/lib/slpAuth";
import { config, esc, unsubToken } from "@/lib/nurture";

/**
 * THE WEEKLY PROGRESS REPORT (Travis, 15 Oct 2026: "i want the setup page to
 * say get the weekly progress report", then "Build the real report" over
 * changing the words alone, so the screen would tell the truth).
 *
 * A child's practice lives on the phone, so the phone tells the server, and
 * only for a household whose grown-up asked for the report on setup's email
 * step (`profile.weeklyReport`, sona.js REPORT1). What it sends is a few
 * numbers a child a week, and nothing else:
 *   i  a random id for the child (so the same child on two phones is one)
 *   d  days with at least one rep (0-7)
 *   g  days the daily goal was reached (0-7)
 *   gw the plan: 3, 4, 5 or 7 days a week
 *   r  reps (practice tries plus heard game and book asks)
 *   p  of those, practice tries
 *   s  the sounds those reps were in ("R", "SH", ...)
 * Never a name, an age, a word, a pass rate or a voice. The email that goes
 * back says "Child 1", "Child 2" when there is more than one.
 *
 * NOTHING IS KEPT OR SENT UNTIL THE ADDRESS SAYS YES (review, 15 Oct 2026). A
 * typed address can be wrong (gmial.com), and anyone can post here, so the
 * first post from a phone emails that address once: "Confirm your weekly
 * progress report", a button on a page (a mail scanner's GET confirms
 * nothing). Only a phone confirmed that way (`report:dev:<hash of the
 * address>`, a set of device ids, no address in it, 120 days from the last
 * post) has its numbers kept. Asking is limited: once a week an address,
 * three times in 60 days, 300 a day in all. An unconfirmed post, and one for
 * an unsubscribed address, get the same answer ("pending"), so the route says
 * nothing about anyone's mailbox; a confirmed phone of an unsubscribed
 * address is answered "off" and stops.
 *
 * Kept per week in `report:wk:<monday>` (a hash: "<email> <device>" to that
 * phone's numbers) until three weeks after that Monday, then gone. A household
 * with an iPad and an iPhone gets both in one email (a child with the same id
 * on both, after a move, once: the fuller count). At most three devices an
 * address.
 *
 * /api/cron/nurture runs daily at 16:00 UTC; Monday sends last week's
 * numbers, and Tuesday and Wednesday pick up anything Monday could not
 * finish. Once an address a week (`report:sent:<monday>:<email>`, released if
 * Resend refuses), paced for Resend's rate limit, stopping on a 429 or before
 * the function's time runs out. A week with no reps sends nothing. Anyone in
 * `email:unsub`, under that exact address or its plain mailbox (Gmail dots and
 * +tags), gets nothing.
 *
 * Wording is Rachel's to change (render below); reporttest holds it to the
 * house email rules: her byline, no clinical words, no emoji, no prices.
 */

type Kv = (cmd: (string | number)[]) => Promise<unknown>;
type Fetch = typeof fetch;

export const DAY_MS = 24 * 60 * 60 * 1000;
export const KEEP_DAYS = 21;
export const CONFIRM_KEEP_SEC = 120 * 24 * 60 * 60;
export const MAX_KIDS = 8;
export const MAX_DEVICES = 3;
export const SEND_CAP = 250;
export const ASK_CAP = 300;
export const PACE_MS = 550; // Resend's default limit is 2 a second (cron/weekly waits the same)
export const SEND_DAYS = [1, 2, 3]; // Monday, then Tuesday and Wednesday to catch up
export const SOUNDS = ["P", "B", "M", "N", "T", "D", "K", "G", "F", "V", "S", "Z", "SH", "CH", "J", "L", "R", "TH", "THV"] as const;
const SOUND_LABEL: Record<string, string> = { THV: "TH (v)" };

export type Kid = { i?: string; d: number; g: number; gw: number; r: number; p: number; s: string[] };
export type Week = { wk: string; kids: Kid[] };
export type Snapshot = { email: string; dev: string; weeks: Week[] };

export const weekKey = (wk: string) => "report:wk:" + wk;
export const sentKey = (wk: string, email: string) => "report:sent:" + wk + ":" + email;
export const confirmKey = (h: string) => "report:dev:" + h;

const int = (v: unknown, lo: number, hi: number): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
};

/**
 * An address the report may use: printable ASCII only (no spaces, no control
 * or non-Latin characters, which a mail header cannot carry), and at most 120
 * characters, the most /api/email/unsub reads back, so the unsubscribe link
 * always works.
 */
export function addressOk(raw: unknown): string {
  const e = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return e.length <= 120 && /^[\x21-\x7e]+$/.test(e) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : "";
}

/** The mailbox behind an address: Gmail's dots and any +tag are the same inbox (as lib/board.ts). */
export function mailbox(email: string): string {
  const e = email.trim().toLowerCase(), at = e.lastIndexOf("@");
  if (at < 1) return e;
  let local = e.slice(0, at), domain = e.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return local + "@" + domain;
}

/** The confirmation set's name: a keyed hash of the mailbox, so it holds no address. */
export const mailHash = (email: string, secret: string) => createHmac("sha256", secret).update("report-mail:" + mailbox(email)).digest("hex").slice(0, 32);
/** The confirm link's proof that this address was sent this device's link. */
export const confirmToken = (email: string, dev: string, secret: string) => createHmac("sha256", secret).update("report-confirm:" + email + " " + dev).digest("hex").slice(0, 32);

/** The Monday (UTC date) of the week holding `ms`, as "YYYY-MM-DD". */
export function mondayOf(ms: number): string {
  const d = new Date(ms);
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - ((d.getUTCDay() + 6) % 7) * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * A phone's Monday is its own local Monday, so this one is checked loosely:
 * a real Monday, from this week or last (two days of slack for a phone far
 * ahead of or behind UTC), never older and never later.
 */
function weekOk(wk: unknown, now: number): wk is string {
  if (typeof wk !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(wk)) return false;
  const t = Date.parse(wk + "T00:00:00Z");
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== wk || new Date(t).getUTCDay() !== 1) return false;
  const daysAgo = (now - t) / DAY_MS;
  return daysAgo >= -2 && daysAgo < 15;
}

function kidOk(v: unknown): Kid | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const r = int(o.r, 0, 20000);
  const gw = int(o.gw, 0, 7);
  const s = Array.isArray(o.s) ? SOUNDS.filter((x) => (o.s as unknown[]).includes(x)) : [];
  const k: Kid = { d: int(o.d, 0, 7), g: int(o.g, 0, 7), gw: [3, 4, 5, 7].includes(gw) ? gw : 4, r, p: int(o.p, 0, r), s };
  if (typeof o.i === "string" && /^[a-f0-9]{16}$/.test(o.i)) k.i = o.i;
  return k;
}

/** The phone's post, cleaned; null when it is not one. Numbers are clamped, unknown sounds dropped. */
export function validate(body: unknown, now: number = Date.now()): Snapshot | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const email = addressOk(b.email);
  if (!email) return null;
  const dev = typeof b.dev === "string" && /^[a-f0-9]{32}$/.test(b.dev) ? b.dev : "";
  if (!dev || !Array.isArray(b.weeks) || !b.weeks.length || b.weeks.length > 2) return null;
  const weeks: Week[] = [];
  for (const w of b.weeks as unknown[]) {
    if (!w || typeof w !== "object") return null;
    const o = w as Record<string, unknown>;
    if (!weekOk(o.wk, now) || !Array.isArray(o.kids) || o.kids.length > MAX_KIDS) return null;
    if (weeks.some((x) => x.wk === o.wk)) return null;
    weeks.push({ wk: o.wk, kids: (o.kids as unknown[]).map(kidOk).filter((k): k is Kid => k !== null) });
  }
  return { email, dev, weeks };
}

/** In `email:unsub` under this exact address or its plain mailbox; null when the store did not answer. */
export async function suppressed(email: string, kv: Kv): Promise<boolean | null> {
  const box = mailbox(email);
  for (const e of box === email ? [email] : [email, box]) {
    const r = await kv(["SISMEMBER", "email:unsub", e]);
    if (r === undefined || r === null) return null;
    if (Number(r) === 1) return true;
  }
  return false;
}

/** Send one Resend email; true when Resend took it. Never throws; gives up after 10 seconds. */
async function resend(f: Fetch, cfg: NonNullable<ReturnType<typeof config>>, msg: { to: string; subject: string; html: string; text: string; unsubUrl: string; key: string }): Promise<{ ok: boolean; status: number }> {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await f("https://api.resend.com/emails", {
      method: "POST", signal: ctl.signal,
      headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json", "Idempotency-Key": msg.key },
      body: JSON.stringify({
        from: cfg.from, to: [msg.to], reply_to: cfg.replyTo, subject: msg.subject, html: msg.html, text: msg.text,
        headers: { "List-Unsubscribe": `<${msg.unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      }),
    });
    if (!r.ok) console.error("[report] Resend refused", r.status);
    return { ok: r.ok, status: r.status };
  } catch (e) {
    console.error("[report] send threw:", e instanceof Error ? e.message : String(e));
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

const unsubUrlFor = (email: string, secret: string) => `https://speaksona.com/api/email/unsub?e=${encodeURIComponent(email)}&k=${unsubToken(email, secret)}`;
/** A Resend Idempotency-Key with no address in it (a header carries ASCII only). */
const keyFor = (kind: string, email: string) => `report-${kind}-${createHash("sha256").update(email).digest("hex").slice(0, 32)}`;

export function renderConfirm(confirmUrl: string, unsubUrl: string, postal: string): { subject: string; html: string; text: string } {
  const paras = [
    "Someone set up Sona on a phone or tablet and asked for a weekly progress report at this address.",
    "If that was you, tap below. Every Monday you’ll get last week’s practice: how many days, how many reps and which sounds. Never your child’s name or voice.",
    "If it wasn’t you, ignore this email and nothing will be sent.",
  ];
  const P = 'style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;"';
  const html =
    `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;">` +
    `<div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    paras.slice(0, 2).map((p) => `<p ${P}>${esc(p)}</p>`).join("") +
    `<p style="margin:24px 0 16px;"><a href="${confirmUrl}" style="display:inline-block;background:#ff8a3d;color:#ffffff;text-decoration:none;font-weight:700;font-size:17px;padding:13px 26px;border-radius:12px;">Yes, send me the report</a></p>` +
    `<p ${P}>${esc(paras[2])}</p>` +
    `<p style="margin:24px 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;">Rachel, MS, CF-SLP<br>Sona co-founder</p>` +
    `<p style="margin:0;font-size:12px;line-height:1.5;color:#8a8a8a;">Sona · ${esc(postal)}<br><a href="${unsubUrl}" style="color:#8a8a8a;">Unsubscribe</a></p>` +
    `</div></body></html>`;
  const text = paras.slice(0, 2).join("\n\n") + `\n\nYes, send me the report: ${confirmUrl}\n\n${paras[2]}\n\nRachel, MS, CF-SLP\nSona co-founder\n--\nSona · ${postal}\nUnsubscribe: ${unsubUrl}\n`;
  return { subject: "Confirm your weekly progress report", html, text };
}

/** Email the address a confirm link for this phone, within the limits above. Best effort. */
async function askConfirm(snap: Snapshot, h: string, kv: Kv, f: Fetch, now: number, cfg: NonNullable<ReturnType<typeof config>>): Promise<boolean> {
  if ((await kv(["SET", "report:ask:" + h, String(now), "NX", "EX", 7 * 86400])) !== "OK") return false;
  const n = Number(await kv(["INCR", "report:askn:" + h]));
  await kv(["EXPIRE", "report:askn:" + h, 60 * 86400]);
  if (!(n >= 1 && n <= 3)) return false;
  const day = "report:asks:" + new Date(now).toISOString().slice(0, 10);
  const total = Number(await kv(["INCR", day]));
  await kv(["EXPIRE", day, 2 * 86400]);
  if (!(total >= 1 && total <= ASK_CAP)) return false;
  const confirmUrl = `https://speaksona.com/api/report/confirm?e=${encodeURIComponent(snap.email)}&d=${snap.dev}&k=${confirmToken(snap.email, snap.dev, cfg.secret)}`;
  const unsubUrl = unsubUrlFor(snap.email, cfg.secret);
  const m = renderConfirm(confirmUrl, unsubUrl, cfg.postal);
  return (await resend(f, cfg, { to: snap.email, ...m, unsubUrl, key: keyFor("confirm-" + snap.dev.slice(0, 8) + "-" + new Date(now).toISOString().slice(0, 10), snap.email) })).ok;
}

/** /api/report/confirm: is this the link that address was sent for that device? */
export function confirmOk(email: unknown, dev: unknown, k: unknown): { email: string; dev: string } | null {
  const cfg = config();
  const e = addressOk(email), d = typeof dev === "string" && /^[a-f0-9]{32}$/.test(dev) ? dev : "";
  if (!cfg || !e || !d || typeof k !== "string") return null;
  const want = confirmToken(e, d, cfg.secret);
  return k.length === want.length && k === want ? { email: e, dev: d } : null;
}

/** The address said yes for this phone. */
export async function confirm(email: string, dev: string, kv: Kv = kvCmd): Promise<boolean> {
  const cfg = config();
  if (!cfg) return false;
  const h = mailHash(email, cfg.secret);
  const a = await kv(["SADD", confirmKey(h), dev]);
  const b = await kv(["EXPIRE", confirmKey(h), CONFIRM_KEEP_SEC]);
  return a !== undefined && a !== null && b !== undefined && b !== null;
}

/**
 * /api/report: keep a confirmed phone's numbers for this week and last.
 * "pending": not confirmed yet (the address may be emailed a link), or an
 * unsubscribed address posting from an unconfirmed phone: the same answer,
 * so the route tells a stranger nothing. "off": a confirmed phone of an
 * address that unsubscribed (nothing kept; the phone stops). "error": the
 * store did not answer, or the email settings are missing.
 */
export async function store(snap: Snapshot, kv: Kv = kvCmd, f: Fetch = fetch, now: number = Date.now()): Promise<"ok" | "off" | "pending" | "error"> {
  const cfg = config();
  if (!cfg) return "error";
  const h = mailHash(snap.email, cfg.secret);
  const yes = await kv(["SISMEMBER", confirmKey(h), snap.dev]);
  if (yes === undefined || yes === null) return "error";
  const unsub = await suppressed(snap.email, kv);
  if (unsub === null) return "error";
  if (Number(yes) !== 1) {
    if (!unsub) { try { await askConfirm(snap, h, kv, f, now, cfg); } catch { /* best effort: the next post asks again */ } }
    return "pending";
  }
  if (unsub) return "off";
  for (const w of snap.weeks) {
    // a fixed end, three weeks after that Monday, however late a phone posts
    const end = Math.floor(Date.parse(w.wk + "T00:00:00Z") / 1000) + KEEP_DAYS * 86400;
    const a = await kv(["HSET", weekKey(w.wk), snap.email + " " + snap.dev, JSON.stringify(w.kids)]);
    const b = await kv(["EXPIREAT", weekKey(w.wk), end]);
    if (a === undefined || a === null || b === undefined || b === null) return "error";
  }
  await kv(["EXPIRE", confirmKey(h), CONFIRM_KEEP_SEC]);
  return "ok";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function range(wk: string): string {
  const a = new Date(wk + "T00:00:00Z"), b = new Date(a.getTime() + 6 * DAY_MS);
  return `${MONTHS[a.getUTCMonth()]} ${a.getUTCDate()} to ${MONTHS[b.getUTCMonth()]} ${b.getUTCDate()}`;
}
const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
const reps = (n: number) => `${n} ${n === 1 ? "rep" : "reps"}`;
function soundList(s: string[]): string {
  const names = s.map((x) => SOUND_LABEL[x] || x);
  const shown = names.slice(0, 5), more = names.length - shown.length;
  if (more > 0) return shown.join(", ") + ` and ${more} more`;
  return shown.length > 1 ? shown.slice(0, -1).join(", ") + " and " + shown[shown.length - 1] : shown[0] || "";
}

/**
 * One child's lines, plain text; the html escapes them. "Said their sound
 * out loud", not "practiced": the days count a heard game or book word too,
 * while Progress's "practiced" counts the practice page alone.
 */
function kidLines(k: Kid): string[] {
  if (!k.r) return ["No practice last week."];
  const plan = k.gw === 7 ? "every day" : `${k.gw} days a week`;
  const split = k.p === k.r ? "all in practice" : k.p === 0 ? "all in games and books" : `${k.p} in practice, ${k.r - k.p} in games and books`;
  const out = [
    `Said their sound out loud on ${days(k.d)}`,
    `Reached the daily goal on ${days(k.g)} (your plan: ${plan})`,
    `${reps(k.r)}: ${split}`,
  ];
  if (k.s.length) out.push(`${k.s.length === 1 ? "Sound" : "Sounds"}: ${soundList(k.s)}`);
  return out;
}

export function render(wk: string, kids: Kid[], unsubUrl: string, postal: string): { subject: string; html: string; text: string } {
  const total = kids.reduce((n, k) => n + k.r, 0);
  const subject = `Last week on Sona: ${reps(total)}`;
  const preview = `Practice from ${range(wk)}.`;
  const intro = `Here’s last week on Sona, ${range(wk)}.`;
  const groups = kids.map((k, i) => ({
    head: kids.length > 1 ? `Child ${i + 1}` + (k.s.length ? ` · ${soundList(k.s)}` : "") : "",
    lines: kidLines(k),
  }));
  const cheer = kids.length && kids.every((k) => k.r > 0 && k.g >= k.gw)
    ? "That’s the plan you set. Nice work keeping it going."
    : "Every rep counts. A few minutes on more days does more than one long day.";
  const repLine = "A rep is one time your child said their sound or word out loud. Silence never counts.";
  const hedge = "A practice snapshot from your phone, not an evaluation.";
  const footer = "You’re getting this because you asked for Sona’s weekly progress report.";

  const P = 'style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;"';
  const html =
    `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;">` +
    `<div style="display:none;max-height:0;overflow:hidden;">${esc(preview)}</div>` +
    `<div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    `<p ${P}>${esc(intro)}</p>` +
    groups.map((g) =>
      `<div style="margin:0 0 16px;padding:14px 16px;background:#fff6e9;border-radius:12px;">` +
      (g.head ? `<p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#2b2b2b;">${esc(g.head)}</p>` : "") +
      g.lines.map((l) => `<p style="margin:0 0 6px;font-size:16px;line-height:1.5;color:#2b2b2b;">${esc(l)}</p>`).join("") +
      `</div>`).join("") +
    `<p ${P}>${esc(cheer)}</p>` +
    `<p ${P}>${esc(repLine)}</p>` +
    `<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#6b6b6b;">${esc(hedge)}</p>` +
    `<p style="margin:24px 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;">Rachel, MS, CF-SLP<br>Sona co-founder</p>` +
    `<p style="margin:0;font-size:12px;line-height:1.5;color:#8a8a8a;">${esc(footer)}<br>Sona · ${esc(postal)}<br><a href="${unsubUrl}" style="color:#8a8a8a;">Unsubscribe</a></p>` +
    `</div></body></html>`;
  const text =
    intro + "\n\n" +
    groups.map((g) => (g.head ? g.head + "\n" : "") + g.lines.map((l) => "- " + l).join("\n")).join("\n\n") + "\n\n" +
    cheer + "\n\n" + repLine + "\n\n" + hedge + "\n\n" +
    "Rachel, MS, CF-SLP\nSona co-founder\n" +
    `--\n${footer}\nSona · ${postal}\nUnsubscribe: ${unsubUrl}\n`;
  return { subject, html, text };
}

/** HGETALL answers a flat [field, value, ...] list on Upstash, an object elsewhere. */
function pairs(raw: unknown): [string, string][] {
  if (Array.isArray(raw)) {
    const out: [string, string][] = [];
    for (let i = 0; i + 1 < raw.length; i += 2) out.push([String(raw[i]), String(raw[i + 1])]);
    return out;
  }
  if (raw && typeof raw === "object") return Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, String(v)]);
  return [];
}

/**
 * Every device's children for one address. A child is matched across phones
 * by its id alone (a move to a new phone carries it in the backup), keeping
 * the fuller count; children are never matched by their numbers, so two
 * brothers who both had a quiet week stay two.
 */
export function families(raw: unknown): Map<string, Kid[]> {
  const byEmail = new Map<string, { dev: string; kids: Kid[] }[]>();
  for (const [field, value] of pairs(raw)) {
    const sp = field.lastIndexOf(" ");
    const email = field.slice(0, sp), dev = field.slice(sp + 1);
    if (sp < 1 || !addressOk(email) || !/^[a-f0-9]{32}$/.test(dev)) continue;
    let kids: Kid[] = [];
    try { const v = JSON.parse(value); kids = Array.isArray(v) ? v.map(kidOk).filter((k): k is Kid => k !== null) : []; } catch { continue; }
    const list = byEmail.get(email) || [];
    list.push({ dev, kids });
    byEmail.set(email, list);
  }
  const out = new Map<string, Kid[]>();
  for (const [email, list] of byEmail) {
    const kids: Kid[] = [], at = new Map<string, number>();
    list.sort((a, b) => (a.dev < b.dev ? -1 : 1)).slice(0, MAX_DEVICES).forEach((d) => d.kids.forEach((k) => {
      const seen = k.i ? at.get(k.i) : undefined;
      if (seen !== undefined) { if (k.r > kids[seen].r) kids[seen] = k; return; }
      if (kids.length >= MAX_KIDS) return;
      if (k.i) at.set(k.i, kids.length);
      kids.push(k);
    }));
    out.set(email, kids);
  }
  return out;
}

export type RunResult = { week: string | null; families: number; sent: number; failed: number; skipped: number; stopped?: string };

/**
 * Monday's send (Tuesday and Wednesday catch up). `force` (a founder's manual
 * run) sends on any day; it still sends each address at most once a week.
 * `deadline` (real time, ms) stops before the function is cut off, so no
 * address is left claimed and unsent. `sleep` is the pause between sends.
 */
export async function runReports(kv: Kv = kvCmd, f: Fetch = fetch, now: number = Date.now(),
  opts: { force?: boolean; deadline?: number; sleep?: (ms: number) => Promise<void> } = {}): Promise<RunResult> {
  const day = new Date(now).getUTCDay();
  const res: RunResult = { week: null, families: 0, sent: 0, failed: 0, skipped: 0 };
  const cfg = config();
  if (!cfg || (!opts.force && !SEND_DAYS.includes(day))) return res;
  const sleep = opts.sleep || ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const wk = mondayOf(now - 7 * DAY_MS);
  res.week = wk;
  const fams = families(await kv(["HGETALL", weekKey(wk)]));
  res.families = fams.size;
  let tries = 0;
  for (const email of [...fams.keys()].sort()) {
    const kids = fams.get(email) || [];
    if (!kids.some((k) => k.r > 0)) { res.skipped++; continue; } // a week with no reps sends nothing
    if (tries >= SEND_CAP) { res.stopped = "cap"; break; } // the next run picks up the rest
    if (opts.deadline && Date.now() > opts.deadline) { res.stopped = "time"; break; }
    if ((await suppressed(email, kv)) !== false) { res.skipped++; continue; } // unsubscribed, or the store did not answer
    let claimed = false;
    try {
      const unsubUrl = unsubUrlFor(email, cfg.secret);
      const m = render(wk, kids, unsubUrl, cfg.postal);
      if ((await kv(["SET", sentKey(wk, email), String(now), "NX", "EX", KEEP_DAYS * 86400])) !== "OK") { res.skipped++; continue; } // already sent, or no answer
      claimed = true;
      if (tries > 0) await sleep(PACE_MS);
      tries++;
      const r = await resend(f, cfg, { to: email, ...m, unsubUrl, key: keyFor(wk, email) });
      if (r.ok) { res.sent++; claimed = false; continue; }
      res.failed++;
      if (r.status === 429) { res.stopped = "rate"; break; } // Resend says slow down: the next run carries on
    } catch (e) {
      res.failed++;
      console.error("[report] address failed:", e instanceof Error ? e.message : String(e));
    } finally {
      if (claimed) await kv(["DEL", sentKey(wk, email)]); // not sent: let the next run try again
    }
  }
  return res;
}
