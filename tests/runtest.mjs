// RUN2: Sound Sprint, rebuilt as a race (27 Sep 2026), the same round Travis
// said yes to for Fruit Slice: the park, the beach and the forest, a
// checkpoint between each with the say-it card, and a finish line that always
// ends the race in a win. A rock is a tumble, never a stop; the child taps the
// lane they want (or swipes); a golden coin is a magnet.
//
// This plays a round on a fake phone. The say-it card's own listening is
// micquietgamestest's (every arcade game shares it); here a heard child is
// the card's own success path, closeReviveMic() then doRevive().
//
// And the start card (1 Oct 2026, Travis: "when a kid is about to start
// playing sound sprint, we want the voice ... to say instructions ... so that
// they have instruction on what to do"): a child's first three races open on
// a card, the race held behind it; "Let's run!" has Echo say how to play, and
// the race starts the moment he stops (or on Skip, or when no voice comes).
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from "./_env.mjs";

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT, BASE = "http://127.0.0.1:8266";
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2", mp3: "audio/mpeg" };
// Echo's voice service, as each scenario needs it: "ok" answers a line of
// TTS.ms of 24 kHz PCM (after TTS.delay), "fail" answers 503, "hang" never
// answers. Every ask is kept, so a scenario can count them and read the text.
// The say-it card's own two lines are asked for as the page loads (2 Oct
// 2026, /arcade-sayit.js), so they are kept apart (card) and never counted
// as the start card's asks.
const TTS = { mode: "fail", ms: 900, delay: 0, asks: [], card: [], open: [] };
const CARD_LINES = ["To keep playing, say", "Go!"];
const server = createServer((req, res) => {
  const u = new URL(req.url, BASE), f = path.join(ROOT, u.pathname);
  if (u.pathname === "/api/tts") {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      let text = null; try { text = JSON.parse(body).text; } catch (e) {}
      (CARD_LINES.includes(text) ? TTS.card : TTS.asks).push(text);
      if (TTS.mode === "hang") { TTS.open.push(res); return; }
      if (TTS.mode === "fail") { res.writeHead(503); res.end("{}"); return; }
      setTimeout(() => { res.writeHead(200, { "content-type": "application/octet-stream" }); res.end(Buffer.alloc(48 * TTS.ms)); }, TTS.delay);
    });
    return;
  }
  if (u.pathname.startsWith("/api/")) { res.writeHead(503); res.end("{}"); return; }
  if (!existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[f.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8266, "127.0.0.1", r));
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(detail))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, e.stack); } }
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");

