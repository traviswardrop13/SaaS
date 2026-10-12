import { NextRequest } from "next/server";
import { kvCmd } from "@/lib/slpAuth";
import {
  JOINS_HIGH, JOINS_TTL, MEMBER_TTL, NICK_TRIES, RETRY, SCRIPT_CLAIM,
  boardJson, gateJson, hmget, list, makeId, memberDay, monthOf, nickCandidates, overLimit, parseAnswer, readSigned, runScript, sign, utcDay,
} from "@/lib/board";

/**
 * PRACTICE BOARD: "Finish" in Settings (BOARD1, 11 Oct 2026; dark until
 * Travis's go). The phone posts its pending value; until the grown-up has
 * pressed the email's button the answer is "waiting". After it, one member
 * per ticked child, in order: a token only that phone holds, and a made-up
 * nickname. The phone writes nothing until it has this answer.
 *
 * Repeatable by construction: the claim is one script that writes the ids
 * onto the request, so a second Finish, an automatic retry, two taps at
 * once or a lost answer all get the same members back, never a second set.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const g = await gateJson(req, { pausable: true });
  if (!g.ok) return g.res;
  const { body, P, secret } = g;
  if (await overLimit(req, "board-claim", 30, secret)) return boardJson({ ok: false, limit: true }, 429, { "Retry-After": "3600" });
  const rid = readSigned("p", body.pend);
  if (!rid) return boardJson({ ok: false, error: "token" }, 401);

  const f = hmget(await kvCmd(["HMGET", P + "pend:" + rid, "n", "tz", "ok"]), 3);
  if (!f) return boardJson(RETRY, 503);
  if (!f[0]) return boardJson({ ok: false, expired: true }, 404);
  if (f[2] !== "1") return boardJson({ ok: false, waiting: true }, 202);
  const n = Math.max(1, Math.min(4, Number(f[0]) || 1));
  const tz = Number(f[1]) || 0;
  const now = Date.now();
  const joined = memberDay(now, tz, 0);

  const args: (string | number)[] = [P, rid, joined, MEMBER_TTL, NICK_TRIES, n, JOINS_TTL];
  for (let i = 0; i < n; i++) args.push(makeId(), ...nickCandidates(NICK_TRIES));
  const a = parseAnswer(await runScript(SCRIPT_CLAIM, [P + "pend:" + rid, P + "rid:" + rid, P + "joins:" + utcDay(now)], args));
  if (!a) return boardJson(RETRY, 503);
  if (a.s === "expired") return boardJson({ ok: false, expired: true }, 404);
  if (a.s === "waiting") return boardJson({ ok: false, waiting: true }, 202);
  if (a.s !== "new" && a.s !== "done") return boardJson(RETRY, 503);
  if (a.s === "new" && Number(a.joins) > JOINS_HIGH) console.warn("[board] joins high");
  // A member removed since (the email's remove link) comes back with no
  // nickname: its token answers "gone" on the phone's first send.
  const members = list(a.m).map((row) => {
    const [id, nick] = list(row).map(String);
    return { token: sign("m", id), nick: nick || null };
  });
  return boardJson({ ok: true, members, month: monthOf(memberDay(now, tz, 0)) });
}
