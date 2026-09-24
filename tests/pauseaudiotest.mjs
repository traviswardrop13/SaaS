// PAUSEAUDIO1: real practice lifecycle, with silent browser/device edges.
// No real microphone, media, PCM output or native speech is ever opened.
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import path from 'path';
import { chromium, ROOT, launchOpts } from './_env.mjs';
const publicRoot = process.env.SONATEST_PUBLIC_ROOT || ROOT;
const origin = 'http://127.0.0.1:8195';
const mime = { html:'text/html', js:'text/javascript', css:'text/css', svg:'image/svg+xml', png:'image/png', webp:'image/webp', woff2:'font/woff2' };
const server = createServer((req,res) => {
  const u = new URL(req.url,origin);
  if(u.pathname.startsWith('/api/')){res.writeHead(200,{'content-type':'application/json'});res.end('{}');return;}
  const file=path.join(publicRoot,u.pathname);
  if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':mime[file.split('.').pop()]||'application/octet-stream'});res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(8195,'127.0.0.1',resolve));
const browser=await chromium.launch(launchOpts());
let failures=0,assertions=0;
function ok(name,pass,detail=''){assertions++;if(!pass)failures++;console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' → '+(typeof detail==='string'?detail:JSON.stringify(detail))));}
async function scenario(name,fn){try{await fn();}catch(e){ok(name+' completes without exception',false,e.stack);}}
function device(config){
  const h=window.__audioHarness={hidden:false,media:[],pcm:[],voices:[],graphs:[],streams:[],timers:[],contexts:[],resumeWaiters:[],nativeStarts:[],nativeStops:[],nativeActive:null,cacheMode:'miss',cachePending:[],cacheKeys:[],fetchMode:'fail',fetchPending:[],fetches:[],resumeMode:'auto',deferNative:!!config.deferNative};
  const timeout=window.setTimeout.bind(window),clear=window.clearTimeout.bind(window),fetch=window.fetch.bind(window);
  let sequence=1;
  window.setTimeout=(fn,ms,...args)=>{const t={id:sequence++,ms:Number(ms)||0,active:true,native:null};t.raw=()=>{if(typeof fn==='function')fn(...args);};t.fire=()=>{if(!t.active)return;t.active=false;t.raw();};h.timers.push(t);if(t.ms<700)t.native=timeout(t.fire,t.ms);return t.id;};
  window.clearTimeout=id=>{const t=h.timers.find(t=>t.id===id);if(t){t.active=false;if(t.native!==null)clear(t.native);}else clear(id);};
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>h.hidden});
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>h.hidden?'hidden':'visible'});
  h.background=()=>{h.hidden=true;document.dispatchEvent(new Event('visibilitychange'));};
  h.foreground=()=>{h.hidden=false;document.dispatchEvent(new Event('visibilitychange'));};
  navigator.mediaDevices.getUserMedia=async()=>{const track={readyState:'live',muted:false,stop(){this.readyState='ended';}};const s={track,getTracks:()=>[track],getAudioTracks:()=>[track]};h.streams.push(s);return s;};
  const parameter=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}});
  const node=()=>({gain:parameter(),frequency:parameter(),connect(){},disconnect(){},start(){},stop(){}});
  class Context{
    constructor(){this.state='running';this.sampleRate=48000;this.currentTime=0;this.destination={};h.contexts.push(this);}
    resume(){if(h.resumeMode==='hold')return new Promise(resolve=>h.resumeWaiters.push(()=>{this.state='running';resolve();}));this.state='running';return Promise.resolve();}
    suspend(){this.state='suspended';return Promise.resolve();}
    createGain(){return node();}createOscillator(){return node();}
    createBuffer(channels,n,rate){return {duration:n/rate,getChannelData:()=>new Float32Array(n)};}
    createBufferSource(){const b={active:false,starts:0,connect(){},disconnect(){},start(){this.active=true;this.starts++;this.lateEnd=this.onended;},stop(){this.active=false;},end(){this.active=false;if(this.onended)this.onended();}};h.pcm.push(b);return b;}
    createMediaStreamSource(stream){const g={stream,connected:false,connect(a){this.connected=true;a.graph=this;},disconnect(){this.connected=false;}};h.graphs.push(g);return g;}
    createAnalyser(){return {fftSize:512,frequencyBinCount:256,getByteTimeDomainData(a){a.fill(128);},getByteFrequencyData(a){a.fill(0);}};}
  }
  window.AudioContext=window.webkitAudioContext=Context;
  h.releaseResume=()=>{h.resumeMode='auto';h.resumeWaiters.splice(0).forEach(resolve=>resolve());};
  class Recorder{constructor(){this.state='inactive';this.mimeType='audio/webm';}start(){this.state='recording';}stop(){this.state='inactive';queueMicrotask(()=>{if(this.ondataavailable)this.ondataavailable({data:new Blob(['local'])});if(this.onstop)this.onstop();});}}
  window.MediaRecorder=Recorder;
  class Media{
    constructor(src){this.src=src;this.volume=1;this.active=false;this.plays=0;this.pauses=0;h.media.push(this);}
    play(){this.active=true;this.plays++;this.lateEnd=this.onended;this.lateError=this.onerror;return Promise.resolve();}
    pause(){this.active=false;this.pauses++;}removeAttribute(){}load(){}
    end(){this.active=false;if(this.onended)this.onended();}
  }
  window.Audio=Media;
  window.speechSynthesis.speak=u=>{h.voices.push({u,active:true,lateEnd:u.onend});};
  window.speechSynthesis.cancel=()=>{h.voices.forEach(v=>{v.active=false;});};
  h.endVoice=i=>{const v=h.voices[i];v.active=false;if(v.u.onend)v.u.onend();};
  const bytes=()=>new ArrayBuffer(48000);
  const db={objectStoreNames:{contains:()=>true},close(){},transaction(){const tx={abort(){},objectStore(){return {
    get(key){h.cacheKeys.push(key);const q={};const complete=()=>{q.result=h.cacheMode==='miss'?null:bytes();if(q.onsuccess)q.onsuccess();};if(h.cacheMode==='defer')h.cachePending.push(complete);else queueMicrotask(complete);return q;},
    put(){queueMicrotask(()=>{if(tx.oncomplete)tx.oncomplete();});return {};}
  };}};return tx;}};
  Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(name){if(name!=='sona-tts')throw new Error('unexpected test database '+name);const request={result:db};queueMicrotask(()=>{if(request.onsuccess)request.onsuccess();});return request;}}});
  h.releaseCache=()=>h.cachePending.splice(0).forEach(done=>done());
  window.fetch=(url,options)=>{
    if(String(url)==='/api/tts'){
      const request={text:JSON.parse(options.body).text,signal:options.signal};h.fetches.push(request);
      const response=()=>({ok:h.fetchMode!=='fail',arrayBuffer:async()=>bytes()});
      if(h.fetchMode==='defer')return new Promise(resolve=>h.fetchPending.push(()=>resolve(response())));
      return Promise.resolve(response());
    }
    return fetch(url,options);
  };
  h.releaseFetch=()=>h.fetchPending.splice(0).forEach(done=>done());
  function nativeEvent(event){const entries=JSON.parse(sessionStorage.getItem('sona.test.nativeEvents')||'[]');entries.push(event);sessionStorage.setItem('sona.test.nativeEvents',JSON.stringify(entries));}
  let sona;
  Object.defineProperty(window,'Sona',{configurable:true,get:()=>sona,set(value){sona=value;value.confetti=()=>{};
    value.speechStart=()=>new Promise(resolve=>{const entry={id:h.nativeStarts.length+1,settled:false,grant(){if(this.settled)return;this.settled=true;h.nativeActive=this.id;nativeEvent('start:'+this.id);resolve(true);}};h.nativeStarts.push(entry);if(!h.deferNative)entry.grant();});
    value.speechStop=()=>{const id=h.nativeActive;h.nativeStops.push(id);if(id!==null)nativeEvent('stop:'+id);h.nativeActive=null;return Promise.resolve({text:'rrrr',onDevice:true});};
  }});
  if(!localStorage.getItem('sona.test.audioSeed')){
    localStorage.setItem('sona.test.audioSeed','1');
    localStorage.setItem('sona.freeera.v1','post');localStorage.setItem('sona.freeera2.v1','done');localStorage.setItem('sona.freeera3.v1','done');localStorage.setItem('sona.freeera4.v1','done');localStorage.setItem('sona.micok','1');
    localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Mia',childAge:'7',focusSounds:['R'],onboarded:true,earlyAdopter:true,volume:0,voiceOn:false,soundOn:false}));
    sessionStorage.setItem('sona.run.v1',JSON.stringify({active:true,round:0,scores:[],sum:0,sound:'R',level:1,pending:false,games:['slice','tiles','stack','run','glide']}));
  }
}
async function fresh(config={}){
  const context=await browser.newContext();await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  await context.addInitScript(device,config);const page=await context.newPage();page.setDefaultTimeout(4500);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/charge.html?daily=1');await page.waitForFunction(()=>__audioHarness.graphs.some(g=>g.connected));
  return {context,page,errors};
}
async function background(page){await page.evaluate(()=>__audioHarness.background());await page.waitForTimeout(35);}
async function resume(page){
  await page.evaluate(()=>__audioHarness.foreground());await page.waitForTimeout(20);
  const present=await page.locator('#pauseResume').count();ok('explicit Resume is available',present===1);if(!present)return false;
  await page.locator('#pauseResume').evaluate(el=>el.click());return true;
}
async function state(page){return page.evaluate(()=>({media:__audioHarness.media.reduce((n,a)=>n+a.plays,0),mediaLive:__audioHarness.media.filter(a=>a.active).length,pcm:__audioHarness.pcm.reduce((n,a)=>n+a.starts,0),pcmLive:__audioHarness.pcm.filter(a=>a.active).length,voices:__audioHarness.voices.length,voicesLive:__audioHarness.voices.filter(v=>v.active).length,guard:ttsPlaying,engine:engineOn,graphs:__audioHarness.graphs.filter(g=>g.connected).length,native:__audioHarness.nativeActive,done:window.__audioDone||0}));}
function noErrors(name,errors){ok(name+' has no page errors',errors.length===0,errors);}

