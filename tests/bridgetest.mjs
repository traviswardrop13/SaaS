// Puzzle Bridge (STORY1, Day 3: The Puzzle Bridge): the word calls a stone up
// out of the river, the finger turns it (a tap, or the turn button) and slides
// it into its hole, and every round ends with the bridge whole, with no more
// speaking. Played through the real engine (sayplay.js) on a fake phone, with
// the clock paused: only advance() moves time, so a busy machine changes
// nothing.
//
// BRIDGE_PART=locked|main|tapdrag|struggle|little|help|motion|buddy|fit|standins|keyboard|shapes
// runs one part, or several with commas (every part, without it): the whole
// suite is several minutes, so run-all gives it in pieces. BRIDGE_PORT moves
// the test server. The harness plays under Reduce Motion; "motion" turns it
// off to watch the glides, the rising river and the drifting stones.
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {OUT,ROOT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
const PORT=Number(process.env.BRIDGE_PORT)||8381;
const part=process.env.BRIDGE_PART, run=n=>!part||part.split(',').includes(n);
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d===undefined?null:d).slice(0,1500)));}
const br=p=>p.evaluate(()=>{const s=window.__bridge;if(s)delete s.shapes;return s;});
const both=p=>p.evaluate(()=>{const s=window.__bridge;if(s)delete s.shapes;return{sp:window.__sayplay,br:s};});
const stepTo=(p,n)=>until(p,n=>__sayplay.step===n,3000,n);
const BAN=/\b(miss(ed|es)?|wrong|fail(ed)?|score|points?|correct|charge)\b/i;
const STEP_LINES=["Tap the stone to turn it. Then slide it into its hole!","Turn the stone the right way, then slide it in. Click!","This one looks like a boot! Turn it and fit it.","Look at the hole. Turn the stone to match, then slide it in.","The river is rising! Grab the stone from the water. Then turn it and fit it.","Catch the floating stone. Turn it, and slide it in!","Up high now! Turn the stone and fit it in the arch.","The last stone is the heart. Put it at the very top!"];
const LITTLE_LINES=["Slide the stone into the hole with the same shape!","Which hole is the same shape? Slide it in!","Find the hole that matches. Click!","Look, ducks! Slide the stone into its hole.","Find the same shape and slide it in!","The heart goes on top. Slide it in!"];
const INTRO_BIG='Say each word two times to call a stone up. Then turn it and slide it into its hole. Tap Calm river for extra help.';
const INTRO_LITTLE='Say each word two times to call a stone up. Then slide it into the hole with the same shape.';
const BIG_ORDER=['L','T','boot','arrow','step','hook','halfmoon','heart'],BIG_TAPS=[1,1,2,1,2,3,2,1],LITTLE_ORDER=['circle','square','triangle','star','moon','heart'];
// a child who has finished the first two stories: today is Day 3, this game's
const DAY3={'sona.quest.v1':JSON.stringify({i:0,last:13,done:'2020-01-01',s:2,ls:1,lk:'story'})};
const fresh=async(o={})=>{const r=await h.fresh(o);await r.page.clock.pauseAt(await r.page.evaluate(()=>Date.now()+500));await advance(r.page,200);return r;};
const littleOpts=(o={})=>({...o,device:{age:'4',...(o.device||{})}});
async function begin(page){await page.locator('#startBtn').click();return sayWord(page);}
// a tap on the stone: down and up in the same instant, without moving
async function tapStone(page){const s=await br(page);await page.mouse.move(s.pos.sx,s.pos.sy);await page.mouse.down();await page.mouse.up();}
// taps until the stone is the right way up
async function turnRight(page){for(let i=0;i<5;i++){const s=await br(page);if(s.need===0)return true;await tapStone(page);await advance(page,250);}return (await br(page)).need===0;}
// grab the stone where it is now (it may be swimming) and slide it to a point
async function dragTo(page,to,steps=8){const s=await br(page);await page.mouse.move(s.pos.sx,s.pos.sy);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps});await page.mouse.up();}
// a stone fitted the plain way: turned right, slid onto its hole
async function fit(page){
 if(!await until(page,()=>__bridge.pos&&['float','away','rise'].includes(__bridge.pos.state),3000))return false;
 if(!(await br(page)).little&&!await turnRight(page))return false;
 await until(page,()=>__bridge.pos&&['float','away'].includes(__bridge.pos.state),3000);
 const s=await br(page);await dragTo(page,{x:s.hole.sx,y:s.hole.sy});return (await br(page)).beat>0;
}
// somewhere on the board, above the water, as far as can be from every open
// hole and from the stone's own spot (a drop there is no try)
function farFrom(s,{water=false}={}){
 const b=s.board,keep=[...s.open.map(o=>({x:o.sx,y:o.sy})),{x:s.home?s.home.sx:s.pos.sx,y:s.home?s.home.sy:s.pos.sy}];let best=null,bd=-1;
 for(let x=b.left+40;x<=b.right-40;x+=10)for(let y=b.top+40;y<=b.bottom-40;y+=10){if(!water&&y>s.waterSy-50)continue;const d=Math.min(...keep.map(k=>Math.hypot(k.x-x,k.y-y)));if(d>bd){bd=d;best={x,y,d};}}
 return best;
}
// a finger trying for `secs`: it holds the stone and slides it about far
// from its hole (near: presses just beside the stone instead; cont: carries
// on from an earlier call, the finger still down), moving every 0.2 s, inside
// the 0.4 s that still counts as trying. The finger stays down.
async function wiggle(page,secs,{near=false,cont=null}={}){
 const s=await br(page);let at=cont;
 if(!at&&near){const side=s.pos.sx-s.pos.w*0.95>20?-1:1;at={x:s.pos.sx+side*s.pos.w*0.95,y:s.pos.sy};await page.mouse.move(at.x,at.y);await page.mouse.down();}
 else if(!at){at=farFrom(s);await page.mouse.move(s.pos.sx,s.pos.sy);await page.mouse.down();await page.mouse.move(at.x,at.y,{steps:6});}
 for(let i=0;i<Math.round(secs*5);i++){await page.mouse.move(at.x+18*Math.sin(i),at.y+12*Math.cos(i));await advance(page,200);}
 return at;
}
const quietAudit=p=>p.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length}));
// a game sound by its length: the page builds each one at 24 kHz
const SOUND_LEN={rise:14400,turn:6720,thunk:7680,bonk:7200,roar:24000,calm:15600,sparkle:19200};
const played=(p,n)=>p.evaluate(n=>__quiet.sounds.filter(s=>s.kind==='buf'&&s.len===n).length,SOUND_LEN[n]);
// the word's picture in the turn panel (crafted-words.js): its crop span
// must have a real box, or a child who can't read sees only the letters
const picBox=p=>p.evaluate(()=>{const c=document.querySelector('#pic .crafted-word-crop');if(!c)return null;const r=c.getBoundingClientRect();return{w:r.width,h:r.height,bg:getComputedStyle(c).backgroundImage};});
const inside=(r,b)=>r.x-r.w/2>=b.left-0.5&&r.x+r.w/2<=b.right+0.5&&r.y-r.w/2>=b.top-0.5&&r.y+r.w/2<=b.bottom+0.5;

