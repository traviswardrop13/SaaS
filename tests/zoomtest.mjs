// ZOOM1: two quick taps never zoom the app (Travis, 30 Sep 2026: "i double
// tapped the screen and it zoomed in how do we make it not do that").
// An iPhone has two browsers for Sona, and each needs its own lock:
//   - the iOS app's web view honours the viewport meta, so every KID page
//     carries maximum-scale=1, user-scalable=no (Home lost it on 24 Sep in a
//     rewrite; Bubble Pop and Peekaboo never had it);
//   - Safari ignores that meta (since iOS 10, for accessibility) but honours
//     touch-action:manipulation, which sona.js puts on EVERY element of every
//     app page: touch-action is not inherited and WebKit intersects it only up
//     to the nearest scroll container, so a rule on <html> alone misses a tap
//     inside Home's scrolling rows.
// What must survive: the grown-up pages keep pinch zoom (no meta lock; it is
// a parent's way to read small print), a page's own touch-action:none on a
// game board still wins, and the clinician dashboard keeps its own touch rules.
import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium, ROOT, launchOpts } from './_env.mjs';

let failures = 0, checks = 0;
function ok(label, pass, detail = '') { checks++; if (!pass) failures++; console.log((pass ? 'PASS ' : 'FAIL ') + label + (pass ? '' : ' → ' + JSON.stringify(detail))); }
async function scenario(label, run) { try { await run(); } catch (e) { ok(label + ' completes', false, e.stack); } }

// The grown-up app pages: they get the double-tap rule but keep pinch zoom.
const GROWNUP = ['settings.html', 'progress.html', 'subscribe.html', 'premium.html', 'talk.html'];
// Loads sona.js for its sound labels only; outside this rule on purpose.
const CLINICIAN = 'slp.html';

// ── source: which pages are the app, and their viewport lock ────────────
const read = f => readFileSync(path.join(ROOT, f), 'utf8');
const APP = readdirSync(ROOT).filter(f => f.endsWith('.html') && f !== CLINICIAN && /<script[^>]*\bsrc="\/sona\.js"/.test(read(f))).sort();
const KID = APP.filter(f => !GROWNUP.includes(f));
ok('the app-page scan finds the app (Home, Settings, practice, Bubble Pop, the books)',
  ['today.html', 'settings.html', 'charge.html', 'arcade-bubbles.html', 'arcade-peekaboo.html', 'library.html'].every(f => APP.includes(f)) && APP.length >= 40, APP);
ok('every grown-up page is an app page', GROWNUP.every(f => APP.includes(f)), GROWNUP.filter(f => !APP.includes(f)));
// Marketing pages never load sona.js, so nothing here reaches them.
ok('no marketing page loads sona.js', ['parents.html', 'for-slps.html', 'privacy.html', 'founders.html', 'founding.html', 'launching.html', 'leads.html', 'slp-login.html'].every(f => !APP.includes(f)));

function viewport(html) {
  const m = html.match(/<meta\s+name="viewport"\s+content="([^"]*)"/);
  if (!m) return null;
  const v = {};
  for (const part of m[1].split(',')) { const [k, val] = part.split('=').map(s => s.trim()); if (k) v[k] = val; }
  return v;
}
for (const f of KID) {
  const v = viewport(read(f));
  ok(f + ' (kid page) locks zoom in its viewport meta', !!v && v['maximum-scale'] === '1' && v['user-scalable'] === 'no', v);
}
for (const f of GROWNUP) {
  const v = viewport(read(f));
  ok(f + ' (grown-up page) keeps pinch zoom', !!v && v['user-scalable'] !== 'no' && !('maximum-scale' in v), v);
}

// ── browser: what every page computes ───────────────────────────────────
const MIME = { html: 'text/html', js: 'text/javascript', svg: 'image/svg+xml', css: 'text/css', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', woff2: 'font/woff2', json: 'application/json', mp3: 'audio/mpeg', webmanifest: 'application/manifest+json' };
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__seed') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>Setup</title>'); return; }
  if (url.pathname.startsWith('/api/')) { res.writeHead(503, { 'content-type': 'application/json' }); res.end('{"ok":false}'); return; }
  const file = path.join(ROOT, url.pathname);
  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[file.split('.').pop()] || 'application/octet-stream' }); res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch(launchOpts());

