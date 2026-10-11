// THE BUDDY SHOP (SHOP1, OWN1; Travis, 9 Oct 2026: "a currency so they can
// buy stuff like characters, and they actually BE the character in the
// game"). customize.html is the Buddy Shop, and this suite plays it the way
// a child and a grown-up meet it:
//   - a household already on Sona (no sona.buddyset.v1 on its first load:
//     "kept") owns every buddy, hat and place it could pick on 11 Oct 2026,
//     sees no price on any of them, and sees no "Get it" bar at all;
//   - a family set up after the shop ("post") owns the three starter
//     buddies, no hat and the sky; everything else shows its coin price with
//     a ring that fills as the wallet nears it, and a road item its trophies;
//   - a tap tries an item on the preview and saves nothing; holding "Get it"
//     for a second gets it (the coins go down by exactly the catalog price,
//     "It's yours!"), a quick tap does not, a keyboard press does at once;
//     short of coins the button is disabled and says to open chests; "Oops?
//     Give it back" returns the coins; a road item can't be got with coins;
//   - a kept household's backup restored on a new ("post") phone still owns
//     everything;
//   - setup's hidden buddy step offers only the buddies a family has;
//   - no dialog, no price sign, no "buy" in a child's words, no voice, no
//     confetti under Reduce Motion, nothing off the side of a 320 px phone,
//     Done goes Home (or back to Settings from Settings).
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

