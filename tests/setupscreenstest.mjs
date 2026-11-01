// PLAY STUDIO: approved onboarding, 24 Oct 2026. The real purchase, privacy,
// native-keyboard and setup state contracts stay; the old intro/slideshow is
// replaced by a short hello and two silent comparisons (since 31 Oct 2026 the
// one-message problem slide is gone: its words, "Speech practice. Through
// play.", head the Fruit Slice demo, which the hello now opens).
// These demos never listen, speak, grant practice credit or play off screen.
// Reminder eligibility and store timing remain covered below.
import {createServer} from 'http';
import {readFileSync,existsSync,statSync} from 'fs';
import path from 'path';
import {chromium,ROOT,launchOpts} from './_env.mjs';
import {calm,setupWalk} from './_phone.mjs';
const root=process.env.SONATEST_PUBLIC_ROOT||ROOT,PORT=8238,base='http://127.0.0.1:'+PORT;
const mime={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',webp:'image/webp',woff2:'font/woff2',wav:'audio/wav',mp4:'video/mp4',json:'application/json',webmanifest:'application/manifest+json'};
const server=createServer((req,res)=>{const u=new URL(req.url,base),file=path.join(root,decodeURIComponent(u.pathname));if(u.pathname.startsWith('/api/')){res.writeHead(503,{'content-type':'application/json'});res.end('{}');return;}if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':mime[file.split('.').pop()]||'application/octet-stream'});res.end(readFileSync(file));});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const browser=await chromium.launch(launchOpts());let checks=0,failures=0;
function ok(name,pass,detail=''){checks++;if(!pass)failures++;console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' → '+JSON.stringify(detail)));}
async function scenario(name,fn){try{await fn();}catch(e){ok(name+' completes without a page/harness error',false,e.stack);}}
const RACHEL='Built with Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship.';
// The phone's edges, as onboardingtest's: a microphone that records asks, and
// every recording Sona would play written down (mediaPCM) instead. cfg.notify:
// the iPhone's reminder methods ({state, ask:'granted'|'denied'|'hang'}), or
// none (a build without them); with them, the store's answer (Sona.storePlan):
// cfg.plan, a Plan as sona.js hands one (free days for a new subscriber by
// default), 'hang' (never answers) or {late:ms, plan}; and cfg.refresh, iOS's
// own word read afresh (Sona.notifyRefresh, NOTIFY1): {to, ms} or 'hang'.
// cfg.webSales: a phone where the price follows.
function edges(cfg){
  try{localStorage.getItem('x');}catch(e){return;}
  const h=window.__s={media:[],stops:0,asks:0,mics:0,notifyAsks:0,plans:0,refresh:0,frames:{},ready:false};
  document.addEventListener('DOMContentLoaded',()=>{h.ready=true;});
  const clear=CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.clearRect=function(){const host=this.canvas.parentElement;if(host&&host.id)h.frames[host.id]=(h.frames[host.id]||0)+1;return clear.apply(this,arguments);};
  let hidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});
  h.background=()=>{hidden=true;document.dispatchEvent(new Event('visibilitychange'));};
  h.foreground=()=>{hidden=false;document.dispatchEvent(new Event('visibilitychange'));};
  const FREE={state:'free',kind:'monthly',price:'$9.99',per:'month',free:{n:3,unit:'day',text:'3 days'},sure:true,why:'',year:null};
  navigator.mediaDevices.getUserMedia=()=>{h.mics++;return new Promise(()=>{});};
  let sona;
  Object.defineProperty(window,'Sona',{configurable:true,get:()=>sona,set(v){sona=v;
    v.mediaPCM=(bytes,o)=>{h.media.push({len:bytes&&bytes.byteLength,volume:o&&o.volume,head:Array.from(new Uint8Array(bytes.buffer||bytes,bytes.byteOffset||0,8))});let end;const done=new Promise(r=>{end=r;});return {done,stop(){h.stops++;end('stopped');}};};
    v.speak=v.speakNow=()=>{h.spoke=(h.spoke||0)+1;return Promise.resolve();};
    if(cfg.notify){v.notifyAvailable=()=>true;v.notifyState=()=>window.__notifyState||cfg.notify.state;v.notifyAsk=()=>{h.notifyAsks++;if(cfg.notify.ask==='hang')return new Promise(r=>{window.__notifyAnswer=r;});return Promise.resolve(cfg.notify.ask||'granted');};
      const plan=cfg.plan===undefined?FREE:cfg.plan;
      v.storePlan=(o)=>{h.plans++;if(o&&typeof o.onLate==='function')window.__planLate=o.onLate;if(plan==='hang')return new Promise(()=>{});if(plan&&plan.late)return new Promise(r=>setTimeout(()=>r(plan.plan||FREE),plan.late));return Promise.resolve(plan);};
      if(cfg.refresh)v.notifyRefresh=()=>{h.refresh++;if(cfg.refresh==='hang')return new Promise(()=>{});return new Promise(r=>setTimeout(()=>{window.__notifyState=cfg.refresh.to;r(cfg.refresh.to);},cfg.refresh.ms||300));};}
    if(cfg.media)v.voiceAsMedia=()=>true;
    Object.keys(v.sfx||{}).forEach(k=>{if(typeof v.sfx[k]==='function')v.sfx[k]=()=>{};});}});
  if(cfg.webSales)try{sessionStorage.setItem('sona.websalesui','1');}catch(e){}
  if(!localStorage.getItem('__seeded')){localStorage.setItem('__seeded','1');
    ['sona.freeera2.v1','sona.freeera3.v1','sona.freeera4.v1','sona.freeera5.v1'].forEach(k=>localStorage.setItem(k,'done'));localStorage.setItem('sona.freeera.v1','post');localStorage.setItem('sona.freever.v1','post');localStorage.setItem('sona.buddyset.v1','post');
    localStorage.setItem('sona.profile.v1',JSON.stringify(Object.assign({voiceOn:true,soundOn:false,volume:0.7},cfg.profile||{})));}
}
async function fresh(cfg={}){
  const context=await browser.newContext({viewport:cfg.viewport||{width:390,height:844},reducedMotion:cfg.motion?'no-preference':'reduce',isMobile:!!cfg.touch,hasTouch:!!cfg.touch});
  await context.addInitScript(edges,cfg);
  const requests=[];context.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(!u.href.startsWith(base+'/'))return route.abort();return route.continue();});
  for(const [glob,body] of [['**/subscribe.html**','<p>price</p>'],['**/today.html','<p>home</p>'],['**/arcade-*.html','<p>game</p>'],['**/charge.html?**','<p>practice</p>']])await context.route(glob,r=>r.fulfill({status:200,contentType:'text/html',body}));
  if(cfg.routes)for(const [glob,fn] of cfg.routes)await context.route(glob,fn);
  const page=await context.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(cfg.init)await context.addInitScript(cfg.init);
  await page.goto(base+'/onboarding.html',{waitUntil:cfg.waitUntil||'load'});if(cfg.waitUntil!=='commit')await page.evaluate(()=>document.fonts.ready);
  return {context,page,errors,requests};
}
const screen=page=>page.evaluate(()=>document.body.dataset.setupScreen);
async function next(page){await calm(page);await page.locator('#nextBtn').click();}
function clean(name,errors){ok(name+': no runtime errors',errors.length===0,errors);}