// Each page is measured where it is: a parked game, a gate or a login check
// may send the page elsewhere, and a 204 answer to that navigation keeps the
// page we came to measure on screen (the browser stays put on No Content).
async function fresh() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  let target = null;
  await context.route('**/*', route => {
    const r = route.request();
    if (!r.url().startsWith(origin)) return route.abort();
    if (target && r.isNavigationRequest() && r.frame() === page.mainFrame() && new URL(r.url()).pathname !== target) return route.fulfill({ status: 204, body: '' });
    return route.continue();
  });
  await page.goto(origin + '/__seed');
  await page.evaluate(() => {
    localStorage.setItem('sona.freeera.v1', 'post'); localStorage.setItem('sona.freeera2.v1', 'done'); localStorage.setItem('sona.freeera3.v1', 'done'); localStorage.setItem('sona.freeera4.v1', 'done'); localStorage.setItem('sona.freeera5.v1', 'done');
    localStorage.setItem('sona.profile.v1', JSON.stringify({ childName: 'Mia', childAge: '5', focusSounds: ['S'], onboarded: true, earlyAdopter: true, volume: 0, voiceOn: false, soundOn: false }));
    localStorage.setItem('sona.micok', '1');
    sessionStorage.setItem('sona.gate.v1', String(Date.now()));
  });
  const open = async (file) => {
    target = '/' + file;
    // 'commit', then the page's own readyState: a navigation answered 204
    // leaves Playwright's load wait hanging though the page has loaded
    await page.goto(origin + target, { waitUntil: 'commit' });
    await page.waitForFunction(() => document.readyState === 'complete');
    await page.waitForTimeout(200);
  };
  return { context, page, open };
}

// What WebKit lets a touch on `el` do: walking down from <html>, a scroll
// container (overflow auto or scroll) starts afresh at auto, then each
// element's own value narrows it. Double-tap zoom survives only as 'auto'.
function effective(sel) {
  const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
  if (!el) return null;
  const chain = []; for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.unshift(n);
  let eff = 'auto';
  for (const n of chain) {
    const cs = getComputedStyle(n);
    if (/^(auto|scroll)$/.test(cs.overflowX) || /^(auto|scroll)$/.test(cs.overflowY)) eff = 'auto';
    const own = cs.touchAction;
    if (own === 'auto') continue;
    if (eff === 'none' || own === 'none') eff = 'none';
    else if (eff === 'auto' || eff === 'manipulation') eff = own;
  }
  return eff;
}
const sweep = () => {
  const sheet = document.getElementById('sonaNoZoom');
  const sheets = [...document.querySelectorAll('link[rel~="stylesheet"],style')];
  const zoomable = [...document.querySelectorAll('*')].filter(el => getComputedStyle(el).touchAction === 'auto')
    .map(el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''));
  return {
    path: location.pathname, sheet: !!sheet, first: sheets[0] === sheet,
    rule: sheet ? sheet.textContent.trim() : '', body: getComputedStyle(document.body).touchAction,
    html: getComputedStyle(document.documentElement).touchAction, zoomable: zoomable.slice(0, 8), zoomableCount: zoomable.length,
  };
};

