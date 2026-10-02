// WEBSALES1: families no longer pay on the website. The pages beside the plan
// screen, in BOTH states of the switch.
// Travis, 1 Oct 2026: "i dont want them paying on the website". A family buys
// Sona Premium only in the iPhone and iPad app now, so a browser is told where
// it is bought and shown no figure: the price there is App Store Connect's.
// The selling state stays in every page for the day the switch flips back, and
// this suite plays both through the session seam ("sona.websalesui": "1" shows
// the web rails, "0" hides them), so neither rots whichever way it ships. It
// never pins the switch's value: the one place it needs it, it reads it from
// sona.js.
//   trial.html    — the one page outside the plan screen that printed a price.
//                   Two blocks, both shipped hidden; a script shows exactly one.
//                   Rachel's line and Restore access sit outside both, because
//                   this is the restore door the success page links to.
//   settings.html — Account's plan links open the plan screen (/subscribe.html),
//                   never the website's own checkout page (/subscribe), which
//                   sends the iPhone app back to Home.
// The plan screen itself is freetest's and iaptest's; the clinician's
// dashboard line is slpdesigntest's. Visibility is judged by what is laid out
// on the page (computed style, a real box, innerText), never by reading text
// out of an element nobody can see.
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const PORT = 8271, BASE = "http://localhost:" + PORT;
const APP_STORE = "https://apps.apple.com/us/app/sona-speech/id6785755867";
let fails = 0;
const ok = (name, pass, detail) => { if (!pass) fails++; console.log((pass ? "PASS " : "FAIL ") + name + (pass || detail === undefined ? "" : " → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); };
async function scenario(name, run) { try { await run(); } catch (e) { ok(name + " completes", false, String((e && e.stack) || e)); } }

// What /api/charter and /api/subscription answer is the test's to set; every
// request to them is counted, and so is anything that reaches for a checkout.
const CHARTER_OPEN = { ok: true, free: false, webSales: true, cap: 50, taken: 12, left: 38, open: true, source: "stripe", price: "$59.99", standard: "$99.99", label: "Charter", monthly: "$9.99" };
const CHARTER_GONE = { ...CHARTER_OPEN, taken: 50, left: 0, open: false };
// the route's own answer while the website does not sell: no price fields
const CHARTER_OFF = { ok: true, free: false, webSales: false, cap: 50, taken: 0, left: 0, open: false, source: "off" };
let CHARTER = CHARTER_OPEN, SUB = { ok: true, active: false };
const hits = { charter: 0, sub: 0, checkout: 0 };
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", webp: "image/webp", woff2: "font/woff2", json: "application/json", webmanifest: "application/manifest+json" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const json = (o, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (u.pathname === "/__seed") { res.writeHead(200, { "content-type": "text/html" }); return res.end("<!doctype html><title>seed</title>"); }
  if (u.pathname === "/api/charter") { hits.charter++; return json(CHARTER); }
  if (u.pathname === "/api/subscription") { hits.sub++; return json(SUB); }
  if (/^\/api\/checkout/.test(u.pathname) || u.pathname === "/subscribe") { hits.checkout++; return json({ ok: false }, 410); }
  if (u.pathname.startsWith("/api/")) return json({ ok: false }, 503);
  const file = path.join(ROOT, u.pathname);
  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => srv.listen(PORT, r));
const browser = await chromium.launch(launchOpts());

// A family nobody has grandfathered: EVERY free-era stamp is set, or the
// newest sweep takes the seed for its own cohort, hands it Premium, and the
// pages under test show a family who already has every game. `seam` is "1"
// (the website sells), "0" (it does not) or null (whatever sona.js ships).
// sona.paidui keeps the purchase rails on if Sona itself is free the day this
// runs, the way every other purchase suite does.
async function open({ seam = null, profile = { childName: "Milo", childAge: "6", focusSounds: ["R"], onboarded: true }, store = {}, native = false, js = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: js });
  await ctx.route("**/*", (route) => route.request().url().startsWith(BASE) ? route.continue() : route.abort());
  await ctx.addInitScript(({ seam, profile, store, native }) => {
    if (native) window.Capacitor = { isNativePlatform: () => true, Plugins: {} };
    if (sessionStorage.getItem("wst.seeded")) return;
    sessionStorage.setItem("wst.seeded", "1");
    ["", "2", "3", "4", "5"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", n ? "done" : "post"));
    if (profile) localStorage.setItem("sona.profile.v1", JSON.stringify(profile));
    Object.keys(store).forEach((k) => localStorage.setItem(k, JSON.stringify(store[k])));
    sessionStorage.setItem("sona.gate.v1", String(Date.now()));
    sessionStorage.setItem("sona.paidui", "1");
    if (seam !== null) sessionStorage.setItem("sona.websalesui", seam);
  }, { seam, profile, store, native });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(6000);
  const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
  return { ctx, pg, errors };
}
// What a grown-up can see: laid out, with a box. An element inside a hidden
// block has display of its own but no box.
const LOOK = () => {
  const seen = (el) => { if (!el) return false; const cs = getComputedStyle(el), r = el.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0; };
  const q = (s) => document.querySelector(s);
  return {
    path: location.pathname,
    sell: seen(q("#tSell")), app: seen(q("#tApp")),
    text: document.body ? document.body.innerText : "",
    links: [...document.querySelectorAll("a[href]")].filter(seen).map((a) => a.getAttribute("href")),
    store: (() => { const a = q("#tAppGo"); return a ? { seen: seen(a), href: a.getAttribute("href"), target: a.getAttribute("target"), rel: a.getAttribute("rel"), text: a.textContent.trim() } : null; })(),
    buy: (() => { const a = q('#tSell a.btn'); return a ? { seen: seen(a), href: a.getAttribute("href"), text: a.textContent.trim() } : null; })(),
    charter: seen(q("#tCharter")) ? q("#tCharter").textContent : "",
    resBox: seen(q("#resBox")), resLink: seen(q("#restoreLink")),
  };
};
const RACHEL = /Built with Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship/;
const PRICED = /\$|3 days free|3 free days|free trial|spots? left|charter/i;
const settle = async (pg) => { await pg.waitForFunction(() => window.Sona && document.readyState === "complete"); await pg.waitForTimeout(350); };
// The restore box, played: the link opens it, an email is asked of
// /api/subscription, and the page says what came back.
async function restoreOn(pg, link, box, email, button, msg, want) {
  await pg.locator(link).click();
  const opened = await pg.locator(box).isVisible();
  await pg.locator(email).fill("parent@example.com");
  const before = hits.sub;
  await pg.locator(button).click();
  await pg.waitForFunction(([m, w]) => new RegExp(w).test(document.querySelector(m).textContent), [msg, want]).catch(() => {});
  return { opened, asked: hits.sub - before, said: await pg.locator(msg).textContent() };
}

// ── trial.html: the markup ships with nothing to flash ───────────────────
const trialSrc = readFileSync(ROOT + "/trial.html", "utf8");
ok("trial.html ships BOTH blocks hidden: the selling block and the app-only block",
  /<div id="tSell" hidden>/.test(trialSrc) && /<div id="tApp" hidden>/.test(trialSrc));
ok("…and says on the page itself that hidden means hidden (.btn, .save and .proof set a display of their own)",
  /\[hidden\]\{display:none !important;\}/.test(trialSrc));
ok("…and reads the one switch, guarded", /S\.webSales && S\.webSales\(\)/.test(trialSrc) && !/WEB_SALES\s*=/.test(trialSrc));

try {
  await scenario("trial.html before any script runs", async () => {
    const { ctx, pg } = await open({ js: false });
    await pg.goto(BASE + "/trial.html");
    const v = await pg.evaluate(LOOK);
    ok("before any script runs, neither block is on screen: a price never flashes", !v.sell && !v.app, v);
    ok("…no figure, no free days, no charter line anywhere a visitor can see", !PRICED.test(v.text), (v.text.match(PRICED) || [])[0]);
    ok("…and no visible link to a checkout", !v.links.some((h) => /^\/subscribe/.test(h)), v.links);
    ok("…while Rachel's line and Restore access are already there", RACHEL.test(v.text) && v.resLink, v.text);
    await ctx.close();
  });

  await scenario("trial.html when sona.js never arrives", async () => {
    const { ctx, pg } = await open({ seam: "1" });
    await ctx.route("**/sona.js*", (route) => route.abort());
    hits.charter = 0;
    await pg.goto(BASE + "/trial.html"); await pg.waitForTimeout(500);
    const v = await pg.evaluate(LOOK);
    ok("without sona.js the page fails closed: where Premium is bought, never the price", v.app && !v.sell && !PRICED.test(v.text) && hits.charter === 0, { sell: v.sell, app: v.app, charter: hits.charter });
    await ctx.close();
  });

  await scenario("trial.html, the website sells", async () => {
    CHARTER = CHARTER_OPEN; SUB = { ok: true, active: false }; hits.charter = 0; hits.checkout = 0;
    const { ctx, pg, errors } = await open({ seam: "1" });
    await pg.goto(BASE + "/trial.html"); await settle(pg);
    let v = await pg.evaluate(LOOK);
    ok("selling: the price block is on screen and the app-only block is not", v.path === "/trial.html" && v.sell && !v.app, v);
    ok("…with the yearly price, its free days and the monthly plan's price", /\$59\.99/.test(v.text) && /3 days free/.test(v.text) && /Under \$5 a month, billed once a year\./.test(v.text) && /\$9\.99 a month, charged today/.test(v.text), v.text);
    ok("…the button to the website's plan page", !!v.buy && v.buy.seen && v.buy.href === "/subscribe" && v.buy.text === "Start 3 days free", v.buy);
    ok("…the charter line from /api/charter, asked once", /Charter price for the first 50 families — regular price \$99\.99\/yr · 38 spots left/.test(v.charter) && hits.charter === 1, { charter: v.charter, asked: hits.charter });
    ok("…and no App Store pitch", !v.links.includes(APP_STORE) && !/in the iPhone and iPad app/.test(v.text), v.links);
    ok("selling: Rachel's line is on the page", RACHEL.test(v.text));
    ok("selling: the restore line reads as it always did", /Already subscribed\? Restore access/.test(v.text) && !v.resBox, v.text);
    const r = await restoreOn(pg, "#restoreLink", "#resBox", "#resEmail", "#resBtn", "#resMsg", "No active subscription");
    ok("selling: Restore access opens its box and asks about the email", r.opened && r.asked === 1 && /No active subscription for that email\./.test(r.said), r);
    ok("selling: no page errors", errors.length === 0, errors);
    await ctx.close();

    // the spots are gone: every yearly figure on the page is the regular one
    CHARTER = CHARTER_GONE;
    const gone = await open({ seam: "1" });
    await gone.pg.goto(BASE + "/trial.html"); await settle(gone.pg);
    v = await gone.pg.evaluate(LOOK);
    ok("selling, charter spots gone: every yearly figure is the regular price, with its own per-month reading",
      v.sell && /\$99\.99/.test(v.text) && !/\$59\.99/.test(v.text) && /Under \$8\.50 a month, billed once a year\./.test(v.text) && !/Under \$5 a month/.test(v.text) && v.charter === "", v.text);
    await gone.ctx.close();

    // The seam only changes what a page SHOWS. The real route, asked while the
    // website does not sell, answers with no figure at all: nothing may be
    // painted from it ("undefined" where a price was).
    CHARTER = CHARTER_OFF;
    const forced = await open({ seam: "1" });
    await forced.pg.goto(BASE + "/trial.html"); await settle(forced.pg);
    v = await forced.pg.evaluate(LOOK);
    ok("selling by the seam, against a route that says the website is not selling: nothing is painted from its answer",
      v.sell && !/undefined|NaN/.test(v.text) && /\$59\.99/.test(v.text) && v.charter === "", v.text);
    await forced.ctx.close();
    CHARTER = CHARTER_OPEN;
  });

  await scenario("trial.html, the website does not sell", async () => {
    CHARTER = CHARTER_OPEN; SUB = { ok: true, active: false }; hits.charter = 0; hits.checkout = 0;
    // no child set up: the browser the success page's "Restore my access" sends here
    const { ctx, pg, errors } = await open({ seam: "0", profile: null });
    await pg.goto(BASE + "/trial.html"); await settle(pg);
    const v = await pg.evaluate(LOOK);
    ok("not selling: the app-only block is on screen and the price block is not", v.path === "/trial.html" && v.app && !v.sell, v);
    ok("…it says where Premium is bought, and that it opens there",
      /Sona Premium is in the iPhone and iPad app/.test(v.text) && /Premium opens every game and every book in the Sona app\. You buy it there, through the App Store, and it opens there\. Daily practice and the free games stay free here\./.test(v.text), v.text);
    ok("…with one button, to the App Store, in a new tab", !!v.store && v.store.seen && v.store.href === APP_STORE && v.store.target === "_blank" && /noopener/.test(v.store.rel || "") && v.store.text === "Get Sona on the App Store", v.store);
    ok("not selling: no dollar sign anywhere a visitor can read", !/\$/.test(v.text), (v.text.match(/.{0,30}\$.{0,20}/) || [])[0]);
    ok("…no free days, no trial, no charter line, no spots-left number", !PRICED.test(v.text), (v.text.match(PRICED) || [])[0]);
    ok("…no visible link to the website's plan page or checkout", !v.links.some((h) => /^\/subscribe/.test(h)), v.links);
    ok("…and /api/charter is never asked, so nothing can paint a price", hits.charter === 0 && hits.checkout === 0, hits);
    ok("not selling: Rachel's line is on the page", RACHEL.test(v.text));
    ok("not selling: a family who already pays is told their plan keeps working, beside Restore access", /Already paid on speaksona\.com\? Your plan keeps working\.\s*Restore access/.test(v.text) && !v.resBox, v.text);
    SUB = { ok: true, active: true };
    await ctx.route("**/map.html", (route) => route.fulfill({ status: 204, body: "" }));   // stay put, to read the page
    const r = await restoreOn(pg, "#restoreLink", "#resBox", "#resEmail", "#resBtn", "#resMsg", "Welcome back");
    const sub = await pg.evaluate(() => JSON.parse(localStorage.getItem("sona.sub.v1") || "{}"));
    ok("not selling: Restore access still opens, asks, and gives a paying family their plan back", r.opened && r.asked === 1 && /Welcome back! ✓/.test(r.said) && sub.active === true && sub.source === "stripe", { r, sub });
    ok("not selling: no page errors", errors.length === 0, errors);
    await ctx.close();
    SUB = { ok: true, active: false };
  });

  await scenario("trial.html, people who are shown neither block", async () => {
    // The page asks to leave while it is still loading and the answer is "no
    // content", so its load event is not something to wait for: wait for its
    // scripts to have run instead.
    const held = async (pg, scripts) => {
      await pg.goto(BASE + "/trial.html", { waitUntil: "commit" });
      if (scripts) await pg.waitForFunction(() => window.Sona && document.getElementById("resBtn") && document.getElementById("resBtn").onclick);
      await pg.waitForTimeout(600);
    };
    // A family who already pays is sent home. Held on the page (the way home
    // answers 204), neither block may be on it: never the app pitch to
    // someone with Premium, never a price.
    for (const seam of ["0", "1"]) {
      hits.charter = 0;
      const { ctx, pg } = await open({ seam, store: { "sona.sub.v1": { active: true, email: "parent@example.com", source: "stripe", since: Date.now(), checked: Date.now() } } });
      SUB = { ok: true, active: true };
      let home = 0;
      await ctx.route("**/map.html", (route) => { home++; return route.fulfill({ status: 204, body: "" }); });
      await held(pg, true);
      const v = await pg.evaluate(LOOK);
      ok("a family with Premium (seam " + seam + ") is sent home and shown neither the app card nor a price", home === 1 && !v.app && !v.sell && !PRICED.test(v.text) && hits.charter === 0, { home, sell: v.sell, app: v.app, charter: hits.charter });
      await ctx.close();
      SUB = { ok: true, active: false };
    }
    // The iPhone app: the line at the top sends it to the plan screen (the
    // Apple card) before the page has a body. The web switch never reaches
    // it: no App Store pitch inside the app, in either state.
    for (const seam of ["0", "1"]) {
      hits.charter = 0;
      const { ctx, pg } = await open({ seam, native: true });
      let plan = 0;
      await ctx.route("**/subscribe.html", (route) => { plan++; return route.fulfill({ status: 204, body: "" }); });
      await held(pg);
      const v = await pg.evaluate(LOOK);
      ok("the iPhone app (seam " + seam + ") is sent to the plan screen and shown neither block", plan >= 1 && !v.app && !v.sell && !PRICED.test(v.text) && !v.links.includes(APP_STORE) && hits.charter === 0, { plan, sell: v.sell, app: v.app, charter: hits.charter });
      await ctx.close();
    }
  });

  await scenario("trial.html with no seam", async () => {
    // Whatever the switch is today, read from source (never typed here): the
    // page shows exactly one block, and it is the one the switch names.
    const m = readFileSync(ROOT + "/sona.js", "utf8").match(/const WEB_SALES = (true|false);/);
    ok("sona.js carries the switch this page reads", !!m);
    const { ctx, pg } = await open({});
    await pg.goto(BASE + "/trial.html"); await settle(pg);
    const v = await pg.evaluate(LOOK);
    ok("with no seam the page shows exactly one block, the one the switch names", !!m && v.sell !== v.app && v.sell === (m[1] === "true"), { sell: v.sell, app: v.app, sw: m && m[1] });
    await ctx.close();
  });

  // ── Settings › Account ──────────────────────────────────────────────────
  const settingsSrc = readFileSync(ROOT + "/settings.html", "utf8");
  ok("Settings never links to the website's checkout page (/subscribe), in its markup or in what it paints", !/href="\/subscribe"/.test(settingsSrc) && /id="acct">[^\n]*href="\/subscribe\.html"/.test(settingsSrc), (settingsSrc.match(/href="\/subscribe[^"]*"/g) || []).join(" "));
  const ACCT = () => {
    const a = document.getElementById("acct"), rb = document.getElementById("restoreBox");
    return { path: location.pathname, text: a.textContent, plan: [...a.querySelectorAll("a[href]")].map((x) => x.getAttribute("href")).filter((h) => h !== "#"), restore: !!a.querySelector("#restoreLink"), box: getComputedStyle(rb).display !== "none" && rb.getBoundingClientRect().height > 0 };
  };
  const DAY = 86400000;
  for (const seam of ["1", "0"]) {
    const tag = "Settings (seam " + seam + ")";
    await scenario(tag, async () => {
      SUB = { ok: true, active: false };
      // the free version
      let { ctx, pg, errors } = await open({ seam });
      await pg.goto(BASE + "/settings.html"); await settle(pg);
      let a = await pg.evaluate(ACCT);
      ok(tag + ": the free version's plan link opens the plan screen", a.path === "/settings.html" && /free version — daily practice and free games/.test(a.text) && /See Premium/.test(a.text) && JSON.stringify(a.plan) === '["/subscribe.html"]', a);
      ok(tag + ": no figure in Account", !/\$/.test(a.text), a.text);
      const r = await restoreOn(pg, "#restoreLink", "#restoreBox", "#restoreEmail", "#restoreBtn", "#restoreMsg", "No active subscription");
      ok(tag + ": Restore opens its box and asks about the email", a.restore && !a.box && r.opened && r.asked === 1 && /No active subscription for that email\./.test(r.said), { a, r });
      await Promise.all([pg.waitForURL((u) => new URL(u).pathname !== "/settings.html"), pg.locator("#acct a", { hasText: "See Premium" }).click()]);
      await pg.waitForTimeout(400);
      ok(tag + ": tapping See Premium lands on the plan screen, not the website's checkout page", new URL(pg.url()).pathname === "/subscribe.html" && hits.checkout === 0, pg.url());
      ok(tag + ": no page errors", errors.length === 0, errors);
      await ctx.close();

      // a family who pays through the website
      SUB = { ok: true, active: true };
      ({ ctx, pg } = await open({ seam, store: { "sona.sub.v1": { active: true, email: "parent@example.com", source: "stripe", since: Date.now(), checked: Date.now() } } }));
      await pg.goto(BASE + "/settings.html"); await settle(pg);
      a = await pg.evaluate(ACCT);
      ok(tag + ": a paying family reads Active, and Manage opens the plan screen", /Plan: Active ✓/.test(a.text) && /Manage/.test(a.text) && JSON.stringify(a.plan) === '["/subscribe.html"]' && !a.box, a);
      await ctx.close();
      SUB = { ok: true, active: false };

      // the no-card trial an older device was promised: running, then ended
      ({ ctx, pg } = await open({ seam, store: { "sona.trial.v1": { start: Date.now() - DAY, days: 3 } } }));
      await pg.goto(BASE + "/settings.html"); await settle(pg);
      a = await pg.evaluate(ACCT);
      ok(tag + ": a running old trial's See plans opens the plan screen, with Restore beside it", /free trial — 2 days left/.test(a.text) && /See plans/.test(a.text) && JSON.stringify(a.plan) === '["/subscribe.html"]' && a.restore, a);
      await pg.evaluate((t) => localStorage.setItem("sona.trial.v1", JSON.stringify(t)), { start: Date.now() - 9 * DAY, days: 3 });
      await pg.reload(); await settle(pg);
      a = await pg.evaluate(ACCT);
      ok(tag + ": an ended one too", /Your free trial has ended\./.test(a.text) && /See Premium/.test(a.text) && JSON.stringify(a.plan) === '["/subscribe.html"]' && a.restore, a);
      await ctx.close();
    });
  }
} finally {
  await browser.close(); srv.close();
}

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
