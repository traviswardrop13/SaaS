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
//
// BEAT YOUR BEST (Travis, 1-2 Oct 2026): the one number a child sees is NOTES
// IN A ROW, the most tiles tapped with none slipping past and no wrong key.
// The top-left number is the round's longest row and never goes down; "New
// best!" pops once, the moment they pass the best they came in with; the win
// card keeps its own win title and adds one line; the top button is "Play
// again", back through the say-it-five-times page. The best is this child's
// own (Sona.gameBest, besttest), it counts the finger and never the voice,
// and the words "score" and "points" are never shown.
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
async function scenario(name, fn) { if(process.env.TILES_LIVES_ONLY && name!=="hearts and pace") return; try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, e.stack); } }
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
ok("the best is this child's own, from the shared store, and the page asks before it uses it (an older cached sona.js has none)",
  /var CAN_BEST=!!\(S&&S\.gameBest&&S\.gameBestOffer\)/.test(code) && /if\(CAN_BEST\) startBest=S\.gameBest\("tiles"\)/.test(code) && /if\(!CAN_BEST\|\|rowBest<=keptRow\) return;[\s\S]{0,80}S\.gameBestOffer\("tiles",rowBest\)/.test(code));
ok("the old best, one hidden number for every child on the phone, is no longer read or written", !/sona\.best\.tiles|BESTK|localStorage/.test(code));
ok("the row counts the finger only: the say-it card and Echo's slow keys never add to it",
  (code.match(/comboN\+\+/g) || []).length === 1 && /best\.hit=true; comboN\+\+;/.test(code) && /if\(lane===lastHitLane&&performance\.now\(\)-lastHitAt<DOUBLE_MS\) return;\s*comboN=0;/.test(code) && (code.match(/rowUp\(\)/g) || []).length === 2 && !/function doRevive\(\)\{[^}]*(comboN|rowBest)/.test(code) && !/slowMs=8000;[^}]*(comboN|rowBest)/.test(code));
{ // every string the page can put on screen: the markup's text and the script's literals (ids such as "score" are one bare word)
  const words = [...PAGE.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").matchAll(/>([^<>]+)</g)].map((m) => m[1].trim())
    .concat([...code.matchAll(/"([^"\n]*)"/g)].map((m) => m[1]).filter((t) => /\s/.test(t)));
  const bad = words.filter((t) => /\bpoints?\b|\bscores?\b|you missed|\blost\b/i.test(t));
  ok("no words on the page say \u201Cscore\u201D or \u201Cpoints\u201D, or that a best was missed", words.length > 30 && bad.length === 0, bad);
}
ok("the top button is Play again, back through this game's practice page; the game-to-game Next is gone",
  /<button class="btn blue" id="endCharge">Play again<\/button>/.test(PAGE) && /\$\("endCharge"\)\.onclick=backToCharge;/.test(code) && !/WOOHOO|Next →|arcade-stack/.test(code));

// ── a fake phone: a mic that hears silence, audio that records what plays ──
function fakePhone(cfg) {
  // Echo's mid-round ask for the sound power (3 Oct 2026) is
  // arcadespeechhelptest's: held here, so a round is just the round.
  document.addEventListener("DOMContentLoaded", () => { if (window.SLOW_ASK) { SLOW_ASK.first = SLOW_ASK.every = SLOW_ASK.quiet = SLOW_ASK.soon = 1e12; window.slowAskAt = 1e12; } });
  cfg = cfg || {};
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
    // a phone still holding last week's sona.js: no store for bests at all
    if (cfg.noStore) { delete v.gameBest; delete v.gameBestOffer; }
    const sfx = v.sfx || {}; v.sfx = new Proxy(sfx, { get(t, k) { const real = t[k]; if (typeof real !== "function" || k === "stop") return real; return function () { f.sfx.push({ name: k, live: f.live > 0 }); return real.apply(this, arguments); }; } }); } });
  // the phone is set up once a tab: a later page in the same tab (the game
  // opened again for a second child) must find what the first one left
  if (!sessionStorage.getItem("__seeded")) {
    sessionStorage.setItem("__seeded", "1");
    localStorage.setItem("sona.freeera.v1", "post"); ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true, voiceOn: false, soundOn: true, volume: 0.6 }));
    if (cfg.best) localStorage.setItem("sona.bests.v1", JSON.stringify({ tiles: { n: cfg.best, at: "2026-10-01" } }));
    if (cfg.old) localStorage.setItem("sona.best.tiles", cfg.old);
  }
  sessionStorage.setItem("sona.play.token", "arcade-tiles.html");
}
async function ready(page) {
  await page.waitForFunction(() => window.gameEntryAllowed === true && typeof startSong === "function");
  // every number the top-left pill ever shows, and every "New best!" the banner says
  await page.evaluate(() => {
    window.__pill = []; window.__newBest = [];
    new MutationObserver(() => __pill.push(Number(document.getElementById("score").textContent))).observe(document.getElementById("score"), { childList: true, characterData: true, subtree: true });
    // (the page's banner() lives in a block, so it can't be wrapped from here: its words are watched instead)
    new MutationObserver(() => { const big = document.getElementById("bnBig").textContent, small = document.getElementById("bnSmall").textContent; if (/best/i.test(big + " " + small)) __newBest.push([big, small]); }).observe(document.getElementById("bnBig"), { childList: true, characterData: true, subtree: true });
  });
}
async function open(w, h, cfg = {}) {
  const context = await browser.newContext({ viewport: { width: w || 390, height: h || 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (r) => (r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort()));
  await context.addInitScript(fakePhone, cfg);
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/arcade-tiles.html?from=charge" + (cfg.daily ? "&daily=1" : ""));
  await ready(page);
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
// tap n tiles, one at a time, as each reaches the keys
async function tapN(page, n) { let got = 0; const t0 = Date.now(); while (got < n && Date.now() - t0 < 40000) { if (await tapKeys(page)) got++; await page.waitForTimeout(40); } return got; }
// a wrong key: a tap on a lane that has no tile at the keys (and not the key
// just played: a second tap there, straight after its tile, is a bounce)
const wrongKey = (page) => page.evaluate(() => {
  const busy = tiles.filter((q) => !q.hit && !q.gone && q.y + q.h > HITY() - 96 && q.y < HITY() + 70).map((q) => q.lane), lane = [0, 1, 2, 3].find((l) => busy.indexOf(l) < 0 && l !== lastHitLane);
  const r = document.getElementById("cv").getBoundingClientRect();
  document.getElementById("cv").dispatchEvent(new PointerEvent("pointerdown", { clientX: r.left + (lane + 0.5) * (W / 4), clientY: r.top + HITY(), bubbles: true }));
  return lane;
});
// what the child sees: the row they are on, the top-left number, the banner, the win card, and what the phone keeps
const best = (page) => page.evaluate(() => {
  const $ = (id) => document.getElementById(id), vis = (e) => !!e && getComputedStyle(e).display !== "none";
  return { combo: comboN, row: rowBest, pill: $("score").textContent, label: $("rowPill").getAttribute("aria-label"), pills: __pill.slice(), said: __newBest.slice(), flash: $("flash").textContent,
    stored: Sona.gameBest ? Sona.gameBest("tiles") : null, old: localStorage.getItem("sona.best.tiles"),
    title: $("endTitle").textContent.trim(), sub: vis($("endSub")) ? $("endSub").textContent.trim() : null, shown: $("endOvl").classList.contains("show"),
    top: vis($("endCharge")) ? $("endCharge").textContent.trim() : null, again: vis($("endAgain")) ? $("endAgain").textContent.trim() : null, home: vis($("endHome")) ? $("endHome").textContent.trim() : null,
    order: vis($("endCharge")) && vis($("endHome")) && $("endCharge").getBoundingClientRect().bottom <= $("endHome").getBoundingClientRect().top };
});
const neverDown = (list) => list.every((n, i) => i === 0 || n >= list[i - 1]);
// stop after the first song: the say-it card's own "I'm done playing"
async function stopAtCard(page) { await page.locator("#revOvl.show").waitFor({ timeout: 12000 }); await page.locator("#revDone").click(); await page.locator("#endOvl.show").waitFor(); }
const WIN = /^(Bravo! You played four songs!|You\u2019re a piano star! My feathers were dancing!|What beautiful music we made!)$/;

await scenario("hearts and pace", async () => {
  const {context,page,errors}=await open(320,568);
  try {
    const installed=await page.evaluate(()=>typeof hearts!=="undefined"&&typeof loseHeart==="function");
    ok("three real hearts are installed on the playable board",installed);
    if(!installed)return;
    const drop=async()=>{await page.evaluate(()=>{tiles=[{lane:0,y:HITY()+80,h:88,hit:false,gone:false,note:HZ.C,wait:false,gold:false}];songIx=1;nextAt=1e9;});await page.waitForFunction(()=>tiles.some(t=>t.gone));};
    ok("the first song starts at the original gentle pace",await page.evaluate(()=>hearts===3&&paceK===1&&Math.abs((HITY()+90)/speedPx()-2.5)<.01));
    await page.evaluate(()=>{paceK=1.3;});await drop();
    ok("a missed note costs one heart, backs the pace off, and opens no card",await page.evaluate(()=>hearts===2&&Math.abs(paceK-1.18)<.001&&playing&&!reviveWait&&!window.__ended));
    await drop();ok("one fumble cannot cascade through the remaining hearts",await page.evaluate(()=>hearts===2));
    await page.evaluate(()=>{slowMs=8000;heartHitAt=-1e9;});await drop();
    ok("slow keys protect hearts",await page.evaluate(()=>hearts===2));
    await page.evaluate(()=>{slowMs=0;SLOW_HELP.onHeard();});
    ok("a heard sound gives a heart back, with the three-heart ceiling",await page.evaluate(()=>{SLOW_HELP.onHeard();return hearts===3;}));
    await page.evaluate(()=>{slowMs=0;hearts=1;heartHitAt=-1e9;comboN=rowBest=5;paintRow();});await drop();
    await page.locator("#endOvl.show").waitFor();
    ok("zero hearts ends on a kind card with the child's best and replay/home buttons",await page.evaluate(()=>hearts===0&&window.__ended&&!playing&&!reviveWait&&/Lovely music/.test(document.getElementById("endTitle").textContent)&&document.getElementById("endSub").textContent.indexOf("5 notes")>=0&&document.getElementById("endCharge").textContent==="Play again"));
    ok("the hearts fit the smallest phone without pushing Echo below the board",await page.evaluate(()=>{var top=document.getElementById("top").getBoundingClientRect(),h=document.getElementById("gameHearts").getBoundingClientRect();return h.right<=innerWidth&&h.bottom<=top.bottom;}));
    ok("hearts have no runtime errors",errors.length===0,errors);
  } finally {await context.close();}
});

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
    let b = await best(page);
    ok("the top-left number counts notes in a row: 14 tiles, none slipped, no wrong key", b.combo === 14 && b.row === 14 && b.pill === "14" && b.label === "Notes in a row: 14" && b.pills.join() === "1,2,3,4,5,6,7,8,9,10,11,12,13,14", b);
    await page.locator("#revOvl.show").waitFor({ timeout: 12000 });
    let s = await st(page);
    ok("the song done, the say-it card asks for the sound for song 2", /^Say “rrrr” for song 2!$/.test(s.title) && s.song === 0, s);
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 12000 });
    await heardCard(page);
    s = await st(page);
    ok("the child's sound starts song 2, and the mic is closed again", s.song === 1 && s.phase === "song" && s.playing && !s.card && s.REV === 2 && s.live === 0, s);
    // song 2: let two tiles slip by
    await playSong(page, 2);
    s = await st(page);
    ok("a slipped tile costs a heart, play continues, and the card waits for the next song", s.REV === 2 && await page.evaluate(() => hearts===1) && (s.card ? /for song 3!$/.test(s.title) : true), s);
    b = await best(page);
    ok("a slipped tile ends the row, and the top-left number stays where it was: it never goes down", b.combo < 14 && b.row >= 14 && b.pill === String(b.row) && neverDown(b.pills), b);
    const after2 = b.combo;
    await page.locator("#revOvl.show").waitFor({ timeout: 12000 });
    await page.waitForFunction(() => __f.live === 1, null, { timeout: 12000 });
    await heardCard(page);
    await playSong(page);
    await page.waitForFunction(() => phase === "song" && SONGS[song].finale, null, { timeout: 8000 });
    b = await best(page);
    ok("the row carries on from song to song: the say-it card between them neither breaks it nor adds to it, and passing 14 moves the number again", after2 > 0 && b.combo === after2 + 10 && b.row === b.combo && b.pill === String(b.row) && neverDown(b.pills), { after2, ...b });
    s = await st(page);
    ok("after song 3 the grand finale comes straight in, with no card", !s.card && s.mics === 2 && s.REV === 1, s);
    await page.waitForFunction(() => tiles.some((q) => q.wait && q.y >= HITY() - q.h + 39), null, { timeout: 8000 });
    await page.waitForTimeout(1200);
    ok("…and its tiles wait on the keys, so it can't be missed", await page.evaluate(() => tiles.every((q) => !q.gone) && tiles.some((q) => q.wait && !q.hit)));
    await playSong(page);
    await page.locator("#endOvl.show").waitFor({ timeout: 8000 });
    ok("the finale ends the round in a win", /Bravo! You played four songs!/.test(await page.locator("#endTitle").innerText()));
    ok("the earned turn is spent once the round ends", await page.evaluate(() => sessionStorage.getItem("sona.play.active") === null && sessionStorage.getItem("sona.play.token") === null));
    b = await best(page);
    ok("every note of the four songs is the longest a row can be: 52", (await page.evaluate(() => ROW_TOP)) === 52 && b.row <= 52 && b.row >= 14, b.row);
    ok("a first ever round just sets the best, on one line under the win: \u201CN notes in a row. Your best: N!\u201D", b.title === "Bravo! You played four songs!" && b.sub === b.row + " notes in a row. Your best: " + b.row + "!", b);
    ok("\u2026and \u201CNew best!\u201D is never said during a first ever round", b.said.length === 0 && neverDown(b.pills) && b.pill === String(b.row), b);
    ok("the phone keeps it as this child's best, and the old shared best is never written", b.stored === b.row && b.old === null, b);
    ok("the top button is Play again, with Back home under it", b.top === "Play again" && b.home === "Back home" && b.again === null && b.order, b);
    ok("the row ran on through the finale, where no tile can slip", b.row === after2 + 25, { after2, row: b.row });
    const sfx = await page.evaluate(() => __f.sfx);
    ok("no chime ever played while the card's mic was open", sfx.length > 0 && sfx.every((c) => !c.live), sfx.filter((c) => c.live));
    const went = page.waitForRequest((r) => r.isNavigationRequest() && r.frame() === page.mainFrame(), { timeout: 3000 }).then((r) => r.url(), () => null);
    await page.locator("#endCharge").click();
    ok("Play again is earned like every turn: back through this game's say-it-five-times page", (await went) === BASE + "/charge.html?game=arcade-tiles.html", await went);
    ok("a whole round: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── passing the best mid-round, and a wrong key ──
// A child who came in with a best of 5 (and the old shared number, 52, still
// on the phone: it must not be read). The sixth tile in a row passes it.
await scenario("passing the best", async () => {
  const { context, page, errors } = await open(390, 844, { best: 5, old: "52" });
  try {
    ok("the game opens on this child's own best, not the old shared one", (await page.evaluate(() => startBest)) === 5 && (await best(page)).stored === 5);
    await tapN(page, 5);
    let b = await best(page);
    ok("level with the best is not past it: no banner yet, nothing new kept", b.row === 5 && b.said.length === 0 && b.stored === 5, b);
    await tapN(page, 1);
    b = await best(page);
    ok("the moment the row passes their best, the calm banner says \u201CNew best!\u201D", b.row === 6 && b.said.length === 1 && b.said[0][0] === "New best!" && b.said[0][1] === "6 notes in a row" && (await page.locator("#bnBig").textContent()) === "New best!", b);
    ok("\u2026and it is kept at once, so a round the phone kills half way still counts", b.stored === 6, b);
    await tapN(page, 2);
    b = await best(page);
    ok("the row they are on is flashed in the win card's words: \u201C8 in a row!\u201D", b.combo === 8 && b.flash === "8 in a row!", b);
    // A bounce: the key just played, tapped again at once with no tile on it.
    // It is not a wrong key (no thud, no shake, the row stands); the same
    // key once the moment has passed is one, like any other empty key.
    const bounce = await page.evaluate(() => {
      const r = document.getElementById("cv").getBoundingClientRect(), lane = lastHitLane, before = { combo: comboN, shake: shakeT };
      const tap = () => document.getElementById("cv").dispatchEvent(new PointerEvent("pointerdown", { clientX: r.left + (lane + 0.5) * (W / 4), clientY: r.top + HITY(), bubbles: true }));
      const keep = tiles.splice(0);   // for this one instant no tile is anywhere, so every key is an empty key
      lastHitAt = performance.now();   // the tile was played this instant
      tap();
      const kept = { combo: comboN, shake: shakeT };
      lastHitAt = performance.now() - DOUBLE_MS - 1;   // …and now the moment has passed
      tap();
      const late = { combo: comboN, shook: shakeT !== before.shake };
      tiles.push.apply(tiles, keep); comboN = before.combo;   // hand the board and the row back: the wrong key below is the one this scenario plays on from
      return { lane, before, kept, late, ms: DOUBLE_MS };
    });
    ok("a second tap on the key just played is a bounce, not a wrong key: the row stands and nothing shakes", bounce.lane >= 0 && bounce.before.combo === 8 && bounce.kept.combo === 8 && bounce.kept.shake === bounce.before.shake && bounce.ms > 0 && bounce.ms <= 400, bounce);
    ok("\u2026but the same key once that moment has passed is a wrong key like any other", bounce.late.combo === 0 && bounce.late.shook, bounce);
    b = await best(page);
    ok("\u2026and neither tap moved the top-left number", b.combo === 8 && b.row === 8 && b.pill === "8", b);
    const lane = await wrongKey(page);
    b = await best(page);
    ok("a wrong key ends the row, and the top-left number stays at 8", lane != null && b.combo === 0 && b.row === 8 && b.pill === "8" && neverDown(b.pills), b);
    await playSong(page);
    await stopAtCard(page);
    b = await best(page);
    ok("the rest of the song starts a new row, shorter than 8: the number never moved, and never went down", b.combo === 6 && b.row === 8 && b.pills.join() === "1,2,3,4,5,6,7,8", b);
    ok("\u201CNew best!\u201D was said once in the round, not at every note after it", b.said.length === 1, b.said);
    ok("stopping early is still a win, and the line says \u201C8 notes in a row. A new best!\u201D", WIN.test(b.title) && b.sub === "8 notes in a row. A new best!", b);
    ok("the new best is kept, and the old shared number is left exactly as it was", b.stored === 8 && b.old === "52", b);
    ok("passing the best: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── under the best: an invitation, and a brother or sister starts empty ──
await scenario("under the best", async () => {
  const { context, page, errors } = await open(390, 844, { best: 20 });
  try {
    await playSong(page);
    await stopAtCard(page);
    let b = await best(page);
    ok("under the best the win still says they won, then invites: \u201C14 notes in a row. Your best: 20. 6 away!\u201D", WIN.test(b.title) && b.sub === "14 notes in a row. Your best: 20. 6 away!", b);
    ok("\u2026nothing was said about a new best, and their best did not move", b.said.length === 0 && b.stored === 20, b);
    ok("\u2026and the top button is Play again, with Back home under it", b.top === "Play again" && b.home === "Back home" && b.order, b);
    // a sister on the same phone: her own game, her own best
    await page.evaluate(() => { Sona.addKid("Nora", "6"); Sona.saveProfile(Object.assign(Sona.getProfile(), { onboarded: true, focusSounds: ["S"] })); });
    await page.goto(BASE + "/arcade-tiles.html?from=charge");
    await ready(page);
    ok("a sister opens the game with no best at all", (await page.evaluate(() => startBest)) === 0 && (await best(page)).stored === 0);
    await tapN(page, 3);
    await page.evaluate(() => endRound());
    await page.locator("#endOvl.show").waitFor();
    b = await best(page);
    ok("her card is a first ever round: \u201C3 notes in a row. Your best: 3!\u201D, with no word of her brother's 20", b.sub === "3 notes in a row. Your best: 3!" && b.said.length === 0 && !/20/.test(b.title + b.sub), b);
    const two = await page.evaluate(() => { const hers = Sona.gameBest("tiles"); Sona.switchKid(""); return { hers, his: Sona.gameBest("tiles") }; });
    ok("each child keeps their own", two.hers === 3 && two.his === 20, two);
    ok("under the best: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── level with the best, and the top ──
await scenario("level with the best", async () => {
  const { context, page, errors } = await open(390, 844, { best: 14 });
  try {
    await playSong(page);
    await stopAtCard(page);
    const b = await best(page);
    ok("level with their best is said kindly, with no \u201Caway\u201D: \u201C14 notes in a row. The same as your best!\u201D", WIN.test(b.title) && b.sub === "14 notes in a row. The same as your best!" && b.said.length === 0 && b.stored === 14, b);
    ok("level with the best: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});
await scenario("every note", async () => {
  const { context, page, errors } = await open(390, 844, { best: 52 });
  try {
    // 51 in a row behind them, and one more tile tapped: every note there is
    await page.evaluate(() => { comboN = ROW_TOP - 1; });
    await tapN(page, 1);
    await page.evaluate(() => endRound());
    await page.locator("#endOvl.show").waitFor();
    const b = await best(page);
    ok("a child already at the top is told so, not dared to pass it: \u201C52 notes in a row. That is every note!\u201D", b.row === 52 && b.sub === "52 notes in a row. That is every note!" && b.said.length === 0 && b.stored === 52, b);
    ok("every note: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// a long way under the best the card names the best and leaves the gap unsaid:
// "7 away!" is a dare, "35 away!" is how far short they fell
await scenario("a long way under the best", async () => {
  const { context, page, errors } = await open(390, 844, { best: 38 });
  try {
    await tapN(page, 3);
    await page.evaluate(() => endRound());
    await page.locator("#endOvl.show").waitFor();
    const b = await best(page);
    ok("a long way under, the line names their best and no gap: \u201C3 notes in a row. Your best: 38.\u201D", WIN.test(b.title) && b.sub === "3 notes in a row. Your best: 38." && b.stored === 38 && (await page.evaluate(() => AWAY_NEAR)) === 10, b);
    ok("a long way under the best: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── a phone still holding an older sona.js: the game plays, without a best ──
await scenario("an older sona.js", async () => {
  const { context, page, errors } = await open(390, 844, { noStore: true, best: 38 });
  try {
    await tapN(page, 3);
    await page.evaluate(() => endRound());
    await page.locator("#endOvl.show").waitFor();
    const b = await best(page);
    ok("with no store for bests the round still plays and ends on its win, saying only what happened: \u201C3 notes in a row.\u201D", b.row === 3 && b.pill === "3" && WIN.test(b.title) && b.sub === "3 notes in a row." && b.top === "Play again", b);
    ok("an older sona.js: no runtime errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── the old five-game run still banks the round, in words a child may read ──
// Home no longer opens it, but a saved run and a typed address do. Its card
// said "+7 points!" and "Banking your score…".
await scenario("the old run's card", async () => {
  const { context, page, errors } = await open(390, 844, { daily: true });
  try {
    await tapN(page, 3);
    const went = page.waitForRequest((r) => r.isNavigationRequest() && r.frame() === page.mainFrame(), { timeout: 4000 }).then((r) => r.url(), () => null);
    await page.evaluate(() => endRound());
    const b = await best(page);
    ok("the old run's card says \u201CGreat round!\u201D, never points or a score", b.shown && b.title === "Great round!" && b.sub === "On to the next game\u2026" && !/points?|scores?/i.test(b.title + b.sub) && b.top === null && b.home === null, b);
    ok("\u2026and still banks the round and moves the run on by itself", /\/charge\.html\?daily=1&banked=3$/.test((await went) || ""), await went);
    ok("the old run's card: no runtime errors", errors.length === 0, errors);
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
