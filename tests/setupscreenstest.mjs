// PLAY STUDIO: approved onboarding, 24 Oct 2026. The real purchase, privacy,
// native-keyboard and setup state contracts stay; the old intro/slideshow is
// replaced by a short hello, one-message problem, and two silent comparisons.
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
  await next(page);await next(page);await page.locator('[data-step="reel"].on').waitFor();
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
  ok('the first parent sees distinct Fruit and Piano previews before Rachel',c.order==='welcome,problem,reel,piano,rachel,name,interests,games,therapy,sounds,minutes,updates,ready,mic',c.order);
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
   await next(page);ok('…Get started works immediately and opens the problem',await screen(page)==='problem');
   await calm(page);await page.locator('#backBtn').click();ok('Back opens the same hello without waiting',await screen(page)==='welcome'&&!await page.evaluate(()=>document.body.classList.contains('hello-wait')));
   await page.evaluate(()=>document.documentElement.classList.add('ob-leaving'));
   ok('the page is held blank while a saved setup returns to its price',await page.evaluate(()=>getComputedStyle(document.querySelector('.ob')).visibility==='hidden'));
   clean('hello '+vp.width,errors);
  }finally{await context.close();}
 }
});

const demoCount=(page,id)=>page.evaluate(id=>__s.frames[id]||0,id);
await scenario('Fruit Slice, then Piano Tiles: live silent previews, with useful after-practice help',async()=>{
 const {context,page,errors,requests}=await fresh({motion:true,webSales:true});try{
  const before=await page.evaluate(()=>({profile:JSON.stringify(Sona.getProfile()),run:sessionStorage.getItem('sona.run.v1')}));
  for(const [key,id,word] of [['reel','fruitDemoScene','fruit'],['piano','pianoDemoScene','keys']]){
   await setupWalk(page,key);await calm(page);await page.evaluate(()=>Promise.all([...document.querySelectorAll('.step.on img')].map(i=>i.decode().catch(()=>{}))));
   const a=await demoCount(page,id);await page.waitForTimeout(350);const b=await demoCount(page,id);
   ok(key+': its canvas paints live frames, with an accessible description and the one-message heading',b-a>=5&&await page.evaluate(([key,id,word])=>{const st=document.querySelector('[data-step="'+key+'"]'),c=document.querySelector('#'+id+' canvas');return c.getAttribute('role')==='img'&&!!c.getAttribute('aria-label')&&st.querySelector('h1').textContent==='Practice your sound.Slow the '+word+'.'&&document.activeElement===st.querySelector('h1');},[key,id,word]),{a,b});
   for(const [mode,slow] of [['slow',true],['normal',false]]){
    await calm(page);await page.locator('[data-step="'+key+'"] [data-demo-mode="'+mode+'"]').click();
    const m=await page.evaluate(id=>{const scene=document.getElementById(id),st=scene.closest('.step');return {slow:scene.classList.contains('slow'),label:scene.querySelector('.demo-speed').textContent,message:scene.querySelector('.demo-message').textContent,pressed:[...st.querySelectorAll('[aria-pressed="true"][data-demo-mode]')].map(b=>b.dataset.demoMode)};},id);
    ok(key+': '+mode+' changes the comparison and its help message, with exactly one pressed button',m.slow===slow&&m.label===(slow?'After practice':'Normal speed')&&m.message===(slow?'Slower '+word+'.':key==='reel'?'Swipe to slice.':'Tap the keys.')&&JSON.stringify(m.pressed)===JSON.stringify([mode]),m);
   }
   await page.evaluate(()=>__s.background());const stopped=await demoCount(page,id);await page.waitForTimeout(250);
   ok(key+': backgrounding releases its paint loop',await demoCount(page,id)===stopped,{stopped,now:await demoCount(page,id)});
   await page.evaluate(()=>__s.foreground());await page.waitForTimeout(250);ok(key+': returning to this screen starts its own scene again',await demoCount(page,id)>stopped);
   await next(page);const left=await demoCount(page,id);await page.waitForTimeout(250);ok(key+': leaving the screen stops its loop',await demoCount(page,id)===left,{left,now:await demoCount(page,id)});
  }
  ok('Piano follows Fruit, then Rachel, without an extra question',await screen(page)==='rachel'&&await page.evaluate(()=>ORDER.slice(0,5).join()==='welcome,problem,reel,piano,rachel'));
  const after=await page.evaluate(()=>({profile:JSON.stringify(Sona.getProfile()),run:sessionStorage.getItem('sona.run.v1'),mics:__s.mics,media:__s.media.length,spoke:!!__s.spoke}));
  ok('the previews grant no credit and start no practice, recording or speech',after.profile===before.profile&&after.run===before.run&&after.mics===0&&after.media===0&&!after.spoke,{before,after});
  ok('the previews fetch local art, never the old clips, voice lines or speech recordings',!requests.some(r=>/\.mp4|\/api\/tts$|\/coach\/|\.wav$|\.mp3$/.test(r.url)),requests.filter(r=>/mp4|tts|coach|wav|mp3/.test(r.url)));
  clean('live previews',errors);
 }finally{await context.close();}
});

