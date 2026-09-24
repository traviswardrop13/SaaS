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
  localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.freeera2.v1","done"); localStorage.setItem("sona.freeera3.v1","done");localStorage.setItem("sona.freeera4.v1","done"); localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", focusSounds: ["R"], onboarded: true }));
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
// THE PLAN IS SONA PREMIUM (24 Sep 2026). With a free version, "Sona Yearly"
// and "only if you keep Sona" read as buying Sona itself — which nobody has
// to. The card names what it sells, the same name the Premium page uses.
ok("the Apple card names the plan Sona Premium, never a bare 'Sona Yearly'",
  /Sona Premium — /.test(t.body) && !/Sona Yearly/.test(t.body) && !/keep Sona(?! Premium)/.test(t.body), t.body.slice(0, 200));

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
  ok("onboarding offers device-code entry", /moveLink/.test(obSrc) && /Moving from another phone/.test(obSrc));
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
  localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.freeera2.v1","done"); localStorage.setItem("sona.freeera3.v1","done");localStorage.setItem("sona.freeera4.v1","done"); localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", focusSounds: ["R"], onboarded: true, earlyAdopter: false }));
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

// ── PREMIUM THAT NOBODY BOUGHT HERE IS NEVER SOLD AGAIN (24 Sep 2026) ──
// A family can hold Premium without a purchase: their clinician's caseload is
// covered (sona.caseplan.v1), or a free-era sweep grandfathered them
// (earlyAdopter). The plan screen returns early for them on iOS and hides the
// picker on the web — and nothing pinned it, so an edit that dropped either
// check would show a covered family Apple's "Start 3 days free" sheet for
// games they already have, with every suite green.
{
  const noSale = { configure: async () => {}, getProducts: async () => ({ products: [{ identifier: "com.speaksona.app.annual", priceString: "$59.99" }] }),
    purchaseStoreProduct: async () => ({ customerInfo: { entitlements: { active: {} } } }), restorePurchases: async () => ({ customerInfo: { entitlements: { active: {} } } }),
    getCustomerInfo: async () => ({ customerInfo: { entitlements: { active: {} } } }) };
  const families = [
    ["covered caseload", { "sona.slpok": "RACHEL-K4", "sona.caseplan.v1": JSON.stringify({ active: true, code: "RACHEL-K4", checked: Date.now() }) }, {}, /included through your child's speech therapist/],
    ["grandfathered", {}, { earlyAdopter: true }, /yours to keep/],
  ];
  for (const native of [true, false]) for (const [who, local, prof, why] of families) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(({ native, local, prof, fns }) => {
      if (native) {
        const P = {}; Object.keys(fns).forEach((k) => { P[k] = new Function("return (" + fns[k] + ")")(); });
        window.Capacitor = { isNativePlatform: () => true, Plugins: { Purchases: P } };
      }
      if (!sessionStorage.getItem("iap.nosale.seed")) {
        sessionStorage.setItem("iap.nosale.seed", "1");
        ["", "2", "3", "4"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", n ? "done" : "post"));
        localStorage.setItem("sona.profile.v1", JSON.stringify(Object.assign({ childName: "Milo", focusSounds: ["R"], onboarded: true }, prof)));
        Object.keys(local).forEach((k) => localStorage.setItem(k, local[k]));
        sessionStorage.setItem("sona.gate.v1", String(Date.now()));
        sessionStorage.setItem("sona.paidui", "1");
      }
    }, { native, local, prof, fns: Object.fromEntries(Object.entries(noSale).map(([k, f]) => [k, f.toString()])) });
    const pg = await ctx.newPage();
    for (const path of ["/subscribe.html", "/subscribe.html?first=1"]) {
      await pg.goto("http://localhost:8147" + path); await pg.waitForTimeout(800);
      const st = await pg.evaluate(() => ({
        native: Sona.isNativeApp(), premium: Sona.premium(),
        iap: document.getElementById("iapCard").style.display, pick: document.getElementById("pickCard").style.display,
        free: document.getElementById("freeTierCard").style.display, decline: document.getElementById("declineRow").style.display,
        line: document.getElementById("planLine").textContent,
      }));
      const rail = (native ? "iOS" : "web") + " " + path + ": ";
      ok(rail + "a " + who + " family with no purchase sees no Apple sheet and no plan picker",
        st.native === native && st.premium === true && st.iap !== "block" && st.pick !== "block" && st.free !== "block" && st.decline !== "block", JSON.stringify(st));
      ok(rail + "…and is told they have Sona Premium, and why", /Sona Premium ✓/.test(st.line) && why.test(st.line), st.line);
    }
    if (!native) {
      await pg.goto("http://localhost:8147/settings.html"); await pg.waitForTimeout(800);
      const set = await pg.evaluate(() => ({ acct: document.getElementById("acct").textContent, restore: getComputedStyle(document.getElementById("restoreBox")).display }));
      ok("Settings: a " + who + " family reads 'Sona Premium ✓' and where it came from, with no restore box",
        /Sona Premium ✓/.test(set.acct) && why.test(set.acct) && set.restore === "none", JSON.stringify(set));
    }
    await ctx.close();
  }
  // …and the free version is named in the one phrase in Settings too
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    if (!sessionStorage.getItem("iap.free.seed")) {
      sessionStorage.setItem("iap.free.seed", "1");
      ["", "2", "3", "4"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", n ? "done" : "post"));
      localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", focusSounds: ["R"], onboarded: true }));
      sessionStorage.setItem("sona.gate.v1", String(Date.now()));
      sessionStorage.setItem("sona.paidui", "1");
    }
  });
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8147/settings.html"); await pg.waitForTimeout(800);
  const acct = await pg.evaluate(() => document.getElementById("acct").textContent);
  ok("Settings names a family's free version as 'daily practice and four free games'",
    /free version — daily practice and four free games/.test(acct) && /See Premium/.test(acct), acct);
  await ctx.close();
}

