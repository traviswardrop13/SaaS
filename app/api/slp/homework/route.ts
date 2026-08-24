import { NextRequest, NextResponse } from "next/server";
import { readSession, kvCmd, kvConfigured } from "@/lib/slpAuth";
import {
  normalizeHomework, readHomework, writeHomework, readAllHomework, hwStatus, isActive,
  type HomeworkRecord,
} from "@/lib/homework";
import { rateLimit } from "@/lib/rateLimit";

/**
 * The clinician's half of homework: read what is assigned across the caseload,
 * assign to one child, or end an assignment early.
 *
 * The clinic code comes from the SIGNED-IN account, never a query param — the
 * same rule the roster read had to learn. A clinic slug is printed on every
 * family link, so trusting ?code= would let anyone holding a link write
 * practice targets into a stranger's caseload.
 */
export const runtime = "nodejs";

async function codeFor(email: string): Promise<string> {
  try {
    const raw = await kvCmd(["GET", "slpacct:" + email]);
    if (raw) return (JSON.parse(String(raw)).code as string) || "";
  } catch {
    /* fall through */
  }
  return "";
}

/** The child's roster row, for the age the norm check needs and the name we echo back. */
async function rosterChild(code: string, childId: string): Promise<{ child?: string; age?: string } | null> {
  try {
    const raw = await kvCmd(["HGET", "slp:" + code, childId]);
    return raw ? (JSON.parse(String(raw)) as { child?: string; age?: string }) : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  if (!kvConfigured()) return NextResponse.json({ ok: true, configured: false, items: [] });
  const code = await codeFor(s.email);
  if (!code) return NextResponse.json({ ok: true, configured: true, items: [] });

  const all = await readAllHomework(code);
  const items = Object.keys(all).map((childId) => ({
    childId,
    hw: all[childId].hw,
    status: hwStatus(all[childId]),
    days: (all[childId].progress && all[childId].progress!.days) || {},
  }));
  // active first, then the most recently created — a clinician opening this
  // wants what is live, not an archive in insertion order
  items.sort((a, b) => {
    const rank = (x: typeof a) => (x.status === "active" ? 0 : x.status === "missed" ? 1 : 2);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return String(b.hw?.createdAt || "").localeCompare(String(a.hw?.createdAt || ""));
  });
  return NextResponse.json({ ok: true, configured: true, items });
}

export async function POST(req: NextRequest) {
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });

  const rl = await rateLimit(req, { key: "slphw", limit: 120, windowSec: 3600 });
  if (rl) return rl;

  if (!kvConfigured()) {
    return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });
  }
  const code = await codeFor(s.email);
  if (!code) return NextResponse.json({ ok: false, error: "finish your profile first" }, { status: 400 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }

  const childId = String(body.childId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
  if (!childId) return NextResponse.json({ ok: false, error: "which child?" }, { status: 400 });

  // Only children already on THIS clinician's roster. Without it the endpoint
  // is a way to write arbitrary keys into a hash from an authenticated session.
  const row = await rosterChild(code, childId);
  if (!row) return NextResponse.json({ ok: false, error: "not on your caseload" }, { status: 404 });

  if (body.action === "clear") {
    const prev = await readHomework(code, childId);
    await writeHomework(code, childId, { hw: null, progress: prev.progress });
    return NextResponse.json({ ok: true, cleared: true });
  }

  let name = "";
  try {
    const raw = await kvCmd(["GET", "slpacct:" + s.email]);
    if (raw) name = (JSON.parse(String(raw)).name as string) || "";
  } catch {
    /* the parent just sees a blank byline */
  }

  const hw = normalizeHomework(body.hw, { by: name, childAge: parseInt(String(row.age || ""), 10) || 0 });
  // A new assignment starts its own progress ledger. Keeping the old one would
  // credit last month's practice against this week's plan.
  const rec: HomeworkRecord = { hw, progress: { id: hw.id, days: {}, updatedAt: new Date().toISOString() } };
  await writeHomework(code, childId, rec);

  return NextResponse.json({
    ok: true,
    hw,
    active: isActive(hw),
    // surfaced so the dashboard can say it out loud rather than storing a
    // judgement silently — the clinician may be right, but they should see it
    aboveNorm: hw.aboveNorm,
  });
}
