// MICQUIET1: on the practice screen, Sona never makes a sound into a live mic.
//
// Why (24 Sep 2026): on an iPhone, a web page holding the microphone runs the
// phone-call audio mode. The volume buttons change CALL volume and everything
// Sona plays is processed like a call. The practice screen used to open the
// mic before Echo's prompt, keep it open under every coaching line and replay,
// and close it just before the win chime, so the phone switched modes at the
// loudest moments. Travis heard "too loud or too quiet, jumpy, explosive".
// Now Echo speaks, and every chime and celebration plays, into a CLOSED mic.
// The mic opens only for the child's listening window, a quarter-second after
// Sona's last sound, and "Your turn" shows only once it is open and can hear.
// Keeping the mic closed under Echo also means Echo's voice can never become
// a try, reach the parent's listen-back clip, or reach the native recognizer,
// whose transcript can decide a verdict.
// REWRITTEN 24 Sep 2026, after review:
//  - NO exceptions. A counted try used to ring a short chime inside the open
//    window, behind a guard that kept the detector deaf to it — and the
//    guard swallowed a quick next try. Nothing sounds into a live mic now.
//  - Nothing starts in the first 150ms after a mic closes (the page waits
//    200ms, as the games do): the phone switches back from call audio in
//    silence, not under Echo's first word or the win chime.
//  - The room is measured once, on the explainer-tap mic before Echo speaks,
//    so an eager child who answers before the window opens is not measured
//    as "the room" and locked out of their own tries.
//
// The real page runs with silent, logged device edges: a fake AudioContext,
// microphone, recorder, <audio>, browser voice and native recognizer. Every
// sound start is logged with what the mic and the recognizer were doing at
// that moment. No hardware, no network, no OS audio.
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import path from 'path';
import { chromium, ROOT, launchOpts } from './_env.mjs';

const publicRoot = process.env.SONATEST_PUBLIC_ROOT || ROOT;
const mime = { html:'text/html', js:'text/javascript', css:'text/css', svg:'image/svg+xml', png:'image/png', webp:'image/webp', woff2:'font/woff2' };
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://local');
  if (u.pathname.startsWith('/api/')) { res.writeHead(200, { 'content-type':'application/json' }); res.end('{}'); return; }
  const file = path.join(publicRoot, u.pathname);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': mime[file.split('.').pop()] || 'application/octet-stream' }); res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, detail = '') { assertions++; if (!pass) failures++; console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : ' → ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + ' completes without exception', false, e.stack); } }

