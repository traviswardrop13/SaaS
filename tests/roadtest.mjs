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
//   - a grey Premium card, a book and Feed Echo never open the sheet, and a
//     Coming soon game has no card to tap (19 Oct 2026); a grown-up's
//     "Level 1 only" turns it all off;
//   - Home stays the silent library: no voice, no event, nothing written on
//     load or on coming back to the front, only the "seen" mark and the pick
//     on a child's tap; nothing fits off the screen at 320 px;
//   - Settings' "Game levels" picker starts on "Open as earned", fits a
//     closed picker at 320 px and saves "Level 1 only" for the selected child.
// The Trophy Road (step 6, 11 Oct 2026) joined in sections 7 to 10:
//   - Home's one card under the story's two doors: the next gift's picture (or the
//     waiting one, or the chest when it is ready) and a bar filling toward
//     it, the words in its label; it only reads, and sends nothing;
//   - the road page: today's chest in each state and its three taps, a Big
//     Chest every fifth day, stops that wait until opened and say what they
//     gave, every waiting stop shown however far back, the month's gifts
//     handed out once when a month has ended, "Game levels" for the games
//     this family can open, no confetti under Reduce Motion, silent, nothing
//     third-party, and nothing off the side of a small phone;
//   - the sticker book: back to the road, and no count.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { chromium, ROOT, launchOpts, OUT } from "./_env.mjs";
import { servePark } from "./_parked.mjs";

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
async function fresh({ width = 375, height = 812, trophies = 0, levels = null, premium = false, bests = null, extra = null, now = 0, ledger = null, motion = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: motion ? "no-preference" : "reduce" });
  // a phone whose clock says another day (the month's end), set before any page script runs
  if (now) await context.addInitScript((at) => { const R = Date, off = at - R.now(); function D(a, b, c, d, e, f, g) { const n = arguments.length; return n === 0 ? new R(R.now() + off) : n === 1 ? new R(a) : new R(a, b, c || 1, d || 0, e || 0, f || 0, g || 0); } D.prototype = R.prototype; D.now = () => R.now() + off; D.parse = R.parse; D.UTC = R.UTC; window.Date = D; }, now);
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
    // every event a page sends to the relay, by name
    const sb = navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null;
    navigator.sendBeacon = function (u, b) { try { if (/\/api\/track/.test(String(u))) { const l = JSON.parse(sessionStorage.getItem("test.beacons") || "[]"); l.push(JSON.parse(b).e); sessionStorage.setItem("test.beacons", JSON.stringify(l)); } } catch (e) {} return sb ? sb(u, b) : true; };
  });
  const page = await context.newPage(); page.setDefaultTimeout(5000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => { const u = new URL(r.url()); if (u.pathname.startsWith("/api/")) asked.push({ path: u.pathname, from: (() => { try { return new URL(r.frame().url()).pathname; } catch (e) { return ""; } })() }); });
  await page.goto(origin + "/__seed");
  await page.evaluate(({ trophies, levels, premium, bests, extra, TODAY, ledger }) => {
    ["", "2", "3", "4", "5"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", n ? "done" : "post"));
    localStorage.setItem("sona.freever.v1", "kept");
    // the kept-buddies stamp (OWN1, step 7) too: unset, the sweep would stamp
    // it and write the legacy set on Home's first load, and the snapshots
    // below hold Home to writing nothing
    localStorage.setItem("sona.buddyset.v1", "kept");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, voiceOn: false, soundOn: false, volume: 0 }));
    sessionStorage.setItem("sona.paidui", "1");
    if (premium) localStorage.setItem("sona.sub.v1", JSON.stringify({ active: true, since: Date.now(), source: "stripe" }));
    localStorage.setItem("sona.trophy.v1", JSON.stringify(ledger || { v: 1, t: trophies, d: TODAY, dn: 0, m: TODAY.slice(0, 7), mn: 0 }));
    if (levels) localStorage.setItem("sona.playlevel.v1", JSON.stringify(levels));
    if (bests) localStorage.setItem("sona.bests.v1", JSON.stringify(bests));
    Object.keys(extra || {}).forEach((k) => localStorage.setItem(k, extra[k]));
  }, { trophies, levels, premium, bests, extra, TODAY, ledger });
  return { context, page, errors };
}
// The game cards (their levels, badges and the level sheet) are Home's Arcade
// since 22 Oct 2026 (STORY1); the Trophy Road card is on Home itself, under
// the story card's two doors.
async function home(page) { await page.goto(origin + "/today.html?view=arcade"); await page.waitForFunction(() => window.Sona && document.querySelector("#activityGroups .game-card")); await page.waitForTimeout(150); }
async function homeView(page) { await page.goto(origin + "/today.html"); await page.waitForFunction(() => window.Sona && document.querySelector("#activityGroups .game-card")); await page.waitForTimeout(150); }
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
    // none is parked since 22 Oct 2026; Peekaboo is parked again here
    await servePark(f.context, ROOT);
    await home(f.page);
    const grey = card(f.page, "stack");
    ok("a Premium game this family has not opened is greyed", (await grey.getAttribute("data-locked")) === "true");
    const to = await tapAway(f.page, grey);
    ok("…and its tap takes its own path (the offer or the grown-up note), never the sheet", !(await sheetOpen(f.page)) && (to ? /\/subscribe\.html/.test(to) : await f.page.locator("#libraryNotice").isVisible()), to);
    await home(f.page);
    const feedTo = await tapAway(f.page, card(f.page, "feed"));
    ok("Feed Echo never opens the sheet (one level until Rachel says)", feedTo && new URL(feedTo).pathname === "/arcade-feed.html" && !(await levels(f.page)), feedTo);
    await home(f.page);
    ok("a Coming soon game has no card on Home, so no badge and no sheet", (await f.page.locator('#libraryApp [data-game="peekaboo"]').count()) === 0 && (await f.page.locator("#libraryApp .game-card:disabled").count()) === 0);
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

