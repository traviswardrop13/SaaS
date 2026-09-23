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
  const h=window.__repHarness={streams:[],effects:[],frames:0,speechFrames:0,verifyCalls:0,modelLines:[],metrics:[],source:null,ctx:null,decoder:null};
  const AC=window.AudioContext||window.webkitAudioContext;
  // Every accidental connection to physical output is muted at the graph,
  // in addition to the suite-wide Chromium and speech-synthesis mute.
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(destination,...rest){
    if(destination===this.context.destination){const silent=this.context.createGain();silent.gain.value=0;connect.call(silent,destination);return connect.call(this,silent,...rest);}
    return connect.call(this,destination,...rest);
  };
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
    const ctx=new AC({sampleRate:48000});await ctx.resume();
    const destination=ctx.createMediaStreamDestination();
    h.ctx=ctx;h.destination=destination;h.streams.push(destination.stream);return destination.stream;
  }});
  let sona;
  Object.defineProperty(window,'Sona',{configurable:true,get:()=>sona,set(value){
    sona=value;
    value.speechPerm=()=>Promise.resolve(true);
    value.speechStart=()=>Promise.resolve(!!config.native);
    value.speechStop=()=>Promise.resolve({text:config.native?'rrrr':''});
    value.isNativeApp=()=>!!config.native;
    const verdict=value.hearVerdict;
    value.hearVerdict=function(...args){h.verifyCalls++;return verdict.apply(value,args);};
    if(value.speechFrame){const frame=value.speechFrame;value.speechFrame=function(...args){const r=frame.apply(value,args);h.frames++;if(r.speech)h.speechFrames++;if(h.metrics.length<20&&r.rms>.025)h.metrics.push(r);return r;};}
    for(const key of ['logAttempt','bumpReps','recordSession','recordRung','rotAdvance','saveRecording','dailyFinish']){
      const original=value[key];value[key]=function(...args){h.effects.push(key);return original.apply(value,args);};
    }
    value.confetti=()=>{};
    Object.keys(value.sfx||{}).forEach(key=>{if(typeof value.sfx[key]==='function')value.sfx[key]=()=>{};});
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
  localStorage.setItem('sona.freeera.v1','post');localStorage.setItem('sona.freeera2.v1','done');localStorage.setItem('sona.freeera3.v1','done');localStorage.setItem('sona.micok','1');
  localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Test child',childAge:'7',focusSounds:[config.sound],onboarded:true,voiceOn:false,soundOn:false,volume:0}));
  localStorage.setItem('sona.progress.v1',JSON.stringify({sessions:[],totals:{sessions:0,words:0,stars:0,coins:0,rounds:0},streak:{count:0,lastDate:''},bySound:{},stage:{},chests:{},missed:[]}));
  sessionStorage.setItem('sona.run.v1',JSON.stringify({active:true,round:0,sum:0,scores:[],pending:false,sound:config.sound,level:1,demo:false,games:['slice','tiles','stack','run','glide']}));
}
async function fresh(config={}){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  await context.addInitScript(signalDevice,{sound:'R',native:false,...config});
  const page=await context.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
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
