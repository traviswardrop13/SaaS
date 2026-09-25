// SPEECHEV1: the practice engine's speech-evidence rule outside the quiet
// desktop room repguardtest.mjs runs in. Two parts:
//  1. REPLAY — the recordings, decoded by the browser, replayed through the
//     shipped speechEvidence() at exact frame times (tests/_speechreplay.mjs).
//     Deterministic, so each mechanism is pinned: overtones keep a voice
//     countable in room noise, the octave check, the room's quiet end (its
//     20th percentile; a voice is never a room, 24 Sep 2026), the one-second
//     short sound, the minimum length, the 0.8s change window.
//  2. REAL ENGINE — real Web Audio through a synthetic MediaStream (muted, no
//     hardware), with steady room noise from before the silent calibration, at
//     30fps (WebKit's Low Power Mode rate), held and quiet productions, and a
//     child answering during calibration. Only cases robust to timing jitter.
// These are one adult's recordings and synthetic noise; they cannot stand in
// for children's voices, a phone microphone or a real room. repguardtest.mjs
// stays the acceptance bar and is not changed by this file.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium, ROOT, launchOpts } from './_env.mjs';
import { run, stream, fixture, gain, clip, rms, room, loadEvidence } from './_speechreplay.mjs';
import { voice, cat, silence } from './_childsynth.mjs';
const publicRoot = process.env.SONATEST_PUBLIC_ROOT || ROOT; // point at another build to compare
const MIME = { html:'text/html', js:'text/javascript', css:'text/css', svg:'image/svg+xml', png:'image/png', webp:'image/webp', woff2:'font/woff2', mp3:'audio/mpeg' };
const server = createServer((req,res) => {
  const u = new URL(req.url,'http://local');
  if (u.pathname==='/__blank') { res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html>');return; }
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

function device(config){
  const h=window.__ev={ctx:null,destination:null,streams:[],effects:[]};
  const AC=window.AudioContext||window.webkitAudioContext;
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(destination,...rest){
    if(destination===this.context.destination){const silent=this.context.createGain();silent.gain.value=0;connect.call(silent,destination);return connect.call(this,silent,...rest);}
    return connect.call(this,destination,...rest);
  };
  if(config.fps){const ms=1000/config.fps;window.requestAnimationFrame=fn=>setTimeout(()=>fn(performance.now()),ms);window.cancelAnimationFrame=id=>clearTimeout(id);}
  function rng(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/2147483648-1;};}
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
    const ctx=new AC({sampleRate:48000});await ctx.resume();
    const destination=ctx.createMediaStreamDestination();
    h.ctx=ctx;h.destination=destination;h.streams.push(destination.stream);
    if(config.floor){ // a real mic's own faint hiss (white), so calibration is never pure zeros
      const n=ctx.sampleRate*8,b=ctx.createBuffer(1,n,ctx.sampleRate),x=b.getChannelData(0),r=rng(7),k=Math.pow(10,config.floor/20)*Math.sqrt(3);
      for(let i=0;i<n;i++)x[i]=r()*k;
      const src=ctx.createBufferSource();src.buffer=b;src.loop=true;src.connect(destination);src.start();
    }
    if(config.room){ // steady pink room noise, running before the calibration starts
      const n=ctx.sampleRate*8,b=ctx.createBuffer(1,n,ctx.sampleRate),x=b.getChannelData(0),r=rng(99);let b0=0,b1=0,b2=0,s=0;
      for(let i=0;i<n;i++){const w=r();b0=.99765*b0+w*.099046;b1=.963*b1+w*.2965164;b2=.57*b2+w*1.0526913;x[i]=b0+b1+b2+w*.1848;s+=x[i]*x[i];}
      const k=Math.pow(10,config.room/20)/Math.sqrt(s/n);for(let i=0;i<n;i++)x[i]*=k;
      const src=ctx.createBufferSource();src.buffer=b;src.loop=true;src.connect(destination);src.start();
    }
    return destination.stream;
  }});
  let sona;
  Object.defineProperty(window,'Sona',{configurable:true,get:()=>sona,set(value){
    sona=value;
    value.speechPerm=()=>Promise.resolve(true);value.speechStart=()=>Promise.resolve(false);value.speechStop=()=>Promise.resolve({text:''});value.isNativeApp=()=>false;
    for(const key of ['logAttempt','bumpReps','recordSession','recordRung','rotAdvance','saveRecording','dailyFinish']){const original=value[key];value[key]=function(...args){h.effects.push(key);return original.apply(value,args);};}
    value.confetti=()=>{};Object.keys(value.sfx||{}).forEach(key=>{if(typeof value.sfx[key]==='function')value.sfx[key]=()=>{};});
  }});
  // kind: a recording ("M-demo.mp3") or a suite noise; o.gain, o.sec (keep the
  // first `sec` seconds from the sound's onset, 60ms fade), o.max (clip length),
  // o.at (start that many ms after the listening segment opened), o.times and
  // o.every (say it `times` times, one onset every `every` seconds)
  h.play=async(kind,o={})=>{
    const ctx=h.ctx,rate=ctx.sampleRate;let buffer;
    if(kind.endsWith('.mp3'))buffer=await ctx.decodeAudioData(await(await fetch('/coach/say/'+kind)).arrayBuffer());
    else{
      const duration=1.8;buffer=ctx.createBuffer(1,Math.ceil(rate*duration),rate);const x=buffer.getChannelData(0);
      let state=104729,filtered=0;const noise=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2147483648-1;};
      for(let i=0;i<x.length;i++){const t=i/rate,edge=Math.min(1,t/.025,(duration-t)/.025),n=noise();let v=0;
        if(kind==='tone')v=.24*Math.sin(2*Math.PI*440*t);
        else if(kind==='hum')v=.24*(Math.sin(2*Math.PI*110*t)+.35*Math.sin(2*Math.PI*220*t)+.12*Math.sin(2*Math.PI*330*t));
        else if(kind==='white noise')v=.28*n;
        else if(kind==='breath'){filtered=.84*filtered+.16*n;v=.55*filtered;}
        else if(kind==='beeps'){const ph=t%.6;if(ph<.3)v=.3*Math.sin(2*Math.PI*880*t);}
        x[i]=v*edge;}
    }
    let x=buffer.getChannelData(0),start=0;
    if(o.sec){const w=Math.round(rate*.01);for(let i=0;i+w<x.length;i+=w){let s=0;for(let j=i;j<i+w;j++)s+=x[j]*x[j];if(Math.sqrt(s/w)>.01){start=Math.max(0,i-w);break;}}}
    if(o.skip)start=Math.min(x.length-1,start+Math.round(rate*o.skip));
    const len=Math.min(x.length-start,Math.round(rate*(o.sec||o.max||3))),y=ctx.createBuffer(1,len,rate),z=y.getChannelData(0),fade=o.sec?Math.round(rate*.06):0;
    for(let i=0;i<len;i++)z[i]=x[start+i]*(o.gain||1)*(i>=len-fade?(len-i)/fade:1);
    let out=y;
    if(o.times>1){const step=Math.round(rate*o.every);out=ctx.createBuffer(1,step*(o.times-1)+len,rate);const w=out.getChannelData(0);for(let k=0;k<o.times;k++)w.set(z,k*step);}
    if(o.at!=null){ // start o.at ms after the listening segment opened
      const seg=window.engineAttempt&&window.engineAttempt.segment,wait=(seg?seg.startedAt:performance.now())+o.at-performance.now();
      if(wait>0)await new Promise(r=>setTimeout(r,wait));
    }
    const node=ctx.createBufferSource();node.buffer=out;node.connect(h.destination);
    await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);resolve();};const timer=setTimeout(finish,Math.ceil(out.length/rate*1000)+500);node.onended=finish;node.start();});
    node.disconnect();
  };
  localStorage.setItem('sona.freeera.v1','post');localStorage.setItem('sona.freeera2.v1','done');localStorage.setItem('sona.freeera3.v1','done');localStorage.setItem('sona.micok','1');
  // config.soundOn: the default profile's chimes on (Echo's voice stays off,
  // so the mic opens once and stays open, as in every other case here).
  localStorage.setItem('sona.profile.v1',JSON.stringify(config.soundOn?{childName:'Test child',childAge:'7',focusSounds:[config.sound],onboarded:true,voiceOn:false,soundOn:true,volume:.8}:{childName:'Test child',childAge:'7',focusSounds:[config.sound],onboarded:true,voiceOn:false,soundOn:false,volume:0}));
  localStorage.setItem('sona.progress.v1',JSON.stringify({sessions:[],totals:{sessions:0,words:0,stars:0,coins:0,rounds:0},streak:{count:0,lastDate:''},bySound:{},stage:{},chests:{},missed:[]}));
  sessionStorage.setItem('sona.run.v1',JSON.stringify({active:true,round:0,sum:0,scores:[],pending:false,sound:config.sound,level:1,demo:false,games:['slice','tiles','stack','run','glide']}));
}
async function fresh(config={}){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  await context.addInitScript(device,{sound:'R',...config});
  const page=await context.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/charge.html?daily=1&sound='+(config.sound||'R'));
  await page.waitForFunction(()=>window.engineOn&&window.engineAttempt?.segment&&!window.engineAttempt.segment.closed);
  await page.evaluate(()=>{NEED=100;});
  if(!config.noWait)await page.waitForTimeout(config.fps?700:350); // silent calibration first
  return{context,page,errors};
}
const tries=page=>page.evaluate(()=>reps);
async function snapshot(page){return page.evaluate(async()=>({progress:Sona.getProgress(),outcomes:Sona.outcomes(),reps:Sona.repsToday(),week:Sona.weekReps(),recordings:(await Sona.listRecordings(100)).length}));}
async function finish(page){await page.evaluate(()=>{if(engineAttempt&&engineAttempt.segment&&!engineAttempt.segment.closed)engineAttempt.segment.finish('done');});await page.waitForTimeout(200);}
async function close(context,page){await page.evaluate(()=>{try{window.engineControl?.cancel();}catch{}try{__ev.ctx?.close();}catch{}}).catch(()=>{});await context.close();}
// A spoken sound under a second counts once it has been quiet ~130ms.
const settle=page=>page.waitForTimeout(300);

