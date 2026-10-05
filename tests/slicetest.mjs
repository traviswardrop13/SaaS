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
// BEAT YOUR BEST (Travis, 1-2 Oct 2026): the one number a child sees is FRUIT
// IN A ROW, the most fruit sliced without one hitting the ground (a golden
// fruit is one, the giant watermelon is one). The top-left number is the
// round's longest row and never goes down; "New best!" pops once, the moment
// they pass the best they came in with; the win card keeps its own win title
// and adds one line, in Piano Tiles' own forms; the top button is "Play
// again", back through the say-it-five-times page. The best is this child's
// own (Sona.gameBest, besttest), it counts the finger and never the voice,
// and the words "score" and "points" are never shown.
// Two Super Slice rules came with it, so that saying the sound helps a row
// instead of ending the wave sooner: fruit thrown during Super Slice are
// EXTRAS (they add to the row, never to the wave), and nothing dropped while
// it lasts breaks the row. The earned path itself is superslicetest's.
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
const tts = { up: false, said: [], all: [], delay: 0 };
// The say-it card's voice (/arcade-sayit.js, 2 Oct 2026) asks for its two
// lines, "To keep playing, say" and "Go!", as the page loads, whatever the
// card will ask: every request is kept in tts.all, and tts.said holds only
// the card's own asks (a syllable or word line, Echo's idea).
const HELPER_LINES = new Set(["To keep playing, say", "Go!", "Super Slice! Say", "For a heart and Super Slice, say"]);
const server = createServer((req, res) => {
  const u = new URL(req.url, BASE), f = path.join(ROOT, u.pathname);
  // Echo's voice: down unless a scenario turns it on (tts.up), and every line asked for is kept
  if (u.pathname === "/api/tts") {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      try { const text = JSON.parse(body).text; tts.all.push(text); if (!HELPER_LINES.has(text)) tts.said.push(text); } catch (e) {}
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
  /SAYTXT=\(S&&S\.soundSay\)\?S\.soundSay\(SND\):"rrrr"/.test(code) && !/(^|[^\w])ASK\b|gameAsk|cardAsk|askHeld/.test(strip(readFileSync(ROOT + "/arcade-speech-help.js", "utf8"))));
ok("a heard card is one game rep and nothing else: nothing on the page says \"correct\"",
  /function doRevive\(\)\{[\s\S]{0,260}S\.gameRep\(SND\)/.test(code) && (code.match(/gameRep\(/g) || []).length === 1 && !/correct/i.test(code));
ok("nothing in the round is practice data", !/logAttempt|bumpReps|recordSession|recordRung|rotAdvance|repsBeacon/.test(code));
ok("the page asks for the mic in one place only: the say-it card", (code.match(/getUserMedia\(/g) || []).length === 1 && /function openReviveMic\(\)/.test(code));
ok("its own sounds play only through sfx(), so they keep the quiet rules",
  /S\.sfx\.swish=function/.test(code) && !/[^.]\bhiss\(|[^.]\bthud\(/.test(code.replace(/S\.sfx\.\w+=function\(\)\{[^\n]*\};/g, "").replace(/function (hiss|thud)\(/g, "")));
ok("the best is this child's own, from the shared store, and the page asks before it uses it (an older cached sona.js has none)",
  /var CAN_BEST=!!\(S&&S\.gameBest&&S\.gameBestOffer\)/.test(code) && /if\(CAN_BEST\) startBest=S\.gameBest\("slice"\)/.test(code) && /if\(!CAN_BEST\|\|rowBest<=keptRow\) return;[\s\S]{0,80}S\.gameBestOffer\("slice",rowBest\)/.test(code));
ok("the old best, one hidden number for every child on the phone, is no longer read or written", !/sona\.best\.slice|BESTK|localStorage/.test(code));
ok("the row counts the finger only: a sliced fruit and the giant's burst add to it, the say-it card and Echo's sound power never do",
  (code.match(/rowN\+\+/g) || []).length === 2 && /f\.sliced=true; hit\+\+; rowN\+\+;/.test(code) && /giant=null; sfx\("giant"\); echoHop\(\);\s*rowN\+\+; rowUp\(true\);/.test(code) && (code.match(/\browUp\(/g) || []).length === 3
  && !/function doRevive\(\)\{[^}]*(rowN|rowBest)/.test(code) && !/SLOW_HELP\.onEarn=function\(\)\{[^}]*(rowN|rowBest)/.test(code));
ok("Super Slice's fruit are extras: marked as thrown, never counted toward the wave, and nothing dropped while it lasts breaks the row or feeds the two-miss help",
  /extra:slowMs>0,/.test(code) && /if\(phase==="wave"&&!f\.extra\) waveGot\+=worth;/.test(code) && /if\(playing&&phase==="wave"&&!f\.extra&&!\(slowMs>0\)&&!slowTurn\)\{ missRun\+\+; rowN=0; loseHeart\(now\); \}/.test(code));
ok("a wave's time limit reads real seconds of play, not the clock Super Slice slows", /wavePlay\+=dt;/.test(code) && /wavePlay>=WAVE_CAP_MS/.test(code) && !/waveMs>=WAVE_CAP_MS/.test(code) && /wavePlay=0;/.test(code));
{ // every string the page can put on screen: the markup's text and the script's literals (ids such as "score" are one bare word)
  const words = [...PAGE.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").matchAll(/>([^<>]+)</g)].map((m) => m[1].trim())
    .concat([...code.matchAll(/"([^"\n]*)"/g)].map((m) => m[1]).filter((t) => /\s/.test(t)));
  const bad = words.filter((t) => /\bpoints?\b|\bscores?\b|you missed|\blost\b|COMBO|\+3/i.test(t));
  ok("no words on the page say \u201Cscore\u201D or \u201Cpoints\u201D, or that a best was missed", words.length > 30 && bad.length === 0, bad);
}
ok("the top button is Play again, back through this game's practice page; the game-to-game Next is gone",
  /<button class="btn blue" id="endCharge">Play again<\/button>/.test(PAGE) && /\$\("endCharge"\)\.onclick=backToCharge;/.test(code) && !/WOOHOO|Next \u2192|arcade-tiles/.test(code));
ok("the first game after setup still asks where to go, once, so its mark is spent", /if\(S&&S\.firstGameEnd\) S\.firstGameEnd\("slice"\);/.test(code));
const CHARGE = readFileSync(ROOT + "/charge.html", "utf8");
ok("the \"Say it 5 times\" stand drops each fruit onto the counter, and stills it for reduced motion",
  /#stand \.well \.fr\.pop\{animation:fruitDrop/.test(CHARGE) && /@keyframes fruitDrop/.test(CHARGE) && /#reveals \.pop,#stand \.well \.fr\.pop\{animation:none;\}/.test(CHARGE));

// ── a fake phone: a mic that hears silence, audio that records what plays ──
function fakePhone(cfg) {
  // Echo's mid-round ask for the sound power (3 Oct 2026) is
  // arcadespeechhelptest's: held here, so a round is just the round.
  document.addEventListener("DOMContentLoaded", () => { if (window.SLOW_ASK) { SLOW_ASK.first = SLOW_ASK.every = SLOW_ASK.quiet = SLOW_ASK.soon = 1e12; window.slowAskAt = 1e12; } });
  cfg = cfg || {};
  // media: Echo's lines and Rachel's recordings. chimes: a Sona chime the app
  // plays as a media element (2 Oct 2026), kept apart so the card's counts
  // stay its voice lines.
  const f = window.__f = { mics: 0, live: 0, sfx: [], media: [], chimes: [], chiming: false };
  // cfg.native: inside the iPhone app, where Echo's lines play as media
  // elements (Sona.mediaPCM) and Rachel's take as one too, so every sound
  // the card makes is logged below. The website's Web Audio path is
  // sayitcardtest's.
  if (cfg.native) window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", Plugins: {} };
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
  window.Audio = function (src) { const a = { src, volume: 1, paused: false, play() { (f.chiming ? f.chimes : f.media).push({ src: /^blob:/.test(src) ? "voice" : String(src), live: f.live > 0, at: Math.round(performance.now()) }); setTimeout(() => { if (a.onended) a.onended(); }, 20); return Promise.resolve(); }, pause() { a.paused = true; }, removeAttribute() {}, load() {} }; return a; };
  // every Sona sound, with whether a mic was live as it started
  let sona;
  Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set: (v) => { sona = v;
    // a phone still holding last week's sona.js: no store for bests at all
    if (cfg.noStore) { delete v.gameBest; delete v.gameBestOffer; }
    const sfx = v.sfx || {}; v.sfx = new Proxy(sfx, { get(t, k) { const real = t[k]; if (typeof real !== "function" || k === "stop") return real; return function () { f.sfx.push({ name: k, live: f.live > 0 }); f.chiming = true; try { return real.apply(this, arguments); } finally { f.chiming = false; } }; } }); } });
  // every title the card shows, with how many sounds had played by then
  f.titles = [];
  addEventListener("DOMContentLoaded", () => { const h = document.getElementById("revTitle"); new MutationObserver(() => f.titles.push({ t: h.textContent, media: f.media.length, at: Math.round(performance.now()) })).observe(h, { childList: true, subtree: true, characterData: true }); });
  // the phone is set up once a tab: a later page in the same tab (the game
  // opened again for a second child) must find what the first one left
  if (!sessionStorage.getItem("__seeded")) {
    sessionStorage.setItem("__seeded", "1");
    localStorage.setItem("sona.freeera.v1", "post"); ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
    // Echo's voice is ON in every scenario but the muted one (a saved
    // voiceOn:false with sound on is healed by getProfile, so only volume 0
    // mutes). What differs is his voice SERVICE: down unless a scenario turns
    // it on (tts.up), so the round scenario below plays with lines that fail.
    localStorage.setItem("sona.profile.v1", JSON.stringify(Object.assign({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true, voiceOn: true, soundOn: true, volume: 0.6 }, cfg.profile || {})));
    if (cfg.best) localStorage.setItem("sona.bests.v1", JSON.stringify({ slice: { n: cfg.best, at: "2026-10-01" } }));
    if (cfg.old) localStorage.setItem("sona.best.slice", cfg.old);
  }
  sessionStorage.setItem("sona.play.token", "arcade-slice.html");
  // what the "Say it 5 times" page hands over after the first game of a day
  sessionStorage.setItem("sona.boost.sound", ((cfg.profile || {}).focusSounds || ["R"])[0]); sessionStorage.setItem("sona.boost.level", "isolation"); sessionStorage.setItem("sona.boost.ask", "rrrr");
}
async function ready(page) {
  await page.waitForFunction(() => window.gameEntryAllowed === true && typeof startWave === "function");
  // every number the top-left pill ever shows, and every "New best!" the banner says
  await page.evaluate(() => {
    window.__pill = []; window.__newBest = [];
    new MutationObserver(() => __pill.push(Number(document.getElementById("score").textContent))).observe(document.getElementById("score"), { childList: true, characterData: true, subtree: true });
    // (the page's banner() lives in a block, so it can't be wrapped from here: its words are watched instead)
    new MutationObserver(() => { const big = document.getElementById("bnBig").textContent, small = document.getElementById("bnSmall").textContent; if (/best/i.test(big + " " + small)) __newBest.push([big, small]); }).observe(document.getElementById("bnBig"), { childList: true, characterData: true, subtree: true });
  });
}
async function open(cfg = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", hasTouch: false });
  await context.route("**/*", (r) => (r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort()));
  await context.addInitScript(fakePhone, cfg);
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/arcade-slice.html?from=charge" + (cfg.daily ? "&daily=1" : ""));
  await ready(page);
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
// ── a board the test owns: nothing thrown until it says so ──
const quiet = (page) => page.evaluate(() => { fruits = []; nextToss = waveMs + 1e9; });
// n fruit hung still in the middle of the sky, and one swipe through them all
// (g is tiny, not 0: the page reads a missing g as its own gravity)
async function sliceNew(page, props = {}, n = 1) {
  const d = await page.evaluate(([props, n]) => { for (let i = 0; i < n; i++) fruits.push(Object.assign({ e: "🍎", x: W / 2, y: H * 0.45, g: 1e-9, vx: 0, vy: 0, r: 40, rot: 0, vr: 0, sliced: false }, props)); return { W, H }; }, [props, n]);
  await page.mouse.move(d.W / 2 - 90, d.H * 0.45 - 20); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(d.W / 2 - 90 + i * 30, d.H * 0.45 - 20 + i * 7);
  await page.mouse.up();
  await page.waitForFunction(() => fruits.length === 0);
}
// a fruit nobody sliced, already under the screen: it hits the ground on the next frame
async function dropOne(page, props = {}) {
  await page.evaluate((props) => { fruits.push(Object.assign({ e: "🍊", x: W * 0.6, y: H + 200, g: 1e-9, vx: 0, vy: 5, r: 38, rot: 0, vr: 0, sliced: false }, props)); }, props);
  await page.waitForFunction(() => fruits.length === 0);
}
// what the child sees: the row they are on, the top-left number, the banner, the win card, and what the phone keeps
const best = (page) => page.evaluate(() => {
  const $ = (id) => document.getElementById(id), vis = (e) => !!e && getComputedStyle(e).display !== "none";
  return { on: rowN, row: rowBest, pill: $("score").textContent, label: $("rowPill").getAttribute("aria-label"), pills: __pill.slice(), said: __newBest.slice(), flash: $("combo").textContent,
    waveGot, score, missRun, phase,
    stored: Sona.gameBest ? Sona.gameBest("slice") : null, old: localStorage.getItem("sona.best.slice"),
    title: $("endTitle").textContent.trim(), sub: vis($("endSub")) ? $("endSub").textContent.trim() : null, shown: $("endOvl").classList.contains("show"),
    top: vis($("endCharge")) ? $("endCharge").textContent.trim() : null, again: vis($("endAgain")) ? $("endAgain").textContent.trim() : null, home: vis($("endHome")) ? $("endHome").textContent.trim() : null,
    order: vis($("endCharge")) && vis($("endHome")) && $("endCharge").getBoundingClientRect().bottom <= $("endHome").getBoundingClientRect().top };
});
const neverDown = (list) => list.every((n, i) => i === 0 || n >= list[i - 1]);
const rowSaid = (n) => (n === 1 ? "1 fruit" : n + " fruit in a row");
const end = async (page) => { await page.evaluate(() => endRound()); await page.locator("#endOvl.show").waitFor(); return best(page); };
// a round stopped before the giant still ends on a win
// the two win titles: neither carries a number (the row under it is the only count on the card)
const WIN = /^(You sliced the giant watermelon!|I saw the fruit fly! So fun!)$/;

// The finger can end the round; the speech target is never graded here.
await scenario("three lives and an earned heart", async () => {
  const {context,page,errors}=await open();
  try {
    const built=await page.evaluate(() => typeof loseHeart === "function" && typeof gainHeart === "function");
    ok("Fruit Slice has three real lives", built);
    if(!built) return;
    await page.evaluate(() => { fruits=[]; nextToss=1e9; WAVES[0].goal=999; });
    let out=await page.evaluate(() => { loseHeart(performance.now()); return {hearts,card:reviveWait,ended:!!window.__ended}; });
    ok("one miss costs one heart and play continues without a card",out.hearts===2&&!out.card&&!out.ended,out);
    out=await page.evaluate(() => { loseHeart(performance.now()); return hearts; });
    ok("one pile of fruit cannot take all three hearts",out===2,out);
    out=await page.evaluate(() => { heartLastAt=-1e9; slowMs=8000; loseHeart(performance.now()); slowMs=0; slowTurn={finishing:true}; loseHeart(performance.now()); slowTurn=null; return hearts; });
    ok("a speaking turn and an earned power protect the remaining lives",out===2,out);
    out=await page.evaluate(() => { gainHeart(); gainHeart(); return hearts; });
    ok("a heard sound restores one life, never more than three",out===3,out);
    const pace=await page.evaluate(() => { pacePlay=0; const first=slicePace(); pacePlay=90000; const later=slicePace(); heartLastAt=-1e9; loseHeart(performance.now()); return {first,later,back:slicePace()}; });
    ok("fruit starts slow, gets harder, and backs off after a miss",pace.first===1&&pace.later>pace.first&&pace.back<pace.later,pace);
    await page.evaluate(() => { hearts=1; heartLastAt=-1e9; loseHeart(performance.now()); });
    await page.waitForFunction(() => !!window.__ended);
    ok("zero hearts ends on Play again and Back home with the mic closed",await page.evaluate(() => hearts===0&&!playing&&!reviveWait&&!rv.st&&document.getElementById("endOvl").classList.contains("show")&&getComputedStyle(document.getElementById("endCharge")).display!=="none"));
    ok("lives produce no page errors",errors.length===0,errors);
  } finally { await context.close(); }
});

await scenario("a whole round", async () => {
  const { context, page, errors } = await open();
  await page.evaluate(() => { hearts=999; });
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
    let b = await best(page);
    ok("the top-left number counts fruit in a row, and with nothing sliced yet it is 0", b.on === 0 && b.row === 0 && b.pill === "0" && b.label === "Fruit in a row: 0", b);
    await page.waitForFunction(() => fruits.some((q) => q.g < G && q.r >= 41), null, { timeout: 8000 });
    ok("after two misses in a row the next fruit comes bigger and slower", true);
    // slice through wave 1
    ok("slicing six fruit finishes wave 1", await sliceUntil(page, () => phase !== "wave"));
    b = await best(page);
    ok("every fruit sliced is one on the row: the number is the round's longest row, and it only ever climbed", b.row >= 1 && b.row <= b.score && b.on <= b.row && b.pill === String(b.row) && b.label === "Fruit in a row: " + b.row && neverDown(b.pills), b);
    await page.locator("#revOvl.show").waitFor({ timeout: 12000 });
    s = await st(page);
    ok("…then the say-it card asks for wave 2: with Echo's voice service down, the bare sound (nobody would say a syllable)", /^Say “rrrr” for wave 2!$/.test(s.title) && s.wave === 0 && !s.playing, s);
    ok("…with wave 1 ticked on the card", (await page.locator("#revHearts .wdot.on").count()) === 1 && (await page.locator("#revHearts .wdot").count()) === 3);
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 12000 });
    ok("the card's mic opens only after the wave's cheer, never during play", (await page.evaluate(() => __f.mics)) === 1);
    const atCard = await best(page);
    await heard(page);
    s = await st(page);
    ok("the child's sound starts wave 2, and the mic is closed again", s.wave === 1 && s.phase === "wave" && s.playing && !s.card && s.REV === 2 && s.live === 0, s);
    b = await best(page);
    ok("the row carries on from wave to wave: the say-it card between them neither breaks it nor adds to it", atCard.on >= 1 && b.on === atCard.on && b.row === atCard.row && b.pill === atCard.pill, { atCard: atCard.on, on: b.on });
    // a golden fruit counts three
    const dim = await page.evaluate(() => ({ W, H }));
    const before = await page.evaluate(() => ({ score, waveGot }));
    await page.evaluate(() => { fruits.push({ e: "🍊", gold: true, x: W / 2, y: H * 0.45, g: 0, vx: 0, vy: 0, r: 40, rot: 0, vr: 0, sliced: false }); });
    await page.mouse.move(dim.W / 2 - 90, dim.H * 0.45 - 20); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(dim.W / 2 - 90 + i * 30, dim.H * 0.45 - 20 + i * 7);
    await page.mouse.up();
    const after = await page.evaluate(() => ({ score, waveGot }));
    ok("a golden fruit counts three, toward the wave too", after.score - before.score >= 3 && after.waveGot - before.waveGot >= 3, { before, after });
    ok("…and says so without a sum: \u201CGOLDEN!\u201D, never \u201C+3\u201D", (await best(page)).flash === "GOLDEN!");
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
    // nothing left in the air, so the only thing the next swipes can slice is the giant
    await page.evaluate(() => { fruits.length = 0; });
    const atGiant = await best(page);
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
    b = await best(page);
    ok("the giant watermelon is one fruit on the row, however many cuts it took", b.on === atGiant.on + 1 && b.score === atGiant.score + 5, { atGiant: atGiant.on, on: b.on });
    ok("a first ever round just sets the best, on one line under the win: \u201CN fruit in a row. Your best: N!\u201D", b.title === "You sliced the giant watermelon!" && b.sub === rowSaid(b.row) + ". Your best: " + b.row + "!", b);
    ok("…and \u201CNew best!\u201D is never said during a first ever round, and the number never went down", b.said.length === 0 && neverDown(b.pills) && b.pill === String(b.row), b);
    ok("the phone keeps it as this child's best, and the old shared best is never written", b.stored === b.row && b.old === null, b);
    ok("the top button is Play again, with Back home under it", b.top === "Play again" && b.home === "Back home" && b.again === null && b.order, b);
    ok("the earned turn is spent once the round ends", await page.evaluate(() => sessionStorage.getItem("sona.play.active") === null && sessionStorage.getItem("sona.play.token") === null));
    const sfx = await page.evaluate(() => __f.sfx);
    ok("no sound ever played while the card's mic was open", sfx.length > 0 && sfx.every((c) => !c.live), sfx.filter((c) => c.live));
    ok("the game's own sounds were heard: slices, the giant's cuts and its burst",
      ["swish", "splat", "giant", "complete"].every((n) => sfx.some((c) => c.name === n)), [...new Set(sfx.map((c) => c.name))]);
    const went = page.waitForRequest((r) => r.isNavigationRequest() && r.frame() === page.mainFrame(), { timeout: 3000 }).then((r) => r.url(), () => null);
    await page.locator("#endCharge").click();
    ok("Play again is earned like every turn: back through this game's say-it-five-times page", (await went) === BASE + "/charge.html?game=arcade-slice.html", await went);
    ok("a whole round: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── a drop, and Super Slice's extras ──
// On a board the test owns, so every count is exact. (Super Slice is switched
// on here by its own clock; earning it by voice is superslicetest's.)
await scenario("a drop, and Super Slice", async () => {
  const { context, page, errors } = await open();
  try {
    await page.evaluate(() => { WAVES[0].goal = 99; });   // the wave must not end under the test
    await quiet(page);
    await sliceNew(page); await sliceNew(page);
    let b = await best(page);
    ok("two fruit sliced, none dropped: 2 in a row", b.on === 2 && b.row === 2 && b.pill === "2" && b.label === "Fruit in a row: 2" && b.waveGot === 2 && b.score === 2, b);
    await dropOne(page);
    b = await best(page);
    ok("a fruit that hits the ground ends the row they are on, and the top-left number does not go down", b.on === 0 && b.row === 2 && b.pill === "2" && b.missRun === 1, b);
    await sliceNew(page);
    b = await best(page);
    ok("the next fruit starts a new row at 1, and the number still shows the round's longest", b.on === 1 && b.row === 2 && b.pill === "2", b);
    await sliceNew(page); await sliceNew(page);
    b = await best(page);
    ok("passing the round's longest row moves the number again", b.on === 3 && b.row === 3 && b.pill === "3" && b.pills.join() === "1,2,3", b);
    await sliceNew(page, {}, 2);
    b = await best(page);
    ok("the row they are on is flashed every fifth fruit, in the win card's words: \u201C5 in a row!\u201D", b.on === 5 && b.flash === "5 in a row!", b);
    // Super Slice
    const w0 = b.waveGot;
    const tossed = await page.evaluate(() => { slowTotal = slowMs = 10000; fruits = []; toss(); const out = fruits.map((f) => !!f.extra); fruits.forEach((f) => { f.x = W / 2; f.y = H * 0.45; f.vx = 0; f.vy = 0; f.g = 1e-9; f.gold = false; }); return out; });
    ok("every fruit thrown during Super Slice is an extra", tossed.length >= 2 && tossed.every(Boolean), tossed);
    await sliceNew(page, {}, 0);   // one swipe through the fruit the stand just threw
    b = await best(page);
    ok("slicing an extra adds to the row, and nothing to the wave", b.on === 5 + tossed.length && b.row === b.on && b.pill === String(b.on) && b.waveGot === w0, { tossed: tossed.length, ...b });
    const on = b.on;
    await sliceNew(page, { extra: true, gold: true });
    b = await best(page);
    ok("a golden extra is one fruit on the row, and still nothing toward the wave", b.on === on + 1 && b.waveGot === w0 && b.flash === "GOLDEN!", b);
    await dropOne(page, { extra: true });
    await dropOne(page);   // an ordinary fruit, thrown before the power, landing while it lasts
    b = await best(page);
    ok("nothing dropped during Super Slice breaks the row, or feeds the two-miss help", b.on === on + 1 && b.row === on + 1 && b.missRun === 0, b);
    await page.evaluate(() => { slowMs = 0; });
    await dropOne(page, { extra: true });
    b = await best(page);
    ok("an extra still in the air when Super Slice ends costs nothing either: an extra can only help", b.on === on + 1 && b.missRun === 0, b);
    const plain = await page.evaluate(() => { fruits = []; toss(); const out = fruits.map((f) => !!f.extra); fruits = []; return out; });
    ok("once it is over, the stand throws ordinary fruit again", plain.length >= 1 && plain.every((x) => !x), plain);
    await sliceNew(page);
    b = await best(page);
    ok("…which count toward the wave as they always did", b.waveGot === w0 + 1 && b.on === on + 2, b);
    await dropOne(page);
    b = await best(page);
    ok("…and an ordinary drop ends the row again, the number staying at its highest", b.on === 0 && b.row === on + 2 && b.pill === String(on + 2) && b.missRun === 1 && neverDown(b.pills), b);
    // the wave's time limit, in Super Slice: real seconds, not the slowed clock
    const t = await page.evaluate(() => new Promise((done) => {
      fruits = []; slowTotal = slowMs = 10000; waveMs = 0; wavePlay = 0; nextToss = 1e9; WAVE_CAP_MS = 1500;
      const t0 = performance.now(); (function w() { if (phase !== "wave") return done({ real: performance.now() - t0, clock: waveMs }); setTimeout(w, 20); })();
    }));
    ok("a wave's time limit is real seconds of play, even while Super Slice slows its clock: no round runs forever", t.real >= 1350 && t.real < 2600 && t.clock < t.real * 0.7, t);
    ok("a drop, and Super Slice: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── passing the best mid-round ──
// A child who came in with a best of 3 (and the old shared number, 40, still
// on the phone: it must not be read). The fourth fruit in a row passes it.
await scenario("passing the best", async () => {
  const { context, page, errors } = await open({ best: 3, old: "40" });
  try {
    await page.evaluate(() => { WAVES[0].goal = 99; });
    await quiet(page);
    ok("the game opens on this child's own best, not the old shared one", (await page.evaluate(() => startBest)) === 3 && (await best(page)).stored === 3);
    await sliceNew(page); await sliceNew(page); await sliceNew(page);
    let b = await best(page);
    ok("level with the best is not past it: no banner yet, nothing new kept", b.row === 3 && b.said.length === 0 && b.stored === 3, b);
    await sliceNew(page);
    b = await best(page);
    ok("the moment the row passes their best, the banner says \u201CNew best!\u201D", b.row === 4 && b.said.length === 1 && b.said[0][0] === "New best!" && b.said[0][1] === "4 fruit in a row" && (await page.locator("#bnBig").textContent()) === "New best!", b);
    ok("…and it is kept at once, so a round the phone kills half way still counts", b.stored === 4, b);
    await sliceNew(page, {}, 2);
    b = await best(page);
    ok("one swipe through two fruit steps over five, and the flash says the row as it stands: \u201C6 in a row!\u201D", b.on === 6 && b.flash === "6 in a row!", b);
    await dropOne(page);
    await sliceNew(page); await sliceNew(page);
    b = await end(page);
    ok("\u201CNew best!\u201D was said once in the round, not at every fruit after it", b.said.length === 1 && b.row === 6 && b.on === 2 && b.pills.join() === "1,2,3,4,6", b);
    ok("stopping early is still a win, its title carries no second count, and the line says \u201C6 fruit in a row. A new best!\u201D", b.title === "I saw the fruit fly! So fun!" && !/\d/.test(b.title) && b.sub === "6 fruit in a row. A new best!", b);
    ok("the new best is kept, and the old shared number is left exactly as it was", b.stored === 6 && b.old === "40", b);
    ok("passing the best: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// a best passed on a wave's last fruit: the wave's own banner waits for it
await scenario("a new best on the wave's last fruit", async () => {
  const { context, page, errors } = await open({ best: 1 });
  try {
    await page.evaluate(() => { WAVES[0].goal = 2; });
    await quiet(page);
    await sliceNew(page); await sliceNew(page);
    ok("the second fruit passes the best and finishes the wave", await page.evaluate(() => phase === "break" && rowBest === 2) && (await page.locator("#bnBig").textContent()) === "New best!");
    await page.waitForTimeout(1300);
    ok("\u201CNew best!\u201D is still up when the wave's own cheer would have covered it", (await page.locator("#bnBig").textContent()) === "New best!");
    await page.waitForFunction(() => document.getElementById("bnBig").textContent === "Wave 1 done!", null, { timeout: 4000 });
    await page.locator("#revOvl.show").waitFor({ timeout: 6000 });
    ok("…then the wave is cheered and the say-it card comes, as ever", /for wave 2!$/.test(await page.locator("#revTitle").textContent()));
    ok("the wave's end keeps the best", (await best(page)).stored === 2);
    ok("a new best on the wave's last fruit: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// the giant can pass the best too: its own banner and the win card say it
await scenario("the giant passes the best", async () => {
  const { context, page, errors } = await open({ best: 2 });
  try {
    await page.evaluate(() => { WAVES[0].goal = 99; });
    await quiet(page);
    await sliceNew(page); await sliceNew(page);
    await page.evaluate(() => { startFinale(); });
    await page.waitForFunction(() => giant && giant.y <= giant.ty + giant.r * 0.6, null, { timeout: 8000 });
    for (let cut = 0; cut < 5; cut++) {
      const g = await page.evaluate(() => giant ? { x: giant.x, y: giantY(), r: giant.r } : null);
      if (!g) break;
      await page.mouse.move(g.x - g.r - 50, g.y - 30 + cut * 12); await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(g.x - g.r - 50 + i * (2 * g.r + 100) / 8, g.y - 30 + cut * 12 + i * 4);
      await page.mouse.up(); await page.waitForTimeout(260);
    }
    await page.locator("#endOvl.show").waitFor({ timeout: 4000 });
    const b = await best(page);
    ok("a best passed by the giant leaves its own banner alone (\u201CYou did it!\u201D), and the win card says it: \u201C3 fruit in a row. A new best!\u201D",
      b.row === 3 && b.said.length === 0 && (await page.locator("#bnBig").textContent()) === "You did it!" && b.title === "You sliced the giant watermelon!" && b.sub === "3 fruit in a row. A new best!" && b.stored === 3, b);
    ok("the giant passes the best: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── under the best: an invitation, and a brother or sister starts empty ──
await scenario("under the best", async () => {
  const { context, page, errors } = await open({ best: 9 });
  try {
    await page.evaluate(() => { WAVES[0].goal = 99; });
    await quiet(page);
    for (let i = 0; i < 4; i++) await sliceNew(page);
    let b = await end(page);
    ok("under the best the win still says they won, then invites: \u201C4 fruit in a row. Your best: 9. 5 away!\u201D", WIN.test(b.title) && b.sub === "4 fruit in a row. Your best: 9. 5 away!", b);
    ok("…nothing was said about a new best, and their best did not move", b.said.length === 0 && b.stored === 9, b);
    ok("…and the top button is Play again, with Back home under it", b.top === "Play again" && b.home === "Back home" && b.order, b);
    // a sister on the same phone: her own game, her own best
    await page.evaluate(() => { Sona.addKid("Nora", "6"); Sona.saveProfile(Object.assign(Sona.getProfile(), { onboarded: true, focusSounds: ["S"] })); });
    await page.goto(BASE + "/arcade-slice.html?from=charge");
    await ready(page);
    ok("a sister opens the game with no best at all", (await page.evaluate(() => startBest)) === 0 && (await best(page)).stored === 0);
    await page.evaluate(() => { WAVES[0].goal = 99; });
    await quiet(page);
    await sliceNew(page); await sliceNew(page);
    b = await end(page);
    ok("her card is a first ever round: \u201C2 fruit in a row. Your best: 2!\u201D, with no word of her brother's 9", b.sub === "2 fruit in a row. Your best: 2!" && b.said.length === 0 && !/9/.test(b.title + b.sub), b);
    const two = await page.evaluate(() => { const hers = Sona.gameBest("slice"); Sona.switchKid(""); return { hers, his: Sona.gameBest("slice") }; });
    ok("each child keeps their own", two.hers === 2 && two.his === 9, two);
    ok("under the best: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── level with the best, a long way under it, and one fruit ──
await scenario("level with the best", async () => {
  const { context, page, errors } = await open({ best: 3 });
  try {
    await page.evaluate(() => { WAVES[0].goal = 99; });
    await quiet(page);
    for (let i = 0; i < 3; i++) await sliceNew(page);
    const b = await end(page);
    ok("level with their best is said kindly, with no \u201Caway\u201D: \u201C3 fruit in a row. The same as your best!\u201D", WIN.test(b.title) && b.sub === "3 fruit in a row. The same as your best!" && b.said.length === 0 && b.stored === 3, b);
    ok("level with the best: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});
// a long way under the best the card names the best and leaves the gap unsaid:
// "5 away!" is a dare, "37 away!" is how far short they fell
await scenario("a long way under the best", async () => {
  const { context, page, errors } = await open({ best: 38 });
  try {
    await quiet(page);
    await sliceNew(page);
    const b = await end(page);
    ok("a long way under, the line names their best and no gap, and one fruit is not called a row: \u201C1 fruit. Your best: 38.\u201D", b.title === "I saw the fruit fly! So fun!" && b.sub === "1 fruit. Your best: 38." && b.stored === 38 && (await page.evaluate(() => AWAY_NEAR)) === 10, b);
    ok("a long way under the best: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});
await scenario("nothing sliced", async () => {
  const { context, page, errors } = await open({ best: 12 });
  try {
    await quiet(page);
    const b = await end(page);
    ok("a round with nothing sliced keeps its own kind card, with no line about a best at all", b.title === "Good try! Wanna go again?" && b.sub === null && b.again === "Yes! Play again" && b.top === null && b.stored === 12, b);
    ok("nothing sliced: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── a phone still holding an older sona.js: the game plays, without a best ──
await scenario("an older sona.js", async () => {
  const { context, page, errors } = await open({ noStore: true, best: 38 });
  try {
    await page.evaluate(() => { WAVES[0].goal = 99; });
    await quiet(page);
    for (let i = 0; i < 3; i++) await sliceNew(page);
    const b = await end(page);
    ok("with no store for bests the round still plays and ends on its win, saying only what happened: \u201C3 fruit in a row.\u201D", b.row === 3 && b.pill === "3" && WIN.test(b.title) && b.sub === "3 fruit in a row." && b.top === "Play again", b);
    ok("an older sona.js: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── the old five-game run still banks the round, in words a child may read ──
// Home no longer opens it, but a saved run and a typed address do. Its card
// said "+7 points!" and "Banking your score…".
await scenario("the old run's card", async () => {
  const { context, page, errors } = await open({ daily: true });
  try {
    await page.evaluate(() => { WAVES[0].goal = 99; });
    await quiet(page);
    for (let i = 0; i < 3; i++) await sliceNew(page);
    const went = page.waitForRequest((r) => r.isNavigationRequest() && r.frame() === page.mainFrame(), { timeout: 4000 }).then((r) => r.url(), () => null);
    await page.evaluate(() => endRound());
    const b = await best(page);
    ok("the old run's card says \u201CGreat round!\u201D, never points or a score", b.shown && b.title === "Great round!" && b.sub === "On to the next game\u2026" && !/points?|scores?/i.test(b.title + b.sub) && b.top === null && b.home === null, b);
    ok("…and still banks the round and moves the run on by itself", /\/charge\.html\?daily=1&banked=3$/.test((await went) || ""), await went);
    ok("the old run's card: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── what the card asks: the sound, then one syllable, then a short word ──
const waveOver = (page) => page.evaluate(() => { waveGot = WAVES[wave].goal; });
const cardNow = (page) => page.evaluate(() => ({ title: document.getElementById("revTitle").textContent, orange: [...document.querySelectorAll("#revTitle .snd")].map((b) => b.textContent),
  note: document.getElementById("revListen").textContent, rung: ASK && ASK.rung, text: ASK && ASK.text, pill: document.getElementById("slowSound").textContent, rev: REV, live: __f.live, media: __f.media.slice() }));
const records = (page) => page.evaluate(() => JSON.stringify([Sona.getProgress().stage, Sona.outcomes(), localStorage.getItem("sona.attempts.v1"), Sona.repsToday()]));
const listening = (page) => page.waitForFunction(() => /listening/i.test(document.getElementById("revListen").textContent) && __f.live === 1, null, { timeout: 12000 });

await scenario("the cards climb", async () => {
  tts.up = true; tts.said = []; tts.all = [];
  const { context, page, errors } = await open({ native: true });
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
    ok("…said by Echo in ONE line that ends on the syllable, then his \"Go!\", and no recording", tts.said.join("|") === "To keep playing, say... " + want[0].text + "." && c.media.map((m) => m.src).join() === "voice,voice", { said: tts.said, media: c.media });
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
  tts.up = true; tts.said = []; tts.all = [];
  // "…then a short word", picked by a grown-up in Settings
  const { context, page, errors } = await open({ native: true, profile: { gameLevel: "word" } });
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
  tts.up = false; tts.said = []; tts.all = [];
  const { context, page, errors } = await open({ native: true });
  try {
    await waveOver(page); await page.locator("#revOvl.show").waitFor({ timeout: 12000 }); await listening(page);
    const c = await cardNow(page);
    ok("Echo's line would not load: the card asks the bare sound instead, all of it orange", c.title === "Say “rrrr” for wave 2!" && c.rung === 0 && c.orange.join() === "rrrr", c);
    ok("…and plays its recording at once, with no second line to wait for", tts.said.length === 1 && /^To keep playing, say\.\.\. r/.test(tts.said[0]) && c.media.length === 1 && c.media[0].src === "/coach/say-echo/R-sound.wav" && !c.media[0].live, { said: tts.said, media: c.media });
    ok("a voice that cannot play: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await scenario("a card nobody answers", async () => {
  tts.up = true; tts.said = []; tts.all = [];
  // "…then a short word" is picked, so the card after wave 2 WOULD ask "rot"
  const { context, page, errors } = await open({ native: true, profile: { gameLevel: "word" } });
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
      tts.said.join("|") === "To keep playing, say... " + asked.text + ".|I have an idea. Let's try this one." && c.media.map((m) => m.src).join() === "voice,voice,voice,/coach/say-echo/R-sound.wav,voice" && c.media.every((m) => !m.live) && (await page.evaluate(() => __f.mics)) === mics + 1, { said: tts.said, media: c.media });
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
    ok("…said by Echo again, with no second download of the line", tts.said.length === 2 && second.media.slice(before2).map((m) => m.src).join() === "voice,voice" && second.media.slice(before2).every((m) => !m.live), { said: tts.said, media: second.media.slice(before2) });
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
  tts.up = true; tts.said = []; tts.all = [];
  const { context, page, errors } = await open({ native: true, profile: { volume: 0, gameLevel: "word" } });
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
  tts.up = true; tts.said = []; tts.all = []; tts.delay = 4200;   // lands about 1.6 s after the card opens
  let { context, page, errors } = await open({ native: true });
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
    ok("once the line is in hand the syllable is painted and said straight after", c.title === "Say “" + want + "” for wave 2!" && c.rung === 1 && c.media.map((m) => m.src).join() === "voice,voice" && !!first && voiceAt - first.at >= 0 && voiceAt - first.at < 400, { c, first, voiceAt });
    ok("…one download, then his \"Go!\", and no recording", tts.said.length === 1 && c.media.length === 2, { said: tts.said, media: c.media });
    ok("a slow line: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
  // …and a line that never comes in time: the bare sound stays, its recording plays, the syllable is never shown
  tts.said = []; tts.all = []; tts.delay = 60000;
  ({ context, page, errors } = await open({ native: true }));
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
  tts.up = true; tts.said = []; tts.all = [];
  const { context, page, errors } = await open({ native: true, profile: { focusSounds: ["S"], gameLevel: "word" } });
  try {
    await waveOver(page); await page.locator("#revOvl.show").waitFor({ timeout: 12000 }); await listening(page);
    const c = await cardNow(page);
    ok("a child on S (not switched on) gets the card exactly as before: “sss”, Echo's lead-in, then her recording, then his \"Go!\"",
      c.title === "Say “sss” for wave 2!" && c.rung === 0 && c.orange.join() === "sss" && tts.said.length === 0 && tts.all.includes("To keep playing, say") && c.media.map((m) => m.src).join() === "voice,/coach/say-echo/S-sound.wav,voice", { c, said: tts.all });
    await heard(page); await page.waitForFunction(() => phase === "wave" && wave === 1);
    await waveOver(page); await page.locator("#revOvl.show").waitFor({ timeout: 12000 });
    ok("…and again after wave 2, whatever Settings says", (await cardNow(page)).title === "Say “sss” for wave 3!");
    ok("a child on another sound: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); tts.up = false; }
});

await browser.close(); await new Promise((r) => server.close(r));
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
