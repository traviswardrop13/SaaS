// Real shared speech/game code, with silent fake playback and a local TTS server.
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { chromium, ROOT as CURRENT_ROOT, launchOpts } from './_env.mjs';
const ROOT=process.env.SONATEST_PUBLIC_ROOT||CURRENT_ROOT;
const origin='http://127.0.0.1:8198';
let mode='pcm',requests=0,failures=0;
const ok=(name,value,detail='')=>{if(!value)failures++;console.log((value?'PASS ':'FAIL ')+name+(value?'':' '+JSON.stringify(detail)));};
const mime={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',woff2:'font/woff2'};
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,origin).pathname;
 if(pathname==='/api/tts'){requests++;res.writeHead(mode==='pcm'?200:503,{'Content-Type':mode==='pcm'?'audio/L16; rate=24000; channels=1':'application/json','X-Sona-Voice-Provider':'elevenlabs','X-Sona-Voice-Model':'eleven_multilingual_v2','X-Sona-Voice-Cache':'miss','X-Sona-Voice-Revision':'v7'});res.end(mode==='pcm'?Buffer.alloc(480):'{}');return;}
 if(pathname==='/speech-harness'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html><button id="speak">Speak</button><script src="/sona.js"></script><script>document.getElementById("speak").onclick=function(){window.finished=false;Sona.speakNow("Take your time. It is your turn.").then(function(){window.finished=true;});};</script></html>');return;}
 const file=ROOT+pathname;if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':mime[file.split('.').pop()]||'application/octet-stream'});
 // Keep parked-game speech delivery covered without adding an app unlock.
 const body=pathname==='/sona.js'?readFileSync(file,'utf8').replace(/((?:bubbles|peekaboo): \{[^\n]*?)comingSoon: true/g,'$1comingSoon: false'):readFileSync(file);res.end(body);
});
await new Promise(resolve=>server.listen(8198,'127.0.0.1',resolve));
const browser=await chromium.launch(launchOpts());
function fake(){
 const h=window.__voiceTest={utterances:[],pcm:0,cacheKeys:[],cache:{},hold:false,cancels:0};
 const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({gain:param(),frequency:param(),playbackRate:param(),connect(){},disconnect(){},start(){},stop(){}});
 class Context{constructor(){this.state='running';this.destination={};this.sampleRate=24000;this.currentTime=0;}resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}createGain(){return node();}createOscillator(){return node();}createBuffer(c,n,rate){return {duration:n/rate,getChannelData:()=>new Float32Array(n)};}createBufferSource(){const n=node();n.start=()=>{h.pcm++;setTimeout(()=>{if(n.onended)n.onended();},10);};return n;}}
 window.AudioContext=window.webkitAudioContext=Context;
 speechSynthesis.getVoices=()=>[];speechSynthesis.cancel=()=>{h.cancels++;};
 speechSynthesis.speak=u=>{h.utterances.push(u);if(!h.hold)setTimeout(()=>u.onend&&u.onend(),10);};
 navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('No real microphone','NotAllowedError'));
 const db={objectStoreNames:{contains:()=>true},close(){},transaction(){const tx={abort(){},objectStore(){return {
 get(key){h.cacheKeys.push(key);const query={};queueMicrotask(()=>{query.result=key.includes('|v6|')?new ArrayBuffer(480):(h.cache[key]||null);if(query.onsuccess)query.onsuccess();});return query;},
 put(value,key){h.cache[key]=value;const query={};queueMicrotask(()=>{if(tx.oncomplete)tx.oncomplete();});return query;}
 };}};return tx;}};
 Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){const r={result:db};queueMicrotask(()=>r.onsuccess&&r.onsuccess());return r;}}});
 localStorage.setItem('sona.freeera.v1','post');localStorage.setItem('sona.freeera2.v1','done');localStorage.setItem('sona.freeera3.v1','done');
 localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Demo',childAge:'4',focusSounds:['M'],onboarded:true,volume:.6,voiceOn:true,soundOn:true,earlyAdopter:true}));
}
async function fresh(path){const ctx=await browser.newContext({reducedMotion:'reduce'});await ctx.addInitScript(fake);await ctx.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());const page=await ctx.newPage();page.setDefaultTimeout(4000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+path);return {ctx,page,errors};}
async function scenario(name,fn){try{await fn();}catch(e){ok(name+' runs without exception',false,e.message);}}

