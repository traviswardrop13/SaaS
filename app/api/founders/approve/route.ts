import { NextRequest, NextResponse } from "next/server";
import { founderGate } from "@/lib/founder";
import { readAcct, setApproved, StoreUnavailable } from "@/lib/caseload";

/**
 * POST /api/founders/approve { email, approved? } → { ok, email, approved }
 *
 * The founder's hand approval of a clinician's OWN free Premium when they
 * have no work email (lib/workEmail says why the work email is asked for at
 * all). /leads.html drives it: the clinicians table shows who asked, and the
 * Approve button calls this. `approved: false` undoes a mis-click.
 *
 * Behind FOUNDER_KEY like every founder route. Approval is recorded on its
 * own hash (slpaccess), so a clinician's "Request access" landing at the same
 * moment can never overwrite it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const denied = founderGate(req);
  if (denied) return denied;
  let body: { email?: unknown; approved?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Which email?" }, { status: 400 });
  }
  // Only a real account can be approved — a typo here would otherwise
  // approve an address nobody signs in with, and nobody would notice.
  try {
    if (!(await readAcct(email))) {
      return NextResponse.json({ ok: false, error: "No clinician account with that email." }, { status: 404 });
    }
  } catch (e) {
    if (e instanceof StoreUnavailable) return NextResponse.json({ ok: false, error: "The data store didn't answer." }, { status: 503 });
    throw e;
  }
  const approved = body.approved !== false;
  await setApproved(email, approved);
  return NextResponse.json({ ok: true, email, approved });
}