// ── 7. Home's Trophy Road card ──────────────────────────────────────────
const roadSeen = { got: {}, items: {}, m: TODAY.slice(0, 7), mgot: {} };
const opened = (...ns) => JSON.stringify(Object.assign({}, roadSeen, { got: Object.fromEntries(ns.map((n) => [n, 1])) }));
const cardOf = (page) => page.evaluate(() => {
  const c = document.getElementById("roadCard"); if (!c) return null;
  const r = c.getBoundingClientRect(), doors = document.getElementById("homeDoors");
  return { shown: !c.hidden && r.height > 0, label: c.getAttribute("aria-label"), href: c.getAttribute("href"), dot: !document.getElementById("roadDot").hidden,
    bar: [...document.querySelectorAll("#roadBar i")].map((i) => (i.className === "on" ? 1 : 0)).join(""),
    pic: (() => { const p = document.getElementById("roadPic"), im = p.querySelector("img"); return im ? im.getAttribute("src") : p.querySelector(".road-level") ? "level" : p.querySelector(".road-coins") ? "coins" : p.querySelector(".road-stk") ? "sticker" : p.innerHTML.slice(0, 40); })(),
    small: document.getElementById("roadSmall").textContent, afterDoors: !!doors && doors.nextElementSibling === c, h1: document.querySelector("h1") && document.querySelector("h1").textContent,
    gameish: c.hasAttribute("data-game") || c.hasAttribute("data-locked") || c.classList.contains("game-card"), h: r.height, w: r.width, l: r.left, rt: r.right };
});
await section("Home's road card", async () => {
  let f = await fresh({ trophies: 0 });
  try {
    await f.page.goto(origin + "/__seed");
    const before = await store(f.page);
    asked.length = 0;
    await homeView(f.page);
    const c = await cardOf(f.page);
    ok("the card sits right under Home's two doors (Arcade, Books), Home's first heading is \"Today's adventure\", and it opens the road", c && c.shown && c.afterDoors && c.h1 === "Today's adventure" && c.href === "/road.html", c);
    ok("a new child: the first gift's picture (coins), an empty bar, no dot, and its label says where the next gift is", c.pic === "coins" && c.bar === "00000" && !c.dot && c.label === "Trophy Road. 0 trophies. 0 coins. Next gift at 30 trophies.", c);
    ok("the counts under the bar are small numbers beside the drawn trophy and coin, never a word to read", /^0\s*0$/.test(c.small.trim()) && (await f.page.locator("#roadSmall svg").count()) === 2, c.small);
    ok("it is a link, not a game card: no data-game, data-locked or .game-card", !c.gameish);
    ok("loading Home with the card writes nothing", (await store(f.page)) === before);
    await f.page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); Sona.gameRep("R"); Sona.gameRep("R"); Sona.gameRep("R"); Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
    await f.page.waitForTimeout(150);
    const c2 = await cardOf(f.page);
    ok("a rep made while Home was behind a game repaints the card when Home comes back to the front", /^Trophy Road\. 3 trophies\./.test(c2.label) && c2.bar === "00000" && /^3/.test(c2.small.trim()), c2);
    const own = asked.filter((a) => a.from === "/today.html" && /^\/api\/(board|track)\b/.test(a.path));
    ok("Home made no /api/board or /api/track request on load or coming back", own.length === 0, own);
    ok("Home never spoke", (await speech(f.page)).length === 0);
  } finally { await f.context.close(); }

  f = await fresh({ trophies: 120, extra: { "sona.road.v1": opened(1, 2) } });
  try {
    await homeView(f.page);
    const c = await cardOf(f.page);
    ok("the next stop is a level: its picture leads with the numeral, the bar is two-fifths full, and the label says \"Level 2 at 150 trophies.\"",
      c.pic === "level" && c.bar === "11000" && !c.dot && c.label === "Trophy Road. 120 trophies. 0 coins. Level 2 at 150 trophies.", c);
  } finally { await f.context.close(); }

  f = await fresh({ trophies: 340, extra: { "sona.road.v1": opened(1, 2, 3, 4, 5) } });
  try {
    await homeView(f.page);
    const c = await cardOf(f.page);
    ok("the next stop is the Sun hat: its painted picture, and \"Next gift at 380 trophies.\"", c.pic === "/assets/crafted/hat-sunhat.webp" && !c.dot && c.label === "Trophy Road. 340 trophies. 0 coins. Next gift at 380 trophies.", c);
  } finally { await f.context.close(); }

  f = await fresh({ trophies: 50 });
  try {
    await homeView(f.page);
    const c = await cardOf(f.page);
    ok("a gift waiting on the road: its picture, a full bar, the teal dot, and \"A gift is waiting.\"", c.pic === "coins" && c.bar === "11111" && c.dot && /A gift is waiting\.$/.test(c.label), c);
    const dot = await f.page.evaluate(() => getComputedStyle(document.getElementById("roadDot")).backgroundColor);
    ok("…the dot is teal, never orange (orange is only the practice sound's letters)", dot === "rgb(20, 133, 141)", dot);
  } finally { await f.context.close(); }

  f = await fresh({ trophies: 100 });
  try { await homeView(f.page); const c = await cardOf(f.page); ok("two waiting say so in the label", c.dot && /2 gifts are waiting\.$/.test(c.label), c.label); } finally { await f.context.close(); }

  f = await fresh({ trophies: 30, extra: { "sona.road.v1": opened(1), "sona.goaldays.v1": JSON.stringify({ [TODAY]: 30 }) } });
  try {
    await f.page.goto(origin + "/__seed");
    const before = await store(f.page);
    asked.length = 0;
    await homeView(f.page);
    const c = await cardOf(f.page);
    ok("today's goal met (a stamp): the painted chest leads, the bar is full, the dot shows, and \"Your chest is ready.\"", /road-chest\.webp$/.test(c.pic) && c.bar === "11111" && c.dot && /Your chest is ready\.$/.test(c.label), c);
    ok("…and Home still writes nothing: it never opens the chest, settles a month or sends an event", (await store(f.page)) === before && asked.filter((a) => a.from === "/today.html" && /^\/api\/(board|track)\b/.test(a.path)).length === 0);
  } finally { await f.context.close(); }

  for (const vp of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 768, height: 1024 }]) {
    f = await fresh({ ...vp, trophies: 1350, extra: { "sona.road.v1": opened(...Array.from({ length: 14 }, (_, i) => i + 1)), "sona.goaldays.v1": JSON.stringify({ [TODAY]: 30 }) } });
    try {
      await homeView(f.page);
      const c = await cardOf(f.page), w = vp.width + "px: ";
      const hdr = await f.page.evaluate(() => { const p = document.getElementById("repPill").getBoundingClientRect(), g = document.getElementById("parentBtn").getBoundingClientRect(), b = document.getElementById("buddyBtn").getBoundingClientRect(); return { apart: p.left >= b.right && p.right <= g.left, inside: g.right <= document.documentElement.clientWidth, oneLine: p.height <= 45 }; });
      ok(w + "the card fits inside the page, at least 60 px tall, with no sideways scroll, and the header still fits", c.shown && c.l >= 0 && c.rt <= vp.width && c.h >= 60 && (await overflow(f.page)) <= 1 && hdr.apart && hdr.inside && hdr.oneLine, { c, hdr });
      if (vp.width === 320) await f.page.screenshot({ path: path.join(OUT, "roadtest-card-320.png") });
    } finally { await f.context.close(); }
  }
});

