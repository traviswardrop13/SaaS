// Home offers one age-appropriate next session and preserves earned runs.
// Navigation destinations are observed without starting microphone practice.
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import path from 'path';
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from './_env.mjs';
const ROOT=process.env.SONATEST_PUBLIC_ROOT||SOURCE_ROOT, BASE='http://127.0.0.1:8198';
const MIME={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',webp:'image/webp',woff2:'font/woff2'};
const server=createServer((req,res)=>{const u=new URL(req.url,BASE),f=path.join(ROOT,u.pathname);if(u.pathname.startsWith('/api/')){res.writeHead(503);res.end('{}');return;}if(!existsSync(f)||!statSync(f).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':MIME[f.split('.').pop()]||'application/octet-stream'});res.end(readFileSync(f));});
await new Promise(resolve=>server.listen(8198,'127.0.0.1',resolve));
const browser=await chromium.launch(launchOpts());let failures=0,assertions=0;
function ok(name,pass,detail=''){assertions++;if(!pass)failures++;console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' → '+JSON.stringify(detail)));}
async function scenario(name,fn){try{await fn();}catch(e){ok(name+' has no harness/page exception',false,e.stack);}}
async function fixture(config={}){
 const context=await browser.newContext({viewport:config.viewport||{width:390,height:844},reducedMotion:'reduce'});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==BASE)return route.abort();if(/^\/(?:charge|arcade-bubbles)\.html$/.test(u.pathname))return route.fulfill({contentType:'text/html',body:'<p>Session destination</p>'});return route.continue();});
 await context.addInitScript(config=>{
  if(localStorage.getItem('sona.test.homeSession'))return;localStorage.setItem('sona.test.homeSession','1');
  localStorage.setItem('sona.freeera.v1','post');localStorage.setItem('sona.freeera2.v1','done');localStorage.setItem('sona.freeera3.v1','done');
  localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Mia',childAge:config.age===undefined?'4':config.age,focusSounds:['M'],onboarded:true,voiceOn:false,soundOn:false,volume:0}));
  if(config.paid){sessionStorage.setItem('sona.paidui','1');localStorage.setItem('sona.demo.v1',JSON.stringify({started:1,done:1}));}
  if(config.run)sessionStorage.setItem('sona.run.v1',JSON.stringify(config.run));
  if(config.homework)localStorage.setItem('sona.homework.v1',JSON.stringify({hw:{id:'home-goal',title:'S practice',sounds:['S'],pos:'i',repsPerDay:20,start:'2000-01-01',due:'2999-01-01',by:'Rachel, CF-SLP'},at:Date.now()}));
 },config);
 const page=await context.newPage();page.setDefaultTimeout(4000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(BASE+'/today.html');return {context,page,errors};
}
async function state(page){return page.evaluate(()=>({name:document.getElementById('heroName').textContent,sub:document.getElementById('heroSub').textContent,goal:document.getElementById('subLine').textContent,guide:document.getElementById('sessionGuide')?.textContent||'',cta:document.getElementById('goBtn').textContent,launch:document.getElementById('goBtn').dataset.launch,art:document.querySelector('#heroCard .stk use')?.getAttribute('href'),sound:Sona.soundLabel(Sona.rotSound()),jarVisible:getComputedStyle(document.getElementById('jarRow')).display!=='none',ring:Sona.todayRing(),reps:Sona.repsToday(),run:sessionStorage.getItem('sona.run.v1'),demo:Sona.demoState(),primaryFirst:!!(document.getElementById('goBtn').compareDocumentPosition(document.getElementById('gameShelfHead'))&Node.DOCUMENT_POSITION_FOLLOWING)}));}
function clean(name,errors){ok(name+': no runtime errors',errors.length===0,errors);}

