// Light the Way (STORY1, Day 1: The Lighthouse Sneeze): the word lights the
// lamp, the finger moves the pool of light and holds it on the lost boat, and
// every round ends with every boat home and the town lit, with no more
// speaking. Played through the real engine (sayplay.js) on a fake phone,
// with the clock paused: only advance() moves time, so a busy machine
// changes nothing.
//
// LIGHTHOUSE_PART=locked|main|struggle|help|buddy|fit|standins|keyboard|art
// runs one part, or several with commas (every part, without it): the whole
// suite is about four minutes, so run-all gives it in two or three pieces.
// LIGHTHOUSE_PORT moves the test server.
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {OUT,ROOT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
const PORT=Number(process.env.LIGHTHOUSE_PORT)||8371;
const part=process.env.LIGHTHOUSE_PART, run=n=>!part||part.split(',').includes(n);
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d===undefined?null:d).slice(0,1500)));}
const lh=p=>p.evaluate(()=>window.__lighthouse);
const both=p=>p.evaluate(()=>({sp:window.__sayplay,lh:window.__lighthouse}));
const stepTo=(p,n)=>until(p,n=>__sayplay.step===n,3000,n);
const BAN=/\b(miss(ed)?|wrong|fail(ed)?|score|points?|correct|charge)\b/i;
const STEP_LINES=["Move the light over the fog. Find the tugboat!","Find the rowboat with the three mice!","The sailboat is drifting. Find it with the light!","Find the banana boat! Something big is napping out there.","Uh oh, the moon went behind a cloud. Look by the big rocks for the teacup boat!","Find the bathtub boat. Rub-a-dub!","Find the big ferry and bring everyone home!","Now shine the light on the town. Light up every window!"];
const LITTLE_LINES=["Touch the glowing tugboat with the light!","Now the rowboat! Touch it with the light.","Find the banana boat with the light!","Find the bathtub boat. Rub-a-dub!","Find the sailboat with the light!","Touch every window with the light!"];
const BIG_BOATS=['tug','row','sail','banana','teacup','bathtub','ferry'],LITTLE_BOATS=['tug','row','banana','bathtub','sail'];
const fresh=async(o={})=>{const r=await h.fresh(o);await r.page.clock.pauseAt(await r.page.evaluate(()=>Date.now()+500));await advance(r.page,200);return r;};
const littleOpts=(o={})=>({...o,device:{age:'4',...(o.device||{})}});
async function begin(page){await page.locator('#startBtn').click();return sayWord(page);}
// one boat, finger only: press on the boat and follow it while it drifts or
// peeks out from the rocks, until the light has held on it
async function findBoat(page,max=9000){
 let s=await lh(page);const before=s.dones;
 await page.mouse.move(s.target.sx,s.target.sy);await page.mouse.down();
 for(let t=0;t<max;t+=100){s=await lh(page);if(s.beat>0||s.dones>before)break;await page.mouse.move(s.target.sx,s.target.sy);await advance(page,100);}
 s=await lh(page);await page.mouse.up();return s.beat>0||s.dones>before;
}
// the town: the finger sweeps over every dark window until the dock lights up
async function lightTown(page,max=12000){
 let s=await lh(page);const first=s.targets.find(t=>!t.lit),w0=s.windows[first?first.windows[0]:0];
 await page.mouse.move(w0.sx,w0.sy);await page.mouse.down();
 for(let t=0;t<max;t+=150){s=await lh(page);if(s.dockOn||s.beat>0)break;const n=s.targets.find(x=>!x.lit);if(!n)break;const w=s.windows[n.windows[0]];await page.mouse.move(w.sx,w.sy,{steps:3});await advance(page,150);}
 s=await lh(page);await page.mouse.up();return s.dockOn;
}
// A far place to search: on the sea, as far as can be from the lost boat
// (everywhere it can drift), its decoy and the town
function farFrom(s){
 const b=s.board,keep=[];const list=s.little?s.anchors.little:s.anchors.sea,pl=list[s.stage],X=x=>b.picX+x*b.picW,Y=y=>b.picTop+y*b.picH;
 if(pl.boat){const d=pl.drift||{x:0,y:0};keep.push({x:X(pl.x-d.x),y:Y(pl.y)},{x:X(pl.x+d.x),y:Y(pl.y)},{x:X(pl.x),y:Y(pl.y)});if(pl.peek)keep.push({x:X(pl.peek.x),y:Y(pl.peek.y)});if(pl.decoy)keep.push({x:X(pl.decoy.x),y:Y(pl.decoy.y)});}
 else s.windows.forEach(w=>keep.push({x:w.sx,y:w.sy}));
 let best=null,bd=-1;for(let x=b.left+30;x<=b.right-30;x+=10)for(let y=b.top+30;y<=b.bottom-30;y+=10){const d=Math.min(...keep.map(k=>Math.hypot(k.x-x,k.y-y)));if(d>bd){bd=d;best={x,y,d};}}
 return best;
}
// the finger searching far from anything, for `secs`: it moves every 0.2 s,
// inside the 0.4 s that still counts as searching
async function sweepFar(page,secs){
 const f=farFrom(await lh(page));await page.mouse.move(f.x,f.y);await page.mouse.down();
 for(let i=0;i<Math.round(secs*5);i++){await page.mouse.move(f.x+22*Math.sin(i),f.y+16*Math.cos(i));await advance(page,200);}
 return f;
}
// a real finger (pointerType touch: the light sits above it), dispatched on
// the canvas, for a child who puts the finger ON the boat or taps it
const touch=(p,type,x,y)=>p.evaluate(([type,x,y])=>{document.getElementById('seaCanvas').dispatchEvent(new PointerEvent(type,{pointerId:21,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,bubbles:true}));},[type,x,y]);
// a finger held perfectly still on (x, y), or on the lost boat, until the boat is found
async function holdStill(page,max,at){let s=await lh(page);const x=at?at.x:s.target.sx,y=at?at.y:s.target.sy;await touch(page,'pointerdown',x,y);let t=0;for(;t<max;t+=100){await advance(page,100);s=await lh(page);if(s.beat>0)break;}await touch(page,'pointerup',x,y);return{found:s.beat>0,t:t+100,s};}
// taps on the lost boat: down for `down` ms, one every `every` ms
async function tapBoat(page,down,every,max){let s=await lh(page),t=0;const seen=[];for(;t<max;t+=every){s=await lh(page);const x=s.target.sx,y=s.target.sy;await touch(page,'pointerdown',x,y);await advance(page,down);await touch(page,'pointerup',x,y);s=await lh(page);if(s.beat>0)break;await advance(page,every-down);s=await lh(page);if(!seen.includes(s.banner))seen.push(s.banner);if(s.beat>0)break;}return{found:s.beat>0,t:t+every,banners:seen,s};}
const quietAudit=p=>p.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length}));
// a game sound by its length: the page builds each one at 24 kHz
const SOUND_LEN={whoosh:14400,toot:12480,spout:12000,ding:9120,plip:3840};
const played=(p,n)=>p.evaluate(n=>__quiet.sounds.filter(s=>s.kind==='buf'&&s.len===n).length,SOUND_LEN[n]);

