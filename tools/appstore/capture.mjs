// App Store screenshots, part 1 of 2: capture the REAL app.
//
// Travis, 5 Oct 2026, about the old six: "use what our app actually looks
// like to update ... most important is just making them look like the
// current app actually looks." The old set showed things the app no longer
// has (lives, tickets, STAR MODE, green buttons), because it was drawn, not
// captured. So nothing here is drawn: every screen is the page in public/,
// served as is, on a fake phone, driven by its own controls to a good moment.
//
//   node tools/appstore/capture.mjs && node tools/appstore/compose.mjs
//
// Options: --only=slice,tiles (scene names below)  --device=iphone|ipad
// Writes tools/appstore/out/raw/<device>/<scene>.png (git ignores out/), or
// under $APPSTORE_RAW. compose.mjs reads the same folder.
//
// What is staged, and why it is honest:
//   - the household is "Mia", 8, on R, onboarded, with example practice
//     and game reps this week, so the numbers a parent sees are not zero;
//   - Premium is on through the free-era promise (earlyAdopter, the mark
//     _grandfatherFreeEra() puts on a real household), so nothing is greyed:
//     an entitlement path premium() honours, never a painted unlock;
//   - every free-era stamp is set, so no sweep re-runs on the seed;
//   - it runs as the iPhone app (window.Capacitor), because these are the
//     App Store's pictures: the website-only founding banner stays away;
//   - the phone's safe areas are the real ones (59 pt on top for the island,
//     34 under the home bar; the iPad's 24 and 20): Chromium has none, so
//     env(safe-area-inset-*) is swapped for them as each file is served,
//     the way tests/onboardingtest.mjs does;
//   - the microphone is a fake that hears a "child" only when a scene says
//     so (window.__dev.voice), with the voiced shape the test suites use;
//     the voice service is down, so lines fall back to the (silent) browser
//     voice, and nothing plays out loud;
//   - the clock uses the review day in Idaho (AT below): October's live
//     Halloween shelf stays above the game crop, with no future practice days.
import { createServer } from "http";
import { readFileSync, existsSync, statSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium, launchOpts } from "../../tests/_env.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(HERE, "../../public");
export const RAW = process.env.APPSTORE_RAW || path.join(HERE, "out", "raw");
const PORT = Number(process.env.APPSTORE_PORT || 8303);
const BASE = "http://127.0.0.1:" + PORT;

// iPhone 15/16 Pro Max class (430 x 932 pt, @3x) and the 13" iPad (1032 x
// 1376 pt, @2x). The insets are what those screens give a viewport-fit=cover
// page with the app's contentInset "never" (capacitor.config.json).
export const DEVICES = {
  iphone: { viewport: { width: 430, height: 932 }, dpr: 3, inset: { top: 59, bottom: 34 } },
  ipad: { viewport: { width: 1032, height: 1376 }, dpr: 2, inset: { top: 24, bottom: 20 } },
};

// Monday 5 Oct 2026, 4:10 pm in Idaho. The week is Mon 5 – Sun 11.
const AT = Date.parse("2026-10-05T16:10:00-06:00");
const TZ = "America/Boise";
const DAYS = ["2026-10-05"];

// A believable week for one child on R: practice-page tries (what Progress
// and a clinician see) and sounds said inside games (Home's corner adds them).
function seedOutcomes() {
  const days = {};
  [[DAYS[0], 4, 3, 20]]
    .forEach(([d, a, p, tries]) => { days[d] = { a, p, tries }; });
  const attempts = Object.values(days).reduce((n, d) => n + d.a, 0), passes = Object.values(days).reduce((n, d) => n + d.p, 0);
  return { R: { attempts, passes, tries: attempts * 5, firstAt: DAYS[0], lastAt: DAYS[0], days,
    byPos: { i: { a: attempts, p: passes } } } };
}
function seedProgress() {
  const practiceDays = {};
  DAYS.forEach((d) => { practiceDays[d] = 1; });
  return { practiceDays, streak: { count: DAYS.length, lastDate: DAYS[DAYS.length - 1] }, totals: { sessions: 1, words: 20, stars: 0, coins: 0 }, stage: { R: 2 } };
}
function seedGameReps() {
  const g = {};
  [[DAYS[0], 10]].forEach(([d, n]) => { g[d] = { R: n }; });
  return g;
}

