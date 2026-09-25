// Simple play is child-paced. Fake device edges keep these tests fully silent
// while real page state, progress storage, and rewards run normally.
import { createServer } from 'http';
import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from './_env.mjs';

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT;
const BASE = 'http://127.0.0.1:8196';
const MIME = { html:'text/html', js:'text/javascript', css:'text/css', svg:'image/svg+xml', png:'image/png', webp:'image/webp', woff2:'font/woff2' };
// Bubble Pop and Peekaboo are parked in the shipped catalog. Keep exercising
// their retained engines by changing only their flags in this test server's
// source response; the app has no runtime flag that unlocks parked games.
function enableParkedEngineFixture(source) {
  return source.replace(/(\b(?:bubbles|peekaboo)\s*:\s*\{[^}]*\bcomingSoon\s*:\s*)true/g, '$1false');
}
const server = createServer((req,res) => {
  const url = new URL(req.url, BASE), file = path.join(ROOT,url.pathname);
  if(url.pathname.startsWith('/api/')) { res.writeHead(503,{'content-type':'application/json'}); res.end('{}'); return; }
  if(!existsSync(file)||!statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200,{'content-type':MIME[file.split('.').pop()]||'application/octet-stream'}); res.end(url.pathname==='/sona.js'?enableParkedEngineFixture(readFileSync(file,'utf8')):readFileSync(file));
});
await new Promise(resolve=>server.listen(8196,'127.0.0.1',resolve));
const browser = await chromium.launch(launchOpts());
let assertions=0, failures=0;
function ok(name,pass,detail='') { assertions++; if(!pass)failures++; console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' → '+JSON.stringify(detail))); }
async function scenario(name,fn) { try { await fn(); } catch(e) { ok(name+' has no harness/page exception',false,e.stack); } }
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function fakeDevice(config) {
  const h=window.__simpleTest={hidden:false, voice:false, permission:config.permission||'prompt', micMode:config.micMode||'auto', requests:[], streams:[], graphs:[], voicedSamples:0, silentSamples:0, contexts:[], speech:[], pendingSpeech:[], holdSpeech:!!config.holdSpeech, effects:[], cancels:0, sfx:[], sourceThrows:config.sourceThrows||0, sourceThrew:0};
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>h.hidden});
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>h.hidden?'hidden':'visible'});
  h.background=()=>{h.hidden=true;document.dispatchEvent(new Event('visibilitychange'));};
  h.foreground=()=>{h.hidden=false;document.dispatchEvent(new Event('visibilitychange'));};
  Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:()=>Promise.resolve({state:h.permission})}});
  navigator.mediaDevices.getUserMedia=()=>new Promise((resolve,reject)=>{
    const request={done:false,grant(){if(this.done)return;this.done=true;const track={readyState:'live',stop(){this.readyState='ended';}};const stream={track,getTracks:()=>[track],getAudioTracks:()=>[track]};h.streams.push(stream);resolve(stream);},deny(){if(this.done)return;this.done=true;reject(new DOMException('Denied','NotAllowedError'));}};
    h.requests.push(request); if(h.micMode==='auto')request.grant();else if(h.micMode==='deny')request.deny();
  });
  h.grantPending=()=>h.requests.filter(r=>!r.done).forEach(r=>r.grant());
  function param(){return {value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};}
  function node(){return {gain:param(),frequency:param(),connect(){},disconnect(){},start(){},stop(){}};}
  function AC(){this.state='running';this.currentTime=0;this.sampleRate=48000;this.destination={};h.contexts.push(this);}
  AC.prototype.resume=function(){this.state='running';return Promise.resolve();};
  AC.prototype.suspend=function(){this.state='suspended';return Promise.resolve();};
  AC.prototype.close=function(){this.state='closed';return Promise.resolve();};
  AC.prototype.createGain=node;AC.prototype.createOscillator=node;AC.prototype.createBufferSource=node;
  AC.prototype.createBuffer=function(c,n){return {duration:n/24000,getChannelData:()=>new Float32Array(n)};};
  // config.sourceThrows: the next N attempts to wire a granted mic into Web
  // Audio throw, as a real context can when it rejects a stream
  AC.prototype.createMediaStreamSource=function(stream){if(h.sourceThrows>0){h.sourceThrows--;h.sourceThrew++;throw new DOMException('Stream not supported','NotSupportedError');}const g={stream,connected:false,connect(an){this.connected=true;an.graph=this;},disconnect(){this.connected=false;}};h.graphs.push(g);return g;};
  AC.prototype.createAnalyser=function(){return {fftSize:512,frequencyBinCount:256,getByteTimeDomainData(data){const voiced=h.voice&&this.graph&&this.graph.connected&&this.graph.stream.track.readyState==='live';if(voiced)h.voicedSamples++;else h.silentSamples++;data.fill(voiced?160:128);},disconnect(){}};};
  window.AudioContext=window.webkitAudioContext=AC;
  HTMLMediaElement.prototype.play=function(){return Promise.resolve();};
  if(window.speechSynthesis){
    speechSynthesis.speak=u=>{h.speech.push(String(u.text));h.pendingSpeech.push(u);if(!h.holdSpeech)setTimeout(()=>{if(u.onend)u.onend();h.pendingSpeech=h.pendingSpeech.filter(x=>x!==u);},5);};
    speechSynthesis.cancel=()=>{h.cancels++;h.pendingSpeech=[];};
    speechSynthesis.getVoices=()=>[];
  }
  h.endSpeech=()=>{const pending=h.pendingSpeech.splice(0);pending.forEach(u=>{if(u.onend)u.onend();});};
  let sona;
  Object.defineProperty(window,'Sona',{configurable:true,get:()=>sona,set(value){
    sona=value;
    for(const key of ['rotAdvance','awardNextSticker','bumpReps','recordSession','logAttempt','recordRung','addCoins']){
      const original=value[key];value[key]=function(...args){h.effects.push(key);return original.apply(value,args);};
    }
    value.confetti=()=>{};
    // chimes stay silent but are logged by name (only reached with soundOn)
    Object.keys(value.sfx||{}).forEach(key=>{if(typeof value.sfx[key]==='function')value.sfx[key]=()=>{h.sfx.push(key);};});
  }});
  if(!localStorage.getItem('sona.test.simpleSeed')){
    localStorage.setItem('sona.test.simpleSeed','1');
    localStorage.setItem('sona.freeera.v1','post');localStorage.setItem('sona.freeera2.v1','done');localStorage.setItem('sona.freeera3.v1','done');localStorage.setItem('sona.freeera4.v1','done');
    localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Mia',childAge:'4',focusSounds:['M'],onboarded:true,earlyAdopter:true,voiceOn:config.voiceOn!==false,soundOn:!!config.soundOn,volume:config.voiceOn===false?0:0.6}));
    if(config.micok)localStorage.setItem('sona.micok','1');
  }
}
async function fresh(game,config={}) {
  const context=await browser.newContext({viewport:config.viewport||{width:390,height:844},reducedMotion:'reduce'});
  await context.route('**/*',route=>route.request().url().startsWith(BASE+'/')?route.continue():route.abort());
  await context.addInitScript(fakeDevice,config);
  const page=await context.newPage();page.setDefaultTimeout(4000);page.setDefaultNavigationTimeout(4000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'/arcade-'+game+'.html');
  return {context,page,errors};
}
async function phase(page,value){await page.locator('body[data-phase="'+value+'"]').waitFor();}
async function click(page,id){await page.locator(id).click();}
async function reveal(page,game,index=0){if(game==='bubbles')await click(page,'#revealButton');else {const doors=page.locator('[data-door]');await doors.nth(index%(await doors.count())).click();}await phase(page,'reveal');}
async function saved(page){return page.evaluate(()=>({progress:Sona.getProgress(),ring:Sona.todayRing(),reps:Sona.repsToday(),outcomes:Sona.outcomes(),stickers:Sona.stickersEarned(),run:sessionStorage.getItem('sona.run.v1')}));}
async function visibleState(page){return page.evaluate(()=>({phase:document.body.dataset.phase,word:document.getElementById('wordLabel').textContent,progress:document.getElementById('progressText').textContent}));}
async function resources(page){return page.evaluate(()=>({requests:__simpleTest.requests.length,live:__simpleTest.streams.filter(s=>s.track.readyState==='live').length,graphs:__simpleTest.graphs.filter(g=>g.connected).length,playing:__simpleTest.pendingSpeech.length,voicedSamples:__simpleTest.voicedSamples,silentSamples:__simpleTest.silentSamples,effects:__simpleTest.effects.slice()}));}
async function heard(page){return await page.locator('#heardMessage').isVisible()&&/heard you/i.test(await page.locator('#heardMessage').innerText());}
async function voice(page){await page.evaluate(()=>{__simpleTest.voice=true;});await page.waitForTimeout(220);await page.evaluate(()=>{__simpleTest.voice=false;});}
async function finishRemaining(page,game,turn=0){for(let i=turn;i<5;i++){if(await page.locator('body').getAttribute('data-phase')==='choose')await reveal(page,game,i%3);await click(page,'#nextTurn');}await page.locator('#finishPanel').waitFor();}
function clean(game,errors){ok(game+': no runtime errors',errors.length===0,errors);}

