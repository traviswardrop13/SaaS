import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,space:window.__space}));
const held=new Map();
async function keys(p,wanted=[]){const have=held.get(p)||new Set();for(const key of [...have])if(!wanted.includes(key)){await p.keyboard.up(key);have.delete(key);}for(const key of wanted)if(!have.has(key)){await p.keyboard.down(key);have.add(key);}held.set(p,have);}
async function land(p,stage){
 await keys(p);let retries=(await state(p)).space.retries;
 for(let n=0;n<500;n++){
  const s=await state(p),g=s.space;if(s.speech.step>stage){await keys(p);return true;}
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
try{
 h=await gameHarness('space',8353);
 if(part!=='landscape'){
 {
  const {page,context}=await h.fresh({unpark:false});await advance(page,300);ok('the parked spaceport opens no microphone',!page.url().includes('arcade-space')&&await page.evaluate(()=>__quiet.requests===0));await context.close();
 }
 {
  const {page,context}=await h.fresh();await page.locator('#startBtn').click();await sayWord(page);const b=await page.locator('#spaceThrust').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await advance(page,160);await page.evaluate(()=>__quiet.background());let s=await state(page);const parked={...s.space.ship};await advance(page,900);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();s=await state(page);ok('an interrupted held engine releases its pointer and preserves the flight',s.space.active&&!s.space.paused&&!s.space.thrust&&s.space.owners.thrust===null&&s.space.ship.x===parked.x&&s.space.ship.y===parked.y&&s.space.ship.vx===parked.vx&&s.space.ship.vy===parked.vy,s);await page.mouse.up();await context.close();
 }
 {
  const {page,context,errors}=await h.fresh();const canvas=await page.locator('#spaceCanvas').count();ok('Space Trip has a real piloting board',canvas===1);if(!canvas)throw Error('Space Trip is still a rocket animation');await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);await advance(page,1600);let s=await state(page);ok('silence cannot launch or land a rocket',!s.space.active&&s.space.landed===0&&s.speech.step===0,s);
  ok('two accepted sayings earn the first flight',await sayWord(page));s=await state(page);const origin={...s.space.ship},gentle=s.space.gravity,forgiving=s.space.safeVy;await advance(page,1800);s=await state(page);ok('the word and idle animation never pilot or land for the child',!s.space.piloted&&s.space.ship.x===origin.x&&s.space.ship.y===origin.y&&s.space.landed===0&&s.speech.step===0,s);
  const flown=await thrustPointer(page,700,{drag:45,cancelOther:true});ok('one held thumb really thrusts and steers',flown.space.thrust&&flown.space.piloted&&flown.space.ship.vx>0&&flown.space.ship.x>origin.x&&flown.space.ship.y<origin.y,flown);s=await state(page);ok('releasing that thumb cuts the engines and steering',!s.space.thrust&&s.space.steering===0,s);
  await thrustPointer(page,11000);s=await state(page);ok('speech genuinely eases gravity and landing speed',s.space.power===0&&gentle<s.space.gravity*.7&&forgiving>s.space.safeVy*1.3,{gentle,ordinary:s.space.gravity,forgiving,ordinarySpeed:s.space.safeVy});
  await keys(page,['ArrowLeft']);await advance(page,1200);await keys(page);await advance(page,11000);s=await state(page);ok('a missed or hard touchdown retries the same accepted word',s.space.retries>0&&s.space.active&&s.space.landed===0&&s.speech.step===0,s);
  await keys(page,['ArrowRight','Space']);await advance(page,180);await keys(page);s=await state(page);const saved={...s.space.ship};await page.locator('#spaceHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('speech help parks the same flight without teleporting it',s.space.paused&&near(s.space.ship.x,saved.x,.003)&&near(s.space.ship.y,saved.y,.003)&&s.speech.step===0,s);
  const parked={...s.space.ship};await page.evaluate(()=>__quiet.background());await advance(page,350);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('background/resume during help cannot restart flight controls',s.space.paused&&s.space.ship.x===parked.x&&s.space.ship.y===parked.y&&!s.space.thrust&&await page.locator('#spaceThrust').isDisabled(),s);ok('the repeated word renews the same soft landing help',await sayWord(page));s=await state(page);ok('help preserves the flight position and momentum',s.space.power>0&&near(s.space.ship.x,parked.x)&&near(s.space.ship.y,parked.y)&&near(s.space.ship.vx,parked.vx,.04)&&near(s.space.ship.vy,parked.vy,.04)&&s.speech.step===0,s);
  await page.screenshot({path:path.join(OUT,'sona-space-flight.png')});const sites=[];
  for(let stage=0;stage<8;stage++){
   if(stage&&!await sayWord(page))throw Error('Could not earn flight '+stage);s=await state(page);sites.push([s.space.pad.x,s.space.pad.w,s.space.gravity].join(','));const landed=await land(page,stage);s=await state(page);ok('real thrust and steering land at site '+(stage+1),landed,s);if(!landed)throw Error('Could not physically land at site '+stage);
   ok('the rocket really touches this pad',Math.abs(s.space.ship.y+s.space.ship.h/2-s.space.pad.y)<.012&&Math.abs(s.space.ship.x-s.space.pad.x)<s.space.pad.w/2,s.space);
  }
  await advance(page,3300);s=await state(page);ok('eight physical landings finish the space trip',s.speech.phase==='end'&&s.speech.step===8&&s.space.landed===8&&s.space.won,s);ok('the landing sites offer different planned challenges',new Set(sites).size>=6,sites);const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length}));
  ok('space instructions and sounds stay out of the microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);await page.screenshot({path:path.join(OUT,'sona-space-finished.png')});await page.locator('#again').click();await advance(page,350);s=await state(page);ok('another trip needs speech and real piloting again',s.speech.step===0&&s.space.landed===0&&!s.space.active&&!s.space.piloted,s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 {
  const {page,context,errors}=await h.fresh({blockAssets:true});await page.locator('#startBtn').click();await sayWord(page);ok('missing painted assets cannot block a real landing',await land(page,0));ok('fallback spaceport has no runtime errors',errors.length===0,errors);await context.close();
 }
 for(const viewport of [{width:320,height:568},{width:393,height:852},{width:768,height:1024}]){
  const {page,context,errors}=await h.fresh({viewport});await page.locator('#startBtn').click();await sayWord(page);const fit=await page.evaluate(()=>{const rects=['spaceCanvas','spaceLeft','spaceThrust','spaceRight','spaceHelp'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};});return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,rects};});ok('spaceport fits '+viewport.width+'x'+viewport.height,fit.scroll<=fit.height+1&&fit.rects.every(r=>r.x>=0&&r.y>=0&&r.right<=fit.width&&r.bottom<=fit.height),fit);ok('all flight controls stay large enough to touch',fit.rects.filter(r=>r.id!=='spaceCanvas').every(r=>r.w>=44&&r.h>=44),fit);ok('a child can really land on this screen',await land(page,0),await state(page));await page.screenshot({path:path.join(OUT,'sona-space-'+viewport.width+'.png')});ok('fit has no runtime errors',errors.length===0,errors);await context.close();
 }
 }
 if(part==='all'||part==='landscape')for(const viewport of [{width:844,height:390},{width:568,height:320}]){
  const {page,context,errors}=await h.fresh({viewport});await advance(page,200);ok('the phone portrait guard still covers a rotated screen',await page.locator('#sonaPortraitGuard').isVisible());await page.locator('#sonaPortraitGuard').evaluate(e=>e.remove());await page.locator('#startBtn').click();
  for(let stage=0;stage<8;stage++){
   if(!await sayWord(page))throw Error('Could not earn short-screen flight '+stage);const s=await state(page),g=s.space,clear=g.obstacles.every(o=>{const dx=(o.x-Math.max(g.spawn.x-g.ship.w*.3,Math.min(o.x,g.spawn.x+g.ship.w*.3)))*g.width,dy=(o.y-Math.max(g.spawn.y-g.ship.h*.4,Math.min(o.y,g.spawn.y+g.ship.h*.42)))*g.height;return dx*dx+dy*dy>o.r*o.r*g.width*g.width;});ok('short-screen spawn clears every rock at site '+(stage+1),clear,g);ok('real piloting lands short-screen site '+(stage+1)+' at '+viewport.width,await land(page,stage),await state(page));
  }
  ok('rotating does not break a later landing',errors.length===0,errors);await context.close();
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
