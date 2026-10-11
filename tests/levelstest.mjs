// LEVELS1 in the five round games (Travis, 9 Oct 2026: "levels inside
// games"; Level 1 is today's game, and harder levels unlock with what a child
// earns). Fruit Slice, Piano Tiles, Block Stacker, Sound Sprint and Flappy
// Glide are opened at Level 1, 2 and 3 on a fake phone, and this suite holds
// them to the rules a level may never break:
//   - Level 1 is today's game: every table deep-equals main's literals;
//   - a level changes only the finger's part (more, faster, smaller, new
//     songs), never the say-it cards (REV), the hearts or Block Stacker's
//     60% floor on a block's width;
//   - EVERY HELP PATH READS LEVEL 1'S NUMBERS: once a help step starts the
//     game is no harder than Level 1 would be there. The two-miss fruit, the
//     slower hedges after a bump, the slower road after a tumble, the slower
//     block after a miss and the song after a lost heart are the same at all
//     three levels;
//   - every note a level plays is one the keys have (C to B);
//   - a pick above what is open plays the highest open level;
//   - Level 2 and 3 keep their own best: a Level 3 row never shows up in a
//     Level 1 best line, Level 1 can still say "New best!", and Level 1's
//     record is untouched by a Level 2 round;
//   - "level played" is posted once per load at Level 2 or 3, never at 1.
// Nothing here is practice data, and none of it reads the speech ladder.
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

// a fake phone: a mic that hears silence, audio that does nothing, Echo's
// mid-round ask held (arcadespeechhelptest's), and main's seed rules
function fakePhone(cfg) {
  document.addEventListener("DOMContentLoaded", () => { if (window.SLOW_ASK) { SLOW_ASK.first = SLOW_ASK.every = SLOW_ASK.quiet = SLOW_ASK.soon = 1e12; window.slowAskAt = 1e12; } });
  navigator.mediaDevices.getUserMedia = () => { const t = { readyState: "live", stop() { this.readyState = "ended"; } }; return Promise.resolve({ getTracks: () => [t], getAudioTracks: () => [t] }); };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ gain: param(), frequency: param(), Q: param(), playbackRate: param(), type: "", buffer: null, connect() {}, disconnect() {}, start() {}, stop() {} });
  function AC() { this.state = "running"; this.sampleRate = 48000; this.currentTime = 0; this.destination = {}; }
  AC.prototype = { resume() { return Promise.resolve(); }, suspend() { return Promise.resolve(); }, close() { return Promise.resolve(); }, createGain: node, createOscillator: node, createBufferSource: node, createBiquadFilter: node, createDynamicsCompressor: node,
    createBuffer(c, n, sr) { return { length: n, sampleRate: sr, duration: n / sr, getChannelData: () => new Float32Array(n) }; }, decodeAudioData() { return Promise.reject(new Error("no audio")); },
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; },
    createAnalyser() { return { fftSize: 2048, frequencyBinCount: 1024, smoothingTimeConstant: 0, connect() {}, disconnect() {}, getByteTimeDomainData(a) { a.fill(128); }, getFloatTimeDomainData(a) { a.fill(0); }, getByteFrequencyData(a) { a.fill(0); }, getFloatFrequencyData(a) { a.fill(-120); } }; } };
  window.AudioContext = window.webkitAudioContext = AC;
  window.Audio = function (src) { const a = { src, volume: 1, paused: false, play() { setTimeout(() => { if (a.onended) a.onended(); }, 20); return Promise.resolve(); }, pause() { a.paused = true; }, removeAttribute() {}, load() {}, addEventListener() {} }; return a; };
  if (sessionStorage.getItem("test.seeded")) return;
  sessionStorage.setItem("test.seeded", "1");
  ["", "2", "3", "4", "5"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", n ? "done" : "post"));
  localStorage.setItem("sona.freever.v1", "kept");
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true, voiceOn: false, soundOn: false, volume: 0 }));
  localStorage.setItem("sona.trophy.v1", JSON.stringify({ v: 1, t: cfg.trophies, d: cfg.today, dn: 0, m: cfg.today.slice(0, 7), mn: 0 }));
  if (cfg.levels) localStorage.setItem("sona.playlevel.v1", JSON.stringify(cfg.levels));
  if (cfg.bests) localStorage.setItem("sona.bests.v1", JSON.stringify(cfg.bests));
  localStorage.setItem("sona.sprintintro.v1", "3");   // Sound Sprint's how-to card is runtest's
  sessionStorage.setItem("sona.play.token", "arcade-" + cfg.game + ".html");
}
async function open(game, { level = 1, trophies, pick, levels, bests } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (r) => (r.request().url().startsWith(origin + "/") ? r.continue() : r.abort()));
  const lv = levels || (pick || level > 1 ? { pick: { [game]: pick || level } } : null);
  await context.addInitScript(fakePhone, { game, trophies: trophies == null ? AT[level] : trophies, levels: lv, bests: bests || null, today: TODAY });
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/arcade-" + game + ".html?from=charge");
  await page.waitForFunction(() => window.gameEntryAllowed === true && typeof LV === "number" && typeof bestLine === "function");
  await page.waitForTimeout(150);
  return { context, page, errors };
}
const tracked = (game) => posts.filter((p) => p.path === "/api/track").map((p) => { try { return JSON.parse(p.body); } catch (e) { return {}; } }).filter((b) => b.e === "level played" && b.p && b.p.game === game);
// a beacon is sent as the page loads and arrives when it arrives: wait for it
// (or, at Level 1, give one the time to come), then count
async function told(game, level) {
  const until = Date.now() + 3000;
  while (level > 1 && !tracked(game).length && Date.now() < until) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, 250));
  const t = tracked(game);
  return level > 1 ? t.length === 1 && t[0].p.level === level && JSON.stringify(Object.keys(t[0].p).sort()) === '["game","level"]' : t.length === 0;
}

