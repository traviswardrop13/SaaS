// SLICE2: Fruit Slice, rebuilt as a round (Travis, 27 Sep 2026). He said yes
// to: "a clear goal: three waves of fruit, then one giant watermelon to
// finish. It always ends in a win. Missing is OK. A missed fruit just falls,
// and the game keeps going. The talking moves to between waves." And on the
// "Say it 5 times" page: "each time your child says the sound, a real fruit
// drops onto the stand... those five are the first ones thrown in the game."
//
// This plays a round on a fake phone. The say-it card's own listening is
// micquietgamestest's (every arcade game shares it); here a heard child is
// the card's own success path, closeReviveMic() then doRevive().
//
// BEAT YOUR BEST (Travis, 1-2 Oct 2026): the one number a child sees is FRUIT
// IN A ROW, the most fruit sliced without one hitting the ground (a golden
// fruit is one, the giant watermelon is one). The top-left number is the
// round's longest row and never goes down; "New best!" pops once, the moment
// they pass the best they came in with; the win card keeps its own win title
// and adds one line, in Piano Tiles' own forms; the top button is "Play
// again", back through the say-it-five-times page. The best is this child's
// own (Sona.gameBest, besttest), it counts the finger and never the voice,
// and the words "score" and "points" are never shown.
// Two Super Slice rules came with it, so that saying the sound helps a row
// instead of ending the wave sooner: fruit thrown during Super Slice are
// EXTRAS (they add to the row, never to the wave), and nothing dropped while
// it lasts breaks the row. The earned path itself is superslicetest's.
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from "./_env.mjs";

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT, BASE = "http://127.0.0.1:8263";
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2", mp3: "audio/mpeg" };
const server = createServer((req, res) => {
  const u = new URL(req.url, BASE), f = path.join(ROOT, u.pathname);
  if (u.pathname.startsWith("/api/")) { res.writeHead(503); res.end("{}"); return; }
  if (!existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[f.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8263, "127.0.0.1", r));
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(detail))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, e.stack); } }
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");