for(const age of ['3','4','5','8',null,'4 years','4.5','2'])await scenario('age '+age,async()=>{
 const {context,page,errors}=await fixture({age});try{
  const st=await state(page),simple=age==='3'||age==='4',url=new URL(st.launch,BASE);
  ok('age '+age+': one appropriate primary session',simple?url.pathname==='/arcade-bubbles.html':url.pathname==='/charge.html'&&url.searchParams.get('daily')==='1',st);
  ok('age '+age+': main action precedes optional games',st.primaryFirst);
  ok('age '+age+': the rep jar appears only for a session that can fill it',st.jarVisible===!simple,st.jarVisible);
  ok('age '+age+': a parent can see how to join in',st.guide.trim().length>15,st.guide);
  ok('age '+age+': the current sound goal stays visible',st.goal.includes(st.sound),st);
  if(simple){ok('age '+age+': five pictures are described without a duration claim',/5|five/i.test(st.sub)&&/picture/i.test(st.sub)&&!/minute|\bmin\b/i.test(st.sub),st.sub);ok('age '+age+': hero art matches Bubble Pop',st.art===await page.evaluate(()=>'#'+Sona.gameSticker('bubbles')[0]),st.art);}
  ok('age '+age+': Home invents no completed practice',st.ring.n===0&&st.reps===0&&!st.run&&!st.demo.started,st);
  ok('age '+age+': the full library remains available',await page.locator('#browseGames').getAttribute('href')==='/activities.html');
  if(age==='3'||age==='5'){await page.locator('#goBtn').focus();await page.keyboard.press('Enter');await page.waitForURL(next=>next.pathname===url.pathname);ok('age '+age+': keyboard starts the advertised session',new URL(page.url()).pathname===url.pathname);}
  clean('age '+age,errors);
 }finally{await context.close();}
});

await scenario('resume outranks age and paid replay',async()=>{
 const run={active:true,round:2,scores:[11,12],sum:23,sound:'M',level:1,pending:true,games:['slice','tiles','stack','run','glide']};
 const {context,page,errors}=await fixture({age:'3',run,paid:true});try{
  const st=await state(page),url=new URL(st.launch,BASE);
  ok('unfinished adventure takes priority for a younger child',url.pathname==='/charge.html'&&url.searchParams.get('daily')==='1'&&/carry on|continue|resume/i.test(st.cta),st);
  ok('resume names the actual third round',/round 3/i.test(st.sub),st.sub);
  ok('resuming an adventure restores the rep jar for a younger child',st.jarVisible);
  ok('Home preserves earned scores and the pending game',st.run===JSON.stringify(run),st.run);
  clean('resume',errors);
 }finally{await context.close();}
});

for(const age of ['4','7'])await scenario('paid gate age '+age,async()=>{
 const {context,page,errors}=await fixture({age,paid:true});try{
  const st=await state(page),url=new URL(st.launch,BASE);
  ok('paid age '+age+': existing free demonstration replay remains the primary door',url.pathname==='/charge.html'&&url.searchParams.get('demo')==='1',st.launch);
  ok('paid age '+age+': library stays open',await page.locator('#browseGames').isVisible());
  clean('paid age '+age,errors);
 }finally{await context.close();}
});

await scenario('homework and child switching',async()=>{
 const {context,page,errors}=await fixture({age:'4',homework:true});try{
  const first=await state(page);ok('assigned sound and therapist are visible before play',first.goal.includes(first.sound)&&/Rachel, CF-SLP/.test(first.sub),first);
  const original=await page.evaluate(()=>{const slot=Sona.activeKid().slot;Sona.addKid('Sibling','8');Sona.saveProfile({childName:'Sibling',childAge:'8',focusSounds:['M'],onboarded:true,voiceOn:false,soundOn:false,volume:0});return slot;});
  await page.reload();ok('older sibling receives the adventure',new URL((await state(page)).launch,BASE).pathname==='/charge.html');
  await page.evaluate(slot=>Sona.switchKid(slot),original);await page.reload();ok('switching back restores simple play and that child’s goal',new URL((await state(page)).launch,BASE).pathname==='/arcade-bubbles.html'&&(await state(page)).goal.includes(first.sound));
  clean('sibling goals',errors);
 }finally{await context.close();}
});

for(const age of ['4','7'])for(const width of [320,375,390])await scenario('phone '+age+'/'+width,async()=>{
 const {context,page,errors}=await fixture({age,viewport:{width,height:width===320?568:width===375?667:844}});try{
  await page.locator('#goBtn').scrollIntoViewIfNeeded();const fit=await page.locator('#goBtn').evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);const caption=document.getElementById('heroCap').getBoundingClientRect();return {overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth,reachable:r.top>=0&&r.bottom<=innerHeight&&(hit===el||el.contains(hit)),clear:caption.bottom<=r.top+1};});
  ok('phone '+age+'/'+width+': primary action is readable and reachable',fit.overflow<=1&&fit.reachable&&fit.clear,fit);
  await page.locator('#browseGames').scrollIntoViewIfNeeded();ok('phone '+age+'/'+width+': optional library remains reachable',await page.locator('#browseGames').isVisible());clean('phone '+age+'/'+width,errors);
 }finally{await context.close();}
});
await browser.close();await new Promise(resolve=>server.close(resolve));console.log(failures?failures+' FAILURES / '+assertions+' assertions':'ALL GREEN — '+assertions+' assertions');process.exit(failures?1:0);
