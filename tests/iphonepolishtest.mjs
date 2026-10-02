// Real Fruit Slice lifecycle, fake speech/mic edges: a retry must speak before listening.
import {createServer} from 'http';
import {readFileSync} from 'fs';
import path from 'path';
import {chromium,ROOT,launchOpts} from './_env.mjs';
const root=process.env.SONATEST_PUBLIC_ROOT||ROOT;
const server=createServer((req,res)=>{try{res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/html');res.end(readFileSync(path.join(root,req.url.split('?')[0])));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(launchOpts());let failed=0;
function ok(name,value,detail){console.log((value?'PASS ':'FAIL ')+name+(value||detail===undefined?'':' → '+JSON.stringify(detail)));if(!value)failed++;}
try{
 const context=await browser.newContext();await context.route('**/api/tts',route=>route.fulfill({body:Buffer.alloc(4800),contentType:'application/octet-stream'}));
 await context.addInitScript(()=>{
  localStorage.setItem('sona.profile.v1',JSON.stringify({onboarded:true,focusSounds:['P'],voiceOn:true,soundOn:false,volume:.6,earlyAdopter:true}));sessionStorage.setItem('sona.play.token','arcade-slice.html');
  window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"ios",Plugins:{}};
  window.h={media:[],mic:0,hidden:false};Object.defineProperty(document,'hidden',{get:()=>h.hidden});
  window.Audio=function(src){const a={src,play(){h.media.push(a);return Promise.resolve();},pause(){a.paused=true;},removeAttribute(){},load(){}};return a;};
  navigator.mediaDevices.getUserMedia=()=>{h.mic++;return new Promise(()=>{});};
 });
 const page=await context.newPage(),errors=[],texts=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('/api/tts'))texts.push(JSON.parse(r.postData()).text);});await page.goto(base+'/arcade-slice.html?from=charge');
 await page.waitForFunction(()=>typeof crash==='function');await page.evaluate(()=>crash());
 await page.waitForFunction(()=>h.media.length===1,{},{timeout:2500}).catch(()=>{});
 ok('retry speaks the instruction before asking for microphone',await page.evaluate(()=>h.media.length===1&&h.mic===0)&&texts.includes('To keep playing, say'));
 if(await page.evaluate(()=>h.media.length===1)){
  await page.evaluate(()=>h.media[0].onended());await page.waitForFunction(()=>h.media.length===2);
  // 29 Sep 2026: ONE take of her sound (tools/soundclips.mjs), not the demo that repeats it.
  ok('retry models P using Rachel audio rather than TTS spelling',await page.evaluate(()=>h.media[1].src==='/coach/say-echo/P-sound.wav'&&h.mic===0));
  await page.locator('#revDone').click();await page.waitForTimeout(1100);
  ok('leaving retry cancels audio without opening microphone',await page.evaluate(()=>h.media[1].paused&&h.mic===0));
  await page.evaluate(()=>{playing=true;crash();});await page.waitForFunction(()=>h.media.length===3);await page.evaluate(()=>{h.hidden=true;document.dispatchEvent(new Event('visibilitychange'));});
  ok('backgrounding cancels retry narration',await page.evaluate(()=>h.media[2].paused&&h.mic===0));
  await page.evaluate(()=>{h.hidden=false;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>h.media.length===4);await page.evaluate(()=>h.media[3].onended());await page.waitForFunction(()=>h.media.length===5);await page.evaluate(()=>h.media[4].onended());await page.waitForTimeout(300);
  ok('microphone waits for the sound tail',await page.evaluate(()=>h.mic===0));await page.waitForFunction(()=>h.mic===1);
  ok('microphone starts after completed spoken retry',await page.evaluate(()=>h.mic===1));
 }
 const wav=await page.evaluate(async()=>{if(!Sona.pcmWave)return null;var bytes=new Uint8Array([0,128,0,0,255,127]),blob=Sona.pcmWave(bytes),data=new Uint8Array(await blob.arrayBuffer()),v=new DataView(data.buffer);return {type:blob.type,rate:v.getUint32(24,true),channels:v.getUint16(22,true),samples:Array.from(data.slice(44))};});
 ok('media wrapper preserves samples and mono 24kHz format',wav?.type==='audio/wav'&&wav.rate===24000&&wav.channels===1&&JSON.stringify(wav.samples)==='[0,128,0,0,255,127]');
 // Feed Echo starts on its Let's play card, after a grown-up's yes to the mic (here, given in setup)
 await page.evaluate(()=>localStorage.setItem('sona.micok','1'));
 await page.goto(base+'/arcade-feed.html');
 await page.locator('#startBtn').click();
 await page.waitForFunction(()=>h.media.length>0,{},{timeout:2500}).catch(()=>{});
 ok('Feed Echo generated voice uses native media playback at the profile\'s level (a saved 60% plays at the normal 0.8 since 30 Sep 2026)',await page.evaluate(()=>h.media.length>0&&h.media[0].src.startsWith('blob:')&&h.media[0].volume===.8&&h.media[0].volume===Sona.getProfile().volume));
 await page.evaluate(()=>{h.hidden=true;document.dispatchEvent(new Event('visibilitychange'));});
 ok('Feed Echo stops its native voice when backgrounded',await page.evaluate(()=>h.media.length>0&&h.media[0].paused));
 ok('no runtime errors',errors.length===0);await context.close();
 // 1 Oct 2026 ("Sounds not working again on books", the call-volume slider on
 // screen): the book reader, the word games and Bubble Pop play Echo's voice
 // as media in the app too, never Web Audio, and a voice that won't start
 // still reaches the child as the browser voice.
 {
  const ctx2=await browser.newContext({reducedMotion:'reduce'});await ctx2.route('**/api/tts',route=>route.fulfill({body:Buffer.alloc(48000),contentType:'application/octet-stream'}));
  await ctx2.addInitScript(()=>{
   localStorage.setItem('sona.profile.v1',JSON.stringify({onboarded:true,focusSounds:['R'],childAge:'4',voiceOn:true,soundOn:false,volume:.6,earlyAdopter:true}));localStorage.setItem('sona.micok','1');
   window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"ios",Plugins:{}};
   window.h={media:[],mic:0,synth:[],refuse:false,pcm:0};
   window.Audio=function(src){const a={src,paused:false,play(){h.media.push(a);if(h.refuse)return Promise.reject(new Error('NotAllowedError'));setTimeout(()=>a.onplaying&&a.onplaying(),0);return Promise.resolve();},pause(){a.paused=true;},removeAttribute(){},load(){}};return a;};
   window.SpeechSynthesisUtterance=function(t){this.text=t;};
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speaking:false,paused:false,speak(u){h.synth.push(u.text);setTimeout(()=>u.onend&&u.onend(),20);},cancel(){},resume(){},getVoices:()=>[]}});
   // a voice line through Web Audio is a buffer longer than the 1-sample unlock
   const AC=window.AudioContext;if(AC){const make=AC.prototype.createBuffer;AC.prototype.createBuffer=function(c,n,r){if(n>1)h.pcm++;return make.call(this,c,n,r);};}
   navigator.mediaDevices.getUserMedia=()=>{h.mic++;return new Promise(()=>{});};
  });
  const pg=await ctx2.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(base+'/library.html');await pg.waitForFunction(()=>document.querySelectorAll('#shelf .bookBtn').length>0);
  await pg.evaluate(()=>[...document.querySelectorAll('#shelf .bookBtn')].find(b=>b.querySelector('.bt').textContent==='Rory and the Rainbow').click());
  await pg.waitForTimeout(150);await pg.evaluate(()=>document.getElementById('bkNext').click());
  await pg.waitForFunction(()=>h.media.length>0,{},{timeout:4000}).catch(()=>{});
  ok('the book reads its page as native media at the profile\'s level (a saved 60% plays at the normal 0.8 since 30 Sep 2026), never through Web Audio',await pg.evaluate(()=>h.media.length>0&&h.media[0].src.startsWith('blob:')&&h.media[0].volume===.8&&h.pcm===0));
  await pg.evaluate(()=>document.getElementById('bkNext').click());
  ok('turning the page stops the line in flight',await pg.evaluate(()=>h.media.length>0&&h.media[0].paused));
  await pg.waitForFunction(()=>h.media.length>1,{},{timeout:4000}).catch(()=>{});
  await pg.evaluate(()=>{h.refuse=true;const a=h.media[h.media.length-1];if(a&&a.onended)a.onended();});await pg.waitForTimeout(300);
  await pg.evaluate(()=>document.getElementById('bkHear').click());
  await pg.waitForFunction(()=>h.synth.length>0,{},{timeout:4000}).catch(()=>{});
  ok('a book voice the phone refuses to start is read by the browser voice instead of silence',await pg.evaluate(()=>h.synth.length>0&&h.pcm===0),await pg.evaluate(()=>({synth:h.synth,media:h.media.length})));
  await pg.evaluate(()=>{h.refuse=false;h.media=[];h.synth=[];});
  await pg.goto(base+'/arcade-hoops.html');await pg.waitForFunction(()=>!!document.getElementById('startBtn'));
  await pg.evaluate(()=>{h.media=[];document.getElementById('startBtn').click();});
  await pg.waitForFunction(()=>h.media.length>0,{},{timeout:5000}).catch(()=>{});
  ok('a word game (Hoops) says its word as native media at the profile\'s level (a saved 60% plays at the normal 0.8 since 30 Sep 2026)',await pg.evaluate(()=>h.media.length>0&&h.media[0].src.startsWith('blob:')&&h.media[0].volume===.8&&h.pcm===0),await pg.evaluate(()=>({media:h.media.length,pcm:h.pcm})));
  // Bubble Pop is a word game on the same engine since 1 Oct 2026: Echo asks
  // for the word straight after Let's play, before any bubble exists
  await pg.goto(base+'/arcade-bubbles.html');await pg.waitForFunction(()=>!!document.getElementById('startBtn'));
  await pg.evaluate(()=>{h.media=[];document.getElementById('startBtn').click();});
  await pg.waitForFunction(()=>h.media.length>0,{},{timeout:5000}).catch(()=>{});
  ok('Bubble Pop says its word as native media at the profile\'s level (a saved 60% plays at the normal 0.8 since 30 Sep 2026)',await pg.evaluate(()=>h.media.length>0&&h.media[0].src.startsWith('blob:')&&h.media[0].volume===.8&&h.pcm===0),await pg.evaluate(()=>({media:h.media.length,pcm:h.pcm})));
  ok('books and word games: no runtime errors',errs.length===0,errs);await ctx2.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
process.exitCode=failed?1:0;
