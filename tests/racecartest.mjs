// Real steering and the real SayPlay speech owner. No fake accepted-word
// callbacks: silence, two separate sayings and optional help use the mic.
// Every wait is on the page's fake clock (page.clock), so the suite plays the
// same on a busy machine.
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {chromium,ROOT as SOURCE_ROOT,OUT,launchOpts} from './_env.mjs';
// Race Car is open since 22 Oct 2026; fresh({unpark:false}) parks it again
// for the bounce check (tests/_parked.mjs).
import {parkedSona} from './_parked.mjs';
import {fakeDevice} from './_sayplaydevice.mjs';
const ROOT=process.env.SONATEST_PUBLIC_ROOT||SOURCE_ROOT,PORT=8346,BASE='http://127.0.0.1:'+PORT;
const mime={html:'text/html',js:'text/javascript',css:'text/css',webp:'image/webp',svg:'image/svg+xml',woff2:'font/woff2',json:'application/json'};
const server=createServer((req,res)=>{const u=new URL(req.url,BASE),f=path.join(ROOT,u.pathname);if(u.pathname.startsWith('/api/')||!existsSync(f)||!statSync(f).isFile()){res.writeHead(503);res.end('{}');return;}res.setHeader('Content-Type',mime[f.split('.').pop()]||'application/octet-stream');res.end(readFileSync(f));});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
let browser,failures=0,checks=0;
const part=process.env.RACECAR_PART||'';
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
async function fresh(options={}){
 const context=await browser.newContext({viewport:options.viewport||{width:390,height:844},reducedMotion:'reduce'});
 await context.addInitScript(fakeDevice,{age:'7',micok:true,permission:'granted',speechMs:100,...options.device});
 await context.route('**/*',r=>{const u=r.request().url();if(!u.startsWith(BASE+'/'))return r.abort();if(options.unpark===false&&u===BASE+'/sona.js')return r.fulfill({contentType:'text/javascript',body:parkedSona(readFileSync(ROOT+'/sona.js','utf8'),['racecar'])});return r.continue();});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.goto(BASE+'/arcade-racecar.html');return{context,page,errors};
}
async function advance(p,ms){await p.clock.runFor(ms);}
async function until(p,predicate,max=14000,arg){for(let t=0;t<max;t+=100){if(await p.evaluate(predicate,arg))return true;await advance(p,100);}return !!(await p.evaluate(predicate,arg));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,race:window.__racecar}));
async function word(p){if(!await until(p,()=>window.__sayplay&&__sayplay.listening))return false;await advance(p,150);await p.evaluate(()=>__quiet.voice=true);await advance(p,280);await p.evaluate(()=>__quiet.voice=false);await advance(p,650);await p.evaluate(()=>__quiet.voice=true);await advance(p,280);await p.evaluate(()=>__quiet.voice=false);return until(p,()=>__sayplay.phase==='play');}
async function steer(p,x){const b=await p.locator('#raceCanvas').boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height*.6);await p.mouse.down();await p.mouse.move(b.x+b.width/2+x*b.width*.4,b.y+b.height*.6,{steps:4});await p.mouse.up();await advance(p,300);}
// a quick tap where the car would sit at road position x (car units)
async function tapAt(p,x){const b=await p.locator('#raceCanvas').boundingBox();await p.mouse.move(b.x+b.width/2+x*b.width*.314,b.y+b.height*.6);await p.mouse.down();await advance(p,60);await p.mouse.up();await advance(p,600);}
async function toGate(p){return until(p,()=>__racecar.gate,30000);}
async function nextStep(p,n){return until(p,k=>__sayplay.step>k,6000,n);}
try{
 browser=await chromium.launch(launchOpts());
 // ── (d) parked: a typed address goes home before any mic or sound ──
 if(!part||part==='main'){
  const {context,page,errors}=await fresh({unpark:false});
  const home=await until(page,()=>/\/(today|activities)\.html/.test(location.pathname)&&!!document.getElementById('libraryMessage')&&/Race Car is coming soon/.test(document.getElementById('libraryMessage').textContent),8000);
  ok('the parked game goes back to Home, which says it is coming soon',home&&!page.url().includes('arcade-racecar'),{url:page.url()});
  ok('…with no mic asked for and no sound played',await page.evaluate(()=>__quiet.requests===0&&__quiet.soundsBefore===0&&__quiet.sounds.length===0&&__quiet.sfx.length===0),await page.evaluate(()=>({r:__quiet.requests,b:__quiet.soundsBefore,s:__quiet.sounds.length})));
  ok('parked bounce has no runtime errors',errors.length===0,errors);await context.close();
 }
 if(!part||part==='main'){
  const {context,page,errors}=await fresh();
  ok('new game has a real racing canvas',await page.locator('#raceCanvas').count()===1);
  if(!await page.locator('#raceCanvas').count())throw new Error('Race Car is still the old animation scene');
  await page.locator('#startBtn').click();await until(page,()=>window.__sayplay&&__sayplay.listening);
  await advance(page,1500);await steer(page,.6);
  let s=await state(page);ok('silence and steering never earn a drive or speech rep',s.speech.step===0&&s.speech.said===0&&!s.race.running&&s.race.distance===0,s);
  // (a) a whole listening window of silence: nothing drives, the mic waits for a tap
  await advance(page,13000);s=await state(page);ok('13 s of silence earns nothing: no drive, no step, the mic waits',s.speech.phase==='nudge'&&!s.race.running&&s.race.distance===0&&s.speech.step===0,s);
  await page.locator('#micBtn').click();
  ok('two separate sayings earn the first driving stretch',await word(page));
  s=await state(page);ok('earned speech starts a real 52% slower road',s.race.running&&s.race.slow>6&&s.race.factor===.48,s);
  const initial=s.race.car;await steer(page,-.68);s=await state(page);ok('touch steering changes the actual car position continuously',s.race.car<-.35&&Math.abs(s.race.car-initial)>.2,s.race);
  await advance(page,1000);let a=(await state(page)).race;await advance(page,1000);let b=(await state(page)).race;const slowDelta=b.travel-a.travel;
  await steer(page,.95);await advance(page,5500);a=(await state(page)).race;await advance(page,700);b=(await state(page)).race;const normalPerSecond=(b.travel-a.travel)/.7;
  ok('slow reward reduces measured road movement, not just a label',slowDelta>5&&normalPerSecond>slowDelta*1.5,{slowDelta,normalPerSecond});
  // Brake uses pointer capture and releases on cancel, so an interrupted
  // touch cannot leave the child stuck at a crawl.
  await page.locator('#raceBrake').dispatchEvent('pointerdown',{pointerId:22});a=(await state(page)).race;await advance(page,600);b=(await state(page)).race;ok('holding the brake slows real travel',(b.travel-a.travel)/.6<normalPerSecond*.65,{a,b});
  await page.locator('#raceBrake').dispatchEvent('pointercancel',{pointerId:22});ok('cancelled brake touch releases',!(await state(page)).race.braking);
  // ── (c) help nobody answers gives the same stretch straight back ──
  const back=async(how)=>{const before=(await state(page)).race;await page.locator('#raceHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);
   const parkedOk=s.race.paused&&s.speech.step===before.leg&&s.race.distance>=before.distance&&s.race.distance-before.distance<6&&await page.locator('#helpBack').isVisible(),parkedAt=s;
   const held=s.race.distance;
   if(how==='silence')await until(page,()=>__sayplay.phase==='play',15000);else if(how==='tap'){await page.locator('#helpBack').click();await advance(page,100);}
   else{await page.evaluate(()=>__quiet.background());await advance(page,700);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await advance(page,100);}
   s=await state(page);const r=s.race;
   ok('help, then '+how+': the same stretch goes on from where it stopped, with no power',parkedOk&&s.speech.phase==='play'&&!s.speech.paused&&!r.paused&&r.running&&r.slow===0&&r.leg===before.leg&&s.speech.step===before.leg&&r.distance>=held-.01&&r.distance-held<4&&!await page.locator('#helpBack').isVisible(),{parkedOk,held,before:before.distance,parkedAt,s});
   await advance(page,400);ok('…and the car really drives on ('+how+')',(await state(page)).race.distance>held,(await state(page)).race);};
  await back('silence');await back('tap');await back('background');
  const before=(await state(page)).race;await page.locator('#raceHelp').click();await until(page,()=>__sayplay.listening);await advance(page,600);
  const parkedDistance=(await state(page)).race.distance;
  ok('speaking during help resumes that same stretch with renewed slow time',await word(page));s=await state(page);ok('help does not reset distance or spend a stage',s.race.leg===before.leg&&Math.abs(s.race.distance-parkedDistance)<3&&s.race.slow>6,s);
  const restoredFrom=(await state(page)).race.distance;
  await page.evaluate(()=>{__quiet.background();dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));});await advance(page,700);
  await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));__quiet.foreground();});await page.locator('#resume').click();await advance(page,600);
  s=await state(page);ok('back-cache restoration restarts rendering and preserves the earned car',s.race.running&&!s.race.paused&&s.race.distance>restoredFrom&&s.race.leg===before.leg,s);
  await page.screenshot({path:path.join(OUT,'sona-racecar-driving.png')});
  // A parked ring does not complete on a timer. The child must steer into it.
  await steer(page,.90);await toGate(page);await advance(page,18000);s=await state(page);
  ok('waiting cannot drive through an off-centre pit stop',s.race.gate&&s.speech.step===0&&s.race.running&&!s.race.celebrating,s);
  ok('waiting is not a miss: the ring stays as it is',s.race.misses===0&&s.race.level===0,s.race);
  ok('a child who waits is told how, out loud, and an arrow points the way',s.race.arrow&&await page.evaluate(()=>__quiet.speech.some(t=>/steer into the glowing ring/i.test(t))),await page.evaluate(()=>__quiet.speech));
  const sfxBefore=await page.evaluate(()=>__quiet.sfx.filter(x=>x.name==='correct').length);
  await steer(page,s.race.gateX);s=await state(page);
  ok('steering into the ring plays a cheer first and waits before the next word',s.race.celebrating&&s.speech.step===0&&s.speech.phase==='play'&&await page.evaluate(n=>__quiet.sfx.filter(x=>x.name==='correct').length>n,sfxBefore),s);
  await advance(page,500);ok('…still celebrating half a second later',(await state(page)).speech.step===0);
  ok('steering into the pit stop completes the first stretch, once',await nextStep(page,0)&&(await state(page)).speech.step===1);
  // ── (b) a child who keeps missing reaches the end with no speech ──
  if(!await word(page))throw new Error('Speech did not earn stretch 1');
  await steer(page,-.92);await toGate(page);s=await state(page);const said0=s.speech.said;
  ok('a struggling child starts at the ring as designed',s.race.level===0&&s.race.slow===0&&s.race.gateX>0&&!s.race.inRing,s.race);
  await tapAt(page,-.9);s=await state(page);ok('one miss: the ring is half again as wide',s.race.misses===1&&s.race.level===1&&!s.race.celebrating,s.race);
  await tapAt(page,-.9);s=await state(page);ok('two misses: the ring glows and an arrow points to it',s.race.misses===2&&s.race.level===2&&s.race.arrow,s.race);await page.screenshot({path:path.join(OUT,'sona-racecar-arrow.png')});
  ok('…the hint says so in kind words',/arrow/i.test(await page.locator('#raceHint').textContent())&&!/miss|wrong|fail/i.test(await page.locator('#raceBanner').textContent()));
  await tapAt(page,-.9);s=await state(page);ok('three misses: almost anything works now',s.race.misses===3&&s.race.level===3,s.race);
  await tapAt(page,-.4);s=await state(page);ok('a short touch toward the ring pulls the car in, with no speech',s.race.celebrating&&s.speech.said===said0&&s.speech.step===1,s);
  ok('…and the stretch ends',await nextStep(page,1));
  // the same steps, climbed by time spent steering without getting in
  if(!await word(page))throw new Error('Speech did not earn stretch 2');
  await steer(page,.92);await toGate(page);
  {const bx=await page.locator('#raceCanvas').boundingBox(),hx=bx.x+bx.width/2+.9*bx.width*.314,hy=bx.y+bx.height*.6;await page.mouse.move(hx,hy);await page.mouse.down();
   await advance(page,2300);const l1=(await state(page)).race.level;await advance(page,2000);const l2=(await state(page)).race.level;await advance(page,4200);s=await state(page);
   ok('steering 2, 4 and 8 s without getting in climbs the same steps, and a finger held still is never pulled in',l1===1&&l2===2&&s.race.level===3&&s.race.misses===0&&!s.race.celebrating&&s.speech.step===2,{l1,l2,r:s.race});
   await page.mouse.move(hx-bx.width*.06,hy,{steps:3});await advance(page,300);await page.mouse.up();s=await state(page);
   ok('…then a small move toward the ring pulls the car in',s.race.celebrating&&s.speech.step===2,s.race);}
  ok('…and that stretch ends too',await nextStep(page,2));
  // Finish every real stretch; no calling api.done() or modifying positions.
  for(let leg=3;leg<8;leg++){if(!await word(page))throw new Error('Speech did not earn stretch '+leg);await steer(page,[0,0,0,-.92,.92,.92,.92,.92][leg]);await toGate(page);s=await state(page);await steer(page,s.race.gateX);await nextStep(page,leg);}
  await until(page,()=>__sayplay.phase==='end',8000);s=await state(page);ok('eight spoken checkpoints plus actual driving reach the finish',s.speech.phase==='end'&&s.speech.step===8&&s.race.finished,s);
  const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,speech:__quiet.speech}));
  ok('race, speech power and finish never play audio into a live microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);
  ok('spoken instruction says the word drives each stretch and the finger steers',audio.speech.some(t=>/two times to drive/i.test(t)&&/drag to steer/i.test(t)),audio.speech);
  ok('no line on the page says missed, wrong, fail, score or points',!/\b(missed|wrong|fail|score|points|correct)\b/i.test(await page.evaluate(()=>document.body.innerText+' '+__quiet.speech.join(' '))));
  await page.locator('#again').click();await advance(page,800);s=await state(page);ok('race again resets the car and requires speech again',s.race.leg===0&&s.race.distance===0&&!s.race.running&&s.speech.step===0&&s.race.misses===0&&!s.race.celebrating,s);
  ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 // a child aged 3 or 4: the ring glows and points from the first miss
 if(!part||part==='young'){
  const {context,page,errors}=await fresh({device:{age:'4'}});
  await page.locator('#startBtn').click();await word(page);let s=await state(page);ok('a four-year-old is known to the game',s.race.young===true,s.race);
  await steer(page,.92);await toGate(page);
  await tapAt(page,.9);s=await state(page);ok('ages 3-4: one miss and the ring glows with an arrow',s.race.misses===1&&s.race.level===2&&s.race.arrow,s.race);
  await tapAt(page,.9);s=await state(page);ok('ages 3-4: two misses and almost anything works',s.race.level===3,s.race);
  await tapAt(page,.5);s=await state(page);ok('…and a touch toward the ring pulls the car in',s.race.celebrating,s.race);
  ok('young run has no runtime errors',errors.length===0,errors);await context.close();
 }
 if(!part||part==='assets'){
  const {context,page}=await fresh();await page.route('**/assets/crafted/game/**',r=>r.abort());await page.reload();await page.locator('#startBtn').click();await word(page);await until(page,()=>__racecar.objects.some(o=>o.kind==='car'),18000);
  const fallback=await page.evaluate(()=>{const cv=document.getElementById('raceCanvas'),d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let blue=0;for(let i=0;i<d.length;i+=4)if(d[i]===71&&d[i+1]===142&&d[i+2]===174)blue++;return blue;});
  ok('failed artwork still paints visible solid opponent cars',fallback>20,fallback);await context.close();
 }
 // ── (e) fit: start card, word turn, play and a help ask ──
 const inside=(r,v)=>r.x>=-1&&r.y>=-1&&r.right<=v.width+1&&r.bottom<=v.height+1;
 const big=r=>r.width>=44&&r.height>=44;
 const rects=(p,ids)=>p.evaluate(ids=>ids.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),cs=getComputedStyle(e);return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,shown:!e.hidden&&cs.visibility!=='hidden'&&cs.display!=='none'&&r.width>0};}),ids);
 for(const viewport of part&&part!=='fit'?[]:[{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024},{width:844,height:390}]){
  const tag=viewport.width+'x'+viewport.height,{context,page,errors}=await fresh({viewport});await advance(page,100);const fit=await page.evaluate(()=>{const r=document.getElementById('startBtn').getBoundingClientRect();return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,button:{x:r.x,y:r.y,right:r.right,bottom:r.bottom}};});
  ok(tag+': start card fits without page scroll',fit.scroll<=fit.height+1&&fit.button.x>=0&&fit.button.right<=fit.width&&fit.button.y>=0&&fit.button.bottom<=fit.height,fit);
  if(viewport.width>viewport.height){await context.close();continue;}   // a phone on its side shows the app's portrait guard
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
  let r=await rects(page,['turnPanel','hear','word']);ok(tag+': a word turn fits, with a big enough Hear it',r.every(x=>x.shown&&inside(x,viewport))&&big(r[1]),r);
  await word(page);
  r=await rects(page,['raceBrake','raceHelp','raceHint','raceBanner']);ok(tag+': play controls fit and are big enough',r.every(x=>x.shown&&inside(x,viewport))&&big(r[0])&&big(r[1]),r);
  const hit=await page.evaluate(()=>{const cv=document.getElementById('raceCanvas'),b=cv.getBoundingClientRect(),w=Math.min(130,b.width*.29),h=w*.74,cx=b.left+b.width/2+__racecar.car*b.width*.314,y=b.top+b.height*.812;
   return{power:!document.getElementById('racePower').hidden,ids:[[cx,y-h*.5],[cx,y-h*.2],[cx-w*.3,y-h*.2],[cx+w*.3,y-h*.1]].map(([x,yy])=>{const e=document.elementFromPoint(x,yy);return e&&e.id;})};});
  ok(tag+': a finger on the car steers it (nothing covers the car)',hit.power&&hit.ids.every(id=>id==='raceCanvas'),hit);
  await page.screenshot({path:path.join(OUT,'sona-racecar-'+viewport.width+'.png')});
  await advance(page,2200);await page.locator('#raceHelp').click();await until(page,()=>__sayplay.listening);
  r=await rects(page,['turnPanel','hear','helpBack','word']);ok(tag+': a help ask fits, with a big enough "Back to the game"',r.every(x=>x.shown&&inside(x,viewport))&&big(r[1])&&r[2].height>=44&&r[2].width>=44,r);
  ok(tag+': fit has no runtime errors',errors.length===0,errors);await context.close();
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