// ── the code: a race, not a practice ──
const PAGE = readFileSync(ROOT + "/arcade-run.html", "utf8"), code = strip(PAGE);
ok("three stretches, the park, the beach and the forest, then the finish line",
  /\{name:"the park",len:160,/.test(code) && /\{name:"the beach",len:190,/.test(code) && /\{name:"the forest",len:220,/.test(code) && /function drawFinish\(/.test(code));
ok("a rock is a tumble, never the card", /things\.splice\(i,1\); startFall\(\); continue;/.test(code) && !/things\.splice\(i,1\); crash\(\);/.test(code));
ok("only a checkpoint asks for the sound", /sayCard\("Say \\u201C"\+SAYTXT\+"\\u201D to run to "/.test(code));
ok("the win card counts metres, not \"treats\"", !/treats/.test(code) && /dist\+" m · Best: "\+BEST\+" m"/.test(code));
ok("nothing in the race is practice data", !/logAttempt|bumpReps|recordSession|recordRung|rotAdvance|repsBeacon/.test(code));
ok("the page asks for the mic in one place only: the say-it card", (code.match(/getUserMedia\(/g) || []).length === 1 && /function openReviveMic\(\)/.test(code));

// ── a fake phone: a mic that hears silence, audio that records what plays ──
// cfg.seen: how many races this child has started from the start card (three
// by default: the race starts at once, as it does for a child who knows the
// game; null leaves whatever the phone already holds). cfg.volume 0 is sound
// off. cfg.app is the iPhone app.
function fakePhone(cfg) {
  // Echo's mid-round ask for the sound power (3 Oct 2026) is
  // arcadespeechhelptest's: held here, so a round is just the round.
  document.addEventListener("DOMContentLoaded", () => { if (window.SLOW_ASK) { SLOW_ASK.first = SLOW_ASK.every = SLOW_ASK.quiet = 1e12; window.slowAskAt = 1e12; } });
  cfg = cfg || {};
  const f = window.__f = { mics: 0, live: 0, sfx: [], voice: [], pcm: [], synth: [], hidden: false };
  if (cfg.app) window.Capacitor = { isNativePlatform: () => true, Plugins: {} };
  Object.defineProperty(document, "hidden", { configurable: true, get: () => f.hidden });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (f.hidden ? "hidden" : "visible") });
  f.hide = (h) => { f.hidden = h; document.dispatchEvent(new Event("visibilitychange")); };
  navigator.mediaDevices.getUserMedia = () => {
    f.mics++; f.live++;
    const t = { readyState: "live", stop() { if (this.readyState === "live") { this.readyState = "ended"; f.live--; } } };
    return Promise.resolve({ getTracks: () => [t], getAudioTracks: () => [t] });
  };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  const node = () => ({ gain: param(), frequency: param(), Q: param(), playbackRate: param(), type: "", buffer: null, connect() {}, disconnect() {}, start() {}, stop() {} });
  // a voice line through Web Audio is a buffer of samples (the one-sample
  // buffer is the tap's unlock, not a line): kept, and it ends in 60 ms
  const source = () => { const n = node(); n.start = function () { if (n.buffer && n.buffer.length > 1) { f.pcm.push(n.buffer.length); setTimeout(() => { if (n.onended) n.onended(); }, 60); } }; return n; };
  function AC() { this.state = "running"; this.sampleRate = 48000; this.currentTime = 0; this.destination = {}; }
  AC.prototype = {
    resume() { return Promise.resolve(); }, suspend() { return Promise.resolve(); }, close() { return Promise.resolve(); },
    createGain: node, createOscillator: node, createBufferSource: source, createBiquadFilter: node,
    createBuffer(c, n, sr) { return { length: n, sampleRate: sr, duration: n / sr, getChannelData: () => new Float32Array(n) }; },
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; },
    createAnalyser() { return { fftSize: 2048, frequencyBinCount: 1024, smoothingTimeConstant: 0, connect() {}, disconnect() {},
      getByteTimeDomainData(a) { a.fill(128); }, getFloatTimeDomainData(a) { a.fill(0); }, getByteFrequencyData(a) { a.fill(0); }, getFloatFrequencyData(a) { a.fill(-120); } }; },
  };
  window.AudioContext = window.webkitAudioContext = AC;
  // Echo's lead-in and Rachel's sound clip end at once: on a slow CI runner
  // real media playback held the card's mic back past the test's patience
  // (27 Sep 2026: GitHub's runner took 5.8 s for the first card)
  // A blob is Echo's line played as media (Sona.mediaPCM): kept, with when it
  // started and whether it was stopped, and it lasts cfg.lineMs.
  window.Audio = function (src) {
    const line = /^blob:/.test(String(src)), a = { src, volume: 1, paused: false, play() { if (line) f.voice.push(a); a.at = performance.now(); setTimeout(() => { if (a.paused) return; a.over = true; if (a.onended) a.onended(); }, line ? (cfg.lineMs || 900) : 20); return Promise.resolve(); },
      pause() { if (!a.over) a.cut = true; a.paused = true; }, removeAttribute() {}, load() {} };
    return a;
  };
  // the browser's own voice: what it was asked to say, ending in 60 ms
  try { window.speechSynthesis.speak = (u) => { f.synth.push(u.text); setTimeout(() => { if (u.onend) u.onend(); }, 60); }; window.speechSynthesis.cancel = () => {}; } catch (e) {}
  // every Sona sound, with whether a mic was live as it started
  let sona;
  Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set: (v) => { sona = v;
    const sfx = v.sfx || {}; v.sfx = new Proxy(sfx, { get(t, k) { const real = t[k]; if (typeof real !== "function" || k === "stop") return real; return function () { f.sfx.push({ name: k, live: f.live > 0 }); return real.apply(this, arguments); }; } }); } });
  localStorage.setItem("sona.freeera.v1", "post"); ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true, voiceOn: cfg.volume !== 0, soundOn: true, volume: cfg.volume == null ? 0.6 : cfg.volume }));
  if (cfg.seen !== null) localStorage.setItem("sona.sprintintro.v1", String(cfg.seen == null ? 3 : cfg.seen));
  sessionStorage.setItem("sona.play.token", "arcade-run.html");
}
async function open(cfg = {}, size = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport: size, reducedMotion: "reduce" });
  await context.route("**/*", (r) => (r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort()));
  await context.addInitScript(fakePhone, cfg);
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/arcade-run.html?from=charge");
  await page.waitForFunction(() => window.gameEntryAllowed === true && typeof startStretch === "function");
  return { context, page, errors };
}
const st = (page) => page.evaluate(() => ({ phase, stretch, dist, coins, REV, tumbles, playing, lane, card: document.getElementById("revOvl").classList.contains("show"),
  title: document.getElementById("revTitle").textContent, ended: !!window.__ended, mics: __f.mics, live: __f.live }));
