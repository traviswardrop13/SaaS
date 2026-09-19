// Apple IAP rail (native shell): with a mocked Capacitor+Purchases bridge,
// subscribe.html must show the Apple paywall — $59.99/yr (3-day trial), the
// only plan since monthly was retired — with no Stripe cards (3.1.1 hygiene), the required
// Restore + Terms/Privacy links and full auto-renew terms; purchase →
// unlock on the "full" entitlement, restore → unlock, and today.html must
// quiet-sync entitlements on load. Web (no bridge) keeps the Stripe picker.
// The pricing switch has flipped eleven times in seven weeks, so every paid
// assertion below runs behind the ?paid=1 / sona.paidui QA seam rather than
// assuming today's answer. That is the seam's whole job: the purchase
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
        // __iapFail lets a test make Apple UNREACHABLE, which is a different
        // answer from "not entitled" and must be treated differently.
        getCustomerInfo: async () => { if (localStorage.getItem("__iapFail") === "1") throw new Error("offline"); return info(); },
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
    /function gated\(\w*\) \{\s*if \(isFree\(\)\) return false;/.test(sona),
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
    // gated() now takes the NAME of the activity being asked for, because the
    // free demonstration is exempt and nothing else is. What this pins is
    // unchanged: the page asks at load, and an answer of yes goes to
    // trial.html rather than rendering a locked screen.
    ok(pg + " gates at page load", /Sona\.gated\(/.test(src) && /trial\.html/.test(src));
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
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 4 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
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
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 365 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
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
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 40 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
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
  const deadTrial = () => {
    localStorage.setItem(Sona.kkey("sona.trial.v1"),
      JSON.stringify({ start: Date.now() - 90 * 86400000, days: 3 }));
    // a family whose trial has run out has necessarily seen the free
    // demonstration — without this stamp the gate correctly lets them
    // straight through, and the test would be asserting nothing
    localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
  };

  // a device that existed during the second free window
  const c1 = await browser.newContext(); const p1 = await c1.newPage();
  await p1.goto("http://localhost:8147/today.html"); await p1.waitForTimeout(300);
  await p1.evaluate(seedThen());
  await p1.reload(); await p1.waitForTimeout(600);          // first load of THIS build
  const era2 = await p1.evaluate(() => { deadTrialStub(); return {
    stamp: localStorage.getItem("sona.freeera.v1"), early: Sona.getProfile().earlyAdopter, gated: Sona.gated() };
    function deadTrialStub(){ localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 90*86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 })); } });
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
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 90 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
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
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 120 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
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
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 9 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
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

