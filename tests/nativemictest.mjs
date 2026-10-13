// NATIVEMIC1: in the iPhone app the microphone is Sona's own (12 Oct 2026).
//
// Travis: in the app every listen turned the phone into a phone call. The
// volume buttons moved call volume, AirPods dropped to call quality, a
// parent's music ducked. That is WebKit, not a setting: while a page captures
// with getUserMedia, WebKit's own audio session is a video call, and the app
// cannot change it. So in an app build whose SonaSpeech plugin has micOpen,
// Sona's native code opens the mic (.playAndRecord, mode .default) and hands
// the page its samples as events; sona.js turns them back into a stream, an
// AudioNode and a recorder (Sona.micOpen / micSource / micRecorder /
// micProbe), and every listening page keeps every analyser, bar and timing it
// had.
//
// What this holds, in real Chromium Web Audio, against a fake phone that
// behaves the way SonaSpeechPlugin.swift does (tests/_nativemic.mjs):
//   - a browser, every App Store build before this one, every test stand-in
//     for "the app" and both off switches run the page's own getUserMedia
//     line, untouched; only the new build opens Sona's own mic, and then
//     getUserMedia is never called;
//   - the page hears what the phone heard: the same level (within 1 dB), the
//     same pitch, at 48 or 44.1 kHz in and out, in small or large chunks, on
//     time or late; the boost is 1.0 and is never even written at 1.0;
//   - the same child gets the same answer on Sona's own mic as on the web
//     mic: practice, the five round games' say-it card, Fruit Slice's sound
//     power, Feed Echo, Hoops and a book's word; SILENCE IS NEVER A TRY on it
//     either, and nothing it adds is ever a sample the phone did not send;
//   - every way out of a listen closes the phone's mic, and NOTHING PLAYS
//     while it is open or being asked for, or in the moment after it closes;
//   - a refusal meets the same screens it always did; "not now" from the
//     phone is one web-mic try; a fault is the web mic for the rest of the
//     page; a call or Siri pauses the listen and it picks up after;
//   - never both mics at once, even when the web mic is still being asked
//     for; a page that leaves mid-open (the back-forward cache) is the
//     temporary kind, never a fault; Apple's check always names a live
//     stream, even after a fault elsewhere;
//   - the frames between the phone's samples (a pause, a re-open, a late
//     chunk) are never the room: Sona.micDeaf says so, and a card's room
//     floor holds through every break;
//   - NO AUDIO LEAVES THE PHONE: the keepsake clip is a local WAV, no request
//     carries anything the size of audio, and the native block in sona.js has
//     no way to send anything (a source pin);
//   - "sona.nativemic" (Travis's measurement setting) never rides a backup;
//   - each of the 24 listening call sites asks the helper first and keeps its
//     old line as the fallback.
// Nothing here is practice data: the cards, the games and the books never
// were, and practice's reps here stay on a throwaway test phone.
import { readFileSync } from "fs";
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from "./_env.mjs";
import { serve, open as phoneOpen, calm } from "./_phone.mjs";
import { nativeMic } from "./_nativemic.mjs";

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT;
const SONA = readFileSync(ROOT + "/sona.js", "utf8");
// the off switch, flipped in the copy this server hands out
const SONA_OFF = SONA.replace("const NATIVE_MIC_ON = true;", "const NATIVE_MIC_ON = false;");
const BLANK = (t) => '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + t + '</title></head><body><script src="/sona.js"></script></body></html>';
const { base, close } = await serve({ root: ROOT, pages: { "/__two.html": BLANK("two") } });
const browser = await chromium.launch(launchOpts(["--autoplay-policy=no-user-gesture-required"]));

// ── reporting: scenarios run a few at a time, each prints as one block ──
let failures = 0, assertions = 0;
const ONLY = process.env.NATIVEMIC_ONLY ? new RegExp(process.env.NATIVEMIC_ONLY) : null;
const JOBS = Math.max(1, Number(process.env.NATIVEMIC_JOBS) || 3);
const VERBOSE = !!process.env.NATIVEMIC_VERBOSE;   // print every assertion's numbers, passing ones too
const queue = [];
function scenario(name, fn) { if (!ONLY || ONLY.test(name)) queue.push({ name, fn }); }
async function runOne(job) {
  const lines = [];
  const t = {
    ok(n, pass, detail = "") { assertions++; if (!pass) failures++; lines.push((pass ? "PASS " : "FAIL ") + n + (pass && !VERBOSE ? "" : " → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); return pass; },
  };
  const t0 = Date.now();
  try { await job.fn(t); } catch (e) { t.ok(job.name + ": completes without a harness/page exception", false, e.stack); }
  console.log("── " + job.name + " (" + ((Date.now() - t0) / 1000).toFixed(1) + " s)\n" + lines.join("\n"));
}
const until = (page, fn, ms, arg) => page.waitForFunction(fn, arg, { timeout: ms, polling: 20 }).then(() => true, () => false);
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");

// ── the family on this phone (the suite's own init script; nativeMic runs after it) ──
//   cfg.game: a round game's play token · cfg.sound (R) · cfg.age (7) ·
//   cfg.muted: sound off, so Echo says nothing · cfg.noMicok: the grown-up
//   has not said yes yet · cfg.run: a fresh daily run for practice ·
//   cfg.micNumbers · cfg.nativemic: "sona.nativemic" · cfg.isNativeApp: a
//   Sona.isNativeApp() override (a test stand-in for "the app") ·
//   cfg.slowAsk: leave Echo's mid-round ask (the sound power) as it is
function kid(cfg) {
  cfg = cfg || {};
  try { sessionStorage.getItem("__t"); } catch (e) { return; }
  if (!cfg.slowAsk) document.addEventListener("DOMContentLoaded", () => { if (window.SLOW_ASK) { SLOW_ASK.first = SLOW_ASK.every = SLOW_ASK.quiet = 1e12; window.slowAskAt = 1e12; } });
  const h = window.__t = { practice: [], saved: [], turns: [], hidden: false, grownUp: false };
  Object.defineProperty(document, "hidden", { configurable: true, get: () => h.hidden });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h.hidden ? "hidden" : "visible") });
  h.hide = () => { h.hidden = true; document.dispatchEvent(new Event("visibilitychange")); };
  h.show = () => { h.hidden = false; document.dispatchEvent(new Event("visibilitychange")); };
  let sona;
  Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set(v) {
    sona = v; v.confetti = () => {};
    if (cfg.isNativeApp) v.isNativeApp = () => true;
    const save = v.saveRecording;
    v.saveRecording = function (o) {
      const b = o && o.blob;
      h.saved.push({ type: b && b.type, size: b && b.size });
      try { sessionStorage.setItem("__tSaved", String(Number(sessionStorage.getItem("__tSaved") || 0) + 1)); } catch (e) {}
      return save ? save.apply(this, arguments) : undefined;
    };
    for (const k of ["logAttempt", "bumpReps", "recordSession", "recordRung", "rotAdvance"]) { const real = v[k]; v[k] = function () { h.practice.push(k); return real ? real.apply(this, arguments) : undefined; }; }
  } });
  // practice's "Your turn", with what the phone's mic was doing as it showed
  new MutationObserver(() => {
    const t = document.getElementById("turnStatus");
    if (t && t.textContent === "Your turn" && (!h.turns.length || h.turns[h.turns.length - 1].t < performance.now() - 20)) {
      const st = window.Sona && Sona.micStats ? Sona.micStats() : { live: [] };
      h.turns.push({ t: performance.now(), chunks: window.__nm ? __nm.chunks : -1, live: st.live.some((x) => x.state === "live") });
    }
    const q = document.getElementById("quietTitle"); if (q && /grown-up/i.test(q.textContent) && document.getElementById("quietOvl") && document.getElementById("quietOvl").classList.contains("show")) h.grownUp = true;
  }).observe(document, { subtree: true, childList: true, characterData: true });
  if (sessionStorage.getItem("__tSeeded")) return;
  sessionStorage.setItem("__tSeeded", "1");
  localStorage.setItem("sona.freeera.v1", "post"); for (const k of ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"]) localStorage.setItem(k, "done");
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: cfg.age || "7", focusSounds: [cfg.sound || "R"], onboarded: true, earlyAdopter: true,
    voiceOn: !cfg.muted, soundOn: !cfg.muted, volume: cfg.muted ? 0 : 0.6 }));
  if (!cfg.noMicok) localStorage.setItem("sona.micok", "1");
  if (cfg.micNumbers) localStorage.setItem("sona.micnumbers", "1");
  if (cfg.nativemic) localStorage.setItem("sona.nativemic", cfg.nativemic);
  localStorage.setItem("sona.sprintintro.v1", "3");
  if (cfg.game) { sessionStorage.setItem("sona.play.token", "arcade-" + cfg.game + ".html"); sessionStorage.setItem("sona.boost.sound", cfg.sound || "R"); }
  if (cfg.run) sessionStorage.setItem("sona.run.v1", JSON.stringify({ active: true, round: 0, scores: [], sum: 0, sound: cfg.sound || "R", level: 1, pending: false, games: ["slice", "tiles", "stack", "run", "glide"], tries: 0 }));
}

// One phone: the family (kid), then the fake microphone (nativeMic; null: none).
//   o.micOff: serve sona.js with NATIVE_MIC_ON = false · o.tts: bytes of PCM
//   for every voice line (false: the voice service is down) · o.stubGames:
//   the earned game opens as a blank page
async function open(path, o = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const requests = [];
  context.on("request", (r) => requests.push({ at: Date.now(), url: r.url(), method: r.method(), body: r.postData() || "" }));
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (!url.startsWith(base + "/")) return route.abort();
    const u = new URL(url);
    if (u.pathname === "/sona.js" && o.micOff) return route.fulfill({ status: 200, contentType: "text/javascript", body: SONA_OFF });
    if (u.pathname === "/api/tts") return o.tts === false ? route.fulfill({ status: 503, contentType: "application/json", body: "{}" })
      : route.fulfill({ status: 200, contentType: "application/octet-stream", body: Buffer.alloc(o.tts || 4800) });
    if (o.stubGames && /^\/arcade-[a-z]+\.html$/.test(u.pathname)) return route.fulfill({ status: 200, contentType: "text/html", body: BLANK("game") });
    return route.continue();
  });
  await context.addInitScript(kid, o.kid || {});
  if (o.nm !== null) await context.addInitScript(nativeMic, o.nm || {});
  const page = await context.newPage(); page.setDefaultTimeout(9000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  if (path) await page.goto(base + path);
  return { context, page, errors, requests };
}
async function game(name, o = {}) {
  const p = await open("/arcade-" + name + ".html?from=charge", Object.assign({}, o, { kid: Object.assign({ game: name }, o.kid || {}) }));
  await p.page.waitForFunction(() => window.gameEntryAllowed === true && typeof crash === "function");
  await p.page.waitForTimeout(300);
  return p;
}
const phone = (page) => page.evaluate(() => ({ gum: __nm.gum, opens: __nm.opens.length, opened: __nm.opened, closed: __nm.closed, closeCalls: __nm.closeCalls.length, live: __nm.live(),
  chunks: __nm.chunks, perms: __nm.perms.slice(), starts: __nm.starts.slice(), events: __nm.events.slice(), ends: __nm.ends.slice(), stats: Sona.micStats() }));
const log = (page) => page.evaluate(() => ({ now: performance.now(), mics: __nm.mics.map((m) => ({ kind: m.kind, asked: m.asked, start: m.start, end: m.end, g: m.g })), sounds: __nm.sounds.map((s) => ({ kind: s.kind, start: s.start, end: s.end, live: s.live, src: s.src, text: s.text, len: s.len })) }));
// The phone's mic, closed: every stream that went live has ended, nothing is
// live, and every close the page sent has been answered.
async function shut(page, ms = 1500) {
  await until(page, () => !__nm.live() && __nm.mics.every((m) => m.end != null), ms);
  return page.evaluate(() => ({ opened: __nm.opened, closed: __nm.closed, live: __nm.live(), mics: __nm.mics.length, web: __nm.mics.filter((m) => m.kind === "web").length, pending: __nm.mics.filter((m) => m.end == null).length }));
}
// (a web mic counts as closed once its track is stopped)
function closedOk(t, label, s) { t.ok(label + ": every mic that opened is closed again, and nothing is still being asked for", s.mics > 0 && s.opened === s.closed && !s.live && s.pending === 0, s); }
// NOTHING PLAYS WHILE THE MIC IS OPEN: every sound against every mic,
// asked-for to answered-closed, and 150 ms of quiet after each close (the
// pages wait 200: the phone's own close lands about 20 ms after theirs).
function audit(t, label, l, opts = {}) {
  const bad = [], soon = [];
  for (const s of l.sounds) for (const m of l.mics) {
    const end = m.end == null ? l.now : m.end;
    if (s.start < end && m.asked < s.end) bad.push({ sound: s.kind + (s.text ? ":" + s.text : "") + (s.src ? ":" + String(s.src).slice(-28) : ""), start: Math.round(s.start), end: s.end === Infinity ? "∞" : Math.round(s.end), mic: [m.kind, Math.round(m.asked), Math.round(end)] });
    if (m.end != null && s.start >= m.end && s.start - m.end < 150) soon.push({ sound: s.kind, after: Math.round(s.start - m.end) });
  }
  if (!opts.quiet) t.ok(label + ": sounds played and the mic opened (the audit below is not vacuous)", l.sounds.length > 0 && l.mics.length > 0, { sounds: l.sounds.length, mics: l.mics.length });
  t.ok(label + ": nothing plays while the phone's mic is open or being asked for", bad.length === 0, bad.slice(0, 6));
  t.ok(label + ": nothing starts within 150 ms of the phone's close", soon.length === 0, soon.slice(0, 6));
}
function clean(t, label, errors) { t.ok(label + ": no runtime errors", errors.length === 0, errors); }
// NO AUDIO LEAVES THE PHONE: no request carries anything the size of audio,
// and while the mic is open the page sends nothing but voice lines and the
// funnel's small events.
function network(t, label, requests, from, to) {
  const big = requests.filter((r) => r.body && (r.body.length >= 4096 || /UklGR|[A-Za-z0-9+/]{1000,}/.test(r.body))).map((r) => r.url + " " + r.body.length);
  t.ok(label + ": no request carries anything the size of audio (a chunk is 5 KB of base64, a second of clip 48 KB)", big.length === 0, big);
  const during = requests.filter((r) => r.at >= from && r.at <= to && r.method !== "GET" && !/\/api\/(tts|track|log)$/.test(new URL(r.url).pathname)).map((r) => r.method + " " + r.url);
  t.ok(label + ": while the mic is open the page sends only voice-line and funnel requests", during.length === 0, during);
}