await scenario('human prompt cancellation',async()=>{
  const {context,page,errors}=await fresh();try{
    await page.evaluate(()=>{profile.volume=0.4;profile.voiceOn=true;HUMANCLIPS=true;window.__audioDone=0;playPrompt().then(()=>__audioDone++);});
    await page.waitForFunction(()=>__audioHarness.media.length===1&&__audioHarness.media[0].active);
    await background(page);const paused=await state(page);
    ok('pause stops the human clip and releases its speaker guard',paused.mediaLive===0&&!paused.guard,paused);
    await page.evaluate(()=>{const a=__audioHarness.media[0];if(a.lateEnd)a.lateEnd();if(a.lateError)a.lateError();});await page.waitForTimeout(30);
    const late=await state(page);ok('late human callbacks cannot complete the suspended prompt or play again',late.done===0&&late.media===1&&late.pcm===0&&late.voices===0,late);
    if(!await resume(page))return;
    await page.waitForFunction(()=>__audioHarness.media.reduce((n,a)=>n+a.plays,0)===2);
    const active=await state(page);ok('Resume restarts one human prompt',active.media===2&&active.mediaLive===1&&active.guard,active);
    await page.evaluate(()=>__audioHarness.media[1].end());await page.waitForFunction(()=>__audioDone===1);
    ok('the resumed human prompt settles once and balances its guard',!(await state(page)).guard);
    noErrors('human prompt',errors);
  }finally{await context.close();}
});