// ── the fake phone, installed before any page script ──
function device(cfg) {
  const RealDate = Date, SHIFT = cfg.shift;
  class FrozenDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(RealDate.now() + SHIFT); else super(...a); }
    static now() { return RealDate.now() + SHIFT; }
  }
  window.Date = FrozenDate;

  const dev = window.__dev = { voice: false, mics: 0, frozen: false, held: [] };
  // A canvas game keeps its last drawn frame while frozen: a slice trail
  // lives 130 ms and a screenshot at @3x takes longer than that to start, so
  // a scene freezes the frame it wants, then shoots it. (Held callbacks are
  // simply dropped: the page is closed after the shot.)
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { if (dev.frozen) { dev.held.push(cb); return; } cb(t); });
  // The iPhone app, as the build that sells (1.0.5 carries RevenueCat's
  // plugin): with no plugin, sona.js takes it for 1.0.4 and opens the free
  // version, and Home labels its games "Free" (a price word the store page
  // should not carry). The plugin answers that nothing was bought on this
  // Apple ID: Premium here is the household's free-era promise (below).
  if (cfg.native) window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", Plugins: { Purchases: {
    configure: () => Promise.resolve(), getCustomerInfo: () => Promise.resolve({ customerInfo: { entitlements: { active: {}, all: {} } } }),
    getOfferings: () => new Promise(() => {}), addCustomerInfoUpdateListener: () => Promise.resolve(), setLogLevel: () => Promise.resolve() } } };
  try { Object.defineProperty(navigator, "permissions", { configurable: true, value: { query: () => Promise.resolve({ state: "granted" }) } }); } catch (e) {}

  // the microphone: always granted, live until the page stops it
  navigator.mediaDevices.getUserMedia = () => {
    dev.mics++;
    const track = { kind: "audio", readyState: "live", muted: false, enabled: true, stop() { this.readyState = "ended"; }, addEventListener() {}, removeEventListener() {}, getSettings: () => ({}) };
    return Promise.resolve({ active: true, getTracks: () => [track], getAudioTracks: () => [track], addEventListener() {}, removeEventListener() {} });
  };
  // Web Audio, silent. The analyser hears a voiced, low sound (187.5 Hz and
  // its harmonics, the shape the suites use for a child on R) only while a
  // scene sets __dev.voice, through a live mic.
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const t0 = performance.now();
  class Context {
    constructor() { this.state = "running"; this.sampleRate = 48000; this.destination = {}; this.listener = {}; }
    get currentTime() { return (performance.now() - t0) / 1000; }
    resume() { this.state = "running"; return Promise.resolve(); }
    suspend() { this.state = "suspended"; return Promise.resolve(); }
    close() { this.state = "closed"; return Promise.resolve(); }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
    createDynamicsCompressor() { return { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), connect() {}, disconnect() {} }; }
    createOscillator() { const o = { type: "sine", frequency: param(), detune: param(), connect() {}, disconnect() {}, start() {}, stop() { setTimeout(() => { if (o.onended) o.onended(); }, 30); } }; return o; }
    createBuffer(c, n, sr) { const data = new Float32Array(n); return { length: n, sampleRate: sr, duration: n / sr, numberOfChannels: c, getChannelData: () => data, copyToChannel() {} }; }
    decodeAudioData(buf, ok) { const b = this.createBuffer(1, 4800, 48000); if (ok) ok(b); return Promise.resolve(b); }
    createBufferSource() {
      const s = { buffer: null, playbackRate: param(), connect() {}, disconnect() {},
        start() { const ms = s.buffer && s.buffer.duration ? s.buffer.duration * 1000 : 50; s.timer = setTimeout(() => { if (s.onended) s.onended(); }, Math.min(ms, 1500)); },
        stop() { clearTimeout(s.timer); if (s.onended) s.onended(); } };
      return s;
    }
    createBiquadFilter() { return { type: "lowpass", Q: param(), frequency: param(), gain: param(), connect() {}, disconnect() {} }; }
    createMediaStreamSource(stream) { return { stream, on: false, connect(a) { this.on = true; a.src = this; }, disconnect() { this.on = false; } }; }
    createAnalyser() {
      const sr = this.sampleRate;
      const a = { fftSize: 2048, smoothingTimeConstant: 0.8, src: null, connect() {}, disconnect() {} };
      Object.defineProperty(a, "frequencyBinCount", { get: () => a.fftSize / 2 });
      const live = () => dev.voice && a.src && a.src.on && a.src.stream.getTracks()[0].readyState === "live";
      const wave = (i) => { const p = 2 * Math.PI * 187.5 * i / sr; return 22 * Math.sin(p) + 16 * Math.sin(2 * p) + 12 * Math.sin(3 * p) + 9 * Math.sin(4 * p); };
      a.getByteTimeDomainData = (d) => { const v = live(); for (let i = 0; i < d.length; i++) d[i] = v ? Math.round(128 + wave(i)) : 128 - (i & 1); };
      a.getFloatTimeDomainData = (d) => { const v = live(); for (let i = 0; i < d.length; i++) d[i] = v ? wave(i) / 128 : -(i & 1) / 128; };
      a.getByteFrequencyData = (d) => { d.fill(0); if (!live()) return; const bin = sr / a.fftSize; [187.5, 375, 562.5, 750].forEach((f) => { const k = Math.round(f / bin); if (k < d.length) d[k] = 230; }); };
      a.getFloatFrequencyData = (d) => { const v = live(), bin = (sr / 2) / d.length; for (let i = 0; i < d.length; i++) d[i] = v && i * bin < 6000 ? (i % 4 === 0 ? -40 : -70) : -110; };
      return a;
    }
  }
  window.AudioContext = window.webkitAudioContext = Context;
  window.MediaRecorder = class { constructor(stream) { this.stream = stream; this.state = "inactive"; this.mimeType = "audio/webm"; } static isTypeSupported() { return true; }
    start() { this.state = "recording"; } stop() { if (this.state === "inactive") return; this.state = "inactive"; setTimeout(() => { if (this.ondataavailable) this.ondataavailable({ data: new Blob(["x"], { type: "audio/webm" }) }); if (this.onstop) this.onstop(); }, 0); } };
  // A media element (Echo's lines in the app, Rachel's recorded sound, the
  // piano's notes) "plays" for a moment and ends, without a speaker.
  HTMLMediaElement.prototype.play = function () { const el = this; setTimeout(() => { try { el.dispatchEvent(new Event("ended")); } catch (e) {} }, 350); return Promise.resolve(); };
  HTMLMediaElement.prototype.pause = function () {};
  HTMLMediaElement.prototype.load = function () {};
  if (window.speechSynthesis) {
    const pending = new Set();
    speechSynthesis.speak = (u) => { const t = setTimeout(() => { pending.delete(t); if (u.onstart) try { u.onstart(); } catch (e) {} if (u.onend) u.onend(); }, 450); pending.add(t); };
    speechSynthesis.cancel = () => { pending.forEach((t) => clearTimeout(t)); pending.clear(); };
    speechSynthesis.getVoices = () => [];
  }

  // Echo's mid-round sound-power ask (3 Oct 2026) would open the mic at a
  // random moment of a capture: held, so each scene shows what it drives.
  if (cfg.holdAsk) document.addEventListener("DOMContentLoaded", () => { if (window.SLOW_ASK) { SLOW_ASK.first = SLOW_ASK.every = SLOW_ASK.quiet = 1e12; window.slowAskAt = 1e12; } });

  if (!localStorage.getItem("sona.appstore.seeded")) {
    localStorage.setItem("sona.appstore.seeded", "1");
    localStorage.setItem("sona.freeera.v1", "post");
    ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
    // set up after trial-first: Premium (below) opens everything, and no
    // card says "Free" (a price word the store page must not carry)
    localStorage.setItem("sona.freever.v1", "post");
    if (cfg.fresh) {
      // a phone opening Sona for the first time (setup)
      localStorage.setItem("sona.profile.v1", JSON.stringify({ voiceOn: true, soundOn: true, volume: 0.8 }));
    } else {
      localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "8", focusSounds: ["R"], onboarded: true, earlyAdopter: true, voiceOn: true, soundOn: true, volume: 0.8, weeklyGoal: 5 }));
      localStorage.setItem("sona.micok", "1");
      localStorage.setItem("sona.outcomes.v1", JSON.stringify(cfg.outcomes));
      localStorage.setItem("sona.gamereps.v1", JSON.stringify(cfg.gameReps));
      localStorage.setItem("sona.sprintintro.v1", "3");
      // the days Progress's week marks (momWeek reads practiceDays), and the
      // review ask already answered, so it is not on the page
      localStorage.setItem("sona.progress.v1", JSON.stringify(cfg.progress));
      localStorage.setItem("sona.rateask.v1", JSON.stringify({ next: Date.now() + 90 * 86400000 }));
      Object.keys(cfg.seed || {}).forEach((k) => localStorage.setItem(k, cfg.seed[k]));
    }
  }
  Object.keys(cfg.session || {}).forEach((k) => sessionStorage.setItem(k, cfg.session[k]));
}

