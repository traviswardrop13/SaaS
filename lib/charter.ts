import Stripe from "stripe";

/**
 * THE CHARTER PRICE — $59.99 a year for the first 50 families, then $99.99.
 *
 * Travis (19 Sep 2026): show the current price as a founding discount from
 * the price Sona will charge once it has earned it. This file is what makes
 * that claim TRUE rather than decorative, and the difference matters here
 * more than in most apps: this repo already banned one struck-through price
 * ($119.88) because it anchored against a number nobody could pay. A charter
 * price is honest only if spot 51 really is charged the standard price, and
 * /api/checkout reads THIS count to decide — so the claim is true by
 * construction, the same way "no audio leaves the device" is true because
 * there is no code path that could send any.
 *
 * NAMING. This app already has "founding families": the SLP-referred cohort
 * who get Sona free, forever, with a "Founding family" banner on Home. A paid
 * tier called "founding" beside a free cohort called "founding" is a support
 * ticket waiting to happen, so the internal name is CHARTER throughout and the
 * user-facing word is ONE constant below. Change the constant, not the code.
 *
 * WHAT COUNTS AS A TAKEN SPOT. Every yearly subscription that ever completed
 * checkout (any status except the two "never finished paying" ones), unless
 * it was sold at the standard price. Everyone who subscribed before this file
 * existed paid $59.99 or less and keeps that price for life regardless — a
 * Stripe subscription carries its own price — so counting them is honest,
 * and it fills the spots FASTER, which is the safe direction for a promise
 * that says "first 50". A trial that was cancelled still consumed its spot.
 *
 * THE COUNT IS NEVER GUESSED. When Stripe cannot be reached the offer stays
 * OPEN (a family is never charged more because our lookup failed) and the
 * result says so in `source`, so a surface can decline to print a number it
 * cannot stand behind.
 */
export const CHARTER_CAP = 50;
export const CHARTER_CENTS = 5999;
export const STANDARD_CENTS = 9999;
export const CHARTER_LABEL = "Charter"; // the one user-facing word; "Founding" is taken by the free cohort
export const TRIAL_DAYS = 3;

export const CHARTER_PRICE = "$59.99";
export const STANDARD_PRICE = "$99.99";
// $99.99 / 12 = $8.3325. Never "$8.33 a month" — that would imply $99.96 a
// year, the same off-by-a-few-cents overclaim "$4.99" was banned for.
export const STANDARD_PER_MONTH = "under $8.50 a month";
export const CHARTER_PER_MONTH = "under $5 a month";

export type Spots = {
  cap: number;
  taken: number;
  left: number;
  open: boolean;              // may the next buyer have the charter price?
  source: "stripe" | "fallback";
  at: number;
};

let memo: Spots | null = null;
const MEMO_MS = 60_000;

// The Search API's status filter; `incomplete` and `incomplete_expired` are
// checkouts that never finished paying and are not spots.
const QUERY = "status:'active' OR status:'trialing' OR status:'past_due' OR status:'canceled' OR status:'unpaid'";

function yearly(s: Stripe.Subscription): boolean {
  const it = s.items?.data?.[0];
  return it?.price?.recurring?.interval === "year";
}

/** How many of the charter spots are taken, from Stripe, memoised for a minute. */
export async function charterSpots(client?: Stripe): Promise<Spots> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo;
  const key = process.env.STRIPE_SECRET_KEY;
  const fallback: Spots = { cap: CHARTER_CAP, taken: 0, left: CHARTER_CAP, open: true, source: "fallback", at: Date.now() };
  if (!key && !client) return (memo = fallback);
  try {
    const stripe = client || new Stripe(key as string);
    let taken = 0;
    let page: string | undefined;
    // Three pages of a hundred is 300 subscriptions — far past a cap of 50,
    // and the loop stops the moment the cap is reached anyway.
    for (let guard = 0; guard < 3; guard++) {
      const res = await stripe.subscriptions.search({ query: QUERY, limit: 100, page });
      for (const s of res.data) {
        if (!yearly(s)) continue;                        // the retired monthly plan is not a spot
        if (s.metadata?.tier === "standard") continue;   // sold at full price, after the cap
        taken++;
      }
      if (taken >= CHARTER_CAP || !res.has_more || !res.next_page) break;
      page = res.next_page;
    }
    const left = Math.max(0, CHARTER_CAP - taken);
    return (memo = { cap: CHARTER_CAP, taken, left, open: left > 0, source: "stripe", at: Date.now() });
  } catch (e) {
    // A lookup failure must never cost a family $40. Stay open, say so.
    console.error("charterSpots: Stripe lookup failed, offer stays open", e instanceof Error ? e.message : e);
    return (memo = fallback);
  }
}

/** Test seam: forget the memo so a suite can exercise both states. */
export function _resetCharterMemo(): void { memo = null; }
