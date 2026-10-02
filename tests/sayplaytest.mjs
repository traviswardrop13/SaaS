// SAYPLAY1: the twenty Say & Play games (Travis, 26 Sep 2026: "10 more games
// for ages 3-4 and 10 more games for ages 5-8 ... incorporating practice").
//
// One engine (public/sayplay.js) runs all twenty pages. What this holds:
//   - only a voice moves a game: silence never does, "Hear it" and the mic
//     button only listen again, and nothing is written as practice data;
//   - the mic keeps the rules every other game keeps: it opens only for the
//     child's turn, after Echo's word, closes before any chime, and a sound
//     after it leaves the phone a moment to switch back (no iPhone call audio);
//   - the first time, a grown-up says yes before any mic prompt, "Not now"
//     leaves the prompt unused, and a refusal meets the usual help screen;
//   - a hidden page pauses the game and needs a tap to come back;
//   - a locked game bounces before any mic or sound starts;
//   - the catalog: ten games in each age group, each with its page, its card
//     picture and its sticker, none in the daily adventure, and every page is
//     exactly what tools/gameart/build.mjs writes;
//   - HOOPS (26 Sep 2026), the first game rebuilt to be played: no ball
//     before the word, a tap is not a shot, a miss never costs a word, the
//     help grows until every ball goes in, a pause holds the same ball, eight
//     baskets win, and the court's own sounds keep the quiet rules;
//   - SOCCER GOAL (1 Oct 2026), the second, holds the same promises: no ball
//     before the word, a tap is not a kick, a save or a wide kick never costs
//     a word, the goalie dozes off until every ball goes in, a pause holds the
//     same ball, and eight goals win;
//   - DINO DIG (1 Oct 2026), the third: no brush before the word, a tap digs
//     up nothing, rubbing uncovers the bone, the help glows and then gives way
//     only while the child rubs, a pause holds the brush, and eight bones wake
//     the dinosaur;
//   - BUBBLE POP (1 Oct 2026), a little kids' game rebuilt on this engine
//     without being a catalog "say" game: no bubble before the word, the
//     finger pops them all, the gold one drops the picture in the basket, the
//     help grows until every round ends, one giant bubble finishes it, and in
//     the iPhone app the pops are media. It runs as its own part
//     (tests/bubblestest.mjs);
//   - COMING SOON (Travis, 26 Sep 2026: "put the 20 games as coming soon"):
//     a parked game's card is greyed out, and its page sends a typed address
//     back to Home before any mic or sound. The engine is still played through
//     below, on a copy of sona.js with the parking lifted, because each game
//     comes back on this engine, one at a time.
//
// The device is fake (no real mic, speaker or voice), on one shared clock, the
// same harness as micquietgamestest.
import { createServer } from "http";
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from "./_env.mjs";

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT;
const BASE = "http://127.0.0.1:8233";
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2" };
// Echo's voice server is down (503) in every scenario but the stand-in one,
// which answers real PCM marked X-Sona-Voice-Keep "1" or "0" (28 Sep 2026).
const tts = { mode: "down", calls: 0 };
const server = createServer((req, res) => {
  const url = new URL(req.url, BASE), file = path.join(ROOT, url.pathname);
  if (url.pathname === "/api/tts" && tts.mode !== "down") {
    tts.calls++;
    res.writeHead(200, { "content-type": "audio/L16; rate=24000; channels=1", "X-Sona-Voice-Provider": "elevenlabs", "X-Sona-Voice-Model": tts.mode === "standin" ? "eleven_multilingual_v2" : "eleven_v4_turbo", "X-Sona-Voice-Keep": tts.mode === "standin" ? "0" : "1" });
    res.end(Buffer.alloc(9600)); return;
  }
  if (url.pathname.startsWith("/api/")) { res.writeHead(503, { "content-type": "application/json" }); res.end("{}"); return; }
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(8233, "127.0.0.1", resolve));
const browser = await chromium.launch(launchOpts());
let assertions = 0, failures = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, e.stack); } }

function fakeDevice(cfg) {
  const T0 = performance.now();
  const now = () => (performance.now() - T0) / 1000;
  const h = window.__quiet = { cfg, now, mics: [], sounds: [], sfx: [], gains: [], speech: [], requests: 0, inflight: 0, gumPlan: [], voice: false, hidden: false, speaking: 0, voicedFrames: 0, leakFrames: 0 };
  // Two counts (24 Sep 2026). live(): tracks the page holds right now, which
  // is what "the mic is open and listening" waits on. micOn(): the audit's
  // count, which ALSO holds a request still being answered: on an iPhone
  // recording starts (and the phone flips into call audio) before
  // getUserMedia returns, so a word that starts while a request is pending is
  // already under the mic although the page never sees a live track. This
  // audit used to count a mic only once its request resolved, and missed
  // Echo's word starting under exactly that.
  h.live = () => h.mics.filter((m) => m.start != null && m.end == null).length;
  h.micOn = () => h.mics.filter((m) => m.end == null).length;
  h.playingNow = () => { const t = now(); return h.speaking > 0 || h.sounds.some((s) => s.start <= t && t < s.end); };
  Object.defineProperty(document, "hidden", { configurable: true, get: () => h.hidden });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h.hidden ? "hidden" : "visible") });
  h.background = () => { h.hidden = true; document.dispatchEvent(new Event("visibilitychange")); };
  h.foreground = () => { h.hidden = false; document.dispatchEvent(new Event("visibilitychange")); };

  Object.defineProperty(navigator, "permissions", { configurable: true, value: { query: () => Promise.resolve({ state: cfg.permission || "granted" }) } });
  // A request answers at once unless scripted: cfg.gumDelay, or one
  // h.gumPlan entry per request ({ delay } or { delay, fail }), models a
  // phone that takes a while to answer (an iPhone switching into call audio,
  // a permission sheet) or an OS that cuts a pending request short. The
  // page's track goes live only when the answer arrives, but the audit's mic
  // interval runs from `asked` (the request going out) to `end` (the track
  // stopped, or the request failing).
  navigator.mediaDevices.getUserMedia = () => {
    h.requests++;
    if (cfg.micMode === "deny") return Promise.reject(new DOMException("Denied", "NotAllowedError"));
    const plan = h.gumPlan.shift() || { delay: cfg.gumDelay || 0 };
    const rec = { asked: now(), start: null, end: null }; h.mics.push(rec);
    const open = () => {
      rec.start = now();
      const track = { kind: "audio", readyState: "live", stop() { if (this.readyState !== "ended") { this.readyState = "ended"; rec.end = now(); } } };
      rec.track = track;
      return { getTracks: () => [track], getAudioTracks: () => [track] };
    };
    if (!plan.delay && !plan.fail) return Promise.resolve(open());
    h.inflight++;
    return new Promise((resolve, reject) => setTimeout(() => {
      h.inflight--;
      if (plan.fail) { rec.end = now(); reject(new DOMException("Interrupted", "AbortError")); } else resolve(open());
    }, plan.delay || 0));
  };

  function param(v) {
    const p = { _v: v, sets: [] };
    p.setValueAtTime = (x, t) => p.sets.push(["set", x, t]);
    p.linearRampToValueAtTime = (x, t) => p.sets.push(["lin", x, t]);
    p.exponentialRampToValueAtTime = (x, t) => p.sets.push(["exp", x, t]);
    p.setTargetAtTime = () => {}; p.cancelScheduledValues = () => {};
    Object.defineProperty(p, "value", { get: () => p._v, set: (x) => { p._v = x; p.sets.push(["value", x]); } });
    return p;
  }
  function endAt(t) { return t == null || t < now() ? now() : t; }
  function AC() { this.state = "running"; this.sampleRate = 48000; this.destination = {}; }
  Object.defineProperty(AC.prototype, "currentTime", { get: now });
  AC.prototype.resume = function () { this.state = "running"; return Promise.resolve(); };
  AC.prototype.suspend = function () { this.state = "suspended"; return Promise.resolve(); };
  AC.prototype.close = function () { this.state = "closed"; return Promise.resolve(); };
  AC.prototype.createGain = function () { const g = { gain: param(1), at: now(), connect() {}, disconnect() {} }; h.gains.push(g); return g; };
  AC.prototype.createOscillator = function () {
    const o = { type: "sine", frequency: param(440), connect() {}, disconnect() {}, onended: null,
      start(t) { o.rec = { kind: "osc", start: Math.max(now(), t || 0), end: Infinity, live: h.micOn() }; h.sounds.push(o.rec); },
      stop(t) { if (o.rec) o.rec.end = Math.min(o.rec.end, endAt(t)); } };
    return o;
  };
  AC.prototype.createBuffer = function (c, n, sr) { sr = sr || this.sampleRate; return { length: n, sampleRate: sr, duration: n / sr, numberOfChannels: c, getChannelData: () => new Float32Array(n) }; };
  AC.prototype.createBufferSource = function () {
    const s = { buffer: null, connect() {}, disconnect() {}, onended: null,
      start(t) {
        if (!s.buffer || s.buffer.length <= 1) return;   // the iOS unlock blip: one silent sample
        s.rec = { kind: "buf", len: s.buffer.length, start: Math.max(now(), t || 0), live: h.micOn() };
        s.rec.end = s.rec.start + s.buffer.duration; h.sounds.push(s.rec);
        s.timer = setTimeout(() => { if (s.onended) s.onended(); }, (s.rec.end - now()) * 1000);
      },
      stop(t) { if (s.rec) s.rec.end = Math.min(s.rec.end, endAt(t)); clearTimeout(s.timer); if (s.onended) s.onended(); } };
    return s;
  };
  AC.prototype.createBiquadFilter = function () { return { type: "lowpass", Q: param(1), frequency: param(350), gain: param(0), connect() {}, disconnect() {} }; };
  AC.prototype.createMediaStreamSource = function (stream) { return { stream, on: false, connect(an) { an.src = this; this.on = true; }, disconnect() { this.on = false; } }; };
  AC.prototype.createAnalyser = function () {
    const an = { fftSize: 2048, src: null, context: this, connect() {}, disconnect() {} };
    Object.defineProperty(an, "frequencyBinCount", { get: () => an.fftSize / 2 });
    // What the mic hears: the child when h.voice is on — and ANY sound the
    // page is playing right now, because a phone's mic hears its own speaker.
    an.hears = () => { if (!an.src || !an.src.on) return false; const tr = an.src.stream.getTracks()[0]; return tr.readyState === "live" && (h.voice || h.playingNow()); };
    an.getByteTimeDomainData = (d) => { const v = an.hears(); if (v) h.voicedFrames++; if (v && !h.voice) h.leakFrames++; for (let i = 0; i < d.length; i++) d[i] = v ? (i % 2 ? 200 : 56) : 128; };
    // a low, voiced shape (energy under ~1 kHz): the family an /r/ child's
    // voice — and Sona's chimes — would show
    an.getByteFrequencyData = (d) => { const v = an.hears(); d.fill(0); if (v) for (let i = 1; i <= 10 && i < d.length; i++) d[i] = 220; };
    return an;
  };
  window.AudioContext = window.webkitAudioContext = AC;
  // A media element is a sound like any other (the iPhone app plays Echo's
  // voice and Bubble Pop's pops this way): it joins the audit, so one that
  // starts under a mic, or rings into the next one, is caught. cfg.refuseMedia
  // models a phone that will not start one.
  HTMLMediaElement.prototype.play = function () {
    if (cfg.refuseMedia) return Promise.reject(new DOMException("refused", "NotAllowedError"));
    const t = now(); h.sounds.push({ kind: "media", start: t, end: t + (isFinite(this.duration) && this.duration > 0 ? this.duration : 0.4), live: h.micOn() });
    return Promise.resolve();
  };

  if (window.speechSynthesis) {
    const pending = new Set();
    speechSynthesis.speak = (u) => {
      const rec = { kind: "speech", text: String(u.text), start: now(), end: Infinity, live: h.micOn() };
      h.sounds.push(rec); h.speech.push(rec.text); h.speaking++; pending.add(rec);
      rec.timer = setTimeout(() => { if (!pending.delete(rec)) return; rec.end = now(); h.speaking--; if (u.onend) u.onend(); }, cfg.speechMs || 400);
    };
    speechSynthesis.cancel = () => { pending.forEach((rec) => { clearTimeout(rec.timer); rec.end = now(); h.speaking--; }); pending.clear(); };
    speechSynthesis.getVoices = () => [];
  }

  // Sona's own chimes stay real (they reach the fake Web Audio above); each
  // call is also logged by name, with how many mic tracks were live
  let sona;
  Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set(value) {
    sona = value;
    value.confetti = () => {};
    Object.keys(value.sfx || {}).forEach((k) => { const real = value.sfx[k]; if (typeof real !== "function" || k === "stop") return; value.sfx[k] = function () { h.sfx.push({ name: k, at: now(), live: h.micOn() }); return real.apply(this, arguments); }; });
  } });

  if (!localStorage.getItem("sona.test.sayplaySeed")) {
    localStorage.setItem("sona.test.sayplaySeed", "1");
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done"); localStorage.setItem("sona.freeera5.v1", "done");
    // earlyAdopter: a family holding every game, so this holds whichever way pricing points
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: cfg.age || "7", focusSounds: ["R"], onboarded: true, earlyAdopter: cfg.premium !== false,
      voiceOn: cfg.voiceOn !== false, soundOn: cfg.soundOn !== false, volume: cfg.volume == null ? 0.6 : cfg.volume }));
    if (cfg.micok) localStorage.setItem("sona.micok", "1");
    if (cfg.paid) {
      sessionStorage.setItem("sona.paidui", "1");
      localStorage.setItem("sona.demo.v1", JSON.stringify({ started: Date.now() - 100 * 3600000, done: Date.now() - 90000 }));
    }
  }
}

