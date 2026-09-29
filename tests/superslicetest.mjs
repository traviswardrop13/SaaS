// SUPERSLICE1: say your sound during Fruit Slice for Super Slice (Travis, 29
// Sep 2026: "give them an option to say the sound to slow the game down ...
// they go into some frenzy mode or easy mode or beast mode when they say
// their target sounds"). Tap Echo, the board holds, a star lights for each
// try, and every try buys time: 8, 10 or 12 seconds of slow fruit, a burst
// from the stand, more fruit per toss and a wide rainbow blade.
//
// This drives the real button, analyser, listening loop and native verdict
// on a fake phone. Nothing calls the success path directly; a try is loud
// frames the page's own analyser reads.
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import path from 'path';
import { chromium, ROOT, OUT, launchOpts } from './_env.mjs';

const MIME = { html:'text/html', js:'text/javascript', css:'text/css', svg:'image/svg+xml', png:'image/png', webp:'image/webp', woff2:'font/woff2', mp3:'audio/mpeg' };
const server = createServer((req,res) => {
  const u = new URL(req.url,'http://localhost'), f = path.join(ROOT,u.pathname);
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

// A phone whose mic hears loud, voiced frames only while h.voice is set, and
// whose speaker, Apple recognizer and practice records are all watched.
function phone(cfg) {
  const h=window.__ss={voice:false,text:cfg.text==null?'rrrr':cfg.text,web:0,webPending:0,native:0,starts:0,stops:0,requests:0,sounds:[],practice:[]};
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});
  h.audio=(kind)=>{h.sounds.push({kind,at:performance.now(),web:h.web,native:h.native});};
  navigator.mediaDevices.getUserMedia=()=>{
    h.requests++;h.webPending++;
    return new Promise(resolve=>setTimeout(()=>{
      h.webPending--;h.web++;
      const t={kind:'audio',readyState:'live',stop(){if(this.readyState==='live'){this.readyState='ended';h.web--;}}};
      resolve({getTracks:()=>[t],getAudioTracks:()=>[t]});
    },0));
  };
  const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});
  const node=()=>({gain:param(),frequency:param(),Q:param(),connect(){},disconnect(){},start(){h.audio('note');},stop(){}});
  function AC(){this.state='running';this.sampleRate=48000;this.destination={};}
  AC.prototype={resume(){return Promise.resolve();},suspend(){return Promise.resolve();},close(){return Promise.resolve();},createGain:node,createOscillator:node,createBufferSource:node,createBiquadFilter:node,
    createBuffer(c,n,sr){return{length:n,sampleRate:sr,duration:n/sr,getChannelData:()=>new Float32Array(n)};},
    createMediaStreamSource(){return{connect(){},disconnect(){}};},
    createAnalyser(){return{fftSize:512,frequencyBinCount:256,connect(){},disconnect(){},
      // h.dips: the voice drops out for 30 ms in every 150, as a real voice wobbles.
      getByteTimeDomainData(a){const on=h.voice&&!(h.dips&&performance.now()%150<30);for(let i=0;i<a.length;i++)a[i]=on?(i%2?190:66):128;},
      // cfg.hiss: a hiss (bins 40-80) instead of a low voiced sound.
      getByteFrequencyData(a){a.fill(0);if(h.voice)for(let i=cfg.hiss?40:1;i<=(cfg.hiss?80:10);i++)a[i]=220;},
      getFloatTimeDomainData(a){a.fill(0);},getFloatFrequencyData(a){a.fill(-120);}};}
  };
  Object.defineProperty(AC.prototype,'currentTime',{get:()=>performance.now()/1000});
  window.AudioContext=window.webkitAudioContext=AC;
  HTMLMediaElement.prototype.play=function(){const a=this,rec={kind:'voice',url:a.src,at:performance.now(),web:h.web,native:h.native};h.sounds.push(rec);a.__timer=setTimeout(()=>{if(a.onended)a.onended();},20);return Promise.resolve();};
  HTMLMediaElement.prototype.pause=function(){clearTimeout(this.__timer);};
  let sona;
  Object.defineProperty(window,'Sona',{configurable:true,get:()=>sona,set(value){
    sona=value;value.confetti=()=>{};
    value.speechAvailable=()=>Promise.resolve(true);
    value.speechStart=()=>{h.starts++;h.native=1;return Promise.resolve(true);};
    value.speechStop=()=>{h.stops++;h.native=0;if(!h.stopAt)h.stopAt=performance.now();return Promise.resolve({text:h.text,onDevice:true});};
    for(const k of ['logAttempt','bumpReps','recordSession','recordRung','rotAdvance','repsBeacon']) {const real=value[k];value[k]=function(){h.practice.push(k);return real?real.apply(this,arguments):undefined;};}
    for(const k of Object.keys(value.sfx||{}))if(k!=='stop'&&typeof value.sfx[k]==='function')value.sfx[k]=()=>h.audio('sfx:'+k);
  }});
  localStorage.setItem('sona.freeera.v1','post');for(const k of ['sona.freeera2.v1','sona.freeera3.v1','sona.freeera4.v1'])localStorage.setItem(k,'done');
  localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Mia',childAge:'7',focusSounds:['R'],onboarded:true,earlyAdopter:true,voiceOn:cfg.voiceOn===true,soundOn:true,volume:.6}));
  localStorage.setItem('sona.micok','1');sessionStorage.setItem('sona.play.token','arcade-slice.html');sessionStorage.setItem('sona.boost.sound','R');
}
async function fresh(cfg={}) {
  const context=await browser.newContext({viewport:{width:cfg.width||393,height:cfg.width===320?568:852},reducedMotion:'reduce'});
  let tts=0;
  await context.route('**/*',r=>{if(cfg.voiceOn&&r.request().url()===BASE+'/api/tts'){tts++;if(cfg.ttsFailFirst&&tts===1)return r.fulfill({status:503,body:'{}'});return r.fulfill({status:200,contentType:'audio/pcm',body:Buffer.alloc(2400)});}return r.request().url().startsWith(BASE+'/')?r.continue():r.abort();});
  await context.addInitScript(phone,cfg);
  const page=await context.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'/arcade-slice.html?from=charge');
  await page.waitForFunction(()=>window.gameEntryAllowed===true&&typeof draw==='function');
  // When the third star lights, for the recognizer's tail check.
  await page.evaluate(()=>{new MutationObserver(()=>{if(!__ss.thirdAt&&document.querySelectorAll('#slowReps i.on').length>=3)__ss.thirdAt=performance.now();}).observe(document.getElementById('slowReps'),{subtree:true,attributes:true});});
  return{context,page,errors};
}
// One fruit, well away from the edges, and no toss for a while: the board is
// then something a test can watch hold still or move.
async function quietBoard(page){await page.evaluate(()=>{fruits=[{e:'🍎',x:60,y:H*.45,vx:1.5,vy:-0.5,g:.0005,rot:0,vr:.01,r:26,sliced:false}];nextToss=waveMs+60000;});}
// turn() waits for the room level so tries start on a quiet floor; eager()
// starts talking the moment the mic opens, as a child copying Echo does.
async function turn(page){await page.locator('#slowKeys').click();await page.waitForFunction(()=>__ss.web===1&&__ss.native===1&&rv.floor>=0);await page.waitForTimeout(100);}
async function eager(page){await page.locator('#slowKeys').click();await page.waitForFunction(()=>__ss.web===1&&__ss.native===1);}
const lit=(page)=>page.evaluate(()=>document.querySelectorAll('#slowReps i.on').length);
// n tries of on ms, off ms apart; tail is the wait after the last (default off).
async function say(page,n,{on=380,off=320,tail=off}={}){for(let i=0;i<n;i++){await page.evaluate(()=>{__ss.voice=true;});await page.waitForTimeout(on);await page.evaluate(()=>{__ss.voice=false;});await page.waitForTimeout(i<n-1?off:tail);}}
async function earned(page){await page.waitForFunction(()=>!slowTurn&&slowMs>0);return page.evaluate(()=>({ms:slowMs,total:slowTotal,status:document.getElementById('slowStatus').textContent}));}
async function clean(label,page,errors){
  const h=await page.evaluate(()=>({web:__ss.web,native:__ss.native,bad:__ss.sounds.filter(s=>s.web||s.native),practice:__ss.practice}));
  ok(label+': both microphones are closed',h.web===0&&h.native===0,h);
  ok(label+': no sound played with a microphone live',h.bad.length===0,h.bad);
  ok(label+': nothing is written as practice',h.practice.length===0,h.practice);
  ok(label+': no runtime errors',errors.length===0,errors);
}

