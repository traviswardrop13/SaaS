// SAYIT1: the say-it card in the five round games (Fruit Slice, Piano Tiles,
// Block Stacker, Sound Sprint, Flappy Glide), 2 Oct 2026. Travis, on the
// iPhone: "there's no voice telling them to say it. Most of these kids can't
// read ... it took a while to catch the audio. It was kind of frozen", and
// "i also wanna try to have the 11 labs voice say 'Go!'".
//
// Part one drives the card's voice on a fake phone: Echo says "To keep
// playing, say", Rachel's one recorded take plays, Echo says "Go!", and only
// then, a short tail after "Go!", is the mic asked for. In the iPhone app his
// lines are media (Sona.mediaPCM); on the website they are Web Audio on the
// page's own context, which the child's taps have woken. Echo's lines are
// asked for when the page loads and kept in the phone's voice cache. The
// card never looks frozen: a slow voice service, a media element that never
// starts, one the phone refuses, and a mic the phone has said no to all get
// the child to the mic (or the round's end) in seconds. Voice off goes
// straight to the mic; a card closed mid-line, or a page hidden mid-line,
// stops the voice and opens no mic.
//
// Part two plays a real child into the page's own Web Audio analyser through
// a synthetic MediaStream (tests/_sayitear.mjs): one who answers right after
// "Go!" is heard. What counts as the child is each page's own ear, unchanged
// by this (micquietgamestest holds its quiet rules). Nothing here is practice
// data: the card's heard sound was never logged as practice, and these
// checks write none.
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from "./_env.mjs";
import { serve, seed, earPage, until, answered } from "./_sayitear.mjs";

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT;
const { server, BASE } = await serve(ROOT);
const browser = await chromium.launch(launchOpts(["--autoplay-policy=no-user-gesture-required"]));
let failures = 0, assertions = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(detail))); }
// SAYIT_ONLY=<regex> runs only the scenarios whose names match
const ONLY = process.env.SAYIT_ONLY ? new RegExp(process.env.SAYIT_ONLY) : null;
async function scenario(name, fn) { if (ONLY && !ONLY.test(name)) return; try { await fn(); } catch (e) { ok(name + " completes without a harness/page exception", false, e.stack); } }
const GAMES = ["slice", "stack", "run", "glide", "tiles"];
// Echo's two lines come back as PCM of different lengths, so the page's media
// element tells which line it is playing (its WAV is 44 bytes of header more),
// and on the website so does the Web Audio buffer (two bytes a sample).
const PCM = { "To keep playing, say": 9600, "Go!": 4800 };
const ASK = PCM["To keep playing, say"] + 44, GO = PCM["Go!"] + 44;
const TAKE_SAMPLES = 12345;   // what the fake website decodes Rachel's take to

