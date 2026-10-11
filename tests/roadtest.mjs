// ROAD1 / LEVELS1 on Home and in Settings (Travis, 9 Oct 2026: "kids see
// games and levels but have to unlock them"; he chose LEVELS INSIDE GAMES).
//
// Every game opens on Home exactly as before. Inside nine of them Level 2
// opens at 150 trophies and Level 3 at 750, per child, and this suite plays
// what a child and a grown-up see of that:
//   - one tap still plays: the FIRST tap on a game after a new level opens
//     shows "Pick a level" for that game (Sona.playLevelAsk), and every tap
//     after it goes straight to the game, which plays the level last picked;
//   - a locked level is shown with what it needs and goes nowhere;
//   - a card whose child plays Level 2 or 3 carries a small numeral and pips
//     on its picture (top right, clear of the best tag and the Free/Included
//     label), and its label says the level;
//   - a grey Premium card, a Coming soon card, a book and Feed Echo never
//     open the sheet; a grown-up's "Level 1 only" turns it all off;
//   - Home stays the silent library: no voice, no event, nothing written on
//     load or on coming back to the front, only the "seen" mark and the pick
//     on a child's tap; nothing fits off the screen at 320 px;
//   - Settings' "Game levels" picker starts on "Open as earned", fits a
//     closed picker at 320 px and saves "Level 1 only" for the selected child.
// The Trophy Road card and page join this suite in the step that builds them.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { chromium, ROOT, launchOpts, OUT } from "./_env.mjs";

let fails = 0;
function ok(label, pass, detail = "") { if (!pass) fails++; console.log((pass ? "PASS " : "FAIL ") + label + (pass ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); }
async function section(label, run) { try { await run(); } catch (e) { ok(label + " completes", false, e.stack); } }

const asked = [];   // every /api/ request a page made, with where it came from
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2", json: "application/json", webmanifest: "application/manifest+json" };
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__seed") { res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><title>Setup</title>"); return; }
  if (url.pathname === "/__sona") { res.writeHead(200, { "content-type": "text/html" }); res.end('<!doctype html><title>Store</title><script src="/sona.js"></script>'); return; }
  if (url.pathname.startsWith("/api/")) { req.resume(); res.writeHead(503, { "content-type": "application/json" }); res.end("{}"); return; }
  const file = path.join(ROOT, url.pathname);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch(launchOpts());
const TODAY = (() => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })();

