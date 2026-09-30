// TALKTEST1: the grown-ups' "Talk to us" tab (public/talk.html) in a real
// browser. The page is a parent's one place to leave feedback or ask for a
// call, so this pins: it is behind the grown-ups gate; it wears the same bar
// as every grown-up page; it posts EXACTLY the allowlisted fields — never a
// child's name, a clinician code or a child id, even when the profile holds
// them; a failed send keeps the draft; the copy never says "booked"; Rachel's
// credential is in the one settled wording; and the iPhone app is always a
// family surface. /api/family/feedback is intercepted — nothing leaves.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium, ROOT, OUT, launchOpts } from './_env.mjs';

let checks = 0, fails = 0;
function ok(label, pass, detail) { checks++; if (!pass) fails++; console.log((pass ? 'PASS ' : 'FAIL ') + label + (pass || detail === undefined ? '' : ' → ' + JSON.stringify(detail))); }
async function scenario(label, run) { try { await run(); } catch (e) { ok(label + ' completes', false, e.stack); } }

const SOURCE = readFileSync(path.join(ROOT, 'talk.html'), 'utf8');
const BODY_KEYS = ['app', 'availability', 'chips', 'email', 'from', 'kind', 'prefer', 'recommend', 'text', 'timezone', 'website'];
const FAMILY_CHIPS = ['More games', 'New sounds to practice', 'Progress reports', 'Easier for my kid', "Something's broken", 'Something else'];

const MIME = { html: 'text/html', js: 'text/javascript', svg: 'image/svg+xml', css: 'text/css', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', woff2: 'font/woff2', json: 'application/json', webmanifest: 'application/manifest+json' };
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); return; }
  const file = path.join(ROOT, url.pathname === '/' ? '/today.html' : url.pathname);
  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[file.split('.').pop()] || 'application/octet-stream' }); res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch(launchOpts());

// reply: {status, body, delay} for /api/family/feedback, or 'abort'.
async function fresh({ gate = true, role = 'parent', native = false, viewport = { width: 375, height: 812 }, reply } = {}) {
  const context = await browser.newContext({ viewport });
  await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  const posts = [], api = [];
  const state = { reply: reply || { status: 200, body: { ok: true, stored: true, delivered: false } } };
  // Registered after the catch-all, so it wins (Playwright runs the newest match first).
  await context.route('**/api/family/feedback', async route => {
    const req = route.request();
    posts.push({ method: req.method(), type: req.headers()['content-type'] || '', raw: req.postData() || '', body: JSON.parse(req.postData() || 'null') });
    const r = state.reply;
    if (r === 'abort') return route.abort();
    if (r.delay) await new Promise(res => setTimeout(res, r.delay));
    return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) });
  });
  context.on('request', r => { const p = new URL(r.url()).pathname; if (p.startsWith('/api/')) api.push(p); });
  await context.addInitScript(({ gate, role, native }) => {
    if (native) window.Capacitor = { isNativePlatform: () => true };
    if (sessionStorage.getItem('talk-test-seeded')) return;
    sessionStorage.setItem('talk-test-seeded', '1');
    localStorage.setItem('sona.freeera.v1', 'post'); localStorage.setItem('sona.freeera2.v1', 'done'); localStorage.setItem('sona.freeera3.v1', 'done'); localStorage.setItem('sona.freeera4.v1', 'done');
    // A profile holding everything the page must NOT send.
    localStorage.setItem('sona.profile.v1', JSON.stringify({ role, onboarded: true, childName: 'Mia', childAge: '6', slpCode: 'ABC123', childId: 'kid-77', mode: 'speech', focusSounds: ['S'], email: 'mom@example.test', earlyAdopter: true, voiceOn: false, soundOn: false, volume: 0 }));
    localStorage.setItem('sona.slp', 'ABC123');
    if (gate) sessionStorage.setItem('sona.gate.v1', String(Date.now()));
  }, { gate, role, native });
  const page = await context.newPage(); page.setDefaultTimeout(4000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  return { context, page, posts, api, errors, state };
}
async function open(t) {
  await t.page.goto(origin + '/talk.html');
  await t.page.waitForFunction(() => window.Sona && document.querySelectorAll('#fbChips .talk-chip').length > 0);
}
const chip = (page, host, label) => page.locator(host + ' .talk-chip', { hasText: label }).first();
const noChildData = raw => !/Mia|ABC123|kid-77|childName|slpCode|childId|"code"/.test(raw);