try{
 h=await gameHarness('lighthouse',PORT);

 // ── locked: without Premium the story's game goes Home before any mic or sound ──
 if(run('locked')){
  const{page,context}=await h.fresh({device:{premium:false}});
  const home=await until(page,()=>location.pathname==='/today.html',8000);
  const q=await page.evaluate(()=>({req:__quiet.requests,snd:__quiet.soundsBefore+__quiet.sounds.length}));
  ok('locked: without Premium the page goes Home (today.html)',home&&!page.url().includes('arcade-lighthouse'),{url:page.url()});
  ok('locked: no microphone was asked for and no sound played first',q.req===0&&q.snd===0,q);
  await context.close();
 }

 // ── main: ages 5-8, a whole round, every step by the finger ──
 if(run('main')){
  const{page,context,errors}=await fresh();
  await context.route(/\/adventure\.html/,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>ending</title>'}));
  const card=await page.evaluate(()=>({start:document.getElementById('startLine').textContent,title:document.getElementById('startTitle').textContent,dots:document.querySelectorAll('#dots i').length}));
  ok('the start card says how to play, ages 5-8',card.start==='Say each word two times to light the lamp. Then move the light to find a lost boat. Tap Bright beam for extra help.'&&card.title==='Light the Way'&&card.dots===8,card);
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
  // before the word: the lamp is dark, and a drag lights nothing
  {const b=await page.locator('#seaCanvas').boundingBox();await page.mouse.move(b.width/2,b.height*0.4);await page.mouse.down();await page.mouse.move(b.width/2+40,b.height*0.45,{steps:4});await advance(page,300);await page.mouse.up();
   const s=await lh(page);ok('before the word the lamp is dark, and dragging lights nothing',!s.lampOn&&!s.pool&&!s.active&&s.dones===0,s);}
  // silence, and a whole listening window, earn nothing
  await advance(page,13000);let s=await both(page);
  ok('a whole quiet listening window earns nothing',s.sp.phase==='nudge'&&s.sp.step===0&&!s.lh.lampOn&&s.lh.dones===0,s.sp);
  const lines=await page.evaluate(()=>__quiet.speech.slice());
  ok('Echo explains the two sayings before the first word',lines.some(l=>l===card.start),lines);
  await page.locator('#micBtn').click();ok('two sayings light the lamp',await sayWord(page));await advance(page,400);
  s=await both(page);ok('the lamp is on, with a pool of light on the sea, and the first boat to find',s.lh.lampOn&&!!s.lh.pool&&s.lh.target.key==='tug'&&s.lh.stage===0&&s.sp.phase==='play',s.lh);
  ok('the lamp whooshes on',await played(page,'whoosh')>=1);
  ok('Echo says what to do once the lamp\'s whoosh is over (one line a step)',await until(page,l=>__quiet.speech.includes(l),3000,STEP_LINES[0]));
  {await advance(page,600);const n=await page.evaluate(l=>__quiet.speech.filter(x=>x===l).length,STEP_LINES[0]);await page.locator('#lhHearStep').click();
   ok('"Hear what to do" says it again',await until(page,([l,n])=>__quiet.speech.filter(x=>x===l).length>n,3000,[STEP_LINES[0],n]));}
  ok('the Lost boat card shows the boat, for a child who cannot read',await page.evaluate(()=>document.getElementById('lostLabel').textContent==='Lost boat'&&/tugboat/.test(document.getElementById('lostCard').getAttribute('aria-label'))));
  // nothing is found without the finger
  await page.mouse.move(s.lh.target.sx,s.lh.target.sy);await advance(page,2000);s=await both(page);
  ok('a mouse hovering over the boat finds nothing',s.lh.beat===0&&s.lh.dones===0&&s.lh.target.hold===0,s.lh);
  await page.mouse.down();await page.mouse.move(s.lh.target.sx+2,s.lh.target.sy);await advance(page,200);await page.mouse.up();await advance(page,3000);s=await both(page);
  // (left where a finger would find it: inside the middle of the pool)
  ok('a pool of light left on the boat, with the finger lifted, finds nothing',s.lh.beat===0&&s.lh.dones===0&&Math.hypot(s.lh.pool.sx-s.lh.target.sx,s.lh.pool.sy-s.lh.target.sy)<s.lh.pool.r*s.lh.target.inner*0.5,s.lh);
  await page.mouse.down();await advance(page,300);s=await lh(page);ok('the light held on the boat starts to find it',s.target.hold>0&&s.beat===0,s.target);
  await advance(page,300);s=await both(page);
  ok('held half a second, the boat is found: the cheer comes first',s.lh.beat>0&&s.sp.step===0&&s.lh.chug&&s.lh.banner==='Toot toot! Found it!',s);
  ok('the boat toots',await played(page,'toot')>=1);
  await page.mouse.up();
  // a pause holds the cheer; the step counts once, after it
  await page.evaluate(()=>__quiet.background());await advance(page,3000);s=await both(page);
  ok('a hidden page holds the cheer: the step has not counted',s.sp.step===0&&s.lh.paused&&s.lh.beat>0,s);
  await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();
  await advance(page,1300);s=await both(page);ok('the step counts after the cheer',s.sp.step===1&&s.lh.dones===1,s);
  await advance(page,1500);s=await both(page);ok('…and counts once',s.sp.step===1&&s.lh.dones===1&&s.lh.docked.join()==='tug',s);
  ok('the next turn shows the next lost boat, the lamp dark again',s.lh.stage===1&&!s.lh.lampOn,s.lh);
  // the rest of the boats, each by the finger
  let twistSeen=false,hidSeen=false;
  for(let i=1;i<7;i++){
   if(!await sayWord(page))throw Error('word '+(i+1));await advance(page,300);s=await lh(page);
   ok('step '+(i+1)+': the '+BIG_BOATS[i]+' is lost',s.stage===i&&s.target.key===BIG_BOATS[i],s.target);
   if(i===4){twistSeen=s.twist;for(let t=0;t<60&&!hidSeen;t++){await advance(page,100);hidSeen=!(await lh(page)).target.visible;}}
   if(i===2)ok('a barrel waits in the fog by the sailboat',s.decoy&&s.decoy.key==='barrel',s);
   // Reduce Motion (every context here): nothing slides, so the boats that
   // drift (sailboat, banana, bathtub, ferry) hold still on their places
   if([2,3,5,6].includes(i)){const a=s.target;await advance(page,1500);const b=(await lh(page)).target;
    ok('step '+(i+1)+': under Reduce Motion the '+BIG_BOATS[i]+' holds still on its place',s.still&&!a.drifting&&!b.drifting&&Math.abs(a.sx-b.sx)<0.5&&Math.abs(a.sy-b.sy)<0.5,{a,b,still:s.still});}
   ok('step '+(i+1)+': the finger finds it',await findBoat(page),await lh(page));ok('step '+(i+1)+': the step counts',await stepTo(page,i+1));
  }
  ok('word 5: a cloud covers the moon and the teacup hides behind the rocks',twistSeen&&hidSeen,{twistSeen,hidSeen});
  // the last step: the town
  if(!await sayWord(page))throw Error('word 8');await advance(page,300);s=await lh(page);
  ok('step 8: shine the light on the town',s.target&&s.target.kind==='town'&&s.windows.length===12&&s.windowsLit===0,s.target);
  ok('the Lost boat card says to light the town',await page.evaluate(()=>document.getElementById('lostLabel').textContent==='Light the town'));
  ok('every window the light touches stays lit, then the dock lights up',await lightTown(page),await lh(page));
  s=await lh(page);ok('all twelve windows are lit',s.windowsLit===12,s.targets);
  ok('windows ding as they light',await played(page,'ding')>=1);
  ok('the eighth step counts',await stepTo(page,8));
  await until(page,()=>__sayplay.phase==='end',6000);s=await both(page);
  ok('every boat is home: seven at the dock and the round ends',s.sp.phase==='end'&&s.lh.docked.length===7&&s.lh.finale,s);
  const end=await page.evaluate(()=>{const g=document.getElementById('goHome'),a=document.getElementById('again');return{title:document.getElementById('endTitle').textContent,sub:document.getElementById('endSub').textContent,go:g.textContent,cls:g.className,shown:getComputedStyle(g).display!=='none',again:a.hidden||getComputedStyle(a).display==='none',ending:Sona.storyEnding('lighthouse').ok};});
  ok('the end card: "Every boat is home!", "You lit the way through the fog."',end.title==='Every boat is home!'&&end.sub==='You lit the way through the fog.',end);
  ok('…one teal button, "See what happens!", and no Play again',end.go==='See what happens!'&&end.cls==='btn'&&end.shown&&end.again,end);
  ok('the round finished the day: the story\'s ending is open',end.ending,end);
  const q=await quietAudit(page);ok('no sound ever plays into an open microphone',q.leaks===0&&q.live===0&&q.overlap===0,q);
  s=await lh(page);const unkind=s.banners.filter(b=>BAN.test(b));ok('every banner is kind',s.banners.length>=5&&unkind.length===0,{banners:s.banners});
  const nav=page.waitForRequest(/\/adventure\.html\?part=end&story=lighthouse$/,{timeout:4000}).then(()=>true,()=>false);
  await page.locator('#goHome').click();ok('"See what happens!" opens the story\'s ending',await nav);
  ok('no runtime errors',errors.length===0,errors);
  await context.close();
  // what the game file may never touch, and what it says
  const js=readFileSync(path.join(ROOT,'lighthouse.js'),'utf8'),code=js.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  const bad=['logAttempt','bumpReps','gameRep','addCoins','mintCoins','awardNextSticker','awardRandomSticker','localStorage','sessionStorage','recordRung'].filter(w=>code.includes(w));
  ok('the game file never writes practice, reps, coins, stickers or storage',bad.length===0,bad);
  const said=[...code.matchAll(/"([^"\n]{12,})"/g)].map(m=>m[1]).filter(t=>/[a-z] [a-z]/i.test(t)&&!/^\/|rgba|#|webp/.test(t));
  ok('nothing the game shows or says is unkind',said.filter(t=>BAN.test(t)).length===0,said.filter(t=>BAN.test(t)));
  ok('Echo\'s directions are the spec\'s, one a step, each under 120 characters',STEP_LINES.concat(LITTLE_LINES).every(l=>js.includes(JSON.stringify(l))&&l.length<=120),null);
  const html=readFileSync(path.join(ROOT,'arcade-lighthouse.html'),'utf8');
  // with motion on (the harness opens every page under Reduce Motion), the
  // sailboat drifts
  {const{page,context,errors}=await h.fresh();await page.emulateMedia({reducedMotion:'no-preference'});await page.reload();
   await page.clock.pauseAt(await page.evaluate(()=>Date.now()+500));await advance(page,200);
   // (with motion on the start button pulses for good, so it is never "stable")
   await page.locator('#startBtn').click({force:true});if(!await sayWord(page))throw Error('motion word 1');await advance(page,300);
   for(let i=0;i<2;i++){if(i){if(!await sayWord(page))throw Error('motion word '+(i+1));await advance(page,300);}if(!await findBoat(page))throw Error('motion find '+(i+1));await stepTo(page,i+1);}
   if(!await sayWord(page))throw Error('motion word 3');await advance(page,300);
   const a=(await lh(page)).target;await advance(page,2000);const s=await lh(page);
   ok('with motion on, the sailboat drifts',!s.still&&s.target.key==='sail'&&a.drifting&&s.target.drifting&&Math.hypot(s.target.sx-a.sx,s.target.sy-a.sy)>3,{a,b:s.target,still:s.still});
   ok('motion on: no runtime errors',errors.length===0,errors);await context.close();}
  ok('the page hands back to the story and has no Play again',/exit: \{ href: "\/adventure\.html\?part=end&story=lighthouse", label: "See what happens!" \}/.test(html)&&/again: false/.test(html)&&/Lighthouse\.setLittle\(little\)/.test(html),null);
 }

 // ── struggle: the ladder climbs with seconds of searching and with decoys,
 // and every step ends with no more speaking ──
 if(run('struggle')){
  {const{page,context,errors}=await fresh();await page.locator('#startBtn').click();
   for(let i=0;i<8;i++){
    const tag='5-8, step '+(i+1);
    if(!await sayWord(page))throw Error('word '+(i+1));await advance(page,300);
    const mics=await page.evaluate(()=>__quiet.requests);let s=await lh(page);
    if(i===2){
     // three decoys lit: one rung each
     for(let n=1;n<=3;n++){
      s=await lh(page);await page.mouse.move(s.decoy.sx,s.decoy.sy);await page.mouse.down();await advance(page,800);s=await lh(page);
      ok(tag+': lighting the barrel is one try (decoy '+n+')',s.decoysLit===n&&s.ladder===n&&s.beat===0&&/That's a barrel! Keep looking\./.test(s.banner),s);
      if(n===1)ok(tag+': after one decoy the lantern blinks brighter and the boat stops drifting',s.target.blink&&!s.target.drifting,s.target);
      if(n===2)ok(tag+': after two the decoys doze, a ring and an arrow show the boat',s.decoy.dozing&&s.target.ring&&s.target.arrow,s);
      if(n===3)ok(tag+': after three the pool is about half the sea, and a tenth of a second finds it',s.pool.r>=0.24*Math.min(390,s.board.picW)&&s.target.need===0.1,s.pool);
      const f=farFrom(s);await page.mouse.move(f.x,f.y);await advance(page,300);await page.mouse.up();
     }
    }else if((await lh(page)).target.kind==='town'){
     await sweepFar(page,4.2);s=await lh(page);ok(tag+': 4 s of searching, each window catches the light from twice as far',s.ladder===1&&s.reach===2&&s.windowsLit===0,s);
     await sweepFar(page,4);s=await lh(page);ok(tag+': 8 s, one sweep along a row lights the whole row',s.ladder===2&&s.rows&&s.windowsLit===0,s);
     await page.mouse.up();
     const rows=[0,1,2].map(r=>s.windows.findIndex(w=>w.row===r));
     await page.mouse.move(s.windows[rows[0]].sx,s.windows[rows[0]].sy);await page.mouse.down();
     for(const r of rows){await page.mouse.move(s.windows[r].sx,s.windows[r].sy,{steps:2});await advance(page,250);}
     s=await lh(page);await page.mouse.up();ok(tag+': one window touched in each row lights the whole town',s.windowsLit===12&&s.dockOn,s.targets);
     ok(tag+': the step counts with no more speaking',await stepTo(page,8)&&await page.evaluate(m=>__quiet.requests===m,mics));
     continue;
    }else{
     await sweepFar(page,4.2);s=await lh(page);ok(tag+': 4 s of searching: the lantern blinks brighter',s.ladder===1&&s.target.blink&&!s.target.drifting&&s.beat===0,s);
     if(i===4){const f=farFrom(s);let out=true;for(let t=0;t<30;t++){await page.mouse.move(f.x+5*Math.sin(t),f.y);await advance(page,100);if(!(await lh(page)).target.visible)out=false;}ok(tag+': the teacup comes out from the rocks and stays out',out);}
     await sweepFar(page,4);s=await lh(page);ok(tag+': 8 s: a ring and an arrow point to the boat',s.ladder===2&&s.target.ring&&s.target.arrow,s.target);
     await sweepFar(page,4);s=await lh(page);ok(tag+': 12 s: the pool grows to about half the sea and a tenth of a second finds it',s.ladder===3&&s.pool.r>=0.24*Math.min(390,s.board.picW)&&s.target.need===0.1&&s.beat===0,s);
     await page.mouse.up();
     // waiting never climbs or finds
     const was=s.idle;await advance(page,3000);s=await lh(page);ok(tag+': waiting adds nothing',s.idle===was&&s.beat===0&&s.dones===i,{was,idle:s.idle,beat:s.beat,dones:s.dones,hold:s.target.hold,pool:s.pool,t:s.target});
    }
    ok(tag+': the finger then finds it',await findBoat(page),await lh(page));
    ok(tag+': the step counts with no more speaking',await stepTo(page,i+1)&&await page.evaluate(m=>__quiet.requests===m,mics));
   }
   await until(page,()=>__sayplay.phase==='end',6000);ok('5-8: the struggling child still brings every boat home',(await both(page)).sp.phase==='end');
   ok('5-8 struggle: no runtime errors',errors.length===0,errors);await context.close();}
  {const{page,context,errors}=await fresh(littleOpts());
   const card=await page.evaluate(()=>({start:document.getElementById('startLine').textContent,dots:document.querySelectorAll('#dots i').length}));
   ok('3-4: the start card and six words',card.start==='Say each word two times to light the lamp. Then touch the glowing boat with the light.'&&card.dots===6,card);
   await page.locator('#startBtn').click();
   for(let i=0;i<6;i++){
    const tag='3-4, step '+(i+1);
    if(!await sayWord(page))throw Error('little word '+(i+1));await advance(page,300);
    const mics=await page.evaluate(()=>__quiet.requests);let s=await lh(page);
    ok(tag+': Echo says what to do',await until(page,l=>__quiet.speech.includes(l),3000,LITTLE_LINES[i]));
    if(s.target.kind==='boat'){
     ok(tag+': the '+LITTLE_BOATS[i]+' glows clearly from the start, on a still sea with no decoys and no cloud',s.target.key===LITTLE_BOATS[i]&&s.target.blink&&!s.target.drifting&&!s.decoy&&!s.twist&&s.pool.r>=0.22*Math.min(390,s.board.picW),s);
     await sweepFar(page,2.1);s=await lh(page);ok(tag+': 2 s: an arrow and a ring',s.ladder===1&&s.target.arrow&&s.target.ring,s.target);
     const r1=s.pool.r;await sweepFar(page,2);s=await lh(page);ok(tag+': 4 s: the pool doubles',s.ladder===2&&s.pool.r>=r1*1.9,{r1,r:s.pool.r});
     await sweepFar(page,2);s=await lh(page);ok(tag+': 6 s: still not found without a touch',s.ladder===3&&s.beat===0,s);
     await page.mouse.up();await advance(page,2000);ok(tag+': waiting finds nothing',(await lh(page)).beat===0);
     const f=farFrom(s);await page.mouse.move(f.x,f.y);await page.mouse.down();await advance(page,100);s=await lh(page);await page.mouse.up();
     ok(tag+': a touch anywhere on the sea finds it',s.beat>0,s);
    }else{
     await sweepFar(page,6.1);s=await lh(page);ok(tag+': 6 s on the town',s.ladder===3&&s.target.arrow&&s.windowsLit===0,s);await page.mouse.up();
     let taps=0;while(!(await lh(page)).dockOn&&taps<8){const f=farFrom(await lh(page));await page.mouse.move(f.x,f.y);await page.mouse.down();await advance(page,80);await page.mouse.up();await advance(page,80);taps++;}
     s=await lh(page);ok(tag+': each touch lights a window: six touches light the town',s.dockOn&&taps===6,{taps,lit:s.windowsLit});
    }
    ok(tag+': the step counts with no more speaking',await stepTo(page,i+1)&&await page.evaluate(m=>__quiet.requests===m,mics));
   }
   await until(page,()=>__sayplay.phase==='end',6000);const s=await both(page);ok('3-4: every boat home and the town lit',s.sp.phase==='end'&&s.lh.docked.length===5,s);
   ok('3-4 struggle: no runtime errors',errors.length===0,errors);await context.close();}
  // the obvious move after "Find the tugboat!": the finger ON the boat. The
  // light sits above a fingertip, so the find zone runs down to the finger.
  {const{page,context,errors}=await fresh();await begin(page);await advance(page,300);
   let s=await lh(page),r=await holdStill(page,3000);
   ok('5-8: a finger held still ON the tugboat finds it (the light sits above the finger, past the middle of the light)',r.found&&r.t<=1500&&r.s.gap>r.s.pool.r*r.s.target.inner,{t:r.t,gap:r.s.gap,r:r.s.pool.r,inner:r.s.target.inner});
   ok('5-8, held still: the step counts',await stepTo(page,1));
   if(!await sayWord(page))throw Error('touch word 2');await advance(page,300);
   r=await tapBoat(page,150,700,30000);
   ok('5-8: taps on the rowboat say "So close! Hold the light on it" from the first tap',r.banners[0]==='So close! Hold the light on it',r.banners);
   ok('5-8: taps on the rowboat alone still find it, each tap counting toward the help',r.found&&r.t<=20000,{t:r.t,ladder:r.s.ladder,idle:r.s.idle,banners:r.banners});
   ok('5-8, taps: the step counts',await stepTo(page,2));
   if(!await sayWord(page))throw Error('touch word 3');await advance(page,300);
   s=await lh(page);const f=farFrom(s);r=await holdStill(page,4200,f);
   ok('5-8: a finger held still on the sea is searching: 4 s climbs the ladder, and finds nothing',!r.found&&r.s.ladder===1,{ladder:r.s.ladder,idle:r.s.idle});
   r=await holdStill(page,3000);ok('5-8: then held still on the sailboat, it is found',r.found,{t:r.t});
   ok('5-8, touch: no runtime errors',errors.length===0,errors);await context.close();}
  {const{page,context,errors}=await fresh(littleOpts());await begin(page);await advance(page,300);
   let r=await tapBoat(page,120,700,8000);
   ok('3-4: a quick tap (120 ms) on the tugboat finds it at the first tap',r.found&&r.t<=700,{t:r.t,banners:r.banners,linger:r.s.linger});
   ok('3-4, tap: the step counts',await stepTo(page,1));
   if(!await sayWord(page))throw Error('little touch 2');await advance(page,300);
   r=await tapBoat(page,200,700,8000);ok('3-4: a 200 ms tap on the rowboat finds it at the first tap',r.found&&r.t<=700,{t:r.t});
   ok('3-4, tap 2: the step counts',await stepTo(page,2));
   if(!await sayWord(page))throw Error('little touch 3');await advance(page,300);
   let s=await lh(page);const f=farFrom(s);
   for(let n=0;n<5;n++){await touch(page,'pointerdown',f.x,f.y);await advance(page,120);await touch(page,'pointerup',f.x,f.y);await advance(page,580);}
   s=await lh(page);ok('3-4: five quick taps on the empty sea count toward the help (an arrow and a ring), and find nothing',s.ladder===1&&s.target.arrow&&s.beat===0,{ladder:s.ladder,idle:s.idle});
   r=await holdStill(page,2000);ok('3-4: a finger held still on the banana boat finds it',r.found&&r.t<=600,{t:r.t});
   ok('3-4, touch: no runtime errors',errors.length===0,errors);await context.close();}
 }

 // ── help: Bright beam asks the word again; silence or "Back to the game"
 // gives the move back with no power; heard, the same boat gets the power ──
 if(run('help')){
  const{page,context,errors}=await fresh();await begin(page);await advance(page,300);
  let s=await both(page);const was=s.lh,r0=was.pool.r;
  ok('the Bright beam pill is ready in play',await page.locator('#lhHelp').isEnabled());
  const same=x=>x.sp.phase==='play'&&!x.sp.paused&&!x.lh.paused&&x.lh.active&&x.lh.power===0&&x.sp.step===0&&x.lh.stage===0&&x.lh.target.key==='tug'&&x.lh.dones===0;
  await page.locator('#lhHelp').click();await until(page,()=>__sayplay.listening);s=await both(page);
  ok('asking for help holds the same boat and asks the word',s.lh.paused&&s.sp.step===0&&await page.locator('#helpBack').isVisible(),s);
  await advance(page,13500);s=await both(page);ok('help, then 13 s of silence: the same boat, no power, playing again',same(s)&&await page.locator('#lhHelp').isEnabled(),s);
  await page.locator('#lhHelp').click();await until(page,()=>__sayplay.listening);await page.locator('#helpBack').click();await advance(page,100);s=await both(page);
  ok('"Back to the game" gives the same boat back at once, no power',same(s),s);
  await page.locator('#lhHelp').click();await until(page,()=>__sayplay.listening);await page.evaluate(()=>__quiet.background());await advance(page,300);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await advance(page,100);s=await both(page);
  ok('a help ask cut off by the lock screen gives the same boat back',same(s),s);
  await page.locator('#lhHelp').click();ok('the help word can be said',await sayWord(page));await advance(page,200);s=await both(page);
  ok('heard: a bright beam on the same boat, the pool doubled and the fog cleared',s.lh.power>0&&s.lh.fogClear&&s.lh.pool.r>=r0*1.9&&s.lh.stage===0&&s.lh.target.key==='tug'&&s.sp.step===0,s.lh);
  ok('the pill is greyed while the beam is on, with its bar showing',await page.locator('#lhHelp').isDisabled()&&await page.locator('#lhPower').isVisible());
  await advance(page,10300);s=await lh(page);ok('the beam lasts ten seconds, then the pill is ready again',s.power===0&&!s.fogClear&&s.pool.r<r0*1.2&&await page.locator('#lhHelp').isEnabled(),s);
  ok('the boat is still found by the finger',await findBoat(page));ok('the step counts',await stepTo(page,1));
  const q=await quietAudit(page);ok('help asks never sound into an open microphone',q.leaks===0&&q.live===0&&q.overlap===0,q);
  ok('help: no runtime errors',errors.length===0,errors);await context.close();
 }

 // ── buddy: the child's own buddy stands on the ledge and cheers each find ──
 if(run('buddy')){
  const look=p=>p.evaluate(()=>{const b=document.getElementById('lhBuddy'),e=document.getElementById('lhEcho'),r=x=>{const q=x.getBoundingClientRect();return{x:q.x,y:q.y,right:q.right,bottom:q.bottom};};
   return{src:b.getAttribute('src')||'',badge:b.classList.contains('badge'),alt:b.getAttribute('alt'),hidden:b.getAttribute('aria-hidden'),pe:getComputedStyle(b).pointerEvents,epe:getComputedStyle(e).pointerEvents,echo:e.getAttribute('src'),b:r(b),e:r(e),help:r(document.getElementById('lhHelp')),hear:r(document.getElementById('lhHearStep')),shown:getComputedStyle(b).display!=='none'};});
  const apart=(a,b)=>a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y;
  for(const who of ['fox','dragon']){
   const seed=who==='dragon'?{'sona.profile.v1':JSON.stringify({childName:'Mia',childAge:'7',focusSounds:['R'],onboarded:true,earlyAdopter:true,character:'dragon',voiceOn:true,soundOn:true,volume:0.6})}:undefined;
   const{page,context,errors}=await fresh({device:seed?{seed}:{}});await begin(page);await advance(page,300);
   let v=await look(page);
   ok(who+': the buddy stands on the ledge in its rest pose',v.shown&&v.src.includes('buddy-'+who+'-rest.webp')&&!v.badge,v);
   ok(who+': the buddy is decoration: alt="", aria-hidden, no pointer, and Echo takes no pointer either',v.alt===''&&v.hidden==='true'&&v.pe==='none'&&v.epe==='none',v);
   ok(who+': never over a button',apart(v.b,v.help)&&apart(v.b,v.hear)&&apart(v.e,v.help)&&apart(v.e,v.hear),v);
   const s=await lh(page);await page.mouse.move(s.target.sx,s.target.sy);await page.mouse.down();await advance(page,650);await page.mouse.up();v=await look(page);
   ok(who+': on a find the buddy cheers with its own picture, and Echo cheers',v.src.includes('buddy-'+who+'-cheer.webp')&&/echo-cheer/.test(v.echo),v);
   await advance(page,1100);v=await look(page);ok(who+': then both stand again',v.src.includes('buddy-'+who+'-rest.webp')&&/echo-welcome/.test(v.echo),v);
   ok(who+': no runtime errors',errors.length===0,errors);await context.close();
  }
  {const seed={'sona.profile.v1':JSON.stringify({childName:'Mia',childAge:'7',focusSounds:['R'],onboarded:true,earlyAdopter:true,character:'dragon',voiceOn:true,soundOn:true,volume:0.6})};
   const{page,context,errors}=await fresh({device:{seed}});await context.route(/buddy-dragon-(rest|cheer)\.webp/,r=>r.abort());await page.reload({waitUntil:'domcontentloaded'});
   // polled from here: the page's clock is paused, so nothing in it ticks
   let fell=false;for(let n=0;n<30&&!fell;n++){fell=await page.evaluate(()=>{const b=document.getElementById('lhBuddy');return !!b&&b.classList.contains('badge')&&/buddy-dragon/.test(b.getAttribute('src')||'');});if(!fell)await new Promise(r=>setTimeout(r,200));}
   ok('a buddy picture that will not load falls back to its round badge',fell,await page.evaluate(()=>document.getElementById('lhBuddy').outerHTML));
   ok('fallback: no runtime errors',errors.length===0,errors);await context.close();}
 }

 // ── fit: four screens, the word turn, play, a help ask and the light's gap ──
 if(run('fit')){
  const rects=(p,ids)=>p.evaluate(ids=>ids.map(id=>{const e=document.getElementById(id),r=e?e.getBoundingClientRect():{x:0,y:0,right:0,bottom:0,width:0,height:0};return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,shown:!!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'};}),ids);
  for(const viewport of[{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024}]){
   const tag=viewport.width+'x'+viewport.height,inside=r=>r.shown&&r.w>0&&r.x>=-.5&&r.y>=-.5&&r.right<=viewport.width+.5&&r.bottom<=viewport.height+.5,big=r=>r.w>=44&&r.h>=44;
   for(const age of['7','4']){
    const who=tag+(age==='4'?' (3-4)':'');
    const{page,context,errors}=await fresh({viewport,device:{age}});
    let r=await rects(page,['startBtn']);ok(who+': the start card\'s button fits',r.every(inside)&&big(r[0]),r);
    await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
    r=await rects(page,['turnPanel','hear','word','lostCard','lhBanner']);ok(who+': the word turn fits, with the Lost boat card above it',r.every(inside)&&big(r[1]),r);
    {const pic=await page.evaluate(()=>{const c=document.querySelector('#pic .crafted-word-crop'),q=c&&c.getBoundingClientRect(),b=document.getElementById('picBox').getBoundingClientRect();return q?{w:q.width,h:q.height,x:q.x,y:q.y,right:q.right,bottom:q.bottom,box:{x:b.x,y:b.y,right:b.right,bottom:b.bottom},word:document.getElementById('word').textContent}:null;});
     ok(who+': the word\'s picture shows beside it, inside its box (never drawn at 0 x 0)',!!pic&&Math.max(pic.w,pic.h)>40&&Math.min(pic.w,pic.h)>10&&pic.x>=pic.box.x-0.5&&pic.right<=pic.box.right+0.5&&pic.y>=pic.box.y-0.5&&pic.bottom<=pic.box.bottom+0.5,pic);}
    if(!await sayWord(page))throw Error('fit word');await advance(page,400);
    const m=await page.evaluate(()=>{const s=__lighthouse,b=s.board,ids=['lhHelp','lhHearStep','lostCard','lhBanner','lhEcho','lhBuddy'],R={};ids.forEach(id=>{const q=document.getElementById(id).getBoundingClientRect();R[id]={x:q.x,y:q.y,right:q.right,bottom:q.bottom,w:q.width,h:q.height};});
     // every place a boat, a decoy or a window can be, on this screen
     const X=x=>b.picX+x*b.picW,Y=y=>b.picTop+y*b.picH,list=s.little?s.anchors.little:s.anchors.sea,spots=[];
     list.forEach((p,i)=>{if(!p.boat)return;const w=s.anchors.boats[p.boat].s*b.picW,d=p.drift||{x:0,y:0};[-1,0,1].forEach(k=>spots.push({what:p.boat,x:X(p.x+k*d.x),y:Y(p.y+k*d.y),w}));if(p.peek)spots.push({what:'teacup out',x:X(p.peek.x),y:Y(p.peek.y),w});if(p.decoy)spots.push({what:p.decoy.key,x:X(p.decoy.x),y:Y(p.decoy.y),w:s.anchors.decoys[p.decoy.key].s*b.picW});});
     s.windows.forEach((w,i)=>spots.push({what:'window '+i,x:w.sx,y:w.sy,w:8}));
     const out=spots.filter(p=>!(p.x>=b.left+6&&p.x<=b.right-6&&p.y-p.w*0.25>=b.top&&p.y<=b.bottom-4));
     return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,R,out,board:b};});
    const ctl=[m.R.lhHelp,m.R.lhHearStep],apart=(a,b)=>a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y;
    ok(who+': no page scroll either way',m.scroll<=m.height+1&&m.sw<=m.width+1,m);
    ok(who+': both buttons on screen and at least 44 px',ctl.every(r=>r.x>=0&&r.y>=0&&r.right<=m.width&&r.bottom<=m.height&&r.w>=44&&r.h>=44),m.R);
    ok(who+': Echo and the buddy stand clear of the buttons, below the sea',[m.R.lhEcho,m.R.lhBuddy].every(e=>ctl.every(c=>apart(e,c))&&e.y>=m.board.bottom-4),m.R);
    ok(who+': every boat, decoy and window sits on the visible sea, clear of the Lost boat card and the ledge',m.out.length===0,{out:m.out,board:m.board});
    // the cloud at word 5 hides the moon, so the moon has to be in sight
    {const s=await lh(page);ok(who+': the moon is in sight, below the Lost boat card and above the sea',s.moon.sy>=s.board.top&&s.moon.sy+s.moon.r<=s.board.picTop+s.anchors.horizon*s.board.picH&&s.moon.sx-s.moon.r>=s.board.left&&s.moon.sx+s.moon.r<=s.board.right,{moon:s.moon,board:s.board});}
    // the light sits above a fingertip (0.8 of the pool, at most 56 px), and on a mouse
    const f0=farFrom(await lh(page)),fx=Math.round(f0.x),fy=Math.round(f0.y);
    await page.evaluate(([x,y])=>{const c=document.getElementById('seaCanvas');c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:7,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,bubbles:true}));},[fx,fy]);
    await advance(page,600);let s=await lh(page);const want=Math.min(56,0.8*s.pool.r);
    ok(who+': under a finger the light sits '+Math.round(want)+' px above it',Math.abs(s.pool.sx-fx)<2&&Math.abs((fy-s.pool.sy)-want)<2&&s.gap===want,{pool:s.pool,fx,fy,want,gap:s.gap});
    await page.evaluate(([x,y])=>{const c=document.getElementById('seaCanvas');c.dispatchEvent(new PointerEvent('pointerup',{pointerId:7,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,bubbles:true}));},[fx,fy]);
    // a finger below the boat lights it
    const t=s.target;await page.evaluate(([x,y])=>{const c=document.getElementById('seaCanvas');c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:8,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,bubbles:true}));},[t.sx,t.sy+want]);
    await advance(page,900);s=await lh(page);ok(who+': a finger just below the boat finds it',s.beat>0||s.dones===1,{beat:s.beat,pool:s.pool,t});
    await page.evaluate(([x,y])=>{const c=document.getElementById('seaCanvas');c.dispatchEvent(new PointerEvent('pointerup',{pointerId:8,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,bubbles:true}));},[t.sx,t.sy+want]);
    ok(who+': the step counts',await stepTo(page,1));
    if(!await sayWord(page))throw Error('fit word 2');await advance(page,300);
    const f1=farFrom(await lh(page)),mx=Math.round(f1.x),my=Math.round(f1.y);
    await page.mouse.move(mx,my);await page.mouse.down();await advance(page,600);s=await lh(page);await page.mouse.up();
    ok(who+': with a mouse the light sits on the pointer',Math.abs(s.pool.sx-mx)<2&&Math.abs(s.pool.sy-my)<2&&s.beat===0,s.pool);
    await page.locator('#lhHelp').click();await until(page,()=>__sayplay.listening);r=await rects(page,['turnPanel','hear','helpBack','word']);
    ok(who+': a help ask fits, with a big enough "Back to the game"',r.every(inside)&&big(r[1])&&big(r[2]),r);await page.locator('#helpBack').click();await advance(page,100);
    if(age==='7')await page.screenshot({path:path.join(OUT,'sona-lighthouse-'+viewport.width+'.png')});
    ok(who+': no runtime errors',errors.length===0,errors);await context.close();
   }
  }
 }

 // ── stand-ins: every painted picture blocked, the whole round still plays ──
 if(run('standins')){
  const{page,context,errors}=await fresh(littleOpts({blockAssets:true}));await begin(page);await advance(page,300);
  let s=await lh(page);ok('with every picture blocked, none is ready and the sea is drawn',!s.artReady&&Object.values(s.art).every(v=>v==='failed'),s.art);
  for(let i=0;i<5;i++){if(i&&!await sayWord(page))throw Error('standin word');await advance(page,300);ok('stand-ins, boat '+(i+1)+': found by the finger',await findBoat(page));ok('stand-ins, boat '+(i+1)+': counts',await stepTo(page,i+1));}
  if(!await sayWord(page))throw Error('standin town');await advance(page,300);ok('stand-ins: the town lights up',await lightTown(page));
  await until(page,()=>__sayplay.phase==='end',6000);ok('stand-ins: the round ends',(await both(page)).sp.phase==='end');
  await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-lighthouse-standins.png')});
  ok('stand-ins: no runtime errors',errors.length===0,errors);await context.close();
  {const{page,context,errors}=await fresh({blockAssets:true});await begin(page);await advance(page,300);ok('stand-ins, ages 5-8: the tugboat is found',await findBoat(page));ok('…and counts',await stepTo(page,1));ok('stand-ins, ages 5-8: no runtime errors',errors.length===0,errors);await context.close();}
 }

 // ── keyboard: the arrows move the light, Space held shines it ──
 if(run('keyboard')){
  const{page,context,errors}=await fresh();await begin(page);await advance(page,300);
  await page.locator('#lhLight').focus();let s=await lh(page);const step=0.05*Math.min(390,s.board.picW);
  ok('the light can take the keyboard\'s focus',await page.evaluate(()=>document.activeElement&&document.activeElement.id==='lhLight'));
  const p0={...s.pool};await page.keyboard.press('ArrowLeft');await advance(page,400);s=await lh(page);ok('an arrow moves the light',s.pool.sx<p0.sx-step*0.8,{p0,p:s.pool});
  for(let n=0;n<60;n++){s=await lh(page);const dx=s.target.sx-s.pool.sx,dy=s.target.sy-s.pool.sy;if(Math.abs(dx)<step*0.6&&Math.abs(dy)<step*0.6)break;await page.keyboard.press(Math.abs(dx)>=Math.abs(dy)?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp'));await advance(page,300);}
  await advance(page,1500);s=await lh(page);ok('the light parked on the boat finds nothing by itself',s.beat===0&&Math.hypot(s.target.sx-s.pool.sx,s.target.sy-s.pool.sy)<step,s);
  await page.keyboard.down(' ');await advance(page,650);s=await lh(page);await page.keyboard.up(' ');ok('holding Space shines it: the boat is found',s.beat>0,s);
  ok('…and the step counts',await stepTo(page,1));
  ok('keyboard: no runtime errors',errors.length===0,errors);await context.close();
 }

 // ── art: ANCHORS lines up with the paintings (design/adventure/art-notes.md),
 // read from the pictures' own pixels, so a redrawn picture that moves a
 // window, the cove or a lantern fails here instead of on a child's phone ──
 if(run('art')){
  const{page,context,errors}=await h.fresh();
  ok('art: every painted picture loads',await until(page,()=>window.__lighthouse&&__lighthouse.artReady,8000),await page.evaluate(()=>window.__lighthouse&&__lighthouse.art));
  const r=await page.evaluate(async()=>{
   const A=__lighthouse.anchors,G='/assets/crafted/game/lighthouse-';
   const px=n=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);ok({w:c.width,h:c.height,d:x.getImageData(0,0,c.width,c.height).data});};i.onerror=()=>no(Error(n));i.src=G+n+'.webp';});
   const [sea,lit,rocks]=await Promise.all(['sea','town-lit','rocks-front'].map(px));
   const FILE={tug:'boat-tug',row:'boat-row',sail:'boat-sail',banana:'boat-banana',teacup:'boat-teacup',bathtub:'boat-bathtub',ferry:'boat-ferry',barrel:'barrel',whale:'whale',duckie:'duckie',buoy:'buoy'},spr={};
   for(const k of Object.keys(FILE))spr[k]=await px(FILE[k]);
   const W=sea.w,H=sea.h,lum=(im,x,y)=>{const i=(Math.round(y)*im.w+Math.round(x))*4,d=im.d;return 0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];};
   const disc=(im,cx,cy,rr)=>{let s=0,n=0;for(let y=cy-rr;y<=cy+rr;y++)for(let x=cx-rr;x<=cx+rr;x++)if((x-cx)**2+(y-cy)**2<=rr*rr){s+=lum(im,x,y);n++;}return s/n;};
   const win=A.windows.map(w=>disc(lit,w.x*W,w.y*H,w.r*W*0.6)-disc(sea,w.x*W,w.y*H,w.r*W*0.6));
   const bulbs=A.bulbs.map(b=>disc(lit,b[0]*W,b[1]*H,2)-disc(sea,b[0]*W,b[1]*H,2));
   const dl=A.dockLights,out=[];
   for(let y=4;y<H-4;y+=17)for(let x=4;x<W-4;x+=13){if(A.windows.some(w=>Math.hypot(x-w.x*W,y-w.y*H)<w.r*W*1.25+6))continue;if(x>dl.x*W-6&&x<(dl.x+dl.w)*W+6&&y>dl.y*H-6&&y<(dl.y+dl.h)*H+6)continue;out.push(Math.abs(lum(lit,x,y)-lum(sea,x,y)));}
   out.sort((a,b)=>a-b);
   // a sprite's box on the picture, as the game draws it: centred, s of the width
   const box=(k,x,y,s)=>{const im=spr[k],w=s*W,h=w*im.h/im.w;return{x0:x*W-w/2,x1:x*W+w/2,y0:y*H-h/2,y1:y*H+h/2};};
   const covered=b=>{let n=0,c=0;for(let y=Math.max(0,b.y0);y<Math.min(H,b.y1);y+=2)for(let x=Math.max(0,b.x0);x<Math.min(W,b.x1);x+=2){n++;if(rocks.d[(Math.round(y)*W+Math.round(x))*4+3]>128)c++;}return c/n;};
   const places=[];
   for(const [list,age] of [[A.sea,'5-8'],[A.little,'3-4']])list.forEach(p=>{if(!p.boat)return;const s=A.boats[p.boat].s,d=p.drift||{x:0,y:0};
    [-1,0,1].forEach(k=>places.push({what:age+' '+p.boat+(k?' at its drift\'s edge':''),b:box(p.boat,p.x+k*d.x,p.y+k*d.y,s),hide:!!p.peek}));
    if(p.peek)places.push({what:age+' teacup peeking out',b:box(p.boat,p.peek.x,p.peek.y,s)});
    if(p.decoy)places.push({what:age+' '+p.decoy.key,b:box(p.decoy.key,p.decoy.x,p.decoy.y,A.decoys[p.decoy.key].s)});});
   const pl=places.map(p=>({what:p.what,hide:p.hide,rocks:covered(p.b),top:p.b.y0/H,left:p.b.x0/W,right:p.b.x1/W,windows:A.windows.filter(w=>w.x*W>p.b.x0&&w.x*W<p.b.x1&&w.y*H>p.b.y0&&w.y*H<p.b.y1).length}));
   const lamps=Object.keys(A.boats).map(k=>{const im=spr[k],L=A.boats[k].lamp,x=im.w*(0.5+L[0]),y=im.h/2+L[1]*im.w,i=(Math.round(y)*im.w+Math.round(x))*4;return{k,alpha:im.d[i+3],light:lum(im,x,y)};});
   // the game draws only rocksBox of the front rocks: nothing of them may lie outside it
   const rb=A.rocksBox;let stray=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(x>=rb.x*W&&x<(rb.x+rb.w)*W&&y>=rb.y*H&&y<(rb.y+rb.h)*H)continue;if(rocks.d[(y*W+x)*4+3]>8)stray++;}
   return{size:[W,H],pic:A.pic,win,bulbs,out:{mean:out.reduce((a,b)=>a+b,0)/out.length,p99:out[Math.floor(out.length*0.99)]},pl,lamps,stray,moonBottom:A.moon.y+A.moon.s*W/2/H,horizon:A.horizon};
  });
  ok('art: the box the game draws of the front rocks holds all of them',r.stray===0,{stray:r.stray});
  ok('art: ANCHORS is measured on the sea\'s own frame (2:3)',Math.abs(r.size[0]/r.size[1]-r.pic.w/r.pic.h)<0.001,{size:r.size,pic:r.pic});
  ok('art: every window anchor is on a painted window that the lit town lights up',r.win.every(d=>d>40),r.win.map(d=>Math.round(d)));
  ok('art: every dock bulb anchor is on a painted bulb that lights up',r.bulbs.every(d=>d>40),r.bulbs.map(d=>Math.round(d)));
  ok('art: outside the windows and the bulbs the lit town is the unlit sea (so lighting a window shows nothing else)',r.out.mean<4&&r.out.p99<20,r.out);
  const hid=r.pl.filter(p=>p.hide),rest=r.pl.filter(p=>!p.hide);
  ok('art: the teacup\'s hiding place is wholly behind the cove\'s front rocks',hid.length>0&&hid.every(p=>p.rocks>=0.95),hid);
  ok('art: …and where it peeks out, the rocks hide almost none of it',rest.filter(p=>/peeking/.test(p.what)).every(p=>p.rocks<=0.15),rest.filter(p=>/peeking/.test(p.what)));
  const bad=rest.filter(p=>!/peeking/.test(p.what)&&(p.rocks>0.02||p.top<=r.horizon||p.windows>0||p.left<0.06||p.right>0.94));
  ok('art: every boat and decoy, at both ends of its drift, is on open sea: under the horizon, off the rocks and the town\'s windows, inside the part a phone shows',bad.length===0,bad);
  ok('art: every boat\'s lantern anchor is on its lit lantern',r.lamps.every(l=>l.alpha>200&&l.light>180),r.lamps);
  ok('art: the moon sits in the sky, above the horizon',r.moonBottom<r.horizon,{moonBottom:r.moonBottom,horizon:r.horizon});
  ok('art: no runtime errors',errors.length===0,errors);await context.close();
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