// ── the server: public/ as it is ──
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", webp: "image/webp", woff2: "font/woff2", wav: "audio/wav", mp3: "audio/mpeg", json: "application/json", webmanifest: "application/manifest+json" };
function fileFor(urlPath) {
  let f = path.join(PUBLIC, decodeURIComponent(urlPath));
  if (!f.startsWith(PUBLIC)) return null;
  if (existsSync(f) && statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!existsSync(f) && existsSync(f + ".html")) f += ".html";
  return existsSync(f) && statSync(f).isFile() ? f : null;
}
const server = createServer((req, res) => {
  const u = new URL(req.url, BASE);
  // no server behind the static app: Echo's voice service is down (the
  // browser voice stands in), and every other route answers nothing
  if (u.pathname.startsWith("/api/")) { res.writeHead(503, { "content-type": "application/json" }); res.end("{}"); return; }
  const f = fileFor(u.pathname);
  if (!f) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[f.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(f));
});

let browser;
async function open(devName, url, cfg = {}) {
  const d = DEVICES[devName];
  const context = await browser.newContext({ viewport: d.viewport, deviceScaleFactor: d.dpr, isMobile: true, hasTouch: true, timezoneId: TZ, locale: "en-US" });
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (!u.href.startsWith(BASE + "/")) return route.abort();
    // the phone's real safe areas, as Safari would give them
    if (/\.(html|css|js)$/.test(u.pathname) || u.pathname === "/") {
      const f = fileFor(u.pathname === "/" ? "/index.html" : u.pathname);
      if (f) return route.fulfill({ status: 200, contentType: MIME[f.split(".").pop()],
        body: readFileSync(f, "utf8").replace(/env\(safe-area-inset-top[^)]*\)/g, d.inset.top + "px").replace(/env\(safe-area-inset-bottom[^)]*\)/g, d.inset.bottom + "px").replace(/env\(safe-area-inset-(left|right)[^)]*\)/g, "0px") });
    }
    return route.continue();
  });
  await context.addInitScript(device, Object.assign({ shift: AT - Date.now(), native: true, holdAsk: true, outcomes: seedOutcomes(), gameReps: seedGameReps(), progress: seedProgress() }, cfg));
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + url);
  return { context, page, errors, d };
}
const until = (page, fn, ms, arg) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
async function settle(page) {
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].filter((i) => i.src && !i.complete && i.loading !== "lazy").map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000); }))));
}
async function voice(page, ms) { await page.evaluate(() => { __dev.voice = true; }); await page.waitForTimeout(ms); await page.evaluate(() => { __dev.voice = false; }); }
async function shot(page, devName, scene, clip) {
  if (scene === "home") {
    const bounds = clip || { x: 0, y: 0, width: DEVICES[devName].viewport.width, height: DEVICES[devName].viewport.height };
    const cut = await page.evaluate((b) => [...document.querySelectorAll('.activity-group[data-group="arcade"] .game-card')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.left < b.x || r.right > b.x + b.width || r.top < b.y || r.bottom > b.y + b.height;
    }).map((el) => el.querySelector(".game-name").textContent), bounds);
    if (cut.length) throw new Error("Home capture cuts game cards: " + cut.join(", "));
  }
  const dir = path.join(RAW, devName);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, scene + ".png");
  await page.screenshot({ path: file, ...(clip ? { clip } : {}) });
  return file;
}