// ── main's Level 1 tables, as literals: Level 1 must be today's game ──
const L1 = {
  slice: { WAVES: [{ goal: 6, every: 1900, most: 1, gold: 0 }, { goal: 8, every: 1700, most: 2, gold: 0.12 }, { goal: 10, every: 1500, most: 3, gold: 0.16 }], GIANT_CUTS: 5 },
  tiles: { SONGS: [{ name: "Twinkle Twinkle", notes: "CCGGAAG FFEEDDC", beat: 760, fall: 2.5 }, { name: "Mary Had a Little Lamb", notes: "EDCDEEE DDD EGG", beat: 700, fall: 2.3 }, { name: "Row, Row, Row Your Boat", notes: "CCCDE EDEFG", beat: 660, fall: 2.1 }, { name: "Ode to Joy", notes: "EEFGGFED CCDEEDD", beat: 620, fall: 2.2, finale: true }], ROW_TOP: 52 },
  stack: { FLOORS: [{ goal: 5, speed: 0.85 }, { goal: 6, speed: 1.1 }, { goal: 7, speed: 1.35 }], FLOOR_TOP: 18 },
  run: { STRETCHES: [{ name: "the park", len: 160, grass: "#8fdc7a", edge: "#6fcf62", side: "tree" }, { name: "the beach", len: 190, grass: "#f6dfa4", edge: "#67c6ef", side: "palm" }, { name: "the forest", len: 220, grass: "#5cb35a", edge: "#3f8f47", side: "pine" }], SPEEDS: [1, 1.15, 1.3], SPEED_CAP: 1.75, RUN_TOP: 570 },
  glide: { LEGS: [{ goal: 6 }, { goal: 7 }, { goal: 8 }], LEG_TOP: 21, SHRINK: [0, 0.06, 0.12], GATE_EVERY: 2900 },
};
const UP = {
  slice: { 2: { WAVES: [{ goal: 7, every: 1750, most: 2, gold: 0.08 }, { goal: 9, every: 1550, most: 2, gold: 0.14 }, { goal: 11, every: 1400, most: 3, gold: 0.18 }], GIANT_CUTS: 6, FRUIT_K: 1 },
           3: { WAVES: [{ goal: 8, every: 1600, most: 2, gold: 0.1 }, { goal: 10, every: 1450, most: 3, gold: 0.16 }, { goal: 12, every: 1300, most: 4, gold: 0.2 }], GIANT_CUTS: 7, FRUIT_K: 0.85 } },
  tiles: { 2: { names: ["Hot Cross Buns", "Old MacDonald", "London Bridge", "Au Clair de la Lune"], ROW_TOP: 53 }, 3: { names: ["Are You Sleeping", "This Old Man", "Lightly Row", "Itsy Bitsy Spider"], ROW_TOP: 53 } },
  stack: { 2: { FLOORS: [{ goal: 6, speed: 0.95 }, { goal: 7, speed: 1.2 }, { goal: 8, speed: 1.45 }], FLOOR_TOP: 21 }, 3: { FLOORS: [{ goal: 7, speed: 1.05 }, { goal: 8, speed: 1.3 }, { goal: 9, speed: 1.55 }], FLOOR_TOP: 24 } },
  run: { 2: { SPEEDS: [1.1, 1.25, 1.4], SPEED_CAP: 1.85 }, 3: { SPEEDS: [1.2, 1.35, 1.5], SPEED_CAP: 1.95 } },
  glide: { 2: { LEGS: [{ goal: 7 }, { goal: 8 }, { goal: 9 }], LEG_TOP: 24, SHRINK: [0.04, 0.1, 0.16], GATE_EVERY: 2700, K: 1.1 }, 3: { LEGS: [{ goal: 8 }, { goal: 9 }, { goal: 10 }], LEG_TOP: 27, SHRINK: [0.08, 0.14, 0.2], GATE_EVERY: 2500, K: 1.2 } },
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b, tol = 1e-9) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const help = {};   // help values per game, per level

