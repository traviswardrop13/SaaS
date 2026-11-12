import { NextResponse } from "next/server";
import { dashboardOpen, StoreUnavailable, PRO_NAME } from "@/lib/caseload";

/**
 * THE DASHBOARD'S LOCK, held on the server (Travis, 12 Nov 2026: the price is
 * "for the dashboard and unlimited accounts for clients"). A clinician whose
 * account was made from 12 Nov 2026 sees their caseload, adds children and
 * assigns homework only while Sona Pro is on (trialing, active, or in the
 * card-retry grace). Every older account keeps the free dashboard it was
 * promised, and dashboardOpen() answers that from the account stamp alone,
 * with no Stripe call.
 *
 * Held here and not only on the page, because the page is static and its lock
 * is a picture; the data is what the plan sells.
 *
 * NEVER ON A DELETE. Removing a child, an invite or homework always works,
 * paid or not: a clinician who stops paying must still be able to take a
 * child's practice off Sona, and a district privacy officer checks exactly
 * that. Nor on the family's side (redeem, claim, the device's sync, covered):
 * a family's free version never depends on what their clinician pays.
 *
 * null = go ahead; otherwise the response to send.
 */
export async function dashboardGate(email: string): Promise<NextResponse | null> {
  try {
    if (await dashboardOpen(email)) return null;
  } catch (e) {
    if (e instanceof StoreUnavailable) {
      return NextResponse.json({ ok: false, error: "Couldn't check your plan just now — try again in a moment." }, { status: 503 });
    }
    throw e;
  }
  return NextResponse.json(
    { ok: false, needPlan: true, error: "Your dashboard comes with " + PRO_NAME + ". Start it on the " + PRO_NAME + " page to see your caseload." },
    { status: 402 },
  );
}
