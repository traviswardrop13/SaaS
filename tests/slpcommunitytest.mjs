// Live community browser regressions. Synthetic accounts share one mock API;
// nothing is sent to a real account or to production.
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { chromium, ROOT, launchOpts } from './_env.mjs';

const PORT = 8173;
const HTML = process.env.SLP_TEST_HTML || ROOT + '/slp.html';
const OUT = process.env.COMMUNITY_TEST_OUT;
const accounts = {
  alex: { ok:true, email:'alex@example.test', name:'Alex SLP', code:'alex-test', familyKey:'TEST2345', onboarded:true },
  blair: { ok:true, email:'blair@example.test', name:'Blair SLP', code:'', familyKey:'', onboarded:false }
};
const welcome = {
  id:'71109159-5b68-4af1-851c-35c918bc3050', author:'Rachel', title:'Hey everyone! 👋',
  text:"I’m Rachel! My husband Travis and I started Sona, and I’m so happy you’re here.\n\nI’d love for this to be a place where we can swap ideas, share resources, and help each other make homework and planning a little easier. And if something in Sona is confusing or could work better, tell us—we’re building it with you.\n\nCome say hi! What setting do you work in, and what’s one thing you’d love help with right now?",
  category:'discussions', pinned:true, canDelete:false, createdAt:'2026-09-23T00:00:00.000Z', replies:[]
};
let posts = [], serial = 0, failWrite = false, failRead = false, paginate = false;
const requests = [], reports = [], reads = [];
const MIME = { html:'text/html', js:'text/javascript', css:'text/css', svg:'image/svg+xml', png:'image/png', webp:'image/webp', woff2:'font/woff2' };
const server = createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  const who = /communityAccount=blair/.test(req.headers.cookie || '') ? 'blair' : 'alex';
  const json = (value, status=200) => { res.writeHead(status, {'content-type':'application/json'}); res.end(JSON.stringify(value)); };
  let raw = ''; req.on('data', value => raw += value); req.on('end', () => {
    let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch { return json({ok:false},400); }
    if (url.pathname === '/api/slp/auth/me') return json(accounts[who]);
    if (url.pathname === '/api/slp') return json({ok:true,configured:true,kids:[],invites:[]});
    if (url.pathname === '/api/slp/community') {
      if (req.method === 'GET') {
        reads.push({who,category:url.searchParams.get('category')});
        if (failRead) return json({ok:false,error:'Community temporarily unavailable. Please try again.'},503);
        const category = url.searchParams.get('category');
        const matching = posts.filter(p => !category || category === 'all' || p.category === category);
        const offset = Number(url.searchParams.get('cursor') || 0), limit = paginate ? 1 : matching.length;
        const publicPost = p => ({...p,canDelete:!p.pinned&&p.owner===who,replies:p.replies.map(r => ({...r,canDelete:r.owner===who}))});
        return json({ok:true,pinned:[publicPost(welcome)],posts:matching.slice(offset,offset+limit).map(publicPost),nextCursor:offset+limit<matching.length?String(offset+limit):null});
      }
      requests.push({who,method:req.method,body});
      if (failWrite) { failWrite = false; return json({ok:false,error:'Could not save. Please try again.'},503); }
      if (req.method === 'POST' && body.action === 'post') {
        posts.unshift({id:'p'+(++serial),owner:who,author:accounts[who].name,title:body.title,text:body.text,category:body.category,createdAt:new Date().toISOString(),replies:[]});
        return json({ok:true});
      }
      const post = [welcome,...posts].find(p => p.id === body.postId);
      if (req.method === 'POST' && body.action === 'reply' && post) {
        post.replies.push({id:'r'+(++serial),owner:who,author:accounts[who].name,text:body.text,createdAt:new Date().toISOString()});
        return json({ok:true});
      }
      if (req.method === 'POST' && body.action === 'report' && post) { reports.push({who,...body}); return json({ok:true}); }
      if (req.method === 'DELETE' && post) {
        if (body.replyId) {
          const reply = post.replies.find(r => r.id === body.replyId);
          if (!reply || reply.owner !== who) return json({ok:false},403);
          post.replies = post.replies.filter(r => r.id !== body.replyId);
        } else {
          if (post.pinned || post.owner !== who) return json({ok:false},403);
          posts = posts.filter(p => p.id !== body.postId);
        }
        return json({ok:true});
      }
      return json({ok:false,error:'Unsupported test request'},400);
    }
    if (url.pathname.startsWith('/api/')) return json({ok:true});
    const file = url.pathname === '/slp.html' ? HTML : ROOT + url.pathname;
    if (!existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'content-type':MIME[file.split('.').pop()] || 'application/octet-stream'}); res.end(readFileSync(file));
  });
});
await new Promise(resolve => server.listen(PORT,'127.0.0.1',resolve));
const browser = await chromium.launch(launchOpts());
let checks=0, failures=0;
const errors=[];
function ok(label, pass, detail='') { checks++; if (!pass) failures++; console.log((pass?'PASS ':'FAIL ')+label+(!pass&&detail?' -> '+detail:'')); }
async function open(who, width=1440) {
  const ctx = await browser.newContext({viewport:{width,height:900}});
  await ctx.addCookies([{name:'communityAccount',value:who,url:'http://127.0.0.1:'+PORT}]);
  const page = await ctx.newPage(); page.setDefaultTimeout(4000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept(dialog.type()==='prompt'?'Off topic':undefined));
  await page.goto('http://127.0.0.1:'+PORT+'/slp.html#community');
  await page.waitForFunction(name => document.getElementById('sidebarName').textContent === name,accounts[who].name);
  return {ctx,page};
}
async function waitText(page, text) { await page.waitForFunction(text => document.getElementById('communityFeed').textContent.includes(text),text); }
async function post(page,title,text,category='discussions') {
  await page.locator('#communityNew').click();
  await page.locator('#communityCategory').selectOption(category);
  await page.locator('#communityTitle').fill(title); await page.locator('#communityText').fill(text);
  await page.locator('#communityEditor button[type=submit]').click();
}
const article = (page,title) => page.locator('.community-post').filter({has:page.getByRole('heading',{name:title,exact:true})});
const pin = page => page.locator('#communityPinned .community-post');
async function waitPinText(page, text) { await page.waitForFunction(text => document.getElementById('communityPinned').textContent.includes(text),text); }
async function replyToWelcome(page, text) {
  const toggle = page.locator('[data-community-reply="'+welcome.id+'"]');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  const form = page.locator('[data-community-reply-form="'+welcome.id+'"]');
  await form.locator('textarea').fill(text); await form.locator('button[type=submit]').click();
  await waitPinText(page,text);
}
async function welcomeIsFirst(page) {
  return page.evaluate(() => {
    const pinned = document.querySelector('#communityPinned .community-post');
    const compose = document.getElementById('communityCompose');
    const feed = document.getElementById('communityFeed');
    return !!(pinned && compose && feed && pinned.getBoundingClientRect().bottom <= compose.getBoundingClientRect().top && (pinned.compareDocumentPosition(feed) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
}
async function refresh(page) { await page.locator('#communityRefresh').click(); }
try {
  const a = await open('alex'), b = await open('blair');
  const visibleA = await a.page.locator('#page-community').isVisible();
  const visibleB = await b.page.locator('#page-community').isVisible();
  ok('existing SLP gets Community without preview flags',visibleA && await a.page.locator('[data-page=community]').isVisible());
  ok('new SLP gets Community before creating a caseload',visibleB && await b.page.locator('[data-page=community]').isVisible());
  // An old dashboard must fail immediately, rather than timing out on every
  // missing live-community control. SLP_TEST_HTML runs this against old HTML.
  if (visibleA && visibleB) {
    await a.page.waitForFunction(() => !document.getElementById('communityFeed').textContent.includes('Loading'));
    await b.page.waitForFunction(() => !document.getElementById('communityFeed').textContent.includes('Loading'));
    ok('both accounts load the shared community automatically',reads.some(r=>r.who==='alex')&&reads.some(r=>r.who==='blair'));
    ok('empty ordinary feed has no invented starter posts',await a.page.locator('#communityFeed .community-post').count()===0);
    const welcomeReady = await pin(a.page).count()===1 && await pin(b.page).count()===1;
    ok('existing and new SLPs see the single approved Rachel welcome',welcomeReady && await article(a.page,welcome.title).count()===1 && await article(b.page,welcome.title).count()===1);
    ok('welcome is visibly pinned above the composer',welcomeReady && await pin(a.page).evaluate(el => el.classList.contains('community-pinned')) && await welcomeIsFirst(a.page));
    ok('ordinary SLPs cannot delete the pinned welcome',welcomeReady && await a.page.locator('[data-community-delete="'+welcome.id+'"]:not([data-reply-id])').count()===0 && await b.page.locator('[data-community-delete="'+welcome.id+'"]:not([data-reply-id])').count()===0);
    ok('the approved welcome is the only initial community post',welcomeReady && await a.page.locator('.community-post').count()===1 && (await pin(a.page).innerText()).includes(welcome.text) && (await pin(a.page).locator('.community-post-header').innerText()).includes('Rachel'));
    // Skip only welcome-dependent actions for old HTML, so the regression proof
    // reports missing behavior immediately and still runs the ordinary feed checks.
    if (welcomeReady) {
      await replyToWelcome(a.page,'Happy to be here — Alex.');
      await b.page.reload(); await waitPinText(b.page,'Happy to be here — Alex.');
      await replyToWelcome(b.page,'Hi Rachel and Alex! — Blair.');
      ok('existing and new SLPs can reply to the same pinned welcome',welcome.replies.length===2 && welcome.replies.some(r=>r.owner==='alex') && welcome.replies.some(r=>r.owner==='blair'));
      await a.page.reload(); await waitPinText(a.page,'Hi Rachel and Alex! — Blair.');
      await a.page.locator('[data-community-reply="'+welcome.id+'"]').click();
      await b.page.reload(); await waitPinText(b.page,'Happy to be here — Alex.');
      await b.page.locator('[data-community-reply="'+welcome.id+'"]').click();
      ok('both welcome replies are visible to both accounts after reload',(await pin(a.page).innerText()).includes('Happy to be here — Alex.') && (await pin(a.page).innerText()).includes('Hi Rachel and Alex! — Blair.') && (await pin(b.page).innerText()).includes('Happy to be here — Alex.') && (await pin(b.page).innerText()).includes('Hi Rachel and Alex! — Blair.'));
    }
    ok('load more is hidden when no next page exists',!(await a.page.locator('#communityMore').isVisible()));
    ok('community contains no preview or placeholder promises',!/interactive preview|starter posts|only visible here|nothing is shared/i.test(await a.page.locator('#page-community').innerText()));
    ok('affiliate partnerships is a live sidebar tab (coming 2027)',await a.page.locator('[data-page=affiliate]').isVisible());

    await post(a.page,'Question from Alex','A practical question for fellow SLPs.');
    await waitText(a.page,'Question from Alex');
    ok('publishing writes the authenticated shared API',posts.length===1&&posts[0].owner==='alex');
    ok('new conversations remain below the single pinned welcome',await pin(a.page).count()===1 && await article(a.page,welcome.title).count()===1 && await welcomeIsFirst(a.page));
    await refresh(b.page); await waitText(b.page,'Question from Alex');
    ok('another SLP can read a newly published post',await article(b.page,'Question from Alex').count()===1);
    const id=posts[0].id;
    ok('other SLP cannot delete someone else’s post',await b.page.locator('[data-community-delete="'+id+'"]').count()===0);
    await b.page.locator('[data-community-reply="'+id+'"]').click();
    await b.page.locator('[data-community-reply-form="'+id+'"] textarea').fill('A reply from Blair.');
    await b.page.locator('[data-community-reply-form="'+id+'"] button[type=submit]').click();
    await waitText(b.page,'A reply from Blair.');
    await a.page.reload(); await waitText(a.page,'Question from Alex');
    await a.page.locator('[data-community-reply="'+id+'"]').click(); await waitText(a.page,'A reply from Blair.');
    ok('shared replies survive reload and are readable by the author',await article(a.page,'Question from Alex').innerText().then(t=>t.includes('A reply from Blair.')));
    await b.page.locator('[data-community-report="'+id+'"]:not([data-reply-id])').click();
    await b.page.waitForTimeout(120);
    ok('report sends a server request for the correct post',reports.some(r=>r.postId===id&&r.who==='blair'));
    const replyId=posts[0].replies[0].id;
    await b.page.locator('[data-community-delete="'+id+'"][data-reply-id="'+replyId+'"]').click();
    await b.page.waitForFunction(text=>!document.getElementById('communityFeed').textContent.includes(text),'A reply from Blair.');
    ok('reply authors can delete their own reply',posts[0].replies.length===0);

    await post(a.page,'Resource exchange','A general resource idea.','resources'); await waitText(a.page,'Resource exchange');
    await a.page.locator('[data-community-filter=resources]').click();
    await a.page.waitForTimeout(120);
    ok('topic filter shows matching shared posts only',await a.page.locator('#communityFeed .community-post').count()===1&&(await a.page.locator('#communityFeed').innerText()).includes('Resource exchange'));
    await a.page.locator('[data-community-filter=cf]').click(); await a.page.waitForTimeout(120);
    ok('empty topic does not display unrelated posts',await a.page.locator('#communityFeed .community-post').count()===0);
    ok('welcome stays visible when changing to an empty topic',await pin(a.page).count()===1 && await pin(a.page).isVisible() && await welcomeIsFirst(a.page));
    await a.page.locator('[data-community-filter=all]').click(); await waitText(a.page,'Question from Alex');

    failWrite=true;
    await post(a.page,'Retained draft','Keep this writing after a failed save.');
    await a.page.waitForFunction(()=>/could|unable|try|failed|unavailable/i.test(document.getElementById('communityPostStatus').textContent));
    ok('failed post preserves title and text',await a.page.locator('#communityTitle').inputValue()==='Retained draft'&&await a.page.locator('#communityText').inputValue()==='Keep this writing after a failed save.');
    ok('failed post shows an error without pretending to publish',await a.page.locator('#communityPostStatus').isVisible()&&!posts.some(p=>p.title==='Retained draft'));
    await a.page.locator('#communityEditor button[type=submit]').click(); await waitText(a.page,'Retained draft');
    ok('post can be retried after failure',posts.filter(p=>p.title==='Retained draft').length===1);
    const retryId=posts.find(p=>p.title==='Retained draft').id;
    await a.page.locator('[data-community-reply="'+retryId+'"]').click();
    const replyForm=a.page.locator('[data-community-reply-form="'+retryId+'"]');
    await replyForm.locator('textarea').fill('Keep my reply draft.'); failWrite=true;
    await replyForm.locator('button[type=submit]').click(); await a.page.waitForTimeout(150);
    ok('failed reply keeps its draft',await replyForm.locator('textarea').inputValue()==='Keep my reply draft.');
    ok('failed reply has a visible error',/could|unable|try|failed|unavailable/i.test(await article(a.page,'Retained draft').innerText()));
    await replyForm.locator('button[type=submit]').click(); await waitText(a.page,'Keep my reply draft.');

    failRead=true; await refresh(a.page); await a.page.waitForTimeout(150);
    ok('read failure shows an error',/could|unable|try|failed|unavailable/i.test(await a.page.locator('#communityStatus').innerText()));
    ok('read failure keeps already loaded posts',await article(a.page,'Retained draft').count()===1);
    failRead=false; await refresh(a.page); await waitText(a.page,'Retained draft');

    const attack='<img src=x onerror="window.communityInjected=1">';
    const longText='LongResourceLink'+('x'.repeat(240));
    await post(a.page,attack,'Text <script>window.communityInjected=2</script> '+longText); await waitText(a.page,attack);
    const malicious=posts[0]; malicious.author='<svg onload="window.communityInjected=3">';
    await refresh(b.page); await waitText(b.page,attack);
    ok('post text, title and author render as text rather than HTML',await b.page.locator('#communityFeed img,#communityFeed script,#communityFeed svg').count()===0&&!(await b.page.evaluate(()=>window.communityInjected)));
    ok('writes include a retry-safe request identifier',requests.filter(r=>r.method==='POST').every(r=>typeof r.body.requestId==='string'&&r.body.requestId.length>0));
    ok('community writes do not include caseload or email data',requests.every(r=>!Object.keys(r.body).some(k=>/email|child|caseload|clinic|author/i.test(k))));

    for (const width of [390,320]) {
      await a.page.setViewportSize({width,height:900});
      await a.page.waitForTimeout(250);
      await a.page.locator('#communityNew').click();
      const dimensions=await a.page.evaluate(()=>({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
      ok('Community has no horizontal overflow at '+width,dimensions.document<=dimensions.viewport+1&&dimensions.body<=dimensions.viewport+1,JSON.stringify(dimensions));
      await a.page.locator('#communityCancel').click();
    }
    await a.page.setViewportSize({width:1440,height:900});
    await a.page.locator('[data-community-delete="'+id+'"]:not([data-reply-id])').click();
    await a.page.waitForFunction(title=>!document.getElementById('communityFeed').textContent.includes(title),'Question from Alex');
    await refresh(b.page); await b.page.waitForFunction(title=>!document.getElementById('communityFeed').textContent.includes(title),'Question from Alex');
    ok('author deletion removes the post for everyone',!posts.some(p=>p.id===id));
    paginate=true; await refresh(a.page);
    await a.page.waitForFunction(()=>document.querySelectorAll('#communityFeed .community-post').length===1);
    ok('load more appears when another page exists',await a.page.locator('#communityMore').isVisible());
    await a.page.locator('#communityMore').click();
    await a.page.waitForFunction(()=>document.querySelectorAll('#communityFeed .community-post').length===2);
    ok('loading another page appends posts and hides exhausted pagination',await a.page.locator('#communityFeed .community-post').count()===2&&!(await a.page.locator('#communityMore').isVisible()));
    ok('pagination preserves exactly one welcome above newer posts',await pin(a.page).count()===1 && await article(a.page,welcome.title).count()===1 && await pin(a.page).isVisible() && await welcomeIsFirst(a.page));
    if (OUT) {
      // Capture readable examples after the hostile-string layout checks above.
      paginate=false; malicious.author='Alex'; malicious.title='Ideas for a busy week'; malicious.text='What small changes have helped you make time for planning? I would love to hear what works for you.';
      mkdirSync(OUT,{recursive:true});
      for (const width of [1440,390,320]) {
        const shot=await open('alex',width); await waitText(shot.page,'Ideas for a busy week');
        await shot.page.waitForTimeout(250);
        await shot.page.screenshot({path:OUT+'/community-'+(width===1440?'desktop':width)+'.png',fullPage:true});
        await shot.ctx.close();
      }
    }
    ok('no browser exceptions',errors.length===0,errors.join('; '));
  }
} catch(error) { ok('community flow completes',false,String(error.stack||error)); }
finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
console.log(JSON.stringify({checks,failures})); process.exitCode=failures?1:0;
