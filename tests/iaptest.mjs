// Apple IAP rail (native shell): with a mocked Capacitor+Purchases bridge,
// subscribe.html must show the Apple paywall — $59.99/yr (3-day trial), the
// only plan since monthly was retired — with no Stripe cards (3.1.1 hygiene), the required
// Restore + Terms/Privacy links and full auto-renew terms; purchase →
// unlock on the "full" entitlement, restore → unlock, and today.html must
// quiet-sync entitlements on load. Web (no bridge) keeps the Stripe picker.
// SONA IS FREE (FREE_MODE on), so every paid assertion below runs behind the
// ?paid=1 / sona.paidui QA seam. That is the seam's whole job: the purchase
// rails stay exercised while nobody is charged, so pricing is one boolean away
// instead of one archaeology project away. The seam only affects VISIBILITY —
// it grants nothing and moves no money.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", woff2: "font/woff2" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8147, r));

const browser = await chromium.launch(launchOpts());
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
let errs = [];
page.on("pageerror", (e) => errs.push(e.message));
// Whether Sona is free TODAY is read from the source rather than hard-coded,
// so this suite never needs hand-editing when Travis flips the switch — which
// has now happened eleven times. Assertions that must hold in both states run
// through the ?paid=1 seam; this constant is only for the handful that ask
// what the live state actually is.
const IS_FREE_NOW = /const FREE_MODE = true;/.test(readFileSync(ROOT + "/sona.js", "utf8"));

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

// mocked native bridge: entitlement flips active after purchase/restore
await page.addInitScript(() => {
  // entitlement state persists across navigations via localStorage (init
  // scripts re-run per page load and would otherwise reset the mock)
  window.__iap = { purchases: 0, restores: 0, configured: 0 };
  const entitled = () => localStorage.getItem("__iapEntitled") === "1";
  const setEnt = (v) => localStorage.setItem("__iapEntitled", v ? "1" : "0");
  const info = () => ({ customerInfo: { entitlements: { active: entitled() ? { full: { isActive: true } } : {} } } });
  window.Capacitor = {
    isNativePlatform: () => true,
    Plugins: {
      Purchases: {
        configure: async () => { window.__iap.configured++; },
        getProducts: async ({ productIdentifiers }) => {
          const id = (productIdentifiers || [])[0] || "com.speaksona.app.annual";
          const price = id.indexOf("monthly") > -1 ? "$9.99" : "$59.99";
          return { products: [{ identifier: id, priceString: price }] };
        },
        purchaseStoreProduct: async () => { window.__iap.purchases++; setEnt(true); return info(); },
        restorePurchases: async () => { window.__iap.restores++; setEnt(true); return info(); },
        getCustomerInfo: async () => info(),
      },
    },
  };
  localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.freeera2.v1","done"); localStorage.setItem("sona.freeera3.v1","done"); localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", focusSounds: ["R"], onboarded: true }));
  sessionStorage.setItem("sona.gate.v1", String(Date.now()));
  sessionStorage.setItem("sona.paidui", "1");   // reveal the purchase rails; grants nothing
});

// ── native subscribe: Apple paywall only, all required furniture ──
await page.goto("http://localhost:8147/subscribe.html"); await page.waitForTimeout(900);
let t = await page.evaluate(() => ({
  iap: document.getElementById("iapCard").style.display,
  pick: document.getElementById("pickCard").style.display,
  founding: getComputedStyle(document.getElementById("foundingCard")).display,
  price: document.getElementById("iapPrice").textContent,
  body: document.getElementById("iapCard").textContent,
  restore: !!document.getElementById("iapRestore"),
}));
ok("shell shows the Apple paywall", t.iap === "block");
ok("Stripe cards never render in the shell", t.pick !== "block" && t.founding === "none");
ok("the live App Store price is painted onto the card", /\$59\.99/.test(t.price), String(t.price));
ok("required furniture: Restore + Terms + Privacy + auto-renew terms",
  t.restore && /Terms of Use/.test(t.body) && /Privacy/.test(t.body) && /renews unless canceled/.test(t.body));
// Apple requires the price, period and cancellation terms on the paywall itself
ok("yearly offer: price, trial and cancel terms all stated",
  /\$59\.99/.test(t.body) && /3 days free/i.test(t.body) && /cancel/i.test(t.body));
