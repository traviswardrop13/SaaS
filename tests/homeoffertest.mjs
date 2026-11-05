// THE OFFER, ONCE, FROM HOME (Travis, 13 Oct 2026: "yeah, let's show the
// offer again"). Some families' Home locked without them ever seeing the free
// days: set up on the App Store's 1.0.4 (no purchase plugin, so setup skipped
// the price and opened the free games) after the trial-first build stamped
// them "post"; the update to a build that can buy took the free version away,
// and every game greyed out with no offer on screen.
//
// This plays the fix on the shared fake phone (tests/_phone.mjs):
//   - that household, on its first Home load in a build that can buy, is
//     taken to the plan screen once (/subscribe.html?from=home), the same
//     screen a grey-game tap opens, with no grown-ups check; Home is never
//     painted on that load; X comes back to Home and stays there, and no
//     later load opens it again;
//   - a store that never answers ("We couldn't reach the App Store.") does
//     NOT spend the one showing: it marks that visit, so X never loops back
//     into it, and the next launch tries again (at most three tries in all);
//   - a priced card counts its impression and its "Not now" as the Home door;
//   - an Apple ID that already has Premium is found first: Home, no offer;
//   - it never opens for a household that keeps the free version, a
//     clinician's link or own setup, a phone that cannot buy, a browser, a
//     founder, a trial, a phone that already showed the offer (or a priced
//     card), the grown-ups bounce, a ?locked= note, a preview, or a phone not
//     set up yet (setup's job);
//   - setup's own price spends it, so its X never leads into a second offer;
//   - Sona.homeOfferDue only reads, and the mark never travels in a backup.
import { readFileSync } from "fs";
import { chromium, launchOpts, ROOT } from "./_env.mjs";
import { serve, open, calm, STORES } from "./_phone.mjs";

const { base: BASE, hits, close } = await serve();
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(detail))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, e.stack); } }

const KEY = "sona.offerseen.v1", SEEN = "sona.planmoment.v1";
const STUCK = { app: "buy", stamp: "post", setUp: true, noGate: true, homeOffer: true, store: STORES.monthlyFree };
async function fresh(cfg) {
  const o = await open(browser, BASE, cfg);
  await o.context.route("**/onboarding.html", (r) => r.fulfill({ contentType: "text/html", body: '<!doctype html><title>setup</title><p>setup</p><script src="/sona.js"></script>' }));
  return o;
}
const offers = (requests) => requests.filter((r) => /\/subscribe\.html/.test(r.url)).length;
const home = (page) => page.waitForFunction(() => document.querySelectorAll("#activityGroups .game-card").length > 0 && !document.getElementById("libraryApp").hidden);
const priced = (page) => page.waitForFunction(() => /^(free|paid)$/.test(document.getElementById("iapCard").getAttribute("data-state")));
const state = (page) => page.evaluate(([KEY, SEEN]) => ({
  key: localStorage.getItem(KEY), spent: localStorage.getItem(SEEN),
  offer: document.body.classList.contains("offer"),
  title: (document.getElementById("offerTitle") || {}).textContent || "",
  events: ((window.__phone && window.__phone.events) || []).map((e) => [e.name, e.props]),
  locked: [...document.querySelectorAll("#activityGroups .game-card")].filter((b) => b.dataset.locked === "false").length,
}), [KEY, SEEN]);

