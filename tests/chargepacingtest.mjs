// Real practice flow with silent, controllable device edges. Model playback
// must finish before the child turn begins, including on a cold voice list.
import {createServer} from 'http';
import {existsSync,readFileSync,statSync} from 'fs';
import path from 'path';
import {chromium,ROOT,launchOpts} from './_env.mjs';
const root=process.env.SONATEST_PUBLIC_ROOT||ROOT, origin='http://127.0.0.1:8197';
const mime={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',webp:'image/webp',woff2:'font/woff2'};
const server=createServer((req,res)=>{
  const url=new URL(req.url,origin),file=path.join(root,url.pathname);
  if(url.pathname.startsWith('/api/')){res.writeHead(503);res.end('{}');return;}
  if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':mime[file.split('.').pop()]||'application/octet-stream'});res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(8197,'127.0.0.1',resolve));
const browser=await chromium.launch(launchOpts());
let assertions=0,failures=0;
function ok(name,pass,detail=''){assertions++;if(!pass)failures++;console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' → '+JSON.stringify(detail)));}
async function scenario(name,fn){try{await fn();}catch(e){ok(name+' completes without exception',false,e.stack);}}
function device(config){
  const h=window.__pacing={voices:[],media:[],pcm:[],streams:[],diagnostics:[],fetches:0,hidden:false};
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>h.hidden});
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>h.hidden?'hidden':'visible'});
  h.background=()=>{h.hidden=true;document.dispatchEvent(new Event('visibilitychange'));};
  h.foreground=()=>{h.hidden=false;document.dispatchEvent(new Event('visibilitychange'));};
  navigator.mediaDevices.getUserMedia=async()=>{const track={readyState:'live',stop(){this.readyState='ended';}};const s={at:performance.now(),getTracks:()=>[track],getAudioTracks:()=>[track]};h.streams.push(s);return s;};
  h.micLive=()=>h.streams.some(s=>s.getTracks()[0].readyState==='live');
  // Every "Your turn" the child is shown, with what the mic was doing then.
  h.turns=[];
  new MutationObserver(()=>{const el=document.getElementById('turnStatus');if(el&&el.textContent==='Your turn'){const last=h.streams[h.streams.length-1];h.turns.push({live:h.micLive(),sinceOpen:last?performance.now()-last.at:-1});}}).observe(document,{subtree:true,childList:true,characterData:true});
  function parameter(){return {value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}};}
  function node(){return {gain:parameter(),frequency:parameter(),connect(){},disconnect(){},start(){},stop(){}};}
  class Context{
    constructor(){this.state='running';this.currentTime=0;this.sampleRate=48000;this.destination={};}
    resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}
    createGain(){return node();}createOscillator(){return node();}
    createBuffer(c,n,rate){return {duration:n/rate,getChannelData:()=>new Float32Array(n)};}
    createBufferSource(){const p={active:false,connect(){},disconnect(){},start(){this.active=true;},stop(){this.active=false;},end(){this.active=false;if(this.onended)this.onended();}};h.pcm.push(p);return p;}
    createMediaStreamSource(){return {connect(){},disconnect(){}};}
    createAnalyser(){return {fftSize:512,frequencyBinCount:256,getByteTimeDomainData(a){a.fill(128);},getByteFrequencyData(a){a.fill(0);}};}
  }
  window.AudioContext=window.webkitAudioContext=Context;
  class Recorder{constructor(){this.state='inactive';this.mimeType='audio/webm';}start(){this.state='recording';}stop(){this.state='inactive';queueMicrotask(()=>{if(this.onstop)this.onstop();});}}
  window.MediaRecorder=Recorder;
  class Media{
    constructor(){this.active=false;h.media.push(this);}play(){this.active=true;return Promise.resolve();}pause(){this.active=false;}removeAttribute(){}load(){}end(){this.active=false;if(this.onended)this.onended();}
  }
  window.Audio=Media;
  speechSynthesis.getVoices=()=>[];
  speechSynthesis.speak=u=>{h.voices.push({u,active:true,end(){this.active=false;if(u.onend)u.onend();}});};
  speechSynthesis.cancel=()=>h.voices.forEach(v=>v.active=false);
  const fetch=window.fetch.bind(window);
  window.fetch=(url,options)=>String(url)==='/api/tts'?(h.fetches++,Promise.resolve({ok:!!config.server,status:config.server?200:503,headers:{get:name=>config.server?({'X-Sona-Voice-Provider':'elevenlabs','X-Sona-Voice-Cache':'miss','X-Sona-Voice-Model':'eleven_multilingual_v2','X-Sona-Voice-Revision':'v8'}[name]||null):null},arrayBuffer:async()=>new ArrayBuffer(96000)})):fetch(url,options);
  let sona;
  Object.defineProperty(window,'Sona',{configurable:true,get:()=>sona,set(value){sona=value;value.humanClipsOn=()=>!!config.human;value.confetti=()=>{};value.speechStart=()=>Promise.resolve(false);value.speechStop=()=>Promise.resolve(null);const diagnostic=value.voiceDiagnostic;value.voiceDiagnostic=event=>{const saved=diagnostic?diagnostic(event):event;h.diagnostics.push(saved);return saved;};}});
  localStorage.setItem('sona.freeera.v1','post');localStorage.setItem('sona.freeera2.v1','done');localStorage.setItem('sona.freeera3.v1','done');localStorage.setItem('sona.freeera4.v1','done');localStorage.setItem('sona.micok','1');
  localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Mia',childAge:'7',focusSounds:['R'],onboarded:true,earlyAdopter:true,volume:config.muted?0:0.4,voiceOn:!config.muted,soundOn:false}));
  sessionStorage.setItem('sona.run.v1',JSON.stringify({active:true,round:0,sum:0,scores:[],sound:'R',level:1,pending:false,games:['slice','tiles','stack','run','glide']}));
}
async function fresh(config={}){
  const context=await browser.newContext({viewport:{width:320,height:568},reducedMotion:'reduce'});
  await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  await context.addInitScript(device,config);
  const page=await context.newPage();page.setDefaultTimeout(4500);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/charge.html?daily=1');return {context,page,errors};
}
async function status(page){return page.evaluate(()=>document.getElementById('turnStatus')?.textContent||'');}
// REWRITTEN 24 Sep 2026: "Your turn" used to light the moment the listening
// engine started (engineOn), before the mic had measured the room. Sona now
// opens the mic only after Echo has been quiet for a quarter-second and shows
// the cue only once the room is measured, so the child turn is awaited on the
// cue itself rather than on the engine flag.
async function childTurn(page){await page.waitForFunction(()=>document.getElementById('turnStatus')?.textContent==='Your turn');}
async function state(page){return page.evaluate(()=>({engine:engineOn,guard:ttsPlaying,voices:__pacing.voices.length,active:__pacing.voices.filter(v=>v.active).length,reps:reps,stored:Sona.repsToday(),diagnostics:__pacing.diagnostics}));}
function clean(name,errors){ok(name+' has no runtime errors',errors.length===0,errors);}

