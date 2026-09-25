// LOUD ROOM ACROSS A REOPENED WINDOW (24 Sep 2026). A room louder than a room
// can be (a steady hum, pink or white noise at -20 dBFS and up) is never
// learned as the room, and the first listening window blocks it. A later
// window of the same attempt — reopened after a tap on Echo, a sound of
// Sona's, or a return from the background — used to start with the capped
// bar and no background, and counted the hum as one try per reopen. Noise is
// never a rep: every window must stay at zero.
// REPGUARD1: real Web Audio signals enter the real practice engine through a
// synthetic MediaStream. No hardware microphone, speaker, or external network.
// These fixtures reject common non-speech; they cannot establish that speech
// came from a child rather than a nearby adult or TV using one microphone.
// Baseline: SONATEST_PUBLIC_ROOT=/tmp/sona-c1578b4/public node tests/repguardtest.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium, ROOT, launchOpts } from '/home/user/SaaS/tests/_env.mjs';
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
    HTMLMediaElement.prototype.play=function(){h.mediaPlays++;return play.call(this);};
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
      const src=ctx.createBufferSource();src.buffer=b;src.loop=true;connect.call(src,destination);src.start();}
    h.ctx=ctx;h.destination=destination;h.streams.push(destination.stream);return destination.stream;
  }});
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
  await context.addInitScript(signalDevice,{sound:'R',native:false,...config});
  const page=await context.newPage();page.setDefaultTimeout(config.voice?9000:5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
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
const KINDS=(process.env.KINDS||'hum,pink,white').split(',');
const DBS=(process.env.DBS||'-20,-15').split(',').map(Number);
const MODES=(process.env.MODES||'close,echo').split(',');
try{
  for(const mode of MODES)for(const kind of KINDS)for(const db of DBS){
    const voice=mode==='echo';
    const{page,context,errors}=await fresh({room:{kind,db},voice,...(voice?{micDelay:100}:{})});
    try{
      await page.waitForTimeout(1200);
      const w1=await page.evaluate(()=>({reps,room:typeof room!=='undefined'&&room?room.rms:null,learn:!!(engineAttempt&&engineAttempt.segment&&engineAttempt.segment.learn)}));
      if(mode==='close')await page.evaluate(()=>{if(typeof closeMicForSound==='function')closeMicForSound();else engineAttempt.segment.finish('model');});
      else {await page.locator('#echoBuddy').click();}
      const t0=Date.now();
      await page.waitForFunction(()=>engineAttempt&&engineAttempt.segment&&!engineAttempt.segment.closed&&performance.now()-engineAttempt.segment.startedAt>600,{},{timeout:9000});
      const w2=await page.evaluate(()=>({reps,room:typeof room!=='undefined'&&room?room.rms:null,learn:!!(engineAttempt.segment.learn),evid:window.__evid||[]}));
      ok(`${kind} at ${db} dBFS (${mode==='echo'?'tap on Echo':'Sona sound'}): no try in the first window`,w1.reps===0,w1);
      ok(`…and none after the window reopens`,w2.reps===0,w2);
      ok(`…with no page errors`,errors.length===0,errors.slice(0,2));
    }catch(e){ok(`${mode} ${kind} ${db} completes`,false,String(e).slice(0,200));}
    finally{await close(context,page);}
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
console.log(failures?failures+' FAILURES':'ALL GREEN — '+checks+' assertions');
process.exit(failures?1:0);
