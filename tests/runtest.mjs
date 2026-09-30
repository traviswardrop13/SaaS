// RUN2: Sound Sprint, rebuilt as a race (27 Sep 2026), the same round Travis
// said yes to for Fruit Slice: the park, the beach and the forest, a
// checkpoint between each with the say-it card, and a finish line that always
// ends the race in a win. A rock is a tumble, never a stop; the child taps the
// lane they want (or swipes); a golden coin is a magnet.
//
// This plays a round on a fake phone. The say-it card's own listening is
// micquietgamestest's (every arcade game shares it); here a heard child is
// the card's own success path, closeReviveMic() then doRevive().
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from "./_env.mjs";

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT, BASE = "http://127.0.0.1:8266";
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2", mp3: "audio/mpeg" };
const server = createServer((req, res) => {
  const u = new URL(req.url, BASE), f = path.join(ROOT, u.pathname);
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
  sessionStorage.setItem("sona.play.token", "arcade-run.html");
}
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (r) => (r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort()));
  await context.addInitScript(fakePhone);
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

await scenario("a whole race", async () => {
  const { context, page, errors } = await open();
  try {
    let s = await st(page);
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