const heard = (page) => page.evaluate(() => { closeReviveMic(); doRevive(); });
// run the rest of this stretch quickly: jump to just before its end
const nearEnd = (page) => page.evaluate(() => { things = []; dist = stretchStart + STRETCHES[stretch].len - 2; });
async function tapAt(page, x, y, x2) {
  await page.mouse.move(x, y); await page.mouse.down(); if (x2 != null) await page.mouse.move(x2, y, { steps: 4 }); await page.mouse.up();
}

// ── the start card ──
const LINE = "Tap a lane to move side to side. Dodge the rocks and the cactus, and grab the gold coins!";
ok("Echo's line is true to the race: lanes, rocks and a cactus to dodge, gold coins to grab (no gold star)", code.includes('var START_LINE="' + LINE + '";') && !/gold star/i.test(LINE));
ok("Echo has seven seconds to begin, and a line that plays gets its own length", /START_WAIT_MS=7000,/.test(code) && /startCap\(my,START_WAIT_MS\)/.test(code) && /startCap\(my,Math\.max\(4000,ms\+START_TAIL_MS\)\+500\)/.test(code));
ok("the count of races is the child's own", /S\.kkey\("sona\.sprintintro\.v1"\)/.test(code) && /"sona\.sprintintro\.v1",/.test(strip(readFileSync(ROOT + "/sona.js", "utf8")).match(/const PER_KID = new Set\(\[([\s\S]*?)\]\);/)[1]));
const card = (page) => page.evaluate(() => ({ shown: document.getElementById("startOvl").classList.contains("show"), held: raceHeld, playing, saying: sc.saying,
  btn: document.getElementById("startGo").textContent.trim(), echo: document.getElementById("startEcho").getAttribute("src"), seen: localStorage.getItem("sona.sprintintro.v1"),
  voice: __f.voice.length, cut: __f.voice.filter((a) => a.cut).length, pcm: __f.pcm.length, synth: __f.synth.slice(), mics: __f.mics, on: document.querySelectorAll("#startTips .tip.on").length,
  still: JSON.stringify({ dist, things: things.length, sideOff, dashOff, spawnGap, speed: speed / speed0, distIv, rampIv, lane, score: document.getElementById("score").textContent,
    banner: document.getElementById("bnBig").textContent, slow: !document.getElementById("slowControl").hidden }) }));
const STILL = JSON.stringify({ dist: 0, things: 0, sideOff: 0, dashOff: 0, spawnGap: 0, speed: 1, distIv: 0, rampIv: 0, lane: 1, score: "0m", banner: "", slow: false });
// everything the phone keeps, but for the card's own count
const stored = (page) => page.evaluate(() => { const grab = (st) => { const o = {}; for (let i = 0; i < st.length; i++) { const k = st.key(i); if (k !== "sona.sprintintro.v1") o[k] = st.getItem(k); } return o; }; return JSON.stringify([grab(localStorage), grab(sessionStorage)]); });
const shown = async (page) => { await page.locator("#startOvl.show").waitFor(); };
const started = (page, timeout = 8000) => page.waitForFunction(() => raceHeld === false && playing === true, null, { timeout });
const voice = (mode, more = {}) => Object.assign(TTS, { mode, ms: 900, delay: 0, asks: [] }, more);