// Monthly was retired 18 Sep 2026. Apple's paywall must not show a product a
// tap cannot buy, and the retirement must not quietly drag the yearly price
// down with it — so this pins the ABSENCE of the tier and the survival of the
// one that is left.
ok("no retired monthly tier on the Apple paywall",
  !/\$9\.99/.test(t.body) && !/Subscribe monthly/i.test(t.body), t.body.slice(0, 140));
ok("SLP proof strip on the native paywall", /Rachel/.test(t.body) && /speech-language pathologist/.test(t.body));

// ── purchase → entitlement unlock → sub cached ──
await page.evaluate(() => document.getElementById("iapBuy").click());
await page.waitForTimeout(700);
t = await page.evaluate(() => ({
  n: window.__iap.purchases,
  sub: JSON.parse(localStorage.getItem("sona.sub.v1") || "{}"),
  card: document.getElementById("iapCard").style.display,
}));
ok("purchase drives Apple's sheet once", t.n === 1);
ok("entitlement unlocks the app (source: apple)", t.sub.active === true && t.sub.source === "apple");
ok("paywall dismisses on success", t.card === "none");

// The monthly BUTTON is gone, but the monthly PRODUCT ID is not: RevenueCat
// needs it to recognise someone who bought monthly before it was retired.
// Dropping it from sona.js would strand a paying subscriber behind a paywall.
{
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  ok("the monthly product id survives for RESTORE, though nothing sells it",
    /monthly: "com\.speaksona\.app\.monthly"/.test(sona),
    "an existing monthly subscriber must still be recognised on a reinstall");
  const sub = readFileSync(ROOT + "/subscribe.html", "utf8");
  ok("…and no surface offers it any more",
    !/iapBuyMo|buyMonth|planMonth|iapPlanMo/.test(sub),
    "a button that buys a retired plan is worse than no button");
}

// ── restore path ──
await page.evaluate(() => { localStorage.removeItem("sona.sub.v1"); localStorage.setItem("__iapEntitled", "0"); });
await page.goto("http://localhost:8147/subscribe.html"); await page.waitForTimeout(900);
await page.evaluate(() => document.getElementById("iapRestore").click());
await page.waitForTimeout(600);
t = await page.evaluate(() => ({ n: window.__iap.restores, sub: JSON.parse(localStorage.getItem("sona.sub.v1") || "{}"), msg: document.getElementById("iapMsg").textContent }));
ok("restore unlocks + confirms", t.n === 1 && t.sub.active === true && /Restored/.test(t.msg));

// ── web-purchase hand-off: paired Stripe sub in the shell = NO paywall ──
await page.evaluate(() => { localStorage.setItem("__iapEntitled", "0"); localStorage.setItem("sona.sub.v1", JSON.stringify({ active: true, source: "stripe", since: Date.now() })); });
await page.goto("http://localhost:8147/subscribe.html"); await page.waitForTimeout(900);
t = await page.evaluate(() => ({
  iap: document.getElementById("iapCard").style.display,
  pick: document.getElementById("pickCard").style.display,
  line: document.getElementById("planLine").textContent,
}));
ok("web-bought sub pairs into the shell: no paywall anywhere", t.iap !== "block" && t.pick !== "block" && /Active/.test(t.line));
// tripwires on the funnel's app half: code entry exists on onboarding's first
// screen, and goHome routes subscribers straight home (never the paywall)
{
  const obSrc = readFileSync(ROOT + "/onboarding.html", "utf8");
  ok("onboarding offers Have-a-code entry", /moveLink/.test(obSrc) && /Have a code\?/.test(obSrc));
  ok("onboarding goHome skips paywall for subscribers", /!\(Sona\.isSubscribed&&Sona\.isSubscribed\(\)\)/.test(obSrc));
}

// ── today.html quiet entitlement sync ──
await page.evaluate(() => { localStorage.removeItem("sona.sub.v1"); localStorage.setItem("__iapEntitled", "1"); });
await page.goto("http://localhost:8147/today.html"); await page.waitForTimeout(900);
t = await page.evaluate(() => JSON.parse(localStorage.getItem("sona.sub.v1") || "{}"));
ok("today quiet-syncs the entitlement in the shell", t.active === true && t.source === "apple");

