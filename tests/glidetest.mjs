// GLIDE2: Flappy Glide, rebuilt as a flight (27 Sep 2026), the same round
// Travis said yes to for Fruit Slice: three legs, a cloud rest between each
// with the say-it card, and a fireworks landing that always ends the flight
// in a win. The review found it the hardest of the six, so the balloon floats
// (a tap about every second holds it level), the gaps are wider and further
// apart, and a hedge is a soft bounce, never the card. Hold-to-rise, which
// changes the control, waits for Travis.
//
// This plays a round on a fake phone. The say-it card's own listening is
// micquietgamestest's (every arcade game shares it); here a heard child is
// the card's own success path, closeReviveMic() then doRevive().
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from "./_env.mjs";

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT, BASE = "http://127.0.0.1:8267";
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2", mp3: "audio/mpeg" };
const server = createServer((req, res) => {
  const u = new URL(req.url, BASE), f = path.join(ROOT, u.pathname);
  if (u.pathname.startsWith("/api/")) { res.writeHead(503); res.end("{}"); return; }
  if (!existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[f.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8267, "127.0.0.1", r));
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(detail))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, e.stack); } }
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");

// ── the code: a flight, not a practice ──
const PAGE = readFileSync(ROOT + "/arcade-glide.html", "utf8"), code = strip(PAGE);
ok("three legs of 6, 7 and 8 gaps, then a landing", /var LEGS=\[\{goal:6\},\{goal:7\},\{goal:8\}\];/.test(code) && /function fireworks\(\)/.test(code));
ok("the balloon floats: gentler lift and fall, a capped sink, wider gaps further apart",
  /var G=H\*0\.00028, FLAP=-H\*0\.0072, VMAX=H\*0\.0058;/.test(code) && /gapBase=H\*0\.46/.test(code) && /gateEvery=2900/.test(code));
ok("a hedge is a soft bounce, never the card", /\) bump\(g\);/.test(code) && !/\(py<topH\+22\|\|py>botY-22\)\)\{\s*crash\(\)/.test(code));
ok("only a cloud rest asks for the sound", /sayCard\("Say \\u201C"\+SAYTXT\+"\\u201D to fly on!"/.test(code));
ok("nothing in the flight is practice data", !/logAttempt|bumpReps|recordSession|recordRung|rotAdvance|repsBeacon/.test(code));
ok("the page asks for the mic in one place only: the say-it card", (code.match(/getUserMedia\(/g) || []).length === 1 && /function openReviveMic\(\)/.test(code));

// ── a fake phone: a mic that hears silence, audio that records what plays ──
function fakePhone() {
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
    const sfx = v.sfx || {}; v.sfx = new Proxy(sfx, { get(t, k) { const real = t[k]; if (typeof real !== "function" || k === "stop") return real; return function () { f.sfx.push({ name: k, live: f.live > 0 }); return real.apply(this, arguments); }; } }); } });
  localStorage.setItem("sona.freeera.v1", "post"); ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true, voiceOn: false, soundOn: true, volume: 0.6 }));
  sessionStorage.setItem("sona.play.token", "arcade-glide.html");
}
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (r) => (r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort()));
  await context.addInitScript(fakePhone);
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/arcade-glide.html?from=charge");
  await page.waitForFunction(() => window.gameEntryAllowed === true && typeof startLeg === "function");
  return { context, page, errors };
}
const st = (page) => page.evaluate(() => ({ phase, leg, legGot, score, REV, bumps, playing, card: document.getElementById("revOvl").classList.contains("show"),
  title: document.getElementById("revTitle").textContent, ended: !!window.__ended, mics: __f.mics, live: __f.live }));
const heard = (page) => page.evaluate(() => { closeReviveMic(); doRevive(); });
// fly the rest of this leg quickly: count all but the last gap as flown
const nearEnd = (page) => page.evaluate(() => { gates = []; legGot = LEGS[leg].goal - 1; spawnGate(); gates[0].x = px + 40; gates[0].cy = py; });

await scenario("a whole flight", async () => {
  const { context, page, errors } = await open();
  try {
    let s = await st(page);
    ok("leg 1 opens with its banner, and asks for no mic", /Leg 1/.test(await page.locator("#bnBig").textContent()) && s.mics === 0);
    // the float: with no taps at all, a second later the balloon has sunk only a little
    const y0 = await page.evaluate(() => py); await page.waitForTimeout(1000); const y1 = await page.evaluate(() => py);
    ok("left alone, the balloon sinks slowly (not a drop)", y1 - y0 < 844 * 0.35, { y0, y1 });
    // a hedge: a soft bounce
    await page.evaluate(() => { mercyT = -1e9; gates = [{ x: px, cy: py - 844 * 0.4, passed: false, star: false, gold: false, got: false }]; });
    await page.waitForFunction(() => bumps === 1, null, { timeout: 3000 });
    s = await st(page);
    ok("touching a hedge is a soft bounce: no card, the flight goes on", !s.card && s.playing && s.REV === 3 && s.phase === "fly" && s.mics === 0, s);
    // a star in a gap: caught by flying through it
    const before = await page.evaluate(() => score);
    await page.evaluate(() => { gates = [{ x: px, cy: py, passed: true, star: true, gold: true, got: false }]; });
    await page.waitForFunction(() => gates.length && gates[0].got, null, { timeout: 3000 });
    ok("flying through a golden star catches it, worth three", (await page.evaluate(() => score)) - before === 3);
    // the cloud rest
    await nearEnd(page);
    await page.locator("#revOvl.show").waitFor({ timeout: 12000 });
    s = await st(page);
    ok("the end of leg 1 is a rest on a cloud, and the card asks for the sound to fly on", /^Say “rrrr” to fly on!$/.test(s.title) && s.leg === 0, s);
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 12000 });
    await heard(page);
    s = await st(page);
    ok("the child's sound starts leg 2, and the mic is closed again", s.leg === 1 && s.phase === "fly" && s.playing && !s.card && s.REV === 2 && s.live === 0, s);
    await nearEnd(page);
    await page.locator("#revOvl.show").waitFor({ timeout: 12000 });
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 12000 });
    await heard(page);
    await nearEnd(page);
    await page.waitForFunction(() => phase === "done", null, { timeout: 8000 });
    s = await st(page);
    ok("after leg 3 the balloon lands with fireworks, with no card", !s.card && s.mics === 2 && s.REV === 1, s);
    await page.locator("#endOvl.show").waitFor({ timeout: 8000 });
    const wonTitle = await page.locator("#endTitle").innerText();
    ok("…and the flight is won, and the card leads with that win", /^What a flight![\s\S]*You landed with fireworks!/.test(wonTitle) && !/Great round/.test(wonTitle) && (await page.evaluate(() => finaleDone)), wonTitle);
    ok("the earned turn is spent once the flight ends", await page.evaluate(() => sessionStorage.getItem("sona.play.active") === null && sessionStorage.getItem("sona.play.token") === null));
    const sfx = await page.evaluate(() => __f.sfx);
    ok("no sound ever played while the card's mic was open", sfx.length > 0 && sfx.every((c) => !c.live), sfx.filter((c) => c.live));
    ok("a whole flight: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await browser.close(); await new Promise((r) => server.close(r));
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
