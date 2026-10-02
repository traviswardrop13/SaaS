/**
 * The FAMILY pricing switches, server side. There are two: FREE_MODE (is
 * there a price at all) and, under it, WEB_SALES (may a family pay for it on
 * the website).
 *
 * `public/sona.js` owns `FREE_MODE` for the app itself. The Next.js half — the
 * landing page, /subscribe, and above all /api/checkout — runs in a different
 * world and cannot read a browser global, so the switch is mirrored here.
 *
 * Two copies of one rule drift, and drifted rules are how a paywall and
 * free-mode copy end up contradicting each other. `tests/freetest.mjs` fails
 * if these two disagree. That pin is the only reason a second copy is
 * acceptable at all — do not add a third. (WEB_SALES, below, is a second
 * switch with the same two homes, not a third copy of this one.)
 *
 * Since 24 Sep 2026 "off" means a FREE VERSION plus PREMIUM, not a wall:
 * daily speech practice (and released free-tier games) stays free for
 * every family, and what a family can buy here (while WEB_SALES, below, is
 * true) is Premium — every game — by the year (3 free days first) or by the
 * month (charged at purchase; back on sale 1 Oct 2026), at the prices
 * lib/charter.ts holds. While this is
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
export const FREE_MODE = false; // mirrors sona.js — Travis, 30 Sep 2026: "we add the paywall today"

/**
 * May a FAMILY start a Premium purchase on the website?
 *
 * Built on 1 Oct 2026 to be turned OFF (Travis, told that a family who pays
 * on the website has no cancel button and that a cancelled web plan stays
 * unlocked on the phone: "i dont want them paying on the website"): with it
 * `false` a family buys Premium in the iPhone and iPad app, through Apple,
 * and nowhere else.
 *
 * IT SHIPPED `true`, AND WAITS FOR TRAVIS'S WORD. The same night's review
 * found that the app on the App Store (1.0.4) carries no purchase plugin: it
 * has no buy button at all. With this false as well, no family could have
 * bought Premium anywhere, on the night his ad started. So the website keeps
 * selling until a build that can sell is in the store (and its product is
 * attached to RevenueCat's `full` entitlement; see NATIVE.md), or until he
 * says to turn it off anyway. Flipping it is this boolean and its mirror.
 *
 * It only means anything while FREE_MODE is false. While it is false:
 * /api/checkout refuses both plans before it touches Stripe (on the server,
 * for the reason given above: a bookmark, a stale tab or an old ad link
 * reaches the endpoint without any button), /api/charter answers with no
 * price, /subscribe and /families say where Premium is bought instead of
 * quoting the web price, and the Terms say it first and keep the web plans'
 * figures only as the terms of subscriptions already bought. Every one of them keeps its selling state
 * whole: turning the website back on is this boolean and its mirror, never a
 * copy rewrite.
 *
 * A rail off sale is not a cancelled subscription. Everyone who already pays
 * through Stripe keeps their plan, so the routes that serve them read NO
 * switch and must not start: /api/subscription (restore by email),
 * /api/checkout/session and the success page (the receipt for a Stripe form
 * opened before the flip and paid after it) and /api/portal.
 *
 * FAMILIES ONLY. The clinician plans (/api/slp/plan, lib/caseload.ts) are
 * still bought on the web and never read this.
 *
 * Mirrors `WEB_SALES` in `public/sona.js`, which the static pages read;
 * `tests/freetest.mjs` fails if the two disagree.
 */
export const WEB_SALES = true; // mirrors sona.js — built to go false (Travis, 1 Oct 2026: "i dont want them paying on the website"); on until the app can sell
