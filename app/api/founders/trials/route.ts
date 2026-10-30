import { NextRequest, NextResponse } from "next/server";
import { founderGate } from "@/lib/founder";
import { readTrials } from "@/lib/trials";

/**
 * FOUNDER VIEW OF THE FREE-WEEK REPORT (TRIAL1, 30 Oct 2026) — the "Free
 * trials" section of /leads.html. Of the families who started a free trial
 * in the last 90 days: how many played on each of its days, how each ended,
 * and how many paid by how many days they played. Behind FOUNDER_KEY (lib/
 * founder), from a header. It holds no name and no address: only anonymous
 * family ids, which it never returns.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const stop = founderGate(req);
  if (stop) return stop;
  const report = await readTrials();
  return NextResponse.json({ ok: true, ...report });
}