// ── THE HELLO ──
// SETUP MAKES NO SOUND (Travis, 23 Oct 2026: "turn the sound off when they
// press the buttons in the onboarding"; "Hear Echo" went with the reel's redo
// the same day): no tap chime, no recording, no voice anywhere in setup's
// script, and the shared voice cache (arcade-sayit.js) not even loaded
{const raw=readFileSync(root+'/onboarding.html','utf8'),src=raw.replace(/<!--[\s\S]*?-->/g,'').replace(/\/\/[^\n]*/g,''),hit=re=>(src.match(new RegExp('[^\\n]*'+re.source+'[^\\n]*'))||[''])[0].slice(0,160);
 ok('setup\'s buttons make no sound: no Sona.sfx call anywhere in setup\'s script',!/sfx\s*\.|sfx\s*\(/.test(src),hit(/sfx/));
 ok('…and setup plays nothing at all: no Sona.mediaPCM, no SayIt, no speechSynthesis, no speak(), no <audio>, and arcade-sayit.js is not loaded',!/mediaPCM|SayIt|speechSynthesis|\.speak(Now)?\s*\(|<audio|new\s+Audio\s*\(/.test(src)&&!/arcade-sayit\.js/.test(raw),[hit(/mediaPCM|SayIt|speechSynthesis|speak|audio|Audio/),/arcade-sayit/.test(raw)]);}
if(process.env.SONA_SETUP_CONTRACT_ONLY!=='1'){
// A parent can reach a preview while its deferred artwork code is still
// downloading. When that code arrives, the scene must start by itself.
await scenario('a slow-loading demo starts when its deferred library arrives',async()=>{
 let release=null;
 const routes=[['**/onboarding-fruit-demo.js',r=>new Promise(done=>{release=async()=>{await r.continue();done();};})]];
 // QA-only red proof: serve the exact current page with just the ready hook
 // removed. All rendering, state and deferred-library bytes remain the same.
 if(process.env.SONA_SETUP_RACE_WITHOUT_HOOK==='1')routes.push(['**/onboarding.html',r=>{const html=readFileSync(root+'/onboarding.html','utf8'),without=html.replace(/    document\.addEventListener\("DOMContentLoaded",function\(\)\{if\(!finished\)paintDemo\(ORDER\[idx\]\);\}\);\n/,'');if(without===html)throw new Error('ready-hook red proof did not remove the hook');return r.fulfill({contentType:'text/html',body:without});}]);
 const {context,page,errors}=await fresh({motion:true,waitUntil:'commit',routes});try{
  await page.waitForFunction(()=>window.draft&&document.body.dataset.setupScreen==='welcome');
  // (the name comes straight after the hello since 1 Nov 2026, then Fruit)
  await next(page);await page.locator('[data-step="name"].on').waitFor();
  await page.locator('#obName').fill('Mia');await calm(page);await page.locator('#obAge [data-age="8"]').click();
  await next(page);await page.locator('[data-step="reel"].on').waitFor();
  const before=await page.evaluate(()=>({frames:__s.frames.fruitDemoScene||0,lib:!!window.SonaFruitDemo,loading:document.readyState,ready:__s.ready,profile:JSON.stringify(Sona.getProfile()),mics:__s.mics}));
  ok('the parent reached Fruit before the delayed library: no frames or microphone yet',!!release&&before.frames===0&&!before.lib&&!before.ready&&before.mics===0,before);
  await release();release=null;await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(()=>(__s.frames.fruitDemoScene||0)>2,null,{timeout:1600}).catch(()=>{});
  const after=await page.evaluate(()=>({frames:__s.frames.fruitDemoScene||0,profile:JSON.stringify(Sona.getProfile()),mics:__s.mics,screen:document.body.dataset.setupScreen}));
  ok('the preview starts as the library arrives, without a toggle or backgrounding; profile and microphone stay untouched',after.frames>2&&after.profile===before.profile&&after.mics===0&&after.screen==='reel',after);
  clean('delayed preview',errors);
 }finally{if(release)await release().catch(()=>{});await context.close();}
});
if(process.env.SONA_SETUP_DEFERRED_ONLY==='1'){
 await browser.close();await new Promise(r=>server.close(r));
 console.log(failures?failures+' FAILURES / '+checks+' assertions':'ALL GREEN — '+checks+' assertions');process.exit(failures?1:0);
}

}

// Run the same approved-contract regression alone against a staged pre-fix
// public tree with SONA_SETUP_CONTRACT_ONLY=1 and SONATEST_PUBLIC_ROOT.
await scenario('approved Play Studio contract',async()=>{
 const {context,page,errors}=await fresh();try{
  const c=await page.evaluate(()=>({order:ORDER.join(),minutes:[...document.querySelectorAll('#obMinutes .ask-pick')].map(b=>b.dataset.val),picked:draft.minutes,age:document.getElementById('ageLabel').textContent,hello:document.querySelector('.welcome-brand').innerText.replace(/\s+/g,' ').trim()}));
  ok('the first parent is asked the child\'s name and age straight after the hello, then sees the Fruit Slice preview and Rachel (no problem slide, no Piano Tiles preview)',c.order==='welcome,name,reel,rachel,interests,games,therapy,sounds,minutes,updates,ready,mic',c.order);
  ok('…and the problem slide is not on the page at all',await page.evaluate(()=>!document.querySelector('[data-step="problem"]')&&!document.getElementById('problemTitle')&&!document.querySelector('.studio-problem-art')));
  ok('daily practice offers exactly 3, 5 and 10 minutes, with 5 held by default',c.minutes.join()==='3,5,10'&&c.picked==='5',c);
  ok('the approved short welcome and Age label ship in the real app',c.hello==='Little sounds. Big adventures.'&&c.age==='Age',c);
  clean('Play Studio contract',errors);
 }finally{await context.close();}
});
if(process.env.SONA_SETUP_CONTRACT_ONLY==='1'){
 await browser.close();await new Promise(r=>server.close(r));
 console.log(failures?failures+' FAILURES / '+checks+' assertions':'ALL GREEN — '+checks+' assertions');process.exit(failures?1:0);
}

await scenario('the hello: one clear promise, Echo, and an immediately usable button',async()=>{
 for(const motion of [true,false])for(const vp of [{width:390,height:844},{width:320,height:568},{width:768,height:1024}]){
  const {context,page,errors}=await fresh({motion,viewport:vp});try{
   const f=await page.evaluate(()=>{const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return {t:b.top,b:b.bottom,l:b.left,r:b.right};},art=document.querySelector('.studio-welcome-art'),ob=document.querySelector('.ob');return {text:document.querySelector('.welcome-brand').innerText.replace(/\s+/g,' ').trim(),brand:document.querySelector('.studio-brand').getAttribute('aria-label'),echoes:art.querySelectorAll('img').length,hidden:art.getAttribute('aria-hidden'),art:r('.studio-welcome-art'),head:r('.welcome-brand'),btn:r('#nextBtn'),cta:document.getElementById('nextBtn').textContent.trim(),scroll:ob.scrollHeight-ob.clientHeight,sideways:document.documentElement.scrollWidth-innerWidth,w:innerWidth,h:innerHeight,old:!!document.querySelector('.hello'),wait:document.body.classList.contains('hello-wait'),body:getComputedStyle(document.body).backgroundColor,loops:document.querySelector('.step.on').getAnimations({subtree:true}).filter(a=>a.effect.getComputedTiming().endTime===Infinity).length};});
   ok('hello '+vp.width+'×'+vp.height+(motion?' motion':' Reduce Motion')+': one promise and Sona, one decorative Echo, no delayed intro',f.text==='Little sounds. Big adventures.'&&f.brand==='Sona'&&f.echoes===1&&f.hidden==='true'&&!f.old&&!f.wait&&f.loops===0,f);
   ok('…its headline, art and Get started fit without overlap or scrolling; the keyboard corners stay cream',f.head.t>=0&&f.head.b<=f.art.t&&f.art.b<=f.btn.t&&f.art.l>=0&&f.art.r<=f.w&&f.btn.b<=f.h&&f.scroll<=1&&f.sideways<=0&&f.body==='rgb(255, 245, 233)',f);
   await next(page);ok('…Get started works immediately and opens the child\'s name and age (1 Nov 2026: "right after the hello")',await screen(page)==='name');
   await calm(page);await page.locator('#backBtn').click();ok('Back opens the same hello without waiting',await screen(page)==='welcome'&&!await page.evaluate(()=>document.body.classList.contains('hello-wait')));
   await page.evaluate(()=>document.documentElement.classList.add('ob-leaving'));
   ok('the page is held blank while a saved setup returns to its price',await page.evaluate(()=>getComputedStyle(document.querySelector('.ob')).visibility==='hidden'));
   clean('hello '+vp.width,errors);
  }finally{await context.close();}
 }
});

const demoCount=(page,id)=>page.evaluate(id=>__s.frames[id]||0,id);
// the demo's heading (31 Oct 2026), as textContent (the <br> reads as
// nothing): the old problem slide's words, under the kicker "See speech help"
const HEADS={reel:'Speech practice.Through play.'};
// THE DEMO PLAYS ITSELF (Travis, 1 Nov 2026: "make the demo speed buttons
// more clear, and play the slowdown by itself"; Piano Tiles' demo went the
// same day: "just keep fruit slice"): normal speed (3.2 s), the child says
// the sound (1.6 s), the game slowed (3.8 s), round and round; its three
// steps light up as it goes, and a tap on one jumps there
const PHASES=[['Normal speed','Normal speed',false,false],['Normal speed','Your child says “rrrr”',false,true],['Slower!','The game slows down!',true,false]];
const demoState=page=>page.evaluate(()=>{const sc=document.getElementById('fruitDemoScene'),st=sc.closest('.step');return {slow:sc.classList.contains('slow'),say:sc.classList.contains('say'),speed:sc.querySelector('.demo-speed').textContent,message:sc.querySelector('.demo-message').textContent,canvas:sc.querySelector('canvas').dataset.demoSpeed,pressed:[...st.querySelectorAll('[aria-pressed="true"][data-demo-phase]')].map(b=>b.dataset.demoPhase),lit:[...st.querySelectorAll('[data-demo-phase].on')].map(b=>b.dataset.demoPhase)};});
const isPhase=(m,n)=>m.speed===PHASES[n][0]&&m.message===PHASES[n][1]&&m.slow===PHASES[n][2]&&m.say===PHASES[n][3]&&m.canvas===(PHASES[n][2]?'after-practice':'normal')&&JSON.stringify(m.pressed)===JSON.stringify([String(n)])&&JSON.stringify(m.lit)===JSON.stringify([String(n)]);
await scenario('the Fruit Slice demo plays the slowdown by itself: a live, silent preview',async()=>{
 const {context,page,errors,requests}=await fresh({motion:true,webSales:true});try{
  const before=await page.evaluate(()=>({profile:JSON.stringify(Sona.getProfile()),run:sessionStorage.getItem('sona.run.v1')}));
  const id='fruitDemoScene';
  await setupWalk(page,'reel');const t0=Date.now();
  ok('the demo has three steps, in words a parent reads at a glance: normal speed, the child says the sound, the game slows down',await page.evaluate(()=>[...document.querySelectorAll('[data-step="reel"] [data-demo-phase]')].map(b=>b.textContent.trim()).join('|'))==='1Normal speed|2Says “rrrr”|3Slows down');
  ok('it opens on normal speed, the first step lit',isPhase(await demoState(page),0),await demoState(page));
  await calm(page);await page.evaluate(()=>Promise.all([...document.querySelectorAll('.step.on img')].map(i=>i.decode().catch(()=>{}))));
  const a=await demoCount(page,id);await page.waitForTimeout(350);const b=await demoCount(page,id);
  const hd=await page.evaluate(()=>{const st=document.querySelector('[data-step="reel"]'),c=document.querySelector('#fruitDemoScene canvas'),h=st.querySelector('h1');return {role:c.getAttribute('role'),label:c.getAttribute('aria-label'),head:h.textContent,id:h.id,kicker:(st.querySelector('.studio-kicker')||{}).textContent,focus:document.activeElement===h};});
  ok('its canvas paints live frames, with an accessible description of what it shows and the one-message heading under "See speech help"',b-a>=5&&hd.role==='img'&&/slows down/.test(hd.label||'')&&hd.head===HEADS.reel&&hd.id==='reelTitle'&&hd.kicker==='See speech help'&&hd.focus,{a,b,hd});
  // by itself: the child's turn about 3.2 s in, then the game slowed, then round again
  await page.waitForTimeout(Math.max(0,3500-(Date.now()-t0)));
  ok('…by itself, about 3 seconds in: "Your child says “rrrr”", Echo\'s bubble glowing, the game still at normal speed, the second step lit',isPhase(await demoState(page),1),await demoState(page));
  await page.waitForTimeout(Math.max(0,5100-(Date.now()-t0)));
  ok('…then the game slows down: "Slower!", "The game slows down!", the scene ringed and the canvas at its after-practice speed, the third step lit',isPhase(await demoState(page),2),await demoState(page));
  await page.waitForTimeout(Math.max(0,8900-(Date.now()-t0)));
  ok('…then round again to normal speed',isPhase(await demoState(page),0),await demoState(page));
  // a tap on a step jumps there, and it plays on from it
  await calm(page);await page.locator('[data-step="reel"] [data-demo-phase="2"]').click();
  ok('a tap on "Slows down" shows the slowed game at once, with exactly one step pressed',isPhase(await demoState(page),2),await demoState(page));
  await calm(page);await page.locator('[data-step="reel"] [data-demo-phase="0"]').click();
  ok('…and a tap on "Normal speed" goes back to it',isPhase(await demoState(page),0),await demoState(page));
  await page.evaluate(()=>__s.background());const stopped=await demoCount(page,id);await page.waitForTimeout(250);
  ok('backgrounding releases its paint loop',await demoCount(page,id)===stopped,{stopped,now:await demoCount(page,id)});
  await page.waitForTimeout(3600);
  ok('…and its steps do not play on behind the phone\'s back',isPhase(await demoState(page),0),await demoState(page));
  await page.evaluate(()=>__s.foreground());await page.waitForTimeout(250);ok('returning to this screen starts its scene again, at normal speed',await demoCount(page,id)>stopped&&isPhase(await demoState(page),0));
  await next(page);const left=await demoCount(page,id);await page.waitForTimeout(250);ok('leaving the screen stops its loop',await demoCount(page,id)===left,{left,now:await demoCount(page,id)});
  ok('Rachel follows the demo, after the name, with no Piano Tiles demo between',await screen(page)==='rachel'&&await page.evaluate(()=>ORDER.slice(0,4).join()==='welcome,name,reel,rachel'&&!document.querySelector('[data-step="piano"]')));
  const after=await page.evaluate(()=>({profile:JSON.stringify(Sona.getProfile()),run:sessionStorage.getItem('sona.run.v1'),mics:__s.mics,media:__s.media.length,spoke:!!__s.spoke}));
  ok('the preview grants no credit and starts no practice, recording or speech',after.profile===before.profile&&after.run===before.run&&after.mics===0&&after.media===0&&!after.spoke,{before,after});
  ok('the preview fetches local art, never the old clips, voice lines or speech recordings, and no Piano Tiles demo',!requests.some(r=>/\.mp4|\/api\/tts$|\/coach\/|\.wav$|\.mp3$|piano-demo/.test(r.url)),requests.filter(r=>/mp4|tts|coach|wav|mp3|piano/.test(r.url)));
  clean('live preview',errors);
 }finally{await context.close();}
});

await scenario('the new sales screens fit phones and tablets; reduced-motion previews stay still',async()=>{
 for(const vp of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024},{width:1280,height:800}]){
  const {context,page,errors}=await fresh({viewport:vp,webSales:true});try{
   for(const key of ['reel']){
    await setupWalk(page,key);await calm(page);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(150);
    const f=await page.evaluate(()=>{const st=document.querySelector('.step.on'),foot=document.querySelector('.obfoot').getBoundingClientRect(),head=st.querySelector('h1').getBoundingClientRect(),body=st.getBoundingClientRect(),ob=document.querySelector('.ob'),scene=st.querySelector('.demo-scene'),toggle=st.querySelector('.demo-steps'),r=e=>{const b=e.getBoundingClientRect();return {t:b.top,b:b.bottom,l:b.left,r:b.right,h:b.height};};return {head:r(st.querySelector('h1')),body:r(st),foot:r(document.querySelector('.obfoot')),scene:scene?r(scene):null,toggle:toggle?r(toggle):null,scroll:ob.scrollHeight-ob.clientHeight,sideways:document.documentElement.scrollWidth-innerWidth,h:innerHeight,w:innerWidth};});
    ok(key+' fits '+vp.width+'×'+vp.height+': its message and art above Continue, no sideways overflow',f.head.t>=0&&f.body.b<=f.foot.t+1&&f.sideways<=0&&(!f.scene||(f.scene.h>=180&&f.scene.b<=f.toggle.t&&f.toggle.b<=f.foot.t)),f);
    // (the hello opens Fruit since 31 Oct 2026: the problem slide that sat
    // between them is gone, and its message is Fruit's heading)
    ok('the name opens the Fruit Slice demo, headed by the problem slide\'s old message, with no before-and-after rows',await page.evaluate(()=>{const s=document.querySelector('.step.on');return ORDER[ORDER.indexOf('reel')-1]==='name'&&s.querySelector('h1').textContent==='Speech practice.Through play.'&&s.querySelectorAll('.ba-row').length===0&&!document.querySelector('[data-step="problem"]');}));
    ok('…its three steps are each at least 44 px tall and side by side',await page.evaluate(()=>{const bs=[...document.querySelectorAll('.step.on [data-demo-phase]')].map(b=>b.getBoundingClientRect());return bs.length===3&&bs.every(r=>r.height>=44&&r.width>=60)&&bs[0].right<=bs[1].left&&bs[1].right<=bs[2].left&&Math.abs(bs[0].top-bs[2].top)<1;}));
    {const id='fruitDemoScene',a=await demoCount(page,id);await page.waitForTimeout(300);ok(key+' under Reduce Motion paints a still frame without an ongoing loop, under its own heading',a>0&&await demoCount(page,id)===a&&await page.evaluate(w=>document.querySelector('.step.on h1').textContent===w,HEADS[key]),{a,now:await demoCount(page,id)});}
    if(vp.width===390){
     // under Reduce Motion nothing moves: the steps do not play by themselves, and a tap shows that step
     await page.waitForTimeout(3500);
     ok('under Reduce Motion the demo does not play itself: still on normal speed after 3.5 s, no step bar drawn',isPhase(await demoState(page),0)&&await page.evaluate(()=>getComputedStyle(document.querySelector('.step.on [data-demo-phase].on'),'::after').display==='none'),await demoState(page));
     await calm(page);await page.locator('[data-step="reel"] [data-demo-phase="2"]').click();await page.waitForTimeout(4200);
     ok('…a tap on "Slows down" shows the slowed game, still, and it stays there',isPhase(await demoState(page),2),await demoState(page));
    }
   }
   clean('sales screens fit '+vp.width,errors);
  }finally{await context.close();}
 }
});

