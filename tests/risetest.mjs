// RISE1: Rise Up, the sixth round game (Travis, 9 Oct 2026: "lets build the
// game rise up", after the hit phone game). A balloon floats up through the
// garden, the clouds and the stars; toy blocks fall toward it, and the child
// drags a round shield to push them out of the way. It is Flappy Glide's
// round, as a climb: three stretches of play, the say-it card between them,
// three hearts on the shared rules, and at the top five clouds to push away
// (they drift off by themselves) before the balloon floats up to a big star.
// The finger only moves the shield, by as much as it moves, and the shield
// can never cover the balloon or cost a heart.
//
// This plays it on a fake phone. The say-it card's own listening is
// micquietgamestest's and sayitcardtest's (every round game shares it), and
// Echo's mid-round ask is arcadespeechhelptest's; here a heard child is the
// card's own success path, closeReviveMic() then doRevive().
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from "./_env.mjs";

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT, PORT = 8269, BASE = "http://127.0.0.1:" + PORT;
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2", mp3: "audio/mpeg", wav: "audio/wav" };
const server = createServer((req, res) => {
  const u = new URL(req.url, BASE), f = path.join(ROOT, u.pathname);
  if (u.pathname.startsWith("/api/")) { res.writeHead(503); res.end("{}"); return; }
  if (!existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[f.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(detail))); }
async function scenario(name, fn) { if (process.env.ARCADE_LIVES_ONLY && name !== "hearts, pace and best") return; try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, e.stack); } }
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
// what a child must never read: the end card counts a real thing
const BANNED = /\b(score|points?|high score|you missed|game over)\b/i;
const BANNED_SEEN = /\b(score|points?|high score|you missed|game over|charge)\b/i;

