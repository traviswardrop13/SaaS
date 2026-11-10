// Native checkpoint and new-life cards must use the same local word verdict
// as sound powers. A matching waveform alone does not say what word was said.
// Baseline: SONATEST_PUBLIC_ROOT=<pre-fix-public> node tests/arcadewordchecktest.mjs
import { chromium, ROOT, launchOpts } from './_env.mjs';
import { serve } from './_sayitear.mjs';
import { fakeDevice } from './_sayplaydevice.mjs';
import { nativeMic, fakeWorkletPatch } from './_nativemic.mjs';

const { server, BASE } = await serve(process.env.SONATEST_PUBLIC_ROOT || ROOT);
const browser = await chromium.launch(launchOpts());
let checks = 0, failures = 0;
function ok(label, pass, detail) { checks++; if (!pass) failures++; console.log((pass ? 'PASS ' : 'FAIL ') + label + (pass ? '' : ' → ' + JSON.stringify(detail))); }
const games = ['slice', 'tiles', 'stack', 'run', 'glide', 'rise'];
const only = process.env.ARCADE_WORD_CASE ? new RegExp(process.env.ARCADE_WORD_CASE) : null;
async function advance(page, ms) { await page.clock.runFor(ms); }
async function until(page, predicate, ms = 16000) { for (let t = 0; t < ms; t += 100) { if (await page.evaluate(predicate)) return true; await advance(page, 100); } return !!(await page.evaluate(predicate)); }
async function burst(page, ms = 350) { await page.evaluate(() => { __quiet.voice = true; }); await advance(page, ms); await page.evaluate(() => { __quiet.voice = false; }); await advance(page, 1600); }
async function fresh(game, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.route('**/*', route => {
    const u = route.request().url();
    if (u === BASE + '/api/tts') return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.alloc(2400) });
    return u.startsWith(BASE + '/') ? route.continue() : route.abort();
  });
  await context.addInitScript(fakeDevice, { age: '7', micok: true, voiceOn: !!opts.word, soundOn: false, volume: opts.word ? .6 : 0, speechMs: 100 });
  if (!opts.browser) {
    await context.addInitScript(nativeMic, { mode: 'new', micLog: '__quiet', world: false, audit: false, text: opts.text == null ? 'taco' : opts.text, speech: opts.available !== false, openDelay: opts.openDelay || 0 });
    await context.addInitScript(fakeWorkletPatch, { field: 'src', wrap: 'source' });
  }
  await context.addInitScript(({ game, word }) => {
    sessionStorage.setItem('sona.play.token', 'arcade-' + game + '.html');
    sessionStorage.setItem('sona.boost.sound', 'R');
    localStorage.setItem('sona.sprintintro.v1', '3');
    if (word) {
      sessionStorage.setItem('sona.boost.level', 'word');
      sessionStorage.setItem('sona.boost.ask', JSON.stringify({ sound: 'R', level: 'word', text: 'rot' }));
    }
    // A short, silent local stand-in for the recorded ask: it exercises the
    // real ask/download/card path without depending on an audio device.
    window.Audio = function (src) { const a = { src, volume: 1, play() { a.timer = setTimeout(() => { if (a.onended) a.onended(); }, 100); return Promise.resolve(); }, pause() { clearTimeout(a.timer); }, removeAttribute() {}, load() {} }; return a; };
    document.addEventListener('DOMContentLoaded', () => { if (window.SLOW_ASK) { SLOW_ASK.first = SLOW_ASK.every = SLOW_ASK.quiet = 1e12; slowAskAt = 1e12; } });
  }, { game, word: !!opts.word });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.install();
  await page.goto(BASE + '/arcade-' + game + '.html?from=charge');
  await page.waitForFunction(() => window.gameEntryAllowed === true && typeof crash === 'function');
  await advance(page, 300);
  if (opts.helper === false) await page.evaluate(() => { delete Sona.speechTurn; });
  return { context, page, errors };
}
const snapshot = page => page.evaluate(() => ({ rev: REV, waiting: reviveWait, hearts, life: lifeCard, reps: Sona.dayReps(), starts: window.__nm ? __nm.starts.length : 0, recognizing: !!(window.__nm && __nm.recognizing), active: __quiet.live(), errors: window.__testErrors || [] }));
async function card(page, life, word = false) {
  await page.evaluate(({ life, word }) => { if (life) { hearts = 0; lifeOrEnd(); } else if (word) sayCard('for wave 2!', 'none', 2); else crash(); }, { life, word });
  return until(page, () => reviveWait && !!rv.st && /listening/i.test(document.getElementById('revListen').textContent), 20000);
}

