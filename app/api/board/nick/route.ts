import { NextRequest } from "next/server";
import { kvCmd } from "@/lib/slpAuth";
import {
  NICK_HOUR_CAP, NICK_TRIES, RETRY, SCRIPT_NICK,
  boardJson, gateJson, hmget, memberDay, monthOf, nickCandidates, parseAnswer, readSigned, runScript, utcHour,
} from "@/lib/board";

/**
 * PRACTICE BOARD: "New nickname" (BOARD1, 11 Oct 2026; dark until Travis's
 * go). Another made-up one from the same lists, never typed: at most one a
 * day and three a month (the family's own calendar), so a nickname is
 * something other families can recognise, not a way to send messages. The
 * new nickname lives exactly as long as the member; the old one is let go.
 */
export const runtime = "nodejs";

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
  const day = memberDay(now, Number(f[0]) || 0, 0);
  const a = parseAnswer(await runScript(
    SCRIPT_NICK,
    [P + "mem:" + id, P + "nickn:" + id + ":" + utcHour(now)],
    [P, id, day, monthOf(day), NICK_HOUR_CAP, ...nickCandidates(NICK_TRIES)],
  ));
  if (!a) return boardJson(RETRY, 503);
  if (a.s === "gone") return boardJson({ ok: false, gone: true }, 404);
  if (a.s === "limit") return boardJson({ ok: false, limit: true }, 429);
  if (a.s === "ok" && typeof a.nick === "string") return boardJson({ ok: true, nick: a.nick });
  return boardJson(RETRY, 503);
}