// ── the scenes ──
// Each one opens a fresh phone, drives the page with its own controls (or the
// same game functions the suites use) and returns when the moment is on screen.
const SCENES = {};

// 1. Fruit Slice in play: fruit in the air, a slice trail across one.
// A swipe is the page's own pointer events on its canvas, in its own frame
// (a trail lives 130 ms); then the frame is frozen and shot.
const cutIn = (page, f) => page.evaluate(async (f) => {
  const cv = document.getElementById("cv"), r = cv.getBoundingClientRect();
  const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { clientX: r.left + x, clientY: r.top + y, bubbles: true, pointerId: 7, pointerType: "touch", isPrimary: true }));
  const x0 = f.x - f.dx, y0 = f.y + f.dy, x1 = f.x + f.dx, y1 = f.y - f.dy;
  ev("pointerdown", x0, y0);
  for (let i = 1; i <= 8; i++) { ev("pointermove", x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8); await new Promise((d) => setTimeout(d, f.stepMs || 12)); }
  if (f.freeze) { await new Promise((d) => requestAnimationFrame(() => d())); __dev.frozen = true; }
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 7, bubbles: true }));
}, f);
SCENES.slice = async (devName) => {
  const s = await open(devName, "/arcade-slice.html?from=charge", { session: { "sona.play.token": "arcade-slice.html", "sona.boost.sound": "R", "sona.boost.level": "isolation", "sona.boost.ask": "rrrr" } });
  const { page } = s;
  await until(page, () => window.gameEntryAllowed === true && typeof startWave === "function", 15000);
  await settle(page);
  // the fruit to cut: unsliced, well above the stand, near the top of its arc
  const pick = (minUp, framed = false) => page.evaluate(({ minUp, framed, clearCounter }) => {
    const top = standTop(), up = fruits.filter((q) => !q.sliced && q.y < top - minUp && q.y > H * 0.2);
    // never through a golden fruit (its "GOLDEN!" flash would sit on the frame)
    const gold = fruits.filter((q) => q.gold && !q.sliced), far = (q) => gold.every((g) => Math.hypot(g.x - q.x, g.y - q.y) > 170);
    const ok = up.filter((q) => !q.gold && far(q) && (!framed || q.y > H * 0.34 && q.y < H * 0.65));
    if (!ok.length) return null;
    // near the top of its arc, and in the upper part of the screen
    const gap = (q) => Math.min(...up.filter((o) => o !== q).map((o) => Math.hypot(o.x - q.x, o.y - q.y)), 400);
    const cost = (q) => Math.abs(q.vy) + (q.y > H * 0.55 ? 100 : 0) - (framed ? gap(q) : 0);
    const f = ok.sort((a, b) => cost(a) - cost(b))[0];
    // On the phone, a large falling fruit can still cover the counter after
    // its centre has passed it. Allow for its painted radius and the short
    // swipe's remaining frames, so the stand's instruction stays clear.
    const lowerClear = !fruits.some((q) => !q.sliced && (clearCounter
      ? q.y + q.r + 8 + Math.max(0, q.vy) * 6 > top - 30 && q.y - q.r - 8 < H
      : q.y > top - 35 && q.y < H + 50));
    return { x: f.x, y: f.y + f.vy, n: up.length, gap: gap(f), lowerClear, dx: Math.min(framed ? 30 : 110, W * (framed ? 0.07 : 0.22)), dy: framed ? 18 : 48, stepMs: framed ? 4 : 12 };
  }, { minUp, framed, clearCounter: framed && devName === "iphone" });
  // a row of five first, so the counter shows a real row and the shot's cut
  // (one or two fruit) cannot reach the next five: no "in a row!" flash
  // over the frame. Wave 1 asks for six, so the wave is still on.
  for (let t = 0; t < 600 && (await page.evaluate(() => rowN)) < 5; t++) {
    const f = await pick(40);
    if (f) { await cutIn(page, f); await page.waitForTimeout(200); } else await page.waitForTimeout(50);
  }
  await until(page, () => getComputedStyle(document.getElementById("combo")).opacity === "0", 3000);
  // Super Slice, earned the real way: a tap on Echo, his ask, and the child's
  // sound heard through the mic. The stand throws five at once.
  for (let tries = 0; tries < 3 && !(await page.evaluate(() => slowMs > 0)); tries++) {
    const mics = await page.evaluate(() => __dev.mics);
    await page.evaluate(() => document.getElementById("slowKeys").click());
    if (!(await until(page, (m) => __dev.mics > m, 12000, mics))) continue;
    await page.waitForTimeout(350);
    await page.evaluate(() => { __dev.voice = true; });
    await until(page, () => slowMs > 0, 3000);
    await page.evaluate(() => { __dev.voice = false; });
    await page.waitForTimeout(400);
  }
  await until(page, () => fruits.filter((q) => !q.sliced).length >= 4, 6000);
  // A short real swipe through an isolated fruit below Echo, after the
  // "SUPER SLICE!" banner fades, keeps the action readable.
  let best = null; const t0 = Date.now();
  while (Date.now() - t0 < (devName === "iphone" ? 24000 : 11000)) {
    const f = await pick(110, true);
    const calm = await page.evaluate(() => Number(getComputedStyle(document.getElementById("banner")).opacity) < 0.05);
    if (f && f.n >= 2 && f.n <= 4 && f.gap >= 120 && f.lowerClear && calm) { best = f; break; }
    if (f && f.n <= 4 && f.gap >= 90 && f.lowerClear && calm && Date.now() - t0 > 5000) { best = f; break; }
    await page.waitForTimeout(30);
  }
  if (!best) throw new Error("No readable Fruit Slice capture moment");
  await cutIn(page, Object.assign(best, { freeze: true }));
  s.note = await page.evaluate(() => "row " + rowN + ", " + fruits.filter((q) => !q.sliced).length + " fruit up, Super Slice " + (slowMs > 0 ? "on" : "OFF") + (document.getElementById("slowControl").hidden ? ", Echo's button HIDDEN" : ""));
  await shot(page, devName, "slice");
  return s;
};

