import { NextRequest, NextResponse } from "next/server";
import { readSession, kvCmd, kvConfigured, rosterKey } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { readAccount, cleanChildId, metaKey, writeMeta, removeChild } from "@/lib/roster";

/**
 * One child on the signed-in clinician's caseload: archive them, bring them
 * back, or take them off.
 *
 * The clinic code comes from the SIGNED-IN account, never a query param — the
 * same rule every clinician route has had to learn. A clinic slug is printed
 * on every family link, so trusting ?code= would let anyone holding a link
 * remove a stranger's caseload.
 *
 * Archive is a flag on the clinician's own meta row: the family's device
 * keeps syncing exactly as before and nothing about them is lost; the
 * dashboard just stops showing them by default. Remove is the real thing —
 * every row about the child goes, and a tombstone stops the device's next
 * sync from quietly putting the row back (see /api/pilot). Neither touches
 * the family's device or their free access; a clinician can stop RECEIVING
 * a child's practice, and that is all this can do.
 */
export const runtime = "nodejs";

/** Session → rate limit → store → code. The same gate for both verbs. */
async function gate(req: NextRequest): Promise<{ code: string } | NextResponse> {
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  const rl = await rateLimit(req, { key: "slpchild", limit: 120, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) {
    return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });
  }
  const { code } = await readAccount(s.email);
  if (!code) return NextResponse.json({ ok: false, error: "finish your profile first" }, { status: 400 });
  return { code };
}

async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Only children already on THIS clinician's roster — or set up by them and
 * not yet synced (meta only). Without it the endpoint is a way to write
 * arbitrary hash fields from an authenticated session.
 */
async function onCaseload(code: string, childId: string): Promise<boolean> {
  const [r, m] = await Promise.all([
    kvCmd(["HEXISTS", rosterKey(code), childId]),
    kvCmd(["HEXISTS", metaKey(code), childId]),
  ]);
  return r === 1 || m === 1;
}

// POST { childId, action: "archive" | "unarchive" }
export async function POST(req: NextRequest) {
  const g = await gate(req);
  if (g instanceof NextResponse) return g;
  const body = await readBody(req);
  if (!body) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });

  const childId = cleanChildId(body.childId);
  if (!childId) return NextResponse.json({ ok: false, error: "which child?" }, { status: 400 });
  const action = String(body.action || "");
  if (action !== "archive" && action !== "unarchive") {
    return NextResponse.json({ ok: false, error: "archive or unarchive" }, { status: 400 });
  }
  if (!(await onCaseload(g.code, childId))) {
    return NextResponse.json({ ok: false, error: "not on your caseload" }, { status: 404 });
  }
  const meta = await writeMeta(g.code, childId, { archived: action === "archive" });
  return NextResponse.json({ ok: true, childId, meta });
}

// DELETE { childId } → { ok, removed: childId }
export async function DELETE(req: NextRequest) {
  const g = await gate(req);
  if (g instanceof NextResponse) return g;
  const body = await readBody(req);
  if (!body) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });

  const childId = cleanChildId(body.childId);
  if (!childId) return NextResponse.json({ ok: false, error: "which child?" }, { status: 400 });
  if (!(await onCaseload(g.code, childId))) {
    return NextResponse.json({ ok: false, error: "not on your caseload" }, { status: 404 });
  }
  const r = await removeChild(g.code, childId);
  return NextResponse.json({ ok: true, removed: r.removed });
}