try {
  await scenario('every app page refuses double-tap zoom', async () => {
    const { context, page, open } = await fresh();
    try {
      for (const f of APP) {
        await open(f);
        const m = await page.evaluate(sweep);
        ok(f + ': measured on its own page', m.path === '/' + f, m.path);
        ok(f + ': the no-double-tap sheet is in, ahead of the page\'s own styles', m.sheet && m.first, m);
        ok(f + ': html and body refuse double-tap zoom', m.html === 'manipulation' && m.body === 'manipulation', { html: m.html, body: m.body });
        ok(f + ': no element is left on auto (each would zoom on a double tap)', m.zoomableCount === 0, m.zoomable);
      }
    } finally { await context.close(); }
  });

  await scenario('Home: a game card in a scrolling row', async () => {
    const { context, page, open } = await fresh();
    try {
      await open('today.html');
      await page.waitForSelector('.game-card');
      const m = await page.evaluate(([fn]) => {
        const effective = new Function('return ' + fn)();
        const cards = [...document.querySelectorAll('.game-card')];
        const scroller = el => { for (let n = el.parentElement; n; n = n.parentElement) { const cs = getComputedStyle(n); if (/^(auto|scroll)$/.test(cs.overflowX) || /^(auto|scroll)$/.test(cs.overflowY)) return n; } return null; };
        const inRow = cards.find(c => { const s = scroller(c); return s && s !== document.documentElement && s !== document.body; }) || null;
        const card = cards[0];
        const now = { card: effective(card), inRow: inRow && effective(inRow) };
        // the same taps with the sheet switched off: the bug this suite is for
        const sheet = document.getElementById('sonaNoZoom'); sheet.disabled = true;
        const without = { card: effective(card), inRow: inRow && effective(inRow) };
        sheet.disabled = false;
        return { cards: cards.length, hasRow: !!inRow, now, without };
      }, [effective.toString()]);
      ok('Home has game cards to tap', m.cards > 0, m);
      ok('Home has a game card inside a scrolling row (the case a root-only rule misses)', m.hasRow, m);
      ok('Home game card: a double tap does not zoom', m.now.card !== 'auto' && (!m.hasRow || m.now.inRow !== 'auto'), m.now);
      ok('Home game card: without the rule it would (the check has teeth)', m.without.card === 'auto' && (!m.hasRow || m.without.inRow === 'auto'), m.without);
    } finally { await context.close(); }
  });

  await scenario('Bubble Pop: the bubble and the stage around it', async () => {
    const { context, page, open } = await fresh();
    try {
      await open('arcade-bubbles.html');
      await page.click('#startGame');
      await page.waitForSelector('#playPanel:not([hidden])');
      const m = await page.evaluate(([fn]) => {
        const effective = new Function('return ' + fn)();
        return { bubble: effective('#revealButton'), stage: effective('#playStage'), prompt: effective('#promptTitle') };
      }, [effective.toString()]);
      ok('Bubble Pop: tapping the bubble fast never zooms', m.bubble === 'manipulation', m);
      ok('Bubble Pop: a tap beside the bubble never zooms either', m.stage === 'manipulation' && m.prompt === 'manipulation', m);
    } finally { await context.close(); }
  });

  // The volume slider went on 30 Sep 2026; what a parent taps in its place is
  // "Turn sound on" (this seed is muted, so it shows) and, at the foot of the
  // page, "Moving to a new phone?".
  await scenario('Settings: buttons, Turn sound on, the moving link and plain text', async () => {
    const { context, page, open } = await fresh();
    try {
      await open('settings.html');
      const m = await page.evaluate(([fn]) => {
        const effective = new Function('return ' + fn)();
        const button = document.querySelector('main button') || document.querySelector('button');
        const text = document.querySelector('main h1, main h2, main p') || document.querySelector('h1, h2, p');
        const on = document.getElementById('soundOnBtn');
        return { button: effective(button), soundOn: effective(on), shown: !!on && on.getClientRects().length > 0, move: effective('#moveBox > summary'), text: effective(text) };
      }, [effective.toString()]);
      ok('Settings: a button never zooms on a double tap', m.button === 'manipulation', m);
      ok('Settings: Turn sound on shows for a muted child, and never zooms on a double tap', m.shown && m.soundOn === 'manipulation', m);
      ok('Settings: the moving-phones link never zooms on a double tap', m.move === 'manipulation', m);
      ok('Settings: plain text never zooms on a double tap', m.text === 'manipulation', m);
    } finally { await context.close(); }
  });

  await scenario('game boards that say none keep none', async () => {
    const { context, page, open } = await fresh();
    try {
      await open('arcade-hoops.html');
      const hoops = await page.evaluate(([fn]) => { const effective = new Function('return ' + fn)(); const c = document.getElementById('court'); return { own: c && getComputedStyle(c).touchAction, eff: effective(c) }; }, [effective.toString()]);
      ok('Hoops: the court still says none, so a swipe is a shot, not a scroll', hoops.own === 'none' && hoops.eff === 'none', hoops);
      await open('arcade-slice.html');
      const slice = await page.evaluate(([fn]) => { const effective = new Function('return ' + fn)(); const app = document.getElementById('app'); return { app: app && getComputedStyle(app).touchAction, canvas: effective('#cv') }; }, [effective.toString()]);
      ok('Fruit Slice: the board still says none, and its canvas takes it', slice.app === 'none' && slice.canvas === 'none', slice);
    } finally { await context.close(); }
  });

  await scenario('the clinician dashboard keeps its own touch rules', async () => {
    const { context, page, open } = await fresh();
    try {
      await open(CLINICIAN);
      const m = await page.evaluate(() => ({ path: location.pathname, sheet: !!document.getElementById('sonaNoZoom'), body: getComputedStyle(document.body).touchAction, button: (b => b && getComputedStyle(b).touchAction)(document.querySelector('button')) }));
      ok('slp.html: measured on its own page', m.path === '/' + CLINICIAN, m);
      ok('slp.html: sona.js leaves it alone', !m.sheet && m.body === 'auto', m);
      ok('slp.html: its own buttons rule still holds', m.button === 'manipulation', m);
    } finally { await context.close(); }
  });
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${checks - failures}/${checks} passed`);
process.exit(failures ? 1 : 0);
