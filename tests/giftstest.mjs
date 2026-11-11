// Surprise Boxes (ages 3-4): the word earns each present, the finger opens it,
// and every present opens with no more speech (the misses ladder).
// GIFTS_PART=main|struggle|keyboard|fit runs one part.
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {OUT,ROOT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d).slice(0,1500)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,gifts:window.__gifts}));
async function move(p,q,steps=18){const b=await p.locator('#giftsCanvas').boundingBox();await p.mouse.move(b.x+q.x*b.width,b.y+q.y*b.height,{steps});}
async function hold(p,id='#giftHandle'){const b=await p.locator(id).boundingBox();if(!b)throw Error('Missing real present grip '+id);await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();}
// A drag from the centre of a grip through pixel offsets: what a finger does.
async function drag(p,id,pts){const b=await p.locator(id).boundingBox();if(!b)throw Error('Missing real present grip '+id);const x0=b.x+b.width/2,y0=b.y+b.height/2;await p.mouse.move(x0,y0);await p.mouse.down();for(const[dx,dy]of pts)await p.mouse.move(x0+dx,y0+dy,{steps:4});await p.mouse.up();await advance(p,100);}
// A wobbly line: `len` px along unit direction d, swinging `amp` px to each side.
const wobble=(d,len,amp,n=8)=>Array.from({length:n},(_,i)=>{const t=(i+1)/n,o=i===n-1?0:(i%2?-amp:amp);return[d.x*len*t-d.y*o,d.y*len*t+d.x*o];});
async function tap(p,id){await drag(p,id,[]);}
async function pull(p,{wrong=false,partial=false}={}){let s=(await state(p)).gifts;await hold(p);const a=s.route.anchor,g=s.route.goal,dx=g.x-a.x,dy=(g.y-a.y)*s.height/s.width;await move(p,wrong?{x:a.x-dy,y:a.y+dx*s.width/s.height}:{x:a.x+dx*(partial?.25:1.1),y:a.y+dy*(partial?.25:1.1)*s.width/s.height});await p.mouse.up();await advance(p,100);return(await state(p)).gifts.unlocked;}
async function latch(p,i,{wrong=false}={}){const s=(await state(p)).gifts,l=s.latches[i];await hold(p,'#giftLatch'+i);await move(p,wrong?{x:l.anchor.x+.15,y:l.anchor.y}:l.goal);await p.mouse.up();await advance(p,100);return(await state(p)).gifts.latches[i].opened;}
async function twist(p,{partial=false,detour=false,turn:tn,amp=0}={}){let s=(await state(p)).gifts;const c=s.twist.center,r=s.twist.radius,at=s.handle,a=Math.atan2((at.y-c.y)*s.height/s.width,at.x-c.x),turn=tn||s.twist.requiredAngle*(partial?.2:1.12);await hold(p);if(detour){await move(p,c);await move(p,{x:c.x+Math.cos(a+turn)*r,y:c.y+Math.sin(a+turn)*r*s.width/s.height});}else{for(let n=1;n<=64;n++){s=(await state(p)).gifts;if(s.unlocked)break;const angle=a+turn*n/64,rr=r+(amp&&n<64?(n%8<4?amp:-amp)/s.width:0);await move(p,{x:c.x+Math.cos(angle)*rr,y:c.y+Math.sin(angle)*rr*s.width/s.height},3);}}await p.mouse.up();await advance(p,100);return(await state(p)).gifts.unlocked;}
async function unwrap(p){let s=(await state(p)).gifts;if(s.unlocked)return true;if(s.mechanic==='latches'){for(let i=0;i<2;i++)if(!(await state(p)).gifts.latches[i].opened)await latch(p,i);}else if(s.mechanic==='twist')await twist(p);else await pull(p);return(await state(p)).gifts.unlocked;}
async function lift(p,{partial=false,background=false}={}){const s=(await state(p)).gifts,l=s.lid;await hold(p,'#giftLid');await move(p,{x:l.anchor.x,y:l.anchor.y-l.requiredLift*(partial?.3:1.2)*s.width/s.height});if(background){await p.evaluate(()=>__quiet.background());await advance(p,350);await p.mouse.up();await p.evaluate(()=>__quiet.foreground());await p.locator('#resume').click();await advance(p,100);}else{await p.mouse.up();await advance(p,100);}return(await state(p)).gifts.opened>s.opened;}
async function present(p){const s=(await state(p)).gifts;if(!await unwrap(p))return false;await lift(p);return until(p,n=>__sayplay.step>n,3000,s.stage);}
const part=process.env.GIFTS_PART;
try{
 h=await gameHarness('gifts',8361);const fresh=(o={})=>h.fresh({...o,device:{age:'4',...o.device}});
 if(!part||part==='main'){
  // (d) parked: Home, which says so, before any microphone or sound
  {const{page,context}=await fresh({unpark:false});const home=await until(page,()=>/\/(today|activities)\.html/.test(location.pathname)&&!!document.getElementById('libraryMessage')&&/Surprise Boxes is coming soon/.test(document.getElementById('libraryMessage').textContent),8000);
   const q=await page.evaluate(()=>({req:__quiet.requests,snd:__quiet.soundsBefore}));
   ok('the parked presents go back to Home, which says they are coming soon',home&&!page.url().includes('arcade-gifts'),{url:page.url()});ok('parked presents never open a microphone or play a sound',q.req===0&&q.snd===0,q);await context.close();}
  const{page,context,errors}=await fresh();const real=await page.locator('#giftsCanvas').count();ok('Surprise Boxes has real unwrapping controls',real===1);if(!real)throw Error('Still an automatic lid-reveal scene');
  const words=await page.evaluate(()=>({start:document.querySelector('#startOvl .ovlCard').textContent,primer:document.querySelector('#primer .ovlCard').textContent,help:document.getElementById('giftsHelp').getAttribute('aria-label')}));
  ok('the start card and mic card say the word earns each present',/Say each word two times to get a present/.test(words.start)&&/two times to open each present/.test(words.primer)&&/Optional/.test(words.help)&&!/easier unwrapping/.test(words.start+words.primer),words);
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);await advance(page,1200);let s=await state(page);
  // (a) silence earns nothing, even past the listening window
  ok('silence cannot unwrap a present',!s.gifts.active&&s.gifts.opened===0&&s.speech.step===0,s);await advance(page,13000);s=await state(page);ok('a whole quiet listening window earns nothing',!s.gifts.active&&s.gifts.opened===0&&s.speech.step===0&&s.speech.phase==='nudge'&&await page.locator('#giftHandle').isDisabled(),s);
  const lines=await page.evaluate(()=>__quiet.speech.slice());ok('Echo says the word earns the present',lines.some(l=>/Say each word two times to get a present/.test(l)),lines);
  await page.locator('#micBtn').click();ok('two sayings earn the first present',await sayWord(page));s=await state(page);ok('the word gives a few seconds of easier unwrapping',s.gifts.power>0&&s.gifts.ladder===0,s.gifts);await advance(page,11000);s=await state(page);ok('waiting after speech never opens a present',s.gifts.opened===0&&!s.gifts.unlocked&&s.gifts.power===0,s);
  await tap(page,'#giftHandle');s=await state(page);ok('holding a still bow cannot untie it',!s.gifts.unlocked&&s.gifts.route.work===0,s);ok('a tap that does nothing is a miss: the path glows and points',s.gifts.misses===1&&s.gifts.ladder===1,s.gifts);
  await pull(page,{wrong:true});s=await state(page);ok('pulling across the wrong direction cannot untie the bow',!s.gifts.unlocked,s);ok('two misses: almost any pull the right way works',s.gifts.ladder===2&&s.gifts.route.required<.1,s.gifts);
  await pull(page,{wrong:true});ok('even then, a pull the wrong way does not untie it',!(await state(page)).gifts.unlocked);
  await pull(page,{partial:true});s=await state(page);ok('a tiny tug cannot untie the bow',!s.gifts.unlocked&&s.speech.step===0,s);
  ok('the real bow-tail pull unlocks the first lid',await pull(page),await state(page));s=await state(page);ok('untying alone never reveals the friend',s.gifts.opened===0&&s.gifts.mode==='open'&&s.speech.step===0,s);
  ok('a tiny lid lift cannot open the present',!await lift(page,{partial:true})&&(await state(page)).gifts.opened===0);await lift(page,{background:true});s=await state(page);ok('a canceled full lid lift cannot reveal a friend',s.gifts.opened===0&&s.gifts.unlocked&&!s.gifts.held&&s.speech.step===0,s);
  ok('lifting and releasing opens the first real present',await lift(page));s=await state(page);ok('the friend is cheered before the next word',s.gifts.celebrating&&s.speech.step===0&&s.speech.phase==='play',s.speech);
  await advance(page,800);ok('the cheer lasts about a second',(await state(page)).speech.step===0);await until(page,()=>__sayplay.step===1,1500);s=await state(page);ok('the step counts once after the cheer',s.speech.step===1&&!s.gifts.celebrating,s.speech);
  const chimes=await page.evaluate(()=>__quiet.sfx.slice());ok('the friend gets a happy chime',chimes.some(x=>/correct/.test(JSON.stringify(x))),chimes);
  await advance(page,1500);s=await state(page);ok('the found friend stays on its shelf',s.gifts.opened===1&&s.gifts.revealed[0]&&s.speech.step===1,s);
  // present 2: the help word is a bonus, and an unanswered help gives the move back
  ok('second present: the word is heard',await sayWord(page));s=await state(page);const helped=s.gifts.route.required;ok('second present uses a diagonal paper peel',s.gifts.mechanic==='peel',s);await advance(page,11000);s=await state(page);const ordinary=s.gifts.route.required;ok('speech power shortens the actual peel',helped<ordinary*.8&&s.gifts.ladder===0,{helped,ordinary});
  await pull(page,{wrong:true});ok('paper cannot peel in an unrelated direction',!(await state(page)).gifts.unlocked);s=await state(page);ok('one miss: the peel gets easier with no speech',s.gifts.ladder===1&&s.gifts.route.required<ordinary*.8&&s.gifts.route.tolerance>.09,s.gifts);
  const was=s.gifts;await page.locator('#giftsHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('asking for help keeps the same half-done present',s.gifts.paused&&s.gifts.route.work===was.route.work&&s.speech.step===1&&await page.locator('#helpBack').isVisible(),s);
  const same=x=>x.speech.phase==='play'&&!x.speech.paused&&!x.gifts.paused&&x.gifts.active&&x.gifts.power===0&&x.speech.step===1&&x.gifts.stage===1&&x.gifts.route.work===was.route.work&&x.gifts.misses===was.misses&&Math.abs(x.gifts.handle.x-was.handle.x)<1e-9;
  await advance(page,13500);s=await state(page);ok('help, then 13 s of silence: the same peel, no power, playing again',same(s)&&!await page.locator('#helpBack').isVisible()&&await page.locator('#giftHandle').isEnabled(),{s,was});
  await page.locator('#giftsHelp').click();await until(page,()=>__sayplay.listening);await page.locator('#helpBack').click();await advance(page,100);s=await state(page);ok('"Back to the game" gives the same peel back at once, no power',same(s)&&await page.locator('#giftHandle').isEnabled(),{s,was});
  await page.locator('#giftsHelp').click();await until(page,()=>__sayplay.listening);await page.evaluate(()=>__quiet.background());await advance(page,300);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await advance(page,100);s=await state(page);ok('a help ask cut off by the lock screen gives the same peel back',same(s),{s,was});
  await page.locator('#giftsHelp').click();ok('the help word can still be said',await sayWord(page));s=await state(page);ok('a heard help word adds the bonus power on the same present',s.gifts.power>0&&s.speech.step===1&&s.gifts.route.work===was.route.work,s.gifts);await advance(page,11000);
  // the finding's 3-year-old: a wobbly drag 30 px off the path
  s=await state(page);const d=s.gifts.route.direction;await drag(page,'#giftHandle',wobble(d,s.gifts.route.required*s.gifts.width*1.15,30));ok('after a miss, a wobbly 30 px peel still opens the paper',(await state(page)).gifts.unlocked,(await state(page)).gifts);
  ok('a real lid lift opens the second present',await present(page),await state(page));
  ok('third present: the word is heard',await sayWord(page));s=await state(page);ok('third present has two separate real latches',s.gifts.mechanic==='latches'&&s.gifts.latches.length===2&&s.gifts.misses===0,s);await latch(page,0,{wrong:true});ok('a sideways latch drag cannot unlock it',!(await state(page)).gifts.latches[0].opened);ok('sliding the first latch opens only that latch',await latch(page,0)&&!(await state(page)).gifts.unlocked);const before=JSON.stringify((await state(page)).gifts.latches.map(l=>l.opened));await page.locator('#giftsHelp').click();await sayWord(page);ok('help preserves the already opened latch',JSON.stringify((await state(page)).gifts.latches.map(l=>l.opened))===before);ok('both actual latches and a real lift open the third present',await present(page),await state(page));
  ok('fourth present: the word is heard',await sayWord(page));s=await state(page);ok('fourth present has a circular screw lid',s.gifts.mechanic==='twist',s);await twist(page,{detour:true});ok('an endpoint shortcut through the lid center cannot turn it',!(await state(page)).gifts.unlocked);ok('a real circular twist and lift opens the fourth present',await present(page),await state(page));
  ok('fifth present: the word is heard',await sayWord(page));s=await state(page);ok('fifth present uses a sideways sliding top',s.gifts.mechanic==='slide',s);await pull(page,{wrong:true});ok('lifting before sliding cannot open the final present',!(await state(page)).gifts.unlocked);ok('real sliding and lifting opens the last present',await present(page),await state(page));await advance(page,3300);s=await state(page);ok('five different physical mechanisms reveal all five friends',s.speech.phase==='end'&&s.speech.step===5&&s.gifts.opened===5&&s.gifts.won&&s.gifts.revealed.every(Boolean),s);
  const quiet=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));ok('present sounds and directions never enter the microphone',quiet.leaks===0&&quiet.live===0&&quiet.overlap===0,quiet);ok('the child hears the different opening actions',/pull/i.test(quiet.lines.join('|'))&&/peel/i.test(quiet.lines.join('|'))&&/lid|turn|twist/i.test(quiet.lines.join('|')),quiet.lines);
  {const src=readFileSync(path.join(ROOT,'gifts.js'),'utf8'),said=(src.match(/"[A-Z][^"\n]*"/g)||[]).filter(x=>/\b(missed|wrong|fail|score|points|correct)\b/i.test(x));ok('no unkind words in anything the presents say',said.length===0,said);}
  await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-gifts-finished.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='');await page.locator('#again').click();await advance(page,300);s=await state(page);ok('replay resets all five presents, shelf friends and the ladder',s.speech.step===0&&s.gifts.opened===0&&s.gifts.revealed.every(v=>!v)&&!s.gifts.active&&s.gifts.misses===0&&!s.gifts.celebrating,s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 // (b) a struggling child: no speech after the word, misses only, every present opens
 if(!part||part==='struggle'){
  const{page,context,errors}=await fresh();await page.locator('#startBtn').click();
  const up={x:0,y:-1};
  for(let i=0;i<5;i++){
   if(!await sayWord(page))throw Error('Could not earn present '+i);let s=await state(page);const m=s.gifts.mechanic,tag='present '+(i+1)+' ('+m+')';
   const grip=m==='latches'?'#giftLatch0':'#giftHandle';
   await tap(page,grip);s=await state(page);ok(tag+': a tap that opens nothing glows and points',s.gifts.ladder===1&&!s.gifts.unlocked,s.gifts);
   if(m==='twist'){await twist(page,{turn:.25*Math.PI});}else if(m==='latches'){await drag(page,grip,[[60,0],[90,0]]);}else{const d=s.gifts.route.direction;await drag(page,grip,[[-d.y*80,d.x*80]]);}
   s=await state(page);ok(tag+': after two misses almost anything works',s.gifts.ladder===2&&!s.gifts.unlocked,s.gifts);
   // a sloppy, short, roughly-right drag
   let tries=0;while(!(await state(page)).gifts.unlocked&&tries<4){tries++;s=await state(page);
    if(m==='twist')await twist(page,{turn:.45*Math.PI,amp:25});
    else if(m==='latches'){for(let k=0;k<2;k++)if(!(await state(page)).gifts.latches[k].opened)await drag(page,'#giftLatch'+k,wobble(up,.07*s.gifts.width,22,4));}
    else await drag(page,'#giftHandle',wobble(s.gifts.route.direction,.08*s.gifts.width,22,4));}
   s=await state(page);ok(tag+': a sloppy drag unwraps it within a few tries',s.gifts.unlocked&&tries<=2,{tries,g:s.gifts});
   await tap(page,'#giftLid');s=await state(page);await drag(page,'#giftLid',wobble(up,.09*s.gifts.width,20,4));s=await state(page);ok(tag+': a short wobbly lift opens the lid',s.gifts.opened===i+1,s.gifts);
   ok(tag+': the step counts with no more speech',await until(page,n=>__sayplay.step===n,2500,i+1));
  }
  await advance(page,3300);let s=await state(page);ok('the struggling child reaches the end of the round',s.speech.phase==='end'&&s.gifts.opened===5,s.speech);
  // help never finishes a move: a present waits however long nobody touches it
  await page.locator('#again').click();if(!await sayWord(page))throw Error('replay word');await advance(page,20000);s=await state(page);ok('20 s with no finger opens nothing',!s.gifts.unlocked&&s.gifts.opened===0&&s.speech.step===0&&s.gifts.ladder===0,s.gifts);
  ok('struggle has no runtime errors',errors.length===0,errors);await context.close();
 }
 if(!part||part==='keyboard'){
  const{page,context}=await fresh();await page.locator('#startBtn').click();await sayWord(page);await page.locator('#giftHandle').focus();await page.keyboard.press('Space');let s=await state(page);const start={...s.gifts.handle};ok('keyboard picks up the real bow tail',s.gifts.held,s);await page.keyboard.press('ArrowRight');s=await state(page);ok('keyboard moves the held gift grip',s.gifts.handle.x>start.x,s);await page.keyboard.press('Space');ok('keyboard release does not skip a present',(await state(page)).gifts.opened===0&&!(await state(page)).gifts.held);await context.close();
 }
 // (e) fit: play, a word turn and a help ask on four screens
 if(!part||part==='fit'){
  {const{page,context,errors}=await fresh({blockAssets:true});await page.locator('#startBtn').click();await sayWord(page);ok('missing paintings leave real present opening playable',await present(page));ok('fallback has no runtime errors',errors.length===0,errors);await context.close();}
  const rects=(p,ids)=>p.evaluate(ids=>ids.map(id=>{const e=document.getElementById(id),r=e?e.getBoundingClientRect():{x:0,y:0,right:0,bottom:0,width:0,height:0};return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,shown:!!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'};}),ids);
  for(const viewport of[{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024}]){
   const tag=viewport.width+'x'+viewport.height,inside=r=>r.shown&&r.w>0&&r.x>=-.5&&r.y>=-.5&&r.right<=viewport.width+.5&&r.bottom<=viewport.height+.5,big=r=>r.w>=44&&r.h>=44;
   const{page,context,errors}=await fresh({viewport});await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
   let r=await rects(page,['turnPanel','hear','word']);ok(tag+': the word turn fits, with a big enough Hear it',r.every(inside)&&big(r[1]),r);
   for(let i=0;i<5;i++){if(!await sayWord(page))throw Error('Could not earn fitted present '+i);
    const fit=await page.evaluate(()=>{const ids=['giftHandle','giftLatch0','giftLatch1','giftLid'].filter(id=>{const e=document.getElementById(id);return!e.hidden&&getComputedStyle(e).visibility!=='hidden';}),rects=['giftsHelp','giftsHearStep',...ids].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};}),ban=document.getElementById('giftsBanner').getBoundingClientRect(),ctl=document.getElementById('giftsControls').getBoundingClientRect();return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,rects,ban:{bottom:ban.bottom},ctl:{top:ctl.top}};});
    ok(tag+': real present controls fit step '+(i+1),fit.scroll<=fit.height+1&&fit.sw<=fit.width+1&&fit.rects.every(r=>r.x>=0&&r.y>=0&&r.right<=fit.width&&r.bottom<=fit.height&&r.w>=44&&r.h>=44)&&fit.rects.filter(r=>/^gift(Handle|Latch|Lid)/.test(r.id)).every(r=>r.y+r.h/2>fit.ban.bottom&&r.y+r.h/2<fit.ctl.top),fit);
    if(i===0){await page.locator('#giftsHelp').click();await until(page,()=>__sayplay.listening);r=await rects(page,['turnPanel','hear','helpBack','word']);ok(tag+': a help ask fits, with a big enough "Back to the game"',r.every(inside)&&big(r[1])&&big(r[2]),r);await page.locator('#helpBack').click();await advance(page,100);}
    ok(tag+': physical present '+(i+1)+' opens',await present(page),await state(page));}
   await advance(page,3300);await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-gifts-'+viewport.width+'.png')});ok(tag+': fit has no runtime errors',errors.length===0,errors);await context.close();}
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
