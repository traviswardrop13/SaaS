// Speech earns useful help during each arcade game, without resetting the board.
// This drives the real button, analyser and native verdict; no success helper
// is called to manufacture a reward. Audio and native recognition are local fakes.
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs';
import path from 'path';
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from './_env.mjs';

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT;
const CAPTURE = process.env.ARCADE_SPEECH_CAPTURE;
if(CAPTURE)mkdirSync(CAPTURE,{recursive:true});
const MIME = { html:'text/html', js:'text/javascript', css:'text/css', svg:'image/svg+xml', png:'image/png', webp:'image/webp', woff2:'font/woff2', mp3:'audio/mpeg' };
const server = createServer((req,res) => {
  const u = new URL(req.url,'http://localhost'), candidate = path.join(ROOT,u.pathname);
  const f=existsSync(candidate)?candidate:path.join(SOURCE_ROOT,u.pathname);
  if(u.pathname.startsWith('/api/')) { res.writeHead(503); res.end('{}'); return; }
  if(!existsSync(f)||!statSync(f).isFile()) { res.writeHead(404);res.end();return; }
  res.writeHead(200,{'content-type':MIME[f.split('.').pop()]||'application/octet-stream'});res.end(readFileSync(f));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const BASE = 'http://127.0.0.1:'+server.address().port;
let failures=0, assertions=0;
function ok(name,pass,detail='') { assertions++; if(!pass)failures++; console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' → '+JSON.stringify(detail))); }
async function scenario(name,fn) { try{await fn();}catch(e){ok(name+' completes without a harness/page exception',false,e.stack);} }
const browser = await chromium.launch(launchOpts());