// ── web (no bridge): Stripe picker untouched ──
const web = await browser.newPage({ viewport: { width: 390, height: 844 } });
await web.addInitScript(() => {
  localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.freeera2.v1","done"); localStorage.setItem("sona.freeera3.v1","done"); localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", focusSounds: ["R"], onboarded: true, earlyAdopter: false }));
  sessionStorage.setItem("sona.gate.v1", String(Date.now()));
  sessionStorage.setItem("sona.paidui", "1");
});
await web.goto("http://localhost:8147/subscribe.html"); await web.waitForTimeout(800);
t = await web.evaluate(() => ({ iap: document.getElementById("iapCard").style.display, pick: document.getElementById("pickCard").style.display }));
ok("web keeps Stripe picker, no Apple card", t.iap !== "block" && t.pick === "block");
t = await web.evaluate(() => ({ body: document.getElementById("pickCard").innerText }));
// ONE plan on the web card too. The two figures that left with monthly
// ($119.88, "save $59.89") were 12 x $9.99 and cannot be stated once nobody
// can buy the plan behind them — a strike-through against an unbuyable price
// is a fabricated anchor. The per-month reading survives on its own.
ok("web picker states the one plan honestly",
  /\$59\.99/.test(t.body) && /3 DAYS FREE/i.test(t.body), t.body.slice(0, 200));
ok("…with no retired monthly tier and no invented was-price",
  !/\$9\.99/.test(t.body) && !/\$119\.88/.test(t.body) && !/\$59\.89/.test(t.body),
  t.body.slice(0, 200));
ok("…and the honest per-month reading in its place",
  /under \$5 a month/i.test(t.body), t.body.slice(0, 200));

// ── the dated trial timeline, and the promises inside it ──
// A 3-row dated timeline is the strongest defuser of "I'll forget and get
// billed" (Blinkist/Monarch both lead with it). The rows are only worth having
// if every one of them is true, so this pins the SHAPE and the two claims that
// could go false: a reminder we cannot send, and a price that is not ours.
{
  const tl = await web.evaluate(() => {
    const el = document.getElementById("webTL");
    return {
      rows: el ? [...el.querySelectorAll(".tli")].map((r) => r.textContent.replace(/\s+/g, " ").trim()) : [],
      prose: (document.getElementById("trialMath") || {}).style?.display,
    };
  });
  ok("the trial is a dated 3-step timeline, not a sentence", tl.rows.length === 3, JSON.stringify(tl.rows));
  const all = tl.rows.join(" ");
  const dated = (tl.rows[0] || "").match(/[A-Z][a-z]+ \d{1,2}/) && (tl.rows[2] || "").match(/[A-Z][a-z]+ \d{1,2}/);
  ok("…with real dates on the first and last rows", !!dated, JSON.stringify(tl.rows));
  ok("…saying nothing is charged today, and naming what starts on day 3",
    /nothing is charged today/i.test(all) && /\$59\.99/.test(all), all.slice(0, 200));
  ok("…and the prose line steps aside so the page says it once", tl.prose === "none", String(tl.prose));
  // THE LOAD-BEARING ONE. There is no trial webhook and no trial mailer in
  // this repo: a "we'll email you before it starts" row would be a promise the
  // code cannot keep, on the screen that takes the money.
  ok("the timeline never promises a reminder Sona cannot send",
    !/(email|e-mail|text|notify|remind)/i.test(all),
    "no Stripe trial_will_end handler and no trial mailer exists — ship one FIRST, then say it: " + all.slice(0, 160));
}
await web.close();

// ── the credential on the paywall says only what is verified ──
// Rachel holds an Idaho CF licence (confirmed 1 Sep 2026), so "licensed" is
// true and is used. She is a Clinical Fellow — master's complete, supervised
// fellowship year in progress — and does NOT hold ASHA's CCC. The CCC is the
// claim to get right: it is a trademarked certification, it is checkable, and
// "board-certified (CCC-SLP)" shipped once on the page that takes money.
{
  const sub = readFileSync(ROOT + "/subscribe.html", "utf8")
    .replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
  ok("no CCC or board-certified claim anywhere on the paywall",
    !/\bCCC\b|board.certified|ASHA.certified/i.test(sub),
    "she does not hold ASHA's CCC — this shipped once and must never return");
  ok("the verified licence claim is the one that is made",
    /licen[sc]ed pediatric speech-language pathologist/i.test(sub),
    "an Idaho CF licence makes this true — under-claiming is not a virtue when it is checkable");
  ok("…and the fellowship status is stated beside it, not hidden",
    /Clinical Fellow/.test(sub),
    "another SLP reading this should know she is in her CF year; it costs nothing to say");
}

