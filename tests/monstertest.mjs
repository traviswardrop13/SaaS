// Monster Makeover: each word said two times earns the next salon job; the
// finger does the job. Plays the real page on a fake clock (page.clock), so
// every wait is on published state, never on real time.
// MONSTER_PART=parked|main|struggle|fit runs one part.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
const PORT=8354,BASE='http://127.0.0.1:'+PORT;
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+String(JSON.stringify(d)).slice(0,2500)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,monster:window.__monster}));
const UNKIND=/\b(miss(ed|es)?|wrong|fail(ed)?|score|points?|correct|lose|lost)\b/i;
// a point on the monster (0..1 of its own box) in canvas-normalized units
const on=(m,lx,ly)=>({x:m.x-m.w/2+lx*m.w,y:m.y-m.h/2+ly*m.h});
function combDetour(s){const m=s.monster.monster,t=s.monster.comb[0],top=m.y-m.h/2,left=m.x-m.w*.48;return[{x:t.x,y:top-m.h*.095},{x:left,y:top-m.h*.095},{x:left,y:top+m.h*.55},{x:t.x,y:top+m.h*.55}];}
function snipDetour(s){const m=s.monster.monster,t=s.monster.snips[0],top=m.y-m.h/2,left=m.x-m.w*.47,right=m.x+m.w*.47;return[{x:left,y:t.y},{x:left,y:top-m.h*.095},{x:right,y:top-m.h*.095},{x:right,y:t.y}];}
async function gesture(p,points,{hold=0,cancelOther=false}={}){const b=await p.locator('#monsterCanvas').boundingBox();await p.mouse.move(b.x+points[0].x*b.width,b.y+points[0].y*b.height);await p.mouse.down();if(cancelOther)await p.locator('#monsterTool').evaluate(e=>e.dispatchEvent(new PointerEvent('pointercancel',{pointerId:99})));for(const q of points.slice(1))await p.mouse.move(b.x+q.x*b.width,b.y+q.y*b.height,{steps:12});if(hold)await advance(p,hold);await p.mouse.up();await advance(p,60);}
// a finished job is reported after the celebration beat: wait for the step
const stepPast=(p,stage,max=3000)=>until(p,st=>__sayplay.step>st,max,stage);
async function scrub(p){for(let pass=0;pass<10;pass++){let s=await state(p);if(s.speech.step>0||s.monster.completed>0)break;for(const t of s.monster.mud.filter(t=>!t.clean))await gesture(p,[{x:t.x-t.r*.55,y:t.y},{x:t.x+t.r*.55,y:t.y},{x:t.x-t.r*.55,y:t.y}],{cancelOther:pass===0});}return stepPast(p,0);}
async function dragAccessory(p,to){const b=await p.locator('#monsterCanvas').boundingBox(),from=await p.locator('#monsterAccessory').boundingBox();await p.mouse.move(from.x+from.width/2,from.y+from.height/2);await p.mouse.down();await p.mouse.move(b.x+to.x*b.width,b.y+to.y*b.height,{steps:16});await p.mouse.up();await advance(p,100);}
async function action(p,stage){
 if((await state(p)).speech.step>stage)return true;
 if(stage===0)return scrub(p);
 if(stage===1){for(const t of (await state(p)).monster.mud){if((await state(p)).monster.completed>stage)break;await gesture(p,[t],{hold:1250});}for(let pass=0;pass<4;pass++){const s=await state(p);if(s.speech.step>stage||s.monster.completed>stage)break;for(const t of s.monster.foam.filter(t=>!t.clear)){if((await state(p)).monster.completed>stage)break;await gesture(p,[t],{hold:1250});}}}
 else if(stage===2||stage===3){const list=stage===2?'comb':'snips';for(const t of (await state(p)).monster[list].filter(t=>!t.done))await gesture(p,[t.from,t.to]);}
 else if(stage===4){await p.locator('#monsterColor1').click();for(const t of (await state(p)).monster.spots.filter(t=>!t.done))await gesture(p,[t]);}
 else await dragAccessory(p,(await state(p)).monster.accessoryTarget);
 return stepPast(p,stage);
}
const inside=(r,v)=>r.w>0&&r.h>0&&r.x>=-0.5&&r.y>=-0.5&&r.right<=v.width+0.5&&r.bottom<=v.height+0.5;
const meet=(a,b)=>a.x<b.right&&b.x<a.right&&a.y<b.bottom&&b.y<a.bottom;
const rects=(p,ids)=>p.evaluate(ids=>ids.map(id=>{const e=document.getElementById(id),r=e?e.getBoundingClientRect():{x:0,y:0,right:0,bottom:0,width:0,height:0};return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,shown:!!e&&!e.hidden&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none'};}),ids);
// a target circle on the canvas, in page pixels
const circle=(c,t,W)=>({x:c.x+(t.x-t.r)*c.w,right:c.x+(t.x+t.r)*c.w,y:c.y+t.y*c.h-t.r*c.w,bottom:c.y+t.y*c.h+t.r*c.w});
const part=process.env.MONSTER_PART;
try{
 h=await gameHarness('monster',PORT);
 // ── (d) parked: a typed address goes home before any mic or sound ──
 if(!part||part==='parked'){
  const {page,context,errors}=await h.fresh({unpark:false});
  const home=await until(page,()=>/\/(today|activities)\.html/.test(location.pathname)&&!!document.getElementById('libraryMessage')&&/Monster Makeover is coming soon/.test(document.getElementById('libraryMessage').textContent),8000);
  ok('the parked salon goes back to Home, which says it is coming soon',home&&!page.url().includes('arcade-monster'),{url:page.url(),msg:await page.evaluate(()=>{const m=document.getElementById('libraryMessage');return m&&m.textContent;})});
  ok('…with no mic asked for and no sound played',await page.evaluate(()=>__quiet.requests===0&&__quiet.sounds.length===0&&__quiet.sfx.length===0));
  await context.addInitScript(()=>{if(location.pathname!=='/arcade-monster.html')return;try{sessionStorage.setItem('monster.seen','1');}catch(e){}addEventListener('pagehide',()=>{try{sessionStorage.setItem('monster.quiet',JSON.stringify({requests:__quiet.requests,mics:__quiet.mics.length,sounds:__quiet.sounds.length,sfx:__quiet.sfx.length,speech:__quiet.speech.length}));}catch(e){}});});
  await page.goto(BASE+'/arcade-monster.html');await until(page,()=>/\/(today|activities)\.html/.test(location.pathname),8000);
  const led=await page.evaluate(()=>({seen:sessionStorage.getItem('monster.seen'),quiet:JSON.parse(sessionStorage.getItem('monster.quiet')||'null')}));
  ok('the parked salon page itself opened no mic and made no sound before leaving',led.seen==='1'&&led.quiet&&led.quiet.requests===0&&led.quiet.mics===0&&led.quiet.sounds===0&&led.quiet.sfx===0&&led.quiet.speech===0,led);
  ok('parked bounce has no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── the whole makeover, with every help path ──
 if(!part||part==='main'){
  const {page,context,errors}=await h.fresh();const canvas=await page.locator('#monsterCanvas').count();ok('Monster Makeover has a real salon board',canvas===1);if(!canvas)throw Error('Monster Makeover is still an accessory reveal');
  const words=await page.evaluate(()=>({start:document.getElementById('startOvl').textContent,primer:document.getElementById('primer').textContent,help:document.getElementById('monsterHelp').getAttribute('aria-label')}));
  ok('the start card and the mic card say the word earns each tool',/two times to get the next salon tool/.test(words.start)&&/finger/.test(words.start)&&/two times to get each tool/.test(words.primer)&&/extra help/i.test(words.help),words);
  ok('no salon line is unkind or a grade',(await page.evaluate(()=>Monster.BANNERS)).every(t=>!UNKIND.test(t)));
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
  // (a) silence earns nothing, however long
  await advance(page,14000);let s=await state(page);ok('silence cannot clean or style the monster',!s.monster.active&&s.monster.completed===0&&s.speech.step===0&&s.speech.phase!=='play',s);
  ok('…the mic closes and waits for a tap',s.speech.phase==='nudge'&&await page.locator('#micBtn').isVisible(),s.speech);await page.locator('#micBtn').click();
  ok('two sayings earn the sponge',await sayWord(page));await advance(page,900);s=await state(page);ok('speech and idle animation never do the makeover',s.monster.completed===0&&s.monster.mud.every(t=>!t.clean&&t.work===0)&&s.monster.ladder===0,s);const broad=s.monster.toolRadius,first=s.monster.mud[0];await gesture(page,[first],{hold:1400});s=await state(page);ok('holding a still sponge does not scrub, and is not counted as rubbing',s.monster.mud.every(t=>t.work===0)&&s.speech.step===0&&s.monster.stuck===0,s);
  await gesture(page,[{x:first.x-first.r*.3,y:first.y},{x:first.x+first.r*.3,y:first.y}],{cancelOther:true});s=await state(page);const partial=s.monster.mud.map(t=>t.work);ok('a real sponge stroke removes actual mud',partial.some(w=>w>0)&&s.speech.step===0,s);await advance(page,11000);s=await state(page);ok('speech makes the cleaning tool genuinely broader',broad>s.monster.toolRadius*1.2&&s.monster.power===0,s);
  // (c) help, then 13 s of silence: the same job goes on, with no power
  const sameJob=s=>s.speech.phase==='play'&&!s.speech.paused&&!s.monster.paused&&s.monster.active&&s.monster.power===0&&s.speech.step===0&&JSON.stringify(s.monster.mud.map(t=>t.work))===JSON.stringify(partial);
  await page.locator('#monsterHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('help keeps the partially cleaned monster, with a way back',s.monster.paused&&JSON.stringify(s.monster.mud.map(t=>t.work))===JSON.stringify(partial)&&s.speech.step===0&&await page.locator('#helpBack').isVisible(),s);
  await advance(page,13000);await until(page,()=>__sayplay.phase==='play',4000);s=await state(page);
  ok('help, then 13 s of silence: the same scrub goes on, with no power',sameJob(s)&&!await page.locator('#monsterTool').isDisabled()&&!await page.locator('#helpBack').isVisible(),s);
  await page.locator('#monsterHelp').click();await until(page,()=>__sayplay.listening);await page.locator('#helpBack').click();await advance(page,100);s=await state(page);
  ok('"Back to the game" gives the same scrub back, with no power',sameJob(s)&&!await page.locator('#monsterTool').isDisabled(),s);
  // a hidden page during a help ask also ends it: the job comes back
  await page.locator('#monsterHelp').click();await until(page,()=>__sayplay.listening);await page.evaluate(()=>__quiet.background());await advance(page,350);await page.evaluate(()=>__quiet.foreground());ok('background during the help word leaves salon tools paused',(await state(page)).monster.paused&&await page.locator('#monsterTool').isDisabled());await page.locator('#resume').click();await advance(page,100);s=await state(page);
  ok('coming back from a help ask gives the same scrub back, with no power',sameJob(s),s);
  await page.locator('#monsterHelp').click();ok('the help word, said, renews the tools without cleaning for the child',await sayWord(page));s=await state(page);ok('help preserves progress and gives salon power',s.monster.power>0&&JSON.stringify(s.monster.mud.map(t=>t.work))===JSON.stringify(partial)&&s.speech.step===0,s);
  const toolX=s.monster.tool.x;await page.locator('#monsterTool').focus();await page.keyboard.down('Space');await page.keyboard.press('ArrowRight');await page.keyboard.up('Space');s=await state(page);ok('the keyboard moves the actual salon tool and releases it',s.monster.tool.x>toolX&&!s.monster.held,s);await page.screenshot({path:path.join(OUT,'sona-monster-salon.png')});
  // the last patch: the chime and sparkle, then the next word a beat later
  for(let pass=0;pass<10;pass++){s=await state(page);if(s.monster.completed>0)break;for(const t of s.monster.mud.filter(t=>!t.clean)){await gesture(page,[{x:t.x-t.r*.55,y:t.y},{x:t.x+t.r*.55,y:t.y},{x:t.x-t.r*.55,y:t.y}]);if((await state(page)).monster.completed>0)break;}}
  s=await state(page);const chimed=await page.evaluate(()=>__quiet.sfx.some(x=>x.name==='correct'));
  ok('a finished job chimes and sparkles before the step is counted',s.monster.completed===1&&s.speech.step===0&&s.monster.doneIn>0.8&&chimed,{m:s.monster.doneIn,step:s.speech.step,chimed});
  await advance(page,700);ok('…the beat holds the next word back',(await state(page)).speech.step===0);
  ok('five physical scrubs clean the monster',await stepPast(page,0),await state(page));ok('the job is reported once',(await state(page)).monster.dones===1);
  for(let stage=1;stage<8;stage++){
   ok('speech earns salon action '+(stage+1),await sayWord(page));await advance(page,700);s=await state(page);ok('the new tool waits for the child at step '+(stage+1),s.monster.completed===stage&&s.speech.step===stage&&s.monster.ladder===0,s);
   if(stage===1){const wet=s.monster.rinseCoverage;await gesture(page,[{x:.06,y:s.monster.monster.y}],{hold:1200});ok('a shower aimed away cannot rinse the monster',(await state(page)).monster.rinseCoverage===wet);}
   if(stage===2){
    const t=s.monster.comb[0];await advance(page,11000);const wide=[{x:t.from.x-s.monster.monster.w*.11,y:t.from.y},{x:t.to.x-s.monster.monster.w*.11,y:t.to.y}];await gesture(page,wide);s=await state(page);ok('an off-line brush stroke is not a brush, without help',s.monster.comb.every(t=>!t.done)&&s.monster.ladder===1,s.monster);
    const exact=s.monster.comb[1];await gesture(page,[exact.from,exact.to]);ok('the visible guide works after speech help expires',(await state(page)).monster.comb[1].done);
    await gesture(page,[t.to,t.from]);ok('brushing upward cannot count as combing downward',(await state(page)).monster.comb.filter(t=>t.done).length===1);
    await gesture(page,combDetour(s));ok('a detour avoiding the curls cannot comb one, even with the glow',(await state(page)).monster.comb.filter(t=>t.done).length===1&&(await state(page)).monster.ladder===3);
   }
   if(stage===3){const t=s.monster.snips[0];await gesture(page,[t]);ok('tapping scissors cannot trim a whole tuft, and is not a try',(await state(page)).monster.snips.every(t=>!t.done)&&(await state(page)).monster.jobMisses===0);await gesture(page,snipDetour(s));ok('a scissor path around the head cannot cut a tuft',(await state(page)).monster.snips.every(t=>!t.done));}
   if(stage===4){await gesture(page,[{x:s.monster.monster.x,y:s.monster.monster.y}]);ok('paint cannot add an extra spot off its stencil',(await state(page)).monster.spots.every(t=>!t.done));}
   if(stage===5){let b=await page.locator('#monsterAccessory').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(20,160);await page.mouse.up();await advance(page,100);s=await state(page);ok('a misplaced bow returns to its tray without spending a word',!s.monster.placements.bow&&s.speech.step===5&&await page.locator('#monsterAccessory').isEnabled(),s);b=await page.locator('#monsterAccessory').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+30,b.y-70);await page.evaluate(()=>__quiet.background());await advance(page,350);await page.mouse.up();await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();s=await state(page);ok('an interrupted accessory returns safely and keeps every earlier change',!s.monster.paused&&!s.monster.accessory&&!s.monster.dragging&&!s.monster.placements.bow&&s.monster.spots.every(t=>t.done)&&await page.locator('#monsterAccessory').isEnabled(),s);}
   ok('real finger gestures complete salon action '+(stage+1),await action(page,stage),await state(page));
   if(stage===4)ok('the chosen color stays on all four actual spots',(await state(page)).monster.spots.every(t=>t.done&&t.color===1));
  }
  await advance(page,3300);s=await state(page);ok('all eight physical actions finish the makeover',s.speech.phase==='end'&&s.speech.step===8&&s.monster.completed===8&&s.monster.won&&s.monster.dones===8&&Object.values(s.monster.placements).every(Boolean),s);const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech,liveSfx:__quiet.sfx.filter(x=>x.live).length}));ok('salon directions and chimes never play into the microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0&&audio.liveSfx===0,audio);ok('the child hears how to use the different tools',/sponge/i.test(audio.lines.join('|'))&&/scissors/i.test(audio.lines.join('|'))&&/crown/i.test(audio.lines.join('|')),audio.lines);ok('the spoken intro says the word earns the tool',audio.lines.some(l=>/two times to get the next salon tool/.test(l)));ok('nothing Echo says is unkind or a grade',audio.lines.every(l=>!UNKIND.test(l)),audio.lines);
  await page.screenshot({path:path.join(OUT,'sona-monster-finished.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-monster-styled.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='');await page.locator('#again').click();await advance(page,350);s=await state(page);ok('another makeover clears the style and needs speech again',s.speech.step===0&&s.monster.completed===0&&!s.monster.active&&s.monster.doneIn===0&&Object.values(s.monster.placements).every(x=>!x),s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── (b) a struggling child who never says the help word, on fallback art ──
 if(!part||part==='struggle'){
  const {page,context,errors}=await h.fresh({blockAssets:true});
  await context.route(u=>/\/assets\/crafted\/(game\/|hat-)/.test(u.pathname),r=>r.abort());await page.reload();
  await page.locator('#startBtn').click();
  const earn=async stage=>{const said=await sayWord(page);await advance(page,11000);const s=await state(page);return said&&s.speech.step===stage&&s.monster.power===0&&s.monster.ladder===0;};
  const helpless=()=>page.evaluate(()=>__quiet.speech.length);
  ok('struggler: the sponge, with the salon power run out',await earn(0));
  // scrub away from every patch: the ladder climbs by seconds of real rubbing
  let s=await state(page),m=s.monster.monster,b=await page.locator('#monsterCanvas').boundingBox(),at=on(m,.5,.3),lv=[],side=1;
  await page.mouse.move(b.x+at.x*b.width,b.y+at.y*b.height);await page.mouse.down();const c0=s.monster.clock;
  // times are the game's own playing seconds (its clock), not loop counts
  for(let t=0;t<260;t++){side=-side;await page.mouse.move(b.x+(at.x+side*m.w*.06)*b.width,b.y+at.y*b.height,{steps:2});await advance(page,100);s=await state(page);if(lv[s.monster.ladder]==null)lv[s.monster.ladder]={t:s.monster.clock-c0,guide:s.monster.guide,glow:!!s.monster.glow,banner:s.monster.banner,anywhere:s.monster.anywhere,mud:s.monster.mud.filter(x=>x.clean).length};if(s.monster.completed>0)break;}
  await page.mouse.up();
  ok('scrub: after about 4 s of rubbing, an easier sponge (rung 1)',lv[1]&&lv[1].t>=3.5&&lv[1].t<=5&&!lv[1].guide&&lv[1].mud===0,lv);
  ok('scrub: after about 8 s, the mud glows and an arrow shows how (rung 2)',lv[2]&&lv[2].t>=7.5&&lv[2].t<=9&&lv[2].guide&&lv[2].glow&&/glowing/.test(lv[2].banner)&&lv[2].mud===0,lv);
  ok('scrub: after about 12 s, rubbing anywhere on our friend works (rung 3)',lv[3]&&lv[3].t>=11.5&&lv[3].t<=13&&lv[3].anywhere,lv);
  ok('scrub: the struggler finishes the job by rubbing, with no help word',await stepPast(page,0)&&(await state(page)).monster.completed===1,await state(page));
  ok('struggler: the shower',await earn(1));
  s=await state(page);m=s.monster.monster;at=on(m,.5,.15);await page.mouse.move(b.x+at.x*b.width,b.y+at.y*b.height);await page.mouse.down();lv=[];const c1=(await state(page)).monster.clock;
  for(let t=0;t<120;t++){await advance(page,250);s=await state(page);if(lv[s.monster.ladder]==null)lv[s.monster.ladder]={t:s.monster.clock-c1,cov:s.monster.rinseCoverage};if(s.monster.completed>1)break;}
  await page.mouse.up();
  ok('rinse: holding the shower off the bubbles climbs the ladder by time, and rinses nothing until rung 3',lv[1]&&lv[2]&&lv[3]&&lv[1].t>=3.5&&lv[1].t<=5&&lv[2].t>=7.5&&lv[2].t<=9&&lv[2].cov===0&&lv[3].t>=11.5&&lv[3].t<=13,lv);
  ok('rinse: the struggler finishes the job by holding the shower, with no help word',await stepPast(page,1),await state(page));
  // the brush: three real misses, one rung each, then a stroke on our friend
  ok('struggler: the comb',await earn(2));
  s=await state(page);m=s.monster.monster;const t0=s.monster.comb[0],off=[{x:t0.from.x-m.w*.25,y:t0.from.y},{x:t0.to.x-m.w*.25,y:t0.to.y}],rung=[];
  for(let n=0;n<3;n++){await gesture(page,off);s=await state(page);rung.push({ladder:s.monster.ladder,done:s.monster.comb.filter(x=>x.done).length,guide:s.monster.guide,allow:s.monster.directionAllowance,banner:s.monster.banner});}
  ok('comb miss 1: the salon-power windows without the power (rung 1)',rung[0].ladder===1&&rung[0].done===0&&!rung[0].guide&&rung[0].allow>=1.4&&/So close/.test(rung[0].banner),rung);
  ok('comb miss 2: the curl glows and an arrow shows the way (rung 2)',rung[1].ladder===2&&rung[1].done===0&&rung[1].guide&&rung[1].allow>=2.5,rung);
  ok('comb miss 3: any brush down on our friend works now (rung 3)',rung[2].ladder===3&&rung[2].done===0,rung);
  for(let n=0;n<3;n++)await gesture(page,off);
  ok('comb: the struggler brushes all three curls with no help word',await stepPast(page,2),await state(page));
  ok('struggler: the scissors',await earn(3));ok('the scissors still work on the dotted lines after the power',await action(page,3),await state(page));
  // stamps: taps on the smile, far from every spot
  ok('struggler: the paint',await earn(4));s=await state(page);m=s.monster.monster;const tap=on(m,.5,.4),stamps=[];
  for(let n=0;n<3;n++){await gesture(page,[tap]);s=await state(page);stamps.push({ladder:s.monster.ladder,done:s.monster.spots.filter(x=>x.done).length,r:s.monster.spots[0].r/m.w,guide:s.monster.guide});}
  ok('stamp: misses climb the ladder one rung each, the windows widening',stamps.map(x=>x.ladder).join()==='1,2,3'&&stamps.every(x=>x.done===0)&&stamps[0].r>=0.104&&stamps[1].r>=0.19&&stamps[1].guide,stamps);
  for(let n=0;n<4;n++)await gesture(page,[tap]);ok('stamp: from rung 3 any tap on our friend stamps the next spot',await stepPast(page,4),await state(page));
  ok('struggler: the bow',await earn(5));s=await state(page);m=s.monster.monster;const far=on(m,.12,.95),drops=[];
  b=await page.locator('#monsterAccessory').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.up();await advance(page,100);
  ok('a tap on the tray that never moves the bow is not a try',(await state(page)).monster.jobMisses===0);
  for(let n=0;n<3;n++){await dragAccessory(page,far);s=await state(page);drops.push({ladder:s.monster.ladder,placed:s.monster.placements.bow,r:s.monster.accessoryTarget.r/m.w,guide:s.monster.guide});}
  ok('bow: three drops far off climb the ladder, the target widening and glowing',drops.map(x=>x.ladder).join()==='1,2,3'&&drops.every(x=>!x.placed)&&drops[0].r>=0.199&&drops[1].r>=0.29&&drops[1].guide,drops);
  await dragAccessory(page,far);ok('bow: from rung 3 a drop anywhere on our friend puts it on',await stepPast(page,5),await state(page));
  for(let stage=6;stage<8;stage++){ok('struggler: accessory '+(stage+1),await earn(stage)&&await action(page,stage),await state(page));}
  await advance(page,3300);s=await state(page);ok('the struggler, on fallback art, finishes the whole makeover with no help word',s.speech.phase==='end'&&s.monster.won&&s.monster.dones===8,s);
  const said=await page.evaluate(()=>__quiet.speech);ok('the ladder speaks its lines, and none is unkind',said.some(l=>/glowing/.test(l))&&said.every(l=>!UNKIND.test(l)),said);
  ok('fallback salon has no runtime errors',errors.length===0,errors);await page.screenshot({path:path.join(OUT,'sona-monster-fallback.png')});await context.close();
 }
 // ── (e) fit: play, a word turn and a help ask on four screens ──
 if(!part||part==='fit'){
  for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024}]){
   const tag=viewport.width+'x'+viewport.height;
   const {page,context,errors}=await h.fresh({viewport});await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
   let r=await rects(page,['turnPanel','word','hear','picBox']);
   ok(tag+': the word turn fits, with a big enough Hear it',r.every(x=>x.shown&&inside(x,viewport))&&r[2].w>=44&&r[2].h>=44,r);
   await sayWord(page);
   const fit=await page.evaluate(()=>({scroll:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth}));
   r=await rects(page,['monsterCanvas','monsterHelp','monsterHearStep','monsterToolCard','monsterBanner','monsterPower','monsterControls']);let R=Object.fromEntries(r.map(x=>[x.id,x]));
   ok(tag+': the salon fits with no scrolling',fit.scroll<=viewport.height+1&&fit.sw<=viewport.width+1&&['monsterCanvas','monsterHelp','monsterHearStep','monsterToolCard','monsterBanner'].every(id=>R[id].shown&&inside(R[id],viewport)),{fit,r});
   ok(tag+': salon controls are large touch targets',['monsterHelp','monsterHearStep'].every(id=>R[id].w>=44&&R[id].h>=44),r);
   let s=(await state(page)).monster,c=R.monsterCanvas;
   const blockers=['monsterHelp','monsterHearStep','monsterToolCard','monsterPower'].map(id=>R[id]).filter(x=>x.shown);
   ok(tag+': no card or button covers a muddy patch',s.mud.every(t=>blockers.every(x=>!meet(circle(c,t),x))),{mud:s.mud.map(t=>circle(c,t)),blockers});
   const lows=await page.evaluate(()=>{const b=document.getElementById('monsterBanner'),keep=b.textContent,one=(()=>{b.textContent='Rinse';return b.getBoundingClientRect().height;})(),out=Monster.BANNERS.map(t=>{b.textContent=t;const r=b.getBoundingClientRect();return{t,bottom:r.bottom,h:r.height};});b.textContent=keep;return{one,out};});
   const crownTop=c.y+(s.monster.y-s.monster.h/2)*c.h;
   ok(tag+': every banner line sits on one line, above our friend and the buttons',lows.out.every(l=>l.h<=lows.one+2&&l.bottom<=crownTop&&l.bottom<=R.monsterHearStep.y+1),{one:lows.one,crownTop,hear:R.monsterHearStep.y,bad:lows.out.filter(l=>l.h>lows.one+2||l.bottom>crownTop||l.bottom>R.monsterHearStep.y+1)});
   // a help ask: the word panel and "Back to the game" fit and are big enough
   await page.locator('#monsterHelp').click();await until(page,()=>__sayplay.listening);
   r=await rects(page,['turnPanel','hear','helpBack','word']);
   ok(tag+': a help ask fits, with a big enough "Back to the game"',r.every(x=>x.shown&&inside(x,viewport))&&r[2].w>=44&&r[2].h>=44&&r[1].w>=44&&r[1].h>=44,r);
   await page.locator('#helpBack').click();await advance(page,100);
   ok(tag+': "Back to the game" brings the sponge back',(await state(page)).speech.phase==='play'&&await page.locator('#monsterTool').isEnabled());
   ok(tag+': a child can scrub on this screen',await scrub(page),await state(page));
   // the paint pots and the bow tray: the smallest phone and the tablet
   if(viewport.width===320||viewport.width===768){
   for(let stage=1;stage<4;stage++){if(!await sayWord(page)||!await action(page,stage))throw Error(tag+': could not reach the paint, stage '+stage);}
   await sayWord(page);
   r=await rects(page,['monsterPalette','monsterColor0','monsterColor1','monsterColor2','monsterControls','monsterHelp','monsterCanvas']);R=Object.fromEntries(r.map(x=>[x.id,x]));s=(await state(page)).monster;c=R.monsterCanvas;
   ok(tag+': the paint pots fit, are big enough, and sit clear of the help pill',R.monsterPalette.shown&&inside(R.monsterPalette,viewport)&&[0,1,2].every(n=>R['monsterColor'+n].w>=44&&R['monsterColor'+n].h>=44)&&!meet(R.monsterPalette,R.monsterHelp),r);
   ok(tag+': the paint pots never cover a spot',s.spots.every(t=>!meet(circle(c,t),R.monsterPalette)&&!meet(circle(c,t),R.monsterHelp)),{spots:s.spots.map(t=>circle(c,t)),pal:R.monsterPalette});
   if(!await action(page,4))throw Error(tag+': could not paint');await sayWord(page);
   r=await rects(page,['monsterAccessory','monsterControls','monsterHelp','monsterCanvas','monsterHearStep']);R=Object.fromEntries(r.map(x=>[x.id,x]));s=(await state(page)).monster;c=R.monsterCanvas;
   const target=circle(c,s.accessoryTarget);
   ok(tag+': the bow tray fits, is big enough, and sits clear of the help pill',R.monsterAccessory.shown&&inside(R.monsterAccessory,viewport)&&R.monsterAccessory.w>=44&&R.monsterAccessory.h>=44&&!meet(R.monsterAccessory,R.monsterHelp),r);
   ok(tag+': the bow target is on screen and uncovered',inside({...target,w:1,h:1},viewport)&&!meet(target,R.monsterHelp)&&!meet(target,R.monsterHearStep),{target,r});
   ok(tag+': a child can put on the bow on this screen',await action(page,5),await state(page));
   }
   await page.screenshot({path:path.join(OUT,'sona-monster-'+viewport.width+'.png')});ok(tag+': fit has no runtime errors',errors.length===0,errors);await context.close();
  }
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
