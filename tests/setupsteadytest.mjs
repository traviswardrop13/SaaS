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
// with the keyboard up must draw the next screen once, at its own size. The
// walk runs with motion on and again under Reduce Motion.
//
// The walk is played again (motion on) with the taller keyboards an iPhone SE
// can have (268, and 280, the tallest its own size fits above with the footer)
// and on a Face ID iPhone in Display Zoom (320x693, 300 and 336): a rule meant
// for an iPad on its side used to hide the progress bar and the label there
// as the keyboard rose, and the box jumped 67 px. And with keyboards too tall
// for the SE's own size (291 and 320: a third-party keyboard's number row):
// there the age choices sat under the footer (from 281) and under Continue
// (from 297), and a tap on "5–6" opened the next question with no age. The
// SE takes the 4-inch size as that keyboard starts to rise, before the page
// shrinks, and keeps it: after that one change nothing moves.
//
// After it, the review's edges (15 Oct 2026): a double tap or a tap during the
// tap lock never drops the box's focus; on the website an age tap lets go of
// the box (only the app lifts Continue above the keyboard); an iPad turned
// with the keyboard up is not sized by the keyboard, either way round; a
// short laptop window keeps the full-size step, and its margins and Continue
// follow the window's height like the screens around it; an iPad's hardware
// keyboard moves nothing.
// STEADY_SHOTS=<path prefix> also saves a screenshot of each moment.
import {createServer} from 'http';
import {readFileSync,existsSync,statSync} from 'fs';
import path from 'path';
import {chromium,ROOT,launchOpts} from './_env.mjs';

const PORT=9620,base='http://127.0.0.1:'+PORT,TOL=3,SHOTS=process.env.STEADY_SHOTS||'';
// kb: the keyboard's height on that phone (no toolbar: setup hides it).
// taller: a taller keyboard on the same phone, played with motion on only (the
// Reduce Motion pass is about each screen's first frame, not the keyboard).
// tooTall: a keyboard the phone's own size does not fit above (onboarding.html,
// ROOM): the step takes the 4-inch size as it starts to rise.
const DEVICES=[
  {name:'390x844',w:390,h:844,kb:336,top:47,bottom:34},
  {name:'375x667',w:375,h:667,kb:260,top:20,bottom:0},
  {name:'320x568',w:320,h:568,kb:253,top:20,bottom:0},
  {name:'375x667 kb268',w:375,h:667,kb:268,top:20,bottom:0,taller:true},
  {name:'375x667 kb280',w:375,h:667,kb:280,top:20,bottom:0,taller:true},
  {name:'375x667 kb291',w:375,h:667,kb:291,top:20,bottom:0,taller:true,tooTall:true},
  {name:'375x667 kb320',w:375,h:667,kb:320,top:20,bottom:0,taller:true,tooTall:true},
  {name:'320x693 kb300',w:320,h:693,kb:300,top:44,bottom:34,taller:true},
  {name:'320x693 kb336',w:320,h:693,kb:336,top:44,bottom:34,taller:true},
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
  if(!cfg.web)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'ios',Plugins:{Keyboard:{setAccessoryBarVisible(){return Promise.resolve();},addListener(n,cb){S.kb[n]=cb;return Promise.resolve({remove(){}});}}}};
  const SEL={card:'[data-step="name"]',heading:'[data-step="name"] .qh',label:'label[for="obName"]',field:'#obName',ageLabel:'#ageLabel',age4:'#obAge [data-age="4"]',age6:'#obAge [data-age="6"]',age8:'#obAge [data-age="8"]',echo:'.ob .mascot',seg:'#seg',
    tCard:'[data-step="interests"]',tHead:'#interestsTitle',tYes:'#obInterests [data-val="sports"]',btn:'#nextBtn',
    sCard:'.step.sell.on',sHead:'.step.sell.on h1',sPic:'.step.sell.on .rachel-photo',sScene:'.step.sell.on .demo-scene',sGrid:'.step.sell.on #gamesGrid',sLast:'.step.sell.on #gamesGrid li:last-child',
    rCard:'[data-step="ready"].on',rHead:'[data-step="ready"].on #readyTitle',rChips:'[data-step="ready"].on #readyChips',
    rPlan:'[data-step="ready"].on #planCard',rPlanPic:'[data-step="ready"].on #planPic',rPlanMore:'[data-step="ready"].on #planMore'};
  // Keep the demo's heading steady as assets arrive (the problem slide and
  // its picture went on 31 Oct 2026, Piano Tiles' demo on 1 Nov 2026). Only the canvas changes during demos;
  // the ready screen's existing Echo motion still ends, and Reduce Motion
  // must begin at that final frame.
  const VIS={rTitle:'.step.on #reelTitle',rEcho:'.step.on .ready-echo img',rSpark:'.step.on .spark'};
  function seen(sel){let best=null;for(const el of document.querySelectorAll(sel)){const cs=getComputedStyle(el),r=el.getBoundingClientRect(),o=+cs.opacity;const v=cs.display==='none'||r.width<2||r.height<2||cs.visibility==='hidden'?null:{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),o:Math.round(o*100)/100};if(v&&(!best||v.o>best.o))best=v;}return best&&best.o>0?best:null;}
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
    const b=document.body,f={t:Math.round(performance.now()),screen:b&&b.dataset.setupScreen,kb:S.kbState,open:!!(b&&b.classList.contains('keyboard-open')),h:innerHeight,active:document.activeElement&&document.activeElement.id,settling:!!(b&&b.classList.contains('ob-settling')),r:{}};
    for(const k in SEL)f.r[k]=(k==='btn'?paint:box)(document.querySelector(SEL[k]));
    f.v={};for(const k in VIS)f.v[k]=seen(VIS[k]);
    const foot=document.querySelector('.obfoot'),btn=document.getElementById('nextBtn');
    f.footOp=foot?+getComputedStyle(foot).opacity:1;f.btnFont=btn?getComputedStyle(btn).fontSize:'';
    S.frames.push(f);requestAnimationFrame(tick);
  }
  S.start=()=>{S.frames=[];S.on=true;requestAnimationFrame(tick);};
  S.take=()=>{const f=S.frames;S.frames=[];return f;};
}

