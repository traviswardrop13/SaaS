// Home fits its whole set of doors and found games, rather than only its hero.
// These assertions failed on the previous card-only fit on every phone size.
import assert from 'node:assert/strict';
import { chromium, launchOpts } from './_env.mjs';
import { serve, open } from './_phone.mjs';

const server = await serve();
const browser = await chromium.launch(launchOpts());
let count = 0;
try {
  for (const [width, height] of [[320,568],[320,693],[375,553],[390,844],[430,932],[768,1024],[1024,768]]) {
    for (const mode of ["fresh","history","done"]) {
      const completed=mode==="done";
      const safeArea=width===320&&height===693?{top:47,bottom:34}:width===320?{top:20,bottom:0}:width>=390&&width<600?{top:47,bottom:34}:null;
      const {context,page,errors} = await open(browser,server.base,{setUp:true,entitled:true,safeArea}, {width,height});
      try {
        await context.addInitScript(({completed,mode,width})=>{
          if (localStorage.getItem('test.compact.seed')) return;
          localStorage.setItem('test.compact.seed','1');
          const p=JSON.parse(localStorage.getItem('sona.profile.v1')||'{}');
          p.earlyAdopter=true;
          if(width===320&&mode==='history'){p.focusSounds=['THV','R'];p.targetSound='THV';}
          localStorage.setItem('sona.profile.v1',JSON.stringify(p));
          const d=new Date(),day=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
          const y=new Date(d);y.setDate(y.getDate()-1);const yesterday=y.getFullYear()+'-'+String(y.getMonth()+1).padStart(2,'0')+'-'+String(y.getDate()).padStart(2,'0');
          localStorage.setItem('sona.quest.v1',JSON.stringify(completed ? {i:0,last:13,s:14,f:Array.from({length:14},(_,i)=>i),ls:13,lk:'story',done:day,fd:day,got:[]} : mode==='history' ? {a:yesterday,sv:yesterday,s:14,f:Array.from({length:14},(_,i)=>i),ls:13,lk:'story',done:yesterday,fd:yesterday,got:[]} : {a:day,sv:day,i:0,last:13,s:0,f:[],done:'',got:[]}));
          HTMLMediaElement.prototype.canPlayType=()=>'';
        },{completed,mode,width});
        await page.goto(server.base+'/today.html');
        await page.waitForSelector('#libraryApp:not([hidden]) #questCard:not([hidden])');
        await page.evaluate(()=>document.fonts.ready);
        await page.waitForTimeout(100);
        const m=await page.evaluate(()=>{
          const ids=['buddyBtn','giftBtn','parentBtn','questCard','questGo','questDone','mapTomorrow','arcadeBtn','homeBooksBtn','foundRow'];
          const textBox=sel=>{const e=document.querySelector(sel);if(!e)return null;const r=document.createRange();r.selectNodeContents(e);return r.getBoundingClientRect().toJSON();};
          return {height:innerHeight,scroll:document.documentElement.scrollHeight,client:document.documentElement.clientHeight,scrollWidth:document.documentElement.scrollWidth,width:innerWidth,homeTitle:textBox('#homeTitle'),soundText:textBox('#homeSoundValue'),soundBox:document.getElementById('homeSoundWrap')?.getBoundingClientRect().toJSON(),goal:Sona.dayGoal(),readonly:!document.querySelector('#homeSound,#homeSoundWrap select,#homeSoundWrap input,#homeSoundWrap [role=combobox]'),words:[...document.querySelectorAll('#homeDoors .door-word')].map(e=>e.getBoundingClientRect().top),
            boxes:ids.map(id=>{const e=document.getElementById(id);if(!e)return {id,visible:false};const r=e.getBoundingClientRect();return {id,visible:!!e.offsetParent,top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,width:r.width};})};
        });
        assert.ok(m.readonly,'Home sound has no child picker');
        assert.ok(m.homeTitle.right<=m.soundBox.left-6,'Map heading has a clear gap before the read-only sound');
        assert.ok(m.soundText.left>=m.soundBox.left+3&&m.soundText.right<=m.soundBox.right-3,'the effective sound fits its badge');
        assert.ok(m.scrollWidth<=m.width+1,'Home has no horizontal page scroll');
        assert.ok(m.scroll<=m.client+1,`${width}x${height}, mode=${mode}: Home scrolls ${m.scroll-m.client}px`);
        const gamesDoor=m.boxes.find(b=>b.id==='arcadeBtn'),booksDoor=m.boxes.find(b=>b.id==='homeBooksBtn');
        if(Math.abs(gamesDoor.top-booksDoor.top)<1)assert.ok(Math.abs(m.words[0]-m.words[1])<1,`side-by-side door labels align at ${width}: ${m.words}`);
        else assert.ok(width>=760&&height<=850&&gamesDoor.bottom<=booksDoor.top&&Math.abs(gamesDoor.left-booksDoor.left)<1&&Math.abs(gamesDoor.width-booksDoor.width)<1,'landscape Map doors form one aligned stack beside the story');
        if(width===390&&!completed) await page.screenshot({path:process.env.TEST_OUT ? process.env.TEST_OUT+'/sona-home.png' : '/private/tmp/sona-home.png'});
        for(const b of m.boxes.filter(b=>b.visible)) assert.ok(b.top>=0&&b.bottom<=m.height-4,`${b.id} outside screen: ${JSON.stringify(m)}`);
        if(mode!=='fresh') assert.ok(m.boxes.find(b=>b.id==='foundRow').visible,'all earned games remain reachable');
        const tomorrow=m.boxes.find(b=>b.id==='mapTomorrow'),card=m.boxes.find(b=>b.id==='questCard'),door=m.boxes.find(b=>b.id==='arcadeBtn'),action=m.boxes.find(b=>b.id===(completed?'questDone':'questGo'));
        if(tomorrow.visible)assert.ok(tomorrow.top>=card.bottom-1&&(tomorrow.bottom<=door.top-1||tomorrow.right<=door.left-1),'locked Tomorrow stays below the story and clear of the doors');
        assert.ok(action.visible&&action.height>=44&&action.top>=card.top&&action.bottom<=card.bottom+1,'story action stays inside the card');
        assert.ok(door.top>=card.bottom-1||door.left>=card.right-1,'Games and story do not overlap');
        if(width===390&&mode==='fresh')assert.ok(door.height>=100,'normal-phone doors keep a comfortable size');
        for(const id of ['arcadeBtn','homeBooksBtn']) assert.ok(m.boxes.find(b=>b.id===id).height>=44,'door tap target stays at least 44px');
        // A height-only resize (Safari bars / split view) must fit again too.
        await page.setViewportSize({width,height:height+50});
        await page.waitForTimeout(100);
        const resized=await page.evaluate(()=>({height:innerHeight,scroll:document.documentElement.scrollHeight,client:document.documentElement.clientHeight,fit:document.getElementById('libraryApp').className,app:document.getElementById('libraryApp').getBoundingClientRect().toJSON()}));
        assert.ok(resized.scroll<=resized.client+1,`height-only resize ${width}x${height}, mode=${mode}: ${JSON.stringify(resized)}`);
        await page.click('#arcadeBtn');
        assert.equal(await page.getAttribute('#libraryApp','data-view'),'arcade');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),'Arcade can still scroll through all games');
        await page.waitForTimeout(550);
        await page.click('#homeBack');
        await page.waitForTimeout(100);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=document.documentElement.clientHeight+1),'Back restores complete fitted Home');
        assert.deepEqual(errors,[]);
        count++;
        console.log(`PASS whole Home ${width}x${height}, mode=${mode}`);
      } finally { await context.close(); }
    }
  }
  console.log(`${count} whole Home scenarios passed`);
} finally { await browser.close(); await server.close(); }
