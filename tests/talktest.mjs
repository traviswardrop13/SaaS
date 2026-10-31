// TALK1 (31 Oct 2026): Day 1 talks in the child's own sound. Travis: "we
// just need to wow them in their first sessions so the daily adventure is
// prob the one most choose and the day 1 has to be awesome ... i want the
// books in the daily adventure to be unique depending on the target sound so
// they are practicing it throughout the story"; then "go build the r one and
// the other popular sounds". What this holds:
//   1. the stories (public/talk-stories.js): the shape, every line's rules,
//      every key word (a whole word in its line, starting with the story's
//      sound before a vowel by its pronouncing entry), and sona.js's
//      STORY_TALK, the picture prompts and the pictures agreeing with them;
//   2. Day 1's slot (sona.js): the talking story in the child's first
//      practice sound that has one, else the lighthouse; a Day 1 finished
//      stays what it was; the story is its own game key, by the story's rule;
//   3. the player (adventure.html): each page reads, asks its word, hears it
//      three times and turns; silence never turns a page; three tries of the
//      other kind turn it kindly; "Not now" reads on with Next; the grown-ups'
//      Skip turns one page; the intro's last word finishes the day and the
//      ending plays on to the sticker; nothing plays while the mic listens;
//      the replay finishes nothing; ages 3-4 read the short run; it fits.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

