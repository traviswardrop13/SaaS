// Real steering and the real SayPlay speech owner. No fake accepted-word
// callbacks: silence, two separate sayings and optional help use the mic.
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {chromium,ROOT as SOURCE_ROOT,OUT,launchOpts} from './_env.mjs';
import {fakeDevice} from './_sayplaydevice.mjs';
const ROOT=process.env.SONATEST_PUBLIC_ROOT||SOURCE_ROOT,PORT=8346,BASE='http://127.0.0.1:'+PORT;
const mime={html:'text/html',js:'text/javascript',css:'text/css',webp:'image/webp',svg:'image/svg+xml',woff2:'font/woff2'};
const server=createServer((req,res)=>{const u=new URL(req.url,BASE),f=path.join(ROOT,u.pathname);if(u.pathname.startsWith('/api/')||!existsSync(f)||!statSync(f).isFile()){res.writeHead(503);res.end('{}');return;}res.setHeader('Content-Type',mime[f.split('.').pop()]||'application/octet-stream');res.end(readFileSync(f));});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
let browser,failures=0,checks=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
async function fresh(options={}){
 const context=await browser.newContext({viewport:options.viewport||{width:390,height:844},reducedMotion:'reduce'});
 await context.addInitScript(fakeDevice,{age:'7',micok:true,permission:'granted',speechMs:100,...options.device});
 await context.route('**/*',r=>{const u=r.request().url();if(!u.startsWith(BASE+'/'))return r.abort();if(options.unpark!==false&&u===BASE+'/sona.js')return r.fulfill({contentType:'text/javascript',body:readFileSync(ROOT+'/sona.js','utf8').replace(/(racecar: \{[^\n]*)comingSoon: true, /,'$1')});return r.continue();});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.goto(BASE+'/arcade-racecar.html');return{context,page,errors};
}
async function advance(p,ms){await p.clock.runFor(ms);}
async function until(p,predicate,max=14000,arg){for(let t=0;t<max;t+=100){if(await p.evaluate(predicate,arg))return true;await advance(p,100);}return !!(await p.evaluate(predicate,arg));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,race:window.__racecar}));
async function word(p){if(!await until(p,()=>window.__sayplay&&__sayplay.listening))return false;await advance(p,150);await p.evaluate(()=>__quiet.voice=true);await advance(p,280);await p.evaluate(()=>__quiet.voice=false);await advance(p,650);await p.evaluate(()=>__quiet.voice=true);await advance(p,280);await p.evaluate(()=>__quiet.voice=false);return until(p,()=>__sayplay.phase==='play');}
async function steer(p,x){const b=await p.locator('#raceCanvas').boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height*.6);await p.mouse.down();await p.mouse.move(b.x+b.width/2+x*b.width*.4,b.y+b.height*.6,{steps:4});await p.mouse.up();await advance(p,300);}
try{
 browser=await chromium.launch(launchOpts());
 if(process.env.RACECAR_PART!=='assets'){
  const {context,page}=await fresh({unpark:false});await advance(page,500);ok('unfinished production game still bounces before any microphone',!page.url().includes('arcade-racecar')&&await page.evaluate(()=>__quiet.requests===0));await context.close();
 }
 if(process.env.RACECAR_PART!=='assets'){
  const {context,page,errors}=await fresh();
  ok('new game has a real racing canvas',await page.locator('#raceCanvas').count()===1);
  if(!await page.locator('#raceCanvas').count())throw new Error('Race Car is still the old animation scene');
  await page.locator('#startBtn').click();await until(page,()=>window.__sayplay&&__sayplay.listening);
  await advance(page,1500);await steer(page,.6);
  let s=await state(page);ok('silence and steering never earn a drive or speech rep',s.speech.step===0&&s.speech.said===0&&!s.race.running&&s.race.distance===0,s);
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
  const before=(await state(page)).race;await page.locator('#raceHelp').click();await until(page,()=>__sayplay.listening);await advance(page,1500);s=await state(page);
  ok('optional speech help parks the same leg instead of awarding progress',s.speech.step===before.leg&&s.race.paused&&Math.abs(s.race.distance-before.distance)<2,{before,s});
  const parkedDistance=s.race.distance;await page.evaluate(()=>__quiet.background());await advance(page,700);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await until(page,()=>__sayplay.listening);await advance(page,600);s=await state(page);
  ok('background then resume during help keeps the car stopped while listening',s.race.paused&&s.race.distance===parkedDistance&&s.speech.step===before.leg,s);
  ok('speaking again resumes that same stretch with renewed slow time',await word(page));s=await state(page);ok('help does not reset distance or spend a stage',s.race.leg===before.leg&&Math.abs(s.race.distance-parkedDistance)<3&&s.race.slow>6,s);
  const restoredFrom=(await state(page)).race.distance;
  await page.evaluate(()=>{__quiet.background();dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));});await advance(page,700);
  await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));__quiet.foreground();});await page.locator('#resume').click();await advance(page,600);
  s=await state(page);ok('back-cache restoration restarts rendering and preserves the earned car',s.race.running&&!s.race.paused&&s.race.distance>restoredFrom&&s.race.leg===before.leg,s);
  await page.screenshot({path:path.join(OUT,'sona-racecar-driving.png')});
  // A parked gate does not complete on a timer. The child must steer into it.
  await steer(page,.90);await advance(page,18000);s=await state(page);ok('waiting cannot drive through an off-centre pit stop',s.race.gate&&s.speech.step===0&&s.race.running,s);
  await steer(page,s.race.gateX);await until(page,()=>__sayplay.step===1);ok('steering into the pit stop completes the first stretch',(await state(page)).speech.step===1);
  // Finish every real stretch; no calling api.done() or modifying positions.
  for(let leg=1;leg<8;leg++){if(!await word(page))throw new Error('Speech did not earn stretch '+leg);await steer(page,.92);await advance(page,22000);s=await state(page);await steer(page,s.race.gateX);await until(page,n=>__sayplay.step>n,14000,leg);}
  await advance(page,3500);s=await state(page);ok('eight spoken checkpoints plus actual driving reach the finish',s.speech.phase==='end'&&s.speech.step===8&&s.race.finished,s);
  const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,speech:__quiet.speech}));
  ok('race, speech power and finish never play audio into a live microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);
  ok('spoken instruction explains the driving and speech reward',audio.speech.some(t=>/slow the road/.test(t)&&/drag to steer/.test(t)));
  await page.locator('#again').click();await advance(page,800);s=await state(page);ok('race again resets the car and requires speech again',s.race.leg===0&&s.race.distance===0&&!s.race.running&&s.speech.step===0,s);
  ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 {
  const {context,page}=await fresh();await page.route('**/assets/crafted/game/**',r=>r.abort());await page.reload();await page.locator('#startBtn').click();await word(page);await until(page,()=>__racecar.objects.some(o=>o.kind==='car'),18000);
  const fallback=await page.evaluate(()=>{const cv=document.getElementById('raceCanvas'),d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let blue=0;for(let i=0;i<d.length;i+=4)if(d[i]===71&&d[i+1]===142&&d[i+2]===174)blue++;return blue;});
  ok('failed artwork still paints visible solid opponent cars',fallback>20,fallback);await context.close();
 }
 for(const viewport of process.env.RACECAR_PART==='assets'?[]:[{width:320,height:568},{width:393,height:852},{width:844,height:390},{width:768,height:1024}]){
  const {context,page,errors}=await fresh({viewport});await advance(page,100);const fit=await page.evaluate(()=>{const r=document.getElementById('startBtn').getBoundingClientRect();return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,button:{x:r.x,y:r.y,right:r.right,bottom:r.bottom}};});
  ok('start and race fill '+viewport.width+'x'+viewport.height+' without page scroll',fit.scroll<=fit.height+1&&fit.button.x>=0&&fit.button.right<=fit.width&&fit.button.y>=0&&fit.button.bottom<=fit.height,fit);
  await page.screenshot({path:path.join(OUT,'sona-racecar-'+viewport.width+'.png')});ok('fit has no runtime errors',errors.length===0,errors);await context.close();
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
