// Build a Snowman, rebuilt (Travis, 9 Nov 2026: "yes build the snowman"):
// the word brings the snowball or the pieces and turns on no easy mode, the
// child picks the hat (top hat, party hat, crown) and the neck (scarf or bow
// tie), Echo explains each kind of step once a visit, and a see-through copy
// shows the move until the child touches it. Every older rule still plays.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,snow:window.__snowman}));
async function move(p,q,steps=16){const b=await p.locator('#snowmanCanvas').boundingBox();await p.mouse.move(b.x+q.x*b.width,b.y+q.y*b.height,{steps});}
async function grab(p){const b=await p.locator('#snowBall').boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();}
async function roll(p,stage,{miss=false}={}){
 let s=await state(p);if(s.speech.step>stage)return true;const z=s.snow.rollZone,left=z.left+(z.right-z.left)*.14,right=z.right-(z.right-z.left)*.14,y=(z.top+z.bottom)/2;await grab(p);await move(p,{x:left,y});
 for(let n=0;n<14;n++){s=await state(p);if(s.snow.ball.ready)break;await move(p,{x:n%2?left:right,y},24);}
 s=await state(p);if(!s.snow.ball.ready){await p.mouse.up();return false;}await move(p,miss?{x:left,y}:s.snow.target);await p.mouse.up();if(miss){await advance(p,90);return (await state(p)).speech.step===stage;}return until(p,st=>__sayplay.step>st,4000,stage);
}
async function smallRoll(p,dx){await grab(p);let s=await state(p);await move(p,{x:s.snow.ball.x+dx,y:s.snow.ball.y},10);await p.mouse.up();await advance(p,50);}
async function piece(p,target,{background=false,look=''}={}){
 const s=(await state(p)).snow,index=s.tray.findIndex(t=>t.id===target.id&&(!look||t.look===look)),b=index<0?null:await p.locator('#snowPiece'+index).boundingBox();if(!b)throw Error('No real tray piece '+target.id+' '+look);await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await move(p,target);
 if(background){await p.evaluate(()=>__quiet.background());await advance(p,350);await p.mouse.up();await p.evaluate(()=>__quiet.foreground());await p.locator('#resume').click();await advance(p,100);}else{await p.mouse.up();await advance(p,90);}
}
// Drags every piece the tray holds onto the snowman, slot by slot: the
// dressing step offers one slot at a time (the hat's looks, then the neck's,
// then the arms). `pick` names a look for a slot ({hat:'crown'}).
async function decorate(p,stage,pick={}){for(let n=0;n<8;n++){const s=await state(p);if(s.speech.step>stage||s.snow.celebrating)break;const t=s.snow.targets.find(t=>!t.placed);if(!t){await advance(p,100);continue;}await piece(p,t,{look:pick[t.id]||''});}return until(p,st=>__sayplay.step>st,4000,stage);}
const STEP_LINES=['Roll it back and forth','Roll another snowball','Roll the little snowball','Drag the coal face','Pick a hat and a scarf'];
const spoken=p=>p.evaluate(L=>__quiet.speech.map(x=>typeof x==='string'?x:(x&&(x.text||x.line))||'').filter(t=>L.some(l=>t.indexOf(l)>=0)),STEP_LINES);
const part=process.env.SNOWMAN_PART,PORT=8356;
try{
 h=await gameHarness('snowman',PORT);const fresh=(opts={})=>h.fresh({...opts,device:{age:'4',...opts.device}});
 if(!part||part==='rebuild'){
  // ── the rebuild: no easy mode from the word, Echo once a visit, the demo,
  //    and the hat and neck the child picks ──
  {const {page,context,errors}=await fresh();await page.locator('#startBtn').click();
   ok('two sayings earn the first snowball',await sayWord(page));let s=await state(page);
   ok('the word brings the snowball and nothing else: no power, slow rolling, a finger-sized circle',s.snow.active&&s.snow.power===0&&Math.abs(s.snow.growthRate-0.6)<1e-9&&s.snow.magnet*s.snow.width<=Math.max(30,s.snow.target.r*s.snow.width*0.6)+0.5,s.snow);
   ok('until the child touches the snowball, a see-through one shows how to roll',s.snow.demo==='roll'&&!s.snow.touched,s.snow);
   ok('Echo explains rolling the first time',await until(page,()=>__snowman.told.indexOf('roll')>=0,4000)&&await until(page,()=>__quiet.speech.some(t=>/Roll it back and forth/.test(t)),6000),await spoken(page));
   await grab(page);s=await state(page);ok('a touch ends the demo for the step',s.snow.touched&&s.snow.demo==='',s.snow);await page.mouse.up();
   ok('the first snowball still stacks by real rolling',await roll(page,0));
   for(let st=1;st<3;st++){ok('word '+(st+1)+' brings the next snowball',await sayWord(page));s=await state(page);ok('snowball '+(st+1)+': no line from Echo, the see-through roll shows the move instead',s.snow.demo==='roll'&&s.snow.power===0,s.snow);ok('snowball '+(st+1)+' stacks',await roll(page,st));}
   let lines=await spoken(page);ok('three snowballs, one rolling line from Echo',lines.filter(t=>/Roll/.test(t)).length===1,lines);
   ok('the face word brings the coal and carrot',await sayWord(page));s=await state(page);ok('the face pieces sit in the tray with the see-through drag showing',s.snow.mode==='face'&&s.snow.demo==='drag'&&s.snow.tray.length===2,s.snow);
   ok('the face goes on',await decorate(page,3));
   ok('the dressing word brings the hats',await sayWord(page));s=await state(page);
   const hats=s.snow.tray.map(t=>t.look);ok('the dressing starts with the hats: three to pick from, one spot on the snowman',s.snow.dressing==='hat'&&s.snow.tray.length===3&&s.snow.tray.every(t=>t.id==='hat')&&[...hats].sort().join()==='crown,party,tophat'&&s.snow.targets.length===1&&s.snow.targets[0].choice,s.snow);
   await piece(page,s.snow.targets[0],{look:'party'});s=await state(page);
   ok('the party hat picked is the one on the snowman, and the neck pieces come next',s.snow.placed.hat==='party'&&s.snow.dressing==='scarf'&&[...s.snow.tray.map(t=>t.look)].sort().join()==='bow,scarf'&&s.speech.step===4,s.snow);
   ok('…with the see-through drag showing again for the new pieces',s.snow.demo==='drag',s.snow);
   await piece(page,s.snow.targets[0],{look:'bow'});s=await state(page);
   ok('the bow tie picked is on, and the twig arms come last',s.snow.placed.scarf==='bow'&&s.snow.dressing==='arms'&&s.snow.tray.length===1&&s.snow.tray[0].id==='arms',s.snow);
   ok('the arms finish the snowman',await decorate(page,4));await advance(page,3300);s=await state(page);
   ok('the snowman is done, wearing what the child picked',s.speech.phase==='end'&&s.snow.won&&s.snow.placed.hat==='party'&&s.snow.placed.scarf==='bow'&&s.snow.placed.arms,s.snow);
   lines=await spoken(page);ok('a whole snowman: Echo explained the rolling, the face and the dressing, once each',lines.length===3&&/Roll it back/.test(lines[0])&&/Drag the coal face/.test(lines[1])&&/Pick a hat and a scarf/.test(lines[2]),lines);
   await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-snowman-picked.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='');
   // Play again: no lines from Echo now, the demo shows every move
   await page.locator('#again').click();await advance(page,350);
   for(let st=0;st<3;st++){if(!await sayWord(page))throw Error('again word '+st);if(st===0){s=await state(page);ok('Play again: the first snowball shows the see-through roll, and Echo says nothing',s.snow.demo==='roll',s.snow);}if(!await roll(page,st))throw Error('again roll '+st);}
   if(!await sayWord(page))throw Error('again face');if(!await decorate(page,3))throw Error('again face drag');
   if(!await sayWord(page))throw Error('again dress');if(!await decorate(page,4,{hat:'crown',scarf:'scarf'}))throw Error('again dress drag');await advance(page,3300);s=await state(page);
   ok('a second snowman can wear something else: the crown and the scarf',s.snow.placed.hat==='crown'&&s.snow.placed.scarf==='scarf'&&s.snow.won,s.snow);
   lines=await spoken(page);ok('Play again added no lines from Echo',lines.length===3,lines);
   await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-snowman-crown.png')});
   ok('the rebuild has no runtime errors',errors.length===0,errors);await context.close();}
  // "Hear what to do" still says the step's line on a tap
  {const {page,context,errors}=await fresh();await page.locator('#startBtn').click();await sayWord(page);await roll(page,0);await sayWord(page);const before=(await spoken(page)).length;
   await page.locator('#snowmanHearStep').click();await until(page,()=>__quiet.speech.some(t=>/Roll another/.test(t)),6000);
   ok('"Hear what to do" says the step\'s line on a tap, also on a step Echo kept quiet',(await spoken(page)).length===before+1&&(await spoken(page)).some(t=>/Roll another/.test(t)),await spoken(page));
   ok('hear-step has no runtime errors',errors.length===0,errors);await context.close();}
  // The see-through copy really moves with motion on, and stands still under
  // Reduce Motion: read where drawDemo() put it at three moments, 0.6 s
  // apart (a quarter of its 2.4 s loop, so three samples can never all match
  // by chance), and that it was drawn in between. Each set waits a few
  // frames first, so a frame drawn before Reduce Motion changed is not read.
  {const {page,context,errors}=await fresh();await page.locator('#startBtn').click();await sayWord(page);
   const samples=async()=>{const out=[];await advance(page,100);for(let n=0;n<3;n++){if(n)await advance(page,600);out.push((await state(page)).snow.demoShown);}return out;};
   const moved=a=>new Set(a.map(d=>Math.round(d.x)+','+Math.round(d.y))).size>1,drawn=a=>a.every((d,n)=>!n||d.n>a[n-1].n);
   let a=await samples();ok('Reduce Motion: the see-through snowball is drawn, standing still',a.every(d=>d.kind==='roll')&&drawn(a)&&!moved(a),a);
   await page.emulateMedia({reducedMotion:'no-preference'});a=await samples();
   ok('motion on: the see-through snowball rolls back and forth',a.every(d=>d.kind==='roll')&&drawn(a)&&moved(a),a);
   if(!await roll(page,0))throw Error('demo roll 0');for(let st=1;st<3;st++){if(!await sayWord(page)||!await roll(page,st))throw Error('demo roll '+st);}
   if(!await sayWord(page))throw Error('demo face word');a=await samples();ok('motion on: the see-through piece glides to its spot',a.every(d=>d.kind==='drag')&&drawn(a)&&moved(a),a);
   await page.emulateMedia({reducedMotion:'reduce'});a=await samples();ok('Reduce Motion again: the see-through piece stands still',a.every(d=>d.kind==='drag')&&drawn(a)&&!moved(a),a);
   ok('demo motion has no runtime errors',errors.length===0,errors);await context.close();}
 }
 if(!part||part==='main'){
  {// (d) parked: a typed address goes Home, which says it is coming soon, before any mic or sound
   const {page,context,errors}=await fresh({unpark:false});
   await context.addInitScript(()=>{if(location.pathname!=='/arcade-snowman.html')return;try{sessionStorage.setItem('snow.seen','1');}catch(e){}addEventListener('pagehide',()=>{try{sessionStorage.setItem('snow.quiet',JSON.stringify({requests:__quiet.requests,mics:__quiet.mics.length,sounds:__quiet.sounds.length,sfx:__quiet.sfx.length,speech:__quiet.speech.length}));}catch(e){}});});
   await page.goto('http://127.0.0.1:'+PORT+'/arcade-snowman.html');
   const home=await until(page,()=>/\/(today|activities)\.html/.test(location.pathname)&&!!document.getElementById('libraryMessage')&&/Build a Snowman is coming soon/.test(document.getElementById('libraryMessage').textContent),8000);
   ok('the parked snowfield goes back to Home, which says it is coming soon',home&&!page.url().includes('arcade-snowman'),{url:page.url()});
   const led=await page.evaluate(()=>({seen:sessionStorage.getItem('snow.seen'),quiet:JSON.parse(sessionStorage.getItem('snow.quiet')||'null'),requests:__quiet.requests}));
   ok('the parked snowfield opens no microphone and makes no sound',led.seen==='1'&&led.quiet&&led.quiet.requests===0&&led.quiet.mics===0&&led.quiet.sounds===0&&led.quiet.sfx===0&&led.quiet.speech===0&&led.requests===0,led);
   ok('parked bounce has no runtime errors',errors.length===0,errors);await context.close();}
  const {page,context,errors}=await fresh();const board=await page.locator('#snowmanCanvas').count();ok('Snowman has a real rolling and stacking board',board===1);if(!board)throw Error('Snowman is still a spoken reveal');await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);await advance(page,1600);let s=await state(page);ok('silence cannot build the snowman',!s.snow.active&&s.snow.completed===0&&s.speech.step===0,s);ok('two sayings earn the first snowball',await sayWord(page));await advance(page,1800);s=await state(page);ok('a word and idle animation cannot grow or stack snow',s.snow.ball.progress===0&&s.snow.stacked.every(x=>!x)&&s.speech.step===0,s);await grab(page);await advance(page,1300);await page.mouse.up();s=await state(page);ok('holding still does not grow a snowball',s.snow.ball.progress===0&&!s.snow.ball.ready,s);
  await grab(page);await move(page,s.snow.target);await page.mouse.up();await advance(page,60);s=await state(page);ok('an undersized snowball cannot stack',!s.snow.ball.ready&&s.snow.completed===0&&s.speech.step===0,s);const z=s.snow.rollZone,y=(z.top+z.bottom)/2;await grab(page);await move(page,{x:.4,y});await page.mouse.up();await advance(page,11000);s=await state(page);
  // (c) a help ask nobody answers gives the same move back: no power, same step, same snowball
  {const was={...s.snow.ball};ok('the word power has run out before the help checks',s.snow.power===0,s.snow);
   await page.locator('#snowmanHelp').click();await until(page,()=>__sayplay.listening);ok('help shows Back to the game',await page.locator('#helpBack').isVisible());
   await advance(page,13500);s=await state(page);
   ok('help, then 13 s of silence: the same snowball, playing again, no power',s.speech.phase==='play'&&!s.snow.paused&&s.snow.active&&s.snow.power===0&&s.speech.step===0&&s.snow.ball.progress===was.progress&&s.snow.ball.x===was.x&&s.snow.ball.y===was.y&&!await page.locator('#snowBall').isDisabled()&&!await page.locator('#helpBack').isVisible(),{s,was});
   await page.locator('#snowmanHelp').click();await until(page,()=>__sayplay.listening);await page.locator('#helpBack').click();await advance(page,60);s=await state(page);
   ok('a tap on Back to the game: the same snowball, no power',s.speech.phase==='play'&&!s.snow.paused&&s.snow.power===0&&s.speech.step===0&&s.snow.ball.progress===was.progress&&s.snow.ball.x===was.x&&!await page.locator('#snowBall').isDisabled(),{s,was});}
  const ordinaryStart=s.snow.ball.progress;await smallRoll(page,.035);s=await state(page);const ordinary=s.snow.ball.progress-ordinaryStart,keep={...s.snow.ball};ok('real movement on snow grows the ball',ordinary>0&&ordinary<.3,s);ok('the snow lane is there while a snowball is rolled, with its trail',s.snow.lane&&s.snow.trail>0,s.snow);await page.locator('#snowmanHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('help keeps accumulated snow and the current ball',s.snow.paused&&s.snow.ball.progress===keep.progress&&s.snow.ball.distance===keep.distance&&s.snow.ball.x===keep.x&&s.snow.ball.y===keep.y,s);await page.evaluate(()=>__quiet.background());await advance(page,350);await page.evaluate(()=>__quiet.foreground());ok('backgrounding the help ask keeps snow controls locked',(await state(page)).snow.paused);await page.locator('#resume').click();await advance(page,60);s=await state(page);ok('coming back from a paused help ask gives the same snowball back, no power',s.speech.phase==='play'&&!s.snow.paused&&s.snow.power===0&&s.snow.ball.progress===keep.progress&&s.snow.ball.x===keep.x&&!await page.locator('#snowBall').isDisabled(),s);await page.locator('#snowmanHelp').click();ok('repeated speech renews the same snowball',await sayWord(page));s=await state(page);const boostedStart=s.snow.ball.progress;await smallRoll(page,-.035);s=await state(page);ok('the same rolling distance collects more snow with speech help',s.snow.ball.progress-boostedStart>ordinary*1.3&&s.speech.step===0,{ordinary,boosted:s.snow.ball.progress-boostedStart});
  await grab(page);await move(page,{x:.4,y:z.top-.14});s=await state(page);const offSnow=s.snow.ball.progress;await move(page,{x:.7,y:z.top-.14});await move(page,{x:.3,y:z.top-.14});s=await state(page);ok('rolling outside the snow lane cannot collect snow',s.snow.ball.progress===offSnow,s);await page.locator('#snowBall').evaluate(e=>e.dispatchEvent(new PointerEvent('pointercancel',{pointerId:99})));ok('a different pointer cannot release the snowball',(await state(page)).snow.held);await page.evaluate(()=>__quiet.background());await advance(page,350);await page.mouse.up();await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();s=await state(page);ok('an interrupted roll releases its hold and preserves the snow',!s.snow.held&&!s.snow.paused&&s.snow.ball.progress===offSnow&&s.speech.step===0,s);
  ok('a grown ball can miss without losing its size',await roll(page,0,{miss:true}),await state(page));s=await state(page);ok('a missed grown ball stays ready on the same word',s.snow.ball.ready&&s.snow.ball.progress===1&&s.speech.step===0,s);ok('a real drop stacks the bottom snowball',await roll(page,0),await state(page));
  for(let stage=1;stage<3;stage++){if(!await sayWord(page))throw Error('Could not earn snowball '+stage);s=await state(page);ok('the next ball starts small and waits for real rolling',!s.snow.ball.ready&&s.snow.ball.progress===0&&s.snow.stacked.filter(Boolean).length===stage,s);ok('real rolling and placement stack snowball '+(stage+1),await roll(page,stage),await state(page));}
  s=await state(page);ok('painted snowballs overlap enough to stay in contact at every rotation',s.snow.stack.slice(1).every((b,i)=>Math.abs(b.y-s.snow.stack[i].y)*s.snow.height/s.snow.width<=(b.r+s.snow.stack[i].r)*.88),s.snow.stack);
  // rolling is done: the lane (and its smudge trail) once stayed for good,
  // its top showing above the word panel and under the finished snowman
  await until(page,()=>__sayplay.listening,6000);s=await state(page);ok('rolling done, the word turn has no snow lane poking out above its panel',s.speech.listening&&!s.snow.lane,{lane:s.snow.lane,phase:s.speech.phase});
  await page.screenshot({path:path.join(OUT,'sona-snowman-stacked.png')});for(let stage=3;stage<5;stage++){if(!await sayWord(page))throw Error('Could not earn the next snowman pieces');s=await state(page);ok('speech never places the new face or clothes',s.snow.targets.every(t=>!t.placed)&&s.snow.completed===stage,s);ok('the pieces sit in a clean tray: the lane with no rolling trail',s.snow.lane&&s.snow.trail===0,{lane:s.snow.lane,trail:s.snow.trail});if(stage===3){await piece(page,s.snow.targets[0]);s=await state(page);const placed=JSON.stringify(s.snow.placed);await page.locator('#snowmanHelp').click();await sayWord(page);ok('speech help keeps the already placed face piece',JSON.stringify((await state(page)).snow.placed)===placed&&(await state(page)).speech.step===stage);await piece(page,(await state(page)).snow.targets.find(t=>!t.placed),{background:true});s=await state(page);ok('an interrupted face piece returns to its tray without losing the first',!s.snow.held&&!s.snow.paused&&s.snow.targets.filter(t=>t.placed).length===1&&s.speech.step===stage,s);}ok('actual drags complete snowman step '+(stage+1),await decorate(page,stage),await state(page));}
  await advance(page,3300);s=await state(page);ok('five physical activities finish a complete snowman',s.speech.phase==='end'&&s.speech.step===5&&s.snow.completed===5&&s.snow.stacked.every(Boolean)&&s.snow.won,s);ok('the finished snowman stands on clean snow: no lane, no trail',!s.snow.lane&&s.snow.trail===0,{lane:s.snow.lane,trail:s.snow.trail});const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));ok('snow sounds and instructions never reach the microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);ok('the child hears the rolling and dressing directions',/roll/i.test(audio.lines.join('|'))&&/hat|scarf/i.test(audio.lines.join('|')),audio.lines);await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-snowman-finished.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='');await page.locator('#again').click();await advance(page,350);s=await state(page);ok('a new snowman starts with no stack or automatic snow',s.speech.step===0&&s.snow.completed===0&&!s.snow.active&&s.snow.stacked.every(x=>!x),s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 if(!part||part==='ladder'){
  // (a)+(b) a child who never says the help word and keeps missing still finishes every kind of step
  const {page,context,errors}=await fresh();await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
  await advance(page,15000);await advance(page,13000);let s=await state(page);ok('two quiet windows (Echo asks the word again once between them) earn no snowball and no step',!s.snow.active&&s.snow.ball.progress===0&&s.speech.step===0,s);await page.locator('#micBtn').click();
  if(!await sayWord(page))throw Error('no first word');
  // rolling only above the snow grows nothing at first, then the lane glows, then any rolling counts
  const z=(await state(page)).snow.rollZone,above=z.top-.12;await grab(page);await move(page,{x:.3,y:above});
  const levels=[];for(let n=0;n<48;n++){await move(page,{x:n%2?.3:.7,y:above},4);await advance(page,200);s=await state(page);levels.push(s.snow.rollHelp);if(s.snow.ball.ready)break;}
  await move(page,{x:.3,y:(z.top+z.bottom)/2});await page.mouse.up();s=await state(page);
  ok('rolling off the snow steps up by time: the lane glows after about 4 s, any rolling counts after about 8 s',levels.slice(0,10).every(l=>l===0)&&levels.includes(1)&&levels.includes(2)&&levels.indexOf(2)>levels.indexOf(1)+8,levels);
  ok('the struggling roller still had to roll: the ball grew only once the help reached the top',s.snow.ball.ready&&s.speech.step===0&&s.snow.stageMisses===0,s.snow);
  // aiming: two lifts far from the circle, then anywhere above the snow stacks it
  const far={x:.1,y:above};
  for(let m=1;m<=2;m++){await grab(page);await move(page,far);await page.mouse.up();await advance(page,80);s=await state(page);ok('missed lift '+m+' keeps the step and raises the help to '+m,s.speech.step===0&&s.snow.level===m&&s.snow.stageMisses===m&&!s.snow.stacked[0]&&s.snow.ball.ready,s.snow);}
  ok('after a miss the circle widens to at least twice the finger window',s.snow.magnet*s.snow.width>=60,s.snow);
  await grab(page);await move(page,{x:.15,y:above-.05});await page.mouse.up();s=await state(page);
  ok('from the second miss a lift anywhere above the snow stacks the ball, with a celebration first',s.snow.stacked[0]&&s.snow.celebrating&&s.speech.step===0,s.snow);
  await advance(page,600);s=await state(page);ok('the step waits for the celebration beat',s.speech.step===0,s.speech);
  ok('then the step counts, once',await until(page,()=>__sayplay.step===1,3000)&&(await state(page)).snow.level===0,await state(page));
  await advance(page,1500);ok('done once: still on step 1',(await state(page)).speech.step===1);
  for(let stage=1;stage<3;stage++){if(!await sayWord(page))throw Error('word '+stage);ok('ladder resets for snowball '+(stage+1),(await state(page)).snow.level===0);if(!await roll(page,stage))throw Error('roll '+stage);}
  if(!await sayWord(page))throw Error('face word');s=await state(page);
  // a piece let go a finger-width off its spot lands at once
  {const t=s.snow.targets.find(t=>t.id==='nose');await piece(page,{...t,x:t.x+25/s.snow.width});s=await state(page);ok('a piece dropped 25 px off its spot lands (finger-sized window)',s.snow.placed.nose&&s.snow.level===0,s.snow);}
  // the coal face dropped far away, twice: glow and arrow, then anywhere on the snowman's side
  {const far2={x:.08,y:z.top-.03};
   for(let m=1;m<=2;m++){await piece(page,{id:'coal',...far2});s=await state(page);ok('missed face drop '+m+' goes back to the tray and raises the help to '+m,!s.snow.placed.coal&&s.snow.level===m&&s.speech.step===3,s.snow);}
   await page.screenshot({path:path.join(OUT,'sona-snowman-ladder.png')});
   await piece(page,{id:'coal',...far2});s=await state(page);ok('the third try anywhere above the snow puts the face on',s.snow.placed.coal&&s.snow.celebrating,s.snow);
   ok('the face step counts after the beat with no speech help',await until(page,()=>__sayplay.step===4,3000));}
  {if(!await sayWord(page))throw Error('dress word');s=await state(page);const t=s.snow.targets[0];
   const tr=s.snow.tray[0];await piece(page,{id:t.id,x:tr.x+10/s.snow.width,y:tr.y});s=await state(page);ok('a small nudge inside the tray is not a miss',s.snow.stageMisses===0&&!s.snow.placed[t.id],s.snow);
   ok('the dressing step finishes too',await decorate(page,4));}
  await advance(page,3300);s=await state(page);ok('the struggling child reaches the end',s.speech.phase==='end'&&s.snow.won,s.speech);
  const words=await page.evaluate(()=>[document.body.innerText,...[...document.querySelectorAll('[aria-label]')].map(e=>e.getAttribute('aria-label')),...__quiet.speech].join(' | '));
  ok('no unkind or scoring words',!/\b(miss(ed)?|wrong|fail(ed)?|score|points|correct)\b/i.test(words),words.slice(0,400));
  ok('ladder has no runtime errors',errors.length===0,errors);await context.close();
 }
 if(!part||part==='keyboard'){
  const {page,context}=await fresh();await page.locator('#startBtn').click();await sayWord(page);await page.locator('#snowBall').focus();await page.keyboard.press('Space');let s=await state(page);const before={...s.snow.ball};ok('keyboard picks up the actual snowball',s.snow.held==='ball'&&s.snow.keyboardHeld,s);await page.keyboard.press('ArrowRight');s=await state(page);ok('keyboard movement really rolls and grows snow',s.snow.ball.x>before.x&&s.snow.ball.progress>before.progress&&s.snow.ball.distance>before.distance,s);await page.keyboard.press('Space');s=await state(page);ok('keyboard drop obeys the same undersized-ball rule',!s.snow.held&&!s.snow.stacked[0]&&s.speech.step===0,s);await context.close();
 }
 if(!part||part==='fit'){
  {const {page,context,errors}=await fresh({blockAssets:true});await page.locator('#startBtn').click();await sayWord(page);ok('missing painted art cannot prevent real snow rolling',await roll(page,0));ok('fallback has no runtime errors',errors.length===0,errors);await context.close();}
  for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024}]){
   const {page,context,errors}=await fresh({viewport});await page.locator('#startBtn').click();for(let stage=0;stage<5;stage++){
    {await until(page,()=>__sayplay.listening);const f=await page.evaluate(()=>{const r=id=>{const e=document.getElementById(id);if(!e)return null;const b=e.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,w:b.width,h:b.height};};return{width:innerWidth,height:innerHeight,panel:r('turnPanel'),hear:r('hear'),top:r('top')};});
     ok('the word turn fits at '+viewport.width+'x'+viewport.height+' step '+(stage+1),f.panel.x>=0&&f.panel.right<=f.width&&f.panel.y>=f.top.bottom&&f.panel.bottom<=f.height&&f.hear.w>=44&&f.hear.h>=44,f);}
    if(!await sayWord(page))throw Error('Could not earn fitted snowman step '+stage);
    if(stage===0||stage===3){await page.locator('#snowmanHelp').click();await until(page,()=>__sayplay.listening);const f=await page.evaluate(()=>{const r=id=>{const e=document.getElementById(id);if(!e||e.hidden)return null;const b=e.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,w:b.width,h:b.height};};return{width:innerWidth,height:innerHeight,panel:r('turnPanel'),back:r('helpBack'),top:r('top')};});
     ok('the help ask and Back to the game fit at '+viewport.width+'x'+viewport.height,f.back&&f.panel.x>=0&&f.panel.right<=f.width&&f.panel.y>=f.top.bottom&&f.panel.bottom<=f.height&&f.back.y>=f.panel.y&&f.back.bottom<=f.panel.bottom+.5&&f.back.h>=44&&f.back.w>=44,f);
     await page.screenshot({path:path.join(OUT,'sona-snowman-help-'+viewport.width+'.png')});await page.locator('#helpBack').click();await advance(page,60);}
    {const f=await page.evaluate(()=>{const S=__snowman,ban=document.getElementById('snowmanBanner').getBoundingClientRect(),ctl=document.getElementById('snowmanControls').getBoundingClientRect(),hd=S.stack[2],headTop=hd.y*S.height-hd.r*S.width*2.85,lane=S.rollZone;return{headTop,banner:ban.bottom,laneTop:lane.top*S.height,laneBottom:lane.bottom*S.height,controls:ctl.top,base:S.stack[0].y*S.height+S.stack[0].r*S.width};});
     ok('the snowman, its hat spot and the snow lane are clear of the banner and buttons at '+viewport.width+'x'+viewport.height,f.headTop>=f.banner-2&&f.laneBottom<=f.controls+1&&f.base<=f.laneTop+1,f);}const fit=await page.evaluate(()=>{const ids=__snowman.mode==='roll'?['snowBall']:__snowman.tray.map((t,i)=>'snowPiece'+i),rects=['snowmanHelp','snowmanHearStep',...ids].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};});return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,rects};});ok('snowman step '+(stage+1)+' fits '+viewport.width,fit.scroll<=fit.height+1&&fit.rects.every(r=>r.x>=0&&r.y>=0&&r.right<=fit.width&&r.bottom<=fit.height&&r.w>=44&&r.h>=44),fit);ok('real play completes fitted step '+(stage+1),stage<3?await roll(page,stage):await decorate(page,stage),await state(page));}await advance(page,3300);await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-snowman-'+viewport.width+'.png')});ok('fit has no runtime errors',errors.length===0,errors);await context.close();
  }
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