// ════════════════════════════════════════════════════════════════════════
// 1. WHO LISTENS: Sona's own mic only in the build that has it
// ════════════════════════════════════════════════════════════════════════
const WEB_CASES = [
  ["a browser (no Capacitor)", { nm: { mode: "browser" } }],
  ["Capacitor = {}", { nm: { mode: "browser", capacitor: "empty" } }],
  ["isNativePlatform() with no Plugins", { nm: { mode: "browser", capacitor: "noPlugins" } }],
  ["Capacitor's web bridge (isNativePlatform() false), even holding the new plugin", { nm: { mode: "new", capacitor: "webBridge" } }],
  ["the app with Plugins: {}", { nm: { mode: "none" } }],
  ["an App Store build (SonaSpeech without micOpen)", { nm: { mode: "old" } }],
  ["a Sona.isNativeApp() override only", { kid: { isNativeApp: true }, nm: { mode: "browser" } }],
  ["the new build with sona.nativemic \"off\"", { kid: { nativemic: "off" }, nm: { mode: "new" } }],
  ["the new build with NATIVE_MIC_ON = false", { micOff: true, nm: { mode: "new" } }],
];
for (const [name, o] of WEB_CASES) scenario("detection: " + name, async (t) => {
  const { context, page, errors } = await open("/__blank.html", o);
  try {
    const r = await page.evaluate(async () => {
      const native = Sona.micNative();
      const st = await Sona.micOpen({ audio: true });
      const out = { native, real: st instanceof MediaStream, sonaNative: !!st.sonaNative, gum: __nm.gum, opens: __nm.opens.length, perms: __nm.perms.length, on: Sona.micStats().on };
      st.getTracks().forEach((x) => x.stop());
      const probe = await Sona.micProbe({ audio: true });
      out.probeReal = probe instanceof MediaStream; out.gum2 = __nm.gum; out.perms2 = __nm.perms.length;
      probe.getTracks().forEach((x) => x.stop());
      return out;
    });
    t.ok(name + ": micNative() is false", r.native === false, r);
    t.ok(name + ": the page's own getUserMedia runs, once, and answers a real MediaStream; the phone's micOpen is never called", r.real && !r.sonaNative && r.gum === 1 && r.opens === 0, r);
    t.ok(name + ": a permission ask (micProbe) is the page's own getUserMedia too, and never the phone's micPermission", r.probeReal && r.gum2 === 2 && r.perms2 === 0, r);
    if (o.micOff) t.ok(name + ": micStats() says the switch is off", r.on === false, r);
    clean(t, "detection " + name, errors);
  } finally { await context.close(); }
});
scenario("detection: the new build", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new" } });
  try {
    const r = await page.evaluate(async () => {
      const native = Sona.micNative(), logBefore = Capacitor.isLoggingEnabled;
      const st = await Sona.micOpen({ audio: true });
      const out = { native, logBefore, logAfter: Capacitor.isLoggingEnabled, real: st instanceof MediaStream, sonaNative: !!st.sonaNative, gum: __nm.gum, opens: __nm.opens.length, args: __nm.opens[0] && __nm.opens[0].args, first: __nm.closeCalls[0] };
      st.getTracks()[0].stop();
      return out;
    });
    t.ok("the new build: micNative() is true and micOpen opens Sona's own mic: getUserMedia is never called", r.native && r.sonaNative && !r.real && r.gum === 0 && r.opens === 1, r);
    t.ok("the new build: every knob the phone takes comes from the website (maxMs, duck, speaker, ioMs, frames)", r.args && r.args.maxMs === 300000 && r.args.duck === false && r.args.speaker === true && r.args.ioMs === 0 && r.args.frames === 1024, r.args);
    t.ok("the new build: before its first open the page closes whatever the last page left (micClose({ all: true }))", !!r.first && r.first.all === true, r.first);
    t.ok("Capacitor.isLoggingEnabled is false after the first open (debug builds log every bridge event in full)", r.logBefore === true && r.logAfter === false, r);
    clean(t, "the new build", errors);
  } finally { await context.close(); }
});
scenario("detection: a bridge that answers every method (an old build behind a proxy)", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "proxy" } });
  try {
    const r = await page.evaluate(async () => {
      const before = Sona.micNative();
      const a = await Sona.micOpen({ audio: true });
      const mid = { native: Sona.micNative(), gum: __nm.gum, unknown: __nm.unknown.slice(), stats: Sona.micStats() };
      const b = await Sona.micOpen({ audio: true });
      const p = await Sona.micProbe({ audio: true });
      [a, b, p].forEach((s) => s.getTracks().forEach((x) => x.stop()));
      return { before, real: a instanceof MediaStream && b instanceof MediaStream && p instanceof MediaStream, mid, gum: __nm.gum, unknown: __nm.unknown.slice() };
    });
    t.ok("proxy bridge: it looks like the new build at first, and the first open falls back to the page's own getUserMedia", r.before === true && r.real && r.mid.gum === 1, r);
    t.ok("proxy bridge: exactly one fallback, then the web mic for the rest of the page (no second native try)", r.mid.native === false && r.mid.stats.broken === true && r.gum === 3 && r.unknown.length === r.mid.unknown.length, r);
    clean(t, "proxy bridge", errors);
  } finally { await context.close(); }
});
// The pages themselves: an App Store build and the off switch run the
// say-it card's own getUserMedia line; the new build never does.
for (const [name, o] of [["an App Store build", { nm: { mode: "old" } }], ["sona.nativemic off", { kid: { muted: true, nativemic: "off" }, nm: { mode: "new" } }]]) scenario("detection on a page: " + name, async (t) => {
  const { context, page, errors } = await game("slice", Object.assign({ kid: { muted: true } }, o));
  try {
    await page.evaluate(() => crash());
    const opened = await until(page, () => __nm.mics.length === 1 && __nm.mics[0].start != null, 6000);
    const r = await phone(page);
    t.ok(name + ": the say-it card runs its own getUserMedia, once, and the phone's micOpen is never called", opened && r.gum === 1 && r.opens === 0, r);
    clean(t, "page " + name, errors);
  } finally { await context.close(); }
});

// ════════════════════════════════════════════════════════════════════════
// 2. THE STREAM A PAGE HOLDS
// ════════════════════════════════════════════════════════════════════════
scenario("the handle: track, stream, settings, events", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new", rate: 44100, frames: 4800 } });
  try {
    const r = await page.evaluate(async () => {
      const wait = (f, ms) => new Promise((res) => { const t0 = performance.now(); (function loop() { if (f() || performance.now() - t0 > ms) res(f()); else setTimeout(loop, 10); })(); });
      const st = await Sona.micOpen({ audio: true }), tr = st.getTracks()[0], o = {};
      const ctx = new AudioContext(); await ctx.resume();
      const src = Sona.micSource(ctx, st), an = ctx.createAnalyser(); src.connect(an);
      await new Promise((r) => setTimeout(r, 400));
      o.surface = { native: st.sonaNative, active: st.active, tracks: st.getTracks().length, audio: st.getAudioTracks().length, video: st.getVideoTracks().length, same: st.getAudioTracks()[0] === tr,
        kind: tr.kind, ready: tr.readyState, muted: tr.muted, enabled: tr.enabled, id: typeof tr.id === "string" && tr.id.length > 0 };
      o.settings = tr.getSettings();
      const ev = [];
      tr.onmute = () => ev.push("onmute"); tr.addEventListener("mute", () => ev.push("mute"));
      tr.onunmute = () => ev.push("onunmute"); tr.addEventListener("unmute", () => ev.push("unmute"));
      const g1 = Sona.micStats().live[0].g;
      __nm.ctl.interrupt();                                   // a call, or Siri
      o.muted = await wait(() => tr.muted, 1000); o.readyWhilePaused = tr.readyState; o.liveWhilePaused = __nm.live();
      __nm.ctl.interruptEnd();                                // iOS: you may record again
      o.unmuted = await wait(() => !tr.muted, 2000);
      const s2 = Sona.micStats().live[0]; o.g2 = s2 && s2.g; o.g1 = g1; o.events = ev.slice(); o.sameHandle = st.getTracks()[0] === tr;
      const calls = __nm.closeCalls.length;
      tr.stop();
      o.stopSync = { ready: tr.readyState, active: st.active, closeAsked: __nm.closeCalls.length === calls + 1 && __nm.closeCalls[calls].g === o.g2 };
      o.quiet = await Sona.micQuiet();
      o.after = { live: __nm.live(), closed: __nm.closed, opened: __nm.opened, closeMs: Sona.micStats().closeMaxMs };
      tr.stop(); o.secondStop = __nm.closeCalls.length === calls + 1;
      try { Sona.micSource(ctx, st); o.srcAfterEnd = "no error"; } catch (e) { o.srcAfterEnd = e.name; }
      // the phone ending a stream itself (the app went to the background) fires "ended"
      const st2 = await Sona.micOpen({ audio: true }), tr2 = st2.getTracks()[0]; let ended = 0;
      tr2.onended = () => ended++; tr2.addEventListener("ended", () => ended++);
      __nm.ctl.background();
      o.ended = await wait(() => tr2.readyState === "ended", 1000); o.endedEvents = ended; o.active2 = st2.active;
      // another open replacing it, and the phone closing it for its own reasons
      const st3 = await Sona.micOpen({ audio: true }), tr3 = st3.getTracks()[0]; let e3 = 0; tr3.onended = () => e3++;
      const st4 = await Sona.micOpen({ audio: true });
      o.replaced = { ended: await wait(() => tr3.readyState === "ended", 1000), events: e3, next: st4.getTracks()[0].readyState, why: Sona.micStats().opens.slice(-1)[0].why };
      let e4 = 0; st4.getTracks()[0].onended = () => e4++;
      __nm.ctl.end("closed");
      o.closedByPhone = { ended: await wait(() => st4.getTracks()[0].readyState === "ended", 1000), events: e4 };
      return o;
    });
    t.ok("the handle: a stream with one live audio track, no video, as every page reads one", r.surface.native && r.surface.active && r.surface.tracks === 1 && r.surface.audio === 1 && r.surface.video === 0 && r.surface.same && r.surface.kind === "audio" && r.surface.ready === "live" && !r.surface.muted && r.surface.enabled && r.surface.id, r.surface);
    const s = r.settings;
    t.ok("the handle: getSettings() says whose mic it is, its mode, route, rate, and no echo cancelling or noise suppression; auto gain is left unknown", s.sonaNative === true && s.sonaMode === "default" && s.sonaInput === "iPhone Microphone" && s.sonaOutput === "Speaker" && s.sampleRate === 44100 && s.echoCancellation === false && s.noiseSuppression === false && s.autoGainControl === undefined && s.sonaGain === 1 && s.sonaChunkMs === 109 && typeof s.sonaQueueMs === "number" && s.sonaGaps === 0, s);
    t.ok("the handle: a call pauses it: muted, still live, the phone's mic closed", r.muted && r.readyWhilePaused === "live" && r.liveWhilePaused === null, r);
    t.ok("the handle: micready picks it up again: unmuted, the same stream, a new open on the phone", r.unmuted && r.sameHandle && r.g2 > r.g1, r);
    t.ok("the handle: mute and unmute reach both onmute/onunmute and addEventListener", JSON.stringify(r.events) === JSON.stringify(["onmute", "mute", "onunmute", "unmute"]), r.events);
    t.ok("the handle: stop() is synchronous (ended, inactive) and asks the phone to close that open at once", r.stopSync.ready === "ended" && r.stopSync.active === false && r.stopSync.closeAsked, r.stopSync);
    t.ok("the handle: micQuiet() resolves once the phone has answered the close", r.quiet === true && !r.after.live && r.after.closed === r.after.opened && r.after.closeMs >= 15, r.after);
    t.ok("the handle: a second stop() asks nothing more, and a stopped stream gives no new source (InvalidStateError)", r.secondStop && r.srcAfterEnd === "InvalidStateError", r);
    t.ok("the handle: the phone ending it (the background) fires ended once on each listener kind", r.ended && r.endedEvents === 2 && r.active2 === false, r);
    t.ok("the handle: a second open replaces the first: the first ends (replaced), the second is live", r.replaced.ended && r.replaced.events === 1 && r.replaced.next === "live" && r.replaced.why === "replaced", r.replaced);
    t.ok("the handle: a close the phone makes itself ends the stream for the page", r.closedByPhone.ended && r.closedByPhone.events === 1, r.closedByPhone);
    clean(t, "the handle", errors);
  } finally { await context.close(); }
});

// The page hears what the phone heard: a 300 Hz tone at 0.141 rms, through
// Sona's own mic and through a real MediaStream of the same tone, into an
// AudioContext at 48 or 44.1 kHz, from a phone at 48 or 44.1 kHz, in 1024-
// or 4800-frame chunks, on time or up to 40 ms late.
scenario("the level and the pitch, every rate, chunk and delay", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new", source: "tone" } });
  try {
    const rows = await page.evaluate(async () => {
      const measure = async (ctx, src) => {
        const an = ctx.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0; src.connect(an);
        await new Promise((r) => setTimeout(r, 450));
        // a run of exact zeros is a gap in the feed (the queue ran dry: the
        // page's own starved-frame rule), not the level: it is counted, and
        // left out of the average
        let sum = 0, n = 0, all = 0, starved = 0; const peaks = [];
        for (let k = 0; k < 8; k++) {
          const b = new Float32Array(an.fftSize); an.getFloatTimeDomainData(b);
          for (let i = 0; i < b.length;) {
            let j = i; while (j < b.length && b[j] === 0) j++;
            if (j - i >= 32) { starved += j - i; i = j; continue; }
            const stop = Math.min(b.length, Math.max(j, i + 1));
            for (; i < stop; i++) { sum += b[i] * b[i]; n++; }
          }
          all += b.length;
          // the pitch: the spectrum's peak, between its bins (a parabola
          // through the three around it), frame by frame
          const f = new Float32Array(an.frequencyBinCount); an.getFloatFrequencyData(f);
          let p = 1; for (let i = 2; i < f.length - 1; i++) if (f[i] > f[p]) p = i;
          const d = f[p - 1] - 2 * f[p] + f[p + 1], off = d ? 0.5 * (f[p - 1] - f[p + 1]) / d : 0;
          peaks.push((p + off) * ctx.sampleRate / an.fftSize);
          await new Promise((r) => setTimeout(r, 30));
        }
        starved = +(starved / all).toFixed(3);
        try { src.disconnect(); } catch (e) {}
        peaks.sort((a, b) => a - b);
        return { rms: n ? Math.sqrt(sum / n) : 0, n, starved, hz: peaks[peaks.length >> 1], bin: ctx.sampleRate / an.fftSize };
      };
      const out = [], ctxs = {};
      for (const cr of [48000, 44100]) { ctxs[cr] = new AudioContext({ sampleRate: cr }); await ctxs[cr].resume(); }
      const web = {};
      for (const cr of [48000, 44100]) { const ws = await navigator.mediaDevices.getUserMedia({ audio: true }); web[cr] = await measure(ctxs[cr], ctxs[cr].createMediaStreamSource(ws)); ws.getTracks().forEach((x) => x.stop()); }
      for (const rate of [48000, 44100]) for (const cr of [48000, 44100]) for (const frames of [1024, 4800]) for (const jitter of [0, 40]) {
        __nm.ctl.set({ rate, frames, jitter });
        const st = await Sona.micOpen({ audio: true });
        const m = await measure(ctxs[cr], Sona.micSource(ctxs[cr], st));
        const set = st.getTracks()[0].getSettings();
        st.getTracks()[0].stop();
        out.push({ rate, cr, frames, jitter, rms: +m.rms.toFixed(4), web: +web[cr].rms.toFixed(4), db: +(20 * Math.log10(m.rms / web[cr].rms)).toFixed(2), hz: +m.hz.toFixed(1), webHz: +web[cr].hz.toFixed(1), set: set.sampleRate, gaps: set.sonaGaps, starved: m.starved, heard: m.n });
      }
      return out;
    });
    // (21 ms chunks up to 40 ms late can still run the queue dry now and then
    // in this browser; the gap is zeros, left out above, and the queue's own
    // checks below hold the iPhone's usual 100 ms chunks to none)
    const loud = rows.filter((r) => !(Math.abs(r.db) <= 1));
    t.ok("the level: Sona's own mic reads within 1 dB of a real stream of the same sound, in all 16 cases", rows.length === 16 && loud.length === 0 && rows.every((r) => r.heard >= 8192), loud.length ? loud : rows.map((r) => [r.db, r.gaps, r.starved].join("/")));
    // a rate taken wrongly would put it at 326 or 276 Hz
    const pitch = rows.filter((r) => Math.abs(r.hz - 300) > 5 || Math.abs(r.webHz - 300) > 5);
    t.ok("the pitch: the tone is still 300 Hz (the phone's rate is taken as it is: nothing plays fast or slow)", pitch.length === 0, pitch.length ? pitch : rows.map((r) => r.hz));
    t.ok("the stream says the phone's own rate", rows.every((r) => r.set === r.rate), rows.map((r) => r.set));
    t.ok("the reference is the tone itself: 0.141 rms through a real stream", rows.every((r) => Math.abs(r.web - 0.1414) < 0.01), rows.map((r) => r.web));
    clean(t, "level and pitch", errors);
  } finally { await context.close(); }
});

