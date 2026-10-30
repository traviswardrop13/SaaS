// Home fits its whole set of doors and found games, rather than only its hero.
// These assertions failed on the previous card-only fit on every phone size.
import assert from 'node:assert/strict';
import { chromium, launchOpts } from './_env.mjs';
import { serve, open } from './_phone.mjs';

const server = await serve();
const browser = await chromium.launch(launchOpts());
let count = 0;
try {
  for (const [width, height] of [[320,568],[375,553],[390,844],[430,932],[768,1024],[1024,768]]) {
    for (const completed of [false,true]) {
      const safeArea=width>=390&&width<600?{top:47,bottom:34}:null;
      const {context,page,errors} = await open(browser,server.base,{setUp:true,entitled:true,safeArea}, {width,height});
      try {
        await context.addInitScript(({completed})=>{
          if (localStorage.getItem('test.compact.seed')) return;
          localStorage.setItem('test.compact.seed','1');
          const p=JSON.parse(localStorage.getItem('sona.profile.v1')||'{}');
          p.earlyAdopter=true;
          localStorage.setItem('sona.profile.v1',JSON.stringify(p));
          const d=new Date(),day=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
          localStorage.setItem('sona.quest.v1',JSON.stringify(completed ? {i:0,last:13,s:14,f:Array.from({length:14},(_,i)=>i),ls:13,lk:'story',done:day,fd:day,got:[]} : {i:0,last:13,s:0,done:'',got:[]}));
          HTMLMediaElement.prototype.canPlayType=()=>'';
        },{completed});
        await page.goto(server.base+'/today.html');
        await page.waitForSelector('#libraryApp:not([hidden]) #questCard:not([hidden])');
        await page.evaluate(()=>document.fonts.ready);
        await page.waitForTimeout(100);
        const m=await page.evaluate(()=>{
          const ids=['questCard','arcadeBtn','homeBooksBtn','foundRow'];
          return {height:innerHeight,scroll:document.documentElement.scrollHeight,client:document.documentElement.clientHeight,words:[...document.querySelectorAll('#homeDoors .door-word')].map(e=>e.getBoundingClientRect().top),
            boxes:ids.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {id,visible:!!e.offsetParent,top:r.top,bottom:r.bottom,height:r.height};})};
        });
        assert.ok(m.scroll<=m.client+1,`${width}x${height}, done=${completed}: Home scrolls ${m.scroll-m.client}px`);
        assert.ok(Math.abs(m.words[0]-m.words[1])<1,`door labels align at ${width}: ${m.words}`);
        if(width===390&&!completed) await page.screenshot({path:process.env.TEST_OUT ? process.env.TEST_OUT+'/sona-home.png' : '/private/tmp/sona-home.png'});
        for(const b of m.boxes.filter(b=>b.visible)) assert.ok(b.top>=0&&b.bottom<=m.height-4,`${b.id} outside screen: ${JSON.stringify(m)}`);
        if(completed) assert.ok(m.boxes.find(b=>b.id==='foundRow').visible,'all earned games remain reachable');
        for(const id of ['arcadeBtn','homeBooksBtn']) assert.ok(m.boxes.find(b=>b.id===id).height>=44,'door tap target stays at least 44px');
        // A height-only resize (Safari bars / split view) must fit again too.
        await page.setViewportSize({width,height:height+50});
        await page.waitForTimeout(100);
        const resized=await page.evaluate(()=>({height:innerHeight,scroll:document.documentElement.scrollHeight,client:document.documentElement.clientHeight,fit:document.getElementById('libraryApp').className,app:document.getElementById('libraryApp').getBoundingClientRect().toJSON()}));
        assert.ok(resized.scroll<=resized.client+1,`height-only resize ${width}x${height}, done=${completed}: ${JSON.stringify(resized)}`);
        await page.click('#arcadeBtn');
        assert.equal(await page.getAttribute('#libraryApp','data-view'),'arcade');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),'Arcade can still scroll through all games');
        await page.waitForTimeout(550);
        await page.click('#homeBack');
        await page.waitForTimeout(100);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=document.documentElement.clientHeight+1),'Back restores complete fitted Home');
        assert.deepEqual(errors,[]);
        count++;
        console.log(`PASS whole Home ${width}x${height}, done=${completed}`);
      } finally { await context.close(); }
    }
  }
  console.log(`${count} whole Home scenarios passed`);
} finally { await browser.close(); await server.close(); }
