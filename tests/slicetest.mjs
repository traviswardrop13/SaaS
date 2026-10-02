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
//
// WHAT THE CARD ASKS (Travis, 1 Oct 2026: "add back the increase of
// complexity to the sounds in the games and start with isolation then ree rah
// roh then rot"). It always said the bare sound. For a child on R it now asks
// one syllable a card (and a short word once that is earned or picked),
// through Sona.gameAsk; gameasktest holds that reader to its rules. Here the
// real card is played: it shows and says the syllable, Echo's power button
// stays the bare sound, a voice that cannot play and a card nobody answers
// both put the card back on "rrrr" and its recording, a syllable is never on
// screen before Echo's line for it is in hand, the card after a step back
// does not climb, and a heard card is still one game rep and nothing else.
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from "./_env.mjs";

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT, BASE = "http://127.0.0.1:8263";
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2", mp3: "audio/mpeg" };
const tts = { up: false, said: [], delay: 0 };
const server = createServer((req, res) => {
  const u = new URL(req.url, BASE), f = path.join(ROOT, u.pathname);
  // Echo's voice: down unless a scenario turns it on (tts.up), and every line asked for is kept
  if (u.pathname === "/api/tts") {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      try { tts.said.push(JSON.parse(body).text); } catch (e) {}
      if (!tts.up) { res.writeHead(503); res.end("{}"); return; }
      // a slow connection: the line arrives tts.delay ms late (a hung-up request is just dropped)
      setTimeout(() => { try { res.writeHead(200, { "content-type": "application/octet-stream" }); res.end(Buffer.alloc(4800)); } catch (e) {} }, tts.delay);
    }); return;
  }
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
  !/if\(playing\)\{ crash\(\); \}/.test(code) && /else sayCard\("for wave "\+\(wave\+2\)\+"!","none",wave\+1\);/.test(code));
ok("what the card asks comes from the one reader, Sona.gameAsk, for the card it is (1 after wave 1, 2 after wave 2)",
  /a=S\.gameAsk\(SND,n\)/.test(code) && /function cardWant\(n\)\{ return n&&askHeld\?askHeld:cardAsk\(n\); \}/.test(code) && /var want=cardWant\(card\|\|0\)/.test(code) && /<script src="\/gamecontent\.js"><\/script>/.test(PAGE));
ok("a syllable or word is painted only with Echo's line in hand: the card opens on it only if the bytes are there, else on the bare sound",
  /ASK=line&&line\.bytes\?want:cardAsk\(0\); askNext=want\.say&&ASK!==want\?want:null;/.test(code) && /if\(bytes\)\{ASK=askNext;paintAsk\(\);\}else\{askLineDrop\(\);lead=false;\}/.test(code) && /if\(!last\) askReady\(wave\+1\);/.test(code));
ok("Echo's power button still asks the bare sound: SAYTXT is soundSay, and the helper is untouched by the card's ask",
  /SAYTXT=\(S&&S\.soundSay\)\?S\.soundSay\(SND\):"rrrr"/.test(code) && !/ASK/.test(readFileSync(ROOT + "/arcade-speech-help.js", "utf8")));
