// Fish Tank (ages 3-4): the word earns each fish's food, the finger drags it
// above the fish and lets go, and every fish gets fed with no more speech (the
// misses ladder). FISHTANK_PART=main|keyboard|fit runs one part.
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {OUT,ROOT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d).slice(0,1500)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,tank:window.__fishtank}));
const tank=async p=>(await state(p)).tank;
async function move(p,q,steps=12){const b=await p.locator('#tankCanvas').boundingBox();await p.mouse.move(b.x+q.x*b.width,b.y+q.y*b.height,{steps});}
async function hold(p){const b=await p.locator('#tankFood').boundingBox();if(!b)throw Error('Missing actual food pinch');await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();}
// Where a finger lets go. The game's own arrow point (`target`) is what a
// child following the arrow does; the others are a struggling child's tries.
function spot(s,kind){const b=s.feedingBand,f=s.current;
 if(kind==='arrow')return s.target;
 if(kind==='wide')return{x:f.mouth.x>.5?b.left+.012:b.right-.012,y:(b.top+b.bottom)/2};   // in the band, far from the fish
 if(kind==='low')return{x:f.mouth.x,y:Math.min(f.mouth.y+.1,s.jar.y-.1)};               // a real drag, let go below the fish
 if(kind==='sloppy')return{x:s.jar.x-.18,y:s.jar.y-.16};                                 // a short drag up and to the side
 return{x:.04,y:.85};}