try {
  for (const game of games) for (const life of [false, true]) {
    const label = game + (life ? ' new life' : ' checkpoint'); if (only && !only.test(label)) continue;
    const { context, page, errors } = await fresh(game);
    try {
      ok(label + ': the actual card listens', await card(page, life));
      const before = await snapshot(page); await burst(page); const wrong = await snapshot(page);
      ok(label + ': an unrelated word earns no card, life or rep', wrong.waiting && wrong.rev === before.rev && wrong.hearts === before.hearts && wrong.reps === before.reps, { before, wrong });
      ok(label + ': the phone actually checked local words', wrong.starts > 0, wrong);
      if (!wrong.waiting) continue;
      await page.evaluate(() => { __nm.cfg.text = 'Rrrrr'; });
      await until(page, () => reviveWait && !!rv.st && /listening/i.test(document.getElementById('revListen').textContent));
      await burst(page); await until(page, () => !reviveWait);
      const right = await snapshot(page);
      ok(label + ': the target sound earns exactly one rep and releases recognition', !right.waiting && right.reps === before.reps + 1 && !right.recognizing && (life ? right.hearts === 3 : right.rev === before.rev - 1), right);
      ok(label + ': no runtime error', errors.length === 0, errors);
    } finally { await context.close(); }
  }
  for (const spec of [
    { label: 'slice word taco', text: 'taco', pass: false },
    { label: 'slice word unclear', text: '', pass: false },
    { label: 'slice word unavailable', text: 'rot', available: false, pass: false },
    { label: 'slice word old shared file', text: 'rot', helper: false, pass: false },
    { label: 'slice word close try', text: 'wot', pass: true }
  ]) {
    if (only && !only.test(spec.label)) continue;
    const { context, page, errors } = await fresh('slice', { word: true, ...spec });
    try {
      await page.evaluate(() => { Sona.recordRung('R', 0, 1); Sona.recordRung('R', 0, 1); });
      ok(spec.label + ': the spoken word card listens', await card(page, false, true));
      const target = await page.evaluate(() => ASK && ASK.text), before = await snapshot(page);
      ok(spec.label + ': this really asks a word', target === 'rot', target);
      await burst(page);
      const wrong = await snapshot(page);
      ok(spec.label + (spec.pass ? ': the existing close try earns exactly one card rep' : ': an unverified word earns no card or rep'), spec.pass ? !wrong.waiting && wrong.rev === before.rev - 1 && wrong.reps === before.reps + 1 : wrong.waiting && wrong.rev === before.rev && wrong.reps === before.reps, { before, wrong });
      ok(spec.label + ': no runtime error', errors.length === 0, errors);
    } finally { await context.close(); }
  }
  if (!only || only.test('cancel')) {
    const { context, page, errors } = await fresh('stack', { text: 'Rrrrr' });
    try {
      await card(page, false);
      const before = await snapshot(page);
      await page.evaluate(() => { __quiet.voice = true; }); await advance(page, 220);
      await page.evaluate(() => { __quiet.voice = false; __quiet.background(); }); await advance(page, 1600);
      const after = await snapshot(page);
      ok('cancel: a hidden card cannot consume the local transcript or count a rep', after.waiting && after.rev === before.rev && after.reps === before.reps && !after.recognizing && after.active === 0, { before, after });
      ok('cancel: no runtime error', errors.length === 0, errors);
    } finally { await context.close(); }
  }
  if (!only || only.test('whole utterance')) {
    const { context, page } = await fresh('stack');
    try {
      await card(page, false);
      await page.evaluate(() => {
        const plugin = Capacitor.Plugins.SonaSpeech, stop = plugin.stop;
        window.__stoppedOverVoice = false;
        plugin.stop = function () { if (__quiet.voice) { __stoppedOverVoice = true; __nm.cfg.text = 'Rrrrr'; } else __nm.cfg.text = 'taco'; return stop.apply(this, arguments); };
      });
      await burst(page, 1200);
      const after = await snapshot(page);
      ok('whole utterance: recognition does not stop on an early matching partial', after.waiting && after.reps === 0 && !(await page.evaluate(() => __stoppedOverVoice)), after);
    } finally { await context.close(); }
  }
  if (!only || only.test('held word')) {
    const { context, page } = await fresh('slice', { word: true, text: 'wot' });
    try {
      await page.evaluate(() => { Sona.recordRung('R', 0, 1); Sona.recordRung('R', 0, 1); });
      await card(page, false, true);
      await page.evaluate(() => { __quiet.voice = true; }); await advance(page, 3100);
      const held = await snapshot(page);
      ok('held word: elapsed time cannot accept a matching partial while the child is still talking', held.waiting && held.rev === 3 && held.reps === 0 && await page.evaluate(() => ASK.level === 'word'), held);
      await page.evaluate(() => { __quiet.voice = false; }); await advance(page, 1600);
      const ended = await snapshot(page);
      ok('held word: actual quiet finishes that one close try exactly once', !ended.waiting && ended.rev === 2 && ended.reps === 1, ended);
    } finally { await context.close(); }
  }
  if (!only || only.test('missing PCM')) {
    const { context, page } = await fresh('slice', { word: true, text: 'wot' });
    try {
      await page.evaluate(() => { Sona.recordRung('R', 0, 1); Sona.recordRung('R', 0, 1); });
      await card(page, false, true);
      await page.evaluate(() => { const deaf = Sona.micDeaf; Sona.micDeaf = function (stream) { return !!window.__dropPcm || deaf(stream); }; __quiet.voice = true; });
      await advance(page, 250);
      await page.evaluate(() => { __quiet.voice = false; window.__dropPcm = true; }); await advance(page, 700);
      const missing = await snapshot(page);
      ok('missing PCM: missing frames are never a quiet word ending', missing.waiting && missing.reps === 0 && missing.rev === 3, missing);
      await page.evaluate(() => { window.__dropPcm = false; }); await advance(page, 350);
      const quiet = await snapshot(page);
      ok('missing PCM: stale pre-gap evidence cannot answer the card after samples return', quiet.waiting && quiet.reps === 0 && quiet.rev === 3, quiet);
      await burst(page);
      const fresh = await snapshot(page);
      ok('missing PCM: a fresh whole saying after the gap can answer once', !fresh.waiting && fresh.reps === 1 && fresh.rev === 2, fresh);
    } finally { await context.close(); }
  }
  if (!only || only.test('leave pending')) {
    const { context, page } = await fresh('stack', { text: 'Rrrrr' });
    try {
      await card(page, false);
      await page.evaluate(() => {
        const plugin = Capacitor.Plugins.SonaSpeech, stop = plugin.stop;
        plugin.stop = function () { return new Promise(resolve => setTimeout(() => resolve(stop.apply(this, arguments)), 600)); };
        document.getElementById('close').click();
      });
      await advance(page, 300);
      ok('leave pending: navigation waits for native cancellation', new URL(page.url()).pathname === '/arcade-stack.html', page.url());
      await advance(page, 1000);
      await page.waitForURL('**/today.html#play');
      ok('leave pending: cleanup then navigates without any rep', await page.evaluate(() => Sona.dayReps() === 0));
    } finally { await context.close(); }
  }
  for (const retry of [false, true]) {
    const label = retry ? 'owner retry switch' : 'owner pending open';
    if (only && !only.test(label)) continue;
    const { context, page, errors } = await fresh(retry ? 'slice' : 'stack', { word: retry, text: retry ? 'taco' : 'Rrrrr', openDelay: retry ? 0 : 600 });
    try {
      await page.evaluate(() => {
        const first = Sona.activeKid().slot;
        window.__sibling = Sona.addKid('Sam', '7');
        const profile = Sona.getProfile(); profile.focusSounds = ['S']; profile.onboarded = true; Sona.saveProfile(profile);
        Sona.switchKid(first);
        window.__firstReps = localStorage.getItem('sona.gamereps.v1');
      });
      if (retry) {
        await page.evaluate(() => { Sona.recordRung('R', 0, 1); Sona.recordRung('R', 0, 1); });
        ok(label + ': the first word is genuinely listening', await card(page, false, true));
        await page.evaluate(() => { __nm.cfg.openDelay = 600; __quiet.voice = true; });
        await advance(page, 350); await page.evaluate(() => { __quiet.voice = false; });
        ok(label + ': the rejected word is reopening the mic', await until(page, () => __nm.opens.length >= 2 && rv.pending > 0));
      } else {
        await page.evaluate(() => { hearts = 0; lifeOrEnd(); });
        ok(label + ': the original mic request is still pending', await until(page, () => __nm.opens.length === 1 && rv.pending > 0));
      }
      await page.evaluate(() => { Sona.switchKid(__sibling); __nm.cfg.text = 'Rrrrr'; });
      await advance(page, 1400);
      const retiring = await page.evaluate(() => !!window.__speechOwnerGone).catch(() => true);
      if (retiring || new URL(page.url()).pathname === '/today.html') {
        await page.waitForURL('**/today.html');
        await page.waitForFunction(() => window.Sona && window.__nm && window.__quiet);
      }
      await burst(page); await advance(page, 1000);
      const after = await page.evaluate(() => ({ path: location.pathname, name: Sona.getProfile().childName, reps: Sona.dayReps(), firstReps: localStorage.getItem('sona.gamereps.v1'), activeMic: __quiet.live(), recognizing: !!__nm.recognizing }));
      ok(label + ': a stale target cannot be adopted by the sibling', after.name === 'Sam' && after.reps === 0 && after.firstReps === null, after);
      ok(label + ': the stale page retires to Home with both listeners closed', after.path === '/today.html' && after.activeMic === 0 && !after.recognizing, after);
      ok(label + ': no runtime error', errors.length === 0, errors);
    } finally { await context.close(); }
  }
  if (!only || only.test('browser')) {
    const { context, page } = await fresh('stack', { browser: true });
    try { await card(page, false); const before = await snapshot(page); await burst(page); const after = await snapshot(page); ok('browser: the existing voiced sound still answers a card', !after.waiting && after.reps === before.reps + 1, after); } finally { await context.close(); }
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
console.log(checks + ' checks, ' + failures + ' failures');
process.exitCode = failures ? 1 : 0;
