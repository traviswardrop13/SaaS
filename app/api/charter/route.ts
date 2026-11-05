import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { FREE_MODE } from "@/lib/pricing";
import { WEB_SALES } from "@/lib/pricing";
import { charterSpots, CHARTER_CAP, CHARTER_PRICE, STANDARD_PRICE, CHARTER_LABEL, MONTHLY_PRICE } from "@/lib/charter";

/**
 * GET /api/charter -> { ok, free, webSales, cap, taken, left, open, source, price, standard, label, monthly }
 *
 * `webSales` (1 Oct 2026) says whether a family can pay on the website at
 * all (WEB_SALES in lib/pricing.ts). While it is false there is no web price
 * to quote, and the iPhone's price is App Store Connect's, so the answer
 * carries NO price fields and Stripe is not asked for a count nobody can
 * change: { ok, free: false, webSales: false, cap, taken: 0, left: 0,
 * open: false, source: "off" }. A reader that prints a figure must look at
 * `webSales === false` first, or it prints "undefined". `free` stays a
 * boolean in every answer: parents.html reads nothing else.
 *
 * `monthly` (1 Oct 2026) is the monthly plan's price, from the same constant
 * checkout charges, so the plan screen's monthly row shows what Stripe will
 * take. It has nothing to do with the charter: it never changes with the count.
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
    return NextResponse.json({ ok: true, free: true, webSales: WEB_SALES, cap: CHARTER_CAP, taken: 0, left: 0, open: false, source: "free" });
  }
  // Families do not pay on the website (Travis, 1 Oct 2026: "i dont want them
  // paying on the website"), so there is no web price and no charter offer to
  // describe: nobody new can take a spot. Answered before the count is asked
  // for, in the free answer's shape, with no figure a page could print. The
  // families who already hold the charter price keep it; that is Stripe's to
  // remember, not this route's to advertise. Cached at the edge like the
  // priced answer: speaksona.com asks this on every visit.
  if (!WEB_SALES) {
    return NextResponse.json(
      { ok: true, free: false, webSales: false, cap: CHARTER_CAP, taken: 0, left: 0, open: false, source: "off" },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  }
  const s = await charterSpots();
  return NextResponse.json(
    { ok: true, free: false, webSales: WEB_SALES, cap: s.cap, taken: s.taken, left: s.left, open: s.open, source: s.source,
      price: CHARTER_PRICE, standard: STANDARD_PRICE, label: CHARTER_LABEL, monthly: MONTHLY_PRICE },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