// The boost: 1.0 and untouched. Changing it changes what counts as heard,
// which is Rachel's call; Travis's measurement setting is the one way to try
// another, on one phone.
for (const [label, setting, want] of [["no boost", null, 1], ["a measurement boost of 1.5", '{"gain":1.5}', 1.5]]) scenario("the boost: " + label, async (t) => {
  const { context, page, errors } = await open("/__blank.html", { kid: setting ? { nativemic: setting } : {}, nm: { mode: "new", source: "tone" } });
  try {
    const r = await page.evaluate(async () => {
      const d = Object.getOwnPropertyDescriptor(AudioParam.prototype, "value"), writes = [];
      Object.defineProperty(AudioParam.prototype, "value", { configurable: true, get: d.get, set(v) { writes.push(this); return d.set.call(this, v); } });
      const links = [], conn = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (dst) { links.push([this, dst]); return conn.apply(this, arguments); };
      const ctx = new AudioContext(); await ctx.resume();
      const made = { buf: 0, osc: 0 }, mb = BaseAudioContext.prototype.createBufferSource, mo = BaseAudioContext.prototype.createOscillator;
      BaseAudioContext.prototype.createBufferSource = function () { if (this === ctx) made.buf++; return mb.apply(this, arguments); };
      BaseAudioContext.prototype.createOscillator = function () { if (this === ctx) made.osc++; return mo.apply(this, arguments); };
      const st = await Sona.micOpen({ audio: true });
      const src = Sona.micSource(ctx, st), an = ctx.createAnalyser(); an.fftSize = 4096; src.connect(an);
      await new Promise((r) => setTimeout(r, 700));
      const b = new Float32Array(an.fftSize); an.getFloatTimeDomainData(b); let s = 0; for (const x of b) s += x * x;
      const toSpeaker = links.filter(([a, z]) => a.__sonaMic && z instanceof AudioDestinationNode).length;
      return { GAIN: Sona.NATIVE_MIC_GAIN, value: src.gain.value, written: writes.includes(src.gain), rms: Math.sqrt(s / b.length), sonaGain: st.getTracks()[0].getSettings().sonaGain,
        mediaStream: src.mediaStream === st, mark: src.__sonaMic === true, isNode: src instanceof GainNode, toSpeaker, links: links.filter(([a]) => a.__sonaMic).length, made, sounds: __nm.sounds.length };
    });
    t.ok(label + ": Sona.NATIVE_MIC_GAIN is 1.0, the one constant", r.GAIN === 1, r);
    if (want === 1) t.ok(label + ": the page's node is a GainNode at 1, its gain never written (a written gain reads as a sound in some audits)", r.isNode && r.value === 1 && !r.written && Math.abs(r.rms - 0.1414) < 0.012, r);
    else t.ok(label + ": the setting turns the page's copy up by exactly that much, and the box says so", Math.abs(r.value - 1.5) < 1e-6 && r.written && r.sonaGain === 1.5 && Math.abs(r.rms / 0.1414 - 1.5) < 0.12, r);
    t.ok(label + ": the node carries .mediaStream (the stream it came from) and Sona's mark", r.mediaStream && r.mark, r);
    t.ok(label + ": no node sona.js made is ever connected to the speaker", r.toSpeaker === 0 && r.links > 0, r);
    t.ok(label + ": the bridge makes no buffer source and no oscillator, and plays nothing", r.made.buf === 0 && r.made.osc === 0 && r.sounds === 0, r);
    clean(t, "boost " + label, errors);
  } finally { await context.close(); }
});

// ════════════════════════════════════════════════════════════════════════
// 3. THE QUEUE between the phone's chunks and the page's audio clock
// ════════════════════════════════════════════════════════════════════════
scenario("the queue (Sona.micFifo)", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new" } });
  try {
    const r = await page.evaluate(() => {
      const out = {};
      // writes zeros only for the missing part
      let f = Sona.micFifo({ primeMs: 10, stepMs: 5, maxPrimeMs: 30 }, 1000);
      f.push(new Float32Array(12).fill(0.5), 1000); f.ready();
      const a = new Float32Array(8), b = new Float32Array(8); f.read(a); f.read(b);
      out.first = Array.from(a); out.second = Array.from(b); out.gaps = f.gaps;
      // never adds a sample: a counter in, random chunks, random bursts
      f = Sona.micFifo({ primeMs: 120, stepMs: 40, maxPrimeMs: 300 }, 48000);
      let k = 1, pushed = 0, got = [], seed = 3;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let step = 0; step < 400; step++) {
        if (rnd() < 0.3) { const n = 256 + Math.floor(rnd() * 4800), c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = (k++) / 1e7; pushed += n; f.push(c, 48000); }
        const o = new Float32Array(128); f.read(o); for (const x of o) if (x !== 0) got.push(x);
      }
      let order = true; for (let i = 1; i < got.length; i++) if (!(got[i] > got[i - 1])) { order = false; break; }
      out.never = { pushed, out: got.length, order, gaps: f.gaps };
      // exact zeros stay exact zeros through the resampler (44.1 kHz in, 48 out)
      f = Sona.micFifo({ primeMs: 10, stepMs: 5, maxPrimeMs: 30 }, 48000);
      const tone = (n) => { const c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = 0.3 * Math.sin(i / 7); return c; };
      f.push(tone(4410), 44100); f.push(new Float32Array(4410), 44100); f.push(tone(4410), 44100);
      const all = new Float32Array(f.depth); f.read(all);
      const zs = Math.round(4410 * 48000 / 44100), mid = all.subarray(Math.round(4410 * 48000 / 44100) + 4, Math.round(4410 * 48000 / 44100) + zs - 4);
      out.zeros = { checked: mid.length, nonzero: Array.from(mid).filter((x) => x !== 0).length, total: all.length };
      return out;
    });
    t.ok("the queue: running dry writes zeros only for the missing part, and counts one gap", JSON.stringify(r.first) === JSON.stringify(Array(8).fill(0.5)) && JSON.stringify(r.second) === JSON.stringify([0.5, 0.5, 0.5, 0.5, 0, 0, 0, 0]) && r.gaps === 1, r);
    t.ok("the queue: it never adds a sample: everything out was put in, in order (bursts are trimmed, never invented)", r.never.out > 0 && r.never.out <= r.never.pushed && r.never.order, r.never);
    t.ok("the queue: exact zeros stay exact zeros through the resampler, so a gap still reads as a gap", r.zeros.checked > 4000 && r.zeros.nonzero === 0, r.zeros);
    clean(t, "the queue", errors);
  } finally { await context.close(); }
});
scenario("the queue under late chunks and a busy page", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new", source: "tone", frames: 4800, jitter: 60, jitterMin: 30 } });
  try {
    const r = await page.evaluate(async () => {
      const ctx = new AudioContext(); await ctx.resume();
      const st = await Sona.micOpen({ audio: true }), src = Sona.micSource(ctx, st), an = ctx.createAnalyser(); src.connect(an);
      const s0 = Sona.micStats().live[0];
      await new Promise((r) => setTimeout(r, 3000));
      const s1 = Sona.micStats().live[0];
      const out = { jitter: { primeMs: s1.primeMs, gaps: s1.gaps, queueMs: s1.queueMs, queueMaxMs: s1.queueMaxMs, chunkMs: s1.chunkMs, g0: s0.gaps } };
      for (const ms of [300, 1200]) {
        const before = Sona.micStats().live[0].gaps;
        __nm.ctl.blockMain(ms);
        await new Promise((r) => setTimeout(r, 300));
        const a = Sona.micStats().live[0];
        await new Promise((r) => setTimeout(r, 900));
        const b = Sona.micStats().live[0];
        out["block" + ms] = { gaps: a.gaps - before, at300: a.queueMs, at1200: b.queueMs, maxMs: b.queueMaxMs, primeMs: b.primeMs, later: b.gaps - a.gaps };
      }
      const b = new Float32Array(2048); an.getFloatTimeDomainData(b); let s = 0; for (const x of b) s += x * x; out.rms = Math.sqrt(s / b.length);
      st.getTracks()[0].stop();
      return out;
    });
    t.ok("100 ms chunks arriving 30-60 ms late: no gap once the queue has primed", r.jitter.gaps === 0 && r.jitter.chunkMs === 100, r.jitter);
    for (const ms of [300, 1200]) {
      const b = r["block" + ms];
      // the queue's aim after a gap is a step deeper (primeMs + 40, at most 300 ms)
      t.ok("a " + ms + " ms block of the page's main thread: at most one gap, and none after it", b.gaps <= 1 && b.later === 0, b);
      t.ok("…and the queue is back near its aim, not left late for good (never more than its 300 ms cap above it)", b.at1200 <= 300 + 60 && b.at1200 > 0, b);
    }
    t.ok("…and the tone is still heard at its level", Math.abs(r.rms - 0.1414) < 0.015, r.rms);
    clean(t, "late chunks", errors);
  } finally { await context.close(); }
});
// The start: as the web path does, the first moments are not a run of zeros
// that would read as a dead room (the games' room floor only goes down).
scenario("the first frames", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new", source: "hiss", hissDb: -50 } });
  try {
    const r = await page.evaluate(async () => {
      const count = async (ctx, src) => {
        const an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an); const d = new Uint8Array(512);
        let zero = 0, frames = 0; const t0 = performance.now();
        await new Promise((res) => (function f() { an.getByteTimeDomainData(d); frames++; if (d.every((x) => x === 128)) zero++; if (performance.now() - t0 < 450) requestAnimationFrame(f); else res(); })());
        return { zero, frames };
      };
      const ctx = new AudioContext(); await ctx.resume();
      const ws = await navigator.mediaDevices.getUserMedia({ audio: true }); const web = await count(ctx, ctx.createMediaStreamSource(ws)); ws.getTracks().forEach((x) => x.stop());
      const ctx2 = new AudioContext(); await ctx2.resume();
      const st = await Sona.micOpen({ audio: true }); const own = await count(ctx2, Sona.micSource(ctx2, st));
      const s = Sona.micStats().live[0]; st.getTracks()[0].stop();
      return { web, own, leadZeroMs: s.leadZeroMs };
    });
    t.ok("the first 450 ms on a fresh context: no more all-silent frames than the web mic gives, plus one", r.own.frames > 10 && r.own.zero <= r.web.zero + 1, r);
    clean(t, "first frames", errors);
  } finally { await context.close(); }
});
scenario("a mic that starts in zeros", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new", source: "tone", warmZeros: 250 } });
  try {
    const r = await page.evaluate(async () => {
      const st = await Sona.micOpen({ audio: true }), ctx = new AudioContext(); await ctx.resume();
      const an = ctx.createAnalyser(); an.fftSize = 512; Sona.micSource(ctx, st).connect(an); const d = new Float32Array(512);
      let zero = 0, after = 0, heard = 0, lead = 0, frames = 0; const t0 = performance.now();
      await new Promise((res) => (function f() {
        an.getFloatTimeDomainData(d); frames++;
        const none = d.every((x) => x === 0);
        if (none) { zero++; if (heard) after++; else lead = performance.now() - t0; } else heard++;
        if (performance.now() - t0 < 400) requestAnimationFrame(f); else res();
      })());
      const s = Sona.micStats().live[0]; st.getTracks()[0].stop();
      return { zero, after, lead: Math.round(lead), frames, leadZeroMs: s.leadZeroMs, openMs: s.openMs };
    });
    // (a fresh analyser shows a frame or two of nothing before the first
    // render quantum lands, on the web mic too: "the first frames" above)
    t.ok("the mic's own warm-up zeros are never passed on: the open answers once real sound arrives, and once the page hears sound it never hears those zeros", r.leadZeroMs >= 240 && r.openMs >= 250 && r.after === 0 && r.lead < 80, r);
    clean(t, "warm zeros", errors);
  } finally { await context.close(); }
});
// The same consonants arrive: Rachel's R through a 44.1 kHz phone into a
// 48 kHz page has the shape it has through the web mic (frameShape's high
// share and centre, which the family check reads).
scenario("the shape of the sound through the resampler", async (t) => {
  const shapes = {};
  for (const [label, nm] of [["web", { mode: "old" }], ["own", { mode: "new", rate: 44100 }]]) {
    const { context, page, errors } = await open("/__blank.html", { nm: Object.assign({ hissDb: -70 }, nm) });
    try {
      shapes[label] = await page.evaluate(async (label) => {
        const ctx = new AudioContext({ sampleRate: 48000 }); await ctx.resume();
        const st = await Sona.micOpen({ audio: true }), an = ctx.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0; Sona.micSource(ctx, st).connect(an);
        await new Promise((r) => setTimeout(r, 300));
        for (const s of ["S", "R"]) await __nm.ctl.say(0, 1, s);   // decoded before the clock starts
        // frameShape over every loud frame while a sound plays, as the
        // games' family check reads it
        const listen = (ms) => {
          const td = new Uint8Array(512), fd = new Uint8Array(256), acc = { m: 0, fm: 0, hm: 0, n: 0 }, t0 = performance.now();
          return new Promise((res) => (function f() {
            an.getByteTimeDomainData(td); let q = 0; for (const x of td) q += ((x - 128) / 128) ** 2;
            if (Math.sqrt(q / 512) > 0.05) { an.getByteFrequencyData(fd); const sh = Sona.frameShape(fd, ctx.sampleRate / 512); if (sh && sh.m) { acc.m += sh.m; acc.fm += sh.fm; acc.hm += sh.hm; acc.n++; } }
            if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(acc);
          })());
        };
        const out = {};
        // white noise, at the stream's own rate: flat to 12 kHz either way,
        // so any tilt is the path's own
        const rate = label === "own" ? 44100 : 48000, noise = new Float32Array(Math.round(rate * 1.5));
        let seed = 9; for (let i = 0; i < noise.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; noise[i] = 0.3 * (seed / 2147483648 - 1); }
        __nm.ctl.feed(noise, rate);
        await new Promise((r) => setTimeout(r, 300));
        let acc = await listen(900);
        out.noise = { cent: acc.fm / acc.m, high: acc.hm / acc.m, frames: acc.n };
        await new Promise((r) => setTimeout(r, 600));
        // Rachel's S and R, each three times
        for (const s of ["S", "R"]) {
          const sum = { m: 0, fm: 0, hm: 0, n: 0 };
          for (let k = 0; k < 3; k++) {
            await __nm.ctl.say(0, 700, s, 0.05);
            acc = await listen(850);
            for (const x of ["m", "fm", "hm", "n"]) sum[x] += acc[x];
            await new Promise((r) => setTimeout(r, 250));
          }
          out[s] = { cent: sum.fm / sum.m, high: sum.hm / sum.m, frames: sum.n };
        }
        st.getTracks().forEach((x) => x.stop());
        return out;
      }, label);
      clean(t, "shape " + label, errors);
    } finally { await context.close(); }
  }
  const near = (a, b, rel, abs) => Math.abs(a - b) <= Math.max(rel * Math.abs(b), abs || 0);
  const n = shapes;
  t.ok("white noise: its high share and its centre on Sona's own mic (44.1 kHz in, 48 kHz out) are within 5% of the web mic's", n.web.noise.frames > 10 && n.own.noise.frames > 10 && near(n.own.noise.high, n.web.noise.high, 0.05) && near(n.own.noise.cent, n.web.noise.cent, 0.05), { web: n.web.noise, own: n.own.noise });
  // R's high share is a tiny number (about 0.014): a frame more or less of
  // its hiss-free middle moves it by more than 5% of itself, so it is held
  // to 0.005 instead
  for (const s of ["S", "R"]) {
    const a = n.web[s], b = n.own[s];
    t.ok("Rachel's " + s + ": its centre within 5% of the web mic's, its high share within 5% (or 0.005)", a.frames > 15 && b.frames > 15 && near(b.cent, a.cent, 0.05) && near(b.high, a.high, 0.05, 0.005), { web: a, own: b });
  }
});


