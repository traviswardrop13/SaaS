// Actual iPhone practice: every credited word needs a fresh local transcript.
// SONATEST_BASE_REF=<pre-fix commit> serves that commit's practice/sona sources.
// SONATEST_CHARGE_SOURCE=<saved page> isolates a practice-page regression.
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {chromium,ROOT,launchOpts} from './_env.mjs';
import {fakeDevice} from './_sayplaydevice.mjs';
import {nativeMic} from './_nativemic.mjs';
const base=process.env.SONATEST_BASE_REF, overrides={};
if(base)for(const file of ['charge.html','sona.js'])overrides['/'+file]=execFileSync('git',['show',base+':public/'+file]);
if(process.env.SONATEST_CHARGE_SOURCE)overrides['/charge.html']=readFileSync(process.env.SONATEST_CHARGE_SOURCE);
const server=createServer((req,res)=>{
  const u=new URL(req.url,'http://local'), file=path.join(ROOT,u.pathname);
  if(u.pathname.startsWith('/api/')){res.writeHead(503);res.end('{}');return;}
  if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}
  const mime={html:'text/html',js:'text/javascript',css:'text/css',webp:'image/webp',svg:'image/svg+xml',woff2:'font/woff2'};
  res.setHeader('content-type',mime[path.extname(file).slice(1)]||'application/octet-stream');res.end(overrides[u.pathname]||readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(launchOpts());
let checks=0,failures=0;
function ok(name,pass,detail){checks++;if(!pass)failures++;console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' '+JSON.stringify(detail)));}
async function advance(page,ms){await page.clock.runFor(ms);}
async function until(page,predicate,ms=15000){for(let t=0;t<ms;t+=100){if(await page.evaluate(predicate))return true;await advance(page,100);}return !!await page.evaluate(predicate);}
async function fresh(cfg={}){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  await context.addInitScript(fakeDevice,{micok:true,voiceOn:false,soundOn:false,volume:0});
  await context.addInitScript(nativeMic,{mode:'old',world:false,audit:false,text:'taco',speech:cfg.available!==false});
  const sound=cfg.blendLevel?'S':'R', level=cfg.blendLevel||'word';
  await context.addInitScript(({sound,level})=>{
    // Use the real homework path to choose one bank word at its actual position.
    if(sound==='S')localStorage.setItem('sona.homework.v1',JSON.stringify({hw:{id:'blend-fixture',sounds:['S'],pos:'b',words:['star']},at:Date.now()}));
    localStorage.setItem('sona.progress.v1',JSON.stringify({sessions:[],totals:{},stage:{[sound]:2},bySound:{},streak:{count:0,lastDate:''},chests:{},missed:[]}));
    const round=sound==='S'&&level==='word'?1:2; // Blends skip the unreviewed syllable rung.
    sessionStorage.setItem('sona.run.v1',JSON.stringify({active:true,round,sum:0,scores:[],pending:false,sound,level:1,demo:false,games:['slice','tiles','stack','run','glide']}));
  },{sound,level});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
  await page.goto(origin+'/charge.html?daily=1&sound='+sound);
  const ready=await until(page,()=>window.ITEM&&window.engineOn&&window.listenReady);
  await page.evaluate(()=>{NEED=100;});
  return{context,page,errors,ready:ready&&await page.evaluate(expected=>ITEM.level===expected,level)};
}
async function burst(page,text){await page.evaluate(t=>{__nm.cfg.text=t;__quiet.voice=true;},text);await advance(page,400);await page.evaluate(()=>{__quiet.voice=false;});await advance(page,1300);}
const state=page=>page.evaluate(()=>({reps,stored:Sona.dayReps(),target:ITEM.word,prompt:ITEM.t,pos:ITEM.pos,starts:__nm.starts.length,recognizing:__nm.recognizing,turn:document.getElementById('turnStatus').textContent}));
try{
  {
    const {context,page,errors,ready}=await fresh();try{
      ok('actual native word practice opens',ready,await state(page));
      await burst(page,'taco');await burst(page,'fridge');const wrong=await state(page);
      ok('random spoken words earn no fruit, reps or stored progress',wrong.reps===0&&wrong.stored===0,wrong);
      if(!ready||wrong.reps)console.log('BASELINE wrong-word acceptance reproduced');
      const target=wrong.target;
      await burst(page,target);const accepted=await state(page);
      ok('a separately verified target earns exactly one visible saying',accepted.reps===1,accepted);
      await burst(page,'taco');const later=await state(page);
      ok('one correct word cannot approve a later random saying',later.reps===1&&later.stored===0,later);
      await burst(page,'');const unclear=await state(page);
      ok('an unclear native word is unverified, not successful',unclear.reps===1,unclear);
      ok('each saying uses a fresh unbiased native check',await page.evaluate(()=>__nm.starts.length>=5&&__nm.starts.every(o=>Array.isArray(o.words)&&o.words.length===0)),await state(page));
      ok('word verification introduces no runtime error',errors.length===0,errors);
    }finally{await context.close();}
  }
  for(const level of ['word','sentence']){
    const {context,page,errors,ready}=await fresh({blendLevel:level});try{
      const initial=await state(page);
      ok('actual native practice opens an S blend '+level,ready&&initial.target==='star'&&initial.pos==='b',initial);
      const dropped=initial.prompt.replace(/\bstar\b/,'tar');
      await burst(page,dropped);
      const wrong=await state(page);
      ok('dropping S in a blend '+level+' earns no saying',wrong.reps===0&&wrong.stored===0,wrong);
      await burst(page,initial.prompt);
      const right=await state(page);
      ok('the complete blend '+level+' earns one fresh saying',right.reps===wrong.reps+1&&right.starts>wrong.starts&&errors.length===0,{right,errors});
    }finally{await context.close();}
  }
  {
    const {context,page,errors}=await fresh();try{
      await page.evaluate(()=>{__nm.cfg.text=ITEM.word;});await advance(page,1000);const silent=await state(page);
      ok('a target transcript without detected voice earns nothing',silent.reps===0&&silent.stored===0,silent);
      await page.evaluate(()=>{__quiet.voice=true;});await advance(page,250);await page.evaluate(()=>{__quiet.voice=false;__quiet.background();});await advance(page,1300);
      const paused=await state(page);
      ok('background cancels a pending word without credit',paused.reps===0&&!paused.recognizing,paused);
      ok('cancellation has no runtime error',errors.length===0,errors);
    }finally{await context.close();}
  }
  {
    const {context,page,ready}=await fresh();try{
      ok('held-word scenario opens actual word practice',ready);
      await page.evaluate(()=>{__nm.cfg.text=ITEM.word;__quiet.voice=true;});await advance(page,4200);
      const held=await state(page);
      ok('a long continuous word is not credited on its onset or an arbitrary tail cap',held.reps===0,held);
      await page.evaluate(()=>{__quiet.voice=false;});await advance(page,1400);
      const ended=await state(page);
      ok('the whole ended word earns one saying, never two',ended.reps===1,ended);
      await burst(page,ended.target);const second=await state(page);
      ok('only a new utterance after real quiet earns the next saying',second.reps===2,second);
    }finally{await context.close();}
  }
  {
    const {context,page}=await fresh();try{
      await page.evaluate(()=>{const deaf=Sona.micDeaf;window.__missing=false;Sona.micDeaf=st=>__missing||deaf(st);__nm.cfg.text=ITEM.word;__quiet.voice=true;});
      await advance(page,400);
      await page.evaluate(()=>{__quiet.voice=false;__missing=true;});await advance(page,450);
      const gap=await state(page);
      ok('missing native sound is not a quiet word ending',gap.reps===0,gap);
      await page.evaluate(()=>{__missing=false;__quiet.voice=true;});await advance(page,400);
      await page.evaluate(()=>{__quiet.voice=false;});await advance(page,1400);
      const end=await state(page);
      ok('the same utterance after a missing frame still earns at most one saying',end.reps===1,end);
    }finally{await context.close();}
  }
  {
    const {context,page,errors,ready}=await fresh();try{
      ok('observed-quiet scenario opens actual word practice',ready);
      await page.evaluate(()=>{__nm.cfg.text=ITEM.word;__quiet.voice=true;});await advance(page,400);
      const candidate=await page.evaluate(()=>({candidate:engineAttempt.segment.wordCandidate,reps}));
      ok('a real voiced word is nominated before the missing frame',candidate.candidate&&candidate.reps===0,candidate);
      await page.evaluate(()=>{
        const deaf=Sona.micDeaf,cancel=window.cancelAnimationFrame.bind(window);
        const h=window.__wordRaf={callbacks:{},seq:0,deafReads:0,missing:true};
        Sona.micDeaf=st=>{if(h.missing){h.deafReads++;return true;}return deaf(st);};
        // The already-queued engine frame observes one missing feed. Every
        // subsequent RAF waits here, so advancing time supplies no frames.
        window.requestAnimationFrame=fn=>{const id=-(++h.seq);h.callbacks[id]=fn;return id;};
        window.cancelAnimationFrame=id=>{if(id<0)delete h.callbacks[id];else cancel(id);};
        h.step=()=>{const id=engineAttempt.segment.raf,fn=h.callbacks[id];if(!fn)throw new Error('No held engine frame');delete h.callbacks[id];fn(performance.now());};
        __quiet.voice=false;
      });
      await advance(page,40);
      const deafFrame=await page.evaluate(()=>({missingReads:__wordRaf.deafReads,held:!!__wordRaf.callbacks[engineAttempt.segment.raf],reps}));
      ok('one deaf frame is observed and later engine frames are explicitly held',deafFrame.missingReads===1&&deafFrame.held&&deafFrame.reps===0,deafFrame);
      await advance(page,450);
      await page.evaluate(()=>{__wordRaf.missing=false;__wordRaf.step();});await advance(page,1);
      const firstQuiet=await state(page);
      ok('a delayed first resumed quiet frame cannot finish the word',firstQuiet.reps===0&&firstQuiet.recognizing,firstQuiet);
      // Only these explicit valid quiet frames can complete the 200ms tail.
      for(let i=0;i<10;i++){await advance(page,20);await page.evaluate(()=>__wordRaf.step());}
      await advance(page,1);
      const ended=await state(page);
      ok('200ms of observed quiet finishes the same word exactly once',ended.reps===1,ended);
      ok('observed-quiet frame control has no runtime error',errors.length===0,errors);
    }finally{await context.close();}
  }
  {
    const {context,page}=await fresh();try{
      await page.evaluate(()=>{__nm.cfg.text=ITEM.word;__quiet.voice=true;});await advance(page,250);
      await page.evaluate(()=>{Sona.addKid('Sibling','7');__quiet.voice=false;});await advance(page,1600);
      await page.waitForURL('**/today.html');await page.waitForFunction(()=>!!window.Sona);
      const result=await page.evaluate(()=>({path:location.pathname,reps:Sona.dayReps(),recognizing:__nm.recognizing}));
      ok('changing child cancels the old practice and cannot credit the sibling',result.path==='/today.html'&&result.reps===0&&!result.recognizing,result);
    }finally{await context.close();}
  }
}finally{await browser.close();server.close();}
console.log(`\n${checks} checks, ${failures} failures`);process.exitCode=failures?1:0;
