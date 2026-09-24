// Setup grants permission, not practice credit. Device and speech edges are
// silent fakes; page navigation, profile/draft storage, and controls are real.
import {createServer} from 'http';
import {readFileSync,existsSync,statSync} from 'fs';
import path from 'path';
import {chromium,ROOT,launchOpts} from './_env.mjs';
const root=process.env.SONATEST_PUBLIC_ROOT||ROOT,base='http://127.0.0.1:8198';
const mime={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',webp:'image/webp',woff2:'font/woff2'};
const server=createServer((req,res)=>{const u=new URL(req.url,base),file=path.join(root,u.pathname);if(u.pathname.startsWith('/api/')){res.writeHead(503,{'content-type':'application/json'});res.end('{}');return;}if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':mime[file.split('.').pop()]||'application/octet-stream'});res.end(readFileSync(file));});
await new Promise(resolve=>server.listen(8198,'127.0.0.1',resolve));
const browser=await chromium.launch(launchOpts());let checks=0,failures=0;
function ok(name,pass,detail=''){checks++;if(!pass)failures++;console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' → '+JSON.stringify(detail)));}
async function scenario(name,fn){try{await fn();}catch(e){ok(name+' completes without a page/harness error',false,e.stack);}}
function edges(config){
  const h=window.__setup={requests:[],tracks:[],order:[],hidden:false,speech:[],complete:0,confetti:0};
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>h.hidden});
  h.background=()=>{h.hidden=true;document.dispatchEvent(new Event('visibilitychange'));};h.foreground=()=>{h.hidden=false;document.dispatchEvent(new Event('visibilitychange'));};
  navigator.mediaDevices.getUserMedia=()=>new Promise((resolve,reject)=>{h.order.push('microphone');const req={grant(){const tracks=[0,1].map(()=>{const t={readyState:'live',stop(){t.readyState='ended';h.order.push('stop');}};h.tracks.push(t);return t;});resolve({getTracks:()=>tracks,getAudioTracks:()=>tracks});},deny(){reject(new DOMException('Denied','NotAllowedError'));}};h.requests.push(req);if(config.permission==='grant')req.grant();else if(config.permission==='deny')req.deny();});
  let sona;
  Object.defineProperty(window,'Sona',{configurable:true,get:()=>sona,set(value){sona=value;value.isNativeApp=()=>!!config.native;value.speechPerm=()=>{h.order.push('speech permission');return Promise.resolve(true);};value.speak=text=>{h.speech.push(text);return Promise.resolve();};value.confetti=()=>h.confetti++;Object.keys(value.sfx||{}).forEach(k=>{if(typeof value.sfx[k]==='function')value.sfx[k]=()=>{if(k==='complete')h.complete++;};});}});
  if(!localStorage.getItem('sona.test.setupseed')){localStorage.setItem('sona.test.setupseed','1');localStorage.setItem('sona.profile.v1',JSON.stringify({voiceOn:false,soundOn:false,volume:0}));}
}
async function fresh(config={}){
  const context=await browser.newContext({viewport:{width:320,height:568},reducedMotion:'reduce'});await context.addInitScript(edges,config);
  await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
  // Follow the real handoff URL without starting a second test's game/mic.
  await context.route('**/charge.html?**',route=>route.fulfill({status:200,contentType:'text/html',body:'<p>Practice destination</p>'}));
  await context.route('**/today.html',route=>route.fulfill({status:200,contentType:'text/html',body:'<p>Home destination</p>'}));
  const page=await context.newPage();page.setDefaultTimeout(3500);const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));
  page.on('dialog',dialog=>dialog.dismiss());await page.goto(base+'/onboarding.html');return {context,page,errors,requests};
}
async function next(page){await page.locator('#nextBtn').click();}
async function enter(page,{mode='speech',age='4',name='Milo'}={}){await next(page);await page.locator('#obName').fill(name);await page.locator('#obAge [data-age="'+age+'"]').click();await next(page);await page.locator('#obPath [data-val="'+mode+'"]').click();await next(page);}
async function choose(page,sound='R'){
  const chip=page.locator('#obSounds [data-sound="'+sound+'"]');
  if(await chip.count())await chip.click();else await page.locator('#obSounds .sound').filter({hasText:new RegExp('^'+sound+'$')}).click();
}
async function notNow(page){const b=page.locator('#micNotNow');if(await b.count())await b.click();else await next(page);}
async function atHandoff(page){await page.locator('[data-step="achieve"].on').waitFor();}
function clean(name,errors){ok(name+': no runtime errors',errors.length===0,errors);}
function pairPosts(requests){return requests.filter(r=>new URL(r.url).pathname==='/api/pair'&&r.method==='POST');}

