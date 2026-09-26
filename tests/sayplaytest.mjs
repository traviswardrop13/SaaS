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
//     exactly what tools/gameart/build.mjs writes.
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
const server = createServer((req, res) => {
  const url = new URL(req.url, BASE), file = path.join(ROOT, url.pathname);
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
  HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };

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
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done");
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

async function fresh(file, cfg = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (route) => (route.request().url().startsWith(BASE + "/") ? route.continue() : route.abort()));
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
ok("twenty Say & Play games, ten for each age group", GAMES.length === 20 && GAMES.filter((g) => g.group === "simple").length === 10 && GAMES.filter((g) => g.group === "arcade").length === 10);
ok("ages 3-4 play five words a game and ages 5-8 play eight", GAMES.every((g) => g.steps.length === (g.group === "simple" ? 5 : 8)));
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
    ok("the parked titles still close the Simple play shelf", simple.slice(-2).join() === "bubbles,peekaboo", simple);
    ok("no Say & Play game joins the daily adventure", !cat.adventure.some((k) => KEYS.includes(k)), cat.adventure);
    ok("each game wears its own sticker", cat.stickers.every((s, i) => s === "sp-" + KEYS[i]));
    ok("Home shows a card for every game", KEYS.every((k) => cat.cards.includes(k)));
    const btn = page.locator('#activityGroups button[data-game="balloon"]');
    await btn.click();
    await page.waitForURL(/\/arcade-balloon\.html$/);
    ok("a card opens its game straight away, with no practice first", new URL(page.url()).pathname === "/arcade-balloon.html");
    clean("catalog", errors);
  } finally { await context.close(); }
});

// ── a whole game, twice: once small (five words), once big (eight) ──
for (const key of ["balloon", "racecar"]) {
  await scenario(key + " played through", async () => {
    const { context, page, errors } = await fresh("arcade-" + key + ".html", { age: key === "balloon" ? "4" : "7", micok: true, permission: "granted" });
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
    const { context, page, errors } = await fresh("arcade-" + g.key + ".html", { age: g.group === "simple" ? "4" : "7", micok: true, permission: "granted", voiceOn: false });
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

// ── the first time: a grown-up says yes before any mic prompt ──
await scenario("primer: not now", async () => {
  const { context, page, errors } = await fresh("arcade-rocket.html", { age: "4", permission: "prompt" });
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
  const { context, page, errors } = await fresh("arcade-rocket.html", { age: "4", permission: "prompt" });
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
  const { context, page, errors } = await fresh("arcade-rocket.html", { age: "4", permission: "prompt", micMode: "deny" });
  try {
    await page.locator("#startBtn").click();
    await page.locator("#primerYes").click();
    ok("refused: the usual help screen, and the game does not go on", await until(page, () => !!document.getElementById("sonaMicDenied"), 3000) && (await game(page)).phase === "denied");
    clean("refused", errors);
  } finally { await context.close(); }
});

// ── a hidden page pauses; coming back takes a tap ──
await scenario("pause", async () => {
  const { context, page, errors } = await fresh("arcade-castle.html", { age: "7", micok: true, permission: "granted" });
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
  const { context, page, errors } = await fresh("arcade-stars.html", { age: "4", micok: true, permission: "granted", voiceOn: false });
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
  const { context, page, errors } = await fresh("arcade-monster.html", { age: "7", micok: true, permission: "granted", premium: false, paid: true });
  try {
    await page.waitForURL(/\/(?:activities|today)\.html/, { timeout: 6000 });
    ok("locked: a Premium game bounces a family without it, before any mic or sound", (await page.evaluate(() => __quiet.requests)) === 0 && /locked=monster/.test(page.url() + (await page.evaluate(() => location.search))));
    clean("locked", errors);
  } finally { await context.close(); }
});

await browser.close(); await new Promise((resolve) => server.close(resolve));
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
