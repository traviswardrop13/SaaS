import { NextRequest, NextResponse } from "next/server";
import { readSession, liveSession, kvCmd, kvConfigured, rosterKey } from "@/lib/slpAuth";
import { dashboardGate } from "@/lib/proGate";
import { cleanGames, readGames, writeGames } from "@/lib/childGames";
import { rateLimit } from "@/lib/rateLimit";

/**
 * The games a therapist picked for one child on their caseload (CHILDGAMES1,
 * 25 Nov 2026; lib/childGames says why it is its own record).
 *
 *   GET  ?childId=…                → { ok, games }   (null: every game)
 *   POST { childId, games }        → { ok, games }   (games null or []: every game)
 *
 * The clinic code comes from the signed-in account, never the request, and
 * only a child already on that clinician's roster can be read or written, the
 * homework route's rules. Going back to every game is a removal of a limit and
 * always works; picking a limit is the dashboard, Sona Pro's (lib/proGate).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function codeFor(email: string): Promise<string> {
  try {
    const raw = await kvCmd(["GET", "slpacct:" + email]);
    if (raw) return (JSON.parse(String(raw)).code as string) || "";
  } catch {
    /* fall through */
  }
  return "";
}
const cleanId = (v: unknown) => String(v || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
const onRoster = async (code: string, childId: string) => !!(await kvCmd(["HGET", rosterKey(code), childId]));

export async function GET(req: NextRequest) {
  const s = await liveSession(readSession(req));
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });
  const code = await codeFor(s.email);
  const childId = cleanId(new URL(req.url).searchParams.get("childId"));
  if (!code || !childId) return NextResponse.json({ ok: false, error: "which child?" }, { status: 400 });
  if (!(await onRoster(code, childId))) return NextResponse.json({ ok: false, error: "not on your caseload" }, { status: 404 });
  return NextResponse.json({ ok: true, games: await readGames(code, childId) });
}

export async function POST(req: NextRequest) {
  const s = await liveSession(readSession(req));
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  // Sona's own page only.
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ ok: false, error: "bad origin" }, { status: 403 });
  const rl = await rateLimit(req, { key: "slpgames", limit: 120, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });
  const code = await codeFor(s.email);
  if (!code) return NextResponse.json({ ok: false, error: "finish your profile first" }, { status: 400 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 }); }
  const childId = cleanId(body.childId);
  if (!childId) return NextResponse.json({ ok: false, error: "which child?" }, { status: 400 });
  if (!(await onRoster(code, childId))) return NextResponse.json({ ok: false, error: "not on your caseload" }, { status: 404 });

  const games = cleanGames(body.games);
  if (games) {
    const locked = await dashboardGate(s.email);
    if (locked) return locked;
  }
  await writeGames(code, childId, games);
  return NextResponse.json({ ok: true, games });
}
