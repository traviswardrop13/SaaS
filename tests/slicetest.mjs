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
const CHARGE = readFileSync(ROOT + "/charge.html", "utf8");
ok("the \"Say it 5 times\" stand drops each fruit onto the counter, and stills it for reduced motion",
  /#stand \.well \.fr\.pop\{animation:fruitDrop/.test(CHARGE) && /@keyframes fruitDrop/.test(CHARGE) && /#reveals \.pop,#stand \.well \.fr\.pop\{animation:none;\}/.test(CHARGE));

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
  sessionStorage.setItem("sona.play.token", "arcade-slice.html");
}
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", hasTouch: false });
  await context.route("**/*", (r) => (r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort()));
  await context.addInitScript(fakePhone);
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/arcade-slice.html?from=charge");
  await page.waitForFunction(() => window.gameEntryAllowed === true && typeof startWave === "function");
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
    await page.waitForFunction(() => fruits.some((q) => q.g < G && q.r >= 41), null, { timeout: 8000 });
    ok("after two misses in a row the next fruit comes bigger and slower", true);
    // slice through wave 1
    ok("slicing six fruit finishes wave 1", await sliceUntil(page, () => phase !== "wave"));
    await page.locator("#revOvl.show").waitFor({ timeout: 12000 });
    s = await st(page);
    ok("…then the say-it card asks for the sound for wave 2", /^Say “rrrr” for wave 2!$/.test(s.title) && s.wave === 0 && !s.playing, s);
    ok("…with wave 1 ticked on the card", (await page.locator("#revHearts .wdot.on").count()) === 1 && (await page.locator("#revHearts .wdot").count()) === 3);
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 12000 });
    ok("the card's mic opens only after the wave's cheer, never during play", (await page.evaluate(() => __f.mics)) === 1);
    await heard(page);
    s = await st(page);
    ok("the child's sound starts wave 2, and the mic is closed again", s.wave === 1 && s.phase === "wave" && s.playing && !s.card && s.REV === 2 && s.live === 0, s);
    // a golden fruit counts three
    const dim = await page.evaluate(() => ({ W, H }));
    const before = await page.evaluate(() => ({ score, waveGot }));
    await page.evaluate(() => { fruits.push({ e: "🍊", gold: true, x: W / 2, y: H * 0.45, g: 0, vx: 0, vy: 0, r: 40, rot: 0, vr: 0, sliced: false }); });
    await page.mouse.move(dim.W / 2 - 90, dim.H * 0.45 - 20); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(dim.W / 2 - 90 + i * 30, dim.H * 0.45 - 20 + i * 7);
    await page.mouse.up();
    const after = await page.evaluate(() => ({ score, waveGot }));
    ok("a golden fruit counts three, toward the wave too", after.score - before.score >= 3 && after.waveGot - before.waveGot >= 3, { before, after });
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
    ok("the earned turn is spent once the round ends", await page.evaluate(() => sessionStorage.getItem("sona.play.active") === null && sessionStorage.getItem("sona.play.token") === null));
    const sfx = await page.evaluate(() => __f.sfx);
    ok("no sound ever played while the card's mic was open", sfx.length > 0 && sfx.every((c) => !c.live), sfx.filter((c) => c.live));
    ok("the game's own sounds were heard: slices, the giant's cuts and its burst",
      ["swish", "splat", "giant", "complete"].every((n) => sfx.some((c) => c.name === n)), [...new Set(sfx.map((c) => c.name))]);
    ok("a whole round: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await browser.close(); await new Promise((r) => server.close(r));
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
