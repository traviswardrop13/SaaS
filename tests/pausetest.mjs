// PAUSE1: interruptions suspend one practice flow, release device resources,
// and require an explicit Resume without losing or duplicating earned work.
// All input is a fake local stream/analyser. No mic permission or OS audio.
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import path from 'path';
import { chromium, ROOT, launchOpts } from './_env.mjs';

const publicRoot = process.env.SONATEST_PUBLIC_ROOT || ROOT;
const origin = 'http://127.0.0.1:8194';
const mime = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp', woff2: 'font/woff2' };
const server = createServer((req, res) => {
  const u = new URL(req.url, origin);
  if (u.pathname.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); return; }
  const file = path.join(publicRoot, u.pathname);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': mime[file.split('.').pop()] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(8194, '127.0.0.1', resolve));
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, detail = '') {
  assertions++; if (!pass) failures++;
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : ' → ' + (typeof detail === 'string' ? detail : JSON.stringify(detail))));
}
async function scenario(name, fn) {
  if (process.env.PAUSE_ONLY === 'tail' && !name.startsWith('tail:')) return;
  try { await fn(); } catch (error) { ok(name + ' completes without a harness/page exception', false, error.stack); }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Home legitimately mints existing practice coins; it must not change completed work.
function samePractice(a, b) {
  const strip = (value) => { const x = JSON.parse(JSON.stringify(value)); delete x.coins; delete x.progress.totals.coins; return x; };
  return same(strip(a), strip(b)) && b.coins >= a.coins;
}
const games = ['slice', 'tiles', 'stack', 'run', 'glide'];

// Instrument only browser/device edges. Production state transitions and
// timers execute normally, except selected long timers can be delivered on
// demand to prove a callback from an old listening phase cannot escape.
function fakeDevice(config) {
  const h = window.__pauseHarness = {
    hidden: !!config.hidden, micMode: config.mic || 'auto', verifyMode: config.verify || 'pass',
    nativeStartMode: config.nativeStart || 'auto', nativeStarts: 0, nativeStops: 0, nativeWaiters: [],
    voice: false, streams: [], requests: [], graphs: [], recorders: [], speechWaiters: [],
    effects: [], mediaPlays: 0, speechPlays: 0, holdTimers: true, timers: [],
  };
  const nativeSetTimeout = window.setTimeout.bind(window), nativeClearTimeout = window.clearTimeout.bind(window);
  let timerSeq = 1;
  window.setTimeout = function (fn, delay, ...args) {
    const t = { id: timerSeq++, delay: Number(delay) || 0, active: true, nativeId: null, held: h.holdTimers && ((Number(delay) >= 1199 && Number(delay) <= 1201) || Number(delay) >= 7900) };
    t.fire = () => { if (!t.active) return; t.active = false; if (t.nativeId != null) nativeClearTimeout(t.nativeId); if (typeof fn === 'function') fn(...args); };
    h.timers.push(t);
    if (!t.held) t.nativeId = nativeSetTimeout(t.fire, t.delay);
    return t.id;
  };
  window.clearTimeout = function (id) {
    const t = h.timers.find((item) => item.id === id);
    if (t) { t.active = false; if (t.nativeId != null) nativeClearTimeout(t.nativeId); }
    else nativeClearTimeout(id);
  };
  h.flushHeld = (delay) => h.timers.filter((t) => t.active && t.held && (delay == null || Math.abs(t.delay - delay) <= 1)).forEach((t) => t.fire());
  h.releaseHeld = () => { h.holdTimers = false; h.timers.filter((t) => t.active && t.held).forEach((t) => { t.held = false; t.nativeId = nativeSetTimeout(t.fire, t.delay); }); };
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h.hidden });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h.hidden ? 'hidden' : 'visible' });
  h.background = (event = 'visibilitychange') => {
    h.hidden = true;
    if (event === 'pagehide') window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    else document.dispatchEvent(new Event('visibilitychange'));
  };
  h.foreground = (event = 'visibilitychange') => {
    h.hidden = false;
    if (event === 'pageshow') window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    else document.dispatchEvent(new Event('visibilitychange'));
  };
  function stream() {
    const track = { readyState: 'live', muted: false, stopCalls: 0, stop() { this.readyState = 'ended'; this.stopCalls++; } };
    const result = { track, getTracks: () => [track], getAudioTracks: () => [track] };
    h.streams.push(result); return result;
  }
  navigator.mediaDevices.getUserMedia = () => new Promise((resolve, reject) => {
    const request = { settled: false, grant() { if (this.settled) return; this.settled = true; resolve(stream()); }, deny() { if (this.settled) return; this.settled = true; reject(new DOMException('Permission denied', 'NotAllowedError')); } };
    h.requests.push(request);
    if (h.micMode === 'auto') request.grant();
    else if (h.micMode === 'deny') request.deny();
  });
  h.grantPending = () => h.requests.filter((r) => !r.settled).forEach((r) => r.grant());
  function param() { return { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }; }
  function audioNode() { return { gain: param(), frequency: param(), connect() {}, disconnect() {}, start() {}, stop() {} }; }
  function FakeAudioContext() { this.state = 'running'; this.sampleRate = 48000; this.currentTime = 0; this.destination = {}; }
  FakeAudioContext.prototype.resume = function () { this.state = 'running'; return Promise.resolve(); };
  FakeAudioContext.prototype.suspend = function () { this.state = 'suspended'; return Promise.resolve(); };
  FakeAudioContext.prototype.close = function () { this.state = 'closed'; return Promise.resolve(); };
  FakeAudioContext.prototype.createGain = audioNode;
  FakeAudioContext.prototype.createOscillator = audioNode;
  FakeAudioContext.prototype.createBufferSource = audioNode;
  FakeAudioContext.prototype.createBuffer = function (channels, n) { return { getChannelData: () => new Float32Array(n) }; };
  FakeAudioContext.prototype.createMediaStreamSource = function (input) {
    const graph = { stream: input, connected: false, connect(analyser) { this.connected = true; analyser.graph = this; }, disconnect() { this.connected = false; } };
    h.graphs.push(graph); return graph;
  };
  FakeAudioContext.prototype.createAnalyser = function () {
    return {
      fftSize: 512, frequencyBinCount: 256,
      // A sustained harmonic waveform represents voiced input. A constant DC
      // level must not bypass the production non-speech rejection.
      getByteTimeDomainData(data) {
        const live = h.voice && (h.voiceFrames == null || h.voiceFrames-- > 0) && this.graph && this.graph.connected && this.graph.stream.track.readyState === 'live';
        for (let i = 0; i < data.length; i++) {
          const phase = 2 * Math.PI * 187.5 * i / 48000;
          data[i] = live ? Math.round(128 + 22*Math.sin(phase) + 16*Math.sin(2*phase) + 12*Math.sin(3*phase) + 9*Math.sin(4*phase)) : 128;
        }
      },
      getByteFrequencyData(data) { data.fill(0); if (h.voice) for (const bin of [2,4,6,8]) data[bin] = 230; },
      // The engine's speech-evidence read (REPGUARD1) uses these. Four narrow
      // lines are rightly not a voice, so the float reads carry what one is:
      // the same 187.5Hz pitch with harmonics spread across the speech band.
      getFloatTimeDomainData(data) {
        const live = h.voice && this.graph && this.graph.connected && this.graph.stream.track.readyState === 'live';
        for (let i = 0; i < data.length; i++) {
          let v = 0;
          if (live) { const phase = 2 * Math.PI * 187.5 * i / 48000; for (let k = 1; k <= 24; k++) v += 0.12 / k * Math.sin(k * phase); }
          data[i] = v;
        }
      },
      getFloatFrequencyData(data) {
        const live = h.voice && this.graph && this.graph.connected && this.graph.stream.track.readyState === 'live';
        const binHz = 24000 / data.length;
        for (let i = 0; i < data.length; i++) data[i] = live && i * binHz < 6000 ? (i % 4 === 0 ? -40 : -70) : -110;
      },
      disconnect() {},
    };
  };
  window.AudioContext = window.webkitAudioContext = FakeAudioContext;
  function FakeRecorder(input) { this.stream = input; this.state = 'inactive'; this.mimeType = 'audio/webm'; h.recorders.push(this); }
  FakeRecorder.prototype.start = function () { this.state = 'recording'; };
  FakeRecorder.prototype.stop = function () {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    nativeSetTimeout(() => {
      if (this.ondataavailable) this.ondataavailable({ data: new Blob(['fake local sample'], { type: this.mimeType }) });
      if (this.onstop) this.onstop();
    }, 0);
  };
  window.MediaRecorder = FakeRecorder;
  HTMLMediaElement.prototype.play = function () { h.mediaPlays++; return Promise.resolve(); };
  if (window.speechSynthesis) {
    window.speechSynthesis.speak = (utterance) => { h.speechPlays++; nativeSetTimeout(() => { if (utterance.onend) utterance.onend(); }, 0); };
    window.speechSynthesis.cancel = () => {};
  }
  // Hold recognizer and feedback responses independently from the detector.
  let sona;
  Object.defineProperty(window, 'Sona', { configurable: true, get: () => sona, set(value) {
    sona = value;
    value.speechStart = () => {
      h.nativeStarts++;
      return h.nativeStartMode === 'pending' ? new Promise((resolve) => h.nativeWaiters.push(resolve)) : Promise.resolve(true);
    };
    value.speechStop = () => {
      h.nativeStops++;
      if (h.verifyMode === 'deferred') return new Promise((resolve) => h.speechWaiters.push(resolve));
      return Promise.resolve({ text: h.verifyMode === 'unknown' ? '' : h.verifyMode === 'fail' ? 'poopoo' : 'rrrr' });
    };
    value.saveRecording = () => { h.effects.push('saveRecording'); return Promise.resolve(); };
    value.confetti = () => {};
    for (const key of ['bumpReps', 'logAttempt', 'rotAdvance', 'recordRung', 'awardNextSticker', 'addCoins', 'recordSession', 'dailyFinish']) {
      const original = value[key];
      value[key] = function (...args) { h.effects.push(key); return original.apply(value, args); };
    }
  } });
  h.resolveNativeStart = () => h.nativeWaiters.splice(0).forEach((resolve) => resolve(true));
  h.resolveSpeech = () => { const pending = h.speechWaiters.splice(0); pending.forEach((resolve) => resolve({ text: 'rrrr' })); };

  if (!localStorage.getItem('sona.test.pauseSeed')) {
    localStorage.setItem('sona.test.pauseSeed', '1');
    localStorage.setItem('sona.freeera.v1', 'post'); localStorage.setItem('sona.freeera2.v1', 'done'); localStorage.setItem('sona.freeera3.v1', 'done'); localStorage.setItem('sona.freeera4.v1', 'done');
    if (!config.firstMic) localStorage.setItem('sona.micok', '1');
    if (config.replay) localStorage.setItem('sona.demo.v1', JSON.stringify({started:Date.now()-1000,done:Date.now()}));
    localStorage.setItem('sona.profile.v1', JSON.stringify({ childName: 'Mia', childAge: '7', focusSounds: ['R'], onboarded: true, earlyAdopter: true, voiceOn: false, soundOn: false, volume: 0 }));
    const d = new Date(), day = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
    const n = config.round || 0;
    localStorage.setItem('sona.today.v1', JSON.stringify({ d: day, n }));
    localStorage.setItem('sona.reps.v1', JSON.stringify({ d: day, n: n * 5 }));
    localStorage.setItem('sona.rotation.v1', JSON.stringify({ i: 0, r: n }));
    localStorage.setItem('sona.progress.v1', JSON.stringify({ sessions: [], totals: { sessions: 0, words: 0, stars: 0, coins: 0, rounds: n }, streak: { count: 0, lastDate: '' }, bySound: {}, stage: {}, chests: {}, missed: [] }));
    sessionStorage.setItem('sona.run.v1', JSON.stringify({ active: true, round: n, scores: Array(n).fill(7), sum: n * 7, sound: 'R', level: 1, pending: !!config.pending, demo: !!config.replay, games: config.games, tries: n * 5, ready: config.legacyChest ? { round:n, chest:{ taps:2, opened:false, sticker:null } } : null }));
  }
}

