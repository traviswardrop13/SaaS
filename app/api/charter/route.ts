import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { FREE_MODE } from "@/lib/pricing";
import { charterSpots, CHARTER_CAP, CHARTER_PRICE, STANDARD_PRICE, CHARTER_LABEL } from "@/lib/charter";

/**
 * GET /api/charter -> { ok, cap, taken, left, open, source, price, standard, label }
 *
 * The one number every price surface reads: how many charter spots are left.
 * The static app cannot import lib/charter.ts, so subscribe.html and
 * trial.html fetch this; the landing page calls charterSpots() directly.
 * It is public, carries nothing about anyone, and is memoised for a minute
 * upstream — so it can be cached briefly at the edge without going stale in
 * any way that matters for a cap of fifty.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, { key: "charter-spots", limit: 60, windowSec: 60 });
  if (limited) return limited;
  // While Sona is free there is no price, so there is no charter price.
  if (FREE_MODE) {
    return NextResponse.json({ ok: true, free: true, cap: CHARTER_CAP, taken: 0, left: 0, open: false, source: "free" });
  }
  const s = await charterSpots();
  return NextResponse.json(
    { ok: true, free: false, cap: s.cap, taken: s.taken, left: s.left, open: s.open, source: s.source,
      price: CHARTER_PRICE, standard: STANDARD_PRICE, label: CHARTER_LABEL },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
