// Day 5 uses the real SayPlay listener and native steering/cargo controls.
// Read-only snapshots locate the boat, docks, channels and articulated raft.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {dailyHarness,advance,until,sayWord} from './_daily-adventure.mjs';
let harness,lastPage,checks=0,failures=0;
function ok(name,pass,detail){checks++;if(!pass){failures++;console.log('FAIL '+name+' '+String(JSON.stringify(detail)).slice(0,1900));}}
function requireCheck(name,pass,detail){ok(name,pass,detail);if(!pass)throw new Error(name);}
const state=page=>page.evaluate(()=>({speech:window.__sayplay,boat:window.__dailyPostboat}));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const held=g=>({stage:g.stage,objective:g.objective,subtask:g.subtask,boat:g.boat&&{x:g.boat.x,y:g.boat.y,heading:g.boat.heading,moored:g.boat.moored},raft:g.raft&&{x:g.raft.x,y:g.raft.y,heading:g.raft.heading,attached:g.raft.attached},cargo:g.cargo,delivered:g.delivered,transfer:g.transfer,completedGoals:g.completedGoals});
const point=async(page,p)=>{const r=await page.locator('#dailyCanvas').boundingBox();return{x:r.x+p.x*r.width,y:r.y+p.y*r.height};};
const magnitude=v=>Math.hypot(v.x,v.y);
async function boot(options={}){
  const r=await harness.fresh(options);lastPage=r.page;
  const ready=await until(r.page,()=>!!window.__dailyPostboat&&!!window.__sayplay&&__sayplay.phase==='ready',2000);
  requireCheck('the real Postboat controller boots in the local host',ready,{errors:r.errors,phase:await r.page.locator('body').getAttribute('data-phase'),fixtureError:await r.page.locator('body').getAttribute('data-fixture-error')});
  return r;
}
async function ask(page){await page.locator('#startBtn').click();requireCheck('the shared speech turn starts',await until(page,()=>__sayplay.listening),await state(page));}
async function audioAudit(page){return page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));}
async function accessChecks(){
  for(const options of [{closed:true},{device:{premium:false,paid:true}}]){
    const {page,context,errors}=await harness.fresh(options);
    const home=await until(page,()=>/\/(today|activities)\.html$/.test(location.pathname),8000);
    const q=await page.evaluate(()=>({requests:__quiet.requests,sounds:__quiet.soundsBefore+__quiet.sounds.length}));
    ok(options.closed?'a parked Postboat goes Home through the real catalog gate':'an unentitled Postboat goes Home through the real Premium gate',home&&!page.url().includes('daily-adventure'),{url:page.url(),q});
    ok('closed access opens no microphone and plays no sound',q.requests===0&&q.sounds===0,q);
    ok('the closed route has no runtime errors',errors.length===0,errors);await context.close();
  }
}
async function deniedMicCheck(){
  const {page,context,errors}=await boot({device:{age:'4',micok:false,permission:'prompt',micMode:'deny'}});
  await page.locator('#startBtn').click();await until(page,()=>document.getElementById('primer').classList.contains('show'),2500);await page.locator('#primerYes').click();
  const denied=await until(page,()=>!!document.getElementById('sonaMicDenied')&&__sayplay.phase==='denied',4000);
  const s=await state(page);
  ok('a refused microphone shows the shared help screen and grants no delivery',denied&&s.speech.step===0&&s.boat.cargo.length===0&&s.boat.completedGoals.length===0&&await page.evaluate(()=>__quiet.live()===0&&Sona.weekReps(0)===0),s.speech);
  ok('the refused microphone path has no runtime errors',errors.length===0,errors);await context.close();
}
async function screenRects(page){return page.evaluate(()=>{
  const selectors=['#dailyCanvas','#top','#dailyBanner','#dailyHelp','#postboatUp','#postboatLeft','#postboatDown','#postboatRight','#postboatStop','#postboatAction','#postboatBoat','#turnPanel','#hear','#word','#helpBack'];
  const rects=[];
  for(const selector of selectors)for(const el of document.querySelectorAll(selector)){
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    if(el.hidden||s.display==='none'||s.visibility==='hidden'||!r.width||!r.height)continue;
    rects.push({selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height});
  }
  return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,rects};
});}
const inside=f=>f.scroll<=f.height+1&&f.rects.every(r=>r.x>=-.5&&r.y>=-.5&&r.right<=f.width+.5&&r.bottom<=f.height+.5);
const overlap=(a,b)=>a.x<b.right&&b.x<a.right&&a.y<b.bottom&&b.y<a.bottom;
async function layoutChecks(){
  for(const viewport of [{width:320,height:568},{width:393,height:852},{width:768,height:1024},{width:1024,height:768}]){
    const tag=viewport.width+'x'+viewport.height,{page,context,errors}=await boot({viewport});await ask(page);let fit=await screenRects(page);
    ok('the isolated word and Hear it fit '+tag,inside(fit)&&fit.rects.find(r=>r.selector==='#hear').h>=44,fit);
    requireCheck('the spoken word opens real boat controls at '+tag,await sayWord(page),await state(page));fit=await screenRects(page);
    const controls=fit.rects.filter(r=>/^#postboat/.test(r.selector)),help=fit.rects.find(r=>r.selector==='#dailyHelp');
    ok('the boat, action and steering controls fit '+tag,inside(fit)&&controls.length===7,fit);
    ok('the actual boat controls remain at least 44 pixels '+tag,controls.every(r=>r.w>=44&&r.h>=44),fit);
    ok('the help button does not cover steering or cargo controls '+tag,controls.filter(r=>r.selector!=='#postboatBoat').every(r=>!overlap(r,help)),fit);
    await page.screenshot({path:path.join(OUT,'sona-daily-postboat-'+tag+'.png')});
    await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);fit=await screenRects(page);
    ok('optional help and Back to the game fit '+tag,inside(fit)&&fit.rects.some(r=>r.selector==='#helpBack'&&r.w>=44&&r.h>=44),fit);
    await page.screenshot({path:path.join(OUT,'sona-daily-postboat-help-'+tag+'.png')});
    await page.locator('#helpBack').click();ok('layout play has no runtime errors '+tag,errors.length===0,errors);await context.close();
  }
  const {page,context}=await boot({viewport:{width:568,height:320}});
  ok('a landscape phone keeps the existing portrait guard',await page.locator('#sonaPortraitGuard').isVisible());await context.close();
}
const px=(g,p)=>({x:p.x*g.width,y:p.y*g.height});
const normal=(g,p)=>({x:p.x/g.width,y:p.y/g.height});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function insidePoly(p,points){let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return dist(p,{x:a.x+u*dx,y:a.y+u*dy});}
function navigation(g,radius=14){
  const bounds={x:g.map.x*g.width,y:g.map.y*g.height,w:g.map.width*g.width,h:g.map.height*g.height};
  const solids=g.solids.map(s=>s.points?{points:s.points.map(p=>px(g,p))}:{x:s.x*g.width,y:s.y*g.height,rx:s.rx*g.width,ry:s.ry*g.height});
  const free=p=>p.x>=bounds.x+radius&&p.x<=bounds.x+bounds.w-radius&&p.y>=bounds.y+radius&&p.y<=bounds.y+bounds.h-radius&&!solids.some(s=>s.points?insidePoly(p,s.points)||s.points.some((a,i)=>segmentDistance(p,a,s.points[(i+1)%s.points.length])<radius):((p.x-s.x)/(s.rx+radius))**2+((p.y-s.y)/(s.ry+radius))**2<1);
  const clear=(a,b)=>{const n=Math.max(1,Math.ceil(dist(a,b)/5));for(let i=0;i<=n;i++)if(!free({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;return true;};
  return{bounds,free,clear};
}
// The test plans around the visible published banks, then drives those points
// with actual boat thrust. Planning never changes the boat or game progress.
function pathTo(g,target,{radius=14}={}){
  const nav=navigation(g,radius),from=px(g,g.boat),to=px(g,target);if(nav.clear(from,to))return[target];
  const cell=10,nx=Math.ceil(nav.bounds.w/cell)+1,ny=Math.ceil(nav.bounds.h/cell)+1;
  const at=(x,y)=>({x:nav.bounds.x+x*cell,y:nav.bounds.y+y*cell}),id=(x,y)=>y*nx+x;
  const nearest=p=>{let best=null,d=Infinity;for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const q=at(x,y),n=dist(p,q);if(n<d&&nav.free(q)){d=n;best={x,y};}}return best;};
  const start=nearest(from),end=nearest(to);if(!start||!end)throw new Error('No open-water navigation nodes');
  const startId=id(start.x,start.y),endId=id(end.x,end.y),open=[startId],cost=new Map([[startId,0]]),parent=new Map(),closed=new Set();
  while(open.length){let bi=0,bf=Infinity;for(let i=0;i<open.length;i++){const k=open[i],f=cost.get(k)+dist(at(k%nx,Math.floor(k/nx)),at(end.x,end.y));if(f<bf){bf=f;bi=i;}}
    const current=open.splice(bi,1)[0];if(current===endId){const route=[];let k=current;while(k!==startId){route.unshift(at(k%nx,Math.floor(k/nx)));k=parent.get(k);}const simplified=[];let here=from;while(route.length){let last=0;for(let i=0;i<route.length;i++){if(nav.clear(here,route[i]))last=i;else break;}const q=route[last];simplified.push(normal(g,q));here=q;route.splice(0,last+1);}if(nav.clear(here,to))simplified.push(target);return simplified;}
    closed.add(current);const cx=current%nx,cy=Math.floor(current/nx);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=cx+dx,y=cy+dy,k=id(x,y);if(x<0||y<0||x>=nx||y>=ny||closed.has(k)||!nav.clear(at(cx,cy),at(x,y)))continue;const next=cost.get(current)+Math.hypot(dx,dy)*cell;if(next<(cost.get(k)??Infinity)){cost.set(k,next);parent.set(k,current);if(!open.includes(k))open.push(k);}}
  }
  throw new Error('No open-water path to '+JSON.stringify(target));
}
async function paddleLeg(page,target,{radius=8,max=25000}={}){
  let g=(await state(page)).boat,at=await point(page,g.boat),to=await point(page,target),last=Infinity,stuck=0;
  await page.mouse.move(at.x,at.y);await page.mouse.down();await page.mouse.move(to.x,to.y);
  try{for(let t=0;t<max;t+=200){await advance(page,200);g=(await state(page)).boat;const d=dist(px(g,g.boat),px(g,target));if(d<=radius)return true;if(Math.abs(last-d)<.2)stuck++;else stuck=0;if(stuck>30)break;last=d;}}
  finally{await page.mouse.up();if(await page.locator('#postboatStop').isEnabled())await page.locator('#postboatStop').click();}
  return false;
}
async function steerTo(page,target,options={}){const g=(await state(page)).boat;for(const waypoint of pathTo(g,target,{radius:options.clearance??14}))if(!await paddleLeg(page,waypoint,options))throw new Error('Thrust could not reach '+JSON.stringify({waypoint,boat:(await state(page)).boat.boat,goal:(await state(page)).boat.objective}));}
async function approachDock(page,dock){
  let g=(await state(page)).boat;if(g.boat.moored===g.objective.station||g.stations[g.objective.station].canDock)return;
  const nav=navigation(g,14),target=px(g,dock);let approach;
  approaches:for(const length of [38,26,18])for(const turn of [0,.6,-.6,.9,-.9]){const a=dock.heading+turn,p={x:target.x-Math.cos(a)*length,y:target.y-Math.sin(a)*length};if(nav.free(p)&&nav.clear(p,target)){approach=normal(g,p);break approaches;}}
  if(approach)await steerTo(page,approach);await paddleLeg(page,dock,{radius:Math.max(8,dock.r*g.width*.35)});
  for(let n=0;n<12;n++){
    g=(await state(page)).boat;if(g.boat.moored===g.objective.station||g.stations[g.objective.station].canDock)return;
    // A short real paddle changes the bow; Stop keeps that new heading.
    const desired={x:g.boat.x+Math.cos(dock.heading)*.18,y:g.boat.y+Math.sin(dock.heading)*.18*g.width/g.height};
    const start=await point(page,g.boat),to=await point(page,desired);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(to.x,to.y);await advance(page,130);await page.mouse.up();await page.locator('#postboatStop').click();
    if(dist(px(g,g.boat),px(g,dock))>dock.r*g.width*.85)await paddleLeg(page,dock,{radius:dock.r*g.width*.45});
  }
  throw new Error('A real approach cannot dock '+JSON.stringify((await state(page)).boat));
}
async function finishStage(page,step,{beforeDoor}={}){
  let landingApproach=false,landingWaits=0;
  for(let turn=0;turn<35;turn++){
    let s=await state(page),g=s.boat;if(s.speech.step>step)return true;if(!g.active){await advance(page,1100);continue;}if(g.transfer){await advance(page,500);continue;}
    const t=g.objective;if(!t)throw new Error('No physical Postboat task');
    if(t.waypoints.length){
      if(t.index<t.waypoints.length){const target=t.waypoints[t.index];if(t.type==='route'&&t.index>0)await paddleLeg(page,target,{radius:8});else await steerTo(page,target,{radius:t.type==='route'?8:18,clearance:14});await advance(page,150);}
      else if(g.action.enabled){await page.locator('#postboatAction').click();await advance(page,150);}
      else {await paddleLeg(page,t.waypoints.at(-1),{radius:8});await advance(page,600);}
      continue;
    }
    if(t.type==='deliverRaft'&&!landingApproach){
      // The raft needs a long straight approach, not just a boat-sized dock
      // correction. Paddle west first, then pull the whole tow eastward.
      for(const approach of t.approach)await steerTo(page,approach,{radius:18});
      await paddleLeg(page,g.targetDock,{radius:8});landingApproach=true;g=(await state(page)).boat;
    }
    if(!g.action.enabled&&g.boat.moored===t.station){await advance(page,600);if(t.type==='deliverRaft'&&++landingWaits>=5){landingApproach=false;landingWaits=0;}continue;}
    if(!g.action.enabled){await approachDock(page,g.targetDock);g=(await state(page)).boat;}
    if(t.type==='deliverRaft'&&beforeDoor)await beforeDoor(page,g);
    if(g.action.enabled){await page.locator('#postboatAction').click();await advance(page,100);}
    else if(t.type==='deliverRaft'){await advance(page,600);}
    else throw new Error('No available physical cargo action '+JSON.stringify(g.action));
  }
  return (await state(page)).speech.step>step;
}
async function playthrough(age,total){
  const {page,context,errors}=await boot({device:{age}});let s=await state(page),g=s.boat;
  ok('the age '+age+' harbour has its five/eight real goals',g.stages===total&&s.speech.steps===total,{stages:g.stages,steps:s.speech.steps});
  ok('the local catalog uses normal Premium access for Postboat',await page.evaluate(()=>{const a=Sona.gameAct('postboat');return Sona.gameAccess('postboat').allowed&&a.tier==='premium'&&a.say&&a.go==='/daily-adventure.html';}));
  const initial=held(g),reps=await page.evaluate(()=>Sona.weekReps(0));await ask(page);await page.keyboard.press('ArrowRight');await advance(page,14000);s=await state(page);
  ok('a whole silent turn and steering input earn no movement, cargo or goal at age '+age,s.speech.phase==='nudge'&&s.speech.step===0&&!s.boat.active&&equal(held(s.boat),initial)&&await page.evaluate(n=>Sona.weekReps(0)===n,reps),s.speech);
  await page.locator('#micBtn').click();requireCheck('two accepted sayings earn the real postboat at age '+age,await sayWord(page),await state(page));await advance(page,100);s=await state(page);
  ok('the word calms actual current without loading any parcel',s.boat.active&&s.boat.power>0&&s.boat.currentScale===.18&&magnitude(s.boat.current)<=magnitude(s.boat.baseCurrent)*.181&&s.boat.cargo.length===0&&s.speech.step===0,{current:s.boat.current,base:s.boat.baseCurrent});
  const x=s.boat.boat.x;await page.locator('#postboatRight').focus();await page.keyboard.down('Space');await advance(page,600);await page.keyboard.up('Space');await page.locator('#postboatStop').click();s=await state(page);
  ok('Space held on the focused right-arrow button actually paddles right',s.boat.boat.x>x+.015&&s.boat.boat.speed===0,{before:x,after:s.boat.boat.x,speed:s.boat.boat.speed});
  const beforeCancel=held(s.boat),start=await point(page,s.boat.boat);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+80,start.y-35);s=await state(page);
  await page.locator('#postboatBoat').evaluate((el,id)=>el.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:id})),s.boat.input.pointerId);await page.mouse.up();s=await state(page);
  ok('pointer cancellation clears thrust without moving the boat or cargo for free',!s.boat.input.dragging&&equal(held(s.boat),beforeCancel),s.boat.input);
  const shore=s.boat.solids.find(v=>v.id==='shore-4').points,hit={x:shore.reduce((n,p)=>n+p.x,0)/shore.length,y:shore.reduce((n,p)=>n+p.y,0)/shore.length};
  const from=await point(page,s.boat.boat),to=await point(page,hit);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y);await advance(page,6500);await page.mouse.up();await page.locator('#postboatStop').click();s=await state(page);
  ok('real banks stop the hull and record manual collisions',s.boat.collisions>0&&s.boat.stepMisses>0&&s.boat.boat.lastHit!==null,{collisions:s.boat.collisions,misses:s.boat.stepMisses,lastHit:s.boat.boat.lastHit});
  await advance(page,9000);s=await state(page);
  ok('collisions and coasting never auto-load or finish the goal',s.speech.step===0&&s.boat.cargo.length===0&&s.boat.completedGoals.length===0,s.speech);
  requireCheck('real docking and each manual loading tap finish the first goal',await finishStage(page,0),await state(page));s=await state(page);
  ok('every requested first parcel was physically loaded',s.boat.loads===(total===5?1:2)&&s.boat.cargo.includes('mouse')&&(total===5||s.boat.cargo.includes('heron')),{loads:s.boat.loads,cargo:s.boat.cargo});
  requireCheck('the next spoken word earns Mouse delivery',await sayWord(page),await state(page));g=(await state(page)).boat;
  await steerTo(page,g.stations.heron.dock);s=await state(page);
  ok('visiting the wrong island cannot unload Mouse cargo',s.speech.step===1&&!s.boat.delivered.mouse&&s.boat.cargo.includes('mouse')&&!s.boat.action.enabled,{boat:s.boat.boat,action:s.boat.action});
  await approachDock(page,s.boat.stations.mouse.dock);await page.locator('#postboatAction').click();await until(page,()=>__dailyPostboat.power===0,14000);s=await state(page);const moored=held(s.boat),ordinaryScale=s.boat.currentScale;
  ok('docking alone does not deliver the parcel',s.boat.boat.moored==='mouse'&&!s.boat.delivered.mouse&&s.boat.action.label==='Unload parcel',s.boat.action);
  await page.locator('#dailyHelp').focus();await page.keyboard.press('Space');await until(page,()=>__sayplay.listening);s=await state(page);
  ok('Space activates optional help and preserves the same dock, cargo and physical position',s.boat.paused&&equal(held(s.boat),moored)&&await page.locator('#helpBack').isVisible());
  await page.locator('#helpBack').click();s=await state(page);
  ok('Back to the game returns the same docked move without a power',s.speech.phase==='play'&&!s.boat.paused&&s.boat.power===0&&equal(held(s.boat),moored));
  await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);await until(page,()=>__sayplay.phase==='play',16000);s=await state(page);
  ok('silence in optional help preserves cargo and returns without a power',!s.boat.paused&&s.boat.power===0&&equal(held(s.boat),moored));
  await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);await page.evaluate(()=>__quiet.background());await advance(page,3000);s=await state(page);
  ok('backgrounding a help ask holds the delivery and closes the microphone',s.boat.paused&&equal(held(s.boat),moored)&&await page.evaluate(()=>__quiet.live()===0));
  await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();s=await state(page);
  ok('resuming that help ask keeps the earned delivery without more speech',s.speech.phase==='play'&&!s.boat.paused&&s.boat.power===0&&equal(held(s.boat),moored));
  await page.locator('#dailyHelp').click();requireCheck('the optional spoken word earns calmer current again',await sayWord(page),await state(page));await advance(page,50);s=await state(page);
  ok('the same docked boat gets a measurable current reduction',Math.abs(s.boat.currentScale-ordinaryScale*.18)<1e-8&&magnitude(s.boat.current)<=magnitude(s.boat.baseCurrent)*ordinaryScale*.181&&equal(held(s.boat),moored),{ordinaryScale,current:s.boat.current,base:s.boat.baseCurrent});
  await page.locator('#postboatAction').focus();await page.keyboard.press('Space');await advance(page,100);s=await state(page);const part=held(s.boat);
  ok('Space activates the focused cargo button and starts a real transfer',s.boat.transfer&&s.boat.transfer.progress>0&&s.boat.transfer.progress<1&&!s.boat.delivered.mouse,s.boat.transfer);
  await page.evaluate(()=>__quiet.background());await advance(page,4000);s=await state(page);
  ok('a hidden page preserves the partial cargo transfer exactly',s.boat.paused&&equal(held(s.boat),part),s.boat.transfer);
  await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();s=await state(page);
  ok('a resumed page keeps that partial transfer instead of starting over',!s.boat.paused&&equal(held(s.boat),part),s.boat.transfer);
  requireCheck('the child completes that same physical Mouse delivery',await finishStage(page,1),await state(page));
  for(let step=2;step<total;step++){
    requireCheck('a real spoken word earns Postboat goal '+(step+1)+' at age '+age,await sayWord(page),await state(page));s=await state(page);
    if(step===total-1){
      ok('the final delivery starts with a real attached raft still away from Beaver',s.boat.raft.attached&&!!s.boat.raft.line&&!s.boat.raft.landingReady&&!s.boat.delivered.door,s.boat.raft);
      await until(page,()=>__dailyPostboat.power===0,14000);s=await state(page);const ordinary=s.boat.raft.damping;
      const raftBefore={x:s.boat.raft.x,y:s.boat.raft.y,heading:s.boat.raft.heading};
      await page.locator('#postboatRight').focus();await page.keyboard.down('ArrowRight');await advance(page,800);await page.keyboard.up('ArrowRight');await page.locator('#postboatStop').click();s=await state(page);
      ok('manual steering pulls and turns the articulated raft on a real towline',s.boat.raft.line&&(!equal({x:s.boat.raft.x,y:s.boat.raft.y,heading:s.boat.raft.heading},raftBefore))&&s.boat.attaches===1,{before:raftBefore,after:s.boat.raft});
      await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);const saved=held((await state(page)).boat);await advance(page,600);ok('the tow pose and route progress hold while the help microphone listens',equal(held((await state(page)).boat),saved));
      requireCheck('the optional spoken word calms the current and tow swing',await sayWord(page),await state(page));await advance(page,100);s=await state(page);
      ok('speech measurably increases physical raft damping while reducing current',s.boat.raft.damping>ordinary&&s.boat.raft.damping===7.8&&s.boat.currentScale===.18&&magnitude(s.boat.current)<=magnitude(s.boat.baseCurrent)*.181,{ordinary,damping:s.boat.raft.damping,current:s.boat.current,base:s.boat.baseCurrent});
      await page.screenshot({path:age==='3'?'/tmp/daily-postboat-younger.png':'/tmp/daily-postboat-phone.png'});
    }
    let arrivalChecked=false;
    const result=await finishStage(page,step,{beforeDoor:async(p,g)=>{
      if(g.action.label==='Unload door'&&!arrivalChecked){const l=g.raft.landing,ellipse=((g.raft.x-l.x)/l.rx)**2+((g.raft.y-l.y)/l.ry)**2;ok('the final raft really reaches its landing before door unloading at age '+age,g.raft.landingReady&&ellipse<=(g.assistance?1.6:1)&&g.raft.speed<=16&&g.boat.moored==='beaver'&&!g.delivered.door,{ellipse,raft:g.raft,boat:g.boat});arrivalChecked=true;await p.screenshot({path:path.join(OUT,'sona-daily-postboat-arrival-age'+age+'.png')});}
    }});
    requireCheck('actual steering, docking and cargo actions finish goal '+(step+1)+' at age '+age,result,await state(page));
    if(step===total-1)ok('the final door needed an actual raft arrival check',arrivalChecked);
  }
  await until(page,()=>__sayplay.phase==='end',5000);s=await state(page);
  ok('all post and the real door raft finish the five/eight-goal story at age '+age,s.speech.phase==='end'&&s.speech.step===total&&s.boat.won&&s.boat.completedGoals.length===total&&Object.values(s.boat.delivered).every(Boolean)&&s.boat.raft.unloaded&&s.boat.manualTravel>100&&s.boat.loads===3&&s.boat.unloads===4&&s.boat.attaches===1,{speech:s.speech,delivered:s.boat.delivered,loads:s.boat.loads,unloads:s.boat.unloads});
  const audio=await audioAudit(page);ok('all boat directions and chimes stay outside the microphone at age '+age,audio.leaks===0&&audio.overlap===0&&audio.live===0,audio);
  ok('boat directions explain actions without grading the child',audio.lines.some(t=>/dock|parcel|raft|boat/i.test(t))&&!audio.lines.some(t=>/wrong|fail|score|points|correct/i.test(t)),audio.lines);
  ok('only accepted sayings count as play reps, with no practice outcome',await page.evaluate(({reps,total})=>Sona.weekReps(0)===reps+total*2+4&&Sona.weekReps(0,null,true)===0&&Object.keys(Sona.outcomes()).length===0,{reps,total}),await page.evaluate(()=>({reps:Sona.weekReps(0),outcomes:Sona.outcomes()})));
  await page.screenshot({path:path.join(OUT,'sona-daily-postboat-finished-age'+age+'.png')});await page.locator('#again').click();s=await state(page);
  ok('Play again clears cargo, arrivals and the towline and requires speech',s.speech.step===0&&!s.boat.active&&s.boat.stage===-1&&s.boat.cargo.length===0&&s.boat.completedGoals.length===0&&!s.boat.raft.attached&&!s.boat.raft.unloaded&&Object.values(s.boat.delivered).every(v=>!v));
  ok('the full Postboat path has no runtime errors at age '+age,errors.length===0,errors);await context.close();
}
try{
  harness=await dailyHarness({key:'postboat',port:8395});await accessChecks();
  for(const [age,total] of [['3',5],['7',8]])await playthrough(age,total);
  await deniedMicCheck();await layoutChecks();
}catch(error){if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:'/tmp/daily-postboat-failure.png'}).catch(()=>{});if(!failures)ok('the Postboat suite completes without a page or harness crash',false,error.stack);else console.log('STOP '+error.message);}
finally{if(harness)await harness.close();}
console.log('Postboat: '+checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
