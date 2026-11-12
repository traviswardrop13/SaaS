// FREEDAY1: A FREE DAY FOR A FAMILY WHO CLOSES THE PRICE (Travis, 11 Nov
// 2026: "im almost thinking we let the people play for free for a day if they
// close the paywall", then "yeah build the free day").
//
// Played on the shared fake phone (tests/_phone.mjs), with freeDay: true (a
// phone that never had one; every other suite's phone already did):
//   - from setup, the first X on a priced card opens everything for 24 hours:
//     a sheet says so ("Today's on us!", the end time, "No card. Nothing to
//     cancel."), its one button goes on to the microphone exactly as a buyer
//     does, and the funnel hears "offer dismissed" and "free day started";
//   - the price screen says nothing about it before the X;
//   - from a grey game, the same, and the button goes Home with games open;
//   - once per phone: the next X, after the day, goes to a locked Home;
//   - when the day is over, Home opens the offer once more, and never again;
//   - an error card's X, a family who keeps the free version, and a clock set
//     back before the start never get (or stretch) one;
//   - Settings names the free day and its end;
//   - a backup never carries it, either way.
import { readFileSync } from "fs";
import { chromium, launchOpts, ROOT } from "./_env.mjs";
import { serve, open, calm, STORES } from "./_phone.mjs";

const { base: BASE, hits, close } = await serve();
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(detail))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, e.stack); } }

const KEY = "sona.freeday.v1", DAY = 24 * 60 * 60 * 1000;
const FREE4 = ["slice", "tiles", "feed", "bubbles"];
const OWES = { app: "buy", stamp: "post", setUp: true, freeDay: true, store: STORES.monthlyFree };
const priced = (page) => page.waitForFunction(() => /^(free|paid)$/.test(document.getElementById("iapCard").getAttribute("data-state")));
const home = (page) => page.waitForFunction(() => document.querySelectorAll("#activityGroups .game-card").length > 0 && !document.getElementById("libraryApp").hidden);
const openCards = (page) => page.evaluate(() => [...document.querySelectorAll("#activityGroups .game-card")].filter((b) => b.dataset.locked === "false").length);
const rule = (page) => page.evaluate((keys) => ({
  rec: localStorage.getItem("sona.freeday.v1"),
  active: Sona.freeDayActive(), first: Sona.trialFirst(), lock: Sona.offerOnLock(),
  open: keys.filter((k) => Sona.gameAccess(k).allowed),
  books: Sona.booksOpen(), practice: !Sona.gated("practice"), premium: Sona.premium(),
}), FREE4);
const beacons = (name, from = 0) => hits.slice(from).filter((h) => h.path === "/api/track" && h.body.includes('"' + name + '"')).map((h) => JSON.parse(h.body));
const offers = (requests) => requests.filter((r) => /\/subscribe\.html/.test(r.url)).length;
const LINE = /^Every game and book is open until \d{1,2}:\d{2}\s?[AP]M tomorrow\. No card\. Nothing to cancel\.$/;

