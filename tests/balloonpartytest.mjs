import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,party:window.__balloon}));
async function fresh(opts={}){return h.fresh({...opts,device:{age:'4',...opts.device}});}
async function dragBalloon(p,to,{cancelOther=false}={}){const b=await p.locator('#partyCanvas').boundingBox(),s=(await state(p)).party;await p.mouse.move(b.x+s.balloon.x*b.width,b.y+s.balloon.y*b.height);await p.mouse.down();if(cancelOther)await p.evaluate(()=>document.getElementById('partyCanvas').dispatchEvent(new PointerEvent('pointercancel',{pointerId:99})));await p.mouse.move(b.x+to.x*b.width,b.y+to.y*b.height,{steps:18});await advance(p,180);await p.mouse.up();}
async function pumpFull(p){for(let i=0;i<8;i++){if((await state(p)).party.inflation>=1)return true;await p.locator('#partyPump').click();await advance(p,100);}return (await state(p)).party.inflation>=1;}
try{
 h=await gameHarness('balloon',8349);
 {
  const {page,context}=await fresh({unpark:false});await advance(page,300);ok('the parked party opens no microphone',!page.url().includes('arcade-balloon')&&await page.evaluate(()=>__quiet.requests===0));await context.close();
 }
 {
  const {page,context,errors}=await fresh();const canvas=await page.locator('#partyCanvas').count();ok('Balloon Party has real pump-and-guide play',canvas===1);if(!canvas)throw new Error('Balloon Party is still an animation scene');
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);await page.locator('#partyPump').evaluate(e=>e.click());await advance(page,2000);let s=await state(page);ok('silence and a pump tap cannot skip the word',!s.party.active&&s.party.inflation===0&&s.party.delivered===0&&s.speech.step===0,s);
  ok('two accepted sayings earn a balloon and speech power',await sayWord(page));s=await state(page);ok('the word calms the wind without inflating or delivering for the child',s.party.power>0&&s.party.wind===0&&s.party.inflation===0&&s.party.delivered===0,s);
  await page.locator('#partyPump').click();s=await state(page);const boosted=s.party.inflation;ok('a real pump tap adds air',boosted>0&&boosted<1,s);
  await advance(page,11000);s=await state(page);ok('power expiry keeps the balloon and the earned turn',s.party.power===0&&s.party.active&&s.party.inflation===boosted&&s.speech.step===0,s);
  await page.locator('#partyPump').click();s=await state(page);const ordinary=s.party.inflation-boosted;ok('speech actually makes each pump stronger',boosted>=ordinary*1.8&&ordinary>0,{boosted,ordinary});ok('normal play has a gentle wind',s.party.wind>0,s);
  const held=s.party.inflation;await page.locator('#partyHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('asking for help keeps the same half-filled balloon',s.party.paused&&s.party.inflation===held&&s.speech.step===0,s);
  await page.evaluate(()=>__quiet.background());await advance(page,400);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('background/resume cannot unlock the pump during the help word',s.party.paused&&s.party.inflation===held&&await page.locator('#partyPump').isDisabled(),s);
  ok('a repeated word renews the same balloon power',await sayWord(page));s=await state(page);ok('speech help preserves air and stage while calming the wind',s.party.inflation===held&&s.party.power>0&&s.party.wind===0&&s.speech.step===0,s);
  ok('real taps can finish pumping the balloon',await pumpFull(page));await advance(page,5000);s=await state(page);ok('a full balloon never delivers itself',s.party.delivered===0&&s.speech.step===0,s);
  await dragBalloon(page,{x:.7,y:.68});s=await state(page);ok('a missed drop keeps a full balloon and costs no word',s.party.inflation===1&&s.party.delivered===0&&s.party.active&&s.speech.step===0,s);
  const beforeKeys={...s.party.balloon};await page.locator('#partyBalloon').focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowUp');s=await state(page);ok('keyboard arrows move the same real balloon',s.party.balloon.x<beforeKeys.x&&s.party.balloon.y<beforeKeys.y&&s.party.delivered===0,s);
  await page.screenshot({path:path.join(OUT,'sona-balloon-party.png')});
  for(let stage=0;stage<5;stage++){
   if(stage){if(!await sayWord(page))throw new Error('Could not earn balloon '+stage);if(!await pumpFull(page))throw new Error('Could not inflate balloon '+stage);}
   s=await state(page);await dragBalloon(page,s.party.goal,{cancelOther:stage===0});ok('a real drag and release attaches balloon '+(stage+1),await until(page,n=>__sayplay.step>n,5000,stage));
  }
  await advance(page,3300);s=await state(page);ok('five deliveries fill the garland and finish the party',s.speech.phase==='end'&&s.speech.step===5&&s.party.delivered===5&&s.party.won,s);
  const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));ok('no party sound or instruction reaches a live microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);ok('the child hears how to pump and guide',audio.lines.some(t=>/pump/i.test(t)&&/drag|pull|guide/i.test(t)),audio.lines);
  await page.screenshot({path:path.join(OUT,'sona-balloon-finished.png')});await page.locator('#again').click();await advance(page,400);s=await state(page);ok('another party starts empty and requires speech again',s.speech.step===0&&s.party.delivered===0&&s.party.inflation===0&&!s.party.active,s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 {
  const {page,context,errors}=await fresh({blockAssets:true});await page.locator('#startBtn').click();await sayWord(page);await pumpFull(page);const s=await state(page);await dragBalloon(page,s.party.goal);ok('missing painted sprites do not block a real delivery',await until(page,()=>__sayplay.step===1,5000));ok('fallback art has no runtime errors',errors.length===0,errors);await context.close();
 }
 for(const viewport of [{width:320,height:568},{width:393,height:852},{width:768,height:1024}]){
  const {page,context,errors}=await fresh({viewport});await page.locator('#startBtn').click();await sayWord(page);await pumpFull(page);const fit=await page.evaluate(()=>{const ids=['partyCanvas','partyPump','partyHelp'],rects=ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};});return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,rects};});ok('party fits '+viewport.width+'x'+viewport.height,fit.scroll<=fit.height+1&&fit.rects.every(r=>r.x>=0&&r.y>=0&&r.right<=fit.width&&r.bottom<=fit.height),fit);ok('the pump remains a large preschool touch target',fit.rects.find(r=>r.id==='partyPump').w>=48&&fit.rects.find(r=>r.id==='partyPump').h>=48,fit);const s=await state(page);await dragBalloon(page,s.party.goal);ok('a child can deliver on this screen size',await until(page,()=>__sayplay.step===1,5000));await page.screenshot({path:path.join(OUT,'sona-balloon-'+viewport.width+'.png')});ok('fit has no runtime errors',errors.length===0,errors);await context.close();
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