async function fresh(config = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', (route) => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  await context.addInitScript(fakeDevice, { ...config, games });
  const page = await context.newPage(); page.setDefaultTimeout(5000); page.setDefaultNavigationTimeout(5000);
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin + '/charge.html?daily=1' + (config.replay ? '&demo=1' : ''));
  if (config.feedback) await page.evaluate(() => {
    const original = window.say;
    window.say = function (text) {
      if (/different sound/.test(text)) return new Promise((resolve) => { __pauseHarness.feedbackResolve = resolve; });
      return original(text);
    };
  });
  return { context, page, errors };
}
async function click(page, id) { await page.locator(id).evaluate((el) => el.click()); }
async function listening(page) {
  await page.waitForFunction(() => window.__pauseHarness.graphs.some((g) => g.connected && g.stream.track.readyState === 'live'), { }, { polling: 30 });
  await page.waitForTimeout(310); // silent calibration before any fake voiced burst
}
async function bursts(page, count) {
  for (let i = 0; i < count; i++) {
    await page.evaluate(() => { __pauseHarness.voice = true; });
    await page.waitForTimeout(270);
    await page.evaluate(() => { __pauseHarness.voice = false; });
    await page.waitForTimeout(220);
  }
}
async function pause(page, event = 'visibilitychange') {
  await page.evaluate((event) => __pauseHarness.background(event), event);
  await page.waitForTimeout(40);
  const visible = await page.locator('#pauseOvl').isVisible().catch(() => false);
  ok(event + ' presents Practice paused', visible);
  return visible;
}
async function resume(page, event = 'visibilitychange') {
  await page.evaluate((event) => __pauseHarness.foreground(event), event);
  await page.waitForTimeout(30);
  ok('foreground waits for explicit Resume', await page.locator('#pauseOvl').isVisible());
  await click(page, '#pauseResume');
}
async function focusStaysInPause(page, underlying) {
  const state = await page.evaluate((id) => ({
    focus: document.activeElement.id,
    inert: document.getElementById(id).inert,
    hidden: getComputedStyle(document.getElementById(id)).visibility === 'hidden',
  }), underlying);
  ok('pause hides and inerts the underlying ' + underlying, state.inert && state.hidden, state);
  ok('pause puts keyboard focus on Resume', state.focus === 'pauseResume', state);
  await page.keyboard.press('Shift+Tab');
  ok('pause wraps backward to Home', await page.evaluate(() => document.activeElement.id === 'pauseHome'));
  await page.keyboard.press('Tab');
  ok('pause wraps forward to Resume', await page.evaluate(() => document.activeElement.id === 'pauseResume'));
}
async function resources(page) {
  return page.evaluate(() => ({
    requests: __pauseHarness.requests.length,
    live: __pauseHarness.streams.filter((s) => s.track.readyState === 'live').length,
    graphs: __pauseHarness.graphs.filter((g) => g.connected).length,
    recording: __pauseHarness.recorders.filter((r) => r.state === 'recording').length,
    effects: __pauseHarness.effects.slice(),
    meter: document.querySelectorAll('#reveals .fr:not(.ghost), #reveals .blk:not(.glass), #reveals .slab:not(.glass), #reveals .key.on').length,
    target: document.getElementById('bTarget')?.textContent || '',
    audio: __pauseHarness.mediaPlays + __pauseHarness.speechPlays,
  }));
}
async function earned(page) {
  return page.evaluate(() => {
    const r = JSON.parse(sessionStorage.getItem('sona.run.v1'));
    return { progress: Sona.getProgress(), reps: Sona.repsToday(), ring: Sona.todayRing(), outcomes: Sona.outcomes(), coins: Sona.getCoins(), run: { round: r.round, scores: r.scores, sum: r.sum, pending: r.pending }, daily: Sona.dailyInfo() };
  });
}
async function settledGame(page) {
  await page.waitForFunction(() => JSON.parse(sessionStorage.getItem('sona.run.v1')).pending, {}, { polling: 30 });
}
async function finalChest(page, practice = true) {
  if (practice) { await listening(page); await bursts(page, 5); }
  await settledGame(page);
  ok('the final earned game launches before its chest', !(await page.locator('#chestOvl').isVisible()));
  await page.evaluate(() => __pauseHarness.flushHeld(1200));
  await page.waitForURL('**/arcade-glide.html?**');
  // The game-return contract banks a pending, legitimately earned fifth game.
  await page.goto(origin + '/charge.html?daily=1&banked=9');
  await page.locator('#runOvl.show').waitFor();
  ok('all five games are banked before the final surprise', await page.evaluate(() => JSON.parse(sessionStorage.getItem('sona.run.v1')).round === 5));
  await click(page, '#runChest'); await page.locator('#chestOvl.show').waitFor();
}
function clean(name, errors) { ok(name + ' has no page errors', errors.length === 0, errors); }

