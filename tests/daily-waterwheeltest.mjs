// Day 4's local fixture keeps the story-player work independent. Read-only
// snapshots locate real controls; only microphone input and finger/key input
// earn progress. DAILY_TEST_BLOCK_CONTROLLER=1 is the prechange-failure proof.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {dailyHarness,advance,until,sayWord} from './_daily-adventure.mjs';
let harness,checks=0,failures=0;
function ok(name,pass,detail){checks++;if(!pass){failures++;console.log('FAIL '+name+' '+String(JSON.stringify(detail)).slice(0,1800));}}
function requireCheck(name,pass,detail){ok(name,pass,detail);if(!pass)throw new Error(name);}
const state=page=>page.evaluate(()=>({speech:window.__sayplay,wheel:window.__dailyWaterwheel}));
const angle=n=>Math.atan2(Math.sin(n),Math.cos(n));
const kept=g=>({stage:g.stage,goal:g.goal,targets:Object.fromEntries(Object.entries(g.targets).map(([k,v])=>[k,v.fill])),gateOpen:g.gateOpen,gateUsed:g.gateUsed,shareOpen:g.shareOpen,shareUsed:g.shareUsed,delivered:g.delivered,pieces:g.pieces.map(p=>({id:p.id,x:p.x,y:p.y,angle:p.angle,placed:p.placed,moved:p.moved}))});
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const pieceSelector=id=>'[data-trough="'+id+'"]';
async function canvasPoint(page,p){const b=await page.locator('#dailyCanvas').boundingBox();return{x:b.x+p.x*b.width,y:b.y+p.y*b.height};}
async function cancelDrag(page,id,{moveToTarget=true,otherPointer=false}={}){
  let g=(await state(page)).wheel,p=g.pieces.find(p=>p.id===id),from=await canvasPoint(page,p);
  await page.mouse.move(from.x,from.y);await page.mouse.down();
  if(moveToTarget){const to=await canvasPoint(page,p.target);await page.mouse.move(to.x,to.y,{steps:8});}
  g=(await state(page)).wheel;
  await page.locator(pieceSelector(id)).evaluate((el,id)=>el.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:id})),otherPointer?g.pointerId+99:g.pointerId);
  const after=(await state(page)).wheel;await page.mouse.up();return after;
}
async function place(page,id,{offsetY=0}={}){
  let g=(await state(page)).wheel,p=g.pieces.find(p=>p.id===id);
  if(!p)throw new Error('No actual trough '+id);
  // A tap selects the trough; the visible curved-arrow controls turn it.
  await page.locator(pieceSelector(id)).click();
  const turns=Math.round(angle(p.target.angle-p.angle)/(Math.PI/8));
  for(let i=0;i<Math.abs(turns);i++)await page.getByRole('button',{name:turns<0?'Turn selected trough left':'Turn selected trough right',exact:true}).click();
  g=(await state(page)).wheel;p=g.pieces.find(p=>p.id===id);
  const from=await canvasPoint(page,p),to=await canvasPoint(page,{x:p.target.x,y:p.target.y+offsetY});
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:10});await page.mouse.up();
  return (await state(page)).wheel.pieces.find(p=>p.id===id).placed;
}
async function connect(page,options={}){
  const parts=(await state(page)).wheel.pieces.filter(p=>!p.placed);
  for(let i=0;i<parts.length;i++)if(!await place(page,parts[i].id,{offsetY:i===0?(options.offsetY||0):0}))return false;
  return true;
}
async function flowToNext(page,step){
  if(!await page.locator('.waterwheel-gate').getAttribute('aria-pressed').then(v=>v==='true'))await page.locator('.waterwheel-gate').click();
  return until(page,n=>__sayplay.step>n,16000,step);
}
async function boot(options={}){
  const r=await harness.fresh(options);
  const ready=await until(r.page,()=>!!window.__dailyWaterwheel&&!!window.__sayplay&&__sayplay.phase==='ready',2000);
  requireCheck('the real Waterwheel controller boots in the local host',ready,{errors:r.errors,phase:await r.page.locator('body').getAttribute('data-phase'),fixtureError:await r.page.locator('body').getAttribute('data-fixture-error')});
  return r;
}
async function ask(page){await page.locator('#startBtn').click();requireCheck('the shared speech turn starts',await until(page,()=>__sayplay.listening),await state(page));}
async function quietAudit(page){return page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));}
function compact(g){return{goal:g.goal,stage:g.stage,power:g.power,fill:g.targets[g.goal]?.fill,gate:g.gateOpen,share:g.shareOpen,placed:g.pieces.map(p=>p.placed),connected:g.routes};}