// Motion on, as a phone is by default, or Reduce Motion (opt.reduced: sona.css
// then gives every property a 0.01 ms transition, and setup takes none).
// opt.web: the website, no app shell (an Android phone in Chrome);
// opt.laptop: a desktop browser, mouse and no touch.
const ANDROID='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
async function openPhone(D,opt={}){
  const context=await browser.newContext({viewport:{width:D.w,height:D.h},isMobile:!opt.laptop,hasTouch:!opt.laptop,deviceScaleFactor:opt.laptop?1:2,reducedMotion:opt.reduced?'reduce':'no-preference',timezoneId:'America/Boise',...(opt.web&&!opt.laptop?{userAgent:ANDROID}:{})});
  await context.addInitScript(phoneInit,{kb:D.kb,web:!!(opt.web||opt.laptop)});
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());if(!url.href.startsWith(base+'/'))return route.abort();
    // Desktop Chromium has no safe areas: put the phone's own in, so the notch and the home bar take their real room
    if(/\.(html|css)$/.test(url.pathname)){const file=path.join(ROOT,url.pathname);if(existsSync(file))return route.fulfill({contentType:url.pathname.endsWith('.css')?'text/css':'text/html',body:readFileSync(file,'utf8').replace(/env\(safe-area-inset-top\)/g,D.top+'px').replace(/env\(safe-area-inset-bottom\)/g,D.bottom+'px')});}
    return route.continue();
  });
  const page=await context.newPage();page.setDefaultTimeout(4000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+(opt.path||'/onboarding.html'));await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
  return {context,page,errors};
}
// The window is resized by Playwright, which makes the screen the window's
// size too; an iPad that turns sizes it through D.win instead (ipadWindow).
const sizeTo=(page,D,w,h)=>D.win?D.win(w,h):page.setViewportSize({width:w,height:h});
// the plugin, in order: willShow now; didShow after the slide; the web view shrinks 0.2 s later
async function kbShow(page,D,shot){
  await page.evaluate(()=>{__steady.kbState='rising';const f=__steady.kb.keyboardWillShow;if(f)f({keyboardHeight:__steady.kbh});});
  await page.waitForTimeout(250);
  await page.evaluate(()=>{const f=__steady.kb.keyboardDidShow;if(f)f({keyboardHeight:__steady.kbh});});
  if(shot)await shot();
  await page.waitForTimeout(200);
  await sizeTo(page,D,D.w,D.h-D.kb);
  await page.evaluate(()=>{__steady.kbState='up';});
}
async function kbHide(page,D){
  await page.evaluate(()=>{__steady.kbState='down';const f=__steady.kb.keyboardWillHide;if(f)f();});
  await page.waitForTimeout(10);
  await sizeTo(page,D,D.w,D.h);
}
// AN IPAD'S SCREEN never shrinks for the keyboard, and iOS reports it upright
// whichever way the iPad is turned (setup reads only its two sides and which
// way it is turned). Playwright's setViewportSize would shrink the screen with
// the window, so the turning tests size the window through DevTools.
async function ipadWindow(page,sw=820,sh=1180){
  const cdp=await page.context().newCDPSession(page);
  return (w,h)=>cdp.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:2,mobile:true,screenWidth:sw,screenHeight:sh,screenOrientation:w>sw?{type:'landscapePrimary',angle:90}:{type:'portraitPrimary',angle:0}});
}
// an iPhone closes the keyboard whenever the box loses focus
async function followFocus(page,D){if(await page.evaluate(()=>document.activeElement&&document.activeElement.id)!=='obName'&&await page.evaluate(()=>__steady.kbState)!=='down')await kbHide(page,D);}
const calm=page=>page.evaluate(()=>document.body.classList.remove('ob-settling'));
// THE NAME COMES RIGHT AFTER THE HELLO (Travis, 1 Nov 2026: "we'll ask the
// child's name and age first, right after the hello"; from 22 Oct to 1 Nov
// the game demos and Rachel came between them). So the screen right before
// the name is the hello: wait there until its "Get started" takes a tap
// (on a visit's first hello it waits for its own entrance, hello-wait).
async function toBeforeName(page){await page.waitForFunction(()=>document.body.dataset.setupScreen==='welcome'&&!document.body.classList.contains('hello-wait'),null,{timeout:6000});await calm(page);}
const center=(page,sel)=>page.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};},sel);
async function tapAt(page,sel){const c=await center(page,sel);await page.touchscreen.tap(c.x,c.y);}
// a dark band where the keyboard is, for the screenshots taken before the web view shrinks
const band=(page,D,on)=>page.evaluate(([on,h])=>{let d=document.getElementById('__kb');if(!on){if(d)d.remove();return;}if(!d){d=document.createElement('div');d.id='__kb';d.style.cssText='position:fixed;left:0;right:0;bottom:0;height:'+h+'px;background:rgba(40,40,48,.85);z-index:999999;pointer-events:none;color:#fff;font:600 15px system-ui;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 20px';d.textContent='keyboard (risen; the app has not resized the page yet)';document.documentElement.appendChild(d);}},[on,D.kb]);

// How far each element strays from where it first stood, over a run of
// frames; and whether it ever appeared or disappeared.
const KEYS=['heading','label','field','ageLabel','age4','age6','age8','card','seg'];
function drift(frames,keys=KEYS,ref=null){
  const out={};
  for(const k of keys){
    let first=ref?ref[k]:undefined,maxY=0,maxX=0,maxW=0,maxH=0,flips=0,seen=false;
    for(const f of frames){const r=f.r[k];if(first===undefined){first=r;seen=true;continue;}
      if(!!r!==!!first){flips++;continue;}
      if(r){maxY=Math.max(maxY,Math.abs(r.y-first.y));maxX=Math.max(maxX,Math.abs(r.x-first.x));maxW=Math.max(maxW,Math.abs(r.w-first.w));maxH=Math.max(maxH,Math.abs(r.h-first.h));}}
    out[k]={y:+maxY.toFixed(1),x:+maxX.toFixed(1),w:+maxW.toFixed(1),h:+maxH.toFixed(1),flips,shown:!!first};
  }
  return out;
}
const still=d=>Object.values(d).every(v=>v.flips===0&&v.y<=TOL&&v.x<=TOL&&v.w<=TOL&&v.h<=TOL);
const worst=d=>Object.entries(d).filter(([,v])=>v.flips||v.y>TOL||v.x>TOL||v.w>TOL||v.h>TOL).map(([k,v])=>k+(v.flips?' appears/vanishes '+v.flips+'x':'')+(v.y>TOL?' moves '+v.y+'px':'')+(v.x>TOL?' sideways '+v.x+'px':'')+(v.w>TOL?' resizes '+v.w+'px':'')+(v.h>TOL?' grows/shrinks '+v.h+'px':'')).join('; ')||'none';
// the first frame a screen is drawn in, against the last: the same size and place
const firstLast=(frames,k)=>{const fs=frames.filter(f=>f.r[k]);if(fs.length<2)return {n:fs.length};const a=fs[0].r[k],b=fs[fs.length-1].r[k];return {first:a,last:b,same:Math.abs(a.y-b.y)<=TOL&&Math.abs(a.h-b.h)<=TOL&&Math.abs(a.w-b.w)<=TOL};};
// a Face ID iPhone in Display Zoom (320x693) takes the 4-inch phone's size: its notch and keyboard leave it less room than an SE
const SIZES={'390x844':[],'375x667':['ob-short'],'320x568':['ob-short','ob-tiny'],'320x693':['ob-short','ob-tiny']};
const sizeClasses=page=>page.evaluate(()=>['ob-short','ob-tiny'].filter(c=>document.documentElement.classList.contains(c)));