// ── PRICING IS LIVE: FREE_MODE off, 3-day trial, the gate is honest ──
{
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  // THE SWITCH PIN IS GONE FROM HERE, DELIBERATELY. It had flipped three times
  // in this file alone, and a test that must be hand-edited on every business
  // decision is a tax, not a guard. freetest.mjs owns the one assertion that
  // actually matters in both directions — that sona.js and lib/pricing.ts
  // agree — and every purchase assertion below runs through the ?paid=1 seam,
  // which makes them true whichever way the switch points. The seam only ever
  // controlled VISIBILITY: it grants nothing and moves no money.
  ok("the purchase rails are reachable for testing in either pricing state",
    /sessionStorage\.getItem\("sona\.paidui"\) === "1"\) return false;/.test(sona),
    "without the seam, half this suite can only be run by editing a constant");
  ok("isFree() short-circuits the gate before anything else can",
    /function gated\(\) \{\s*if \(isFree\(\)\) return false;/.test(sona),
    "if any check runs ahead of the switch, the switch is not the switch");
  ok("the trial is 3 days", /TRIAL_DAYS = 3/.test(sona));
  ok("the native shell gates like the web (old bypass gone)",
    !/if \(isNativeApp\(\)\) return false;/.test(sona),
    "the never-gate line predates the IAP rail — it made the App Store build free forever");
  ok("founding/SLP families never gate",
    /earlyAdopterAnyKid\(\)\) return false/.test(sona.replace(/\s+/g, " ")),
    "the free-forever promise IS the SLP channel");
  ok("the founding grant belongs to the HOUSEHOLD, not one child",
    /function earlyAdopterAnyKid[\s\S]{0,420}PKEY \+ "@" \+ slot/.test(sona),
    "earlyAdopter lives on the per-kid profile — a referred family's second child was paywalled");
  // the practice doors gate at load; trial.html routes the shell to Apple
  for (const pg of ["charge.html", "arcade-feed.html", "story.html"]) {
    const src = readFileSync(ROOT + "/" + pg, "utf8");
    ok(pg + " gates at page load", /Sona\.gated\(\)/.test(src) && /trial\.html/.test(src));
  }
  const trial = readFileSync(ROOT + "/trial.html", "utf8");
  ok("trial.html routes the shell to the Apple paywall, not back home",
    /location\.replace\("\/subscribe\.html"\)/.test(trial),
    "routing natives to today.html made an infinite gate loop");
  ok("trial page states the live prices", /\$59\.99/.test(trial) && /\$9\.99/.test(trial) && /3 days free/.test(trial));
  ok("…and still carries the free-mode bounce for the next flip",
    /Sona\.isFree\(\)\) location\.replace\("\/today\.html"\)/.test(trial),
    "inert while priced; deleting it is how a future free window ships a paywall link");
}

