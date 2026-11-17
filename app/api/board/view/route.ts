import { NextRequest } from "next/server";
import { kvCmd } from "@/lib/slpAuth";
import {
  BUDDY_IDS, DAY_TTL, RETRY, SCRIPT_VIEW, VIEW_CAP,
  boardJson, gateJson, hmget, list, memberDay, monthOf, parseAnswer, readSigned, runScript, utcDay, utcHour,
} from "@/lib/board";

/**
 * PRACTICE BOARD: what the board page shows (BOARD1, 11 Oct 2026; dark
 * until Travis's go).
 *
 * Other children's rows come from a snapshot of the month taken once a UTC
 * day, so polling the board never shows when another child practiced; the
 * asking child's own days are live. The top 10 places, competition ranking
 * (1, 1, 3), at most 20 rows; a tie too big to list becomes one line ("+38
 * more kids with 11 days"), and the asking child's own row is always listed
 * when its place is 10 or better, in the last slot of its tie group. No ids,
 * no totals, and no time limit refreshed by a read. Fewer than three children
 * on the board this month is "quiet": no rows at all.
 */
export const runtime = "nodejs";

type Row = { place: number; nick: string; buddy: string; days: number; me: boolean };

function buddyOf(b: unknown): string {
  return typeof b === "string" && BUDDY_IDS.includes(b) ? b : "fox";
}

export async function POST(req: NextRequest) {
  const g = await gateJson(req, { pausable: true });
  if (!g.ok) return g.res;
  const { body, P } = g;
  const id = readSigned("m", body.token);
  if (!id) return boardJson({ ok: false, error: "token" }, 401);
  const f = hmget(await kvCmd(["HMGET", P + "mem:" + id, "tz"]), 1);
  if (!f) return boardJson(RETRY, 503);
  if (!f[0]) return boardJson({ ok: false, gone: true }, 404);

  const now = Date.now();
  const month = monthOf(memberDay(now, Number(f[0]) || 0, 0));
  const snap = P + "snap:" + month + ":" + utcDay(now);
  const a = parseAnswer(await runScript(
    SCRIPT_VIEW,
    [P + "mem:" + id, P + "m:" + month, snap, P + "snapd:" + month + ":" + utcDay(now), P + "viewn:" + id + ":" + utcHour(now)],
    [P, id, VIEW_CAP, DAY_TTL],
  ));
  if (!a) return boardJson(RETRY, 503);
  if (a.s === "gone") return boardJson({ ok: false, gone: true }, 404);
  if (a.s === "limit") return boardJson({ ok: false, limit: true }, 429);
  if (a.s !== "ok") return boardJson(RETRY, 503);

  const days = Number(a.days) || 0;
  const snapMe = Number(a.snapme);
  const quiet = (Number(a.card) || 0) < 3;
  const place = !quiet && days > 0 && 1 + (Number(a.above) || 0) <= 10 ? 1 + (Number(a.above) || 0) : null;
  const me = { nick: String(a.nick || ""), buddy: buddyOf(a.buddy), days, place };
  if (quiet) return boardJson({ ok: true, month, quiet: true, top: [], more: [], me });

  // Every other child in the snapshot window, grouped by days, high to low.
  // A group's size is the snapshot's own count at that score, less the
  // asking child's snapshot entry (their row is live and shown apart).
  const sizes = new Map<number, number>();
  for (const t of list(a.ties)) {
    const [score, count] = list(t).map(Number);
    sizes.set(score, count - (score === snapMe ? 1 : 0));
  }
  const groups = new Map<number, { others: { nick: string; buddy: string }[]; size: number; mine: boolean }>();
  for (const r of list(a.rows)) {
    const [mine, nick, buddy, score] = list(r);
    if (Number(mine) === 1) continue;
    const s = Number(score);
    if (!groups.has(s)) groups.set(s, { others: [], size: sizes.get(s) || 0, mine: false });
    groups.get(s)!.others.push({ nick: String(nick), buddy: buddyOf(buddy) });
  }
  if (days > 0) {
    if (!groups.has(days)) groups.set(days, { others: [], size: 0, mine: false });
    groups.get(days)!.mine = true;
  }

  const top: Row[] = [];
  const more: { place: number; n: number; days: number }[] = [];
  let ahead = 0, slots = 20;
  for (const s of [...groups.keys()].sort((x, y) => y - x)) {
    const grp = groups.get(s)!;
    const size = Math.max(grp.size, grp.others.length) + (grp.mine ? 1 : 0);
    const at = ahead + 1;
    ahead += size;
    if (at > 10) break;
    const fit = Math.min(size, slots);
    const others = grp.others.slice(0, Math.max(0, fit - (grp.mine ? 1 : 0)));
    for (const o of others) top.push({ place: at, nick: o.nick, buddy: o.buddy, days: s, me: false });
    if (grp.mine && fit > 0) top.push({ place: at, nick: me.nick, buddy: me.buddy, days: s, me: true });
    const shown = others.length + (grp.mine && fit > 0 ? 1 : 0);
    if (size > shown) more.push({ place: at, n: size - shown, days: s });
    slots -= shown;
  }
  return boardJson({ ok: true, month, quiet: false, top, more, me });
}
