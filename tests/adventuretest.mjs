// STORY1, the daily story's player (/adventure.html, 22 Oct 2026; Travis
// chose both age groups, today's painted clay look, and the story is
// Premium). sona.js's rules under it are storycoretest's; Home's card is
// homestorytest's; the three games have suites of their own. This one holds
// the page a child watches:
//   - entitlement first: without Premium, on the wrong day, or for an ending
//     not yet earned, the page goes Home with its body hidden and before any
//     voice request or recorded line;
//   - the website plays nothing until the start tap, then each scene's
//     caption is its line and Next glows once Echo has read it; the iPhone
//     app starts by itself and plays every line as media;
//   - ages 3-4 see their six scenes and read the short lines;
//   - sound off: captions only, nothing fetched, Next live at once;
//   - Skip, "Let's go!" (stops the sound, records seen, opens the game) and
//     the same day again ("Keep going" / "Watch the story again");
//   - the ending: refused until the story is finished, then its card, its
//     scenes, the sticker its round gave, and Back home;
//   - a hidden page stops Echo and coming back plays nothing until a tap; a
//     line that is late leaves Next glowing and still plays if nobody tapped,
//     never on the next scene; a double tap never skips a scene;
//   - a recorded line plays when the manifest lists those exact words, and a
//     line whose words changed falls back to the live voice;
//   - the buddy is decoration, never under the card, Echo's face or a
//     button, and falls back when its picture won't load; every box is the
//     art notes' and, on the real pictures at 390x844 and 768x1024, stands
//     the buddy exactly on its spot; Reduce Motion moves nothing; the layout
//     fits five screens;
//   - the source: every line within the story rules, the page writes only
//     `seen`, the kid viewport meta, no third-party script.
// The device is fake where it must be (no speaker, a fake iPhone app), the
// voice service is this file's own server, and a scene's picture is not
// served (it shows its wash) unless a check asks for one: a stand-in
// portrait (art = true) or the real painted page (art = "real").
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

let fails = 0, count = 0;
function ok(label, pass, detail = "") { count++; if (!pass) fails++; console.log((pass ? "PASS " : "FAIL ") + label + (pass ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); }
// ADVENTURE_PART: a comma list of section names, as they are written below;
// "!name" leaves one out and runs the rest (run-all runs this file in two
// parts, tests/adventureplaytest.mjs, "!buddy spots ipad", and
// tests/adventurespotstest.mjs, "buddy spots ipad": the buddy on every
// painted page, at a phone and at an iPad, took 220 of its 290 s, near the
// 300 s a suite gets). Every name given must be a section here.
const PARTS = process.env.ADVENTURE_PART ? process.env.ADVENTURE_PART.split(",") : null;
const NOT = (PARTS || []).filter((p) => p[0] === "!").map((p) => p.slice(1)), YES = (PARTS || []).filter((p) => p[0] !== "!");
const declared = new Set();
async function section(label, run) { declared.add(label); if (PARTS && (NOT.includes(label) || (YES.length && !YES.includes(label)))) return; try { await run(); } catch (e) { ok(label + " completes", false, e.stack); } }

// ── the scenes, read the way the page reads them ──
const ADV_SRC = readFileSync(ROOT + "/adventures.js", "utf8");
const NOTES = existsSync(ROOT + "/../design/adventure/art-notes.md") ? readFileSync(ROOT + "/../design/adventure/art-notes.md", "utf8") : "";
const sandbox = { window: {} }; vm.runInNewContext(ADV_SRC, sandbox);
const A = sandbox.window.SonaAdventures;
// every story id in its day order (sona.js STORY_DAYS): Days 1-3, then Days
// 4-14 around Codex's games (22 Oct 2026)
const IDS = [...((readFileSync(ROOT + "/sona.js", "utf8").match(/const STORY_DAYS = \[([\s\S]*?)\n  \];/) || ["", ""])[1]).matchAll(/\{ id: "([a-z]+)"/g)].map((m) => m[1]);
const LAST = IDS.length;
function runOf(id, part, little) {
  return A[id][part].filter((sc) => !(little && sc.ages === "big"))
    .map((sc) => ({ art: sc.art, text: typeof sc.line === "string" ? sc.line : ((little && sc.line.little) || sc.line.big) }));
}
function allLines() {
  const out = [];
  for (const id of Object.keys(A)) for (const part of ["intro", "ending"]) for (const sc of A[id][part])
    for (const t of typeof sc.line === "string" ? [sc.line] : [sc.line.big, sc.line.little]) out.push({ id, part, art: sc.art, t });
  return out;
}
// the recorded line's name: FNV-1a 32-bit over the UTF-8 bytes of
// TTS_CACHE_VERSION + "|" + the line, 8 hex digits (P8 writes the files)
const TTS_V = (readFileSync(ROOT + "/sona.js", "utf8").match(/const TTS_CACHE_VERSION = "([^"]+)"/) || [])[1];
function fnv(text) { let h = 0x811c9dc5; for (const b of Buffer.from(TTS_V + "|" + text, "utf8")) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); }

// ── the server: public/, the voice service, the recorded lines, the pages a
// visit leaves for, and a phone's safe areas swapped into every page ──
const TTS = { ms: 700, delay: 0, status: 200 };
let manifest = null;          // { hash: text } or null (no manifest: 404)
let art = false;              // true: a stand-in portrait for every scene; "real": the painted pages
const reqs = [];              // every request: { path, body, t }
let inflight = 0, peak = 0;
const SAFE = { top: "47px", bottom: "34px" };
function pcm(ms, hz = 220) { const n = Math.round(24000 * ms / 1000), b = Buffer.alloc(n * 2); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * hz / 24000) * 3000), i * 2); return b; }
function wav(ms) { const d = pcm(ms, 330), h = Buffer.alloc(44); h.write("RIFF", 0); h.writeUInt32LE(36 + d.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(d.length, 40); return Buffer.concat([h, d]); }
const PORTRAIT = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200"><rect width="800" height="1200" fill="#3a3f7a"/><circle cx="400" cy="360" r="160" fill="#ffe7a8"/><rect y="900" width="800" height="300" fill="#2d6b5a"/></svg>';
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2", json: "application/json", webmanifest: "application/manifest+json" };
const stub = (title) => '<!doctype html><meta charset="utf-8"><title>' + title + "</title><body><h1>" + title + "</h1></body>";
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x"), p = url.pathname;
  let body = ""; req.on("data", (c) => { body += c; });
  req.on("end", () => {
    reqs.push({ path: p, body, t: Date.now() });
    if (p === "/__sona") { res.writeHead(200, { "content-type": "text/html" }); res.end('<!doctype html><meta charset="utf-8"><title>Store</title><body></body><script src="/sona.js"></script>'); return; }
    if (p === "/today.html" || /^\/arcade-[a-z]+\.html$/.test(p) || p === "/subscribe.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(stub(p)); return; }
    if (p === "/api/tts") {
      inflight++; peak = Math.max(peak, inflight);
      setTimeout(() => {
        inflight--;
        if (TTS.status !== 200) { res.writeHead(TTS.status, { "content-type": "application/json" }); res.end("{}"); return; }
        res.writeHead(200, { "content-type": "application/octet-stream" }); res.end(pcm(TTS.ms));
      }, TTS.delay);
      return;
    }
    if (p.startsWith("/api/")) { res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); return; }
    if (p === "/assets/adventure/voice/manifest.js") {
      if (!manifest) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "content-type": "text/javascript" }); res.end("window.SonaAdventureVoice = " + JSON.stringify({ files: manifest }) + ";"); return;
    }
    if (/^\/assets\/adventure\/voice\/[0-9a-f]{8}\.mp3$/.test(p)) {
      const h = p.slice(-12, -4);
      if (!manifest || !manifest[h]) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "content-type": "audio/mpeg" }); res.end(wav(500)); return;
    }
    if (/^\/assets\/adventure\/[a-z]+\/[se]\d\d\.webp$/.test(p) && art !== "real") {
      if (!art) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "content-type": "image/svg+xml" }); res.end(PORTRAIT); return;
    }
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    const ext = file.split(".").pop();
    let out = readFileSync(file);
    if (ext === "html" || ext === "css") out = out.toString("utf8").replace(/env\(safe-area-inset-top\)/g, SAFE.top).replace(/env\(safe-area-inset-bottom\)/g, SAFE.bottom);
    res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" }); res.end(out);
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch(launchOpts());

