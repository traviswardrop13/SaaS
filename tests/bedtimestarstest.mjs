// Bedtime Stars (ages 3-4): the word starts each picture, the finger draws
// it, and a child who keeps slipping off the path still finishes, with no
// speech (the ladder in public/stars.js). Every wait is on published state
// (window.__stars, window.__sayplay) under Playwright's fake clock.
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {OUT,ROOT} from './_env.mjs';
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
// A SKY FULL OF LITTLE PICTURES: each picture was wiped when the next began,
// and the end card's "A sky full of little pictures!" sat over a sky with
// one. warmIn counts the gold pixels (a drawn star or line, never the blue
// sky or the purple clouds) the canvas really holds in a published rect.
const warmIn=(p,r)=>p.evaluate(r=>{const c=document.getElementById('starsCanvas'),k=c.width/__stars.width,W=__stars.width,H=__stars.height,d=c.getContext('2d').getImageData(Math.round(r.x*W*k),Math.round(r.y*H*k),Math.max(1,Math.round(r.w*W*k)),Math.max(1,Math.round(r.h*H*k))).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>110&&d[i]>d[i+2]+50)n++;return n;},r);
const meets=(a,b,pad=0)=>a.x<b.x+b.w+pad&&b.x<a.x+a.w+pad&&a.y<b.y+b.h+pad&&b.y<a.y+a.h+pad;
// a kept picture sits clear of every star of the picture being traced (a
// star's own glow included: 12 px), and the kept ones never meet each other
// the banner, the buttons and the top bar, as rects of the canvas
const uiRects=p=>p.evaluate(()=>{const c=document.getElementById('starsCanvas').getBoundingClientRect();return['starsHelp','starsHearStep','starsBanner','close','dots'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:(r.x-c.x)/c.width,y:(r.y-c.y)/c.height,w:r.width/c.width,h:r.height/c.height};});});
const keptClear=s=>s.kept.every((r,i)=>s.nodes.every(n=>!meets(r,{x:n.x,y:n.y,w:0,h:0},12/s.width))&&s.kept.every((q,j)=>i===j||!meets(r,q)));
// a careful child: straight strokes from star to star until the picture is
// drawn, then the celebration beat, then the step counts
async function finishStep(p,stage){
 for(let tries=0;tries<15&&!await doneDrawing(p,stage);tries++){await grab(p);for(let n=0;n<12;n++){const s=await state(p);if(s.stars.completed>stage||!s.stars.held)break;const next=s.stars.nodes[s.stars.next];if(!next)break;await move(p,next,22);await advance(p,40);}await p.mouse.up();await advance(p,60);}
 return until(p,st=>__sayplay.step>st,4000,stage);
}
// expire the word's 10 s glowing path while the child is in play
const powerOff=async p=>{await ready(p);await advance(p,11000);return (await state(p)).stars.power===0;};
// Where the glowing corridor of the line being traced reaches into a kept
// picture's slot, that part of the kept picture is cut away: no gold pixel
// of it there (warm), over every pixel of a slot the corridor reaches
// (seen). Which pictures meet depends on the round, so the fit parts check
// it at every picture and the suite counts that it really happened.
const cutAt=p=>p.evaluate(()=>{const s=__stars,c=document.getElementById('starsCanvas'),k=c.width/s.width,W=s.width,H=s.height,a={x:s.currentSegment.from.x*W,y:s.currentSegment.from.y*H},b={x:s.currentSegment.to.x*W,y:s.currentSegment.to.y*H},R=s.corridor*W+6,g=c.getContext('2d');let warm=0,seen=0;
  const near=(px,py)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((px-a.x)*dx+(py-a.y)*dy)/(dx*dx+dy*dy))),ex=a.x+dx*t-px,ey=a.y+dy*t-py;return Math.hypot(ex,ey)<R;};
  for(const r of s.kept){const x0=Math.round(r.x*W),y0=Math.round(r.y*H),w=Math.round(r.w*W),h=Math.round(r.h*H),d=g.getImageData(Math.round(x0*k),Math.round(y0*k),Math.round(w*k),Math.round(h*k)).data,rw=Math.round(w*k);for(let j=0;j<Math.round(h*k);j++)for(let i=0;i<rw;i++){if(!near(x0+i/k,y0+j/k))continue;seen++;const o=(j*rw+i)*4;if(d[o]>110&&d[o]>d[o+2]+50)warm++;}}return{warm,seen,kept:s.kept.length};});