await scenario('hidden before automatic boot', async () => {
  const { context, page, errors } = await fresh({ hidden: true });
  try {
    await page.waitForTimeout(420);
    const before = await resources(page);
    ok('hidden before boot requests no microphone', before.requests === 0, before);
    ok('hidden before boot opens no audio or detector', before.graphs === 0 && before.audio === 0, before);
    const exists = await page.locator('#pauseOvl').count();
    ok('paused dialog exists for hidden startup', exists === 1);
    if (!exists) return;
    await resume(page); await listening(page);
    const after = await resources(page);
    ok('Resume starts one fresh listener after hidden startup', after.requests === 1 && after.live === 1 && after.graphs === 1, after);
    ok('paused dialog is labelled and offers Home', (await page.locator('#pauseOvl').getAttribute('aria-labelledby')) === 'pauseTitle' && (await page.locator('#pauseHome').innerText()).trim() === 'Home');
    clean('hidden startup', errors);
  } finally { await context.close(); }
});

await scenario('the first microphone primer stays behind pause', async () => {
  const { context, page, errors } = await fresh({ firstMic: true });
  try {
    await page.locator('#micPrime.show').waitFor();
    await page.locator('#micPrimeBtn').focus();
    const visible = await pause(page);
    if (!visible) return;
    await focusStaysInPause(page, 'micPrime');
    await click(page, '#micPrimeBtn');
    ok('a queued underlying primer tap requests no microphone', (await resources(page)).requests === 0);
    await resume(page);
    ok('Resume restores primer visibility and its original inert state', await page.locator('#micPrime').isVisible() && await page.locator('#micPrime').evaluate((el) => !el.inert));
    ok('Resume restores focus to the primer control', await page.evaluate(() => document.activeElement.id === 'micPrimeBtn'));
    await click(page, '#micPrimeBtn'); await listening(page);
    ok('the original primer continues with exactly one microphone request', (await resources(page)).requests === 1);
    clean('paused microphone primer', errors);
  } finally { await context.close(); }
});