await scenario("the start card", async () => {
  voice("ok");
  const { context, page, errors } = await open({ seen: null });   // a new child: the phone holds no count
  try {
    await shown(page); await page.waitForFunction(() => sc.ready);
    let c = await card(page);
    const look = await page.evaluate(() => ({ buttons: [...document.querySelectorAll("#startOvl button")].length, tips: [...document.querySelectorAll("#startTips .tip")].map((t) => t.textContent.trim()),
      pics: [...document.querySelectorAll("#startTips img")].map((i) => i.getAttribute("src").split("/").pop() + (i.naturalWidth ? "" : " (missing)")), runner: getComputedStyle(document.getElementById("tipBuddy")).backgroundImage }));
    ok("a child's first race opens on the start card: Echo waving, and one button, “Let's run!”", c.shown && c.held && !c.playing && c.btn === "Let's run!" && /echo-wave\.webp$/.test(c.echo) && look.buttons === 1, { c, look });
    ok("…with three pictures from the race itself: the runner in the lanes, a rock and a cactus, a gold coin",
      JSON.stringify(look.tips) === JSON.stringify(["Tap a lane", "Dodge", "Grab coins"]) && JSON.stringify(look.pics) === JSON.stringify(["run-rock-v2.webp", "run-cactus-v2.webp", "run-coin-v2.webp"]) && /fox-runner\.webp/.test(look.runner), look);
    ok("Echo's line is asked for as the card shows: once, word for word", TTS.asks.length === 1 && TTS.asks[0] === LINE, TTS.asks);
    ok("…and nothing is said before a tap", c.voice === 0 && c.pcm === 0 && c.synth.length === 0, c);
    const before = await stored(page);
    await page.waitForTimeout(1300);
    await page.keyboard.press("ArrowRight");
    await tapAt(page, 40, 60);   // where the ✕ is, under the card
    c = await card(page);
    ok("behind the card nothing moves, spawns or counts: no metres, no rocks or coins, a still road, no clocks running, no banner, no slow-down button", c.still === STILL && c.held && !c.playing, c.still);
    await page.locator("#startGo").click();
    c = await card(page);
    ok("“Let's run!” has Echo say the line inside the tap, as media, with no second ask of the voice service", c.voice === 1 && c.pcm === 0 && c.synth.length === 0 && TTS.asks.length === 1, { c, asks: TTS.asks.length });
    ok("…while the card stays: Echo is talking, the button is now “Skip”, and the race is still held", c.shown && c.held && !c.playing && c.saying && c.btn === "Skip" && /echo-talk\.webp$/.test(c.echo) && c.still === STILL, c);
    await page.waitForTimeout(450);
    c = await card(page);
    ok("…and he points at one picture at a time as he names it", c.held && c.on === 1 && c.still === STILL, c);
    await started(page);
    const took = await page.evaluate(() => performance.now() - __f.voice[0].at);
    c = await card(page);
    // (the line is 900 ms here; had the race waited on anything but its end, the next thing to start it is mediaPCM's own watchdog at 2.4 s)
    ok("the race starts the moment his line ends", took >= 850 && took < 1900, took);
    ok("…with the card gone, stretch 1's banner up and both clocks running", !c.shown && c.playing && !c.saying && JSON.parse(c.still).banner === "Stretch 1" && JSON.parse(c.still).distIv > 0 && JSON.parse(c.still).rampIv > 0, c);
    ok("the line was said once, never cut, and no microphone was asked for", c.voice === 1 && c.cut === 0 && c.pcm === 0 && c.synth.length === 0 && c.mics === 0 && TTS.asks.length === 1, c);
    ok("that race is counted for this child, and nothing else is stored: no rep, no practice", c.seen === "1" && (await stored(page)) === before, { seen: c.seen });
    await page.waitForFunction(() => dist > 0 && sideOff > 0 && !document.getElementById("slowControl").hidden);
    ok("then the race runs, and the slow-down button is there", true);

    // the second race: a double tap, then Skip
    await page.reload(); await shown(page); await page.waitForFunction(() => sc.ready);
    await page.locator("#startGo").dblclick();
    c = await card(page);
    ok("the second race opens on the card too, and a double tap does not skip what its first tap asked for", c.held && c.saying && c.btn === "Skip" && c.voice === 1 && c.cut === 0, c);
    await page.waitForTimeout(650);
    await page.locator("#startGo").click();
    c = await card(page);
    ok("Skip starts the race at once and stops Echo mid-line", !c.held && c.playing && !c.shown && c.cut === 1 && c.seen === "2" && JSON.parse(c.still).banner === "Stretch 1", c);

    // the third, and then no more
    await page.reload(); await shown(page); await page.waitForFunction(() => sc.ready);
    await page.locator("#startGo").click(); await started(page);
    ok("the third race opens on the card", (await card(page)).seen === "3");
    const asks = TTS.asks.length;
    await page.reload(); await page.waitForFunction(() => window.gameEntryAllowed === true && typeof startStretch === "function");
    await page.waitForTimeout(300);
    c = await card(page);
    ok("the fourth race starts straight away: no card, and Echo's line is not even asked for", !c.shown && !c.held && c.playing && JSON.parse(c.still).banner === "Stretch 1" && c.seen === "3" && TTS.asks.length === asks && c.voice === 0, c);
    ok("the start card: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await scenario("the start card with sound off", async () => {
  voice("ok");
  const { context, page, errors } = await open({ seen: 0, volume: 0 });
  try {
    await shown(page); await page.waitForTimeout(300);
    ok("with sound off the card still shows, and no line is asked for", (await card(page)).held && TTS.asks.length === 0, TTS.asks);
    await page.locator("#startGo").click();
    const c = await card(page);
    ok("…and “Let's run!” starts the race at once: no voice, no wait", !c.held && c.playing && !c.shown && c.voice === 0 && c.pcm === 0 && c.synth.length === 0 && c.seen === "1" && TTS.asks.length === 0, c);
    ok("sound off: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await scenario("the start card when the line is slow, or never comes", async () => {
  // slow: the tap comes before the line does
  voice("ok", { delay: 1500 });
  let { context, page, errors } = await open({ seen: 0 });
  try {
    await shown(page); await page.locator("#startGo").click();
    let c = await card(page);
    ok("tapped before the line has come: the card waits on “Skip”, held, with nothing said yet", c.held && c.saying && c.btn === "Skip" && c.voice === 0, c);
    await page.waitForFunction(() => __f.voice.length === 1);
    ok("…Echo says it the moment it lands", (await card(page)).held);
    await started(page);
    c = await card(page);
    ok("…and the race starts when he stops", c.voice === 1 && c.cut === 0 && TTS.asks.length === 1 && c.seen === "1", c);
    ok("a slow line: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }

  // the voice service answers "no": sona.js's own pipeline says the line (the browser's voice in the end)
  voice("fail");
  ({ context, page, errors } = await open({ seen: 0 }));
  try {
    await shown(page); await page.waitForFunction(() => sc.ready);
    await page.locator("#startGo").click(); await started(page);
    const c = await card(page);
    ok("when the voice service fails, the browser's voice says the same line, and the race starts when it stops", c.voice === 0 && JSON.stringify(c.synth) === JSON.stringify([LINE]) && TTS.asks.every((t) => t === LINE) && c.seen === "1", { c, asks: TTS.asks });
    ok("a failed line: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }

  // the voice service never answers: seven seconds, then the race, and no second ask
  voice("hang");
  ({ context, page, errors } = await open({ seen: 0 }));
  try {
    await shown(page); await page.locator("#startGo").click();
    const t0 = Date.now();
    await page.waitForTimeout(4500);
    let c = await card(page);
    ok("when the voice service never answers, the card holds on “Skip”…", c.held && c.saying && c.btn === "Skip" && c.still === STILL, c);
    await started(page, 6000);
    const waited = Date.now() - t0;
    c = await card(page);
    ok("…and the race starts by itself within seven seconds of the tap, with nothing said and no second ask", waited > 5000 && waited < 7600 && c.voice === 0 && c.pcm === 0 && c.synth.length === 0 && TTS.asks.length === 1 && c.seen === "1", { waited, c, asks: TTS.asks.length });
    ok("a line that never comes: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); TTS.open.splice(0).forEach((r) => { try { r.destroy(); } catch (e) {} }); }
});

await scenario("the start card when the phone is locked mid-line", async () => {
  voice("ok", { ms: 2500 });
  const { context, page, errors } = await open({ seen: 0, lineMs: 2500 });
  try {
    await shown(page); await page.waitForFunction(() => sc.ready);
    await page.locator("#startGo").click(); await page.waitForTimeout(500);
    await page.evaluate(() => __f.hide(true));
    let c = await card(page);
    ok("hiding the page mid-line stops Echo, and the race stays held", c.cut === 1 && c.held && !c.playing && !c.saying && c.seen === "0", c);
    await page.waitForTimeout(2600);
    await page.evaluate(() => __f.hide(false));
    c = await card(page);
    ok("coming back, the card is there again as it first was: Echo waving, “Let's run!”, nothing started", c.shown && c.held && !c.playing && c.btn === "Let's run!" && /echo-wave\.webp$/.test(c.echo) && c.on === 0 && c.still === STILL && c.voice === 1, c);
    await page.locator("#startGo").click();
    c = await card(page);
    ok("…and a new tap has him say it again, from the line the phone already holds", c.voice === 2 && c.saying && TTS.asks.length === 1, { c, asks: TTS.asks.length });
    await started(page);
    c = await card(page);
    ok("…then the race starts, counted once, with no microphone asked for", c.seen === "1" && c.mics === 0 && c.cut === 1, c);
    ok("locked mid-line: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }

  // locked before the line ever came (a locked phone drops the ask): it is
  // asked for once more on the way back, so the tap still finds Echo ready
  voice("fail");
  const again = await open({ seen: 0 });
  try {
    const page = again.page;
    await shown(page); await page.waitForFunction(() => sc.ready);
    await page.evaluate(() => __f.hide(true));
    const lost = TTS.asks.length;
    voice("ok");
    await page.evaluate(() => __f.hide(false));
    await page.waitForFunction(() => sc.ready && !!sc.bytes);
    let c = await card(page);
    ok("a line lost while the phone was locked is asked for once more on the way back, behind the card, with nothing said or started", lost === 1 && TTS.asks.length === 1 && TTS.asks[0] === LINE && c.shown && c.held && !c.playing && !c.saying && c.voice === 0 && c.synth.length === 0 && c.still === STILL, { lost, asks: TTS.asks, c });
    await page.evaluate(() => { __f.hide(true); __f.hide(false); });
    await page.waitForTimeout(200);
    ok("…and a line already in hand is not asked for again", TTS.asks.length === 1, TTS.asks);
    await page.locator("#startGo").click();
    c = await card(page);
    ok("…so the tap has Echo say it in his own voice, at once", c.voice === 1 && c.pcm === 0 && c.synth.length === 0 && c.saying && TTS.asks.length === 1, c);
    await started(page);
    ok("locked before the line came: no runtime errors", again.errors.length === 0, again.errors);
  } finally { await again.context.close(); }
});

await scenario("the start card in the iPhone app, and on a small phone", async () => {
  voice("ok");
  let { context, page, errors } = await open({ seen: 0, app: true });
  try {
    await shown(page); await page.waitForFunction(() => sc.ready);
    ok("in the iPhone app the page knows it is the app", await page.evaluate(() => Sona.voiceAsMedia() === true));
    await page.locator("#startGo").click();
    const c = await card(page);
    ok("…and Echo's line plays as media there, never Web Audio", c.voice === 1 && c.pcm === 0 && c.synth.length === 0, c);
    await started(page);
    ok("the iPhone app: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }

  voice("ok", { ms: 2500 });
  ({ context, page, errors } = await open({ seen: 0, lineMs: 2500 }, { width: 320, height: 568 }));
  try {
    await shown(page); await page.waitForFunction(() => sc.ready);
    const box = () => page.evaluate(() => { const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
      return { vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, card: r(document.querySelector("#startOvl .ovlCard")), echo: r(document.getElementById("startEcho")), go: r(document.getElementById("startGo")),
        tips: [...document.querySelectorAll("#startTips .tip")].map(r) }; });
    const inside = (b, m) => b.l >= 0 && b.t >= 0 && b.r <= m.vw && b.b <= m.vh;
    let m = await box();
    ok("on a small phone (320×568) the whole card is on screen: Echo, the three pictures on one line, and a button at least 44 high",
      m.sw <= m.vw && inside(m.card, m) && inside(m.echo, m) && inside(m.go, m) && m.go.h >= 44 && m.go.w >= 44 && m.tips.length === 3 && m.tips.every((t) => inside(t, m) && Math.abs(t.t - m.tips[0].t) < 1 && Math.abs(t.b - m.tips[0].b) < 1), m);
    const cardBox = m.card;
    await page.locator("#startGo").click();
    m = await box();
    ok("…and “Skip” is a full-size target too, with the card not jumping under the child's finger", inside(m.go, m) && m.go.h >= 44 && m.go.w >= 44 && Math.abs(m.card.t - cardBox.t) < 1 && Math.abs(m.card.h - cardBox.h) < 1, { m, cardBox });
    ok("a small phone: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await scenario("a whole race", async () => {
  const { context, page, errors } = await open();
  try {
    let s = await st(page);
    ok("a child past their third race meets no start card: the race is already running", await page.evaluate(() => !document.getElementById("startOvl").classList.contains("show") && raceHeld === false && playing === true));
    ok("stretch 1 opens with its banner, and asks for no mic", /Stretch 1/.test(await page.locator("#bnBig").textContent()) && /the park/.test(await page.locator("#bnSmall").textContent()) && s.mics === 0 && s.lane === 1);
    // tap the lane you want, or swipe
    const lx = await page.evaluate(() => [0, 1, 2].map((l) => laneCX(l)));
    await tapAt(page, lx[2], 500); ok("tapping the right lane runs there", (await st(page)).lane === 2);
    await tapAt(page, lx[0], 500); ok("…and tapping the left lane, two lanes over, runs there too", (await st(page)).lane === 0);
    await tapAt(page, 200, 500, 280); ok("a swipe right moves one lane", (await st(page)).lane === 1);
    // a rock: a tumble, not the card
    await page.waitForFunction(() => Math.abs(laneX - lane) < 0.05);   // the runner has reached the lane
    await page.evaluate(() => { hurtT = -1e9; things.push({ t: "o", e: "🪨", lane: lane, y: PLAYY() - 20 }); });   // (no mercy window left over)
    await page.waitForFunction(() => falling.on === true, null, { timeout: 3000 });
    s = await st(page);
    ok("a rock is a tumble: no card, nothing lost but ten metres, the race goes on", !s.card && s.playing && s.REV === 3 && s.tumbles === 1 && s.mics === 0, s);
    await page.waitForFunction(() => falling.on === false, null, { timeout: 3000 });
    // a golden coin is a magnet
    await page.waitForFunction(() => Math.abs(laneX - lane) < 0.05);
    await page.evaluate(() => { things.push({ t: "c", e: "🪙", lane: lane, y: PLAYY() - 10, gold: true }); });
    await page.waitForFunction(() => performance.now() < magnetUntil, null, { timeout: 3000 });
    ok("a golden coin turns on the coin magnet", true);
    // the checkpoint
    await nearEnd(page);
    await page.locator("#revOvl.show").waitFor({ timeout: 12000 });
    s = await st(page);
    ok("the end of the park is a checkpoint, and the card asks for the sound to run to the beach", /^Say “rrrr” to run to the beach!$/.test(s.title) && s.stretch === 0, s);
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 12000 });
    await heard(page);
    s = await st(page);
    ok("the child's sound starts the beach, and the mic is closed again", s.stretch === 1 && s.phase === "run" && s.playing && !s.card && s.REV === 2 && s.live === 0, s);
    await nearEnd(page);
    await page.locator("#revOvl.show").waitFor({ timeout: 12000 });
    ok("the beach ends on the card for the forest", /to run to the forest!$/.test((await st(page)).title));
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 12000 });
    await heard(page);
    await nearEnd(page);
    await page.waitForFunction(() => phase === "finish", null, { timeout: 6000 });
    s = await st(page);
    ok("after the forest the finish line comes straight in, with no card", !s.card && s.mics === 2 && s.REV === 1, s);
    await page.locator("#endOvl.show").waitFor({ timeout: 15000 });
    ok("crossing it wins the race", /You won the race!/.test(await page.locator("#endTitle").innerText()) && (await page.evaluate(() => finaleDone)));
    ok("the earned turn is spent once the race ends", await page.evaluate(() => sessionStorage.getItem("sona.play.active") === null && sessionStorage.getItem("sona.play.token") === null));
    const sfx = await page.evaluate(() => __f.sfx);
    ok("no sound ever played while the card's mic was open", sfx.length > 0 && sfx.every((c) => !c.live), sfx.filter((c) => c.live));
    ok("a whole race: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await browser.close(); await new Promise((r) => server.close(r));
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
