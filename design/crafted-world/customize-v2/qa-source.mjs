import fs from 'node:fs';
import { chromium,launchOpts } from '/Users/traviswardrop/.codex/worktrees/crafted-redesign/SaaS/tests/_env.mjs';
const browser=await chromium.launch(launchOpts());
const out='/private/tmp/sona-customize-v2';fs.mkdirSync(out,{recursive:true});
let assertions=0;function ok(name,pass){assertions++;if(!pass)throw new Error(name);console.log('PASS '+name);}
for(const [width,height,top,bottom] of [[393,852,59,34],[320,568,20,0]]){
const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,hasTouch:true,isMobile:true,reducedMotion:'reduce'});
await context.addInitScript(()=>{if(!localStorage.getItem('sona.customize.qaseeded')){localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Mia',childAge:'7',focusSounds:['R'],onboarded:true,earlyAdopter:true,character:'fox',outfit:'none',backdrop:'sky',voiceOn:false,soundOn:false,volume:0}));localStorage.setItem('sona.customize.qaseeded','yes');}localStorage.setItem('sona.freeera.v1','post');['sona.freeera2.v1','sona.freeera3.v1','sona.freeera4.v1'].forEach(k=>localStorage.setItem(k,'done'));});
await context.route('**/*',async route=>{const u=route.request().url();if(!u.startsWith('http://127.0.0.1:8258/'))return route.abort();if(u.endsWith('.css')||u.includes('.html')){const r=await route.fetch();let body=await r.text();body=body.replace(/env\(safe-area-inset-top\)/g,top+'px').replace(/env\(safe-area-inset-bottom\)/g,bottom+'px');return route.fulfill({response:r,body});}return route.continue();});
const page=await context.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8258/customize.html');await page.waitForFunction(()=>window.Sona&&document.querySelectorAll('#chars button').length===8);await page.waitForFunction(()=>Array.from(document.querySelectorAll('.setting-scene img')).every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:out+'/'+width+'-initial.png'});
const identities=await page.evaluate(()=>Sona.CHARACTERS.map(c=>({id:c.id,name:c.name,locked:c.locked})));
for(const c of identities){if(c.locked)continue;await page.locator('#chars button').filter({hasText:c.name}).click();ok(width+' selects '+c.name,await page.evaluate(c=>Sona.getProfile().character===c.id&&document.getElementById('heroName').textContent===c.name&&document.querySelectorAll('#chars [aria-pressed="true"]').length===1,c));}
await page.locator('#chars button').filter({hasText:'Miso'}).click();await page.locator('#outfits button').filter({hasText:'Crown'}).click();await page.locator('#backdrops button').filter({hasText:'Beach'}).click();
ok(width+' saves outfit and scene',await page.evaluate(()=>{let p=Sona.getProfile();return p.outfit==='crown'&&p.backdrop==='beach'&&document.getElementById('heroOutfit').getAttribute('data-outfit')==='crown'&&document.getElementById('sceneName').textContent==='Beach';}));
await page.screenshot({path:out+'/'+width+'-scenes.png'});
await page.reload();await page.waitForFunction(()=>window.Sona&&document.getElementById('heroName').textContent==='Miso');await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';document.body.style.scrollBehavior='auto';scrollTo(0,0);});await page.locator('header.app').scrollIntoViewIfNeeded();await page.waitForTimeout(100);await page.screenshot({path:out+'/'+width+'-selected.png'});
ok(width+' persists selected trio after reload',await page.evaluate(()=>document.querySelector('#chars .on .nm').textContent==='Miso'&&document.querySelector('#outfits .on .nm').textContent==='Crown'&&document.querySelector('#backdrops .on .nm').textContent==='Beach'));
ok(width+' no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
const done=await page.locator('#done').boundingBox();ok(width+' Done stays within safe area',done.x>=0&&done.x+done.width<=width&&done.y+done.height<=height-bottom&&done.y>=top);
await page.locator('#backdrops button').last().scrollIntoViewIfNeeded();const last=await page.locator('#backdrops button').last().boundingBox();const footer=await page.locator('.customize-footer').boundingBox();ok(width+' last scene reachable above footer',last.y+last.height<=footer.y);
await page.locator('#done').click();await page.waitForURL(/(map|today)\.html/);ok(width+' Done returns to play',/(map|today)\.html/.test(page.url()));ok(width+' no JavaScript errors',errors.length===0);
console.log(JSON.stringify({width,height,errors}));await context.close();}
console.log('TOTAL '+assertions+' passed');await browser.close();
