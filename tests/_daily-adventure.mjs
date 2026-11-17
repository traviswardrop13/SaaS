// Local host for an isolated daily controller. Production Sona stays untouched:
// this test server adds one catalog entry, then uses its real access checks.
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import {chromium,ROOT as SOURCE_ROOT,launchOpts} from './_env.mjs';
import {fakeDevice} from './_sayplaydevice.mjs';
export {advance,until,sayWord} from './_sayplay-realgame.mjs';

const fixture=fileURLToPath(new URL('./fixtures/daily-adventure.html',import.meta.url));
// The games' words live in public/daily-adventures/pages.js (one copy for the
// app's story-game.html and this host), read here exactly as a phone reads it.
const games=(()=>{const context={window:{}};new vm.Script(readFileSync(path.join(process.env.SONATEST_PUBLIC_ROOT||SOURCE_ROOT,'daily-adventures/pages.js'),'utf8'),{filename:'pages.js'}).runInNewContext(context);return context.window.DailyAdventurePages;})();
const htmlEscape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// The old numeric/default call remains Day 4. A new controller is explicit:
// dailyHarness({key:'postboat',port:8395}). No URL parameter grants access.
export async function dailyHarness(config=8394) {
  const cfg=typeof config==='number'?{port:config}:config||{},key=cfg.key||'waterwheel';
  if(!games[key])throw new Error('No local daily fixture for '+key);
  const game={...games[key],key},port=cfg.port||(8394+Object.keys(games).indexOf(key));
  const root=process.env.SONATEST_PUBLIC_ROOT||SOURCE_ROOT,base='http://127.0.0.1:'+port;
  const mime={html:'text/html',js:'text/javascript',css:'text/css',webp:'image/webp',svg:'image/svg+xml',woff2:'font/woff2'};
  const sona=readFileSync(path.join(root,'sona.js'),'utf8');
  const fixtureHTML=readFileSync(fixture,'utf8').replace(/\{\{([a-zA-Z]+)\}\}/g,(_,field)=>field==='config'?JSON.stringify(game).replace(/</g,'\\u003c'):htmlEscape(game[field]));
  const catalog=(closed=false)=>{
    const entry=key+': { name: '+JSON.stringify(game.title)+', sub: '+JSON.stringify(game.sub)+', go: "/daily-adventure.html", group: "arcade", tier: "premium", say: true'+(closed?', comingSoon: true':'')+' },';
    // The fixture owns this temporary key even after the story player's real
    // catalog arrives. Replacing its line prevents a duplicate-key fixture.
    const clean=sona.replace(new RegExp('^\\s*'+key+':\\s*\\{[^\\n]*\\},?\\s*$','m'),'');
    // ...and from the story list. In the app these games are story days
    // (STORY_DAYS, gated by the story's own rule), and Day 3's Puzzle Bridge
    // already owns the key "bridge". This host tests the controller alone,
    // through the catalog gate it was verified on, so the served copy holds no
    // story day with this game key (the real list is untouched on disk).
    const unstoried=clean.replace(/(const STORY_DAYS = \[)([\s\S]*?)(\n  \];)/,(all,open,list,close)=>open+list.replace(new RegExp('\\n    \\{ id: "[a-z]+", game: "'+key+'",[\\s\\S]*?\\},(?=\\n|$)','g'),'')+close);
    if(!unstoried.includes('const GAME_ACTS = {'))throw new Error('Daily fixture cannot locate the real game catalog');
    return unstoried.replace('const GAME_ACTS = {','const GAME_ACTS = {\n    '+entry);
  };
  const server=createServer((req,res)=>{
    const pathname=new URL(req.url,base).pathname;
    if(pathname==='/daily-adventure.html'){res.setHeader('Content-Type','text/html');res.end(fixtureHTML);return;}
    const file=path.join(root,pathname);
    if(pathname.startsWith('/api/')||!existsSync(file)||!statSync(file).isFile()){res.writeHead(503);res.end('{}');return;}
    res.setHeader('Content-Type',mime[file.split('.').pop()]||'application/octet-stream');res.end(readFileSync(file));
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  let browser;
  try{browser=await chromium.launch(launchOpts());}catch(error){await new Promise(r=>server.close(r));throw error;}
  return {
    async fresh(options={}) {
      const context=await browser.newContext({viewport:options.viewport||{width:393,height:852},reducedMotion:options.reducedMotion||'reduce'}),errors=[];
      await context.addInitScript(fakeDevice,{age:'7',micok:true,permission:'granted',speechMs:100,...options.device});
      await context.addInitScript(enabled=>{window.__dailyNarrationFixture=enabled;},!!options.narration);
      await context.route('**/*',route=>{
        const pathname=new URL(route.request().url()).pathname;
        if(!route.request().url().startsWith(base+'/'))return route.abort();
        if(pathname==='/sona.js')return route.fulfill({contentType:'text/javascript',body:options.catalog===false?sona:catalog(options.closed)});
        if(pathname==='/daily-adventures/'+key+'.js'&&(options.blockController||process.env.DAILY_TEST_BLOCK_CONTROLLER==='1'))return route.fulfill({contentType:'text/javascript',body:'/* prechange: controller not present */'});
        return route.continue();
      });
      const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
      await page.clock.install();await page.goto(base+'/daily-adventure.html');
      await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
      return {page,context,errors};
    },
    async close(){await browser.close();await new Promise(resolve=>server.close(resolve));}
  };
}