let fails = 0;
function ok(label, pass, detail = "") { if (!pass) fails++; console.log((pass ? "PASS " : "FAIL ") + label + (pass ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); }
async function section(label, run) { try { await run(); } catch (e) { ok(label + " completes", false, e.stack); } }

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

const LEGACY = {
  characters: ["fox", "bunny", "dragon", "cat", "bee", "octopus", "dino", "panda"],
  outfits: ["none", "crown", "tophat", "cap", "shades", "bow", "party"],
  backdrops: ["sky", "jungle", "forest", "mountain", "space", "beach"] };
const GRID = { characters: "#chars", outfits: "#outfits", backdrops: "#backdrops" };

// main's seed rules (CLAUDE.md "Test seeds"): every era stamp, the trial-first
// stamp; the kept-buddies stamp is left unset ("kept") unless the test is
// about a new family. Coins are seeded into the practice record's wallet.
async function fresh({ width = 390, height = 844, post = false, kept = false, coins = 0, profile = {}, motion = false, sona = null } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: motion ? "no-preference" : "reduce" });
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== origin) return route.abort();
    if (sona && u.pathname === "/sona.js") return route.fulfill({ contentType: "text/javascript", body: sona });
    // where a link goes is recorded, not run
    if (/^\/(?:today|settings|road)\.html$/.test(u.pathname)) return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Away</title><p>Away</p>" });
    return route.continue();
  });
  await context.addInitScript(() => {
    const record = (text) => { if (String(text || "").trim()) { const calls = JSON.parse(sessionStorage.getItem("test.speech") || "[]"); calls.push(String(text)); sessionStorage.setItem("test.speech", JSON.stringify(calls)); } return Promise.resolve(); };
    let sona; Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set: (v) => { sona = v; v.speak = record; v.speakNow = record; } });
    if (window.speechSynthesis) window.speechSynthesis.speak = (u) => record(u && u.text);
    const sb = navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null;
    navigator.sendBeacon = function (u, b) { try { if (/\/api\/track/.test(String(u))) { const l = JSON.parse(sessionStorage.getItem("test.beacons") || "[]"); const j = JSON.parse(b); l.push({ e: j.e, p: j.p }); sessionStorage.setItem("test.beacons", JSON.stringify(l)); } } catch (e) {} return sb ? sb(u, b) : true; };
  });
  const page = await context.newPage(); page.setDefaultTimeout(5000);
  const errors = [], dialogs = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  await page.goto(origin + "/__seed");
  await page.evaluate(({ post, kept, coins, profile }) => {
    ["", "2", "3", "4", "5"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", n ? "done" : "post"));
    localStorage.setItem("sona.freever.v1", "kept");
    if (post) localStorage.setItem("sona.buddyset.v1", "post");
    // a phone that kept its buddies and is now setting up another child
    if (kept) localStorage.setItem("sona.buddyset.v1", "kept");
    localStorage.setItem("sona.profile.v1", JSON.stringify(Object.assign({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, voiceOn: false, soundOn: false, volume: 0 }, profile)));
    if (coins) localStorage.setItem("sona.progress.v1", JSON.stringify({ sessions: [], totals: { sessions: 0, words: 0, stars: 0, coins }, streak: { count: 0, lastDate: "" }, bySound: {}, stage: {}, chests: {}, missed: [], ladderV: 2 }));
  }, { post, kept, coins, profile });
  return { context, page, errors, dialogs };
}
async function shop(page, q = "") { await page.goto(origin + "/customize.html" + q); await page.waitForFunction(() => document.querySelectorAll("#chars .opt").length >= 8); await page.waitForTimeout(100); }
const tile = (page, kind, id) => page.locator(GRID[kind] + ' .opt[data-id="' + id + '"]');
const tiles = (page) => page.evaluate((GRID) => {
  const out = {};
  for (const k in GRID) out[k] = [...document.querySelectorAll(GRID[k] + " .opt")].map((b) => ({ id: b.dataset.id, tag: b.tagName, label: b.getAttribute("aria-label"), price: (b.querySelector(".tag-coins b") || {}).textContent || null, road: (b.querySelector(".tag-road b") || {}).textContent || null, worn: b.classList.contains("on"), pressed: b.getAttribute("aria-pressed") }));
  return out;
}, GRID);
const prof = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("sona.profile.v1") || "{}"));
const coinsOf = (page) => page.evaluate(() => Sona.coinsNow());
const bar = (page) => page.evaluate(() => {
  const b = document.getElementById("tryBar"), g = document.getElementById("getBtn"), r = b.getBoundingClientRect();
  const vis = (id) => { const e = document.getElementById(id); return !!e && !e.hidden && e.getBoundingClientRect().height > 0; };
  return { shown: !b.hidden && r.height > 0, cls: b.className, h: Math.round(r.height), get: vis("getBtn"), disabled: g.disabled, line: document.getElementById("tryLine").textContent, name: vis("tryName") ? document.getElementById("tryName").textContent : "",
    road: vis("roadLink"), undo: vis("undoBtn"), cost: document.getElementById("getCost").textContent, f: g.style.getPropertyValue("--f"), aria: g.getAttribute("aria-label") };
});
const wallet = (page) => page.evaluate(() => ({ n: document.getElementById("coinN").textContent, label: document.getElementById("wallet").getAttribute("aria-label") }));
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const speech = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("test.speech") || "[]"));
const beacons = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("test.beacons") || "[]"));
// what a child can read or hear read out: the page's text and every label
const words = (page) => page.evaluate(() => document.body.innerText + " " + [...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")).join(" "));
const BANNED = /\b(buy|bought|purchase|price|score|points?|high score|rare|epic|legendary|mystery|missed|lost|behind|hurry|ends in|last chance|streak)\b|\$/i;
// hold the button down with a finger-like pointer for ms
async function hold(page, ms) {
  const b = await page.locator("#getBtn").boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up();
}
async function tryOn(page, kind, id) { await tile(page, kind, id).click(); await page.waitForTimeout(700); }

// ── 1. a household already on Sona keeps everything ──
await section("1 kept", async () => {
  const f = await fresh({ coins: 85 }), { page } = f;
  await shop(page);
  ok("the first load stamps this onboarded phone \"kept\"", await page.evaluate(() => localStorage.getItem("sona.buddyset.v1")) === "kept");
  const t = await tiles(page);
  ok("all 8 buddies, 7 hats and 6 places are the child's, with no price on any", Object.keys(LEGACY).every((k) => LEGACY[k].every((id) => { const x = t[k].find((y) => y.id === id); return x && x.tag === "BUTTON" && x.price === null && x.road === null && /\. Yours\.$/.test(x.label); })), t);
  const extra = await page.evaluate(() => { const o = []; [["characters", Sona.CHARACTERS], ["outfits", Sona.OUTFITS], ["backdrops", Sona.BACKDROPS]].forEach(([k, l]) => l.forEach((it) => o.push([k, it.id, it.source, it.cost]))); return o; });
  const later = extra.filter((x) => LEGACY[x[0]].indexOf(x[1]) < 0);
  ok("anything added after 11 Oct 2026 shows its price (a shop item) or its trophies (a road item), even here",
    later.every(([k, id, src, cost]) => { const x = t[k].find((y) => y.id === id); return x && (src === "road" ? x.road && /Trophy Road/.test(x.label) : x.price === String(cost)); }), later);
  ok("the worn buddy is ticked, and its tile says it is pressed", t.characters[0].worn && t.characters[0].pressed === "true" && t.characters.filter((x) => x.worn).length === 1);
  ok("the wallet shows the coins: \"85 coins\"", JSON.stringify(await wallet(page)) === JSON.stringify({ n: "85", label: "85 coins" }), await wallet(page));
  // (once later items join the catalog, the bar is there for them instead)
  ok(later.length ? "with items added after the sweep to get, the try bar waits under the preview" : "with nothing to get, no try bar takes room under the preview",
    later.length ? (await bar(page)).shown : !(await bar(page)).shown, await bar(page));
  await tile(page, "characters", "dragon").click();
  await page.waitForTimeout(150);
  ok("a tap wears a buddy it owns and saves it, as before", (await prof(page)).character === "dragon" && await page.locator("#heroName").textContent() === "Ziggy" && await page.locator("#choiceSaved").textContent() === "Saved — looking good!");
  await tile(page, "backdrops", "space").click(); await tile(page, "outfits", "crown").click();
  const p = await prof(page);
  ok("…a hat and a place too, with no coins spent", p.outfit === "crown" && p.backdrop === "space" && await coinsOf(page) === 85);
  ok("Home's link and the shop's file name are unchanged, and the title says Buddy Shop", await page.title() === "Sona — Buddy Shop" && /Buddy Shop/.test(await page.locator("header .brand").textContent()));
  ok("no dialog, no voice, no page error", f.dialogs.length === 0 && (await speech(page)).length === 0 && f.errors.length === 0, [f.dialogs, f.errors]);
  await f.context.close();
});

// ── 2. a new family: the starters, prices, and getting one ──
await section("2 post", async () => {
  const f = await fresh({ post: true, coins: 160 }), { page } = f;
  await shop(page);
  const t = await tiles(page);
  const owned = (k, id) => /\. Yours\.$/.test(t[k].find((x) => x.id === id).label);
  ok("the three starter buddies, no hat and the sky are theirs", ["fox", "bunny", "panda"].every((id) => owned("characters", id)) && owned("outfits", "none") && owned("backdrops", "sky"));
  const PRICES = { characters: { cat: 100, bee: 100, dino: 120, dragon: 150, octopus: 150 }, outfits: { cap: 40, bow: 40, tophat: 60, shades: 60, crown: 80, party: 80 }, backdrops: { jungle: 80, forest: 80, mountain: 120, beach: 120, space: 150 } };
  ok("everything else shows its coin price", Object.keys(PRICES).every((k) => Object.keys(PRICES[k]).every((id) => t[k].find((x) => x.id === id).price === String(PRICES[k][id]))), t);
  ok("…and says it in its label: \"Ziggy. 150 coins. You have 160.\"", t.characters.find((x) => x.id === "dragon").label === "Ziggy. 150 coins. You have 160.");
  const ring = await page.evaluate(() => getComputedStyle(document.querySelector('#chars .opt[data-id="dragon"] .tag-ring')).getPropertyValue("--f").trim());
  ok("the price's ring is full when the wallet covers it", ring === "1.000", ring);
  let b = await bar(page);
  const idleH = b.h;
  ok("the try bar waits under the preview with where coins come from", b.shown && !b.get && b.line === "Open chests to earn coins!" && b.road, b);

  await tryOn(page, "characters", "dragon");
  b = await bar(page);
  ok("a tap tries the dragon on the preview and saves nothing", await page.locator("#heroName").textContent() === "Ziggy" && (await prof(page)).character !== "dragon" && await page.locator('#chars .opt[data-id="dragon"]').evaluate((e) => e.classList.contains("trying")));
  ok("\"Get it\" shows with the price, ready to hold", b.get && !b.disabled && b.cost === "150" && b.name === "Ziggy" && b.line === "Hold to get it!" && !b.road && /^Get it\. Ziggy, 150 coins\.$/.test(b.aria), b);
  ok("…and the bar kept its height, so nothing under it moved", b.h === idleH, [idleH, b.h]);
  await hold(page, 250);
  ok("a quick tap does not get it", !(await page.evaluate(() => Sona.owns("characters", "dragon"))) && await coinsOf(page) === 160);
  const box = await page.locator("#getBtn").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(500);
  const mid = await page.evaluate(() => parseFloat(document.getElementById("getBtn").style.getPropertyValue("--hold")));
  await page.waitForTimeout(800); await page.mouse.up(); await page.waitForTimeout(200);
  ok("holding it fills the ring (in steps under Reduce Motion)", mid >= 0.25 && mid < 1, mid);
  b = await bar(page);
  ok("held for a second: the dragon is theirs and worn, and the coins go down by exactly 150", await page.evaluate(() => Sona.owns("characters", "dragon")) && (await prof(page)).character === "dragon" && await coinsOf(page) === 10 && (await wallet(page)).n === "10");
  ok("\"It's yours!\" with \"Oops? Give it back\"", b.line === "It's yours!" && b.undo && !b.get && b.h === idleH, b);
  const bc = await beacons(page);
  ok("one \"shop item got\" event, sent by sona.js, with the kind, the item and its price only", bc.length === 1 && bc[0].e === "shop item got" && JSON.stringify(bc[0].p) === JSON.stringify({ kind: "characters", item: "dragon", cost: 150 }), bc);
  const t2 = await tiles(page);
  ok("its tile now says Yours, ticked; the others re-read the wallet", /^Ziggy\. Yours\.$/.test(t2.characters.find((x) => x.id === "dragon").label) && t2.characters.find((x) => x.id === "dragon").worn && t2.characters.find((x) => x.id === "cat").label === "Mochi. 100 coins. You have 10.");
  ok("no confetti under Reduce Motion", await page.evaluate(() => !document.querySelector("body > canvas")));

  await page.locator("#undoBtn").click(); await page.waitForTimeout(150);
  ok("\"Oops? Give it back\" returns the 150 coins and puts the fox back on", await coinsOf(page) === 160 && !(await page.evaluate(() => Sona.owns("characters", "dragon"))) && (await prof(page)).character === "fox" && !(await bar(page)).undo);

  await tryOn(page, "outfits", "crown");
  await page.locator("#getBtn").focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(200);
  ok("a keyboard press (a switch, a screen reader) gets it at once, without the hold", await page.evaluate(() => Sona.owns("outfits", "crown")) && (await prof(page)).outfit === "crown" && await coinsOf(page) === 80);
  ok("…and focus lands on \"Oops? Give it back\"", await page.evaluate(() => document.activeElement && document.activeElement.id) === "undoBtn");

  await tryOn(page, "backdrops", "space");
  b = await bar(page);
  ok("short of coins: \"Get it\" is disabled, its ring part-filled, with \"Open chests to earn coins!\" and the road", b.get && b.disabled && b.line === "Open chests to earn coins!" && b.road && b.f === "0.533" && b.h === idleH, b);
  await hold(page, 1300);
  await page.locator("#getBtn").focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(150);
  ok("…and neither a hold nor a key gets it", !(await page.evaluate(() => Sona.owns("backdrops", "space"))) && await coinsOf(page) === 80);
  const before = await prof(page);
  await page.locator("#done").click(); await page.waitForURL(/\/today\.html/);
  ok("Done goes Home, and what was only tried was never saved", new URL(page.url()).pathname === "/today.html" && before.backdrop === "sky");
  ok("no dialog, no voice, no page error", f.dialogs.length === 0 && (await speech(page)).length === 0 && f.errors.length === 0, [f.dialogs, f.errors]);
  await f.context.close();
});

// ── 3. a road item, confetti with motion, the hash, and Settings ──
await section("3 road", async () => {
  // a build whose catalog lists a road-only hat on stop 6 (the art step adds the real ones)
  const src = readFileSync(path.join(ROOT, "sona.js"), "utf8")
    .replace("{ n: 6, at: 380, gift: [{ coins: 50 }] }", '{ n: 6, at: 380, gift: [{ hat: "sunhat" }] }')
    .replace('{ id: "party",  name: "Party",  emoji: "🥳", source: "shop", cost: 80 },', '$&\n    { id: "sunhat", name: "Sun hat", emoji: "👒", source: "road", cost: null },');
  ok("(this test's catalog lists a Sun hat on the Trophy Road at 380)", /id: "sunhat"/.test(src) && /hat: "sunhat"/.test(src));
  const f = await fresh({ post: true, coins: 999, sona: src, motion: true }), { page } = f;
  await shop(page, "#hats");
  const scrolled = await page.evaluate(() => { const r = document.getElementById("hats").getBoundingClientRect(); return Math.abs(r.top) < 40 && window.pageYOffset > 100; });
  ok("#hats opens at the hats", scrolled);
  const t = await tiles(page);
  const sh = t.outfits.find((x) => x.id === "sunhat");
  ok("a road item is a dimmed tile with a lock, a trophy and its trophies", sh && sh.road === "380" && sh.price === null && sh.label === "Sun hat. On the Trophy Road at 380 trophies." && await tile(page, "outfits", "sunhat").evaluate((e) => e.classList.contains("road") && !e.disabled), sh);
  await tryOn(page, "outfits", "sunhat");
  const b = await bar(page);
  ok("tapped, it is tried on and says where it comes from, with no way to get it with coins", !b.get && b.road && b.line === "Find it on the Trophy Road!" && b.name === "Sun hat", b);
  ok("…the coins are untouched and it isn't theirs", await coinsOf(page) === 999 && !(await page.evaluate(() => Sona.owns("outfits", "sunhat"))) && JSON.stringify(await page.evaluate(() => Sona.buyItem("outfits", "sunhat"))) === JSON.stringify({ ok: false, reason: "road" }));
  ok("\"See the road\" goes to the Trophy Road", await page.locator("#roadLink").getAttribute("href") === "/road.html");
  await tryOn(page, "outfits", "party");
  await page.locator("#getBtn").focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(150);
  ok("with motion allowed, getting one throws confetti", await page.evaluate(() => !!document.querySelector("body > canvas")) && await page.evaluate(() => Sona.owns("outfits", "party")));
  ok("no page error", f.errors.length === 0, f.errors);
  await f.context.close();

  const g = await fresh({ post: true, coins: 40 });
  await shop(g.page, "?from=settings");
  await g.page.locator("#done").click(); await g.page.waitForURL(/\/settings\.html/);
  ok("opened from Settings, Done goes back to Settings", new URL(g.page.url()).pathname === "/settings.html");
  await g.page.goto(origin + "/customize.html?from=settings");
  ok("…and so does ✕", await g.page.locator("header .iconbtn").getAttribute("href") === "/settings.html" && await g.page.locator("header .iconbtn").getAttribute("aria-label") === "Back to Settings");
  await g.context.close();
});

// ── 4. a kept household's backup on a new phone ──
await section("4 backup", async () => {
  const a = await fresh({ coins: 10 });
  await shop(a.page);
  const backup = await a.page.evaluate(() => Sona.exportString());
  await a.context.close();
  const b = await fresh({ post: true });
  // a brand-new phone: sona.js's first load with nobody set up stamps it "post"
  await b.page.evaluate(() => localStorage.clear());
  await b.page.goto(origin + "/__sona");
  ok("(the new phone is \"post\")", await b.page.evaluate(() => localStorage.getItem("sona.buddyset.v1")) === "post");
  const r = await b.page.evaluate((s) => Sona.importData(s), backup);
  await shop(b.page);
  const t = await tiles(b.page);
  ok("restored there, every buddy, hat and place the household kept is still theirs", r.ok && Object.keys(LEGACY).every((k) => LEGACY[k].every((id) => /\. Yours\.$/.test(t[k].find((x) => x.id === id).label))), t);
  ok("…while the phone stays \"post\" (the stamp never travels)", await b.page.evaluate(() => localStorage.getItem("sona.buddyset.v1")) === "post");
  ok("no page error", b.errors.length === 0, b.errors);
  await b.context.close();
  // a backup made before the Buddy Shop: no stamp, no list (every family
  // could pick everything then), restored on a new phone
  const c = await fresh({ post: true });
  await c.page.evaluate(() => localStorage.clear());
  await c.page.goto(origin + "/__sona");
  const rc = await c.page.evaluate(() => Sona.importData({ app: "sona", v: 1, data: { "sona.profile.v1": JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, character: "cat", owned: { outfits: ["none"], backdrops: ["sky"] } }) } }));
  await shop(c.page);
  const tc = await tiles(c.page);
  ok("a backup made before the Buddy Shop, restored on a new phone, keeps every buddy, hat and place too", rc.ok && Object.keys(LEGACY).every((k) => LEGACY[k].every((id) => /\. Yours\.$/.test(tc[k].find((x) => x.id === id).label))) && await c.page.evaluate(() => localStorage.getItem("sona.buddyset.v1")) === "post", tc);
  ok("no page error", c.errors.length === 0, c.errors);
  await c.context.close();
});