const pages=['bubbles','peekaboo'];
const present=pages.every(game=>existsSync(ROOT+'/arcade-'+game+'.html'))&&existsSync(ROOT+'/simple-play.js');
for(const game of pages)ok(game+': parked engine page is retained',existsSync(ROOT+'/arcade-'+game+'.html'));
ok('shared simple-play engine ships',existsSync(ROOT+'/simple-play.js'));

if(present)for(const game of pages){
  await scenario(game+' child-paced five-turn play',async()=>{
    const {context,page,errors}=await fresh(game);
    try{
      const before=await saved(page);
      ok(game+': opens at an explicit Start',await page.locator('#startPanel').isVisible()&&await page.locator('#startGame').isEnabled());
      ok(game+': loading requests no microphone or speech',(await resources(page)).requests===0&&await page.evaluate(()=>__simpleTest.speech.length===0));
      await page.locator('#startGame').focus();await page.keyboard.press('Enter');await phase(page,'choose');
      const first=await visibleState(page);await page.waitForTimeout(700);
      ok(game+': choosing waits for the child without a timer',same(first,await visibleState(page)));
      const choice=game==='bubbles'?page.locator('#revealButton'):page.locator('[data-door]').first();
      await choice.focus();await page.keyboard.press('Space');await phase(page,'reveal');
      const word=(await page.locator('#wordLabel').innerText()).trim();
      await page.waitForFunction(()=>__simpleTest.speech.length>0);
      ok(game+': reveal shows a picture and models the word alone',word.length>0&&await page.locator('#wordPicture').isVisible()&&await page.evaluate(word=>__simpleTest.speech.at(-1).toLowerCase()===word.toLowerCase(),word));
      ok(game+': reveal has its visible stage change',await page.locator('#playStage').evaluate(el=>el.classList.contains('revealed')));
      if(game==='peekaboo')ok('Peekaboo: the chosen door opens',await page.locator('[data-door].open').count()===1);
      const revealed=await visibleState(page);await page.waitForTimeout(700);
      ok(game+': silence never advances a revealed turn',same(revealed,await visibleState(page))&&!(await heard(page)));
      await click(page,'#hearWord');await page.waitForFunction(()=>__simpleTest.speech.length>=2);
      ok(game+': Hear word repeats only the displayed target',await page.evaluate(word=>__simpleTest.speech.at(-1).toLowerCase()===word.toLowerCase(),word));
      await finishRemaining(page,game);
      ok(game+': five deliberate Next taps finish the round',await page.locator('#finishTitle').isVisible()&&await page.locator('#playAgain').isEnabled());
      ok(game+': tap-only completion invents no speech work or rewards',same(before,await saved(page)),await resources(page));
      ok(game+': play does not ask for new microphone permission',(await resources(page)).requests===0);
      await click(page,'#playAgain');await phase(page,'choose');
      const replay=await visibleState(page);
      ok(game+': replay starts a fresh five-turn round',replay.phase==='choose'&&replay.progress===first.progress&&!(await page.locator('#finishPanel').isVisible()));
      await click(page,'#backLibrary');await page.waitForURL('**/today.html');
      ok(game+': library exit returns to game choices',new URL(page.url()).pathname==='/today.html');
      clean(game,errors);
    }finally{await context.close();}
  });

  await scenario(game+' optional voice and own-audio exclusion',async()=>{
    const {context,page,errors}=await fresh(game,{micok:true,permission:'granted',holdSpeech:true});
    try{
      await click(page,'#startGame');await phase(page,'choose');
      // 24 Sep 2026: this used to WAIT for the mic to connect on the choosing
      // screen — the mic opened at Start and stayed open under every word and
      // chime, which on an iPhone is phone-call audio for the whole game. The
      // rule is now the opposite: nothing listens until a picture is revealed
      // and Echo has finished its word.
      await page.waitForTimeout(300);
      const choosing=await resources(page);
      ok(game+': choosing a picture opens no microphone',choosing.requests===0&&choosing.live===0,choosing);
      await reveal(page,game);
      await page.waitForFunction(()=>__simpleTest.pendingSpeech.length>0);
      await voice(page);
      ok(game+': the model voice is never heard as the child',!(await heard(page)));
      const speakingNow=await resources(page);
      ok(game+': no microphone is open while Echo says the word',speakingNow.live===0,speakingNow);
      await page.evaluate(()=>{__simpleTest.holdSpeech=false;__simpleTest.endSpeech();});
      await page.waitForFunction(()=>__simpleTest.streams.some(s=>s.track.readyState==='live'));
      ok(game+': the mic opens for the child once the word has finished',(await resources(page)).live===1);
      await page.waitForTimeout(600);
      ok(game+': a silent revealed target earns no voice feedback',!(await heard(page)));
      await voice(page);await page.waitForFunction(()=>/heard you/i.test(document.getElementById('heardMessage').textContent)).catch(()=>{});
      const didHear=await heard(page);
      ok(game+': real voiced frames receive friendly feedback',didHear,await resources(page));
      if(!didHear)return;
      ok(game+': once heard, the mic closes for the rest of the turn',(await resources(page)).live===0);
      const feedback=await page.locator('#heardMessage').innerText();await voice(page);
      ok(game+': a second burst keeps the same one-turn feedback',(await page.locator('#heardMessage').innerText())===feedback);
      await finishRemaining(page,game);
      const r=await resources(page);
      ok(game+': the finish celebrates discoveries, not a speech count',/all five pictures/i.test(await page.locator('#finishCopy').innerText()));
      ok(game+': loudness-only feedback never advances practice or awards a practice sticker',!r.effects.includes('rotAdvance')&&!r.effects.includes('awardNextSticker'),r);
      ok(game+': voice feedback creates no assessment or fabricated rep count',!r.effects.some(x=>['bumpReps','recordSession','logAttempt','recordRung'].includes(x)),r.effects);
      ok(game+': finishing releases the microphone',r.live===0&&r.graphs===0,r);
      clean(game+' voice',errors);
    }finally{await context.close();}
  });

  await scenario(game+' interruptions keep the revealed turn',async()=>{
    const {context,page,errors}=await fresh(game,{micok:true,permission:'granted',holdSpeech:true});
    try{
      await click(page,'#startGame');await phase(page,'choose');await reveal(page,game);
      await page.waitForFunction(()=>__simpleTest.pendingSpeech.length>0);
      const before=await visibleState(page),earned=await saved(page);
      await page.evaluate(()=>__simpleTest.background());await page.locator('#pausePanel').waitFor();
      const paused=await resources(page);
      ok(game+': background releases microphone and model audio',paused.live===0&&paused.graphs===0&&paused.playing===0,paused);
      await page.locator('#nextTurn').evaluate(el=>el.click());
      ok(game+': queued hidden Next cannot earn anything',same(earned,await saved(page)));
      await page.evaluate(()=>__simpleTest.foreground());await page.waitForTimeout(80);
      ok(game+': returning waits for explicit Resume',await page.locator('#pausePanel').isVisible()&&(await resources(page)).live===0);
      await click(page,'#resumeGame');await phase(page,'reveal');
      ok(game+': Resume keeps the same picture and progress',same(before,await visibleState(page)));
      ok(game+': Resume does not repeat the interrupted word',await page.evaluate(()=>__simpleTest.pendingSpeech.length===0));
      await page.waitForFunction(()=>__simpleTest.streams.filter(s=>s.track.readyState==='live').length===1);
      await click(page,'#pauseGame');await page.locator('#pausePanel').waitFor();
      ok(game+': explicit Pause also releases the microphone',(await resources(page)).live===0);
      await click(page,'#resumeGame');await phase(page,'reveal');
      ok(game+': repeated pause still retains one turn',same(before,await visibleState(page))&&same(earned,await saved(page)));
      clean(game+' interruption',errors);
    }finally{await context.close();}
  });

  await scenario(game+' permission safety and mobile controls',async()=>{
    const {context,page,errors}=await fresh(game,{micok:true,permission:'prompt',viewport:{width:320,height:568}});
    try{
      await click(page,'#startGame');await phase(page,'choose');await reveal(page,game);
      ok(game+': a stale grant flag never prompts for microphone permission',(await resources(page)).requests===0);
      const overflow=await page.evaluate(()=>Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth);
      ok(game+': fits the narrow phone without horizontal overflow',overflow<=1,overflow);
      await page.locator('#nextTurn').scrollIntoViewIfNeeded();
      ok(game+': narrow-phone Next remains reachable',await page.locator('#nextTurn').evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.top>=0&&r.bottom<=innerHeight&&(hit===el||el.contains(hit));}));
      await click(page,'#pauseGame');await page.locator('#pausePanel').waitFor();
      await click(page,'#homeLink');await page.waitForURL('**/today.html');
      ok(game+': Home exits cleanly',new URL(page.url()).pathname==='/today.html');
      clean(game+' mobile',errors);
    }finally{await context.close();}
  });
}