function phone(cfg) {
  const h=window.__slowTest={voice:false,hidden:false,text:cfg.text==null?'rrrr':cfg.text,web:0,webPending:0,native:0,nativePending:0,starts:0,stops:0,requests:0,sounds:[],practice:[],stoppedAt:-1e9,startDelay:cfg.startDelay||0};
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>h.hidden});
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>h.hidden?'hidden':'visible'});
  h.hide=()=>{h.hidden=true;document.dispatchEvent(new Event('visibilitychange'));};
  h.show=()=>{h.hidden=false;document.dispatchEvent(new Event('visibilitychange'));};
  window.addEventListener('beforeunload',()=>{try{sessionStorage.setItem('sona.slow-exit-test',JSON.stringify({web:h.web,native:h.native,pending:h.nativePending,browserPending:h.webPending,bad:h.sounds.filter(s=>s.web||s.native),practice:h.practice}));}catch(e){}});
  h.audio=(kind)=>{h.sounds.push({kind,at:performance.now(),web:h.web,native:h.native});};
  navigator.mediaDevices.getUserMedia=()=>{
    h.requests++;h.webPending++;
    return new Promise(resolve=>setTimeout(()=>{
    h.webPending--;h.web++;h.openedAt=performance.now();
    const t={kind:'audio',readyState:'live',stop(){if(this.readyState==='live'){this.readyState='ended';h.web--;h.stoppedAt=performance.now();}}};
    resolve({getTracks:()=>[t],getAudioTracks:()=>[t]});
    },cfg.webDelay||0));
  };
  const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});
  const node=()=>({gain:param(),frequency:param(),Q:param(),connect(){},disconnect(){},start(){h.audio('note');},stop(){}});
  function AC(){this.state='running';this.sampleRate=48000;this.destination={};}
  AC.prototype={resume(){return Promise.resolve();},suspend(){return Promise.resolve();},close(){return Promise.resolve();},createGain:node,createOscillator:node,createBufferSource:node,createBiquadFilter:node,
    createBuffer(c,n,sr){return{length:n,sampleRate:sr,duration:n/sr,getChannelData:()=>new Float32Array(n)};},
    createMediaStreamSource(st){return{connect(an){an.stream=st;},disconnect(){}};},
    createAnalyser(){return{fftSize:512,frequencyBinCount:256,connect(){},disconnect(){},
      getByteTimeDomainData(a){for(let i=0;i<a.length;i++)a[i]=h.voice?(i%2?190:66):128;},
      getByteFrequencyData(a){a.fill(0);if(h.voice)for(let i=cfg.hiss?40:1;i<=(cfg.hiss?80:10);i++)a[i]=220;},
      getFloatTimeDomainData(a){a.fill(0);},getFloatFrequencyData(a){a.fill(-120);}};}
  };
  Object.defineProperty(AC.prototype,'currentTime',{get:()=>performance.now()/1000});
  window.AudioContext=window.webkitAudioContext=AC;
  HTMLMediaElement.prototype.play=function(){const a=this,rec={kind:'voice',url:a.src,at:performance.now(),end:null,web:h.web,native:h.native};h.sounds.push(rec);a.__record=rec;a.__timer=setTimeout(()=>{rec.end=performance.now();if(a.onended)a.onended();},cfg.speechMs||20);return Promise.resolve();};
  HTMLMediaElement.prototype.pause=function(){clearTimeout(this.__timer);if(this.__record&&this.__record.end===null)this.__record.end=performance.now();};
  let sona;
  Object.defineProperty(window,'Sona',{configurable:true,get:()=>sona,set(value){
    sona=value;value.confetti=()=>{};
    value.speechAvailable=()=>Promise.resolve(true);
    value.speechStart=()=>{h.starts++;h.nativePending++;return new Promise(resolve=>setTimeout(()=>{h.nativePending--;h.native=1;resolve(true);},h.startDelay));};
    value.speechStop=()=>{h.stops++;h.native=0;h.stoppedAt=performance.now();return Promise.resolve({text:h.text,onDevice:true});};
    for(const k of ['logAttempt','bumpReps','recordSession','recordRung','rotAdvance','repsBeacon']) {const real=value[k];value[k]=function(){h.practice.push(k);return real?real.apply(this,arguments):undefined;};}
    for(const k of Object.keys(value.sfx||{}))if(k!=='stop'&&typeof value.sfx[k]==='function')value.sfx[k]=()=>h.audio('sfx:'+k);
  }});
  localStorage.setItem('sona.freeera.v1','post');for(const k of ['sona.freeera2.v1','sona.freeera3.v1','sona.freeera4.v1'])localStorage.setItem(k,'done');
  localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Mia',childAge:'7',focusSounds:['R'],onboarded:true,earlyAdopter:true,voiceOn:cfg.voiceOn===true,soundOn:true,volume:.6}));
  localStorage.setItem('sona.micok','1');sessionStorage.setItem('sona.play.token','arcade-'+cfg.game+'.html');sessionStorage.setItem('sona.boost.sound','R');
}
async function fresh(cfg={}) {
  const context=await browser.newContext({viewport:{width:cfg.width||393,height:cfg.width===320?568:852},reducedMotion:'reduce'});
  await context.route('**/*',r=>{if(cfg.voiceOn&&r.request().url()===BASE+'/api/tts')return r.fulfill({status:200,contentType:'audio/pcm',body:Buffer.alloc(2400)});return r.request().url().startsWith(BASE+'/')?r.continue():r.abort();});
  await context.addInitScript(phone,cfg);
  const page=await context.newPage();page.setDefaultTimeout(6000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'/arcade-'+cfg.game+'.html?from=charge');
  await page.waitForFunction(()=>window.gameEntryAllowed===true&&typeof draw==='function');
  await page.evaluate(()=>{var clear=ctx.clearRect;__slowTest.frames=0;ctx.clearRect=function(){__slowTest.frames++;return clear.apply(this,arguments);};});
  return{context,page,errors};
}
async function voiced(page){await page.evaluate(()=>{__slowTest.voice=true;});await page.waitForTimeout(450);await page.evaluate(()=>{__slowTest.voice=false;});}
async function ready(page){await page.waitForFunction(()=>__slowTest.web===1&&__slowTest.native===1);await page.waitForTimeout(600);}
async function clean(label,page,errors){
  const h=await page.evaluate(()=>({web:__slowTest.web,native:__slowTest.native,bad:__slowTest.sounds.filter(s=>s.web||s.native),practice:__slowTest.practice}));
  ok(label+': both microphone owners are closed',h.web===0&&h.native===0,h);
  ok(label+': no game sound started with either microphone live',h.bad.length===0,h.bad);
  ok(label+': gameplay never writes practice or clinical records',h.practice.length===0,h.practice);
  ok(label+': no runtime errors',errors.length===0,errors);
}