await scenario('permission completes after backgrounding', async () => {
  const { context, page, errors } = await fresh({ mic: 'pending' });
  try {
    await page.waitForFunction(() => __pauseHarness.requests.length === 1, {}, { polling: 30 });
    const before = await earned(page), visible = await pause(page);
    await page.evaluate(() => __pauseHarness.grantPending());
    await page.waitForTimeout(80);
    const hidden = await resources(page);
    ok('a late microphone grant is immediately stopped', hidden.live === 0 && hidden.graphs === 0, hidden);
    ok('late grant changes no earned progress', same(before, await earned(page)));
    if (!visible) return;
    await page.evaluate(() => { __pauseHarness.micMode = 'auto'; });
    await resume(page); await listening(page);
    const after = await resources(page);
    ok('Resume reacquires instead of reusing the late grant', after.requests === 2 && after.live === 1 && after.graphs === 1, after);
    clean('late microphone grant', errors);
  } finally { await context.close(); }
});

await scenario('late native recognition startup is closed before a fresh segment', async () => {
  const { context, page, errors } = await fresh({ nativeStart: 'pending' });
  try {
    await listening(page);
    const before = await earned(page), visible = await pause(page);
    if (!visible) return;
    await resume(page); await page.waitForTimeout(60);
    ok('Resume waits for the old native startup to settle', await page.evaluate(() => __pauseHarness.nativeStarts === 1 && !__pauseHarness.graphs.some((g) => g.connected)));
    await page.evaluate(() => { __pauseHarness.nativeStartMode = 'auto'; __pauseHarness.resolveNativeStart(); });
    await listening(page);
    const native = await page.evaluate(() => ({ starts: __pauseHarness.nativeStarts, stops: __pauseHarness.nativeStops }));
    ok('a late native start is stopped before one fresh listener begins', native.starts === 2 && native.stops === 2, native);
    ok('native startup races invent no practice progress', same(before, await earned(page)));
    clean('late native recognition startup', errors);
  } finally { await context.close(); }
});

