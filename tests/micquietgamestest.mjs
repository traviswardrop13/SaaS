// MICQUIET-GAMES: in the eight games, no sound Sona makes ever starts while a
// microphone track is live, or while one is still being asked for (24 Sep
// 2026).
//
// Why: on an iPhone a web page holding the mic runs as a phone call. The
// volume buttons change CALL volume, and every chime and every word of Echo's
// is processed like a call, so the loudness jumps each time the mic opens or
// closes under a sound. Travis heard exactly that. The rule these pins hold:
//   - the mic opens only for the child's turn, after the game's last sound has
//     had its quiet window, and closes BEFORE the next chime or word;
//   - STAR MODE (the always-on boost mic in the five arcade games) is gone;
//     only the "say your sound to keep playing" card listens, and only while it
//     shows;
//   - Piano Tiles' notes follow the Sound setting and are silent when muted;
//   - (24 Sep 2026) a child's try counts as reliably as it did with the mic
//     always open: a child who answers the instant the mic opens is heard
//     (the room's level is the page's quietest stretch, never the first
//     moments of a turn), a lock while the mic is being asked for doesn't
//     strand the card, and a sound asked for while the phone is still
//     answering a mic request waits for it instead of being dropped;
//   - (24 Sep 2026) a request still being answered IS the mic for this audit:
//     an iPhone starts recording before getUserMedia returns, so Echo's word
//     and every chime wait for a pending request to land, be closed, and
//     settle, exactly as they wait for a live track.
//
// It is also the other half of "the app never counts its own sound as the
// child": the fake microphone here hears everything the page plays (a phone's
// mic hears its own speaker), so a mic left open under a chime or Echo's voice
// would show up as a spurious revive or "Echo heard you!", not just as an
// overlap in the log.
//
// Device edges are fake — no real mic, speaker or voice — and time is one clock
// shared by the fake mic, Web Audio and speech, so intervals compare exactly.
// Nothing clinical is measured: revives and "heard you" cheers were never
// practice data, and nothing here writes any.
import { createServer } from "http";
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from "./_env.mjs";

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT;
const BASE = "http://127.0.0.1:8231";
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2" };
const server = createServer((req, res) => {
  const url = new URL(req.url, BASE), file = path.join(ROOT, url.pathname);
  // no voice service: Echo speaks through the (fake) browser voice, which the
  // log times exactly
  if (url.pathname.startsWith("/api/")) { res.writeHead(503, { "content-type": "application/json" }); res.end("{}"); return; }
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" });
  // Bubble Pop and Peekaboo are parked as Coming soon in the shipped catalog
  // (#140). Their engines still ship, so they are still audited here: the
  // test server flips only their comingSoon flag in the sona.js it serves —
  // the same fixture simpleplaytest uses; the app has no runtime unlock.
  res.end(url.pathname === "/sona.js" ? readFileSync(file, "utf8").replace(/(\b(?:bubbles|peekaboo)\s*:\s*\{[^}]*\bcomingSoon\s*:\s*)true/g, "$1false") : readFileSync(file));
});
await new Promise((resolve) => server.listen(8231, "127.0.0.1", resolve));
const browser = await chromium.launch(launchOpts());
let assertions = 0, failures = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, e.stack); } }

// ── the fake device: one clock, a mic that logs when it is live, and every
// sound the page makes (oscillators, buffers, browser speech) logged as an
// interval on that clock ──
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

  if (!localStorage.getItem("sona.test.quietSeed")) {
    localStorage.setItem("sona.test.quietSeed", "1");
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done");
    // earlyAdopter: a family holding every game, so this holds whichever way pricing points
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: cfg.age || "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true,
      voiceOn: cfg.voiceOn !== false, soundOn: cfg.soundOn !== false, volume: cfg.volume == null ? 0.6 : cfg.volume }));
    if (cfg.micok) localStorage.setItem("sona.micok", "1");
    if (cfg.token) sessionStorage.setItem("sona.play.token", cfg.token);
  }
}

