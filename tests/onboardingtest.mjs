// Setup grants permission, not practice credit. Device and speech edges are
// silent fakes; page navigation, profile/draft storage, and controls are real.
//
// SETUP, FROM SCRATCH (Travis, 22 Oct 2026: "a completely new onboarding ...
// We want to sell the product in the onboarding"): the hello → "Speech
// homework is hard at home." → the games playing ("They practice by
// playing.") → Rachel on her own → name and age → "What does <Name> love?" →
// "Games <Name> will love" → "Is <Name> in speech therapy?" → the sounds →
// "How long each day?" → the optional email (before the price since 13 Oct
// 2026) → "<Name>'s practice is ready!" → (a reminder ask, where the iPhone
// can set one; the price, only where Sona can sell) → microphone → hand-off →
// first game. The profile is saved as the parent leaves the ready screen (or
// the reminder after it). This suite's own harness is a phone that cannot buy,
// so it never sees a price; the last scenarios borrow the shared fake phone
// (tests/_phone.mjs: an App Store and a microphone in one) to hold the page to
// what the price screen and the whole-flow suite rely on, with
// /subscribe.html stubbed so nothing here depends on that page. The new
// screens' own rules (the hello, the reel and its voice, Rachel's screen, what
// a child loves, the minutes, the reminder) are setupscreenstest's.
import {createServer} from 'http';
import {readFileSync,existsSync,statSync} from 'fs';
import path from 'path';
import {tmpdir} from 'os';
import {chromium,ROOT,launchOpts} from './_env.mjs';
import {calm,open as openPhone,setupWalk} from './_phone.mjs';
const root=process.env.SONATEST_PUBLIC_ROOT||ROOT,base='http://127.0.0.1:8198';
const mime={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',webp:'image/webp',woff2:'font/woff2',wav:'audio/wav'};
const server=createServer((req,res)=>{const u=new URL(req.url,base),file=path.join(root,u.pathname);if(u.pathname.startsWith('/api/')){res.writeHead(503,{'content-type':'application/json'});res.end('{}');return;}if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':mime[file.split('.').pop()]||'application/octet-stream'});res.end(readFileSync(file));});
await new Promise(resolve=>server.listen(8198,'127.0.0.1',resolve));
const browser=await chromium.launch(launchOpts());let checks=0,failures=0;
function ok(name,pass,detail=''){checks++;if(!pass)failures++;console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' → '+JSON.stringify(detail)));}
async function scenario(name,fn){try{await fn();}catch(e){ok(name+' completes without a page/harness error',false,e.stack);}}
function edges(config){
  const h=window.__setup={requests:[],tracks:[],order:[],hidden:false,speech:[],complete:0,confetti:0,media:[]};
  h.keyboardCalls=[];h.keyboardListeners={};
  if(config.keyboardPlatform){
    const keyboard={setAccessoryBarVisible(options){h.keyboardCalls.push(options);return Promise.resolve();},addListener(name,callback){h.keyboardListeners[name]=callback;return Promise.resolve({remove(){}});}};
    window.Capacitor={isNativePlatform:()=>!!config.native,getPlatform:()=>config.keyboardPlatform,Plugins:config.keyboardMissing?{}:{Keyboard:keyboard}};
  }
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>h.hidden});
  h.background=()=>{h.hidden=true;document.dispatchEvent(new Event('visibilitychange'));};h.foreground=()=>{h.hidden=false;document.dispatchEvent(new Event('visibilitychange'));};
  navigator.mediaDevices.getUserMedia=()=>new Promise((resolve,reject)=>{h.order.push('microphone');const req={grant(){const tracks=[0,1].map(()=>{const t={readyState:'live',stop(){t.readyState='ended';h.order.push('stop');}};h.tracks.push(t);return t;});resolve({getTracks:()=>tracks,getAudioTracks:()=>tracks});},deny(){reject(new DOMException('Denied','NotAllowedError'));}};h.requests.push(req);if(config.permission==='grant')req.grant();else if(config.permission==='deny')req.deny();});
  let sona;
  // (every recording Sona would play is written down instead: setup plays one
  // only on a grown-up's tap of "Hear Echo", setupscreenstest's)
  Object.defineProperty(window,'Sona',{configurable:true,get:()=>sona,set(value){sona=value;value.isNativeApp=()=>!!config.native;value.speechPerm=()=>{h.order.push('speech permission');return Promise.resolve(true);};value.speak=value.speakNow=text=>{if(String(text||'').trim())h.speech.push(text);return Promise.resolve();};value.mediaPCM=(bytes,o)=>{h.media.push({len:bytes&&bytes.byteLength,volume:o&&o.volume});return {done:Promise.resolve('ended'),stop(){}};};value.confetti=()=>h.confetti++;Object.keys(value.sfx||{}).forEach(k=>{if(typeof value.sfx[k]==='function')value.sfx[k]=()=>{if(k==='complete')h.complete++;};});}});
  // a browser where the website sells (WEB_SALES's own QA seam, session-only):
  // a phone where the price follows setup, as the iPhone app with the plugin
  if(config.webSales)try{sessionStorage.setItem('sona.websalesui','1');}catch(e){}
  if(!localStorage.getItem('sona.test.setupseed')){localStorage.setItem('sona.test.setupseed','1');localStorage.setItem('sona.profile.v1',JSON.stringify({voiceOn:true,soundOn:false,volume:0.7}));}
}
// Destinations are followed without starting another page's game, mic or
// store. The price screen is a stub too: this harness cannot buy, so a
// request for it at all is a failure (see neverPriced).
async function stubs(context){
  await context.route('**/charge.html?**',route=>route.fulfill({status:200,contentType:'text/html',body:'<p>Practice destination</p>'}));
  await context.route('**/today.html',route=>route.fulfill({status:200,contentType:'text/html',body:'<p>Home destination</p>'}));
  await context.route('**/arcade-*.html',route=>route.fulfill({status:200,contentType:'text/html',body:'<p>Game destination</p>'}));
  await context.route('**/subscribe.html**',route=>route.fulfill({status:200,contentType:'text/html',body:'<p>Price destination</p>'}));
}
async function fresh(config={}){
  const context=await browser.newContext({viewport:config.viewport||{width:320,height:568},reducedMotion:'reduce'});await context.addInitScript(edges,config);
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());if(!url.href.startsWith(base+'/'))return route.abort();
    // Desktop Chromium has zero safe-area insets. Substitute the device's
    // actual inset values so footer collisions are exercised, not hidden.
    if(config.safeArea&&/\.(html|css)$/.test(url.pathname)){
      const file=path.join(root,url.pathname);if(existsSync(file))return route.fulfill({contentType:url.pathname.endsWith('.css')?'text/css':'text/html',body:readFileSync(file,'utf8').replace(/env\(safe-area-inset-top\)/g,config.safeArea.top+'px').replace(/env\(safe-area-inset-bottom\)/g,config.safeArea.bottom+'px')});
    }
    return route.continue();
  });
  await stubs(context);
  const page=await context.newPage();page.setDefaultTimeout(3500);const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));
  page.on('dialog',dialog=>dialog.dismiss());await page.goto(base+'/onboarding.html');return {context,page,errors,requests};
}
// EVERY WALKING HELPER CALMS THE PAGE FIRST. After any tap that changes the
// step, setup takes no tap for 450 ms (body.ob-settling: a double tap must not
// answer the next screen). A real click would wait that out through
// Playwright's retries, and under a paused clock it would never lift at all.
// Only the double-tap checks leave the pause alone.
async function next(page){await calm(page);await page.locator('#nextBtn').click();}
const screen=page=>page.evaluate(()=>document.body.dataset.setupScreen);
// "Who's setting up Sona?" left setup on 5 Oct 2026 (Travis: "it's just for
// the parents"). A clinician's setup opens only from /onboarding.html?slp=1,
// which is where who(page,'slp') goes; for a parent it only presses the
// hello's button.
async function who(page,role='parent'){if(role==='slp'&&!/[?&]slp=1/.test(page.url())){await page.goto(base+'/onboarding.html?slp=1');await page.waitForFunction(()=>window.Sona&&document.getElementById('nextBtn'));}if(await screen(page)==='welcome')await next(page);}
// from wherever setup is (the hello, the screens that sell) to the child's name
async function toName(page){await setupWalk(page,'name');await page.locator('[data-step="name"].on').waitFor();}
// One tap on a one-tap question: one of its answer ids, or 'skip'.
async function answer(page,key,val='skip'){await page.locator('[data-step="'+key+'"].on').waitFor();await calm(page);await page.locator(val==='skip'?'#'+key+'Skip':'[data-step="'+key+'"] .ask-pick[data-val="'+val+'"]').click();}
const answerTherapy=(page,val)=>answer(page,'therapy',val),answerMinutes=(page,val)=>answer(page,'minutes',val);
// THE SCREENS THAT SELL (19 Oct 2026; rebuilt 22 Oct): the problem, the reel
// and Rachel before the name, what the child loves and their games after it.
const SELL=['problem','reel','rachel','interests','games'];
// hello → … → name and age → what they love → their games → the therapy
// question (a tap, or Skip) → the sound picker. A second child and a
// clinician in the app are not asked, and go straight there.
async function enter(page,{mode='speech',age='4',name='Milo',therapy='skip',interests=[]}={}){await setupWalk(page,'sounds',{name,age,therapy,interests});await page.locator('[data-step="sounds"].on').waitFor();if(mode!=='speech'){await calm(page);await page.locator('#obExploreSounds').click();}}
async function choose(page,sound='R'){
  await calm(page);const chip=page.locator('#obSounds [data-sound="'+sound+'"]');
  if(await chip.count()){if(await chip.getAttribute('aria-pressed')!=='true')await chip.click();}else await page.locator('#obSounds .sound').filter({hasText:new RegExp('^'+sound+'$')}).click();
}
// The optional email step (13 Oct 2026: before the price): Skip, or an
// address typed and Continue.
async function updates(page,email=null){await page.locator('[data-step="updates"].on').waitFor();await calm(page);if(email){await page.locator('#updEmail').fill(email);await next(page);}else await page.locator('#updSkip').click();}
// From the sound picker (with a sound chosen) or the minutes question, on to
// "<Name>'s practice is ready!" (through the email step, when it is asked)…
async function toReady(page,minutes='skip',email=null){for(let i=0;i<8;i++){const s=await screen(page);if(s==='ready')break;if(s==='minutes')await answerMinutes(page,minutes);else if(s==='updates')await updates(page,email);else if(s==='sounds')await next(page);else throw new Error('toReady cannot walk on from '+s);}await page.locator('[data-step="ready"].on').waitFor();}
// …and past it: its Continue saves the profile and, on a phone that cannot
// buy, opens the microphone step in the page.
async function pastReady(page,minutes='skip',email=null){if(['mic','achieve'].includes(await screen(page)))return;await toReady(page,minutes,email);await next(page);await page.locator('[data-step="mic"].on').waitFor();}
const leadPosts=requests=>requests.filter(r=>r.method==='POST'&&new URL(r.url).pathname==='/api/lead').map(r=>JSON.parse(r.body));
async function notNow(page){await pastReady(page);await calm(page);await page.locator('#micNotNow').click();}
async function atHandoff(page){await page.locator('[data-step="achieve"].on').waitFor();}
// Fit is read once the fonts are in and the step's entry animation is over
// (a step's own motion always ends; a loop, if one ever came back, is left be).
async function settled(page){await page.evaluate(()=>document.fonts.ready);await page.locator('.step.on').evaluate(el=>el.getAnimations({subtree:true}).forEach(a=>{if(a.effect&&a.effect.getComputedTiming().endTime!==Infinity)a.finish();}));await page.waitForTimeout(400);}
function clean(name,errors){ok(name+': no runtime errors',errors.length===0,errors);}
function pairPosts(requests){return requests.filter(r=>new URL(r.url).pathname==='/api/pair'&&r.method==='POST');}
const priced=requests=>requests.filter(r=>new URL(r.url).pathname==='/subscribe.html').map(r=>r.url);
const HEDGE='Sona practices — it doesn\'t test or diagnose.';
// [id, the button's words, the sentence the ready screen shows for it]
// Yes, No and Not yet since 16 Oct 2026 (Travis: "add a no so there's yes, no, and then not yet")
const THERAPY=[['t_yes','Yes','Sona is practice for the days between speech visits.'],['t_none','No','Sona is practice you can do at home.'],['t_no','Not yet','Sona is practice you can do at home.']];
// [value, the button's words, the chip the ready screen shows for it]: a real setting, the daily goal
const MINUTES=[['5','5 min','5 min a day'],['10','10 min','10 min a day'],['15','15 min','15 min a day']];
// the first family's whole walk, on a phone with no reminder to offer
const FIRST_WALK='welcome,problem,reel,rachel,name,interests,games,therapy,sounds,minutes,updates,ready,mic';
// what the ready screen shows, as a parent reads it
const readyShown=page=>page.evaluate(()=>{const st=document.querySelector('[data-step="ready"]'),painted=el=>!!el&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0;return {on:st.classList.contains('on'),title:document.getElementById('readyTitle').textContent,chips:[...document.querySelectorAll('#readyChips li')].map(l=>l.textContent),lines:painted(document.getElementById('readyLines'))?[...document.querySelectorAll('#readyLines li')].map(l=>l.textContent):[],text:st.innerText.replace(/\s+/g,' ').trim(),asks:st.querySelectorAll('input,select,textarea,button,a,[role="button"]').length,cta:document.getElementById('nextBtn').textContent.trim(),enabled:!document.getElementById('nextBtn').disabled,seg:document.getElementById('seg').hidden,mascot:painted(document.querySelector('.ob .mascot')),build:!!document.getElementById('obBuild'),rachel:/Rachel/.test(st.textContent)||!!st.querySelector('img[src*="rachel"]')};});
const progress=page=>page.evaluate(()=>{const s=document.getElementById('seg');return {groups:s.children.length,lit:s.querySelectorAll('i.on').length,hidden:s.hidden,now:s.getAttribute('aria-valuenow'),max:s.getAttribute('aria-valuemax'),role:s.getAttribute('role')};});

