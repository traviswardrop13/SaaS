// Parking: a `comingSoon: true` on a game's catalog line keeps it off Home
// and shut whatever the family has. No game was parked from 22 Oct 2026
// (Travis opened the eighteen rebuilt games at once: "turn on all 18
// games") until 5 Nov 2026, when four went back (Puppy Bath, Surprise Boxes,
// Fish Tank and Monster Makeover: Travis, after the game audit, "hide those
// 4"). The suites that pin what parking does serve a sona.js with these
// games parked, by exactly the edit that parks one; a game already parked in
// the real catalog is left as it is. A game's own suite plays its page with
// it unparked (`unparkedSona`), so a parked game is still tested whole.
import { readFileSync } from "node:fs";

export const PARK = ["peekaboo", "racecar", "balloon", "puppy"];

const catalogLine = (key) => new RegExp("^(\\s{4}" + key + ": \\{ name: [^\\n]*?tier: \"(?:free|premium)\", )(comingSoon: true, )?", "m");

export function isParked(source, key) {
  const m = source.match(catalogLine(key));
  if (!m) throw new Error("no catalog line for " + key);
  return !!m[2];
}

export function parkedSona(source, keys = PARK) {
  return keys.reduce((src, key) => isParked(src, key) ? src : src.replace(catalogLine(key), "$1comingSoon: true, "), source);
}

// A key with no catalog line (a story day's game: Light the Way, Wind-Up Toys,
// Puzzle Bridge, which the Say & Play harness also plays) has nothing to
// unpark, so it is passed over, where parking one is an error.
export function unparkedSona(source, keys = PARK) {
  return keys.reduce((src, key) => { const m = src.match(catalogLine(key)); return m && m[2] ? src.replace(catalogLine(key), "$1") : src; }, source);
}

// Serve a context (or page) the parked sona.js. `pub` is the public/ folder.
// A route added after a helper's own catch-all answers first.
export async function servePark(target, pub, keys = PARK) {
  const body = parkedSona(readFileSync(pub + "/sona.js", "utf8"), keys);
  await target.route(/\/sona\.js(\?.*)?$/, (route) => route.fulfill({ contentType: "application/javascript; charset=utf-8", body }));
}
