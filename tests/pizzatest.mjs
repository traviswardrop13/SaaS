// Pizza Chef: each word said two times starts the next cooking step; the
// finger rolls, spreads, sprinkles, tops, bakes and slices. Plays the real
// page on a fake clock (page.clock), so every wait is on published state,
// never on real time. PIZZA_PART=main|struggle|voice|oven|fit runs one part.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
const PORT=8352,BASE='http://127.0.0.1:'+PORT;
let h,checks=0,failures=0;
const brief=(k,v)=>k==='grid'?undefined:v;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d,brief)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,pizza:window.__pizza}));
const UNKIND=/\b(miss(ed|es)?|wrong|fail(ed)?|score|points?|correct|lose|lost)\b/i;
async function stroke(p,points,{cancelOther=false,hold=0}={}){
 const b=await p.locator('#pizzaCanvas').boundingBox();await p.mouse.move(b.x+points[0].x*b.width,b.y+points[0].y*b.height);await p.mouse.down();
 if(cancelOther)await p.evaluate(()=>document.getElementById('pizzaTool').dispatchEvent(new PointerEvent('pointercancel',{pointerId:99})));
 for(const point of points.slice(1))await p.mouse.move(b.x+point.x*b.width,b.y+point.y*b.height,{steps:10});
 if(hold)await advance(p,hold);await p.mouse.up();await advance(p,60);
}
async function boardPoints(p,points){const s=(await state(p)).pizza,b=await p.locator('#pizzaCanvas').boundingBox();return points.map(([x,y])=>({x:s.board.x+x*s.board.r,y:s.board.y+y*s.board.r*b.width/b.height}));}
// the step is counted after the celebration beat (about 1.15 s on the game's clock)
const finished=(p,stage)=>until(p,st=>__sayplay.step>st,4000,stage);
async function roll(p){for(let n=0;n<7;n++){if((await state(p)).pizza.completed>0)break;await stroke(p,await boardPoints(p,[[-.85,0],[.85,0],[-.85,0]]),{cancelOther:n===0});}return finished(p,0);}
async function cover(p,stage){
 for(let y=-.7;y<=.71;y+=.2){if((await state(p)).pizza.completed>stage)break;const x=Math.sqrt(.86*.86-y*y);await stroke(p,await boardPoints(p,[[-x,y],[x,y]]));}
 return finished(p,stage);
}
async function dragTopping(p,index,to,{pause=false}={}){
 const b=await p.locator('#pizzaCanvas').boundingBox(),source=await p.locator('#pizzaIngredient'+index).boundingBox();await p.mouse.move(source.x+source.width/2,source.y+source.height/2);await p.mouse.down();await p.mouse.move(b.x+to.x*b.width,b.y+to.y*b.height,{steps:16});
 if(pause){await p.evaluate(()=>__quiet.background());await advance(p,350);await p.mouse.up();await p.evaluate(()=>__quiet.foreground());await p.locator('#resume').click();await advance(p,300);}
 else{await p.mouse.up();await advance(p,90);}
}
// one drop of the next topping on the tray, at a point given in pizza radii
async function dropNext(p,at){const s=(await state(p)).pizza,from=s.tray.findIndex(t=>!t.used);const [to]=await boardPoints(p,[at]);await dragTopping(p,from,to);return (await state(p)).pizza;}
async function topPizza(p,stage){for(let n=0;n<3;n++){const s=(await state(p)).pizza,from=s.tray.findIndex(t=>!t.used),to=s.targets.find(t=>!t.filled);if(from<0||!to)break;await dragTopping(p,from,to);}return finished(p,stage);}
async function bakeHold(p,ms){const r=await p.locator('#pizzaBake').boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await advance(p,ms);await p.mouse.up();await advance(p,50);}
async function bake(p){let s=(await state(p)).pizza;const goal=(s.readyBand.min+s.readyBand.max)/2;await bakeHold(p,Math.max(0,(goal-s.heat)/s.heatRate*1000));if(await p.locator('#pizzaTakeOut').isEnabled())await p.locator('#pizzaTakeOut').click();return finished(p,6);}
// a straight swipe between two points in pizza radii (through their middle)
async function swipe(p,a,b){await stroke(p,await boardPoints(p,[a,[(a[0]+b[0])/2,(a[1]+b[1])/2],b]));return (await state(p)).pizza;}
const across=(angle,r=1)=>[[-Math.cos(angle)*r,-Math.sin(angle)*r],[Math.cos(angle)*r,Math.sin(angle)*r]];
// a short swipe along an angle, beside the middle (a child who cannot quite do it)
const shortBeside=(angle,off=.5,half=.525)=>{const ux=Math.cos(angle),uy=Math.sin(angle),cx=-uy*off,cy=ux*off;return [[cx-ux*half,cy-uy*half],[cx+ux*half,cy+uy*half]];};
async function cutPizza(p){for(const [i,angle] of [0,Math.PI/4,Math.PI/2,Math.PI*3/4].entries()){if((await state(p)).pizza.cuts[i].done)continue;const [a,b]=across(angle);await swipe(p,a,b);}return finished(p,7);}
async function reach(p,target){for(let stage=(await state(p)).speech.step;stage<target;stage++){if(!await sayWord(p))throw Error('Could not earn cooking stage '+stage);if(stage===0)await roll(p);else if(stage<3)await cover(p,stage);else if(stage<6)await topPizza(p,stage);else if(stage===6)await bake(p);}}
// rubbing that moves: one short segment per tenth of a second of game time
async function rub(p,pts,ms=100){
 const b=await p.locator('#pizzaCanvas').boundingBox(),q=await boardPoints(p,pts);
 await p.mouse.move(b.x+q[0].x*b.width,b.y+q[0].y*b.height);await p.mouse.down();
 for(const pt of q.slice(1)){await p.mouse.move(b.x+pt.x*b.width,b.y+pt.y*b.height,{steps:3});await advance(p,ms);}
 await p.mouse.up();await advance(p,40);
}
// the rim, just outside the dough, where rolling does nothing at first
const RIM=[];for(let n=0;n<=12;n++){const a=Math.PI*(1/6+n*(4/6)/12);RIM.push([Math.cos(a)*1.08,Math.sin(a)*1.08]);}
// back and forth along the rim without lifting, a tenth of a second a
// segment, until the published state says so (checked after every segment)
// (a small loop in one spot, SPOT, is a child who keeps spreading one place)
const SPOT=[];for(let n=0;n<12;n++){const a=n/12*Math.PI*2;SPOT.push([-.3+Math.cos(a)*.12,Math.sin(a)*.12]);}
async function rubUntil(p,want,maxSegs=300,where='rim'){
 let s=(await state(p)).pizza;if(want(s))return s;
 const b=await p.locator('#pizzaCanvas').boundingBox(),q=await boardPoints(p,where==='spot'?SPOT:RIM),loop=where==='spot'?q:q.concat(q.slice(1,-1).reverse());
 await p.mouse.move(b.x+q[0].x*b.width,b.y+q[0].y*b.height);await p.mouse.down();
 for(let n=1;n<=maxSegs;n++){const pt=loop[n%loop.length];await p.mouse.move(b.x+pt.x*b.width,b.y+pt.y*b.height,{steps:3});await advance(p,100);s=(await state(p)).pizza;if(want(s))break;}
 await p.mouse.up();await advance(p,40);return (await state(p)).pizza;
}
// a help ask that ends with no word: the same move, exactly where it was, no power
const held=s=>({step:s.speech.step,stage:s.pizza.stage,completed:s.pizza.completed,roll:s.pizza.rollProgress,sauce:s.pizza.sauceCoverage,heat:s.pizza.heat,cuts:JSON.stringify(s.pizza.cuts.map(c=>c.done)),tray:JSON.stringify(s.pizza.tray),stageMisses:s.pizza.stageMisses});
function sameMove(s,was){const now=held(s);return s.speech.phase==='play'&&!s.speech.paused&&!s.speech.listening&&!s.pizza.paused&&s.pizza.active&&s.pizza.power===0&&Object.keys(was).every(k=>now[k]===was[k]);}
const part=process.env.PIZZA_PART;
try{
 h=await gameHarness('pizza',PORT);
 // ── (d) parked: a typed address goes home before any mic or sound ──
 if(!part||part==='main'){
  const {page,context,errors}=await h.fresh({unpark:false});
  const home=await until(page,()=>/\/(today|activities)\.html/.test(location.pathname)&&!!document.getElementById('libraryMessage')&&/Pizza Chef is coming soon/.test(document.getElementById('libraryMessage').textContent),8000);
  ok('the parked kitchen goes back to Home, which says it is coming soon',home&&!page.url().includes('arcade-pizza'),{url:page.url(),msg:await page.evaluate(()=>{const m=document.getElementById('libraryMessage');return m&&m.textContent;})});
  ok('…with no mic asked for and no sound played',await page.evaluate(()=>__quiet.requests===0&&__quiet.sounds.length===0&&__quiet.sfx.length===0));
  // the kitchen page's own counts, carried over the bounce in this tab
  await context.addInitScript(()=>{if(location.pathname!=='/arcade-pizza.html')return;try{sessionStorage.setItem('pizza.seen','1');}catch(e){}addEventListener('pagehide',()=>{try{sessionStorage.setItem('pizza.quiet',JSON.stringify({requests:__quiet.requests,mics:__quiet.mics.length,sounds:__quiet.sounds.length,sfx:__quiet.sfx.length,speech:__quiet.speech.length}));}catch(e){}});});
  await page.goto(BASE+'/arcade-pizza.html');await until(page,()=>/\/(today|activities)\.html/.test(location.pathname),8000);
  const led=await page.evaluate(()=>({seen:sessionStorage.getItem('pizza.seen'),quiet:JSON.parse(sessionStorage.getItem('pizza.quiet')||'null')}));
  ok('the parked kitchen itself opened no mic and made no sound before leaving',led.seen==='1'&&led.quiet&&led.quiet.requests===0&&led.quiet.mics===0&&led.quiet.sounds===0&&led.quiet.sfx===0&&led.quiet.speech===0,led);
  ok('parked bounce has no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── one whole pizza, with every help path and a struggling child on the
 //    toppings, the oven and the cuts ──
 if(!part||part==='main'){
  const {page,context,errors}=await h.fresh();const canvas=await page.locator('#pizzaCanvas').count();ok('Pizza Chef has a real cooking board',canvas===1);if(!canvas)throw Error('Pizza Chef is still an ingredient-reveal scene');
  const words=await page.evaluate(()=>({banners:Pizza.BANNERS,lines:Pizza.STEP_LINES,start:document.querySelector('#startOvl .ovlCard').innerText,primer:document.querySelector('#primer .ovlCard').innerText,help:document.getElementById('pizzaHelp').getAttribute('aria-label'),canvas:document.getElementById('pizzaCanvas').getAttribute('aria-label'),banner:document.getElementById('pizzaBanner').textContent}));
  ok('the start card says the word, said two times, starts each cooking step',/two times to start the next step/i.test(words.start)&&/your hands/i.test(words.start),words.start);
  ok('the mic card says the same',/two times to cook/i.test(words.primer),words.primer);
  ok('the help button says it is extra help',/^Extra help/.test(words.help),words.help);
  ok('the kitchen picture says the word earns each step',/two times for the next step/i.test(words.canvas)&&/say the word/i.test(words.banner),{canvas:words.canvas,banner:words.banner});
  ok('no banner line or direction is unkind or a grade',words.banners.length>20&&words.banners.concat(words.lines).every(t=>!UNKIND.test(t)),words.banners.concat(words.lines).filter(t=>UNKIND.test(t)));
  ok('the cut direction says along the line, never "across" it or "right"',/along each dotted line/.test(words.lines[7])&&!words.banners.some(t=>/swipe right/i.test(t)),words.lines[7]);
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
  // (a) silence: the whole listening window passes and nothing is earned
  const nudged=await until(page,()=>__sayplay.phase==='nudge',16000);let s=await state(page);
  ok('silence cannot prepare any food',nudged&&!s.pizza.active&&s.pizza.completed===0&&s.pizza.rollProgress===0&&s.pizza.power===0&&s.speech.step===0&&s.speech.said===0,s);
  await page.locator('#micBtn').click();
  ok('two sayings earn the rolling pin',await sayWord(page));await advance(page,1000);s=await state(page);ok('an accepted word and idle animation cannot roll dough',s.pizza.rollProgress===0&&s.pizza.completed===0&&s.speech.step===0&&s.pizza.ladder===0,s);const gain=s.pizza.rollingGain;
  await stroke(page,await boardPoints(page,[[-.35,0],[0,0]]));s=await state(page);const boosted=s.pizza.rollProgress;ok('a real rolling stroke changes dough',boosted>0&&boosted<1,s);await advance(page,11000);s=await state(page);ok('speech gives a genuinely stronger rolling stroke',gain>s.pizza.rollingGain*1.5&&s.pizza.rollProgress===boosted,s);
  // (c) help, then silence: the same move comes back, with no power
  let was=held(s);await page.locator('#pizzaHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);
  ok('asking for help preserves the half-prepared dough and says what to say',s.pizza.paused&&s.pizza.rollProgress===was.roll&&s.speech.step===0&&await page.locator('#helpBack').isVisible()&&s.pizza.banner==='Say it for chef power',s);
  await advance(page,13000);await until(page,()=>__sayplay.phase==='play',4000);s=await state(page);
  ok('help, then 13 s of silence: the same dough, no power, cooking again',sameMove(s,was)&&s.pizza.banner==='Roll the dough'&&!await page.locator('#pizzaTool').isDisabled()&&!await page.locator('#helpBack').isVisible(),{s,was});
  await stroke(page,await boardPoints(page,[[0,0],[.35,0]]));s=await state(page);ok('…and the same dough rolls on from where it was',s.pizza.rollProgress>was.roll&&s.pizza.completed===0&&s.speech.step===0,s);
  was=held(s);await page.locator('#pizzaHelp').click();await until(page,()=>__sayplay.listening);await page.locator('#helpBack').click();await advance(page,100);s=await state(page);
  ok('help, then a tap on "Back to the game": the same move, no power',sameMove(s,was),{s,was});
  was=held(s);await page.locator('#pizzaHelp').click();await until(page,()=>__sayplay.listening);await page.evaluate(()=>__quiet.background());await advance(page,350);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await until(page,()=>__sayplay.phase==='play',4000);s=await state(page);
  ok('help, then the phone locked: back to the same move, no power, mic closed',sameMove(s,was)&&await page.evaluate(()=>__quiet.live()===0),{s,was});
  was=held(s);await page.locator('#pizzaHelp').click();ok('the help word, said two times, renews chef power',await sayWord(page));s=await state(page);ok('help keeps the same food and stage',s.pizza.power>0&&!s.pizza.paused&&s.pizza.rollProgress===was.roll&&s.pizza.completed===0&&s.speech.step===0,s);
  await page.locator('#pizzaTool').focus();const distance=s.pizza.strokeDistance;await page.keyboard.down('Space');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.up('Space');s=await state(page);ok('keyboard gestures control the actual rolling tool',s.pizza.strokeDistance>distance,s);
  // (2) the celebration beat, on the dough's last stroke
  for(let n=0;n<7&&!(await state(page)).pizza.completed;n++)await stroke(page,await boardPoints(page,[[-.85,0],[.85,0],[-.85,0]]));
  s=await state(page);const doneIn=s.pizza.doneIn,doneNow=await page.evaluate(()=>__quiet.now());
  ok('real back-and-forth rolling finishes the dough',s.pizza.completed===1&&!s.pizza.active,s);
  ok('…and the step waits for the celebration beat',s.speech.step===0&&s.speech.phase==='play'&&doneIn>0.9&&doneIn<=1.15&&s.pizza.dones===0,s);
  const chime=await page.evaluate(at=>__quiet.sfx.filter(x=>x.name==='correct'&&x.at>=at-0.3).length,doneNow-(1.15-doneIn));ok('the "correct" chime plays as the dough is done',chime>=1,chime);
  await advance(page,Math.max(0,(doneIn-0.3)*1000));s=await state(page);ok('…still waiting just before the beat ends',s.speech.step===0&&s.pizza.dones===0,s);
  await until(page,()=>__sayplay.step===1,2000);const stepAt=await page.evaluate(()=>__quiet.now());s=await state(page);
  ok('the step counts after the beat, exactly once',s.speech.step===1&&s.pizza.dones===1&&stepAt-doneNow>=doneIn-0.05&&stepAt-doneNow<=doneIn+0.35,{gap:stepAt-doneNow,doneIn,s});
  await advance(page,1500);s=await state(page);ok('…never twice',s.pizza.dones===1&&s.speech.step===1,s);
  for(let stage=1;stage<=2;stage++){
   ok('speech earns cooking stage '+(stage+1),await sayWord(page));s=await state(page);const wide=s.pizza.brushRadius;await advance(page,11000);s=await state(page);ok('speech widens the '+(stage===1?'sauce':'cheese')+' tool',wide>s.pizza.brushRadius*1.4&&s.pizza.ladder===0,s);
   const points=await boardPoints(page,[[0,0]]),b=await page.locator('#pizzaCanvas').boundingBox();await page.mouse.move(b.x+points[0].x*b.width,b.y+points[0].y*b.height);await page.mouse.down();await advance(page,100);const before=(await state(page)).pizza;await advance(page,1600);const after=(await state(page)).pizza;await page.mouse.up();const name=stage===1?'sauceCoverage':'cheeseCoverage';
   ok('a held still tool cannot cover the whole pizza, and is not counted as work',after[name]===before[name]&&after[name]<.5&&after.completed===stage&&after.effort===before.effort,after);ok('moving the real tool covers cooking stage '+(stage+1),await cover(page,stage),await state(page));
  }
  // ── toppings: a child who keeps dropping beside the spot ──
  for(let stage=3;stage<=5;stage++){
   ok('speech earns topping stage '+(stage+1),await sayWord(page));s=await state(page);ok('a word never places toppings for the child',s.pizza.targets.every(t=>!t.filled)&&s.pizza.completed===stage,s);const wide=s.pizza.targets[0].r;await advance(page,11000);s=await state(page);ok('speech gives topping '+(stage-2)+' a wider landing area',wide>s.pizza.targets[0].r*1.5,s);
   if(stage===3){
    const base=s.pizza.magnet;
    const src=await page.locator('#pizzaIngredient0').boundingBox();await page.mouse.move(src.x+src.width/2,src.y+src.height/2);await page.mouse.down();await page.mouse.up();await advance(page,90);s=await state(page);
    ok('a tap on a topping that moves nothing is not a miss',s.pizza.stageMisses===0&&s.pizza.ladder===0&&s.pizza.banner==='Drag it to a glowing spot'&&!s.pizza.tray[0].used,s);
    await dragTopping(page,0,{x:.1,y:s.pizza.tray[0].y});s=await state(page);
    ok('a missed topping stays available and costs no word',s.pizza.targets.every(t=>!t.filled)&&s.speech.step===stage&&await page.locator('#pizzaIngredient0').isEnabled(),s);
    ok('miss 1: the spots catch a topping 1.5x further away',s.pizza.stageMisses===1&&s.pizza.ladder===1&&s.pizza.magnet>=base*1.5&&!s.pizza.guide&&!UNKIND.test(s.pizza.banner)&&/so close/i.test(s.pizza.banner),s);
    await dragTopping(page,0,s.pizza.targets[0],{pause:true});s=await state(page);ok('an interrupted topping remains playable after returning, and is no miss',!s.pizza.paused&&await page.locator('#pizzaIngredient0').isEnabled()&&s.pizza.completed===stage&&s.pizza.stageMisses===1,s);
    // (b) struggler: always let go 0.45 r below the first spot
    const beside=[-.42,-.3+.45];
    s=await dropNext(page,beside);ok('miss 2: the spots glow and an arrow points the way (ladder 2)',s.stageMisses===2&&s.ladder===2&&s.guide&&s.magnet>=base*2.2&&s.banner==='Follow the arrow'&&s.targets.every(t=>!t.filled),s);
    s=await dropNext(page,beside);ok('miss 3: a topping let go over the pizza will fly to a spot (ladder 3)',s.stageMisses===3&&s.ladder===3&&s.snap&&s.targets.every(t=>!t.filled),s);
    s=await dropNext(page,beside);ok('the 4th drop puts the pepperoni on the nearest spot, with no word said',s.targets.filter(t=>t.filled).length===1&&s.targets[0].filled,s);
    s=await dropNext(page,beside);s=await dropNext(page,beside);
    ok('the same drop fills the other two spots and finishes the step',s.completed===stage+1&&s.targets.every(t=>t.filled),s);
    ok('struggler: the pepperoni step ends after 3 misses, with no help word',await finished(page,stage)&&(await state(page)).pizza.dones===4,await state(page));
   }else ok('three actual drags place topping group '+(stage-2),await topPizza(page,stage),await state(page));
  }
  // ── the oven: too hot twice, then the needle stops in the green ──
  ok('speech earns the oven',await sayWord(page));s=await state(page);const slow=s.pizza.heatRate,earnedBand={...s.pizza.readyBand};await advance(page,11000);s=await state(page);ok('speech really slows the oven gauge',slow<s.pizza.heatRate*.7&&s.pizza.ladder===0,s);ok('speech changes oven timing without moving the ready band',JSON.stringify(s.pizza.readyBand)===JSON.stringify(earnedBand),s.pizza);await advance(page,2000);s=await state(page);ok('an idle oven never bakes or finishes',s.pizza.heat===0&&!s.pizza.baked&&s.speech.step===6,s);await page.locator('#pizzaTakeOut').evaluate(e=>e.click());ok('taking out a cold pizza cannot finish baking',(await state(page)).speech.step===6);
  const base=s.pizza.heatRate;await bakeHold(page,6000);s=await state(page);
  ok('overheating waits for a retry rather than awarding a word',s.pizza.overheated&&!s.pizza.baked&&s.speech.step===6&&await page.locator('#pizzaRetry').isVisible(),s);
  ok('hot oven 1: the oven warms a little over half as fast (ladder 1)',s.pizza.stageMisses===1&&s.pizza.ladder===1&&s.pizza.heatRate<=base*.6&&s.pizza.heatCap===1&&!UNKIND.test(s.pizza.banner),s);
  await page.locator('#pizzaRetry').click();s=await state(page);ok('retry keeps the toppings and the same accepted word',s.pizza.heat===0&&!s.pizza.overheated&&s.pizza.completed===6&&s.speech.step===6,s);await bakeHold(page,600);s=await state(page);const heat=s.pizza.heat;await advance(page,1000);s=await state(page);ok('releasing Bake holds the gauge',Math.abs(s.pizza.heat-heat)<.001&&!s.pizza.baking,s);
  was=held(s);await page.locator('#pizzaHelp').click();await until(page,()=>__sayplay.listening);await advance(page,13000);await until(page,()=>__sayplay.phase==='play',4000);s=await state(page);
  ok('help, then silence, at the oven: the same heat, no power',sameMove(s,was)&&!await page.locator('#pizzaBake').isDisabled(),{s,was});
  await page.locator('#pizzaHelp').click();await sayWord(page);s=await state(page);const goal=(s.pizza.readyBand.min+s.pizza.readyBand.max)/2;await bakeHold(page,(goal-s.pizza.heat)/s.pizza.heatRate*1000);s=await state(page);const readyHeat=s.pizza.heat;ok('slow cooking reaches a real ready pizza without taking it out',s.pizza.ready&&s.speech.step===6&&!s.pizza.baked,s);await advance(page,11000);s=await state(page);ok('a ready pizza stays ready when speech power expires',s.pizza.power===0&&s.pizza.ready&&s.pizza.heat===readyHeat&&s.speech.step===6,s);
  await bakeHold(page,2000);s=await state(page);
  ok('hot oven 2: the needle will stop in the green and the green glows (ladder 2)',s.pizza.overheated&&s.pizza.stageMisses===2&&s.pizza.ladder===2&&s.pizza.heatCap<s.pizza.readyBand.max&&s.pizza.heatCap>=s.pizza.readyBand.min&&await page.locator('#pizzaHeat.guide').count()===1,s);
  await page.locator('#pizzaRetry').click();await bakeHold(page,9000);s=await state(page);
  ok('holding Bake a long time now stops in the green, never too hot',!s.pizza.overheated&&s.pizza.ready&&Math.abs(s.pizza.heat-s.pizza.heatCap)<1e-9&&s.speech.step===6&&!s.pizza.baked,s);
  ok('…and Take out glows, waiting for the finger',await page.locator('#pizzaTakeOut.guide').count()===1&&await page.locator('#pizzaTakeOut').isEnabled(),await page.locator('#pizzaTakeOut').getAttribute('class'));
  await page.locator('#pizzaTakeOut').click();ok('deliberate Take out finishes the controlled bake',await finished(page,6),await state(page));
  // ── the cuts: off the plate, off the line, then a child who cannot quite ──
  ok('speech earns the cutter',await sayWord(page));s=await state(page);const wideCut=s.pizza.cutTolerance;await advance(page,11000);s=await state(page);ok('speech makes following the cut guides more forgiving',wideCut>s.pizza.cutTolerance*1.5&&s.pizza.ladder===0,s);
  s=await swipe(page,[-.2,0],[.2,0]);ok('a tiny swipe cannot count as a full slice, and is no miss',s.cuts.every(c=>!c.done)&&s.stageMisses===0&&s.banner==='Swipe all the way across'&&(await state(page)).speech.step===7,s);
  const off=11*Math.PI/180;let [a,b]=across(off);s=await swipe(page,a,b);
  ok('an 11-degree swipe at the start is a near miss',s.cuts.every(c=>!c.done)&&s.stageMisses===1&&s.ladder===1&&s.banner==='Follow a dotted line',s);
  s=await swipe(page,a,b);ok('miss 1 eases the cut: the same 11-degree swipe now slices',s.cuts[0].done&&s.cuts.filter(c=>c.done).length===1&&s.cutTolerance>=0.38,s);
  [a,b]=across(Math.PI/2,1.4);s=await swipe(page,a,b);ok('a cut that starts on the table, off the plate, still slices',s.cuts[2].done&&s.cuts.filter(c=>c.done).length===2&&s.stageMisses===1,s);
  s=await swipe(page,a,b);ok('cutting the same line twice counts only once',s.cuts.filter(c=>c.done).length===2&&(await state(page)).speech.step===7,s);
  ok('miss 2: the next line glows with an arrow along it (ladder 2)',s.stageMisses===2&&s.ladder===2&&s.guide&&s.banner==='Follow the glowing line',s);
  await page.screenshot({path:path.join(OUT,'sona-pizza-cutting.png')});
  [a,b]=shortBeside(Math.PI/4);s=await swipe(page,a,b);ok('miss 3 (short, beside the middle): any swipe across will cut (ladder 3)',s.cuts.filter(c=>c.done).length===2&&s.stageMisses===3&&s.ladder===3&&s.snap&&s.banner==='Nearly! Swipe across',s);
  s=await swipe(page,a,b);ok('the same short swipe now cuts the nearest line',s.cuts[1].done&&s.cuts.filter(c=>c.done).length===3,s);
  [a,b]=shortBeside(Math.PI*3/4);s=await swipe(page,a,b);ok('struggler: the last cut finishes the pizza, with no help word',s.cuts.every(c=>c.done)&&s.completed===8,s);
  await until(page,()=>__sayplay.phase==='end',6000);s=await state(page);ok('eight real cooking actions finish one complete pizza',s.speech.phase==='end'&&s.speech.step===8&&s.pizza.completed===8&&s.pizza.won&&s.pizza.baked&&s.pizza.dones===8,s);
  const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));ok('cooking instructions and sounds stay out of the microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);
  const said=audio.lines.join('|');ok('the child hears the different cooking actions',/rolling pin/.test(said)&&/Spread the sauce/.test(said)&&/cut your pizza/.test(said)&&/let go in the green/.test(said),audio.lines);
  ok('Echo says the word, two times, starts each step',audio.lines.some(t=>/two times to start the next step/i.test(t)&&/your hands/i.test(t)),audio.lines);
  await page.screenshot({path:path.join(OUT,'sona-pizza-finished.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-pizza-cooked.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='');await page.locator('#again').click();await advance(page,350);s=await state(page);ok('a new pizza clears food and needs speech again',s.speech.step===0&&s.pizza.completed===0&&s.pizza.rollProgress===0&&s.pizza.sauceCoverage===0&&!s.pizza.active&&s.pizza.stageMisses===0&&s.pizza.effort===0&&s.pizza.doneIn===0,s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── (b) a child who rubs beside the dough, and never asks for help ──
 if(!part||part==='struggle'){
  const {page,context,errors}=await h.fresh();await page.locator('#startBtn').click();
  ok('roller: one word brings the rolling pin',await sayWord(page));await advance(page,11000);let s=await state(page);
  ok('roller: chef power has run out, the game as designed',s.pizza.power===0&&s.pizza.ladder===0&&s.pizza.effort===0,s);
  s=await rubUntil(page,()=>false,20);ok('rolling on the rim, beside the dough, does nothing at first',s.rollProgress===0&&s.ladder===0&&s.effort>1.5,s);
  {const [pt]=await boardPoints(page,[RIM[6]]),b=await page.locator('#pizzaCanvas').boundingBox();await page.mouse.move(b.x+pt.x*b.width,b.y+pt.y*b.height);await page.mouse.down();const e0=(await state(page)).pizza.effort;await advance(page,3000);const e1=(await state(page)).pizza.effort;await page.mouse.up();ok('holding the pin still is not work',e1===e0,{e0,e1});}
  s=await rubUntil(page,x=>x.ladder>=1);ok('after about 4 s of rubbing: the dough guide glows (ladder 1)',s.ladder===1&&s.effort>=4&&s.effort<4.5&&s.rollProgress===0&&s.banner==='Roll over the dough'&&!UNKIND.test(s.banner),s);
  s=await rubUntil(page,x=>x.ladder>=2);ok('after about 8 s: a much stronger pin (ladder 2)',s.ladder===2&&s.effort>=8&&s.effort<8.5&&s.rollingGain>=2&&s.rollProgress===0,s);
  s=await rubUntil(page,x=>x.ladder>=3);ok('after about 12 s: strokes on the rim count too (ladder 3)',s.ladder===3&&s.effort>=12&&s.effort<12.5&&s.rollingGain>=3,s);
  s=await rubUntil(page,x=>x.completed>0,80);ok('roller: the same rim strokes now roll the dough out, with no help word',s.completed===1,s);
  ok('roller: the step counts after the beat',await finished(page,0)&&(await state(page)).pizza.dones===1,await state(page));
  // the sauce: a child who keeps spreading one small place
  ok('spreader: the next word brings the spoon',await sayWord(page));await advance(page,11000);s=(await state(page)).pizza;ok('spreader: the spoon is the game as designed',s.stage===1&&s.ladder===0&&s.effort===0&&s.power===0,s);
  s=await rubUntil(page,x=>x.ladder>=1,300,'spot');ok('spreader: after about 4 s in one place the bare spots glow (ladder 1)',s.ladder===1&&s.sauceCoverage<.5&&s.banner==='Fill the glowing spots'&&s.completed===1,s);
  s=await rubUntil(page,x=>x.ladder>=3,300,'spot');ok('spreader: by about 12 s the spoon is much bigger, the sauce still not done (ladder 3)',s.ladder===3&&s.sauceCoverage<.86&&s.completed===1&&s.brushRadius>=(await state(page)).pizza.board.r*.4,s);
  s=await rubUntil(page,x=>x.completed>1,120,'spot');ok('spreader: spreading the same one place now fills the whole pizza, no help word',s.completed===2&&s.sauceCoverage>=.86&&s.power===0,s);
  ok('spreader: the step counts after the beat',await finished(page,1),await state(page));
  ok('roller has no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── a child aged 4: the gentler ladder ──
 if(!part||part==='struggle'){
  const {page,context,errors}=await h.fresh({device:{age:'4'}});await page.locator('#startBtn').click();
  ok('age 4: one word brings the rolling pin',await sayWord(page));await advance(page,11000);let s=await state(page);ok('age 4: the gentler ladder is on, starting at the game as designed',s.pizza.little&&s.pizza.ladder===0,s);
  s=await rubUntil(page,x=>x.ladder>=1);ok('age 4: the glow comes after about 2 s of rubbing',s.ladder===1&&s.effort>=2&&s.effort<2.5,s);
  s=await rubUntil(page,x=>x.ladder>=2);ok('age 4: the much stronger pin after about 4 s',s.ladder===2&&s.effort>=4&&s.effort<4.5,s);
  // the topping ladder, shown on this phone's own trays (a layout-only jump
  // to the pepperoni: the struggle above plays the real steps)
  await page.evaluate(()=>Pizza.onWord(3));await advance(page,11000);s=await state(page);const beside=[-.42,-.3+.45];
  s=await dropNext(page,beside);ok('age 4, miss 1: the spots glow and the arrow shows (ladder 2)',s.ladder===2&&s.guide&&s.targets.every(t=>!t.filled),s);
  s=await dropNext(page,beside);ok('age 4, miss 2: a topping let go over the pizza flies to a spot (ladder 3)',s.ladder===3&&s.snap,s);
  s=await dropNext(page,beside);ok('age 4: the 3rd drop lands on a spot',s.targets.filter(t=>t.filled).length===1,s);
  ok('age 4 has no runtime errors',errors.length===0,errors);await context.close();
 }
 if(!part||part==='voice'){
  const {page,context}=await h.fresh();let pending;
  await page.route('**/api/tts',async route=>{const text=route.request().postDataJSON()?.text||'';if(/rolling pin back and forth/.test(text)&&!pending){pending=route;return;}return route.continue();});
  await page.locator('#startBtn').click();await sayWord(page);for(let n=0;n<20&&!pending;n++)await advance(page,100);ok('each new cooking action requests its spoken direction',!!pending);await page.locator('#pizzaHelp').click();await until(page,()=>__sayplay.listening);if(pending)await pending.fulfill({status:200,contentType:'application/octet-stream',body:Buffer.alloc(4800)});await advance(page,500);const a=await page.evaluate(()=>({leaks:__quiet.leakFrames,speaking:__quiet.speaking,live:__quiet.live(),lines:__quiet.speech}));ok('a late cooking instruction cannot play after help opens the mic',a.leaks===0&&a.live===1&&a.speaking===0&&!a.lines.some(t=>/rolling pin back and forth/.test(t)),a);
  await sayWord(page);ok('the interrupted direction is heard after the help word',await until(page,()=>__quiet.speech.some(t=>/rolling pin back and forth/.test(t)),5000));ok('replaying a direction never skips cooking',(await state(page)).speech.step===0&&(await state(page)).pizza.rollProgress===0);await context.close();
  const resumed=await h.fresh();let deferred;await resumed.page.route('**/api/tts',async route=>{const text=route.request().postDataJSON()?.text||'';if(/rolling pin back and forth/.test(text)&&!deferred){deferred=route;return;}return route.continue();});await resumed.page.locator('#startBtn').click();await sayWord(resumed.page);for(let n=0;n<20&&!deferred;n++)await advance(resumed.page,100);await resumed.page.evaluate(()=>__quiet.background());await advance(resumed.page,350);await resumed.page.evaluate(()=>__quiet.foreground());await resumed.page.locator('#resume').click();ok('returning to the same move replays its interrupted direction',await until(resumed.page,()=>__quiet.speech.some(t=>/rolling pin back and forth/.test(t)),5000));if(deferred)await deferred.fulfill({status:200,contentType:'application/octet-stream',body:Buffer.alloc(4800)});await advance(resumed.page,700);await resumed.page.evaluate(()=>__quiet.background());await advance(resumed.page,350);await resumed.page.evaluate(()=>__quiet.foreground());await resumed.page.locator('#resume').click();await advance(resumed.page,1000);const resumedAudio=await resumed.page.evaluate(()=>({count:__quiet.speech.filter(t=>/rolling pin back and forth/.test(t)).length,leaks:__quiet.leakFrames}));ok('an already heard direction does not repeat on later resumes',resumedAudio.count===1&&resumedAudio.leaks===0,resumedAudio);await resumed.context.close();
 }
 if(part==='oven'){
  const {page,context}=await h.fresh();await page.locator('#startBtn').click();await reach(page,6);ok('six real cooking actions reach the oven',await sayWord(page)&&(await state(page)).speech.step===6);const band=(await state(page)).pizza.readyBand;await advance(page,11000);ok('speech changes oven timing without moving the ready band',JSON.stringify((await state(page)).pizza.readyBand)===JSON.stringify(band),(await state(page)).pizza.readyBand);await context.close();
 }
 // ── (e) fit: play, a word turn and a help ask on four screens ──
 if(!part||part==='fit'){
  {const {page,context,errors}=await h.fresh({blockAssets:true});await page.locator('#startBtn').click();await sayWord(page);ok('missing painted assets cannot block actual dough rolling',await roll(page));ok('fallback kitchen has no runtime errors',errors.length===0,errors);await context.close();}
  const inside=(r,v)=>r.w>0&&r.h>0&&r.x>=-0.5&&r.y>=-0.5&&r.right<=v.width+0.5&&r.bottom<=v.height+0.5;
  const meet=(a,b)=>a.x<b.right-0.5&&b.x<a.right-0.5&&a.y<b.bottom-0.5&&b.y<a.bottom-0.5;
  // a circle (canvas pixels) against a box: does any of the box lie inside it?
  const covers=(c,r)=>{const x=Math.max(r.x,Math.min(c.x,r.right)),y=Math.max(r.y,Math.min(c.y,r.bottom));return Math.hypot(x-c.x,y-c.y)<c.r-0.5;};
  const rects=(p,ids)=>p.evaluate(ids=>ids.map(id=>{const e=document.getElementById(id),r=e?e.getBoundingClientRect():{x:0,y:0,right:0,bottom:0,width:0,height:0};return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,shown:!!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'};}),ids);
  const pizzaCircle=async p=>{const s=(await state(p)).pizza,b=await p.locator('#pizzaCanvas').boundingBox();return{x:b.x+s.board.x*b.width,y:b.y+s.board.y*b.height,r:s.board.r*b.width};};
  const big=r=>r.w>=44&&r.h>=44;
  for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024}]){
   const tag=viewport.width+'x'+viewport.height;
   const {page,context,errors}=await h.fresh({viewport});await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
   let r=await rects(page,['turnPanel','word','hear','picBox']);
   ok(tag+': the word turn fits, with a big enough Hear it',r.every(x=>x.shown&&inside(x,viewport))&&big(r[2]),r);
   await sayWord(page);
   const fit=await page.evaluate(()=>({scroll:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth}));
   r=await rects(page,['pizzaCanvas','pizzaTool','pizzaHelp','pizzaHearStep','pizzaToolCard','pizzaBanner','pizzaPower']);let R=Object.fromEntries(r.map(x=>[x.id,x]));let c=await pizzaCircle(page);
   ok(tag+': the kitchen fits with no scrolling',fit.scroll<=viewport.height+1&&fit.sw<=viewport.width+1&&['pizzaCanvas','pizzaTool','pizzaHelp','pizzaHearStep','pizzaToolCard','pizzaBanner'].every(id=>R[id].shown&&inside(R[id],viewport)),{fit,r});
   ok(tag+': cooking controls remain large touch targets',['pizzaTool','pizzaHelp','pizzaHearStep'].every(id=>big(R[id])),r);
   ok(tag+': nothing covers the pizza',c.y-c.r>=R.pizzaCanvas.y&&c.y+c.r<=R.pizzaCanvas.bottom&&['pizzaHelp','pizzaHearStep','pizzaToolCard','pizzaBanner','pizzaPower'].every(id=>!(R[id].shown&&covers(c,R[id]))),{c,r});
   // every banner line, even the longest, is one line clear of the buttons and the pizza
   const lows=await page.evaluate(()=>{const b=document.getElementById('pizzaBanner'),keep=b.textContent,out=Pizza.BANNERS.map(t=>{b.textContent=t;const r=b.getBoundingClientRect();return{t,x:r.x,y:r.y,right:r.right,bottom:r.bottom,h:r.height};});b.textContent=keep;return out;});
   const one=Math.min(...lows.map(l=>l.h));
   ok(tag+': every banner line is one line, clear of the pizza and the buttons',lows.every(l=>l.h<one*1.4&&!meet(l,R.pizzaHearStep)&&!(R.pizzaPower.shown&&meet(l,R.pizzaPower))&&!covers(c,l)&&l.x>=0&&l.right<=viewport.width),lows.filter(l=>l.h>=one*1.4||meet(l,R.pizzaHearStep)||covers(c,l)));
   // a help ask: the word panel and "Back to the game" fit and are big enough
   await page.locator('#pizzaHelp').click();await until(page,()=>__sayplay.listening);
   r=await rects(page,['turnPanel','hear','helpBack','word']);
   ok(tag+': a help ask fits, with a big enough "Back to the game"',r.every(x=>x.shown&&inside(x,viewport))&&big(r[1])&&big(r[2]),r);
   await page.locator('#helpBack').click();await advance(page,100);
   ok(tag+': "Back to the game" brings the kitchen back',(await state(page)).speech.phase==='play'&&await page.locator('#pizzaTool').isVisible()&&await page.locator('#pizzaHelp').isEnabled());
   ok(tag+': a child can really roll dough on this screen',await roll(page),await state(page));
   await sayWord(page);
   // the trays, the oven and the cutter on this screen (layout-only jumps)
   await page.evaluate(()=>Pizza.onWord(3));await advance(page,200);
   r=await rects(page,['pizzaIngredient0','pizzaIngredient1','pizzaIngredient2','pizzaControls','pizzaHelp','pizzaHearStep']);R=Object.fromEntries(r.map(x=>[x.id,x]));c=await pizzaCircle(page);
   const trays=['pizzaIngredient0','pizzaIngredient1','pizzaIngredient2'],targets=(await state(page)).pizza.targets,cb=await page.locator('#pizzaCanvas').boundingBox();
   ok(tag+': the topping trays fit, big, clear of the buttons and the pizza',trays.every(id=>R[id].shown&&inside(R[id],viewport)&&big(R[id])&&!meet(R[id],R.pizzaHelp)&&!meet(R[id],R.pizzaHearStep)&&!covers(c,R[id]))&&!trays.some((id,i)=>trays.some((jd,j)=>j>i&&meet(R[id],R[jd]))),r);
   ok(tag+': every glowing spot is on screen, clear of the buttons',targets.every(t=>{const x=cb.x+t.x*cb.width,y=cb.y+t.y*cb.height,box={x:x-1,y:y-1,right:x+1,bottom:y+1};return inside({...box,w:2,h:2},viewport)&&!meet(box,R.pizzaHearStep)&&!meet(box,R.pizzaControls);}),targets);
   await page.evaluate(()=>Pizza.onWord(6));await advance(page,200);
   r=await rects(page,['pizzaBake','pizzaTakeOut','pizzaHelp','pizzaHeat','pizzaControls']);R=Object.fromEntries(r.map(x=>[x.id,x]));
   ok(tag+': the oven buttons and the heat bar fit, big, apart',['pizzaBake','pizzaTakeOut','pizzaHelp','pizzaHeat'].every(id=>R[id].shown&&inside(R[id],viewport))&&['pizzaBake','pizzaTakeOut','pizzaHelp'].every(id=>big(R[id]))&&!meet(R.pizzaHeat,R.pizzaControls)&&!meet(R.pizzaBake,R.pizzaTakeOut)&&!meet(R.pizzaTakeOut,R.pizzaHelp),r);
   await bakeHold(page,7000);r=await rects(page,['pizzaRetry','pizzaBake','pizzaHelp']);
   ok(tag+': Try again fits and is big',(await state(page)).pizza.overheated&&r.every(x=>x.shown&&inside(x,viewport)&&big(x))&&!meet(r[0],r[1])&&!meet(r[0],r[2]),r);
   await page.evaluate(()=>Pizza.onWord(7));await advance(page,200);
   r=await rects(page,['pizzaTool','pizzaToolCard','pizzaHelp','pizzaHearStep','pizzaControls']);R=Object.fromEntries(r.map(x=>[x.id,x]));c=await pizzaCircle(page);
   const ends=(await state(page)).pizza.cuts.flatMap(k=>[k.start,k.end]).map(e=>({x:cb.x+e.x*cb.width,y:cb.y+e.y*cb.height}));
   ok(tag+': every dotted line\'s ends are on screen, clear of the buttons',ends.every(e=>{const box={x:e.x-1,y:e.y-1,right:e.x+1,bottom:e.y+1};return inside({...box,w:2,h:2},viewport)&&!meet(box,R.pizzaHearStep)&&!meet(box,R.pizzaControls)&&!meet(box,R.pizzaToolCard);}),ends);
   await page.screenshot({path:path.join(OUT,'sona-pizza-'+viewport.width+'.png')});ok(tag+': fit has no runtime errors',errors.length===0,errors);await context.close();
  }
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