try {
  await scenario('gate', async () => {
    const t = await fresh({ gate: false });
    try {
      await t.page.goto(origin + '/talk.html');
      await t.page.waitForURL('**/today.html?**', { timeout: 3000 }).catch(() => {});
      const u = new URL(t.page.url());
      ok('without a grown-ups pass the page bounces to the gate, carrying where it was going', u.pathname === '/today.html' && u.searchParams.get('gate') === '1' && u.searchParams.get('to') === '/talk.html', t.page.url());
      ok('…and nothing was sent on the way', t.posts.length === 0);
    } finally { await t.context.close(); }
  });

  await scenario('layout and copy', async () => {
    const t = await fresh();
    try {
      await open(t);
      const bar = await t.page.evaluate(() => {
        const nav = document.querySelector('.wrap > nav.family-tabs[aria-label="Grown-ups"]');
        return nav && {
          afterHeader: !!(nav.previousElementSibling && nav.previousElementSibling.matches('header.family-header')),
          tabs: [...nav.querySelectorAll('a')].map(a => [a.textContent.trim(), a.getAttribute('href'), a.getAttribute('aria-current')]),
          head: (document.querySelector('.family-pagehead h1') || {}).textContent,
          sub: (document.querySelector('.family-pagehead p') || {}).textContent,
        };
      });
      ok('the grown-ups bar sits right under the header', bar && bar.afterHeader, bar);
      ok('…three tabs, Talk to us marked current', JSON.stringify(bar && bar.tabs) === JSON.stringify([['Progress', '/progress.html', null], ['Settings', '/settings.html', null], ['Talk to us', '/talk.html', 'page']]), bar && bar.tabs);
      ok('the page is titled Talk to us', bar && bar.head === 'Talk to us' && /ask for a call/.test(bar.sub || ''), bar);
      const rachel = await t.page.locator('.talk-rachel').innerText();
      ok("Rachel's card says licensed pediatric speech-language pathologist", /licensed pediatric speech-language pathologist/.test(rachel) && await t.page.locator('.talk-rachel img[alt="Rachel Wardrop"]').count() === 1, rachel);
      // 29 Sep 2026: Travis asked for her credentials after her name ("MS, CF-SLP") and his own name off her card.
      ok("…signed with her credentials: Rachel, MS, CF-SLP", /Rachel, MS, CF-SLP · Co-founder/.test(rachel), rachel);
      ok("…and her card names nobody else", !/Travis/.test(rachel), rachel);
      const all = await t.page.locator('body').innerText();
      ok('no credential beyond the settled wording, on the page or in its source', !/Clinical Fellow|\bCCC\b|certified|fully licen[sc]ed/i.test(all + SOURCE));
      ok('the page never says booked', !/booked/i.test(all));
      ok('the privacy lines are shown', /leave out your child's name/.test(all) && /only to reply\. It isn't added to any mailing list/.test(all));
      ok('the reply email is prefilled from setup', await t.page.inputValue('#fbEmail') === 'mom@example.test');
      ok('a parent gets the family question and chips',
        (await t.page.locator('#fbLead').innerText()) === 'What would make Sona better for your family?' &&
        JSON.stringify(await t.page.locator('#fbChips .talk-chip').allInnerTexts()) === JSON.stringify(FAMILY_CHIPS));
      const hp = await t.page.evaluate(() => {
        const el = document.getElementById('website'), r = el.getBoundingClientRect();
        return { name: el.name, right: r.right, bottom: r.bottom, tab: el.tabIndex, auto: el.getAttribute('autocomplete'), hidden: el.closest('[aria-hidden="true"]') !== null };
      });
      ok('the honeypot is off-screen, out of the tab order and hidden from screen readers', hp.name === 'website' && (hp.right <= 0 || hp.bottom <= 0) && hp.tab === -1 && hp.auto === 'off' && hp.hidden, hp);
      await t.page.click('#rachelCall');
      ok("Rachel's \"I'd love to talk\" opens the call request", await t.page.getAttribute('#fbModeCall', 'aria-pressed') === 'true' && await t.page.isVisible('#callFields') && !(await t.page.isVisible('#feedbackFields')));
      ok('…and the call form opens on a video call', await chip(t.page, '#callPrefer', 'Video call').getAttribute('aria-pressed') === 'true');
      ok('…and says it is a request, not a booking, and what a call is for',
        /a request, not a booking/.test(await t.page.locator('#callFields').innerText()) && /your child's speech-language pathologist is the right person/.test(await t.page.locator('#callFields').innerText()));
      ok('no page errors', t.errors.length === 0, t.errors);
    } finally { await t.context.close(); }
  });

  await scenario('feedback', async () => {
    const t = await fresh();
    try {
      await open(t);
      await t.page.click('#fbSend');
      ok('an empty feedback shows the inline hint and posts nothing', (await t.page.locator('#fbStatus').innerText()) === 'Pick a chip or write a quick thought first.' && t.posts.length === 0);
      await chip(t.page, '#fbChips', 'More games').click();
      await chip(t.page, '#fbChips', "Something's broken").click();
      await chip(t.page, '#fbRec', 'Maybe').click();
      await t.page.fill('#fbText', 'More animal words please.');
      t.state.reply = { status: 200, body: { ok: true, stored: true, delivered: false }, delay: 500 };
      // Two clicks in the same tick: one message.
      await t.page.evaluate(() => { const b = document.getElementById('fbSend'); b.click(); b.click(); });
      const busy = await t.page.evaluate(() => ({ text: document.getElementById('fbSend').textContent, disabled: document.getElementById('fbSend').disabled, chips: document.querySelector('#fbChips .talk-chip').disabled }));
      ok('while sending, the button says Sending… and the form is locked', busy.text === 'Sending…' && busy.disabled && busy.chips, busy);
      await t.page.locator('#fbSuccess').waitFor({ state: 'visible' });
      await t.page.waitForTimeout(300);
      ok('a double tap posts once', t.posts.length === 1, t.posts.length);
      const p = t.posts[0], b = p.body;
      ok('it is a JSON POST', p.method === 'POST' && /application\/json/.test(p.type), p);
      ok('the body is exactly the allowlisted fields', JSON.stringify(Object.keys(b).sort()) === JSON.stringify(BODY_KEYS), Object.keys(b));
      ok('…carrying the chips, the answer and the words',
        b.kind === 'feedback' && JSON.stringify(b.chips) === JSON.stringify(['More games', "Something's broken"]) && b.recommend === 'Maybe' && b.text === 'More animal words please.' && b.email === 'mom@example.test' && b.prefer === '' && b.availability === '' && b.app === 'web' && b.from === 'family' && b.website === '', b);
      // the privacy policy: a time zone comes only with a call request
      ok('…and no time zone, which only a call request carries', b.timezone === '', b.timezone);
      ok("never the child's name, the clinician code or a child id, though the profile holds them", noChildData(p.raw), p.raw);
      const done = await t.page.locator('#fbSuccess').innerText();
      ok('the thank-you says it reached the team, never booked', /reached|received/.test(done) && !/booked/i.test(done), done);
      ok('a sent message clears the form', await t.page.inputValue('#fbText') === '' && (await t.page.locator('#fbChips .talk-chip[aria-pressed="true"]').count()) === 0 && !(await t.page.isDisabled('#fbSend')));
      await t.page.fill('#fbText', 'Short one');
      await t.page.fill('#fbEmail', 'not-an-email');
      await t.page.click('#fbSend');
      ok('a mistyped optional email is caught before sending', /check your email/.test(await t.page.locator('#fbStatus').innerText()) && t.posts.length === 1);
    } finally { await t.context.close(); }
  });

  await scenario('call', async () => {
    const t = await fresh();
    try {
      await open(t);
      await t.page.click('#fbModeCall');
      ok('Request a call swaps the form and the button', await t.page.isVisible('#callFields') && !(await t.page.isVisible('#feedbackFields')) && (await t.page.locator('#fbSend').innerText()) === 'Request a call');
      await t.page.fill('#callEmail', '');
      await t.page.click('#fbSend');
      ok('a call request needs an email, and posts nothing without one', (await t.page.locator('#fbStatus').innerText()) === 'Please add an email so we can reply.' && t.posts.length === 0);
      await t.page.fill('#callEmail', 'nope');
      await t.page.click('#fbSend');
      ok('…a real one', /check your email/.test(await t.page.locator('#fbStatus').innerText()) && t.posts.length === 0);
      await t.page.fill('#callEmail', 'dad@example.test');
      await chip(t.page, '#callPrefer', 'Phone call').click();
      await t.page.fill('#callAvailability', 'weekday evenings');
      await t.page.fill('#callText', 'How do the games pick words?');
      await t.page.click('#fbSend');
      await t.page.locator('#fbSuccess').waitFor({ state: 'visible' });
      const p = t.posts[0], b = p && p.body;
      ok('a call request posts once, with exactly the allowlisted fields', t.posts.length === 1 && JSON.stringify(Object.keys(b).sort()) === JSON.stringify(BODY_KEYS), b);
      ok('…how and when to talk, where to reply, and the time zone',
        b.kind === 'call' && b.email === 'dad@example.test' && b.prefer === 'phone' && b.availability === 'weekday evenings' && b.text === 'How do the games pick words?' && JSON.stringify(b.chips) === '[]' && b.recommend === '' && b.timezone === await t.page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone) && b.timezone.length > 0 && b.app === 'web', b);
      ok('…and nothing about the child', noChildData(p.raw), p.raw);
      const done = await t.page.locator('#fbSuccess').innerText();
      ok('the confirmation says received, never booked', /received/.test(done) && !/booked/i.test(done), done);
    } finally { await t.context.close(); }
  });

  await scenario('failure keeps the draft', async () => {
    const t = await fresh({ reply: { status: 503, body: { ok: false, error: "We couldn't receive your message. Please try again shortly." } } });
    try {
      await open(t);
      await chip(t.page, '#fbChips', 'Progress reports').click();
      await t.page.fill('#fbText', 'Keep this draft');
      await t.page.click('#fbSend');
      await t.page.waitForFunction(() => document.getElementById('fbStatus').textContent.length > 0);
      ok("a 503 shows the server's words", (await t.page.locator('#fbStatus').innerText()) === "We couldn't receive your message. Please try again shortly.");
      ok('…and keeps every field, ready to retry',
        await t.page.inputValue('#fbText') === 'Keep this draft' && await chip(t.page, '#fbChips', 'Progress reports').getAttribute('aria-pressed') === 'true' &&
        !(await t.page.isVisible('#fbSuccess')) && !(await t.page.isDisabled('#fbSend')) && (await t.page.locator('#fbSend').innerText()) === 'Send');
      t.state.reply = 'abort';
      await t.page.click('#fbSend');
      await t.page.waitForFunction(() => /still here/.test(document.getElementById('fbStatus').textContent));
      ok('a dropped connection says the message is still here', await t.page.inputValue('#fbText') === 'Keep this draft' && t.posts.length === 2);
    } finally { await t.context.close(); }
  });

  await scenario('clinician on the web', async () => {
    const t = await fresh({ role: 'slp' });
    try {
      await open(t);
      ok('a clinician in a browser gets the caseload question and chips',
        /caseload/.test(await t.page.locator('#fbLead').innerText()) && (await t.page.locator('#fbChips .talk-chip').allInnerTexts()).includes('Easier to assign'));
    } finally { await t.context.close(); }
  });

  await scenario('iPhone app', async () => {
    const t = await fresh({ role: 'slp', native: true });
    try {
      await open(t);
      const lead = await t.page.locator('#fbLead').innerText();
      ok('the iPhone app always gets the family wording, even with a clinician role saved', !/caseload/.test(lead) && JSON.stringify(await t.page.locator('#fbChips .talk-chip').allInnerTexts()) === JSON.stringify(FAMILY_CHIPS), lead);
      await chip(t.page, '#fbChips', 'More games').click();
      await t.page.click('#fbSend');
      await t.page.locator('#fbSuccess').waitFor({ state: 'visible' });
      ok('…and says it came from the iPhone app', t.posts[0] && t.posts[0].body.app === 'ios' && noChildData(t.posts[0].raw), t.posts[0]);
      ok('…and makes no clinician API call', !t.api.some(p => p.startsWith('/api/slp/')), t.api);
    } finally { await t.context.close(); }
  });

  for (const viewport of [{ width: 375, height: 812 }, { width: 320, height: 640 }]) {
    await scenario('phone ' + viewport.width, async () => {
      const t = await fresh({ viewport });
      try {
        await open(t);
        for (const mode of ['feedback', 'call']) {
          if (mode === 'call') await t.page.click('#fbModeCall');
          const m = await t.page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth - innerWidth,
            fixedBottom: [...document.querySelectorAll('body *')].filter(el => {
              const cs = getComputedStyle(el); if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return false;
              const r = el.getBoundingClientRect(); return r.height >= 24 && r.bottom >= innerHeight - 4 && r.top < innerHeight;
            }).map(el => el.id || el.className || el.tagName),
          }));
          ok(`${viewport.width}px ${mode}: no sideways scroll`, m.overflow <= 0, m.overflow);
          ok(`${viewport.width}px ${mode}: no fixed bar at the bottom`, m.fixedBottom.length === 0, m.fixedBottom);
          await t.page.screenshot({ path: path.join(OUT, `talk-${mode}-${viewport.width}.png`), fullPage: true });
        }
      } finally { await t.context.close(); }
    });
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
console.log(`${checks - fails}/${checks} talk checks passed`);
process.exitCode = fails ? 1 : 0;