// ── 5. setup's hidden buddy step offers only what a family has ──
await section("5 setup", async () => {
  for (const post of [true, false]) {
    const f = await fresh({ post, kept: !post, profile: { onboarded: false, childName: "" } });
    await f.page.goto(origin + "/onboarding.html");
    await f.page.waitForFunction(() => document.querySelectorAll("#obBuddies .bopt").length > 0);
    const names = await f.page.evaluate(() => [...document.querySelectorAll("#obBuddies .bopt .bn")].map((n) => n.textContent));
    ok(post ? "on a new phone: Pip, Miso and Bao, and Surprise me" : "on a kept phone: all eight, and Surprise me",
      JSON.stringify(names) === JSON.stringify(post ? ["Pip", "Miso", "Bao", "Surprise me"] : ["Pip", "Miso", "Ziggy", "Mochi", "Buzz", "Otto", "Rocky", "Bao", "Surprise me"]) && await f.page.evaluate(() => !!document.querySelector("#obBuddies .bopt.on")), names);
    await f.context.close();
  }
});

// ── 6. a small phone, the words, and Settings' lines ──
await section("6 fit and words", async () => {
  for (const [post, coins] of [[false, 12345], [true, 12345], [true, 30]]) {
    const f = await fresh({ width: 320, height: 568, post, coins }), { page } = f;
    await shop(page);
    const tag = (post ? "new family" : "kept") + ", " + coins + " coins";
    ok("320 px, " + tag + ": nothing off the side, the header on one row", await overflow(page) === 0 && await page.evaluate(() => { const h = document.querySelector("header.app").getBoundingClientRect(); return h.height < 70 && document.getElementById("wallet").getBoundingClientRect().right <= document.querySelector("header .iconbtn").getBoundingClientRect().left; }));
    if (post) {
      await tryOn(page, "characters", "octopus");
      const vis = await page.evaluate(() => { const r = document.getElementById("getBtn").getBoundingClientRect(), foot = document.querySelector(".customize-footer").getBoundingClientRect(); return r.width >= 90 && r.top >= 0 && r.bottom <= foot.top; });
      ok("320 px, " + tag + ": a tile far down the page brings the preview and \"Get it\" into view, clear of the footer", vis && await overflow(page) === 0);
    }
    const text = await words(page);
    ok("320 px, " + tag + ": no price sign, no \"buy\", no word a child must never see", !BANNED.test(text), (text.match(BANNED) || [])[0]);
    ok("320 px, " + tag + ": every tile is a button with a label", await page.evaluate(() => [...document.querySelectorAll(".opt")].every((b) => b.tagName === "BUTTON" && b.type === "button" && b.getAttribute("aria-label"))));
    await f.context.close();
  }
  const set = readFileSync(path.join(ROOT, "settings.html"), "utf8");
  ok("Settings' Buddy & world row: \"Choose a buddy, a hat and a place. Coins open new ones.\"", set.includes("Choose a buddy, a hat and a place. Coins open new ones."));
  ok("…with where trophies and coins come from, under it", set.includes("Trophies come from reps: a day at the daily goal is 30 trophies. Coins come from the daily chest and the Trophy Road. Nothing here is ever sold.") && set.indexOf("Coins open new ones.") < set.indexOf("Nothing here is ever sold.") && set.indexOf("Nothing here is ever sold.") < set.indexOf('id="playLevelCap"'));
  ok("Reset says what it resets and what stays", set.includes('" practice steps and coins on this device? Trophies, buddies and stickers stay. This cannot be undone."') && !/progress on this device\? This cannot be undone/.test(set));
});

await browser.close(); server.close();
console.log(fails ? fails + " FAILED" : "ALL GREEN");
process.exit(fails ? 1 : 0);