async function drop(p,kind,{background=false}={}){const s=await tank(p);await hold(p);await move(p,spot(s,kind));if(background){await p.evaluate(()=>__quiet.background());await advance(p,350);await p.mouse.up();return;}await p.mouse.up();await advance(p,80);}
// wait for this batch to finish: eaten, or every bite on the sand
async function settle(p,before){await until(p,c=>!__fishtank.pellets.length||__fishtank.completed>c,5000,before);}
// one fish, finger only: follow the arrow (or the struggling child's ladder)
async function feedOne(p,kinds=['arrow','arrow','arrow','arrow']){const c=(await tank(p)).completed;for(const k of kinds){if((await tank(p)).completed>c)break;await drop(p,k);await settle(p,c);}return until(p,c=>__fishtank.completed>c,500,c);}
const stepTo=(p,n)=>until(p,n=>__sayplay.step===n,2500,n);
const part=process.env.FISHTANK_PART;
try{
 h=await gameHarness('fishtank',8362);// The harness's fake clock still flows with real time between calls; paused,
 // time moves only in advance(), so a busy machine changes nothing.
 const fresh=async(o={})=>{const r=await h.fresh({...o,device:{age:'4',...o.device}});await r.page.clock.pauseAt(await r.page.evaluate(()=>Date.now()+500));return r;};
 if(!part||part==='main'){
  // (d) parked: Home, which says so, before any microphone or sound
  {const{page,context}=await fresh({unpark:false});const home=await until(page,()=>/\/(today|activities)\.html/.test(location.pathname)&&!!document.getElementById('libraryMessage')&&/Fish Tank is coming soon/.test(document.getElementById('libraryMessage').textContent),8000);
   const q=await page.evaluate(()=>({req:__quiet.requests,snd:__quiet.soundsBefore}));
   ok('the parked aquarium goes back to Home, which says it is coming soon',home&&!page.url().includes('arcade-fishtank'),{url:page.url()});ok('the parked aquarium never opens a microphone or plays a sound',q.req===0&&q.snd===0,q);await context.close();}
  const{page,context,errors}=await fresh();const real=await page.locator('#tankCanvas').count();ok('Fish Tank has a real aquarium and food control',real===1);if(!real)throw Error('Still an automatic fish reveal');
  const words=await page.evaluate(()=>({start:document.querySelector('#startOvl .ovlCard').textContent,primer:document.querySelector('#primer .ovlCard').textContent,help:document.getElementById('tankHelp').getAttribute('aria-label')}));
  ok('the start card and mic card say the word earns the food',/Say each word two times to get fish food/.test(words.start)&&/two times to get food for each fish/.test(words.primer)&&/Optional/.test(words.help)&&!/easier bites/.test(words.start+words.primer),words);
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);await advance(page,1200);let s=await state(page);const visible=s.tank.fish.length;
  // (a) silence earns nothing, even past the listening window
  ok('silence never feeds a fish',!s.tank.active&&s.tank.completed===0&&s.tank.catches===0,s);await advance(page,13000);s=await state(page);ok('a whole quiet listening window earns nothing',!s.tank.active&&s.tank.spawned===0&&s.speech.step===0&&s.speech.phase==='nudge'&&await page.locator('#tankFood').isDisabled(),s);
  const lines=await page.evaluate(()=>__quiet.speech.slice());ok('Echo says the word earns the food',lines.some(l=>/Say each word two times to get fish food/.test(l)),lines);
  await page.locator('#micBtn').click();ok('two sayings earn the first fish its food',await sayWord(page));s=await state(page);ok('the word never adds or feeds a fish',s.tank.fish.length===visible&&s.tank.completed===0&&s.tank.catches===0&&s.tank.power>0&&s.tank.ladder===0,s.tank);
  const calm=s.tank.current.motionRate;await advance(page,10500);s=await state(page);const ordinary=s.tank.current.motionRate;ok('swimming and idle time never drop food',s.tank.spawned===0&&s.tank.completed===0&&s.tank.power===0,s.tank);ok('the word made the fish swim slower for a while',calm<ordinary*.5,{calm,ordinary});
  await hold(page);await page.mouse.up();await advance(page,200);s=await state(page);ok('a tap on the jar drops nothing and is not a miss',s.tank.spawned===0&&s.tank.misses===0,s.tank);
  // help: the same move comes back, whether the help word is said or not
  await drop(page,'wide');s=await state(page);ok('one release makes a finite batch of real food',s.tank.batches===1&&s.tank.spawned===s.tank.batchSize&&s.tank.pellets.length===5&&s.tank.ladder===0,s.tank);const yp=s.tank.pellets[0].y;
  const was=s.tank;await page.locator('#tankHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('asking for help freezes the same falling food',s.tank.paused&&s.speech.step===0&&JSON.stringify(s.tank.pellets)===JSON.stringify(was.pellets)&&await page.locator('#helpBack').isVisible(),s);
  const same=x=>x.speech.phase==='play'&&!x.speech.paused&&!x.tank.paused&&x.tank.active&&x.tank.power===0&&x.speech.step===0&&x.tank.stage===0&&x.tank.catches===was.catches&&x.tank.completed===0;
  await advance(page,13500);s=await state(page);ok('help, then 13 s of silence: the same fish and food, no power, playing again',same(s)&&!await page.locator('#helpBack').isVisible()&&await page.locator('#tankFood').isEnabled(),{s,was});
  ok('the frozen food sinks again from where it stopped',s.tank.pellets.length>0?s.tank.pellets[0].y>yp:s.tank.landed>0,s.tank);await settle(page,0);s=await state(page);
  ok('food that sinks far from the fish is a miss: the fish glows and an arrow points',s.tank.completed===0&&s.tank.landed===5&&s.tank.misses===1&&s.tank.ladder===1&&s.tank.glow&&!!s.tank.target,s.tank);
  ok('one miss: the fish swims about half as fast and its ring is wider',s.tank.current.motionRate<=ordinary*.5&&s.tank.current.catchRadius>.06,s.tank.current);
  const said=await page.evaluate(()=>__quiet.speech.slice(-3));ok('Echo says kindly where to let go',said.some(l=>/So close! Let go higher, at the arrow/.test(l)),said);
  await drop(page,'away');s=await state(page);ok('letting go outside the water drops no food',s.tank.spawned===5&&!s.tank.held,s.tank);ok('a real drag let go too low is a miss too: the fish holds still',s.tank.misses===2&&s.tank.ladder===2&&s.tank.current.motionRate===0,s.tank);
  await page.locator('#tankHelp').click();await until(page,()=>__sayplay.listening);await page.locator('#helpBack').click();await advance(page,100);s=await state(page);ok('"Back to the game" gives the same move back at once, no power',same(s)&&s.tank.misses===2&&await page.locator('#tankFood').isEnabled(),s);
  await page.locator('#tankHelp').click();await until(page,()=>__sayplay.listening);await page.evaluate(()=>__quiet.background());await advance(page,300);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await advance(page,100);s=await state(page);ok('a help ask cut off by the lock screen gives the same move back',same(s),s);
  await page.locator('#tankHelp').click();ok('the help word can still be said',await sayWord(page));s=await state(page);ok('a heard help word adds calmer fish on the same fish',s.tank.power>0&&s.speech.step===0&&s.tank.ladder===2,s.tank);
  // a drag cancelled by the lock screen drops nothing
  await drop(page,'sloppy',{background:true});s=await state(page);const spawn=s.tank.spawned;await advance(page,1000);s=await state(page);ok('the lock screen sends an unreleased pinch back to the jar',s.tank.paused&&!s.tank.held&&s.tank.spawned===spawn,s.tank);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await advance(page,100);
  // two misses: almost anything works, and the finger still does it
  await advance(page,3000);ok('waiting never feeds the fish',(await tank(page)).completed===0);
  await drop(page,'sloppy');s=await state(page);ok('after two misses a short sloppy drag sends the food to the fish',s.tank.spawned>spawn&&s.tank.pellets.every(p=>p.pull),s.tank);
  await until(page,()=>__fishtank.completed===1,3000);s=await state(page);ok('the fish is fed by the finger',s.tank.completed===1&&s.tank.fed[0],s.tank);ok('the fish is cheered before the next word',s.tank.celebrating&&s.speech.step===0&&s.speech.phase==='play',s);
  await advance(page,800);ok('the cheer lasts about a second',(await state(page)).speech.step===0);ok('the step counts once after the cheer',await stepTo(page,1)&&!(await tank(page)).celebrating);
  const chimes=await page.evaluate(()=>__quiet.sfx.slice());ok('the fed fish gets a happy chime',chimes.some(x=>/correct/.test(JSON.stringify(x))),chimes);
  await advance(page,1500);s=await state(page);ok('the fed fish stays in the school and a new hungry fish comes',s.tank.completed===1&&s.tank.fish.length===visible+1&&s.speech.step===1,s.tank);
  // fish 2: a child who follows the arrow
  ok('second fish: the word is heard',await sayWord(page));s=await state(page);ok('a new word starts the ladder again',s.tank.ladder===0&&s.tank.misses===0&&s.tank.current.caught===0,s.tank);
  ok('food let go at the arrow feeds the fish',await feedOne(page),await tank(page));await stepTo(page,2);
  // (b) fish 3-5: a struggling child who keeps missing, and never says more
  for(let i=2;i<5;i++){const tag='fish '+(i+1);if(!await sayWord(page))throw Error('Could not earn fish '+(i+1));await advance(page,10500);
   await drop(page,'wide');await settle(page,i);s=await state(page);ok(tag+': one wide drop glows and points',s.tank.completed===i&&s.tank.ladder===1,s.tank);
   await drop(page,'low');s=await state(page);ok(tag+': a drop below the fish holds it still',s.tank.ladder===2&&s.tank.current.motionRate===0&&s.tank.spawned===s.tank.batches*5,s.tank);
   await drop(page,'sloppy');ok(tag+': a sloppy drag then feeds it with no speech',await until(page,c=>__fishtank.completed>c,3000,i),await tank(page));ok(tag+': the step counts',await stepTo(page,i+1));}
  await advance(page,3300);s=await state(page);ok('five fed fish make a real swimming school',s.speech.phase==='end'&&s.speech.step===5&&s.tank.completed===5&&s.tank.fed.every(Boolean)&&s.tank.won,s);
  const quiet=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));
  ok('aquarium sounds and directions never enter the microphone',quiet.leaks===0&&quiet.live===0&&quiet.overlap===0,quiet);ok('the child hears how to drop food',/food/i.test(quiet.lines.join('|'))&&/let go/i.test(quiet.lines.join('|'))&&!/in front of its mouth/.test(quiet.lines.join('|')),quiet.lines);
  {const js=readFileSync(path.join(ROOT,'fishtank.js'),'utf8'),html=readFileSync(path.join(ROOT,'arcade-fishtank.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,''),bad=(js.match(/"[A-Z][^"\n]*"/g)||[]).concat(html.match(/>[^<]{3,}</g)||[]).filter(x=>/\b(missed|wrong|fail|score|points|correct)\b/i.test(x));ok('no unkind words in anything the aquarium says',bad.length===0,bad);}
  await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-fishtank-finished.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='');
  await page.locator('#again').click();await advance(page,300);s=await state(page);ok('replay resets food, every feeding and the ladder',s.speech.step===0&&s.tank.completed===0&&s.tank.spawned===0&&s.tank.fed.every(v=>!v)&&!s.tank.active&&s.tank.misses===0&&!s.tank.celebrating,s);
  if(!await sayWord(page))throw Error('replay word');await advance(page,15000);s=await state(page);ok('15 s with no finger feeds nothing',s.tank.completed===0&&s.tank.spawned===0&&s.speech.step===0&&s.tank.ladder===0,s.tank);
  ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 if(!part||part==='keyboard'){
  const{page,context}=await fresh();await page.locator('#startBtn').click();await sayWord(page);await page.locator('#tankFood').focus();await page.keyboard.press('Space');let s=await state(page),start={...s.tank.pinch};ok('keyboard picks up a real food pinch',s.tank.held,s);await page.keyboard.press('ArrowLeft');s=await state(page);ok('keyboard physically moves the held pinch',s.tank.pinch.x<start.x,s);await page.keyboard.press('Escape');s=await state(page);ok('canceling keyboard food cannot spawn a batch',!s.tank.held&&s.tank.spawned===0,s);
  await page.keyboard.press('Space');for(let n=0;n<50;n++)await page.keyboard.press('ArrowUp');await page.keyboard.press('Space');await advance(page,50);s=await state(page);ok('keyboard: Space picks up, arrows lift the food, Space lets go',s.tank.spawned===5,s.tank);await context.close();
 }
 // (e) fit: play, a word turn and a help ask on four screens
 if(!part||part==='fit'){
  {const{page,context,errors}=await fresh({blockAssets:true});await page.locator('#startBtn').click();await sayWord(page);ok('missing paintings still allow real feeding',await feedOne(page,['wide','low','sloppy','sloppy']),await tank(page));ok('fallback has no runtime errors',errors.length===0,errors);await context.close();}
  const rects=(p,ids)=>p.evaluate(ids=>ids.map(id=>{const e=document.getElementById(id),r=e?e.getBoundingClientRect():{x:0,y:0,right:0,bottom:0,width:0,height:0};return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,shown:!!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'};}),ids);
  for(const viewport of[{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024}]){
   const tag=viewport.width+'x'+viewport.height,inside=r=>r.shown&&r.w>0&&r.x>=-.5&&r.y>=-.5&&r.right<=viewport.width+.5&&r.bottom<=viewport.height+.5,big=r=>r.w>=44&&r.h>=44;
   const{page,context,errors}=await fresh({viewport});await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
   let r=await rects(page,['turnPanel','hear','word']);ok(tag+': the word turn fits, with a big enough Hear it',r.every(inside)&&big(r[1]),r);
   if(!await sayWord(page))throw Error('Could not earn fitted fish');
   const fit=await page.evaluate(()=>{const rs=['tankFood','tankHelp','tankHearStep'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};}),c=document.getElementById('tankCanvas').getBoundingClientRect(),ban=document.getElementById('tankBanner').getBoundingClientRect(),ctl=document.getElementById('tankControls').getBoundingClientRect(),t=__fishtank,f=t.current;return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,rs,ban:ban.bottom,ctl:ctl.top,fish:{top:c.top+(f.y-f.h/2)*c.height,bottom:c.top+(f.y+f.h/2)*c.height},band:{top:c.top+t.feedingBand.top*c.height,bottom:c.top+t.feedingBand.bottom*c.height}};});
   ok(tag+': the food, the fish and the controls fit, nothing under the banner or buttons',fit.scroll<=fit.height+1&&fit.sw<=fit.width+1&&fit.rs.every(r=>r.x>=0&&r.y>=0&&r.right<=fit.width&&r.bottom<=fit.height&&r.w>=44&&r.h>=44)&&fit.fish.top>fit.ban&&fit.fish.bottom<fit.ctl&&fit.band.top>=fit.ban-1&&fit.rs[0].y>fit.ban,fit);
   await page.locator('#tankHelp').click();await until(page,()=>__sayplay.listening);r=await rects(page,['turnPanel','hear','helpBack','word']);ok(tag+': a help ask fits, with a big enough "Back to the game"',r.every(inside)&&big(r[1])&&big(r[2]),r);await page.locator('#helpBack').click();await advance(page,100);
   ok(tag+': a struggling child feeds the fish',await feedOne(page,['wide','low','sloppy','sloppy']),await tank(page));ok(tag+': the step counts',await stepTo(page,1));
   await until(page,()=>__sayplay.listening);r=await rects(page,['turnPanel','hear','word']);ok(tag+': the second word turn fits',r.every(inside)&&big(r[1]),r);
   await page.screenshot({path:path.join(OUT,'sona-fishtank-'+viewport.width+'.png')});ok(tag+': fit has no runtime errors',errors.length===0,errors);await context.close();}
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
