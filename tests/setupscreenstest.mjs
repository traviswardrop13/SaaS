// SETUPNEW1: setup's new screens, one rule at a time (Travis, 22 Oct 2026: "I
// want to do a completely new onboarding ... make it live, animated. We want
// to sell the product in the onboarding. Do like a little clip of a few games
// so that parents can see it, and even have like the voice say your R sound
// ... a bigger slide of Rachel that's just like all by itself ... more so like
// how many minutes per day ... push notifications ... a step in the
// onboarding"). onboardingtest walks the whole flow; this holds:
//   - the hello: the orchard without Echo painted in, one live Echo, its
//     loops outside every step (a step's own motion always ends), nothing of
//     it on any other screen, still under Reduce Motion, hidden while the
//     page is held blank;
//   - the reel: the games this phone may show, in the demo order, real clips
//     where the phone plays H.264 (two videos taking turns), the posters where
//     it cannot or refuses, a game's Home card where its clip or poster is
//     missing: never a dead frame; nothing plays off the screen;
//   - "Hear Echo": Echo's line, a breath and Rachel's R take as ONE
//     Sona.mediaPCM call, only on a grown-up's tap, nothing with Sona's sound
//     off or its volume at 0, stopped when the screen is left, no microphone;
//   - Rachel on her own: her photo and Travis's line word for word, shown
//     once, naming nobody else, no CCC, certified, licensed or plan;
//   - "How long each day?": 5/10/15 minutes saved as the daily goal in reps
//     (30/60/90) beside the minutes, Skip leaving both as they were;
//   - what the child loves: saved as ids when asked, an older profile's kept
//     when not;
//   - the reminder ask: only where the iPhone can set one (Sona.notifyAvailable),
//     iOS has never been asked (Sona.notifyState "prompt", read afresh with
//     Sona.notifyRefresh where sona.js has it) and the price follows, AND the
//     store says this buyer will be offered free days on the row the price
//     screen picks (Sona.storePlan "free"; never asked on a guess: no answer
//     in 2.5 s, no screen); iOS's box only on "Turn on reminders", a box that
//     never answers let go of after 12 s; either way on to the price, the
//     profile saved as the screen is left; skipped when the store found a
//     purchase meanwhile;
//   - the look: Travis's brighter teal on the main buttons, a picked chip's
//     teal ring.
// The iPhone's notification methods are sona.js's (NOTIFY1); here they are
// stubbed on window.Sona, so the page is held to what it asks of them.
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
// Rachel's one take of R, as the page reads it: the PCM of the WAV's data chunk
const TAKE=(()=>{const b=readFileSync(root+'/coach/say-echo/R-sound.wav');let i=12;while(i+8<=b.length){const id=b.toString('latin1',i,i+4),n=b.readUInt32LE(i+4);if(id==='data')return Math.min(n,b.length-i-8)&~1;i+=8+n+(n&1);}return 0;})();
const GAP=Math.round(24000*0.2)*2;   // 200 ms of silence, 24 kHz 16-bit mono
// a 1x1 WebP: the one poster this suite serves (the reel's own files are tools/setupreel's)
const WEBP=Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=','base64');

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
  const h=window.__s={media:[],stops:0,asks:0,mics:0,notifyAsks:0,plans:0,refresh:0};
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
  await page.goto(base+'/onboarding.html');await page.evaluate(()=>document.fonts.ready);
  return {context,page,errors,requests};
}
const screen=page=>page.evaluate(()=>document.body.dataset.setupScreen);
async function next(page){await calm(page);await page.locator('#nextBtn').click();}
function clean(name,errors){ok(name+': no runtime errors',errors.length===0,errors);}
const isTeal=s=>[...String(s).matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)].map(m=>m.slice(1,4).map(Number)).some(([r,g,b])=>{const mx=Math.max(r,g,b),mn=Math.min(r,g,b),c=mx-mn;if(c<=80)return false;const h=mx===r?((g-b)/c)%6:mx===g?(b-r)/c+2:(r-g)/c+4;const d=(h*60+360)%360;return d>=172&&d<=195;});

