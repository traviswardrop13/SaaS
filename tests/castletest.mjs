import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
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
async function place(p,stage){
 for(let n=0;n<3;n++){
  const s=(await state(p)).castle;await slide(p,s.slot.x,{cancelOther:stage===0&&n===0});await holdLower(p,6000);
  if((await state(p)).speech.step>stage)return true;
  await advance(p,1800);
 }
 return false;
}
async function peakSwing(p){let peak=0;for(let n=0;n<28;n++){await advance(p,100);peak=Math.max(peak,Math.abs((await state(p)).castle.swing));}return peak;}
try{
 h=await gameHarness('castle',8351);
 {
  const {page,context}=await h.fresh({unpark:false});await advance(page,300);ok('the parked castle opens no microphone',!page.url().includes('arcade-castle')&&await page.evaluate(()=>__quiet.requests===0));await context.close();
 }
 {
  const {page,context,errors}=await h.fresh();const canvas=await page.locator('#castleCanvas').count();ok('Castle Builder has a real crane board',canvas===1);if(!canvas)throw Error('Castle Builder is still an animation scene');
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);await page.locator('#castleLower').evaluate(e=>e.click());await advance(page,1800);let s=await state(page);ok('silence and a Lower tap cannot build a castle',!s.castle.active&&s.castle.placed===0&&s.speech.step===0,s);
  ok('two accepted sayings earn the first crane piece',await sayWord(page));s=await state(page);const wide=s.castle.tolerance;ok('speech steadies the crane without placing a piece',s.castle.power>0&&s.castle.placed===0&&s.speech.step===0,s);
  const assistedSwing=await peakSwing(page);await advance(page,11000);s=await state(page);const narrow=s.castle.tolerance,ordinarySwing=await peakSwing(page);ok('speech makes the placement window more forgiving',wide>narrow*1.4&&narrow>0,{wide,narrow});ok('speech actually reduces the hanging load swing',assistedSwing<ordinarySwing*.75&&ordinarySwing>0,{assistedSwing,ordinarySwing});
  ok('an idle crane never places a piece',s.castle.placed===0&&s.speech.step===0,s);await slide(page,.1);const slid=(await state(page)).castle;ok('dragging moves the actual trolley',slid.craneX<.2,slid);
  await holdLower(page,7000);await advance(page,2000);s=await state(page);ok('a miss keeps the same piece and costs no new word',s.castle.placed===0&&s.speech.step===0&&s.castle.active,s);
  await slide(page,.5);await holdLower(page,240);s=await state(page);const parkedRope=s.castle.rope;await advance(page,600);s=await state(page);ok('releasing Lower really parks the rope',!s.castle.lowering&&Math.abs(s.castle.rope-parkedRope)<.001,s);
  const held={rope:s.castle.rope,x:s.castle.craneX,swing:s.castle.swing};await page.locator('#castleHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('help parks the same unfinished castle and rope',s.castle.paused&&s.castle.rope===held.rope&&s.castle.craneX===held.x&&s.castle.placed===0&&s.speech.step===0,s);
  await page.evaluate(()=>__quiet.background());await advance(page,400);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('background/resume during help cannot move the crane',s.castle.paused&&s.castle.rope===held.rope&&await page.locator('#castleLower').isDisabled(),s);
  ok('the repeated word renews the same steady rope',await sayWord(page));s=await state(page);ok('help preserves trolley, rope and current piece',s.castle.power>0&&!s.castle.paused&&s.castle.rope===held.rope&&s.castle.craneX===held.x&&s.castle.placed===0&&s.speech.step===0,s);
  await page.locator('#castleTrolley').focus();const keyStart=s.castle.craneX;await page.keyboard.press('ArrowLeft');s=await state(page);ok('keyboard arrows control the actual crane',s.castle.craneX<keyStart,s);
  await page.screenshot({path:path.join(OUT,'sona-castle-crane.png')});const slots=[];
  for(let stage=0;stage<8;stage++){
   if(stage&&!await sayWord(page))throw Error('Could not earn castle stage '+stage);
   s=await state(page);slots.push([s.castle.slot.x,s.castle.slot.y].join(','));ok('the crane physically places castle piece '+(stage+1),await place(page,stage),await state(page));
  }
  await advance(page,3300);s=await state(page);ok('eight real placements build the castle and finish',s.speech.phase==='end'&&s.speech.step===8&&s.castle.placed===8&&s.castle.won,s);ok('the architecture uses eight separate slots',new Set(slots).size===8,slots);
  const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));ok('castle sounds and instructions stay out of the microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);ok('the child hears how to steer and lower the crane',audio.lines.some(t=>/crane|rope/i.test(t)&&/lower/i.test(t)),audio.lines);
  await page.screenshot({path:path.join(OUT,'sona-castle-finished.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-castle-built.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='');await page.locator('#again').click();await advance(page,400);s=await state(page);ok('a new castle starts empty and requires speech again',s.speech.step===0&&s.castle.placed===0&&!s.castle.active,s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 {
  const {page,context,errors}=await h.fresh({blockAssets:true});await page.locator('#startBtn').click();await sayWord(page);ok('missing painted pieces cannot block crane placement',await place(page,0));ok('fallback castle has no runtime errors',errors.length===0,errors);await context.close();
 }
 for(const viewport of [{width:320,height:568},{width:393,height:852},{width:768,height:1024}]){
  const {page,context,errors}=await h.fresh({viewport});await page.locator('#startBtn').click();await sayWord(page);const fit=await page.evaluate(()=>{const rects=['castleCanvas','castleTrolley','castleLower','castleHoist','castleHelp'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};});return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,rects};});ok('castle fits '+viewport.width+'x'+viewport.height,fit.scroll<=fit.height+1&&fit.rects.every(r=>r.x>=0&&r.y>=0&&r.right<=fit.width&&r.bottom<=fit.height),fit);ok('all crane controls remain large touch targets',fit.rects.filter(r=>r.id!=='castleCanvas').every(r=>r.w>=44&&r.h>=44),fit);ok('a child can place a piece on this screen',await place(page,0),await state(page));await page.screenshot({path:path.join(OUT,'sona-castle-'+viewport.width+'.png')});ok('fit has no runtime errors',errors.length===0,errors);await context.close();
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
