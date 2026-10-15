// SETUP'S NAME STEP HOLDS STILL (15 Oct 2026: Travis, "the onboard feels
// jumpy especially on the page where i put the name and age ... it just is a
// little glitchy").
//
// The page is played under the iPhone app's real keyboard timing, read off
// the installed plugin (node_modules/@capacitor/keyboard/ios/Sources/
// KeyboardPlugin/Keyboard.m, resize "native"): keyboardWillShow reaches the
// page at once, keyboardDidShow after the keyboard's slide (~250 ms), and the
// web view shrinks by the keyboard's height only 0.2 s after that (~450 ms).
// When the keyboard goes down, keyboardWillHide fires and the web view grows
// back 10 ms later. An iPhone also closes the keyboard whenever the name box
// loses focus, so the harness does too.
//
// Every animation frame records where the heading, the name box, the age
// choices and Continue are. Nothing about the step's content changes while
// the keyboard comes and goes, a name is typed or an age is picked, so none
// of them may move more than TOL px, appear or disappear. Leaving the step
// with the keyboard up must draw the next screen once, at its own size.
// STEADY_SHOTS=<path prefix> also saves a screenshot of each moment.
import {createServer} from 'http';
import {readFileSync,existsSync,statSync} from 'fs';
import path from 'path';
import {chromium,ROOT,launchOpts} from './_env.mjs';

const PORT=9620,base='http://127.0.0.1:'+PORT,TOL=3,SHOTS=process.env.STEADY_SHOTS||'';
// kb: the keyboard's height on that phone (no toolbar: setup hides it)
const DEVICES=[
  {name:'390x844',w:390,h:844,kb:336,top:47,bottom:34},
  {name:'375x667',w:375,h:667,kb:260,top:20,bottom:0},
  {name:'320x568',w:320,h:568,kb:253,top:20,bottom:0},
];
const mime={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',webp:'image/webp',woff2:'font/woff2',json:'application/json',webmanifest:'application/manifest+json'};
const server=createServer((req,res)=>{const u=new URL(req.url,base);if(u.pathname.startsWith('/api/')){res.writeHead(503,{'content-type':'application/json'});res.end('{}');return;}const file=path.join(ROOT,decodeURIComponent(u.pathname));if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':mime[file.split('.').pop()]||'application/octet-stream'});res.end(readFileSync(file));});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const browser=await chromium.launch(launchOpts());
let checks=0,failures=0;
function ok(name,pass,detail=''){checks++;if(!pass)failures++;console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' → '+JSON.stringify(detail)));}

// A new family on an iPhone running the app: every free-era stamp set (an
// onboarded seed without them is grandfathered), the trial-first and
// kept-buddies sweeps "post", and a Capacitor shell carrying the Keyboard
// plugin. The sampler is read back by the test.
function phoneInit(cfg){
  try{localStorage.getItem('x');}catch(e){return;}
  const once=(k,v)=>{if(localStorage.getItem(k)==null)localStorage.setItem(k,v);};
  once('sona.freeera.v1','post');['sona.freeera2.v1','sona.freeera3.v1','sona.freeera4.v1','sona.freeera5.v1'].forEach(k=>once(k,'done'));
  once('sona.freever.v1','post');once('sona.buddyset.v1','post');
  const S=window.__steady={kb:{},frames:[],on:false,kbState:'down',kbh:cfg.kb};
  window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'ios',Plugins:{Keyboard:{setAccessoryBarVisible(){return Promise.resolve();},addListener(n,cb){S.kb[n]=cb;return Promise.resolve({remove(){}});}}}};
  const SEL={card:'[data-step="name"]',heading:'[data-step="name"] .qh',label:'label[for="obName"]',field:'#obName',ageLabel:'#ageLabel',age4:'#obAge [data-age="4"]',age6:'#obAge [data-age="6"]',age8:'#obAge [data-age="8"]',echo:'.ob .mascot',seg:'#seg',
    tCard:'[data-step="therapy"]',tHead:'#therapyTitle',tYes:'#obTherapy [data-val="t_yes"]',btn:'#nextBtn'};
  // Where the LAYOUT puts an element: offsets, not the painted box, so a
  // screen's slide-in (a transform) is not a jump, and a box laid out again
  // is. Null when it is not drawn (display:none, or smaller than 2 px).
  function box(el){
    if(!el||!el.getClientRects().length||getComputedStyle(el).visibility==='hidden'||el.offsetWidth<2||el.offsetHeight<2)return null;
    let x=0,y=0;for(let n=el;n;n=n.offsetParent){x+=n.offsetLeft;y+=n.offsetTop;}
    for(let p=el.parentElement;p;p=p.parentElement){x-=p.scrollLeft;y-=p.scrollTop;}
    return {x:Math.round(x*10)/10,y:Math.round(y*10)/10,w:el.offsetWidth,h:el.offsetHeight};
  }
  // Continue sits in the fixed footer, which never slides: its painted box
  function paint(el){if(!el)return null;const r=el.getBoundingClientRect();return r.width<2||r.height<2?null:{x:Math.round(r.left*10)/10,y:Math.round(r.top*10)/10,w:Math.round(r.width*10)/10,h:Math.round(r.height*10)/10};}
  function tick(){
    if(!S.on)return;
    const b=document.body,f={t:Math.round(performance.now()),screen:b&&b.dataset.setupScreen,kb:S.kbState,h:innerHeight,active:document.activeElement&&document.activeElement.id,settling:!!(b&&b.classList.contains('ob-settling')),r:{}};
    for(const k in SEL)f.r[k]=(k==='btn'?paint:box)(document.querySelector(SEL[k]));
    const foot=document.querySelector('.obfoot'),btn=document.getElementById('nextBtn');
    f.footOp=foot?+getComputedStyle(foot).opacity:1;f.btnFont=btn?getComputedStyle(btn).fontSize:'';
    S.frames.push(f);requestAnimationFrame(tick);
  }
  S.start=()=>{S.frames=[];S.on=true;requestAnimationFrame(tick);};
  S.take=()=>{const f=S.frames;S.frames=[];return f;};
}