// ── THE HELLO ──
await scenario('the hello: the orchard without Echo painted in, and one live Echo',async()=>{
 {const {context,page,errors}=await fresh({motion:true});try{
  const h=await page.evaluate(()=>{const hello=document.querySelector('.hello'),bg=getComputedStyle(document.querySelector('.hello-bg')).backgroundImage,styles=[...document.querySelectorAll('*')].map(e=>getComputedStyle(e).backgroundImage).join(' ');return {shown:getComputedStyle(hello).display!=='none',bg,welcomeOrchard:/welcome-orchard/.test(styles+document.documentElement.outerHTML),echoes:document.querySelectorAll('.hello-echo').length,poses:[...document.querySelectorAll('.hello-echo img')].map(i=>i.getAttribute('src')),hidden:hello.getAttribute('aria-hidden'),taps:getComputedStyle(hello).pointerEvents,mascot:getComputedStyle(document.querySelector('.ob .mascot')).display,label:document.querySelector('.welcome-brand').getAttribute('aria-label'),cta:document.getElementById('nextBtn').textContent.trim(),body:getComputedStyle(document.body).backgroundColor};});
  ok('the hello paints the orchard with no Echo in it (orchard-game), never the one with him painted in',h.shown&&/orchard-game\.webp/.test(h.bg)&&!h.welcomeOrchard,h.bg);
  ok('…and one Echo on it: one sprite, resting and waving (two poses of the one Echo, faded into each other), decoration that takes no tap',h.echoes===1&&JSON.stringify(h.poses)==='["/assets/crafted/echo-welcome.webp","/assets/crafted/echo-wave.webp"]'&&h.hidden==='true'&&h.taps==='none'&&h.mascot==='none',h);
  ok('the brand says what it is to a screen reader, and the one button is "Get started"',h.label==='Sona. Speech practice kids love.'&&h.cta==='Get started',h);
  ok('…over a solid body colour (the iPhone keyboard\'s corners are painted from it)',h.body==='rgb(255, 246, 233)',h.body);
  const motion=await page.evaluate(()=>{const fin=a=>a.effect.getComputedTiming().endTime!==Infinity;const step=document.querySelector('.step.on').getAnimations({subtree:true}),hello=document.querySelector('.hello').getAnimations({subtree:true});return {step:step.length,stepLoops:step.filter(a=>!fin(a)).length,hello:hello.length,helloLoops:hello.filter(a=>!fin(a)).length,names:[...new Set(hello.map(a=>a.animationName))],intro:document.body.classList.contains('hello-intro')};});
  ok('with motion on, the intro plays (Sona drops in letter by letter inside the step) and every motion inside the step ends',motion.intro&&motion.step>=4&&motion.stepLoops===0,motion);
  ok('…while Echo bobs, waves and the orchard moves on for good, in the hello layer outside every step',motion.helloLoops>=5&&['hello-bob','hello-wave','hello-drift','hello-fall','hello-twinkle'].every(n=>motion.names.indexOf(n)>-1),motion);
  // "Get started" fades in last (1.3 s + 0.45 s): until then it takes no tap
  {const t=await page.evaluate(()=>({pe:getComputedStyle(document.querySelector('.obfoot')).pointerEvents,op:+getComputedStyle(document.querySelector('.obfoot .inner')).opacity}));
   const c=await page.evaluate(()=>{const r=document.getElementById('nextBtn').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
   await page.mouse.click(c.x,c.y);
   ok('while "Get started" fades in it takes no tap: a press where it will be does nothing',t.pe==='none'&&await page.evaluate(()=>document.body.dataset.setupScreen==='welcome'),t);
   // every frame until it takes taps again: never a tap while it is still faint
   const fr=await page.evaluate(()=>new Promise(done=>{const out=[],t0=performance.now();(function grab(){const pe=getComputedStyle(document.querySelector('.obfoot')).pointerEvents,op=+getComputedStyle(document.querySelector('.obfoot .inner')).opacity;out.push({pe,op});if(pe!=='none'||performance.now()-t0>3000)done(out);else requestAnimationFrame(grab);})();}));
   const live=fr.filter(f=>f.pe!=='none');
   ok('…and once it has faded in (1.75 s) it does: no frame takes a tap while it is under 90% drawn',live.length===1&&live[0].op>=0.9&&fr.filter(f=>f.op<0.9).every(f=>f.pe==='none'),fr.slice(-4));}
  ok('…which a test can settle: finishing the step\'s own motion throws nothing',await page.evaluate(()=>{try{document.querySelector('.step.on').getAnimations({subtree:true}).forEach(a=>a.finish());return true;}catch(e){return e.message;}})===true);
  await next(page);await calm(page);await page.locator('#backBtn').click();await page.locator('[data-step="welcome"].on').waitFor();
  ok('Back to the hello within a visit: Echo is already there (no intro again), the idle motion only',await page.evaluate(()=>!document.body.classList.contains('hello-intro')&&document.querySelector('.step.on').getAnimations({subtree:true}).filter(a=>a.animationName==='hello-letter').length===0&&document.querySelector('.hello').getAnimations({subtree:true}).length>=5));
  await page.reload();await page.locator('[data-step="welcome"].on').waitFor();
  ok('…and a new visit\'s hello plays its intro again',await page.evaluate(()=>document.body.classList.contains('hello-intro')));
  await page.evaluate(()=>document.documentElement.classList.add('ob-leaving'));
  ok('while the page is held blank (on the way back to the price) the hello layer is not drawn',await page.evaluate(()=>getComputedStyle(document.querySelector('.hello')).display==='none'&&getComputedStyle(document.body).backgroundImage==='none'));
  await page.evaluate(()=>document.documentElement.classList.remove('ob-leaving'));
  // nothing of the hello on any other screen
  const seen=[];
  for(const to of ['problem','reel','rachel','name','interests','games','therapy','sounds','minutes','updates','ready','mic']){await setupWalk(page,to);seen.push([to,await page.evaluate(()=>getComputedStyle(document.querySelector('.hello')).display)]);}
  ok('the hello layer is drawn on no other screen',seen.every(x=>x[1]==='none'),seen);
  clean('hello, motion on',errors);
 }finally{await context.close();}}
 {const {context,page,errors}=await fresh();try{
  const still=await page.evaluate(()=>({anims:document.querySelector('.hello').getAnimations({subtree:true}).length,step:document.querySelector('.step.on').getAnimations({subtree:true}).filter(a=>a.playState==='running').length,hi:getComputedStyle(document.querySelector('.hello-hi')).opacity,rest:getComputedStyle(document.querySelector('.hello-rest')).opacity,wave:getComputedStyle(document.querySelector('.hello-wave')).opacity,btn:getComputedStyle(document.querySelector('.obfoot .inner')).opacity}));
  ok('under Reduce Motion nothing on the hello moves: Echo stands on the path and says hi, the button is there',still.anims===0&&still.step===0&&still.hi==='1'&&still.rest==='1'&&still.wave==='0'&&still.btn==='1',still);
  ok('…and takes a tap from the first frame',await page.evaluate(()=>getComputedStyle(document.querySelector('.obfoot')).pointerEvents!=='none'&&!document.body.classList.contains('hello-wait')));
  clean('hello, Reduce Motion',errors);
 }finally{await context.close();}}
 // every size: the brand, Echo and the button on screen, apart, and nothing scrolls
 for(const vp of [{width:390,height:844},{width:375,height:667},{width:320,height:568},{width:768,height:1024}]){
  const {context,page,errors}=await fresh({viewport:vp});try{
   const f=await page.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect(),b=r('.welcome-brand'),e=r('.hello-echo'),hi=r('.hello-hi'),n=r('#nextBtn'),ob=document.querySelector('.ob');return {brandBottom:b.bottom,echoTop:Math.min(e.top,hi.top),echoBottom:e.bottom,echoLeft:Math.min(e.left,hi.left),echoRight:Math.max(e.right,hi.right),btnTop:n.top,btnBottom:n.bottom,w:innerWidth,h:innerHeight,scroll:ob.scrollHeight-ob.clientHeight,sideways:document.documentElement.scrollWidth-innerWidth};});
   ok('the hello at '+vp.width+'×'+vp.height+': the name, Echo with his hi and the button all on screen, none on another, nothing scrolls',f.brandBottom<f.echoTop&&f.echoBottom<f.btnTop&&f.echoLeft>=0&&f.echoRight<=f.w&&f.btnBottom<=f.h&&f.scroll<=1&&f.sideways<=0,f);
   clean('hello fit '+vp.width,errors);
  }finally{await context.close();}
 }
});