// ── EACH SOUND WITH A WORD, AND WHAT THE WEEKLY EMAIL LOOKS LIKE (1 Nov 2026) ──
// The sound picker shows each sound with a word from Sona's own word bank
// (its sound's letters orange); the email step shows the real report's
// lines for the Monday email's made-up child (lib/weekly.ts EXAMPLE, through
// lib/report.ts kidLines), marked "Example", with no child's name.
await scenario('the sound picker shows a word with each sound; the email step shows an example report',async()=>{
 const {context,page,errors}=await fresh({webSales:true});try{
  await setupWalk(page,'sounds',{name:'Zephyrine'});await calm(page);
  const chips=await page.evaluate(()=>[...document.querySelectorAll('#obSounds .sound')].map(b=>{const w=b.querySelector('.sound-word'),first=(Sona.WORDS[b.dataset.sound]||[]).find(x=>(x.pos||'i')==='i')||(Sona.WORDS[b.dataset.sound]||[])[0];return {s:b.dataset.sound,letters:(b.querySelector('.sound-letters')||{}).textContent,word:w?w.textContent:'',want:first?first.w:'',orange:w?[...w.querySelectorAll('b.snd')].map(x=>x.textContent).join(''):'',hidden:w?w.getAttribute('aria-hidden'):null,label:b.getAttribute('aria-label'),h:b.getBoundingClientRect().height};}));
  ok('all nineteen sounds carry a word from Sona\'s word bank (its first start-of-word word), its sound\'s letters orange',chips.length===19&&chips.every(c=>c.word&&c.word===c.want&&c.orange.length>0&&c.word.indexOf(c.orange)>-1),chips.filter(c=>!(c.word&&c.word===c.want&&c.orange)));
  ok('…R reads "R" over "rabbit", its r orange; the voiced TH has no start-of-word word, so it shows its first one, "mother", the th orange',(()=>{const r=chips.find(c=>c.s==='R'),v=chips.find(c=>c.s==='THV');return r.letters==='R'&&r.word==='rabbit'&&r.orange==='r'&&v.word==='mother'&&v.orange==='th';})(),chips.filter(c=>c.s==='R'||c.s==='THV'));
  ok('…a screen reader hears each once: "R, as in rabbit" (the drawn word is hidden from it), the two THs told apart',chips.every(c=>c.hidden==='true'&&/, as in /.test(c.label))&&chips.find(c=>c.s==='TH').label==='TH, unvoiced, as in thumb'&&chips.find(c=>c.s==='THV').label==='TH, voiced, as in mother',chips.map(c=>c.label));
  ok('…every chip still at least 44 px tall, under one line that says what to do',chips.every(c=>c.h>=44)&&await page.evaluate(()=>document.querySelector('[data-step="sounds"] .sound-ask').textContent==='Tap the sounds your child is working on.'));
  await setupWalk(page,'updates');await calm(page);
  const weekly=readFileSync(path.resolve(root,'../lib/weekly.ts'),'utf8'),ex=(weekly.match(/export const EXAMPLE: Kid = \{ d: (\d+), g: (\d+), r: (\d+), p: (\d+), s: \["([A-Z]+)"\] \};/)||[]).slice(1);
  const [d,g,r,pr,snd]=ex,want=ex.length?['Last week on Sona: '+r+' reps','Said their sound out loud on '+d+' days','Reached the daily goal on '+g+' days',r+' reps: '+pr+' in practice, '+(r-pr)+' in games and books','Sound: '+snd]:[];
  const card=await page.evaluate(()=>{const c=document.querySelector('[data-step="updates"] .upd-example');if(!c)return null;const b=c.getBoundingClientRect(),f=document.getElementById('updEmail').getBoundingClientRect();return {subject:c.querySelector('.upd-ex-subject').textContent,lines:[...c.querySelectorAll('.upd-ex-lines li')].map(l=>l.textContent),tag:c.querySelector('.upd-ex-tag').textContent,text:c.textContent,label:c.getAttribute('aria-label'),above:b.bottom<=f.top,shown:b.height>0};});
  ok('the email step shows an example of the weekly email, marked "Example", above the email box',!!card&&card.shown&&card.above&&card.tag==='Example'&&/example/i.test(card.label||''),card);
  ok('…its lines are the real report\'s, word for word, for the Monday email\'s made-up child (lib/weekly.ts EXAMPLE)',!!card&&want.length===5&&JSON.stringify([card.subject,...card.lines])===JSON.stringify(want),{card,want});
  ok('…and no child\'s name, as the real email has none (not even the name just typed)',!!card&&!/Zephyrine|Child 1/.test(card.text),card&&card.text);
  clean('sound words and the email example',errors);
 }finally{await context.close();}
});

