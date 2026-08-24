import { NextRequest, NextResponse } from "next/server";
import { readTicket, kvConfigured } from "@/lib/slpAuth";
import { readHomework, writeHomework, isActive, isoDay, type Homework } from "@/lib/homework";
import { rateLimit } from "@/lib/rateLimit";

/**
 * The family's half of homework: a child's device asks what it should be
 * practising, and reports back how much of it happened.
 *
 * POST, not GET, because the credential travels in the body — a ticket in a
 * query string lands in every access log between here and the phone.
 *
 * WHAT COMES BACK IS DELIBERATELY THIN. The assignment and nothing else: no
 * name, no age, no other child, no roster. A device holding a valid ticket is
 * a family this clinician invited, not a clinician — it gets its own homework
 * and cannot enumerate the caseload.
 *
 * WHAT GOES UP IS THINNER. A rep count for today. No audio, ever — there is no
 * mechanism in this route or anywhere else that could accept one — and no
 * child's name, because the roster already has whatever the parent consented
 * to share and this endpoint has no business restating it.
 */
export const runtime = "nodejs";

const REPS_MAX = 5000;

/** Only the fields a child's device has any use for. */
function publicHomework(hw: Homework) {
  return {
    id: hw.id,
    title: hw.title,
    note: hw.note,
    sounds: hw.sounds,
    pos: hw.pos,
    repsPerDay: hw.repsPerDay,
    words: hw.words,
    start: hw.start,
    due: hw.due,
    by: hw.by,
  };
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { key: "hw", limit: 240, windowSec: 3600 });
  if (rl) return rl;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: true, hw: null });
  }

  const code = String(body.code || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  const childId = String(body.childId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
  const ticket = String(body.ticket || "");
  if (!code || !childId) return NextResponse.json({ ok: true, hw: null });

  // No ticket, no read. A device that never passed the clinician's code+key
  // check has no standing to ask what their caseload is practising.
  const t = readTicket(ticket, code);
  if (!t) return NextResponse.json({ ok: false, error: "not enrolled" }, { status: 401 });
  // Tickets minted since the homework work carry the child they were issued
  // for. Where that binding exists it is enforced, so one family on a caseload
  // cannot read another's assignment by guessing a childId. Older tickets have
  // no cid and still work — they predate the binding and the families holding
  // them did nothing wrong.
  if (t.cid && t.cid !== childId) {
    return NextResponse.json({ ok: false, error: "not enrolled" }, { status: 401 });
  }

  if (!kvConfigured()) return NextResponse.json({ ok: true, hw: null });

  const rec = await readHomework(code, childId);

  // Report practice BEFORE answering, so a device that only ever calls once a
  // day still closes the loop on yesterday.
  const reps = Math.max(0, Math.min(REPS_MAX, parseInt(String(body.reps), 10) || 0));
  const forId = String(body.forId || "");
  if (reps > 0 && rec.hw && forId === rec.hw.id) {
    const day = isoDay();
    const prog = rec.progress && rec.progress.id === rec.hw.id
      ? rec.progress
      : { id: rec.hw.id, days: {} as Record<string, number>, updatedAt: "" };
    // The device sends today's TOTAL, not a delta, so a retry cannot inflate
    // it — same reason mintCoins() derives from the day's count on the phone.
    prog.days[day] = Math.max(prog.days[day] || 0, reps);
    prog.updatedAt = new Date().toISOString();
    await writeHomework(code, childId, { hw: rec.hw, progress: prog });
  }

  const hw = rec.hw && isActive(rec.hw) ? publicHomework(rec.hw) : null;
  return NextResponse.json({ ok: true, hw });
}