for(const edge of ['cache','fetch'])await scenario('late '+edge+' response',async()=>{
  const {context,page,errors}=await fresh();try{
    await page.evaluate(edge=>{profile.volume=0.4;profile.voiceOn=true;HUMANCLIPS=false;__audioHarness.cacheMode=edge==='cache'?'defer':'miss';__audioHarness.fetchMode='defer';window.__audioDone=0;playPrompt().then(()=>__audioDone++);},edge);
    await page.waitForFunction(edge=>edge==='cache'?__audioHarness.cachePending.length>0:__audioHarness.fetchPending.length>0,edge);
    const original=await page.evaluate(edge=>edge==='cache'?__audioHarness.cacheKeys[0]:__audioHarness.fetches[0].text,edge);
    await background(page);
    await page.evaluate(edge=>{__audioHarness.cacheMode=edge==='cache'?'hit':'miss';__audioHarness.fetchMode='success';if(edge==='cache')__audioHarness.releaseCache();else __audioHarness.releaseFetch();},edge);
    await page.waitForTimeout(50);const hidden=await state(page);
    ok('late '+edge+' bytes cannot play while hidden',hidden.media===0&&hidden.pcm===0&&hidden.voices===0,hidden);
    if(edge==='fetch')ok('pause aborts the in-flight TTS request',await page.evaluate(()=>!!__audioHarness.fetches[0].signal?.aborted));
    if(!await resume(page))return;
    await page.waitForFunction(()=>__audioHarness.pcm.some(p=>p.starts));
    const resumed=await state(page);ok('Resume plays one fresh '+edge+' result',resumed.pcm===1&&resumed.pcmLive===1,resumed);
    const requests=await page.evaluate(edge=>edge==='cache'?__audioHarness.cacheKeys:__audioHarness.fetches.map(f=>f.text),edge);
    ok('Resume retains the captured prompt for '+edge,requests.length===2&&requests.every(t=>t===original),requests);
    await page.evaluate(()=>__audioHarness.pcm.find(p=>p.active).end());await page.waitForFunction(()=>__audioDone===1);
    ok('resumed '+edge+' playback releases the speaker guard',!(await state(page)).guard);noErrors(edge+' cancellation',errors);
  }finally{await context.close();}
});