await scenario('cold browser voice list',async()=>{
  const {context,page,errors}=await fresh();try{
    await page.waitForFunction(()=>__pacing.voices.length===1);
    ok('model speech is clearly marked as a listening turn',/Listen to Echo/.test(await status(page)));
    ok('the visible replay control describes its action',await page.locator('#replayLabel').count()===1&&await page.locator('#replayLabel').innerText()==='Tap Echo to hear it again');
    await page.waitForTimeout(1500);
    const held=await state(page);
    ok('an initially empty voice list does not cut a live prompt off at 1.2 seconds',held.active===1&&held.guard,held);
    ok('the child turn waits for the model to finish',!held.engine&&held.reps===0&&held.stored===0,held);
    ok('replay cannot queue over the model',await page.locator('#echoBuddy').isDisabled()&&await page.locator('#turtleBtn').isDisabled());
    ok('the prompt plays into a closed microphone',await page.evaluate(()=>__pacing.voices[0].active&&!__pacing.micLive()),await page.evaluate(()=>__pacing.streams.length));
    await page.evaluate(()=>__pacing.voices[0].end());await childTurn(page);
    ok('the real speech end opens a clearly labeled child turn',/Your turn/.test(await status(page)));
    const first=await page.evaluate(()=>__pacing.turns[0]);
    // 24 Sep 2026: this fake mic delivers pure digital zeros, so the page gets
    // no room reading before the prompt (ROOM FLOOR) and the window measures
    // its own first quarter-second — the one case where the cue still waits.
    // micquietpracticetest pins the usual case: a room already known, a cue
    // as soon as the window opens.
    ok('the child turn is shown only once the mic is open and the room measured',!!first&&first.live&&first.sinceOpen>=240,first);
    ok('child-turn replay is enabled',await page.locator('#echoBuddy').isEnabled());
    ok('the microphone is a listening status, not a replay button',await page.locator('#micBtn').evaluate(el=>el.tagName==='DIV'&&el.getAttribute('role')==='img'&&el.getAttribute('aria-label')==='Microphone listening'&&el.tabIndex===-1));
    const opened=await page.evaluate(()=>__pacing.streams.length);
    await page.locator('#echoBuddy').click();await page.waitForFunction(()=>__pacing.voices.length===2);
    ok('a replay closes the listening window before Echo speaks',await page.evaluate(()=>__pacing.voices[1].active&&!__pacing.micLive()&&!engineOn));
    await page.evaluate(()=>{document.getElementById('echoBuddy').click();document.getElementById('turtleBtn').click();});
    await page.waitForTimeout(50);
    ok('repeated replay taps cannot stack speech',await page.evaluate(()=>__pacing.voices.length===2));
    ok('replay returns to the listening cue',/Listen to Echo/.test(await status(page)));
    // REWRITTEN 24 Sep 2026: the turn now comes back a quarter-second after
    // the replay ends, in a freshly opened mic (it was the same open mic).
    await page.evaluate(()=>__pacing.voices[1].end());await childTurn(page);
    ok('finishing replay returns to the same child turn',/Your turn/.test(await status(page))&&(await state(page)).reps===0);
    ok('…in a fresh mic opened after the replay, with every cue on a live mic',await page.evaluate(n=>__pacing.streams.length===n+1&&__pacing.micLive()&&__pacing.turns.every(t=>t.live),opened));
    const events=await page.evaluate(()=>__pacing.diagnostics);
    ok('fallback diagnostics identify the local browser and API failure without prompt data',events.some(e=>e.source==='browser'&&e.reason==='api-error'&&e.status===503)&&events.every(e=>!('text'in e)&&!('voiceId'in e)&&!('childName'in e)),events);
    const fit=await page.evaluate(()=>{const a=document.getElementById('turnStatus'),b=document.getElementById('replayLabel');return a&&b&&a.getBoundingClientRect().top>=0&&b.getBoundingClientRect().bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth;});
    ok('turn cue and replay label remain visible on a narrow phone',fit);
    clean('cold voice list',errors);
  }finally{await context.close();}
});

