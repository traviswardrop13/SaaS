import { NextRequest, NextResponse } from "next/server";
import { founderGate, readLeads, readClinicians, LIST_SYNCED } from "@/lib/founder";
import { kvCmd } from "@/lib/slpAuth";
import { readPlans } from "@/lib/revenuecat";

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
 *  - `inList`: how many addresses Resend's contacts hold (lib/contacts),
 *    from the lead door and the daily backfill alike; null if the store did
 *    not answer.
 *  - `plans`: what RevenueCat last told Sona about each address's Premium
 *    in the app (lib/revenuecat.ts: free days, paid, cancelled, a payment
 *    problem, ended, moved to another device), for the page's Premium column.
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
  const [leads, clinicians, n, plans] = await Promise.all([readLeads(), readClinicians(), kvCmd(["SCARD", LIST_SYNCED]).catch(() => undefined), readPlans()]);
  const inList = typeof n === "number" ? n : null;
  return NextResponse.json({ ok: true, leads, clinicians, inList, plans }, { headers: { "Cache-Control": "no-store" } });
}
