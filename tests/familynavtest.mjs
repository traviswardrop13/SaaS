// FAMILYNAV1: one grown-ups bar, the same on every grown-up page.
// Travis, 29 Sep 2026: "depending on what you click on, the bottom bar or the
// top bar options look different." The fix only holds while every grown-up
// page carries the SAME header and three tabs, in the same place, with no
// bottom bar of its own — so this suite pins the markup byte-for-byte (apart
// from which tab is lit), measures where the bar lands on a phone, and checks
// that the Grown-ups pop-up on Home offers the same three places in the same
// order. A new grown-up page belongs in PAGES below.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium, ROOT, launchOpts } from './_env.mjs';

let failures = 0, checks = 0;
function ok(label, pass, detail = '') { checks++; if (!pass) failures++; console.log((pass ? 'PASS ' : 'FAIL ') + label + (pass ? '' : ' → ' + JSON.stringify(detail))); }
async function scenario(label, run) { try { await run(); } catch (e) { ok(label + ' completes', false, e.stack); } }

// page → which tab is lit, and how. A page you reach FROM a tab lights that
// tab with aria-current="true"; the tab's own page uses "page".
const PAGES = [
  { file: 'progress.html', tab: 'progress', current: 'page' },
  { file: 'settings.html', tab: 'settings', current: 'page' },
  { file: 'talk.html', tab: 'talk', current: 'page' },
  { file: 'voices.html', tab: 'settings', current: 'true' },
  { file: 'subscribe.html', tab: 'settings', current: 'true' },
];
const TABS = [
  { tab: 'progress', href: '/progress.html', label: 'Progress', sheet: 'goProgress' },
  { tab: 'settings', href: '/settings.html', label: 'Settings', sheet: 'goSettings' },
  { tab: 'talk', href: '/talk.html', label: 'Talk to us', sheet: 'goTalk' },
];

const read = f => readFileSync(path.join(ROOT, f), 'utf8');
function chrome(html) {
  const start = html.indexOf('<header class="app family-header">');
  if (start < 0) return null;
  const end = html.indexOf('</nav>', start);
  return end < 0 ? null : html.slice(start, end + 6);
}
const bare = block => block.replace(/ aria-current="(page|true)"/g, '');

// ── source: the same bar everywhere ─────────────────────────────────────
const reference = chrome(read('progress.html'));
ok('progress.html carries the grown-ups bar', !!reference);
for (const p of PAGES) {
  const html = read(p.file), block = chrome(html);
  ok(p.file + ' has the shared header and tabs', !!block);
  if (!block) continue;
  ok(p.file + ' bar is identical to every other grown-up page', bare(block) === bare(reference), { page: bare(block).slice(0, 400) });
  ok(p.file + ' has nothing between the header and the tabs', /<\/header>\s*<nav class="family-tabs" aria-label="Grown-ups">/.test(block));
  const lit = [...block.matchAll(/data-tab="([a-z]+)" aria-current="(page|true)"/g)].map(m => m[1] + ':' + m[2]);
  ok(p.file + ' lights exactly the ' + p.tab + ' tab', lit.length === 1 && lit[0] === p.tab + ':' + p.current, lit);
  ok(p.file + ' has no fixed bottom nav or footer bar', !/class="(nav|vfoot)"/.test(html) && !/class="[^"]*\bcustomize-footer\b/.test(html));
  ok(p.file + ' has no second "Back to Home" link', !/Back to Home/.test(html.replace(/<!--[\s\S]*?-->/g, '')));
}
const tabsInOrder = [...reference.matchAll(/<a href="([^"]+)" data-tab="([a-z]+)"[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]+)<\/a>/g)].map(m => ({ href: m[1], tab: m[2], label: m[3].trim() }));
ok('the bar has the three tabs in order', JSON.stringify(tabsInOrder) === JSON.stringify(TABS.map(({ tab, href, label }) => ({ href, tab, label }))), tabsInOrder);

// ── the Grown-ups pop-up on Home offers the same three places ───────────
const today = read('today.html');
const sheetStart = today.indexOf('id="sheetOvl"'), sheetEnd = today.indexOf('id="pulseOvl"', sheetStart);
const sheetIds = sheetStart < 0 ? [] : [...today.slice(sheetStart, sheetEnd < 0 ? undefined : sheetEnd).matchAll(/<button\b[^>]*\bid="(go[A-Z][A-Za-z]+)"/g)].map(m => m[1]);
ok('Home pop-up lists the same three places in the same order', JSON.stringify(sheetIds) === JSON.stringify(TABS.map(t => t.sheet)), sheetIds);