for(const reduced of [false,true])for(const D of DEVICES){
 if(reduced&&D.taller)continue;
 const {context,page,errors}=await openPhone(D,{reduced});const at=' at '+D.name+(reduced?' with Reduce Motion':'');
 const shot=SHOTS?async n=>{await page.screenshot({path:SHOTS+'-'+D.name+(reduced?'-reduce':'')+'-'+n+'.png'});}:null;
 try{
  // the phone's own height picks the step's size (a touch screen: the classes are for phones and tablets)
  {const cls=await sizeClasses(page);ok('the phone\'s height picks the name step\'s size ('+(cls.join(' ')||'full')+')'+at,JSON.stringify(cls)===JSON.stringify(SIZES[D.w+'x'+D.h]),cls);}
  // 1. The hello's Get started: the name step opens, focuses the box (the keyboard rises with it)
  await toBeforeName(page);await page.waitForTimeout(500);
  await page.evaluate(()=>__steady.start());
  await page.tap('#nextBtn');
  await page.locator('[data-step="name"].on').waitFor();
  if(shot)await shot('1-arrive-keyboard-down');
  await kbShow(page,D,shot?async()=>{await band(page,D,true);await shot('2-keyboard-risen');await band(page,D,false);}:null);
  await page.waitForTimeout(600);
  if(shot)await shot('3-keyboard-up');
  let arrive=(await page.evaluate(()=>__steady.take())).filter(f=>f.screen==='name');
  // A keyboard too tall for the phone's own size: the step is the SE's size
  // until the keyboard starts to rise (in the app that is ~20 ms after the box
  // takes focus, as the step fades in) and the 4-inch size from that frame on.
  // Everything after is held to the 4-inch size, as any phone's is to its own.
  if(D.tooTall){const pre=arrive.filter(f=>f.kb==='down'),post=arrive.filter(f=>f.kb!=='down'),cls=await sizeClasses(page);
   ok('a keyboard too tall for the SE\'s own size gives the step the 4-inch size as it starts to rise, before the page shrinks'+at,pre.every(f=>f.r.seg&&f.r.label)&&post.length>0&&post.every(f=>!f.r.seg&&!f.r.label)&&JSON.stringify(cls)==='["ob-short","ob-tiny"]',{pre:pre.map(f=>[!!f.r.seg,!!f.r.label]),post:[...new Set(post.map(f=>!!f.r.seg+'/'+!!f.r.label))],cls});
   arrive=post;}
  const dA=drift(arrive);
  {const c=firstLast(arrive,'card');ok('the name card\'s first frame is drawn at its own size, not Rachel\'s'+at,!!c.same,c);}
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
   const fit=await page.evaluate(()=>{const b=document.getElementById('nextBtn').getBoundingClientRect(),q=document.querySelector('[data-step="name"] .qh').getBoundingClientRect(),n=document.getElementById('obName').getBoundingClientRect(),a=[...document.querySelectorAll('#obAge .sound')].map(x=>x.getBoundingClientRect());return {btnTop:b.top,footTop:document.querySelector('.obfoot').getBoundingClientRect().top,headTop:q.height?q.top:null,fieldTop:n.top,fieldBottom:n.bottom,agesBottom:Math.max(...a.map(r=>r.bottom)),ob:document.querySelector('.ob').scrollTop,sideways:document.documentElement.scrollWidth-innerWidth};});
   ok('with the keyboard up, the box and all three age choices sit above Continue, nothing scrolled'+at,fit.fieldTop>=D.top&&(fit.headTop===null||fit.headTop>=D.top)&&fit.agesBottom<=fit.btnTop&&fit.ob===0&&fit.sideways<=0,fit);
   // The footer's whole box takes taps, its fade above Continue too, so an
   // age choice reaching into it is dead there (at a 291 keyboard on the SE's
   // own size, the bottom 11 px of each). Not held on the 4-inch phone, whose
   // smallest size leaves its ages 3.5 px into the fade with its 253 keyboard
   // (a tap there does nothing; there is no smaller size to give it).
   if(!(D.w===320&&D.h===568))ok('…and clear the footer (its fade takes taps), so a tap anywhere on an age choice picks it'+at,fit.agesBottom<=fit.footTop+0.5,fit);
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
  // and the next screen (the Fruit Slice demo, since 1 Nov 2026; until then
  // "What does <Name> love?") is drawn once, at the phone's full height
  await page.evaluate(()=>__steady.start());
  await page.tap('#nextBtn');await followFocus(page,D);
  await page.locator('[data-step="reel"].on').waitFor();await page.waitForTimeout(600);
  const leave=(await page.evaluate(()=>__steady.take())).filter(f=>f.screen==='reel'&&f.r.sCard);
  const dL=drift(leave,['sHead','sScene','sCard']);
  {const c=firstLast(leave,'sCard');ok('the next screen\'s first frame is drawn at its own size, not the name card\'s'+at,!!c.same,c);}
  ok('Continue with the keyboard up: the next screen opens once, at its own size, nothing re-laid out after it shows'+at+' (worst: '+worst(dL)+')',leave.length>0&&still(dL),dL);
  // 7. Back to the name: the step looks exactly as it did the first time
  await page.waitForTimeout(500);await calm(page);
  await page.evaluate(()=>__steady.start());
  await page.tap('#backBtn');await page.locator('[data-step="name"].on').waitFor();await kbShow(page,D);await page.waitForTimeout(500);
  const back=(await page.evaluate(()=>__steady.take())).filter(f=>f.screen==='name');
  const dB=drift(back,KEYS,home);
  {const c=firstLast(back,'card');ok('Back: the name card\'s first frame is drawn at its own size, not the demo\'s'+at,!!c.same,c);}
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
  await toBeforeName(page);await page.waitForTimeout(500);
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

// A tap the lock turns away falls through to the page, and a press there took
// the focus off the name box: on Android the keyboard went back down under a
// double tap on "Let's go!" or Back, or a tap on an age or the box's label in
// that half second. On the website (an Android phone in Chrome), where it was
// found, and in the app.
for(const web of [true,false]){const D=web?{name:'412x839',w:412,h:839,kb:0,top:0,bottom:0}:DEVICES[0],{context,page,errors}=await openPhone(D,{web});const on=web?' (website)':' (app)';try{
  const focus=()=>page.evaluate(()=>({active:document.activeElement&&(document.activeElement.id||document.activeElement.tagName),screen:document.body.dataset.setupScreen,settling:document.body.classList.contains('ob-settling'),age:draft.childAge}));
  for(const gap of [90,300]){
    await toBeforeName(page);await page.waitForTimeout(500);
    const go=await center(page,'#nextBtn');
    await page.tap('#nextBtn');await page.waitForTimeout(gap);await page.touchscreen.tap(go.x,go.y);
    const st=await focus();
    ok('a double tap on Rachel\'s Continue ('+gap+' ms apart) leaves the name box focused, the keyboard up'+on,st.screen==='name'&&st.active==='obName',st);
    await page.waitForTimeout(500);await page.evaluate(()=>{document.activeElement.blur();});
    // back to the hello for the next go: a fresh page
    await page.reload();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(400);
  }
  await toBeforeName(page);await page.waitForTimeout(500);
  await page.tap('#nextBtn');await page.locator('[data-step="name"].on').waitFor();
  await page.touchscreen.tap((await center(page,'#obAge [data-age="4"]')).x,(await center(page,'#obAge [data-age="4"]')).y);
  const a=await focus();
  await page.touchscreen.tap((await center(page,'label[for="obName"]')).x,(await center(page,'label[for="obName"]')).y);
  const l=await focus();
  ok('a tap on an age or on the box\'s label during the tap lock leaves the box focused, and picks nothing'+on,a.settling&&a.active==='obName'&&a.age!=='4'&&l.active==='obName',{age:a,label:l});
  // Back, twice: the name step opens with the box focused, and the second tap leaves it so
  await page.waitForTimeout(500);await page.fill('#obName','Milo');
  await page.tap('#nextBtn');await page.locator('[data-step="interests"].on').waitFor();await page.waitForTimeout(600);
  const bk=await center(page,'#backBtn');await page.touchscreen.tap(bk.x,bk.y);await page.waitForTimeout(150);await page.touchscreen.tap(bk.x,bk.y);
  const b=await focus();
  ok('a double tap on Back opens the name step with the box focused, and keeps it so'+on,b.screen==='name'&&b.active==='obName',b);
  ok('no runtime errors (double taps)'+on,errors.length===0,errors);
 }catch(e){ok('the walk completes (double taps)'+on,false,e.message);}finally{await context.close();}}

// THE WEBSITE: no app, so nothing lifts Continue above the keyboard. An age
// tap there lets go of the name box, so the keyboard goes down and Continue
// is in sight, as before 15 Oct 2026; in the app it keeps the box (the walk).
{const D={name:'412x839',w:412,h:839,kb:0,top:0,bottom:0},{context,page,errors}=await openPhone(D,{web:true});try{
  await toBeforeName(page);await page.waitForTimeout(500);
  await page.tap('#nextBtn');await page.locator('[data-step="name"].on').waitFor();await page.waitForTimeout(600);
  const before=await page.evaluate(()=>document.activeElement&&document.activeElement.id);
  await page.keyboard.type('Milo');await tapAt(page,'#obAge [data-age="6"]');await page.waitForTimeout(200);
  const st=await page.evaluate(()=>({app:!!window.Capacitor,active:document.activeElement&&(document.activeElement.id||document.activeElement.tagName),age:draft.childAge,pressed:document.querySelector('#obAge [data-age="6"]').getAttribute('aria-pressed')}));
  ok('on the website an age tap picks the age and lets go of the name box (the keyboard goes down, Continue in sight)',before==='obName'&&!st.app&&st.active!=='obName'&&st.age==='6'&&st.pressed==='true',{before,...st});
  ok('no runtime errors (website age tap)',errors.length===0,errors);
 }catch(e){ok('the walk completes (website age tap)',false,e.message);}finally{await context.close();}}

// A PHONE ON THE WEBSITE, OR A LAPTOP WINDOW, WHOSE WIDTH CHANGES WHILE A
// NAME IS TYPED. A browser's bars make its window 80-180 px shorter than the
// screen, so the screen's height is never the window's there. Taken at the
// turn (as the app does for an iPad), an iPhone SE in Safari (553 tall) got a
// 667-tall phone's size while the box was focused, then jumped back 67 px as
// the box let go, and Continue waited 0.36 s for a resize that never came; a
// laptop window narrowed while typing took its screen's 1080 and Continue
// waited 0.4 s. Outside the app a width change waits for the keyboard to go
// down, like any other.
for(const W of [{name:'iPhone SE in Safari',w:375,h:553,sw:375,sh:667,turn:[667,325],mobile:true},{name:'a laptop window',w:1280,h:700,sw:1920,sh:1080,turn:[1000,700],mobile:false}]){
 const D={name:W.w+'x'+W.h,w:W.w,h:W.h,kb:0,top:0,bottom:0},{context,page,errors}=await openPhone(D,W.mobile?{web:true}:{laptop:true,path:'/onboarding.html?slp=1'});try{
  const cdp=await page.context().newCDPSession(page);
  const win=(w,h)=>cdp.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:W.mobile?2:1,mobile:W.mobile,screenWidth:W.sw,screenHeight:W.sh,screenOrientation:(W.mobile?w>W.sw:W.sw>W.sh)?{type:'landscapePrimary',angle:90}:{type:'portraitPrimary',angle:0}});
  await win(W.w,W.h);await page.waitForTimeout(300);
  const st=()=>page.evaluate(()=>({phone:obPhone.h(),small:obPhone.small(),cls:['ob-short','ob-tiny'].filter(c=>document.documentElement.classList.contains(c)),field:Math.round(document.getElementById('obName').getBoundingClientRect().top),active:document.activeElement&&document.activeElement.id}));
  if(W.mobile){await toBeforeName(page);await page.waitForTimeout(500);await page.tap('#nextBtn');}else await page.click('#nextBtn');
  await page.locator('[data-step="name"].on').waitFor();await page.waitForTimeout(600);
  await page.focus('#obName');await page.keyboard.type('Milo');
  const before=await st();
  await win(...W.turn);await page.waitForTimeout(500);await win(W.w,W.h);await page.waitForTimeout(500);
  const after=await st();
  ok(W.name+', its width changed while a name is typed, keeps the size it had: the screen\'s height is not the window\'s outside the app',before.active==='obName'&&after.active==='obName'&&after.phone===W.h&&!after.small&&JSON.stringify(after.cls)===JSON.stringify(before.cls)&&after.field===before.field,{before,after});
  const ms=await page.evaluate(()=>new Promise(done=>{const t0=performance.now();document.getElementById('nextBtn').click();(function w(){const s=document.body.dataset.setupScreen;if(s&&s!=='name')done(Math.round(performance.now()-t0));else if(performance.now()-t0>2000)done(-1);else requestAnimationFrame(w);})();}));
  ok('…and Continue then opens the next screen at once ('+ms+' ms), with no wait for a keyboard that is not there',ms>=0&&ms<=150,ms);
  ok('no runtime errors ('+W.name+')',errors.length===0,errors);
 }catch(e){ok('the walk completes ('+W.name+')',false,e.message);}finally{await context.close();}}

