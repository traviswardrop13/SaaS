import { NextRequest, NextResponse } from "next/server";
import { configured, runDue } from "@/lib/nurture";
import { runReports } from "@/lib/report";
import { backfill, syncUnsubscribes } from "@/lib/contacts";

/**
 * Daily: sends the welcome series' day-after email to everyone it is due for
 * (lib/nurture.ts), and on Monday (Tuesday and Wednesday catch up) last week's progress
 * report to every household that asked for it (lib/report.ts). Same auth as
 * /api/cron/weekly — the Vercel cron bearer, or FOUNDER_KEY for a manual run.
 * A manual run with ?report=1 sends the report on any day (still once an
 * address a week).
 *
 * The email list (lib/contacts.ts, 16 Oct 2026) has two parts. First, Kit's
 * leavers once and the unsubscribe check both ways (45 seconds at most), so
 * nobody who left a broadcast gets the emails below. Last, with the time
 * that is left, a batch of the addresses Sona held before Resend had the
 * list. Neither is ever a reason for the emails not to go.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const started = Date.now();
  const auth = req.headers.get("authorization") || "";
  const keyIn = req.headers.get("x-founder-key") || req.nextUrl.searchParams.get("key") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  const founderKey = process.env.FOUNDER_KEY || "";
  const okCron = Boolean(cronSecret) && auth === `Bearer ${cronSecret}`;
  const okManual = Boolean(founderKey) && keyIn === founderKey;
  if (!okCron && !okManual) return NextResponse.json({ ok: false }, { status: 401 });
  if (!configured()) {
    // names only, never values: this is how a founder finds out why no
    // welcome email went out
    const missing = ["RESEND_API_KEY", "UNSUB_SECRET", "EMAIL_POSTAL"].filter((k) => !(process.env[k] || "").trim());
    return NextResponse.json({ ok: false, error: "Not set in Vercel: " + missing.join(", ") }, { status: 500 });
  }
  const said = (e: unknown) => ({ ok: false, detail: e instanceof Error ? e.message : String(e) });
  let unsub: unknown = null, older: unknown = null;
  try { unsub = await syncUnsubscribes({ deadline: started + 45000 }); } catch (e) { unsub = said(e); }
  // stop sending well before maxDuration, so no address is left claimed and unsent
  const r = await runDue(undefined, undefined, undefined, { deadline: started + 150000 });
  const report = await runReports(undefined, undefined, undefined, { force: okManual && req.nextUrl.searchParams.get("report") === "1", deadline: started + 250000 });
  try { older = await backfill({ deadline: started + 265000 }); } catch (e) { older = said(e); }
  return NextResponse.json({ ok: true, ...r, report, list: { unsub, older } });
}
