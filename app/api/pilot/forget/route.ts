import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { readTicket, ticketOwnsChild, kvConfigured } from "@/lib/slpAuth";
import { cleanChildId, removeChild } from "@/lib/roster";

/**
 * "Stop sharing with your speech therapist" — the family's own delete.
 *
 * Consent that cannot be withdrawn is not consent. A grown-up who said yes
 * on join.html can say no later, from the device they said it on, and the
 * clinician's dashboard forgets the child at once: the roster row (name,
 * age, practice history), the homework row and the clinician's own meta are
 * deleted — not hidden — and the child is marked gone, so the device's next
 * sync cannot quietly rebuild what was just erased. That is exactly the
 * deletion the clinician's own remove button performs; one function, one
 * meaning of "gone".
 *
 * Proof is the enrolment ticket bound to this child: the same credential
 * that let the device write the row is what lets it take the row away. A
 * ticket that predates the binding binds to the first child it claims (see
 * ticketOwnsChild), so a family enrolled before that change can still leave.
 *
 * Nothing on the device is touched here — the page that calls this records
 * the choice locally (slpShare: false). Free access is unaffected: access
 * and sharing were separate decisions on the way in, and they stay separate
 * on the way out.
 *
 * Fails CLOSED without KV: a deletion that cannot be performed is not
 * reported as performed.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { key: "pilotforget", limit: 30, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) {
    return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }

  const code = String(body.code || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  const childId = cleanChildId(body.childId);
  const ticket = String(body.ticket || "");
  if (!code || !childId) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });

  const t = readTicket(ticket, code);
  if (!t) return NextResponse.json({ ok: false, error: "not enrolled" }, { status: 401 });
  const owns = t.cid ? t.cid === childId : await ticketOwnsChild(ticket, childId);
  if (!owns) return NextResponse.json({ ok: false, error: "not your child" }, { status: 403 });

  const r = await removeChild(code, childId);
  return NextResponse.json({ ok: true, forgotten: r.removed });
}
