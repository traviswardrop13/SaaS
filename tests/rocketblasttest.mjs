// Rocket Blast, rebuilt (Travis, 6 Nov 2026, "yea" to the plan): the word
// brings the rocket and nothing else, the child aims, each trip is a little
// farther, the last planet sways, and the planets landed on are the child's
// collection. The original rules (silence earns nothing, a miss never costs
// a word, every round ends, help can always be left) are all still played.
import path from 'node:path';
import {readFileSync,existsSync} from 'node:fs';
import {OUT,ROOT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,rocket:window.__rocket}));
const near=(a,b,e=.005)=>Math.abs(a-b)<e;
// The page's clock still runs between the test's own steps (a busy machine
// adds real milliseconds), so "the same flight" is checked against the
// flight's own path from where it was parked, by its flightTime, as the
// help-answered check does: never a fixed distance from the parked point
const park=s=>({x:s.rocket.rocket.x,y:s.rocket.rocket.y,vx:s.rocket.velocity.x,vy:s.rocket.velocity.y,t:s.rocket.flightTime});
function onPath(s,p){const r=s.rocket,el=r.flightTime-p.t;if(!(el>=0))return false;if(r.state==='arrived')return true;if(r.state!=='flight')return false;return near(r.rocket.x,p.x+p.vx*el+r.wind*el*el/2)&&near(r.rocket.y,p.y+(p.vy*el+r.gravity*el*el/2)*r.width/r.height);}
async function pull(p,point,{cancel=false,cancelOther=false,hold=0,background=false,release=true}={}){
 const b=await p.locator('#rocketCanvas').boundingBox(),button=await p.locator('#rocketPull').boundingBox();await p.mouse.move(button.x+button.width/2,button.y+button.height/2);await p.mouse.down();await p.mouse.move(b.x+point.x*b.width,b.y+point.y*b.height,{steps:16});
 if(cancelOther)await p.locator('#rocketPull').evaluate(e=>e.dispatchEvent(new PointerEvent('pointercancel',{pointerId:99})));if(hold)await advance(p,hold);const during=await state(p);
 if(cancel)await p.locator('#rocketPull').evaluate(e=>e.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1})));
 if(background){await p.evaluate(()=>__quiet.background());await advance(p,350);await p.mouse.up();await p.evaluate(()=>__quiet.foreground());await p.locator('#resume').click();}
 else if(release)await p.mouse.up();await advance(p,50);return during;
}
// Independent closed-form projectile aiming. The test uses real drag/release
// controls and physical collision; no game completion/solver callback is used.
function aim(g){let best;for(let t=.5;t<=2.8;t+=.025){const denominator=1-g.gain*t,x=(g.target.x-g.origin.x-g.wind*t*t/2)/denominator,y=((g.target.y-g.origin.y)*g.height/g.width-g.gravity*t*t/2)/denominator,length=Math.hypot(x,y);if(y<g.pull.min*1.1||length>g.pull.max*.96)continue;const score=length+t*.015;if(!best||score<best.score)best={x:g.origin.x+x,y:g.origin.y+y*g.width/g.height,score,time:t};}if(!best)throw Error('No reachable physical launch: '+JSON.stringify(g));return best;}
// Up to three aimed pulls: the last planet sways, so the first aim can miss
// it, and from that miss it holds still where it is.
async function launch(p,stage){for(let n=0;n<3;n++){let s=await state(p);if(s.speech.step>stage)return true;if(s.rocket.state!=='ready'){await until(p,()=>__rocket.state==='ready'||__sayplay.step>__rocket.stage,7000);continue;}await pull(p,aim(s.rocket));if(await until(p,(st)=>__sayplay.step>st||__rocket.state==='ready',7000,stage)&&(await state(p)).speech.step>stage)return true;}return until(p,()=>__sayplay.step>window.__rocket.stage,3000);}
// A pull far to the side: a real downward pull that flies well wide.
const wide=g=>({x:g.origin.x+.2,y:g.origin.y+.12*g.width/g.height});
const powerOff=p=>until(p,()=>window.__rocket.power===0,12000);
const part=process.env.ROCKET_PART;
try{
 h=await gameHarness('rocket',8355);const fresh=(opts={})=>h.fresh({...opts,device:{age:'4',...opts.device}});
 if(!part||part==='main'){
  // ── (d) parked: a typed address goes home before any mic or sound ──
  {const {page,context,errors}=await fresh({unpark:false});
   const home=await until(page,()=>/\/(today|activities)\.html/.test(location.pathname)&&!!document.getElementById('libraryMessage')&&/Rocket Blast is coming soon/.test(document.getElementById('libraryMessage').textContent),8000);
   ok('the parked launchpad goes back to Home, which says it is coming soon',home&&!page.url().includes('arcade-rocket'),{url:page.url(),msg:await page.evaluate(()=>{const m=document.getElementById('libraryMessage');return m&&m.textContent;})});
   ok('…with no mic asked for and no sound played',await page.evaluate(()=>__quiet.requests===0&&__quiet.soundsBefore===0&&__quiet.sounds.length===0),await page.evaluate(()=>({r:__quiet.requests,b:__quiet.soundsBefore,s:__quiet.sounds.length})));
   ok('parked bounce has no runtime errors',errors.length===0,errors);await context.close();}
  // ── the original flow, with the ladder watched along the way ──
  {const {page,context,errors}=await fresh();const board=await page.locator('#rocketCanvas').count();ok('Rocket Blast has a real launch board',board===1);if(!board)throw Error('Rocket Blast is still a countdown animation');
  ok('the start card and Echo say the word brings the rocket',await page.evaluate(()=>/word two times to get a rocket/.test(document.getElementById('startOvl').textContent)&&/word two times to get each rocket/.test(document.getElementById('primer').textContent)));
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);await advance(page,1600);let s=await state(page);ok('(a) silence cannot fly to a planet',!s.rocket.active&&s.rocket.arrived===0&&s.speech.step===0&&s.rocket.misses===0,s);ok('two sayings earn the first rocket',await sayWord(page));s=await state(page);const origin={...s.rocket.origin},wideR=s.rocket.target.r;
  // REBUILT: the word used to switch on ten seconds of the bigger ring and the
  // whole drawn flight path, so every launch landed. Now it brings the rocket only.
  ok('the word brings the rocket and nothing else: no power, the small ring, no drawn path',s.rocket.active&&s.rocket.power===0&&!s.rocket.assist.fullPath&&!s.rocket.assist.snap&&s.rocket.wind===0,s.rocket);
  {const during=await pull(page,aim(s.rocket),{cancel:true}),path=during.rocket.path,last=path[path.length-1]||{x:0,y:0},t=during.rocket.target,gap=Math.hypot(last.x-t.x,(last.y-t.y)*during.rocket.height/during.rocket.width);
   ok('…so a pull shows only the first bit of its path, which stops well short of the planet',during.rocket.state==='pulling'&&path.length>2&&gap>t.r*1.5,{n:path.length,gap,r:t.r});
   s=await state(page);ok('…and a pull let go of by the phone is no try and no flight',s.rocket.state==='ready'&&s.rocket.misses===0&&s.rocket.launches===0,s.rocket);}
  await advance(page,1800);s=await state(page);ok('a word and idle animation cannot launch',s.rocket.state==='ready'&&s.rocket.rocket.x===origin.x&&s.rocket.rocket.y===origin.y&&s.rocket.arrived===0,s);
  await advance(page,9500);s=await state(page);ok('the ring stays the small one while the child waits',s.rocket.power===0&&near(wideR,s.rocket.target.r,1e-9),{wideR,normal:s.rocket.target.r});ok('waiting is never a miss',s.rocket.misses===0&&s.rocket.ladder===0,s.rocket);
  await pull(page,{x:origin.x,y:origin.y+.005});s=await state(page);ok('a tiny pull cannot launch or spend the word',s.rocket.state==='ready'&&s.speech.step===0,s);ok('…and counts as a try, so the ring glows, grows and the ghost shows where to pull',s.rocket.misses===1&&s.rocket.ladder===1&&!!s.rocket.ghost&&s.rocket.wind===0&&s.rocket.assist.fullPath&&s.rocket.target.r>wideR*1.25,s.rocket);
  await pull(page,{x:origin.x,y:origin.y-.08});s=await state(page);ok('an upward pull cannot launch backwards',s.rocket.state==='ready'&&s.speech.step===0&&s.rocket.ladder===2,s);
  const held=await pull(page,{x:origin.x+.02,y:origin.y+.1},{cancel:true,cancelOther:true,hold:180});s=await state(page);ok('another pointer cannot cancel the held rocket',held.rocket.held&&held.rocket.state==='pulling',held);ok('the owning cancel returns safely without launching',!s.rocket.held&&s.rocket.state==='ready'&&near(s.rocket.rocket.x,origin.x)&&near(s.rocket.rocket.y,origin.y)&&s.rocket.misses===2,s);await pull(page,{x:origin.x,y:origin.y+.1},{background:true});s=await state(page);ok('backgrounding during a pull releases it without a free flight',s.rocket.active&&!s.rocket.paused&&!s.rocket.held&&s.rocket.state==='ready'&&s.speech.step===0,s);
  await page.locator('#rocketPull').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');const launchY=(await state(page)).rocket.rocket.y;await page.keyboard.press('Enter');await advance(page,120);s=await state(page);ok('the keyboard really launches a moving rocket',s.rocket.state==='flight'&&Math.hypot(s.rocket.velocity.x,s.rocket.velocity.y)>0&&s.rocket.rocket.y<launchY,s);await page.locator('#rocketRetry').click();s=await state(page);ok('Try again keeps the accepted word and resets only flight',s.rocket.state==='ready'&&s.rocket.arrived===0&&s.speech.step===0,s);
  await pull(page,wide(s.rocket));await until(page,()=>__rocket.state!=='flight',7000);s=await state(page);ok('from the second try any downward pull flies into the ring',s.rocket.state==='arrived'&&s.rocket.celebrating&&s.speech.step===0,s);
  {const beat=await page.evaluate(()=>__rocket.celebrating);await advance(page,700);const still=await state(page);const next=await until(page,()=>__sayplay.step===1,1500);const after=await state(page);ok('a short celebration comes before the next word',beat&&still.speech.step===0&&still.rocket.celebrating&&next&&!after.rocket.celebrating,{still,after});}
  // stage 2: help mid-flight, answered
  ok('two sayings earn the second rocket',await sayWord(page));s=await state(page);ok('a new word starts the ladder again',s.rocket.misses===0&&s.rocket.ladder===0&&s.rocket.stage===1,s.rocket);
  await pull(page,aim(s.rocket));await advance(page,100);await page.locator('#rocketHelp').evaluate(e=>e.addEventListener('click',()=>{window.__rocketAtHelp=JSON.parse(JSON.stringify(__rocket));},{once:true,capture:true}));await page.locator('#rocketHelp').click();const saved=await page.evaluate(()=>__rocketAtHelp.rocket);await until(page,()=>__sayplay.listening);s=await state(page);ok('speech help parks this exact flight',s.rocket.paused&&near(s.rocket.rocket.x,saved.x)&&near(s.rocket.rocket.y,saved.y)&&s.speech.step===1,s);const parked={...s.rocket.rocket},parkedTime=s.rocket.flightTime,velocity={...s.rocket.velocity};ok('the repeated word renews the same flight',await sayWord(page));s=await state(page);const elapsed=s.rocket.flightTime-parkedTime,expectedX=parked.x+velocity.x*elapsed+s.rocket.wind*elapsed*elapsed/2,expectedY=parked.y+(velocity.y*elapsed+s.rocket.gravity*elapsed*elapsed/2)*s.rocket.width/s.rocket.height;ok('help preserves the resumed ballistic position and momentum',s.rocket.state==='flight'&&s.rocket.power>0&&near(s.rocket.rocket.x,expectedX)&&near(s.rocket.rocket.y,expectedY)&&near(s.rocket.velocity.x,velocity.x+s.rocket.wind*elapsed)&&near(s.rocket.velocity.y,velocity.y+s.rocket.gravity*elapsed)&&s.speech.step===1,s);await page.locator('#rocketRetry').click();s=await state(page);ok('giving up a flight is a try',s.rocket.misses===1&&s.rocket.ladder===1,s.rocket);await advance(page,Math.max(0,(s.rocket.power-.65)*1000));s=await state(page);const radius=s.rocket.target.r;await pull(page,{x:s.rocket.origin.x+.06,y:s.rocket.origin.y+.17*s.rocket.width/s.rocket.height});await advance(page,800);s=await state(page);ok('an earned flight keeps its ring when power expires',s.rocket.power===0&&s.rocket.state==='flight'&&near(s.rocket.target.r,radius,.00001)&&s.speech.step===1,s);await until(page,()=>__rocket.state!=='flight',6000);s=await state(page);ok('a missed flight returns for another try on the same word',s.rocket.state==='ready'&&s.rocket.retries>1&&s.rocket.arrived===1&&s.speech.step===1&&s.rocket.ladder===2,s);await pull(page,aim(s.rocket));await advance(page,300);await page.screenshot({path:path.join(OUT,'sona-rocket-flight.png')});ok('a real pull and ballistic flight reach the second planet',await until(page,()=>__sayplay.step===2,7000),await state(page));
  const sites=[];for(let stage=2;stage<5;stage++){if(!await sayWord(page))throw Error('Could not earn launch '+stage);s=await state(page);sites.push([s.rocket.target.x,s.rocket.target.y].join(','));ok('real finger launch reaches planet '+(stage+1),await launch(page,stage),await state(page));}
  await advance(page,3300);s=await state(page);ok('five actual flights finish Rocket Blast',s.speech.phase==='end'&&s.speech.step===5&&s.rocket.arrived===5&&s.rocket.won,s);ok('the planets offer different launch paths',new Set(sites).size===3,sites);const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length}));ok('launch sounds never reach the microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);await page.screenshot({path:path.join(OUT,'sona-rocket-finished.png')});await page.locator('#again').click();await advance(page,350);s=await state(page);ok('a new space trip needs speech and pulling again',s.speech.step===0&&s.rocket.arrived===0&&!s.rocket.active&&!s.rocket.held&&s.rocket.misses===0,s);ok('no runtime errors',errors.length===0,errors);await context.close();}
 }
 if(!part||part==='struggle'){
  // ── (b) a child who keeps missing, and (c) help nobody answers ──
  const {page,context,errors}=await fresh();await page.locator('#startBtn').click();
  await until(page,()=>__sayplay.listening);await advance(page,13500);ok('…a quiet window first makes Echo say the word again, once, and listen again: nothing earned',await page.evaluate(()=>__sayplay.phase==='turn'&&__sayplay.step===0&&__sayplay.said===0));await advance(page,14000);let s=await state(page);ok('(a) two quiet listens earn nothing',s.speech.step===0&&!s.rocket.active&&s.rocket.arrived===0&&s.speech.phase==='nudge',s.speech);
  await page.locator('#micBtn').click();ok('two sayings earn the first rocket',await sayWord(page));await powerOff(page);
  const quietFrom=await page.evaluate(()=>__quiet.voicedFrames);const ladders=[];
  for(let n=0;n<2;n++){s=await state(page);await pull(page,wide(s.rocket));await until(page,()=>__rocket.state!=='flight',7000);s=await state(page);ladders.push(s.rocket.ladder);ok('wide flight '+(n+1)+' misses and comes back',s.rocket.state==='ready'&&s.speech.step===0&&s.rocket.misses===n+1,s.rocket);}
  ok('the ladder rises with each miss: glow and ghost, then anything works',ladders[0]===1&&ladders[1]===2&&!!s.rocket.ghost&&s.rocket.wind===0,{ladders,r:s.rocket});
  await page.screenshot({path:path.join(OUT,'sona-rocket-ghost.png')});
  await advance(page,6000);s=await state(page);ok('no timer flies the rocket for the child',s.rocket.state==='ready'&&s.speech.step===0&&s.rocket.launches===2,s.rocket);
  await pull(page,wide(s.rocket));ok('the third sloppy pull reaches the planet with no speech',await until(page,()=>__sayplay.step===1,7000)&&await page.evaluate(q=>__quiet.voicedFrames===q,quietFrom),await state(page));
  // (c) help asked mid-flight, then silence: the same flight goes on, no power
  ok('two sayings earn the second rocket',await sayWord(page));await powerOff(page);s=await state(page);await pull(page,aim(s.rocket));await advance(page,150);
  await page.locator('#rocketHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);const at=park(s),t0=s.rocket.flightTime;ok('help parks the flight',s.rocket.paused&&s.rocket.state==='flight',s.rocket);
  ok('a help ask nobody answers gives the move back',await until(page,()=>__sayplay.phase==='play'&&!__sayplay.listening,20000));s=await state(page);
  ok('(c) …the same flight, unpaused, with no power and the same step',!s.rocket.paused&&s.rocket.power===0&&s.speech.step===1&&s.rocket.flightTime-t0<1&&onPath(s,at),{s:s.rocket,at,t0});
  ok('…and it flies on into the ring',await until(page,()=>__sayplay.step===2,7000),await state(page));
  // (c) the same via the Back to the game pill
  ok('two sayings earn the third rocket',await sayWord(page));await powerOff(page);s=await state(page);await pull(page,aim(s.rocket));await advance(page,150);
  await page.locator('#rocketHelp').click();await until(page,()=>__sayplay.listening);ok('the Back to the game pill shows during help',await page.locator('#helpBack').isVisible());s=await state(page);const at2=park(s);
  await page.locator('#helpBack').click();await advance(page,50);s=await state(page);ok('(c) Back to the game returns the same flight with no power',s.speech.phase==='play'&&!s.rocket.paused&&s.rocket.power===0&&s.speech.step===2&&onPath(s,at2),{s,at2});
  ok('…and it reaches the planet',await until(page,()=>__sayplay.step===3,7000),await state(page));
  // a page hidden during the help ask also hands the same flight back
  ok('two sayings earn the fourth rocket',await sayWord(page));await powerOff(page);s=await state(page);await pull(page,aim(s.rocket));await advance(page,150);
  await page.locator('#rocketHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);const at3=park(s);
  await page.evaluate(()=>__quiet.background());await advance(page,350);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await advance(page,50);s=await state(page);
  ok('a pause during help returns the same flight with no power',s.speech.phase==='play'&&!s.rocket.paused&&s.rocket.power===0&&s.speech.step===3&&onPath(s,at3),{s,at3});
  ok('…and it reaches the planet',await until(page,()=>__sayplay.step===4,7000),await state(page));
  ok('struggle has no runtime errors',errors.length===0,errors);await context.close();
 }
 if(!part||part==='planets'){
  // ── the planets: a collection that is each child's own ──
  const src=readFileSync(path.join(ROOT,'sona.js'),'utf8'),at=src.indexOf('const PER_KID'),perKid=src.slice(at,src.indexOf(']);',at));
  ok('the planets found are each child\'s own: a per-child key, read and written through Sona.kkey',perKid.includes('"sona.rocket.v1"')&&readFileSync(path.join(ROOT,'arcade-rocket.html'),'utf8').includes('Sona.kkey("sona.rocket.v1")'));
  const rows=p=>p.evaluate(()=>['planetRow','planetRowEnd'].map(id=>{const e=document.getElementById(id);return{id,hidden:e.hidden,label:e.getAttribute('aria-label'),text:e.textContent,got:[...e.querySelectorAll('img.got')].map(i=>i.dataset.planet),left:[...e.querySelectorAll('img.left')].map(i=>i.dataset.planet),fresh:[...e.querySelectorAll('img.new')].map(i=>i.dataset.planet)};}));
  const kept=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('sona.rocket.v1')||'null'));
  const dotPics=p=>p.evaluate(()=>[...document.querySelectorAll('#dots i')].map(i=>({on:i.classList.contains('on'),bg:getComputedStyle(i).backgroundImage})));
  const catalog=p=>p.evaluate(()=>({planets:Rocket.planets,waiting:Rocket.waiting}));
  const end=p=>p.evaluate(()=>({title:document.getElementById('endTitle').textContent,sub:document.getElementById('endSub').textContent}));
  const noCount=r=>!/\d/.test(r.label+r.text);
  // A planet is in the game only with its painted picture (Travis, 9 Nov
  // 2026: "3 planets now"); the rest wait, listed, and join one at a time.
  // Everything below holds for any number of planets from three to ten.
  {const {page,context,errors}=await fresh(),both=await catalog(page),cat=both.planets,gone=c=>!existsSync(path.join(ROOT,'assets/crafted/game',c.art));
   ok('every planet in the game has its own painted picture, on disk',cat.length>=3&&new Set(cat.map(c=>c.art)).size===cat.length&&!cat.some(gone),cat.filter(gone));
   ok('…and the ten are the game\'s planets and the ones still waiting for theirs',cat.length+both.waiting.length===10&&both.waiting.every(id=>!cat.some(c=>c.id===id)),both);
   const many=Math.min(5,cat.length);
   let r=await rows(page);ok('a new child\'s start card shows every planet as a dark shape still to find, with no count',!r[0].hidden&&r[0].got.length===0&&r[0].left.length===cat.length&&/No planets found yet/.test(r[0].label)&&noCount(r[0]),r[0]);
   let s=await state(page);ok('a first trip is all planets the child has not found',s.rocket.planets.length===5&&new Set(s.rocket.planets).size===many&&s.rocket.planets.every(id=>!s.rocket.got.includes(id)),s.rocket);
   const sp=s.rocket.spots,off=sp.map(x=>x.x-.5);
   ok('each trip is a little farther: straight up first, then farther and farther to the side, and higher',Math.abs(off[0])<1e-9&&Math.abs(off[1])<Math.abs(off[2])&&Math.abs(off[2])<Math.abs(off[3])&&sp[0].rise<sp[1].rise&&sp[1].rise<sp[3].rise,sp);
   ok('…from one side to the other',Math.sign(off[1])===-Math.sign(off[2])&&Math.sign(off[2])===-Math.sign(off[3]),off);
   ok('…and only the last planet sways',sp[4].drift>0&&sp.slice(0,4).every(x=>!x.drift),sp);
   await page.locator('#startBtn').click();
   for(let st=0;st<4;st++){
    ok('word '+(st+1)+' brings a rocket',await sayWord(page));const want=(await state(page)).rocket.planet;
    ok('planet '+(st+1)+' is reached by a real launch',await launch(page,st),await state(page));
    const d=await dotPics(page),art=cat.find(c=>c.id===want).art,k=await kept(page);
    ok('the top bar shows planet '+(st+1)+' once it is reached, and no planet not reached yet',d.length===5&&d.filter(x=>x.on).length===st+1&&d[st].bg.includes(art)&&d.slice(st+1).every(x=>x.bg==='none'),{d,art});
    ok('…and it is kept for the child the moment it is landed on',!!k&&k.got.includes(want),k);
   }
   // the last planet: it sways, holds still for the help word's power, and after a miss
   ok('word 5 brings a rocket',await sayWord(page));s=await state(page);const x0=s.rocket.target.x;await advance(page,1500);s=await state(page);
   ok('the last planet sways from side to side while the child aims',s.rocket.swaying&&Math.abs(s.rocket.target.x-x0)>0.02&&Math.abs(s.rocket.target.x-.5)<=s.rocket.drift+1e-9,{x0,x:s.rocket.target.x});
   await page.locator('#rocketHelp').click();await until(page,()=>__sayplay.listening);ok('the help word…',await sayWord(page));s=await state(page);const xh=s.rocket.target.x;await advance(page,1200);s=await state(page);
   ok('…holds it still while its power lasts',s.rocket.power>0&&!s.rocket.swaying&&near(s.rocket.target.x,xh,1e-9),{xh,s:s.rocket});
   await powerOff(page);await advance(page,1000);s=await state(page);ok('…and it sways again once the power is spent',s.rocket.swaying&&!near(s.rocket.target.x,xh,1e-4),s.rocket);
   await pull(page,wide(s.rocket));await until(page,()=>__rocket.state!=='flight',7000);s=await state(page);const xm=s.rocket.target.x;await advance(page,2000);s=await state(page);
   ok('a miss holds it still where it is, with the ghost rocket showing where to pull',s.rocket.misses>=1&&!s.rocket.swaying&&near(s.rocket.target.x,xm,1e-9)&&!!s.rocket.ghost&&s.speech.step===4,{xm,s:s.rocket});
   ok('the last planet is reached',await launch(page,4),await state(page));
   await advance(page,3300);s=await state(page);r=await rows(page);const e=await end(page),k=await kept(page);
   ok('a first trip ends: "You found new planets!"',s.speech.phase==='end'&&e.title==='You found new planets!',e);
   ok('the end card shows this trip\'s planets found and ringed as new, the rest still to find, with no count',!r[1].hidden&&r[1].got.length===many&&r[1].fresh.length===many&&r[1].left.length===cat.length-many&&r[1].got.every(id=>s.rocket.planets.includes(id))&&noCount(r[1]),r[1]);
   ok('…and the child keeps them all',!!k&&k.got.length===many&&s.rocket.planets.every(id=>k.got.includes(id)),k);
   // Play again: a new trip, planned from what the child has found now
   await page.locator('#again').click();await advance(page,350);s=await state(page);
   ok('Play again plans a new trip from the planets the child has found, with nothing new yet',s.rocket.planets.length===5&&s.rocket.fresh.length===0&&s.rocket.got.length===many&&s.speech.step===0,s.rocket);
   ok('planets have no runtime errors',errors.length===0,errors);await context.close();
   // A child with one planet still to find: the trip goes to planets already
   // found, and the new one last and farthest; finding it names it.
   const last=cat[cat.length-1],have=cat.slice(0,-1).map(c=>c.id);
   const one=await fresh({device:{seed:{'sona.rocket.v1':JSON.stringify({got:have})}}});
   s=await state(one.page);
   ok('one planet left to find: the trip flies to found planets, then the new one last',s.rocket.planets.slice(0,4).every(id=>have.includes(id))&&s.rocket.planets[4]===last.id&&s.rocket.fresh.length===0,s.rocket);
   await one.page.locator('#startBtn').click();
   for(let st=0;st<5;st++){if(!await sayWord(one.page))throw Error('no word '+st);ok('one left: planet '+(st+1)+' is reached',await launch(one.page,st),await state(one.page));}
   await advance(one.page,3300);r=await rows(one.page);const e2=await end(one.page);
   ok('a trip that finds one planet names it on the end card',e2.title==='You found '+last.name+'!',{e2,name:last.name});
   ok('…and rings only that one as new, with every planet now found',r[1].got.length===cat.length&&r[1].fresh.length===1&&r[1].fresh[0]===last.id&&r[1].left.length===0&&/Every planet found!/.test(r[1].label),r[1]);
   ok('one-left has no runtime errors',one.errors.length===0,one.errors);await one.context.close();}
  // every planet found: five trips to them, any order, and the end card as
  // before (a record may name a planet still waiting for its picture: it is
  // ignored, never shown)
  {const all=['bumpy','purple','ring','strawberry','snow','ocean','flower','candy','cloud','rainbow'];
   const {page,context,errors}=await fresh({device:{seed:{'sona.rocket.v1':JSON.stringify({got:all})}}});
   const n=(await catalog(page)).planets.length;
   let r=await rows(page);ok('a child who has found them all sees every planet in colour, and "Every planet found!"',r[0].got.length===n&&r[0].left.length===0&&/Every planet found!/.test(r[0].label),r[0]);
   await page.locator('#startBtn').click();let s=await state(page);ok('…and still flies to them, five trips',s.rocket.planets.length===5&&new Set(s.rocket.planets).size===Math.min(5,n)&&s.rocket.planets.every(id=>all.includes(id))&&s.rocket.got.length===n,s.rocket);
   for(let st=0;st<5;st++){if(!await sayWord(page))throw Error('no word '+st);ok('all found: planet '+(st+1)+' is reached',await launch(page,st),await state(page));}
   await advance(page,3300);const e=await end(page);ok('…with the end card as before, naming nothing new',e.title==='Five little space adventures!',e);
   ok('all-found has no runtime errors',errors.length===0,errors);await context.close();}
  // a record from somewhere else (a backup, an old build) cannot add a planet that does not exist
  {const {page,context,errors}=await fresh({device:{seed:{'sona.rocket.v1':JSON.stringify({got:['bumpy','pluto','bumpy',7]})}}});
   const s=await state(page);ok('an unknown or doubled planet in the record is ignored',JSON.stringify(s.rocket.got)==='["bumpy"]',s.rocket.got);
   ok('junk record has no runtime errors',errors.length===0,errors);await context.close();}
 }
 if(!part||part==='fit'){
  {const {page,context,errors}=await fresh();await context.route(u=>/\/assets\/crafted\/(game\/|home-rocket|echo-wave)/.test(u.href),r=>r.abort());await page.reload();await advance(page,200);
   ok('a missing start picture hides itself',await page.locator('.rocket-intro').evaluate(e=>e.hidden||e.offsetHeight===0));
   await page.locator('#startBtn').click();await sayWord(page);ok('missing painted art cannot prevent a real flight',await launch(page,0));ok('fallback has no runtime errors',errors.length===0,errors);await context.close();}
  const inside=(r,v)=>r.x>=-0.5&&r.y>=-0.5&&r.right<=v.width+0.5&&r.bottom<=v.height+0.5;
  const rects=(page,ids)=>page.evaluate(ids=>ids.map(id=>{const e=document.getElementById(id);const r=e.getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,shown:!!e.offsetParent||getComputedStyle(e).position==='fixed'};}),ids);
  for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024}]){
   const W=viewport.width,{page,context,errors}=await fresh({viewport});
   {const c=await page.evaluate(()=>{const b=document.getElementById('startBtn').getBoundingClientRect(),row=document.getElementById('planetRow').getBoundingClientRect();return{btn:b.bottom,row:row.height,h:innerHeight};});
    ok('the start card shows the planets and its Play button without scrolling at '+W,c.row>0&&c.btn<=c.h,c);}
   await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
   {const t=await page.evaluate(()=>['close','ttl','dots'].map(id=>{const r=document.getElementById(id==='ttl'?'ttl':id);const e=id==='ttl'?r.parentElement:r;const b=e.getBoundingClientRect();return{id,x:b.x,right:b.right,y:b.y,bottom:b.bottom};}));
    ok('the top bar\'s planet row fits beside the title at '+W,t.every(x=>x.x>=-0.5&&x.right<=W+0.5)&&t[0].right<=t[1].x+0.5&&t[1].right<=t[2].x+0.5,t);}
   let r=await rects(page,['turnPanel','hear','word']);ok('the word turn fits '+W,r.every(x=>inside(x,viewport))&&r.find(x=>x.id==='hear').h>=44,r);
   await sayWord(page);
   const fit=await page.evaluate(()=>({height:innerHeight,scroll:document.documentElement.scrollHeight}));r=await rects(page,['rocketCanvas','rocketPull','rocketHelp','rocketRetry','rocketBanner','rocketControls']);
   const g=(await state(page)).rocket,canvas=r[0],ring={x:canvas.x+g.target.x*canvas.w,y:canvas.y+g.target.y*canvas.h,r:g.target.r*canvas.w},banner=r.find(x=>x.id==='rocketBanner'),bar=r.find(x=>x.id==='rocketControls');
   ok('launchpad fits '+W+'x'+viewport.height,fit.scroll<=fit.height+1&&r.every(x=>inside(x,viewport)),{fit,r});
   ok('launch controls remain large touch targets at '+W,r.filter(x=>['rocketPull','rocketHelp','rocketRetry'].includes(x.id)).every(x=>x.w>=44&&x.h>=44),r);
   ok('the ring sits clear of the banner and the buttons at '+W,ring.y-ring.r>=banner.bottom-2&&ring.y+ring.r<=bar.y&&ring.x-ring.r>=0&&ring.x+ring.r<=W,{ring,banner,bar});
   await page.locator('#rocketHelp').click();await until(page,()=>__sayplay.listening);r=await rects(page,['turnPanel','helpBack','hear']);
   ok('the help ask and its Back to the game pill fit '+W,r.every(x=>inside(x,viewport))&&r.find(x=>x.id==='helpBack').h>=44&&r.find(x=>x.id==='helpBack').w>=44,r);
   await page.locator('#helpBack').click();await advance(page,50);ok('back in play at '+W,(await state(page)).speech.phase==='play');
   for(let stage=0;stage<(W===320||W===768?5:1);stage++){if(stage&&!await sayWord(page))throw Error('Could not earn fitted launch');
    if(stage){const g=(await state(page)).rocket,sp=g.spots[stage],cv=await page.locator('#rocketCanvas').boundingBox(),bn=await page.locator('#rocketBanner').boundingBox(),br=await page.locator('#rocketControls').boundingBox(),rr=g.target.r*cv.width,lo=cv.x+(sp.x-sp.drift)*cv.width-rr,hi=cv.x+(sp.x+sp.drift)*cv.width+rr,y=cv.y+g.target.y*cv.height;
     ok('planet '+(stage+1)+' (and all of its sway) sits on the screen, clear of the banner and the buttons at '+W,lo>=0&&hi<=W&&y-rr>=bn.y+bn.height-2&&y+rr<=br.y,{lo,hi,y,rr,banner:bn,bar:br});}
    ok('planet '+(stage+1)+' is reachable at '+W,await launch(page,stage),await state(page));}
   await page.screenshot({path:path.join(OUT,'sona-rocket-'+W+'.png')});ok('fit has no runtime errors',errors.length===0,errors);await context.close();
  }
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
