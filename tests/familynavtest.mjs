// FAMILYNAV1: one grown-ups bar, the same on every grown-up page.
// Travis, 29 Sep 2026: "depending on what you click on, the bottom bar or the
// top bar options look different." The fix only holds while every grown-up
// page carries the SAME header and three tabs, in the same place, with no
// bottom bar of its own — so this suite pins the markup byte-for-byte (apart
// from which tab is lit), measures where the bar lands on a phone, and checks
// that Home's Grown-ups button, after the code, lands on Settings and its bar
// (Travis, 30 Sep 2026: "go straight to settings not have them choose what
// they wanna go to") — the bar is the one menu; Home has no pop-up of its
// own to drift from it. A new grown-up page belongs in PAGES below.
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
  // voices.html removed 29 Sep 2026: one coach voice, so no picker page.
  { file: 'subscribe.html', tab: 'settings', current: 'true' },
];
const TABS = [
  { tab: 'progress', href: '/progress.html', label: 'Progress' },
  { tab: 'settings', href: '/settings.html', label: 'Settings' },
  { tab: 'talk', href: '/talk.html', label: 'Talk to us' },
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

// ── Home has no second menu: the bar is the only list of the three ─────
// The Grown-ups pop-up (Progress · Settings · Talk to us) went on 30 Sep
// 2026. A copy of the bar on Home is a second menu to keep in step, and the
// parent had to choose before getting anywhere.
const today = read('today.html').replace(/<!--[\s\S]*?-->/g, '');
ok('Home has no Grown-ups pop-up of its own', !/id="sheetOvl"/.test(today) && !/id="go(Progress|Settings|Talk)"/.test(today));

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
    localStorage.setItem('sona.freeera.v1', 'post'); localStorage.setItem('sona.freeera2.v1', 'done'); localStorage.setItem('sona.freeera3.v1', 'done'); localStorage.setItem('sona.freeera4.v1', 'done'); localStorage.setItem('sona.freeera5.v1', 'done');
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

  // The Grown-ups button: the code, then Settings with the bar lit on it, and
  // the bar's other two tabs one tap away. A bounce to Home's gate with no
  // allowed destination ends in the same place.
  const passGate = async page => {
    const need = await page.evaluate(() => window.gateNeed);
    for (const d of need) await page.locator('#pad button', { hasText: new RegExp('^' + d + '$') }).click();
    await page.locator('#pad button', { hasText: '✓' }).click();
  };
  await scenario('the Grown-ups button goes straight to Settings', async () => {
    const { page, context, errors } = await fresh({ width: 375, height: 812 });
    try {
      await page.goto(origin + '/today.html');
      await page.waitForFunction(() => window.Sona && document.getElementById('parentBtn'));
      await page.click('#parentBtn');
      ok('the Grown-ups button asks for the code first, and goes nowhere yet', await page.evaluate(() => document.getElementById('gateOvl').classList.contains('show') && location.pathname === '/today.html'));
      await Promise.all([page.waitForURL(u => new URL(u).pathname === '/settings.html'), passGate(page)]);
      ok('the right code lands on Settings, with no menu in between', new URL(page.url()).pathname === '/settings.html' && !new URL(page.url()).hash, page.url());
      await page.waitForFunction(() => window.Sona && document.querySelector('nav.family-tabs'));
      const bar = await page.evaluate(() => ({
        lit: [...document.querySelectorAll('nav.family-tabs a[aria-current]')].map(a => a.dataset.tab + ':' + a.getAttribute('aria-current')),
        tabs: [...document.querySelectorAll('nav.family-tabs a')].map(a => ({ href: a.getAttribute('href'), label: a.textContent.trim() })),
      }));
      ok('Settings opens with its own tab lit', JSON.stringify(bar.lit) === JSON.stringify(['settings:page']), bar.lit);
      ok('…and the bar offers the three places, in order', JSON.stringify(bar.tabs) === JSON.stringify(TABS.map(t => ({ href: t.href, label: t.label }))), bar.tabs);
      for (const t of TABS.filter(t => t.tab !== 'settings')) {
        await page.goto(origin + '/settings.html');
        await page.waitForFunction(() => window.Sona && document.querySelector('nav.family-tabs'));
        await Promise.all([page.waitForURL(u => new URL(u).pathname === t.href), page.click('nav.family-tabs a[data-tab="' + t.tab + '"]')]);
        ok(`from Settings, the ${t.label} tab opens ${t.href}`, new URL(page.url()).pathname === t.href, page.url());
      }
      await page.goto(origin + '/today.html?gate=1');
      await page.waitForFunction(() => window.Sona && document.getElementById('gateOvl').classList.contains('show'));
      await Promise.all([page.waitForURL(u => new URL(u).pathname === '/settings.html'), passGate(page)]);
      ok('a bounce to the gate with nowhere to go also lands on Settings', new URL(page.url()).pathname === '/settings.html', page.url());
      ok('no page errors on the way', errors.length === 0, errors);
    } finally { await context.close(); }
  });
} finally {
  await browser.close(); server.close();
}
console.log(`\nFamily nav: ${checks - failures}/${checks} passed`);
process.exit(failures ? 1 : 0);