// ── SETUP MAKES NO SOUND (23 Oct 2026: no tap chime, and "Hear Echo" gone) ──
await scenario('setup makes no sound: a whole walk, voice on, plays and fetches nothing to play',async()=>{
 const tts=['**/api/tts',r=>r.fulfill({status:200,contentType:'application/octet-stream',headers:{'X-Sona-Voice-Keep':'0'},body:Buffer.alloc(4800,7)})];
 {const {context,page,errors,requests}=await fresh({webSales:true,motion:true,routes:[tts]});try{
  for(const to of ['name','reel','rachel','interests','games','therapy','sounds','minutes','updates','ready']){await setupWalk(page,to);if(to==='reel')await page.waitForTimeout(700);}
  const h=await page.evaluate(()=>({media:__s.media.length,spoke:!!__s.spoke,synth:!!window.speechSynthesis&&window.speechSynthesis.speaking,mics:__s.mics}));
  ok('from the hello to the ready screen nothing plays: no recording, no spoken line, no browser voice, no microphone',h.media===0&&!h.spoke&&!h.synth&&h.mics===0,h);
  ok('…and nothing is fetched to play: no voice line, no take of a sound',!requests.some(r=>/\/api\/tts$|\/coach\/|\.wav$|\.mp3$/.test(r.url)),requests.filter(r=>/tts|coach|\.wav|\.mp3/.test(r.url)).map(r=>r.url));
  ok('…and there is no "Hear Echo" to tap on the reel, nor anywhere in setup',await page.evaluate(()=>!document.getElementById('reelHear')&&![...document.querySelectorAll('button')].some(b=>/Hear Echo/.test(b.textContent))));
  clean('no sound',errors);
 }finally{await context.close();}}
});

// ── RACHEL, ON HER OWN ──
await scenario('Rachel on her own screen: her photo and her line, word for word, once',async()=>{
 for(const vp of [{width:390,height:844},{width:320,height:568}]){
  const {context,page,errors}=await fresh({viewport:vp});try{
   await setupWalk(page,'rachel');await page.locator('[data-step="rachel"].on').waitFor();
   const r=await page.evaluate(async()=>{const st=document.querySelector('[data-step="rachel"]'),img=st.querySelector('img'),vh=st.querySelector('#rachelLine .vh');const seen=st.cloneNode(true);seen.querySelectorAll('[aria-hidden="true"]').forEach(n=>n.remove());return {photo:await img.decode().then(()=>img.naturalWidth,()=>0),src:img.getAttribute('src'),alt:img.alt,line:document.getElementById('rachelLine').textContent,title:document.getElementById('rachelTitle').textContent,pill:st.querySelector('.rachel-pill').textContent,read:seen.textContent.replace(/\s+/g,' ').trim(),hiddenStart:vh?{aria:vh.getAttribute('aria-hidden'),w:vh.getBoundingClientRect().width,h:vh.getBoundingClientRect().height}:null,text:st.innerText,photoBox:img.getBoundingClientRect().width,asks:st.querySelectorAll('input,select,textarea,button,a').length,mascot:getComputedStyle(document.querySelector('.ob .mascot')).display,focus:document.activeElement&&document.activeElement.id};});
   ok('her photo loads, big ('+Math.round(r.photoBox)+' px), named for her',r.photo>0&&/\/rachel-wardrop-profile\.jpg$/.test(r.src)&&r.alt==='Rachel Wardrop'&&r.photoBox>=150,r);
   ok('her line is exactly: '+RACHEL,r.line===RACHEL,r.line);
   ok('…shown once: its first words are the heading, the rest under it, and the start is not drawn or read twice',r.title==='Built with Rachel, MS, CF-SLP,'&&r.read==='Built with Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship. Sona co-founder'&&r.hiddenStart&&r.hiddenStart.aria==='true'&&r.hiddenStart.w<=1&&r.hiddenStart.h<=1,r);
   ok('…with a pill, "Sona co-founder", and nothing else: no question, no Echo, the heading takes focus',r.pill==='Sona co-founder'&&r.asks===0&&r.mascot==='none'&&r.focus==='rachelTitle',r);
   ok('her card names nobody else and claims nothing she is not: no CCC, certified, licensed, plan',!/\bCCC\b|certif|licen[sc]ed|\bplan\b|Travis/i.test(r.text)&&!/Travis/i.test(r.read),r.text);
   clean('rachel '+vp.width,errors);
  }finally{await context.close();}
 }
});

// ── HOW LONG EACH DAY, AND WHAT THE CHILD LOVES ──
await scenario('the minutes are the daily goal; what the child loves is kept as ids',async()=>{
 for(const [mins,reps] of [['3',18],['5',30],['10',60],['skip',null]]){
  const {context,page,errors}=await fresh();try{
   await setupWalk(page,'mic',{name:'Ava',age:'6',minutes:mins,interests:mins==='10'?['music','food']:[]});
   const p=await page.evaluate(()=>({p:Sona.getProfile(),goal:Sona.repGoal(),days:Sona.goalDays()}));
   // the days a week are never asked or written: the default 4 is read (goalDays), not saved
   if(reps)ok(mins+' min a day: the daily goal is '+reps+' reps, the minutes beside it, the days a week not written (the default 4 read)',p.p.dailyGoal===reps&&p.p.dailyMinutes===Number(mins)&&p.goal===reps&&!('weeklyGoal' in p.p)&&p.days===4,p);
   else ok('Skip leaves the daily goal as it was (none saved: the default 30) and the minutes as they were (5)',!('dailyGoal' in p.p)&&p.goal===30&&p.p.dailyMinutes===5&&!('weeklyGoal' in p.p),p);
   ok(mins+': what the child loves is on the profile as the ids picked',JSON.stringify(p.p.interests)===(mins==='10'?'["music","food"]':'[]'),p.p.interests);
   // the microphone screen carries no grown-ups line since 31 Oct 2026 (the
   // promise, Sona.MIC_PROMISE, stays on every mic ask in the games and books)
   if(mins==='5')ok('the microphone screen has no grown-ups line: no #micPromise, and the promise\'s words are not on it',await page.evaluate(()=>{const st=document.querySelector('[data-step="mic"]');return document.body.dataset.setupScreen==='mic'&&!document.getElementById('micPromise')&&!!Sona.MIC_PROMISE&&st.textContent.indexOf(Sona.MIC_PROMISE)<0&&!/never uploaded/i.test(st.textContent);}));
   clean('minutes '+mins,errors);
  }finally{await context.close();}
 }
 // a child set up before (Back from the first game) in a household never
 // asked the questions (no sona.setupasks.v1: set up before 5 Oct 2026; any
 // family set up since walks only hello, name, sounds, ready, microphone):
 // the minutes are asked again, and the goal a grown-up set in Settings stays
 // unless one is picked;
 // what the child loves is not asked, and an older profile's is kept
 for(const [mins,want] of [['skip',100],['10',60]]){
  const {context,page,errors}=await fresh({profile:{childName:'Milo',childAge:'6',focusSounds:['R'],mode:'speech',role:'parent',onboarded:true,dailyGoal:100,interests:['dragons'],email:'mom@example.com'}});try{
   ok('a child set up before walks the questions again, minutes included, with no screen that sells',await page.evaluate(()=>ORDER.join())==='welcome,name,therapy,sounds,minutes,ready,mic');
   await setupWalk(page,'mic',{name:'Milo',minutes:mins});
   const p=await page.evaluate(()=>Sona.getProfile());
   ok('re-walk, '+(mins==='skip'?'Skip':mins+' min')+': the daily goal is '+want+', and the older interests are kept',p.dailyGoal===want&&JSON.stringify(p.interests)==='["dragons"]',p);
   clean('re-walk minutes '+mins,errors);
  }finally{await context.close();}
 }
});

