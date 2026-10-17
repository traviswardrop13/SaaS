import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,garden:window.__flower}));
async function fresh(opts={}){return h.fresh({...opts,device:{age:'4',...opts.device}});}
async function pour(p,{offset=0,ms=800,cancelOther=false}={}){
 const b=await p.locator('#gardenCanvas').boundingBox();let g=(await state(p)).garden;
 await p.mouse.move(b.x+g.can.x*b.width,b.y+g.can.y*b.height);await p.mouse.down();await advance(p,50);
 if(cancelOther)await p.evaluate(()=>document.getElementById('gardenCanvas').dispatchEvent(new PointerEvent('pointercancel',{pointerId:99})));
 g=(await state(p)).garden;
 const can={x:g.can.x+g.target.x+offset-g.spout.x,y:g.can.y+g.target.y-.20-g.spout.y};
 await p.mouse.move(b.x+can.x*b.width,b.y+can.y*b.height,{steps:16});await advance(p,ms);await p.mouse.up();await advance(p,1100);
}
async function grow(p,stage){
 for(let attempt=0;attempt<5;attempt++){
  if((await state(p)).speech.step>stage)return true;
  if(await p.locator('#gardenRefill').isEnabled())await p.locator('#gardenRefill').click();await pour(p,{ms:1300,cancelOther:stage===0&&attempt===0});
 }
 return (await state(p)).speech.step>stage;
}
try{
 h=await gameHarness('flower',8350);
 {
  const {page,context}=await fresh({unpark:false});await advance(page,300);ok('the parked garden opens no microphone',!page.url().includes('arcade-flower')&&await page.evaluate(()=>__quiet.requests===0));await context.close();
 }
 {
  const {page,context,errors}=await fresh();const canvas=await page.locator('#gardenCanvas').count();ok('the flower has a real watering garden',canvas===1);if(!canvas)throw new Error('Grow a Flower is still an animation scene');
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);await advance(page,1400);let s=await state(page);ok('silence cannot water or grow a flower',!s.garden.active&&s.garden.waterProgress===0&&s.garden.grown===0&&s.speech.step===0,s);
  ok('two accepted sayings earn watering and shower help',await sayWord(page));s=await state(page);const helpedRadius=s.garden.catchRadius;
  await advance(page,2000);s=await state(page);ok('words and an idle can do not create water or growth',s.garden.waterProgress===0&&s.garden.grown===0&&!s.garden.pouring&&s.speech.step===0,s);
  await advance(page,11000);s=await state(page);const ordinaryRadius=s.garden.catchRadius;ok('speech really widens the watering catch area',helpedRadius>=ordinaryRadius*1.8&&ordinaryRadius>0,{helpedRadius,ordinaryRadius});
  const nearMiss=-ordinaryRadius*1.6;await pour(page,{offset:nearMiss,ms:900});s=await state(page);ok('water outside the ordinary target does not count',s.garden.waterProgress===0&&s.speech.step===0,s);
  const held={water:s.garden.waterProgress,reservoir:s.garden.reservoir,can:{...s.garden.can}};await page.locator('#gardenHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('help holds the same garden without moving the can',s.garden.paused&&s.garden.waterProgress===held.water&&s.garden.can.x===held.can.x&&s.garden.can.y===held.can.y&&s.speech.step===0,s);
  await page.evaluate(()=>__quiet.background());await advance(page,400);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await until(page,()=>__sayplay.listening);await advance(page,500);s=await state(page);ok('background/resume during the word keeps every drop and control paused',s.garden.paused&&s.garden.waterProgress===held.water&&!s.garden.pouring,s);
  ok('the repeated word renews the same shower',await sayWord(page));s=await state(page);ok('help preserves caught water, reservoir and can position',s.garden.waterProgress===held.water&&s.garden.reservoir===held.reservoir&&s.garden.can.x===held.can.x&&s.garden.can.y===held.can.y&&s.garden.power>0&&s.speech.step===0,s);
  await page.locator('#gardenRefill').click();await pour(page,{offset:nearMiss,ms:220});s=await state(page);ok('the same near-miss actually catches water with speech help',s.garden.waterProgress>0&&s.speech.step===0,s);
  const saved=s.garden.waterProgress;await page.locator('#gardenRefill').click();s=await state(page);ok('refilling the can never resets earned water',s.garden.waterProgress===saved&&s.garden.reservoir>0&&s.speech.step===0,s);
  await page.locator('#gardenCan').focus();const before={...s.garden.can};await page.keyboard.press('ArrowLeft');s=await state(page);ok('keyboard movement controls the actual can',s.garden.can.x<before.x,s);
  await page.screenshot({path:path.join(OUT,'sona-flower-watering.png')});
  for(let stage=0;stage<5;stage++){
   if(stage&&!await sayWord(page))throw new Error('Could not earn watering stage '+stage);
   ok('real caught drops grow stage '+(stage+1),await grow(page,stage),await state(page));
  }
  await advance(page,3300);s=await state(page);ok('five real waterings grow a complete flower and finish',s.speech.phase==='end'&&s.speech.step===5&&s.garden.grown===5&&s.garden.won,s);
  const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));ok('garden sounds and instructions stay out of the microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);ok('the child hears how to aim and pour',audio.lines.some(t=>/pour|water/i.test(t)&&/drag|pull|move/i.test(t)),audio.lines);
  await page.screenshot({path:path.join(OUT,'sona-flower-finished.png')});await page.locator('#again').click();await advance(page,400);s=await state(page);ok('a new garden needs speech and real water again',s.speech.step===0&&s.garden.grown===0&&s.garden.waterProgress===0&&!s.garden.active,s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 {
  const {page,context,errors}=await fresh({blockAssets:true});await page.locator('#startBtn').click();await sayWord(page);ok('missing painted art cannot block real watering',await grow(page,0));ok('fallback garden has no runtime errors',errors.length===0,errors);await context.close();
 }
 for(const viewport of [{width:320,height:568},{width:393,height:852},{width:768,height:1024}]){
  const {page,context,errors}=await fresh({viewport});await page.locator('#startBtn').click();await sayWord(page);const fit=await page.evaluate(()=>{const ids=['gardenCanvas','gardenRefill','gardenHelp'],rects=ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};});return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,rects};});ok('garden fits '+viewport.width+'x'+viewport.height,fit.scroll<=fit.height+1&&fit.rects.every(r=>r.x>=0&&r.y>=0&&r.right<=fit.width&&r.bottom<=fit.height),fit);ok('garden controls remain large touch targets',fit.rects.filter(r=>r.id!=='gardenCanvas').every(r=>r.w>=44&&r.h>=44),fit);ok('a child can really water on this screen',await grow(page,0),await state(page));await page.screenshot({path:path.join(OUT,'sona-flower-'+viewport.width+'.png')});ok('fit has no runtime errors',errors.length===0,errors);await context.close();
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
