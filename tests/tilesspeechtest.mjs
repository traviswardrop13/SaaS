// A child earns slower keys by saying the chosen sound during Piano Tiles.
// This drives the real button, analyser and native verdict; no success helper
// is called to manufacture a reward. Audio and native recognition are local fakes.
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs';
import path from 'path';
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from './_env.mjs';

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT;
const CAPTURE = process.env.TILES_SPEECH_CAPTURE;
if(CAPTURE)mkdirSync(CAPTURE,{recursive:true});
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

function phone(cfg) {
  const h=window.__slowTest={voice:false,hidden:false,text:cfg.text==null?'rrrr':cfg.text,web:0,native:0,nativePending:0,starts:0,stops:0,requests:0,sounds:[],practice:[],stoppedAt:-1e9,startDelay:cfg.startDelay||0};
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>h.hidden});
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>h.hidden?'hidden':'visible'});
  h.hide=()=>{h.hidden=true;document.dispatchEvent(new Event('visibilitychange'));};
  h.show=()=>{h.hidden=false;document.dispatchEvent(new Event('visibilitychange'));};
  window.addEventListener('beforeunload',()=>{try{sessionStorage.setItem('sona.slow-exit-test',JSON.stringify({web:h.web,native:h.native,pending:h.nativePending,bad:h.sounds.filter(s=>s.web||s.native),practice:h.practice}));}catch(e){}});
  h.audio=(kind)=>{h.sounds.push({kind,at:performance.now(),web:h.web,native:h.native});};
  navigator.mediaDevices.getUserMedia=()=>{
    h.requests++;h.web++;h.openedAt=performance.now();
    const t={kind:'audio',readyState:'live',stop(){if(this.readyState==='live'){this.readyState='ended';h.web--;h.stoppedAt=performance.now();}}};
    return Promise.resolve({getTracks:()=>[t],getAudioTracks:()=>[t]});
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
  localStorage.setItem('sona.micok','1');sessionStorage.setItem('sona.play.token','arcade-tiles.html');sessionStorage.setItem('sona.boost.sound','R');
}
async function fresh(cfg={}) {
  const context=await browser.newContext({viewport:{width:cfg.width||393,height:cfg.width===320?568:852},reducedMotion:'reduce'});
  await context.route('**/*',r=>{if(cfg.voiceOn&&r.request().url()===BASE+'/api/tts')return r.fulfill({status:200,contentType:'audio/pcm',body:Buffer.alloc(2400)});return r.request().url().startsWith(BASE+'/')?r.continue():r.abort();});
  await context.addInitScript(phone,cfg);
  const page=await context.newPage();page.setDefaultTimeout(6000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'/arcade-tiles.html?from=charge');
  await page.waitForFunction(()=>window.gameEntryAllowed===true&&typeof draw==='function');
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
try {
  // On the old tree this fails explicitly before running scenarios which
  // need the new control. This proves the regression catches the absent feature.
  const probe=await fresh();
  const exists=await probe.page.locator('#slowKeys').count();
  ok('Piano has a deliberate in-game speech control',exists===1);
  await probe.context.close();
  if(exists===1){
    await scenario('silence and cancellation',async()=>{
      const {context,page,errors}=await fresh();try{
        await page.waitForFunction(()=>tiles.length>0);
        const before=await page.evaluate(()=>({song,songIx,tiles:tiles.length,y:tiles[0].y,score}));
        await page.locator('#slowKeys').click();await ready(page);
        const mid=await page.evaluate(()=>({song,songIx,tiles:tiles.length,y:tiles[0].y,score,slowMs,requests:__slowTest.requests}));
        await page.waitForTimeout(300);
        const after=await page.evaluate(()=>({song,songIx,tiles:tiles.length,y:tiles[0].y,score,slowMs}));
        ok('a tap and silence never grant slower keys',mid.slowMs===0&&after.slowMs===0,after);
        ok('listening preserves this song, its tiles and its score',after.song===before.song&&after.songIx===before.songIx&&after.tiles===before.tiles&&after.score===before.score&&after.y===mid.y,{before,mid,after});
        await page.evaluate(()=>tone(440,.5,.1));
        await page.locator('#slowCancel').click();await page.waitForFunction(()=>!slowTurn);
        ok('cancelling resumes without granting a reward',await page.evaluate(()=>playing&&slowMs===0));
        await clean('cancel',page,errors);
      }finally{await context.close();}
    });
    await scenario('an unrelated word is rejected',async()=>{
      const{context,page,errors}=await fresh({text:'taco'});try{
        await page.locator('#slowKeys').click();await ready(page);await voiced(page);
        await page.waitForFunction(()=>__slowTest.stops>0);await page.waitForTimeout(350);
        ok('clear native taco cannot earn an R reward',await page.evaluate(()=>slowMs===0));
        ok('the existing native verdict is actually consulted',await page.evaluate(()=>__slowTest.starts===1&&__slowTest.stops>0));
        if(await page.locator('#slowCancel:visible').count())await page.locator('#slowCancel').click();
        await page.waitForFunction(()=>!slowTurn);await clean('wrong word',page,errors);
      }finally{await context.close();}
    });
    await scenario('saying the sound earns temporary slower music',async()=>{
      const{context,page,errors}=await fresh();try{
        await page.locator('#slowKeys').click();await ready(page);await voiced(page);
        await page.waitForFunction(()=>slowMs>0&&!slowTurn);
        ok('a real R-shaped burst plus native R earns the reward',await page.evaluate(()=>slowMs>7000&&slowMs<=8000&&Math.abs(slowFactor()-.55)<.001));
        ok('the child sees that the earned slow effect is active',/slow/i.test(await page.locator('#slowStatus').innerText()));
        // Seed one moving note away from the keys, then observe the real
        // animation clock: both its travel and the spawn clock must slow.
        const a=await page.evaluate(()=>{tiles=[{lane:0,y:-80,h:88,hit:false,gone:false,note:261.63,wait:false,gold:false}];waitLeft=0;nextAt=songMs+10000;return{at:performance.now(),ms:songMs,y:tiles[0].y,normal:(HITY()+90)/SONGS[song].fall};});
        await page.waitForTimeout(850);
        const b=await page.evaluate(()=>({at:performance.now(),ms:songMs,y:tiles[0].y}));
        const elapsed=b.at-a.at,clock=(b.ms-a.ms)/elapsed,travel=(b.y-a.y)/(elapsed/1000)/a.normal;
        ok('falling tiles move at about 55 percent speed',travel>.43&&travel<.68,{travel});
        ok('new-note timing slows too, so notes cannot bunch up',clock>.43&&clock<.68,{clock});
        await page.evaluate(()=>tone(440,.5,.1));
        ok('piano notes resume once both mics are closed',await page.evaluate(()=>__slowTest.sounds.some(s=>s.kind==='note'&&!s.web&&!s.native)));
        await page.waitForFunction(()=>slowMs===0,null,{timeout:11000});
        ok('the power expires and returns to normal speed',await page.evaluate(()=>slowFactor()===1));
        await clean('accepted sound',page,errors);
      }finally{await context.close();}
    });
    // 2 Oct 2026: a sound heard just before the 6.5 s limit keeps the mic
    // open 550 ms more for Apple's recognizer, and the limit used to cut that
    // short as "Tap Echo to try again", throwing the heard sound away. Fruit
    // Slice already kept it; the slow keys now do too.
    await scenario('a sound just before the limit',async()=>{
      const{context,page,errors}=await fresh();try{
        await page.locator('#slowKeys').click();await ready(page);
        await page.waitForFunction(()=>performance.now()-__slowTest.openedAt>=6000,null,{timeout:9000});
        await page.evaluate(()=>{__slowTest.voice=true;});
        const heard=await page.waitForFunction(()=>slowTurn&&slowTurn.heardAt,null,{timeout:2000}).then(()=>true,()=>false);
        const at=await page.evaluate(()=>slowTurn&&slowTurn.heardAt?slowTurn.heardAt-__slowTest.openedAt:null);
        await page.waitForFunction(()=>!slowTurn,null,{timeout:4000});
        await page.evaluate(()=>{__slowTest.voice=false;});
        ok('a sound heard in the last moment before the limit still earns slower keys, not "try again"',heard&&at>5950&&(await page.evaluate(()=>slowMs>0)),{at,status:await page.locator('#slowStatus').innerText()});
        await clean('late sound',page,errors);
      }finally{await context.close();}
    });
    for(const cfg of [{text:'',name:'unclear transcript',reward:true},{text:'rrrr',hiss:true,name:'wrong sound family',reward:false}])await scenario(cfg.name,async()=>{
      const{context,page,errors}=await fresh(cfg);try{
        await page.locator('#slowKeys').click();await ready(page);await voiced(page);
        if(cfg.reward){await page.waitForFunction(()=>slowMs>0&&!slowTurn);ok('an unclear transcript can use the qualified sound-shape check',await page.evaluate(()=>slowMs>0));}
        else{await page.waitForTimeout(750);ok('a hiss cannot earn an R reward even with a matching native word',await page.evaluate(()=>slowMs===0));await page.locator('#slowCancel').click();await page.waitForFunction(()=>!slowTurn);}
        await clean(cfg.name,page,errors);
      }finally{await context.close();}
    });
    await scenario('spoken instructions before the microphone',async()=>{
      const{context,page,errors}=await fresh({voiceOn:true});try{
        await page.locator('#slowKeys').click();await ready(page);
        const h=await page.evaluate(()=>({audio:__slowTest.sounds.filter(s=>s.kind==='voice'),opened:__slowTest.openedAt}));
        ok('Echo speaks the instruction and then models one take of the recorded target sound',h.audio.length===2&&/^blob:/.test(h.audio[0].url)&&/\/coach\/say-echo\/R-sound\.wav$/.test(h.audio[1].url),h);
        ok('the microphone waits for the recorded sound and its quiet tail',h.audio.length===2&&h.audio[1].end!==null&&h.opened-h.audio[1].end>=850,h);
        await page.locator('#slowCancel').click();await page.waitForFunction(()=>!slowTurn);await clean('spoken prompt',page,errors);
      }finally{await context.close();}
    });
    await scenario('cancel while Echo models the sound',async()=>{
      const{context,page,errors}=await fresh({voiceOn:true,speechMs:1500});try{
        await page.locator('#slowKeys').click();await page.waitForFunction(()=>__slowTest.sounds.some(s=>s.kind==='voice'&&s.end===null));
        await page.locator('#slowCancel').click();await page.waitForFunction(()=>!slowTurn);await page.waitForTimeout(1200);
        ok('cancelling narration stops the model and never opens a late microphone',await page.evaluate(()=>__slowTest.requests===0&&slowMs===0&&__slowTest.sounds.filter(s=>s.kind==='voice').every(s=>s.end!==null)));
        await clean('cancelled model',page,errors);
      }finally{await context.close();}
    });
    for(const width of [393,320])await scenario('phone fit '+width,async()=>{
      const{context,page,errors}=await fresh({width});try{
        await page.waitForTimeout(250);
        if(CAPTURE)await page.screenshot({path:path.join(CAPTURE,width+'-game.png')});
        await page.locator('#slowKeys').click();await ready(page);
        const fit=await page.evaluate(()=>{const c=document.getElementById('slowControl').getBoundingClientRect(),top=document.getElementById('top').getBoundingClientRect(),cancel=document.getElementById('slowCancel').getBoundingClientRect();return{left:c.left,right:c.right,top:c.top,bottom:c.bottom,hudBottom:top.bottom,w:innerWidth,keys:HITY(),cancelWidth:cancel.width};});
        ok(width+': listening control fits below HUD and above the piano keys',fit.left>=0&&fit.right<=fit.w&&fit.top>=fit.hudBottom&&fit.bottom<fit.keys&&fit.cancelWidth>=44,fit);
        if(CAPTURE)await page.screenshot({path:path.join(CAPTURE,width+'-listening.png')});
        await voiced(page);await page.waitForFunction(()=>slowMs>0&&!slowTurn);
        if(CAPTURE)await page.screenshot({path:path.join(CAPTURE,width+'-earned.png')});
        ok(width+': no runtime errors',errors.length===0,errors);
      }finally{await context.close();}
    });
    for(const mode of ['hidden','exit','late native start'])await scenario(mode+' cleanup',async()=>{
      const{context,page,errors}=await fresh({startDelay:mode==='late native start'||mode==='exit'?1100:0});try{
        await page.locator('#slowKeys').click();
        if(mode==='late native start'||mode==='exit')await page.waitForFunction(()=>__slowTest.starts>0);else await ready(page);
        if(mode==='exit')await page.evaluate(()=>document.getElementById('close').click());else await page.evaluate(()=>__slowTest.hide());
        if(mode==='exit'){
          await page.waitForURL('**/today.html*');
          ok('exit reaches the library',page.url().includes('/today.html'));
          const exit=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('sona.slow-exit-test')||'null'));
          ok('exit releases both microphone owners before navigation',!!exit&&exit.web===0&&exit.native===0&&exit.pending===0,exit);
          ok('exit plays no sound into either mic',!!exit&&exit.bad.length===0,exit);
          ok('exit writes no practice records',!!exit&&exit.practice.length===0,exit);
        }else{
          await page.waitForTimeout(mode==='late native start'?1600:350);
          ok(mode+': no reward survives the interruption',await page.evaluate(()=>slowMs===0));
          if(mode==='late native start')ok('a start settling after cancellation is stopped again',await page.evaluate(()=>__slowTest.starts===1&&__slowTest.stops>=2));
          await clean(mode,page,errors);
        }
      }finally{await context.close();}
    });
  }
}finally{await browser.close();await new Promise(r=>server.close(r));}
console.log(failures?failures+' FAILURES / '+assertions+' assertions':'ALL GREEN — '+assertions+' assertions');
process.exit(failures?1:0);