let count = 0, fails = 0;
function ok(label, pass, detail = "") { count++; if (!pass) fails++; console.log((pass ? "PASS " : "FAIL ") + label + (pass ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); }
async function section(label, run) { try { await run(); } catch (e) { ok(label + " completes", false, e.stack); } }

// ── 1. the stories ─────────────────────────────────────────────────────────
const sandbox = { window: {} }; sandbox.this = sandbox.window;
vm.runInNewContext(readFileSync(ROOT + "/talk-stories.js", "utf8"), sandbox.window);
const T = sandbox.window.SonaTalkStories;
const SRC = readFileSync(ROOT + "/sona.js", "utf8");
const TALK = [...((SRC.match(/const STORY_TALK = \[([\s\S]*?)\n  \];/) || ["", ""])[1]).matchAll(/\{ id: "([a-z]+)", sound: "([A-Z]+)", hero: "([a-z]+)", name: "([^"]+)", title: "([^"]+)",\s*line: "([^"]+)" \}/g)]
  .map((m) => ({ id: m[1], sound: m[2], hero: m[3], name: m[4], title: m[5], line: m[6] }));
const LEX = JSON.parse(readFileSync(new URL("./booklex.json", import.meta.url), "utf8"));
const TARGET = { R: "R", P: "P", B: "B", M: "M", N: "N", T: "T", D: "D", K: "K", G: "G", F: "F", V: "V", S: "S", Z: "Z", SH: "SH", CH: "CH", J: "JH", L: "L", TH: "TH", THV: "DH" };
const VOWEL = /^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)$/;
const phones = (w) => LEX[w].split(" ").map((x) => x.replace(/\d/, ""));
const runOf = (id, part, little) => T[id][part].filter((sc) => !(little && sc.ages === "big"));
const linesOf = (sc) => (typeof sc.line === "string" ? [sc.line] : [sc.line.big, sc.line.little].filter(Boolean));
const STORY_IDS = [...((SRC.match(/const STORY_DAYS = \[([\s\S]*?)\n  \];/) || ["", ""])[1]).matchAll(/\{ id: "([a-z]+)"/g)].map((m) => m[1]);
{
  const ids = Object.keys(T);
  ok("sona.js's STORY_TALK and talk-stories.js name the same stories, each with its sound", TALK.length >= 1 && TALK.map((t) => t.id).join() === ids.join() && TALK.every((t) => T[t.id].sound === t.sound), { TALK, ids });
  ok("…one story a sound, and no id is a STORY_DAYS day or a catalog game", new Set(TALK.map((t) => t.sound)).size === TALK.length && TALK.every((t) => !STORY_IDS.includes(t.id) && !new RegExp("\\n    " + t.id + ": \\{ name:").test(SRC)), TALK.map((t) => t.id));
  ok("every story: 8 intro scenes and 4 ending scenes; ages 3-4 read 6 and 3", ids.every((id) => runOf(id, "intro", false).length === 8 && runOf(id, "ending", false).length === 4 && runOf(id, "intro", true).length === 6 && runOf(id, "ending", true).length === 3),
    ids.map((id) => id + " " + runOf(id, "intro", true).length + "/" + runOf(id, "ending", true).length));
  ok("…their pictures are s01-s08 and e01-e04, with a wash", ids.every((id) => T[id].intro.map((s) => s.art).join() === "s01,s02,s03,s04,s05,s06,s07,s08" && T[id].ending.map((s) => s.art).join() === "e01,e02,e03,e04" && /^#[0-9a-f]{6}$/i.test(T[id].wash)));
  const probs = [], seenKeys = {};
  for (const id of ids) {
    const snd = T[id].sound, tp = TARGET[snd]; seenKeys[id] = new Set();
    for (const sc of T[id].intro.concat(T[id].ending)) {
      const at = id + "/" + sc.art, k = sc.key;
      if (!/^[a-z']+$/.test(k || "")) { probs.push(at + ": no lower-case key"); continue; }
      if (seenKeys[id].has(k)) probs.push(at + `: "${k}" is asked twice in this story`); seenKeys[id].add(k);
      for (const l of linesOf(sc)) if (!l.split(/[^A-Za-z']+/).map((w) => w.toLowerCase()).includes(k)) probs.push(at + `: "${k}" is not a whole word in "${l}"`);
      if (!(k in LEX)) { probs.push(at + `: "${k}" is not in tests/booklex.json`); continue; }
      const ph = phones(k);
      if (ph[0] !== tp || !VOWEL.test(ph[1] || "")) probs.push(at + `: "${k}" (${LEX[k]}) doesn't start with ${snd} and a vowel`);
      if (snd === "R" && ph.slice(1).some((x) => x === "R" || x === "ER")) probs.push(at + `: "${k}" has a second r-coloured sound`);
    }
  }
  ok("every page's key word is a whole word in its line (both lines), starts with the story's sound before a vowel by its pronouncing entry, once a story", probs.length === 0, probs.slice(0, 8).join(" | "));
  // adventuretest's line rules, word for word
  const lines = [];
  for (const id of ids) for (const sc of T[id].intro.concat(T[id].ending)) for (const l of linesOf(sc)) lines.push({ at: id + "/" + sc.art, l });
  const bad = lines.filter(({ l }) => l.length > 120 || /[^A-Za-z0-9 .,!?'’…-]/.test(l.replace(/\.\.\./g, ""))
    || /\b(say|said|says|sound|sounds|voice|louder|loud|slowly|strong|stretch|score|points?|correct|wrong|miss|missed|fail|charge|win|lose|first|again)\b/i.test(l)
    || /\bMia\b/.test(l));
  ok("every line: 120 characters at most, plain punctuation, no word about talking or grading, no count of stars", bad.length === 0, bad.slice(0, 6));
  ok("every line ending names a gold star for the helper map, and never counts", ids.every((id) => { const e = T[id].ending[3]; return linesOf(e).every((l) => /gold star/i.test(l) && /helper map/i.test(l)); }));
  ok("every Home line and title is short and plain", TALK.every((t) => t.line.length <= 100 && t.title.length <= 32 && !/\b(say|sound|voice)\b/i.test(t.line)), TALK);
  // the picture prompts, and the pictures that exist
  const P = JSON.parse(readFileSync(path.resolve(ROOT, "../tools/art/adventure-prompts.json"), "utf8"));
  const parts = ["s01", "s02", "s03", "s04", "s05", "s06", "s07", "s08", "e01", "e02", "e03", "e04"];
  ok("every talking story has its picture prompts: a lineup of its own, a Home card and all twelve pages", ids.every((id) => { const s = P.stories.find((x) => x.id === id); return s && s.talk === true && JSON.stringify(s.lineups) === JSON.stringify([id]) && s.home && parts.every((p) => s.scenes[p] && s.scenes[p].picture); }), ids);
  const drawn = ids.filter((id) => existsSync(path.join(ROOT, "assets/adventure", id, "s01.webp")));
  ok("a story whose pictures are drawn has all twelve and its Home card", drawn.every((id) => parts.every((p) => existsSync(path.join(ROOT, "assets/adventure", id, p + ".webp"))) && existsSync(path.join(ROOT, "assets/crafted/home-" + TALK.find((t) => t.id === id).hero + ".webp"))), drawn);
  console.log("  (pictures drawn: " + (drawn.length ? drawn.join(", ") : "none yet") + ")");
}

// ── the server and the fake phone ──────────────────────────────────────────
const reqs = [];
const PORTRAIT = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200"><rect width="800" height="1200" fill="#3a4f8a"/><circle cx="400" cy="360" r="160" fill="#ffe7a8"/></svg>';
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2", json: "application/json" };
const stub = (t) => '<!doctype html><meta charset="utf-8"><title>' + t + "</title><body><h1>" + t + "</h1></body>";
function pcm(ms) { const n = Math.round(24000 * ms / 1000), b = Buffer.alloc(n * 2); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 220 / 24000) * 3000), i * 2); return b; }
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x"), p = url.pathname;
  let body = ""; req.on("data", (c) => { body += c; });
  req.on("end", () => {
    reqs.push({ path: p, body });
    if (p === "/__sona") { res.writeHead(200, { "content-type": "text/html" }); res.end('<!doctype html><meta charset="utf-8"><title>S</title><body></body><script src="/sona.js"></script>'); return; }
    if (p === "/today.html" || p === "/subscribe.html" || /^\/arcade-[a-z]+\.html$/.test(p)) { res.writeHead(200, { "content-type": "text/html" }); res.end(stub(p)); return; }
    if (p === "/api/tts") { setTimeout(() => { res.writeHead(200, { "content-type": "application/octet-stream" }); res.end(pcm(300)); }, 20); return; }
    if (p.startsWith("/api/")) { res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); return; }
    if (p === "/assets/adventure/voice/manifest.js") { res.writeHead(404); res.end(); return; }
    if (/^\/assets\/adventure\/[a-z]+\/[se]\d\d\.webp$/.test(p)) { res.writeHead(200, { "content-type": "image/svg+xml" }); res.end(PORTRAIT); return; }
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(file));
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch(launchOpts());

// A set-up child with every era stamp; premium an early adopter.
function seed(c) {
  return `(() => {
    if (localStorage.getItem("__seeded")) return; localStorage.setItem("__seeded", "1");
    try { sessionStorage.setItem("sona.paidui", "1"); sessionStorage.setItem("sona.websalesui", "${c.sell ? 1 : 0}"); } catch (e) {}
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "${c.age || 7}", focusSounds: ${JSON.stringify(c.focus || ["R"])}, onboarded: true, voiceOn: true, volume: 0.8${c.premium === false ? "" : ", earlyAdopter: true"} }));
    localStorage.setItem("sona.freeera.v1", "post");
    ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
    localStorage.setItem("sona.freever.v1", "${c.stamp || "kept"}"); localStorage.setItem("sona.buddyset.v1", "kept"); localStorage.setItem("sona.offerseen.v1", "1");
    ${c.micok === false ? "" : 'localStorage.setItem("sona.micok", "1");'}
    ${c.quest ? `localStorage.setItem("sona.quest.v1", ${JSON.stringify(JSON.stringify(c.quest))});` : ""}
  })();`;
}
// the mic, Web Audio and the browser's voice, faked and logged (booktest's
// fake device): h.voice is the child talking; h.shape the kind of sound
function fakeDevice(cfg) {
  const T0 = performance.now(), now = () => (performance.now() - T0) / 1000;
  const h = window.__q = { now, mics: [], sounds: [], sfx: [], confetti: [], requests: 0, voice: false, shape: cfg.shape || "low", hidden: false, speaking: 0 };
  h.micOn = () => h.mics.filter((m) => m.end == null).length;
  h.playingNow = () => { const t = now(); return h.speaking > 0 || h.sounds.some((s) => s.start <= t && t < s.end); };
  Object.defineProperty(document, "hidden", { configurable: true, get: () => h.hidden });
  Object.defineProperty(navigator, "permissions", { configurable: true, value: { query: () => Promise.resolve({ state: cfg.permission || "granted" }) } });
  navigator.mediaDevices.getUserMedia = () => {
    h.requests++;
    if (cfg.micMode === "deny") return Promise.reject(new DOMException("Denied", "NotAllowedError"));
    const rec = { start: now(), end: null }; h.mics.push(rec);
    const track = { kind: "audio", readyState: "live", stop() { if (this.readyState !== "ended") { this.readyState = "ended"; rec.end = now(); } } };
    return Promise.resolve({ getTracks: () => [track], getAudioTracks: () => [track] });
  };
  function param(v) { const p = { _v: v }; p.setValueAtTime = p.linearRampToValueAtTime = p.exponentialRampToValueAtTime = p.setTargetAtTime = p.cancelScheduledValues = () => {}; Object.defineProperty(p, "value", { get: () => p._v, set: (x) => { p._v = x; } }); return p; }
  function AC() { this.state = "running"; this.sampleRate = 48000; this.destination = {}; }
  Object.defineProperty(AC.prototype, "currentTime", { get: now });
  AC.prototype.resume = function () { this.state = "running"; return Promise.resolve(); };
  AC.prototype.createGain = function () { return { gain: param(1), connect() {}, disconnect() {} }; };
  AC.prototype.createOscillator = function () {
    const o = { type: "sine", frequency: param(440), connect() {}, disconnect() {}, start(t) { o.rec = { kind: "osc", start: Math.max(now(), t || 0), end: Infinity }; h.sounds.push(o.rec); }, stop(t) { if (o.rec) o.rec.end = Math.min(o.rec.end, t == null || t < now() ? now() : t); } };
    return o;
  };
  AC.prototype.createBuffer = function (c, n, sr) { sr = sr || this.sampleRate; const data = new Float32Array(n); return { length: n, sampleRate: sr, duration: n / sr, numberOfChannels: c, getChannelData: () => data }; };
  AC.prototype.createBufferSource = function () {
    const s = { buffer: null, playbackRate: param(1), connect() {}, disconnect() {}, onended: null,
      start(t) { if (!s.buffer || s.buffer.length <= 1) return; s.rec = { kind: "buf", start: Math.max(now(), t || 0) }; s.rec.end = s.rec.start + s.buffer.duration; h.sounds.push(s.rec); s.timer = setTimeout(() => { if (s.onended) s.onended(); }, (s.rec.end - now()) * 1000); },
      stop() { if (s.rec) s.rec.end = Math.min(s.rec.end, now()); clearTimeout(s.timer); if (s.onended) s.onended(); } };
    return s;
  };
  AC.prototype.decodeAudioData = function (b, ok) { const buf = this.createBuffer(1, 4800, 24000); if (ok) ok(buf); return Promise.resolve(buf); };
  AC.prototype.createMediaStreamSource = function (stream) { return { stream, on: false, connect(an) { an.src = this; this.on = true; }, disconnect() { this.on = false; } }; };
  AC.prototype.createAnalyser = function () {
    const an = { fftSize: 2048, src: null, connect() {}, disconnect() {} };
    Object.defineProperty(an, "frequencyBinCount", { get: () => an.fftSize / 2 });
    an.hears = () => { if (!an.src || !an.src.on) return false; const tr = an.src.stream.getTracks()[0]; return tr.readyState === "live" && (h.voice || h.playingNow()); };
    an.getByteTimeDomainData = (d) => { const v = an.hears(); for (let i = 0; i < d.length; i++) d[i] = v ? (i % 2 ? 200 : 56) : 128; };
    an.getByteFrequencyData = (d) => { const v = an.hears(); d.fill(0); if (!v) return; if (h.shape === "hiss") { for (let i = 40; i <= 120 && i < d.length; i++) d[i] = 220; } else { for (let i = 1; i <= 10 && i < d.length; i++) d[i] = 220; } };
    return an;
  };
  window.AudioContext = window.webkitAudioContext = AC;
  HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speak(u) { const rec = { kind: "speech", start: now(), end: Infinity }; h.sounds.push(rec); h.speaking++; setTimeout(() => { rec.end = now(); h.speaking--; u.onend && u.onend(); }, 300); }, cancel() {}, getVoices: () => [] } });
  let sona;
  Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set(v) {
    sona = v; v.confetti = () => { h.confetti.push({ at: now(), live: h.micOn() }); };
    Object.keys(v.sfx || {}).forEach((k) => { const real = v.sfx[k]; if (typeof real !== "function" || k === "stop") return; v.sfx[k] = function () { h.sfx.push({ name: k, at: now(), live: h.micOn() }); return real.apply(this, arguments); }; });
  } });
}
async function open(c = {}, { url = "/adventure.html", size = { width: 390, height: 844 }, rm = true } = {}) {
  const ctx = await browser.newContext({ viewport: size, reducedMotion: rm ? "reduce" : "no-preference" });
  await ctx.addInitScript(seed(c));
  await ctx.addInitScript(fakeDevice, c);
  const pg = await ctx.newPage(); const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
  const from = reqs.length;
  await pg.goto(origin + url);
  await pg.waitForFunction(() => window.__adventure || location.pathname !== "/adventure.html", null, { timeout: 8000 }).catch(() => {});
  return { ctx, pg, errors, from };
}
const st = (pg) => pg.evaluate(() => window.__adventure);
const until = (pg, fn, ms = 9000, arg) => pg.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const live = (pg, ms) => until(pg, () => window.__adventure && __adventure.bar === "live" && __q.micOn() === 1, ms);
async function talk(pg, ms = 260) { await pg.evaluate(() => { __q.voice = true; }); await pg.waitForTimeout(ms); await pg.evaluate(() => { __q.voice = false; }); }
// says the page's word three times, each when the mic is listening
async function sayAll(pg) { for (let i = 0; i < 3; i++) { if (!(await live(pg))) return false; await talk(pg); } return true; }
const click = (pg, id) => pg.evaluate((i) => document.getElementById(i).click(), id);
const quest = (pg) => pg.evaluate(() => JSON.parse(localStorage.getItem("sona.quest.v1") || "null"));
function overlaps(l) { const bad = []; for (const s of l.sounds) for (const m of l.mics) { const me = m.end == null ? 1e9 : m.end; if (s.start < me && m.start < s.end) bad.push({ kind: s.kind, at: +s.start.toFixed(2) }); } return bad; }
const log = (pg) => pg.evaluate(() => ({ mics: __q.mics.slice(), sounds: __q.sounds.slice(), sfx: __q.sfx.slice(), confetti: __q.confetti.slice() }));

// ── 2. Day 1's slot ────────────────────────────────────────────────────────
await section("Day 1's slot", async () => {
  const probe = async (c) => { const o = await open(c, { url: "/__sona" }); await o.pg.waitForFunction(() => window.Sona); const r = await o.pg.evaluate(() => { const q = Sona.questToday(); return { q: { kind: q.kind, state: q.state, day: q.day, game: q.game, id: q.story && q.story.id, talk: !!(q.story && q.story.talk), pic: q.story && q.story.pic }, access: Sona.gameAccess("robo").allowed, day: Sona.storyDay("robo"), lh: Sona.storyDay("lighthouse") }; }); await o.ctx.close(); return r; };
  const r = await probe({ focus: ["R"] });
  ok("a child on R, Day 1 not finished: today's adventure is the R talking story, Day 1, its own game key", r.q.kind === "story" && r.q.state === "open" && r.q.day === 1 && r.q.id === "robo" && r.q.talk && r.q.game === "robo" && r.q.pic === "/assets/crafted/home-robo.webp", r.q);
  ok("…the story opens by the story's rule (Premium: open), and storyDay finds it; the lighthouse is no day for this child", r.access === true && r.day && r.day.day === 1 && r.day.talk === true && r.lh === null, r);
  const k = await probe({ focus: ["K"] });
  ok("a child on a sound with no talking story (K): Day 1 is the lighthouse, as before", k.q.id === "lighthouse" && !k.q.talk && k.day === null, k.q);
  const hw = await probe({ focus: ["K", "R"] });
  ok("…a child on K then R: the first of their sounds that has a talking story (R)", hw.q.id === "robo", hw.q);
  const done = await probe({ focus: ["R"], quest: { f: [0], s: 1, ls: 0, lk: "story", done: "2026-10-01", fd: "2026-10-01", a: "2026-09-30", sv: "2026-09-30" } });
  ok("a lighthouse finished before this build stays the lighthouse: Day 1 done, the R story is no day here", done.q.id !== "robo" && done.lh && done.lh.day === 1 && done.day === null, done);
  const locked = await probe({ focus: ["R"], premium: false, stamp: "post" });
  ok("no Premium: the story's own key is closed like every story", locked.access === false, locked);
});

// ── 3. the player ──────────────────────────────────────────────────────────
await section("one page, three sayings", async () => {
  const { ctx, pg, errors } = await open({ focus: ["R"] }, { rm: false });
  try {
    const s0 = await st(pg);
    ok("the website opens the story on its card (Day 1, its title)", s0 && s0.view === "start" && s0.talk === true && s0.id === "robo" && s0.total === 8, s0);
    await click(pg, "startBtn");
    ok("Tap to start: page 1, Echo reads it, then asks for its word, and the mic listens", await live(pg), await st(pg));
    let s = await st(pg);
    const html = await pg.evaluate(() => ({ cap: document.getElementById("capText").innerHTML, ask: document.getElementById("capAsk").textContent, next: document.getElementById("nextBtn").hidden, mic: document.getElementById("micBtn").hidden }));
    ok("…the key word lights up in the line, only its sound's letters orange; the bubble asks for it, the mic in Next's place", s.word === "red" && /<span class="advkw"><b class="snd">r<\/b>ed<\/span>/.test(html.cap) && /Can you say red\?/.test(html.ask) && html.next && !html.mic, html);
    const reps0 = await pg.evaluate(() => Sona.dayReps ? Sona.dayReps() : 0);
    await talk(pg);
    await pg.waitForTimeout(250);
    s = await st(pg);
    ok("the first saying: one dot, \"2 more times!\", still on page 1, nothing played over the mic", s.idx === 0 && s.said === 1 && s.view === "scene", s);
    ok("…and the mic listens again by itself", await live(pg));
    await talk(pg); await live(pg); await talk(pg);
    ok("the third: \"I heard you!\", the chime and confetti once the mic is closed, then page 2", await until(pg, () => __adventure.idx === 1), await st(pg));
    const l = await log(pg);
    ok("…the chime and the confetti came with no mic open", l.sfx.filter((x) => x.name === "correct").length === 1 && l.sfx.every((x) => x.live === 0) && l.confetti.length === 1 && l.confetti[0].live === 0, { sfx: l.sfx, confetti: l.confetti });
    ok("…nothing ever played while a mic was open", overlaps(l).length === 0, overlaps(l));
    const reps1 = await pg.evaluate(() => Sona.dayReps ? Sona.dayReps() : 0);
    ok("each saying heard is one rep toward the daily goal (three for the page)", reps1 - reps0 === 3, { reps0, reps1 });
    ok("no page errors", errors.length === 0, errors);
  } finally { await ctx.close(); }
});

await section("silence and the other kind of sound", async () => {
  const { ctx, pg, errors } = await open({ focus: ["R"] });
  try {
    await click(pg, "startBtn");
    await live(pg);
    await pg.waitForTimeout(12800);
    let s = await st(pg);
    ok("twelve quiet seconds: the mic closes and waits for a tap; the page does not turn", s.idx === 0 && s.bar === "nudge" && (await pg.evaluate(() => __q.micOn())) === 0, s);
    await click(pg, "micBtn");
    ok("…a tap on the mic only listens again", await live(pg), await st(pg));
    await pg.evaluate(() => { __q.shape = "hiss"; });
    for (let i = 0; i < 3; i++) { await live(pg); await talk(pg, 300); await pg.waitForTimeout(500); }
    ok("three tries of the other kind: Echo says something kind and the page turns anyway", await until(pg, () => __adventure.idx === 1, 6000), await st(pg));
    ok("no page errors", errors.length === 0, errors);
  } finally { await ctx.close(); }
});

await section("a grown-up's yes, and Not now", async () => {
  const { ctx, pg, errors } = await open({ focus: ["R"], micok: false, permission: "prompt" });
  try {
    await click(pg, "startBtn");
    ok("no mic yet: the grown-ups' question comes up inside the story, and the phone is not asked", await until(pg, () => __adventure.primer === true) && (await pg.evaluate(() => __q.requests)) === 0, await st(pg));
    await click(pg, "micNo");
    let s = await st(pg);
    const next = await pg.evaluate(() => !document.getElementById("nextBtn").hidden);
    ok("Not now: the story reads on with Next for the rest of the visit", s.micOff === true && s.bar === "next" && next, s);
    await pg.waitForTimeout(700);
    await pg.mouse.click(195, 300);
    await pg.waitForTimeout(200);
    ok("…a tap on the picture never turns a talking page", (await st(pg)).idx === 0);
    await click(pg, "nextBtn");
    ok("…Next does", await until(pg, () => __adventure.idx === 1, 3000));
    ok("no page errors", errors.length === 0, errors);
  } finally { await ctx.close(); }
});

await section("to the end of the intro, the ending and the sticker", async () => {
  const { ctx, pg, errors } = await open({ focus: ["R"] });
  try {
    await click(pg, "startBtn");
    await live(pg);
    // the grown-ups' Skip turns one page with no word said
    for (let i = 0; i < 7; i++) { await pg.waitForTimeout(650); await click(pg, "skipBtn"); await until(pg, (n) => __adventure.idx === n, 3000, i + 1); }
    let s = await st(pg);
    ok("Skip turns one page at a time to the intro's last (no \"Let's go!\" on a talking story)", s.idx === 7 && s.mode === "intro" && (await pg.evaluate(() => document.getElementById("goBtn").hidden)), s);
    const before = await quest(pg);
    ok("…and the day is not finished yet", !(before && Array.isArray(before.f) && before.f.includes(0)), before);
    ok("the last word, three times", await sayAll(pg));
    ok("…finishes the day (Day 1 done, the R story kept as Day 1) and the ending plays straight on", await until(pg, () => __adventure.mode === "end" && __adventure.view === "scene" && __adventure.idx === 0, 6000), await st(pg));
    const q = await quest(pg);
    ok("…the record: Day 1 finished as robo, one sticker given", q && q.f.includes(0) && q.t1 === "robo" && q.lk === "story" && Array.isArray(q.got) && q.got.length === 1, q);
    await live(pg);
    s = await st(pg);
    ok("the ending asks its words too", s.total === 4 && s.word === "rainbow", s);
    for (let i = 0; i < 3; i++) { await pg.waitForTimeout(650); await click(pg, "skipBtn"); await until(pg, (n) => __adventure.idx === n, 3000, i + 1); }
    ok("…its last word", await sayAll(pg));
    ok("…opens the sticker card: the sticker the day gave, and the story waiting on Home", await until(pg, () => __adventure.view === "stickers", 5000), await st(pg));
    const card = await pg.evaluate(() => ({ got: document.getElementById("gotList").textContent, found: document.getElementById("foundText").textContent, shown: !document.getElementById("foundLine").hidden }));
    ok("…\"You got …!\" and \"On Home to read again: Robo's Rocket!\"", /You got /.test(card.got) && card.shown && card.found === "On Home to read again: Robo's Rocket!", card);
    const found = await pg.evaluate(() => Sona.storyFound().map((d) => ({ id: d.id, again: d.again })));
    ok("Home's row has it, its address the replay", found.length === 1 && found[0].id === "robo" && found[0].again === "/adventure.html?again=1&story=robo", found);
    ok("nothing ever played while a mic was open", overlaps(await log(pg)).length === 0, overlaps(await log(pg)));
    ok("no page errors", errors.length === 0, errors);
  } finally { await ctx.close(); }
});

await section("the replay", async () => {
  const doneQ = { f: [0], s: 1, ls: 0, lk: "story", t1: "robo", done: "2026-10-01", fd: "2026-10-01", a: "2026-09-30", sv: "2026-09-30", got: [] };
  let o = await open({ focus: ["R"], quest: doneQ }, { url: "/adventure.html?again=1&story=robo" });
  try {
    const s = await st(o.pg);
    ok("a finished talking story opens again from Home's row: the whole story, intro and ending", s && s.mode === "again" && s.total === 12, s);
    await click(o.pg, "startBtn");
    for (let i = 0; i < 11; i++) { await o.pg.waitForTimeout(650); await click(o.pg, "skipBtn"); await until(o.pg, (n) => __adventure.idx === n, 3000, i + 1); }
    await sayAll(o.pg);
    ok("…its last word ends on the card, with no sticker and nothing finished", await until(o.pg, () => __adventure.view === "stickers", 5000) && (await o.pg.evaluate(() => document.getElementById("gotList").hidden && document.getElementById("foundLine").hidden)));
    const q = await quest(o.pg);
    ok("…the record is as it was", JSON.stringify(q.f) === "[0]" && q.done === "2026-10-01", q);
    ok("no page errors", o.errors.length === 0, o.errors);
  } finally { await o.ctx.close(); }
  o = await open({ focus: ["R"] }, { url: "/adventure.html?again=1&story=robo" });
  try { ok("…a story not finished yet has no replay: Home", new URL(o.pg.url()).pathname === "/today.html"); } finally { await o.ctx.close(); }
  o = await open({ focus: ["R"], premium: false, stamp: "post", sell: true });
  try { ok("no Premium: the player goes Home before any picture or sound", new URL(o.pg.url()).pathname === "/today.html" && (await o.pg.evaluate(() => (window.__q ? __q.requests : 0))) === 0); } finally { await o.ctx.close(); }
});

await section("ages 3-4, and the smallest phone", async () => {
  const { ctx, pg, errors } = await open({ focus: ["R"], age: 4 }, { size: { width: 320, height: 568 } });
  try {
    const s = await st(pg);
    ok("a child of 4 reads the short run (6 pages)", s.little === true && s.total === 6, s);
    await click(pg, "startBtn");
    await live(pg);
    const fit = await pg.evaluate(() => {
      const r = (id) => document.getElementById(id).getBoundingClientRect();
      const ask = r("capAsk"), mic = r("micBtn"), card = document.querySelector(".advcard").getBoundingClientRect();
      return { ask: [ask.top, ask.bottom, ask.left, ask.right], mic: [mic.top, mic.bottom], card: [card.top, card.bottom], w: innerWidth, h: innerHeight, sx: document.documentElement.scrollWidth };
    });
    ok("on a 320x568 phone the ask, the card and the mic are all on the screen, with no sideways scroll", fit.ask[0] >= 0 && fit.ask[3] <= fit.w && fit.mic[1] <= fit.h && fit.card[1] <= fit.h && fit.sx <= fit.w, fit);
    ok("no page errors", errors.length === 0, errors);
  } finally { await ctx.close(); }
});

await browser.close(); server.close();
console.log(fails ? `${fails} FAILED of ${count}` : `ALL GREEN (${count})`);
process.exit(fails ? 1 : 0);
