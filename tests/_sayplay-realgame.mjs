// Shared device/voice setup only. Each game's test must exercise its own
// actual finger controls and finish; this harness never grants a heard word.
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {chromium,ROOT as SOURCE_ROOT,launchOpts} from './_env.mjs';
import {fakeDevice} from './_sayplaydevice.mjs';
export const advance=(page,ms)=>page.clock.runFor(ms);
export async function until(page,predicate,max=14000,arg){for(let t=0;t<max;t+=100){if(await page.evaluate(predicate,arg))return true;await advance(page,100);}return !!(await page.evaluate(predicate,arg));}
export async function sayWord(page){if(!await until(page,()=>window.__sayplay&&__sayplay.listening))return false;await advance(page,150);await page.evaluate(()=>__quiet.voice=true);await advance(page,280);await page.evaluate(()=>__quiet.voice=false);await advance(page,650);await page.evaluate(()=>__quiet.voice=true);await advance(page,280);await page.evaluate(()=>__quiet.voice=false);return until(page,()=>__sayplay.phase==='play');}
export async function gameHarness(key,port){
 const root=process.env.SONATEST_PUBLIC_ROOT||SOURCE_ROOT,base='http://127.0.0.1:'+port,mime={html:'text/html',js:'text/javascript',css:'text/css',webp:'image/webp',svg:'image/svg+xml',woff2:'font/woff2'};
 const server=createServer((req,res)=>{const u=new URL(req.url,base),f=path.join(root,u.pathname);if(u.pathname.startsWith('/api/')||!existsSync(f)||!statSync(f).isFile()){res.writeHead(503);res.end('{}');return;}res.setHeader('Content-Type',mime[f.split('.').pop()]||'application/octet-stream');res.end(readFileSync(f));});
 await new Promise(r=>server.listen(port,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch(launchOpts());}catch(e){server.close();throw e;}
 return{async fresh(options={}){
   const context=await browser.newContext({viewport:options.viewport||{width:390,height:844},reducedMotion:'reduce'}),errors=[];
   await context.addInitScript(fakeDevice,{age:'7',micok:true,permission:'granted',speechMs:100,...options.device});
   await context.route('**/*',r=>{const u=r.request().url();if(!u.startsWith(base+'/'))return r.abort();if(options.unpark!==false&&u===base+'/sona.js')return r.fulfill({contentType:'text/javascript',body:readFileSync(root+'/sona.js','utf8').replace(new RegExp('('+key+': \\{[^\\n]*)comingSoon: true, '),'$1')});return r.continue();});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.goto(base+'/arcade-'+key+'.html');return{page,context,errors};
 },async close(){await browser.close();await new Promise(r=>server.close(r));}};
}
