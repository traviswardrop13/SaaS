import { NextRequest, NextResponse } from "next/server";
import { founderGate, readLeads, readClinicians } from "@/lib/founder";
import { readPlans } from "@/lib/revenuecat";

/**
 * FOUNDER VIEW OF EVERY LEAD — /leads.html reads this.
 *
 * Two lists, because they are two different truths:
 *  - `leads`: every email that reached /api/lead (the SLP sign-up, the app's
 *    setup, the Speech Check), newest first. Kept since 24 Sep 2026; nothing
 *    before that was stored. Since 16 Oct 2026 this IS the email list.
 *  - `clinicians`: every SLP account in the store, however it was created —
 *    including the ones from before any list was wired.
 * And `plans`: what RevenueCat last told Sona about each address's Premium
 * in the app (lib/revenuecat.ts: free days, paid, cancelled, a payment
 * problem, ended), for the page's Premium column.
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
  const [leads, clinicians, plans] = await Promise.all([readLeads(), readClinicians(), readPlans()]);
  return NextResponse.json({ ok: true, leads, clinicians, plans }, { headers: { "Cache-Control": "no-store" } });
}
