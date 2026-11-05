// No game is parked since 22 Oct 2026 (Travis opened the eighteen rebuilt
// games at once: "turn on all 18 games"). Parking still works: a
// `comingSoon: true` on a game's catalog line keeps it off Home and shut
// whatever the family has. The suites that pin that serve a sona.js with
// these games parked again, by exactly the edit that parks one.
import { readFileSync } from "node:fs";

export const PARK = ["peekaboo", "racecar", "balloon", "puppy"];

export function parkedSona(source, keys = PARK) {
  return keys.reduce((src, key) => {
    const next = src.replace(new RegExp("^(\\s{4}" + key + ": \\{ name: [^\\n]*?tier: \"(?:free|premium)\", )(?!comingSoon)", "m"), "$1comingSoon: true, ");
    if (next === src) throw new Error("no catalog line to park for " + key);
    return next;
  }, source);
}

// Serve a context (or page) the parked sona.js. `pub` is the public/ folder.
// A route added after a helper's own catch-all answers first.
export async function servePark(target, pub, keys = PARK) {
  const body = parkedSona(readFileSync(pub + "/sona.js", "utf8"), keys);
  await target.route(/\/sona\.js(\?.*)?$/, (route) => route.fulfill({ contentType: "application/javascript; charset=utf-8", body }));
}
