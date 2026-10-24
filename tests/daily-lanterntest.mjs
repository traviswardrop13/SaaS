// Day 8: connect real cords and switches to carry power to the woodland lamps.
// Speech uses the unchanged shared SayPlay listener.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {dailyHarness,advance,until,sayWord} from './_daily-adventure.mjs';
let harness,lastPage,checks=0,failures=0;
function ok(name,pass,detail){checks++;if(!pass){failures++;console.log('FAIL '+name+' '+String(JSON.stringify(detail)).slice(0,1900));}}
function requireCheck(name,pass,detail){ok(name,pass,detail);if(!pass)throw new Error(name);}
const state=page=>page.evaluate(()=>({speech:window.__sayplay,lantern:window.__dailyLantern}));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// one saying: a 280 ms burst of voice, as the shared sayWord makes each one
const burst=async page=>{await page.evaluate(()=>__quiet.voice=true);await advance(page,280);await page.evaluate(()=>__quiet.voice=false);};
const point=async(page,p)=>{const b=await page.locator('#dailyCanvas').boundingBox();return{x:b.x+p.x*b.width,y:b.y+p.y*b.height};};
async function boot(options={}){
  const r=await harness.fresh(options);lastPage=r.page;
  const ready=await until(r.page,()=>!!window.__dailyLantern&&!!window.__sayplay&&__sayplay.phase==='ready',2000);
  requireCheck('the real Lantern controller boots in the local host',ready,{errors:r.errors,phase:await r.page.locator('body').getAttribute('data-phase'),fixtureError:await r.page.locator('body').getAttribute('data-fixture-error')});
  return r;
}
async function ask(page){await page.locator('#startBtn').click();requireCheck('the shared speech turn starts',await until(page,()=>__sayplay.listening),await state(page));}
async function audioAudit(page){return page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));}
async function accessChecks(){
  for(const options of [{closed:true},{device:{premium:false,paid:true}}]){
    const {page,context,errors}=await harness.fresh(options);
    const home=await until(page,()=>/\/(today|activities)\.html$/.test(location.pathname),8000);
    const q=await page.evaluate(()=>({requests:__quiet.requests,sounds:__quiet.soundsBefore+__quiet.sounds.length}));
    ok(options.closed?'a parked Lantern goes Home through the real catalog gate':'an unentitled Lantern goes Home through the real Premium gate',home&&!page.url().includes('daily-adventure'),{url:page.url(),q});
    ok('closed access asks for no microphone and plays no sound',q.requests===0&&q.sounds===0,q);
    ok('the closed route has no runtime errors',errors.length===0,errors);await context.close();
  }
}
async function deniedMicCheck(){
  const {page,context,errors}=await boot({device:{age:'4',micok:false,permission:'prompt',micMode:'deny'}});
  await page.locator('#startBtn').click();await until(page,()=>document.getElementById('primer').classList.contains('show'),2500);await page.locator('#primerYes').click();
  const denied=await until(page,()=>!!document.getElementById('sonaMicDenied')&&__sayplay.phase==='denied',4000),s=await state(page);
  ok('a refused microphone shows shared help and starts no lantern job',denied&&s.speech.step===0&&!s.lantern.active&&await page.evaluate(()=>__quiet.live()===0&&Sona.weekReps(0)===0),s.speech);
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
  const fit=await screenRects(page),canvas=fit.rects.find(r=>r.selector==='#dailyCanvas'),help=fit.rects.find(r=>r.selector==='#dailyHelp'),controls=fit.rects.filter(r=>/^#lantern/.test(r.selector));
  ok(label+' controls fit the actual lantern canvas',inside(fit)&&controls.length>0&&controls.every(r=>inCanvas(r,canvas)),fit);
  ok(label+' controls retain 44 pixel targets and useful labels',controls.every(r=>r.w>=44&&r.h>=44&&r.label.length>0),controls);
  ok(label+' extra help remains clear of the physical controls',!!help&&controls.every(r=>!overlap(r,help)),fit);
}
const held=g=>({stage:g.stage,taskIndex:g.taskIndex,target:g.target,mode:g.mode,currentWire:g.currentWire,served:g.served,completedGoals:g.completedGoals,master:g.masterClosed,tripped:g.tripped,groups:g.groups.map(v=>({id:v.id,closed:v.closed,lit:v.lit,current:v.current,voltage:v.voltage,bulbs:v.bulbs})),wires:g.wires.map(w=>({id:w.id,ends:w.ends,points:w.points,connections:w.connections})),voltages:g.voltages});
const wiring=g=>g.wires.map(w=>({id:w.id,ends:w.ends,connections:w.connections}));
const lamp=(g,id=g.target)=>g.groups.find(v=>v.id===id);
const wire=(g,role,id=g.target)=>g.wires.find(w=>w.group===id&&w.role===role);
const terminal=(g,id)=>g.terminals.find(t=>t.id===id);
const socketId=id=>'#lanternSocket-'+id.replace(':','-');
async function choose(page,role,{space=false}={}){const selector='#lantern'+role[0].toUpperCase()+role.slice(1);if(space){await page.locator(selector).focus();await page.keyboard.press('Space');}else await page.locator(selector).click();}
async function dragEnd(page,role,n,to,{cancel=false}={}){
  await choose(page,role);const b=await page.locator('#lanternEnd'+n).boundingBox(),p=await point(page,to);
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(p.x,p.y,{steps:12});
  if(cancel){const id=(await state(page)).lantern.pointer.id;await page.locator('#lanternEnd'+n).evaluate((el,id)=>el.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:id})),id);}
  await page.mouse.up();await advance(page,30);
}
async function plug(page,role,n,id){let g=(await state(page)).lantern,target=g.target;await dragEnd(page,role,n,terminal(g,id));g=(await state(page)).lantern;requireCheck('a real '+role+' plug reaches '+id,wire(g,role,target).ends[n]===id,{target,role,end:n,wire:wire(g,role,target),pointer:g.pointer});}
async function connect(page,role){let g=(await state(page)).lantern,target=g.target,pair=g.suggested[role];for(let n=0;n<2;n++){g=(await state(page)).lantern;if(wire(g,role,target).ends[n]!==pair[n])await plug(page,role,n,pair[n]);}g=(await state(page)).lantern;requireCheck('both physical '+role+' plugs are connected for '+target,wire(g,role,target).complete,wire(g,role,target));}
async function switchTo(page,id,closed,{space=false}={}){let g=(await state(page)).lantern;if(lamp(g,id).closed===closed)return;const selector='#lanternSwitch-'+id;if(space){await page.locator(selector).focus();await page.keyboard.press('Space');}else await page.locator(selector).click();await advance(page,30);}
async function helpAndCatch(page){
  let g=(await state(page)).lantern;const id=g.target,pair=g.suggested.return;
  await dragEnd(page,'return',0,terminal(g,pair[0]),{cancel:true});g=(await state(page)).lantern;
  ok('pointer cancellation cannot attach a cord end or light the first lamp',wire(g,'return').ends.every(v=>v===null)&&!lamp(g).lit&&!g.pointer,wire(g,'return'));
  await plug(page,'return',0,pair[0]);g=(await state(page)).lantern;
  const empty={x:.5,y:(g.height-130)/g.height};for(let n=0;n<4;n++)await dragEnd(page,'return',1,empty);g=(await state(page)).lantern;
  ok('repeated missed sockets never fill a gap or finish a circuit',g.assistance===2&&wire(g,'return').ends[1]===null&&!lamp(g).lit&&g.served.length===0,{misses:g.misses,return:wire(g,'return'),lamp:lamp(g)});
  await until(page,()=>__dailyLantern.power===0,14000);g=(await state(page)).lantern;
  const ordinary=g.catchRadius,t=terminal(g,pair[1]),off={x:t.x,y:t.y-ordinary*1.12*g.width/g.height};
  const nearest=[...g.terminals].sort((a,b)=>Math.hypot((a.x-off.x)*g.width,(a.y-off.y)*g.height)-Math.hypot((b.x-off.x)*g.width,(b.y-off.y)*g.height))[0];
  requireCheck('the catch test aims just outside the intended socket, clear of neighbours',nearest.id===pair[1]&&off.y*g.height<g.height-112,{nearest:nearest.id,target:pair[1],off,ordinary});
  await dragEnd(page,'return',1,off);g=(await state(page)).lantern;
  ok('the same deliberate offset misses the ordinary socket catch',wire(g,'return').ends[1]===null&&g.catchRadius===ordinary&&!lamp(g).lit,{wire:wire(g,'return'),catch:g.catchRadius});
  const partial=held(g);await page.locator('#dailyHelp').focus();await page.keyboard.press('Space');await until(page,()=>__sayplay.listening);g=(await state(page)).lantern;const pulseTime=g.pulse.time;await advance(page,700);
  ok('Space opens Help and freezes the same half-wired loop and pulse',g.paused&&equal(held((await state(page)).lantern),partial)&&(await state(page)).lantern.pulse.time===pulseTime);
  await page.locator('#helpBack').click();g=(await state(page)).lantern;
  ok('Back returns that exact partial circuit without speech power',!g.paused&&g.power===0&&equal(held(g),partial));
  await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);await until(page,()=>__sayplay.phase==='play',16000);g=(await state(page)).lantern;
  ok('quiet help gives no wire, switch or light for free',!g.paused&&g.power===0&&equal(held(g),partial));
  await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);await page.evaluate(()=>__quiet.background());await advance(page,2500);g=(await state(page)).lantern;
  ok('backgrounding Help retains all plugs, switches and voltages and closes the mic',g.paused&&equal(held(g),partial)&&await page.evaluate(()=>__quiet.live()===0));await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();g=(await state(page)).lantern;
  ok('resuming keeps the earned partial wiring without another word',!g.paused&&g.power===0&&equal(held(g),partial));
  await page.locator('#dailyHelp').click();requireCheck('a real optional saying earns tracing light and easier sockets',await sayWord(page),await state(page));g=(await state(page)).lantern;
  ok('speech enlarges the actual catch while preserving all physical circuit state',Math.abs(g.catchRadius-ordinary*1.4)<1e-8&&g.pulse.active&&equal(held(g),partial),{ordinary,catch:g.catchRadius,pulse:g.pulse});
  const edge=g.pulse.edges.find(e=>e.type==='wire'&&e.id===id+'-supply'),png=await page.screenshot();await advance(page,350);const later=(await state(page)).lantern,edgeLater=later.pulse.edges.find(e=>e.id===id+'-supply'),pngLater=await page.screenshot();
  ok('a visible pulse travels along the real joined supply and reaches its live socket',!!edge&&!!edgeLater&&Math.abs(edgeLater.position-edge.position)>.01&&!png.equals(pngLater)&&later.pulse.reachable.includes('source:plus')&&later.pulse.reachable.includes(id+':in')&&!later.pulse.reachable.includes('source:minus')&&!lamp(later).lit,{edge,edgeLater,reachable:later.pulse.reachable});
  await dragEnd(page,'return',1,off);g=(await state(page)).lantern;
  ok('the identical real drop connects after spoken catch help, without closing the switch',wire(g,'return').ends[1]===pair[1]&&wire(g,'return').complete&&!lamp(g).closed&&!lamp(g).lit,{wire:wire(g,'return'),lamp:lamp(g)});
}
async function firstLoop(page){
  let g=(await state(page)).lantern,id=g.target;if(!wire(g,'supply').complete)await connect(page,'supply');g=(await state(page)).lantern;
  requireCheck('the first supply reaches the actual lamp input',wire(g,'supply').complete&&!wire(g,'return').complete,wire(g,'supply'));
  await switchTo(page,id,true,{space:true});g=(await state(page)).lantern;
  ok('a closed switch with open return is electrically dark, despite adjacency',lamp(g,id).closed&&!lamp(g,id).lit&&lamp(g,id).current<1e-6&&lamp(g,id).voltage<1e-6&&!g.tripped,{lamp:lamp(g,id),wire:wire(g,'return')});
  await switchTo(page,id,false);await helpAndCatch(page);g=(await state(page)).lantern;
  await plug(page,'test',0,id+':in');await plug(page,'test',1,id+':out');g=(await state(page)).lantern;
  ok('a real conductor bypassing the bulb trips the source and keeps lamps dark',g.tripped&&wire(g,'test').complete&&!lamp(g,id).lit&&g.groups.filter(v=>v.id!=='source').every(v=>v.current<1e-6&&!v.lit),{lamp:lamp(g,id),test:wire(g,'test'),tripped:g.tripped});
  await switchTo(page,id,true,{space:true});g=(await state(page)).lantern;const fault=held(g);await advance(page,2500);g=(await state(page)).lantern;
  ok('closing the switch, waiting and speech pulse cannot repair a bulb bypass',g.tripped&&!lamp(g,id).lit&&g.served.length===0&&equal(held(g),fault));
  await choose(page,'test',{space:true});await page.locator('#lanternUndo').focus();await page.keyboard.press('Space');g=(await state(page)).lantern;
  requireCheck('Space on Lift end manually removes the short and powers the true closed loop',!g.tripped&&!wire(g,'test',id).complete&&wire(g,'supply',id).complete&&wire(g,'return',id).complete&&lamp(g,id).closed&&lamp(g,id).lit&&lamp(g,id).current>.04&&lamp(g,id).voltage>.04&&g.served.includes(id)&&g.undoUses===1,{lamp:lamp(g,id),test:wire(g,'test',id),served:g.served});
}
async function sharedCheck(page){
  let g=(await state(page)).lantern,shared=g.groups.find(v=>v.kind==='shared');const beforeWires=wiring(g),step=g.stage;
  const descends=id=>{let v=lamp(g,id);while(v&&v.parent){if(v.parent===shared.id)return true;v=lamp(g,v.parent);}return false;};
  const dependent=g.groups.filter(v=>v.lit&&(v.id===shared.id||descends(v.id))).map(v=>v.id),others=g.groups.filter(v=>v.id!=='source'&&v.lit&&!dependent.includes(v.id)).map(v=>v.id);
  requireCheck('the shared switch has a genuinely powered lamp branch',shared.closed&&dependent.length>=1&&others.length>=1,{shared,dependent,others});
  await switchTo(page,shared.id,false);g=(await state(page)).lantern;
  await page.screenshot({path:'/tmp/daily-lantern-branch-off-'+g.stages+'.png'});
  ok('opening the shared switch removes actual branch current while other loops stay lit',dependent.every(id=>!lamp(g,id).lit&&lamp(g,id).current<1e-6)&&others.every(id=>lamp(g,id).lit)&&equal(wiring(g),beforeWires)&&g.stage===step,{dependent:dependent.map(id=>lamp(g,id)),others:others.map(id=>lamp(g,id))});
  await switchTo(page,shared.id,true);g=(await state(page)).lantern;
  await page.screenshot({path:'/tmp/daily-lantern-branch-on-'+g.stages+'.png'});
  ok('a manual shared-switch correction restores the same wired branch',dependent.every(id=>lamp(g,id).lit)&&equal(wiring(g),beforeWires)&&!lamp(g,'great').lit);
}
async function finishStage(page,step,{seen}){
  for(let turn=0;turn<25;turn++){
    let s=await state(page),g=s.lantern;if(s.speech.step>step)return true;if(!g.active){await advance(page,1000);continue;}
    if(g.phase==='feed'){
      await connect(page,'supply');g=(await state(page)).lantern;
      ok('the older supply-only goal completes while the bulb and return remain unpowered',!lamp(g,'first').lit&&lamp(g,'first').current<1e-6&&!wire(g,'return','first').complete&&g.completedGoals.includes(0),{lamp:lamp(g,'first'),return:wire(g,'return','first')});continue;
    }
    if(g.target==='first'&&!seen.has('first')){seen.add('first');await firstLoop(page);continue;}
    if(g.target==='great'&&!seen.has('shared')){seen.add('shared');await sharedCheck(page);g=(await state(page)).lantern;}
    const target=g.target;await connect(page,'supply');await connect(page,'return');g=(await state(page)).lantern;
    if(g.active&&g.target===target&&!lamp(g,target).closed)await switchTo(page,target,true);
    g=(await state(page)).lantern;requireCheck('real terminal voltage and current power '+target,lamp(g,target).lit&&lamp(g,target).current>.04&&lamp(g,target).voltage>.04&&g.served.includes(target),lamp(g,target));
  }
  return (await state(page)).speech.step>step;
}
async function richLayouts(page){
  let g=(await state(page)).lantern;const original={stage:g.stage,served:g.served,completed:g.completedGoals,wires:wiring(g),groups:g.groups.map(v=>({id:v.id,closed:v.closed,lit:v.lit,current:v.current}))};
  for(const viewport of [{width:320,height:568},{width:393,height:852},{width:768,height:1024},{width:1024,height:768}]){
    await page.setViewportSize(viewport);requireCheck('the circuit canvas finishes native resize',await until(page,()=>{const r=document.getElementById('dailyCanvas').getBoundingClientRect();return Math.abs(__dailyLantern.width-r.width)<.5&&Math.abs(__dailyLantern.height-r.height)<.5;},1500),await state(page));await advance(page,50);
    const tag=viewport.width+'x'+viewport.height;await fitControls(page,'connected circuit '+tag);await page.screenshot({path:path.join(OUT,'sona-daily-lantern-connected-'+tag+'.png')});
  }
  await page.setViewportSize({width:393,height:852});await until(page,()=>__dailyLantern.width===393&&__dailyLantern.height===852,1500);g=(await state(page)).lantern;
  ok('resizing retains each real plug, switch, powered branch and earned job',equal({stage:g.stage,served:g.served,completed:g.completedGoals,wires:wiring(g),groups:g.groups.map(v=>({id:v.id,closed:v.closed,lit:v.lit,current:v.current}))},original));
}
async function layoutChecks(){
  for(const viewport of [{width:320,height:568},{width:393,height:852},{width:768,height:1024},{width:1024,height:768}]){
    const tag=viewport.width+'x'+viewport.height,{page,context,errors}=await boot({viewport});await ask(page);let fit=await screenRects(page);ok('the lantern word and Hear it fit '+tag,inside(fit)&&fit.rects.some(r=>r.selector==='#hear'&&r.h>=44),fit);
    requireCheck('speech opens the real circuit controls '+tag,await sayWord(page),await state(page));await fitControls(page,'lantern '+tag);
    ok('cord choice and recovery have nonreader pictograms '+tag,await page.locator('#lanternSupply,#lanternReturn,#lanternTest,#lanternUndo').evaluateAll(es=>es.every(e=>!!e.querySelector('svg'))));await page.screenshot({path:path.join(OUT,'sona-daily-lantern-'+tag+'.png')});
    await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);fit=await screenRects(page);ok('lantern Help and Back fit '+tag,inside(fit)&&fit.rects.some(r=>r.selector==='#helpBack'&&r.w>=44&&r.h>=44),fit);await page.locator('#helpBack').click();ok('lantern layout has no runtime errors '+tag,errors.length===0,errors);await context.close();
  }
  const {page,context}=await boot({viewport:{width:568,height:320}});ok('a landscape phone keeps the shared portrait guard',await page.locator('#sonaPortraitGuard').isVisible());await context.close();
}
async function playthrough(age,total){
  const {page,context,errors}=await boot({device:{age}});let s=await state(page),g=s.lantern,initial=held(g),reps=await page.evaluate(()=>Sona.weekReps(0));
  requireCheck('painted lamp props load for real play at age '+age,await until(page,()=>!!__dailyLantern.presentation&&__dailyLantern.presentation.paintedMushrooms&&__dailyLantern.presentation.paintedGreat,2000),g.presentation);
  ok('age '+age+' has the five/eight real circuit goals and matching world',g.stages===total&&s.speech.steps===total&&g.groups.length===(total===5?6:9),{stages:g.stages,steps:s.speech.steps,groups:g.groups.length});
  ok('Lantern uses normal Premium catalog access',await page.evaluate(()=>{const a=Sona.gameAct('lantern');return Sona.gameAccess('lantern').allowed&&a.tier==='premium'&&a.say&&a.go==='/daily-adventure.html';}));
  await ask(page);await page.keyboard.press('ArrowRight');await advance(page,14000);s=await state(page);ok('silence and socket keys cannot join cords, close switches or light a lamp',s.speech.phase==='nudge'&&s.speech.step===0&&!s.lantern.active&&equal(held(s.lantern),initial)&&await page.evaluate(n=>Sona.weekReps(0)===n,reps),s.speech);
  // Every story game asks Sona.STORY_SAY_TIMES sayings a word (Travis, 23 Oct
  // 2026: "say the sound 3 times not twice for every daily game"), so the first
  // word is said one burst at a time here: the sayings before the last are
  // kept and counted down, and only the last earns the cords.
  await page.locator('#micBtn').click();requireCheck('the mic listens again for the first word at age '+age,await until(page,()=>__sayplay.listening),await state(page));
  const times=await page.evaluate(()=>({page:__sayplay.times,story:Sona.STORY_SAY_TIMES}));
  ok('Lantern asks the story count, three sayings a word, at age '+age,times.page===times.story&&times.story===3,times);
  await advance(page,150);
  for(let n=1;n<times.page;n++){
    if(n>1)await advance(page,650);await burst(page);await advance(page,650);s=await state(page);
    const left=times.page-n,status=await page.locator('#micState').textContent();
    ok('saying '+n+' of '+times.page+' is kept and earns no cord at age '+age,s.speech.said===n&&s.speech.step===0&&s.speech.phase!=='play'&&!s.lantern.active&&equal(held(s.lantern),initial)&&status===left+' more '+(left===1?'time':'times')+'!',{speech:s.speech,status});
  }
  await burst(page);
  requireCheck('only the last of the '+times.page+' sayings earns the real cord controls at age '+age,await until(page,()=>__sayplay.phase==='play'),await state(page));const seen=new Set();
  for(let step=0;step<total;step++){
    if(step)requireCheck('the shared word earns Lantern goal '+(step+1)+' at age '+age,await sayWord(page),await state(page));g=(await state(page)).lantern;
    if(g.target==='great'){
      if(age==='7')await richLayouts(page);g=(await state(page)).lantern;await page.screenshot({path:age==='3'?'/tmp/daily-lantern-younger.png':'/tmp/daily-lantern-phone.png'});
      const before=held(g);await choose(page,'supply');const b=await page.locator('#lanternEnd0').boundingBox(),p=await point(page,terminal(g,g.suggested.supply[0]));await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(p.x,p.y);
      await page.evaluate(()=>__quiet.background());await advance(page,2000);g=(await state(page)).lantern;
      ok('backgrounding a carried plug preserves every existing circuit without attaching it',g.paused&&!g.pointer&&equal(held(g),before));await page.mouse.up();await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();g=(await state(page)).lantern;
      ok('resuming restores the same unfinished great-lantern circuit',!g.paused&&equal(held(g),before));
    }
    requireCheck('physical closed-loop work finishes Lantern goal '+(step+1)+' at age '+age,await finishStage(page,step,{seen}),await state(page));
  }
  await until(page,()=>__sayplay.phase==='end',5000);s=await state(page);g=s.lantern;const lamps=g.groups.filter(v=>v.id!=='source');
  ok('all real powered loops earn the great-lantern ending at age '+age,s.speech.phase==='end'&&s.speech.step===total&&g.won&&g.completedGoals.length===total&&g.served.length===lamps.length&&lamps.every(v=>v.closed&&v.lit&&v.current>.04&&v.voltage>.04&&v.bulbs.every(a=>a>.04))&&g.masterClosed&&!g.tripped&&g.connections>=lamps.length*4&&g.manualDistance>500,{speech:s.speech,served:g.served,lamps});
  const audio=await audioAudit(page);ok('all circuit speech and chimes stay outside the microphone',audio.leaks===0&&audio.overlap===0&&audio.live===0,audio);ok('directions explain actions without grading the child',audio.lines.some(t=>/cord|socket|lamp|switch/i.test(t))&&!audio.lines.some(t=>/wrong|fail|score|points|correct/i.test(t)),audio.lines);
  // each heard saying is one play rep: every goal's word and the one optional
  // help word, each said __sayplay.times times (three since 23 Oct 2026)
  ok('accepted sayings count only as play reps with no clinical outcomes',await page.evaluate(({reps,total})=>Sona.weekReps(0)===reps+(total+1)*__sayplay.times&&Sona.weekReps(0,null,true)===0&&Object.keys(Sona.outcomes()).length===0,{reps,total}),await page.evaluate(()=>({reps:Sona.weekReps(0),outcomes:Sona.outcomes()})));
  await page.screenshot({path:path.join(OUT,'sona-daily-lantern-finished-age'+age+'.png')});await page.locator('#again').click();g=(await state(page)).lantern;
  ok('Play again clears plugs, lamp switches and progress and requires speech',g.stage===-1&&!g.active&&!g.won&&g.served.length===0&&g.completedGoals.length===0&&g.wires.every(w=>w.ends.every(e=>e===null))&&g.groups.filter(v=>v.id!=='source').every(v=>!v.closed&&!v.lit));
  ok('the full circuit path has no runtime errors at age '+age,errors.length===0,errors);await context.close();
}
try{harness=await dailyHarness({key:'lantern',port:8398});await accessChecks();for(const [age,total] of [['3',5],['7',8]])await playthrough(age,total);await deniedMicCheck();await layoutChecks();}
catch(error){if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:'/tmp/daily-lantern-failure.png'}).catch(()=>{});if(!failures)ok('the lantern suite completes without a page or harness crash',false,error.stack);else console.log('STOP '+error.message);}
finally{if(harness)await harness.close();}
console.log('Lantern: '+checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