// ── the code: a climb, not a practice ──
const PAGE = readFileSync(ROOT + "/arcade-rise.html", "utf8"), code = strip(PAGE);
const BOARD = readFileSync(ROOT + "/rise.js", "utf8"), board = strip(BOARD);
const scripts = [...code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
await scenario("source pins", async () => {
  ok("three stretches: the garden 28 s, the clouds 32 s, the stars 36 s, each a little faster and (from the clouds) with a breeze",
    code.includes('var STRETCHES=[{name:"Garden",len:28000,every:2600,speed:1,sway:0},{name:"Clouds",len:32000,every:2400,speed:1.1,sway:0.16},{name:"Stars",len:36000,every:2200,speed:1.2,sway:0.22}];'));
  ok("only the rest between stretches asks for the sound", /sayCard\("Say \\u201C"\+SAYTXT\+"\\u201D to rise higher!","none"\)/.test(code));
  ok("the sound power is the shared helper's: first ask after six seconds, eight seconds of help (no ms set), and no heart back (a new life only on a loss)",
    PAGE.includes('<script>window.SLOW_HELP={phase:"climb",action:"slow the falling blocks",earned:"Slow blocks!",first:6000};</script>')
    && !/SLOW_HELP=\{[^}]*\bms:/.test(code) && /src="\/arcade-speech-help\.js"/.test(code) && /src="\/arcade-sayit\.js"/.test(code) && /src="\/rise\.js"/.test(code));
  ok("nothing in the climb is practice data", !/logAttempt|bumpReps|recordSession|recordRung|rotAdvance|repsBeacon/.test(code + board));
  // the one place the page asks for the mic: the say-it card (and Echo's turn through it)
  const at = code.indexOf("function openReviveMic(){");
  let body = "";
  if (at >= 0) { let depth = 0, i = code.indexOf("{", at); for (let j = i; j < code.length; j++) { if (code[j] === "{") depth++; else if (code[j] === "}") { depth--; if (!depth) { body = code.slice(at, j + 1); break; } } } }
  ok("the page asks for the mic in one place only: inside openReviveMic()", (code.match(/getUserMedia\(/g) || []).length === 1 && (body.match(/getUserMedia\(/g) || []).length === 1);
  ok("the board never asks for the mic", !/getUserMedia/.test(board));
  ok("Rise Up keeps each child's best of blocks pushed through the shared store, and the board never touches it", /S\.gameBest\("rise"\)/.test(code) && /S\.gameBestOffer\("rise",pushed\)/.test(code) && !/gameBest|sona\.best/.test(board));
  ok("out of hearts, the climb stops on the new-life card (lifeOrEnd), and a heard one fills all three hearts (lifeTaken)", /if\(lifePending\)\{ lifePending=false; lifeOrEnd\(\); \}/.test(code) && /var life=lifeTaken\(\); if\(life\)\{ hearts=HEART_MAX; outOfHearts=false; paintHearts\(\); \}/.test(code) && /lifeCard\?LIFE_LINE:SayIt\.ASK/.test(code));
  ok("no coins from the climb: coins come from the chest and the Trophy Road only", !/addCoins/.test(code + board));
  ok("the board touches no storage, sound or network, never clears the canvas, and is ES5",
    !/localStorage|sessionStorage|AudioContext|new Audio|fetch\(|clearRect/.test(board) && !/=>|`/.test(board));
  ok("neither file speaks for itself: no voice service, no robot voice, no old demo clip",
    !/\/api\/tts|SpeechSynthesisUtterance|-demo\.mp3/.test(code + board) && !/(^|[^.\w$])(say|speak|speakNow)\(/m.test(scripts + "\n" + board));
  ok("the page clears the canvas exactly once a frame", (code.match(/ctx\.clearRect\(/g) || []).length === 1);
  // every quoted string in either script, ids aside (the count pill's own id is "score")
  const ids = new Set([...PAGE.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const literals = [...(scripts + "\n" + board).matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1] != null ? m[1] : m[2]).filter((s) => !ids.has(s));
  const markupText = code.replace(/<script\b[\s\S]*?<\/script>/g, "").replace(/<style\b[\s\S]*?<\/style>/g, "").replace(/<[^>]*>/g, " ");
  const said = literals.filter((s) => BANNED.test(s)).concat(BANNED.test(markupText) ? [markupText.match(BANNED)[0]] : []);
  ok("no word a child reads says score, points, high score, you missed or game over", literals.length > 50 && said.length === 0, said);
});

// ── a fake phone: a mic that hears silence, audio that records what plays ──
function fakePhone(cfg = {}) {
  // Echo's mid-round ask for the sound power is arcadespeechhelptest's: held
  // here, so a round is just the round.
  document.addEventListener("DOMContentLoaded", () => { if (window.SLOW_ASK) { SLOW_ASK.first = SLOW_ASK.every = SLOW_ASK.quiet = SLOW_ASK.soon = 1e12; window.slowAskAt = 1e12; } });
  const f = window.__f = { mics: 0, live: 0, sfx: [], practice: [], hidden: false };
  Object.defineProperty(document, "hidden", { configurable: true, get: () => f.hidden });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (f.hidden ? "hidden" : "visible") });
  f.hide = () => { f.hidden = true; document.dispatchEvent(new Event("visibilitychange")); };
  f.show = () => { f.hidden = false; document.dispatchEvent(new Event("visibilitychange")); };
  navigator.mediaDevices.getUserMedia = () => {
    f.mics++; f.live++;
    const t = { readyState: "live", stop() { if (this.readyState === "live") { this.readyState = "ended"; f.live--; } } };
    return Promise.resolve({ getTracks: () => [t], getAudioTracks: () => [t] });
  };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
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
  // Echo's lead-in and Rachel's sound clip end at once (a slow runner held
  // the card's mic back past the test's patience with real playback)
  window.Audio = function (src) { const a = { src, volume: 1, paused: false, play() { setTimeout(() => { if (a.onended) a.onended(); }, 20); return Promise.resolve(); }, pause() { a.paused = true; }, removeAttribute() {}, load() {} }; return a; };
  // every Sona sound, with whether a mic was live as it started; confetti
  // counted; every practice write logged
  let sona;
  Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set: (v) => { sona = v;
    const cf = v.confetti; v.confetti = function () { f.confetti = (f.confetti || 0) + 1; if (cf) return cf.apply(this, arguments); };
    for (const k of ["logAttempt", "bumpReps", "recordSession", "recordRung", "rotAdvance", "repsBeacon"]) { const real = v[k]; v[k] = function () { f.practice.push(k); return real ? real.apply(this, arguments) : undefined; }; }
    const sfx = v.sfx || {}; v.sfx = new Proxy(sfx, { get(t, k) { const real = t[k]; if (typeof real !== "function" || k === "stop") return real; return function () { f.sfx.push({ name: k, live: f.live > 0 }); return real.apply(this, arguments); }; } }); } });
  if (sessionStorage.getItem("sona.test.seeded")) return;
  sessionStorage.setItem("sona.test.seeded", "1");
  localStorage.setItem("sona.freeera.v1", "post"); ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true, voiceOn: false, soundOn: true, volume: 0.6 }));
  localStorage.setItem("sona.bests.v1", JSON.stringify({ glide: { n: 4, at: "2026-10-01" } }));
  sessionStorage.setItem("sona.play.token", "arcade-rise.html");
}
async function open(cfg = {}, size = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport: size, reducedMotion: "reduce" });
  let blocked = 0;
  await context.route("**/*", (r) => (r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort()));
  // registered last, so it runs first: every Rise Up picture (and the cloud
  // and the star it reuses) fails to load
  if (cfg.noArt) for (const p of ["**/assets/crafted/game/rise-*", "**/game/cloud.webp", "**/game/star.webp"]) await context.route(p, (r) => { blocked++; return r.abort(); });
  await context.addInitScript(fakePhone, cfg);
  // a whole round on a fake clock, with the same blocks every time
  if (cfg.clock) await context.addInitScript(() => { let a = 20261009; Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  if (cfg.clock) await page.clock.install();
  await page.goto(BASE + "/arcade-rise.html?from=charge");
  if (cfg.clock) await page.clock.runFor(200);
  await page.waitForFunction(() => window.gameEntryAllowed === true && typeof startStretch === "function");
  return { context, page, errors, blocked: () => blocked };
}
const st = (page) => page.evaluate(() => ({ phase, stage, pushed, bumps, hearts, REV, playing, card: document.getElementById("revOvl").classList.contains("show"),
  title: document.getElementById("revTitle").textContent, big: document.getElementById("bnBig").textContent, ended: !!window.__ended, mics: __f.mics, live: __f.live }));
const heard = (page) => page.evaluate(() => { closeReviveMic(); doRevive(); });
// climb the rest of this stretch at once
const nearEnd = (page) => page.evaluate(() => { Rise.clear(); climbMs = STRETCHES[stage].len - 100; });
// a quiet board: what is falling is only what the test puts there
const calm = (page) => page.evaluate(() => { Rise.clear(); spawnMs = 0; spawnEvery = 1e9; });
const centre = (page) => page.evaluate(() => { const b = Rise.shieldBox(), s = Rise.shield; s.x = s.tx = W / 2; s.y = s.ty = (b.y0 + b.y1) / 2; });
const shieldAt = (page) => page.evaluate(() => ({ x: Rise.shield.x, y: Rise.shield.y, tx: Rise.shield.tx, ty: Rise.shield.ty }));
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { let k = 0; (function f() { if (++k > n) r(); else requestAnimationFrame(f); })(); }), n);
const near = (a, b, d = 1) => Math.abs(a - b) <= d;

// ── fit: a small phone to an iPad ──
for (const size of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 1366 }]) {
  await scenario("fit " + size.width + "x" + size.height, async () => {
    const { context, page, errors } = await open({}, size);
    try {
      const fit = await page.evaluate(() => {
        const d = document.documentElement, top = document.getElementById("top").getBoundingClientRect(), hs = document.getElementById("gameHearts").getBoundingClientRect();
        const app = document.getElementById("app").getBoundingClientRect(), b = Rise.shieldBox(), bl = Rise.balloon, U = Rise.U;
        const clamp = (v, a, c) => Math.min(c, Math.max(a, v));
        pacePlay = 0; const clearView = Math.max(120, (bl.y - bl.r) - Rise.BAND), secs = clearView / (fallNow() * 60);
        return { scroll: d.scrollWidth <= innerWidth && d.scrollHeight <= innerHeight, hearts: hs.left >= top.left && hs.right <= top.right && hs.top >= top.top && hs.bottom <= top.bottom && hs.width > 0,
          balloon: bl.x - bl.r >= 0 && bl.x + bl.r <= W && bl.y - bl.r >= Rise.HUDB && bl.y + bl.r <= H, clearOfBalloon: b.y1 + Rise.shield.r < bl.y - bl.hitR, belowEcho: b.y0 >= Rise.BAND,
          beside: Math.abs(Rise.shield.x - bl.x) >= Rise.shield.r + 4 + 1.4 * Rise.s && Rise.shield.x >= b.x0 && Rise.shield.x <= b.x1,
          secs, sizes: Math.abs(bl.r - clamp(0.085 * U, 22, 46)) < 0.01 && Math.abs(Rise.shield.r - clamp(0.11 * U, 28, 56)) < 0.01 && Math.abs(Rise.s - clamp(0.13 * U, 32, 66)) < 0.01 && Math.abs(bl.hitR - 0.8 * bl.r) < 0.01,
          Rb: bl.r, Rs: Rise.shield.r, s: Rise.s, W, appW: app.width };
      });
      const tag = size.width + "x" + size.height;
      ok(tag + ": no page scroll either way", fit.scroll, fit);
      ok(tag + ": the three hearts sit inside the top bar", fit.hearts, fit);
      ok(tag + ": the balloon is fully on screen, below the top bar", fit.balloon, fit);
      ok(tag + ": the lowest the shield can go still leaves air above the balloon, and it never rises behind Echo's button", fit.clearOfBalloon && fit.belowEcho, fit);
      ok(tag + ": a block takes about 3.4 seconds to cross the open sky at the start", fit.secs >= 3.3 && fit.secs <= 3.5, fit.secs);
      ok(tag + ": the shield starts beside the balloon, so left where it is it shelters nothing (a block or a bar falling at the middle misses it)", fit.beside, fit);
      ok(tag + ": the balloon, the shield and the blocks are sized to the screen, within their limits", fit.sizes && fit.Rb >= 22 && fit.Rb <= 46 && fit.Rs >= 28 && fit.Rs <= 56 && fit.s >= 32 && fit.s <= 66, fit);
      if (size.width === 1024) ok(tag + ": on an iPad the board is 560 wide, like the other round games", fit.W === 560 && fit.appW === 560, fit);
      ok(tag + ": no runtime errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
}

// ── the finger moves the shield, by as much as it moves ──
await scenario("drag", async () => {
  const { context, page, errors } = await open();
  try {
    await calm(page); await centre(page); await frames(page);
    ok("before any drag the hint says how to play", await page.evaluate(() => getComputedStyle(document.getElementById("tapHint")).display !== "none" && /Drag anywhere/.test(document.getElementById("tapHint").textContent)));
    let a = await shieldAt(page);
    await page.mouse.move(50, 800); await page.mouse.down(); await frames(page);
    let b = await shieldAt(page);
    ok("a finger far from the shield moves nothing: the shield never jumps to it", b.x === a.x && b.y === a.y && b.tx === a.tx && b.ty === a.ty, { a, b });
    await page.mouse.move(90, 770); await frames(page);
    b = await shieldAt(page);
    ok("moving the finger by (+40, -30) moves the shield by the same", near(b.x - a.x, 40) && near(b.y - a.y, -30), { a, b });
    ok("…and the first drag puts the hint away", await page.evaluate(() => dragged && getComputedStyle(document.getElementById("tapHint")).display === "none"));
    await page.mouse.move(380, 770); await frames(page);
    const box = await page.evaluate(() => Rise.shieldBox());
    b = await shieldAt(page);
    ok("past the right edge the shield stops at the edge", near(b.x, box.x1, 0.01) && near(b.tx, box.x1, 0.01), { b, box });
    await page.mouse.move(340, 770); await frames(page);
    b = await shieldAt(page);
    ok("turning back at the edge answers at once (no dead zone)", near(b.x, box.x1 - 40), { b, box });
    await page.mouse.up();
    await centre(page);
    await page.mouse.move(200, 300); await page.mouse.down(); await page.mouse.move(200, 840); await frames(page);
    b = await shieldAt(page);
    ok("dragged down, the shield stops above the balloon", near(b.y, box.y1, 0.01), { b, box });
    await page.mouse.up();
    // two fingers: the newest one down drives; the older one's moves are kept, not used
    await centre(page);
    const two = await page.evaluate(async () => {
      const ev = (type, id, x, y) => document.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: id === 7 }));
      const s = Rise.shield, f = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const x0 = s.x; ev("pointerdown", 7, 100, 500); ev("pointerdown", 8, 300, 500); await f();
      ev("pointermove", 7, 120, 500); await f(); const older = s.x - x0;
      ev("pointermove", 8, 315, 500); await f(); const newest = s.x - x0;
      ev("pointerup", 8, 315, 500); ev("pointermove", 7, 130, 500); await f(); const handed = s.x - x0;
      ev("pointerup", 7, 130, 500);
      ev("pointerdown", 9, 200, 600); ev("pointercancel", 9, 200, 600); const x1 = s.x; ev("pointermove", 9, 260, 600); await f(); const cancelled = s.x - x1;
      ev("pointerdown", 10, 200, 600); __f.hide(); __f.show(); const x2 = s.x; ev("pointermove", 10, 260, 600); await f(); const hidden = s.x - x2;
      return { older, newest, handed, cancelled, hidden };
    });
    ok("two fingers: the older finger's moves are ignored while the newest is down", near(two.older, 0), two);
    ok("…the newest finger drives the shield", near(two.newest, 15), two);
    ok("…and lifting it hands over to the older finger with no jump", near(two.handed, 25), two);
    ok("a cancelled finger and a hidden page let go of the shield", near(two.cancelled, 0) && near(two.hidden, 0), two);
    await centre(page);
    a = await shieldAt(page);
    await page.keyboard.press("ArrowRight"); await frames(page);
    b = await shieldAt(page);
    ok("the arrow keys move it 12 px", near(b.tx - a.tx, 12, 0.01) && near(b.x - a.x, 12, 0.01), { a, b });
    // a finger that lands on a button never drags the shield (no click: one
    // would leave the page, or start Echo's ask)
    const buttons = await page.evaluate(async () => {
      const s = Rise.shield, f = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), out = {};
      for (const id of ["slowKeys", "close"]) {
        const el = document.getElementById(id), x0 = s.x, y0 = s.y;
        el.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 21, pointerType: "touch", clientX: 30, clientY: 30, bubbles: true, cancelable: true }));
        document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 21, pointerType: "touch", clientX: 90, clientY: 80, bubbles: true }));
        document.dispatchEvent(new PointerEvent("pointerup", { pointerId: 21, pointerType: "touch", clientX: 90, clientY: 80, bubbles: true }));
        await f(); out[id] = { dx: s.x - x0, dy: s.y - y0, seen: !!el };
      }
      return out;
    });
    ok("a finger on Echo's button or the ✕ never moves the shield", buttons.slowKeys.seen && buttons.close.seen && near(buttons.slowKeys.dx, 0) && near(buttons.slowKeys.dy, 0) && near(buttons.close.dx, 0) && near(buttons.close.dy, 0), buttons);
    ok("drag: still on the page, no runtime errors", /arcade-rise\.html/.test(page.url()) && errors.length === 0, errors);
  } finally { await context.close(); }
  // an iPad: the board is 560 wide in the middle, and a finger can start in the margin
  const pad = await open({}, { width: 1024, height: 1366 });
  try {
    await calm(pad.page); await centre(pad.page);
    const a = await shieldAt(pad.page), app = await pad.page.evaluate(() => document.getElementById("app").getBoundingClientRect().left);
    await pad.page.mouse.move(40, 700); await pad.page.mouse.down(); await pad.page.mouse.move(80, 690); await frames(pad.page);
    const b = await shieldAt(pad.page); await pad.page.mouse.up();
    ok("on an iPad a drag that starts outside the board, in the margin, still moves the shield", app > 40 && near(b.x - a.x, 40) && near(b.y - a.y, -10), { a, b, app });
    ok("iPad drag: no runtime errors", pad.errors.length === 0, pad.errors);
  } finally { await pad.context.close(); }
});

// ── pushing: what counts ──
await scenario("pushing and the count", async () => {
  const { context, page, errors } = await open();
  try {
    await calm(page); await centre(page); await frames(page);
    // a block that lands on a shield nobody is moving slides off it: that is
    // not a push (an untouched round must never be thanked for pushes)
    const still = await page.evaluate(async () => {
      const s = Rise.shield, p = Rise.add("cube", s.x, s.y - s.r - Rise.s), n = pushed, f = () => new Promise((r) => requestAnimationFrame(r));
      while (!p.loose) await f();
      for (let i = 0; i < 20; i++) await f();
      return { loose: p.loose, counted: p.counted, grace: p.touchAt > -1e8, pushedBefore: n, pushed, shown: document.getElementById("score").textContent };
    });
    ok("a block that lands on a still shield slides off it, uncounted and with no grace: nobody pushed it", still.loose && !still.counted && !still.grace && still.pushed === still.pushedBefore && still.shown === String(still.pushed), still);
    // the finger pushes the shield into a block: that counts
    await calm(page); await centre(page); await frames(page);
    const start = await page.evaluate(() => { const s = Rise.shield, p = Rise.add("cube", s.x - 2.2 * s.r, s.y); window.__p = p; return { pushed, sfx: __f.sfx.length }; });
    await page.mouse.move(300, 760); await page.mouse.down(); await page.mouse.move(230, 760, { steps: 4 }); await frames(page); await page.mouse.up();
    await page.waitForFunction(() => __p.counted, null, { timeout: 4000 });
    await page.waitForFunction((n) => __f.sfx.length > n, start.sfx, { timeout: 2000 });
    const one = await page.evaluate(() => ({ loose: __p.loose, counted: __p.counted, grace: __p.touchAt > -1e8, pushed, shown: document.getElementById("score").textContent, label: document.getElementById("countPill").getAttribute("aria-label"), sfx: __f.sfx.map((c) => c.name) }));
    ok("a block the moving shield runs into is pushed: loose, counted once, the shield's grace, the pill says 1", one.loose && one.counted && one.grace && one.pushed === start.pushed + 1 && one.shown === String(one.pushed) && one.label === "1 block pushed", one);
    ok("…with a small tap", one.sfx.includes("tap"), one.sfx);
    // "Whoosh!" is three DIFFERENT blocks in one push: a fast swipe that keeps
    // catching the same block is still one block (review, 9 Oct 2026)
    await calm(page); await centre(page); await frames(page);
    const fast = await page.evaluate(() => { const s = Rise.shield; window.__one = Rise.add("cube", s.x - 2.2 * s.r, s.y); return { pushed, stars: __f.sfx.filter((c) => c.name === "star").length }; });
    await page.mouse.move(330, 760); await page.mouse.down(); await page.mouse.move(40, 760, { steps: 3 }); await frames(page, 6); await page.mouse.up();
    await page.waitForFunction(() => __one.counted, null, { timeout: 4000 }).catch(() => {});
    const fastAfter = await page.evaluate(() => ({ counted: __one.counted, pushed, stars: __f.sfx.filter((c) => c.name === "star").length, flash: document.body.textContent.indexOf("Whoosh") >= 0 }));
    ok("one block pushed by a fast swipe counts once and is no chain: no Whoosh, no star chime", fastAfter.counted && fastAfter.pushed === fast.pushed + 1 && fastAfter.stars === fast.stars, { fast, fastAfter });
    // a turned iPad: the balloon moves to the new board's height, so the page
    // gives the same 1.5 s of grace as coming back to the front; the top's
    // clouds keep their places inside the new shield area
    const turned = await page.evaluate(() => {
      graceUntil = 0; fit(); const grace = graceUntil > performance.now() + 1000;
      Rise.startPuffs(); Rise.resize(844, 390, Rise.HUDB);
      const b = Rise.shieldBox(), inBox = Rise.puffs.every((f) => f.x > 0 && f.x < 844 && f.ty >= b.y0 - 0.5 && f.ty <= b.y1 + 0.5);
      Rise.puffs.length = 0; fit(); graceUntil = 0;
      return { grace, inBox };
    });
    ok("turning the screen mid-climb gives 1.5 s of grace", turned.grace, turned);
    ok("…and the top's clouds stay inside the turned board", turned.inBox, turned);
    // a block nobody touches falls past the balloon and is gone, uncounted
    await calm(page);
    const before = await page.evaluate(() => { window.__q = Rise.add("cube", W * 0.1, Rise.balloon.y - 40); return pushed; });
    await page.waitForFunction(() => Rise.pieces.indexOf(__q) < 0, null, { timeout: 8000 });
    ok("a block nobody touches falls past and is gone, and counts nothing", await page.evaluate((n) => pushed === n && !__q.counted && hearts === 3, before));
    // a loose block knocks one that is still falling with its group: that one counts too
    await calm(page);
    const chain = await page.evaluate(() => {
      const b = Rise.shieldBox(), s = Rise.shield; s.x = s.tx = b.x1; s.y = s.ty = b.y1;
      const A = Rise.add("cube", W * 0.15, Rise.BAND + 10), B = Rise.add("cube", W * 0.15 + 1.2 * Rise.s, Rise.BAND + 10);
      A.loose = true; A.vx = 4; A.pushAt = performance.now(); window.__A = A; window.__B = B; return pushed;
    });
    await page.waitForFunction(() => __B.loose, null, { timeout: 3000 });
    ok("a block a push just set moving knocks one that was still falling with its group: that one is loose and counted", await page.evaluate((n) => __B.loose && __B.counted && !__A.counted && pushed === n + 1, chain), await page.evaluate(() => ({ pushed, A: __A.counted, B: __B.counted })));
    // …but a loose block nobody pushed passes nothing on
    await calm(page);
    const drift = await page.evaluate(() => {
      const C = Rise.add("cube", W * 0.15, Rise.BAND + 10), D = Rise.add("cube", W * 0.15 + 1.2 * Rise.s, Rise.BAND + 10);
      C.loose = true; C.vx = 4; window.__C = C; window.__D = D; return pushed;
    });
    await page.waitForFunction(() => __D.loose, null, { timeout: 3000 });
    ok("a loose block nobody pushed knocks another: it moves, and nothing counts", await page.evaluate((n) => __D.loose && !__D.counted && pushed === n, drift), await page.evaluate(() => ({ pushed, D: __D.counted })));
    // the shield's grace: a block it just pushed onto the balloon costs nothing
    await calm(page); await centre(page);
    await page.evaluate(() => { const p = Rise.add("cube", Rise.balloon.x, Rise.balloon.y); p.touchAt = performance.now(); window.__g = p; heartHitAt = -1e9; graceUntil = 0; bumps = 0; });
    await page.waitForFunction(() => __g.hit, null, { timeout: 3000 });
    ok("a block the shield pushed in the last 0.6 s bounces off the balloon for free: no bump, no heart", await page.evaluate(() => hearts === 3 && bumps === 0));
    ok("pushing: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── hearts, pace and the best that is not kept yet ──
await scenario("hearts, pace and best", async () => {
  const { context, page, errors } = await open({}, { width: 320, height: 568 });
  try {
    const installed = await page.evaluate(() => typeof hearts !== "undefined" && typeof loseHeart === "function");
    ok("three real hearts are installed", installed); if (!installed) return;
    const s0 = await page.evaluate(() => ({ hearts, speed: speedMul(), play: pacePlay, first: SLOW_HELP.first, off: offNext, log: patternLog.slice() }));
    ok("the opening is gentle: three hearts, the starting speed, Echo's first ask after six seconds, and the first two groups miss",
      s0.hearts === 3 && s0.play < 1000 && s0.speed === 1 && s0.first === 6000 && s0.off + s0.log.length === 2 && s0.log.every((id) => id === "gate" || id === "side"), s0);
    ok("three hearts fit the smallest phone's top bar", await page.evaluate(() => { const top = document.getElementById("top").getBoundingClientRect(), hs = document.getElementById("gameHearts").getBoundingClientRect(); return hs.left >= top.left && hs.right <= top.right && hs.bottom <= top.bottom && document.getElementById("gameHearts").querySelectorAll("svg").length === 3; }));
    await calm(page);
    await page.evaluate(() => { SLOW_ASK.soon = 1500; pacePlay = 40000; heartHitAt = -1e9; graceUntil = 0; offNext = 0; window.__h = Rise.add("cube", Rise.balloon.x, Rise.balloon.y); });
    await page.waitForFunction(() => __h.hit, null, { timeout: 3000 });
    const loss = await page.evaluate(() => { const out = { hearts, bumps, pace: pacePlay, off: offNext, at: slowAskAt - slowAskPlay, label: document.getElementById("gameHearts").getAttribute("aria-label") }; SLOW_ASK.soon = slowAskAt = 1e12; return out; });
    ok("a block on the balloon costs one heart: it eases the pace and the next group misses; Echo's next ask is not brought forward", loss.hearts === 2 && loss.bumps === 1 && loss.pace < 40000 - 29000 && loss.off >= 1 && loss.at > 1500 && loss.label === "2 hearts left", loss);
    await page.evaluate(() => { window.__h2 = Rise.add("cube", Rise.balloon.x, Rise.balloon.y); });
    await page.waitForFunction(() => __h2.hit, null, { timeout: 3000 });
    ok("a second block within 1.5 s cannot take another heart", await page.evaluate(() => hearts === 2 && bumps === 2));
    const guards = await page.evaluate(() => {
      // each guard alone, from a clean slate (a heart one guard let through
      // would hide the next behind the 1.5 s rule)
      const r = {}, fresh = () => { heartHitAt = -1e9; graceUntil = 0; hearts = 2; };
      fresh(); slowMs = 8000; r.power = loseHeart(performance.now()); slowMs = 0;
      fresh(); slowTurn = { finishing: true }; r.asking = loseHeart(performance.now()); slowTurn = null;
      fresh(); __f.hide(); r.hidden = loseHeart(performance.now()); __f.show();
      r.backGrace = graceUntil > performance.now();
      fresh(); graceUntil = performance.now() + 1500; r.grace = loseHeart(performance.now());
      const was = phase; fresh(); phase = "rest"; r.rest = loseHeart(performance.now()); fresh(); phase = "top"; r.top = loseHeart(performance.now()); phase = was;
      fresh(); r.hearts = hearts; r.control = loseHeart(performance.now()); r.after = hearts; fresh(); paintHearts();
      return r;
    });
    ok("no heart is lost while the power is on, while Echo asks or listens, on a hidden page, in the grace after coming back, in a rest or at the top",
      !guards.power && !guards.asking && !guards.hidden && guards.backGrace && !guards.grace && !guards.rest && !guards.top && guards.hearts === 2, guards);
    ok("…and with none of those, the same call does cost one (so the guards are what refused)", guards.control === true && guards.after === 1, guards);
    ok("a heard sound power gives no heart back any more: only the power", await page.evaluate(() => !SLOW_HELP.onHeard && typeof restoreHeart === "undefined"));
    // the last heart: the climb stops on the say-it card for a new life; heard,
    // all three hearts come back and the climb goes on where it stopped
    await calm(page);
    const life0 = await page.evaluate(() => { hearts = 1; heartHitAt = -1e9; graceUntil = 0; slowMs = 0; paintHearts(); window.__lv = Rise.add("cube", Rise.balloon.x, Rise.balloon.y); return { rev: REV, stage, confetti: __f.confetti || 0 }; });
    await page.locator("#revOvl.show").waitFor({ timeout: 4000 });
    const lifeCardSeen = await page.evaluate(() => ({ title: document.getElementById("revTitle").textContent, empty: document.getElementById("revHearts").querySelectorAll("svg").length, playing, life: lifeCard, ended: !!window.__ended }));
    ok("out of hearts, the climb stops on the new-life card, never the end card", /for a new life!/.test(lifeCardSeen.title) && lifeCardSeen.empty === 3 && !lifeCardSeen.playing && lifeCardSeen.life && !lifeCardSeen.ended, lifeCardSeen);
    await page.waitForFunction(() => __f.live >= 1, null, { timeout: 12000 }).catch(() => {});
    await heard(page);
    const life1 = await page.evaluate(() => ({ hearts, playing, phase, stage, rev: REV, out: outOfHearts, confetti: __f.confetti || 0, card: document.getElementById("revOvl").classList.contains("show") }));
    ok("…heard: all three hearts are back and the climb goes on in the same stretch, with no confetti and no between-round card spent", life1.hearts === 3 && life1.playing && life1.phase === "climb" && life1.stage === life0.stage && life1.rev === life0.rev && !life1.out && life1.confetti === life0.confetti && !life1.card, { life0, life1 });
    // two lost hearts in one stretch: the rest of it is easier
    await calm(page);
    const ease = await page.evaluate(async () => {
      const f = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      stretchHits = 0; easy = false; spawnEvery = STRETCHES[0].every; heartHitAt = -1e9;
      const a = Rise.add("cube", Rise.balloon.x, Rise.balloon.y); while (!a.hit) await f();
      const easyAfterOne = easy; heartHitAt = -1e9;
      const b = Rise.add("cube", Rise.balloon.x, Rise.balloon.y); while (!b.hit) await f();
      return { easyAfterOne, easy, every: spawnEvery, base: STRETCHES[0].every, hearts, speed: speedMul() };
    });
    ok("two lost hearts in a stretch make the rest of it easier: slower blocks, further apart", !ease.easyAfterOne && ease.easy && near(ease.every, ease.base * 1.25, 0.01) && ease.hearts === 1 && ease.speed < 1, ease);
    ok("the pace rises with play but never past 1.4 times the start", await page.evaluate(() => { const was = [pacePlay, stage, easy]; pacePlay = 1e9; stage = 2; easy = false; const m = speedMul(); pacePlay = was[0]; stage = was[1]; easy = was[2]; return m <= 1.4 && m >= 1.39; }));
    // out of hearts, and "I'm done playing" on the new-life card: the kind
    // card, which never claims the top
    await page.evaluate(() => { Rise.clear(); pushed = 3; hearts = 1; paintHearts(); heartHitAt = -1e9; graceUntil = 0; Rise.add("cube", Rise.balloon.x, Rise.balloon.y); });
    await page.locator("#revOvl.show").waitFor();
    await page.locator("#revDone").click();
    await page.locator("#endOvl.show").waitFor();
    const end = await page.evaluate(() => {
      const $ = (id) => document.getElementById(id), vis = (e) => getComputedStyle(e).display !== "none", c = $("endCharge").getBoundingClientRect(), h = $("endHome").getBoundingClientRect();
      return { hearts, playing, reviveWait, ended: !!window.__ended, finaleDone, out: outOfHearts, title: $("endTitle").textContent, sub: $("endSub").textContent,
        again: vis($("endCharge")) && $("endCharge").textContent, home: vis($("endHome")) && $("endHome").textContent, order: c.bottom <= h.top, confetti: __f.confetti || 0 };
    });
    ok("zero hearts, then \"I'm done playing\", ends kindly: \"What a climb!\", the blocks pushed and the child's first best, Play again on top and Back home under it, no confetti, never the top",
      end.hearts === 0 && end.out && !end.playing && !end.reviveWait && end.ended && !end.finaleDone && end.title === "What a climb!" && end.sub === "You pushed 3 blocks out of the way! Your best: 3!"
      && end.again === "Play again" && end.home === "Back home" && end.order && end.confetti === 0, end);
    ok("a finished round spends the turn", await page.evaluate(() => sessionStorage.getItem("sona.play.active") === null && sessionStorage.getItem("sona.play.token") === null));
    ok("the child's best of blocks pushed is kept beside their other bests, in the one store", await page.evaluate(() => { const b = JSON.parse(localStorage.getItem("sona.bests.v1") || "{}"); return b.glide && b.glide.n === 4 && b.rise && b.rise.n === 3 && localStorage.getItem("sona.best.rise") === null; }));
    const lines = await page.evaluate(() => {
      const was = [startBest, pushed, saidNewBest], r = {}, at = (b, n) => { startBest = b; pushed = n; return bestLine().join(" "); };
      r.first = at(0, 14); r.beat = at(14, 17); r.close = at(17, 14); r.far = at(38, 5); r.same = at(14, 14); r.one = at(0, 1);
      startBest = 2; pushed = 2; saidNewBest = false; riseCount({}); r.pop = document.getElementById("bnBig").textContent; r.small = document.getElementById("bnSmall").textContent;
      startBest = was[0]; pushed = was[1]; saidNewBest = was[2]; return r;
    });
    ok("the best line reads like the other games': first, beaten, close, far, level, one block",
      lines.first === "You pushed 14 blocks out of the way! Your best: 14!" && lines.beat === "You pushed 17 blocks out of the way! A new best!"
      && lines.close === "You pushed 14 blocks out of the way! Your best: 17. 3 away!" && lines.far === "You pushed 5 blocks out of the way! Your best: 38."
      && lines.same === "You pushed 14 blocks out of the way! The same as your best!" && lines.one === "You pushed 1 block out of the way! Your best: 1!", lines);
    ok("passing the best the child came in with pops \"New best!\" once", lines.pop === "New best!" && lines.small === "3 blocks pushed", lines);
    await page.locator("#endCharge").click(); await page.waitForURL(/charge\.html/);
    ok("Play again earns another turn in this same game", new URL(page.url()).searchParams.get("game") === "arcade-rise.html");
    ok("hearts and pace: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── a whole climb ──
await scenario("a whole climb", async () => {
  const { context, page, errors } = await open();
  try {
    let s = await st(page);
    ok("the garden opens with its banner, three hearts, and asks for no mic", s.big === "The garden" && s.phase === "climb" && s.stage === 0 && s.hearts === 3 && s.mics === 0, s);
    // the first two groups always miss
    await page.evaluate(() => { spawnMs = spawnEvery; });
    await page.waitForFunction(() => patternLog.length >= 1);
    await page.evaluate(() => { spawnMs = spawnEvery; });
    await page.waitForFunction(() => patternLog.length >= 2);
    const log = await page.evaluate(() => patternLog.slice(0, 2));
    ok("a round opens with two groups that miss the balloon (a gate, a block to the side)", log.every((id) => id === "gate" || id === "side"), log);
    // one real push, by a real finger
    await calm(page); await centre(page);
    const before = await page.evaluate(() => { window.__r = Rise.add("cube", Rise.shield.x - 2.2 * Rise.shield.r, Rise.shield.y); return pushed; });
    await page.mouse.move(300, 760); await page.mouse.down(); await page.mouse.move(230, 760, { steps: 4 }); await frames(page); await page.mouse.up();
    ok("dragging the shield into a block pushes it, and it counts", await page.evaluate((n) => __r.counted && __r.loose && pushed === n + 1, before), await page.evaluate(() => ({ pushed, counted: __r.counted })));
    await centre(page);
    await nearEnd(page);
    await page.waitForFunction(() => phase === "rest", null, { timeout: 4000 });
    ok("the end of the garden is a rest: \"Higher!\" and no card yet", await page.evaluate(() => document.getElementById("bnBig").textContent === "Higher!" && !document.getElementById("revOvl").classList.contains("show")));
    await page.locator("#revOvl.show").waitFor({ timeout: 12000 });
    s = await st(page);
    ok("…then the card asks for the sound to rise higher", /^Say “rrrr” to rise higher!$/.test(s.title) && s.stage === 0 && s.REV === 3, s);
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 12000 });
    await heard(page);
    s = await st(page);
    ok("the child's sound starts the clouds, and the mic is closed again", s.stage === 1 && s.phase === "climb" && s.playing && !s.card && s.REV === 2 && s.big === "The clouds" && s.live === 0, s);
    ok("…in the clouds' sky", await page.evaluate(() => document.getElementById("skyClouds").classList.contains("on") && document.body.classList.contains("rise-stage-1")));
    await nearEnd(page);
    await page.locator("#revOvl.show").waitFor({ timeout: 12000 });
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 12000 });
    await heard(page);
    s = await st(page);
    ok("the second card starts the stars", s.stage === 2 && s.phase === "climb" && s.REV === 1 && s.big === "The stars" && s.live === 0, s);
    await centre(page);
    await nearEnd(page);
    await page.waitForFunction(() => phase === "top", null, { timeout: 4000 });
    s = await st(page);
    ok("after the stars comes the top, with no card", !s.card && s.mics === 2 && s.REV === 1 && (await page.evaluate(() => finaleDone && Rise.puffs.length === 5 && document.getElementById("bnBig").textContent === "The top!")), s);
    // a real finger pushes a cloud away
    await page.waitForFunction(() => Rise.puffs.every((p) => p.t >= 1000), null, { timeout: 4000 });
    const n = await page.evaluate(() => __f.sfx.length);
    await page.mouse.move(195, 760); await page.mouse.down(); await page.mouse.move(195, 560, { steps: 6 }); await frames(page); await page.mouse.up();
    ok("at the top the shield pushes a cloud away", await page.evaluate(() => Rise.puffs.some((p) => p.gone)));
    await page.waitForFunction((n) => __f.sfx.slice(n).some((c) => c.name === "star"), n, { timeout: 2000 }).catch(() => {});
    ok("…with a sparkle sound", await page.evaluate((n) => __f.sfx.slice(n).some((c) => c.name === "star"), n));
    ok("no heart can be lost at the top", await page.evaluate(() => loseHeart(performance.now()) === false && hearts === 3));
    await page.evaluate(() => { finale.t = 9990; });
    await page.locator("#endOvl.show").waitFor({ timeout: 12000 });
    const end = await page.evaluate(() => ({ title: document.getElementById("endTitle").textContent, sub: document.getElementById("endSub").textContent, pushed, mics: __f.mics, rev: REV, confetti: __f.confetti || 0, left: Rise.puffsLeft() }));
    ok("the clouds drift off by themselves, the balloon reaches the star, and the climb is won", end.title === "You rose all the way to the stars!" && end.left === 0 && end.sub.indexOf("You pushed " + end.pushed + (end.pushed === 1 ? " block" : " blocks") + " out of the way!") === 0 && end.pushed >= 1, end);
    ok("two cards, two mics, and confetti for the win", end.mics === 2 && end.rev === 1 && end.confetti >= 1, end);
    ok("the earned turn is spent once the climb ends", await page.evaluate(() => sessionStorage.getItem("sona.play.active") === null && sessionStorage.getItem("sona.play.token") === null));
    const sfx = await page.evaluate(() => __f.sfx);
    ok("no sound ever played while the card's mic was open", sfx.length > 0 && sfx.every((c) => !c.live), sfx.filter((c) => c.live));
    ok("a whole climb writes no practice data", (await page.evaluate(() => __f.practice.length)) === 0);
    ok("a whole climb: no runtime errors", errors.length === 0, errors);
    // the end card: the sky stops redrawing behind it
    await frames(page, 4);
    const after = await page.evaluate(() => new Promise((r) => { let n = 0; const c = CanvasRenderingContext2D.prototype.clearRect; CanvasRenderingContext2D.prototype.clearRect = function () { if (this.canvas && this.canvas.id === "cv") n++; return c.apply(this, arguments); }; setTimeout(() => { CanvasRenderingContext2D.prototype.clearRect = c; r({ n, loopOn }); }, 400); }));
    ok("once the climb ends the draw loop stops: nothing redraws behind the end card", after.n === 0 && after.loopOn === false, after);
  } finally { await context.close(); }
});

// ── the top always ends, with no touch at all ──
await scenario("the top with no touch", async () => {
  const { context, page, errors } = await open();
  try {
    // the shield left right over the balloon, as low as it goes
    await page.evaluate(() => { Rise.clear(); const b = Rise.shieldBox(), s = Rise.shield; s.x = s.tx = W / 2; s.y = s.ty = b.y1; startFinale(); });
    const early = await page.evaluate(() => ({ lose: loseHeart(performance.now()), phase, hearts }));
    await page.evaluate(() => { finale.t = 9990; });
    // once the last cloud is gone the shield glides aside, and only then does
    // the balloon float up: it never passes through the shield
    await page.waitForFunction(() => finale.up >= 0, null, { timeout: 8000 });
    const aside = await page.evaluate(async () => {
      const f = () => new Promise((r) => requestAnimationFrame(r)), out = { through: false, waited: Rise.balloon.y, drag: canDrag() };
      while (phase === "top") {
        const s = Rise.shield, b = Rise.balloon, dx = s.x - b.x, dy = s.y - b.y;
        if (Math.hypot(dx, dy) < s.r + b.hitR) out.through = true;
        if (finale.up > 0 && finale.up < 400 && b.y !== out.waited) out.early = true;
        await f();
      }
      out.side = Math.abs(Rise.shield.x - W / 2) >= Rise.shield.r + Rise.balloon.r;
      return out;
    });
    ok("at the top the shield glides out of the balloon's way before it floats up, and the finger has nothing left to steer", !aside.through && !aside.early && aside.side && aside.drag === false, aside);
    let lost = false;
    for (let i = 0; i < 40 && !(await page.locator("#endOvl.show").count()); i++) { if (await page.evaluate(() => loseHeart(performance.now()))) lost = true; await page.waitForTimeout(250); }
    await page.locator("#endOvl.show").waitFor({ timeout: 4000 });
    const end = await page.evaluate(() => ({ title: document.getElementById("endTitle").textContent, sub: document.getElementById("endSub").textContent, hearts, pushed, finaleDone }));
    ok("left alone at the top, the clouds drift off and the climb is won", end.title === "You rose all the way to the stars!" && end.finaleDone && (end.pushed > 0 || end.sub === "Your balloon made it all the way up!"), end);
    ok("no heart can be lost anywhere in the finale", !early.lose && early.phase === "top" && !lost && end.hearts === 3, { early, lost, end });
    ok("the top with no touch: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── a hidden page holds everything ──
await scenario("hidden page", async () => {
  const { context, page, errors } = await open();
  try {
    await calm(page);
    await page.evaluate(() => { Rise.add("cube", W * 0.1, Rise.BAND + 20); spawnMs = 100; });
    await page.waitForTimeout(200);
    const snap = () => page.evaluate(() => JSON.stringify({ climbMs, spawnMs, pacePlay, slowMs, phase, hearts, pushed, y: Rise.pieces[0] && Rise.pieces[0].y }));
    await page.evaluate(() => __f.hide()); await page.waitForTimeout(80);
    const a = await snap(); await page.waitForTimeout(300); const b = await snap();
    ok("while the page is hidden nothing moves and no play time passes", a === b && JSON.parse(a).y != null, { a, b });
    await page.evaluate(() => __f.show());
    ok("coming back gives 1.5 s of grace before a block can cost a heart", await page.evaluate(() => graceUntil > performance.now() && graceUntil - performance.now() <= 1500));
    await page.waitForTimeout(200);
    ok("…and the climb goes on", JSON.parse(await snap()).climbMs > JSON.parse(b).climbMs);
    ok("hidden page: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── every picture can fail: the game draws its own ──
await scenario("pictures fail", async () => {
  const { context, page, errors, blocked } = await open({ noArt: true }, { width: 320, height: 568 });
  try {
    await page.waitForTimeout(800);
    const px = await page.evaluate(() => {
      const c = document.getElementById("cv"), g = c.getContext("2d"), a = (x, y) => g.getImageData(Math.round(x * DPR), Math.round(y * DPR), 1, 1).data[3];
      return { balloon: a(Rise.balloon.x, Rise.balloon.y), shield: a(Rise.shield.x, Rise.shield.y), sky: getComputedStyle(document.getElementById("skyGarden")).backgroundColor };
    });
    ok("the pictures really were blocked", blocked() > 0, blocked());
    ok("with no pictures the balloon and the shield are still drawn", px.balloon > 0 && px.shield > 0, px);
    ok("…and the garden sky keeps its colour", !/rgba\(0, 0, 0, 0\)|transparent/.test(px.sky), px.sky);
    await calm(page);
    await page.evaluate(() => { heartHitAt = -1e9; graceUntil = 0; window.__n = Rise.add("cube", Rise.balloon.x, Rise.balloon.y); });
    await page.waitForFunction(() => __n.hit, null, { timeout: 3000 });
    ok("…and a block on the balloon still costs a heart", await page.evaluate(() => hearts === 2));
    ok("pictures fail: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── nobody steering: an untouched round never wins, and a parked shield isn't enough ──
// (review, 9 Oct 2026: a shield left where it started kept the balloon safe
// through the garden and the clouds, so a child who never touched the screen
// climbed to the top and was thanked for 70 pushes.) Whole rounds on a fake
// clock; each card between stretches is answered, nothing else. A round
// that runs out of hearts stops on the new-life card (8 Oct 2026); there a
// child who never steers taps "I'm done playing".
async function untouched(park) {
  const { context, page, errors } = await open({ clock: true });
  try {
    await page.evaluate((park) => {
      window.__lost = [0, 0, 0]; let hp = hearts;
      (function tick() { requestAnimationFrame(tick); if (hearts < hp) __lost[stage] += hp - hearts; hp = hearts; })();
      // one drag puts the shield right over the balloon, and it stays there
      if (park) { const b = Rise.shieldBox(), s = Rise.shield; s.x = s.tx = W / 2; s.y = s.ty = (b.y0 + b.y1) / 2; }
    }, park);
    for (let t = 0; t < 260000; t += 250) {
      await page.clock.runFor(250);
      const s = await page.evaluate(() => ({ card: document.getElementById("revOvl").classList.contains("show"), live: __f.live, ended: !!window.__ended, life: !!lifeCard }));
      if (s.ended) break;
      if (s.card && s.life) { await page.evaluate(() => { window.__lifeCards = (window.__lifeCards || 0) + 1; document.getElementById("revDone").click(); }); continue; }
      if (s.card && s.live >= 1) await heard(page);
    }
    const end = await page.evaluate(() => ({ ended: !!window.__ended, top: finaleDone, hearts, pushed, lost: __lost, stage, life: window.__lifeCards || 0, title: document.getElementById("endTitle").textContent,
      sub: getComputedStyle(document.getElementById("endSub")).display !== "none" ? document.getElementById("endSub").textContent : "" }));
    return { end, errors };
  } finally { await context.close(); }
}
await scenario("nobody steering", async () => {
  const idle = await untouched(false);
  ok("a round nobody touches never reaches the top: it runs out of hearts, offers a new life, and \"I'm done playing\" ends it kindly", idle.end.ended && !idle.end.top && idle.end.hearts === 0 && idle.end.life === 1 && idle.end.title === "What a climb!", idle.end);
  ok("…and it is thanked for no pushes: nothing counted, no count line", idle.end.pushed === 0 && idle.end.sub === "", idle.end);
  const parked = await untouched(true);
  ok("a shield parked over the balloon pushes nothing", parked.end.pushed === 0, parked.end);
  ok("…and from the clouds on it isn't enough on its own: the breeze carries the balloon out from under it and the blocks follow", parked.end.lost[1] + parked.end.lost[2] >= 1 && !parked.end.top, parked.end);
  ok("nobody steering: no runtime errors", idle.errors.length === 0 && parked.errors.length === 0, [idle.errors, parked.errors]);
});

// ── from the clouds on, the blocks fall toward the balloon, wherever the breeze has it ──
await scenario("blocks follow the balloon", async () => {
  const { context, page, errors } = await open();
  try {
    await calm(page);
    const aim = await page.evaluate(() => {
      startStretch(1); Rise.clear(); spawnMs = 0; spawnEvery = 1e9; heartHitAt = -1e9; graceUntil = 0; bumps = 0;
      const b = Rise.shieldBox(), s = Rise.shield; s.x = s.tx = b.x0; s.y = s.ty = b.y0;   // out of the way
      // the breeze eased in, and at its widest when a block from the top gets there
      climbMs = 6000; const T = (Rise.balloon.y - (Rise.HUDB - Rise.s)) / fallNow() * (1000 / 60); swayT = 2000 - T;
      const a = aimAt(); Rise.spawn("one", STRETCHES[1].sway, a); window.__aimed = Rise.pieces[0];
      Rise.spawn("one", STRETCHES[1].sway, 0); window.__mid = Rise.pieces[1];
      return { a, amp: STRETCHES[1].sway };
    });
    await page.waitForFunction(() => __aimed.hit || __aimed.y > Rise.balloon.y + Rise.balloon.r, null, { timeout: 8000 });
    const r = await page.evaluate(() => ({ aimedHit: __aimed.hit, midHit: __mid.hit, off: Math.abs(Rise.balloon.x - W / 2), bumps }));
    ok("in the clouds a block falls toward where the breeze will have the balloon, not the middle of the sky", aim.a >= 0.8 * aim.amp && r.aimedHit && !r.midHit && r.off >= 0.8 * aim.amp * 390 && r.bumps >= 1, { aim, r });
    ok("…and in the garden, with no breeze, they fall at the middle", await page.evaluate(() => { stage = 0; const a = aimAt(); stage = 1; return a === 0; }));
    ok("blocks follow the balloon: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── a finger held down through the say-it card steers again once it closes ──
await scenario("a finger held through the card", async () => {
  const { context, page, errors } = await open();
  try {
    await calm(page); await centre(page);
    await page.mouse.move(100, 700); await page.mouse.down(); await page.mouse.move(110, 700); await frames(page);
    await page.evaluate(() => crash());
    await page.locator("#revOvl.show").waitFor();
    await page.mouse.move(150, 700); await frames(page);   // moved while the card is up: kept, not steered
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 12000 });
    const a = await page.evaluate(() => { closeReviveMic(); doRevive(); return { x: Rise.shield.x, playing }; });
    await page.mouse.move(170, 700); await frames(page);
    const b = await shieldAt(page);
    ok("a finger held down through the card steers the moment play goes on, by as much as it moves, with no jump", a.playing && near(b.x - a.x, 20), { a, b });
    await page.mouse.up();
    await page.mouse.move(260, 700); await frames(page);
    const c = await shieldAt(page);
    ok("a mouse only hovering never steers", near(c.x, b.x), { b, c });
    // a touch that went down on the card (the card holds it) steers once the card is gone
    await page.evaluate(() => crash());
    await page.locator("#revOvl.show").waitFor();
    const card = await page.evaluate(async () => {
      const el = document.querySelector("#revOvl .ovlCard"), f = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const ev = (type, x) => el.dispatchEvent(new PointerEvent(type, { pointerId: 31, pointerType: "touch", clientX: x, clientY: 600, bubbles: true, cancelable: true }));
      ev("pointerdown", 200); ev("pointermove", 210); await f();
      const onCard = Rise.shield.x;
      while (__f.live !== 1) await f();
      closeReviveMic(); doRevive();
      const x0 = Rise.shield.x; ev("pointermove", 215); await f(); ev("pointermove", 240); await f();
      const moved = Rise.shield.x - x0; ev("pointerup", 240);
      return { onCard, x0, moved };
    });
    ok("…and so does a finger that went down on the card, once the card is gone (never while it is up)", near(card.onCard, card.x0) && near(card.moved, 25), card);
    ok("a finger held through the card: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── the garden's drifting clouds stay in the sky ──
await scenario("clouds stay in the sky", async () => {
  const { context, page, errors } = await open();
  try {
    await page.waitForTimeout(700);
    const g = await page.evaluate(async () => {
      const f = () => new Promise((r) => requestAnimationFrame(r)), out = { horizon: Rise.horizon, low: [] };
      for (let k = 0; k < 40; k++) { for (const b of Rise.bits) if (!b.dot && b.a > 0 && b.y + 0.25 * b.w >= Rise.horizon) out.low.push(Math.round(b.y)); await f(); }
      out.shown = Rise.bits.filter((b) => !b.dot && b.a > 0).length;
      climbMs = STRETCHES[0].len * 0.9; await f(); await f(); out.later = Rise.horizon;
      return out;
    });
    ok("in the garden no drifting cloud is drawn on the hills or the flower bed: each fades out above the ground", g.horizon < 844 * 0.7 && g.low.length === 0 && g.shown >= 2, g);
    ok("…and the ground line goes down as the sky pans", g.later > g.horizon, g);
    ok("clouds stay in the sky: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── what a child reads ──
const words = (page) => page.evaluate(() => [document.body.innerText, ...[...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label"))].join("\n"));
await scenario("words on screen", async () => {
  const { context, page, errors } = await open();
  try {
    await page.waitForTimeout(400);
    const play = await words(page);
    await page.evaluate(() => crash());
    await page.locator("#revOvl.show").waitFor();
    const card = await words(page);
    await page.evaluate(() => { pushed = 5; });
    await page.locator("#revDone").click();
    await page.locator("#endOvl.show").waitFor(); await page.waitForTimeout(1100);
    const end = await words(page);
    const bad = [play, card, end].map((t) => (t.match(BANNED_SEEN) || [null])[0]);
    ok("during play, on the card and on the end card, no word says score, points, you missed, game over or charge", bad.every((b) => b === null) && /5 blocks out of the way/.test(end), { bad, end });
    ok("words on screen: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
  // nothing pushed, and done playing: the gentle zero tier
  const zero = await open();
  try {
    await zero.page.evaluate(() => crash());
    await zero.page.locator("#revOvl.show").waitFor();
    await zero.page.evaluate(() => { pushed = 0; });
    await zero.page.locator("#revDone").click();
    await zero.page.locator("#endOvl.show").waitFor();
    const z = await zero.page.evaluate(() => ({ title: document.getElementById("endTitle").textContent, again: document.getElementById("endAgain").textContent, againShown: getComputedStyle(document.getElementById("endAgain")).display !== "none", chargeShown: getComputedStyle(document.getElementById("endCharge")).display !== "none", home: document.getElementById("endHome").textContent }));
    const t = await words(zero.page);
    ok("a round with nothing pushed ends on \"Good try! Wanna go again?\" and one way to play again", z.title === "Good try! Wanna go again?" && z.again === "Yes! Play again" && z.againShown && !z.chargeShown && z.home === "Back home" && !BANNED_SEEN.test(t), { z, t });
    ok("zero tier: no runtime errors", zero.errors.length === 0, zero.errors);
  } finally { await zero.context.close(); }
});

// ── a heard card is one game rep, never practice data ──
await scenario("no practice data", async () => {
  const { context, page, errors } = await open();
  try {
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
    await page.evaluate(() => crash());
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 12000 });
    await heard(page);
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
    const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => before[k] !== after[k]);
    ok("a heard card changes only the week's game reps (and the trophies they earn)", changed.includes("sona.gamereps.v1") && changed.every((k) => k === "sona.gamereps.v1" || k === "sona.trophy.v1"), changed);
    ok("…and calls no practice write", (await page.evaluate(() => __f.practice.length)) === 0);
    ok("no practice data: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── the catalog: Premium, on the big kids' shelf, never in the old run ──
await scenario("catalog", async () => {
  const { context, page, errors } = await open();
  try {
    const c = await page.evaluate(() => {
      const a = Sona.GAME_ACTS.rise;
      return { act: a && { tier: a.tier, group: a.group, coming: !!a.comingSoon, say: !!a.say, go: a.go, adventure: a.adventure },
        run: Sona.adventureGames("rise"), keys: Sona.GAME_KEYS.indexOf("rise") >= 0, allowed: Sona.gameAccess("rise").allowed, card: Sona.CRAFTED_CARDS.rise, name: Sona.gameMeta("arcade-rise.html").name };
    });
    ok("Rise Up is a Premium game on the big kids' shelf, entered through its practice page, not Coming soon and not a Say & Play game",
      !!c.act && c.act.tier === "premium" && c.act.group === "arcade" && !c.act.coming && !c.act.say && c.act.go === "/charge.html?game=arcade-rise.html" && c.name === "Rise Up" && c.card === "rise", c);
    ok("it is never in the old five-game run, even asked to start there", c.act && c.act.adventure === false && !c.keys && Array.isArray(c.run) && c.run.length > 0 && !c.run.includes("rise"), c);
    ok("this family (grandfathered) can open it", c.allowed === true, c);
    ok("catalog: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await browser.close(); await new Promise((r) => server.close(r));
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
