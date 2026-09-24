// Regression checks for the SLP redesign. Uses a synthetic roster; never contacts a real account.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";
const PORT = 8162;
const HTML = process.env.SLP_TEST_HTML || ROOT + "/slp.html";
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2" };
const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const days = (pairs) => { const o = {}; pairs.forEach(([n, a, p]) => { o[day(n)] = { a, p }; }); return o; };
function fixture() {
  return {
    kids: [
      { childId: "c1", child: "Mia", age: "6", focus: "R", goal: "20", sessions: 14, streak: 4, at: new Date().toISOString(),
        outcomes: { R: { attempts: 160, passes: 104, firstAt: day(40), lastAt: day(0), days: days([[0,12,9],[1,10,7],[3,15,10],[4,9,6],[6,14,9],[8,11,8],[9,13,9],[12,10,6],[15,12,8],[18,9,5],[22,10,7],[25,12,8],[30,11,7],[33,12,8]]), byPos: { i: { a: 70, p: 52 }, m: { a: 60, p: 36 }, f: { a: 30, p: 16 } } },
                    S: { attempts: 15, passes: 12, firstAt: day(9), lastAt: day(2), days: days([[2,15,12]]), byPos: { i: { a: 15, p: 12 } } } },
        meta: { joinedAt: day(40) }, hw: { status: "active", days: { [day(0)]: 18, [day(1)]: 22, [day(3)]: 25, [day(4)]: 9 }, hw: { id: "hw1", title: "R in the middle of words", note: "Two minutes after breakfast is plenty.", sounds: ["R"], pos: "m", repsPerDay: 20, words: null, start: day(5), due: day(-2), by: "Rachel K" } } },
      { childId: "c2", child: "Leo", age: "4", focus: "K", goal: "20", sessions: 3, streak: 0, at: day(9) + "T10:00:00Z",
        outcomes: { K: { attempts: 25, passes: 12, firstAt: day(12), lastAt: day(9), days: days([[9,25,12]]) } },
        meta: {}, hw: { status: "missed", days: { [day(10)]: 5 }, hw: { id: "hw2", title: "K at the start", note: "", sounds: ["K"], pos: "i", repsPerDay: 20, words: ["cat", "key", "kite"], start: day(14), due: day(7), by: "Rachel K" } } },
      { childId: "c3", child: "Ava", age: "7", focus: "TH", goal: "20", sessions: 0, streak: 0, at: day(30) + "T10:00:00Z", outcomes: {}, meta: { joinedAt: day(30) }, hw: { status: "none", hw: null, days: {} } },
      { childId: "c4", child: "Sam", age: "8", focus: "S, L", goal: "20", sessions: 6, streak: 2, at: day(1) + "T10:00:00Z",
        outcomes: { S: { attempts: 44, passes: 37, firstAt: day(20), lastAt: day(1), days: days([[1,14,12],[2,10,9],[5,20,16]]), byPos: { i: { a: 24, p: 21 }, f: { a: 20, p: 16 } } } }, meta: {}, hw: { status: "none", hw: null, days: {} } },
      { childId: "c5", child: "Zoe", age: "5", focus: "L", goal: "20", sessions: 2, streak: 1, at: day(2) + "T10:00:00Z",
        outcomes: { L: { attempts: 19, passes: 15, firstAt: day(6), lastAt: day(2), days: days([[2,9,7],[6,10,8]]) } }, meta: {}, hw: { status: "none", hw: null, days: {} } },
      { childId: "c6", synced: false, meta: { joinedAt: day(0), invitedAt: day(4) }, outcomes: {}, hw: { status: "none", hw: null, days: {} } },
    ],
    invites: [{ token: "ABCDEFGHJK23", label: "M.K.", age: "5", sounds: ["S"], pos: "i", repsPerDay: 20, note: "", createdAt: day(3) + "T10:00:00Z", expiresAt: day(-27) + "T10:00:00Z" }],
  };
}


