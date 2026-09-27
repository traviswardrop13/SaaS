// TILES2: Piano Tiles, rebuilt as a round (27 Sep 2026), the same round
// Travis said yes to for Fruit Slice, for the piano: three songs a child knows
// (Twinkle Twinkle, Mary Had a Little Lamb, Row Row Row Your Boat), each tile
// one note of the tune; a missed tile fades and the song plays on; the first
// tiles wait at the keys; the same fall time on every screen; the say-it card
// between songs; and Ode to Joy as a finale whose tiles all wait, so every
// round ends in a win.
//
// This plays a round on a fake phone. The say-it card's own listening is
// micquietgamestest's (every arcade game shares it); here a heard child is
// the card's own success path, closeReviveMic() then doRevive().
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from "./_env.mjs";

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT, BASE = "http://127.0.0.1:8265";
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2", mp3: "audio/mpeg" };
const server = createServer((req, res) => {
  const u = new URL(req.url, BASE), f = path.join(ROOT, u.pathname);
  if (u.pathname.startsWith("/api/")) { res.writeHead(503); res.end("{}"); return; }
  if (!existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[f.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8265, "127.0.0.1", r));
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(detail))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, e.stack); } }
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");

// ── the code: a round, not a practice ──
const PAGE = readFileSync(ROOT + "/arcade-tiles.html", "utf8"), code = strip(PAGE);
ok("three songs a child knows, then Ode to Joy as the finale",
  /name:"Twinkle Twinkle", notes:"CCGGAAG FFEEDDC"/.test(code) && /name:"Mary Had a Little Lamb"/.test(code) && /name:"Row, Row, Row Your Boat"/.test(code) && /name:"Ode to Joy"[^}]*finale:true/.test(code));
