// Puppy Bath (ages 3-4): real sprayed droplets wash five moving mud spots.
// The fake clock is PAUSED after the page loads, so only advance() moves
// time: real time spent in evaluate() or mouse.move() can no longer wash a
// spot behind a check's back (the 17 Oct battery failure). Every wait is on
// published state (until / waitForFunction), never a fixed sleep.
// PUPPY_PART=main|struggle|help|keyboard|parked|fit runs one part.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d).slice(0,1500)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,puppy:window.__puppy}));
async function aim(p,q,steps=4){const b=await p.locator('#puppyCanvas').boundingBox();await p.mouse.move(b.x+q.x*b.width,b.y+q.y*b.height,{steps});}
async function spray(p){const b=await p.locator('#puppySpray').boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();}
async function wash(p,stage,max=9000,dt=80){
 if((await state(p)).speech.step>stage)return true;await spray(p);
 for(let t=0;t<max;t+=dt){let s=await state(p);if(s.speech.step>stage)break;await aim(p,s.puppy.target,2);await advance(p,dt);}
 await p.mouse.up();await advance(p,100);return(await state(p)).speech.step>stage;
}
async function wiggleRange(p,ms=4600){let lo=Infinity,hi=-Infinity;for(let t=0;t<ms;t+=100){await advance(p,100);const x=(await state(p)).puppy.target.x;lo=Math.min(lo,x);hi=Math.max(hi,x);}return hi-lo;}
const BANNED=/miss|wrong|fail|score|points|correct/i;
const part=process.env.PUPPY_PART;
try{
 h=await gameHarness('puppy',8358);
 const fresh=async(opts={})=>{const f=await h.fresh({...opts,device:{age:'4',...opts.device}});
  if(opts.unpark===false)return f;
  const now=await f.page.evaluate(()=>Date.now());await f.page.clock.pauseAt(now+1000);
  await f.page.waitForFunction(()=>window.__puppy&&__puppy.artReady,null,{timeout:20000});return f;};
 const begin=async page=>{await page.locator('#startBtn').click();return until(page,()=>__sayplay.listening);};

 // ── (d) parked: a typed address goes home before any mic or sound ──
 if(!part||part==='parked'||part==='main'){
  const {page,context}=await fresh({unpark:false});
  const home=await until(page,()=>/\/(today|activities)\.html/.test(location.pathname)&&!!document.getElementById('libraryMessage')&&/Puppy Bath is coming soon/.test(document.getElementById('libraryMessage').textContent),8000);
  ok('the parked bath goes back to Home, which says it is coming soon',home&&!page.url().includes('arcade-puppy'),{url:page.url()});
  const q=await page.evaluate(()=>({req:__quiet.requests,snd:__quiet.soundsBefore}));
  ok('the parked bath opens no microphone and plays nothing before it leaves',q.req===0&&q.snd===0,q);await context.close();
 }

 if(!part||part==='main'){
  const {page,context,errors}=await fresh();const real=await page.locator('#puppyCanvas').count();ok('Puppy Bath has a real water and moving-mud board',real===1);if(!real)throw Error('Puppy Bath is still a soap reveal scene');
  let s=await state(page);ok('the start banner says the word comes first',/say the word/i.test(s.puppy.banner),s.puppy.banner);
  ok('the page tells a child aged 4 to use the gentle ladder',s.puppy.ladder.little===true,s.puppy.ladder);
  await begin(page);await advance(page,1500);s=await state(page);ok('silence cannot wash the puppy',!s.puppy.active&&s.puppy.cleaned===0&&s.speech.step===0,s);
  ok('the Spray button stays off before the word',await page.locator('#puppySpray').isDisabled());
  await advance(page,13000);s=await state(page);ok('a whole silent listen earns nothing: no water, no spot, no step',!s.puppy.active&&s.puppy.spawned===0&&s.puppy.targets.every(t=>t.wash===0)&&s.speech.step===0,s);
  await page.evaluate(()=>{if(!__sayplay.listening){const b=document.getElementById('micBtn');if(b&&!b.hidden)b.click();}});
  ok('two sayings earn the first wash',await sayWord(page));await advance(page,1600);s=await state(page);ok('a word and idle animation cannot remove mud',s.puppy.targets.every(t=>t.wash===0&&!t.clean)&&s.puppy.spawned===0&&s.speech.step===0,s);
  ok('waiting with no hose held climbs no ladder',s.puppy.ladder.level===0&&s.puppy.ladder.effort===0,s.puppy.ladder);
  await aim(page,s.puppy.target);await advance(page,1200);s=await state(page);ok('aiming without holding cannot clean mud',s.puppy.target.wash===0&&s.puppy.spawned===0,s);
  await spray(page);s=await state(page);ok('pressing Spray aims the water at the glowing spot, not at the button',Math.abs(s.puppy.aim.x-s.puppy.target.x)<.02&&Math.abs(s.puppy.aim.y-s.puppy.target.y)<.02,{aim:s.puppy.aim,target:s.puppy.target});
  await aim(page,{x:s.puppy.nozzle.x+.02,y:s.puppy.nozzle.y+.04});await advance(page,1500);s=await state(page);ok('off-target water really flies but cannot wash a patch',s.puppy.spawned>0&&s.puppy.target.wash===0&&s.puppy.cleaned===0,s);
  await page.locator('#puppySpray').evaluate(e=>e.dispatchEvent(new PointerEvent('pointercancel',{pointerId:99})));ok('a different pointer cannot release the hose',(await state(page)).puppy.held);await page.mouse.up();await advance(page,1800);s=await state(page);const emitted=s.puppy.spawned;await advance(page,400);ok('releasing the hose stops new water',(await state(page)).puppy.spawned===emitted);
  await spray(page);s=await state(page);await aim(page,s.puppy.target);await advance(page,70);await page.mouse.up();s=await state(page);ok('a tiny spray cannot instantly erase a mud patch',s.puppy.target.wash<1&&s.puppy.cleaned===0&&s.speech.step===0,s);await advance(page,900);
  await spray(page);for(let t=0;t<1500;t+=40){s=await state(page);if(s.puppy.target.wash>0)break;await aim(page,s.puppy.target);await advance(page,40);}await page.mouse.up();s=await state(page);ok('actual arriving water gradually washes the current mud',s.puppy.target.wash>0&&s.puppy.target.wash<1&&s.puppy.impacts>0&&s.speech.step===0,s);await page.screenshot({path:path.join(OUT,'sona-puppy-splash.png')});
  ok('the help pill is ready in play',await until(page,()=>__sayplay.phase==='play'&&__sayplay.step===0&&!document.getElementById('puppyHelp').disabled),s);
  await page.locator('#puppyHelp').evaluate(e=>e.addEventListener('click',()=>window.__puppyAtHelp=JSON.parse(JSON.stringify(__puppy)),{capture:true,once:true}));await page.locator('#puppyHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);const kept=await page.evaluate(()=>__puppyAtHelp);ok('help preserves wash progress and the chosen aim',s.puppy.paused&&s.puppy.target.wash===kept.target.wash&&s.puppy.aim.x===kept.aim.x&&s.puppy.aim.y===kept.aim.y&&s.puppy.cleaned===0&&s.puppy.particles.length===0,s);
  await page.evaluate(()=>__quiet.background());await advance(page,350);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await advance(page,100);s=await state(page);
  ok('a pause during a help ask goes straight back to the same spot, unpowered',s.speech.phase==='play'&&!s.puppy.paused&&s.puppy.active&&s.speech.step===0&&s.puppy.target.wash===kept.target.wash&&!await page.locator('#puppySpray').isDisabled(),s);
  await advance(page,11000);await page.locator('#puppyHelp').click();await until(page,()=>__sayplay.listening);ok('a help ask holds the water',(await state(page)).puppy.paused&&await page.locator('#puppySpray').isDisabled());ok('a heard help word returns to the same dirty patch',await sayWord(page));s=await state(page);ok('heard help gives the power on the same spot',s.puppy.power>9&&s.speech.step===0&&s.puppy.target.wash===kept.target.wash,s);
  await spray(page);s=await state(page);await aim(page,s.puppy.target);await advance(page,120);await page.evaluate(()=>{window.__puppyAtBackground=JSON.parse(JSON.stringify(__puppy));__quiet.background();});await advance(page,350);await page.mouse.up();await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();s=await state(page);const bg=await page.evaluate(()=>__puppyAtBackground);ok('an interrupted hose releases and keeps accumulated washing',!s.puppy.held&&s.puppy.particles.length===0&&s.puppy.target.wash===bg.target.wash&&s.speech.step===0,s);const stay=s.puppy.target.wash;await advance(page,1000);ok('foregrounding never resumes the old spray',(await state(page)).puppy.target.wash===stay&&!(await state(page)).puppy.held);
  // the celebration beat: clean now, the step about 1.15 s later, once
  await spray(page);let beat=null;for(let t=0;t<9000;t+=40){s=await state(page);if(s.puppy.cleaned>=1){beat=s;break;}await aim(page,s.puppy.target);await advance(page,40);}await page.mouse.up();
  ok('real aimed water finishes the first muddy patch',!!beat&&beat.puppy.cleaned===1,beat);
  const chimes=await page.evaluate(()=>__quiet.sfx.filter(x=>x.name==='correct').length);
  ok('a clean spot chimes and holds a celebration beat before the step counts',!!beat&&beat.puppy.beat&&beat.speech.step===0&&chimes>0,{beat:beat&&beat.puppy.beat,step:beat&&beat.speech.step,chimes});
  await advance(page,700);s=await state(page);ok('the beat waits about a second',s.speech.step===0&&s.puppy.beat,s.speech);
  await page.evaluate(()=>__quiet.background());await advance(page,3000);await page.evaluate(()=>__quiet.foreground());s=await state(page);ok('a pause holds the beat',s.speech.step===0&&s.puppy.beat&&s.puppy.dones===0,s.speech);
  await page.locator('#resume').click();await until(page,()=>__sayplay.step===1,3000);s=await state(page);ok('then the step counts exactly once',s.speech.step===1&&s.puppy.dones===1&&!s.puppy.beat,s);
  await sayWord(page);await advance(page,11000);s=await state(page);const normal={radius:s.puppy.sprayRadius,amplitude:s.puppy.wiggle.amplitude,rate:s.puppy.wiggle.rate},normalMotion=await wiggleRange(page);await page.locator('#puppyHelp').click();await sayWord(page);s=await state(page);const helperMotion=await wiggleRange(page);ok('speech widens the actual spray and steadies the puppy',s.puppy.sprayRadius>normal.radius&&s.puppy.wiggle.amplitude<normal.amplitude&&s.puppy.wiggle.rate<normal.rate&&helperMotion<normalMotion*.75,{normal,after:s.puppy.wiggle,normalMotion,helperMotion});ok('help never cleans the next patch by itself',(await state(page)).puppy.cleaned===1&&(await state(page)).puppy.target.wash===0);ok('aimed water cleans patch two',await wash(page,1),await state(page));
  for(let stage=2;stage<5;stage++){if(!await sayWord(page))throw Error('Could not earn puppy patch '+stage);s=await state(page);ok('the next word leaves its mud for the child',s.puppy.cleaned===stage&&!s.puppy.target.clean&&s.puppy.target.wash===0,s);ok('actual spray cleans patch '+(stage+1),await wash(page,stage),await state(page));}
  await until(page,()=>__sayplay.phase==='end',8000);s=await state(page);ok('five physical washes finish one clean puppy',s.speech.phase==='end'&&s.speech.step===5&&s.puppy.cleaned===5&&s.puppy.targets.every(t=>t.clean)&&s.puppy.won&&s.puppy.dones===5,s);const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));ok('bath sounds and directions never enter microphone turns',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);ok('the child hears how to aim and wash',/hold/i.test(audio.lines.join('|'))&&/spot|mud|wash/i.test(audio.lines.join('|')),audio.lines);ok('the spoken intro says the word starts each spot',audio.lines.some(l=>/say each word two times/i.test(l)),audio.lines);ok('no spoken line is unkind',!audio.lines.some(l=>BANNED.test(l)),audio.lines);await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-puppy-finished.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='');await page.locator('#again').click();await advance(page,350);s=await state(page);ok('replay brings back all five dirty patches and no water',s.speech.step===0&&s.puppy.cleaned===0&&!s.puppy.active&&s.puppy.particles.length===0&&s.puppy.targets.every(t=>t.wash===0)&&s.puppy.ladder.level===0,s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }

 // ── (b) a struggling child who keeps spraying beside the spot, no speech ──
 if(!part||part==='struggle'){
  const {page,context,errors}=await fresh();await begin(page);ok('struggle: the word starts the first spot',await sayWord(page));await advance(page,11000);
  const off=async()=>{const s=await state(page);return{x:Math.min(.95,s.puppy.nozzle.x+.05),y:s.puppy.nozzle.y+.02};};
  const struggle=async(stage,max)=>{const seen=[],banners=new Set();const b=await page.locator('#puppyCanvas').boundingBox();const q=await off();
   await page.mouse.move(b.x+q.x*b.width,b.y+q.y*b.height);await page.mouse.down();let s,at=null,t=0;
   for(;t<max;t+=100){await advance(page,100);s=await state(page);banners.add(s.puppy.banner);if(!seen.length||seen[seen.length-1].level!==s.puppy.ladder.level)seen.push({level:s.puppy.ladder.level,t});if(s.puppy.ladder.level===2&&seen[seen.length-1].t===t&&stage===0)await page.screenshot({path:path.join(OUT,'sona-puppy-ladder.png')});if(s.puppy.cleaned>stage){at=t;break;}}
   await page.mouse.up();return{seen,at,banners:[...banners],s};};
  let s=await state(page);const voice0=await page.evaluate(()=>__quiet.mics.length);
  let r=await struggle(0,20000);
  const climbs=(seen,steps)=>{const lv=seen.map(x=>x.level).join();return /^0,1,2(,3)?$/.test(lv)&&seen.slice(1).every((x,n)=>Math.abs(x.t-steps[n])<=300);};
  ok('struggle (age 4): holding the water beside the spot climbs the ladder in about 2 s steps',climbs(r.seen,[2000,4000,6000]),r.seen);
  ok('struggle (age 4): the spot washes with no speech at all',r.at!==null&&r.at<11000&&r.s.puppy.cleaned===1,r);
  ok('struggle: the ladder banners stay kind',r.banners.every(t=>!BANNED.test(t))&&r.banners.some(t=>/arrow/i.test(t)),r.banners);
  s=await state(page);ok('struggle: no microphone was opened for it',await page.evaluate(()=>__quiet.mics.length)===voice0,{});
  await until(page,()=>__sayplay.listening);ok('struggle: the next word starts spot two',await sayWord(page));s=await state(page);ok('a new word starts the ladder again',s.puppy.ladder.level===0&&s.puppy.ladder.effort===0,s.puppy.ladder);
  await advance(page,11000);await page.evaluate(()=>Puppy.setLittle(false));
  r=await struggle(1,26000);
  ok('struggle (ages 5-8 ladder): it climbs at about 4, 8 and 12 s',climbs(r.seen,[4000,8000,12000]),r.seen);
  ok('struggle (ages 5-8 ladder): the spot washes with no speech',r.at!==null&&r.s.puppy.cleaned===2,r);
  s=r.s;ok('the ladder is published with its help',s.puppy.ladder.level>=2&&s.puppy.ladder.pull>0&&s.puppy.ladder.catchExtra>0,s.puppy.ladder);
  ok('struggle: no runtime errors',errors.length===0,errors);await context.close();
 }

 // ── (c) help, then silence (or "Back to the game"): the same spot goes on ──
 if(!part||part==='help'){
  const {page,context,errors}=await fresh();await begin(page);await sayWord(page);await advance(page,11000);
  await spray(page);let s;for(let t=0;t<1500;t+=40){s=await state(page);if(s.puppy.target.wash>0)break;await aim(page,s.puppy.target);await advance(page,40);}await page.mouse.up();await advance(page,100);
  const was=(await state(page)).puppy;const same=(s,w)=>s.speech.phase==='play'&&!s.puppy.paused&&s.puppy.active&&s.puppy.stage===w.stage&&s.speech.step===0&&s.puppy.power===0&&s.puppy.target.wash===w.target.wash&&s.puppy.aim.x===w.aim.x&&s.puppy.aim.y===w.aim.y;
  ok('help: some mud is washed and the power is gone first',was.target.wash>0&&was.target.wash<1&&was.power===0,was);
  await page.locator('#puppyHelp').click();await until(page,()=>__sayplay.listening);ok('help asks for the word, with "Back to the game" on screen',(await state(page)).puppy.paused&&await page.locator('#helpBack').isVisible());
  await advance(page,13500);s=await state(page);ok('help, then 13 s of silence: the same spot, no power, playing again',same(s,was)&&!await page.locator('#puppySpray').isDisabled()&&!await page.locator('#helpBack').isVisible(),{s,was});
  await spray(page);for(let t=0;t<400;t+=40){s=await state(page);await aim(page,s.puppy.target);await advance(page,40);}await page.mouse.up();s=await state(page);ok('help, then silence: the finger keeps washing the same spot',s.puppy.target.wash>was.target.wash&&s.puppy.stage===0,s.puppy.target);
  await advance(page,900);const was2=(await state(page)).puppy;
  await page.locator('#puppyHelp').click();await until(page,()=>__sayplay.listening);await page.locator('#helpBack').click();await advance(page,100);s=await state(page);
  ok('"Back to the game" returns to the same spot, no power',same(s,{...was2,target:s.puppy.target})&&s.puppy.target.wash===was2.target.wash&&!await page.locator('#helpBack').isVisible(),{s,was2});
  ok('help: then the finger finishes the spot',await wash(page,0),await state(page));
  ok('help: no runtime errors',errors.length===0,errors);await context.close();
 }

 if(!part||part==='keyboard'){
  const {page,context}=await fresh();await begin(page);await sayWord(page);await page.locator('#puppySpray').focus();let s=await state(page);const before={...s.puppy.aim};await page.keyboard.press('ArrowRight');s=await state(page);ok('keyboard moves the real hose aim',s.puppy.aim.x>before.x,s);await page.keyboard.down('Space');await advance(page,500);s=await state(page);ok('keyboard hold emits actual moving water',s.puppy.spawned>0&&s.puppy.particles.length>0&&s.puppy.held,s);await page.keyboard.up('Space');const released=(await state(page)).puppy.spawned;await advance(page,500);ok('keyboard release stops water emission',(await state(page)).puppy.spawned===released&&!(await state(page)).puppy.held);await context.close();
 }

 // ── (e) fit: play, a word turn and a help ask on four screens ──
 if(!part||part==='fit'){
  {const {page,context,errors}=await fresh({blockAssets:true});await begin(page);await sayWord(page);ok('missing paintings cannot stop real water washing',await wash(page,0));ok('fallback has no runtime errors',errors.length===0,errors);await context.close();}
  const rects=(page,ids)=>page.evaluate(ids=>ids.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight};}),ids);
  const inside=r=>r.w>0&&r.h>0&&r.x>=0&&r.y>=0&&r.right<=r.vw+.5&&r.bottom<=r.vh+.5;
  for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024}]){
   const tag='fit '+viewport.width+'x'+viewport.height;
   const {page,context,errors}=await fresh({viewport});await begin(page);
   let r=await rects(page,['turnPanel','hear','word']);ok(tag+': the word turn fits, with a big enough Hear it',r.every(inside)&&r[1].w>=44&&r[1].h>=44,r);
   for(let stage=0;stage<5;stage++){if(!await sayWord(page))throw Error('Could not earn fitted puppy patch '+stage);
    const fit=await page.evaluate(()=>{const rects=['puppySpray','puppyHelp','puppyHearStep','puppyStatus','puppyBanner','top'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};});const c=document.getElementById('puppyCanvas').getBoundingClientRect(),t=__puppy.target;return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,rects,spot:{x:c.x+t.x*c.width,y:c.y+t.y*c.height,r:t.r*c.width}};});
    const covered=fit.rects.filter(r=>fit.spot.x+fit.spot.r>r.x&&fit.spot.x-fit.spot.r<r.right&&fit.spot.y+fit.spot.r>r.y&&fit.spot.y-fit.spot.r<r.bottom).map(r=>r.id);
    ok(tag+': controls fit and the muddy spot is clear, step '+(stage+1),fit.scroll<=fit.height+1&&fit.sw<=fit.width+1&&fit.rects.filter(r=>/puppy(Spray|Help|HearStep)/.test(r.id)).every(r=>r.x>=0&&r.y>=0&&r.right<=fit.width&&r.bottom<=fit.height&&r.w>=44&&r.h>=44)&&covered.length===0,{fit,covered});
    if(stage===0){await page.locator('#puppyHelp').click();await until(page,()=>__sayplay.listening);r=await rects(page,['turnPanel','hear','helpBack','word']);ok(tag+': a help ask fits, with a big enough "Back to the game"',r.every(inside)&&r[1].w>=44&&r[1].h>=44&&r[2].h>=44&&r[2].w>=44,r);await page.locator('#helpBack').click();await advance(page,100);}
    ok(tag+': real water cleans fitted patch '+(stage+1),await wash(page,stage,9000,200),await state(page));}
   await until(page,()=>__sayplay.phase==='end',8000);await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-puppy-'+viewport.width+'.png')});ok(tag+': fit has no runtime errors',errors.length===0,errors);await context.close();
  }
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
