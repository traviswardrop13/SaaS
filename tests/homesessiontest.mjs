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
async function state(page){return page.evaluate(()=>({name:document.getElementById('heroName').textContent,sub:document.getElementById('heroSub').textContent,goal:document.getElementById('subLine').textContent,guide:document.getElementById('sessionGuide')?.textContent||'',cta:document.getElementById('goBtn').textContent,launch:document.getElementById('goBtn').dataset.launch,plan:Sona.adventureGames(),nodes:Array.from(document.querySelectorAll('#heroCard [data-round]')).map(el=>({game:el.dataset.game,current:el.classList.contains('current'),done:el.classList.contains('done')})),jarVisible:getComputedStyle(document.getElementById('jarRow')).display!=='none',shelf:document.getElementById('thumbs').hidden,purse:document.getElementById('purse').hidden,sound:Sona.soundLabel(Sona.rotSound()),ring:Sona.todayRing(),reps:Sona.repsToday(),run:sessionStorage.getItem('sona.run.v1'),demo:Sona.demoState()}));}
function clean(name,errors){ok(name+': no runtime errors',errors.length===0,errors);}
for(const age of ['2','3','4','5','8',null,'4 years','4.5'])await scenario('age '+age,async()=>{
 const {context,page,errors}=await fixture({age});try{
  const st=await state(page),simple=['2','3','4'].includes(age),url=new URL(st.launch,BASE);
  ok('age '+age+': one shared daily adventure is the primary session',url.pathname==='/charge.html'&&url.searchParams.get('daily')==='1'&&url.searchParams.get('first')===st.plan[0],st);
  ok('age '+age+': all five pictures show the actual adventure order',st.nodes.length===5&&st.nodes.every((n,i)=>n.game===st.plan[i]),st.nodes);
  ok('age '+age+': the shared plan uses the approved play style',st.plan.length===5&&st.plan.every(k=>simple?['feed','bubbles','peekaboo'].includes(k):!['feed','bubbles','peekaboo'].includes(k)),st.plan);
  ok('age '+age+': Echo starts on the first unfinished picture',st.nodes.filter(n=>n.current).length===1&&st.nodes[0]?.current&&!st.nodes.some(n=>n.done),st.nodes);
  ok('age '+age+': the picture and caption form one real button',await page.locator('button#goBtn #heroCard').count()===1&&await page.locator('button#goBtn #heroCap').count()===1);
  ok('age '+age+': competing games stay hidden before completion',st.shelf&&await page.locator('#gameShelfHead').isHidden());
  ok('age '+age+': the jar appears only for a plan that can fill it',st.jarVisible===!simple,st.jarVisible);
  ok('age '+age+': the empty coin counter stays hidden',st.purse);
  ok('age '+age+': parents see a short guide and the current sound goal',st.guide.trim().length>15&&st.goal.includes(st.sound),st);
  ok('age '+age+': Home invents no completed practice',st.ring.n===0&&st.reps===0&&!st.run&&!st.demo.started,st);
  ok('age '+age+': library is an honest header destination',await page.locator('#libBtn').getAttribute('href')==='/activities.html'&&await page.locator('#browseGames,#ringBtn').count()===0);
  ok('age '+age+': buddy customization is available in the header',await page.locator('header #buddyBtn').getAttribute('href')==='/customize.html');
  if(age==='3'||age==='5'){await page.locator('#goBtn').focus();await page.keyboard.press('Enter');await page.waitForURL(next=>next.pathname===url.pathname);ok('age '+age+': Enter starts the advertised adventure',new URL(page.url()).searchParams.get('first')===st.plan[0]);}
  clean('age '+age,errors);
 }finally{await context.close();}
});
for(const progress of [{round:0},{round:0,pending:true},{round:0,ready:{round:0,chest:{taps:2}}},{round:2,pending:true},{round:5,finishing:true}])await scenario('saved run '+JSON.stringify(progress),async()=>{
 const run={active:true,scores:[11,12],sum:23,sound:'M',level:1,games:['slice','tiles','stack','run','glide'],...progress};
 const {context,page,errors}=await fixture({age:'3',run});try{
  const st=await state(page),resume=!!(progress.round>0||progress.pending||progress.ready);
  ok('saved run '+JSON.stringify(progress)+': resume requires meaningful progress',/carry on|continue|resume/i.test(st.cta)===resume,st.cta);
  ok('saved run '+JSON.stringify(progress)+': Home preserves all earned state',st.run===JSON.stringify(run),st.run);
  ok('saved run '+JSON.stringify(progress)+': saved plan stays in the path',st.nodes.length===5&&st.nodes.every((n,i)=>n.game===run.games[i]),st.nodes);
  if(progress.round===2)ok('resume places Echo at the third game and colors completed games',st.nodes[2]?.current&&st.nodes.slice(0,2).every(n=>n.done),st.nodes);
  if(progress.finishing)ok('the unfinished finale can be resumed',new URL(st.launch,BASE).pathname==='/charge.html'&&/carry on|continue|resume/i.test(st.cta));
  clean('saved run',errors);
 }finally{await context.close();}
});
for(const age of ['4','7'])await scenario('paid gate age '+age,async()=>{
 const {context,page,errors}=await fixture({age,paid:true});try{
  const st=await state(page),url=new URL(st.launch,BASE);
  ok('paid age '+age+': free demonstration replay remains the primary door',url.pathname==='/charge.html'&&url.searchParams.get('demo')==='1',st.launch);
  ok('paid age '+age+': library stays open',await page.locator('#libBtn').isVisible());clean('paid gate',errors);
 }finally{await context.close();}
});
await scenario('homework and child switching',async()=>{
 const {context,page,errors}=await fixture({age:'4',homework:true});try{
  const first=await state(page);ok('assigned sound and therapist remain available before play',first.goal.includes(first.sound)&&/Rachel, CF-SLP/.test(first.sub),first);
  const original=await page.evaluate(()=>{const slot=Sona.activeKid().slot;Sona.addKid('Sibling','8');Sona.saveProfile({childName:'Sibling',childAge:'8',focusSounds:['M'],onboarded:true,voiceOn:false,soundOn:false,volume:0});return slot;});
  await page.reload();ok('older sibling receives an arcade adventure',(await state(page)).plan.every(k=>!['feed','bubbles','peekaboo'].includes(k)));
  await page.evaluate(slot=>Sona.switchKid(slot),original);await page.reload();ok('switching back restores the simple adventure and assigned goal',(await state(page)).plan.every(k=>['feed','bubbles','peekaboo'].includes(k))&&(await state(page)).goal.includes(first.sound));clean('sibling goals',errors);
 }finally{await context.close();}
});
await scenario('completed day and earned coins',async()=>{
 const {context,page}=await fixture({age:'7'});try{
  ok('first-run jar invites without a zero count',await page.locator('#jarSub').innerText()==='Talk with Echo to fill your jar!');
  await page.evaluate(()=>{Sona.dailyFinish(23);Sona.addCoins(2);});await page.reload();
  ok('completed adventure opens optional game choices',await page.locator('#thumbs').isVisible()&&await page.locator('#gameShelfHead').isVisible());
  ok('earned coins make the purse visible',await page.locator('#purse').isVisible()&&await page.locator('#coinTxt').innerText()==='2');
 }finally{await context.close();}
});
for(const age of ['4','7'])for(const width of [320,375,390])await scenario('phone '+age+'/'+width,async()=>{
 const {context,page,errors}=await fixture({age,viewport:{width,height:width===320?568:width===375?667:844}});try{
  await page.locator('#goBtn').scrollIntoViewIfNeeded();const fit=await page.locator('#goBtn').evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);const caption=document.getElementById('heroCap').getBoundingClientRect();return {overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth,reachable:r.top>=0&&r.bottom<=innerHeight&&(hit===el||el.contains(hit)),clear:caption.top>=r.top&&caption.bottom<=r.bottom};});
  ok('phone '+age+'/'+width+': the whole hero and caption are one readable target',fit.overflow<=1&&fit.reachable&&fit.clear,fit);
  await page.locator('#libBtn').scrollIntoViewIfNeeded();ok('phone '+age+'/'+width+': library remains reachable',await page.locator('#libBtn').isVisible());clean('phone '+age+'/'+width,errors);
 }finally{await context.close();}
});
await browser.close();await new Promise(resolve=>server.close(resolve));console.log(failures?failures+' FAILURES / '+assertions+' assertions':'ALL GREEN — '+assertions+' assertions');process.exit(failures?1:0);