// Motion on, as a phone is by default. (Under Reduce Motion sona.css gives
// every property a 0.01 ms transition, so the frame after any change still
// paints the old value, on every screen of the app: a separate matter.)
async function openPhone(D){
  const context=await browser.newContext({viewport:{width:D.w,height:D.h},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'no-preference',timezoneId:'America/Boise'});
  await context.addInitScript(phoneInit,{kb:D.kb});
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());if(!url.href.startsWith(base+'/'))return route.abort();
    // Desktop Chromium has no safe areas: put the phone's own in, so the notch and the home bar take their real room
    if(/\.(html|css)$/.test(url.pathname)){const file=path.join(ROOT,url.pathname);if(existsSync(file))return route.fulfill({contentType:url.pathname.endsWith('.css')?'text/css':'text/html',body:readFileSync(file,'utf8').replace(/env\(safe-area-inset-top\)/g,D.top+'px').replace(/env\(safe-area-inset-bottom\)/g,D.bottom+'px')});}
    return route.continue();
  });
  const page=await context.newPage();page.setDefaultTimeout(4000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/onboarding.html');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
  return {context,page,errors};
}
// the plugin, in order: willShow now; didShow after the slide; the web view shrinks 0.2 s later
async function kbShow(page,D,shot){
  await page.evaluate(()=>{__steady.kbState='rising';const f=__steady.kb.keyboardWillShow;if(f)f({keyboardHeight:__steady.kbh});});
  await page.waitForTimeout(250);
  await page.evaluate(()=>{const f=__steady.kb.keyboardDidShow;if(f)f({keyboardHeight:__steady.kbh});});
  if(shot)await shot();
  await page.waitForTimeout(200);
  await page.setViewportSize({width:D.w,height:D.h-D.kb});
  await page.evaluate(()=>{__steady.kbState='up';});
}
async function kbHide(page,D){
  await page.evaluate(()=>{__steady.kbState='down';const f=__steady.kb.keyboardWillHide;if(f)f();});
  await page.waitForTimeout(10);
  await page.setViewportSize({width:D.w,height:D.h});
}
// an iPhone closes the keyboard whenever the box loses focus
async function followFocus(page,D){if(await page.evaluate(()=>document.activeElement&&document.activeElement.id)!=='obName'&&await page.evaluate(()=>__steady.kbState)!=='down')await kbHide(page,D);}
const calm=page=>page.evaluate(()=>document.body.classList.remove('ob-settling'));
const center=(page,sel)=>page.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};},sel);
async function tapAt(page,sel){const c=await center(page,sel);await page.touchscreen.tap(c.x,c.y);}
// a dark band where the keyboard is, for the screenshots taken before the web view shrinks
const band=(page,D,on)=>page.evaluate(([on,h])=>{let d=document.getElementById('__kb');if(!on){if(d)d.remove();return;}if(!d){d=document.createElement('div');d.id='__kb';d.style.cssText='position:fixed;left:0;right:0;bottom:0;height:'+h+'px;background:rgba(40,40,48,.85);z-index:999999;pointer-events:none;color:#fff;font:600 15px system-ui;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 20px';d.textContent='keyboard (risen; the app has not resized the page yet)';document.documentElement.appendChild(d);}},[on,D.kb]);