// The clock is frozen for a help check, so a frame moves nothing: whatever
// the page computes for the next step is read before any time passes.
// (two frames after the freeze, so the frame that saw the last real time has passed)
const frames = (page, n = 3) => page.evaluate((n) => new Promise((done) => { let i = 0; (function f() { if (++i >= n) return done(); requestAnimationFrame(f); })(); }), n);
const freeze = async (page) => { await page.evaluate(() => { const t0 = performance.now(); performance.now = () => t0; }); await frames(page, 3); };

// ── 1. Fruit Slice ──
for (const level of [1, 2, 3]) await section("Fruit Slice at Level " + level, async () => {
  const { context, page, errors } = await open("slice", { level });
  try {
    const g = await page.evaluate(() => ({ LV, WAVES, GIANT_CUTS, FRUIT_K, WAVES_L1, REV, HEART_MAX, WAVE_CAP_MS }));
    const L = "Fruit Slice L" + level + ": ";
    ok(L + "the page plays Level " + level, g.LV === level, g.LV);
    if (level === 1) ok(L + "its waves and giant are main's, unchanged", eq(g.WAVES, L1.slice.WAVES) && g.GIANT_CUTS === L1.slice.GIANT_CUTS && g.FRUIT_K === 1, g);
    else ok(L + "its waves, giant and fruit size are the level's", eq(g.WAVES, UP.slice[level].WAVES) && g.GIANT_CUTS === UP.slice[level].GIANT_CUTS && g.FRUIT_K === UP.slice[level].FRUIT_K, g);
    ok(L + "Level 1's waves are kept for the help, and the cards, hearts and 45 seconds never change", eq(g.WAVES_L1, L1.slice.WAVES) && g.REV === 3 && g.HEART_MAX === 3 && g.WAVE_CAP_MS === 45000, g);
    // the two-miss help: one fruit, bigger and slower, at Level 1's spacing
    await freeze(page);
    const h = await page.evaluate(() => new Promise((done) => {
      const R = Math.random;
      fruits.length = 0; slowMs = 0; missRun = 2; pacePlay = 0; startBest = 0; waveMs = 1000; nextToss = 1000;
      Math.random = () => 0;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const lo = fruits[fruits.length - 1], gap = nextToss - waveMs;
        Math.random = () => 0.9999; fruits.length = 0; toss();
        const hi = fruits[fruits.length - 1]; Math.random = R;
        done({ n: lo ? 1 : 0, rLo: lo && lo.r, rHi: hi && hi.r, g: lo && lo.g / G, gap });
      }));
    }));
    help.slice = help.slice || {}; help.slice[level] = h;
    ok(L + "the two-miss help throws a help fruit (bigger and slower)", h.n === 1 && near(h.rLo, 32 * 1.3) && near(h.g, 0.72), h);
    // an ordinary fruit is the level's size
    const o = await page.evaluate(() => { const R = Math.random; Math.random = () => 0; missRun = 0; slowMs = 0; fruits.length = 0; toss(); const f = fruits[fruits.length - 1]; Math.random = R; return f.r; });
    ok(L + "an ordinary fruit is " + (level === 3 ? "smaller (×0.85)" : "Level 1's size"), near(o, 32 * (level === 3 ? 0.85 : 1)), o);
    ok(L + "no page errors", errors.length === 0, errors);
    ok(L + "\"level played\" is posted " + (level > 1 ? "once, with the game and the level" : "never at Level 1"), await told("slice", level), tracked("slice"));
    posts.length = 0;
  } finally { await context.close(); }
});
ok("Fruit Slice: the help fruit's size range and its spacing after two misses are the same at all three levels",
  [1, 2, 3].every((l) => help.slice && help.slice[l]) && [2, 3].every((l) => near(help.slice[l].rLo, help.slice[1].rLo) && near(help.slice[l].rHi, help.slice[1].rHi) && near(help.slice[l].g, help.slice[1].g) && near(help.slice[l].gap, help.slice[1].gap)) && near(help.slice[1].gap, 1900 * 1.25), help.slice);