// ── the credential on the paywall says only what is verified ──
// Rachel holds an Idaho CF licence (confirmed 1 Sep 2026), so "licensed" is
// true and is used. She is a Clinical Fellow — master's complete, supervised
// fellowship year in progress — and does NOT hold ASHA's CCC. Since 23 Sep 2026
// the copy says "licensed" without naming the fellowship (Travis's call), so
// that is not pinned; what is pinned is that nothing claims MORE. The CCC is the
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
  ok("…and nothing dresses it up as more than a licence",
    !/fully licen[sc]ed|\bcertified\b/i.test(sub),
    "leaving the fellowship unsaid is a choice; implying she is past it is a false claim");
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
  // REWRITTEN 24 Sep 2026. This pinned `earlyAdopterAnyKid()) return false`
  // inside gated() under the name "founding/SLP families never gate". The
  // promise it guarded still holds — every grandfathered family keeps every
  // game — but it is kept in ONE place now: premium(), which the gate, the
  // catalog and the plan moment all ask. What changed is who is in it: a
  // clinician's link redeemed after this build earns Premium only through the
  // clinician's coverage (caseCovered), and the families who redeemed before
  // it are grandfathered by the era-four sweep instead of by the credential.
  {
    const prem = (sona.match(/function premium\(\) \{[\s\S]*?\n  \}/) || [""])[0];
    ok("grandfathered families hold Premium, in the one function that decides it",
      /earlyAdopterAnyKid\(\)/.test(prem) && /isSubscribed\(\)/.test(prem) && /isFounder\(\)/.test(prem) &&
      /foundingPilot\(\)/.test(prem) && /caseCovered\(\)/.test(prem), prem);
    ok("…and a verified credential or an SLP-code pilot is NOT, by itself, Premium",
      !/slpVerified\(\)/.test(prem) && !/isPilot\(\)/.test(prem),
      "a clinician's link proves membership of a caseload; whether that caseload is covered is the server's answer");
    ok("…and the gate asks that one function rather than keeping its own list",
      /function gated\(\w*\) \{[\s\S]{0,700}if \(premium\(\)\) return false;/.test(sona));
  }
  ok("the founding grant belongs to the HOUSEHOLD, not one child",
    /function earlyAdopterAnyKid[\s\S]{0,420}PKEY \+ "@" \+ slot/.test(sona),
    "earlyAdopter lives on the per-kid profile — a referred family's second child was paywalled");
  // Catalog doors ask about the chosen game; the parked story asks for
  // itself BY NAME since 24 Sep 2026 (practice never gates, so an unnamed ask
  // no longer means "the whole app"). Neither child route leads to a price.
  for (const pg of ["charge.html", "arcade-feed.html"]) {
    const src = readFileSync(ROOT + "/" + pg, "utf8");
    ok(pg + " checks catalog access at page load",
      /S\.gameAccess\(/.test(src) && /S\.gameBounce\(/.test(src) && !/replace\("\/trial\.html"\)/.test(src));
  }
  const storyGate = readFileSync(ROOT + "/story.html", "utf8");
  ok("story.html keeps its page-load gate, asking as Premium content", /Sona\.gated\("story"\)/.test(storyGate) && /Sona\.gateBounce\(\)/.test(storyGate));
  const trial = readFileSync(ROOT + "/trial.html", "utf8");
  ok("trial.html routes the shell to the Apple paywall, not back home",
    /location\.replace\("\/subscribe\.html"\)/.test(trial),
    "routing natives to today.html made an infinite gate loop");
  ok("trial page states the live prices", /\$59\.99/.test(trial) && /\$9\.99/.test(trial) && /3 days free/.test(trial));
  ok("…and still carries the free-mode bounce for the next flip",
    /Sona\.isFree\(\)\) location\.replace\("\/today\.html"\)/.test(trial),
    "inert while priced; deleting it is how a future free window ships a paywall link");
}

// ── expiry locks Premium, keeps free practice, and respects founding access ──
const gatePg = await browser.newPage({ viewport: { width: 390, height: 844 } });
await gatePg.addInitScript(() => {
  sessionStorage.setItem("sona.paidui", "1");   // exercise the gate as if priced
  // seed-once: init scripts re-run on every navigation and would overwrite the
  // earlyAdopter flag the second half of this test sets
  if (!localStorage.getItem("sona.profile.v1")) {
    localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.freeera2.v1","done"); localStorage.setItem("sona.freeera3.v1","done");localStorage.setItem("sona.freeera4.v1","done"); localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: "7", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 4 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
    localStorage.setItem("sona.micok", "1");
  }
});
await gatePg.goto("http://localhost:8147/charge.html?game=arcade-slice.html"); await gatePg.waitForTimeout(700);
ok("expired trial keeps free Slice practice available", /charge\.html\?game=arcade-slice\.html$/.test(gatePg.url()), gatePg.url());
await gatePg.goto("http://localhost:8147/charge.html?game=arcade-tiles.html"); await gatePg.waitForTimeout(700);
ok("expired trial blocks Premium practice before its earned-game flow",
  /activities\.html\?locked=tiles$/.test(gatePg.url()), gatePg.url());
await gatePg.evaluate(() => { const p = JSON.parse(localStorage.getItem("sona.profile.v1")); p.earlyAdopter = true; localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.freeera2.v1","done"); localStorage.setItem("sona.freeera3.v1","done");localStorage.setItem("sona.freeera4.v1","done"); localStorage.setItem("sona.profile.v1", JSON.stringify(p)); });
await gatePg.goto("http://localhost:8147/charge.html?game=arcade-tiles.html"); await gatePg.waitForTimeout(700);
ok("a founding family with the same expired trial still opens Premium practice", /charge\.html\?game=arcade-tiles\.html$/.test(gatePg.url()), gatePg.url());
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
  await pgA.reload(); await pgA.waitForTimeout(500);    // note: no ?paid=1 — whatever the build says
  const grand = await pgA.evaluate(() => ({
    stamp: localStorage.getItem("sona.freeera.v1"),
    early: Sona.getProfile().earlyAdopter,
  }));
  ok("a free-era family is grandfathered whichever way the switch points",
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
  // 24 Sep 2026: "would gate" no longer means "loses Sona". A family with no
  // standing of their own meets Premium locked — and practice never.
  const freshGate = await pgB.evaluate(() => {
    sessionStorage.setItem("sona.paidui", "1");
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 40 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
    return { premium: Sona.gated(), tiles: Sona.gated("tiles"), practice: Sona.gated("practice") };
  });
  ok("…and would find Premium locked, but never practice, on the day pricing returns",
    freshGate.premium === true && freshGate.tiles === true && freshGate.practice === false, JSON.stringify(freshGate));
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
    const practiceAsPriced = Sona.gated("practice");
    sessionStorage.removeItem("sona.paidui");
    return Object.assign(swept, { gatedAsPriced, practiceAsPriced });
  });
  ok("a family arriving after the sweep is NOT swept in",
    later.stamp === "post" && !later.early, JSON.stringify(later));
  ok("…and would find Premium locked like anyone else (practice never), whenever pricing is on",
    later.gatedAsPriced === true && later.practiceAsPriced === false, JSON.stringify(later));
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
    // on its first load, onboarded afterwards, never entitled to anything.
    // The era-FOUR stamp is set too (24 Sep 2026), so it is era three's sweep
    // and nothing later that is under test: an onboarded seed missing the
    // newest stamp is that newest era's cohort, and would pass for the wrong
    // reason.
    localStorage.setItem("sona.freeera.v1", "post");
    localStorage.setItem("sona.freeera2.v1", "done");
    localStorage.setItem("sona.freeera4.v1", "done");
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
    localStorage.setItem("sona.freeera4.v1", "done");   // isolate era three (see above)
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
    const practice = Sona.gated("practice");
    sessionStorage.removeItem("sona.paidui");
    return Object.assign(swept, { gatedInTrial, gated, practice });
  });
  ok("…and gets their 3 free days first, like any new family",
    fresh.gatedInTrial === false, JSON.stringify(fresh));
  ok("a family arriving after the era-3 sweep is not adopted by it",
    fresh.stamp3 === "done" && !fresh.early, JSON.stringify(fresh));
  // "pays" means Premium since 24 Sep 2026: the free version stays theirs
  ok("…and meets Premium locked once those days run out — practice never — whenever pricing is on",
    fresh.gated === true && fresh.practice === false, JSON.stringify(fresh));
  await c6.close();
}

