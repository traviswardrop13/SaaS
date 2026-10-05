// BOOK1: the picture books' key-word moment (family redesign brief, 28 Sep
// 2026: "The child repeats one key word on every page before the page turns
// ... use the same speech check the games use").
//
// After Echo reads a page, its key word lights up, Echo asks "Can you say...
// rabbit." and the teal mic listens with Say & Play's own check
// (public/saycheck.js). Every book does it: the twelve-page books since the
// brief, and the six-page painted ones since 1 Oct 2026 (Travis: "we want to
// make that something that is happening on every book"), under the same
// rules, none of them loosened. What this holds:
//   - the check IS Say & Play's: every timing, the loudness bar and the family
//     test equal sayplay.js's, so the two can't drift apart;
//   - a grown-up says yes before the phone is ever asked for the mic, inside
//     the book; "Not now", a refused mic and a missing one leave the book
//     reading with Next, and a busy one gives that page its Next: never a
//     dead end;
//   - the mic opens only once Echo has finished, "Your turn!" shows only once
//     it can hear, and nothing (Echo, a chime) plays while it is live or being
//     asked for, nor inside a beat of its close;
//   - a voice turns the page with a small celebration; SILENCE NEVER DOES and
//     is never a try: a quiet window waits for a tap on the mic, which only
//     listens again; three voices of the other family get a kind line and the
//     page turns (the brief's "3 tries");
//   - Skip, Hear it, a word tap and hiding the page all close the mic first;
//   - a page turned while Echo's reading is still loading doesn't leave that
//     line holding the mic shut, and a word tapped before the grown-up has
//     answered never leaves the mic resting with nothing to wake it;
//   - on a short phone Echo's question never sits on the picture;
//   - a child younger than the sound's usual age is never asked to say it,
//     in a six-page book either;
//   - a six-page book asks on every one of its six pages, a voice turns each
//     and the sixth ends on The End; silence turns none of them; and a book
//     with no key words still just reads with Next;
//   - a book word is PLAY: no practice key changes, and neither file can log,
//     record or upload anything.
//
// The device is fake (no real mic, speaker or voice), the same harness as
// sayplaytest and micquietgamestest.
import { createServer } from "http";
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

// its own port: 8259 was taken by a stray dev server while this was written
const PORT = 8273, BASE = "http://127.0.0.1:" + PORT;
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2" };
const server = createServer((req, res) => {
  const url = new URL(req.url, BASE), file = path.join(ROOT, url.pathname);
  if (url.pathname.startsWith("/api/")) { res.writeHead(503, { "content-type": "application/json" }); res.end("{}"); return; }
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(url.pathname === "/library.html" && process.env.BOOK_LIBRARY_SOURCE ? process.env.BOOK_LIBRARY_SOURCE : file));
});
await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
const browser = await chromium.launch(launchOpts());
let failures = 0;
function ok(name, pass, detail = "") { if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); }
async function scenario(name, fn) { if(process.env.BOOK_SCENARIO && name!==process.env.BOOK_SCENARIO)return; try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, e.stack); } }
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");

