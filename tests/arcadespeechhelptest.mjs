// Speech earns useful help during each arcade game, without resetting the board.
// This drives the real ask, analyser and native verdict; no success helper
// is called to manufacture a reward. Audio and native recognition are local fakes.
//
// ECHO ASKS, THEN LISTENS (Travis, 3 Oct 2026): nobody taps. After some play
// Echo asks on his own and listens for SLOW_ASK.listen ms while the game keeps
// going; the game's own sounds pause meanwhile. The suite shortens the wait
// for the ask (slowAskAt) so it comes at once, and plays both the ask and the
// tap on Echo, which is still a shortcut.
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
async function scenario(name,fn) { if(process.env.ARCADE_HEARTS_ONLY && !name.includes("heart recovery"))return; try{await fn();}catch(e){ok(name+' completes without a harness/page exception',false,e.stack);} }
const browser = await chromium.launch(launchOpts());

function phone(cfg) {
  // cfg.native: inside the iPhone app, where Echo's lines are media elements
  if(cfg.native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'ios',Plugins:{}};
  const h=window.__slowTest={voice:false,hidden:false,text:cfg.text==null?'rrrr':cfg.text,web:0,webPending:0,native:0,nativePending:0,starts:0,stops:0,requests:0,sounds:[],practice:[],stoppedAt:-1e9,startDelay:cfg.startDelay||0};
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>h.hidden});
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>h.hidden?'hidden':'visible'});
  h.hide=()=>{h.hidden=true;document.dispatchEvent(new Event('visibilitychange'));};
  h.show=()=>{h.hidden=false;document.dispatchEvent(new Event('visibilitychange'));};
  window.addEventListener('beforeunload',()=>{try{sessionStorage.setItem('sona.slow-exit-test',JSON.stringify({web:h.web,native:h.native,pending:h.nativePending,browserPending:h.webPending,bad:h.sounds.filter(s=>s.web||s.native),practice:h.practice}));}catch(e){}});
  h.audio=(kind)=>{h.sounds.push({kind,at:performance.now(),web:h.web,native:h.native});};
  navigator.mediaDevices.getUserMedia=()=>{
    h.requests++;
    if(cfg.denied)return Promise.reject(new DOMException('denied','NotAllowedError'));
    h.webPending++;
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
  localStorage.setItem('sona.freeera.v1','post');for(const k of ['sona.freeera2.v1','sona.freeera3.v1','sona.freeera4.v1','sona.freeera5.v1'])localStorage.setItem(k,'done');
  localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Mia',childAge:'7',focusSounds:['R'],onboarded:true,earlyAdopter:true,voiceOn:cfg.voiceOn===true,soundOn:true,volume:.6}));
  localStorage.setItem('sona.micok','1');sessionStorage.setItem('sona.play.token','arcade-'+cfg.game+'.html');sessionStorage.setItem('sona.boost.sound','R');
  // past Sound Sprint's start card (a child's first three races; runtest plays it), so its race is running
  localStorage.setItem('sona.sprintintro.v1','3');
}
async function fresh(cfg={}) {
  const context=await browser.newContext({viewport:{width:cfg.width||393,height:cfg.width===320?568:852},reducedMotion:'reduce'});
  const tts=[];
  await context.route('**/*',r=>{if(cfg.voiceOn&&r.request().url()===BASE+'/api/tts'){try{tts.push(JSON.parse(r.request().postData()).text);}catch(e){}return r.fulfill({status:200,contentType:'audio/pcm',body:Buffer.alloc(2400)});}return r.request().url().startsWith(BASE+'/')?r.continue():r.abort();});
  await context.addInitScript(phone,cfg);
  const page=await context.newPage();page.setDefaultTimeout(6000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'/arcade-'+cfg.game+'.html?from=charge');
  await page.waitForFunction(()=>window.gameEntryAllowed===true&&typeof draw==='function');
  await page.evaluate(()=>{var clear=ctx.clearRect;__slowTest.frames=0;ctx.clearRect=function(){__slowTest.frames++;return clear.apply(this,arguments);};});
  return{context,page,errors,tts};
}
// Echo's next ask, now: the wait for it (SLOW_ASK.first, then .every) is
// play time, so the suite shortens what is left of it
async function ask(page,listenMs){await page.evaluate(ms=>{if(ms)SLOW_ASK.listen=ms;slowAskAt=Math.min(slowAskAt,150);},listenMs||0);}
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
const IDLE='Say rrrr when Echo asks';
try {
  for(const game of selected){
    const probe=await fresh({game});
    const exists=await probe.page.locator('#slowKeys').count();
    ok(game+': the sound power is on the board',exists===1);
    await probe.context.close();
    if(exists!==1)continue; // The pre-change tree fails here, not with a timeout.
    available.push(game);
    await scenario(game+' heart recovery',async()=>{
      const{context,page,errors,tts}=await fresh({game,voiceOn:true,native:true,text:'taco'});try{
        const installed=await page.evaluate(()=>typeof hearts!=='undefined'&&typeof loseHeart==='function');
        ok(game+': a real heart and speech recovery system is installed',installed);if(!installed)return;
        await seed(page,game);
        const loss=await page.evaluate(()=>{loseHeart(performance.now());return{hearts,at:slowAskAt,play:slowAskPlay};});
        ok(game+': a lost heart brings Echo back within 1.5 seconds of play',loss.hearts===2&&loss.at-loss.play<=1500,loss);
        await ready(page);await voiced(page);await page.waitForFunction(()=>!slowTurn);
        ok(game+': taco gives neither a heart nor a power',await page.evaluate(()=>hearts===2&&slowMs===0));
        await page.evaluate(()=>{__slowTest.text='rrrr';});await ask(page);await ready(page);await voiced(page);
        await page.waitForFunction(()=>!slowTurn&&slowMs>0);
        ok(game+': the accepted sound restores one heart AND the power',await page.evaluate(()=>hearts===3&&slowMs>0));
        const reason=await page.evaluate(()=>slowLineText());
        ok(game+': the early reason and the heart reason were warmed before the mic',tts.some(t=>/heart/.test(t))&&tts.some(t=>t!==reason),tts);
        await clean(game+' heart recovery',page,errors);
      }finally{await context.close();}
    });

    await scenario(game+' Echo asks with no tap, and the game keeps going',async()=>{
      const{context,page,errors}=await fresh({game});try{
        const plan=await page.evaluate(()=>({at:slowAskAt,first:SLOW_ASK.first,every:SLOW_ASK.every,quiet:SLOW_ASK.quiet,listen:SLOW_ASK.listen}));
        ok(game+': Echo first asks after six seconds of play, then every twenty, and listens for eight',plan.at===6000&&plan.first===10000&&plan.every===20000&&plan.quiet===40000&&plan.listen===8000,plan);
        await page.waitForTimeout(400);
        ok(game+': no ask and no mic before then',await page.evaluate(()=>!slowTurn&&__slowTest.requests===0&&__slowTest.starts===0));
        await seed(page,game);
        await ask(page);await ready(page);
        ok(game+': nobody tapped, and Echo is asking: his button breathes and his mic is open',await page.evaluate(()=>!!slowTurn&&__slowTest.web===1&&__slowTest.native===1&&document.getElementById('slowControl').classList.contains('asking')&&!document.getElementById('slowCancel')));
        const a=await state(page,game);
        const muted=await page.evaluate(()=>{var n=__slowTest.sounds.length;sfx('tap');return __slowTest.sounds.slice(n).length;});
        await page.waitForTimeout(250);const b=await state(page,game);
        ok(game+': silence earns no help',a.slowMs===0&&b.slowMs===0,b);
        ok(game+': the game keeps going while he listens: frames are drawn and the board moves',b.frames>a.frames&&JSON.stringify(frozen(a))!==JSON.stringify(frozen(b))&&b.playing,{a,b});
        ok(game+': the game\'s own sounds wait while he asks and listens',muted===0,muted);
        await voiced(page);
        await page.waitForFunction(()=>slowMs>0&&!slowTurn);
        // Fruit Slice's is Super Slice, ten seconds (29 Sep 2026); the rest keep eight.
        const earnedMs=game==='slice'?10000:8000;
        ok(game+': voiced R and native R earn '+earnedMs/1000+' seconds of help',await page.evaluate(ms=>slowMs>ms-1000&&slowMs<=ms,earnedMs));
        ok(game+': accepted help does not spend a between-round prompt',await page.evaluate(r=>REV===r,a.rev));
        ok(game+': the next ask waits twenty seconds of play, counted once the help is over',await page.evaluate(()=>slowAskAt===SLOW_ASK.every&&slowMissed===0&&slowAskPlay===0));
        await seed(page,game);const c=await state(page,game);await page.waitForTimeout(500);const d=await state(page,game);
        const frames=d.frames-c.frames,elapsed=d.at-c.at;
        const travel=game==='run'?(d.y-c.y):game==='glide'?(c.x-d.x):(d.x-c.x);
        const rate=travel/(frames*c.normal);
        ok(game+': the real moving game object slows to about 55 percent',frames>12&&rate>.47&&rate<.64,{frames,rate,c,d});
        if(game==='slice'||game==='glide'){
          const pacing=(d.clock-c.clock)/elapsed;
          ok(game+': new obstacles or fruit slow too, preserving spacing',pacing>.43&&pacing<.67,{pacing});
        }
        if(game==='run'){
          const pacing=(c.clock-d.clock)/(frames*c.normal);
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
        await clean(game+' accepted ask',page,errors);
      }finally{await context.close();}
    });
    await scenario(game+' nothing heard',async()=>{
      const{context,page,errors}=await fresh({game});try{
        await ask(page,1500);await ready(page);
        await page.waitForFunction(()=>!slowTurn,null,{timeout:4000});
        const s1=await page.evaluate(()=>({web:__slowTest.web,native:__slowTest.native,slowMs,playing,status:document.getElementById('slowStatus').textContent,at:slowAskAt,missed:slowMissed,asking:document.getElementById('slowControl').classList.contains('asking')}));
        ok(game+': when his listening ends the mic closes, nothing is earned and the game is still going',s1.web===0&&s1.native===0&&s1.slowMs===0&&s1.playing&&!s1.asking,s1);
        ok(game+': no "try again" and no tap asked for: the status rests on "'+IDLE+'"',s1.status===IDLE,s1.status);
        ok(game+': the next ask waits twenty seconds of play',s1.at===20000&&s1.missed===1,s1);
        await ask(page,1500);await ready(page);await page.waitForFunction(()=>!slowTurn,null,{timeout:4000});
        ok(game+': two asks in a row with nothing heard: the next one waits forty seconds',await page.evaluate(()=>slowAskAt===SLOW_ASK.quiet&&slowMissed===2));
        await clean(game+' nothing heard',page,errors);
      }finally{await context.close();}
    });
    await scenario(game+' unrelated word',async()=>{
      const{context,page,errors}=await fresh({game,text:'taco'});try{
        await ask(page);await ready(page);await voiced(page);
        await page.waitForFunction(()=>__slowTest.stops>0);await page.waitForFunction(()=>!slowTurn);
        ok(game+': native taco cannot earn an R reward',await page.evaluate(()=>slowMs===0&&playing&&__slowTest.starts===1));
        await clean(game+' wrong word',page,errors);
      }finally{await context.close();}
    });
    // 2 Oct 2026: a sound heard just before the limit keeps the mic open
    // 550 ms more for Apple's recognizer; Block Stacker, Sound Sprint and
    // Flappy Glide used to let the limit throw it away. Fruit Slice already
    // kept it, and now all four do.
    await scenario(game+' a sound just before the limit',async()=>{
      const{context,page,errors}=await fresh({game});try{
        await ask(page,3000);await ready(page);
        await page.waitForFunction(()=>performance.now()-__slowTest.openedAt>=2500,null,{timeout:6000});
        await page.evaluate(()=>{__slowTest.voice=true;});
        const heard=await page.waitForFunction(()=>slowTurn&&slowTurn.heardAt,null,{timeout:2000}).then(()=>true,()=>false);
        const at=await page.evaluate(()=>slowTurn&&slowTurn.heardAt?slowTurn.heardAt-__slowTest.openedAt:null);
        await page.waitForFunction(()=>!slowTurn,null,{timeout:4000});
        await page.evaluate(()=>{__slowTest.voice=false;});
        ok(game+': a sound heard in the last moment before the limit still earns the help',heard&&at>2450&&(await page.evaluate(()=>slowMs>0)),{at,status:await page.locator('#slowStatus').innerText()});
        await clean(game+' late sound',page,errors);
      }finally{await context.close();}
    });
    await scenario(game+' a tap on Echo asks at once',async()=>{
      const{context,page,errors}=await fresh({game});try{
        await page.locator('#slowKeys').click();await ready(page);
        ok(game+': the tap is a shortcut to the same ask: he listens and the game keeps going',await page.evaluate(()=>!!slowTurn&&playing&&__slowTest.web===1));
        await voiced(page);await page.waitForFunction(()=>slowMs>0&&!slowTurn);
        ok(game+': and the sound earns the help',await page.evaluate(()=>slowMs>0));
        await clean(game+' tapped',page,errors);
      }finally{await context.close();}
    });
    await scenario(game+' a phone that said no to the mic',async()=>{
      const{context,page,errors}=await fresh({game,denied:true});try{
        await ask(page);await page.waitForFunction(()=>__slowTest.requests===1&&!slowTurn,null,{timeout:4000});
        ok(game+': the ask ends, nothing is earned, the game goes on, and Echo stops asking for this visit',await page.evaluate(()=>slowNoMic&&slowMs===0&&playing&&/Microphone is off/.test(document.getElementById('slowStatus').textContent)));
        await page.evaluate(()=>{slowAskAt=100;});await page.waitForTimeout(700);
        ok(game+': no second ask and no second request',await page.evaluate(()=>__slowTest.requests===1&&!slowTurn));
        ok(game+' refused mic: no runtime errors',errors.length===0,errors);
      }finally{await context.close();}
    });
    for(const owner of ['native','browser'])await scenario(game+' exit during delayed '+owner+' start',async()=>{
      const{context,page,errors}=await fresh({game,startDelay:owner==='native'?1100:0,webDelay:owner==='browser'?1100:0});try{
        await ask(page);
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
        await ask(page);await ready(page);
        const fit=await page.evaluate(()=>{const r=document.getElementById('slowControl').getBoundingClientRect(),t=document.getElementById('top').getBoundingClientRect();return{l:r.left,r:r.right,t:r.top,b:r.bottom,h:innerHeight,w:innerWidth,hud:t.bottom,cancel:!!document.getElementById('slowCancel')};});
        ok(game+' '+width+': Echo\'s asking button fits below the HUD and within the phone, with no cancel button',fit.l>=0&&fit.r<=fit.w&&fit.t>=fit.hud&&fit.b<=fit.h&&!fit.cancel,fit);
        if(CAPTURE)await page.screenshot({path:path.join(CAPTURE,game+'-'+width+'-listening.png')});
        await voiced(page);await page.waitForFunction(()=>slowMs>0&&!slowTurn);
        ok(game+' '+width+': no runtime errors',errors.length===0,errors);
      }finally{await context.close();}
    });
  }
  // What Echo says, inside the iPhone app, where every line is a media element
  if(available.includes('slice'))await scenario('what Echo says when he asks',async()=>{
    const{context,page,errors,tts}=await fresh({game:'slice',voiceOn:true,native:true});try{
      const said=()=>page.evaluate(()=>__slowTest.sounds.filter(s=>s.kind==='voice').map(s=>({url:/^blob:/.test(s.url)?'line':s.url.replace(/^.*\/coach/,'/coach'),end:s.end})));
      await ask(page,1500);await page.waitForFunction(()=>__slowTest.web===1,null,{timeout:8000});
      const h=await said(),opened=await page.evaluate(()=>__slowTest.openedAt);
      ok('the first ask: Super Slice\'s line, one take of Rachel\'s R, then "Go!", as media in the app',h.map(a=>a.url).join()==='line,/coach/say-echo/R-sound.wav,line'&&tts.includes('Super Slice! Say')&&tts.includes('Go!'),{h,tts});
      ok('the mic opens only after "Go!" has ended and its quiet tail',h.length===3&&h[2].end!==null&&opened-h[2].end>=240,{h,opened});
      await page.waitForFunction(()=>!slowTurn,null,{timeout:5000});
      const n=h.length,asked=tts.length;
      await ask(page,1500);await page.waitForFunction(()=>__slowTest.web===1,null,{timeout:8000});
      const second=(await said()).slice(n).map(a=>a.url);
      ok('a later ask in the same visit: just her take of the sound and "Go!", with no new download',second.join()==='/coach/say-echo/R-sound.wav,line'&&tts.length===asked,{second,tts});
      await page.waitForFunction(()=>!slowTurn,null,{timeout:5000});
      await clean('what Echo says',page,errors);
    }finally{await context.close();}
  });
  // A wave can end while Echo asks now that the game keeps going: the turn
  // ends first, and the say-it card after it works as it always has.
  if(available.includes('slice'))await scenario('a wave that ends while Echo asks',async()=>{
    const{context,page,errors}=await fresh({game:'slice'});try{
      await ask(page);await ready(page);
      await page.evaluate(()=>{waveGot=WAVES[wave].goal;});
      await page.waitForFunction(()=>!slowTurn,null,{timeout:3000});
      ok('the turn ends with its wave: both mics closed and nothing earned',await page.evaluate(()=>__slowTest.web===0&&__slowTest.native===0&&slowMs===0&&phase!=='wave'));
      ok('a turn the wave ended is not counted as a miss',await page.evaluate(()=>slowMissed===0));
      await page.locator('#revOvl.show').waitFor({timeout:12000});
      await page.waitForFunction(()=>reviveWait&&__slowTest.web===1,null,{timeout:8000});
      ok('the say-it card then opens its own mic, as always',await page.evaluate(()=>reviveWait&&!slowTurn&&__slowTest.web===1));
      ok('a wave that ended under an ask: no runtime errors',errors.length===0,errors);
    }finally{await context.close();}
  });
}finally{await browser.close();await new Promise(r=>server.close(r));}
console.log(failures?failures+' FAILURES / '+assertions+' assertions':'ALL GREEN — '+assertions+' assertions');
process.exit(failures?1:0);
