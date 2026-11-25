import { NextRequest, NextResponse } from "next/server";
import { founderGate } from "@/lib/founder";
import { everyone } from "@/lib/contacts";
import { runBfDaily } from "@/lib/bfmail";

/**
 * TODAY'S BLACK FRIDAY EMAIL, BY A FOUNDER'S PRESS (BFMAIL1, Travis, 25 Nov
 * 2026: "all of my SLP emails, I want to send them today's email too. not yet
 * tho jsut get it ready"). /leads.html's Black Friday card.
 *  - GET counts who would get today's email (every speech therapist on the
 *    list, the daily run's skips applied) and sends nothing.
 *  - POST sends it, once an address a day (the daily run's own marks, so a
 *    second press, or tomorrow's cron, never sends today's twice), paced for
 *    Resend; it stops at about four minutes and says how many are left, and
 *    a second press carries on.
 * Behind FOUNDER_KEY, from a header. The daily cron sends Thursday to
 * Sunday by itself; only this route sends a manual day (BF_MANUAL_DAYS).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const stop = founderGate(req);
  if (stop) return stop;
  const r = await runBfDaily(everyone, undefined, undefined, Date.now(), { manual: true, dry: true, deadline: Date.now() + 200000 });
  return NextResponse.json({ ok: true, ...r }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const stop = founderGate(req);
  if (stop) return stop;
  const started = Date.now();
  const r = await runBfDaily(everyone, undefined, undefined, started, { manual: true, deadline: started + 230000 });
  return NextResponse.json({ ok: true, ...r }, { headers: { "Cache-Control": "no-store" } });
}