// The engine's own checks run on the catalog as it will be when a game comes
// back: the same sona.js, with each Say & Play game's comingSoon lifted.
const UNPARKED_SONA = readFileSync(ROOT + "/sona.js", "utf8").replace(/\bsay: true, comingSoon: true, /g, "say: true, ");
async function fresh(file, cfg = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (cfg.unparked && url.split("?")[0] === BASE + "/sona.js") return route.fulfill({ status: 200, contentType: "text/javascript", body: UNPARKED_SONA });
    return url.startsWith(BASE + "/") ? route.continue() : route.abort();
  });
  await context.addInitScript(fakeDevice, cfg);
  const page = await context.newPage(); page.setDefaultTimeout(6000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/" + file);
  return { context, page, errors };
}
const live = (page) => page.evaluate(() => __quiet.live());
const log = (page) => page.evaluate(() => ({ mics: __quiet.mics.map((m) => ({ start: m.asked, landed: m.start, end: m.end == null ? __quiet.now() : m.end })), sounds: __quiet.sounds.map((s) => ({ kind: s.kind, start: s.start, end: s.end, live: s.live, len: s.len, text: s.text })), sfx: __quiet.sfx.slice(), requests: __quiet.requests, leakFrames: __quiet.leakFrames, speech: __quiet.speech.slice() }));
async function voice(page, ms) { await page.evaluate(() => { __quiet.voice = true; }); await page.waitForTimeout(ms); await page.evaluate(() => { __quiet.voice = false; }); }
const until = (page, fn, ms, arg) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const game = (page) => page.evaluate(() => window.__sayplay || {});
function overlaps(l) {
  const bad = [];
  for (const s of l.sounds) for (const m of l.mics) {
    if (s.start < m.end && m.start < s.end) bad.push({ sound: s.kind + (s.text ? ":" + s.text : ""), start: +s.start.toFixed(3), mic: [+m.start.toFixed(3), +m.end.toFixed(3)] });
  }
  return bad;
}
function quietAfterClose(l, gap) {
  const bad = [];
  for (const s of l.sounds) for (const m of l.mics) if (s.start >= m.end && s.start - m.end < gap) bad.push({ sound: s.kind, after: +(s.start - m.end).toFixed(3) });
  return bad;
}
function noOverlap(label, l) {
  ok(label + ": sounds were played and the mic opened (not vacuous)", l.sounds.length > 0 && l.mics.length > 0, { sounds: l.sounds.length, mics: l.mics.length });
  ok(label + ": no sound or voice starts or rings while a mic is live or being asked for", overlaps(l).length === 0, overlaps(l).slice(0, 6));
  ok(label + ": every sound after the mic closes leaves the phone a moment to switch back", quietAfterClose(l, 0.15).length === 0, quietAfterClose(l, 0.15).slice(0, 6));
  ok(label + ": the mic never once heard the game's own sound", l.leakFrames === 0, { leakFrames: l.leakFrames });
}
function clean(label, errors) { ok(label + ": no runtime errors", errors.length === 0, errors); }
// what would make a spoken move practice data, or spend the family's things
const PRACTICE = /^sona\.(?:progress|reps|charge|tickets|rotation|today|coins|stickers|outcomes|rung|attempts|clips|hw|streak)/;
const practiceState = (page) => page.evaluate((src) => { const re = new RegExp(src); return Object.keys(localStorage).filter((k) => re.test(k)).sort().map((k) => [k, localStorage.getItem(k)]); }, PRACTICE.source);
// one turn: wait for the mic to be listening, then say it
async function sayIt(page) {
  const listening = await until(page, () => window.__sayplay && window.__sayplay.listening === true, 8000);
  if (!listening) return false;
  await page.waitForTimeout(80);
  await voice(page, 260);
  return true;
}