const games=['slice','stack','run','glide'], available=[];
const selected=process.env.ARCADE_SPEECH_GAMES?process.env.ARCADE_SPEECH_GAMES.split(','):games;
// Deliberately put one real game object away from collisions. We observe its
// rendered motion, rather than calling the helper's success function.
async function seed(page,game){return page.evaluate(game=>{
  var h=__slowTest;h.frames=0;
  if(game==='slice'){fruits=[{e:'🍎',x:40,y:H*.4,vx:2,vy:-1,g:.001,rot:0,vr:.01,r:25,sliced:false}];nextToss=waveMs+10000;}
  if(game==='stack'){cur={x:30,w:100,dir:1,c:'#ffeeaa'};}
  if(game==='run'){things=[{t:'c',e:'🪙',lane:0,y:-50}];spawnGap=10000;lane=laneX=1;}
  if(game==='glide'){gates=[{x:W+50,cy:H*.5,passed:false,star:false,gold:false,got:false}];gateMs=0;gateEvery=10000;py=H*.5;vy=0;G=0;}
},game);}
async function state(page,game){return page.evaluate(game=>{
  var common={at:performance.now(),frames:__slowTest.frames,phase,slowMs,playing,rev:REV};
  if(game==='slice')Object.assign(common,{x:fruits[0]&&fruits[0].x,y:fruits[0]&&fruits[0].y,velocity:fruits[0]&&fruits[0].vy,clock:waveMs,score,wave,progress:waveGot,count:fruits.length,normal:2});
  if(game==='stack')Object.assign(common,{x:cur&&cur.x,score,progress:floorGot,count:stack.length,normal:speed});
  if(game==='run')Object.assign(common,{y:things[0]&&things[0].y,clock:spawnGap,score:coins,progress:dist,count:things.length,normal:speed});
  if(game==='glide')Object.assign(common,{x:gates[0]&&gates[0].x,y:py,velocity:vy,clock:gateMs,score,progress:legGot,count:gates.length,normal:gspeed});
  return common;
},game);}
function frozen(s){const{at,frames,...rest}=s;return rest;}
try {
  for(const game of selected){
    const probe=await fresh({game});
    const exists=await probe.page.locator('#slowKeys').count();
    ok(game+': child can start a sound turn during active play',exists===1);
    await probe.context.close();
    if(exists!==1)continue; // The pre-change tree fails here, not with a timeout.
    available.push(game);
    await scenario(game+' sound-powered gameplay',async()=>{
      const{context,page,errors}=await fresh({game});try{
        await seed(page,game);
        await page.locator('#slowKeys').click();await ready(page);
        const held=await state(page,game);await page.waitForTimeout(250);const silent=await state(page,game);
        ok(game+': tapping or silence earns no help',held.slowMs===0&&silent.slowMs===0,silent);
        ok(game+': the board, progress and score hold still while listening',JSON.stringify(frozen(held))===JSON.stringify(frozen(silent)),{held,silent});
        await page.locator('#slowCancel').click();await page.waitForFunction(()=>!slowTurn);
        ok(game+': cancelling resumes this game with no reward',await page.evaluate(()=>playing&&slowMs===0));
        await clean(game+' cancelled turn',page,errors);
        // This second turn has to hear the sound through the real analyser and
        // consult the real isolation verdict before the reward may appear.
        await page.locator('#slowKeys').click();await ready(page);await voiced(page);
        await page.waitForFunction(()=>slowMs>0&&!slowTurn);
        ok(game+': voiced R and native R earn eight seconds of help',await page.evaluate(()=>slowMs>7000&&slowMs<=8000));
        ok(game+': accepted help does not spend a between-round prompt',await page.evaluate(r=>REV===r,held.rev));
        await seed(page,game);const a=await state(page,game);await page.waitForTimeout(500);const b=await state(page,game);
        const frames=b.frames-a.frames,elapsed=b.at-a.at;
        const travel=game==='run'?(b.y-a.y):game==='glide'?(a.x-b.x):(b.x-a.x);
        const rate=travel/(frames*a.normal);
        ok(game+': the real moving game object slows to about 55 percent',frames>12&&rate>.47&&rate<.64,{frames,rate,a,b});
        if(game==='slice'||game==='glide'){
          const pacing=(b.clock-a.clock)/elapsed;
          ok(game+': new obstacles or fruit slow too, preserving spacing',pacing>.43&&pacing<.67,{pacing});
        }
        if(game==='run'){
          const pacing=(a.clock-b.clock)/(frames*a.normal);
          ok('run: new obstacles keep the slower course spacing',pacing>.47&&pacing<.64,{pacing});
        }
        // A backgrounded app cannot spend the child's short earned help.
        await page.evaluate(()=>__slowTest.hide());await page.waitForTimeout(80);const hidden=await state(page,game);
        await page.waitForTimeout(250);const hiddenAfter=await state(page,game);
        ok(game+': backgrounding freezes both the board and earned time',JSON.stringify(frozen(hidden))===JSON.stringify(frozen(hiddenAfter)),{hidden,hiddenAfter});
        await page.evaluate(()=>__slowTest.show());
        if(game==='slice'){
          await page.waitForFunction(()=>slowMs===0,null,{timeout:11000});
          ok('help expires naturally and normal fruit speed returns',await page.evaluate(()=>slowFactor()===1));
        }
        await clean(game+' accepted turn',page,errors);
      }finally{await context.close();}
    });
    await scenario(game+' unrelated word',async()=>{
      const{context,page,errors}=await fresh({game,text:'taco'});try{
        await page.locator('#slowKeys').click();await ready(page);await voiced(page);
        await page.waitForFunction(()=>__slowTest.stops>0);await page.waitForFunction(()=>!slowTurn);
        ok(game+': native taco cannot earn an R reward',await page.evaluate(()=>slowMs===0&&playing&&__slowTest.starts===1));
        await clean(game+' wrong word',page,errors);
      }finally{await context.close();}
    });
    for(const owner of ['native','browser'])await scenario(game+' exit during delayed '+owner+' start',async()=>{
      const{context,page,errors}=await fresh({game,startDelay:owner==='native'?1100:0,webDelay:owner==='browser'?1100:0});try{
        await page.locator('#slowKeys').click();
        await page.waitForFunction(owner=>owner==='native'?__slowTest.starts>0:__slowTest.webPending>0,owner);
        await page.evaluate(()=>document.getElementById('close').click());await page.waitForURL('**/today.html*');
        const exit=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('sona.slow-exit-test')||'null'));
        ok(game+' '+owner+': exit closes both mics and pending requests before navigation',!!exit&&exit.web===0&&exit.native===0&&exit.pending===0&&exit.browserPending===0,exit);
        ok(game+': exit never plays a sound into a live microphone',!!exit&&exit.bad.length===0,exit);
        ok(game+': exit has no runtime error or practice-data write',errors.length===0&&!!exit&&exit.practice.length===0,{exit,errors});
      }finally{await context.close();}
    });
    for(const width of [393,320])await scenario(game+' phone fit '+width,async()=>{
      const{context,page,errors}=await fresh({game,width});try{
        await page.locator('#slowKeys').click();await ready(page);
        const fit=await page.evaluate(()=>{const r=document.getElementById('slowControl').getBoundingClientRect(),c=document.getElementById('slowCancel').getBoundingClientRect(),t=document.getElementById('top').getBoundingClientRect();return{l:r.left,r:r.right,t:r.top,b:r.bottom,h:innerHeight,w:innerWidth,hud:t.bottom,c:c.width};});
        ok(game+' '+width+': sound control fits below HUD, within phone, with a usable cancel button',fit.l>=0&&fit.r<=fit.w&&fit.t>=fit.hud&&fit.b<=fit.h&&fit.c>=44,fit);
        if(CAPTURE)await page.screenshot({path:path.join(CAPTURE,game+'-'+width+'-listening.png')});
        await page.locator('#slowCancel').click();await page.waitForFunction(()=>!slowTurn);
        ok(game+' '+width+': no runtime errors',errors.length===0,errors);
      }finally{await context.close();}
    });
  }
  if(available.includes('slice'))await scenario('spoken instruction ordering',async()=>{
    const{context,page,errors}=await fresh({game:'slice',voiceOn:true});try{
      await page.locator('#slowKeys').click();await ready(page);
      const h=await page.evaluate(()=>({audio:__slowTest.sounds.filter(s=>s.kind==='voice'),opened:__slowTest.openedAt}));
      ok('Echo speaks the instruction, then models the recorded R sound',h.audio.length===2&&/^blob:/.test(h.audio[0].url)&&/\/coach\/say-echo\/R-demo\.mp3$/.test(h.audio[1].url),h);
      ok('listening starts only after the recording and its quiet tail',h.audio.length===2&&h.audio[1].end!==null&&h.opened-h.audio[1].end>=850,h);
      await page.locator('#slowCancel').click();await page.waitForFunction(()=>!slowTurn);await clean('spoken instruction',page,errors);
    }finally{await context.close();}
  });
}finally{await browser.close();await new Promise(r=>server.close(r));}
console.log(failures?failures+' FAILURES / '+assertions+' assertions':'ALL GREEN — '+assertions+' assertions');
process.exit(failures?1:0);