// 2. The practice page ("Say it 5 times") mid-try: Echo's bubble, the stand
// filling with fruit, the mic listening.
SCENES.charge = async (devName) => {
  const s = await open(devName, "/charge.html?game=slice", {});
  const { page } = s;
  await settle(page);
  const turn = () => until(page, () => /your turn/i.test((document.getElementById("turnStatus") || {}).textContent || ""), 15000);
  for (let i = 0; i < 2; i++) { if (!(await turn())) break; await page.waitForTimeout(200); await voice(page, 450); await page.waitForTimeout(900); }
  await turn();
  await page.waitForTimeout(400);
  await shot(page, devName, "charge");
  return s;
};

// 3. Piano Tiles in play: tiles coming down, one key just played.
SCENES.tiles = async (devName) => {
  const s = await open(devName, "/arcade-tiles.html?from=charge", { session: { "sona.play.token": "arcade-tiles.html", "sona.boost.sound": "R", "sona.boost.level": "isolation", "sona.boost.ask": "rrrr" } });
  const { page } = s;
  await until(page, () => window.gameEntryAllowed === true && typeof startSong === "function", 15000);
  await settle(page);
  const tapKeys = () => page.evaluate(() => {
    const t = tiles.filter((q) => !q.hit && !q.gone && q.y + q.h > HITY() - 60 && q.y < HITY() + 40).sort((a, b) => b.y - a.y)[0];
    if (!t) return null;
    const cv = document.getElementById("cv"), r = cv.getBoundingClientRect();
    cv.dispatchEvent(new PointerEvent("pointerdown", { clientX: r.left + (t.lane + 0.5) * (W / 4), clientY: r.top + HITY(), bubbles: true }));
    return t.note;
  });
  let got = 0; const t0 = Date.now();
  while (got < 9 && Date.now() - t0 < 30000) { if (await tapKeys()) got++; await page.waitForTimeout(40); }
  // the moment: a few tiles on the way down, the last one just played
  await until(page, () => tiles.filter((q) => !q.hit && !q.gone && q.y > 60 && q.y + q.h < HITY() - 40).length >= 3, 8000);
  for (let i = 0; i < 40; i++) { if (await tapKeys()) break; await page.waitForTimeout(40); }
  await page.waitForTimeout(90);
  await page.evaluate(() => { __dev.frozen = true; });
  await shot(page, devName, "tiles");
  return s;
};

