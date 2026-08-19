// Apple IAP rail (native shell): with a mocked Capacitor+Purchases bridge,
// subscribe.html must show the Apple paywall — $59.99/yr (3-day trial) plus
// $9.99/mo (no trial) — with no Stripe cards (3.1.1 hygiene), the required
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
  localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", focusSounds: ["R"], onboarded: true }));
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
  priceMo: document.getElementById("iapPriceMo").textContent,
  body: document.getElementById("iapCard").textContent,
  restore: !!document.getElementById("iapRestore"),
}));
ok("shell shows the Apple paywall", t.iap === "block");
ok("Stripe cards never render in the shell", t.pick !== "block" && t.founding === "none");
ok("live App Store prices painted, both plans", /\$59\.99/.test(t.price) && /\$9\.99/.test(t.priceMo), JSON.stringify([t.price, t.priceMo]));
ok("required furniture: Restore + Terms + Privacy + auto-renew terms",
  t.restore && /Terms of Use/.test(t.body) && /Privacy/.test(t.body) && /renews unless canceled/.test(t.body));
// Apple requires the price, period and cancellation terms on the paywall itself
ok("yearly offer: price, trial and cancel terms all stated",
  /\$59\.99/.test(t.body) && /3 days free/i.test(t.body) && /cancel/i.test(t.body));
ok("monthly offer: price stated, and NO trial promised on it",
  /\$9\.99/.test(t.body) && /billed today, no trial/i.test(t.body));
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

// ── the monthly button buys the MONTHLY product ──
await page.evaluate(() => { localStorage.removeItem("sona.sub.v1"); localStorage.setItem("__iapEntitled", "0"); });
await page.goto("http://localhost:8147/subscribe.html"); await page.waitForTimeout(900);
t = await page.evaluate(() => {
  window.__bought = [];
  const P = window.Capacitor.Plugins.Purchases;
  const orig = P.purchaseStoreProduct;
  P.purchaseStoreProduct = async (a) => { window.__bought.push(a.product.identifier); return orig(a); };
  document.getElementById("iapBuyMo").click();
  return true;
});
await page.waitForTimeout(700);
t = await page.evaluate(() => ({ bought: window.__bought, sub: JSON.parse(localStorage.getItem("sona.sub.v1") || "{}") }));
ok("monthly button purchases com.speaksona.app.monthly",
  (t.bought || []).length === 1 && /monthly/.test(t.bought[0]), JSON.stringify(t.bought));
ok("monthly purchase unlocks too", t.sub.active === true);

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
  localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", focusSounds: ["R"], onboarded: true, earlyAdopter: false }));
  sessionStorage.setItem("sona.gate.v1", String(Date.now()));
  sessionStorage.setItem("sona.paidui", "1");
});
await web.goto("http://localhost:8147/subscribe.html"); await web.waitForTimeout(800);
t = await web.evaluate(() => ({ iap: document.getElementById("iapCard").style.display, pick: document.getElementById("pickCard").style.display }));
ok("web keeps Stripe picker, no Apple card", t.iap !== "block" && t.pick === "block");
t = await web.evaluate(() => ({ body: document.getElementById("pickCard").innerText }));
ok("web picker states both plans honestly",
  /\$59\.99/.test(t.body) && /3 DAYS FREE/i.test(t.body) && /\$9\.99/.test(t.body) && /billed today, no trial/i.test(t.body), t.body.slice(0, 200));
await web.close();

// ── PRICING IS LIVE: FREE_MODE off, 3-day trial, the gate is honest ──
{
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  ok("FREE_MODE is on — Sona is free", /const FREE_MODE = true;/.test(sona));
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
  ok("trial page keeps the live prices ready for the flip", /\$59\.99/.test(trial) && /\$9\.99/.test(trial) && /3 days free/.test(trial));
  ok("…but nobody lands on it while Sona is free",
    /Sona\.isFree\(\)\) location\.replace\("\/today\.html"\)/.test(trial),
    "a bookmarked or back-swiped /trial.html would pitch a price in a free app");
}

// ── an expired trial actually locks practice; a founding family sails through ──
const gatePg = await browser.newPage({ viewport: { width: 390, height: 844 } });
await gatePg.addInitScript(() => {
  sessionStorage.setItem("sona.paidui", "1");   // exercise the gate as if priced
  // seed-once: init scripts re-run on every navigation and would overwrite the
  // earlyAdopter flag the second half of this test sets
  if (!localStorage.getItem("sona.profile.v1")) {
    localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: "7", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 4 * 86400000, days: 3 }));
    localStorage.setItem("sona.micok", "1");
  }
});
await gatePg.goto("http://localhost:8147/charge.html?game=arcade-slice.html"); await gatePg.waitForTimeout(700);
ok("expired trial bounces charge.html to the trial page", /trial\.html/.test(gatePg.url()), gatePg.url());
await gatePg.evaluate(() => { const p = JSON.parse(localStorage.getItem("sona.profile.v1")); p.earlyAdopter = true; localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.profile.v1", JSON.stringify(p)); });
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
  ok("…and plays free anyway, because the app is free", fresh.gated === false, JSON.stringify(fresh));
  const freshGate = await pgB.evaluate(() => {
    sessionStorage.setItem("sona.paidui", "1");
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 40 * 86400000, days: 3 }));
    return Sona.gated();
  });
  ok("…and would gate on the day pricing returns", freshGate === true, String(freshGate));
  await ctxB.close();
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