function device(config) {
  const h = window.__quiet = { streams: [], events: [], lines: [], recognizing: false, verify: config.verify || 'pass', voice: false, talking: 0, effects: [], sfxName: null, sounding: 0, lastEnd: null, lastOpen: null, firstLive: null, turns: [], grownUp: false, promptEnd: null };
  const later = window.setTimeout.bind(window), now = () => performance.now();
  h.micLive = () => h.streams.some((s) => s.track.readyState === 'live');
  function log(kind, label) { const e = { kind, label, t: now(), micLive: h.micLive(), recognizing: h.recognizing }; h.events.push(e); return e; }
  // The child says it from `at` ms from now for `ms` ms. A count, not a flag,
  // so two scripted sayings that overlap cannot cut each other short.
  const say = (at, ms) => { later(() => { h.talking++; }, at); later(() => { h.talking--; }, at + ms); };
  function ended(at) { h.lastEnd = Math.max(h.lastEnd == null ? -Infinity : h.lastEnd, at); }

  // ---- microphone: every open is logged with how long Sona had been quiet,
  // and every close of a live track with when it happened. config.micDelay
  // is how long the phone takes to open it (an iPhone switching into call
  // audio takes a few hundred ms). ----
  navigator.mediaDevices.getUserMedia = async () => {
    const e = log('mic-open'); e.sounding = h.sounding; e.sinceSound = h.lastEnd == null ? Infinity : now() - h.lastEnd;
    if (config.micDelay) await new Promise((r) => later(r, config.micDelay));
    e.liveAt = now();
    const track = { readyState: 'live', muted: false, stop() { if (this.readyState === 'live') log('mic-close'); this.readyState = 'ended'; } };
    const s = { track, at: now(), getTracks: () => [track], getAudioTracks: () => [track] };
    h.streams.push(s); h.lastOpen = now(); if (h.firstLive == null) h.firstLive = now();
    // config.pre: the child says it for `hold` ms the moment the grown-up's
    // tap opens the mic — through the room reading, before Echo has spoken.
    if (config.pre && h.streams.length === 1) say(0, config.pre.hold);
    // config.atWindow: the child is already talking as the first listening
    // window's mic opens, for `hold` ms, then says it `more` times (300ms
    // each, 500ms apart).
    if (config.atWindow && h.streams.length === 2) { const c = config.atWindow; say(0, c.hold); for (let i = 0, t = c.hold + 500; i < c.more; i++, t += 800) say(t, 300); }
    return s;
  };
  // ---- Web Audio: the page's voice (PCM), sona.js's chimes, the listener ----
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  class Context {
    constructor() { this.state = 'running'; this.sampleRate = 48000; this.destination = {}; }
    get currentTime() { return now() / 1000; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { return Promise.resolve(); }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
    createOscillator() {
      const o = { type: 'sine', frequency: param(), connect() {}, disconnect() {},
        // A chime is logged once per sona.js sfx call (below); a note played
        // any other way is still a sound, and is logged on its own.
        start() { if (!h.sfxName) log('chime', '?'); },
        stop(t) { const end = Math.max(now(), (t || 0) * 1000); ended(end); later(() => { if (o.onended) o.onended(); }, end - now()); } };
      return o;
    }
    createBuffer(channels, n, rate) { const data = new Float32Array(n); return { duration: n / rate, sampleRate: rate, getChannelData: () => data }; }
    createBufferSource() {
      const b = { buffer: null, connect() {}, disconnect() {}, stop() {},
        start() {
          // The line's id rides in the first sample of its PCM (see fetch).
          const id = Math.round(b.buffer.getChannelData(0)[0] * 32768);
          const e = log('voice', h.lines[id - 1] || '?'); h.sounding++;
          later(() => {
            h.sounding--; ended(now());
            // config.child: the child's script, from the moment the first
            // prompt ends — they start `onset` ms later and hold `hold` ms,
            // then say it again `more` times (300ms each, 500ms apart).
            if (h.promptEnd == null && /^Ready\?/.test(e.label)) h.promptEnd = now();
            if (config.child && !h.childStarted && /^Ready\?/.test(e.label)) {
              h.childStarted = true; const c = config.child; let t = c.onset;
              say(t, c.hold); t += c.hold + 500;
              for (let i = 0; i < c.more; i++, t += 800) say(t, 300);
            }
            if (b.onended) b.onended();
          }, 90);
        } };
      return b;
    }
    createMediaStreamSource(stream) { return { stream, connected: false, connect(a) { this.connected = true; a.graph = this; }, disconnect() { this.connected = false; } }; }
    createAnalyser() {
      // A voiced 187.5Hz waveform with harmonics while the child "speaks"
      // into a live, connected mic (~0.17 RMS; config.childGain scales it);
      // otherwise the faint hiss every real mic has (one step of the byte
      // scale, ~0.005), or — config.hiss === false — pure digital zeros,
      // which is a mic still starting up, never a room. config.warm: zeros
      // for that many ms after the first mic opens, then the hiss.
      // config.loudRoom: a room this many steps loud (true: ±10, ~0.08, as
      // loud as a TV) until the first prompt ends, then quiet.
      const open = (a) => a.graph && a.graph.connected && a.graph.stream.track.readyState === 'live';
      const live = (a) => (h.voice || h.talking > 0) && open(a);
      const hiss = (a) => config.hiss !== false && open(a) && !(config.warm && now() < h.firstLive + config.warm);
      const loud = (a) => config.loudRoom && h.promptEnd == null && open(a), L = config.loudRoom === true ? 10 : config.loudRoom, g = config.childGain || 1;
      const a = { fftSize: 512, frequencyBinCount: 256, disconnect() {},
        getByteTimeDomainData(d) { const v = live(a), n = hiss(a), l = loud(a); for (let i = 0; i < d.length; i++) { const p = 2 * Math.PI * 187.5 * i / 48000; d[i] = v ? Math.round(128 + g * (22 * Math.sin(p) + 16 * Math.sin(2 * p) + 12 * Math.sin(3 * p) + 9 * Math.sin(4 * p))) : l ? 128 + ((i & 1) ? L : -L) : n ? 128 - (i & 1) : 128; } },
        getByteFrequencyData(d) { d.fill(0); if (live(a)) for (const k of [2, 4, 6, 8]) d[k] = 230; },
        // The float samples are the same room the bytes carry (a real
        // analyser's two views of one signal): the hiss and the loud room
        // too, not zeros. Zeros here are a mic still starting (25 Sep 2026:
        // a frame with a run of them is not read as the room).
        getFloatTimeDomainData(d) { const v = live(a), n = hiss(a), l = loud(a); for (let i = 0; i < d.length; i++) { let x = 0; if (v) { const p = 2 * Math.PI * 187.5 * i / 48000; for (let k = 1; k <= 24; k++) x += 0.12 / k * Math.sin(k * p); } else if (l) x = ((i & 1) ? L : -L) / 128; else if (n) x = -(i & 1) / 128; d[i] = x; } },
        getFloatFrequencyData(d) { const v = live(a), bin = 24000 / d.length; for (let i = 0; i < d.length; i++) d[i] = v && i * bin < 6000 ? (i % 4 === 0 ? -40 : -70) : -110; } };
      return a;
    }
  }
  window.AudioContext = window.webkitAudioContext = Context;
  class Recorder { constructor(stream) { this.stream = stream; this.state = 'inactive'; this.mimeType = 'audio/webm'; } start() { this.state = 'recording'; } stop() { if (this.state === 'inactive') return; this.state = 'inactive'; later(() => { if (this.ondataavailable) this.ondataavailable({ data: new Blob(['local'], { type: 'audio/webm' }) }); if (this.onstop) this.onstop(); }, 0); } }
  window.MediaRecorder = Recorder;
  // ---- the slow model plays through an <audio> element ----
  window.Audio = class { constructor(src) { this.src = src; this.volume = 1; this.playbackRate = 1; }
    play() { log('media', 'slow model'); h.sounding++; later(() => { h.sounding--; ended(now()); if (this.onended) this.onended(); }, 90); return Promise.resolve(); }
    pause() {} removeAttribute() {} load() {} };
  window.speechSynthesis.speak = (u) => { log('browser voice', u.text); h.sounding++; later(() => { h.sounding--; ended(now()); if (u.onend) u.onend(); }, 60); };
  window.speechSynthesis.cancel = () => {};
  // ---- the voice service: every line gets an id, carried in its PCM ----
  const realFetch = window.fetch.bind(window);
  window.fetch = (url, options) => {
    if (String(url) !== '/api/tts') return realFetch(url, options);
    const id = h.lines.push(JSON.parse(options.body).text), pcm = new Int16Array(2400); pcm[0] = id;
    return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, arrayBuffer: async () => pcm.buffer.slice(0) });
  };
  // ---- Sona: the native recognizer, chimes, confetti and saved work ----
  let sona;
  Object.defineProperty(window, 'Sona', { configurable: true, get: () => sona, set(value) {
    sona = value;
    value.isNativeApp = () => true; value.speechPerm = () => Promise.resolve(true);
    value.speechStart = () => { h.recognizing = true; log('recognizer-start'); return Promise.resolve(true); };
    value.speechStop = () => { h.recognizing = false; return Promise.resolve({ text: h.verify === 'fail' ? 'poopoo' : 'rrrr' }); };
    value.confetti = () => { log('celebration', 'confetti'); };
    for (const key of Object.keys(value.sfx || {})) {
      if (key === 'stop' || typeof value.sfx[key] !== 'function') continue;
      const play = value.sfx[key];
      value.sfx[key] = function (...args) { log('chime', key); h.sfxName = key; try { return play.apply(this, args); } finally { h.sfxName = null; } };
    }
    for (const key of ['saveRecording', 'logAttempt', 'bumpReps']) { const f = value[key]; value[key] = function (...args) { h.effects.push(key); return f.apply(value, args); }; }
  } });
  // ---- what the child is shown: "Your turn", and the lost-mic screen ----
  new MutationObserver(() => {
    const t = document.getElementById('turnStatus'); if (t && t.textContent === 'Your turn' && (!h.turns.length || h.turns[h.turns.length - 1].t < now() - 20)) h.turns.push({ t: now(), live: h.micLive(), sinceOpen: h.lastOpen == null ? -1 : now() - h.lastOpen });
    const q = document.getElementById('quietTitle'); if (q && /grown-up/.test(q.textContent)) h.grownUp = true;
  }).observe(document, { subtree: true, childList: true, characterData: true });

  localStorage.setItem('sona.freeera.v1', 'post'); localStorage.setItem('sona.freeera2.v1', 'done'); localStorage.setItem('sona.freeera3.v1', 'done'); localStorage.setItem('sona.freeera4.v1', 'done'); localStorage.setItem('sona.micok', '1');
  localStorage.setItem('sona.profile.v1', JSON.stringify({ childName: 'Mia', childAge: '7', focusSounds: ['R'], onboarded: true, earlyAdopter: true, voiceOn: true, soundOn: true, volume: 0.5 }));
  const n = config.round || 0;
  sessionStorage.setItem('sona.run.v1', JSON.stringify({ active: true, round: n, scores: Array(n).fill(7), sum: n * 7, sound: 'R', level: 1, pending: false, games: ['slice', 'tiles', 'stack', 'run', 'glide'], tries: n * 5 }));
}

