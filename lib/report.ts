import { kvCmd } from "@/lib/slpAuth";
import { config, esc, unsubToken, unsubscribed } from "@/lib/nurture";

/**
 * THE WEEKLY PROGRESS REPORT (Travis, 15 Oct 2026: "i want the setup page to
 * say get the weekly progress report", then "Build the real report" over
 * changing the words alone, so the screen would tell the truth).
 *
 * A child's practice lives on the phone, so the phone tells the server, and
 * only for a household whose grown-up asked for the report on setup's email
 * step (`profile.weeklyReport`, sona.js REPORT1). What it sends is a few
 * numbers a child a week, and nothing else:
 *   d  days with at least one rep (0-7)
 *   g  days the daily goal was reached (0-7)
 *   gw the plan: 3, 4, 5 or 7 days a week
 *   r  reps (practice tries plus heard game and book asks)
 *   p  of those, practice tries
 *   s  the sounds those reps were in ("R", "SH", ...)
 * Never a name, an age, a word, a pass rate or a voice. The email that goes
 * back says "Child 1", "Child 2" when there is more than one.
 *
 * Kept per week in `report:wk:<monday>` (a hash: "<email> <device>" to that
 * device's numbers) for three weeks, then gone. Each phone has its own random
 * device id, so a household with an iPad and an iPhone gets both in one email;
 * a child counted on two phones the same way (a backup moved mid-week) is
 * shown once. No more than three devices an address count.
 *
 * /api/cron/nurture runs daily at 16:00 UTC; on Monday (Tuesday picks up
 * anything Monday could not finish) it emails last week's numbers, once an
 * address a week (`report:sent:<monday>:<email>`, SET NX, released if Resend
 * refuses). A week with no reps sends nothing. Anyone in `email:unsub` gets
 * nothing, and the phone is told to stop sending (`off`).
 *
 * Wording is Rachel's to change (RENDER below); reporttest holds it to the
 * house email rules: her byline, no clinical words, no emoji, no prices.
 */

type Kv = (cmd: (string | number)[]) => Promise<unknown>;
type Fetch = typeof fetch;

export const DAY_MS = 24 * 60 * 60 * 1000;
export const KEEP_SEC = 21 * 24 * 60 * 60;
export const MAX_KIDS = 8;
export const MAX_DEVICES = 3;
export const SEND_CAP = 300;
export const SOUNDS = ["P", "B", "M", "N", "T", "D", "K", "G", "F", "V", "S", "Z", "SH", "CH", "J", "L", "R", "TH", "THV"] as const;
const SOUND_LABEL: Record<string, string> = { THV: "TH (v)" };

export type Kid = { d: number; g: number; gw: number; r: number; p: number; s: string[] };
export type Week = { wk: string; kids: Kid[] };
export type Snapshot = { email: string; dev: string; weeks: Week[] };

export const weekKey = (wk: string) => "report:wk:" + wk;
export const sentKey = (wk: string, email: string) => "report:sent:" + wk + ":" + email;

const int = (v: unknown, lo: number, hi: number): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
};

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
  return { d: int(o.d, 0, 7), g: int(o.g, 0, 7), gw: [3, 4, 5, 7].includes(gw) ? gw : 4, r, p: int(o.p, 0, r), s };
}

/** The phone's post, cleaned; null when it is not one. Numbers are clamped, unknown sounds dropped. */
export function validate(body: unknown, now: number = Date.now()): Snapshot | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
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

/**
 * /api/report: keep this phone's numbers for this week and last. Returns
 * "off" for an address that unsubscribed (nothing is kept, and the phone
 * stops), "error" when the store did not answer.
 */