// ── THE REMINDER ASK ──
const NOTIFY={state:'prompt',ask:'granted'};
// read on the price page (a stub with no sona.js): straight from storage
const at=page=>page.evaluate(()=>({path:location.pathname,saved:!!(JSON.parse(localStorage.getItem('sona.profile.v1')||'{}').onboarded),marker:sessionStorage.getItem('sona.setupafter.v1'),gate:sessionStorage.getItem('sona.gate.v1'),asks:localStorage.getItem('__asks'),remind:localStorage.getItem('__remindSeen'),plans:localStorage.getItem('__plans')}));
// how many times iOS was asked on the setup page, kept as it leaves
const COUNT=()=>{addEventListener('pagehide',()=>{try{if(window.__s&&location.pathname==='/onboarding.html'){localStorage.setItem('__asks',String(window.__s.notifyAsks));localStorage.setItem('__remindSeen',window.seenSteps&&window.seenSteps.remind?'1':'0');localStorage.setItem('__plans',String(window.__s.plans));}}catch(e){}});};
await scenario('the reminder ask: only where a reminder can be set and the price follows',async()=>{
 {const {context,page,errors}=await fresh({webSales:true,notify:NOTIFY,init:COUNT});try{
  ok('an iPhone that can set a reminder, never asked, the price to follow: the reminder screen sits between ready and the microphone',await page.evaluate(()=>ORDER.join())==='welcome,name,reel,rachel,interests,games,therapy,sounds,minutes,updates,ready,remind,mic');
  await setupWalk(page,'ready',{name:'Mia'});await next(page);await page.locator('[data-step="remind"].on').waitFor();
  const r=await page.evaluate(()=>{const st=document.querySelector('[data-step="remind"]'),painted=el=>getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0;return {title:document.getElementById('remindTitle').textContent,line:st.querySelector('.remind-line').textContent,yes:document.getElementById('remindYes').textContent,no:document.getElementById('remindNo').textContent,next:painted(document.getElementById('nextBtn')),back:painted(document.getElementById('backBtn')),bubble:document.getElementById('bubble').textContent,seg:document.getElementById('seg').hidden,focus:document.activeElement&&document.activeElement.id,saved:!!Sona.getProfile().onboarded,asks:__s.notifyAsks,name:/Mia/.test(st.textContent)};});
  ok('it asks, in a few words: "Want reminders during your free trial?", "A practice reminder each day, and one the day before it ends.", "Turn on reminders" or "Not now"',r.title==='Want reminders during your free trial?'&&r.line==='A practice reminder each day, and one the day before it ends.'&&r.yes==='Turn on reminders'&&r.no==='Not now'&&r.bubble==='I\'ll give you a heads-up!'&&!r.name,r);
  ok('…its two buttons are the way on (no Continue), Back is there, no progress bar, the heading takes focus',!r.next&&r.back&&r.seg&&r.focus==='remindTitle',r);
  ok('…and nothing is saved or asked of iOS by arriving: the profile is saved as the screen is left',!r.saved&&r.asks===0,r);
  await calm(page);await page.locator('#backBtn').click();await page.locator('[data-step="ready"].on').waitFor();
  ok('Back goes to the ready screen, still unsaved',await page.evaluate(()=>!Sona.getProfile().onboarded));
  await next(page);await page.locator('[data-step="remind"].on').waitFor();
  await calm(page);await page.locator('#remindYes').click();
  await page.waitForURL(u=>u.pathname==='/subscribe.html');
  const a=await at(page);
  ok('"Turn on reminders" asks iOS once (its own Allow box), then the price: the profile saved, the marker for this child and the grown-ups stamp written',page.url()===base+'/subscribe.html?setup=1'&&a.asks==='1'&&a.saved&&!!a.marker&&Number(a.gate)>0,a);
  clean('remind yes',errors);
 }finally{await context.close();}}
 // the count of asks, read before the page leaves
 {const {context,page,errors}=await fresh({webSales:true,notify:{state:'prompt',ask:'hang'}});try{
  await setupWalk(page,'remind',{name:'Mia'});
  await calm(page);await page.locator('#remindYes').click();await page.waitForTimeout(300);
  const w=await page.evaluate(()=>({asks:__s.notifyAsks,screen:document.body.dataset.setupScreen,yes:document.getElementById('remindYes').disabled,no:document.getElementById('remindNo').disabled,back:document.getElementById('backBtn').disabled,saved:!!Sona.getProfile().onboarded}));
  ok('while iOS\'s box is up the screen waits for the answer: asked once, both buttons and Back still, nothing saved yet',w.asks===1&&w.screen==='remind'&&w.yes&&w.no&&w.back&&!w.saved,w);
  ok('NUDGE1: "Turn on reminders", under words that promise a reminder each day, is the parent\'s yes to the daily practice reminders (none is set until a trial starts)',await page.evaluate(()=>{try{return JSON.parse(localStorage.getItem('sona.notify.v1')||'{}').nudge===1&&!JSON.parse(localStorage.getItem('sona.notify.v1')||'{}').nudges;}catch(e){return false;}}));
  await page.evaluate(()=>{__s.notifyAsks+=0;window.__notifyAnswer('denied');});
  await page.waitForURL(u=>u.pathname==='/subscribe.html');
  ok('…and whatever the parent answers there, on to the price',new URL(page.url()).pathname==='/subscribe.html'&&(await at(page)).saved);
  clean('remind, a slow answer',errors);
 }finally{await context.close();}}
 {const {context,page,errors}=await fresh({webSales:true,notify:NOTIFY,init:COUNT});try{
  await setupWalk(page,'remind',{name:'Mia'});
  await calm(page);await page.locator('#remindNo').click();
  ok('NUDGE1: "Not now" says yes to nothing',await page.evaluate(()=>{try{return !JSON.parse(localStorage.getItem('sona.notify.v1')||'{}').nudge;}catch(e){return true;}}));
  await page.waitForURL(u=>u.pathname==='/subscribe.html');
  const a=await at(page);
  ok('"Not now" goes on to the price, with the profile saved and the marker written, and iOS is never asked',a.saved&&!!a.marker&&a.asks==='0',a);
  clean('remind no',errors);
 }finally{await context.close();}}
 // a reminder that cannot be set, or a family who will not meet a free trial: never asked
 for(const [label,cfg,want] of [
   ['iOS already said yes',{webSales:true,notify:{state:'granted'}},null],
   ['iOS already said no',{webSales:true,notify:{state:'denied'}},null],
   ['a build that cannot set one',{webSales:true},null],
   ['a phone where no price follows',{notify:NOTIFY},null],
   ['a second child',{webSales:true,notify:NOTIFY,profile:{}},'welcome,name,sounds,ready,mic']]){
  const extra=label==='a second child'?{init:()=>{if(!localStorage.getItem('__kids')){localStorage.setItem('__kids','1');localStorage.setItem('sona.kids.v1',JSON.stringify({active:'k2',list:[{slot:'',name:'Milo'},{slot:'k2',name:'Rosie'}],hi:2}));}}}:{};
  const {context,page,errors}=await fresh(Object.assign({},cfg,extra));try{
   if(extra.init)await page.reload();
   const order=await page.evaluate(()=>ORDER.join());
   ok(label+': no reminder screen',order.indexOf('remind')<0&&(!want||order===want),order);
   clean('no remind: '+label,errors);
  }finally{await context.close();}
 }
 // the store found a purchase while the parent read the ready screen (or iOS
 // was answered meanwhile): the reminder is skipped as ready is left
 {const {context,page,errors}=await fresh({webSales:true,notify:NOTIFY,init:COUNT});try{
  await setupWalk(page,'ready',{name:'Mia'});
  await page.evaluate(()=>{window.__notifyState='granted';});
  await next(page);await page.waitForURL(u=>u.pathname==='/subscribe.html');
  ok('a reminder no longer due when ready is left: straight on to the price, the reminder screen never shown, iOS never asked',new URL(page.url()).pathname==='/subscribe.html'&&(await at(page)).saved&&(await at(page)).asks==='0');
  clean('remind skipped late',errors);
 }finally{await context.close();}}
 // the price never loads (its request dies): the reminder screen comes back
 // after 8 seconds with both buttons live, and they try again
 {let dead=true;const {context,page,errors}=await fresh({webSales:true,notify:NOTIFY,routes:[['**/subscribe.html**',r=>dead?r.abort('aborted'):r.fulfill({status:200,contentType:'text/html',body:'<p>price</p>'})]]});try{
  await setupWalk(page,'remind',{name:'Mia'});await page.clock.install();
  await calm(page);await page.locator('#remindNo').click({noWaitAfter:true});
  ok('"Not now" turns busy at once ("One moment…"), the profile saved',await page.evaluate(()=>document.getElementById('remindNo').textContent==='One moment…'&&document.getElementById('remindNo').disabled&&document.getElementById('remindYes').disabled&&Sona.getProfile().onboarded===true));
  await page.clock.runFor(11500);await new Promise(r=>setTimeout(r,300));
  const again=await page.evaluate(()=>({screen:document.body.dataset.setupScreen,yes:document.getElementById('remindYes').disabled,no:document.getElementById('remindNo').disabled,text:document.getElementById('remindNo').textContent,back:getComputedStyle(document.getElementById('backBtn')).display}));
  ok('the price never loaded: 8 seconds on, the reminder screen is back with both buttons live and no Back into the saved questions',again.screen==='remind'&&!again.yes&&!again.no&&again.text==='Not now'&&again.back==='none',again);
  dead=false;await calm(page);await page.locator('#remindNo').click();await page.waitForURL(u=>u.pathname==='/subscribe.html');
  ok('…and a second tap reaches the price',new URL(page.url()).pathname==='/subscribe.html');
  clean('remind, the price never loads',errors);
 }finally{await context.close();}}
 // iOS's Allow box that never answers (a stuck bridge: NOTIFY1 lets go only
 // after 60 s) holds the screen 12 s at most, then the price, as if answered
 {const {context,page,errors}=await fresh({webSales:true,notify:{state:'prompt',ask:'hang'},init:COUNT});try{
  await setupWalk(page,'remind',{name:'Mia'});await page.clock.install();
  await calm(page);await page.locator('#remindYes').click({noWaitAfter:true});
  await page.clock.runFor(11000);await new Promise(r=>setTimeout(r,200));
  ok('iOS\'s box unanswered for 11 s: still waiting on the reminder screen, both buttons and Back still',await page.evaluate(()=>document.body.dataset.setupScreen==='remind'&&document.getElementById('remindYes').disabled&&document.getElementById('remindNo').disabled&&document.getElementById('backBtn').disabled&&!Sona.getProfile().onboarded));
  await page.clock.runFor(1500);await page.waitForURL(u=>u.pathname==='/subscribe.html',{timeout:4000});
  const a=await at(page);
  ok('…12 s on it goes to the price by itself, the profile saved, iOS asked once',a.path==='/subscribe.html'&&a.saved&&a.asks==='1'&&!!a.marker,a);
  clean('remind, iOS never answers',errors);
 }finally{await context.close();}}
 // THE REMINDER IS ABOUT A FREE TRIAL, SO ONLY A BUYER THE STORE WILL GIVE ONE
 // IS ASKED (the review of 22 Oct 2026): an Apple ID that already had the free
 // days (a reinstall, a second iPad) is charged today, and no store answer is
 // no reminder screen, never a guess. Asked of the store as the ready screen
 // shows, once.
 const PAID={state:'paid',kind:'monthly',price:'$9.99',per:'month',free:null,sure:false,why:'',year:null};
 const FREE3={state:'free',kind:'monthly',price:'$9.99',per:'month',free:{n:3,unit:'day',text:'3 days'},sure:true,why:'',year:null};
 for(const [label,plan,refresh,tapAtOnce] of [
   ['the store says this Apple ID already had its free days (charged today)',PAID,null,false],
   ['the store has nothing to sell (no product, or it timed out)',{state:'none',kind:'',price:'',per:'',free:null,sure:false,why:'timeout',year:null},null,false],
   // the reminder follows the MONTHLY row, the one the price screen picks as
   // it opens (23 Oct 2026), whatever a yearly row (off the card while
   // IAP_SELL_YEARLY is false) would offer: free days on the year alone ask none
   ['the monthly row, picked as the price opens, is charged today, and only a yearly row has free days',Object.assign({},PAID,{year:{state:'free',kind:'annual',price:'$59.99',per:'year',free:{n:3,unit:'day',text:'3 days'},sure:true,why:'',best:true}}),null,false],
   // a row that only MAY be free (eligibility unknown: "Only new subscribers
   // get 3 days free. Otherwise Apple charges $9.99 today."): the price
   // screen promises no reminder for it, so setup asks none (review, 22 Oct)
   ['the store is not sure this Apple ID gets the free days (plan.sure false)',Object.assign({},FREE3,{sure:false}),null,false],
   ['the store never answers, and the parent taps Continue at once',"hang",null,true],
   ['iOS, asked afresh, says it was answered before (denied)',FREE3,{to:'denied',ms:400},true]]){
  const {context,page,errors}=await fresh({webSales:true,notify:NOTIFY,plan,refresh,init:COUNT});try{
   await setupWalk(page,'updates',{name:'Mia'});
   const before=await page.evaluate(()=>__s.plans);
   // (the ready screen comes after the plan moment's build beat, 31 Oct 2026:
   // watched for every frame, so "at once" is the moment it shows)
   await calm(page);await page.locator('#updSkip').click();await page.waitForFunction(()=>!!document.querySelector('[data-step="ready"].on'),null,{polling:'raf',timeout:5000});
   if(!tapAtOnce)await page.waitForTimeout(2700);
   const t0=Date.now();await calm(page);await page.locator('#nextBtn').click({noWaitAfter:true});
   if(tapAtOnce){await page.waitForTimeout(250);
    const w=await page.evaluate(()=>({screen:document.body.dataset.setupScreen,text:document.getElementById('nextBtn').textContent,busy:document.getElementById('nextBtn').getAttribute('aria-busy'),off:document.getElementById('nextBtn').disabled,back:document.getElementById('backBtn').disabled,saved:!!Sona.getProfile().onboarded}));
    ok(label+': Continue waits on the answer ("One moment…", still, Back still, nothing saved)',w.screen==='ready'&&w.text==='One moment…'&&w.busy==='true'&&w.off&&w.back&&!w.saved,w);}
   await page.waitForURL(u=>u.pathname==='/subscribe.html',{timeout:6000});
   const a=await at(page),took=Date.now()-t0;
   ok(label+': no reminder screen, straight on to the price, iOS never asked, the profile saved',a.remind==='0'&&a.asks==='0'&&a.saved&&!!a.marker,a);
   ok('…the store was asked once, as the ready screen showed (never before it)'+(tapAtOnce?', and the wait was 2.5 s at most ('+took+' ms)':''),before===0&&a.plans==='1'&&(!tapAtOnce||took<3600),{before,a,took});
   clean('no remind: '+label,errors);
  }finally{await context.close();}
 }
 // a store answer on its way as Continue is tapped: the wait ends with it, and
 // a free trial for this buyer brings the reminder screen; a slow iOS answer
 // is waited for only 2.5 s, and its last word (never asked) counts
 for(const [label,plan,refresh] of [['the store answers 1 s after the ready screen showed',{late:1000,plan:FREE3},null],['iOS, asked afresh, never answers (its last word, never asked, stands)',FREE3,'hang'],
   // the monthly row (the one the price opens on) is a sure free trial: the
   // reminder screen shows, whatever a yearly row would charge (23 Oct 2026)
   ['the monthly row is a sure free trial, and a yearly row is charged today',Object.assign({},FREE3,{year:{state:'paid',kind:'annual',price:'$59.99',per:'year',free:null,sure:false,why:'',best:true}}),null]]){
  const {context,page,errors}=await fresh({webSales:true,notify:NOTIFY,plan,refresh,init:COUNT});try{
   await setupWalk(page,'ready',{name:'Mia'});
   const t0=Date.now();await calm(page);await page.locator('#nextBtn').click();
   await page.locator('[data-step="remind"].on').waitFor({timeout:4000});
   const took=Date.now()-t0;
   ok(label+': the reminder screen follows once the wait is over ('+took+' ms), iOS not asked yet',await page.evaluate(()=>__s.notifyAsks===0&&!Sona.getProfile().onboarded)&&took<3600,took);
   clean('remind after a wait: '+label,errors);
  }finally{await context.close();}
 }
 // a "not eligible" that arrives after the first answer (storePlan's onLate)
 // takes the reminder screen away before the parent leaves the ready screen
 {const {context,page,errors}=await fresh({webSales:true,notify:NOTIFY,plan:FREE3,init:COUNT});try{
  await setupWalk(page,'ready',{name:'Mia'});await page.waitForTimeout(200);
  await page.evaluate(p=>window.__planLate(p),PAID);
  await next(page);await page.waitForURL(u=>u.pathname==='/subscribe.html');
  const a=await at(page);
  ok('a late "not eligible" from the store: no reminder screen, on to the price',a.remind==='0'&&a.asks==='0'&&a.saved,a);
  clean('remind, a late not eligible',errors);
 }finally{await context.close();}}
 // it fits, with its two buttons clear of the footer
 for(const vp of [{width:390,height:844},{width:375,height:667},{width:320,height:568}]){
  const {context,page,errors}=await fresh({viewport:vp,webSales:true,notify:NOTIFY});try{
   await setupWalk(page,'remind',{name:'Mia'});
   const f=await page.evaluate(()=>{const ob=document.querySelector('.ob'),y=document.getElementById('remindYes').getBoundingClientRect(),n=document.getElementById('remindNo').getBoundingClientRect(),foot=document.getElementById('backBtn').getBoundingClientRect();return {yes:y.height,no:n.height,bottom:n.bottom,footTop:foot.top,scroll:ob.scrollHeight-ob.clientHeight,sideways:document.documentElement.scrollWidth-innerWidth};});
   ok('the reminder screen fits at '+vp.width+'×'+vp.height+': both buttons at least 48 tall, above Back, nothing scrolls',f.yes>=48&&f.no>=48&&f.bottom+12<=f.footTop&&f.scroll<=1&&f.sideways<=0,f);
   clean('remind fit '+vp.width,errors);
  }finally{await context.close();}
 }
});