// ── 8. the road page ────────────────────────────────────────────────────
async function road(page) { await page.goto(origin + "/road.html"); await page.waitForFunction(() => window.Sona && !document.getElementById("road").hidden && document.querySelector("#roadList .rd-stop")); await page.waitForTimeout(150); }
const beacons = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("test.beacons") || "[]"));
const coins = (page) => page.evaluate(() => Sona.coinsNow());
const line = (page) => page.locator("#giftLine").innerText();
async function yay(page) { await page.waitForTimeout(450); await page.click("#giftGo"); await page.waitForTimeout(80); }
async function tapBox(page, n = 3) { await page.waitForTimeout(450); for (let i = 0; i < n; i++) { await page.click("#giftBox"); await page.waitForTimeout(60); } }
await section("the road page: today's chest", async () => {
  let f = await fresh({ trophies: 14, extra: { "sona.gamereps.v1": JSON.stringify({ [TODAY]: { R: 14 } }) } });
  try {
    await road(f.page);
    const shut = await f.page.evaluate(() => ({ line: document.getElementById("chestLine").textContent, inside: document.getElementById("chestInside").textContent, count: document.getElementById("chestCount").textContent, meter: !document.getElementById("chestMeter").hidden, btn: !document.getElementById("chestOpen").hidden, art: (document.querySelector("#chestArt img") || {}).getAttribute && document.querySelector("#chestArt img").getAttribute("src") }));
    ok("before the goal: the painted chest, what is inside, \"Reach your goal today to open your chest!\" and the day's meter, 14/30", shut.line === "Reach your goal today to open your chest!" && shut.inside === "Inside: 10 coins" && shut.count === "14/30" && shut.meter && !shut.btn && /road-chest\.webp$/.test(shut.art), shut);
    ok("the page settled nothing and sent nothing on load", (await beacons(f.page)).length === 0 && asked.filter((a) => a.from === "/road.html" && /^\/api\/track/.test(a.path)).length === 0);
  } finally { await f.context.close(); }

  f = await fresh({ trophies: 30, extra: { "sona.gamereps.v1": JSON.stringify({ [TODAY]: { R: 30 } }), "sona.road.v1": opened(1) } });
  try {
    await road(f.page);
    ok("the goal met: \"Your chest is ready!\" and the teal \"Open it\"", (await f.page.locator("#chestLine").innerText()) === "Your chest is ready!" && (await f.page.locator("#chestOpen").isVisible()) && (await f.page.locator("#chestOpen").innerText()) === "Open it");
    await f.page.click("#chestOpen");
    await tapBox(f.page, 1);
    const a = await line(f.page);
    await tapBox(f.page, 1);
    const b = await line(f.page);
    ok("the chest takes taps: \"Tap, tap!\", \"One more tap!\", and nothing is paid yet", a === "Tap, tap!" && b === "One more tap!" && (await coins(f.page)) === 0, [a, b]);
    await tapBox(f.page, 1);
    await f.page.waitForTimeout(900);
    ok("the third tap opens it: \"+10 coins!\", 10 coins in the wallet, the reward chime and no voice", (await line(f.page)) === "+10 coins!" && (await coins(f.page)) === 10 && (await speech(f.page)).length === 0, await line(f.page));
    ok("…and sona.js (not the page) tells the relay \"chest opened\", with nothing else", JSON.stringify(await beacons(f.page)) === JSON.stringify(["chest opened"]), await beacons(f.page));
    ok("…with no confetti under Reduce Motion", (await f.page.evaluate(() => document.querySelectorAll("body > canvas").length)) === 0);
    await yay(f.page);
    ok("Yay! closes it; the card says \"You opened today's chest!\" and the header counts 10 coins", (await f.page.locator("#giftOvl").isHidden()) && (await f.page.locator("#chestLine").innerText()) === "You opened today's chest!" && (await f.page.locator("#coinN").innerText()) === "10" && (await f.page.locator("#chipCoin").getAttribute("aria-label")) === "10 coins");
    await f.page.reload(); await f.page.waitForTimeout(300);
    ok("a reload still says \"You opened today's chest!\", with no button and nothing paid again", (await f.page.locator("#chestLine").innerText()) === "You opened today's chest!" && (await f.page.locator("#chestOpen").isHidden()) && (await coins(f.page)) === 10);
    ok("no page errors", f.errors.length === 0, f.errors);
  } finally { await f.context.close(); }

  f = await fresh({ trophies: 30, motion: true, extra: { "sona.gamereps.v1": JSON.stringify({ [TODAY]: { R: 30 } }), "sona.road.v1": opened(1), "sona.chest.v1": JSON.stringify({ n: 4, last: "2026-10-01" }) } });
  try {
    await road(f.page);
    ok("the 5th chest says what is inside before it opens: \"Big chest: 25 coins and a sticker\"", (await f.page.locator("#chestInside").innerText()) === "Big chest: 25 coins and a sticker" && /road-bigchest\.webp$/.test(await f.page.locator("#chestArt img").getAttribute("src")));
    await f.page.click("#chestOpen"); await tapBox(f.page, 3); await f.page.waitForTimeout(900);
    const l1 = await line(f.page), confetti = await f.page.evaluate(() => document.querySelectorAll("body > canvas").length);
    await yay(f.page);
    const l2 = await line(f.page);
    ok("it opens to \"+25 coins and a sticker!\", then \"You found the Star sticker!\"", l1 === "+25 coins and a sticker!" && l2 === "You found the Star sticker!" && (await coins(f.page)) === 25 && (await f.page.evaluate(() => Sona.hasSticker("star"))), [l1, l2]);
    ok("…and with motion allowed it throws confetti (so the Reduce Motion check above means something)", confetti >= 1, confetti);
    await yay(f.page);
    ok("once it is open the card shows the Big Chest the child opened, not the ordinary one that comes next", (await f.page.locator("#giftOvl").isHidden()) && /road-bigchest-open\.webp$/.test(await f.page.locator("#chestArt img").getAttribute("src")), await f.page.locator("#chestArt img").getAttribute("src"));
  } finally { await f.context.close(); }

  // the 5th chest with every sticker already in the book: its first line promises no sticker
  f = await fresh({ trophies: 30, extra: { "sona.gamereps.v1": JSON.stringify({ [TODAY]: { R: 30 } }), "sona.road.v1": opened(1), "sona.chest.v1": JSON.stringify({ n: 4, last: "2026-10-01" }) } });
  try {
    await f.page.goto(origin + "/__sona"); await f.page.waitForFunction(() => window.Sona && Sona.STICKERS);
    await f.page.evaluate(() => { const all = {}; Sona.STICKERS.forEach((x) => { all[x.id] = { at: 1 }; }); localStorage.setItem("sona.stickers.v1", JSON.stringify(all)); });
    await road(f.page);
    await f.page.click("#chestOpen"); await tapBox(f.page, 3); await f.page.waitForTimeout(900);
    const f1 = await line(f.page); await yay(f.page); const f2 = await line(f.page);
    ok("with a full sticker book the Big Chest says \"+25 coins!\", then \"Your sticker book is full! Here are 20 coins!\"", f1 === "+25 coins!" && f2 === "Your sticker book is full! Here are 20 coins!" && (await coins(f.page)) === 45, [f1, f2]);
    await yay(f.page);
    ok("…and an ordinary chest comes next while the card shows the open Big Chest", /road-bigchest-open\.webp$/.test(await f.page.locator("#chestArt img").getAttribute("src")));
  } finally { await f.context.close(); }
});