// 4. Hoops: the word said twice, the ball earned, a swipe sending it up.
SCENES.hoops = async (devName) => {
  const s = await open(devName, "/arcade-hoops.html", {});
  const { page } = s;
  await settle(page);
  await page.locator("#startOvl.show").waitFor();
  // (the button breathes, so it is never "stable" for a Playwright click)
  await page.evaluate(() => document.getElementById("startBtn").click());
  const listening = () => until(page, () => window.__sayplay && window.__sayplay.listening === true, 12000);
  // one basket first, so a dot is filled
  for (let n = 0; n < 2; n++) {
    await listening(); await page.waitForTimeout(120); await voice(page, 300);
    await until(page, () => window.__sayplay.said === 1 && window.__sayplay.listening === true, 4000);
    await page.waitForTimeout(400); await voice(page, 300);
    await until(page, () => window.__hoops && window.__hoops.state === "ready", 6000);
    await page.waitForTimeout(500);
    if (n === 1) break;
    const box = await page.locator("#court").boundingBox();
    const h = await page.evaluate(() => window.__hoops), up = 240;
    const x0 = box.x + box.width / 2, y0 = box.y + box.height * 0.86, side = (h.hoopX / 2.4) * up / box.width;
    await page.mouse.move(x0, y0); await page.mouse.down();
    for (let i = 1; i <= 6; i++) { await page.mouse.move(x0 + side * box.width * i / 6, y0 - up * i / 6); await page.waitForTimeout(10); }
    await page.mouse.up();
    await until(page, () => window.__sayplay.step === 1, 6000);
  }
  await page.waitForTimeout(300);
  await shot(page, devName, "hoops");
  return s;
};