async function fresh(config = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', (route) => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  // The earned game is not under test: it opens as a blank page.
  await context.route(/\/arcade-[a-z]+\.html/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>game</title>' }));
  await context.addInitScript(device, config);
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + '/charge.html?daily=1');
  return { context, page, errors };
}
const yourTurn = (page) => page.waitForFunction(() => document.getElementById('turnStatus').textContent === 'Your turn', {}, { polling: 20 });
const spoken = (page, line) => page.waitForFunction((line) => __quiet.events.some((e) => e.kind === 'voice' && e.label === line), line, { polling: 20 });
async function bursts(page, count) {
  for (let i = 0; i < count; i++) {
    await page.evaluate(() => { __quiet.voice = true; }); await page.waitForTimeout(300);
    await page.evaluate(() => { __quiet.voice = false; }); await page.waitForTimeout(500);
  }
}
const state = (page) => page.evaluate(() => ({ events: __quiet.events, turns: __quiet.turns, effects: __quiet.effects, grownUp: __quiet.grownUp, reps: window.reps, meter: document.querySelectorAll('#reveals .fr:not(.ghost)').length }));
const SOUNDS = ['voice', 'media', 'browser voice', 'chime', 'celebration'];
const WORDS = ['voice', 'media', 'browser voice'];
// What the phone actually plays (confetti is only drawn).
const AUDIBLE = ['voice', 'media', 'browser voice', 'chime'];
// Mirrors micquietgamestest's quietAfterClose: every sound that starts after a
// mic closed, and less than `gap` ms after it — the moment the phone is still
// switching from call audio back to media.
function quietAfterClose(s, gap) {
  const closes = s.events.filter((e) => e.kind === 'mic-close'), bad = [];
  for (const e of s.events) if (AUDIBLE.includes(e.kind)) for (const c of closes) if (e.t >= c.t && e.t - c.t < gap) bad.push({ sound: e.kind, label: e.label, after: +(e.t - c.t).toFixed(1) });
  return bad;
}
// The rules every scenario must keep, whatever it exercised.
// REWRITTEN 24 Sep 2026: the first rule allowed one exception, the chime of a
// counted try inside its guard. That chime is gone; so is the exception.
function audit(name, s) {
  const sounds = s.events.filter((e) => SOUNDS.includes(e.kind));
  const intoMic = sounds.filter((e) => e.micLive);
  ok(name + ': nothing at all plays into a live mic', sounds.length > 0 && intoMic.length === 0, intoMic.length ? intoMic : 'no sounds were logged');
  const settle = quietAfterClose(s, 150);
  const opened = s.events.some((e) => e.kind === 'mic-open'), closed = s.events.some((e) => e.kind === 'mic-close');
  ok(name + ': no sound starts within 150ms of a mic closing', (!opened || closed) && settle.length === 0, settle.length ? settle : 'a mic opened but no close was logged');
  const heard = sounds.filter((e) => WORDS.includes(e.kind) && e.recognizing);
  ok(name + ': no line of Echo\'s starts while the native recognizer is listening', heard.length === 0, heard);
  const early = s.events.filter((e) => e.kind === 'mic-open' && (e.sounding > 0 || e.sinceSound < 240));
  ok(name + ': the mic opens only after Sona has been quiet for a quarter-second', early.length === 0, early);
  const cues = s.turns.filter((t) => !t.live);
  ok(name + ': "Your turn" is only ever shown with the mic open', cues.length === 0, s.turns);
}
const voiceAt = (s, line) => (s.events.find((e) => e.kind === 'voice' && e.label === line) || {}).t;
const lines = (s) => s.events.filter((e) => e.kind === 'voice').map((e) => e.label);
function clean(name, errors) { ok(name + ': no page errors', errors.length === 0, errors); }

