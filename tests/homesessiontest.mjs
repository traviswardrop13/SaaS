// Home's Arcade is a silent game picker (since 22 Oct 2026, STORY1, Home leads
// with today's story and the picker is one tap away, at ?view=arcade; its own
// suite is homestorytest), and games only since 23 Oct 2026: the books are
// behind Home's Books door. Browsing preserves existing practice and access.
// Navigation destinations are observed without starting microphone practice.
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import path from 'path';
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from './_env.mjs';
const ROOT=process.env.SONATEST_PUBLIC_ROOT||SOURCE_ROOT, BASE='http://127.0.0.1:8198';
// Coming soon: whatever the catalog parks. None since 22 Oct 2026, when Travis
// opened Peekaboo and the seventeen rebuilt Say & Play games (Bubble Pop came
// back 30 Sep); activitytest and day1 park some again to pin what parking does.
const PARKED=[...readFileSync(ROOT+'/sona.js','utf8').matchAll(/^\s{4}(\w+): \{[^\n]*\bcomingSoon: true\b/gm)].map(m=>m[1]).sort();
const MIME={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',webp:'image/webp',woff2:'font/woff2'};
const server=createServer((req,res)=>{const u=new URL(req.url,BASE),f=path.join(ROOT,u.pathname);if(u.pathname.startsWith('/api/')){res.writeHead(503);res.end('{}');return;}if(!existsSync(f)||!statSync(f).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':MIME[f.split('.').pop()]||'application/octet-stream'});res.end(readFileSync(f));});
await new Promise(resolve=>server.listen(8198,'127.0.0.1',resolve));
const browser=await chromium.launch(launchOpts());let failures=0,assertions=0;
function ok(name,pass,detail=''){assertions++;if(!pass)failures++;console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' → '+JSON.stringify(detail)));}
async function scenario(name,fn){try{await fn();}catch(e){ok(name+' has no harness/page exception',false,e.stack);}}
async function fixture(config={}){
 const context=await browser.newContext({viewport:config.viewport||{width:390,height:844},reducedMotion:'reduce'});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==BASE)return route.abort();if(/^\/(?:charge|arcade-[a-z]+|library)\.html$/.test(u.pathname))return route.fulfill({contentType:'text/html',body:'<p>Session destination</p>'});return route.continue();});
 await context.addInitScript(config=>{
  const record=text=>{if(String(text||'').trim()){const calls=JSON.parse(sessionStorage.getItem('test.menuSpeech')||'[]');calls.push(String(text));sessionStorage.setItem('test.menuSpeech',JSON.stringify(calls));}return Promise.resolve();};
  let sona;Object.defineProperty(window,'Sona',{configurable:true,get:()=>sona,set:value=>{sona=value;value.speak=record;value.speakNow=record;}});
  if(window.speechSynthesis)window.speechSynthesis.speak=utterance=>record(utterance.text);
  if(localStorage.getItem('sona.test.homeSession'))return;localStorage.setItem('sona.test.homeSession','1');
  localStorage.setItem('sona.freeera.v1','post');localStorage.setItem('sona.freeera2.v1','done');localStorage.setItem('sona.freeera3.v1','done');localStorage.setItem('sona.freeera4.v1','done');localStorage.setItem('sona.freeera5.v1','done');
  localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Mia',childAge:config.age===undefined?'4':config.age,focusSounds:['M'],onboarded:true,voiceOn:true,soundOn:false,volume:0.7}));
  if(config.paid){sessionStorage.setItem('sona.paidui','1');localStorage.setItem('sona.demo.v1',JSON.stringify({started:1,done:1}));}
  if(config.run)sessionStorage.setItem('sona.run.v1',JSON.stringify(config.run));
  if(config.homework)localStorage.setItem('sona.homework.v1',JSON.stringify({hw:{id:'home-goal',title:'S practice',sounds:['S'],pos:'i',repsPerDay:20,start:'2000-01-01',due:'2999-01-01',by:'Rachel, CF-SLP'},at:Date.now()}));
 },config);
 const page=await context.newPage();page.setDefaultTimeout(4000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(BASE+(config.path||'/today.html?view=arcade'));return {context,page,errors};
}

// the eight original titles, the twenty Say & Play games (26 Sep 2026) and Rise Up (9 Oct 2026)
const ALL=['bubbles','feed','glide','peekaboo','rise','run','slice','stack','tiles',
 'balloon','cake','castle','dino','fishtank','flower','gifts','hoops','monster','pizza','puppy','racecar','robot','rocket','snowman','soccer','space','stars','train','treasure'].sort();
// Since 19 Oct 2026 Home draws no parked game (Travis: hide Coming soon).
const HOME=ALL.filter(key=>!PARKED.includes(key));
async function state(page){return page.evaluate(()=>({
 keys:Array.from(document.querySelectorAll('#activityGroups button[data-game]')).map(el=>el.dataset.game).sort(),
 groups:Array.from(document.querySelectorAll('#activityGroups [data-group]')).map(el=>el.dataset.group),
 recommended:Sona.activityLibrary().recommended,run:sessionStorage.getItem('sona.run.v1'),
 ring:Sona.todayRing(),reps:Sona.repsToday(),demo:Sona.demoState(),
 speech:JSON.parse(sessionStorage.getItem('test.menuSpeech')||'[]')
}));}
function clean(name,errors){ok(name+': no runtime errors',errors.length===0,errors);}
for(const age of ['2','3','4','5','8',null,'4 years','4.5'])await scenario('age '+age,async()=>{
 const {context,page,errors}=await fixture({age});try{
  await page.waitForTimeout(200);const st=await state(page);
  ok('age '+age+': Home itself presents every catalog card but the parked ones',JSON.stringify(st.keys)===JSON.stringify(HOME),st.keys);
  const parked=await page.evaluate(keys=>({cards:keys.filter(k=>document.querySelector('#libraryApp [data-game="'+k+'"]')),disabled:document.querySelectorAll('#libraryApp button[data-game]:disabled').length,coming:/coming soon/i.test(document.getElementById('libraryApp').innerText)}),PARKED);
  ok('age '+age+': no parked game has a card on Home, and nothing says Coming soon',parked.cards.length===0&&parked.disabled===0&&!parked.coming,parked);
  ok('age '+age+': Home invites a choice',await page.getByRole('heading',{name:'Pick a game!',exact:true}).count()===1);
  ok('age '+age+': no adventure hero or auto-start replaces the choice',await page.locator('#goBtn,#heroCard,#jarRow').count()===0&&new URL(page.url()).pathname==='/today.html');
  const recommended=['2','3','4'].includes(age)?'simple':['5','8'].includes(age)?'arcade':null;
  ok('age '+age+': age changes the suggested group, not access',st.recommended===recommended&&(!recommended||st.groups[0]===recommended),st);
  ok('age '+age+': Home creates no run, practice credit or demonstration',st.ring.n===0&&st.reps===0&&!st.run&&!st.demo.started,st);
  ok('age '+age+': menus are silent even with voice enabled',st.speech.length===0,st.speech);
  ok('age '+age+': buddy and parent controls remain available',await page.locator('#buddyBtn').count()===1&&await page.locator('#buddyBtn').getAttribute('href')==='/customize.html'&&await page.locator('#parentBtn').count()===1);
  // The books are on (Travis, 26 Sep 2026), but not in the Arcade (23 Oct
  // 2026: "organize the arcade so that there are no books in there"): no
  // Books card and no book in any row. The one row above the shelves is
  // Today's picks, two games of the child's own age group ("I only want
  // either today's picks or limited time ... have 2 games listed there"),
  // and the books are one door on Home, whose tag never says Coming soon.
  const arcade=await page.evaluate(()=>({
   bookParts:document.querySelectorAll('#booksCard,#libraryBooksArt,#booksTag,#booksLine,#booksHeading,#libraryApp .book-card').length,
   bookKeys:Array.from(document.querySelectorAll('#libraryApp [data-game]')).map(el=>el.dataset.game).filter(key=>/^book:/.test(key)),
   rows:Array.from(document.querySelectorAll('#featuredGroups > section')).map(el=>({id:el.dataset.collection,heading:(el.querySelector('h2')||{}).textContent,games:Array.from(el.querySelectorAll('button[data-game]')).map(b=>b.dataset.game)})),
   // (the first shelf's group: the child's own, Simple play with no age)
   style:Sona.activityLibrary().groups[0].id,group:Object.fromEntries(Object.keys(Sona.GAME_ACTS).map(key=>[key,Sona.GAME_ACTS[key].group])),
   featured:'featured' in Sona.activityLibrary(),
   door:document.querySelectorAll('#homeBooksBtn').length,doorTag:(document.getElementById('homeBooksTag')||{}).textContent
  }));
  ok('age '+age+': the Arcade draws no Books card and no book in any row',arcade.bookParts===0&&arcade.bookKeys.length===0,arcade);
  const picks=arcade.rows[0]||{games:[]};
  ok('age '+age+': one row above the shelves, Today\'s picks, holding two different games of the child\'s own age group',arcade.rows.length===1&&picks.id==='picks'&&picks.heading==="Today's picks"&&picks.games.length===2&&picks.games[0]!==picks.games[1]&&picks.games.every(key=>HOME.includes(key)&&arcade.group[key]===arcade.style)&&!arcade.featured,arcade);
  ok('age '+age+': the books are one door on Home, no longer coming soon',arcade.door===1&&['Free','Included','1 free book','Premium'].includes(arcade.doorTag)&&!/coming soon/i.test(arcade.doorTag),arcade);
  clean('age '+age,errors);
 }finally{await context.close();}
});
for(const progress of [{round:0},{round:0,pending:true},{round:0,ready:{round:0,chest:{taps:2}}},{round:2,pending:true},{round:5,finishing:true}])await scenario('saved run '+JSON.stringify(progress),async()=>{
 const run={active:true,scores:[11,12],sum:23,sound:'M',level:1,games:['slice','tiles','stack','run','glide'],...progress};
 const {context,page,errors}=await fixture({age:'3',run});try{
  await page.waitForTimeout(200);const st=await state(page);
  ok('saved run '+JSON.stringify(progress)+': browsing never resumes or overwrites it',st.run===JSON.stringify(run)&&new URL(page.url()).pathname==='/today.html',st);
  ok('saved run '+JSON.stringify(progress)+': the picker remains available',JSON.stringify(st.keys)===JSON.stringify(HOME),st.keys);
  ok('saved run '+JSON.stringify(progress)+': browsing stays silent',st.speech.length===0,st.speech);
  clean('saved run',errors);
 }finally{await context.close();}
});
await scenario('game choice and the parent gate stay deliberate',async()=>{
 const {context,page,errors}=await fixture({age:'7'});try{
  if(!await page.locator('#activityGroups button[data-game]').count()){ok('Home has actionable game choices',false);return;}
  await page.locator('#parentBtn').click();
  ok('the parent control opens the existing gate',await page.locator('#gateOvl.show').count()===1);
  await page.locator('#gateClose').click();
  ok('canceling the parent gate returns to the silent picker',new URL(page.url()).pathname==='/today.html'&&(await state(page)).speech.length===0);
  const card=page.locator('#activityGroups button[data-game="slice"]');await card.focus();await page.keyboard.press('Enter');
  await page.waitForURL('**/charge.html?**');
  const url=new URL(page.url());ok('choosing an arcade game opens only its practice route',url.searchParams.get('game')==='arcade-slice.html'&&!url.searchParams.has('daily'),url.href);
  ok('selecting a game has no menu narration',await page.evaluate(()=>JSON.parse(sessionStorage.getItem('test.menuSpeech')||'[]').length)===0);
  clean('deliberate choice',errors);
 }finally{await context.close();}
});
for(const age of ['4','7'])await scenario('paid gate age '+age,async()=>{
 const {context,page,errors}=await fixture({age,paid:true});try{
  const access=await page.evaluate(()=>({allowed:Object.keys(Sona.GAME_ACTS).filter(key=>Sona.gameAccess(key).allowed).sort(),free:Object.keys(Sona.GAME_ACTS).filter(key=>{const game=Sona.GAME_ACTS[key];return game.tier==='free'&&game.available!==false&&!game.comingSoon;}).sort()}));
  ok('paid age '+age+': browsing retains the playable free games',access.free.length>0&&JSON.stringify(access.allowed)===JSON.stringify(access.free),access);
  ok('paid age '+age+': browsing does not enter a game or purchase page',new URL(page.url()).pathname==='/today.html');
  // Block Stacker: Premium (Piano Tiles turned free on 30 Sep 2026)
  if(await page.locator('#activityGroups button[data-game="stack"]').count()){
   await page.locator('#activityGroups button[data-game="stack"]').click();
   ok('paid age '+age+': a locked title invites a grown-up without leaving Home',new URL(page.url()).pathname==='/today.html'&&await page.locator('#libraryNotice').isVisible());
  }else ok('paid Home keeps the full catalog visible',false);
  clean('paid gate',errors);
 }finally{await context.close();}
});
await scenario('homework and child switching preserve the picker',async()=>{
 const {context,page,errors}=await fixture({age:'4',homework:true});try{
  const first=await page.evaluate(()=>({slot:Sona.activeKid().slot,sound:Sona.rotSound(),hw:JSON.stringify(Sona.homework())}));
  await page.evaluate(()=>{Sona.addKid('Sibling','8');Sona.saveProfile({childName:'Sibling',childAge:'8',focusSounds:['M'],onboarded:true,voiceOn:true,soundOn:false,volume:0.7});});
  await page.reload();ok('an older sibling gets Arcade suggested first',(await state(page)).groups[0]==='arcade');
  await page.evaluate(slot=>Sona.switchKid(slot),first.slot);await page.reload();
  ok('switching back restores the younger suggestion and assigned sound',(await state(page)).groups[0]==='simple'&&await page.evaluate(first=>Sona.rotSound()===first.sound&&JSON.stringify(Sona.homework())===first.hw,first));
  clean('sibling goals',errors);
 }finally{await context.close();}
});
// Home's Books door is the one way to the bookshelf since the Arcade lost its
// Books card (23 Oct 2026): a tap goes to the shelf, whose own rules decide
// free or Premium, and says nothing on the way.
await scenario('the Books door opens the bookshelf',async()=>{
 const {context,page,errors}=await fixture({age:'4',path:'/today.html'});try{
  ok('Home shows the Books door',await page.locator('#homeBooksBtn').isVisible());
  await page.locator('#homeBooksBtn').click();await page.waitForURL('**/library.html');
  const url=new URL(page.url());ok('the Books door opens the bookshelf itself, not a book',url.pathname==='/library.html'&&!url.search,url.href);
  ok('opening the books has no menu narration',await page.evaluate(()=>JSON.parse(sessionStorage.getItem('test.menuSpeech')||'[]').length)===0);
  clean('books door',errors);
 }finally{await context.close();}
});
// No white past either end (Travis, 27 Sep 2026): the page stops at its top
// and bottom, and the iPhone app paints Home's cream behind it, not white.
await scenario('no white past either end',async()=>{
 const {context,page,errors}=await fixture({age:'4'});try{
  const look=await page.evaluate(()=>{const h=getComputedStyle(document.documentElement),b=getComputedStyle(document.body);return {html:h.overscrollBehaviorY+'/'+h.overscrollBehaviorX,body:b.overscrollBehaviorY,bg:h.backgroundColor,cream:h.getPropertyValue('--cream').trim().toLowerCase()};});
  ok('Home stops at its top and bottom instead of bouncing',look.html==='none/none'&&look.body==='none',look);
  const cap=JSON.parse(readFileSync(path.join(SOURCE_ROOT,'..','capacitor.config.json'),'utf8'));
  const hex=c=>'#'+(c.match(/\d+/g)||[]).slice(0,3).map(n=>(+n).toString(16).padStart(2,'0')).join('');
  ok('the iPhone app paints Home\'s cream behind the page, never the system white',/^#[0-9a-f]{6}$/.test(look.cream)&&String(cap.ios&&cap.ios.backgroundColor).toLowerCase()===look.cream&&hex(look.bg)===look.cream,{ios:cap.ios,look});
  clean('no white',errors);
 }finally{await context.close();}
});
for(const width of [320,375,390])await scenario('phone '+width,async()=>{
 const {context,page,errors}=await fixture({age:'4',viewport:{width,height:width===320?568:width===375?667:844}});try{
  const last=page.locator('#activityGroups button[data-game]').last();if(!await last.count()){ok('phone '+width+': picker cards exist',false);return;}
  await last.scrollIntoViewIfNeeded();const fit=await last.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth,reachable:r.top>=0&&r.bottom<=innerHeight&&(hit===el||el.contains(hit))};});
  ok('phone '+width+': scrolling reaches every game without sideways overflow',fit.overflow<=1&&fit.reachable,fit);clean('phone '+width,errors);
 }finally{await context.close();}
});
await browser.close();await new Promise(resolve=>server.close(resolve));console.log(failures?failures+' FAILURES / '+assertions+' assertions':'ALL GREEN — '+assertions+' assertions');process.exit(failures?1:0);
