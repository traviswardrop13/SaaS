// SUPERSLICE1: say your sound during Fruit Slice for Super Slice (Travis, 29
// Sep 2026: "give them an option to say the sound to slow the game down ...
// they go into some frenzy mode or easy mode or beast mode when they say
// their target sounds", then "1 time to get it slow mode is fine ... and
// yeah count as reps ... no wow should not count"). Tap Echo, the board holds,
// one heard sound (quick or held) earns ten seconds of slow fruit, a burst
// from the stand, more fruit per toss and a wide rainbow blade, and adds one
// rep to the week's count without touching practice data.
//
// BEAT YOUR BEST (1-2 Oct 2026) made the sound the best way to a longer row
// of fruit (slicetest has the row itself), with two rules: every fruit thrown
// while Super Slice lasts is an EXTRA (slicing it adds to the row, never to
// the wave, so the power no longer ends the wave sooner), and nothing dropped
// while it lasts breaks the row or feeds the two-miss help. The burst, the
// blade, the ten seconds and the time carried into the next wave are as they
// were.
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
      h.webPending--;h.web++;h.openedAt=performance.now();
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
  localStorage.setItem('sona.freeera.v1','post');for(const k of ['sona.freeera2.v1','sona.freeera3.v1','sona.freeera4.v1','sona.freeera5.v1'])localStorage.setItem(k,'done');
  localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Mia',childAge:'7',focusSounds:['R'],onboarded:true,earlyAdopter:true,voiceOn:cfg.voiceOn===true,soundOn:true,volume:.6}));
  localStorage.setItem('sona.micok','1');sessionStorage.setItem('sona.play.token','arcade-slice.html');sessionStorage.setItem('sona.boost.sound','R');
}
async function fresh(cfg={}) {
  const context=await browser.newContext({viewport:{width:cfg.width||393,height:cfg.width===320?568:852},reducedMotion:'reduce'});
  let tts=0;
  // The say-it card's own two lines are asked for as the page loads (2 Oct
  // 2026, /arcade-sayit.js): they are answered, and never counted here, so
  // "the first ask" is still the sound power's instruction.
  const CARD_LINES=['To keep playing, say','Go!'];
  await context.route('**/*',r=>{if(cfg.voiceOn&&r.request().url()===BASE+'/api/tts'){let text='';try{text=JSON.parse(r.request().postData()).text;}catch(e){}if(!CARD_LINES.includes(text)){tts++;if(cfg.ttsFailFirst&&tts===1)return r.fulfill({status:503,body:'{}'});}return r.fulfill({status:200,contentType:'audio/pcm',body:Buffer.alloc(2400)});}return r.request().url().startsWith(BASE+'/')?r.continue():r.abort();});
  await context.addInitScript(phone,cfg);
  const page=await context.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'/arcade-slice.html?from=charge');
  await page.waitForFunction(()=>window.gameEntryAllowed===true&&typeof draw==='function');
  // When "Got it!" shows (the sound was heard), for the recognizer's tail check.
  await page.evaluate(()=>{const st=document.getElementById('slowStatus');new MutationObserver(()=>{if(!__ss.gotAt&&st.textContent==='Got it!')__ss.gotAt=performance.now();}).observe(st,{subtree:true,childList:true,characterData:true});});
  return{context,page,errors};
}
// One fruit, well away from the edges, and no toss for a while: the board is
// then something a test can watch hold still or move.
async function quietBoard(page){await page.evaluate(()=>{fruits=[{e:'🍎',x:60,y:H*.45,vx:1.5,vy:-0.5,g:.0005,rot:0,vr:.01,r:26,sliced:false}];nextToss=waveMs+60000;});}
// turn() waits for the room level so the try starts on a quiet floor; eager()
// starts talking the moment the mic opens, as a child copying Echo does.
async function turn(page){await page.locator('#slowKeys').click();await page.waitForFunction(()=>__ss.web===1&&__ss.native===1&&rv.floor>=0);await page.waitForTimeout(100);}
async function eager(page){await page.locator('#slowKeys').click();await page.waitForFunction(()=>__ss.web===1&&__ss.native===1);}
async function say(page,{on=380,tail=320}={}){await page.evaluate(()=>{__ss.voice=true;});await page.waitForTimeout(on);await page.evaluate(()=>{__ss.voice=false;});await page.waitForTimeout(tail);}
async function earned(page){await page.waitForFunction(()=>!slowTurn&&slowMs>0);return page.evaluate(()=>({ms:slowMs,total:slowTotal,status:document.getElementById('slowStatus').textContent}));}
const reps=(page)=>page.evaluate(()=>({week:Sona.weekReps(0),game:JSON.parse(localStorage.getItem('sona.gamereps.v1')||'{}'),outcomes:localStorage.getItem('sona.outcomes.v1')}));
async function clean(label,page,errors){
  const h=await page.evaluate(()=>({web:__ss.web,native:__ss.native,bad:__ss.sounds.filter(s=>s.web||s.native),practice:__ss.practice}));
  ok(label+': both microphones are closed',h.web===0&&h.native===0,h);
  ok(label+': no sound played with a microphone live',h.bad.length===0,h.bad);
  ok(label+': nothing is written as practice',h.practice.length===0,h.practice);
  ok(label+': no runtime errors',errors.length===0,errors);
}
async function nothing(page,label){
  const r=await reps(page);
  ok(label+': no rep is added',r.week===0&&Object.keys(r.game).length===0,r);
}

