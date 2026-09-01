/**
 * The pricing switch, server side.
 *
 * `public/sona.js` owns `FREE_MODE` for the app itself. The Next.js half — the
 * landing page, /subscribe, and above all /api/checkout — runs in a different
 * world and cannot read a browser global, so the switch is mirrored here.
 *
 * Two copies of one rule drift, and drifted rules are how a paywall and
 * free-mode copy end up contradicting each other. `tests/freetest.mjs` fails
 * if these two disagree. That pin is the only reason a second copy is
 * acceptable at all — do not add a third.
 *
 * While this is true, /api/checkout refuses to create a Stripe session.
 * Refusing on the SERVER is the point: hiding a button still leaves the
 * endpoint reachable from a bookmark, a stale tab, an old ad, or a shared
 * link, and a free app that can still take $59.99 from a parent is worse than
 * one that never went free at all.
 */
export const FREE_MODE = true;