// ── THE PLAN MOMENT (Travis, 31 Oct 2026: "build the plan moment", then "day
// one, let's just say is to play a game and to read a book ... I want kids to
// go straight into a game"). On a parent's first setup the ready screen is
// reached through a short build beat (Echo, "Building <Name>'s practice…",
// the parent's answers coming in one by one, about 2.2 s; under Reduce Motion
// all at once, about 1 s), once a visit, silent, never recorded, and nothing
// under it takes a tap. The ready screen then carries the plan card, on every
// parent's first setup: a "Day 1" pill, Fruit Slice's Home picture (left out,
// never broken, when it does not load), "Play a game, then read a book." and
// which: "Fruit Slice first, then <the story>." (Sona.day1For, the rule
// Home's card uses once the profile is saved), with "A new story every day."
// under it. Where this child is shown no story (Sona.storyShown: a phone that
// cannot buy, without Premium) it says "Fruit Slice first, then a book." and
// nothing under it. Never on a re-walk, for a second child or a clinician. ──
const DAY1={robo:'Robo\'s Rocket',lighthouse:'The Lighthouse Sneeze',fizz:'Fizz and the Sleepy Fireflies'};
const PLAN_TITLE='Play a game, then read a book.',PLAN_PIC='/assets/crafted/home-fruit.webp';
const DAY1PAGE=['**/__day1.html',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>day1</title><script src="/sona.js"></script>'})];
// the plan card as a parent sees it
const planShown=page=>page.evaluate(()=>{const c=document.getElementById('planCard'),pic=document.getElementById('planPic'),img=document.getElementById('planImg'),st=document.querySelector('[data-step="ready"]'),vis=el=>!!el&&!el.closest('[hidden]')&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0,box=el=>{const b=el.getBoundingClientRect();return {t:Math.round(b.top),b:Math.round(b.bottom),h:Math.round(b.height),w:Math.round(b.width)};};
  return {shown:vis(c),story:c.dataset.story||'',game:c.dataset.game||'',day:(c.querySelector('.plan-day')||{}).textContent,title:document.getElementById('planTitle').textContent,line:document.getElementById('planLine').textContent,more:vis(document.getElementById('planMore'))?document.getElementById('planMore').textContent:'',pic:vis(pic),picGone:img.classList.contains('gone'),src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0,imgSeen:getComputedStyle(img).visibility!=='hidden',
   broken:[...st.querySelectorAll('img')].filter(i=>vis(i)&&getComputedStyle(i).visibility!=='hidden'&&i.complete&&!i.naturalWidth).map(i=>i.getAttribute('src')),
   asks:c.querySelectorAll('button,a,input,[role="button"],[tabindex]').length,card:vis(c)?box(c):null,chips:box(document.getElementById('readyChips')),foot:box(document.querySelector('.obfoot')),btn:box(document.getElementById('nextBtn')),hedge:box(st.querySelector('.ready-hedge')),
   scroll:document.querySelector('.ob').scrollHeight-document.querySelector('.ob').clientHeight,sideways:document.documentElement.scrollWidth-innerWidth,text:st.innerText.replace(/\s+/g,' ').trim()};});
// the beat as it stands this moment
const beatNow=page=>page.evaluate(()=>{const b=document.getElementById('obBuild');return b?{cls:b.className,role:b.getAttribute('role'),live:b.getAttribute('aria-live'),title:document.getElementById('obBuildT').textContent,name:(document.querySelector('#obBuildT .ph-name')||{}).textContent,answers:[...document.querySelectorAll('#obBuildAnswers span')].map(s=>s.textContent),on:document.querySelectorAll('#obBuildAnswers span.on').length,echo:!!b.querySelector('img[src*="echo"]'),screen:document.body.dataset.setupScreen,building:document.body.classList.contains('ob-building'),inert:document.querySelector('.ob').inert&&document.querySelector('.obfoot').inert,idx:ORDER[idx],saved:!!Sona.getProfile().onboarded}:null;});
// counts every beat that is put on the page, from now on
const watchBeats=page=>page.evaluate(()=>{window.__beats=0;new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.id==='obBuild')window.__beats++;}))).observe(document.body,{childList:true});});
await scenario('the plan moment: a short build beat before the ready screen, once a visit',async()=>{
 {const {context,page,errors,requests}=await fresh({motion:true,webSales:true});try{
  await setupWalk(page,'updates',{name:'Mia',age:'6',sounds:['R','S'],minutes:'10'});
  await watchBeats(page);const media=await page.evaluate(()=>__s.media.length);
  await calm(page);const t0=Date.now();await page.locator('#updSkip').click();
  const a=await beatNow(page);
  ok('moving on to the ready screen first shows the beat: Echo, "Building Mia\'s practice…", over the page',!!a&&a.echo&&a.title==='Building Mia\'s practice…'&&a.name==='Mia'&&a.screen==='updates'&&a.idx==='ready'&&a.building&&a.inert,a);
  ok('…the parent\'s answers, as the ready screen\'s chips say them, coming in one by one (none all at once yet)',!!a&&JSON.stringify(a.answers)==='["Ages 5–6","Sounds: R · S","10 min a day"]'&&a.on<3,a);
  ok('…a status a screen reader reads, and never recorded (ph-no-capture)',!!a&&a.role==='status'&&a.live==='polite'&&/\bph-no-capture\b/.test(a.cls)&&/\bplan\b/.test(a.cls),a);
  // nothing under it takes a tap: a finger on Continue lands on the beat; Back and Continue pressed from script do nothing
  const btn=await page.evaluate(()=>{const b=document.getElementById('nextBtn').getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2};});
  await page.mouse.click(btn.x,btn.y);await page.evaluate(()=>{document.getElementById('backBtn').click();document.getElementById('nextBtn').click();});
  await page.waitForTimeout(250);
  const b=await beatNow(page);
  ok('taps during the beat do nothing: no Back, no Continue, nothing saved',!!b&&b.idx==='ready'&&b.screen==='updates'&&!b.saved,b);
  await page.waitForTimeout(Math.max(0,1700-(Date.now()-t0)));
  const c=await beatNow(page);
  ok('…by 1.7 s every answer is in',!!c&&c.on===3,c);
  await page.locator('[data-step="ready"].on').waitFor({timeout:4000});const took=Date.now()-t0;
  const r=await page.evaluate(()=>({beat:!!document.getElementById('obBuild'),building:document.body.classList.contains('ob-building'),inert:document.querySelector('.ob').inert||document.querySelector('.obfoot').inert,focus:document.activeElement&&document.activeElement.id,title:document.getElementById('readyTitle').textContent,saved:!!Sona.getProfile().onboarded}));
  ok('then the ready screen, about 2.2 s on ('+took+' ms): the beat gone, the page live again, the heading focused, nothing saved',took>=1900&&took<=3400&&!r.beat&&!r.building&&!r.inert&&r.focus==='readyTitle'&&r.title==='Mia\'s practice is ready!'&&!r.saved,{took,r});
  ok('the beat makes no sound and fetches nothing to play',await page.evaluate(m=>__s.media.length===m&&!__s.spoke,media)&&!requests.some(q=>/\/api\/tts|\/coach\/|\.wav$|\.mp3$/.test(q.url)));
  await calm(page);await page.locator('#backBtn').click();await page.locator('[data-step="updates"].on').waitFor();
  await calm(page);const t1=Date.now();await page.locator('#updSkip').click();await page.locator('[data-step="ready"].on').waitFor({timeout:1500});
  ok('Back from ready and on again goes straight to the ready screen: the beat played once this visit',await page.evaluate(()=>window.__beats)===1&&Date.now()-t1<1200,{beats:await page.evaluate(()=>window.__beats),ms:Date.now()-t1});
  clean('plan beat',errors);
 }finally{await context.close();}}
 // under Reduce Motion nothing comes in: everything is there at once, for about 1 s
 {const {context,page,errors}=await fresh({webSales:true});try{
  await setupWalk(page,'updates',{name:'Mia',age:'',sounds:['R'],minutes:'skip'});
  await calm(page);const t0=Date.now();await page.locator('#updSkip').click();
  const a=await beatNow(page);
  ok('Reduce Motion: every answer is there from the beat\'s first frame (no age picked, minutes skipped: the sound alone)',!!a&&JSON.stringify(a.answers)==='["Sound: R"]'&&a.on===1,a);
  await page.locator('[data-step="ready"].on').waitFor({timeout:3000});const took=Date.now()-t0;
  ok('…and the ready screen about 1 s on ('+took+' ms)',took>=800&&took<=2000,took);
  clean('plan beat, Reduce Motion',errors);
 }finally{await context.close();}}
 // only a parent's first setup: a child walking setup again and a second
 // child get neither the beat nor the card; a first setup on a phone that
 // cannot sell gets both, the card with no story to name
 for(const [label,cfg,walk,beat] of [
   ['a child set up before, walking setup again',{webSales:true,profile:{childName:'Milo',childAge:'6',focusSounds:['R'],mode:'speech',role:'parent',onboarded:true,email:'mom@example.com'}},{name:'Milo'},false],
   ['a second child',{webSales:true,init:()=>{if(!localStorage.getItem('__kids')){localStorage.setItem('__kids','1');localStorage.setItem('sona.kids.v1',JSON.stringify({active:'k2',list:[{slot:'',name:'Milo'},{slot:'k2',name:'Rosie'}],hi:2}));}}},{name:'Rosie'},false],
   ['a first setup on a phone that cannot sell (no story shown: the game of the day on Home)',{},{name:'Mia'},true]]){
  const {context,page,errors}=await fresh(cfg);try{
   if(cfg.init)await page.reload();
   await watchBeats(page);
   await setupWalk(page,'ready',walk);await page.waitForTimeout(150);
   await page.evaluate(()=>{const i=document.getElementById('planImg');return i.complete||!i.getAttribute('src')?0:new Promise(r=>{i.onload=i.onerror=r;setTimeout(r,2000);});});
   const p=await planShown(page),beats=await page.evaluate(()=>window.__beats),told=await page.evaluate(()=>Sona.storyShown());
   if(!beat)ok(label+': no beat and no plan card',beats===0&&!p.shown&&!p.more,{beats,p});
   else ok(label+': the beat, then the card with no story to name: "Day 1", "'+PLAN_TITLE+'", "Fruit Slice first, then a book.", Fruit Slice\'s picture, and no "A new story every day."',beats===1&&!told&&p.shown&&p.story===''&&p.game==='slice'&&p.day==='Day 1'&&p.title===PLAN_TITLE&&p.line==='Fruit Slice first, then a book.'&&!p.more&&p.pic&&p.loaded&&p.src===PLAN_PIC&&!p.broken.length&&p.asks===0,{beats,told,p});
   clean('plan moment: '+label,errors);
  }finally{await context.close();}
 }
});
await scenario('the plan card: Day 1 is Fruit Slice, then the story Home will show for this child\'s sounds',async()=>{
 for(const [label,walk,id] of [['an R child',{sounds:['R']},'robo'],['a K child (no talking story)',{sounds:['K']},'lighthouse'],['"Not sure? Pick all sounds" (the list setup saves: every sound, easiest first)',{explore:true},'fizz']]){
  const {context,page,errors}=await fresh({webSales:true,routes:[DAY1PAGE]});try{
   await setupWalk(page,'ready',Object.assign({name:'Mia',age:'8'},walk));
   await page.evaluate(()=>Promise.all([...document.querySelectorAll('[data-step="ready"] img')].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r;setTimeout(r,2000);}))));
   const p=await planShown(page);
   ok(label+': a "Day 1" pill, "'+PLAN_TITLE+'" and "Fruit Slice first, then '+DAY1[id]+'.", with "A new story every day." under it',p.shown&&p.story===id&&p.game==='slice'&&p.day==='Day 1'&&p.title===PLAN_TITLE&&p.line==='Fruit Slice first, then '+DAY1[id]+'.'&&p.more==='A new story every day.',p);
   ok('…under the chips, a statement with nothing to tap, and no plan, price or promise in the screen\'s words',p.card&&p.card.t>=p.chips.b&&p.asks===0&&!/\bplan\b|\$|\bfree\b|recommend|score|result/i.test(p.text),p);
   // the picture is the first game's, Fruit Slice's Home card, whatever the story
   ok('…its picture is Fruit Slice\'s Home card, drawn and loaded',p.pic&&p.loaded&&p.imgSeen&&p.src===PLAN_PIC&&!p.broken.length,p);
   // the same story once the profile is saved: Home's own rule (questToday) agrees with the card
   await next(page);await page.waitForURL(u=>u.pathname==='/subscribe.html');
   await page.goto(base+'/__day1.html');
   const q=await page.evaluate(()=>{const t=Sona.questToday();return {kind:t.kind,state:t.state,day:t.day,id:t.story&&t.story.id,title:t.story&&t.story.title};});
   ok('…and once the profile is saved, Home\'s card is that very story, Day 1, open, under the title the card named',q.kind==='story'&&q.state==='open'&&q.day===1&&q.id===id&&q.title===DAY1[id],q);
   clean('plan card: '+label,errors);
  }finally{await context.close();}
 }
 // a picture that has already failed when the screen is drawn (Fruit
 // Slice's, answered 404) is left out: the card is its words, never a broken
 // image
 {const {context,page,errors}=await fresh({webSales:true,routes:[['**/assets/crafted/home-fruit.webp',r=>r.fulfill({status:404,body:''})]]});try{
  await setupWalk(page,'ready',{name:'Mia',age:'8',sounds:['K']});await page.waitForTimeout(150);
  const p=await planShown(page);
  ok('a Day 1 picture that failed before the screen showed steps aside: the card is its words alone (Fruit Slice, then The Lighthouse Sneeze), with no broken image and no empty box',p.shown&&p.story==='lighthouse'&&p.title===PLAN_TITLE&&p.line==='Fruit Slice first, then '+DAY1.lighthouse+'.'&&!p.pic&&!p.broken.length&&p.more==='A new story every day.',p);
  clean('plan card, a picture that failed first',errors);
 }finally{await context.close();}}
 // a picture that fails while the screen shows keeps its box, empty: nothing moves under a finger
 {let fail;const late=new Promise(r=>{fail=r;});
  const {context,page,errors}=await fresh({webSales:true,routes:[['**/assets/crafted/home-fruit.webp',async r=>{await late;r.fulfill({status:404,body:''});}]]});try{
  await setupWalk(page,'ready',{name:'Mia',age:'8',sounds:['K']});await page.waitForTimeout(150);
  const a=await planShown(page);
  fail();await page.waitForFunction(()=>document.getElementById('planImg').classList.contains('gone'),null,{timeout:3000});await page.waitForTimeout(100);
  const b=await planShown(page);
  ok('a picture still on its way when the screen shows keeps its box; when it fails it stays empty there, never broken, and the card does not move',a.pic&&!a.loaded&&b.pic&&b.picGone&&!b.imgSeen&&!b.broken.length&&JSON.stringify(a.card)===JSON.stringify(b.card),{a:a.card,b:b.card,gone:b.picGone});
  clean('plan card, a late failure',errors);
 }finally{fail();await context.close();}}
 // Sona.day1For, the one rule: the first of the sounds with a talking story, else the lighthouse
 {const {context,page,errors}=await fresh();try{
  const d=await page.evaluate(()=>{const f=l=>Sona.day1For(l).id;const one=Sona.day1For(['R']);one.title='x';return {r:f(['R']),k:f(['K']),lower:f(['s']),ks:f(['K','S']),thz:f(['TH','Z']),none:f([]),junk:f(['XX']),play:f(Sona.PLAY_ORDER),copy:Sona.STORY_TALK[0].title,shape:Object.keys(Sona.day1For(['K'])).sort().join(),talk:[Sona.day1For(['L']).talk,Sona.day1For(['K']).talk],pic:Sona.day1For(['K']).pic};});
  ok('Sona.day1For: R Robo, K the lighthouse, s (any case) Sandy, K then S Sandy, TH then Z Zippy, none or no known sound R\'s Robo, every sound in play order Fizz',d.r==='robo'&&d.k==='lighthouse'&&d.lower==='sandy'&&d.ks==='sandy'&&d.thz==='zippy'&&d.none==='robo'&&d.junk==='robo'&&d.play==='fizz',d);
  ok('…a copy each time (the list is never changed through it), with the card\'s fields',d.copy==='Robo\'s Rocket'&&d.shape==='hero,id,line,pic,talk,title'&&d.talk[0]===true&&d.talk[1]===false&&d.pic==='/assets/crafted/home-lighthouse.webp',d);
  await page.evaluate(()=>sessionStorage.setItem('sona.talkoff','1'));
  ok('…and it follows the talking stories\' off switch as _talkDay does (the lighthouse for everyone)',await page.evaluate(()=>Sona.day1For(['R']).id==='lighthouse'));
  clean('day1For',errors);
 }finally{await context.close();}}
});
await scenario('the ready screen with the plan card fits, Continue on screen',async()=>{
 for(const vp of [{width:390,height:844},{width:375,height:667},{width:320,height:568}])for(const [sound,name] of [['K','Mia'],['R','Mia'],['K','Wolfeschlegelsteinhaus']]){
  if(name!=='Mia'&&vp.width!==320)continue;
  const {context,page,errors}=await fresh({viewport:vp,webSales:true});try{
   await setupWalk(page,'ready',{name,age:'8',sounds:[sound],therapy:'t_yes',minutes:'5'});
   await page.evaluate(()=>Promise.all([...document.querySelectorAll('[data-step="ready"] img')].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r;setTimeout(r,2000);}))));await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(150);
   const p=await planShown(page),at=vp.width+'×'+vp.height+' ('+sound+(name!=='Mia'?', a 22-letter name':'')+')';
   if(name==='Mia')ok('ready with the plan card fits at '+at+': no scroll, the card and the hedge above the footer, Continue on screen',p.shown&&p.scroll<=1&&p.sideways<=0&&p.card.b<=p.foot.t&&p.hedge.b<=p.foot.t&&p.btn.b<=vp.height&&p.btn.t>=0,p);
   else ok('…and with a 22-letter name at '+at+': at most a short scroll, the hedge above Continue, never sideways',p.shown&&p.scroll<=48&&p.hedge.b<=p.btn.t&&p.sideways<=0,p);
   if(vp.height<=600)ok('…on a phone 600 px tall the picture steps aside and the words take the card ('+at+')',!p.pic&&p.title===PLAN_TITLE&&p.line.length>0,p);
   else ok('…with Fruit Slice\'s picture ('+at+')',p.pic&&p.loaded&&p.src===PLAN_PIC,p);
   clean('plan card fit '+at,errors);
  }finally{await context.close();}
 }
});