try {
  // ── 1. from setup: the X opens the day, then the microphone ──
  await scenario("from setup", async () => {
    const { context, page, errors } = await open(browser, BASE, Object.assign({}, OWES, { marker: true }));
    try {
      const t0 = hits.length;
      await page.goto(BASE + "/subscribe.html?setup=1");
      await priced(page); await calm(page);
      const before = await page.evaluate(() => document.body.innerText);
      ok("the price screen says nothing about a free day before the X", !/on us|free day|tomorrow|24 hours|nothing to cancel/i.test(before), before.slice(0, 300));
      ok("…and this phone owes the price, with nothing open", (await rule(page)).first === true && (await rule(page)).open.length === 0);
      await page.locator("#declineLink").click();
      await page.locator("#freeDay").waitFor();
      await page.waitForTimeout(400);
      const sheet = await page.evaluate(() => ({ url: location.pathname + location.search, title: document.getElementById("freeDayTitle").textContent,
        line: document.getElementById("freeDayLine").textContent, btn: document.getElementById("freeDayGo").textContent,
        role: document.getElementById("freeDay").getAttribute("role"), marker: sessionStorage.getItem("sona.setupafter.v1") }));
      ok("the X stays on the page and shows the sheet: \"Today’s on us!\", with one \"Let’s play!\" button",
        sheet.url === "/subscribe.html?setup=1" && sheet.title === "Today’s on us!" && sheet.btn === "Let’s play!" && sheet.role === "dialog", sheet);
      ok("…its line names the end to the minute, and says no card and nothing to cancel", LINE.test(sheet.line), sheet.line);
      ok("…and setup's marker is kept, so setup goes on to the microphone", !!sheet.marker, sheet.marker);
      const r = await rule(page);
      const rec = JSON.parse(r.rec || "{}");
      ok("the day is stored with its start, now, on this phone", typeof rec.start === "number" && Math.abs(Date.now() - rec.start) < 60000 && !rec.after, r.rec);
      ok("…and for the day the price is owed no more: every game, the books and practice open, and no grey tap opens the price",
        r.active && r.first === false && r.lock === false && r.open.length === FREE4.length && r.books && r.practice, r);
      ok("…without calling it Premium (nothing was bought)", r.premium === false, r);
      await page.waitForTimeout(300);
      const dis = beacons("offer dismissed", t0);
      const day = beacons("free day started");
      ok("the funnel hears \"offer dismissed\" and \"free day started\", both from setup", dis.some((b) => b.p.surface === "setup") && day.length === 1 && day[0].p.surface === "setup", { dis, day });
      await page.locator("#freeDayGo").click();
      await page.waitForURL(/\/onboarding\.html$/, { timeout: 8000 });
      await page.locator('[data-step="mic"].on').waitFor();
      ok("\"Let’s play!\" goes on to setup's microphone step, as a buyer does", true);
      ok("from setup: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });

  // ── 2. from a grey game: the day, then Home with games open; once per phone ──
  await scenario("from a grey game", async () => {
    const { context, page, errors, requests } = await open(browser, BASE, OWES);
    try {
      await page.goto(BASE + "/today.html"); await home(page);
      ok("a household that owes the price: Home has every game locked", (await openCards(page)) === 0);
      await page.locator("#arcadeBtn").click(); await page.waitForTimeout(550);
      await page.locator('#activityGroups .game-card[data-game="slice"]').click();
      await page.waitForURL(/\/subscribe\.html\?from=slice$/);
      await priced(page); await calm(page);
      await page.locator("#declineLink").click();
      await page.locator("#freeDay").waitFor();
      ok("a grey game's X opens the free day too", LINE.test(await page.evaluate(() => document.getElementById("freeDayLine").textContent)));
      await page.waitForTimeout(300);
      ok("…and \"free day started\" names that door", beacons("free day started").some((b) => b.p.surface === "from-game"));
      await page.locator("#freeDayGo").click();
      await page.waitForURL(/\/today\.html$/); await home(page);
      ok("…\"Let’s play!\" goes Home, where the games are open now", (await openCards(page)) > 0);
      // Settings names it, with its end
      await page.evaluate(() => sessionStorage.setItem("sona.gate.v1", String(Date.now())));
      await page.goto(BASE + "/settings.html"); await page.waitForTimeout(800);
      const acct = await page.evaluate(() => document.getElementById("acct").textContent);
      ok("Settings › Your plan says \"free day\" and when it ends", /Plan: free day — every game and book is open until \w+day \d{1,2}:\d{2}\s?[AP]M/.test(acct), acct);
      // the day is over
      await page.evaluate((DAY) => { const d = JSON.parse(localStorage.getItem("sona.freeday.v1")); d.start = Date.now() - DAY - 60000; localStorage.setItem("sona.freeday.v1", JSON.stringify(d)); sessionStorage.clear(); }, DAY);
      const n0 = offers(requests);
      await page.goto(BASE + "/today.html");
      await page.waitForURL(/\/subscribe\.html\?from=home$/, { timeout: 8000 });
      await priced(page); await calm(page);
      const after = await rule(page);
      ok("when the day is over, the next Home opens the offer once more, and the price is owed again", after.active === false && after.first === true && offers(requests) === n0 + 1, after);
      ok("…and that showing is spent on the free day's own record", !!JSON.parse(after.rec).after && !/^try:/.test(JSON.parse(after.rec).after), after.rec);
      await page.locator("#declineLink").click();
      await page.waitForURL(/\/today\.html$/); await home(page); await page.waitForTimeout(2800);
      ok("its X is no second free day: Home, every game locked, no sheet, no loop", /\/today\.html$/.test(page.url()) && (await openCards(page)) === 0 && offers(requests) === n0 + 1, { url: page.url(), offers: offers(requests) });
      ok("…and \"free day started\" was heard once in all", beacons("free day started").filter((b) => b.p.surface === "from-game" || b.p.surface === "home").length === 1);
      await page.evaluate(() => sessionStorage.clear());
      await page.reload(); await home(page); await page.waitForTimeout(2800);
      ok("a later launch does not open the offer again", /\/today\.html$/.test(page.url()) && offers(requests) === n0 + 1, { url: page.url(), offers: offers(requests) });
      ok("from a grey game: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });

  // ── 3. an error card is not a "no" ──
  await scenario("the store never answers", async () => {
    const { context, page, errors } = await open(browser, BASE, Object.assign({}, OWES, { marker: true, products: "hang" }));
    try {
      await page.goto(BASE + "/subscribe.html?setup=1");
      await page.waitForFunction(() => document.getElementById("iapCard").getAttribute("data-state") === "none", null, { timeout: 9000 });
      await calm(page);
      await page.locator("#declineLink").click();
      await page.waitForURL(/\/today\.html/);
      const r = await rule(page);
      ok("X on \"We couldn't reach the App Store.\" opens no free day: locked Home, nothing stored", r.rec === null && r.first === true && r.open.length === 0, r);
      ok("store never answers: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });

  // ── 4. a family who keeps the free version is not given one ──
  await scenario("the free version", async () => {
    const { context, page, errors } = await open(browser, BASE, Object.assign({}, OWES, { stamp: "kept" }));
    try {
      await page.goto(BASE + "/subscribe.html?from=slice");
      await priced(page); await calm(page);
      await page.locator("#declineLink").click();
      await page.waitForURL(/\/today\.html/);
      const r = await rule(page);
      ok("a family who kept the free version: its X goes Home with the free games, and no free day", r.rec === null && r.active === false, r);
      ok("free version: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });

  // ── 5. the rule itself: clock, address, backups ──
  await scenario("the rule", async () => {
    const { context, page, errors } = await open(browser, BASE, OWES);
    try {
      await page.goto(BASE + "/today.html?freeday=1"); await home(page);
      ok("an address grants nothing", (await rule(page)).rec === null && (await openCards(page)) === 0);
      const r = await page.evaluate((DAY) => {
        const out = {};
        out.due = Sona.freeDayDue();
        out.started = Sona.freeDayStart("test");
        out.again = Sona.freeDayStart("test");
        const d = JSON.parse(localStorage.getItem("sona.freeday.v1"));
        out.ends = Sona.freeDayEnds() === d.start + DAY;
        out.exported = /sona\.freeday\.v1/.test(Sona.exportString ? Sona.exportString() : JSON.stringify(Sona.exportData()));
        // a clock set back before the start ends it rather than lengthening it
        localStorage.setItem("sona.freeday.v1", JSON.stringify({ start: Date.now() + 3600000 }));
        out.future = Sona.freeDayActive();
        out.futureEnded = Sona.freeDayEnded();
        // a backup never brings one, and never takes the used one away
        localStorage.setItem("sona.freeday.v1", JSON.stringify({ start: 1, after: "1" }));
        const bk = JSON.parse(JSON.stringify(Sona.exportData())); bk["sona.freeday.v1"] = JSON.stringify({ start: Date.now() });
        try { Sona.importData(bk); } catch (e) {}
        out.afterImport = localStorage.getItem("sona.freeday.v1");
        localStorage.removeItem("sona.freeday.v1");
        const bk2 = JSON.parse(JSON.stringify(Sona.exportData())); bk2["sona.freeday.v1"] = JSON.stringify({ start: Date.now() });
        try { Sona.importData(bk2); } catch (e) {}
        out.importBrought = localStorage.getItem("sona.freeday.v1");
        return out;
      }, DAY);
      ok("Sona.freeDayStart opens it once: due, started, and never a second time", r.due === true && r.started === true && r.again === false, r);
      ok("…it ends 24 hours after it started", r.ends, r);
      ok("…and a backup made during it does not hold it", r.exported === false, r);
      ok("a clock set back before the start ends the day: not active, and counted as over", r.future === false && r.futureEnded === true, r);
      ok("a backup never takes a used free day away, nor brings one to a phone that never had one",
        r.afterImport === JSON.stringify({ start: 1, after: "1" }) && r.importBrought === null, r);
      ok("the rule: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });

  // ── 6. the source ──
  const sona = readFileSync(ROOT + "/sona.js", "utf8"), sub = readFileSync(ROOT + "/subscribe.html", "utf8");
  const noExport = (sona.match(/const NO_EXPORT = \[[\s\S]*?\];/) || [""])[0], noImport = (sona.match(/const NO_IMPORT = \[[\s\S]*?\];/) || [""])[0];
  ok("sona.freeday.v1 is on NO_EXPORT and on NO_IMPORT", noExport.includes('"' + KEY + '"') && noImport.includes('"' + KEY + '"'));
  ok("freeDayStart is the only writer that starts a day, and only subscribe.html's X calls it",
    (sona.match(/localStorage\.setItem\(FREEDAY, JSON\.stringify\(\{ start:/g) || []).length === 1 &&
    (sub.match(/Sona\.freeDayStart\(/g) || []).length === 1 && /declineLink[\s\S]*Sona\.freeDayStart\(surface\)/.test(sub));
  ok("the switch is on", /const FREE_DAY_ON = true;/.test(sona));
  const route = readFileSync(ROOT + "/../app/api/track/route.ts", "utf8");
  ok("the telemetry relay lets \"free day started\" through", /"free day started"/.test(route));
} finally {
  await browser.close(); await close();
  console.log("\n" + (assertions - failures) + "/" + assertions + " passed");
  process.exit(failures ? 1 : 0);
}
