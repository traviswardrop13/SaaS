// PEEK2: Peekaboo on the Say & Play engine (ages 3-4; 17 Oct 2026). The word,
// said two times, makes the picture peek out of a door and hide; the doors
// trade places; the child taps the door it went behind. Played through on the
// shared harness (tests/_sayplay-realgame.mjs: the fake phone hears a voice
// only when this suite says so, and the clock moves only when it is advanced).
// What it holds:
//   - a parked page goes home before any mic or sound, and Home says why;
//   - silence finds nothing: before the word every door is shut and inert;
//   - the word hides the picture, the doors really move, and only the right
//     door finds it, after a short cheer that a pause holds (done() once);
//   - a child who keeps missing finds it with no more speaking: the right
//     door glows from the first wrong tap, any door opens it from the second;
//   - Echo's clue is optional: heard, the door glows; unanswered (13 s of
//     silence, or "Back to the game"), the same move goes on with no power;
//   - every lines up at 320x568, 375x667, 390x844 and 768x1024;
//   - nothing is practice data, and nothing plays into an open mic.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
const st=p=>p.evaluate(()=>({sp:window.__sayplay,pk:window.__peekaboo}));
// The harness's clock also runs on its own in real time; this suite stops it
// so the game moves only when advanced, and a busy machine changes nothing.
async function fresh(o={}){const f=await h.fresh({...o,device:{age:'4',fastPlay:true,...o.device}});if(o.unpark!==false)for(let i=0;i<5;i++){try{await f.page.clock.pauseAt(await f.page.evaluate(()=>Date.now()+250));break;}catch(e){if(i===4)throw e;}}return f;}
// a navigation can tear down the page between two looks: keep looking
async function settle(p,fn,max=8000){for(let t=0;t<=max;t+=100){try{if(await p.evaluate(fn))return true;}catch(e){}try{await advance(p,100);}catch(e){}}return false;}
async function start(p){await p.locator('#startBtn').click();return until(p,()=>window.__sayplay&&__sayplay.listening);}
const toSearch=p=>until(p,()=>__peekaboo.mode==='search',20000);
// a tap where the child's finger lands: the middle of that door, whatever covers it
async function tapDoor(p,id){const b=await p.locator('#peekDoor'+id).boundingBox();await p.mouse.click(b.x+b.width/2,b.y+b.height/2);await advance(p,50);}
const wrongOf=s=>(s.correctDoor+1)%3,otherOf=s=>(s.correctDoor+2)%3;
async function oneFind(p){const n=(await st(p)).sp.step;if(!await sayWord(p))return false;if(!await toSearch(p))return false;await tapDoor(p,(await st(p)).pk.correctDoor);return until(p,n=>__sayplay.step>n,4000,n);}
const ledger=p=>p.evaluate(()=>JSON.stringify({progress:Sona.getProgress(),outcomes:Sona.outcomes(),stickers:Sona.stickersEarned(),rotation:Sona.rotState()}));
async function quiet(p,label){const q=await p.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length}));ok(label,q.leaks===0&&q.live===0&&q.overlap===0,q);}
// what is on screen: each element's box, or hidden
const boxes=(p,ids)=>p.evaluate(ids=>{const out={vw:innerWidth,vh:innerHeight,scroll:document.documentElement.scrollHeight,scrollW:document.documentElement.scrollWidth,el:{}};ids.forEach(id=>{const e=document.getElementById(id);if(!e){out.el[id]=null;return;}const c=getComputedStyle(e);if(e.hidden||c.display==='none'||c.visibility==='hidden'){out.el[id]={hidden:true};return;}const b=e.getBoundingClientRect();out.el[id]={x:b.left,y:b.top,r:b.right,b:b.bottom,w:b.width,h:b.height};});return out;},ids);
const inside=(f,r)=>r&&!r.hidden&&r.x>=-0.5&&r.y>=-0.5&&r.r<=f.vw+0.5&&r.b<=f.vh+0.5;
const big=r=>r&&r.w>=44&&r.h>=44;
const apart=(a,b)=>!a||!b||a.hidden||b.hidden||a.r<=b.x||b.r<=a.x||a.b<=b.y||b.b<=a.y;
const DOORS=['peekDoor0','peekDoor1','peekDoor2'];
const part=process.env.PEEK_PART;
try{
 h=await gameHarness('peekaboo',8363);
 if(!part||part==='main'){
  {const{page,context}=await fresh({unpark:false});
   const home=await settle(page,()=>location.pathname==='/today.html'&&/Peekaboo is coming soon/i.test(document.body.innerText));
   const q=await page.evaluate(()=>({req:__quiet.requests,before:__quiet.soundsBefore,now:__quiet.sounds.length,url:location.pathname+location.search}));
   ok('parked: the page goes home before any mic or sound',q.req===0&&q.before===0&&q.now===0&&q.url.startsWith('/today.html'),q);
   ok('parked: Home says Peekaboo is coming soon',home,q);await context.close();}
  const{page,context,errors}=await fresh();
  ok('Peekaboo is a Say & Play page with three real doors',await page.evaluate(()=>!!window.SayPlay&&!!window.Peekaboo&&document.querySelectorAll('.peek-door').length===3&&!document.querySelector('script[src="/simple-play.js"]')));
  const before=await ledger(page);
  ok('the first word turn opens',await start(page),await st(page));
  let s=await st(page);
  ok('before the word nothing is hidden and every door is shut and inert',s.pk.mode==='idle'&&s.pk.doors.every(d=>d.open===0&&!d.holds)&&await page.evaluate(()=>[0,1,2].every(i=>document.getElementById('peekDoor'+i).disabled)),s);
  await advance(page,13000);s=await st(page);
  ok('silence earns nothing: the mic waits for a tap and no picture hides',s.sp.phase==='nudge'&&s.sp.step===0&&s.sp.said===0&&s.pk.mode==='idle'&&s.pk.finds.length===0,s);
  await tapDoor(page,1);await advance(page,500);s=await st(page);
  ok('a tap on a door is not a word',s.pk.mode==='idle'&&s.sp.step===0&&s.pk.doors.every(d=>d.open===0),s);
  await page.locator('#micBtn').click({timeout:5000});
  ok('two sayings earn the first find',await sayWord(page),await st(page));
  s=await st(page);
  const start0=s.pk.startSlot,door0=s.pk.correctDoor,word0=s.pk.word;
  ok('the word\'s picture peeks out of a door',s.pk.mode==='peek'&&!!word0&&word0===s.sp.word&&s.pk.doors[door0].holds===word0&&s.pk.positions[start0]===door0,s);
  ok('…and Echo\'s clue and the doors wait while it peeks',await page.evaluate(()=>document.getElementById('peekHelp').disabled&&[0,1,2].every(i=>document.getElementById('peekDoor'+i).disabled)));
  ok('the door closes over it and the doors start to move',await until(page,()=>__peekaboo.mode==='shuffle'&&__peekaboo.swapProgress>0.1,6000),await st(page));
  await tapDoor(page,door0);s=await st(page);
  ok('a tap while the doors move counts for nothing',s.pk.mode==='shuffle'&&s.pk.misses===0&&s.sp.step===0,s);
  await page.evaluate(()=>__quiet.background());await advance(page,300);
  const held=(await st(page)).pk;await advance(page,2000);s=await st(page);
  ok('a hidden page holds the doors exactly where they were',s.pk.frozen&&s.pk.swapIndex===held.swapIndex&&s.pk.swapProgress===held.swapProgress&&JSON.stringify(s.pk.positions)===JSON.stringify(held.positions),{held,now:s.pk});
  await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click({timeout:5000});await advance(page,300);s=await st(page);
  ok('…and the same shuffle goes on after Keep playing',!s.pk.frozen&&s.sp.phase==='play'&&(s.pk.swapIndex>held.swapIndex||s.pk.swapProgress>held.swapProgress),{held,now:s.pk});
  ok('the doors stop and the search starts',await toSearch(page),await st(page));
  s=await st(page);
  ok('the picture\'s door really moved to a new place',s.pk.correctDoor===door0&&s.pk.correctSlot!==start0&&s.pk.word===word0,s);
  ok('every door can be tapped now',await page.evaluate(()=>[0,1,2].every(i=>!document.getElementById('peekDoor'+i).disabled)));
  const t0=await page.evaluate(()=>__quiet.now());
  await tapDoor(page,s.pk.correctDoor);s=await st(page);
  ok('the right door finds it',s.pk.mode==='found'&&s.pk.ladder===0&&s.pk.misses===0,s);
  ok('…and opens on the picture',await until(page,d=>__peekaboo.doors[d].open>0.5&&__peekaboo.doors[d].holds===__peekaboo.word,1000,door0),await st(page));
  ok('…with the happy chime',await page.evaluate(t=>__quiet.sfx.some(x=>x.name==='correct'&&x.at>=t),t0),await page.evaluate(()=>__quiet.sfx));
  s=await st(page);
  ok('…and the step waits for the cheer',s.sp.step===0&&s.sp.phase==='play'&&s.pk.celebrating,s);
  await page.evaluate(()=>__quiet.background());await advance(page,3000);s=await st(page);
  ok('a pause during the cheer holds the step',s.sp.step===0&&s.pk.mode==='found'&&s.pk.celebrating,s);
  await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click({timeout:5000});
  ok('…and it counts once the game is back',await until(page,()=>__sayplay.step===1,2500),await st(page));
  await advance(page,1500);s=await st(page);
  ok('one find is one step (done() once)',s.sp.step===1&&s.pk.find===1&&s.pk.finds.length===1&&s.pk.finds[0]===word0,s);
  ok('the cheer lasted about a second of play, the pause not counted',s.pk.lastBeat>=1.1&&s.pk.lastBeat<=1.3,s.pk.lastBeat);
  for(let i=1;i<5;i++)ok('find '+(i+1)+' is earned by the word and found by a tap',await oneFind(page),await st(page));
  s=await st(page);
  ok('five finds end the round on the finale',s.sp.step===5&&s.pk.finds.length===5&&(s.sp.phase==='finale'||s.sp.phase==='end'),s);
  ok('the end card says so',await until(page,()=>document.getElementById('endOvl').classList.contains('show')&&/Five discoveries/.test(document.getElementById('endTitle').textContent),5000));
  ok('finds write no practice: no tries, outcomes, stickers or rotation',await ledger(page)===before,{before,after:await ledger(page)});
  await quiet(page,'no sound ever plays into an open mic');
  const lines=await page.evaluate(()=>__quiet.speech);
  ok('Echo says what earns a find, then what the finger does',lines.includes('Say each word two times to hide a picture.')&&lines.includes('Watch the doors!')&&lines.includes('Tap the door it is behind!'),lines);
  ok('no line says missed, wrong, score or points',lines.every(l=>!/\b(missed|wrong|fail|score|points|correct)\b/i.test(l)),lines);
  await page.screenshot({path:path.join(OUT,'sona-peekaboo-finished.png')});
  await page.locator('#again').click({timeout:5000});await advance(page,300);s=await st(page);
  ok('Play again starts a fresh round',s.sp.step===0&&s.pk.mode==='idle'&&s.pk.finds.length===0&&s.pk.round===1&&s.pk.doors.every(d=>d.open===0&&!d.holds),s);
  ok('no runtime errors',errors.length===0,errors);
  await context.close();
 }
 if(!part||part==='ladder'){
  const{page,context,errors}=await fresh();
  await start(page);await sayWord(page);await toSearch(page);
  let s=await st(page);const req=await page.evaluate(()=>__quiet.requests),right=s.pk.correctDoor,wrong=wrongOf(s.pk),other=otherOf(s.pk);
  ok('a struggling child starts with no help on screen',s.pk.ladder===0&&!s.pk.glow&&await page.locator('#peekArrow').isHidden(),s);
  await tapDoor(page,wrong);await advance(page,100);await tapDoor(page,wrong);s=await st(page);
  ok('a wrong door wiggles open on an empty room',s.pk.doors[wrong].open>0&&!s.pk.doors[wrong].holds&&s.pk.mode==='search',s);
  ok('a double tap is one tap',s.pk.misses===1,s);
  ok('from the first wrong tap the right door glows and an arrow points at it',s.pk.ladder===1&&s.pk.glow&&await page.locator('#peekDoor'+right).evaluate(e=>e.classList.contains('hint'))&&await page.locator('#peekArrow').isVisible(),s);
  const arrow=await page.locator('#peekArrow').boundingBox(),door=await page.locator('#peekDoor'+right).boundingBox();
  ok('…the arrow is over the glowing door',Math.abs(arrow.x+arrow.width/2-(door.x+door.width/2))<4&&arrow.y<door.y,{arrow,door});
  ok('…and Echo says to tap the glowing door, once he has finished his last line',await until(page,()=>__quiet.speech.includes('Tap the glowing door!'),3000),await page.evaluate(()=>__quiet.speech));
  await advance(page,400);await tapDoor(page,other);s=await st(page);
  ok('the second wrong tap: the ladder rises again, still no speaking',s.pk.ladder===2&&s.pk.mode==='search'&&s.sp.phase==='play'&&s.sp.step===0,s);
  await advance(page,400);await tapDoor(page,wrong);s=await st(page);
  ok('from then on any door opens the right one',s.pk.mode==='found'&&s.pk.doors[right].open>0,s);
  ok('…and the find counts, with no word asked for in between',await until(page,()=>__sayplay.step===1,3000)&&await page.evaluate(r=>__quiet.requests===r,req),await st(page));
  await sayWord(page);s=await st(page);
  ok('the next word starts with no help showing',s.pk.misses===0&&s.pk.ladder===0&&!s.pk.glow,s);
  await toSearch(page);
  await advance(page,11000);s=await st(page);
  ok('waiting is never a miss: no glow and nothing opens by itself',s.pk.mode==='search'&&s.pk.misses===0&&!s.pk.glow&&s.pk.doors.every(d=>d.open===0)&&s.sp.step===1,s);
  const asked=await page.evaluate(()=>__quiet.speech.filter(l=>l==='Tap the door it is behind!').length);
  ok('…Echo just says what to do once more',asked>=3,await page.evaluate(()=>__quiet.speech));
  await page.locator('#peekDoor'+s.pk.correctDoor).focus();await page.keyboard.press('Enter');s=await st(page);
  ok('a keyboard press on the right door finds it',s.pk.mode==='found',s);
  await quiet(page,'ladder: nothing plays into an open mic');
  ok('ladder: no runtime errors',errors.length===0,errors);
  await context.close();
 }
 if(!part||part==='help'){
  const{page,context,errors}=await fresh();
  await start(page);await sayWord(page);
  await until(page,()=>__peekaboo.mode==='shuffle'&&__peekaboo.swapProgress>0.2,8000);
  let s=await st(page);
  ok('Echo\'s clue can be asked for while the doors move',await page.locator('#peekHelp').isEnabled(),s);
  await page.locator('#peekHelp').click({timeout:5000});
  ok('the clue asks for the same word',await until(page,()=>__sayplay.listening,8000),await st(page));
  const asked=(await st(page)).pk;s=await st(page);
  ok('…and the doors wait, with Back to the game on screen',s.pk.frozen&&s.sp.phase==='turn'&&s.sp.word===s.pk.word&&await page.locator('#helpBack').isVisible(),s);
  const quiet0=await page.evaluate(()=>__quiet.now());
  ok('13 s of silence gives the move straight back',await until(page,()=>__sayplay.phase==='play'&&!__peekaboo.frozen,16000),await st(page));
  ok('…not before the mic\'s 12 s are up',await page.evaluate(t=>__quiet.now()-t>=11.5,quiet0),await page.evaluate(t=>__quiet.now()-t,quiet0));
  s=await st(page);
  const back=s.pk.lastResume;
  ok('…the same shuffle, from exactly where it stopped, and no glow',s.sp.step===0&&!!back&&back.mode==='shuffle'&&back.swapIndex===asked.swapIndex&&back.swapProgress===asked.swapProgress&&JSON.stringify(back.positions)===JSON.stringify(asked.positions)&&!s.pk.glow&&!s.pk.helpGlow&&await page.locator('#helpBack').isHidden(),{asked,back,now:s.pk});
  await advance(page,300);
  ok('…and the doors move on from there',(await st(page)).pk.swapProgress>asked.swapProgress||(await st(page)).pk.swapIndex>asked.swapIndex);
  await toSearch(page);
  await page.locator('#peekHelp').click({timeout:5000});await until(page,()=>__sayplay.phase==='turn',4000);
  const asked2=(await st(page)).pk;
  await page.locator('#helpBack').click({timeout:5000});s=await st(page);
  ok('Back to the game gives the same move back at once, with no glow',s.sp.phase==='play'&&!s.pk.frozen&&s.pk.mode==='search'&&s.sp.step===0&&!s.pk.glow&&s.pk.correctDoor===asked2.correctDoor&&JSON.stringify(s.pk.positions)===JSON.stringify(asked2.positions),s);
  ok('…and no mic is left open',await page.evaluate(()=>__quiet.live()===0));
  await page.locator('#peekHelp').click({timeout:5000});
  ok('the clue answered: two sayings',await sayWord(page),await st(page));
  s=await st(page);
  ok('…light the right door, on the same find',s.pk.helpGlow&&s.pk.glow&&s.pk.misses===0&&s.sp.step===0&&s.pk.mode==='search'&&await page.locator('#peekDoor'+s.pk.correctDoor).evaluate(e=>e.classList.contains('hint')),s);
  ok('…and the pill rests once the door glows',await page.locator('#peekHelp').isDisabled());
  await tapDoor(page,s.pk.correctDoor);
  ok('the glowing door finds it',await until(page,()=>__sayplay.step===1,3000),await st(page));
  await quiet(page,'help: nothing plays into an open mic');
  ok('help: no runtime errors',errors.length===0,errors);
  await context.close();
 }
 if(!part||part==='mic'){
  // The iPhone app's web view may never answer the permissions question
  // (review, 17 Oct 2026: on simple-play.js Echo then went silent and the
  // doors never moved). The engine asks the grown-up after a beat instead.
  {const{page,context,errors}=await fresh({device:{micok:false}});
   await context.addInitScript(()=>Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:()=>new Promise(()=>{})}}));
   await page.reload();await page.locator('#startBtn').click({timeout:5000});
   ok('a permissions question that never answers: the grown-up is asked',await until(page,()=>document.getElementById('primer').classList.contains('show'),3000),await st(page));
   await page.locator('#primerYes').click({timeout:5000});
   ok('…then the word turn listens',await sayWord(page),await st(page));
   ok('…and the doors still move to the search',await toSearch(page),await st(page));
   ok('never-answering permissions: no runtime errors',errors.length===0,errors);await context.close();}
  // the doors never wait for Echo's voice (review: they stood still under it)
  {const{page,context,errors}=await fresh({device:{speechMs:3000}});
   await start(page);ok('a slow voice: two sayings still earn the find',await sayWord(page),await st(page));
   const talking=()=>__quiet.speaking>0&&__quiet.speech[__quiet.speech.length-1]==='Watch the doors!';
   ok('Echo says "Watch the doors!" as the door closes',await until(page,talking,8000),await page.evaluate(()=>__quiet.speech));
   const at=(await st(page)).pk;await advance(page,300);const then=(await st(page)).pk;
   // the doors went on under his voice (or were already done before it began)
   ok('the doors never wait for Echo\'s voice',at.mode==='search'||(await page.evaluate(talking)&&(then.mode!==at.mode||then.swapIndex>at.swapIndex||then.swapProgress>at.swapProgress)),{at,then});
   await quiet(page,'slow voice: nothing plays into an open mic');
   ok('slow voice: no runtime errors',errors.length===0,errors);await context.close();}
 }
 if(!part||part==='fit'){
  for(const vp of[{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024}]){
   const w=vp.width+'x'+vp.height,{page,context,errors}=await fresh({viewport:vp});
   await start(page);
   let f=await boxes(page,['turnPanel','hear','peekBanner','close',...DOORS]);
   ok(w+': the word turn is on screen, under the doors',['turnPanel','hear','close'].every(id=>inside(f,f.el[id]))&&big(f.el.hear)&&big(f.el.close)&&DOORS.every(id=>inside(f,f.el[id])&&apart(f.el[id],f.el.turnPanel)&&apart(f.el[id],f.el.peekBanner))&&f.scroll<=f.vh+1&&f.scrollW<=f.vw+1,f);
   await advance(page,13000);
   f=await boxes(page,['turnPanel','micBtn',...DOORS]);
   ok(w+': "Tap the mic" fits with the mic button',inside(f,f.el.turnPanel)&&inside(f,f.el.micBtn)&&big(f.el.micBtn)&&DOORS.every(id=>apart(f.el[id],f.el.turnPanel)),f);
   await page.locator('#micBtn').click({timeout:5000});await sayWord(page);await toSearch(page);
   f=await boxes(page,['close','peekBanner','peekHearStep','peekHelp','peekFinds',...DOORS]);
   const play=['close','peekHearStep','peekHelp',...DOORS];
   ok(w+': every door and button fits, at least 44 px, and none covers another',play.every(id=>inside(f,f.el[id])&&big(f.el[id]))&&DOORS.every(id=>['peekBanner','peekHearStep','peekHelp','peekFinds'].every(o=>apart(f.el[id],f.el[o])))&&apart(f.el.peekHearStep,f.el.peekHelp)&&apart(f.el[DOORS[0]],f.el[DOORS[1]])&&apart(f.el[DOORS[1]],f.el[DOORS[2]]),f);
   const s=await st(page),pic=await page.evaluate(id=>{const o=document.getElementById('peekObject'+id),a=o.querySelector('.crafted-word'),b=o.getBoundingClientRect(),r=a&&a.getBoundingClientRect();return{box:{w:b.width,h:b.height},art:r?{w:r.width,h:r.height}:null};},s.pk.correctDoor);
   ok(w+': the picture in its door is a whole square',!!pic.art&&pic.art.w>20&&Math.abs(pic.art.w-pic.art.h)<1&&pic.art.w<=pic.box.w+1&&pic.art.h<=pic.box.h+1,pic);
   await tapDoor(page,wrongOf(s.pk));
   f=await boxes(page,['peekArrow','peekBanner']);
   ok(w+': the arrow fits under the banner',inside(f,f.el.peekArrow)&&apart(f.el.peekArrow,f.el.peekBanner),f);
   await page.screenshot({path:path.join(OUT,'sona-peekaboo-'+vp.width+'.png')});
   await advance(page,400);await tapDoor(page,s.pk.correctDoor);
   ok(w+': the find still counts',await until(page,()=>__sayplay.step===1,3000),await st(page));
   await sayWord(page);await until(page,()=>__peekaboo.mode==='shuffle',8000);
   await page.locator('#peekHelp').click({timeout:5000});await until(page,()=>__sayplay.listening,8000);
   f=await boxes(page,['turnPanel','helpBack','hear','peekFinds',...DOORS]);
   ok(w+': a clue ask fits with Back to the game, and covers no door',inside(f,f.el.turnPanel)&&inside(f,f.el.helpBack)&&f.el.helpBack.h>=44&&f.el.helpBack.w>=44&&big(f.el.hear)&&DOORS.every(id=>apart(f.el[id],f.el.turnPanel))&&apart(f.el.peekFinds,f.el.turnPanel),f);
   await page.screenshot({path:path.join(OUT,'sona-peekaboo-help-'+vp.width+'.png')});
   ok(w+': no runtime errors',errors.length===0,errors);
   await context.close();
  }
  {const{page,context,errors}=await fresh({blockAssets:true});await start(page);
   ok('a missing door painting leaves the game playable',await oneFind(page),await st(page));ok('missing art: no runtime errors',errors.length===0,errors);await context.close();}
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