// ── ENTITLEMENT LIFECYCLE: access must be able to END ─────────────────
// SEC2 fixed two halves of one bug and pinned neither, which is how it got
// shipped in the first place: iapRefresh granted and never revoked (cached
// active short-circuited the check, and an inactive answer left the flag
// alone), and web restore() did the same on the Stripe side. The rule these
// assert is narrow and has to stay narrow — an AUTHORITATIVE inactive from
// one rail clears ONLY that rail's own grant, and an unreachable store clears
// nothing at all.
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.addInitScript(() => {
    window.__iap = { purchases: 0, restores: 0, configured: 0 };
    const entitled = () => localStorage.getItem("__iapEntitled") === "1";
    const info = () => ({ customerInfo: { entitlements: { active: entitled() ? { full: { isActive: true } } : {} } } });
    window.Capacitor = { isNativePlatform: () => true, Plugins: { Purchases: {
      configure: async () => { window.__iap.configured++; },
      getProducts: async () => ({ products: [{ identifier: "com.speaksona.app.annual", priceString: "$59.99" }] }),
      purchaseStoreProduct: async () => info(),
      restorePurchases: async () => info(),
      getCustomerInfo: async () => { window.__iap.checks = (window.__iap.checks || 0) + 1; if (localStorage.getItem("__iapFail") === "1") throw new Error("offline"); return info(); },
    } } };
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Ada", childAge: "7", focusSounds: ["R"], onboarded: true }));
    sessionStorage.setItem("sona.gate.v1", String(Date.now()));
  });
  await pg.goto("http://localhost:8147/today.html"); await pg.waitForTimeout(600);

  const appleSays = (entitled, opts) => pg.evaluate(async (o) => {
    localStorage.setItem("__iapEntitled", o.entitled ? "1" : "0");
    localStorage.setItem("__iapFail", o.offline ? "1" : "0");
    localStorage.setItem("sona.sub.v1", JSON.stringify(o.sub));
    if (o.checkedAt === null) localStorage.removeItem("sona.iapcheck.v1");
    else localStorage.setItem("sona.iapcheck.v1", String(o.checkedAt));
    const before = window.__iap.checks || 0;
    const r = await Sona.iapRefresh();
    return { r, sub: JSON.parse(localStorage.getItem("sona.sub.v1") || "{}"), calls: (window.__iap.checks || 0) - before,
             stamped: parseInt(localStorage.getItem("sona.iapcheck.v1") || "0", 10) };
  }, Object.assign({ entitled, offline: false, checkedAt: null, sub: { active: true, source: "apple" } }, opts || {}));

  let r = await appleSays(false, {});
  ok("Apple says inactive: apple-sourced access is revoked",
    r.r === false && r.sub.active === false, JSON.stringify(r));

  r = await appleSays(false, { sub: { active: true, source: "stripe", email: "a@b.com" } });
  ok("…but a Stripe subscription is NOT revoked by Apple's answer",
    r.sub.active === true && r.sub.source === "stripe", JSON.stringify(r));

  r = await appleSays(true, { offline: true, sub: { active: true, source: "apple" } });
  ok("Apple unreachable is not a cancellation — access survives",
    r.r === true && r.sub.active === true, JSON.stringify(r));
  ok("…and the check clock is not stamped, so the next open tries again",
    r.stamped === 0, JSON.stringify(r));

  r = await appleSays(true, { checkedAt: Date.now() });
  ok("a recent check is trusted without another call (the offline grace)",
    r.r === true && r.calls === 0, JSON.stringify(r));

  r = await appleSays(false, { checkedAt: Date.now() - 7 * 3600 * 1000 });
  ok("…but a stale one is re-verified, so a cancellation eventually lands",
    r.calls === 1 && r.sub.active === false, JSON.stringify(r));

  // ── the same discipline on the web rail ──
  const webSays = (active, opts) => pg.evaluate(async (o) => {
    localStorage.setItem("sona.sub.v1", JSON.stringify(o.sub));
    window.__subReply = o.reply;
    const r = await Sona.restore(o.email);
    return { r, sub: JSON.parse(localStorage.getItem("sona.sub.v1") || "{}") };
  }, Object.assign({ reply: { ok: true, active }, email: "parent@example.com",
                     sub: { active: true, source: "stripe", email: "parent@example.com" } }, opts || {}));

  await pg.route("**/api/subscription**", async (route) => {
    const reply = await pg.evaluate(() => window.__subReply);
    if (!reply) return route.fulfill({ status: 500, body: "{}" });
    if (reply.boom) return route.abort("failed");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) });
  });

  r = await webSays(true, { sub: { active: false } });
  ok("Stripe says active: access is granted and labelled stripe",
    r.r.active === true && r.sub.active === true && r.sub.source === "stripe", JSON.stringify(r));

  r = await webSays(false, {});
  ok("Stripe says inactive for THIS account: access ends",
    r.r.active === false && r.sub.active === false, JSON.stringify(r));

  r = await webSays(false, { email: "someone.else@example.com" });
  ok("…but an inactive answer about ANOTHER address revokes nothing",
    r.sub.active === true, "a mistyped email must not lock a paying family out: " + JSON.stringify(r));

  r = await webSays(false, { sub: { active: true, source: "apple", email: "parent@example.com" } });
  ok("…and a web answer never clears Apple-sourced access",
    r.sub.active === true && r.sub.source === "apple", JSON.stringify(r));

  r = await webSays(false, { reply: { boom: true } });
  ok("a failed request is not a cancellation on the web rail either",
    r.r.ok === false && r.sub.active === true, JSON.stringify(r));

  await ctx.close();
}