// ── THE FOURTH FREE ERA, KEPT — in the build that ends it ─────────────────
// Sona went free on 20 Sep 2026 and the build that returns pricing (as a free
// version plus Premium, 24 Sep 2026) is the build that carries this sweep —
// CLAUDE.md's rule, because a sweep that shipped during the window would have
// stamped the families it protects before they onboarded. Two cohorts are
// kept, both for good: every device already onboarded on its first load of
// this build, and every device that had redeemed a clinician's link (sona.slpok
// / sona.slpunlock) — because until this build a redemption WAS free-forever
// access, onboarded or not. Everyone whose first load is this build or later
// is stamped before they onboard or redeem, and gets nothing from it.
{
  const load = async (seed) => {
    const c = await browser.newContext(); const p = await c.newPage();
    await p.goto("http://localhost:8147/today.html"); await p.waitForTimeout(300);
    await p.evaluate(seed);
    await p.reload(); await p.waitForTimeout(700);        // first load of THIS build
    return { c, p };
  };
  const ask = (p) => p.evaluate(() => {
    sessionStorage.setItem("sona.paidui", "1");
    localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 60 * 86400000, days: 3 }));
    const out = { stamp4: localStorage.getItem("sona.freeera4.v1"), early: Sona.getProfile().earlyAdopter, era4: Sona.getProfile().freeEra4,
      premium: Sona.premium(), tiles: Sona.gameAccess("tiles").allowed, story: Sona.gated("story") };
    sessionStorage.removeItem("sona.paidui");
    return out;
  });

  // (a) onboarded during era four: carries every earlier stamp, no era-four one
  let { c, p } = await load(() => {
    localStorage.clear();
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Remy", childAge: "7", focusSounds: ["R"], onboarded: true }));
  });
  let r = await ask(p);
  ok("an era-four family is swept in by the era-four sweep",
    r.stamp4 === "done" && r.early === true && r.era4 === true, JSON.stringify(r));
  ok("…and holds Premium for good — every game open, dead trial and all",
    r.premium === true && r.tiles === true && r.story === false, JSON.stringify(r));
  await c.close();

  // (b) household-wide, like every era before it
  ({ c, p } = await load(() => {
    localStorage.clear();
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done");
    localStorage.setItem("sona.kids.v1", JSON.stringify({ list: [{ slot: "", name: "A" }, { slot: "k2", name: "B" }], active: "" }));
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "A", childAge: "7", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.profile.v1@k2", JSON.stringify({ childName: "B", childAge: "4", focusSounds: ["S"] }));
  }));
  const sibs = await p.evaluate(() => ({
    a: (JSON.parse(localStorage.getItem("sona.profile.v1") || "{}")).earlyAdopter,
    b: (JSON.parse(localStorage.getItem("sona.profile.v1@k2") || "{}")).earlyAdopter,
  }));
  ok("era four is granted to the HOUSEHOLD, every profile on the device",
    sibs.a === true && sibs.b === true, JSON.stringify(sibs));
  await c.close();

  // (c) redeemed a clinician's link before this build, setup not finished
  ({ c, p } = await load(() => {
    localStorage.clear();
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done");
    localStorage.setItem("sona.slpok", "RACHEL-K4");        // what a pre-build redeem left behind
  }));
  r = await ask(p);
  ok("a device that redeemed a clinician's link before this build is kept, onboarded or not",
    r.stamp4 === "done" && r.early === true && r.premium === true, JSON.stringify(r));
  // …and finishing setup afterwards must not undo it: onboarding merges into
  // the profile the sweep wrote, and writes no earlyAdopter of its own
  const kept = await p.evaluate(() => {
    Sona.saveProfile({ childName: "Late", childAge: "6", focusSounds: ["S"], onboarded: true });
    sessionStorage.setItem("sona.paidui", "1");
    const out = { early: Sona.getProfile().earlyAdopter, premium: Sona.premium() };
    sessionStorage.removeItem("sona.paidui");
    return out;
  });
  ok("…and keeps it when setup finishes afterwards", kept.early === true && kept.premium === true, JSON.stringify(kept));
  await c.close();

  // (c2) slpunlock alone is the same evidence
  ({ c, p } = await load(() => {
    localStorage.clear();
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done");
    localStorage.setItem("sona.slpunlock", "1");
  }));
  r = await ask(p);
  ok("…whichever of the two credential keys it holds", r.early === true && r.premium === true, JSON.stringify(r));
  await c.close();

  // (d) a family whose first load is THIS build: stamped before they onboard
  // or redeem, and neither later act re-opens the sweep
  ({ c, p } = await load(() => localStorage.clear()));
  await p.evaluate(() => {
    Sona.saveProfile({ childName: "Newt", childAge: "7", focusSounds: ["R"], onboarded: true });
    localStorage.setItem("sona.slpok", "RACHEL-K4");        // redeemed AFTER this build
    localStorage.setItem("sona.slpunlock", "1");
  });
  await p.reload(); await p.waitForTimeout(600);
  r = await ask(p);
  ok("a family arriving after the era-four sweep is not adopted by it — not by setup, not by a link",
    r.stamp4 === "done" && !r.early && r.premium === false, JSON.stringify(r));
  ok("…and meets Premium locked like anyone else, whenever pricing is on",
    r.tiles === false && r.story === true, JSON.stringify(r));
  await c.close();
}