try {
  // ── 1. the stuck household: 1.0.4, then an update that can buy ──
  await scenario("the stuck household", async () => {
    const { context, page, errors, requests } = await fresh(Object.assign({}, STUCK, { app: "nobuy" }));
    try {
      await page.goto(BASE + "/today.html"); await home(page); await page.waitForTimeout(600);
      const before = await state(page);
      ok("on 1.0.4 (no purchase plugin) the household has the free version: Home, no offer, nothing marked",
        /\/today\.html$/.test(page.url()) && offers(requests) === 0 && !before.key && before.locked > 0, { url: page.url(), before });
      // the App Store updates the app to a build that can buy
      await page.evaluate(() => window.__phone.set({ app: "buy", wait: { info: 1500 } }));
      await page.goto(BASE + "/today.html");
      await page.waitForTimeout(500);
      const held = await page.evaluate(() => ({ hidden: document.getElementById("libraryApp").hidden, url: location.pathname }));
      ok("after the update, while the store is asked, Home is not painted (nothing to tap, nothing moves)", held.hidden === true && held.url === "/today.html", held);
      await page.waitForURL(/\/subscribe\.html\?from=home$/, { timeout: 6000 });
      await page.waitForFunction(() => document.body.classList.contains("offer"));
      await priced(page); await page.waitForTimeout(300);
      const s = await state(page);
      ok("…then the plan screen opens as the offer, from Home, with no grown-ups check in front of it",
        s.offer && /\/subscribe\.html\?from=home$/.test(page.url()) && !requests.some((r) => /gate=1/.test(r.url)), { offer: s.offer, url: page.url() });
      ok("…headed \"Unlock every game for Mia\"", s.title === "Unlock every game for Mia", s.title);
      ok("…and the one showing is spent on this phone for good, with the priced card counted once", !!s.key && !/^try:/.test(s.key) && !!s.spent, s);
      const viewed = s.events.filter((e) => e[0] === "paywall viewed");
      ok("…\"paywall viewed\" names the Home door", viewed.length === 1 && viewed[0][1].source === "from-home", viewed);
      await calm(page);
      await page.locator("#declineLink").click();
      await page.waitForURL(/\/today\.html$/); await home(page);
      await page.waitForTimeout(3000);
      const back = await state(page);
      ok("X goes Home and stays there, every game still locked", /\/today\.html$/.test(page.url()) && back.locked === 0 && offers(requests) === 1, { url: page.url(), locked: back.locked, offers: offers(requests) });
      // sona.js's own beacon, sent as the page leaves
      const dismissed = hits.filter((h) => h.path === "/api/track" && /"offer dismissed"/.test(h.body)).map((h) => JSON.parse(h.body));
      ok("…and \"offer dismissed\" names the Home door", dismissed.length === 1 && dismissed[0].p.surface === "home", dismissed);
      await page.reload(); await home(page); await page.waitForTimeout(3000);
      ok("the next Home load does not open it again", /\/today\.html$/.test(page.url()) && offers(requests) === 1, { url: page.url(), offers: offers(requests) });
      ok("the stuck household: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });

  // ── 2. the store never answers: this visit only, then the next launch ──
  await scenario("the store is silent", async () => {
    const { context, page, errors, requests } = await fresh(Object.assign({}, STUCK, { products: "hang" }));
    try {
      await page.goto(BASE + "/today.html");
      await page.waitForURL(/\/subscribe\.html\?from=home$/, { timeout: 6000 });
      await page.waitForFunction(() => document.getElementById("iapCard").getAttribute("data-state") === "none", null, { timeout: 9000 });
      let s = await state(page);
      ok("a silent store: the offer frame is up, no price was painted, and only a try is counted (\"We couldn't reach the App Store.\" is not the one showing)",
        s.offer && s.key === "try:1" && !s.spent, s);
      await calm(page);
      await page.locator("#declineLink").click();
      await page.waitForURL(/\/today\.html$/); await home(page); await page.waitForTimeout(3000);
      ok("…X goes Home and stays: no loop back into the offer this visit", /\/today\.html$/.test(page.url()) && offers(requests) === 1, { url: page.url(), offers: offers(requests) });
      await page.reload(); await home(page); await page.waitForTimeout(2800);
      ok("…nor on a reload in the same visit", /\/today\.html$/.test(page.url()) && offers(requests) === 1, { url: page.url(), offers: offers(requests) });
      // the app is closed and opened again (a new visit), and the store answers now
      await page.evaluate(() => { sessionStorage.clear(); window.__phone.set({ products: "ok" }); });
      await page.goto(BASE + "/today.html");
      await page.waitForURL(/\/subscribe\.html\?from=home$/, { timeout: 6000 });
      await priced(page); await page.waitForTimeout(300);
      s = await state(page);
      ok("the next launch, with a store that answers: the offer opens once more, priced, and is spent for good",
        s.offer && offers(requests) === 2 && !!s.spent && !!s.key && !/^try:/.test(s.key), { offers: offers(requests), s });
      await calm(page);
      await page.locator("#declineLink").click();
      await page.waitForURL(/\/today\.html$/); await home(page);
      await page.evaluate(() => sessionStorage.clear());
      await page.reload(); await home(page); await page.waitForTimeout(2800);
      ok("…and never again, even on a later launch", /\/today\.html$/.test(page.url()) && offers(requests) === 2, { url: page.url(), offers: offers(requests) });
      ok("the store is silent: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });

  // ── 2b. more than one child: the household's, not the active child's ──
  await scenario("three children", async () => {
    const { context, page, errors, requests } = await fresh(Object.assign({}, STUCK, { setUp: false, kids: 3 }));
    try {
      await page.goto(BASE + "/today.html");
      await page.waitForURL(/\/subscribe\.html\?from=home$/, { timeout: 6000 });
      await priced(page);
      await calm(page);
      await page.locator("#declineLink").click();
      await page.waitForURL(/\/today\.html$/); await home(page); await page.waitForTimeout(2800);
      ok("three children (the newest not set up yet): the offer opens once for the household, and X stays Home",
        /\/today\.html$/.test(page.url()) && offers(requests) === 1, { url: page.url(), offers: offers(requests) });
      ok("three children: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });

  // ── 3. an Apple ID that already has Premium (reinstalled) ──
  await scenario("a payer who reinstalled", async () => {
    const { context, page, errors, requests } = await fresh(Object.assign({}, STUCK, { entitled: true }));
    try {
      await page.goto(BASE + "/today.html");
      await page.waitForTimeout(3500); await home(page);
      const s = await state(page);
      ok("the store finds the purchase first: Home, every game open, no offer and nothing spent",
        /\/today\.html$/.test(page.url()) && offers(requests) === 0 && s.locked > 0 && !s.key, { url: page.url(), offers: offers(requests), s });
      ok("a payer who reinstalled: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });

  // ── 4. never for these ──
  const NEVER = [
    ["a household that keeps the free version", { stamp: "kept" }],
    ["a family who joined through their speech therapist", { slp: true }],
    ["an app build that cannot buy (1.0.4)", { app: "nobuy" }],
    ["a browser (the website does not sell)", { app: null }],
    ["a founder", { founder: true }],
    ["a family in a trial", { local: { "sona.trial.v1": { start: Date.now(), days: 3 } } }],
    ["a phone that already painted a priced card", { local: { [SEEN]: "1" } }],
    ["a phone that already showed the offer", { local: { [KEY]: "1" } }],
    ["a clinician's own setup", { local: { "sona.profile.v1": { childName: "Ms. K", role: "slp", onboarded: true, focusSounds: ["R"] } } }],
    ["a clinician's own setup in a second slot, with a child active", { local: {
      "sona.kids.v1": { active: "", list: [{ slot: "", name: "Mia" }, { slot: "k2", name: "Ms. K" }], hi: 2 },
      "sona.profile.v1@k2": { childName: "Ms. K", role: "slp", onboarded: true, focusSounds: ["R"] } } }],
  ];
  for (const [label, extra, path = "/today.html"] of NEVER.concat([
    ["the grown-ups bounce (?gate=1)", {}, "/today.html?gate=1&to=%2Fsettings.html"],
    ["a ?locked= note", {}, "/today.html?locked=hoops"],
    ["a preview (?libraryPreview=1)", {}, "/today.html?libraryPreview=1"],
  ])) await scenario("never: " + label, async () => {
    const cfg = Object.assign({}, STUCK, extra);
    if (extra.app === null) delete cfg.app;
    const { context, page, errors, requests } = await fresh(cfg);
    try {
      await page.goto(BASE + path); await home(page); await page.waitForTimeout(2800);
      const s = await state(page);
      const keyWas = extra.local && extra.local[KEY];
      ok("never " + label + ": Home stays, no offer, and Home marks nothing",
        new URL(page.url()).pathname === "/today.html" && offers(requests) === 0 && (keyWas ? true : !s.key), { url: page.url(), offers: offers(requests), key: s.key });
      ok("never " + label + ": no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  await scenario("never: a phone not set up yet", async () => {
    const { context, page, errors, requests } = await fresh({ app: "buy", stamp: "post", homeOffer: true });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForURL(/\/onboarding\.html$/);
      const due = await page.evaluate(() => Sona.homeOfferDue());
      ok("a phone not set up goes to setup, not the offer (setup asks the price itself)", offers(requests) === 0 && due === false, { offers: offers(requests), due });
      ok("not set up: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });

  // ── 5. setup's own price spends it ──
  await scenario("setup's price spends the one showing", async () => {
    const { context, page, errors, requests } = await fresh(Object.assign({}, STUCK, { marker: true, noGate: false }));
    try {
      await page.goto(BASE + "/subscribe.html?setup=1"); await priced(page);
      ok("setup's price, once on screen, spends the Home offer too", !!(await state(page)).key);
      await calm(page);
      await page.locator("#declineLink").click();
      await page.waitForURL(/\/today\.html$/); await home(page); await page.waitForTimeout(3000);
      ok("…so its X goes Home and stays: no second offer", /\/today\.html$/.test(page.url()) && offers(requests) === 1, { url: page.url(), offers: offers(requests) });
      ok("setup's price: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });

  // ── 6. it only reads, and the mark stays on the phone ──
  await scenario("the rule only reads", async () => {
    const { context, page, errors } = await fresh(STUCK);
    try {
      await page.goto(BASE + "/__blank.html"); await page.waitForFunction(() => !!window.Sona);
      const r = await page.evaluate(([KEY]) => {
        const snap = () => JSON.stringify([Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]), Object.keys(sessionStorage).sort().map((k) => [k, sessionStorage.getItem(k)])]);
        const ev = () => ((window.__phone && window.__phone.events) || []).length;
        const b = snap(), e = ev();
        const due = [Sona.homeOfferDue(), Sona.homeOfferDue(), Sona.homeOfferDue()];
        const same = snap() === b && ev() === e;
        // a frame the store never priced: one try a visit, three in all
        Sona.offerSeen(false); const try1 = localStorage.getItem(KEY);
        Sona.offerSeen(false); const try1b = localStorage.getItem(KEY);
        const tabDue = Sona.homeOfferDue();
        sessionStorage.clear(); const nextDue = Sona.homeOfferDue();
        Sona.offerSeen(false); sessionStorage.clear(); Sona.offerSeen(false); sessionStorage.clear();
        const try3 = localStorage.getItem(KEY), capDue = Sona.homeOfferDue();
        // a definite answer spends it for good, and keeps the first time
        localStorage.removeItem(KEY); sessionStorage.clear();
        Sona.offerSeen(false); Sona.offerSeen(true); const first = localStorage.getItem(KEY);
        Sona.offerSeen(true); Sona.offerSeen(false); const again = localStorage.getItem(KEY);
        sessionStorage.clear(); const after = Sona.homeOfferDue();
        const backup = Sona.exportData();
        localStorage.removeItem(KEY);
        Sona.importData({ app: "sona", v: 1, data: { [KEY]: "123" } });
        return { due, same, try1, try1b, tabDue, nextDue, try3, capDue, first, again, after, exported: Object.prototype.hasOwnProperty.call(backup.data, KEY), imported: localStorage.getItem(KEY) };
      }, [KEY]);
      ok("Sona.homeOfferDue answers true for the stuck household and writes, sends and changes nothing", r.due.every((d) => d === true) && r.same, r);
      ok("an unpriced frame counts one try a visit, the rule is false for the rest of that visit and true on the next, and false after three tries",
        r.try1 === "try:1" && r.try1b === "try:1" && r.tabDue === false && r.nextDue === true && r.try3 === "try:3" && r.capDue === false, r);
      ok("Sona.offerSeen(true) marks the phone for good once (a later call keeps the first time), and the rule is false after", /^\d+$/.test(r.first || "") && r.first === r.again && r.after === false, r);
      ok("the mark never leaves in a backup, and a backup never brings it", !r.exported && r.imported === null, r);
      ok("the rule only reads: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });

  // ── 7. the source ──
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  const noExport = (sona.match(/const NO_EXPORT = \[[^\]]*\]/) || [""])[0], noImport = (sona.match(/const NO_IMPORT = \[[\s\S]*?\];/) || [""])[0];
  ok("sona.offerseen.v1 is on NO_EXPORT and on NO_IMPORT", noExport.includes('"' + KEY + '"') && noImport.includes('"' + KEY + '"'));
  ok("planShown is still the only writer of the priced-card mark", (sona.match(/localStorage\.setItem\(PLANSEEN/g) || []).length === 1 && /function planShown[\s\S]{0,200}localStorage\.setItem\(PLANSEEN/.test(sona));
  const body = (sona.match(/function homeOfferDue\(\) \{[\s\S]*?\n  \}/) || [""])[0];
  ok("homeOfferDue reads no address and calls no writer", body.length > 50 && !/location|setItem|removeItem|track\(|fetch|save\(/.test(body), body.slice(0, 120));
  const today = readFileSync(ROOT + "/today.html", "utf8"), sub = readFileSync(ROOT + "/subscribe.html", "utf8");
  ok("Home asks the rule before it is painted, and skips the bounce, ?locked= and a preview",
    /homeOfferDue\(\)[\s\S]{0,200}subscribe\.html\?from=home/.test(today) && /gate\|locked\|libraryPreview/.test(today) && /S\.homeOfferDue\(\)\)\{[\s\S]{0,300}return;\s*\}\s*app\.hidden=false;/.test(today));
  ok("the plan screen settles it the moment the offer frame is up, and again on each store answer",
    /classList\.add\("offer"\);[\s\S]{0,400}offerSettle\(\);/.test(sub) && /Sona\.planShown\("native"\)[\s\S]{0,80}\}\s*offerSettle\(\);/.test(sub) && /p\.why !== "timeout" && p\.why !== "error"/.test(sub));
} finally {
  await browser.close(); await close();
  console.log("\n" + (assertions - failures) + "/" + assertions + " passed");
  process.exit(failures ? 1 : 0);
}