// ── an expired trial actually locks practice; a founding family sails through ──
const gatePg = await browser.newPage({ viewport: { width: 390, height: 844 } });
await gatePg.addInitScript(() => {
  sessionStorage.setItem("sona.paidui", "1");   // exercise the gate as if priced
  // seed-once: init scripts re-run on every navigation and would overwrite the
  // earlyAdopter flag the second half of this test sets
  if (!localStorage.getItem("sona.profile.v1")) {
    localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.freeera2.v1","done"); localStorage.setItem("sona.freeera3.v1","done"); localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: "7", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 4 * 86400000, days: 3 }));
    localStorage.setItem("sona.micok", "1");
  }
});
await gatePg.goto("http://localhost:8147/charge.html?game=arcade-slice.html"); await gatePg.waitForTimeout(700);
ok("expired trial bounces charge.html to the trial page", /trial\.html/.test(gatePg.url()), gatePg.url());
await gatePg.evaluate(() => { const p = JSON.parse(localStorage.getItem("sona.profile.v1")); p.earlyAdopter = true; localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.freeera2.v1","done"); localStorage.setItem("sona.freeera3.v1","done"); localStorage.setItem("sona.profile.v1", JSON.stringify(p)); });
await gatePg.goto("http://localhost:8147/charge.html?game=arcade-slice.html"); await gatePg.waitForTimeout(700);
ok("a founding family with the same expired trial is never locked", !/trial\.html/.test(gatePg.url()), gatePg.url());
await gatePg.close();

ok("no pageerrors", errs.length === 0, errs.join(" | "));
// ── THE FREE-ERA PROMISE, AND ITS BOUNDARY ──────────────────────────
// Sona shipped free, priced, and is free again. CLAUDE.md commits in writing
// that anyone who used Sona while it was FREE keeps it free — a promise made
// to the families of the FIRST free era. _grandfatherFreeEra() draws that line
// and it must draw it NOW, on a free build, because the only evidence that
// separates the two cohorts (an onboarded device carrying no stamp) is gone
// the moment this build reaches the phone. If this ever breaks it breaks a
// promise to real families, or silently extends it to everyone forever, so it
// is pinned here from both directions.
{
  // (1) a family already on the app before pricing, meeting a FREE build
  const ctxA = await browser.newContext();
  const pgA = await ctxA.newPage();
  await pgA.goto("http://localhost:8147/today.html");   // sona.js seeds nothing yet
  const before = await pgA.evaluate(() => {
    // rewind: pretend this device predates pricing — onboarded, never judged
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true }));
    localStorage.removeItem("sona.freeera.v1");
    return true;
  });
  await pgA.reload(); await pgA.waitForTimeout(500);    // note: no ?paid=1 — a plain free build
  const grand = await pgA.evaluate(() => ({
    stamp: localStorage.getItem("sona.freeera.v1"),
    early: Sona.getProfile().earlyAdopter,
  }));
  ok("a free-era family is grandfathered by a FREE build, not just a paid one",
    before && grand.stamp === "grandfathered" && grand.early === true, JSON.stringify(grand));
  // and the grant survives the day pricing returns
  const grandGate = await pgA.evaluate(() => {
    sessionStorage.setItem("sona.paidui", "1");
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 365 * 86400000, days: 3 }));
    return { stamp: localStorage.getItem("sona.freeera.v1"), gated: Sona.gated() };
  });
  ok("…and is never gated, a year after their trial would have died",
    grandGate.gated === false && grandGate.stamp === "grandfathered", JSON.stringify(grandGate));
  await ctxA.close();

  // (2) a family arriving DURING this free period. They are free because the
  // app is free — a different promise, and a revocable one. If they stamped
  // "grandfathered" instead, pricing could never reach anyone who joined now.
  const ctxB = await browser.newContext();
  const pgB = await ctxB.newPage();
  await pgB.goto("http://localhost:8147/today.html"); await pgB.waitForTimeout(400);
  const fresh = await pgB.evaluate(() => {
    Sona.saveProfile({ childName: "New", childAge: "7", focusSounds: ["R"], onboarded: true });
    return { stamp: localStorage.getItem("sona.freeera.v1"), early: Sona.getProfile().earlyAdopter, gated: Sona.gated() };
  });
  ok("a family who arrives during THIS free period is not grandfathered",
    fresh.stamp === "post" && !fresh.early, JSON.stringify(fresh));
  ok("…and opens on their own trial rather than a paywall", fresh.gated === false, JSON.stringify(fresh));
  const freshGate = await pgB.evaluate(() => {
    sessionStorage.setItem("sona.paidui", "1");
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 40 * 86400000, days: 3 }));
    return Sona.gated();
  });
  ok("…and would gate on the day pricing returns", freshGate === true, String(freshGate));
  await ctxB.close();
}

