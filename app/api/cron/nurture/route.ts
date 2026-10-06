import { NextRequest, NextResponse } from "next/server";
import { configured, runDue } from "@/lib/nurture";

/**
 * Daily: sends the welcome series' day-after email to everyone it is due for
 * (lib/nurture.ts). Same auth as /api/cron/weekly — the Vercel cron bearer,
 * or FOUNDER_KEY for a manual run.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const keyIn = req.headers.get("x-founder-key") || req.nextUrl.searchParams.get("key") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  const founderKey = process.env.FOUNDER_KEY || "";
  const okCron = Boolean(cronSecret) && auth === `Bearer ${cronSecret}`;
  const okManual = Boolean(founderKey) && keyIn === founderKey;
  if (!okCron && !okManual) return NextResponse.json({ ok: false }, { status: 401 });
  if (!configured()) {
    return NextResponse.json({ ok: false, error: "Needs RESEND_API_KEY, UNSUB_SECRET and EMAIL_POSTAL." }, { status: 500 });
  }
  const r = await runDue();
  return NextResponse.json({ ok: true, ...r });
}