// AN IPAD TURNED WITH THE KEYBOARD UP. The keyboard is not the iPad: the
// height it leaves is never taken as the iPad's, so the step stays its full
// size while the keyboard is up and does not change when it goes down. The
// turned iPad's height is its screen's short side from the moment it turns
// (the screen never shrinks for a keyboard), and the window's own once the
// keyboard is down.
{const D={name:'820x1180',w:820,h:1180,kb:320,top:24,bottom:20},{context,page,errors}=await openPhone(D);try{
  D.win=await ipadWindow(page);await D.win(820,1180);
  const st=()=>page.evaluate(()=>{const r=document.getElementById('obName').getBoundingClientRect();return {cls:['ob-short','ob-tiny'].filter(c=>document.documentElement.classList.contains(c)),phone:obPhone.h(),h:innerHeight,field:{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width)},label:document.querySelector('label[for="obName"]').offsetHeight,seg:document.getElementById('seg').offsetHeight,fit:{fieldTop:Math.round(r.top),agesBottom:Math.round(Math.max(...[...document.querySelectorAll('#obAge .sound')].map(b=>b.getBoundingClientRect().bottom))),btnTop:Math.round(document.getElementById('nextBtn').getBoundingClientRect().top),scroll:document.querySelector('.ob').scrollHeight-document.querySelector('.ob').clientHeight}};});
  await toBeforeName(page);await page.waitForTimeout(500);
  await page.tap('#nextBtn');await page.locator('[data-step="name"].on').waitFor();await kbShow(page,D);await page.waitForTimeout(400);
  const portrait=await st();
  // turned on its side, the keyboard still up: the plugin sends willShow again with the landscape keyboard
  await D.win(1180,820-400);await page.evaluate(()=>{__steady.kbState='up';__steady.kb.keyboardWillShow({keyboardHeight:400});});await page.waitForTimeout(1200);
  const turned=await st();
  await page.keyboard.press('Enter');await kbHide(page,{w:1180,h:820,win:D.win});await page.waitForTimeout(1200);
  const down=await st();
  ok('an iPad turned with the keyboard up keeps the full-size name step: the keyboard is not taken for the iPad',portrait.cls.length===0&&turned.cls.length===0&&down.cls.length===0,{portrait,turned,down});
  ok('…with the box and all three age choices above Continue while the keyboard is up, nothing scrolled',turned.fit.agesBottom<=turned.fit.btnTop&&turned.fit.fieldTop>=0&&turned.fit.scroll<=1,turned.fit);
  ok('…so nothing moves when the keyboard goes down',Math.abs(turned.field.y-down.field.y)<=TOL&&Math.abs(turned.field.x-down.field.x)<=TOL&&turned.label===down.label&&turned.seg===down.seg,{turned,down});
  ok('…and the turned iPad\'s height is its own from the turn, and once the keyboard is down',turned.phone===820&&down.phone===820,{turned:turned.phone,down:down.phone});
  ok('no runtime errors (iPad turned)',errors.length===0,errors);
 }catch(e){ok('the walk completes (iPad turned)',false,e.message);}finally{await context.close();}}