// 5. A book at its word moment: the page read, the key word lit, Echo asking.
SCENES.book = async (devName) => {
  const s = await open(devName, "/library.html", {});
  const { page } = s;
  await until(page, () => document.querySelectorAll("#shelf .bookBtn").length > 0, 15000);
  await page.evaluate((t) => [...document.querySelectorAll("#shelf .bookBtn")].find((b) => b.querySelector(".bt").textContent === t).click(), "Rory and the Rainbow");
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById("bkNext").click());
  await until(page, () => window.__book && window.__book.mode === "live", 15000);
  await settle(page);
  await page.waitForTimeout(700);
  await shot(page, devName, "book");
  return s;
};

// 6. Home: "Pick a game!" and the games a child can open.
SCENES.home = async (devName) => {
  const s = await open(devName, "/today.html", {});
  const { page } = s;
  await until(page, () => document.querySelectorAll(".game-card").length > 4, 15000);
  await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((i) => { i.loading = "eager"; }));
  await settle(page);
  await page.waitForTimeout(800);
  // Focus on complete playable rows by scrolling the real October Home.
  // The book shelves remain above them; no card is removed or unlocked.
  const clip = await page.evaluate(() => {
    const group = document.querySelector('.activity-group[data-group="arcade"]'), grid = group.querySelector(".game-grid");
    const cards = [...grid.querySelectorAll(".game-card")];
    const bottom = cards[cards.length - 1].getBoundingClientRect().bottom;
    const top = group.getBoundingClientRect().top;
    scrollBy(0, top - 70);
    const r = group.getBoundingClientRect();
    return { x: Math.floor(r.left - 8), y: Math.floor(r.top - 8), width: Math.ceil(r.width + 16), height: Math.ceil(bottom - top + 16) };
  });
  await page.waitForTimeout(300);
  await shot(page, devName, "home", clip);
  return s;
};

