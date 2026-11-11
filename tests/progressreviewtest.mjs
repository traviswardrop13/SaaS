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
    localStorage.setItem('sona.freeera.v1', 'post'); localStorage.setItem('sona.freeera2.v1', 'done'); localStorage.setItem('sona.freeera3.v1', 'done'); localStorage.setItem('sona.freeera4.v1', 'done'); localStorage.setItem('sona.freeera5.v1', 'done');
    localStorage.setItem('sona.profile.v1', JSON.stringify({ childName: 'Milo', childAge: '7', focusSounds: ['R'], onboarded: true, weeklyGoal: 5, volume: 0, voiceOn: false, soundOn: false }));
    sessionStorage.setItem('sona.gate.v1', String(Date.now()));
  });
  return { context, page, errors };
}
async function open(page) { await page.goto(origin + '/progress.html'); await page.waitForFunction(() => window.Sona && document.querySelectorAll('#week .day').length === 7); await page.waitForTimeout(120); }
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
// ONE SCREEN (Travis, 5 Nov 2026: "simplify drastically ... just have that be
// on one page"): the week's practice days, accuracy by sound as "Coming
// soon", each sound's practice level, and the hedge. Nothing to set, share
// or play.
const GONE = ['storyLine', 'recordingsCard', 'recList', 'howCard', 'rateCard', 'firstsCard', 'recent', 'share', 'copySummary', 'summaryText', 'boardNote', 'wkGoalPick', 'dailyGoalPick', 'goalHelp', 'goalToday', 'clearest', 'acc', 'sStreak', 'sSessions', 'sWords', 'sStars', 'volChip', 'volNext', 'goalCard'];
try {
  await scenario('empty progress', async () => {
    const { page, context, errors } = await fresh();
    try {
      apiRequests = []; await open(page);
      const state = await page.evaluate((gone) => ({
        cards: [...document.querySelectorAll('.wrap > .card')].map(el => el.id),
        removed: gone.filter(id => document.getElementById(id)),
        controls: document.querySelectorAll('.wrap select, .wrap input, .gbtn').length,
        levels: document.getElementById('bysound').textContent,
        days: document.getElementById('wkDays').textContent,
        bottom: document.querySelector('.wrap').getBoundingClientRect().bottom, height: innerHeight,
        share: window.__shares.length, mic: window.__mic, overflow: document.documentElement.scrollWidth > innerWidth,
      }), GONE);
      ok('three cards, in order: the week, accuracy by sound, practice levels', JSON.stringify(state.cards) === JSON.stringify(['weekCard', 'accCard', 'levelsCard']), state.cards);
      ok('the removed boxes, buttons and goal pickers stay absent', state.removed.length === 0, state.removed);
      ok('nothing on the page is a setting', state.controls === 0, state.controls);
      ok('an empty week says no days yet, and the levels card says what will fill it', state.days === '0 days practiced' && /Sounds appear here after sound practice/.test(state.levels), state);
      ok('the whole page fits one 375×812 phone screen', state.bottom <= state.height, state);
      ok('visiting Progress never shares audio, opens a mic, or calls peer ranking', state.share === 0 && state.mic === 0 && !apiRequests.includes('/api/reps'), apiRequests);
      ok('empty page fits a narrow phone', !state.overflow);
      ok('empty page has no script errors', errors.length === 0, errors);
      await page.screenshot({ path: OUT + '/progress-empty-review' + (ref ? '-baseline' : '') + '.png', fullPage: true });
    } finally { await context.close(); }
  });
  await scenario('honest counts, no percentages', async () => {
    const { page, context, errors } = await fresh();
    try {
      await seed(page, { tries: 12, checks: 4, passes: 3, twoDays: true, previous: true }); await open(page);
      const state = await page.evaluate(() => ({
        volume: document.getElementById('volReps').textContent, last: document.getElementById('volLast').textContent,
        acc: document.getElementById('accCard').innerText, levels: document.getElementById('bysound').innerText,
        days: document.getElementById('wkDays').textContent, on: document.querySelectorAll('#week .d.on').length,
        page: document.querySelector('.wrap').innerText,
        bottom: document.querySelector('.wrap').getBoundingClientRect().bottom, height: innerHeight,
      }));
      ok('weekly volume counts voiced tries rather than sound checks', state.volume === '12', state);
      ok('last-week baseline compares only this family', state.last === 'Up from 3 tries last week', state.last);
      ok('accuracy by sound is Coming soon', /Accuracy by sound/.test(state.acc) && /Coming soon/.test(state.acc), state.acc);
      ok('no percentage appears anywhere on the page', !/\d\s*%/.test(state.page), state.page);
      ok('practice levels show each sound with its tries and its level, never a word total', /R sound/.test(state.levels) && /16 tries/.test(state.levels) && !/99|words? total/.test(state.levels), state.levels);
      ok('the bubbles count days with practice this week, with no streak', state.on === 1 && state.days === '1 day practiced' && !/90|streak/i.test(state.page), state);
      ok('a filled page still fits one 375×812 phone screen', state.bottom <= state.height, state);
      await page.screenshot({ path: OUT + '/progress-filled-review' + (ref ? '-baseline' : '') + '.png', fullPage: true });
      ok('filled page has no script errors', errors.length === 0, errors);
    } finally { await context.close(); }
  });
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
console.log(`Progress review: ${checks - failures}/${checks} passed${ref ? ' (baseline ' + ref + ')' : ''}`);
process.exitCode = failures ? 1 : 0;