// ── part one: a fake phone that logs every line Echo plays and every mic ──
// cfg.native: inside the iPhone app. cfg.stuck: every media element's play()
// never settles. cfg.refuse: the phone refuses every media element at once.
// cfg.denied: the phone has said no to the mic.
function voicePhone(cfg) {
  const h = window.__card = { media: [], web: [], synth: [], mics: [], voice: false, hidden: false, sizes: {}, practice: [] };
  if (cfg.native) window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", Plugins: {} };
  Object.defineProperty(document, "hidden", { configurable: true, get: () => h.hidden });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h.hidden ? "hidden" : "visible") });
  h.hide = () => { h.hidden = true; document.dispatchEvent(new Event("visibilitychange")); };
  h.show = () => { h.hidden = false; document.dispatchEvent(new Event("visibilitychange")); };
  const live = () => h.mics.some((m) => m.end == null);
  const createURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (b) => { const u = createURL(b); h.sizes[u] = b.size; return u; };
  // what the card's Echo looked like, and what the card said, as each line began
  const look = (a) => { const e = document.querySelector("#revOvl .ovlEcho"); a.pose = e ? e.getAttribute("src") : ""; a.note = (document.getElementById("revListen") || {}).textContent; a.live = live(); };
  window.Audio = function (src) {
    const a = { src, volume: 1, paused: false, start: null, end: null, removeAttribute() {}, load() {},
      play() {
        a.start = performance.now(); a.size = h.sizes[src] || 0; h.media.push(a); look(a);
        if (cfg.stuck) return new Promise(() => {});
        if (cfg.refuse) { a.end = a.start; return Promise.reject(new DOMException("refused", "NotAllowedError")); }
        a.timer = setTimeout(() => { a.end = performance.now(); if (a.onended) a.onended(); }, cfg.speechMs || 150);
        return Promise.resolve();
      },
      pause() { a.paused = true; clearTimeout(a.timer); if (a.end == null) a.end = performance.now(); } };
    return a;
  };
  // the browser's own voice: begins at once, ends after speechMs
  window.speechSynthesis.speak = (u) => {
    const s = { text: String(u.text), start: performance.now(), end: null }; look(s); h.synth.push(s);
    setTimeout(() => { if (u.onstart) u.onstart(); }, 5);
    s.timer = setTimeout(() => { s.end = performance.now(); if (u.onend) u.onend(); }, cfg.speechMs || 150);
  };
  window.speechSynthesis.cancel = () => { h.synth.forEach((s) => { if (s.end == null) { clearTimeout(s.timer); s.end = performance.now(); } }); };
  if (cfg.denied) {
    const q = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (d) => (d && d.name === "microphone" ? Promise.resolve({ state: "denied" }) : q(d));
  }
  navigator.mediaDevices.getUserMedia = () => {
    const m = { asked: performance.now(), end: null }; h.mics.push(m);
    if (cfg.denied) { m.end = m.asked; return Promise.reject(new DOMException("denied", "NotAllowedError")); }
    const t = { kind: "audio", readyState: "live", stop() { if (this.readyState === "live") { this.readyState = "ended"; m.end = performance.now(); } } };
    return Promise.resolve({ getTracks: () => [t], getAudioTracks: () => [t] });
  };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ gain: param(), frequency: param(), Q: param(), type: "", buffer: null, connect() {}, disconnect() {}, start() {}, stop() {} });
  // On the website Echo's lines are Web Audio buffers: each one started is
  // logged by its length, and ends after speechMs
  const source = () => {
    const s = node();
    s.start = () => {
      if (!s.buffer || s.buffer.length <= 1) return;   // the iPhone's unlock blip
      const w = { len: s.buffer.length, start: performance.now(), end: null }; look(w); h.web.push(w); s.rec = w;
      s.timer = setTimeout(() => { w.end = performance.now(); if (s.onended) s.onended(); }, cfg.speechMs || 150);
    };
    s.stop = () => { clearTimeout(s.timer); if (s.rec && s.rec.end == null) s.rec.end = performance.now(); };
    return s;
  };
  function AC() { this.state = "running"; this.sampleRate = 48000; this.currentTime = 0; this.destination = {}; }
  AC.prototype = { resume() { return Promise.resolve(); }, suspend() { return Promise.resolve(); }, close() { return Promise.resolve(); },
    createGain: node, createOscillator: node, createBufferSource: source, createBiquadFilter: node,
    createBuffer(c, n, sr) { return { length: n, sampleRate: sr, duration: n / sr, getChannelData: () => new Float32Array(n) }; },
    decodeAudioData(b, ok) { const buf = { length: 12345, sampleRate: 24000, duration: 12345 / 24000, getChannelData: () => new Float32Array(12345) }; if (ok) ok(buf); return Promise.resolve(buf); },
    createMediaStreamSource(st) { return { connect(an) { an.st = st; }, disconnect() {} }; },
    // a quiet room is a faint hiss (bytes 127/128), the child a loud low voice
    createAnalyser() { const an = { fftSize: 512, frequencyBinCount: 256, connect() {}, disconnect() {},
      getByteTimeDomainData(a) { const on = h.voice && an.st && an.st.getTracks()[0].readyState === "live"; for (let i = 0; i < a.length; i++) a[i] = on ? (i % 2 ? 200 : 56) : 128 - (i & 1); },
      getByteFrequencyData(a) { a.fill(0); if (h.voice) for (let i = 1; i <= 10; i++) a[i] = 220; } }; return an; } };
  window.AudioContext = window.webkitAudioContext = AC;
  let sona;
  Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set(v) {
    sona = v; v.confetti = () => {};
    for (const k of ["logAttempt", "bumpReps", "recordSession", "recordRung", "rotAdvance"]) { const real = v[k]; v[k] = function () { h.practice.push(k); return real ? real.apply(this, arguments) : undefined; }; }
  } });
  if (!sessionStorage.getItem("sona.test.seeded")) { sessionStorage.setItem("sona.test.seeded", "1"); (new Function("cfg", "(" + cfg.seed + ")(cfg)"))(cfg); }
}
async function voicePage(cfg) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const tts = [];
  await context.route("**/*", (route) => {
    const r = route.request(), url = r.url();
    if (url === BASE + "/api/tts") {
      let text = ""; try { text = JSON.parse(r.postData()).text; } catch (e) {} tts.push(text);
      const answer = () => route.fulfill({ status: 200, contentType: "application/octet-stream", body: Buffer.alloc(PCM[text] || 2400) }).catch(() => {});
      if (cfg.ttsDelay) { setTimeout(answer, cfg.ttsDelay); return; }
      return answer();
    }
    return url.startsWith(BASE + "/") ? route.continue() : route.abort();
  });
  await context.addInitScript(voicePhone, { native: true, ...cfg, seed: seed.toString() });
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/arcade-" + cfg.game + ".html?from=charge");
  await page.waitForFunction(() => window.gameEntryAllowed === true && typeof crash === "function");
  await page.waitForTimeout(300);
  return { context, page, errors, tts };
}
const media = (page) => page.evaluate(() => __card.media.map((a) => ({ src: a.src, size: a.size, start: a.start, end: a.end, paused: a.paused, pose: a.pose, note: a.note, live: a.live })));
const web = (page) => page.evaluate(() => __card.web.slice());
const mics = (page) => page.evaluate(() => __card.mics.slice());
const kind = (m) => (m.size === ASK ? "ask" : m.size === GO ? "go" : /\/coach\/say-echo\/R-sound\.wav$/.test(m.src) ? "R" : m.src);
const webKind = (w) => (w.len === PCM["To keep playing, say"] / 2 ? "ask" : w.len === PCM["Go!"] / 2 ? "go" : w.len === TAKE_SAMPLES ? "take" : "len " + w.len);