// ── 2. Piano Tiles ──
for (const level of [1, 2, 3]) await section("Piano Tiles at Level " + level, async () => {
  const { context, page, errors } = await open("tiles", { level });
  try {
    const g = await page.evaluate(() => ({ LV, SONGS, SONGS_L1, ROW_TOP, REV, HEART_MAX }));
    const L = "Piano Tiles L" + level + ": ";
    ok(L + "the page plays Level " + level, g.LV === level, g.LV);
    if (level === 1) ok(L + "its songs are main's four, unchanged, and every note of them is 52", eq(g.SONGS, L1.tiles.SONGS) && g.ROW_TOP === 52, g);
    else ok(L + "its songs are the level's four, the last the finale, and every note of them is " + UP.tiles[level].ROW_TOP, eq(g.SONGS.map((s) => s.name), UP.tiles[level].names) && g.SONGS.map((s) => !!s.finale).join() === "false,false,false,true" && g.ROW_TOP === UP.tiles[level].ROW_TOP, g.SONGS);
    ok(L + "every note is one the keys play (C to B), and Level 1's songs are kept for the help", g.SONGS.every((s) => /^[CDEFGAB ]+$/.test(s.notes)) && eq(g.SONGS_L1, L1.tiles.SONGS) && g.REV === 3 && g.HEART_MAX === 3, g.SONGS);
    ok(L + "the first three tiles still wait on the keys", await page.evaluate(() => typeof waitLeft === "number"));
    // a lost heart: the rest of this song falls and spawns at Level 1's numbers
    await freeze(page);
    const h = await page.evaluate(() => new Promise((done) => {
      tiles.length = 0; waitLeft = 0; slowMs = 0; heartHitAt = -1e9; paceK = 1;
      const before = (HITY() + 90) / speedPx();
      loseHeart(performance.now());
      const fall = (HITY() + 90) / speedPx();
      nextAt = songMs;
      requestAnimationFrame(() => requestAnimationFrame(() => done({ before, fall, beat: nextAt - songMs, hearts, spawned: tiles.length })));
    }));
    help.tiles = help.tiles || {}; help.tiles[level] = h;
    ok(L + "the first song falls at its own time, and after a lost heart at Level 1's", near(h.before, g.SONGS[0].fall, 1e-6) && near(h.fall, 2.5, 1e-6) && h.hearts === 2 && h.spawned >= 1, h);
    ok(L + "no page errors", errors.length === 0, errors);
    ok(L + "\"level played\" is posted " + (level > 1 ? "once" : "never at Level 1"), await told("tiles", level), tracked("tiles"));
    posts.length = 0;
  } finally { await context.close(); }
});
ok("Piano Tiles: a tile's fall time and the beat after a lost heart are the same at all three levels",
  [1, 2, 3].every((l) => help.tiles && help.tiles[l]) && [2, 3].every((l) => near(help.tiles[l].fall, help.tiles[1].fall, 1e-6) && near(help.tiles[l].beat, help.tiles[1].beat, 1e-6)) && near(help.tiles[1].beat, 760, 1e-6), help.tiles);