await scenario('the new sales screens fit phones and tablets; reduced-motion previews stay still',async()=>{
 for(const vp of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024},{width:1280,height:800}]){
  const {context,page,errors}=await fresh({viewport:vp,webSales:true});try{
   for(const key of ['problem','reel','piano']){
    await setupWalk(page,key);await calm(page);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(150);
    const f=await page.evaluate(()=>{const st=document.querySelector('.step.on'),foot=document.querySelector('.obfoot').getBoundingClientRect(),head=st.querySelector('h1').getBoundingClientRect(),body=st.getBoundingClientRect(),ob=document.querySelector('.ob'),scene=st.querySelector('.demo-scene'),toggle=st.querySelector('.demo-switch'),r=e=>{const b=e.getBoundingClientRect();return {t:b.top,b:b.bottom,l:b.left,r:b.right,h:b.height};};return {head:r(st.querySelector('h1')),body:r(st),foot:r(document.querySelector('.obfoot')),scene:scene?r(scene):null,toggle:toggle?r(toggle):null,scroll:ob.scrollHeight-ob.clientHeight,sideways:document.documentElement.scrollWidth-innerWidth,h:innerHeight,w:innerWidth};});
    ok(key+' fits '+vp.width+'×'+vp.height+': its message and art above Continue, no sideways overflow',f.head.t>=0&&f.body.b<=f.foot.t+1&&f.sideways<=0&&(!f.scene||(f.scene.h>=180&&f.scene.b<=f.toggle.t&&f.toggle.b<=f.foot.t)),f);
    if(key==='problem')ok('problem is one short message with one image, not a delayed explanation',await page.evaluate(()=>{const s=document.querySelector('.step.on');return s.querySelector('h1').textContent==='Speech practice.Through play.'&&s.innerText.trim().split(/\s+/).length<=5&&s.querySelectorAll('.ba-row').length===0&&!!s.querySelector('.studio-problem-art');}));
    else {const id=key==='reel'?'fruitDemoScene':'pianoDemoScene',a=await demoCount(page,id);await page.waitForTimeout(300);ok(key+' under Reduce Motion paints a still frame without an ongoing loop',a>0&&await demoCount(page,id)===a,{a,now:await demoCount(page,id)});}
   }
   clean('sales screens fit '+vp.width,errors);
  }finally{await context.close();}
 }
});

// ── SETUP MAKES NO SOUND (23 Oct 2026: no tap chime, and "Hear Echo" gone) ──
await scenario('setup makes no sound: a whole walk, voice on, plays and fetches nothing to play',async()=>{
 const tts=['**/api/tts',r=>r.fulfill({status:200,contentType:'application/octet-stream',headers:{'X-Sona-Voice-Keep':'0'},body:Buffer.alloc(4800,7)})];
 {const {context,page,errors,requests}=await fresh({webSales:true,motion:true,routes:[tts]});try{
  for(const to of ['problem','reel','piano','rachel','name','interests','games','therapy','sounds','minutes','updates','ready']){await setupWalk(page,to);if(to==='reel'||to==='problem')await page.waitForTimeout(700);}
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
  ok('an iPhone that can set a reminder, never asked, the price to follow: the reminder screen sits between ready and the microphone',await page.evaluate(()=>ORDER.join())==='welcome,problem,reel,piano,rachel,name,interests,games,therapy,sounds,minutes,updates,ready,remind,mic');
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
   await calm(page);await page.locator('#updSkip').click();await page.locator('[data-step="ready"].on').waitFor();
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
