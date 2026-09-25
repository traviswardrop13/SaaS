// PROGRESSREVIEW1: real parent page, local-only fixtures, muted audio, no mic.
// Regression proof: PROGRESS_REVIEW_REF=c1578b4 node tests/progressreviewtest.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { chromium, ROOT, OUT, launchOpts } from './_env.mjs';
const repo = path.dirname(ROOT), ref = process.env.PROGRESS_REVIEW_REF;
function source(file) { return ref ? execFileSync('git', ['show', ref + ':' + file], { cwd: repo, encoding: 'utf8' }) : readFileSync(path.join(repo, file), 'utf8'); }
const html = source('public/progress.html');
let failures = 0, checks = 0;
function ok(label, pass, detail = '') { checks++; if (!pass) failures++; console.log((pass ? 'PASS ' : 'FAIL ') + label + (pass ? '' : ' → ' + JSON.stringify(detail))); }
async function scenario(label, run) { try { await run(); } catch (e) { ok(label + ' completes', false, e.stack); } }

// Execute the actual retired endpoint: compatibility POST must not even read
// the old payload, and neither method may touch the former anonymous store.
await scenario('retired API', async () => {
  let reads = 0, writes = 0;
  class NextResponse extends Response { static json(value, init = {}) { return new Response(JSON.stringify(value), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } }); } }
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source('app/api/reps/route.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: () => ({ NextResponse }), process: { env: { KV_REST_API_URL: 'https://private-store.invalid', KV_REST_API_TOKEN: 'test-only-key' } },
    fetch: async () => { writes++; return NextResponse.json({ result: ['family1234', '30', 'family5678', '10'] }); },
  });
  const req = { json: async () => { reads++; return { fid: 'family1234', week: '2026-W39', reps: 30 }; }, nextUrl: new URL('https://sona.invalid/api/reps?week=2026-W39&reps=30') };
  const post = await exports.POST(req), get = await exports.GET(req), body = await get.json();
  ok('legacy beacon is acknowledged without retaining practice data', post.status === 200 && reads === 0 && writes === 0, { reads, writes });
  ok('ranking GET is retired and exposes no cohort', get.status === 410 && body.retired === true && !('cohort' in body) && !('pct' in body), body);
});

let apiRequests = [];
const MIME = { html: 'text/html', js: 'text/javascript', svg: 'image/svg+xml', css: 'text/css', png: 'image/png', webp: 'image/webp', woff2: 'font/woff2' };
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__seed') { res.end('<!doctype html><title>Setup</title>'); return; }
  if (url.pathname.startsWith('/api/')) { apiRequests.push(url.pathname); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); return; }
  if (url.pathname === '/progress.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); return; }
  const file = path.join(ROOT, url.pathname);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[file.split('.').pop()] || 'application/octet-stream' }); res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch(launchOpts());
