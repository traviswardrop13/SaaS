import { NextRequest } from "next/server";
import { kvCmd } from "@/lib/slpAuth";
import {
  BUDDY_IDS, DAY_CAP, DAY_TTL, MAX_AGO, MEMBER_TTL, RETRY, SCRIPT_DAY, TICK_TTL,
  boardJson, ceilingFor, gateJson, hmget, memberDay, monthExpiry, monthOf, offsetOk, parseAnswer, readSigned, runScript, utcDay,
} from "@/lib/board";

/**
 * PRACTICE BOARD: one goal day (BOARD1, 11 Oct 2026; dark until Travis's go).
 * The phone sends `{token, ago}`: how many seconds ago this child met the
 * daily goal. It never sends a date. The server works the day out from its
 * own clock and the time zone the family joined from, read as stored BEFORE
 * any change, so a phone clock, a pasted backup or a backdated claim adds
 * nothing:
 *  - only today or yesterday in that zone, and never before joining ("a day
 *    can be added up to a day late, never early");
 *  - never more days this month than calendar days since joining (inside
 *    the script, so two claims at once cannot both pass);
 *  - once per day, by an atomic SET NX.
 * A new zone is stored only on a counted day, within two hours of where the
 * family joined and once in 20 hours.
 *
 * No IP limit: families behind one carrier or school address must never lose
 * days; 12 claims a UTC day per token is the limit. It keeps counting while
 * the board is paused, so "your days still count" stays true.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const g = await gateJson(req, {});
  if (!g.ok) return g.res;
  const { body, P } = g;
  const id = readSigned("m", body.token);
  if (!id) return boardJson({ ok: false, error: "token" }, 401);

  const f = hmget(await kvCmd(["HMGET", P + "mem:" + id, "tz", "joined"]), 2);
  if (!f) return boardJson(RETRY, 503);
  if (!f[0] || !f[1]) return boardJson({ ok: false, gone: true }, 404);
  const ago = body.ago;
  if (typeof ago !== "number" || !Number.isInteger(ago) || ago < 0 || ago > MAX_AGO) return boardJson({ ok: false, reason: "ago" }, 400);

  const now = Date.now();
  const tz = Number(f[0]) || 0, joined = f[1];
  const day = memberDay(now, tz, ago), today = memberDay(now, tz, 0), yesterday = memberDay(now, tz, 86400);
  if ((day !== today && day !== yesterday) || day < joined) return boardJson({ ok: false, reason: "date" }, 400);
  const ceiling = ceilingFor(day, joined, today);
  const buddy = typeof body.buddy === "string" && BUDDY_IDS.includes(body.buddy) ? body.buddy : "";
  const ntz = offsetOk(body.tz) ? String(body.tz) : "";

  const a = parseAnswer(await runScript(
    SCRIPT_DAY,
    [P + "mem:" + id, P + "dayn:" + id + ":" + utcDay(now), P + "tick:" + id + ":" + day, P + "m:" + monthOf(day)],
    [P, id, ceiling, MEMBER_TTL, monthExpiry(monthOf(day)), buddy, ntz, Math.floor(now / 1000), DAY_TTL, DAY_CAP, TICK_TTL],
  ));
  if (!a) return boardJson(RETRY, 503);
  if (a.s === "gone") return boardJson({ ok: false, gone: true }, 404);
  if (a.s === "limit") return boardJson({ ok: false, limit: true }, 429);
  if (a.s === "ceiling") return boardJson({ ok: false, reason: "ceiling" }, 400);
  if (a.s === "dup") return boardJson({ ok: true, counted: false, days: Number(a.days) || 0 });
  if (a.s === "counted") return boardJson({ ok: true, counted: true, days: Number(a.days) || 0 });
  return boardJson(RETRY, 503);
}
