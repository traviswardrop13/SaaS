// Every selectable Feed word must have a loadable illustration; none can turn
// into an empty card after replacing the old emoji fallback.
import {createServer} from 'node:http';
import {existsSync,readFileSync,statSync} from 'node:fs';
import path from 'node:path';
import {chromium,ROOT,launchOpts} from './_env.mjs';
const feedSource=process.env.CRAFTED_FEED_SOURCE||path.join(ROOT,'arcade-feed.html');
const server=createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),f=u.pathname==='/arcade-feed.html'?feedSource:path.join(ROOT,u.pathname);if(!existsSync(f)||!statSync(f).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':({html:'text/html',js:'text/javascript',css:'text/css',webp:'image/webp',svg:'image/svg+xml',woff2:'font/woff2'})[path.extname(f).slice(1)]||'application/octet-stream'});res.end(readFileSync(f));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(launchOpts());let fails=0;
const ok=(name,good,detail)=>{if(!good)fails++;console.log((good?'PASS ':'FAIL ')+name+(good?'':' '+JSON.stringify(detail)));};
try{
 const context=await browser.newContext({viewport:{width:320,height:568},reducedMotion:'reduce'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await context.addInitScript(()=>{localStorage.setItem('sona.profile.v1',JSON.stringify({onboarded:true,childAge:4,focusSounds:['R'],voiceOn:false,soundOn:false}));localStorage.setItem('sona.micok','1');});
 // Feed Echo hears the word before it feeds (1 Oct 2026): a stand-in mic, where __mic.voice is the child talking
 await context.addInitScript(()=>{const h=window.__mic={voice:false,live:0};navigator.mediaDevices.getUserMedia=()=>{h.live++;const t={kind:'audio',readyState:'live',stop(){if(this.readyState!=='ended'){this.readyState='ended';h.live--;}}};return Promise.resolve({getTracks:()=>[t],getAudioTracks:()=>[t]});};const AC=window.AudioContext||window.webkitAudioContext;AC.prototype.createMediaStreamSource=function(){return{connect(){},disconnect(){}};};const real=AC.prototype.createAnalyser;AC.prototype.createAnalyser=function(){const an=real.call(this);an.getByteTimeDomainData=d=>{for(let i=0;i<d.length;i++)d[i]=h.voice?(i%2?200:56):128;};an.getByteFrequencyData=d=>{d.fill(0);if(h.voice)for(let i=1;i<=10&&i<d.length;i++)d[i]=220;};return an;};});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/arcade-feed.html');
 await page.locator('#startBtn').click();await page.waitForFunction(()=>document.querySelectorAll('#grid .cardBtn').length>0);
 const art=await page.evaluate(async()=>{
  if(!window.SonaCraftedWords)return{present:false};
  const words=[...new Set(Object.values(Sona.WORDS).flat().map(w=>w.w))];
  const missing=[],outside=[],files=new Set();
  for(const word of words){
   const mark=SonaCraftedWords.picture(word,54);
   if(!mark){missing.push(word);continue;}
   const el=document.createElement('span');el.innerHTML=mark;
   const image=el.querySelector(".crafted-word-crop").style.backgroundImage.match(/url\(["']?([^"')]+)/);
   if(!image){missing.push(word);continue;}files.add(image[1]);
  }
  const loaded=await Promise.all([...files].map(url=>new Promise(resolve=>{const i=new Image();i.onload=()=>resolve({url,ok:i.naturalWidth>0,w:i.naturalWidth,h:i.naturalHeight});i.onerror=()=>resolve({url,ok:false});i.src=url;})));
  const cards=[...document.querySelectorAll('#grid .cardBtn')].map(b=>({word:b.querySelector('.w').textContent,art:!!b.querySelector('.crafted-word'),width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}));
  return{present:true,count:words.length,missing,loaded,cards,overflow:document.documentElement.scrollWidth-innerWidth};
 });
 ok('Feed has an illustrated renderer',art.present);
 if(art.present){
  ok('Every existing word has illustration coverage',art.count>0&&art.missing.length===0,art.missing);
  ok('Every referenced word atlas decodes',art.loaded.every(a=>a.ok),art.loaded.filter(a=>!a.ok));
  ok('All four choices render artwork in usable buttons on the smallest phone',art.cards.length===4&&art.cards.every(c=>c.art&&c.width>=100&&c.height>=80),art.cards);
  ok('Word artwork does not widen the screen',art.overflow<=1,art.overflow);
  const before=await page.locator('#bMain b').innerText();
  // the child says it first; then the picture can be fed
  await page.waitForFunction(()=>window.__mic.live===1);await page.waitForTimeout(450);
  await page.evaluate(()=>{window.__mic.voice=true;});await page.waitForFunction(()=>!document.getElementById('grid').classList.contains('locked'));await page.evaluate(()=>{window.__mic.voice=false;});
  await page.locator('#grid .cardBtn').filter({hasText:new RegExp('^'+before+'$')}).click();
  await page.waitForTimeout(1100);
  ok('A correct illustrated choice is still fed to Echo',await page.locator('#plate .crafted-word').count()===1);
 }
 ok('Feed has no runtime errors',errors.length===0,errors);
 await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
console.log(fails?fails+' FAILED':'ALL GREEN');process.exit(fails?1:0);
