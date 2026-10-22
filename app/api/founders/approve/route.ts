import { NextRequest, NextResponse } from "next/server";
import { founderGate } from "@/lib/founder";
import { readAcct, setApproved, StoreUnavailable, FREE_SELF_TERMS } from "@/lib/caseload";

/**
 * POST /api/founders/approve { email, approved? } → { ok, email, approved }
 *
 * The founder's hand approval of a clinician's OWN free Premium when they
 * have no work email (lib/workEmail says why the work email is asked for at
 * all). /leads.html drives it: the clinicians table shows who asked, and the
 * Approve button calls this. `approved: false` undoes a mis-click.
 *
 * ONLY FOR THE 24 TO 29 SEP 2026 ACCOUNTS. They were told their own Premium
 * was free with a work email or an approval. From 29 Sep it is "Sona Premium
 * for you", bought, and an approval would change nothing for anyone else
 * (lib/caseload selfStatus reads it for those accounts alone), so this says
 * so instead of recording a click that looks like it worked. An account from
 * before 24 Sep needs no approval: its own Premium is free already.
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
    const acct = await readAcct(email);
    if (!acct) {
      return NextResponse.json({ ok: false, error: "No clinician account with that email." }, { status: 404 });
    }
    if (body.approved !== false && acct.terms !== FREE_SELF_TERMS) {
      return NextResponse.json({
        ok: false,
        error: Object.prototype.hasOwnProperty.call(acct, "terms")
          ? "They signed up after 29 Sep 2026: their own Premium is bought on the dashboard, not approved."
          : "They signed up before 24 Sep 2026: their own Premium is already free.",
      }, { status: 409 });
    }
  } catch (e) {
    if (e instanceof StoreUnavailable) return NextResponse.json({ ok: false, error: "The data store didn't answer." }, { status: 503 });
    throw e;
  }
  const approved = body.approved !== false;
  await setApproved(email, approved);
  return NextResponse.json({ ok: true, email, approved });
}