ok("a heard card is one game rep and nothing else: nothing on the page says \"correct\"",
  /function doRevive\(\)\{[\s\S]{0,260}S\.gameRep\(SND\)/.test(code) && (code.match(/gameRep\(/g) || []).length === 1 && !/correct/i.test(code));
ok("nothing in the round is practice data", !/logAttempt|bumpReps|recordSession|recordRung|rotAdvance|repsBeacon/.test(code));
ok("the page asks for the mic in one place only: the say-it card", (code.match(/getUserMedia\(/g) || []).length === 1 && /function openReviveMic\(\)/.test(code));
ok("its own sounds play only through sfx(), so they keep the quiet rules",
  /S\.sfx\.swish=function/.test(code) && !/[^.]\bhiss\(|[^.]\bthud\(/.test(code.replace(/S\.sfx\.\w+=function\(\)\{[^\n]*\};/g, "").replace(/function (hiss|thud)\(/g, "")));
const CHARGE = readFileSync(ROOT + "/charge.html", "utf8");
ok("the \"Say it 5 times\" stand drops each fruit onto the counter, and stills it for reduced motion",
  /#stand \.well \.fr\.pop\{animation:fruitDrop/.test(CHARGE) && /@keyframes fruitDrop/.test(CHARGE) && /#reveals \.pop,#stand \.well \.fr\.pop\{animation:none;\}/.test(CHARGE));

// ── a fake phone: a mic that hears silence, audio that records what plays ──
function fakePhone(cfg) {
  cfg = cfg || {};
  const f = window.__f = { mics: 0, live: 0, sfx: [], media: [] };
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
  window.Audio = function (src) { const a = { src, volume: 1, paused: false, play() { f.media.push({ src: /^blob:/.test(src) ? "voice" : String(src), live: f.live > 0, at: Math.round(performance.now()) }); setTimeout(() => { if (a.onended) a.onended(); }, 20); return Promise.resolve(); }, pause() { a.paused = true; }, removeAttribute() {}, load() {} }; return a; };
  // every Sona sound, with whether a mic was live as it started
  let sona;
  Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set: (v) => { sona = v;
    const sfx = v.sfx || {}; v.sfx = new Proxy(sfx, { get(t, k) { const real = t[k]; if (typeof real !== "function" || k === "stop") return real; return function () { f.sfx.push({ name: k, live: f.live > 0 }); return real.apply(this, arguments); }; } }); } });
  localStorage.setItem("sona.freeera.v1", "post"); ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
  // every title the card shows, with how many sounds had played by then
  f.titles = [];
  addEventListener("DOMContentLoaded", () => { const h = document.getElementById("revTitle"); new MutationObserver(() => f.titles.push({ t: h.textContent, media: f.media.length, at: Math.round(performance.now()) })).observe(h, { childList: true, subtree: true, characterData: true }); });
  // Echo's voice is ON in every scenario but the muted one (a saved
  // voiceOn:false with sound on is healed by getProfile, so only volume 0
  // mutes). What differs is his voice SERVICE: down unless a scenario turns
  // it on (tts.up), so the round scenario below plays with lines that fail.
  localStorage.setItem("sona.profile.v1", JSON.stringify(Object.assign({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true, voiceOn: true, soundOn: true, volume: 0.6 }, cfg.profile || {})));
  sessionStorage.setItem("sona.play.token", "arcade-slice.html");
  // what the "Say it 5 times" page hands over after the first game of a day
  sessionStorage.setItem("sona.boost.sound", ((cfg.profile || {}).focusSounds || ["R"])[0]); sessionStorage.setItem("sona.boost.level", "isolation"); sessionStorage.setItem("sona.boost.ask", "rrrr");
}
async function open(cfg) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", hasTouch: false });
  await context.route("**/*", (r) => (r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort()));
  await context.addInitScript(fakePhone, cfg || {});
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
    ok("…then the say-it card asks for wave 2: with Echo's voice service down, the bare sound (nobody would say a syllable)", /^Say “rrrr” for wave 2!$/.test(s.title) && s.wave === 0 && !s.playing, s);
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

// ── what the card asks: the sound, then one syllable, then a short word ──
const waveOver = (page) => page.evaluate(() => { waveGot = WAVES[wave].goal; });
const cardNow = (page) => page.evaluate(() => ({ title: document.getElementById("revTitle").textContent, orange: [...document.querySelectorAll("#revTitle .snd")].map((b) => b.textContent),
  note: document.getElementById("revListen").textContent, rung: ASK && ASK.rung, text: ASK && ASK.text, pill: document.getElementById("slowSound").textContent, rev: REV, live: __f.live, media: __f.media.slice() }));
const records = (page) => page.evaluate(() => JSON.stringify([Sona.getProgress().stage, Sona.outcomes(), localStorage.getItem("sona.attempts.v1"), Sona.repsToday()]));
const listening = (page) => page.waitForFunction(() => /listening/i.test(document.getElementById("revListen").textContent) && __f.live === 1, null, { timeout: 12000 });

await scenario("the cards climb", async () => {
  tts.up = true; tts.said = [];
  const { context, page, errors } = await open();
  try {
    // which syllable depends on the calendar day, so the page's own reader says what to expect
    const want = await page.evaluate(() => [1, 2].map((c) => Sona.gameAsk("R", c)));
    ok("a fresh child on R, first game of the day: the reader gives two different syllables for the two cards",
      want.every((a) => a.rung === 1 && /^r(ee|ah|oh)$/.test(a.text)) && want[0].text !== want[1].text, want);
    const before = await records(page), week0 = await page.evaluate(() => Sona.weekReps(0));
    await waveOver(page); await page.locator("#revOvl.show").waitFor({ timeout: 12000 }); await listening(page);
    let c = await cardNow(page);
    ok("the card after wave 1 asks for that one syllable, not the bare sound", c.title === "Say “" + want[0].text + "” for wave 2!" && c.rung === 1, c);
    ok("…with only the sound's letter in orange", c.orange.join() === "r", c.orange);
    ok("…said by Echo in ONE line that ends on the syllable, and no recording", tts.said.join("|") === "To keep playing, say... " + want[0].text + "." && c.media.length === 1 && c.media[0].src === "voice", { said: tts.said, media: c.media });
    ok("…and the mic opened only after his line, never under it", c.media.every((m) => !m.live) && c.live === 1, c.media);
    ok("Echo's power button still shows the bare sound while the card asks a syllable", c.pill === "rrrr" && (await page.evaluate(() => SAYTXT)) === "rrrr", c.pill);
    await heard(page);
    await page.waitForFunction(() => phase === "wave" && wave === 1);
    ok("a heard syllable card is exactly one rep on the week's count", (await page.evaluate(() => Sona.weekReps(0))) === week0 + 1 && (await page.evaluate(() => { const g = JSON.parse(localStorage.getItem("sona.gamereps.v1") || "{}"); return Object.keys(g).map((d) => g[d].R).join(); })) === "1");
    ok("…and it moves no earned level and writes no practice record", (await records(page)) === before);
    await waveOver(page); await page.locator("#revOvl.show").waitFor({ timeout: 12000 }); await listening(page);
    c = await cardNow(page);
    ok("the card after wave 2 asks the next syllable", c.title === "Say “" + want[1].text + "” for wave 3!" && c.orange.join() === "r" && tts.said[1] === "To keep playing, say... " + want[1].text + ".", { c, said: tts.said });
    ok("the cards climb: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); tts.up = false; }
});

await scenario("the short word", async () => {
  tts.up = true; tts.said = [];
  // "…then a short word", picked by a grown-up in Settings
  const { context, page, errors } = await open({ profile: { gameLevel: "word" } });
  try {
    await waveOver(page); await page.locator("#revOvl.show").waitFor({ timeout: 12000 }); await listening(page);
    const first = await cardNow(page);
    await heard(page); await page.waitForFunction(() => phase === "wave" && wave === 1);
    await waveOver(page); await page.locator("#revOvl.show").waitFor({ timeout: 12000 }); await listening(page);
    const c = await cardNow(page);
    ok("with the short word picked: a syllable after wave 1, then “rot” after wave 2, only its r orange",
      first.rung === 1 && c.title === "Say “rot” for wave 3!" && c.rung === 2 && c.orange.join() === "r" && tts.said[1] === "To keep playing, say... rot.", { first, c, said: tts.said });
    ok("the short word: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); tts.up = false; }
});

await scenario("a voice that cannot play", async () => {
  tts.up = false; tts.said = [];
  const { context, page, errors } = await open();
  try {
    await waveOver(page); await page.locator("#revOvl.show").waitFor({ timeout: 12000 }); await listening(page);
    const c = await cardNow(page);
    ok("Echo's line would not load: the card asks the bare sound instead, all of it orange", c.title === "Say “rrrr” for wave 2!" && c.rung === 0 && c.orange.join() === "rrrr", c);
    ok("…and plays its recording at once, with no second line to wait for", tts.said.length === 1 && /^To keep playing, say\.\.\. r/.test(tts.said[0]) && c.media.length === 1 && c.media[0].src === "/coach/say-echo/R-sound.wav" && !c.media[0].live, { said: tts.said, media: c.media });
    ok("a voice that cannot play: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await scenario("a card nobody answers", async () => {
  tts.up = true; tts.said = [];
  // "…then a short word" is picked, so the card after wave 2 WOULD ask "rot"
  const { context, page, errors } = await open({ profile: { gameLevel: "word" } });
  try {
    ok("with the short word picked, the reader's card after wave 2 is the word", (await page.evaluate(() => Sona.gameAsk("R", 2).text)) === "rot");
    ok("a syllable or word card waits about eight seconds before it steps back", (await page.evaluate(() => ASK_WAIT_MS)) === 8000);
    await page.evaluate(() => { ASK_WAIT_MS = 1200; });
    await waveOver(page); await page.locator("#revOvl.show").waitFor({ timeout: 12000 }); await listening(page);
    const asked = await cardNow(page), mics = await page.evaluate(() => __f.mics);
    await page.waitForFunction(() => ASK.rung === 0, null, { timeout: 6000 });
    const at = await cardNow(page);
    ok("nobody answers the syllable: the mic closes and the card steps back to the bare sound", asked.rung === 1 && at.title === "Say “rrrr” for wave 2!" && at.orange.join() === "rrrr" && at.live === 0, { asked, at });
    await listening(page);
    const c = await cardNow(page);
    ok("…offered as Echo's own idea, then Rachel's recording, then it listens again",
      tts.said.join("|") === "To keep playing, say... " + asked.text + ".|I have an idea. Let's try this one." && c.media.map((m) => m.src).join() === "voice,voice,/coach/say-echo/R-sound.wav" && c.media.every((m) => !m.live) && (await page.evaluate(() => __f.mics)) === mics + 1, { said: tts.said, media: c.media });
    await page.waitForTimeout(1800);
    const still = await cardNow(page);
    ok("silence passes nothing: the card is still up on the bare sound, no wave started, no rep counted, and it steps back no further",
      still.title === at.title && still.rev === 3 && still.live === 1 && (await page.evaluate(() => wave === 0 && !playing && Sona.weekReps(0) === 0)) && tts.said.length === 2, still);
    // The card after a step back does not climb. A child who could not
    // answer a syllable is not asked the short word a minute later: the same
    // syllable again, from the line the page already holds. (Repeat it, or
    // go lower, is Rachel's call.)
    await heard(page); await page.waitForFunction(() => phase === "wave" && wave === 1);
    const before2 = await page.evaluate(() => __f.media.length);
    await waveOver(page); await page.locator("#revOvl.show").waitFor({ timeout: 12000 }); await listening(page);
    const second = await cardNow(page);
    ok("after a step back the next card asks that same syllable again, never the short word",
      second.title === "Say “" + asked.text + "” for wave 3!" && second.rung === 1 && second.text === asked.text && second.orange.join() === "r", { asked: asked.text, second });
    ok("…said by Echo again, with no second download of the line", tts.said.length === 2 && second.media.slice(before2).map((m) => m.src).join() === "voice" && second.media.slice(before2).every((m) => !m.live), { said: tts.said, media: second.media.slice(before2) });
    // "I'm done playing" on a syllable card cancels the wait with the mic
    await page.locator("#revDone").click(); await page.waitForTimeout(1700);
    ok("\"I'm done playing\" on a syllable card closes the mic and cancels the step back: nothing more is said or asked",
      second.rung === 1 && (await page.evaluate(() => __f.live === 0 && ASK.rung === 1 && !!window.__ended)) && tts.said.length === 2, { second, said: tts.said });
    ok("a card nobody answers: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); tts.up = false; }
});

// ── Sona muted: the card asks the bare sound and says nothing ──
// volume 0 is the only mute there is (getProfile heals an old voiceOn:false
// while sound is on). Only Echo's voice can model a syllable, so the reader
// answers the bare sound and the card never asks his voice service for a line.
await scenario("Sona muted", async () => {
  tts.up = true; tts.said = [];
  const { context, page, errors } = await open({ profile: { volume: 0, gameLevel: "word" } });
  try {
    ok("the muted profile reads as muted, and the reader holds its cards to the sound", await page.evaluate(() => Sona.getProfile().volume === 0 && Sona.gameHold("R") === "muted" && Sona.gameTop("R") === 0));
    for (const n of [2, 3]) {
      await waveOver(page); await page.locator("#revOvl.show").waitFor({ timeout: 12000 });
      await page.waitForFunction(() => __f.live === 1, null, { timeout: 12000 });
      const c = await cardNow(page);
      ok("muted, the card for wave " + n + " asks the bare sound, all of it orange, whatever Settings says", c.title === "Say “rrrr” for wave " + n + "!" && c.rung === 0 && c.orange.join() === "rrrr", c);
      ok("…with no line asked of Echo's voice and nothing played, and the mic open", tts.said.length === 0 && c.media.length === 0 && c.live === 1, { said: tts.said, media: c.media });
      await heard(page); await page.waitForFunction((k) => phase === "wave" && wave === k, n - 1);
    }
    const titles = await page.evaluate(() => __f.titles.map((x) => x.t));
    ok("…and no syllable or word was ever on the card", titles.length > 0 && titles.every((t) => /^Say “rrrr” /.test(t)), titles);
    ok("Sona muted: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); tts.up = false; }
});

// ── a slow connection: the syllable is never on screen before Echo's line ──
// The card used to paint "ree" first and download second: it sat under
// "Listen to Echo…" with nothing said for up to seven seconds, then flipped
// to "rrrr". A reader may already have said "ree" to a closed mic. The line
// now starts downloading as the wave ends, and the syllable is painted only
// once it is in hand, just before it plays.
await scenario("a slow line", async () => {
  tts.up = true; tts.said = []; tts.delay = 4200;   // lands about 1.6 s after the card opens
  let { context, page, errors } = await open();
  try {
    ok("the card waits about three seconds for a line that is still on its way", (await page.evaluate(() => ASK_LINE_MS)) === 3000);
    const want = await page.evaluate(() => Sona.gameAsk("R", 1).text);
    await waveOver(page); await page.locator("#revOvl.show").waitFor({ timeout: 12000 });
    const early = await cardNow(page);
    ok("the line is already being fetched when the card opens (it started with the wave's cheer)", tts.said.join("|") === "To keep playing, say... " + want + ".", tts.said);
    ok("while Echo's line is still on its way the card shows the bare sound, never the syllable", early.title === "Say “rrrr” for wave 2!" && early.rung === 0 && /Listen to Echo/.test(early.note) && early.media.length === 0 && early.live === 0, early);
    await listening(page);
    const c = await cardNow(page), titles = await page.evaluate(() => __f.titles);
    const first = titles.find((x) => x.t.indexOf("“" + want + "”") >= 0), voiceAt = await page.evaluate(() => __f.media[0] && __f.media[0].at);
    ok("once the line is in hand the syllable is painted and said straight after", c.title === "Say “" + want + "” for wave 2!" && c.rung === 1 && c.media.map((m) => m.src).join() === "voice" && !!first && voiceAt - first.at >= 0 && voiceAt - first.at < 400, { c, first, voiceAt });
    ok("…one download, and no recording", tts.said.length === 1 && c.media.length === 1, { said: tts.said, media: c.media });
    ok("a slow line: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
  // …and a line that never comes in time: the bare sound stays, its recording plays, the syllable is never shown
  tts.said = []; tts.delay = 60000;
  ({ context, page, errors } = await open());
  try {
    await page.evaluate(() => { ASK_LINE_MS = 900; });
    await waveOver(page); await page.locator("#revOvl.show").waitFor({ timeout: 12000 }); await listening(page);
    const c = await cardNow(page), titles = await page.evaluate(() => __f.titles.map((x) => x.t));
    ok("a line that does not come in time: the card stays on the bare sound and plays its recording, with no second line",
      c.title === "Say “rrrr” for wave 2!" && c.rung === 0 && c.orange.join() === "rrrr" && tts.said.length === 1 && c.media.map((m) => m.src).join() === "/coach/say-echo/R-sound.wav" && !c.media[0].live, { c, said: tts.said });
    ok("…and the syllable was never on screen", titles.length > 0 && titles.every((t) => t === "Say “rrrr” for wave 2!"), titles);
    ok("a line that never comes: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); tts.up = false; tts.delay = 0; }
});

await scenario("a child on another sound", async () => {
  tts.up = true; tts.said = [];
  const { context, page, errors } = await open({ profile: { focusSounds: ["S"], gameLevel: "word" } });
  try {
    await waveOver(page); await page.locator("#revOvl.show").waitFor({ timeout: 12000 }); await listening(page);
    const c = await cardNow(page);
    ok("a child on S (not switched on) gets the card exactly as before: “sss”, Echo's lead-in, then her recording",
      c.title === "Say “sss” for wave 2!" && c.rung === 0 && c.orange.join() === "sss" && tts.said.join("|") === "To keep playing, say" && c.media.map((m) => m.src).join() === "voice,/coach/say-echo/S-sound.wav", { c, said: tts.said });
    await heard(page); await page.waitForFunction(() => phase === "wave" && wave === 1);
    await waveOver(page); await page.locator("#revOvl.show").waitFor({ timeout: 12000 });
    ok("…and again after wave 2, whatever Settings says", (await cardNow(page)).title === "Say “sss” for wave 3!");
    ok("a child on another sound: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); tts.up = false; }
});

await browser.close(); await new Promise((r) => server.close(r));
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
