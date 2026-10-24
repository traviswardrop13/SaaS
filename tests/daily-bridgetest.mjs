// Day 7: lift, turn and lower real bridge pieces; manually guide both carts.
// Speech uses the unchanged shared SayPlay listener.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {dailyHarness,advance,until,sayWord} from './_daily-adventure.mjs';
let harness,lastPage,checks=0,failures=0;
function ok(name,pass,detail){checks++;if(!pass){failures++;console.log('FAIL '+name+' '+String(JSON.stringify(detail)).slice(0,1900));}}
function requireCheck(name,pass,detail){ok(name,pass,detail);if(!pass)throw new Error(name);}
const state=page=>page.evaluate(()=>({speech:window.__sayplay,bridge:window.__dailyBridge}));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const point=async(page,p)=>{const b=await page.locator('#dailyCanvas').boundingBox();return{x:b.x+p.x*b.width,y:b.y+p.y*b.height};};
async function boot(options={}){
  const r=await harness.fresh(options);lastPage=r.page;
  const ready=await until(r.page,()=>!!window.__dailyBridge&&!!window.__sayplay&&__sayplay.phase==='ready',2000);
  requireCheck('the real Bridge controller boots in the local host',ready,{errors:r.errors,phase:await r.page.locator('body').getAttribute('data-phase'),fixtureError:await r.page.locator('body').getAttribute('data-fixture-error')});
  return r;
}
async function ask(page){await page.locator('#startBtn').click();requireCheck('the shared speech turn starts',await until(page,()=>__sayplay.listening),await state(page));}
// Since 23 Oct 2026 a story game asks each word Sona.STORY_SAY_TIMES (three)
// times, not two. The count is read off the page, so a later change of that
// one number moves only the pins that should move; the words a child sees are
// pinned as they are. Every saying but the last only ticks its dot and asks
// for the rest; the last earns the crane. Same bursts as sayWord's.
async function storySayings(page,age){
  requireCheck('the first word listens again from the mic button',await until(page,()=>__sayplay.listening),await state(page));
  const ask=await page.evaluate(()=>({times:__sayplay.times,story:Sona.STORY_SAY_TIMES,line:(document.getElementById('twiceSay')||{}).textContent,dots:document.querySelectorAll('#twiceDots i').length}));
  ok('age '+age+' Bridge asks each word Sona.STORY_SAY_TIMES (3) times, with a dot a saying',ask.times===ask.story&&ask.story===3&&ask.line==='Say it 3 times'&&ask.dots===ask.times,ask);
  await advance(page,150);const steps=[];
  for(let i=0;i<ask.times;i++){
    if(i)await advance(page,350);await page.evaluate(()=>__quiet.voice=true);await advance(page,280);await page.evaluate(()=>__quiet.voice=false);
    if(i===ask.times-1)break;await advance(page,300);
    steps.push(await page.evaluate(()=>({said:__sayplay.said,phase:__sayplay.phase,listening:__sayplay.listening,status:document.getElementById('micState').textContent,active:__dailyBridge.active,stage:__dailyBridge.stage})));
  }
  const left=n=>n+' more '+(n===1?'time':'times')+'!';
  ok('age '+age+' sayings before the last only tick dots and ask for the rest ("2 more times!", then "1 more time!")',steps.length===ask.times-1&&steps.every((s,i)=>s.said===i+1&&s.phase==='turn'&&s.listening&&s.status===left(ask.times-1-i))&&steps[0].status==='2 more times!'&&steps[steps.length-1].status==='1 more time!',steps);
  ok('age '+age+' '+(ask.times-1)+' sayings alone never open the crane or start a bridge goal',steps.every(s=>!s.active&&s.stage===-1),steps);
  requireCheck('age '+age+' the third real saying earns the crane controls',await until(page,()=>__sayplay.phase==='play'),await state(page));
  return ask.times;
}
async function audioAudit(page){return page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));}
async function accessChecks(){
  for(const options of [{closed:true},{device:{premium:false,paid:true}}]){
    const {page,context,errors}=await harness.fresh(options);
    const home=await until(page,()=>/\/(today|activities)\.html$/.test(location.pathname),8000);
    const q=await page.evaluate(()=>({requests:__quiet.requests,sounds:__quiet.soundsBefore+__quiet.sounds.length}));
    ok(options.closed?'a parked Bridge goes Home through the real catalog gate':'an unentitled Bridge goes Home through the real Premium gate',home&&!page.url().includes('daily-adventure'),{url:page.url(),q});
    ok('closed access asks for no microphone and plays no sound',q.requests===0&&q.sounds===0,q);
    ok('the closed route has no runtime errors',errors.length===0,errors);await context.close();
  }
}
async function deniedMicCheck(){
  const {page,context,errors}=await boot({device:{age:'4',micok:false,permission:'prompt',micMode:'deny'}});
  await page.locator('#startBtn').click();await until(page,()=>document.getElementById('primer').classList.contains('show'),2500);await page.locator('#primerYes').click();
  const denied=await until(page,()=>!!document.getElementById('sonaMicDenied')&&__sayplay.phase==='denied',4000),s=await state(page);
  ok('a refused microphone shows shared help and starts no bridge job',denied&&s.speech.step===0&&!s.bridge.active&&await page.evaluate(()=>__quiet.live()===0&&Sona.weekReps(0)===0),s.speech);
  ok('the refused microphone path has no runtime errors',errors.length===0,errors);await context.close();
}