await scenario('native browser speech cancellation',async()=>{
  const {context,page,errors}=await fresh();try{
    await page.evaluate(()=>{profile.volume=0.4;profile.voiceOn=true;HUMANCLIPS=false;window.__audioDone=0;playPrompt().then(()=>__audioDone++);});
    await page.waitForFunction(()=>__audioHarness.voices.length===1);
    const text=await page.evaluate(()=>__audioHarness.voices[0].u.text);
    await background(page);const paused=await state(page);
    ok('pause cancels native browser speech and balances its guard',paused.voicesLive===0&&!paused.guard,paused);
    await page.evaluate(()=>{const end=__audioHarness.voices[0].lateEnd;if(end)end();});await page.waitForTimeout(25);
    ok('late browser-speech end cannot finish the suspended line',(await state(page)).done===0);
    if(!await resume(page))return;await page.waitForFunction(()=>__audioHarness.voices.length===2);
    ok('Resume speaks the same captured line once',await page.evaluate(text=>__audioHarness.voices.length===2&&__audioHarness.voices[1].u.text===text,text));
    await page.evaluate(()=>__audioHarness.endVoice(1));await page.waitForFunction(()=>__audioDone===1);noErrors('browser speech',errors);
  }finally{await context.close();}
});

await scenario('slow replay cancellation',async()=>{
  const {context,page,errors}=await fresh();try{
    await page.evaluate(()=>{profile.volume=0.4;profile.voiceOn=true;__audioHarness.cacheMode='hit';window.__audioDone=0;saySlow('Make your R sound').then(()=>__audioDone++);});
    await page.waitForFunction(()=>__audioHarness.media.length===1&&__audioHarness.media[0].active);
    ok('slow replay preserves rate and pitch',await page.evaluate(()=>__audioHarness.media[0].playbackRate===0.7&&__audioHarness.media[0].preservesPitch===true));
    await background(page);const paused=await state(page);ok('pause stops slow replay and balances its guard',paused.mediaLive===0&&!paused.guard,paused);
    await page.evaluate(()=>{const a=__audioHarness.media[0];if(a.lateEnd)a.lateEnd();});
    if(!await resume(page))return;await page.waitForFunction(()=>__audioHarness.media.length===2&&__audioHarness.media[1].active);
    ok('one slow replay resumes at the same rate',await page.evaluate(()=>__audioHarness.media.length===2&&__audioHarness.media[1].playbackRate===0.7));
    await page.evaluate(()=>__audioHarness.media[1].end());await page.waitForFunction(()=>__audioDone===1);
    ok('slow replay settles once and balances its guard',!(await state(page)).guard);noErrors('slow replay',errors);
  }finally{await context.close();}
});