// ── the catalog ──
const { GAMES } = await import("../tools/gameart/games.mjs");
const { page: pageFor } = await import("../tools/gameart/page.mjs");
const KEYS = GAMES.map((g) => g.key);
// Hoops, Soccer Goal and Dino Dig are rebuilt by hand (public/hoops.js,
// soccer.js, dino.js), so the generator writes seventeen
ok("seventeen scene games, Hoops, Soccer Goal and Dino Dig: ten for each age group", GAMES.length === 17 && GAMES.filter((g) => g.group === "simple").length === 10 && GAMES.filter((g) => g.group === "arcade").length === 7 && !GAMES.some((g) => ["hoops", "soccer", "dino"].includes(g.key)));
{
  const hp = readFileSync(ROOT + "/arcade-hoops.html", "utf8");
  ok("Hoops is its own page: the engine for the word, the court for the shot", /<script src="\/sayplay\.js"><\/script>/.test(hp) && /<script src="\/hoops\.js"><\/script>/.test(hp) && /<canvas id="court"/.test(hp) && /play: window\.Hoops/.test(hp));
  ok("…and its Home card is a frame of the court", existsSync(ROOT + "/assets/games/hoops.webp") && readFileSync(ROOT + "/assets/sona-stickers.svg", "utf8").includes('<g id="sp-hoops"><image href="/assets/games/hoops.webp"'));
  const court = readFileSync(ROOT + "/hoops.js", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  ok("the court never touches the mic, and writes no practice", !/getUserMedia|logAttempt|bumpReps|recordSession|recordRung|rotAdvance|awardSticker|addCoins|mintCoins|addTickets|localStorage|sessionStorage/.test(court));
}
{
  const sp = readFileSync(ROOT + "/arcade-soccer.html", "utf8");
  ok("Soccer Goal is its own page: the engine for the word, the pitch for the kick", /<script src="\/sayplay\.js"><\/script>/.test(sp) && /<script src="\/soccer\.js"><\/script>/.test(sp) && /<canvas id="pitch"/.test(sp) && /play: window\.Soccer/.test(sp));
  ok("…and its Home card is a frame of the pitch", existsSync(ROOT + "/assets/games/soccer.webp") && readFileSync(ROOT + "/assets/sona-stickers.svg", "utf8").includes('<g id="sp-soccer"><image href="/assets/games/soccer.webp"'));
  const pitch = readFileSync(ROOT + "/soccer.js", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  ok("the pitch never touches the mic, and writes no practice", !/getUserMedia|logAttempt|bumpReps|recordSession|recordRung|rotAdvance|awardSticker|addCoins|mintCoins|addTickets|localStorage|sessionStorage/.test(pitch));
}
{
  const dp = readFileSync(ROOT + "/arcade-dino.html", "utf8");
  ok("Dino Dig is its own page: the engine for the word, the dig for the finger", /<script src="\/sayplay\.js"><\/script>/.test(dp) && /<script src="\/dino\.js"><\/script>/.test(dp) && /<canvas id="dig"/.test(dp) && /play: window\.Dino/.test(dp));
  ok("…and its Home card is a frame of the dig", existsSync(ROOT + "/assets/games/dino.webp") && readFileSync(ROOT + "/assets/sona-stickers.svg", "utf8").includes('<g id="sp-dino"><image href="/assets/games/dino.webp"'));
  const dug = readFileSync(ROOT + "/dino.js", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  ok("the dig never touches the mic, and writes no practice", !/getUserMedia|logAttempt|bumpReps|recordSession|recordRung|rotAdvance|awardSticker|addCoins|mintCoins|addTickets|localStorage|sessionStorage/.test(dug));
}
{
  // Bubble Pop is on this engine too (1 Oct 2026), but it is NOT a catalog
  // "say" game: it keeps its own place on the little kids' shelf, its own
  // Home card and its seat in their old five-round adventure.
  const bp = readFileSync(ROOT + "/arcade-bubbles.html", "utf8");
  ok("Bubble Pop is its own page: the engine for the word, the sky for the finger, five words",
    /<script src="\/sayplay\.js"><\/script>/.test(bp) && /<script src="\/bubbles\.js"><\/script>/.test(bp) && /<canvas id="sky"/.test(bp) && /play: window\.Bubbles/.test(bp) && /steps: \[\[\], \[\], \[\], \[\], \[\]\]/.test(bp) && !/simple-play/.test(bp.replace(/<!--[\s\S]*?-->/g, "")));
  ok("…and it keeps the little kids' old adventure: a finished round is banked, and the end button goes back to it",
    /S\.simpleAdventure\("bubbles", true\)/.test(bp) && /S\.simpleAdventure\("bubbles", false\)/.test(bp) && /charge\.html\?daily=1&banked=0/.test(bp));
  const sky = readFileSync(ROOT + "/bubbles.js", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  ok("the bubbles never touch the mic, and write no practice", !/getUserMedia|logAttempt|bumpReps|recordSession|recordRung|rotAdvance|awardSticker|addCoins|mintCoins|addTickets|localStorage|sessionStorage/.test(sky));
  const line = (readFileSync(ROOT + "/sona.js", "utf8").match(/^\s{4}bubbles:\s*\{[^\n]*/m) || [""])[0];
  ok("…and the catalog keeps it a free little-kids game that is not a Say & Play card", /group: "simple"/.test(line) && /tier: "free"/.test(line) && /go: "\/arcade-bubbles\.html"/.test(line) && !/say: true/.test(line) && !/comingSoon/.test(line), line);
}
ok("ages 3-4 play five words a game and ages 5-8 play eight", GAMES.every((g) => g.steps.length === (g.group === "simple" ? 5 : 8)));
// The played games (Hoops, Soccer Goal, Dino Dig) run as their own suite,
// tests/playgamestest.mjs, which sets SAYPLAY_PART=play and imports this file:
// with every rebuilt game added, one file outgrew run-all's five minutes a suite.
// Bubble Pop is a third part, "bubbles" (tests/bubblestest.mjs): three games
// take about 160 s of those 300, so THE NEXT REBUILT GAME GOES IN ITS OWN PART
// too, or run-all kills the suite with no failing assertion to read.
const PART = process.env.SAYPLAY_PART || "engine";
if (PART === "engine") {
for (const g of GAMES) {
  const file = ROOT + "/arcade-" + g.key + ".html";
  ok(g.key + ": the page is exactly what tools/gameart/build.mjs writes (edit the game there, then rebuild)", existsSync(file) && readFileSync(file, "utf8") === pageFor(g));
  ok(g.key + ": its card picture ships", existsSync(ROOT + "/assets/games/" + g.key + ".svg"));
}
const sheet = readFileSync(ROOT + "/assets/sona-stickers.svg", "utf8");
ok("every game's sticker is in the sheet and points at its card picture", KEYS.every((k) => sheet.includes('<g id="sp-' + k + '"><image href="/assets/games/' + k + '.svg"')));
const engine = readFileSync(ROOT + "/sayplay.js", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
ok("the engine writes no practice: no attempt, rep, session, rung, rotation, sticker or coin", !/logAttempt|bumpReps|recordSession|recordRung|rotAdvance|awardSticker|awardNextSticker|awardRandomSticker|addCoins|mintCoins|addTickets|chargeAdd|saveRecording|captureClip/.test(engine));
ok("the engine records nothing and uploads nothing: no recorder, no upload", !/MediaRecorder|sendProgress|repsBeacon|FormData|sendBeacon/.test(engine));
const flat = engine.replace(/\s+/g, " ");
ok("a play game's step counts only when the game says the move is done, and only in its play phase",
  /function moveDone\(\) \{ if \(phase !== "play" \|\| paused\) return; step\+\+; paintDots\(\);/.test(flat) && (flat.match(/moveDone/g) || []).length === 2);
ok("no tap moves a game: the only caller of a step is the voice check, after the sound-family check",
  (flat.match(/(?<!function )gotIt\(\)/g) || []).length === 1 && /if \(!famOK\(shp\)\) \{ voiced = 0; shp = null; \} else \{ gotIt\(\); return; \}/.test(flat));

await scenario("catalog in the app", async () => {
  const { context, page, errors } = await fresh("today.html", { age: "4" });
  try {
    await page.waitForFunction(() => !!window.Sona && document.querySelectorAll("#activityGroups button[data-game]").length > 0);
    const cat = await page.evaluate((keys) => ({
      acts: keys.map((k) => Sona.GAME_ACTS[k] || null),
      lib: Sona.activityLibrary().groups.map((g) => ({ id: g.id, keys: g.games.map((x) => x.key) })),
      adventure: Sona.adventureGames(),
      stickers: keys.map((k) => Sona.gameSticker(k)[0]),
      cards: [...document.querySelectorAll("#activityGroups button[data-game]")].map((b) => b.dataset.game),
    }), KEYS);
    ok("every game is in the catalog, opens its own page and says it is Say & Play", cat.acts.every((a, i) => a && a.say === true && a.go === "/arcade-" + KEYS[i] + ".html" && a.group === GAMES[i].group && a.name === GAMES[i].title));
    const simple = cat.lib.find((g) => g.id === "simple").keys, arcade = cat.lib.find((g) => g.id === "arcade").keys;
    ok("Home lists the ages 3-4 games under Simple play and the 5-8 games under Arcade",
      GAMES.every((g) => (g.group === "simple" ? simple : arcade).includes(g.key)));
    // dated parked games (30 Sep, 1 Oct 2026): playable games first, then the
    // parked ones, soonest day first (9 Oct, then 16 Oct)
    const days = await page.evaluate((keys) => keys.map((k) => ({ k, parked: !!Sona.GAME_ACTS[k].comingSoon, on: Sona.GAME_ACTS[k].comingOn || "" })), simple);
    const firstParked = days.findIndex((d) => d.parked);
    ok("the Simple play shelf lists its playable games, then the parked ones soonest day first",
      firstParked > 0 && days.slice(firstParked).every((d, i, a) => d.parked && d.on && (i === 0 || a[i - 1].on <= d.on)), days);
    ok("no Say & Play game joins the daily adventure", !cat.adventure.some((k) => KEYS.includes(k)), cat.adventure);
    ok("each game wears its own sticker", cat.stickers.every((s, i) => s === "sp-" + KEYS[i]));
    ok("Home shows a card for every game", KEYS.every((k) => cat.cards.includes(k)));
    // COMING SOON: the card is there, greyed out, and says so.
    const parked = KEYS.filter((k, i) => cat.acts[i] && cat.acts[i].comingSoon);
    const cards = await page.evaluate((keys) => keys.map((k) => { const b = document.querySelector('#activityGroups button[data-game="' + k + '"]'); return { k, disabled: !!b && b.disabled, text: b ? b.innerText : "", faded: b ? getComputedStyle(b.querySelector(".game-art")).opacity : "" }; }), parked);
    const coming = /Coming (soon|[A-Z][a-z]{2} \d{1,2})\b/;
    ok("every parked game shows a greyed-out card, saying its day or Coming soon, that cannot be tapped", parked.length > 0 && cards.every((c) => c.disabled && coming.test(c.text) && Number(c.faded) < 1), cards.filter((c) => !c.disabled || !coming.test(c.text)));
    clean("catalog", errors);
  } finally { await context.close(); }
});

// ── a parked game's page sends a typed address home before anything starts ──
for (const key of KEYS.filter((k) => /\bsay: true, comingSoon: true\b/.test((readFileSync(ROOT + "/sona.js", "utf8").match(new RegExp("^\\s{4}" + k + ": \\{[^\\n]*", "m")) || [""])[0]))) {
  await scenario(key + " parked", async () => {
    const { context, page, errors } = await fresh("arcade-" + key + ".html", { age: "7", micok: true, permission: "granted" });
    try {
      await page.waitForURL(/\/(?:activities|today)\.html/, { timeout: 6000 });
      await page.waitForFunction(() => !!document.getElementById("libraryMessage"), null, { timeout: 6000 });
      ok(key + ": a typed address goes back to Home, before any mic or sound", (await page.evaluate(() => __quiet.requests)) === 0 && (await page.evaluate(() => __quiet.sounds.length)) === 0);
      ok(key + ": …which says the game is coming, on its day or soon", await until(page, () => /is coming (soon|[A-Z][a-z]{2} \d{1,2})\b/.test(document.getElementById("libraryMessage").textContent), 4000));
      clean(key + " parked", errors);
    } finally { await context.close(); }
  });
}

// ── a stand-in voice is played, never kept (28 Sep 2026) ──
// While v4 Turbo is busy the server answers with the old v2 voice, marked
// X-Sona-Voice-Keep: 0. The phone keys saved clips by voice|revision|text, so a
// saved stand-in would replay the old voice for that word forever. Control: an
// ordinary clip ("1") IS saved and "Hear it" replays it without asking again.
for (const mode of ["keep", "standin"]) {
  await scenario("racecar voice " + mode, async () => {
    tts.mode = mode; tts.calls = 0;
    const { context, page, errors } = await fresh("arcade-racecar.html", { age: "7", micok: true, permission: "granted", unparked: true });
    try {
      await page.locator("#startOvl.show").waitFor();
      await page.locator("#startBtn").click();
      await page.waitForFunction(() => __quiet.sounds.filter((x) => x.kind === "buf").length >= 1);
      await page.waitForFunction(() => window.__sayplay.listening === true);
      const first = tts.calls;
      await page.locator("#hear").click();
      await page.waitForFunction(() => __quiet.sounds.filter((x) => x.kind === "buf").length >= 2);
      await page.waitForFunction(() => window.__sayplay.listening === true);
      const saved = await page.evaluate(() => new Promise((done) => {
        const r = indexedDB.open("sona-tts", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("clips");
        r.onerror = () => done(-1);
        r.onsuccess = () => { try { const q = r.result.transaction("clips", "readonly").objectStore("clips").count(); q.onsuccess = () => done(q.result); q.onerror = () => done(-1); } catch (e) { done(-1); } };
      }));
      ok("racecar " + mode + ": Echo's word comes from the voice server", first === 1, { first });
      if (mode === "keep") {
        ok("racecar keep: an ordinary clip is saved on the phone", saved === 1, { saved });
        ok("racecar keep: \"Hear it\" replays the saved clip without asking again", tts.calls === 1, { calls: tts.calls });
      } else {
        ok("racecar stand-in: nothing is saved on the phone", saved === 0, { saved });
        ok("racecar stand-in: \"Hear it\" asks the server again instead of replaying the old voice", tts.calls === 2, { calls: tts.calls });
      }
      clean("racecar voice " + mode, errors);
    } finally { tts.mode = "down"; await context.close(); }
  });
}

// ── a whole game, twice: once small (five words), once big (eight) ──
for (const key of ["balloon", "racecar"]) {
  await scenario(key + " played through", async () => {
    const { context, page, errors } = await fresh("arcade-" + key + ".html", { age: key === "balloon" ? "4" : "7", micok: true, permission: "granted", unparked: true });
    try {
      await page.locator("#startOvl.show").waitFor();
      await page.waitForTimeout(400);
      let l = await log(page);
      ok(key + ": the game waits on its Play button: no mic, no sound yet", l.requests === 0 && l.sounds.length === 0);
      const before = await practiceState(page);
      await page.locator("#startBtn").click();
      await page.waitForFunction(() => __quiet.speaking > 0);
      const g0 = await game(page);
      ok(key + ": Echo says the word while the mic is closed", (await live(page)) === 0 && !!g0.word);
      ok(key + ": the word on screen is a picture word for the child's sound", (await page.locator("#word").innerText()) === g0.word && g0.sound === "R");
      await page.waitForFunction(() => window.__sayplay.listening === true);
      ok(key + ": \"Your turn!\" shows only once the mic is open", (await live(page)) === 1 && /Your turn/.test(await page.locator("#micState").innerText()));
      await page.waitForTimeout(1500);
      ok(key + ": silence moves nothing", (await game(page)).step === 0);
      await page.locator("#hear").click();
      await page.waitForFunction(() => __quiet.speaking > 0);
      ok(key + ": \"Hear it\" closes the mic before Echo says the word again, and moves nothing", (await live(page)) === 0 && (await game(page)).step === 0);
      const total = (await game(page)).steps;
      for (let i = 0; i < total; i++) {
        const heard = await sayIt(page);
        const moved = await until(page, (n) => window.__sayplay.step === n, 3000, i + 1);
        ok(key + " word " + (i + 1) + ": the child's voice moves the game one step", heard && moved, await game(page));
        if (i === 0) {
          await page.waitForTimeout(100);
          ok(key + ": the mic is closed once the child is heard", (await live(page)) === 0);
          ok(key + ": the progress dots count the step", (await page.locator("#dots i.on").count()) === 1);
        }
      }
      await page.locator("#endOvl.show").waitFor({ timeout: 8000 });
      ok(key + ": the last word ends the game on a win", (await game(page)).phase === "end" && (await page.locator("#endTitle").innerText()).length > 0);
      await page.waitForTimeout(300);
      l = await log(page);
      noOverlap(key, l);
      ok(key + ": every chime waited for a closed mic", l.sfx.every((c) => c.live === 0), l.sfx.filter((c) => c.live));
      ok(key + ": Echo's words are one word each, calm, with no carrier phrase", l.speech.every((t) => /^Say\.\.\. [a-z]+\.$/i.test(t)), l.speech);
      ok(key + ": nothing was written as practice", JSON.stringify(await practiceState(page)) === JSON.stringify(before));
      await page.locator("#again").click();
      ok(key + ": Play again starts over on a fresh scene", (await game(page)).step === 0 && (await page.locator("#dots i.on").count()) === 0);
      clean(key, errors);
    } finally { await context.close(); }
  });
}

// ── every game: its first word moves it, with no errors ──
for (const g of GAMES) {
  await scenario(g.key + " first word", async () => {
    const { context, page, errors } = await fresh("arcade-" + g.key + ".html", { age: g.group === "simple" ? "4" : "7", micok: true, permission: "granted", voiceOn: false, unparked: true });
    try {
      await page.locator("#startOvl.show").waitFor();
      ok(g.key + ": the start card names the game", (await page.locator("#startTitle").innerText()) === g.title);
      await page.locator("#startBtn").click();
      const heard = await sayIt(page);
      const moved = await until(page, () => window.__sayplay.step === 1, 3000);
      ok(g.key + ": the first word moves the game", heard && moved, await game(page));
      await page.waitForTimeout(1600);
      ok(g.key + ": the next word is asked for", (await game(page)).phase === "turn");
      clean(g.key, errors);
    } finally { await context.close(); }
  });
}

}
if (PART === "play") {
// ── HOOPS: the first game rebuilt to be played (Travis, 26 Sep 2026: "if its
// basketball, we want them shooting a hoop"). The word earns the ball; the
// child swipes it into a hoop that glides side to side; a miss comes back to
// shoot again and never costs a word; eight baskets win. ──
const court = async (page) => page.locator("#court").boundingBox();
const hoops = (page) => page.evaluate(() => window.__hoops || {});
// a swipe up from the ball, drifting sideways so it ends toward a point
async function swipe(page, box, sideFrac, upPx, ms = 60) {
  const x0 = box.x + box.width / 2, y0 = box.y + box.height * 0.86;
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(x0 + sideFrac * box.width * i / 6, y0 - upPx * i / 6); await page.waitForTimeout(ms / 6); }
  await page.mouse.up();
}
// aim where the hoop is now, the way a child would
async function shootAtHoop(page, box) {
  const h = await hoops(page), up = 240;
  await swipe(page, box, (h.hoopX / 2.4) * up / box.width, up);
}
async function sayForBall(page) {
  if (!(await sayIt(page))) return false;
  return until(page, () => window.__hoops && window.__hoops.state === "ready", 5000);
}
await scenario("hoops played through", async () => {
  const { context, page, errors } = await fresh("arcade-hoops.html", { age: "7", micok: true, permission: "granted" });
  try {
    await page.locator("#startOvl.show").waitFor();
    ok("hoops: the start card says how to play: say the word, then swipe up to shoot", /Say the word to get the ball/.test(await page.locator("#startOvl").innerText()) && /swipe up to shoot/i.test(await page.locator("#startOvl").innerText()));
    const before = await practiceState(page);
    await page.locator("#startBtn").click();
    const box = await court(page);
    await page.waitForFunction(() => window.__sayplay.listening === true);
    // NO WORD, NO BALL: a swipe before the word does nothing
    await swipe(page, box, 0, 240);
    await page.waitForTimeout(300);
    let h = await hoops(page);
    ok("hoops: before the word there is no ball, and a swipe shoots nothing", h.state === "idle" && h.shots === 0, h);
    await page.waitForTimeout(1500);
    ok("hoops: silence brings no ball", (await hoops(page)).state === "idle" && (await game(page)).step === 0);
    ok("hoops: the child's word brings the ball, and the mic closes", await sayForBall(page) && (await live(page)) === 0);
    ok("hoops: the word alone is not a basket: the step waits for the shot", (await game(page)).step === 0 && (await game(page)).phase === "play");
    ok("hoops: it says how to shoot", /Swipe up to shoot/.test(await page.locator("#micState").innerText()));
    // a tap is not a shot
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.86);
    await page.waitForTimeout(250);
    ok("hoops: a tap is not a shot", (await hoops(page)).shots === 0 && (await hoops(page)).state === "ready");
    // a good shot goes in, and the step counts
    await shootAtHoop(page, box);
    ok("hoops: a good swipe at the hoop scores", await until(page, () => window.__hoops.baskets === 1, 4000), await hoops(page));
    ok("hoops: the basket moves the game one step and fills a dot", await until(page, () => window.__sayplay.step === 1, 3000) && (await page.locator("#dots i.on").count()) === 1);
    ok("hoops: then the next word is asked for", await until(page, () => window.__sayplay.listening === true, 8000));
    // A MISS NEVER COSTS A WORD: the ball comes back, no word is asked
    await sayForBall(page);
    const turnsBefore = (await log(page)).speech.length;
    await swipe(page, box, 0.45, 200);
    ok("hoops: a wild swipe misses", await until(page, () => window.__hoops.misses === 1, 6000), await hoops(page));
    ok("hoops: …and the ball comes back to shoot again", await until(page, () => window.__hoops.state === "ready", 4000));
    ok("hoops: a miss moves nothing and asks for no new word", (await game(page)).step === 1 && (await game(page)).phase === "play" && (await log(page)).speech.length === turnsBefore && (await live(page)) === 0);
    // EVERY BALL ENDS IN A BASKET: the help grows until the next swipe goes in
    await swipe(page, box, -0.45, 200); await until(page, () => window.__hoops.misses === 2 && window.__hoops.state === "ready", 7000);
    await swipe(page, box, 0.45, 200); await until(page, () => window.__hoops.misses === 3 && window.__hoops.state === "ready", 7000);
    ok("hoops: after misses the hoop stops and the page points the way", (await hoops(page)).misses === 3 && /Aim for the hoop/.test(await page.locator("#micState").innerText()));
    await swipe(page, box, 0.45, 200);
    ok("hoops: from the third miss on, any swipe up goes in", await until(page, () => window.__hoops.baskets === 2, 4000), await hoops(page));
    // PAUSE with the ball in hand: the same ball waits
    await until(page, () => window.__sayplay.listening === true, 8000);
    await sayForBall(page);
    await page.evaluate(() => __quiet.background());
    await page.waitForTimeout(200);
    ok("hoops: hiding the page pauses the court", (await page.locator("#pauseOvl.show").count()) === 1 && (await hoops(page)).frozen === true);
    await page.evaluate(() => __quiet.foreground());
    await page.locator("#resume").click();
    ok("hoops: Keep playing gives the same ball back, with no new word", (await hoops(page)).state === "ready" && (await game(page)).phase === "play" && (await game(page)).step === 2);
    // the rest of the game
    for (let n = 3; n <= 8; n++) {
      if (n > 3) { await until(page, () => window.__sayplay.listening === true, 8000); await sayForBall(page); }
      for (let t = 0; t < 5 && (await hoops(page)).baskets < n; t++) {
        await until(page, () => window.__hoops.state === "ready", 6000);
        await shootAtHoop(page, box);
        await until(page, (k) => window.__hoops.baskets >= k || window.__hoops.state === "back", 5000, n);
      }
      ok("hoops basket " + n + ": in", (await hoops(page)).baskets === n, await hoops(page));
    }
    await page.locator("#endOvl.show").waitFor({ timeout: 9000 });
    ok("hoops: eight baskets end the game on a win", (await game(page)).phase === "end" && (await game(page)).step === 8 && /Hoops star/.test(await page.locator("#endTitle").innerText()));
    await page.waitForTimeout(300);
    const l = await log(page);
    noOverlap("hoops", l);
    ok("hoops: every chime and court sound waited for a closed mic", l.sfx.every((c) => c.live === 0), l.sfx.filter((c) => c.live));
    ok("hoops: the court made its own sounds (swish, bounce) through the engine", l.sounds.some((s) => s.kind === "buf" && s.len > 1000), l.sounds.length);
    ok("hoops: Echo's words are one word each, calm, with no carrier phrase", l.speech.every((t) => /^Say\.\.\. [a-z]+\.$/i.test(t)), l.speech);
    ok("hoops: nothing was written as practice", JSON.stringify(await practiceState(page)) === JSON.stringify(before));
    await page.locator("#again").click();
    ok("hoops: Play again starts over: no baskets, no ball", (await game(page)).step === 0 && (await hoops(page)).baskets === 0 && (await page.locator("#dots i.on").count()) === 0);
    clean("hoops", errors);
  } finally { await context.close(); }
});

// ── SOCCER GOAL: the second game rebuilt to be played (Travis, 1 Oct 2026:
// "go finish soccer"). The word earns the ball; the child swipes it past a
// goalie who slides along the goal line; a save or a wide kick comes back to
// kick again and never costs a word; eight goals win. ──
const pitchBox = async (page) => page.locator("#pitch").boundingBox();
const soccer = (page) => page.evaluate(() => window.__soccer || {});
// a swipe up from the ball that carries on to `x` metres along the goal line
// (the pitch publishes how far a sideways swipe reaches there: aimScale)
async function kickAt(page, box, x, up = 240) {
  const s = await soccer(page);
  await swipe(page, box, (x / s.aimScale) * up / box.width, up);
}
async function sayForKick(page) {
  if (!(await sayIt(page))) return false;
  return until(page, () => window.__soccer && window.__soccer.state === "ready", 5000);
}
await scenario("soccer played through", async () => {
  const { context, page, errors } = await fresh("arcade-soccer.html", { age: "7", micok: true, permission: "granted" });
  try {
    await page.locator("#startOvl.show").waitFor();
    ok("soccer: it is open on Home, with no day on it", await page.evaluate(() => { const a = Sona.GAME_ACTS.soccer; return !a.comingSoon && !a.comingOn && a.say === true && a.group === "arcade" && a.go === "/arcade-soccer.html" && Sona.gameAccess("soccer").allowed; }));
    ok("soccer: the start card says how to play: say the word, then swipe up to kick it past the goalie", /Say the word to get the ball/.test(await page.locator("#startOvl").innerText()) && /swipe up to kick it past the goalie/i.test(await page.locator("#startOvl").innerText()));
    const before = await practiceState(page);
    await page.locator("#startBtn").click();
    const box = await pitchBox(page);
    await page.waitForFunction(() => window.__sayplay.listening === true);
    // NO WORD, NO BALL: a swipe before the word does nothing
    await swipe(page, box, 0, 240);
    await page.waitForTimeout(300);
    let s = await soccer(page);
    ok("soccer: before the word there is no ball, and a swipe kicks nothing", s.state === "idle" && s.kicks === 0, s);
    await page.waitForTimeout(1500);
    ok("soccer: silence brings no ball", (await soccer(page)).state === "idle" && (await game(page)).step === 0);
    ok("soccer: the child's word brings the ball, and the mic closes", await sayForKick(page) && (await live(page)) === 0);
    ok("soccer: the word alone is not a goal: the step waits for the kick", (await game(page)).step === 0 && (await game(page)).phase === "play");
    ok("soccer: it says how to kick", /Swipe up to kick/.test(await page.locator("#micState").innerText()));
    // a tap is not a kick
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.86);
    await page.waitForTimeout(250);
    ok("soccer: a tap is not a kick", (await soccer(page)).kicks === 0 && (await soccer(page)).state === "ready");
    // the first two balls: the goalie stands to one side, so straight up scores
    ok("soccer: for the first ball the goalie stands to one side", Math.abs((await soccer(page)).keeperX) > 0.8, await soccer(page));
    await swipe(page, box, 0, 240);
    ok("soccer: a swipe up past the goalie scores", await until(page, () => window.__soccer.goals === 1, 4000), await soccer(page));
    ok("soccer: the goal moves the game one step and fills a dot", await until(page, () => window.__sayplay.step === 1, 3000) && (await page.locator("#dots i.on").count()) === 1);
    ok("soccer: then the next word is asked for", await until(page, () => window.__sayplay.listening === true, 8000));
    // A SAVE NEVER COSTS A WORD: the ball comes back, no word is asked
    await sayForKick(page);
    const turnsBefore = (await log(page)).speech.length;
    await kickAt(page, box, (await soccer(page)).keeperX);
    ok("soccer: a kick straight at the goalie is saved", await until(page, () => window.__soccer.misses === 1, 4000) && (await soccer(page)).swipe.result === "save", await soccer(page));
    ok("soccer: …and the ball comes back to kick again", await until(page, () => window.__soccer.state === "ready", 5000));
    ok("soccer: a save moves nothing and asks for no new word", (await game(page)).step === 1 && (await game(page)).phase === "play" && (await log(page)).speech.length === turnsBefore && (await live(page)) === 0);
    await kickAt(page, box, 4.5);
    ok("soccer: a kick far past the post goes wide, and comes back too", await until(page, () => window.__soccer.misses === 2 && window.__soccer.state === "ready", 7000) && (await soccer(page)).swipe.result === "wide", await soccer(page));
    // EVERY BALL ENDS IN A GOAL: after two misses the goalie dozes off by a
    // post and the page points to the open side; from the third, any swipe up scores
    s = await soccer(page);
    ok("soccer: after two misses the goalie dozes off, and the page points to the open side", s.napping === true && s.openSide != null && Math.sign(s.openSide) !== Math.sign(s.keeperX) && /open side/.test(await page.locator("#micState").innerText()), s);
    await kickAt(page, box, s.keeperX);
    ok("soccer: …he can still stop one kicked right at him", await until(page, () => window.__soccer.misses === 3 && window.__soccer.state === "ready", 7000), await soccer(page));
    await swipe(page, box, 0.45, 200);
    ok("soccer: from the third miss on, any swipe up goes in", await until(page, () => window.__soccer.goals === 2, 4000), await soccer(page));
    ok("soccer: …and a goal wakes him: the help is gone for the next ball", await until(page, () => window.__sayplay.step === 2, 3000) && (await soccer(page)).misses === 0 && (await soccer(page)).napping === false);
    // PAUSE with the ball on the spot: the same ball waits
    await until(page, () => window.__sayplay.listening === true, 8000);
    await sayForKick(page);
    await page.evaluate(() => __quiet.background());
    await page.waitForTimeout(200);
    ok("soccer: hiding the page pauses the pitch", (await page.locator("#pauseOvl.show").count()) === 1 && (await soccer(page)).frozen === true);
    await page.evaluate(() => __quiet.foreground());
    await page.locator("#resume").click();
    ok("soccer: Keep playing gives the same ball back, with no new word", (await soccer(page)).state === "ready" && (await game(page)).phase === "play" && (await game(page)).step === 2);
    // the rest of the game: kick to the side the goalie isn't on
    for (let n = 3; n <= 8; n++) {
      if (n > 3) { await until(page, () => window.__sayplay.listening === true, 8000); await sayForKick(page); }
      for (let t = 0; t < 5 && (await soccer(page)).goals < n; t++) {
        await until(page, () => window.__soccer.state === "ready", 6000);
        await kickAt(page, box, (await soccer(page)).keeperX >= 0 ? -1.6 : 1.6);
        await until(page, (k) => window.__soccer.goals >= k || window.__soccer.state === "back", 5000, n);
      }
      ok("soccer goal " + n + ": in", (await soccer(page)).goals === n, await soccer(page));
    }
    await page.locator("#endOvl.show").waitFor({ timeout: 9000 });
    ok("soccer: eight goals end the game on a win", (await game(page)).phase === "end" && (await game(page)).step === 8 && /Goal star/.test(await page.locator("#endTitle").innerText()));
    await page.waitForTimeout(300);
    const l = await log(page);
    noOverlap("soccer", l);
    ok("soccer: every chime and pitch sound waited for a closed mic", l.sfx.every((c) => c.live === 0), l.sfx.filter((c) => c.live));
    ok("soccer: the pitch made its own sounds (kick, net) through the engine", l.sounds.some((x) => x.kind === "buf" && x.len > 1000), l.sounds.length);
    ok("soccer: Echo's words are one word each, calm, with no carrier phrase", l.speech.every((t) => /^Say\.\.\. [a-z]+\.$/i.test(t)), l.speech);
    ok("soccer: nothing was written as practice", JSON.stringify(await practiceState(page)) === JSON.stringify(before));
    await page.locator("#again").click();
    ok("soccer: Play again starts over: no goals, no ball", (await game(page)).step === 0 && (await soccer(page)).goals === 0 && (await soccer(page)).state === "idle" && (await page.locator("#dots i.on").count()) === 0);
    clean("soccer", errors);
  } finally { await context.close(); }
});

// ── DINO DIG: the third game rebuilt to be played (Travis, 1 Oct 2026: "go to
// the next game"). The word earns a brush; the child rubs the sand off a bone;
// the bone flies onto the skeleton; eight bones wake the dinosaur. ──
// rub back and forth across a stretch of the pit, in canvas pixels
async function rub(page, box, x0, x1, y, passes = 3) {
  await page.mouse.move(box.x + x0, box.y + y); await page.mouse.down();
  for (let p = 0; p < passes; p++) for (let i = 0; i <= 8; i++) {
    const t = i / 8, x = p % 2 ? x1 + (x0 - x1) * t : x0 + (x1 - x0) * t;
    await page.mouse.move(box.x + x, box.y + y + (p - 1) * 6); await page.waitForTimeout(12);
  }
  await page.mouse.up();
}
async function sayForBrush(page) {
  if (!(await sayIt(page))) return false;
  return until(page, () => window.__dino && window.__dino.state === "ready", 5000);
}
await scenario("dino dug up", async () => {
  const { context, page, errors } = await fresh("arcade-dino.html", { age: "7", micok: true, permission: "granted" });
  const dig = () => page.evaluate(() => window.__dino || {});
  const overBone = async (box, passes = 3) => { const b = (await dig()).bone; for (let r = -1; r <= 1; r++) await rub(page, box, b.x - b.w / 2, b.x + b.w / 2, b.y + r * b.h * 0.3, passes); };
  try {
    await page.locator("#startOvl.show").waitFor();
    ok("dino: it is open on Home, with no day on it", await page.evaluate(() => { const a = Sona.GAME_ACTS.dino; return !a.comingSoon && !a.comingOn && a.say === true && a.group === "arcade" && a.go === "/arcade-dino.html" && Sona.gameAccess("dino").allowed; }));
    ok("dino: the start card says how to play: say the word, then rub the sand", /Say the word to get a brush/.test(await page.locator("#startOvl").innerText()) && /rub the sand/i.test(await page.locator("#startOvl").innerText()));
    const before = await practiceState(page);
    await page.locator("#startBtn").click();
    const box = await page.locator("#dig").boundingBox();
    await page.waitForFunction(() => window.__sayplay.listening === true);
    // NO WORD, NO BRUSH: rubbing before the word moves no sand
    let d = await dig();
    await rub(page, box, d.pit.x + d.pit.w * 0.2, d.pit.x + d.pit.w * 0.8, d.pit.y + d.pit.h * 0.5);
    await page.waitForTimeout(250);
    d = await dig();
    ok("dino: before the word there is no brush, and rubbing moves no sand", d.state === "idle" && d.rubs === 0 && d.found === 0, d);
    await page.waitForTimeout(1500);
    ok("dino: silence brings no brush", (await dig()).state === "idle" && (await game(page)).step === 0);
    ok("dino: the child's word brings the brush, and the mic closes", await sayForBrush(page) && (await live(page)) === 0);
    ok("dino: the word alone digs nothing: the step waits for the bone", (await game(page)).step === 0 && (await game(page)).phase === "play" && (await dig()).revealed === 0);
    ok("dino: it says how to dig", /Rub the sand/.test(await page.locator("#micState").innerText()));
    // a tap is not a dig
    d = await dig();
    await page.mouse.click(box.x + d.bone.x, box.y + d.bone.y);
    await page.waitForTimeout(250);
    d = await dig();
    ok("dino: a tap alone digs up nothing", d.state === "ready" && d.found === 0 && d.revealed < 0.6, d);
    // rubbing over the bone uncovers it, and it flies onto the skeleton
    await overBone(box);
    ok("dino: rubbing the sand off uncovers the bone", await until(page, () => ["found", "flying", "placed", "idle"].includes(window.__dino.state) && (window.__dino.found >= 1 || window.__dino.state !== "ready"), 3000), await dig());
    ok("dino: the bone lands on the skeleton, the game moves one step and fills a dot", await until(page, () => window.__sayplay.step === 1, 4000) && (await dig()).found === 1 && (await page.locator("#dots i.on").count()) === 1);
    ok("dino: then the next word is asked for", await until(page, () => window.__sayplay.listening === true, 8000));
    // THE HELP: rubbing far from the bone, its spot glows, then its sand gives way as the child rubs
    await sayForBrush(page);
    const turnsBefore = (await log(page)).speech.length;
    d = await dig();
    const far = d.bone.x < d.pit.x + d.pit.w / 2 ? [d.pit.x + d.pit.w * 0.82, d.pit.x + d.pit.w * 0.97] : [d.pit.x + d.pit.w * 0.03, d.pit.x + d.pit.w * 0.18];
    await page.waitForTimeout(4300);
    ok("dino: after a few seconds the bone's spot glows", (await dig()).glow === true && (await dig()).found === 1);
    ok("dino: …and it never digs by itself", (await dig()).revealed === 0 && (await dig()).state === "ready");
    let got = false;
    for (let t = 0; t < 12 && !got; t++) { await rub(page, box, far[0], far[1], d.pit.y + d.pit.h * 0.2, 2); got = (await dig()).found >= 2 || (await dig()).state !== "ready"; }
    ok("dino: rubbing somewhere else, the sand over the bone gives way in the end", got && await until(page, () => window.__dino.found === 2, 4000), await dig());
    ok("dino: …and no new word was asked for on the way", (await log(page)).speech.length === turnsBefore && (await game(page)).step >= 1);
    // PAUSE with the brush out: the same bone waits
    await until(page, () => window.__sayplay.listening === true, 8000);
    await sayForBrush(page);
    await page.evaluate(() => __quiet.background());
    await page.waitForTimeout(200);
    ok("dino: hiding the page pauses the dig", (await page.locator("#pauseOvl.show").count()) === 1 && (await dig()).frozen === true);
    await page.evaluate(() => __quiet.foreground());
    await page.locator("#resume").click();
    ok("dino: Keep playing gives the same brush back, with no new word", (await dig()).state === "ready" && (await game(page)).phase === "play" && (await game(page)).step === 2);
    // the rest of the dig
    for (let n = 3; n <= 8; n++) {
      if (n > 3) { await until(page, () => window.__sayplay.listening === true, 8000); await sayForBrush(page); }
      await overBone(box);
      ok("dino bone " + n + ": found and placed", await until(page, (k) => window.__dino.found === k, 4000, n), await dig());
    }
    await page.locator("#endOvl.show").waitFor({ timeout: 9000 });
    ok("dino: eight bones wake the dinosaur and end the game on a win", (await game(page)).phase === "end" && (await game(page)).step === 8 && (await dig()).awake === true && /dinosaur woke up/i.test(await page.locator("#endTitle").innerText()));
    await page.waitForTimeout(300);
    const l = await log(page);
    noOverlap("dino", l);
    ok("dino: every chime and dig sound waited for a closed mic", l.sfx.every((c) => c.live === 0), l.sfx.filter((c) => c.live));
    ok("dino: the dig made its own sounds (brush, pop) through the engine", l.sounds.some((x) => x.kind === "buf" && x.len > 1000), l.sounds.length);
    ok("dino: Echo's words are one word each, calm, with no carrier phrase", l.speech.every((t) => /^Say\.\.\. [a-z]+\.$/i.test(t)), l.speech);
    ok("dino: nothing was written as practice", JSON.stringify(await practiceState(page)) === JSON.stringify(before));
    await page.locator("#again").click();
    ok("dino: Play again starts over: no bones, no brush", (await game(page)).step === 0 && (await dig()).found === 0 && (await dig()).state === "idle" && (await page.locator("#dots i.on").count()) === 0);
    clean("dino", errors);
  } finally { await context.close(); }
});

}
// ── BUBBLE POP, rebuilt to be played (Travis, 1 Oct 2026: "yeah B": "Say it,
// and Echo blows bubbles"). The word blows a cloud of bubbles; the finger pops
// them all; the gold one drops the word's picture into the basket; five words,
// then one giant bubble with Echo inside. For ages 3-4, so five steps. ──
// Its own part and its own suite (tests/bubblestest.mjs): the three games above
// already take most of run-all's five minutes a suite.
if (PART === "bubbles") {
async function sayForBubbles(page) {
  if (!(await sayIt(page))) return false;
  return until(page, () => window.__bubbles && window.__bubbles.state === "ready" && window.__bubbles.bubbles.length > 0 && window.__bubbles.bubbles.every((b) => b.out), 5000);
}
// pop every bubble that is out, the plain ones first; a fresh look each time,
// because the bubbles bob and a remembered spot goes stale
async function popBubbles(page) {
  const box = await page.locator("#sky").boundingBox();
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => window.Bubbles.snapshot()); if (!s.left) return true;
    const b = s.bubbles.find((x) => x.out && !x.gold) || s.bubbles.find((x) => x.out);
    if (b) await page.mouse.click(box.x + b.x, box.y + b.y);
    await page.waitForTimeout(70);
  }
  return (await page.evaluate(() => window.Bubbles.snapshot())).left === 0;
}
await scenario("bubbles popped", async () => {
  const { context, page, errors } = await fresh("arcade-bubbles.html", { age: "4", micok: true, permission: "granted" });
  // a fresh look each time: the bubbles bob, so a remembered spot goes stale
  const sky = () => page.evaluate(() => window.Bubbles.snapshot());
  const tap = async (box, b) => { await page.mouse.click(box.x + b.x, box.y + b.y); await page.waitForTimeout(70); };
  const popAll = async (box) => {
    for (let i = 0; i < 40; i++) {
      const s = await sky(); if (!s.left) return true;
      const b = s.bubbles.find((x) => x.out && !x.gold) || s.bubbles.find((x) => x.out);
      if (b) await tap(box, b); else await page.waitForTimeout(60);
    }
    return (await sky()).left === 0;
  };
  // a spot of sky with no bubble near it
  const empty = (s, box) => { for (let y = 12; y < box.height * 0.7; y += 14) for (let x = 12; x < box.width - 12; x += 14) if (s.bubbles.every((b) => Math.hypot(b.x - x, b.y - y) > b.r * 1.9 + 16)) return { x, y }; return null; };
  // a spot just OUTSIDE a plain bubble's rim (k radii from its middle), and
  // well clear of every other bubble: a small finger that nearly hit it
  const beside = (s, box, k) => {
    for (const b of s.bubbles.filter((x) => !x.gold && x.out)) for (let d = 0; d < 12; d++) {
      const a = d * Math.PI / 6, x = b.x + Math.cos(a) * b.r * k, y = b.y + Math.sin(a) * b.r * k;
      if (x > 4 && y > 4 && x < box.width - 4 && y < box.height * 0.7 && s.bubbles.every((o) => o === b || Math.hypot(o.x - x, o.y - y) > o.r * 1.6 + 16)) return { x, y };
    }
    return null;
  };
  try {
    await page.locator("#startOvl.show").waitFor();
    ok("bubbles: it is open on Home for little kids, free, with no day on it", await page.evaluate(() => { const a = Sona.GAME_ACTS.bubbles; return !a.comingSoon && !a.comingOn && !a.say && a.group === "simple" && a.tier === "free" && a.go === "/arcade-bubbles.html" && Sona.gameAccess("bubbles").allowed; }));
    ok("bubbles: the start card says how to play: say the word, then pop them all", /Say the word and Echo blows bubbles/.test(await page.locator("#startOvl").innerText()) && /Pop them all/i.test(await page.locator("#startOvl").innerText()));
    const before = await practiceState(page);
    const repsBefore = await page.evaluate(() => Sona.weekReps(0));
    await page.locator("#startBtn").click();
    const box = await page.locator("#sky").boundingBox();
    await page.waitForFunction(() => window.__sayplay.listening === true);
    // NO WORD, NO BUBBLES: there is nothing to pop, and a tap makes none
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3);
    await page.keyboard.press("Space");
    await page.waitForTimeout(250);
    let s = await sky();
    ok("bubbles: before the word there are no bubbles, and a tap or a key makes none", s.state === "idle" && s.left === 0 && s.popped === 0, s);
    await page.waitForTimeout(1500);
    ok("bubbles: silence blows no bubbles", (await sky()).state === "idle" && (await game(page)).step === 0);
    ok("bubbles: the child's word blows the bubbles, and the mic closes", await sayForBubbles(page) && (await live(page)) === 0);
    s = await sky();
    ok("bubbles: the word alone pops nothing: the step waits for the finger", (await game(page)).step === 0 && (await game(page)).phase === "play" && s.popped === 0 && s.left === 6, s);
    ok("bubbles: it says what to do", /Pop the bubbles/.test(await page.locator("#micState").innerText()));
    ok("bubbles: one of them is gold, with the word's picture inside it", s.bubbles.filter((b) => b.gold).length === 1 && await page.evaluate(() => { const p = document.getElementById("prize"); return !p.hidden && p.children.length > 0 && p.getBoundingClientRect().width > 8; }));
    ok("bubbles: every bubble is on the sky, clear of the basket, and big enough for a small finger", await page.evaluate(() => { const c = document.getElementById("sky").getBoundingClientRect(), k = document.getElementById("basket").getBoundingClientRect(); return window.Bubbles.snapshot().bubbles.every((b) => b.r * 2 >= 44 && b.x - b.r >= -2 && b.x + b.r <= c.width + 2 && b.y - b.r >= -2 && c.top + b.y + b.r <= k.top + 2); }), s.bubbles);
    // a tap on empty sky pops nothing
    const gap = empty(s, box);
    if (gap) { await page.mouse.click(box.x + gap.x, box.y + gap.y); await page.waitForTimeout(120); }
    ok("bubbles: a tap on the empty sky pops nothing", !!gap && (await sky()).popped === 0 && (await sky()).left === 6, { gap });
    // a small finger that lands just outside a bubble's rim still pops it
    const edge = beside(await sky(), box, 1.1);
    if (edge) { await page.mouse.click(box.x + edge.x, box.y + edge.y); await page.waitForTimeout(120); }
    ok("bubbles: a touch just beside a bubble still pops it (a three-year-old's finger)", !!edge && (await sky()).popped === 1 && (await sky()).left === 5, { edge });
    // one plain bubble, hit in the middle: a pop, not a step
    s = await sky(); await tap(box, s.bubbles.find((b) => !b.gold));
    s = await sky();
    ok("bubbles: a tap on a bubble pops it, and the step still waits", s.popped === 2 && s.left === 4 && s.basket === 0 && (await game(page)).step === 0, s);
    // the gold one: the picture flies to the basket, and the rest still need popping
    await tap(box, s.bubbles.find((b) => b.gold));
    ok("bubbles: the gold bubble drops the word's picture into the basket", await until(page, () => window.Bubbles.snapshot().basket === 1, 3000) && await page.evaluate(() => { const w = document.querySelector("#basket .well.full"); return !!w && w.children.length > 0 && document.getElementById("prize").hidden; }));
    s = await sky();
    ok("bubbles: …and with bubbles still out, that is not yet a step", s.left === 3 && (await game(page)).step === 0 && (await game(page)).phase === "play", s);
    ok("bubbles: popping them all moves the game one step and fills a dot", await popAll(box) && await until(page, () => window.__sayplay.step === 1, 4000) && (await page.locator("#dots i.on").count()) === 1);
    ok("bubbles: then the next word is asked for", await until(page, () => window.__sayplay.listening === true, 8000));
    // THE HELP: bubbles left alone glow, then a touch anywhere pops the nearest.
    // A bubble never pops by itself.
    await sayForBubbles(page);
    const turnsBefore = (await log(page)).speech.length;
    await page.waitForTimeout(8400);
    s = await sky();
    ok("bubbles: left alone, the bubbles glow", s.help === true && s.left === 7 && s.popped === 6, s);
    await page.waitForTimeout(7200);
    s = await sky();
    ok("bubbles: …and they never pop by themselves", s.left === 7 && s.popped === 6 && s.state === "ready" && (await game(page)).step === 1, s);
    const far = empty(s, box);
    if (far) { await page.mouse.click(box.x + far.x, box.y + far.y); await page.waitForTimeout(120); }
    ok("bubbles: later still, a touch anywhere pops the nearest one", s.any === true && !!far && (await sky()).popped === 7, { far, any: s.any });
    // …and that help stays on for the word: the child who needs it most does
    // not wait the whole fourteen seconds again for every bubble. A beat
    // between them, so one dragged finger cannot empty the sky.
    const far0 = empty(await sky(), box);
    if (far0) { await page.mouse.click(box.x + far0.x, box.y + far0.y); await page.waitForTimeout(120); }
    ok("bubbles: the very next far touch pops nothing more (a beat between them)", !!far0 && (await sky()).popped === 7, await sky());
    await page.waitForTimeout(1700);
    const far2 = empty(await sky(), box);
    if (far2) { await page.mouse.click(box.x + far2.x, box.y + far2.y); await page.waitForTimeout(120); }
    ok("bubbles: a beat later the next far touch pops another: the help stays on for this word", !!far2 && (await sky()).popped === 8, await sky());
    ok("bubbles: …and no new word was asked for on the way", (await log(page)).speech.length === turnsBefore);
    // PAUSE with bubbles out: the same bubbles wait
    const leftBefore = (await sky()).left;
    await page.evaluate(() => __quiet.background());
    await page.waitForTimeout(200);
    ok("bubbles: hiding the page pauses the sky", (await page.locator("#pauseOvl.show").count()) === 1 && (await sky()).frozen === true);
    await page.evaluate(() => __quiet.foreground());
    await page.keyboard.press("Space");          // a key while paused pops nothing
    await page.waitForTimeout(120);
    ok("bubbles: nothing pops while it is paused", (await sky()).left === leftBefore && (await sky()).frozen === true);
    await page.locator("#resume").click();
    s = await sky();
    ok("bubbles: Keep playing gives the same bubbles back, with no new word", s.state === "ready" && s.left === leftBefore && s.frozen === false && (await game(page)).phase === "play" && (await game(page)).step === 1, s);
    ok("bubbles: …and says again what to do (the pause wipes the line beside Echo)", /Pop the bubbles/.test(await page.locator("#micState").innerText()));
    ok("bubbles word 2: popped, and its picture is in the basket", await popAll(box) && await until(page, () => window.__sayplay.step === 2 && window.Bubbles.snapshot().basket === 2, 4000), await sky());
    // the rest of the round: a finger dragged across the sky pops what it crosses
    for (let n = 3; n <= 5; n++) {
      await until(page, () => window.__sayplay.listening === true, 8000);
      await sayForBubbles(page);
      if (n === 3) {
        s = await sky();
        const a = s.bubbles.filter((b) => !b.gold).slice(0, 2);
        await page.mouse.move(box.x + a[0].x, box.y + a[0].y); await page.mouse.down();
        for (let i = 1; i <= 6; i++) { await page.mouse.move(box.x + a[0].x + (a[1].x - a[0].x) * i / 6, box.y + a[0].y + (a[1].y - a[0].y) * i / 6); await page.waitForTimeout(15); }
        await page.mouse.up();
        ok("bubbles: a finger dragged across the sky pops what it crosses", (await sky()).left <= s.left - 2, await sky());
      }
      ok("bubbles word " + n + ": every bubble popped", await popAll(box));
      if (n < 5) ok("bubbles word " + n + ": the picture is in the basket and the dot is filled", await until(page, (k) => window.__sayplay.step === k && window.Bubbles.snapshot().basket === k, 4000, n), await sky());
    }
    // THE FINISH: Echo floats up in one giant bubble, and the last step waits for its pop
    ok("bubbles: after the fifth word, Echo floats up inside one giant bubble", await until(page, () => window.__bubbles.state === "giant" && window.__bubbles.giant && window.__bubbles.giant.up, 6000) && (await sky()).basket === 5);
    await page.waitForTimeout(6500);   // past the giant's own help: a gold ring at 5 s, any touch at 6 s
    ok("bubbles: …and the round waits for it to be popped: it never pops by itself", (await sky()).state === "giant" && (await game(page)).step === 4 && (await game(page)).phase === "play" && (await page.locator("#endOvl.show").count()) === 0 && /big bubble/i.test(await page.locator("#micState").innerText()));
    // left that long, a touch anywhere on the sky pops it
    await page.mouse.click(box.x + 12, box.y + 12);
    ok("bubbles: left that long, a touch anywhere on the sky pops the big bubble", await until(page, () => window.__bubbles.state !== "giant", 2000));
    await page.locator("#endOvl.show").waitFor({ timeout: 9000 });
    ok("bubbles: popping it ends the game on a win, five words and five pictures", (await game(page)).phase === "end" && (await game(page)).step === 5 && (await sky()).basket === 5 && /popped them all/i.test(await page.locator("#endTitle").innerText()));
    ok("bubbles: far more to pop than the five the old game had", (await sky()).popped >= 30, (await sky()).popped);
    await page.waitForTimeout(300);
    const l = await log(page);
    noOverlap("bubbles", l);
    ok("bubbles: every chime and pop waited for a closed mic", l.sfx.every((c) => c.live === 0), l.sfx.filter((c) => c.live));
    ok("bubbles: the sky made its own sounds (the blow, the pops) through the engine", l.sounds.filter((x) => x.kind === "buf" && x.len > 1000).length >= 30, l.sounds.length);
    ok("bubbles: Echo's words are one word each, calm, with no carrier phrase", l.speech.length >= 5 && l.speech.every((t) => /^Say\.\.\. [a-z]+\.$/i.test(t)), l.speech);
    ok("bubbles: nothing was written as practice", JSON.stringify(await practiceState(page)) === JSON.stringify(before));
    ok("bubbles: each heard word is one rep on the week's count, and a pop is not", (await page.evaluate(() => Sona.weekReps(0))) === repsBefore + 5);
    await page.locator("#again").click();
    ok("bubbles: Play again starts over: no bubbles, an empty basket", (await game(page)).step === 0 && (await sky()).words === 0 && (await sky()).basket === 0 && (await sky()).state === "idle" && (await page.locator("#dots i.on").count()) === 0);
    clean("bubbles", errors);
  } finally { await context.close(); }
});
// Bubble Pop on the smallest phone: the sky, the basket and the word all fit
await scenario("bubbles small phone", async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: "reduce" });
  await context.route("**/*", (route) => (route.request().url().startsWith(BASE + "/") ? route.continue() : route.abort()));
  await context.addInitScript(fakeDevice, { age: "4", micok: true, permission: "granted" });
  const page = await context.newPage(); page.setDefaultTimeout(6000);
  try {
    await page.goto(BASE + "/arcade-bubbles.html");
    await page.locator("#startBtn").click();
    await sayForBubbles(page);
    const fit = await page.evaluate(() => {
      const r = (id) => document.getElementById(id).getBoundingClientRect(), sky = r("sky"), panel = r("turnPanel"), basket = r("basket"), echo = r("bubEcho");
      return { wide: document.documentElement.scrollWidth <= innerWidth, sky: sky.top >= 0 && sky.bottom <= innerHeight, panel: panel.bottom <= innerHeight, basket: basket.bottom <= sky.bottom && basket.left >= sky.left && basket.right <= sky.right, echo: echo.right <= basket.left + 4,
        bubbles: window.Bubbles.snapshot().bubbles.every((b) => b.r * 2 >= 40 && sky.top + b.y + b.r <= basket.top + 2) };
    });
    ok("bubbles on a 320 x 568 phone: the sky, the basket, Echo and the word panel all fit, with nothing off the side", Object.values(fit).every(Boolean), fit);
  } finally { await context.close(); }
});
// IN THE IPHONE APP THE POPS ARE MEDIA, as Piano Tiles' notes are. A pop comes
// seconds after the mic closes, and an iPhone plays Web Audio on a page that
// just had the mic open as a quiet phone call (and not at all with the ringer
// off): the pops are the game, and on the phone they would not be there.
// the fake iPhone app: Capacitor says native, and every media element the page
// makes is counted (how many times each was played)
async function inApp(cfg) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (route) => (route.request().url().startsWith(BASE + "/") ? route.continue() : route.abort()));
  await context.addInitScript(fakeDevice, Object.assign({ age: "4", micok: true, permission: "granted" }, cfg || {}));
  await context.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", Plugins: {} };
    window.__media = [];
    const Real = window.Audio;
    window.Audio = function (src) { const a = new Real(src); const rec = { src: String(src || ""), plays: 0 }; window.__media.push(rec); const play = a.play.bind(a); a.play = function () { rec.plays++; return play(); }; return a; };
  });
  const page = await context.newPage(); page.setDefaultTimeout(6000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/arcade-bubbles.html");
  return { context, page, errors };
}
const mediaPlays = (page) => page.evaluate(() => { const m = window.__media.filter((x) => x.src.startsWith("blob:")); return { elements: m.length, plays: m.reduce((n, x) => n + x.plays, 0) }; });
const webSounds = async (page) => (await log(page)).sounds.filter((x) => x.kind === "buf" && x.len > 1000).length;
await scenario("bubbles in the app", async () => {
  const { context, page, errors } = await inApp();
  try {
    await page.locator("#startBtn").click();
    ok("bubbles in the app: the word blows the bubbles", await sayForBubbles(page));
    ok("bubbles in the app: word one's bubbles popped", await popBubbles(page) && await until(page, () => window.__sayplay.step === 1, 4000));
    // word one: the blow, five plain pops, the gold one, the drop into the basket
    let m = await mediaPlays(page);
    ok("bubbles in the app: the blow, each pop, the gold one and the drop all play as media elements", m.plays === 8, m);
    ok("bubbles in the app: …and nothing goes through Web Audio, the blow included", (await webSounds(page)) === 0, await webSounds(page));
    // the rest of the round, the giant bubble included
    for (let n = 2; n <= 5; n++) { await until(page, () => window.__sayplay.listening === true, 8000); await sayForBubbles(page); await popBubbles(page); }
    await until(page, () => window.__bubbles.state === "giant" && window.__bubbles.giant && window.__bubbles.giant.up, 6000);
    const box = await page.locator("#sky").boundingBox(), g = (await page.evaluate(() => window.Bubbles.snapshot())).giant;
    await page.mouse.click(box.x + g.x, box.y + g.y);
    await page.locator("#endOvl.show").waitFor({ timeout: 9000 });
    m = await mediaPlays(page);
    // 36 small bubbles, five blows and five drops, then the giant's blow and its pop
    ok("bubbles in the app: a whole round's sounds are media: every pop, and the giant bubble's own", m.plays === 48 && m.elements === 11, m);
    ok("bubbles in the app: …still nothing through Web Audio", (await webSounds(page)) === 0, await webSounds(page));
    await page.waitForTimeout(300);
    noOverlap("bubbles in the app", await log(page));
    clean("bubbles in the app", errors);
  } finally { await context.close(); }
});
await scenario("bubbles in the app, media refused", async () => {
  const { context, page, errors } = await inApp({ refuseMedia: true });
  try {
    await page.locator("#startBtn").click();
    ok("bubbles in the app, media refused: the word still blows the bubbles", await sayForBubbles(page) && await popBubbles(page) && await until(page, () => window.__sayplay.step === 1, 4000));
    const l = await log(page), web = l.sounds.filter((x) => x.kind === "buf" && x.len > 1000);
    ok("bubbles in the app, media refused: a phone that will not start a media element gets the sounds through Web Audio, never silence", web.length >= 7, web.length);
    ok("bubbles in the app, media refused: …and none of them under a mic", web.every((x) => x.live === 0), web.filter((x) => x.live));
    clean("bubbles in the app, media refused", errors);
  } finally { await context.close(); }
});
await scenario("bubbles in the app, sound off", async () => {
  const { context, page, errors } = await inApp({ volume: 0 });
  try {
    await page.locator("#startBtn").click();
    ok("bubbles in the app, sound off: the game still plays", await sayForBubbles(page) && await popBubbles(page) && await until(page, () => window.__sayplay.step === 1, 4000));
    const m = await mediaPlays(page);
    ok("bubbles in the app, sound off: a muted Sona stays silent: no pop plays, as media or any other way", m.plays === 0 && (await webSounds(page)) === 0, { m, web: await webSounds(page) });
    clean("bubbles in the app, sound off", errors);
  } finally { await context.close(); }
});
// THE QUARTER SECOND AFTER A WORD'S LAST BUBBLE (an engine race, found in
// review): the next word is owed, the page is hidden, and "Keep playing" came
// back to an empty sky with no word, no mic and no way on. The engine now
// calls that moment "step", which resume() reads as "the next word".
await scenario("bubbles hidden right after a word", async () => {
  const { context, page, errors } = await fresh("arcade-bubbles.html", { age: "4", micok: true, permission: "granted" });
  try {
    await page.locator("#startBtn").click();
    await sayForBubbles(page);
    // hide the page the instant the step counts
    const hidden = page.evaluate(() => new Promise((done) => { const t = setInterval(() => { if (window.__sayplay.step === 1) { clearInterval(t); const phase = window.__sayplay.phase; __quiet.background(); done(phase); } }, 4); }));
    await popBubbles(page);
    const phase = await hidden;
    await page.waitForTimeout(400);
    ok("bubbles hidden right after a word: the page was hidden while the next word was owed, and it paused", phase === "step" && (await page.locator("#pauseOvl.show").count()) === 1 && (await game(page)).listening === false, { phase });
    const asked = (await log(page)).speech.length;
    await page.evaluate(() => __quiet.foreground());
    await page.locator("#resume").click();
    ok("bubbles hidden right after a word: Keep playing asks for the next word and listens (it was an empty sky with no way on)", await until(page, () => window.__sayplay.listening === true, 8000) && (await game(page)).step === 1 && (await log(page)).speech.length === asked + 1, await game(page));
    ok("bubbles hidden right after a word: …and the game goes on", await sayForBubbles(page) && await popBubbles(page) && await until(page, () => window.__sayplay.step === 2, 4000));
    clean("bubbles hidden right after a word", errors);
  } finally { await context.close(); }
});
// A SLOW MICROPHONE. An iPhone is recording before its mic request answers, so
// a word that starts while a request is pending is already under the mic. The
// old Bubble Pop had these on simple-play.js; nothing delayed a mic request on
// this engine for any game.
for (const gumDelay of [300, 500]) for (const tapAfter of [150, 300]) {
  const label = "bubbles, a " + gumDelay + " ms mic request, Hear it " + tapAfter + " ms in";
  await scenario(label, async () => {
    const { context, page, errors } = await fresh("arcade-bubbles.html", { age: "4", micok: true, permission: "granted", gumDelay });
    try {
      await page.locator("#startBtn").click();
      await page.waitForFunction(() => __quiet.requests === 1);
      await page.waitForTimeout(tapAfter);
      const pending = await page.evaluate(() => { const p = __quiet.inflight === 1; document.getElementById("hear").click(); return p; });
      ok(label + ": the tap landed while the phone was still answering (or just after)", pending || tapAfter + 100 > gumDelay, { pending });
      ok(label + ": Echo says the word again", await until(page, () => __quiet.speech.length >= 2, 6000));
      ok(label + ": the mic reopens, the child is heard, and popping the bubbles moves the game", await sayForBubbles(page) && await popBubbles(page) && await until(page, () => window.__sayplay.step === 1, 4000));
      await page.waitForTimeout(300);
      noOverlap(label, await log(page));
      clean(label, errors);
    } finally { await context.close(); }
  });
}

}
if (PART === "engine") {
// ── the first time: a grown-up says yes before any mic prompt ──
await scenario("primer: not now", async () => {
  const { context, page, errors } = await fresh("arcade-rocket.html", { age: "4", permission: "prompt", unparked: true });
  try {
    await page.locator("#startBtn").click();
    await page.locator("#primer.show").waitFor();
    ok("primer: the grown-up sees the mic promise before any prompt", (await page.evaluate(() => __quiet.requests)) === 0 && (await page.locator("#micPromise").innerText()).length > 20);
    await page.locator("#primerNo").click();
    await page.waitForTimeout(300);
    ok("primer: \"Not now\" never asks for the mic, and explains why the game needs it", (await page.evaluate(() => __quiet.requests)) === 0 && /needs to hear you/i.test(await page.locator("#primer").innerText()));
    await page.locator("#byeBtn").click();
    await page.waitForURL(/\/today\.html$/);
    ok("primer: Okay goes home", new URL(page.url()).pathname === "/today.html");
    clean("primer: not now", errors);
  } finally { await context.close(); }
});
await scenario("primer: yes", async () => {
  const { context, page, errors } = await fresh("arcade-rocket.html", { age: "4", permission: "prompt", unparked: true });
  try {
    await page.locator("#startBtn").click();
    await page.locator("#primer.show").waitFor();
    await page.locator("#primerYes").click();
    ok("primer: the mic is asked for on the grown-up's tap", (await page.evaluate(() => __quiet.requests)) === 1);
    ok("primer: then the game starts listening for the first word", await until(page, () => window.__sayplay.listening === true, 8000));
    ok("primer: the yes is remembered", await page.evaluate(() => localStorage.getItem("sona.micok") === "1"));
    clean("primer: yes", errors);
  } finally { await context.close(); }
});
await scenario("primer: refused", async () => {
  const { context, page, errors } = await fresh("arcade-rocket.html", { age: "4", permission: "prompt", micMode: "deny", unparked: true });
  try {
    await page.locator("#startBtn").click();
    await page.locator("#primerYes").click();
    ok("refused: the usual help screen, and the game does not go on", await until(page, () => !!document.getElementById("sonaMicDenied"), 3000) && (await game(page)).phase === "denied");
    clean("refused", errors);
  } finally { await context.close(); }
});

// ── a hidden page pauses; coming back takes a tap ──
await scenario("pause", async () => {
  const { context, page, errors } = await fresh("arcade-castle.html", { age: "7", micok: true, permission: "granted", unparked: true });
  try {
    await page.locator("#startBtn").click();
    await page.waitForFunction(() => window.__sayplay.listening === true);
    const word = (await game(page)).word;
    await page.evaluate(() => __quiet.background());
    await page.waitForTimeout(200);
    ok("pause: hiding the page closes the mic and shows Paused", (await live(page)) === 0 && (await page.locator("#pauseOvl.show").count()) === 1);
    await page.evaluate(() => __quiet.foreground());
    await page.waitForTimeout(600);
    ok("pause: coming back waits for a tap: no mic, no sound", (await live(page)) === 0 && (await page.evaluate(() => __quiet.speaking)) === 0);
    await voice(page, 300);
    ok("pause: talking to a paused game moves nothing", (await game(page)).step === 0);
    await page.locator("#resume").click();
    ok("pause: Keep playing asks for the same word again", await until(page, () => window.__sayplay.listening === true, 8000) && (await game(page)).word === word);
    await sayIt(page);
    ok("pause: and the game goes on", await until(page, () => window.__sayplay.step === 1, 3000));
    noOverlap("pause", await log(page));
    clean("pause", errors);
  } finally { await context.close(); }
});

// ── a quiet child: the mic closes after a while and waits for a tap to listen again ──
await scenario("quiet child", async () => {
  const { context, page, errors } = await fresh("arcade-stars.html", { age: "4", micok: true, permission: "granted", voiceOn: false, unparked: true });
  try {
    await page.locator("#startBtn").click();
    await page.waitForFunction(() => window.__sayplay.listening === true);
    ok("quiet: after a long silence the mic closes and offers a tap to listen again",
      await until(page, () => window.__sayplay.phase === "nudge", 14000) && (await live(page)) === 0 && await page.locator("#micBtn").isVisible());
    ok("quiet: the silence moved nothing", (await game(page)).step === 0);
    await page.locator("#micBtn").click();
    ok("quiet: the tap only listens again: it moves nothing", await until(page, () => window.__sayplay.listening === true, 4000) && (await game(page)).step === 0);
    await sayIt(page);
    ok("quiet: the child's word then moves the game", await until(page, () => window.__sayplay.step === 1, 3000));
    clean("quiet", errors);
  } finally { await context.close(); }
});

// ── a locked game goes back to Home before anything starts ──
await scenario("locked", async () => {
  const { context, page, errors } = await fresh("arcade-monster.html", { age: "7", micok: true, permission: "granted", premium: false, paid: true, unparked: true });
  try {
    await page.waitForURL(/\/(?:activities|today)\.html/, { timeout: 6000 });
    ok("locked: a Premium game bounces a family without it, before any mic or sound", (await page.evaluate(() => __quiet.requests)) === 0 && /locked=monster/.test(page.url() + (await page.evaluate(() => location.search))));
    clean("locked", errors);
  } finally { await context.close(); }
});

}
await browser.close(); await new Promise((resolve) => server.close(resolve));
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
