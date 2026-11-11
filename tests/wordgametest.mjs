// iPhone word turns must verify the requested word, not just a low/hissy
// burst. The real pages, shared speechTurn and hearVerdict run together;
// only the phone's transcript and microphone hardware are replaced. This
// proves wiring and lifecycle, not Apple's accuracy on children's voices.
// SONATEST_PUBLIC_ROOT may point at the pre-fix source for the red run.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";
import { fakeDevice } from "./_sayplaydevice.mjs";
const source = process.env.SONATEST_PUBLIC_ROOT || ROOT;
const mime = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", webp: "image/webp", woff2: "font/woff2" };
const server = createServer((req, res) => {
  const u = new URL(req.url, "http://local");
  if (u.pathname.startsWith("/api/")) { res.writeHead(503); res.end("{}"); return; }
  let file = u.pathname === "/_wordgame.html" ? path.join(ROOT, "../tests/fixtures/sayplay-scene.html") : path.join(source, u.pathname);
  if (!existsSync(file)) file = path.join(ROOT, u.pathname);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": mime[file.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch(launchOpts());
let checks = 0, failures = 0;
function ok(name, pass, extra) { checks++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(extra))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + " completes", false, e.stack); } }
function nativeDevice(cfg) {
  const h = window.__word = { text: cfg.text || "taco", starts: [], stops: [], pending: 0, reps: 0, delay: cfg.stopDelay || 0, startDelay: cfg.startDelay || 0, unavailable: !!cfg.unavailable };
  if (cfg.text === "") h.text = "";
  if (cfg.sound === "S") {
    const makeAnalyser = AudioContext.prototype.createAnalyser;
    AudioContext.prototype.createAnalyser = function () {
      const analyser = makeAnalyser.call(this);
      analyser.getByteFrequencyData = data => {
        data.fill(0);
        if (analyser.hears()) data.fill(220, 28, 54);
      };
      return analyser;
    };
  }
  if (cfg.native !== false) {
    const plugins = {};
    if (!cfg.noSpeechBridge) plugins.SonaSpeech = {
      available: () => Promise.resolve({ available: !h.unavailable, onDevice: true, authorized: !h.unavailable }),
      requestPermission: () => Promise.resolve({ granted: !h.unavailable }),
      start: opts => { h.starts.push({ opts, at: performance.now() }); sessionStorage.setItem('__word.nativeStarts', String((+sessionStorage.getItem('__word.nativeStarts') || 0) + 1)); return new Promise(r => setTimeout(() => r({ started: true }), h.startDelay)); },
      stop: () => { const text = h.text, item = { at: performance.now(), end: null }; h.stops.push(item); h.pending++; return new Promise(r => setTimeout(() => { item.end = performance.now(); h.pending--; r({ text, onDevice: true }); }, h.delay)); }
    };
    window.Capacitor = { isNativePlatform: () => true, Plugins: plugins };
  }
  const descriptor = Object.getOwnPropertyDescriptor(window, "Sona");
  Object.defineProperty(window, "Sona", { configurable: true, get: descriptor.get, set(value) {
    descriptor.set(value);
    const words = value.wordsFor, pool = value.playPool, rep = value.gameRep;
    value.wordsFor = (sound, pos) => sound === "R" ? [{ w: "rabbit", e: "🐇", pos: "i" }] : words(sound, pos);
    // Pick a known item out of the actual position's pool. This keeps its
    // bank metadata and makes the scenario independent of random draws.
    if (pool) value.playPool = (sound, size) => {
      const entries = pool(sound, size);
      return sound === (cfg.sound || "R") ? entries.filter(w => w.w === (cfg.prompt || "rabbit")) : entries;
    };
    value.gameWords = () => [];
    value.gameRep = function () { h.reps++; return rep.apply(value, arguments); };
    if (cfg.noHelper) delete value.speechTurn;
  } });
}
async function fresh(kind, cfg = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", r => r.request().url().startsWith(base + "/") ? r.continue() : r.abort());
  const device = { micok: true, voiceOn: false, soundOn: false, volume: 0, gumDelay: cfg.gumDelay || 0 };
  if (cfg.sound) device.seed = { "sona.profile.v1": JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: [cfg.sound], wordPosition: cfg.position, onboarded: true, earlyAdopter: true, voiceOn: false, soundOn: false, volume: 0 }) };
  await context.addInitScript(fakeDevice, device);
  await context.addInitScript(nativeDevice, cfg);
  const page = await context.newPage(), errors = []; page.on("pageerror", e => errors.push(e.message)); page.setDefaultTimeout(6000);
  await page.goto(base + (kind === "feed" ? "/arcade-feed.html" : "/_wordgame.html"));
  await page.locator("#startBtn").click();
  if (cfg.pendingMic) await page.waitForFunction(() => __quiet.inflight > 0);
  else if (cfg.unavailable || cfg.noHelper) await page.waitForTimeout(1000);
  else await listening(page, kind, cfg.noSpeechBridge);
  return { page, context, errors };
}
async function listening(page, kind, allowRetry = false) {
  await page.waitForFunction(({ kind, allowRetry }) => {
    if (allowRetry && !document.getElementById("micBtn").hidden) return true;
    return kind === "feed" ? /Your turn/.test(document.getElementById("bSub").textContent) : window.__sayplay && __sayplay.listening;
  }, { kind, allowRetry });
  await page.waitForTimeout(500);
}
async function speak(page, text, duration = 420) {
  await page.evaluate(t => { __word.text = t; __quiet.voice = true; }, text);
  await page.waitForTimeout(duration);
  await page.evaluate(() => { __quiet.voice = false; });
  await page.waitForTimeout(1150);
}
const snapshot = page => page.evaluate(() => ({ reps: __word.reps, game: window.__sayplay, locked: document.getElementById("grid")?.classList.contains("locked"), stars: document.getElementById("starN")?.textContent, starts: __word.starts, stops: __word.stops, pending: __word.pending, live: __quiet.live(), sfx: __quiet.sfx }));
async function retry(page, kind) { await page.locator("#micBtn").click(); await listening(page, kind); }
async function sibling(page) {
  await page.evaluate(() => { Sona.addKid("Sibling", "6"); Sona.saveProfile({ ...Sona.getProfile(), onboarded: true, focusSounds: ["R"] }); });
}
const ownershipOnly = process.env.WORDGAME_PART === "ownership";
const positionOnly = process.env.WORDGAME_PART === "position";
const bridgeOnly = process.env.WORDGAME_PART === "bridge";
try {
  if (!ownershipOnly && !bridgeOnly) await scenario("sayplay verifies the blend position of its actual picture word", async () => {
    const { page, context, errors } = await fresh("sayplay", { sound: "S", position: "b", prompt: "stop" });
    try {
      const target = await snapshot(page);
      ok("sayplay: the S blend pool asks for stop", target.game.sound === "S" && target.game.word === "stop", target);
      await speak(page, "top");
      let s = await snapshot(page);
      ok("sayplay: dropping the S from stop earns no dot after native recognition", s.stops.length === 1 && s.reps === 0 && s.game.said === 0 && s.game.step === 0, s);
      await retry(page, "sayplay"); await speak(page, "stop");
      s = await snapshot(page);
      ok("sayplay: saying stop earns exactly one dot", s.stops.length === 2 && s.reps === 1 && s.game.said === 1 && s.game.step === 0, s);
      await listening(page, "sayplay"); await speak(page, "top");
      s = await snapshot(page);
      ok("sayplay: the next saying still checks the blend position", s.stops.length === 3 && s.reps === 1 && s.game.said === 1 && s.game.step === 0, s);
      ok("sayplay: blend recognition has no page exception", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  if (!positionOnly) for (const kind of ["sayplay", "feed"]) {
    if (!ownershipOnly) {
      await scenario(kind + " older iPhone shell without the speech bridge", async () => {
        const { page, context, errors } = await fresh(kind, { noSpeechBridge: true });
        try {
          const shell = await page.evaluate(() => ({ native: Sona.isNativeApp(), media: Sona.voiceAsMedia(), speech: !!window.Capacitor.Plugins.SonaSpeech }));
          ok(kind + ": the older shell keeps native audio mode with no speech bridge", shell.native && shell.media && !shell.speech, shell);
          let s = await snapshot(page);
          ok(kind + ": silence earns nothing while the older shell listens", s.live === 1 && s.reps === 0 && (kind === "feed" ? s.locked && s.stars === "0" : s.game.listening && s.game.said === 0 && s.game.step === 0), s);
          await speak(page, ""); s = await snapshot(page);
          ok(kind + ": the older shell credits one voiced saying by sound shape", s.reps === 1 && s.starts.length === 0 && s.stops.length === 0 && (kind === "feed" ? !s.locked : s.game.said === 1 && s.game.step === 0), s);
          ok(kind + ": older shell listening has no page exception", errors.length === 0, errors);
        } finally { await context.close(); }
      });
      await scenario(kind + " installed speech bridge unavailable", async () => {
        const { page, context, errors } = await fresh(kind, { unavailable: true });
        try {
          await speak(page, "");
          const s = await snapshot(page);
          ok(kind + ": an unavailable installed speech bridge requires more than sound shape", s.reps === 0 && s.starts.length === 0 && (kind === "feed" ? s.locked : s.game.said === 0 && s.game.step === 0), s);
          ok(kind + ": unverified speech offers a quiet retry", await page.locator("#micBtn").isVisible());
          ok(kind + ": no page exception", errors.length === 0, errors);
        } finally { await context.close(); }
      });
    }
    if (bridgeOnly) continue;
    await scenario(kind + " child changes while the microphone opens", async () => {
      const { page, context, errors } = await fresh(kind, { pendingMic: true, gumDelay: 1200, text: "rabbit" });
      try {
        await sibling(page); await page.waitForTimeout(1700); await speak(page, "rabbit");
        const s = await page.evaluate(() => ({ path: location.pathname, starts: +sessionStorage.getItem('__word.nativeStarts') || 0, reps: Sona.dayReps(), live: __quiet.live() }));
        ok(kind + ": a pending mic cannot adopt the sibling or start recognition for the old word", s.path !== '/_wordgame.html' && s.path !== '/arcade-feed.html' && s.starts === 0 && s.reps === 0 && s.live === 0, s);
        ok(kind + ": stale mic handoff has no page exception", errors.length === 0, errors);
      } finally { await context.close(); }
    });
    await scenario(kind + " child changes before a word retry", async () => {
      const { page, context, errors } = await fresh(kind);
      try {
        await speak(page, "taco"); await page.waitForFunction(() => !document.getElementById('micBtn').hidden);
        await sibling(page); await page.locator('#micBtn').click(); await page.waitForTimeout(900); await speak(page, "rabbit");
        const s = await page.evaluate(() => ({ path: location.pathname, starts: +sessionStorage.getItem('__word.nativeStarts') || 0, reps: Sona.dayReps(), live: __quiet.live() }));
        ok(kind + ": a stale retry retires the page instead of giving the old word to the sibling", s.path !== '/_wordgame.html' && s.path !== '/arcade-feed.html' && s.starts === 1 && s.reps === 0 && s.live === 0, s);
        ok(kind + ": stale retry has no page exception", errors.length === 0, errors);
      } finally { await context.close(); }
    });
    if (ownershipOnly) continue;
    await scenario(kind + " rejects unrelated words, preserves close tries", async () => {
      const { page, context, errors } = await fresh(kind);
      try {
        await speak(page, "taco"); let s = await snapshot(page);
        ok(kind + ": a same-family random word earns no rep or move", s.reps === 0 && (kind === "feed" ? s.locked && s.stars === "0" : s.game.said === 0 && s.game.step === 0), s);
        ok(kind + ": a retry is available without a grade", await page.locator("#micBtn").isVisible());
        await retry(page, kind); await speak(page, "wabbit"); s = await snapshot(page);
        ok(kind + ": the existing close try earns exactly one saying", s.reps === 1 && (kind === "feed" ? !s.locked : s.game.said === 1 && s.game.step === 0), s);
        ok(kind + ": verification does not supply the target as a recognition hint", s.starts.length > 0 && s.starts.every(x => x.opts.words.length === 0), s.starts);
        if (kind === "sayplay") {
          await listening(page, kind); await speak(page, "taco"); s = await snapshot(page);
          ok("sayplay: an earlier accepted word cannot credit the second random saying", s.reps === 1 && s.game.said === 1 && s.game.step === 0 && s.starts.length >= 3, s);
          await retry(page, kind); await speak(page, "rabbit"); s = await snapshot(page);
          ok("sayplay: a separately verified second saying earns the move", s.reps === 2 && s.game.step === 1, s);
        }
        ok(kind + ": no page exception", errors.length === 0, errors);
      } finally { await context.close(); }
    });
    for (const cfg of [{ text: "" }, { noHelper: true }]) await scenario(kind + " unclear or unavailable", async () => {
      const { page, context, errors } = await fresh(kind, cfg);
      try {
        await speak(page, "");
        const s = await snapshot(page);
        ok(kind + ": " + (cfg.noHelper ? "old cached shared script" : "empty text") + " never becomes family-only success", s.reps === 0 && (kind === "feed" ? s.locked : s.game.said === 0 && s.game.step === 0), s);
        ok(kind + ": unverified speech offers a quiet retry", await page.locator("#micBtn").isVisible());
        ok(kind + ": no page exception", errors.length === 0, errors);
      } finally { await context.close(); }
    });
    await scenario(kind + " child changes during verification", async () => {
      const { page, context, errors } = await fresh(kind, { text: "rabbit", stopDelay: 550 });
      try {
        await page.evaluate(() => { __quiet.voice = true; }); await page.waitForTimeout(420);
        await page.evaluate(() => { __quiet.voice = false; }); await page.waitForTimeout(320);
        await page.evaluate(() => Sona.addKid("Sibling", "6")); await page.waitForTimeout(900);
        const s = await snapshot(page);
        ok(kind + ": a late word cannot credit a sibling and releases the microphone", s.reps === 0 && s.live === 0 && s.pending === 0, s);
        ok(kind + ": no page exception", errors.length === 0, errors);
      } finally { await context.close(); }
    });
    await scenario(kind + " a continuous hold reaches the cap", async () => {
      const { page, context, errors } = await fresh(kind, { text: "rabbit" });
      try {
        await page.evaluate(() => { __quiet.voice = true; });
        await page.waitForTimeout(kind === "feed" ? 8500 : 12500);
        const s = await snapshot(page);
        ok(kind + ": a cap without a quiet word ending earns nothing and never rearms", s.reps === 0 && s.starts.length === 1 && s.live === 0 && s.pending === 0, s);
        ok(kind + ": no page exception", errors.length === 0, errors);
      } finally { await context.close(); }
    });
    await scenario(kind + " keeps full word and pending final private", async () => {
      const { page, context, errors } = await fresh(kind, { text: "rabbit", stopDelay: 550 });
      try {
        await page.evaluate(() => { __quiet.voice = true; }); await page.waitForTimeout(900);
        let s = await snapshot(page);
        ok(kind + ": a loud onset does not stop Apple mid-word or earn early credit", s.stops.length === 0 && s.reps === 0 && s.live === 1, s);
        await page.evaluate(() => { __quiet.voice = false; }); await page.waitForTimeout(320); s = await snapshot(page);
        ok(kind + ": final text is awaited without rep or chime", s.pending > 0 && s.reps === 0 && s.sfx.length === 0, s);
        await page.evaluate(() => { __quiet.background(); }); await page.waitForTimeout(900); s = await snapshot(page);
        ok(kind + ": leaving during a pending final cancels credit and closes the mic", s.reps === 0 && s.live === 0 && s.pending === 0 && s.sfx.length === 0, s);
        ok(kind + ": no page exception", errors.length === 0, errors);
      } finally { await context.close(); }
    });
    await scenario(kind + " browser unchanged", async () => {
      const { page, context, errors } = await fresh(kind, { native: false });
      try {
        await page.evaluate(() => { __quiet.voice = true; }); await page.waitForTimeout(160);
        const s = await snapshot(page);
        ok(kind + ": browser keeps immediate family-based saying with no Apple session", s.reps === 1 && s.starts.length === 0, s);
        ok(kind + ": no page exception", errors.length === 0, errors);
      } finally { await context.close(); }
    });
  }
  if (!ownershipOnly && !positionOnly && !bridgeOnly) await scenario("sayplay rearm waits for a fresh quiet gap", async () => {
    const { page, context, errors } = await fresh("sayplay", { text: "rabbit", stopDelay: 550 });
    try {
      await page.evaluate(() => { __quiet.voice = true; }); await page.waitForTimeout(420);
      await page.evaluate(() => { __quiet.voice = false; }); await page.waitForTimeout(320);
      await page.evaluate(() => { __quiet.voice = true; }); await page.waitForTimeout(1000);
      let s = await snapshot(page);
      ok("sayplay: a sound still held after final text cannot open the next recognizer or earn another dot", s.reps === 1 && s.game.said === 1 && s.starts.length === 1, s);
      await page.evaluate(() => { __quiet.voice = false; }); await page.waitForTimeout(800); s = await snapshot(page);
      ok("sayplay: fresh quiet rearms a clean next session without credit by itself", s.reps === 1 && s.starts.length === 2 && s.game.listening, s);
      ok("sayplay: no page exception", errors.length === 0, errors);
    } finally { await context.close(); }
  });
} finally { await browser.close(); await new Promise(r => server.close(r)); }
console.log(checks + " checks, " + failures + " failures"); process.exitCode = failures ? 1 : 0;
