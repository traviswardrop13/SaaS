// Space Trip: every word (said two times) starts a flight; the finger flies
// it. Every page's clock is held still here (pauseAt), so time moves only
// when a step of this test moves it: nothing races the real clock.
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {OUT,ROOT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
const PORT=8353,BASE='http://127.0.0.1:'+PORT,PUBLIC=process.env.SONATEST_PUBLIC_ROOT||ROOT;
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
const UNKIND=/\b(miss(ed|es)?|wrong|fail(ed)?|score|points?|correct|lose|lost)\b/i;
const state=p=>p.evaluate(()=>({speech:window.__sayplay,space:window.__space}));
async function fresh(o={}){const r=await h.fresh(o);await r.page.clock.pauseAt(await r.page.evaluate(()=>Date.now())+500);return r;}
const held=new Map();
async function keys(p,wanted=[]){const have=held.get(p)||new Set();for(const key of [...have])if(!wanted.includes(key)){await p.keyboard.up(key);have.delete(key);}for(const key of wanted)if(!have.has(key)){await p.keyboard.down(key);have.add(key);}held.set(p,have);}
async function land(p,stage){
 await keys(p);let retries=(await state(p)).space.retries;
 for(let n=0;n<500;n++){
  const s=await state(p),g=s.space;if(s.speech.step>stage){await keys(p);return true;}
  if(g.celebrating){await keys(p);await advance(p,100);continue;}
  if(g.retries!==retries){await keys(p);retries=g.retries;}
  const error=g.pad.x-g.ship.x,aligned=Math.abs(error)<g.pad.w*.19&&Math.abs(g.ship.vx)<g.safeVx*.6;
  const gap=g.pad.y-(g.ship.y+g.ship.h/2),desiredVy=aligned?Math.min(g.safeVy*.52,Math.max(.025,gap*1.4)):-.006;
  const steer=error*2.8-g.ship.vx*2.5,wanted=[];
  if(steer>.02)wanted.push('ArrowRight');else if(steer<-.02)wanted.push('ArrowLeft');
  if(g.ship.vy>desiredVy+.002||!g.piloted)wanted.push('Space');
  await keys(p,wanted);await advance(p,100);
 }
 await keys(p);return false;
}
async function thrustPointer(p,ms,{drag=0,cancelOther=false}={}){const b=await p.locator('#spaceThrust').boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();if(drag)await p.mouse.move(b.x+b.width/2+drag,b.y+b.height/2,{steps:10});if(cancelOther)await p.locator('#spaceThrust').evaluate(e=>e.dispatchEvent(new PointerEvent('pointerup',{pointerId:99})));await advance(p,ms);const during=await state(p);await p.mouse.up();await advance(p,60);return during;}
const near=(a,b,e=.025)=>Math.abs(a-b)<e,part=process.env.SPACE_PART||'all';
const sameShip=(a,b)=>a&&b&&a.x===b.x&&a.y===b.y&&a.vx===b.vx&&a.vy===b.vy;
// the game's pause/resume/onHelp, as the engine calls them, with the flight
// as it stood on each side of the call
async function traceHelp(p){await p.evaluate(()=>{if(!window.__trace){const S=window.Space,copy=()=>JSON.parse(JSON.stringify(window.__space));['pause','resume','onHelp'].forEach(k=>{const f=S[k];S[k]=function(){const before=copy();const r=f.apply(this,arguments);window.__trace.push({k,arg:arguments[0],before,after:copy(),step:window.__sayplay.step});return r;};});}window.__trace=[];});}
const traced=p=>p.evaluate(()=>window.__trace);
// a help ask left without the word: the very flight it paused goes on, with
// no power, no step and no new word
async function sameFlightBack(p,label){
 const tr=await traced(p),pz=tr.find(e=>e.k==='pause'),rs=tr.find(e=>e.k==='resume'),hp=tr.find(e=>e.k==='onHelp'),s=await state(p);
 const back=await p.evaluate(()=>({helpBack:!!document.getElementById('helpBack')&&!document.getElementById('helpBack').hidden,thrustOff:document.getElementById('spaceThrust').disabled}));
 ok(label+': the same flight goes on from where it stopped, with no power',!!pz&&!!rs&&!hp&&rs.arg===true&&sameShip(pz.after.ship,rs.before.ship)&&sameShip(rs.before.ship,rs.after.ship)&&!rs.after.paused&&rs.after.active&&rs.after.power===pz.before.power&&rs.after.stage===pz.before.stage&&rs.after.legRetries===pz.before.legRetries&&rs.after.piloted===pz.before.piloted,{pz,rs,hp});
 ok(label+': back in play on the same step, the controls live again',s.speech.phase==='play'&&!s.speech.listening&&!s.speech.paused&&s.speech.step===pz.step&&!s.space.paused&&s.space.active&&!back.helpBack&&!back.thrustOff,{s,back});
}
// a little flight to have some momentum, then the help pill
async function flyThenHelp(p){await keys(p,['ArrowRight','Space']);await advance(p,180);await keys(p);await traceHelp(p);const s=await state(p);await p.locator('#spaceHelp').click();return s;}
// a child who taps Engine once and lets it drop, never steering, never talking
async function tapAndDrop(p){
 const s0=await state(p);await keys(p,['Space']);await advance(p,40);await keys(p);
 await until(p,r=>__space.retries!==r.retries||__space.celebrating||__sayplay.step>r.step,20000,{retries:s0.space.retries,step:s0.speech.step});
 const s=await state(p);return s.space.celebrating||s.speech.step>s0.speech.step;
}
// a child who aims over the pad with the arrows but never touches the engine
async function steerDrop(p){
 const s0=await state(p),r0=s0.space.retries;let engine=false;
 for(let n=0;n<300;n++){
  const s=await state(p),g=s.space;engine=engine||g.thrust;
  if(g.retries!==r0){await keys(p);return {landed:false,engine};}
  if(g.celebrating||s.speech.step>s0.speech.step){await keys(p);return {landed:true,engine};}
  const error=g.pad.x-g.ship.x,steer=error*2.8-g.ship.vx*2.5,wanted=[];
  if(!g.piloted)wanted.push(error>0?'ArrowRight':'ArrowLeft');else if(steer>.02)wanted.push('ArrowRight');else if(steer<-.02)wanted.push('ArrowLeft');
  await keys(p,wanted);await advance(p,100);
 }
 await keys(p);return {landed:false,engine,stuck:true};
}
const rect=(p,ids)=>p.evaluate(ids=>{const out={width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight};ids.forEach(id=>{const e=document.getElementById(id);if(!e)return;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);out[id]={x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,shown:cs.visibility!=='hidden'&&cs.display!=='none'&&!e.hidden&&r.width>0};});return out;},ids);
const inside=(r,f)=>r&&r.x>=0&&r.y>=0&&r.right<=f.width+.5&&r.bottom<=f.height+.5;
const hitsItself=(p,id)=>p.evaluate(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!t&&(t===e||e.contains(t));},id);
try{
 h=await gameHarness('space',PORT);
 const jobs=[];if(part!=='landscape'){
 // ── (d) parked: a typed address goes home before any mic or sound ──
 jobs.push(['parked',async()=>{
  const {page,context,errors}=await h.fresh({unpark:false});
  const home=await until(page,()=>/\/(today|activities)\.html/.test(location.pathname)&&!!document.getElementById('libraryMessage')&&/Space Trip is coming soon/.test(document.getElementById('libraryMessage').textContent),8000);
  ok('the parked spaceport goes back to Home, which says it is coming soon',home&&!page.url().includes('arcade-space'),{url:page.url(),msg:await page.evaluate(()=>{const m=document.getElementById('libraryMessage');return m&&m.textContent;})});
  ok('…with no mic asked for and no sound played',await page.evaluate(()=>__quiet.requests===0&&__quiet.soundsBefore===0&&__quiet.sounds.length===0&&__quiet.sfx.length===0));
  await context.addInitScript(()=>{if(location.pathname!=='/arcade-space.html')return;try{sessionStorage.setItem('space.seen','1');}catch(e){}addEventListener('pagehide',()=>{try{sessionStorage.setItem('space.quiet',JSON.stringify({requests:__quiet.requests,mics:__quiet.mics.length,sounds:__quiet.sounds.length,sfx:__quiet.sfx.length,speech:__quiet.speech.length}));}catch(e){}});});
  await page.goto(BASE+'/arcade-space.html');await until(page,()=>/\/(today|activities)\.html/.test(location.pathname),8000);
  const led=await page.evaluate(()=>({seen:sessionStorage.getItem('space.seen'),quiet:JSON.parse(sessionStorage.getItem('space.quiet')||'null')}));
  ok('the parked spaceport page itself opened no mic and made no sound before leaving',led.seen==='1'&&led.quiet&&led.quiet.requests===0&&led.quiet.mics===0&&led.quiet.sounds===0&&led.quiet.sfx===0&&led.quiet.speech===0,led);
  ok('parked bounce has no runtime errors',errors.length===0,errors);await context.close();
 }]);
 // ── kind, true words ──
 {
  const src=readFileSync(path.join(PUBLIC,'space.js'),'utf8'),say=(src.match(/var SAY = \{([\s\S]*?)\};/)||[])[1]||'',lines=[...say.matchAll(/"([^"]+)"/g)].map(m=>m[1]);
  const page=readFileSync(path.join(PUBLIC,'arcade-space.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,s=>s.includes('SayPlay.start')?s:'');
  ok('every banner line is kind (no missed, wrong, fail, score or points)',lines.length>=10&&lines.every(l=>!UNKIND.test(l)),lines.filter(l=>UNKIND.test(l)));
  ok('the start card, the mic card and the spoken intro say the word earns each flight',/<p>Say each word two times to start a flight\.<\/p>/.test(page)&&/id="primer"[\s\S]*?Say each word two times to start a flight\./.test(page)&&/intro:"Say each word two times to start a flight\./.test(page),null);
  ok('the help pill is labelled as extra help',/id="spaceHelp"[^>]*aria-label="Extra help: say your word for an easy flight"/.test(page),null);
 }
 // ── a held engine through a background: the pointer lets go, the flight waits ──
 jobs.push(['background',async()=>{
  const {page,context}=await fresh();await page.locator('#startBtn').focus();await page.keyboard.press('Space');await advance(page,50);
  ok('Space on a focused Let\'s fly starts the game (a keyboard or switch press)',(await state(page)).speech.phase!=='ready',await state(page));
  await sayWord(page);const b=await page.locator('#spaceThrust').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await advance(page,160);await page.evaluate(()=>__quiet.background());let s=await state(page);const parked={...s.space.ship};await advance(page,900);await page.evaluate(()=>__quiet.foreground());
  await page.locator('#resume').focus();await page.keyboard.press('Space');s=await state(page);
  ok('an interrupted held engine releases its pointer and preserves the flight (Keep flying pressed with Space)',s.space.active&&!s.space.paused&&!s.space.thrust&&s.space.owners.thrust===null&&sameShip(s.space.ship,parked)&&s.speech.phase==='play',{s,parked});await page.mouse.up();await context.close();
 }]);
 // ── the main flight: silence, the word, the controls, help, eight landings ──
 jobs.push(['main',async()=>{
  const {page,context,errors}=await fresh();const canvas=await page.locator('#spaceCanvas').count();ok('Space Trip has a real piloting board',canvas===1);if(!canvas)throw Error('Space Trip is still a rocket animation');await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);await advance(page,1600);let s=await state(page);ok('silence cannot launch or land a rocket',!s.space.active&&s.space.landed===0&&s.speech.step===0,s);
  // (a) a whole listening window of silence: no flight, no saying, no step
  await advance(page,12500);s=await state(page);const reps0=await page.evaluate(()=>__quiet.sfx.filter(x=>x.name==='correct').length);
  ok('a whole window of silence earns nothing: the mic waits for a tap',s.speech.phase==='nudge'&&s.speech.said===0&&s.speech.step===0&&!s.space.active&&!s.space.piloted&&s.space.power===0&&reps0===0,s);
  await page.locator('#micBtn').click();
  ok('two accepted sayings earn the first flight',await sayWord(page));s=await state(page);const origin={...s.space.ship},gentle=s.space.gravity,forgiving=s.space.safeVy;await advance(page,1800);s=await state(page);ok('the word and idle animation never pilot or land for the child',!s.space.piloted&&s.space.ship.x===origin.x&&s.space.ship.y===origin.y&&s.space.landed===0&&s.speech.step===0,s);
  const flown=await thrustPointer(page,700,{drag:45,cancelOther:true});ok('one held thumb really thrusts and steers',flown.space.thrust&&flown.space.piloted&&flown.space.ship.vx>0&&flown.space.ship.x>origin.x&&flown.space.ship.y<origin.y,flown);s=await state(page);ok('releasing that thumb cuts the engines and steering',!s.space.thrust&&s.space.steering===0,s);
  await thrustPointer(page,11000);s=await state(page);ok('speech genuinely eases gravity and landing speed',s.space.power===0&&s.space.ladder===0&&gentle<s.space.gravity*.7&&forgiving>s.space.safeVy*1.3,{gentle,ordinary:s.space.gravity,forgiving,ordinarySpeed:s.space.safeVy});
  await keys(page,['ArrowLeft']);await advance(page,1200);await keys(page);await advance(page,11000);s=await state(page);ok('a missed or hard touchdown retries the same accepted word',s.space.retries===1&&s.space.ladder===1&&s.space.active&&!s.space.piloted&&s.space.landed===0&&s.speech.step===0,s);
  // help, answered: the same flight, parked and then eased
  let saved=await flyThenHelp(page);await until(page,()=>__sayplay.listening);s=await state(page);
  ok('speech help parks the same flight without teleporting it',s.space.paused&&sameShip(s.space.ship,saved.space.ship)&&s.speech.step===0&&s.speech.phase==='turn',{s,saved:saved.space.ship});
  // a background during the help ask: back to the flight, not the ask
  await page.evaluate(()=>__quiet.background());await advance(page,350);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await until(page,()=>__sayplay.phase==='play');
  await sameFlightBack(page,'a background during a help ask');
  saved=await flyThenHelp(page);ok('the repeated word renews the same soft landing help',await sayWord(page));s=await state(page);
  {const tr=await traced(page),pz=tr.find(e=>e.k==='pause'),hp=tr.find(e=>e.k==='onHelp');
   ok('help preserves the flight position and momentum',!!hp&&sameShip(pz.after.ship,hp.before.ship)&&sameShip(hp.before.ship,hp.after.ship)&&hp.after.power===10&&!hp.after.paused&&s.space.power>0&&s.speech.step===0&&s.speech.phase==='play',{pz,hp});}
  // (c) help, then silence: the earned flight comes straight back
  await flyThenHelp(page);{const t0=await page.evaluate(()=>__quiet.now());await until(page,()=>__sayplay.listening);const heard=await until(page,()=>__sayplay.phase==='play'&&!__sayplay.listening,16000);const t=await page.evaluate(()=>__quiet.now())-t0;
  ok('help and silence: nothing changes for the whole 12 s listening window',heard&&t>=12&&t<=15.5,{t});}
  await sameFlightBack(page,'help and 13 s of silence');
  // (c) help, then the Back to the game pill
  await flyThenHelp(page);await until(page,()=>__sayplay.phase==='turn'&&!!document.getElementById('helpBack')&&!document.getElementById('helpBack').hidden);
  ok('a help ask shows a Back to the game pill',await page.locator('#helpBack').isVisible());
  await page.locator('#helpBack').click();await advance(page,20);
  await sameFlightBack(page,'help and a tap on Back to the game');
  await page.screenshot({path:path.join(OUT,'sona-space-flight.png')});const sites=[];
  for(let stage=0;stage<8;stage++){
   if(stage&&!await sayWord(page))throw Error('Could not earn flight '+stage);s=await state(page);sites.push([s.space.pad.x,s.space.pad.w,s.space.gravity].join(','));const landed=await land(page,stage);s=await state(page);ok('real thrust and steering land at site '+(stage+1),landed,s);if(!landed)throw Error('Could not physically land at site '+stage);
   ok('the rocket really touches this pad',Math.abs(s.space.ship.y+s.space.ship.h/2-s.space.pad.y)<.012&&Math.abs(s.space.ship.x-s.space.pad.x)<s.space.pad.w/2,s.space);
  }
  await advance(page,3300);s=await state(page);ok('eight physical landings finish the space trip',s.speech.phase==='end'&&s.speech.step===8&&s.space.landed===8&&s.space.won&&s.space.dones===8,s);ok('the landing sites offer different planned challenges',new Set(sites).size>=6,sites);const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length}));
  ok('space instructions and sounds stay out of the microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);await page.screenshot({path:path.join(OUT,'sona-space-finished.png')});await page.locator('#again').click();await advance(page,350);s=await state(page);ok('another trip needs speech and real piloting again',s.speech.step===0&&s.space.landed===0&&!s.space.active&&!s.space.piloted&&s.space.ladder===0,s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }]);
 // ── (b) every flight ends: a child who never talks again and never pulses ──
 jobs.push(['struggle',async()=>{
  const {page,context,errors}=await fresh();await page.locator('#startBtn').click();ok('the struggling flight starts with the word',await sayWord(page));
  const mics0=await page.evaluate(()=>__quiet.mics.length),said0=(await state(page)).speech.said,levels=[];let landedAt=-1;
  for(let n=0;n<6;n++){
   const s=(await state(page)).space;levels.push({ladder:s.ladder,guide:s.guide,pull:s.pull,gravity:s.gravity,safeVy:s.safeVy,safeVx:s.safeVx,tolerance:s.tolerance,onPad:s.onPad,banner:s.banner,power:s.power});
   if(await tapAndDrop(page)){landedAt=n;break;}
  }
  let s=await state(page);const tc=await page.evaluate(()=>__quiet.now()),mics1=await page.evaluate(()=>__quiet.mics.length);
  ok('a child who only taps Engine and lets go lands within four tries, with no speech',landedAt>=0&&landedAt<=3&&mics1===mics0&&s.speech.said===said0&&!s.speech.listening,{landedAt,levels,mics0,mics1});
  const L=levels;
  ok('each try that does not land makes this flight easier (0, 1, 2, 3)',L.length>=4&&L.map(l=>l.ladder).join()==='0,1,2,3'&&L[1].gravity<L[0].gravity&&L[2].gravity<L[1].gravity&&L[3].gravity<L[2].gravity,L);
  ok('after one try: slower and about 1.5x more forgiving',L[1].safeVy>=.135*1.5&&L[1].tolerance>=L[1].onPad*1.45&&L[1].safeVx>=.18&&!L[1].guide,L[1]);
  ok('after two tries: the glow, the ghost and the arrow, and about 2.2x windows',L[2].guide&&!L[2].pull&&L[2].safeVy>=.135*2.2&&L[2].tolerance>=L[2].onPad*2.1,L[2]);
  ok('from the third try the glow pulls the rocket in',L[3].guide&&L[3].pull&&L[3].tolerance>L[3].onPad*2.5,L[3]);
  ok('the words after each try are kind and say what to do',L.slice(1).every(l=>!UNKIND.test(l.banner))&&L[2].banner==='Nearly! Land by the arrow'&&L[3].banner==='Tap Engine, then let go',L.map(l=>l.banner));
  ok('a landing is a celebration first: the chime, and the step not yet counted',s.space.celebrating&&s.speech.step===0&&s.speech.phase==='play'&&await page.evaluate(t=>__quiet.sfx.some(x=>x.name==='correct'&&x.at>=t-.2),tc),s);
  await until(page,()=>__sayplay.step===1,4000);const t1=await page.evaluate(()=>__quiet.now());s=await state(page);
  ok('the step counts about a second later, exactly once',s.speech.step===1&&s.space.dones===1&&t1-tc>=1.0&&t1-tc<=1.5,{gap:t1-tc,s});
  await until(page,()=>__sayplay.phase==='turn');await until(page,()=>__sayplay.listening);const ask=await page.evaluate(t=>__quiet.sounds.filter(x=>x.kind==='speech'&&x.start>=t).map(x=>x.start),tc);
  ok('the next word is asked only after the celebration',ask.length>0&&ask[0]-tc>=1.1&&(await state(page)).space.dones===1,{ask,tc});
  // the reviewer's child: aims over the pad, lets it fall, never pulses
  ok('the next word brings the next flight',await sayWord(page));await advance(page,10600);s=await state(page);ok('the easy flight runs out while the rocket waits',s.space.power===0&&!s.space.piloted&&s.space.stage===1,s);
  let tries=0,out=null;for(;tries<4;tries++){out=await steerDrop(page);if(out.landed)break;}
  ok('a child who aims but never uses the engine still lands within three tries',out&&out.landed&&!out.engine&&tries<=2,{tries,out,s:(await state(page)).space});
  ok('struggling flights have no runtime errors',errors.length===0,errors);await context.close();
 }]);
 // ── ages 2 to 4: the gentler ladder ──
 jobs.push(['little',async()=>{
  const {page,context,errors}=await fresh({device:{age:'4'}});ok('a four-year-old gets the gentler ladder',await page.evaluate(()=>__space.little===true));
  await page.locator('#startBtn').click();await sayWord(page);const L=[];let landedAt=-1;
  for(let n=0;n<4;n++){const s=(await state(page)).space;L.push({ladder:s.ladder,guide:s.guide,pull:s.pull});if(await tapAndDrop(page)){landedAt=n;break;}}
  ok('ages 2 to 4: the glow after one try, the pull after two',L.map(l=>l.ladder).join()==='0,2,3'&&L[1].guide&&L[2].pull&&landedAt===2,{L,landedAt});ok('little flights have no runtime errors',errors.length===0,errors);await context.close();
 }]);
 // ── the last site's rock sits right under the start: bumps, then nudges ──
 jobs.push(['rocks',async()=>{
  const {page,context,errors}=await fresh();await page.locator('#startBtn').click();await sayWord(page);
  await page.evaluate(()=>Space.onWord(7));const g=(await state(page)).space;
  ok('the eighth site puts a rock under the start',g.stage===7&&g.obstacles.some(o=>Math.abs(o.x-g.spawn.x)<.05&&o.y>g.spawn.y),g);
  const T=[];let landedAt=-1;
  for(let n=0;n<5;n++){const before=(await state(page)).space,landed=await tapAndDrop(page),after=(await state(page)).space;T.push({ladder:before.ladder,banner:after.banner,nudges:after.nudged-before.nudged,retries:after.retries-before.retries});if(landed){landedAt=n;break;}}
  ok('a rock bump starts the flight over, with a kind word',T[0]&&T[0].retries===1&&T[0].nudges===0&&T[0].banner==='Go around the rock. Try again!'&&T[1].nudges===0,T);
  ok('after two tries the rock nudges the rocket aside instead',T[2]&&T[2].ladder===2&&T[2].nudges>0,T);
  ok('the rock flight still lands within four tries, with no speech',landedAt>=0&&landedAt<=3,T);ok('rock flights have no runtime errors',errors.length===0,errors);await context.close();
 }]);
 jobs.push(['assets',async()=>{
  const {page,context,errors}=await fresh({blockAssets:true});await page.locator('#startBtn').click();await sayWord(page);ok('missing painted assets cannot block a real landing',await land(page,0));ok('fallback spaceport has no runtime errors',errors.length===0,errors);await context.close();
 }]);
 // ── (e) fit: play, a word turn and a help ask, on every phone size ──
 for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:393,height:852},{width:768,height:1024}])jobs.push(['fit '+viewport.width,async()=>{
  const tag=viewport.width+'x'+viewport.height,{page,context,errors}=await fresh({viewport});await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
  const turn=await rect(page,['turnPanel','hear','word','picBox','top']);
  ok('a word turn fits '+tag,turn.turnPanel.shown&&inside(turn.turnPanel,turn)&&turn.turnPanel.y>=turn.top.bottom&&turn.hear.w>=44&&turn.hear.h>=44&&inside(turn.word,turn),turn);
  await sayWord(page);const fit=await page.evaluate(()=>{const rects=['spaceCanvas','spaceLeft','spaceThrust','spaceRight','spaceHelp'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};});return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,rects};});ok('spaceport fits '+tag,fit.scroll<=fit.height+1&&fit.rects.every(r=>r.x>=0&&r.y>=0&&r.right<=fit.width&&r.bottom<=fit.height),fit);ok('all flight controls stay large enough to touch '+tag,fit.rects.filter(r=>r.id!=='spaceCanvas').every(r=>r.w>=44&&r.h>=44),fit);
  const hud=await rect(page,['spaceCanvas','spaceHelp','spaceStatus','spaceControls','spaceBanner']),g=(await state(page)).space,c=hud.spaceCanvas,ground=c.y+g.groundY*c.h,spawnTop=c.y+(g.spawn.y-g.ship.h/2)*c.h;
  ok('no pill or control covers a landing pad, and the banner never covers the rocket '+tag,['spaceHelp','spaceStatus','spaceControls'].every(id=>!hud[id].shown||hud[id].y>=ground+8)&&spawnTop>=hud.spaceBanner.bottom,{ground,spawnTop,hud});
  await page.locator('#spaceHelp').click();await until(page,()=>__sayplay.listening);
  const ask=await rect(page,['turnPanel','helpBack','hear','top']);
  ok('a help ask and its Back to the game pill fit '+tag,inside(ask.turnPanel,ask)&&ask.turnPanel.y>=ask.top.bottom&&ask.helpBack.shown&&inside(ask.helpBack,ask)&&ask.helpBack.w>=44&&ask.helpBack.h>=44&&ask.hear.h>=44&&await hitsItself(page,'helpBack'),ask);
  await page.screenshot({path:path.join(OUT,'sona-space-help-'+viewport.width+'.png')});
  await page.locator('#helpBack').click();await advance(page,20);ok('Back to the game returns to the flight '+tag,(await state(page)).speech.phase==='play'&&!(await state(page)).space.paused);
  ok('a child can really land on this screen '+tag,await land(page,0),await state(page));await page.screenshot({path:path.join(OUT,'sona-space-'+viewport.width+'.png')});ok('fit has no runtime errors '+tag,errors.length===0,errors);await context.close();
 }]);
 }
 if(part==='all'||part==='landscape')for(const viewport of [{width:844,height:390},{width:568,height:320}])jobs.push(['landscape '+viewport.width,async()=>{
  const {page,context,errors}=await fresh({viewport});await advance(page,200);ok('the phone portrait guard still covers a rotated screen at '+viewport.width,await page.locator('#sonaPortraitGuard').isVisible());await page.locator('#sonaPortraitGuard').evaluate(e=>e.remove());await page.locator('#startBtn').click();
  for(let stage=0;stage<8;stage++){
   if(!await sayWord(page))throw Error('Could not earn short-screen flight '+stage);const s=await state(page),g=s.space,clear=g.obstacles.every(o=>{const dx=(o.x-Math.max(g.spawn.x-g.ship.w*.3,Math.min(o.x,g.spawn.x+g.ship.w*.3)))*g.width,dy=(o.y-Math.max(g.spawn.y-g.ship.h*.4,Math.min(o.y,g.spawn.y+g.ship.h*.42)))*g.height;return dx*dx+dy*dy>o.r*o.r*g.width*g.width;});ok('short-screen spawn clears every rock at site '+(stage+1),clear,g);ok('real piloting lands short-screen site '+(stage+1)+' at '+viewport.width,await land(page,stage),await state(page));
  }
  ok('rotating does not break a later landing at '+viewport.width,errors.length===0,errors);await context.close();
 }]);
 // the blocks share nothing but the browser, and every page's clock is held
 // still, so they run side by side (SPACE_JOBS at a time), longest first
 const order=['main','landscape 844','landscape 568','struggle'],rank=n=>order.indexOf(n)<0?99:order.indexOf(n);jobs.sort((a,b)=>rank(a[0])-rank(b[0]));
 const width=Math.max(1,Number(process.env.SPACE_JOBS)||3);let next=0;
 async function worker(){while(next<jobs.length){const [name,run]=jobs[next++];try{await run();}catch(e){ok(name+' completes without a page or harness crash',false,e.stack);}}}
 await Promise.all(Array.from({length:width},worker));
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
