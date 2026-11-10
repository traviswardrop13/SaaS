// The real shared native lifecycle: one fresh transcript per saying, no hint,
// no cloud fallback, and no late recognition after a cancelled/changed turn.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {chromium, ROOT, launchOpts} from './_env.mjs';
const sonaSource=process.env.SONATEST_SONA_SOURCE||ROOT+'/sona.js';
const server=createServer((req,res)=>{
  if(req.url==='/sona.js'){res.setHeader('content-type','text/javascript');res.end(readFileSync(sonaSource));return;}
  res.setHeader('content-type','text/html');res.end('<!doctype html><script src="/sona.js"></script>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(launchOpts());
let checks=0, failures=0;
function ok(name,pass,details){checks++;if(!pass)failures++;console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' '+JSON.stringify(details)));}
async function fresh(cfg={}){
  const context=await browser.newContext();
  await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  await context.addInitScript(config=>{
    window.__wc={cfg:config,events:[],hidden:false};const h=window.__wc;
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>h.hidden});
    window.Capacitor=config.browser?undefined:{isNativePlatform:()=>true,Plugins:config.missing?{}:{SonaSpeech:{
      available:()=>new Promise(resolve=>{const done=()=>resolve({available:config.authorized!==false,onDevice:config.cloud!==true});if(config.holdAvailable)h.releaseAvailable=done;else done();}),
      requestPermission:async()=>{h.events.push('permission');config.authorized=true;return {granted:!config.deny};},
      start:opts=>new Promise(resolve=>{h.events.push(['start',opts]);const done=()=>{h.events.push('started');resolve({started:true});};if(config.holdStart)h.releaseStart=done;else done();}),
      stop:()=>new Promise(resolve=>{h.events.push('stop');const done=()=>resolve({text:h.cfg.text||'',onDevice:config.cloud!==true});if(config.holdStop)h.releaseStop=done;else done();})
    }}};
    localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Test',childAge:'7',focusSounds:['R'],onboarded:true,earlyAdopter:true,volume:0}));
  },cfg);
  const page=await context.newPage();await page.goto(origin);
  return {context,page};
}
try{
  for(const [text,want] of [['taco','fail'],['rocket','fail'],['wabbit','pass'],['rabbit','pass'],['','unknown']]){
    const {context,page}=await fresh({text});try{
      const r=await page.evaluate(async()=>{const t=Sona.speechTurn({sound:'R',word:'rabbit',level:'word'});return {required:t.required,ready:await t.ready,result:await t.finish(),again:await t.finish(),events:__wc.events};});
      ok(text+' has its own native verdict',r.required&&r.ready&&r.result===want&&r.again===want,r);
      ok(text+' verification neither hints the answer nor stops twice',r.events.filter(x=>Array.isArray(x)&&x[0]==='start').length===1&&r.events.find(x=>Array.isArray(x))[1].words.length===0&&r.events.filter(x=>x==='stop').length===1,r);
    }finally{await context.close();}
  }
  for(const spec of [
    {word:'stop',level:'word',frame:'',wrong:'top',right:'stop'},
    {word:'star',level:'sentence',frame:'I see a star.',wrong:'I see a tar.',right:'I see a star.'}
  ]){
    const {context,page}=await fresh();try{
      const r=await page.evaluate(async({word,level,frame,wrong,right})=>{
        const opts={sound:'S',word,level,frame};
        async function say(text,target){
          __wc.cfg.text=text;
          const t=Sona.speechTurn(target);
          return {ready:await t.ready,required:t.required,result:await t.finish()};
        }
        return {
          omitted:await say(wrong,opts),
          blend:await say(wrong,{...opts,pos:'b'}),
          right:await say(right,{...opts,pos:'b'}),
          starts:__wc.events.filter(Array.isArray).map(event=>event[1])
        };
      },spec);
      ok(spec.level+' accepts the dropped blend sound only when the position is omitted',r.omitted.result==='pass'&&r.blend.ready&&r.blend.required&&r.blend.result==='fail',r);
      ok(spec.level+' with its complete blend passes in a fresh native turn',r.right.ready&&r.right.required&&r.right.result==='pass',r);
      ok(spec.level+' sends neither the position nor the word as a recognition hint',r.starts.length===3&&r.starts.every(o=>Array.isArray(o.words)&&o.words.length===0&&o.pos===undefined),r.starts);
    }finally{await context.close();}
  }
  for(const cfg of [{missing:true},{cloud:true},{authorized:false,deny:true}]){
    const {context,page}=await fresh(cfg);try{
      const r=await page.evaluate(async()=>{const t=Sona.speechTurn({sound:'R',word:'rabbit',level:'word'});return {required:t.required,ready:await t.ready,result:await t.finish(),events:__wc.events};});
      ok('unavailable native words remain unverified '+JSON.stringify(cfg),r.required&&!r.ready&&r.result==='unavailable'&&!r.events.some(Array.isArray),r);
    }finally{await context.close();}
  }
  {
    const {context,page}=await fresh({browser:true});try{
      const r=await page.evaluate(async()=>{const t=Sona.speechTurn({sound:'R',word:'rabbit',level:'word'});return [t.active,t.required,await t.ready,await t.finish()];});
      ok('browser does not pretend to recognize a word',JSON.stringify(r)==='[false,false,true,"unknown"]',r);
    }finally{await context.close();}
  }
  {
    const {context,page}=await fresh({holdAvailable:true,text:'rabbit'});try{
      await page.evaluate(()=>{window.turn=Sona.speechTurn({sound:'R',word:'rabbit',level:'word'});});
      await page.waitForFunction(()=>!!__wc.releaseAvailable);
      await page.evaluate(async()=>{await turn.cancel();__wc.releaseAvailable();});
      const r=await page.evaluate(async()=>[await turn.ready,await turn.finish(),__wc.events]);
      ok('cancelled availability can never start recognition',r[0]===false&&r[1]==='cancelled'&&!r[2].some(Array.isArray),r);
    }finally{await context.close();}
  }
  {
    const {context,page}=await fresh({holdStart:true,text:'rabbit'});try{
      await page.evaluate(()=>{window.first=Sona.speechTurn({sound:'R',word:'rabbit',level:'word'});});
      await page.waitForFunction(()=>!!__wc.releaseStart);
      await page.evaluate(()=>{window.cancelled=first.cancel();__wc.cfg.holdStart=false;window.second=Sona.speechTurn({sound:'R',word:'rabbit',level:'word'});});
      await page.waitForTimeout(100);
      ok('a replacement waits for an old native start to settle',await page.evaluate(()=>__wc.events.filter(Array.isArray).length===1));
      await page.evaluate(()=>__wc.releaseStart());
      const r=await page.evaluate(async()=>{await cancelled;const ready=await second.ready;return {ready,old:await first.finish(),result:await second.finish(),events:__wc.events};});
      ok('late start is stopped before next saying, never credited',r.ready&&r.old==='cancelled'&&r.result==='pass'&&r.events.filter(x=>x==='stop').length===3,r);
    }finally{await context.close();}
  }
  {
    const {context,page}=await fresh({text:'rabbit'});try{
      const r=await page.evaluate(async()=>{const t=Sona.speechTurn({sound:'R',word:'rabbit',level:'word'});await t.ready;__wc.hidden=true;return await t.finish();});
      ok('hidden page cannot use an otherwise correct transcript',r==='cancelled',r);
    }finally{await context.close();}
  }
  {
    const {context,page}=await fresh({holdStart:true,text:'rabbit'});try{
      await page.clock.install();
      await page.evaluate(()=>{window.turn=Sona.speechTurn({sound:'R',word:'rabbit',level:'word'});});
      await page.clock.runFor(6000);
      const before=await page.evaluate(async()=>({ready:await turn.ready,result:await turn.finish(),events:__wc.events}));
      ok('a stalled native start times out without a successful word',!before.ready&&before.result==='unavailable',before);
      await page.evaluate(()=>{__wc.cfg.holdStart=false;window.next=Sona.speechTurn({sound:'R',word:'rabbit',level:'word'});__wc.releaseStart();});
      await page.clock.runFor(100);
      const after=await page.evaluate(async()=>({ready:await next.ready,result:await next.finish(),events:__wc.events}));
      ok('after a stalled start, late cleanup cannot race a newer recognizer',!after.ready&&after.result==='unavailable'&&after.events.filter(Array.isArray).length===1&&after.events.filter(x=>x==='stop').length>=2,after);
    }finally{await context.close();}
  }
  {
    const {context,page}=await fresh({holdStart:true,holdStop:true,text:'rabbit'});try{
      await page.clock.install();
      await page.evaluate(()=>{
        window.first=Sona.speechTurn({sound:'R',word:'rabbit',level:'word'});
        __wc.readySettled=false;first.ready.then(value=>{__wc.readySettled=true;__wc.readyValue=value;});
      });
      await page.clock.runFor(5100);
      const timed=await page.evaluate(()=>({ready:__wc.readySettled,stops:__wc.events.filter(x=>x==='stop').length}));
      ok('a start timeout waits for its native stop before releasing ready',!timed.ready&&timed.stops===1,timed);
      await page.evaluate(()=>{
        __wc.cancelSettled=false;first.cancel().then(()=>{__wc.cancelSettled=true;});
        __wc.cfg.holdStart=false;
        window.second=Sona.speechTurn({sound:'R',word:'rabbit',level:'word'});
        __wc.nextSettled=false;second.ready.then(()=>{__wc.nextSettled=true;});
      });
      await page.clock.runFor(400);
      const waiting=await page.evaluate(()=>({ready:__wc.readySettled,cancel:__wc.cancelSettled,next:__wc.nextSettled,starts:__wc.events.filter(Array.isArray).length}));
      ok('cancel and replacement both keep waiting while the timeout stop is pending',!waiting.ready&&!waiting.cancel&&!waiting.next&&waiting.starts===1,waiting);
      await page.evaluate(()=>__wc.releaseStop());await page.clock.runFor(100);
      const stopped=await page.evaluate(()=>({ready:__wc.readySettled,value:__wc.readyValue,cancel:__wc.cancelSettled,next:__wc.nextSettled,starts:__wc.events.filter(Array.isArray).length}));
      ok('settling that stop releases cleanup but the fault latch refuses a new recognizer',stopped.ready&&stopped.value===false&&stopped.cancel&&stopped.next&&stopped.starts===1,stopped);
      await page.evaluate(()=>__wc.releaseStart());await page.clock.runFor(100);
      const late=await page.evaluate(()=>({events:__wc.events,stops:__wc.events.filter(x=>x==='stop').length,starts:__wc.events.filter(Array.isArray).length}));
      ok('a late old start is stopped again without overlapping new recognition',late.starts===1&&late.stops===2&&late.events.indexOf('started')>late.events.indexOf('stop')&&late.events.lastIndexOf('stop')>late.events.indexOf('started'),late);
      await page.evaluate(()=>__wc.releaseStop());await page.clock.runFor(100);
      const results=await page.evaluate(async()=>[await first.finish(),await second.finish()]);
      ok('neither timed-out saying can become a successful word',results[0]==='cancelled'&&results[1]==='unavailable',results);
    }finally{await context.close();}
  }
  {
    const {context,page}=await fresh({holdStop:true,text:'rabbit'});try{
      await page.clock.install();
      await page.evaluate(async()=>{window.turn=Sona.speechTurn({sound:'R',word:'rabbit',level:'word'});await turn.ready;window.finished=turn.finish();});
      await page.clock.runFor(3000);
      const r=await page.evaluate(async()=>await finished);
      ok('a stalled final answer is unverified rather than hanging or passing',r==='unavailable',r);
      await page.evaluate(()=>__wc.releaseStop());await page.clock.runFor(100);
      ok('a late matching final answer cannot replace the unverified result',await page.evaluate(async()=>await finished)==='unavailable');
    }finally{await context.close();}
  }
}finally{await browser.close();server.close();}
console.log(`\n${checks} checks, ${failures} failures`);process.exitCode=failures?1:0;
