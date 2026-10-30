import { kvCmd } from "@/lib/slpAuth";

/**
 * TRIAL1: THE FREE-WEEK REPORT (Travis, 30 Oct 2026, of "most of them
 * cancel": which families who start a free trial play on each of its days,
 * and which of them pay). /leads.html shows it, behind FOUNDER_KEY.
 *
 * What it keeps, per trial, under the anonymous family id every usage beacon
 * already carries (sona.js's fid(): random, minted on the phone, never a
 * name or an address): when the trial started, how many free days it has,
 * which of its days had a counted rep, and how it ended. Nothing else: no
 * name, age, sound, count, word or email, and nothing about a child.
 *
 *  - The phone says "free trial started" ({ days }) from the purchase, and
 *    "played today" once a local day on the first counted rep (/api/track).
 *  - RevenueCat says how it went (/api/revenuecat), for a phone that handed
 *    it the same id (sona.js _rcEmail, the `sona_fid` attribute): paid (the
 *    free days became a paid month), cancelled, billing, or ended. A family
 *    who never opens Sona again is still heard here.
 *
 * Day 1 is the first 24 hours from the start, day 2 the next, and so on, by
 * the server's clock (no time zone is kept). Each trial is kept 120 days.
 */

type Kv = (cmd: (string | number)[]) => Promise<unknown>;

export const DAY_MS = 24 * 60 * 60 * 1000;
export const IDX_KEY = "trials:idx";
export const trialKey = (fid: string) => "trial:" + fid;
export const KEEP_SEC = 120 * 24 * 60 * 60;
const MAX_DAYS = 31;
const FID = /^[A-Za-z0-9_-]{8,40}$/;

export type Outcome = "paid" | "cancelled" | "billing" | "ended";
const OUTCOMES: readonly string[] = ["paid", "cancelled", "billing", "ended"];

export function fidOk(v: unknown): string {
  return typeof v === "string" && FID.test(v) ? v : "";
}

/** A free trial started (the phone's word, or RevenueCat's). Never moves a start already kept. */
export async function trialStart(fid: string, days: number, at: number, kv: Kv = kvCmd): Promise<void> {
  if (!fidOk(fid) || !(at > 0)) return;
  const k = trialKey(fid);
  const fresh = Number(await kv(["HSETNX", k, "s", Math.floor(at)])) === 1;
  const d = Math.round(Number(days));
  if (d >= 1 && d <= MAX_DAYS) await kv(["HSETNX", k, "n", d]);
  if (fresh) await kv(["ZADD", IDX_KEY, Math.floor(at), fid]);
  await kv(["EXPIRE", k, KEEP_SEC]);
}

/** The family played today: marks the trial's day, if this id has a trial. */
export async function trialPlayed(fid: string, now: number, kv: Kv = kvCmd): Promise<void> {
  if (!fidOk(fid)) return;
  const s = Number(await kv(["HGET", trialKey(fid), "s"]));
  if (!(s > 0) || now < s) return;
  const day = Math.floor((now - s) / DAY_MS);           // 0: the first 24 hours
  if (day < 0 || day >= MAX_DAYS) return;
  await kv(["HSET", trialKey(fid), "p" + day, 1]);
}

/**
 * How it went, from RevenueCat. Paid stays paid (a later cancellation of a
 * paid month is not the trial's end); a cancellation undone ("trial" again)
 * clears it; an end after a cancellation stays "cancelled".
 */
export async function trialOutcome(fid: string, state: string, at: number, days: number, kv: Kv = kvCmd): Promise<void> {
  if (!fidOk(fid)) return;
  const k = trialKey(fid);
  // RevenueCat retries a message for hours, so an older one can land after a
  // newer: the outcome moves only for a message at least as new as the last
  // one that set it (ot)
  const last = Number(await kv(["HGET", k, "ot"])) || 0;
  if (at > 0 && at < last) return;
  const stamp = at > 0 ? Math.floor(at) : Date.now();
  if (state === "trial") {
    await trialStart(fid, days, stamp, kv);
    if (String(await kv(["HGET", k, "o"])) === "cancelled") { await kv(["HDEL", k, "o"]); await kv(["HSET", k, "ot", stamp]); }
    return;
  }
  if (!OUTCOMES.includes(state)) return;
  if (!(Number(await kv(["HGET", k, "s"])) > 0)) return;   // not a trial this report knows (a purchase charged today)
  const was = String((await kv(["HGET", k, "o"])) || "");
  if (was === "paid") return;
  if (state === "ended" && (was === "cancelled" || was === "billing")) return;
  await kv(["HSET", k, "o", state, "ot", stamp]);
}