// ── 3. Block Stacker ──
for (const level of [1, 2, 3]) await section("Block Stacker at Level " + level, async () => {
  const { context, page, errors } = await open("stack", { level });
  try {
    const g = await page.evaluate(() => ({ LV, FLOORS, FLOORS_L1, FLOOR_TOP, REV, HEART_MAX, minw: MINW / baseW, pace: speed / speed0 }));
    const L = "Block Stacker L" + level + ": ";
    ok(L + "the page plays Level " + level, g.LV === level, g.LV);
    if (level === 1) ok(L + "its floors are main's, unchanged: every block is 18", eq(g.FLOORS, L1.stack.FLOORS) && g.FLOOR_TOP === 18, g);
    else ok(L + "its floors are the level's: every block is " + UP.stack[level].FLOOR_TOP, eq(g.FLOORS, UP.stack[level].FLOORS) && g.FLOOR_TOP === UP.stack[level].FLOOR_TOP, g);
    ok(L + "the first floor starts at its level's pace", near(g.pace, (level === 1 ? L1.stack : UP.stack[level]).FLOORS[0].speed), g.pace);
    ok(L + "a block is never narrower than 60% of the first, and the cards and hearts never change", near(g.minw, 0.6) && g.REV === 3 && g.HEART_MAX === 3 && eq(g.FLOORS_L1, L1.stack.FLOORS), g);
    const banner = await page.evaluate(() => document.getElementById("bnSmall").textContent);
    ok(L + "the first banner names the floor's own count", banner === "Stack " + g.FLOORS[0].goal + " blocks!", banner);
    // a missed block: the next one is never faster than Level 1's would be
    const h = await page.evaluate(() => { slowMs = 0; heartHitAt = -1e9; cur.x = -8; cur.w = MINW; drop(); return { after: speed, s0: speed0, hearts, row: rowN }; });
    help.stack = help.stack || {}; help.stack[level] = h;
    ok(L + "a missed block costs a heart and slows the next", h.hearts === 2 && h.row === 0, h);
    ok(L + "no page errors", errors.length === 0, errors);
    ok(L + "\"level played\" is posted " + (level > 1 ? "once" : "never at Level 1"), await told("stack", level), tracked("stack"));
    posts.length = 0;
  } finally { await context.close(); }
});
ok("Block Stacker: the block's speed after a miss is the same at all three levels",
  [1, 2, 3].every((l) => help.stack && help.stack[l]) && [2, 3].every((l) => near(help.stack[l].after, help.stack[1].after)) && near(help.stack[1].after, Math.max(help.stack[1].s0 * 0.7, help.stack[1].s0 * 0.85 - 0.16)), help.stack);

