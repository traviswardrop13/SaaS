// Castle Builder: each word said two times brings a castle piece; the finger
// slides the crane and holds Lower to fit it. Plays the real page on a fake
// clock (page.clock), so every wait is on published state, never real time.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
const PORT=8351,BASE='http://127.0.0.1:'+PORT;
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,castle:window.__castle}));
async function slide(p,x,{cancelOther=false}={}){
 const b=await p.locator('#castleCanvas').boundingBox(),s=(await state(p)).castle;
 await p.mouse.move(b.x+s.craneX*b.width,b.y+s.railY*b.height);await p.mouse.down();
 if(cancelOther)await p.evaluate(()=>document.getElementById('castleTrolley').dispatchEvent(new PointerEvent('pointercancel',{pointerId:99})));
 await p.mouse.move(b.x+x*b.width,b.y+s.railY*b.height,{steps:16});await p.mouse.up();await advance(p,100);
}
async function holdLower(p,ms){const b=await p.locator('#castleLower').boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await advance(p,ms);await p.mouse.up();await advance(p,80);}
// one real attempt: hold Lower until the piece touches down, let go, and wait
// for a missed piece to be lifted back up. Answers what the touchdown did.
async function attempt(p){
 const before=(await state(p)).castle;
 const b=await p.locator('#castleLower').boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();
 const touched=await until(p,()=>!__castle.lowering,9000);await p.mouse.up();await advance(p,40);
 const at=await p.evaluate(()=>__quiet.now());
 let s=(await state(p)).castle;const placed=s.placed>before.placed;
 if(!placed)await until(p,()=>!__castle.hoisting,6000);
 s=(await state(p)).castle;
 return {touched,placed,at,ladder:s.ladder,pieceMisses:s.pieceMisses,castle:s};
}
async function place(p,stage){
 for(let n=0;n<4;n++){
  const s=(await state(p)).castle;await slide(p,s.slot.x,{cancelOther:stage===0&&n===0});await holdLower(p,6000);
  if(await until(p,(st)=>__sayplay.step>st,3000,stage))return true;
  await until(p,()=>!__castle.hoisting,4000);
 }
 return false;
}
async function peakSwing(p,ms=2800){let peak=0;for(let t=0;t<ms;t+=100){await advance(p,100);peak=Math.max(peak,Math.abs((await state(p)).castle.swing));}return peak;}
// a help ask that ends with no word: the same move, the same piece, no power
function sameMove(s,held){return s.speech.phase==='play'&&!s.speech.paused&&!s.castle.paused&&s.castle.active&&s.castle.power===0&&s.speech.step===held.step&&s.castle.placed===held.placed&&s.castle.stage===held.stage&&Math.abs(s.castle.rope-held.rope)<1e-9&&Math.abs(s.castle.craneX-held.x)<1e-9&&s.castle.pieceMisses===held.pieceMisses;}
const held=s=>({rope:s.castle.rope,x:s.castle.craneX,step:s.speech.step,placed:s.castle.placed,stage:s.castle.stage,pieceMisses:s.castle.pieceMisses});
const UNKIND=/\b(miss(ed|es)?|wrong|fail(ed)?|score|points?|correct|lose|lost)\b/i;
try{
 h=await gameHarness('castle',PORT);
 // ── parked: a typed address goes home before any mic or sound ──
 {
  const {page,context,errors}=await h.fresh({unpark:false});
  const home=await until(page,()=>/\/(today|activities)\.html/.test(location.pathname)&&!!document.getElementById('libraryMessage')&&/Castle Builder is coming soon/.test(document.getElementById('libraryMessage').textContent),8000);
  ok('the parked castle page goes back to Home, which says it is coming soon',home&&!page.url().includes('arcade-castle'),{url:page.url(),msg:await page.evaluate(()=>{const m=document.getElementById('libraryMessage');return m&&m.textContent;})});
  ok('…with no mic asked for and no sound played',await page.evaluate(()=>__quiet.requests===0&&__quiet.sounds.length===0&&__quiet.sfx.length===0));
  // the castle page's own counts, carried over the bounce in this tab
  await context.addInitScript(()=>{if(location.pathname!=='/arcade-castle.html')return;try{sessionStorage.setItem('castle.seen','1');}catch(e){}addEventListener('pagehide',()=>{try{sessionStorage.setItem('castle.quiet',JSON.stringify({requests:__quiet.requests,mics:__quiet.mics.length,sounds:__quiet.sounds.length,sfx:__quiet.sfx.length,speech:__quiet.speech.length}));}catch(e){}});});
  await page.goto(BASE+'/arcade-castle.html');await until(page,()=>/\/(today|activities)\.html/.test(location.pathname),8000);
  const led=await page.evaluate(()=>({seen:sessionStorage.getItem('castle.seen'),quiet:JSON.parse(sessionStorage.getItem('castle.quiet')||'null')}));
  ok('the parked castle page itself opened no mic and made no sound before leaving',led.seen==='1'&&led.quiet&&led.quiet.requests===0&&led.quiet.mics===0&&led.quiet.sounds===0&&led.quiet.sfx===0&&led.quiet.speech===0,led);
  ok('parked bounce has no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── the whole castle, with every help path ──
 {
  const {page,context,errors}=await h.fresh();const canvas=await page.locator('#castleCanvas').count();ok('Castle Builder has a real crane board',canvas===1);if(!canvas)throw Error('Castle Builder is still an animation scene');
  const words=await page.evaluate(()=>({banners:Castle.BANNERS,start:document.querySelector('#startOvl .ovlCard').innerText,primer:document.querySelector('#primer .ovlCard').innerText,help:document.getElementById('castleHelp').getAttribute('aria-label'),canvas:document.getElementById('castleCanvas').getAttribute('aria-label')}));
  ok('the start card says the word, said two times, earns each piece',/two times to get a castle piece/i.test(words.start),words.start);
  ok('the mic card says the same',/two times to get a piece/i.test(words.primer),words.primer);
  ok('the help button says it is extra help',/^Extra help/.test(words.help),words.help);
  ok('no banner line is unkind or a grade',words.banners.length>10&&words.banners.every(t=>!UNKIND.test(t)),words.banners.filter(t=>UNKIND.test(t)));
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);await page.locator('#castleLower').evaluate(e=>e.click());
  // (a) silence: the whole listening window passes and nothing is earned
  const nudged=await until(page,()=>__sayplay.phase==='nudge',16000);let s=await state(page);
  ok('silence and a Lower tap earn nothing: no piece, no step, no rope power',nudged&&!s.castle.active&&s.castle.placed===0&&s.castle.power===0&&s.speech.step===0&&s.speech.said===0,s);
  await page.locator('#micBtn').click();
  ok('two accepted sayings earn the first crane piece',await sayWord(page));s=await state(page);const wide=s.castle.tolerance;
  ok('the word hangs the piece on the hook without placing it',s.castle.active&&s.castle.power>0&&s.castle.placed===0&&s.speech.step===0&&s.castle.ladder===0&&s.castle.pieceMisses===0,s);
  ok('the banner tells the child what to do with the piece',/slide/i.test(s.castle.banner)&&/lower/i.test(s.castle.banner),s.castle.banner);
  const assistedSwing=await peakSwing(page);await advance(page,11000);s=await state(page);const narrow=s.castle.tolerance,ordinarySwing=await peakSwing(page);ok('the steady-rope power makes the placement window more forgiving',wide>narrow*1.4&&narrow>0,{wide,narrow});ok('the steady-rope power really calms the hanging load',assistedSwing<ordinarySwing*.75&&ordinarySwing>0,{assistedSwing,ordinarySwing});
  ok('an idle crane never places a piece',s.castle.placed===0&&s.speech.step===0&&s.castle.power===0,s);await slide(page,.1);const slid=(await state(page)).castle;ok('dragging moves the actual trolley',slid.craneX<.2,slid);
  const miss=await attempt(page);s=await state(page);
  ok('a touchdown beside the slot keeps the same piece and costs no new word',miss.touched&&!miss.placed&&s.castle.placed===0&&s.speech.step===0&&s.castle.active,{miss,s});
  ok('one miss makes this piece easier: a wider window, half the swing',s.castle.ladder===1&&s.castle.pieceMisses===1&&s.castle.tolerancePx>=s.castle.baseTolerancePx*1.5&&s.castle.steadyFactor===0.5&&!s.castle.guide,s.castle);
  await slide(page,.5);await holdLower(page,240);s=await state(page);const parkedRope=s.castle.rope;await advance(page,600);s=await state(page);ok('releasing Lower really parks the rope',!s.castle.lowering&&Math.abs(s.castle.rope-parkedRope)<.001,s);
  // (c) help, then silence: the same move comes back, with no power
  let was=held(s);await page.locator('#castleHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);
  ok('help parks the same unfinished castle and rope, and the banner says what to say',s.castle.paused&&s.castle.rope===was.rope&&s.castle.craneX===was.x&&s.castle.placed===0&&s.speech.step===0&&await page.locator('#helpBack').isVisible()&&s.castle.banner==='Say it for a steady rope',s);
  await advance(page,13000);await until(page,()=>__sayplay.phase==='play',4000);s=await state(page);
  ok('help, then 13 s of silence: the same move goes on, with no power',sameMove(s,was)&&!/^Say it/.test(s.castle.banner)&&!await page.locator('#castleLower').isDisabled()&&await page.locator('#castleTrolley').isVisible()&&!await page.locator('#helpBack').isVisible(),{s,was});
  await advance(page,300);s=await state(page);ok('…and the crane runs again right where it was',!s.castle.paused&&Math.abs(s.castle.rope-was.rope)<1e-9&&s.castle.craneX===was.x,s);
  was=held(s);await page.locator('#castleHelp').click();await until(page,()=>__sayplay.listening);await page.locator('#helpBack').click();await advance(page,100);s=await state(page);
  ok('help, then a tap on "Back to the game": the same move, no power',sameMove(s,was)&&!s.speech.listening,{s,was});
  was=held(s);await page.locator('#castleHelp').click();await until(page,()=>__sayplay.listening);await page.evaluate(()=>__quiet.background());await advance(page,400);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await until(page,()=>__sayplay.phase==='play',4000);s=await state(page);
  ok('help, then the phone locked: back to the same move, no power',sameMove(s,was)&&await page.evaluate(()=>__quiet.live()===0),{s,was});
  was=held(s);await page.locator('#castleHelp').click();
  ok('the help word, said two times, renews the steady rope',await sayWord(page));s=await state(page);ok('help keeps the trolley, the rope, the piece and its misses',s.castle.power>0&&!s.castle.paused&&s.castle.rope===was.rope&&s.castle.craneX===was.x&&s.castle.placed===0&&s.speech.step===0&&s.castle.pieceMisses===was.pieceMisses,s);
  await page.locator('#castleTrolley').focus();const keyStart=s.castle.craneX;await page.keyboard.press('ArrowLeft');s=await state(page);ok('keyboard arrows control the actual crane',s.castle.craneX<keyStart,s);
  await page.screenshot({path:path.join(OUT,'sona-castle-crane.png')});const slots=[];
  for(let stage=0;stage<8;stage++){
   if(stage&&!await sayWord(page))throw Error('Could not earn castle stage '+stage);
   s=await state(page);slots.push([s.castle.slot.x,s.castle.slot.y].join(','));const okPlace=await place(page,stage);s=await state(page);
   ok('the crane physically places castle piece '+(stage+1),okPlace&&s.castle.dones===stage+1&&s.speech.step===stage+1,s);
  }
  await until(page,()=>__sayplay.phase==='end',6000);s=await state(page);ok('eight real placements build the castle and finish',s.speech.phase==='end'&&s.speech.step===8&&s.castle.placed===8&&s.castle.won&&s.castle.dones===8,s);ok('the architecture uses eight separate slots',new Set(slots).size===8,slots);
  const end=await page.evaluate(()=>document.getElementById('endSub').textContent);ok('the end card says the flags are flying (they were the last piece)',/flags are flying/i.test(end),end);
  const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));ok('castle sounds and instructions stay out of the microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);
  ok('Echo says the word earns each piece, and how to steer and lower it',audio.lines.some(t=>/two times to get a castle piece/i.test(t)&&/crane/i.test(t)&&/lower/i.test(t)),audio.lines);
  await page.screenshot({path:path.join(OUT,'sona-castle-finished.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-castle-built.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='');await page.locator('#again').click();await advance(page,400);s=await state(page);ok('a new castle starts empty and requires speech again',s.speech.step===0&&s.castle.placed===0&&!s.castle.active&&s.castle.dones===8&&s.castle.pieceMisses===0,s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── (b) a child who keeps missing, and never asks for help ──
 {
  const {page,context,errors}=await h.fresh();await page.locator('#startBtn').click();
  ok('struggler: one word brings the first piece',await sayWord(page));await advance(page,11000);let s=await state(page);
  ok('struggler: the steady rope has run out, the game as designed',s.castle.power===0&&s.castle.ladder===0,s.castle);
  const L0=await peakSwing(page);
  // never slides: holds Lower where the trolley stopped, far from the slot
  const r1=await attempt(page);s=await state(page);
  ok('miss 1 (no slide): the same piece, and the ladder steps up to 1',r1.touched&&!r1.placed&&r1.ladder===1&&s.speech.step===0&&s.castle.steadyFactor===0.5&&s.castle.tolerancePx>=s.castle.baseTolerancePx*1.5&&!s.castle.guide,{r1,s:s.castle});
  ok('miss 1 is kind: no grade words',!UNKIND.test(s.castle.banner),s.castle.banner);
  const r2=await attempt(page);s=await state(page);
  ok('miss 2: the slot glows, the stop and the arrow show where (ladder 2)',r2.touched&&!r2.placed&&r2.ladder===2&&s.castle.guide&&s.castle.steadyFactor===0&&s.castle.tolerancePx>=s.castle.baseTolerancePx*2.2&&/arrow/i.test(s.castle.banner)&&await page.locator('#castleTrolley.guide').count()===1,{r2,s:s.castle});
  await advance(page,1500);const L2=await peakSwing(page);
  ok('miss 2: the rope hangs still',L2<0.02&&L0>0.05,{L0,L2});
  const r3=await attempt(page);s=await state(page);
  ok('miss 3: holding Lower will glide the trolley over the slot (ladder 3)',r3.touched&&!r3.placed&&r3.ladder===3&&s.castle.glide&&s.speech.step===0,{r3,s:s.castle});
  const r4=await attempt(page);s=await state(page);
  ok('the 4th try fits the piece, with no word said and no help asked',r4.placed&&s.castle.placed===1&&Math.abs(s.castle.craneX-s.castle.stopX)<0.02,{r4,s:s.castle});
  // (2) the celebration beat: the step comes about 1.15 s later, once
  ok('the step waits for the celebration beat',s.speech.step===0&&s.speech.phase==='play'&&s.castle.doneIn>0.9&&s.castle.dones===0,s);
  const chime=await page.evaluate((at)=>__quiet.sfx.filter(x=>x.name==='correct'&&x.at>=at-0.2).length,r4.at);ok('the "correct" chime plays as the piece locks in',chime>=1,chime);
  await advance(page,700);s=await state(page);ok('…and still waits 0.7 s later',s.speech.step===0&&s.castle.dones===0,s);
  await until(page,()=>__sayplay.step===1,2000);const stepAt=await page.evaluate(()=>__quiet.now());s=await state(page);
  ok('the step counts after about 1.15 s, exactly once',s.speech.step===1&&s.castle.dones===1&&stepAt-r4.at>=0.95&&stepAt-r4.at<=1.6,{gap:stepAt-r4.at,s});
  await advance(page,2000);s=await state(page);ok('…never twice',s.speech.step===1&&s.castle.dones===1,s);
  // the next piece: aimed beside the slot, by a bit, until it fits
  ok('struggler: the next word brings the next piece, the ladder back at 0',await sayWord(page)&&(await state(page)).castle.ladder===0&&(await state(page)).castle.stage===1);await advance(page,11000);s=await state(page);
  await slide(page,s.castle.slot.x+0.12);let tries=0,done=false;
  while(tries<5&&!done){const r=await attempt(page);tries++;done=r.placed;}
  ok('aimed beside the slot every time, the piece still fits within 4 tries',done&&tries<=4,{tries});
  await until(page,()=>__sayplay.step===2,3000);s=await state(page);ok('struggler: two pieces from two words, with no help word',s.speech.step===2&&s.castle.placed===2&&s.castle.dones===2,s);
  ok('struggler has no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── a child aged 4: the gentler ladder ──
 {
  const {page,context,errors}=await h.fresh({device:{age:'4'}});await page.locator('#startBtn').click();
  ok('age 4: one word brings the first piece',await sayWord(page));await advance(page,11000);let s=await state(page);
  ok('age 4: the gentler ladder is on, starting at the game as designed',s.castle.little&&s.castle.ladder===0,s.castle);
  const r1=await attempt(page);ok('age 4, miss 1: the glow and the arrow already (ladder 2)',!r1.placed&&r1.ladder===2&&r1.castle.guide,r1);
  const r2=await attempt(page);ok('age 4, miss 2: holding Lower glides it in (ladder 3)',!r2.placed&&r2.ladder===3&&r2.castle.glide,r2);
  const r3=await attempt(page);await until(page,()=>__sayplay.step===1,3000);s=await state(page);
  ok('age 4: the 3rd try fits the piece, with no word said',r3.placed&&s.speech.step===1&&s.castle.dones===1,{r3,s});
  ok('age 4 has no runtime errors',errors.length===0,errors);await context.close();
 }
 {
  const {page,context,errors}=await h.fresh({blockAssets:true});await page.locator('#startBtn').click();await sayWord(page);ok('missing painted pieces cannot block crane placement',await place(page,0));ok('fallback castle has no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── (e) fit: play, a word turn and a help ask on four screens ──
 const inside=(r,v)=>r.w>0&&r.h>0&&r.x>=-0.5&&r.y>=-0.5&&r.right<=v.width+0.5&&r.bottom<=v.height+0.5;
 const meet=(a,b)=>a.x<b.right&&b.x<a.right&&a.y<b.bottom&&b.y<a.bottom;
 const rects=(p,ids)=>p.evaluate(ids=>ids.map(id=>{const e=document.getElementById(id),r=e?e.getBoundingClientRect():{x:0,y:0,right:0,bottom:0,width:0,height:0};return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,shown:!!e&&!e.hidden&&getComputedStyle(e).visibility!=='hidden'};}),ids);
 for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024}]){
  const tag=viewport.width+'x'+viewport.height;
  const {page,context,errors}=await h.fresh({viewport});await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
  let r=await rects(page,['turnPanel','word','hear','picBox']);
  ok(tag+': the word turn fits, with a big enough Hear it',r.every(x=>x.shown&&inside(x,viewport))&&r[2].w>=44&&r[2].h>=44,r);
  await sayWord(page);
  const fit=await page.evaluate(()=>({scroll:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth}));
  r=await rects(page,['castleCanvas','castleTrolley','castleLower','castleHoist','castleHelp','castleBanner','castlePieceName','castlePower']);const R=Object.fromEntries(r.map(x=>[x.id,x]));
  ok(tag+': the crane board fits with no scrolling',fit.scroll<=viewport.height+1&&fit.sw<=viewport.width+1&&['castleCanvas','castleTrolley','castleLower','castleHoist','castleHelp'].every(id=>R[id].shown&&inside(R[id],viewport)),{fit,r});
  ok(tag+': every crane control is a big touch target',['castleTrolley','castleLower','castleHoist','castleHelp'].every(id=>R[id].w>=44&&R[id].h>=44),r);
  // every banner line, even the longest, sits clear of the rail and trolley
  const s=(await state(page)).castle,c=R.castleCanvas,railTop=c.y+s.railY*c.h-33;
  const lows=await page.evaluate(()=>{const b=document.getElementById('castleBanner'),keep=b.textContent,out=Castle.BANNERS.map(t=>{b.textContent=t;const r=b.getBoundingClientRect();return{t,bottom:r.bottom,h:r.height};});b.textContent=keep;return out;});
  ok(tag+': no banner line covers the crane rail or the trolley',lows.every(l=>l.bottom<=railTop&&l.bottom<=R.castleTrolley.y),{railTop,trolley:R.castleTrolley.y,lows:lows.filter(l=>l.bottom>railTop||l.bottom>R.castleTrolley.y)});
  const slotRects=s.slots.map(q=>({x:c.x+(q.x-q.width/2)*c.w,right:c.x+(q.x+q.width/2)*c.w,y:c.y+q.top*c.h,bottom:c.y+q.bottom*c.h}));
  ok(tag+': the piece name and the power bar never cover a castle slot',slotRects.every(q=>!meet(q,R.castlePieceName)&&!(R.castlePower.shown&&meet(q,R.castlePower))&&!meet(q,R.castleLower)&&q.x>=c.x-0.5&&q.right<=c.right+0.5),{slotRects,name:R.castlePieceName,power:R.castlePower});
  // a help ask: the word panel and "Back to the game" fit and are big enough
  await page.locator('#castleHelp').click();await until(page,()=>__sayplay.listening);
  r=await rects(page,['turnPanel','hear','helpBack','word']);
  ok(tag+': a help ask fits, with a big enough "Back to the game"',r.every(x=>x.shown&&inside(x,viewport))&&r[2].w>=44&&r[2].h>=44&&r[1].w>=44&&r[1].h>=44,r);
  await page.locator('#helpBack').click();await advance(page,100);
  ok(tag+': "Back to the game" brings the crane back',(await state(page)).speech.phase==='play'&&await page.locator('#castleLower').isVisible());
  ok(tag+': a child can place a piece on this screen',await place(page,0),await state(page));await page.screenshot({path:path.join(OUT,'sona-castle-'+viewport.width+'.png')});ok(tag+': fit has no runtime errors',errors.length===0,errors);await context.close();
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