await scenario('partial practice survives repeated pause and resume', async () => {
  const { context, page, errors } = await fresh({ round: 2 });
  try {
    await listening(page); await bursts(page, 2);
    const before = await earned(page), partial = await resources(page);
    ok('fixture has two visible, unfinished repetitions', partial.meter === 2, partial);
    for (let cycle = 1; cycle <= 3; cycle++) {
      const visible = await pause(page, cycle === 2 ? 'pagehide' : 'visibilitychange');
      const hidden = await resources(page);
      ok('pause ' + cycle + ' stops stream, recorder and graph', hidden.live === 0 && hidden.recording === 0 && hidden.graphs === 0, hidden);
      ok('pause ' + cycle + ' preserves completed rounds and rewards', same(before, await earned(page)));
      if (!visible) return;
      await page.evaluate(() => __pauseHarness.flushHeld()); await page.waitForTimeout(cycle === 1 ? 500 : 30);
      ok('old timers cannot navigate or award while paused', page.url().includes('/charge.html') && same(before, await earned(page)));
      await resume(page, cycle === 2 ? 'pageshow' : 'visibilitychange'); await listening(page);
      const after = await resources(page);
      ok('resume ' + cycle + ' has one fresh listener and keeps target/meter', after.requests === cycle + 1 && after.live === 1 && after.graphs === 1 && after.meter === 2 && after.target === partial.target, after);
      if (cycle === 1) {
        const budget = await page.evaluate(() => Math.max(0, ...__pauseHarness.timers.filter((t) => t.active && t.held && t.delay > 10000).map((t) => t.delay)));
        ok('Resume retains the unfinished active detector budget', budget > 15000 && budget < 19900, budget);
      }
    }
    await bursts(page, 3); await settledGame(page);
    const end = await earned(page), r = await resources(page);
    ok('two before pause plus three after count exactly five once', end.reps === before.reps + 5, end);
    ok('one completed round follows repeated resumes', end.ring.n === before.ring.n + 1 && r.effects.filter((e) => e === 'rotAdvance').length === 1, r);
    ok('verification is not duplicated by resume', r.effects.filter((e) => e === 'logAttempt').length === 1, r.effects);
    clean('repeated resume', errors);
  } finally { await context.close(); }
});

await scenario('positive heard demo replay creates no new practice credit', async () => {
  const { context, page, errors } = await fresh({ round: 2, replay: true });
  try {
    await listening(page);
    const before = await earned(page), rotation = await page.evaluate(() => localStorage.getItem('sona.rotation.v1'));
    await bursts(page, 2);
    ok('replay fixture contains two genuinely heard attempts', (await resources(page)).meter === 2);
    await bursts(page, 3); await settledGame(page);
    const after = await earned(page);
    ok('five heard replay attempts still reach their earned game', after.run.pending && await page.evaluate(() => attemptsTotal === 5 && JSON.parse(sessionStorage.getItem('sona.run.v1')).tries === 10));
    delete before.run; delete after.run;
    ok('heard replay leaves ring, rotation, outcomes, reps and rewards unchanged', same(before, after) && rotation === await page.evaluate(() => localStorage.getItem('sona.rotation.v1')), after);
    clean('positive heard replay', errors);
  } finally { await context.close(); }
});

await scenario('a verifier response arrives while paused', async () => {
  const { context, page, errors } = await fresh({ verify: 'deferred' });
  try {
    await listening(page); await bursts(page, 5);
    await page.waitForFunction(() => __pauseHarness.speechWaiters.length > 0, {}, { polling: 30 });
    const before = await earned(page), visible = await pause(page);
    await page.evaluate(() => __pauseHarness.resolveSpeech()); await page.waitForTimeout(70);
    ok('late verification cannot log or advance behind pause', same(before, await earned(page)), await earned(page));
    ok('late verification cannot navigate behind pause', page.url().includes('/charge.html'));
    if (!visible) return;
    await resume(page); await settledGame(page);
    const after = await earned(page), r = await resources(page);
    ok('verified result commits once after Resume', after.ring.n === before.ring.n + 1 && r.effects.filter((e) => e === 'logAttempt').length === 1, r.effects);
    clean('deferred verification', errors);
  } finally { await context.close(); }
});

await scenario('feedback resolves while paused', async () => {
  const { context, page, errors } = await fresh({ verify: 'fail', feedback: true });
  try {
    await listening(page); await bursts(page, 5);
    await page.waitForFunction(() => !!__pauseHarness.feedbackResolve, {}, { polling: 30 });
    const before = await earned(page), visible = await pause(page);
    await page.evaluate(() => { __pauseHarness.verifyMode = 'pass'; __pauseHarness.feedbackResolve(); });
    await page.waitForTimeout(70);
    const hidden = await resources(page);
    ok('late feedback starts no retry listener in the background', hidden.graphs === 0 && hidden.live === 0, hidden);
    ok('late feedback changes no earned work', same(before, await earned(page)));
    if (!visible) return;
    await resume(page); await listening(page);
    const need = await page.evaluate(() => NEED);
    ok('Resume continues the pending three-try retry, not a new round', need === 3, need);
    await bursts(page, 3); await settledGame(page);
    const after = await earned(page), r = await resources(page);
    ok('retry counts only its three new attempts', after.reps === before.reps + 3, after);
    ok('feedback continuation does not duplicate either verdict', r.effects.filter((e) => e === 'logAttempt').length === 2 && r.effects.filter((e) => e === 'rotAdvance').length === 1, r.effects);
    clean('feedback resume', errors);
  } finally { await context.close(); }
});

