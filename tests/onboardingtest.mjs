// Setup grants permission, not practice credit. Device and speech edges are
// silent fakes; page navigation, profile/draft storage, and controls are real.
import {createServer} from 'http';
import {readFileSync,existsSync,statSync} from 'fs';
import path from 'path';
import {tmpdir} from 'os';
import {chromium,ROOT,launchOpts} from './_env.mjs';
const root=process.env.SONATEST_PUBLIC_ROOT||ROOT,base='http://127.0.0.1:8198';
const mime={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',webp:'image/webp',woff2:'font/woff2'};
const server=createServer((req,res)=>{const u=new URL(req.url,base),file=path.join(root,u.pathname);if(u.pathname.startsWith('/api/')){res.writeHead(503,{'content-type':'application/json'});res.end('{}');return;}if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':mime[file.split('.').pop()]||'application/octet-stream'});res.end(readFileSync(file));});
await new Promise(resolve=>server.listen(8198,'127.0.0.1',resolve));
const browser=await chromium.launch(launchOpts());let checks=0,failures=0;
function ok(name,pass,detail=''){checks++;if(!pass)failures++;console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' → '+JSON.stringify(detail)));}
async function scenario(name,fn){try{await fn();}catch(e){ok(name+' completes without a page/harness error',false,e.stack);}}
function edges(config){
  const h=window.__setup={requests:[],tracks:[],order:[],hidden:false,speech:[],complete:0,confetti:0};
  h.keyboardCalls=[];h.keyboardListeners={};
  if(config.keyboardPlatform){
    const keyboard={setAccessoryBarVisible(options){h.keyboardCalls.push(options);return Promise.resolve();},addListener(name,callback){h.keyboardListeners[name]=callback;return Promise.resolve({remove(){}});}};
    window.Capacitor={isNativePlatform:()=>!!config.native,getPlatform:()=>config.keyboardPlatform,Plugins:config.keyboardMissing?{}:{Keyboard:keyboard}};
  }
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>h.hidden});
  h.background=()=>{h.hidden=true;document.dispatchEvent(new Event('visibilitychange'));};h.foreground=()=>{h.hidden=false;document.dispatchEvent(new Event('visibilitychange'));};
  navigator.mediaDevices.getUserMedia=()=>new Promise((resolve,reject)=>{h.order.push('microphone');const req={grant(){const tracks=[0,1].map(()=>{const t={readyState:'live',stop(){t.readyState='ended';h.order.push('stop');}};h.tracks.push(t);return t;});resolve({getTracks:()=>tracks,getAudioTracks:()=>tracks});},deny(){reject(new DOMException('Denied','NotAllowedError'));}};h.requests.push(req);if(config.permission==='grant')req.grant();else if(config.permission==='deny')req.deny();});
  let sona;
  Object.defineProperty(window,'Sona',{configurable:true,get:()=>sona,set(value){sona=value;value.isNativeApp=()=>!!config.native;value.speechPerm=()=>{h.order.push('speech permission');return Promise.resolve(true);};value.speak=value.speakNow=text=>{if(String(text||'').trim())h.speech.push(text);return Promise.resolve();};value.confetti=()=>h.confetti++;Object.keys(value.sfx||{}).forEach(k=>{if(typeof value.sfx[k]==='function')value.sfx[k]=()=>{if(k==='complete')h.complete++;};});}});
  if(!localStorage.getItem('sona.test.setupseed')){localStorage.setItem('sona.test.setupseed','1');localStorage.setItem('sona.profile.v1',JSON.stringify({voiceOn:true,soundOn:false,volume:0.7}));}
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
  // Follow the real handoff URL without starting a second test's game/mic.
  await context.route('**/charge.html?**',route=>route.fulfill({status:200,contentType:'text/html',body:'<p>Practice destination</p>'}));
  await context.route('**/today.html',route=>route.fulfill({status:200,contentType:'text/html',body:'<p>Home destination</p>'}));
  await context.route('**/arcade-*.html',route=>route.fulfill({status:200,contentType:'text/html',body:'<p>Game destination</p>'}));
  const page=await context.newPage();page.setDefaultTimeout(3500);const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));
  page.on('dialog',dialog=>dialog.dismiss());await page.goto(base+'/onboarding.html');return {context,page,errors,requests};
}
async function next(page){await page.locator('#nextBtn').click();}
// The first screen asks who is setting Sona up (Travis, 1 Oct 2026); either
// answer goes straight on, so a parent's one tap reaches the name.
async function who(page,role='parent'){await page.locator('.who-pick[data-role="'+role+'"]').click();}
async function toName(page){await who(page);await page.locator('[data-step="name"].on').waitFor();}
async function enter(page,{mode='speech',age='4',name='Milo'}={}){await toName(page);await page.locator('#obName').fill(name);await page.locator('#obAge [data-age="'+age+'"]').click();await next(page);if(mode!=='speech')await page.locator('#obExploreSounds').click();}
async function choose(page,sound='R'){
  const chip=page.locator('#obSounds [data-sound="'+sound+'"]');
  if(await chip.count()){if(await chip.getAttribute('aria-pressed')!=='true')await chip.click();}else await page.locator('#obSounds .sound').filter({hasText:new RegExp('^'+sound+'$')}).click();
}
async function notNow(page){const b=page.locator('#micNotNow');if(await b.count())await b.click();else await next(page);await pastRachel(page);}
// Meet Rachel is the last screen before the game for a parent's first child
// (1 Oct 2026): it asks nothing, so the walks that are not about her pass it.
async function pastRachel(page){if(await page.locator('[data-step="rachel"].on').waitFor({timeout:700}).then(()=>true,()=>false))await next(page);}
async function atHandoff(page){await pastRachel(page);await page.locator('[data-step="achieve"].on').waitFor();}
function clean(name,errors){ok(name+': no runtime errors',errors.length===0,errors);}
function pairPosts(requests){return requests.filter(r=>new URL(r.url).pathname==='/api/pair'&&r.method==='POST');}