let cutSeen=0;
const seeded=(p,seed)=>p.evaluate(seed=>{let x=seed;Math.random=()=>{x=(x*16807)%2147483647;return (x-1)/2147483646;};Stars.reset();},seed);
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
  await advance(page,13000);ok('…a quiet window first makes Echo say the word again, once, and listen again: nothing earned',await page.evaluate(()=>__sayplay.phase==='turn'&&__sayplay.step===0&&__sayplay.said===0));await advance(page,14000);s=await state(page);ok('two quiet listening windows earn nothing: the mic waits for a tap',s.speech.phase==='nudge'&&!s.stars.active&&s.stars.next===1&&s.speech.step===0,s);
  await page.locator('#micBtn').click();ok('two sayings earn the first star picture',await sayWord(page));await advance(page,1600);s=await state(page);ok('speech and idle animation do not draw a picture',s.stars.next===1&&s.stars.completed===0&&s.speech.step===0,s);const slot0=s.stars.slots[0],empty0=slot0&&await warmIn(page,slot0);let b=await page.locator('#starsCanvas').boundingBox(),future=s.stars.nodes[s.stars.next];await page.mouse.click(b.x+future.x*b.width,b.y+future.y*b.height);s=await state(page);ok('tapping a future star cannot replace drawing its path',s.stars.next===1&&s.speech.step===0&&s.stars.misses===0,s);
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
  {const k=s.stars.kept,warm=slot0&&await warmIn(page,slot0);ok('the finished first picture stays in the sky, small, in its slot beside the new picture',k.length===1&&k[0].picture===s.stars.round[0]&&slot0&&k[0].x===slot0.x&&k[0].y===slot0.y&&k[0].w<s.stars.box.w*.4&&warm>empty0+15&&keptClear(s.stars),{kept:k,slot0,empty0,warm});}
  await powerOff(page);{const segs=(await state(page)).stars.totalLinks,eases=[];let strokes=0;const px=60/(await state(page)).stars.width;while(strokes<segs+6&&!await doneDrawing(page,1)){await bentStroke(page,px);strokes++;eases.push((await state(page)).stars.ease);}
   s=await state(page);ok('a child who keeps wobbling 60 px off the path finishes the second picture with no speech',s.stars.completed===2&&strokes<=segs+2&&s.stars.power===0,{strokes,segs,eases,s:s.stars});
   ok('the ladder rises: glow and arrow after 1 slip, almost anything after 2',eases[0]===1&&eases[1]===2,eases);}
  ok('the struggling child\'s picture still counts after the beat',await until(page,()=>__sayplay.step===2,3000));
  // the review's 24 px wobble, power expired: done within a few tries
  if(!await sayWord(page))throw Error('Could not earn constellation 2');await powerOff(page);{const segs=(await state(page)).stars.totalLinks;let strokes=0;const px=24/(await state(page)).stars.width;while(strokes<segs+6&&!await doneDrawing(page,2)){await bentStroke(page,px);strokes++;}s=await state(page);ok('a 24 px wobble finishes the third picture within a few tries, no speech',s.stars.completed===3&&strokes<=segs+1,{strokes,segs,s:s.stars});}
  await until(page,()=>__sayplay.step===3,3000);
  // finger work that never reaches a star: easier with time, never finished by time
  if(!await sayWord(page))throw Error('Could not earn constellation 3');await powerOff(page);{await grab(page);let t=(await state(page)).stars;const a=t.nodes[t.next-1],dx=6/t.width,seen=[];for(let i=0;i<46;i++){await move(page,{x:a.x+(i%2?dx:-dx),y:a.y},2);await advance(page,200);if(i===22||i===45)seen.push((await state(page)).stars.ease);}t=(await state(page)).stars;ok('about 4 s of finger work glows, about 8 s makes almost anything work',seen[0]===1&&seen[1]===2&&t.misses===0,{seen,t});
   await advance(page,3000);t=(await state(page)).stars;ok('no timer draws a line: the held pen waits for the finger',t.next===1&&t.held&&(await state(page)).speech.step===3,t);await page.mouse.up();await advance(page,60);}
  ok('real strokes finish picture 4',await finishStep(page,3),await state(page));
  if(!await sayWord(page))throw Error('Could not earn constellation 4');await ready(page);
  {const cut=await cutAt(page);ok('no kept picture is drawn where the line being traced glows (the fifth picture)',cut.kept===4&&cut.warm===0,cut);}
  ok('real strokes finish picture 5',await finishStep(page,4),await state(page));
  await advance(page,3300);s=await state(page);ok('five hand-traced pictures finish the starry night',s.speech.phase==='end'&&s.speech.step===5&&s.stars.completed===5&&s.stars.won,s);
  {const g=s.stars.gathered,sky=s.stars.sky,warm=[];for(const r of g)warm.push(await warmIn(page,r));
   ok('the end\'s sky really is full of little pictures: all five, side by side in the open sky',g.map(r=>r.picture).join()===s.stars.round.join()&&g.every((r,i)=>r.x>=sky.x-1e-6&&r.y>=sky.y-1e-6&&r.x+r.w<=sky.right+1e-6&&r.y+r.h<=sky.bottom+1e-6&&r.w<s.stars.box.w&&g.every((q,j)=>i===j||!meets(r,q)))&&warm.every(n=>n>40),{g,sky,warm});}
  const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));ok('star chimes and directions stay outside microphone turns',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);ok('the child hears how to draw between stars',/draw|trace/i.test(audio.lines.join('|'))&&/star/i.test(audio.lines.join('|')),audio.lines);ok('no line ever says missed, wrong, fail, score, points or correct',!audio.lines.some(l=>/\b(missed|wrong|fail|score|points|correct)\b/i.test(l)),audio.lines);await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-stars-finished.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='');await page.locator('#again').click();await advance(page,350);s=await state(page);ok('replay starts with an undrawn sky',s.speech.step===0&&s.stars.completed===0&&!s.stars.active&&s.stars.next===1&&s.stars.ease===0&&s.stars.kept.length===0&&s.stars.gathered.length===0,s);ok('no runtime errors',errors.length===0,errors);await context.close();
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
   // on the smallest phone the round ends on the crown (the only big picture
   // not drawn yet), whose first line runs past the kept first picture
   const {page,context,errors}=await fresh({viewport,device:viewport.width===320?{seed:{'sona.stars.v1':JSON.stringify({got:['fish','heart','cat']})}}:undefined});await seeded(page,viewport.width*7+viewport.height);await page.locator('#startBtn').click();
   for(let stage=0;stage<5;stage++){
    await until(page,()=>__sayplay.listening);const turn=await rectsOf(page,['turnPanel','hear','word']);ok('the word turn fits at '+viewport.width+'x'+viewport.height+' (picture '+(stage+1)+')',inside(turn),turn);
    if(!await sayWord(page))throw Error('Could not earn fitted constellation '+stage);await ready(page);
    const fit=await page.evaluate(()=>{const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};},c=document.getElementById('starsCanvas').getBoundingClientRect(),rects=['starPen','starsHelp','starsHearStep'].map(rect),cover=['starsHelp','starsHearStep','starsBanner','close','dots'].map(rect),px=__stars.nodes.map(n=>({x:c.x+n.x*c.width,y:c.y+n.y*c.height}));return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,rects,covered:px.filter(p=>cover.some(r=>p.x>r.x-8&&p.x<r.right+8&&p.y>r.y-8&&p.y<r.bottom+8)),nodes:__stars.nodes};});
    if(stage){const cut=await cutAt(page);cutSeen+=cut.seen;ok('no kept picture is drawn where the line being traced glows, picture '+(stage+1)+' at '+viewport.width+'x'+viewport.height,cut.warm===0,cut);}
    ok('all tracing controls and stars fit, uncovered, picture '+(stage+1)+' at '+viewport.width+'x'+viewport.height,inside(fit)&&fit.covered.length===0&&fit.nodes.every(n=>n.x>0&&n.x<1&&n.y>0&&n.y<1),fit);
    {const st=(await state(page)).stars,ui=await uiRects(page);ok('every finished picture stays in the sky, clear of the new one and the buttons, picture '+(stage+1)+' at '+viewport.width+'x'+viewport.height,st.kept.length===stage&&keptClear(st)&&st.kept.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=1&&r.y+r.h<=1&&ui.every(u=>!meets(r,u))),{kept:st.kept,ui});}
    if(stage===0){await page.locator('#starsHelp').click();await until(page,()=>__sayplay.listening);const ask=await rectsOf(page,['turnPanel','hear','helpBack']);ok('the help ask and "Back to the game" fit at '+viewport.width+'x'+viewport.height,inside(ask),ask);await page.locator('#helpBack').click();}
    ok('real strokes finish fitted picture '+(stage+1),await finishStep(page,stage),await state(page));
   }
   await advance(page,3300);
   {const g=(await state(page)).stars.gathered,ui=await uiRects(page),warm=[];for(const r of g)warm.push(await warmIn(page,r));ok('all five pictures gather in the open sky at '+viewport.width+'x'+viewport.height,g.length===5&&g.every((r,i)=>r.x>=0&&r.y>=0&&r.x+r.w<=1&&r.y+r.h<=1&&ui.every(u=>!meets(r,u))&&g.every((q,j)=>i===j||!meets(r,q)))&&warm.every(n=>n>20),{g,ui,warm});}
   await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-stars-'+viewport.width+'x'+viewport.height+'.png')});ok('fit has no runtime errors',errors.length===0,errors);await context.close();
});
// ── STARS2, the rebuild (Travis, 11 Nov 2026: "yes build bedtime stars"):
// the word starts the picture and nothing else; five of twelve pictures,
// easy first, never-drawn first; a surprise until drawn; Echo says how once
// a visit; every picture drawn kept for the child
const ONE=p=>p.evaluate(()=>{const s=__stars;return s;});
async function drawWhole(p,stage){const s=(await state(p)).stars;await grab(p);for(const node of s.nodes.slice(1))await move(p,node,28);await p.mouse.up();await advance(p,80);return until(p,st=>__sayplay.step>st,3000,stage);}
const rebuildPart=guard('rebuild')(async()=>{
  const src=readFileSync(path.join(ROOT,'stars.js'),'utf8'),sona=readFileSync(path.join(ROOT,'sona.js'),'utf8'),page0=readFileSync(path.join(ROOT,'arcade-stars.html'),'utf8');
  ok('the pictures drawn are each child\'s own: a per-child key, read and written through Sona.kkey',/"sona\.stars\.v1",/.test(sona.slice(sona.indexOf('PER_KID'),sona.indexOf('PER_KID')+6000))&&page0.includes('Sona.kkey("sona.stars.v1")'));
  ok('the word starts the picture: no line in the game widens the path for it, and none names a picture before it is drawn',!/STEP_LINES/.test(src)&&/function go\(\)\{power=0;/.test(src)&&/onWord:function\(index\)\{[^\n]*?go\(\);/.test(src));
  const rounds=[];
  for(const seed of [11,2024,777]){const {page,context,errors}=await fresh();await seeded(page,seed);const s=await ONE(page);rounds.push(s.round.join());
   ok('seed '+seed+': five different pictures, two easy, two middle, one big, the fewest lines first in each',new Set(s.round).size===5&&s.catalog.length===12&&s.tiers.join()==='1,1,2,2,3'&&s.lines.every((n,i)=>!i||s.tiers[i]!==s.tiers[i-1]||n>=s.lines[i-1])&&s.lines.every((n,i)=>n>=3&&n<=7),s);
   ok('seed '+seed+' has no runtime errors',errors.length===0,errors);await context.close();}
  ok('three rounds, three different skies',new Set(rounds).size===3,rounds);
  // never-drawn pictures come first: a child who has drawn the tent and the
  // flag gets the kite, then one of those two; a big one never drawn
  {const {page,context,errors}=await fresh({device:{seed:{'sona.stars.v1':JSON.stringify({got:['tent','flag','fish','heart','cat','pluto','tent',7]})}}});const s=await ONE(page);
   ok('a picture never drawn comes before one drawn, and junk in the record is ignored',s.round.includes('kite')&&s.round[4]==='crown'&&s.got.join()==='tent,flag,fish,heart,cat',s);
   const row=await page.evaluate(()=>[...document.querySelectorAll('#skyRow svg')].map(e=>({p:e.dataset.picture,f:e.dataset.found})));
   ok('the start card shows every picture, the ones drawn in gold and the rest still to find',row.length===12&&row.filter(r=>r.f==='1').map(r=>r.p).sort().join()==='cat,fish,flag,heart,tent'&&!await page.locator('#skyRow').isHidden()&&/Pictures drawn: .*More pictures to find\./.test(await page.locator('#skyRow').getAttribute('aria-label')),row);
   await context.close();}
  // a whole round: the word, the surprise, the picture coming alive, the
  // collection kept at once, and the end card naming the one new picture
  {const all=['tent','flag','kite','house','boat','rocket','mountain','star','fish','heart','cat','crown'],have=all.filter(n=>n!=='heart');
   const {page,context,errors}=await fresh({device:{seed:{'sona.stars.v1':JSON.stringify({got:have})}}});await page.locator('#startBtn').click();
   ok('the word earns the first picture',await sayWord(page));await ready(page);let s=await state(page);
   ok('…and nothing else: no glowing wide path, the path as designed, and a banner that keeps the picture a surprise',s.stars.power===0&&s.stars.ease===0&&s.banner==='Follow the stars. What will it be?'&&!s.stars.round.some(n=>new RegExp('\\b'+n+'\\b','i').test(s.banner)),s);
   const corridor0=s.stars.corridor;
   for(let stage=0;stage<5;stage++){
    if(stage){ok('the word earns picture '+(stage+1),await sayWord(page));await ready(page);s=await state(page);ok('picture '+(stage+1)+' starts with no wider path',s.stars.power===0&&s.stars.ease===0&&s.stars.corridor===corridor0,s.stars);}
    const name=(await state(page)).stars.picture,done=await drawWhole(page,stage);
    const k=await page.evaluate(()=>JSON.parse(localStorage.getItem('sona.stars.v1')||'null'));
    ok('picture '+(stage+1)+' ('+name+') is drawn and kept in the child\'s sky at once',done&&k&&k.got.includes(name),{done,k});
   }
   s=await state(page);
   ok('a finished picture comes alive: its details all in (at once under Reduce Motion)',s.stars.alive===1&&s.stars.completedPatterns.every(Boolean),s.stars);
   const lines=await page.evaluate(()=>__quiet.speech),howto=lines.filter(l=>/glowing star\. Slide along the path to draw/.test(l));
   ok('Echo says how to draw once a visit, and never names a picture before it is drawn',howto.length===1&&!lines.some(l=>/let's make|little (tent|kite|house|boat|fish)|one more picture/i.test(l)),lines);
   await advance(page,3300);s=await state(page);
   ok('the end card names the one picture drawn for the first time',s.speech.phase==='end'&&await page.locator('#endTitle').textContent()==='You drew a heart!'&&s.stars.fresh.join()==='heart',{title:await page.locator('#endTitle').textContent(),fresh:s.stars.fresh});
   const end=await page.evaluate(()=>[...document.querySelectorAll('#skyRowEnd svg')].map(e=>({p:e.dataset.picture,f:e.dataset.found,n:e.classList.contains('new')})));
   ok('…and its row: every picture drawn now, the new one ringed',end.length===12&&end.every(r=>r.f==='1')&&end.filter(r=>r.n).map(r=>r.p).join()==='heart'&&/Every picture drawn!/.test(await page.locator('#skyRowEnd').getAttribute('aria-label')),end);
   await page.locator('#again').click();await advance(page,350);s=await state(page);
   ok('another round: a new sky, the collection kept, the end card back to its plain words',s.stars.completed===0&&s.stars.got.length===12&&s.stars.fresh.length===0&&s.stars.round.length===5,s.stars);
   ok('the whole round has no runtime errors',errors.length===0,errors);await context.close();}
});
try{
 h=await gameHarness('stars',8359);fresh=async(opts={})=>{const f=await h.fresh({...opts,device:{age:'4',...opts.device}});if(opts.unpark===false)return f;const now=await f.page.evaluate(()=>Date.now());await f.page.clock.pauseAt(now+1000);return f;}; // paused, as puppytest: only advance() moves the stars
 const jobs=[];
 if(!part||part==='main')jobs.push(mainPart());
 if(!part||part==='continuous')jobs.push(continuousPart(false),continuousPart(true));
 if(!part||part==='keyboard')jobs.push(keyboardPart());
 if(!part||part==='rebuild')jobs.push(rebuildPart());
 if(!part||part==='fit')jobs.push(fallbackPart(),...VIEWS.map(v=>fitPart(v)));
 await Promise.all(jobs);
 if(!part||part==='fit')ok('the cut-away was really tested: a traced line\'s glow reached a kept picture\'s slot somewhere in the fit parts',cutSeen>0,{cutSeen});
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