// ── 1. the check is Say & Play's, and it can only listen ──
{
  const sp = readFileSync(ROOT + "/sayplay.js", "utf8"), sc = readFileSync(ROOT + "/saycheck.js", "utf8");
  const num = (src, name) => { const m = src.match(new RegExp("\\b" + name + " = (\\d+)")); return m ? +m[1] : null; };
  const T = ["SETTLE_MS", "QUIET_MS", "VOICE_TAIL_MS", "FLOOR_MS", "HEARD_MS", "LISTEN_MS"];
  const diff = T.filter((n) => num(sp, n) == null || num(sp, n) !== num(sc, n)).map((n) => n + " " + num(sp, n) + "/" + num(sc, n));
  ok("saycheck.js keeps every one of Say & Play's timings", diff.length === 0, diff.join(", "));
  const same = (re) => re.test(sp) && re.test(sc);
  ok("…the same loudness bar over the room's floor, a 5-frame burst and a 512-point analyser",
    same(/Math\.max\(0\.04, roomFloor \* 3\)/) && same(/voiced >= 5/) && same(/an\.fftSize = 512/) && same(/a\[Math\.floor\(\(a\.length - 1\) \* 0\.2\)\]/));
  ok("…and the same family test (a voiced low sound vs a hiss)",
    same(/if \(fam === "low"\) return !\(cent > 1800 && high > 0\.22\);/) && same(/if \(fam === "hiss"\) return !\(cent < 1100 && high < 0\.10\);/));
  const sfxOf = (src) => { const m = src.match(/SFX_MS = \{([^}]*)\}/); return m ? Object.fromEntries([...m[1].matchAll(/(\w+): (\d+)/g)].map((x) => [x[1], +x[2]])) : {}; };
  const a = sfxOf(sp), b = sfxOf(sc);
  ok("…and waits out each chime exactly as long", Object.keys(a).length >= 3 && Object.keys(a).every((k) => a[k] === b[k]), JSON.stringify({ sayplay: a, saycheck: b }));
  const code = strip(sc);
  ok("saycheck.js records nothing and uploads nothing: no recorder, no form upload, no cloud recognition",
    !/MediaRecorder|FormData|SpeechRecognition|sendBeacon|captureClip|saveRecording|repsBeacon|sendProgress/.test(code));
  ok("…writes no practice: no attempt, rep, session, rung, rotation, coin or sticker",
    !/logAttempt|bumpReps|recordSession|recordRung|rotAdvance|addCoins|mintCoins|addTickets|awardSticker|awardNextSticker|awardRandomSticker|chargeAdd/.test(code));
  const writes = code.match(/localStorage\.setItem\([^)]*\)/g) || [];
  ok("…and the one thing it stores is that the grown-up allowed the mic", writes.length > 0 && writes.every((w) => /"sona\.micok", "1"/.test(w)) && !/sessionStorage|indexedDB\.deleteDatabase/.test(code), writes.join(" | "));
  ok("…and it is a classic ES5 script (no module syntax, no arrows, no let/const)", !/^\s*(import|export)\s|=>|\blet\s|\bconst\s|`/m.test(code));
  const lib = readFileSync(ROOT + "/library.html", "utf8"), libCode = strip(lib);
  ok("the reader loads the check after sona.js, and the action colours", /<script src="\/sona\.js"><\/script>\s*<script src="\/saycheck\.js"><\/script>/.test(lib) && /<link rel="stylesheet" href="\/action\.css"/.test(lib));
  ok("the reader writes no practice and records nothing", !/logAttempt|bumpReps|recordSession|recordRung|rotAdvance|addCoins|mintCoins|awardSticker|MediaRecorder|FormData|SpeechRecognition|getUserMedia\(/.test(libCode),
    "the reader reaches the mic only through SayCheck");
  // orange is the practice sound's letters now, never a button (action.css)
  const css = (lib.match(/<style>[\s\S]*?<\/style>/) || [""])[0], inline = (lib.match(/<button[^>]*style="[^"]*"/g) || []).join(" ");
  const poses = ((((lib.match(/var ECHO_POSES = \[([^\]]*)\]/) || [])[1] || "").match(/\w+/g)) || []).map((p) => "/assets/crafted/echo-" + p + ".webp");
  const echoFiles = [...new Set((lib.match(/\/assets\/crafted\/echo-\w+\.webp/g) || []).concat(poses))];
  ok("the reader's Echo is the clay one: no flat SVG pose left, and every pose it can show is a file", !/\/coach\/echo\//.test(lib) && poses.length === 6 && echoFiles.every((p) => existsSync(ROOT + p)), echoFiles);
  ok("Next is the teal pill, and no button in the reader is orange any more", /class="act-pill" id="bkNext"/.test(lib) && !/#ffa05a|#ff8a3d|#ef6f23/i.test(css + inline) && /<b class="snd">/.test(lib));
}

// ── the fake device ──
function fakeDevice(cfg) {
  // the phone's calendar: books open on a date (27 Sep 2026; every queued one
  // on 9 Oct since 1 Oct), so a scenario that needs a book that isn't out yet
  // moves the date past it; timers and performance.now() are untouched
  if (cfg.today) {
    const RealDate = Date, off = new RealDate(cfg.today + "T12:00:00").getTime() - RealDate.now();
    window.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + off); } static now() { return RealDate.now() + off; } };
  }
  const T0 = performance.now();
  const now = () => (performance.now() - T0) / 1000;
  const h = window.__quiet = { cfg, now, mics: [], sounds: [], sfx: [], speech: [], confetti: [], notes: [], requests: 0, voice: false, shape: cfg.shape || "low", hidden: false, speaking: 0, leakFrames: 0 };
  // live(): tracks the page holds now. micOn(): also a request still being
  // answered (an iPhone is recording before getUserMedia returns).
  h.live = () => h.mics.filter((m) => m.start != null && m.end == null).length;
  h.micOn = () => h.mics.filter((m) => m.end == null).length;
  h.playingNow = () => { const t = now(); return h.speaking > 0 || h.sounds.some((s) => s.start <= t && t < s.end); };
  Object.defineProperty(document, "hidden", { configurable: true, get: () => h.hidden });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h.hidden ? "hidden" : "visible") });
  h.background = () => { h.hidden = true; document.dispatchEvent(new Event("visibilitychange")); };
  h.foreground = () => { h.hidden = false; document.dispatchEvent(new Event("visibilitychange")); };
  Object.defineProperty(navigator, "permissions", { configurable: true, value: { query: () => new Promise((r) => setTimeout(() => r({ state: cfg.permission || "granted" }), cfg.permDelay || 0)) } });
  navigator.mediaDevices.getUserMedia = () => {
    h.requests++;
    if (cfg.micMode === "deny") return Promise.reject(new DOMException("Denied", "NotAllowedError"));
    if (cfg.micMode === "busy") return Promise.reject(new DOMException("Could not start audio source", "NotReadableError"));
    const rec = { asked: now(), start: now(), end: null }; h.mics.push(rec);
    const track = { kind: "audio", readyState: "live", stop() { if (this.readyState !== "ended") { this.readyState = "ended"; rec.end = now(); } } };
    return Promise.resolve({ getTracks: () => [track], getAudioTracks: () => [track] });
  };
  function param(v) { const p = { _v: v }; p.setValueAtTime = p.linearRampToValueAtTime = p.exponentialRampToValueAtTime = p.setTargetAtTime = p.cancelScheduledValues = () => {}; Object.defineProperty(p, "value", { get: () => p._v, set: (x) => { p._v = x; } }); return p; }
  function endAt(t) { return t == null || t < now() ? now() : t; }
  function AC() { this.state = "running"; this.sampleRate = 48000; this.destination = {}; }
  Object.defineProperty(AC.prototype, "currentTime", { get: now });
  AC.prototype.resume = function () { this.state = "running"; return Promise.resolve(); };
  AC.prototype.suspend = function () { this.state = "suspended"; return Promise.resolve(); };
  AC.prototype.createGain = function () { return { gain: param(1), connect() {}, disconnect() {} }; };
  AC.prototype.createOscillator = function () {
    const o = { type: "sine", frequency: param(440), connect() {}, disconnect() {}, onended: null,
      start(t) { o.rec = { kind: "osc", start: Math.max(now(), t || 0), end: Infinity, live: h.micOn() }; h.sounds.push(o.rec); },
      stop(t) { if (o.rec) o.rec.end = Math.min(o.rec.end, endAt(t)); } };
    return o;
  };
  AC.prototype.createBuffer = function (c, n, sr) { sr = sr || this.sampleRate; return { length: n, sampleRate: sr, duration: n / sr, numberOfChannels: c, getChannelData: () => new Float32Array(n) }; };
  AC.prototype.createBufferSource = function () {
    const s = { buffer: null, playbackRate: param(1), connect() {}, disconnect() {}, onended: null,
      start(t) {
        if (!s.buffer || s.buffer.length <= 1) return;   // the iOS unlock blip
        s.rec = { kind: "buf", start: Math.max(now(), t || 0), live: h.micOn() }; s.rec.end = s.rec.start + s.buffer.duration; h.sounds.push(s.rec);
        s.timer = setTimeout(() => { if (s.onended) s.onended(); }, (s.rec.end - now()) * 1000);
      },
      stop(t) { if (s.rec) s.rec.end = Math.min(s.rec.end, endAt(t)); clearTimeout(s.timer); if (s.onended) s.onended(); } };
    return s;
  };
  AC.prototype.createMediaStreamSource = function (stream) { return { stream, on: false, connect(an) { an.src = this; this.on = true; }, disconnect() { this.on = false; } }; };
  AC.prototype.createAnalyser = function () {
    const an = { fftSize: 2048, src: null, connect() {}, disconnect() {} };
    Object.defineProperty(an, "frequencyBinCount", { get: () => an.fftSize / 2 });
    // what the mic hears: the child when h.voice is on, and anything the page
    // plays right now (a phone's mic hears its own speaker)
    an.hears = () => { if (!an.src || !an.src.on) return false; const tr = an.src.stream.getTracks()[0]; return tr.readyState === "live" && (h.voice || h.playingNow()); };
    an.getByteTimeDomainData = (d) => { const v = an.hears(); if (v && !h.voice) h.leakFrames++; for (let i = 0; i < d.length; i++) d[i] = v ? (i % 2 ? 200 : 56) : 128; };
    // "low": energy under ~1 kHz (a voiced sound, an /r/); "hiss": 3.7–11 kHz
    an.getByteFrequencyData = (d) => { const v = an.hears(); d.fill(0); if (!v) return; if (h.shape === "hiss") { for (let i = 40; i <= 120 && i < d.length; i++) d[i] = 220; } else { for (let i = 1; i <= 10 && i < d.length; i++) d[i] = 220; } };
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
  // Sona's chimes stay real (they reach the fake Web Audio); each call is also
  // logged by name with how many mics were on. Confetti is logged, not drawn.
  let sona;
  Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set(value) {
    sona = value;
    value.confetti = () => { h.confetti.push({ at: now(), live: h.micOn() }); };
    Object.keys(value.sfx || {}).forEach((k) => { const real = value.sfx[k]; if (typeof real !== "function" || k === "stop") return; value.sfx[k] = function () { h.sfx.push({ name: k, at: now(), live: h.micOn() }); return real.apply(this, arguments); }; });
  } });
  // every change to what the mic says ("Your turn!"), with how many mics were live
  document.addEventListener("DOMContentLoaded", () => {
    let last = null;
    new MutationObserver(() => { const e = document.getElementById("bkMicState"), t = e ? e.textContent : null; if (t !== last) { last = t; h.notes.push({ t, at: now(), live: h.live() }); } })
      .observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  if (!localStorage.getItem("sona.test.bookSeed")) {
    localStorage.setItem("sona.test.bookSeed", "1");
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done"); localStorage.setItem("sona.freeera5.v1", "done");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: cfg.age || "7", focusSounds: cfg.focus || ["R"], onboarded: true, earlyAdopter: true, voiceOn: true, soundOn: true, volume: 0.6 }));
    if (cfg.micok) localStorage.setItem("sona.micok", "1");
  }
}

async function fresh(cfg = {}) {
  const context = await browser.newContext({ viewport: cfg.viewport || { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (route) => (route.request().url().startsWith(BASE + "/") ? route.continue() : route.abort()));
  // a voice service that is slow to answer one line (then fails, like the rest)
  if (cfg.slowTts) await context.route("**/api/tts", async (route) => {
    if ((route.request().postData() || "").includes(cfg.slowTts)) await new Promise((r) => setTimeout(r, 6000));
    try { await route.fulfill({ status: 503, contentType: "application/json", body: "{}" }); } catch {}
  });
  await context.addInitScript(fakeDevice, cfg);
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/library.html");
  await page.waitForFunction(() => document.querySelectorAll("#shelf .bookBtn").length > 0);
  return { context, page, errors };
}
const until = (page, fn, ms, arg) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const book = (page) => page.evaluate(() => window.__book || {});
const click = (page, id) => page.evaluate((i) => document.getElementById(i).click(), id);
const shown = (page, id) => page.evaluate((i) => { const e = document.getElementById(i); return !!(e && !e.hidden && e.offsetParent !== null); }, id);
async function openBook(page, title) {
  await page.evaluate((t) => [...document.querySelectorAll("#shelf .bookBtn")].find((b) => b.querySelector(".bt").textContent === t).click(), title);
  await page.waitForTimeout(150);
  await click(page, "bkNext");   // the title page's Start
}
const live = (page) => page.evaluate(() => __quiet.live());
const waitLive = (page, ms = 9000) => until(page, () => window.__book && window.__book.mode === "live" && __quiet.live() === 1, ms);
async function voice(page, ms) { await page.evaluate(() => { __quiet.voice = true; }); await page.waitForTimeout(ms); await page.evaluate(() => { __quiet.voice = false; }); }
const log = (page) => page.evaluate(() => ({ mics: __quiet.mics.map((m) => ({ start: m.asked, end: m.end == null ? __quiet.now() : m.end })), sounds: __quiet.sounds.map((s) => ({ kind: s.kind, start: s.start, end: s.end, text: s.text })), sfx: __quiet.sfx.slice(), confetti: __quiet.confetti.slice(), notes: __quiet.notes.slice(), requests: __quiet.requests, leakFrames: __quiet.leakFrames, speech: __quiet.speech.slice() }));
function overlaps(l) { const bad = []; for (const s of l.sounds) for (const m of l.mics) if (s.start < m.end && m.start < s.end) bad.push({ sound: s.kind + (s.text ? ":" + s.text : ""), start: +s.start.toFixed(3), mic: [+m.start.toFixed(3), +m.end.toFixed(3)] }); return bad; }
function quietAfterClose(l, gap) { const bad = []; for (const s of l.sounds) for (const m of l.mics) if (s.start >= m.end && s.start - m.end < gap) bad.push({ sound: s.kind + (s.text ? ":" + s.text : ""), after: +(s.start - m.end).toFixed(3) }); return bad; }
function noOverlap(label, l) {
  ok(label + ": sounds played and the mic opened (not vacuous)", l.sounds.length > 0 && l.mics.length > 0, { sounds: l.sounds.length, mics: l.mics.length });
  ok(label + ": nothing starts or rings while a mic is live or being asked for", overlaps(l).length === 0, overlaps(l).slice(0, 6));
  ok(label + ": every sound after the mic closes leaves the phone a beat to switch back", quietAfterClose(l, 0.15).length === 0, quietAfterClose(l, 0.15).slice(0, 6));
  ok(label + ": the mic never heard the page's own sound", l.leakFrames === 0, { leakFrames: l.leakFrames });
  ok(label + ": \"Your turn!\" only ever showed with the mic live", l.notes.filter((n) => n.t === "Your turn!").every((n) => n.live === 1) && l.notes.some((n) => n.t === "Your turn!"), l.notes);
}
const clean = (label, errors) => ok(label + ": no runtime errors", errors.length === 0, errors);
const snapshot = (page) => page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });

// ── 2. the grown-up's yes comes first, and "Not now" reads on with Next ──
await scenario("primer", async () => {
  const { context, page, errors } = await fresh({ permission: "prompt" });
  await openBook(page, "Rory and the Rainbow");
  const asked = await until(page, () => window.__book && window.__book.primer === true, 6000);
  const st = await page.evaluate(() => ({ requests: __quiet.requests, promise: document.getElementById("bkMicPromise").textContent, title: document.getElementById("bkPrimerTitle").textContent,
    mic: !document.getElementById("bkMicWrap").hidden, next: !document.getElementById("bkNext").hidden, want: Sona.MIC_PROMISE }));
  ok("a new family meets a grown-ups' question inside the book once Echo has read the page", asked && /Echo wants to hear the words/.test(st.title), st);
  ok("…it carries the one shared mic promise", st.promise === st.want && /never uploaded/.test(st.promise), st.promise);
  ok("…and the phone was never asked for the mic before that tap", st.requests === 0, st);
  await click(page, "bkPrimerNo");
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ mode: window.__book.mode, requests: __quiet.requests, micOff: window.__book.micOff }));
  ok("\"Not now\": Next is back, no mic, the phone still never asked", after.mode === "next" && await shown(page, "bkNext") && !(await shown(page, "bkMicWrap")) && after.requests === 0, after);
  await click(page, "bkNext");
  await page.waitForTimeout(2200);
  const p2 = await page.evaluate(() => ({ page: window.__book.page, mode: window.__book.mode, primer: window.__book.primer, requests: __quiet.requests, kw: !!document.querySelector(".bktext .kw") }));
  ok("…and the rest of the book reads with Next, never asking again this visit", p2.page === 1 && p2.mode === "next" && !p2.primer && p2.requests === 0 && !p2.kw, p2);
  clean("primer", errors);
  await context.close();
});

await scenario("primer yes", async () => {
  const { context, page, errors } = await fresh({ permission: "prompt" });
  await openBook(page, "Rory and the Rainbow");
  await until(page, () => window.__book && window.__book.primer === true, 6000);
  await click(page, "bkPrimerYes");
  const went = await waitLive(page);
  const st = await page.evaluate(() => ({ requests: __quiet.requests, micok: localStorage.getItem("sona.micok") }));
  ok("\"Yes, use the mic\": the phone is asked on that tap, then the word is asked for", went && st.requests >= 2 && st.micok === "1", st);
  clean("primer yes", errors);
  await context.close();
});

// ── 3. the moment: word, bubble, mic, a voice turns the page ──
await scenario("heard", async () => {
  const { context, page, errors } = await fresh({ micok: true });
  const before = await snapshot(page);
  await openBook(page, "Rory and the Rainbow");
  await page.waitForTimeout(120);
  const reading = await page.evaluate(() => ({ mode: window.__book.mode, next: !document.getElementById("bkNext").hidden, live: __quiet.live(), note: (document.getElementById("bkMicState") || {}).textContent }));
  ok("while Echo reads, the mic rests where Next was: not open, not \"Your turn\"", reading.mode === "wait" && !reading.next && reading.live === 0 && reading.note !== "Your turn!", reading);
  const went = await waitLive(page);
  const st = await page.evaluate(() => ({ kw: [...document.querySelectorAll(".bktext .kw")].map((s) => s.textContent), b: [...document.querySelectorAll(".bktext .kw b")].map((b) => b.textContent),
    ask: document.getElementById("bkAsk").textContent, snd: [...document.querySelectorAll("#bkAsk b.snd")].map((b) => b.textContent), note: document.getElementById("bkMicState").textContent,
    skip: !document.getElementById("bkSkip").hidden }));
  ok("after the page is read, its key word lights up (a class on its word; the sound's letter stays the tint)", went && JSON.stringify(st.kw) === '["rabbit"]' && JSON.stringify(st.b) === '["r"]', st);
  ok("…Echo asks \"Can you say rabbit?\" with only the sound's letter orange", st.ask === "Can you say rabbit?" && JSON.stringify(st.snd) === '["r"]', st);
  ok("…the mic says \"Your turn!\", and Skip is there for grown-ups", st.note === "Your turn!" && st.skip, st);
  let l = await log(page);
  const spokeEnd = Math.max(...l.sounds.filter((s) => s.kind === "speech").map((s) => s.end));
  ok("…Echo modelled the word alone at the end, calm (\"Can you say... rabbit.\")", l.speech.includes("Can you say... rabbit.") && l.speech.includes("Rain taps on the roof. Rory the rabbit looks up."), l.speech);
  ok("…and the mic was asked for only after Echo had finished", l.mics.length === 1 && l.mics[0].start >= spokeEnd, { mic: l.mics[0], spokeEnd });
  await page.waitForTimeout(80);
  await voice(page, 260);
  const turned = await until(page, () => window.__book && window.__book.page === 1, 3000);
  l = await log(page);
  const closed = l.mics[0].end;
  const correct = l.sfx.filter((s) => s.name === "correct");
  ok("a voice turns the page by itself", turned);
  ok("…with a small celebration: the chime and the confetti, after the mic closed", correct.length === 1 && correct[0].at > closed && correct[0].live === 0 && l.confetti.length >= 1 && l.confetti.every((c) => c.live === 0 && c.at > closed), { correct, confetti: l.confetti, closed });
  noOverlap("heard", l);
  // …and the whole book to The End: no practice key moves
  for (let i = 1; i < 11; i++) { await waitLive(page); await click(page, "bkSkip"); }
  await waitLive(page);
  await page.waitForTimeout(80);
  await voice(page, 260);
  const end = await until(page, () => /The End!/.test(document.getElementById("bkStage").textContent), 4000);
  await page.waitForTimeout(400);
  const endEcho = await page.evaluate(() => { const i = document.getElementById("pgEcho"); return { src: i.getAttribute("src"), loaded: i.complete && i.naturalWidth > 0 }; });
  ok("The End: Echo cheers on the card", end && endEcho.src === "/assets/crafted/echo-cheer.webp" && endEcho.loaded, endEcho);
  const after = await snapshot(page);
  const readKey = await page.evaluate(() => Sona.kkey("sona.lib.read.v1"));
  const moved = Object.keys(Object.assign({}, before, after)).filter((k) => before[k] !== after[k] && k !== "sona.micok" && k !== readKey && k !== "sona.gamereps.v1" && k !== "sona.goaldays.v1");
  ok("a book read to The End by voice changes no practice key (only the read-star)", end && moved.length === 0 && /Rory and the Rainbow/.test(after[readKey] || ""), moved.map((k) => k + "=" + String(after[k]).slice(0, 60)));
  ok("…two accepted words add exactly 2 play reps", (await page.evaluate(() => Sona.dayReps())) === 2);
  ok("…and never logs an attempt, practice rep or coin", !/"(attempts|reps|coins)"/.test(JSON.stringify(moved)));
  clean("heard", errors);
  await context.close();
});

await scenario("sibling rep guard", async () => {
  const { context, page, errors } = await fresh({ micok: true });
  try {
    await openBook(page, "Rory and the Rainbow");
    ok("sibling guard: the original child's book is listening", await waitLive(page));
    const original = await page.evaluate(() => { const old=Sona.activeKid().slot; Sona.addKid("Sibling",6); return old; });
    await voice(page,260);
    ok("sibling guard: the existing reading turn can finish", await until(page,()=>window.__book.page===1,5000));
    ok("sibling guard: a stale book never credits the newly active child", await page.evaluate(()=>Sona.dayReps()===0));
    await page.evaluate((slot)=>Sona.switchKid(slot),original);
    ok("sibling guard: a switched-away reading turn adds no rep", await page.evaluate(()=>Sona.dayReps()===0));
    clean("sibling guard",errors);
  } finally {await context.close();}
});

// ── 4. silence never turns the page, and is never a try ──
await scenario("quiet", async () => {
  const { context, page, errors } = await fresh({ micok: true });
  await openBook(page, "Rory and the Rainbow");
  await waitLive(page);
  const nudged = await until(page, () => window.__book && window.__book.mode === "nudge", 16000);
  const st = await page.evaluate(() => ({ page: window.__book.page, tries: window.__book.tries, live: __quiet.live(), note: document.getElementById("bkMicState").textContent, requests: __quiet.requests }));
  ok("a silent listening window closes the mic and asks for a tap", nudged && st.live === 0 && st.note === "Tap the mic, then say it", st);
  ok("…and SILENCE NEVER TURNS THE PAGE, nor counts as a try", st.page === 0 && st.tries === 0, st);
  await page.waitForTimeout(1500);
  ok("…nor does the mic reopen by itself", await page.evaluate(() => __quiet.requests) === st.requests && (await book(page)).page === 0);
  await click(page, "bkMic");
  const again = await waitLive(page, 4000);
  ok("the tap only listens again (no free page)", again && (await book(page)).page === 0, await book(page));
  await page.waitForTimeout(80);
  await voice(page, 260);
  ok("…and then a voice turns the page", await until(page, () => window.__book && window.__book.page === 1, 3000));
  noOverlap("quiet", await log(page));
  clean("quiet", errors);
  await context.close();
});

// ── 5. three voices of the other family: a kind line, and the page turns ──
await scenario("three tries", async () => {
  const { context, page, errors } = await fresh({ micok: true, shape: "hiss" });
  await openBook(page, "Rory and the Rainbow");
  const tries = [];
  for (let i = 1; i <= 3; i++) {
    await waitLive(page);
    await page.waitForTimeout(80);
    await voice(page, 260);
    await until(page, (n) => window.__book && (window.__book.tries >= n || window.__book.page > 0), 3000, i);
    tries.push((await book(page)).tries);
  }
  const turned = await until(page, () => window.__book && window.__book.page === 1, 5000);
  const l = await log(page);
  ok("a voice of the other family is a try, and Echo asks once more", JSON.stringify(tries.slice(0, 2)) === "[1,2]" && l.speech.filter((t) => t === "One more time... rabbit.").length === 2, { tries, speech: l.speech });
  ok("…after three, Echo says something kind and the page turns anyway", turned && l.speech.includes("Great trying. Let's turn the page."), l.speech);
  ok("…with no celebration chime (nothing was heard)", !l.sfx.some((s) => s.name === "correct"), l.sfx);
  noOverlap("three tries", l);
  clean("three tries", errors);
  await context.close();
});

// ── Echo's clay poses (29 Sep 2026): the picture says what he is doing ──
// Every pose Echo takes on the card, page by page. "welcome" (resting) is
// left out of the sequences: between his reading and his asking it lasts no
// longer than a microtask, and the child never sees it.
await scenario("poses", async () => {
  const { context, page, errors } = await fresh({ micok: true });
  await page.evaluate(() => {
    const seen = window.__poses = [];
    new MutationObserver(() => {
      const e = document.getElementById("pgEcho"), m = e && /^\/assets\/crafted\/echo-(\w+)\.webp$/.exec(e.getAttribute("src") || ""), b = window.__book || {}, last = seen[seen.length - 1];
      if (m && (!last || last.pose !== m[1] || last.page !== b.page)) seen.push({ pose: m[1], page: b.page, mode: b.mode, live: __quiet.live() });
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] });
  });
  await openBook(page, "Rory and the Rainbow");
  await waitLive(page);
  await until(page, () => window.__book && window.__book.mode === "nudge", 16000);
  await click(page, "bkMic");
  await waitLive(page, 4000);
  await page.waitForTimeout(80);
  await voice(page, 260);
  await until(page, () => window.__book && window.__book.page === 1, 3000);
  await page.evaluate(() => { __quiet.shape = "hiss"; });
  for (let i = 1; i <= 3; i++) {
    await waitLive(page);
    await page.waitForTimeout(80);
    await voice(page, 260);
    await until(page, (n) => window.__book && (window.__book.tries >= n || window.__book.page > 1), 3000, i);
  }
  await until(page, () => window.__book && window.__book.page === 2, 5000);
  const seen = await page.evaluate(() => window.__poses);
  const on = (pg) => seen.filter((s) => s.page === pg && s.pose !== "welcome").map((s) => s.pose).join(" ");
  ok("the title page: Echo talks while he reads the title", seen.some((s) => s.page === -1 && s.pose === "talk"), seen);
  ok("a page: Echo talks while he reads it, waves as he asks, listens only while the mic is open", /^talk wave listen\b/.test(on(0)) && seen.filter((s) => s.pose === "listen").every((s) => s.mode === "live" && s.live === 1), seen);
  ok("…thinks while a quiet mic waits for a tap, and cheers when he hears the word", on(0) === "talk wave listen think listen cheer", on(0));
  ok("…thinks as he asks for one more try, and cheers the kind line that turns the page", on(1) === "talk wave listen think listen think listen cheer", on(1));
  ok("…and the next page starts with him reading again", on(2).startsWith("talk"), on(2));
  const loaded = await page.evaluate(() => Promise.all(["welcome", "talk", "wave", "listen", "think", "cheer"].map((p) => new Promise((r) => { const i = new Image(); i.onload = () => r(i.naturalWidth); i.onerror = () => r(0); i.src = "/assets/crafted/echo-" + p + ".webp"; }))));
  ok("…and every pose he can take loads", loaded.every((w) => w > 0), loaded);
  clean("poses", errors);
  await context.close();
});

// ── 6. every way off the moment closes the mic first ──
await scenario("skip", async () => {
  const { context, page, errors } = await fresh({ micok: true });
  await openBook(page, "Rory and the Rainbow");
  await waitLive(page);
  const st = await page.evaluate(() => { document.getElementById("bkSkip").click(); return { live: __quiet.live(), page: window.__book.page }; });
  ok("Skip closes the mic and turns the page", st.live === 0 && st.page === 1, st);
  noOverlap("skip", await log(page));
  clean("skip", errors);
  await context.close();
});

await scenario("hear it", async () => {
  const { context, page, errors } = await fresh({ micok: true });
  await openBook(page, "Rory and the Rainbow");
  await waitLive(page);
  const n0 = (await log(page)).speech.length;
  const st = await page.evaluate(() => { document.getElementById("bkHear").click(); return { live: __quiet.live() }; });
  ok("Hear it closes the mic before anything plays", st.live === 0, st);
  const back = await waitLive(page, 9000);
  const l = await log(page);
  const said = l.speech.slice(n0);
  ok("…Echo reads the page again, asks again, and listens again", back && said[0] === "Rain taps on the roof. Rory the rabbit looks up." && said.includes("Can you say... rabbit.") && (await book(page)).page === 0, said);
  noOverlap("hear it", l);
  clean("hear it", errors);
  await context.close();
});

await scenario("word tap", async () => {
  const { context, page, errors } = await fresh({ micok: true });
  await openBook(page, "Rory and the Rainbow");
  await waitLive(page);
  const st = await page.evaluate(() => { [...document.querySelectorAll(".bktext span")].find((s) => s.textContent === "roof.").click(); return { live: __quiet.live() }; });
  ok("a word tap closes the mic first", st.live === 0, st);
  const back = await waitLive(page, 6000);
  const l = await log(page);
  ok("…Echo says the word, then the mic listens again", back && l.speech.includes("roof"), l.speech);
  noOverlap("word tap", l);
  clean("word tap", errors);
  await context.close();
});

await scenario("back and close", async () => {
  const { context, page, errors } = await fresh({ micok: true });
  await openBook(page, "Rory and the Rainbow");
  await waitLive(page);
  const back = await page.evaluate(() => { document.getElementById("bkPrev").click(); return { live: __quiet.live(), page: window.__book.page, mode: window.__book.mode }; });
  ok("Back (←) closes the mic before anything else, and goes back a page with Next", back.live === 0 && back.page === -1 && back.mode === "next", back);
  await click(page, "bkNext");
  await waitLive(page);
  const shut = await page.evaluate(() => { document.getElementById("bkClose").click(); return { live: __quiet.live(), open: document.getElementById("book").classList.contains("show"), mode: window.__book.mode }; });
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({ requests: __quiet.requests, live: __quiet.live() }));
  ok("✕ closes the mic before anything else, and nothing reopens it once the book is shut", shut.live === 0 && !shut.open && shut.mode === "next" && after.live === 0 && after.requests === 2, { shut, after });
  noOverlap("back and close", await log(page));
  clean("back and close", errors);
  await context.close();
});

await scenario("hidden", async () => {
  const { context, page, errors } = await fresh({ micok: true });
  await openBook(page, "Rory and the Rainbow");
  await waitLive(page);
  await page.evaluate(() => __quiet.background());
  await page.waitForTimeout(100);
  const st = await page.evaluate(() => ({ live: __quiet.live(), speaking: __quiet.speaking, mode: window.__book.mode, echo: document.getElementById("pgEcho").getAttribute("src") }));
  ok("hiding the page closes the mic and stops Echo", st.live === 0 && st.speaking === 0, st);
  ok("…and Echo waits, thinking (he isn't listening any more)", st.echo === "/assets/crafted/echo-think.webp", st);
  const req = await page.evaluate(() => __quiet.requests);
  await page.evaluate(() => __quiet.foreground());
  await page.waitForTimeout(1500);
  const back = await page.evaluate(() => ({ requests: __quiet.requests, mode: window.__book.mode, page: window.__book.page, note: document.getElementById("bkMicState").textContent }));
  ok("…coming back needs a tap on the mic (nothing reopens by itself, the page stays)", back.requests === req && back.mode === "nudge" && back.page === 0 && back.note === "Tap the mic, then say it", back);
  await click(page, "bkMic");
  ok("…and the tap listens again", await waitLive(page, 4000));
  clean("hidden", errors);
  await context.close();
});

// ── 7. a refused mic meets the usual help screen, and the book reads on ──
await scenario("denied", async () => {
  const { context, page, errors } = await fresh({ micok: true, micMode: "deny" });
  await openBook(page, "Rory and the Rainbow");
  const shownDenied = await until(page, () => !!document.getElementById("sonaMicDenied"), 6000);
  ok("a refused mic shows the shared \"Echo can't hear you yet\" help", shownDenied);
  const helpEcho = await until(page, () => { const i = document.querySelector("#sonaMicDenied img"); return !!(i && i.complete && i.naturalWidth); }, 3000);
  const helpSrc = await page.evaluate(() => { const i = document.querySelector("#sonaMicDenied img"); return i ? i.getAttribute("src") : null; });
  ok("…with Echo thinking there (the clay pose, and it loads)", helpEcho && helpSrc === "/assets/crafted/echo-think.webp", helpSrc);
  const label = await page.evaluate(() => (document.getElementById("sonaMicBack") || {}).textContent);
  ok("…whose way out says \"Keep reading\" (it closes the help and the book reads on; it never goes home)", label === "Keep reading", label);
  await click(page, "sonaMicBack");
  await page.waitForTimeout(150);
  const st = await page.evaluate(() => ({ gone: !document.getElementById("sonaMicDenied"), mode: window.__book.mode, page: window.__book.page, path: location.pathname }));
  ok("…closing it leaves the book open with Next back", st.gone && st.mode === "next" && st.page === 0 && st.path === "/library.html" && await shown(page, "bkNext"), st);
  await click(page, "bkNext");
  await page.waitForTimeout(1800);
  const p2 = await page.evaluate(() => ({ page: window.__book.page, mode: window.__book.mode, requests: __quiet.requests }));
  ok("…and the next page doesn't ask again", p2.page === 1 && p2.mode === "next" && p2.requests === 1, p2);
  clean("denied", errors);
  await context.close();
});

// …and a mic that won't open (busy) is never a dead end either
await scenario("busy", async () => {
  const { context, page, errors } = await fresh({ micok: true, micMode: "busy" });
  await openBook(page, "Rory and the Rainbow");
  const back = await until(page, () => window.__book && window.__book.mode === "next" && __quiet.requests === 1, 6000);
  const st = await page.evaluate(() => ({ page: window.__book.page, note: (document.getElementById("bkMicState") || {}).textContent }));
  ok("a mic that won't open gives the page back its Next (never \"Tap the mic\" forever)", back && st.page === 0 && await shown(page, "bkNext"), st);
  await click(page, "bkNext");
  const tried = await until(page, () => window.__book && window.__book.page === 1 && __quiet.requests === 2 && window.__book.mode === "next", 6000);
  ok("…and the next page tries the mic again", tried, await page.evaluate(() => ({ b: window.__book, requests: __quiet.requests })));
  clean("busy", errors);
  await context.close();
});

// a page turned while Echo's reading is still on its way: the line it cut off
// lets go of the mic at once, instead of when its fetch finally runs out
await scenario("stale line", async () => {
  const { context, page, errors } = await fresh({ micok: true, slowTts: "Rain taps on the roof" });
  await openBook(page, "Rory and the Rainbow");
  await page.waitForTimeout(300);
  const pose0 = await page.evaluate(() => ({ page: window.__book.page, mode: window.__book.mode }));
  await click(page, "bkSkip");
  await page.waitForTimeout(60);
  const pose = await page.evaluate(() => ({ page: window.__book.page, echo: (document.getElementById("pgEcho") || {}).src || "" }));
  ok("a line cut off by a page turn doesn't set the new page's Echo resting while he reads it (he's still talking)", pose.page === 1 && /\/assets\/crafted\/echo-talk\.webp$/.test(pose.echo), { pose0, pose });
  const t0 = Date.now(), went = await waitLive(page, 3500);
  ok("…and doesn't hold the next page's mic shut while its fetch runs out (the mic opens in the usual time)", went && (await book(page)).page === 1, { ms: Date.now() - t0, b: await book(page) });
  noOverlap("stale line", await log(page));
  clean("stale line", errors);
  await context.close();
});

// a word tapped in the beat before the grown-up is asked starts the ask over
await scenario("tap before asking", async () => {
  const { context, page, errors } = await fresh({ permission: "prompt", permDelay: 1200 });
  await openBook(page, "Rory and the Rainbow");
  const waiting = await until(page, () => window.__book && window.__book.word === "rabbit" && !window.__book.primer, 6000);
  await page.evaluate(() => [...document.querySelectorAll(".bktext span")].find((s) => s.textContent === "roof.").click());
  const asked = await until(page, () => window.__book && window.__book.primer === true, 6000);
  ok("a word tapped before the grown-up's question comes up: the word is read, then the question comes up", waiting && asked && (await page.evaluate(() => __quiet.speech)).includes("roof"), await book(page));
  ok("…and the phone still hasn't been asked for the mic", await page.evaluate(() => __quiet.requests) === 0);
  clean("tap before asking", errors);
  await context.close();
});

// ── on a short phone, Echo's question never sits on the picture ──
async function layout(page) {
  return page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: b.width, h: b.height }; };
    const img = document.querySelector("#bkStage .bkart.scene img"), st = getComputedStyle(document.getElementById("book"));
    const box = r("#bkStage .bkart.scene img"), ar = img.naturalWidth / img.naturalHeight;
    // the picture's own pixels inside its box (object-fit: contain)
    const pw = Math.min(box.w, box.h * ar), ph = pw / ar;
    return { img: box, picW: pw, picH: ph, picBottom: box.top + (box.h + ph) / 2, bubble: r("#bkBubble"), card: r(".bkcard"), vw: innerWidth,
      lift: st.getPropertyValue("--bk-lift").trim(), ask: st.getPropertyValue("--bk-ask").trim(), hidden: document.getElementById("bkBubble").hidden };
  });
}
await scenario("short phone", async () => {
  const { context, page, errors } = await fresh({ micok: true, viewport: { width: 320, height: 568 } });
  await openBook(page, "Rory and the Rainbow");
  await until(page, () => { const i = document.querySelector("#bkStage .bkart.scene img"); return window.__book && window.__book.mode === "wait" && !document.querySelector(".bkbubble:not([hidden])") && i && i.naturalWidth > 0; }, 3000);
  const reading = await layout(page);
  await waitLive(page);
  const asking = await layout(page);
  ok("320x568: while Echo asks, his question sits below the picture, never on it", asking.picBottom <= asking.bubble.top + 1 && asking.picH > 120, { reading, asking });
  ok("…and while he reads, the picture has all its room (nothing is lifted or shrunk before the question)", reading.lift === "" && reading.ask === "" && reading.picH >= asking.picH, reading);
  await click(page, "bkSkip");
  await page.waitForTimeout(80);
  const next = await layout(page);
  ok("…and the next page starts with the picture's full room back", next.lift === "" && next.ask === "", next);
  clean("short phone", errors);
  await context.close();
});
await scenario("tall phone", async () => {
  const { context, page, errors } = await fresh({ micok: true });
  await openBook(page, "Rory and the Rainbow");
  await waitLive(page);
  const l = await layout(page);
  ok("390x844: the question already fits under the picture, which stays put, full width", l.lift === "" && l.ask === "" && l.picBottom <= l.bubble.top + 1 && Math.abs(l.picW - l.vw) < 2, l);
  clean("tall phone", errors);
  await context.close();
});

// ── 8. developmental order: a four-year-old is never asked to say an /r/ ──
await scenario("age", async () => {
  const { context, page, errors } = await fresh({ micok: true, age: "4" });
  await openBook(page, "Rory and the Rainbow");
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => ({ mode: window.__book.mode, primer: window.__book.primer, requests: __quiet.requests, kw: !!document.querySelector(".bktext .kw"), speech: __quiet.speech.slice() }));
  ok("a 4-year-old reading an R book hears it read, and is never asked to say its words", st.mode === "next" && !st.primer && st.requests === 0 && !st.kw && !st.speech.some((t) => /Can you say/.test(t)) && await shown(page, "bkNext"), st);
  clean("age", errors);
  await context.close();
});
await scenario("age ok", async () => {
  const { context, page, errors } = await fresh({ micok: true, age: "4", focus: ["P"], today: "2026-12-31" });
  await openBook(page, "Penny's Pebble Party");
  const went = await waitLive(page);
  ok("…while a sound that age usually has (P, by 3) gets the moment", went && (await book(page)).word === "penguin", await book(page));
  clean("age ok", errors);
  await context.close();
});

// ── 9. every book asks, the six-page ones too (Travis, 1 Oct 2026) ──
// "It's doing it on some of the books. But we want to make that something that
// is happening on every book." The thirteen six-page painted books carry six
// key words now, so they get the same moment under the same rules. They used
// to be this file's proof that a book without key words reads with Next; that
// guard is still in the reader, and a made-up book pins it at the end.
// Which word each page asks for is the book's own list (readtest holds every
// one to its page and its sound); this plays the moment, whatever the words.
const keysOf = (page, title) => page.evaluate((t) => STORIES.filter((b) => b.title === t)[0].keys.slice(), title);
const asWord = (w) => String(w || "").toLowerCase().replace(/[^a-z']/g, "");
const sceneLoaded = (page, ms = 6000) => until(page, () => { const i = document.querySelector("#bkStage .bkart.scene img"); return !!(i && i.complete && i.naturalWidth > 0); }, ms);

await scenario("six-page book", async () => {
  const { context, page, errors } = await fresh({ micok: true, today: "2026-12-31" });
  const before = await snapshot(page);
  const keys = await keysOf(page, "Reba the Robot");
  await openBook(page, "Reba the Robot");
  const pages = [];
  for (let i = 0; i < 6; i++) {
    const went = await waitLive(page);
    pages.push(Object.assign({ went }, await page.evaluate(() => ({ page: window.__book.page, word: window.__book.word, kw: [...document.querySelectorAll(".bktext .kw")].map((s) => s.textContent),
      ask: document.getElementById("bkAsk").textContent, note: document.getElementById("bkMicState").textContent, line: document.querySelector(".bktext").textContent,
      said: __quiet.speech.slice(), painted: !!document.querySelector("#bkStage .bkart.scene img[data-scene]") }))));
    await page.waitForTimeout(80);
    await voice(page, 260);
    pages[i].turned = await until(page, (n) => window.__book && window.__book.page === n, 3000, i + 1);
  }
  const brief = pages.map((p) => ({ went: p.went, page: p.page, word: p.word, kw: p.kw, ask: p.ask, note: p.note, turned: p.turned }));
  ok("a six-page book asks for its key word on every page: the word lights up in the line and the mic says \"Your turn!\"",
    keys.length === 6 && pages.every((p, i) => p.went && p.page === i && p.kw.length === 1 && asWord(p.kw[0]) === keys[i] && asWord(p.word) === keys[i] && p.note === "Your turn!"), { keys, brief });
  ok("…Echo reads the page first, then asks for that one word alone (\"Can you say... robot.\")",
    pages.every((p) => p.ask === "Can you say " + p.word + "?" && p.said.includes("Can you say... " + p.word + ".") && p.said.includes(p.line))
      && pages[0].said.indexOf(pages[0].line) < pages[0].said.indexOf("Can you say... " + pages[0].word + "."), { brief, said: pages[5].said });
  ok("…on its own painted scene", pages.filter((p) => p.painted).length >= 5, pages.map((p) => p.painted));
  ok("…a voice turns every one of the six pages", pages.every((p) => p.turned), brief);
  const end = await until(page, () => /The End!/.test(document.getElementById("bkStage").textContent), 4000);
  await page.waitForTimeout(400);
  const l = await log(page);
  ok("…and the sixth ends on The End, with a chime for each page heard", end && l.sfx.filter((x) => x.name === "correct").length === 6 && l.mics.length === 6, { end, sfx: l.sfx.map((x) => x.name), mics: l.mics.length });
  const after = await snapshot(page);
  const readKey = await page.evaluate(() => Sona.kkey("sona.lib.read.v1"));
  const moved = Object.keys(Object.assign({}, before, after)).filter((k) => before[k] !== after[k] && k !== readKey && k !== "sona.gamereps.v1" && k !== "sona.goaldays.v1");
  ok("…a six-page book read to The End by voice changes no practice key (only the read-star)", end && moved.length === 0 && /Reba the Robot/.test(after[readKey] || ""), moved.map((k) => k + "=" + String(after[k]).slice(0, 60)));
  ok("…six accepted words add exactly 6 play reps", (await page.evaluate(() => Sona.dayReps())) === 6);
  noOverlap("six-page book", l);
  clean("six-page book", errors);
  await context.close();
});

await scenario("six-page quiet", async () => {
  const { context, page, errors } = await fresh({ micok: true, today: "2026-12-31" });
  await openBook(page, "Reba the Robot");
  await waitLive(page);
  const nudged = await until(page, () => window.__book && window.__book.mode === "nudge", 16000);
  await page.waitForTimeout(1200);
  const st = await page.evaluate(() => ({ page: window.__book.page, tries: window.__book.tries, mode: window.__book.mode, live: __quiet.live(), requests: __quiet.requests, note: document.getElementById("bkMicState").textContent }));
  ok("silence never turns a six-page page, and is never a try: the mic closes and waits for a tap", nudged && st.page === 0 && st.tries === 0 && st.mode === "nudge" && st.live === 0 && st.note === "Tap the mic, then say it", st);
  await click(page, "bkMic");
  const again = await waitLive(page, 4000);
  ok("…the tap only listens again, on the same page", again && (await book(page)).page === 0, await book(page));
  clean("six-page quiet", errors);
  await context.close();
});

await scenario("six-page three tries", async () => {
  // Reba is an R book (a low, voiced sound), so a hiss is the other family
  const { context, page, errors } = await fresh({ micok: true, shape: "hiss", today: "2026-12-31" });
  await openBook(page, "Reba the Robot");
  for (let i = 1; i <= 3; i++) {
    await waitLive(page);
    await page.waitForTimeout(80);
    await voice(page, 260);
    await until(page, (n) => window.__book && (window.__book.tries >= n || window.__book.page > 0), 3000, i);
  }
  const turned = await until(page, () => window.__book && window.__book.page === 1, 5000);
  const l = await log(page);
  ok("three tries on a six-page page: Echo says something kind and the page turns, with no chime", turned && l.speech.includes("Great trying. Let's turn the page.") && !l.sfx.some((x) => x.name === "correct"), l.speech);
  clean("six-page three tries", errors);
  await context.close();
});

await scenario("six-page primer", async () => {
  const { context, page, errors } = await fresh({ permission: "prompt", today: "2026-12-31" });
  await openBook(page, "Reba the Robot");
  const asked = await until(page, () => window.__book && window.__book.primer === true, 6000);
  ok("a six-page book asks a grown-up first too, and the phone is never asked before that tap", asked && await page.evaluate(() => __quiet.requests) === 0, await book(page));
  await click(page, "bkPrimerNo");
  await page.waitForTimeout(200);
  await click(page, "bkNext");
  await page.waitForTimeout(2200);
  const p2 = await page.evaluate(() => ({ page: window.__book.page, mode: window.__book.mode, primer: window.__book.primer, requests: __quiet.requests, kw: !!document.querySelector(".bktext .kw") }));
  ok("…and after \"Not now\" it reads with Next, never asking again this visit", p2.page === 1 && p2.mode === "next" && !p2.primer && p2.requests === 0 && !p2.kw && await shown(page, "bkNext"), p2);
  clean("six-page primer", errors);
  await context.close();
});

// a painted scene is the same square as a drawn page, so the short phone
// squeezes it the same way: the question below the picture, never on it
await scenario("six-page short phone", async () => {
  const { context, page, errors } = await fresh({ micok: true, viewport: { width: 320, height: 568 }, today: "2026-12-31" });
  await openBook(page, "Reba the Robot");
  const up = await sceneLoaded(page);   // cut out of the book's picture on the phone, a beat after the page shows
  await waitLive(page);
  const asking = await layout(page);
  ok("320x568, a painted page: while Echo asks, his question sits below the picture, never on it, and the picture hasn't collapsed",
    up && !asking.hidden && asking.picBottom <= asking.bubble.top + 1 && asking.picH > 120, asking);
  clean("six-page short phone", errors);
  await context.close();
});

// developmental order is unchanged: the rule reads the book's sound, not its length
await scenario("six-page age", async () => {
  const { context, page, errors } = await fresh({ micok: true, age: "6", today: "2026-12-31" });
  await openBook(page, "Reba the Robot");
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => ({ mode: window.__book.mode, primer: window.__book.primer, requests: __quiet.requests, kw: !!document.querySelector(".bktext .kw"), speech: __quiet.speech.slice(), norm: Sona.soundNorm("R") }));
  ok("a 6-year-old reading a six-page R book (R comes by 7) hears it read, and is never asked to say its words",
    st.norm === 7 && st.mode === "next" && !st.primer && st.requests === 0 && !st.kw && !st.speech.some((t) => /Can you say/.test(t)) && await shown(page, "bkNext"), st);
  clean("six-page age", errors);
  await context.close();
});
await scenario("six-page age ok", async () => {
  const { context, page, errors } = await fresh({ micok: true, age: "4", focus: ["K"], today: "2026-12-31" });
  const keys = await keysOf(page, "Kiki the Koala");
  await openBook(page, "Kiki the Koala");
  const went = await waitLive(page);
  const b = await book(page);
  ok("…while a 4-year-old on the six-page K book (K comes by 4) gets the moment", went && asWord(b.word) === keys[0] && b.page === 0, { b, keys });
  clean("six-page age ok", errors);
  await context.close();
});

// the guard the six-page books used to prove: no key words, no moment. No
// book on the shelf lacks them now, so a made-up one is handed to the reader.
await scenario("no key words", async () => {
  const { context, page, errors } = await fresh({ micok: true });
  await page.evaluate(() => openBook({ sound: "R", emoji: "🐰", title: "A Book With No Key Words", colors: ["#ff7a6e", "#8a6fc4"], pages: [{ e: "🐰", t: "A rabbit runs." }, { e: "🌈", t: "The rain stops." }] }));
  await page.waitForTimeout(150);
  await click(page, "bkNext");
  await page.waitForTimeout(1800);
  const st = await page.evaluate(() => ({ page: window.__book.page, mode: window.__book.mode, requests: __quiet.requests, kw: !!document.querySelector(".bktext .kw"), speech: __quiet.speech.slice() }));
  ok("a book without key words has no moment: Next, no mic, nothing asked", st.page === 0 && st.mode === "next" && st.requests === 0 && !st.kw && !st.speech.some((t) => /Can you say/.test(t)) && await shown(page, "bkNext"), st);
  // …and a page whose key is missing reads with Next while its neighbours ask
  await page.evaluate(() => { closeBook(); openBook({ sound: "R", emoji: "🐰", title: "A Book With One Key Word", colors: ["#ff7a6e", "#8a6fc4"], keys: ["", "rain"], pages: [{ e: "🐰", t: "A rabbit runs." }, { e: "🌈", t: "The rain stops." }] }); });
  await page.waitForTimeout(150);
  await click(page, "bkNext");
  await page.waitForTimeout(1800);
  const gap = await page.evaluate(() => ({ page: window.__book.page, mode: window.__book.mode, requests: __quiet.requests }));
  await click(page, "bkNext");
  const went = await waitLive(page);
  ok("…and a page with no key of its own reads with Next, while the next page asks for its word", gap.page === 0 && gap.mode === "next" && gap.requests === 0 && went && (await book(page)).word === "rain", { gap, b: await book(page) });
  clean("no key words", errors);
  await context.close();
});

// ── 10. a book from behind "More books" is the same book (Travis, 1 Oct 2026) ──
// The other sounds' books wait closed under the child's own shelf. One opened
// from there reads and asks exactly as it would on a child's own shelf, and
// the age rule is still the BOOK's sound, not the child's: a six-year-old on
// R is asked an S book's words (S, by 5); a four-year-old is not.
async function openFromMore(page, title) {
  await click(page, "moreBtn");
  await page.evaluate((t) => [...document.querySelectorAll("#moreShelf .bookBtn")].find((b) => b.querySelector(".bt").textContent === t).click(), title);
  await page.waitForTimeout(150);
  await click(page, "bkNext");   // the title page's Start
}
await scenario("more books", async () => {
  // an S is a hiss: the check is the book's own sound family, wherever the book stood
  const { context, page, errors } = await fresh({ micok: true, age: "6", shape: "hiss", today: "2026-10-05" });
  const shut = await page.evaluate(() => ({ open: document.getElementById("moreBtn").getAttribute("aria-expanded"), n: document.querySelectorAll("#moreShelf .bookBtn").length, sfx: __quiet.sfx.length, speech: __quiet.speech.length }));
  await openFromMore(page, "Sid the Seagull");
  const went = await waitLive(page);
  const st = await page.evaluate(() => ({ word: window.__book.word, ask: document.getElementById("bkAsk").textContent, norm: Sona.soundNorm("S") }));
  ok("a book opened from behind More books asks for its own word, like any book on the shelf", shut.open === "false" && shut.n === 0 && went && st.word === "seagull" && st.ask === "Can you say seagull?" && st.norm === 5, { shut, st });
  ok("…and the shelf made no sound of its own before it was touched", shut.sfx === 0 && shut.speech === 0, { shut });
  await voice(page, 260);
  ok("…and a voice of that book's kind (an S is a hiss) turns its page", await until(page, () => window.__book && window.__book.page === 1, 3000));
  noOverlap("more books", await log(page));
  clean("more books", errors);
  await context.close();
});
// Menus are silent: the More books button makes the page's tap chime and
// nothing else, opening and closing. Counted with NO book opened afterwards:
// opening one stops any line in flight and drops a waiting chime, so a count
// taken after a book cannot tell a button that spoke, or one that never
// chimed, from the real one.
await scenario("more books silent", async () => {
  const { context, page, errors } = await fresh({ age: "6", today: "2026-10-05" });
  const tts = []; page.on("request", (q) => { if (/\/api\/tts/.test(q.url())) tts.push(q.url()); });
  const heard = () => page.evaluate(() => ({ sfx: __quiet.sfx.map((x) => x.name), speech: __quiet.speech.slice(), voices: __quiet.sounds.filter((x) => x.kind !== "osc").map((x) => x.kind), mics: __quiet.requests,
    open: document.getElementById("moreBtn").getAttribute("aria-expanded"), books: [...document.querySelectorAll("#moreShelf .bookBtn")].filter((b) => b.offsetParent !== null).length, reader: document.getElementById("book").classList.contains("show") }));
  const quiet = (x, taps) => JSON.stringify(x.sfx) === JSON.stringify(taps) && x.speech.length === 0 && x.voices.length === 0 && x.mics === 0 && !x.reader;
  const before = await heard();
  await click(page, "moreBtn"); await page.waitForTimeout(900);
  const opened = await heard(), ttsOpened = tts.length;
  await click(page, "moreBtn"); await page.waitForTimeout(900);
  const closed = await heard();
  ok("opening More books makes exactly one sound, the page's tap chime: no voice, no line asked of the voice service, no mic", quiet(before, []) && opened.open === "true" && opened.books > 0 && quiet(opened, ["tap"]) && ttsOpened === 0, { before, opened, ttsOpened });
  ok("…and closing it is the same one chime, and still no voice", closed.open === "false" && closed.books === 0 && quiet(closed, ["tap", "tap"]) && tts.length === 0, { closed, tts });
  clean("more books silent", errors);
  await context.close();
});
await scenario("more books age", async () => {
  const { context, page, errors } = await fresh({ micok: true, age: "4", today: "2026-10-05" });
  await openFromMore(page, "Sid the Seagull");
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => ({ mode: window.__book.mode, primer: window.__book.primer, requests: __quiet.requests, kw: !!document.querySelector(".bktext .kw"), speech: __quiet.speech.slice() }));
  ok("a 4-year-old who opens an S book from behind More books hears it read, and is never asked to say its words", st.mode === "next" && !st.primer && st.requests === 0 && !st.kw && !st.speech.some((t) => /Can you say/.test(t)) && await shown(page, "bkNext"), st);
  clean("more books age", errors);
  await context.close();
});

await browser.close();
server.close();
console.log(failures ? failures + " FAILURES" : "ALL GREEN");
process.exit(failures ? 1 : 0);
