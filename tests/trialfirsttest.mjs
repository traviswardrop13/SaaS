// TRIAL FIRST (Travis, 3 Oct 2026): "lets add the paywall before they try
// anything in the app. and then they unlock everything. so fruit slice and
// piano tiles and feed echo and bubble pop are all part of paid or needing to
// start a trial", then, with ReciMe's onboarding screenshots ("We offer 7 days
// free…", "You'll get a reminder…", "Design your trial"): "something like
// this. yeah home locked".
//
// This plays the rule and the flow on fake phones:
//   - who keeps the free version (Sona.freeVersion): a phone that cannot buy
//     (no purchase plugin, or a browser while the website does not sell), a
//     household already set up on the build's first load (the one-shot
//     "sona.freever.v1" sweep), a family who joined through their speech
//     therapist; nobody else;
//   - setup ends on the plan screen for a family who starts with the trial;
//   - the plan screen opens on two screens first, only when the store says
//     the plan starts with free days (in the app, Sona Monthly: the one
//     plan Apple's card sells since 5 Oct 2026), and the second one says the
//     real date and where to cancel (no reminder: Sona sends none);
//   - "Not now" goes to Home with every game and book locked;
//   - the free days starting opens the first game setup chose.
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2", json: "application/json", wav: "audio/wav", mp3: "audio/mpeg" };
const server = createServer((req, res) => {
  const u = new URL(req.url, "http://localhost"), f = path.join(ROOT, u.pathname);
  if (u.pathname.startsWith("/api/")) { res.writeHead(503); res.end("{}"); return; }
  if (!existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[f.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8273, "127.0.0.1", r));
const BASE = "http://127.0.0.1:8273";
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(detail))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, e.stack); } }

