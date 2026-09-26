// REPGUARD1: real Web Audio signals enter the real practice engine through a
// synthetic MediaStream. No hardware microphone, speaker, or external network.
// These fixtures reject common non-speech; they cannot establish that speech
// came from a child rather than a nearby adult or TV using one microphone.
// Baseline: SONATEST_PUBLIC_ROOT=/tmp/sona-c1578b4/public node tests/repguardtest.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium, ROOT, launchOpts } from './_env.mjs';
const publicRoot = process.env.SONATEST_PUBLIC_ROOT || ROOT;
const MIME = { html:'text/html', js:'text/javascript', css:'text/css', svg:'image/svg+xml', png:'image/png', webp:'image/webp', woff2:'font/woff2', mp3:'audio/mpeg' };
const server = createServer((req,res) => {
  const u = new URL(req.url,'http://local');
  if (u.pathname==='/__shared') { res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><script src="/sona.js"></script>');return; }
  if (u.pathname.startsWith('/api/')) { res.writeHead(200,{'content-type':'application/json'});res.end('{}');return; }
  const file=path.join(publicRoot,u.pathname);
  if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':MIME[file.split('.').pop()]||'application/octet-stream'});res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(launchOpts(['--autoplay-policy=no-user-gesture-required']));
let checks=0,failures=0;
function ok(name,pass,detail=''){checks++;if(!pass)failures++;console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' → '+JSON.stringify(detail)));}
async function scenario(name,fn){try{await fn();}catch(e){ok(name+' completes',false,e.stack);}}
function signalDevice(config){
  const h=window.__repHarness={streams:[],effects:[],frames:0,speechFrames:0,verifyCalls:0,modelLines:[],metrics:[],source:null,ctx:null,decoder:null,voicePlays:0,mediaPlays:0,browserVoice:0,roomPeak:0,micHeardPage:false,recognizing:false,recognizerHeard:false};
  const AC=window.AudioContext||window.webkitAudioContext;
  // Every accidental connection to physical output is muted at the graph,
  // in addition to the suite-wide Chromium and speech-synthesis mute.
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(destination,...rest){
    if(destination===this.context.destination){
      const silent=this.context.createGain();silent.gain.value=0;connect.call(silent,destination);
      // VOICE ON (24 Sep 2026): whatever the page plays also reaches "the
      // room", which every fake mic hears — pessimistically, at full level
      // and without the phone's echo cancellation.
      if(config.voice&&h.room&&this.context===h.ctx)connect.call(this,h.room);
      return connect.call(this,silent,...rest);
    }
    return connect.call(this,destination,...rest);
  };
  if(config.voice){
    // One context for the page, sona.js's chimes and the fake mic, so the
    // page's own output can be routed into its own microphone. The room is
    // heard 200ms late, like a Bluetooth speaker: a mic that opens the moment
    // Echo stops would still hear the end of Echo.
    h.shared=()=>{
      if(h.ctx)return h.ctx;
      const ctx=h.ctx=new AC({sampleRate:48000});
      h.room=ctx.createGain();h.late=ctx.createDelay(1);h.late.delayTime.value=.2;connect.call(h.room,h.late);
      h.mon=ctx.createAnalyser();h.mon.fftSize=1024;connect.call(h.late,h.mon);
      // The child is in the room too: whatever they say reaches every mic
      // Sona opens, whenever it opens (config.child, below).
      h.childBus=ctx.createGain();
      // config.floor: a real mic's own faint hiss (white, dBFS), so the room
      // Sona measures is never pure digital zeros.
      // config.warm: the mic sends exact digital zeros for that many ms after
      // it first opens (a phone's mic starting up), and only then its hiss.
      if(config.floor){const n=ctx.sampleRate*8,b=ctx.createBuffer(1,n,ctx.sampleRate),x=b.getChannelData(0),k=Math.pow(10,config.floor/20)*Math.sqrt(3);let st=7;
        for(let i=0;i<n;i++){st=(Math.imul(st,1664525)+1013904223)>>>0;x[i]=(st/2147483648-1)*k;}
        h.floorGain=ctx.createGain();h.floorGain.gain.value=config.warm?0:1;connect.call(h.floorGain,h.childBus);
        const src=ctx.createBufferSource();src.buffer=b;src.loop=true;connect.call(src,h.floorGain);src.start();}
      return ctx;
    };
    const Shared=function(){return h.shared();};
    Object.defineProperty(window,'AudioContext',{configurable:true,writable:true,value:Shared});
    Object.defineProperty(window,'webkitAudioContext',{configurable:true,writable:true,value:Shared});
    // The slow replay is an <audio> element: route it through the room too.
    const RealAudio=window.Audio;
    window.Audio=function(src){const el=new RealAudio(src);try{const node=h.shared().createMediaElementSource(el);node.connect(h.ctx.destination);}catch(e){h.audioRouteError=String(e);}return el;};
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){
      h.mediaPlays++;
      // Native generated PCM now travels in a WAV media element; count that
      // prompt too while still routing its actual samples through the room.
      if(this.src.indexOf('blob:')===0)h.voicePlays++;
      h.shared().resume(); // media output is independent of the app's suspended Web Audio context
      return play.call(this);
    };
    const start=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){
      if(this.buffer&&this.buffer.sampleRate===24000){
        h.voicePlays++;
        // config.child: the child answers `onset` ms after Echo's first line
        // (the prompt) ends, saying Rachel's recorded R into the room.
        if(config.child&&h.voicePlays===1)this.addEventListener('ended',()=>{h.promptEnd=performance.now();h.decodeChild().then(b=>{
          const node=h.ctx.createBufferSource();node.buffer=b;connect.call(node,h.childBus);
          node.onended=()=>{h.childDone=performance.now();};node.start(h.ctx.currentTime+config.child.onset/1000);});});
      }
      return start.apply(this,args);
    };
    window.speechSynthesis.speak=u=>{h.browserVoice++;setTimeout(()=>{if(u.onend)u.onend();},10);};
    // Echo's voice for every line: a real recorded R (the target sound
    // itself, the worst case), as the 24kHz PCM /api/tts returns.
    const realFetch=window.fetch.bind(window);
    // The child's recording, decoded ahead (on the first mic open) so their
    // answer starts on time; cut to 3s like every positive fixture here.
    h.childBuf=null;
    h.decodeChild=()=>h.childBuf||(h.childBuf=(async()=>{const buf=await h.shared().decodeAudioData(await(await realFetch('/coach/say/R-demo.mp3')).arrayBuffer());
      const out=h.ctx.createBuffer(1,Math.min(buf.length,h.ctx.sampleRate*3),h.ctx.sampleRate);out.copyToChannel(buf.getChannelData(0).subarray(0,out.length),0);return out;})());
    h.ttsBytes=()=>h.tts||(h.tts=(async()=>{
      const buf=await h.shared().decodeAudioData(await(await realFetch('/coach/say/R.mp3')).arrayBuffer());
      const x=buf.getChannelData(0);let on=0;
      for(let i=0;i+480<x.length;i+=480){let e=0;for(let j=i;j<i+480;j++)e+=x[j]*x[j];if(Math.sqrt(e/480)>.01){on=i;break;}}
      const step=buf.sampleRate/24000,n=Math.floor(Math.min(1.2*24000,(x.length-on)/step)),out=new Int16Array(n);
      for(let i=0;i<n;i++)out[i]=Math.max(-32767,Math.min(32767,Math.round(x[on+Math.floor(i*step)]*32767)));
      return out.buffer;
    })());
    window.fetch=(url,options)=>String(url)==='/api/tts'?h.ttsBytes().then(b=>({ok:true,status:200,headers:{get:()=>null},arrayBuffer:async()=>b.slice(0)})):realFetch(url,options);
    // What the room carried, sampled every 10ms: did any of it reach a live
    // mic, or a running native recognizer?
    setInterval(()=>{
      if(!h.mon)return;const a=new Float32Array(h.mon.fftSize);h.mon.getFloatTimeDomainData(a);
      let e=0;for(const v of a)e+=v*v;const level=Math.sqrt(e/a.length);if(level>h.roomPeak)h.roomPeak=level;
      if(level<.01)return;
      if(h.recognizing)h.recognizerHeard=true;
      if(h.streams.some(st=>st.getTracks().some(t=>t.readyState==='live')))h.micHeardPage=true;
    },10);
  }
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
    // config.pre: the child says the first `pre` s of their R from the moment
    // the grown-up taps (the first request), before the mic has even opened
    // and before Echo has said anything: it covers the whole room reading.
    if(config.pre&&!h.preAsked){h.preAsked=true;h.decodeChild().then(b=>{const ctx=h.ctx,cut=ctx.createBuffer(1,Math.round(ctx.sampleRate*config.pre),ctx.sampleRate);cut.copyToChannel(b.getChannelData(0).subarray(0,cut.length),0);
      const node=ctx.createBufferSource();node.buffer=cut;connect.call(node,h.childBus);node.onended=()=>{h.preEnd=performance.now();};node.start();h.preAt=performance.now();});}
    // config.micDelay: how long the phone takes to open the mic.
    if(config.micDelay)await new Promise(r=>setTimeout(r,config.micDelay));
    const ctx=config.voice?h.shared():new AC({sampleRate:48000});await ctx.resume();
    const destination=ctx.createMediaStreamDestination();
    if(config.voice){connect.call(h.late,destination);connect.call(h.childBus,destination);if(config.child)h.decodeChild();}
    const first=!h.streams.length;if(first)h.firstLive=performance.now();
    if(first&&config.warm&&h.floorGain)h.floorGain.gain.setValueAtTime(1,ctx.currentTime+config.warm/1000);
    // config.room: a steady room ({kind:'pink'|'white'|'hum', db}) that every
    // mic hears from the moment it opens (seeded, looped 8s).
    if(config.room){const n=ctx.sampleRate*8,b=ctx.createBuffer(1,n,ctx.sampleRate),x=b.getChannelData(0);let st=99,b0=0,b1=0,b2=0,e=0;
      for(let i=0;i<n;i++){st=(Math.imul(st,1664525)+1013904223)>>>0;const w=st/2147483648-1,t=i/ctx.sampleRate;
        if(config.room.kind==='pink'){b0=.99765*b0+w*.099046;b1=.963*b1+w*.2965164;b2=.57*b2+w*1.0526913;x[i]=b0+b1+b2+w*.1848;}
        else if(config.room.kind==='hum'){let v=.3*w;for(let k=1;k<=6;k++)v+=Math.sin(2*Math.PI*120*k*t)/k;x[i]=v;}
        else x[i]=w;
        e+=x[i]*x[i];}
      const g=Math.pow(10,config.room.db/20)/Math.sqrt(e/n);for(let i=0;i<n;i++)x[i]*=g;
      // config.room.drop: the room is that many dB quieter from the moment
      // the page has its one reading (a fan turned down before the child's
      // turn); h.reading keeps a copy of that reading as the page took it.
      const level=ctx.createGain();level.gain.value=h.dropped?Math.pow(10,-config.room.drop/20):1;(h.roomLevels=h.roomLevels||[]).push(level);
      const src=ctx.createBufferSource();src.buffer=b;src.loop=true;connect.call(src,level);connect.call(level,destination);src.start();}
    h.ctx=ctx;h.destination=destination;h.streams.push(destination.stream);return destination.stream;
  }});
  if(config.room&&config.room.drop){const watch=setInterval(()=>{const r=window.room;if(!r||!r.bg)return;clearInterval(watch);
    h.reading={rms:r.rms,bg:Array.from(r.bg)};h.dropped=true;
    for(const level of h.roomLevels||[])level.gain.setValueAtTime(Math.pow(10,-config.room.drop/20),level.context.currentTime);},5);}
  // config.fps: animation frames at this rate (a phone under load, or in Low
  // Power Mode), as speechevidencetest does.
  if(config.fps){const ms=1000/config.fps;window.requestAnimationFrame=fn=>setTimeout(()=>fn(performance.now()),ms);window.cancelAnimationFrame=id=>clearTimeout(id);}
  let sona;
  Object.defineProperty(window,'Sona',{configurable:true,get:()=>sona,set(value){
    sona=value;
    value.speechPerm=()=>Promise.resolve(true);
    value.speechStart=()=>{if(config.native)h.recognizing=true;return Promise.resolve(!!config.native);};
    // With the voice on, the fake recognizer transcribes only what it heard:
    // Echo's R, if the room ever reached it while it was running.
    value.speechStop=()=>{const heard=h.recognizing&&h.recognizerHeard;h.recognizing=false;return Promise.resolve({text:config.native&&(!config.voice||heard)?'rrrr':''});};
    value.isNativeApp=()=>!!config.native;
    const verdict=value.hearVerdict;
    value.hearVerdict=function(...args){h.verifyCalls++;return verdict.apply(value,args);};
    if(value.speechFrame){const frame=value.speechFrame;value.speechFrame=function(...args){const r=frame.apply(value,args);h.frames++;if(r.speech)h.speechFrames++;if(h.metrics.length<20&&r.rms>.025)h.metrics.push(r);return r;};}
    for(const key of ['logAttempt','bumpReps','recordSession','recordRung','rotAdvance','saveRecording','dailyFinish']){
      const original=value[key];value[key]=function(...args){h.effects.push(key);return original.apply(value,args);};
    }
    value.confetti=()=>{};
    // With the voice on the chimes are real too, and go through the room.
    if(!config.voice)Object.keys(value.sfx||{}).forEach(key=>{if(typeof value.sfx[key]==='function')value.sfx[key]=()=>{};});
  }});
  h.play=async kind=>{
    const ctx=h.ctx;let buffer;
    if(kind.endsWith('.mp3'))buffer=await ctx.decodeAudioData(await(await fetch('/coach/say/'+kind)).arrayBuffer());
    else{
      const duration=1.8,rate=ctx.sampleRate;buffer=ctx.createBuffer(1,Math.ceil(rate*duration),rate);const x=buffer.getChannelData(0);
      let state=104729,filtered=0;
      const noise=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2147483648-1;};
      for(let i=0;i<x.length;i++){
        const t=i/rate,edge=Math.min(1,t/.025,(duration-t)/.025),n=noise();let v=0;
        if(kind==='tone')v=.24*Math.sin(2*Math.PI*440*t);
        else if(kind==='hum')v=.24*(Math.sin(2*Math.PI*110*t)+.35*Math.sin(2*Math.PI*220*t)+.12*Math.sin(2*Math.PI*330*t));
        else if(kind==='white noise')v=.28*n;
        else if(kind==='breath'){filtered=.84*filtered+.16*n;v=.55*filtered;}
        else if(kind==='clicks'){const phase=t%.45;if(phase<.008)v=.65*n*Math.exp(-phase*650);}
        else if(kind==='claps'){const phase=t%.5;if(phase<.07)v=.65*n*Math.exp(-phase*65);}
        else if(kind==='harmonics'){for(let j=1;j<=10;j++)v+=.045/Math.sqrt(j)*Math.sin(2*Math.PI*180*j*t);}
        x[i]=v*edge;
      }
    }
    // Positive files contain long demonstrations. Three seconds is enough to
    // exercise the actual recorded target without an automatic round advance.
    if(buffer.duration>3){const clipped=ctx.createBuffer(buffer.numberOfChannels,Math.floor(ctx.sampleRate*3),ctx.sampleRate);for(let ch=0;ch<buffer.numberOfChannels;ch++)clipped.copyToChannel(buffer.getChannelData(ch).subarray(0,clipped.length),ch);buffer=clipped;}
    const node=ctx.createBufferSource();node.buffer=buffer;node.connect(h.destination);h.source=node;
    await new Promise(resolve=>{let ended=false;const finish=()=>{if(ended)return;ended=true;clearTimeout(timer);node.onended=null;try{node.stop();}catch{}resolve();};const timer=setTimeout(finish,Math.ceil(buffer.duration*1000)+500);node.onended=finish;node.start();});
    node.disconnect();h.source=null;return buffer.duration;
  };
  localStorage.setItem('sona.freeera.v1','post');localStorage.setItem('sona.freeera2.v1','done');localStorage.setItem('sona.freeera3.v1','done');localStorage.setItem('sona.freeera4.v1','done');localStorage.setItem('sona.micok','1');
  localStorage.setItem('sona.profile.v1',JSON.stringify(config.voice?{childName:'Test child',childAge:'7',focusSounds:[config.sound],onboarded:true,voiceOn:true,soundOn:true,volume:.8}:{childName:'Test child',childAge:'7',focusSounds:[config.sound],onboarded:true,voiceOn:false,soundOn:false,volume:0}));
  localStorage.setItem('sona.progress.v1',JSON.stringify({sessions:[],totals:{sessions:0,words:0,stars:0,coins:0,rounds:0},streak:{count:0,lastDate:''},bySound:{},stage:{},chests:{},missed:[]}));
  sessionStorage.setItem('sona.run.v1',JSON.stringify({active:true,round:0,sum:0,scores:[],pending:false,sound:config.sound,level:1,demo:false,games:['slice','tiles','stack','run','glide']}));
}
async function fresh(config={}){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  // 25 Sep 2026: a sound-alone round's prompt is Rachel's take in Echo's
  // voice, a 12–19 s clip (HUMAN_CLIPS). This suite is about what the mic
  // hears AFTER the prompt, so the clip is absent here and the calm TTS
  // line stands in, as before. micquietpracticetest covers the clip itself.
  await context.route(/\/coach\/say-echo\//,route=>route.fulfill({status:404,body:''}));
  await context.addInitScript(signalDevice,{sound:'R',native:false,...config});
  const page=await context.newPage();page.setDefaultTimeout(config.voice||config.cpu?9000:5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // config.cpu: DevTools CPU throttling (this many times slower).
  if(config.cpu)await(await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate',{rate:config.cpu});
  if(config.shared){await page.goto(origin+'/__shared');await page.waitForFunction(()=>window.Sona);return{context,page,errors};}
  await page.goto(origin+'/charge.html?daily=1&sound='+(config.sound||'R'));
  await page.waitForFunction(()=>window.engineOn&&window.engineAttempt?.segment&&!window.engineAttempt.segment.closed);
  await page.waitForTimeout(350); // silent calibration, before any fixture starts
  return{context,page,errors};
}
async function snapshot(page){return page.evaluate(async()=>({progress:Sona.getProgress(),outcomes:Sona.outcomes(),reps:Sona.repsToday(),week:Sona.weekReps(),ring:Sona.todayRing(),recordings:(await Sona.listRecordings(100)).length,rung:Sona.rungOf(SOUND)}));}
async function completeSegment(page){
  await page.evaluate(()=>{if(engineAttempt&&engineAttempt.segment&&!engineAttempt.segment.closed)engineAttempt.segment.finish('done');});
  await page.waitForTimeout(150);
}
async function close(context,page){await page.evaluate(()=>{try{window.engineControl?.cancel();}catch{}try{__repHarness.ctx?.close();}catch{}}).catch(()=>{});await context.close();}
try{
  for(const kind of (process.env.REPGUARD_ONLY==='positive'?[]:['silence','tone','clicks','claps','breath','white noise','hum']))await scenario(kind,async()=>{
    const{page,context,errors}=await fresh();
    try{
      const before=await snapshot(page);await page.evaluate(kind=>__repHarness.play(kind),kind);await completeSegment(page);
      const after=await snapshot(page),state=await page.evaluate(()=>({reps,quiet:!!document.querySelector('#quietOvl.show'),effects:__repHarness.effects,frames:__repHarness.frames,speechFrames:__repHarness.speechFrames,metrics:__repHarness.metrics,shapeFrames:SHAPE.frames,live:__repHarness.streams.some(s=>s.getTracks().some(t=>t.readyState==='live'))}));
      ok(kind+': no counted repetition',state.reps===0,state);
      ok(kind+': no outcomes, totals, streak, weekly tries, recording, rung or ring change',JSON.stringify(before)===JSON.stringify(after),{before,after,effects:state.effects});
      ok(kind+': quiet state releases the synthetic mic',state.quiet&&!state.live,state);
      ok(kind+': no script error',errors.length===0,errors);
    }finally{await close(context,page);}
  });
  if(process.env.REPGUARD_ONLY!=='positive')await scenario('native transcript without voice',async()=>{
    const{page,context}=await fresh({native:true});
    try{
      const before=await snapshot(page);await page.waitForTimeout(500);await completeSegment(page);
      const after=await snapshot(page),state=await page.evaluate(()=>({reps,quiet:!!document.querySelector('#quietOvl.show'),verifyCalls:__repHarness.verifyCalls,texts:recognitionTexts,effects:__repHarness.effects}));
      ok('zero detected tries cannot be rescued by a matching native transcript',state.reps===0&&state.quiet&&state.verifyCalls===0&&state.texts.includes('rrrr'),state);
      ok('native zero-try transcript cannot create saved progress or clips',JSON.stringify(before)===JSON.stringify(after),{before,after,effects:state.effects});
    }finally{await close(context,page);}
  });
  // VOICE ON (24 Sep 2026). Every other scenario here mutes Sona, so none of
  // them could catch the app counting ITSELF. Here Echo speaks every line in
  // a real recorded R (the target sound), the chimes play, and the fake mic
  // hears all of it 200ms late — louder than a phone with echo cancellation
  // ever would. The child says nothing: prompt, a tap on Echo, the turtle,
  // an unprompted prompt mid-window (the idle nudge's call), then the quiet
  // screen's line. Sona must end with zero tries, no verdict and no clip.
  if(process.env.REPGUARD_ONLY!=='positive')await scenario('voice on: Sona hears only itself',async()=>{
    const{page,context,errors}=await fresh({voice:true,native:true});
    try{
      const before=await snapshot(page);
      const turn=()=>page.waitForFunction(()=>!document.getElementById('echoBuddy').disabled);
      await page.locator('#echoBuddy').click();await page.waitForFunction(()=>__repHarness.voicePlays>=2);
      await page.locator('#turtleBtn').click();await page.waitForFunction(()=>__repHarness.mediaPlays>=1);
      await turn();await page.evaluate(()=>{playPrompt();});await page.waitForFunction(()=>__repHarness.voicePlays>=3);
      await turn();await page.waitForTimeout(600);
      await completeSegment(page);await page.locator('#quietOvl.show').waitFor();
      await page.waitForFunction(()=>__repHarness.voicePlays>=4);await page.waitForTimeout(1800);
      const after=await snapshot(page),state=await page.evaluate(()=>({reps,verifyCalls:__repHarness.verifyCalls,effects:__repHarness.effects,texts:recognitionTexts,micHeardPage:__repHarness.micHeardPage,recognizerHeard:__repHarness.recognizerHeard,roomPeak:__repHarness.roomPeak,voicePlays:__repHarness.voicePlays,mediaPlays:__repHarness.mediaPlays,browserVoice:__repHarness.browserVoice,routeError:__repHarness.audioRouteError||null,quiet:(document.getElementById('quietTitle')||{}).textContent}));
      ok('voice on: every line really played through the room',state.voicePlays>=4&&state.mediaPlays>=1&&state.roomPeak>.05&&state.browserVoice===0&&!state.routeError,state);
      ok('voice on: none of it reached a live mic',!state.micHeardPage,state);
      ok('voice on: none of it reached the native recognizer',!state.recognizerHeard&&!state.texts.length,state);
      ok('voice on: zero tries and no verdict',state.reps===0&&state.verifyCalls===0&&state.quiet==="I couldn't hear you!",state);
      ok('voice on: no outcomes, totals, streak, weekly tries, recording, rung or ring change',JSON.stringify(before)===JSON.stringify(after)&&!state.effects.length,{before,after,effects:state.effects});
      ok('voice on: no script error',errors.length===0,errors);
    }finally{await close(context,page);}
  });
  // EAGER CHILD, REAL AUDIO (24 Sep 2026). With the voice on, the mic is
  // closed while Echo speaks and opens a quarter-second after he stops, plus
  // the phone's own delay (300ms here). A child who answers straight away is
  // already talking when it opens. Each window used to spend its first
  // quarter-second measuring "the room" — here, the child's R — and set the
  // bar three times above it: zero tries, then "I couldn't hear you!". The
  // room is now measured once, on the first mic before Echo speaks (this
  // mic hisses faintly at -70dBFS, as real ones do), and a window's reading
  // can only lower it. Rachel's recorded R, from 300, 500 and 700ms after the
  // prompt: at least the 2 tries it counted before the change, at every onset.
  if(process.env.REPGUARD_ONLY!=='positive')for(const onset of [300,500,700])await scenario('voice on: a child answering '+onset+'ms after the prompt',async()=>{
    const{page,context,errors}=await fresh({voice:true,micDelay:300,floor:-70,child:{onset}});
    try{
      await page.evaluate(()=>{NEED=100;});
      await page.waitForFunction(()=>__repHarness.childDone,{},{timeout:9000});await page.waitForTimeout(400);
      const state=await page.evaluate(()=>({reps,promptEnd:__repHarness.promptEnd,childDone:__repHarness.childDone,micHeardPage:__repHarness.micHeardPage,quiet:!!document.querySelector('#quietOvl.show')}));
      ok('voice on, child answering '+onset+'ms after the prompt: their tries count (at least the 2 from before the change)',state.reps>=2&&!state.quiet,state);
      ok('voice on, child answering '+onset+'ms after the prompt: Echo still never reached a live mic',!state.micHeardPage,state);
      ok('voice on, child answering '+onset+'ms after the prompt: no script error',errors.length===0,errors);
    }finally{await close(context,page);}
  });
  // THE ROOM READING, REAL AUDIO (24 Sep 2026, after review). Two ways the
  // one room reading before Echo speaks still caught the child's voice, each
  // with Rachel's recorded R answering 300 or 500ms after the prompt:
  //  - the mic sends digital zeros for 250 or 400ms as it starts: the 300ms
  //    reading used to run down on zeros, the first window measured the child
  //    instead, and none of their tries counted. Its clock now starts at the
  //    first frame that is not zeros.
  //  - the child says 1s of their R the moment the mic opens, before Echo
  //    has spoken: the reading WAS their voice. A reading louder than any
  //    room (ROOM_MAX) is not taken for one now, the bar never passes
  //    3 x ROOM_MAX, and the window learns the room in the child's first pause.
  // At least the 2 tries this recording counted before the change, each time.
  for(const [what,cfg] of [['250ms of zeros as the mic starts',{warm:250}],['400ms of zeros as the mic starts',{warm:400}],['the child saying 1s of R during the reading',{pre:1}]])
    for(const onset of [300,500])if(process.env.REPGUARD_ONLY!=='positive')await scenario('voice on, '+what+', child answering '+onset+'ms after the prompt',async()=>{
      const{page,context,errors}=await fresh({voice:true,micDelay:300,floor:-70,child:{onset},...cfg});
      try{
        await page.evaluate(()=>{NEED=100;});
        await page.waitForFunction(()=>__repHarness.childDone,{},{timeout:9000});await page.waitForTimeout(400);
        const state=await page.evaluate(()=>({reps,room:room&&room.rms,micHeardPage:__repHarness.micHeardPage,quiet:!!document.querySelector('#quietOvl.show'),talkingFromLive:__repHarness.preAt==null?null:Math.round(__repHarness.firstLive-__repHarness.preAt),talkingAfterLive:__repHarness.preEnd==null?null:Math.round(__repHarness.preEnd-__repHarness.firstLive)}));
        // The reading is at most 300ms from the first real frame: a child
        // talking from before the mic opened until well after covers it.
        if(cfg.pre)ok(what+', child at '+onset+'ms: they were already talking when the mic opened, and for the whole reading',state.talkingFromLive>0&&state.talkingAfterLive>=400,state);
        ok(what+', child at '+onset+'ms: their tries count (at least the 2 from before the change)',state.reps>=2&&!state.quiet,state);
        ok(what+', child at '+onset+'ms: the room is never their voice',!(state.room>.03),state);
        ok(what+', child at '+onset+'ms: Echo still never reached a live mic',!state.micHeardPage,state);
        ok(what+', child at '+onset+'ms: no script error',errors.length===0,errors);
      }finally{await close(context,page);}
    });
  // LOUD ROOMS (24 Sep 2026). The bar is capped now (3 x ROOM_MAX), so a loud
  // room must still be kept out by what the page knows about it. A loud but
  // real room (pink, -32dBFS: ~0.02, over twice speechevidencetest's TV room)
  // is measured and the noises played over it earn nothing. A room louder
  // than any real one (-20dBFS, ~0.1: over the capped bar itself) is never
  // taken for a room, and on its own earns nothing either: pink and white
  // are never voiced, and a steady hum never ends.
  // UNDER LOAD (25 Sep 2026). Each also runs on a slow phone: DevTools CPU
  // throttling (6x) with animation frames at 20fps, which is what load does
  // to this page. Every look at a sound is a frame, so a sparse one gives
  // noise fewer chances to be caught out. (Its first run caught the page
  // reading this room as ~0.001 off a frame the starved mic path had left
  // almost empty: charge.html, A STARVED FRAME IS NOT A ROOM.)
  // The pure tone is played over the loudest room #139's speech evidence was
  // calibrated for (pink, -40dBFS), not -32. Over -32dBFS its check for a
  // voice's overtones (a harmonic 6dB over the room, within 40dB of the
  // strongest) is met by the room's own noise at the tone's missing
  // overtones often enough that a held pure tone counts on some plays: in
  // the live build too (1 play in 6 under CPU load, 13 in 20 at 20fps).
  // That is the rule's envelope, Rachel's call, and speechevidencetest
  // prints the figures; what this page adds to it is pinned below (ONE
  // READING, WHOLE) and in speechevidencetest.
  const LOUD=[['tone',-40],['hum',-32],['white noise',-32],['breath',-32]];
  for(const [load,cfg] of [['',{}],[' on a slow phone (6x CPU, 20fps)',{cpu:6,fps:20}]])
    if(process.env.REPGUARD_ONLY!=='positive')for(const [kind,db] of LOUD)await scenario(kind+' in a loud room'+load,async()=>{
      const{page,context,errors}=await fresh({room:{kind:'pink',db},...cfg});
      try{
        const before=await snapshot(page);await page.evaluate(kind=>__repHarness.play(kind),kind);await completeSegment(page);
        // Read the count BEFORE waiting on the quiet screen: a counted noise
        // navigates to the game, where the page's globals no longer exist, and
        // the failure would surface as a ReferenceError instead of by name.
        const early=await page.evaluate(()=>({reps,room:typeof room!=='undefined'&&room?room.rms:null,evid:window.__evid||[]}));
        await page.locator('#quietOvl.show').waitFor({timeout:3000}).catch(()=>{});
        const after=await snapshot(page).catch(()=>({navigated:true})),state=await page.evaluate(()=>({reps,room:typeof room!=='undefined'&&room?room.rms:null,quiet:!!document.querySelector('#quietOvl.show'),evid:window.__evid||[]})).catch(()=>({...early,quiet:false}));
        const want=Math.pow(10,db/20);
        ok(kind+' in a loud room'+load+': the room (~'+want.toFixed(3)+') was measured as the room',state.room>want/2&&state.room<=Math.min(.03,want*1.5),state);
        ok(kind+' in a loud room'+load+': no counted repetition and no saved change',state.reps===0&&JSON.stringify(before)===JSON.stringify(after)&&state.quiet,{state,before,after});
        ok(kind+' in a loud room'+load+': no script error',errors.length===0,errors);
      }finally{await close(context,page);}
    });
  // ONE READING, WHOLE (25 Sep 2026). A window's own first quarter-second may
  // lower the page's room. For a day that lowering took the speech-evidence
  // background bin by bin, the quieter of the page's reading and the
  // window's, whenever the window came in a hair quieter: in a steady room,
  // half the time. A background stitched from two noisy readings is quieter
  // than the room either one heard, and against it the room's own noise at a
  // pure tone's missing overtones looked like a voice (speechevidencetest:
  // over 100 fan-loud rooms at 60fps the page let a tone through on 32 plays
  // to #139's own 16). Here the room turns down after the page's reading:
  //  - by 1.5dB: the bar follows it down, as it must for a soft child, but
  //    the background is still the page's reading, every bin of it;
  //  - by 8dB, clearly quieter: the background is the quieter room's own
  //    reading, a whole one.
  if(process.env.REPGUARD_ONLY!=='positive')for(const drop of [1.5,8])await scenario('a loud room '+drop+'dB quieter by the child\'s turn',async()=>{
    const{page,context,errors}=await fresh({room:{kind:'pink',db:-32,drop}});
    try{
      const s=await page.evaluate(()=>{const r=__repHarness.reading,cur=typeof room!=='undefined'?room:null,bg=cur&&cur.bg?Array.from(cur.bg):[],mean=a=>a.reduce((x,y)=>x+y,0)/Math.max(1,a.length);
        return{read:r&&r.rms,now:cur&&cur.rms,bins:bg.length,same:!!r&&bg.length===r.bg.length&&bg.every((v,k)=>v===r.bg[k]),stitched:!!r&&bg.filter((v,k)=>v!==r.bg[k]).length,quieterBy:r?mean(r.bg)-mean(bg):null};});
      ok('room '+drop+'dB quieter: the page took its reading before the drop, and the bar followed the room down',s.read>.01&&s.now<s.read,s);
      if(drop<3)ok('room '+drop+'dB quieter: the speech-evidence background is still the page\'s own reading, whole (no bin taken from the window\'s)',s.bins>0&&s.same,s);
      else ok('room '+drop+'dB quieter: the background is the quieter room\'s own reading',s.bins>0&&s.quieterBy>4,s);
      ok('room '+drop+'dB quieter: no script error',errors.length===0,errors);
    }finally{await close(context,page);}
  });
  if(process.env.REPGUARD_ONLY!=='positive')for(const kind of ['pink','white','hum'])await scenario('a '+kind+' room louder than any real one',async()=>{
    const{page,context,errors}=await fresh({room:{kind,db:-20}});
    try{
      const before=await snapshot(page);await page.waitForTimeout(2500);await completeSegment(page);
      const after=await snapshot(page),state=await page.evaluate(()=>({reps,room:room&&room.rms,quiet:!!document.querySelector('#quietOvl.show')}));
      ok('a '+kind+' room at -20dBFS is never taken for the room',state.room==null,state);
      ok('a '+kind+' room at -20dBFS: nothing counts, nothing is saved',state.reps===0&&JSON.stringify(before)===JSON.stringify(after)&&state.quiet,{state,before,after});
      ok('a '+kind+' room at -20dBFS: no script error',errors.length===0,errors);
    }finally{await close(context,page);}
  });
  // Every shipped target must remain detectable. An isolated short stop may
  // legitimately score unknown; detection does not assert clinical accuracy.
  for(const sound of ['R','S','M','THV','N','V','L','F','TH','T','P','D','G','B','K','CH','J','SH','Z']){
    const file=sound+'-demo.mp3';
    await scenario(file,async()=>{
    const{page,context,errors}=await fresh({sound});
    try{
      await page.evaluate(()=>{NEED=100;});
      const duration=await page.evaluate(file=>__repHarness.play(file),file);
      const detected=await page.evaluate(()=>({reps,frames:SHAPE.frames,signal:__repHarness.speechFrames,totalFrames:__repHarness.frames,metrics:__repHarness.metrics,shape:shapeVerdict()}));
      console.log('CONTROL '+file+': '+detected.reps+' tries, '+detected.frames+' shape frames, '+detected.shape);
      ok(file+': real recorded target still produces a detected try and shape evidence',detected.reps>0&&detected.frames>=(sound==='R'||sound==='S'?12:1),{duration,...detected});
      await completeSegment(page);
      if(sound==='R'||sound==='S'){
        const state=await snapshot(page);
        ok(file+': verified practice still logs tries and outcomes',state.reps>0&&state.week>0&&(state.outcomes[sound]?.tries||state.outcomes[sound]?.attempts||0)>0,{detected,state});
      }
      ok(file+': no script error',errors.length===0,errors);
    }finally{await close(context,page);}
    });
  }
  if(process.env.REPGUARD_ONLY!=='positive')await scenario('shared attempt and recording boundaries',async()=>{
    const{page,context}=await fresh({shared:true});
    try{
      const result=await page.evaluate(async()=>{
        const state=()=>JSON.stringify({outcomes:Sona.outcomes(),progress:Sona.getProgress(),week:Sona.weekReps(),reps:Sona.repsToday()});
        const before=state();Sona.logAttempt({game:'charge',sound:'R',pass:true,reps:0,word:'rrrr'});const afterZero=state();
        Sona.logAttempt({game:'charge',sound:'R',pass:true,reps:3,word:'rrrr'});
        const o=Sona.outcomes().R,day=o.days[Sona.localDay()],week=Sona.weekReps();
        const first=await Sona.saveRecording({sound:'R',word:'rrrr',blob:new Blob(['first fixture'],{type:'audio/webm'})});
        const second=await Sona.saveRecording({sound:'S',word:'ssss',blob:new Blob(['second fixture'],{type:'audio/webm'})});
        const mine=(await Sona.listRecordings()).length;
        const sibling=Sona.addKid('Sibling','5');
        const other=await Sona.saveRecording({sound:'S',word:'ssss',blob:new Blob(['sibling fixture'],{type:'audio/webm'})});
        const otherCount=(await Sona.listRecordings()).length;
        Sona.switchKid('');const originalCount=(await Sona.listRecordings()).length;
        return{zeroUnchanged:before===afterZero,o,day,week,first,second,mine,sibling,other,otherCount,originalCount};
      });
      ok('logAttempt with zero reps changes no practice state',result.zeroUnchanged,result);
      ok('three voiced tries remain one sound check',result.o.tries===3&&result.o.attempts===1&&result.day.tries===3&&result.day.a===1&&result.week===3,result);
      ok('two sounds cannot save two recordings for one child on one day',result.first===true&&result.second===false&&result.mine===1,result);
      ok('a sibling gets one separate daily recording',result.other===true&&result.otherCount===1&&result.originalCount===1,result);
    }finally{await close(context,page);}
  });
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
console.log(`Rep guard: ${checks-failures}/${checks} passed`);process.exitCode=failures?1:0;