await scenario('earned game waits for Resume and survives Home', async () => {
  const { context, page, errors } = await fresh();
  try {
    await listening(page); await bursts(page, 5); await settledGame(page);
    const before = await earned(page), visible = await pause(page);
    await page.evaluate(() => __pauseHarness.flushHeld(1200)); await page.waitForTimeout(60);
    ok('an earned game never launches in the background', page.url().includes('/charge.html'));
    ok('pause after earning a game preserves its reward once', same(before, await earned(page)));
    if (!visible) return;
    await page.evaluate(() => __pauseHarness.foreground()); await click(page, '#pauseHome');
    await page.waitForURL('**/today.html');
    ok('Home preserves the earned pending game', (await earned(page)).run.pending === true);
    await click(page, '#goBtn'); await page.waitForURL('**/charge.html?**'); await page.waitForTimeout(420);
    const restored = await resources(page);
    ok('returning to a pending earned game asks for no new practice', restored.requests === 0 && restored.graphs === 0, restored);
    ok('pending-game restore duplicates no practice reward', samePractice(before, await earned(page)));
    await page.evaluate(() => __pauseHarness.releaseHeld());
    await page.waitForURL('**/arcade-slice.html?**');
    ok('restored handoff reaches the earned game', page.url().includes('/arcade-slice.html'));
    clean('earned game restore', errors);
  } finally { await context.close(); }
});

await scenario('chest reveal and claim cannot run behind pause', async () => {
  const { context, page, errors } = await fresh({ round: 4 });
  try {
    await finalChest(page);
    await click(page, '#chestBox'); await click(page, '#chestBox');
    const before = await earned(page), visible = await pause(page);
    if (visible) await focusStaysInPause(page, 'chestOvl');
    await click(page, '#chestBox'); await click(page, '#chestClaim');
    await page.evaluate(() => __pauseHarness.flushHeld(1200)); await page.waitForTimeout(40);
    ok('queued chest actions award nothing while paused', same(before, await earned(page)));
    ok('queued chest claim cannot leave practice while paused', page.url().includes('/charge.html'));
    if (!visible) return;
    await resume(page);
    ok('Resume restores the chest original inert state', await page.locator('#chestOvl').evaluate((el) => !el.inert));
    await click(page, '#chestBox');
    const revealed = await resources(page);
    ok('the third deliberate chest tap awards one sticker', revealed.effects.filter((e) => e === 'awardNextSticker').length === 1, revealed.effects);
    const beforeSecondPause = await earned(page);
    await pause(page); await resume(page);
    const afterSecondPause = await resources(page);
    ok('resuming the revealed chest preserves its existing sticker', same(beforeSecondPause, await earned(page)) && afterSecondPause.effects.filter((e) => e === 'awardNextSticker').length === 1);
    await click(page, '#chestClaim'); await page.locator('#runDone').waitFor();
    ok('claim continues to the farewell without advancing another round', (await earned(page)).ring.n === before.ring.n && await page.locator('#runTitle').innerText() === 'See you next time!');
    clean('chest resume', errors);
  } finally { await context.close(); }
});

await scenario('Home preserves both unopened and revealed legacy chests', async () => {
  const { context, page, errors } = await fresh({ round: 4, legacyChest: true });
  try {
    await finalChest(page, false);
    ok('the legacy two-tap chest is retained after game five', (await page.locator('#chestCap').innerText()).trim() === 'One more tap!');
    const before = await earned(page), visible = await pause(page);
    if (!visible) return;
    await page.evaluate(() => __pauseHarness.foreground()); await click(page, '#pauseHome');
    await page.waitForURL('**/today.html'); await click(page, '#goBtn');
    await page.waitForURL('**/charge.html?**'); await page.locator('#chestOvl.show').waitFor();
    const restored = await resources(page);
    ok('Home restores an unopened chest without another practice attempt', restored.requests === 0 && restored.graphs === 0 && samePractice(before, await earned(page)), restored);
    ok('Home retains the first two chest taps', (await page.locator('#chestCap').innerText()).trim() === 'One more tap!');
    await click(page, '#chestBox');
    const name = await page.locator('#chestName').innerText(), revealed = await earned(page);
    ok('one remaining tap awards exactly one sticker after Home', (await resources(page)).effects.filter((e) => e === 'awardNextSticker').length === 1);
    await pause(page); await page.evaluate(() => __pauseHarness.foreground()); await click(page, '#pauseHome');
    await page.waitForURL('**/today.html'); await click(page, '#goBtn');
    await page.waitForURL('**/charge.html?**'); await page.locator('#chestOvl.show').waitFor();
    const reopened = await resources(page);
    ok('Home restores the same revealed sticker without another award', (await page.locator('#chestName').innerText()) === name && reopened.effects.filter((e) => e === 'awardNextSticker').length === 0 && samePractice(revealed, await earned(page)));
    ok('revealed chest restore does not reopen the microphone', reopened.requests === 0 && reopened.graphs === 0, reopened);
    await click(page, '#chestClaim'); await page.locator('#runDone').waitFor();
    ok('restored chest claim keeps existing completed practice', (await earned(page)).ring.n === before.ring.n);
    clean('chest Home restore', errors);
  } finally { await context.close(); }
});

