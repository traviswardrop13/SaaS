// Day 6: every ingredient, shaped bun, baked tray and basket placement must
// come from real controls. Speech uses the unchanged shared SayPlay listener.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {dailyHarness,advance,until,sayWord} from './_daily-adventure.mjs';
let harness,lastPage,checks=0,failures=0;
function ok(name,pass,detail){checks++;if(!pass){failures++;console.log('FAIL '+name+' '+String(JSON.stringify(detail)).slice(0,1900));}}
function requireCheck(name,pass,detail){ok(name,pass,detail);if(!pass)throw new Error(name);}
const state=page=>page.evaluate(()=>({speech:window.__sayplay,bakery:window.__dailyBakery}));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const point=async(page,p)=>{const b=await page.locator('#dailyCanvas').boundingBox();return{x:b.x+p.x*b.width,y:b.y+p.y*b.height};};
async function boot(options={}){
  const r=await harness.fresh(options);lastPage=r.page;
  const ready=await until(r.page,()=>!!window.__dailyBakery&&!!window.__sayplay&&__sayplay.phase==='ready',2000);
  requireCheck('the real Bakery controller boots in the local host',ready,{errors:r.errors,phase:await r.page.locator('body').getAttribute('data-phase'),fixtureError:await r.page.locator('body').getAttribute('data-fixture-error')});
  return r;
}
async function ask(page){await page.locator('#startBtn').click();requireCheck('the shared speech turn starts',await until(page,()=>__sayplay.listening),await state(page));}
async function audioAudit(page){return page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));}
async function accessChecks(){
  for(const options of [{closed:true},{device:{premium:false,paid:true}}]){
    const {page,context,errors}=await harness.fresh(options);
    const home=await until(page,()=>/\/(today|activities)\.html$/.test(location.pathname),8000);
    const q=await page.evaluate(()=>({requests:__quiet.requests,sounds:__quiet.soundsBefore+__quiet.sounds.length}));
    ok(options.closed?'a parked Bakery goes Home through the real catalog gate':'an unentitled Bakery goes Home through the real Premium gate',home&&!page.url().includes('daily-adventure'),{url:page.url(),q});
    ok('closed access asks for no microphone and plays no sound',q.requests===0&&q.sounds===0,q);
    ok('the closed route has no runtime errors',errors.length===0,errors);await context.close();
  }
}
async function deniedMicCheck(){
  const {page,context,errors}=await boot({device:{age:'4',micok:false,permission:'prompt',micMode:'deny'}});
  await page.locator('#startBtn').click();await until(page,()=>document.getElementById('primer').classList.contains('show'),2500);await page.locator('#primerYes').click();
  const denied=await until(page,()=>!!document.getElementById('sonaMicDenied')&&__sayplay.phase==='denied',4000),s=await state(page);
  ok('a refused microphone shows shared help and starts no bakery job',denied&&s.speech.step===0&&!s.bakery.active&&await page.evaluate(()=>__quiet.live()===0&&Sona.weekReps(0)===0),s.speech);
  ok('the refused microphone path has no runtime errors',errors.length===0,errors);await context.close();
}
async function drag(page,selector,to,{cancel=false}={}){
  const from=await page.locator(selector).boundingBox(),end=await point(page,to);
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:12});
  if(cancel){const pointer=await page.evaluate(()=>__dailyBakery.pointer.id);await page.locator(selector).evaluate((el,id)=>el.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:id})),pointer);}
  await page.mouse.up();
}
async function screenRects(page){return page.evaluate(()=>{
  const selectors=['#dailyCanvas','#top','#dailyBanner','#dailyHelp','#bakeryTool','#bakeryAction','#bakeryLevel','#bakeryTray','#bakeryHeat','#bakeryBun0','#bakeryBun1','#bakeryBun2','#bakeryBun3','#bakeryBatch0','#bakeryBatch1','#bakeryBatch2','#turnPanel','#hear','#word','#helpBack'];
  const rects=[];
  for(const selector of selectors)for(const el of document.querySelectorAll(selector)){
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    if(el.hidden||s.display==='none'||s.visibility==='hidden'||!r.width||!r.height)continue;
    rects.push({selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,label:el.getAttribute('aria-label')||el.textContent.trim(),picture:!!el.querySelector('svg,img')});
  }
  return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,rects};
});}
const inside=f=>f.scroll<=f.height+1&&f.rects.every(r=>r.x>=-.5&&r.y>=-.5&&r.right<=f.width+.5&&r.bottom<=f.height+.5);
const overlap=(a,b)=>a.x<b.right&&b.x<a.right&&a.y<b.bottom&&b.y<a.bottom;
async function layoutChecks(){
  for(const viewport of [{width:320,height:568},{width:393,height:852},{width:768,height:1024},{width:1024,height:768}]){
    const tag=viewport.width+'x'+viewport.height,{page,context,errors}=await boot({viewport});await ask(page);let fit=await screenRects(page);
    ok('the bakery word and Hear it fit '+tag,inside(fit)&&fit.rects.some(r=>r.selector==='#hear'&&r.h>=44),fit);
    requireCheck('the accepted word opens the real bakery tools at '+tag,await sayWord(page),await state(page));fit=await screenRects(page);
    const controls=fit.rects.filter(r=>/^#bakery/.test(r.selector)),help=fit.rects.find(r=>r.selector==='#dailyHelp');
    ok('the actual bakery tools fit '+tag,inside(fit)&&controls.length>0,fit);
    ok('the bakery controls remain at least 44 pixels '+tag,controls.every(r=>r.w>=44&&r.h>=44),controls);
    ok('tool labels and pictures explain the active actions '+tag,controls.every(r=>r.label.length>0)&&controls.some(r=>r.picture),controls);
    ok('extra help does not cover the bakery tools '+tag,!!help&&controls.every(r=>!overlap(r,help)),fit);
    await page.screenshot({path:path.join(OUT,'sona-daily-bakery-'+tag+'.png')});
    await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);fit=await screenRects(page);
    ok('optional bakery help and Back to the game fit '+tag,inside(fit)&&fit.rects.some(r=>r.selector==='#helpBack'&&r.w>=44&&r.h>=44),fit);
    await page.screenshot({path:path.join(OUT,'sona-daily-bakery-help-'+tag+'.png')});await page.locator('#helpBack').click();
    ok('the bakery layout has no runtime errors '+tag,errors.length===0,errors);await context.close();
  }
  const {page,context}=await boot({viewport:{width:568,height:320}});
  ok('a landscape phone keeps the existing portrait guard',await page.locator('#sonaPortraitGuard').isVisible());await context.close();
}
// Timed pointer travel lets the simulation see real pouring and shaping work;
// moving a paused-clock mouse alone is not elapsed play.
async function stroke(page,selector,points,{stepMs=35,holdMs=0,cancel=false}={}){
  const from=await page.locator(selector).boundingBox();
  if(!from)throw new Error('Missing real bakery control '+selector);
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
  for(const p of points){const to=await point(page,p);await page.mouse.move(to.x,to.y);if(stepMs)await advance(page,stepMs);}
  if(holdMs)await advance(page,holdMs);
  if(cancel){const pointer=await page.evaluate(()=>__dailyBakery.pointer.id);await page.locator(selector).evaluate((el,id)=>el.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:id})),pointer);}
  await page.mouse.up();
}
function ring(center,rx,ry,turns=1,samples=32){
  const points=[];for(let i=0;i<=samples*turns;i++){const a=i/samples*Math.PI*2;points.push({x:center.x+Math.cos(a)*rx,y:center.y+Math.sin(a)*ry});}return points;
}
const held=g=>({stage:g.stage,taskIndex:g.taskIndex,phase:g.phase,batch:g.batch,completedGoals:g.completedGoals,tool:{x:g.tool.x,y:g.tool.y},ovenBatch:g.oven.batch,heat:g.heat&&{setpoint:g.heat.setpoint,actual:g.heat.actual,touched:g.heat.touched,touches:g.heat.touches},batches:g.batches.map(b=>({key:b.key,flour:b.flour,liquid:b.liquid,flourChecked:b.flourChecked,liquidChecked:b.liquidChecked,mix:b.mix,sweep:b.sweep,quadrants:b.quadrants,trayState:b.trayState,bake:b.bake,baked:b.baked,cooled:b.cooled,buns:b.buns.map(v=>({index:v.index,formed:v.formed,onTray:v.onTray,sorted:v.sorted,press:v.press,pressTravel:v.pressTravel,trace:v.trace,well:v.well,filled:v.filled}))})),particles:g.particles});
const batch=g=>g.batches[g.batch];
const currentBun=g=>batch(g).buns.find(b=>!b.onTray);
async function holdTool(page,to,ms){const b=await page.locator('#bakeryTool').boundingBox(),p=await point(page,to);await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(p.x,p.y);await advance(page,ms);await page.mouse.up();await advance(page,1000);}
function pourPosition(g,offset=0){return{x:g.bowl.x+offset-(g.tool.spout.x-g.tool.x),y:g.bowl.y-.15*g.width/g.height};}
async function pourIngredient(page){
  let g=(await state(page)).bakery,key=g.phase==='pourFlour'?'flour':'liquid',goal=batch(g)[key+'Target'];
  const b=await page.locator('#bakeryTool').boundingBox(),p=await point(page,pourPosition(g));await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(p.x,p.y);
  try{requireCheck('falling '+key+' really reaches the bowl',await until(page,()=>{const g=__dailyBakery,b=g.batches[g.batch],k=g.phase==='pourFlour'?'flour':'liquid';return b[k]>=b[k+'Target']-g.amountBand*.5;},6500),await state(page));}finally{await page.mouse.up();}
  await advance(page,1000);g=(await state(page)).bakery;
  if(batch(g)[key]>goal+g.amountBand)await page.locator('#bakeryLevel').click();
  await page.locator('#bakeryAction').click();await advance(page,50);g=(await state(page)).bakery;
  requireCheck('the actual '+key+' amount passes its manual picture check',batch(g)[key+'Checked'],batch(g));
}
async function heatTo(page,value){
  const b=await page.locator('#bakeryHeat').boundingBox();await page.mouse.click(b.x+15+(b.width-30)*value,b.y+b.height/2);
}
async function richLayouts(page,label){
  const before=held((await state(page)).bakery);
  for(const viewport of [{width:320,height:568},{width:393,height:852},{width:768,height:1024},{width:1024,height:768}]){
    await page.setViewportSize(viewport);requireCheck('the bakery canvas finishes resizing',await until(page,()=>{const r=document.getElementById('dailyCanvas').getBoundingClientRect();return Math.abs(__dailyBakery.width-r.width)<.5&&Math.abs(__dailyBakery.height-r.height)<.5;},1500),await state(page));await advance(page,50);const fit=await screenRects(page),cs=fit.rects.filter(r=>/^#bakery/.test(r.selector)),help=fit.rects.find(r=>r.selector==='#dailyHelp'),tag=viewport.width+'x'+viewport.height;
    ok(label+' controls and physical work fit '+tag,inside(fit)&&cs.every(r=>r.w>=44&&r.h>=44)&&cs.every(r=>!overlap(r,help)),fit);
    const tabs=await page.locator('.bakery-batch').evaluateAll(es=>es.map(e=>({hidden:e.hidden,picture:!!e.querySelector('img,svg'),label:e.getAttribute('aria-label')})));
    ok(label+' tray selectors have matching nonreader pictures '+tag,tabs.length===3&&tabs.every(t=>!t.hidden&&t.picture&&t.label),tabs);
    await page.screenshot({path:path.join(OUT,'sona-daily-bakery-'+label+'-'+tag+'.png')});
  }
  await page.setViewportSize({width:393,height:852});await until(page,()=>__dailyBakery.width===393&&__dailyBakery.height===852,1500);await advance(page,50);
  const after=held((await state(page)).bakery);delete before.tool;delete after.tool;
  ok(label+' resizing preserves every ingredient, shape and tray',equal(before,after),{before,after});
}
async function pourAndHelpChecks(page){
  await until(page,()=>__dailyBakery.power===0,14000);let g=(await state(page)).bakery;
  const ordinaryCatch=g.pourCatch,ordinaryJitter=g.pourJitter,off=pourPosition(g,ordinaryCatch*1.13),initial=batch(g).flour;
  await holdTool(page,off,380);g=(await state(page)).bakery;
  ok('an off-centre real pour spills and cannot fill the recipe for free',batch(g).flour===initial&&g.spilled>0&&g.completedGoals.length===0,{flour:batch(g).flour,spilled:g.spilled,assistance:g.assistance});
  const pose={x:g.tool.x,y:g.tool.y};await page.locator('#dailyHelp').click();requireCheck('the optional word earns steadier pouring',await sayWord(page),await state(page));g=(await state(page)).bakery;
  ok('speech widens the real catcher and reduces falling-stream jitter at the same pose',g.pourCatch>ordinaryCatch&&g.pourJitter<ordinaryJitter*.35&&equal({x:g.tool.x,y:g.tool.y},pose),{ordinaryCatch,ordinaryJitter,catch:g.pourCatch,jitter:g.pourJitter});
  await holdTool(page,off,380);g=(await state(page)).bakery;
  ok('the same manual pour now catches actual ingredient with the speech help',batch(g).flour>initial&&batch(g).flour<batch(g).flourTarget&&!batch(g).flourChecked,{flour:batch(g).flour,caught:g.caught});
  await until(page,()=>__dailyBakery.power===0,14000);g=(await state(page)).bakery;const partial=held(g);
  await page.locator('#dailyHelp').focus();await page.keyboard.press('Space');await until(page,()=>__sayplay.listening);
  ok('Space activates Help without changing the partial ingredient or tool position',(await state(page)).bakery.paused&&equal(held((await state(page)).bakery),partial));
  await page.locator('#helpBack').click();g=(await state(page)).bakery;
  ok('Back keeps the partial bowl and gives no extra power',!g.paused&&g.power===0&&equal(held(g),partial));
  await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);await until(page,()=>__sayplay.phase==='play',16000);g=(await state(page)).bakery;
  ok('silence in help returns to the same partial bowl without a free ingredient',!g.paused&&g.power===0&&equal(held(g),partial));
  await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);await page.evaluate(()=>__quiet.background());await advance(page,2500);g=(await state(page)).bakery;
  ok('backgrounding the help ask freezes the partial bowl and closes the microphone',g.paused&&equal(held(g),partial)&&await page.evaluate(()=>__quiet.live()===0));
  await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();g=(await state(page)).bakery;
  ok('resuming returns the earned bowl without another word',!g.paused&&g.power===0&&equal(held(g),partial));
  await holdTool(page,pourPosition(g),3400);g=(await state(page)).bakery;
  requireCheck('a real long pour can leave recoverable excess',batch(g).flour>batch(g).flourTarget+g.amountBand,batch(g));
  await page.locator('#bakeryAction').focus();await page.keyboard.press('Space');g=(await state(page)).bakery;
  ok('Space checks the real excess without approving it or finishing the job',!batch(g).flourChecked&&g.phase==='pourFlour'&&g.pourChecks>0,batch(g));
  await page.locator('#bakeryLevel').focus();await page.keyboard.press('Space');g=(await state(page)).bakery;
  ok('Space on the flat spoon manually trims excess and preserves the required flour',batch(g).flour===batch(g).flourTarget&&!batch(g).flourChecked&&g.levelUses===1,batch(g));
  await page.locator('#bakeryAction').focus();await page.keyboard.press('Space');g=(await state(page)).bakery;
  ok('the manual picture check accepts the recovered flour and still needs liquid',batch(g).flourChecked&&!batch(g).liquidChecked&&g.phase==='pourLiquid',batch(g));
}
async function bakeChecks(page,age){
  let g=(await state(page)).bakery;const step=g.stage;
  if(age==='7')await richLayouts(page,'oven');
  await drag(page,'#bakeryTray',g.oven,{cancel:true});g=(await state(page)).bakery;
  ok('cancelled tray placement cannot load the oven',batch(g).trayState==='staging'&&g.oven.batch===-1&&!g.pointer,g.pointer);
  await drag(page,'#bakeryTray',g.oven);await advance(page,6000);g=(await state(page)).bakery;
  ok('a tray in the oven waits for a real heat-control action',batch(g).trayState==='oven'&&!g.heat.touched&&batch(g).bake===0&&g.stage===step,{heat:g.heat,batch:batch(g)});
  await drag(page,'#bakeryTray',g.rack);g=(await state(page)).bakery;
  ok('moving an unbaked tray towards the rack cannot cool or finish it',batch(g).trayState==='oven'&&!batch(g).cooled&&g.ovenRemovals===0,batch(g));
  await page.locator('#bakeryHeat').focus();const previous=g.heat.setpoint;await page.keyboard.press('ArrowRight');g=(await state(page)).bakery;
  ok('the focused native heat range responds to an arrow key',g.heat.touched&&g.heat.setpoint>previous&&g.heat.touches===1,g.heat);
  await page.keyboard.press('End');await advance(page,5000);g=(await state(page)).bakery;const tooHot=batch(g).bake;await advance(page,2200);g=(await state(page)).bakery;
  ok('too-hot warmth pauses baking without losing the tray or awarding a job',!g.heat.useful&&batch(g).bake===tooHot&&!batch(g).baked&&g.stage===step&&g.completedGoals.length===step,{heat:g.heat,bake:batch(g).bake});
  await until(page,()=>__dailyBakery.power===0,14000);g=(await state(page)).bakery;const ordinary=g.heat.band;
  await heatTo(page,ordinary.high+.04);await advance(page,2600);g=(await state(page)).bakery;const notUseful=batch(g).bake;await advance(page,1200);g=(await state(page)).bakery;
  ok('a manually chosen temperature outside the ordinary golden picture does not bake',!g.heat.useful&&batch(g).bake===notUseful,{band:ordinary,heat:g.heat,bake:batch(g).bake});
  const saved=held(g);await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);g=(await state(page)).bakery;
  ok('oven help freezes every tray, ingredient and exact warmth while listening',g.paused&&equal(held(g),saved));
  const helpClock=await page.evaluate(()=>performance.now());requireCheck('the optional word earns a wider useful oven picture',await sayWord(page),await state(page));g=(await state(page)).bakery;const helpElapsed=(await page.evaluate(()=>performance.now())-helpClock)/1000;
  const resumed=held(g),steady=JSON.parse(JSON.stringify(saved));delete resumed.heat.actual;delete steady.heat.actual;resumed.batches.forEach(b=>delete b.bake);steady.batches.forEach(b=>delete b.bake);
  ok('speech widens useful heat while preserving all food and allowing resumed baking',g.heat.band.low<ordinary.low&&g.heat.band.high>ordinary.high&&g.heat.useful&&equal(resumed,steady)&&g.batches.every((b,i)=>i===g.oven.batch?b.bake>=saved.batches[i].bake&&b.bake-saved.batches[i].bake<=helpElapsed/g.heat.bakeSeconds+1e-8:b.bake===saved.batches[i].bake)&&Math.abs(g.heat.actual-g.heat.setpoint)<=Math.abs(saved.heat.actual-g.heat.setpoint)+1e-8,{ordinary,heat:g.heat,bake:batch(g).bake,savedBake:saved.batches[g.batch].bake,helpElapsed});
  await advance(page,300);g=(await state(page)).bakery;
  ok('the same manually chosen warmth now physically raises the buns',batch(g).bake>notUseful&&!batch(g).baked,{before:notUseful,bake:batch(g).bake,heat:g.heat});
  const partial=held(g);await page.evaluate(()=>__quiet.background());await advance(page,3000);g=(await state(page)).bakery;
  ok('a hidden page preserves partial baking, heat and all prepared batches',g.paused&&equal(held(g),partial)&&await page.evaluate(()=>__quiet.live()===0));
  await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();g=(await state(page)).bakery;
  ok('resuming keeps that same partially raised tray',!g.paused&&equal(held(g),partial));
  await heatTo(page,.56);await until(page,()=>__dailyBakery.batches[__dailyBakery.batch].baked,8000);g=(await state(page)).bakery;
  ok('golden buns still wait in the oven until a manual rack move',batch(g).baked&&!batch(g).cooled&&batch(g).trayState==='oven'&&g.ovenRemovals===0&&g.stage===step,batch(g));
  await page.screenshot({path:age==='3'?'/tmp/daily-bakery-younger.png':'/tmp/daily-bakery-phone.png'});
}
async function finishStage(page,step,{age,seen}){
  for(let turn=0;turn<90;turn++){
    let s=await state(page),g=s.bakery;if(s.speech.step>step)return true;if(!g.active){await advance(page,1100);continue;}
    const p=g.phase;
    if(p==='pourFlour'||p==='pourLiquid'){await pourIngredient(page);continue;}
    if(p==='mix'){
      if(!seen.has(p)){seen.add(p);const b=await page.locator('#bakeryTool').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await advance(page,1200);await page.mouse.up();g=(await state(page)).bakery;
        ok('holding the spoon still cannot stir ingredients into dough',batch(g).mix===0&&batch(g).sweep===0,batch(g));}
      await stroke(page,'#bakeryTool',ring(g.bowl,g.bowl.ringRadius,g.bowl.ringRadius*g.width/g.height,2,48),{stepMs:15});continue;
    }
    if(p.startsWith('shape')){
      let bun=currentBun(g);if(!bun)throw new Error('No actual dough piece in '+p);const selector='#bakeryBun'+bun.index;
      if(!seen.has(p)){
        seen.add(p);await page.locator(selector).click();await advance(page,1000);g=(await state(page)).bakery;bun=currentBun(g);
        ok('a tap and waiting cannot finish '+p,!bun.formed&&!bun.onTray&&!bun.well,bun);
        if(p==='shapeCurl'){await stroke(page,selector,[...g.board.tracePoints].reverse(),{stepMs:10});g=(await state(page)).bakery;bun=currentBun(g);ok('tracing backwards cannot finish the ordered curl',!bun.formed&&bun.trace<bun.traceRequired,bun);}
      }
      if(!bun.formed){
        if(p==='shapeCurl')await stroke(page,selector,g.board.tracePoints,{stepMs:15});
        else if(!bun.well)await stroke(page,selector,[...g.board.pressTargets,g.board.pressTargets[0]],{stepMs:30});
        g=(await state(page)).bakery;bun=currentBun(g);
        if(p==='shapeBerry'&&bun.well&&!bun.filled){
          if(!seen.has('spoonCancel')){seen.add('spoonCancel');await drag(page,'#bakeryTool',g.board,{cancel:true});g=(await state(page)).bakery;bun=currentBun(g);ok('cancelling the berry spoon keeps the real well but adds no filling',bun.well&&!bun.filled&&!bun.formed&&!g.pointer,bun);}
          await drag(page,'#bakeryTool',g.board);
        }
        g=(await state(page)).bakery;bun=currentBun(g);requireCheck('the real gesture forms '+p+' bun '+(bun.index+1),bun.formed&&(!p.endsWith('Berry')||bun.well&&bun.filled),bun);
      }
      if(!seen.has(p+'Image')){seen.add(p+'Image');await page.screenshot({path:path.join(OUT,'sona-daily-bakery-'+p+'-age'+age+'.png')});}
      if(!seen.has('bunCancel')){seen.add('bunCancel');await drag(page,selector,bun.slot,{cancel:true});g=(await state(page)).bakery;bun=currentBun(g);ok('pointer cancellation keeps the shaped bun on the board',bun.formed&&!bun.onTray&&!g.pointer,bun);}
      await drag(page,selector,bun.slot);continue;
    }
    if(p==='bake'){
      if(!seen.has(p)){seen.add(p);await bakeChecks(page,age);g=(await state(page)).bakery;}
      let b=batch(g);if(g.oven.batch>=0&&g.oven.batch!==g.batch){await page.locator('#bakeryBatch'+g.oven.batch).click();continue;}
      if(b.trayState==='staging'){await drag(page,'#bakeryTray',g.oven);continue;}
      if(b.trayState==='oven'&&!b.baked){await heatTo(page,.56);requireCheck('real useful warmth bakes tray '+(g.batch+1),await until(page,()=>__dailyBakery.batches[__dailyBakery.batch].baked,8500),await state(page));continue;}
      if(b.baked&&!b.cooled){await drag(page,'#bakeryTray',g.rack);continue;}
      const next=g.batches.find(v=>!v.cooled);if(next){await page.locator('#bakeryBatch'+next.index).click();continue;}throw new Error('All trays cooled but bake did not finish');
    }
    if(p==='arrange'){
      if(!seen.has(p)){
        seen.add(p);if(age==='7')await richLayouts(page,'baskets');g=(await state(page)).bakery;
        const bun=batch(g).buns.find(v=>!v.sorted),wrong=g.baskets[(g.batch+1)%3];
        for(let n=0;n<4;n++)await drag(page,'#bakeryBun'+bun.index,wrong);g=(await state(page)).bakery;
        ok('wrong-category basket drops stay wrong after repeated misses',!batch(g).buns[bun.index].sorted&&g.sortDrops===0&&g.stage===step&&g.assistance===2,{misses:g.misses,assistance:g.assistance,bun:batch(g).buns[bun.index]});
        await drag(page,'#bakeryBun'+bun.index,g.baskets[g.batch],{cancel:true});g=(await state(page)).bakery;
        ok('a cancelled basket drop cannot sort the finished bun',!batch(g).buns[bun.index].sorted&&g.sortDrops===0&&!g.pointer);
      }
      const bun=batch(g).buns.find(v=>!v.sorted);if(!bun)throw new Error('No unsorted bun in selected tray');await drag(page,'#bakeryBun'+bun.index,g.baskets[g.batch]);continue;
    }
    throw new Error('Unknown actual Bakery phase '+p);
  }
  return (await state(page)).speech.step>step;
}
async function playthrough(age,total){
  const {page,context,errors}=await boot({device:{age}});let s=await state(page),g=s.bakery;const initial=held(g),reps=await page.evaluate(()=>Sona.weekReps(0));
  ok('age '+age+' uses five/eight real bakery goals and three/four buns per batch',g.stages===total&&s.speech.steps===total&&g.batches.every(b=>b.buns.length===(total===5?3:4)),{stages:g.stages,steps:s.speech.steps,buns:g.batches.map(b=>b.buns.length)});
  ok('the bakery uses normal Premium catalog access',await page.evaluate(()=>{const a=Sona.gameAct('bakery');return Sona.gameAccess('bakery').allowed&&a.tier==='premium'&&a.say&&a.go==='/daily-adventure.html';}));
  await ask(page);await page.keyboard.press('ArrowRight');await advance(page,14000);s=await state(page);
  ok('silence, waiting and tool keys cannot create ingredients or a finished goal',s.speech.phase==='nudge'&&s.speech.step===0&&!s.bakery.active&&equal(held(s.bakery),initial)&&await page.evaluate(n=>Sona.weekReps(0)===n,reps),s.speech);
  await page.locator('#micBtn').click();requireCheck('two accepted sayings earn the actual bakery tools',await sayWord(page),await state(page));
  await pourAndHelpChecks(page);const seen=new Set();
  for(let step=0;step<total;step++){
    if(step)requireCheck('the actual word earns bakery goal '+(step+1)+' at age '+age,await sayWord(page),await state(page));
    requireCheck('physical cooking finishes bakery goal '+(step+1)+' at age '+age,await finishStage(page,step,{age,seen}),await state(page));
  }
  await until(page,()=>__sayplay.phase==='end',5000);s=await state(page);g=s.bakery;
  ok('all three real batches reach the earned breakfast at age '+age,s.speech.phase==='end'&&s.speech.step===total&&g.won&&g.completedGoals.length===total&&g.ovenRemovals===3&&g.sortDrops===(total===5?9:12)&&g.batches.every(b=>b.flourChecked&&b.liquidChecked&&b.mix===1&&b.baked&&b.cooled&&b.trayState==='rack'&&b.buns.every(v=>v.formed&&v.onTray&&v.sorted))&&g.manualDistance>300,{speech:s.speech,removals:g.ovenRemovals,sorted:g.sortDrops,batches:g.batches});
  ok('all three shaping mechanics required actual input',seen.has('shapeRound')&&seen.has('shapeCurl')&&seen.has('shapeBerry'));
  const audio=await audioAudit(page);ok('bakery instructions and chimes stay outside the microphone',audio.leaks===0&&audio.overlap===0&&audio.live===0,audio);
  ok('directions name physical actions without grading the child',audio.lines.some(t=>/bowl|dough|tray|bun|oven/i.test(t))&&!audio.lines.some(t=>/wrong|fail|score|points|correct/i.test(t)),audio.lines);
  ok('only accepted sayings count as play reps and no clinical outcome is recorded',await page.evaluate(({reps,total})=>Sona.weekReps(0)===reps+total*2+4&&Sona.weekReps(0,null,true)===0&&Object.keys(Sona.outcomes()).length===0,{reps,total}),await page.evaluate(()=>({reps:Sona.weekReps(0),outcomes:Sona.outcomes()})));
  await page.screenshot({path:path.join(OUT,'sona-daily-bakery-finished-age'+age+'.png')});await page.locator('#again').click();g=(await state(page)).bakery;
  ok('Play again clears food, heat and jobs and requires speech',g.stage===-1&&!g.active&&!g.won&&g.completedGoals.length===0&&g.oven.batch===-1&&!g.heat.touched&&g.sortDrops===0&&g.batches.every(b=>b.flour===0&&b.liquid===0&&b.mix===0&&!b.baked&&!b.cooled&&b.buns.every(v=>!v.formed&&!v.onTray&&!v.sorted)));
  ok('the whole Bakery path has no runtime errors at age '+age,errors.length===0,errors);await context.close();
}
try{
  harness=await dailyHarness({key:'bakery',port:8396});await accessChecks();
  for(const [age,total] of [['3',5],['7',8]])await playthrough(age,total);
  await deniedMicCheck();await layoutChecks();
}catch(error){if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:'/tmp/daily-bakery-failure.png'}).catch(()=>{});if(!failures)ok('the bakery suite completes without a page or harness crash',false,error.stack);else console.log('STOP '+error.message);}
finally{if(harness)await harness.close();}
console.log('Bakery: '+checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
