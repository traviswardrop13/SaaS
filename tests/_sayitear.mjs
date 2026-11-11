// A phone for the round games' say-it card whose microphone is real sound:
// a synthetic MediaStream fed by the page's own Chromium Web Audio, so the
// page's analyser hears exactly what is played into it (no hardware, no
// recording). Used by sayitcardtest, 2 Oct 2026, to play a child answering
// right after Echo's "Go!". Nothing here is practice data: every practice
// write is logged so a suite can show there were none.
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";

const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2", mp3: "audio/mpeg", wav: "audio/wav" };
// The public tree, with every /api/ call answered 503 unless a page's
// context routes it itself.
export async function serve(root) {
  const server = createServer((req, res) => {
    const u = new URL(req.url, "http://local"), f = path.join(root, u.pathname);
    if (u.pathname.startsWith("/api/")) { res.writeHead(503, { "content-type": "application/json" }); res.end("{}"); return; }
    if (!existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": MIME[f.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, BASE: "http://127.0.0.1:" + server.address().port };
}

// A family past every free era, with one child whose sound is cfg.sound.
// cfg.muted: sound off in Settings (volume 0), so Echo stays quiet.
export function seed(cfg) {
  localStorage.setItem("sona.freeera.v1", "post"); for (const k of ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"]) localStorage.setItem(k, "done");
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: [cfg.sound || "R"], onboarded: true, earlyAdopter: true, voiceOn: !cfg.muted, soundOn: !cfg.muted, volume: cfg.muted ? 0 : 0.6 }));
  localStorage.setItem("sona.micok", "1");
  // past Sound Sprint's start card (a child's first three races; runtest plays it), so its race is running
  localStorage.setItem("sona.sprintintro.v1", "3");
  sessionStorage.setItem("sona.play.token", "arcade-" + cfg.game + ".html"); sessionStorage.setItem("sona.boost.sound", cfg.sound || "R");
}

// The init script. cfg.hiss: a real mic's own faint hiss (white, dBFS),
// always there from the first mic request.
export function realPhone(cfg) {
  const h = window.__ear = { streams: 0, ctx: null, practice: [] };
  function hiss(ctx, db) {
    const n = ctx.sampleRate * 8, b = ctx.createBuffer(1, n, ctx.sampleRate), x = b.getChannelData(0);
    let st = 7, e = 0;
    for (let i = 0; i < n; i++) { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; x[i] = st / 2147483648 - 1; e += x[i] * x[i]; }
    const g = Math.pow(10, db / 20) / Math.sqrt(e / n); for (let i = 0; i < n; i++) x[i] *= g;
    return b;
  }
  h.mic = () => {
    if (h.ctx) return h.ctx;
    const ctx = h.ctx = new AudioContext({ sampleRate: 48000 });
    h.bus = ctx.createGain();
    return ctx;
  };
  navigator.mediaDevices.getUserMedia = async () => {
    const ctx = h.mic(); await ctx.resume();
    if (!h.started) {
      h.started = true;
      if (cfg.hiss) { const s = ctx.createBufferSource(); s.buffer = hiss(ctx, cfg.hiss); s.loop = true; s.connect(h.bus); s.start(); }
    }
    const d = ctx.createMediaStreamDestination(); h.bus.connect(d); h.streams++;
    return d.stream;
  };
  // the child: Rachel's recorded demo of a sound (cfg.sound unless named),
  // `db` from its own level, for `ms`, from `from` seconds into it
  h.clips = {};
  h.say = async (db, ms, sound, from) => {
    const ctx = h.mic(), name = sound || cfg.sound || "R";
    if (!h.clips[name]) h.clips[name] = await ctx.decodeAudioData(await (await fetch("/coach/say/" + name + "-demo.mp3")).arrayBuffer());
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = h.clips[name]; g.gain.value = Math.pow(10, db / 20); s.connect(g); g.connect(h.bus);
    s.start(ctx.currentTime, from || 0); s.stop(ctx.currentTime + ms / 1000);
  };
  let sona;
  Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set(v) {
    sona = v; v.confetti = () => {};
    for (const k of ["logAttempt", "bumpReps", "recordSession", "recordRung", "rotAdvance"]) { const real = v[k]; v[k] = function () { h.practice.push(k); return real ? real.apply(this, arguments) : undefined; }; }
  } });
  (new Function("cfg", "(" + cfg.seed + ")(cfg)"))(cfg);
}

// One round game with its say-it card open. cfg.tts: bytes of PCM to answer
// /api/tts with (Echo speaks; otherwise muted).
export async function earPage(browser, BASE, cfg) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (cfg.tts && url === BASE + "/api/tts") return route.fulfill({ status: 200, contentType: "application/octet-stream", body: Buffer.alloc(cfg.tts) });
    return url.startsWith(BASE + "/") ? route.continue() : route.abort();
  });
  await context.addInitScript(realPhone, { muted: !cfg.tts, ...cfg, seed: seed.toString() });
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/arcade-" + cfg.game + ".html?from=charge");
  await page.waitForFunction(() => window.gameEntryAllowed === true && typeof crash === "function");
  await page.waitForTimeout(300);
  await page.evaluate(() => crash());
  if (!cfg.tts) await page.waitForFunction(() => __ear.streams === 1);
  return { context, page, errors };
}
export const until = (page, fn, ms, arg) => page.waitForFunction(fn, arg, { timeout: ms, polling: 20 }).then(() => true, () => false);
export const answered = (page, ms) => until(page, () => REV === 2, ms);