await scenario('sound selection and private paced handoff',async()=>{
 const {context,page,errors,requests}=await fresh();try{
  // Travis, 2 Oct 2026: "take off moving from another phone enter your code"
  ok('the first screen is a hello with one button, "Get started": no question, no move-in code, no purchase pitch',await page.evaluate(()=>document.body.dataset.setupScreen==='welcome'&&!document.getElementById('moveLink')&&!document.getElementById('moveSheet')&&!/Moving from another phone|Enter your code|Bought Sona/.test(document.body.innerText)&&getComputedStyle(document.querySelector('.obfoot')).display!=='none'&&document.getElementById('nextBtn').textContent.trim()==='Get started'&&document.getElementById('backBtn').style.display==='none'));
  ok('five progress groups match the five setup questions (name, what they love, therapy, sounds, minutes)',await page.locator('#seg i').count()===5);
  ok('the younger age band includes two-year-olds',/2–4/.test(await page.locator('#obAge [data-age="4"]').innerText()));
  // the screens that sell come before the name, each with no progress segment
  {const sold=[];for(let i=0;i<5;i++){const s=await screen(page);sold.push(s);if(s==='name')break;const pr=await progress(page);sold.push(pr.hidden?'no bar':'bar');await next(page);await page.waitForFunction(k=>document.body.dataset.setupScreen!==k,s);}
  ok('the hello, then the problem, the games playing and Rachel, each with no progress segment, then the child\'s name',JSON.stringify(sold)==='["welcome","no bar","problem","no bar","reel","no bar","rachel","no bar","name"]',sold);}
  ok('…the name is the first of the five',(await progress(page)).lit===1&&!(await progress(page)).hidden);
  await page.locator('#obName').fill('Milo');await page.locator('#obAge [data-age="4"]').click();await next(page);
  ok('name and age lead to "What does <Name> love?", the second of the five',await page.locator('[data-step="interests"].on').count()===1&&(await progress(page)).lit===2&&await page.locator('#intName').innerText()==='Milo');
  await next(page);
  ok('…then the games they will love, with no progress segment',await screen(page)==='games'&&(await progress(page)).hidden);
  await next(page);
  ok('…then one tap, "Is <Name> in speech therapy?", and no direction page comes back',await page.locator('[data-step="therapy"].on').count()===1&&/^Is \S+ in speech therapy\?$/.test((await page.locator('#therapyTitle').innerText()).trim())&&await page.locator('[data-step="path"]').count()===0);
  const third=await progress(page);
  ok('…it is the third of the five: three groups lit',third.groups===5&&third.lit===3&&!third.hidden&&third.now==='3'&&third.max==='5'&&third.role==='progressbar',third);
  await answerTherapy(page);
  ok('one tap (here Skip) opens the sound choices, the fourth',await page.locator('[data-step="sounds"].on').count()===1&&(await progress(page)).lit===4);
  ok('R starts selected and the first row is R S L TH',await page.locator('#obSounds .on').getAttribute('data-sound')==='R'&&JSON.stringify(await page.locator('#obSounds .sound').evaluateAll(bs=>bs.slice(0,4).map(b=>b.dataset.sound)))==='["R","S","L","TH"]');
  const choices=await page.evaluate(()=>({labels:[...document.querySelectorAll('#obSounds .sound')].map(b=>({text:b.textContent.trim(),label:Sona.soundLabel(b.dataset.sound),font:parseFloat(getComputedStyle(b.querySelector('span')||b).fontSize),width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})),copy:document.querySelector('[data-step="sounds"]').textContent,overflow:document.documentElement.scrollWidth>innerWidth}));
  ok('sound choices show large letters without example words',choices.labels.length===19&&choices.labels.every(b=>b.text===b.label&&b.font>=23),choices.labels);
  ok('sound selection stays concise and uses no clinician terminology',choices.copy.trim().split(/\s+/).length<65&&!/\bSLPs?\b|speech-language|pathologist/i.test(choices.copy),choices.copy);
  ok('sound buttons remain easy to tap without overflowing a small phone',!choices.overflow&&choices.labels.every(b=>b.width>=44&&b.height>=44),choices);
  await choose(page);ok('selecting a target enables Continue',await page.locator('#nextBtn').isEnabled());
  await page.locator('#obSounds [data-sound="R"]').click();ok('the last selected target can be cleared',await page.locator('#obSounds .on').count()===0&&await page.locator('#nextBtn').isDisabled());
  await choose(page,'S');await next(page);
  ok('after the sounds comes the second one-tap question, "How long each day?", the last of the five groups',await page.locator('[data-step="minutes"].on').count()===1&&(await progress(page)).lit===5);
  await answerMinutes(page);
  {const at=await page.evaluate(()=>({screen:document.body.dataset.setupScreen,seg:document.getElementById('seg').hidden,groups:document.querySelectorAll('#seg i').length,input:document.activeElement.id}));
  ok('after the five questions, the optional email step: no progress segment of its own, and the box is not focused',at.screen==='updates'&&at.seg&&at.groups===5&&at.input!=='updEmail',at);}
  await updates(page);await page.locator('[data-step="ready"].on').waitFor();
  // THE READY SCREEN repeats back what the parent picked and nothing else
  // (both questions were skipped here, so no sentence about Sona is shown).
  const ready=await readyShown(page);
  ok('ready shows the name, the age band and the chosen sound, and nothing the parent did not give',ready.on&&ready.title==='Milo\'s practice is ready!'&&JSON.stringify(ready.chips)==='["Ages 2–4","Sound: S"]'&&ready.lines.length===0&&ready.text==='Milo\'s practice is ready! Ages 2–4 Sound: S '+HEDGE,ready);
  ok('…with no build beat on the parent path, no progress bar, no Echo beside it (he cheers above it) and no Rachel (she has her own screen)',!ready.build&&ready.seg&&!ready.mascot&&!ready.rachel,ready);
  await page.waitForTimeout(1200);
  const waited=await page.evaluate(()=>({screen:document.body.dataset.setupScreen,saved:!!Sona.getProfile().onboarded,complete:__setup.complete,confetti:__setup.confetti,requests:__setup.requests.length}));
  ok('ready waits for the parent: it does not move on or save by itself',waited.screen==='ready'&&!waited.saved&&waited.requests===0,waited);
  ok('setup does not spend the first-win celebration',waited.complete===0&&waited.confetti===0,waited);
  await next(page);await page.locator('[data-step="mic"].on').waitFor();
  const kept=await page.evaluate(()=>({profile:Sona.getProfile(),requests:__setup.requests.length,draft:localStorage.getItem('sona.obdraft.v1'),back:getComputedStyle(document.getElementById('backBtn')).display,seg:document.getElementById('seg').hidden,handoff:document.querySelectorAll('[data-step="achieve"].on').length}));
  ok('Continue on ready saves the choices before any microphone ask',kept.profile.onboarded&&JSON.stringify(kept.profile.focusSounds)==='["S"]'&&kept.profile.childName==='Milo'&&kept.requests===0&&kept.draft===null,kept);
  ok('…and from there the questions are behind them: no Back, no progress bar, on the microphone step',kept.back==='none'&&kept.seg&&kept.handoff===0,kept);
  // Travis, 2 Oct 2026: "the grown-ups explanation ... is still too long ... just
  // say audio is never recorded or uploaded". Short, and still true: one try a
  // day IS saved on the phone for a parent to play back, so never "never recorded".
  const promise=await page.evaluate(()=>({visible:document.getElementById('micPromise')?.textContent||'',shared:Sona.MIC_PROMISE||'',title:document.querySelector('[data-step="mic"] .qh').innerText}));
  ok('setup renders the shared accurate microphone promise, in a couple of short lines',!!promise.shared&&promise.visible===promise.shared&&/never uploaded/.test(promise.visible)&&/saved on this phone/.test(promise.visible)&&!/never recorded/i.test(promise.visible)&&promise.visible.split(/\s+/).length<=20,promise.visible);
  ok('…under "Let Echo hear <Name>"',promise.title==='Let Echo hear Milo',promise.title);
  ok('microphone action is explicit and offers a quiet skip',/Turn on Echo's ears/.test(await page.locator('#nextBtn').innerText())&&await page.locator('#micNotNow').count()===1);
  await notNow(page);await atHandoff(page);
  ok('Not now on the mic opens the hand-off, with no build beat in between',await page.locator('[data-step="achieve"].on').count()===1&&await page.locator('#obBuild').count()===0);
  ok('handoff is personalized and its button is ready, with nothing to wait out but the half second every new screen takes',await page.locator('#handoffTitle').count()===1&&/Hand the phone to Milo!/.test(await page.locator('#handoffTitle').innerText())&&await page.locator('#nextBtn').isEnabled());
  const result=await page.evaluate(()=>({profile:Sona.getProfile(),mic:localStorage.getItem('sona.micok'),requests:__setup.requests.length,speech:__setup.speech,media:__setup.media,recommended:Sona.activityLibrary().recommended,firstgame:sessionStorage.getItem('sona.firstgame.v1')}));
  ok('Not now saves choices without asking or pretending microphone permission',result.requests===0&&result.mic!=='1'&&result.profile.onboarded&&JSON.stringify(result.profile.focusSounds)==='["S"]',result);
  ok('the first game is not marked until the hand-off\'s own tap',result.firstgame===null,result.firstgame);
  ok('the handoff does not send the child name into generated speech',result.speech.every(t=>!t.includes('Milo')));
  ok('setup and the handoff stay silent even with voice enabled: no spoken line, and no recording played without a tap of "Hear Echo"',result.speech.length===0&&result.media.length===0,[result.speech,result.media]);
  await page.waitForTimeout(3200);
  ok('the family controls when the handoff ends',new URL(page.url()).pathname==='/onboarding.html');
  ok('finishing web setup never uploads an automatic backup',pairPosts(requests).length===0,pairPosts(requests));
  if(new URL(page.url()).pathname==='/onboarding.html'){
   const fits=await page.evaluate(()=>{const b=document.getElementById('nextBtn').getBoundingClientRect(),h=document.getElementById('handoffTitle').getBoundingClientRect();return b.bottom<=innerHeight&&h.top>=0&&document.documentElement.scrollWidth<=innerWidth;});ok('handoff heading and button fit a small phone',fits);
   ok('young-child setup prepares the Simple play suggestion on Home',result.recommended==='simple',result.recommended);
   ok('the hand-off asks for nothing: no email box and no ×',await page.evaluate(()=>!document.getElementById('achEmail')&&!document.getElementById('achEmailInput')&&!document.getElementById('skipEmail')&&!document.querySelector('[data-step="achieve"] input')));
   await next(page);await page.waitForURL(url=>['/today.html','/charge.html','/arcade-feed.html'].includes(url.pathname));const u=new URL(page.url());
   // Travis, 27 Sep 2026: setup goes straight to the first game, Feed Echo for ages 3-4
   ok('handoff opens the first game for the child\'s age: Feed Echo at 4',u.pathname==='/arcade-feed.html'&&!u.search&&await page.evaluate(()=>sessionStorage.getItem('sona.firstgame.v1')==='feed'));
   ok('setup creates no run and starts no practice of its own',!requests.some(r=>new URL(r.url).pathname==='/charge.html')&&await page.evaluate(()=>!sessionStorage.getItem('sona.run.v1')));
   ok('a skipped email step saves no address and posts nothing',await page.evaluate(()=>!JSON.parse(localStorage.getItem('sona.profile.v1')).email)&&leadPosts(requests).length===0,leadPosts(requests));
   ok('…and the tab\'s "after the price" marker is gone once the game opens',await page.evaluate(()=>sessionStorage.getItem('sona.setupafter.v1')===null));
  }
  ok('a phone that cannot buy is never sent to the price',priced(requests).length===0,priced(requests));
  clean('sound/skip handoff',errors);
 }finally{await context.close();}
});

// The first screen is a hello (Travis, 2 Oct 2026: "that first page with the
// bird just have that be a fun page and then they can just press a button on
// the bottom"), and setup is for parents (5 Oct 2026): nobody is asked who is
// setting Sona up.
await scenario('a hello first; setup is for parents',async()=>{
 {const {context,page,errors,requests}=await fresh();try{
  const hello=await page.evaluate(()=>({screen:document.body.dataset.setupScreen,text:document.querySelector('[data-step="welcome"]').innerText.replace(/\s+/g,' ').trim(),label:document.querySelector('.welcome-brand').getAttribute('aria-label'),cta:document.getElementById('nextBtn').textContent.trim(),footer:getComputedStyle(document.querySelector('.obfoot')).display,seg:document.getElementById('seg').hidden}));
  ok('the very first screen is a hello: Sona\'s name, its line and one button, no question',hello.screen==='welcome'&&/^Sona Speech practice kids love\.$/.test(hello.text)&&!/\?/.test(hello.text)&&hello.label==='Sona. Speech practice kids love.'&&hello.cta==='Get started'&&hello.footer!=='none'&&hello.seg,hello);
  await next(page);
  ok('"Get started" opens the problem: nobody is asked who is setting Sona up, and no clinician answer is on the page',await page.evaluate(()=>document.body.dataset.setupScreen==='problem'&&!document.querySelector('[data-step="who"]')&&!document.querySelector('.who-pick')&&!/SLP or SLPA/.test(document.body.innerText)));
  await calm(page);await page.locator('#backBtn').click();
  ok('Back returns to the hello, where there is no Back',await page.locator('[data-step="welcome"].on').count()===1&&await page.locator('#backBtn').isHidden());
  await toName(page);
  {const at=await page.evaluate(()=>({on:(document.querySelector('.step.on')||{}).dataset.step,title:document.querySelector('[data-step="name"] .qh').innerText,segs:document.querySelectorAll('#seg i').length,lit:document.querySelectorAll('#seg i.on').length,role:draft.role,parent:ORDER===ORDER_PARENT}));
  ok('a parent reaches the child\'s name, the first of five progress segments',at.on==='name'&&at.title==='Who\'s practicing?'&&at.segs===5&&at.lit===1&&at.role==='parent'&&at.parent,at);}
  await calm(page);await page.locator('#backBtn').click();
  ok('Back from the name returns to Rachel\'s screen',await page.locator('[data-step="rachel"].on').count()===1);
  await who(page,'slp');
  ok('a clinician\'s setup still opens from its own address in a browser (/onboarding.html?slp=1), in a clinician\'s words',await page.evaluate(()=>draft.role==='slp'&&ORDER===ORDER_SLP&&document.body.dataset.setupScreen==='name'&&/Which child/.test(document.querySelector('[data-step="name"] .qh').textContent)&&document.getElementById('slpAppNote').hidden));
  ok('…and no clinician request is made just by answering',!requests.some(r=>new URL(r.url).pathname.startsWith('/api/slp/')),requests.map(r=>r.url));
  clean('first question',errors);
 }finally{await context.close();}}
 // The iPhone app never opens clinician screens (NATIVE.md): an SLP sets the
 // app up for a child, in a clinician's words, and is told where the dashboard
 // is. They are not asked the family questions, are never shown a price,
 // and end on Home, not in a game.
 {const {context,page,errors,requests}=await fresh({native:true});try{
  await who(page,'slp');
  const st=await page.evaluate(()=>({order:ORDER===ORDER_PARENT,steps:ORDER.join(),role:draft.role,screen:document.body.dataset.setupScreen,title:document.querySelector('[data-step="name"] .qh').textContent,note:document.getElementById('slpAppNote').hidden?'':document.getElementById('slpAppNote').textContent,groups:document.querySelectorAll('#seg i').length}));
  ok('in the app that address sets the app up for a child, never the clinician steps',st.order&&st.screen==='name'&&/Which child/.test(st.title),st);
  ok('…and is told the clinician dashboard is on the web, with no link and no price',/dashboard is on the web/.test(st.note)&&!/\$|price|Premium|<a/i.test(st.note),st.note);
  ok('…with no family question on their path, and two progress groups: name and sounds',st.steps==='welcome,name,sounds,ready,mic'&&st.groups===2,st);
  await page.locator('#obName').fill('Milo');await page.locator('#obAge [data-age="6"]').click();await next(page);
  ok('…the name leads straight to the sounds',await screen(page)==='sounds');
  await choose(page,'S');await next(page);
  const ready=await readyShown(page);
  ok('…then the ready screen, with what they picked and no sentence from an answer',ready.on&&ready.title==='Milo\'s practice is ready!'&&JSON.stringify(ready.chips)==='["Ages 5–6","Sounds: R · S"]'&&ready.lines.length===0,ready);
  await notNow(page);await atHandoff(page);
  ok('…finishing as an SLP with no clinician request',await page.evaluate(()=>Sona.getProfile().role==='slp'&&Sona.getProfile().onboarded)&&!requests.some(r=>new URL(r.url).pathname.startsWith('/api/slp/')),requests.map(r=>r.url));
  ok('…with no email box on the hand-off, and nothing kept as a family\'s answers',await page.evaluate(()=>!document.getElementById('achEmail')&&!document.querySelector('[data-step="achieve"] input')&&localStorage.getItem('sona.setupasks.v1')===null));
  await next(page);await page.waitForURL(url=>url.pathname!=='/onboarding.html');
  ok('…and it ends on Home: never a game, never a price',new URL(page.url()).pathname==='/today.html'&&priced(requests).length===0&&await page.evaluate(()=>sessionStorage.getItem('sona.firstgame.v1')===null),page.url());
  clean('native SLP answer',errors);
 }finally{await context.close();}}
});

// THE TWO ONE-TAP QUESTIONS: "Is <Name> in speech therapy?" (5 Oct 2026) and
// "How long each day?" (22 Oct 2026, in place of the days a week). Each is one
// tap or Skip, the answer is the button, and what is tapped changes nothing a
// child is given until the profile is saved: no sound, mode or goal moves.
// The therapy answer picks a sentence about Sona on the ready screen and is
// kept in one household key on this phone; the minutes become the daily goal
// as the profile is saved. The wording is Rachel's to change; these pin it
// word for word so a change is a decision.
await scenario('the two one-tap questions',async()=>{
 const {context,page,errors}=await fresh();try{
  const shown=key=>page.evaluate(key=>{const st=document.querySelector('[data-step="'+key+'"]'),painted=el=>getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0,group=st.querySelector('.ask');return {screen:document.body.dataset.setupScreen,title:st.querySelector('h1').textContent.trim(),help:(st.querySelector('.ask-help')||{textContent:''}).textContent.trim(),answers:[...st.querySelectorAll('.ask-pick')].map(b=>[b.dataset.val,b.textContent.trim()]),buttons:[...st.querySelectorAll('.ask-pick')].every(b=>b.tagName==='BUTTON'&&b.type==='button'),pressed:[...st.querySelectorAll('.ask-pick')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.dataset.val),skip:st.querySelector('.ask-skip').textContent.trim(),next:painted(document.getElementById('nextBtn')),back:painted(document.getElementById('backBtn')),text:st.innerText,group:group.getAttribute('role')==='group'&&group.getAttribute('aria-labelledby')===st.querySelector('h1').id,focus:document.activeElement===st.querySelector('h1'),bubble:document.getElementById('bubble').textContent};},key);
  // (the days a week: the profile's and what goalDays reads; setup holds none of its own since 22 Oct 2026)
  const untouched=()=>page.evaluate(()=>JSON.stringify([draft.mode,draft.pathReason,draft.focusSounds,Sona.getProfile().weeklyGoal,Sona.goalDays(),Sona.getProfile().onboarded,Sona.getProfile().dailyGoal,localStorage.getItem('sona.setupasks.v1')]));
  await setupWalk(page,'therapy',{name:'Milo',age:'4'});
  for(const q of [{key:'therapy',title:'Is Milo in speech therapy?',list:THERAPY,pick:'t_no',after:'sounds',bubble:'I\'m glad you\'re here!',help:/^Your answer stays on this phone\.$/,says:'it says the answer stays on this phone'},{key:'minutes',title:'How long each day?',list:MINUTES,pick:'10',after:'updates',bubble:'',help:/^$/,says:'it has no help line: the heading and three answers are the screen'}]){
   const s=await shown(q.key);
   ok(q.key+': the heading is exactly "'+q.title+'"',s.screen===q.key&&s.title===q.title,s);
   ok(q.key+': its answers, in order, word for word, each a real button',JSON.stringify(s.answers)===JSON.stringify(q.list.map(a=>[a[0],a[1]]))&&s.buttons&&s.pressed.length===0,s.answers);
   ok(q.key+': Skip is offered, and Continue is not painted until an answer is held; Back is',s.skip==='Skip'&&!s.next&&s.back,s);
   ok(q.key+': '+q.says,q.help.test(s.help),s.help);
   ok(q.key+': short, and in no clinician\'s or tester\'s words',s.text.trim().split(/\s+/).length<=40&&!/SLP|pathologist|certified|delay|disorder|behind|diagnos|assess/i.test(s.text),s.text);
   ok(q.key+': the answers are one labelled group, the heading takes focus, and Echo says '+(q.bubble?'"'+q.bubble+'"':'nothing'),s.group&&s.focus&&s.bubble===q.bubble,s);
   const before=await untouched();
   // (calmed first, so it is the no-answer rule that stops it and not the half-second pause)
   await calm(page);await page.evaluate(()=>next());
   ok(q.key+': a stray Continue with no answer held does nothing',await screen(page)===q.key);
   await answer(page,q.key,q.pick);
   ok(q.key+': a tap stores that answer\'s id in the draft and moves on',await screen(page)===q.after&&await page.evaluate(k=>draft[k],q.key)===q.pick&&await page.evaluate(k=>JSON.parse(localStorage.getItem('sona.obdraft.v1'))[k],q.key)===q.pick);
   ok(q.key+': the answer changes no sound, mode, reason or goal, and saves no profile',await untouched()===before,[before,await untouched()]);
   await calm(page);await page.locator('#backBtn').click();
   const held=await shown(q.key);
   ok(q.key+': coming Back, the held answer shows pressed and Continue is painted',held.screen===q.key&&JSON.stringify(held.pressed)===JSON.stringify([q.pick])&&held.next&&held.back,held);
   await answer(page,q.key,'skip');
   ok(q.key+': Skip stores no answer and moves on',await screen(page)===q.after&&await page.evaluate(k=>draft[k],q.key)==='');
   await calm(page);await page.locator('#backBtn').click();
   const cleared=await shown(q.key);
   ok(q.key+': …and Back after a Skip shows nothing pressed and no Continue',cleared.pressed.length===0&&!cleared.next,cleared);
   await answer(page,q.key,q.pick);
   if(q.key==='therapy'){await choose(page,'S');await next(page);}
  }
  await updates(page);await page.locator('[data-step="ready"].on').waitFor();
  // both answered: the ready screen shows one sentence about Sona, and the minutes
  let ready=await readyShown(page);
  ok('the ready screen then shows the therapy answer\'s one sentence about Sona, never one about the child, and the minutes picked',JSON.stringify(ready.lines)===JSON.stringify([THERAPY[2][2]])&&ready.chips.indexOf(MINUTES[1][2])>-1&&ready.lines.every(l=>/^(In )?Sona\b/.test(l)&&!/Milo|your child|\b(he|she|they)\b/i.test(l)),[ready.lines,ready.chips]);
  // AN ANSWER SURVIVES AN INTERRUPTION: the draft holds both, and a reload
  // (which starts a parent at the hello again) shows them pressed.
  await page.reload();
  ok('a reload keeps both answers in the draft',await page.evaluate(()=>draft.therapy==='t_no'&&draft.minutes==='10'));
  await setupWalk(page,'therapy',{name:'Milo',age:'4'});
  let again=await shown('therapy');
  ok('…the first shows pressed, with Continue painted, and Continue keeps it',again.screen==='therapy'&&JSON.stringify(again.pressed)==='["t_no"]'&&again.next,again);
  await next(page);await page.locator('[data-step="sounds"].on').waitFor();await next(page);
  again=await shown('minutes');
  ok('…and so does the second',again.screen==='minutes'&&JSON.stringify(again.pressed)==='["10"]'&&again.next&&await page.evaluate(()=>draft.therapy==='t_no'),again);
  await next(page);await updates(page);await page.locator('[data-step="ready"].on').waitFor();
  // every answer has its own sentence or chip, word for word
  const table=await page.evaluate(([th,mins])=>{const lines=()=>[...document.querySelectorAll('#readyLines li')].map(l=>l.textContent),chips=()=>[...document.querySelectorAll('#readyChips li')].map(l=>l.textContent);const out={lines:[],chips:[]};th.forEach(id=>{draft.therapy=id;draft.minutes='';paintReady();out.lines.push(lines());});mins.forEach(v=>{draft.therapy='';draft.minutes=v;paintReady();out.chips.push(chips().slice(-1)[0]);});draft.therapy='';draft.minutes='';paintReady();out.none=[lines(),getComputedStyle(document.getElementById('readyLines')).display,chips().some(c=>/min a day/.test(c))];draft.therapy='t_no';draft.minutes='10';paintReady();return out;},[THERAPY.map(a=>a[0]),MINUTES.map(a=>a[0])]);
  ok('each therapy answer puts its own sentence on the ready screen, word for word',JSON.stringify(table.lines)===JSON.stringify(THERAPY.map(a=>[a[2]])),table.lines);
  ok('each minutes pick shows as its own chip',JSON.stringify(table.chips)===JSON.stringify(MINUTES.map(a=>a[2])),table.chips);
  ok('…and with neither answered there is no sentence and no minutes chip',JSON.stringify(table.none)==='[[],"none",false]',table.none);
  // a draft may not smuggle in an answer that is not one of the fixed ids
  await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('sona.obdraft.v1'));d.therapy='<b>Milo</b>';d.minutes='45';d.interests=['dragons','<i>x</i>','sports','sports'];localStorage.setItem('sona.obdraft.v1',JSON.stringify(d));});
  await page.reload();
  ok('a draft holding anything but a listed id reads as unanswered (and keeps only listed interests, once each)',await page.evaluate(()=>draft.therapy===''&&draft.minutes===''&&JSON.stringify(draft.interests)==='["sports"]'));
  ok('the page title never changes with the child or an answer',await page.title()==='Sona — Welcome');
  clean('one-tap questions',errors);
 }finally{await context.close();}
});

