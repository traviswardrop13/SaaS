import { NextRequest, NextResponse } from "next/server";
import { configured, runDue } from "@/lib/nurture";
import { runReports } from "@/lib/report";
import { syncContacts } from "@/lib/contacts";

/**
 * Daily: sends the welcome series' day-after email to everyone it is due for
 * (lib/nurture.ts), and on Monday (Tuesday and Wednesday catch up) last week's progress
 * report to every household that asked for it (lib/report.ts). Same auth as
 * /api/cron/weekly — the Vercel cron bearer, or FOUNDER_KEY for a manual run.
 * A manual run with ?report=1 sends the report on any day (still once an
 * address a week).
 *
 * First, the email list (lib/contacts.ts, 16 Oct 2026): Resend's
 * unsubscribes join Sona's own, so nobody who left a broadcast gets the
 * emails below; Kit's unsubscribes once; then a batch of the addresses Sona
 * held before Resend had the list. A minute at most, and never a reason
 * for the emails not to go.
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
  let list: unknown = null;
  try { list = await syncContacts({ deadline: started + 60000 }); } catch (e) { list = { ok: false, detail: e instanceof Error ? e.message : String(e) }; }
  const r = await runDue();
  // stop sending well before maxDuration, so no address is left claimed and unsent
  const report = await runReports(undefined, undefined, undefined, { force: okManual && req.nextUrl.searchParams.get("report") === "1", deadline: started + 250000 });
  return NextResponse.json({ ok: true, ...r, report, list });
}
