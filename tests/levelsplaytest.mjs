// LEVELS1 in the littles' games and the Say & Play games (Travis, 9 Oct
// 2026: "levels inside games"). Bubble Pop, Hoops, Soccer Goal and Dino Dig
// take the child's level from their page (the engines never read storage),
// and this suite holds each to what a level may change, the finger's part,
// and what it may never change:
//   - Bubble Pop: Level 2 blows eight bubbles for every word; Level 3 too,
//     then a bonus puff of three after each word's picture lands, and the
//     word's step waits for those. Never more than eight on the sky, none
//     overlapping, every bob inside the sky; the word is still said once;
//   - Hoops: the hoop holds still for the first baskets at Level 1 only;
//   - Soccer Goal: Bo reaches a little further at Level 3, but after a miss
//     he reaches exactly as he does at Level 1;
//   - Dino Dig: a smaller brush and more of the bone to uncover at Level 2
//     and 3, and six seconds after the brush comes out both are Level 1's,
//     wherever the finger rubs;
//   - each start card names the level ("Hoops · Level 2"), and "level
//     played" is posted once at Level 2 or 3, never at Level 1;
//   - Feed Echo and every parked game keep one level.
// The engines are played here through their page with a stand-in for the
// word turn (sayplaytest and playgamestest play the real one at Level 1): the
// stand-in calls the engine's own init and onWord, exactly as sayplay.js does
// once a word is heard.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

let fails = 0;
function ok(label, pass, detail = "") { if (!pass) fails++; console.log((pass ? "PASS " : "FAIL ") + label + (pass ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); }
async function section(label, run) { try { await run(); } catch (e) { ok(label + " completes", false, e.stack); } }

const posts = [];
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2", json: "application/json", mp3: "audio/mpeg", wav: "audio/wav" };
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__sona") { res.writeHead(200, { "content-type": "text/html" }); res.end('<!doctype html><title>Store</title><script src="/sona.js"></script>'); return; }
  if (url.pathname.startsWith("/api/")) {
    let body = ""; req.on("data", (c) => { body += c; });
    req.on("end", () => { posts.push({ path: url.pathname, body }); res.writeHead(503, { "content-type": "application/json" }); res.end("{}"); });
    return;
  }
  const file = path.join(ROOT, url.pathname);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch(launchOpts());
const TODAY = (() => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })();
const AT = { 1: 0, 2: 200, 3: 800 };
// the word turn's stand-in: the page hands its game to SayPlay.start, and the
// test drives the engine the way sayplay.js does once a word is heard
const STANDIN = "window.SayPlay={start:function(g){window.__G=g;}};";

function seed(cfg) {
  navigator.mediaDevices && (navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("no mic here", "NotAllowedError")));
  if (sessionStorage.getItem("test.seeded")) return;
  sessionStorage.setItem("test.seeded", "1");
  ["", "2", "3", "4", "5"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", n ? "done" : "post"));
  localStorage.setItem("sona.freever.v1", "kept");
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: cfg.age || "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true, voiceOn: false, soundOn: false, volume: 0 }));
  localStorage.setItem("sona.trophy.v1", JSON.stringify({ v: 1, t: cfg.trophies, d: cfg.today, dn: 0, m: cfg.today.slice(0, 7), mn: 0 }));
  if (cfg.levels) localStorage.setItem("sona.playlevel.v1", JSON.stringify(cfg.levels));
}
async function open(file, key, { level = 1, standin = true, age, trophies, levels } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route("**/*", (r) => {
    const u = r.request().url();
    if (!u.startsWith(origin + "/")) return r.abort();
    if (standin && new URL(u).pathname === "/sayplay.js") return r.fulfill({ contentType: "text/javascript", body: STANDIN });
    return r.continue();
  });
  await context.addInitScript(seed, { trophies: trophies == null ? AT[level] : trophies, levels: levels || (level > 1 ? { pick: { [key]: level } } : null), age, today: TODAY });
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/" + file);
  if (standin) {
    await page.waitForFunction(() => window.__G && window.__G.play);
    await page.evaluate(() => { window.__done = 0; window.__hints = []; __G.play.init({ sfx() {}, done() { window.__done++; }, hint(t) { __hints.push(t); }, cheer() {}, face() {} }, __G.steps.length); });
  }
  return { context, page, errors };
}
const snap = (page, eng) => page.evaluate((eng) => window[eng].snapshot(), eng);
const until = (page, fn, ms, arg) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const tracked = (game) => posts.filter((p) => p.path === "/api/track").map((p) => { try { return JSON.parse(p.body); } catch (e) { return {}; } }).filter((b) => b.e === "level played" && b.p && b.p.game === game);
async function told(game, level) {
  const stop = Date.now() + 3000;
  while (level > 1 && !tracked(game).length && Date.now() < stop) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, 250));
  const t = tracked(game);
  return level > 1 ? t.length === 1 && t[0].p.level === level && JSON.stringify(Object.keys(t[0].p).sort()) === '["game","level"]' : t.length === 0;
}