try{
  harness=await dailyHarness();
  // The normal access check must run before a controller is initialized.
  for(const options of [{closed:true},{device:{premium:false,paid:true}}]){
    const {page,context,errors}=await harness.fresh(options);
    const home=await until(page,()=>/\/(today|activities)\.html$/.test(location.pathname),8000);
    const q=await page.evaluate(()=>({requests:__quiet.requests,sounds:__quiet.soundsBefore+__quiet.sounds.length}));
    ok(options.closed?'a parked daily controller routes back through the real catalog gate':'an unentitled phone routes back through the real Premium gate',home&&!page.url().includes('daily-adventure'),{url:page.url(),q});
    ok('closed access asks for no microphone and plays no sound',q.requests===0&&q.sounds===0,q);
    ok('the closed route has no runtime error',errors.length===0,errors);await context.close();
  }
  for(const [age,total,goals] of [['4',5,['wheel','herbs','flowers','finalbed','pond']],['7',8,['wheel','cistern','herbs','seedlings','flowers','berries','finalbed','pond']]]){
    const {page,context,errors}=await boot({device:{age}});let s=await state(page);
    ok('the age '+age+' host uses its real five/eight-step path',s.wheel.stages===total&&s.speech.steps===total,{stages:s.wheel.stages,steps:s.speech.steps});
    ok('the local catalog grants normal Premium access with a daily route',await page.evaluate(()=>{const a=Sona.gameAct('waterwheel');return Sona.gameAccess('waterwheel').allowed&&a.tier==='premium'&&a.say&&a.go==='/daily-adventure.html';}));
    const beforeReps=await page.evaluate(()=>Sona.weekReps(0));await ask(page);await advance(page,14000);s=await state(page);
    ok('a full silent word window earns no troughs, water, step or rep at age '+age,s.speech.step===0&&s.speech.phase==='nudge'&&!s.wheel.active&&s.wheel.pieces.length===0&&s.wheel.delivered===0&&await page.evaluate(n=>Sona.weekReps(0)===n,beforeReps),compact(s.wheel));
    // 23 Oct 2026 (Travis: "say the sound 3 times not twice for every daily
    // game"): a story game asks each word Sona.STORY_SAY_TIMES (3) times. Each
    // saying is one play rep the moment it is heard, but the ones before the
    // last only tick their dots and say how many are left; only the last
    // opens a water route.
    await page.locator('#micBtn').click();requireCheck('the mic listens again for the first word at age '+age,await until(page,()=>__sayplay.listening),await state(page));await advance(page,150);
    const times=await page.evaluate(()=>__sayplay.times);
    ok('Waterwheel asks each word Sona.STORY_SAY_TIMES (three) times at age '+age,times===3&&await page.evaluate(t=>Sona.STORY_SAY_TIMES===t&&document.getElementById('twiceSay').textContent==='Say it '+t+' times'&&document.getElementById('twiceDots').children.length===t,times),{times});
    const burst=async()=>{await page.evaluate(()=>__quiet.voice=true);await advance(page,280);await page.evaluate(()=>__quiet.voice=false);};
    const early=[];
    for(let i=1;i<times;i++){await burst();await advance(page,650);early.push(await page.evaluate(()=>({said:__sayplay.said,phase:__sayplay.phase,listening:__sayplay.listening,status:document.getElementById('micState').textContent,reps:Sona.weekReps(0)})));}
    s=await state(page);
    ok('two sayings alone open no trough or water, and say how many are left at age '+age,equal(early.map(e=>e.status),['2 more times!','1 more time!'])&&early.every((e,i)=>e.said===i+1&&e.reps===beforeReps+i+1&&e.phase!=='play'&&e.listening)&&s.speech.step===0&&!s.wheel.active&&s.wheel.pieces.length===0&&s.wheel.delivered===0,{early,wheel:compact(s.wheel)});
    await burst();requireCheck('the third real voiced saying earns the first water route at age '+age,await until(page,()=>__sayplay.phase==='play'),await state(page));s=await state(page);
    ok('the word gives wider joins while the child still has to connect the route',s.wheel.active&&s.wheel.power>0&&s.wheel.pieces.length===(age==='4'?2:3)&&s.wheel.pieces.every(p=>!p.placed&&!p.moved)&&!s.wheel.gateOpen&&s.wheel.targets.wheel.fill===0,compact(s.wheel));
    const first=s.wheel.pieces[0],original={x:first.x,y:first.y,angle:first.angle};
    const cancelled=await cancelDrag(page,first.id);
    const restored=cancelled.pieces[0];
    ok('pointer cancellation restores the trough without placing it at age '+age,!cancelled.dragging&&!restored.placed&&!restored.moved&&restored.x===original.x&&restored.y===original.y&&restored.angle===original.angle&&cancelled.stage===0,{original,restored});
    await page.locator(pieceSelector(first.id)).focus();await page.keyboard.press('Enter');await page.keyboard.press('ArrowLeft');await page.keyboard.press('r');s=await state(page);
    ok('keyboard input moves and turns a picked-up real trough',s.wheel.dragging&&s.wheel.pieces[0].x<original.x&&s.wheel.pieces[0].angle!==original.angle,compact(s.wheel));
    await page.keyboard.press('Escape');s=await state(page);
    ok('Escape restores the same earned trough without free placement',!s.wheel.dragging&&!s.wheel.pieces[0].placed&&s.wheel.pieces[0].x===original.x&&s.wheel.pieces[0].angle===original.angle,compact(s.wheel));
    await until(page,()=>__dailyWaterwheel.power===0,14000);s=await state(page);const ordinary=s.wheel.catchRadius;
    requireCheck('real turning and dragging can lay a route with a join gap',await connect(page,{offsetY:ordinary*s.wheel.width/s.wheel.height*1.45}),compact((await state(page)).wheel));
    await advance(page,3000);s=await state(page);
    ok('placed troughs with the source gate closed deliver no water',s.wheel.pieces.every(p=>p.placed)&&s.wheel.targets.wheel.fill===0&&s.speech.step===0&&!s.wheel.gateUsed,compact(s.wheel));
    await page.locator('.waterwheel-gate').click();await advance(page,3000);s=await state(page);
    ok('an open gate cannot send water across an actual route gap',!s.wheel.routes.wheel.connected&&s.wheel.targets.wheel.fill===0&&s.speech.step===0&&s.wheel.droplets.some(d=>d.spilling),compact(s.wheel));
    const gapHeld=kept(s.wheel),narrow=s.wheel.catchRadius;
    await page.locator('#dailyHelp').click();requireCheck('the optional word uses the shared speech listener',await until(page,()=>__sayplay.listening),await state(page));
    ok('the help word holds the current physical route',equal(kept((await state(page)).wheel),gapHeld));
    requireCheck('saying the optional word earns the wider leaf joins',await sayWord(page),await state(page));s=await state(page);
    ok('speech makes the same offset route connect without moving a trough or spending a stage',s.wheel.power>0&&s.wheel.catchRadius>=narrow*2&&s.wheel.routes.wheel.connected&&s.speech.step===0&&equal(kept(s.wheel),gapHeld),{before:narrow,after:s.wheel.catchRadius,g:compact(s.wheel)});
    requireCheck('the water reaches and turns the wheel after that earned help',await until(page,()=>__sayplay.step===1,12000),await state(page));
    requireCheck('the next spoken word earns the next distinct route',await sayWord(page),await state(page));
    await until(page,()=>__dailyWaterwheel.power===0,14000);requireCheck('the next route can be connected by its real controls',await connect(page),await state(page));
    await page.locator('.waterwheel-gate').click();requireCheck('water really reaches the next receiver in flight',await until(page,()=>__dailyWaterwheel.targets[__dailyWaterwheel.goal].fill>0,9000),await state(page));
    await page.locator('.waterwheel-gate').click();s=await state(page);
    // Picking up and cancelling clears in-flight drops, so a held snapshot
    // can distinguish preserved partial water from new water after a return.
    await cancelDrag(page,s.wheel.pieces[0].id,{moveToTarget:false});s=await state(page);const held=kept(s.wheel);
    ok('a partial drink remains earned with the gate closed',s.wheel.targets[s.wheel.goal].fill>0&&s.wheel.targets[s.wheel.goal].fill<1&&!s.wheel.gateOpen&&s.speech.step===1,compact(s.wheel));
    await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);
    ok('a help ask preserves partial water, gates, trough position and turn',s.wheel.paused&&equal(kept(s.wheel),held)&&await page.locator('#helpBack').isVisible());
    await page.locator('#helpBack').click();await until(page,()=>__sayplay.phase==='play');s=await state(page);
    ok('Back to the game returns the same move without a power',!s.wheel.paused&&s.wheel.power===0&&s.speech.step===1&&equal(kept(s.wheel),held),compact(s.wheel));
    await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);await until(page,()=>__sayplay.phase==='play',16000);s=await state(page);
    ok('silence in optional help returns the same move without a power',!s.wheel.paused&&s.wheel.power===0&&s.speech.step===1&&equal(kept(s.wheel),held),compact(s.wheel));
    await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);await page.evaluate(()=>__quiet.background());await advance(page,4000);s=await state(page);
    ok('a hidden page holds the partial route and closes its microphone',s.wheel.paused&&equal(kept(s.wheel),held)&&await page.evaluate(()=>__quiet.live()===0),compact(s.wheel));
    await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await until(page,()=>__sayplay.phase==='play');s=await state(page);
    ok('resuming a help ask preserves the earned move without requiring speech',!s.wheel.paused&&s.wheel.power===0&&s.speech.step===1&&equal(kept(s.wheel),held),compact(s.wheel));
    await page.locator('#dailyHelp').click();requireCheck('another optional spoken word renews the useful power',await sayWord(page),await state(page));s=await state(page);
    ok('renewing help preserves partial water and the physical route',s.wheel.power>0&&equal(kept(s.wheel),held));
    requireCheck('the partially filled receiver can be finished after resuming',await flowToNext(page,1),await state(page));
    for(let step=2;step<total;step++){
      const previous=(await state(page)).wheel.pieces;
      requireCheck('the next actual word opens '+goals[step]+' at age '+age,await sayWord(page),await state(page));s=await state(page);
      ok('the daily path reaches its intended garden goal '+goals[step],s.wheel.goal===goals[step]&&s.wheel.act===(goals[step]==='pond'||goals[step]==='finalbed'?3:2),compact(s.wheel));
      if(goals[step]==='pond'){
        ok('the final split keeps the garden route the child already built',s.wheel.pieces.length===previous.length+1&&s.wheel.pieces.at(-1).branch&&previous.every((p,i)=>equal({id:p.id,x:p.x,y:p.y,angle:p.angle,placed:p.placed},{id:s.wheel.pieces[i].id,x:s.wheel.pieces[i].x,y:s.wheel.pieces[i].y,angle:s.wheel.pieces[i].angle,placed:s.wheel.pieces[i].placed})),compact(s.wheel));
        requireCheck('the child adds and turns the actual pond branch',await connect(page),await state(page));
        await page.locator('.waterwheel-gate').click();await advance(page,5000);s=await state(page);
        ok('the source gate alone cannot fill the pond through a closed fork',s.wheel.targets.pond.fill===0&&!s.wheel.shareOpen&&s.speech.step===step,compact(s.wheel));
        await page.locator('.waterwheel-gate').click();await page.locator('.waterwheel-share').click();await advance(page,1200);s=await state(page);
        ok('the fork gate alone cannot make water with the source closed',s.wheel.targets.pond.fill===0&&s.wheel.shareUsed&&!s.wheel.gateOpen&&s.speech.step===step,compact(s.wheel));
        await page.screenshot({path:path.join(OUT,'sona-daily-waterwheel-pond-age'+age+'.png')});
      }else requireCheck('the finger connects the actual '+goals[step]+' route',await connect(page),await state(page));
      requireCheck('manual water flow finishes '+goals[step]+' at age '+age,await flowToNext(page,step),await state(page));
    }
    await until(page,()=>__sayplay.phase==='end',5000);s=await state(page);
    ok('all three acts finish from real flowing water at age '+age,s.speech.phase==='end'&&s.speech.step===total&&s.wheel.won&&equal(s.wheel.completedGoals,goals)&&s.wheel.targets.pond.complete&&s.wheel.targets.finalbed.complete,compact(s.wheel));
    const audio=await quietAudit(page);
    ok('every direction and chime stays outside the microphone at age '+age,audio.leaks===0&&audio.overlap===0&&audio.live===0,audio);
    ok('directions explain real water routing without grading the child',audio.lines.some(t=>/trough|spring|water/i.test(t))&&!audio.lines.some(t=>/wrong|fail|score|points|correct/i.test(t)),audio.lines);
    // every word and each of the two help words is __sayplay.times sayings,
    // one rep each (three a word since 23 Oct 2026, Sona.STORY_SAY_TIMES)
    ok('only accepted sayings add play reps; the adventure adds no practice record',await page.evaluate(({before,total})=>Sona.weekReps(0)===before+(total+2)*__sayplay.times&&Sona.weekReps(0,null,true)===0&&Object.keys(Sona.outcomes()).length===0,{before:beforeReps,total}),await page.evaluate(()=>({reps:Sona.weekReps(0),outcomes:Sona.outcomes()})));
    await page.screenshot({path:path.join(OUT,'sona-daily-waterwheel-finished-age'+age+'.png')});
    await page.locator('#again').click();s=await state(page);
    ok('Play again starts with no route, water or free physical step',s.speech.step===0&&!s.wheel.active&&s.wheel.stage===-1&&s.wheel.pieces.length===0&&s.wheel.completedGoals.length===0&&Object.values(s.wheel.targets).every(t=>t.fill===0),compact(s.wheel));
    ok('a full playthrough has no runtime errors at age '+age,errors.length===0,errors);await context.close();
  }
  const rects=page=>page.evaluate(()=>{
    const selectors=['#dailyCanvas','#top','#dailyBanner','#dailyHelp','.waterwheel-toolbar','.waterwheel-gate','.waterwheel-turn','.waterwheel-share','.waterwheel-piece','#turnPanel','#hear','#word','#helpBack'];
    const rects=[];for(const selector of selectors)for(const el of document.querySelectorAll(selector)){const r=el.getBoundingClientRect(),s=getComputedStyle(el);if(el.hidden||s.display==='none'||s.visibility==='hidden'||!r.width||!r.height)continue;rects.push({selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height});}
    return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,rects};
  });
  const inside=f=>f.scroll<=f.height+1&&f.rects.every(r=>r.x>=-.5&&r.y>=-.5&&r.right<=f.width+.5&&r.bottom<=f.height+.5);
  const overlap=(a,b)=>a.x<b.right&&b.x<a.right&&a.y<b.bottom&&b.y<a.bottom;
  for(const viewport of [{width:320,height:568},{width:393,height:852},{width:768,height:1024},{width:1024,height:768}]){
    const tag=viewport.width+'x'+viewport.height,{page,context,errors}=await boot({viewport});await ask(page);let fit=await rects(page);
    ok('the isolated word turn fits '+tag,inside(fit)&&fit.rects.find(r=>r.selector==='#hear').h>=44,fit);
    requireCheck('the real word opens finger play at '+tag,await sayWord(page),await state(page));fit=await rects(page);
    const help=fit.rects.find(r=>r.selector==='#dailyHelp'),bar=fit.rects.find(r=>r.selector==='.waterwheel-toolbar'),banner=fit.rects.find(r=>r.selector==='#dailyBanner');
    ok('the water controls and tray fit '+tag,inside(fit)&&!overlap(help,bar)&&!overlap(banner,bar),fit);
    ok('finger controls remain at least 44 pixels at '+tag,fit.rects.filter(r=>/waterwheel-(gate|turn|piece)|dailyHelp/.test(r.selector)).every(r=>r.w>=44&&r.h>=44),fit);
    requireCheck('all real troughs can be placed on screen at '+tag,await connect(page),await state(page));
    fit=await rects(page);ok('the placed route stays on screen at '+tag,inside(fit),fit);
    requireCheck('water actually finishes a route at '+tag,await flowToNext(page,0),await state(page));requireCheck('the next word opens a help check at '+tag,await sayWord(page),await state(page));
    await page.locator('#dailyHelp').click();await until(page,()=>__sayplay.listening);fit=await rects(page);
    ok('optional help and Back to the game fit '+tag,inside(fit)&&fit.rects.some(r=>r.selector==='#helpBack'&&r.w>=44&&r.h>=44),fit);
    await page.screenshot({path:path.join(OUT,'sona-daily-waterwheel-help-'+tag+'.png')});
    await page.locator('#helpBack').click();await page.screenshot({path:path.join(OUT,'sona-daily-waterwheel-'+tag+'.png')});
    ok('layout play has no runtime error at '+tag,errors.length===0,errors);await context.close();
  }
  {
    const {page,context}=await boot({viewport:{width:568,height:320}});await advance(page,200);
    ok('a landscape phone keeps the existing portrait guard',await page.locator('#sonaPortraitGuard').isVisible());await context.close();
  }
}catch(error){if(!failures)ok('the Waterwheel suite completes without a harness or page crash',false,error.stack);else console.log('STOP '+error.message);}
finally{if(harness)await harness.close();}
console.log('Waterwheel: '+checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