await scenario('prompt, five tries and the win', async () => {
  const { context, page, errors } = await fresh();
  try {
    await yourTurn(page); await bursts(page, 5);
    await spoken(page, "You did it. Let's play."); await page.waitForTimeout(120);
    const s = await state(page);
    audit('prompt and win', s);
    // 24 Sep 2026: no spoken "Your turn." — the glowing mic hands the turn over.
    ok('the prompt is calm: the cue, the sound and the count, no "Go!", no spoken "Your turn."', lines(s)[0] === 'Ready? Pull your tongue back and up, and make your R sound, five times.', lines(s));
    const firstOpen = s.events.find((e) => e.kind === 'mic-open'), prompt = s.events.find((e) => e.kind === 'voice');
    ok('the explainer-tap permission request still happens before Echo speaks', !!firstOpen && firstOpen.t < prompt.t && !prompt.micLive, { firstOpen, prompt });
    const firstClose = s.events.find((e) => e.kind === 'mic-close');
    ok('…and that mic stays open ~300ms to measure the room before Echo speaks', !!firstClose && firstClose.t - firstOpen.t >= 280 && firstClose.t < prompt.t, { firstOpen, firstClose, prompt });
    // REWRITTEN 24 Sep 2026: this waited ≥240ms after every window opened (the
    // room was measured there). The room is known from the page's first mic
    // now, so the window can hear — and says so — from the moment it opens.
    ok('"Your turn" appears as soon as the window opens: the room is already known', s.turns.length > 0 && s.turns[0].sinceOpen < 150, s.turns);
    const chimes = s.events.filter((e) => e.kind === 'chime' && e.t < (s.events.find((x) => x.kind === 'chime' && x.label === 'complete') || { t: Infinity }).t);
    ok('five counted tries fill the meter with no chime at all: seen, not heard', s.reps === 5 && s.meter === 5 && chimes.length === 0, { reps: s.reps, meter: s.meter, chimes });
    const complete = s.events.find((e) => e.kind === 'chime' && e.label === 'complete'), win = voiceAt(s, "You did it. Let's play.");
    ok('the win line waits ~600ms after the chime instead of landing on it', !!complete && win - complete.t >= 550, { chime: complete && complete.t, win });
    ok('closing the mic at the end of the window keeps the one keepsake clip whole', s.effects.includes('saveRecording'), s.effects);
    clean('prompt and win', errors);
  } finally { await context.close(); }
});