export type TrialRow = { start: number; days: number; played: number[]; outcome: Outcome | "" };
export type TrialReport = {
  total: number;
  outcomes: { paid: number; cancelled: number; billing: number; ended: number; open: number };
  /** per trial day: of the trials that have reached it, how many played */
  byDay: { day: number; played: number; of: number }[];
  /** finished trials, by how many of their days had play: how many paid */
  byPlay: { label: string; trials: number; paid: number }[];
  recent: TrialRow[];
};

function rowOf(h: Record<string, string>): TrialRow | null {
  const start = Number(h.s);
  if (!(start > 0)) return null;
  const played: number[] = [];
  for (let d = 0; d < MAX_DAYS; d++) if (h["p" + d]) played.push(d + 1);
  const o = OUTCOMES.includes(h.o) ? (h.o as Outcome) : "";
  return { start, days: Math.max(0, Math.min(MAX_DAYS, Number(h.n) || 0)), played, outcome: o };
}

function hash(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(raw)) for (let i = 0; i + 1 < raw.length; i += 2) out[String(raw[i])] = String(raw[i + 1]);
  else if (raw && typeof raw === "object") for (const [k, v] of Object.entries(raw)) out[k] = String(v);
  return out;
}

/** The report, over trials started in the last `sinceDays` days (at most 2,000). */
export async function readTrials(now: number = Date.now(), sinceDays = 90, kv: Kv = kvCmd): Promise<TrialReport> {
  await kv(["ZREMRANGEBYSCORE", IDX_KEY, "-inf", now - KEEP_SEC * 1000]);
  const ids = ((await kv(["ZRANGEBYSCORE", IDX_KEY, now - sinceDays * DAY_MS, "+inf"])) as string[] | undefined) || [];
  const rows: TrialRow[] = [];
  for (const id of ids.slice(-2000)) {
    const r = rowOf(hash(await kv(["HGETALL", trialKey(id)])));
    if (r) rows.push(r);
  }
  const outcomes = { paid: 0, cancelled: 0, billing: 0, ended: 0, open: 0 };
  for (const r of rows) outcomes[r.outcome || "open"]++;
  const span = Math.max(3, ...rows.map((r) => r.days || 0));
  const byDay: TrialReport["byDay"] = [];
  for (let d = 1; d <= Math.min(span, 14); d++) {
    const reached = rows.filter((r) => (!r.days || d <= r.days) && now >= r.start + (d - 1) * DAY_MS);
    byDay.push({ day: d, of: reached.length, played: reached.filter((r) => r.played.includes(d)).length });
  }
  // finished: an outcome, or past its free days
  const done = rows.filter((r) => r.outcome || (r.days && now >= r.start + r.days * DAY_MS));
  const inTrial = (r: TrialRow) => r.played.filter((d) => !r.days || d <= r.days).length;
  const groups = [
    { label: "Never played", test: (n: number) => n === 0 },
    { label: "Played 1 day", test: (n: number) => n === 1 },
    { label: "Played 2 days", test: (n: number) => n === 2 },
    { label: "Played 3+ days", test: (n: number) => n >= 3 },
  ];
  const byPlay = groups.map((g) => {
    const t = done.filter((r) => g.test(inTrial(r)));
    return { label: g.label, trials: t.length, paid: t.filter((r) => r.outcome === "paid").length };
  });
  const recent = rows.slice().sort((a, b) => b.start - a.start).slice(0, 60);
  return { total: rows.length, outcomes, byDay, byPlay, recent };
}
