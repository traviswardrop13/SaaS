// Daily goals: one local, per-child play+practice count, earned-day stamps,
// silent celebrations, homework precedence and grown-up controls.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { chromium, ROOT, launchOpts } from './_env.mjs';
let failed=0;
function ok(label,pass,detail=''){if(!pass)failed++;console.log((pass?'PASS ':'FAIL ')+label+(pass?'':' '+JSON.stringify(detail)));}
const mime={html:'text/html',js:'text/javascript',css:'text/css',webp:'image/webp',woff2:'font/woff2'};
const server=createServer((req,res)=>{const u=new URL(req.url,'http://x');if(u.pathname==='/__test'){res.end('<!doctype html><body><button id="stillPlay">Keep playing</button><script src="/sona.js"></script>');return;}if(u.pathname.startsWith('/api/')){res.setHeader('content-type','application/json');res.end('{}');return;}const p=u.pathname==='/sona.js'&&process.env.DAILY_GOAL_BASELINE?process.env.DAILY_GOAL_BASELINE:ROOT+u.pathname;if(!existsSync(p)){res.writeHead(404);res.end();return;}res.setHeader('content-type',mime[p.split('.').pop()]||'application/octet-stream');res.end(readFileSync(p));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(launchOpts());
async function fresh(age='4',at=Date.UTC(2026,9,15,16)){
 const context=await browser.newContext({viewport:{width:320,height:812},timezoneId:'America/Denver'});
 await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 await context.addInitScript(({shift,age})=>{const Real=Date;class Clock extends Real{constructor(...a){super(...(a.length?a:[Real.now()+shift+(window.__jump||0)]));}static now(){return Real.now()+shift+(window.__jump||0);}}window.Date=Clock;if(!localStorage.getItem('sona.profile.v1')){localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'NeverInAnalytics',childAge:age,focusSounds:['R'],onboarded:true,voiceOn:false,soundOn:false,volume:0}));['','2','3','4','5'].forEach(n=>localStorage.setItem('sona.freeera'+n+'.v1',n?'done':'post'));}}, {shift:at-Date.now(),age});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/__test');await page.waitForFunction(()=>!!window.Sona);return{context,page,errors};
}
try{
 const {context,page,errors}=await fresh();
 ok('daily goal API exists',await page.evaluate(()=>typeof Sona.dayGoal==='function'));
 let state=await page.evaluate(()=>({d:Sona.dayGoal(),days:Sona.goalDays(),stamps:localStorage.getItem('sona.goaldays.v1')}));
 ok('ages 3–4 default 30 and 4 days; reads never stamp',state.d.goal===30&&state.d.n===0&&!state.d.done&&state.days===4&&state.stamps===null,state);
 const ledger=await page.evaluate(()=>{const t=Sona.localDay();localStorage.setItem('sona.outcomes.v1',JSON.stringify({R:{days:{[t]:{tries:20,a:1,p:0},'2026-10-14':{tries:9},'2026-09-10':{tries:999}}}}));localStorage.setItem('sona.gamereps.v1',JSON.stringify({[t]:{R:8},'2026-10-14':{R:2}}));return{n:Sona.dayReps(),practice:Sona.dayReps(undefined,true),week:Sona.weekReps(0),d:Sona.dayGoal()};});
 ok('daily count sums today only; weekly shares the ledger; practice stays separate',ledger.n===28&&ledger.practice===20&&ledger.week===39&&!ledger.d.done,ledger);
 await page.evaluate(()=>{window.__noise=0;['speak','confetti'].forEach(k=>Sona[k]=()=>__noise++);Object.keys(Sona.sfx).forEach(k=>Sona.sfx[k]=()=>__noise++);window.__goalShows=0;new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.id==='sonaGoalBanner')__goalShows++;}))).observe(document.body,{childList:true});Sona.gameRep('R');Sona.gameRep('R');});
 await page.waitForTimeout(20);
 state=await page.evaluate(()=>({d:Sona.dayGoal(),stamps:JSON.parse(localStorage.getItem('sona.goaldays.v1')),text:document.getElementById('sonaGoalBanner')?.textContent,role:document.getElementById('sonaGoalBanner')?.getAttribute('role'),pointer:getComputedStyle(document.getElementById('sonaGoalBanner')).pointerEvents,noise:__noise,shows:__goalShows,overlays:document.querySelectorAll('.ovl.show').length}));
 ok('the goal is earned once, with a silent nonblocking status over play',state.d.n===30&&state.d.done&&Object.values(state.stamps)[0]===30&&state.role==='status'&&state.pointer==='none'&&state.noise===0&&state.shows===1&&state.overlays===0,state);
 const stamp=JSON.stringify(state.stamps);
 await page.evaluate(()=>{Sona.saveProfile({dailyGoal:50});Sona.gameRep('R');document.getElementById('sonaGoalBanner')?.remove();Sona.gameRep('R');});await page.waitForTimeout(20);
 state=await page.evaluate(()=>({d:Sona.dayGoal(),shows:__goalShows,stamps:localStorage.getItem('sona.goaldays.v1')}));
 ok('raising a goal preserves the earned day and never repeats the popup',state.d.done&&state.d.goal===50&&state.d.n===32&&state.shows===1&&state.stamps===stamp,state);
 const before=await page.evaluate(()=>localStorage.getItem('sona.gamereps.v1'));await page.evaluate(()=>{Sona.gameRep('X');Sona.gameRep('');Sona.logAttempt({sound:'R',reps:0});});
 ok('silence and invalid sounds earn nothing',before===await page.evaluate(()=>localStorage.getItem('sona.gamereps.v1')));
 const prior=await page.evaluate(()=>{const stamps=JSON.parse(localStorage.getItem('sona.goaldays.v1'));['2026-10-05','2026-10-07','2026-10-09','2026-10-11','2026-10-12','2026-10-13'].forEach(k=>stamps[k]=30);localStorage.setItem('sona.goaldays.v1',JSON.stringify(stamps));const g=Sona.getProgress();g.practiceDays={'2026-09-28':1,'2026-09-29':1,'2026-09-30':1,'2026-10-01':1,'2026-10-14':1};localStorage.setItem('sona.progress.v1',JSON.stringify(g));return Sona.momWeek();});
 ok('goal week uses earned days, preserves older weeks and retains actual practice days',prior.goalDone===3&&prior.done===1&&!prior.hit&&prior.weekStreak===2&&prior.metDays[3]&&!prior.metDays[2],prior);
 await page.evaluate(()=>{Sona.saveProfile({weeklyGoal:3});});
 ok('meeting this week adds one to completed goal weeks',await page.evaluate(()=>Sona.momWeek().weekStreak===3&&Sona.momWeek().hit));
 await page.evaluate(()=>Sona.saveProfile({weeklyGoal:7}));ok('legacy every-day goal reads as 5',await page.evaluate(()=>Sona.goalDays()===5));
 await page.evaluate(()=>{Sona.addKid('Sibling',6);});
 state=await page.evaluate(()=>({d:Sona.dayGoal(),days:Sona.goalDays(),stamps:localStorage.getItem(Sona.kkey('sona.goaldays.v1')),week:Sona.momWeek()}));
 ok('sibling starts with age 5–8 goal 50, 4 days, 0 reps and no streak',state.d.goal===50&&state.d.n===0&&!state.d.done&&state.days===4&&state.stamps===null&&state.week.weekStreak===0,state);
 await page.evaluate(()=>{Sona.saveProfile({dailyGoal:1});Sona.gameRep('R');});
 ok('sibling earns an independent daily stamp',await page.evaluate(()=>!!JSON.parse(localStorage.getItem(Sona.kkey('sona.goaldays.v1')))[Sona.localDay()]));
 await page.evaluate(()=>Sona.switchKid(''));
 ok('switching back keeps the first child count and stamp',await page.evaluate(()=>Sona.dayGoal().n===32&&Sona.dayGoal().goal===50&&Sona.dayGoal().done));
 const backup=await page.evaluate(()=>{const x=Sona.exportData();return JSON.stringify(x);});
 ok('family backup includes goal stamps',/sona.goaldays.v1/.test(backup));
 ok('restore round-trips the per-child earned days',await page.evaluate(()=>{const before=localStorage.getItem('sona.goaldays.v1'),data=Sona.exportData();localStorage.removeItem('sona.goaldays.v1');return Sona.importData(data).ok&&localStorage.getItem('sona.goaldays.v1')===before;}));
 await page.evaluate(()=>{window.__jump=86400000;});
 ok('midnight resets today, not earned history',await page.evaluate(()=>Sona.dayGoal().n===0&&!Sona.dayGoal().done&&Object.keys(JSON.parse(localStorage.getItem('sona.goaldays.v1'))).length>0));
 await page.evaluate(()=>{localStorage.setItem(Sona.kkey('sona.homework.v1'),JSON.stringify({hw:{sounds:['R'],repsPerDay:40}}));sessionStorage.setItem('sona.gate.v1',String(Date.now()-(window.__jump||0)));});
 ok('homework target outranks the family target',await page.evaluate(()=>Sona.repGoal()===40));
 await page.goto(origin+'/settings.html#reps');await page.waitForFunction(()=>!!document.getElementById('dailyGoalPick')?.options.length,{},{timeout:3000}).catch(async e=>{console.log('SETTINGS DIAGNOSTIC',await page.evaluate(()=>({url:location.href,body:document.body.textContent.slice(0,300),gate:sessionStorage.getItem('sona.gate.v1'),now:Date.now()})),errors);throw e;});
 state=await page.evaluate(()=>({lock:document.getElementById('dailyGoalPick').disabled,value:document.getElementById('dailyGoalPick').value,days:[...document.getElementById('goalDaysPick').options].map(o=>o.value),overflow:document.documentElement.scrollWidth>innerWidth+1,help:document.getElementById('goalHelp').textContent}));
 ok('grown-up controls fit 320px with 3/4/5 days and a locked assignment target',state.lock&&state.value==='40'&&state.days.join(',')==='3,4,5'&&!state.overflow&&/sound practice only/.test(state.help),state);
 ok('no page errors',errors.length===0,errors);await context.close();
 const lowered=await fresh('6');
 await lowered.page.evaluate(()=>{for(let i=0;i<40;i++)Sona.gameRep('R');Sona.saveProfile({weeklyGoal:3,childName:'Changed name'});});
 ok('name and weekly-goal changes do not create a daily completion stamp',await lowered.page.evaluate(()=>!Sona.dayGoal().done&&localStorage.getItem('sona.goaldays.v1')===null));
 await lowered.page.evaluate(()=>Sona.saveProfile({dailyGoal:30}));
 ok('lowering the daily target stamps today from already-earned real reps',await lowered.page.evaluate(()=>Sona.dayGoal().n===40&&Sona.dayGoal().done&&JSON.parse(localStorage.getItem('sona.goaldays.v1'))[Sona.localDay()]===30));
 await lowered.page.evaluate(()=>window.__jump=86400000);
 ok('a goal earned by lowering survives midnight in the weekly streak',await lowered.page.evaluate(()=>!Sona.dayGoal().done&&Sona.dayGoal().n===0&&Sona.momWeek().goalDone===1&&Sona.momWeek().metDays[3]));
 await lowered.context.close();
 const late=await fresh('4',Date.UTC(2026,10,1,5,59));
 await late.page.evaluate(()=>{Sona.saveProfile({dailyGoal:1});Sona.logAttempt({sound:'R',pass:false,reps:1});});
 ok('a voiced practice try counts even before it matches',await late.page.evaluate(()=>Sona.dayGoal().n===1&&Sona.dayGoal().done&&Sona.dayReps(undefined,true)===1));
 await late.page.evaluate(()=>window.__jump=3*3600000);
 ok('fall-back night uses the local calendar day',await late.page.evaluate(()=>Sona.localDay()==='2026-11-01'&&Sona.dayReps()===0));await late.context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
if(failed)process.exitCode=1;