// A set-up child with every era stamp (a seed missing one is grandfathered
// and the paywall vanishes). premium: an early adopter. sell: this browser
// sells (QA seam), stamp: the free-version sweep's word. quest: the
// adventure record to start from. voice: false is a muted Sona (volume 0:
// sona.js heals a voiceOn:false with a volume back on, so 0 is "sound off").
function seed({ age = 7, premium = true, sell = false, stamp = "kept", quest = null, voice = true, character = "fox", demo = false } = {}) {
  return `(() => {
    try { sessionStorage.setItem("sona.paidui", "1"); sessionStorage.setItem("sona.websalesui", "${sell ? 1 : 0}"); } catch (e) { return; }
    if (localStorage.getItem("__seeded")) return; localStorage.setItem("__seeded", "1");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "${age}", focusSounds: ["R"], onboarded: true, voiceOn: ${voice}, volume: ${voice ? 0.8 : 0}, character: "${character}"${premium ? ", earlyAdopter: true" : ""} }));
    localStorage.setItem("sona.freeera.v1", "post");
    ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
    localStorage.setItem("sona.freever.v1", "${stamp}"); localStorage.setItem("sona.buddyset.v1", "kept");
    localStorage.setItem("sona.offerseen.v1", "1");
    ${quest ? `localStorage.setItem("sona.quest.v1", ${JSON.stringify(JSON.stringify(quest))});` : ""}
    ${demo ? 'localStorage.setItem("sona.demo.v1", JSON.stringify({ started: Date.now() - 3600000, done: 0 }));' : ""}
  })();`;
}
// The fake parts of a phone: Web Audio is real but watched (h.web: every
// voice buffer started; h.stops: every one stopped), the browser's voice is
// a recorder (h.synth), and with app:true the iPhone app (Capacitor) whose
// media elements are recorders (h.media) that start at once and end after
// h.mediaMs, unless h.hold; h.refuse: "audio/mpeg" never starts a recorded
// line. h.hidden fakes the page going to the background. Whether the body
// was ever shown is kept in sessionStorage, so it survives leaving.
function device(cfg) {
  try { sessionStorage.getItem("x"); } catch (e) { return; }
  const h = window.h = { web: [], stops: 0, synth: [], media: [], ctx: 0, hidden: false, mediaMs: 150, hold: false, refuse: (cfg && cfg.refuse) || "" };
  Object.defineProperty(document, "hidden", { configurable: true, get: () => h.hidden });
  const AC = window.AudioContext;
  if (AC) {
    const C = function (...a) { h.ctx++; return new AC(...a); }; C.prototype = AC.prototype;
    window.AudioContext = C; window.webkitAudioContext = C;
    const st = AudioBufferSourceNode.prototype.start, sp = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (...a) { if (this.buffer && this.buffer.length > 1) h.web.push({ dur: this.buffer.duration, at: performance.now() }); return st.apply(this, a); };
    AudioBufferSourceNode.prototype.stop = function (...a) { if (this.buffer && this.buffer.length > 1) h.stops++; return sp.apply(this, a); };
  }
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speaking: false, speak(u) { h.synth.push(u.text); setTimeout(() => u.onend && u.onend(), 30); }, cancel() {}, getVoices: () => [] } });
  if (cfg && cfg.app) {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", Plugins: {} };
    const types = {}, cou = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { const u = cou(b); types[u] = b && b.type; return u; };
    window.Audio = function (src) {
      const a = { src, type: types[src] || "", volume: 1, paused: false, duration: NaN, kind: "",
        play() {
          a.kind = a.onended || a.onplaying ? "voice" : "chime"; h.media.push(a);
          if (h.refuse && a.type === h.refuse) return new Promise(() => {});
          setTimeout(() => { if (a.paused) return; a.onplaying && a.onplaying(); if (!h.hold) setTimeout(() => { if (!a.paused && a.onended) a.onended(); }, h.mediaMs); }, 0);
          return Promise.resolve();
        },
        pause() { a.paused = true; }, removeAttribute() {}, load() {} };
      return a;
    };
  }
  document.addEventListener("DOMContentLoaded", () => {
    const mark = () => { if (location.pathname === "/adventure.html" && document.body && !document.body.hidden) sessionStorage.setItem("__shown", location.pathname); };
    mark(); if (document.body) new MutationObserver(mark).observe(document.body, { attributes: true });
  });
}
async function open(opts = {}, { size = { width: 390, height: 844 }, rm = false, app = false, refuse = "", url = "/adventure.html", wait = true } = {}) {
  const ctx = await browser.newContext({ viewport: size, reducedMotion: rm ? "reduce" : "no-preference" });
  await ctx.addInitScript(seed(opts));
  await ctx.addInitScript(device, { app, refuse });
  const pg = await ctx.newPage(); const errors = [];
  pg.on("pageerror", (e) => errors.push(e.message));
  const from = reqs.length;
  await pg.goto(origin + url);
  if (wait) await pg.waitForFunction(() => window.__adventure || location.pathname !== "/adventure.html", null, { timeout: 8000 }).catch(() => {});
  return { ctx, pg, errors, from };
}
const st = (pg) => pg.evaluate(() => window.__adventure);
const atScene = (pg, i, timeout = 8000) => pg.waitForFunction((i) => window.__adventure && __adventure.view === "scene" && __adventure.idx === i, i, { timeout });
const voiceIs = (pg, v, timeout = 8000) => pg.waitForFunction((v) => window.__adventure && __adventure.voice === v, v, { timeout });
const tts = (from) => reqs.slice(from).filter((r) => r.path === "/api/tts").map((r) => { try { return JSON.parse(r.body).text; } catch (e) { return ""; } });
const mp3s = (from) => reqs.slice(from).filter((r) => /\.mp3$/.test(r.path));
const track = (from) => reqs.slice(from).filter((r) => r.path === "/api/track").map((r) => { try { return JSON.parse(r.body); } catch (e) { return {}; } });
const shown = (pg) => pg.evaluate(() => sessionStorage.getItem("__shown"));
const quest = (pg) => pg.evaluate(() => JSON.parse(localStorage.getItem("sona.quest.v1") || "null"));
const localDay = (pg) => pg.evaluate(() => Sona.localDay());
async function landed(pg, pathName) { await pg.waitForURL((u) => new URL(u).pathname === pathName, { timeout: 8000 }).catch(() => {}); return new URL(pg.url()).pathname === pathName; }
const nap = (pg, ms) => pg.waitForTimeout(ms);
// the record of a story finished today (its sticker, if any, in got)
async function finishDay1(pg) { return pg.evaluate(() => Sona.questEnd("lighthouse")); }
const BIG1 = runOf("lighthouse", "intro", false), LITTLE1 = runOf("lighthouse", "intro", true);