await scenario('sound selection and private paced handoff',async()=>{
 const {context,page,errors,requests}=await fresh();try{
  ok('welcome uses the moving-phone link without a website purchase pitch',/Moving from another phone/.test(await page.locator('#moveLink').innerText())&&!/Bought Sona/.test(await page.locator('[data-step="welcome"]').innerText()));
  ok('three progress groups match the three setup questions',await page.locator('#seg i').count()===3);
  ok('the younger age band includes two-year-olds',/2–4/.test(await page.locator('#obAge [data-age="4"]').innerText()));
  await enter(page);
  ok('specific-sound setup starts without an invented target',await page.locator('#obSounds .on').count()===0&&await page.locator('#nextBtn').isDisabled());
  const examples=await page.locator('#obSounds').innerText();ok('sound labels include useful R S TH and voiced-TH examples',/rabbit/.test(examples)&&/sun/.test(examples)&&/think/.test(examples)&&/this/.test(examples));
  await choose(page);ok('selecting a target enables Continue',await page.locator('#nextBtn').isEnabled());
  await choose(page);ok('the last selected target can be cleared',await page.locator('#obSounds .on').count()===0&&await page.locator('#nextBtn').isDisabled());
  await choose(page,'S');await next(page);
  const promise=await page.evaluate(()=>({visible:document.getElementById('micPromise')?.textContent||'',shared:Sona.MIC_PROMISE||''}));
  ok('setup renders the shared accurate microphone promise',!!promise.shared&&promise.visible===promise.shared&&/games/.test(promise.visible)&&/saved/.test(promise.visible));
  ok('microphone action is explicit and offers a quiet skip',/Turn on Echo's ears/.test(await page.locator('#nextBtn').innerText())&&await page.locator('#micNotNow').count()===1);
  const began=Date.now();await notNow(page);
  const build=await page.evaluate(()=>({shown:!!document.querySelector('#obBuild.show'),text:document.getElementById('obBuild')?.textContent||'',color:document.getElementById('obBuild')?getComputedStyle(document.getElementById('obBuild')).backgroundColor:'',complete:__setup.complete,confetti:__setup.confetti}));
  ok('a calm build shows the actual name age and chosen sound',build.shown&&/Milo/.test(build.text)&&/2–4/.test(build.text)&&/S/.test(build.text)&&build.color==='rgb(255, 246, 233)',build);
  ok('setup does not spend the first-win celebration',build.complete===0&&build.confetti===0,build);
  await atHandoff(page);
  ok('the build gets a short readable beat',Date.now()-began>=1750);
  ok('handoff is personalized and its button works immediately',await page.locator('#handoffTitle').count()===1&&/Hand the phone to Milo!/.test(await page.locator('#handoffTitle').innerText())&&await page.locator('#nextBtn').isEnabled());
  const result=await page.evaluate(()=>({profile:Sona.getProfile(),mic:localStorage.getItem('sona.micok'),requests:__setup.requests.length,speech:__setup.speech,plan:Sona.adventureGames()}));
  ok('Not now saves choices without asking or pretending microphone permission',result.requests===0&&result.mic!=='1'&&result.profile.onboarded&&JSON.stringify(result.profile.focusSounds)==='["S"]',result);
  ok('the handoff does not send the child name into generated speech',result.speech.every(t=>!t.includes('Milo')));
  await page.waitForTimeout(3200);
  ok('the family controls when the handoff ends',new URL(page.url()).pathname==='/onboarding.html');
  ok('finishing web setup never uploads an automatic backup',pairPosts(requests).length===0,pairPosts(requests));
  if(new URL(page.url()).pathname==='/onboarding.html'){
   const fits=await page.evaluate(()=>{const b=document.getElementById('nextBtn').getBoundingClientRect(),h=document.getElementById('handoffTitle').getBoundingClientRect();return b.bottom<=innerHeight&&h.top>=0&&document.documentElement.scrollWidth<=innerWidth;});ok('handoff heading and button fit a small phone',fits);
   ok('young-child handoff uses the shared simple-game plan',result.plan.length===5&&result.plan.every(g=>['feed','bubbles','peekaboo'].includes(g)),result.plan);
   await page.locator('#achEmailInput').fill('parent@example.com');await page.locator('#achEmailInput').press('Enter');
   ok('Done in the optional email leaves the family in control of the handoff',new URL(page.url()).pathname==='/onboarding.html'&&await page.evaluate(()=>document.activeElement.id!=='achEmailInput'&&!Sona.getProfile().email));
   await next(page);await page.waitForURL('**/charge.html?**');const u=new URL(page.url());ok('handoff enters the first actual adventure game',u.searchParams.get('daily')==='1'&&u.searchParams.get('first')===result.plan[0]);
   ok('the play button still saves an explicitly entered optional email',await page.evaluate(()=>JSON.parse(localStorage.getItem('sona.profile.v1')).email==='parent@example.com'));
  }
  clean('sound/skip handoff',errors);
 }finally{await context.close();}
});

await scenario('Done closes typing without accepting setup choices',async()=>{
 const {context,page,errors,requests}=await fresh();try{
  await page.locator('#slpLink').click();await page.locator('#obName').fill('Milo');await page.locator('#obName').press('Enter');
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

await scenario('granted microphone in native setup',async()=>{
 const {context,page,errors,requests}=await fresh({permission:'grant',native:true});try{
  await enter(page,{mode:'play',age:'6',name:'Ava'});await next(page);
  await page.waitForFunction(()=>__setup.requests.length>0).catch(()=>{});
  const result=await page.evaluate(()=>({mic:localStorage.getItem('sona.micok'),order:__setup.order,tracks:__setup.tracks.map(t=>t.readyState)}));
  ok('the setup tap makes the real mic request and remembers only a grant',result.order[0]==='microphone'&&result.mic==='1',result);
  ok('every permission-check track stops before the native speech ask',result.tracks.length===2&&result.tracks.every(s=>s==='ended')&&result.order.indexOf('speech permission')>result.order.lastIndexOf('stop'),result);
  await atHandoff(page);ok('native setup finishes without a backup POST',pairPosts(requests).length===0,pairPosts(requests));
  const plan=await page.evaluate(()=>Sona.adventureGames());ok('the older-child handoff follows the shared arcade plan',plan.length===5&&plan.every(g=>['slice','run','stack','glide','tiles'].includes(g)),plan);
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
await browser.close();await new Promise(resolve=>server.close(resolve));console.log(failures?failures+' FAILURES / '+checks+' assertions':'ALL GREEN — '+checks+' assertions');process.exit(failures?1:0);
