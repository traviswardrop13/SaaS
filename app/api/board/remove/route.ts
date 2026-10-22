import { NextRequest } from "next/server";
import { kvConfigured, kvCmd } from "@/lib/slpAuth";
import { PAGES, SCRIPT_REMOVE, boardPrefix, boardSecrets, cidHash, hmget, holdsRemove, leaveArgs, overLimit, readBody, readSigned, runScript } from "@/lib/board";

/**
 * PRACTICE BOARD: the email's "Take them off the board" link (BOARD1, 11 Oct
 * 2026). It needs no phone: a grown-up whose phone is lost, wiped or
 * replaced can still delete every child that email put on the board, for the
 * whole life of those entries (the remove-link record lives as long as they
 * do). If the request was never claimed, the request itself is deleted.
 *
 * GET shows a page with a button and changes nothing (mail scanners open
 * links); POST deletes. Only a remove value ("x") is accepted, never the
 * phone's pending value. It works live or not, paused or not. Plain HTML,
 * no script, no pixel, the same locked-down page as the confirm link.
 */
export const runtime = "nodejs";

function parts(v: unknown): { rid: string; cidh: string } | null {
  const s = readSigned("x", v);
  if (!s) return null;
  const [rid, cid] = s.split(".");
  return { rid, cidh: cidHash(cid) };
}

export async function GET(req: NextRequest) {
  if (!boardSecrets()[0] || !kvConfigured()) return PAGES.off();
  if (await overLimit(req, "board-remove-get", 20, boardSecrets()[0])) return PAGES.limit();
  const x = new URL(req.url).searchParams.get("x") || "";
  const p = parts(x);
  if (!p) return PAGES.nothing(400);
  const P = boardPrefix();
  const rk = hmget(await kvCmd(["HMGET", P + "rid:" + p.rid, "cidh1", "cidh2", "cidh3", "xh"]), 4);
  const pk = hmget(await kvCmd(["HMGET", P + "pend:" + p.rid, "cidh1", "cidh2", "cidh3", "xh"]), 4);
  if (!rk || !pk) return PAGES.error();
  if (!holdsRemove(rk, p.cidh) && !holdsRemove(pk, p.cidh)) return PAGES.nothing();
  return PAGES.removeAsk(x);
}

export async function POST(req: NextRequest) {
  if (!boardSecrets()[0] || !kvConfigured()) return PAGES.off();
  if (await overLimit(req, "board-remove", 20, boardSecrets()[0])) return PAGES.limit();
  const raw = await readBody(req);
  if (raw === null) return PAGES.nothing(400);
  const p = parts(new URLSearchParams(raw).get("x"));
  if (!p) return PAGES.nothing(400);
  const P = boardPrefix();
  const r = await runScript(SCRIPT_REMOVE, [P + "pend:" + p.rid, P + "rid:" + p.rid], [P, p.cidh, ...leaveArgs(Date.now())]);
  if (!Array.isArray(r) || r.length !== 2) return PAGES.error();
  return Number(r[0]) === 1 ? PAGES.removed() : PAGES.nothing();
}