await section("the road page: stops and the month", async () => {
  let f = await fresh({ trophies: 2000 });
  try {
    await road(f.page);
    const stops = await f.page.evaluate(() => [...document.querySelectorAll("#roadList .rd-stop")].map((r) => ({ n: +r.dataset.stop, open: r.classList.contains("open"), tag: r.tagName, flag: (r.querySelector(".rd-flag") || {}).textContent || "" })));
    const ns = stops.map((s) => s.n);
    ok("with 2,000 trophies and nothing opened, every stop from 1 to 21 waits on the page, each a button that says \"Open!\"", [...Array(21)].every((_, i) => ns.includes(i + 1)) && stops.filter((s) => s.n <= 21).every((s) => s.open && s.tag === "BUTTON" && s.flag === "Open!"), stops.slice(0, 3));
    ok("…and the stops ahead (to ten past the child) are shown, not buttons", ns.includes(31) && !ns.includes(32) && stops.filter((s) => s.n > 21).every((s) => !s.open && s.tag === "DIV"), ns.slice(-3));
    const hero = await f.page.evaluate(() => ({ wait: document.getElementById("waitText").textContent, next: !document.getElementById("openNext").hidden, land: document.getElementById("landName").textContent, lands: [...document.querySelectorAll(".rd-landhead h3")].map((h) => h.textContent), here: !!document.querySelector('.rd-stop[data-stop="21"] .rd-here'), band: getComputedStyle(document.getElementById("heroBand")).backgroundImage, buddy: document.getElementById("heroBuddy").getAttribute("src") }));
    ok("the hero says how many wait (\"21 gifts waiting!\"), shows \"Open next\", the land, and the buddy standing", hero.wait === "21 gifts waiting!" && hero.next && hero.land === "Under the Sea" && /buddy-fox-rest\.webp$/.test(hero.buddy || ""), hero);
    ok("each land has its own band, in order, with its painted picture over its colours", JSON.stringify(hero.lands) === JSON.stringify(["Sunny Meadow", "Beach Bay", "Snowy Peak", "Under the Sea", "Starry Sky", "Champion Trail"]) && /customize-forest-v2\.webp/.test(await f.page.evaluate(() => getComputedStyle(document.querySelector(".rd-landhead")).backgroundImage)) && /linear-gradient/.test(hero.band), hero);
    ok("\"You are here\" is the buddy's face on the stop the child reached", hero.here);
    await f.page.click("#openNext"); await f.page.waitForTimeout(500);
    ok("\"Open next\" opens stop 1: \"+20 coins!\"", (await line(f.page)) === "+20 coins!" && (await coins(f.page)) === 20 && (await f.page.evaluate(() => JSON.parse(localStorage.getItem("sona.road.v1")).got[1])) === 1, await line(f.page));
    await yay(f.page);
    await f.page.click('#roadList .rd-stop[data-stop="2"]'); await f.page.waitForTimeout(500);
    ok("stop 2: \"You found the Star sticker!\"", (await line(f.page)) === "You found the Star sticker!", await line(f.page));
    await yay(f.page);
    await f.page.click('#roadList .rd-stop[data-stop="3"]'); await f.page.waitForTimeout(500);
    const l3 = await line(f.page); await yay(f.page); const l3b = await line(f.page);
    ok("stop 3: \"Level 2 is open!\" (not \"in every game\": since 22 Oct 2026 most games have no levels), then \"+20 coins!\"", l3 === "Level 2 is open!" && l3b === "+20 coins!", [l3, l3b]);
    await yay(f.page);
    await f.page.click('#roadList .rd-stop[data-stop="4"]'); await f.page.waitForTimeout(500); await yay(f.page);
    await f.page.click('#roadList .rd-stop[data-stop="5"]'); await f.page.waitForTimeout(300);
    ok("stop 5 is a Big Chest: it takes three taps", (await line(f.page)) === "Tap, tap, tap!" && (await f.page.locator("#giftBox").isVisible()));
    await tapBox(f.page, 3); await f.page.waitForTimeout(900);
    const big = [await line(f.page)]; await yay(f.page); big.push(await line(f.page)); await yay(f.page); big.push(await line(f.page));
    ok("…then shows each gift in turn: \"+40 coins!\", the next sticker, \"Welcome to Beach Bay!\"", big[0] === "+40 coins!" && /^You found the .+ sticker!$/.test(big[1]) && big[2] === "Welcome to Beach Bay!", big);
    await yay(f.page);
    const after = await f.page.evaluate(() => ({ first: +document.querySelector("#roadList .rd-stop").dataset.stop, done: [...document.querySelectorAll("#roadList .rd-stop.done")].map((r) => r.dataset.stop).join(), got: JSON.parse(localStorage.getItem("sona.road.v1")).got, wait: document.getElementById("waitText").textContent, coins: Sona.coinsNow() }));
    ok("the hero counts what is left, the stops just opened stay where they were (a ✓ each), and the coins add up (20 + 20 + 30 + 40)", after.first === 1 && after.done === "1,2,3,4,5" && JSON.stringify(after.got) === JSON.stringify({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }) && after.wait === "16 gifts waiting!" && after.coins === 110, after);
    await f.page.reload(); await f.page.waitForTimeout(300);
    ok("on the next visit the road starts at the lowest stop still waiting", (await f.page.evaluate(() => +document.querySelector("#roadList .rd-stop").dataset.stop)) === 6);
    ok("each gift told the relay once, by kind only", JSON.stringify(await beacons(f.page)) === JSON.stringify(Array(5).fill("road gift opened")), await beacons(f.page));
    ok("the road page never spoke, and logged no page error", (await speech(f.page)).length === 0 && f.errors.length === 0, f.errors);
  } finally { await f.context.close(); }

  // the month's path, and a month that ended while the child was away
  // (stops 1 to 11 opened on this build: the Sun hat and Hops the frog
  // already handed over, so only the months are owed)
  const DEC3 = new Date(2026, 11, 3, 10).getTime();
  f = await fresh({ now: DEC3, ledger: { v: 1, t: 900, d: "2026-11-30", dn: 30, m: "2026-11", mn: 200, pm: "2026-10", pmn: 300 },
    extra: { "sona.road.v1": JSON.stringify({ got: Object.fromEntries(Array.from({ length: 11 }, (_, i) => [i + 1, 1])), items: { "6:sunhat": 1, "10:frog": 1 }, m: "2026-10", mgot: { 1: 1 } }) } });
  try {
    await road(f.page);
    const n = await f.page.evaluate(() => ({ note: document.getElementById("rolledText").textContent, shown: !document.getElementById("rolledNote").hidden, title: document.getElementById("monthTitle").textContent, coins: Sona.coinsNow(), stk: Object.keys(JSON.parse(localStorage.getItem("sona.stickers.v1") || "{}")).length, m: JSON.parse(localStorage.getItem("sona.road.v1")).m }));
    ok("in December, the road page hands out October's and November's steps once and says so in one line", n.shown && n.note === "Your October and November gifts are in your wallet!" && n.coins === 25 && n.stk === 3 && n.m === "2026-12", n);
    ok("…the path is December's now", n.title === "December path", n.title);
    ok("…and nothing in the overlay blocks the page", await f.page.locator("#giftOvl").isHidden());
    await f.page.reload(); await f.page.waitForTimeout(300);
    const n2 = await f.page.evaluate(() => ({ shown: !document.getElementById("rolledNote").hidden, coins: Sona.coinsNow() }));
    ok("a reload pays nothing again, and the line has been seen (it shows once)", !n2.shown && n2.coins === 25, n2);
    ok("no page errors", f.errors.length === 0, f.errors);
  } finally { await f.context.close(); }

  // the road's own items joined their stops with their art (step 8): a child
  // who opened stop 6 and the Big Chest at 10 before then (their coins
  // paid, no item) is handed the Sun hat and Hops the frog on the road
  // page's load, one reveal each, and keeps the coins
  f = await fresh({ trophies: 800, extra: { "sona.road.v1": JSON.stringify({ got: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 1])), items: {}, m: TODAY.slice(0, 7), mgot: {} }) } });
  try {
    await f.page.goto(origin + "/road.html"); await f.page.waitForFunction(() => window.Sona && !document.getElementById("giftOvl").hidden); await f.page.waitForTimeout(500);
    const seen = [];
    for (let i = 0; i < 2; i++) { seen.push({ line: await line(f.page), art: await f.page.evaluate(() => { const i = document.querySelector("#giftArt img"); return i ? i.getAttribute("src") : ""; }), tryOn: await f.page.evaluate(() => { const t = document.getElementById("giftTry"); return t.hidden ? "" : t.getAttribute("href"); }) }); await yay(f.page); }
    ok("a stop passed before its item joined: \"A new gift came to a stop you passed: Sun hat!\", then Hops the frog, each with its painted picture and \"Try it on\"",
      seen[0].line === "A new gift came to a stop you passed: Sun hat!" && seen[0].art === "/assets/crafted/hat-sunhat.webp" && seen[0].tryOn === "/customize.html#hats" &&
      seen[1].line === "A new gift came to a stop you passed: Hops the frog!" && /buddy-frog-v2\.webp$/.test(seen[1].art) && seen[1].tryOn === "/customize.html#buddies", seen);
    const st = await f.page.evaluate(() => ({ hat: Sona.owns("outfits", "sunhat"), frog: Sona.owns("characters", "frog"), coins: Sona.coinsNow(), items: JSON.parse(localStorage.getItem("sona.road.v1")).items, ovl: document.getElementById("giftOvl").hidden }));
    ok("…both are the child's, recorded once, no coins paid for them, and the overlay is gone", st.hat && st.frog && st.coins === 0 && st.items["6:sunhat"] === 1 && st.items["10:frog"] === 1 && st.ovl, st);
    await f.page.reload(); await f.page.waitForTimeout(500);
    ok("…and a reload hands over nothing again", await f.page.locator("#giftOvl").isHidden() && await f.page.evaluate(() => Sona.coinsNow()) === 0);
    const band = await f.page.evaluate(async () => {
      const heads = [...document.querySelectorAll("#roadList .rd-landhead")].filter((h) => /Snowy Peak|Under the Sea/.test(h.textContent)).map((h) => getComputedStyle(h).backgroundImage);
      const hero = getComputedStyle(document.getElementById("heroBand")).backgroundImage;
      const ok = await Promise.all(["/assets/crafted/customize-snow-v2.webp", "/assets/crafted/customize-sea-v2.webp"].map((u) => fetch(u).then((r) => r.ok && /image\/webp/.test(r.headers.get("content-type") || ""))));
      return { heads, hero, ok };
    });
    ok("the Snowy Peak and Under the Sea bands are their painted places now, and the hero's too (the child is in Snowy Peak)",
      band.heads.length === 2 && /customize-snow-v2\.webp/.test(band.heads[0]) && /customize-sea-v2\.webp/.test(band.heads[1]) && /customize-snow-v2\.webp/.test(band.hero) && band.ok.every(Boolean), band);
    ok("no page errors", f.errors.length === 0, f.errors);
  } finally { await f.context.close(); }

  f = await fresh({ trophies: 30, ledger: { v: 1, t: 130, d: TODAY, dn: 0, m: TODAY.slice(0, 7), mn: 120 }, extra: { "sona.road.v1": opened(1, 2) } });
  try {
    await road(f.page);
    const pips = await f.page.evaluate(() => [...document.querySelectorAll("#monthPips .rd-pip")].map((p) => p.className.replace("rd-pip ", "") + ":" + (p.querySelector(".rd-flag") ? "Open!" : "")));
    const done = await f.page.evaluate(() => [...document.querySelectorAll("#roadList .rd-stop")].slice(0, 3).map((r) => [+r.dataset.stop, r.classList.contains("done"), !!r.querySelector(".rd-tick"), r.tagName]));
    ok("an opened stop shows a ✓ and is no longer a button; the next one waits dimmed", JSON.stringify(done) === JSON.stringify([[1, true, true, "DIV"], [2, true, true, "DIV"], [3, false, false, "DIV"]]), done);
    ok("the month's path: the two steps 120 trophies reach say \"Open!\", the rest wait dimmed", JSON.stringify(pips) === JSON.stringify(["open:Open!", "open:Open!", "ahead:", "ahead:", "ahead:", "ahead:", "ahead:", "ahead:"]), pips);
    await f.page.click("#openNext"); await f.page.waitForTimeout(500);
    ok("with no stop waiting, \"Open next\" opens the month's first step: \"+5 coins!\"", (await line(f.page)) === "+5 coins!" && (await coins(f.page)) === 5, await line(f.page));
    await yay(f.page);
    ok("…it reads opened, and told the relay \"month gift opened\"", (await f.page.locator("#monthPips .rd-pip").first().getAttribute("class")) === "rd-pip done" && JSON.stringify(await beacons(f.page)) === JSON.stringify(["month gift opened"]));
  } finally { await f.context.close(); }
});