// ── 1. the start card names the level, and the page says it once ──
const PAGES = [["arcade-bubbles.html", "bubbles", "Bubble Pop", "Bubbles", "4"], ["arcade-hoops.html", "hoops", "Hoops", "Hoops", "7"], ["arcade-soccer.html", "soccer", "Soccer Goal", "Soccer", "7"], ["arcade-dino.html", "dino", "Dino Dig", "Dino", "7"]];
for (const [file, key, title, eng, age] of PAGES) for (const level of [1, 2, 3]) await section(title + " page at Level " + level, async () => {
  posts.length = 0;
  const { context, page, errors } = await open(file, key, { level, standin: false, age });
  try {
    await page.locator("#startOvl.show").waitFor();
    const s = await page.evaluate((eng) => ({ title: document.getElementById("startTitle").textContent, level: window[eng] && window[eng].snapshot ? (window[eng].snapshot() || {}).level : null, LV: window.LV }), eng);
    const L = title + " L" + level + ": ";
    ok(L + "the start card " + (level > 1 ? "names the level: \"" + title + " \u00b7 Level " + level + "\"" : "is the game's name, as before"), s.title === (level > 1 ? title + " \u00b7 Level " + level : title), s);
    // (Bubble Pop's page keeps its LV inside its own function)
    ok(L + "the engine was handed Level " + level + " by its page", (s.LV === level || (key === "bubbles" && s.LV === undefined)) && s.level === level, s);
    ok(L + "\"level played\" is posted " + (level > 1 ? "once, with the game and the level" : "never at Level 1"), await told(key, level), tracked(key));
    ok(L + "no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── 2. Bubble Pop ──
const space = async (page, n, gap = 90) => { for (let i = 0; i < n; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(gap); } };
function layout(s) {
  const z = s.zone, b = s.bubbles.map((q) => q.home);
  let overlap = false;
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) if (Math.hypot(b[i][0] - b[j][0], b[i][1] - b[j][1]) < b[i][4] + b[j][4]) overlap = true;
  const outside = b.filter((q) => q[0] - q[2] - q[4] < z[0] || q[0] + q[2] + q[4] > z[2] || q[1] - q[3] - q[4] < z[1] || q[1] + q[3] + q[4] > z[3]);
  return { n: b.length, overlap, outside: outside.length };
}
for (const level of [1, 2, 3]) await section("Bubble Pop at Level " + level, async () => {
  const { context, page, errors } = await open("arcade-bubbles.html", "bubbles", { level, age: "4" });
  try {
    const L = "Bubble Pop L" + level + ": ";
    const g = await page.evaluate(() => ({ times: __G.sayTimes, steps: __G.steps.length, level: Bubbles.snapshot().level }));
    ok(L + "the word is still said once, five words a round, and the engine plays Level " + level, g.times === 1 && g.steps === 5 && g.level === level, g);
    const counts = [], layouts = [];
    let most = 0, bonusSeen = false, waitedForBonus = true;
    for (let w = 0; w < 4; w++) {
      await page.evaluate(() => Bubbles.onWord());
      let s = await snap(page, "Bubbles");
      counts.push(s.left); layouts.push(layout(s)); most = Math.max(most, s.left);
      await page.waitForTimeout(1300);
      await space(page, s.left);
      // the gold one was last: its picture flies to the basket
      await until(page, () => { const b = Bubbles.snapshot(); return b.left > 0 ? b.bonus : b.state !== "ready"; }, 3000);
      s = await snap(page, "Bubbles");
      if (level === 3) {
        bonusSeen = bonusSeen || (s.bonus && s.left === 3);
        layouts.push(layout(s)); most = Math.max(most, s.left);
        const doneBefore = await page.evaluate(() => __done);
        if (doneBefore !== w) waitedForBonus = false;
        await page.waitForTimeout(1300);
        await space(page, s.left);
      }
      ok(L + "word " + (w + 1) + ": the step counts once every bubble is popped and the picture is in the basket", await until(page, (n) => window.__done === n, 3000, w + 1), await page.evaluate(() => [__done, Bubbles.snapshot()]));
    }
    ok(L + "the first word blows " + [6, 8, 8][level - 1] + " bubbles" + (level === 1 ? " (6, 7, 7, 8 as before)" : ", and so does every word"), counts[0] === [6, 8, 8][level - 1] && JSON.stringify(counts) === JSON.stringify(level === 1 ? [6, 7, 7, 8] : [8, 8, 8, 8]), counts);
    if (level === 3) ok(L + "after each picture lands Echo blows a bonus puff of three, and the step waits for them", bonusSeen && waitedForBonus);
    else ok(L + "no bonus puff", !bonusSeen);
    ok(L + "never more than eight bubbles on the sky", most <= 8, most);
    ok(L + "no two bubbles overlap, and every bob stays inside the sky", layouts.every((l) => !l.overlap && l.outside === 0), layouts);
    // the last word: no bonus puff, the giant bubble
    await page.evaluate(() => Bubbles.onWord());
    let s = await snap(page, "Bubbles");
    await page.waitForTimeout(1300); await space(page, s.left);
    ok(L + "the last word ends in the giant bubble, with no bonus puff before it", await until(page, () => Bubbles.snapshot().state === "giant", 3000) && !(await snap(page, "Bubbles")).bonus);
    ok(L + "no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── 2b. Bubble Pop at Level 3: a late help already on stays on through the bonus puff ──
// At Level 1, once the touch-anywhere help comes on (about fifteen seconds
// without every bubble popped) it stays on for that word. The bonus puff is
// still that word's, so a child who waited for the help is not made to wait
// for it again; a child who never needed it gets the bonus puff's help on a
// word's clock (the loop above checks the step waits for the puff).
await section("Bubble Pop at Level 3, with the late help on", async () => {
  const { context, page, errors } = await open("arcade-bubbles.html", "bubbles", { level: 3, age: "4" });
  try {
    const L = "Bubble Pop L3: ";
    await page.evaluate(() => Bubbles.onWord());
    // every plain bubble popped at once, then the gold one left alone until
    // the late help comes on, and popped with it on (the gold one is last)
    const s = await snap(page, "Bubbles");
    await page.waitForTimeout(1300); await space(page, s.left - 1, 60);
    ok(L + "the touch-anywhere help comes on for the bubble left alone", await until(page, () => { const b = Bubbles.snapshot(); return b.left === 1 && b.bubbles[0].gold && b.any; }, 20000), await snap(page, "Bubbles"));
    await space(page, 1, 60);
    ok(L + "the bonus puff blows once the picture lands", await until(page, () => { const b = Bubbles.snapshot(); return b.bonus && b.left === 3; }, 3000), await snap(page, "Bubbles"));
    ok(L + "…and the help is still on for it, after the same short beat between pops", await until(page, () => { const b = Bubbles.snapshot(); return b.bonus && b.left === 3 && b.any && b.help; }, 1700), await snap(page, "Bubbles"));
    // a touch far from every bubble pops the nearest, as the late help does
    // (a point of the sky the canvas itself takes the touch on, as far from every bubble as there is)
    const box = await page.locator("#sky").boundingBox(), b = await snap(page, "Bubbles");
    const spots = await page.evaluate((box) => { const out = []; for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) { const x = box.width * i / 10, y = box.height * j / 10, e = document.elementFromPoint(box.x + x, box.y + y); if (e && e.id === "sky") out.push([x, y]); } return out; }, box);
    const far = spots.map((c) => [c, Math.min(...b.bubbles.map((q) => Math.hypot(q.x - c[0], q.y - c[1]) - q.r))]).sort((x, y) => y[1] - x[1])[0] || [[0, 0], 0];
    await page.mouse.click(box.x + far[0][0], box.y + far[0][1]);
    ok(L + "a touch far from every bonus bubble pops one", far[1] > 40 && await until(page, () => Bubbles.snapshot().left === 2, 1500), { far, left: (await snap(page, "Bubbles")).left });
    ok(L + "no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── 3. Hoops ──
for (const level of [1, 2, 3]) await section("Hoops at Level " + level, async () => {
  const { context, page, errors } = await open("arcade-hoops.html", "hoops", { level });
  try {
    const s = await snap(page, "Hoops");
    ok("Hoops L" + level + ": the hoop's slide at the first basket is " + [0, 0.6, 0.9][level - 1] + (level === 1 ? " (it holds still, as before)" : ""), s.level === level && s.amp === [0, 0.6, 0.9][level - 1], s);
    ok("Hoops L" + level + ": eight words a round, said two times each (the engine's own number)", await page.evaluate(() => __G.steps.length === 8 && __G.sayTimes === undefined));
    ok("Hoops L" + level + ": no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── 4. Soccer Goal: after a miss Bo reaches as he does at Level 1 ──
async function swipe(page, box, sideFrac, upPx, ms = 60) {
  const x0 = box.x + box.width / 2, y0 = box.y + box.height * 0.86;
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(x0 + sideFrac * box.width * i / 6, y0 - upPx * i / 6); await page.waitForTimeout(ms / 6); }
  await page.mouse.up();
}
const reaches = {};
for (const level of [1, 2, 3]) await section("Soccer Goal at Level " + level, async () => {
  const { context, page, errors } = await open("arcade-soccer.html", "soccer", { level });
  try {
    const L = "Soccer Goal L" + level + ": ";
    const r = [];
    await page.evaluate(() => Soccer.onWord());
    ok(L + "the ball rolls to the spot", await until(page, () => Soccer.snapshot().state === "ready", 5000));
    let s = await snap(page, "Soccer"); r.push(s.reach);
    ok(L + "Bo " + (level === 3 ? "slides from the first ball" : "stands to one side for the first ball"), level === 3 ? true : Math.abs(s.keeperX) > 0.8, s);
    const box = await page.locator("#pitch").boundingBox();
    for (let m = 1; m <= 2; m++) {
      // a kick far wide of the post: a miss
      await swipe(page, box, (12 / s.aimScale) * 240 / box.width, 240);
      await until(page, (m) => Soccer.snapshot().misses === m && Soccer.snapshot().state === "ready", 6000, m);
      s = await snap(page, "Soccer"); r.push(s.misses === m ? s.reach : null);
    }
    reaches[level] = r;
    ok(L + "Bo's reach is " + (level === 3 ? "0.85 while nobody has missed" : "0.78 while nobody has missed") + ", then 0.6 and 0.45 after a miss and two", JSON.stringify(r) === JSON.stringify([level === 3 ? 0.85 : 0.78, 0.6, 0.45]), r);
    ok(L + "no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});
ok("Soccer Goal: after one miss and after two, Bo reaches exactly as he does at Level 1, at every level",
  [1, 2, 3].every((l) => reaches[l] && reaches[l][1] === reaches[1][1] && reaches[l][2] === reaches[1][2]) && reaches[1][1] === 0.6 && reaches[1][2] === 0.45, reaches);

// ── 5. Dino Dig: six seconds after the brush comes out, Level 1's numbers ──
async function rubFor(page, box, x, y, ms) {
  await page.mouse.move(box.x + x, box.y + y); await page.mouse.down();
  const stop = Date.now() + ms; let i = 0;
  while (Date.now() < stop) { await page.mouse.move(box.x + x + (i % 2 ? 6 : -6), box.y + y + (i % 3 ? 3 : -3)); i++; await page.waitForTimeout(40); }
  await page.mouse.up();
}
for (const level of [1, 2, 3]) for (const where of level === 1 ? ["far"] : ["far", "on"]) await section("Dino Dig at Level " + level + ", rubbing " + where, async () => {
  const { context, page, errors } = await open("arcade-dino.html", "dino", { level });
  try {
    const L = "Dino Dig L" + level + " (" + (where === "on" ? "rubbing on the bone" : "rubbing far from it") + "): ";
    await page.evaluate(() => Dino.onWord());
    let s = await snap(page, "Dino");
    ok(L + "with the brush just out, a bone shows at " + [0.6, 0.68, 0.76][level - 1] + " uncovered, and the brush is " + [1, 0.85, 0.72][level - 1] + " of Level 1's", s.level === level && s.state === "ready" && s.need === [0.6, 0.68, 0.76][level - 1] && s.brushK === [1, 0.85, 0.72][level - 1], s);
    const box = await page.locator("#dig").boundingBox();
    const b = s.bone, p = s.pit;
    // far: the end of the pit away from the bone; on: the bone's own corner
    const x = where === "on" ? b.x - b.w * 0.3 : (b.x > p.x + p.w / 2 ? p.x + p.w * 0.06 : p.x + p.w * 0.94), y = where === "on" ? b.y - b.h * 0.25 : p.y + p.h * 0.5;
    await rubFor(page, box, x, y, 3000);
    s = await snap(page, "Dino");
    if (level > 1 && s.state === "ready") ok(L + "three seconds in, the level's numbers still hold", s.need === [0.6, 0.68, 0.76][level - 1] && s.brushK === [1, 0.85, 0.72][level - 1], s);
    await rubFor(page, box, x, y, 3400);
    s = await snap(page, "Dino");
    ok(L + "six seconds after the brush came out, a bone shows at 0.6 and the brush is Level 1's", s.need === 0.6 && s.brushK === 1 && s.rubs > 20, { need: s.need, brushK: s.brushK, rubs: s.rubs, state: s.state });
    ok(L + "no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── 6. Feed Echo and the parked games keep one level ──
await section("one level", async () => {
  const context = await browser.newContext();
  await context.addInitScript(seed, { trophies: 800, levels: { pick: { feed: 3, peekaboo: 3, balloon: 2, slice: 3 } }, today: TODAY });
  const page = await context.newPage();
  await page.goto(origin + "/__sona"); await page.waitForFunction(() => window.Sona && Sona.playLevel);
  const r = await page.evaluate(() => ({ feed: Sona.playLevel("feed"), peek: Sona.playLevel("peekaboo"), balloon: Sona.playLevel("balloon"), slice: Sona.playLevel("slice"), setFeed: Sona.setPlayLevel("feed", 2), lines: Object.keys(Sona.PLAY_LEVEL_LINES) }));
  ok("Feed Echo plays Level 1 at 800 trophies, whatever was saved, and refuses a pick", r.feed === 1 && r.setFeed === false && r.lines.indexOf("feed") < 0 && r.slice === 3, r);
  ok("a parked game plays Level 1", r.peek === 1 && r.balloon === 1, r);
  await context.close();
  const feed = readFileSync(path.join(ROOT, "arcade-feed.html"), "utf8");
  ok("Feed Echo's page reads no level: its four pictures and the glow on the heard word are as they were", !/playLevel|setLevel|level played/.test(feed));
});

// ── 7. the engines take the level from the page, never from storage ──
{
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  for (const [f, eng] of [["bubbles.js", "Bubbles"], ["hoops.js", "Hoops"], ["soccer.js", "Soccer"], ["dino.js", "Dino"]]) {
    const src = strip(readFileSync(path.join(ROOT, f), "utf8"));
    ok(f + ": setLevel takes 2 or 3 and anything else is Level 1; its snapshot says the level; no storage", /setLevel: function \(n\) \{ level = \(n === 2 \|\| n === 3\) \? n : 1; \}/.test(src) && /level: level/.test(src) && !/localStorage|sessionStorage|playLevel|Sona\./.test(src));
  }
  const sayplay = readFileSync(path.join(ROOT, "sayplay.js"), "utf8");
  ok("sayplay.js knows nothing of levels", !/level played|playLevel|setLevel/.test(sayplay));
  for (const [file, key, title, eng] of PAGES) {
    const src = readFileSync(path.join(ROOT, file), "utf8");
    ok(file + ": the page hands the level to its engine before SayPlay.start, checking both exist first, and says \"level played\" through Sona.track",
      new RegExp("if \\(window\\." + eng + " && " + eng + "\\.setLevel\\) " + eng + "\\.setLevel\\(LV\\);[\\s\\S]*SayPlay\\.start\\(").test(src) && (src.match(/Sona\.track\("level played"/g) || []).length === 1 && new RegExp('Sona\\.playLevel\\("' + key + '"\\)').test(src));
  }
}

console.log(fails ? `\n${fails} FAILED` : "\nall little-kid and Say & Play level checks passed");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