try {
  for (const game of GAMES) {
    await scenario(game + ": the card asks out loud", async () => {
      const { context, page, errors, tts } = await voicePage({ game, speechMs: 400 });
      try {
        await page.evaluate(() => crash());
        await page.locator("#revOvl.show").waitFor();
        const speaking = await until(page, () => __card.media.length === 1, 3000);
        const during = await page.evaluate(() => ({ note: document.getElementById("revListen").textContent, pose: document.querySelector("#revOvl .ovlEcho").getAttribute("src"), mics: __card.mics.length }));
        ok(game + ": the card speaks before it listens: \"Listen to Echo…\", Echo in his talking pose, no mic", speaking && /Listen to Echo/.test(during.note) && /echo-talk/.test(during.pose) && during.mics === 0, during);
        const opened = await until(page, () => __card.mics.length === 1, 6000);
        const m = await media(page), mic = (await mics(page))[0];
        ok(game + ": Echo says \"To keep playing, say\", then Rachel's one recorded R, then \"Go!\", as media in the app", opened && m.length === 3 && kind(m[0]) === "ask" && kind(m[1]) === "R" && kind(m[2]) === "go" && /^blob:/.test(m[0].src) && /^blob:/.test(m[2].src), m.map(kind));
        ok(game + ": each line waits for the one before it", m.length === 3 && m[1].start >= m[0].end && m[2].start >= m[1].end, m);
        // the tail after a voice line (250 ms, as every listening page keeps),
        // not the 900 ms chime window: a child answering on "Go!" is heard
        ok(game + ": the mic is asked for a short tail after \"Go!\" ends, never before it", opened && m.length === 3 && mic.asked - m[2].end >= 230 && mic.asked - m[2].end <= 700, { asked: mic && mic.asked, goEnd: m[2] && m[2].end });
        ok(game + ": nothing Echo says plays into an open mic", m.every((x) => !x.live), m);
        ok(game + ": Echo's two lines came from the voice service, once each, asked for as the page loaded", tts.filter((t) => t === "To keep playing, say").length === 1 && tts.filter((t) => t === "Go!").length === 1, tts);
        const listening = await until(page, () => /listening/i.test(document.getElementById("revListen").textContent), 3000);
        ok(game + ": then it is the child's turn: \"I'm listening…\", Echo in his listening pose", listening && /echo-listen/.test(await page.evaluate(() => document.querySelector("#revOvl .ovlEcho").getAttribute("src"))));
        await page.evaluate(() => { __card.voice = true; }); await page.waitForTimeout(450); await page.evaluate(() => { __card.voice = false; });
        ok(game + ": the child's sound answers the card", await until(page, () => REV === 2 && !document.getElementById("revOvl").classList.contains("show"), 2000));
        // the next card speaks again, from the lines this page already has
        await page.waitForTimeout(400);
        await page.evaluate(() => { if (playing) crash(); });
        await page.locator("#revOvl.show").waitFor();
        const again = await until(page, () => __card.mics.length === 2, 6000);
        const m2 = (await media(page)).slice(3);
        ok(game + ": the next card asks the same way, and its lines need no second download", again && m2.map(kind).join() === "ask,R,go" && tts.length === 2, { m2: m2.map(kind), tts });
        ok(game + ": the card writes no practice data", (await page.evaluate(() => __card.practice.length)) === 0);
        ok(game + ": no runtime errors", errors.length === 0, errors);
      } finally { await context.close(); }
    });

    await scenario(game + ": voice off", async () => {
      const { context, page, errors, tts } = await voicePage({ game, muted: true });
      try {
        await page.evaluate(() => crash());
        const opened = await until(page, () => __card.mics.length === 1, 3000);
        ok(game + ": with sound off the card says nothing and goes straight to the mic", opened && (await media(page)).length === 0 && tts.length === 0, { opened, media: (await media(page)).length, tts });
        ok(game + ": voice off: no runtime errors", errors.length === 0, errors);
      } finally { await context.close(); }
    });

    await scenario(game + ": the card closed mid-line", async () => {
      const { context, page, errors } = await voicePage({ game, speechMs: 1500 });
      try {
        await page.evaluate(() => crash());
        await page.waitForFunction(() => __card.media.length === 2);   // Rachel's take is playing
        await page.locator("#revDone").click();
        // longer than the rest of her take: a voice left running would have
        // gone on to "Go!" by now
        await page.waitForTimeout(1900);
        const m = await media(page);
        ok(game + ": \"I'm done playing\" stops Echo mid-line, and nothing more is said", m.length === 2 && m[1].paused && m[1].end - m[1].start < 1400, m.map((x) => ({ k: kind(x), paused: x.paused, ms: x.end - x.start })));
        ok(game + ": …and the mic is never asked for", (await mics(page)).length === 0);
        ok(game + ": closed mid-line: no runtime errors", errors.length === 0, errors);
      } finally { await context.close(); }
    });

    // (micquietgamestest locks every game's card and checks it listens again)
    if (game === "slice" || game === "stack" || game === "tiles") await scenario(game + ": the page hidden mid-line", async () => {
      const { context, page, errors } = await voicePage({ game, speechMs: 800 });
      try {
        await page.evaluate(() => crash());
        await page.waitForFunction(() => __card.media.length === 1);
        await page.evaluate(() => __card.hide());
        await page.waitForTimeout(600);
        const hidden = await page.evaluate(() => ({ paused: __card.media[0].paused, n: __card.media.length, mics: __card.mics.length }));
        ok(game + ": locking the phone stops Echo mid-line and opens no mic", hidden.paused && hidden.n === 1 && hidden.mics === 0, hidden);
        await page.evaluate(() => __card.show());
        const back = await until(page, () => __card.mics.length === 1, 9000);
        const m = (await media(page)).slice(1);
        ok(game + ": coming back, Echo asks again from the start, then the mic opens", back && m.map(kind).join() === "ask,R,go", m.map(kind));
        ok(game + ": hidden mid-line: no runtime errors", errors.length === 0, errors);
      } finally { await context.close(); }
    });
  }

  // ── the website: Web Audio on the page's own context, never an <audio> ──
  // A browser refuses an <audio> started outside a tap, and the card opens
  // between rounds, so on the website the card used to be silent.
  for (const game of ["slice", "tiles"]) await scenario(game + ": on the website", async () => {
    const { context, page, errors } = await voicePage({ game, native: false, speechMs: 300 });
    try {
      await page.evaluate(() => crash());
      const opened = await until(page, () => __card.mics.length === 1, 6000);
      const w = await web(page), mic = (await mics(page))[0], m = await media(page);
      ok(game + " on the website: Echo says \"To keep playing, say\", Rachel's take, then \"Go!\", through Web Audio, and no <audio> plays", opened && w.map(webKind).join() === "ask,take,go" && m.length === 0, { web: w.map(webKind), media: m.length });
      ok(game + " on the website: each line waits for the one before, and the mic waits for the tail after \"Go!\"", w.length === 3 && w[1].start >= w[0].end && w[2].start >= w[1].end && mic.asked - w[2].end >= 230 && w.every((x) => !x.live), { w, asked: mic && mic.asked });
      ok(game + " on the website: no runtime errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });

  // ── never frozen ──
  // A voice service that takes 5 s to answer: the card waits a moment for
  // Echo's lines, then goes on without them, and the mic opens within 4 s.
  await scenario("slice: a slow voice service", async () => {
    const { context, page, errors, tts } = await voicePage({ game: "slice", ttsDelay: 5000 });
    try {
      const t0 = await page.evaluate(() => { crash(); return performance.now(); });
      const opened = await until(page, () => __card.mics.length === 1, 6000);
      const mic = (await mics(page))[0], m = await media(page);
      ok("slice: with a voice service that takes 5 s, the card skips Echo's lines it does not have and the mic opens within 4 s", opened && mic.asked - t0 < 4000 && m.map(kind).join() === "R", { ms: mic && mic.asked - t0, media: m.map(kind) });
      // the lines that came late are kept: the next card says them at once
      await page.evaluate(() => { __card.voice = true; }); await page.waitForTimeout(450); await page.evaluate(() => { __card.voice = false; });
      await until(page, () => REV === 2, 2000);
      await page.waitForTimeout(2500);
      await page.evaluate(() => { if (playing) crash(); });
      const again = await until(page, () => __card.mics.length === 2, 6000);
      ok("slice: …and the next card says them, with no second download", again && (await media(page)).slice(1).map(kind).join() === "ask,R,go" && tts.length === 2, { media: (await media(page)).map(kind), tts });
      ok("slice slow voice: no runtime errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  // A media element whose play() never settles: mediaPCM gives up on it at 4
  // s, the rest of the ask is skipped (the next one would not start either),
  // and the mic opens.
  await scenario("slice: media that never starts", async () => {
    const { context, page, errors } = await voicePage({ game: "slice", stuck: true });
    try {
      const t0 = await page.evaluate(() => { crash(); return performance.now(); });
      const opened = await until(page, () => __card.mics.length === 1, 7000);
      const mic = (await mics(page))[0], m = await media(page);
      ok("slice: a media element that never starts holds the card about 4 s, not one wait per line, and the mic opens", opened && mic.asked - t0 < 4800 && m.length === 1, { ms: mic && mic.asked - t0, media: m.map(kind) });
      ok("slice: …with no line still playing into it", m.every((x) => x.paused || x.end != null), m);
      ok("slice stuck media: no runtime errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  // A phone that refuses media at once: Echo's lines go to the browser's own
  // voice (a robot is better than silence for a child who can't read), and
  // his last word ends before the mic opens.
  await scenario("slice: media refused", async () => {
    const { context, page, errors } = await voicePage({ game: "slice", refuse: true });
    try {
      await page.evaluate(() => crash());
      const opened = await until(page, () => __card.mics.length === 1, 6000);
      const s = await page.evaluate(() => __card.synth.slice()), mic = (await mics(page))[0];
      ok("slice: media refused, Echo's two lines are said by the browser's voice", opened && s.map((x) => x.text).join("|") === "To keep playing, say|Go!", s);
      ok("slice: …and the mic waits for the last of them to end", opened && s.length === 2 && s[1].end != null && mic.asked - s[1].end >= 230 && s.every((x) => !x.live), { s, asked: mic && mic.asked });
      ok("slice media refused: no runtime errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  // A phone that has said no to the mic: Echo does not tell the child to
  // talk to a mic that cannot hear them; the round ends kindly, at once.
  for (const native of [true, false]) await scenario("slice: mic refused" + (native ? " in the app" : " on the website"), async () => {
    const { context, page, errors } = await voicePage({ game: "slice", denied: true, native });
    try {
      await page.evaluate(() => crash());
      const ended = await until(page, () => window.__ended === true, 2000);
      const c = await page.evaluate(() => ({ media: __card.media.length, web: __card.web.length, synth: __card.synth.length }));
      ok("slice" + (native ? " in the app" : " on the website") + ": the mic refused, Echo asks nothing and the round ends kindly within 2 s", ended && c.media === 0 && c.web === 0 && c.synth === 0, { ended, ...c });
      ok("slice mic refused: no runtime errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });

  // ── part two: a real child, through a synthetic MediaStream ──
  // ── a child who answers right on "Go!" (review, 2 Oct 2026) ──
  // "Go!" tells a child who can't read to speak now. The mic used to wait the
  // 900 ms chime window after Echo's last word, plus the phone's own delay:
  // a 500 ms "rrrr" or "sss" begun 300 ms after "Go!" was half gone, or
  // wholly, before the mic opened, and nothing asked again. Here Echo speaks
  // for real (on the website, through the page's context), and the child
  // answers 300 ms after his "Go!" ends, at the level of Rachel's recording.
  for (const [sound, from] of [["R", 0.05], ["S", 0.1]]) await scenario("slice: " + sound + " right on \"Go!\"", async () => {
    const { context, page, errors } = await earPage(browser, BASE, { game: "slice", sound, hiss: -60, tts: 4800 });
    try {
      const spoke = await until(page, () => /Listen to Echo/.test(document.getElementById("revListen").textContent), 3000);
      const done = await until(page, () => /Get ready/.test(document.getElementById("revListen").textContent), 8000);
      await page.waitForTimeout(300);
      await page.evaluate(([from]) => __ear.say(0, 500, null, from), [from]);
      ok("slice: a 500 ms " + sound + " begun 300 ms after \"Go!\" ends answers the card", spoke && done && (await answered(page, 3500)), await page.evaluate(() => ({ REV, floor: rv.floor, streams: __ear.streams, note: document.getElementById("revListen").textContent })));
      ok("slice " + sound + " on Go: no runtime errors or practice writes", errors.length === 0 && (await page.evaluate(() => __ear.practice.length)) === 0, errors);
    } finally { await context.close(); }
  });
} finally { await browser.close(); await new Promise((r) => server.close(r)); }
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