await section("the road page: game levels, fit, and what never happens", async () => {
  let f = await fresh({ trophies: 200, levels: { pick: { slice: 2 } } });
  try {
    await road(f.page);
    const rows = await f.page.evaluate(() => [...document.querySelectorAll("#levelRows .rd-lvrow")].map((r) => r.getAttribute("aria-label")));
    ok("\"Game levels\" lists only the games this family can open (the free version: Fruit Slice, Piano Tiles, Bubble Pop; never Feed Echo, a grey Premium game or a Coming soon one)", JSON.stringify(rows) === JSON.stringify(["Fruit Slice", "Piano Tiles", "Bubble Pop"]), rows);
    const slice = await f.page.evaluate(() => [...document.querySelectorAll('.rd-lvbtn[data-game="slice"]')].map((b) => [b.getAttribute("aria-pressed"), b.getAttribute("aria-disabled"), b.getAttribute("aria-label")]));
    ok("each level is a round button with its numeral: Level 2 picked (✓), Level 3 locked with what it needs", JSON.stringify(slice) === JSON.stringify([["false", null, "Level 1. The fruit stand"], ["true", null, "Level 2. Faster fruit!"], [null, "true", "Level 3. Opens at 750 trophies. You have 200."]]), slice);
    await f.page.click('.rd-lvbtn[data-game="slice"][data-level="3"]', { force: true });
    ok("a tap on a locked level only says so", (await f.page.locator("#levelsNote").innerText()) === "Level 3 opens at 750 trophies. Keep practicing!" && (await levels(f.page)).pick.slice === 2);
    await f.page.click('.rd-lvbtn[data-game="tiles"][data-level="2"]'); await f.page.waitForTimeout(100);
    ok("a tap on an open level picks it for that game, and it shows picked", (await levels(f.page)).pick.tiles === 2 && (await f.page.locator('.rd-lvbtn[data-game="tiles"][data-level="2"]').getAttribute("aria-pressed")) === "true" && new URL(f.page.url()).pathname === "/road.html");
    ok("…sending nothing (the game page says \"level played\")", (await beacons(f.page)).length === 0);
  } finally { await f.context.close(); }

  f = await fresh({ trophies: 800, levels: { cap: 1 }, premium: true });
  try {
    await road(f.page);
    ok("under a grown-up's \"Level 1 only\" there is no Game levels panel", await f.page.locator("#levelsCard").isHidden());
    const s3 = await f.page.evaluate(() => { const r = document.querySelector('#roadList .rd-stop[data-stop="3"]'); return { level: !!r.querySelector(".ga-lv"), label: r.getAttribute("aria-label") }; });
    ok("…and the road never says a level opened for that child: stop 3 shows only its coins", !s3.level && s3.label === "At 150 trophies: 20 coins. Open!", s3);
    await f.page.click('#roadList .rd-stop[data-stop="3"]'); await f.page.waitForTimeout(500);
    const l = await line(f.page); await yay(f.page);
    ok("…and opening it shows \"+20 coins!\" alone", l === "+20 coins!" && (await f.page.locator("#giftOvl").isHidden()), l);
    await home(f.page);
    const c = await cardOf(f.page);
    ok("Home's card says the same: no level, only gifts", !/Level/.test(c.label), c.label);
  } finally { await f.context.close(); }
  f = await fresh({ trophies: 120, levels: { cap: 1 }, extra: { "sona.road.v1": opened(1, 2) } });
  try { await home(f.page); const c = await cardOf(f.page); ok("…with stop 3 next, Home's card shows its coins and \"Next gift at 150 trophies.\"", c.pic === "coins" && /Next gift at 150 trophies\.$/.test(c.label), c); } finally { await f.context.close(); }
  f = await fresh({ trophies: 120 });
  try { await road(f.page); ok("before Level 2 opens there is no Game levels panel", await f.page.locator("#levelsCard").isHidden()); } finally { await f.context.close(); }

  for (const vp of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    f = await fresh({ ...vp, trophies: 520, premium: true, ledger: { v: 1, t: 520, d: TODAY, dn: 14, m: TODAY.slice(0, 7), mn: 120 }, extra: { "sona.road.v1": opened(1, 2, 3), "sona.gamereps.v1": JSON.stringify({ [TODAY]: { R: 14 } }) } });
    const third = [];
    f.page.on("request", (r) => { const u = new URL(r.url()); if (u.origin !== origin) third.push(u.href); });
    try {
      await road(f.page);
      const w = vp.width + "px: ";
      const fit = await f.page.evaluate(() => {
        const vw = document.documentElement.clientWidth, out = [];
        document.querySelectorAll("#road *").forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && (r.right > vw + 0.5 || r.left < -0.5) && !e.closest(".rd-band")) out.push(e.className || e.tagName); });
        const h = document.querySelector(".rd-head").getBoundingClientRect(), x = document.getElementById("roadBack").getBoundingClientRect(), c = document.querySelector(".rd-chips").getBoundingClientRect(), t = document.querySelector(".rd-title");
        const small = [...document.querySelectorAll("#road button, #road a")].filter((b) => { const r = b.getBoundingClientRect(); return r.width && (r.width < 44 || r.height < 36); }).map((b) => b.id || b.className);
        return { scroll: document.documentElement.scrollWidth - vw, out: out.slice(0, 5), head: h.height <= 56 && x.width >= 44 && x.height >= 44 && c.right <= vw && t.scrollWidth <= t.clientWidth + 1, small };
      });
      ok(w + "nothing on the road page runs off the side, the header fits on one line with a 44 px ✕, and every button is a full tap target", fit.scroll <= 1 && fit.out.length === 0 && fit.head && fit.small.length === 0, fit);
      await f.page.screenshot({ path: path.join(OUT, "roadtest-road-" + vp.width + ".png"), fullPage: true });
      ok(w + "no third-party request, no voice, no page error", third.length === 0 && (await speech(f.page)).length === 0 && f.errors.length === 0, { third, errors: f.errors });
    } finally { await f.context.close(); }
  }
});