await scenario('wrong sound: coaching, the easier word and the round end', async () => {
  const { context, page, errors } = await fresh({ round: 1, verify: 'fail' });
  try {
    await yourTurn(page); await bursts(page, 5);
    await spoken(page, "Let's try that one again. Pull your tongue back and up like a tiger growl.");
    await yourTurn(page); await bursts(page, 3);
    await spoken(page, "I have an idea. Let's try this one. Make your R sound.");
    await yourTurn(page); await bursts(page, 3);
    await spoken(page, "Good practicing. Let's play."); await page.waitForTimeout(120);
    const s = await state(page);
    audit('coaching', s);
    ok('the syllable prompt is calm too', /^Ready\? Say [a-z]+, five times\.$/.test(lines(s)[0]), lines(s));
    ok('no coaching line shouts: every one ends in a full stop', lines(s).length === 4 && lines(s).every((l) => /\.$/.test(l) && !/!/.test(l)), lines(s));
    ok('each retry opened a fresh mic after the coaching line', s.events.filter((e) => e.kind === 'mic-open').length === 4, s.events.filter((e) => e.kind === 'mic-open'));
    clean('coaching', errors);
  } finally { await context.close(); }
});

await scenario('tap Echo, the turtle and an unprompted prompt mid-window', async () => {
  const { context, page, errors } = await fresh();
  try {
    await yourTurn(page); await bursts(page, 2);
    const repeat = 'Ready? Make your R sound, five times.';
    await page.locator('#echoBuddy').click(); await spoken(page, repeat);
    await yourTurn(page);
    const mid = await state(page);
    ok('a tap on Echo keeps the tries already heard', mid.meter === 2 && mid.reps === 2, mid);
    await page.locator('#turtleBtn').click(); await page.waitForFunction(() => __quiet.events.some((e) => e.kind === 'media'));
    await yourTurn(page);
    // The idle nudge's own call (armIdle → playPrompt) made mid-window. The
    // nudge is not armed today; this pins the path it would take.
    await page.evaluate(() => { playPrompt(); }); await page.waitForFunction((line) => __quiet.events.filter((e) => e.kind === 'voice' && e.label === line).length === 2, repeat);
    await yourTurn(page); await bursts(page, 3);
    await spoken(page, "You did it. Let's play."); await page.waitForTimeout(120);
    const s = await state(page);
    audit('mid-window replays', s);
    ok('five tries across four windows count once each and earn the game', s.reps === 5 && await page.evaluate(() => JSON.parse(sessionStorage.getItem('sona.run.v1')).pending === true), { reps: s.reps });
    ok('each replay closed the window and a fresh mic reopened after it', s.events.filter((e) => e.kind === 'mic-open').length === 5, s.events.filter((e) => e.kind === 'mic-open'));
    ok('…with the native recognizer restarted in every window', s.events.filter((e) => e.kind === 'recognizer-start').length === 4, s.events.filter((e) => e.kind === 'recognizer-start'));
    ok('…and never through the lost-microphone screen', !s.grownUp);
    ok('an attempt Echo talked through after a try keeps no stitched clip', !s.effects.includes('saveRecording'), s.effects);
    clean('mid-window replays', errors);
  } finally { await context.close(); }
});

