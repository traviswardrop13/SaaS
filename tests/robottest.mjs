// Robot Builder: the real wire puzzle and the real Say & Play speech owner.
// No fake accepted-word callbacks. Every wait runs on the page's fake clock
// (page.clock) or on published state, so the suite plays the same on a busy
// machine.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,robot:window.__robot}));
const rot=(m,r)=>((m<<r)|(m>>(4-r)))&15;
const right=t=>rot(t.mask,t.rotation)===rot(t.mask,t.correctRotation);
// Verify the wiring independently from the game's `connected` flag. A
// reciprocal pair is necessary at each shared edge, plus the two sockets.
function hasCircuit(s){
 const masks=s.tiles.map(t=>rot(t.mask,t.rotation)),start=s.startRow*3,end=s.endRow*3+2,seen=new Set(),queue=[start];
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
const sameTiles=(a,b)=>a.every((t,i)=>t===b[i].rotation);
// is the element at the middle of `sel` that element (nothing covers it)?
const onTop=(p,sel)=>p.evaluate(sel=>{const e=document.querySelector(sel);if(!e)return{ok:false,why:'missing'};const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return{ok:!!hit&&(hit===e||e.contains(hit))&&r.left>=0&&r.top>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5&&r.width>=44&&r.height>=43.5,r:{x:r.left,y:r.top,w:r.width,h:r.height},hit:hit&&(hit.id||hit.className&&String(hit.className.baseVal!=null?hit.className.baseVal:hit.className)||hit.tagName),vw:innerWidth,vh:innerHeight};},sel);
try{
 h=await gameHarness('robot',8348);
 // ── (d) parked: a typed address goes home before any mic or sound ──
 {
  const {page,context,errors}=await h.fresh({unpark:false});
  const home=await until(page,()=>/\/(today|activities)\.html/.test(location.pathname)&&!!document.getElementById('libraryMessage')&&/Robot Builder is coming soon/.test(document.getElementById('libraryMessage').textContent),8000);
  ok('the parked robot goes back to Home, which says it is coming soon',home&&!page.url().includes('arcade-robot'),{url:page.url()});
  ok('…with no mic asked for and no sound played',await page.evaluate(()=>__quiet.requests===0&&__quiet.soundsBefore===0&&__quiet.sounds.length===0&&__quiet.sfx.length===0),await page.evaluate(()=>({r:__quiet.requests,b:__quiet.soundsBefore,s:__quiet.sounds.length})));
  ok('parked bounce has no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── the rebuild (9 Nov 2026): a new puzzle every time, and paint your robot ──
 {
  // the route is the luck of the draw: the same moment, two different
  // throws of the dice, two different boards (Math.random set by hand, so
  // the suite is the same every run)
  const firstTwo=async seed=>{const {page,context,errors}=await h.fresh();
   await page.evaluate(seed=>{let x=seed;Math.random=()=>{x=(x*16807)%2147483647;return (x-1)/2147483646;};},seed);
   await page.locator('#startBtn').click();const out=[];
   for(let st=0;st<2;st++){if(!await sayWord(page))throw new Error('rebuild word '+st);const s=(await state(page)).robot;out.push(s);await solve(page);await page.locator('#robotTest').click();await until(page,n=>__sayplay.step>n,5000,st);}
   ok('a seeded board has no runtime errors',errors.length===0,errors);await context.close();return out;};
  const a=await firstTwo(7),b=await firstTwo(424242);
  const straight=s=>s.route.length===3&&s.route.every(i=>Math.floor(i/3)===Math.floor(s.route[0]/3));
  ok('the first circuit is always a straight row of three, battery to bulb',straight(a[0])&&straight(b[0])&&a[0].startRow===a[0].endRow,[a[0].route,b[0].route]);
  ok('the battery and the bulb sit where the route starts and ends',[...a,...b].every(s=>s.startRow===Math.floor(s.route[0]/3)&&s.endRow===Math.floor(s.route[s.route.length-1]/3)&&s.route[0]%3===0&&s.route[s.route.length-1]%3===2),[...a,...b].map(s=>[s.route,s.startRow,s.endRow]));
  ok('a different throw of the dice lays out different wires',JSON.stringify(a.map(s=>[s.route,s.tiles]))!==JSON.stringify(b.map(s=>[s.route,s.tiles])),{a:a.map(s=>s.route),b:b.map(s=>s.route)});
  ok('every route wire starts the wrong way round, so each needs a turn',[...a,...b].every(s=>s.tiles.every(t=>!t.inPath||!right(t))),[...a,...b].map(s=>s.tiles));
 }
 {
  const {page,context,errors}=await h.fresh();
  const pots=await page.locator('#robotPaints [data-coat]').evaluateAll(b=>b.map(x=>[x.getAttribute('data-coat'),x.getAttribute('aria-checked'),x.getAttribute('aria-label')]));
  ok('the start card offers four paint pots, blue picked to begin with',JSON.stringify(pots)===JSON.stringify([['blue','true','Blue'],['purple','false','Purple'],['pink','false','Pink'],['green','false','Green']]),pots);
  await page.locator('#robotPaints [data-coat="pink"]').click();let s=await state(page);
  ok('a tap on the pink pot picks pink, and only pink',s.robot.coat==='pink'&&await page.locator('#robotPaints [aria-checked="true"]').count()===1&&await page.locator('#robotPaints [data-coat="pink"][aria-checked="true"]').count()===1,s.robot);
  ok('picking a colour starts nothing: no word, no mic',s.speech.phase==='ready'&&await page.evaluate(()=>__quiet.requests===0),s.speech);
  await page.locator('#startBtn').click();await sayWord(page);await solve(page);await page.locator('#robotTest').click();await until(page,()=>__sayplay.step===1,5000);
  const tint=await page.locator('.piece-leg-left img').evaluate(e=>getComputedStyle(e).filter);
  ok('the robot comes out in the colour picked: pink',/hue-rotate\(140deg\)/.test(tint),tint);
  const shadow=await page.locator('.piece-leg-left').evaluate(e=>getComputedStyle(e).filter);
  ok('…and its shadow is never tinted',!/hue-rotate/.test(shadow),shadow);
  await page.locator('.robot-piece.assembled').first().evaluate(e=>e.scrollIntoView());await page.screenshot({path:path.join(OUT,'sona-robot-pink.png')});
  ok('paint has no runtime errors',errors.length===0,errors);await context.close();
 }
 // the start card, with its paint pots, fits the smallest phone
 for(const viewport of [{width:320,height:568},{width:390,height:844}]){
  const {page,context,errors}=await h.fresh({viewport});const tag=viewport.width+'x'+viewport.height;
  const bad=[];for(const sel of ['#robotPaints [data-coat="blue"]','#robotPaints [data-coat="green"]','#startBtn']){const t=await onTop(page,sel);if(!t.ok)bad.push([sel,t]);}
  const size=await page.locator('#robotPaints [data-coat]').evaluateAll(b=>b.map(x=>{const r=x.getBoundingClientRect();return Math.min(r.width,r.height);}));
  ok('the paint pots and Let\'s build are on screen and uncovered '+tag,bad.length===0,bad);
  ok('every paint pot is at least 44 px '+tag,size.every(n=>n>=44),size);
  await page.screenshot({path:path.join(OUT,'sona-robot-start-'+viewport.width+'.png')});
  ok('start card has no runtime errors',errors.length===0,errors);await context.close();
 }
 {
  const {page,context,errors}=await h.fresh();const board=await page.locator('#robotBoard').count();ok('the robot has a playable circuit board',board===1);if(!board)throw new Error('Robot Builder is still an animation scene');
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);let s;
  await advance(page,1500);s=await state(page);ok('silence never assembles a robot part',s.speech.step===0&&!s.robot.active&&s.robot.assembled===0,s);
  // (a) a whole listening window of silence: the board stays shut, the mic waits for a tap
  await advance(page,13000);ok('…a quiet window first makes Echo say the word again, once, and listen again: nothing earned',await page.evaluate(()=>__sayplay.phase==='turn'&&__sayplay.step===0&&__sayplay.said===0));await advance(page,14000);s=await state(page);ok('two quiet windows earn nothing: no circuit, no step, the mic waits',s.speech.phase==='nudge'&&!s.robot.boardReady&&s.speech.step===0&&s.speech.said===0,s);
  await page.locator('#micBtn').click();
  ok('two accepted sayings earn the first circuit',await sayWord(page));s=await state(page);ok('the word opens a circuit and shows no answer: no blueprint, no pale lines',s.robot.active&&s.robot.blueprint===0&&!s.robot.connected&&s.robot.assembled===0&&s.speech.step===0&&s.robot.help===0&&await page.locator('.robot-tile.blueprint').count()===0&&await page.locator('#robotPower').isHidden(),s);
  ok('the initial wires really have no battery-to-socket circuit',!hasCircuit(s.robot),s.robot);
  await page.locator('#robotTest').click();s=await state(page);ok('a disconnected circuit cannot power a part',s.speech.step===0&&s.robot.assembled===0&&s.robot.misses===1&&s.robot.help===1,s.robot);
  // the outline stays on a wire until that wire is right, then moves on
  const hint=s.robot.hintIndex;ok('a failed test outlines a wrong wire',hint>=0&&!right(s.robot.tiles[hint])&&await page.locator('[data-tile="'+hint+'"].look-here').count()===1,s.robot);
  await page.locator('[data-tile="'+hint+'"]').click();s=await state(page);
  ok('one tap never hides the outline while a wire is still wrong',s.robot.hintIndex>=0&&!right(s.robot.tiles[s.robot.hintIndex])&&(right(s.robot.tiles[hint])||s.robot.hintIndex===hint),{hint,robot:s.robot});
  const k=s.robot.hintIndex,first=s.robot.tiles[k].rotation;await page.locator('[data-tile="'+k+'"]').focus();await page.keyboard.press('Enter');s=await state(page);ok('the circuit really rotates with a keyboard or finger tap',s.robot.tiles[k].rotation===(first+1)%4,s.robot.tiles[k]);
  await advance(page,11000);s=await state(page);ok('ten seconds on: still no blueprint, nothing failed or completed',s.robot.blueprint===0&&s.robot.active&&s.speech.step===0,s);
  let held=s.robot.tiles.map(t=>t.rotation);
  await page.locator('#robotHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('asking for help parks the same circuit and awards no part',s.robot.paused&&s.robot.assembled===0&&s.speech.step===0,s);
  // a page hidden during the help ask comes back to the same move, no power
  await page.evaluate(()=>__quiet.background());await advance(page,400);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await until(page,()=>__sayplay.phase==='play'&&!__robot.paused);s=await state(page);
  ok('a pause during the help ask gives back the same move with no blueprint',s.speech.phase==='play'&&!s.robot.paused&&s.robot.blueprint===0&&s.speech.step===0&&sameTiles(held,s.robot.tiles)&&!(await page.locator('#robotTest').isDisabled()),s);
  // (c) help, then silence: the same move continues, no power
  await page.locator('#robotHelp').click();await until(page,()=>__sayplay.listening);await advance(page,13500);
  await until(page,()=>__sayplay.phase==='play'&&!__robot.paused,3000);s=await state(page);
  ok('help then 13 s of silence: the same circuit goes on, no blueprint',s.speech.phase==='play'&&!s.robot.paused&&s.robot.blueprint===0&&s.speech.step===0&&sameTiles(held,s.robot.tiles)&&!(await page.locator('[data-tile="0"]').isDisabled()),s);
  // the same through the "Back to the game" pill
  await page.locator('#robotHelp').click();await until(page,()=>__sayplay.listening);await page.locator('#helpBack').click();await until(page,()=>__sayplay.phase==='play'&&!__robot.paused,3000);s=await state(page);
  ok('"Back to the game" gives the same circuit back, no blueprint',s.speech.phase==='play'&&!s.robot.paused&&s.robot.blueprint===0&&s.speech.step===0&&sameTiles(held,s.robot.tiles)&&await page.locator('#helpBack').isHidden(),s);
  await page.locator('#robotHelp').click();
  ok('saying the word for the Blueprint button',await sayWord(page));s=await state(page);ok('the Blueprint button\'s word shows the pale lines, keeping every rotation and the current stage',s.robot.blueprint>0&&!s.robot.paused&&sameTiles(held,s.robot.tiles)&&s.speech.step===0&&await page.locator('.robot-tile.blueprint').count()>0,s);
  await advance(page,11000);s=await state(page);ok('the blueprint expires without failing or completing the puzzle',s.robot.blueprint===0&&s.robot.active&&s.speech.step===0&&await page.locator('.robot-tile.blueprint').count()===0,s);
  await page.screenshot({path:path.join(OUT,'sona-robot-circuit.png')});
  const layouts=[],lengths=[],routes=[];
  for(let stage=0;stage<8;stage++){
   if(stage&&!await sayWord(page))throw new Error('Could not earn circuit '+stage);
   s=await state(page);layouts.push(JSON.stringify(s.robot.tiles.map(t=>[t.mask,t.correctRotation])));lengths.push(s.robot.tiles.filter(t=>t.inPath).length);routes.push(s.robot.route.join());
   if(stage)ok('circuit '+(stage+1)+' starts unpowered, with no pale lines',!hasCircuit(s.robot)&&s.robot.blueprint===0&&s.robot.help===0,s.robot);
   const wired=await solve(page);ok('real rotations connect circuit '+(stage+1),wired.connected&&hasCircuit(wired),wired);
   await advance(page,1500);s=await state(page);ok('a finished wire still waits for the Test power button '+(stage+1),s.speech.step===stage&&s.robot.assembled===stage&&await page.locator('#robotTest.ready').count()===1,s);
   await page.locator('#robotTest').click();s=await state(page);
   if(stage===0){
    ok('a working circuit celebrates first: the step waits about a second',s.speech.step===0&&s.robot.solved&&s.robot.doneAt>0,s);
    await advance(page,500);await page.evaluate(()=>__quiet.background());await advance(page,3000);s=await state(page);ok('a pause holds the celebration: no step while hidden',s.speech.step===0,s);
    await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();
   }
   ok('testing connected circuit assembles part '+(stage+1)+' after the cheer',await until(page,n=>__sayplay.step>n,5000,stage));
   if(stage===1){const c=await page.evaluate(()=>({sfx:__quiet.sfx.slice()}));ok('the cheer plays the correct chime',JSON.stringify(c).includes('correct'),c);}
  }
  await advance(page,3300);s=await state(page);ok('eight working circuits assemble a complete robot and win',s.speech.phase==='end'&&s.speech.step===8&&s.robot.assembled===8,s);ok('each circuit offers a different wiring puzzle',new Set(layouts).size===8,layouts);
  ok('each circuit is a little longer: 3, 4, 5, 5, 6, 7, 8, then all nine wires',lengths.join()==='3,4,5,5,6,7,8,9',lengths);
  ok('no route repeats the circuit just before it',routes.every((r,i)=>!i||r!==routes[i-1]),routes);
  const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));ok('no instruction or celebration plays into the microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);ok('the child hears that the word opens a circuit and how to turn the wires',audio.lines.some(t=>/open a circuit/i.test(t)&&/turn/i.test(t)),audio.lines);
  await page.screenshot({path:path.join(OUT,'sona-robot-finished.png')});
  await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-robot-assembled.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='');
  await page.locator('#again').click();await advance(page,500);s=await state(page);ok('building again clears the robot and requires a new word',s.speech.step===0&&!s.robot.active&&s.robot.assembled===0,s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── (b) a struggling child who never speaks for help reaches every part ──
 {
  const {page,context,errors}=await h.fresh();await page.locator('#startBtn').click();await sayWord(page);
  await advance(page,11000);let s=await state(page);ok('the struggling child starts on the game as built',s.robot.help===0&&s.robot.blueprint===0,s.robot);
  const levels=[];
  for(let n=0;n<3;n++){await page.locator('#robotTest').click();s=await state(page);levels.push(s.robot.help);}
  ok('each failed test raises the help: 1, 2, 3',levels.join()==='1,2,3',levels);
  ok('from the second the pale blueprint stays on to show how',await page.locator('.robot-tile.blueprint').count()>0&&s.robot.blueprint===0,s.robot);
  ok('the next wrong wire glows',s.robot.hintIndex>=0&&await page.locator('[data-tile="'+s.robot.hintIndex+'"].look-here').count()===1,s.robot);
  const path=s.robot.tiles.filter(t=>t.inPath).length;let taps=0;
  while(!s.robot.connected&&taps<12){await page.locator('[data-tile="'+s.robot.hintIndex+'"]').click();taps++;s=await state(page);}
  ok('from the third, one tap on each glowing wire joins the circuit',s.robot.connected&&taps<=path,{taps,path,robot:s.robot});
  await page.locator('#robotTest').click();ok('the struggling child powers the part with no speech',await until(page,()=>__sayplay.step===1,5000));
  ok('a new word starts the ladder again',await sayWord(page)&&(await state(page)).robot.help===0&&(await state(page)).robot.misses===0);
  // continuous: seconds of tapping a spare wire (never idle time) step it up too
  await advance(page,11000);s=await state(page);const spare=s.robot.tiles.findIndex(t=>!t.inPath);
  await advance(page,9000);s=await state(page);ok('idle time is never a miss',s.robot.help===0&&s.robot.work===0,s.robot);
  for(let n=0;n<16;n++){await page.locator('[data-tile="'+spare+'"]').click();await advance(page,500);}
  s=await state(page);ok('about 6 s of tapping without joining the wires outlines the next wire',s.robot.help>=1&&s.robot.hintIndex>=0&&!s.robot.connected,s.robot);
  ok('no help ever finishes a circuit by itself',(await state(page)).speech.step===1&&await page.evaluate(()=>!__quiet.voice));
  ok('struggling play has no runtime errors',errors.length===0,errors);await context.close();
 }
 // ages 3-4 (not on this shelf, but gentler if ever offered): glow from the first miss.
 // The age is the one setup saves (profile.childAge, read through
 // Sona.playStyle like every other game): this suite once seeded a made-up
 // `age` field, which the game also read, so it passed while a real
 // four-year-old got the big kids' ladder.
 {
  const {page,context}=await h.fresh({device:{age:'4'}});
  ok('the 4-year-old is seeded the way setup saves an age',await page.evaluate(()=>Sona.getProfile().childAge==='4'&&Sona.getProfile().age===undefined&&Sona.playStyle()==='simple'));
  await page.locator('#startBtn').click();await sayWord(page);
  await page.locator('#robotTest').click();let s=await state(page);ok('a 4-year-old gets the blueprint and the glow from the first miss',s.robot.help===2,s.robot);
  await page.locator('#robotTest').click();s=await state(page);ok('…and the snapping wires from the second',s.robot.help===3,s.robot);await context.close();
 }
 // a 7-year-old (the harness's default child) keeps the ladder as built: one step a miss
 {
  const {page,context}=await h.fresh();await page.locator('#startBtn').click();await sayWord(page);
  await page.locator('#robotTest').click();const s=await state(page);ok('a 7-year-old gets only the outline from the first miss',s.robot.help===1,s.robot);await context.close();
 }
 {
  const {page,context,errors}=await h.fresh({blockAssets:true});await page.locator('#startBtn').click();await sayWord(page);const s=await solve(page);ok('missing painted assets cannot break the real circuit controls',s.connected&&hasCircuit(s),s);await page.locator('#robotTest').click();ok('the fallback robot still assembles from a working circuit',await until(page,()=>__sayplay.step===1,5000));ok('failed artwork has no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── (e) fit: play, a word turn and a help ask ──
 for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024}]){
  const tag=viewport.width+'x'+viewport.height;
  const {page,context,errors}=await h.fresh({viewport});await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
  const panel=()=>page.evaluate(()=>{const r=document.getElementById('turnPanel').getBoundingClientRect();return{ok:r.top>=0&&r.left>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5,r:{t:r.top,b:r.bottom,l:r.left,rt:r.right}};});
  let pn=await panel(),hear=await onTop(page,'#hear');ok('the word turn fits '+tag,pn.ok&&hear.ok,{pn,hear});
  await sayWord(page);
  const fit=await page.evaluate(()=>({height:innerHeight,scroll:document.documentElement.scrollHeight}));ok('robot fits '+tag,fit.scroll<=fit.height+1,fit);
  const bad=[];for(let i=0;i<9;i++){const t=await onTop(page,'[data-tile="'+i+'"]');if(!t.ok)bad.push([i,t]);}
  ok('all nine wires are large, on screen and uncovered '+tag,bad.length===0,bad);
  const test=await onTop(page,'#robotTest'),help=await onTop(page,'#robotHelp');ok('Test power and Blueprint are reachable '+tag,test.ok&&help.ok,{test,help});
  await page.screenshot({path:path.join(OUT,'sona-robot-'+viewport.width+'.png')});
  await page.locator('#robotHelp').click();await until(page,()=>__sayplay.listening);
  pn=await panel();const back=await onTop(page,'#helpBack');ok('the help ask and "Back to the game" fit '+tag,pn.ok&&back.ok,{pn,back});
  ok('fit has no runtime errors',errors.length===0,errors);await context.close();
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