// …AND THE OTHER WAY ROUND: an iPad on its side, turned upright while a name
// is typed. Kept from before the turn, its height on its side (820) read the
// upright window with the keyboard up (860) as "no keyboard": Continue stayed
// away 0.9 s after the turn, and Continue with the keyboard up drew the next
// question twice (keyboard-sized, then full). The turn: the window full-size
// for a moment, the plugin's willShow, the web view shrinking 0.45 s later;
// Continue: the box lets go, keyboardWillHide 30 ms later, the window full 10
// ms after that.
{const L={name:'1180x820',w:1180,h:820,kb:400,top:24,bottom:20},U={w:820,h:1180,kb:320},{context,page,errors}=await openPhone(L);try{
  L.win=U.win=await ipadWindow(page);await L.win(1180,820);await page.waitForTimeout(300);
  await toBeforeName(page);await page.waitForTimeout(500);
  await page.tap('#nextBtn');await page.locator('[data-step="name"].on').waitFor();await kbShow(page,L);await page.waitForTimeout(400);
  await page.keyboard.type('Milo');await tapAt(page,'#obAge [data-age="6"]');await page.waitForTimeout(300);
  await page.evaluate(()=>__steady.start());
  await U.win(820,1180);await page.evaluate(h=>__steady.kb.keyboardWillShow({keyboardHeight:h}),U.kb);
  await page.waitForTimeout(450);await U.win(820,1180-U.kb);await page.evaluate(()=>{__steady.kbState='up';});await page.waitForTimeout(800);
  const tf=await page.evaluate(()=>__steady.take()),phone=await page.evaluate(()=>obPhone.h());
  const shrunk=tf.findIndex(f=>f.h===1180-U.kb),back=tf.findIndex((f,i)=>i>=shrunk&&f.footOp>0.95);
  const late=shrunk<0||back<0?null:tf[back].t-tf[shrunk].t;
  ok('an iPad turned upright while a name is typed takes its upright height at once ('+phone+')',phone===1180,phone);
  ok('…so Continue comes back as the window shrinks for the keyboard, not 0.9 s later ('+late+' ms after)',late!==null&&late<=250,{late,hiddenFrames:tf.filter(f=>f.footOp<0.05).length});
  await page.evaluate(()=>{__steady.start();document.getElementById('obName').addEventListener('blur',()=>{setTimeout(()=>{__steady.kbState='down';__steady.kb.keyboardWillHide();},30);},{once:true});});
  await page.tap('#nextBtn');await page.waitForTimeout(40);await U.win(820,1180);
  await page.locator('[data-step="interests"].on').waitFor();await page.waitForTimeout(700);
  const lf=(await page.evaluate(()=>__steady.take())).filter(f=>f.screen==='interests'&&f.r.tCard);
  const dL=drift(lf,['tHead','tYes','tCard','echo']),squeezed=lf.filter(f=>f.open||f.h!==1180).length;
  ok('…and Continue with the keyboard up draws the next question once, at the iPad\'s full height'+' (worst: '+worst(dL)+')',lf.length>0&&squeezed===0&&still(dL),{frames:lf.length,squeezed,dL});
  ok('no runtime errors (iPad turned upright)',errors.length===0,errors);
 }catch(e){ok('the walk completes (iPad turned upright)',false,e.message);}finally{await context.close();}}