await scenario('sound selection and private paced handoff',async()=>{
 const {context,page,errors,requests}=await fresh();try{
  ok('welcome uses the moving-phone link without a website purchase pitch',/Moving from another phone/.test(await page.locator('#moveLink').innerText())&&!/Bought Sona/.test(await page.locator('[data-step="welcome"]').innerText()));
  ok('three progress groups match the three setup questions',await page.locator('#seg i').count()===3);
  ok('the younger age band includes two-year-olds',/2–4/.test(await page.locator('#obAge [data-age="4"]').innerText()));
  await enter(page);
  ok('name and age lead directly to sound choices without a direction page',await page.locator('[data-step="sounds"].on').count()===1&&await page.locator('[data-step="path"]').count()===0);
  ok('R starts selected and the first row is R S L TH',await page.locator('#obSounds .on').getAttribute('data-sound')==='R'&&JSON.stringify(await page.locator('#obSounds .sound').evaluateAll(bs=>bs.slice(0,4).map(b=>b.dataset.sound)))==='["R","S","L","TH"]');
  const choices=await page.evaluate(()=>({labels:[...document.querySelectorAll('#obSounds .sound')].map(b=>({text:b.textContent.trim(),label:Sona.soundLabel(b.dataset.sound),font:parseFloat(getComputedStyle(b.querySelector('span')||b).fontSize),width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})),copy:document.querySelector('[data-step="sounds"]').textContent,overflow:document.documentElement.scrollWidth>innerWidth}));
  ok('sound choices show large letters without example words',choices.labels.length===19&&choices.labels.every(b=>b.text===b.label&&b.font>=23),choices.labels);
  ok('sound selection stays concise and uses no clinician terminology',choices.copy.trim().split(/\s+/).length<65&&!/\bSLPs?\b|speech-language|pathologist/i.test(choices.copy),choices.copy);
  ok('sound buttons remain easy to tap without overflowing a small phone',!choices.overflow&&choices.labels.every(b=>b.width>=44&&b.height>=44),choices);
  await choose(page);ok('selecting a target enables Continue',await page.locator('#nextBtn').isEnabled());
  await page.locator('#obSounds [data-sound="R"]').click();ok('the last selected target can be cleared',await page.locator('#obSounds .on').count()===0&&await page.locator('#nextBtn').isDisabled());
  await choose(page,'S');await next(page);
  const promise=await page.evaluate(()=>({visible:document.getElementById('micPromise')?.textContent||'',shared:Sona.MIC_PROMISE||''}));
  ok('setup renders the shared accurate microphone promise',!!promise.shared&&promise.visible===promise.shared&&/listens only after asking/.test(promise.visible)&&/stay on this device/.test(promise.visible)&&promise.visible.split(/\s+/).length<=30);
  ok('microphone action is explicit and offers a quiet skip',/Turn on Echo's ears/.test(await page.locator('#nextBtn').innerText())&&await page.locator('#micNotNow').count()===1);
  const began=Date.now();await notNow(page);
  const build=await page.evaluate(()=>({shown:!!document.querySelector('#obBuild.show'),text:document.getElementById('obBuild')?.textContent||'',color:document.getElementById('obBuild')?getComputedStyle(document.getElementById('obBuild')).backgroundColor:'',complete:__setup.complete,confetti:__setup.confetti}));
  ok('a calm build shows the actual name age and chosen sound',build.shown&&/Milo/.test(build.text)&&/2–4/.test(build.text)&&/S/.test(build.text)&&build.color==='rgb(255, 246, 233)',build);
  ok('setup does not spend the first-win celebration',build.complete===0&&build.confetti===0,build);
  await atHandoff(page);
  ok('the build gets a short readable beat',Date.now()-began>=1750);
  ok('handoff is personalized and its button works immediately',await page.locator('#handoffTitle').count()===1&&/Hand the phone to Milo!/.test(await page.locator('#handoffTitle').innerText())&&await page.locator('#nextBtn').isEnabled());
  const result=await page.evaluate(()=>({profile:Sona.getProfile(),mic:localStorage.getItem('sona.micok'),requests:__setup.requests.length,speech:__setup.speech,recommended:Sona.activityLibrary().recommended}));
  ok('Not now saves choices without asking or pretending microphone permission',result.requests===0&&result.mic!=='1'&&result.profile.onboarded&&JSON.stringify(result.profile.focusSounds)==='["S"]',result);
  ok('the handoff does not send the child name into generated speech',result.speech.every(t=>!t.includes('Milo')));
  ok('setup and the handoff stay silent even with voice enabled',result.speech.length===0,result.speech);
  await page.waitForTimeout(3200);
  ok('the family controls when the handoff ends',new URL(page.url()).pathname==='/onboarding.html');
  ok('finishing web setup never uploads an automatic backup',pairPosts(requests).length===0,pairPosts(requests));
  if(new URL(page.url()).pathname==='/onboarding.html'){
   const fits=await page.evaluate(()=>{const b=document.getElementById('nextBtn').getBoundingClientRect(),h=document.getElementById('handoffTitle').getBoundingClientRect();return b.bottom<=innerHeight&&h.top>=0&&document.documentElement.scrollWidth<=innerWidth;});ok('handoff heading and button fit a small phone',fits);
   ok('young-child setup prepares the Simple play suggestion on Home',result.recommended==='simple',result.recommended);
   await page.locator('#achEmailInput').fill('parent@example.com');await page.locator('#achEmailInput').press('Enter');
   ok('Done in the optional email leaves the family in control of the handoff',new URL(page.url()).pathname==='/onboarding.html'&&await page.evaluate(()=>document.activeElement.id!=='achEmailInput'&&!Sona.getProfile().email));
   await next(page);await page.waitForURL(url=>['/today.html','/charge.html','/arcade-feed.html'].includes(url.pathname));const u=new URL(page.url());
   // Travis, 27 Sep 2026: setup goes straight to the first game, Feed Echo for ages 3-4
   ok('handoff opens the first game for the child\'s age: Feed Echo at 4',u.pathname==='/arcade-feed.html'&&!u.search&&await page.evaluate(()=>sessionStorage.getItem('sona.firstgame.v1')==='feed'));
   ok('setup creates no run and starts no practice of its own',!requests.some(r=>new URL(r.url).pathname==='/charge.html')&&await page.evaluate(()=>!sessionStorage.getItem('sona.run.v1')));
   ok('the play button still saves an explicitly entered optional email',await page.evaluate(()=>JSON.parse(localStorage.getItem('sona.profile.v1')).email==='parent@example.com'));
  }
  clean('sound/skip handoff',errors);
 }finally{await context.close();}
});

// The first screen asks who is setting Sona up (Travis, 1 Oct 2026: "have the
// very first step in onboarding ask if they are a parent/caregiver or an
// slp/slpa"). Two answers, each one tap; no Continue to press.
await scenario('the first screen asks who is setting Sona up',async()=>{
 {const {context,page,errors,requests}=await fresh();try{
  const first=await page.evaluate(()=>({screen:document.body.dataset.setupScreen,title:document.getElementById('whoTitle').textContent,picks:[...document.querySelectorAll('.who-pick')].map(b=>b.innerText.replace(/\s+/g,' ').trim()),footer:getComputedStyle(document.querySelector('.obfoot')).display,words:document.querySelector('[data-step="welcome"]').innerText.trim().split(/\s+/).length}));
  ok('the very first screen is the question, in a few words',first.screen==='welcome'&&/Who's setting up Sona\?/.test(first.title)&&first.words<=32,first);
  ok('…with two answers: a parent or caregiver, or an SLP or SLPA',first.picks.length===2&&/^Parent or caregiver/.test(first.picks[0])&&/^SLP or SLPA/.test(first.picks[1])&&/speech-language pathologist or assistant/i.test(first.picks[1]),first.picks);
  ok('…and the answers are the buttons: no Continue to press',first.footer==='none',first.footer);
  await who(page,'parent');
  ok('a parent goes straight to the child\'s name, the first of three progress segments',await page.locator('[data-step="name"].on').count()===1&&/Who's practicing/.test(await page.locator('[data-step="name"] .qh').innerText())&&await page.locator('#seg i').count()===3&&await page.locator('#seg i.on').count()===1&&await page.evaluate(()=>draft.role==='parent'&&ORDER===ORDER_PARENT));
  await page.locator('#backBtn').click();
  ok('Back returns to the question',await page.locator('[data-step="welcome"].on').count()===1&&await page.locator('#backBtn').isHidden());
  await who(page,'slp');
  ok('in a browser an SLP or SLPA gets the clinician setup, in a clinician\'s words',await page.evaluate(()=>draft.role==='slp'&&ORDER===ORDER_SLP&&document.body.dataset.setupScreen==='name'&&/Which child/.test(document.querySelector('[data-step="name"] .qh').textContent)&&document.getElementById('slpAppNote').hidden));
  ok('…and no clinician request is made just by answering',!requests.some(r=>new URL(r.url).pathname.startsWith('/api/slp/')),requests.map(r=>r.url));
  clean('first question',errors);
 }finally{await context.close();}}
 // The iPhone app never opens clinician screens (NATIVE.md): an SLP sets the
 // app up for a child, in a clinician's words, and is told where the dashboard is.
 {const {context,page,errors,requests}=await fresh({native:true});try{
  await who(page,'slp');
  const st=await page.evaluate(()=>({order:ORDER===ORDER_PARENT,role:draft.role,screen:document.body.dataset.setupScreen,title:document.querySelector('[data-step="name"] .qh').textContent,note:document.getElementById('slpAppNote').hidden?'':document.getElementById('slpAppNote').textContent}));
  ok('in the app an SLP or SLPA sets the app up for a child, never the clinician steps',st.order&&st.screen==='name'&&/Which child/.test(st.title),st);
  ok('…and is told the clinician dashboard is on the web, with no link and no price',/dashboard is on the web/.test(st.note)&&!/\$|price|Premium|<a/i.test(st.note),st.note);
  await page.locator('#obName').fill('Milo');await page.locator('#obAge [data-age="6"]').click();await next(page);await choose(page,'S');await next(page);await notNow(page);await atHandoff(page);
  ok('…finishing as an SLP with no clinician request',await page.evaluate(()=>Sona.getProfile().role==='slp'&&Sona.getProfile().onboarded)&&!requests.some(r=>new URL(r.url).pathname.startsWith('/api/slp/')),requests.map(r=>r.url));
  clean('native SLP answer',errors);
 }finally{await context.close();}}
});

// Meet Rachel (Travis, 29 Sep 2026; moved 1 Oct 2026: "add the rachel slide
// right before it goes to the game ... even just saying and spelling out that
// she is a pediatric speech language pathologist is enough"): one tap, no
// question, after the microphone: her photo, "Built with", her name with her
// letters, and one sentence. The fellowship is named here because it is true;
// never CCC or certified (CLAUDE.md). Clinicians skip it; parents still count three.
async function toRachel(page){await toName(page);await page.locator('#obName').fill('Milo');await page.locator('#obAge [data-age="4"]').click();await next(page);await choose(page,'S');await next(page);await page.locator('#micNotNow').click();}
await scenario('Meet Rachel is the last screen before the game',async()=>{
 {const {context,page,errors}=await fresh();try{
  await toRachel(page);const card=page.locator('[data-step="rachel"]');
  ok('after the microphone, Meet Rachel comes before the game',await page.locator('[data-step="rachel"].on').count()===1&&await page.evaluate(()=>document.body.dataset.setupScreen)==='rachel');
  const shown=await card.evaluate(async el=>{const img=el.querySelector('img');return {photo:await img.decode().then(()=>img.naturalWidth,()=>0),src:img.getAttribute('src'),alt:img.alt,text:el.innerText,page:document.body.innerText,asks:el.querySelectorAll('input,select,textarea,button').length};});
  ok('her photo actually loads',shown.photo>0&&/\/rachel-wardrop-profile\.jpg$/.test(shown.src)&&/Rachel/.test(shown.alt),shown);
  ok('the card says "Built with Rachel Wardrop, MS, CF-SLP" and that she is a pediatric speech-language pathologist in her clinical fellowship',shown.text.replace(/\s+/g,' ').trim()==='BUILT WITH Rachel Wardrop, MS, CF-SLP She is a pediatric speech-language pathologist in her clinical fellowship.',shown.text);
  ok('no CCC, certification or claim that the fellowship is behind her',!/\bCCC\b|certified|fully licen[sc]ed/i.test(shown.page+' '+shown.alt),shown.page);
  ok('it asks nothing: Continue is ready and the progress bar is hidden',shown.asks===0&&(await page.locator('#nextBtn').innerText()).trim()==='Continue'&&await page.locator('#nextBtn').isEnabled()&&await page.locator('#seg').isHidden());
  await page.locator('#backBtn').click();ok('Back from Meet Rachel returns to the microphone',await page.locator('[data-step="mic"].on').count()===1&&await page.locator('#seg').isVisible());
  await page.locator('#micNotNow').click();await page.locator('[data-step="rachel"].on').waitFor();
  await next(page);await atHandoff(page);
  ok('Continue goes on to the hand-off, then the game',await page.locator('[data-step="achieve"].on').count()===1&&await page.evaluate(()=>Sona.getProfile().onboarded));
  clean('meet rachel',errors);
 }finally{await context.close();}}
 {const {context,page,errors}=await fresh();try{
  await page.evaluate(()=>{window.__screens=[];new MutationObserver(()=>__screens.push(document.body.dataset.setupScreen)).observe(document.body,{attributes:true,attributeFilter:['data-setup-screen']});});
  // Back to the question leaves the clinician path (a mistaken tap), so it is answered again.
  await who(page,'slp');await page.locator('#backBtn').click();await who(page,'slp');
  await page.locator('#obName').fill('Milo');await page.locator('#obAge [data-age="4"]').click();await next(page);await choose(page,'S');await next(page);
  const screens=await page.evaluate(()=>__screens);
  ok('the clinician setup never shows Meet Rachel, forward or back',screens[0]==='name'&&!screens.includes('rachel')&&await page.locator('[data-step="slp"].on').count()===1,screens);
  clean('clinician skips rachel',errors);
 }finally{await context.close();}}
 {const {context,page,errors}=await fresh();try{
  // Settings → Add a child: the household already has a child, and the parent met Rachel with them.
  await page.evaluate(()=>localStorage.setItem('sona.kids.v1',JSON.stringify({active:'k2',list:[{slot:'',name:'Milo'},{slot:'k2',name:'Rosie'}]})));await page.reload();
  await toName(page);await page.locator('#obName').fill('Rosie');await page.locator('#obAge [data-age="4"]').click();await next(page);await choose(page,'S');await next(page);await page.locator('#micNotNow').click();
  ok('a parent adding a second child goes from the microphone straight to the hand-off',await page.locator('[data-step="achieve"].on').waitFor().then(()=>true,()=>false)&&await page.locator('[data-step="rachel"].on').count()===0);
  clean('second child skips rachel',errors);
 }finally{await context.close();}}
 for(const viewport of [{width:375,height:667},{width:320,height:568}]){
  const {context,page,errors}=await fresh({viewport});try{
   await toRachel(page);await page.locator('[data-step="rachel"].on').waitFor();await page.evaluate(()=>Promise.all([document.fonts.ready,document.querySelector('.rachel-photo').decode().catch(()=>{})]));await page.locator('.step.on').evaluate(el=>el.getAnimations({subtree:true}).forEach(a=>a.finish()));
   await page.waitForTimeout(600); // Wait for the shared step/header transition to settle.
   const fit=await page.evaluate(()=>{const ob=document.querySelector('.ob'),c=document.querySelector('[data-step="rachel"]').getBoundingClientRect(),b=document.querySelector('#nextBtn').getBoundingClientRect();return {scrollHeight:ob.scrollHeight,height:ob.clientHeight,cardTop:c.top,cardBottom:c.bottom,buttonTop:b.top,buttonBottom:b.bottom,innerHeight};});
   ok('Meet Rachel fits without scrolling, card clear of Continue, at '+viewport.width+'×'+viewport.height,fit.scrollHeight<=fit.height+1&&fit.cardTop>=0&&fit.cardBottom<=fit.buttonTop&&fit.buttonTop>=0&&fit.buttonBottom<=fit.innerHeight,fit);
   clean('meet rachel fit',errors);
  }finally{await context.close();}
 }
});

await scenario('exploring sounds stays optional and can be changed before finishing',async()=>{
 const {context,page,errors}=await fresh();try{
  await enter(page);await choose(page,'R');await page.locator('#obExploreSounds').click();
  ok('Explore all sounds opens microphone permission without inventing targets',await page.locator('[data-step="mic"].on').count()===1&&await page.evaluate(()=>draft.mode==='play'&&draft.pathReason==='unsure'&&draft.focusSounds.length===0));
  await page.locator('#backBtn').click();
  ok('Back from microphone returns to the same sound choices after exploring',await page.locator('[data-step="sounds"].on').count()===1&&await page.locator('#obSounds .on').count()===0&&await page.locator('#nextBtn').isDisabled());
  await choose(page,'S');await next(page);
  ok('choosing a sound replaces the general-play choice',await page.evaluate(()=>draft.mode==='speech'&&draft.pathReason===''&&JSON.stringify(draft.focusSounds)==='["S"]'));
  await page.locator('#backBtn').click();await page.locator('#backBtn').click();
  ok('Back from the sound picker returns straight to name and age',await page.locator('[data-step="name"].on').count()===1);
  await next(page);await next(page);await notNow(page);await atHandoff(page);
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
  if(nameDone.step!=='name')await page.locator('#backBtn').click();
  await page.locator('#obAge [data-age="4"]').click();await next(page);await choose(page,'S');await next(page);
  await page.locator('#obGoals').fill('Clear sounds in words');await page.locator('#obGoals').press('Enter');
  ok('Done in goals stays on the same setup question',await page.locator('[data-step="slp"].on').count()===1&&await page.evaluate(()=>document.activeElement.id!=='obGoals'));
  await next(page);await page.locator('#obEmail').fill('clinician@example.com');await page.locator('#obEmail').press('Enter');
  const accountPosts=()=>requests.filter(r=>r.method==='POST'&&['/api/lead','/api/slp/auth/request'].includes(new URL(r.url).pathname));
  ok('Done in clinician email dismisses focus without creating an account',await page.locator('[data-step="email"].on').count()===1&&await page.evaluate(()=>document.activeElement.id!=='obEmail'&&!Sona.getProfile().onboarded)&&accountPosts().length===0,accountPosts());
  await next(page);await atHandoff(page);
  ok('Continue still accepts the clinician email and sends each intended request once',await page.evaluate(()=>Sona.getProfile().email==='clinician@example.com')&&accountPosts().filter(r=>new URL(r.url).pathname==='/api/lead').length===1&&accountPosts().filter(r=>new URL(r.url).pathname==='/api/slp/auth/request').length===1,accountPosts());
  clean('Done actions',errors);
 }finally{await context.close();}
});

// A reload restores draft.role; the order has to follow it or a clinician
// finishes on the family path with no email step and no account.
async function walk(page){const seen=[];for(let i=0;i<8;i++){const s=await page.evaluate(()=>document.body.dataset.setupScreen);seen.push(s);if(s==='email'||s==='mic')break;if(s==='welcome'){await who(page);continue;}if(s==='name'&&!await page.locator('#obName').inputValue())await page.locator('#obName').fill('Milo');await next(page);}return seen;}
await scenario('clinician setup survives a reload',async()=>{
 const {context,page,errors,requests}=await fresh();try{
  await who(page,'slp');await page.locator('#obName').fill('Milo');await next(page);
  await page.reload();
  ok('a reloaded clinician draft resumes on the clinician order at name',await page.evaluate(()=>draft.role==='slp'&&ORDER===ORDER_SLP&&document.body.dataset.setupScreen==='name'&&/Which child/.test(document.querySelector('[data-step="name"] .qh').textContent)&&document.getElementById('obName').value==='Milo'));
  const seen=await walk(page);
  ok('going on reaches the clinician email step, never Meet Rachel or the family mic',seen.at(-1)==='email'&&!seen.includes('rachel')&&!seen.includes('mic')&&await page.locator('[data-step="rachel"].on,[data-step="mic"].on').count()===0,seen);
  await page.locator('#obEmail').fill('clinician@example.com');await next(page);await atHandoff(page);
  ok('the reloaded clinician still gets an account and a sign-in email',await page.evaluate(()=>Sona.getProfile().role==='slp'&&Sona.getProfile().childName==='Milo')&&requests.filter(r=>r.method==='POST'&&new URL(r.url).pathname==='/api/slp/auth/request').length===1);
  clean('clinician reload',errors);
 }finally{await context.close();}
 const native=await fresh({native:true});try{
  await native.page.evaluate(()=>localStorage.setItem('sona.obdraft.v1',JSON.stringify({role:'slp',childName:'Milo'})));await native.page.reload();
  ok('a native reload with a clinician draft stays on the family order',await native.page.evaluate(()=>draft.role==='parent'&&ORDER===ORDER_PARENT));
  const seen=await walk(native.page);ok('native setup never reaches the clinician email step',seen.at(-1)==='mic'&&!seen.includes('email')&&!seen.includes('slp'),seen);
  clean('native clinician draft',native.errors);
 }finally{await native.context.close();}
});

// The first question is the fork: backing onto it undoes a mistaken "SLP or SLPA".
await scenario('a parent can back out of clinician setup',async()=>{
 const {context,page,errors,requests}=await fresh();try{
  await who(page,'slp');await page.locator('#backBtn').click();
  ok('Back to welcome returns to the family order and wording',await page.evaluate(()=>draft.role!=='slp'&&ORDER===ORDER_PARENT&&document.body.dataset.setupScreen==='welcome'&&/Who's practicing/.test(document.querySelector('[data-step="name"] .qh').textContent)&&document.querySelectorAll('#seg i').length===3));
  await page.reload();ok('a reload after backing out stays on the family order',await page.evaluate(()=>ORDER===ORDER_PARENT&&document.body.dataset.setupScreen==='welcome'));
  const seen=await walk(page);
  ok('answering again walks the family path to the mic, never the clinician email',seen.join()==='welcome,name,sounds,mic',seen);
  await notNow(page);await atHandoff(page);
  ok('the backed-out parent finishes as a parent with no clinician sign-in',await page.evaluate(()=>Sona.getProfile().role==='parent')&&!requests.some(r=>new URL(r.url).pathname==='/api/slp/auth/request'));
  clean('clinician back-out',errors);
 }finally{await context.close();}
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
  await enter(page,{mode:'play',age:'6',name:'Ava'});await next(page);
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
  await enter(page,{mode:'unsure'});await next(page);
  const denial=page.locator('#sonaMicDenied');await denial.waitFor({state:'visible'}).catch(()=>{});
  ok('denied permission shows recovery and never sets micok',await denial.count()===1&&await page.evaluate(()=>localStorage.getItem('sona.micok')!=='1'));
  if(await denial.count()){await page.locator('#sonaMicBack').click();await notNow(page);await atHandoff(page);ok('the grown-up can still finish with Not now',await page.locator('#nextBtn').isEnabled()&&await page.evaluate(()=>Sona.getProfile().onboarded));}
  clean('denied permission',errors);
 }finally{await context.close();}
});

await scenario('permission finishes after backgrounding',async()=>{
 const {context,page,errors}=await fresh({permission:'pending'});try{
  await enter(page,{mode:'play'});await next(page);await page.waitForFunction(()=>__setup.requests.length===1).catch(()=>{});
  const count=await page.evaluate(()=>__setup.requests.length);ok('only one permission request can be outstanding',count===1&&await page.locator('#nextBtn').isDisabled());
  if(count){await page.evaluate(()=>{__setup.background();__setup.requests[0].grant();});await page.waitForTimeout(60);const late=await page.evaluate(()=>({tracks:__setup.tracks.map(t=>t.readyState),mic:localStorage.getItem('sona.micok'),finished:Sona.getProfile().onboarded}));ok('a late grant is released without advancing hidden setup',late.tracks.every(t=>t==='ended')&&late.mic!=='1'&&!late.finished,late);await page.evaluate(()=>__setup.foreground());await notNow(page);await atHandoff(page);ok('an interrupted permission ask leaves a working skip',await page.locator('#nextBtn').isEnabled());}
  clean('late microphone',errors);
 }finally{await context.close();}
});

await scenario('move-in code sheet',async()=>{
 const {context,page,errors,requests}=await fresh();try{
  await page.locator('#moveLink').click();const sheet=page.locator('#moveSheet');
  ok('the returning-family door opens a labeled sheet instead of a prompt',await sheet.count()===1&&await sheet.isVisible());
  if(await sheet.count()){
   ok('code entry receives keyboard focus',await page.evaluate(()=>document.activeElement.id==='moveInput'));
   await page.keyboard.press('Escape');ok('Escape closes and returns focus',!await sheet.isVisible()&&await page.evaluate(()=>document.activeElement.id==='moveLink'));
   await page.locator('#moveLink').click();await page.locator('#moveInput').fill('abc');ok('an incomplete code cannot be submitted',await page.locator('#moveSubmit').isDisabled());
   await context.route('**/api/pair?code=ABC234',route=>route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({ok:false,error:'That code is no longer available.'})}));
   await page.locator('#moveInput').fill('abc234');await page.locator('#moveSubmit').click();await page.waitForFunction(()=>document.getElementById('moveError').textContent.includes('no longer'));
   ok('a failed code stays in the sheet with a useful error',await sheet.isVisible()&&await page.locator('#moveSubmit').isEnabled());
   const backup=JSON.stringify({app:'sona',v:1,data:{'sona.profile.v1':JSON.stringify({childName:'Restored',childAge:'7',onboarded:true,focusSounds:['S'],volume:0,voiceOn:false})}});
   await context.route('**/api/pair?code=XYZ789',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:backup})}));
   await page.locator('#moveInput').fill('XYZ789');await page.locator('#moveInput').press('Enter');await page.waitForURL('**/today.html');
   ok('explicit code redemption restores the save and returns Home',await page.evaluate(()=>JSON.parse(localStorage.getItem('sona.profile.v1')).childName)==='Restored');
  }
  ok('code entry only retrieves an explicitly entered backup',pairPosts(requests).length===0);
  clean('code sheet',errors);
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
await scenario('phone fit and optional email close',async()=>{
 const {context,page,errors,requests}=await fresh({native:true,keyboardPlatform:'ios'});try{
  await page.setViewportSize({width:393,height:852});
  await page.waitForTimeout(300);
  ok('welcome fits the phone without scrolling',await page.evaluate(()=>{var ob=document.querySelector('.ob');return ob.scrollHeight<=ob.clientHeight+1&&document.documentElement.scrollHeight<=innerHeight;}));
  await page.screenshot({path:path.join(tmpdir(),'sona-welcome-polish.png')});
  await enter(page);await page.waitForTimeout(600);await page.screenshot({path:path.join(tmpdir(),'sona-sounds-polish.png')});await next(page);await notNow(page);await atHandoff(page);
  ok('email handoff fits without scrolling',await page.evaluate(()=>{var ob=document.querySelector('.ob');return ob.scrollHeight<=ob.clientHeight+1;}));
  ok('email copy is short and does not promise extra tips',!/Rachel|occasional tips/.test(await page.locator('[data-step="achieve"]').innerText()));
  await page.screenshot({path:path.join(tmpdir(),'sona-email-polish.png')});
  await page.setViewportSize({width:393,height:430});
  await page.evaluate(()=>__setup.keyboardListeners.keyboardWillShow({keyboardHeight:422}));
  await page.locator('#achEmailInput').fill('skip@example.com');
  ok('email X stays visible when the keyboard reduces the screen',await page.locator('#skipEmail').evaluate(el=>{var r=el.getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight&&r.width>=44&&r.height>=44;}));
  await page.locator('#skipEmail').click();await page.waitForURL('**/arcade-feed.html');
  ok('X skips email and still completes setup',!requests.some(r=>new URL(r.url).pathname==='/api/lead'&&r.method==='POST')&&await page.evaluate(()=>!JSON.parse(localStorage.getItem('sona.profile.v1')).email));
  clean('phone fit and skip',errors);
 }finally{await context.close();}
});
await browser.close();await new Promise(resolve=>server.close(resolve));console.log(failures?failures+' FAILURES / '+checks+' assertions':'ALL GREEN — '+checks+' assertions');process.exit(failures?1:0);