// How far each element strays from where it first stood, over a run of
// frames; and whether it ever appeared or disappeared.
const KEYS=['heading','label','field','ageLabel','age4','age6','age8','card'];
function drift(frames,keys=KEYS,ref=null){
  const out={};
  for(const k of keys){
    let first=ref?ref[k]:undefined,maxY=0,maxX=0,maxW=0,flips=0,seen=false;
    for(const f of frames){const r=f.r[k];if(first===undefined){first=r;seen=true;continue;}
      if(!!r!==!!first){flips++;continue;}
      if(r){maxY=Math.max(maxY,Math.abs(r.y-first.y));maxX=Math.max(maxX,Math.abs(r.x-first.x));maxW=Math.max(maxW,Math.abs(r.w-first.w));}}
    out[k]={y:+maxY.toFixed(1),x:+maxX.toFixed(1),w:+maxW.toFixed(1),flips,shown:!!first};
  }
  return out;
}
const still=d=>Object.values(d).every(v=>v.flips===0&&v.y<=TOL&&v.x<=TOL&&v.w<=TOL);
const worst=d=>Object.entries(d).filter(([,v])=>v.flips||v.y>TOL||v.x>TOL||v.w>TOL).map(([k,v])=>k+(v.flips?' appears/vanishes '+v.flips+'x':'')+(v.y>TOL?' moves '+v.y+'px':'')+(v.x>TOL?' sideways '+v.x+'px':'')+(v.w>TOL?' resizes '+v.w+'px':'')).join('; ')||'none';