// A SHORT LAPTOP WINDOW (the clinician's setup in a browser) is not a phone:
// the phone sizes are for touch screens, so it keeps the full-size name step,
// with the progress bar and the box's label drawn.
{const D={name:'1280x560',w:1280,h:560,kb:0,top:0,bottom:0},{context,page,errors}=await openPhone(D,{laptop:true,path:'/onboarding.html?slp=1'});try{
  await page.click('#nextBtn');await page.locator('[data-step="name"].on').waitFor();await page.waitForTimeout(500);
  const st=await page.evaluate(()=>({role:draft.role,cls:['ob-short','ob-tiny'].filter(c=>document.documentElement.classList.contains(c)),seg:document.getElementById('seg').offsetHeight,label:document.querySelector('label[for="obName"]').offsetHeight}));
  ok('a short laptop window (the clinician\'s setup at /onboarding.html?slp=1) keeps the full-size name step: progress bar and label drawn',st.role==='slp'&&st.cls.length===0&&st.seg>0&&st.label>2,st);
  ok('no runtime errors (laptop)',errors.length===0,errors);
 }catch(e){ok('the walk completes (laptop)',false,e.message);}finally{await context.close();}}

// …and with a mouse there is no keyboard to hold still for, so the name step
// follows the window's height like the screens around it: at 700 px or less
// its side margins and Continue are the next screen's (18 px, 19 px), where
// they stayed 22 and 22 and the card was 8 px narrower.
for(const [w,h] of [[1280,560],[1366,650],[1440,900]]){const D={name:w+'x'+h,w,h,kb:0,top:0,bottom:0},{context,page,errors}=await openPhone(D,{laptop:true,path:'/onboarding.html?slp=1'});try{
  const look=()=>page.evaluate(()=>{const b=getComputedStyle(document.getElementById('nextBtn')),o=getComputedStyle(document.querySelector('.ob')),c=document.querySelector('.step.on').getBoundingClientRect();return {screen:document.body.dataset.setupScreen,font:b.fontSize,pad:b.padding,margins:o.paddingLeft+' '+o.paddingRight,card:Math.round(c.left)+' '+Math.round(c.width)};});
  await page.locator('[data-step="name"].on').waitFor();await page.waitForTimeout(500);
  const name=await look();
  await page.fill('#obName','Milo');await page.click('#nextBtn');await page.locator('[data-step="sounds"].on').waitFor();await page.waitForTimeout(600);
  const next=await look();
  ok('in a '+D.name+' mouse window the name step\'s margins, card and Continue are the next screen\'s ('+name.margins+', '+name.font+')',name.screen==='name'&&next.screen==='sounds'&&name.font===next.font&&name.pad===next.pad&&name.margins===next.margins&&name.card===next.card,{name,next});
  ok('no runtime errors (mouse '+D.name+')',errors.length===0,errors);
 }catch(e){ok('the walk completes (mouse '+D.name+')',false,e.message);}finally{await context.close();}}

// AN IPAD'S HARDWARE KEYBOARD: the plugin reports a height under 80 (0, or
// its shortcut bar) and the page never resizes. It is not a keyboard to the
// layout: Continue stays exactly where it is as the box gains and loses focus.
for(const kbh of [0,60]){const D={name:'1024x1366',w:1024,h:1366,kb:kbh,top:24,bottom:20},{context,page,errors}=await openPhone(D);try{
  const foot=()=>page.evaluate(()=>{const b=document.getElementById('nextBtn').getBoundingClientRect();return {top:Math.round(b.top*10)/10,h:innerHeight,open:document.body.classList.contains('keyboard-open'),op:+getComputedStyle(document.querySelector('.obfoot')).opacity,active:document.activeElement&&document.activeElement.id};});
  await toBeforeName(page);await page.waitForTimeout(500);
  await page.tap('#nextBtn');await page.locator('[data-step="name"].on').waitFor();await page.waitForTimeout(600);
  const before=await foot();
  await page.evaluate(h=>__steady.kb.keyboardWillShow({keyboardHeight:h}),kbh);await page.waitForTimeout(950);
  const shown=await foot();
  await page.keyboard.press('Enter');await page.evaluate(()=>__steady.kb.keyboardWillHide());await page.waitForTimeout(300);
  const let_go=await foot();
  await tapAt(page,'#obName');await page.evaluate(h=>__steady.kb.keyboardWillShow({keyboardHeight:h}),kbh);await page.waitForTimeout(950);
  const again=await foot();
  const tops=[before,shown,let_go,again].map(f=>f.top);
  ok('with an iPad\'s hardware keyboard (height '+kbh+'), Continue stays where it is as the box gains and loses focus',Math.max(...tops)-Math.min(...tops)<=TOL&&!shown.open&&!again.open&&again.op>0.95&&again.active==='obName',{before,shown,let_go,again});
  ok('no runtime errors (hardware keyboard '+kbh+')',errors.length===0,errors);
 }catch(e){ok('the walk completes (hardware keyboard '+kbh+')',false,e.message);}finally{await context.close();}}

