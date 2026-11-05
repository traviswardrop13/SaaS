// Read the fallback the browser paints, including CSS variables and cascade.
// A missing picture must reveal opaque paint on its art-to-card chain; the
// page's own background must not hide a transparent adventure card.
import { serve } from './_phone.mjs';

export async function inspectHomeFallback(browser, root, { controls = false } = {}) {
  const server = await serve({ root });
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const failedPictures = [];
    await context.route('**/*', route => {
      const request=route.request();
      if (!request.url().startsWith(server.base+'/')) return route.abort();
      if (request.resourceType()==='image') { failedPictures.push(new URL(request.url()).pathname); return route.abort(); }
      return route.continue();
    });
    await context.addInitScript(() => {
      localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Mia',childAge:'7',focusSounds:['S'],targetSound:'S',onboarded:true,earlyAdopter:true,volume:0,voiceOn:false}));
      localStorage.setItem('sona.freeera.v1','post');
      ['2','3','4','5'].forEach(n=>localStorage.setItem('sona.freeera'+n+'.v1','done'));
      localStorage.setItem('sona.freever.v1','kept');localStorage.setItem('sona.buddyset.v1','kept');localStorage.setItem('sona.offerseen.v1','1');
      const d=new Date(),day=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      localStorage.setItem('sona.quest.v1',JSON.stringify({a:day,sv:day,f:[],s:0,done:''}));
    });
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(server.base+'/today.html',{waitUntil:'domcontentloaded',timeout:5000});
    await page.waitForFunction(()=>document.getElementById('questArt')?.classList.contains('fallback')&&document.getElementById('questCard')?.offsetParent,null,{timeout:5000});
    const read=()=>page.evaluate(()=>{
      const card=document.getElementById('questCard'),art=document.getElementById('questArt'),r=art.getBoundingClientRect();
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
      const alpha=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return ctx.getImageData(0,0,1,1).data[3];};
      const opacity=cs=>{
        const filters=[...cs.filter.matchAll(/opacity\(([^)]+)\)/g)].map(m=>parseFloat(m[1])*(m[1].includes('%')?.01:1));
        return Number(cs.opacity)*filters.reduce((n,v)=>n*v,1);
      };
      const chain=[];
      for(let e=art;e;e=e.parentElement){
        const cs=getComputedStyle(e);let effective=1;
        for(let p=e;p;p=p.parentElement)effective*=opacity(getComputedStyle(p));
        chain.push({id:e.id,color:cs.backgroundColor,alpha:alpha(cs.backgroundColor),opacity:effective});
        if(e===card)break;
      }
      const image=art.querySelector('img');
      const missing=art.classList.contains('fallback')&&!!image&&!image.naturalWidth;
      const visible=!!card.offsetParent&&r.width>0&&r.height>0;
      return {opaque:missing&&visible&&chain.some(p=>p.alpha===255&&p.opacity===1),missing,visible,chain};
    });
    const result={live:await read(),failedPictures,errors};
    if(controls){
      const style=await page.addStyleTag({content:'#questCard,#questArt,#questSummary{background:transparent!important}'});
      result.transparent=await read();
      await style.evaluate(e=>{e.textContent='#questCard,#questArt,#questSummary{background:var(--test-missing-home-backdrop)!important}';});
      result.undefinedVariable=await read();
      await style.evaluate(e=>{e.textContent='#questCard{opacity:.5!important}';});
      result.translucentCard=await read();
    }
    return result;
  } finally {
    if(context)await context.close();
    await server.close();
  }
}
