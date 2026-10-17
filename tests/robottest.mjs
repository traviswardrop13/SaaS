import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,robot:window.__robot}));
// Verify the wiring independently from the game's `connected` flag. A
// reciprocal pair is necessary at each shared edge, plus the two sockets.
function hasCircuit(s){
 const masks=s.tiles.map(t=>((t.mask<<t.rotation)|(t.mask>>(4-t.rotation)))&15),start=s.startRow*3,end=s.endRow*3+2,seen=new Set(),queue=[start];
 if(!(masks[start]&8))return false;
 const edges=[[-3,1,4],[1,2,8],[3,4,1],[-1,8,2]];
 while(queue.length){const i=queue.shift();if(seen.has(i))continue;seen.add(i);if(i===end&&(masks[i]&2))return true;
  for(const [d,out,input] of edges){const j=i+d;if(j<0||j>8||((d===1||d===-1)&&Math.floor(j/3)!==Math.floor(i/3)))continue;if((masks[i]&out)&&(masks[j]&input)&&!seen.has(j))queue.push(j);}
 }return false;
}
async function solve(p){
 const s=(await state(p)).robot;
 for(let i=0;i<s.tiles.length;i++){
  const tile=s.tiles[i],turns=(tile.correctRotation-tile.rotation+4)%4;
  for(let n=0;n<turns;n++)await p.locator('[data-tile="'+i+'"]').click();
 }
 return (await state(p)).robot;
}
try{
 h=await gameHarness('robot',8348);
 {
  const {page,context}=await h.fresh({unpark:false});await advance(page,500);ok('the unfinished production catalog cannot open a robot microphone',!page.url().includes('arcade-robot')&&await page.evaluate(()=>__quiet.requests===0));await context.close();
 }
 {
  const {page,context,errors}=await h.fresh();const board=await page.locator('#robotBoard').count();ok('the robot has a playable circuit board',board===1);if(!board)throw new Error('Robot Builder is still an animation scene');
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);let s=await state(page);
  await advance(page,1500);s=await state(page);ok('silence never assembles a robot part',s.speech.step===0&&!s.robot.active&&s.robot.assembled===0,s);
  ok('two accepted sayings earn the first circuit',await sayWord(page));s=await state(page);ok('speech opens a blueprint without solving the circuit',s.robot.active&&s.robot.blueprint>0&&!s.robot.connected&&s.robot.assembled===0&&s.speech.step===0,s);
  ok('the initial wires really have no battery-to-socket circuit',!hasCircuit(s.robot),s.robot);await page.locator('#robotTest').click();s=await state(page);ok('a disconnected circuit cannot power a part',s.speech.step===0&&s.robot.assembled===0,s);
  const first=s.robot.tiles[0].rotation;await page.locator('[data-tile="0"]').focus();await page.keyboard.press('Enter');s=await state(page);ok('the circuit really rotates with a keyboard or finger tap',s.robot.tiles[0].rotation===(first+1)%4,s.robot.tiles[0]);
  await advance(page,11000);s=await state(page);ok('the optional blueprint expires without failing or completing the puzzle',s.robot.blueprint===0&&s.robot.active&&s.speech.step===0,s);
  const held=s.robot.tiles.map(t=>t.rotation);await page.locator('#robotHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('asking for help parks the same circuit and awards no part',s.robot.paused&&s.robot.assembled===0&&s.speech.step===0,s);
  await page.evaluate(()=>__quiet.background());await advance(page,400);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('background/resume cannot resume puzzle controls during the help word',s.robot.paused&&s.robot.tiles.every((t,i)=>t.rotation===held[i]),s);
  ok('saying the word renews the same blueprint',await sayWord(page));s=await state(page);ok('renewed help preserves every rotation and the current stage',s.robot.blueprint>0&&!s.robot.paused&&s.robot.tiles.every((t,i)=>t.rotation===held[i])&&s.speech.step===0,s);
  await page.screenshot({path:path.join(OUT,'sona-robot-circuit.png')});
  const layouts=[];
  for(let stage=0;stage<8;stage++){
   if(stage&&!await sayWord(page))throw new Error('Could not earn circuit '+stage);
   s=await state(page);layouts.push(JSON.stringify(s.robot.tiles.map(t=>[t.mask,t.correctRotation])));
   const wired=await solve(page);ok('real rotations connect circuit '+(stage+1),wired.connected&&hasCircuit(wired),wired);
   await advance(page,1500);s=await state(page);ok('a finished wire still waits for the Test power button '+(stage+1),s.speech.step===stage&&s.robot.assembled===stage,s);
   await page.locator('#robotTest').click();ok('testing connected circuit assembles part '+(stage+1),await until(page,n=>__sayplay.step>n,5000,stage));
  }
  await advance(page,3300);s=await state(page);ok('eight working circuits assemble a complete robot and win',s.speech.phase==='end'&&s.speech.step===8&&s.robot.assembled===8,s);ok('each circuit offers a different wiring puzzle',new Set(layouts).size===8,layouts);
  const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));ok('no instruction or celebration plays into the microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);ok('the child hears how to connect the robot and earn help',audio.lines.some(t=>/blueprint/i.test(t)&&/rotat|turn|tap/i.test(t)),audio.lines);
  await page.screenshot({path:path.join(OUT,'sona-robot-finished.png')});
  // Inspect the actual assembled artwork behind the already-verified end
  // card. This changes no game state and restores the card before replay.
  await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-robot-assembled.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='');
  await page.locator('#again').click();await advance(page,500);s=await state(page);ok('building again clears the robot and requires a new word',s.speech.step===0&&!s.robot.active&&s.robot.assembled===0,s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 {
  const {page,context,errors}=await h.fresh({blockAssets:true});await page.locator('#startBtn').click();await sayWord(page);const s=await solve(page);ok('missing painted assets cannot break the real circuit controls',s.connected&&hasCircuit(s),s);await page.locator('#robotTest').click();ok('the fallback robot still assembles from a working circuit',await until(page,()=>__sayplay.step===1,5000));ok('failed artwork has no runtime errors',errors.length===0,errors);await context.close();
 }
 for(const viewport of [{width:320,height:568},{width:393,height:852},{width:768,height:1024}]){
  const {page,context,errors}=await h.fresh({viewport});await page.locator('#startBtn').click();await sayWord(page);const fit=await page.evaluate(()=>{const board=document.getElementById('robotBoard').getBoundingClientRect(),tiles=[...document.querySelectorAll('[data-tile]')].map(t=>{const r=t.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};});return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,board:{x:board.x,y:board.y,right:board.right,bottom:board.bottom},tiles};});ok('robot fits '+viewport.width+'x'+viewport.height,fit.scroll<=fit.height+1&&fit.board.x>=0&&fit.board.y>=0&&fit.board.right<=fit.width&&fit.board.bottom<=fit.height,fit);ok('all nine circuit targets remain large and on screen',fit.tiles.length===9&&fit.tiles.every(t=>t.w>=44&&t.h>=44&&t.x>=0&&t.y>=0&&t.right<=fit.width&&t.bottom<=fit.height),fit.tiles);await page.screenshot({path:path.join(OUT,'sona-robot-'+viewport.width+'.png')});ok('fit has no runtime errors',errors.length===0,errors);await context.close();
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