// With motion on, the step enters as one piece: the heading, the labels, the
// box and the age choices ride with the card and never slide on their own,
// so the keyboard rising over the entrance is the only other motion.
{const D=DEVICES[0],{context,page,errors}=await openPhone(D);try{
  await toBeforeName(page);await page.waitForTimeout(600);
  await page.tap('#nextBtn');
  // painted boxes this time: a slide shows in where things are drawn
  const fr=await page.evaluate(()=>{const out=[],t0=performance.now();return new Promise(done=>{(function grab(){const card=document.querySelector('[data-step="name"]');if(document.body.dataset.setupScreen==='name'&&card){const r={card:card.getBoundingClientRect().top};for(const [k,s] of Object.entries({heading:'[data-step="name"] .qh',label:'label[for="obName"]',field:'#obName',ageLabel:'#ageLabel',age6:'#obAge [data-age="6"]'})){const b=document.querySelector(s).getBoundingClientRect();r[k]=b.height>1?b.top:null;}out.push(r);}if(performance.now()-t0<650)requestAnimationFrame(grab);else done(out);})();});});
  const rel={};for(const k of ['heading','label','field','ageLabel','age6']){const ds=fr.filter(f=>f[k]!==null).map(f=>f[k]-f.card);rel[k]=ds.length?+(Math.max(...ds)-Math.min(...ds)).toFixed(1):null;}
  ok('with motion on, the name step slides in as one piece: nothing moves inside the card ('+JSON.stringify(rel)+')',fr.length>5&&Object.values(rel).every(v=>v!==null&&v<=1.5),{frames:fr.length,rel});
  ok('no runtime errors (motion on)',errors.length===0,errors);
 }finally{await context.close();}}

// THE SCREENS THAT SELL HOLD STILL (19 Oct 2026; rebuilt 22 Oct). The
// approved Play Studio sales screens keep their own layout as pictures
// arrive, here held half a second late. Demo canvases may animate, but their
// headings, their scene's box and Continue stay put. Phones and Reduce Motion
// are both exercised; the ready screen's existing finite Echo/sparkle
// animation remains covered. The problem slide, watched here for 2.3 s, went
// on 31 Oct 2026: the hello now opens the Fruit Slice demo, which is watched
// as long in its place (it is the screen that still moves).
const ENDS={};
const ownMotion=(fr,ks)=>{const out={};for(const k of ks){const vs=fr.map(f=>f.v[k]),a=vs[0];out[k]={first:a,last:vs[vs.length-1],changed:vs.filter(v=>JSON.stringify(v)!==JSON.stringify(a)).length,ever:vs.some(v=>!!v)};}return out;};
for(const reduced of [false,true])for(const D of [DEVICES[0],DEVICES[2]]){
 const {context,page,errors}=await openPhone(D,{reduced});const at=' at '+D.name+(reduced?' with Reduce Motion':'');
 try{
  await context.addInitScript(()=>{const C=window.Capacitor;if(C&&C.Plugins)C.Plugins.Purchases={};});
  await page.reload();await page.waitForFunction(()=>window.Sona&&document.getElementById('nextBtn'));await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
  ok('(the app can sell'+at+': the price follows setup)',await page.evaluate(()=>Sona.iapAvailable()&&Sona.trialFirst()===true));
  await context.route(/\/assets\/(crafted\/home-[a-z]+\.webp|rachel-wardrop-profile\.jpg)$/,async route=>{await new Promise(r=>setTimeout(r,500));route.continue();});
  for(const [key,keys,card,own,wait] of [['reel',['sCard','sHead','sScene','btn'],'sCard',['rTitle'],2300],['rachel',['sCard','sHead','sPic','btn'],'sCard',[],1100],['games',['sCard','sHead','sGrid','sLast','btn'],'sCard',[],1100],['ready',['rCard','rHead','rChips','rPlan','rPlanMore','btn'],'rCard',['rEcho','rSpark'],2300]]){
   if(key==='reel'){
    // the name comes between the hello and the demo (1 Nov 2026)
    await calm(page);await page.tap('#nextBtn');await page.locator('[data-step="name"].on').waitFor();
    await page.fill('#obName','Milo');await page.evaluate(()=>document.activeElement&&document.activeElement.blur());await page.waitForTimeout(500);
    await calm(page);await tapAt(page,'#obAge [data-age="6"]');await page.waitForTimeout(600);
   }
   if(key==='games'){
    // what the child loves comes between Rachel and the games
    await calm(page);await page.tap('#nextBtn');
    await page.locator('[data-step="interests"].on').waitFor();await page.waitForTimeout(600);
   }
   if(key==='ready'){
    // the questions between the games and the ready screen: therapy, the
    // sounds (R, as picked), the minutes, and the email step (left empty)
    await calm(page);await page.tap('#nextBtn');await page.locator('[data-step="therapy"].on').waitFor();
    await calm(page);await page.tap('#obTherapy [data-val="t_yes"]');await page.locator('[data-step="sounds"].on').waitFor();
    await calm(page);await page.tap('#nextBtn');await page.locator('[data-step="minutes"].on').waitFor();
    await calm(page);await page.tap('#obMinutes [data-val="10"]');await page.locator('[data-step="updates"].on').waitFor();await page.waitForTimeout(600);
   }
   await page.evaluate(()=>__steady.start());
   await calm(page);await page.tap('#nextBtn');
   await page.locator('[data-step="'+key+'"].on').waitFor();await page.waitForTimeout(wait);
   const fr=(await page.evaluate(()=>__steady.take())).filter(f=>f.screen===key&&f.r[card]);
   const d=drift(fr,keys),loaded=await page.evaluate(()=>[...document.querySelectorAll('.step.on img[src]')].every(i=>i.complete&&(i.naturalWidth>0||i.classList.contains('gone'))));
   // THE PLAN MOMENT (31 Oct 2026): the ready screen is reached through a
   // short build beat (its frames are the email step's, under the beat, so
   // none of them is counted here), and carries the plan card from its first
   // frame: Day 1 is Fruit Slice, then the story (Robo's Rocket, for R)
   if(key==='ready')ok('…the ready screen\'s plan card (Day 1: Fruit Slice, then Robo\'s Rocket, for R) is there from its first frame'+at,fr.length>5&&fr.every(f=>!!f.r.rPlan&&!!f.r.rPlanMore)&&await page.evaluate(()=>{const c=document.getElementById('planCard');return c.dataset.story==='robo'&&c.dataset.game==='slice'&&document.getElementById('planLine').textContent==='Fruit Slice first, then Robo\'s Rocket.';}),{n:fr.length,first:fr[0]&&fr[0].r.rPlan});
   if(key==='games')ok('…the games peek is three large previews here ('+(await page.evaluate(()=>document.querySelectorAll('#gamesGrid li').length))+' games)'+at,await page.evaluate(()=>document.querySelectorAll('#gamesGrid li').length===Math.min(3,Sona.activityLibrary().groups.filter(g=>g.id==='arcade')[0].games.filter(x=>!x.comingSoon).length)));
   // (a demo's scene must really be drawn: a box never found would hold still by default)
   ok('"'+key+'" is drawn once, at its own size, and nothing in it moves as its pictures arrive'+at+' (worst: '+worst(d)+')',fr.length>5&&still(d)&&loaded&&(!d.sScene||d.sScene.shown),{frames:fr.length,d,loaded});
   if(own.length){
    const m=ownMotion(fr,own),span=fr.length?fr[fr.length-1].t-fr[0].t:0;
    if(key==='reel'){
     ok('the '+key+' headline is present from its first frame and stays while only its canvas animates'+(key==='reel'?', watched '+span+' ms':'')+at,m.rTitle.first&&m.rTitle.first.o===1&&m.rTitle.changed===0&&(key!=='reel'||span>=2000),{span,m});
    }else{
     if(!reduced)ok('with motion on, Echo pops onto the ready screen and the sparkles play and end within 2.3 s'+at,span>=2000&&m.rEcho.changed>0&&m.rEcho.last&&m.rEcho.last.o===1&&m.rSpark.ever&&!m.rSpark.last,{span,m});
     else ok('under Reduce Motion the ready screen\'s first frame is its last, for '+span+' ms: Echo there from the first frame, unchanged, no sparkle ever drawn'+at,span>=2000&&m.rEcho.first&&m.rEcho.first.o===1&&m.rEcho.changed===0&&!m.rSpark.ever,{span,m});
    }
    // the same phone, the same screen: Reduce Motion's first frame is where the motion ended
    const tag=D.name+'|'+key;
    if(!reduced)ENDS[tag]=Object.fromEntries(own.map(k=>[k,m[k].last]));
    else if(ENDS[tag])ok('…and it is exactly where the motion-on run ended ('+key+')'+at,own.every(k=>JSON.stringify(m[k].first)===JSON.stringify(ENDS[tag][k])),{reduce:Object.fromEntries(own.map(k=>[k,m[k].first])),motion:ENDS[tag]});
   }
   await page.waitForTimeout(200);
  }
  ok('no runtime errors (the screens that sell'+at+')',errors.length===0,errors);
 }catch(e){ok('the walk completes (the screens that sell'+at+')',false,e.message);}finally{await context.close();}}

