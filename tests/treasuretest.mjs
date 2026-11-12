import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,sea:window.__treasure}));
async function drawRoute(p,points,steps=12){const b=await p.locator('#seaCanvas').boundingBox(),s=(await state(p)).sea,map=s.map,coords=[s.boat,...points],screen=v=>map.rotated?{x:b.x+map.x+v.y*map.w,y:b.y+map.y+(1-v.x)*map.h}:{x:b.x+map.x+v.x*map.w,y:b.y+map.y+v.y*map.h};const first=screen(coords[0]);await p.mouse.move(first.x,first.y);await p.mouse.down();for(const v of coords.slice(1)){const pt=screen(v);await p.mouse.move(pt.x,pt.y,{steps});}await p.mouse.up();}
// How much of a path, in map fractions, is painted the hint's cream colour.
const creamAlong=(p,pts)=>p.evaluate(pts=>{const c=document.getElementById('seaCanvas'),k=c.width/c.getBoundingClientRect().width,x=c.getContext('2d'),m=__treasure.map;let hit=0,n=0;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],len=Math.hypot((b.x-a.x)*m.w,(b.y-a.y)*m.h);for(let d=0;d<len;d+=1){const f=d/len,px=m.x+(a.x+(b.x-a.x)*f)*m.w,py=m.y+(a.y+(b.y-a.y)*f)*m.h;if(i===1&&f<.35)continue;const v=x.getImageData(Math.round(px*k),Math.round(py*k),1,1).data;n++;if(v[0]>235&&v[1]>230&&v[2]>185)hit++;}}return n?hit/n:0;},pts);
// Where the calm-seas path crosses a painted island, read off the map picture
// itself: sand, rocks, trunks and palm leaves are warm or leaf green, the sea
// is blue (white surf is neither). Only inside boxes round the four islands
// (the bottom-left island's box starts at x .15: its sand starts at about
// .165, and left of it is the cream foam and the little clouds along the
// parchment's edge, which a voyage in a new order can sail past)
// and their palms (the parchment edge, the compass and the gulls are not
// islands). As in the game, the line
// may leave the boat's own spot and reach the ring's, since a boat can stop
// on a beach and the last ring sits on one. The game's own outlines are not
// used: they are what drew the line over the palm trees.
const crossesIsland=(p,pts)=>p.evaluate(async({pts,src})=>{
 if(!window.__mapPx){const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d');x.drawImage(img,0,0);window.__mapPx={w:c.width,h:c.height,d:x.getImageData(0,0,c.width,c.height).data};}
 const m=window.__mapPx,boxes=[[.47,.125,.905,.26],[.64,.06,.905,.125],[.11,.23,.66,.44],[.33,.415,.905,.61],[.15,.58,.65,.79]],dist=(a,b)=>Math.hypot(a.x-b.x,(a.y-b.y)*1.5),boat=pts[0],goal=pts[pts.length-1],out=[];
 const island=(x,y)=>{if(!boxes.some(b=>x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3]))return false;const i=(Math.min(m.h-1,Math.floor(y*m.h))*m.w+Math.min(m.w-1,Math.floor(x*m.w)))*4,r=m.d[i],g=m.d[i+1],bl=m.d[i+2];if(r>205&&g>205&&bl>205)return false;return (r>=g-5&&r-bl>30)||(g>bl+60&&bl<150);};
 for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],len=Math.hypot((b.x-a.x)*m.w,(b.y-a.y)*m.h);for(let k=0;k<=len;k++){const f=k/Math.max(1,len),q={x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};if(dist(q,boat)<.05||dist(q,goal)<.07)continue;if(island(q.x,q.y))out.push([+q.x.toFixed(3),+q.y.toFixed(3)]);}}
 return out;},{pts,src:'/assets/crafted/game/treasure-map-play-v2.webp'});