// ════════════════════════════════════════════════════════════════════════
// 4. THE KEEPSAKE CLIP: a local WAV, handed over the way MediaRecorder does
// ════════════════════════════════════════════════════════════════════════
scenario("the recorder", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new", source: "tone" } });
  try {
    const r = await page.evaluate(async () => {
      const st = await Sona.micOpen({ audio: true }), o = {};
      const rc = Sona.micRecorder(st), order = []; let blob = null;
      rc.ondataavailable = (e) => { order.push("data"); blob = e.data; }; rc.onstop = () => order.push("stop");
      rc.start(); o.state = rc.state; o.mime = rc.mimeType;
      const t0 = performance.now(); await new Promise((r) => setTimeout(r, 1000));
      rc.stop(); const ms = performance.now() - t0; order.push("stop() returned");
      await new Promise((r) => setTimeout(r, 30));
      const v = new DataView(await blob.arrayBuffer()), tag = (i) => String.fromCharCode(v.getUint8(i), v.getUint8(i + 1), v.getUint8(i + 2), v.getUint8(i + 3));
      o.order = order; o.type = blob.type; o.size = blob.size; o.ms = ms;
      o.head = { riff: tag(0), wave: tag(8), fmt: v.getUint16(20, true), ch: v.getUint16(22, true), rate: v.getUint32(24, true), bits: v.getUint16(34, true) };
      let peak = 0; for (let i = 44; i + 1 < blob.size; i += 2) peak = Math.max(peak, Math.abs(v.getInt16(i, true)));
      o.peak = peak / 32767;
      // nothing heard: an empty blob, which the page drops
      const rc2 = Sona.micRecorder(st); let b2 = null; rc2.ondataavailable = (e) => { b2 = e.data; }; rc2.start(); rc2.stop();
      await new Promise((r) => setTimeout(r, 20)); o.empty = b2 && b2.size; o.emptyType = b2 && b2.type;
      // a mic the phone ends stops its recorder too
      const rc3 = Sona.micRecorder(st), o3 = []; rc3.ondataavailable = (e) => o3.push("data " + e.data.size); rc3.onstop = () => o3.push("stop"); rc3.start();
      await new Promise((r) => setTimeout(r, 300)); __nm.ctl.background(); await new Promise((r) => setTimeout(r, 60));
      o.byItself = o3; o.state3 = rc3.state;
      // the web mic gets the browser's own recorder
      const ws = await navigator.mediaDevices.getUserMedia({ audio: true }); o.webRecorder = Sona.micRecorder(ws) instanceof MediaRecorder; ws.getTracks().forEach((x) => x.stop());
      return o;
    });
    t.ok("the recorder: data, then stop, a task after stop() (as MediaRecorder hands them over)", JSON.stringify(r.order) === JSON.stringify(["stop() returned", "data", "stop"]) && r.state === "recording", r.order);
    t.ok("the recorder: the clip is audio/wav, mono 16-bit at 24000 Hz", r.type === "audio/wav" && r.mime === "audio/wav" && r.head.riff === "RIFF" && r.head.wave === "WAVE" && r.head.fmt === 1 && r.head.ch === 1 && r.head.rate === 24000 && r.head.bits === 16, r.head);
    const perSec = (r.size - 44) / (r.ms / 1000);
    t.ok("the recorder: about 48 KB a second, and it holds the sound (the tone's 0.2 peak)", perSec > 40000 && perSec < 52000 && Math.abs(r.peak - 0.2) < 0.02, { size: r.size, ms: r.ms, perSec, peak: r.peak });
    t.ok("the recorder: nothing heard is a zero-byte blob, which practice drops", r.empty === 0 && r.emptyType === "audio/wav", r);
    t.ok("the recorder: it stops by itself when the phone ends the mic, keeping what it had", r.byItself.length === 2 && /^data \d+$/.test(r.byItself[0]) && Number(r.byItself[0].slice(5)) > 10000 && r.byItself[1] === "stop" && r.state3 === "inactive", r.byItself);
    t.ok("the recorder: on the web mic it is the browser's own MediaRecorder", r.webRecorder === true, r);
    clean(t, "recorder", errors);
  } finally { await context.close(); }
});

// ════════════════════════════════════════════════════════════════════════
// 5. PERMISSION AND FAILURE
// ════════════════════════════════════════════════════════════════════════
for (const [label, nm, want] of [
  ["granted", { perm: "granted" }, "dead"],
  ["denied", { perm: "denied" }, "NotAllowedError"],
  ["never asked, the grown-up allows it", { perm: "prompt", onAsk: "grant" }, "dead"],
  ["never asked, the grown-up says no", { perm: "prompt", onAsk: "deny" }, "NotAllowedError"],
]) scenario("the permission ask (micProbe): " + label, async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: Object.assign({ mode: "new" }, nm) });
  try {
    const r = await page.evaluate(async () => {
      try {
        const st = await Sona.micProbe({ audio: true, video: false });
        const tr = st.getTracks()[0];
        st.getTracks().forEach((x) => x.stop());
        return { ok: true, active: st.active, ready: tr.readyState, sonaNative: st.sonaNative, perms: __nm.perms.slice(), opens: __nm.opens.length, gum: __nm.gum };
      } catch (e) { return { ok: false, name: e.name, perms: __nm.perms.slice(), opens: __nm.opens.length, gum: __nm.gum }; }
    });
    if (want === "dead") t.ok("micProbe " + label + ": it answers a stream that is already over: no mic opens, no orange dot", r.ok && r.active === false && r.ready === "ended" && r.sonaNative === true, r);
    else t.ok("micProbe " + label + ": a refusal is NotAllowedError (the existing screens), never a web-mic ask", !r.ok && r.name === "NotAllowedError", r);
    t.ok("micProbe " + label + ": it asks the phone's permission with request: true, and opens nothing", r.perms.length === 1 && r.perms[0].request === true && r.opens === 0 && r.gum === 0, r);
    clean(t, "micProbe " + label, errors);
  } finally { await context.close(); }
});
const OPEN = async (page) => page.evaluate(async () => {
  try {
    const st = await Sona.micOpen({ audio: true, video: false });
    const out = { ok: true, real: st instanceof MediaStream, own: !!st.sonaNative, gum: __nm.gum, opens: __nm.opens.length, native: Sona.micNative(), stats: Sona.micStats() };
    window.__last = st; return out;
  } catch (e) { return { ok: false, name: e.name, gum: __nm.gum, opens: __nm.opens.length, native: Sona.micNative(), stats: Sona.micStats() }; }
});
scenario("failure: refused", async (t) => {
  for (const nm of [{ perm: "denied" }, { perm: "prompt", onAsk: "deny" }]) {
    const { context, page, errors } = await open("/__blank.html", { nm: Object.assign({ mode: "new" }, nm) });
    try {
      const a = await OPEN(page);
      t.ok("refused (" + nm.perm + "): micOpen rejects NotAllowedError and never falls back to the web mic", !a.ok && a.name === "NotAllowedError" && a.gum === 0, a);
      t.ok("refused (" + nm.perm + "): a refusal is not a fault: the next listen asks the phone again", a.native === true && a.stats.broken === false, a);
      clean(t, "refused " + nm.perm, errors);
    } finally { await context.close(); }
  }
});
scenario("failure: the phone says not now (busy)", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new", openFail: "busy" } });
  try {
    const a = await OPEN(page); await page.evaluate(() => __last.getTracks().forEach((x) => x.stop()));
    const b = await OPEN(page); await page.evaluate(() => __last.getTracks().forEach((x) => x.stop()));
    t.ok("busy: that listen gets one web-mic try", a.ok && a.real && a.gum === 1 && a.stats.busy === 1, a);
    t.ok("busy: …and it is not sticky: the next listen is Sona's own mic again", b.ok && b.own && b.gum === 1 && b.opens === 2 && b.native, b);
    clean(t, "busy", errors);
  } finally { await context.close(); }
});
for (const [label, nm, why] of [
  ["no microphone (nomic)", { openFail: "nomic" }, "nomic"],
  ["the engine would not start", { openFail: "engine" }, "engine"],
  ["no sound within 1.5 s", { warmZeros: 2500 }, "silent"],
]) scenario("failure: " + label, async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: Object.assign({ mode: "new" }, nm) });
  try {
    const a = await OPEN(page); await page.evaluate(() => __last.getTracks().forEach((x) => x.stop()));
    const b = await OPEN(page); await page.evaluate(() => __last.getTracks().forEach((x) => x.stop()));
    const s = await shut(page);
    t.ok(label + ": the listen goes on through the page's own getUserMedia", a.ok && a.real && a.gum === 1 && a.stats.why === why, a);
    t.ok(label + ": exactly one fallback: the web mic for the rest of the page, the phone not asked again", b.ok && b.real && b.gum === 2 && b.opens === 1 && b.native === false && b.stats.broken === true, b);
    if (why === "silent") closedOk(t, label + ": the silent stream", s);
    clean(t, label, errors);
  } finally { await context.close(); }
});
scenario("failure: the phone answers too late", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new", openDelay: 4500 } });
  try {
    const t0 = Date.now(), a = await OPEN(page), ms = Date.now() - t0;
    await page.waitForTimeout(900);
    const r = await phone(page);
    t.ok("an open with the permission given that has not answered in 4 s goes on through the web mic", a.ok && a.real && ms >= 3900 && ms < 4600 && a.stats.why === "timeout", { a, ms });
    t.ok("…and the late answer, when it comes, is closed at once", r.opened === 1 && r.closed === 1 && !r.live && r.events.some((e) => e.name === "micend"), r);
    clean(t, "late answer", errors);
  } finally { await context.close(); }
});
scenario("failure: the page lost its listeners", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new", source: "tone", openFail: "nolistener" } });
  try {
    const a = await OPEN(page);
    const subs = await page.evaluate(() => __nm.listeners.filter((n) => n === "micpcm").length);
    t.ok("nolistener: the page subscribes again, once, and opens Sona's own mic", a.ok && a.own && a.opens === 2 && a.gum === 0 && subs === 2, { a, subs });
    // Capacitor drops a page's listeners mid-listen (a navigation that never committed)
    const r = await page.evaluate(async () => {
      const ctx = new AudioContext(); await ctx.resume();
      const st = __last, tr = st.getTracks()[0], an = ctx.createAnalyser(); an.fftSize = 2048; Sona.micSource(ctx, st).connect(an);
      await new Promise((r) => setTimeout(r, 500));
      const g1 = Sona.micStats().live[0].g; __nm.ctl.dropListeners(); const t0 = performance.now();
      let muted = false;
      const back = await new Promise((res) => (function f() {
        if (tr.muted) muted = true;
        const s = Sona.micStats().live[0];
        if (s && s.g !== g1 && s.state === "live" && !tr.muted) res(performance.now() - t0); else if (performance.now() - t0 > 6000) res(-1); else setTimeout(f, 20);
      })());
      await new Promise((r) => setTimeout(r, 400));
      const b = new Float32Array(2048); an.getFloatTimeDomainData(b); let s = 0; for (const x of b) s += x * x;
      return { back, muted, same: st.getTracks()[0] === tr, rms: Math.sqrt(s / b.length), subs: __nm.listeners.filter((n) => n === "micpcm").length };
    });
    // the page's 2.5 s watch, a yield, a quarter-second, then the open
    t.ok("lost listeners mid-listen: the page notices, subscribes again and picks the same stream up in about 3 s", r.back > 2400 && r.back <= 3500 && r.muted && r.same && r.subs === 3, r);
    t.ok("…and hears the sound again", Math.abs(r.rms - 0.1414) < 0.015, r);
    // the phone going quiet with the listeners still there: the page re-opens
    // and keeps the one set it has (Capacitor keeps every set it is given,
    // and sends each chunk once per set)
    const q = await page.evaluate(async () => {
      const tr = __last.getTracks()[0], g1 = Sona.micStats().live[0].g; __nm.ctl.stall(4000); const t0 = performance.now();
      const back = await new Promise((res) => (function f() {
        const s = Sona.micStats().live[0];
        if (s && s.g !== g1 && s.state === "live" && !tr.muted) res(performance.now() - t0); else if (performance.now() - t0 > 6000) res(-1); else setTimeout(f, 20);
      })());
      return { back, subs: __nm.listeners.filter((n) => n === "micpcm").length };
    });
    t.ok("a silent phone, listeners intact: the page re-opens without subscribing again", q.back > 2400 && q.back <= 3500 && q.subs === 3, q);
    clean(t, "nolistener", errors);
  } finally { await context.close(); }
});
scenario("failure: a call during the open", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new", firstDelay: 600 } });
  try {
    const p = OPEN(page);
    await until(page, () => __nm.opened === 1, 2000);
    await page.evaluate(() => __nm.ctl.interrupt());
    const a = await p;
    t.ok("a call that ends the open before it could start: NotReadableError (the pages' temporary path), not a fault and not the web mic", !a.ok && a.name === "NotReadableError" && a.gum === 0 && a.native === true, a);
    clean(t, "call during open", errors);
  } finally { await context.close(); }
});
// The two orders the bridge can deliver in: the answer first, or a chunk first.
for (const answerFirst of [true, false]) scenario("event order: " + (answerFirst ? "the answer first" : "a chunk before the answer"), async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new", source: "tone", answerFirst } });
  try {
    const r = await page.evaluate(async () => {
      const st = await Sona.micOpen({ audio: true }), ctx = new AudioContext(); await ctx.resume();
      const an = ctx.createAnalyser(); an.fftSize = 2048; Sona.micSource(ctx, st).connect(an);
      await new Promise((r) => setTimeout(r, 400));
      const b = new Float32Array(2048); an.getFloatTimeDomainData(b); let s = 0; for (const x of b) s += x * x;
      const st2 = Sona.micStats().live[0]; st.getTracks()[0].stop();
      return { own: st.sonaNative, rms: Math.sqrt(s / b.length), lead: st2.leadZeroMs };
    });
    t.ok((answerFirst ? "answer first" : "chunk first") + ": the open binds and the page hears it (a chunk that beats the answer is kept)", r.own && Math.abs(r.rms - 0.1414) < 0.015, r);
    clean(t, "order " + answerFirst, errors);
  } finally { await context.close(); }
});
// Apple's word check rides on the page's stream, or does not run at all.
scenario("Apple's check: the stream it listens on", async (t) => {
  for (const mode of ["new", "old"]) {
    const { context, page, errors } = await open("/__blank.html", { nm: { mode, text: "rabbit" } });
    try {
      const r = await page.evaluate(async () => {
        const st = await Sona.micOpen({ audio: true }), live = __nm.live();
        const started = await Sona.speechStart({ words: ["rabbit"], maxMs: 5000 });
        const first = __nm.starts[0]; await Sona.speechStop();
        st.getTracks().forEach((x) => x.stop()); await Sona.micQuiet();
        const after = await Sona.speechStart({ words: ["rabbit"], maxMs: 5000 });
        return { started, first, live, after, second: __nm.starts[1] };
      });
      if (mode === "new") {
        t.ok("on Sona's own mic speechStart names the page's stream (g)", r.started === true && r.first && r.first.g === r.live.g && r.first.words[0] === "rabbit", r);
        t.ok("a check whose stream has closed is refused (nostream): speechStart answers false and the page carries on with the spectral check", r.after === false && r.second && typeof r.second.g === "number", r);
      } else t.ok("on the web mic (an App Store build) speechStart names no stream, exactly as before", r.started === true && r.first && !("g" in r.first) && r.after === true && !("g" in r.second), r);
      clean(t, "Apple's check " + mode, errors);
    } finally { await context.close(); }
  }
});

