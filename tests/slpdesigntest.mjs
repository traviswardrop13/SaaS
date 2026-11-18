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
// SONA PRO (12 Nov 2026) is the one plan on sale; "paid" and "cancelling"
// below are a yearly caseload plan bought before then, still renewing.
const TRIAL_END = Math.floor(new Date(2026, 10, 26, 12).getTime() / 1000);
// The clinician's own Premium, in the route's shape: on by default (a 24–29
// Sep work email).
const SELF_BASE = { periodEnd:null, cancelAtPeriodEnd:false, canRequest:false, workEmail:true, approved:false, requested:false };
const SELF = { ...SELF_BASE, active:true, eligible:true, source:"work-email" };
const SELF_OFF = { ...SELF_BASE, active:false, eligible:false, source:"none" };
const SELF_PAID = { ...SELF_BASE, active:true, eligible:true, source:"paid", periodEnd:PERIOD_END };
const SELF_ASK = { ...SELF_OFF, workEmail:false, canRequest:true };
const PRO_BASE = { name:"Sona Pro", price:"$19.99", per:"a month", trialDays:14, trialEnd:null, periodEnd:null, cancelAtPeriodEnd:false, trialAvailable:false, offer:false };
const PRO_OFF = { ...PRO_BASE, active:false, status:"none", trialAvailable:true, offer:true };
const proOn = (o) => ({ ...PRO_BASE, active:true, status:"active", periodEnd:PERIOD_END, ...o });
// SONA CLINIC (17 Nov 2026), in the route's `clinic` block. Offered to anyone
// it does not cover (a Sona Pro holder included); one free trial per
// clinician across both plans, so a Pro holder's Clinic has no free days.
const CLINIC_OFF = { name:"Sona Clinic", price:"$99", per:"a month", trialDays:14, seats:25, role:null, active:false, status:"none", trialEnd:null, periodEnd:null, cancelAtPeriodEnd:false, trialAvailable:true, offer:true };
const clinicOn = (o) => ({ ...CLINIC_OFF, role:"owner", active:true, status:"active", periodEnd:PERIOD_END, trialAvailable:false, offer:false, ...o });
const plan = (state, self = SELF) => {
  const base = { ok:true, self, pro:PRO_OFF, clinic:CLINIC_OFF, dashboard:{ open:true }, grandfathered:false };
  const yearly = { pro:{ ...PRO_OFF, offer:!self.active } };
  const pro = (o) => ({ ...base, active:true, source:"pro", periodEnd:PERIOD_END, cancelAtPeriodEnd:false, self:{ ...SELF, source:"pro" }, pro:proOn(o), clinic:{ ...CLINIC_OFF, trialAvailable:false } });
  const clinic = (o) => ({ ...base, active:true, source:"clinic", periodEnd:PERIOD_END, cancelAtPeriodEnd:false, self:{ ...SELF, source:"clinic" }, pro:{ ...PRO_OFF, trialAvailable:false, offer:false }, clinic:clinicOn(o) });
  return {
    none:{ ...base, active:false, source:"none", periodEnd:null, cancelAtPeriodEnd:false },
    paid:{ ...base, ...yearly, active:true, source:"paid", periodEnd:PERIOD_END, cancelAtPeriodEnd:false },
    cancelling:{ ...base, ...yearly, active:true, source:"paid", periodEnd:PERIOD_END, cancelAtPeriodEnd:true },
    grandfathered:{ ...base, active:true, source:"grandfathered", grandfathered:true, periodEnd:null, cancelAtPeriodEnd:false, pro:{ ...PRO_OFF, offer:false } },
    trial:pro({ status:"trialing", trialEnd:TRIAL_END, periodEnd:TRIAL_END }),
    pro:pro({}),
    procancelling:pro({ cancelAtPeriodEnd:true }),
    pastdue:pro({ status:"past_due" }),
    clinic:clinic({}),
    clinictrial:clinic({ status:"trialing", trialEnd:TRIAL_END, periodEnd:TRIAL_END }),
    cliniccancelling:clinic({ cancelAtPeriodEnd:true }),
    // on someone else's plan: the dates are the owner's
    member:clinic({ role:"member", ownerName:"Dana Lee", practiceName:"Bright Steps" }),
    // bought Sona Clinic once; it has ended. Still the owner: the team page
    // stays, to take seats back.
    lapsed:{ ...base, active:false, source:"none", periodEnd:null, cancelAtPeriodEnd:false, pro:{ ...PRO_OFF, trialAvailable:false }, clinic:{ ...CLINIC_OFF, role:"owner", status:"canceled", trialAvailable:false } },
  }[state];
};
const CHARTER_OPEN = { ok:true, free:false, cap:50, taken:12, left:38, open:true, source:"stripe", price:"$59.99", standard:"$99.99", label:"Charter" };
let PLAN = plan("none"), failPlan = false, CHARTER = CHARTER_OPEN, buyReply = null;
// GET /api/slp/team in the route's shape: the owner first, then by name —
// Zed has the most children and is still after Ann. Two numbers a row.
const TEAM_OWNER = { ok:true, role:"owner", active:true, seats:25, used:4, rows:[
  { email:"rachel@example.com", name:"Rachel K", state:"active", children:6, practicedWeek:3, linkReady:true, you:true },
  { email:"ann@brightsteps.example", name:"Ann Baker", state:"active", children:2, practicedWeek:2, linkReady:true },
  { email:"zed@brightsteps.example", name:"Zed Young", state:"active", children:9, practicedWeek:0, linkReady:false },
  { email:"new@brightsteps.example", name:"", state:"invited", children:null, practicedWeek:null, linkReady:false },
] };
let TEAM = TEAM_OWNER, teamReply = null;
const teamReads = [];
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
    if(u.pathname==="/api/slp/team"&&req.method==="GET"){teamReads.push(u.search);return json(TEAM);}
    // stand-ins for Stripe's hosted pages, so leaving for them can be seen
    if(u.pathname==="/stripe-checkout-fixture"||u.pathname==="/stripe-portal-fixture"){res.writeHead(200,{"content-type":"text/html"});return res.end("<p>Stripe fixture</p>");}
    if(u.pathname.startsWith("/api/")&&req.method==="POST"){
      const here="http://127.0.0.1:"+PORT;
      if(u.pathname==="/api/slp/plan"){writes.push({method:req.method,path:u.pathname,body:b});return buyReply?json(buyReply.body,buyReply.status):json({ok:true,url:here+"/stripe-checkout-fixture"});}
      if(u.pathname==="/api/slp/plan/portal"){writes.push({method:req.method,path:u.pathname,body:b});return json({ok:true,url:here+"/stripe-portal-fixture"});}
      if(u.pathname==="/api/slp/self"){writes.push({method:req.method,path:u.pathname,body:b});return json(b.action==="request"?{ok:true,requested:true}:{ok:true,sent:true});}
      if(u.pathname==="/api/slp/team"){writes.push({method:req.method,path:u.pathname,body:b});if(teamReply)return json(teamReply.body,teamReply.status);return json(b.action==="add"?{ok:true,sent:true,resent:b.email==="new@brightsteps.example"}:b.action==="remove"?{ok:true,removed:true}:{ok:true,left:true});}
      // POST /api/slp/account in the route's own shape: no email in it.
      if(u.pathname==="/api/slp/account"){writes.push({method:req.method,path:u.pathname,body:b});return json({ok:true,code:ACCT.code||b.code||"rachel-k4",familyKey:b.rotateKey?"WXYZ6789":(ACCT.familyKey||"ABCD2345"),name:b.name!=null?b.name:ACCT.name,clinic:b.clinic!=null?b.clinic:ACCT.clinic});}
    }
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
async function open(hash="#today",width=1440,rejectClipboard=false,previewFeatures=false,path="/slp.html",want=""){
  const ctx=await browser.newContext({viewport:{width,height:900}}),pg=await ctx.newPage(),errors=[];
  pg.on("pageerror",e=>errors.push(e.message));
  await pg.addInitScript(({rejectClipboard,previewFeatures,want})=>{
    if(previewFeatures)window.SLP_PREVIEW_FEATURES=true;
    // the plans page's hint (sona.slp.wantplan), set before the dashboard loads
    if(want&&!sessionStorage.getItem("__wantSet")){try{localStorage.setItem("sona.slp.wantplan",JSON.stringify({plan:want,at:Date.now()}));sessionStorage.setItem("__wantSet","1");}catch(e){}}
    window.__copied=[];window.__confirms=[];
    Object.defineProperty(navigator,"clipboard",{value:{writeText:t=>rejectClipboard?Promise.reject(new Error("Permission denied")):(window.__copied.push(t),Promise.resolve())}});
    window.confirm=(m)=>{window.__confirms.push(m);return true;};
  },{rejectClipboard,previewFeatures,want});
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
  // SLPCLEAN1 (Travis, 17 Nov 2026: "remove unnecessary features"):
  // Community and Affiliate partnerships left the dashboard. Their old
  // addresses open Today, in the ordinary build and the local preview alike,
  // and moving between pages still writes nothing.
  await run("Pages that left the dashboard",async()=>{
    DATA=fixture();failRoster=false;writes.length=0;
    for(const preview of [false,true]){
      const {ctx,pg}=await open("#community",1440,false,preview);
      const tag=preview?" (local preview)":"";
      ok("#community opens Today"+tag,await visible(pg,"#page-today")&&await pg.evaluate(()=>location.hash)==="#today"&&!await pg.locator('[data-page="community"]').count());
      await pg.evaluate(()=>location.hash="#affiliate");await pg.waitForTimeout(100);
      ok("#affiliate opens Today"+tag,await visible(pg,"#page-today")&&await pg.evaluate(()=>location.hash)==="#today"&&!await pg.locator('[data-page="affiliate"]').count());
      await ctx.close();
    }
    const {ctx,pg}=await open("#today");
    for(const page of ["caseload","play","today","settings"]){await pg.locator('[data-page="'+page+'"]').click();}
    ok("view changes never send a write", writes.filter(w=>w.method!=="GET"&&w.method!=="HEAD").length===0,JSON.stringify(writes));
    await ctx.close();
  });
  // THE DASHBOARD SELLS NOTHING (Travis, 18 Nov 2026: "they dont purcahse
  // in the dashboard. just on the site"). Your plan, its two offer cards and
  // every trial button left the page; a clinician picks a plan on
  // speaksona.com/plans. What is left reads the plan and never writes.
  const SELLING=/\$\s?\d|free trial|days free|Start my free trial|Get Sona Pro|Get Sona Clinic|Sona Clinic|a month|checkout|Unlimited families|spots? left/i;
  await run("No plan page",async()=>{
    DATA=fixture();failRoster=false;PLAN=plan("none");CHARTER=CHARTER_OPEN;buyReply=null;ACCT=acct;writes.length=0;planReads.length=0;charterReads.length=0;
    const {ctx,pg,errors}=await open("#premium");
    await pg.waitForTimeout(150);
    const nav=await pg.locator(".sidebar nav").evaluate(n=>[...n.children].filter(c=>!c.hidden).map(c=>c.dataset.page||c.textContent.trim()));
    ok("the menu is Session games, Today, Caseload and Settings: no Your plan",JSON.stringify(nav)===JSON.stringify(["play","today","caseload","settings"])&&!(await pg.locator('[data-page="premium"]').count()),nav.join(","));
    ok("…and no plan page: its old address (#premium) opens Settings",!(await pg.locator("#page-premium").count())&&await visible(pg,"#page-settings")&&(await pg.locator("#pageCrumb").textContent())==="Settings"&&(await pg.evaluate(()=>location.hash))==="#settings");
    ok("…and Your clinic stays out of the menu for anyone but a Sona Clinic owner",!await visible(pg,'[data-page="team"]'));
    // Even while the server offers both plans, with prices, the page shows none.
    const seen=[];
    for(const p of ["today","caseload","play","settings"]){await pg.locator('[data-page="'+p+'"]').click();await pg.waitForTimeout(80);const t=await pg.locator("main").innerText(),hit=t.match(SELLING);if(hit)seen.push(p+": "+t.slice(Math.max(0,hit.index-50),hit.index+50));}
    ok("no price, offer, trial, Sona Clinic or checkout on any page, though the server offers Sona Pro and Sona Clinic",seen.length===0&&!(await pg.locator("#premiumTop,#proBuy,#clinicBuy,#setProBuy,#famProBuy").count()),seen);
    ok("viewing it sends no write: GETs only",writes.filter(w=>w.method!=="GET"&&w.method!=="HEAD").length===0,JSON.stringify(writes.filter(w=>w.method!=="GET")));
    ok("…the plan is asked without a session id, and /api/charter is never asked",planReads.length>0&&planReads.every(q=>q==="")&&charterReads.length===0,JSON.stringify(planReads));
    ok("…and nothing on the page can ask for a checkout but TRIALGO1, once",(readFileSync(HTML,"utf8").match(/planPost\("\/api\/slp\/plan",/g)||[]).length===1);
    ok("no runtime errors",errors.length===0,errors.join("; "));
    await ctx.close();
  });
  // SETTINGS, ONCE A PLAN IS ON: one line (the plan and its date) and Manage
  // billing, on the web. No price, ever.
  await run("Plan states in Settings",async()=>{
    const line=async(pg)=>({shown:await visible(pg,"#setPlan"),line:(await pg.locator("#setPlanLine").textContent()),manage:await visible(pg,"#setManage"),text:await pg.locator("#setPlan").innerText()});
    PLAN=plan("trial");writes.length=0;
    let {ctx,pg,errors}=await open("#settings");await pg.waitForTimeout(150);
    let c=await line(pg);
    ok("trial: \"Sona Pro · free trial until Nov 26\", with Manage billing, and no price",c.shown&&/^Sona Pro · free trial until Nov 26(, 2026)?$/.test(c.line)&&c.manage&&!/\$\d/.test(c.text),JSON.stringify(c));
    ok("…showing it is a read, never a write",writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(writes));
    await pg.locator("#setManage").click();
    await pg.waitForURL("**/stripe-portal-fixture",{timeout:3000}).catch(()=>{});
    ok("…and Manage billing opens the billing portal the server returned",writes.filter(w=>w.path==="/api/slp/plan/portal"&&w.method==="POST").length===1&&/\/stripe-portal-fixture$/.test(pg.url()),pg.url());
    ok("no runtime errors",errors.length===0,errors.join("; "));
    await ctx.close();
    for(const [state,want] of [["pro",/^Sona Pro · renews Sep 24, 2027$/],["procancelling",/^Sona Pro · ends Sep 24, 2027$/],["pastdue",/^Sona Pro · your last payment didn't go through\. Update your card in Manage billing\.$/],
      ["paid",/^Your yearly plan · renews Sep 24, 2027$/],["cancelling",/^Your yearly plan · ends Sep 24, 2027$/],["clinic",/^Sona Clinic · renews Sep 24, 2027$/],["clinictrial",/^Sona Clinic · free trial until Nov 26(, 2026)?$/],["cliniccancelling",/^Sona Clinic · ends Sep 24, 2027$/]]){
      PLAN=plan(state);({ctx,pg}=await open("#settings"));await pg.waitForTimeout(150);
      c=await line(pg);
      ok(state+": "+want.source.replace(/\\/g,"")+", with Manage billing",c.shown&&want.test(c.line)&&c.manage,JSON.stringify(c));
      await ctx.close();
    }
    PLAN=plan("paid");writes.length=0;({ctx,pg}=await open("#settings"));await pg.waitForTimeout(150);
    await pg.locator("#setManage").click();
    await pg.waitForURL("**/stripe-portal-fixture",{timeout:3000}).catch(()=>{});
    ok("a yearly plan still renewing: Manage billing opens the billing portal too",writes.some(w=>w.path==="/api/slp/plan/portal"&&w.method==="POST")&&/\/stripe-portal-fixture$/.test(pg.url()),pg.url());
    await ctx.close();
    for(const [state,label] of [["none","nothing on"],["grandfathered","grandfathered"]]){
      PLAN=plan(state);({ctx,pg}=await open("#settings"));await pg.waitForTimeout(150);
      ok(label+": no plan line and no billing to manage",!await visible(pg,"#setPlan")&&!await visible(pg,"#setManage"));
      await ctx.close();
    }
    failPlan=true;({ctx,pg}=await open("#settings"));await pg.waitForTimeout(200);
    ok("the plan didn't answer: no line, no button, no error page — Settings works",!await visible(pg,"#setPlan")&&await visible(pg,"#profName")&&await visible(pg,"#deleteOpen"));
    failPlan=false;await ctx.close();
  });
  await run("Sona Clinic, owned or joined",async()=>{
    PLAN=plan("clinic");writes.length=0;
    let {ctx,pg,errors}=await open("#settings");await pg.waitForTimeout(150);
    ok("owner: Your clinic in the menu, before Settings",JSON.stringify(await pg.locator(".sidebar nav").evaluate(n=>[...n.children].filter(c=>!c.hidden).map(c=>c.dataset.page)))===JSON.stringify(["play","today","caseload","team","settings"]));
    ok("…and the delete card says the team goes too",await visible(pg,"#deleteClinic")&&!await visible(pg,"#setTeam"));
    ok("no runtime errors",errors.length===0,errors.join("; "));
    await ctx.close();
    PLAN=plan("member");writes.length=0;({ctx,pg,errors}=await open("#settings"));await pg.waitForTimeout(200);
    ok("member: one line and Leave, in place of a plan line: no price, no billing",await visible(pg,"#setTeam")&&(await pg.locator("#setTeamWho").innerText()).trim()==="You're on Dana Lee's Sona Clinic plan."&&await visible(pg,"#setTeamLeave")&&!await visible(pg,"#setPlan")&&!await visible(pg,"#setManage"));
    ok("…and Your clinic is not in their menu",!await visible(pg,'[data-page="team"]'));
    await pg.locator("#setTeamLeave").click();await pg.waitForTimeout(250);
    const leave=writes.filter(w=>w.path==="/api/slp/team");
    const asked=await pg.evaluate(()=>window.__confirms.slice(-1)[0]||"");
    ok("…Leave asks first, then posts leave once",leave.length===1&&JSON.stringify(leave[0].body)===JSON.stringify({action:"leave"})&&/Leave your clinic\?/.test(asked),JSON.stringify(leave)+" "+asked);
    ok("no runtime errors",errors.length===0,errors.join("; "));
    await ctx.close();
    // an owner whose plan has ended: still the owner, to take seats back
    PLAN=plan("lapsed");({ctx,pg}=await open("#settings"));await pg.waitForTimeout(150);
    ok("lapsed owner: Your clinic stays in the menu, and no plan line",await visible(pg,'[data-page="team"]')&&!await visible(pg,"#setPlan"));
    await ctx.close();
  });
  await run("Your clinic (the owner's view)",async()=>{
    PLAN=plan("clinic");TEAM=TEAM_OWNER;teamReply=null;writes.length=0;teamReads.length=0;
    let {ctx,pg,errors}=await open("#team");await pg.waitForTimeout(250);
    const today=await pg.evaluate(()=>isoToday());
    ok("the page asks for the team with this browser's own date, by GET only",teamReads.length>=1&&teamReads.every(q=>q==="?today="+today)&&writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(teamReads));
    const head=await pg.locator("#page-team .page-header").innerText();
    ok("a heading and one short line, with no eyebrow, footnote or Refresh",/^Your clinic\s+Add the clinicians at your practice\./.test(head)&&!(await pg.locator("#page-team .eyebrow").count())&&!(await pg.locator("#page-team button",{hasText:"Refresh"}).count())&&(await pg.locator("#page-team .card").count())===1,head);
    const rows=await pg.evaluate(()=>[...document.querySelectorAll("#teamList .team-row")].map(r=>r.innerText.replace(/\s+/g," ").trim()));
    ok("one row per seat, in the server's order — owner first, then by name, never by a number",rows.length===4&&/^Rachel K You/.test(rows[0])&&/^Ann Baker/.test(rows[1])&&/^Zed Young/.test(rows[2])&&/^new@brightsteps\.example Invited/.test(rows[3]),JSON.stringify(rows));
    ok("…two numbers each, labelled briefly; a clinician with no family link says so",/6 children · 3 practiced in the last 7 days/.test(rows[0])&&/2 children · 2 practiced in the last 7 days/.test(rows[1])&&/No family link yet/.test(rows[2])&&!/children/.test(rows[3]),JSON.stringify(rows));
    const page=await pg.locator("#page-team").innerText();
    ok("…the seats used, from the server",/4 of 25 clinicians/.test(page),page);
    ok("…and nothing about a child: no name, no sound, no pass rate, no percentage, no average or rank",!/Mia|Leo|Ava|%|average|rank|top|pass rate/i.test(page),page);
    ok("…with Remove on every other seat, Resend on the invited one, and nothing on the owner's own",await pg.locator("#teamList .team-row").nth(0).locator("button").count()===0&&
      await pg.locator("[data-team-remove]").count()===3&&await pg.locator("[data-team-resend]").count()===1);
    await pg.locator("#teamEmail").fill("not-an-email");await pg.locator("#teamAdd").click();await pg.waitForTimeout(100);
    ok("a malformed address is caught on the page, before anything is sent",writes.filter(w=>w.path==="/api/slp/team").length===0&&/Enter their email/.test(await pg.locator("#teamErr").innerText()));
    await pg.locator("#teamEmail").fill("  Bo@BrightSteps.example ");await pg.locator("#teamAdd").click();await pg.waitForTimeout(250);
    let posts=writes.filter(w=>w.path==="/api/slp/team");
    ok("Send invite posts add once, with the address trimmed, and says it went",posts.length===1&&JSON.stringify(posts[0].body)===JSON.stringify({action:"add",email:"bo@brightsteps.example"})&&/Invite sent to bo@brightsteps\.example\./.test(await pg.locator("#teamDone").innerText()),JSON.stringify(posts));
    await pg.locator('[data-team-resend="new@brightsteps.example"]').click();await pg.waitForTimeout(250);
    posts=writes.filter(w=>w.path==="/api/slp/team");
    ok("Resend posts add for that address again, and says sent again",posts.length===2&&JSON.stringify(posts[1].body)===JSON.stringify({action:"add",email:"new@brightsteps.example"})&&/Invite sent again to new@brightsteps\.example/.test(await pg.locator("#teamDone").innerText()),JSON.stringify(posts));
    await pg.locator('[data-team-remove="ann@brightsteps.example"]').click();await pg.waitForTimeout(250);
    posts=writes.filter(w=>w.path==="/api/slp/team");
    const asked=await pg.evaluate(()=>window.__confirms.slice(-1)[0]||"");
    ok("Remove asks first, then posts remove for that address",posts.length===3&&JSON.stringify(posts[2].body)===JSON.stringify({action:"remove",email:"ann@brightsteps.example"})&&/Remove ann@brightsteps\.example from your clinic\?/.test(asked),JSON.stringify(posts)+" "+asked);
    teamReply={status:409,body:{ok:false,error:"All 25 seats on your clinic's plan are in use. Email hello@speaksona.com to add more."}};
    await pg.locator("#teamEmail").fill("full@brightsteps.example");await pg.locator("#teamAdd").click();await pg.waitForTimeout(250);
    ok("a refusal is the server's own words",/All 25 seats/.test(await pg.locator("#teamErr").innerText()));
    teamReply=null;
    ok("no runtime errors",errors.length===0,errors.join("; "));
    await ctx.close();
    for(const width of [390,320]){
      ({ctx,pg}=await open("#team",width));await pg.waitForTimeout(250);
      const fit=await pg.evaluate(()=>({over:document.documentElement.scrollWidth-innerWidth,rows:[...document.querySelectorAll("#teamList .team-row")].every(r=>{const q=r.getBoundingClientRect();return q.left>=0&&q.right<=innerWidth+1;})}));
      ok(width+"px: Your clinic fits, every row on the screen",fit.over<=1&&fit.rows,JSON.stringify(fit));
      await ctx.close();
    }
    // the plan has ended: nothing to add, the numbers go, removing still works
    TEAM={...TEAM_OWNER,active:false,rows:TEAM_OWNER.rows.map(r=>r.you||r.state==="invited"?r:{...r,children:null,practicedWeek:null})};PLAN=plan("lapsed");writes.length=0;
    ({ctx,pg}=await open("#team"));await pg.waitForTimeout(250);
    ok("lapsed: says the plan isn't on (and points to no checkout), offers no invite, shows no numbers for others, and Remove still works",await visible(pg,"#teamLapsed")&&!(await pg.locator("#teamLapsed a").count())&&!await visible(pg,"#teamAddForm")&&
      await pg.locator("[data-team-remove]").count()===3&&await pg.locator("[data-team-resend]").count()===0&&!/children/.test(await pg.locator("#teamList .team-row").nth(1).innerText()));
    await pg.locator('[data-team-remove="zed@brightsteps.example"]').click();await pg.waitForTimeout(250);
    ok("…and a removal there is posted",writes.some(w=>w.path==="/api/slp/team"&&w.body.action==="remove"&&w.body.email==="zed@brightsteps.example"));
    await ctx.close();
    // anyone but the owner: the server says so, and the page goes to Today
    TEAM={ok:true,role:null};PLAN=plan("none");
    ({ctx,pg}=await open("#team"));await pg.waitForTimeout(300);
    ok("not an owner: #team opens Today, and Your clinic is not in the menu",await visible(pg,"#page-today")&&!await visible(pg,"#page-team")&&await pg.evaluate(()=>location.hash)==="#today"&&!await visible(pg,'[data-page="team"]'));
    await ctx.close();
    TEAM=TEAM_OWNER;
  });
  await run("Joined a clinic, back from the invite",async()=>{
    PLAN=plan("member");planReads.length=0;writes.length=0;
    const {ctx,pg,errors}=await open("#premium",1440,false,false,"/slp.html?joined=team");
    await pg.waitForTimeout(250);
    ok("?joined=team says so once, in a toast, and leaves the address bar",/You've joined your clinic's Sona plan\./.test(await pg.locator("#toast").innerText())&&(await pg.evaluate(()=>location.pathname+location.search+location.hash))==="/slp.html#settings",await pg.evaluate(()=>location.href));
    ok("…on Settings, which says whose plan covers them",await visible(pg,"#setTeam")&&/Dana Lee's Sona Clinic plan/.test(await pg.locator("#setTeamWho").innerText()));
    ok("…by reading, never writing",writes.filter(w=>w.method!=="GET").length===0&&errors.length===0,JSON.stringify(writes)+errors.join(";"));
    await ctx.close();
  });
  // THE CLINICIAN'S OWN PHONE (moved to Settings with the plan page's end).
  await run("Premium on your own phone",async()=>{
    PLAN=plan("none");writes.length=0;
    let {ctx,pg}=await open("#settings");await pg.waitForTimeout(150);
    ok("work email: offers the link, to the account's own address",await visible(pg,"#selfSend")&&/rachel@example\.com/.test(await pg.locator("#premiumSelf").innerText())&&!await visible(pg,"#selfRequest"));
    // NEVER "ONE PHONE" (24 Sep 2026): each link works once, but nothing on
    // the server holds a clinician to one device, so the card says what is
    // kept — the same words as /api/slp/self and the Terms.
    const card=await pg.locator("#premiumSelf").innerText();
    ok("…on your own phone or tablet, each link works once — never 'one phone', never a price",/Premium on your own phone or tablet/.test(card)&&/Each link works once\./.test(card)&&!/one phone/i.test(await pg.locator("#page-settings").evaluate(n=>n.textContent))&&!/\$\d/.test(card),card);
    await pg.locator("#selfSend").click();await pg.waitForTimeout(150);
    const send=writes.find(w=>w.path==="/api/slp/self");
    ok("…and one tap posts send, then says check your inbox",send&&send.body.action==="send"&&/Check your inbox/.test(await pg.locator("#selfDone").innerText()),JSON.stringify(send));
    await ctx.close();
    PLAN=plan("paid",SELF_ASK);writes.length=0;({ctx,pg}=await open("#settings"));await pg.waitForTimeout(150);
    const self=await pg.locator("#premiumSelf").innerText();
    ok("24–29 Sep free-mail address: says a work email is needed, and offers a request — no price",!/\$\d/.test(self)&&/Premium on your own phone or tablet needs a work email — your school or clinic address\./.test(self)&&await visible(pg,"#selfRequest")&&!await visible(pg,"#selfSend")&&!await visible(pg,"#selfPending"),self);
    await pg.locator("#selfRequest").click();await pg.waitForTimeout(150);
    // Was "Requested — we'll email you." until 24 Sep 2026, and nothing sends
    // that email: approval only flips a flag. So the card promises what the
    // approval changes, and shows the greyed-out button it turns on.
    const REQUESTED=/Requested — once we approve it, this button will work\./;
    const asked=await pg.locator("#premiumSelf").innerText();
    ok("…the request is one POST, then says what approval changes — and promises no email",writes.some(w=>w.path==="/api/slp/self"&&w.body.action==="request")&&REQUESTED.test(asked)&&!/we'll email you/i.test(asked)&&!await visible(pg,"#selfRequest"),asked);
    ok("…beside the button it will turn on, shown and greyed out",await visible(pg,"#selfPending")&&await pg.locator("#selfPending").isDisabled()&&(await pg.locator("#selfPending").innerText()).trim()==="Email me my Premium link");
    await ctx.close();
    PLAN=plan("none",{...SELF_ASK,requested:true});({ctx,pg}=await open("#settings"));await pg.waitForTimeout(150);
    ok("already requested: says so, with nothing to press",REQUESTED.test(await pg.locator("#premiumSelf").innerText())&&!await visible(pg,"#selfRequest")&&await pg.locator("#selfPending").isDisabled());
    await ctx.close();
    // Nothing on (a 29 Sep – 12 Nov account): their own phone comes with
    // Sona Pro, which the dashboard does not sell, so there is no card.
    PLAN=plan("none",SELF_OFF);({ctx,pg}=await open("#settings"));await pg.waitForTimeout(150);
    ok("own phone off: no card for it, and nothing selling it",!await visible(pg,"#premiumSelf")&&!SELLING.test(await pg.locator("#page-settings").innerText()));
    await ctx.close();
    PLAN=plan("pro");writes.length=0;({ctx,pg}=await open("#settings"));await pg.waitForTimeout(150);
    ok("with Sona Pro: the card offers the link, and no second billing button of its own",await visible(pg,"#selfSend")&&!(await pg.locator("#premiumSelf button",{hasText:"Manage billing"}).count()));
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
    await pg.evaluate(()=>location.hash="#today");await pg.waitForTimeout(100);
    await pg.evaluate(()=>location.hash="#settings");await pg.waitForTimeout(150);
    ok("…and the own-phone card still names the account's inbox",(await pg.locator("#selfEmail").innerText())==="rachel@example.com",await pg.locator("#selfEmail").innerText());
    await pg.locator("#selfSend").click();await pg.waitForTimeout(150);
    ok("…as does the sent confirmation",/on its way to rachel@example\.com/.test(await pg.locator("#selfDone").innerText()),await pg.locator("#selfDone").innerText());
    ok("no runtime errors",errors.length===0,errors.join("; "));
    await ctx.close();
  });
  await run("Before a code",async()=>{
    // Every new account starts with no family code; open or locked, what
    // works then is the same as ever, with nothing written.
    PLAN=plan("none");ACCT={...acct,code:"",familyKey:""};writes.length=0;
    let {ctx,pg}=await open("#play");await pg.waitForTimeout(150);
    ok("open, no code: Session games works before the clinician has picked a code",await visible(pg,"#page-play")&&!await visible(pg,"#page-onboarding"));
    await pg.evaluate(()=>location.hash="#caseload");await pg.waitForTimeout(80);
    ok("…while every other workspace page still starts at the one form",await visible(pg,"#page-onboarding"));
    await pg.evaluate(()=>location.hash="#premium");await pg.waitForTimeout(80);
    ok("…the plan page's old address too (Settings needs a code while the dashboard is open)",await visible(pg,"#page-onboarding"));
    ok("…with nothing written",writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(writes));
    await ctx.close();
    PLAN={...plan("none"),dashboard:{open:false}};writes.length=0;
    ({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    ok("locked, no code: the old address opens the locked screen, never the form",await visible(pg,"#page-locked")&&!await visible(pg,"#page-onboarding")&&(await pg.evaluate(()=>location.hash))==="#locked");
    await pg.evaluate(()=>location.hash="#settings");await pg.waitForTimeout(100);
    ok("…and Settings, Delete my account included, opens without a code",await visible(pg,"#page-settings")&&await visible(pg,"#deleteOpen"));
    ok("…with nothing written",writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(writes));
    ACCT=acct;await ctx.close();
  });
  await run("Return from Stripe",async()=>{
    PLAN=plan("trial");planReads.length=0;writes.length=0;rosterReads=0;
    const {ctx,pg,errors}=await open("#premium",1440,false,false,"/slp.html?plan_session=cs_test_a1B2c3D4e5F6g7");
    await pg.waitForTimeout(250);
    ok("the session id is sent to the server to check with Stripe, once, before the caseload is read",planReads.filter(q=>q==="?session=cs_test_a1B2c3D4e5F6g7").length===1&&planReads[0]==="?session=cs_test_a1B2c3D4e5F6g7"&&rosterReads>=1,JSON.stringify(planReads));
    ok("…then taken off the address bar, which lands on Settings",await pg.evaluate(()=>location.pathname+location.search+location.hash)==="/slp.html#settings"&&await visible(pg,"#page-settings"),await pg.evaluate(()=>location.href));
    const said=await pg.locator("#planReturn").innerText();
    ok("…and one line above the page says the trial has started only because the server says Sona Pro is on",await visible(pg,"#planReturn")&&/^Your free trial of Sona Pro has started\. Your dashboard is open/.test(said)&&!await visible(pg,"#planCheck")&&
      /^Sona Pro · free trial until Nov 26/.test(await pg.locator("#setPlanLine").textContent()),said);
    ok("…by reading, not writing",writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(writes));
    await pg.locator('[data-page="today"]').click();await pg.waitForTimeout(150);
    ok("…and the line goes once the clinician moves on",!await visible(pg,"#planReturn")&&await visible(pg,"#page-today"));
    ok("no runtime errors",errors.length===0,errors.join("; "));
    await ctx.close();
    PLAN=plan("none");planReads.length=0;
    const again=await open("#premium",1440,false,false,"/slp.html?plan_session=cs_test_unconfirmed0001");await again.pg.waitForTimeout(200);
    ok("an unconfirmed return says so, and offers to check again",/couldn't confirm that payment yet/.test(await again.pg.locator("#planReturn").innerText())&&await visible(again.pg,"#planCheck"));
    await again.pg.locator('[data-page="today"]').click();await again.pg.waitForTimeout(150);
    ok("…and, unconfirmed, it stays while they look around",await visible(again.pg,"#planReturn")&&await visible(again.pg,"#planCheck"));
    await again.ctx.close();
    // A 200 CAN SAY NO (24 Sep 2026). The route answers activated:false when
    // Stripe didn't answer or the payment hasn't settled; the page used to
    // drop the id on any 200, so Check again could only wait on Stripe's
    // search index while families joining meanwhile were told "not covered".
    // The id stays until the answer is yes, and Check again re-asks about it.
    // Here the dashboard is locked until then: the locked screen, with the
    // line above it.
    const SID="cs_test_retryR3try0000042";
    planReads.length=0;writes.length=0;
    planQueue.push({...plan("none"),dashboard:{open:false},activated:false,retry:true},{...plan("pro"),activated:true,activatedPlan:"pro"});PLAN=plan("pro");
    const retry=await open("#premium",1440,false,false,"/slp.html?plan_session="+SID);await retry.pg.waitForTimeout(250);
    ok("activated:false on a locked dashboard: the locked screen, and the line says it couldn't confirm yet",await visible(retry.pg,"#page-locked")&&/couldn't confirm that payment yet/.test(await retry.pg.locator("#planReturn").innerText())&&await visible(retry.pg,"#planCheck"));
    ok("…and keeps the session id, in the address bar too",planReads.filter(q=>q==="?session="+SID).length===1&&(await retry.pg.evaluate(()=>location.search))==="?plan_session="+SID,await retry.pg.evaluate(()=>location.href));
    await retry.pg.locator("#planCheck").click();await retry.pg.waitForTimeout(400);
    ok("Check again asks Stripe about that same session",planReads.filter(q=>q==="?session="+SID).length===2,JSON.stringify(planReads));
    ok("…and on activated:true says thank you, takes the id off the address bar, and opens the dashboard",/^Thank you\. Sona Pro is on/.test(await retry.pg.locator("#planReturn").innerText())&&!await visible(retry.pg,"#planCheck")&&
      (await retry.pg.evaluate(()=>location.search))===""&&!await visible(retry.pg,"#page-locked")&&await visible(retry.pg,"#page-play"),await retry.pg.evaluate(()=>location.href));
    ok("…all of it by reading, never writing",writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(writes));
    planQueue.length=0;await retry.ctx.close();
    // A YEARLY CHECKOUT OPENED BEFORE 12 NOV 2026, finished after: still
    // activated by the server, and thanked for in its own words.
    planReads.length=0;
    planQueue.push({...plan("paid"),activated:true,activatedPlan:"caseload"});PLAN=plan("paid");
    const old=await open("#premium",1440,false,false,"/slp.html?plan_session=cs_test_yearlyOldTab0001");await old.pg.waitForTimeout(200);
    ok("a yearly plan finished from an old tab is thanked for as itself, never \"couldn't confirm\"",/Thank you\. Premium is on for your caseload/.test(await old.pg.locator("#planReturn").innerText())&&!await visible(old.pg,"#planCheck"),await old.pg.locator("#planReturn").innerText());
    planQueue.length=0;await old.ctx.close();
    // A REFUSAL NEVER TURNS INTO A YES (24 Sep 2026): activated:false with no
    // retry flag means Stripe answered and the session is not this account's
    // caseload purchase. Keeping it would re-ask forever, so it leaves the
    // address bar; Check again then relies on the plan route's own recovery.
    const NO="cs_test_refused00000077";
    planReads.length=0;
    planQueue.push({...plan("none"),activated:false});PLAN=plan("none");
    const refused=await open("#premium",1440,false,false,"/slp.html?plan_session="+NO);await refused.pg.waitForTimeout(200);
    ok("a refused session leaves the address bar after one ask",planReads.filter(q=>q==="?session="+NO).length===1&&(await refused.pg.evaluate(()=>location.search))==="",await refused.pg.evaluate(()=>location.href));
    await refused.pg.locator("#planCheck").click();await refused.pg.waitForTimeout(250);
    ok("…and Check again no longer sends it",planReads.filter(q=>q==="?session="+NO).length===1,JSON.stringify(planReads));
    planQueue.length=0;await refused.ctx.close();
    // A plan read that fails during the return: the line says it couldn't
    // confirm, and Check again tries again.
    failPlan=true;planReads.length=0;
    const down=await open("#premium",1440,false,false,"/slp.html?plan_session=cs_test_storeDown00000001");await down.pg.waitForTimeout(200);
    ok("a plan read that fails on the way back says it couldn't confirm, with Check again",/couldn't confirm that payment yet/.test(await down.pg.locator("#planReturn").innerText())&&await visible(down.pg,"#planCheck"));
    failPlan=false;PLAN=plan("trial");
    await down.pg.locator("#planCheck").click();await down.pg.waitForTimeout(300);
    ok("…and once it answers, says the trial has started",/Your free trial of Sona Pro has started/.test(await down.pg.locator("#planReturn").innerText())&&planReads.filter(q=>q==="?session=cs_test_storeDown00000001").length>=2&&(await down.pg.evaluate(()=>location.search))==="",JSON.stringify(planReads));
    await down.ctx.close();
    // A brand-new account (no family code yet) back from its free trial: the
    // dashboard's one form, with the line above it.
    planReads.length=0;ACCT={...acct,code:"",familyKey:""};
    planQueue.push({...plan("trial"),activated:true,activatedPlan:"pro"});PLAN=plan("trial");
    const fresh=await open("#premium",1440,false,false,"/slp.html?plan_session=cs_test_freshTrial000001");await fresh.pg.waitForTimeout(250);
    ok("a new account back from its free trial: the trial has started, above the one form that sets up their family link",/Your free trial of Sona Pro has started/.test(await fresh.pg.locator("#planReturn").innerText())&&await visible(fresh.pg,"#page-onboarding"),await fresh.pg.locator("#planReturn").innerText());
    ACCT=acct;planQueue.length=0;await fresh.ctx.close();
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
    DATA=fixture();failRoster=false;PLAN=plan("none");TEAM=TEAM_OWNER;
    const {ctx,pg}=await open("#today",width);
    for(const hash of ["#play","#today","#caseload","#child/c1","#premium","#settings","#feedback","#team"]){
      await pg.evaluate(hash=>{location.hash=hash;},hash);await pg.waitForTimeout(80);
      const dims=await pg.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
      ok(hash+" has no document horizontal overflow at "+width,dims.scroll<=dims.viewport+1&&dims.body<=dims.viewport+1,JSON.stringify(dims));
    }
    await ctx.close();
  });
} finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
console.log(JSON.stringify({checks,failures:fails}));
process.exitCode=fails?1:0;