// ── THE REEL ──
const reelState=page=>page.evaluate(()=>{const f=document.getElementById('reelFrame'),vis=[...f.querySelectorAll('.reel-still,.reel-clip')].filter(e=>getComputedStyle(e).display!=='none'&&e.classList.contains('on'));return {stills:f.classList.contains('stills'),on:vis.map(e=>e.tagName+':'+(e.getAttribute('src')||'')+(e.classList.contains('card')?':card':'')),clips:[...f.querySelectorAll('.reel-clip')].map(v=>v.getAttribute('src')||''),clipShown:[...f.querySelectorAll('.reel-clip')].some(v=>getComputedStyle(v).display!=='none'),broken:[...f.querySelectorAll('img.reel-still.on')].some(i=>i.complete&&!i.naturalWidth&&!i.classList.contains('gone'))};});
const toReel=async page=>{await setupWalk(page,'reel');await page.locator('[data-step="reel"].on').waitFor();};
await scenario('the reel: real clips where the phone plays them, posters where it cannot, Home cards where a game has neither',async()=>{
 // (motion on in this scenario: under Reduce Motion the reel is one still, below)
 // the tests' browser plays no H.264 (as a phone in Low Power Mode may refuse
 // to start one): the posters, as a slideshow; here every poster is missing
 // but Fruit Slice's, so the others are their games' Home cards
 {const {context,page,errors,requests}=await fresh({webSales:true,motion:true,routes:[['**/assets/setup/reel/*.webp',r=>r.fulfill({status:404,body:''})],['**/assets/setup/reel/slice.webp',r=>r.fulfill({status:200,contentType:'image/webp',body:WEBP})]]});try{   // (the real posters taken away: a later route wins)
  await toReel(page);await page.waitForTimeout(300);
  let s=await reelState(page);
  ok('a browser that cannot play the clips gets the posters: no video drawn, the first game\'s poster on screen',s.stills&&!s.clipShown&&JSON.stringify(s.on)==='["IMG:/assets/setup/reel/slice.webp"]'&&!s.broken,s);
  ok('…and asks for no clip at all',!requests.some(r=>/\.mp4/.test(r.url)),requests.filter(r=>/reel/.test(r.url)).map(r=>r.url));
  await page.waitForFunction(()=>{const i=document.querySelector('#reelFrame .reel-still.on');return i&&/home-hoops/.test(i.getAttribute('src')||'');},null,{timeout:5000}).catch(()=>{});
  const outgoing=()=>page.evaluate(()=>{const i=document.querySelector('#reelFrame .reel-still:not(.on)');return i?i.getAttribute('src'):null;});
  const mid=await outgoing();
  s=await reelState(page);
  ok('…changing every few seconds to the next game in the demo order (Hoops), whose missing poster is its painted Home card: never a broken picture',JSON.stringify(s.on)==='["IMG:/assets/crafted/home-hoops.webp:card"]'&&!s.broken,s);
  // the 22 Oct 2026 review: the outgoing still was loaded with the game
  // after next while it was still fading out (a third game flashed)
  ok('…the one fading out keeps its own game (Fruit Slice) while it fades',mid==='/assets/setup/reel/slice.webp',mid);
  await page.waitForTimeout(900);
  ok('…and only once the fade is over takes the game after next (Piano Tiles: its poster, missing here, then its Home card)',/^\/assets\/(setup\/reel\/tiles|crafted\/home-piano)\.webp$/.test((await outgoing())||''),await outgoing());
  await next(page);await page.locator('[data-step="rachel"].on').waitFor();const at=Date.now();await page.waitForTimeout(3600);
  ok('off the reel nothing changes: the slideshow stops with the screen',JSON.stringify((await reelState(page)).on)==='["IMG:/assets/crafted/home-hoops.webp:card"]',Date.now()-at);
  clean('reel stills',errors);
 }finally{await context.close();}}
 // the real posters (tools/setupreel's files): a browser that plays no H.264 sees each game's own still, not its Home card
 {const {context,page,errors,requests}=await fresh({webSales:true,motion:true});try{
  await toReel(page);
  await page.waitForFunction(()=>{const i=document.querySelector('#reelFrame .reel-still.on');return i&&i.complete;},null,{timeout:4000}).catch(()=>{});
  const s=await reelState(page),w=await page.evaluate(()=>{const i=document.querySelector('#reelFrame .reel-still.on');return i?[i.naturalWidth,i.naturalHeight]:null;});
  ok('the reel\'s own posters: Fruit Slice\'s still from the reel (540 x 720), not a Home card, and no clip asked for',s.stills&&JSON.stringify(s.on)==='["IMG:/assets/setup/reel/slice.webp"]'&&!s.broken&&w&&w[0]===540&&w[1]===720&&!requests.some(r=>/\.mp4/.test(r.url)),{s,w});
  clean('reel, the real posters',errors);
 }finally{await context.close();}}
 // a phone that plays H.264: two videos take turns, one playing while the next loads
 const PLAYS=()=>{HTMLMediaElement.prototype.canPlayType=function(t){return /mp4/.test(t)?'probably':'';};HTMLMediaElement.prototype.play=function(){(window.__played=window.__played||[]).push(this.getAttribute('src'));return Promise.resolve();};HTMLMediaElement.prototype.pause=function(){(window.__paused=window.__paused||[]).push(this.getAttribute('src'));};};
 {const {context,page,errors}=await fresh({webSales:true,motion:true,init:PLAYS,routes:[['**/assets/setup/reel/*.mp4',()=>{}]]});try{   // (the clips' bytes never arrive: a phone mid-download)
  await toReel(page);await page.waitForTimeout(300);
  let s=await reelState(page);
  ok('a phone that plays H.264: the first clip (Fruit Slice) playing, the next (Hoops) loading behind it, muted, inline, no AirPlay',!s.stills&&s.on.length===1&&/^VIDEO:\/assets\/setup\/reel\/slice\.mp4$/.test(s.on[0])&&/hoops\.mp4$/.test(s.clips[1])&&await page.evaluate(()=>[...document.querySelectorAll('.reel-clip')].every(v=>v.muted&&v.hasAttribute('playsinline')&&v.hasAttribute('disableremoteplayback')&&v.getAttribute('x-webkit-airplay')==='deny'&&!v.hasAttribute('controls')&&!v.loop)&&__played.slice(-1)[0]==='/assets/setup/reel/slice.mp4'),s);
  ok('…its poster shown until its frames come',await page.evaluate(()=>document.querySelector('.reel-clip.on').getAttribute('poster')==='/assets/setup/reel/slice.webp'));
  await page.evaluate(()=>document.querySelector('.reel-clip.on').dispatchEvent(new Event('ended')));
  s=await reelState(page);
  ok('as a clip ends the next one fades in and plays, and the first keeps its own clip while it fades out (no third game mid-fade)',JSON.stringify(s.on)==='["VIDEO:/assets/setup/reel/hoops.mp4"]'&&/slice\.mp4$/.test(s.clips[0])&&await page.evaluate(()=>__played.slice(-1)[0]==='/assets/setup/reel/hoops.mp4'),s);
  await page.waitForTimeout(900);s=await reelState(page);
  ok('…then, the fade over, the first loads the one after (Piano Tiles)',JSON.stringify(s.on)==='["VIDEO:/assets/setup/reel/hoops.mp4"]'&&/tiles\.mp4$/.test(s.clips[0]),s);
  await next(page);await page.locator('[data-step="rachel"].on').waitFor();
  ok('leaving the reel pauses it',await page.evaluate(()=>(window.__paused||[]).length>=2));
  await page.evaluate(()=>{document.querySelector('.reel-clip.on').dispatchEvent(new Event('ended'));});
  ok('…and a clip that ends off the screen starts nothing',JSON.stringify((await reelState(page)).on)==='["VIDEO:/assets/setup/reel/hoops.mp4"]');
  clean('reel clips',errors);
 }finally{await context.close();}}
 // a phone that refuses to start a clip (Low Power Mode), and a clip that is not there
 for(const [label,init,routes] of [['a phone that refuses to start a clip',()=>{HTMLMediaElement.prototype.canPlayType=()=>'probably';HTMLMediaElement.prototype.play=()=>Promise.reject(new DOMException('no','NotAllowedError'));},[['**/assets/setup/reel/*.mp4',()=>{}],['**/assets/setup/reel/*.webp',r=>r.fulfill({status:404,body:''})]]],['a clip that is missing (404)',()=>{HTMLMediaElement.prototype.canPlayType=()=>'probably';HTMLMediaElement.prototype.play=()=>Promise.resolve();},[['**/assets/setup/reel/*.mp4',r=>r.fulfill({status:404,body:''})],['**/assets/setup/reel/*.webp',r=>r.fulfill({status:404,body:''})]]]]){
  const {context,page,errors}=await fresh({webSales:true,motion:true,init,routes});try{
   await toReel(page);await page.waitForFunction(()=>document.getElementById('reelFrame').classList.contains('stills'),null,{timeout:4000}).catch(()=>{});
   // (the poster is asked for as the clip gives up: read the frame once it has answered)
   await page.waitForFunction(()=>{const i=document.querySelector('#reelFrame .reel-still.on');return i&&i.complete&&(i.naturalWidth>0||i.classList.contains('gone'));},null,{timeout:4000}).catch(()=>{});
   const s=await reelState(page);
   ok(label+' (and no posters either): the Home cards instead (here Fruit Slice\'s), never a dead frame or a broken video',s.stills&&!s.clipShown&&JSON.stringify(s.on)==='["IMG:/assets/crafted/home-fruit.webp:card"]'&&!s.broken,s);
   clean('reel: '+label,errors);
  }finally{await context.close();}
 }
 // which games: the games screen's own rule, both age groups (no age asked yet)
 for(const [label,cfg,want] of [['a phone where the price follows',{webSales:true},['slice','hoops','tiles','bubbles','soccer','dino','feed','stack','run','glide','rise']],['a phone that cannot sell (only the games it opens)',{},['slice','tiles','bubbles','feed']]]){
  const {context,page,errors}=await fresh(Object.assign({motion:true,init:PLAYS,routes:[['**/assets/setup/reel/*.mp4',()=>{}]]},cfg));try{
   await toReel(page);
   const list=[];for(let i=0;i<want.length+1;i++){list.push((await reelState(page)).on[0].replace(/^VIDEO:\/assets\/setup\/reel\/|\.mp4$/g,''));await page.evaluate(()=>document.querySelector('.reel-clip.on').dispatchEvent(new Event('ended')));}
   const playable=await page.evaluate(()=>Object.keys(Sona.GAME_ACTS).filter(k=>!Sona.GAME_ACTS[k].comingSoon&&Sona.GAME_ACTS[k].available!==false&&(Sona.trialFirst()||Sona.gameAccess(k).allowed)));
   ok('the reel on '+label+': '+want.join(', ')+', then round again; never a Coming soon game',JSON.stringify(list)===JSON.stringify(want.concat([want[0]]))&&want.every(k=>playable.indexOf(k)>-1)&&playable.every(k=>want.indexOf(k)>-1),{list,playable});
   clean('reel list: '+label,errors);
  }finally{await context.close();}
 }
 // UNDER REDUCE MOTION NOTHING MOVES (the review of 22 Oct 2026): the first
 // game's poster, still: no clip asked for or started, no slideshow, even on
 // a phone that plays H.264
 {const {context,page,errors,requests}=await fresh({webSales:true,init:PLAYS,routes:[['**/assets/setup/reel/slice.webp',r=>r.fulfill({status:200,contentType:'image/webp',body:WEBP})]]});try{
  await toReel(page);await page.waitForTimeout(300);
  const s0=await reelState(page);await page.waitForTimeout(3700);const s1=await reelState(page);
  ok('under Reduce Motion the reel is the first game\'s poster, still: no clip asked for or played, and 4 s on the same picture (no slideshow)',s0.stills&&!s0.clipShown&&JSON.stringify(s0.on)==='["IMG:/assets/setup/reel/slice.webp"]'&&JSON.stringify(s1.on)===JSON.stringify(s0.on)&&!s1.broken&&!requests.some(r=>/\.mp4/.test(r.url))&&await page.evaluate(()=>!(window.__played||[]).length),{s0,s1});
  clean('reel, Reduce Motion',errors);
 }finally{await context.close();}}
 // a screen reader hears Echo's ask over the games; the pictures are decoration
 {const {context,page,errors}=await fresh({webSales:true});try{
  await toReel(page);
  const a=await page.evaluate(()=>{const say=document.querySelector('.reel-say'),hiddenUp=el=>{for(let n=el;n;n=n.parentElement)if(n.getAttribute&&n.getAttribute('aria-hidden')==='true')return true;return false;};return {say:hiddenUp(document.getElementById('reelSay')),text:say.textContent.trim(),pics:[...document.querySelectorAll('#reelFrame .reel-still,#reelFrame .reel-clip,.reel-say img')].every(e=>e.getAttribute('aria-hidden')==='true')};});
  ok('the reel\'s "Say your rrrr sound!" is read by a screen reader (no aria-hidden over it); its videos, stills and Echo are hidden as decoration',!a.say&&a.text==='Say your rrrr sound!'&&a.pics,a);
  clean('reel, screen reader',errors);
 }finally{await context.close();}}
});