// ── THE SECOND FREE ERA, ALSO KEPT ────────────────────────────────────────
// Sona was free again for nine days and those families were told a REVOCABLE
// thing. Travis chose to keep it for them anyway. The hard part is that an
// era-two family and a family arriving tomorrow are BOTH stamped "post" — a
// new device is stamped on its first load, before it onboards. The sweep
// separates them structurally: on the first load of the build carrying it, an
// already-onboarded device necessarily predates the build. Get this wrong in
// either direction and you either break a promise or give the app away.
{
  const seedThen = (extra) => `
    localStorage.removeItem("sona.freeera2.v1");
    localStorage.setItem("sona.freeera.v1","post");
    localStorage.setItem("sona.profile.v1", JSON.stringify({childName:"Leo",childAge:"7",focusSounds:["R"],onboarded:true}));
    ${extra || ""}`;
  const deadTrial = () => localStorage.setItem(Sona.kkey("sona.trial.v1"),
    JSON.stringify({ start: Date.now() - 90 * 86400000, days: 3 }));

  // a device that existed during the second free window
  const c1 = await browser.newContext(); const p1 = await c1.newPage();
  await p1.goto("http://localhost:8147/today.html"); await p1.waitForTimeout(300);
  await p1.evaluate(seedThen());
  await p1.reload(); await p1.waitForTimeout(600);          // first load of THIS build
  const era2 = await p1.evaluate(() => { deadTrialStub(); return {
    stamp: localStorage.getItem("sona.freeera.v1"), early: Sona.getProfile().earlyAdopter, gated: Sona.gated() };
    function deadTrialStub(){ localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 90*86400000, days: 3 })); } });
  ok("a second-free-era family is grandfathered too",
    era2.stamp === "grandfathered" && era2.early === true, JSON.stringify(era2));
  ok("…and never gates, however dead their trial", era2.gated === false, JSON.stringify(era2));
  await c1.close();

  // a family who arrives AFTER the build carrying the sweep
  const c2 = await browser.newContext(); const p2 = await c2.newPage();
  await p2.goto("http://localhost:8147/today.html"); await p2.waitForTimeout(300);
  await p2.evaluate(() => localStorage.clear());
  await p2.reload(); await p2.waitForTimeout(600);          // stamped BEFORE they onboard
  const later = await p2.evaluate(() => {
    Sona.saveProfile({ childName: "New", childAge: "6", focusSounds: ["S"], onboarded: true });
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 90 * 86400000, days: 3 }));
    const swept = { stamp: localStorage.getItem("sona.freeera.v1"), early: Sona.getProfile().earlyAdopter };
    // Asked through the ?paid=1 seam ON PURPOSE, so this assertion is true
    // whether Sona is free today or not: the question is whether the sweep
    // granted this family standing OF THEIR OWN, and that must stay answerable
    // on the day pricing next returns. Get it wrong and the sweep quietly
    // grandfathers the entire future.
    sessionStorage.setItem("sona.paidui", "1");
    const gatedAsPriced = Sona.gated();
    sessionStorage.removeItem("sona.paidui");
    return Object.assign(swept, { gatedAsPriced });
  });
  ok("a family arriving after the sweep is NOT swept in",
    later.stamp === "post" && !later.early, JSON.stringify(later));
  ok("…and would meet the paywall like anyone else, whenever pricing is on",
    later.gatedAsPriced === true, JSON.stringify(later));
  await c2.close();

  // the sweep is one-shot: a device that onboards later cannot re-trigger it
  const c3 = await browser.newContext(); const p3 = await c3.newPage();
  await p3.goto("http://localhost:8147/today.html"); await p3.waitForTimeout(300);
  await p3.evaluate(() => localStorage.clear());
  await p3.reload(); await p3.waitForTimeout(600);
  await p3.evaluate(() => Sona.saveProfile({ childName: "Late", childAge: "6", focusSounds: ["S"], onboarded: true }));
  await p3.reload(); await p3.waitForTimeout(600);          // second load, now onboarded
  const late = await p3.evaluate(() => ({
    stamp: localStorage.getItem("sona.freeera.v1"), early: Sona.getProfile().earlyAdopter }));
  ok("onboarding AFTER the sweep does not grandfather on a later load",
    late.stamp === "post" && !late.early, JSON.stringify(late));
  await c3.close();
}