// 7. Progress, for grown-ups: this week's reps (behind the grown-ups check,
// passed the way Settings passes it).
SCENES.progress = async (devName) => {
  const s = await open(devName, "/progress.html", { session: { "sona.gate.v1": String(AT) } });
  const { page } = s;
  await until(page, () => window.Sona && document.getElementById("volReps") && document.getElementById("volReps").textContent !== "0", 15000);
  await settle(page);
  await page.waitForTimeout(600);
  // A complete weekly card, without cutting a sentence or introducing the
  // lower sound-check section into a picture about reps and practice days.
  const clip = await page.evaluate(() => {
    const top = document.querySelector(".family-pagehead").getBoundingClientRect(), card = document.getElementById("weekCard").getBoundingClientRect();
    return { x: Math.floor(card.left - 8), y: Math.floor(top.top - 8), width: Math.ceil(card.width + 16), height: Math.ceil(card.bottom - top.top + 18) };
  });
  await shot(page, devName, "progress", clip);
  return s;
};

// 8. Setup's Meet Rachel screen, reached the way a parent reaches it.
SCENES.rachel = async (devName) => {
  const s = await open(devName, "/onboarding.html", { fresh: true });
  const { page } = s;
  const next = () => page.locator("#nextBtn").click();
  await until(page, () => document.body.dataset.setupScreen === "welcome", 15000);
  await next();
  await page.locator('[data-step="who"].on').waitFor();
  await page.locator('.who-pick[data-role="parent"]').click();
  await page.locator('[data-step="name"].on').waitFor();
  await page.locator("#obName").fill("Mia");
  await page.locator('#obAge [data-age="8"]').click();
  await next();
  const r = page.locator('#obSounds [data-sound="R"]');
  if ((await r.getAttribute("aria-pressed")) !== "true") await r.click();
  await next();
  await page.locator('[data-step="rachel"].on').waitFor();
  await page.evaluate(() => Promise.all([document.fonts.ready, document.querySelector(".rachel-photo") && document.querySelector(".rachel-photo").decode().catch(() => {})]));
  await page.locator(".step.on").evaluate((el) => el.getAnimations({ subtree: true }).forEach((a) => a.finish()));
  await page.waitForTimeout(500);
  await shot(page, devName, "rachel");
  return s;
};

export const SCENE_NAMES = Object.keys(SCENES);

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
  const only = args.only ? args.only.split(",") : SCENE_NAMES;
  const devices = args.device ? [args.device] : Object.keys(DEVICES);
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
  browser = await chromium.launch(launchOpts());
  let bad = 0;
  try {
    for (const devName of devices) for (const name of only) {
      if (!SCENES[name]) { console.log("FAIL unknown scene " + name); bad++; continue; }
      const t = Date.now();
      let s = null;
      try {
        s = await SCENES[name](devName);
        if (s.errors.length) bad++;
        console.log((s.errors.length ? "FAIL " : "PASS ") + devName + "/" + name + " (" + ((Date.now() - t) / 1000).toFixed(1) + " s)" + (s.note ? "  " + s.note : "") + (s.errors.length ? "  page errors: " + s.errors.slice(0, 3).join(" | ") : ""));
      } catch (e) {
        bad++; console.log("FAIL " + devName + "/" + name + ": " + e.message.split("\n")[0]);
      } finally { if (s) await s.context.close(); }
    }
  } finally { await browser.close(); server.close(); }
  console.log("raw screens in " + RAW);
  if (bad) process.exit(1);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