// ── browser: the bar lands in the same place on a phone ─────────────────
const MIME = { html: 'text/html', js: 'text/javascript', svg: 'image/svg+xml', css: 'text/css', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', woff2: 'font/woff2', json: 'application/json', webmanifest: 'application/manifest+json' };
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__seed') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>Setup</title>'); return; }
  if (url.pathname.startsWith('/api/')) { res.writeHead(503, { 'content-type': 'application/json' }); res.end('{"ok":false}'); return; }
  const file = path.join(ROOT, url.pathname === '/' ? '/today.html' : url.pathname);
  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[file.split('.').pop()] || 'application/octet-stream' }); res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch(launchOpts());

async function fresh(viewport) {
  const context = await browser.newContext({ viewport });
  await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(5000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + '/__seed');
  await page.evaluate(() => {
    localStorage.setItem('sona.freeera.v1', 'post'); localStorage.setItem('sona.freeera2.v1', 'done'); localStorage.setItem('sona.freeera3.v1', 'done'); localStorage.setItem('sona.freeera4.v1', 'done');
    localStorage.setItem('sona.profile.v1', JSON.stringify({ childName: 'Mia', childAge: '5', focusSounds: ['S'], onboarded: true, volume: 0, voiceOn: false, soundOn: false }));
    sessionStorage.setItem('sona.gate.v1', String(Date.now()));
  });
  return { context, page, errors };
}
const measure = () => {
  const nav = document.querySelector('nav.family-tabs'), r = nav && nav.getBoundingClientRect();
  const bottomBars = [...document.querySelectorAll('body *')].filter(el => {
    const cs = getComputedStyle(el); if (cs.position !== 'fixed' || cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.05) return false;
    const b = el.getBoundingClientRect();
    return b.height >= 24 && b.width >= innerWidth * 0.5 && b.bottom >= innerHeight - 4 && b.top < innerHeight;
  }).map(el => el.id || el.className || el.tagName);
  return {
    path: location.pathname, top: r ? Math.round(r.top) : null, height: r ? Math.round(r.height) : null,
    labels: nav ? [...nav.querySelectorAll('a')].map(a => a.textContent.trim()) : [],
    overflow: document.documentElement.scrollWidth - innerWidth, bottomBars,
    labelsFit: nav ? [...nav.querySelectorAll('a')].every(a => a.scrollWidth <= a.clientWidth + 1) : false,
  };
};

try {
  for (const viewport of [{ width: 375, height: 812 }, { width: 320, height: 640 }]) {
    await scenario('bar position at ' + viewport.width + 'px', async () => {
      const { page, context, errors } = await fresh(viewport);
      try {
        const seen = [];
        for (const p of PAGES) {
          await page.goto(origin + '/' + p.file);
          await page.waitForFunction(() => window.Sona && document.readyState === 'complete');
          await page.waitForTimeout(150);
          const m = await page.evaluate(measure);
          seen.push(m);
          ok(`${viewport.width}px ${p.file} stays on its page with the bar`, m.path === '/' + p.file && m.top !== null, m);
          ok(`${viewport.width}px ${p.file} shows the three tab labels`, JSON.stringify(m.labels) === JSON.stringify(TABS.map(t => t.label)), m.labels);
          ok(`${viewport.width}px ${p.file} tab labels fit their tabs`, m.labelsFit, m.labels);
          ok(`${viewport.width}px ${p.file} has no sideways scroll`, m.overflow <= 0, m.overflow);
          ok(`${viewport.width}px ${p.file} has no bar pinned to the bottom`, m.bottomBars.length === 0, m.bottomBars);
        }
        const tops = new Set(seen.map(m => m.top)), heights = new Set(seen.map(m => m.height));
        ok(`${viewport.width}px the bar sits at the same height on every page`, tops.size === 1, seen.map(m => m.path + ':' + m.top));
        ok(`${viewport.width}px the bar is the same size on every page`, heights.size === 1, seen.map(m => m.path + ':' + m.height));
        ok(`${viewport.width}px no page errors`, errors.length === 0, errors);
      } finally { await context.close(); }
    });
  }

  await scenario('Home pop-up opens the tab pages', async () => {
    const { page, context } = await fresh({ width: 375, height: 812 });
    try {
      for (const t of TABS) {
        await page.goto(origin + '/today.html');
        await page.waitForFunction(() => window.Sona && document.getElementById('sheetOvl'));
        const label = await page.evaluate(id => { document.getElementById('sheetOvl').classList.add('show'); return document.getElementById(id).textContent.trim(); }, t.sheet);
        ok(`pop-up button ${t.sheet} is labelled like its tab`, label === t.label, label);
        await Promise.all([page.waitForURL(u => new URL(u).pathname === t.href), page.click('#' + t.sheet)]);
        ok(`pop-up button ${t.sheet} opens ${t.href}`, new URL(page.url()).pathname === t.href, page.url());
      }
    } finally { await context.close(); }
  });
} finally {
  await browser.close(); server.close();
}
console.log(`\nFamily nav: ${checks - failures}/${checks} passed`);
process.exit(failures ? 1 : 0);
