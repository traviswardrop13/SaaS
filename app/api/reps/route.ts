import { NextRequest, NextResponse } from "next/server";

/**
 * Weekly practice-volume board (parent-side peer motivation).
 *
 * POST { fid, week, reps }  — upsert one family's honest rep count for an ISO
 *   week into a KV hash (reps:<week>). fid is a random anonymous id minted on
 *   the device: no names, no email, no audio, no accuracy — a single integer
 *   per family per week. TTL ~5 weeks.
 * GET ?week=YYYY-Www&reps=N — { ok, cohort, pct, nextPct, nextReps }:
 *   pct = share of reporting families with FEWER reps (0-99). Percentiles are
 *   only meaningful with a real cohort — the client hides the chip when
 *   cohort < 20, and we compare VOLUME (parental effort), never accuracy
 *   (children's development is not a leaderboard).
 */
export const runtime = "nodejs";

async function kvCmd(cmd: (string | number)[]): Promise<unknown> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !tok) return undefined;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    });
    if (!r.ok) return undefined;
    const j = (await r.json()) as { result?: unknown };
    return j.result;
  } catch {
    return undefined;
  }
}

const WEEK_RE = /^\d{4}-W\d{2}$/;

function hashVals(flat: unknown): number[] {
  const out: number[] = [];
  if (Array.isArray(flat)) for (let i = 1; i < flat.length; i += 2) out.push(parseInt(String(flat[i]), 10) || 0);
  else if (flat && typeof flat === "object") for (const v of Object.values(flat as Record<string, unknown>)) out.push(parseInt(String(v), 10) || 0);
  return out;
}

export async function POST(req: NextRequest) {
  let b: { fid?: string; week?: string; reps?: number };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const fid = String(b.fid || "").slice(0, 40);
  const week = String(b.week || "");
  const reps = Math.max(0, Math.min(20000, Math.floor(Number(b.reps) || 0)));
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(fid) || !WEEK_RE.test(week)) {
    return NextResponse.json({ ok: false, error: "Bad fid/week." }, { status: 400 });
  }
  const key = "reps:" + week;
  await kvCmd(["HSET", key, fid, reps]);
  await kvCmd(["EXPIRE", key, 60 * 60 * 24 * 35]);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get("week") || "";
  const reps = Math.max(0, Math.floor(Number(req.nextUrl.searchParams.get("reps")) || 0));
  if (!WEEK_RE.test(week)) return NextResponse.json({ ok: false, error: "Bad week." }, { status: 400 });
  const flat = await kvCmd(["HGETALL", "reps:" + week]);
  if (flat === undefined) return NextResponse.json({ ok: false, error: "No store." }, { status: 503 });
  const vals = hashVals(flat);
  const cohort = vals.length;
  if (!cohort) return NextResponse.json({ ok: true, cohort: 0, pct: 0, nextPct: null, nextReps: null });
  const below = vals.filter((v) => v < reps).length;
  const pct = Math.min(99, Math.floor((below / cohort) * 100)); // share you out-practiced
  // the next decile up, and the rep count that reaches it
  const sorted = vals.slice().sort((a, b) => a - b);
  let nextPct: number | null = null, nextReps: number | null = null;
  for (let p = Math.floor(pct / 10) * 10 + 10; p <= 90; p += 10) {
    const idx = Math.min(cohort - 1, Math.ceil((p / 100) * cohort));
    const need = sorted[idx] + 1;
    if (need > reps) { nextPct = p; nextReps = need - reps; break; }
  }
  return NextResponse.json({ ok: true, cohort, pct, nextPct, nextReps });
}