// ── THERE IS NO LIFETIME PRODUCT, AND THERE MUST NOT BE ONE ───────────
// /api/subscription used to scan Checkout Sessions for a one-time purchase and
// answer kind: "lifetime". Nothing in this codebase has ever SOLD one —
// /api/checkout opens subscription mode and only that — so the scan could only
// match something bought outside the app, and in its original form it matched
// paid SUBSCRIPTION sessions too, which is exactly how a cancelled subscriber
// restored permanent access. Travis retired the idea outright on 19 Sep 2026.
// Access comes from a live subscription: the one thing that can expire.
{
  // CODE, not commentary. The route's header explains WHY lifetime is gone and
  // therefore contains the very string being banned — the same describing-vs-
  // disavowing trap the README pin hit. Strip comments and ask what the code
  // actually does; the explanation is worth keeping and must not be squeezed
  // out by its own check.
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const sub = strip(readFileSync(ROOT + "/../app/api/subscription/route.ts", "utf8"));
  const chk = strip(readFileSync(ROOT + "/../app/api/checkout/route.ts", "utf8"));
  ok("the restore route never answers lifetime",
    !/kind:\s*"lifetime"/.test(sub),
    "permanent access that no product grants is a hole, not a plan");
  ok("…and no longer walks Checkout Sessions looking for one",
    !/checkout\.sessions\.list/.test(sub),
    "a paid session is a receipt for something that happened once, not live access");
  ok("…so access can only come from a subscription that is currently alive",
    /kind:\s*"subscription"/.test(sub) && /status === "active" \|\| s\.status === "trialing"/.test(sub));
  ok("checkout sells a subscription and nothing else",
    /mode:\s*"subscription"/.test(chk) && !/mode:\s*"payment"/.test(chk),
    "a one-time mode here is how a lifetime product would come back");
  // the retired monthly plan is a different thing and must survive: those
  // people are still billed, and a reinstall has to come back paid
  ok("…while an existing monthly subscriber still restores",
    !/interval|"month"/.test(sub.split("const customers")[1] || ""),
    "the subscription check is interval-agnostic on purpose");
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
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done");
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

// ── CASELOAD COVERAGE: Premium a clinician's plan pays for (24 Sep 2026) ──
// A family who joined through a clinician whose caseload is covered gets
// Premium; the server says so to a device that can show the enrolment ticket.
// Same discipline as the two rails above: only an authoritative answer changes
// anything, a failure changes nothing, and covered:false removes ONLY this
// grant — never a subscription, a founder key or a free-era promise.
{
  const ctx = await browser.newContext(); const pg = await ctx.newPage();
  const cov = { reply: { ok: true, covered: true }, calls: 0, bodies: [] };
  await ctx.route("**/api/slp/covered", async (route) => {
    cov.calls++;
    try { cov.bodies.push(route.request().postDataJSON()); } catch (e) { cov.bodies.push(null); }
    if (cov.reply === "boom") return route.abort("failed");
    if (cov.reply === 401) return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false }) });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cov.reply) });
  });
  await pg.goto("http://localhost:8147/today.html"); await pg.waitForTimeout(300);
  await pg.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Cal", childAge: "7", focusSounds: ["R"], onboarded: true, voiceOn: false, volume: 0 }));
    localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
  });
  const state = () => pg.evaluate(() => {
    sessionStorage.setItem("sona.paidui", "1");
    const out = { covered: Sona.caseCovered(), premium: Sona.premium(), tiles: Sona.gameAccess("tiles").allowed,
      plan: JSON.parse(localStorage.getItem("sona.caseplan.v1") || "null"), sub: JSON.parse(localStorage.getItem("sona.sub.v1") || "null"),
      early: Sona.getProfile().earlyAdopter };
    sessionStorage.removeItem("sona.paidui");
    return out;
  });

  // no credential, no question — and no Premium
  cov.calls = 0;
  let r = await pg.evaluate(() => Sona.caseRefresh(true));
  ok("a device with no enrolment ticket never asks, and is not covered",
    r === false && cov.calls === 0, JSON.stringify({ r, calls: cov.calls }));

  // the clinician's link was redeemed after this build: slpok + ticket, no grant
  await pg.evaluate(() => {
    localStorage.setItem("sona.slpok", "RACHEL-K4"); localStorage.setItem("sona.slpunlock", "1");
    localStorage.setItem("sona.slp", "RACHEL-K4"); localStorage.setItem("sona.slpticket", "TICKET-1");
  });
  let s0 = await state();
  ok("a verified credential alone opens no Premium game", s0.premium === false && s0.tiles === false, JSON.stringify(s0));

  cov.calls = 0; cov.bodies = []; cov.reply = { ok: true, covered: true };
  r = await pg.evaluate(() => Sona.caseRefresh(true));
  let s1 = await state();
  ok("a covered caseload grants Premium: every game opens",
    r === true && s1.covered && s1.premium && s1.tiles, JSON.stringify(s1));
  ok("…asking with the verified code and the ticket, and nothing about the child",
    cov.calls === 1 && JSON.stringify(Object.keys(cov.bodies[0] || {}).sort()) === '["code","ticket"]' &&
    cov.bodies[0].code === "RACHEL-K4" && cov.bodies[0].ticket === "TICKET-1", JSON.stringify(cov.bodies));

  cov.calls = 0;
  r = await pg.evaluate(() => Sona.caseRefresh());
  ok("a recent answer is trusted without another call", r === true && cov.calls === 0, JSON.stringify({ r, calls: cov.calls }));

  // failures are not answers
  cov.reply = "boom";
  r = await pg.evaluate(() => Sona.caseRefresh(true));
  let s2 = await state();
  ok("the server unreachable is not an ending — coverage survives", r === true && s2.covered === true, JSON.stringify(s2));
  cov.reply = 401;
  r = await pg.evaluate(() => Sona.caseRefresh(true));
  s2 = await state();
  ok("…nor is a refused ticket: one bad answer must not strip a caseload", r === true && s2.covered === true, JSON.stringify(s2));
  cov.reply = { ok: true };
  r = await pg.evaluate(() => Sona.caseRefresh(true));
  s2 = await state();
  ok("…nor a reply that does not say covered either way", r === true && s2.covered === true, JSON.stringify(s2));

  // a stale answer is re-asked, so a plan that ends eventually lands
  await pg.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("sona.caseplan.v1")); p.checked = Date.now() - 7 * 3600 * 1000;
    localStorage.setItem("sona.caseplan.v1", JSON.stringify(p));
    localStorage.setItem("sona.sub.v1", JSON.stringify({ active: true, source: "stripe", email: "a@b.com" }));
  });
  cov.calls = 0; cov.reply = { ok: true, covered: false };
  r = await pg.evaluate(() => Sona.caseRefresh());
  let s3 = await state();
  ok("a stale answer is re-asked, and covered:false revokes the coverage grant",
    cov.calls === 1 && r === false && s3.covered === false && s3.plan && s3.plan.active === false, JSON.stringify(s3));
  ok("…and ONLY that grant: a Stripe subscription on the same device survives",
    s3.sub && s3.sub.active === true && s3.premium === true, JSON.stringify(s3));
  await pg.evaluate(() => {
    localStorage.removeItem("sona.sub.v1");
    const p = JSON.parse(localStorage.getItem("sona.profile.v1")); p.earlyAdopter = true; localStorage.setItem("sona.profile.v1", JSON.stringify(p));
  });
  r = await pg.evaluate(() => Sona.caseRefresh(true));
  s3 = await state();
  ok("…and so does a free-era promise", s3.covered === false && s3.early === true && s3.premium === true, JSON.stringify(s3));

  // Home asks on load, beside Apple's sync
  await pg.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("sona.profile.v1")); delete p.earlyAdopter; localStorage.setItem("sona.profile.v1", JSON.stringify(p));
    localStorage.removeItem("sona.caseplan.v1");
  });
  cov.calls = 0; cov.reply = { ok: true, covered: true };
  await pg.goto("http://localhost:8147/today.html"); await pg.waitForTimeout(900);
  const home = await pg.evaluate(() => ({ covered: Sona.caseCovered(), locked: document.querySelectorAll("#thumbs .thumb.locked").length }));
  ok("Home re-checks coverage on load, and a covered family's tiles open without a reload",
    cov.calls === 1 && home.covered === true && home.locked === 0, JSON.stringify(Object.assign(home, { calls: cov.calls })));
  await ctx.close();
}