// A phone. cfg.app: "buy" (the app with the purchase plugin), "nobuy" (an app
// build without it, like the App Store's 1.0.4) or absent (a browser).
// cfg.stamp: what the free-version sweep already wrote ("kept"/"post"), or
// absent for a phone loading this build for the first time. cfg.setUp seeds a
// set-up child; cfg.slp a clinician's verified link; cfg.webSells the website
// selling (its test seam); cfg.intro what the store says of the monthly plan,
// the only one the Apple card offers since 5 Oct 2026:
// "free3" (3 free days), "none" (charged today) or "hang" (never answers).
function phone(cfg) {
  const once = (k, v) => { if (localStorage.getItem(k) == null) localStorage.setItem(k, v); };
  if (cfg.app) {
    const ent = () => localStorage.getItem("__ent") === "1";
    const info = () => ({ customerInfo: { entitlements: { active: ent() ? { full: { isActive: true } } : {} } } });
    const P = {
      configure: async () => {},
      getProducts: async ({ productIdentifiers }) => {
        const id = (productIdentifiers || [])[0] || "com.speaksona.app.annual";
        const monthly = id.indexOf("monthly") > -1;
        if (monthly && cfg.intro === "hang") return new Promise(() => {});
        return { products: [{ identifier: id, priceString: monthly ? "$9.99" : "$59.99", price: monthly ? 9.99 : 59.99,
          introPrice: monthly && cfg.intro === "free3" ? { price: 0, priceString: "$0.00", period: "P3D", periodUnit: "DAY", periodNumberOfUnits: 3, cycles: 1 } : null }] };
      },
      purchaseStoreProduct: async (a) => { localStorage.setItem("__ent", "1"); localStorage.setItem("__bought", (a && a.product && a.product.identifier) || "?"); return info(); },
      restorePurchases: async () => info(),
      getCustomerInfo: async () => info(),
    };
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", Plugins: cfg.app === "buy" ? { Purchases: P } : {} };
  }
  // every free era already swept: none of them is this phone's
  once("sona.freeera.v1", "post"); for (const k of ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"]) once(k, "done");
  if (cfg.stamp) once("sona.freever.v1", cfg.stamp);
  if (cfg.setUp) once("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: cfg.age || "7", focusSounds: ["R"], onboarded: true, voiceOn: false, soundOn: false }));
  if (cfg.slp) once("sona.slpok", "1");
  if (cfg.webSells) sessionStorage.setItem("sona.websalesui", "1");
  if (!cfg.noGate) sessionStorage.setItem("sona.gate.v1", String(Date.now()));
}
async function fresh(cfg = {}, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await context.route("**/*", (r) => r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort());
  await context.addInitScript(phone, cfg);
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  return { context, page, errors };
}
const FREE4 = ["slice", "tiles", "feed", "bubbles"];
const rule = (page) => page.evaluate((keys) => ({
  stamp: localStorage.getItem("sona.freever.v1"),
  free: Sona.freeVersion(), first: Sona.trialFirst(),
  open: keys.filter((k) => Sona.gameAccess(k).allowed),
  book: Sona.bookFree("Rory and the Rainbow") && !Sona.bookLocked("Rory and the Rainbow"),
  practice: !Sona.gated("practice"),
}), FREE4);

try {
  // ── the rule: who keeps the free version ──
  await scenario("a new phone in the app that can buy", async () => {
    const { context, page, errors } = await fresh({ app: "buy" });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => window.Sona && Sona.freeVersion);
      const r = await rule(page);
      ok("a new phone in the app that can buy is stamped before it is set up, and has no free version", r.stamp === "post" && r.free === false, r);
      ok("…so Fruit Slice, Piano Tiles, Feed Echo and Bubble Pop are locked, with the free book and practice", r.open.length === 0 && !r.book && !r.practice, r);
      ok("…and its setup ends on the plan screen", r.first === true, r);
      ok("new phone: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  await scenario("a phone set up before this build", async () => {
    const { context, page, errors } = await fresh({ app: "buy", setUp: true });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => window.Sona && Sona.freeVersion);
      const r = await rule(page);
      ok("a phone already set up on its first load keeps the free version: the four games, the free book and practice", r.stamp === "kept" && r.free && r.open.length === 4 && r.book && r.practice && !r.first, r);
      ok("…and the mark is one-shot: a later load never re-judges it", await page.evaluate(() => { localStorage.removeItem("sona.profile.v1"); return true; }) &&
        await page.reload().then(() => page.waitForFunction(() => window.Sona && Sona.freeVersion)).then(() => page.evaluate(() => localStorage.getItem("sona.freever.v1") === "kept" && Sona.freeVersion())), "");
      ok("kept: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  for (const [label, cfg] of [
    ["an app build with no purchase plugin (the App Store's 1.0.4)", { app: "nobuy", stamp: "post", setUp: true }],
    ["a browser while the website does not sell", { stamp: "post", setUp: true }],
    ["a family who joined through their speech therapist", { app: "buy", stamp: "post", setUp: true, slp: true }],
  ]) await scenario(label, async () => {
    const { context, page, errors } = await fresh(cfg);
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => window.Sona && Sona.freeVersion);
      const r = await rule(page);
      ok(label + ": keeps the free version, so nobody meets a wall they cannot pass", r.free && r.open.length === 4 && r.book && r.practice && !r.first, r);
      ok(label + ": no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  await scenario("a browser while the website sells", async () => {
    const { context, page } = await fresh({ stamp: "post", setUp: true, webSells: true });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => window.Sona && Sona.freeVersion);
      const r = await rule(page);
      ok("a browser where the website sells is like the app: no free version for a family set up after the build", !r.free && r.open.length === 0 && r.first, r);
    } finally { await context.close(); }
  });
  await scenario("Premium", async () => {
    const { context, page } = await fresh({ app: "buy", stamp: "post", setUp: true });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => window.Sona && Sona.freeVersion);
      await page.evaluate(() => localStorage.setItem("sona.founder", "1"));
      const r = await page.evaluate((keys) => ({ premium: Sona.premium(), open: keys.filter((k) => Sona.gameAccess(k).allowed), first: Sona.trialFirst(), practice: !Sona.gated("practice") }), FREE4);
      ok("Premium from any source still opens all four games and practice, and setup never shows it a price", r.open.length === 4 && r.practice && !r.first, r);
    } finally { await context.close(); }
  });
  await scenario("a backup", async () => {
    const { context, page } = await fresh({ app: "buy", stamp: "post", setUp: true });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => window.Sona && Sona.importData);
      const r = await page.evaluate(() => { const res = Sona.importData({ app: "sona", v: 1, data: { "sona.freever.v1": "kept", "sona.profile.v1": JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true }) } });
        return { ok: res && res.ok !== false, stamp: localStorage.getItem("sona.freever.v1"), free: Sona.freeVersion() }; });
      ok("a pasted backup never brings the kept mark: the phone that loaded it stays as it was judged", r.stamp === "post" && r.free === false, r);
    } finally { await context.close(); }
  });

  // ── the source: setup's last tap ──
  {
    const ob = readFileSync(ROOT + "/onboarding.html", "utf8");
    ok("a parent's setup ends on the plan screen (?setup=1) when the trial comes first, else in the first game; a clinician's on Home",
      /var first="\/today\.html";try\{if\(draft\.role!=="slp"&&Sona\.firstGameStart\)first=Sona\.firstGameStart\(\);\}catch\(e\)\{\}\s*var wall=false;try\{wall=draft\.role!=="slp"&&!!\(Sona\.trialFirst&&Sona\.trialFirst\(\)\);\}catch\(e\)\{\}\s*if\(wall\)\{try\{sessionStorage\.setItem\("sona\.gate\.v1",String\(Date\.now\(\)\)\);\}catch\(e\)\{\} first="\/subscribe\.html\?setup=1";\}\s*location\.href=first;/.test(ob));
  }
  await scenario("setup's last tap", async () => {
    for (const [label, cfg, want] of [
      ["trial first", { app: "buy" }, /\/subscribe\.html\?setup=1$/],
      ["a phone that cannot buy", { app: "nobuy" }, /\/charge\.html\?game=arcade-slice\.html$/],
    ]) {
      const { context, page, errors } = await fresh(cfg);
      try {
        await page.goto(BASE + "/onboarding.html"); await page.waitForFunction(() => typeof finish === "function" && window.Sona);
        await page.evaluate(() => { draft.role = "parent"; draft.childName = "Mia"; draft.childAge = "7"; try { nameEl.value = "Mia"; } catch (e) {} selSounds.add("R"); finish(); });
        await page.waitForFunction(() => document.getElementById("nextBtn").textContent === "Let's play!" && !document.getElementById("nextBtn").disabled, null, { timeout: 12000 });
        await page.locator("#nextBtn").click();
        await page.waitForURL(want, { timeout: 8000 });
        ok("setup, " + label + ": \"Let's play!\" goes to " + new URL(page.url()).pathname + new URL(page.url()).search, want.test(page.url()), page.url());
        if (label === "trial first") ok("…with the grown-ups check already passed (a grown-up just set Sona up) and the first game marked for this tab",
          await page.evaluate(() => !!sessionStorage.getItem("sona.gate.v1") && sessionStorage.getItem("sona.firstgame.v1") === "slice"));
        ok("setup, " + label + ": no page errors", errors.length === 0, errors);
      } finally { await context.close(); }
    }
  });

  // ── the plan screen on the hand-off from setup ──
  const SEEN = (page) => page.evaluate(() => ({
    intro: !document.getElementById("trialIntro").hidden,
    one: !document.getElementById("tiFree").hidden, two: !document.getElementById("tiDate").hidden,
    title1: document.getElementById("tiFreeTitle").textContent.replace(/\s+/g, " ").trim(),
    title2: document.getElementById("tiDateTitle").textContent.replace(/\s+/g, " ").trim(),
    sub2: document.getElementById("tiDateSub").textContent.replace(/\s+/g, " ").trim(),
    card: getComputedStyle(document.getElementById("iapCard")).display !== "none" && document.getElementById("iapCard").getBoundingClientRect().height > 0,
    offer: document.body.classList.contains("offer"),
    spent: localStorage.getItem("sona.planmoment.v1"),
  }));
  await scenario("the two screens", async () => {
    const { context, page, errors } = await fresh({ app: "buy", stamp: "post", setUp: true, intro: "free3" });
    try {
      await page.goto(BASE + "/subscribe.html?setup=1");
      await page.waitForFunction(() => document.getElementById("tiFreeTitle").style.visibility !== "hidden" && !document.getElementById("tiFree").hidden);
      if (process.env.TRIAL_SHOTS) await page.screenshot({ path: process.env.TRIAL_SHOTS + "/1-free.png" });
      let s = await SEEN(page);
      ok("the store says the monthly plan starts with 3 free days, so the first screen says so, and the price waits behind it",
        s.intro && s.one && !s.two && s.title1 === "We offer 3 days free so every kid can practice with Echo." && !s.card, s);
      ok("…the price is not counted as seen yet", !s.spent, s.spent);
      const end = await page.evaluate(() => new Date(Date.now() + 3 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric" }));
      await page.locator("#tiFreeGo").click();
      if (process.env.TRIAL_SHOTS) await page.screenshot({ path: process.env.TRIAL_SHOTS + "/2-date.png" });
      s = await SEEN(page);
      ok("Continue: the second screen names the day the free days end, and where to cancel, and promises no reminder",
        !s.one && s.two && s.title2 === "Nothing to pay until " + end + "." && s.sub2 === "Cancel anytime before then, in Settings → Subscriptions." && !/remind/i.test(s.title2 + s.sub2), s);
      await page.locator("#tiDateGo").click();
      await page.waitForFunction(() => document.getElementById("trialIntro").hidden);
      if (process.env.TRIAL_SHOTS) { await page.waitForTimeout(400); await page.screenshot({ path: process.env.TRIAL_SHOTS + "/3-price.png" }); }
      s = await SEEN(page);
      ok("Continue: the price screen, as the offer, and only now counted as seen", !s.intro && s.card && s.offer && !!s.spent, s);
      const v = await page.evaluate(() => ({
        btn: document.getElementById("iapBuy").textContent, decline: document.getElementById("declineLink").textContent,
        declineShown: getComputedStyle(document.getElementById("declineRow")).display !== "none",
        freeCard: getComputedStyle(document.getElementById("freeTierCard")).display !== "none",
        check3: document.getElementById("offerCheck3").textContent, sub: document.getElementById("offerSub").textContent,
        line: document.getElementById("planLine").innerHTML,
        body: document.body.innerText,
      }));
      ok("…the one plan, 3 days free then $9.99 a month, \"Not now\" (not \"keep the free version\") under it, and no \"What stays free\"",
        v.btn === "Start 3 days free" && /3 days free, then \$9\.99 a month/.test(v.body) && !/a year/i.test(v.body) && v.declineShown && v.decline === "Not now" && !v.freeCard, v);
      ok("…and nothing on it says anything stays free", !/stays? free|free games|free version/i.test(v.body) && v.check3 === "Cancel anytime in Settings" && /^Games for /.test(v.sub) && !/free version/.test(v.line), (v.body.match(/[^\n]*(stays? free|free games|free version)[^\n]*/i) || [v.check3, v.sub])[0]);
      ok("the two screens: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  await scenario("the free days start", async () => {
    const { context, page, errors } = await fresh({ app: "buy", stamp: "post", setUp: true, intro: "free3" });
    try {
      await page.goto(BASE + "/onboarding.html"); await page.waitForFunction(() => window.Sona && Sona.firstGameStart);
      await page.evaluate(() => Sona.firstGameStart());
      await page.goto(BASE + "/subscribe.html?setup=1");
      await page.waitForFunction(() => !document.getElementById("tiFree").hidden && document.getElementById("tiFreeGo").style.visibility !== "hidden");
      await page.locator("#tiFreeGo").click(); await page.locator("#tiDateGo").click();
      await page.locator("#iapBuy").click();
      await page.waitForURL(/\/charge\.html\?game=arcade-slice\.html$/, { timeout: 8000 });
      ok("starting the free days opens the first game setup chose (Fruit Slice's practice page for a 7-year-old), not Home",
        /\/charge\.html\?game=arcade-slice\.html$/.test(page.url()) && await page.evaluate(() => localStorage.getItem("__bought") === "com.speaksona.app.monthly" && Sona.premium()), page.url());
      ok("free days started: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  await scenario("Not now", async () => {
    const { context, page, errors } = await fresh({ app: "buy", stamp: "post", setUp: true, intro: "free3" });
    try {
      await page.goto(BASE + "/subscribe.html?setup=1");
      await page.waitForFunction(() => !document.getElementById("tiFree").hidden && document.getElementById("tiFreeGo").style.visibility !== "hidden");
      await page.locator("#tiFreeGo").click(); await page.locator("#tiDateGo").click();
      await page.locator("#declineLink").click();
      await page.waitForURL(/\/today\.html/);
      await page.waitForFunction(() => document.querySelectorAll(".game-card").length > 0);
      if (process.env.TRIAL_SHOTS) { await page.waitForTimeout(600); await page.screenshot({ path: process.env.TRIAL_SHOTS + "/4-home.png" }); }
      const h = await page.evaluate((keys) => keys.map((k) => { const b = document.querySelector('#activityGroups .game-card[data-game="' + k + '"]');
        return b ? { k, locked: b.dataset.locked, label: (b.querySelector(".game-access") || {}).textContent } : { k, missing: true }; }), FREE4);
      ok("\"Not now\" goes Home with Fruit Slice, Piano Tiles, Feed Echo and Bubble Pop locked, each marked Premium, none \"Free\"",
        h.every((c) => c.locked === "true" && c.label === "Premium"), h);
      const books = await page.evaluate(() => document.getElementById("booksTag").textContent);
      ok("…and the Books card says Premium, not \"1 free book\"", books === "Premium", books);
      // a grey game opens the price at once (Travis, 4 Oct 2026: "I want it
      // to open automatically if they click on a game that is grayed out")
      await page.locator('#activityGroups .game-card[data-game="slice"]').click();
      await page.waitForURL(/\/subscribe\.html\?from=slice$/);
      await page.waitForFunction(() => document.body.classList.contains("offer"));
      const o = await page.evaluate(() => ({ title: document.getElementById("offerTitle").textContent, card: getComputedStyle(document.getElementById("iapCard")).display !== "none", decline: document.getElementById("declineLink").textContent }));
      ok("a tap on grey Fruit Slice opens the price at once, on that game, with \"Not now\" under it", /^Unlock Fruit Slice, and every other game$/.test(o.title) && o.card && o.decline === "Not now", o);
      ok("Not now: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  for (const [label, intro] of [["the store sells the monthly plan with no free days", "none"], ["the store never answers", "hang"]]) await scenario(label, async () => {
    const { context, page, errors } = await fresh({ app: "buy", stamp: "post", setUp: true, intro });
    try {
      const t0 = Date.now();
      await page.goto(BASE + "/subscribe.html?setup=1");
      await page.waitForFunction(() => document.getElementById("trialIntro").hidden && document.body.classList.contains("offer"), null, { timeout: 6000 });
      const s = await SEEN(page), took = Date.now() - t0;
      ok(label + ": no screen says \"free\"; the price screen shows " + (intro === "hang" ? "within 2.5 seconds" : "straight away"), !s.intro && s.card && (intro === "none" || took < 4500), { s, took });
      ok(label + ": no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  for (const [w, h] of [[320, 568], [375, 667]]) await scenario("phone " + w, async () => {
    const { context, page, errors } = await fresh({ app: "buy", stamp: "post", setUp: true, intro: "free3" }, { width: w, height: h });
    try {
      await page.goto(BASE + "/subscribe.html?setup=1");
      await page.waitForFunction(() => !document.getElementById("tiFree").hidden && document.getElementById("tiFreeGo").style.visibility !== "hidden");
      const fit = await page.evaluate(() => { const b = document.getElementById("tiFreeGo").getBoundingClientRect(), t = document.getElementById("tiFreeTitle").getBoundingClientRect();
        return { top: t.top, bottom: b.bottom, h: innerHeight, w: innerWidth, sw: document.documentElement.scrollWidth }; });
      ok(w + "x" + h + ": the first screen's words and Continue are on the screen, with no sideways scroll", fit.top >= 0 && fit.bottom <= fit.h && fit.sw <= fit.w, fit);
      await page.locator("#tiFreeGo").click();
      const fit2 = await page.evaluate(() => { const b = document.getElementById("tiDateGo").getBoundingClientRect(); return { bottom: b.bottom, h: innerHeight }; });
      ok(w + "x" + h + ": and the second screen's Continue", fit2.bottom <= fit2.h, fit2);
      ok(w + ": no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });

  // ── a grey game or book, with no grown-up check this session ──
  await scenario("a grey game, no check", async () => {
    const { context, page, errors } = await fresh({ app: "buy", stamp: "post", setUp: true, intro: "free3", noGate: true });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => document.querySelectorAll(".game-card").length > 0);
      await page.locator('#activityGroups .game-card[data-game="stack"]').click();
      await page.waitForURL(/\/subscribe\.html\?from=stack$/);
      await page.waitForFunction(() => document.body.classList.contains("offer") && getComputedStyle(document.getElementById("iapCard")).display !== "none");
      await page.waitForTimeout(400);
      const v = await page.evaluate(() => ({ path: location.pathname + location.search, shown: getComputedStyle(document.documentElement).display !== "none" && getComputedStyle(document.documentElement).visibility !== "hidden",
        tabs: getComputedStyle(document.querySelector(".family-tabs")).display === "none", gate: !!sessionStorage.getItem("sona.gate.v1") }));
      ok("a grey game opens the price with no grown-up check in between, and opens nothing else of the grown-ups' pages", v.path === "/subscribe.html?from=stack" && v.shown && v.tabs && !v.gate, v);
      ok("grey game, no check: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  await scenario("a grey book", async () => {
    const { context, page, errors } = await fresh({ app: "buy", stamp: "post", setUp: true, intro: "free3", noGate: true });
    try {
      await page.goto(BASE + "/library.html"); await page.waitForFunction(() => document.querySelectorAll(".bookBtn.locked").length > 0);
      await page.locator(".bookBtn.locked").first().click();
      await page.waitForURL(/\/subscribe\.html\?from=library$/, { timeout: 6000 });
      ok("a grey book opens the price at once too", /\/subscribe\.html\?from=library$/.test(page.url()), page.url());
      ok("grey book: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  await scenario("a phone that cannot buy", async () => {
    const { context, page, errors } = await fresh({ app: "nobuy", stamp: "post", setUp: true });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => document.querySelectorAll(".game-card").length > 0);
      await page.locator('#activityGroups .game-card[data-game="stack"]').click();
      await page.waitForTimeout(500);
      const v = await page.evaluate(() => ({ path: location.pathname, notice: !document.getElementById("libraryNotice").hidden, msg: document.getElementById("libraryMessage").textContent }));
      ok("on a phone that cannot buy, a grey game still shows the grown-up note: there is nothing to open", v.path === "/today.html" && v.notice && /^Ask a grown-up to help open Block Stacker\./.test(v.msg), v);
      ok("cannot buy: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  await scenario("the plan page by address, with Premium", async () => {
    const { context, page } = await fresh({ app: "buy", stamp: "post", setUp: true, noGate: true });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => window.Sona && Sona.premium);
      await page.evaluate(() => localStorage.setItem("sona.founder", "1"));
      await page.goto(BASE + "/subscribe.html?from=stack");
      await page.waitForURL(/\/today\.html\?gate=1/, { timeout: 6000 }).catch(() => {});
      ok("a ?from= visit that shows no offer (this family has Premium) is Settings › Your plan, and asks the grown-up check", /\/today\.html\?gate=1/.test(page.url()), page.url());
    } finally { await context.close(); }
  });

  // ── a family who keeps the free version sees the page as it was ──
  await scenario("kept family, Settings view", async () => {
    const { context, page, errors } = await fresh({ app: "buy", setUp: true, intro: "free3" });
    try {
      await page.goto(BASE + "/subscribe.html");
      await page.waitForFunction(() => getComputedStyle(document.getElementById("iapCard")).display !== "none");
      const v = await page.evaluate(() => ({ line: document.getElementById("planLine").textContent, intro: !document.getElementById("trialIntro").hidden }));
      ok("a family who kept the free version still reads \"Today: the free version\", and Settings never opens on the two screens", /^Today: the free version\./.test(v.line) && !v.intro, v);
      ok("kept family: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  // ── the old daily run asks the practice gate too ──
  await scenario("the old daily run", async () => {
    const { context, page } = await fresh({ app: "buy", stamp: "post", setUp: true });
    try {
      await page.goto(BASE + "/charge.html?daily=1");
      await page.waitForURL((u) => !/\/charge\.html/.test(u.pathname), { timeout: 5000 }).catch(() => {});
      ok("a typed address to the old daily run sends a family without the free version Home, before any mic or sound", !/\/charge\.html/.test(new URL(page.url()).pathname), page.url());
    } finally { await context.close(); }
  });
  // ── the grown-ups check carries the hand-off ──
  await scenario("the gate", async () => {
    const { context, page } = await fresh({ app: "buy", stamp: "post", setUp: true });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => window.Sona && Sona.gateDest);
      const d = await page.evaluate(() => [Sona.gateDest("/subscribe.html?setup=1"), Sona.gateDest("/subscribe.html?setup=2")]);
      ok("the grown-ups check carries ?setup=1 to the plan screen, and nothing else of it", d[0] === "/subscribe.html?setup=1" && d[1] === "/subscribe.html", d);
    } finally { await context.close(); }
  });
} finally { await browser.close(); await new Promise((r) => server.close(r)); }
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