// ── THE FREE DEMONSTRATION ────────────────────────────────────
// A new family was handed a silent 3-day clock the moment onboarding closed —
// it was already burning while the parent read the next screen, and a family
// who opened Sona on Friday and came back on Tuesday had "used" a trial they
// never saw. They get one complete run instead, and only then a price.
{
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  const onb = readFileSync(ROOT + "/onboarding.html", "utf8");
  const tdy = readFileSync(ROOT + "/today.html", "utf8");
  const chg = readFileSync(ROOT + "/charge.html", "utf8");

  ok("nothing starts a local trial behind a parent's back any more",
    !/Sona\.startTrial\(/.test(onb) && !/S\.ensureTrial\(\)/.test(tdy),
    "finishing setup and opening Home both used to start the clock");
  ok("…and the gate does not quietly mint one either",
    !/ensureTrial\(\);\n\s*return trialExpired/.test(sona) && /if \(!demoDone\(\)\) return false;/.test(sona),
    "a device that is merely gated must not be issued days nobody offered it");
  ok("…but days already promised are honoured to the end",
    /const t = getTrial\(\);\s*\n\s*if \(t && t\.start && !trialExpired\(\)\) return false;/.test(sona),
    "an existing family's unexpired trial must not be shortened by this");

  ok("the demonstration ends where the celebration is, not before",
    /runOvl"\)\.classList\.add\("show"\)[\s\S]{0,400}demoFinish\(\)/.test(chg),
    "an explicit finish: real practice, the games it earned, then the offer");
  ok("…and is marked under way when practice starts, so a refresh resumes it",
    /practice started[\s\S]{0,320}demoStart\(\)/.test(chg));

  // A REPLAY EARNS NOTHING. Every write that would bank something is guarded,
  // because a replay that minted coins, climbed the ladder and fed the
  // clinician's counts is not a demonstration — it is the product for free.
  for (const [what, re] of [
    ["clinical outcome data", /function logV\(v\)\{ if\(DEMO_REPLAY\) return;/],
    ["the rep count", /if\(!DEMO_REPLAY&&reps>0&&S&&S\.bumpReps\)/],
    ["ladder advancement", /S\.recordRung && !DEMO_REPLAY/],
    ["the day's score, session and coins", /if\(DEMO_REPLAY\)\{[\s\S]{0,200}newBest: false/],
  ]) ok("a replay banks no " + what, re.test(chg), what);
  ok("…and the replay flag is read before demoFinish can change it",
    chg.indexOf("var DEMO_REPLAY") < chg.indexOf("S.demoFinish"),
    "decided at load, or the answer flips underneath the page");

  ok("a gated child's big button is the demonstration, never a price screen",
    /demoOnlyHero\(\)[\s\S]{0,400}charge\.html\?daily=1&demo=1/.test(tdy),
    "a child should never tap the biggest thing on the screen and meet a paywall");
}

// behaviourally: the gate opens for the demonstration and closes after it
{
  const ctx = await browser.newContext(); const pg = await ctx.newPage();
  await pg.goto("http://localhost:8147/today.html"); await pg.waitForTimeout(300);
  const seed = () => pg.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("sona.freeera.v1", "post");
    localStorage.setItem("sona.freeera2.v1", "done");
    localStorage.setItem("sona.freeera3.v1", "done");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Ada", childAge: "7", focusSounds: ["R"], onboarded: true }));
  });
  await seed(); await pg.reload(); await pg.waitForTimeout(500);

  const fresh = await pg.evaluate(() => ({
    gated: Sona.gated("practice"), demo: Sona.demoDone(), trial: localStorage.getItem("sona.trial.v1"),
  }));
  ok("a family who has seen nothing is not gated — they are inside the demo",
    fresh.gated === false && fresh.demo === false, JSON.stringify(fresh));
  ok("…and no trial was created just by them being here", fresh.trial === null, String(fresh.trial));

  const done = await pg.evaluate(() => {
    const first = Sona.demoFinish();
    const again = Sona.demoFinish();
    return { first, again, practice: Sona.gated("practice"), story: Sona.gated("story"), demo: Sona.gated("demo"),
             trial: localStorage.getItem("sona.trial.v1") };
  });
  ok("finishing the demonstration is one-shot", done.first === true && done.again === false, JSON.stringify(done));
  ok("…and still issues no silent trial", done.trial === null, String(done.trial));
  // the switch decides whether anything gates at all; the demo exemption must
  // hold in BOTH states, which is the half that would rot silently
  ok("…after which the rest of Sona gates, whenever pricing is on",
    done.practice === !IS_FREE_NOW && done.story === !IS_FREE_NOW, JSON.stringify(done));
  ok("…but the demonstration itself stays replayable, forever, either way",
    done.demo === false, String(done.demo));

  // an existing family mid-trial keeps every day they were promised
  const honoured = await pg.evaluate(() => {
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 86400000, days: 3 }));
    const alive = Sona.gated("practice");
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 9 * 86400000, days: 3 }));
    return { alive, dead: Sona.gated("practice") };
  });
  ok("an unexpired trial from before this change still opens the door",
    honoured.alive === false, JSON.stringify(honoured));
  ok("…and once it genuinely runs out, the door closes", honoured.dead === !IS_FREE_NOW, JSON.stringify(honoured));
  await ctx.close();
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

  // DECIDING is not SHOWING. These were one function and it cost the family
  // the offer: planMoment() consumed the one-shot and logged the impression at
  // the moment of deciding, before the paywall existed on screen. The paywall
  // lives behind the grown-ups gate, so a parent who backed out of that gate
  // — or a redirect that simply failed — spent the only ask Sona will ever
  // make, while the funnel counted an impression nobody saw.
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  const fn = (name) => (sona.match(new RegExp("function " + name + "\\(\\w*\\) \\{[\\s\\S]*?\\n  \\}")) || [""])[0];
  const el = fn("planEligible"), sh = fn("planShown");
  ok("planEligible() exists and planShown() exists", !!el && !!sh, "the split is the fix");
  ok("planEligible() CONSUMES NOTHING", !/setItem\(PLANSEEN/.test(el) && !/track\(/.test(el),
    "asking whether to make an offer must not spend it: " + el.slice(0, 160));
  ok("planEligible() still respects the one-shot", /getItem\(PLANSEEN\)\) return false/.test(el),
    "once the offer has been made, stop making it");
  ok("planShown() is the only thing that spends it",
    /setItem\(PLANSEEN/.test(sh) && /track\("plan moment shown"/.test(sh),
    "the impression is logged where the offer actually renders");
  for (const who of ["isSubscribed()", "isPilot()", "isFounder()", "slpVerified()", "earlyAdopterAnyKid()"]) {
    ok(`…and never asks a family who is already entitled: ${who}`,
      el.includes(who), "the three free eras and the SLP channel must never see a price");
  }
  ok("…and never fires while Sona is free", /if \(isFree\(\)\) return false;/.test(el));

  const chg = readFileSync(ROOT + "/charge.html", "utf8");
  ok("the ask hangs off the completed-run overlay, not the round start",
    /runDone"\)\.onclick[\s\S]{0,300}planEligible\(\)/.test(chg) && /subscribe\.html\?first=1/.test(chg),
    "the win screen is the only moment Sona has demonstrated what it sells");
  ok("…and the win screen only ASKS, it does not mark the offer spent",
    !/runDone"\)\.onclick[\s\S]{0,300}planShown\(/.test(chg),
    "charge.html cannot know the paywall rendered — only the paywall knows that");

  const sub = readFileSync(ROOT + "/subscribe.html", "utf8");
  ok("the paywall itself marks the impression, on both rails",
    /planShown\("native"\)/.test(sub) && /planShown\("web"\)/.test(sub),
    "native and web each render their own card");
  ok("…and the web rail only counts it when the card is on screen",
    /offerOnScreen[\s\S]{0,240}planShown\("web"\)/.test(sub),
    "a subscriber sees no picker; counting them burns the ask and inflates the funnel");
}

// behaviourally: eligibility is free to ask, the impression is spent once
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
  // THE CANCELLED GATE. This is the regression that names the bug: a parent
  // taps Done, the grown-ups gate opens, they change their mind and go back.
  // Nothing was shown, so nothing may be spent — the next completed run must
  // still be able to make the offer.
  const seq = await pg.evaluate(() => {
    // through the seam, so the contract is pinned in either pricing state —
    // while Sona is free planEligible correctly never returns true at all
    sessionStorage.setItem("sona.paidui", "1");
    const asked = [Sona.planEligible(), Sona.planEligible(), Sona.planEligible()];
    const spent = localStorage.getItem("sona.planmoment.v1");
    sessionStorage.removeItem("sona.paidui");
    return { asked, spent };
  });
  ok("asking three times does not spend the offer",
    JSON.stringify(seq.asked) === "[true,true,true]" && !seq.spent,
    JSON.stringify(seq));

  // …and the paywall, once it renders, spends it exactly once
  const shown = await pg.evaluate(() => {
    sessionStorage.setItem("sona.paidui", "1");
    const r = [Sona.planShown("test"), Sona.planShown("test"), Sona.planEligible()];
    sessionStorage.removeItem("sona.paidui");
    return r;
  });
  ok("the rendered paywall is counted once, and then never asks again",
    JSON.stringify(shown) === "[true,false,false]", JSON.stringify(shown));

  const whileFree = await pg.evaluate(() => {
    localStorage.removeItem("sona.planmoment.v1");
    return Sona.planEligible();     // no seam: whatever the switch actually says
  });
  ok("…and the live switch decides whether the ask happens at all",
    whileFree === !IS_FREE_NOW,
    `FREE_MODE=${IS_FREE_NOW ? "true" : "false"} so planEligible should be ${!IS_FREE_NOW}, got ${whileFree}`);

  // an SLP-referred family is never asked — that promise IS the SLP channel
  const slp = await pg.evaluate(() => {
    localStorage.removeItem("sona.planmoment.v1");
    sessionStorage.setItem("sona.paidui", "1");
    Sona.startPilot("rachel");
    const r = Sona.planEligible();
    sessionStorage.removeItem("sona.paidui");
    return r;
  });
  ok("a referred / pilot family is never shown a price", slp === false, String(slp));
  await ctx.close();
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
