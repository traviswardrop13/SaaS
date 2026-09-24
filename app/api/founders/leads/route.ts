import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { kvCmd, kvConfigured } from "@/lib/slpAuth";

/**
 * FOUNDER VIEW OF EVERY LEAD — /leads.html reads this.
 *
 * Two lists, because they are two different truths:
 *  - `leads`: every email that reached /api/lead (the web app's setup, the
 *    Speech Check, the SLP sign-up), newest first, with whether GoHighLevel
 *    accepted it. Kept since 24 Sep 2026; nothing before that was stored.
 *  - `clinicians`: every SLP account in the store, however it was created —
 *    including the ones from before the CRM was wired, which never reached it.
 *
 * Behind FOUNDER_KEY, like the other founder routes, compared in constant
 * time, and taken from a header so it stays out of URLs and logs. Emails of
 * grown-ups only: the ledger never held a child's details, and a clinician
 * account holds the clinician's own name, not their caseload's.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function keyOk(given: string, need: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(need);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const need = process.env.FOUNDER_KEY || "";
  if (need.length < 12) {
    return NextResponse.json({ ok: false, error: "Set FOUNDER_KEY (12+ characters) in Vercel, then redeploy." }, { status: 503 });
  }
  const given = req.headers.get("x-founder-key") || "";
  if (!keyOk(given, need)) return NextResponse.json({ ok: false, error: "Wrong key." }, { status: 401 });
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "No data store is connected." }, { status: 503 });

  const leads: unknown[] = [];
  const raw = ((await kvCmd(["LRANGE", "leads:all", 0, 9999])) as string[] | undefined) || [];
  for (const s of raw) { try { leads.push(JSON.parse(s)); } catch { /* skip a bad row */ } }

  // Every clinician account. SCAN, not KEYS, so a large store is walked in
  // pages instead of blocking it; capped at 5000 accounts.
  const clinicians: Record<string, unknown>[] = [];
  let cursor = "0";
  let rounds = 0;
  do {
    const res = (await kvCmd(["SCAN", cursor, "MATCH", "slpacct:*", "COUNT", 200])) as [string, string[]] | undefined;
    if (!res) break;
    cursor = String(res[0]);
    for (const key of res[1] || []) {
      if (clinicians.length >= 5000) break;
      try {
        const a = JSON.parse(String(await kvCmd(["GET", key])));
        clinicians.push({
          email: a.email || key.slice("slpacct:".length),
          name: a.name || "",
          clinic: a.clinic || "",
          createdAt: a.createdAt || "",
          source: a.source || "",
          inCrm: a.crmAt ? "yes" : "not yet",
        });
      } catch { /* skip */ }
    }
    rounds++;
  } while (cursor !== "0" && rounds < 200 && clinicians.length < 5000);
  clinicians.sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));

  return NextResponse.json({ ok: true, leads, clinicians }, { headers: { "Cache-Control": "no-store" } });
}