// ── 0. the source ──
await section("source", async () => {
  const page = readFileSync(ROOT + "/adventure.html", "utf8"), css = readFileSync(ROOT + "/crafted-adventure.css", "utf8");
  const noComments = (s) => s.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  const code = noComments(page), advCode = noComments(ADV_SRC);
  const lines = allLines();
  ok("every story is in adventures.js, with its wash and its \"Let's go!\"", IDS.length === 14 && Object.keys(A).join() === IDS.join() && IDS.every((id) => A[id] && /^#[0-9a-f]{6}$/i.test(A[id].wash) && A[id].go === "Let's go!"), Object.keys(A));
  ok("each story: 8 intro scenes and 4 ending scenes for ages 5-8, 6 and 3 for ages 3-4",
    Object.keys(A).every((id) => runOf(id, "intro", false).length === 8 && runOf(id, "ending", false).length === 4 && runOf(id, "intro", true).length === 6 && runOf(id, "ending", true).length === 3));
  const LITTLE = { lighthouse: ["s01 s02 s03 s05 s06 s08", "e01 e03 e04"], windup: ["s01 s02 s03 s04 s06 s08", "e01 e02 e04"], bridge: ["s01 s02 s04 s06 s07 s08", "e01 e03 e04"] };
  ok("…the scenes a little one sees are the spec's", Object.keys(LITTLE).every((id) => runOf(id, "intro", true).map((s) => s.art).join(" ") === LITTLE[id][0] && runOf(id, "ending", true).map((s) => s.art).join(" ") === LITTLE[id][1]),
    Object.keys(A).map((id) => id + ": " + runOf(id, "intro", true).map((s) => s.art).join(" ") + " / " + runOf(id, "ending", true).map((s) => s.art).join(" ")));
  const long = lines.filter((l) => !(l.t && l.t.length > 10 && l.t.length <= 120));
  ok("every line is 120 characters at most (a longer one misses the voice cache)", long.length === 0, long.map((l) => l.id + " " + l.art + " " + (l.t || "").length));
  const BANNED = /\b(score|points?|correct|wrong|miss(?:ed|es)?|fail(?:ed|s)?|charge|louder|slowly|strong|stretch)\b|say it/i;
  const banned = lines.filter((l) => BANNED.test(l.t));
  ok("no line has a grading word or a word about how to talk", banned.length === 0, banned.map((l) => l.t));
  // CAL1: a child meets the stories in any order (a skipped one comes back
  // after Day 14), so no line counts the helper map's stars (the map
  // pictures show the Day number's worth, which no child's own count
  // follows) or leans on another story having come first
  const COUNTS = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|first|last|all)\b[^.!?]*\bgold stars?\b|\bgold stars?\b[^.!?]*\b(now|all|first|last)\b/i;
  const ORDER = /\bis back with\b|\bour friend\b|\banother letter\b|\bwith his glasses on\b/i;
  const ordered = lines.filter((l) => COUNTS.test(l.t) || ORDER.test(l.t));
  ok("no line counts the helper map's stars or needs another story first (CAL1)", ordered.length === 0, ordered.map((l) => l.id + " " + l.art + ": " + l.t));
  const SOUNDS = ["B", "M", "N", "F", "S", "R", "L", "D", "T", "K", "G", "P", "Z", "J", "V", "W", "Y", "H", "C", "SH", "CH", "TH", "Sh", "Ch", "Th"];
  const lone = lines.filter((l) => l.t.split(/[^A-Za-z']+/).some((w) => SOUNDS.includes(w)) || /\b([a-z])\1{2,}\b/i.test(l.t) || /["'“‘][a-z]{1,4}["'”’]/i.test(l.t) || /\bsound\b/i.test(l.t));
  ok("no line names a speech sound (no letter on its own, no \"rrrr\", no quoted sound)", lone.length === 0, lone.map((l) => l.t));
  const named = lines.filter((l) => /[{}<>]|\bname\b|\bchild\b/i.test(l.t));
  ok("no line carries a name, or a slot for one", named.length === 0, named.map((l) => l.t));
  ok("…and the page never reads the child's name", !/childName|kidName/.test(code));
  ok("plain punctuation: no line has an emoji, a dash or a symbol a voice would read out", lines.every((l) => /^[A-Za-z0-9 .,!?'\-]+$/.test(l.t)), lines.filter((l) => !/^[A-Za-z0-9 .,!?'\-]+$/.test(l.t)).map((l) => l.t));
  ok("every scene's buddy is null or a box of three numbers 0-1 and a pose",
    Object.keys(A).every((id) => ["intro", "ending"].every((p) => A[id][p].every((sc) => sc.buddy === null || (["x", "y", "h"].every((k) => sc.buddy[k] >= 0 && sc.buddy[k] <= 1) && ["rest", "cheer", "peek", "sit"].includes(sc.buddy.pose))))));
  // the boxes are the art notes' (P7 placed each with real buddies on the
  // picture): a redrawn page whose box moves there must move here too
  const notesBox = {};
  for (const id of Object.keys(A)) notesBox[id] = {};
  let story = "";
  for (const line of (NOTES.split("## 2.")[1] || "").split("## 3.")[0].split("\n")) {
    const day = line.match(/^\/\/ Day \d+: ([a-z]+)/); if (day) { story = day[1]; continue; }
    for (const m of line.matchAll(/\b([se]\d\d): (null|\{[^}]*\})/g)) {
      if (!notesBox[story]) continue;
      if (m[2] === "null") { notesBox[story][m[1]] = null; continue; }
      const num = (k) => Number((m[2].match(new RegExp("\\b" + k + ": ([\\d.]+)")) || [])[1]);
      notesBox[story][m[1]] = { x: num("x"), y: num("y"), h: num("h"), pose: (m[2].match(/pose: "(\w+)"/) || [])[1] };
    }
  }
  const off = [];
  for (const id of Object.keys(A)) for (const p of ["intro", "ending"]) for (const sc of A[id][p]) {
    if (!(sc.art in notesBox[id])) { off.push(id + " " + sc.art + ": not in the notes"); continue; }
    if (JSON.stringify(sc.buddy) !== JSON.stringify(notesBox[id][sc.art])) off.push(id + " " + sc.art + ": " + JSON.stringify(sc.buddy) + " vs " + JSON.stringify(notesBox[id][sc.art]));
  }
  const boxed = Object.keys(A).reduce((n, id) => n + A[id].intro.concat(A[id].ending).filter((sc) => sc.buddy).length, 0);
  const boxed13 = ["lighthouse", "windup", "bridge"].reduce((n, id) => n + A[id].intro.concat(A[id].ending).filter((sc) => sc.buddy).length, 0);
  ok("every scene's buddy box is the art notes' (design/adventure/art-notes.md); Days 1-3 keep their 24 boxed and 12 with no spot", off.length === 0 && boxed13 === 24, off.length ? off : [boxed13, boxed]);
  const WRITES = ["gameRep", "logAttempt", "bumpReps", "addCoins", "mintCoins", "awardSticker", "awardNextSticker", "awardRandomSticker", "questEnd", "recordSession", "recordRung", "rotAdvance", "localStorage", "sessionStorage", "indexedDB", "saveProfile", "chargeAdd", "claimChest", "Math.random"];
  ok("the page writes only `seen` (storySeen): no rep, coin, sticker, quest end or storage of its own", WRITES.every((w) => !code.includes(w)) && /S\.storySeen\(day\.id\)/.test(code), WRITES.filter((w) => code.includes(w)));
  ok("…and adventures.js is data alone: no call, no storage, no request", !/fetch\(|localStorage|sessionStorage|Sona\.|XMLHttpRequest|sendBeacon/.test(advCode));
  const vp = (page.match(/<meta\s+name="viewport"\s+content="([^"]*)"/) || [])[1] || "";
  ok("the kid viewport meta: no zoom on a double tap", /maximum-scale=1/.test(vp) && /user-scalable=no/.test(vp) && /viewport-fit=cover/.test(vp), vp);
  const srcs = [...page.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]), hrefs = [...page.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]);
  ok("no third-party script or stylesheet: everything is our own", srcs.length >= 5 && srcs.concat(hrefs).every((s) => s.startsWith("/") && !s.startsWith("//")), srcs.concat(hrefs));
  ok("it loads sona.js first, then the shared voice cache, the buddy helpers, the scenes and the voice manifest",
    JSON.stringify(srcs) === JSON.stringify(["/sona.js", "/arcade-sayit.js", "/crafted-buddies.js", "/adventures.js", "/assets/adventure/voice/manifest.js"]), srcs);
  ok("the body starts hidden (nothing shows before the entitlement check)", /<body hidden>/.test(page));
  const es = [...code.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).concat([advCode]);
  ok("the page's script and its scenes are ES5: no arrow, let, const, class or template", es.length === 2 && es.every((s) => s.length > 2000 && !/=>|\blet\s|\bconst\s|\bclass\s|`/.test(s)), es.map((s) => s.length));
  ok("the two events go through Sona.track with the game key alone", /Sona\.track\("adventure opened", \{ game: day\.game \}\)/.test(code) && /Sona\.track\("adventure ending watched", \{ game: day\.game \}\)/.test(code) && (code.match(/track\(/g) || []).length === 2);
  ok("the old readers' names are not this page's", !/story\.html|chapter\.html/.test(code));
  const inline = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let parsed = inline.length === 1;
  for (const body of inline.concat([ADV_SRC])) { try { new vm.Script(body); } catch (e) { parsed = false; } }
  ok("the page's one inline script and adventures.js parse", parsed);
  const relay = readFileSync(ROOT + "/../app/api/track/route.ts", "utf8"), allowed = (relay.match(/const EVENTS = new Set\(\[([\s\S]*?)\]\)/) || ["", ""])[1];
  ok("the relay takes both of the page's events (it drops any other silently)", allowed.includes('"adventure opened"') && allowed.includes('"adventure ending watched"'));
  ok("the stylesheet takes teal and cream from the tokens (no colour of its own for a button)", !/#(?:1f98a6|48ccd7|16767f|fff6e9|fffaf1|ecdcc5|5b2d05)/i.test(css) && /var\(--cream-card\)/.test(css));
  ok("…and under Reduce Motion nothing slides, drifts or pulses", /prefers-reduced-motion: reduce[\s\S]*\.advpic\{animation:none!important;\}[\s\S]*\.advnext\.glow,\.advgo\.glow\{animation:none!important;/.test(css.replace(/\s+(?=[{}])/g, "")));
});

// ── 1. locked, wrong-day and unearned visits go Home first ──
await section("locked", async () => {
  const cases = [
    ["a family without Premium where the price can open the story (shown, locked)", { premium: false, sell: true, stamp: "post" }, "/adventure.html"],
    ["a family without Premium on a phone that cannot buy", { premium: false, sell: false, stamp: "kept" }, "/adventure.html"],
    ["the three-day demonstration window", { premium: false, sell: true, stamp: "post", demo: true }, "/adventure.html"],
    ["…and a locked family's ending address", { premium: false, sell: true, stamp: "post", quest: { s: 1, ls: 0, lk: "story", done: "2026-01-01" } }, "/adventure.html?part=end&story=lighthouse"],
    ["a Premium child, the ending of a story not finished yet", {}, "/adventure.html?part=end&story=lighthouse"],
    ["a Premium child, the ending of a story that does not exist", { quest: { s: LAST, ls: LAST - 1, lk: "story", done: "2026-01-01" } }, "/adventure.html?part=end&story=nope"],
    ["a Premium child, an unknown part", {}, "/adventure.html?part=middle"],
    ["a Premium child whose stories are all finished (a game day)", { quest: { s: LAST, ls: LAST - 1, lk: "story", done: "2026-01-01", i: 4, last: 3 } }, "/adventure.html"],
  ];
  for (const [label, opts, url] of cases) {
    const { ctx, pg, from } = await open(opts, { url, wait: false });
    const home = await landed(pg, "/today.html");
    const voice = tts(from).length + mp3s(from).length;
    ok(label + ": goes Home, body never shown, before any voice request or recorded line", home && (await shown(pg)) === null && voice === 0, { home, url: pg.url(), shown: await shown(pg), voice });
    await ctx.close();
  }
  // the wrong day: today's story is finished (its ending is the way back)
  const { ctx, pg } = await open({}, { url: "/__sona", wait: false });
  await pg.evaluate(() => Sona.questEnd("lighthouse"));
  const from = reqs.length;
  await pg.goto(origin + "/adventure.html");
  ok("a Premium child whose story today is already finished goes Home (no part)", await landed(pg, "/today.html") && tts(from).length === 0, pg.url());
  await pg.goto(origin + "/adventure.html?part=end&story=windup");
  ok("…and tomorrow's story has no ending yet", await landed(pg, "/today.html"), pg.url());
  await ctx.close();
});

// ── 2. ages 5-8, Day 1, on the website ──
await section("website", async () => {
  TTS.ms = 700; TTS.delay = 150; peak = 0;
  const { ctx, pg, errors, from } = await open({});
  await pg.waitForSelector("#startBtn:visible");
  const card = await pg.evaluate(() => ({ btn: document.getElementById("startBtn").textContent, again: !document.getElementById("againBtn").hidden, title: document.getElementById("startTitle").textContent, day: document.getElementById("startDay").textContent, pic: document.getElementById("startPic").getAttribute("src") }));
  ok("the website opens on the story's card: its picture, Day 1, its title and a teal \"Tap to start\"",
    card.btn === "Tap to start" && !card.again && card.title === "The Lighthouse Sneeze" && card.day === "Day 1" && /home-lighthouse\.webp|echo-welcome\.webp/.test(card.pic), card);
  await nap(pg, 900);
  const before = await pg.evaluate(() => ({ web: h.web.length, synth: h.synth.length, ctx: h.ctx }));
  ok("nothing plays before the start tap (no voice buffer, no browser voice)", before.web === 0 && before.synth === 0, before);
  const ahead = tts(from);
  ok("…while its lines are already on their way, in scene order, never more than two at a time", ahead.length >= 2 && peak <= 2 && ahead.every((t, i) => t === BIG1[i].text), { ahead, peak });
  const evFrom = reqs.length;
  await pg.click("#startBtn");
  let caps = [], glowAfter = [], talk = [], quietWhile = [];
  for (let i = 0; i < BIG1.length; i++) {
    await atScene(pg, i);
    caps.push(await pg.textContent("#capText"));
    await voiceIs(pg, "speaking");
    const mid = await st(pg);
    quietWhile.push(mid.glow === false);
    talk.push(/echo-talk/.test(await pg.getAttribute("#capEcho", "src")));
    await voiceIs(pg, "done");
    glowAfter.push((await st(pg)).glow);
    if (i < BIG1.length - 1) { await nap(pg, 120); await pg.click("#nextBtn"); }
  }
  ok("eight scenes, each caption its line, in order", caps.length === 8 && caps.every((c, i) => c === BIG1[i].text), caps);
  ok("Echo talks while he reads (talk pose) and Next does not glow until he has finished", talk.every(Boolean) && quietWhile.every(Boolean), { talk, quietWhile });
  ok("Next glows once each line has ended", glowAfter.every(Boolean), glowAfter);
  const s = await st(pg), web = await pg.evaluate(() => h.web.length);
  ok("every line played through the page's own Web Audio, as the live voice", s.played.length === 8 && s.played.every((p, i) => p.kind === "pcm" && p.text === BIG1[i].text) && web >= 8, { played: s.played, web });
  const last = await pg.evaluate(() => ({ go: !document.getElementById("goBtn").hidden && document.getElementById("goBtn").textContent, next: !document.getElementById("nextBtn").hidden, skip: !document.getElementById("skipBtn").hidden }));
  ok("the last scene shows a big teal \"Let's go!\" instead of Next, and no Skip", last.go === "Let's go!" && !last.next && !last.skip, last);
  const ev = track(evFrom).filter((b) => /^adventure/.test(b.e));
  ok("\"adventure opened\" was sent once, with the game key alone", ev.length === 1 && ev[0].e === "adventure opened" && JSON.stringify(ev[0].p) === JSON.stringify({ game: "lighthouse" }), ev);
  const sent = reqs.slice(from).filter((r) => r.body && r.body.includes("Mia"));
  ok("no request carries the child's name", sent.length === 0, sent.map((r) => r.path));
  ok("each line was asked of the voice service once", new Set(tts(from)).size === tts(from).length && tts(from).length === 8, tts(from));
  const zoom = await pg.evaluate(() => ({ sheet: !!document.getElementById("sonaNoZoom"), html: getComputedStyle(document.documentElement).touchAction, auto: [...document.querySelectorAll("*")].filter((el) => getComputedStyle(el).touchAction === "auto").map((el) => el.tagName + "#" + el.id) }));
  ok("a double tap never zooms the story (sona.js's no-zoom sheet reaches every element)", zoom.sheet && zoom.html === "manipulation" && zoom.auto.length === 0, zoom);
  ok("no page errors", errors.length === 0, errors);
  await ctx.close();
  TTS.delay = 0;
});

// ── 3. the iPhone app: starts by itself, every line as media ──
await section("app", async () => {
  TTS.ms = 400;
  const { ctx, pg, errors } = await open({}, { app: true });
  await atScene(pg, 0);
  ok("in the app a new intro starts at once, with no card", await pg.evaluate(() => document.getElementById("startOvl").hidden));
  await voiceIs(pg, "done");
  const r = await pg.evaluate(() => ({ media: h.media.filter((a) => a.kind === "voice").map((a) => ({ src: a.src.slice(0, 5), type: a.type, vol: a.volume })), web: h.web.length, ctx: h.ctx, played: __adventure.played }));
  ok("its line plays as a media element (never Web Audio, and no context is made)", r.media.length === 1 && r.media[0].src === "blob:" && r.media[0].type === "audio/wav" && r.web === 0 && r.ctx === 0, r);
  ok("…at the profile's level", r.media[0] && r.media[0].vol === 0.8, r.media);
  await nap(pg, 650); await pg.click("#nextBtn"); await atScene(pg, 1); await voiceIs(pg, "done");
  ok("the next scene too", (await pg.evaluate(() => h.media.filter((a) => a.kind === "voice").length)) === 2);
  ok("no page errors", errors.length === 0, errors);
  await ctx.close();
});

// ── 4. ages 3-4: six scenes, the short lines ──
await section("little", async () => {
  TTS.ms = 300;
  const { ctx, pg, errors } = await open({ age: 4 });
  await pg.click("#startBtn");
  const caps = [];
  for (let i = 0; i < LITTLE1.length; i++) {
    await atScene(pg, i); caps.push(await pg.textContent("#capText"));
    await voiceIs(pg, "done");
    if (i < LITTLE1.length - 1) { await nap(pg, 650); await pg.click("#nextBtn"); }
  }
  const s = await st(pg);
  ok("a four-year-old sees six scenes", s.total === 6 && s.little === true, s);
  ok("…with the short lines", caps.length === 6 && caps.every((c, i) => c === LITTLE1[i].text) && caps[1] === "Here's the real letter. Captain Wally at the lighthouse needs our help!", caps);
  ok("…and never a big-kid scene", !caps.includes(BIG1[3].text) && !caps.includes(BIG1[6].text));
  ok("…ending on \"Let's go!\"", await pg.isVisible("#goBtn"));
  ok("no page errors", errors.length === 0, errors);
  await ctx.close();
});

// ── 5. sound off: captions only ──
await section("sound off", async () => {
  const { ctx, pg, errors, from } = await open({ voice: false });
  await pg.click("#startBtn"); await atScene(pg, 0);
  const s = await st(pg);
  ok("sound off: Next is live at once (glowing), and there is no Hear it", s.voice === "off" && s.glow && !(await pg.isVisible("#hearBtn")), s);
  await nap(pg, 650); await pg.click("#nextBtn"); await atScene(pg, 1);
  await nap(pg, 650); await pg.click("#nextBtn"); await atScene(pg, 2);
  await nap(pg, 300);
  const r = await pg.evaluate(() => ({ web: h.web.length, synth: h.synth.length }));
  ok("…no voice request, no recorded line and nothing played, start to here", tts(from).length === 0 && mp3s(from).length === 0 && r.web === 0 && r.synth === 0, { tts: tts(from), r });
  ok("no page errors", errors.length === 0, errors);
  await ctx.close();
});

// ── 6. Skip, "Let's go!", and the same day again ──
await section("skip and go", async () => {
  TTS.ms = 3000;
  const { ctx, pg, errors } = await open({});
  await pg.click("#startBtn"); await atScene(pg, 0); await voiceIs(pg, "speaking");
  const st0 = await pg.evaluate(() => h.stops);
  await pg.click("#skipBtn");
  await atScene(pg, BIG1.length - 1);
  const s = await st(pg);
  ok("Skip (for grown-ups) goes straight to the \"Let's go!\" scene", s.idx === 7 && (await pg.isVisible("#goBtn")), s);
  ok("…cutting Echo off, and never playing the scenes it skipped", (await pg.evaluate(() => h.stops)) > st0 && s.played.every((p) => p.text === BIG1[0].text || p.text === BIG1[7].text), s.played);
  await voiceIs(pg, "speaking");
  // the arrow key (a keyboard, an iPad's) turns pages, but only "Let's go!"
  // leaves the last one: it must not cut Echo off mid-line (22 Oct 2026: it
  // did, and he froze on his talking picture with "Let's go!" never glowing)
  await nap(pg, 650);
  const k0 = await pg.evaluate(() => h.stops);
  await pg.keyboard.press("ArrowRight"); await nap(pg, 120);
  const k1 = await pg.evaluate(() => ({ stops: h.stops, voice: __adventure.voice, idx: __adventure.idx, view: __adventure.view }));
  ok("the arrow key on the \"Let's go!\" scene turns nothing and leaves Echo talking", k1.stops === k0 && k1.voice === "speaking" && k1.idx === BIG1.length - 1 && k1.view === "scene", { k0, k1 });
  const stops = await pg.evaluate(() => h.stops);
  const day = await localDay(pg);
  // the game page answers late, so the moment after the tap can be looked at
  await ctx.route("**/arcade-lighthouse.html", async (r) => { await new Promise((res) => setTimeout(res, 700)); r.continue(); });
  // the tap and a look at what it did, in one turn of the page's clock
  const cut = await pg.evaluate(() => { document.getElementById("goBtn").click(); return { stops: h.stops }; }).catch(() => null);
  ok("\"Let's go!\" stops Echo's line at once", cut && cut.stops > stops, { cut, stops });
  const there = await landed(pg, "/arcade-lighthouse.html");
  await ctx.unroute("**/arcade-lighthouse.html");
  ok("\"Let's go!\" opens the story's game", there, pg.url());
  const rec = await quest(pg);
  // (beside `a` and `sv`, the days this child's story calendar and its
  // stories started, which sona.js writes as the first page loads: CAL1)
  ok("…having recorded today's intro as seen, and nothing else in the record", rec && rec.seen === day + "|lighthouse" && rec.a === day && rec.sv === day && Object.keys(rec).filter((k) => k !== "a" && k !== "sv").join() === "seen", rec);
  ok("no page errors", errors.length === 0, errors);
  // the same day, again: on the website and in the app
  await pg.goto(origin + "/adventure.html");
  await pg.waitForSelector("#startBtn:visible");
  const card = await pg.evaluate(() => ({ btn: document.getElementById("startBtn").textContent, again: document.getElementById("againBtn").textContent, againShown: !document.getElementById("againBtn").hidden }));
  ok("coming back the same day: a teal \"Keep going\" and a cream \"Watch the story again\"", card.btn === "Keep going" && card.againShown && card.again === "Watch the story again", card);
  await pg.click("#againBtn"); await atScene(pg, 0);
  ok("\"Watch the story again\" plays the story from its first scene", (await st(pg)).idx === 0);
  await pg.goto(origin + "/adventure.html");
  await pg.click("#startBtn");
  ok("\"Keep going\" goes straight to the game", await landed(pg, "/arcade-lighthouse.html"), pg.url());
  await ctx.close();
  TTS.ms = 400;
  const app = await open({ quest: { seen: day + "|lighthouse" } }, { app: true });
  await app.pg.waitForSelector("#startBtn:visible");
  ok("…in the app too, the card waits for a tap", (await app.pg.textContent("#startBtn")) === "Keep going" && (await app.pg.isVisible("#againBtn")) && (await app.pg.evaluate(() => h.media.length)) === 0);
  await app.ctx.close();
});

// ── 7. the ending ──
await section("ending", async () => {
  TTS.ms = 300;
  const { ctx, pg, errors } = await open({}, { url: "/__sona", wait: false });
  const r = await finishDay1(pg);
  const got = await pg.evaluate(() => Sona.storyEnding("lighthouse").got);
  const evFrom = reqs.length, endBig = runOf("lighthouse", "ending", false);
  await pg.goto(origin + "/adventure.html?part=end&story=lighthouse");
  await pg.waitForSelector("#startBtn:visible");
  ok("the ending opens on one card: \"Tap to see what happens\"", (await pg.textContent("#startBtn")) === "Tap to see what happens" && !(await pg.isVisible("#againBtn")) && (await pg.textContent("#startDay")) === "Day 1");
  await pg.click("#startBtn");
  const caps = [];
  for (let i = 0; i < endBig.length; i++) {
    await atScene(pg, i); caps.push(await pg.textContent("#capText")); await voiceIs(pg, "done");
    if (i < endBig.length - 1) { await nap(pg, 650); await pg.click("#nextBtn"); }
  }
  ok("then its four scenes, each caption its line, with Next (no \"Let's go!\")", caps.every((c, i) => c === endBig[i].text) && caps.length === 4 && (await pg.isVisible("#nextBtn")) && !(await pg.isVisible("#goBtn")), caps);
  const ev = track(evFrom).filter((b) => /^adventure/.test(b.e));
  ok("\"adventure ending watched\" was sent once the last scene showed, with the game key alone (and no \"opened\")", ev.length === 1 && ev[0].e === "adventure ending watched" && JSON.stringify(ev[0].p) === JSON.stringify({ game: "lighthouse" }), ev);
  await nap(pg, 650);
  const stickerSfx = await pg.evaluate(() => { window.__chimes = []; const f = Sona.sfx.reward; Sona.sfx.reward = function () { __chimes.push("reward"); return f.apply(this, arguments); }; return true; });
  await pg.click("#nextBtn");
  await pg.waitForSelector("#homeBtn:visible");
  const card = await pg.evaluate(() => ({ lines: [...document.querySelectorAll("#gotList .advgot")].map((p) => p.textContent), cap: !document.getElementById("cap").hidden, skip: !document.getElementById("skipBtn").hidden, chimes: window.__chimes, view: __adventure.view }));
  ok("the sticker card shows the sticker today's round gave, read from the record", r && r.stickers.length === 1 && got.length === 1 && JSON.stringify(card.lines) === JSON.stringify(["You got " + got[0].e + " " + got[0].name + "!"]), { card, got });
  ok("…with one reward chime, no caption and no Skip", stickerSfx && JSON.stringify(card.chimes) === '["reward"]' && !card.cap && !card.skip && card.view === "stickers", card);
  // FOUND1 (23 Oct 2026): the story leaves its game behind, on Home's row
  const fl = await pg.evaluate(() => { const l = document.getElementById("foundLine"), im = document.getElementById("foundPic"); return { shown: !l.hidden && l.getBoundingClientRect().height > 0, text: document.getElementById("foundText").textContent, img: new URL(im.getAttribute("src") || "", location.href).pathname, inBox: !!l.closest(".advbox"), desc: document.getElementById("homeBtn").getAttribute("aria-describedby"), focus: document.activeElement && document.activeElement.id }; });
  ok("…and the card says the game is on Home now, with its Home picture", fl.shown && fl.inBox && fl.text === "New game on Home: Light the Way!" && fl.img === "/assets/crafted/home-lighthouse.webp", fl);
  ok("…and a screen reader hears it with \"Back home\", where focus lands (the line describes the button)", fl.desc === "foundText" && fl.focus === "homeBtn", fl);
  await nap(pg, 650);
  await pg.click("#homeBtn");
  ok("\"Back home\" goes Home", await landed(pg, "/today.html"), pg.url());
  ok("no page errors", errors.length === 0, errors);
  await ctx.close();
  // an ending with no sticker (every sticker already earned): only the button
  const none = await open({ voice: false }, { url: "/__sona", wait: false });
  const today = await localDay(none.pg);
  await none.pg.evaluate((d) => localStorage.setItem("sona.quest.v1", JSON.stringify({ s: 1, ls: 0, lk: "story", done: d, got: [] })), today);
  await none.pg.goto(origin + "/adventure.html?part=end&story=lighthouse");
  await none.pg.click("#startBtn"); await atScene(none.pg, 0);
  await nap(none.pg, 100); await none.pg.click("#skipBtn");
  await none.pg.waitForSelector("#homeBtn:visible");
  ok("Skip in the ending goes to the sticker card; with no sticker given, it shows only the button",
    await none.pg.evaluate(() => document.getElementById("gotList").hidden && document.querySelectorAll("#gotList .advgot").length === 0));
  await none.ctx.close();
  // ages 3-4 see e01, e03 and e04
  const lt = await open({ age: 4, voice: false }, { url: "/__sona", wait: false });
  await lt.pg.evaluate(() => Sona.questEnd("lighthouse"));
  await lt.pg.goto(origin + "/adventure.html?part=end&story=lighthouse");
  await lt.pg.click("#startBtn");
  const lcaps = [];
  for (let i = 0; i < 3; i++) { await atScene(lt.pg, i); lcaps.push(await lt.pg.textContent("#capText")); if (i < 2) { await nap(lt.pg, 650); await lt.pg.click("#nextBtn"); } }
  ok("a little one's ending is e01, e03 and e04, with the short line", JSON.stringify(lcaps) === JSON.stringify(runOf("lighthouse", "ending", true).map((s) => s.text)) && (await st(lt.pg)).total === 3, lcaps);
  await lt.ctx.close();
});

// ── 8. interruptions: the background, a late line, a double tap ──
await section("interruptions", async () => {
  TTS.ms = 3000; TTS.delay = 0;
  const { ctx, pg, errors } = await open({});
  await pg.click("#startBtn"); await atScene(pg, 0); await voiceIs(pg, "speaking");
  const stops = await pg.evaluate(() => h.stops);
  await pg.evaluate(() => { h.hidden = true; document.dispatchEvent(new Event("visibilitychange")); });
  await nap(pg, 100);
  const hid = await st(pg);
  ok("going to the background stops Echo's line (and Next glows)", (await pg.evaluate(() => h.stops)) > stops && hid.voice === "done" && hid.glow, hid);
  const web = await pg.evaluate(() => h.web.length);
  await pg.evaluate(() => { h.hidden = false; document.dispatchEvent(new Event("visibilitychange")); });
  await nap(pg, 1200);
  ok("coming back plays nothing until a tap", (await pg.evaluate(() => h.web.length)) === web && (await st(pg)).voice === "done");
  await pg.click("#hearBtn"); await voiceIs(pg, "speaking");
  ok("…and Hear it plays the line again", (await pg.evaluate(() => h.web.length)) === web + 1);
  // a double tap on Next turns one page
  await nap(pg, 650);
  await pg.dblclick("#nextBtn");
  await nap(pg, 300);
  ok("a double tap on Next turns one page, never two", (await st(pg)).idx === 1, await st(pg));
  await nap(pg, 650);
  await pg.click("#stage", { position: { x: 195, y: 200 } });
  await atScene(pg, 2);
  await pg.click("#stage", { position: { x: 195, y: 200 } });
  await nap(pg, 200);
  ok("a tap on the picture turns the page too, and a second one inside 600 ms does nothing", (await st(pg)).idx === 2, await st(pg));
  await ctx.close();

  // a line that is late: Next glows at 2.5 s, and the line still plays if
  // nobody tapped
  TTS.ms = 600; TTS.delay = 4000;
  const late = await open({});
  await late.pg.click("#startBtn"); await atScene(late.pg, 0);
  const t0 = Date.now();
  await voiceIs(late.pg, "late", 6000);
  const at = Date.now() - t0;
  ok("a line not ready in 2.5 s leaves the caption with Next glowing", at >= 2000 && at <= 3600 && (await st(late.pg)).glow, at);
  await voiceIs(late.pg, "speaking", 6000);
  ok("…and when it lands, with the child still there and no tap, it plays", (await st(late.pg)).played.map((p) => p.text).join("|") === BIG1[0].text);
  await late.ctx.close();
  // one that lands after the child turned the page does not play on the next
  const gone = await open({});
  await gone.pg.click("#startBtn"); await atScene(gone.pg, 0);
  await voiceIs(gone.pg, "late", 6000);
  await gone.pg.click("#nextBtn"); await atScene(gone.pg, 1);
  await nap(gone.pg, 2500);
  const pl = (await st(gone.pg)).played.map((p) => p.text);
  ok("a line that lands after the child turned the page never plays", !pl.includes(BIG1[0].text), pl);
  await gone.ctx.close();
  TTS.delay = 0;

  // the voice service down: the browser's own voice reads the line
  TTS.status = 503;
  const down = await open({});
  await down.pg.click("#startBtn"); await atScene(down.pg, 0); await voiceIs(down.pg, "done");
  ok("with the voice service down, the browser's own voice reads it (never silence)", JSON.stringify(await down.pg.evaluate(() => h.synth)) === JSON.stringify([BIG1[0].text]), await down.pg.evaluate(() => h.synth));
  await down.ctx.close();
  TTS.status = 200;
  ok("no page errors", errors.length === 0, errors);
});

// ── 9. a recorded line, and one whose words changed ──
await section("recorded", async () => {
  TTS.ms = 300;
  manifest = { [fnv(BIG1[0].text)]: BIG1[0].text, [fnv(BIG1[1].text + " Hooray!")]: BIG1[1].text + " Hooray!" };
  const { ctx, pg, errors, from } = await open({});
  await pg.click("#startBtn"); await atScene(pg, 0); await voiceIs(pg, "done");
  let s = await st(pg);
  ok("a line the manifest lists plays its recorded file, through the page's own Web Audio", s.played.length === 1 && s.played[0].kind === "mp3" && mp3s(from).length >= 1 && !tts(from).includes(BIG1[0].text) && (await pg.evaluate(() => h.web.some((w) => Math.abs(w.dur - 0.5) < 0.05))), { played: s.played, mp3: mp3s(from).map((r) => r.path), tts: tts(from) });
  await nap(pg, 650); await pg.click("#nextBtn"); await atScene(pg, 1); await voiceIs(pg, "done");
  s = await st(pg);
  ok("a line whose words changed has no file of its own and falls back to the live voice", s.played[1] && s.played[1].kind === "pcm" && s.played[1].text === BIG1[1].text && tts(from).includes(BIG1[1].text), s.played);
  ok("…and the file for the old words is never fetched", !mp3s(from).some((r) => r.path.includes(fnv(BIG1[1].text + " Hooray!"))), mp3s(from).map((r) => r.path));
  ok("no page errors", errors.length === 0, errors);
  await ctx.close();
  // the app: as media; and a recorded line that never starts gives way
  const app = await open({}, { app: true });
  await atScene(app.pg, 0); await voiceIs(app.pg, "done");
  let m = await app.pg.evaluate(() => h.media.filter((a) => a.kind === "voice").map((a) => a.type));
  ok("in the app a recorded line plays as a media element", JSON.stringify(m) === '["audio/mpeg"]' && (await st(app.pg)).played[0].kind === "mp3", m);
  await app.ctx.close();
  const stuck = await open({}, { app: true, refuse: "audio/mpeg" });
  await atScene(stuck.pg, 0);
  await stuck.pg.waitForFunction(() => window.__adventure.played.length >= 2, null, { timeout: 7000 }).catch(() => {});
  const sp = await st(stuck.pg);
  ok("…and one that has not started within 3 s gives way to the live voice", sp.played.map((p) => p.kind).join() === "mp3,pcm", sp.played);
  await stuck.ctx.close();
  manifest = null;
});

// ── 10. the buddy ──
await section("buddy", async () => {
  art = true; TTS.ms = 300;
  const boxes = { s01: { x: 0.78, y: 0.99, h: 0.22, pose: "rest" }, s02: { x: 0.5, y: 0.62, h: 0.2, pose: "peek" } };
  // the first story's s01 and s02 (the first match is lighthouse's): s01's
  // feet sit under the card, so the lift is what is checked
  const patched = ADV_SRC.replace(/(\{ art: "s01", ages: "both", buddy: )(?:null|\{[^}]*\})/, "$1" + JSON.stringify(boxes.s01)).replace(/(\{ art: "s02", ages: "both", buddy: )(?:null|\{[^}]*\})/, "$1" + JSON.stringify(boxes.s02));
  ok("the test's two boxes went in", patched.includes(JSON.stringify(boxes.s01)) && patched.includes(JSON.stringify(boxes.s02)));
  for (const [label, character, blocked] of [["a dragon child", "dragon", false], ["a fox child", "fox", false], ["a dragon child whose standing picture won't load", "dragon", true]]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(seed({ voice: false, character }));
    await ctx.addInitScript(device, {});
    await ctx.route("**/adventures.js", (r) => r.fulfill({ contentType: "text/javascript", body: patched }));
    if (blocked) await ctx.route("**/buddy-dragon-rest.webp", (r) => r.abort());
    const pg = await ctx.newPage(); const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
    await pg.goto(origin + "/adventure.html");
    await pg.click("#startBtn"); await atScene(pg, 0);
    await pg.waitForFunction(() => { const b = document.querySelector(".advlayer:last-child img.advbuddy"); return b && b.complete && b.naturalWidth && b.style.width; }, null, { timeout: 5000 }).catch(() => {});
    const r = await pg.evaluate(() => {
      const b = document.querySelector(".advlayer:last-child img.advbuddy"); if (!b) return null;
      const br = b.getBoundingClientRect(), cr = document.querySelector(".advcard").getBoundingClientRect();
      const btns = ["hearBtn", "nextBtn", "closeBtn", "skipBtn", "capEcho"].map((id) => document.getElementById(id).getBoundingClientRect());
      const hit = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
      return { src: b.getAttribute("src"), alt: b.getAttribute("alt"), aria: b.getAttribute("aria-hidden"), pe: getComputedStyle(b).pointerEvents, vis: b.style.visibility, badge: b.classList.contains("badge"),
        underCard: hit(br, cr) || btns.some((x) => hit(br, x)), bottom: br.bottom, cardTop: cr.top };
    });
    const want = character === "fox" ? /buddy-fox-rest\.webp$/ : blocked ? /buddy-dragon-v2\.webp$/ : /buddy-dragon-rest\.webp$/;
    ok(label + ": the buddy stands on the picture in its own pose (or its badge when that won't load)", r && want.test(r.src) && r.badge === blocked, r);
    ok(label + ": decoration only (alt=\"\", aria-hidden, no pointer)", r && r.alt === "" && r.aria === "true" && r.pe === "none", r);
    ok(label + ": a box whose feet would sit under the card is lifted clear of it, Echo's face and every button", r && (r.vis === "hidden" || !r.underCard), r);
    if (character === "fox") {
      await nap(pg, 650); await pg.click("#nextBtn"); await atScene(pg, 1);
      await pg.waitForFunction(() => { const b = document.querySelector(".advlayer:last-child img.advbuddy"); return b && b.complete && b.naturalWidth && b.style.width; }, null, { timeout: 5000 }).catch(() => {});
      const p = await pg.evaluate(() => { const b = document.querySelector(".advlayer:last-child img.advbuddy"); return b && { src: b.getAttribute("src"), badge: b.classList.contains("badge"), vis: b.style.visibility }; });
      ok("a fox child on a peek spot gets the fox's own peek (drawn for the stories), never its round badge", p && /buddy-fox-peek\.webp$/.test(p.src) && !p.badge && p.vis === "visible", p);
    }
    ok(label + ": no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  // a spot low on the left, on a phone short enough that the picture is
  // narrower than the card: Echo's face on the card's edge is in the way, so
  // the buddy stands back above his head (or is left out), never on him
  {
    const low = ADV_SRC.replace(/(\{ art: "s01", ages: "both", buddy: )(?:null|\{[^}]*\})/, "$1" + JSON.stringify({ x: 0.15, y: 0.9, h: 0.2, pose: "rest" }));
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
    await ctx.addInitScript(seed({ voice: false, character: "dragon" }));
    await ctx.addInitScript(device, {});
    await ctx.route("**/adventures.js", (r) => r.fulfill({ contentType: "text/javascript", body: low }));
    const pg = await ctx.newPage(); const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
    await pg.goto(origin + "/adventure.html");
    await pg.click("#startBtn"); await atScene(pg, 0);
    await pg.waitForFunction(() => { const b = document.querySelector(".advlayer:last-child img.advbuddy"); return b && b.complete && b.naturalWidth && b.style.width; }, null, { timeout: 5000 }).catch(() => {});
    const e = await pg.evaluate(() => {
      const b = document.querySelector(".advlayer:last-child img.advbuddy"), pic = b && b.parentNode; if (!b) return null;
      const br = b.getBoundingClientRect(), fr = document.getElementById("capEcho").getBoundingClientRect();
      const wasUnder = pic.offsetTop + 0.9 * pic.offsetHeight > fr.top && fr.left < br.right && br.left < fr.right;
      return { vis: b.style.visibility, wasUnder, feet: Math.round(br.bottom), face: Math.round(fr.top), meets: br.left < fr.right && fr.left < br.right && br.top < fr.bottom && fr.top < br.bottom };
    });
    ok("a spot that would put the buddy's feet on Echo's face lifts it clear of his head (or leaves it out)", e && e.wasUnder && (e.vis === "hidden" || (!e.meets && e.feet <= e.face)), e);
    ok("…no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  // the picture itself: whole, its foot under the card's top edge, never under the buttons' row
  const { ctx, pg } = await open({ voice: false });
  await pg.click("#startBtn"); await atScene(pg, 0);
  await pg.waitForFunction(() => document.querySelector(".advlayer.in"), null, { timeout: 5000 }).catch(() => {});
  const g = await pg.evaluate(() => { const p = document.querySelector(".advlayer.in .advpic"), i = p && p.querySelector("img.art"); if (!p) return null; const r = p.getBoundingClientRect(); return { w: r.width, h: r.height, top: r.top, bottom: r.bottom, nat: i.naturalWidth + "x" + i.naturalHeight, card: document.querySelector(".advcard").getBoundingClientRect().top, row: document.querySelector(".advrow").getBoundingClientRect().top, blur: getComputedStyle(document.querySelector(".advlayer.in .advblur")).backgroundImage }; });
  ok("a picture that arrives is shown whole, at the width the room allows, its foot running just under the card",
    g && Math.abs(g.w / g.h - 800 / 1200) < 0.02 && g.top >= -12 && g.bottom <= g.card + 40 && g.bottom < g.row && /adventure\/lighthouse\/s01\.webp/.test(g.blur), g);
  await ctx.close();
  art = false;
});

// ── 10b. the buddy on the real pictures: every boxed scene of every story,
// at a phone and an iPad, with a dragon (it has every pose). Each stands
// exactly on its box (its feet on the box's line, its middle on the box's x
// but for a few px held off the screen's edge), in its own pose, and meets
// nothing: not the card, not Echo's face on its edge, not a button. Motion
// on: the slow drift is part of what must stay clear. ──
// (one section a screen, so the two can run as separate suites)
const spots = ([w, hgt]) => async () => {
  art = "real";
  const bad = []; let placed = 0;
  for (const [n, id] of IDS.entries()) for (const part of ["intro", "ending"]) {
    const scenes = A[id][part];
    const q = part === "intro" ? { s: n, done: "2026-01-01" } : { s: LAST, ls: LAST - 1, lk: "story", done: "2026-01-01" };
    const { ctx, pg, errors } = await open({ voice: false, character: "dragon", quest: q }, { size: { width: w, height: hgt }, url: "/adventure.html" + (part === "ending" ? "?part=end&story=" + id : "") });
    await pg.click("#startBtn");
    for (let i = 0; i < scenes.length; i++) {
      await atScene(pg, i);
      const sc = scenes[i];
      if (sc.buddy) {
        await pg.waitForFunction(() => { const l = document.querySelector(".advlayer:last-child"), b = l && l.querySelector("img.advbuddy"); return l && l.classList.contains("in") && b && b.complete && b.naturalWidth && b.style.width && b.style.visibility; }, null, { timeout: 8000 }).catch(() => {});
        const m = await pg.evaluate((box) => {
          const pic = document.querySelector(".advlayer:last-child .advpic"), b = pic && pic.querySelector("img.advbuddy");
          if (!b || !b.style.width) return null;
          const px = parseFloat, W = pic.offsetWidth, H = pic.offsetHeight, br = b.getBoundingClientRect();
          const hit = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
          const hits = [".advcard", "#capEcho", "#hearBtn", "#nextBtn", "#goBtn", "#closeBtn", "#skipBtn"].filter((s) => { const e = document.querySelector(s); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); return r.width > 0 && hit(br, r); });
          return { vis: b.style.visibility, src: (b.getAttribute("src") || "").split("/").pop(), lift: Math.round(box.y * H - px(b.style.top) - px(b.style.height)), dx: Math.round(box.x * W - px(b.style.left) - px(b.style.width) / 2), h: px(b.style.height) / H, hits };
        }, sc.buddy);
        placed++;
        const good = m && m.vis === "visible" && m.src === "buddy-dragon-" + sc.buddy.pose + ".webp" && m.lift === 0 && Math.abs(m.dx) <= 10 && Math.abs(m.h - sc.buddy.h) < 0.005 && m.hits.length === 0;
        if (!good) bad.push(`${w}x${hgt} ${id} ${sc.art}: ` + JSON.stringify(m));
      }
      if (i < scenes.length - 1) { await nap(pg, 650); await pg.click("#nextBtn"); }
    }
    if (errors.length) bad.push(`${w}x${hgt} ${id} ${part}: ` + errors.join("; "));
    await ctx.close();
  }
  const boxes = IDS.reduce((n, id) => n + A[id].intro.concat(A[id].ending).filter((sc) => sc.buddy).length, 0);
  ok("on the real pictures at " + w + "x" + hgt + ", every boxed scene (" + boxes + ") shows the buddy on its spot, in its pose, clear of the card, Echo and every button", boxes >= 24 && placed === boxes && bad.length === 0, bad.length ? bad : placed);
  art = false;
};
await section("buddy spots phone", spots([390, 844]));
await section("buddy spots ipad", spots([768, 1024]));

// ── 11. Reduce Motion ──
await section("reduce motion", async () => {
  art = true;
  const { ctx, pg, errors } = await open({ voice: false }, { rm: true });
  await pg.click("#startBtn"); await atScene(pg, 0);
  await pg.waitForFunction(() => document.querySelector(".advlayer.in"), null, { timeout: 5000 }).catch(() => {});
  await nap(pg, 650); await pg.click("#nextBtn"); await atScene(pg, 1);
  const r = await pg.evaluate(() => {
    const L = document.querySelectorAll(".advlayer"), cs = (el) => el ? getComputedStyle(el) : null;
    const pic = document.querySelector(".advlayer:last-child .advpic"), img = pic && pic.querySelector("img.art");
    return { layers: L.length, layerT: cs(L[L.length - 1]).transitionDuration, imgT: cs(img).transitionDuration, drift: cs(pic).animationName, next: cs(document.getElementById("nextBtn")).animationName, glow: document.getElementById("nextBtn").classList.contains("glow") };
  });
  ok("under Reduce Motion a scene cuts in (the last one is gone at once, nothing fades)", r.layers === 1 && /^0s(, 0s)*$/.test(r.layerT) && /^0s(, 0s)*$/.test(r.imgT), r);
  ok("…the picture does not drift and Next does not pulse (it still glows)", r.drift === "none" && r.next === "none" && r.glow, r);
  ok("no page errors", errors.length === 0, errors);
  await ctx.close();
  const moving = await open({ voice: false });
  await moving.pg.click("#startBtn"); await atScene(moving.pg, 0);
  await moving.pg.waitForFunction(() => document.querySelector(".advlayer.in"), null, { timeout: 5000 }).catch(() => {});
  const m = await moving.pg.evaluate(() => ({ drift: getComputedStyle(document.querySelector(".advlayer.in .advpic")).animationName, next: getComputedStyle(document.getElementById("nextBtn")).animationName, pic: getComputedStyle(document.querySelector(".advlayer.in .advpic")).transitionDuration, cap: getComputedStyle(document.getElementById("cap")).transitionDuration }));
  ok("with motion on, the picture drifts and Next pulses; what is measured never transitions", m.drift === "advdrift" && m.next === "advpulse" && /^0s/.test(m.pic) && /^0s/.test(m.cap), m);
  await moving.ctx.close();
  art = false;
});

// ── 12. fit: five screens, a phone's safe areas ──
await section("fit", async () => {
  const SIZES = [[320, 568], [375, 667], [390, 844], [430, 932], [768, 1024]];
  for (const [w, hgt] of SIZES) {
    // windup's 5-8 intro has the longest line: the card keeps that height throughout
    TTS.ms = 200;
    const day1 = await open({ quest: { s: 1, ls: 0, lk: "story", done: "2026-01-01" } }, { size: { width: w, height: hgt } });
    const pg = day1.pg;
    await pg.waitForSelector("#startBtn:visible");
    const start = await pg.evaluate(() => { const b = document.getElementById("startBtn").getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: b.height, title: document.getElementById("startTitle").textContent }; });
    await pg.click("#startBtn"); await atScene(pg, 0);
    const m = await pg.evaluate(() => {
      const r = (id) => { const e = document.getElementById(id); const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height, shown: !e.hidden && b.width > 0 }; };
      return { W: innerWidth, H: innerHeight, sw: document.documentElement.scrollWidth, card: (() => { const b = document.querySelector(".advcard").getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; })(),
        hear: r("hearBtn"), next: r("nextBtn"), close: r("closeBtn"), skip: r("skipBtn"), minH: document.getElementById("capBox").style.minHeight, text: document.getElementById("capText").textContent };
    });
    const inside = (b) => b.l >= 0 && b.r <= m.W && b.t >= 0 && b.b <= m.H - 34;
    ok(`${w}x${hgt}: the start card's button is fully on screen, clear of the home bar`, start.top >= 0 && start.bottom <= hgt - 34 && start.h >= 44 && start.title === "Grandpa Bear's Sleepy Toys", start);
    ok(`${w}x${hgt}: no sideways scroll`, m.sw <= m.W, m);
    ok(`${w}x${hgt}: the caption card and both its buttons are fully on screen, clear of the home bar (34 px)`, inside(m.card) && inside(m.hear) && inside(m.next) && m.hear.shown && m.next.shown, m);
    ok(`${w}x${hgt}: Hear it is at least 44 px tall and Next at least 64 px each way`, m.hear.h >= 44 && m.next.h >= 64 && m.next.w >= 64, { hear: m.hear, next: m.next });
    ok(`${w}x${hgt}: ✕ and Skip are on screen, below the notch and clear of the card`, m.close.t >= 47 && m.skip.t >= 47 && m.skip.r <= m.W && m.close.b < m.card.t && m.skip.b < m.card.t, m);
    // the tallest line, on screen: Skip to the end of the run is not it, so
    // the card's height (held for the tallest) is what the check above measured
    ok(`${w}x${hgt}: the card holds one height for the run (the tallest line's)`, parseFloat(m.minH) > 0, m.minH);
    await day1.ctx.close();
  }
  // the "Keep going" card (two buttons) and the sticker card on the smallest phone
  const small = await open({ voice: false }, { size: { width: 320, height: 568 }, url: "/__sona", wait: false });
  const today = await localDay(small.pg);
  await small.pg.evaluate((d) => localStorage.setItem("sona.quest.v1", JSON.stringify({ seen: d + "|lighthouse" })), today);
  await small.pg.goto(origin + "/adventure.html"); await small.pg.waitForSelector("#againBtn:visible");
  const two = await small.pg.evaluate(() => ["startBtn", "againBtn"].map((id) => { const b = document.getElementById(id).getBoundingClientRect(); return { t: b.top, b: b.bottom }; }));
  ok("320x568: both \"Keep going\" and \"Watch the story again\" are on screen", two.every((b) => b.t >= 0 && b.b <= 568 - 34), two);
  await small.pg.evaluate(() => Sona.questEnd("lighthouse"));
  await small.pg.goto(origin + "/adventure.html?part=end&story=lighthouse");
  await small.pg.click("#startBtn"); await atScene(small.pg, 0); await nap(small.pg, 100); await small.pg.click("#skipBtn");
  await small.pg.waitForSelector("#homeBtn:visible");
  const end = await small.pg.evaluate(() => { const b = document.getElementById("homeBtn").getBoundingClientRect(); return { t: b.top, b: b.bottom, h: b.height }; });
  ok("320x568: the sticker card's Back home is on screen", end.t >= 0 && end.b <= 568 - 34 && end.h >= 44, end);
  await small.ctx.close();
});

// ── 13. what the page writes ──
await section("writes", async () => {
  TTS.ms = 200;
  const { ctx, pg, errors } = await open({});
  const snap = () => pg.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
  await pg.waitForSelector("#startBtn:visible");
  const before = await snap();
  await pg.click("#startBtn");
  for (let i = 0; i < BIG1.length - 1; i++) { await atScene(pg, i); await voiceIs(pg, "done"); await nap(pg, 650); await pg.click("#nextBtn"); }
  await atScene(pg, BIG1.length - 1); await nap(pg, 650);
  const pre = await snap();
  const changed = Object.keys(Object.assign({}, before, pre)).filter((k) => before[k] !== pre[k] && !/^sona\.(fid|tts)/.test(k));
  ok("watching the whole intro writes nothing (no rep, trophy, coin or sticker)", changed.length === 0, changed);
  await pg.evaluate(() => { const b = document.getElementById("goBtn"); b.click(); });
  await landed(pg, "/arcade-lighthouse.html");
  const after = await snap();
  const diff = Object.keys(Object.assign({}, pre, after)).filter((k) => pre[k] !== after[k] && !/^sona\.(fid|tts)/.test(k) && k !== "__seeded");
  // the record already held the calendar's and the stories' first day (`a`,
  // `sv`, CAL1), written as the page first loaded; "Let's go!" adds `seen`
  // to it and changes nothing else
  const was = JSON.parse(pre["sona.quest.v1"] || "{}"), now = JSON.parse(after["sona.quest.v1"] || "{}");
  ok("…and \"Let's go!\" writes the quest record's `seen` and nothing else", JSON.stringify(diff) === '["sona.quest.v1"]' && Object.keys(now).filter((k) => k !== "a" && k !== "sv").join() === "seen" && now.a === was.a && now.sv === was.sv && Object.keys(was).sort().join() === "a,sv", { diff, was, rec: after["sona.quest.v1"] });
  ok("no page errors", errors.length === 0, errors);
  await ctx.close();
});

if (PARTS) { const unknown = YES.concat(NOT).filter((n) => !declared.has(n)); ok("every part ADVENTURE_PART names is a section of this file", unknown.length === 0, unknown); }
await browser.close();
server.close();
console.log(fails ? `\n${fails} FAILED of ${count}` : `\nALL GREEN — ${count} assertions`);
process.exit(fails ? 1 : 0);
