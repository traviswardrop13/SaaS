// Balloon Party (ages 3-4): the word earns a balloon and big pumps, real taps
// fill it, a real pull-and-let-go puts it on the garland. Every balloon gets
// there without speech: after a miss the ring glows, grows and an arrow
// points, a near release is pulled in, and from the second miss almost any
// pull up (or a tap on the balloon) floats it in. Runs on the page's fake
// clock (page.clock), so it waits on published state, never on real time.
// BALLOON_PART=main|struggle|help|fit runs one part.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
let h,checks=0,failures=0;const part=process.env.BALLOON_PART||'';
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,party:window.__balloon}));
async function fresh(opts={}){return h.fresh({...opts,device:{age:'4',...opts.device}});}
async function dragBalloon(p,to,{cancelOther=false}={}){const b=await p.locator('#partyCanvas').boundingBox(),s=(await state(p)).party;await p.mouse.move(b.x+s.balloon.x*b.width,b.y+s.balloon.y*b.height);await p.mouse.down();if(cancelOther)await p.evaluate(()=>document.getElementById('partyCanvas').dispatchEvent(new PointerEvent('pointercancel',{pointerId:99})));await p.mouse.move(b.x+to.x*b.width,b.y+to.y*b.height,{steps:18});await advance(p,180);await p.mouse.up();}
async function tapBalloon(p){const b=await p.locator('#partyCanvas').boundingBox(),s=(await state(p)).party;await p.mouse.move(b.x+s.balloon.x*b.width,b.y+s.balloon.y*b.height);await p.mouse.down();await advance(p,60);await p.mouse.up();}
async function pumpFull(p){for(let i=0;i<8;i++){if((await state(p)).party.inflation>=1)return true;await p.locator('#partyPump').click();await advance(p,100);}return (await state(p)).party.inflation>=1;}
// a release this far from the ring's centre, in rings, straight below it
const below=(s,rings)=>({x:s.party.goal.x,y:s.party.goal.y+rings*s.party.goal.r*s.party.width/s.party.height});
try{
 h=await gameHarness('balloon',8349);
 // ── (d) parked: a typed address goes home before any mic or sound ──
 if(!part||part==='main'){
  const {page,context,errors}=await fresh({unpark:false});
  const home=await until(page,()=>/\/(today|activities)\.html/.test(location.pathname)&&!!document.getElementById('libraryMessage')&&/Balloon Party is coming soon/.test(document.getElementById('libraryMessage').textContent),8000);
  ok('the parked party goes back to Home, which says it is coming soon',home&&!page.url().includes('arcade-balloon'),{url:page.url(),msg:await page.evaluate(()=>{const m=document.getElementById('libraryMessage');return m&&m.textContent;})});
  ok('…with no mic asked for and no sound played',await page.evaluate(()=>__quiet.requests===0&&__quiet.soundsBefore===0&&__quiet.sounds.length===0&&__quiet.sfx.length===0),await page.evaluate(()=>({r:__quiet.requests,b:__quiet.soundsBefore,s:__quiet.sounds.length})));
  ok('parked bounce has no runtime errors',errors.length===0,errors);await context.close();
 }
 if(!part||part==='main'){
  const {page,context,errors}=await fresh();const canvas=await page.locator('#partyCanvas').count();ok('Balloon Party has real pump-and-guide play',canvas===1);if(!canvas)throw new Error('Balloon Party is still an animation scene');
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);await page.locator('#partyPump').evaluate(e=>e.click());await advance(page,2000);let s=await state(page);ok('silence and a pump tap cannot skip the word',!s.party.active&&s.party.inflation===0&&s.party.delivered===0&&s.speech.step===0,s);
  // (a) a whole listening window of silence: still no balloon, the mic waits for a tap
  await advance(page,13000);s=await state(page);ok('13 s of silence earns nothing: no balloon, no step, the mic waits',s.speech.phase==='nudge'&&!s.party.active&&s.party.inflation===0&&s.speech.step===0&&!await page.locator('#partyPump').isVisible(),s);
  await page.locator('#micBtn').click();
  ok('two accepted sayings earn a balloon and speech power',await sayWord(page));s=await state(page);ok('the word gives big pumps and a big ring without inflating or delivering',s.party.power>0&&s.party.wind===0&&s.party.reach===2&&s.party.inflation===0&&s.party.delivered===0,s);
  await page.locator('#partyPump').click();s=await state(page);const boosted=s.party.inflation;ok('a real pump tap adds air',boosted>0&&boosted<1,s);
  await advance(page,11000);s=await state(page);ok('power expiry keeps the balloon and the earned turn',s.party.power===0&&s.party.active&&s.party.inflation===boosted&&s.speech.step===0&&s.party.reach===1,s);
  await page.locator('#partyPump').click();s=await state(page);const ordinary=s.party.inflation-boosted;ok('speech actually makes each pump stronger',boosted>=ordinary*1.8&&ordinary>0,{boosted,ordinary});ok('normal play has a gentle wind',s.party.wind>0,s);
  const held=s.party.inflation;await page.locator('#partyHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('asking for help keeps the same half-filled balloon',s.party.paused&&s.party.inflation===held&&s.speech.step===0&&await page.locator('#helpBack').isVisible(),s);
  // a page hidden during the help ask: back to the same move, no power
  await page.evaluate(()=>__quiet.background());await advance(page,400);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await advance(page,100);s=await state(page);ok('a pause during the help ask goes back to the same balloon, with no power',s.speech.phase==='play'&&!s.party.paused&&s.party.power===0&&s.party.inflation===held&&s.speech.step===0&&await page.locator('#partyPump').isEnabled(),s);
  await page.locator('#partyHelp').click();
  ok('a help word said two times renews the balloon power',await sayWord(page));s=await state(page);ok('speech help keeps the air and the stage, and makes the ring big',s.party.inflation===held&&s.party.power>0&&s.party.reach===2&&s.party.wind===0&&s.speech.step===0,s);
  ok('real taps can finish pumping the balloon',await pumpFull(page));await advance(page,5000);s=await state(page);ok('a full balloon never delivers itself',s.party.delivered===0&&s.speech.step===0,s);
  await dragBalloon(page,{x:.7,y:.68});s=await state(page);ok('a missed drop keeps a full balloon and costs no word',s.party.inflation===1&&s.party.delivered===0&&s.party.active&&s.speech.step===0&&s.party.misses===1,s);
  ok('a miss says so kindly',/So close/.test(s.party.banner)&&!/miss|wrong|fail|score|point|correct/i.test(s.party.banner),s.party.banner);
  const beforeKeys={...s.party.balloon};await page.locator('#partyBalloon').focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowUp');s=await state(page);ok('keyboard arrows move the same real balloon',s.party.balloon.x<beforeKeys.x&&s.party.balloon.y<beforeKeys.y&&s.party.delivered===0,s);
  await page.screenshot({path:path.join(OUT,'sona-balloon-party.png')});
  for(let stage=0;stage<5;stage++){
   if(stage){if(!await sayWord(page))throw new Error('Could not earn balloon '+stage);if(!await pumpFull(page))throw new Error('Could not inflate balloon '+stage);}
   s=await state(page);await dragBalloon(page,s.party.goal,{cancelOther:stage===0});
   if(stage===0){
    // the celebration beat: the chime and the cheer first, the step about a second later, once
    await advance(page,600);s=await state(page);ok('a landed balloon cheers before the step counts',s.party.delivered===1&&s.party.celebrating&&s.speech.step===0&&s.speech.phase==='play',s);
    await advance(page,1200);s=await state(page);ok('…and the step counts once, after the beat',s.speech.step===1&&!s.party.celebrating,s);
    await advance(page,1500);ok('done() is called exactly once for the balloon',(await state(page)).speech.step===1);
   }
   ok('a real drag and release attaches balloon '+(stage+1),await until(page,n=>__sayplay.step>n,5000,stage));
  }
  await advance(page,3300);s=await state(page);ok('five deliveries fill the garland and finish the party',s.speech.phase==='end'&&s.speech.step===5&&s.party.delivered===5&&s.party.won,s);
  const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));ok('no party sound or instruction reaches a live microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);ok('the child hears how to pump and guide',audio.lines.some(t=>/pump/i.test(t)&&/drag|pull|guide/i.test(t)),audio.lines);
  ok('the intro says the word earns the balloon, and no calm wind',audio.lines.some(t=>/two times to get a balloon/i.test(t))&&!audio.lines.some(t=>/wind/i.test(t)),audio.lines);
  ok('Echo says what to do in play',audio.lines.some(t=>/^Tap the pump/.test(t))&&audio.lines.some(t=>/^Now pull your balloon/.test(t)),audio.lines);
  await page.screenshot({path:path.join(OUT,'sona-balloon-finished.png')});await page.locator('#again').click();await advance(page,400);s=await state(page);ok('another party starts empty and requires speech again',s.speech.step===0&&s.party.delivered===0&&s.party.inflation===0&&!s.party.active&&s.party.misses===0,s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 if(!part||part==='main'){
  const {page,context,errors}=await fresh({blockAssets:true});await page.locator('#startBtn').click();await sayWord(page);await pumpFull(page);const s=await state(page);await dragBalloon(page,s.party.goal);ok('missing painted sprites do not block a real delivery',await until(page,()=>__sayplay.step===1,5000));ok('fallback art has no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── (b) a struggling child, never speaking again: the ladder ──
 if(!part||part==='struggle'){
  const {page,context,errors}=await fresh();await page.locator('#startBtn').click();await sayWord(page);
  await advance(page,11000);  // the word's big ring has run out: the plain ring
  await pumpFull(page);let s=await state(page);
  ok('miss 0: the plain ring, wind on',s.party.level===0&&s.party.reach===1&&s.party.ringScale===1&&s.party.wind>0,s.party);
  await dragBalloon(page,below(s,1.6));s=await state(page);ok('a release just outside the plain ring is a miss',s.party.misses===1&&s.party.delivered===0&&s.speech.step===0,s.party);
  ok('miss 1: the ring glows bigger, an arrow shows the way, no wind',s.party.level===1&&s.party.ringScale>1.3&&s.party.reach===2.5&&s.party.wind===0,s.party);
  await tapBalloon(page);s=await state(page);ok('a tap with no pull is a try too, and still kind',s.party.misses===2&&s.party.delivered===0&&/Nearly/.test(s.party.banner),s.party);
  ok('miss 2: almost anything works',s.party.level===2&&s.party.reach===3,s.party);
  // far from the ring, but pulled upward: it floats in
  await dragBalloon(page,{x:.9,y:s.party.balloon.y-60/s.party.height});s=await state(page);
  ok('from the second miss a pull upward floats the balloon into the ring',s.party.pulling||s.party.delivered===1,s.party);
  ok('…and the step counts with no speech',await until(page,()=>__sayplay.step===1,3000),await state(page));
  s=await state(page);ok('a new balloon starts the ladder again',s.party.misses===0&&s.party.level===0,s.party);
  // level 1 pulls a near release in; a far one is still a miss
  await sayWord(page);await advance(page,11000);await pumpFull(page);s=await state(page);
  await dragBalloon(page,{x:.85,y:.7});s=await state(page);ok('balloon 2: a far release is miss 1',s.party.misses===1&&s.party.level===1,s.party);
  await dragBalloon(page,below(s,2.2));ok('miss 1: a release about two rings away is pulled into the ring',await until(page,()=>__sayplay.step===2,3000),await state(page));
  // level 2: a still tap on the balloon is enough
  await sayWord(page);await advance(page,11000);await pumpFull(page);
  await tapBalloon(page);await tapBalloon(page);s=await state(page);ok('balloon 3: two still taps climb the ladder to 2',s.party.level===2&&s.speech.step===2,s.party);
  await tapBalloon(page);ok('miss 2: a tap on the balloon floats it in',await until(page,()=>__sayplay.step===3,3000),await state(page));
  s=await state(page);ok('nothing in the ladder needed the help word or gave power',s.party.power===0||s.party.power<=10,s.party);
  ok('struggle has no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── (c) help, then silence (or the pill): the same move, no power ──
 if(!part||part==='help'){
  const {page,context,errors}=await fresh();await page.locator('#startBtn').click();await sayWord(page);
  await page.locator('#partyPump').click();await advance(page,11000);let s=await state(page);
  const was={infl:s.party.inflation,x:s.party.balloon.x,y:s.party.balloon.y};
  await page.locator('#partyHelp').click();await until(page,()=>__sayplay.listening);
  await advance(page,13500);s=await state(page);
  ok('help, then 13 s of silence: the same balloon, no power, playing again',s.speech.phase==='play'&&!s.speech.paused&&!s.party.paused&&s.party.active&&s.party.power===0&&s.speech.step===0&&s.party.inflation===was.infl&&Math.abs(s.party.balloon.y-was.y)<1e-9&&!await page.locator('#helpBack').isVisible()&&await page.locator('#partyPump').isEnabled(),{s,was});
  await page.locator('#partyPump').click();s=await state(page);ok('…and the pump goes on from there',s.party.inflation>was.infl&&s.party.pumpGain<0.2,s.party);
  const was2=s.party.inflation;
  await page.locator('#partyHelp').click();await until(page,()=>__sayplay.listening);await page.locator('#helpBack').click();await advance(page,100);s=await state(page);
  ok('"Back to the game" gives the same balloon back, no power',s.speech.phase==='play'&&!s.party.paused&&s.party.power===0&&s.speech.step===0&&s.party.inflation===was2&&await page.locator('#partyPump').isEnabled(),s);
  // a full balloon mid-pull: help and back keep it where the child left it
  await pumpFull(page);await dragBalloon(page,{x:.6,y:.5});s=await state(page);const spot={...s.party.balloon},m=s.party.misses;
  await page.locator('#partyHelp').click();await until(page,()=>__sayplay.listening);await page.locator('#helpBack').click();await advance(page,100);s=await state(page);
  ok('help and back keep a full balloon and its ladder exactly as they were',s.party.full&&s.party.misses===m&&Math.abs(s.party.balloon.x-spot.x)<1e-9&&Math.abs(s.party.balloon.y-spot.y)<1e-9&&s.party.power===0,{s:s.party,spot,m});
  await dragBalloon(page,s.party.goal);ok('the move then finishes with no speech',await until(page,()=>__sayplay.step===1,3000));
  ok('help has no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── (e) fit: play, a word turn and a help ask on four screens ──
 if(!part||part==='fit'){
  const inside=(r,v)=>r.w>0&&r.h>0&&r.x>=-0.5&&r.y>=-0.5&&r.right<=v.width+0.5&&r.bottom<=v.height+0.5;
  const meet=(a,b)=>a.x<b.right-0.5&&b.x<a.right-0.5&&a.y<b.bottom-0.5&&b.y<a.bottom-0.5;
  const rects=(p,ids)=>p.evaluate(ids=>ids.map(id=>{const e=document.getElementById(id),r=e?e.getBoundingClientRect():{x:0,y:0,right:0,bottom:0,width:0,height:0};return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,shown:!!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'};}),ids);
  const big=r=>r.w>=44&&r.h>=44;
  for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024}]){
   const tag=viewport.width+'x'+viewport.height;
   const {page,context,errors}=await fresh({viewport});
   let r=await rects(page,['startBtn']);ok(tag+': the start card button is on screen',inside(r[0],viewport)&&big(r[0]),r);
   await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
   r=await rects(page,['turnPanel','word','hear','picBox']);ok(tag+': the word turn fits, with a big enough Hear it',r.every(x=>x.shown&&inside(x,viewport))&&big(r[2]),r);
   await sayWord(page);await pumpFull(page);
   const fit=await page.evaluate(()=>({scroll:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth}));
   r=await rects(page,['partyCanvas','partyPump','partyHelp','partyBanner','partyBalloon','partyPower']);const R=Object.fromEntries(r.map(x=>[x.id,x]));
   ok(tag+': the party fits with no scrolling',fit.scroll<=viewport.height+1&&fit.sw<=viewport.width+1&&['partyCanvas','partyPump','partyHelp','partyBanner','partyBalloon'].every(id=>R[id].shown&&inside(R[id],viewport)),{fit,r});
   ok(tag+': the pump, the help pill and the balloon are big touch targets',['partyPump','partyHelp','partyBalloon'].every(id=>big(R[id])),r);
   // the lit ring, at its biggest (the second miss), is on screen and clear of the banner and the buttons
   await dragBalloon(page,{x:.85,y:.75});await tapBalloon(page);
   const s=(await state(page)).party,b=await page.locator('#partyCanvas').boundingBox(),rr=s.goal.r*s.width*s.ringScale,ring={w:2*rr,h:2*rr,x:b.x+s.goal.x*b.width-rr,y:b.y+s.goal.y*b.height-rr,right:b.x+s.goal.x*b.width+rr,bottom:b.y+s.goal.y*b.height+rr};
   r=await rects(page,['partyPump','partyHelp','partyBanner','partyPower']);const Q=Object.fromEntries(r.map(x=>[x.id,x]));
   ok(tag+': the glowing ring is on screen and nothing covers it',s.level===2&&inside(ring,viewport)&&['partyPump','partyHelp','partyBanner'].every(id=>!meet(ring,Q[id]))&&!(Q.partyPower.shown&&meet(ring,Q.partyPower)),{ring,r,s});
   await page.locator('#partyHelp').click();await until(page,()=>__sayplay.listening);
   r=await rects(page,['turnPanel','hear','helpBack','word']);ok(tag+': a help ask fits, with a big enough "Back to the game"',r.every(x=>x.shown&&inside(x,viewport))&&big(r[1])&&big(r[2]),r);
   await page.locator('#helpBack').click();await advance(page,100);
   await dragBalloon(page,(await state(page)).party.goal);ok(tag+': a child can deliver on this screen size',await until(page,()=>__sayplay.step===1,5000));
   await page.screenshot({path:path.join(OUT,'sona-balloon-'+viewport.width+'.png')});ok(tag+': fit has no runtime errors',errors.length===0,errors);await context.close();
  }
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