if(present)await scenario('late microphone grant cannot survive a pause',async()=>{
  const {context,page,errors}=await fresh('bubbles',{micok:true,permission:'granted',micMode:'pending',voiceOn:false});
  try{
    // 24 Sep 2026: the request used to go out at Start. It now goes out only
    // for a revealed picture (with the voice off, straight after the reveal),
    // so the pause lands on a revealed turn and Resume comes back to it.
    await click(page,'#startGame');await phase(page,'choose');await page.waitForTimeout(200);
    ok('Start alone asks for no microphone',(await resources(page)).requests===0);
    await reveal(page,'bubbles');await page.waitForFunction(()=>__simpleTest.requests.length===1);
    await page.evaluate(()=>__simpleTest.background());await page.locator('#pausePanel').waitFor();
    await page.evaluate(()=>__simpleTest.grantPending());await page.waitForTimeout(60);
    ok('a late permission result is immediately released',(await resources(page)).live===0&&(await resources(page)).graphs===0);
    await page.evaluate(()=>{__simpleTest.micMode='deny';__simpleTest.foreground();});
    await click(page,'#resumeGame');await phase(page,'reveal');await page.waitForTimeout(60);
    await click(page,'#nextTurn');await phase(page,'choose');
    await reveal(page,'bubbles');await click(page,'#nextTurn');await phase(page,'choose');
    ok('a denied optional microphone leaves tap play working',(await resources(page)).live===0);
    clean('late/denied optional microphone',errors);
  }finally{await context.close();}
});