// ── 9. the sticker book, linked from the road ───────────────────────────
await section("the sticker book", async () => {
  const f = await fresh({ trophies: 0, extra: { "sona.stickers.v1": JSON.stringify({ star: { at: 1 }, trophy: { at: 1 } }) } });
  try {
    await f.page.goto(origin + "/stickers.html"); await f.page.waitForSelector("#grid .st");
    const t = await f.page.evaluate(() => ({ count: document.getElementById("count").textContent, body: document.body.innerText, bar: !!document.getElementById("barFill") }));
    ok("it shows no count (\"Your stickers\", never \"2 of 24\") and no fill bar", t.count === "Your stickers" && !/\bof 24\b|collected/.test(t.body) && !t.bar, t.count);
    await f.page.click("#grid .st.next"); await f.page.waitForTimeout(100);
    const next = await f.page.locator("#toast").innerText();
    await f.page.click("#grid .st.locked:not(.next)"); await f.page.waitForTimeout(100);
    const other = await f.page.locator("#toast").innerText();
    ok("a tap on a sticker not found yet points to the road (\"This one's next!\", \"Open gifts on the Trophy Road to collect it!\")", next === "This one's next!" && other === "Open gifts on the Trophy Road to collect it!", [next, other]);
    const went = f.page.waitForURL((u) => u.pathname === "/road.html", { timeout: 2500 }).then(() => true, () => false);
    await f.page.click("#back");
    ok("its back button goes to the Trophy Road", await went);
    ok("no page errors", f.errors.length === 0, f.errors);
  } finally { await f.context.close(); }
  const e = await fresh({ trophies: 0 });
  try { await e.page.goto(origin + "/stickers.html"); await e.page.waitForSelector("#grid .st"); ok("an empty book says where stickers come from", (await e.page.locator("#empty").innerText()) === "Open gifts on the Trophy Road to fill your book!"); } finally { await e.context.close(); }
});

// ── 10. the copy a child can see on the road and Home's card ────────────
await section("the copy", async () => {
  const strip = (t) => t.replace(/<!--[\s\S]*?-->/g, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1").replace(/<[^>]+>/g, " ");
  const home = readFileSync(path.join(ROOT, "today.html"), "utf8");
  const text = strip(readFileSync(path.join(ROOT, "road.html"), "utf8")) + strip((home.match(/<a id="roadCard"[\s\S]*?<\/a>/) || [""])[0] + (home.match(/function paintRoad\(\)\{[\s\S]*?\n {4}\}/) || [""])[0]);
  const bad = text.match(/\b(score|points?|high score|rare|epic|legendary|mystery|you're back|missed|lost|behind|hurry|ends in|last chance|streak|days left)\b|\$\d/gi);
  ok("no word on the road page or Home's card is one a child must never see, and no price", text.length > 3000 && !bad, bad);
});

console.log(fails ? `\n${fails} FAILED` : "\nall road and level checks passed");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
