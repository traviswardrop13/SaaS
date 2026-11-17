// The clinician community is off the dashboard (SLPCLEAN1, Travis, 17 Nov
// 2026: "remove unnecessary features"; he chose Community among them). Until
// then this suite played the community page; now it holds that the page is
// gone and its address lands somewhere real, for an account with a caseload
// and a new one without a code, and that the dashboard never asks the
// community route for anything. The route itself stays (account deletion
// still scrubs posts through it): tests/slpcommunityapi.mjs plays it, and
// tests/slpapptest.mjs its deletion and block steps. Synthetic accounts, a
// mock API; nothing reaches a real account.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { chromium, ROOT, launchOpts } from './_env.mjs';

const PORT = 8173;
const HTML = process.env.SLP_TEST_HTML || ROOT + '/slp.html';
const APP = ROOT.replace(/\/public$/, '');
const accounts = {
  alex: { ok:true, email:'alex@example.test', name:'Alex SLP', code:'alex-test', familyKey:'TEST2345', onboarded:true },
  blair: { ok:true, email:'blair@example.test', name:'Blair SLP', code:'', familyKey:'', onboarded:false }
};
const reads = [];
const MIME = { html:'text/html', js:'text/javascript', css:'text/css', svg:'image/svg+xml', png:'image/png', webp:'image/webp', jpg:'image/jpeg' };
const server = createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  const who = /communityAccount=blair/.test(req.headers.cookie || '') ? 'blair' : 'alex';
  const json = (value, status=200) => { res.writeHead(status, {'content-type':'application/json'}); res.end(JSON.stringify(value)); };
  req.on('data', () => {}); req.on('end', () => {
    if (url.pathname.startsWith('/api/')) reads.push({ who, path: url.pathname, method: req.method });
    if (url.pathname === '/api/slp/auth/me') return json(accounts[who]);
    if (url.pathname === '/api/slp') return json({ok:true,configured:true,kids:[],invites:[]});
    if (url.pathname.startsWith('/api/')) return json({ok:true});
    const path = url.pathname === '/slp.html' ? HTML : ROOT + url.pathname;
    if (!existsSync(path)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'content-type':MIME[path.split('.').pop()]||'application/octet-stream'}); res.end(readFileSync(path));
  });
});
await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
const browser = await chromium.launch(launchOpts());
let checks = 0, failures = 0;
function ok(label, pass, detail='') { checks++; if (!pass) failures++; console.log((pass?'PASS ':'FAIL ')+label+(!pass&&detail?' -> '+detail:'')); }
async function open(who, hash, width=1280) {
  const context = await browser.newContext({ viewport:{ width, height:900 } });
  await context.addCookies([{ name:'communityAccount', value:who, domain:'127.0.0.1', path:'/' }]);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:'+PORT+'/slp.html'+hash);
  await page.waitForFunction(n => document.getElementById('sidebarName').textContent === n, accounts[who].name || accounts[who].code);
  await page.waitForTimeout(250);
  return { context, page, errors };
}
const state = page => page.evaluate(() => ({ hash: location.hash, active: [...document.querySelectorAll('.page.active')].map(p => p.id).join(),
  nav: [...document.querySelectorAll('.sidebar .nav-item')].map(a => a.dataset.page), page: !!document.getElementById('page-community') }));
try {
  for (const width of [1280, 390]) {
    const a = await open('alex', '#community', width);
    const sa = await state(a.page);
    ok(width + 'px: an SLP with a caseload who opens #community lands on Today', sa.hash === '#today' && sa.active === 'page-today', JSON.stringify(sa));
    ok(width + 'px: …and the menu has no Community and no Affiliate partnerships', !sa.nav.includes('community') && !sa.nav.includes('affiliate') && !sa.page, sa.nav.join(','));
    ok(width + 'px: …and no page errors', a.errors.length === 0, a.errors.join('; '));
    await a.context.close();
  }
  const b = await open('blair', '#community');
  const sb = await state(b.page);
  ok('a new SLP without a code who opens #community gets the one form, as Today does', sb.hash === '#today' && sb.active === 'page-onboarding', JSON.stringify(sb));
  await b.context.close();
  ok('the dashboard never asks the community route for anything', reads.length > 0 && !reads.some(r => /community/.test(r.path)), JSON.stringify(reads.map(r => r.path)));
  const src = readFileSync(HTML, 'utf8');
  ok('nothing on the page builds a community feed, composer or Block button', !/\/api\/slp\/community|communityFeed|data-community-block|communityComposer/.test(src));
  ok('the community route stays on the server: account deletion still scrubs posts through it', existsSync(APP + '/app/api/slp/community/route.ts') && /community/.test(readFileSync(APP + '/lib/slpDelete.ts', 'utf8')));
} catch (error) { ok('the suite completes', false, String(error.stack || error)); }
finally { await browser.close(); server.close(); }
console.log(checks + ' checks; ' + failures + ' failures');
process.exitCode = failures ? 1 : 0;