let DATA = fixture(), failRoster = false, rosterReads = 0;
const writes = [];
const acct = { ok:true, email:"rachel@example.com", code:"rachel-k4", familyKey:"ABCD2345", name:"Rachel K", clinic:"Bright Steps", onboarded:true };
const server = createServer((req,res) => {
  const u = new URL(req.url,"http://local.test");
  const json = (o,status=200) => { res.writeHead(status,{"content-type":"application/json"});res.end(JSON.stringify(o)); };
  let body="";req.on("data",c=>body+=c);req.on("end",()=>{
    let b={};try { b=body?JSON.parse(body):{}; } catch {}
    if(u.pathname==="/api/slp/auth/me")return json(acct);
    if(u.pathname==="/api/slp" && req.method==="GET"){
      rosterReads++;return failRoster?json({ok:false,error:"Temporary fixture failure"},503):json({ok:true,configured:true,kids:DATA.kids,invites:DATA.invites});
    }
    if(u.pathname.startsWith("/api/")){writes.push({method:req.method,path:u.pathname,body:b});return json({ok:true});}
    const p=u.pathname==="/slp.html"?HTML:ROOT+u.pathname;if(!existsSync(p)){res.writeHead(404);return res.end();}
    res.writeHead(200,{"content-type":MIME[p.split(".").pop()]||"application/octet-stream"});res.end(readFileSync(p));
  });
});
await new Promise(resolve=>server.listen(PORT,"127.0.0.1",resolve));
const browser = await chromium.launch(launchOpts());
let fails=0,checks=0;
const ok=(name,pass,detail="")=>{checks++;if(!pass)fails++;console.log((pass?"PASS ":"FAIL ")+name+(!pass&&detail?" -> "+detail:""));};
const visible = async (pg,selector) => !!(await pg.locator(selector).count()) && await pg.locator(selector).first().isVisible();
async function open(hash="#today",width=1440,rejectClipboard=false,previewFeatures=false){
  const ctx=await browser.newContext({viewport:{width,height:900}}),pg=await ctx.newPage(),errors=[];
  pg.on("pageerror",e=>errors.push(e.message));
  await pg.addInitScript(({rejectClipboard,previewFeatures})=>{
    if(previewFeatures)window.SLP_PREVIEW_FEATURES=true;
    window.__copied=[];
    Object.defineProperty(navigator,"clipboard",{value:{writeText:t=>rejectClipboard?Promise.reject(new Error("Permission denied")):(window.__copied.push(t),Promise.resolve())}});
    window.confirm=()=>true;
  },{rejectClipboard,previewFeatures});
  await pg.goto("http://127.0.0.1:"+PORT+"/slp.html"+hash);
  await pg.waitForFunction(()=>document.getElementById("sidebarName").textContent==="Rachel K");
  await pg.waitForTimeout(200);
  return {ctx,pg,errors};
}
const names=pg=>pg.locator("#clTable tbody .name").allTextContents();
async function run(name,fn){try{await fn();}catch(e){ok(name+" did not throw",false,String(e.message).slice(0,200));}}
try {
  await run("Caseload filters",async()=>{
    DATA=fixture();failRoster=false;
    const {ctx,pg}=await open("#caseload");
    const base=(await names(pg)).sort();
    ok("fixture initially lists all six children",base.length===6,base.join(","));
    const filters=pg.locator("#clFilters [data-filter]");
    ok("caseload offers all, attention and week filters",await filters.count()>=3);
    if(await filters.count()>=3){
      for(const [key,expected] of [["attention",["Ava","Leo","Mia","New family"]],["week",["Mia","Sam","Zoe"]],["all",base]]){
        await pg.locator('#clFilters [data-filter="'+key+'"]').click();
        const actual=(await names(pg)).sort();
        ok(key+" filter uses the existing child facts",JSON.stringify(actual)===JSON.stringify(expected.slice().sort()),actual.join(","));
      }
      await pg.locator('#clFilters [data-filter="week"]').click();
      await pg.locator("#clSearch").fill("Mia");
      ok("search composes with active filter",(await names(pg)).join() === "Mia",(await names(pg)).join());
      await pg.locator("#clSearch").fill("Leo");
      ok("search does not bypass active filter",(await names(pg)).length===0);
    }
    await ctx.close();
  });
  await run("Caseload row actions",async()=>{
    DATA=fixture();failRoster=false;
    const {ctx,pg}=await open("#caseload");
    ok("rolling caseload window is labelled Last 7 days", /Last 7 days/i.test(await pg.locator("#clTable thead").textContent()));
    ok("whole-row navigation removes the separate Open action", await pg.locator("#clTable").getByRole("link",{name:"Open",exact:true}).count()===0);
    const row=pg.locator("#clTable tbody tr").filter({has:pg.locator('[data-sel="c3"]')});
    await row.locator("[data-note]").click();
    ok("Copy note does not open the child", await pg.evaluate(()=>location.hash)==="#caseload" && await pg.evaluate(()=>window.__copied.length)>0);
    await row.locator('[data-sel="c3"]').check();
    ok("row checkbox selects without opening the child", await pg.evaluate(()=>location.hash)==="#caseload" && await row.locator('[data-sel="c3"]').isChecked());
    await row.locator("td").nth(2).click();await pg.waitForTimeout(100);
    ok("clicking the row opens that child's overview", /^#child\/c3(?:\/overview)?$/.test(await pg.evaluate(()=>location.hash)) && await visible(pg,"#chOverview"));
    await ctx.close();
  });
  await run("Elapsed homework days",async()=>{
    DATA=fixture();failRoster=false;
    // Ignore ledger entries outside this assignment or after today.
    DATA.kids[0].hw.days[day(9)]=20;DATA.kids[0].hw.days[day(-1)]=20;
    const {ctx,pg}=await open("#child/c1");
    const current=await pg.locator("#chHw").textContent();
    ok("active homework counts only elapsed assignment days", /2 of 6 days so far/.test(current),current);
    await pg.evaluate(()=>location.hash="#child/c2");await pg.waitForTimeout(80);
    const ended=await pg.locator("#chHw").textContent();
    ok("ended homework uses the full completed window", /0 of 8 days/.test(ended)&&!/so far/.test(ended),ended);
    await ctx.close();
  });
  await run("Community and preview-only affiliate routes",async()=>{
    DATA=fixture();failRoster=false;writes.length=0;
    const {ctx,pg}=await open("#community");
    ok("community is available without preview injection", await visible(pg,"#page-community") && await visible(pg,'[data-page="community"]'));
    await pg.evaluate(()=>location.hash="#affiliate");await pg.waitForTimeout(80);
    ok("affiliate stays hidden without preview injection", !await visible(pg,"#page-affiliate") && !await visible(pg,'[data-page="affiliate"]') && await visible(pg,"#page-today"));
    for(const page of ["caseload","today","caseload","today"]){await pg.locator('[data-page="'+page+'"]').click();}
    ok("view changes never send a write", writes.filter(w=>w.method!=="GET"&&w.method!=="HEAD").length===0,JSON.stringify(writes));
    await ctx.close();
    const preview=await open("#community",1440,false,true);
    for(const page of ["community","affiliate"]){
      await preview.pg.evaluate(page=>location.hash="#"+page,page);await preview.pg.waitForTimeout(80);
      ok(page+" remains available in injected local preview",await visible(preview.pg,"#page-"+page)&&await visible(preview.pg,'[data-page="'+page+'"]'));
    }
    await preview.ctx.close();
  });
  await run("Roster failure and retry",async()=>{
    DATA=fixture();failRoster=false;
    const {ctx,pg}=await open();
    failRoster=true;
    await pg.locator("#todayRefresh").click();await pg.waitForTimeout(200);
    ok("failed refresh shows a visible error",await visible(pg,"#loadError"));
    await pg.evaluate(()=>{location.hash="#caseload";});await pg.waitForTimeout(100);
    ok("failed refresh preserves all existing roster rows",(await names(pg)).length===6,(await names(pg)).join(","));
    const retry=await visible(pg,"#loadRetry");ok("failed refresh provides retry",retry);
    if(retry){
      const before=rosterReads;failRoster=false;
      await pg.locator("#loadRetry").click();await pg.waitForTimeout(200);
      ok("retry makes a fresh roster request",rosterReads>before);
      ok("successful retry clears error",!await visible(pg,"#loadError"));
      ok("successful retry restores full caseload",(await names(pg)).length===6);
    }
    failRoster=false;await ctx.close();
  });
  await run("Clipboard failure",async()=>{
    DATA=fixture();failRoster=false;
    const {ctx,pg}=await open("#caseload",1440,true);
    const button=pg.locator("#clTable [data-note]").first(),original=await button.textContent();
    await button.click();await pg.waitForTimeout(150);
    const toast=await pg.locator("#toast").count()?await pg.locator("#toast").textContent():"";
    ok("clipboard rejection gives an honest error",await visible(pg,"#toast")&&/Couldn.t copy/i.test(toast),toast);
    ok("clipboard rejection keeps original button label",(await button.textContent())===original,await button.textContent());
    await ctx.close();
  });
  await run("Empty caseload invites",async()=>{
    DATA={kids:[],invites:fixture().invites};failRoster=false;
    const {ctx,pg}=await open("#caseload");
    ok("pending invites render with zero joined children",/M.K./.test(await pg.locator("#invList").textContent()),await pg.locator("#invList").textContent());
    const button=pg.locator("#clTable button").filter({hasText:/Add a child/});
    ok("empty caseload offers Add a child",await button.count()>0);
    if(await button.count()){
      await button.first().click();await pg.waitForTimeout(150);
      ok("empty caseload Add a child opens invite composer",await visible(pg,"#invComposer"),await pg.evaluate(()=>location.hash));
    }
    await ctx.close();
  });
  await run("Bulk assignment",async()=>{
    DATA=fixture();failRoster=false;
    const {ctx,pg,errors}=await open("#caseload");
    await pg.locator('[data-sel="c1"]').check();await pg.locator('[data-sel="c2"]').check();
    await pg.locator("#clBulk").click();await pg.waitForTimeout(200);
    const heading=await pg.locator("#hwHeading").textContent();
    ok("bulk selection survives navigation into composer",await visible(pg,"#composer")&&/Same homework for 2 children/.test(heading),heading+" | "+errors.join("; "));
    await ctx.close();
  });
  await run("Today drilldown resets unrelated filters",async()=>{
    DATA=fixture();failRoster=false;
    for(let n=0;n<10;n++)DATA.kids.push({...JSON.parse(JSON.stringify(DATA.kids[3])),childId:"extra"+n,child:"Sample "+n});
    const {ctx,pg}=await open("#caseload");
    await pg.locator('[data-filter="attention"]').click();
    await pg.locator("#clSearch").fill("Ava");
    await pg.locator('[data-page="today"]').click();
    await pg.locator('[data-sort="week"]').click();
    await pg.waitForTimeout(100);
    const result=await names(pg);
    ok("See all practiced children clears unrelated search and filter",result.length===13,result.join(","));
    await ctx.close();
  });
  await run("Concurrent refresh callers",async()=>{
    DATA=fixture();failRoster=false;
    const {ctx,pg}=await open();
    const result=await pg.evaluate(async()=>{
      const realFetch=fetch;let release,count=0;
      window.fetch=function(url,opts){if(url==="/api/slp"&&++count===1)return new Promise(resolve=>{release=()=>realFetch(url,opts).then(resolve);});return realFetch(url,opts);};
      let first=false,second=false;
      loadAll(()=>{first=true;});loadAll(()=>{second=true;});await release();
      await new Promise(resolve=>setTimeout(resolve,300));window.fetch=realFetch;
      return {first,second,count};
    });
    ok("concurrent callers complete after a follow-up read",result.first&&result.second&&result.count===2,JSON.stringify(result));
    await ctx.close();
  });
  await run("Mobile navigation",async()=>{
    DATA=fixture();failRoster=false;
    const {ctx,pg}=await open("#today",390);
    const menu=pg.locator("#menuBtn");
    ok("mobile menu begins aria-expanded=false",await menu.getAttribute("aria-expanded")==="false",String(await menu.getAttribute("aria-expanded")));
    await menu.click();
    ok("mobile menu announces expanded state",await menu.getAttribute("aria-expanded")==="true",String(await menu.getAttribute("aria-expanded")));
    await pg.keyboard.press("Escape");
    ok("Escape closes mobile navigation",await menu.getAttribute("aria-expanded")==="false"&&!(await pg.locator("#sidebar").getAttribute("class")).split(/\s+/).includes("open"));
    await ctx.close();
  });
  for(const width of [1440,1024,390,320])await run("Responsive "+width,async()=>{
    DATA=fixture();failRoster=false;
    const {ctx,pg}=await open("#today",width);
    for(const hash of ["#today","#caseload","#child/c1","#settings"]){
      await pg.evaluate(hash=>{location.hash=hash;},hash);await pg.waitForTimeout(80);
      const dims=await pg.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
      ok(hash+" has no document horizontal overflow at "+width,dims.scroll<=dims.viewport+1&&dims.body<=dims.viewport+1,JSON.stringify(dims));
    }
    await ctx.close();
  });
} finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
console.log(JSON.stringify({checks,failures:fails}));
process.exitCode=fails?1:0;
