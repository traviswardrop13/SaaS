// Book response flow: explicit words, narration before listening, no silent
// advancement, interruption cleanup, and real on-device microphone evidence.
// Pre-change run: SONATEST_PUBLIC_ROOT=<saved old public> node tests/bookflowtest.mjs
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {chromium,ROOT,launchOpts} from './_env.mjs';
const base=process.env.SONATEST_PUBLIC_ROOT||ROOT;
const mime={html:'text/html',js:'text/javascript',css:'text/css',jpg:'image/jpeg',svg:'image/svg+xml',woff2:'font/woff2'};
const server=createServer((req,res)=>{const u=new URL(req.url,'http://x');if(u.pathname.startsWith('/api/')){res.writeHead(503);res.end();return;}let file=path.join(base,u.pathname);if(!existsSync(file))file=path.join(ROOT,u.pathname);if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':mime[file.split('.').pop()]||'application/octet-stream'});res.end(readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(launchOpts(['--autoplay-policy=no-user-gesture-required']));
let checks=0,bad=0;function ok(label,value,detail=''){checks++;if(!value)bad++;console.log((value?'PASS ':'FAIL ')+label+(value?'':' '+JSON.stringify(detail)));}
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844}});const pg=await ctx.newPage();const errors=[];pg.on('pageerror',e=>errors.push(e.message));
 await pg.addInitScript(()=>{
  localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Mia',childAge:'7',focusSounds:['R','S','L','K','SH','CH','TH','G','F'],onboarded:true,volume:0}));
  const h=window.__bookHarness={lines:[],active:false,opens:0,cancels:0,saves:[],overlap:0};let value;
  Object.defineProperty(window,'Sona',{configurable:true,get(){return value;},set(s){value=s;h.hasCapture=typeof s.captureResponse==='function';h.realCapture=s.captureResponse;
   s.speakNow=t=>{if(!t)return Promise.resolve();if(h.active)h.overlap++;h.lines.push(t);return new Promise(r=>h.speechDone=r);};
   s.speakStop=()=>{if(h.speechDone){const r=h.speechDone;h.speechDone=null;r();}};
   s.speakUnlock=()=>{};s.sfx.tap=()=>{};s.sfx.star=()=>{};s.confetti=()=>{};
   s.captureResponse=opts=>{h.active=true;h.opens++;let resolve;const promise=new Promise(r=>resolve=r);const done=r=>{h.active=false;resolve(r);};h.respond=done;opts.onListening&&opts.onListening();return {promise,cancel(){h.cancels++;done({spoke:false,reason:'cancelled',blob:null});}};};
   s.saveRecording=r=>{h.saves.push({sound:r.sound,word:r.word,blob:!!r.blob});return Promise.resolve(true);};
  }});
 });
 await pg.goto(origin+'/library.html');const has=await pg.evaluate(()=>__bookHarness.hasCapture);ok('shared cancellable response capture exists',has);
 const targets=await pg.evaluate(()=>typeof BOOK_TARGETS!=='undefined'?BOOK_TARGETS:null);ok('all 13 books have six explicit target words',!!targets&&Object.keys(targets).length===13&&Object.values(targets).every(x=>x.length===6));
 if(has&&targets){
  ok('every prompted word occurs on its page',await pg.evaluate(()=>STORIES.every(st=>BOOK_TARGETS[bookSlug(st)].every((word,i)=>st.pages[i].t.toLowerCase().replace(/[^a-z']/g,' ').split(/\s+/).includes(word.toLowerCase())))));
  await pg.locator('.bookBtn').first().click();await pg.locator('#bkNext').click();
  ok('page narration begins before microphone opens',await pg.evaluate(()=>__bookHarness.lines.at(-1)==='Rory the rabbit rides a red rocket.'&&__bookHarness.opens===0));
  await pg.evaluate(()=>__bookHarness.speechDone());await pg.waitForTimeout(50);
  ok('the spoken prompt names the chosen page word',await pg.evaluate(()=>__bookHarness.lines.at(-1)==='Say Rory.'&&__bookHarness.opens===0));
  await pg.evaluate(()=>__bookHarness.speechDone());await pg.waitForTimeout(800);
  ok('microphone opens only after narration and prompt finish',await pg.evaluate(()=>__bookHarness.opens===1&&__bookHarness.active));
  await pg.evaluate(()=>document.getElementById('bkNext').onclick());
  ok('Next cannot bypass the child response',await pg.locator('#bkCount').innerText()==='1 / 6');
  await pg.evaluate(()=>__bookHarness.respond({spoke:false,reason:'timeout',blob:new Blob(['silent'])}));await pg.waitForTimeout(800);
  ok('a timeout and nonempty silent blob never advance or save',await pg.evaluate(()=>page===0&&__bookHarness.saves.length===0));
  await pg.locator('#bkMic').click();await pg.waitForTimeout(50);await pg.evaluate(()=>__bookHarness.speechDone());await pg.waitForTimeout(800);
  await pg.evaluate(()=>__bookHarness.respond({spoke:true,reason:'response',blob:new Blob(['local voice'])}));await pg.waitForTimeout(1000);
  ok('one voiced response advances exactly one page',await pg.locator('#bkCount').innerText()==='2 / 6');
  ok('a voiced recording uses the shared on-device save path',await pg.evaluate(()=>__bookHarness.saves.length===1&&__bookHarness.saves[0].word==='Rory'));
  ok('no narrator starts over an open microphone',await pg.evaluate(()=>__bookHarness.overlap===0));
  await pg.locator('#bkClose').click();const opens=await pg.evaluate(()=>__bookHarness.opens);await pg.waitForTimeout(900);
  ok('closing during narration prevents a late microphone start',await pg.evaluate(n=>!BOOK&&!__bookHarness.active&&__bookHarness.opens===n,opens));
  await pg.locator('.bookBtn').first().click();await pg.locator('#bkNext').click();await pg.evaluate(()=>__bookHarness.speechDone());await pg.waitForTimeout(30);await pg.evaluate(()=>__bookHarness.speechDone());await pg.waitForTimeout(800);
  await pg.locator('#bkHear').click();
  ok('replay cancels capture before speaking',await pg.evaluate(()=>!__bookHarness.active&&__bookHarness.cancels>0&&__bookHarness.overlap===0));
  await pg.locator('#bkClose').click();
  await pg.evaluate(()=>{Sona.speakNow=t=>{if(__bookHarness.active)__bookHarness.overlap++;__bookHarness.lines.push(t);return Promise.resolve();};});
  await pg.locator('.bookBtn').first().click();await pg.locator('#bkNext').click();
  for(let i=0;i<6;i++){
   await pg.waitForFunction(()=>__bookHarness.active);
   await pg.evaluate(()=>__bookHarness.respond({spoke:true,reason:'response',blob:new Blob(['local voice'])}));
   await pg.waitForFunction(n=>page===n,i+1);
  }
  ok('six responses finish the book and preserve its completion star',await pg.evaluate(()=>page===6&&document.getElementById('book').dataset.page==='end'&&!!document.querySelector('.bookBtn .doneStar')&&__bookHarness.overlap===0));
  await pg.locator('#bkNext').click();
  ok('finished book returns to the shelf with no microphone left open',await pg.evaluate(()=>!BOOK&&!__bookHarness.active&&!document.body.classList.contains('reading')));
  ok('book flow has no browser errors',errors.length===0,errors);
 }
 await ctx.close();
 if(has){
  // Exercise real Web Audio and the real shared detector with a synthetic
  // local MediaStream. A tone/noise burst is never enough to turn a page.
  for(const kind of ['silence','tone','noise','voice']){
   const p=await browser.newPage();await p.goto(origin+'/library.html');
   const result=await p.evaluate(async kind=>{
    const AC=window.AudioContext||window.webkitAudioContext,ac=new AC();await ac.resume();
    const dest=ac.createMediaStreamDestination(),gain=ac.createGain();gain.gain.value=0;gain.connect(dest);const sources=[];
    if(kind==='noise'){const b=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate),d=b.getChannelData(0);let seed=4;for(let i=0;i<d.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;d[i]=seed/2147483648-1;}const s=ac.createBufferSource();s.buffer=b;s.loop=true;s.connect(gain);s.start();sources.push(s);}
    else if(kind!=='silence'){for(let i=1;i<=(kind==='voice'?9:1);i++){const s=ac.createOscillator(),g=ac.createGain();s.frequency.value=kind==='voice'?190*i:440;g.gain.value=1/Math.pow(i,1.2);s.connect(g);g.connect(gain);s.start();sources.push(s);}}
    navigator.mediaDevices.getUserMedia=()=>Promise.resolve(dest.stream);
    const h=Sona.captureResponse({maxMs:2300,onListening(){setTimeout(()=>gain.gain.value=.12,600);setTimeout(()=>gain.gain.value=0,1200);}});const answer=await h.promise;
    const ended=dest.stream.getTracks().every(t=>t.readyState==='ended');sources.forEach(s=>s.stop());await ac.close();return {spoke:answer.spoke,reason:answer.reason,ended,blob:!!answer.blob};
   },kind);
   ok(kind+': response evidence is honest',result.spoke===(kind==='voice'),result);ok(kind+': microphone tracks close',result.ended,result);await p.close();
  }
  const p=await browser.newPage();await p.goto(origin+'/library.html');const cancel=await p.evaluate(async()=>{const ac=new AudioContext(),dest=ac.createMediaStreamDestination();let release,requested;const pendingPermission=new Promise(r=>requested=r);navigator.mediaDevices.getUserMedia=()=>new Promise(r=>{release=r;requested();});const h=Sona.captureResponse({maxMs:1000});await pendingPermission;h.cancel();const out=await h.promise;release(dest.stream);await new Promise(r=>setTimeout(r,50));const ended=dest.stream.getTracks().every(t=>t.readyState==='ended');await ac.close();return {reason:out.reason,spoke:out.spoke,ended};});ok('a late permission grant cannot reopen a cancelled turn',cancel.reason==='cancelled'&&!cancel.spoke&&cancel.ended,cancel);await p.close();
 }
}catch(e){ok('suite completes',false,e.stack);}finally{await browser.close();await new Promise(r=>server.close(r));}
console.log(`${checks} checks, ${bad} failures`);process.exitCode=bad?1:0;