try{
 h=await gameHarness('bridge',PORT);

 // ── locked: without Premium the story's game goes Home before any mic or sound ──
 if(run('locked')){
  const{page,context}=await h.fresh({device:{premium:false}});
  const home=await until(page,()=>location.pathname==='/today.html',8000);
  const q=await page.evaluate(()=>({req:__quiet.requests,snd:__quiet.soundsBefore+__quiet.sounds.length}));
  ok('locked: without Premium the page goes Home (today.html)',home&&!page.url().includes('arcade-bridge'),{url:page.url()});
  ok('locked: no microphone was asked for and no sound played first',q.req===0&&q.snd===0,q);
  await context.close();
 }

 // ── shapes: the eight stones, their starting turns, and that none looks the
 // same after a quarter turn (so "the right way up" is one answer) ──
 if(run('shapes')){
  const{page,context,errors}=await fresh();
  const all=await page.evaluate(()=>({shapes:window.__bridge.shapes,taps:window.__bridge.startTaps,order:window.__bridge.order}));
  ok('ages 5-8: the stones in order are L, T, boot, arrow, step, hook, half-moon, heart',JSON.stringify(all.order)===JSON.stringify(BIG_ORDER),all.order);
  ok('the starting turns table: 1, 1, 2, 1, 2, 3, 2, 1 taps',JSON.stringify(all.taps)===JSON.stringify(BIG_TAPS),all.taps);
  // each shape drawn on a 64-cell grid, turned 0, 1, 2, 3 quarters clockwise
  const inPoly=(x,y,pts)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const[xi,yi]=pts[i],[xj,yj]=pts[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;};
  const grid=(pts,q)=>{const a=q*Math.PI/2,c=Math.cos(a),s=Math.sin(a),r=pts.map(([x,y])=>[x*c-y*s,x*s+y*c]),out=[];for(let j=0;j<64;j++)for(let i=0;i<64;i++)out.push(inPoly((i+0.5)/64-0.5,(j+0.5)/64-0.5,r));return out;};
  const iou=(a,b)=>{let n=0,u=0;for(let i=0;i<a.length;i++){if(a[i]&&b[i])n++;if(a[i]||b[i])u++;}return n/u;};
  const same=[];for(const k of BIG_ORDER){const g0=grid(all.shapes[k],0);for(const q of[1,2,3]){const v=iou(g0,grid(all.shapes[k],q));if(v>0.9)same.push({k,q,v});}}
  ok('none of the eight looks the same after a quarter, a half or three quarter turn',same.length===0,same);
  ok('every shape fills its hole\'s box (its longer side is the box)',BIG_ORDER.concat(LITTLE_ORDER).every(k=>{const p=all.shapes[k],xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);return Math.abs(Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))-1)<0.01;}),null);
  ok('shapes: no runtime errors',errors.length===0,errors);await context.close();
  {const{page,context}=await fresh(littleOpts());const o=await page.evaluate(()=>window.__bridge.order);ok('ages 3-4: circle, square, triangle, star, moon, heart',JSON.stringify(o)===JSON.stringify(LITTLE_ORDER),o);await context.close();}
 }

 // ── main: ages 5-8, a whole round, every step by the finger ──
 if(run('main')){
  const{page,context,errors}=await fresh({device:{seed:DAY3}});
  ok('today is Day 3: the bridge story, not finished yet',await page.evaluate(()=>{const q=Sona.questToday();return q.kind==='story'&&q.state==='open'&&q.game==='bridge'&&!Sona.storyEnding('bridge').ok;}));
  await context.route(/\/adventure\.html/,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>ending</title>'}));
  const card=await page.evaluate(()=>({start:document.getElementById('startLine').textContent,title:document.getElementById('startTitle').textContent,dots:document.querySelectorAll('#dots i').length}));
  ok('the start card says how to play, ages 5-8',card.start===INTRO_BIG&&card.title==='Puzzle Bridge'&&card.dots===8,card);
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
  // before the word: the stones sleep, and a touch on the water only makes ripples
  {let s=await br(page);const y=Math.min(s.waterSy+30,s.board.bottom-10);await page.mouse.click(60,y);await page.mouse.click(s.board.right-60,y);await advance(page,300);s=await br(page);
   ok('before the word the stones sleep: nothing to turn or slide',!s.pos&&!s.active&&s.dones===0&&!s.turn.shown,s);
   ok('…and a touch on the water only makes ripples',s.ripples>=2&&!s.pos&&s.dones===0,{ripples:s.ripples});}
  // silence, and a whole listening window, earn nothing
  await advance(page,13000);let s=await both(page);
  ok('a whole quiet listening window earns nothing',s.sp.phase==='nudge'&&s.sp.step===0&&!s.br.pos&&s.br.dones===0,s.sp);
  const lines=await page.evaluate(()=>__quiet.speech.slice());
  ok('Echo explains the two sayings before the first word',lines.some(l=>l===card.start),lines);
  await page.locator('#micBtn').click();ok('two sayings call a stone up',await sayWord(page));await advance(page,400);
  s=await both(page);
  ok('the L stone floats beside its gap, turned the wrong way (one tap off)',s.br.pos&&s.br.shape==='L'&&s.br.need===1&&s.br.rot===3&&s.br.hole.shape==='L'&&s.sp.phase==='play'&&s.br.banner==='Up it comes!',s.br);
  ok('it rises with a hum and a splash',await played(page,'rise')>=1);
  ok('the stone and its hole are both on the board, side by side',inside({x:s.br.pos.sx,y:s.br.pos.sy,w:s.br.pos.w},s.br.board)&&inside({x:s.br.hole.sx,y:s.br.hole.sy,w:s.br.hole.w},s.br.board)&&Math.hypot(s.br.pos.sx-s.br.hole.sx,s.br.pos.sy-s.br.hole.sy)>(s.br.pos.w+s.br.hole.w)/2-4,s.br);
  ok('Echo says what to do once the stone is up (one line a step)',await until(page,l=>__quiet.speech.includes(l),3000,STEP_LINES[0]));
  {await advance(page,600);const n=await page.evaluate(l=>__quiet.speech.filter(x=>x===l).length,STEP_LINES[0]);await page.locator('#brHearStep').click();
   ok('"Hear what to do" says it again',await until(page,([l,n])=>__quiet.speech.filter(x=>x===l).length>n,3000,[STEP_LINES[0],n]));}
  // nothing fits without the finger
  await advance(page,3000);s=await br(page);ok('waiting fits nothing',s.beat===0&&s.dones===0&&s.pos.state==='float',s);
  // the wrong way up on its hole: a miss, it wobbles and comes back
  await dragTo(page,{x:s.hole.sx,y:s.hole.sy});s=await br(page);
  ok('on its hole the wrong way up: it wobbles, "Almost! Give it a turn", and it is a miss',s.beat===0&&s.misses===1&&s.pos.state==='wobble'&&s.banner==='Almost! Give it a turn',s);
  ok('…with a soft bonk',await played(page,'bonk')>=1);
  await advance(page,800);s=await br(page);ok('…then it bobs back up beside the hole',s.pos.state==='float'&&Math.hypot(s.pos.sx-s.home.sx,s.pos.sy-s.home.sy)<2,s.pos);
  // anywhere else: it just floats there, and drifts back after 2 s; no miss
  {const f=farFrom(s);await dragTo(page,f);await advance(page,100);s=await br(page);
   ok('dropped away from its hole it floats right there, and that is no miss',s.pos.state==='away'&&Math.hypot(s.pos.sx-f.x,s.pos.sy-f.y)<3&&s.misses===1,s.pos);
   await advance(page,1700);s=await br(page);ok('…for two seconds',s.pos.state==='away',s.pos);
   await advance(page,500);s=await br(page);ok('…then it drifts back beside the gap',s.pos.state==='float'&&Math.hypot(s.pos.sx-s.home.sx,s.pos.sy-s.home.sy)<2,s.pos);}
  // a tap turns it a quarter clockwise
  await tapStone(page);s=await br(page);ok('a tap turns it a quarter turn: now the right way up',s.rot===0&&s.need===0&&s.pos.state==='float',s);
  ok('…with a whoosh and a knock',await played(page,'turn')>=1);
  await advance(page,300);await dragTo(page,{x:s.hole.sx,y:s.hole.sy});s=await both(page);
  ok('slid onto its hole the right way up: it clicks in, the cheer first',s.br.beat>0&&s.sp.step===0&&s.br.banner==='Click!'&&s.br.pos.state==='seat',s.br);
  ok('…with a thunk',await played(page,'thunk')>=1);
  // a pause holds the cheer; the step counts once, after it
  await page.evaluate(()=>__quiet.background());await advance(page,3000);s=await both(page);
  ok('a hidden page holds the cheer: the step has not counted',s.sp.step===0&&s.br.paused&&s.br.beat>0,s);
  await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();
  await advance(page,1300);s=await both(page);ok('the step counts after the cheer',s.sp.step===1&&s.br.dones===1&&s.br.seated.join()==='L',s);
  await advance(page,1500);s=await both(page);ok('…and counts once',s.sp.step===1&&s.br.dones===1,s);
  ok('the camera is on the next gap, the T, while its word is asked',s.br.stage===1&&s.br.hole.shape==='T'&&Math.abs(s.br.camera.x-s.br.camera.target.x)<1&&inside({x:s.br.hole.sx,y:s.br.hole.sy,w:s.br.hole.w},s.br.board),s.br.camera);
  // the rest of the stones, each by the finger
  for(let i=1;i<8;i++){
   if(!await sayWord(page))throw Error('word '+(i+1));await advance(page,300);s=await br(page);
   ok('step '+(i+1)+': the '+BIG_ORDER[i]+' stone comes up '+BIG_TAPS[i]+' tap'+(BIG_TAPS[i]>1?'s':'')+' off',s.stage===i&&s.shape===BIG_ORDER[i]&&s.need===BIG_TAPS[i]&&s.hole.shape===BIG_ORDER[i],{shape:s.shape,need:s.need});
   if(i===4){
    ok('word 5, the twist: the river rises and the waterfall roars',s.twist&&Math.abs(s.water.line-s.anchors.water.risen)<0.5&&s.banner==='The river is rising!'&&await played(page,'roar')===1,s.water);
   }
   if(i>=4)ok('step '+(i+1)+': from word 5 on the stone comes up in the risen water (still, under Reduce Motion)',Math.abs(s.water.line-s.anchors.water.risen)<0.5&&Math.abs(s.pos.y-(s.anchors.water.risen-10))<1&&!s.pos.drifting,s.pos);
   ok('step '+(i+1)+': the finger fits it',await fit(page),await br(page));
   if(i===7){s=await br(page);ok('the heart clicks in at the very top, and the camera pulls back to the whole bridge',s.camera.pulledBack&&s.camera.s<s.views[0].s*0.5,s.camera);}
   ok('step '+(i+1)+': the step counts',await stepTo(page,i+1));
  }
  await until(page,()=>__sayplay.phase==='end',6000);s=await both(page);
  ok('the bridge is whole: eight stones in, and the round ends',s.sp.phase==='end'&&s.br.seated.join()===BIG_ORDER.join()&&s.br.finale,s.br.seated);
  ok('the finale shows the whole bridge on the screen',s.br.views.length===8&&await page.evaluate(()=>{const s=window.__bridge,c=s.camera,b=s.board,mid=(b.top+b.bottom)/2;return s.anchors.big.every(p=>{const x=(p.x-c.x)*c.s+innerWidth/2,y=(p.y-c.y)*c.s+mid;return x>0&&x<innerWidth&&y>b.top&&y<b.bottom;});}));
  ok('…with a sparkle as the spirals light up',await played(page,'sparkle')>=1);
  const end=await page.evaluate(()=>{const g=document.getElementById('goHome'),a=document.getElementById('again');return{title:document.getElementById('endTitle').textContent,sub:document.getElementById('endSub').textContent,go:g.textContent,cls:g.className,shown:getComputedStyle(g).display!=='none',again:a.hidden||getComputedStyle(a).display==='none',ending:Sona.storyEnding('bridge').ok};});
  ok('the end card: "The bridge is whole again!", "Every stone is back where it belongs."',end.title==='The bridge is whole again!'&&end.sub==='Every stone is back where it belongs.',end);
  ok('…one teal button, "See what happens!", and no Play again',end.go==='See what happens!'&&end.cls==='btn'&&end.shown&&end.again,end);
  ok('the round finished the day: the story\'s ending is open',end.ending,end);
  const q=await quietAudit(page);ok('no sound ever plays into an open microphone',q.leaks===0&&q.live===0&&q.overlap===0,q);
  s=await br(page);const unkind=s.banners.filter(b=>BAN.test(b));ok('every banner is kind',s.banners.length>=5&&unkind.length===0,{banners:s.banners});
  const nav=page.waitForRequest(/\/adventure\.html\?part=end&story=bridge$/,{timeout:4000}).then(()=>true,()=>false);
  await page.locator('#goHome').click();ok('"See what happens!" opens the story\'s ending',await nav);
  ok('no runtime errors',errors.length===0,errors);
  await context.close();
  // what the game file may never touch, and what it says
  const js=readFileSync(path.join(ROOT,'bridge.js'),'utf8'),code=js.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  const bad=['logAttempt','bumpReps','gameRep','addCoins','mintCoins','awardNextSticker','awardRandomSticker','localStorage','sessionStorage','recordRung','Math.random'].filter(w=>code.includes(w));
  ok('the game file never writes practice, reps, coins, stickers or storage, and rolls no dice',bad.length===0,bad);
  const said=[...code.matchAll(/"([^"\n]{12,})"/g)].map(m=>m[1]).filter(t=>/[a-z] [a-z]/i.test(t)&&!/^\/|rgba|#|webp/.test(t));
  ok('nothing the game shows or says is unkind',said.filter(t=>BAN.test(t)).length===0,said.filter(t=>BAN.test(t)));
  ok('Echo\'s directions are the spec\'s, one a step, each under 120 characters',STEP_LINES.concat(LITTLE_LINES).every(l=>js.includes(JSON.stringify(l))&&l.length<=120),null);
  const html=readFileSync(path.join(ROOT,'arcade-bridge.html'),'utf8');
  ok('the page hands back to the story and has no Play again',/exit: replay \? undefined : \{ href: "\/adventure\.html\?part=end&story=bridge", label: "See what happens!" \}/.test(html)&&/again: replay \? undefined : false/.test(html)&&/Bridge\.setLittle\(little\)/.test(html),null);
  ok('FOUND1: only ?again=1, and only once this story is finished (Sona.storyReplay), makes it a replay from Home\'s row (Play again and Back home, its own event); any other replay address goes Home',/var replay = location\.search === "\?again=1";/.test(html)&&/if \(replay && !\(window\.Sona && Sona\.storyReplay && Sona\.storyReplay\("bridge"\)\)\) \{ document\.body\.hidden = true; location\.replace\("\/today\.html"\); return; \}/.test(html)&&/track\(replay \? "story game replayed" : "game opened", \{ game: "bridge" \}\)/.test(html));
  ok('the page asks the two start lines, word for word',html.includes(JSON.stringify(INTRO_BIG))&&html.includes(JSON.stringify(INTRO_LITTLE)),null);
 }

 // ── tapdrag: a tap turns (under 12 px, under 300 ms), anything else slides ──
 if(run('tapdrag')){
  const{page,context,errors}=await fresh();await begin(page);await advance(page,400);
  let s=await br(page);const p0={x:s.pos.sx,y:s.pos.sy},r0=s.rot;
  await page.mouse.move(p0.x,p0.y);await page.mouse.down();await page.mouse.move(p0.x+6,p0.y+5,{steps:3});await page.mouse.up();s=await br(page);
  ok('a finger that moves under 12 px, quickly, is a tap: the stone turns and stays put',s.rot===(r0+1)%4&&Math.hypot(s.pos.sx-p0.x,s.pos.sy-p0.y)<1&&s.pos.state==='float',{rot:s.rot,pos:s.pos});
  await page.mouse.move(p0.x,p0.y);await page.mouse.down();await page.mouse.move(p0.x,p0.y-16,{steps:4});await page.mouse.up();s=await br(page);
  ok('a finger that moves 16 px is a slide: the stone moves and does not turn',s.rot===(r0+1)%4&&Math.abs(s.pos.sy-(p0.y-16))<1.5&&s.pos.state==='away'&&s.misses===0,{rot:s.rot,pos:s.pos});
  await advance(page,2700);s=await br(page);ok('…and drifts back',s.pos.state==='float',s.pos);
  await page.mouse.move(p0.x,p0.y);await page.mouse.down();await advance(page,350);await page.mouse.up();s=await br(page);
  ok('a press held 350 ms without moving is not a tap: no turn, and no try',s.rot===(r0+1)%4&&s.misses===0&&s.beat===0,{rot:s.rot,misses:s.misses});
  await advance(page,2700);
  // a touch screen's tap
  s=await br(page);const r1=s.rot;
  await page.evaluate(([x,y])=>{const c=document.getElementById('bridgeCanvas');c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:5,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,bubbles:true}));c.dispatchEvent(new PointerEvent('pointerup',{pointerId:5,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,bubbles:true}));},[s.pos.sx,s.pos.sy]);
  s=await br(page);ok('a finger\'s tap on a touch screen turns it too',s.rot===(r1+1)%4,s.rot);
  // the turn button
  await advance(page,300);s=await br(page);const t=s.turn;
  ok('the round turn button shows beside the stone, at least 56 px',t.shown&&t.w>=56&&t.h>=56,t);
  const over=(a,b)=>!(a.x+a.w<=b.x0||b.x1<=a.x||a.y+a.h<=b.y0||b.y1<=a.y);
  const sb={x0:s.pos.sx-s.pos.w/2,x1:s.pos.sx+s.pos.w/2,y0:s.pos.sy-s.pos.w/2,y1:s.pos.sy+s.pos.w/2},hb={x0:s.hole.sx-s.hole.w/2,x1:s.hole.sx+s.hole.w/2,y0:s.hole.sy-s.hole.w/2,y1:s.hole.sy+s.hole.w/2};
  ok('…clear of the stone and of its hole, near the stone, and on the board',!over(t,sb)&&!over(t,hb)&&Math.hypot(t.x+t.w/2-s.pos.sx,t.y+t.h/2-s.pos.sy)<s.pos.w*1.1&&t.x>=0&&t.x+t.w<=s.board.right&&t.y>=s.board.top&&t.y+t.h<=s.board.bottom,{t,pos:s.pos,hole:s.hole,board:s.board});
  const r2=s.rot,n2=await played(page,'turn');await page.locator('#brTurn').click();s=await br(page);
  ok('the turn button turns the stone a quarter, with the same whoosh',s.rot===(r2+1)%4&&await played(page,'turn')>n2,{r2,rot:s.rot});
  // and it is out of the way while a finger slides the stone
  await page.mouse.move(s.pos.sx,s.pos.sy);await page.mouse.down();await page.mouse.move(s.pos.sx+30,s.pos.sy,{steps:4});await advance(page,100);
  ok('while the stone is held the turn button steps aside',!(await br(page)).turn.shown);await page.mouse.up();
  // a second finger or a palm while one finger holds the stone (22 Oct 2026:
  // it took the stone's finger, the stone stayed held for good and the round
  // could never end). Both orders of lifting.
  await advance(page,2700);
  for(const order of [[7,8],[8,7]]){
   s=await br(page);const a={x:s.pos.sx,y:s.pos.sy},y2=Math.min(s.waterSy+30,s.board.bottom-10),b={x:a.x>s.board.right/2?60:s.board.right-60,y:y2};
   await page.evaluate(([a,b,order])=>{const c=document.getElementById('bridgeCanvas'),ev=(t,id,p)=>c.dispatchEvent(new PointerEvent(t,{pointerId:id,pointerType:'touch',isPrimary:id===7,clientX:p.x,clientY:p.y,bubbles:true}));
    ev('pointerdown',7,a);ev('pointermove',7,{x:a.x+15,y:a.y});ev('pointermove',7,{x:a.x+30,y:a.y});ev('pointerdown',8,b);
    for(const id of order)ev('pointerup',id,id===7?{x:a.x+30,y:a.y}:b);},[a,b,order]);
   s=await br(page);ok('a second touch while a finger holds the stone ('+(order[0]===7?'the stone\'s finger':'the second finger')+' lifts first): the stone is let go, never held for good',s.pos.state!=='held'&&s.misses===0,s.pos);
   await advance(page,2700);s=await br(page);const r3=s.rot;await tapStone(page);s=await br(page);
   ok('…and a finger can pick it up again: a tap turns it',s.rot===(r3+1)%4,{r3,rot:s.rot,state:s.pos.state});
   await advance(page,300);
  }
  ok('tapdrag: no runtime errors',errors.length===0,errors);await context.close();
 }

 // ── struggle: the ladder climbs with misses and with seconds of trying, and
 // every step ends with no more speaking ──
 if(run('struggle')){
  {const{page,context,errors}=await fresh();await page.locator('#startBtn').click();
   for(let i=0;i<8;i++){
    const tag='5-8, step '+(i+1);
    if(!await sayWord(page))throw Error('word '+(i+1));await advance(page,400);
    const mics=await page.evaluate(()=>__quiet.requests);let s=await br(page);
    if(i===0){
     // three times on its hole the wrong way up: one rung each
     for(let n=1;n<=3;n++){
      s=await br(page);await dragTo(page,{x:s.hole.sx,y:s.hole.sy});s=await br(page);
      ok(tag+': the wrong way up on its hole is a miss ('+n+')',s.misses===n&&s.ladder===n&&s.beat===0,s);
      if(n===1)ok(tag+': after one miss a faint ghost shows the stone the right way up in its hole',s.ghost&&!s.arrow,s);
      if(n===2)ok(tag+': after two the hole glows and a curved arrow shows the way to turn, and how many taps are left',s.glow&&s.arrow&&s.tapsLeft===1,s);
      if(n===3)ok(tag+': after three a drop on or near its hole turns it into place',s.snap,s);
      await advance(page,800);
     }
     s=await br(page);ok(tag+': still the wrong way up',s.need===1,s.need);
     await dragTo(page,{x:s.hole.sx+s.hole.w*0.75,y:s.hole.sy+s.hole.w*0.3});s=await br(page);
     ok(tag+': dropped near the hole the wrong way, it turns into place as it falls: the finger made the drop',s.beat>0&&s.rot===0,s);
    }else if(i===1){
     // seconds of trying: the finger holds the stone and slides it about
     await wiggle(page,4.2);s=await br(page);ok(tag+': 4 s of trying: the ghost',s.ladder===1&&s.ghost&&s.beat===0&&s.misses===0,s);
     await page.mouse.up();s=await br(page);ok(tag+': let go far from its hole: no try',s.misses===0&&s.pos.state==='away',s.pos);
     await wiggle(page,4);s=await br(page);ok(tag+': 8 s: the hole glows and the arrow shows the turn',s.ladder===2&&s.glow&&s.arrow&&s.tapsLeft===1,s);
     await page.mouse.up();await wiggle(page,4);s=await br(page);ok(tag+': 12 s: a drop near its hole turns it in',s.ladder===3&&s.snap&&s.beat===0,s);
     // (letting go is the last 0.4 s of trying; after it, nothing)
     await page.mouse.up();await advance(page,500);s=await br(page);
     const was=s.idle;await advance(page,3000);s=await br(page);ok(tag+': waiting adds nothing',s.idle===was&&s.beat===0&&s.dones===1,{was,idle:s.idle});
     await dragTo(page,{x:s.hole.sx-s.hole.w*0.6,y:s.hole.sy-s.hole.w*0.6});s=await br(page);ok(tag+': the finger drops it near: in it goes',s.beat>0&&s.rot===0,s);
    }else if(i===4){
     s=await br(page);await dragTo(page,{x:s.hole.sx,y:s.hole.sy});await advance(page,800);s=await br(page);
     ok(tag+': a stone grabbed from the water and dropped the wrong way is a miss, then it floats still',s.misses===1&&s.ladder===1&&!s.pos.drifting,s);
     ok(tag+': it fits',await fit(page),await br(page));
    }else ok(tag+': the finger fits it',await fit(page),await br(page));
    ok(tag+': the step counts with no more speaking',await stepTo(page,i+1)&&await page.evaluate(m=>__quiet.requests===m,mics));
   }
   await until(page,()=>__sayplay.phase==='end',6000);ok('5-8: the struggling child still builds the whole bridge',(await both(page)).sp.phase==='end');
   ok('5-8 struggle: no runtime errors',errors.length===0,errors);await context.close();}
  {const{page,context,errors}=await fresh(littleOpts());await page.locator('#startBtn').click();
   for(let i=0;i<6;i++){
    const tag='3-4, step '+(i+1);
    if(!await sayWord(page))throw Error('little word '+(i+1));await advance(page,400);
    const mics=await page.evaluate(()=>__quiet.requests);let s=await br(page);
    if(i===0){
     const o=s.open[1];await dragTo(page,{x:o.sx,y:o.sy});s=await br(page);
     ok(tag+': into the other hole it bounces back: "That hole is a different shape!", a miss',s.misses===1&&s.beat===0&&s.banner==='That hole is a different shape!',s);
     ok(tag+': after the first miss the right hole glows and an arrow points to it',s.ladder===1&&s.glow&&s.arrow,s);
     await advance(page,800);s=await br(page);await dragTo(page,{x:s.open[1].sx,y:s.open[1].sy});await advance(page,800);s=await br(page);
     ok(tag+': after the second, a drop anywhere near the bridge slides it in',s.misses===2&&s.ladder===2&&s.slide,s);
     const f=farFrom(s);await dragTo(page,f);s=await br(page);ok(tag+': dropped well away from the holes, above the water: it slides into the right hole',s.beat>0,{f,s});
    }else if(i===1){
     // one long drag (a lift from 4 s on would already slide it in)
     const at=await wiggle(page,2.1);s=await br(page);ok(tag+': 2 s of dragging: the glow and the arrow',s.ladder===1&&s.glow&&s.arrow,s);
     await wiggle(page,2,{cont:at});s=await br(page);ok(tag+': 4 s: a drop near the bridge slides in',s.ladder===2&&s.slide,s);
     await wiggle(page,2,{cont:at});await page.mouse.move(at.x+20,at.y);await advance(page,700);s=await br(page);
     ok(tag+': 6 s: the drag carries the stone to the right hole\'s edge, and nothing fits while the finger is down',s.ladder===3&&s.carry&&s.pos.state==='held'&&Math.hypot(s.pos.sx-s.hole.sx,s.pos.sy-s.hole.sy)<s.hole.w*0.75&&s.beat===0,{pos:s.pos,hole:s.hole});
     await page.mouse.up();s=await br(page);ok(tag+': the finger lets go: in it slides',s.beat>0,s);
    }else if(i===2){
     // trying beside the stone counts too; then a drag anywhere carries it
     await wiggle(page,6.1,{near:true});await page.mouse.up();s=await br(page);ok(tag+': 6 s of trying beside the stone: any drag carries it',s.ladder===3&&s.carry&&s.beat===0&&s.pos.state!=='held',s);
     const f=farFrom(s);await page.mouse.move(f.x,f.y);await page.mouse.down();await page.mouse.move(f.x+30,f.y+10,{steps:4});await advance(page,800);s=await br(page);
     ok(tag+': a drag far from the stone carries it to the right hole\'s edge, and nothing fits while the finger is down',s.pos.state==='held'&&Math.hypot(s.pos.sx-s.hole.sx,s.pos.sy-s.hole.sy)<s.hole.w*0.75&&s.beat===0,{pos:s.pos,hole:s.hole});
     await page.mouse.up();s=await br(page);ok(tag+': the finger lets go: in it slides',s.beat>0,s);
    }else{
     if(i===3)ok(tag+': a duck family paddles on the near river',s.ducks&&!!s.duckBox);
     if(i===5)ok(tag+': the heart is alone, at the top',s.open.length===1&&s.hole.shape==='heart',s.open);
     ok(tag+': the finger fits it',await fit(page),await br(page));
    }
    ok(tag+': the step counts with no more speaking',await stepTo(page,i+1)&&await page.evaluate(m=>__quiet.requests===m,mics));
   }
   await until(page,()=>__sayplay.phase==='end',6000);const s=await both(page);ok('3-4: the bridge is whole',s.sp.phase==='end'&&s.br.seated.join()===LITTLE_ORDER.join(),s.br.seated);
   ok('3-4 struggle: no runtime errors',errors.length===0,errors);await context.close();}
 }

 // ── little: ages 3-4 play six stones, the right way round, two holes open ──
 if(run('little')){
  const{page,context,errors}=await fresh(littleOpts());
  await context.route(/\/adventure\.html/,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>ending</title>'}));
  const card=await page.evaluate(()=>({start:document.getElementById('startLine').textContent,dots:document.querySelectorAll('#dots i').length}));
  ok('3-4: the start card and six words',card.start===INTRO_LITTLE&&card.dots===6,card);
  await page.locator('#startBtn').click();
  for(let i=0;i<6;i++){
   if(!await sayWord(page))throw Error('little word '+(i+1));await advance(page,400);
   let s=await br(page);
   ok('3-4, step '+(i+1)+': Echo says what to do',await until(page,l=>__quiet.speech.includes(l),3000,LITTLE_LINES[i]));
   if(i===3){
    // "Look, ducks!": the duck family is drawn on the board, under the open
    // holes and the stone, so the child can see what Echo points to
    s=await br(page);const d=s.duckBox,b=s.board,st=s.home||s.pos,tops=[...s.open.map(o=>o.sy+o.w/2),...(st&&s.pos?[st.sy+s.pos.w/2]:[])];
    ok('3-4: when Echo says "Look, ducks!" the ducks are drawn inside the board',s.ducks&&!!d&&d.w>40&&d.h>15&&d.x>=b.left-0.5&&d.x+d.w<=b.right+0.5&&d.y>=b.top-0.5&&d.y+d.h<=b.bottom+0.5,{d,b});
    ok('…below the open holes and the stone, clear of both',!!d&&tops.length===3&&tops.every(t=>t<=d.y),{d,tops});
   }
   ok('3-4, step '+(i+1)+': the '+LITTLE_ORDER[i]+' comes up the right way round, with '+(i<5?'two holes':'one hole')+' open',s.shape===LITTLE_ORDER[i]&&s.rot===0&&s.need===0&&s.open.length===(i<5?2:1)&&s.open[0].shape===LITTLE_ORDER[i]&&(i===5||s.open[1].shape===LITTLE_ORDER[i+1])&&!s.twist,{shape:s.shape,open:s.open.map(o=>o.shape)});
   if(i===0){
    await tapStone(page);s=await br(page);ok('3-4: no turning: a tap does not turn the stone, and there is no turn button',s.rot===0&&!s.turn.shown,s);
    const both2=[s.hole,s.open[1]].every(o=>inside({x:o.sx,y:o.sy,w:o.w},s.board))&&inside({x:s.pos.sx,y:s.pos.sy,w:s.pos.w},s.board);ok('3-4: both open holes and the stone are on the board',both2,s);
   }
   ok('3-4, step '+(i+1)+': the finger slides it into the hole with the same shape',await fit(page),await br(page));
   ok('3-4, step '+(i+1)+': the step counts',await stepTo(page,i+1));
  }
  await until(page,()=>__sayplay.phase==='end',6000);const end=await page.evaluate(()=>({title:document.getElementById('endTitle').textContent,go:document.getElementById('goHome').textContent}));
  ok('3-4: the same end card',end.title==='The bridge is whole again!'&&end.go==='See what happens!',end);
  const q=await quietAudit(page);ok('3-4: no sound ever plays into an open microphone',q.leaks===0&&q.live===0&&q.overlap===0,q);
  ok('3-4: no runtime errors',errors.length===0,errors);await context.close();
 }

 // ── help: Calm river asks the word again; silence or "Back to the game"
 // gives the move back with no power; heard, the same stone gets the power ──
 if(run('help')){
  const{page,context,errors}=await fresh();await begin(page);await advance(page,400);
  let s=await both(page);const was=s.br;
  ok('the Calm river pill is ready in play',await page.locator('#brHelp').isEnabled());
  const same=x=>x.sp.phase==='play'&&!x.sp.paused&&!x.br.paused&&x.br.active&&x.br.power===0&&x.sp.step===0&&x.br.stage===0&&x.br.shape==='L'&&x.br.rot===was.rot&&x.br.dones===0;
  await page.locator('#brHelp').click();await until(page,()=>__sayplay.listening);s=await both(page);
  ok('asking for help holds the same stone and asks the word',s.br.paused&&s.sp.step===0&&await page.locator('#helpBack').isVisible(),s);
  await advance(page,13500);s=await both(page);ok('help, then 13 s of silence: the same stone, no power, playing again',same(s)&&await page.locator('#brHelp').isEnabled(),s);
  await page.locator('#brHelp').click();await until(page,()=>__sayplay.listening);await page.locator('#helpBack').click();await advance(page,100);s=await both(page);
  ok('"Back to the game" gives the same stone back at once, no power',same(s),s);
  await page.locator('#brHelp').click();await until(page,()=>__sayplay.listening);await page.evaluate(()=>__quiet.background());await advance(page,300);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await advance(page,100);s=await both(page);
  ok('a help ask cut off by the lock screen gives the same stone back',same(s),s);
  await page.locator('#brHelp').click();ok('the help word can be said',await sayWord(page));await advance(page,200);s=await both(page);
  ok('heard: a calm river on the same stone, still, with the ghost showing',s.br.power>0&&s.br.calm&&s.br.ghost&&!s.br.pos.drifting&&s.br.stage===0&&s.br.shape==='L'&&s.br.rot===was.rot&&s.sp.step===0,s.br);
  ok('the pill is greyed while the river is calm, with its bar showing',await page.locator('#brHelp').isDisabled()&&await page.locator('#brPower').isVisible());
  await advance(page,10300);s=await br(page);ok('it lasts ten seconds, then the pill is ready again',s.power===0&&!s.calm&&!s.ghost&&await page.locator('#brHelp').isEnabled(),s);
  ok('the stone is still fitted by the finger',await fit(page));ok('the step counts',await stepTo(page,1));
  const q=await quietAudit(page);ok('help asks never sound into an open microphone',q.leaks===0&&q.live===0&&q.overlap===0,q);
  ok('help: no runtime errors',errors.length===0,errors);await context.close();
 }

 // ── motion: with Reduce Motion off, the camera glides, the stone rises and
 // turns, the river rises, a stone in the water drifts, and stops ──
 if(run('motion')){
  const{page,context,errors}=await fresh();
  await page.emulateMedia({reducedMotion:'no-preference'});await page.reload({waitUntil:'domcontentloaded'});await until(page,()=>!!window.__bridge,3000);await advance(page,200);
  let s=await br(page);ok('motion: the game sees Reduce Motion off',s.still===false,s.still);
  // (with motion on, the start card's pop-in never settles on a paused clock: force the tap)
  await page.locator('#startBtn').click({force:true});if(!await sayWord(page))throw Error('motion word 1');await advance(page,150);s=await br(page);
  ok('the stone rises from the river',s.pos.state==='rise'&&s.pos.sy>s.home.sy+5,s.pos);
  await advance(page,700);s=await br(page);ok('…and floats beside its gap',s.pos.state==='float'&&Math.abs(s.pos.sy-s.home.sy)<1,s.pos);
  await tapStone(page);await advance(page,80);s=await br(page);ok('a turn spins, a fifth of a second a quarter',s.pos.turning&&s.rot===0,s.pos);
  await advance(page,200);s=await br(page);ok('…and stops',!s.pos.turning,s.pos);
  await dragTo(page,{x:s.hole.sx,y:s.hole.sy});await until(page,()=>__sayplay.step===1,3000);await advance(page,150);s=await br(page);
  ok('the camera glides to the next gap (0.6 s)',s.camera.moving&&s.camera.k>0&&s.camera.k<0.5,s.camera);
  await advance(page,600);s=await br(page);ok('…and arrives',!s.camera.moving&&Math.abs(s.camera.x-s.camera.target.x)<0.5,s.camera);
  for(let i=1;i<4;i++){if(!await sayWord(page))throw Error('motion word '+(i+1));await advance(page,800);if(!await fit(page))throw Error('motion fit '+(i+1));await stepTo(page,i+1);}
  if(!await sayWord(page))throw Error('motion word 5');await advance(page,1000);s=await br(page);
  ok('word 5: the river is rising, slowly',s.twist&&s.water.k>0.2&&s.water.k<0.8,s.water);
  await advance(page,1500);s=await br(page);ok('…to its new line',s.water.k===1,s.water);
  // the stone swims a slow loop near the bank, and never drifts away
  const at=[];for(let t=0;t<16;t++){s=await br(page);at.push({x:s.pos.x,y:s.pos.y,d:s.pos.drifting});await advance(page,500);}
  const xs=at.map(a=>a.x),ys=at.map(a=>a.y),cx=s.anchors.big[4].drift.x,cy=s.anchors.water.risen-10;
  ok('the stone swims a slow loop in the water',at.every(a=>a.d)&&Math.max(...xs)-Math.min(...xs)>30&&Math.max(...ys)-Math.min(...ys)>5,{xs:[Math.min(...xs),Math.max(...xs)],ys:[Math.min(...ys),Math.max(...ys)]});
  ok('…and never drifts away',at.every(a=>Math.abs(a.x-cx)<=27&&a.y>=cy-1&&a.y<=cy+15),{cx,cy,at:at.slice(0,4)});
  // Calm river stops it; once the calm is over it swims again
  await page.locator('#brHelp').click({force:true});if(!await sayWord(page))throw Error('motion help');await advance(page,300);s=await br(page);
  const still1={x:s.pos.x,y:s.pos.y};await advance(page,2000);s=await br(page);
  ok('Calm river: the water goes glassy and the stone floats still',s.calm&&!s.pos.drifting&&Math.hypot(s.pos.x-still1.x,s.pos.y-still1.y)<0.5,s.pos);
  await advance(page,8500);s=await br(page);ok('…for ten seconds, then it swims again',!s.calm&&s.pos.drifting,s.pos);
  // four seconds of trying to catch it: it floats still
  // (beside it, on whichever side the screen has room)
  {const f0=await br(page),side=f0.pos.sx-f0.pos.w>20?-1:1;await page.mouse.move(f0.pos.sx+side*f0.pos.w,f0.pos.sy-f0.pos.w*0.2);await page.mouse.down();for(let i=0;i<21;i++){const q=await br(page);await page.mouse.move(q.pos.sx+side*q.pos.w*0.9+6*Math.sin(i),q.pos.sy-q.pos.w*0.2);await advance(page,200);}await page.mouse.up();}
  s=await br(page);const p1={x:s.pos.x,y:s.pos.y};await advance(page,1500);const s2=await br(page);
  ok('after 4 s of trying to catch it, the stone floats still',s.ladder===1&&!s2.pos.drifting&&Math.hypot(s2.pos.x-p1.x,s2.pos.y-p1.y)<0.5,{l:s.ladder,pos:s2.pos});
  ok('it is caught and fitted',await fit(page));await stepTo(page,5);
  for(let i=5;i<8;i++){if(!await sayWord(page))throw Error('motion word '+(i+1));await advance(page,800);if(!await fit(page))throw Error('motion fit '+(i+1));
   if(i===7){await advance(page,300);s=await br(page);ok('the heart clicks in: the camera pulls back, gliding',s.camera.pulledBack&&s.camera.moving,s.camera);}
   await stepTo(page,i+1);}
  await advance(page,1300);s=await br(page);ok('…to the whole bridge',!s.camera.moving&&s.camera.s<s.views[0].s*0.5,s.camera);
  await until(page,()=>__sayplay.phase==='end',6000);ok('motion: the round ends',(await both(page)).sp.phase==='end');
  ok('motion: no runtime errors',errors.length===0,errors);await context.close();
 }

 // ── buddy: the child's own buddy stands on the bank and cheers each fit ──
 if(run('buddy')){
  const look=p=>p.evaluate(()=>{const b=document.getElementById('brBuddy'),e=document.getElementById('brEcho'),r=x=>{const q=x.getBoundingClientRect();return{x:q.x,y:q.y,right:q.right,bottom:q.bottom};};
   return{src:b.getAttribute('src')||'',badge:b.classList.contains('badge'),alt:b.getAttribute('alt'),hidden:b.getAttribute('aria-hidden'),pe:getComputedStyle(b).pointerEvents,epe:getComputedStyle(e).pointerEvents,echo:e.getAttribute('src'),b:r(b),e:r(e),help:r(document.getElementById('brHelp')),hear:r(document.getElementById('brHearStep')),shown:getComputedStyle(b).display!=='none'};});
  const apart=(a,b)=>a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y;
  for(const who of ['fox','dragon']){
   const seed=who==='dragon'?{'sona.profile.v1':JSON.stringify({childName:'Mia',childAge:'7',focusSounds:['R'],onboarded:true,earlyAdopter:true,character:'dragon',voiceOn:true,soundOn:true,volume:0.6})}:undefined;
   const{page,context,errors}=await fresh({device:seed?{seed}:{}});await begin(page);await advance(page,400);
   let v=await look(page);
   ok(who+': the buddy stands on the bank in its rest pose',v.shown&&v.src.includes('buddy-'+who+'-rest.webp')&&!v.badge,v);
   ok(who+': the buddy is decoration: alt="", aria-hidden, no pointer, and Echo takes no pointer either',v.alt===''&&v.hidden==='true'&&v.pe==='none'&&v.epe==='none',v);
   ok(who+': never over a button',apart(v.b,v.help)&&apart(v.b,v.hear)&&apart(v.e,v.help)&&apart(v.e,v.hear),v);
   await turnRight(page);await advance(page,300);const s=await br(page);await dragTo(page,{x:s.hole.sx,y:s.hole.sy});v=await look(page);
   ok(who+': on a fit the buddy cheers with its own picture, and Echo cheers',v.src.includes('buddy-'+who+'-cheer.webp')&&/echo-cheer/.test(v.echo),v);
   await advance(page,1100);v=await look(page);ok(who+': then both stand again',v.src.includes('buddy-'+who+'-rest.webp')&&/echo-welcome/.test(v.echo),v);
   ok(who+': no runtime errors',errors.length===0,errors);await context.close();
  }
  {const seed={'sona.profile.v1':JSON.stringify({childName:'Mia',childAge:'7',focusSounds:['R'],onboarded:true,earlyAdopter:true,character:'dragon',voiceOn:true,soundOn:true,volume:0.6})};
   const{page,context,errors}=await fresh({device:{seed}});await context.route(/buddy-dragon-(rest|cheer)\.webp/,r=>r.abort());await page.reload({waitUntil:'domcontentloaded'});
   // polled from here: the page's clock is paused, so nothing in it ticks
   let fell=false;for(let n=0;n<30&&!fell;n++){fell=await page.evaluate(()=>{const b=document.getElementById('brBuddy');return !!b&&b.classList.contains('badge')&&/buddy-dragon/.test(b.getAttribute('src')||'');});if(!fell)await new Promise(r=>setTimeout(r,200));}
   ok('a buddy picture that will not load falls back to its round badge',fell,await page.evaluate(()=>document.getElementById('brBuddy').outerHTML));
   ok('fallback: no runtime errors',errors.length===0,errors);await context.close();}
 }

 // ── fit: four screens, both ages, every step's view, the word turn, a help ask ──
 if(run('fit')){
  const rects=(p,ids)=>p.evaluate(ids=>ids.map(id=>{const e=document.getElementById(id),r=e?e.getBoundingClientRect():{x:0,y:0,right:0,bottom:0,width:0,height:0};return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,shown:!!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'};}),ids);
  for(const viewport of[{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024}]){
   const tag=viewport.width+'x'+viewport.height,within=r=>r.shown&&r.w>0&&r.x>=-.5&&r.y>=-.5&&r.right<=viewport.width+.5&&r.bottom<=viewport.height+.5,big=r=>r.w>=44&&r.h>=44;
   for(const age of['7','4']){
    const who=tag+(age==='4'?' (3-4)':'');
    const{page,context,errors}=await fresh({viewport,device:{age}});
    let r=await rects(page,['startBtn']);ok(who+': the start card\'s button fits',r.every(within)&&big(r[0]),r);
    await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
    r=await rects(page,['turnPanel','hear','word','brBanner']);ok(who+': the word turn fits, with the banner above it',r.every(within)&&big(r[1]),r);
    {const pb=await picBox(page);ok(who+': the word\'s picture shows beside the word (a real box, not 0x0)',!!pb&&Math.max(pb.w,pb.h)>40&&Math.min(pb.w,pb.h)>0&&/url\(/.test(pb.bg),pb);}
    if(!await sayWord(page))throw Error('fit word');await advance(page,400);
    const m=await page.evaluate(()=>{const ids=['brHelp','brHearStep','brBanner','brEcho','brBuddy'],R={};ids.forEach(id=>{const q=document.getElementById(id).getBoundingClientRect();R[id]={x:q.x,y:q.y,right:q.right,bottom:q.bottom,w:q.width,h:q.height};});
     const s=window.__bridge;return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,R,views:s.views,board:s.board,little:s.little};});
    const ctl=[m.R.brHelp,m.R.brHearStep],apart=(a,b)=>a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y;
    ok(who+': no page scroll either way',m.scroll<=m.height+1&&m.sw<=m.width+1,m);
    ok(who+': both buttons on screen and at least 44 px',ctl.every(c=>c.x>=0&&c.y>=0&&c.right<=m.width&&c.bottom<=m.height&&c.w>=44&&c.h>=44),m.R);
    ok(who+': Echo and the buddy stand clear of the buttons, below the board',[m.R.brEcho,m.R.brBuddy].every(e=>ctl.every(c=>apart(e,c))&&e.y>=m.board.bottom-4),m.R);
    // every step's view: the hole(s) at least 30% of the board's width, the
    // stone at least 34%, all of it (and the loop a stone swims) on the board,
    // and the turn button beside it on the board, clear of the hole
    const bad=[],small=[];
    m.views.forEach(v=>{
     v.holes.forEach(o=>{if(o.w<0.3*m.board.w)small.push({step:v.step,hole:o.w/m.board.w});if(!inside({x:o.x,y:o.y,w:o.w},m.board))bad.push({step:v.step,hole:o});});
     if(v.stone.w<0.34*m.board.w)small.push({step:v.step,stone:v.stone.w/m.board.w});
     const st=v.stone;if(!(st.x-st.w/2-st.ex>=m.board.left-0.5&&st.x+st.w/2+st.ex<=m.board.right+0.5&&st.y-st.w/2-st.ey>=m.board.top-0.5&&st.y+st.w/2+st.ey<=m.board.bottom+0.5))bad.push({step:v.step,stone:st});
     if(v.turn){const t=v.turn,hh=v.holes[0];if(!(t.x-t.r>=0&&t.x+t.r<=m.width&&t.y-t.r>=m.board.top-0.5&&t.y+t.r<=m.board.bottom+0.5)||(Math.abs(t.x-hh.x)<hh.w/2+t.r&&Math.abs(t.y-hh.y)<hh.w/2+t.r))bad.push({step:v.step,turn:t});}
    });
    ok(who+': every hole is at least 30% of the board\'s width and every stone at least 34%, at every step',small.length===0&&m.views.length===(age==='4'?6:8),small);
    ok(who+': at every step the open holes, the stone (and its loop) and the turn button are all on the board',bad.length===0,{bad,board:m.board});
    if(age==='4'){
     // from step 4 the ducks paddle along the board's bottom edge: on the
     // board at every size, under every open hole and the stone
     const dv=m.views.filter(v=>v.step>=3),off=[];
     dv.forEach(v=>{const d=v.ducks;if(!d){off.push({step:v.step,none:true});return;}const tops=[...v.holes.map(o=>o.y+o.w/2),v.stone.y+v.stone.w/2];
      if(!(d.x0>=m.board.left-0.5&&d.x1<=m.board.right+0.5&&d.y>=m.board.top-0.5&&d.bottom<=m.board.bottom+0.5&&tops.every(t=>t<=d.y)))off.push({step:v.step,d,tops});});
     ok(who+': steps 4-6: the ducks\' whole path is on the board, below the open holes and the stone',dv.length===3&&off.length===0,{off,board:m.board});
    }
    r=await rects(page,['brTurn']);ok(who+(age==='4'?': no turn button for ages 3-4':': the turn button is on screen and at least 56 px'),age==='4'?!r[0].shown:(within(r[0])&&r[0].w>=56&&r[0].h>=56),r);
    await page.locator('#brHelp').click();await until(page,()=>__sayplay.listening);r=await rects(page,['turnPanel','hear','helpBack','word']);
    ok(who+': a help ask fits, with a big enough "Back to the game"',r.every(within)&&big(r[1])&&big(r[2]),r);await page.locator('#helpBack').click();await advance(page,100);
    await page.screenshot({path:path.join(OUT,'sona-bridge-'+viewport.width+(age==='4'?'-little':'')+'.png')});
    ok(who+': no runtime errors',errors.length===0,errors);await context.close();
   }
  }
 }

 // ── stand-ins: every painted picture blocked, the whole round still plays ──
 if(run('standins')){
  const{page,context,errors}=await fresh(littleOpts({blockAssets:true}));await begin(page);await advance(page,400);
  let s=await br(page);ok('with every picture blocked, none is ready and the canyon is drawn',!s.artReady&&Object.values(s.art).every(v=>v==='failed'),s.art);
  for(let i=0;i<6;i++){if(i&&!await sayWord(page))throw Error('standin word');await advance(page,400);ok('stand-ins, stone '+(i+1)+': fitted by the finger',await fit(page));ok('stand-ins, stone '+(i+1)+': counts',await stepTo(page,i+1));}
  await until(page,()=>__sayplay.phase==='end',6000);ok('stand-ins: the round ends',(await both(page)).sp.phase==='end');
  await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-bridge-standins.png')});
  ok('stand-ins: no runtime errors',errors.length===0,errors);await context.close();
  {const{page,context,errors}=await fresh({blockAssets:true});await begin(page);await advance(page,400);ok('stand-ins, ages 5-8: the L is turned and fitted',await fit(page));ok('…and counts',await stepTo(page,1));ok('stand-ins, ages 5-8: no runtime errors',errors.length===0,errors);await context.close();}
 }

 // ── keyboard: the arrows slide the stone, Space turns it, Enter lets go ──
 if(run('keyboard')){
  {const{page,context,errors}=await fresh();await begin(page);await advance(page,400);
   await page.locator('#brStone').focus();let s=await br(page);
   ok('the stone can take the keyboard\'s focus',await page.evaluate(()=>document.activeElement&&document.activeElement.id==='brStone'));
   const p0={...s.pos},r0=s.rot;await page.keyboard.press('ArrowLeft');s=await br(page);ok('an arrow slides the stone',s.pos.sx<p0.sx-5&&s.pos.state==='held',{p0,p:s.pos});
   await page.keyboard.press(' ');s=await br(page);ok('Space turns it a quarter',s.rot===(r0+1)%4&&s.pos.state==='held',s.rot);
   for(let n=0;n<40;n++){s=await br(page);const dx=s.hole.sx-s.pos.sx,dy=s.hole.sy-s.pos.sy,step=s.hole.w*0.25;if(Math.abs(dx)<step*0.6&&Math.abs(dy)<step*0.6)break;await page.keyboard.press(Math.abs(dx)>=Math.abs(dy)?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp'));}
   await advance(page,1500);s=await br(page);ok('a stone held over its hole by the keyboard fits nothing by itself',s.beat===0&&s.pos.state==='held',s);
   await page.keyboard.press('Enter');s=await br(page);ok('Enter lets go: it clicks in',s.beat>0,s);
   ok('…and the step counts',await stepTo(page,1));
   ok('keyboard: no runtime errors',errors.length===0,errors);await context.close();}
  {const{page,context,errors}=await fresh(littleOpts());await begin(page);await advance(page,400);
   await page.locator('#brStone').focus();
   for(let n=0;n<40;n++){const s=await br(page);const dx=s.hole.sx-s.pos.sx,dy=s.hole.sy-s.pos.sy,step=s.hole.w*0.25;if(Math.abs(dx)<step*0.6&&Math.abs(dy)<step*0.6)break;await page.keyboard.press(Math.abs(dx)>=Math.abs(dy)?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp'));}
   await page.keyboard.press(' ');const s=await br(page);ok('3-4: Space lets go too: the circle slides in',s.beat>0,s);
   ok('3-4 keyboard: no runtime errors',errors.length===0,errors);await context.close();}
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