export async function store(snap: Snapshot, kv: Kv = kvCmd): Promise<"ok" | "off" | "error"> {
  const unsub = await unsubscribed(snap.email, kv);
  if (unsub === true) return "off";
  if (unsub !== false) return "error";
  for (const w of snap.weeks) {
    const a = await kv(["HSET", weekKey(w.wk), snap.email + " " + snap.dev, JSON.stringify(w.kids)]);
    const b = await kv(["EXPIRE", weekKey(w.wk), KEEP_SEC]);
    if (a === undefined || a === null || b === undefined || b === null) return "error";
  }
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

/** One child's lines, plain text; the html escapes them. */
function kidLines(k: Kid): string[] {
  if (!k.r) return ["No practice last week."];
  const plan = k.gw === 7 ? "every day" : `${k.gw} days a week`;
  const split = k.p === k.r ? "all in practice" : k.p === 0 ? "all in games and books" : `${k.p} in practice, ${k.r - k.p} in games and books`;
  const out = [
    `Practiced on ${days(k.d)}`,
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
  const kept = kids.filter((k) => k.r > 0);
  const cheer = kept.length && kept.every((k) => k.g >= k.gw)
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

/** Every device's children for one address, a child counted the same way twice shown once. */
export function families(raw: unknown): Map<string, Kid[]> {
  const byEmail = new Map<string, { dev: string; kids: Kid[] }[]>();
  for (const [field, value] of pairs(raw)) {
    const sp = field.lastIndexOf(" ");
    const email = field.slice(0, sp), dev = field.slice(sp + 1);
    if (sp < 1 || !/^[a-f0-9]{32}$/.test(dev)) continue;
    let kids: Kid[] = [];
    try { const v = JSON.parse(value); kids = Array.isArray(v) ? v.map(kidOk).filter((k): k is Kid => k !== null) : []; } catch { continue; }
    const list = byEmail.get(email) || [];
    list.push({ dev, kids });
    byEmail.set(email, list);
  }
  const out = new Map<string, Kid[]>();
  for (const [email, list] of byEmail) {
    const seen = new Set<string>(), kids: Kid[] = [];
    list.sort((a, b) => (a.dev < b.dev ? -1 : 1)).slice(0, MAX_DEVICES).forEach((d) => d.kids.forEach((k) => {
      const key = JSON.stringify(k);
      if (!seen.has(key) && kids.length < MAX_KIDS) { seen.add(key); kids.push(k); }
    }));
    out.set(email, kids);
  }
  return out;
}

export type RunResult = { week: string | null; families: number; sent: number; failed: number; skipped: number };

/**
 * The Monday send (and Tuesday's catch-up). `force` (a founder's manual run)
 * sends on any day; it still sends each address at most once a week.
 */
export async function runReports(kv: Kv = kvCmd, f: Fetch = fetch, now: number = Date.now(), opts: { force?: boolean } = {}): Promise<RunResult> {
  const day = new Date(now).getUTCDay();
  const res: RunResult = { week: null, families: 0, sent: 0, failed: 0, skipped: 0 };
  const cfg = config();
  if (!cfg || (!opts.force && day !== 1 && day !== 2)) return res;
  const wk = mondayOf(now - 7 * DAY_MS);
  res.week = wk;
  const fams = families(await kv(["HGETALL", weekKey(wk)]));
  res.families = fams.size;
  let tries = 0;
  for (const email of [...fams.keys()].sort()) {
    const kids = fams.get(email) || [];
    if (!kids.some((k) => k.r > 0)) { res.skipped++; continue; } // a week with no reps sends nothing
    if (tries >= SEND_CAP) break; // tomorrow's run (or the next) picks up the rest
    if ((await unsubscribed(email, kv)) !== false) { res.skipped++; continue; } // unsubscribed, or the store did not answer
    const claim = await kv(["SET", sentKey(wk, email), String(now), "NX", "EX", KEEP_SEC]);
    if (claim !== "OK") { res.skipped++; continue; } // already sent, or the store did not answer
    tries++;
    const unsubUrl = `https://speaksona.com/api/email/unsub?e=${encodeURIComponent(email)}&k=${unsubToken(email, cfg.secret)}`;
    const { subject, html, text } = render(wk, kids, unsubUrl, cfg.postal);
    let ok = false;
    try {
      const r = await f("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json", "Idempotency-Key": `report-${wk}-${email}` },
        body: JSON.stringify({
          from: cfg.from, to: [email], reply_to: cfg.replyTo, subject, html, text,
          headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        }),
      });
      ok = r.ok;
      if (!ok) console.error("[report] Resend refused", r.status);
    } catch (e) {
      console.error("[report] send threw:", e instanceof Error ? e.message : String(e));
    }
    if (ok) res.sent++;
    else { res.failed++; await kv(["DEL", sentKey(wk, email)]); } // let the next run try again
  }
  return res;
}
