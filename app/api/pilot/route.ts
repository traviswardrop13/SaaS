import { NextRequest, NextResponse } from "next/server";

/**
 * Pilot outcome capture — receives a child's (consented) practice progress from
 * the app and forwards it to wherever the founder collects pilot data:
 *   - PILOT_WEBHOOK_URL  (preferred) — a GHL/Sheet/Make inbound webhook for pilots
 *   - LEAD_WEBHOOK_URL   (fallback)  — reuse the existing lead webhook, tagged source
 *
 * No DB required. Best-effort: never throws back into the app. This is how the
 * "before/after" outcome data (the data moat) flows back to you.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const hook = process.env.PILOT_WEBHOOK_URL || process.env.LEAD_WEBHOOK_URL;
  let captured = false;
  try {
    if (hook) {
      await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, kind: "pilot" }),
      });
      captured = true;
    }
  } catch {
    // never fail the app on a capture hiccup
  }

  return NextResponse.json({ ok: true, captured });
}
