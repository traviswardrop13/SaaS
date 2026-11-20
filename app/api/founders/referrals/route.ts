import { NextRequest, NextResponse } from "next/server";
import { founderGate } from "@/lib/founder";
import { kvCmd } from "@/lib/slpAuth";
import { referralStats, REFERRERS, dollars } from "@/lib/referral";

/**
 * FOUNDER VIEW OF SHARE & EARN (REFER1, 20 Nov 2026): every clinician whose
 * link brought in another clinician, how many signed up, how many are on a
 * free trial, how many pay, and what they earn this month ($8 each paying).
 * Travis pays by hand from this list. Behind FOUNDER_KEY, from a header.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const stop = founderGate(req);
  if (stop) return stop;
  const raw = await kvCmd(["SMEMBERS", REFERRERS]);
  const who = Array.isArray(raw) ? (raw as unknown[]).filter((m): m is string => typeof m === "string").slice(0, 500) : [];
  const rows = [];
  let owed = 0;
  for (const email of who) {
    const st = await referralStats(email);
    owed += st.monthlyCents;
    rows.push({ email, ...st, monthly: dollars(st.monthlyCents) });
  }
  rows.sort((a, b) => b.monthlyCents - a.monthlyCents || b.signedUp - a.signedUp);
  return NextResponse.json({ ok: true, rows, owedCents: owed, owed: dollars(owed) }, { headers: { "Cache-Control": "no-store" } });
}