async function speech(label,config,file,o={}){
  await scenario(label,async()=>{
    const{page,context,errors}=await fresh(config);
    try{await page.evaluate(([f,o])=>__ev.play(f,o),[file,o]);await settle(page);
      const n=await tries(page);ok(label+': counted as a try',n>0,{tries:n});ok(label+': no script error',errors.length===0,errors);
    }finally{await close(context,page);}
  });
}
async function noise(label,config,kind){
  await scenario(label,async()=>{
    const{page,context,errors}=await fresh(config);
    try{const before=await snapshot(page);await page.evaluate(k=>__ev.play(k),kind);await settle(page);await finish(page);
      const after=await snapshot(page),state=await page.evaluate(()=>({reps,quiet:!!document.querySelector('#quietOvl.show'),effects:__ev.effects}));
      ok(label+': no try and no saved practice',state.reps===0&&JSON.stringify(before)===JSON.stringify(after),{state,before,after});
      ok(label+': the quiet retry is shown',state.quiet,state);ok(label+': no script error',errors.length===0,errors);
    }finally{await close(context,page);}
  });
}
// QUICK TRIES WITH THE SOUND ON (24 Sep 2026). For one day a counted try rang
// a short chime inside the open mic, and to stop the page hearing its own
// chime the detector went deaf for 370ms after each count. A quick try that
// began inside that — "t… t… t…" at two a second, a popped P or K — was
// thrown away whole: the child said four and saw two. The chime is gone and
// the counting rule is the one from before (a new try may start 350ms after
// the last one STARTED). With the chimes on, as every family has them:
//  - F, T and TH said four times, one every 500ms: all four count, as they
//    did before the change (4 of 4; the guard made it 2 of 4);
//  - Rachel's P and K recordings count at least as many tries as before
//    (2 each; the guard made P 1).
async function quickTries(){
  for(const [s,sec] of [['F',.25],['T',.3],['TH',.25]])await scenario(`${s} said four times, 500ms apart, sound on`,async()=>{
    const{page,context,errors}=await fresh({sound:s,soundOn:true});
    try{
      await page.evaluate(([f,o])=>__ev.play(f,o),[s+'-demo.mp3',{sec,times:4,every:.5}]);await settle(page);
      const n=await tries(page);
      ok(`${s} ×4 at 500ms with the sound on: all four count (4 of 4, as before)`,n===4,{tries:n});
      ok(`${s} ×4 at 500ms with the sound on: no script error`,errors.length===0,errors);
    }finally{await close(context,page);}
  });
  for(const s of ['P','K'])await scenario(`${s}-demo with the sound on`,async()=>{
    const{page,context,errors}=await fresh({sound:s,soundOn:true});
    try{
      await page.evaluate(f=>__ev.play(f,{max:3}),s+'-demo.mp3');await settle(page);
      const n=await tries(page);
      ok(`${s}-demo with the sound on: at least the 2 tries it counted before the change`,n>=2,{tries:n});
      ok(`${s}-demo with the sound on: no script error`,errors.length===0,errors);
    }finally{await close(context,page);}
  });
}
try{
  if(process.env.SPEECHEV_ONLY==='quick'){await quickTries();throw 'quick-only';}
  // The recorded final sound must keep contributing shape after its try is
  // accepted. A stable excerpt250ms after onset isolates the completing
  // sound from its recorded lead-in. NEED=100 controls miss this boundary.
  if(process.env.SPEECHEV_ONLY!=='replay')for(const sound of ['R','M'])await scenario(`final recorded ${sound} at NEED=1`,async()=>{
    const{page,context,errors}=await fresh({sound});
    try{
      await page.evaluate(()=>{NEED=1;});
      await page.evaluate(f=>__ev.play(f,{sec:.65,skip:.25}),sound+'-demo.mp3');
      await settle(page);
      const state=await page.evaluate(()=>({frames:SHAPE.frames,reps,saved:Sona.repsToday(),effects:__ev.effects.slice(),verdict:shapeVerdict()}));
      ok(`${sound}: final recorded sound supplies enough shape evidence`,state.frames>=12&&state.verdict==='pass',state);
      ok(`${sound}: final recorded sound saves exactly one try and one outcome`,state.reps===1&&state.saved===1&&state.effects.filter(e=>e==='logAttempt').length===1&&state.effects.filter(e=>e==='bumpReps').length===1,state);
      await page.waitForTimeout(200);
      ok(`${sound}: completed recorded tail cannot save twice`,await page.evaluate(()=>reps===1&&Sona.repsToday()===1&&__ev.effects.filter(e=>e==='logAttempt').length===1));
      ok(`${sound}: final recorded tail has no script error`,errors.length===0,errors);
    }finally{await close(context,page);}
  });
  if(process.env.SPEECHEV_ONLY==='tail')throw 'tail-only';
  // ---------- 1. REPLAY ----------
  const evidence=loadEvidence();
  // The replay mirrors charge.html's tick(); these are the lines it mirrors.
  // If one changes, update tests/_speechreplay.mjs run() to match.
  // REWRITTEN 24 Sep 2026 (ROOM FLOOR): the quiet quarter-second is now read
  // once per page before Echo speaks, and a window measures itself only when
  // the page has no reading. The replay is that case: one window, no reading,
  // deaf for its first 250ms, then 3x the room's 20th percentile (the median
  // until 24 Sep 2026; tests/_speechreplay.mjs now takes the 20th too).
  // REWRITTEN AGAIN 24 Sep 2026 (A VOICE IS NOT A ROOM): the bar is capped at
  // 3 x ROOM_MAX (roomBar); a quarter-second louder than ROOM_MAX was a voice,
  // so the window drops those samples, learns the room in the first pause
  // (learnRoom) and, until then, counts a try only once it ends and only if
  // it was voiced or a hiss (heardTry). The replay mirrors all of it and
  // reads ROOM_PCT, ROOM_MAX and LEARN_FRAMES from the page itself.
  // (The speech-evidence background is extracted verbatim, so it matches.)
  const charge=readFileSync(path.join(publicRoot,'charge.html'),'utf8');
  for(const line of ['if(!inBurst&&voiced>=4&&(successAt!==null||now-lastRep>350)){inBurst=true;burstAt=now;}','if(evid.frame(now)&&inBurst&&!seg.learn)countRep(now);',
    'if(inBurst&&!counted&&(silent>=8||evid.quietFor(now)>=EVID.quietMs)&&heardTry())countRep(now);','if(silent>=8){inBurst=false;counted=false;burstFrames=[];evid.drop();}',
    'if(!inBurst){burstFrames=[];evid.drop();if(seg.learn&&rms<=ROOM_MAX)learnRoom(now,rms);}',
    'if(now-seg.startedAt<250){seg.rms.push(rms);evid.calibrate(now);if(!thr){seg.raf=requestAnimationFrame(tick);return;}}',
    'function roomLevel(list,pct){var v=list.filter(function(x){return x>0;}).sort(function(a,b){return a-b;});return v.length?v[Math.floor((v.length-1)*pct)]:0;}',
    'function roomBar(level){return Math.min(3*ROOM_MAX,Math.max(0.035,level*3.0));}',
    'var low=roomLevel(seg.rms,ROOM_PCT),bg=evid.measured(),off=!(ev.getFloatTimeDomainData&&ev.getFloatFrequencyData),voice=low>ROOM_MAX;',
    'if(!thr)thr=roomBar(low);','if(voice){evid.resample();seg.learn=[];}',
    'seg.learn.push(rms);evid.calibrate(now);','if(seg.learn.length<LEARN_FRAMES)return;','if(bg)evid.floor(bg);','thr=roomBar(low);seg.learn=null;',
    'function heardTry(){return seg.learn?/^(voiced|sibilant|energy)$/.test(evid.route()):evid.brief();}',
    'reps++;heardAt=now;lastRep=burstAt;',
    'ev.fftSize=ctx.sampleRate>=88200?2048:ctx.sampleRate>=32000?1024:512;'])
    ok('replay mirrors charge.html: '+line.slice(0,48),charge.includes(line),line);
  const dec=await browser.newPage();await dec.goto(origin+'/__blank');
  const cache={};
  async function rec(name,rate=48000){ // decoded recording, cut to 3s like repguard plays it
    const key=name+'@'+rate;
    if(!cache[key]){
      const b64=await dec.evaluate(async([name,rate])=>{const ctx=new OfflineAudioContext(1,1,rate);const buf=await ctx.decodeAudioData(await(await fetch('/coach/say/'+name+'.mp3')).arrayBuffer());
        const x=buf.getChannelData(0).subarray(0,rate*3),u=new Uint8Array(x.buffer,x.byteOffset,x.byteLength);let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s);},[name,rate]);
      const buf=Buffer.from(b64,'base64');cache[key]=new Float32Array(buf.buffer,buf.byteOffset,buf.length/4).slice();
    }
    return cache[key];
  }
  function held(x,rate,sec){ // one production from its onset, `sec` long, 60ms fade
    const w=Math.round(rate*.01);let on=0;for(let i=0;i+w<x.length;i+=w){if(rms(x.subarray(i,i+w))>.01){on=Math.max(0,i-w);break;}}
    return clip(x.subarray(on),rate,sec,60);
  }
  const R=48000;
  const bars=[];
  function replay(label,expect,sig,rate=R,o={}){
    const r=run(sig,rate,{evidence,...o}),n=o.after!=null?r.at.filter(a=>a.t>=o.after*1000).length:r.reps;
    bars.push({label,thr:r.thr,voice:r.voice,loud:!!o.loud});
    ok('replay: '+label+(expect?' counts':' earns no try'),expect?n>0:n===0,{tries:n,oldEngine:r.old,at:r.at});
    return r;
  }
  // Room noise buries a nasal's spectrum above ~1kHz: pitch and overtones must carry it.
  for(const s of ['M','N','V'])replay(`${s} at half volume over pink room noise -40dBFS`,true,stream(R,[[gain(await rec(s+'-demo'),.5)]],{roomKind:'pink',roomDb:-40}));
  replay('G (weak fundamental, octave check) at half volume over pink -40dBFS',true,stream(R,[[gain(await rec('G-demo'),.5)]],{roomKind:'pink',roomDb:-40}));
  // A child's higher pitch fits fewer overtones under the ~1kHz a room leaves.
  for(const [v,f0,room] of [['m',320,-45],['n',320,-40],['m',280,-40],['u',400,-40]]){
    const x=cat(...[0,1,2].map(i=>cat(voice(R,.6,v,{f0,level:-24,seed:f0+i,hnr:15}),silence(R,.35))));
    replay(`synthetic child "${v}", pitch ${f0}Hz, -24dBFS, over pink ${room}dBFS`,true,stream(R,[[x]],{roomKind:'pink',roomDb:room}));}
  // A sound under a second must still be broad: beeps, a chime, a short tone.
  for(const [k,o] of [['beeps',{}],['chime',{}],['tone',{duration:.5}],['sweep',{duration:1.5}]])replay(`${k} ${JSON.stringify(o)}`,false,stream(R,[[fixture(k,R,o)]]));
  // Only a counted try starts the double-count lockout.
  replay('a T 200ms after a rejected 1.8s tone',true,stream(R,[[fixture('tone',R)],[held(await rec('T-demo'),R,.3),.35+1.8+.2]]),R,{after:.35+1.8});
  for(const k of ['tone','hum','white noise','breath'])replay(`${k} over pink room noise -40dBFS`,false,stream(R,[[fixture(k,R)]],{roomKind:'pink',roomDb:-40}));
  for(const g of [.3,2.5,4])for(const k of ['tone','hum','white noise','breath','claps','clicks'])replay(`${k} at ${g}x volume`,false,stream(R,[[fixture(k,R,{gain:g})]]));
  // One said sound under a second counts once it ends, however steady or quiet.
  for(const s of ['S','SH','F','TH'])for(const g of [1,.5])replay(`${s} held 0.6s at ${g}x volume`,true,stream(R,[[gain(held(await rec(s+'-demo'),R,.6),g)]]));
  for(const s of ['Z','CH'])replay(`${s} held 0.45s (no steady pitch, no hiss: counts as one short sound)`,true,stream(R,[[held(await rec(s+'-demo'),R,.45)]]));
  // ...and a steady S or SH held well past a second counts by its hiss.
  function steady(x,rate,sec){const y0=held(x,rate,1.5),a=Math.round(rate*.15),b=Math.min(y0.length-1,Math.round(rate*.55)),seg=y0.slice(a,b),n=Math.round(rate*sec),y=new Float32Array(n),xf=Math.round(rate*.02),step=seg.length-xf;
    for(let o=0;o<n;o+=step)for(let i=0;i<seg.length&&o+i<n;i++){const w=i<xf&&o>0?i/xf:1;y[o+i]=y[o+i]*(1-w)+seg[i]*w;}const f=Math.round(rate*.06);for(let i=0;i<f;i++){y[i]*=i/f;y[n-1-i]*=i/f;}return y;}
  for(const s of ['S','SH'])for(const g of [1,.5])replay(`${s} held steadily for 2.5s at ${g}x volume`,true,stream(R,[[gain(steady(await rec(s+'-demo'),R,2.5),g)]]));
  for(const s of ['S','SH','F'])replay(`${s} at a third of the volume`,true,stream(R,[[gain(await rec(s+'-demo'),.35)]]));
  // A child answering before the silent quarter-second ends: the clean repeat counts.
  // (A real mic always hisses faintly, here at -70dBFS: calibration is never pure zeros.)
  for(const s of ['R','L','G','M','S'])replay(`${s}: 100ms of the voice inside the quiet check, clean repeat`,true,stream(R,[[held(await rec(s+'-demo'),R,1),.15],[await rec(s+'-demo'),3.5]],{lead:0,roomKind:'white',roomDb:-70}),R,{after:3.4});
  // Timings are milliseconds: 30fps (Low Power Mode) and 120fps displays.
  for(const s of ['P','T','M'])replay(`${s} at 30fps`,true,stream(R,[[await rec(s+'-demo')]]),R,{fps:30});
  // A long sound with no steady pitch (Rachel's creaky L) counts only by its
  // loudness changing; at 24-30fps with real timing jitter that must hold too.
  for(const [fps,seed] of [[30,1],[30,2],[30,3],[24,1],[24,2],[24,3]])replay(`L at ${fps}fps, timing jitter (seed ${seed})`,true,stream(R,[[await rec('L-demo')]]),R,{fps,jitter:.35,seed:seed*7919});
  for(const k of ['tone','white noise'])replay(`${k} at 30fps`,false,stream(R,[[fixture(k,R)]]),R,{fps:30});
  replay('claps at 120fps (under the ~45ms minimum)',false,stream(R,[[fixture('claps',R)]]),R,{fps:120});
  // The room is sampled across the whole quiet quarter-second at any frame
  // rate: at a very high rate, the first few ms (before the room noise even
  // arrives) must not stand in for the room.
  replay('tone over room noise that arrives 20ms late, at 2000fps',false,stream(R,[[room(R*3,R,'pink',-40),.02],[fixture('tone',R),.4]],{lead:0}),R,{fps:2000});
  // ...and a brief click at its start (a door, a tap) does not stand in for it either.
  replay('M at half volume after a 40ms click at the start of the quiet check, at 2000fps',true,stream(R,[[room(R*4,R,'pink',-40),0],[fixture('white noise',R,{duration:.04,gain:1.5,fadeIn:.002,fadeOut:.002}),.005],[gain(await rec('M-demo'),.5),.45]],{lead:0}),R,{fps:2000});
  // A phone's mic can deliver pure digital silence while it warms up: that is
  // not the room, however much of the quiet quarter-second it fills.
  for(const k of ['tone','hum'])replay(`${k} over room noise that arrives 150ms late`,false,stream(R,[[room(R*3,R,'pink',-40),.15],[fixture(k,R),.45]],{lead:0}));
  replay('M at half volume over room noise that arrives 150ms late',true,stream(R,[[room(R*4,R,'pink',-40),.15],[gain(await rec('M-demo'),.5),.45]],{lead:0}));
  // Long steady noise and slow gain drift never swell 4.5dB within 0.8s.
  for(const [k,o] of [['white noise',{duration:5}],['breath',{duration:5}],['drift',{duration:5,dbPerS:5}]])replay(`${k} ${JSON.stringify(o)}`,false,stream(R,[[fixture(k,R,o)]]));
  // Bluetooth routes run at 16kHz.
  for(const s of ['L','S','M'])replay(`${s} at 16kHz`,true,stream(16000,[[await rec(s+'-demo',16000)]]),16000);
  for(const s of ['M','N','L'])replay(`${s} at 96kHz`,true,stream(96000,[[await rec(s+'-demo',96000)]]),96000);
  // A VOICE IS NOT A ROOM (24 Sep 2026). A child already saying the sound
  // through the whole quiet quarter-second used to become "the room": the bar
  // landed above their voice and nothing counted. Now that quarter-second is
  // not a room (louder than ROOM_MAX); the try in progress counts once it
  // ends (if it was voiced or a hiss), and the repeats count against the room
  // learned in the pause. The old rule (median, uncapped) counted none of
  // these. Rachel's creaky L counts only by its loudness changing, which is
  // just what a burst of loud room does: before a pause, nothing can tell
  // the two apart, so the L said through the quarter-second is not counted
  // and its two repeats are.
  for(const [s,want] of [['R',3],['M',3],['N',3],['Z',3],['L',2]])await(async()=>{const x=await rec(s+'-demo');
    const r=replay(`${s} said from the first frame, through the whole quiet quarter-second, then twice more`,true,stream(R,[[held(x,R,1),0],[held(x,R,.6),1.6],[held(x,R,.6),2.8]],{lead:0,roomKind:'white',roomDb:-70}),R,{loud:true});
    ok(`replay: ${s} from the first frame: ${want===3?'all three count':'the two repeats count'}, the room is learned in the pause, the bar never above ${3*evidence.ROOM.max}`,r.reps===want&&r.voice&&r.learned&&r.thr<=3*evidence.ROOM.max+1e-9,{reps:r.reps,at:r.at,voice:r.voice,learned:r.learned,thr:r.thr});})();
  // ...and a room loud enough to be taken for a voice still never counts: at
  // the capped bar and above it (-20dBFS is ~0.1, twice the ceiling's bar and
  // ten times the loudest room above), whether it has pauses to learn from
  // (pink, white) or none (a steady hum, never quiet, never ending).
  for(const kind of ['pink','white','hum'])for(const db of [-26,-21,-20,-15])replay(`a ${kind} room at ${db}dBFS from the first frame, nothing said`,false,room(R*8,R,kind,db,99),R,{loud:true});
  await dec.close();
  // REWRITTEN 24 Sep 2026: this pinned that every bar sat at the 0.035 floor
  // (so the replay's median and the page's 20th percentile agreed). The
  // replay takes the 20th percentile now. What is pinned instead: no room in
  // the fixtures above is ever taken for a voice (ROOM_MAX sits clear of
  // them), and no bar anywhere is over 3 x ROOM_MAX.
  const misread=bars.filter(b=>!b.loud&&b.voice),over=bars.filter(b=>b.thr>3*evidence.ROOM.max+1e-9);
  ok('replay: no fixture\'s room is read as a voice (ROOM_MAX '+evidence.ROOM.max+')',bars.length>0&&!misread.length,misread);
  ok('replay: no bar is ever over 3 x ROOM_MAX',!over.length,over);
  if(process.env.SPEECHEV_ONLY==='replay')throw 'replay-only';

  // ---------- 2. REAL ENGINE ----------
  // A fan, fridge or TV fills the low band a nasal lives in, burying what the
  // voice puts above ~1kHz. The rule must still hear M/N/V and G/R, and still
  // reject the noises.
  const ROOM={room:-40};
  for(const s of ['M','N','V'])await speech(`${s} at half volume over room noise (pink, -40dBFS)`,{...ROOM,sound:s},s+'-demo.mp3',{max:3,gain:.5});
  for(const s of ['G','R'])await speech(`${s} over room noise (pink, -40dBFS)`,{...ROOM,sound:s},s+'-demo.mp3',{max:3});
  for(const k of ['tone','hum','white noise','breath'])await noise(`${k} over room noise`,ROOM,k);
  await noise('beeps (short, single note)',{},'beeps');
  // Held sounds: one said sound under a second counts once it ends, however
  // steady; a quiet one counts too.
  for(const [s,sec] of [['S',.6],['SH',.6],['F',.5],['TH',.5],['S',.9]])await speech(`${s} held ${sec}s`,{sound:s},s+'-demo.mp3',{sec});
  for(const s of ['S','SH','F'])await speech(`${s} at a third of the volume`,{sound:s},s+'-demo.mp3',{max:3,gain:.35});
  // WebKit halves animation frames in Low Power Mode; timings are in ms.
  // (Short stops at 30fps are pinned in the replay: in real time they sit on
  // the detector's own 4-frame onset, which this change leaves as it was.)
  await speech('M at 30fps',{fps:30,sound:'M'},'M-demo.mp3',{max:3});
  for(const k of ['tone','white noise'])await noise(`${k} at 30fps`,{fps:30},k);
  // A child who answers in the last ~80ms of the silent quarter-second must
  // not raise the room level for the rest of the attempt. (Rachel's creaky L,
  // which counts only by loudness change, is pinned in the replay instead:
  // at 30fps its real-time result sits on the threshold.)
  for(const s of ['M','S','R','G'])await scenario(`${s} answered 80ms before calibration ends, then repeated`,async()=>{
    const{page,context,errors}=await fresh({sound:s,noWait:true,floor:-70});
    try{
      await page.evaluate(f=>__ev.play(f,{sec:1,at:170}),s+'-demo.mp3');await settle(page);
      const first=await tries(page);await page.waitForTimeout(400);
      await page.evaluate(f=>__ev.play(f,{max:3}),s+'-demo.mp3');await settle(page);
      const second=await tries(page)-first;
      ok(`${s} answered early: the clean repeat counts`,second>0,{first,second});ok(`${s} answered early: no script error`,errors.length===0,errors);
    }finally{await close(context,page);}
  });
  await quickTries();
}catch(e){if(e!=='replay-only'&&e!=='tail-only'&&e!=='quick-only')throw e;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
console.log(`Speech evidence: ${checks-failures}/${checks} passed`);process.exitCode=failures?1:0;
