// Native family shell must never initialize clinician screens; browsers keep access.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium, ROOT, launchOpts } from './_env.mjs';
const root=process.env.SONATEST_PUBLIC_ROOT||ROOT;
const server=createServer((req,res)=>{
 let p=new URL(req.url,'http://local').pathname;
 if(['/slp','/slp-login','/for-slps'].includes(p))p+='.html';
 if(p.startsWith('/api/')){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(p==='/api/slp/auth/me'?{ok:true,email:'clinician@example.test',code:'test',familyKey:'fixture'}:{ok:true,clients:[]}));return;}
 const file=path.join(root,p);
 if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}
 const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'}[path.extname(file)]||'application/octet-stream';
 res.writeHead(200,{'content-type':type});res.end(readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(launchOpts());
let checks=0,bad=0;
function ok(name,v,detail){checks++;if(!v)bad++;console.log((v?'PASS ':'FAIL ')+name+(v?'':' '+JSON.stringify(detail)));}
async function fresh(mode,profile=true,sibling=false){
 const ctx=await browser.newContext();const requests=[];
 await ctx.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
 ctx.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/slp/'))requests.push(new URL(r.url()).pathname);});
 await ctx.addInitScript(({mode,profile,sibling})=>{
  if(mode==='native')window.Capacitor={isNativePlatform:()=>true};
  if(mode==='legacy-native')window.Capacitor={};
  if(mode==='web-bridge')window.Capacitor={isNativePlatform:()=>false};
  if(!sessionStorage.getItem('family-test-seeded')){
   sessionStorage.setItem('family-test-seeded','1');
   sessionStorage.setItem('sona.gate.v1',String(Date.now()));
   if(profile)localStorage.setItem('sona.profile.v1',JSON.stringify({role:'slp',onboarded:true,childName:'Milo',childAge:'7',mode:'speech',focusSounds:['R'],earlyAdopter:true,voiceOn:false,soundOn:false,volume:0}));
   if(sibling)localStorage.setItem('sona.kids.v1',JSON.stringify({active:'k1',list:[{slot:'',name:'Milo'},{slot:'k1',name:''}]}));
   localStorage.setItem('sona.obdraft.v1',JSON.stringify({role:'slp',childName:'Milo',childAge:'7'}));
  }
 },{mode,profile,sibling});
 const page=await ctx.newPage();page.setDefaultTimeout(4000);return{ctx,page,requests};
}
try{
 for(const route of ['/slp-login.html','/slp.html','/for-slps.html','/slp-login','/slp','/for-slps']){
  const {ctx,page,requests}=await fresh('native');
  try{await page.goto(origin+route,{waitUntil:'domcontentloaded'});await page.waitForURL('**/today.html',{waitUntil:'domcontentloaded',timeout:1200}).catch(()=>{});ok('native '+route+' returns to family Home',new URL(page.url()).pathname==='/today.html',page.url());ok('native '+route+' never starts clinician API calls',requests.length===0,requests);}finally{await ctx.close();}
 }
 for(const config of [{mode:'native',profile:false},{mode:'native',profile:true,sibling:true},{mode:'legacy-native',profile:true}]){
  const {ctx,page}=await fresh(config.mode,config.profile,config.sibling),dest=config.profile&&!config.sibling?'/today.html':'/onboarding.html';
  try{await page.goto(origin+'/slp-login.html',{waitUntil:'domcontentloaded'});await page.waitForURL('**'+dest,{waitUntil:'domcontentloaded',timeout:1200}).catch(()=>{});ok(JSON.stringify(config)+' resolves active family setup',new URL(page.url()).pathname===dest,page.url());}finally{await ctx.close();}
 }
 for(const mode of ['browser','web-bridge'])for(const route of ['/slp-login.html','/slp.html','/for-slps.html']){
  const {ctx,page}=await fresh(mode);try{await page.goto(origin+route,{waitUntil:'domcontentloaded'});await page.waitForTimeout(100);ok(mode+' retains '+route,new URL(page.url()).pathname===route&&await page.locator('body').isVisible(),page.url());}finally{await ctx.close();}
 }
 for(const mode of ['native','browser']){
  const {ctx,page,requests}=await fresh(mode);try{
   await page.goto(origin+'/settings.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.Sona);
   const visible=await page.locator('#slpCard').isVisible();ok(mode+' settings show appropriate family/clinician controls',visible===(mode==='browser'),visible);
   if(mode==='native'){ok('native settings make no clinician API calls',requests.length===0,requests);ok('native feedback uses family wording',!/caseload/.test(await page.locator('#fbLead').innerText()));}
   ok(mode+' retains saved role/data',await page.evaluate(()=>Sona.getProfile().role==='slp'&&Sona.getProfile().childName==='Milo'));
  }finally{await ctx.close();}
 }
 const {ctx,page}=await fresh('native',false);try{await page.goto(origin+'/onboarding.html',{waitUntil:'domcontentloaded'});ok('native setup ignores a saved clinician draft',await page.evaluate(()=>draft.role==='parent'&&ORDER===ORDER_PARENT));}finally{await ctx.close();}
}finally{await browser.close();await new Promise(r=>server.close(r));}
console.log(`${checks-bad}/${checks} native family checks passed`);process.exitCode=bad?1:0;
