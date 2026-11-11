import { NextRequest } from "next/server";
import { kvConfigured, kvCmd } from "@/lib/slpAuth";
import { PAGES, SCRIPT_CONFIRM, boardLive, boardPrefix, boardSecrets, cidHash, hmget, overLimit, readBody, readSigned, runScript } from "@/lib/board";

/**
 * PRACTICE BOARD: the email's "Yes, turn it on" link (BOARD1, 11 Oct 2026;
 * dark until Travis's go).
 *
 * GET only shows a page with the code, the number of children and a button,
 * and changes nothing: mail scanners open every link in an email, and a
 * scanner must never be the grown-up who said yes. The button POSTs the same
 * value back as a form, and only that confirms. Only a confirm value ("c")
 * is accepted: the phone's pending value ("p") is another kind, signed
 * apart, so a phone can never confirm its own request.
 *
 * The page is plain HTML with no script and no pixel, inline styles only,
 * forms posting only here, never framed, and no referrer leaves it.
 */
export const runtime = "nodejs";

function parts(v: unknown): { rid: string; cidh: string } | null {
  const s = readSigned("c", v);
  if (!s) return null;
  const [rid, cid] = s.split(".");
  return { rid, cidh: cidHash(cid) };
}

function ready(): boolean {
  return boardLive() && !!boardSecrets()[0] && kvConfigured();
}

export async function GET(req: NextRequest) {
  if (!ready()) return PAGES.off();
  if (await overLimit(req, "board-confirm", 30, boardSecrets()[0])) return PAGES.limit();
  const c = new URL(req.url).searchParams.get("c") || "";
  const p = parts(c);
  if (!p) return PAGES.expired(400);
  const f = hmget(await kvCmd(["HMGET", boardPrefix() + "pend:" + p.rid, "n", "code", "ok", "cidh1", "cidh2", "cidh3"]), 6);
  if (!f) return PAGES.error();
  if (!f[1] || ![f[3], f[4], f[5]].includes(p.cidh)) return PAGES.expired();
  if (f[2] === "1") return PAGES.done();
  return PAGES.confirm(c, f[1], Number(f[0]) || 1);
}

export async function POST(req: NextRequest) {
  if (!ready()) return PAGES.off();
  if (await overLimit(req, "board-confirm-post", 20, boardSecrets()[0])) return PAGES.limit();
  const raw = await readBody(req);
  if (raw === null) return PAGES.expired(400);
  const p = parts(new URLSearchParams(raw).get("c"));
  if (!p) return PAGES.expired(400);
  const r = await runScript(SCRIPT_CONFIRM, [boardPrefix() + "pend:" + p.rid], [p.cidh]);
  if (r === undefined) return PAGES.error();
  return r === 1 ? PAGES.done() : PAGES.expired();
}
