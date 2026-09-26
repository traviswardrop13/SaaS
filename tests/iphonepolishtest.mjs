// Real Fruit Slice lifecycle, fake speech/mic edges: a retry must speak before listening.
import {createServer} from 'http';
import {readFileSync} from 'fs';
import path from 'path';
import {chromium,ROOT,launchOpts} from './_env.mjs';
const root=process.env.SONATEST_PUBLIC_ROOT||ROOT;
const server=createServer((req,res)=>{try{res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/html');res.end(readFileSync(path.join(root,req.url.split('?')[0])));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(launchOpts());let failed=0;
function ok(name,value){console.log((value?'PASS ':'FAIL ')+name);if(!value)failed++;}
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
  ok('retry models P using Rachel audio rather than TTS spelling',await page.evaluate(()=>h.media[1].src==='/coach/say-echo/P-demo.mp3'&&h.mic===0));
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
 await page.goto(base+'/arcade-feed.html');
 await page.waitForFunction(()=>h.media.length>0,{},{timeout:2500}).catch(()=>{});
 ok('Feed Echo generated voice uses native media playback at the selected volume',await page.evaluate(()=>h.media.length>0&&h.media[0].src.startsWith('blob:')&&h.media[0].volume===.6));
 await page.evaluate(()=>{h.hidden=true;document.dispatchEvent(new Event('visibilitychange'));});
 ok('Feed Echo stops its native voice when backgrounded',await page.evaluate(()=>h.media.length>0&&h.media[0].paused));
 ok('no runtime errors',errors.length===0);await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
process.exitCode=failed?1:0;