// ── 4. Sound Sprint ──
for (const level of [1, 2, 3]) await section("Sound Sprint at Level " + level, async () => {
  const { context, page, errors } = await open("run", { level });
  try {
    await page.waitForFunction(() => playing === true && phase === "run");
    const g = await page.evaluate(() => ({ LV, STRETCHES, RUN_TOP, SPEEDS, SPEED_CAP, REV, HEART_MAX, pace: speed / speed0 }));
    const L = "Sound Sprint L" + level + ": ";
    ok(L + "the page plays Level " + level, g.LV === level, g.LV);
    ok(L + "the same park, beach and forest, and every metre is still 570", eq(g.STRETCHES, L1.run.STRETCHES) && g.RUN_TOP === 570, g);
    const want = level === 1 ? L1.run : UP.run[level];
    ok(L + "each stretch's pace and the cap are " + (level === 1 ? "main's" : "the level's"), eq(g.SPEEDS, want.SPEEDS) && g.SPEED_CAP === want.SPEED_CAP && near(g.pace, want.SPEEDS[0]), g);
    ok(L + "the cards and hearts never change", g.REV === 3 && g.HEART_MAX === 3);
    // the row gap: the level's, but Level 1's while the rocks are thinned
    const gaps = await page.evaluate(() => { const R = Math.random; Math.random = () => 0; const a = rowGap(); Math.random = () => 0.9999; const b = rowGap(); obstacleHelpUntil = dist + 60; Math.random = () => 0; const c = rowGap(); Math.random = () => 0.9999; const d = rowGap(); obstacleHelpUntil = 0; Math.random = R; return { lo: a, hi: b, helpLo: c, helpHi: d }; });
    ok(L + "rows of rocks are " + (level === 1 ? "Level 1's distance apart" : "a little closer"), near(gaps.lo, [170, 160, 150][level - 1]) && near(gaps.hi, [170 + 0.9999 * 130, 160 + 0.9999 * 125, 150 + 0.9999 * 120][level - 1]), gaps);
    ok(L + "…and Level 1's while the rocks are thinned after a tumble", near(gaps.helpLo, 170) && near(gaps.helpHi, 170 + 0.9999 * 130), gaps);
    // a tumble: the road is never faster than Level 1's would be
    const h = await page.evaluate(() => { slowMs = 0; heartHitAt = -1e9; startFall(); return { after: speed, s0: speed0, hearts }; });
    help.run = help.run || {}; help.run[level] = h;
    ok(L + "a tumble costs a heart and slows the road", h.hearts === 2 && h.after < h.s0 * 1.0001, h);
    ok(L + "no page errors", errors.length === 0, errors);
    ok(L + "\"level played\" is posted " + (level > 1 ? "once" : "never at Level 1"), await told("run", level), tracked("run"));
    posts.length = 0;
  } finally { await context.close(); }
});
ok("Sound Sprint: the road's speed after a tumble is the same at all three levels",
  [1, 2, 3].every((l) => help.run && help.run[l]) && [2, 3].every((l) => near(help.run[l].after, help.run[1].after)) && near(help.run[1].after, Math.max(help.run[1].s0 * 0.85, help.run[1].s0 / 1.1025)), help.run);

// ── 5. Flappy Glide ──
for (const level of [1, 2, 3]) await section("Flappy Glide at Level " + level, async () => {
  const { context, page, errors } = await open("glide", { level });
  try {
    const g = await page.evaluate(() => ({ LV, LEGS, LEG_TOP, SHRINK, gateEvery, REV, HEART_MAX, k: gspeed0 / GSPEED_L1, gspeedK: gspeed / GSPEED_L1, GATE_EVERY_L1 }));
    const L = "Flappy Glide L" + level + ": ";
    ok(L + "the page plays Level " + level, g.LV === level, g.LV);
    const want = level === 1 ? Object.assign({ K: 1 }, L1.glide) : UP.glide[level];
    ok(L + "its legs, gaps and hedges are " + (level === 1 ? "main's, unchanged: every gap is 21" : "the level's: every gap is " + want.LEG_TOP), eq(g.LEGS, want.LEGS) && g.LEG_TOP === want.LEG_TOP && eq(g.SHRINK, want.SHRINK) && g.gateEvery === want.GATE_EVERY && near(g.k, want.K) && near(g.gspeedK, want.K), g);
    ok(L + "the cards and hearts never change, and Level 1's spacing is kept for the help", g.REV === 3 && g.HEART_MAX === 3 && g.GATE_EVERY_L1 === 2900, g);
    const h = await page.evaluate(() => { gates = []; slowMs = 0; heartHitAt = -1e9; const gg = { cy: py - 200 }; bump(gg); return { after: gspeed, l1: GSPEED_L1, every: gateEvery, hearts, gap: gapH / gapBase }; });
    help.glide = help.glide || {}; help.glide[level] = h;
    ok(L + "a bump costs a heart, widens the gap and slows the hedges", h.hearts === 2 && near(h.gap, 1.12), h);
    const back = await page.evaluate(() => { startLeg(1); return gateEvery; });
    ok(L + "the next leg is back at the level's spacing", back === want.GATE_EVERY, back);
    ok(L + "no page errors", errors.length === 0, errors);
    ok(L + "\"level played\" is posted " + (level > 1 ? "once" : "never at Level 1"), await told("glide", level), tracked("glide"));
    posts.length = 0;
  } finally { await context.close(); }
});
ok("Flappy Glide: the hedges' speed and spacing after a bump are the same at all three levels",
  [1, 2, 3].every((l) => help.glide && help.glide[l]) && [2, 3].every((l) => near(help.glide[l].after, help.glide[1].after) && help.glide[l].every === help.glide[1].every) && near(help.glide[1].after, help.glide[1].l1 * 0.9) && help.glide[1].every === 2900, help.glide);

