// WINDUP1: Wind-Up Toys, Day 2 of the daily story (STORY1). Each word said
// three times (Sona.STORY_SAY_TIMES, every story game since 23 Oct 2026; it
// was two) pops the next toy's key out; the finger winds it by drawing circles
// on the brass dial and lets go at the star (ages 5-8), or winds until it
// rings (ages 3-4). Plays the real page on a paused fake clock, so every wait
// is on published state (window.__windup, window.__sayplay), never on real
// time. WINDUP_PART=locked|main|replay|struggle|little|help|buddy|fit|standins|keyboard|motion
// runs one part (also app, source). Every part but replay runs without it;
// replay runs only when named (its own suite, tests/windupreplaytest.mjs),
// because the rest of the file already takes about 170 s of run-all's 300.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
const PORT=8391,part=process.env.WINDUP_PART;
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
const st=p=>p.evaluate(()=>({speech:window.__sayplay,w:window.__windup}));
const W=p=>p.evaluate(()=>window.__windup);
const UNKIND=/\b(miss(ed|es)?|wrong|fail(ed)?|score|points?|correct|lose|lost|bad|no!)\b/i;
const PROFILE=(o={})=>JSON.stringify({childName:'Mia',childAge:'7',focusSounds:['R'],onboarded:true,earlyAdopter:true,voiceOn:true,soundOn:true,volume:0.6,...o});
// a fresh page with the fake clock paused once it is up (as traintest does), so
// only advance() moves the game: real time on a busy machine can't run it on
async function fresh(opts={}){const f=await h.fresh({...opts,device:{age:'7',...opts.device}});if(opts.raw)return f;const now=await f.page.evaluate(()=>Date.now());await f.page.clock.pauseAt(now+1000);return f;}
// (with motion on, the start card is still easing in on the paused clock, and
// Playwright waits for it to hold still: a real tap doesn't)
async function begin(page,{force=false}={}){if(force)await page.locator('#startBtn').evaluate(b=>b.click());else await page.locator('#startBtn').click();return until(page,()=>window.__sayplay&&__sayplay.listening);}
const cbox=p=>p.locator('#windupCanvas').boundingBox();
// circles round the dial: `turns` of them, dir 1 clockwise on screen, at rf of
// its radius, one pointer move every 15 degrees (a finger on a phone sends more)
// (held: the finger is already down there, from a circle that did not lift)
async function circle(p,turns,{dir=1,rf=0.8,lift=true,held=false,per=24,start=-Math.PI/2}={}){
 const w=await W(p),b=await cbox(p),cx=b.x+w.dial.x,cy=b.y+w.dial.y,r=w.dial.r*rf;
 let a=start;if(!held){await p.mouse.move(cx+Math.cos(a)*r,cy+Math.sin(a)*r);await p.mouse.down();}
 const n=Math.round(turns*per);for(let i=1;i<=n;i++){a=start+dir*i*2*Math.PI/per;await p.mouse.move(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}
 if(lift)await p.mouse.up();await advance(p,40);
}
// wind until the needle is in the middle of the star (ages 5-8), then let go
async function windToStar(p,{dir=1}={}){
 let w=await W(p);const g=w.gain,want=(w.star?w.need:w.need)-w.turns;await circle(p,Math.max(0,want/g),{dir});
}
// a finger moving on the board with nothing wound: small wiggles at (fx, fy)
// of the canvas, one every 100 ms of the game's clock, for `ms`
async function wiggle(p,ms,{fx=0.5,fy=0.25,lift=true,held=false}={}){
 const b=await cbox(p);let x=b.x+b.width*fx,y=b.y+b.height*fy;if(!held){await p.mouse.move(x,y);await p.mouse.down();}
 for(let t=0;t<ms;t+=100){x+=(t/100)%2?-6:6;await p.mouse.move(x,y);await advance(p,100);}
 if(lift){await p.mouse.up();await advance(p,40);}
}
// back and forth across the dial's middle (a scribble, or rubbing)
async function rub(p,strokes,{len=0.7,fy=0,lift=true,held=false}={}){
 const w=await W(p),b=await cbox(p),cx=b.x+w.dial.x,cy=b.y+w.dial.y+w.dial.r*fy,L=w.dial.r*len;
 if(!held){await p.mouse.move(cx-L,cy);await p.mouse.down();}
 for(let i=0;i<strokes;i++){await p.mouse.move(i%2?cx-L:cx+L,cy,{steps:8});}
 if(lift){await p.mouse.up();await advance(p,40);}
}
// the step counts after the cheer (BEAT, 1.15 s on the game's clock)
const stepped=(p,s)=>until(p,n=>__sayplay.step>n,4000,s);
// Echo's step line is fetched, then spoken: wait for it on the game's clock
const heard=(p,line)=>until(p,l=>__quiet.speech.includes(l),4000,line);
const audit=p=>p.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));
async function finishRound(page,from,{steps=8}={}){
 for(let k=from;k<steps;k++){
  if(!await sayWord(page))return false;
  await windToStar(page,{dir:k%2?-1:1});
  if(!await stepped(page,k))return false;
 }
 return until(page,()=>__sayplay.phase==='end',6000);
}

