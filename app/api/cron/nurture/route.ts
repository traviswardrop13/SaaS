import { NextRequest, NextResponse } from "next/server";
import { configured, runDue } from "@/lib/nurture";
import { runReports } from "@/lib/report";
import { runRc } from "@/lib/revenuecat";

/**
 * Daily: sends the notes RevenueCat's news has queued ("Your free days end
 * soon", "We miss you at Sona": lib/revenuecat.ts), the welcome series'
 * day-after email to everyone it is due for (lib/nurture.ts), and on Monday
 * (Tuesday and Wednesday catch up) last week's progress report to every
 * household that asked for it (lib/report.ts). Same auth as
 * /api/cron/weekly — the Vercel cron bearer, or FOUNDER_KEY for a manual run.
 * A manual run with ?report=1 sends the report on any day (still once an
 * address a week).
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
  // the free-days note first: it has one day to go out, and a big welcome
  // batch must not use up its time. `now` is when the run started, so a
  // note queued a few seconds after 16:00 waits for tomorrow's run, never
  // for the one after. Stop sending well before maxDuration, so no address
  // is left claimed and unsent.
  const rc = await runRc(undefined, undefined, started, { deadline: started + 120000 });
  const r = await runDue();
  const report = await runReports(undefined, undefined, undefined, { force: okManual && req.nextUrl.searchParams.get("report") === "1", deadline: started + 250000 });
  return NextResponse.json({ ok: true, ...r, rc, report });
}