// ── THE PARENT HAND-OFF AND THE RECAP ───────────────────────────
// A parent was fetched by a child who had just finished something, and the
// first thing they saw was a price. They see what happened first now — in
// facts this device recorded, with every line dropped when its number is
// missing, because an invented recap on the page that asks for money is
// worse than no recap at all.
{
  const chg = readFileSync(ROOT + "/charge.html", "utf8");
  const sub = readFileSync(ROOT + "/subscribe.html", "utf8");
  // The final button is now reached after the chest. Its two eligibility
  // branches are exercised on the real page below, without pinning formatting.
  ok("the recap only renders on the hand-off from a completed run",
    /first=1\(&\|\$\)\/\.test\(location\.search\)\) return;/.test(sub));
  ok("…and every line is dropped when its number is missing",
    /if \(!out\.length\) return;/.test(sub) && /if \(reps > 0\)/.test(sub) && /if \(di && di\.playedToday\)/.test(sub),
    "dailyInfo() answers playedToday, never played — the old pin guarded a line that could not render");
  ok("…and it claims no improvement from one session",
    !/improv|better|progress(ing)?\b|mastered/i.test(
      (sub.match(/id="recapCard"[\s\S]*?<\/div>/) || [""])[0]),
    "one session cannot show improvement and the detector could not prove it");

  const ctx = await browser.newContext(); const pg = await ctx.newPage();
  await pg.goto("http://localhost:8147/today.html"); await pg.waitForTimeout(300);
  await pg.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Ada", childAge: "7", focusSounds: ["R"], onboarded: true }));
    sessionStorage.setItem("sona.gate.v1", String(Date.now()));
    sessionStorage.setItem("sona.paidui", "1");
  });

  // a parent arriving with nothing recorded must see no recap at all
  await pg.goto("http://localhost:8147/subscribe.html?first=1"); await pg.waitForTimeout(700);
  ok("a parent who arrives with nothing recorded is shown no recap",
    (await pg.evaluate(() => document.getElementById("recapCard").style.display)) !== "block");

  // …and one arriving after a real run sees only what the device actually holds
  await pg.evaluate(() => {
    const d = Sona.localDay();
    localStorage.setItem(Sona.kkey("sona.outcomes.v1"), JSON.stringify({ R: { days: { [d]: { a: 12, p: 9 } } } }));
    localStorage.setItem(Sona.kkey("sona.reps.v1"), JSON.stringify({ d: d, n: 12 }));
  });
  await pg.goto("http://localhost:8147/subscribe.html?first=1"); await pg.waitForTimeout(700);
  const recap = await pg.evaluate(() => ({
    shown: document.getElementById("recapCard").style.display,
    txt: document.getElementById("recapList").textContent,
    title: document.getElementById("recapTitle").textContent,
  }));
  ok("a real run produces a recap naming the sound and the count",
    recap.shown === "block" && /R sound/.test(recap.txt) && /12 words/.test(recap.txt), JSON.stringify(recap));
  ok("…addressed to the grown-up about their own child", /Ada/.test(recap.title), recap.title);
  ok("…and says nothing about a run that was never finished",
    !/finished/i.test(recap.txt), recap.txt);
  // navigate from NODE, never from inside evaluate: location.href there
  // destroys the execution context out from under the call that set it (the
  // same race that took slpcode's sibling block down on CI)
  await pg.goto("http://localhost:8147/subscribe.html"); await pg.waitForTimeout(700);
  ok("…and never appears without the hand-off flag",
    (await pg.evaluate(() => document.getElementById("recapCard").style.display)) !== "block");

  // A VISIBLE WAY TO SAY NO. There was a "Back to Sona" in the nav and a
  // "Back to Settings" link, and both read as navigation — a parent who had
  // just been fetched by their child and did not want to buy had to work out
  // that leaving was allowed. On the hand-off it is stated, beside the price.
  await pg.goto("http://localhost:8147/subscribe.html?first=1"); await pg.waitForTimeout(700);
  const decline = await pg.evaluate(() => {
    const r = document.getElementById("declineRow");
    const a = document.getElementById("declineLink");
    return { shown: r && r.style.display, text: a ? a.textContent : "", href: a ? a.getAttribute("href") : "",
             promise: r ? r.textContent : "" };
  });
  ok("the plan screen offers a stated decline, not just navigation",
    decline.shown === "block" && /not now/i.test(decline.text), JSON.stringify(decline));
  ok("…which goes home, where the demonstration still is",
    decline.href === "/today.html" && /still there/i.test(decline.promise), JSON.stringify(decline));
  // the one-time offer after a first run sells SONA PREMIUM, by name, the
  // way premium.html does — never a bare "Sona" plan (24 Sep 2026)
  const named = await pg.evaluate(() => ({
    heading: document.querySelector("#pickCard h2").textContent, title: document.getElementById("webTitle").textContent,
    card: document.getElementById("pickCard").innerText, line: document.getElementById("planLine").textContent,
    decline: document.getElementById("declineLink").textContent,
  }));
  ok("the first-run offer names the plan Sona Premium — heading, card and header line",
    /Sona Premium/.test(named.heading) && /^Sona Premium — /.test(named.title) && /Sona Premium/.test(named.line) &&
    !/Sona Yearly/.test(named.card) && !/keep Sona(?! Premium)/.test(named.card), JSON.stringify(named));
  ok("…and its decline keeps the free version, which is what saying no means now",
    /free version/.test(named.decline), named.decline);
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

  // Runtime checks below finish the fifth earned game, then claim the chest;
  // demo completion must coincide with that completed adventure.
  ok("…and is marked under way when practice starts, so a refresh resumes it",
    /practice started[\s\S]{0,320}demoStart\(\)/.test(chg));

  // The replay's writes are exercised below with a positive detected burst
  // and an actual completed run. Ladder gating keeps its separate source pin.
  ok("a replay banks no ladder advancement", /S\.recordRung && !DEMO_REPLAY/.test(chg));
  ok("…and the replay flag is read before demoFinish can change it",
    chg.indexOf("var DEMO_REPLAY") < chg.indexOf("S.demoFinish"),
    "decided at load, or the answer flips underneath the page");

  ok("Home offers normal free adventures after expiry instead of forcing rewardless replays",
    /S\.adventureGames\(\)/.test(tdy) && /charge\.html\?daily=1&first=/.test(tdy) && !/charge\.html\?daily=1&demo=1/.test(tdy),
    "free catalog practice stays available without changing explicit demo replay accounting");
}