await scenario('microphone denied on Resume', async () => {
  const { context, page, errors } = await fresh();
  try {
    await listening(page); const before = await earned(page), visible = await pause(page);
    if (!visible) return;
    await page.evaluate(() => { __pauseHarness.micMode = 'deny'; });
    await resume(page); await page.locator('#sonaMicDenied').waitFor();
    const r = await resources(page);
    ok('denied Resume exposes the existing microphone recovery', /Settings/.test(await page.locator('#sonaMicDenied').innerText()));
    ok('pause dialog does not cover microphone recovery', !(await page.locator('#pauseOvl').isVisible()));
    ok('denied Resume leaves no live resources or fabricated progress', r.live === 0 && r.graphs === 0 && same(before, await earned(page)), r);
    await page.evaluate(() => __pauseHarness.background()); await page.evaluate(() => __pauseHarness.foreground());
    ok('a denied terminal screen stays actionable after an interruption', (await page.locator('#sonaMicDenied').isVisible()) && !(await page.locator('#pauseOvl').isVisible()));
    clean('denied Resume', errors);
  } finally { await context.close(); }
});

await scenario('Home ends an unfinished attempt without changing past work', async () => {
  const { context, page, errors } = await fresh({ round: 2 });
  try {
    await listening(page); await bursts(page, 1);
    const before = await earned(page), visible = await pause(page);
    if (!visible) return;
    await page.evaluate(() => __pauseHarness.foreground()); await click(page, '#pauseHome'); await page.waitForURL('**/today.html');
    ok('Home preserves previous completed rounds, scores and rewards', samePractice(before, await earned(page)));
    await page.waitForTimeout(400);
    ok('abandoned timers do not pull the family off Home', page.url().endsWith('/today.html'));
    clean('pause Home', errors);
  } finally { await context.close(); }
});

// Unknown native recognition deliberately exercises the on-device fallback.
// Device-edge frames are controlled; the app's counter, timers, verification,
// persistence and pause lifecycle remain real.
async function beginFinalTail(page, action) {
  await listening(page);
  await page.evaluate((action) => {
    NEED = 1;
    __pauseHarness.voiceFrames = action === 'short' ? 4 : Infinity;
    const paint = paintReps;
    paintReps = function (n) {
      paint(n);
      if (n !== 1 || __pauseHarness.finalReached) return;
      __pauseHarness.finalReached = true;
      queueMicrotask(() => {
        if (action === 'pause' || action === 'latepause') {
          const stop = () => { __pauseHarness.voice = false; __pauseHarness.background(); };
          if (action === 'latepause') setTimeout(stop, 150); else stop();
        } else if (action === 'microphone') {
          __pauseHarness.streams.filter(s => s.track.readyState === 'live').forEach(s => s.track.stop());
        } else if (action === 'model') speaking = true;
      });
    };
    __pauseHarness.voice = true;
  }, action);
  await page.waitForFunction(() => __pauseHarness.finalReached);
}

await scenario('tail: sustained speech completes one fallback-scored try', async () => {
  const { context, page, errors } = await fresh({ verify: 'unknown' });
  try {
    await beginFinalTail(page);
    await page.waitForTimeout(600);
    const state = await page.evaluate(() => ({ frames: SHAPE.frames, reps, saved: Sona.repsToday(), effects: __pauseHarness.effects }));
    ok('final speech continues supplying enough evidence to score', state.frames >= 12, state);
    ok('final listening window saves exactly one try and one outcome', state.reps === 1 && state.saved === 1 && state.effects.filter(e => e === 'logAttempt').length === 1 && state.effects.filter(e => e === 'bumpReps').length === 1, state);
    await page.waitForTimeout(450);
    ok('completed tail cannot count or save again', await page.evaluate(() => reps === 1 && Sona.repsToday() === 1 && __pauseHarness.effects.filter(e => e === 'logAttempt').length === 1));
    clean('sustained final tail', errors);
  } finally { await context.close(); }
});

await scenario('tail: silence and isolated transients cannot manufacture evidence', async () => {
  const { context, page, errors } = await fresh({ verify: 'unknown' });
  try {
    await beginFinalTail(page, 'short');
    await page.waitForTimeout(170); // Existing eight-frame gap ends the burst.
    await page.evaluate(() => { __pauseHarness.voiceFrames = 2; });
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => ({ frames: SHAPE.frames, reps, saved: Sona.repsToday(), remaining: __pauseHarness.voiceFrames, quiet: !!document.querySelector('#quietOvl.show') }));
    ok('two-frame transient reaches the still-active listener', state.remaining <= 0, state);
    ok('silence and a two-frame transient add no scoring evidence or credit', state.frames === 4 && state.reps === 1 && state.saved === 0 && state.quiet, state);
    clean('short final tail', errors);
  } finally { await context.close(); }
});

for (const continuedSpeech of [true, false]) await scenario('tail: pause then resume with ' + (continuedSpeech ? 'speech' : 'silence'), async () => {
  const { context, page, errors } = await fresh({ verify: 'unknown' });
  try {
    await beginFinalTail(page, 'pause');
    await page.locator('#pauseOvl.show').waitFor();
    const before = await earned(page);
    await page.waitForTimeout(430);
    const paused = await resources(page);
    ok('final-tail pause freezes evidence, releases devices and saves nothing', await page.evaluate(() => SHAPE.frames === 4) && paused.live === 0 && paused.recording === 0 && paused.graphs === 0 && same(before, await earned(page)), paused);
    await page.evaluate((voice) => { __pauseHarness.voice = voice; }, continuedSpeech);
    await resume(page);
    await page.waitForTimeout(650);
    const state = await page.evaluate(() => ({ frames: SHAPE.frames, reps, saved: Sona.repsToday(), effects: __pauseHarness.effects, quiet: !!document.querySelector('#quietOvl.show') }));
    if (continuedSpeech) {
      ok('resumed tail requalifies speech and scores once without another repetition', state.frames >= 12 && state.reps === 1 && state.saved === 1 && state.effects.filter(e => e === 'logAttempt').length === 1, state);
      ok('an interrupted final tail does not save an invalid stitched recording', !state.effects.includes('saveRecording'), state.effects);
    } else {
      ok('resuming into silence preserves unknown and saves nothing', state.frames === 4 && state.reps === 1 && state.saved === 0 && state.quiet, state);
    }
    clean('resumed final tail', errors);
  } finally { await context.close(); }
});