// THE ANSWERS STAY ON THIS PHONE (the therapy screen says so). After a whole
// walk that taps an answer on each question, nothing the page sent, queued or
// saved for another reader carries the therapy answer, its id, what the child
// loves, the child's name or the age group; and Meta's script was told, before
// it started, not to read button taps on this page (the answers ARE buttons).
await scenario('the answers stay on this phone',async()=>{
 const {context,page,errors,requests}=await fresh({viewport:{width:375,height:667}});try{
  const head=await page.evaluate(()=>{const tag=document.querySelector('script[src="/pixel.js"]');return {attr:tag&&tag.getAttribute('data-autoconfig'),first:window.fbq&&fbq.queue&&fbq.queue.length?Array.from(fbq.queue[0]):null};});
  ok('setup\'s pixel tag switches off Meta\'s own button-reading, before anything else is sent to it',head.attr==='off'&&JSON.stringify(head.first)==='["set","autoConfig",false,"28886011914332605"]',head);
  await enter(page,{name:'Zephyrine',age:'6',therapy:'t_yes',interests:['sports','dinosaurs']});await choose(page,'R');await toReady(page,'10','parent@example.com');
  {const rs=await readyShown(page);ok('the walk answered both questions',JSON.stringify(rs.lines)===JSON.stringify([THERAPY[0][2]])&&rs.chips.indexOf(MINUTES[1][2])>-1,rs);}
  const beforeReady=leadPosts(requests).length;
  await next(page);await page.locator('[data-step="mic"].on').waitFor();
  const afterReady=leadPosts(requests).length;
  ok('the email typed on its step is posted once, when the parent leaves the ready screen, and not before',beforeReady===0&&afterReady===1,[beforeReady,afterReady]);
  await notNow(page);await atHandoff(page);
  const names=await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>/Zephyrine/.test(b.textContent+' '+b.id+' '+b.className+' '+(b.value||''))).length);
  const kept=await page.evaluate(()=>({asks:localStorage.getItem('sona.setupasks.v1'),read:Sona.setupAsks(),profile:localStorage.getItem('sona.profile.v1'),days:Sona.goalDays(),backup:Sona.exportString(),draft:localStorage.getItem('sona.obdraft.v1'),fbq:JSON.stringify(Array.from(fbq.queue).map(a=>Array.from(a))),posthog:Array.from(window.posthog).filter(c=>Array.isArray(c)).map(c=>Array.from(c)),title:document.title}));
  await next(page);await page.waitForURL(url=>url.pathname==='/charge.html');
  ok('the answers are kept in one household key, as fixed ids',kept.asks==='{"v":2,"therapy":"t_yes"}'&&kept.read.asked===true&&kept.read.therapy==='t_yes',kept.asks);
  // (the therapy answer's ids and the words that would give it away, what the
  // child loves, the name and the age group; "Yes" alone is in too many honest places to scan for)
  const SECRET=new RegExp(THERAPY.map(a=>a[0]).concat(['Not yet','speech therapy','in therapy','Zephyrine','Ages 5–6','sports','dinosaurs']).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'i');
  const leaks=requests.filter(r=>SECRET.test(decodeURIComponent(r.url))||SECRET.test(r.body||'')).map(r=>r.url);
  ok('no request to any host, in its address or its body, carries an answer, an answer\'s id, what the child loves, the child\'s name or the age group',leaks.length===0,leaks);
  ok('…nor does anything queued for Meta or for PostHog',!SECRET.test(kept.fbq)&&!SECRET.test(JSON.stringify(kept.posthog)),[kept.fbq,kept.posthog]);
  const steps=kept.posthog.filter(c=>c[0]==='capture'&&c[1]==='setup step').map(c=>c[2]);
  ok('one "setup step" per screen reached, saying which screen and nothing else',JSON.stringify(steps.map(p=>p.step))===JSON.stringify(FIRST_WALK.split(',').concat(['handoff']))&&steps.every(p=>JSON.stringify(Object.keys(p).sort())==='["native","step"]'),steps);
  ok('the saved profile has no field for the therapy answer, and a backup carries neither that answer nor a draft',!/"therapy"|t_yes|t_none|t_no/.test(kept.profile)&&!/setupasks|obdraft|t_yes|t_none|t_no/.test(kept.backup)&&kept.draft===null,kept.profile);
  // the days a week are not asked (22 Oct 2026), so setup writes none: the
  // default 4 is goalDays()'s, and the weekly report names no plan nobody picked
  ok('…while the minutes picked ARE the daily goal (10 min, 60 reps), a real setting on the profile; the days a week, never asked, are not written (the default 4 is read, not saved)',/"dailyGoal":60\b/.test(kept.profile)&&/"dailyMinutes":10\b/.test(kept.profile)&&!/"weeklyGoal"/.test(kept.profile)&&kept.days===4,kept.profile);
  ok('…and what the child loves is on the profile as ids',/"interests":\["sports","dinosaurs"\]/.test(kept.profile),kept.profile);
  const lead=leadPosts(requests);
  ok('the one lead (the email step\'s address) is the grown-up\'s email, a role and campaign tags: today\'s fields exactly, from inside the app',lead.length===1&&JSON.stringify(Object.keys(lead[0]).sort())===JSON.stringify(['email','role','source','summary'])&&lead[0].email==='parent@example.com'&&lead[0].role==='parent'&&lead[0].source==='app-setup'&&lead[0].summary==='New parent (weekly report opt-in)',lead);
  ok('…and the address is on the profile, where a purchase\'s plan post finds it',/"email":"parent@example\.com"/.test(kept.profile)&&/"weeklyEmail":true/.test(kept.profile),kept.profile);
  const reports=requests.filter((r)=>r.method==='POST'&&new URL(r.url).pathname==='/api/report').map((r)=>JSON.parse(r.body));
  ok('…with the weekly progress report asked for (REPORT1 sends only for weeklyReport): setup posts it once, so the confirm email comes now, with no name in it',/"weeklyReport":true/.test(kept.profile)&&reports.length===1&&reports[0].email==='parent@example.com'&&!/Zephyrine|childName|childAge/.test(JSON.stringify(reports[0])),reports);
  ok('no button on the hand-off holds the child\'s name, and the title is still "Sona — Welcome"',names===0&&kept.title==='Sona — Welcome',[names,kept.title]);
  clean('answers stay on the phone',errors);
 }finally{await context.close();}
});