// Finish the real final-game return and chest. The input boundary is already
// verified elsewhere; these checks isolate entitlement and replay accounting.
{
  for (const mode of ["entitled", "paid", "replay"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await ctx.route("**/*", route => route.request().url().startsWith("http://localhost:8147/") ? route.continue() : route.abort());
    await ctx.addInitScript(() => { if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error("No microphone in entitlement test")); });
    const pg = await ctx.newPage();
    try {
      await pg.goto("http://localhost:8147/today.html");
      await pg.evaluate(mode => {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done");
        localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Ada", childAge: "7", focusSounds: ["R"], onboarded: true, volume: 0, voiceOn: false, soundOn: false }));
        if (mode === "paid" || mode === "entitled") sessionStorage.setItem("sona.paidui", "1");
        if (mode === "entitled") localStorage.setItem("sona.sub.v1", JSON.stringify({ active: true, source: "apple", since: Date.now() }));
        if (mode === "replay") localStorage.setItem("sona.demo.v1", JSON.stringify({ started: Date.now() - 1000, done: Date.now() }));
        // The final arcade round is earned but has not returned yet.
        sessionStorage.setItem("sona.run.v1", JSON.stringify({ active: true, round: 4, scores: [10,10,10,10], sum: 40, tries: 12, sound: "R", pending: true, demo: mode === "replay", games: ["slice","tiles","stack","run","glide"] }));
      }, mode);
      const before = await pg.evaluate(() => ({ progress: Sona.getProgress(), outcomes: Sona.outcomes(), reps: Sona.repsToday(), daily: Sona.dailyInfo(), demoDone: Sona.demoDone() }));
      await pg.goto("http://localhost:8147/charge.html?daily=1&banked=17");
      await pg.locator("#runOvl.show").waitFor();
      const complete = await pg.evaluate(() => ({ done: Sona.demoDone(), round: run.round, title: document.getElementById("runTitle").textContent, buttonHidden: document.getElementById("runDone").hidden }));
      if (mode !== "replay") ok(mode + ": demonstration completes at the final-game celebration, before the chest handoff",
        !before.demoDone && complete.done && complete.round === 5 && /Adventure complete/.test(complete.title) && complete.buttonHidden, JSON.stringify(complete));
      await pg.locator("#runChest").click(); await pg.locator("#chestOvl.show").waitFor();
      for (let i = 0; i < 3; i++) await pg.locator("#chestBox").click();
      await pg.locator("#chestClaim").click(); await pg.locator("#runDone").waitFor({ state: "visible" });
      const handoff = await pg.evaluate(() => ({ eligible: Sona.planEligible(), label: document.getElementById("runDone").textContent, spent: localStorage.getItem("sona.planmoment.v1") }));
      if (mode !== "replay") ok(mode + ": the child fetches a grown-up only when a plan follows",
        handoff.eligible === (mode === "paid") && (handoff.eligible ? /Show a grown-up/.test(handoff.label) : handoff.label === "Done") && handoff.spent === null, JSON.stringify(handoff));
      if (mode === "replay") {
        const afterFinish = await pg.evaluate(() => ({ progress: Sona.getProgress(), daily: Sona.dailyInfo(), stickers: Object.keys(Sona.stickersEarned()).length }));
        ok("a replay banks no day's score, session, coins or sticker", JSON.stringify(before.progress) === JSON.stringify(afterFinish.progress) && JSON.stringify(before.daily) === JSON.stringify(afterFinish.daily) && afterFinish.stickers === 0, JSON.stringify(afterFinish));
        const burst = await pg.evaluate(async () => {
          const start = startEngine, verify = verifyClip;
          try {
            startEngine = async function () { reps = 3; return true; };
            verifyClip = async function () { return "pass"; };
            const verdict = await burstAndVerify(3);
            return { verdict, attemptsTotal, replay: DEMO_REPLAY, outcomes: Sona.outcomes(), reps: Sona.repsToday(), progress: Sona.getProgress() };
          } finally { startEngine = start; verifyClip = verify; }
        });
        ok("a replay's positive burst banks no clinical outcomes", burst.replay && burst.verdict === "pass" && burst.attemptsTotal === 3 && JSON.stringify(burst.outcomes) === JSON.stringify(before.outcomes), JSON.stringify(burst));
        ok("a replay's positive burst banks no rep count or practice history", burst.reps === before.reps && JSON.stringify(burst.progress) === JSON.stringify(before.progress), JSON.stringify(burst));
      }
    } finally { await ctx.close(); }
  }
}

// behaviourally: the gate opens for the demonstration and closes after it
{
  const ctx = await browser.newContext(); const pg = await ctx.newPage();
  await pg.goto("http://localhost:8147/today.html"); await pg.waitForTimeout(300);
  const seed = () => pg.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("sona.freeera.v1", "post");
    localStorage.setItem("sona.freeera2.v1", "done");
    localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Ada", childAge: "7", focusSounds: ["R"], onboarded: true }));
  });
  await seed(); await pg.reload(); await pg.waitForTimeout(500);

  // Asked as Premium content ("story") since 24 Sep 2026: practice is never
  // gated at all, so asking about practice here would pass for the wrong
  // reason. The demonstration's exemption is about everything else.
  const fresh = await pg.evaluate(() => ({
    gated: Sona.gated("story"), demo: Sona.demoDone(), trial: localStorage.getItem("sona.trial.v1"),
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
  // hold in BOTH states, which is the half that would rot silently.
  // REWRITTEN 24 Sep 2026: this asserted that PRACTICE gated after the
  // demonstration whenever pricing was on. That was the old promise — one
  // free run, then a wall — and the free version ends it: practice is never
  // gated in any state, and what closes after the demonstration is Premium.
  ok("…after which Premium content gates, whenever pricing is on",
    done.story === !IS_FREE_NOW, JSON.stringify(done));
  ok("…and practice NEVER does, in either state", done.practice === false, JSON.stringify(done));
  ok("…but the demonstration itself stays replayable, forever, either way",
    done.demo === false, String(done.demo));

  // an existing family mid-trial keeps every day they were promised
  const honoured = await pg.evaluate(() => {
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 86400000, days: 3 }));
    const alive = Sona.gated("story");
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 9 * 86400000, days: 3 }));
    return { alive, dead: Sona.gated("story"), practice: Sona.gated("practice") };
  });
  ok("an unexpired trial from before this change still opens the door",
    honoured.alive === false, JSON.stringify(honoured));
  ok("…and once it genuinely runs out, the Premium door closes — the practice door never does",
    honoured.dead === !IS_FREE_NOW && honoured.practice === false, JSON.stringify(honoured));
  await ctx.close();
}