async function fresh(file, cfg = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (route) => (route.request().url().startsWith(BASE + "/") ? route.continue() : route.abort()));
  await context.addInitScript(fakeDevice, cfg);
  const page = await context.newPage(); page.setDefaultTimeout(5000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/" + file);
  return { context, page, errors };
}
const live = (page) => page.evaluate(() => __quiet.live());
// a mic's interval starts when it was ASKED for (see micOn above); `landed`
// is when the page got its track, null for a request that failed
const log = (page) => page.evaluate(() => ({ mics: __quiet.mics.map((m) => ({ start: m.asked, landed: m.start, end: m.end == null ? __quiet.now() : m.end })), sounds: __quiet.sounds.map((s) => ({ kind: s.kind, start: s.start, end: s.end, live: s.live, len: s.len, text: s.text })), sfx: __quiet.sfx.slice(), requests: __quiet.requests, leakFrames: __quiet.leakFrames }));
async function voice(page, ms) { await page.evaluate(() => { __quiet.voice = true; }); await page.waitForTimeout(ms); await page.evaluate(() => { __quiet.voice = false; }); }
const talk = (page, on) => page.evaluate((v) => { __quiet.voice = v; }, on);
// waits for a condition and answers true/false, so a pin reports a clean FAIL
// on the old code instead of a harness timeout
const until = (page, fn, ms, arg) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);