const inView=(r,vw,vh)=>r&&r.width>0&&r.x>=-.5&&r.y>=-.5&&r.right<=vw+.5&&r.bottom<=vh+.5;
const rects=p=>p.evaluate(()=>{const g=id=>{const e=document.getElementById(id);if(!e||e.hidden)return null;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return cs.visibility==='hidden'||cs.display==='none'?null:{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};return{vw:innerWidth,vh:innerHeight,reset:g('seaReset'),help:g('seaHelp'),banner:g('seaBanner'),controls:g('seaControls'),power:g('seaPower'),top:g('top'),panel:g('turnPanel'),hear:g('hear'),back:g('helpBack'),mic:g('micBtn')};});
try{
 h=await gameHarness('treasure',8347);
 // (d) parked: a typed address goes home before any mic or sound
 {
  const {page,context}=await h.fresh({unpark:false});
  const home=await until(page,()=>/\/(today|activities)\.html/.test(location.pathname)&&!!document.getElementById('libraryMessage')&&/Treasure Map is coming soon/.test(document.getElementById('libraryMessage').textContent),8000);
  ok('the parked map goes back to Home, which says it is coming soon',home&&!page.url().includes('arcade-treasure'),{url:page.url()});
  ok('…with no mic asked for and no sound played',await page.evaluate(()=>__quiet.requests===0&&__quiet.soundsBefore===0&&__quiet.sounds.length===0),await page.evaluate(()=>({r:__quiet.requests,b:__quiet.soundsBefore,s:__quiet.sounds.length})));await context.close();
 }
 {
  const {page,context,errors}=await h.fresh();ok('real sailing canvas replaces the old animation',await page.locator('#seaCanvas').count()===1);if(!await page.locator('#seaCanvas').count())throw new Error('Treasure is still an animation scene');
  await page.locator('#startBtn').click();await until(page,()=>window.__sayplay&&__sayplay.listening);let s=await state(page),start={...s.sea.boat};
  await drawRoute(page,[{x:.4,y:.86},{x:.18,y:.83}]);await advance(page,1500);s=await state(page);ok('a drawn route with no word earns no sailing turn',!s.sea.active&&s.speech.said===0&&s.speech.step===0&&s.sea.boat.x===start.x&&s.sea.boat.y===start.y,s);
  // (a) silence: the whole listening window and more, with no voice
  await advance(page,14000);s=await state(page);ok('silence earns nothing: no saying, no sailing, no step',!s.sea.active&&s.speech.said===0&&s.speech.step===0&&s.speech.phase!=='play'&&s.sea.boat.x===start.x,s.speech);
  await page.locator('#micBtn').click();
  ok('two sayings earn the voyage',await sayWord(page));s=await state(page);ok('…and nothing else: no calm seas, the sea\'s own current, and no route drawn for the child',s.sea.calm===0&&s.sea.current===.018&&s.sea.hintShown===''&&s.sea.active&&s.sea.ladder===0,s);
  await advance(page,2000);s=await state(page);ok('the hint never moves the boat automatically',!s.sea.moving&&s.sea.boat.x===start.x&&s.sea.boat.y===start.y&&s.speech.step===0,s);
  await drawRoute(page,[{x:.5,y:.79},{x:.32,y:.70}]);await until(page,()=>__treasure.bumps>0,14000);s=await state(page);ok('an island blocks a real drawn route, without spending the earned word',s.sea.bumps>0&&s.sea.misses===1&&!s.sea.moving&&s.speech.step===0,s);
  // Help must guide from the actual boat after a bump, rather than join
  // the old canned channel with a line that cuts straight through land.
  const bumpCount=s.sea.bumps;await drawRoute(page,s.sea.channel);await until(page,n=>__sayplay.step>0||__treasure.bumps>n,12000,bumpCount);
  s=await state(page);ok('a hint after a mid-voyage bump sails safely around the same coast',s.sea.bumps===bumpCount&&s.speech.step===1,s);
  // Start the eight harbours fresh after this independently sailed route.
  // one fixed voyage (seed 5), so every run sails the same eight legs
  // (the rebuild part plays the voyages changing)
  await page.reload();await page.evaluate(()=>{let x=5;Math.random=()=>{x=(x*16807)%2147483647;return (x-1)/2147483646;};Treasure.reset();});await page.locator('#startBtn').click();await sayWord(page);
  await page.locator('#seaReset').click();s=await state(page);ok('return to dock offers another route with no new word required',s.sea.active&&s.sea.boat.x===start.x&&s.sea.boat.y===start.y&&s.speech.step===0,s);
  await drawRoute(page,[{x:.57,y:.86}],1);s=await state(page);ok('a quick straight drag is a valid sailing route',s.sea.moving&&s.sea.route.length>0,s);await page.locator('#seaReset').click();
  s=await state(page);const box=await page.locator('#seaCanvas').boundingBox();await page.mouse.move(box.x+s.sea.map.x+s.sea.boat.x*s.sea.map.w,box.y+s.sea.map.y+s.sea.boat.y*s.sea.map.h);await page.mouse.down();await page.evaluate(()=>document.getElementById('seaCanvas').dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:99})));s=await state(page);ok('an unrelated finger release cannot erase the active route',s.sea.draft.length===1,s);await page.mouse.up();
  await advance(page,13000);s=await state(page);ok('normal sea has a current after speech help expires',s.sea.calm===0&&s.sea.current>0,s);
  const held={...s.sea.boat};await page.locator('#seaHelp').click();await until(page,()=>__sayplay.listening);await advance(page,1000);s=await state(page);ok('requesting help pauses the boat and awards no stage',s.sea.paused&&s.sea.boat.x===held.x&&s.sea.boat.y===held.y&&s.speech.step===0,s);
  await page.evaluate(()=>__quiet.background());await advance(page,500);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await advance(page,300);s=await state(page);
  ok('background/resume during a help word returns to the same voyage, with no power',s.speech.phase==='play'&&!s.sea.paused&&s.sea.active&&s.sea.calm===0&&s.speech.step===0&&s.sea.boat.x===held.x&&s.sea.boat.y===held.y,s);
  await page.locator('#seaHelp').click();
  ok('accepted speech renews calm on the same harbour',await sayWord(page));s=await state(page);ok('help grants zero current, not a free route or stage',s.sea.current===0&&s.sea.calm>10&&!s.sea.paused&&s.speech.step===0&&s.sea.route.length===0,s);
  await page.screenshot({path:path.join(OUT,'sona-treasure-sailing.png')});
  for(let leg=0;leg<8;leg++){
   if(leg&&!await sayWord(page))throw new Error('No earned word for harbour '+leg);
   s=await state(page);
   const cross=await crossesIsland(page,[s.sea.boat,...s.sea.channel]);
   ok('the safe path to harbour '+(leg+1)+' (kept for the help, not shown by the word) goes round every painted island, palm trees too',(leg===0||s.sea.hintShown==='')&&s.sea.channel.length>0&&cross.length===0,{n:cross.length,at:cross.slice(0,3),path:[s.sea.boat,...s.sea.channel]});
   await drawRoute(page,[...s.sea.channel,s.sea.goal]);
   const reached=await until(page,()=>__treasure.celebrating||__sayplay.step>__treasure.leg,20000);s=await state(page);ok('a drawn safe route actually sails to harbour '+(leg+1),reached,s);if(!reached)break;
   if(leg===0){ok('the harbour cheer plays first and the step waits for it',s.sea.celebrating&&s.speech.step===0&&await page.evaluate(()=>__quiet.sfx.some(x=>/correct/.test(x.name||x))),{sea:s.sea,sfx:await page.evaluate(()=>__quiet.sfx.slice(-3))});
    await advance(page,600);s=await state(page);ok('…for about a second',s.speech.step===0,s.speech);}
   ok('…then harbour '+(leg+1)+' counts once',await until(page,n=>__sayplay.step>n,3000,leg)&&(await state(page)).speech.step===leg+1);
  }
  await advance(page,3300);s=await state(page);ok('eight real voyages reach the treasure and finish card',s.speech.phase==='end'&&s.speech.step===8&&s.sea.finished,s);
  const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));
  ok('no model or celebration plays into a live microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);ok('the child hears that the word sets sail, and how to draw',audio.lines.some(t=>/two times to set sail/.test(t)&&/draw a line/.test(t)),audio.lines);
  await page.locator('#again').click();await advance(page,700);s=await state(page);ok('sail again resets the boat and needs speech again',s.speech.step===0&&!s.sea.active&&s.sea.boat.x===start.x&&s.sea.boat.y===start.y,s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 // (b) a struggling child who keeps missing reaches the harbour with no more speech
 {
  // the voyage this part was measured on: the first harbour the bottom-left
  // one (seed 49866), so the bump below and the faint path are the same
  // every run
  const {page,context,errors}=await h.fresh();await page.evaluate(()=>{let x=49866;Math.random=()=>{x=(x*16807)%2147483647;return (x-1)/2147483646;};Treasure.reset();});
  ok('struggle: the first harbour is the bottom-left one',(await state(page)).sea.order[0]===0,(await state(page)).sea.order);
  await page.locator('#startBtn').click();ok('struggle: the word sets sail',await sayWord(page));
  await advance(page,13000);let s=await state(page);ok('struggle: calm seas has run out, nothing is shown',s.sea.calm===0&&s.sea.hintShown===''&&s.sea.ladder===0&&s.sea.current===.018,s.sea);
  const voiced=await page.evaluate(()=>__quiet.voicedFrames);
  const before=await creamAlong(page,[s.sea.boat,...s.sea.channel]);
  await drawRoute(page,[{x:.5,y:.79},{x:.32,y:.70}]);await until(page,()=>__treasure.misses>0,14000);s=await state(page);
  ok('struggle: miss 1 (a bump) slows the current and shows the safe path faintly',s.sea.ladder===1&&s.sea.current===.009&&s.sea.hintShown==='pale'&&s.sea.calm===0&&s.speech.step===0,s.sea);
  {const cross=await crossesIsland(page,[s.sea.boat,...s.sea.channel]);ok('struggle: the path from where the boat bumped goes round the painted islands too',cross.length===0,{n:cross.length,at:cross.slice(0,3),path:[s.sea.boat,...s.sea.channel]});}
  await advance(page,100);const after=await creamAlong(page,[s.sea.boat,...s.sea.channel]);ok('struggle: the safe path is really painted on the map with calm seas off',after>before+.1,{before,after});
  const short=async n=>{const b=(await state(page)).sea.boat;await drawRoute(page,[{x:b.x-.06,y:b.y}],4);return until(page,k=>__treasure.misses>k,14000,n);};
  ok('struggle: a line that stops short is miss 2',await short(1));s=await state(page);ok('struggle: after two misses the current stops, the path is bold and the ring zone is about twice as big',s.sea.ladder===2&&s.sea.current===0&&s.sea.hintShown==='bold'&&s.sea.zone>=.045*2.2,s.sea);
  await advance(page,200);await page.screenshot({path:path.join(OUT,'sona-treasure-glow.png')});
  ok('struggle: another short line is miss 3',await short(2));s=await state(page);ok('struggle: from the third miss the most help is on',s.sea.ladder===3&&s.sea.zone>=.045*2.4,s.sea);
  const b=s.sea.boat;await drawRoute(page,[{x:b.x-.07,y:b.y-.01}],4);
  ok('struggle: a short line roughly toward the ring now sails the safe path to the harbour',await until(page,()=>__sayplay.step===1,20000),await state(page));
  ok('struggle: no speech was needed for any of it',await page.evaluate(v=>__quiet.voicedFrames===v,voiced));
  s=await state(page);ok('struggle: the next word starts the ladder again',await sayWord(page)&&(await state(page)).sea.ladder===0);ok('struggle: no runtime errors',errors.length===0,errors);await context.close();
 }
 // (c) help mid-voyage, then silence: the same voyage goes on, with no power
 {
  const {page,context,errors}=await h.fresh();await page.evaluate(()=>{let x=49866;Math.random=()=>{x=(x*16807)%2147483647;return (x-1)/2147483646;};Treasure.reset();});await page.locator('#startBtn').click();await sayWord(page);await advance(page,13000);
  {const c=(await state(page)).sea.channel;await drawRoute(page,c);}await advance(page,700);let s=await state(page);ok('help-silence: the boat is sailing',s.sea.moving&&s.sea.calm===0,s.sea);
  await page.locator('#seaHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);const held={boat:s.sea.boat,route:JSON.stringify(s.sea.route)};
  await advance(page,6000);s=await state(page);ok('help-silence: the boat waits while Echo listens',s.sea.paused&&s.speech.listening&&s.sea.boat.x===held.boat.x&&s.sea.boat.y===held.boat.y,s.sea);
  await until(page,()=>__sayplay.phase==='play',9000);s=await state(page);const hr=JSON.parse(held.route),moved=Math.hypot(s.sea.boat.x-held.boat.x,s.sea.boat.y-held.boat.y);
  ok('help-silence: 13 s of silence gives the same move straight back, unpaused and with no power',s.speech.phase==='play'&&!s.speech.listening&&!s.sea.paused&&s.sea.active&&s.sea.calm===0&&s.speech.step===0&&s.sea.leg===0&&s.sea.moving&&moved<.03&&JSON.stringify(hr.slice(-s.sea.route.length))===JSON.stringify(s.sea.route),{s,held,moved});
  ok('help-silence: the boat carries on from where it was and reaches the harbour',await until(page,()=>__sayplay.step===1,20000),await state(page));
  await sayWord(page);await advance(page,3000);
  s=await state(page);await page.locator('#seaHelp').click();await until(page,()=>__sayplay.listening);const calmWas=s.sea.calm;
  ok('help-back: the "Back to the game" pill shows during a help ask',await page.locator('#helpBack').isVisible());
  await page.locator('#helpBack').click();await advance(page,200);s=await state(page);
  ok('help-back: a tap on it returns to the same harbour with no new calm',s.speech.phase==='play'&&!s.sea.paused&&s.sea.active&&s.speech.step===1&&s.sea.leg===1&&Math.abs(s.sea.calm-calmWas)<.3&&s.sea.calm<10,{s,calmWas});
  ok('help-silence: no runtime errors',errors.length===0,errors);await context.close();
 }
 // TREASURE2, the rebuild (Travis, 11 Nov 2026: "yes build treasure map"):
 // the harbours in a new order with the X somewhere new, the sailed route
 // kept on the map, no status words at the bottom
 {
  const GOALS=[{x:.18,y:.83},{x:.16,y:.59},{x:.84,y:.63},{x:.84,y:.40},{x:.17,y:.47},{x:.17,y:.24},{x:.56,y:.29},{x:.84,y:.23}],START={x:.70,y:.86},d=(a,b)=>Math.hypot(a.x-b.x,(a.y-b.y)*1.5);
  const orders=[];
  for(const seed of [5,77,3001,424242]){const {page,context,errors}=await h.fresh();await page.evaluate(seed=>{let x=seed;Math.random=()=>{x=(x*16807)%2147483647;return (x-1)/2147483646;};Treasure.reset();},seed);const o=(await state(page)).sea.order;orders.push(o.join());
   let at=START,near=true;const left=[0,1,2,3,4,5,6,7];for(const k of o){const rank=left.slice().sort((a,b)=>d(at,GOALS[a])-d(at,GOALS[b])).indexOf(k);if(rank<0||rank>2)near=false;left.splice(left.indexOf(k),1);at=GOALS[k];}
   ok('seed '+seed+': all eight harbours, each next one of the three nearest still to visit',o.length===8&&new Set(o).size===8&&near,o);await context.close();}
  ok('four games, four different voyages, and the X in more than one place',new Set(orders).size===4&&new Set(orders.map(o=>o.split(',')[7])).size>=2,orders);
  const {page,context,errors}=await h.fresh();
  ok('no status words at the bottom: the banner alone says what to do',await page.evaluate(()=>!document.getElementById('seaHint')&&!/Draw from your boat|A little current/.test(document.getElementById('seaControls').textContent)));
  // every leg a voyage can sail has a safe path round the painted islands
  // (from the harbour's middle and from six places round its ring, where a
  // boat stops; a place on solid land is one no boat can be)
  {const froms=[START];GOALS.forEach(g=>{froms.push(g);for(let k=0;k<6;k++){const a=k/6*Math.PI*2;froms.push({x:g.x+Math.cos(a)*.035,y:g.y+Math.sin(a)*.035/1.5});}});
   const I=[{x:.35,y:.715,rx:.24,ry:.060},{x:.66,y:.51,rx:.21,ry:.065},{x:.32,y:.35,rx:.23,ry:.070},{x:.73,y:.17,rx:.22,ry:.065}],onLand=f=>I.some(i=>((f.x-i.x)/i.rx)**2+((f.y-i.y)/i.ry)**2<1),bad=[];let n=0;
   for(const f of froms){if(onLand(f))continue;for(const [j,g] of GOALS.entries()){if(Math.hypot(f.x-g.x,f.y-g.y)<.06)continue;n++;const p=await page.evaluate(([a,b])=>Treasure.pathFor(a,b),[f,g]);const c=p.length?await crossesIsland(page,p):[{none:true}];if(c.length)bad.push({from:f,to:j,n:c.length});}}
   ok('every harbour to every other has a safe path round the painted islands, palm trees too (from '+n+' starting places)',bad.length===0&&n>300,bad);}
  // two legs: the sailed route stays on the map, and a fresh route wipes only this leg's
  await page.locator('#startBtn').click();await sayWord(page);let s=await state(page);
  await drawRoute(page,s.sea.channel);ok('trail: the first harbour is reached',await until(page,()=>__sayplay.step>0,20000));
  const first=(await state(page)).sea.trail;ok('trail: the first leg\'s route stays on the map',first.length===1&&first[0]>3,first);
  await sayWord(page);s=await state(page);await drawRoute(page,[{x:s.sea.boat.x+.05,y:s.sea.boat.y}],3);await advance(page,1500);
  s=await state(page);const mid=s.sea.trail;await page.locator('#seaReset').click();s=await state(page);
  ok('trail: a fresh route wipes only this leg\'s line, never the harbours already reached',s.sea.trail.length===2&&s.sea.trail[0]===first[0]&&s.sea.trail[1]===1&&mid[1]>=1,{first,mid,now:s.sea.trail});
  const red=await page.evaluate(()=>{const c=document.getElementById('seaCanvas'),k=c.width/c.getBoundingClientRect().width,g=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<g.length;i+=4)if(g[i]>120&&g[i]<190&&g[i+1]<90&&g[i+2]<80)n++;return n;});
  ok('trail: the dotted route is really drawn on the map',red>40,red);
  ok('the voyage check has no runtime errors',errors.length===0,errors);await context.close();
 }
 // (e) fit: start card, play, a word turn and a help ask
 for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024},{width:393,height:852},{width:844,height:390},{width:620,height:500}]){
  const tag=viewport.width+'x'+viewport.height,{page,context,errors}=await h.fresh({viewport});await advance(page,200);const fit=await page.evaluate(()=>{const r=document.getElementById('startBtn').getBoundingClientRect();return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,x:r.x,y:r.y,right:r.right,bottom:r.bottom,h:r.height};});
  ok('start card fits '+tag,fit.scroll<=fit.height+1&&fit.x>=0&&fit.y>=0&&fit.right<=fit.width&&fit.bottom<=fit.height&&fit.h>=44,fit);
  if(viewport.width>viewport.height){ok('the existing phone portrait guard remains in place',await page.locator('#sonaPortraitGuard').isVisible());/* Exercise the defensive board layout underneath the app-wide guard. */await page.locator('#sonaPortraitGuard').evaluate(e=>e.remove());await page.evaluate(()=>{let x=49866;Math.random=()=>{x=(x*16807)%2147483647;return (x-1)/2147483646;};Treasure.reset();});await page.locator('#startBtn').click();await sayWord(page);const s=await state(page);ok('landscape uses a generous map with readable boat controls',s.sea.map.rotated&&s.sea.map.w>=400&&s.sea.map.h>=260,s.sea.map);await drawRoute(page,s.sea.channel);ok('landscape drawing really sails to the harbour',await until(page,()=>__sayplay.step>0,15000));}
  else{
   await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);let r=await rects(page);
   ok('word turn fits '+tag+': the panel and Hear it are on screen and big enough',inView(r.panel,r.vw,r.vh)&&inView(r.hear,r.vw,r.vh)&&r.hear.height>=44&&r.hear.width>=44,r);
   await sayWord(page);r=await rects(page);let s=await state(page);const m=s.sea.map,cb=await page.locator('#seaCanvas').boundingBox();
   const mapTop=cb.y+m.y,mapBottom=cb.y+m.y+m.h;
   ok('play fits '+tag+': both buttons on screen and at least 44 px',inView(r.reset,r.vw,r.vh)&&inView(r.help,r.vw,r.vh)&&r.reset.height>=44&&r.reset.width>=44&&r.help.height>=44,r);
   ok('play fits '+tag+': the whole map sits between the words at the top and the buttons',mapTop>=r.banner.bottom-1&&mapTop>=r.top.bottom-1&&mapBottom<=r.controls.y+1&&cb.x+m.x>=0&&cb.x+m.x+m.w<=r.vw+.5,{mapTop,mapBottom,r});
   ok('play fits '+tag+': the calm seas bar never covers the map',!r.power||r.power.y>=mapBottom-1,{power:r.power,mapBottom});
   const hits=await page.evaluate(()=>{const c=document.getElementById('seaCanvas').getBoundingClientRect(),m=__treasure.map;return[__treasure.boat,__treasure.goal].map(p=>{const e=document.elementFromPoint(c.x+m.x+p.x*m.w,c.y+m.y+p.y*m.h);return e&&e.id;});});
   ok('play fits '+tag+': nothing covers the boat or the ring',hits.every(id=>id==='seaCanvas'),hits);
   await advance(page,2600);await page.locator('#seaHelp').click();await until(page,()=>__sayplay.listening);r=await rects(page);
   ok('help ask fits '+tag+': the panel and "Back to the game" are on screen and at least 44 px',inView(r.panel,r.vw,r.vh)&&inView(r.back,r.vw,r.vh)&&r.back.height>=44&&r.back.width>=44,r);
  }
  await page.screenshot({path:path.join(OUT,'sona-treasure-'+viewport.width+'.png')});ok('fit has no runtime errors',errors.length===0,errors);await context.close();
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