// ── DEMO2: THE ROUND TRIP — the demonstration has to survive its own games ──
// The free session is charge → earned game → charge, five times, and every
// hop is a page load that asks the gate. Two bugs hid in that trip, both found
// by photographing it rather than reading it: the arcade pages asked the gate
// with no activity name, so a replay bounced to the PRICE PAGE at its first
// earned game; and the return URL carries only ?banked=N, so from round two a
// replay banked coins, rungs and clinical outcomes as if it were real.
// The run record in sessionStorage is now the source of truth for both.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const pg = await ctx.newPage();
  const seed = () => pg.evaluate(() => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Ada", childAge: "7", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: Date.now() }));   // session over, nobody bought
    localStorage.setItem("sona.micok", "1");
  });
  await pg.goto("http://localhost:8147/today.html"); await pg.waitForTimeout(300);
  await seed();

  // A. where a gated KID page sends the child now
  await pg.goto("http://localhost:8147/arcade-slice.html"); await pg.waitForTimeout(900);
  if (IS_FREE_NOW) console.log("  (free mode: bounce assertions below hold vacuously — nothing gates)");
  ok("a gated kid page goes HOME, never to a price screen",
    !/trial\.html/.test(pg.url()) && /today\.html/.test(pg.url()), pg.url());
  // null-safe on purpose: pre-fix this landed on trial.html, which has no
  // #heroSub, and a throw here would CRASH the suite at the first symptom and
  // hide every failure after it — the exact shape hwtest once died in
  const told = await pg.evaluate(() => ({ sub: (document.getElementById("heroSub") || {}).innerHTML || "", url: location.search }));
  ok("…and Home offers the child a playable adventure", /rounds/i.test(told.sub), told.sub);
  ok("…and the flag is forgotten so a reload does not nag", told.url === "", told.url);

  // B. a replay of the demonstration, all the way round
  await seed();
  await pg.goto("http://localhost:8147/charge.html?daily=1&demo=1"); await pg.waitForTimeout(900);
  const r1 = await pg.evaluate(() => ({
    url: location.pathname, run: JSON.parse(sessionStorage.getItem("sona.run.v1") || "null"),
    isDemo: window.IS_DEMO, replay: window.DEMO_REPLAY,
  }));
  ok("a replay starts a run whose record says so", !!(r1.run && r1.run.active && r1.run.demo === true), JSON.stringify(r1.run));
  ok("…and round one knows it earns nothing", r1.replay === true, JSON.stringify({ isDemo: r1.isDemo, replay: r1.replay }));

  // the earned game: this is the tap that used to land on the price page.
  // launchGame() marks the run pending and mints the play token before it
  // hands off; the test does the same two writes rather than driving the
  // five-rep charge, because the charge is not what is under test here.
  await pg.evaluate(() => {
    sessionStorage.setItem("sona.play.token", "1");
    const r = JSON.parse(sessionStorage.getItem("sona.run.v1")); r.pending = true; sessionStorage.setItem("sona.run.v1", JSON.stringify(r));
  });
  await pg.goto("http://localhost:8147/arcade-slice.html?from=charge&daily=1"); await pg.waitForTimeout(900);
  ok("the earned game OPENS — a run in progress is never gated",
    /arcade-slice\.html/.test(pg.url()), pg.url());

  // …and the way back, which carries only the score
  await pg.goto("http://localhost:8147/charge.html?daily=1&banked=10"); await pg.waitForTimeout(900);
  const r2 = await pg.evaluate(() => ({
    isDemo: window.IS_DEMO, replay: window.DEMO_REPLAY,
    run: JSON.parse(sessionStorage.getItem("sona.run.v1") || "null"), url: location.pathname,
  }));
  ok("round two arrives with no demo in the URL", r2.isDemo === false && /charge\.html/.test(r2.url), JSON.stringify(r2));
  ok("…and STILL earns nothing, because the run record remembers",
    r2.replay === true, "coins, rungs and clinical outcomes were banking from here on: " + JSON.stringify(r2));
  ok("…with the round advanced", !!(r2.run && r2.run.round === 1 && r2.run.demo === true), JSON.stringify(r2.run));

  // C. the negative control: it is the RUN that opens the door, not a wider gate
  await pg.evaluate(() => { sessionStorage.removeItem("sona.run.v1"); sessionStorage.setItem("sona.play.token", "1"); sessionStorage.setItem("sona.paidui", "1"); });
  await pg.goto("http://localhost:8147/arcade-tiles.html?from=charge&daily=1"); await pg.waitForTimeout(900);
  ok("with no saved run a generic token never opens an expired Premium game",
    /activities\.html\?locked=tiles$/.test(pg.url()), pg.url());

  // D. the window: a session never finished cannot stay free forever
  await pg.goto("http://localhost:8147/today.html"); await pg.waitForTimeout(300);
  const win = await pg.evaluate(() => {
    const H = 3600 * 1000, out = {};
    sessionStorage.removeItem("sona.run.v1");
    localStorage.setItem("sona.demo.v1", JSON.stringify({ started: Date.now() - 71 * H, done: 0 }));
    out.open = Sona.demoDone();
    localStorage.setItem("sona.demo.v1", JSON.stringify({ started: Date.now() - 73 * H, done: 0 }));
    out.closed = Sona.demoDone();
    // …but a run that is under way when it closes is finished, not interrupted
    sessionStorage.setItem("sona.run.v1", JSON.stringify({ active: true, round: 2, sum: 30, scores: [15, 15], pending: false }));
    out.midRun = Sona.gated("story");         // Premium content: practice never gates anyway
    sessionStorage.removeItem("sona.run.v1");
    return out;
  });
  ok("a demonstration still open at 71 hours is still the demonstration", win.open === false, JSON.stringify(win));
  ok("…and one left unfinished for 73 hours has closed", win.closed === true, JSON.stringify(win));
  ok("…but never underneath a run in progress", win.midRun === false, JSON.stringify(win));

  // E. Home keeps normal free adventures; Premium choices ask a grown-up.
  await seed();
  await pg.evaluate(() => { sessionStorage.setItem("sona.paidui", "1"); try { Sona.markStoryRead(); } catch (e) {} });
  await pg.goto("http://localhost:8147/today.html"); await pg.waitForTimeout(900);
  const home = await pg.evaluate(() => ({
    launch: document.getElementById("goBtn").dataset.launch,
    adventure: Sona.adventureGames().map(key => ({ key, allowed: Sona.gameAccess(key).allowed })),
    cards: [...document.querySelectorAll("#thumbs .thumb[data-key]")].map(card => ({ key: card.dataset.key, locked: card.classList.contains("locked"), tier: (Sona.gameAct(card.dataset.key) || {}).tier })),
    note: (document.getElementById("planNote") || {}).innerHTML || "",
  }));
  ok("an expired family's Home launches a full accessible adventure without demo replay",
    home.adventure.length === 5 && home.adventure.every(game => game.allowed) && /charge\.html\?daily=1/.test(home.launch) && !/demo=1/.test(home.launch), JSON.stringify(home));
  const freeCards = home.cards.filter(card => card.tier === "free"), premiumCards = home.cards.filter(card => card.tier === "premium");
  ok("Home leaves free cards open and marks Premium choices for grown-ups",
    freeCards.length > 0 && freeCards.every(card => !card.locked) && premiumCards.length > 0 && premiumCards.every(card => card.locked), JSON.stringify(home.cards));
  // REWRITTEN 24 Sep 2026: this pinned "Daily practice stays free" and "four
  // free games" as two loose fragments. Every family surface now says the
  // free version in ONE phrase — "daily practice and four free games" — so a
  // clinician's "two games" and Home's "four" can never disagree again.
  ok("the parent corner explains continuing free access and the Premium choice",
    /Daily practice and four free games stay free/.test(home.note) && /See Premium/.test(home.note) && /href="\/premium\.html"/.test(home.note), home.note.slice(0, 200));
  if (premiumCards.length) {
    await pg.evaluate(key => document.querySelector('#thumbs [data-key="' + key + '"]').click(), premiumCards[0].key);
    await pg.waitForURL(/today\.html\?gate=1/);
    const parentDoor = await pg.evaluate(() => ({ open: document.getElementById("gateOvl").classList.contains("show"), to: Sona.gateDest(new URLSearchParams(location.search).get("to")) }));
    ok("a Premium choice opens the parent gate with the selected game intact",
      parentDoor.open && parentDoor.to === "/premium.html?game=" + premiumCards[0].key, JSON.stringify(parentDoor));
  }
  await ctx.close();
}

