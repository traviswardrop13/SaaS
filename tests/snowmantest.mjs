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
async function piece(p,target,{background=false}={}){
 const s=(await state(p)).snow,index=s.tray.findIndex(t=>t.id===target.id),b=await p.locator('#snowPiece'+index).boundingBox();if(!b)throw Error('No real tray piece '+target.id);await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await move(p,target);
 if(background){await p.evaluate(()=>__quiet.background());await advance(p,350);await p.mouse.up();await p.evaluate(()=>__quiet.foreground());await p.locator('#resume').click();await advance(p,100);}else{await p.mouse.up();await advance(p,90);}
}
async function decorate(p,stage){let s=await state(p);for(const t of s.snow.targets.filter(t=>!t.placed))await piece(p,t);return until(p,st=>__sayplay.step>st,4000,stage);}
const part=process.env.SNOWMAN_PART,PORT=8356;
try{
 h=await gameHarness('snowman',PORT);const fresh=(opts={})=>h.fresh({...opts,device:{age:'4',...opts.device}});
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
  const ordinaryStart=s.snow.ball.progress;await smallRoll(page,.035);s=await state(page);const ordinary=s.snow.ball.progress-ordinaryStart,keep={...s.snow.ball};ok('real movement on snow grows the ball',ordinary>0&&ordinary<.3,s);await page.locator('#snowmanHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('help keeps accumulated snow and the current ball',s.snow.paused&&s.snow.ball.progress===keep.progress&&s.snow.ball.distance===keep.distance&&s.snow.ball.x===keep.x&&s.snow.ball.y===keep.y,s);await page.evaluate(()=>__quiet.background());await advance(page,350);await page.evaluate(()=>__quiet.foreground());ok('backgrounding the help ask keeps snow controls locked',(await state(page)).snow.paused);await page.locator('#resume').click();await advance(page,60);s=await state(page);ok('coming back from a paused help ask gives the same snowball back, no power',s.speech.phase==='play'&&!s.snow.paused&&s.snow.power===0&&s.snow.ball.progress===keep.progress&&s.snow.ball.x===keep.x&&!await page.locator('#snowBall').isDisabled(),s);await page.locator('#snowmanHelp').click();ok('repeated speech renews the same snowball',await sayWord(page));s=await state(page);const boostedStart=s.snow.ball.progress;await smallRoll(page,-.035);s=await state(page);ok('the same rolling distance collects more snow with speech help',s.snow.ball.progress-boostedStart>ordinary*1.3&&s.speech.step===0,{ordinary,boosted:s.snow.ball.progress-boostedStart});
  await grab(page);await move(page,{x:.4,y:z.top-.14});s=await state(page);const offSnow=s.snow.ball.progress;await move(page,{x:.7,y:z.top-.14});await move(page,{x:.3,y:z.top-.14});s=await state(page);ok('rolling outside the snow lane cannot collect snow',s.snow.ball.progress===offSnow,s);await page.locator('#snowBall').evaluate(e=>e.dispatchEvent(new PointerEvent('pointercancel',{pointerId:99})));ok('a different pointer cannot release the snowball',(await state(page)).snow.held);await page.evaluate(()=>__quiet.background());await advance(page,350);await page.mouse.up();await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();s=await state(page);ok('an interrupted roll releases its hold and preserves the snow',!s.snow.held&&!s.snow.paused&&s.snow.ball.progress===offSnow&&s.speech.step===0,s);
  ok('a grown ball can miss without losing its size',await roll(page,0,{miss:true}),await state(page));s=await state(page);ok('a missed grown ball stays ready on the same word',s.snow.ball.ready&&s.snow.ball.progress===1&&s.speech.step===0,s);ok('a real drop stacks the bottom snowball',await roll(page,0),await state(page));
  for(let stage=1;stage<3;stage++){if(!await sayWord(page))throw Error('Could not earn snowball '+stage);s=await state(page);ok('the next ball starts small and waits for real rolling',!s.snow.ball.ready&&s.snow.ball.progress===0&&s.snow.stacked.filter(Boolean).length===stage,s);ok('real rolling and placement stack snowball '+(stage+1),await roll(page,stage),await state(page));}
  s=await state(page);ok('painted snowballs overlap enough to stay in contact at every rotation',s.snow.stack.slice(1).every((b,i)=>Math.abs(b.y-s.snow.stack[i].y)*s.snow.height/s.snow.width<=(b.r+s.snow.stack[i].r)*.88),s.snow.stack);
  await page.screenshot({path:path.join(OUT,'sona-snowman-stacked.png')});for(let stage=3;stage<5;stage++){if(!await sayWord(page))throw Error('Could not earn the next snowman pieces');s=await state(page);ok('speech never places the new face or clothes',s.snow.targets.every(t=>!t.placed)&&s.snow.completed===stage,s);if(stage===3){await piece(page,s.snow.targets[0]);s=await state(page);const placed=JSON.stringify(s.snow.placed);await page.locator('#snowmanHelp').click();await sayWord(page);ok('speech help keeps the already placed face piece',JSON.stringify((await state(page)).snow.placed)===placed&&(await state(page)).speech.step===stage);await piece(page,(await state(page)).snow.targets.find(t=>!t.placed),{background:true});s=await state(page);ok('an interrupted face piece returns to its tray without losing the first',!s.snow.held&&!s.snow.paused&&s.snow.targets.filter(t=>t.placed).length===1&&s.speech.step===stage,s);}ok('actual drags complete snowman step '+(stage+1),await decorate(page,stage),await state(page));}
  await advance(page,3300);s=await state(page);ok('five physical activities finish a complete snowman',s.speech.phase==='end'&&s.speech.step===5&&s.snow.completed===5&&s.snow.stacked.every(Boolean)&&s.snow.won,s);const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));ok('snow sounds and instructions never reach the microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);ok('the child hears the rolling and dressing directions',/roll/i.test(audio.lines.join('|'))&&/hat|scarf/i.test(audio.lines.join('|')),audio.lines);await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-snowman-finished.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='');await page.locator('#again').click();await advance(page,350);s=await state(page);ok('a new snowman starts with no stack or automatic snow',s.speech.step===0&&s.snow.completed===0&&!s.snow.active&&s.snow.stacked.every(x=>!x),s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 if(!part||part==='ladder'){
  // (a)+(b) a child who never says the help word and keeps missing still finishes every kind of step
  const {page,context,errors}=await fresh();await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
  await advance(page,15000);let s=await state(page);ok('silence for 15 s earns no snowball and no step',!s.snow.active&&s.snow.ball.progress===0&&s.speech.step===0,s);await page.locator('#micBtn').click();
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