// THE PLAN CARD'S PICTURE ARRIVES LATE, AND NOTHING MOVES (31 Oct 2026). The
// card's picture is Fruit Slice's Home card, the first game's, whatever the
// story (here a child on K: Fruit Slice, then the lighthouse): held here past
// the build beat, it lands while the ready screen shows, inside the box the
// card kept for it. Every frame is measured, with motion on and under Reduce
// Motion; the card, its picture's box, the heading and Continue stay put.
for(const reduced of [false,true]){
 const D=DEVICES[0],{context,page,errors}=await openPhone(D,{reduced});const at=' at '+D.name+(reduced?' with Reduce Motion':'');
 try{
  await context.addInitScript(()=>{const C=window.Capacitor;if(C&&C.Plugins)C.Plugins.Purchases={};});
  await context.route(/\/assets\/crafted\/home-fruit\.webp$/,async route=>{await new Promise(r=>setTimeout(r,4500));route.continue();});
  await page.reload();await page.waitForFunction(()=>window.Sona&&document.getElementById('nextBtn'));await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(400);
  for(let i=0;i<8;i++){const s=await page.evaluate(()=>document.body.dataset.setupScreen);if(s==='name')break;await calm(page);await page.tap('#nextBtn');await page.waitForFunction(k=>document.body.dataset.setupScreen!==k,s);}
  await page.locator('[data-step="name"].on').waitFor();
  await page.fill('#obName','Milo');await page.evaluate(()=>document.activeElement&&document.activeElement.blur());await page.waitForTimeout(400);
  await calm(page);await tapAt(page,'#obAge [data-age="6"]');await calm(page);await page.tap('#nextBtn');
  await page.locator('[data-step="interests"].on').waitFor();await calm(page);await page.tap('#nextBtn');
  await page.locator('[data-step="games"].on').waitFor();await calm(page);await page.tap('#nextBtn');
  await page.locator('[data-step="therapy"].on').waitFor();await calm(page);await page.tap('#obTherapy [data-val="t_yes"]');
  await page.locator('[data-step="sounds"].on').waitFor();
  await calm(page);await page.tap('#obSounds [data-sound="R"]');await calm(page);await page.tap('#obSounds [data-sound="K"]');
  await calm(page);await page.tap('#nextBtn');await page.locator('[data-step="minutes"].on').waitFor();
  await calm(page);await page.tap('#obMinutes [data-val="5"]');await page.locator('[data-step="updates"].on').waitFor();await page.waitForTimeout(300);
  await page.evaluate(()=>__steady.start());
  await calm(page);await page.tap('#nextBtn');
  await page.waitForFunction(()=>!!document.querySelector('[data-step="ready"].on'),null,{polling:'raf',timeout:5000});
  const shown=await page.evaluate(()=>({loaded:document.getElementById('planImg').complete&&document.getElementById('planImg').naturalWidth>0,story:document.getElementById('planCard').dataset.story,game:document.getElementById('planCard').dataset.game,src:document.getElementById('planImg').getAttribute('src')}));
  await page.waitForFunction(()=>{const i=document.getElementById('planImg');return i.complete&&i.naturalWidth>0;},null,{timeout:7000});await page.waitForTimeout(500);
  const fr=(await page.evaluate(()=>__steady.take())).filter(f=>f.screen==='ready'&&f.r.rCard);
  const d=drift(fr,['rCard','rHead','rChips','rPlan','rPlanPic','rPlanMore','btn']);
  ok('Fruit Slice\'s picture lands after the ready screen shows'+at+' (it was still on its way as the screen was drawn; the story it names is the lighthouse)',shown.story==='lighthouse'&&shown.game==='slice'&&shown.src==='/assets/crafted/home-fruit.webp'&&!shown.loaded,shown);
  ok('…inside the box the plan card kept for it: nothing on the ready screen moves as it arrives'+at+' (worst: '+worst(d)+')',fr.length>5&&still(d)&&fr.every(f=>!!f.r.rPlanPic),{frames:fr.length,d});
  ok('no runtime errors (the plan card\'s late picture'+at+')',errors.length===0,errors);
 }catch(e){ok('the walk completes (the plan card\'s late picture'+at+')',false,e.message);}finally{await context.close();}
}

await browser.close();server.close();
console.log('\n'+checks+' checks, '+failures+' failures');
process.exit(failures?1:0);