// ── the code: a round, not a practice ──
const PAGE = readFileSync(ROOT + "/arcade-slice.html", "utf8"), code = strip(PAGE);
ok("three waves of 6, 8 and 10 fruit, then a giant of five cuts",
  /var WAVES=\[\{goal:6,[^\]]*\{goal:8,[^\]]*\{goal:10,/.test(code) && /GIANT_CUTS=5\b/.test(code));
ok("a missed fruit no longer opens the card: only a finished wave asks for the sound",
  !/if\(playing\)\{ crash\(\); \}/.test(code) && /sayCard\("Say \\u201C"\+SAYTXT\+"\\u201D for wave "/.test(code));
ok("nothing in the round is practice data", !/logAttempt|bumpReps|recordSession|recordRung|rotAdvance|repsBeacon/.test(code));
ok("the page asks for the mic in one place only: the say-it card", (code.match(/getUserMedia\(/g) || []).length === 1 && /function openReviveMic\(\)/.test(code));
ok("its own sounds play only through sfx(), so they keep the quiet rules",
  /S\.sfx\.swish=function/.test(code) && !/[^.]\bhiss\(|[^.]\bthud\(/.test(code.replace(/S\.sfx\.\w+=function\(\)\{[^\n]*\};/g, "").replace(/function (hiss|thud)\(/g, "")));
ok("the best is this child's own, from the shared store, and the page asks before it uses it (an older cached sona.js has none)",
  /var CAN_BEST=!!\(S&&S\.gameBest&&S\.gameBestOffer\)/.test(code) && /if\(CAN_BEST\) startBest=S\.gameBest\("slice"\)/.test(code) && /if\(!CAN_BEST\|\|rowBest<=keptRow\) return;[\s\S]{0,80}S\.gameBestOffer\("slice",rowBest\)/.test(code));
ok("the old best, one hidden number for every child on the phone, is no longer read or written", !/sona\.best\.slice|BESTK|localStorage/.test(code));
ok("the row counts the finger only: a sliced fruit and the giant's burst add to it, the say-it card and Echo's sound power never do",
  (code.match(/rowN\+\+/g) || []).length === 2 && /f\.sliced=true; hit\+\+; rowN\+\+;/.test(code) && /giant=null; sfx\("giant"\); echoHop\(\);\s*rowN\+\+; rowUp\(true\);/.test(code) && (code.match(/\browUp\(/g) || []).length === 3
  && !/function doRevive\(\)\{[^}]*(rowN|rowBest)/.test(code) && !/SLOW_HELP\.onEarn=function\(\)\{[^}]*(rowN|rowBest)/.test(code));
ok("Super Slice's fruit are extras: marked as thrown, never counted toward the wave, and nothing dropped while it lasts breaks the row or feeds the two-miss help",
  /extra:slowMs>0,/.test(code) && /if\(phase==="wave"&&!f\.extra\) waveGot\+=worth;/.test(code) && /if\(playing&&phase==="wave"&&!f\.extra&&!\(slowMs>0\)\)\{ missRun\+\+; rowN=0; \}/.test(code));
ok("a wave's time limit reads real seconds of play, not the clock Super Slice slows", /wavePlay\+=dt;/.test(code) && /wavePlay>=WAVE_CAP_MS/.test(code) && !/waveMs>=WAVE_CAP_MS/.test(code) && /wavePlay=0;/.test(code));
{ // every string the page can put on screen: the markup's text and the script's literals (ids such as "score" are one bare word)
  const words = [...PAGE.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").matchAll(/>([^<>]+)</g)].map((m) => m[1].trim())
    .concat([...code.matchAll(/"([^"\n]*)"/g)].map((m) => m[1]).filter((t) => /\s/.test(t)));
  const bad = words.filter((t) => /\bpoints?\b|\bscores?\b|you missed|\blost\b|COMBO|\+3/i.test(t));
  ok("no words on the page say \u201Cscore\u201D or \u201Cpoints\u201D, or that a best was missed", words.length > 30 && bad.length === 0, bad);
}
ok("the top button is Play again, back through this game's practice page; the game-to-game Next is gone",
  /<button class="btn blue" id="endCharge">Play again<\/button>/.test(PAGE) && /\$\("endCharge"\)\.onclick=backToCharge;/.test(code) && !/WOOHOO|Next \u2192|arcade-tiles/.test(code));
ok("the first game after setup still asks where to go, once, so its mark is spent", /if\(S&&S\.firstGameEnd\) S\.firstGameEnd\("slice"\);/.test(code));
const CHARGE = readFileSync(ROOT + "/charge.html", "utf8");
ok("the \"Say it 5 times\" stand drops each fruit onto the counter, and stills it for reduced motion",
  /#stand \.well \.fr\.pop\{animation:fruitDrop/.test(CHARGE) && /@keyframes fruitDrop/.test(CHARGE) && /#reveals \.pop,#stand \.well \.fr\.pop\{animation:none;\}/.test(CHARGE));

// ── a fake phone: a mic that hears silence, audio that records what plays ──
function fakePhone(cfg) {
  cfg = cfg || {};
  const f = window.__f = { mics: 0, live: 0, sfx: [] };
  navigator.mediaDevices.getUserMedia = () => {
    f.mics++; f.live++;
    const t = { readyState: "live", stop() { if (this.readyState === "live") { this.readyState = "ended"; f.live--; } } };
    return Promise.resolve({ getTracks: () => [t], getAudioTracks: () => [t] });
  };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  const node = () => ({ gain: param(), frequency: param(), Q: param(), type: "", buffer: null, connect() {}, disconnect() {}, start() {}, stop() {} });
  function AC() { this.state = "running"; this.sampleRate = 48000; this.currentTime = 0; this.destination = {}; }
  AC.prototype = {
    resume() { return Promise.resolve(); }, suspend() { return Promise.resolve(); }, close() { return Promise.resolve(); },
    createGain: node, createOscillator: node, createBufferSource: node, createBiquadFilter: node,
    createBuffer(c, n, sr) { return { length: n, sampleRate: sr, duration: n / sr, getChannelData: () => new Float32Array(n) }; },
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; },
    createAnalyser() { return { fftSize: 2048, frequencyBinCount: 1024, smoothingTimeConstant: 0, connect() {}, disconnect() {},
      getByteTimeDomainData(a) { a.fill(128); }, getFloatTimeDomainData(a) { a.fill(0); }, getByteFrequencyData(a) { a.fill(0); }, getFloatFrequencyData(a) { a.fill(-120); } }; },
  };
  window.AudioContext = window.webkitAudioContext = AC;
  // Echo's lead-in and Rachel's sound clip end at once: on a slow CI runner
  // real media playback held the card's mic back past the test's patience
  // (27 Sep 2026: GitHub's runner took 5.8 s for the first card)
  window.Audio = function (src) { const a = { src, volume: 1, paused: false, play() { setTimeout(() => { if (a.onended) a.onended(); }, 20); return Promise.resolve(); }, pause() { a.paused = true; }, removeAttribute() {}, load() {} }; return a; };
  // every Sona sound, with whether a mic was live as it started
  let sona;
  Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set: (v) => { sona = v;
    // a phone still holding last week's sona.js: no store for bests at all
    if (cfg.noStore) { delete v.gameBest; delete v.gameBestOffer; }
    const sfx = v.sfx || {}; v.sfx = new Proxy(sfx, { get(t, k) { const real = t[k]; if (typeof real !== "function" || k === "stop") return real; return function () { f.sfx.push({ name: k, live: f.live > 0 }); return real.apply(this, arguments); }; } }); } });
  // the phone is set up once a tab: a later page in the same tab (the game
  // opened again for a second child) must find what the first one left
  if (!sessionStorage.getItem("__seeded")) {
    sessionStorage.setItem("__seeded", "1");
    localStorage.setItem("sona.freeera.v1", "post"); ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true, voiceOn: false, soundOn: true, volume: 0.6 }));
    if (cfg.best) localStorage.setItem("sona.bests.v1", JSON.stringify({ slice: { n: cfg.best, at: "2026-10-01" } }));
    if (cfg.old) localStorage.setItem("sona.best.slice", cfg.old);
  }
  sessionStorage.setItem("sona.play.token", "arcade-slice.html");
}
async function ready(page) {
  await page.waitForFunction(() => window.gameEntryAllowed === true && typeof startWave === "function");
  // every number the top-left pill ever shows, and every "New best!" the banner says
  await page.evaluate(() => {
    window.__pill = []; window.__newBest = [];
    new MutationObserver(() => __pill.push(Number(document.getElementById("score").textContent))).observe(document.getElementById("score"), { childList: true, characterData: true, subtree: true });
    // (the page's banner() lives in a block, so it can't be wrapped from here: its words are watched instead)
    new MutationObserver(() => { const big = document.getElementById("bnBig").textContent, small = document.getElementById("bnSmall").textContent; if (/best/i.test(big + " " + small)) __newBest.push([big, small]); }).observe(document.getElementById("bnBig"), { childList: true, characterData: true, subtree: true });
  });
}
async function open(cfg = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", hasTouch: false });
  await context.route("**/*", (r) => (r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort()));
  await context.addInitScript(fakePhone, cfg);
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/arcade-slice.html?from=charge" + (cfg.daily ? "&daily=1" : ""));
  await ready(page);
  return { context, page, errors };
}
const st = (page) => page.evaluate(() => ({ phase, wave, waveGot, score, REV, missRun, playing, card: document.getElementById("revOvl").classList.contains("show"),
  title: document.getElementById("revTitle").textContent, ended: !!window.__ended, mics: __f.mics, live: __f.live }));
// one swipe straight through a fruit, where it will be a few frames on
async function sliceOne(page) {
  const f = await page.evaluate(() => { const top = standTop(); const v = fruits.filter((q) => !q.sliced && q.y < top - 30 && q.y > 100).sort((a, b) => a.y - b.y)[0]; return v ? { x: v.x, y: v.y + v.vy * 3 } : null; });
  if (!f) return false;
  await page.mouse.move(f.x - 80, f.y - 30); await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(f.x - 80 + i * 32, f.y - 30 + i * 12);
  await page.mouse.up(); return true;
}
async function sliceUntil(page, done, ms = 40000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(done)) return true; await sliceOne(page); await page.waitForTimeout(80); }
  return false;
}
// the card's own success path, as when it hears the child
const heard = (page) => page.evaluate(() => { closeReviveMic(); doRevive(); });
// ── a board the test owns: nothing thrown until it says so ──
const quiet = (page) => page.evaluate(() => { fruits = []; nextToss = waveMs + 1e9; });
// n fruit hung still in the middle of the sky, and one swipe through them all
// (g is tiny, not 0: the page reads a missing g as its own gravity)
async function sliceNew(page, props = {}, n = 1) {
  const d = await page.evaluate(([props, n]) => { for (let i = 0; i < n; i++) fruits.push(Object.assign({ e: "🍎", x: W / 2, y: H * 0.45, g: 1e-9, vx: 0, vy: 0, r: 40, rot: 0, vr: 0, sliced: false }, props)); return { W, H }; }, [props, n]);
  await page.mouse.move(d.W / 2 - 90, d.H * 0.45 - 20); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(d.W / 2 - 90 + i * 30, d.H * 0.45 - 20 + i * 7);
  await page.mouse.up();
  await page.waitForFunction(() => fruits.length === 0);
}
// a fruit nobody sliced, already under the screen: it hits the ground on the next frame
async function dropOne(page, props = {}) {
  await page.evaluate((props) => { fruits.push(Object.assign({ e: "🍊", x: W * 0.6, y: H + 200, g: 1e-9, vx: 0, vy: 5, r: 38, rot: 0, vr: 0, sliced: false }, props)); }, props);
  await page.waitForFunction(() => fruits.length === 0);
}
// what the child sees: the row they are on, the top-left number, the banner, the win card, and what the phone keeps
const best = (page) => page.evaluate(() => {
  const $ = (id) => document.getElementById(id), vis = (e) => !!e && getComputedStyle(e).display !== "none";
  return { on: rowN, row: rowBest, pill: $("score").textContent, label: $("rowPill").getAttribute("aria-label"), pills: __pill.slice(), said: __newBest.slice(), flash: $("combo").textContent,
    waveGot, score, missRun, phase,
    stored: Sona.gameBest ? Sona.gameBest("slice") : null, old: localStorage.getItem("sona.best.slice"),
    title: $("endTitle").textContent.trim(), sub: vis($("endSub")) ? $("endSub").textContent.trim() : null, shown: $("endOvl").classList.contains("show"),
    top: vis($("endCharge")) ? $("endCharge").textContent.trim() : null, again: vis($("endAgain")) ? $("endAgain").textContent.trim() : null, home: vis($("endHome")) ? $("endHome").textContent.trim() : null,
    order: vis($("endCharge")) && vis($("endHome")) && $("endCharge").getBoundingClientRect().bottom <= $("endHome").getBoundingClientRect().top };
});
const neverDown = (list) => list.every((n, i) => i === 0 || n >= list[i - 1]);
const rowSaid = (n) => (n === 1 ? "1 fruit" : n + " fruit in a row");
const end = async (page) => { await page.evaluate(() => endRound()); await page.locator("#endOvl.show").waitFor(); return best(page); };
// a round stopped before the giant still ends on a win
// the two win titles: neither carries a number (the row under it is the only count on the card)
const WIN = /^(You sliced the giant watermelon!|I saw the fruit fly! So fun!)$/;

await scenario("a whole round", async () => {
  const { context, page, errors } = await open();
  try {
    await page.evaluate(() => { WAVES[0].every = 450; });
    ok("wave 1 opens with its banner and asks for no mic while it plays",
      /Wave 1/.test(await page.locator("#bnBig").textContent()) && /Slice 6 fruit/.test(await page.locator("#bnSmall").textContent()) && (await st(page)).mics === 0);
    // the stand's five, in its order, are the first five thrown
    const thrown = await page.evaluate(() => new Promise((done) => { const seen = []; const iv = setInterval(() => { fruits.forEach((q) => { if (!q.seen) { q.seen = 1; seen.push(q.e); } }); if (seen.length >= 5) { clearInterval(iv); done(seen.slice(0, 5)); } }, 30); }));
    ok("the five fruit the stand held are the first five thrown, in its order", JSON.stringify(thrown) === JSON.stringify(["🍉", "🍇", "🍊", "🍓", "🍋"]), thrown);
    // misses: let them fall
    await page.waitForFunction(() => missRun >= 2, null, { timeout: 15000 });
    let s = await st(page);
    ok("a missed fruit just falls: no card, nothing lost, the game plays on", !s.card && s.playing && s.phase === "wave" && s.REV === 3 && s.mics === 0, s);
    let b = await best(page);
    ok("the top-left number counts fruit in a row, and with nothing sliced yet it is 0", b.on === 0 && b.row === 0 && b.pill === "0" && b.label === "Fruit in a row: 0", b);
    await page.waitForFunction(() => fruits.some((q) => q.g < G && q.r >= 41), null, { timeout: 8000 });
    ok("after two misses in a row the next fruit comes bigger and slower", true);
    // slice through wave 1
    ok("slicing six fruit finishes wave 1", await sliceUntil(page, () => phase !== "wave"));
    b = await best(page);
    ok("every fruit sliced is one on the row: the number is the round's longest row, and it only ever climbed", b.row >= 1 && b.row <= b.score && b.on <= b.row && b.pill === String(b.row) && b.label === "Fruit in a row: " + b.row && neverDown(b.pills), b);
    await page.locator("#revOvl.show").waitFor({ timeout: 12000 });
    s = await st(page);
    ok("…then the say-it card asks for the sound for wave 2", /^Say “rrrr” for wave 2!$/.test(s.title) && s.wave === 0 && !s.playing, s);
    ok("…with wave 1 ticked on the card", (await page.locator("#revHearts .wdot.on").count()) === 1 && (await page.locator("#revHearts .wdot").count()) === 3);
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 12000 });
    ok("the card's mic opens only after the wave's cheer, never during play", (await page.evaluate(() => __f.mics)) === 1);
    const atCard = await best(page);
    await heard(page);
    s = await st(page);
    ok("the child's sound starts wave 2, and the mic is closed again", s.wave === 1 && s.phase === "wave" && s.playing && !s.card && s.REV === 2 && s.live === 0, s);
    b = await best(page);
    ok("the row carries on from wave to wave: the say-it card between them neither breaks it nor adds to it", atCard.on >= 1 && b.on === atCard.on && b.row === atCard.row && b.pill === atCard.pill, { atCard: atCard.on, on: b.on });
    // a golden fruit counts three
    const dim = await page.evaluate(() => ({ W, H }));
    const before = await page.evaluate(() => ({ score, waveGot }));
    await page.evaluate(() => { fruits.push({ e: "🍊", gold: true, x: W / 2, y: H * 0.45, g: 0, vx: 0, vy: 0, r: 40, rot: 0, vr: 0, sliced: false }); });
    await page.mouse.move(dim.W / 2 - 90, dim.H * 0.45 - 20); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(dim.W / 2 - 90 + i * 30, dim.H * 0.45 - 20 + i * 7);
    await page.mouse.up();
    const after = await page.evaluate(() => ({ score, waveGot }));
    ok("a golden fruit counts three, toward the wave too", after.score - before.score >= 3 && after.waveGot - before.waveGot >= 3, { before, after });
    ok("…and says so without a sum: \u201CGOLDEN!\u201D, never \u201C+3\u201D", (await best(page)).flash === "GOLDEN!");
    // a wave that runs long ends anyway: nobody is stuck in one
    await page.evaluate(() => { WAVE_CAP_MS = 700; });
    await page.locator("#revOvl.show").waitFor({ timeout: 12000 });
    s = await st(page);
    ok("a wave ends at its time limit whatever the count, and wave 3 is asked for", s.wave === 1 && /for wave 3!$/.test(s.title), s);
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 12000 });
    await heard(page);
    // wave 3 ends: no card this time, the giant comes straight in
    await page.waitForFunction(() => phase === "finale" && giant && giant.y <= giant.ty + giant.r * 0.6, null, { timeout: 12000 });
    s = await st(page);
    ok("after wave 3 the giant watermelon comes straight in, with no card", !s.card && s.mics === 2 && s.REV === 1, s);
    ok("…and the top of the screen counts its five cuts", /Giant/.test(await page.locator("#timer").innerText()) && (await page.locator("#timer .notch i").count()) === 5);
    // nothing left in the air, so the only thing the next swipes can slice is the giant
    await page.evaluate(() => { fruits.length = 0; });
    const atGiant = await best(page);
    for (let cut = 0; cut < 5; cut++) {
      const g = await page.evaluate(() => giant ? { x: giant.x, y: giantY(), r: giant.r } : null);
      if (!g) break;
      await page.mouse.move(g.x - g.r - 50, g.y - 30 + cut * 12); await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(g.x - g.r - 50 + i * (2 * g.r + 100) / 8, g.y - 30 + cut * 12 + i * 4);
      await page.mouse.up(); await page.waitForTimeout(260);
      if (cut === 1) ok("each swipe across the giant is one cut", (await page.evaluate(() => giant && giant.cuts)) === 2);
    }
    ok("the fifth cut bursts it: the round is won", await page.evaluate(() => phase === "done" && finaleDone === true && giant === null));
    await page.locator("#endOvl.show").waitFor({ timeout: 4000 });
    ok("…and the end card says so", /You sliced the giant watermelon!/.test(await page.locator("#endTitle").innerText()));
    b = await best(page);
    ok("the giant watermelon is one fruit on the row, however many cuts it took", b.on === atGiant.on + 1 && b.score === atGiant.score + 5, { atGiant: atGiant.on, on: b.on });
    ok("a first ever round just sets the best, on one line under the win: \u201CN fruit in a row. Your best: N!\u201D", b.title === "You sliced the giant watermelon!" && b.sub === rowSaid(b.row) + ". Your best: " + b.row + "!", b);
    ok("…and \u201CNew best!\u201D is never said during a first ever round, and the number never went down", b.said.length === 0 && neverDown(b.pills) && b.pill === String(b.row), b);
    ok("the phone keeps it as this child's best, and the old shared best is never written", b.stored === b.row && b.old === null, b);
    ok("the top button is Play again, with Back home under it", b.top === "Play again" && b.home === "Back home" && b.again === null && b.order, b);
    ok("the earned turn is spent once the round ends", await page.evaluate(() => sessionStorage.getItem("sona.play.active") === null && sessionStorage.getItem("sona.play.token") === null));
    const sfx = await page.evaluate(() => __f.sfx);
    ok("no sound ever played while the card's mic was open", sfx.length > 0 && sfx.every((c) => !c.live), sfx.filter((c) => c.live));
    ok("the game's own sounds were heard: slices, the giant's cuts and its burst",
      ["swish", "splat", "giant", "complete"].every((n) => sfx.some((c) => c.name === n)), [...new Set(sfx.map((c) => c.name))]);
    const went = page.waitForRequest((r) => r.isNavigationRequest() && r.frame() === page.mainFrame(), { timeout: 3000 }).then((r) => r.url(), () => null);
    await page.locator("#endCharge").click();
    ok("Play again is earned like every turn: back through this game's say-it-five-times page", (await went) === BASE + "/charge.html?game=arcade-slice.html", await went);
    ok("a whole round: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── a drop, and Super Slice's extras ──
// On a board the test owns, so every count is exact. (Super Slice is switched
// on here by its own clock; earning it by voice is superslicetest's.)
await scenario("a drop, and Super Slice", async () => {
  const { context, page, errors } = await open();
  try {
    await page.evaluate(() => { WAVES[0].goal = 99; });   // the wave must not end under the test
    await quiet(page);
    await sliceNew(page); await sliceNew(page);
    let b = await best(page);
    ok("two fruit sliced, none dropped: 2 in a row", b.on === 2 && b.row === 2 && b.pill === "2" && b.label === "Fruit in a row: 2" && b.waveGot === 2 && b.score === 2, b);
    await dropOne(page);
    b = await best(page);
    ok("a fruit that hits the ground ends the row they are on, and the top-left number does not go down", b.on === 0 && b.row === 2 && b.pill === "2" && b.missRun === 1, b);
    await sliceNew(page);
    b = await best(page);
    ok("the next fruit starts a new row at 1, and the number still shows the round's longest", b.on === 1 && b.row === 2 && b.pill === "2", b);
    await sliceNew(page); await sliceNew(page);
    b = await best(page);
    ok("passing the round's longest row moves the number again", b.on === 3 && b.row === 3 && b.pill === "3" && b.pills.join() === "1,2,3", b);
    await sliceNew(page, {}, 2);
    b = await best(page);
    ok("the row they are on is flashed every fifth fruit, in the win card's words: \u201C5 in a row!\u201D", b.on === 5 && b.flash === "5 in a row!", b);
    // Super Slice
    const w0 = b.waveGot;
    const tossed = await page.evaluate(() => { slowTotal = slowMs = 10000; fruits = []; toss(); const out = fruits.map((f) => !!f.extra); fruits.forEach((f) => { f.x = W / 2; f.y = H * 0.45; f.vx = 0; f.vy = 0; f.g = 1e-9; f.gold = false; }); return out; });
    ok("every fruit thrown during Super Slice is an extra", tossed.length >= 2 && tossed.every(Boolean), tossed);
    await sliceNew(page, {}, 0);   // one swipe through the fruit the stand just threw
    b = await best(page);
    ok("slicing an extra adds to the row, and nothing to the wave", b.on === 5 + tossed.length && b.row === b.on && b.pill === String(b.on) && b.waveGot === w0, { tossed: tossed.length, ...b });
    const on = b.on;
    await sliceNew(page, { extra: true, gold: true });
    b = await best(page);
    ok("a golden extra is one fruit on the row, and still nothing toward the wave", b.on === on + 1 && b.waveGot === w0 && b.flash === "GOLDEN!", b);
    await dropOne(page, { extra: true });
    await dropOne(page);   // an ordinary fruit, thrown before the power, landing while it lasts
    b = await best(page);
    ok("nothing dropped during Super Slice breaks the row, or feeds the two-miss help", b.on === on + 1 && b.row === on + 1 && b.missRun === 0, b);
    await page.evaluate(() => { slowMs = 0; });
    await dropOne(page, { extra: true });
    b = await best(page);
    ok("an extra still in the air when Super Slice ends costs nothing either: an extra can only help", b.on === on + 1 && b.missRun === 0, b);
    const plain = await page.evaluate(() => { fruits = []; toss(); const out = fruits.map((f) => !!f.extra); fruits = []; return out; });
    ok("once it is over, the stand throws ordinary fruit again", plain.length >= 1 && plain.every((x) => !x), plain);
    await sliceNew(page);
    b = await best(page);
    ok("…which count toward the wave as they always did", b.waveGot === w0 + 1 && b.on === on + 2, b);
    await dropOne(page);
    b = await best(page);
    ok("…and an ordinary drop ends the row again, the number staying at its highest", b.on === 0 && b.row === on + 2 && b.pill === String(on + 2) && b.missRun === 1 && neverDown(b.pills), b);
    // the wave's time limit, in Super Slice: real seconds, not the slowed clock
    const t = await page.evaluate(() => new Promise((done) => {
      fruits = []; slowTotal = slowMs = 10000; waveMs = 0; wavePlay = 0; nextToss = 1e9; WAVE_CAP_MS = 1500;
      const t0 = performance.now(); (function w() { if (phase !== "wave") return done({ real: performance.now() - t0, clock: waveMs }); setTimeout(w, 20); })();
    }));
    ok("a wave's time limit is real seconds of play, even while Super Slice slows its clock: no round runs forever", t.real >= 1350 && t.real < 2600 && t.clock < t.real * 0.7, t);
    ok("a drop, and Super Slice: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── passing the best mid-round ──
// A child who came in with a best of 3 (and the old shared number, 40, still
// on the phone: it must not be read). The fourth fruit in a row passes it.
await scenario("passing the best", async () => {
  const { context, page, errors } = await open({ best: 3, old: "40" });
  try {
    await page.evaluate(() => { WAVES[0].goal = 99; });
    await quiet(page);
    ok("the game opens on this child's own best, not the old shared one", (await page.evaluate(() => startBest)) === 3 && (await best(page)).stored === 3);
    await sliceNew(page); await sliceNew(page); await sliceNew(page);
    let b = await best(page);
    ok("level with the best is not past it: no banner yet, nothing new kept", b.row === 3 && b.said.length === 0 && b.stored === 3, b);
    await sliceNew(page);
    b = await best(page);
    ok("the moment the row passes their best, the banner says \u201CNew best!\u201D", b.row === 4 && b.said.length === 1 && b.said[0][0] === "New best!" && b.said[0][1] === "4 fruit in a row" && (await page.locator("#bnBig").textContent()) === "New best!", b);
    ok("…and it is kept at once, so a round the phone kills half way still counts", b.stored === 4, b);
    await sliceNew(page, {}, 2);
    b = await best(page);
    ok("one swipe through two fruit steps over five, and the flash says the row as it stands: \u201C6 in a row!\u201D", b.on === 6 && b.flash === "6 in a row!", b);
    await dropOne(page);
    await sliceNew(page); await sliceNew(page);
    b = await end(page);
    ok("\u201CNew best!\u201D was said once in the round, not at every fruit after it", b.said.length === 1 && b.row === 6 && b.on === 2 && b.pills.join() === "1,2,3,4,6", b);
    ok("stopping early is still a win, its title carries no second count, and the line says \u201C6 fruit in a row. A new best!\u201D", b.title === "I saw the fruit fly! So fun!" && !/\d/.test(b.title) && b.sub === "6 fruit in a row. A new best!", b);
    ok("the new best is kept, and the old shared number is left exactly as it was", b.stored === 6 && b.old === "40", b);
    ok("passing the best: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// a best passed on a wave's last fruit: the wave's own banner waits for it
await scenario("a new best on the wave's last fruit", async () => {
  const { context, page, errors } = await open({ best: 1 });
  try {
    await page.evaluate(() => { WAVES[0].goal = 2; });
    await quiet(page);
    await sliceNew(page); await sliceNew(page);
    ok("the second fruit passes the best and finishes the wave", await page.evaluate(() => phase === "break" && rowBest === 2) && (await page.locator("#bnBig").textContent()) === "New best!");
    await page.waitForTimeout(1300);
    ok("\u201CNew best!\u201D is still up when the wave's own cheer would have covered it", (await page.locator("#bnBig").textContent()) === "New best!");
    await page.waitForFunction(() => document.getElementById("bnBig").textContent === "Wave 1 done!", null, { timeout: 4000 });
    await page.locator("#revOvl.show").waitFor({ timeout: 6000 });
    ok("…then the wave is cheered and the say-it card comes, as ever", /for wave 2!$/.test(await page.locator("#revTitle").textContent()));
    ok("the wave's end keeps the best", (await best(page)).stored === 2);
    ok("a new best on the wave's last fruit: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// the giant can pass the best too: its own banner and the win card say it
await scenario("the giant passes the best", async () => {
  const { context, page, errors } = await open({ best: 2 });
  try {
    await page.evaluate(() => { WAVES[0].goal = 99; });
    await quiet(page);
    await sliceNew(page); await sliceNew(page);
    await page.evaluate(() => { startFinale(); });
    await page.waitForFunction(() => giant && giant.y <= giant.ty + giant.r * 0.6, null, { timeout: 8000 });
    for (let cut = 0; cut < 5; cut++) {
      const g = await page.evaluate(() => giant ? { x: giant.x, y: giantY(), r: giant.r } : null);
      if (!g) break;
      await page.mouse.move(g.x - g.r - 50, g.y - 30 + cut * 12); await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(g.x - g.r - 50 + i * (2 * g.r + 100) / 8, g.y - 30 + cut * 12 + i * 4);
      await page.mouse.up(); await page.waitForTimeout(260);
    }
    await page.locator("#endOvl.show").waitFor({ timeout: 4000 });
    const b = await best(page);
    ok("a best passed by the giant leaves its own banner alone (\u201CYou did it!\u201D), and the win card says it: \u201C3 fruit in a row. A new best!\u201D",
      b.row === 3 && b.said.length === 0 && (await page.locator("#bnBig").textContent()) === "You did it!" && b.title === "You sliced the giant watermelon!" && b.sub === "3 fruit in a row. A new best!" && b.stored === 3, b);
    ok("the giant passes the best: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── under the best: an invitation, and a brother or sister starts empty ──
await scenario("under the best", async () => {
  const { context, page, errors } = await open({ best: 9 });
  try {
    await page.evaluate(() => { WAVES[0].goal = 99; });
    await quiet(page);
    for (let i = 0; i < 4; i++) await sliceNew(page);
    let b = await end(page);
    ok("under the best the win still says they won, then invites: \u201C4 fruit in a row. Your best: 9. 5 away!\u201D", WIN.test(b.title) && b.sub === "4 fruit in a row. Your best: 9. 5 away!", b);
    ok("…nothing was said about a new best, and their best did not move", b.said.length === 0 && b.stored === 9, b);
    ok("…and the top button is Play again, with Back home under it", b.top === "Play again" && b.home === "Back home" && b.order, b);
    // a sister on the same phone: her own game, her own best
    await page.evaluate(() => { Sona.addKid("Nora", "6"); Sona.saveProfile(Object.assign(Sona.getProfile(), { onboarded: true, focusSounds: ["S"] })); });
    await page.goto(BASE + "/arcade-slice.html?from=charge");
    await ready(page);
    ok("a sister opens the game with no best at all", (await page.evaluate(() => startBest)) === 0 && (await best(page)).stored === 0);
    await page.evaluate(() => { WAVES[0].goal = 99; });
    await quiet(page);
    await sliceNew(page); await sliceNew(page);
    b = await end(page);
    ok("her card is a first ever round: \u201C2 fruit in a row. Your best: 2!\u201D, with no word of her brother's 9", b.sub === "2 fruit in a row. Your best: 2!" && b.said.length === 0 && !/9/.test(b.title + b.sub), b);
    const two = await page.evaluate(() => { const hers = Sona.gameBest("slice"); Sona.switchKid(""); return { hers, his: Sona.gameBest("slice") }; });
    ok("each child keeps their own", two.hers === 2 && two.his === 9, two);
    ok("under the best: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── level with the best, a long way under it, and one fruit ──
await scenario("level with the best", async () => {
  const { context, page, errors } = await open({ best: 3 });
  try {
    await page.evaluate(() => { WAVES[0].goal = 99; });
    await quiet(page);
    for (let i = 0; i < 3; i++) await sliceNew(page);
    const b = await end(page);
    ok("level with their best is said kindly, with no \u201Caway\u201D: \u201C3 fruit in a row. The same as your best!\u201D", WIN.test(b.title) && b.sub === "3 fruit in a row. The same as your best!" && b.said.length === 0 && b.stored === 3, b);
    ok("level with the best: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});
// a long way under the best the card names the best and leaves the gap unsaid:
// "5 away!" is a dare, "37 away!" is how far short they fell
await scenario("a long way under the best", async () => {
  const { context, page, errors } = await open({ best: 38 });
  try {
    await quiet(page);
    await sliceNew(page);
    const b = await end(page);
    ok("a long way under, the line names their best and no gap, and one fruit is not called a row: \u201C1 fruit. Your best: 38.\u201D", b.title === "I saw the fruit fly! So fun!" && b.sub === "1 fruit. Your best: 38." && b.stored === 38 && (await page.evaluate(() => AWAY_NEAR)) === 10, b);
    ok("a long way under the best: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});
await scenario("nothing sliced", async () => {
  const { context, page, errors } = await open({ best: 12 });
  try {
    await quiet(page);
    const b = await end(page);
    ok("a round with nothing sliced keeps its own kind card, with no line about a best at all", b.title === "Good try! Wanna go again?" && b.sub === null && b.again === "Yes! Play again" && b.top === null && b.stored === 12, b);
    ok("nothing sliced: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── a phone still holding an older sona.js: the game plays, without a best ──
await scenario("an older sona.js", async () => {
  const { context, page, errors } = await open({ noStore: true, best: 38 });
  try {
    await page.evaluate(() => { WAVES[0].goal = 99; });
    await quiet(page);
    for (let i = 0; i < 3; i++) await sliceNew(page);
    const b = await end(page);
    ok("with no store for bests the round still plays and ends on its win, saying only what happened: \u201C3 fruit in a row.\u201D", b.row === 3 && b.pill === "3" && WIN.test(b.title) && b.sub === "3 fruit in a row." && b.top === "Play again", b);
    ok("an older sona.js: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── the old five-game run still banks the round, in words a child may read ──
// Home no longer opens it, but a saved run and a typed address do. Its card
// said "+7 points!" and "Banking your score…".
await scenario("the old run's card", async () => {
  const { context, page, errors } = await open({ daily: true });
  try {
    await page.evaluate(() => { WAVES[0].goal = 99; });
    await quiet(page);
    for (let i = 0; i < 3; i++) await sliceNew(page);
    const went = page.waitForRequest((r) => r.isNavigationRequest() && r.frame() === page.mainFrame(), { timeout: 4000 }).then((r) => r.url(), () => null);
    await page.evaluate(() => endRound());
    const b = await best(page);
    ok("the old run's card says \u201CGreat round!\u201D, never points or a score", b.shown && b.title === "Great round!" && b.sub === "On to the next game\u2026" && !/points?|scores?/i.test(b.title + b.sub) && b.top === null && b.home === null, b);
    ok("…and still banks the round and moves the run on by itself", /\/charge\.html\?daily=1&banked=3$/.test((await went) || ""), await went);
    ok("the old run's card: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await browser.close(); await new Promise((r) => server.close(r));
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