for(const D of DEVICES){
 const {context,page,errors}=await openPhone(D);const at=' at '+D.name;
 const shot=SHOTS?async n=>{await page.screenshot({path:SHOTS+'-'+D.name+'-'+n+'.png'});}:null;
 try{
  // 1. the hello's Continue: the name step opens, focuses the box (the keyboard rises with it)
  await page.evaluate(()=>__steady.start());
  await page.tap('#nextBtn');
  await page.locator('[data-step="name"].on').waitFor();
  if(shot)await shot('1-arrive-keyboard-down');
  await kbShow(page,D,shot?async()=>{await band(page,D,true);await shot('2-keyboard-risen');await band(page,D,false);}:null);
  await page.waitForTimeout(600);
  if(shot)await shot('3-keyboard-up');
  const arrive=(await page.evaluate(()=>__steady.take())).filter(f=>f.screen==='name');
  const dA=drift(arrive);
  ok('the name box is focused on arrival, as before (the keyboard comes up with the step)'+at,arrive.length>0&&arrive[arrive.length-1].active==='obName',arrive.length&&arrive[arrive.length-1].active);
  ok('while the keyboard rises and the app shrinks the page, the heading, the box and the age choices hold still'+at+' (worst: '+worst(dA)+')',still(dA),dA);
  // Continue: never drawn where the risen keyboard covers it, and once the page is its new size, fully above the keyboard
  {const rising=arrive.filter(f=>f.kb==='rising'&&f.h===D.h),up=arrive.filter(f=>f.h===D.h-D.kb),last=up[up.length-1];
   const covered=rising.filter(f=>f.footOp>0.05&&f.r.btn&&f.r.btn.y+f.r.btn.h>D.h-D.kb);
   ok('Continue is not shown under the keyboard while it rises'+at,rising.length>0&&covered.length===0,{risingFrames:rising.length,coveredFrames:covered.length,firstCovered:covered[0]&&{op:covered[0].footOp,btn:covered[0].r.btn}});
   ok('…and once the page has its new size, Continue is on screen above the keyboard'+at,!!last&&last.footOp>0.95&&!!last.r.btn&&last.r.btn.y+last.r.btn.h<=D.h-D.kb+0.5,last&&{op:last.footOp,btn:last.r.btn,h:last.h});
   const fonts=[...new Set(arrive.map(f=>f.btnFont))],xs=arrive.filter(f=>f.r.btn).map(f=>f.r.btn.x),ws=arrive.filter(f=>f.r.btn).map(f=>f.r.btn.w);
   ok('…and keeps its width, place across and lettering'+at,fonts.length===1&&Math.max(...xs)-Math.min(...xs)<=TOL&&Math.max(...ws)-Math.min(...ws)<=TOL,{fonts,xs:[Math.min(...xs),Math.max(...xs)],ws:[Math.min(...ws),Math.max(...ws)]});
   // what fits above the keyboard: everything the step asks, above Continue, with no scrolling needed
   const fit=await page.evaluate(()=>{const b=document.getElementById('nextBtn').getBoundingClientRect(),q=document.querySelector('[data-step="name"] .qh').getBoundingClientRect(),n=document.getElementById('obName').getBoundingClientRect(),a=[...document.querySelectorAll('#obAge .sound')].map(x=>x.getBoundingClientRect());return {btnTop:b.top,headTop:q.height?q.top:null,fieldTop:n.top,fieldBottom:n.bottom,agesBottom:Math.max(...a.map(r=>r.bottom)),ob:document.querySelector('.ob').scrollTop,sideways:document.documentElement.scrollWidth-innerWidth};});
   ok('with the keyboard up, the box and all three age choices sit above Continue, nothing scrolled'+at,fit.fieldTop>=D.top&&(fit.headTop===null||fit.headTop>=D.top)&&fit.agesBottom<=fit.btnTop&&fit.ob===0&&fit.sideways<=0,fit);
  }
  const home=arrive[arrive.length-1].r;   // where the step stands: every later moment is held to it
  // 2. typing a name
  await page.evaluate(()=>__steady.start());
  await page.keyboard.type('Milo',{delay:40});await page.waitForTimeout(200);
  const dT=drift(await page.evaluate(()=>__steady.take()),KEYS,home);
  ok('typing a name moves nothing'+at+' (worst: '+worst(dT)+')',still(dT),dT);
  // 3. picking an age with the keyboard up: the tap must not close the keyboard under the finger
  await page.evaluate(()=>__steady.start());
  await tapAt(page,'#obAge [data-age="6"]');
  const afterAge=await page.evaluate(()=>({active:document.activeElement&&document.activeElement.id,pressed:document.querySelector('#obAge [data-age="6"]').getAttribute('aria-pressed'),age:draft.childAge}));
  await followFocus(page,D);await page.waitForTimeout(500);
  const dG=drift((await page.evaluate(()=>__steady.take())).filter(f=>f.screen==='name'),KEYS,home);
  ok('an age tap picks the age and leaves the name box focused, so the keyboard stays up'+at,afterAge.active==='obName'&&afterAge.pressed==='true'&&afterAge.age==='6',afterAge);
  ok('…and nothing moves under the finger'+at+' (worst: '+worst(dG)+')',still(dG),dG);
  // 4. Done on the keyboard: the box lets go and the keyboard goes down
  await page.evaluate(()=>__steady.start());
  await page.keyboard.press('Enter');await followFocus(page,D);await page.waitForTimeout(500);
  if(shot)await shot('4-keyboard-down-after-done');
  const done=await page.evaluate(()=>__steady.take());
  const dD=drift(done.filter(f=>f.screen==='name'),KEYS,home);
  ok('Done closes the keyboard and the step stays exactly where it was'+at+' (worst: '+worst(dD)+')',done[done.length-1].active!=='obName'&&still(dD),dD);
  // 5. the box tapped again: the keyboard comes back up
  await page.evaluate(()=>__steady.start());
  await tapAt(page,'#obName');await kbShow(page,D);await page.waitForTimeout(500);
  const dR=drift((await page.evaluate(()=>__steady.take())).filter(f=>f.screen==='name'),KEYS,home);
  ok('tapping the box again brings the keyboard back with nothing moving'+at+' (worst: '+worst(dR)+')',still(dR),dR);
  // 6. Continue with the keyboard up: the box lets go, the keyboard goes down,
  // and the next question is drawn once, at the phone's full height
  await page.evaluate(()=>__steady.start());
  await page.tap('#nextBtn');await followFocus(page,D);
  await page.locator('[data-step="therapy"].on').waitFor();await page.waitForTimeout(600);
  const leave=(await page.evaluate(()=>__steady.take())).filter(f=>f.screen==='therapy'&&f.r.tCard);
  const dL=drift(leave,['tHead','tYes','tCard','echo']);
  // (Echo included: he is beside the question from its first frame, or, on a phone too short for him, never)
  ok('Continue with the keyboard up: the next question opens once, at its own size, nothing re-laid out after it shows'+at+' (worst: '+worst(dL)+')',leave.length>0&&still(dL),dL);
  // 7. Back to the name: the step looks exactly as it did the first time
  await page.waitForTimeout(500);await calm(page);
  await page.evaluate(()=>__steady.start());
  await page.tap('#backBtn');await page.locator('[data-step="name"].on').waitFor();await kbShow(page,D);await page.waitForTimeout(500);
  const back=(await page.evaluate(()=>__steady.take())).filter(f=>f.screen==='name');
  const dB=drift(back,KEYS,home);
  ok('Back to the name: it opens where it stood before, and the keyboard rising moves nothing'+at+' (worst: '+worst(dB)+')',back.length>0&&back[back.length-1].active==='obName'&&still(dB),dB);
  ok('no runtime errors'+at,errors.length===0,errors);
 }catch(e){ok('the walk completes'+at,false,e.stack);}
 finally{await context.close();}
}

