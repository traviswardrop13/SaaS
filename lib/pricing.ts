/**
 * The FAMILY paywall switch, server side.
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
 * Since 24 Sep 2026 "off" means a FREE VERSION plus PREMIUM, not a wall:
 * daily speech practice (and released free-tier games) stays free for
 * every family, and what a family can buy here is Premium — every game — on
 * the one yearly plan, at the price lib/charter.ts decides. While this is
 * true instead, /api/checkout refuses to create a Stripe session. Refusing on
 * the SERVER is the point: hiding a button still leaves the endpoint reachable
 * from a bookmark, a stale tab, an old ad, or a shared link, and a free app
 * that can still take money from a parent is worse than one that never went
 * free at all.
 *
 * The CLINICIAN plan ("Sona Premium for your caseload", lib/caseload.ts) is a
 * separate product on a separate route and deliberately does not read this
 * switch: it pays for a caseload's families, whatever families pay today.
 */
export const FREE_MODE = true; // mirrors sona.js — Travis, 24 Sep 2026: restore family access to free