// The child who answers Echo at once is heard (24 Sep 2026). The first cut of
// the mic-quiet change averaged the first 250 ms of each turn's mic as the
// room, which is exactly when a child answers "Your turn. Say it together.":
// their voice became the room and "Echo heard you!" never came (review: at
// HEAD, with the mic open from Start, the same child was heard). The room's
// level is now the page's: a low percentile of the quietest stretch heard so
// far, which only ever goes down.
if(present)for(const game of pages){
  await scenario(game+' an eager child is heard',async()=>{
    const {context,page,errors}=await fresh(game,{micok:true,permission:'granted',holdSpeech:true});
    const heardSoon=ms=>page.waitForFunction(()=>/heard you/i.test(document.getElementById('heardMessage').textContent),null,{timeout:ms}).then(()=>true,()=>false);
    try{
      await click(page,'#startGame');await phase(page,'choose');await reveal(page,game);
      await page.waitForFunction(()=>__simpleTest.pendingSpeech.length>0);
      await page.evaluate(()=>{__simpleTest.holdSpeech=false;__simpleTest.endSpeech();});
      await page.waitForTimeout(100);
      await page.evaluate(()=>{__simpleTest.voice=true;});   // answering straight after Echo's word…
      await page.waitForFunction(()=>__simpleTest.streams.some(s=>s.track.readyState==='live'));
      await page.waitForTimeout(350);                        // …through the first stretch the mic hears
      await page.evaluate(()=>{__simpleTest.voice=false;});
      ok(game+': a child who answers right after Echo\'s word, talking through the first stretch the mic hears, still gets "Echo heard you!"',await heardSoon(1500),await resources(page));
      // the next picture: the page keeps its quiet level, so a child already
      // talking when the mic opens is heard at once
      await click(page,'#nextTurn');await phase(page,'choose');
      await page.evaluate(()=>{__simpleTest.voice=true;});
      await reveal(page,game);
      const second=await heardSoon(2500),stillTalking=await page.evaluate(()=>__simpleTest.voice);
      await page.evaluate(()=>{__simpleTest.voice=false;});
      ok(game+': on the next picture the page\'s quiet level holds: a child already talking as the mic opens is heard while still talking',second&&stillTalking,{second,stillTalking});
      clean(game+' eager',errors);
    }finally{await context.close();}
  });
}