// A fault elsewhere (the worklet module failing to load) turns micNative()
// off for the page while this stream carries on, on the stopgap. Apple's
// check must still name the stream: a start that names none makes the
// plugin close it ("replaced") and open the mic the old way, in measurement
// mode with call-quality AirPods.
scenario("Apple's check: after a fault elsewhere, the live stream still names itself", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new", text: "rabbit" } });
  try {
    const r = await page.evaluate(async () => {
      AudioWorklet.prototype.addModule = () => new Promise((res, rej) => setTimeout(() => rej(new Error("no module")), 5));
      const st = await Sona.micOpen({ audio: true }), ctx = new AudioContext(); await ctx.resume();
      Sona.micSource(ctx, st).connect(ctx.createAnalyser());
      await new Promise((r) => setTimeout(r, 100));
      const stats = Sona.micStats(), live = __nm.live();
      const started = await Sona.speechStart({ words: ["rabbit"] });
      const first = __nm.starts[0]; await Sona.speechStop();
      const still = { ready: st.getTracks()[0].readyState, live: __nm.live() };
      st.getTracks()[0].stop(); await Sona.micQuiet();
      // the next listen is the web mic: its check names no stream, as before
      const web = await Sona.micOpen({ audio: true });
      await Sona.speechStart({ words: ["rabbit"] }); const second = __nm.starts[1]; await Sona.speechStop();
      web.getTracks().forEach((x) => x.stop());
      return { broken: stats.broken, why: stats.why, native: stats.native, live, started, first, still, webReal: web instanceof MediaStream, second };
    });
    t.ok("a worklet that fails to load: the page is off Sona's mic for its next listen, this one carries on", r.broken && r.why === "worklet" && r.native === false && r.still.ready === "live" && !!r.still.live, r);
    t.ok("…and Apple's check still names this stream (g), never the old path behind it", r.started === true && r.first && r.first.g === r.live.g, r);
    t.ok("…while the next listen, on the web mic, names none", r.webReal && r.second && !("g" in r.second), r);
    clean(t, "check after a fault", errors);
  } finally { await context.close(); }
});
// NEVER BOTH MICS AT ONCE. A re-open after a call fails ("nomic"), so the
// web mic is asked for; while it is still being asked, iOS's micready (or
// the return to the page) must not open Sona's own mic beside it.
scenario("two mics never: a micready while the web mic is taking over", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new", openFail: [null, "nomic", null] } });
  try {
    const r = await page.evaluate(async () => {
      const gum = navigator.mediaDevices.getUserMedia;
      navigator.mediaDevices.getUserMedia = function () { const p = gum.apply(this, arguments); return new Promise((res, rej) => setTimeout(() => p.then(res, rej), 400)); };
      const st = await Sona.micOpen({ audio: true }), ctx = new AudioContext(); await ctx.resume();
      Sona.micSource(ctx, st).connect(ctx.createAnalyser());
      await new Promise((r) => setTimeout(r, 300));
      __nm.ctl.interrupt();
      await new Promise((r) => setTimeout(r, 100));
      __nm.ctl.interruptEnd();                                   // re-open: fails "nomic", the web mic is asked for
      const t0 = performance.now(); while (__nm.gum < 1 && performance.now() - t0 < 2000) await new Promise((r) => setTimeout(r, 5));
      await new Promise((r) => setTimeout(r, 60));
      __nm.ctl.interruptEnd();                                   // a second micready while it is asked
      document.dispatchEvent(new Event("visibilitychange"));     // and the page coming back
      await new Promise((r) => setTimeout(r, 1000));
      const open = __nm.mics.filter((m) => m.end == null).map((m) => m.kind);
      const out = { live: __nm.live(), own: st.getTracks()[0].getSettings().sonaNative, opens: __nm.opens.length, open, gum: __nm.gum, ready: st.getTracks()[0].readyState };
      st.getTracks()[0].stop();
      return out;
    });
    t.ok("a micready while the web mic is asked for opens nothing: the web mic alone, the phone's own closed", r.live === null && r.own === false && r.opens === 2 && r.gum === 1 && JSON.stringify(r.open) === '["web"]' && r.ready === "live", r);
    const s = await shut(page);
    closedOk(t, "two mics never", s);
    clean(t, "two mics never", errors);
  } finally { await context.close(); }
});
// The page leaving (pagehide) mid-open, and coming back from the
// back-forward cache: the open ends as the temporary kind (NotReadableError,
// the pages' "try again"), never as a fault that would put the restored page
// on the web mic for good, and an answer that still comes is closed.
for (const [label, nm, at] of [
  ["answered, waiting for its first sound", { firstDelay: 1200 }, "opening"],
  ["still waiting for the phone's answer", { openDelay: 500 }, "asked"],
]) scenario("a page that hides while its mic opens (" + label + ")", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: Object.assign({ mode: "new" }, nm) });
  try {
    const r = await page.evaluate(async (at) => {
      const wait = (f, ms) => new Promise((res) => { const t0 = performance.now(); (function loop() { if (f() || performance.now() - t0 > ms) res(f()); else setTimeout(loop, 5); })(); });
      const p = Sona.micOpen({ audio: true }).then((st) => ({ ok: true, real: st instanceof MediaStream, own: !!st.sonaNative }), (e) => ({ ok: false, name: e.name }));
      const reached = await wait(() => at === "opening" ? (Sona.micStats().live[0] || {}).state === "opening" : __nm.opens.length === 1, 2000);
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      const a = await p;
      await new Promise((r) => setTimeout(r, 2200));             // past every clock the open had
      const stats = Sona.micStats(), live = __nm.live(), gum = __nm.gum;
      const b = await Sona.micOpen({ audio: true }).then((st) => { const o = { ok: true, own: !!st.sonaNative }; st.getTracks()[0].stop(); return o; }, (e) => ({ ok: false, name: e.name }));
      return { reached, a, broken: stats.broken, why: stats.why, live, gum, b };
    }, at);
    t.ok("hidden mid-open (" + label + "): the open ends as NotReadableError, the temporary kind", r.reached && !r.a.ok && r.a.name === "NotReadableError", r);
    t.ok("…not a fault: no web mic, the page still on Sona's own mic, and nothing of that open left live", r.gum === 0 && r.broken === false && r.live === null, r);
    t.ok("…and the next listen opens Sona's own mic", r.b.ok && r.b.own, r);
    clean(t, "hidden mid-open " + label, errors);
  } finally { await context.close(); }
});
// THE FEED'S EAR (Sona.micDeaf). A page's room floor only goes down; the
// frames between the phone's samples (a pause, a re-open, a chunk later than
// the queue is deep) are exact zeros, and must never be read as the room.
scenario("micDeaf: Sona's own mic, between its samples", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new", source: "hiss" } });
  try {
    const r = await page.evaluate(async () => {
      const wait = (f, ms) => new Promise((res) => { const t0 = performance.now(); (function loop() { if (f() || performance.now() - t0 > ms) res(f()); else setTimeout(loop, 5); })(); });
      const st = await Sona.micOpen({ audio: true }), ctx = new AudioContext(); await ctx.resume();
      const an = ctx.createAnalyser(); an.fftSize = 512; Sona.micSource(ctx, st).connect(an);
      const b = new Float32Array(512);
      // every frame for a while: is it deaf, and does it hold a run of zeros?
      const watch = (ms) => new Promise((res) => {
        const rows = [], t0 = performance.now();
        (function f() {
          an.getFloatTimeDomainData(b); let run = 0, gap = false; for (let i = 0; i < b.length; i++) { if (b[i] !== 0) run = 0; else if (++run >= 96) { gap = true; break; } }
          rows.push({ deaf: Sona.micDeaf(st), gap, muted: st.getTracks()[0].muted });
          if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(rows);
        })();
      });
      await new Promise((r) => setTimeout(r, 400));
      const steady = await watch(800);
      __nm.ctl.stall(500);
      const stall = await watch(1200);
      __nm.ctl.stalled();
      const paused = await wait(() => st.getTracks()[0].muted, 1000), whilePaused = Sona.micDeaf(st);
      const back = await wait(() => !st.getTracks()[0].muted && !Sona.micDeaf(st), 3000);
      const after = await watch(600);
      const real = await navigator.mediaDevices.getUserMedia({ audio: true });
      const out = { realDeaf: Sona.micDeaf(real), noStream: Sona.micDeaf(null), steady, stall, paused, whilePaused, back, after };
      real.getTracks().forEach((x) => x.stop()); st.getTracks()[0].stop();
      out.ended = Sona.micDeaf(st);
      return out;
    });
    const sum = (rows) => ({ frames: rows.length, deaf: rows.filter((x) => x.deaf).length, gaps: rows.filter((x) => x.gap).length, gapNotDeaf: rows.filter((x) => x.gap && !x.deaf).length });
    const s0 = sum(r.steady), s1 = sum(r.stall), s2 = sum(r.after);
    t.ok("micDeaf: a steady stream is never deaf", s0.frames > 20 && s0.deaf === 0 && s0.gaps === 0, s0);
    t.ok("micDeaf: chunks that stop for half a second: every frame holding a gap is deaf, and it hears again after", s1.gaps > 5 && s1.gapNotDeaf === 0 && !r.stall[r.stall.length - 1].deaf, s1);
    t.ok("micDeaf: a pause (the phone's engine stalled) is deaf until the new open's sound is back, and the track unmutes with it", r.paused && r.whilePaused === true && r.back && s2.deaf === 0 && s2.gaps === 0, { paused: r.paused, whilePaused: r.whilePaused, back: r.back, s2 });
    t.ok("micDeaf: a real MediaStream (the web mic) and no stream are never deaf; a stopped handle is", r.realDeaf === false && r.noStream === false && r.ended === true, r);
    clean(t, "micDeaf", errors);
  } finally { await context.close(); }
});

// ════════════════════════════════════════════════════════════════════════
// 6. EXITS AT THE BRIDGE: stale chunks, a page that leaves, a page that finds
// ════════════════════════════════════════════════════════════════════════
scenario("a chunk for an open nobody holds", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new" } });
  try {
    const r = await page.evaluate(async () => {
      const st = await Sona.micOpen({ audio: true }); st.getTracks()[0].stop(); await Sona.micQuiet();
      const before = __nm.closeCalls.length;
      __nm.ctl.staleChunk(99); __nm.ctl.staleChunk(99);
      await new Promise((r) => setTimeout(r, 100));
      return { calls: __nm.closeCalls.slice(before) };
    });
    t.ok("a chunk for an open nobody holds is ignored, and that open is closed, once", r.calls.length === 1 && r.calls[0].g === 99, r);
    clean(t, "stale chunk", errors);
  } finally { await context.close(); }
});
scenario("a page that leaves while listening", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new" } });
  try {
    await page.evaluate(async () => { const st = await Sona.micOpen({ audio: true }); const ctx = new AudioContext(); Sona.micSource(ctx, st).connect(ctx.createAnalyser()); });
    await page.goto(base + "/__two.html");
    const k = await page.evaluate(() => __nm.kept);
    t.ok("pagehide closes the phone's mic before the page goes (the next page finds nothing live)", k.opened === 1 && k.closed === 1 && !k.live && k.pagehideCloses >= 1, k);
    clean(t, "pagehide", errors);
  } finally { await context.close(); }
});
scenario("a new page that finds a mic still open", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { nm: { mode: "new", staleChunkMs: 8000 } });
  try {
    // the last page held a stream and died before its close reached the phone
    const g = await page.evaluate(async () => { await Sona.micOpen({ audio: true }); __nm.ctl.crash(); return __nm.live().g; });
    await page.reload();
    const r = await page.evaluate(async () => {
      const stale = __nm.live();
      const st = await Sona.micOpen({ audio: true });
      const out = { stale, calls: __nm.closeCalls.slice(), ends: __nm.ends.slice(), g: Sona.micStats().live[0].g };
      st.getTracks()[0].stop(); return out;
    });
    t.ok("the new page's first step closes whatever the last one left (micClose({ all: true })), before it opens its own", r.stale && r.stale.g === g && r.calls[0].all === true && r.ends[0].g === g && r.ends[0].reason === "closed" && r.g > g, { g, r });
    clean(t, "stale live mic", errors);
  } finally { await context.close(); }
});

