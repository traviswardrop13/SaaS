// Local review must use the saved real controllers, stay on this computer,
// and leave the production catalog/entitlement source untouched.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {createDailyPreviewServer} from '../tools/daily-adventures-preview.mjs';
import {chromium,launchOpts} from './_env.mjs';
import {fakeDevice} from './_sayplaydevice.mjs';
import {until,advance} from './_sayplay-realgame.mjs';
let checks=0,fails=0;
function ok(name,pass,detail){checks++;if(!pass){fails++;console.log('FAIL '+name+' '+String(detail||''));}}
const sonaPath=fileURLToPath(new URL('../public/sona.js',import.meta.url)),before=readFileSync(sonaPath,'utf8');
const server=createDailyPreviewServer();
let browser;
try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const base='http://127.0.0.1:'+server.address().port;
  ok('the review listener is local only',server.address().address==='127.0.0.1');
  const root=await fetch(base+'/'),gallery=await root.text();
  ok('the gallery identifies its local, unreleased purpose',root.ok&&gallery.includes('only on this computer')&&gallery.includes('in progress'));
  ok('the whole eleven-day plan is visible',Array.from({length:11},(_,i)=>'Day '+(i+4)+'</small>').every(label=>gallery.includes(label)));
  ok('completed local adventures have both age links',gallery.includes('day=4&amp;age=3')&&gallery.includes('day=4&amp;age=7'));
  const page=await fetch(base+'/daily-adventure.html?day=4&age=3'),html=await page.text();
  ok('a saved controller and its real narrator are served',page.ok&&html.includes('/daily-adventures/waterwheel.js')&&html.includes('/daily-adventures/narration.js')&&html.includes('window.__dailyNarrationFixture=true'));
  ok('the age choice selects the existing profile path',html.includes('Sona.saveProfile({childAge:"3"})')&&!html.includes('fakeDevice'));
  ok('every page token is resolved',!html.includes('{{')&&html.includes('The Thirsty Waterwheel Garden'));
  let parseError='';try{for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc\s*=/.test(match[1]))new vm.Script(match[2]);}catch(error){parseError=error.message;}
  ok('the actual review page inline scripts parse',!parseError,parseError);
  const scriptResponse=await fetch(base+'/sona.js'),code=await scriptResponse.text();
  parseError='';try{new vm.Script(code);}catch(error){parseError=error.message;}
  ok('the served local catalog remains a classic script',scriptResponse.ok&&!parseError,parseError);
  ok('review access is limited to its named local story keys',code.includes('reason:"local-review"')&&code.includes('return original(key,options)'));
  const home=await fetch(base+'/today.html',{redirect:'manual'});
  ok('the existing stop-and-go-Home action returns to the review',home.status===302&&home.headers.get('location')==='/');
  const invalid=await fetch(base+'/daily-adventure.html?day=999&age=3');
  ok('an unknown day does not open a game',invalid.status===404);
  const getAPI=await fetch(base+'/api/tts'),postAPI=await fetch(base+'/api/tts',{method:'POST',body:'not a recording'});
  ok('the review proxies no service and accepts no posted audio',getAPI.status===503&&postAPI.status===405);
  const traversal=await fetch(base+'/%2e%2e/%2e%2e/package.json');
  ok('files outside public are not served',traversal.status===404);
  ok('the real production catalog was never written',readFileSync(sonaPath,'utf8')===before);
  browser=await chromium.launch(launchOpts());
  const context=await browser.newContext({viewport:{width:393,height:852},reducedMotion:'reduce'}),errors=[];
  await context.addInitScript(fakeDevice,{age:'7',micok:true,permission:'granted',speechMs:100,premium:false,paid:true});
  await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
  const live=await context.newPage();live.on('pageerror',error=>errors.push(error.message));
  await live.clock.install();await live.goto(base+'/daily-adventure.html?day=4&age=3');
  await live.clock.pauseAt(await live.evaluate(()=>Date.now()+1000));
  const booted=await until(live,()=>window.__sayplay&&__sayplay.phase==='ready'&&window.__dailyWaterwheel&&__dailyWaterwheel.stages===5,3000);
  ok('the review boots the real selected-age controller',booted,errors);if(!booted)throw new Error('Review did not reach its selected age path');
  // 23 Oct 2026: the story games ask each word Sona.STORY_SAY_TIMES times
  // (three, Travis: "say the sound 3 times not twice for every daily game"),
  // and the review plays what ships, so it asks the same. Each saying but the
  // last only ticks its dot and asks for the rest ("2 more times!", then "1
  // more time!"); only the last earns the move. The sayings are the shared
  // helper's (280 ms bursts 650 ms apart), said one at a time here so the
  // state between them can be read.
  const times=await live.evaluate(()=>__sayplay.times);
  ok('the review asks each word as many times as the story games ship (Sona.STORY_SAY_TIMES, three)',await live.evaluate(()=>__sayplay.times===Sona.STORY_SAY_TIMES&&Sona.STORY_SAY_TIMES===3),times);
  await live.locator('#startBtn').click();
  const listening=await until(live,()=>window.__sayplay&&__sayplay.listening);await advance(live,150);
  const early=[];
  for(let i=1;i<=times;i++){
    await live.evaluate(()=>__quiet.voice=true);await advance(live,280);await live.evaluate(()=>__quiet.voice=false);
    if(i===times)break;
    await advance(live,300);
    const left=times-i,want=left+' more '+(left===1?'time':'times')+'!';
    const state=await live.evaluate(()=>({said:__sayplay.said,phase:__sayplay.phase,step:__sayplay.step,mic:document.getElementById('micState').textContent,dots:document.querySelectorAll('#twiceDots i').length,on:document.querySelectorAll('#twiceDots i.on').length}));
    if(!(state.said===i&&state.phase!=='play'&&state.step===0&&state.mic===want&&state.dots===times&&state.on===i))early.push({want,...state});
    await advance(live,350);
  }
  ok('every saying but the last is kept, ticks its dot and asks for the rest, and earns no move',listening&&times>1&&!early.length,JSON.stringify(early));
  ok('the last voiced saying earns the first review move',await until(live,()=>__sayplay.phase==='play'));
  ok('the actual story narration is reached',await until(live,()=>window.__dailyNarration&&__dailyNarration.open&&!__dailyNarration.speaking,15000));
  await live.locator('#dailyStoryNext').click();
  ok('continuing opens actual physical controls on the same earned step',await until(live,()=>__dailyWaterwheel.active&&__dailyWaterwheel.stage===0&&__sayplay.step===0,2000));
  await live.locator('#close').click();await live.waitForURL(base+'/');
  ok('SayPlay returns to the local review gallery',await live.title()==='Sona adventure review');
  ok('the real local review page has no runtime errors',errors.length===0,errors);
  await context.close();await browser.close();browser=null;
}catch(error){ok('the local review test completes',false,error.stack);}
finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
console.log('Daily preview: '+checks+' checks; '+fails+' failures');process.exitCode=fails?1:0;