// ── the THIRD free era keeps it free, and this is the promise that cost most ──
// Sona was free 31 Aug – 15 Sep 2026, and that window was announced as
// PERMANENT — not "free for now" like era two. Pricing has returned anyway,
// which is Travis's call; the families who believed the first thing do not pay
// for the change of mind. CLAUDE.md recorded the requirement while the app was
// still free, precisely so this could not be rediscovered too late.
//
// The case era one and era two CANNOT catch: a device whose very first load
// happened during the third window carries GFKEY "post" AND GF2KEY "done"
// already, so it belongs to neither earlier cohort and every earlier gate
// skips it. If _grandfatherFreeEra3() reads those stamps, these families get a
// paywall they were promised they would never see.
{
  const c4 = await browser.newContext(); const p4 = await c4.newPage();
  await p4.goto("http://localhost:8147/today.html"); await p4.waitForTimeout(300);
  await p4.evaluate(() => {
    localStorage.clear();
    // exactly what a third-era device looks like: swept by both earlier eras
    // on its first load, onboarded afterwards, never entitled to anything
    localStorage.setItem("sona.freeera.v1", "post");
    localStorage.setItem("sona.freeera2.v1", "done");
    localStorage.setItem("sona.profile.v1", JSON.stringify({
      childName: "Nia", childAge: "6", focusSounds: ["S"], onboarded: true }));
  });
  await p4.reload(); await p4.waitForTimeout(700);        // first load of THIS build
  const era3 = await p4.evaluate(() => {
    // a trial that died long ago: the gate must not be what saves them
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 120 * 86400000, days: 3 }));
    return {
      stamp3: localStorage.getItem("sona.freeera3.v1"),
      stamp: localStorage.getItem("sona.freeera.v1"),
      early: Sona.getProfile().earlyAdopter,
      era3: Sona.getProfile().freeEra3,
      gated: Sona.gated(),
    };
  });
  ok("a third-free-era family is swept in by the era-3 sweep",
    era3.stamp3 === "done" && era3.early === true && era3.era3 === true, JSON.stringify(era3));
  ok("…and is NEVER gated, however dead their trial", era3.gated === false, JSON.stringify(era3));
  ok("…and is marked grandfathered, not left as 'post'",
    era3.stamp === "grandfathered", JSON.stringify(era3));
  await c4.close();

  // the household rule: a second child added on the same device is covered too
  const c5 = await browser.newContext(); const p5 = await c5.newPage();
  await p5.goto("http://localhost:8147/today.html"); await p5.waitForTimeout(300);
  await p5.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("sona.freeera.v1", "post");
    localStorage.setItem("sona.freeera2.v1", "done");
    localStorage.setItem("sona.kids.v1", JSON.stringify({ list: [{ slot: "", name: "A" }, { slot: "k2", name: "B" }], active: "" }));
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "A", childAge: "7", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.profile.v1@k2", JSON.stringify({ childName: "B", childAge: "5", focusSounds: ["S"], onboarded: true }));
  });
  await p5.reload(); await p5.waitForTimeout(700);
  const sibs = await p5.evaluate(() => ({
    a: (JSON.parse(localStorage.getItem("sona.profile.v1") || "{}")).earlyAdopter,
    b: (JSON.parse(localStorage.getItem("sona.profile.v1@k2") || "{}")).earlyAdopter,
  }));
  ok("era three is granted to the HOUSEHOLD, not just the active child",
    sibs.a === true && sibs.b === true, JSON.stringify(sibs),
  );
  await c5.close();

  // one-shot, like the others: a device that onboards tomorrow is not adopted
  const c6 = await browser.newContext(); const p6 = await c6.newPage();
  await p6.goto("http://localhost:8147/today.html"); await p6.waitForTimeout(300);
  await p6.evaluate(() => localStorage.clear());
  await p6.reload(); await p6.waitForTimeout(600);        // stamped before onboarding
  await p6.evaluate(() => Sona.saveProfile({ childName: "Tomorrow", childAge: "6", focusSounds: ["S"], onboarded: true }));
  await p6.reload(); await p6.waitForTimeout(600);        // a later load must not re-sweep
  const fresh = await p6.evaluate(() => {
    const swept = { stamp3: localStorage.getItem("sona.freeera3.v1"), early: Sona.getProfile().earlyAdopter };
    // Both halves asked through the seam, so they hold in either pricing
    // state. A brand-new family is not gated on day one — they are inside the
    // 3 free days, which is the product working. Kill the trial to ask the
    // question that matters: when it runs out, does the wall appear?
    sessionStorage.setItem("sona.paidui", "1");
    const gatedInTrial = Sona.gated();
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 9 * 86400000, days: 3 }));
    const gated = Sona.gated();
    sessionStorage.removeItem("sona.paidui");
    return Object.assign(swept, { gatedInTrial, gated });
  });
  ok("…and gets their 3 free days first, like any new family",
    fresh.gatedInTrial === false, JSON.stringify(fresh));
  ok("a family arriving after the era-3 sweep is not adopted by it",
    fresh.stamp3 === "done" && !fresh.early, JSON.stringify(fresh));
  ok("…and pays once those days run out, whenever pricing is on",
    fresh.gated === true, JSON.stringify(fresh));
  await c6.close();
}