await scenario('human model and interruption',async()=>{
  const {context,page,errors}=await fresh({human:true});try{
    await page.waitForFunction(()=>__pacing.media.some(m=>m.active));
    ok('human recording uses the same listening cue',/Listen to Echo/.test(await status(page)));
    ok('human playback is identified locally',await page.evaluate(()=>__pacing.diagnostics.some(e=>e.source==='human')));
    const target=await page.locator('#bTarget').innerText();
    await page.evaluate(()=>__pacing.background());await page.locator('#pauseOvl.show').waitFor();
    ok('pausing stops the model and withholds the child turn',await page.evaluate(()=>!__pacing.media.some(m=>m.active)&&!engineOn));
    await page.evaluate(()=>__pacing.foreground());await page.locator('#pauseResume').click();
    await page.waitForFunction(()=>__pacing.media.filter(m=>m.active).length===1&&__pacing.media.length===2);
    ok('Resume first completes the same model before listening to the child',/Listen to Echo/.test(await status(page))&&await page.locator('#bTarget').innerText()===target&&!(await state(page)).engine);
    await page.evaluate(()=>__pacing.media[1].end());await childTurn(page);
    ok('resumed model hands over once to the child',/Your turn/.test(await status(page)));
    clean('human model',errors);
  }finally{await context.close();}
});

await scenario('server and cached playback',async()=>{
  const {context,page,errors}=await fresh({server:true});try{
    await page.waitForFunction(()=>__pacing.pcm.some(p=>p.active));
    ok('server audio is marked as listening until actual completion',/Listen to Echo/.test(await status(page))&&!(await state(page)).engine);
    ok('fresh audio identifies the reported server provider',await page.evaluate(()=>__pacing.diagnostics.some(e=>e.source==='elevenlabs'&&e.cache==='miss'&&e.model==='eleven_multilingual_v2'&&e.revision==='v8')));
    await page.evaluate(()=>__pacing.pcm.find(p=>p.active).end());await childTurn(page);
    await page.locator('#echoBuddy').click();await page.waitForFunction(()=>__pacing.pcm.some(p=>p.active));
    // Repeated isolation prompts can use a shorter line; replay the exact
    // captured first prompt through the real queue to exercise a cache hit.
    await page.evaluate(()=>__pacing.pcm.find(p=>p.active).end());await page.waitForTimeout(30);
    await page.evaluate(()=>{window.__cacheProbe=say('A short cached line.');});await page.waitForFunction(()=>__pacing.pcm.some(p=>p.active));
    await page.evaluate(()=>__pacing.pcm.find(p=>p.active).end());await page.waitForTimeout(30);
    await page.evaluate(()=>{window.__cacheProbe=say('A short cached line.');});await page.waitForFunction(()=>__pacing.pcm.some(p=>p.active));
    ok('cached playback reports cache reuse without claiming a fresh provider call',await page.evaluate(()=>__pacing.diagnostics.some(e=>e.source==='cache'&&e.cache==='device')));
    ok('cached model keeps the listening cue',/Listen to Echo/.test(await status(page)));
    clean('server/cache',errors);
  }finally{await context.close();}
});

await scenario('muted practice',async()=>{
  const {context,page,errors}=await fresh({muted:true});try{
    await childTurn(page);
    ok('muted practice proceeds straight to a visible child turn',/Your turn/.test(await status(page)));
    ok('muted practice starts no model playback',await page.evaluate(()=>!__pacing.voices.length&&!__pacing.media.length&&!__pacing.pcm.length&&!__pacing.fetches));
    clean('muted practice',errors);
  }finally{await context.close();}
});
await browser.close();await new Promise(resolve=>server.close(resolve));
console.log(failures?failures+' FAILURES / '+assertions+' assertions':'ALL GREEN — '+assertions+' assertions');process.exit(failures?1:0);
