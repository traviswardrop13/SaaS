import { NextRequest } from "next/server";
import { SCRIPT_LEAVE, boardJson, gateJson, leaveArgs, overLimit, readSigned, runScript } from "@/lib/board";

/**
 * PRACTICE BOARD: "Turn off" (BOARD1, 11 Oct 2026). The phone posts the
 * child's token and the entry is deleted now: the member, its nickname, its
 * place in the month lists and snapshots, its "already counted" marks.
 *
 * Deleting always works: whether the board is live, paused or switched back
 * off, so a family can always take a child off (it needs only a secret and a
 * store). Deleting twice is fine. A store error is a 503, never "deleted":
 * the phone keeps the deletion queued and sends it again.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const g = await gateJson(req, { anyState: true });
  if (!g.ok) return g.res;
  const { body, P, secret } = g;
  if (await overLimit(req, "board-leave", 30, secret)) return boardJson({ ok: false, limit: true }, 429, { "Retry-After": "3600" });
  const id = readSigned("m", body.token);
  if (!id) return boardJson({ ok: false, error: "token" }, 401);
  const r = await runScript(SCRIPT_LEAVE, [P + "mem:" + id], [P, id, ...leaveArgs(Date.now())]);
  if (typeof r !== "number") return boardJson({ ok: false, retry: true }, 503);
  return boardJson({ ok: true, deleted: true });
}
