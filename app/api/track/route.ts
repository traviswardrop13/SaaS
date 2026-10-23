import { NextRequest, NextResponse } from "next/server";

/**
 * First-party telemetry relay for KID pages (COPPA posture).
 *
 * Kid-facing pages ship ZERO third-party scripts (progtest enforces it), so
 * practice events arrive here as a same-origin beacon and the SERVER forwards
 * them to PostHog. Hard whitelist on event names and properties; identity is
 * the anonymous family id (random device-minted, never a name/email); no body
 * is stored, nothing else is read. Always answers ok — telemetry must never
 * break practice.
 */
export const runtime = "nodejs";

const PH_KEY = "phc_xRPqirD2PznnvZrpeuLDwo7LtYegHsF2xWsDNLEEXdkw"; // publishable client token
const PH_HOST = "https://us.i.posthog.com";
// The daily dashboard's whole vocabulary. Adding here is a deliberate act —
// anything not listed is silently dropped, which is the COPPA posture: the
// relay can only ever say LESS than the page asked it to.
const EVENTS = new Set([
  "practice started", "practice completed",
  "rep goal met",         // daily rep target reached, no child details or rep counts
  "day goal done",        // the outcome proxy: a family finished all 5 rounds
  "slp code redeemed",    // which SLPs actually send families
  // The conversion funnel, added 18 Sep 2026. Without these the relay could
  // see a child practice and never see whether that turned into anything:
  "plan moment shown",    // the ask, fired once on the first completed run
  "trial started",        // the in-app 3-day clock begins — NOT a purchase
  "purchase completed",   // money committed (Apple or Stripe)
  "demo started",         // …and the other half of that rate
  "recap viewed",         // the parent read what their child did
  "offer dismissed",      // they said no, deliberately — which is not the same
                          // as never arriving, and the two were indistinguishable
  "demo completed",       // the free demonstration finished — the step the
                          // offer is supposed to follow, so without it the
                          // funnel cannot tell a family who saw the product
                          // from one who bounced before it started
  // Levels inside games (11 Oct 2026, LEVELS1): sent by a game page once per
  // load at Level 2 or 3, never by Home. It carries the game and the level
  // (2 or 3) and nothing else: no trophy count, no name, no age.
  "level played",
  "game opened",          // a game page opened for play (game key only): the
                          // games that skip the practice page are seen here
  // The Trophy Road (11 Oct 2026, CHEST1 / ROAD1 / MONTH1): sent by sona.js
  // when a child opens the day's chest, a road gift or a month gift, never by
  // Home. They carry nothing: no stop or step number (a stop is a lifetime
  // trophy count), no coins, no name.
  "chest opened",
  "adventure day done",   // QUEST1: today's daily-adventure quest finished (game key only)
  // The daily story (22 Oct 2026, STORY1): sent by adventure.html, the
  // story's own page, never by Home. Each carries the story's game key only.
  "adventure opened",          // the story's intro started
  "adventure ending watched",  // the story's last ending scene showed
  // FOUND1 (23 Oct 2026): a found story game played again from Home's row,
  // sent by that game's page (the story's game key only), never by Home.
  "story game replayed",
  "road gift opened",
  "month gift opened",
  // The Buddy Shop (11 Oct 2026, SHOP1): sent by sona.js when a child gets a
  // buddy, hat or place with coins. It carries the kind, the catalog id and
  // its price in coins (coins are never sold): no balance, no name.
  "shop item got",
  // The Practice Board (11 Oct 2026, BOARD2; built dark until Travis's go):
  // sent by sona.js when a grown-up's link puts children on the board, when
  // one leaves it, and when the board page shows it. They carry nothing: no
  // token, nickname, days or place.
  "board turned on",
  "board turned off",
  "board viewed",
]);
// `plan` and `surface` join the list for the events above, and `level` (2 or
// 3) for "level played". Still no name, no age, no email, no word a child
// said — an unlisted key is dropped silently, which is the whole point of an
// allow-list. `kind`, `item` and `cost` are the Buddy Shop's ("characters",
// "dragon", 150): a catalog entry and its coin price, never a balance.
const PROPS = new Set(["sound", "game", "duration_seconds", "attempts_count", "code", "plan", "surface", "source", "level", "kind", "item", "cost"]);

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text(); // sendBeacon posts text/plain
    if (!raw || raw.length > 2000) return NextResponse.json({ ok: true });
    const b = JSON.parse(raw) as { e?: string; p?: Record<string, unknown>; fid?: string };
    const event = String(b.e || "");
    const fid = String(b.fid || "");
    if (!EVENTS.has(event) || !/^[A-Za-z0-9_-]{8,40}$/.test(fid)) return NextResponse.json({ ok: true });
    const props: Record<string, unknown> = { native: true, source: "kid-page-relay" };
    for (const k of Object.keys(b.p || {})) {
      if (!PROPS.has(k)) continue;
      const v = (b.p as Record<string, unknown>)[k];
      if (typeof v === "number" && isFinite(v)) props[k] = Math.max(0, Math.min(100000, Math.round(v)));
      else if (typeof v === "string") props[k] = v.slice(0, 40);
    }
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 4000);
    await fetch(`${PH_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: PH_KEY, event, distinct_id: fid, properties: props }),
      signal: ctrl.signal,
    }).catch(() => {});
    clearTimeout(to);
  } catch {
    // swallow everything — this endpoint can never matter more than practice
  }
  return NextResponse.json({ ok: true });
}
