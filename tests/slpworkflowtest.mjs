// Local synthetic UI checks for the SLP workflow additions. Never contacts Sona.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { chromium, ROOT, launchOpts } from './_env.mjs';
const project = ROOT.replace(/\/public$/, '');
const source = readFileSync(project+'/tests/slptest.mjs','utf8');
const fixtureCode = source.slice(source.indexOf('const day ='),source.indexOf('// ── mock API:'));
const fixture = () => runInNewContext(fixtureCode+'\nfixture();',{Date});
const htmlPath = process.env.SLP_HTML || ROOT+'/slp.html';
const port = 8187;
const account = {ok:true,email:'rachel@example.com',code:'rachel-k4',familyKey:'ABCD2345',name:'Rachel K',clinic:'Bright Steps',onboarded:true};
const mime = {html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',webp:'image/webp',woff2:'font/woff2'};
let data=fixture(), posts=[], reads=[], failHw=false, failFeedback=false, delayHw=0, nextHw=0;
const server = createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'); let body='';
  req.on('data',c=>body+=c);req.on('end',()=>{
    let payload={};try{payload=JSON.parse(body||'{}');}catch{}
    const json=(value,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
    if(url.pathname.startsWith('/api/')){
      if(req.method==='GET')reads.push(url.pathname);else posts.push({path:url.pathname,body:payload});
      if(url.pathname==='/api/slp/auth/me'||url.pathname==='/api/slp/account')return json(account);
      if(url.pathname==='/api/slp')return json({ok:true,configured:true,kids:data.kids,invites:data.invites});
      if(url.pathname==='/api/slp/homework'){
        if(req.method==='GET')return json({ok:true,items:data.kids.map(k=>({childId:k.childId,...k.hw}))});
        const respond=()=>{
          if(failHw)return json({ok:false,error:'Synthetic assignment failure'},503);
          const kid=data.kids.find(k=>k.childId===payload.childId);
          if(!kid)return json({ok:false,error:'Child not found'},404);
          kid.hw={status:'active',hw:{...payload.hw,id:'check'+(++nextHw),by:account.name},days:{}};
          return json({ok:true,hw:kid.hw.hw,aboveNorm:[]});
        };
        if(delayHw)return setTimeout(respond,delayHw);return respond();
      }
      if(url.pathname==='/api/slp/feedback')return failFeedback?json({ok:false,error:'Synthetic feedback failure'},503):json({ok:true,received:true,replyEmail:account.email});
      return json({ok:true});
    }
    const path=url.pathname==='/slp.html'?htmlPath:ROOT+url.pathname;
    if(!existsSync(path)){res.writeHead(404);return res.end();}
    res.writeHead(200,{'content-type':mime[path.split('.').pop()]||'application/octet-stream'});res.end(readFileSync(path));
  });
});
await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
const browser=await chromium.launch(launchOpts());
let checks=0,failures=0;
function ok(name,result,detail=''){checks++;if(!result)failures++;console.log((result?'PASS ':'FAIL ')+name+(!result&&detail?' :: '+detail:''));}
const visible=async(pg,selector)=>await pg.locator(selector).count()>0&&await pg.locator(selector).first().isVisible();
const exists=async(pg,selector)=>await pg.locator(selector).count()>0;
const writes=path=>posts.filter(p=>!path||p.path===path);
function reset(){data=fixture();posts=[];reads=[];failHw=false;failFeedback=false;delayHw=0;}
async function open(hash='#today',width=1440){
  const ctx=await browser.newContext({viewport:{width,height:1000}}),pg=await ctx.newPage(),errors=[];
  pg.setDefaultTimeout(2200);pg.on('pageerror',e=>errors.push(e.message));
  await pg.addInitScript(()=>{window.__copied=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:s=>(window.__copied.push(s),Promise.resolve())}});window.confirm=()=>true;});
  await pg.goto('http://127.0.0.1:'+port+'/slp.html'+hash);await pg.waitForFunction(()=>document.getElementById('sidebarName').textContent==='Rachel K');await pg.waitForTimeout(100);
  return {ctx,pg,errors};
}
async function section(name,fn){reset();try{await fn();}catch(e){ok(name+' completes',false,e.message.slice(0,220));}}
async function go(pg,hash){await pg.evaluate(hash=>location.hash=hash,hash);await pg.waitForTimeout(100);}
const text=async(pg,selector)=>await exists(pg,selector)?await pg.locator(selector).textContent():'';
const date=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
try {
  await section('Feedback and call request',async()=>{
    const {ctx,pg}=await open('#feedback');
    ok('feedback and call are explicit modes',await exists(pg,'#fbModeFeedback')&&await exists(pg,'#fbModeCall'));
    if(!await exists(pg,'#fbModeCall')){await ctx.close();return;}
    const intro=await text(pg,'#page-feedback');
    ok('feedback introduces Rachel as Clinical Fellow',/Rachel/.test(intro)&&/Clinical Fellow|CF.SLP|CF year/i.test(intro),intro);
    ok('normal feedback keeps call scheduling fields hidden',!await visible(pg,'#callFields'));
    await pg.locator('#fbTopic').selectOption('dashboard');await pg.locator('#fbText').fill('The child switcher is useful.');await pg.locator('#fbSend').click();await pg.waitForTimeout(100);
    const fb=writes('/api/slp/feedback').at(-1);
    ok('feedback sends selected scope and supplied text',fb?.body.kind==='feedback'&&fb.body.category==='dashboard'&&fb.body.text==='The child switcher is useful.',JSON.stringify(fb));
    await pg.locator('#fbModeCall').click();ok('call mode reveals availability',await visible(pg,'#callFields'));
    await pg.locator('#fbTopic').selectOption('question');await pg.locator('#fbText').fill('I would love to discuss the project.');await pg.locator('#callAvailability').fill('Tuesday or Thursday after 3 pm');await pg.locator('#fbSend').click();await pg.waitForTimeout(100);
    const call=writes('/api/slp/feedback').at(-1);
    ok('call request includes timing and timezone',call?.body.kind==='call'&&/Thursday/.test(call.body.availability||'')&&!!call.body.timezone,JSON.stringify(call));
    const success=await text(pg,'#fbSuccess');
    ok('call success confirms request, not a booked appointment',await visible(pg,'#fbSuccess')&&/request|reach out|received|in touch/i.test(success)&&!/appointment (is )?booked|call (is )?booked/i.test(success),success);
    ok('reply email is the signed-in account, not a required duplicate field',/rachel@example.com/.test(await text(pg,'#page-feedback')));
    await ctx.close();
  });
  await section('Feedback failure preserves draft',async()=>{
    failFeedback=true;const {ctx,pg}=await open('#feedback');
    if(!await exists(pg,'#fbModeCall')){ok('feedback modes available for failure check',false);await ctx.close();return;}
    await pg.locator('#fbModeCall').click();await pg.locator('#fbText').fill('Keep this draft after a send failure');await pg.locator('#callAvailability').fill('Friday at noon');await pg.locator('#fbSend').click();await pg.waitForTimeout(100);
    ok('failed request retains message and timing',await pg.locator('#fbText').inputValue()==='Keep this draft after a send failure'&&await pg.locator('#callAvailability').inputValue()==='Friday at noon');
    ok('failed request permits retry without showing success',!await pg.locator('#fbSend').isDisabled()&&!await visible(pg,'#fbSuccess'));
    await ctx.close();
  });
  await section('Quick homework current plan',async()=>{
    const {ctx,pg}=await open('#child/c1/homework');
    ok('homework deep link opens quick assignment',await visible(pg,'#quickHomework'));
    if(!await exists(pg,'#quickAssign')){await ctx.close();return;}
    const preview=await text(pg,'#quickPreview');
    ok('quick preview carries existing sound and position',/R/.test(preview)&&/middle/i.test(preview),preview);
    ok('quick assignment starts today and discloses replacement',/replace|replaces|replacing/i.test(await text(pg,'#quickHomework')));
    ok('above-age norm flag is visible before assigning',await visible(pg,'#quickNorm')&&/R/.test(await text(pg,'#quickNorm')));
    delayHw=250;
    await pg.evaluate(()=>{document.getElementById('quickAssign').click();document.getElementById('quickAssign').click();});await pg.waitForTimeout(50);
    ok('repeated click while saving produces only one assignment',writes('/api/slp/homework').length===1,JSON.stringify(writes('/api/slp/homework')));
    await pg.waitForTimeout(400);
    const payload=writes('/api/slp/homework')[0]?.body;
    ok('quick send preserves selected target, position, note and reps',payload?.childId==='c1'&&payload.hw.sounds.join()==='R'&&payload.hw.pos==='m'&&payload.hw.repsPerDay===20&&payload.hw.note==='Two minutes after breakfast is plenty.',JSON.stringify(payload));
    ok('quick send gives 14 inclusive days from today',payload?.hw.start===date(0)&&payload.hw.due===date(13),JSON.stringify(payload?.hw));
    ok('quick send does not resend the old assignment id',!payload?.hw.id,JSON.stringify(payload?.hw));
    await ctx.close();
  });
  await section('Quick homework previous plan and no target',async()=>{
    const {ctx,pg}=await open('#child/c2/homework');
    if(!await exists(pg,'#quickAssign')){ok('quick assignment controls exist',false);await ctx.close();return;}
    await pg.locator('#quickNote').fill('Please practice when it works for your family.');await pg.locator('#quickAssign').click();await pg.waitForTimeout(200);
    const payload=writes('/api/slp/homework').at(-1)?.body;
    ok('repeat preserves clinician word list and position',payload?.hw.sounds.join()==='K'&&payload.hw.pos==='i'&&JSON.stringify(payload.hw.words)==='["cat","key","kite"]',JSON.stringify(payload));
    ok('quick note is included in homework sent to family',payload?.hw.note==='Please practice when it works for your family.');
    await go(pg,'#child/c6/homework');
    ok('child with no known target cannot receive invented homework',await pg.locator('#quickAssign').isDisabled());
    const before=writes('/api/slp/homework').length;await pg.locator('#quickCustomize').click();
    ok('targetless child can explicitly choose homework in composer',await visible(pg,'#composer')&&writes('/api/slp/homework').length===before);
    await ctx.close();
  });
  await section('Assignment failure preserves draft',async()=>{
    failHw=true;const {ctx,pg}=await open('#child/c2/homework');
    if(!await exists(pg,'#quickAssign')){ok('quick controls available for failure check',false);await ctx.close();return;}
    await pg.locator('#quickNote').fill('Keep my note on retry');await pg.locator('#quickAssign').click();await pg.waitForTimeout(150);
    ok('failed homework request retains note and enables retry',await pg.locator('#quickNote').inputValue()==='Keep my note on retry'&&!await pg.locator('#quickAssign').isDisabled());
    ok('failed homework request shows an error',await visible(pg,'#quickErr')&&/fail|couldn|try|error/i.test(await text(pg,'#quickErr')),await text(pg,'#quickErr'));
    await ctx.close();
  });
  await section('Planner and child navigation',async()=>{
    const {ctx,pg,errors}=await open('#child/c1/plan');
    ok('session plan has a deep link',await visible(pg,'#sessionPlanner'));
    if(!await exists(pg,'#planOutline')){await ctx.close();return;}
    await pg.locator('#planFocus').selectOption('continue');await pg.locator('#planMinutes').selectOption('20');await pg.locator('#planQuestion').selectOption('routine');
    const outline=await pg.locator('#planOutline').inputValue();
    ok('planner uses known child context and selected duration',/Mia|R|middle/i.test(outline)&&/20/.test(outline),outline);
    ok('planner cites actual supported position and homework facts',/53% \(n=30\)/.test(outline)&&/74% \(n=70\)/.test(outline)&&/2 of 6 days so far/.test(outline)&&/Last practiced today/.test(outline),outline);
    const draft='My own session plan for Mia.\nAsk what helped home practice.';
    await pg.locator('#planOutline').fill(draft);await pg.locator('#planCopy').click();
    ok('editable plan is copied exactly',await pg.evaluate(()=>window.__copied.at(-1))===draft);
    await pg.locator('#chJump').selectOption('c2');await pg.waitForTimeout(100);
    ok('child jump retains plan tab',await pg.evaluate(()=>location.hash)==='#child/c2/plan'&&await visible(pg,'#sessionPlanner'));
    ok('another child does not inherit the prior child draft',(await pg.locator('#planOutline').inputValue())!==draft);
    await pg.locator('#chJump').selectOption('c1');await pg.waitForTimeout(100);
    ok('returning restores child-specific plan draft',await pg.locator('#planOutline').inputValue()===draft);
    const forward=await pg.locator('#chNext').isDisabled()?'#chPrev':'#chNext';
    const backward=forward==='#chPrev'?'#chNext':'#chPrev';
    await pg.locator(forward).click();await pg.waitForTimeout(100);
    ok('available adjacent child preserves current workspace view',/^#child\/(?!c1\/)[^/]+\/plan$/.test(await pg.evaluate(()=>location.hash)),await pg.evaluate(()=>location.hash));
    await pg.locator(backward).click();await pg.waitForTimeout(100);
    ok('opposite arrow returns without leaving plan tab',await pg.evaluate(()=>location.hash)==='#child/c1/plan');
    await pg.locator('#planHomework').click();await pg.waitForTimeout(100);
    ok('plan-to-homework opens review without automatically assigning',await visible(pg,'#quickHomework')&&writes('/api/slp/homework').length===0);
    ok('planning and copy do not transmit a session plan',posts.length===0,JSON.stringify(posts));
    ok('navigation and plan editing have no runtime errors',errors.length===0,errors.join('; '));await ctx.close();
  });
  for(const width of [390,320])await section('Mobile '+width,async()=>{
    const {ctx,pg,errors}=await open('#feedback',width);
    for(const [hash,selector] of [['#feedback','#page-feedback'],['#child/c1/homework','#quickHomework'],['#child/c1/plan','#sessionPlanner']]){
      await go(pg,hash);ok(hash+' visible at '+width,await visible(pg,selector));
      const dims=await pg.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
      ok(hash+' fits viewport at '+width,dims.scroll<=dims.width+1&&dims.body<=dims.width+1,JSON.stringify(dims));
    }
    ok('mobile pages have no runtime errors at '+width,errors.length===0,errors.join('; '));await ctx.close();
  });
} finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
console.log(JSON.stringify({checks,failures,htmlPath}));process.exitCode=failures?1:0;