// ── "HEAR ECHO" ──
await scenario('"Hear Echo": one recording, only on a tap, never with Sona\'s sound off',async()=>{
 const tts=(status)=>['**/api/tts',r=>status===200?r.fulfill({status:200,contentType:'application/octet-stream',headers:{'X-Sona-Voice-Keep':'0'},body:Buffer.alloc(4800,7)}):r.fulfill({status:503,body:'{}'})];
 {const {context,page,errors,requests}=await fresh({routes:[tts(200)]});try{
  await toReel(page);await page.waitForTimeout(900);
  ok('Echo\'s line and Rachel\'s take are fetched as the screens that sell start, and nothing plays by itself',await page.evaluate(()=>__s.media.length===0)&&requests.some(r=>/\/api\/tts$/.test(r.url))&&requests.some(r=>/\/coach\/say-echo\/R-sound\.wav$/.test(r.url)),requests.filter(r=>/tts|wav/.test(r.url)).map(r=>r.url));
  ok('"Hear Echo" is a real button with its name, on this screen only',await page.evaluate(()=>{const b=document.getElementById('reelHear');return b.tagName==='BUTTON'&&b.type==='button'&&/Hear Echo/.test(b.textContent)&&b.closest('[data-step="reel"]')!==null;}));
  await calm(page);await page.locator('#reelHear').click();
  let m=await page.evaluate(()=>__s.media);
  ok('a tap plays ONE recording: Echo\'s line, 200 ms of quiet, then Rachel\'s take of R, at Sona\'s volume',m.length===1&&m[0].len===4800+GAP+TAKE&&m[0].volume===0.8&&JSON.stringify(m[0].head)===JSON.stringify([7,7,7,7,7,7,7,7]),{m,want:4800+GAP+TAKE});
  ok('…with the wave moving while it plays',await page.evaluate(()=>document.getElementById('reelHear').classList.contains('playing')));
  await calm(page);await page.locator('#reelHear').click();
  ok('a second tap stops the first and plays it again (one at a time)',await page.evaluate(()=>__s.media.length===2&&__s.stops===1));
  await next(page);await page.locator('[data-step="rachel"].on').waitFor();
  ok('leaving the screen stops it',await page.evaluate(()=>__s.stops===2&&!document.getElementById('reelHear').classList.contains('playing')));
  ok('no microphone is asked for, no line is spoken by any other voice',await page.evaluate(()=>__s.mics===0&&!__s.spoke&&!window.speechSynthesis.speaking));
  clean('hear echo',errors);
 }finally{await context.close();}}
 {const {context,page,errors}=await fresh({routes:[tts(503)]});try{
  await toReel(page);await page.waitForTimeout(900);
  await calm(page);await page.locator('#reelHear').click();
  const m=await page.evaluate(()=>__s.media);
  ok('Echo\'s line not to be had: Rachel\'s take alone, still one recording, never the browser\'s robot voice',m.length===1&&m[0].len===TAKE&&await page.evaluate(()=>!__s.spoke&&!window.speechSynthesis.speaking),m);
  clean('hear echo, no line',errors);
 }finally{await context.close();}}
 // Sona's sound off is its volume at 0 (Settings' "Sound is off in Sona.").
 // (The page also honours voiceOn:false, but sona.js heals that flag back on
 // while the volume is audible, so the volume is the one switch a family has.)
 {const {context,page,errors,requests}=await fresh({profile:{volume:0},routes:[tts(200)]});try{
  await toReel(page);await page.waitForTimeout(600);
  await calm(page);await page.locator('#reelHear').click();await page.waitForTimeout(300);
  ok('Sona\'s sound off (volume 0): a tap plays nothing, and nothing was fetched for it',await page.evaluate(()=>__s.media.length===0)&&!requests.some(r=>/\/api\/tts$|R-sound\.wav$/.test(r.url)),requests.filter(r=>/tts|\.wav$/.test(r.url)).map(r=>r.url));
  // …and turned off while the screen is up (a grown-up in Settings, another tab)
  await page.evaluate(()=>Sona.saveProfile({volume:0.8}));await calm(page);await page.locator('#reelHear').click();await page.waitForTimeout(700);
  await calm(page);await page.locator('#reelHear').click();
  ok('turned back on, the first tap fetches what it needs and a tap after plays',await page.evaluate(()=>__s.media.length===1));
  await page.evaluate(()=>Sona.saveProfile({volume:0}));await calm(page);await page.locator('#reelHear').click();
  ok('…and a tap once it is off again stops what was playing and plays nothing new',await page.evaluate(()=>__s.media.length===1&&__s.stops===1),await page.evaluate(()=>__s));
  clean('hear echo: sound off',errors);
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
 for(const [mins,reps] of [['5',30],['10',60],['15',90],['skip',null]]){
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
  ok('an iPhone that can set a reminder, never asked, the price to follow: the reminder screen sits between ready and the microphone',await page.evaluate(()=>ORDER.join())==='welcome,problem,reel,rachel,name,interests,games,therapy,sounds,minutes,updates,ready,remind,mic');
  await setupWalk(page,'ready',{name:'Mia'});await next(page);await page.locator('[data-step="remind"].on').waitFor();
  const r=await page.evaluate(()=>{const st=document.querySelector('[data-step="remind"]'),painted=el=>getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0;return {title:document.getElementById('remindTitle').textContent,line:st.querySelector('.remind-line').textContent,yes:document.getElementById('remindYes').textContent,no:document.getElementById('remindNo').textContent,next:painted(document.getElementById('nextBtn')),back:painted(document.getElementById('backBtn')),bubble:document.getElementById('bubble').textContent,seg:document.getElementById('seg').hidden,focus:document.activeElement&&document.activeElement.id,saved:!!Sona.getProfile().onboarded,asks:__s.notifyAsks,name:/Mia/.test(st.textContent)};});
  ok('it asks, in a few words: "Want a reminder before your free trial ends?", "One notification, the day before.", "Turn on reminders" or "Not now"',r.title==='Want a reminder before your free trial ends?'&&r.line==='One notification, the day before.'&&r.yes==='Turn on reminders'&&r.no==='Not now'&&r.bubble==='I\'ll give you a heads-up!'&&!r.name,r);
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
  await page.evaluate(()=>{__s.notifyAsks+=0;window.__notifyAnswer('denied');});
  await page.waitForURL(u=>u.pathname==='/subscribe.html');
  ok('…and whatever the parent answers there, on to the price',new URL(page.url()).pathname==='/subscribe.html'&&(await at(page)).saved);
  clean('remind, a slow answer',errors);
 }finally{await context.close();}}
 {const {context,page,errors}=await fresh({webSales:true,notify:NOTIFY,init:COUNT});try{
  await setupWalk(page,'remind',{name:'Mia'});
  await calm(page);await page.locator('#remindNo').click();
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
   ['the yearly row, picked as the price opens, has no free days (only monthly does)',Object.assign({},FREE3,{year:{state:'paid',kind:'annual',price:'$59.99',per:'year',free:null,sure:false,why:'',best:true}}),null,false],
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
 for(const [label,plan,refresh] of [['the store answers 1 s after the ready screen showed',{late:1000,plan:FREE3},null],['iOS, asked afresh, never answers (its last word, never asked, stands)',FREE3,'hang']]){
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

// ── THE LOOK: Travis's brighter teal ──
await scenario('the main buttons are the brighter teal, a picked chip has its teal ring',async()=>{
 const {context,page,errors}=await fresh({webSales:true,notify:NOTIFY});try{
  const paint=sel=>page.evaluate(s=>{const c=getComputedStyle(document.querySelector(s));return {bg:c.backgroundImage+' '+c.backgroundColor,border:c.borderTopColor,shadow:c.boxShadow,text:c.color,ts:c.textShadow};},sel);
  const b=await paint('#nextBtn');
  ok('the footer button: #16c2be → #0e9c99, its edge and drop #0a8784, white words with a dark teal shadow',/rgb\(22, 194, 190\)/.test(b.bg)&&/rgb\(14, 156, 153\)/.test(b.bg)&&b.border==='rgb(10, 135, 132)'&&/rgb\(10, 135, 132\)/.test(b.shadow)&&b.text==='rgb(255, 255, 255)'&&/rgb\(8, 117, 114\)/.test(b.ts)&&isTeal(b.bg),b);
  await setupWalk(page,'name',{});
  await calm(page);await page.locator('#obAge [data-age="6"]').click();
  const chip=await paint('#obAge [data-age="6"]');
  ok('a picked chip: the teal ring (#11b3b0), a pale teal fill, dark teal words',chip.border==='rgb(17, 179, 176)'&&/rgb\(227, 247, 246\)/.test(chip.bg)&&chip.text==='rgb(7, 111, 108)',chip);
  await setupWalk(page,'remind',{name:'Mia'});
  const y=await paint('#remindYes');
  ok('"Turn on reminders" is the same teal button',/rgb\(22, 194, 190\)/.test(y.bg)&&y.border==='rgb(10, 135, 132)'&&isTeal(y.bg),y);
  clean('look',errors);
 }finally{await context.close();}
});

await browser.close();server.close();
console.log(failures?failures+' FAILURES / '+checks+' assertions':'ALL GREEN — '+checks+' assertions');
process.exit(failures?1:0);