await scenario('shared browser fallback',async()=>{
 mode='error';const {ctx,page,errors}=await fresh('/speech-harness');try{
 await page.evaluate(()=>{__voiceTest.hold=true;});await page.click('#speak');await page.waitForFunction(()=>__voiceTest.utterances.length===1);await page.waitForTimeout(1450);
 ok('an empty voice list cannot end a still-speaking sentence',await page.evaluate(()=>finished===false));
 const trace=await page.evaluate(()=>Sona.voiceStatus?Sona.voiceStatus():null);
 ok('browser fallback explains the API failure locally',trace?.last?.source==='browser'&&trace.last.reason==='api-error',trace);
 await page.evaluate(()=>__voiceTest.utterances[0].onend());await page.waitForFunction(()=>finished===true);
 ok('the speech promise ends when the voice actually ends',await page.evaluate(()=>finished===true));
 ok('fallback has no page errors',!errors.length,errors);
 }finally{await ctx.close();}
});
await scenario('long browser narration',async()=>{
 mode='error';const {ctx,page}=await fresh('/speech-harness');try{
 await page.clock.install();
 await page.evaluate(()=>{__voiceTest.hold=true;});await page.click('#speak');await page.waitForFunction(()=>__voiceTest.utterances.length===1);
 const before=await page.evaluate(()=>__voiceTest.cancels);
 await page.clock.fastForward(13000);
 ok('queue watchdog does not cut off an ongoing narration',await page.evaluate(n=>__voiceTest.cancels===n,before));
 }finally{await ctx.close();}
});
await scenario('shared ElevenLabs playback',async()=>{
 mode='pcm';const {ctx,page}=await fresh('/speech-harness');try{
 await page.click('#speak');await page.waitForFunction(()=>finished===true);
 const trace=await page.evaluate(()=>Sona.voiceStatus?Sona.voiceStatus():null);
 ok('server playback identifies ElevenLabs and its actual model',trace?.last?.source==='elevenlabs'&&trace.last.model==='eleven_multilingual_v2',trace);
 ok('successful server audio never invokes the browser voice',await page.evaluate(()=>__voiceTest.utterances.length===0&&__voiceTest.pcm>0));
 const safe=await page.evaluate(()=>{
 if(!Sona.voiceDiagnostic||!Sona.voiceStatus)return false;
 const before=JSON.stringify({...localStorage});
 for(let i=0;i<30;i++)Sona.voiceDiagnostic({source:'browser',text:'SECRET CHILD TEXT',childName:'SECRET CHILD NAME',audio:'SECRET AUDIO',reason:'fallback'});
 const s=Sona.voiceStatus();s.last.source='changed';
 return s.events.length===20&&!JSON.stringify(s).includes('SECRET')&&Sona.voiceStatus().last.source==='browser'&&before===JSON.stringify({...localStorage});
 });
 ok('diagnostics are bounded, private, memory-only copies',safe);
 }finally{await ctx.close();}
});
for(const game of ['bubbles','peekaboo'])await scenario(game+' delivery and cache',async()=>{
 mode='pcm';const {ctx,page,errors}=await fresh('/arcade-'+game+'.html');try{
 const before=requests;ok(game+': opening a game does not start the demonstration clock',await page.evaluate(()=>!Sona.demoState().started));
 await page.click('#startGame');const started=await page.evaluate(()=>Sona.demoState().started);
 ok(game+': deliberate Start begins the existing demonstration window',started>0);
 await page.click(game==='bubbles'?'#revealButton':'[data-door="1"]');await page.waitForTimeout(150);
 ok(game+': old cached delivery is bypassed',requests===before+1,{before,requests});
 const first=await page.evaluate(()=>Sona.voiceStatus?Sona.voiceStatus():null);
 ok(game+': fresh audio uses the server provider',first?.last?.source==='elevenlabs',first);
 await page.click('#hearWord');await page.waitForTimeout(150);
 const replay=await page.evaluate(()=>Sona.voiceStatus?Sona.voiceStatus():null);
 ok(game+': fresh delivery is reused without another API call',requests===before+1&&replay?.last?.source==='cache',replay);
 ok(game+': listening becomes the child’s turn after playback',/Your turn/.test(await page.locator('#promptHint').textContent()));
 await page.click('#pauseGame');await page.click('#resumeGame');
 ok(game+': resuming never restarts the demonstration window',await page.evaluate(t=>Sona.demoState().started===t,started));
 ok(game+': no runtime errors',!errors.length,errors);
 }finally{await ctx.close();}
});
await browser.close();await new Promise(resolve=>server.close(resolve));
console.log(failures?failures+' FAILURES':'ALL GREEN');process.exit(failures?1:0);