ok("a tile falls in the song's own time on every screen, not in screen pixels a frame", /function speedPx\(\)\{ return \(HITY\(\)\+90\)\/\(SONGS\[song\]\.fall/.test(code) && !/fall\*\(H\/700\)/.test(code));
ok("a missed tile no longer opens the card: only a finished song asks for the sound",
  !/if\(playing\)\{ crash\(\); \}/.test(code) && /sayCard\("Say \\u201C"\+SAYTXT\+"\\u201D for song "/.test(code));
ok("nothing in the round is practice data", !/logAttempt|bumpReps|recordSession|recordRung|rotAdvance|repsBeacon/.test(code));
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
  // every Sona sound, with whether a mic was live as it started
  let sona;
  Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set: (v) => { sona = v;
    const sfx = v.sfx || {}; v.sfx = new Proxy(sfx, { get(t, k) { const real = t[k]; if (typeof real !== "function" || k === "stop") return real; return function () { f.sfx.push({ name: k, live: f.live > 0 }); return real.apply(this, arguments); }; } }); } });
  localStorage.setItem("sona.freeera.v1", "post"); ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1"].forEach((k) => localStorage.setItem(k, "done"));
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true, voiceOn: false, soundOn: true, volume: 0.6 }));
  sessionStorage.setItem("sona.play.token", "arcade-tiles.html");
}
async function open(w, h) {
  const context = await browser.newContext({ viewport: { width: w || 390, height: h || 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (r) => (r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort()));
  await context.addInitScript(fakePhone);
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/arcade-tiles.html?from=charge");
  await page.waitForFunction(() => window.gameEntryAllowed === true && typeof startSong === "function");
  return { context, page, errors };
}
const st = (page) => page.evaluate(() => ({ phase, song, songIx, score, REV, missRun, playing, card: document.getElementById("revOvl").classList.contains("show"),
  title: document.getElementById("revTitle").textContent, ended: !!window.__ended, mics: __f.mics, live: __f.live }));
// tap the lowest tile on the keys, if there is one
const tapKeys = (page) => page.evaluate(() => {
  const t = tiles.filter((q) => !q.hit && !q.gone && q.y + q.h > HITY() - 60 && q.y < HITY() + 40).sort((a, b) => b.y - a.y)[0];
  if (!t) return null;
  const r = document.getElementById("cv").getBoundingClientRect();
  document.getElementById("cv").dispatchEvent(new PointerEvent("pointerdown", { clientX: r.left + (t.lane + 0.5) * (W / 4), clientY: r.top + HITY(), bubbles: true }));
  return t.note;
});
async function playSong(page, skip = 0) {
  const heard = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 40000) {
    const s = await st(page); if (s.phase !== "song" || s.card || s.ended) break;
    if (skip > 0) { const moving = await page.evaluate(() => tiles.some((q) => !q.hit && !q.gone && !q.wait)); if (moving) { await page.waitForFunction(() => tiles.some((q) => q.gone), null, { timeout: 6000 }).catch(() => {}); skip--; } }
    const n = await tapKeys(page); if (n) heard.push(n);
    await page.waitForTimeout(40);
  }
  return heard;
}
const heardCard = (page) => page.evaluate(() => { closeReviveMic(); doRevive(); });

await scenario("a whole round", async () => {
  const { context, page, errors } = await open();
  try {
    ok("song 1 opens with its banner, and asks for no mic", /Song 1/.test(await page.locator("#bnBig").textContent()) && /Twinkle Twinkle/.test(await page.locator("#bnSmall").textContent()) && (await st(page)).mics === 0);
    await page.waitForFunction(() => tiles.length > 0 && tiles[0].wait && tiles[0].y >= HITY() - tiles[0].h + 39, null, { timeout: 8000 });
    await page.waitForTimeout(1500);
    ok("the first tile waits on its key until it is tapped", await page.evaluate(() => tiles.length === 1 && !tiles[0].hit && !tiles[0].gone && songIx === 1));
    const notes = await playSong(page);
    const tune = { 261.63: "C", 293.66: "D", 329.63: "E", 349.23: "F", 392: "G", 440: "A", 493.88: "B" };
    ok("tapping the tiles plays Twinkle Twinkle, note by note", notes.map((f) => tune[f]).join("") === "CCGGAAGFFEEDDC", notes.map((f) => tune[f]).join(""));
    await page.locator("#revOvl.show").waitFor({ timeout: 6000 });
    let s = await st(page);
    ok("the song done, the say-it card asks for the sound for song 2", /^Say “rrrr” for song 2!$/.test(s.title) && s.song === 0, s);
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 6000 });
    await heardCard(page);
    s = await st(page);
    ok("the child's sound starts song 2, and the mic is closed again", s.song === 1 && s.phase === "song" && s.playing && !s.card && s.REV === 2 && s.live === 0, s);
    // song 2: let two tiles slip by
    await playSong(page, 2);
    s = await st(page);
    ok("tiles that slip by just fade: no card until the song is done, nothing lost", s.REV === 2 && (s.card ? /for song 3!$/.test(s.title) : true), s);
    await page.locator("#revOvl.show").waitFor({ timeout: 8000 });
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 6000 });
    await heardCard(page);
    await playSong(page);
    await page.waitForFunction(() => phase === "song" && SONGS[song].finale, null, { timeout: 8000 });
    s = await st(page);
    ok("after song 3 the grand finale comes straight in, with no card", !s.card && s.mics === 2 && s.REV === 1, s);
    await page.waitForFunction(() => tiles.some((q) => q.wait && q.y >= HITY() - q.h + 39), null, { timeout: 8000 });
    await page.waitForTimeout(1200);
    ok("…and its tiles wait on the keys, so it can't be missed", await page.evaluate(() => tiles.every((q) => !q.gone) && tiles.some((q) => q.wait && !q.hit)));
    await playSong(page);
    await page.locator("#endOvl.show").waitFor({ timeout: 8000 });
    ok("the finale ends the round in a win", /Bravo! You played four songs!/.test(await page.locator("#endTitle").innerText()));
    ok("the earned turn is spent once the round ends", await page.evaluate(() => sessionStorage.getItem("sona.play.active") === null && sessionStorage.getItem("sona.play.token") === null));
    const sfx = await page.evaluate(() => __f.sfx);
    ok("no chime ever played while the card's mic was open", sfx.length > 0 && sfx.every((c) => !c.live), sfx.filter((c) => c.live));
    ok("a whole round: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// the same fall time on a small phone and on a big iPad
for (const [w, h] of [[375, 667], [1024, 1366]]) {
  await scenario("fall time " + w + "x" + h, async () => {
    const { context, page, errors } = await open(w, h);
    try {
      const secs = await page.evaluate(() => (HITY() + 90) / speedPx());
      ok("on a " + w + "x" + h + " screen a song 1 tile takes 2.5 s to reach the keys", Math.abs(secs - 2.5) < 0.01, secs);
      ok("fall time " + w + ": no runtime errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
}

await browser.close(); await new Promise((r) => server.close(r));
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