// ── THE LOOK: approved warm Play Studio palette, scoped to setup ──
await scenario('the main buttons and held choices use Play Studio coral',async()=>{
 const {context,page,errors}=await fresh({webSales:true,notify:NOTIFY});try{
  const paint=sel=>page.evaluate(s=>{const c=getComputedStyle(document.querySelector(s));return {bg:c.backgroundColor,border:c.borderTopColor,text:c.color};},sel);
  const b=await paint('#nextBtn');
  ok('the footer button is coral with white words',b.bg==='rgb(190, 83, 62)'&&b.border==='rgb(190, 83, 62)'&&b.text==='rgb(255, 255, 255)',b);
  await setupWalk(page,'name',{});await calm(page);await page.locator('#obAge [data-age="6"]').click();
  const chip=await paint('#obAge [data-age="6"]');
  ok('a picked chip has a coral ring, warm wash and dark coral words',chip.border==='rgb(190, 83, 62)'&&chip.bg==='rgb(255, 228, 204)'&&chip.text==='rgb(147, 66, 47)',chip);
  const age=await page.evaluate(()=>{const l=document.getElementById('ageLabel'),i=document.getElementById('obName');return {label:l.textContent,gap:l.getBoundingClientRect().top-i.getBoundingClientRect().bottom};});
  ok('the name form uses Age and gives it more room after the input',age.label==='Age'&&age.gap>=29,age);
  await setupWalk(page,'minutes',{name:'Mia'});
  ok('a fresh parent starts with five minutes selected; Continue accepts it',await page.evaluate(()=>draft.minutes==='5'&&document.querySelector('#obMinutes [aria-pressed="true"]').dataset.val==='5'&&!document.getElementById('nextBtn').disabled));
  await next(page);ok('the default choice continues to the optional weekly report',await screen(page)==='updates');
  await setupWalk(page,'remind',{name:'Mia'});const y=await paint('#remindYes');
  ok('Turn on reminders uses the same coral',y.bg==='rgb(190, 83, 62)'&&y.border==='rgb(190, 83, 62)',y);
  clean('look',errors);
 }finally{await context.close();}
});

await browser.close();server.close();
console.log(failures?failures+' FAILURES / '+checks+' assertions':'ALL GREEN — '+checks+' assertions');
process.exit(failures?1:0);