// ── the ask lands AFTER the product has proved itself, never before ──
// Onboarding used to end at /subscribe.html, so a parent off an ad met a price
// screen before their child had said one word — and the 3-day trial was
// already burning. At 20 downloads that is the difference between learning
// "will parents pay" and learning nothing. These pin the new order.
{
  const onb = readFileSync(ROOT + "/onboarding.html", "utf8");
  ok("onboarding never ends at the paywall",
    /location\.href = "\/today\.html";/.test(onb) && !/subscribe\.html\?welcome=1/.test(onb),
    "a price screen before the first rep asks a stranger to buy a promise");

  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  const pm = (sona.match(/function planMoment\(\) \{[\s\S]*?\n  \}/) || [""])[0];
  ok("the plan moment is one-shot", /localStorage\.setItem\(PLANSEEN/.test(pm) && /getItem\(PLANSEEN\)\) return false/.test(pm),
    "asking twice is nagging; asking once at the peak is an offer");
  for (const who of ["isSubscribed()", "isPilot()", "isFounder()", "slpVerified()", "earlyAdopterAnyKid()"]) {
    ok(`…and never asks a family who is already entitled: ${who}`,
      pm.includes(who), "the three free eras and the SLP channel must never see a price");
  }
  ok("…and never fires while Sona is free", /if \(isFree\(\)\) return false;/.test(pm));

  const chg = readFileSync(ROOT + "/charge.html", "utf8");
  ok("the ask hangs off the completed-run overlay, not the round start",
    /runDone"\)\.onclick[\s\S]{0,260}planMoment\(\)/.test(chg) && /subscribe\.html\?first=1/.test(chg),
    "the win screen is the only moment Sona has demonstrated what it sells");
}

// behaviourally: a fresh paying family is asked once, then never again
{
  const ctx = await browser.newContext(); const pg = await ctx.newPage();
  await pg.goto("http://localhost:8147/today.html"); await pg.waitForTimeout(300);
  await pg.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("sona.freeera.v1", "post");
    localStorage.setItem("sona.freeera2.v1", "done");
    localStorage.setItem("sona.freeera3.v1", "done");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Ada", childAge: "7", focusSounds: ["R"], onboarded: true }));
  });
  await pg.reload(); await pg.waitForTimeout(600);
  const seq = await pg.evaluate(() => {
    // through the seam, so the one-shot contract is pinned in either pricing
    // state — while Sona is free planMoment correctly never fires at all
    sessionStorage.setItem("sona.paidui", "1");
    const r = [Sona.planMoment(), Sona.planMoment(), Sona.planMoment()];
    sessionStorage.removeItem("sona.paidui");
    return r;
  });
  ok("a new paying family is asked exactly once", JSON.stringify(seq) === "[true,false,false]", JSON.stringify(seq));

  const whileFree = await pg.evaluate(() => {
    localStorage.removeItem("sona.planmoment.v1");
    return Sona.planMoment();       // no seam: whatever the switch actually says
  });
  ok("…and the live switch decides whether the ask happens at all",
    whileFree === !IS_FREE_NOW,
    `FREE_MODE=${IS_FREE_NOW ? "true" : "false"} so planMoment should be ${!IS_FREE_NOW}, got ${whileFree}`);

  // an SLP-referred family is never asked — that promise IS the SLP channel
  const slp = await pg.evaluate(() => {
    localStorage.removeItem("sona.planmoment.v1");
    sessionStorage.setItem("sona.paidui", "1");
    Sona.startPilot("rachel");
    const r = Sona.planMoment();
    sessionStorage.removeItem("sona.paidui");
    return r;
  });
  ok("a referred / pilot family is never shown a price", slp === false, String(slp));
  await ctx.close();
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