try {
  await scenario('three tries',async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);
      await turn(page);
      const s0=await page.evaluate(()=>({stars:!document.getElementById('slowReps').hidden,lit:document.querySelectorAll('#slowReps i.on').length,dim:document.body.classList.contains('speech-help-active')}));
      ok('a tap on Echo shows three empty stars and dims the held board',s0.stars&&s0.lit===0&&s0.dim,s0);
      const held=await page.evaluate(()=>({x:fruits[0].x,y:fruits[0].y,clock:waveMs,got:waveGot}));
      await say(page,1);
      const s1=await page.evaluate(()=>({lit:document.querySelectorAll('#slowReps i.on').length,status:document.getElementById('slowStatus').textContent,ms:slowMs,turn:!!slowTurn,x:fruits[0].x,y:fruits[0].y,clock:waveMs,got:waveGot}));
      ok('the first try lights one star and asks for another, still listening',s1.lit===1&&s1.status==='Great! Again!'&&s1.ms===0&&s1.turn,s1);
      ok('the fruit, the wave clock and the progress hold still while Echo listens',s1.x===held.x&&s1.y===held.y&&s1.clock===held.clock&&s1.got===held.got,{held,s1});
      const before=await page.evaluate(()=>fruits.length);
      await say(page,2);
      const e=await earned(page);
      ok('three tries earn twelve seconds of Super Slice',e.ms>11000&&e.ms<=12000&&e.total===12000&&e.status==='SUPER SLICE!',e);
      const s2=await page.evaluate(()=>({banner:document.getElementById('bnBig').textContent,small:document.getElementById('bnSmall').textContent,glow:document.body.classList.contains('speech-help-earned'),dim:document.body.classList.contains('speech-help-active'),fruits:fruits.length,gold:fruits.filter(f=>f.gold).length,next:nextToss-waveMs,every:WAVES[wave].every,stars:document.getElementById('slowReps').hidden}));
      ok('Super Slice says so on screen, and the edge glows gold',s2.banner==='SUPER SLICE!'&&/Three tries/.test(s2.small)&&s2.glow&&!s2.dim&&s2.stars,s2);
      ok('the stand throws a burst of five, one of them golden',s2.fruits-before>=5&&s2.gold>=1,{before,s2});
      ok('the next toss comes sooner while it lasts',s2.next<=s2.every*0.46,s2);
      const chime=await page.evaluate(()=>__ss.sounds.filter(s=>s.kind==='sfx:reward').length);
      ok('a reward chime plays once the microphone has closed',chime===1,chime);
      const tail=await page.evaluate(()=>__ss.stopAt-__ss.thirdAt);
      ok('Apple\'s recognizer keeps listening about half a second after the third try',tail>=540&&tail<1500,tail);
      // Every toss during Super Slice is two or three fruit, even after misses.
      const counts=await page.evaluate(()=>{var out=[];for(var k=0;k<100;k++){missRun=k%2?5:0;fruits=[];toss();out.push(fruits.length);}missRun=0;return out;});
      ok('while it lasts, every toss is two or three fruit, missed fruit or not',counts.every(n=>n===2||n===3)&&counts.includes(2)&&counts.includes(3),counts.filter(n=>n<2||n>3));
      await page.evaluate(()=>{fruits=[];nextToss=waveMs+1;});
      await page.waitForFunction(()=>fruits.length>0);
      const gap=await page.evaluate(()=>({next:nextToss-waveMs,every:WAVES[wave].every}));
      ok('the game keeps tossing sooner, not just the first toss',gap.next<=gap.every*0.46&&gap.next>0,gap);
      // The blade: a swipe that passes 25px outside a fruit's edge slices it
      // during Super Slice, and misses it without.
      async function nearSwipe(){
        await page.evaluate(()=>{fruits=[{e:'🍊',x:W/2,y:H*.5,vx:0,vy:0,g:0,rot:0,vr:0,r:30,sliced:false}];});
        const box=await page.locator('#cv').boundingBox(),y=box.y+box.height*.5-30-25-8;
        await page.mouse.move(box.x+box.width*.2,y);await page.mouse.down();await page.mouse.move(box.x+box.width*.8,y,{steps:6});await page.mouse.up();
        return page.evaluate(()=>fruits.length===0||fruits[0].sliced);
      }
      ok('Super Slice widens the blade: a near miss slices',await nearSwipe());
      await page.evaluate(()=>{slowMs=0;});
      ok('…and the normal blade misses the same swipe',!(await nearSwipe()));
      await clean('three tries',page,errors);
    }finally{await context.close();}
  });

  for(const [n,ms] of [[1,8000],[2,10000]])await scenario(n+' tr'+(n===1?'y':'ies'),async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);await turn(page);await say(page,n,{tail:0});
      const t0=Date.now();const e=await earned(page);const wait=Date.now()-t0;
      ok(n+' tr'+(n===1?'y':'ies')+' then a pause earn '+ms/1000+' seconds',e.ms>ms-1000&&e.ms<=ms&&e.total===ms,e);
      ok('the turn ends about 1.5 seconds after the child stops',wait>=1300&&wait<2300,wait);
      await clean(n+' tries',page,errors);
    }finally{await context.close();}
  });

  await scenario('one long sound',async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);await turn(page);
      await say(page,1,{on:1600,off:200});
      const lit=await page.evaluate(()=>document.querySelectorAll('#slowReps i.on').length);
      ok('one long "rrrrrr" is one try, not three',lit===1,lit);
      const e=await earned(page);
      ok('…and earns one try\'s eight seconds',e.total===8000,e);
      await clean('long sound',page,errors);
    }finally{await context.close();}
  });

  await scenario('a wobbly long sound, and a real gap',async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);await turn(page);
      await page.evaluate(()=>{__ss.dips=true;});await say(page,1,{on:1200,off:0});
      ok('a long sound with little dips in it is still one try',(await lit(page))===1,await lit(page));
      await page.waitForTimeout(250);await page.evaluate(()=>{__ss.dips=false;});
      await say(page,1,{on:380,off:0});
      ok('a second sound after a real gap is a second try',(await lit(page))===2,await lit(page));
      const e=await earned(page);
      ok('…and two tries earn ten seconds',e.total===10000,e);
      await clean('wobbly sound',page,errors);
    }finally{await context.close();}
  });

  await scenario('an eager child',async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);await eager(page);
      await say(page,1,{on:900,off:0});
      const e=await earned(page);
      ok('a try said the moment the mic opens still counts once the room is measured',e.total===8000,e);
      await clean('eager child',page,errors);
    }finally{await context.close();}
  });

  await scenario('an eager child, three tries',async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);await eager(page);
      await say(page,1,{on:1600,off:320});await say(page,2);
      const e=await earned(page);
      ok('a long first try from the moment the mic opens, then two more: three stars, twelve seconds',e.total===12000,e);
      await clean('eager three',page,errors);
    }finally{await context.close();}
  });

  await scenario('a hiss for an R',async()=>{
    const{context,page,errors}=await fresh({hiss:true});try{
      await quietBoard(page);await turn(page);
      let most=0;for(let i=0;i<3;i++){await say(page,1);most=Math.max(most,await lit(page));}
      await page.waitForFunction(()=>!slowTurn,null,{timeout:9000});
      ok('an R child\'s hiss lights no star and earns nothing',most===0&&await page.evaluate(()=>slowMs===0&&playing),most);
      await clean('hiss',page,errors);
    }finally{await context.close();}
  });

  await scenario('slow tries',async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);await turn(page);await say(page,3,{off:1000});
      const e=await earned(page);
      ok('a child who takes a second between tries still gets all three',e.total===12000,e);
      await clean('slow tries',page,errors);
    }finally{await context.close();}
  });

  await scenario('a sound held to the limit',async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);await turn(page);
      await page.evaluate(()=>{__ss.voice=true;});
      await page.waitForFunction(()=>!slowTurn,null,{timeout:9000});await page.evaluate(()=>{__ss.voice=false;});
      const e=await earned(page);
      ok('a try that runs to the 6.5 second limit still earns its eight seconds',e.total===8000&&e.status==='SUPER SLICE!',e);
      await clean('held sound',page,errors);
    }finally{await context.close();}
  });

  await scenario('silence',async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);await turn(page);
      await page.waitForFunction(()=>!slowTurn,null,{timeout:9000});
      const s=await page.evaluate(()=>({ms:slowMs,playing,status:document.getElementById('slowStatus').textContent}));
      ok('saying nothing earns nothing, and play carries on',s.ms===0&&s.playing&&s.status==='Tap Echo to try again',s);
      await clean('silence',page,errors);
    }finally{await context.close();}
  });

  await scenario('keep playing',async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);await turn(page);await say(page,2,{off:250});
      ok('two stars are lit before "Keep playing"',(await lit(page))===2,await lit(page));
      await page.locator('#slowCancel').click();await page.waitForFunction(()=>!slowTurn);
      ok('"Keep playing" mid-turn leaves with no Super Slice, even after two tries',await page.evaluate(()=>slowMs===0&&playing));
      await clean('keep playing',page,errors);
    }finally{await context.close();}
  });

  await scenario('wrong word',async()=>{
    const{context,page,errors}=await fresh({text:'taco taco taco'});try{
      await quietBoard(page);await turn(page);await say(page,3);
      await page.waitForFunction(()=>!slowTurn&&__ss.stops>0);
      ok('on the iPhone, "taco" three times earns no Super Slice for an R child',await page.evaluate(()=>slowMs===0&&playing));
      await clean('wrong word',page,errors);
    }finally{await context.close();}
  });

  await scenario('Echo\'s instruction',async()=>{
    const{context,page,errors}=await fresh({voiceOn:true});try{
      await quietBoard(page);await turn(page);
      const first=await page.evaluate(()=>__ss.sounds.filter(s=>s.kind==='voice').map(s=>s.url));
      ok('the first turn: Echo says the instruction, then the recorded R',first.length===2&&/^blob:/.test(first[0])&&/\/coach\/say-echo\/R-demo\.mp3$/.test(first[1]),first);
      await page.locator('#slowCancel').click();await page.waitForFunction(()=>!slowTurn);await page.waitForTimeout(300);
      await turn(page);
      const second=await page.evaluate(()=>__ss.sounds.filter(s=>s.kind==='voice').map(s=>s.url).slice(2));
      ok('the next turn is quicker: only the recorded R',second.length===1&&/\/coach\/say-echo\/R-demo\.mp3$/.test(second[0]),second);
      await page.locator('#slowCancel').click();await page.waitForFunction(()=>!slowTurn);
      await clean('instruction',page,errors);
    }finally{await context.close();}
  });

  await scenario('Echo\'s instruction, when it could not load',async()=>{
    const{context,page,errors}=await fresh({voiceOn:true,ttsFailFirst:true});try{
      await quietBoard(page);await turn(page);
      await page.locator('#slowCancel').click();await page.waitForFunction(()=>!slowTurn);await page.waitForTimeout(300);
      await turn(page);
      const voices=await page.evaluate(()=>__ss.sounds.filter(s=>s.kind==='voice').map(s=>s.url));
      ok('an instruction that failed to load is tried again on the next turn',voices.length===3&&/^blob:/.test(voices[1])&&/R-demo\.mp3$/.test(voices[2]),voices);
      await page.locator('#slowCancel').click();await page.waitForFunction(()=>!slowTurn);
      await clean('instruction retry',page,errors);
    }finally{await context.close();}
  });

  await scenario('the end of a wave',async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);await turn(page);await say(page,3);await earned(page);
      await page.waitForTimeout(1000);
      await page.evaluate(()=>{waveGot=WAVES[wave].goal;});
      await page.waitForFunction(()=>phase==='break');
      const a=await page.evaluate(()=>({ms:slowMs,glow:document.body.classList.contains('speech-help-earned'),shown:!document.getElementById('slowControl').hidden}));
      ok('when the burst finishes a wave, Super Slice pauses for the break: no glow, no button',a.ms>9000&&!a.glow&&!a.shown,a);
      await page.waitForFunction(()=>document.getElementById('revOvl').classList.contains('show'));
      await page.waitForTimeout(1200);
      const b=await page.evaluate(()=>slowMs);
      ok('…and none of its time is spent while the say-it card is up',Math.abs(b-a.ms)<5,{a,b});
      await page.evaluate(()=>{closeReviveMic();doRevive();});
      await page.waitForFunction(()=>phase==='wave'&&wave===1);
      const c=await page.evaluate(()=>({ms:slowMs,status:document.getElementById('slowStatus').textContent,glow:document.body.classList.contains('speech-help-earned')}));
      ok('the next wave starts in Super Slice with the time that was left',c.ms>8000&&c.status==='SUPER SLICE!'&&c.glow,c);
      await page.evaluate(()=>{wave=2;waveGot=WAVES[2].goal;});
      await page.waitForFunction(()=>phase==='finale',null,{timeout:6000});
      ok('the giant watermelon ends it',await page.evaluate(()=>slowMs===0&&!document.body.classList.contains('speech-help-earned')));
      await clean('wave end',page,errors);
    }finally{await context.close();}
  });

  for(const width of [320,393])await scenario('phone '+width,async()=>{
    const{context,page,errors}=await fresh({width});try{
      await quietBoard(page);await turn(page);await say(page,1);
      const fit=await page.evaluate(()=>{const r=document.getElementById('slowControl').getBoundingClientRect(),t=document.getElementById('top').getBoundingClientRect(),c=document.getElementById('slowCancel').getBoundingClientRect(),st=document.getElementById('slowReps').getBoundingClientRect();return{l:r.left,r:r.right,t:r.top,b:r.bottom,w:innerWidth,h:innerHeight,hud:t.bottom,cancel:c.height,stars:st.width};});
      ok(width+'px: the stars and "Keep playing" fit under the HUD, on screen',fit.l>=0&&fit.r<=fit.w&&fit.t>=fit.hud&&fit.b<=fit.h&&fit.cancel>=36&&fit.stars>=100,fit);
      await page.screenshot({path:OUT+'/superslice-listening-'+width+'.png'});
      const e=await earned(page);await page.waitForTimeout(250);
      await page.screenshot({path:OUT+'/superslice-on-'+width+'.png'});
      ok(width+'px: no runtime errors',errors.length===0&&e.total===8000,{errors,e});
    }finally{await context.close();}
  });

  // The other games keep their one-try, eight-second help untouched.
  const HELP=readFileSync(ROOT+'/arcade-speech-help.js','utf8');
  ok('the shared helper keeps eight seconds for pages that ask for nothing more',/SLOW_HELP\.msFor\?SLOW_HELP\.msFor\(n\):8000/.test(HELP));
  for(const g of ['stack','run','glide']){
    const src=readFileSync(ROOT+'/arcade-'+g+'.html','utf8');
    ok(g+': still one try for eight seconds (no reps or msFor set)',/window\.SLOW_HELP=\{/.test(src)&&!/SLOW_HELP=\{[^}]*\breps:/.test(src)&&!/SLOW_HELP=\{[^}]*msFor/.test(src));
  }
  const SLICE=readFileSync(ROOT+'/arcade-slice.html','utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'').replace(/(^|[^:"'\\])\/\/[^\n]*/g,'$1');
  ok('Fruit Slice still asks for the mic in one place only',(SLICE.match(/getUserMedia\(/g)||[]).length===1);
  ok('none of the retired power names come back',!/boostChip|fireBoost|paintChip|STAR MODE|FRUIT FRENZY|GOLDEN KEYS|SLOW-MO|SUPER FLOAT|boost\.on/.test(SLICE));
}finally{await browser.close();await new Promise(r=>server.close(r));}
console.log(failures?failures+' FAILURES / '+assertions+' assertions':'ALL GREEN — '+assertions+' assertions');
process.exit(failures?1:0);