// ── the ask lands AFTER the product has proved itself, never before ──
// Onboarding used to end at /subscribe.html, so a parent off an ad met a price
// screen before their child had said one word — and the 3-day trial was
// already burning. At 20 downloads that is the difference between learning
// "will parents pay" and learning nothing. These pin the new order.
{
  // Exercise the current explicit handoff instead of requiring its old Home
  // destination. Setup may launch practice directly; it must never launch a price.
  const obContext = await browser.newContext(); const obPage = await obContext.newPage();
  await obContext.route("**/charge.html?**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Practice handoff</title>" }));
  try {
    await obPage.goto("http://localhost:8147/onboarding.html");
    const firstGame = await obPage.evaluate(() => {
      sessionStorage.setItem("sona.paidui", "1");
      Sona.speak = () => Promise.resolve();
      draft.childName = "Ada"; draft.childAge = "7"; draft.mode = "speech"; draft.email = "";
      nameEl.value = "Ada"; selSounds = new Set(["R"]); finish();
      return Sona.adventureGames()[0];
    });
    await obPage.locator('[data-step="achieve"].on').waitFor();
    ok("onboarding waits for an explicit child handoff without starting a trial", /onboarding\.html/.test(obPage.url()) && await obPage.evaluate(() => !localStorage.getItem("sona.trial.v1")));
    await obPage.locator("#nextBtn").click(); await obPage.waitForURL(/charge\.html/);
    const destination = new URL(obPage.url());
    ok("onboarding ends in the first adventure, never at the paywall", destination.pathname === "/charge.html" && destination.searchParams.get("daily") === "1" && destination.searchParams.get("first") === firstGame, obPage.url());
  } finally { await obContext.close(); }

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
  // REWRITTEN 24 Sep 2026. This walked a list of five entitlements that
  // planEligible() had to name itself — the same list the gate kept, in a
  // second copy. It asks premium() now, and the list lives there (pinned in
  // the gate section above). What changed in the list is deliberate: an
  // SLP-code pilot or a verified credential no longer counts by itself, so a
  // clinician's family whose caseload is NOT covered is on the free version
  // and may see the one offer once — the behavioural pins below say so.
  ok("…and never asks a family who already has every game: it asks premium()",
    /if \(premium\(\)\) return false;/.test(el) && !/slpVerified\(\)|isPilot\(\)/.test(el),
    "a second list here is how the ask and the gate drifted: " + el.slice(0, 200));
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
    localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done");
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

  // REWRITTEN 24 Sep 2026. This said "a referred / pilot family is never
  // shown a price" and enrolled an SLP-code pilot to prove it. The founding
  // programme's pilots ("ff-…") keep that promise; a clinician's family is
  // never asked while their caseload is covered, and — the change — is on the
  // free version, and may see the one offer, while it is not.
  //
  // REWRITTEN AGAIN the same day. The SLP-code enrolment below used to be
  // pinned as REPLACING the founding code "in the same slot" — and with it,
  // silently, the founding family's Premium: foundingPilot() read the
  // per-child pilot code, which "Yes, share progress" overwrites. Founding
  // status is the household's now (sona.founding.v1), and startPilot carries
  // an older device's "ff-" code into it before overwriting the slot. So the
  // same sequence now pins the opposite: the founding family keeps Premium.
  // The uncovered clinician's family is a family that was never founding.
  const pilots = await pg.evaluate(() => {
    const ask = () => { localStorage.removeItem("sona.planmoment.v1"); return Sona.planEligible(); };
    sessionStorage.setItem("sona.paidui", "1");
    Sona.startPilot("ff-abc123");            // a device enrolled before the household key existed
    const founding = ask();
    Sona.startPilot("RACHEL-K4");            // same slot: the SLP-code enrolment replaces the code…
    const afterJoin = { ask: ask(), premium: Sona.premium(), code: Sona.pilotInfo().code, mark: localStorage.getItem("sona.founding.v1") };
    // …a family that was never founding, on the same uncovered caseload
    localStorage.removeItem("sona.founding.v1"); localStorage.removeItem("sona.pilot.v1");
    Sona.startPilot("RACHEL-K4");
    const uncovered = ask();
    localStorage.setItem("sona.caseplan.v1", JSON.stringify({ active: true, code: "RACHEL-K4", checked: Date.now() }));
    const covered = ask();
    localStorage.removeItem("sona.caseplan.v1");
    sessionStorage.removeItem("sona.paidui");
    return { founding, afterJoin, uncovered, covered };
  });
  ok("a founding pilot is never shown a price", pilots.founding === false, JSON.stringify(pilots));
  ok("…and keeps Premium when a clinician's enrolment replaces its pilot code — founding is the household's",
    pilots.afterJoin.code === "RACHEL-K4" && pilots.afterJoin.premium === true && pilots.afterJoin.ask === false &&
    /"code":"ff-abc123"/.test(pilots.afterJoin.mark || ""), JSON.stringify(pilots));
  ok("…nor a family whose clinician's caseload is covered", pilots.covered === false, JSON.stringify(pilots));
  ok("…but a clinician's family on an uncovered caseload may see the one offer", pilots.uncovered === true, JSON.stringify(pilots));
  await ctx.close();
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
