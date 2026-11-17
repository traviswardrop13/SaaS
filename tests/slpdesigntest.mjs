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
let ACCT = acct;
// CASELOAD PREMIUM (24 Sep 2026). GET /api/slp/plan in the route's own shape,
// one fixture per state the page must draw, plus /api/charter for the one
// line that names the family price. Every other /api/* call is logged, so a
// page view that writes anything is caught.
const PERIOD_END = Math.floor(new Date(2027, 8, 24, 12).getTime() / 1000);
const SELF = { eligible:true, workEmail:true, approved:false, requested:false };
// The Solo / Clinic plans (17 Nov 2026), in GET /api/slp/plan's own shape.
const PLANS = { solo:{ name:"Sona Solo", price:"$19.99", trialDays:14 }, clinic:{ name:"Sona Clinic", price:"$99", trialDays:14, seats:25 } };
const plan = (state, self = SELF) => ({
  ok:true, plans:PLANS, self, dashboard:true, freeDashboard:false, trialAvailable:true, trialing:false, kind:null,
  ...{ none:{ active:false, source:"none", periodEnd:null, cancelAtPeriodEnd:false },
       locked:{ active:false, source:"none", periodEnd:null, cancelAtPeriodEnd:false, dashboard:false },
       noTrial:{ active:false, source:"none", periodEnd:null, cancelAtPeriodEnd:false, trialAvailable:false },
       paid:{ active:true, source:"paid", kind:"solo", periodEnd:PERIOD_END, cancelAtPeriodEnd:false, trialAvailable:false },
       trial:{ active:true, source:"paid", kind:"solo", trialing:true, periodEnd:PERIOD_END, cancelAtPeriodEnd:false, trialAvailable:false },
       clinic:{ active:true, source:"paid", kind:"clinic", periodEnd:PERIOD_END, cancelAtPeriodEnd:false, trialAvailable:false },
       legacy:{ active:true, source:"paid", kind:"caseload", periodEnd:PERIOD_END, cancelAtPeriodEnd:false, trialAvailable:false },
       cancelling:{ active:true, source:"paid", kind:"solo", periodEnd:PERIOD_END, cancelAtPeriodEnd:true, trialAvailable:false },
       member:{ active:true, source:"clinic", periodEnd:null, cancelAtPeriodEnd:false, owner:"dana@brightsteps.org" },
       grandfathered:{ active:true, source:"grandfathered", periodEnd:null, cancelAtPeriodEnd:false, freeDashboard:true } }[state],
});
let CLINIC = { ok:true, role:"none" };
const clinicWrites = [];
const CHARTER_OPEN = { ok:true, free:false, cap:50, taken:12, left:38, open:true, source:"stripe", price:"$59.99", standard:"$99.99", label:"Charter" };
let PLAN = plan("none"), failPlan = false, CHARTER = CHARTER_OPEN, buyReply = null;
// Replies served in order before PLAN, so one page load can meet a sequence
// (the Stripe return: "not yet", then "yes").
const planQueue = [];
const planReads = [], charterReads = [];
const server = createServer((req,res) => {
  const u = new URL(req.url,"http://local.test");
  const json = (o,status=200) => { res.writeHead(status,{"content-type":"application/json"});res.end(JSON.stringify(o)); };
  let body="";req.on("data",c=>body+=c);req.on("end",()=>{
    let b={};try { b=body?JSON.parse(body):{}; } catch {}
    if(u.pathname==="/api/slp/auth/me")return json(ACCT);
    if(u.pathname==="/api/slp/plan"&&req.method==="GET"){planReads.push(u.search);return failPlan?json({ok:false,error:"Temporary plan failure"},503):json(planQueue.length?planQueue.shift():PLAN);}
    if(u.pathname==="/api/charter"&&req.method==="GET"){charterReads.push(1);return json(CHARTER);}
    if(u.pathname==="/api/slp/clinic"&&req.method==="GET")return json(CLINIC);
    if(u.pathname==="/api/slp/clinic"&&req.method==="POST"){writes.push({method:req.method,path:u.pathname,body:b});clinicWrites.push(b);return json({ok:true,sent:true,removed:true,left:true});}
    // stand-ins for Stripe's hosted pages, so leaving for them can be seen
    if(u.pathname==="/stripe-checkout-fixture"||u.pathname==="/stripe-portal-fixture"){res.writeHead(200,{"content-type":"text/html"});return res.end("<p>Stripe fixture</p>");}
    if(u.pathname.startsWith("/api/")&&req.method==="POST"){
      const here="http://127.0.0.1:"+PORT;
      if(u.pathname==="/api/slp/plan"){writes.push({method:req.method,path:u.pathname,body:b});return buyReply?json(buyReply.body,buyReply.status):json({ok:true,url:here+"/stripe-checkout-fixture"});}
      if(u.pathname==="/api/slp/plan/portal"){writes.push({method:req.method,path:u.pathname,body:b});return json({ok:true,url:here+"/stripe-portal-fixture"});}
      if(u.pathname==="/api/slp/self"){writes.push({method:req.method,path:u.pathname,body:b});return json(b.action==="request"?{ok:true,requested:true}:{ok:true,sent:true});}
      // POST /api/slp/account in the route's own shape: no email in it.
      if(u.pathname==="/api/slp/account"){writes.push({method:req.method,path:u.pathname,body:b});return json({ok:true,code:ACCT.code||b.code||"rachel-k4",familyKey:b.rotateKey?"WXYZ6789":(ACCT.familyKey||"ABCD2345"),name:b.name!=null?b.name:ACCT.name,clinic:b.clinic!=null?b.clinic:ACCT.clinic});}
    }
    if(u.pathname==="/api/slp" && req.method==="GET"){
      // The server's lock (17 Nov 2026): a new account with no plan gets 402.
      if(PLAN&&PLAN.dashboard===false){rosterReads++;return json({ok:false,needPlan:true,error:"Start your free trial to open your dashboard."},402);}
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
async function open(hash="#today",width=1440,rejectClipboard=false,previewFeatures=false,path="/slp.html"){
  const ctx=await browser.newContext({viewport:{width,height:900}}),pg=await ctx.newPage(),errors=[];
  pg.on("pageerror",e=>errors.push(e.message));
  await pg.addInitScript(({rejectClipboard,previewFeatures})=>{
    if(previewFeatures)window.SLP_PREVIEW_FEATURES=true;
    window.__copied=[];
    Object.defineProperty(navigator,"clipboard",{value:{writeText:t=>rejectClipboard?Promise.reject(new Error("Permission denied")):(window.__copied.push(t),Promise.resolve())}});
    window.confirm=()=>true;
  },{rejectClipboard,previewFeatures});
  await pg.goto("http://127.0.0.1:"+PORT+path+hash);
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
  await run("Affiliate route, and Community is gone",async()=>{
    DATA=fixture();failRoster=false;writes.length=0;
    // Community was removed (Travis, 17 Nov 2026). An old #community link
    // must land somewhere real, never on a blank page.
    const {ctx,pg}=await open("#community");
    ok("community is gone: no page, no sidebar item", await pg.locator("#page-community").count()===0 && await pg.locator('[data-page="community"]').count()===0);
    ok("…and an old #community link falls back to Today", await visible(pg,"#page-today"));
    // Live since 24 Sep 2026 (Travis): a teaser, coming 2027. CREATOR-ONLY is
    // settled — the page has to say a clinician never earns on their caseload.
    await pg.evaluate(()=>location.hash="#affiliate");await pg.waitForTimeout(80);
    ok("affiliate partnerships is live in the sidebar and opens", await visible(pg,"#page-affiliate") && await visible(pg,'[data-page="affiliate"]') && !await visible(pg,"#page-today"));
    const aff=await pg.locator("#page-affiliate").innerText();
    ok("…says coming 2027 and earning for referring friends", /Affiliate partnerships/.test(aff) && /Coming 2027/i.test(aff) && /referring Sona to friends/i.test(aff), aff);
    ok("…and that a family on your own caseload never earns you anything", /own caseload are never part of it/.test(aff) && /never earn on a family you work with/.test(aff), aff);
    ok("…and asks for nothing: no form, no payment details", await pg.locator("#page-affiliate input, #page-affiliate form").count()===0);
    for(const page of ["caseload","today","caseload","today"]){await pg.locator('[data-page="'+page+'"]').click();}
    ok("view changes never send a write", writes.filter(w=>w.method!=="GET"&&w.method!=="HEAD").length===0,JSON.stringify(writes));
    await ctx.close();
    const preview=await open("#affiliate",1440,false,true);
    for(const page of ["affiliate"]){
      await preview.pg.evaluate(page=>location.hash="#"+page,page);await preview.pg.waitForTimeout(80);
      ok(page+" remains available in injected local preview",await visible(preview.pg,"#page-"+page)&&await visible(preview.pg,'[data-page="'+page+'"]'));
    }
    await preview.ctx.close();
  });
  await run("Plan & billing offer",async()=>{
    DATA=fixture();failRoster=false;PLAN=plan("none");CHARTER=CHARTER_OPEN;buyReply=null;ACCT=acct;writes.length=0;planReads.length=0;charterReads.length=0;
    const {ctx,pg,errors}=await open("#premium");
    await pg.waitForTimeout(150);
    ok("Plan & billing is available without preview injection",await visible(pg,"#page-premium")&&await visible(pg,'[data-page="premium"]'));
    const nav=await pg.locator(".sidebar nav").evaluate(n=>[...n.children].map(c=>c.dataset.page||c.textContent.trim()));
    ok("…and sits in Workspace, right after Caseload",JSON.stringify(nav.slice(0,4))===JSON.stringify(["Workspace","today","caseload","premium"]),nav.join(","));
    ok("…with its own crumb",(await pg.locator("#pageCrumb").textContent())==="Plan & billing");
    ok("…and no Clinic item for someone without the Clinic plan",!await visible(pg,'[data-page="clinic"]'));
    const page=await pg.locator("#page-premium").innerText();
    ok("two plans, at the server's prices: Solo $19.99 a month, Clinic $99 a month",/Solo/i.test(page)&&/\$19\.99 a month/.test(page)&&/Clinic/i.test(page)&&/\$99 a month/.test(page),page);
    ok("Solo says what it includes: dashboard, homework planning, notes, the full app for every family",/Your dashboard\./.test(page)&&/Homework planning\./.test(page)&&/Progress notes\./.test(page)&&/The full Sona app for every family on your caseload\./.test(page),page);
    ok("Clinic says every clinician, up to 25, each with their own dashboard, and that the owner sees totals, never a child",
      /every clinician at your practice — up to 25 clinicians/.test(page)&&/their own dashboard/.test(page)&&/Never a child's name or practice\./.test(page),page);
    ok("…prints the family price only as /api/charter answered it, with its conditions",/parents who buy Sona on their own pay on the web, \$59\.99 a year for the first 50 families\./.test(page)&&charterReads.length>0,page);
    ok("…says the clinician never earns on their own caseload",/You never earn anything on your own caseload/.test(page));
    ok("…and how the trial works: 14 days, card now, charged on day 15 unless cancelled, cancel anytime",/Free for 14 days: Stripe takes your card now and charges on day 15 unless you cancel first/.test(page)&&/cancel anytime/.test(page),page);
    ok("…both buttons start the trial",(await pg.locator("#buySolo").innerText())==="Start 14-day free trial"&&(await pg.locator("#buyClinic").innerText())==="Start 14-day free trial");
    ok("…never 'unlimited', never a spots-left number",!/unlimited|spots? left/i.test(page));
    ok("only the offer shows",await visible(pg,"#premiumOffer")&&!await visible(pg,"#premiumPaid")&&!await visible(pg,"#premiumFree")&&!await visible(pg,"#premiumMember")&&!await visible(pg,"#planLocked"));
    for(const p of ["today","caseload","premium","settings","premium"]){await pg.locator('[data-page="'+p+'"]').click();await pg.waitForTimeout(60);}
    ok("viewing it sends no write: GETs only, until a button is pressed",writes.filter(w=>w.method!=="GET"&&w.method!=="HEAD").length===0,JSON.stringify(writes.filter(w=>w.method!=="GET")));
    ok("…and the plan is asked without a session id",planReads.length>0&&planReads.every(q=>q===""),JSON.stringify(planReads));
    await pg.locator("#buyClinic").click();
    await pg.waitForURL("**/stripe-checkout-fixture",{timeout:3000}).catch(()=>{});
    const buy=writes.filter(w=>w.path==="/api/slp/plan"&&w.method==="POST");
    ok("a buy button posts once, naming its plan, and follows the checkout link the server returned",buy.length===1&&buy[0].body.plan==="clinic"&&/\/stripe-checkout-fixture$/.test(pg.url()),pg.url()+" "+JSON.stringify(buy));
    ok("no runtime errors on the offer",errors.length===0,errors.join("; "));
    await ctx.close();
    PLAN=plan("noTrial");({ctx:c2,pg:p2}=await open("#premium"));
    var c2,p2;await p2.waitForTimeout(150);
    const nt=await p2.locator("#page-premium").innerText();
    ok("someone who already had a trial is told so, and the buttons say Choose, not trial",/You've had a free trial before, so your plan starts today\./.test(nt)&&!/Free for 14 days/.test(nt)&&(await p2.locator("#buySolo").innerText())==="Choose Solo",nt);
    await c2.close();
  });
  await run("Family price line",async()=>{
    // Every figure and the cap are the route's: a cap of 40 prints 40, and a
    // charter answer with no usable cap prints no figure rather than the bare
    // launch price (24 Sep 2026). While families pay nothing the line is
    // gone: "parents pay" must be a price a parent can be charged.
    for(const [label,reply,want] of [
      ["unavailable",{ok:false},null],
      ["while families pay nothing",{ok:true,free:true,cap:50,taken:0,left:0,open:false,source:"free"},null],
      ["once the charter spots are gone",{...CHARTER_OPEN,open:false,left:0},/parents who buy Sona on their own pay on the web, \$99\.99 a year\.$/],
      ["with the route's own cap",{...CHARTER_OPEN,cap:40},/parents who buy Sona on their own pay on the web, \$59\.99 a year for the first 40 families\.$/],
      ["from a charter answer with no cap",{...CHARTER_OPEN,cap:undefined},null],
    ]){
      PLAN=plan("none");CHARTER=reply;
      const {ctx,pg}=await open("#premium");await pg.waitForTimeout(150);
      if(want){const line=await pg.locator("#premiumParentPrice").innerText();ok("family price "+label+": the route's figure, on the web, with its conditions",want.test(line),line);}
      else ok("family price "+label+": no line at all — never a price nobody can be charged",!await visible(pg,"#premiumParentPrice")&&!/parents who buy/.test(await pg.locator("#page-premium").innerText()));
      await ctx.close();
    }
    CHARTER=CHARTER_OPEN;
  });
  await run("Plan states",async()=>{
    PLAN=plan("paid");writes.length=0;
    let {ctx,pg}=await open("#premium");await pg.waitForTimeout(150);
    let page=await pg.locator("#page-premium").innerText();
    ok("Solo: names the plan and says when it renews, at what price",await visible(pg,"#premiumPaid")&&!await visible(pg,"#premiumOffer")&&/You're on Sona Solo/.test(page)&&/Renews Sep 24, 2027, \$19\.99 a month\./.test(page),page);
    await pg.locator("#premiumManage").click();
    await pg.waitForURL("**/stripe-portal-fixture",{timeout:3000}).catch(()=>{});
    ok("…and Manage billing opens the billing portal the server returned",writes.some(w=>w.path==="/api/slp/plan/portal"&&w.method==="POST")&&/\/stripe-portal-fixture$/.test(pg.url()),pg.url());
    await ctx.close();
    PLAN=plan("trial");({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    page=await pg.locator("#premiumPaid").innerText();
    ok("trial: says when the free trial ends and what it costs after",/Free trial until Sep 24, 2027\. Then \$19\.99 a month, unless you cancel before then\./.test(page),page);
    await ctx.close();
    PLAN=plan("cancelling");({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    page=await pg.locator("#premiumPaid").innerText();
    ok("cancelled: says when it ends and that everything stays on until then",/Ends Sep 24, 2027/.test(page)&&/families keep every game until then/.test(page),page);
    await ctx.close();
    PLAN=plan("legacy");({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    page=await pg.locator("#premiumPaid").innerText();
    ok("the retired yearly plan still draws as on, for the clinicians who hold it",/Premium is on for your caseload/.test(page)&&/Renews Sep 24, 2027\./.test(page),page);
    await ctx.close();
    PLAN=plan("clinic");CLINIC={ok:true,role:"owner",seats:25,used:3,rows:[
      {email:"rachel@example.com",you:true,state:"active",name:"Rachel K",families:12,practicedWeek:7,linkReady:true},
      {email:"mia@brightsteps.org",state:"active",name:"Mia Chen",families:8,practicedWeek:3,linkReady:true},
      {email:"lee@brightsteps.org",state:"invited",name:"",families:null,practicedWeek:null,linkReady:false}]};
    writes.length=0;({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    ok("Clinic: names the plan, links to the clinic, and the sidebar shows Your clinic",/You're on Sona Clinic/.test(await pg.locator("#premiumPaid").innerText())&&await visible(pg,"#premiumClinicLink")&&await visible(pg,'[data-page="clinic"]'));
    await pg.locator('[data-page="clinic"]').click();await pg.waitForTimeout(150);
    const cl=await pg.locator("#page-clinic").innerText();
    ok("the clinic page lists each clinician with families and practiced this week",/3 of 25 seats used\./.test(cl)&&/Mia Chen/.test(cl)&&/Rachel K/.test(cl)&&/Invite sent/.test(cl)&&/Not joined yet/.test(cl),cl);
    const cells=await pg.locator("#clinicRows tr").nth(1).locator("td").allInnerTexts();
    ok("…as two numbers, never a child",cells[1]==="8"&&cells[2]==="3",JSON.stringify(cells));
    ok("…and says so at the top",/never a child's name or practice/.test(cl));
    await pg.locator("#clinicEmail").fill("new@brightsteps.org");await pg.locator("#clinicAdd").click();await pg.waitForTimeout(150);
    ok("adding a clinician is one POST with their email",clinicWrites.some(b=>b.action==="add"&&b.email==="new@brightsteps.org")&&/Invite sent to new@brightsteps\.org/.test(await pg.locator("#clinicMsg").innerText()));
    pg.once("dialog",d=>d.accept());
    await pg.locator('[data-clinic-remove="mia@brightsteps.org"]').click();await pg.waitForTimeout(150);
    ok("removing asks first, then is one POST",clinicWrites.some(b=>b.action==="remove"&&b.email==="mia@brightsteps.org"));
    await ctx.close();
    PLAN=plan("member");CLINIC={ok:true,role:"member",owner:"dana@brightsteps.org",ownerName:"Dana Owens",clinicName:"Bright Steps Speech"};
    writes.length=0;({ctx,pg}=await open("#premium"));await pg.waitForTimeout(250);
    page=await pg.locator("#page-premium").innerText();
    ok("a clinic member sees whose plan covers them, and what the owner can see",await visible(pg,"#premiumMember")&&/Dana Owens at Bright Steps Speech added you/.test(page)&&/Never a child's name, and never a child's practice\./.test(page)&&!await visible(pg,"#premiumOffer"),page);
    ok("…and no Clinic page in their sidebar",!await visible(pg,'[data-page="clinic"]'));
    CLINIC={ok:true,role:"none"};await ctx.close();
    PLAN=plan("grandfathered");writes.length=0;({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    page=await pg.locator("#page-premium").innerText();
    ok("grandfathered: the promise, in its own words",await visible(pg,"#premiumFree")&&/Your caseload has Premium, free/.test(page)&&/You joined when Sona promised free for every family on your caseload, and that promise stands\./.test(page),page);
    ok("grandfathered: offered Clinic for colleagues, never Solo, and no billing to manage",await visible(pg,"#offerClinic")&&!await visible(pg,"#offerSolo")&&!await visible(pg,"#premiumManage")&&!/\$\d/.test(await pg.locator("#premiumFree").innerText()));
    ok("no state sends a write on view",writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(writes));
    await ctx.close();
  });
  await run("A new account with no plan is locked to Plan & billing",async()=>{
    DATA=fixture();PLAN=plan("locked");ACCT=acct;writes.length=0;rosterReads=0;
    const {ctx,pg,errors}=await open("#today");await pg.waitForTimeout(250);
    ok("it lands on Plan & billing with the trial banner, not Today",await visible(pg,"#page-premium")&&await visible(pg,"#planLocked")&&!await visible(pg,"#page-today")&&/Start your 14-day free trial to open your dashboard\./.test(await pg.locator("#planLocked").innerText()));
    ok("…the caseload is never asked for",rosterReads===0,String(rosterReads));
    ok("…only Plan & billing and Talk to Rachel are in the sidebar",await visible(pg,'[data-page="premium"]')&&await visible(pg,'[data-page="feedback"]')&&!await visible(pg,'[data-page="today"]')&&!await visible(pg,'[data-page="caseload"]')&&!await visible(pg,'[data-page="settings"]'));
    await pg.evaluate(()=>location.hash="#caseload");await pg.waitForTimeout(100);
    ok("…and a typed #caseload goes back to Plan & billing",await visible(pg,"#page-premium")&&!await visible(pg,"#page-caseload"));
    ok("no runtime errors while locked",errors.length===0,errors.join("; "));
    await ctx.close();
    // A roster read that answers 402 locks too, even if the plan said otherwise.
    PLAN=plan("none");rosterReads=0;
    const second=await open("#today");
    PLAN.dashboard=false;await second.pg.locator("#todayRefresh").click().catch(()=>{});await second.pg.waitForTimeout(200);
    ok("a 402 from the caseload read locks the page too",await visible(second.pg,"#planLocked")&&await visible(second.pg,"#page-premium"));
    await second.ctx.close();
    PLAN=plan("none");
  });
  await run("Premium on your own phone",async()=>{
    PLAN=plan("none");writes.length=0;
    let {ctx,pg}=await open("#premium");await pg.waitForTimeout(150);
    ok("work email: offers the link, to the account's own address",await visible(pg,"#selfSend")&&/rachel@example\.com/.test(await pg.locator("#premiumSelf").innerText())&&!await visible(pg,"#selfRequest"));
    // NEVER "ONE PHONE" (24 Sep 2026): each link works once, but nothing on
    // the server holds a clinician to one device, so the card says what is
    // kept — the same words as /api/slp/self and the Terms.
    const card=await pg.locator("#premiumSelf").innerText();
    ok("…on your own phone or tablet, each link works once — never 'one phone'",/Premium on your own phone or tablet/.test(card)&&/Each link works once\./.test(card)&&!/one phone/i.test(await pg.locator("#page-premium").evaluate(n=>n.textContent)),card);
    await pg.locator("#selfSend").click();await pg.waitForTimeout(150);
    const send=writes.find(w=>w.path==="/api/slp/self");
    ok("…and one tap posts send, then says check your inbox",send&&send.body.action==="send"&&/Check your inbox/.test(await pg.locator("#selfDone").innerText()),JSON.stringify(send));
    await ctx.close();
    PLAN=plan("paid",{eligible:false,workEmail:false,approved:false,requested:false});writes.length=0;({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    const self=await pg.locator("#premiumSelf").innerText();
    ok("free-mail address: says a work email is needed, and offers a request",/Premium on your own phone or tablet needs a work email — your school or clinic address\./.test(self)&&await visible(pg,"#selfRequest")&&!await visible(pg,"#selfSend")&&!await visible(pg,"#selfPending"),self);
    await pg.locator("#selfRequest").click();await pg.waitForTimeout(150);
    // Was "Requested — we'll email you." until 24 Sep 2026, and nothing sends
    // that email: approval only flips a flag. So the card promises what the
    // approval changes, and shows the greyed-out button it turns on.
    const REQUESTED=/Requested — once we approve it, this button will work\./;
    const asked=await pg.locator("#premiumSelf").innerText();
    ok("…the request is one POST, then says what approval changes — and promises no email",writes.some(w=>w.path==="/api/slp/self"&&w.body.action==="request")&&REQUESTED.test(asked)&&!/we'll email you/i.test(asked)&&!await visible(pg,"#selfRequest"),asked);
    ok("…beside the button it will turn on, shown and greyed out",await visible(pg,"#selfPending")&&await pg.locator("#selfPending").isDisabled()&&(await pg.locator("#selfPending").innerText()).trim()==="Email me my Premium link");
    await ctx.close();
    PLAN=plan("none",{eligible:false,workEmail:false,approved:false,requested:true});({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    ok("already requested: says so, with nothing to press",REQUESTED.test(await pg.locator("#premiumSelf").innerText())&&!await visible(pg,"#selfRequest")&&await pg.locator("#selfPending").isDisabled());
    await ctx.close();
  });
  await run("The clinician's email survives a save",async()=>{
    // POST /api/slp/account answers without the email (only auth/me carries
    // it). Replacing the account with that answer blanked the inbox the own-
    // phone card names; a save merges instead (24 Sep 2026).
    PLAN=plan("none");ACCT=acct;writes.length=0;
    const {ctx,pg,errors}=await open("#settings");
    await pg.locator("#profName").fill("Rachel K");await pg.locator("#profSave").click();
    await pg.waitForFunction(()=>/Saved/.test(document.getElementById("profMsg").textContent),null,{timeout:3000}).catch(()=>{});
    await pg.locator("#rotateKey").click();
    await pg.waitForFunction(()=>/New key saved/.test(document.getElementById("profMsg").textContent),null,{timeout:3000}).catch(()=>{});
    ok("the profile save and the key rotation both went",writes.filter(w=>w.path==="/api/slp/account").length===2&&(await pg.locator("#profKey").inputValue())==="WXYZ6789",JSON.stringify(writes));
    await pg.evaluate(()=>location.hash="#premium");await pg.waitForTimeout(150);
    ok("…and the own-phone card still names the account's inbox",(await pg.locator("#selfEmail").innerText())==="rachel@example.com",await pg.locator("#selfEmail").innerText());
    await pg.locator("#selfSend").click();await pg.waitForTimeout(150);
    ok("…as does the sent confirmation",/on its way to rachel@example\.com/.test(await pg.locator("#selfDone").innerText()),await pg.locator("#selfDone").innerText());
    ok("no runtime errors",errors.length===0,errors.join("; "));
    await ctx.close();
  });
  await run("Plan before a code",async()=>{
    PLAN=plan("none");ACCT={...acct,code:"",familyKey:""};writes.length=0;
    const {ctx,pg}=await open("#premium");await pg.waitForTimeout(150);
    ok("the page opens before the clinician has picked a code",await visible(pg,"#page-premium")&&!await visible(pg,"#page-onboarding"));
    ok("…and the trial can start before the family link exists (the link is set up inside the dashboard)",!await pg.locator("#buySolo").isDisabled());
    ok("…while the own-phone link still waits for it",await pg.locator("#selfSend").isDisabled()&&await visible(pg,"#selfNeedLink"));
    await pg.evaluate(()=>location.hash="#caseload");await pg.waitForTimeout(80);
    ok("…and every other workspace page still starts at the one form",await visible(pg,"#page-onboarding"));
    ok("…with nothing written",writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(writes));
    ACCT=acct;await ctx.close();
  });
  await run("Plan errors are visible and retryable",async()=>{
    PLAN=plan("none");failPlan=true;
    const {ctx,pg}=await open("#premium");await pg.waitForTimeout(150);
    ok("a failed plan read shows an error and a retry, and no offer it cannot vouch for",await visible(pg,"#premiumError")&&await visible(pg,"#premiumRetry")&&!await visible(pg,"#premiumOffer"));
    failPlan=false;await pg.locator("#premiumRetry").click();await pg.waitForTimeout(200);
    ok("…and a retry that works clears it",!await visible(pg,"#premiumError")&&await visible(pg,"#premiumOffer"));
    buyReply={status:502,body:{ok:false,error:"Stripe didn't answer. Try again."}};
    await pg.locator("#buySolo").click();await pg.waitForTimeout(200);
    ok("a failed checkout says why and can be pressed again",/Stripe didn't answer/.test(await pg.locator("#premiumBuyErr").innerText())&&!await pg.locator("#buySolo").isDisabled()&&/\/slp\.html/.test(pg.url()));
    buyReply=null;await ctx.close();
  });
  await run("Return from Stripe",async()=>{
    PLAN=plan("trial");planReads.length=0;writes.length=0;
    const {ctx,pg}=await open("#premium",1440,false,false,"/slp.html?plan_session=cs_test_a1B2c3D4e5F6g7");
    await pg.waitForTimeout(200);
    ok("the session id is sent to the server to check with Stripe, once",planReads.filter(q=>q==="?session=cs_test_a1B2c3D4e5F6g7").length===1,JSON.stringify(planReads));
    ok("…then taken off the address bar",await pg.evaluate(()=>location.pathname+location.search+location.hash)==="/slp.html#premium",await pg.evaluate(()=>location.href));
    ok("…and the page welcomes them only because the server says the trial started",/Your free trial has started, and your dashboard is open\./.test(await pg.locator("#premiumReturn").innerText())&&await visible(pg,"#premiumPaid"));
    ok("…by reading, not writing",writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(writes));
    await ctx.close();
    PLAN=plan("none");planReads.length=0;
    const again=await open("#premium",1440,false,false,"/slp.html?plan_session=cs_test_unconfirmed0001");await again.pg.waitForTimeout(200);
    ok("an unconfirmed return says so, and offers to check again",/couldn't confirm that checkout yet/.test(await again.pg.locator("#premiumReturn").innerText())&&await visible(again.pg,"#premiumCheck"));
    await again.ctx.close();
    // A 200 CAN SAY NO (24 Sep 2026): the id stays until the answer is yes,
    // and Check again re-asks about it.
    const SID="cs_test_retryR3try0000042";
    planReads.length=0;writes.length=0;
    planQueue.push({...plan("locked"),activated:false,retry:true},{...plan("paid"),activated:true});PLAN=plan("paid");
    const retry=await open("#premium",1440,false,false,"/slp.html?plan_session="+SID);await retry.pg.waitForTimeout(200);
    ok("activated:false: the page says it couldn't confirm yet, and stays locked",/couldn't confirm that checkout yet/.test(await retry.pg.locator("#premiumReturn").innerText())&&await visible(retry.pg,"#premiumCheck")&&await visible(retry.pg,"#planLocked"));
    ok("…and keeps the session id, in the address bar too",planReads.filter(q=>q==="?session="+SID).length===1&&(await retry.pg.evaluate(()=>location.search))==="?plan_session="+SID,await retry.pg.evaluate(()=>location.href));
    await retry.pg.locator("#premiumCheck").click();await retry.pg.waitForTimeout(300);
    ok("Check again asks Stripe about that same session",planReads.filter(q=>q==="?session="+SID).length===2,JSON.stringify(planReads));
    ok("…and on activated:true says thank you, unlocks the dashboard, and takes the id off the address bar",/Thank you\. Your plan is on, and your dashboard is open\./.test(await retry.pg.locator("#premiumReturn").innerText())&&!await visible(retry.pg,"#premiumCheck")&&!await visible(retry.pg,"#planLocked")&&await visible(retry.pg,'[data-page="today"]')&&(await retry.pg.evaluate(()=>location.pathname+location.search+location.hash))==="/slp.html#premium",await retry.pg.evaluate(()=>location.href));
    ok("…all of it by reading, never writing",writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(writes));
    planQueue.length=0;await retry.ctx.close();
    const NO="cs_test_refused00000077";
    planReads.length=0;
    planQueue.push({...plan("none"),activated:false});PLAN=plan("none");
    const refused=await open("#premium",1440,false,false,"/slp.html?plan_session="+NO);await refused.pg.waitForTimeout(200);
    ok("a refused session leaves the address bar after one ask",planReads.filter(q=>q==="?session="+NO).length===1&&(await refused.pg.evaluate(()=>location.search))==="",await refused.pg.evaluate(()=>location.href));
    await refused.pg.locator("#premiumCheck").click();await refused.pg.waitForTimeout(250);
    ok("…and Check again no longer sends it",planReads.filter(q=>q==="?session="+NO).length===1,JSON.stringify(planReads));
    planQueue.length=0;await refused.ctx.close();
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
    for(const hash of ["#today","#caseload","#child/c1","#premium","#settings"]){
      await pg.evaluate(hash=>{location.hash=hash;},hash);await pg.waitForTimeout(80);
      const dims=await pg.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
      ok(hash+" has no document horizontal overflow at "+width,dims.scroll<=dims.viewport+1&&dims.body<=dims.viewport+1,JSON.stringify(dims));
    }
    await ctx.close();
  });
} finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
console.log(JSON.stringify({checks,failures:fails}));
process.exitCode=fails?1:0;
