import { NextRequest, NextResponse } from "next/server";
import { founderGate, readLeads, readClinicians } from "@/lib/founder";

/**
 * FOUNDER VIEW OF EVERY LEAD — /leads.html reads this.
 *
 * Two lists, because they are two different truths:
 *  - `leads`: every email that reached /api/lead (the SLP sign-up, the app's
 *    setup, the Speech Check), newest first, with whether each list accepted
 *    it. Kept since 24 Sep 2026; nothing before that was stored.
 *  - `clinicians`: every SLP account in the store, however it was created —
 *    including the ones from before any list was wired.
 *
 * Behind FOUNDER_KEY (lib/founder). Emails of grown-ups only: the ledger never
 * held a child's details, and a clinician account holds the clinician's own
 * name, not their caseload's.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = founderGate(req);
  if (denied) return denied;
  const [leads, clinicians] = await Promise.all([readLeads(), readClinicians()]);
  return NextResponse.json({ ok: true, leads, clinicians }, { headers: { "Cache-Control": "no-store" } });
}