try{
 h=await gameHarness('windup',PORT);

 // ── locked: without Premium the page goes Home before any mic or sound ──
 if(!part||part==='locked'){
  const {page,context,errors}=await fresh({raw:true,device:{premium:false}});
  const went=[];page.on('framenavigated',f=>{if(f===page.mainFrame())went.push(new URL(f.url()).pathname);});
  await context.addInitScript(()=>{if(location.pathname!=='/arcade-windup.html')return;try{sessionStorage.setItem('windup.seen','1');}catch(e){}addEventListener('pagehide',()=>{try{sessionStorage.setItem('windup.quiet',JSON.stringify({requests:__quiet.requests,mics:__quiet.mics.length,sounds:__quiet.sounds.length,sfx:__quiet.sfx.length,speech:__quiet.speech.length}));}catch(e){}});});
  await page.goto('http://127.0.0.1:'+PORT+'/arcade-windup.html');
  const home=await until(page,()=>location.pathname==='/today.html'||location.pathname==='/subscribe.html',8000);
  const led=await page.evaluate(()=>({seen:sessionStorage.getItem('windup.seen'),quiet:JSON.parse(sessionStorage.getItem('windup.quiet')||'null'),requests:__quiet.requests}));
  ok('without Premium the story game goes Home (/today.html), never to a locked-game note',home&&went.includes('/today.html')&&!went.some(u=>/activities/.test(u)),went);
  ok('…having opened no mic and made no sound first',led.seen==='1'&&led.quiet&&led.quiet.requests===0&&led.quiet.mics===0&&led.quiet.sounds===0&&led.quiet.sfx===0&&led.quiet.speech===0&&led.requests===0,led);
  ok('locked bounce has no runtime errors',errors.length===0,errors);await context.close();
 }

 // ── main: one whole round for ages 5-8 ──
 if(!part||part==='main'){
  const {page,context,errors}=await fresh();
  const words=await page.evaluate(()=>({start:document.querySelector('#startOvl .ovlCard').innerText,canvas:document.getElementById('windupCanvas').getAttribute('aria-label'),help:document.getElementById('windupHelp').getAttribute('aria-label'),buddy:{alt:document.getElementById('windupBuddy').getAttribute('alt'),hidden:document.getElementById('windupBuddy').getAttribute('aria-hidden')}}));
  ok('the start card says the word, said three times, finds the key, then wind with circles and let go at the star',/three times to find a toy's key/i.test(words.start)&&/let go at the star/i.test(words.start),words.start);
  ok('…and the board\'s spoken label says three times too',/Say each word three times to find a toy's key/.test(words.canvas)&&!/two times/.test(words.canvas),words.canvas);
  ok('the help pill says it is extra help',/extra help/i.test(words.help),words.help);
  ok('the buddy is decoration only (empty alt, aria-hidden)',words.buddy.alt===''&&words.buddy.hidden==='true',words.buddy);
  ok('the start card makes no sound and opens no mic',await page.evaluate(()=>__quiet.requests===0&&__quiet.sounds.length===0));
  await begin(page);
  let s=await st(page);
  ok('Echo first says how the game goes, in the start card\'s words',s.speech.listening&&/three times to find a toy's key\. Wind it with circles/.test((await audit(page)).lines.join('|')),(await audit(page)).lines);
  await advance(page,1500);s=await st(page);
  ok('silence never finds the key',!s.w.active&&!s.w.keyOut&&s.w.turns===0&&s.speech.step===0,s);
  await advance(page,13000);s=await st(page);
  ok('a whole quiet listening window still earns nothing, and the mic closes to wait for a tap',s.speech.phase==='nudge'&&!s.w.active&&!s.w.keyOut&&s.w.turns===0&&s.speech.step===0,s);
  await circle(page,1.5);s=await st(page);
  ok('before the word the key is tucked in: circling winds nothing',s.w.turns===0&&s.w.clicks===0&&!s.w.held,s.w);
  await page.locator('#micBtn').click();
  // 23 Oct 2026: every story game asks each word Sona.STORY_SAY_TIMES (3)
  // times, not two, and only the last saying finds the key. Said one at a time
  // here, at sayWord()'s own pace (280 ms each, 650 ms apart), so the frame
  // after each saying can be read.
  ok('a story game asks each word Sona.STORY_SAY_TIMES (3) times: three dots and "Say it 3 times"',await until(page,()=>window.__sayplay&&__sayplay.listening)&&await page.evaluate(()=>Sona.STORY_SAY_TIMES===3&&__sayplay.times===Sona.STORY_SAY_TIMES&&document.querySelectorAll('#twiceDots i').length===Sona.STORY_SAY_TIMES&&document.getElementById('twiceSay').textContent==='Say it 3 times'),await page.evaluate(()=>({times:__sayplay.times,dots:document.querySelectorAll('#twiceDots i').length,say:(document.getElementById('twiceSay')||{}).textContent})));
  {const saying=async()=>{await page.evaluate(()=>__quiet.voice=true);await advance(page,280);await page.evaluate(()=>__quiet.voice=false);await advance(page,100);};
   const now=()=>page.evaluate(()=>({said:__sayplay.said,phase:__sayplay.phase,listening:__sayplay.listening,mic:document.getElementById('micState').textContent,dots:document.querySelectorAll('#twiceDots i.on').length,key:__windup.keyOut,active:__windup.active,step:__sayplay.step}));
   await advance(page,150);await saying();let n=await now();
   ok('one saying: one dot, "2 more times!", the mic still open, and no key',n.said===1&&n.dots===1&&n.mic==='2 more times!'&&n.listening&&!n.key&&!n.active&&n.step===0,n);
   await advance(page,550);await saying();n=await now();
   ok('two sayings alone find no key: two dots, "1 more time!", the mic still open',n.said===2&&n.dots===2&&n.mic==='1 more time!'&&n.listening&&n.phase!=='play'&&!n.key&&!n.active&&n.step===0,n);
   await advance(page,550);await saying();
   ok('the third saying pops the key out',await until(page,()=>__sayplay.phase==='play'),await now());}
  await advance(page,400);s=await st(page);
  ok('…and light the dial: the bunny\'s key is out and nothing is wound yet',s.w.keyOut&&s.w.active&&s.w.toy==='bunny'&&s.w.turns===0&&s.speech.step===0,s.w);
  ok('Echo says what to do with the first toy',await heard(page,'Draw circles around the key to wind it. Let go at the star!'),(await audit(page)).lines);
  await advance(page,20000);s=await st(page);
  ok('waiting winds nothing and climbs no help',s.w.turns===0&&s.w.ladder.effort===0&&s.w.ladder.circle===0&&s.speech.step===0,s.w);
  // a scribble back and forth over the top of the dial
  {const w=await W(page),b=await cbox(page),cx=b.x+w.dial.x,cy=b.y+w.dial.y,r=w.dial.r*0.8;await page.mouse.move(cx+Math.cos(-1.9)*r,cy+Math.sin(-1.9)*r);await page.mouse.down();
   for(let i=0;i<12;i++)for(let k=1;k<=6;k++){const a=i%2?-0.85-k*0.175:-1.9+k*0.175;await page.mouse.move(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}
   await page.mouse.up();await advance(page,40);}
  s=await st(page);ok('a scribble back and forth winds next to nothing',s.w.turns<0.2&&s.w.tries===0&&s.w.react===null,s.w);
  await rub(page,10);s=await st(page);ok('rubbing straight across the dial winds next to nothing (until the help says so)',s.w.turns<0.3&&s.w.tries===0,s.w);
  const t0=s.w.turns;await circle(page,0.25);s=await st(page);
  ok('a lift under 30% of the way to the star is no try at all',s.w.turns<s.w.tryAt&&s.w.tries===0&&s.w.ladder.misses===0&&s.w.react===null&&s.w.turns>t0,s.w);
  await circle(page,1.2);s=await st(page);const yawnAt=s.w.turns;
  ok('too little: the toy yawns and sits, the needle stays, and it is a kind miss',s.w.lastTry==='little'&&s.w.react==='yawn'&&s.w.ladder.misses===1&&s.w.turns>=s.w.tryAt&&s.w.banner==='A little more winding!',s.w);
  await advance(page,1500);s=await st(page);ok('…the needle stays where it was after the yawn',Math.abs(s.w.turns-yawnAt)<1e-9&&s.w.react===null,s.w);
  ok('after one miss the star is 1.6 times wider and a circle moves the needle 25% less',Math.abs(s.w.star.half-0.48)<1e-9&&Math.abs(s.w.gain-0.75)<1e-9,s.w);
  {const before=s.w.turns;await circle(page,1,{lift:false});s=await st(page);ok('…one more circle moves it three quarters of a turn',Math.abs(s.w.turns-before-0.75)<0.02,{before,now:s.w.turns});}
  await circle(page,1,{held:true});s=await st(page);
  ok('too much: the toy spins dizzy and the needle drops to just under the star (a kind miss)',s.w.lastTry==='dizzy'&&s.w.react==='dizzy'&&s.w.ladder.misses===2&&s.w.turns<s.w.star.low&&s.w.turns>s.w.star.low-0.1&&s.w.banner==='Whoa, dizzy! Let go a bit sooner',s.w);
  await advance(page,1500);s=await st(page);ok('after two misses: "Watch for the gold glow", and the key catches in the star',s.w.banner==='Watch for the gold glow'&&s.w.catchOn,s.w);
  await circle(page,3,{lift:false});s=await st(page);
  ok('…more winding can\'t move the needle past the middle of the star, but it still clicks',Math.abs(s.w.turns-s.w.need)<1e-9&&s.w.held&&s.w.clicks>12,s.w);
  await page.mouse.up();await advance(page,40);s=await st(page);
  ok('just right: the toy wakes with its trick',s.w.lastTry==='right'&&s.w.react==='wake'&&s.w.banner==='Just right!'&&!s.w.active,s.w);
  ok('…the cheer comes first: the step has not counted yet',s.speech.step===0&&s.w.beat&&s.w.dones===0,s);
  await page.evaluate(()=>__quiet.background());await advance(page,3000);s=await st(page);
  ok('a pause holds the cheer: still no step after three seconds away',s.speech.step===0&&s.w.beat&&s.w.dones===0,s);
  await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();s=await st(page);ok('…and none the moment it comes back',s.speech.step===0&&s.w.beat,s);
  await advance(page,1300);s=await st(page);
  ok('then the step counts, once',s.speech.step===1&&s.w.dones===1&&!s.w.beat,s);
  await advance(page,600);s=await st(page);ok('…and the bunny marched into the parade line',JSON.stringify(s.w.line)==='["bunny"]',s.w.line);
  // the frog, wound the other way round
  ok('the next word pops the frog\'s key',await sayWord(page));s=await st(page);ok('…and the help starts again for it',s.w.toy==='frog'&&s.w.ladder.misses===0&&s.w.ladder.effort===0&&s.w.turns===0,s.w);
  await windToStar(page,{dir:-1});s=await st(page);ok('circling the other way winds just as well',s.w.lastTry==='right'&&s.w.react==='wake',s.w);
  ok('the frog counts',await stepped(page,1));
  // the top: winding past the top of the meter only clicks
  await sayWord(page);await circle(page,6,{lift:false});s=await st(page);
  ok('winding past the top of the meter just clicks: nothing breaks, nothing is lost',Math.abs(s.w.turns-s.w.top)<1e-9&&s.w.needle===1&&s.w.clicks>=23&&s.w.held,s.w);
  await page.mouse.up();await advance(page,1500);await windToStar(page);ok('the top wakes after one dizzy spin',(await W(page)).react==='wake'&&await stepped(page,2));
  await sayWord(page);await windToStar(page);ok('the crocodile counts',await stepped(page,3));
  await advance(page,700);await page.screenshot({path:path.join(OUT,'sona-windup-line.png')});
  // the twist: the cuckoo pops and the scene goes up to the top shelf
  ok('the fifth word',await sayWord(page));s=await st(page);
  ok('the twist: the cuckoo clock pops open and the toys are on the top shelf (a cut under Reduce Motion)',s.w.cuckoo&&s.w.scene==='shelf'&&s.w.pan===1&&s.w.toy==='elephant'&&s.w.need===3.5&&Math.abs(s.w.star.half-0.25)<1e-9,s.w);
  ok('Echo says the big toys need more turns',await heard(page,'Cuckoo! Now the big toys on the top shelf. Their keys need more turns.'),(await audit(page)).lines);
  await page.screenshot({path:path.join(OUT,'sona-windup-shelf.png')});
  await circle(page,2.5);s=await st(page);ok('2.5 turns is too little for a top-shelf toy',s.w.lastTry==='little',s.w);
  await advance(page,1500);await windToStar(page);ok('the elephant counts',await stepped(page,4));
  await sayWord(page);s=await st(page);ok('the jack-in-the-box',s.w.toy==='jack');await windToStar(page);ok('…counts',await stepped(page,5));
  await sayWord(page);s=await st(page);ok('the hippo',s.w.toy==='hippo');await windToStar(page);ok('…counts',await stepped(page,6));
  // the music box: about four circles of the crank, no star
  ok('the last word',await sayWord(page));s=await st(page);
  ok('the last step is the giant music box, back on the bench, with no star',s.w.mode==='crank'&&s.w.toy==='musicbox'&&s.w.scene==='bench'&&s.w.star===null&&s.w.need===4,s.w);
  ok('Echo says to turn the crank',await heard(page,'Turn the big crank on the music box to start the parade!'),(await audit(page)).lines);
  {const t0=s.w.tries;await circle(page,2);s=await st(page);ok('letting go of the crank half way is nothing at all',s.w.tries===t0&&s.w.react===null&&s.w.active&&Math.abs(s.w.turns-2)<0.01&&s.speech.step===7,s.w);}
  await circle(page,2.2,{lift:false});s=await st(page);
  ok('four turns of the crank play the tune and swing the doors open',!s.w.active&&s.w.doors>0&&s.w.beat&&(await page.evaluate(()=>__quiet.sounds.length))>0,s.w);
  await page.mouse.up();
  ok('the round ends on the end card',await until(page,()=>__sayplay.phase==='end',6000));s=await st(page);
  ok('eight words, eight steps, each counted once, and seven toys in the parade',s.speech.step===8&&s.w.dones===8&&s.w.line.length===7&&s.w.won,s.w);
  const end=await page.evaluate(()=>({title:document.getElementById('endTitle').textContent,sub:document.getElementById('endSub').textContent,go:document.getElementById('goHome').textContent,cls:document.getElementById('goHome').className,again:document.getElementById('again').hidden,againShown:document.getElementById('again').offsetParent!==null}));
  ok('the end card: "The parade is on!" / "You woke up every toy."',end.title==='The parade is on!'&&end.sub==='You woke up every toy.',end);
  ok('…one teal button, "See what happens!", and no Play again',end.go==='See what happens!'&&end.cls==='btn'&&end.again&&!end.againShown,end);
  const a=await audit(page);
  ok('nothing the game plays ever goes into an open microphone',a.leaks===0&&a.live===0&&a.overlap===0,a);
  ok('every step line Echo said is one of the eight',['Wind up the frog. Let go when the needle reaches the star!','Turn the big crank on the music box to start the parade!'].every(l=>a.lines.includes(l)),a.lines);
  s=await st(page);ok('every banner the round showed is kind',s.w.banners.length>8&&s.w.banners.every(b=>!UNKIND.test(b)),s.w.banners);
  const allKind=await page.evaluate(()=>Object.keys(Windup.SAY).map(k=>Windup.SAY[k]));ok('…and so is every banner the game can show',allKind.every(b=>!UNKIND.test(b)),allKind);
  await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-windup-finished.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='');
  const nav=page.waitForRequest(r=>r.isNavigationRequest(),{timeout:4000}).catch(()=>null);await page.locator('#goHome').click();const req=await nav;
  ok('"See what happens!" opens the story\'s ending',!!req&&new URL(req.url()).pathname==='/adventure.html'&&new URL(req.url()).search==='?part=end&story=windup',req&&req.url());
  ok('no runtime errors',errors.length===0,errors);await context.close();
 }

 // ── replay (FOUND1): a found game played again from Home's row (?again=1),
 // for a child whose stories are all finished. Its end card has Play again
 // and Back home, and Play again is sayplay's again() calling Windup.reset(),
 // which no story round ever reaches (they all pass again:false): a toy left
 // awake, the cuckoo left open or the parade left standing would start the
 // second round broken, so it is played through to its own end card.
 // Only when named: see the top of the file ──
 if(part==='replay'){
  // a: the day the story calendar started (CAL1), so sona.js writes nothing on load either
  const FOUND=JSON.stringify({a:'2026-01-01',s:14,ls:13,lk:'story',done:'2026-01-01'});
  const {page,context,errors}=await fresh({raw:true,device:{seed:{'sona.quest.v1':FOUND}}});
  await page.goto('http://127.0.0.1:'+PORT+'/arcade-windup.html?again=1');{const now=await page.evaluate(()=>Date.now());await page.clock.pauseAt(now+1000);}
  ok('replay: a child whose stories are all finished may play Wind-Up Toys again from Home',await page.evaluate(()=>location.search==='?again=1'&&!document.body.hidden&&Sona.storyReplay('windup')));
  const quest=()=>page.evaluate(()=>localStorage.getItem('sona.quest.v1'));
  const endCard=()=>page.evaluate(()=>{const a=document.getElementById('again'),g=document.getElementById('goHome');return{again:a.textContent,againShown:!a.hidden&&a.offsetParent!==null,go:g.textContent,goShown:g.offsetParent!==null};});
  await begin(page);
  // 23 Oct 2026: a replay is the story's own page, so it asks three sayings a word too
  ok('replay: it asks each word Sona.STORY_SAY_TIMES (3) times, as the story round does',await page.evaluate(()=>Sona.STORY_SAY_TIMES===3&&__sayplay.times===Sona.STORY_SAY_TIMES));
  ok('replay: a whole round of eight toys ends on the end card',await finishRound(page,0));let s=await st(page);
  ok('replay: …with seven toys in the parade, the cuckoo open and the music box\'s doors open (what Play again must clear)',s.speech.step===8&&s.w.dones===8&&s.w.won&&s.w.line.length===7&&s.w.cuckoo&&s.w.doors>0,s.w);
  let end=await endCard();
  ok('replay: the end card has Play again and Back home, and no hand-back to the story',end.again==='Play again'&&end.againShown&&end.go==='Back home'&&end.goShown,end);
  ok('replay: the round finished nothing: the story record is as it was',await quest()===FOUND,await quest());
  await page.locator('#again').click();await advance(page,100);s=await st(page);
  ok('replay: Play again starts a clean round: no toy awake, the parade gone, the cuckoo and the doors shut, word 1 of 8',s.speech.phase==='turn'&&s.speech.step===0&&!s.w.won&&s.w.dones===0&&s.w.line.length===0&&!s.w.cuckoo&&s.w.doors===0&&s.w.stage===0&&s.w.toy==='bunny'&&s.w.scene==='bench'&&s.w.pan===1&&!s.w.keyOut&&!s.w.active&&s.w.turns===0&&s.w.react===null&&s.w.power===0&&!s.w.beat&&s.w.banner==='Say the word to find the key!',s);
  ok('replay: …and the end card is gone',await page.evaluate(()=>!document.getElementById('endOvl').classList.contains('show')));
  ok('replay: the first word of the new round pops a key',await sayWord(page));s=await st(page);
  ok('replay: …the bunny\'s, on the bench, with its own star and no help climbed, as in a first round',s.w.toy==='bunny'&&s.w.keyOut&&s.w.active&&s.w.scene==='bench'&&s.w.mode==='wind'&&Math.abs(s.w.star.half-0.3)<1e-9&&s.w.ladder.misses===0&&s.w.turns===0&&s.w.line.length===0,s.w);
  await windToStar(page);ok('replay: …and it wakes and counts as step 1',await stepped(page,0)&&(await st(page)).speech.step===1);
  ok('replay: the second round plays through to its own end card',await finishRound(page,1));s=await st(page);
  ok('replay: …eight new steps, each counted once, and seven toys in the parade again',s.speech.step===8&&s.w.dones===8&&s.w.line.length===7&&s.w.won,s.w);
  ok('replay: the second round finished nothing either',await quest()===FOUND,await quest());
  end=await endCard();ok('replay: …and its end card has Play again and Back home again',end.againShown&&end.go==='Back home'&&end.goShown,end);
  const nav=page.waitForRequest(r=>r.isNavigationRequest(),{timeout:4000}).catch(()=>null);await page.locator('#goHome').click();const req=await nav;
  ok('replay: Back home goes Home (/today.html)',!!req&&new URL(req.url()).pathname==='/today.html',req&&req.url());
  ok('no runtime errors (replay)',errors.length===0,errors);await context.close();
 }

 // ── struggle (ages 5-8): both ladders climb, and every step finishes with no more speaking ──
 if(!part||part==='struggle'){
  const {page,context,errors}=await fresh();await begin(page);let s,said=0;
  const word=async()=>{said++;return sayWord(page);};
  // toy 1: trouble drawing circles. A finger moving off the dial, getting nowhere
  await word();await wiggle(page,3500,{lift:false});s=await st(page);ok('3 s of a finger getting nowhere: no help yet',s.w.ladder.circle===0&&s.w.turns===0&&s.w.ladder.effort>2.8&&s.w.ladder.effort<4,s.w.ladder);
  await wiggle(page,1000,{held:true});s=await st(page);ok('4 s: the arrows brighten and a dot traces the circle',s.w.ladder.circle===1&&s.w.banner==='Follow the dot around',s.w);
  await rub(page,8);s=await st(page);ok('…rubbing the dial still winds next to nothing',s.w.turns<0.3,s.w);
  await wiggle(page,4100);s=await st(page);ok('8 s: rubbing back and forth on the dial winds too',s.w.ladder.circle===2&&s.w.banner==='Rub the dial to wind it',s.w);
  {const before=s.w.turns;await rub(page,6,{lift:false});s=await st(page);ok('…and it does',s.w.turns>before+0.5&&s.w.tries===0,{before,now:s.w.turns});}
  {const w=await W(page),b=await cbox(page),cx=b.x+w.dial.x,cy=b.y+w.dial.y;for(let n=0;n<30;n++){const v=await W(page);if(v.turns>=v.need-0.15)break;await page.mouse.move(cx+(n%2?-1:1)*w.dial.r*0.35,cy,{steps:6});}}
  await page.mouse.up();await advance(page,40);s=await st(page);ok('rubbed into the star, the bunny wakes',s.w.lastTry==='right'&&s.w.react==='wake',s.w);ok('…and counts',await stepped(page,0));
  // toy 2: three misses, then any let-go past 30% wakes it
  await word();await circle(page,1);await advance(page,1500);s=await st(page);ok('a first too-little let-go',s.w.ladder.misses===1);
  await circle(page,0.3);await advance(page,1500);s=await st(page);ok('a second',s.w.ladder.misses===2&&s.w.catchOn);
  await circle(page,0.3);await advance(page,1500);s=await st(page);ok('a third: "Let go when you like!"',s.w.ladder.misses===3&&s.w.ladder.miss===3&&s.w.banner==='Let go when you like!',s.w);
  await circle(page,0.1);s=await st(page);ok('…from the third, a let-go anywhere past 30% wakes the toy, the needle springing to the star',s.w.lastTry==='right'&&s.w.react==='wake'&&Math.abs(s.w.turns-s.w.need)<1e-9,s.w);
  ok('…and counts',await stepped(page,1));
  // toy 3: twelve seconds of trouble, then any drag anywhere winds
  await word();await wiggle(page,8500,{fx:0.85,fy:0.3});s=await st(page);ok('8 s off the dial: rubbing on the dial helps now',s.w.ladder.circle===2,s.w.ladder);
  await wiggle(page,4100,{fx:0.85,fy:0.3});s=await st(page);ok('12 s: "Drag anywhere to wind!"',s.w.ladder.circle===3&&s.w.banner==='Drag anywhere to wind!',s.w);
  {const b=await cbox(page),y=b.y+b.height*0.3;await page.mouse.move(b.x+b.width*0.2,y);await page.mouse.down();for(let n=0;n<40;n++){const w=await W(page);if(w.turns>=w.need-0.05)break;await page.mouse.move(b.x+b.width*(n%2?0.2:0.8),y,{steps:6});}await page.mouse.up();await advance(page,40);}
  s=await st(page);ok('…and a drag across the shop, far from the dial, winds the top into the star',s.w.lastTry==='right'&&s.w.react==='wake',s.w);ok('…and counts',await stepped(page,2));
  // toy 4 and the rest: no help word, ever
  await word();await windToStar(page);ok('the crocodile',await stepped(page,3));
  // (with motion on for this one word: the view slides up to the top shelf;
  // the main part checks it is a cut under Reduce Motion)
  await page.emulateMedia({reducedMotion:'no-preference'});await word();s=await st(page);ok('with motion: the view slides up to the top shelf',s.w.scene==='shelf'&&s.w.pan<1,s.w);
  await advance(page,700);s=await st(page);ok('…and is there 0.6 s later',s.w.pan===1,s.w);await page.emulateMedia({reducedMotion:'reduce'});
  await circle(page,5);await advance(page,1500);await circle(page,0.05);await advance(page,1500);s=await st(page);ok('a top-shelf toy: one spin, then a let-go just under the star is a yawn',s.w.ladder.misses===2&&s.w.catchOn,s.w);
  await circle(page,4);s=await st(page);ok('…the catch holds it in the star, and it wakes',s.w.react==='wake',s.w);ok('…and counts',await stepped(page,4));
  await word();await windToStar(page);await stepped(page,5);await word();await windToStar(page);await stepped(page,6);
  // the music box, with the crank's own help: from 12 s every drag cranks double
  await word();await wiggle(page,12600,{fx:0.85,fy:0.3});s=await st(page);ok('the music box keeps the same seconds ladder, and at 12 s every drag cranks double',s.w.mode==='crank'&&s.w.ladder.circle===3&&s.w.gain===2,s.w);
  {const before=s.w.turns;await circle(page,1,{lift:false});s=await st(page);ok('…one circle of the crank is two',Math.abs(s.w.turns-before-2)<0.05,{before,now:s.w.turns});}
  await circle(page,1.2);
  ok('the round ends',await until(page,()=>__sayplay.phase==='end',6000));s=await st(page);
  ok('every step finished with one word each and no help word',s.speech.step===8&&said===8&&s.w.power===0,{step:s.speech.step,said});
  ok('every banner was kind',s.w.banners.every(b=>!UNKIND.test(b)),s.w.banners);
  ok('no runtime errors (struggle)',errors.length===0,errors);await context.close();
 }

 // ── ages 3-4: one big toy, no star, wakes when the meter is full ──
 if(!part||part==='little'){
  const {page,context,errors}=await fresh({device:{age:'4'}});
  const start=await page.evaluate(()=>document.querySelector('#startOvl .ovlCard').innerText);
  ok('the little ones\' start card: draw circles on the key until it rings',/three times to find a toy's key/i.test(start)&&/until it rings/.test(start)&&!/star/.test(start),start);
  await begin(page);ok('Echo says it the little ones\' way',(await audit(page)).lines.some(l=>l==="Say each word three times to find a toy's key. Then draw circles on the key until it rings."),(await audit(page)).lines);
  ok('three sayings (the little ones too: every story game asks Sona.STORY_SAY_TIMES)',await page.evaluate(()=>__sayplay.times===Sona.STORY_SAY_TIMES)&&await sayWord(page));let s=await st(page);
  ok('six words, a big bunny, no star, and the meter only fills',s.w.little&&s.w.steps===6&&s.w.toy==='bunny'&&s.w.mode==='fill'&&s.w.star===null&&s.w.need===2,s.w);
  ok('Echo says the little ones\' first line',await heard(page,'Draw circles on the key until it rings!'),(await audit(page)).lines);
  await circle(page,1);s=await st(page);ok('one circle fills half the meter, and a let-go is never a try',Math.abs(s.w.needle-0.5)<0.02&&s.w.tries===0&&s.w.react===null&&s.w.active,s.w);
  await circle(page,1.6,{lift:false});s=await st(page);
  ok('the meter full: it rings and the toy wakes at once, with the finger still down',s.w.react==='wake'&&s.w.needle===1&&s.w.turns===s.w.need&&s.w.banner==='Ding! Wake up!',s.w);
  ok('…and can\'t be over-wound: more circling does nothing, and nothing ever spins dizzy',(await W(page)).turns===2&&!(await W(page)).held,s.w);
  await page.mouse.up();ok('…counts',await stepped(page,0));
  await sayWord(page);{const b=(await W(page)).turns;await rub(page,6);s=await st(page);ok('rubbing back and forth on the dial winds from the start',s.w.turns>b+0.4&&s.w.toy==='frog',s.w);}
  await circle(page,2);ok('the frog',await stepped(page,1));
  // the elephant: the little ones' ladder, 2, 4 and 6 s
  await sayWord(page);await wiggle(page,2500,{fx:0.85,fy:0.3});s=await st(page);ok('2 s: the arrows and a dot show the way',s.w.ladder.circle===1&&s.w.banner==='Follow the dot around',s.w);
  await wiggle(page,2000,{fx:0.85,fy:0.3});s=await st(page);ok('4 s: winding on the dial goes twice as fast',s.w.ladder.circle===2&&s.w.gain===2,s.w);
  {const b=s.w.turns;await circle(page,0.25,{lift:false});await page.mouse.up();s=await st(page);ok('…a quarter circle is half a turn',Math.abs(s.w.turns-b-0.5)<0.03,{b,now:s.w.turns});}
  await wiggle(page,2100,{fx:0.85,fy:0.3});s=await st(page);ok('6 s: "One big drag!"',s.w.ladder.circle===3&&s.w.banner==='One big drag!',s.w);
  ok('…and nothing winds itself while waiting',s.w.react===null&&s.w.active,s.w);
  {const b=await cbox(page);await page.mouse.move(b.x+b.width*0.2,b.y+b.height*0.3);await page.mouse.down();await page.mouse.move(b.x+b.width*0.6,b.y+b.height*0.3,{steps:6});await page.mouse.up();await advance(page,40);}
  s=await st(page);ok('…then one drag anywhere fills the meter, and the elephant wakes',s.w.react==='wake'&&s.w.turns===s.w.need,s.w);
  ok('…counts',await stepped(page,2));
  for(let k=3;k<5;k++){await sayWord(page);await circle(page,2.1);ok('toy '+(k+1)+' ('+['','','','hippo','top'][k]+')',await stepped(page,k));}
  ok('the last word',await sayWord(page));s=await st(page);ok('the little ones\' music box: two turns of the crank',s.w.mode==='crank'&&s.w.need===2&&s.w.scene==='bench',s.w);
  await circle(page,2.1);
  ok('the round ends on the same end card',await until(page,()=>__sayplay.phase==='end',6000));s=await st(page);
  ok('six words, six steps, five toys in the parade, never a dizzy spin',s.speech.step===6&&s.w.dones===6&&s.w.line.length===5&&s.w.tries===0,s.w);
  const end=await page.evaluate(()=>({go:document.getElementById('goHome').textContent,again:document.getElementById('again').hidden}));ok('…with "See what happens!" and no Play again',end.go==='See what happens!'&&end.again,end);
  const a=await audit(page);ok('nothing played into an open microphone (ages 3-4)',a.leaks===0&&a.overlap===0,a);
  ok('every banner was kind (ages 3-4)',s.w.banners.every(b=>!UNKIND.test(b)),s.w.banners);
  ok('no runtime errors (ages 3-4)',errors.length===0,errors);await context.close();
 }

 // ── help: the oil can ──
 if(!part||part==='help'){
  const {page,context,errors}=await fresh();await begin(page);await sayWord(page);
  await circle(page,0.5);let s=await st(page);const kept=s.w.turns;
  await page.locator('#windupHelp').click();await until(page,()=>__sayplay.listening);s=await st(page);
  ok('the oil can asks for the word again, on the same toy, wound as it was',s.w.paused&&s.w.turns===kept&&s.w.toy==='bunny'&&s.speech.step===0&&await page.locator('#helpBack').isVisible(),s);
  await advance(page,13000);await until(page,()=>__sayplay.phase==='play');s=await st(page);
  ok('silence gives the same toy straight back, with no power',s.speech.phase==='play'&&!s.w.paused&&s.w.active&&s.w.power===0&&s.w.turns===kept&&s.w.toy==='bunny'&&s.w.tries===0,s);
  await page.locator('#windupHelp').click();await until(page,()=>__sayplay.listening);await page.locator('#helpBack').click();await advance(page,100);s=await st(page);
  ok('"Back to the game" does the same',s.speech.phase==='play'&&!s.w.paused&&s.w.power===0&&s.w.turns===kept,s);
  await page.locator('#windupHelp').click();ok('a heard help word',await sayWord(page));s=await st(page);
  ok('…oils the key on the same toy: ten seconds of double winding and a wide star',s.w.power>9&&s.w.react==='oil'&&s.w.toy==='bunny'&&s.speech.step===0&&s.w.gain===2&&Math.abs(s.w.star.half-0.54)<1e-9&&s.w.turns===kept,s.w);
  ok('…and the pill is greyed out while it lasts',await page.locator('#windupHelp').isDisabled());
  {const b=s.w.turns;await circle(page,1,{lift:false});const mid=(await W(page)).turns;await page.mouse.up();await advance(page,40);s=await st(page);ok('…one circle winds two turns, and lets go in the wide star',s.w.lastTry==='right'&&s.w.react==='wake'&&Math.abs(mid-b-2)<0.05,{b,mid,w:s.w});}
  ok('…and the step counts',await stepped(page,0));
  await sayWord(page);s=await st(page);ok('the next toy starts with no power',s.w.power===0&&s.w.gain===1,s.w);
  await page.locator('#windupHelp').click();await sayWord(page);await advance(page,10500);s=await st(page);ok('the oil wears off after ten seconds and the pill comes back',s.w.power===0&&!(await page.locator('#windupHelp').isDisabled()),s.w);
  const a=await audit(page);ok('the help ask never plays into the mic',a.leaks===0&&a.overlap===0,a);
  ok('no runtime errors (help)',errors.length===0,errors);await context.close();
 }

 // ── the buddy: a fox child and a dragon child, and a picture that fails ──
 if(!part||part==='buddy'){
  const file=s=>s?String(s).split('/').pop():s;
  {const {page,context,errors}=await fresh();await advance(page,300);
   const b=await page.evaluate(()=>{const e=document.getElementById('windupBuddy');return{src:e.getAttribute('src'),badge:e.classList.contains('badge'),pe:getComputedStyle(e).pointerEvents};});
   ok('a fox child: the fox on the shelf (its standing picture: the fox has no sit pose)',file(b.src)==='buddy-fox-rest.webp'&&!b.badge&&b.pe==='none',b);
   await begin(page);await sayWord(page);await windToStar(page);await advance(page,60);
   ok('…and it cheers when a toy wakes',file(await page.locator('#windupBuddy').getAttribute('src'))==='buddy-fox-cheer.webp');
   await advance(page,1000);ok('…then sits back down',file(await page.locator('#windupBuddy').getAttribute('src'))==='buddy-fox-rest.webp');
   ok('no runtime errors (fox)',errors.length===0,errors);await context.close();}
  {const {page,context,errors}=await fresh({device:{seed:{'sona.profile.v1':PROFILE({character:'dragon'})}}});await advance(page,300);
   await until(page,()=>{const e=document.getElementById('windupBuddy');return e.complete&&e.naturalWidth>0;},3000);
   const b=await page.evaluate(()=>({src:document.getElementById('windupBuddy').getAttribute('src'),w:__windup}));
   ok('a dragon child: the dragon sits on the shelf in its sit pose',file(b.src)==='buddy-dragon-sit.webp',b.src);
   await begin(page);await sayWord(page);
   const geo=await page.evaluate(()=>{const r=e=>{const x=document.getElementById(e).getBoundingClientRect();return{x:x.left,y:x.top,w:x.width,h:x.height};},c=document.getElementById('windupCanvas').getBoundingClientRect(),w=__windup;return{buddy:r('windupBuddy'),help:r('windupHelp'),hear:r('windupHearStep'),banner:r('windupBanner'),dial:{x:c.left+w.dial.x-w.dial.r*1.2,y:c.top+w.dial.y-w.dial.r*1.2,w:w.dial.r*2.4,h:w.dial.r*2.4},toy:{x:c.left+w.toyBox.x,y:c.top+w.toyBox.y,w:w.toyBox.w,h:w.toyBox.h},meterTop:c.top+w.meter.top};});
   const hit=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
   ok('the buddy is never over the dial, the toy, the meter, the banner or a button',!hit(geo.buddy,geo.dial)&&!hit(geo.buddy,geo.toy)&&!hit(geo.buddy,geo.help)&&!hit(geo.buddy,geo.hear)&&!hit(geo.buddy,geo.banner)&&geo.buddy.y+geo.buddy.h<=geo.meterTop,geo);
   await windToStar(page);await advance(page,60);ok('…cheers with its own cheering picture',file(await page.locator('#windupBuddy').getAttribute('src'))==='buddy-dragon-cheer.webp');
   ok('no runtime errors (dragon)',errors.length===0,errors);await context.close();}
  {const {page,context,errors}=await fresh({raw:true,device:{seed:{'sona.profile.v1':PROFILE({character:'dragon'})}}});
   await context.route('**/buddy-dragon-sit.webp',r=>r.abort());await page.reload();const now=await page.evaluate(()=>Date.now());await page.clock.pauseAt(now+1000);await advance(page,500);
   const b=await page.evaluate(()=>{const e=document.getElementById('windupBuddy');return{src:e.getAttribute('src'),badge:e.classList.contains('badge'),hidden:e.hidden};});
   ok('a sit picture that fails falls back to the round badge',b.src&&!/sit/.test(b.src)&&b.badge&&!b.hidden,b);
   await begin(page);await sayWord(page);await windToStar(page);await advance(page,60);
   ok('…and the badge never swaps to a standing cheer',!/cheer/.test(await page.locator('#windupBuddy').getAttribute('src')||''));
   ok('no runtime errors (fallback)',errors.length===0,errors);await context.close();}
 }

 // ── fit: four phones and an iPad, both ages ──
 if(!part||part==='fit'){
  for(const [vw,vh,age] of [[320,568,'7'],[375,667,'7'],[390,844,'7'],[768,1024,'7'],[320,568,'4']]){
   const {page,context,errors}=await fresh({viewport:{width:vw,height:vh},device:{age}});await begin(page);
   const tag=vw+'x'+vh+(age==='4'?' (ages 3-4)':'');
   const turnBox=await page.locator('#turnPanel').boundingBox();
   // the word's picture beside it, while Echo listens: the crafted-words spans are sized by this
   // page's own sheet (no crafted-* sheet is loaded), or they sit at 0x0 and the square is empty
   const pic=await page.evaluate(()=>{const c=document.querySelector('#pic .crafted-word-crop'),b=document.getElementById('picBox').getBoundingClientRect();if(!c)return null;const r=c.getBoundingClientRect();return{w:r.width,h:r.height,in:r.left>=b.left-0.5&&r.right<=b.right+0.5&&r.top>=b.top-0.5&&r.bottom<=b.bottom+0.5,bg:getComputedStyle(c).backgroundImage,word:document.getElementById('word').textContent};});
   ok(tag+': the word\'s picture shows beside it while Echo listens (over 40 px, inside its square)',!!pic&&Math.max(pic.w,pic.h)>40&&Math.min(pic.w,pic.h)>0&&pic.in&&/feed-words-/.test(pic.bg),pic);
   await sayWord(page);await advance(page,400);
   const g=await page.evaluate(()=>{const r=id=>{const x=document.getElementById(id).getBoundingClientRect();return{x:x.left,y:x.top,w:x.width,h:x.height,b:x.bottom,r:x.right};},c=document.getElementById('windupCanvas').getBoundingClientRect(),w=__windup;
    return{iw:innerWidth,ih:innerHeight,sw:document.scrollingElement.scrollWidth,help:r('windupHelp'),hear:r('windupHearStep'),banner:r('windupBanner'),close:r('close'),ctl:r('windupControls'),buddy:r('windupBuddy'),
     dial:{l:c.left+w.dial.x-w.dial.r,r:c.left+w.dial.x+w.dial.r,t:c.top+w.dial.y-w.dial.r,b:c.top+w.dial.y+w.dial.r,d:w.dial.r*2},cw:c.width,meter:{t:c.top+w.meter.top,b:c.top+w.meter.bottom,l:c.left+w.meter.cx-w.meter.w/2,r:c.left+w.meter.cx+w.meter.w/2},
     toy:{l:c.left+w.toyBox.x,r:c.left+w.toyBox.x+w.toyBox.w,t:c.top+w.toyBox.y,b:c.top+w.toyBox.y+w.toyBox.h},board:{t:c.top+w.board.y},
     pivot:c.top+w.meter.cy,shop:{back:c.top+w.shop.back,edge:c.top+w.shop.edge,cuckoo:{x:c.left+w.shop.cuckoo.x,y:c.top+w.shop.cuckoo.y,w:w.shop.cuckoo.w,h:w.shop.cuckoo.h},grandpa:{x:c.left+w.shop.grandpa.x,y:c.top+w.shop.grandpa.y,w:w.shop.grandpa.w},line:w.shop.line.map(s=>({x:c.left+s.x,base:c.top+s.base,h:s.h})),left:c.left,right:c.right}};});
   ok(tag+': no sideways scroll',g.sw<=g.iw,g);
   ok(tag+': the dial is whole on screen, above the buttons, and big',g.dial.l>=0&&g.dial.r<=g.iw&&g.dial.t>=0&&g.dial.b<=g.ctl.y&&g.dial.d>=g.cw*0.45,g.dial);
   ok(tag+': the meter is whole, between the toy and the dial',g.meter.l>=0&&g.meter.r<=g.iw&&g.meter.t>=g.toy.b-2&&g.meter.b<=g.dial.t+12,{m:g.meter,toy:g.toy,dial:g.dial});
   ok(tag+': the toy stands under the banner, on screen',g.toy.t>=g.banner.b&&g.toy.l>=0&&g.toy.r<=g.iw&&g.toy.b-g.toy.t>=50,{toy:g.toy,banner:g.banner});
   ok(tag+': both buttons whole, on screen, at least 44 px',[g.help,g.hear].every(b=>b.w>=44&&b.h>=44&&b.x>=0&&b.r<=g.iw&&b.b<=g.ih),{help:g.help,hear:g.hear});
   ok(tag+': the buddy is on screen, under the bar and clear of the toy',g.buddy.y>=g.close.b&&g.buddy.x>=0&&g.buddy.r<=g.iw&&(g.buddy.r<=g.toy.l||g.buddy.b<=g.toy.t),{buddy:g.buddy,toy:g.toy});
   // fitted to the painted shop (design/adventure/art-notes.md): the needle pivots at the half circle's
   // centre, clear of the dial; the clock and Grandpa hang under the banner; the line stands on the bench's back
   ok(tag+': the meter\'s needle pivots above the dial, never on it',g.pivot<g.dial.t,{pivot:g.pivot,dial:g.dial});
   {const k=g.shop.cuckoo,gp=g.shop.grandpa;ok(tag+': the cuckoo clock and Grandpa Bear are under the banner, on screen',k.y>=g.banner.b&&k.x>=g.shop.left&&k.x+k.w<=g.shop.right&&k.y+k.h<=g.meter.t&&gp.y>=g.banner.b&&gp.x>=g.shop.left,{cuckoo:k,grandpa:gp,banner:g.banner});}
   ok(tag+': all seven places in the parade line stand on the back of the bench, on screen',g.shop.line.every(s=>s.base>=g.shop.back&&s.base<g.shop.edge&&s.x-s.h*0.7>=g.shop.left&&s.x+s.h*0.7<=g.shop.right),{line:g.shop.line,back:g.shop.back,edge:g.shop.edge});
   ok(tag+': the word card fits on screen',turnBox&&turnBox.y+turnBox.height<=vh&&turnBox.x>=0&&turnBox.x+turnBox.width<=vw,turnBox);
   await page.screenshot({path:path.join(OUT,'sona-windup-'+vw+'x'+vh+(age==='4'?'-little':'')+'.png')});
   ok(tag+': no runtime errors',errors.length===0,errors);await context.close();
  }
 }

 // ── stand-ins: the game plays with every painted picture blocked ──
 if(!part||part==='standins'){
  const {page,context,errors}=await fresh({blockAssets:true});await begin(page);await advance(page,300);
  let s=await st(page);ok('every painted picture failed, and the game knows it',s.w.artReady&&s.w.art.loaded.length===0&&s.w.art.failed.length===19,s.w.art);
  await sayWord(page);await advance(page,400);await page.screenshot({path:path.join(OUT,'sona-windup-standins.png')});
  const painted=await page.evaluate(()=>{const c=document.getElementById('windupCanvas'),x=c.getContext('2d'),w=__windup,d=x.getImageData(Math.round(w.dial.x*c.width/c.clientWidth),Math.round(w.dial.y*c.height/c.clientHeight-w.dial.r*0.5*c.height/c.clientHeight),1,1).data,t=x.getImageData(Math.round((w.toyBox.x+w.toyBox.w/2)*c.width/c.clientWidth),Math.round((w.toyBox.y+w.toyBox.h*0.6)*c.height/c.clientHeight),1,1).data;return{dial:[...d],toy:[...t]};});
  ok('the drawn dial and the drawn toy are on the canvas',painted.dial[3]===255&&painted.toy[3]===255&&painted.dial.join()!==painted.toy.join(),painted);
  await windToStar(page);ok('…and a toy still winds, wakes and counts',await stepped(page,0));
  await sayWord(page);await windToStar(page);ok('…and the next',await stepped(page,1));
  ok('no runtime errors (stand-ins)',errors.length===0,errors);await context.close();
 }

 // ── keyboard: the arrow keys wind, Space lets go ──
 if(!part||part==='keyboard'){
  const {page,context,errors}=await fresh();await begin(page);await sayWord(page);
  await page.locator('#windupDial').focus();ok('the dial takes the keyboard',await page.evaluate(()=>document.activeElement.id==='windupDial'&&document.getElementById('windupDial').getAttribute('aria-disabled')==='false'));
  for(let n=0;n<8;n++)await page.keyboard.press('ArrowRight');let s=await st(page);ok('eight presses of an arrow key wind one turn',Math.abs(s.w.turns-1)<1e-9&&s.w.keyHeld,s.w);
  await page.keyboard.press(' ');await advance(page,1500);s=await st(page);ok('Space lets go (here, too little)',s.w.lastTry==='little'&&s.w.ladder.misses===1,s.w);
  for(let n=0;n<11;n++)await page.keyboard.press('ArrowLeft');await page.keyboard.press('Enter');s=await st(page);
  ok('the other arrow winds too, and Enter lets go in the star',s.w.lastTry==='right'&&s.w.react==='wake',s.w);
  ok('…and the step counts',await stepped(page,0));
  await sayWord(page);ok('the dial keeps the keyboard for the next toy',await page.evaluate(()=>document.activeElement.id==='windupDial'));
  for(let n=0;n<20;n++)await page.keyboard.press('ArrowDown');await page.keyboard.press(' ');ok('…and winds it',await stepped(page,1));
  // one arrow press, then the focus goes elsewhere (22 Oct 2026: the key hold
  // stayed on, the Oil can stayed greyed and no finger could wind)
  await sayWord(page);await page.keyboard.press('ArrowRight');s=await st(page);const k0=s.w.turns,n0=s.w.tries;
  await page.evaluate(()=>document.getElementById('windupDial').blur());await advance(page,100);s=await st(page);
  ok('the dial losing focus drops the key hold: the Oil can is back, nothing let go, the winding kept',!s.w.keyHeld&&s.w.tries===n0&&Math.abs(s.w.turns-k0)<1e-9&&await page.locator('#windupHelp').isEnabled(),{n0,w:s.w});
  await page.locator('#windupDial').focus();await page.keyboard.press('ArrowRight');
  await circle(page,0.5,{lift:false});s=await st(page);ok('a finger takes the dial over from the arrow keys and winds',!s.w.keyHeld&&s.w.turns>k0+0.2,s.w);
  await page.mouse.up();await advance(page,40);
  ok('no runtime errors (keyboard)',errors.length===0,errors);await context.close();
 }

 // ── touches: a resting thumb never owns the dial (22 Oct 2026: the first
 // touch anywhere did, for as long as it stayed down, and the child's circles
 // did nothing), but a finger that is circling keeps it ──
 if(!part||part==='touches'){
  const {page,context,errors}=await fresh();await begin(page);await sayWord(page);
  const w=await W(page),b=await cbox(page),cx=b.x+w.dial.x,cy=b.y+w.dial.y,r=w.dial.r*0.8;
  const ev=(t,id,x,y)=>page.evaluate(([t,id,x,y])=>document.getElementById('windupCanvas').dispatchEvent(new PointerEvent(t,{pointerId:id,pointerType:'touch',isPrimary:id===31,clientX:x,clientY:y,bubbles:true,cancelable:true})),[t,id,x,y]);
  const at=a=>[cx+Math.cos(a)*r,cy+Math.sin(a)*r];
  // a thumb rests on the screen's edge, then the child circles the dial
  await ev('pointerdown',31,b.x+6,b.y+b.height*0.55);await advance(page,500);
  let a=-Math.PI/2;await ev('pointerdown',32,...at(a));for(let i=1;i<=12;i++){a=-Math.PI/2+i*2*Math.PI/24;await ev('pointermove',32,...at(a));await advance(page,20);}
  let s=await st(page);ok('a resting thumb gives the dial to the finger that circles it: half a turn wound',s.w.turns>0.3&&s.w.tries===0,s.w);
  await ev('pointerup',31,b.x+6,b.y+b.height*0.55);s=await st(page);ok('…and the thumb lifting is no try and stops nothing',s.w.tries===0&&s.w.held,s.w);
  // while that finger circles, a second touch lands: the circling finger keeps it
  await advance(page,20);await ev('pointerdown',33,b.x+b.width*0.5,b.y+b.height*0.2);const t0=(await st(page)).w.turns;
  for(let i=13;i<=18;i++){a=-Math.PI/2+i*2*Math.PI/24;await ev('pointermove',32,...at(a));await advance(page,20);}
  s=await st(page);ok('a touch landing while a finger circles never takes the dial from it',s.w.turns>t0+0.15,{t0,w:s.w});
  await ev('pointerup',33,b.x+b.width*0.5,b.y+b.height*0.2);await ev('pointerup',32,...at(a));await advance(page,1500);s=await st(page);
  ok('the circling finger lifting lets the dial go',!s.w.held&&s.w.tries<=1,s.w);
  ok('no runtime errors (touches)',errors.length===0,errors);await context.close();
 }

 // ── motion: a dizzy toy spins, but not under Reduce Motion (a pose change) ──
 if(!part||part==='motion'){
  for(const reduce of [true,false]){
   const {page,context,errors}=await fresh();if(!reduce)await page.emulateMedia({reducedMotion:'no-preference'});await begin(page,{force:!reduce});await sayWord(page);
   await circle(page,3.3);await advance(page,500);let s=await st(page);
   ok((reduce?'Reduce Motion: the dizzy toy changes pose and does not spin':'with motion: the dizzy toy spins'),s.w.react==='dizzy'&&(reduce?s.w.spin===0&&s.w.tilt!==0:s.w.spin>0.5),s.w);
   ok('no runtime errors (motion '+reduce+')',errors.length===0,errors);await context.close();
  }
 }

 // ── the iPhone app: the shop's own sounds are media, never Web Audio ──
 if(!part||part==='app'){
  const {page,context,errors}=await fresh({raw:true});
  await context.addInitScript(()=>{window.Capacitor={isNativePlatform:()=>true};});await page.reload();const now=await page.evaluate(()=>Date.now());await page.clock.pauseAt(now+1000);
  ok('the page knows it is in the app',await page.evaluate(()=>Sona.voiceAsMedia()));
  await begin(page);await sayWord(page);const n0=await page.evaluate(()=>__quiet.sounds.length);
  await circle(page,1.2);await advance(page,1500);await windToStar(page);await stepped(page,0);
  const kinds=await page.evaluate(n=>__quiet.sounds.slice(n).map(x=>x.kind),n0);
  ok('in the app the clicks, the yawn and the toy\'s jingle play as media, never as Web Audio',kinds.length>5&&kinds.every(k=>k==='media'||k==='speech'),kinds);
  const a=await audit(page);ok('…and never into an open microphone',a.leaks===0&&a.overlap===0,a);
  ok('no runtime errors (app)',errors.length===0,errors);await context.close();
 }

 // ── the source: the game file owns the play and nothing else ──
 if(!part||part==='source'){
  const {readFileSync}=await import('node:fs');const strip=t=>t.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/.*$/gm,'$1');
  const js=strip(readFileSync(new URL('../public/windup.js',import.meta.url),'utf8')),html=readFileSync(new URL('../public/arcade-windup.html',import.meta.url),'utf8'),page=strip(html.replace(/[\s\S]*<script>/,''));
  ok('windup.js never touches storage, reps, coins, stickers or practice data',!/localStorage|sessionStorage|logAttempt|bumpReps|gameRep|addCoins|mintCoins|awardSticker|awardNextSticker|recordRung|getUserMedia|questEnd/.test(js));
  ok('…nor does the page\'s own script',!/localStorage|sessionStorage|logAttempt|bumpReps|gameRep|addCoins|awardSticker|questEnd/.test(page));
  ok('Echo\'s directions come from the STEP_LINES tables through api.instruct',/api\.instruct\(stepLine\(\)\)/.test(js)&&/var STEP_LINES = \[/.test(js)&&/var LITTLE_LINES = \[/.test(js));
  ok('the help pill calls api.practice()',/api\.practice\(\)/.test(js));
  ok('the page sets the age and the steps, hands the story its exit and no Play again',/setLittle\(little\)/.test(html)&&/steps: little \? STEPS6 : STEPS8/.test(html)&&/exit: replay \? undefined : \{ href: "\/adventure\.html\?part=end&story=windup", label: "See what happens!" \}/.test(html)&&/again: replay \? undefined : false/.test(html));
  ok('FOUND1: only ?again=1, and only once this story is finished (Sona.storyReplay), makes it a replay from Home\'s row (Play again and Back home, its own event); any other replay address goes Home',/var replay = location\.search === "\?again=1";/.test(html)&&/if \(replay && !\(window\.Sona && Sona\.storyReplay && Sona\.storyReplay\("windup"\)\)\) \{ document\.body\.hidden = true; location\.replace\("\/today\.html"\); return; \}/.test(html)&&/track\(replay \? "story game replayed" : "game opened", \{ game: "windup" \}\)/.test(html));
  ok('FOUND1: a page brought back from the browser\'s cache reloads, so the replay and access checks run again for whichever child is on the phone now (its Play again could otherwise end another child\'s story day)',/window\.addEventListener\("pageshow", function \(e\) \{ if \(e\.persisted\) location\.reload\(\); \}\);/.test(html));
  ok('a kid page: the zoom lock, sona.js, and exactly one play script after sayplay.js',/maximum-scale=1, user-scalable=no/.test(html)&&/<script src="\/sayplay\.js"><\/script><script src="\/windup\.js"><\/script>\s*<script>/.test(html)&&!/src="https?:/.test(html));
  ok('"game opened" (and a replay\'s "story game replayed") carries the game key only',/S\.track\(replay \? "story game replayed" : "game opened", \{ game: "windup" \}\)/.test(html));
  const vm=await import('node:vm'),box={window:{},document:{}};vm.runInNewContext(readFileSync(new URL('../public/windup.js',import.meta.url),'utf8'),box);
  const L=box.window.Windup.LINES,lines=[...L.big,...L.little,...L.toys,...Object.values(box.window.Windup.SAY)];
  ok('eight step lines for ages 5-8 and six for ages 3-4, each at most 120 characters',L.big.length===8&&L.little.length===6&&lines.every(l=>l.length<=120),L);
  ok('no line on screen or in Echo\'s voice is unkind or says how to talk',lines.every(l=>!UNKIND.test(l)&&!/louder|slowly|strong|stretch/i.test(l)),lines.filter(l=>UNKIND.test(l)||/louder|slowly|strong|stretch/i.test(l)));
 }
}catch(e){failures++;console.log('FAIL the suite stopped: '+(e&&e.stack||e));}
finally{if(h)await h.close();}
console.log('\n'+checks+' checks, '+failures+' failed');
if(failures){console.log('WINDUP FAILED');process.exit(1);}
console.log('WINDUP ALL GREEN');