await scenario('late native recognizer start',async()=>{
  const {context,page,errors}=await fresh({deferNative:true});try{
    await page.waitForFunction(()=>__audioHarness.nativeStarts.length===1);await background(page);
    await page.evaluate(()=>__audioHarness.nativeStarts[0].grant());await page.waitForTimeout(40);
    const hidden=await state(page);ok('a native recognizer starting late is stopped while hidden',hidden.native===null&&hidden.graphs===0,hidden);
    if(!await resume(page))return;
    await page.evaluate(()=>{__audioHarness.deferNative=false;__audioHarness.nativeStarts.filter(s=>!s.settled).forEach(s=>s.grant());});
    await page.waitForFunction(()=>__audioHarness.nativeStarts.length===2&&__audioHarness.nativeActive===2);
    const before=await page.evaluate(()=>__audioHarness.nativeStops.length);
    await page.evaluate(()=>__audioHarness.timers.filter(t=>!t.active&&t.ms>=8900&&t.ms<=9100).forEach(t=>t.raw()));await page.waitForTimeout(20);
    const after=await state(page);ok('an old recognition timer cannot stop the resumed segment',after.native===2&&await page.evaluate(()=>__audioHarness.nativeStops.length)===before,after);
    noErrors('native start',errors);
  }finally{await context.close();}
});

await scenario('delayed AudioContext resume',async()=>{
  const {context,page,errors}=await fresh();try{
    await page.evaluate(()=>{__audioHarness.resumeMode='hold';});await background(page);
    if(!await resume(page))return;await page.waitForFunction(()=>__audioHarness.resumeWaiters.length>0);
    const blocked=await state(page);
    const budget=await page.evaluate(()=>__audioHarness.timers.filter(t=>t.active&&t.ms>=19000&&t.ms<=20001).length);
    ok('a suspended context starts neither graph nor listening budget',blocked.graphs===0&&!blocked.engine&&budget===0,{...blocked,budget});
    await page.evaluate(()=>__audioHarness.releaseResume());await page.waitForFunction(()=>engineOn&&__audioHarness.graphs.some(g=>g.connected));
    const active=await state(page);ok('resolved audio resume starts one listening graph',active.graphs===1&&active.engine,active);noErrors('audio context resume',errors);
  }finally{await context.close();}
});

await scenario('Home waits for a pending native start',async()=>{
  const {context,page,errors}=await fresh({deferNative:true});try{
    await page.waitForFunction(()=>__audioHarness.nativeStarts.length===1);
    await page.locator('#close').evaluate(el=>el.click());await page.waitForTimeout(45);
    const waiting=new URL(page.url()).pathname==='/charge.html';ok('Home waits until late native startup can be stopped',waiting,page.url());
    if(!waiting)return;
    await page.evaluate(()=>__audioHarness.nativeStarts[0].grant());await page.waitForURL('**/today.html');
    const events=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('sona.test.nativeEvents')||'[]'));
    ok('native cleanup finishes before Home navigation',events.join(',')==='start:1,stop:1',events);noErrors('native Home exit',errors);
  }finally{await context.close();}
});

await browser.close();await new Promise(resolve=>server.close(resolve));
console.log(`${assertions} assertions, ${failures} failures (${publicRoot})`);process.exitCode=failures?1:0;
