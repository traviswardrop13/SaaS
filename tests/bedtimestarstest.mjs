// Bedtime Stars (ages 3-4): the word starts each picture, the finger draws
// it, and a child who keeps slipping off the path still finishes, with no
// speech (the ladder in public/stars.js). Every wait is on published state
// (window.__stars, window.__sayplay) under Playwright's fake clock.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,stars:window.__stars,banner:document.getElementById('starsBanner').textContent}));
const ready=p=>until(p,()=>__sayplay.phase==='play'&&!__sayplay.paused&&__stars.active&&!__stars.paused&&!__stars.celebrating&&!__stars.held);
async function move(p,q,steps=16){const b=await p.locator('#starsCanvas').boundingBox();await p.mouse.move(b.x+q.x*b.width,b.y+q.y*b.height,{steps});}
async function grab(p){await ready(p);const b=await p.locator('#starPen').boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();}
function offsetMid(s,offset){const a=s.nodes[s.next-1],b=s.nodes[s.next],dx=b.x-a.x,dy=(b.y-a.y)*s.height/s.width,l=Math.hypot(dx,dy);return{x:(a.x+b.x)/2-dy/l*offset,y:(a.y+b.y)/2+dx/l*offset*s.width/s.height};}
// one try at the current line: through a point `offset` (canvas widths) to
// the side of its middle, then to the next star, then let go
async function bentStroke(p,offset){const s=(await state(p)).stars,next=s.nodes[s.next];await grab(p);await move(p,offsetMid(s,offset));await move(p,next);await p.mouse.up();await advance(p,60);}
const doneDrawing=(p,stage)=>p.evaluate(st=>__stars.completed>st,stage);
// a careful child: straight strokes from star to star until the picture is
// drawn, then the celebration beat, then the step counts
async function finishStep(p,stage){
 for(let tries=0;tries<15&&!await doneDrawing(p,stage);tries++){await grab(p);for(let n=0;n<12;n++){const s=await state(p);if(s.stars.completed>stage||!s.stars.held)break;const next=s.stars.nodes[s.stars.next];if(!next)break;await move(p,next,22);await advance(p,40);}await p.mouse.up();await advance(p,60);}
 return until(p,st=>__sayplay.step>st,4000,stage);
}
// expire the word's 10 s glowing path while the child is in play
const powerOff=async p=>{await ready(p);await advance(p,11000);return (await state(p)).stars.power===0;};
const part=process.env.STARS_PART;let fresh;
// the parts run side by side (each page has its own fake clock), so the
// suite takes about as long as its longest part
const guard=name=>fn=>async(...a)=>{try{await fn(...a);}catch(e){ok(name+' completes without a page or harness crash',false,e.stack);}};
const mainPart=guard('main')(async()=>{
  {const {page,context}=await fresh({unpark:false});
   const home=await until(page,()=>/\/(today|activities)\.html/.test(location.pathname)&&!!document.getElementById('libraryMessage')&&/Bedtime Stars is coming soon/.test(document.getElementById('libraryMessage').textContent),8000);
   const q=await page.evaluate(()=>({url:location.pathname,req:__quiet.requests,before:__quiet.soundsBefore}));
   ok('the parked night sky goes back to Home, which says it is coming soon',home&&!page.url().includes('arcade-stars'),q);
   ok('the parked night sky opens no microphone and plays no sound before it leaves',q.req===0&&q.before===0,q);await context.close();}
  const {page,context,errors}=await fresh();const real=await page.locator('#starsCanvas').count();ok('Bedtime Stars has a real tracing board',real===1);if(!real)throw Error('Stars is still a word-triggered reveal');
  const card=await page.evaluate(()=>({start:document.getElementById('startOvl').innerText,primer:document.getElementById('primer').innerText,alt:document.querySelector('.stars-intro').alt}));
  ok('the start card and mic card say the word starts each picture, and the help is extra',/two times to start a picture/i.test(card.start)&&/extra help/i.test(card.start)&&/two times to start each picture/i.test(card.primer)&&!/village/i.test(card.alt),card);
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);await advance(page,1500);let s=await state(page);ok('silence never connects a constellation',!s.stars.active&&s.stars.completed===0&&s.speech.step===0,s);
  await advance(page,13000);s=await state(page);ok('a whole quiet listening window earns nothing: the mic waits for a tap',s.speech.phase==='nudge'&&!s.stars.active&&s.stars.next===1&&s.speech.step===0,s);
  await page.locator('#micBtn').click();ok('two sayings earn the first star picture',await sayWord(page));await advance(page,1600);s=await state(page);ok('speech and idle animation do not draw a picture',s.stars.next===1&&s.stars.completed===0&&s.speech.step===0,s);let b=await page.locator('#starsCanvas').boundingBox(),future=s.stars.nodes[s.stars.next];await page.mouse.click(b.x+future.x*b.width,b.y+future.y*b.height);s=await state(page);ok('tapping a future star cannot replace drawing its path',s.stars.next===1&&s.speech.step===0&&s.stars.misses===0,s);
  await powerOff(page);s=await state(page);const ordinary=s.stars.corridor,offset=ordinary*1.22;ok('the first try on a picture is the game as designed',s.stars.ease===0&&s.stars.misses===0,s.stars);
  await bentStroke(page,offset);s=await state(page);ok('an ordinary first try rejects an off-route detour even if it ends on the right star',s.stars.next===1&&!s.stars.held&&s.speech.step===0,s);
  ok('one slip: the path glows twice as wide and the words stay kind',s.stars.misses===1&&s.stars.ease===1&&s.stars.corridor>=ordinary*1.9&&/so close|nearly/i.test(s.banner)&&!/miss|wrong|fail/i.test(s.banner),s);
  await page.screenshot({path:path.join(OUT,'sona-stars-ease1.png')});const eased=s.stars.corridor;await page.locator('#starsHelp').click();await sayWord(page);s=await state(page);ok('the help word is a bonus on top: never narrower, and the glowing path is on',s.stars.corridor>=eased&&s.stars.power>0,s.stars);await bentStroke(page,offset);s=await state(page);ok('the same near-miss gesture connects now',s.stars.next===2&&s.stars.completed===0&&s.speech.step===0,s);await page.screenshot({path:path.join(OUT,'sona-stars-tracing.png')});
  // help asked, then nobody speaks: the same move comes straight back, with no power
  await powerOff(page);let keep=(await state(page)).stars.next;await page.locator('#starsHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('help keeps the connections already drawn and holds the game',s.stars.paused&&s.stars.next===keep&&s.stars.completed===0&&await page.locator('#helpBack').isVisible(),s);
  await advance(page,13500);s=await state(page);ok('help then 13 s of silence: back to the same line, no power',s.speech.phase==='play'&&!s.speech.paused&&!s.stars.paused&&s.stars.active&&s.stars.next===keep&&s.stars.power===0&&s.speech.step===0&&!await page.locator('#helpBack').isVisible(),s);
  await page.locator('#starsHelp').click();await until(page,()=>__sayplay.listening);await page.locator('#helpBack').click();s=await state(page);ok('"Back to the game" gives the same line back at once, no power',s.speech.phase==='play'&&!s.stars.paused&&s.stars.next===keep&&s.stars.power===0&&s.speech.step===0&&!await page.locator('#starPen').isDisabled(),s);
  await page.locator('#starsHelp').click();await until(page,()=>__sayplay.listening);await page.evaluate(()=>__quiet.background());await advance(page,350);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();s=await state(page);ok('a page hidden during a help ask comes back to the same line, no power',s.speech.phase==='play'&&!s.stars.paused&&s.stars.next===keep&&s.stars.power===0&&s.speech.step===0,s);
  await grab(page);s=await state(page);await move(page,offsetMid(s.stars,0));ok('a different pointer cannot end the held tracing stroke',await page.locator('#starPen').evaluate(e=>{e.dispatchEvent(new PointerEvent('pointercancel',{pointerId:99}));return __stars.held;}));const beforeBg=(await state(page)).stars.next;await page.evaluate(()=>__quiet.background());await advance(page,350);await page.mouse.up();await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();s=await state(page);ok('an interrupted partial stroke releases without erasing finished connections',!s.stars.held&&!s.stars.paused&&s.stars.next===beforeBg&&s.speech.step===0,s);
  // the celebration beat: the chime and the drawn picture first, the next word about a second later, held by a pause
  for(let tries=0;tries<15&&!await doneDrawing(page,0);tries++){await grab(page);for(let n=0;n<12;n++){const t=await state(page);if(t.stars.completed>0||!t.stars.held)break;await move(page,t.stars.nodes[t.stars.next],22);await advance(page,40);}await page.mouse.up();await advance(page,60);}
  s=await state(page);ok('the finger finishes the first picture, then celebrates before the next word',s.stars.completed===1&&s.stars.celebrating&&s.speech.step===0,s);
  await advance(page,500);await page.evaluate(()=>__quiet.background());await advance(page,3000);s=await state(page);ok('a hidden page holds the celebration: the step waits',s.speech.step===0&&s.stars.celebrating,s);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await advance(page,300);s=await state(page);ok('the beat goes on after the pause, not from the start or skipped',s.speech.step===0&&s.stars.celebrating,s);
  ok('the step counts once, after the beat',await until(page,()=>__sayplay.step===1,3000)&&(await state(page)).speech.step===1);
  // a struggling child, no speech: wide wobbles off the path, every try
  if(!await sayWord(page))throw Error('Could not earn constellation 1');s=await state(page);ok('the next word leaves the new picture undrawn, back to the game as designed',s.stars.next===1&&s.stars.completed===1&&s.speech.step===1&&s.stars.ease===0&&s.stars.misses===0,s);
  await powerOff(page);{const segs=(await state(page)).stars.totalLinks,eases=[];let strokes=0;const px=60/(await state(page)).stars.width;while(strokes<segs+6&&!await doneDrawing(page,1)){await bentStroke(page,px);strokes++;eases.push((await state(page)).stars.ease);}
   s=await state(page);ok('a child who keeps wobbling 60 px off the path finishes the kite with no speech',s.stars.completed===2&&strokes<=segs+2&&s.stars.power===0,{strokes,segs,eases,s:s.stars});
   ok('the ladder rises: glow and arrow after 1 slip, almost anything after 2',eases[0]===1&&eases[1]===2,eases);}
  ok('the struggling child\'s picture still counts after the beat',await until(page,()=>__sayplay.step===2,3000));
  // the review's 24 px wobble, power expired: done within a few tries
  if(!await sayWord(page))throw Error('Could not earn constellation 2');await powerOff(page);{const segs=(await state(page)).stars.totalLinks;let strokes=0;const px=24/(await state(page)).stars.width;while(strokes<segs+6&&!await doneDrawing(page,2)){await bentStroke(page,px);strokes++;}s=await state(page);ok('a 24 px wobble finishes the house within a few tries, no speech',s.stars.completed===3&&strokes<=segs+1,{strokes,segs,s:s.stars});}
  await until(page,()=>__sayplay.step===3,3000);
  // finger work that never reaches a star: easier with time, never finished by time
  if(!await sayWord(page))throw Error('Could not earn constellation 3');await powerOff(page);{await grab(page);let t=(await state(page)).stars;const a=t.nodes[t.next-1],dx=6/t.width,seen=[];for(let i=0;i<46;i++){await move(page,{x:a.x+(i%2?dx:-dx),y:a.y},2);await advance(page,200);if(i===22||i===45)seen.push((await state(page)).stars.ease);}t=(await state(page)).stars;ok('about 4 s of finger work glows, about 8 s makes almost anything work',seen[0]===1&&seen[1]===2&&t.misses===0,{seen,t});
   await advance(page,3000);t=(await state(page)).stars;ok('no timer draws a line: the held pen waits for the finger',t.next===1&&t.held&&(await state(page)).speech.step===3,t);await page.mouse.up();await advance(page,60);}
  ok('real strokes finish picture 4',await finishStep(page,3),await state(page));
  if(!await sayWord(page))throw Error('Could not earn constellation 4');ok('real strokes finish picture 5',await finishStep(page,4),await state(page));
  await advance(page,3300);s=await state(page);ok('five hand-traced pictures finish the starry night',s.speech.phase==='end'&&s.speech.step===5&&s.stars.completed===5&&s.stars.won,s);const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));ok('star chimes and directions stay outside microphone turns',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);ok('the child hears how to draw between stars',/draw|trace/i.test(audio.lines.join('|'))&&/star/i.test(audio.lines.join('|')),audio.lines);ok('no line ever says missed, wrong, fail, score, points or correct',!audio.lines.some(l=>/\b(missed|wrong|fail|score|points|correct)\b/i.test(l)),audio.lines);await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-stars-finished.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='');await page.locator('#again').click();await advance(page,350);s=await state(page);ok('replay starts with an undrawn sky',s.speech.step===0&&s.stars.completed===0&&!s.stars.active&&s.stars.next===1&&s.stars.ease===0,s);ok('no runtime errors',errors.length===0,errors);await context.close();
});
const continuousPart=guard('continuous')(async ordinary=>{{const {page,context}=await fresh();await page.locator('#startBtn').click();for(let stage=0;stage<5;stage++){await sayWord(page);if(ordinary)await powerOff(page);const s=(await state(page)).stars;await grab(page);for(const node of s.nodes.slice(1))await move(page,node,28);await page.mouse.up();await advance(page,80);const done=await until(page,st=>__sayplay.step>st,3000,stage),end=await state(page);ok('one continuous '+(ordinary?'ordinary':'assisted')+' stroke can finish the actual '+s.picture,done&&end.stars.misses===0,end);if(!done)break;}await context.close();}
});
const keyboardPart=guard('keyboard')(async()=>{
  const {page,context}=await fresh();await page.locator('#startBtn').click();await sayWord(page);await ready(page);await page.locator('#starPen').focus();await page.keyboard.press('Space');let s=await state(page);const before={...s.stars.pen},a=s.stars.nodes[s.stars.next-1],n=s.stars.nodes[s.stars.next],dx=n.x-a.x,dy=(n.y-a.y)*s.stars.height/s.stars.width,key=Math.abs(dx)>=Math.abs(dy)?dx>0?'ArrowRight':'ArrowLeft':dy>0?'ArrowDown':'ArrowUp';ok('keyboard picks up the real tracing pen',s.stars.held,s);await page.keyboard.press(key);s=await state(page);ok('keyboard physically moves that pen',Math.abs(s.stars.pen.x-before.x)+Math.abs(s.stars.pen.y-before.y)>.001,s);await page.keyboard.press('Space');ok('keyboard release never skips a connection',!(await state(page)).stars.held&&(await state(page)).stars.next===1);await context.close();
});
const rectsOf=(p,ids)=>p.evaluate(ids=>({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,rects:ids.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};})}),ids);
const inside=(f,min=44)=>f.scroll<=f.height+1&&f.rects.every(r=>r.x>=0&&r.y>=0&&r.right<=f.width+.5&&r.bottom<=f.height+.5&&(r.id==='turnPanel'||r.id==='word'||(r.w>=min&&r.h>=min)));
const fallbackPart=guard('fallback')(async()=>{{const {page,context,errors}=await fresh({blockAssets:true});await page.locator('#startBtn').click();await sayWord(page);ok('missing paintings cannot prevent real star tracing',await finishStep(page,0));ok('fallback has no runtime errors',errors.length===0,errors);await context.close();}
});
// phones are portrait only (sona.js's portrait guard); an iPad turns
const VIEWS=[{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024},{width:1024,height:768}];
const fitPart=guard('fit')(async viewport=>{
   const {page,context,errors}=await fresh({viewport});await page.locator('#startBtn').click();
   for(let stage=0;stage<5;stage++){
    await until(page,()=>__sayplay.listening);const turn=await rectsOf(page,['turnPanel','hear','word']);ok('the word turn fits at '+viewport.width+'x'+viewport.height+' (picture '+(stage+1)+')',inside(turn),turn);
    if(!await sayWord(page))throw Error('Could not earn fitted constellation '+stage);await ready(page);
    const fit=await page.evaluate(()=>{const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};},c=document.getElementById('starsCanvas').getBoundingClientRect(),rects=['starPen','starsHelp','starsHearStep'].map(rect),cover=['starsHelp','starsHearStep','starsBanner','close','dots'].map(rect),px=__stars.nodes.map(n=>({x:c.x+n.x*c.width,y:c.y+n.y*c.height}));return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,rects,covered:px.filter(p=>cover.some(r=>p.x>r.x-8&&p.x<r.right+8&&p.y>r.y-8&&p.y<r.bottom+8)),nodes:__stars.nodes};});
    ok('all tracing controls and stars fit, uncovered, picture '+(stage+1)+' at '+viewport.width+'x'+viewport.height,inside(fit)&&fit.covered.length===0&&fit.nodes.every(n=>n.x>0&&n.x<1&&n.y>0&&n.y<1),fit);
    if(stage===0){await page.locator('#starsHelp').click();await until(page,()=>__sayplay.listening);const ask=await rectsOf(page,['turnPanel','hear','helpBack']);ok('the help ask and "Back to the game" fit at '+viewport.width+'x'+viewport.height,inside(ask),ask);await page.locator('#helpBack').click();}
    ok('real strokes finish fitted picture '+(stage+1),await finishStep(page,stage),await state(page));
   }
   await advance(page,3300);await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-stars-'+viewport.width+'x'+viewport.height+'.png')});ok('fit has no runtime errors',errors.length===0,errors);await context.close();
});
try{
 h=await gameHarness('stars',8359);fresh=(opts={})=>h.fresh({...opts,device:{age:'4',...opts.device}});
 const jobs=[];
 if(!part||part==='main')jobs.push(mainPart());
 if(!part||part==='continuous')jobs.push(continuousPart(false),continuousPart(true));
 if(!part||part==='keyboard')jobs.push(keyboardPart());
 if(!part||part==='fit')jobs.push(fallbackPart(),...VIEWS.map(v=>fitPart(v)));
 await Promise.all(jobs);
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
