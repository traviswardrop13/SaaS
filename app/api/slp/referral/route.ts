import { NextRequest, NextResponse } from "next/server";
import { readSession, liveSession, kvConfigured } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { linkOrigin } from "@/lib/site";
import { refCodeFor, referralStats, REFERRAL_PAY, dollars } from "@/lib/referral";

/**
 * SHARE & EARN (REFER1, 20 Nov 2026): the signed-in clinician's own referral
 * link, and how many therapists it brought in. The first ask makes the code.
 * Open to a locked account too: sharing Sona needs no plan of your own.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let s;
  try { s = await liveSession(readSession(req)); } catch { s = null; }
  if (!s || !s.email) return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  const limited = await rateLimit(req, { key: "slpreferral", limit: 60, windowSec: 3600 });
  if (limited) return limited;
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "Couldn't load your link just now." }, { status: 503 });
  const code = await refCodeFor(s.email);
  if (!code) return NextResponse.json({ ok: false, error: "Couldn't load your link just now. Try again in a moment." }, { status: 503 });
  const stats = await referralStats(s.email);
  return NextResponse.json(
    {
      ok: true,
      link: linkOrigin(new URL(req.url).origin) + "/?ref=" + code,
      pay: REFERRAL_PAY,
      ...stats,
      monthly: dollars(stats.monthlyCents),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