// ════════════════════════════════════════════════════════════════════════
// 7. BACKUPS, AND THE SOURCE
// ════════════════════════════════════════════════════════════════════════
scenario("backups never carry sona.nativemic", async (t) => {
  const { context, page, errors } = await open("/__blank.html", { kid: { nativemic: '{"gain":2}' }, nm: { mode: "new" } });
  try {
    const r = await page.evaluate(() => {
      const out = Sona.exportData(), str = Sona.exportString();
      const res = Sona.importData({ app: "sona", v: 1, data: { "sona.nativemic": "off", "sona.micok": "1" } });
      return { exported: "sona.nativemic" in out.data, inString: /nativemic/.test(str), kept: localStorage.getItem("sona.nativemic"), res };
    });
    t.ok("an export taken with sona.nativemic set does not contain it", !r.exported && !r.inString, r);
    t.ok("an import that carries one is not let in (this phone's own stays)", r.kept === '{"gain":2}', r);
  } finally { await context.close(); }
  const lists = { exp: (SONA.match(/const NO_EXPORT = \[([^\]]*)\]/) || [])[1] || "", imp: (SONA.match(/const NO_IMPORT = \[([\s\S]*?)\];/) || [])[1] || "" };
  t.ok("sona.nativemic is on NO_EXPORT and NO_IMPORT", /"sona\.nativemic"/.test(lists.exp) && /"sona\.nativemic"/.test(lists.imp), lists);
});
scenario("source pins", async (t) => {
  const a = SONA.indexOf("SONA'S OWN MICROPHONE IN THE IPHONE APP"), b = SONA.indexOf("END OF SONA'S OWN MICROPHONE");
  const block = a > 0 && b > a ? strip(SONA.slice(a, b)) : "";
  const sends = ["fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "FormData", ".send("].filter((w) => block.includes(w));
  t.ok("NO AUDIO LEAVES THE PHONE: the native mic block in sona.js has no fetch, XMLHttpRequest, sendBeacon, WebSocket, FormData or .send", block.length > 20000 && sends.length === 0, sends);
  t.ok("the off switch is on, the boost is 1.0, and the block names the plugin's own calls", /const NATIVE_MIC_ON = true;/.test(SONA) && /const NATIVE_MIC_GAIN = 1\.0;/.test(SONA) && /P\.micOpen\(/.test(block) && /P\.micClose\(/.test(block) && /P\.micPermission\(/.test(block));
  // asked of the handle the page holds: a live or paused native stream always
  // names itself (a fault elsewhere turning micNative() off must not let a
  // start close it), an ended one only while the page is still on Sona's mic
  t.ok("speechStart adds the stream only on Sona's own mic, from the handle itself", /const h = _nm\.last, mine = h && !h\.web && \(h\.state !== "ended" \|\| micNative\(\)\);\s*const o = mine \? Object\.assign\(\{\}, opts \|\| \{\}, \{ g: h\.g \}\) : \(opts \|\| \{\}\);/.test(SONA));
  // the 24 call sites: each asks the helper first and keeps its old line as the fallback
  const R = (f) => readFileSync(ROOT + "/" + f, "utf8");
  const n = (src, re) => (src.match(re) || []).length;
  const charge = R("charge.html");
  const sites = [
    ["charge.html: the practice mic", charge, /var stream=\(S&&S\.micNative&&S\.micNative\(\)\)\?await S\.micOpen\(\{audio:true,video:false\}\):await navigator\.mediaDevices\.getUserMedia\(\{audio:true,video:false\}\);/g, 1],
    ["charge.html: the room reading and the listening window", charge, /\(S&&S\.micSource\)\?S\.micSource\(ctx,(stream|micStream)\):ctx\.createMediaStreamSource\(\1\)/g, 2],
    ["charge.html: the keepsake clip", charge, /var recorder=\(S&&S\.micRecorder\)\?S\.micRecorder\(micStream\):new MediaRecorder\(micStream\);/g, 1],
  ];
  for (const g of ["slice", "tiles", "stack", "run", "glide"]) {
    const src = R("arcade-" + g + ".html");
    sites.push([g + ": the say-it card's mic", src, /\(\(S&&S\.micNative&&S\.micNative\(\)\)\?S\.micOpen\(\{audio:true\}\):navigator\.mediaDevices\.getUserMedia\(\{audio:true\}\)\)\.then\(function\(st\)\{/g, 1]);
    sites.push([g + ": its source", src, /rv\.src=\(S&&S\.micSource\)\?S\.micSource\(rv\.ctx,st\):rv\.ctx\.createMediaStreamSource\(st\);/g, 1]);
  }
  const feed = R("arcade-feed.html");
  sites.push(["Feed Echo: the turn's mic", feed, /\(\(S&&S\.micNative&&S\.micNative\(\)\)\?S\.micOpen\(\{audio:true,video:false\}\):navigator\.mediaDevices\.getUserMedia\(\{audio:true,video:false\}\)\)\.then\(function\(stream\)\{/g, 1]);
  sites.push(["Feed Echo: its source", feed, /src=\(S&&S\.micSource\)\?S\.micSource\(ctx,stream\):ctx\.createMediaStreamSource\(stream\)/g, 1]);
  sites.push(["Feed Echo: the grown-up's yes", feed, /\(\(S&&S\.micNative&&S\.micNative\(\)\)\?S\.micProbe\(\{audio:true,video:false\}\):navigator\.mediaDevices\.getUserMedia\(\{audio:true,video:false\}\)\)\.then\(function\(stream\)\{/g, 1]);
  for (const [f, v] of [["sayplay.js", "stream"], ["saycheck.js", "st"]]) {
    const src = R(f), c = f === "sayplay.js" ? "ctx" : "c", s = f === "sayplay.js" ? "micSrc" : "src";
    sites.push([f + ": the mic", src, new RegExp("\\(\\(S && S\\.micNative && S\\.micNative\\(\\)\\) \\? S\\.micOpen\\(\\{ audio: true, video: false \\}\\) : navigator\\.mediaDevices\\.getUserMedia\\(\\{ audio: true, video: false \\}\\)\\)\\.then\\(function \\(" + v + "\\) \\{", "g"), 1]);
    sites.push([f + ": its source", src, new RegExp(s + " = \\(S && S\\.micSource\\) \\? S\\.micSource\\(" + c + ", " + v + "\\) : " + c + "\\.createMediaStreamSource\\(" + v + "\\);", "g"), 1]);
    sites.push([f + ": the grown-up's yes", src, new RegExp("\\(\\(S && S\\.micNative && S\\.micNative\\(\\)\\) \\? S\\.micProbe\\(\\{ audio: true, video: false \\}\\) : navigator\\.mediaDevices\\.getUserMedia\\(\\{ audio: true, video: false \\}\\)\\)\\.then\\(function \\(" + v + "\\) \\{", "g"), 1]);
  }
  sites.push(["onboarding.html: setup's mic step", R("onboarding.html"), /request=\(Sona\.micNative&&Sona\.micNative\(\)\)\?Sona\.micProbe\(\{audio:true,video:false\}\):navigator\.mediaDevices\.getUserMedia\(\{audio:true,video:false\}\);/g, 1]);
  const missing = sites.filter(([, src, re, want]) => n(src, re) !== want).map(([name, src, re, want]) => name + " (" + n(src, re) + "/" + want + ")");
  const total = sites.reduce((k, s) => k + s[3], 0);
  t.ok("all 24 listening call sites ask Sona's helper first and keep their old line as the fallback", total === 24 && missing.length === 0, missing);
  // …and nowhere else. The games' "one place asks for the mic" pins count
  // getUserMedia( only, and the patterns above only the helper-or-fallback
  // line, so a second listening site written as a bare S.micOpen(...) (no
  // fallback) would pass both. Every helper call, per file, exactly.
  const H = { open: /\bS(ona)?\.micOpen\(/g, probe: /\bS(ona)?\.micProbe\(/g, source: /\bS(ona)?\.micSource\(/g, rec: /\bS(ona)?\.micRecorder\(/g, deaf: /\bS(ona)?\.micDeaf\(/g };
  const want = { "charge.html": { open: 1, probe: 0, source: 2, rec: 1, deaf: 0 }, "arcade-feed.html": { open: 1, probe: 1, source: 1, rec: 0, deaf: 1 },
    "sayplay.js": { open: 1, probe: 1, source: 1, rec: 0, deaf: 1 }, "saycheck.js": { open: 1, probe: 1, source: 1, rec: 0, deaf: 1 },
    "onboarding.html": { open: 0, probe: 1, source: 0, rec: 0, deaf: 0 } };
  for (const g of ["slice", "tiles", "stack", "run", "glide"]) want["arcade-" + g + ".html"] = { open: 1, probe: 0, source: 1, rec: 0, deaf: 1 };
  for (const f of ["story.html", "check.html", "coach-call.html", "simple-play.js"]) want[f] = { open: 0, probe: 0, source: 0, rec: 0, deaf: 0 };
  const extra = [];
  for (const [f, w] of Object.entries(want)) { const src = strip(R(f)); for (const k of Object.keys(H)) if (n(src, H[k]) !== w[k]) extra.push(f + " " + k + " " + n(src, H[k]) + "/" + w[k]); }
  t.ok("no page calls a mic helper anywhere but those sites (micOpen, micProbe, micSource, micRecorder and micDeaf, counted per file)", extra.length === 0, extra);
  t.ok("ES5 where it was: saycheck.js still has no arrows, let or const", !/=>|\blet\s|\bconst\s/.test(strip(R("saycheck.js"))));
  t.ok("the parked pages stay on the web mic, untouched", ["story.html", "check.html", "coach-call.html", "simple-play.js"].every((f) => !/S\.micOpen|Sona\.micOpen|micSource/.test(R(f))));
});

// ════════════════════════════════════════════════════════════════════════
// 8. PRACTICE (charge.html), in real Web Audio
// ════════════════════════════════════════════════════════════════════════
// Five of Rachel's R, a second apart, after "Your turn". The same child, the
// same answer: on Sona's own mic and on the web mic.
const box = (page) => page.evaluate(() => (document.getElementById("micNumbers") || {}).textContent || "");
const dB = (text, re) => { const m = re.exec(text); return m ? Number(m[1]) : null; };
const practice = {};
async function practiceRound(t, label, nm, extra = {}) {
  const { context, page, errors, requests } = await open("/charge.html?daily=1", { kid: { run: true, micNumbers: true }, nm: Object.assign({ hissDb: -60 }, nm), tts: 9600, stubGames: true });
  try {
    const turn = await until(page, () => document.getElementById("turnStatus").textContent === "Your turn", 12000);
    const t0 = Date.now();
    await page.waitForTimeout(1200);
    const silent = await page.evaluate(() => window.reps);
    let boxText = "";
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => __nm.ctl.say(0, 600, "R", 0.05));
      await page.waitForTimeout(i === 0 ? 900 : 1300);
      if (i === 0) { boxText = await box(page); await page.waitForTimeout(400); }
    }
    await until(page, () => window.reps >= 5, 6000);
    await page.waitForTimeout(900);
    const t1 = Date.now();
    const st = await page.evaluate(() => ({ reps: window.reps, turns: __t.turns.slice(), saved: __t.saved.slice(), practice: __t.practice.slice() }));
    const s = await shut(page, 2500), l = await log(page), p = await phone(page);
    practice[label] = { reps: st.reps, now: dB(boxText, /now (-?\d+) dB/), loud: dB(boxText, /loudest in 2 s (-?\d+) dB/), box: boxText };
    t.ok(label + ": \"Your turn\" shows and the mic listens", turn && st.turns.length > 0, st.turns);
    t.ok(label + ": a quiet room for a second and more is no try (silence is never a rep)", silent === 0, silent);
    t.ok(label + ": five of Rachel's R count five tries", st.reps === 5, st);
    if (nm.mode === "new") {
      t.ok(label + ": the page never called getUserMedia: every mic was Sona's own", p.gum === 0 && p.opened >= 2, p);
      t.ok(label + ": \"Your turn\" only once the phone's samples flow into a live stream", st.turns.length > 0 && st.turns.every((x) => x.live && x.chunks > 0), st.turns);
      const kept = await page.evaluate(async () => (await Sona.listRecordings()).map((x) => ({ type: x.blob && x.blob.type, size: x.blob && x.blob.size })));
      t.ok(label + ": the keepsake clip is a WAV, kept in this phone's own storage (IndexedDB)", st.saved.length === 1 && st.saved[0].type === "audio/wav" && st.saved[0].size > 100000 && kept.length === 1 && kept[0].type === "audio/wav" && kept[0].size === st.saved[0].size, { saved: st.saved, kept });
      t.ok(label + ": the mic numbers say whose mic it is: \"mic: Sona's own\", its mode, route, boost, chunk, queue, gaps and close", /mic: Sona's own · default mode · in iPhone Microphone · out Speaker · boost ×1\.0 · chunk 21 ms · queue \d+ ms · gaps 0 · restarts 0 · close (\d+ ms|\?)/.test(boxText) && /\d+ fps · \d+ Hz · echo cancel off · noise off · auto gain \?/.test(boxText), boxText);
      network(t, label, requests, t0 - 2000, t1);
    } else {
      t.ok(label + ": the page's own getUserMedia, as every build before", p.gum >= 2 && p.opens === 0, p);
      t.ok(label + ": the mic numbers say it is the web page's mic, in phone-call mode", /mic: the web page's \(phone-call mode\)$/m.test(boxText), boxText);
    }
    closedOk(t, label, s);
    audit(t, label, l);
    practice[label].records = st.practice.join();
    clean(t, label, errors);
    if (nm.mode === "new") {
      // a second round the same day: its tries count, and no second clip is kept
      await page.evaluate(() => sessionStorage.setItem("sona.run.v1", JSON.stringify({ active: true, round: 0, scores: [], sum: 0, sound: "R", level: 1, pending: false, games: ["slice", "tiles", "stack", "run", "glide"], tries: 0 })));
      await page.goto(base + "/charge.html?daily=1");
      await until(page, () => document.getElementById("turnStatus").textContent === "Your turn", 12000);
      for (let i = 0; i < 5; i++) { await page.evaluate(() => __nm.ctl.say(0, 600, "R", 0.05)); await page.waitForTimeout(1300); }
      const again = await until(page, () => window.reps >= 5, 6000);
      await page.waitForTimeout(900);
      const r = await page.evaluate(async () => ({ saves: Number(sessionStorage.getItem("__tSaved") || 0), kept: (await Sona.listRecordings()).length }));
      t.ok(label + ": the keepsake is once a day: a second round the same day keeps no second clip", again && r.saves === 1 && r.kept === 1, r);
    }
  } finally { await context.close(); }
}
scenario("practice on Sona's own mic", (t) => practiceRound(t, "practice, Sona's own mic", { mode: "new" }));
scenario("practice on the web mic (an App Store build)", (t) => practiceRound(t, "practice, web mic", { mode: "old" }));
scenario("practice in a browser: the mic numbers", async (t) => {
  const { context, page, errors } = await open("/charge.html?daily=1", { kid: { run: true, micNumbers: true }, nm: { mode: "browser" }, tts: 9600, stubGames: true });
  try {
    await until(page, () => document.getElementById("turnStatus").textContent === "Your turn", 12000);
    await page.waitForTimeout(400);
    const text = await box(page);
    t.ok("practice in a browser: the mic numbers say \"mic: the browser's\", and the fps line is unchanged", /mic: the browser's$/m.test(text) && /\d+ fps · \d+ Hz · echo cancel/.test(text), text);
    clean(t, "practice browser", errors);
  } finally { await context.close(); }
});
scenario("practice: the exits", async (t) => {
  const { context, page, errors } = await open("/charge.html?daily=1", { kid: { run: true }, nm: { mode: "new", hissDb: -60 }, tts: 9600, stubGames: true });
  try {
    const turn = () => until(page, () => document.getElementById("turnStatus").textContent === "Your turn" && __nm.live(), 12000);
    await turn();
    await page.evaluate(() => __nm.ctl.say(0, 600, "R", 0.05)); await page.waitForTimeout(1100);
    t.ok("exits: a first try counts", (await page.evaluate(() => window.reps)) === 1);
    // Echo starts to speak (a tap on Echo): the window closes first
    await page.locator("#echoBuddy").click();
    let s = await shut(page, 1500);
    t.ok("exits: a tap on Echo closes the phone's mic before he speaks", s.live === null && s.opened === s.closed, s);
    await turn();
    // the phone locked: practice pauses, the mic closes
    await page.evaluate(() => __t.hide()); s = await shut(page, 1500);
    t.ok("exits: the phone locked mid-window closes the mic, and practice pauses", s.live === null && s.opened === s.closed && await page.evaluate(() => document.getElementById("pauseOvl").classList.contains("show")), s);
    await page.evaluate(() => __t.show()); await page.waitForTimeout(300);
    const before = await page.evaluate(() => __nm.opened);
    await page.waitForTimeout(500);
    t.ok("exits: coming back opens nothing until Resume is tapped", (await page.evaluate(() => __nm.opened)) === before);
    await page.locator("#pauseResume").click(); await turn();
    t.ok("exits: Resume opens it again, Sona's own", (await page.evaluate(() => __nm.opened)) > before && (await page.evaluate(() => __nm.gum)) === 0);
    for (let i = 0; i < 4; i++) { await page.evaluate(() => __nm.ctl.say(0, 600, "R", 0.05)); await page.waitForTimeout(1300); }
    await until(page, () => window.reps >= 5, 6000);
    await page.waitForTimeout(900);
    t.ok("exits: the tries already heard carry over (five in all)", (await page.evaluate(() => window.reps)) === 5);
    t.ok("exits: an attempt Echo talked through after a try keeps no stitched clip", (await page.evaluate(() => __t.saved.length)) === 0);
    s = await shut(page, 2000); closedOk(t, "exits", s);
    audit(t, "exits", await log(page));
    clean(t, "practice exits", errors);
  } finally { await context.close(); }
});
scenario("practice: Home mid-window", async (t) => {
  const { context, page, errors } = await open("/charge.html?daily=1", { kid: { run: true }, nm: { mode: "new" }, tts: 9600, stubGames: true });
  try {
    await until(page, () => document.getElementById("turnStatus").textContent === "Your turn" && __nm.live(), 12000);
    await page.evaluate(() => __t.hide()); await page.waitForTimeout(200); await page.evaluate(() => __t.show());
    await page.locator("#pauseHome").click();
    await page.waitForURL("**/today.html*");
    const k = await page.evaluate(() => __nm.kept);
    t.ok("Home: the phone's mic was closed before the page left, and nothing is live on Home", k.opened >= 2 && k.opened === k.closed && !k.live, k);
    clean(t, "practice home", errors);
  } finally { await context.close(); }
});
scenario("practice: a call mid-window", async (t) => {
  const { context, page, errors } = await open("/charge.html?daily=1", { kid: { run: true }, nm: { mode: "new" }, tts: 9600, stubGames: true });
  try {
    await until(page, () => document.getElementById("turnStatus").textContent === "Your turn" && __nm.live(), 12000);
    const opened = await page.evaluate(() => __nm.opened);
    await page.evaluate(() => __nm.ctl.interrupt());
    const card = await until(page, () => __t.grownUp === true, 3000);
    t.ok("a call: practice takes its grown-up card, as it does with WebKit's mic", card, await page.evaluate(() => (document.getElementById("quietTitle") || {}).textContent));
    await page.evaluate(() => __nm.ctl.interruptEnd()); await page.waitForTimeout(800);
    const s = await shut(page, 1500);
    t.ok("…and nothing opens the mic by itself afterwards: the page let go of it, and only a tap brings it back", s.live === null && (await page.evaluate(() => __nm.opened)) === opened, s);
    clean(t, "practice call", errors);
  } finally { await context.close(); }
});
scenario("practice: the mic refused", async (t) => {
  const { context, page, errors } = await open("/charge.html?daily=1", { kid: { run: true }, nm: { mode: "new", perm: "denied" }, tts: 9600, stubGames: true });
  try {
    const shown = await until(page, () => !!document.getElementById("sonaMicDenied"), 6000);
    const text = await page.evaluate(() => (document.getElementById("sonaMicDenied") || {}).textContent || "");
    t.ok("refused: practice shows \"Echo can't hear you yet!\", with the app's Settings → Sona steps", shown && /Echo can’t hear you yet!/.test(text) && /Find Sona/.test(text), text);
    t.ok("refused: …and never asked the web mic", (await page.evaluate(() => __nm.gum)) === 0);
    clean(t, "practice refused", errors);
  } finally { await context.close(); }
});

// ════════════════════════════════════════════════════════════════════════
// 9. THE FIVE ROUND GAMES' SAY-IT CARD, and Fruit Slice's sound power
// ════════════════════════════════════════════════════════════════════════
// Each game with a different phone: rate in, page context rate, chunk size, lateness.
const CARDS = [
  ["slice", { rate: 48000, frames: 1024, jitter: 0 }],
  ["tiles", { rate: 44100, frames: 4800, jitter: 40, ctxRate: 48000 }],
  ["stack", { rate: 48000, frames: 4800, jitter: 40, ctxRate: 44100 }],
  ["run", { rate: 44100, frames: 1024, jitter: 0, ctxRate: 44100 }],
  ["glide", { rate: 48000, frames: 1024, jitter: 40 }],
];
const cardAnswers = {};
async function cardRound(t, g, label, nm) {
  const { context, page, errors, requests } = await game(g, { nm: Object.assign({ hissDb: -60 }, nm), tts: 4800 });
  try {
    await page.evaluate(() => crash());
    const ready = await until(page, () => /listening/i.test(document.getElementById("revListen").textContent), 9000);
    const before = await page.evaluate(() => ({ rev: REV, gum: __nm.gum }));
    await page.waitForTimeout(700);
    const quiet = await page.evaluate(() => REV);
    const t0 = Date.now();
    await page.evaluate(() => __nm.ctl.say(0, 500, "R", 0.05));
    const answered = await until(page, () => REV === 2 && !document.getElementById("revOvl").classList.contains("show"), 3500);
    cardAnswers[label] = answered;
    await page.waitForTimeout(700);
    const s = await shut(page), l = await log(page), p = await phone(page);
    const media = l.sounds.filter((x) => x.kind === "media"), mic = l.mics[0];
    const go = media.filter((x) => x.start < mic.asked).pop();
    t.ok(label + ": the card speaks, then listens", ready && media.length >= 3, { ready, media: media.length });
    t.ok(label + ": the mic is asked for only after \"Go!\" and its tail", !!go && go.end !== Infinity && mic.asked - go.end >= 230 && mic.asked - go.end <= 700, { asked: mic && mic.asked, goEnd: go && go.end });
    t.ok(label + ": a quiet room answers nothing", before.rev === 3 && quiet === 3, { before, quiet });
    t.ok(label + ": Rachel's R right after \"I'm listening…\" answers the card", answered, await page.evaluate(() => ({ REV, floor: rv.floor })));
    if (nm.mode === "new") {
      t.ok(label + ": Sona's own mic, never getUserMedia", p.gum === 0 && p.opened === 1, p);
      network(t, label, requests, t0 - 3000, Date.now());
    } else t.ok(label + ": the page's own getUserMedia", p.gum === 1 && p.opens === 0, p);
    closedOk(t, label, s);
    audit(t, label, l);
    t.ok(label + ": the card writes no practice data", (await page.evaluate(() => __t.practice.length)) === 0);
    clean(t, label, errors);
  } finally { await context.close(); }
}
for (const [g, nm] of CARDS) scenario(g + ": the say-it card on Sona's own mic (" + nm.rate / 1000 + " kHz, " + nm.frames + " frames, " + nm.jitter + " ms late)", (t) => cardRound(t, g, g + " card, Sona's own mic", Object.assign({ mode: "new" }, nm)));
scenario("slice: the say-it card on the web mic", (t) => cardRound(t, "slice", "slice card, web mic", { mode: "old" }));
// A fan in the room: the card's room floor is the same on both mics. The
// floor only ever goes down, so one hiccup in this browser's own stream
// between two audio contexts (the web mic's stand-in, under load) leaves it
// low for good: a pair that disagrees is measured once more before it fails.
const floors = {};
async function fanCard(t, mode, report) {
  const label = "fan, " + (mode === "new" ? "Sona's own mic" : "web mic");
  const { context, page, errors } = await game("slice", { kid: { muted: true }, nm: { mode, source: "fan", fanDb: -38 } });
  try {
    await page.evaluate(() => crash());
    await until(page, () => /listening/i.test(document.getElementById("revListen").textContent), 6000);
    await page.waitForTimeout(1500);
    const fan = await page.evaluate(() => ({ rev: REV, floor: rv.floor }));
    await page.evaluate(() => __nm.ctl.say(0, 500, "R", 0.05));
    const answered = await until(page, () => REV === 2, 3500);
    if (report) {
      t.ok(label + ": the fan alone answers nothing", fan.rev === 3, fan);
      t.ok(label + ": the child over the fan answers the card", answered, await page.evaluate(() => ({ REV, floor: rv.floor })));
      clean(t, label, errors);
    }
    return fan.floor;
  } finally { await context.close(); }
}
scenario("slice: a fan in the room, on both mics", async (t) => {
  let pair = { old: await fanCard(t, "old", true), new: await fanCard(t, "new", true) };
  if (Math.abs(20 * Math.log10(pair.new / pair.old)) > 1) { floors.first = pair; pair = { old: await fanCard(t, "old"), new: await fanCard(t, "new") }; }
  floors.old = pair.old; floors.new = pair.new;
});

// Pauses that recover: a card that lost the mic picks it up again, with no
// page change, and hears the child.
scenario("slice: the card through a call, a route change, a stall, a reset and the 5-minute cap", async (t) => {
  const { context, page, errors } = await game("slice", { kid: { muted: true }, nm: { mode: "new", source: "hiss", hissDb: -60 } });
  try {
    const card = async () => {
      // a fresh round's three cards each time: this checks the mic, not the round
      await page.evaluate(() => { REV = 3; if (playing) crash(); });
      return until(page, () => /listening/i.test(document.getElementById("revListen").textContent) && rv.st, 6000);
    };
    const answer = async () => { await page.evaluate(() => __nm.ctl.say(0, 500, "R", 0.05)); return until(page, () => !document.getElementById("revOvl").classList.contains("show"), 3500); };
    for (const [what, act, back] of [
      ["a call (an interruption, then micready)", "interrupt", "interruptEnd"],
      ["a stall (the phone's engine stopped)", "stalled", null],
      ["a media-services reset", "reset", null],
      ["the 5-minute cap", "timeout", null],
      ["AirPods taken out (the same open, at 44.1 kHz)", "route", null],
    ]) {
      const listening = await card();
      const r0 = await page.evaluate(() => {
        window.__st = rv.st; window.__mutes = 0; window.__unmutedAt = 0;
        const tr = rv.st.getTracks()[0];
        tr.addEventListener("mute", () => { __mutes++; }); tr.addEventListener("unmute", () => { __unmutedAt = performance.now(); });
        return { rev: REV, g: Sona.micStats().live[0] && Sona.micStats().live[0].g };
      });
      const at = await page.evaluate((act) => { const t = performance.now(); if (act === "route") __nm.ctl.route(44100); else __nm.ctl[act](); return t; }, act);
      if (act !== "route") await until(page, () => window.__mutes > 0, 1500);
      const paused = await page.evaluate(() => ({ mutes: __mutes, show: document.getElementById("revOvl").classList.contains("show"), same: rv.st === window.__st }));
      if (back) await page.evaluate((b) => __nm.ctl[b](), back);
      const resumed = act === "route" ? true : await until(page, () => rv.st && !rv.st.getTracks()[0].muted && __unmutedAt > 0 && Sona.micStats().live[0] && Sona.micStats().live[0].state === "live", 3000);
      const ms = act === "route" ? 0 : Math.round(await page.evaluate(() => __unmutedAt) - at);
      const r1 = await page.evaluate(() => ({ same: rv.st === window.__st, g: Sona.micStats().live[0] && Sona.micStats().live[0].g, restarts: Sona.micStats().live[0] && Sona.micStats().live[0].restarts }));
      await page.waitForTimeout(500);
      const ans = await answer();
      t.ok("slice card, " + what + ": the card stays up on the same stream" + (act === "route" ? ", the phone's open carrying on" : " while the phone's mic is away (muted, no page change)"), listening && paused.show && paused.same && (act === "route" ? paused.mutes === 0 : paused.mutes === 1), paused);
      // the cap re-opens at once; a stall or a reset after a quarter-second; a call on iOS's micready
      t.ok("slice card, " + what + ": it picks the mic up again" + (act === "timeout" ? " at once" : ""), resumed && r1.same && (act === "route" ? r1.restarts >= 1 : r1.g > r0.g) && (act !== "timeout" || ms < 300) && (act === "route" || act === "interrupt" || act === "timeout" || ms >= 240), { r0, r1, ms });
      t.ok("slice card, " + what + ": …and hears the child", ans);
      await page.waitForTimeout(700);
    }
    const p = await phone(page), s = await shut(page);
    t.ok("slice card pauses: never the web mic", p.gum === 0, p);
    closedOk(t, "slice card pauses", s);
    audit(t, "slice card pauses", await log(page), { quiet: true });
    clean(t, "slice card pauses", errors);
  } finally { await context.close(); }
});
// The room floor through the phone's own breaks. A humming room (a 110 Hz
// hum, about 0.03 rms) sets the card's floor, and its bar stands at 3.5x
// that; a TV voice at 0.075 rms stays under it. The floor only ever goes
// down, so the zeros between the phone's samples, read as the room, would
// set it to nothing and drop the bar to its 0.05 minimum, and the TV would
// answer the card. Through each break the floor holds within 1 dB, the TV
// answers nothing, and the child still does.
scenario("slice: the card's room floor through a stall, a reset, late chunks and a route change", async (t) => {
  const { context, page, errors } = await game("slice", { kid: { muted: true }, nm: { mode: "new", source: "tone", toneHz: 110, toneAmp: 0.042 } });
  const tv = () => page.evaluate(() => {
    const n = 28800, x = new Float32Array(n); let s = 0;
    for (let i = 0; i < n; i++) { const p = 2 * Math.PI * 187.5 * i / 48000; let v = 0; for (let k = 1; k <= 12; k++) v += Math.sin(k * p) / k; x[i] = v; s += v * v; }
    const g = 0.075 / Math.sqrt(s / n); for (let i = 0; i < n; i++) x[i] *= g;
    __nm.ctl.feed(x, 48000);
  });
  const db = (a, b) => Math.abs(20 * Math.log10(a / b));
  try {
    await page.evaluate(() => crash());
    const ready = await until(page, () => /listening/i.test(document.getElementById("revListen").textContent), 8000);
    await page.waitForTimeout(1200);
    const f0 = await page.evaluate(() => rv.floor);
    await tv(); await page.waitForTimeout(1500);
    const control = await page.evaluate(() => ({ rev: REV, show: document.getElementById("revOvl").classList.contains("show") }));
    t.ok("room floor: the hum sets the card's floor, and the TV under its bar answers nothing", ready && f0 > 0.02 && control.rev === 3 && control.show, { f0, control });
    const rows = [];
    for (const [what, act, ms] of [
      ["a stall (the phone's engine stopped, re-opened)", "stalled", 700],
      ["a media-services reset", "reset", 700],
      ["chunks half a second late", "late500", 1200],
      ["chunks a second and a half late", "late1500", 2200],
      ["a route change with a 0.4 s gap", "route", 1200],
      ["the 5-minute cap", "timeout", 700],
    ]) {
      await page.evaluate((act) => {
        if (act === "late500") __nm.ctl.stall(500); else if (act === "late1500") __nm.ctl.stall(1500);
        else if (act === "route") __nm.ctl.route(48000, 400); else __nm.ctl[act]();
      }, act);
      await page.waitForTimeout(60);
      const back = await until(page, () => { const s = Sona.micStats().live[0]; return !!s && s.state === "live" && !!rv.st && !rv.st.getTracks()[0].muted; }, 4000);
      await page.waitForTimeout(ms);
      const f = await page.evaluate(() => rv.floor);
      rows.push({ what, back, floor: f, db: db(f, f0) });
    }
    const bad = rows.filter((r) => !r.back || !(r.floor > 0) || r.db > 1);
    t.ok("room floor: through every break the stream comes back and the floor holds within 1 dB (never the gap's zeros)", bad.length === 0, rows);
    await tv(); await page.waitForTimeout(1500);
    const after = await page.evaluate(() => ({ rev: REV, show: document.getElementById("revOvl").classList.contains("show"), floor: rv.floor }));
    t.ok("room floor: after them all, the same TV still answers nothing", after.rev === 3 && after.show, after);
    await page.evaluate(() => __nm.ctl.say(0, 500, "R", 0.05));
    const answered = await until(page, () => REV === 2, 3500);
    t.ok("room floor: …and the child still answers the card", answered, await page.evaluate(() => ({ REV, floor: rv.floor })));
    t.ok("room floor: never the web mic", (await page.evaluate(() => __nm.gum)) === 0);
    clean(t, "room floor", errors);
  } finally { await context.close(); }
});
scenario("slice: the card when the phone says not now, and after a fault", async (t) => {
  for (const [fail, label] of [["busy", "busy"], ["engine", "a fault"]]) {
    const { context, page, errors } = await game("slice", { kid: { muted: true }, nm: { mode: "new", openFail: fail } });
    try {
      const heard = [];
      for (let i = 0; i < 2; i++) {
        await page.evaluate(() => { if (playing) crash(); });
        await until(page, () => /listening/i.test(document.getElementById("revListen").textContent), 6000);
        await page.waitForTimeout(300);
        await page.evaluate(() => __nm.ctl.say(0, 500, "R", 0.05));
        heard.push(await until(page, () => !document.getElementById("revOvl").classList.contains("show"), 3500));
        await page.waitForTimeout(900);
      }
      const p = await phone(page);
      if (fail === "busy") t.ok("slice card, busy: the first card hears through one web-mic try, the next is Sona's own again", heard.every(Boolean) && p.gum === 1 && p.opens === 2 && p.opened === 1, { heard, p });
      else t.ok("slice card, a fault: the first card hears through the web mic, and so does the rest of the page", heard.every(Boolean) && p.gum === 2 && p.opens === 1, { heard, p });
      clean(t, "slice card " + label, errors);
    } finally { await context.close(); }
  }
});
scenario("slice: the card when the mic is refused", async (t) => {
  const { context, page, errors } = await game("slice", { nm: { mode: "new", perm: "denied" }, tts: 4800 });
  try {
    await page.evaluate(() => crash());
    const ended = await until(page, () => window.__ended === true || !document.getElementById("revOvl").classList.contains("show"), 9000);
    t.ok("slice card, refused: the round ends kindly, without the web mic", ended && (await page.evaluate(() => __nm.gum)) === 0, await page.evaluate(() => ({ ended: window.__ended, gum: __nm.gum })));
    clean(t, "slice card refused", errors);
  } finally { await context.close(); }
});
scenario("slice: the card's exits", async (t) => {
  const { context, page, errors } = await game("slice", { kid: { muted: true }, nm: { mode: "new" } });
  try {
    await page.evaluate(() => crash());
    await until(page, () => /listening/i.test(document.getElementById("revListen").textContent), 6000);
    await page.evaluate(() => __t.hide());
    let s = await shut(page);
    t.ok("slice card: the phone locked mid-listen closes the mic", s.live === null && s.opened === s.closed, s);
    await page.evaluate(() => __t.show());
    const again = await until(page, () => /listening/i.test(document.getElementById("revListen").textContent) && __nm.live(), 6000);
    t.ok("slice card: coming back, the card listens again on Sona's own mic", again && (await page.evaluate(() => __nm.gum)) === 0);
    await page.locator("#revDone").click();
    s = await shut(page);
    t.ok("slice card: \"I'm done playing\" closes the mic", s.live === null && s.opened === s.closed, s);
    clean(t, "slice card exits", errors);
  } finally { await context.close(); }
});
scenario("slice: the sound power on Sona's own mic", async (t) => {
  const { context, page, errors } = await game("slice", { kid: { muted: true, slowAsk: true }, nm: { mode: "new", text: "rrrr" } });
  try {
    await page.evaluate(() => { SLOW_ASK.listen = 6000; slowAskAt = Math.min(slowAskAt, 150); });
    const asking = await until(page, () => window.slowTurn && rv.st && /listening/i.test(document.getElementById("slowStatus").textContent), 6000);
    const r = await phone(page);
    t.ok("sound power: Echo asks with no tap and listens on Sona's own mic", asking && r.gum === 0 && !!r.live, r);
    t.ok("sound power: Apple's check is started on the page's own stream (g)", r.starts.length === 1 && r.starts[0].g === r.live.g, r.starts);
    await page.waitForTimeout(400);
    await page.evaluate(() => __nm.ctl.say(0, 600, "R", 0.05));
    const earned = await until(page, () => !window.slowTurn && slowMs > 0, 4000);
    t.ok("sound power: Rachel's R earns it", earned, await page.evaluate(() => ({ slowMs, status: document.getElementById("slowStatus").textContent })));
    closedOk(t, "sound power", await shut(page));
    clean(t, "sound power", errors);
  } finally { await context.close(); }
  const d = await game("slice", { kid: { muted: true, slowAsk: true }, nm: { mode: "new", perm: "denied" } });
  try {
    await d.page.evaluate(() => { slowAskAt = Math.min(slowAskAt, 150); });
    const off = await until(d.page, () => !window.slowTurn && /Microphone is off/.test(document.getElementById("slowStatus").textContent), 5000);
    t.ok("sound power, refused: \"Microphone is off\", nothing earned, the game goes on, and no web mic", off && (await d.page.evaluate(() => slowMs === 0 && playing && __nm.gum === 0)), await d.page.evaluate(() => document.getElementById("slowStatus").textContent));
    clean(t, "sound power refused", d.errors);
  } finally { await d.context.close(); }
});
scenario("slice: leaving while the sound power listens", async (t) => {
  const { context, page, errors } = await game("slice", { kid: { muted: true, slowAsk: true }, nm: { mode: "new" } });
  try {
    await page.evaluate(() => { slowAskAt = Math.min(slowAskAt, 150); });
    await until(page, () => window.slowTurn && __nm.live(), 6000);
    await page.locator("#close").click();
    await page.waitForURL("**/today.html*");
    const k = await page.evaluate(() => __nm.kept);
    t.ok("leaving mid-listen (✕): the phone's mic is closed before the page goes", k.opened === 1 && k.closed === 1 && !k.live, k);
    clean(t, "slice leave", errors);
  } finally { await context.close(); }
});
scenario("slice: a wave that ends while the sound power listens", async (t) => {
  const { context, page, errors } = await game("slice", { kid: { muted: true, slowAsk: true }, nm: { mode: "new" } });
  try {
    await page.evaluate(() => { slowAskAt = Math.min(slowAskAt, 150); });
    await until(page, () => window.slowTurn && __nm.live(), 6000);
    await page.evaluate(() => { waveGot = WAVES[wave].goal; });
    await until(page, () => !window.slowTurn, 3000);
    const s = await shut(page);
    t.ok("the wave's end ends the listen and closes the phone's mic", s.live === null && s.opened === s.closed, s);
    clean(t, "slice wave end", errors);
  } finally { await context.close(); }
});

// ════════════════════════════════════════════════════════════════════════
// 10. FEED ECHO, HOOPS (Say & Play) AND A BOOK'S WORD
// ════════════════════════════════════════════════════════════════════════
// Each page three ways: the child heard on Sona's own mic and on the web mic
// (the same answer), the phone locked mid-listen (the mic closes), and the
// mic refused (the shared "Echo can't hear you yet!" screen, no web mic).
const playAnswers = {};
const PLAY = {
  feed: {
    name: "Feed Echo", path: "/arcade-feed.html", kid: { age: "4" }, tts: 4800,
    start: (page) => page.locator("#startBtn").click(),
    listening: () => /Your turn/.test(document.getElementById("bSub").textContent) && __nm.mics.some((m) => m.start != null && m.end == null),
    idle: () => document.getElementById("grid").classList.contains("locked"),
    // the word unlocks the pictures
    heard: async (page) => { await page.evaluate(() => __nm.ctl.say(0, 500, "R", 0.05)); return until(page, () => !document.getElementById("grid").classList.contains("locked"), 3000); },
  },
  hoops: {
    name: "Hoops", path: "/arcade-hoops.html", kid: {}, tts: 4800,
    start: (page) => page.locator("#startBtn").click(),
    listening: () => window.__sayplay && window.__sayplay.listening === true && __nm.mics.some((m) => m.start != null && m.end == null),
    idle: () => (window.__hoops || {}).state === "idle",
    // say it two times: once is "1 more time!", twice brings the ball
    heard: async (page) => {
      await page.evaluate(() => __nm.ctl.say(0, 500, "R", 0.05));
      const once = await until(page, () => window.__sayplay.said === 1 && (window.__hoops || {}).state === "idle", 2500);
      await page.waitForTimeout(700);
      await page.evaluate(() => __nm.ctl.say(0, 500, "R", 0.05));
      return once && until(page, () => window.__hoops && window.__hoops.state === "ready", 3000);
    },
  },
  book: {
    name: "a book's word", path: "/library.html", kid: {}, tts: false,
    start: async (page) => {
      await page.waitForFunction(() => document.querySelectorAll("#shelf .bookBtn").length > 0);
      await page.evaluate(() => [...document.querySelectorAll("#shelf .bookBtn")].find((b) => b.querySelector(".bt").textContent === "Rory and the Rainbow").click());
      await page.waitForTimeout(150);
      await page.evaluate(() => document.getElementById("bkNext").click());
    },
    listening: () => window.__book && window.__book.mode === "live" && __nm.mics.some((m) => m.start != null && m.end == null),
    idle: () => window.__book.page === 0,
    // the word turns the page
    heard: async (page) => { await page.evaluate(() => __nm.ctl.say(0, 500, "R", 0.05)); return until(page, () => window.__book.page === 1, 3000); },
  },
};
for (const [key, P] of Object.entries(PLAY)) {
  for (const mode of ["new", "old"]) scenario(P.name + " on " + (mode === "new" ? "Sona's own mic" : "the web mic"), async (t) => {
    const label = P.name + ", " + (mode === "new" ? "Sona's own mic" : "web mic");
    const { context, page, errors, requests } = await open(P.path, { kid: P.kid, nm: { mode }, tts: P.tts });
    try {
      await P.start(page);
      const turn = await until(page, P.listening, 12000);
      await page.waitForTimeout(600);
      const quiet = await page.evaluate(P.idle);
      const t0 = Date.now();
      const heard = await P.heard(page);
      playAnswers[label] = heard;
      await page.waitForTimeout(500);
      const p = await phone(page), s = await shut(page);
      if (mode === "new") {
        t.ok(label + ": the turn listens on Sona's own mic, never getUserMedia", turn && p.gum === 0 && p.opened >= 1, p);
        network(t, label, requests, t0 - 3000, Date.now());
      } else t.ok(label + ": the turn listens through the page's own getUserMedia", turn && p.gum >= 1 && p.opens === 0, p);
      t.ok(label + ": a quiet room moves nothing; Rachel's R does", quiet && heard, { quiet, heard });
      closedOk(t, label, s);
      audit(t, label, await log(page));
      clean(t, label, errors);
    } finally { await context.close(); }
  });
  scenario(P.name + ": the phone locked mid-listen", async (t) => {
    const { context, page, errors } = await open(P.path, { kid: P.kid, nm: { mode: "new" }, tts: P.tts });
    try {
      await P.start(page);
      const turn = await until(page, P.listening, 12000);
      await page.evaluate(() => __t.hide());
      const s = await shut(page);
      t.ok(P.name + ": the phone locked mid-listen closes Sona's own mic", turn && s.live === null && s.opened >= 1 && s.opened === s.closed, s);
      clean(t, P.name + " locked", errors);
    } finally { await context.close(); }
  });
  scenario(P.name + ": the mic refused", async (t) => {
    const { context, page, errors } = await open(P.path, { kid: P.kid, nm: { mode: "new", perm: "denied" }, tts: P.tts });
    try {
      await P.start(page);
      const shown = await until(page, () => !!document.getElementById("sonaMicDenied"), 9000);
      const r = await page.evaluate(() => ({ gum: __nm.gum, text: (document.getElementById("sonaMicDenied") || {}).textContent || "" }));
      t.ok(P.name + ", refused: \"Echo can't hear you yet!\" with the app's Settings → Sona steps, and no web mic", shown && /Echo can’t hear you yet!/.test(r.text) && /Find Sona/.test(r.text) && r.gum === 0, r);
      clean(t, P.name + " refused", errors);
    } finally { await context.close(); }
  });
}
// the grown-up's yes, the first time: the phone's permission alone, no mic
scenario("Feed Echo's grown-up card: the permission alone", async (t) => {
  const { context, page, errors } = await open("/arcade-feed.html", { kid: { age: "4", noMicok: true }, nm: { mode: "new", perm: "prompt", onAsk: "grant" }, tts: 4800 });
  try {
    await page.locator("#startBtn").click();
    const primer = await until(page, () => document.getElementById("primer").classList.contains("show"), 4000);
    const before = await phone(page);
    await page.locator("#primerYes").click();
    const went = await until(page, () => localStorage.getItem("sona.micok") === "1", 3000);
    const p = await phone(page);
    t.ok("Feed Echo's grown-up card: \"yes\" asks the phone's permission (request: true), opening no mic for it", primer && before.perms.length === 0 && went && p.perms.length >= 1 && p.perms[0].request === true && p.gum === 0, p);
    clean(t, "Feed Echo primer", errors);
  } finally { await context.close(); }
});

// ════════════════════════════════════════════════════════════════════════
// 11. SETUP'S MIC STEP: the permission alone
// ════════════════════════════════════════════════════════════════════════
for (const [label, nm] of [["allowed", { perm: "prompt", onAsk: "grant" }], ["refused", { perm: "prompt", onAsk: "deny" }]]) scenario("setup's mic step: " + label, async (t) => {
  const { context, page, errors } = await phoneOpen(browser, base, { app: "nobuy", setUp: true, marker: true, mic: "grant" });
  try {
    await context.addInitScript(nativeMic, Object.assign({ mode: "new", world: false }, nm));
    await page.goto(base + "/onboarding.html");
    await page.locator('[data-step="mic"].on').waitFor();
    await calm(page); await page.locator("#nextBtn").click();
    if (label === "allowed") {
      const done = await until(page, () => localStorage.getItem("sona.micok") === "1" && __phone.mic.order.includes("speech permission"), 4000);
      const r = await page.evaluate(() => ({ perms: __nm.perms.slice(), opens: __nm.opens.length, gum: __nm.gum, requests: __phone.mic.requests.length, order: __phone.mic.order.slice() }));
      t.ok("setup, allowed: the tap asks the phone's permission (request: true) and opens no mic, Sona's or the web's", done && r.perms.length === 1 && r.perms[0].request === true && r.opens === 0 && r.gum === 0 && r.requests === 0, r);
      t.ok("setup, allowed: …then the speech-recognition permission, as before", r.order.join() === "speech permission", r.order);
    } else {
      const shown = await until(page, () => !!document.getElementById("sonaMicDenied"), 4000);
      const r = await page.evaluate(() => ({ status: document.getElementById("micStatus").textContent, gum: __nm.gum, opens: __nm.opens.length, micok: localStorage.getItem("sona.micok"), back: (document.getElementById("sonaMicBack") || {}).textContent }));
      t.ok("setup, refused: the same screen as ever (\"Back to setup\"), no web mic, nothing remembered", shown && /Settings/.test(r.status) && r.gum === 0 && r.opens === 0 && r.micok !== "1" && r.back === "Back to setup", r);
    }
    clean(t, "setup " + label, errors);
  } finally { await context.close(); }
});

// ── run ──
try {
  const work = queue.slice();
  await Promise.all(Array.from({ length: JOBS }, async () => { while (work.length) await runOne(work.shift()); }));
  // the same child, the same answer, across the two mics
  if (practice["practice, Sona's own mic"] && practice["practice, web mic"]) {
    const a = practice["practice, Sona's own mic"], b = practice["practice, web mic"];
    assertions++; const same = a.reps === b.reps && a.records === b.records && /^logAttempt,bumpReps/.test(a.records) && a.now != null && b.now != null && Math.abs(a.loud - b.loud) <= 1;
    if (!same) failures++;
    console.log((same ? "PASS " : "FAIL ") + "practice: the same five tries and the same practice records on both mics, and the mic numbers' loudest moment within 1 dB" + (same ? "" : " → " + JSON.stringify({ own: a, web: b })));
  }
  if ("slice card, Sona's own mic" in cardAnswers && "slice card, web mic" in cardAnswers) {
    assertions++; const same = cardAnswers["slice card, Sona's own mic"] === cardAnswers["slice card, web mic"];
    if (!same) failures++;
    console.log((same ? "PASS " : "FAIL ") + "slice card: the same answer on both mics" + (same ? "" : " → " + JSON.stringify(cardAnswers)));
  }
  for (const name of Object.values(PLAY).map((P) => P.name)) {
    const a = playAnswers[name + ", Sona's own mic"], b = playAnswers[name + ", web mic"];
    if (a == null || b == null) continue;
    assertions++; const same = a === b && a === true;
    if (!same) failures++;
    console.log((same ? "PASS " : "FAIL ") + name + ": the same child gets the same answer on both mics" + (same ? "" : " → " + JSON.stringify({ own: a, web: b })));
  }
  if (floors.old != null && floors.new != null) {
    assertions++; const db = 20 * Math.log10(floors.new / floors.old), same = Math.abs(db) <= 1;
    if (!same) failures++;
    console.log((same ? "PASS " : "FAIL ") + "slice card with a fan in the room: the card's room floor within 1 dB on both mics" + (same && !VERBOSE ? "" : " → " + JSON.stringify({ floors, db })));
  }
} finally { await browser.close(); await close(); }
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