// A tap on the name box in the half second after the step changes (the tap
// lock: "nothing moves under a finger") is a tap on the box. It used to fall
// through the lock to the page and take focus off the box, which on a phone
// drops the keyboard just as it rises.
{const D=DEVICES[0],{context,page,errors}=await openPhone(D);try{
  await page.tap('#nextBtn');await page.locator('[data-step="name"].on').waitFor();
  const c=await center(page,'#obName'),settling=await page.evaluate(()=>document.body.classList.contains('ob-settling'));
  await page.touchscreen.tap(c.x,c.y);
  const st=await page.evaluate(()=>({active:document.activeElement&&document.activeElement.id,settling:document.body.classList.contains('ob-settling'),screen:document.body.dataset.setupScreen}));
  ok('a tap on the name box during the tap lock keeps the box focused (the keyboard is not dropped)',settling&&st.active==='obName'&&st.screen==='name',{settling,...st});
  // …and the lock still holds everything that moves setup on
  const age=await center(page,'#obAge [data-age="8"]');
  await page.evaluate(()=>document.body.classList.add('ob-settling'));await page.touchscreen.tap(age.x,age.y);
  ok('…while an age choice under the lock is still not taken',await page.evaluate(()=>draft.childAge!=='8'));
  ok('no runtime errors (tap lock)',errors.length===0,errors);
 }finally{await context.close();}}

// With motion on, the step enters as one piece: the heading, the labels, the
// box and the age choices ride with the card and never slide on their own,
// so the keyboard rising over the entrance is the only other motion.
{const D=DEVICES[0],{context,page,errors}=await openPhone(D);try{
  await page.tap('#nextBtn');
  // painted boxes this time: a slide shows in where things are drawn
  const fr=await page.evaluate(()=>{const out=[],t0=performance.now();return new Promise(done=>{(function grab(){const card=document.querySelector('[data-step="name"]');if(document.body.dataset.setupScreen==='name'&&card){const r={card:card.getBoundingClientRect().top};for(const [k,s] of Object.entries({heading:'[data-step="name"] .qh',label:'label[for="obName"]',field:'#obName',ageLabel:'#ageLabel',age6:'#obAge [data-age="6"]'})){const b=document.querySelector(s).getBoundingClientRect();r[k]=b.height>1?b.top:null;}out.push(r);}if(performance.now()-t0<650)requestAnimationFrame(grab);else done(out);})();});});
  const rel={};for(const k of ['heading','label','field','ageLabel','age6']){const ds=fr.filter(f=>f[k]!==null).map(f=>f[k]-f.card);rel[k]=ds.length?+(Math.max(...ds)-Math.min(...ds)).toFixed(1):null;}
  ok('with motion on, the name step slides in as one piece: nothing moves inside the card ('+JSON.stringify(rel)+')',fr.length>5&&Object.values(rel).every(v=>v!==null&&v<=1.5),{frames:fr.length,rel});
  ok('no runtime errors (motion on)',errors.length===0,errors);
 }finally{await context.close();}}

await browser.close();server.close();
console.log('\n'+checks+' checks, '+failures+' failures');
process.exit(failures?1:0);