// Every sound interval against every mic interval: none may overlap, and a
// sound starting after a mic closed leaves it at least `gap` seconds.
function overlaps(l) {
  const bad = [];
  for (const s of l.sounds) for (const m of l.mics) {
    if (s.start < m.end && m.start < s.end) bad.push({ sound: s.kind + (s.text ? ":" + s.text : ""), start: +s.start.toFixed(3), end: +(s.end === Infinity ? -1 : s.end).toFixed(3), mic: [+m.start.toFixed(3), +m.end.toFixed(3)] });
  }
  return bad;
}
function quietAfterClose(l, gap) {
  const bad = [];
  for (const s of l.sounds) for (const m of l.mics) if (s.start >= m.end && s.start - m.end < gap && s.start - m.end >= 0) bad.push({ sound: s.kind, after: +(s.start - m.end).toFixed(3) });
  return bad;
}
function noOverlap(label, l, extra) {
  ok(label + ": sounds were actually played and the mic actually opened (the check below is not vacuous)", l.sounds.length > 0 && l.mics.length > 0, { sounds: l.sounds.length, mics: l.mics.length, ...(extra || {}) });
  ok(label + ": no sound or voice ever starts or rings while a mic is live or being asked for", overlaps(l).length === 0, overlaps(l).slice(0, 6));
  ok(label + ": every sound after the mic closes leaves the phone a moment to switch back first", quietAfterClose(l, 0.15).length === 0, quietAfterClose(l, 0.15).slice(0, 6));
  ok(label + ": the mic never once heard the game's own sound", l.leakFrames === 0, { leakFrames: l.leakFrames });
}
function clean(label, errors) { ok(label + ": no runtime errors", errors.length === 0, errors); }
function stripComments(src) { return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1"); }

// ── the five arcade games: STAR MODE is gone; the keep-playing card is the
// only listener, and only while it shows ──
const ARCADE = [["run", "arcade-run.html"], ["slice", "arcade-slice.html"], ["stack", "arcade-stack.html"], ["tiles", "arcade-tiles.html"], ["glide", "arcade-glide.html"]];
for (const [key, file] of ARCADE) {
  const code = stripComments(readFileSync(ROOT + "/" + file, "utf8"));
  ok(key + ": STAR MODE and its always-on boost mic are gone from the code",
    !/boostChip|fireBoost|paintChip|STAR MODE|FRUIT FRENZY|GOLDEN KEYS|SLOW-MO|SUPER FLOAT|boost\.on/.test(code), "a power-up that listens for the whole game keeps an iPhone in call audio");
  ok(key + ": the keep-playing card still asks for the sound, family-checked", /to keep playing!/.test(code) && /famOK/.test(code) && /Sona\.frameShape/.test(code));

  await scenario(key + " keep-playing card", async () => {
    const { context, page, errors } = await fresh(file + "?from=charge", { token: file });
    try {
      await page.waitForFunction(() => window.gameEntryAllowed === true && typeof crash === "function");
      await page.waitForTimeout(600);
      ok(key + ": the game asks for no microphone while it plays", (await page.evaluate(() => __quiet.requests)) === 0 && !(await page.locator("#boostChip").count()));
      await page.evaluate(() => { if (playing) crash(); });
      await page.locator("#revOvl.show").waitFor();
      await page.waitForTimeout(150);
      ok(key + ": the card waits out the crash sound before it listens", (await live(page)) === 0 && /Get ready/.test(await page.locator("#revListen").innerText()));
      await page.waitForFunction(() => __quiet.live() === 1);
      // 24 Sep 2026: this pin used to expect "I'm listening…" the instant the
      // mic opened. The first card on a page now measures the room first
      // (FLOOR_MS, while the card still says "Get ready…") and says it is
      // listening only once there is a floor to listen against.
      ok(key + ": the first card measures the room before it says it is listening", /Get ready/.test(await page.locator("#revListen").innerText()));
      await page.waitForFunction(() => /listening/i.test(document.getElementById("revListen").textContent));
      ok(key + ": then it says it is listening, with the mic open", (await live(page)) === 1);
      // a game sound asked for while the card listens is dropped, not played
      // over the open mic — and nothing is revived by the game itself
      await page.evaluate(() => sfx("complete"));
      await page.waitForTimeout(900);
      const still = await page.evaluate(() => ({ rev: REV, card: document.getElementById("revOvl").classList.contains("show"), live: __quiet.live() }));
      ok(key + ": nothing plays over the listening card, and silence revives nothing", still.card && still.rev === 3 && still.live === 1, still);
      const before = (await log(page)).sfx.length;
      await voice(page, 450);
      await page.waitForFunction(() => REV === 2);
      await page.waitForTimeout(400);
      let l = await log(page);
      const chime = l.sfx.slice(before).find((c) => c.name === "complete");
      const closed = l.mics[0].end;
      ok(key + ": the child's sound revives, and the mic is closed before the revive chime", !!chime && chime.live === 0 && (await live(page)) === 0, { chime, closed });
      ok(key + ": the revive chime waits for the phone to switch back", !!chime && chime.at - closed >= 0.15, { chime, closed });
      // the second card: "I'm done playing" closes the mic before the round's chime
      await page.evaluate(() => { if (playing) crash(); });
      await page.locator("#revOvl.show").waitFor();
      await page.waitForFunction(() => __quiet.live() === 1);
      await page.locator("#revDone").click();
      await page.locator("#endOvl.show").waitFor();
      await page.waitForTimeout(500);
      l = await log(page);
      ok(key + ": \"I'm done playing\" closes the mic, then the round ends with a chime", (await live(page)) === 0 && l.sfx.some((c) => c.name === "complete" && c.live === 0 && c.at > l.mics[l.mics.length - 1].end));
      noOverlap(key, l);
      ok(key + ": the game's own sounds never counted as the child", (await page.evaluate(() => REV)) === 2);
      clean(key, errors);
    } finally { await context.close(); }
  });
}

// ── the card hears an eager child (24 Sep 2026) ──
// The card says "Say rrrr to keep playing!", so the moment its mic opens is
// exactly when an eager child is already saying it. The first cut of this
// change averaged each card's first 450 ms as the room's noise: the child's
// own voice became the room, the bar landed at 3.5× their voice, and the card
// could not be answered (reproduced by review: the child talks from the
// crash on, tries again, REV never moves; at HEAD the same child revived).
// The room's level is now the page's: the quietest stretch the mic has heard,
// taken as a low percentile, which can only ever go down.
for (const [key, file] of ARCADE) {
  await scenario(key + " eager child on the card", async () => {
    const { context, page, errors } = await fresh(file + "?from=charge", { token: file });
    try {
      await page.waitForFunction(() => window.gameEntryAllowed === true && typeof crash === "function");
      await page.waitForTimeout(300);
      // card one: talking from 0.3 s after the crash, straight through the
      // whole room measurement and past it
      await page.evaluate(() => { if (playing) crash(); });
      await page.waitForTimeout(300);
      await talk(page, true);
      await page.waitForFunction(() => __quiet.live() === 1);
      const listening = await until(page, () => /listening/i.test(document.getElementById("revListen").textContent), 2000);
      await page.waitForTimeout(200);
      await talk(page, false);
      ok(key + ": talked through, the card still finishes measuring and says it is listening", listening);
      // …then says it again
      await page.waitForTimeout(250);
      await voice(page, 450);
      const revived = await until(page, () => REV === 2, 1500);
      ok(key + ": a child who talks from 0.3 s after the crash through the whole room measurement, then says it again, revives", revived,
        await page.evaluate(() => ({ REV, note: document.getElementById("revListen").textContent, live: __quiet.live() })));
      // card two: the page keeps its floor, so a child already talking as the
      // mic opens is heard straight away — this card measures nothing new
      await page.waitForTimeout(400);
      await page.evaluate(() => { if (playing) crash(); });
      await page.waitForTimeout(300);
      await talk(page, true);
      const second = await until(page, () => REV === 1, 3000);
      const stillTalking = await page.evaluate(() => __quiet.voice);
      await talk(page, false);
      ok(key + ": on a later card the page's floor holds: a child already talking as the mic opens revives while still talking", second && stillTalking, { second, stillTalking });
      await page.waitForTimeout(400);
      noOverlap(key + " eager", await log(page));
      clean(key + " eager", errors);
    } finally { await context.close(); }
  });

  // ── a lock while the card's mic request is still pending (24 Sep 2026) ──
  // Locking closes the card's mic (bumping its generation); coming back asks
  // again — but found the old request still pending and stood down, and when
  // that request settled it was stale and went straight back. Nothing asked
  // again: the card sat on "Get ready…" and only "I'm done playing" got the
  // child out. Both ways a stale request can settle are pinned.
  await scenario(key + " lock during the card's mic request", async () => {
    const { context, page, errors } = await fresh(file + "?from=charge", { token: file });
    try {
      await page.waitForFunction(() => window.gameEntryAllowed === true && typeof crash === "function");
      await page.evaluate(() => { __quiet.gumPlan.push({ delay: 600 }); if (playing) crash(); });
      await page.waitForFunction(() => __quiet.requests === 1 && __quiet.inflight === 1);
      await page.evaluate(() => __quiet.background());
      await page.waitForTimeout(100);
      await page.evaluate(() => __quiet.foreground());   // back before the phone has answered
      const back = await until(page, () => __quiet.live() === 1, 2500);
      ok(key + ": locked while the card was asking for the mic, the card asks again once the late answer is sent back, and listens", back && (await page.evaluate(() => __quiet.requests)) === 2,
        await page.evaluate(() => ({ requests: __quiet.requests, live: __quiet.live(), note: document.getElementById("revListen").textContent })));
      // the same when the OS cuts the pending request short instead
      await page.evaluate(() => __quiet.background());
      await page.evaluate(() => { __quiet.gumPlan.push({ delay: 600, fail: true }); __quiet.foreground(); });
      await page.waitForFunction(() => __quiet.requests === 3 && __quiet.inflight === 1);
      await page.evaluate(() => __quiet.background());
      await page.waitForTimeout(100);
      await page.evaluate(() => __quiet.foreground());
      const back2 = await until(page, () => __quiet.live() === 1, 2500);
      ok(key + ": when that late request fails instead of answering, the card still asks again and listens", back2 && (await page.evaluate(() => __quiet.requests)) === 4 && (await page.locator("#revOvl.show").count()) === 1,
        await page.evaluate(() => ({ requests: __quiet.requests, live: __quiet.live() })));
      await until(page, () => /listening/i.test(document.getElementById("revListen").textContent), 1500);
      await voice(page, 450);
      ok(key + ": and that card hears the child", await until(page, () => REV === 2, 1500));
      await page.waitForTimeout(400);
      noOverlap(key + " lock", await log(page));
      clean(key + " lock", errors);
    } finally { await context.close(); }
  });
}

await scenario("run: backgrounding the card", async () => {
  const { context, page, errors } = await fresh("arcade-run.html?from=charge", { token: "arcade-run.html" });
  try {
    await page.waitForFunction(() => window.gameEntryAllowed === true && typeof crash === "function");
    await page.evaluate(() => { if (playing) crash(); });
    await page.waitForFunction(() => __quiet.live() === 1);
    await page.evaluate(() => __quiet.background());
    ok("run: locking the phone on the card releases the mic", (await live(page)) === 0);
    await page.evaluate(() => __quiet.foreground());
    await page.waitForFunction(() => __quiet.live() === 1);
    ok("run: coming back to the card listens again", (await page.evaluate(() => __quiet.requests)) === 2);
    noOverlap("run background", await log(page));
    clean("run background", errors);
  } finally { await context.close(); }
});

await scenario("slice: no microphone", async () => {
  const { context, page, errors } = await fresh("arcade-slice.html?from=charge", { token: "arcade-slice.html", micMode: "deny" });
  try {
    await page.waitForFunction(() => window.gameEntryAllowed === true && typeof crash === "function");
    await page.evaluate(() => { if (playing) crash(); });
    await page.locator("#endOvl.show").waitFor();
    ok("slice: a card that can't hear anyone ends the round kindly, not in a dead end", !(await page.locator("#revOvl.show").count()) && (await live(page)) === 0);
    clean("slice no mic", errors);
  } finally { await context.close(); }
});

// ── Piano Tiles: the notes follow the Sound setting ──
async function tapTile(page) {
  return page.evaluate(() => {
    __quiet.gains.length = 0; const n = __quiet.sounds.length;
    tiles.push({ lane: 0, y: HITY() - 40, h: 88, hit: false, gone: false, note: 440 });
    const r = document.getElementById("cv").getBoundingClientRect();
    document.getElementById("cv").dispatchEvent(new PointerEvent("pointerdown", { clientX: r.left + W / 8, clientY: r.top + HITY(), bubbles: true }));
    const peaks = __quiet.gains.map((g) => g.gain.sets.filter((s) => s[0] === "exp").map((s) => s[1])).flat().filter((v) => v > 0.001);
    return { sounds: __quiet.sounds.length - n, peak: peaks.length ? Math.max(...peaks) : 0, hit: tiles.some((t) => t.hit) };
  });
}
// "muted" is what Settings' Sound slider writes at zero (volume 0, voice and
// sounds off) — the state its "Muted — the games are silent" line describes
for (const [label, cfg, expect] of [["muted", { volume: 0, soundOn: false, voiceOn: false }, 0], ["volume 0.6", { volume: 0.6 }, 0.06], ["volume 1", { volume: 1 }, 0.10]]) {
  await scenario("tiles " + label, async () => {
    const { context, page, errors } = await fresh("arcade-tiles.html?from=charge", { token: "arcade-tiles.html", ...cfg });
    try {
      await page.waitForFunction(() => window.gameEntryAllowed === true && typeof tone === "function");
      const t = await tapTile(page);
      if (expect === 0) ok("tiles " + label + ": a tapped note makes no sound at all", t.hit && t.sounds === 0, t);
      else ok("tiles " + label + ": a tapped note peaks at 0.10 × the Sound slider (" + expect + "), not the old fixed 0.24", t.hit && t.sounds === 1 && Math.abs(t.peak - expect) < 1e-6, t);
      clean("tiles " + label, errors);
    } finally { await context.close(); }
  });
}

// ── Feed Echo: the mic opens after Echo asks, closes before every chime ──
await scenario("feed", async () => {
  const { context, page, errors } = await fresh("arcade-feed.html", { age: "4", micok: true, permission: "granted", volume: 0.6 });
  try {
    const ask = () => page.waitForFunction(() => /Where's the/.test(document.getElementById("bMain").textContent));
    await ask();
    await page.waitForFunction(() => __quiet.speaking > 0);
    ok("feed: no mic is open while Echo asks", (await live(page)) === 0);
    await page.waitForFunction(() => __quiet.live() === 1);
    const asked = await page.evaluate(() => __quiet.speech[0]);
    ok("feed: Echo's ask ends calmly, on a period, with the word unchanged", /^Where is the (.+)\? Say\.\.\. \1\.$/.test(asked) && !/!/.test(asked), asked);
    // a wrong tap while listening is answered by the wobble, not a sound over the mic
    const wrong = await page.evaluate(() => { const m = document.getElementById("bMain").textContent.match(/Where's the (.+)\?/); const b = [...document.querySelectorAll("#grid .cardBtn")].find((x) => x.querySelector(".w").textContent !== m[1]); if (b) b.click(); return !!b; });
    if (wrong) { await page.waitForTimeout(200); ok("feed: a wrong tap while listening wobbles silently and keeps listening", (await live(page)) === 1 && /Almost/.test(await page.locator("#bSub").innerText())); }
    await page.waitForTimeout(400);   // past calibration
    await voice(page, 300);
    await page.waitForFunction(() => window.__heard === 1);
    await page.waitForTimeout(350);
    let l = await log(page);
    const tap = l.sfx.find((c) => c.name === "tap" && c.at > l.mics[0].end);
    ok("feed: heard once, the mic closes, then the little chime", (await live(page)) === 0 && !!tap && tap.live === 0, { tap, mics: l.mics });
    // the other four turns: pick right while the mic is still open
    for (let i = 0; i < 5; i++) {
      if (i > 0) { await ask(); await page.waitForFunction(() => __quiet.live() === 1); }
      await page.evaluate(() => { const m = document.getElementById("bMain").textContent.match(/Where's the (.+)\?/); [...document.querySelectorAll("#grid .cardBtn")].find((x) => x.querySelector(".w").textContent === m[1]).click(); });
      if (i > 0) ok("feed turn " + (i + 1) + ": a right pick closes the mic before the chime", (await live(page)) === 0);
      await page.waitForTimeout(i < 4 ? 400 : 1600);
    }
    await page.locator("#endOvl.show").waitFor();
    await page.waitForTimeout(3200);
    l = await log(page);
    const complete = l.sfx.find((c) => c.name === "complete");
    const plucks = l.sounds.filter((s) => s.kind === "buf" && s.len > 1000);
    ok("feed: the concert plays", !!complete && plucks.length >= 20, { complete, plucks: plucks.length });
    ok("feed: the ukulele waits ~0.5 s after the chime instead of landing on it", !!complete && plucks.length > 0 && Math.min(...plucks.map((p) => p.start)) - complete.at >= 0.45, { chime: complete && complete.at, first: plucks.length && Math.min(...plucks.map((p) => p.start)) });
    const gains = await page.evaluate(() => __quiet.gains.map((g) => g.gain.sets));
    ok("feed: the ukulele's master is 0.2 × the Sound slider (0.12), ~9 dB under the old min(0.5, volume × 0.55)", gains.some((s) => s.some((x) => x[0] === "value" && Math.abs(x[1] - 0.12) < 1e-9)));
    const attacks = gains.filter((s) => s.length >= 3 && s[0][0] === "set" && s[0][1] === 0.0001 && s[1][0] === "exp" && s[1][1] >= 0.5).map((s) => s[1][2] - s[0][2]);
    ok("feed: every pluck fades in over 3–5 ms instead of starting as a raw noise burst", attacks.length === plucks.length && attacks.every((a) => a >= 0.003 - 1e-9 && a <= 0.005 + 1e-9), { attacks: attacks.slice(0, 4), n: attacks.length, plucks: plucks.length });
    noOverlap("feed", l);
    ok("feed: only the child's one burst was ever heard", (await page.evaluate(() => window.__heard)) === 1);
    clean("feed", errors);
  } finally { await context.close(); }
});

// ── Feed Echo: the child who answers Echo at once still hears "Echo heard
// you!" (24 Sep 2026). The first cut of this change averaged each turn's first
// 250 ms of mic as the room, which is exactly when a child answers "Say...
// robot.": their voice became the room and the cheer never came (review: at
// HEAD the same child got a star). ──
await scenario("feed eager", async () => {
  const { context, page, errors } = await fresh("arcade-feed.html", { age: "4", micok: true, permission: "granted", volume: 0.6 });
  try {
    await page.waitForFunction(() => __quiet.speaking > 0);
    await page.waitForFunction(() => __quiet.speaking === 0);
    await page.waitForTimeout(100);
    await talk(page, true);   // answering straight after Echo's word…
    await page.waitForFunction(() => __quiet.live() === 1);
    await page.waitForTimeout(400);   // …through the first stretch the mic hears, and past it
    await talk(page, false);
    const cheered = await until(page, () => window.__heard === 1, 1500);
    ok("feed: a child who answers right after Echo's word, talking through the first stretch the mic hears, still gets \"Echo heard you!\"", cheered,
      await page.evaluate(() => ({ heard: window.__heard, live: __quiet.live() })));
    await page.waitForTimeout(400);
    noOverlap("feed eager", await log(page));
    clean("feed eager", errors);
  } finally { await context.close(); }
});

// ── Feed Echo: a right pick while the phone is still answering the mic
// request keeps its chime, and a round finished then keeps its concert
// (24 Sep 2026). The mic request goes out 250 ms after Echo's ask; sfx() and
// the concert used to be DROPPED while it was pending, where every other game
// waits for it. ──
await scenario("feed slow mic", async () => {
  const { context, page, errors } = await fresh("arcade-feed.html", { age: "4", micok: true, permission: "granted", volume: 0.6, gumDelay: 400 });
  try {
    for (let i = 0; i < 5; i++) {
      // the last turn's request is still pending when the round finishes
      if (i === 4) await page.evaluate(() => { __quiet.gumPlan.push({ delay: 1500 }); });
      await page.waitForFunction((n) => __quiet.speech.length === n && __quiet.speaking === 0, i + 1);
      await page.waitForTimeout(350);
      const asking = await page.evaluate(() => __quiet.inflight === 1 && __quiet.live() === 0);
      const before = await page.evaluate(() => __quiet.sfx.filter((c) => c.name === "correct").length);
      await page.evaluate(() => { const m = document.getElementById("bMain").textContent.match(/Where's the (.+)\?/); [...document.querySelectorAll("#grid .cardBtn")].find((x) => x.querySelector(".w").textContent === m[1]).click(); });
      const chimed = await until(page, (b) => __quiet.sfx.filter((c) => c.name === "correct").length > b, 2500, before);
      const c = (await log(page)).sfx.filter((x) => x.name === "correct")[before];
      ok("feed slow mic turn " + (i + 1) + ": a right tap 350 ms after the ask, while the mic request is still pending, still plays the chime, with no mic open", asking && chimed && c && c.live === 0, { asking, chimed, c });
    }
    await page.locator("#endOvl.show").waitFor();
    await page.waitForTimeout(3500);
    const l = await log(page);
    const complete = l.sfx.find((c) => c.name === "complete");
    const plucks = l.sounds.filter((s) => s.kind === "buf" && s.len > 1000);
    ok("feed slow mic: a round that finishes while the mic request is still pending keeps its chime and its concert", !!complete && complete.live === 0 && plucks.length >= 20, { complete, plucks: plucks.length });
    ok("feed slow mic: the concert still waits ~0.5 s after the chime", !!complete && plucks.length > 0 && Math.min(...plucks.map((p) => p.start)) - complete.at >= 0.45);
    noOverlap("feed slow mic", l);
    clean("feed slow mic", errors);
  } finally { await context.close(); }
});

// ── Feed Echo: the next ask waits for a mic request the phone has not yet
// answered (24 Sep 2026). The mic is asked for 250 ms after Echo's ask; a
// right pick at 350 ms ends the turn, and the next ask is due 900 ms later.
// With a phone that takes 1.5 s to answer, that ask used to start ~0.5 s
// BEFORE the request landed: on an iPhone the mic is already recording by
// then, so Echo asked through call audio. It now waits for the answer, closes
// it, settles SETTLE_MS, and lets the pick's chime (which waited on the same
// answer) finish first. A child who then waits out the slow mic is still
// heard. ──
await scenario("feed slow mic next ask", async () => {
  const { context, page, errors } = await fresh("arcade-feed.html", { age: "4", micok: true, permission: "granted", volume: 0.6, gumDelay: 1500 });
  try {
    for (let i = 0; i < 3; i++) {
      const label = "feed slow mic next ask, turn " + (i + 1);
      await page.waitForFunction((n) => __quiet.speech.length === n && __quiet.speaking === 0, i + 1, { timeout: 6000 });
      await page.waitForTimeout(350);
      const asking = await page.evaluate(() => __quiet.inflight === 1 && __quiet.live() === 0);
      await page.evaluate(() => { const m = document.getElementById("bMain").textContent.match(/Where's the (.+)\?/); [...document.querySelectorAll("#grid .cardBtn")].find((x) => x.querySelector(".w").textContent === m[1]).click(); });
      const next = await until(page, (n) => __quiet.speech.length > n, 5000, i + 1);
      const l = await log(page);
      const ask = l.sounds.filter((x) => x.kind === "speech")[i + 1];
      const req = ask ? l.mics.filter((m) => m.start < ask.start).pop() : null;
      const chime = l.sfx.filter((c) => c.name === "correct")[i];
      ok(label + ": a right pick while the request is pending, then Echo's next ask starts only after that request has landed, been closed and settled",
        asking && next && !!req && req.end <= ask.start && ask.start - req.end >= 0.15,
        { asking, next, ask: ask && +ask.start.toFixed(3), req: req && [+req.start.toFixed(3), req.landed == null ? null : +req.landed.toFixed(3), +req.end.toFixed(3)] });
      ok(label + ": the pick's chime still plays, into no mic, and has finished before Echo asks",
        !!chime && chime.live === 0 && !!ask && ask.start - chime.at >= 0.3, { chime, ask: ask && ask.start });
    }
    const opened = await until(page, () => __quiet.live() === 1, 4000);
    await page.waitForTimeout(400);
    await voice(page, 300);
    ok("feed slow mic next ask: the child who waits out the slow mic is still heard", opened && (await until(page, () => window.__heard === 1, 1500)),
      await page.evaluate(() => ({ heard: window.__heard, live: __quiet.live() })));
    await page.waitForTimeout(400);
    noOverlap("feed slow mic next ask", await log(page));
    clean("feed slow mic next ask", errors);
  } finally { await context.close(); }
});

// ── Bubble Pop and Peekaboo: the mic opens after the word, closes on Next,
// on "Hear it", once heard, and at the finish ──
for (const game of ["bubbles", "peekaboo"]) {
  await scenario(game, async () => {
    const { context, page, errors } = await fresh("arcade-" + game + ".html", { age: "4", micok: true, permission: "granted", volume: 0.6 });
    const phase = (v) => page.locator('body[data-phase="' + v + '"]').waitFor();
    const reveal = async () => { if (game === "bubbles") await page.locator("#revealButton").click(); else await page.locator("[data-door]").first().click(); await phase("reveal"); };
    try {
      await page.locator("#startGame").click(); await phase("choose");
      await page.waitForTimeout(300);
      ok(game + ": choosing a picture opens no mic", (await page.evaluate(() => __quiet.requests)) === 0);
      await reveal();
      await page.waitForFunction(() => __quiet.speaking > 0);
      ok(game + ": no mic is open while Echo says the word", (await live(page)) === 0);
      await page.waitForFunction(() => __quiet.live() === 1);
      await page.locator("#hearWord").click();
      await page.waitForFunction(() => __quiet.speaking > 0);
      ok(game + ": \"Hear it\" closes the mic before Echo speaks again", (await live(page)) === 0);
      await page.waitForFunction(() => __quiet.live() === 1);
      await page.waitForTimeout(400);   // past calibration
      await voice(page, 300);
      await page.waitForFunction(() => /heard you/i.test(document.getElementById("heardMessage").textContent));
      await page.waitForTimeout(350);
      let l = await log(page);
      ok(game + ": heard once, the mic closes, then the little chime", (await live(page)) === 0 && l.sfx.some((c) => c.name === "tap" && c.live === 0 && c.at > l.mics[l.mics.length - 1].end));
      await page.locator("#nextTurn").click(); await phase("choose");
      for (let i = 1; i < 5; i++) {
        await reveal();
        await page.waitForFunction(() => __quiet.live() === 1);
        await page.locator("#nextTurn").click();
        ok(game + " turn " + (i + 1) + ": Next closes the mic", (await live(page)) === 0);
        if (i < 4) await phase("choose");
      }
      await page.locator("#finishPanel").waitFor();
      await page.waitForTimeout(500);
      l = await log(page);
      ok(game + ": the finish chime plays after the mic has closed", l.sfx.some((c) => c.name === "complete" && c.live === 0));
      noOverlap(game, l);
      clean(game, errors);
    } finally { await context.close(); }
  });
}

// ── Bubble Pop and Peekaboo: "Hear it" while the mic request is still being
// answered (24 Sep 2026). The mic is asked for 250 ms after Echo's word. A
// child who tapped "Hear it" before the phone had answered got the word at
// once, 100–300 ms before the request landed: on an iPhone the mic is already
// recording by then, so the word played through call audio. The page stopped
// the track the moment it arrived, so no live track was ever seen, which is
// why the audit above now counts a mic from the moment it is asked for. The
// word now waits for the answer, closes it, settles SETTLE_MS, and the turn
// still hears the child afterwards. ──
for (const game of ["bubbles", "peekaboo"]) for (const gumDelay of [300, 500]) for (const tapAfter of [150, 300]) {
  const label = game + ": \"Hear it\" " + tapAfter + " ms into a " + gumDelay + " ms mic request";
  await scenario(label, async () => {
    const { context, page, errors } = await fresh("arcade-" + game + ".html", { age: "4", micok: true, permission: "granted", volume: 0.6, gumDelay });
    try {
      await page.locator("#startGame").click(); await page.locator('body[data-phase="choose"]').waitFor();
      if (game === "bubbles") await page.locator("#revealButton").click(); else await page.locator("[data-door]").first().click();
      await page.locator('body[data-phase="reveal"]').waitFor();
      await page.waitForFunction(() => __quiet.requests === 1);
      const asked = await page.evaluate(() => __quiet.mics[0].asked);
      await page.waitForFunction((t) => __quiet.now() >= t, asked + tapAfter / 1000);
      // tapped in the same task as the check, so "still pending" is exact
      const pending = await page.evaluate(() => { const p = __quiet.inflight === 1; document.getElementById("hearWord").click(); return p; });
      const said = await until(page, () => __quiet.speech.length === 2, 3000);
      const l = await log(page);
      const word = l.sounds.filter((x) => x.kind === "speech")[1], req = l.mics[0];
      // at 300 ms into a 300 ms request the phone may already have answered;
      // everywhere else the tap must really land on a pending request
      ok(label + ": the tap lands while the phone is still answering (the pin is not vacuous)", pending || tapAfter + 100 > gumDelay, { pending });
      ok(label + ": Echo says the word again only after that request has landed, been closed and settled",
        said && !!word && req.end <= word.start && word.start - req.end >= 0.15,
        { said, word: word && +word.start.toFixed(3), req: [+req.start.toFixed(3), req.landed == null ? null : +req.landed.toFixed(3), +req.end.toFixed(3)] });
      const reopened = await until(page, () => __quiet.live() === 1, 3000);
      await page.waitForTimeout(400);
      await voice(page, 300);
      ok(label + ": the mic reopens after the word and the child is still heard",
        reopened && (await until(page, () => /heard you/i.test(document.getElementById("heardMessage").textContent), 1500)),
        await page.evaluate(() => ({ live: __quiet.live(), requests: __quiet.requests, note: document.getElementById("heardMessage").textContent })));
      await page.waitForTimeout(350);
      noOverlap(label, await log(page));
      clean(label, errors);
    } finally { await context.close(); }
  });
}

await browser.close(); await new Promise((resolve) => server.close(resolve));
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
