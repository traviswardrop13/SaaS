// Choo-Choo Train (ages 3-4): the word starts each trip; the finger drives,
// stops and drags a friend into the coach. Every trip ends with a friend
// aboard, with no speech needed (the help ladder in public/train.js).
// Runs on the page's fake clock: every wait is on published state.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
const PORT=8357,BASE='http://127.0.0.1:'+PORT;
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+String(JSON.stringify(d)).slice(0,1500)));}
const UNKIND=/miss|wrong|fail|score|point|correct/i;
const state=p=>p.evaluate(()=>({speech:window.__sayplay,train:window.__train}));
const tr=async p=>(await state(p)).train;
async function hold(p,id){const b=await p.locator(id).boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();}
async function move(p,q,steps=16){const b=await p.locator('#trainCanvas').boundingBox();await p.mouse.move(b.x+q.x*b.width,b.y+q.y*b.height,{steps});}
async function release(p){await p.mouse.up();await until(p,()=>Math.abs(__train.velocity)<.001,5000);await advance(p,60);return tr(p);}
// a careful driver: lets go where the brake will land the train by the friend
async function stationStop(p){
 for(let attempt=0;attempt<4;attempt++){
  let s=await tr(p);if(s.canBoard)return true;const direction=s.station.position>=s.position?1:-1;await hold(p,direction>0?'#trainForward':'#trainBack');
  for(let i=0;i<220;i++){await advance(p,50);s=await tr(p);const stopping=s.velocity*Math.abs(s.velocity)/(2*s.brake),remaining=(s.station.position-s.position-stopping)*direction;if(remaining<.012||s.canBoard)break;}
  await release(p);if((await tr(p)).canBoard)return true;
 }
 return false;
}
// a struggling driver: holds the button straight through the friend's stop
async function driveThrough(p,id){const before=(await tr(p)).stageMisses;await hold(p,id);const passed=await until(p,b=>__train.stageMisses>b,9000,before);await advance(p,150);await release(p);return passed;}
async function dropAt(p,q){const s=await tr(p);if(!s.canBoard)return null;await hold(p,'#trainPassenger');await move(p,q);await p.mouse.up();await advance(p,60);return tr(p);}
async function board(p,{background=false}={}){
 const s=await tr(p);if(!s.canBoard)return false;await hold(p,'#trainPassenger');await move(p,s.door);
 if(background){await p.evaluate(()=>__quiet.background());await advance(p,350);await p.mouse.up();await p.evaluate(()=>__quiet.foreground());await p.locator('#resume').click();await advance(p,100);}else{await p.mouse.up();await advance(p,60);}
 return (await tr(p)).boarded>s.boarded;
}
// the celebration beat ends in the next word: wait for it
const nextWord=(p,step)=>until(p,n=>__sayplay.step>n,6000,step);
// a help ask that ends with no word: the same move, exactly where it was, no power
const keep=s=>({step:s.speech.step,stage:s.train.stage,boarded:s.train.boarded,position:s.train.position,velocity:s.train.velocity,stageMisses:s.train.stageMisses});
function sameMove(s,was){const now=keep(s);return s.speech.phase==='play'&&!s.speech.paused&&!s.speech.listening&&!s.train.paused&&s.train.active&&s.train.power===0&&Object.keys(was).every(k=>now[k]===was[k]);}
async function helpAsk(p){await p.locator('#trainHelp').evaluate(e=>e.addEventListener('click',()=>window.__trainAtHelp=JSON.parse(JSON.stringify({speech:__sayplay,train:__train})),{capture:true,once:true}));await p.locator('#trainHelp').click();await until(p,()=>__sayplay.listening);return p.evaluate(()=>__trainAtHelp);}
const part=process.env.TRAIN_PART;
try{
 h=await gameHarness('train',PORT);const fresh=(opts={})=>h.fresh({...opts,device:{age:'7',...opts.device}});
 // ── (d) parked: a typed address goes home before any mic or sound ──
 if(!part||part==='main'){
  const {page,context,errors}=await fresh({unpark:false});
  await context.addInitScript(()=>{if(location.pathname!=='/arcade-train.html')return;try{sessionStorage.setItem('train.seen','1');}catch(e){}addEventListener('pagehide',()=>{try{sessionStorage.setItem('train.quiet',JSON.stringify({requests:__quiet.requests,mics:__quiet.mics.length,sounds:__quiet.sounds.length,sfx:__quiet.sfx.length,speech:__quiet.speech.length}));}catch(e){}});});
  await page.goto(BASE+'/arcade-train.html');
  const home=await until(page,()=>/\/(today|activities)\.html/.test(location.pathname)&&!!document.getElementById('libraryMessage')&&/Choo-Choo Train is coming soon/.test(document.getElementById('libraryMessage').textContent),8000);
  ok('the parked railway goes back to Home, which says it is coming soon',home&&!page.url().includes('arcade-train'),{url:page.url()});
  const led=await page.evaluate(()=>({seen:sessionStorage.getItem('train.seen'),quiet:JSON.parse(sessionStorage.getItem('train.quiet')||'null'),requests:__quiet.requests}));
  ok('the parked railway opened no mic and made no sound before leaving',led.seen==='1'&&led.quiet&&led.quiet.requests===0&&led.quiet.mics===0&&led.quiet.sounds===0&&led.quiet.sfx===0&&led.quiet.speech===0&&led.requests===0,led);
  ok('parked bounce has no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── one whole trip: the words, silence, the celebration and every help path ──
 if(!part||part==='main'){
  const {page,context,errors}=await fresh();const real=await page.locator('#trainCanvas').count();ok('Train has a real driving and boarding board',real===1);if(!real)throw Error('Train is still a passenger reveal scene');
  const words=await page.evaluate(()=>({start:document.querySelector('#startOvl .ovlCard').innerText,primer:document.querySelector('#primer .ovlCard').innerText,help:document.getElementById('trainHelp').getAttribute('aria-label'),canvas:document.getElementById('trainCanvas').getAttribute('aria-label')}));
  ok('the start card says saying the word two times starts the train, and help is extra',/two times to start the train/i.test(words.start)&&/extra help/i.test(words.start),words.start);
  ok('the mic card and the board say the same',/two times to start each/i.test(words.primer)&&/two times to start each trip/i.test(words.canvas),words);
  ok('the help button says it is optional',/extra help/i.test(words.help),words.help);
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
  const intro=await page.evaluate(()=>__quiet.speech.join('|'));ok('the spoken intro says the word starts the train, in two short sentences',/two times to start the train/i.test(intro)&&!/easier stops/i.test(intro),intro);
  await advance(page,1500);let s=await state(page);ok('silence never drives or boards the train',!s.train.active&&s.train.boarded===0&&s.speech.step===0,s);
  await advance(page,13000);s=await state(page);ok('a long silence still earns nothing',!s.train.active&&s.train.boarded===0&&s.speech.step===0&&s.train.ladder===0,s);
  await page.locator('#micBtn').click().catch(()=>{});
  ok('two sayings earn the first station trip',await sayWord(page));s=await state(page);const initial=s.train.position;await advance(page,20000);s=await state(page);
  ok('speech and idle time cannot drive the train or raise the help ladder',s.train.position===initial&&s.train.boarded===0&&s.speech.step===0&&s.train.ladder===0&&s.train.tryTime===0&&s.train.power===10,s);
  ok('an offscreen friend has no invisible drag target',!s.train.passenger.visible&&await page.locator('#trainPassenger').isHidden(),s);
  await hold(page,'#trainForward');await advance(page,1100);s=await state(page);ok('holding Forward accelerates the actual train',s.train.position>initial+.1&&s.train.velocity>0&&s.train.owners.forward!==null,s);
  await page.locator('#trainForward').evaluate(e=>e.dispatchEvent(new PointerEvent('pointercancel',{pointerId:99})));ok('a different pointer cannot release the driving control',(await tr(page)).owners.forward!==null);
  await advance(page,3700);s=await state(page);ok('holding through a station does not auto-stop or board',s.train.position>s.train.station.position+s.train.berth&&s.train.boarded===0&&s.speech.step===0&&!s.train.canBoard,s);
  ok('driving out past the friend is a miss, said kindly (ladder 1)',s.train.stageMisses===1&&s.train.ladder>=1&&s.train.lastMiss==='past'&&!UNKIND.test(s.train.banner),s.train);
  ok('the train never runs off down the line: it waits a little past the friend',s.train.position<=s.train.station.position+.551,s.train.position);
  await page.mouse.up();const rel=(await tr(page)).velocity;await advance(page,120);s=await state(page);ok('releasing the throttle really brakes the train',Math.abs(s.train.velocity)<Math.abs(rel),s);await until(page,()=>Math.abs(__train.velocity)<.001,2500);
  ok('Back can recover an overshot station',await stationStop(page),await tr(page));s=await state(page);ok('a real stop lines the door up with the platform',Math.abs(s.train.position-s.train.station.position)<=s.train.berth&&Math.abs(s.train.velocity)<=s.train.safeSpeed&&s.train.canBoard&&s.train.passenger.visible,s);
  // a tap on the friend that moves nothing is not a miss
  const m0=s.train.stageMisses;await hold(page,'#trainPassenger');await page.mouse.up();await advance(page,60);s=await state(page);ok('a tap on the friend is not a miss',s.train.stageMisses===m0&&s.train.boarded===0,s.train);
  s=await dropAt(page,{x:.1,y:s.train.door.y});ok('a misplaced passenger never boards, and it is a kind miss',s&&s.boarded===0&&s.stageMisses===m0+1&&s.lastMiss==='door'&&!s.passenger.dragging&&!UNKIND.test(s.banner),s);
  s=await state(page);await hold(page,'#trainPassenger');await move(page,s.train.door);await page.locator('#trainPassenger').evaluate(e=>e.dispatchEvent(new PointerEvent('pointercancel',{pointerId:99})));ok('a different pointer cannot cancel a held passenger',(await tr(page)).passenger.dragging);
  await page.evaluate(()=>__quiet.background());await advance(page,350);await page.mouse.up();await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();s=await state(page);ok('an interrupted drop returns the friend without boarding or a miss',!s.train.passenger.dragging&&s.train.boarded===0&&s.speech.step===0&&s.train.canBoard&&s.train.stageMisses===m0+1,s);
  await page.screenshot({path:path.join(OUT,'sona-train-station.png')});
  // the celebration beat: the chime and the cheer, then the next word about 1.15 s later
  const chimes=await page.evaluate(()=>__quiet.sfx.filter(x=>x.name==='correct').length);
  ok('an actual release in the coach boards one friend',await board(page),await tr(page));s=await state(page);const c0=s.train.clock;
  ok('boarding plays the chime and cheers, and the step waits for the celebration',s.train.celebrating&&s.speech.step===0&&s.speech.phase==='play'&&await page.evaluate(n=>__quiet.sfx.filter(x=>x.name==='correct').length>n,chimes)&&/aboard/i.test(await page.locator('#cheer').textContent()),s);
  await page.evaluate(()=>__quiet.background());await advance(page,3000);s=await state(page);ok('a hidden page holds the celebration',s.speech.step===0&&s.train.celebrating,s);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();
  let stepAt=null;for(let i=0;i<60;i++){await advance(page,50);s=await state(page);if(s.speech.step===1){stepAt=s.train.clock;break;}}
  ok('the step counts once, about 1.15 s after the boarding',stepAt!==null&&stepAt-c0>=1.0&&stepAt-c0<=1.35&&!s.train.celebrating,{stepAt,c0});
  // the next trip starts from the game as designed
  ok('two more sayings earn the second trip',await sayWord(page));s=await state(page);ok('a new trip starts at ladder 0',s.train.ladder===0&&s.train.stageMisses===0&&s.train.boarded===1&&s.speech.step===1,s.train);
  await hold(page,'#trainForward');await advance(page,1400);await release(page);await advance(page,10500);s=await state(page);const normal={speed:s.train.maxSpeed,berth:s.train.berth,r:s.train.door.r};
  ok('the word\'s own easy stops run out once the finger has driven',s.train.power===0&&s.train.ladder===0,s.train);
  // (c) help, then silence: the same move continues, no power
  let was=keep(await helpAsk(page));s=await state(page);ok('asking for help parks the same train and shows Back to the game',s.train.paused&&s.train.position===was.position&&await page.locator('#helpBack').isVisible(),s);
  await advance(page,13500);s=await state(page);ok('help, then 13 s of silence: the same train trip, no power, driving again',sameMove(s,was)&&!await page.locator('#trainForward').isDisabled()&&!await page.locator('#helpBack').isVisible(),{s,was});
  // the same from a tap on the pill, with the train still rolling
  await hold(page,'#trainForward');await advance(page,700);await page.mouse.up();was=keep(await helpAsk(page));ok('the help ask holds a rolling train where it was',was.velocity>0&&(await tr(page)).position===was.position,was);
  await page.locator('#helpBack').click();s=await state(page);ok('a tap on Back to the game: the same rolling train, no power',sameMove(s,was),{s,was});
  await advance(page,300);s=await state(page);ok('…and it rolls on from exactly there',s.train.position>was.position&&s.train.velocity<was.velocity&&s.train.velocity>0,s.train);await until(page,()=>Math.abs(__train.velocity)<.001,4000);
  // a hidden page during a help ask also gives the move straight back
  was=keep((await helpAsk(page)));await page.evaluate(()=>__quiet.background());await advance(page,350);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await advance(page,50);s=await state(page);
  ok('a hidden page during help: back to the same trip, no power',sameMove(s,was),{s,was});
  // the help word itself: a bonus on top
  await helpAsk(page);ok('repeated speech renews the same station trip',await sayWord(page));s=await state(page);
  ok('the help word slows travel and widens the stop and the door',s.train.maxSpeed<normal.speed*.8&&s.train.berth>normal.berth*1.4&&s.train.door.r>normal.r&&s.train.boarded===1&&s.speech.step===1&&s.train.power===10&&!s.train.powerArmed,{normal,after:s.train});
  await advance(page,8000);ok('the help power waits for the finger instead of running out while Echo talks',(await tr(page)).power===10);
  ok('real controls stop at the second station',await stationStop(page),await tr(page));ok('actual dragging boards the second friend',await board(page),await tr(page));await nextWord(page,1);
  for(let stage=2;stage<5;stage++){if(!await sayWord(page))throw Error('Could not earn train leg '+stage);s=await state(page);ok('the next word alone does not board friend '+(stage+1),s.train.boarded===stage&&s.speech.step===stage,s);ok('physical travel stops at station '+(stage+1),await stationStop(page),await tr(page));ok('physical release boards friend '+(stage+1),await board(page),await tr(page));if(stage<4)await nextWord(page,stage);}
  await until(page,()=>__sayplay.phase==='end',12000);s=await state(page);ok('five real stops and passenger drops finish the trip',s.speech.phase==='end'&&s.speech.step===5&&s.train.boarded===5&&s.train.won,s);
  const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));
  ok('train directions and chimes stay outside microphone turns',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);ok('the child hears how to stop and board',/let go/i.test(audio.lines.join('|'))&&/drag|aboard/i.test(audio.lines.join('|')),audio.lines);
  ok('nothing Echo says is unkind',audio.lines.every(l=>!UNKIND.test(l)),audio.lines);
  await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-train-finished.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='');
  await page.locator('#again').click();await advance(page,350);s=await state(page);ok('replay returns an empty stopped train',s.speech.step===0&&s.train.boarded===0&&!s.train.active&&s.train.velocity===0&&s.train.ladder===0,s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── (b) a struggling child, ages 5-8 and 3-4: every trip ends, no speech ──
 if(!part||part==='ladder'){
  {const {page,context,errors}=await fresh();await page.locator('#startBtn').click();ok('big: the word starts the trip',await sayWord(page));
   // driving the wrong way for a long time is trying: it helps, never finishes
   await hold(page,'#trainBack');await until(page,()=>__train.tryTime>=8.2,12000);let s=await tr(page);ok('big: 8 s of real driving with no stop steps the help up (ladder 1)',s.ladder===1&&s.stageMisses===0&&s.boarded===0&&s.maxSpeed<=.36+1e-9,s);await release(page);
   s=await tr(page);const speed0=.58;
   // miss 1 has happened by time; now real misses
   ok('big miss 1: drive straight past the friend',await driveThrough(page,'#trainForward'));s=await tr(page);
   ok('big miss 1: the train tops out about half as fast, the stop is 1.5x',s.stageMisses===1&&s.ladder===1&&s.maxSpeed<=speed0*.65&&s.berth>=.08*1.5-1e-9&&!s.guide&&!UNKIND.test(s.banner)&&/so close/i.test(s.banner),s);
   ok('big miss 2: back through and out the other side',await driveThrough(page,'#trainBack'));s=await tr(page);
   ok('big miss 2: the stop glows, an arrow points, the button to hold glows (ladder 2)',s.stageMisses===2&&s.ladder===2&&s.guide&&s.berth>=.08*2.2&&s.towards===1&&await page.locator('#trainForward.guide').count()===1&&await page.locator('#trainBack.guide').count()===0&&s.banner==='Follow the arrow, then let go',s);
   await page.screenshot({path:path.join(OUT,'sona-train-guide.png')});
   ok('big miss 3: through again',await driveThrough(page,'#trainForward'));s=await tr(page);ok('big miss 3: almost anything works now (ladder 3)',s.stageMisses===3&&s.ladder===3&&s.snap&&s.boarded===0,s);
   // level 3: even the "wrong" button drives to the friend; the finger still lets go
   await hold(page,'#trainForward');await until(page,()=>Math.abs(__train.position-__train.station.position)<.004&&Math.abs(__train.velocity)<.001,9000);s=await tr(page);
   ok('big ladder 3: holding either button drives to the friend and stops, but the finger must let go',Math.abs(s.position-s.station.position)<.004&&!s.canBoard&&s.status==='Let go now!',s);
   s=await release(page);ok('big ladder 3: letting go there is a good stop',s.canBoard&&s.boarded===0,s);
   s=await dropAt(page,{x:s.train.x+s.train.w*.12,y:s.door.y+.02});ok('big ladder 3: a sloppy drop over the coach boards',s&&s.boarded===1,s);
   await nextWord(page,0);ok('big: the next word',await sayWord(page));s=await tr(page);ok('big: the next trip starts at ladder 0',s.ladder===0&&s.stageMisses===0,s);
   ok('big: a good stop',await stationStop(page));await advance(page,11000);s=await tr(page);ok('big: the word\'s own easy stops are over before the door tries',s.power===0&&s.canBoard,s);const base=s.door.baseR,dx=r=>({x:s.door.x+r,y:s.door.y});
   s=await dropAt(page,dx(base*1.3));ok('big door miss 1: a drop just beside the door, then the door is 1.5x',s&&s.boarded===1&&s.stageMisses===1&&s.ladder===1&&Math.abs(s.door.r-base*1.5)<1e-6&&!UNKIND.test(s.banner),s);
   s=await tr(page);s=await dropAt(page,dx(base*1.9));ok('big door miss 2: the door glows and an arrow points from the friend (ladder 2, about 2.25x)',s&&s.boarded===1&&s.stageMisses===2&&s.ladder===2&&s.guide&&s.door.r>=base*2.2&&s.banner==='Follow the arrow into the door'&&await page.locator('#trainPassenger.guide').count()===1,s);
   s=await tr(page);s=await dropAt(page,dx(base*2.6));ok('big door miss 3: ladder 3',s&&s.boarded===1&&s.stageMisses===3&&s.ladder===3&&s.snap,s);
   s=await tr(page);s=await dropAt(page,{x:s.train.x+s.train.w*.85,y:s.door.y+.03});ok('big ladder 3: a sloppy drop anywhere over the coach boards',s&&s.boarded===2,s);
   ok('big: no runtime errors',errors.length===0,errors);await context.close();}
  {const {page,context,errors}=await fresh({device:{age:'4'}});await page.locator('#startBtn').click();ok('little: the word starts the trip',await sayWord(page));let s=await tr(page);ok('little: the page sets the gentler ladder',s.little===true,s);
   ok('little miss 1: drive past',await driveThrough(page,'#trainForward'));s=await tr(page);ok('little miss 1: the glow and the arrow at once (ladder 2)',s.stageMisses===1&&s.ladder===2&&s.guide&&await page.locator('#trainBack.guide').count()===1,s);
   ok('little miss 2: back through',await driveThrough(page,'#trainBack'));s=await tr(page);ok('little miss 2: almost anything works (ladder 3)',s.stageMisses===2&&s.ladder===3&&s.snap,s);
   await hold(page,'#trainBack');await until(page,()=>Math.abs(__train.position-__train.station.position)<.004&&Math.abs(__train.velocity)<.001,9000);s=await release(page);ok('little ladder 3: either button drives to the friend; letting go stops there',s.canBoard,s);
   s=await dropAt(page,{x:s.train.x+s.train.w*.2,y:s.door.y});ok('little ladder 3: a sloppy drop boards',s&&s.boarded===1,s);
   await nextWord(page,0);await sayWord(page);ok('little: a good stop',await stationStop(page));await advance(page,11000);s=await tr(page);const base=s.door.baseR;
   s=await dropAt(page,{x:s.door.x+base*1.6,y:s.door.y});ok('little door miss 1: the door glows at once (ladder 2)',s&&s.boarded===1&&s.stageMisses===1&&s.ladder===2&&s.guide&&s.door.r>=base*2.2,s);
   s=await tr(page);s=await dropAt(page,{x:s.door.x+base*2.6,y:s.door.y});ok('little door miss 2: ladder 3',s&&s.boarded===1&&s.stageMisses===2&&s.ladder===3&&s.snap,s);
   s=await tr(page);s=await dropAt(page,{x:s.train.x+s.train.w*.15,y:s.door.y+.03});ok('little ladder 3: a sloppy drop boards',s&&s.boarded===2,s);
   ok('little: no runtime errors',errors.length===0,errors);await context.close();}
 }
 if(!part||part==='keyboard'){
  const {page,context}=await fresh();await page.locator('#startBtn').focus();await page.keyboard.press('Space');await advance(page,200);ok('Space presses Let\'s play (the page no longer swallows it)',await page.evaluate(()=>__sayplay.phase!=='ready'));
  await sayWord(page);let s=await tr(page);const before=s.position;await page.locator('#trainForward').focus();await page.keyboard.down('Space');await advance(page,1300);s=await tr(page);ok('keyboard hold drives the actual train',s.position>before+.1&&s.velocity>0,s);await page.keyboard.up('Space');await until(page,()=>Math.abs(__train.velocity)<.001,2500);ok('keyboard release stops the same engine',Math.abs((await tr(page)).velocity)<.001);
  await page.locator('#trainHearStep').evaluate(e=>{window.__heard=0;e.addEventListener('click',()=>window.__heard++);e.focus();});await page.keyboard.press('Space');await advance(page,100);ok('Space presses Hear step',await page.evaluate(()=>__heard===1));await context.close();
 }
 // ── (e) fit: play, a word turn and a help ask, at four sizes ──
 if(!part||part==='fit'){
  {const {page,context,errors}=await fresh({blockAssets:true});await context.route(/\/assets\/crafted\/(buddy-|echo-wave|home-train)/,r=>r.abort());await page.reload();await page.locator('#startBtn').click();await sayWord(page);ok('missing paintings do not prevent a real train pickup',await stationStop(page)&&await board(page));ok('fallback has no runtime errors',errors.length===0,errors);await context.close();}
  const inside=(r,v)=>r.x>=0&&r.y>=0&&r.right<=v.width+.5&&r.bottom<=v.height+.5;
  const hit=(a,b)=>a.x<b.right&&b.x<a.right&&a.y<b.bottom&&b.y<a.bottom;
  const rects=(p,ids)=>p.evaluate(ids=>{const o={width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight};ids.forEach(id=>{const e=document.getElementById(id);if(!e)return;const r=e.getBoundingClientRect();o[id]={x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,shown:!e.hidden&&getComputedStyle(e).visibility!=='hidden'&&r.width>0};});return o;},ids);
  for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024}]){
   const {page,context,errors}=await fresh({viewport});const w=viewport.width;await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
   let f=await rects(page,['turnPanel','hear','micBtn','top']);ok('the word turn fits at '+w,f.scroll<=f.height+1&&inside(f.turnPanel,f)&&f.hear.h>=44&&f.hear.w>=44&&!hit(f.turnPanel,f.top),f);
   await sayWord(page);if(!await stationStop(page))throw Error('Could not stop fitted train at '+w);
   f=await rects(page,['trainForward','trainBack','trainPassenger','trainHelp','trainHearStep','trainStatus','trainBanner','top','trainCanvas']);const t=await tr(page);
   const doorPt={x:f.trainCanvas.x+t.door.x*f.trainCanvas.w,y:f.trainCanvas.y+t.door.y*f.trainCanvas.h};const lowest=Math.min(f.trainHelp.y,f.trainStatus.y,f.trainForward.y);
   ok('every driving and boarding control fits and is big enough at '+w,f.scroll<=f.height+1&&['trainForward','trainBack','trainPassenger','trainHelp','trainHearStep'].every(id=>inside(f[id],f)&&f[id].w>=44&&f[id].h>=44),f);
   ok('the friend and the door are clear of the banner and the buttons at '+w,!['trainForward','trainBack','trainHelp','trainHearStep','trainStatus','trainBanner','top'].some(id=>hit(f.trainPassenger,f[id]))&&doorPt.y>f.trainBanner.bottom+t.door.r*f.trainCanvas.w*.5&&doorPt.y<lowest,{f,doorPt});
   await page.locator('#trainHelp').click();await until(page,()=>__sayplay.listening);f=await rects(page,['turnPanel','helpBack','hear','top']);
   ok('the help ask and Back to the game fit at '+w,f.scroll<=f.height+1&&inside(f.turnPanel,f)&&f.helpBack&&f.helpBack.shown&&inside(f.helpBack,f)&&f.helpBack.h>=44&&f.helpBack.y>=f.turnPanel.y&&f.helpBack.bottom<=f.turnPanel.bottom+.5&&!hit(f.turnPanel,f.top),f);
   await page.screenshot({path:path.join(OUT,'sona-train-help-'+w+'.png')});await page.locator('#helpBack').click();await advance(page,60);
   ok('real play boards the fitted friend at '+w,await board(page),await tr(page));await page.screenshot({path:path.join(OUT,'sona-train-'+w+'.png')});
   ok('the friend stands below the train, never on its roof, at '+w,t.passenger.y>t.door.y&&(t.passenger.y+t.passenger.h/2)>(t.train.y+t.train.h),t);
   ok('fit has no runtime errors at '+w,errors.length===0,errors);await context.close();
  }
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