// A mic that is granted but can't be wired into Web Audio leaves every later
// chime working (24 Sep 2026). The request used to be counted down twice —
// once on the grant and again in the catch when the wiring threw — leaving
// the in-flight count at -1, which the chimes read as "a request is still
// pending": every later chime waited for it forever.
if(present)await scenario('a mic that fails to connect leaves the chimes working',async()=>{
  const {context,page,errors}=await fresh('bubbles',{micok:true,permission:'granted',soundOn:true,sourceThrows:1});
  const taps=()=>page.evaluate(()=>__simpleTest.sfx.filter(n=>n==='tap').length);
  try{
    await click(page,'#startGame');await phase(page,'choose');await reveal(page,'bubbles');
    await page.waitForFunction(()=>__simpleTest.sourceThrew===1);
    ok('the granted mic really failed to connect, and was released',(await resources(page)).live===0);
    await page.waitForTimeout(100);
    await click(page,'#nextTurn');await phase(page,'choose');
    const before=await taps();
    await reveal(page,'bubbles');
    const chimed=await page.waitForFunction(b=>__simpleTest.sfx.filter(n=>n==='tap').length>b,before,{timeout:1500}).then(()=>true,()=>false);
    ok('after a mic that could not connect, the next picture still chimes',chimed,{before,after:await taps()});
    await click(page,'#nextTurn');await finishRemaining(page,'bubbles',2);
    const finished=await page.waitForFunction(()=>__simpleTest.sfx.includes('complete'),null,{timeout:1500}).then(()=>true,()=>false);
    ok('…and the round still ends on its finish chime',finished,await page.evaluate(()=>__simpleTest.sfx));
    clean('mic fails to connect',errors);
  }finally{await context.close();}
});

await browser.close();await new Promise(resolve=>server.close(resolve));
console.log(failures?failures+' FAILURES / '+assertions+' assertions':'ALL GREEN — '+assertions+' assertions');
process.exit(failures?1:0);