// main's seed rules (CLAUDE.md "Test seeds"): every era stamp, the trial-first
// stamp. Trophies are seeded straight into the ledger rather than replaying
// weeks of reps. The paid seam is on, so Premium games are greyed unless
// premium (a subscription) opens every game.
async function fresh({ width = 375, height = 812, trophies = 0, levels = null, premium = false, bests = null, extra = null } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== origin) return route.abort();
    // where a tap goes is recorded, not run: a game page has its own suites
    if (/^\/(?:charge|arcade-[a-z]+|subscribe|premium|library)\.html$/.test(u.pathname)) return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Away</title><p>Away</p>" });
    return route.continue();
  });
  await context.addInitScript(() => {
    const record = (text) => { if (String(text || "").trim()) { const calls = JSON.parse(sessionStorage.getItem("test.speech") || "[]"); calls.push(String(text)); sessionStorage.setItem("test.speech", JSON.stringify(calls)); } return Promise.resolve(); };
    let sona; Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set: (v) => { sona = v; v.speak = record; v.speakNow = record; } });
    if (window.speechSynthesis) window.speechSynthesis.speak = (u) => record(u && u.text);
  });
  const page = await context.newPage(); page.setDefaultTimeout(5000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => { const u = new URL(r.url()); if (u.pathname.startsWith("/api/")) asked.push({ path: u.pathname, from: (() => { try { return new URL(r.frame().url()).pathname; } catch (e) { return ""; } })() }); });
  await page.goto(origin + "/__seed");
  await page.evaluate(({ trophies, levels, premium, bests, extra, TODAY }) => {
    ["", "2", "3", "4", "5"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", n ? "done" : "post"));
    localStorage.setItem("sona.freever.v1", "kept");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, voiceOn: false, soundOn: false, volume: 0 }));
    sessionStorage.setItem("sona.paidui", "1");
    if (premium) localStorage.setItem("sona.sub.v1", JSON.stringify({ active: true, since: Date.now(), source: "stripe" }));
    localStorage.setItem("sona.trophy.v1", JSON.stringify({ v: 1, t: trophies, d: TODAY, dn: 0, m: TODAY.slice(0, 7), mn: 0 }));
    if (levels) localStorage.setItem("sona.playlevel.v1", JSON.stringify(levels));
    if (bests) localStorage.setItem("sona.bests.v1", JSON.stringify(bests));
    Object.keys(extra || {}).forEach((k) => localStorage.setItem(k, extra[k]));
  }, { trophies, levels, premium, bests, extra, TODAY });
  return { context, page, errors };
}
async function home(page) { await page.goto(origin + "/today.html"); await page.waitForFunction(() => window.Sona && document.querySelector("#activityGroups .game-card")); await page.waitForTimeout(150); }
const card = (page, key) => page.locator('#activityGroups .game-card[data-game="' + key + '"]').first();
const sheetOpen = (page) => page.evaluate(() => document.getElementById("levelOvl").classList.contains("show"));
const levels = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("sona.playlevel.v1") || "null"));
const speech = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("test.speech") || "[]"));
const store = (page) => page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
async function tapAway(page, loc) {
  const went = page.waitForURL((u) => !/\/today\.html/.test(u.pathname), { timeout: 2500 }).then(() => page.url(), () => null);
  await loc.click(); return went;
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
// where the level badge sits on a card, against its picture, the best tag and the Free/Included label
const geometry = (page, key) => page.evaluate((key) => {
  const c = document.querySelector('#activityGroups .game-card[data-game="' + key + '"]'); if (!c) return null;
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
  const art = r(c.querySelector(".game-art")), lv = r(c.querySelector(".game-level")), best = r(c.querySelector(".game-best")), acc = r(c.querySelector(".game-access"));
  const apart = (a, b) => !a || !b || a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t;
  const tag = c.querySelector(".game-level");
  return { art, lv, best, acc, label: c.getAttribute("aria-label"), text: tag ? tag.textContent : null, pips: tag ? [...tag.querySelectorAll(".level-pips i")].map((i) => i.className === "on" ? 1 : 0).join("") : null,
    inArt: !!(lv && art && lv.l >= art.l - 0.5 && lv.r <= art.r + 0.5 && lv.t >= art.t - 0.5 && lv.b <= art.b + 0.5),
    topRight: !!(lv && art && art.r - lv.r <= 10 && lv.t - art.t <= 10), clearOfBest: apart(lv, best), clearOfLabel: apart(lv, acc),
    pointer: tag ? getComputedStyle(tag).pointerEvents : null, buttons: tag ? tag.querySelectorAll("button,a").length : 0 };
}, key);

// ── 1. one tap still plays ──────────────────────────────────────────────
await section("levels on Home", async () => {
  let f = await fresh({ trophies: 0 });
  try {
    await home(f.page);
    const to = await tapAway(f.page, card(f.page, "slice"));
    ok("at 0 trophies a tap on Fruit Slice goes straight to its practice page, as before", to && new URL(to).pathname === "/charge.html" && new URL(to).searchParams.get("game") === "arcade-slice.html", to);
    ok("…and nothing about levels was written", (await levels(f.page)) === null);
  } finally { await f.context.close(); }

  f = await fresh({ trophies: 200, bests: { slice: { n: 17, at: "2026-10-02" } } });
  try {
    await home(f.page);
    const before = await geometry(f.page, "slice");
    ok("with nothing picked yet the card carries no level badge, and keeps its Level 1 best", before && before.text === null && /Your best: 17\.$/.test(before.label), before);
    // a three-year-old's double tap: the first tap opens the sheet, and the
    // second lands on whatever the sheet put under the finger
    await card(f.page, "slice").dblclick();
    await f.page.waitForTimeout(150);
    ok("at 200 trophies the FIRST tap on Fruit Slice opens \"Pick a level\" instead of the game", (await sheetOpen(f.page)) && new URL(f.page.url()).pathname === "/today.html");
    ok("…and a double tap's second tap neither closes it (spending the one ask) nor picks a level", (await sheetOpen(f.page)) && JSON.stringify(await levels(f.page)) === JSON.stringify({ seen: { slice: 2 } }), await levels(f.page));
    await f.page.waitForTimeout(450);   // the sheet takes taps half a second after it opens
    const sheet = await f.page.evaluate(() => ({
      title: document.getElementById("levelTitle").textContent, ask: document.querySelector("#levelModal .level-ask").textContent,
      tiles: [...document.querySelectorAll("#levelList .level-tile")].map((b) => ({ n: b.dataset.level, aria: b.getAttribute("aria-label"), disabled: b.getAttribute("aria-disabled"), pressed: b.getAttribute("aria-pressed"), art: getComputedStyle(b.querySelector(".level-art")).backgroundImage, num: b.querySelector(".level-num b").textContent, pips: b.querySelectorAll(".level-pips i.on").length, check: !!b.querySelector(".level-check"), lock: !!b.querySelector(".level-need svg") })),
      dialog: document.getElementById("levelOvl").getAttribute("role"), modal: document.getElementById("levelOvl").getAttribute("aria-modal"), focus: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.level : null }));
    ok("the sheet is a dialog named for the game", sheet.dialog === "dialog" && sheet.modal === "true" && sheet.title === "Fruit Slice" && sheet.ask === "Pick a level", sheet);
    ok("three levels, each leading with the game's picture, a big numeral and its pips", sheet.tiles.length === 3 && sheet.tiles.every((t, i) => t.num === String(i + 1) && t.pips === i + 1 && /home-fruit\.webp/.test(t.art)), sheet.tiles);
    ok("Level 1 and 2 are open; Level 1 is the one picked (✓), and has the focus", sheet.tiles[0].pressed === "true" && sheet.tiles[0].check && sheet.tiles[1].pressed === "false" && !sheet.tiles[1].disabled && sheet.tiles[0].aria === "Level 1. The fruit stand" && sheet.tiles[1].aria === "Level 2. Faster fruit!" && sheet.focus === "1", sheet.tiles);
    ok("Level 3 is shown locked, with what it needs", sheet.tiles[2].disabled === "true" && sheet.tiles[2].lock && sheet.tiles[2].aria === "Level 3. Opens at 750 trophies. You have 200.", sheet.tiles[2]);
    await f.page.locator('#levelList .level-tile[data-level="3"]').click({ force: true });
    await f.page.waitForTimeout(150);
    ok("a tap on the locked level only says so, and goes nowhere", new URL(f.page.url()).pathname === "/today.html" && (await f.page.locator("#levelNote").innerText()) === "Level 3 opens at 750 trophies. Keep practicing!" && (await sheetOpen(f.page)), await f.page.locator("#levelNote").innerText());
    await f.page.screenshot({ path: path.join(OUT, "roadtest-locked-375.png") });
    ok("…and the sheet's \"seen\" mark is the only thing written so far", JSON.stringify(await levels(f.page)) === JSON.stringify({ seen: { slice: 2 } }), await levels(f.page));
    const to = await tapAway(f.page, f.page.locator('#levelList .level-tile[data-level="2"]'));
    ok("Level 2 is remembered for Fruit Slice and the game opens", to && new URL(to).searchParams.get("game") === "arcade-slice.html" && (await levels(f.page)).pick.slice === 2, { to, lv: await levels(f.page) });
    await home(f.page);
    const g = await geometry(f.page, "slice");
    ok("back on Home the card carries the level badge: the numeral and two of three pips", g && g.text === "2" && g.pips === "110", g);
    ok("…top right of its picture, clear of the best tag and the Free/Included label", g.inArt && g.topRight && g.clearOfBest && g.clearOfLabel, g);
    ok("…part of the picture: no button inside the card's button, and a tap goes through", g.pointer === "none" && g.buttons === 0, g);
    ok("the card's label ends \"Level 2.\", and the best it names is Level 2's (none yet)", /^Fruit Slice\. .* Level 2\.$/.test(g.label) && !/best/i.test(g.label) && g.best === null, g.label);
    const to2 = await tapAway(f.page, card(f.page, "slice"));
    ok("the next tap goes straight to the game (it plays the level last picked)", to2 && new URL(to2).searchParams.get("game") === "arcade-slice.html", to2);
    await home(f.page);
    await f.page.evaluate(() => { const p = JSON.parse(localStorage.getItem("sona.playlevel.v1")); p.best = { slice: { "2": { n: 9, at: "2026-10-20" } } }; localStorage.setItem("sona.playlevel.v1", JSON.stringify(p)); });
    await home(f.page);
    const g2 = await geometry(f.page, "slice");
    ok("the best tag reads the level that will play: Level 2's best, \"Best 9\", still clear of the badge", g2.best && /Best\s*9/.test(await card(f.page, "slice").locator(".game-best").innerText()) && /Your best: 9\. Level 2\.$/.test(g2.label) && g2.clearOfBest, g2);
    // Level 3 opens: one more question for this game, then never again
    await f.page.evaluate(() => { const t = JSON.parse(localStorage.getItem("sona.trophy.v1")); t.t = 800; localStorage.setItem("sona.trophy.v1", JSON.stringify(t)); });
    await home(f.page);
    await card(f.page, "slice").click(); await f.page.waitForTimeout(600);
    const s3 = await f.page.evaluate(() => [...document.querySelectorAll("#levelList .level-tile")].map((b) => [b.getAttribute("aria-disabled"), b.getAttribute("aria-pressed")]));
    ok("at 800 trophies the sheet opens once more for Fruit Slice: all three open, Level 2 still picked", (await sheetOpen(f.page)) && JSON.stringify(s3) === JSON.stringify([[null, "false"], [null, "true"], [null, "false"]]), s3);
    await f.page.locator("#levelClose").click();
    ok("✕ closes it and nothing is picked", !(await sheetOpen(f.page)) && (await levels(f.page)).pick.slice === 2);
    const to3 = await tapAway(f.page, card(f.page, "slice"));
    ok("…and from then on a tap plays the remembered level", to3 && new URL(to3).searchParams.get("game") === "arcade-slice.html");
    await home(f.page);
    await card(f.page, "tiles").click(); await f.page.waitForTimeout(600);
    ok("another game asks for itself, once", await sheetOpen(f.page));
    await f.page.mouse.click(5, 5); await f.page.waitForTimeout(100);
    ok("a tap on the backdrop closes it", !(await sheetOpen(f.page)));
    const to4 = await tapAway(f.page, card(f.page, "tiles"));
    ok("…and that game's next tap plays", to4 && new URL(to4).searchParams.get("game") === "arcade-tiles.html");
    ok("Home never spoke", (await speech(f.page)).length === 0, await speech(f.page));
    ok("no page errors", f.errors.length === 0, f.errors);
  } finally { await f.context.close(); }
});

// ── 2. a grown-up's "Level 1 only", and the cards that never ask ─────────
await section("who never sees the sheet", async () => {
  let f = await fresh({ trophies: 800, levels: { cap: 1, pick: { slice: 3, tiles: 2 } }, premium: true });
  try {
    await home(f.page);
    const badges = await f.page.evaluate(() => document.querySelectorAll(".game-level").length);
    ok("with \"Level 1 only\" no card carries a badge, whatever was picked", badges === 0, badges);
    const to = await tapAway(f.page, card(f.page, "slice"));
    ok("…and a tap goes straight to the game, with no sheet", to && new URL(to).searchParams.get("game") === "arcade-slice.html" && !(await levels(f.page)).seen, await levels(f.page));
  } finally { await f.context.close(); }

  f = await fresh({ trophies: 800 });
  try {
    await home(f.page);
    const grey = card(f.page, "stack");
    ok("a Premium game this family has not opened is greyed", (await grey.getAttribute("data-locked")) === "true");
    const to = await tapAway(f.page, grey);
    ok("…and its tap takes its own path (the offer or the grown-up note), never the sheet", !(await sheetOpen(f.page)) && (to ? /\/subscribe\.html/.test(to) : await f.page.locator("#libraryNotice").isVisible()), to);
    await home(f.page);
    const feedTo = await tapAway(f.page, card(f.page, "feed"));
    ok("Feed Echo never opens the sheet (one level until Rachel says)", feedTo && new URL(feedTo).pathname === "/arcade-feed.html" && !(await levels(f.page)), feedTo);
    await home(f.page);
    const parked = f.page.locator('#activityGroups .game-card[data-game="peekaboo"]').first();
    ok("a Coming soon game stays disabled and carries no badge", (await parked.isDisabled()) && (await parked.locator(".game-level").count()) === 0);
    const bookTo = await tapAway(f.page, f.page.locator("#booksCard"));
    ok("the books never open it", bookTo && new URL(bookTo).pathname === "/library.html" && !(await levels(f.page)), bookTo);
    ok("no page errors", f.errors.length === 0, f.errors);
  } finally { await f.context.close(); }
});

// ── 3. the silent, passive library ──────────────────────────────────────
await section("Home only reads", async () => {
  const f = await fresh({ trophies: 800, premium: true, levels: { pick: { slice: 3, run: 2 }, seen: { slice: 3, run: 3 } }, bests: { run: { n: 570, at: "2026-10-02" } } });
  try {
    await f.page.goto(origin + "/__seed");
    const before = await store(f.page);
    asked.length = 0;
    await home(f.page);
    await f.page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
    await f.page.waitForTimeout(300);
    const after = await store(f.page);
    ok("loading Home and bringing it back to the front writes nothing", before === after, { before: before.length, after: after.length });
    const ownCalls = asked.filter((a) => a.from === "/today.html" && /^\/api\/(board|track)\b/.test(a.path));
    ok("Home sends no event and asks no board, on load or on coming back", ownCalls.length === 0, ownCalls);
    const run = await geometry(f.page, "run");
    ok("Sound Sprint at Level 2 shows its badge, with Level 2's best (none yet), not Level 1's 570", run.text === "2" && run.best === null && /Level 2\.$/.test(run.label), run);
    // a level picked elsewhere (the road, in a later step) is painted when Home comes back to the front
    await f.page.evaluate(() => { Sona.setPlayLevel("glide", 3); Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
    await f.page.waitForTimeout(100);
    const glide = await geometry(f.page, "glide");
    ok("a card repaints its badge when Home comes back to the front", glide.text === "3" && glide.pips === "111" && /Level 3\.$/.test(glide.label), glide);
    asked.length = 0;
    await f.page.evaluate(() => { const p = JSON.parse(localStorage.getItem("sona.playlevel.v1")); delete p.seen.slice; localStorage.setItem("sona.playlevel.v1", JSON.stringify(p)); });
    await home(f.page);
    await card(f.page, "slice").click(); await f.page.waitForTimeout(600);
    await tapAway(f.page, f.page.locator('#levelList .level-tile[data-level="2"]'));
    await f.page.waitForTimeout(150);
    ok("a level picked on the sheet sends nothing either (the game page says \"level played\")", asked.filter((a) => /^\/api\/(board|track)\b/.test(a.path)).length === 0, asked);
    ok("Home never spoke", (await speech(f.page)).length === 0, await speech(f.page));
    ok("no page errors", f.errors.length === 0, f.errors);
  } finally { await f.context.close(); }
});

// ── 4. small phones ─────────────────────────────────────────────────────
for (const vp of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }]) {
  await section("fit at " + vp.width, async () => {
    const f = await fresh({ ...vp, trophies: 800, premium: true, levels: { pick: { run: 3, tiles: 2, hoops: 2, bubbles: 3 }, seen: { run: 3, tiles: 3, hoops: 3, bubbles: 3 } }, bests: { run: { n: 570, at: "2026-10-02" } } });
    try {
      await f.page.evaluate(() => { localStorage.setItem("sona.playlevel.v1", JSON.stringify(Object.assign(JSON.parse(localStorage.getItem("sona.playlevel.v1")), { best: { run: { "3": { n: 570, at: "2026-10-20" } }, tiles: { "2": { n: 53, at: "2026-10-20" } } } }))); });
      await home(f.page);
      const w = vp.width + "px: ";
      if (vp.width === 320) { await card(f.page, "run").scrollIntoViewIfNeeded(); await f.page.screenshot({ path: path.join(OUT, "roadtest-badges-320.png") }); }
      for (const key of ["run", "tiles", "hoops", "bubbles"]) {
        const g = await geometry(f.page, key);
        ok(w + key + "'s badge is inside its picture, top right, clear of the best tag and the label", g && g.text && g.inArt && g.topRight && g.clearOfBest && g.clearOfLabel, g);
      }
      ok(w + "Home has no sideways scroll", (await overflow(f.page)) <= 1, await overflow(f.page));
      const hdr = await f.page.evaluate(() => { const p = document.getElementById("repPill").getBoundingClientRect(), g = document.getElementById("parentBtn").getBoundingClientRect(), b = document.getElementById("buddyBtn").getBoundingClientRect(); return { apart: p.left >= b.right && p.right <= g.left, inside: g.right <= document.documentElement.clientWidth, oneLine: p.height <= 45 }; });
      ok(w + "the header still fits side by side (repweektest's numbers)", hdr.apart && hdr.inside && hdr.oneLine, hdr);
      await f.page.evaluate(() => { const p = JSON.parse(localStorage.getItem("sona.playlevel.v1")); delete p.seen.slice; localStorage.setItem("sona.playlevel.v1", JSON.stringify(p)); });
      await home(f.page);
      await card(f.page, "slice").scrollIntoViewIfNeeded(); await card(f.page, "slice").click(); await f.page.waitForTimeout(150);
      const fit = await f.page.evaluate(() => {
        const m = document.getElementById("levelModal").getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
        const tiles = [...document.querySelectorAll("#levelList .level-tile")].map((b) => { const r = b.getBoundingClientRect(); return { h: r.height, w: r.width, l: r.left, r: r.right, t: r.top, b: r.bottom }; });
        const close = document.getElementById("levelClose").getBoundingClientRect();
        const lines = [...document.querySelectorAll("#levelList .level-line")].map((e) => e.scrollWidth <= e.clientWidth + 1);
        return { m: { l: m.left, r: m.right, t: m.top, b: m.bottom, w: m.width }, vw, vh, tiles, close: { w: close.width, h: close.height, inside: close.left >= m.left && close.right <= m.right && close.top >= m.top }, lines, scroll: document.getElementById("levelModal").scrollHeight - document.getElementById("levelModal").clientHeight };
      });
      ok(w + "the sheet fits the screen, three tiles at least 48 px tall inside it", fit.tiles.length === 3 && fit.m.l >= 0 && fit.m.r <= fit.vw && fit.m.t >= 0 && fit.m.b <= fit.vh && fit.m.w <= 330.5 && fit.tiles.every((t) => t.h >= 48 && t.l >= fit.m.l && t.r <= fit.m.r && t.b <= fit.m.b) && fit.scroll <= 1, fit);
      ok(w + "its ✕ is a full tap target inside the sheet, and every line fits its tile", fit.close.w >= 36 && fit.close.h >= 36 && fit.close.inside && fit.lines.every(Boolean), fit);
      ok(w + "no page errors", f.errors.length === 0, f.errors);
      if (vp.width === 320) await f.page.screenshot({ path: path.join(OUT, "roadtest-levels-320.png") });
    } finally { await f.context.close(); }
  });
}

// ── 5. Settings: a grown-up can keep a child on Level 1 ─────────────────
await section("Settings' Game levels", async () => {
  const f = await fresh({ trophies: 800, levels: { pick: { slice: 3 } } });
  try {
    // a second child, active: the picker belongs to the child the page was painted for
    await f.page.goto(origin + "/__sona");
    await f.page.waitForFunction(() => window.Sona && Sona.addKid);
    await f.page.evaluate(() => { Sona.addKid("Ben", "6"); Sona.gateVerify(); });
    const slot = await f.page.evaluate(() => Sona.activeKid().slot);
    await f.page.goto(origin + "/settings.html"); await f.page.waitForSelector("#playLevelCap");
    const g = await f.page.evaluate(() => { const el = document.getElementById("playLevelCap"); return { label: (document.querySelector('label[for="playLevelCap"]') || {}).textContent, value: el.value, opts: [...el.options].map((o) => [o.value, o.textContent.trim()]), note: document.getElementById("playLevelNote").textContent, inBuddy: !!el.closest("#buddyCard"), shown: el.getBoundingClientRect().height > 0 }; });
    ok("Settings has a \"Game levels\" picker in the Buddy & world card, starting on \"Open as earned\"", g.label === "Game levels" && g.inBuddy && g.shown && g.value === "" && JSON.stringify(g.opts) === JSON.stringify([["", "Open as earned"], ["1", "Level 1 only"]]), g);
    ok("its grey line says what a level changes, with the child's name", g.note === "Harder levels change only how fast or busy a game is, never what Ben says.", g.note);
    await f.page.setViewportSize({ width: 320, height: 700 });
    const fit = await f.page.evaluate(() => { const el = document.getElementById("playLevelCap"), cs = getComputedStyle(el), c = document.createElement("canvas").getContext("2d");
      c.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
      return { room: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 28, widths: [...el.options].map((o) => Math.ceil(c.measureText(o.textContent.trim()).width)), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
    ok("every choice can be read in full while the picker is closed, on a 320 px phone", fit.room > 100 && fit.widths.every((w) => w > 20 && w <= fit.room) && fit.overflow <= 1, fit);
    await f.page.setViewportSize({ width: 390, height: 844 });
    await f.page.selectOption("#playLevelCap", "1"); await f.page.waitForTimeout(250);
    const saved = await f.page.evaluate((slot) => ({ mine: JSON.parse(localStorage.getItem("sona.playlevel.v1@" + slot) || "null"), first: JSON.parse(localStorage.getItem("sona.playlevel.v1") || "null"), open: Sona.playLevelsOpen() }), slot);
    ok("\"Level 1 only\" saves cap 1 for the selected child, and only that child", saved.mine && saved.mine.cap === 1 && saved.open === 1 && saved.first && !saved.first.cap && saved.first.pick.slice === 3, saved);
    await f.page.reload(); await f.page.waitForSelector("#playLevelCap");
    ok("…and it shows again on the next visit", (await f.page.inputValue("#playLevelCap")) === "1");
    await f.page.selectOption("#playLevelCap", ""); await f.page.waitForTimeout(250);
    ok("\"Open as earned\" lifts it", await f.page.evaluate((slot) => !("cap" in (JSON.parse(localStorage.getItem("sona.playlevel.v1@" + slot)) || {})), slot));
    ok("no page errors", f.errors.length === 0, f.errors);
  } finally { await f.context.close(); }
});

// ── 6. the copy a child can see ─────────────────────────────────────────
{
  const src = readFileSync(path.join(ROOT, "today.html"), "utf8");
  const sheet = (src.match(/<div class="ovl" id="levelOvl"[\s\S]*?<\/div>\s*<\/div>/) || [""])[0] + (src.match(/function openLevels\(game\)\{[\s\S]*?\n {6}\}/) || [""])[0];
  const lines = JSON.stringify((readFileSync(path.join(ROOT, "sona.js"), "utf8").match(/const PLAY_LEVEL_LINES = \{[\s\S]*?\};/) || [""])[0]);
  const text = (sheet + lines).replace(/<!--[\s\S]*?-->/g, "").replace(/\/\/[^\n]*/g, "").replace(/<[^>]+>/g, " ");
  ok("the level sheet and the level lines are found", sheet.length > 400 && lines.length > 200);
  const bad = text.match(/\b(score|points?|high score|rare|epic|legendary|mystery|you're back|missed|lost|behind|hurry|ends in|last chance|streak)\b|\$\d/gi);
  ok("no word on the sheet or in the level lines is one a child must never see (score, points, rare, missed, hurry, streak…)", !bad, bad);
}

console.log(fails ? `\n${fails} FAILED` : "\nall road and level checks passed");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
