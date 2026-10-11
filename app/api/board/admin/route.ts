import { NextRequest } from "next/server";
import { kvCmd } from "@/lib/slpAuth";
import { founderGate } from "@/lib/founder";
import { SCRIPT_LEAVE, boardJson, boardPrefix, boardSecrets, leaveArgs, nickShape, readBody, runScript, utcDay } from "@/lib/board";

/**
 * PRACTICE BOARD: the founder's view (BOARD1, 11 Oct 2026), behind
 * FOUNDER_KEY. GET: how many children are on this month's board, the daily
 * join counts of the last 14 days and today's confirmation emails, as bare
 * numbers. POST {action:"remove", nick}: deletes that entry, for an email to
 * privacy@speaksona.com or a nickname a reviewer rejects. Works whenever a
 * secret exists, live or not.
 */
export const runtime = "nodejs";

function ready(): boolean {
  return !!boardSecrets()[0];
}

// founderGate's own answers, marked no-store like every board answer.
function gate(req: NextRequest) {
  const blocked = founderGate(req);
  if (blocked) blocked.headers.set("Cache-Control", "no-store");
  return blocked;
}

export async function GET(req: NextRequest) {
  const blocked = gate(req);
  if (blocked) return blocked;
  if (!ready()) return boardJson({ ok: false, off: true }, 503);
  const P = boardPrefix();
  const now = Date.now();
  const today = utcDay(now);
  const days: string[] = [];
  for (let i = 0; i < 14; i++) days.push(utcDay(now - i * 86400000));
  const members = await kvCmd(["ZCARD", P + "m:" + today.slice(0, 7)]);
  const joins = await kvCmd(["MGET", ...days.map((d) => P + "joins:" + d)]);
  const mail = await kvCmd(["GET", P + "mail:" + today]);
  if (members === undefined || !Array.isArray(joins) || mail === undefined) return boardJson({ ok: false, retry: true }, 503);
  return boardJson({
    ok: true,
    month: today.slice(0, 7),
    members: Number(members) || 0,
    joins: days.map((d, i) => ({ day: d, n: Number(joins[i]) || 0 })),
    mail: Number(mail) || 0,
  });
}

export async function POST(req: NextRequest) {
  const blocked = gate(req);
  if (blocked) return blocked;
  if (!ready()) return boardJson({ ok: false, off: true }, 503);
  const raw = await readBody(req);
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(raw || "{}"); } catch { return boardJson({ ok: false, error: "json" }, 400); }
  if (!body || body.action !== "remove" || !nickShape(body.nick)) return boardJson({ ok: false, error: "Send {action:\"remove\", nick}." }, 400);
  const P = boardPrefix();
  const id = await kvCmd(["GET", P + "nick:" + body.nick]);
  if (id === undefined) return boardJson({ ok: false, retry: true }, 503);
  if (id === null) return boardJson({ ok: true, deleted: false });
  const r = await runScript(SCRIPT_LEAVE, [P + "mem:" + String(id)], [P, String(id), ...leaveArgs(Date.now())]);
  if (typeof r !== "number") return boardJson({ ok: false, retry: true }, 503);
  return boardJson({ ok: true, deleted: r > 0 });
}
