// Grow a Flower (ages 3-4): the word fills the can, the finger waters the
// glow. Every check waits on published state under Playwright's fake clock,
// so the suite is deterministic on a busy machine.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,garden:window.__flower}));
// The fake clock is paused: the game's frames run only inside advance(), so
// how much water a pour makes never depends on how busy the machine is.
async function fresh(opts={}){const r=await h.fresh({...opts,device:{age:'4',...opts.device}});await r.page.clock.pauseAt(await r.page.evaluate(()=>Date.now()+1000));return r;}
// Pick the can up where it is, carry it so its OWN centre is at (x, high
// over the soil), hold it there for ms, let go and let the drops land.
async function hold(p,{dx=0,ms=800,settle=600,cancelOther=false}={}){
 const b=await p.locator('#gardenCanvas').boundingBox();let g=(await state(p)).garden;
 await p.mouse.move(b.x+g.can.x*b.width,b.y+g.can.y*b.height);await p.mouse.down();await advance(p,50);
 if(cancelOther)await p.evaluate(()=>document.getElementById('gardenCanvas').dispatchEvent(new PointerEvent('pointercancel',{pointerId:99})));
 g=(await state(p)).garden;
 const to={x:g.target.x+dx,y:g.target.y-g.can.height*0.9};
 await p.mouse.move(b.x+to.x*b.width,b.y+to.y*b.height,{steps:12});await advance(p,ms);await p.mouse.up();await advance(p,settle);
}
// Hold the can over the glow until this step's flower grows (no speech).
async function grow(p,stage,{cancelOther=false}={}){
 for(let attempt=0;attempt<6;attempt++){
  if((await state(p)).speech.step>stage)return true;
  if(await p.locator('#gardenRefill').isEnabled())await p.locator('#gardenRefill').click();
  await hold(p,{ms:2600,cancelOther:cancelOther&&attempt===0});
  await until(p,s=>__sayplay.step>s||(!__flower.celebrating&&__flower.drops===0),3000,stage);
 }
 return (await state(p)).speech.step>stage;
}
const powerOff=p=>until(p,()=>__flower.power===0,13000);
const farRight=g=>Math.min(0.985-g.can.width*0.5,g.target.x+0.34)-g.target.x;
try{
 h=await gameHarness('flower',8350);
 // ── (d) parked: a typed address goes home before any mic or sound ──
 {
  const {page,context,errors}=await fresh({unpark:false});
  const home=await until(page,()=>/\/(today|activities)\.html/.test(location.pathname)&&!!document.getElementById('libraryMessage')&&/Grow a Flower is coming soon/.test(document.getElementById('libraryMessage').textContent),8000);
  ok('the parked garden goes back to Home, which says it is coming soon',home&&!page.url().includes('arcade-flower'),{url:page.url(),msg:await page.evaluate(()=>{const m=document.getElementById('libraryMessage');return m&&m.textContent;})});
  ok('…with no mic asked for and no sound played',await page.evaluate(()=>__quiet.requests===0&&__quiet.soundsBefore===0&&__quiet.sounds.length===0&&__quiet.sfx.length===0),await page.evaluate(()=>({r:__quiet.requests,b:__quiet.soundsBefore,s:__quiet.sounds.length})));
  ok('parked bounce has no runtime errors',errors.length===0,errors);await context.close();
 }
 {
  const {page,context,errors}=await fresh();const canvas=await page.locator('#gardenCanvas').count();ok('the flower has a real watering garden',canvas===1);if(!canvas)throw new Error('Grow a Flower is still an animation scene');
  const start=await page.evaluate(()=>document.getElementById('startOvl').textContent+' '+document.getElementById('primer').textContent);ok('the start card and primer say the word fills the can, and help is extra',/two times to fill your can/.test(start)&&/Stuck\? Tap Echo/.test(start)&&!/spout/i.test(start),start);
  // ── (a) silence earns nothing ──
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);await advance(page,1400);let s=await state(page);ok('silence cannot water or grow a flower',!s.garden.active&&s.garden.waterProgress===0&&s.garden.grown===0&&s.speech.step===0,s);
  await until(page,()=>__sayplay.phase==='nudge',16000);s=await state(page);ok('a whole quiet listening window earns nothing: no can, no step',s.speech.phase==='nudge'&&!s.garden.active&&s.garden.reservoir===0&&s.speech.step===0&&!await page.locator('#gardenCan').isVisible(),s);
  await page.locator('#micBtn').click();
  ok('two accepted sayings fill the can and give the shower help',await sayWord(page));s=await state(page);const helpedRadius=s.garden.catchRadius;ok('the word fills the can without watering anything',s.garden.active&&s.garden.reservoir>0&&s.garden.waterProgress===0&&s.garden.power>0,s);
  await advance(page,2000);s=await state(page);ok('an idle can makes no water, no growth and no misses',s.garden.waterProgress===0&&s.garden.grown===0&&!s.garden.pouring&&s.garden.stepMisses===0&&s.speech.step===0,s);
  await powerOff(page);s=await state(page);const ordinaryRadius=s.garden.catchRadius;ok('speech really widens the watering catch area',helpedRadius>=ordinaryRadius*1.8&&ordinaryRadius>0&&s.garden.level===0,{helpedRadius,ordinaryRadius});
  // a short pour well beside the glow catches nothing at the first level
  await hold(page,{dx:farRight(s.garden),ms:250});s=await state(page);ok('water poured well beside the glow does not count',s.garden.waterProgress===0&&s.garden.stepMisses>0&&s.garden.level===0&&s.speech.step===0,s);
  // ── (b) a struggling child who keeps pouring beside the glow ──
  const mics0=await page.evaluate(()=>__quiet.mics.length),chimes0=await page.evaluate(()=>__quiet.sfx.filter(x=>x.name==='correct').length),levels=[];let pours=0;
  while(pours<8&&(await state(page)).speech.step===0){
   s=await state(page);if(s.garden.celebrating)break;
   if(s.garden.needsRefill&&await page.locator('#gardenRefill').isEnabled()&&s.garden.level<2)await page.locator('#gardenRefill').click();
   await hold(page,{dx:farRight(s.garden),ms:500,settle:0});await until(page,()=>__flower.celebrating||__flower.drops===0,1500);pours++;s=await state(page);levels.push(s.garden.level);
   if(pours===1)ok('after a pour beside the glow the glow and an arrow come, and the catch widens',s.garden.level===1&&s.garden.catchRadius>=ordinaryRadius*1.7,s);
  }
  s=await state(page);ok('a few pours beside the glow reach "almost anything works"',levels.includes(2)&&levels.indexOf(2)<=2,{levels,g:s.garden});
  const beat=await until(page,()=>__flower.celebrating||__sayplay.step>0,4000);s=await state(page);
  ok('the struggling child grows the flower with no speech, within a few pours',beat&&s.garden.grown===1&&pours<=6&&await page.evaluate(m=>__quiet.mics.length===m&&!__sayplay.listening,mics0),{pours,levels,g:s.garden});
  // ── the celebration beat: the step counts about a second after the growth ──
  if(s.garden.celebrating){
   await until(page,c=>__quiet.sfx.filter(x=>x.name==='correct').length>c,1000,chimes0);
   ok('the growth plays its chime before the step counts',s.speech.step===0&&s.speech.phase==='play'&&s.garden.doneIn>0&&s.garden.doneIn<=1.15&&await page.evaluate(c=>__quiet.sfx.filter(x=>x.name==='correct').length>c,chimes0),s);
   const left=s.garden.doneIn;await advance(page,Math.max(0,Math.round(left*1000)-150));const mid=await state(page);await advance(page,400);const after=await state(page);
   ok('the step counts when the beat ends, once',mid.speech.step===0&&mid.garden.celebrating&&after.speech.step===1&&!after.garden.celebrating,{left,mid:mid.speech,after:after.speech});
  }else ok('the growth has a celebration beat',false,s);
  ok('the ladder starts again on the next word',await sayWord(page)&&(await state(page)).garden.level===0&&(await state(page)).garden.stepMisses===0);
  // ── the reviewer's gesture: the can's own body over the glow, no power ──
  await powerOff(page);s=await state(page);const reservoir0=s.garden.reservoir;
  await hold(page,{ms:3000,settle:0});s=await state(page);ok('holding the can itself over the glow waters it with no help (390x844)',(s.garden.celebrating||s.speech.step===2)&&s.garden.stepMisses===0&&s.garden.level===0,{reservoir0,g:s.garden});
  await until(page,()=>__sayplay.step===2,3000);
  // ── (c) help, then silence: the same move goes on with no power ──
  ok('word three',await sayWord(page));await powerOff(page);
  await hold(page,{ms:350});s=await state(page);const held={water:s.garden.waterProgress,reservoir:s.garden.reservoir,can:{...s.garden.can}};ok('a short pour over the glow catches some water',held.water>0&&held.water<1&&s.speech.step===2,s);
  await page.locator('#gardenHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('help holds the same garden without moving the can, with a way back',s.garden.paused&&s.garden.waterProgress===held.water&&s.garden.can.x===held.can.x&&s.speech.step===2&&await page.locator('#helpBack').isVisible(),s);
  await advance(page,13500);await until(page,()=>__sayplay.phase==='play');s=await state(page);
  ok('13 s of silence in a help ask: the same move goes on, no power',s.speech.phase==='play'&&!s.garden.paused&&s.garden.active&&s.garden.power===0&&s.speech.step===2&&s.garden.waterProgress===held.water&&s.garden.reservoir===held.reservoir&&s.garden.can.x===held.can.x&&s.garden.can.y===held.can.y,s);
  await page.locator('#gardenHelp').click();await until(page,()=>__sayplay.listening);await page.locator('#helpBack').click();await until(page,()=>__sayplay.phase==='play');s=await state(page);
  ok('"Back to the game" returns to the same move, no power',s.speech.phase==='play'&&!s.garden.paused&&s.garden.power===0&&s.speech.step===2&&s.garden.waterProgress===held.water&&s.garden.can.x===held.can.x,s);
  await page.locator('#gardenHelp').click();await until(page,()=>__sayplay.listening);await page.evaluate(()=>__quiet.background());await advance(page,400);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await until(page,()=>__sayplay.phase==='play');s=await state(page);
  ok('a help ask hidden and resumed returns to the same move, no power',s.speech.phase==='play'&&!s.garden.paused&&s.garden.power===0&&s.speech.step===2&&s.garden.waterProgress===held.water,s);
  await page.locator('#gardenHelp').click();ok('the help word renews the shower',await sayWord(page));s=await state(page);ok('help preserves caught water, reservoir and can position',s.garden.waterProgress===held.water&&s.garden.reservoir===held.reservoir&&s.garden.can.x===held.can.x&&s.garden.can.y===held.can.y&&s.garden.power>0&&s.speech.step===2,s);
  await page.locator('#gardenCan').focus();const before={...s.garden.can};await page.keyboard.press('ArrowLeft');s=await state(page);ok('keyboard movement controls the actual can',s.garden.can.x<before.x,s);
  await page.screenshot({path:path.join(OUT,'sona-flower-watering.png')});
  ok('real caught drops grow stage 3',await grow(page,2),await state(page));
  // ── an empty can: the water drop glows and Echo says what to tap ──
  ok('word four',await sayWord(page));s=await state(page);
  await hold(page,{dx:farRight(s.garden),ms:1100,settle:500});s=await state(page);const lv=s.garden.level;
  let empty=false;for(let i=0;i<4&&!empty;i++){await hold(page,{ms:900,settle:500});s=await state(page);empty=s.garden.needsRefill;if(s.speech.step>3)break;}
  if(empty){
   ok('an empty can lights the water drop and Echo says to tap it',lv===1&&s.garden.waterProgress<1&&await page.locator('#gardenRefill.needs-refill').count()===1&&await page.evaluate(()=>__quiet.speech.includes('Tap the water drop to fill your can.')),s);
   const water=s.garden.waterProgress;await page.locator('#gardenRefill').click();s=await state(page);ok('refilling the can never resets earned water',s.garden.waterProgress===water&&s.garden.reservoir>0&&!s.garden.needsRefill&&s.speech.step===3,s);
  }else ok('the can can run dry',false,s);
  ok('real caught drops grow stage 4',await grow(page,3),await state(page));
  ok('word five',await sayWord(page));ok('real caught drops grow stage 5',await grow(page,4),await state(page));
  await until(page,()=>__sayplay.phase==='end',6000);s=await state(page);ok('five real waterings grow a complete flower and finish',s.speech.phase==='end'&&s.speech.step===5&&s.garden.grown===5&&s.garden.won&&!s.garden.celebrating,s);
  const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));ok('garden sounds and directions stay out of the microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);
  ok('Echo says how to water, out loud',['Hold the can over the glowing soil.','Move the can over the glow.','Pour anywhere. The water will find the flower!'].every(t=>audio.lines.includes(t))&&audio.lines.some(t=>/two times to fill your watering can/.test(t)),audio.lines);
  ok('no line says missed, wrong, score or spout',!audio.lines.some(t=>/miss|wrong|fail|score|point|correct|spout/i.test(t)),audio.lines);
  await page.screenshot({path:path.join(OUT,'sona-flower-finished.png')});await page.locator('#again').click();await advance(page,400);s=await state(page);ok('a new garden needs speech and real water again',s.speech.step===0&&s.garden.grown===0&&s.garden.waterProgress===0&&!s.garden.active&&s.garden.level===0,s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 {
  const {page,context,errors}=await fresh({blockAssets:true});await page.locator('#startBtn').click();await sayWord(page);ok('missing painted art cannot block real watering',await grow(page,0,{cancelOther:true}));ok('fallback garden has no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── (e) fit: in play, in a word turn and in a help ask ──
 const rects=(page,ids)=>page.evaluate(ids=>{const out=[];for(const id of ids){const e=document.getElementById(id);if(!e)continue;const r=e.getBoundingClientRect();out.push({id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,vis:getComputedStyle(e).visibility!=='hidden'&&!e.hidden&&r.width>0});}return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,rects:out};},ids);
 const inside=f=>f.scroll<=f.height+1&&f.rects.every(r=>r.x>=-0.5&&r.y>=-0.5&&r.right<=f.width+0.5&&r.bottom<=f.height+0.5);
 const overlap=(a,b)=>a.x<b.right&&b.x<a.right&&a.y<b.bottom&&b.y<a.bottom;
 for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024}]){
  const tag=viewport.width+'x'+viewport.height;
  const {page,context,errors}=await fresh({viewport});await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
  let f=await rects(page,['turnPanel','word','hear','echoWrap']);ok('the word turn fits '+tag,inside(f)&&f.rects.find(r=>r.id==='hear').h>=44,f);
  await sayWord(page);
  f=await rects(page,['gardenBanner','gardenCan','gardenWater','gardenRefill','gardenHelp','close']);const can=f.rects.find(r=>r.id==='gardenCan'),ctl=f.rects.filter(r=>r.id==='gardenRefill'||r.id==='gardenHelp'),water=f.rects.find(r=>r.id==='gardenWater'),banner=f.rects.find(r=>r.id==='gardenBanner');
  ok('the garden fits in play '+tag,inside(f)&&!overlap(ctl[0],ctl[1])&&ctl.every(r=>!overlap(r,water))&&!overlap(banner,water),f);
  ok('garden controls remain large touch targets '+tag,f.rects.filter(r=>/Refill|Help|Can|close/.test(r.id)).every(r=>r.w>=44&&r.h>=44),f);
  const soil=await page.evaluate(()=>{const c=document.getElementById('gardenCanvas').getBoundingClientRect(),g=__flower;return{soil:c.y+g.target.y*c.height,water:document.getElementById('gardenWater').getBoundingClientRect().top,banner:document.getElementById('gardenBanner').getBoundingClientRect().bottom};});
  ok('the glowing soil shows between the banner and the water bar '+tag,soil.soil>soil.banner&&soil.soil<soil.water,soil);
  await powerOff(page);ok('holding the can itself over the glow waters it at '+tag+' (no help)',await grow(page,0),await state(page));
  await until(page,()=>__sayplay.listening);await sayWord(page);
  await page.locator('#gardenHelp').click();await until(page,()=>__sayplay.listening);
  f=await rects(page,['turnPanel','helpBack','hear','word']);const back=f.rects.find(r=>r.id==='helpBack');ok('a help ask and "Back to the game" fit '+tag,inside(f)&&back&&back.vis&&back.h>=44&&back.w>=44,f);
  await page.screenshot({path:path.join(OUT,'sona-flower-'+viewport.width+'.png')});ok('fit has no runtime errors '+tag,errors.length===0,errors);await context.close();
 }
 {
  const {page,context}=await fresh({viewport:{width:568,height:320}});await advance(page,200);
  ok('the existing phone portrait guard remains in place',await page.locator('#sonaPortraitGuard').isVisible());
  await page.locator('#sonaPortraitGuard').evaluate(e=>e.remove());await page.locator('#startBtn').click();await sayWord(page);
  const bounds=await page.evaluate(()=>{const c=document.getElementById('gardenCanvas').getBoundingClientRect(),water=document.getElementById('gardenWater').getBoundingClientRect(),g=__flower;return{soil:c.y+g.target.y*c.height,radius:g.catchRadius*c.width*.42,card:water.top};});
  ok('short landscape keeps soil above the progress card',bounds.soil+bounds.radius+4<bounds.card,bounds);
  ok('water can still reach the visible soil on short landscape',await grow(page,0),await state(page));await context.close();
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