async function fresh() {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await context.addInitScript(() => {
    window.__shares = []; window.__copies = []; window.__prints = 0; window.__mic = 0;
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.__shares.push({ title: data.title, text: data.text, files: (data.files || []).map(f => ({ name: f.name, type: f.type, size: f.size })) }); } });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copies.push(text); } } });
    window.print = () => { window.__prints++; };
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => { window.__mic++; return Promise.reject(new Error('No test microphone')); };
  });
  const page = await context.newPage(); page.setDefaultTimeout(3000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + '/__seed');
  await page.evaluate(() => {
    localStorage.setItem('sona.freeera.v1', 'post'); localStorage.setItem('sona.freeera2.v1', 'done'); localStorage.setItem('sona.freeera3.v1', 'done'); localStorage.setItem('sona.freeera4.v1', 'done');
    localStorage.setItem('sona.profile.v1', JSON.stringify({ childName: 'Milo', childAge: '7', focusSounds: ['R'], onboarded: true, weeklyGoal: 5, volume: 0, voiceOn: false, soundOn: false }));
    sessionStorage.setItem('sona.gate.v1', String(Date.now()));
  });
  return { context, page, errors };
}
async function open(page) { await page.goto(origin + '/progress.html'); await page.waitForFunction(() => window.Sona && document.getElementById('storyLine').textContent); await page.waitForTimeout(120); }
async function seed(page, { tries = 2, checks = 2, passes = 0, twoDays = false, previous = false } = {}) {
  await page.evaluate(({ tries, checks, passes, twoDays, previous }) => {
    function day(offset) { const d = new Date(); d.setDate(d.getDate() + offset); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    const today = day(0), old = day(-14), prev = day(-7);
    const days = {}; days[today] = { a: checks, p: passes, tries };
    if (twoDays) days[old] = { a: 1, p: 1, tries: 1 };
    if (previous) days[prev] = { a: 1, p: 1, tries: 3 };
    localStorage.setItem('sona.outcomes.v1', JSON.stringify({ R: { attempts: checks + (twoDays ? 1 : 0) + (previous ? 1 : 0), passes: passes + (twoDays ? 1 : 0) + (previous ? 1 : 0), tries: tries + (twoDays ? 1 : 0) + (previous ? 3 : 0), days, byPos: { i: { a: checks, p: passes } }, lastAt: today } }));
    const progress = { totals: { sessions: 1, words: 99, stars: 20 }, bySound: {}, stage: {}, streak: { count: 90, lastDate: today }, practiceDays: { [today]: 1 }, sessions: [{ date: new Date().toISOString(), sounds: ['R'], activity: 'practice', tries, count: 99 }] };
    localStorage.setItem('sona.progress.v1', JSON.stringify(progress));
  }, { tries, checks, passes, twoDays, previous });
}
try {
  await scenario('empty progress', async () => {
    const { page, context, errors } = await fresh();
    try {
      apiRequests = []; await open(page);
      const state = await page.evaluate(() => ({
        ghost: document.getElementById('recList').textContent,
        wave: getComputedStyle(document.getElementById('recList'), '::before').content,
        hear: !!document.querySelector('#storyLine a[href="#listenCard"]'),
        actions: [...document.querySelectorAll('a')].filter(a => /Start today.s practice/.test(a.textContent)).length,
        firstCards: [...document.querySelectorAll('.wrap > .card')].slice(0, 3).map(el => el.id),
        removed: ['sStreak', 'sSessions', 'sWords', 'sStars', 'volChip', 'volNext', 'goalCard'].filter(id => document.getElementById(id)),
        share: window.__shares.length, mic: window.__mic, overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      ok('recordings sit immediately after the narrative, then the weekly card', state.firstCards[1] === 'recordingsCard' && state.firstCards[2] === 'weekCard', state.firstCards);
      ok('empty recordings show honest first/latest placeholders', /First try/.test(state.ghost) && /Latest try/.test(state.ghost) && /Milo.s first clear try gets saved here/.test(state.ghost), state.ghost);
      ok('no fake waveform or unavailable listen link', ['none', 'normal'].includes(state.wave) && !state.hear, state);
      ok('empty report has one practice action', state.actions === 1, state.actions);
      ok('removed stats, daily quota, and peer ranking stay absent', state.removed.length === 0, state.removed);
      ok('visiting Progress never shares audio, opens a mic, or calls peer ranking', state.share === 0 && state.mic === 0 && !apiRequests.includes('/api/reps'), apiRequests);
      ok('empty page fits a narrow phone', !state.overflow);
      ok('empty page has no script errors', errors.length === 0, errors);
      await page.screenshot({ path: OUT + '/progress-empty-review' + (ref ? '-baseline' : '') + '.png', fullPage: true });
    } finally { await context.close(); }
  });
  await scenario('honest counts and accuracy threshold', async () => {
    const { page, context, errors } = await fresh();
    try {
      await seed(page); await open(page);
      let acc = await page.locator('#acc').innerText();
      ok('two tries show an early-data message without percentages', /Too early to tell — 2 tries so far/.test(acc) && !/%/.test(acc), acc);
      ok('position chips report matched checks, not premature percentages', /Start of word · 0 of 2/.test(acc), acc);
      await seed(page, { tries: 8, checks: 2, passes: 1, twoDays: true }); await open(page);
      acc = await page.locator('#acc').innerText();
      ok('two days with fewer than 10 tries are still too early', /Too early to tell — 9 tries/.test(acc) && !/%/.test(acc), acc);
      await seed(page, { tries: 12, checks: 2, passes: 1 }); await open(page);
      acc = await page.locator('#acc').innerText();
      ok('even 12 tries on one day are too early for a percentage', /Too early/.test(acc) && !/%/.test(acc), acc);
      await seed(page, { tries: 12, checks: 2, passes: 1, twoDays: true, previous: true }); await open(page);
      const state = await page.evaluate(() => ({ lead: document.getElementById('storyLine').textContent, volume: document.getElementById('volReps').textContent, last: document.getElementById('volLast').textContent, acc: document.getElementById('acc').textContent, clearest: document.getElementById('clearest')?.textContent, week: document.getElementById('wkGoalMsg').textContent }));
      ok('lead and weekly volume count voiced tries rather than sound checks', state.volume === '12' && /with 12 tries this week/.test(state.lead), state);
      ok('last-week baseline compares only this family', state.last === 'Up from 3 tries last week', state.last);
      ok('eligible accuracy uses sound checks as its denominator', /75% of sound checks/.test(state.acc) && /3 of 4 sound checks/.test(state.acc), state.acc);
      ok('clearest sound waits for enough data', /R.*75%/.test(state.clearest || ''), state.clearest);
      ok('weekly goal replaces the day streak', /1 of 5 days this week/.test(state.week) && !/90/.test(state.week), state.week);
      await page.getByText('More details', { exact: false }).click();
      const history = await page.locator('#recent').innerText();
      ok('history uses explicit tries, never legacy word totals', /12 tries/.test(history) && !/99|words/.test(history), history);
      ok('copy summary remains outside collapsed details', await page.locator('#copySummary').isVisible());
      await page.locator('#copySummary').click();
      const summary = await page.evaluate(() => window.__copies[0]);
      ok('summary uses approved practice disclaimer and no day streak', /not an assessment/.test(summary) && /clinical judgment/.test(summary) && !/Streak:|not a diagnosis/.test(summary), summary);
      await page.screenshot({ path: OUT + '/progress-filled-review' + (ref ? '-baseline' : '') + '.png', fullPage: true });
      ok('filled page has no script errors', errors.length === 0, errors);
    } finally { await context.close(); }
  });
  await scenario('parent-directed weekly sharing and fallbacks', async () => {
    const { page, context } = await fresh();
    try {
      await seed(page, { tries: 12, checks: 2, passes: 1, twoDays: true }); await open(page);
      ok('weekly PNG preparation never invokes sharing', await page.evaluate(() => window.__shares.length === 0));
      await page.locator('#share').click();
      let state = await page.evaluate(() => ({ shares: window.__shares, prints: window.__prints }));
      ok('parent tap shares a real PNG and the SLP summary together', state.shares.length === 1 && state.shares[0].files[0]?.type === 'image/png' && state.shares[0].files[0].size > 1000 && /clinical judgment/.test(state.shares[0].text) && state.prints === 0, state);
      await page.evaluate(() => { Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true }); });
      await page.locator('#share').click();
      ok('unsupported file sharing falls back to desktop print', await page.evaluate(() => window.__prints === 1));
      await page.evaluate(() => { Sona.isNativeApp = () => true; });
      await page.locator('#share').click();
      ok('native print no-op falls back to copying the summary', await page.evaluate(() => window.__copies.length === 1 && window.__prints === 1));
      await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); });
      await page.locator('#copySummary').click();
      ok('unavailable clipboard exposes selectable text', await page.locator('#summaryText').isVisible() && /home-practice summary/.test(await page.locator('#summaryText').inputValue()));
    } finally { await context.close(); }
  });
  await scenario('local recordings share only the chosen clip', async () => {
    const { page, context } = await fresh();
    try {
      await open(page);
      await page.evaluate(async () => {
        // Seed historical days directly; production saveRecording intentionally
        // stamps today and allows only one recording per child per day.
        await new Promise((resolve, reject) => {
          const request = indexedDB.open('sona', 1);
          request.onsuccess = () => {
            const tx = request.result.transaction('recordings', 'readwrite');
            const store = tx.objectStore('recordings');
            store.add({ word: 'rain', kid: '', date: '2026-09-10T12:00:00Z', blob: new Blob(['first-clip'], { type: 'audio/webm' }) });
            store.add({ word: 'rain', kid: '', date: '2026-09-20T12:00:00Z', blob: new Blob(['latest-recording'], { type: 'audio/webm' }) });
            tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
          };
          request.onerror = () => reject(request.error);
        });
      });
      apiRequests = []; await open(page);
      const row = await page.locator('#recList').innerText();
      ok('saved clips display first and latest controls', /Play first try/.test(row) && /Play latest try/.test(row) && /Share first try/.test(row) && /Share latest try/.test(row), row);
      ok('listen link appears only once saved audio exists', await page.locator('#storyLine a[href="#listenCard"]').count() === 1);
      ok('loading recordings never shares or transmits them', await page.evaluate(() => window.__shares.length === 0) && !apiRequests.includes('/api/reps'), apiRequests);
      await page.getByRole('button', { name: 'Share first try', exact: true }).click();
      await page.getByRole('button', { name: 'Share latest try', exact: true }).click();
      const shares = await page.evaluate(() => window.__shares);
      ok('first and latest share their own original files only', shares.length === 2 && shares[0].files[0].size === 10 && shares[1].files[0].size === 16 && shares.every(s => s.files.length === 1 && s.files[0].type === 'audio/webm'), shares);
      ok('sharing and recordings fit the narrow phone', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    } finally { await context.close(); }
  });
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
console.log(`Progress review: ${checks - failures}/${checks} passed${ref ? ' (baseline ' + ref + ')' : ''}`);
process.exitCode = failures ? 1 : 0;