try {
  await scenario('one try',async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);
      const r0=await reps(page);
      await turn(page);
      const s0=await page.evaluate(()=>({dim:document.body.classList.contains('speech-help-active'),x:fruits[0].x,y:fruits[0].y,clock:waveMs,got:waveGot}));
      await page.waitForTimeout(300);
      const s1=await page.evaluate(()=>({x:fruits[0].x,y:fruits[0].y,clock:waveMs,got:waveGot,ms:slowMs}));
      ok('a tap on Echo dims the board, and it holds still while Echo listens',s0.dim&&s1.x===s0.x&&s1.y===s0.y&&s1.clock===s0.clock&&s1.got===s0.got&&s1.ms===0,{s0,s1});
      const before=await page.evaluate(()=>fruits.length);
      await page.evaluate(()=>{__ss.voice=true;});
      await page.waitForFunction(()=>document.getElementById('slowStatus').textContent==='Got it!');
      await page.evaluate(()=>{__ss.voice=false;});
      const e=await earned(page);
      ok('one heard sound earns ten seconds of Super Slice',e.ms>9000&&e.ms<=10000&&e.total===10000&&e.status==='SUPER SLICE!',e);
      const s2=await page.evaluate(()=>({banner:document.getElementById('bnBig').textContent,glow:document.body.classList.contains('speech-help-earned'),dim:document.body.classList.contains('speech-help-active'),fruits:fruits.length,gold:fruits.filter(f=>f.gold).length,next:nextToss-waveMs,every:WAVES[wave].every}));
      ok('Super Slice says so on screen, and the edge glows gold',s2.banner==='SUPER SLICE!'&&s2.glow&&!s2.dim,s2);
      ok('the stand throws a burst of five, one of them golden',s2.fruits-before>=5&&s2.gold>=1,{before,s2});
      ok('the next toss comes sooner',s2.next<=s2.every*0.46,s2);
      const chime=await page.evaluate(()=>__ss.sounds.filter(s=>s.kind==='sfx:reward').length);
      ok('a reward chime plays once the microphone has closed',chime===1,chime);
      const tail=await page.evaluate(()=>__ss.stopAt-__ss.gotAt);
      ok('Apple\'s recognizer keeps listening about half a second after the sound is heard',tail>=540&&tail<1500,tail);
      const r1=await reps(page);
      ok('the earned turn adds one rep to the week',r0.week===0&&r1.week===1&&(r1.game[Object.keys(r1.game)[0]]||{}).R===1,{r0,r1});
      ok('…and writes nothing to the practice records a clinician sees',r1.outcomes===r0.outcomes,{r0,r1});
      const counts=await page.evaluate(()=>{var out=[];for(var k=0;k<100;k++){missRun=k%2?5:0;fruits=[];toss();out.push(fruits.length);}missRun=0;return out;});
      ok('while it lasts, every toss is two or three fruit, missed fruit or not',counts.every(n=>n===2||n===3)&&counts.includes(2)&&counts.includes(3),counts.filter(n=>n<2||n>3));
      await page.evaluate(()=>{fruits=[];nextToss=waveMs+1;});
      await page.waitForFunction(()=>fruits.length>0);
      const gap=await page.evaluate(()=>({next:nextToss-waveMs,every:WAVES[wave].every}));
      ok('the game keeps tossing sooner, not just the first toss',gap.next<=gap.every*0.46&&gap.next>0,gap);
      async function nearSwipe(){
        await page.evaluate(()=>{fruits=[{e:'🍊',x:W/2,y:H*.5,vx:0,vy:0,g:0,rot:0,vr:0,r:30,sliced:false}];});
        const box=await page.locator('#cv').boundingBox(),y=box.y+box.height*.5-30-25-8;
        await page.mouse.move(box.x+box.width*.2,y);await page.mouse.down();await page.mouse.move(box.x+box.width*.8,y,{steps:6});await page.mouse.up();
        return page.evaluate(()=>fruits.length===0||fruits[0].sliced);
      }
      ok('Super Slice widens the blade: a near miss slices',await nearSwipe());
      await page.evaluate(()=>{slowMs=0;});
      ok('…and the normal blade misses the same swipe',!(await nearSwipe()));
      await clean('one try',page,errors);
    }finally{await context.close();}
  });

  // ── the earned power's fruit are extras, and its drops are free ──
  await scenario('extras',async()=>{
    const{context,page,errors}=await fresh();try{
      // one still fruit in the middle of the sky, and a swipe through it (or through whatever is parked there)
      async function swipeMid(add){
        if(add)await page.evaluate(()=>{fruits.push({e:'🍊',x:W/2,y:H*.5,vx:0,vy:0,g:1e-9,rot:0,vr:0,r:30,sliced:false});});
        const box=await page.locator('#cv').boundingBox(),y=box.y+box.height*.5;
        await page.mouse.move(box.x+box.width*.2,y-10);await page.mouse.down();await page.mouse.move(box.x+box.width*.8,y+10,{steps:6});await page.mouse.up();
      }
      const row=()=>page.evaluate(()=>({on:rowN,best:rowBest,pill:document.getElementById('score').textContent,got:waveGot,miss:missRun,phase,ms:slowMs}));
      await page.evaluate(()=>{fruits=[];nextToss=waveMs+60000;});
      await swipeMid(true);await swipeMid(true);
      const r0=await row();
      ok('before the power: two ordinary fruit are two on the row and two toward the wave',r0.on===2&&r0.best===2&&r0.pill==='2'&&r0.got===2,r0);
      await page.evaluate(()=>{fruits=[];});
      await turn(page);await say(page);await earned(page);
      const burst=await page.evaluate(()=>{fruits.forEach(f=>{f.__b=1;});return fruits.map(f=>!!f.extra);});
      ok('the burst of five is all extras',burst.length===5&&burst.every(Boolean),burst);
      // two of the burst are sliced; the other three are left to fall
      await page.evaluate(()=>{fruits.slice(0,2).forEach(f=>{f.x=W/2;f.y=H*.5;f.vx=0;f.vy=0;f.g=1e-9;f.gold=false;});});
      await swipeMid(false);
      await page.waitForFunction(()=>!fruits.some(f=>f.sliced));
      // (the wide blade may catch a third on its way up: count what it took)
      const cut=5-await page.evaluate(()=>fruits.filter(f=>f.__b).length);
      const r1=await row();
      ok('slicing some of them makes the row longer, and adds nothing to the wave',cut>=2&&cut<5&&r1.on===2+cut&&r1.best===r1.on&&r1.pill===String(r1.on)&&r1.got===2&&r1.phase==='wave',{cut,r1});
      // an ordinary fruit, thrown before the power, landing while it lasts
      await page.evaluate(()=>{fruits.push({e:'🍎',x:W*.3,y:H+200,vx:0,vy:5,g:1e-9,rot:0,vr:0,r:30,sliced:false,__o:1});});
      await page.waitForFunction(()=>!fruits.some(f=>f.__o));
      // …and the rest of the burst, and every toss after it, hit the ground
      await page.waitForFunction(()=>!fruits.some(f=>f.__b),null,{timeout:9500});
      const r2=await row();
      ok('the fruit that fell during Super Slice broke nothing: the row stands, and the two-miss help is not fed',r2.on===r1.on&&r2.best===r1.on&&r2.miss===0&&r2.got===2&&r2.phase==='wave',{r1,r2});
      ok('…and the top-left number never went down',r2.pill===r1.pill,r2);
      // the power over: fruit count toward the wave again, and a drop ends the row
      await page.evaluate(()=>{slowMs=0;fruits=[];nextToss=waveMs+60000;});
      await swipeMid(true);
      const r3=await row();
      ok('once it is over, an ordinary fruit counts toward the wave again',r3.got===3&&r3.on===r2.on+1,r3);
      await page.evaluate(()=>{fruits.push({e:'🍎',x:W*.3,y:H+200,vx:0,vy:5,g:1e-9,rot:0,vr:0,r:30,sliced:false});});
      await page.waitForFunction(()=>fruits.length===0);
      const r4=await row();
      ok('…and an ordinary drop ends the row, the number staying where it was',r4.on===0&&r4.miss===1&&r4.best===r3.best&&r4.pill===String(r3.best),r4);
      await clean('extras',page,errors);
    }finally{await context.close();}
  });

  await scenario('a held sound',async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);await turn(page);
      await page.evaluate(()=>{__ss.voice=true;});
      const e=await earned(page);await page.evaluate(()=>{__ss.voice=false;});
      ok('a long, held "rrrrrr" earns it too, without waiting for the child to stop',e.total===10000,e);
      ok('…and is one rep, not several',(await reps(page)).week===1);
      await clean('held sound',page,errors);
    }finally{await context.close();}
  });

  await scenario('an eager child',async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);await eager(page);
      await say(page,{on:900,tail:0});
      const e=await earned(page);
      ok('a sound said the moment the mic opens still counts once the room is measured',e.total===10000,e);
      await clean('eager child',page,errors);
    }finally{await context.close();}
  });

  await scenario('a sound just before the limit',async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);await turn(page);
      await page.waitForFunction(()=>performance.now()-__ss.openedAt>=5950,null,{timeout:9000});
      await page.evaluate(()=>{__ss.voice=true;});
      await page.waitForFunction(()=>document.getElementById('slowStatus').textContent==='Got it!');
      const e=await earned(page);await page.evaluate(()=>{__ss.voice=false;});
      ok('"Got it!" in the last moment before the limit is kept: Super Slice, not "try again"',e.total===10000&&e.status==='SUPER SLICE!',e);
      await clean('late sound',page,errors);
    }finally{await context.close();}
  });

  await scenario('a hiss for an R',async()=>{
    const{context,page,errors}=await fresh({hiss:true});try{
      await quietBoard(page);await turn(page);await say(page);await say(page);
      await page.waitForFunction(()=>!slowTurn,null,{timeout:9000});
      ok('an R child\'s hiss earns nothing',await page.evaluate(()=>slowMs===0&&playing));
      await nothing(page,'hiss');
      await clean('hiss',page,errors);
    }finally{await context.close();}
  });

  await scenario('silence',async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);await turn(page);
      await page.waitForFunction(()=>!slowTurn,null,{timeout:9000});
      const s=await page.evaluate(()=>({ms:slowMs,playing,status:document.getElementById('slowStatus').textContent}));
      ok('saying nothing earns nothing, and play carries on',s.ms===0&&s.playing&&s.status==='Tap Echo to try again',s);
      await nothing(page,'silence');
      await clean('silence',page,errors);
    }finally{await context.close();}
  });

  await scenario('keep playing',async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);await turn(page);
      await page.locator('#slowCancel').click();await page.waitForFunction(()=>!slowTurn);
      ok('"Keep playing" leaves with no Super Slice',await page.evaluate(()=>slowMs===0&&playing));
      await nothing(page,'keep playing');
      await clean('keep playing',page,errors);
    }finally{await context.close();}
  });

  for(const word of ['taco','wow','where'])await scenario('"'+word+'"',async()=>{
    const{context,page,errors}=await fresh({text:word});try{
      await quietBoard(page);await turn(page);await say(page);
      await page.waitForFunction(()=>!slowTurn&&__ss.stops>0);
      ok('on the iPhone, "'+word+'" earns no Super Slice for an R child',await page.evaluate(()=>slowMs===0&&playing));
      await nothing(page,word);
      await clean(word,page,errors);
    }finally{await context.close();}
  });

  await scenario('Echo\'s instruction',async()=>{
    const{context,page,errors}=await fresh({voiceOn:true});try{
      await quietBoard(page);await turn(page);
      const first=await page.evaluate(()=>__ss.sounds.filter(s=>s.kind==='voice').map(s=>s.url));
      ok('the first turn: Echo says the instruction, then one take of the recorded R',first.length===2&&/^blob:/.test(first[0])&&/\/coach\/say-echo\/R-sound\.wav$/.test(first[1]),first);
      await page.locator('#slowCancel').click();await page.waitForFunction(()=>!slowTurn);await page.waitForTimeout(300);
      await turn(page);
      const second=await page.evaluate(()=>__ss.sounds.filter(s=>s.kind==='voice').map(s=>s.url).slice(2));
      ok('the next turn is quicker: only the recorded R',second.length===1&&/\/coach\/say-echo\/R-sound\.wav$/.test(second[0]),second);
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
      ok('an instruction that failed to load is tried again on the next turn',voices.length===3&&/^blob:/.test(voices[1])&&/R-sound\.wav$/.test(voices[2]),voices);
      await page.locator('#slowCancel').click();await page.waitForFunction(()=>!slowTurn);
      await clean('instruction retry',page,errors);
    }finally{await context.close();}
  });

  await scenario('the end of a wave',async()=>{
    const{context,page,errors}=await fresh();try{
      await quietBoard(page);await turn(page);await say(page);await earned(page);
      await page.waitForTimeout(1000);
      await page.evaluate(()=>{waveGot=WAVES[wave].goal;});
      await page.waitForFunction(()=>phase==='break');
      const a=await page.evaluate(()=>({ms:slowMs,glow:document.body.classList.contains('speech-help-earned'),shown:!document.getElementById('slowControl').hidden}));
      ok('when a wave ends, Super Slice pauses for the break: no glow, no button',a.ms>7000&&!a.glow&&!a.shown,a);
      await page.waitForFunction(()=>document.getElementById('revOvl').classList.contains('show'));
      await page.waitForTimeout(1200);
      const b=await page.evaluate(()=>slowMs);
      ok('…and none of its time is spent while the say-it card is up',Math.abs(b-a.ms)<5,{a,b});
      const w0=(await reps(page)).week;
      await page.evaluate(()=>{closeReviveMic();doRevive();});
      await page.waitForFunction(()=>phase==='wave'&&wave===1);
      ok('the say-it card\'s heard sound is a rep too',(await reps(page)).week===w0+1,{w0});
      const c=await page.evaluate(()=>({ms:slowMs,status:document.getElementById('slowStatus').textContent,glow:document.body.classList.contains('speech-help-earned')}));
      ok('the next wave starts in Super Slice with the time that was left',c.ms>6000&&c.status==='SUPER SLICE!'&&c.glow,c);
      await page.evaluate(()=>{wave=2;waveGot=WAVES[2].goal;});
      await page.waitForFunction(()=>phase==='finale',null,{timeout:6000});
      ok('the giant watermelon ends it',await page.evaluate(()=>slowMs===0&&!document.body.classList.contains('speech-help-earned')));
      await clean('wave end',page,errors);
    }finally{await context.close();}
  });

  // 1 Oct 2026: the card between waves now asks a syllable for a child on R
  // ("start with isolation then ree rah roh then rot"). Echo's power button
  // does not climb with it: Travis asked for that button to be quick ("1 time
  // to get it"), and Apple's listener, which judges it, would turn away a
  // good "ree" it wrote down as "we" or "read".
  await scenario('the card asks a syllable; Super Slice stays the sound',async()=>{
    const{context,page,errors}=await fresh({voiceOn:true});try{
      await page.evaluate(()=>{waveGot=WAVES[wave].goal;});
      await page.waitForFunction(()=>document.getElementById('revOvl').classList.contains('show')&&/listening/i.test(document.getElementById('revListen').textContent),null,{timeout:12000});
      const a=await page.evaluate(()=>({title:document.getElementById('revTitle').textContent,rung:ASK.rung,say:SAYTXT,pill:document.getElementById('slowSound').textContent,label:document.getElementById('slowKeys').getAttribute('aria-label')}));
      ok('while the card asks a syllable, Echo\'s button still says the bare sound',/^Say “r(ee|ah|oh)” for wave 2!$/.test(a.title)&&a.rung===1&&a.say==='rrrr'&&a.pill==='rrrr'&&a.label==='Say rrrr to get Super Slice',a);
      const w0=(await reps(page)).week;
      await page.evaluate(()=>{closeReviveMic();doRevive();});
      await page.waitForFunction(()=>phase==='wave'&&wave===1);
      await page.waitForTimeout(400);await quietBoard(page);
      const n=await page.evaluate(()=>__ss.sounds.filter(s=>s.kind==='voice').length);
      await turn(page);
      const v=await page.evaluate((n)=>__ss.sounds.filter(s=>s.kind==='voice').map(s=>s.url).slice(n),n);
      ok('…and its turn after that card models the recorded R, never the syllable',v.length===2&&/^blob:/.test(v[0])&&/\/coach\/say-echo\/R-sound\.wav$/.test(v[1])&&await page.evaluate(()=>document.getElementById('slowSound').textContent==='rrrr'),v);
      await say(page);const e=await earned(page);
      ok('a heard syllable card and a Super Slice turn are one rep each',e.total===10000&&(await reps(page)).week===w0+2,{e,w0});
      await clean('syllable card',page,errors);
    }finally{await context.close();}
  });

  for(const width of [320,393])await scenario('phone '+width,async()=>{
    const{context,page,errors}=await fresh({width});try{
      await quietBoard(page);await turn(page);
      const fit=await page.evaluate(()=>{const r=document.getElementById('slowControl').getBoundingClientRect(),t=document.getElementById('top').getBoundingClientRect(),c=document.getElementById('slowCancel').getBoundingClientRect();return{l:r.left,r:r.right,t:r.top,b:r.bottom,w:innerWidth,h:innerHeight,hud:t.bottom,cancel:c.height};});
      ok(width+'px: Echo\'s turn and "Keep playing" fit under the HUD, on screen',fit.l>=0&&fit.r<=fit.w&&fit.t>=fit.hud&&fit.b<=fit.h&&fit.cancel>=36,fit);
      await page.screenshot({path:OUT+'/superslice-listening-'+width+'.png'});
      await say(page);const e=await earned(page);await page.waitForTimeout(250);
      await page.screenshot({path:OUT+'/superslice-on-'+width+'.png'});
      ok(width+'px: no runtime errors',errors.length===0&&e.total===10000,{errors,e});
    }finally{await context.close();}
  });

  // The other games keep their eight-second help, now with the one-take sound.
  const HELP=readFileSync(ROOT+'/arcade-speech-help.js','utf8');
  ok('the shared helper keeps eight seconds for pages that set no time',/SLOW_HELP\.ms\|\|8000/.test(HELP)&&/-sound\.wav/.test(HELP)&&!/-demo\.mp3/.test(HELP));
  ok('the shared helper counts every earned turn as a rep',/if\(accepted\)\{[^\n]*S\.gameRep\(SND\)/.test(HELP));
  for(const g of ['stack','run','glide']){
    const src=readFileSync(ROOT+'/arcade-'+g+'.html','utf8');
    ok(g+': still eight seconds (no ms set)',/window\.SLOW_HELP=\{/.test(src)&&!/SLOW_HELP=\{[^}]*\bms:/.test(src));
  }
  const SLICE=readFileSync(ROOT+'/arcade-slice.html','utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'').replace(/(^|[^:"'\\])\/\/[^\n]*/g,'$1');
  ok('Fruit Slice still asks for the mic in one place only',(SLICE.match(/getUserMedia\(/g)||[]).length===1);
  ok('none of the retired power names come back',!/boostChip|fireBoost|paintChip|STAR MODE|FRUIT FRENZY|GOLDEN KEYS|SLOW-MO|SUPER FLOAT|boost\.on/.test(SLICE));
  ok('nothing in Fruit Slice writes practice data',!/logAttempt|bumpReps|recordSession|recordRung|rotAdvance|repsBeacon/.test(SLICE));
}finally{await browser.close();await new Promise(r=>server.close(r));}
console.log(failures?failures+' FAILURES / '+assertions+' assertions':'ALL GREEN — '+assertions+' assertions');
process.exit(failures?1:0);