// EAGER CHILD (24 Sep 2026). With the voice on, the mic is closed while Echo
// speaks and opens a quarter-second after he stops, plus however long the
// phone takes (300ms here). A child who answers straight away is already
// talking when it opens. The window used to spend its first quarter-second
// measuring "the room" — the child's own voice — set the bar three times
// above it, and none of their tries counted (20s later: "I couldn't hear
// you!"). The room is measured once now, on the first mic before Echo
// speaks, and a window's own reading can only lower it.
for (const onset of [300, 500, 700]) await scenario('eager child answering ' + onset + 'ms after the prompt', async () => {
  const { context, page, errors } = await fresh({ micDelay: 300, child: { onset, hold: 700, more: 4 } });
  try {
    const won = await page.waitForFunction(() => __quiet.events.some((e) => e.kind === 'voice' && e.label === "You did it. Let's play."), {}, { polling: 20, timeout: 9000 }).then(() => true, () => false);
    await page.waitForTimeout(120);
    const s = await state(page), promptEnd = await page.evaluate(() => __quiet.promptEnd);
    const windowOpen = (s.events.filter((e) => e.kind === 'mic-open')[1] || {}).liveAt;
    ok('eager child (' + onset + 'ms): was already talking when the window opened', onset < 700 ? windowOpen - promptEnd > onset : true, { promptEnd, windowOpen });
    ok('eager child (' + onset + 'ms): all five tries count and win the game', won && s.reps === 5, { won, reps: s.reps, lines: lines(s) });
    ok('eager child (' + onset + 'ms): never sent to "I couldn\'t hear you!"', !lines(s).some((l) => /couldn't hear/.test(l)), lines(s));
    audit('eager child ' + onset, s);
    clean('eager child ' + onset, errors);
  } finally { await context.close(); }
});

// A mic that delivers pure digital zeros (still starting up) gives the page no
// room reading. Then — and only then — a window measures its own first
// quarter-second, as every window used to, and the cue waits for it.
await scenario('no room reading: the window measures itself', async () => {
  const { context, page, errors } = await fresh({ hiss: false });
  try {
    await yourTurn(page); await bursts(page, 5);
    await spoken(page, "You did it. Let's play."); await page.waitForTimeout(120);
    const s = await state(page);
    audit('no room reading', s);
    ok('with no room reading, "Your turn" waits for the window\'s own quarter-second', s.turns.length > 0 && s.turns[0].sinceOpen >= 240, s.turns);
    ok('…and the five tries still count', s.reps === 5, { reps: s.reps });
    clean('no room reading', errors);
  } finally { await context.close(); }
});

// A MIC THAT STARTS IN DIGITAL ZEROS (24 Sep 2026, after review). A phone's
// mic can send exact zeros for a moment as it starts. The room reading's
// 300ms clock used to start anyway, so 250ms of zeros left it too few real
// frames and 400ms none: no reading, the first window measured the eager
// child's voice as "the room", and none of their tries counted. The clock
// now starts at the first frame that is not zeros.
for (const warm of [250, 400]) for (const onset of [300, 500]) await scenario('mic starting in ' + warm + 'ms of zeros, child answering ' + onset + 'ms after the prompt', async () => {
  const { context, page, errors } = await fresh({ micDelay: 300, warm, child: { onset, hold: 700, more: 4 } });
  try {
    const won = await page.waitForFunction(() => __quiet.events.some((e) => e.kind === 'voice' && e.label === "You did it. Let's play."), {}, { polling: 20, timeout: 9000 }).then(() => true, () => false);
    await page.waitForTimeout(120);
    const s = await state(page);
    ok(warm + 'ms of zeros, child at ' + onset + 'ms: all five tries count and win the game', won && s.reps === 5, { won, reps: s.reps, lines: lines(s) });
    ok(warm + 'ms of zeros, child at ' + onset + 'ms: the room is the mic\'s hiss, measured after the zeros', await page.evaluate(() => !!room && room.rms > 0 && room.rms < 0.01), await page.evaluate(() => room && room.rms));
    audit('zeros ' + warm + ', child ' + onset, s);
    clean('zeros ' + warm + ', child ' + onset, errors);
  } finally { await context.close(); }
});

// A CHILD WHO SAYS IT DURING THE READING (24 Sep 2026, after review): a 1s
// "rrrr" the moment the grown-up taps, before Echo has said anything, then
// an answer straight after the prompt. The reading used to be their voice
// (~0.17), the bar went three times above it, and nothing they said after
// counted. A reading louder than any room (ROOM_MAX) is a voice now: it is
// not the room, the bar never goes over 3 x ROOM_MAX, and the window that
// opens on the answer learns the room in the child's first pause.
for (const onset of [300, 500]) await scenario('child says it during the reading, then answers ' + onset + 'ms after the prompt', async () => {
  const { context, page, errors } = await fresh({ micDelay: 300, pre: { hold: 1000 }, child: { onset, hold: 700, more: 4 } });
  try {
    await page.waitForFunction(() => __quiet.promptEnd != null, {}, { polling: 20, timeout: 6000 });
    // (typeof: an older page, SONATEST_PUBLIC_ROOT, has no ceiling at all)
    const read = await page.evaluate(() => ({ room: room && room.rms, cap: typeof roomBar === 'function' ? roomBar(1) : Infinity, max: typeof ROOM_MAX === 'number' ? ROOM_MAX : Infinity }));
    const won = await page.waitForFunction(() => __quiet.events.some((e) => e.kind === 'voice' && e.label === "You did it. Let's play."), {}, { polling: 20, timeout: 9000 }).then(() => true, () => false);
    await page.waitForTimeout(120);
    const s = await state(page);
    ok('reading was a voice (' + onset + 'ms): it is not taken for the room, and the bar can never pass ' + read.cap, read.room == null && read.cap <= 0.09 && read.max <= 0.03, read);
    ok('reading was a voice (' + onset + 'ms): all five tries count and win the game', won && s.reps === 5, { won, reps: s.reps, lines: lines(s) });
    ok('reading was a voice (' + onset + 'ms): never sent to "I couldn\'t hear you!"', !lines(s).some((l) => /couldn't hear/.test(l)), lines(s));
    audit('voice in the reading ' + onset, s);
    clean('voice in the reading ' + onset, errors);
  } finally { await context.close(); }
});

// ...and a window's reading may LOWER the room.
// REWRITTEN 24 Sep 2026 (after review). This used a room as loud as a TV
// (±10 steps, ~0.08) during the reading. That is louder than any room now
// (ROOM_MAX), so it is no longer taken for one: pinned as such below. Here
// the room is loud but real (±3 steps, ~0.023: a bar of ~0.07) and quiet by
// the child's turn, and the child is soft (~0.05, under that bar) — and
// already talking for most of the window's first quarter-second. The window
// used to lower the room only when its MEDIAN was quieter than it, which
// this child's window never is; now its quiet end (20th percentile) does,
// so the bar comes down to the room they are really in, and they are heard.
await scenario('a room that got quieter, and a soft child already talking: the window lowers the bar', async () => {
  const { context, page, errors } = await fresh({ loudRoom: 3, childGain: 0.3, atWindow: { hold: 170, more: 5 } });
  try {
    await page.waitForFunction(() => __quiet.promptEnd != null, {}, { polling: 20, timeout: 6000 });
    const bar = await page.evaluate(() => room && Math.max(0.035, room.rms * 3));
    const won = await page.waitForFunction(() => __quiet.events.some((e) => e.kind === 'voice' && e.label === "You did it. Let's play."), {}, { polling: 20, timeout: 9000 }).then(() => true, () => false);
    await page.waitForTimeout(120);
    const s = await state(page), after = await page.evaluate(() => room && room.rms);
    ok('the page measured the loud (but real) room first: a bar above this soft child\'s voice', bar > 0.06, { bar });
    ok('the window lowered it though the child talked through most of its first quarter-second, and all five tries count', won && s.reps === 5 && after < 0.01, { won, reps: s.reps, bar, after });
    audit('room got quieter', s);
    clean('room got quieter', errors);
  } finally { await context.close(); }
});
await scenario('a room as loud as a TV during the reading is not a room', async () => {
  const { context, page, errors } = await fresh({ loudRoom: true });
  try {
    await page.waitForFunction(() => __quiet.promptEnd != null, {}, { polling: 20, timeout: 6000 });
    const read = await page.evaluate(() => room && room.rms);
    await yourTurn(page); await page.waitForTimeout(300); await bursts(page, 5);
    const won = await page.waitForFunction(() => __quiet.events.some((e) => e.kind === 'voice' && e.label === "You did it. Let's play."), {}, { polling: 20, timeout: 6000 }).then(() => true, () => false);
    await page.waitForTimeout(120);
    const s = await state(page), after = await page.evaluate(() => room && room.rms);
    ok('a ~0.08 reading (over ROOM_MAX) is not adopted as the room', read == null, { read });
    ok('…the quiet window measures the room itself, and all five tries count', won && s.reps === 5 && after > 0 && after < 0.01, { won, reps: s.reps, after });
    audit('loud reading', s);
    clean('loud reading', errors);
  } finally { await context.close(); }
});

await scenario('the quiet screen', async () => {
  const { context, page, errors } = await fresh();
  try {
    await yourTurn(page); await page.waitForTimeout(300);
    await page.evaluate(() => engineAttempt.segment.finish('done'));
    const line = "I couldn't hear you! Say it big — I'm all ears!";
    await spoken(page, line); await page.waitForTimeout(120);
    const s = await state(page);
    audit('quiet screen', s);
    ok('the quiet screen keeps Rachel\'s line word for word', lines(s)[1] === line && await page.locator('#quietOvl.show').count() === 1, lines(s));
    ok('silence is never a try', s.reps === 0 && !s.effects.includes('logAttempt') && !s.effects.includes('bumpReps'), s);
    clean('quiet screen', errors);
  } finally { await context.close(); }
});

await scenario('the finish and the chest', async () => {
  const { context, page, errors } = await fresh({ round: 5 });
  try {
    await spoken(page, 'We finished the whole adventure.');
    await page.locator('#runChest').click(); await page.locator('#chestOvl.show').waitFor();
    // The chest wobbles (never "stable" to a pointer); tap it as the page does.
    for (let i = 0; i < 3; i++) await page.locator('#chestBox').evaluate((el) => el.click());
    await spoken(page, 'Look what we found.'); await page.waitForTimeout(120);
    const s = await state(page);
    audit('finish and chest', s);
    ok('no mic is opened on the finish or the chest', !s.events.some((e) => e.kind === 'mic-open'));
    const chimes = s.events.filter((e) => e.kind === 'chime');
    const finishChime = chimes.find((e) => e.label === 'complete'), lastTap = chimes.filter((e) => e.label === 'tap').pop();
    ok('the finish line waits ~600ms after its chime', !!finishChime && voiceAt(s, 'We finished the whole adventure.') - finishChime.t >= 550, chimes);
    ok('the chest line waits ~600ms after the last tap\'s chime', !!lastTap && voiceAt(s, 'Look what we found.') - lastTap.t >= 550, chimes);
    clean('finish and chest', errors);
  } finally { await context.close(); }
});

await browser.close(); await new Promise((resolve) => server.close(resolve));
console.log(failures ? failures + ' FAILURES / ' + assertions + ' assertions' : 'ALL GREEN — ' + assertions + ' assertions');
process.exit(failures ? 1 : 0);