// "<NAME>'S PRACTICE IS READY!" repeats what the parent picked, with Echo
// cheering and the line that Sona does not test or diagnose. Rachel is no
// longer on it (22 Oct 2026: her own screen, setupscreenstest). The browser
// clinician setup never shows it.
async function atReady(page,{name='Milo',age='4',sound='S',therapy='t_no',minutes='15'}={}){await enter(page,{name,age,therapy});await choose(page,sound);await toReady(page,minutes);}
const readyFit=()=>{const ob=document.querySelector('.ob'),c=document.querySelector('[data-step="ready"]').getBoundingClientRect(),b=document.querySelector('#nextBtn').getBoundingClientRect(),h=document.querySelector('.ready-hedge').getBoundingClientRect();return {scrollHeight:ob.scrollHeight,height:ob.clientHeight,cardTop:c.top,cardBottom:c.bottom,buttonTop:b.top,buttonBottom:b.bottom,hedgeTop:h.top,hedgeBottom:h.bottom,obSideways:ob.scrollWidth-ob.clientWidth,sideways:document.documentElement.scrollWidth-innerWidth,innerHeight};};
await scenario('the ready screen, right before the reminder, the price or the microphone',async()=>{
 {const {context,page,errors}=await fresh();try{
  await atReady(page);
  const shown=await page.locator('[data-step="ready"]').evaluate(el=>({page:document.body.innerText,echo:(el.querySelector('.ready-echo img')||{}).getAttribute?el.querySelector('.ready-echo img').getAttribute('src'):'',asks:el.querySelectorAll('input,select,textarea,button').length,hedge:el.querySelector('.ready-hedge').textContent}));
  ok('ready: Echo cheers above it, and it says Sona does not test or diagnose',/echo-cheer\.webp$/.test(shown.echo)&&shown.hedge===HEDGE,shown);
  ok('no CCC, certification or claim that a fellowship is behind anyone',!/\bCCC\b|certified|fully licen[sc]ed/i.test(shown.page),shown.page);
  ok('it asks nothing: Continue is ready and the progress bar is hidden',shown.asks===0&&(await page.locator('#nextBtn').innerText()).trim()==='Continue'&&await page.locator('#nextBtn').isEnabled()&&await page.locator('#seg').isHidden());
  const honest=(await readyShown(page)).text;
  ok('the screen reads as what the parent picked, never as a result: no plan, recommendation, score, norm, price or promise',!/recommend|we think|based on|assess|evaluat|score|result|usually by|\bplan\b|\$|\bfree\b/i.test(honest)&&(honest.match(/diagnos/gi)||[]).length===1,honest);
  ok('…and it is exactly the name, the age group, the sound, the minutes, the one sentence and the hedge',honest==='Milo\'s practice is ready! Ages 2–4 Sounds: R · S 15 min a day '+THERAPY[2][2]+' '+HEDGE,honest);
  await calm(page);await page.locator('#backBtn').click();ok('Back from ready returns to the email step',await page.locator('[data-step="updates"].on').count()===1);
  await calm(page);await page.locator('#backBtn').click();ok('…and Back again to the minutes question, with its answer held',await page.locator('[data-step="minutes"].on').count()===1&&await page.locator('#seg').isVisible()&&await page.locator('#obMinutes [aria-pressed="true"]').getAttribute('data-val')==='15');
  await next(page);await updates(page);await page.locator('[data-step="ready"].on').waitFor();
  await next(page);
  ok('Continue goes on to the microphone: the hand-off card is not showing and no microphone grant is recorded',await page.locator('[data-step="mic"].on').count()===1&&await page.locator('[data-step="achieve"].on').count()===0&&await page.evaluate(()=>localStorage.getItem('sona.micok')!=='1'));
  await calm(page);await page.locator('#micNotNow').click();await atHandoff(page);
  ok('…and the microphone to the hand-off, then the game',await page.locator('[data-step="achieve"].on').count()===1&&await page.evaluate(()=>Sona.getProfile().onboarded));
  clean('ready',errors);
 }finally{await context.close();}}
 {const {context,page,errors}=await fresh();try{
  await who(page,'slp');   // (before the watcher: it opens the clinician's own address)
  await page.evaluate(()=>{window.__screens=[document.body.dataset.setupScreen];new MutationObserver(()=>__screens.push(document.body.dataset.setupScreen)).observe(document.body,{attributes:true,attributeFilter:['data-setup-screen']});});
  await page.locator('#obName').fill('Milo');await page.locator('#obAge [data-age="4"]').click();await next(page);await choose(page,'S');await next(page);
  const screens=await page.evaluate(()=>__screens);
  ok('the clinician setup never shows ready, Rachel\'s screen, a screen that sells, or a family question, forward or back',screens.includes('name')&&!screens.some(k=>['ready','therapy','minutes','rachel','problem','reel','interests','games','remind'].includes(k))&&await page.locator('[data-step="slp"].on').count()===1&&await page.locator('[data-step="ready"]').isHidden(),screens);
  ok('…and keeps its four progress groups',await page.locator('#seg i').count()===4);
  clean('clinician skips ready',errors);
 }finally{await context.close();}}
 {const {context,page,errors}=await fresh();try{
  // Settings → Add a child: the household already has a child, and this
  // family has been asked its questions (or is past them).
  await page.evaluate(()=>localStorage.setItem('sona.kids.v1',JSON.stringify({active:'k2',list:[{slot:'',name:'Milo'},{slot:'k2',name:'Rosie'}]})));await page.reload();
  ok('a second child\'s setup has two progress groups and no family question',await page.evaluate(()=>ORDER.join()==='welcome,name,sounds,ready,mic'&&document.querySelectorAll('#seg i').length===2));
  await toName(page);await page.locator('#obName').fill('Rosie');await page.locator('#obAge [data-age="4"]').click();await next(page);
  ok('…the hello leads to the name, and the name straight to the sounds',await screen(page)==='sounds'&&(await progress(page)).lit===2);
  await choose(page,'S');await next(page);
  const ready=await readyShown(page);
  ok('…then ready, with this child\'s name and picks and no sentence from an answer',ready.on&&ready.title==='Rosie\'s practice is ready!'&&JSON.stringify(ready.chips)==='["Ages 2–4","Sounds: R · S"]'&&ready.lines.length===0,ready);
  await next(page);await page.locator('[data-step="mic"].on').waitFor();await calm(page);await page.locator('#micNotNow').click();
  ok('a second child goes sounds → ready → microphone → hand-off',await page.locator('[data-step="achieve"].on').waitFor().then(()=>true,()=>false)&&await page.evaluate(()=>localStorage.getItem('sona.setupasks.v1')===null));
  clean('second child',errors);
 }finally{await context.close();}}
 // A family already asked (the household key exists, even with the answer
 // skipped) is not asked again, whichever child this is.
 {const {context,page,errors}=await fresh();try{
  await page.evaluate(()=>localStorage.setItem('sona.setupasks.v1',JSON.stringify({v:1,therapy:'',goal:''})));await page.reload();
  ok('a family already asked is not asked twice',await page.evaluate(()=>ORDER.join()==='welcome,name,sounds,ready,mic'));
  clean('asked once',errors);
 }finally{await context.close();}}
 // THE EMAIL STEP IS ASKED ONCE, and only while the household has no parent
 // email: a family whose phone already holds one (Sona.parentEmail) is not
 // asked for it again, though it still meets the questions.
 {const {context,page,errors}=await fresh();try{
  await page.evaluate(()=>{localStorage.setItem('sona.kids.v1',JSON.stringify({active:'k2',list:[{slot:'',name:'Milo'},{slot:'k2',name:'Rosie'}],hi:2}));localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Milo',email:'mom@example.com',onboarded:true,voiceOn:false,soundOn:false}));});await page.reload();
  ok('a second child is never asked for the email',await page.evaluate(()=>Sona.parentEmail()==='mom@example.com'&&ORDER.indexOf('updates')<0));
  await page.evaluate(()=>localStorage.setItem('sona.kids.v1',JSON.stringify({active:'',list:[{slot:'',name:'Milo'}]})));await page.reload();
  ok('a household that already has a parent email meets the questions but not the email step (a set-up child walking setup again: nor the screens that sell)',await page.evaluate(()=>ORDER.join()==='welcome,name,therapy,sounds,minutes,ready,mic'));
  clean('email asked once',errors);
 }finally{await context.close();}}
 {const {context,page,errors}=await fresh();try{
  await who(page,'slp');
  ok('the browser clinician never sees the email step: their own account email is a step of its own',await page.evaluate(()=>ORDER===ORDER_SLP&&ORDER.indexOf('updates')<0&&ORDER.indexOf('email')>-1));
  clean('clinician: no email step',errors);
 }finally{await context.close();}}
 // No age picked, two sounds, and the "explore" path: the chips say only what was given.
 {const {context,page,errors}=await fresh();try{
  await enter(page,{name:'Ava',age:''});await choose(page,'S');await toReady(page);
  let ready=await readyShown(page);
  ok('with no age picked there is no age chip, and two sounds read "Sounds: R · S" (minutes skipped: no minutes chip)',JSON.stringify(ready.chips)==='["Sounds: R · S"]',ready.chips);
  await calm(page);await page.locator('#backBtn').click();await calm(page);await page.locator('#backBtn').click();await calm(page);await page.locator('#backBtn').click();await calm(page);await page.locator('#obExploreSounds').click();await toReady(page);
  ready=await readyShown(page);
  ok('a family who explores every sound reads "Every sound, easiest first", never a list Sona chose',ready.title==='Ava\'s practice is ready!'&&JSON.stringify(ready.chips)==='["Every sound, easiest first"]',ready.chips);
  clean('ready chips',errors);
 }finally{await context.close();}}
 for(const device of [{viewport:{width:320,height:568}},{viewport:{width:375,height:667}},{viewport:{width:393,height:852},safeArea:{top:59,bottom:34}},{viewport:{width:768,height:1024}},{viewport:{width:1024,height:768}},{viewport:{width:320,height:768}}]){
  const {context,page,errors}=await fresh(device),at=device.viewport.width+'×'+device.viewport.height;try{
   await atReady(page,{name:'Milo',age:'8',sound:'R'});await page.evaluate(()=>document.querySelector('.ready-echo img').decode().catch(()=>{}));await settled(page);
   const fit=await page.evaluate(readyFit);
   ok('ready fits without scrolling, card clear of Continue, at '+at,fit.scrollHeight<=fit.height+1&&fit.cardTop>=0&&fit.cardBottom+12<=fit.buttonTop&&fit.buttonTop>=0&&fit.buttonBottom<=fit.innerHeight&&fit.sideways<=0&&fit.obSideways<=0,fit);
   if(device.viewport.width===320&&device.viewport.height===568){
    // the stress case: a 12-letter name and three sounds
    await page.evaluate(()=>{nameEl.value='Christopherr';['S','L'].forEach(s=>document.querySelector('#obSounds [data-sound="'+s+'"]').click());paintReady();});await settled(page);
    const stress=await page.evaluate(readyFit),chips=(await readyShown(page)).chips;
    ok('a 12-letter name and three sounds at 320×568: at most a short scroll, and the hedge fully on screen without it',JSON.stringify(chips.slice(0,2))==='["Ages 7+","Sounds: R · S · L"]'&&chips.length<=3&&stress.scrollHeight-stress.height<=48&&stress.hedgeTop>=0&&stress.hedgeBottom<=stress.buttonTop&&stress.sideways<=0&&stress.obSideways<=0,stress);
    await page.evaluate(()=>{nameEl.value='Wolfeschlegelsteinhaus';paintReady();});await settled(page);
    const long=await page.evaluate(readyFit);
    ok('a 22-letter unbroken name at 320 wide never scrolls the screen sideways',long.sideways<=0&&long.obSideways<=0,long);
   }
   clean('ready fit '+at,errors);
  }finally{await context.close();}
 }
});

// The questions' answers are the buttons, so each must be easy to hit and the
// screen must hold still: no scrolling, no wrapped answer, clear of the footer.
await scenario('the one-tap questions fit every screen, answered and not',async()=>{
 const askFit=key=>{const ob=document.querySelector('.ob'),st=document.querySelector('[data-step="'+key+'"]'),painted=el=>getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0,nb=document.getElementById('nextBtn'),foot=painted(nb)?nb:document.getElementById('backBtn');const lines=b=>{const r=document.createRange();r.selectNodeContents(b);return new Set([...r.getClientRects()].map(x=>Math.round(x.top))).size;};return {scrollHeight:ob.scrollHeight,height:ob.clientHeight,picks:[...st.querySelectorAll('.ask-pick')].map(b=>b.getBoundingClientRect().height),lines:[...st.querySelectorAll('.ask-pick')].map(lines),skip:st.querySelector('.ask-skip').getBoundingClientRect().height,cardBottom:st.getBoundingClientRect().bottom,foot:foot.id,footTop:foot.getBoundingClientRect().top,sideways:document.documentElement.scrollWidth-innerWidth,obSideways:ob.scrollWidth-ob.clientWidth};};
 const fits=(f,foot)=>f.foot===foot&&f.scrollHeight<=f.height+1&&f.picks.length>=2&&f.picks.every(h=>h>=44&&Math.abs(h-f.picks[0])<0.5)&&f.lines.every(n=>n===1)&&f.skip>=44&&f.cardBottom+12<=f.footTop&&f.sideways<=0&&f.obSideways<=0;
 for(const device of [{viewport:{width:320,height:568}},{viewport:{width:375,height:667}},{viewport:{width:393,height:852},safeArea:{top:59,bottom:34}},{viewport:{width:768,height:1024}},{viewport:{width:1024,height:768}},{viewport:{width:320,height:768}}]){
  const {context,page,errors}=await fresh(device),at=device.viewport.width+'×'+device.viewport.height;try{
   await setupWalk(page,'therapy',{name:'Milo',age:''});
   for(const [key,pick] of [['therapy','t_no'],['minutes','5']]){
    await page.locator('[data-step="'+key+'"].on').waitFor();await settled(page);
    let fit=await page.evaluate(askFit,key);
    ok(key+' fits at '+at+': no scrolling, the answers of one height on one line each, answers and Skip at least 44 tall, the card clear of Back',fits(fit,'backBtn'),fit);
    await answer(page,key,pick);await calm(page);await page.locator('#backBtn').click();await page.locator('[data-step="'+key+'"].on').waitFor();await settled(page);
    fit=await page.evaluate(askFit,key);
    ok(key+' fits at '+at+' with an answer held: the card clear of Continue',fits(fit,'nextBtn'),fit);
    await next(page);if(key==='therapy'){await page.locator('[data-step="sounds"].on').waitFor();await next(page);}
   }
   clean('question fit '+at,errors);
  }finally{await context.close();}
 }
});

await scenario('exploring sounds stays optional and can be changed before finishing',async()=>{
 const {context,page,errors}=await fresh();try{
  await enter(page,{therapy:'t_yes'});await choose(page,'R');await calm(page);await page.locator('#obExploreSounds').click();
  ok('"Not sure? Pick all sounds" goes on (to the minutes question) without inventing targets',await page.locator('[data-step="minutes"].on').count()===1&&await page.evaluate(()=>draft.mode==='play'&&draft.pathReason==='unsure'&&draft.focusSounds.length===0));
  await calm(page);await page.locator('#backBtn').click();
  ok('Back from the minutes question returns to the same sound choices after exploring: empty, with Continue disabled',await page.locator('[data-step="sounds"].on').count()===1&&await page.locator('#obSounds .on').count()===0&&await page.locator('#nextBtn').isDisabled());
  await choose(page,'S');await next(page);
  ok('choosing a sound replaces the general-play choice',await page.evaluate(()=>draft.mode==='speech'&&draft.pathReason===''&&JSON.stringify(draft.focusSounds)==='["S"]'));
  await calm(page);await page.locator('#backBtn').click();await calm(page);await page.locator('#backBtn').click();
  ok('Back from the sound picker returns to "Is <Name> in speech therapy?" with the answer held and Continue showing',await page.locator('[data-step="therapy"].on').count()===1&&await page.locator('#obTherapy [aria-pressed="true"]').getAttribute('data-val')==='t_yes'&&await page.locator('#nextBtn').isVisible());
  for(const k of ['games','interests','name']){await calm(page);await page.locator('#backBtn').click();await page.locator('[data-step="'+k+'"].on').waitFor();}
  ok('…and on back through the games and what they love to name and age',await page.locator('[data-step="name"].on').count()===1);
  for(const k of ['interests','games','therapy','sounds']){await next(page);await page.locator('[data-step="'+k+'"].on').waitFor();}
  await notNow(page);await atHandoff(page);
  ok('the final profile keeps only the explicitly chosen sound',await page.evaluate(()=>Sona.getProfile().mode==='speech'&&JSON.stringify(Sona.getProfile().focusSounds)==='["S"]'));
  clean('explore and change',errors);
 }finally{await context.close();}
});

await scenario('Done closes typing without accepting setup choices',async()=>{
 const {context,page,errors,requests}=await fresh();try{
  await who(page,'slp');await page.locator('#obName').fill('Milo');await page.locator('#obName').press('Enter');
  const nameDone=await page.evaluate(()=>({step:document.body.dataset.setupScreen,focused:document.activeElement.id,age:draft.childAge}));
  ok('Done in the name field leaves the age choice on screen and dismisses focus',nameDone.step==='name'&&nameDone.focused!=='obName'&&nameDone.age==='',nameDone);
  // Keep the other checks useful when exercising the pre-fix page.
  if(nameDone.step!=='name'){await calm(page);await page.locator('#backBtn').click();}
  await page.locator('#obAge [data-age="4"]').click();await next(page);await choose(page,'S');await next(page);
  await page.locator('#obGoals').fill('Clear sounds in words');await page.locator('#obGoals').press('Enter');
  ok('Done in goals stays on the same setup question',await page.locator('[data-step="slp"].on').count()===1&&await page.evaluate(()=>document.activeElement.id!=='obGoals'));
  await next(page);await page.locator('#obEmail').fill('clinician@example.com');await page.locator('#obEmail').press('Enter');
  const accountPosts=()=>requests.filter(r=>r.method==='POST'&&['/api/lead','/api/slp/auth/request'].includes(new URL(r.url).pathname));
  ok('Done in clinician email dismisses focus without creating an account',await page.locator('[data-step="email"].on').count()===1&&await page.evaluate(()=>document.activeElement.id!=='obEmail'&&!Sona.getProfile().onboarded)&&accountPosts().length===0,accountPosts());
  const began=Date.now();await next(page);
  // the browser clinician keeps the calm 2-second build beat: only a parent's
  // ready screen replaced it
  const build=await page.evaluate(()=>{const b=document.getElementById('obBuild');return {shown:!!document.querySelector('#obBuild.show'),text:b?b.textContent:'',color:b?getComputedStyle(b).backgroundColor:'',complete:__setup.complete,confetti:__setup.confetti};});
  ok('the clinician\'s setup still shows its calm build beat before the hand-off: solid cream, with the actual name, age group and chosen sounds',build.shown&&/Milo/.test(build.text)&&/2–4/.test(build.text)&&/R · S/.test(build.text)&&build.color==='rgb(255, 246, 233)',build);
  ok('…which does not spend the first-win celebration',build.complete===0&&build.confetti===0,build);
  await atHandoff(page);const beat=Date.now()-began;
  ok('…and gets a short readable beat',beat>=1750,beat);
  ok('Continue still accepts the clinician email and sends each intended request once',await page.evaluate(()=>Sona.getProfile().email==='clinician@example.com')&&accountPosts().filter(r=>new URL(r.url).pathname==='/api/lead').length===1&&accountPosts().filter(r=>new URL(r.url).pathname==='/api/slp/auth/request').length===1,accountPosts());
  clean('Done actions',errors);
 }finally{await context.close();}
});

// A reload restores draft.role; the order has to follow it or a clinician
// finishes on the family path with no email step and no account.
// (The one-tap questions hide Continue, so the walk taps their first answer.)
async function walk(page){const seen=[];for(let i=0;i<20;i++){const s=await screen(page);seen.push(s);if(s==='email'||s==='mic')break;if(s==='welcome'){await who(page);continue;}if(s==='therapy'||s==='minutes'){await calm(page);await page.locator('[data-step="'+s+'"] .ask-pick').first().click();continue;}if(s==='updates'){await calm(page);await page.locator('#updSkip').click();continue;}if(s==='name'&&!await page.locator('#obName').inputValue())await page.locator('#obName').fill('Milo');await next(page);}return seen;}
await scenario('clinician setup survives a reload',async()=>{
 const {context,page,errors,requests}=await fresh();try{
  await who(page,'slp');await page.locator('#obName').fill('Milo');await next(page);
  await page.reload();
  ok('a reloaded clinician draft resumes on the clinician order at name',await page.evaluate(()=>draft.role==='slp'&&ORDER===ORDER_SLP&&document.body.dataset.setupScreen==='name'&&/Which child/.test(document.querySelector('[data-step="name"] .qh').textContent)&&document.getElementById('obName').value==='Milo'));
  const seen=await walk(page);
  ok('going on reaches the clinician email step, never the ready screen or the family mic',seen.at(-1)==='email'&&!seen.includes('ready')&&!seen.includes('mic')&&await page.locator('[data-step="ready"].on,[data-step="mic"].on').count()===0,seen);
  await page.locator('#obEmail').fill('clinician@example.com');await next(page);await atHandoff(page);
  ok('the reloaded clinician still gets an account and a sign-in email',await page.evaluate(()=>Sona.getProfile().role==='slp'&&Sona.getProfile().childName==='Milo')&&requests.filter(r=>r.method==='POST'&&new URL(r.url).pathname==='/api/slp/auth/request').length===1);
  clean('clinician reload',errors);
 }finally{await context.close();}
 const native=await fresh({native:true});try{
  // an old-flow draft: no child named in it, one child in the household
  await native.page.evaluate(()=>localStorage.setItem('sona.obdraft.v1',JSON.stringify({role:'slp',childName:'Milo'})));await native.page.reload();
  ok('a native reload with a clinician draft stays on the family order',await native.page.evaluate(()=>draft.role==='parent'&&ORDER===ORDER_PARENT));
  ok('…and an old draft that names no child still restores for a first child',await native.page.evaluate(()=>document.getElementById('obName').value==='Milo'));
  const seen=await walk(native.page);ok('native setup never reaches the clinician email step',seen.at(-1)==='mic'&&!seen.includes('email')&&!seen.includes('slp'),seen);
  ok('…it walks the family path: '+FIRST_WALK,seen.join()===FIRST_WALK,seen);
  clean('native clinician draft',native.errors);
 }finally{await native.context.close();}
 // …and a clinician who answers "SLP or SLPA" in the app walks the shorter one
 const slp=await fresh({native:true});try{
  await who(slp.page,'slp');const seen=['welcome'].concat(await walk(slp.page));
  ok('an SLP or SLPA in the app walks welcome,name,sounds,ready,mic',seen.join()==='welcome,name,sounds,ready,mic',seen);
  clean('native clinician walk',slp.errors);
 }finally{await slp.context.close();}
});


// A DRAFT BELONGS TO ONE CHILD. A setup left half done for one child used to
// open the next child's setup with a brother's name already typed in. A draft
// written by this build names its child's slot (never a name); an older one,
// with no slot, is the first child's only. And a child who is already set up
// writes no draft at all, so nothing is left behind to land on the next one.
await scenario('a setup draft belongs to one child',async()=>{
 const household=(draft)=>{localStorage.setItem('sona.kids.v1',JSON.stringify({active:'k3',list:[{slot:'',name:'Milo'},{slot:'k2',name:'Ben'},{slot:'k3',name:'Cara'}],hi:3}));localStorage.setItem('sona.profile.v1@k3',JSON.stringify({childName:'Cara',childAge:'',onboarded:false,voiceOn:false,soundOn:false}));localStorage.setItem('sona.obdraft.v1',JSON.stringify(draft));};
 const {context,page,errors}=await fresh();try{
  await page.evaluate(household,{childName:'Ben',childAge:'6',kid:'k2'});await page.reload();
  ok('a draft written for another child is not restored: the newly added child\'s setup shows her own name',await page.evaluate(()=>document.getElementById('obName').value==='Cara'&&draft.childName==='Cara'&&draft.childAge===''));
  await page.evaluate(household,{childName:'Ben',childAge:'6'});await page.reload();
  ok('an old draft that names no child is ignored once there is more than one child',await page.evaluate(()=>document.getElementById('obName').value==='Cara'));
  await page.evaluate(household,{childName:'Caro',childAge:'6',kid:'k3'});await page.reload();
  ok('her own draft is restored',await page.evaluate(()=>document.getElementById('obName').value==='Caro'&&draft.childAge==='6'));
  await toName(page);await page.locator('#obName').fill('Carol');await next(page);
  ok('…and a draft written now names the child\'s slot, never a name of its own making',await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('sona.obdraft.v1'));return d.kid==='k3'&&d.childName==='Carol';}));
  clean('draft per child',errors);
 }finally{await context.close();}
 const again=await fresh();try{
  await again.page.evaluate(()=>{localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Milo',childAge:'7',focusSounds:['S'],mode:'speech',role:'parent',onboarded:true,voiceOn:false,soundOn:false}));localStorage.removeItem('sona.obdraft.v1');});await again.page.reload();
  ok('a set-up child with no marker opens on the hello, with the profile\'s values',await again.page.evaluate(()=>document.body.dataset.setupScreen==='welcome'&&document.getElementById('obName').value==='Milo'&&document.querySelector('#obSounds .on').dataset.sound==='S'));
  await toName(again.page);await next(again.page);
  ok('…and re-walking it writes no draft',await again.page.evaluate(()=>localStorage.getItem('sona.obdraft.v1')===null));
  clean('set-up child re-walk',again.errors);
 }finally{await again.context.close();}
});

// A DOUBLE TAP NEVER LANDS ON THE NEXT SCREEN (real mouse clicks, 150 ms apart
// on one point, and no calm()). A one-tap answer swaps the screen under the
// finger: the second tap used to answer a question nobody had read, and on the
// ready screen it would press "Turn on Echo's ears" and raise the phone's
// microphone prompt.
const centre=async(page,sel)=>{const b=await page.locator(sel).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
const twice=async(page,pt)=>{await page.mouse.click(pt.x,pt.y);await page.waitForTimeout(150);await page.mouse.click(pt.x,pt.y);};
await scenario('a double tap on ready never asks for the microphone',async()=>{
 {const {context,page,errors}=await fresh({viewport:{width:375,height:667}});try{
  await enter(page);await choose(page,'S');await toReady(page);await page.waitForTimeout(500);
  await twice(page,await centre(page,'#nextBtn'));
  const st=await page.evaluate(()=>({screen:document.body.dataset.setupScreen,requests:__setup.requests.length,cta:document.getElementById('nextBtn').textContent.trim(),handoff:document.querySelectorAll('[data-step="achieve"].on').length}));
  ok('two quick taps on ready\'s Continue leave the microphone step showing, and the phone was not asked for the microphone',st.screen==='mic'&&st.requests===0&&st.cta==='Turn on Echo\'s ears'&&st.handoff===0,st);
  await page.waitForTimeout(500);await page.locator('#nextBtn').click();
  ok('…and a tap once the screen has settled does ask',await page.evaluate(()=>__setup.requests.length)===1);
  clean('double tap on ready',errors);
 }finally{await context.close();}}
});
// …NOR PAST THE HAND-OFF. Since 5 Oct 2026 nothing stands between the
// microphone step and "Hand the phone to <Name>!" for a parent (the 2-second
// build beat used to). On a phone that answers the microphone ask at once (it
// was allowed before: a second child's setup, a browser that remembers), the
// button under the finger turns from "Turn on Echo's ears" into "Let's play!";
// and "Not now" gives way to the email box, which at this size sits right
// where it was. So the hand-off settles like every other step.
await scenario('a double tap on the microphone step stops on the hand-off',async()=>{
 {const {context,page,errors}=await fresh({viewport:{width:375,height:667},permission:'grant'});try{
  await enter(page,{age:'8'});await choose(page,'S');await pastReady(page);await page.waitForTimeout(600);
  const play=await centre(page,'#nextBtn');
  await twice(page,play);await page.waitForTimeout(300);
  const st=await page.evaluate(()=>({path:location.pathname,handoff:document.querySelectorAll('[data-step="achieve"].on').length,firstgame:sessionStorage.getItem('sona.firstgame.v1'),asks:window.__setup?__setup.requests.length:-1,mic:localStorage.getItem('sona.micok'),cta:((document.getElementById('nextBtn')||{}).textContent||'').trim()}));
  ok('two quick taps on "Turn on Echo\'s ears", on a phone that allows the microphone at once, stop on the hand-off: no game opened, no first game marked',st.path==='/onboarding.html'&&st.handoff===1&&st.firstgame===null&&st.asks===1&&st.mic==='1'&&st.cta==='Let\'s play!',st);
  await page.waitForTimeout(500);
  ok('the hand-off\'s pause lifts by itself too',await page.evaluate(()=>!document.body.classList.contains('ob-settling')));
  await page.mouse.click(play.x,play.y);await page.waitForURL(url=>url.pathname==='/charge.html');
  ok('…and one tap on "Let\'s play!" once the hand-off has settled opens the first game',new URL(page.url()).search==='?game=arcade-slice.html'&&await page.evaluate(()=>sessionStorage.getItem('sona.firstgame.v1')==='slice'),page.url());
  clean('double tap on the microphone button',errors);
 }finally{await context.close();}}
 {const {context,page,errors}=await fresh({viewport:{width:375,height:667}});try{
  // THE EMAIL STEP comes up right under the finger that answered the minutes.
  // Where its box sits: go and look, then come Back to the question.
  await enter(page,{age:'8'});await choose(page,'S');await next(page);await answerMinutes(page,'15');await page.locator('[data-step="updates"].on').waitFor();await settled(page);
  const box=await page.evaluate(()=>{const r=document.getElementById('updEmail').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,painted:r.height>0};});
  await calm(page);await page.locator('#backBtn').click();await page.locator('[data-step="minutes"].on').waitFor();await page.waitForTimeout(600);
  // (the answer nearest the box: the finger that taps it is where the box comes up)
  const pick=await page.evaluate(y=>{let best=null;document.querySelectorAll('#obMinutes .ask-pick').forEach(b=>{const r=b.getBoundingClientRect(),c={x:r.left+r.width/2,y:r.top+r.height/2,d:Math.abs(r.top+r.height/2-y)};if(!best||c.d<best.d)best=c;});return best;},box.y);
  await page.mouse.click(pick.x,pick.y);await page.waitForTimeout(120);await page.mouse.click(box.x,box.y);await page.waitForTimeout(200);
  const st=await page.evaluate(()=>({screen:document.body.dataset.setupScreen,focus:document.activeElement?document.activeElement.id:'',title:document.getElementById('updTitle').getBoundingClientRect().height>0}));
  ok('a minutes answer, then a tap that lands on the email box: the email step shows with its title, and the box is not focused (no keyboard comes up over it)',box.painted&&st.screen==='updates'&&st.focus!=='updEmail'&&st.title,[box,st]);
  await page.waitForTimeout(500);await page.mouse.click(box.x,box.y);
  ok('…and the same tap, on the same spot, once the step has settled does open the email box',await page.evaluate(()=>document.activeElement.id==='updEmail'));
  clean('double tap onto the email step',errors);
 }finally{await context.close();}}
});
// A PRESS THAT IS NOT A TOUCH GETS THE SAME HALF SECOND. The pause is CSS
// (pointer-events), which a key never meets: with a keyboard attached, Enter
// twice on a focused Continue used to go through the ready screen and ask the
// phone for the microphone. The footer's button is the one control that stays
// put from screen to screen, so its handlers ask whether the screen is still
// settling. (On the hand-off the press is scripted: by then the page has moved
// focus to the title, so no second key reaches the button in this browser.)
await scenario('a key pressed twice gets the same pause as a double tap',async()=>{
 const {context,page,errors}=await fresh({viewport:{width:375,height:667},permission:'grant'});try{
  await enter(page,{age:'8'});await choose(page,'S');await toReady(page);await page.waitForTimeout(600);
  await page.locator('#nextBtn').focus();await page.keyboard.press('Enter');await page.waitForTimeout(150);await page.keyboard.press('Enter');await page.waitForTimeout(100);
  const st=await page.evaluate(()=>({screen:document.body.dataset.setupScreen,asks:__setup.requests.length,focus:document.activeElement.id,handoff:document.querySelectorAll('[data-step="achieve"].on').length,saved:Sona.getProfile().onboarded}));
  ok('Enter twice on ready\'s focused Continue stops on the microphone step, and the phone was not asked for the microphone',st.screen==='mic'&&st.asks===0&&st.focus==='nextBtn'&&st.handoff===0&&st.saved===true,st);
  await page.waitForTimeout(500);
  // one settled press asks the phone (allowed at once here, so the hand-off
  // follows in the same breath); 150 ms later the same button, now "Let's
  // play!", is pressed again. If a
  // press ever does leave the page, the page's answer never comes: that is
  // caught here and read as a failure below, once the page it left for is in
  // (a tab closed in the middle of leaving can hold this file up for minutes).
  const within=(p,ms)=>Promise.race([p,new Promise((_,no)=>setTimeout(()=>no(new Error('no answer')),ms))]);
  const pressed=await within(page.evaluate(async()=>{const b=document.getElementById('nextBtn');b.click();await new Promise(r=>setTimeout(r,150));const at={asks:__setup.requests.length,handoff:document.querySelectorAll('[data-step="achieve"].on').length,settling:document.body.classList.contains('ob-settling'),cta:b.textContent.trim(),taps:[document.querySelector('.obfoot'),document.querySelector('[data-step="achieve"]')].map(el=>getComputedStyle(el).pointerEvents).join()};b.click();return at;}),3000).catch(()=>({left:true}));
  await page.waitForTimeout(400);
  const left=await page.evaluate(()=>({path:location.pathname,firstgame:sessionStorage.getItem('sona.firstgame.v1'),disabled:!!(document.getElementById('nextBtn')||{}).disabled}));
  ok('once the screen has settled the same press does ask, and the hand-off follows',pressed.asks===1&&pressed.handoff===1&&pressed.cta==='Let\'s play!',pressed);
  ok('a press on "Let\'s play!" in the hand-off\'s first half second opens nothing and marks no first game',pressed.settling===true&&left.path==='/onboarding.html'&&left.firstgame===null&&!left.disabled,[pressed,left]);
  ok('…and for that half second the footer and the hand-off card take no tap either',pressed.taps==='none,none',pressed.taps);
  if(left.path==='/onboarding.html'){
   await page.locator('#nextBtn').click();await page.waitForURL(url=>url.pathname==='/charge.html');
   ok('…and a tap once it has settled opens the first game',new URL(page.url()).search==='?game=arcade-slice.html',page.url());
  }
  clean('keys',errors);
 }finally{await context.close();}
});
await scenario('a double tap never answers a one-tap question',async()=>{
 {const {context,page,errors}=await fresh({viewport:{width:375,height:667}});try{
  // THE SCREENS THAT SELL ARE STATEMENTS, so the footer's button is in the
  // same place on each: a double tap on it moves one screen, never past the
  // next unread. (Mouse clicks at fixed points from here on: a locator click
  // waits on the page first, and that wait would eat into the 150 ms.)
  await page.waitForTimeout(600);
  const cont=await centre(page,'#nextBtn');
  for(const [from,to] of [['welcome','problem'],['problem','reel'],['reel','rachel']]){
   await page.mouse.click(cont.x,cont.y);await page.waitForTimeout(120);await page.mouse.click(cont.x,cont.y);
   ok('a double tap on the footer\'s button on "'+from+'" moves one screen, to "'+to+'"',await page.evaluate(()=>document.body.dataset.setupScreen)===to,await screen(page));
   await page.waitForTimeout(700);
  }
  await toName(page);await page.locator('#obName').fill('Milo');await next(page);await page.locator('[data-step="interests"].on').waitFor();await page.waitForTimeout(700);
  await page.mouse.click(cont.x,cont.y);await page.waitForTimeout(120);await page.mouse.click(cont.x,cont.y);
  ok('a double tap on Continue on what the child loves moves one screen, to the games',await screen(page)==='games',await screen(page));
  // Where the first answer sits once the question shows: go and look, then come Back.
  await next(page);await page.locator('[data-step="therapy"].on').waitFor();await settled(page);
  const spot=await centre(page,'#obTherapy .ask-pick[data-val="t_yes"]');
  await calm(page);await page.locator('#backBtn').click();await page.locator('[data-step="games"].on').waitFor();await page.waitForTimeout(600);
  await page.mouse.click(cont.x,cont.y);await page.waitForTimeout(150);await page.mouse.click(spot.x,spot.y);
  ok('a tap that lands on an answer 150 ms after the question appears answers nothing',await page.evaluate(()=>document.body.dataset.setupScreen==='therapy'&&draft.therapy===''));
  await page.waitForTimeout(700);await page.mouse.click(spot.x,spot.y);
  ok('…and the same tap, on the same spot, once the screen has settled is taken (on to the sounds)',await page.evaluate(()=>document.body.dataset.setupScreen==='sounds'&&draft.therapy==='t_yes'));
  // the same for "Not sure? Pick all sounds" and the Skip that appears under the finger's reach
  await page.waitForTimeout(700);
  await next(page);await page.locator('[data-step="minutes"].on').waitFor();await settled(page);
  const skip=await centre(page,'#minutesSkip');
  await calm(page);await page.locator('#backBtn').click();await page.locator('[data-step="sounds"].on').waitFor();await page.waitForTimeout(600);
  const explore=await centre(page,'#obExploreSounds');
  await page.mouse.click(explore.x,explore.y);await page.waitForTimeout(150);await page.mouse.click(skip.x,skip.y);
  ok('"Not sure? Pick all sounds", then a tap where Skip appears: the minutes question is still waiting, unanswered',await page.evaluate(()=>document.body.dataset.setupScreen==='minutes'&&draft.mode==='play'&&draft.minutes===''&&document.querySelectorAll('[data-step="updates"].on,[data-step="ready"].on').length===0));
  await page.waitForTimeout(700);
  ok('the pause lifts by itself after about half a second',await page.evaluate(()=>!document.body.classList.contains('ob-settling')));
  await page.mouse.click(skip.x,skip.y);
  ok('…and then the same tap on Skip is taken (on to the email step)',await page.evaluate(()=>document.body.dataset.setupScreen==='updates'&&draft.minutes===''));
  clean('double tap on a question',errors);
 }finally{await context.close();}}
});

// Freeze the step-entry clock so a quick Done press happens before any delayed
// autofocus. A stale timer must not reopen the keyboard after it was dismissed.
await scenario('quick Done does not reopen the name keyboard',async()=>{
 const {context,page,errors}=await fresh({native:true,keyboardPlatform:'ios'});try{
  await page.clock.install({time:new Date('2026-09-28T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-09-28T00:00:01Z'));
  await toName(page);await page.locator('#obName').fill('Milo');await page.locator('#obName').press('Enter');
  await page.clock.fastForward(200);
  ok('Done stays dismissed after the step-entry focus window',await page.evaluate(()=>document.activeElement.id!=='obName'&&document.body.dataset.setupScreen==='name'));
  clean('quick Done',errors);
 }finally{await context.close();}
});

// These tests check the native bridge contract, not a simulated iOS keyboard.
await scenario('native iPhone keyboard integration and safe fallbacks',async()=>{
 for(const config of [{native:true,keyboardPlatform:'ios'},{native:true,keyboardPlatform:'android'},{keyboardPlatform:'web'},{native:true,keyboardPlatform:'ios',keyboardMissing:true}]){
  const {context,page,errors}=await fresh(config);try{
   const enabled=config.native&&config.keyboardPlatform==='ios'&&!config.keyboardMissing;
   const bridge=await page.evaluate(()=>({calls:__setup.keyboardCalls,listeners:Object.keys(__setup.keyboardListeners)}));
   ok('keyboard toolbar changes only inside a supported iPhone app: '+JSON.stringify(config),enabled?bridge.calls.length===1&&bridge.calls[0].isVisible===false&&bridge.listeners.includes('keyboardWillShow')&&bridge.listeners.includes('keyboardWillHide'):bridge.calls.length===0&&bridge.listeners.length===0,bridge);
   if(enabled){
    await toName(page);await page.locator('#obName').fill('Milo');await page.locator('#obName').focus();
    await page.evaluate(()=>__setup.keyboardListeners.keyboardWillShow({keyboardHeight:260}));
    ok('the native show event applies the keyboard layout without advancing setup',await page.evaluate(()=>document.body.classList.contains('keyboard-open')&&document.body.dataset.setupScreen==='name'));
    await page.locator('#obName').press('Enter');await page.evaluate(()=>__setup.keyboardListeners.keyboardWillHide());
    ok('Done dismisses focus and native hide restores the normal layout',await page.evaluate(()=>document.activeElement.id!=='obName'&&!document.body.classList.contains('keyboard-open')&&document.body.dataset.setupScreen==='name'));
   }
   clean('keyboard '+JSON.stringify(config),errors);
  }finally{await context.close();}
 }
});

await scenario('granted microphone in native setup',async()=>{
 const {context,page,errors,requests}=await fresh({permission:'grant',native:true});try{
  await enter(page,{mode:'play',age:'6',name:'Ava'});await pastReady(page);
  ok('the profile was saved on the way to the microphone, before any ask of the phone',await page.evaluate(()=>Sona.getProfile().onboarded&&__setup.requests.length===0));
  await next(page);
  await page.waitForFunction(()=>__setup.requests.length>0).catch(()=>{});
  const result=await page.evaluate(()=>({mic:localStorage.getItem('sona.micok'),order:__setup.order,tracks:__setup.tracks.map(t=>t.readyState)}));
  ok('the setup tap makes the real mic request and remembers only a grant',result.order[0]==='microphone'&&result.mic==='1',result);
  ok('every permission-check track stops before the native speech ask',result.tracks.length===2&&result.tracks.every(s=>s==='ended')&&result.order.indexOf('speech permission')>result.order.lastIndexOf('stop'),result);
  await atHandoff(page);ok('native setup finishes without a backup POST',pairPosts(requests).length===0,pairPosts(requests));
  const recommended=await page.evaluate(()=>Sona.activityLibrary().recommended);ok('older-child setup prepares the Arcade suggestion on Home',recommended==='arcade',recommended);
  clean('native microphone',errors);
 }finally{await context.close();}
});

await scenario('denied permission stays optional',async()=>{
 const {context,page,errors}=await fresh({permission:'deny'});try{
  await enter(page,{mode:'unsure'});await pastReady(page);await next(page);
  const denial=page.locator('#sonaMicDenied');await denial.waitFor({state:'visible'}).catch(()=>{});
  ok('denied permission shows recovery and never sets micok',await denial.count()===1&&await page.evaluate(()=>localStorage.getItem('sona.micok')!=='1'));
  if(await denial.count()){await page.locator('#sonaMicBack').click();await notNow(page);await atHandoff(page);ok('the grown-up can still finish with Not now',await page.locator('#nextBtn').isEnabled()&&await page.evaluate(()=>Sona.getProfile().onboarded));}
  clean('denied permission',errors);
 }finally{await context.close();}
});

await scenario('permission finishes after backgrounding',async()=>{
 const {context,page,errors}=await fresh({permission:'pending'});try{
  await enter(page,{mode:'play'});await pastReady(page);await next(page);await page.waitForFunction(()=>__setup.requests.length===1).catch(()=>{});
  const count=await page.evaluate(()=>__setup.requests.length);ok('only one permission request can be outstanding',count===1&&await page.locator('#nextBtn').isDisabled());
  // "not finished yet": the hand-off card is not showing and no grant is
  // recorded (the profile itself was saved back on the ready screen)
  if(count){await page.evaluate(()=>{__setup.background();__setup.requests[0].grant();});await page.waitForTimeout(60);const late=await page.evaluate(()=>({tracks:__setup.tracks.map(t=>t.readyState),mic:localStorage.getItem('sona.micok'),handoff:document.querySelectorAll('[data-step="achieve"].on').length,screen:document.body.dataset.setupScreen}));ok('a late grant is released without advancing hidden setup',late.tracks.every(t=>t==='ended')&&late.mic!=='1'&&late.handoff===0&&late.screen==='mic',late);await page.evaluate(()=>__setup.foreground());await notNow(page);await atHandoff(page);ok('an interrupted permission ask leaves a working skip',await page.locator('#nextBtn').isEnabled());}
  clean('late microphone',errors);
 }finally{await context.close();}
});

await scenario('sound picker fits iPhone safe areas',async()=>{
 for(const device of [{viewport:{width:393,height:852},safeArea:{top:59,bottom:34}},{viewport:{width:375,height:812},safeArea:{top:50,bottom:34}},{viewport:{width:375,height:667},safeArea:{top:20,bottom:0}}]){
  const {context,page,errors}=await fresh({...device,native:true});try{
   await enter(page);await page.evaluate(()=>document.fonts.ready);await page.locator('.step.on').evaluate(el=>el.getAnimations({subtree:true}).forEach(a=>a.finish()));
   await page.waitForTimeout(600); // Wait for the shared step/header transition to settle.
   const fit=await page.evaluate(()=>{const ob=document.querySelector('.ob'),card=document.querySelector('[data-step="sounds"]'),button=document.querySelector('#nextBtn');return {scrollHeight:ob.scrollHeight,height:ob.clientHeight,cardBottom:card.getBoundingClientRect().bottom,buttonTop:button.getBoundingClientRect().top};});
   ok('all sound choices fit above Continue with safe areas at '+device.viewport.width+'×'+device.viewport.height,fit.scrollHeight<=fit.height+1&&fit.cardBottom+12<=fit.buttonTop,fit);
   clean('safe-area sound picker',errors);
  }finally{await context.close();}
 }
});
await scenario('name and age remain visible above the iPhone keyboard',async()=>{
 const {context,page,errors}=await fresh({native:true,keyboardPlatform:'ios',viewport:{width:393,height:852},safeArea:{top:59,bottom:34}});try{
  await toName(page);await page.locator('#obName').fill('Milo');await page.setViewportSize({width:393,height:430});await page.evaluate(()=>__setup.keyboardListeners.keyboardWillShow({keyboardHeight:422}));await page.waitForTimeout(600);
  const layout=await page.evaluate(()=>{const b=document.querySelector('#nextBtn').getBoundingClientRect(),n=document.querySelector('#obName').getBoundingClientRect(),a=document.querySelector('#obAge').getBoundingClientRect();return {buttonTop:b.top,nameTop:n.top,nameBottom:n.bottom,ageBottom:a.bottom};});
  ok('typing keeps the name field and age choices clear of Continue',layout.nameTop>=59&&layout.nameBottom<layout.buttonTop&&layout.ageBottom+8<=layout.buttonTop,layout);
  clean('name keyboard fit',errors);
 }finally{await context.close();}
});
// An iPad on its side with the keyboard up, or a short window, is "landscape,
// under 500 tall": exactly what sona.js's "Turn your screen back!" cover looks
// for. It must never come up over a name being typed; and with the cover gone
// the age choices still have to be in reach above the footer.
await scenario('typing a name never raises the rotate cover, and the age choices stay in reach',async()=>{
 const {context,page,errors}=await fresh({viewport:{width:393,height:852}});try{
  await toName(page);await page.locator('#obName').fill('Milo');
  const guard=()=>page.evaluate(()=>{const g=document.getElementById('sonaPortraitGuard');return g?getComputedStyle(g).display:'missing';});
  for(const size of [{width:1024,height:370},{width:320,height:315}]){
   await page.setViewportSize(size);await page.evaluate(()=>document.body.classList.remove('keyboard-open'));
   const bare=await guard();
   await page.evaluate(()=>document.body.classList.add('keyboard-open'));
   ok('at '+size.width+'×'+size.height+' the cover would show for a phone on its side, and does not while the keyboard is up',bare==='flex'&&await guard()==='none',[bare,await guard()]);
  }
  for(const size of [{width:1024,height:370},{width:320,height:352}]){
   await page.setViewportSize(size);await page.evaluate(()=>document.body.classList.add('keyboard-open'));await page.waitForTimeout(400);
   const fit=await page.evaluate(()=>{const ob=document.querySelector('.ob');return {footTop:document.querySelector('.obfoot').getBoundingClientRect().top,nameTop:document.getElementById('obName').getBoundingClientRect().top,nameBottom:document.getElementById('obName').getBoundingClientRect().bottom,ages:[...document.querySelectorAll('#obAge .sound')].map(b=>b.getBoundingClientRect().bottom),scrollHeight:ob.scrollHeight,height:ob.clientHeight};});
   ok('at '+size.width+'×'+size.height+' with the keyboard up, the name field and every age choice end above the footer, with no scrolling',fit.nameTop>=0&&fit.nameBottom<=fit.footTop&&fit.ages.length===3&&fit.ages.every(b=>b<=fit.footTop)&&fit.scrollHeight<=fit.height+1,fit);
  }
  clean('keyboard and the rotate cover',errors);
 }finally{await context.close();}
});
await scenario('phone fit, and the hand-off asks for nothing',async()=>{
 const {context,page,errors,requests}=await fresh({native:true,keyboardPlatform:'ios'});try{
  await page.setViewportSize({width:393,height:852});
  await page.waitForTimeout(300);
  ok('welcome fits the phone without scrolling',await page.evaluate(()=>{var ob=document.querySelector('.ob');return ob.scrollHeight<=ob.clientHeight+1&&document.documentElement.scrollHeight<=innerHeight;}));
  await page.screenshot({path:path.join(tmpdir(),'sona-welcome-polish.png')});
  await enter(page);await page.waitForTimeout(600);await page.screenshot({path:path.join(tmpdir(),'sona-sounds-polish.png')});await next(page);await notNow(page);await atHandoff(page);
  ok('the hand-off fits without scrolling',await page.evaluate(()=>{var ob=document.querySelector('.ob');return ob.scrollHeight<=ob.clientHeight+1;}));
  ok('…and has no email box, no × and no Rachel line',!/Rachel|occasional tips|email/i.test(await page.locator('[data-step="achieve"]').innerText())&&await page.locator('#skipEmail,#achEmailInput,[data-step="achieve"] input').count()===0);
  await page.screenshot({path:path.join(tmpdir(),'sona-handoff-polish.png')});
  await next(page);await page.waitForURL('**/arcade-feed.html');
  ok('…and its one button still opens the first game, with nothing posted',leadPosts(requests).length===0);
  clean('phone fit and hand-off',errors);
 }finally{await context.close();}
});
// THE EMAIL STEP (Travis, 13 Oct 2026: "also move the email box before the
// price"): its own one-tap-skippable step, Travis's consent line on screen
// before anything is sent, a wrong-looking address held back with one line.
const updFit=()=>{const ob=document.querySelector('.ob'),c=document.querySelector('[data-step="updates"]').getBoundingClientRect(),b=document.getElementById('nextBtn').getBoundingClientRect(),i=document.getElementById('updEmail').getBoundingClientRect(),k=document.querySelector('.upd-consent').getBoundingClientRect(),s=document.getElementById('updSkip').getBoundingClientRect();return {scrollHeight:ob.scrollHeight,height:ob.clientHeight,cardTop:c.top,cardBottom:c.bottom,buttonTop:b.top,buttonBottom:b.bottom,inputTop:i.top,inputBottom:i.bottom,consentBottom:k.bottom,skip:s.height,sideways:document.documentElement.scrollWidth-innerWidth,obSideways:ob.scrollWidth-ob.clientWidth,innerHeight};};
await scenario('the email step: before the price, optional, and fits',async()=>{
 for(const device of [{viewport:{width:320,height:568}},{viewport:{width:375,height:667}},{viewport:{width:393,height:852},safeArea:{top:59,bottom:34}}]){
  const {context,page,errors}=await fresh({...device,native:true,keyboardPlatform:'ios'}),at=device.viewport.width+'×'+device.viewport.height;try{
   await enter(page,{age:'8'});await choose(page,'R');await next(page);await answerMinutes(page,'5');await page.locator('[data-step="updates"].on').waitFor();await settled(page);
   let fit=await page.evaluate(updFit);
   ok('the email step fits at '+at+': no scrolling, the card at least 12 px clear of Continue, Skip at least 44 tall',fit.scrollHeight<=fit.height+1&&fit.cardTop>=0&&fit.cardBottom+12<=fit.buttonTop&&fit.buttonBottom<=fit.innerHeight&&fit.skip>=44&&fit.sideways<=0&&fit.obSideways<=0,fit);
   // the keyboard up, at each size: an iPhone keyboard (no toolbar) is about
   // 253 px tall on a 320-wide phone, 260 on a 375 and 422 on a 393 with its
   // home bar, and the web view shrinks by that much
   {const kb={320:253,375:260,393:422}[device.viewport.width],up={width:device.viewport.width,height:device.viewport.height-kb};
    await page.locator('#updEmail').focus();await page.setViewportSize(up);await page.evaluate(k=>__setup.keyboardListeners.keyboardWillShow({keyboardHeight:k}),kb);await page.waitForTimeout(500);
    fit=await page.evaluate(updFit);
    ok('with the keyboard up ('+up.width+'×'+up.height+') the box and Travis\'s line stay above Continue',fit.inputTop>=0&&fit.inputBottom<=fit.buttonTop&&fit.consentBottom<=fit.buttonTop&&fit.buttonBottom<=fit.innerHeight,fit);
    await page.evaluate(()=>{__setup.keyboardListeners.keyboardWillHide();document.activeElement.blur();});await page.setViewportSize(device.viewport);
   }
   clean('email step fit '+at,errors);
  }finally{await context.close();}
 }
 const {context,page,errors,requests}=await fresh({viewport:{width:375,height:667}});try{
  await enter(page,{age:'8'});await choose(page,'R');await next(page);await answerMinutes(page,'10');await page.locator('[data-step="updates"].on').waitFor();
  const shown=await page.evaluate(()=>{const st=document.querySelector('[data-step="updates"]');return {title:document.getElementById('updTitle').textContent.trim(),helpLine:!!st.querySelector('.upd-help'),text:st.innerText.replace(/\s+/g,' ').trim(),required:!!document.querySelector('#updEmail[required]'),focus:document.activeElement.id,bubble:document.getElementById('bubble').textContent,cta:document.getElementById('nextBtn').textContent.trim(),back:getComputedStyle(document.getElementById('backBtn')).display,type:document.getElementById('updEmail').type};});
  ok('the step asks once, plainly, and is optional: a heading, an email box that is not required, Skip, Continue and Back',shown.title==='Get the weekly progress report'&&/optional/i.test(shown.text)&&!shown.required&&shown.type==='email'&&/Skip/.test(shown.text)&&shown.cta==='Continue'&&shown.back!=='none'&&shown.bubble==='Want a weekly report?',shown);
  ok('Travis\'s consent line is on screen word for word, before anything is sent',shown.text.includes('We’ll also send occasional tips from Rachel. Unsubscribe anytime.')&&leadPosts(requests).length===0,shown.text);
  ok('…the old help line is gone (Travis, 15 Oct 2026), and the child\'s name is not on the screen',!/Rachel.s tips for practicing at home/i.test(shown.text)&&!shown.helpLine&&!/Milo/.test(shown.text),shown.text);
  ok('the heading takes focus, not the box: no keyboard comes up by itself',shown.focus==='updTitle',shown.focus);
  // Done (Enter) on the keyboard only closes it: it neither goes on nor sends
  await page.locator('#updEmail').fill('done@example.com');await page.locator('#updEmail').press('Enter');
  const done=await page.evaluate(()=>({screen:document.body.dataset.setupScreen,focus:document.activeElement.id,hint:document.getElementById('updEmail').getAttribute('enterkeyhint')}));
  ok('Done in the email box closes the keyboard and stays on the step: nothing is sent',done.screen==='updates'&&done.focus!=='updEmail'&&done.hint==='done'&&leadPosts(requests).length===0,done);
  await page.locator('#updEmail').fill('not-an-email');await next(page);
  const bad=await page.evaluate(()=>({screen:document.body.dataset.setupScreen,msg:document.getElementById('updMsg').textContent,email:draft.email}));
  ok('a wrong-looking address stays on the step with one line, and sends nothing',bad.screen==='updates'&&bad.msg==='That email doesn\'t look right.'&&bad.email===''&&leadPosts(requests).length===0,bad);
  await page.locator('#updEmail').fill('');await next(page);
  ok('an empty box and Continue go on, as a Skip',await screen(page)==='ready'&&await page.evaluate(()=>draft.email==='')&&leadPosts(requests).length===0);
  await calm(page);await page.locator('#backBtn').click();await page.locator('[data-step="updates"].on').waitFor();
  ok('Back comes to it with the line cleared',await page.evaluate(()=>document.getElementById('updMsg').textContent===''));
  await page.locator('#updEmail').fill('typed@example.com');await calm(page);await page.locator('#updSkip').click();
  ok('Skip throws the typed address away and goes on: nothing is kept or sent',await screen(page)==='ready'&&await page.evaluate(()=>draft.email===''&&document.getElementById('updEmail').value==='')&&leadPosts(requests).length===0);
  await next(page);await page.locator('[data-step="mic"].on').waitFor();
  ok('…and leaving ready after a Skip posts no lead and saves no address',leadPosts(requests).length===0&&await page.evaluate(()=>!Sona.getProfile().email&&!Sona.getProfile().weeklyEmail&&!Sona.getProfile().weeklyReport&&!Sona.reportEmail()));
  clean('email step behaviour',errors);
 }finally{await context.close();}
 {const {context,page,errors,requests}=await fresh({viewport:{width:375,height:667}});try{
  await enter(page,{age:'8'});await choose(page,'R');await next(page);await answerMinutes(page,'10');await updates(page,'first@example.com');
  ok('a valid address goes on to ready, kept in the draft (a phone call does not lose it), and nothing is sent yet',await screen(page)==='ready'&&await page.evaluate(()=>draft.email==='first@example.com'&&JSON.parse(localStorage.getItem('sona.obdraft.v1')).email==='first@example.com')&&leadPosts(requests).length===0);
  await calm(page);await page.locator('#backBtn').click();await page.locator('[data-step="updates"].on').waitFor();
  ok('Back shows the address it holds',await page.locator('#updEmail').inputValue()==='first@example.com');
  // typed, then Back to the question before it: coming forward shows what was typed
  await page.locator('#updEmail').fill('not-yet');await calm(page);await page.locator('#backBtn').click();await page.locator('[data-step="minutes"].on').waitFor();
  await calm(page);await next(page);await page.locator('[data-step="updates"].on').waitFor();
  ok('an address typed and left by Back is still in the box when the parent comes forward again, and nothing is sent',await page.locator('#updEmail').inputValue()==='not-yet'&&leadPosts(requests).length===0);
  await next(page);
  ok('…and Continue still checks it: a wrong-looking one stays on the step with its line',await screen(page)==='updates'&&await page.evaluate(()=>document.getElementById('updMsg').textContent==='That email doesn\'t look right.'));
  await page.locator('#updEmail').fill('second@example.com');await next(page);await page.locator('[data-step="ready"].on').waitFor();
  await next(page);await page.locator('[data-step="mic"].on').waitFor();
  const leads=leadPosts(requests);
  ok('a Back and a retype still make ONE post, of the last address, when ready is left',leads.length===1&&leads[0].email==='second@example.com'&&leads[0].source==='app-setup',leads);
  ok('…and that address is the household\'s parent email from then on',await page.evaluate(()=>Sona.parentEmail()==='second@example.com'));
  clean('email step: one post',errors);
 }finally{await context.close();}}
});
// The iPhone keyboard plugin (autoBackdropColor: "dom") paints the area
// behind the keyboard's rounded corners from the BODY's background colour; a
// gradient alone reads as transparent and showed black corners while a parent
// typed the name (Travis, 4 Oct 2026). Every screen with typing keeps a solid
// colour under its gradient: setup's steps here, the grown-ups' pages by the
// rule in crafted-family.css.
await scenario('a solid colour behind the keyboard',async()=>{
 const{context,page,errors}=await fresh();
 try{
  const opaque=(c)=>{const m=/rgba?\(([^)]+)\)/.exec(c||'');if(!m)return false;const p=m[1].split(',').map(Number);return p.length<4||p[3]>0.99;};
  const seen={};
  seen.who=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);   // (the hello)
  await toName(page);
  seen.name=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  ok('while a grown-up types in setup, the body has a solid colour for the keyboard\'s corners to show',opaque(seen.who)&&opaque(seen.name),seen);
  const fam=readFileSync(ROOT+'/crafted-family.css','utf8');
  ok('…and the grown-ups\' pages (Settings, Talk to us, the plan screen) put a solid colour under their gradient',/body\.crafted-family\{[\s\S]*?background:#[0-9a-f]{3,6} radial-gradient\(/i.test(fam));
  clean('keyboard backdrop',errors);
 }finally{await context.close();}
});

// THE SCREENS THAT SELL (Travis, 19 Oct 2026; rebuilt 22 Oct 2026: "We want
// to sell the product in the onboarding ... emphasize the problem ... what
// their kid is interested in, to help customize what games to show them"):
// before the name, the problem, the games playing and Rachel; after it, what
// the child loves and the games they will love. Statements with Continue and
// Back (what the child loves is a question: any number of tiles, or none):
// nothing stored but the draft's picks, no progress segment on a statement.
// The games are the catalog's (no Coming soon game, no typed list).
const PROBLEM={title:'Speech homework is hard at home.',line:'Flashcards turn into fights. Play turns into practice.'};
const GAMES=n=>({title:'Games '+n+' will love'});
const INTERESTS=[['sports','Sports'],['music','Music'],['dinosaurs','Dinosaurs'],['animals','Animals'],['space','Space'],['building','Building'],['food','Food']];
// what a sell screen shows, as a parent reads it
const sellShown=(page,key)=>page.evaluate(key=>{const st=document.querySelector('[data-step="'+key+'"]'),painted=el=>!!el&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0,h=st.querySelector('h1'),grid=[...st.querySelectorAll('#gamesGrid li')];
  // every text node holding the name must sit in a ph-name span (REPLAY1)
  const nm=draft.childName,walker=document.createTreeWalker(document.querySelector('.ob'),NodeFilter.SHOW_TEXT),bare=[];let t;while((t=walker.nextNode()))if(nm&&t.nodeValue.indexOf(nm)>-1&&!(t.parentElement&&t.parentElement.closest('.ph-name,.ph-no-capture')))bare.push(t.parentElement&&(t.parentElement.id||t.parentElement.className));
  return {screen:document.body.dataset.setupScreen,title:h.textContent.trim(),line:(st.querySelector('.sell-line')||{}).textContent,asks:[...st.querySelectorAll('input,select,textarea,button,a,[role="button"]')].map(b=>b.id||b.dataset.val||b.tagName),cta:document.getElementById('nextBtn').textContent.trim(),enabled:!document.getElementById('nextBtn').disabled,back:painted(document.getElementById('backBtn')),seg:document.getElementById('seg').hidden,focus:document.activeElement===h,mascot:painted(document.querySelector('.ob .mascot')),bare,
   names:[...st.querySelectorAll('.ph-name')].map(e=>e.textContent),
   grid:grid.map(li=>li.dataset.game),loved:grid.filter(li=>li.classList.contains('loved')).map(li=>li.dataset.game),gridNames:grid.map(li=>li.querySelector('.sell-name').textContent),gridPics:grid.map(li=>(li.querySelector('img')||{}).getAttribute?li.querySelector('img').getAttribute('src'):''),kickers:[...st.querySelectorAll('.sell-kicker')].map(k=>k.textContent),words:st.innerText.replace(/\s+/g,' ').trim()};},key);
// the catalog's own answer, read straight from GAME_ACTS: the playable games of a group
// The Arcade view's order of a group's playable games, the order the peek takes its first few from
const homeOrder=(page,id)=>page.evaluate(id=>Sona.activityLibrary().groups.filter(g=>g.id===id)[0].games.filter(x=>x.kind!=='book'&&!x.comingSoon&&x.available!==false).map(x=>x.key),id);
// the "and N more" lines under the grid
const mores=page=>page.evaluate(()=>[...document.querySelectorAll('[data-step="games"] .sell-more')].map(p=>p.textContent));
const playable=(page,group)=>page.evaluate(g=>Object.keys(Sona.GAME_ACTS).filter(k=>{const a=Sona.GAME_ACTS[k];return (!g||a.group===g)&&!a.comingSoon&&a.available!==false;}),group);
// the peek setup should show: the games the picks fit first, then the rest,
// each part in Home's order, the first `cap` of them (the page's own pairs)
const peekOf=(page,home,picks,cap)=>page.evaluate(([home,picks,cap])=>{const fit=k=>picks.some(i=>(INTEREST_GAMES[i]||[]).indexOf(k)>-1),f=home.filter(fit);return {fits:f.slice(0,cap),grid:f.concat(home.filter(k=>!fit(k))).slice(0,cap)};},[home,picks,cap]);
const sellFit=key=>{const st=document.querySelector('[data-step="'+key+'"]').getBoundingClientRect(),b=document.getElementById('nextBtn').getBoundingClientRect(),f=document.querySelector('.obfoot').getBoundingClientRect(),h=document.querySelector('[data-step="'+key+'"] h1').getBoundingClientRect(),imgs=[...document.querySelectorAll('[data-step="'+key+'"] .sell-art img,[data-step="'+key+'"] .toss-game img,[data-step="'+key+'"] .rachel-photo img,[data-step="'+key+'"] .reel,[data-step="'+key+'"] .int-pick')].map(i=>i.getBoundingClientRect()),under=[...document.querySelectorAll('[data-step="'+key+'"] .reel-hear,[data-step="'+key+'"] #interestsSkip')].map(i=>i.getBoundingClientRect());return {cardTop:Math.round(st.top),cardBottom:Math.round(st.bottom),footTop:Math.round(f.top),btnTop:Math.round(b.top),btnBottom:Math.round(b.bottom),headTop:Math.round(h.top),imgs:imgs.length,imgBottom:Math.round(Math.max(0,...imgs.map(r=>r.bottom),...under.map(r=>r.bottom))),imgSmall:imgs.filter(r=>r.width<40||r.height<20).length,height:innerHeight,sideways:document.documentElement.scrollWidth-innerWidth,obSideways:(()=>{const o=document.querySelector('.ob');return o.scrollWidth-o.clientWidth;})()};};
// what this phone opens, read from the catalog's own gate (Sona.gameAccess)
const opensHere=(page,group)=>page.evaluate(g=>Object.keys(Sona.GAME_ACTS).filter(k=>{const a=Sona.GAME_ACTS[k];return (!g||a.group===g)&&!a.comingSoon&&a.available!==false&&Sona.gameAccess(k).allowed;}),group);
const kept=page=>page.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^sona\./.test(k))o[k]=localStorage.getItem(k);}o.__draft=JSON.stringify(draft);return JSON.stringify(o);});
await scenario('the screens that sell: their words, the games, and nothing kept',async()=>{
 // a phone where the price follows setup (the trial opens every game), so
 // the grid is every playable game of the age group
 const {context,page,errors,requests}=await fresh({viewport:{width:375,height:667},webSales:true});try{
  ok('(this phone can sell: the price follows setup)',await page.evaluate(()=>Sona.trialFirst()===true));
  ok('the order: hello, the problem, the games playing, Rachel, name, what they love, their games, therapy, sounds, minutes, email, ready, microphone',await page.evaluate(()=>ORDER.join())===FIRST_WALK);
  await next(page);await page.locator('[data-step="problem"].on').waitFor();await settled(page);
  const before=await kept(page);
  let s=await sellShown(page,'problem');
  ok('problem: the heading is exactly "'+PROBLEM.title+'"',s.screen==='problem'&&s.title===PROBLEM.title,s);
  ok('problem: the line is exactly "'+PROBLEM.line+'"',s.line===PROBLEM.line,s.line);
  ok('problem: a statement, not a question: nothing to tap in it, Continue and Back in the footer, no progress segment, no Echo, the heading takes focus',s.asks.length===0&&s.cta==='Continue'&&s.enabled&&s.back&&s.seg&&!s.mascot&&s.focus&&!/\?/.test(s.words),s);
  ok('problem: three word cards and one painted game (Fruit Slice\'s Home card), decoration only',await page.evaluate(()=>{const t=document.querySelector('.toss');return t.getAttribute('aria-hidden')==='true'&&[...t.querySelectorAll('.toss-card')].map(c=>c.textContent).join()==='rug,red,run'&&t.querySelector('.toss-game img').getAttribute('src')==='/assets/crafted/home-fruit.webp';}));
  await next(page);await page.locator('[data-step="reel"].on').waitFor();await settled(page);
  s=await sellShown(page,'reel');
  ok('reel: the heading is exactly "They practice by playing."',s.title==='They practice by playing.',s.title);
  ok('reel: a statement too: the one thing to tap in it is "Hear Echo"; no progress segment, no Echo beside it, the heading takes focus',JSON.stringify(s.asks)==='["reelHear"]'&&s.cta==='Continue'&&s.back&&s.seg&&!s.mascot&&s.focus,s);
  ok('reel: Echo asks "Say your rrrr sound!" over the games, only the sound\'s letters orange, and says the R is an example',await page.evaluate(()=>{const p=document.getElementById('reelSay');return p.textContent==='Say your rrrr sound!'&&p.querySelectorAll('b.snd').length===1&&p.querySelector('b.snd').textContent==='rrrr';})&&/Example: the R sound/.test(s.words),s.words);
  await next(page);await page.locator('[data-step="rachel"].on').waitFor();await settled(page);
  s=await sellShown(page,'rachel');
  ok('rachel: a statement: nothing to tap, no progress segment, no Echo, the heading takes focus',s.asks.length===0&&s.cta==='Continue'&&s.back&&s.seg&&!s.mascot&&s.focus,s);
  ok('nothing is stored by the screens before the name (no answer, no profile, no household key, the draft unchanged)',await kept(page)===before);
  await setupWalk(page,'interests',{name:'Milo',age:'6'});await settled(page);
  s=await sellShown(page,'interests');
  ok('interests: "What does Milo love?", the name in ph-name and nowhere else',s.title==='What does Milo love?'&&JSON.stringify(s.names)==='["Milo"]'&&s.bare.length===0,s);
  ok('interests: seven tiles in order, word for word, none picked, then Skip; Continue goes on with none',JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('#obInterests .int-pick')].map(b=>[b.dataset.val,b.textContent.trim(),b.getAttribute('aria-pressed'),b.type])))===JSON.stringify(INTERESTS.map(a=>[a[0],a[1],'false','button']))&&s.asks.at(-1)==='interestsSkip'&&s.cta==='Continue'&&s.enabled,s.asks);
  ok('interests: a question, the second progress segment, with each tile\'s picture from the games\' own painted art',(await progress(page)).lit===2&&await page.evaluate(()=>[...document.querySelectorAll('#obInterests img')].every(i=>/^\/assets\/crafted\//.test(i.getAttribute('src'))&&i.alt==='')));
  // a pick, a second pick and an unpick: the draft holds ids, in the order picked
  await calm(page);await page.locator('#obInterests [data-val="dinosaurs"]').click();await page.locator('#obInterests [data-val="food"]').click();await page.locator('#obInterests [data-val="sports"]').click();await page.locator('#obInterests [data-val="food"]').click();
  ok('interests: each tile is a toggle, and the draft keeps the ids picked (nothing else)',await page.evaluate(()=>JSON.stringify(draft.interests)==='["dinosaurs","sports"]'&&JSON.stringify(JSON.parse(localStorage.getItem('sona.obdraft.v1')).interests)==='["dinosaurs","sports"]'&&!Sona.getProfile().onboarded&&[...document.querySelectorAll('#obInterests [aria-pressed="true"]')].map(b=>b.dataset.val).join()==='sports,dinosaurs'));
  const afterPicks=await kept(page);
  await next(page);await page.locator('[data-step="games"].on').waitFor();await settled(page);
  s=await sellShown(page,'games');
  ok('games: the heading is exactly "'+GAMES('Milo').title+'"',s.title===GAMES('Milo').title,s.title);
  ok('games: the name is ph-name, and no other recorded text holds it',JSON.stringify(s.names)==='["Milo"]'&&s.bare.length===0,s);
  const arcade=await homeOrder(page,'arcade'),peek=await peekOf(page,arcade,['dinosaurs','sports'],9);
  // a peek, not the catalog (22 Oct 2026, when 18 games opened): nine, the loved ones first, the rest counted
  ok('games: nine of the catalog\'s playable Arcade games for a 5–6 year old, the ones sports and dinosaurs fit first ('+peek.fits.join(', ')+'), ringed, then the rest, each part in the Arcade view\'s order',arcade.length>9&&JSON.stringify(arcade.slice().sort())===JSON.stringify((await playable(page,'arcade')).slice().sort())&&peek.fits.length>=3&&JSON.stringify(s.grid)===JSON.stringify(peek.grid)&&JSON.stringify(s.loved)===JSON.stringify(peek.fits),{grid:s.grid,loved:s.loved,peek,arcade});
  ok('games: …and the rest counted under them: "and '+(arcade.length-9)+' more"',JSON.stringify(await mores(page))===JSON.stringify(['and '+(arcade.length-9)+' more']),await mores(page));
  ok('games: never a Coming soon game, and the free and Premium ones alike, unlabelled',s.grid.length>=2&&await page.evaluate(keys=>keys.every(k=>!Sona.GAME_ACTS[k].comingSoon),s.grid)&&!/\bfree\b|premium|coming soon|\$/i.test(s.words),s.words);
  ok('games: each with its own name and its painted Home card',JSON.stringify(s.gridNames)===JSON.stringify(await page.evaluate(keys=>keys.map(k=>Sona.GAME_ACTS[k].name),s.grid))&&JSON.stringify(s.gridPics)===JSON.stringify(await page.evaluate(keys=>keys.map(k=>'/assets/crafted/home-'+Sona.CRAFTED_CARDS[k]+'.webp'),s.grid)),s);
  ok('…every picture loads',await page.evaluate(()=>Promise.all([...document.querySelectorAll('#gamesGrid img')].map(i=>i.decode().then(()=>i.naturalWidth>0,()=>false))).then(a=>a.length>0&&a.every(Boolean))));
  ok('games: one age group, so no group headings',s.kickers.length===0,s.kickers);
  ok('games: a statement: nothing to tap in it, Continue, Back, no progress segment',s.asks.length===0&&s.cta==='Continue'&&s.back&&s.seg,s);
  ok('nothing is stored by the games screen (the draft unchanged since the picks)',await kept(page)===afterPicks);
  await next(page);await page.locator('[data-step="therapy"].on').waitFor();
  ok('…and Continue goes on to the therapy question, the third of the five',(await progress(page)).lit===3);
  await calm(page);await page.locator('#backBtn').click();await page.locator('[data-step="games"].on').waitFor();
  ok('Back from the therapy question comes back to the games',await screen(page)==='games');
  // the age and the picks, changed after Back, change the games
  for(const k of ['interests','name']){await calm(page);await page.locator('#backBtn').click();await page.locator('[data-step="'+k+'"].on').waitFor();}
  await page.locator('#obAge [data-age="4"]').click();await next(page);await page.locator('[data-step="interests"].on').waitFor();
  await calm(page);await page.locator('#obInterests [data-val="dinosaurs"]').click();await page.locator('#obInterests [data-val="sports"]').click();await page.locator('#obInterests [data-val="space"]').click();
  await next(page);await page.locator('[data-step="games"].on').waitFor();
  s=await sellShown(page,'games');
  const simple=await homeOrder(page,'simple'),speek=await peekOf(page,simple,['dinosaurs','sports','space'],9);
  ok('ages 2–4: the grid is nine of the catalog\'s playable Simple play games, Bubble Pop first for a child who loves space ('+s.grid.join(', ')+'), the rest counted',JSON.stringify(simple.slice().sort())===JSON.stringify((await playable(page,'simple')).slice().sort())&&s.grid[0]==='bubbles'&&JSON.stringify(s.grid)===JSON.stringify(speek.grid)&&JSON.stringify(s.loved)===JSON.stringify(speek.fits)&&JSON.stringify(await mores(page))===JSON.stringify(simple.length>9?['and '+(simple.length-9)+' more']:[]),{grid:s.grid,loved:s.loved,speek,simple,mores:await mores(page)});
  await calm(page);await page.locator('#backBtn').click();await page.locator('[data-step="interests"].on').waitFor();await calm(page);await page.locator('#interestsSkip').click();await page.locator('[data-step="games"].on').waitFor();
  s=await sellShown(page,'games');
  ok('Skip on what they love clears the picks: the Arcade view\'s first nine in its own order, none ringed',JSON.stringify(s.grid)===JSON.stringify(simple.slice(0,9))&&s.loved.length===0&&await page.evaluate(()=>draft.interests.length===0),s.grid);
  ok('nothing posted, nothing sent about these screens but the screen\'s key',leadPosts(requests).length===0);
  clean('sell screens',errors);
 }finally{await context.close();}
 // no age given, and 7+
 for(const [age,label] of [['','no age'],['8','7+']]){
  const {context,page,errors}=await fresh({viewport:{width:375,height:667},webSales:true});try{
   await setupWalk(page,'games',{name:'Ava',age});
   const s=await sellShown(page,'games');
   if(!age){
    const sh=await homeOrder(page,'simple'),ah=await homeOrder(page,'arcade'),both=sh.slice(0,3).concat(ah.slice(0,6));
    ok('no age: three Simple play games then six Arcade ones, Home\'s first of each, each group under its catalog label',JSON.stringify(s.grid)===JSON.stringify(both)&&JSON.stringify(s.kickers)===JSON.stringify(await page.evaluate(()=>['simple','arcade'].map(id=>Sona.activityLibrary().groups.filter(g=>g.id===id)[0].ageLabel))),{grid:s.grid,both,kickers:s.kickers});
    ok('no age: …each group\'s rest counted under it',JSON.stringify(await mores(page))===JSON.stringify([sh,ah].map((g,i)=>g.length-[3,6][i]).filter(n=>n>0).map(n=>'and '+n+' more')),await mores(page));
   }else ok('7+: the Arcade view\'s first nine Arcade games',JSON.stringify(s.grid)===JSON.stringify((await homeOrder(page,'arcade')).slice(0,9)),s.grid);
   ok(label+': still no Coming soon game',await page.evaluate(keys=>keys.every(k=>!Sona.GAME_ACTS[k].comingSoon),s.grid));
   clean('sell screens '+label,errors);
  }finally{await context.close();}
 }
 // A PHONE THAT CANNOT SELL (the website while it sells nothing, so every
 // Android family; an app build with no purchase plugin): no price follows,
 // nothing there can open a Premium game, so "Games <Name> will love" lists
 // only the games this phone opens, never one it will grey out
 for(const [age,label,group] of [['6','5–6','arcade'],['4','2–4','simple'],['','no age','']]){
  const {context,page,errors}=await fresh({viewport:{width:375,height:667}});try{
   await setupWalk(page,'interests',{name:'Ava',age});
   const before=await kept(page);
   ok('cannot sell, '+label+': (no price follows setup on this phone)',await page.evaluate(()=>Sona.trialFirst()===false&&!Sona.webSales()));
   await next(page);await page.locator('[data-step="games"].on').waitFor();
   const s=await sellShown(page,'games'),here=await opensHere(page,group),all=await playable(page,group);
   const free=await page.evaluate(keys=>keys.filter(k=>Sona.GAME_ACTS[k].tier==='free'),all);
   ok('cannot sell, '+label+': the grid is exactly the games this phone opens ('+here.join(', ')+'), the free version\'s, and none it greys out',JSON.stringify(s.grid.slice().sort())===JSON.stringify(here.slice().sort())&&JSON.stringify(here.slice().sort())===JSON.stringify(free.slice().sort())&&here.length>=2,{grid:s.grid,here,free,all});
   // (the little kids' two playable games are both free today; the big kids'
   // Premium ones are what this rule keeps off a phone that cannot sell)
   if(group!=='simple')ok('cannot sell, '+label+': …so a Premium game such as Hoops is not on it',all.indexOf('hoops')>-1&&s.grid.indexOf('hoops')<0&&here.length<all.length,{grid:s.grid,all});
   ok('cannot sell, '+label+': asking which games open stores nothing',await kept(page)===before);
   ok('cannot sell, '+label+': still unlabelled, and the same words',!/\bfree\b|premium|coming soon|\$/i.test(s.words)&&s.title===GAMES('Ava').title,s.words);
   clean('sell screens, cannot sell, '+label,errors);
  }finally{await context.close();}
 }
});
await scenario('the screens that sell fit every screen',async()=>{
 // one walk a screen size, with no age (both groups: the longest grid); the
 // other age groups are then painted on the same screen, as Back would
 for(const device of [{viewport:{width:320,height:568}},{viewport:{width:375,height:667}},{viewport:{width:390,height:844},safeArea:{top:47,bottom:34}},{viewport:{width:768,height:1024}},{viewport:{width:1024,height:768}}]){
  const {context,page,errors}=await fresh(Object.assign({webSales:true},device)),size=device.viewport.width+'×'+device.viewport.height;try{
   for(const key of ['problem','reel','rachel','interests','games']){
    await setupWalk(page,key,{name:'Maximiliana',age:''});await page.locator('[data-step="'+key+'"].on').waitFor();await settled(page);
    if(key==='games')ok('(fit at '+size+': a phone that sells, so the grid is the longest it gets: nine games of '+(await playable(page,'')).length+', and two "more" lines)',await page.evaluate(()=>Sona.trialFirst()===true&&document.querySelectorAll('#gamesGrid li').length)===9&&(await mores(page)).length===2);
    for(const age of key==='games'?['','6','4']:['']){
     await page.evaluate(a=>{draft.childAge=a;paintSell();},age);
     await page.evaluate(()=>Promise.all([...document.querySelectorAll('.step.on img')].map(i=>i.decode().catch(()=>{}))));
     const f=await page.evaluate(sellFit,key),at=size+(key==='games'?' ('+(age?'age '+age:'no age')+')':'');
     ok(key+' fits at '+at+': the screen on the phone and clear of the footer, its pictures with it, Continue whole, nothing sideways',f.cardTop>=0&&f.headTop>=0&&f.cardBottom<=f.footTop&&f.imgBottom<=f.footTop&&f.imgSmall===0&&f.imgs>0&&f.btnBottom<=f.height&&f.sideways<=0&&f.obSideways<=0,f);
    }
    await page.evaluate(()=>{draft.childAge='';paintSell();});
   }
   clean('sell fit '+size,errors);
  }finally{await context.close();}
 }
});
await scenario('the screens that sell: only for a family\'s first setup',async()=>{
 const NONE=['problem','reel','rachel','interests','games','remind'];
 {const {context,page,errors}=await fresh();try{
  await who(page,'slp');
  ok('the browser clinician\'s own setup (?slp=1) has none of them',await page.evaluate(k=>ORDER===ORDER_SLP&&k.every(x=>ORDER.indexOf(x)<0),NONE));
  clean('clinician: no sell screens',errors);
 }finally{await context.close();}}
 {const {context,page,errors}=await fresh({native:true});try{
  await page.goto(base+'/onboarding.html?slp=1');await page.waitForFunction(()=>window.Sona&&document.getElementById('nextBtn'));
  ok('…nor the app\'s clinician address',await page.evaluate(k=>draft.role==='slp'&&k.every(x=>ORDER.indexOf(x)<0),NONE));
  clean('app clinician: no sell screens',errors);
 }finally{await context.close();}}
 {const {context,page,errors}=await fresh();try{
  await page.evaluate(()=>localStorage.setItem('sona.kids.v1',JSON.stringify({active:'k2',list:[{slot:'',name:'Milo'},{slot:'k2',name:'Rosie'}]})));await page.reload();
  ok('…nor a second child\'s',await page.evaluate(()=>ORDER.join()==='welcome,name,sounds,ready,mic'));
  clean('second child: no sell screens',errors);
 }finally{await context.close();}}
 {const {context,page,errors}=await fresh();try{
  await page.evaluate(()=>localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Milo',childAge:'6',focusSounds:['R'],onboarded:true,voiceOn:false,soundOn:false})));await page.reload();
  ok('…nor a child already set up walking setup again',await page.evaluate(k=>REWALK&&k.every(x=>ORDER.indexOf(x)<0)&&ORDER.join()==='welcome,name,therapy,sounds,minutes,updates,ready,mic',NONE));
  clean('rewalk: no sell screens',errors);
 }finally{await context.close();}}
});

// ── WHERE SONA CAN SELL: what the price screen and the whole-flow suite rely
// on from this page. The shared fake phone is an app WITH the purchase plugin
// and a microphone; /subscribe.html is a stub that loads sona.js and nothing
// else, so none of this depends on the real price screen.
const PRICE='<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Price</title></head><body><p id="price">Price destination</p><script src="/sona.js"></script></body></html>';
async function phone(cfg={},viewport={width:393,height:852},hold=null){
  const o=await openPhone(browser,base,Object.assign({app:'buy',mic:'pending'},cfg),viewport);
  await stubs(o.context);
  // every ask of the phone for the microphone, counted where it survives a
  // navigation (the fake's own record starts empty on each page)
  await o.context.addInitScript(()=>{try{const real=navigator.mediaDevices.getUserMedia;navigator.mediaDevices.getUserMedia=function(){localStorage.setItem('__micAsks',String(Number(localStorage.getItem('__micAsks')||0)+1));return real.apply(this,arguments);};}catch(e){}});
  await o.context.route('**/subscribe.html**',async route=>{if(hold)await hold(route);return route.fulfill({status:200,contentType:'text/html',body:PRICE});});
  o.page.setDefaultTimeout(5000);o.page.on('dialog',d=>d.dismiss());
  return o;
}
// hello → the screens that sell → name + age 7 → an answer → R → an answer → ready
async function buyerAtReady(page,name='Mia',email=null){await page.goto(base+'/onboarding.html');await enter(page,{name,age:'8',therapy:'t_yes'});await choose(page,'R');await toReady(page,'5',email);}
const tab=page=>page.evaluate(()=>({marker:sessionStorage.getItem('sona.setupafter.v1'),gate:sessionStorage.getItem('sona.gate.v1'),firstgame:sessionStorage.getItem('sona.firstgame.v1'),asks:localStorage.getItem('sona.setupasks.v1'),draft:localStorage.getItem('sona.obdraft.v1'),profile:JSON.parse(localStorage.getItem('sona.profile.v1')||'{}'),mic:Number(localStorage.getItem('__micAsks')||0),bought:__phone.bought.length,asked:__phone.askedAll.length,syncs:__phone.syncs}));
await scenario('where Sona can sell, ready\'s Continue leaves for the price and a buyer comes back to the microphone',async()=>{
 const {context,page,errors,requests}=await phone();try{
  await buyerAtReady(page,'Mia','mom@example.com');
  await page.waitForFunction(()=>__phone.infos>=1).catch(()=>{});
  ok('the family owes the price, and the store is already being asked whether this Apple ID has Premium',await page.evaluate(()=>Sona.trialFirst()===true&&__phone.infos>=1));
  await next(page);await page.waitForURL(url=>url.pathname==='/subscribe.html');
  const at=await tab(page),marker=JSON.parse(at.marker||'null');
  ok('Continue on ready goes to exactly /subscribe.html?setup=1',page.url()===base+'/subscribe.html?setup=1',page.url());
  {const order=requests.filter(r=>r.method==='POST'&&new URL(r.url).pathname==='/api/lead'||new URL(r.url).pathname==='/subscribe.html').map(r=>new URL(r.url).pathname),lead=leadPosts(requests);
  ok('…the email step\'s address was posted once, before the price was asked for, and it is on the profile for the purchase\'s plan post',lead.length===1&&lead[0].email==='mom@example.com'&&lead[0].source==='app-setup'&&order[0]==='/api/lead'&&order.indexOf('/subscribe.html')>0&&await page.evaluate(()=>Sona.parentEmail()==='mom@example.com'),[order,lead]);}
  ok('…with the profile saved, the therapy answer kept, the minutes picked as the daily goal (5 min, 30 reps), and the draft gone',at.profile.onboarded===true&&at.profile.childName==='Mia'&&JSON.stringify(at.profile.focusSounds)==='["R"]'&&at.asks==='{"v":2,"therapy":"t_yes"}'&&at.draft===null&&!('therapy' in at.profile)&&at.profile.dailyGoal===30&&at.profile.dailyMinutes===5&&!('weeklyGoal' in at.profile),at);
  ok('…the grown-ups stamp and the "after the price" marker written for this child, in this tab',Number(at.gate)>0&&!!marker&&marker.kid===''&&typeof marker.at==='number'&&await page.evaluate(()=>Sona.setupAfter()===true),at);
  ok('…no first game marked yet, the phone not asked for the microphone, and nothing bought or even priced by setup',at.firstgame===null&&at.mic===0&&at.bought===0&&at.asked===0,at);
  // a reload of setup while still unpaid (a Back swipe from the price): the
  // price again, and the hello is never shown on the way
  await page.goto(base+'/onboarding.html').catch(()=>{});await page.waitForURL(url=>url.pathname==='/subscribe.html');
  ok('marker + still unpaid: setup is replaced by the price again, marker intact',page.url()===base+'/subscribe.html?setup=1'&&await page.evaluate(()=>Sona.setupAfter()===true));
  // the purchase, as the price screen records it; then its hop back
  await page.evaluate(()=>Sona.saveSub({active:true,source:'apple',since:Date.now()}));
  await page.goto(base+'/onboarding.html');await page.locator('[data-step="mic"].on').waitFor();
  const back=await page.evaluate(()=>({screen:document.body.dataset.setupScreen,html:document.documentElement.className,backBtn:getComputedStyle(document.getElementById('backBtn')).display,seg:document.getElementById('seg').hidden,hello:document.querySelector('[data-step="welcome"]').classList.contains('on'),visible:getComputedStyle(document.querySelector('.ob')).visibility,cta:document.getElementById('nextBtn').textContent.trim(),name:document.getElementById('micName').textContent,role:draft.role,steps:__phone.events.filter(e=>e.name==='setup step').map(e=>e.props.step).join()}));
  ok('with a valid marker and nothing owed, setup opens on the microphone: no hello, no Back, no progress bar, nothing left hidden',back.screen==='mic'&&!back.hello&&back.backBtn==='none'&&back.seg&&back.visible==='visible'&&!/ob-resume|ob-leaving/.test(back.html)&&back.cta==='Turn on Echo\'s ears'&&back.name==='Mia',back);
  ok('…the profile was not saved a second time: each screen was counted once, the microphone now',back.steps===FIRST_WALK,back.steps);
  await page.reload();await page.locator('[data-step="mic"].on').waitFor();
  ok('a reload on the microphone comes back to the microphone',await screen(page)==='mic');
  await next(page);await page.waitForFunction(()=>__phone.mic.requests.length===1);
  await page.evaluate(()=>__phone.mic.requests[0].grant());await atHandoff(page);
  const heard=await page.evaluate(()=>({mic:localStorage.getItem('sona.micok'),order:__phone.mic.order,title:document.getElementById('handoffTitle').innerText.trim(),email:document.querySelectorAll('[data-step="achieve"] input,#achEmail,#skipEmail').length}));
  ok('"Turn on Echo\'s ears" asks the phone once, stops both tracks before the speech ask, and opens the hand-off',heard.mic==='1'&&heard.order.filter(x=>x==='microphone').length===1&&heard.order.filter(x=>x==='stop').length===2&&heard.order.indexOf('speech permission')>heard.order.lastIndexOf('stop')&&heard.title==='Hand the phone to Mia!'&&heard.email===0,heard);
  await next(page);await page.waitForURL(url=>url.pathname==='/today.html');
  const end=await page.evaluate(()=>({firstgame:sessionStorage.getItem('sona.firstgame.v1'),marker:sessionStorage.getItem('sona.setupafter.v1'),done:JSON.parse(localStorage.getItem('__phoneRec')).events.filter(e=>e.name==='onboarding completed').length}));
  ok('"Let\'s play!" back from the price goes Home to pick a game (17 Oct 2026), marks no first game, and clears the marker',new URL(page.url()).pathname==='/today.html'&&end.firstgame===null&&end.marker===null&&end.done===1,[page.url(),end]);
  ok('the only price page setup ever asked for is /subscribe.html?setup=1',priced(requests).every(u=>u===base+'/subscribe.html?setup=1')&&priced(requests).length===2,priced(requests));
  ok('…and back from the price the hand-off asked for no email: still the one lead',leadPosts(requests).length===1,leadPosts(requests));
  clean('buy path',errors);
 }finally{await context.close();}
});
await scenario('markers that do not hold, and a tab that never left ready',async()=>{
 // app closed on the price: a new tab shares the phone's storage, not the tab's
 {const {context,page,errors}=await phone();try{
  await buyerAtReady(page);await next(page);await page.waitForURL(url=>url.pathname==='/subscribe.html');
  await page.evaluate(()=>sessionStorage.clear());await page.goto(base+'/onboarding.html');await page.locator('[data-step="welcome"].on').waitFor();
  ok('no marker (the app was closed on the price): setup opens on the hello, never the microphone, and writes no draft',await screen(page)==='welcome'&&await page.evaluate(()=>localStorage.getItem('sona.obdraft.v1')===null&&!/ob-resume|ob-leaving/.test(document.documentElement.className)));
  for(const [label,marker] of [['for another child',{at:Date.now(),kid:'k2'}],['over two hours old',{at:Date.now()-2*60*60*1000-5000,kid:''}],['that is not a marker at all','yes']]){
   await page.evaluate(m=>sessionStorage.setItem('sona.setupafter.v1',typeof m==='string'?m:JSON.stringify(m)),marker);await page.goto(base+'/onboarding.html');await page.locator('[data-step="welcome"].on').waitFor();
   ok('a marker '+label+' opens the hello, shown, and is thrown away',await page.evaluate(()=>sessionStorage.getItem('sona.setupafter.v1')===null&&getComputedStyle(document.querySelector('.ob')).visibility==='visible'&&!/ob-resume|ob-leaving/.test(document.documentElement.className)));
  }
  clean('markers',errors);
 }finally{await context.close();}}
 // a marker picks a screen; it never grants. Forged on an unpaid phone it
 // reaches the price, not a game.
 {const {context,page,errors}=await phone({setUp:true,stamp:'post',marker:true});try{
  await page.goto(base+'/onboarding.html').catch(()=>{});await page.waitForURL(url=>url.pathname==='/subscribe.html');
  ok('a marker on an unpaid phone leads to the price, and unlocks nothing',page.url()===base+'/subscribe.html?setup=1'&&await page.evaluate(()=>Sona.premium()===false&&Sona.trialFirst()===true));
  clean('marker grants nothing',errors);
 }finally{await context.close();}}
 // while an unpaid family is sent back to the price, the raw hello under the
 // page is never painted, however slow the price is to load. (Nothing outside
 // the page can look at it while that navigation is held, so the page samples
 // itself five times a second and the samples are read once the price is in.)
 {let release;const held=new Promise(r=>{release=r;});
  const {context,page,errors}=await phone({setUp:true,stamp:'post',marker:true},{width:393,height:852},()=>held);try{
  await context.addInitScript(()=>{if(location.pathname!=='/onboarding.html')return;const t0=Date.now();setInterval(()=>{try{const ob=document.querySelector('.ob'),foot=document.querySelector('.obfoot');if(!ob||!foot)return;const all=JSON.parse(localStorage.getItem('__samples')||'[]');all.push({ms:Date.now()-t0,html:document.documentElement.className,ob:getComputedStyle(ob).visibility,foot:getComputedStyle(foot).visibility,body:getComputedStyle(document.body).backgroundImage,color:getComputedStyle(document.body).backgroundColor});localStorage.setItem('__samples',JSON.stringify(all));}catch(e){}},200);});
  page.goto(base+'/onboarding.html').catch(()=>{});
  await new Promise(r=>setTimeout(r,3000));release();await page.waitForURL(url=>url.pathname==='/subscribe.html');
  const samples=await page.evaluate(()=>JSON.parse(localStorage.getItem('__samples')||'[]'));
  ok('while the price loads (held here for 3 s) the hello is never painted: the page stays plain cream until it is gone',samples.length>=8&&samples.at(-1).ms>=2400&&samples.every(x=>x.ob==='hidden'&&x.foot==='hidden'&&x.body==='none'&&x.color==='rgb(255, 246, 233)')&&samples.slice(-3).every(x=>/ob-leaving/.test(x.html)),samples.filter((x,i)=>i%4===0));
  clean('hidden hello',errors);
 }finally{release();await context.close();}}
});
await scenario('a family the store already knows is not shown a price',async()=>{
 for(const [label,cfg] of [['this Apple ID already has Premium',{entitled:true}],['a reinstalled subscriber, found by the one purchase sync',{sync:'finds'}]]){
  const {context,page,errors,requests}=await phone(cfg);try{
   await buyerAtReady(page);await next(page);await page.locator('[data-step="mic"].on').waitFor();
   const st=await tab(page);
   ok(label+': Continue on ready goes on to the microphone in the page, never to the price',priced(requests).length===0&&new URL(page.url()).pathname==='/onboarding.html'&&st.profile.onboarded===true&&st.bought===0&&await page.evaluate(()=>Sona.isSubscribed()&&Sona.getSub().source==='apple'),[priced(requests),st]);
   clean('store knows them: '+label,errors);
  }finally{await context.close();}
 }
 // a slow store: "One moment…" for 2.5 s at most, then the price (which asks again itself)
 {const {context,page,errors}=await phone({info:'hang'});try{
  await buyerAtReady(page);const t0=Date.now();await next(page);
  const busy=await page.evaluate(()=>({cta:document.getElementById('nextBtn').textContent.trim(),busy:document.getElementById('nextBtn').getAttribute('aria-busy'),disabled:document.getElementById('nextBtn').disabled,back:document.getElementById('backBtn').disabled,backShown:getComputedStyle(document.getElementById('backBtn')).display,saved:Sona.getProfile().onboarded,screen:document.body.dataset.setupScreen}));
  ok('while the store is asked the button reads "One moment…", busy and disabled, with the profile already saved',busy.cta==='One moment…'&&busy.busy==='true'&&busy.disabled&&busy.back&&busy.saved===true&&busy.screen==='ready',busy);
  ok('…and Back is gone, not left painted beside it doing nothing',busy.backShown==='none',busy.backShown);
  await page.waitForURL(url=>url.pathname==='/subscribe.html');const took=Date.now()-t0;
  ok('a store that never answers holds the parent about 2.5 seconds, then the price',took>=1500&&took<4500&&page.url()===base+'/subscribe.html?setup=1',took);
  clean('slow store',errors);
 }finally{await context.close();}}
});
await scenario('families who see no price walk straight on, and the store is never asked',async()=>{
 for(const [label,cfg,seed] of [['an app build with no purchase plugin',{app:'nobuy'},null],['a browser',{app:null},null],['a family who joined through their speech therapist',{slp:true},null],['a founder',{founder:true},null],['a household that already subscribes',{},()=>localStorage.setItem('sona.sub.v1',JSON.stringify({active:true,email:'',since:1,source:'stripe'}))]]){
  const {context,page,errors,requests}=await phone(cfg);try{
   await page.goto(base+'/onboarding.html');if(seed){await page.evaluate(seed);await page.reload();}
   await enter(page,{name:'Mia',age:'8',therapy:'t_yes'});await choose(page,'R');await toReady(page,'15');
   await next(page);
   const st=await page.evaluate(()=>({screen:document.body.dataset.setupScreen,cta:document.getElementById('nextBtn').textContent.trim(),asked:__phone.asked.length,infos:__phone.infos,syncs:__phone.syncs,marker:!!sessionStorage.getItem('sona.setupafter.v1')}));
   ok(label+': ready\'s Continue opens the microphone at once, in the page, with no "One moment…"',st.screen==='mic'&&st.cta==='Turn on Echo\'s ears'&&st.marker,st);
   await notNow(page);await atHandoff(page);await next(page);await page.waitForURL(url=>url.pathname==='/charge.html');
   ok(label+': then the hand-off and the first game, with no price page and no question put to the store',priced(requests).length===0&&st.asked===0&&st.infos===0&&st.syncs===0&&new URL(page.url()).search==='?game=arcade-slice.html',[priced(requests),st,page.url()]);
   clean('no price: '+label,errors);
  }finally{await context.close();}
 }
});
await scenario('in the app, a clinician and a second child',async()=>{
 // a clinician who set the app up for a child is never priced, and is still a
 // clinician after a reload on the microphone (the marker keeps the role)
 {const {context,page,errors,requests}=await phone();try{
  await page.goto(base+'/onboarding.html');await who(page,'slp');await page.locator('#obName').fill('Mia');await next(page);await choose(page,'R');await next(page);await page.locator('[data-step="ready"].on').waitFor();
  await next(page);await page.locator('[data-step="mic"].on').waitFor();
  ok('a clinician in the app goes from ready to the microphone: never a price, and the store is never asked',priced(requests).length===0&&await page.evaluate(()=>Sona.getProfile().role==='slp'&&__phone.infos===0&&__phone.asked.length===0));
  await page.reload();await page.locator('[data-step="mic"].on').waitFor();
  ok('…after a reload on the microphone the role is still "slp"',await page.evaluate(()=>draft.role==='slp'&&ORDER===ORDER_PARENT));
  await notNow(page);await atHandoff(page);await next(page);await page.waitForURL(url=>url.pathname!=='/onboarding.html');
  ok('…and it still ends on Home',new URL(page.url()).pathname==='/today.html'&&priced(requests).length===0,page.url());
  clean('app clinician',errors);
 }finally{await context.close();}}
 // a second child in a household that owes the price, and one that does not
 for(const [label,cfg,dest] of [['an unpaid household',{kids:2,stamp:'post'},'/subscribe.html'],['a household with Premium',{kids:2,stamp:'post',entitled:true},'/onboarding.html']]){
  const {context,page,errors,requests}=await phone(cfg);try{
   await page.goto(base+'/onboarding.html');
   ok('a second child ('+label+'): two progress groups, neither family question, and their own name already in the field',await page.evaluate(()=>ORDER.join()==='welcome,name,sounds,ready,mic'&&document.querySelectorAll('#seg i').length===2)&&await page.locator('#obName').inputValue()==='Ben');
   await toName(page);await next(page);await choose(page,'R');await next(page);await page.locator('[data-step="ready"].on').waitFor();
   const ready=await readyShown(page);
   await next(page);
   if(dest==='/subscribe.html')await page.waitForURL(url=>url.pathname==='/subscribe.html');else await page.locator('[data-step="mic"].on').waitFor();
   const marker=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('sona.setupafter.v1')||'null'));
   ok('…ready shows no sentence from an answer, then '+(dest==='/subscribe.html'?'the price':'the microphone')+', with the marker written for THIS child',ready.title==='Ben\'s practice is ready!'&&ready.lines.length===0&&new URL(page.url()).pathname===dest&&!!marker&&marker.kid==='k2'&&(dest==='/subscribe.html')===(priced(requests).length>0)&&await page.evaluate(()=>localStorage.getItem('sona.setupasks.v1')===null),[ready.title,page.url(),marker]);
   clean('second child in the app: '+label,errors);
  }finally{await context.close();}
 }
});
// If the price page never loads (here its request simply dies), the parent is
// not left on a dead "One moment…": after 8 seconds Continue comes back, and
// it tries again.
await scenario('the price never loads: Continue comes back',async()=>{
 const {context,page,errors,requests}=await phone();try{
  let dead=true;await context.route('**/subscribe.html**',route=>dead?route.abort('aborted'):route.fulfill({status:200,contentType:'text/html',body:PRICE}));
  await buyerAtReady(page);await page.clock.install();
  await calm(page);await page.locator('#nextBtn').click({noWaitAfter:true});
  ok('Continue turns busy at once, the grown-ups stamp written for the price',await page.evaluate(()=>!!sessionStorage.getItem('sona.gate.v1')&&document.getElementById('nextBtn').disabled&&document.getElementById('nextBtn').textContent.trim()==='One moment…'));
  await page.clock.runFor(7000);
  ok('for 8 seconds the button stays busy',await page.evaluate(()=>document.getElementById('nextBtn').disabled&&document.body.dataset.setupScreen==='ready'));
  await page.clock.runFor(4500);
  const again=await page.evaluate(()=>({cta:document.getElementById('nextBtn').textContent.trim(),disabled:document.getElementById('nextBtn').disabled,busy:document.getElementById('nextBtn').getAttribute('aria-busy'),back:getComputedStyle(document.getElementById('backBtn')).display,screen:document.body.dataset.setupScreen}));
  ok('then Continue is back on the ready screen, live, with no Back into the saved questions',again.cta==='Continue'&&!again.disabled&&again.busy===null&&again.back==='none'&&again.screen==='ready',again);
  dead=false;await next(page);await page.waitForURL(url=>url.pathname==='/subscribe.html');
  ok('…and a second tap reaches the price, with the marker still set',page.url()===base+'/subscribe.html?setup=1'&&await page.evaluate(()=>Sona.setupAfter()===true)&&priced(requests).length===2,priced(requests));
  clean('price never loads',errors);
 }finally{await context.close();}
 // …and the same on the way BACK to the price (a marker, still unpaid): the
 // blank page gives way to the ready screen after 8 seconds, never to the hello
 const again=await phone({setUp:true,stamp:'post',marker:true});try{
  let dead=true;await again.context.route('**/subscribe.html**',route=>dead?route.abort('aborted'):route.fulfill({status:200,contentType:'text/html',body:PRICE}));
  await again.page.clock.install();
  // (the page's clock runs on by itself too, so nothing here may wait on the
  // page: the visit is counted from the moment the page starts leaving)
  await again.page.goto(base+'/onboarding.html',{waitUntil:'commit'}).catch(()=>{});await again.page.waitForFunction(()=>document.documentElement.classList.contains('ob-leaving'));
  await again.page.clock.runFor(7000);
  const held=await again.page.evaluate(()=>({html:document.documentElement.className,ob:getComputedStyle(document.querySelector('.ob')).visibility,foot:getComputedStyle(document.querySelector('.obfoot')).visibility}));
  ok('sent back to a price that does not load, the page stays blank for 8 seconds (its hello never shows)',/ob-leaving/.test(held.html)&&held.ob==='hidden'&&held.foot==='hidden',held);
  await again.page.clock.runFor(1500);
  // one real frame: under Reduce Motion every change, this one included, is a
  // 0.01 ms transition, and a transition reads as its starting value until a frame is drawn
  await new Promise(r=>setTimeout(r,300));
  const shown=await again.page.evaluate(()=>({html:document.documentElement.className,ob:getComputedStyle(document.querySelector('.ob')).visibility,screen:document.body.dataset.setupScreen,title:document.getElementById('readyTitle').textContent,cta:document.getElementById('nextBtn').textContent.trim(),disabled:document.getElementById('nextBtn').disabled,back:getComputedStyle(document.getElementById('backBtn')).display,marker:Sona.setupAfter()}));
  ok('…then it shows the ready screen with a live Continue, the marker kept, and no Back',!/ob-leaving|ob-resume/.test(shown.html)&&shown.ob==='visible'&&shown.screen==='ready'&&shown.title==='Mia\'s practice is ready!'&&shown.cta==='Continue'&&!shown.disabled&&shown.back==='none'&&shown.marker===true,shown);
  dead=false;await next(again.page);await again.page.waitForURL(url=>url.pathname==='/subscribe.html');
  ok('…whose Continue reaches the price',again.page.url()===base+'/subscribe.html?setup=1');
  clean('price never loads on the way back',again.errors);
 }finally{await again.context.close();}
});