await scenario('tail: model playback preserves remaining listening time', async () => {
  const { context, page, errors } = await fresh({ verify: 'unknown' });
  try {
    await beginFinalTail(page, 'model');
    await page.waitForTimeout(480);
    const held = await page.evaluate(() => ({ frames: SHAPE.frames, live: engineOn, saved: Sona.repsToday() }));
    ok('coaching in final tail supplies no evidence and cannot exhaust listening time', held.frames === 4 && held.live && held.saved === 0, held);
    await page.evaluate(() => { speaking = false; });
    await page.waitForTimeout(550);
    const state = await page.evaluate(() => ({ frames: SHAPE.frames, reps, saved: Sona.repsToday(), outcomes: __pauseHarness.effects.filter(e => e === 'logAttempt').length }));
    ok('child gets remaining listening time after coaching and only one credit', state.frames >= 12 && state.reps === 1 && state.saved === 1 && state.outcomes === 1, state);
    clean('model during final tail', errors);
  } finally { await context.close(); }
});

await scenario('tail: closing a paused final repetition cancels pending work', async () => {
  const { context, page, errors } = await fresh({ verify: 'unknown' });
  try {
    await beginFinalTail(page, 'pause');
    await page.locator('#pauseOvl.show').waitFor();
    const before = await earned(page);
    await page.evaluate(() => closePractice());
    await page.waitForTimeout(450);
    const state = await resources(page);
    ok('closed final tail leaves no listening resources or delayed credit', state.live === 0 && state.recording === 0 && state.graphs === 0 && same(before, await earned(page)), state);
    clean('cancelled final tail', errors);
  } finally { await context.close(); }
});

await scenario('tail: resume retains only the unused listening time', async () => {
  const { context, page, errors } = await fresh({ verify: 'unknown' });
  try {
    await beginFinalTail(page, 'latepause');
    await page.locator('#pauseOvl.show').waitFor();
    await page.waitForTimeout(400);
    await page.evaluate(() => { __pauseHarness.voice = true; });
    await resume(page);
    await page.waitForFunction(() => engineOn && engineAttempt?.segment);
    const remaining = await page.evaluate(() => {
      const ids = engineAttempt.segment.timers;
      return __pauseHarness.timers.filter(t => ids.includes(t.id) && t.active && t.delay < 350).map(t => t.delay);
    });
    ok('resume keeps the partially used tail instead of starting a new 350 ms', remaining.length === 1 && remaining[0] > 0 && remaining[0] < 260, remaining);
    await page.waitForTimeout(450);
    ok('a partially used tail still finishes once', await page.evaluate(() => reps === 1 && Sona.repsToday() === 1 && __pauseHarness.effects.filter(e => e === 'logAttempt').length === 1));
    clean('partially used final tail', errors);
  } finally { await context.close(); }
});

for (const continuedSpeech of [true, false]) await scenario('tail: microphone recovery with ' + (continuedSpeech ? 'speech' : 'one transient'), async () => {
  const { context, page, errors } = await fresh({ verify: 'unknown' });
  try {
    await beginFinalTail(page, 'microphone');
    await page.locator('#quietOvl.show').waitFor();
    ok('lost final-tail microphone presents recovery without saving progress', /grown-up/.test(await page.locator('#quietTitle').innerText()) && await page.evaluate(() => SHAPE.frames === 4 && Sona.repsToday() === 0));
    await page.evaluate((speech) => { __pauseHarness.voiceFrames = speech ? Infinity : 1; }, continuedSpeech);
    await click(page, '#quietGo');
    await page.waitForTimeout(650);
    const state = await page.evaluate(() => ({ frames: SHAPE.frames, reps, saved: Sona.repsToday(), remaining: __pauseHarness.voiceFrames, effects: __pauseHarness.effects, quiet: !!document.querySelector('#quietOvl.show') }));
    if (continuedSpeech) {
      ok('replacement microphone qualifies speech and finishes the same try once', state.frames >= 12 && state.reps === 1 && state.saved === 1 && state.effects.filter(e => e === 'logAttempt').length === 1, state);
      ok('microphone interruption never saves a stitched recording', !state.effects.includes('saveRecording'), state);
    } else {
      ok('replacement microphone receives the transient but cannot reuse old burst qualification', state.remaining <= 0 && state.frames === 4 && state.reps === 1 && state.saved === 0 && state.quiet, state);
    }
    clean('final-tail microphone recovery', errors);
  } finally { await context.close(); }
});

await browser.close(); await new Promise((resolve) => server.close(resolve));
console.log(failures ? failures + ' FAILURES / ' + assertions + ' assertions' : 'ALL GREEN — ' + assertions + ' assertions');
process.exit(failures ? 1 : 0);