// ── 6. what a pick plays, and who it never reaches ──
await section("a pick above what is open", async () => {
  const { context, page, errors } = await open("tiles", { trophies: 200, pick: 3 });
  try {
    const g = await page.evaluate(() => ({ LV, first: SONGS[0].name }));
    ok("a pick of Level 3 at 200 trophies plays Level 2", g.LV === 2 && g.first === "Hot Cross Buns", g);
    ok("…with no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
  const c = await open("slice", { trophies: 800, levels: { cap: 1, pick: { slice: 3 } } });
  try {
    ok("under a grown-up's \"Level 1 only\" the game plays Level 1", await c.page.evaluate(() => LV === 1 && WAVES[0].goal === 6));
    posts.length = 0;
  } finally { await c.context.close(); }
});

// ── 7. each level keeps its own best ──
await section("bests per level", async () => {
  // Level 3's longest row is 56; Level 1's is 10. At Level 1 the 56 is nowhere.
  const levels = { pick: { tiles: 1 }, best: { tiles: { "3": { n: 56, at: "2026-10-10" } } } };
  let f = await open("tiles", { trophies: 800, levels, bests: { tiles: { n: 10, at: "2026-10-01" } } });
  try {
    const a = await f.page.evaluate(() => ({ LV, startBest }));
    ok("at Level 1 the best is Level 1's own (10), never Level 3's 56", a.LV === 1 && a.startBest === 10, a);
    const b = await f.page.evaluate(() => { comboN = 11; rowUp(); keepBest(); rowBest = 11; return { banner: document.getElementById("bnBig").textContent, said: saidNewBest, line: bestLine(), stored: Sona.gameBest("tiles"), l3: Sona.playBest("tiles", 3) }; });
    ok("passing it still says \"New best!\", and the line and Level 1's record follow Level 1", b.said && b.banner === "New best!" && b.line[1] === "A new best!" && b.stored === 11 && b.l3 === 56 && !/56/.test(b.line.join(" ")), b);
    const c = await f.page.evaluate(() => { rowBest = 5; return bestLine(); });
    ok("a short Level 1 row is measured against the Level 1 best the child came in with, never 56", /Your best: 10\. 5 away!/.test(c.join(" ")) && !/56/.test(c.join(" ")), c);
  } finally { await f.context.close(); }
  f = await open("tiles", { trophies: 800, levels: { pick: { tiles: 3 }, best: { tiles: { "3": { n: 56, at: "2026-10-10" } } } }, bests: { tiles: { n: 10, at: "2026-10-01" } } });
  try {
    const a = await f.page.evaluate(() => { rowBest = 53; return { LV, startBest, top: ROW_TOP, line: bestLine() }; });
    ok("at Level 3 the best is Level 3's own, and its top is Level 3's 53 notes", a.LV === 3 && a.startBest === 56 && a.top === 53 && a.line[1] === "That is every note!", a);
  } finally { await f.context.close(); }
  f = await open("stack", { trophies: 800, levels: { pick: { stack: 2 } }, bests: { stack: { n: 13, at: "2026-10-01" } } });
  try {
    const before = await f.page.evaluate(() => localStorage.getItem("sona.bests.v1"));
    const r = await f.page.evaluate(() => { cur.x = stack[stack.length - 1].x; drop(); cur.x = stack[stack.length - 1].x; drop(); keepBest(); return { startBest, row: rowBest, l2: Sona.playBest("stack", 2), l1: Sona.gameBest("stack") }; });
    const after = await f.page.evaluate(() => localStorage.getItem("sona.bests.v1"));
    ok("a Level 2 round keeps its row as Level 2's best and leaves Level 1's record untouched", r.startBest === 0 && r.row === 2 && r.l2 === 2 && r.l1 === 13 && before === after, { r, before, after });
    ok("…with no page errors", f.errors.length === 0, f.errors);
  } finally { await f.context.close(); }
  posts.length = 0;
});

// ── 8. the source: Level 1's pinned lines are where they were ──
{
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  const read = (g) => strip(readFileSync(path.join(ROOT, "arcade-" + g + ".html"), "utf8"));
  const slice = read("slice"), tiles = read("tiles"), stack = read("stack"), run = read("run"), glide = read("glide");
  ok("each page reads its level once, from Sona.playLevel, and an older sona.js plays Level 1",
    ["slice", "tiles", "stack", "run", "glide"].every((g) => (read(g).match(/var LV=\(S&&S\.playLevel\)\?S\.playLevel\("/g) || []).length === 1 && new RegExp('S\\.playLevel\\("' + g + '"\\):1;').test(read(g))));
  ok("Level 1's tables keep their own lines, and a level overrides after them",
    /var WAVES=\[\{goal:6,[^\n]*\n[^\n]*GIANT_CUTS=5;[\s\S]*?var WAVES_L1=WAVES;\s*if\(LV===2\)/.test(slice) && /var FLOORS=\[\{goal:5,speed:\.85\}[^\n]*\n[\s\S]*?var FLOORS_L1=FLOORS;\s*if\(LV===2\)/.test(stack)
    && /var LEGS=\[\{goal:6\},\{goal:7\},\{goal:8\}\];\s*var LEGS_L1=LEGS;/.test(glide) && /\{name:"Ode to Joy"[^\n]*\n\s*\];\s*var SONGS_L1=SONGS;/.test(tiles));
  ok("the help paths name Level 1's numbers", /missRun>=2\?WAVES_L1\[wave\]\.every\*1\.25/.test(slice) && /r:\(32\+Math\.random\(\)\*12\)\*\(help\?1\.3:FRUIT_K\)/.test(slice)
    && /if\(LV>1\) speed=Math\.min\(speed,speed0\*FLOORS_L1\[floor\]\.speed\); speed=Math\.max\(speed0\*\.7,speed-\.16\);/.test(stack)
    && /if\(LV>1\)speed=Math\.min\(speed,speed0\*\[1,1\.15,1\.30\]\[stretch\]\);speed=Math\.max\(speed0\*\[1,1\.15,1\.30\]\[stretch\]\*\.85,speed\/1\.1025\);/.test(run)
    && /gspeed=Math\.max\(GSPEED_L1\*\.8,gspeed\*\.9\)/.test(glide) && /helpL1\?SONGS_L1\[song\]\.beat:SONGS\[song\]\.beat/.test(tiles));
  ok("each page fires \"level played\" once, through Sona.track (where telemetrytest sees it), only at Level 2 or 3",
    [slice, tiles, stack, run, glide].every((c) => (c.match(/Sona\.track\("level played"/g) || []).length === 1 && /if\(tok&&LV>1\)\{ try\{ Sona\.track\("level played"/.test(c) && !/\bS\.track\(/.test(c)));
  ok("no page reads the level's record or the trophies itself", [slice, tiles, stack, run, glide].every((c) => !/sona\.playlevel|sona\.trophy|PLAYLEVEL|trophies\(/.test(c)));
  const charge = readFileSync(path.join(ROOT, "charge.html"), "utf8");
  ok("the practice page's \"Up next\" names the level, only at Level 2 or 3", /_lb\.querySelector\("\.launch-name"\)\.textContent=GMETA\.n\+\(_lv>1\?" \\u00b7 Level "\+_lv:""\);/.test(charge) && /S\.playLevel\(GAME\.replace\(\/\^arcade-\|\\\.html\$\/g,""\)\)/.test(charge));
}

console.log(fails ? `\n${fails} FAILED` : "\nall round-game level checks passed");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