// ── the page's source: what other files hold it to ──
{
 const src=readFileSync(root+'/onboarding.html','utf8'),code=src.replace(/<!--[\s\S]*?-->/g,' ').replace(/\/\*[\s\S]*?\*\//g,' ').replace(/(^|[^:"'\\])\/\/[^\n]*/g,'$1');
 ok('the hand-off\'s last tap: an unpaid family is never handed a locked game; a clinician still ends on Home; the first game is marked only there',/if\(wall\)\{try\{sessionStorage\.setItem\("sona\.gate\.v1",String\(Date\.now\(\)\)\);\}catch\(e\)\{\} location\.href="\/subscribe\.html\?setup=1";return;\}\s*var first="\/today\.html";try\{if\(draft\.role!=="slp"&&!AFTER&&Sona\.firstGameStart\)first=Sona\.firstGameStart\(\);\}catch\(e\)\{\}\s*location\.href=first;/.test(src)&&(code.match(/Sona\.firstGameStart\(\)/g)||[]).length===1);
 const leave=code.slice(code.indexOf('function leaveReady('),code.indexOf('function showHandoff('));
 ok('leaving ready (or the reminder after it) saves the profile and writes the marker before it names the price page',leave.indexOf('saveSetup()')>0&&leave.indexOf('saveSetup()')<leave.indexOf('Sona.setupAfterMark')&&leave.indexOf('Sona.setupAfterMark')<leave.indexOf('"/subscribe.html?setup=1"'),leave.slice(0,200));
 ok('every "setup step" is sent through SonaAnalytics, with the screen\'s key and nothing else',(code.match(/SonaAnalytics\.track\("setup step",\{step:key\}\)/g)||[]).length===1&&!/(?:^|[^.\w])track\("setup step"/.test(code)&&!/Sona\.track\(/.test(code));
 // setup is silent but for one tap (Travis, 22 Oct 2026: "even have like the
 // voice say your R sound"): no spoken line, ever, and one recording
 ok('no spoken line came in (never Sona.speak), and the one sound setup can play is one Sona.mediaPCM call',!/Sona\.speak(Now)?\(/.test(src)&&(code.match(/Sona\.mediaPCM\(/g)||[]).length===1&&!/speechSynthesis|SpeechSynthesisUtterance/.test(code));
 ok('…and Rachel\'s take is her one recording of the sound, never her raw July lines',/"\/coach\/say-echo\/R-sound\.wav"/.test(code)&&!/\/coach\/say\//.test(code));
 const css=readFileSync(root+'/onboarding-crafted.css','utf8');
 ok('its stylesheet pauses taps on the steps and the footer while a screen settles',/body\.ob-settling \.ob \.step,\s*body\.ob-settling \.obfoot\s*\{\s*pointer-events:\s*none;\s*\}/.test(css));
 ok('the hello is the orchard without Echo painted in (orchard-game), never the one with him (welcome-orchard)',/orchard-game\.webp/.test(css)&&!/welcome-orchard/.test(css+src));
 ok('the page\'s own <style> holds no colour: every colour is the crafted sheet\'s',!/#[0-9a-f]{3,8}\b|rgba?\(/i.test([...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g,' ')));
}
await browser.close();await new Promise(resolve=>server.close(resolve));console.log(failures?failures+' FAILURES / '+checks+' assertions':'ALL GREEN — '+checks+' assertions');process.exit(failures?1:0);
