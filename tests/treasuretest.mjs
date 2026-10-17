import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,sea:window.__treasure}));
async function drawRoute(p,points,steps=12){const b=await p.locator('#seaCanvas').boundingBox(),s=(await state(p)).sea,map=s.map,coords=[s.boat,...points],screen=v=>map.rotated?{x:b.x+map.x+v.y*map.w,y:b.y+map.y+(1-v.x)*map.h}:{x:b.x+map.x+v.x*map.w,y:b.y+map.y+v.y*map.h};const first=screen(coords[0]);await p.mouse.move(first.x,first.y);await p.mouse.down();for(const v of coords.slice(1)){const pt=screen(v);await p.mouse.move(pt.x,pt.y,{steps});}await p.mouse.up();}
try{
 h=await gameHarness('treasure',8347);
 {
  const {page,context}=await h.fresh({unpark:false});await advance(page,500);ok('production stays Coming Soon with no microphone',!page.url().includes('arcade-treasure')&&await page.evaluate(()=>__quiet.requests===0));await context.close();
 }
 {
  const {page,context,errors}=await h.fresh();ok('real sailing canvas replaces the old animation',await page.locator('#seaCanvas').count()===1);if(!await page.locator('#seaCanvas').count())throw new Error('Treasure is still an animation scene');
  await page.locator('#startBtn').click();await until(page,()=>window.__sayplay&&__sayplay.listening);let s=await state(page),start={...s.sea.boat};
  await drawRoute(page,[{x:.4,y:.86},{x:.18,y:.83}]);await advance(page,1500);s=await state(page);ok('silence and a drawn route do not earn a sailing turn',!s.sea.active&&s.speech.said===0&&s.speech.step===0&&s.sea.boat.x===start.x&&s.sea.boat.y===start.y,s);
  ok('two sayings earn calm seas and a route hint',await sayWord(page));s=await state(page);ok('speech really removes the current',s.sea.calm>10&&s.sea.current===0&&s.sea.active,s);
  await advance(page,2000);s=await state(page);ok('the hint never moves the boat automatically',!s.sea.moving&&s.sea.boat.x===start.x&&s.sea.boat.y===start.y&&s.speech.step===0,s);
  await drawRoute(page,[{x:.5,y:.79},{x:.32,y:.70}]);await until(page,()=>__treasure.bumps>0,14000);s=await state(page);ok('an island blocks a real drawn route, without spending the earned word',s.sea.bumps>0&&!s.sea.moving&&s.speech.step===0,s);
  // Help must guide from the actual boat after a bump, rather than join
  // the old canned channel with a line that cuts straight through land.
  const bumpCount=s.sea.bumps;await drawRoute(page,s.sea.channel);await until(page,n=>__sayplay.step>0||__treasure.bumps>n,12000,bumpCount);
  s=await state(page);ok('a hint after a mid-voyage bump sails safely around the same coast',s.sea.bumps===bumpCount&&s.speech.step===1,s);
  // Start the eight harbours fresh after this independently sailed route.
  await page.reload();await page.locator('#startBtn').click();await sayWord(page);
  await page.locator('#seaReset').click();s=await state(page);ok('return to dock offers another route with no new word required',s.sea.active&&s.sea.boat.x===start.x&&s.sea.boat.y===start.y&&s.speech.step===0,s);
  await drawRoute(page,[{x:.57,y:.86}],1);s=await state(page);ok('a quick straight drag is a valid sailing route',s.sea.moving&&s.sea.route.length>0,s);await page.locator('#seaReset').click();
  s=await state(page);const box=await page.locator('#seaCanvas').boundingBox();await page.mouse.move(box.x+s.sea.map.x+s.sea.boat.x*s.sea.map.w,box.y+s.sea.map.y+s.sea.boat.y*s.sea.map.h);await page.mouse.down();await page.evaluate(()=>document.getElementById('seaCanvas').dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:99})));s=await state(page);ok('an unrelated finger release cannot erase the active route',s.sea.draft.length===1,s);await page.mouse.up();
  await advance(page,13000);s=await state(page);ok('normal sea has a current after speech help expires',s.sea.calm===0&&s.sea.current>0,s);
  const held={...s.sea.boat};await page.locator('#seaHelp').click();await until(page,()=>__sayplay.listening);await advance(page,1000);s=await state(page);ok('requesting help pauses the boat and awards no stage',s.sea.paused&&s.sea.boat.x===held.x&&s.sea.boat.y===held.y&&s.speech.step===0,s);
  await page.evaluate(()=>__quiet.background());await advance(page,500);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await until(page,()=>__sayplay.listening);await advance(page,500);s=await state(page);ok('background/resume during a help word keeps the sea paused',s.sea.paused&&s.sea.boat.x===held.x&&s.sea.boat.y===held.y,s);
  ok('accepted speech renews calm on the same harbour',await sayWord(page));s=await state(page);ok('help grants zero current, not a free route or stage',s.sea.current===0&&!s.sea.paused&&s.speech.step===0&&s.sea.route.length===0,s);
  await page.screenshot({path:path.join(OUT,'sona-treasure-sailing.png')});
  for(let leg=0;leg<8;leg++){
   if(leg&&!await sayWord(page))throw new Error('No earned word for harbour '+leg);
   s=await state(page);await drawRoute(page,[...s.sea.channel,s.sea.goal]);
   const reached=await until(page,n=>__sayplay.step>n,20000,leg);s=await state(page);ok('a drawn safe route actually sails to harbour '+(leg+1),reached,s);if(!reached)break;
  }
  await advance(page,3300);s=await state(page);ok('eight real voyages reach the treasure and finish card',s.speech.phase==='end'&&s.speech.step===8&&s.sea.finished,s);
  const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));
  ok('no model or celebration plays into a live microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);ok('the child hears how to draw and earn calm seas',audio.lines.some(t=>/calm seas/.test(t)&&/draw a line/.test(t)));
  await page.locator('#again').click();await advance(page,700);s=await state(page);ok('sail again resets the boat and needs speech again',s.speech.step===0&&!s.sea.active&&s.sea.boat.x===start.x&&s.sea.boat.y===start.y,s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 for(const viewport of [{width:320,height:568},{width:393,height:852},{width:844,height:390},{width:620,height:500},{width:768,height:1024}]){
  const {page,context,errors}=await h.fresh({viewport});await advance(page,200);const fit=await page.evaluate(()=>{const r=document.getElementById('startBtn').getBoundingClientRect();return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,x:r.x,y:r.y,right:r.right,bottom:r.bottom};});
  ok('sailing fits '+viewport.width+'x'+viewport.height,fit.scroll<=fit.height+1&&fit.x>=0&&fit.y>=0&&fit.right<=fit.width&&fit.bottom<=fit.height,fit);
  if(viewport.width>viewport.height){ok('the existing phone portrait guard remains in place',await page.locator('#sonaPortraitGuard').isVisible());/* Exercise the defensive board layout underneath the app-wide guard. */await page.locator('#sonaPortraitGuard').evaluate(e=>e.remove());await page.locator('#startBtn').click();await sayWord(page);const s=await state(page);ok('landscape uses a generous map with readable boat controls',s.sea.map.rotated&&s.sea.map.w>=400&&s.sea.map.h>=260,s.sea.map);await drawRoute(page,s.sea.channel);ok('landscape drawing really sails to the harbour',await until(page,()=>__sayplay.step>0,15000));}
  await page.screenshot({path:path.join(OUT,'sona-treasure-'+viewport.width+'.png')});ok('fit has no runtime errors',errors.length===0,errors);await context.close();
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