async function screenRects(page){return page.evaluate(()=>{
  const selectors=['#dailyCanvas','#top','#dailyBanner','#dailyHelp','#dailyControls button','#dailyControls input','#turnPanel','#hear','#word','#helpBack'];
  const rects=[],seen=new Set();
  for(const selector of selectors)for(const el of document.querySelectorAll(selector)){
    if(seen.has(el))continue;seen.add(el);const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    if(el.hidden||s.display==='none'||s.visibility==='hidden'||!r.width||!r.height)continue;
    rects.push({selector:el.id?'#'+el.id:selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,label:el.getAttribute('aria-label')||el.textContent.trim(),picture:!!el.querySelector('svg,img')});
  }
  return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,rects};
});}
const inside=f=>f.scroll<=f.height+1&&f.rects.every(r=>r.x>=-.5&&r.y>=-.5&&r.right<=f.width+.5&&r.bottom<=f.height+.5);
const overlap=(a,b)=>a.x<b.right&&b.x<a.right&&a.y<b.bottom&&b.y<a.bottom;
const inCanvas=(r,c)=>r.x>=c.x-.5&&r.y>=c.y-.5&&r.right<=c.right+.5&&r.bottom<=c.bottom+.5;
async function fitControls(page,label){
  const fit=await screenRects(page),canvas=fit.rects.find(r=>r.selector==='#dailyCanvas'),help=fit.rects.find(r=>r.selector==='#dailyHelp'),controls=fit.rects.filter(r=>/^#bridge/.test(r.selector));
  ok(label+' controls fit the actual bridge canvas',inside(fit)&&controls.length>0&&controls.every(r=>inCanvas(r,canvas)),fit);
  ok(label+' controls retain 44 pixel targets and useful labels',controls.every(r=>r.w>=44&&r.h>=44&&r.label.length>0),controls);
  ok(label+' extra help remains clear of the physical controls',!!help&&controls.every(r=>!overlap(r,help)),fit);
}
const held=g=>({stage:g.stage,taskIndex:g.taskIndex,objective:g.objective,placed:g.placed,completedGoals:g.completedGoals,testFinished:g.testFinished,movingFinished:g.movingFinished,crane:{x:g.crane.x,length:g.crane.length,load:g.crane.load&&{id:g.crane.load.id,commandAngle:g.crane.load.commandAngle,turns:g.crane.load.turns,lifted:g.crane.load.lifted}},cart:{x:g.cart.x,y:g.cart.y,kind:g.cart.kind,distance:g.cart.distance,arrived:g.cart.arrived}});
const pose=g=>({held:held(g),hook:g.crane.hook,theta:g.crane.theta,omega:g.crane.omega,minY:g.crane.load&&g.crane.load.minY,sway:g.cart.sway,swayVelocity:g.cart.swayVelocity});
const distance=(g,a,b)=>Math.hypot((a.x-b.x)*g.width,(a.y-b.y)*g.height);
function shapeAngle(a){while(a>Math.PI/2)a-=Math.PI;while(a<-Math.PI/2)a+=Math.PI;return a;}
async function arrow(page,dir,ms){await page.locator('#bridge'+dir).focus();await page.keyboard.down('Space');await advance(page,ms);await page.keyboard.up('Space');await page.locator('#bridgeStop').click();}
async function dragCancel(page,selector,target){
  const b=await page.locator(selector).boundingBox(),p=await point(page,target);await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(p.x,p.y);const id=(await state(page)).bridge.pointer.id;
  await page.locator(selector).evaluate((el,id)=>el.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:id})),id);await page.mouse.up();
}
// The hook moves at the real winch speed. Feedback aims the gantry against
// the visible pendulum offset; it never assigns the hook or load position.
async function hookTo(page,target){
  const b=await page.locator('#bridgeHook').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();let reached=false;
  try{for(let t=0;t<8500;t+=100){let g=(await state(page)).bridge;
    if(distance(g,g.crane.hook,target)<5&&Math.abs(g.crane.velocity)<.015){reached=true;break;}
    const aim={x:target.x-Math.sin(g.crane.theta)*g.crane.length*g.height/g.width,y:g.crane.boomY+(target.y-g.crane.boomY)/Math.cos(g.crane.theta)},p=await point(page,aim);
    await page.mouse.move(p.x,p.y);await advance(page,100);
  }}finally{await page.mouse.up();await page.locator('#bridgeStop').click();}
  requireCheck('the real winch and gantry reach the aimed hook position',reached,{target,crane:(await state(page)).bridge.crane});
}
async function rotateTo(page,target){
  let g=(await state(page)).bridge,delta=shapeAngle(target-g.crane.load.commandAngle),n=Math.round(delta/(Math.PI/12)),dir=n>=0?'Right':'Left';
  if(!n&&g.current.requiresTurn&&!g.crane.load.turns){await page.locator('#bridgeRotateRight').click();await page.locator('#bridgeRotateLeft').click();}
  else for(let i=0;i<Math.abs(n);i++)await page.locator('#bridgeRotate'+dir).click();
}
async function helpChecks(page){
  await until(page,()=>__dailyBridge.power===0,14000);let g=(await state(page)).bridge;const saved=pose(g);
  await page.locator('#dailyHelp').focus();await page.keyboard.press('Space');await until(page,()=>__sayplay.listening);g=(await state(page)).bridge;
  ok('Space opens help and freezes the exact suspended load',g.paused&&equal(pose(g),saved));
  await page.locator('#helpBack').click();g=(await state(page)).bridge;
  ok('Back returns the same carriage, attached wood and bridge without power',!g.paused&&g.power===0&&equal(held(g),saved.held));
  const beforeSilent=held(g);await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);await until(page,()=>__sayplay.phase==='play',16000);g=(await state(page)).bridge;
  ok('silent help returns without placing wood, moving the winch or granting power',!g.paused&&g.power===0&&equal(held(g),beforeSilent));
  await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);const frozen=pose((await state(page)).bridge);await page.evaluate(()=>__quiet.background());await advance(page,3000);g=(await state(page)).bridge;
  ok('backgrounding help freezes pendulum, load and structure and closes the microphone',g.paused&&equal(pose(g),frozen)&&await page.evaluate(()=>__quiet.live()===0));
  await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();g=(await state(page)).bridge;
  ok('resuming returns that same earned suspended piece',!g.paused&&g.power===0&&equal(held(g),frozen.held));
  await arrow(page,'Right',250);g=(await state(page)).bridge;const ordinary={damping:g.crane.damping,tolerance:g.landing.tolerance,angle:g.landing.angleTolerance,omega:Math.abs(g.crane.omega)},work=held(g);
  requireCheck('manual gantry travel produces real suspended-load motion',ordinary.omega>.0001,{crane:g.crane});
  await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);const swinging=pose((await state(page)).bridge);await advance(page,500);ok('the same swinging pose holds during the optional microphone',equal(pose((await state(page)).bridge),swinging));
  requireCheck('the optional accepted word steadies this same real load',await sayWord(page),await state(page));g=(await state(page)).bridge;
  ok('speech adds damping and wider physical landing and angle tolerance without placing wood',Math.abs(g.crane.damping-(ordinary.damping+7.5))<1e-8&&Math.abs(g.landing.tolerance-ordinary.tolerance*1.6)<1e-8&&g.landing.angleTolerance>ordinary.angle&&equal(held(g),work),{ordinary,crane:g.crane,landing:g.landing});
  ok('the actual load swing slows after speech resumes the crane',Math.abs(g.crane.omega)<ordinary.omega,{before:ordinary.omega,after:g.crane.omega});
}
async function cranePiece(page,{age,seen}){
  let g=(await state(page)).bridge,p=g.current;
  requireCheck('every required support is real placed wood before '+p.id,p.requires.every(id=>g.pieces.find(v=>v.id===id).placed),{piece:p,placed:g.placed});
  if(!g.crane.load){await hookTo(page,p.source);await page.locator('#bridgeLift').focus();await page.keyboard.press('Space');g=(await state(page)).bridge;requireCheck('Space links the actual hook to '+p.id,g.crane.load?.id===p.id&&g.attached>0,g.crane);}
  await hookTo(page,{x:p.source.x,y:p.safeLiftY});g=(await state(page)).bridge;
  requireCheck('the wood is physically hoisted above its landing',g.crane.load.lifted&&g.crane.load.minY<p.target.y-18/g.height,g.crane);
  if(!seen.has('badRelease')){
    seen.add('badRelease');const prior=g.placed.slice();for(let n=0;n<4;n++)await page.locator('#bridgeLift').click();g=(await state(page)).bridge;
    ok('repeated airborne release attempts never place a piece or finish a job',equal(g.placed,prior)&&g.crane.load?.id===p.id&&g.completedGoals.length===0&&g.misses>=4,{placed:g.placed,load:g.crane.load,misses:g.misses});
    await helpChecks(page);g=(await state(page)).bridge;
  }
  if(p.requiresTurn&&!seen.has('needsTurn')){
    seen.add('needsTurn');await hookTo(page,p.target);await page.locator('#bridgeLift').click();g=(await state(page)).bridge;
    ok('lowering an unturned piece cannot satisfy its rotation requirement',g.crane.load?.id===p.id&&!g.current.placed&&g.crane.load.turns===0,g.crane.load);
    await hookTo(page,{x:p.target.x,y:p.safeLiftY});
  }
  await rotateTo(page,p.target.angle);await hookTo(page,p.target);g=(await state(page)).bridge;
  requireCheck('actual position, angle, lift history and supports permit '+p.id,g.landing.canRelease&&g.crane.load.id===p.id&&Math.abs(shapeAngle(g.crane.load.angle-p.target.angle))<=g.landing.angleTolerance,{piece:p,landing:g.landing,crane:g.crane});
  if(!seen.has('craneImage')){seen.add('craneImage');await page.screenshot({path:'/tmp/daily-bridge-crane-age'+age+'.png'});}
  await page.locator('#bridgeLift').click();g=(await state(page)).bridge;
  requireCheck('a separate manual release installs '+p.id,g.placed.includes(p.id)&&g.pieces.find(v=>v.id===p.id).placed,{placed:g.placed});
}
async function cartTo(page,target){
  const b=await page.locator('#bridgeCart').boundingBox(),p=await point(page,target);await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(p.x,p.y);let reached=false;
  try{for(let t=0;t<12000;t+=100){let g=(await state(page)).bridge;if(distance(g,g.cart,target)<6){reached=true;break;}await advance(page,100);}}
  finally{await page.mouse.up();await page.locator('#bridgeStop').click();}
  requireCheck('real wheels reach the aimed cart waypoint',reached,{target,cart:(await state(page)).bridge.cart});
}
async function cartLayouts(page){
  let s=await state(page),g=s.bridge;const structure={step:s.speech.step,stage:g.stage,taskIndex:g.taskIndex,objective:g.objective,placed:g.placed,completedGoals:g.completedGoals,test:g.testFinished,moving:g.movingFinished,kind:g.cart.kind,distance:g.cart.distance},resized=[];
  function retained(s){const g=s.bridge,points=[{x:0,y:g.deck.y},...g.deck.waypoints,{x:1,y:g.door.y}];let middle=g.deck.y;for(let i=1;i<points.length;i++)if(g.cart.x<=points[i].x){const a=points[i-1],b=points[i],u=(g.cart.x-a.x)/(b.x-a.x);middle=a.y+(b.y-a.y)*u;break;}return s.speech.step===structure.step&&g.stage===structure.stage&&g.taskIndex===structure.taskIndex&&g.objective===structure.objective&&equal(g.placed,structure.placed)&&equal(g.completedGoals,structure.completedGoals)&&g.testFinished===structure.test&&g.movingFinished===structure.moving&&g.cart.kind===structure.kind&&g.cart.distance+1e-8>=structure.distance&&g.cart.x>=28/g.width-1e-8&&g.cart.x<=1-28/g.width+1e-8&&Math.abs(g.cart.y-middle)<=g.deck.halfHeight*g.cart.laneAllowance+1/g.height;}
  for(const viewport of [{width:320,height:568},{width:393,height:852},{width:768,height:1024},{width:1024,height:768}]){
    await page.setViewportSize(viewport);requireCheck('the crane canvas finishes native resize',await until(page,()=>{const r=document.getElementById('dailyCanvas').getBoundingClientRect();return Math.abs(__dailyBridge.width-r.width)<.5&&Math.abs(__dailyBridge.height-r.height)<.5;},1500),await state(page));await advance(page,100);
    const tag=viewport.width+'x'+viewport.height;await fitControls(page,'cart '+tag);s=await state(page);resized.push({size:tag,valid:retained(s),step:s.speech.step,placed:s.bridge.placed,cart:s.bridge.cart});await page.screenshot({path:path.join(OUT,'sona-daily-bridge-cart-'+tag+'.png')});
  }
  await page.setViewportSize({width:393,height:852});await until(page,()=>__dailyBridge.width===393&&__dailyBridge.height===852,1500);await advance(page,100);s=await state(page);
  ok('reflow retains the bridge and earned crossing progress with the cart safe in its new lane',resized.every(r=>r.valid)&&retained(s),{before:structure,resized});
}
async function crossCart(page,{age,seen}){
  let g=(await state(page)).bridge,kind=g.cart.kind,step=g.stage;
  ok('the cart starts with every real deck span installed',g.placed.includes('gap')&&g.placed.includes('panel-a')&&g.placed.includes('panel-b')&&g.cart.distance===0&&!g.cart.arrived,{deck:g.deck,cart:g.cart});
  await page.locator('#bridgeLift').focus();await page.keyboard.press('Space');g=(await state(page)).bridge;
  ok('the bell at the starting bank cannot award a crossing',!g.cart.arrived&&g.stage===step&&!(kind==='test'?g.testFinished:g.movingFinished));
  const before=held(g);await dragCancel(page,'#bridgeCart',g.door);g=(await state(page)).bridge;
  ok('a cancelled cart drag adds no travel or arrival',!g.pointer&&equal(held(g),before));
  await until(page,()=>__dailyBridge.power===0,14000);g=(await state(page)).bridge;
  await arrow(page,'Up',900);g=(await state(page)).bridge;const rail={y:g.cart.y,allowance:g.cart.laneAllowance,damping:g.cart.swayDamping,tolerance:g.door.tolerance};
  ok('real rails stop sideways cart motion without an automatic crossing',g.cart.collisions>0&&!g.cart.arrived&&g.stage===step,{cart:g.cart});
  if(kind==='moving'){
    const parked=held(g);await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);ok('cart help preserves position and all real bridge pieces',equal(held((await state(page)).bridge),parked));
    requireCheck('the optional word steadies the loaded moving cart',await sayWord(page),await state(page));g=(await state(page)).bridge;
    ok('speech widens the actual cart lane and doorstep while increasing load damping',g.cart.laneAllowance>rail.allowance&&g.cart.swayDamping>rail.damping&&g.door.tolerance>rail.tolerance&&equal(held(g),parked),{rail,cart:g.cart,door:g.door});
    await arrow(page,'Up',350);g=(await state(page)).bridge;
    ok('the same manual side steering gains useful real room after speech',g.cart.y<rail.y-1/g.height&&!g.cart.arrived,{before:rail.y,after:g.cart.y});
  }
  if(kind==='test'&&age==='7')await cartLayouts(page);
  g=(await state(page)).bridge;const saved=held(g);await page.evaluate(()=>__quiet.background());await advance(page,2000);g=(await state(page)).bridge;
  ok('backgrounding preserves this partial crossing and bridge exactly',g.paused&&equal(held(g),saved));await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();
  g=(await state(page)).bridge;
  for(const waypoint of g.deck.waypoints){await cartTo(page,waypoint);if(kind==='moving'&&Math.abs(waypoint.x-.5)<.01){await page.screenshot({path:age==='3'?'/tmp/daily-bridge-younger.png':'/tmp/daily-bridge-phone.png'});}}
  await until(page,()=>__dailyBridge.cart.canArrive,3000);g=(await state(page)).bridge;
  requireCheck('the '+kind+' cart physically reaches and stops at the real doorstep',g.cart.canArrive&&g.cart.distance>=.60&&distance(g,g.cart,g.door)<=g.door.tolerance*g.width&&g.cart.speed===0&&!g.cart.arrived,{cart:g.cart,door:g.door});
  await advance(page,1500);g=(await state(page)).bridge;
  ok('arrival still waits for a separate manual bell action',!g.cart.arrived&&g.stage===step&&!(kind==='test'?g.testFinished:g.movingFinished));
  await page.screenshot({path:path.join(OUT,'sona-daily-bridge-'+kind+'-door-age'+age+'.png')});await page.locator('#bridgeLift').click();g=(await state(page)).bridge;
  ok('the pictured bell confirms the earned '+kind+' crossing',kind==='test'?g.testFinished:g.movingFinished,g.cart);
  seen.add(kind);
}
async function finishStage(page,step,options){for(let turn=0;turn<20;turn++){let s=await state(page),g=s.bridge;if(s.speech.step>step)return true;if(!g.active){await advance(page,1000);continue;}if(g.phase==='crane')await cranePiece(page,options);else if(g.phase==='cart')await crossCart(page,options);else throw new Error('No real bridge objective '+g.objective);}return (await state(page)).speech.step>step;}
async function layoutChecks(){
  for(const viewport of [{width:320,height:568},{width:393,height:852},{width:768,height:1024},{width:1024,height:768}]){
    const tag=viewport.width+'x'+viewport.height,{page,context,errors}=await boot({viewport});await ask(page);let fit=await screenRects(page);
    ok('the bridge word and Hear it fit '+tag,inside(fit)&&fit.rects.some(r=>r.selector==='#hear'&&r.h>=44),fit);requireCheck('speech opens the real crane at '+tag,await sayWord(page),await state(page));await fitControls(page,'crane '+tag);
    ok('crane action and direction buttons have nonreader pictograms '+tag,await page.locator('.bridge-arrow,.bridge-rotate,.bridge-action,.bridge-stop').evaluateAll(es=>es.every(e=>!!e.querySelector('svg'))));await page.screenshot({path:path.join(OUT,'sona-daily-bridge-crane-'+tag+'.png')});
    await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);fit=await screenRects(page);ok('bridge help and Back fit '+tag,inside(fit)&&fit.rects.some(r=>r.selector==='#helpBack'&&r.w>=44&&r.h>=44),fit);await page.locator('#helpBack').click();ok('bridge layout has no page errors '+tag,errors.length===0,errors);await context.close();
  }
  const {page,context}=await boot({viewport:{width:568,height:320}});ok('a phone landscape keeps the existing portrait guard',await page.locator('#sonaPortraitGuard').isVisible());await context.close();
}
async function playthrough(age,total){
  const {page,context,errors}=await boot({device:{age}});let s=await state(page),g=s.bridge,initial=held(g),reps=await page.evaluate(()=>Sona.weekReps(0));
  ok('age '+age+' uses the real five/eight bridge goals',g.stages===total&&s.speech.steps===total,{stages:g.stages,steps:s.speech.steps});
  ok('Bridge uses normal Premium catalog access',await page.evaluate(()=>{const a=Sona.gameAct('bridge');return Sona.gameAccess('bridge').allowed&&a.tier==='premium'&&a.say&&a.go==='/daily-adventure.html';}));
  await ask(page);await page.keyboard.press('ArrowRight');await advance(page,14000);s=await state(page);
  ok('silence, waiting and hook keys cannot build or cross the bridge',s.speech.phase==='nudge'&&s.speech.step===0&&!s.bridge.active&&equal(held(s.bridge),initial)&&await page.evaluate(n=>Sona.weekReps(0)===n,reps),s.speech);
  await page.locator('#micBtn').click();const times=await storySayings(page,age);g=(await state(page)).bridge;
  const start=g.crane.x;await arrow(page,'Right',350);g=(await state(page)).bridge;ok('Space held on the right arrow really moves the gantry',g.crane.x>start+.01&&g.keys.length===0,{before:start,crane:g.crane});
  const before=held(g);await dragCancel(page,'#bridgeHook',g.current.source);g=(await state(page)).bridge;ok('pointer cancellation clears crane input without attaching or placing wood',!g.pointer&&equal(held(g),before));
  const seen=new Set();
  for(let step=0;step<total;step++){if(step)requireCheck('the shared word earns Bridge goal '+(step+1)+' at age '+age,await sayWord(page),await state(page));requireCheck('real crane work and crossings finish goal '+(step+1)+' at age '+age,await finishStage(page,step,{age,seen}),await state(page));}
  await until(page,()=>__sayplay.phase==='end',5000);s=await state(page);g=s.bridge;
  ok('the truly built bridge and both manual cart crossings earn the ending at age '+age,s.speech.phase==='end'&&s.speech.step===total&&g.won&&g.completedGoals.length===total&&g.placed.length===(total===5?6:8)&&g.testFinished&&g.movingFinished&&g.cart.arrived&&g.cart.distance>=.60&&g.rotations>0&&seen.has('test')&&seen.has('moving'),{speech:s.speech,placed:g.placed,cart:g.cart});
  const audio=await audioAudit(page);ok('all crane directions and chimes stay outside the microphone',audio.leaks===0&&audio.overlap===0&&audio.live===0,audio);ok('directions name physical actions without grading the child',audio.lines.some(t=>/hook|wood|cart|bridge/i.test(t))&&!audio.lines.some(t=>/wrong|fail|score|points|correct/i.test(t)),audio.lines);
  // each heard saying is one play rep: every goal word and the two help words
  // (the crane's steady and the moving cart's), each said `times` times (three
  // since 23 Oct 2026, so 7 words are 21 reps at age 3 and 10 are 30 at age 7)
  ok('only accepted sayings count as play reps and no clinical outcome is recorded',await page.evaluate(({reps,total,times})=>Sona.weekReps(0)===reps+(total+2)*times&&Sona.weekReps(0,null,true)===0&&Object.keys(Sona.outcomes()).length===0,{reps,total,times}),await page.evaluate(()=>({reps:Sona.weekReps(0),outcomes:Sona.outcomes()})));
  await page.screenshot({path:path.join(OUT,'sona-daily-bridge-finished-age'+age+'.png')});await page.locator('#again').click();g=(await state(page)).bridge;
  ok('Play again clears all placed wood and crossings and requires speech',g.stage===-1&&!g.active&&!g.won&&g.placed.length===0&&g.completedGoals.length===0&&!g.crane.load&&!g.testFinished&&!g.movingFinished&&g.cart.distance===0);
  ok('the full bridge path has no runtime errors at age '+age,errors.length===0,errors);await context.close();
}
try{harness=await dailyHarness({key:'bridge',port:8397});await accessChecks();for(const [age,total] of [['3',5],['7',8]])await playthrough(age,total);await deniedMicCheck();await layoutChecks();}
catch(error){if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:'/tmp/daily-bridge-failure.png'}).catch(()=>{});if(!failures)ok('the bridge suite completes without a page or harness crash',false,error.stack);else console.log('STOP '+error.message);}
finally{if(harness)await harness.close();}
console.log('Bridge: '+checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
