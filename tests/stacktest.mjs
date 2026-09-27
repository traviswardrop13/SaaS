// STACK2: Block Stacker, rebuilt as a round (27 Sep 2026), the same round
// Travis said yes to for Fruit Slice ("a clear goal... It always ends in a
// win. Missing is OK... The talking moves to between waves"), for a tower:
// the five blocks the "Say it 5 times" page built are its bottom, three floors
// go on top with the say-it card between them, a miss tumbles off and a fresh
// block slides in, a close drop snaps, no block is ever a sliver, and a rocket
// on the top blasts off to the moon.
//
// This plays a round on a fake phone. The say-it card's own listening is
// micquietgamestest's (every arcade game shares it); here a heard child is
// the card's own success path, closeReviveMic() then doRevive().
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from "./_env.mjs";

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT, BASE = "http://127.0.0.1:8264";
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2", mp3: "audio/mpeg" };
const server = createServer((req, res) => {
  const u = new URL(req.url, BASE), f = path.join(ROOT, u.pathname);
  if (u.pathname.startsWith("/api/")) { res.writeHead(503); res.end("{}"); return; }
  if (!existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[f.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8264, "127.0.0.1", r));
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(detail))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, e.stack); } }
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");

// ── the code: a round, not a practice ──
const PAGE = readFileSync(ROOT + "/arcade-stack.html", "utf8"), code = strip(PAGE);
ok("three floors of 5, 6 and 7 blocks on the five the practice page built",
  /var FLOORS=\[\{goal:5,[^\]]*\{goal:6,[^\]]*\{goal:7,/.test(code) && /var BASE5=\[\["#85e099"/.test(code));
ok("a block is never narrower than 60% of the first one", /var MINW=baseW\*0\.6;/.test(code) && /if\(w<MINW\)/.test(code));
ok("a missed block no longer opens the card: only a finished floor asks for the sound",
  !/if\(overlap<=6\)\{[^}]*crash\(\)/.test(code) && /sayCard\("Say \\u201C"\+SAYTXT\+"\\u201D for floor "/.test(code));
ok("nothing in the round is practice data", !/logAttempt|bumpReps|recordSession|recordRung|rotAdvance|repsBeacon/.test(code));
ok("the page asks for the mic in one place only: the say-it card", (code.match(/getUserMedia\(/g) || []).length === 1 && /function openReviveMic\(\)/.test(code));
ok("its own sounds play only through sfx(), so they keep the quiet rules",
  /S\.sfx\.thunk=function/.test(code) && !/[^.]\bhiss\(|[^.]\bthud\(/.test(code.replace(/S\.sfx\.\w+=function\(\)\{[^\n]*\};/g, "").replace(/function (hiss|thud)\(/g, "")));

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
  // every Sona sound, with whether a mic was live as it started
  let sona;
  Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set: (v) => { sona = v;
    const sfx = v.sfx || {}; v.sfx = new Proxy(sfx, { get(t, k) { const real = t[k]; if (typeof real !== "function" || k === "stop") return real; return function () { f.sfx.push({ name: k, live: f.live > 0 }); return real.apply(this, arguments); }; } }); } });
  localStorage.setItem("sona.freeera.v1", "post"); ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1"].forEach((k) => localStorage.setItem(k, "done"));
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true, voiceOn: false, soundOn: true, volume: 0.6 }));
  sessionStorage.setItem("sona.play.token", "arcade-stack.html");
}
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (r) => (r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort()));
  await context.addInitScript(fakePhone);
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/arcade-stack.html?from=charge");
  await page.waitForFunction(() => window.gameEntryAllowed === true && typeof startFloor === "function");
  return { context, page, errors };
}
const st = (page) => page.evaluate(() => ({ phase, floor, floorGot, score, REV, missRun, playing, card: document.getElementById("revOvl").classList.contains("show"),
  title: document.getElementById("revTitle").textContent, ended: !!window.__ended, mics: __f.mics, live: __f.live, n: stack.length, falling: falling.length }));
async function dropWhere(page, kind) {
  return page.evaluate((kind) => new Promise((done) => { const t0 = performance.now(); (function wait() {
    if (!cur || phase !== "floor" || !playing) return done(false);
    const top = stack[stack.length - 1], dx = cur.x - top.x;
    // A block as wide as the tower can't slide clear of it on a phone, so a
    // miss and a sloppy drop are placed; a close drop is waited for.
    if (kind === "miss") { cur.x = top.x - cur.w - 20; drop(); return done(true); }
    if (kind === "sloppy") { cur.x = top.x + top.w * 0.42; drop(); return done(true); }
    const hit = Math.abs(dx) < 3;
    if (hit) { drop(); return done(true); }
    if (performance.now() - t0 > 12000) return done(false);
    requestAnimationFrame(wait); })(); }), kind);
}
const heard = (page) => page.evaluate(() => { closeReviveMic(); doRevive(); });

await scenario("a whole round", async () => {
  const { context, page, errors } = await open();
  try {
    let s = await st(page);
    ok("floor 1 opens with its banner, on the five blocks the practice page built, and asks for no mic",
      /Floor 1/.test(await page.locator("#bnBig").textContent()) && s.n === 5 && s.mics === 0 &&
      JSON.stringify(await page.evaluate(() => stack.map((b) => b.c))) === JSON.stringify(["#85e099", "#ffe066", "#ffb86b", "#ff8787", "#b197fc"]), s);
    // a miss: it tumbles off, nothing stops, the next is slower
    const speedBefore = await page.evaluate(() => speed);
    ok("a missed drop happens", await dropWhere(page, "miss"));
    s = await st(page);
    ok("a missed block tumbles off: no card, nothing lost, the tower is as it was", !s.card && s.playing && s.REV === 3 && s.n === 5 && s.falling >= 1 && s.missRun === 1 && s.mics === 0, s);
    ok("…and the next block comes slower", (await page.evaluate(() => speed)) < speedBefore);
    // a sloppy drop is cut, but never to a sliver
    ok("a sloppy drop happens", await dropWhere(page, "sloppy"));
    const w = await page.evaluate(() => ({ w: stack[stack.length - 1].w, min: MINW, top: stack[stack.length - 2] }));
    ok("a sloppy drop is cut, but never narrower than the comfy minimum, and stays over the block below",
      Math.abs(w.w - w.min) < 1 && (await page.evaluate(() => { const a = stack[stack.length - 1], b = stack[stack.length - 2]; return a.x >= b.x - 0.5 && a.x + a.w <= b.x + b.w + 0.5; })), w);
    // a close drop snaps
    const before = await page.evaluate(() => stack[stack.length - 1].w);
    ok("a close drop happens", await dropWhere(page, "snap"));
    const snapped = await page.evaluate(() => { const a = stack[stack.length - 1], b = stack[stack.length - 2]; return a.x === b.x && a.w === b.w; });
    ok("…and snaps into place, nothing cut", snapped && (await page.evaluate(() => stack[stack.length - 1].w)) === before);
    // finish floor 1
    while ((await st(page)).phase === "floor") await dropWhere(page, "snap");
    await page.locator("#revOvl.show").waitFor({ timeout: 6000 });
    s = await st(page);
    ok("five blocks finish floor 1, then the say-it card asks for the sound for floor 2", /^Say “rrrr” for floor 2!$/.test(s.title) && s.floor === 0, s);
    ok("…with floor 1 ticked on the card", (await page.locator("#revHearts .wdot.on").count()) === 1);
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 6000 });
    await heard(page);
    s = await st(page);
    ok("the child's sound starts floor 2, and the mic is closed again", s.floor === 1 && s.phase === "floor" && s.playing && !s.card && s.REV === 2 && s.live === 0, s);
    // a golden block brings the tower back to full width
    await page.evaluate(() => { cur.gold = true; cur.c = "#ffd21c"; });
    ok("a golden block is dropped", await dropWhere(page, "snap"));
    ok("…and makes the tower full width again", await page.evaluate(() => Math.abs(stack[stack.length - 1].w - baseW) < 0.5));
    while ((await st(page)).phase === "floor") await dropWhere(page, "snap");
    await page.locator("#revOvl.show").waitFor({ timeout: 6000 });
    ok("floor 2 ends on the card for floor 3", /for floor 3!$/.test((await st(page)).title));
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 6000 });
    await heard(page);
    while ((await st(page)).phase === "floor") await dropWhere(page, "snap");
    await page.waitForFunction(() => phase === "finale" && rocket, null, { timeout: 8000 });
    s = await st(page);
    ok("after floor 3 the rocket comes straight in, with no card", !s.card && s.mics === 2 && s.REV === 1 && s.score === 18 + 0, s);
    await page.mouse.click(200, 420);
    ok("a tap launches it", await page.evaluate(() => rocket && rocket.launched));
    await page.waitForFunction(() => finaleDone === true, null, { timeout: 8000 });
    await page.locator("#endOvl.show").waitFor({ timeout: 5000 });
    ok("…it reaches the moon, and the end card says so", /Blast off! You built 18 blocks to the moon!/.test(await page.locator("#endTitle").innerText()));
    ok("the earned turn is spent once the round ends", await page.evaluate(() => sessionStorage.getItem("sona.play.active") === null && sessionStorage.getItem("sona.play.token") === null));
    const sfx = await page.evaluate(() => __f.sfx);
    ok("no sound ever played while the card's mic was open", sfx.length > 0 && sfx.every((c) => !c.live), sfx.filter((c) => c.live));
    ok("the tower's own sounds were heard: landings, a miss and the blast-off",
      ["thunk", "drop", "blast", "correct"].every((n) => sfx.some((c) => c.name === n)), [...new Set(sfx.map((c) => c.name))]);
    ok("a whole round: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await scenario("nobody taps the rocket", async () => {
  const { context, page, errors } = await open();
  try {
    await page.evaluate(() => { startFinale(); rocket.at = performance.now() + 300; });
    await page.waitForFunction(() => finaleDone === true, null, { timeout: 9000 });
    ok("the rocket goes by itself, so the round still ends on a win", await page.evaluate(() => finaleDone));
    ok("nobody taps: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await browser.close(); await new Promise((r) => server.close(r));
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
