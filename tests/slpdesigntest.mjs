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
    if(want&&!sessionStorage.getItem("__wantSet")){try{localStorage.setItem("sona.slp.wantplan",want);sessionStorage.setItem("__wantSet","1");}catch(e){}}
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
  // COMMUNITY WAS REMOVED (Travis, 17 Nov 2026): this was "Community and
  // affiliate routes". The affiliate teaser stays; an old #community link
  // opens Today, in a preview as well.
  await run("Affiliate route, and no community",async()=>{
    DATA=fixture();failRoster=false;writes.length=0;
    const {ctx,pg}=await open("#community");
    ok("an old #community link opens Today: no community page or menu item is left", await visible(pg,"#page-today") && !(await pg.locator("#page-community").count()) && !(await pg.locator('[data-page="community"]').count()) && await pg.evaluate(()=>location.hash)==="#community");
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
    ok("affiliate remains available in injected local preview",await visible(preview.pg,"#page-affiliate")&&await visible(preview.pg,'[data-page="affiliate"]'));
    await preview.pg.evaluate(()=>location.hash="#community");await preview.pg.waitForTimeout(80);
    ok("…and the community is not, there either",await visible(preview.pg,"#page-today")&&!(await preview.pg.locator('[data-page="community"]').count()));
    await preview.ctx.close();
  });
  await run("Sona Pro offer",async()=>{
    DATA=fixture();failRoster=false;PLAN=plan("none");CHARTER=CHARTER_OPEN;buyReply=null;ACCT=acct;writes.length=0;planReads.length=0;charterReads.length=0;
    const {ctx,pg,errors}=await open("#premium");
    await pg.waitForTimeout(150);
    ok("the plan page is available without preview injection",await visible(pg,"#page-premium")&&await visible(pg,'[data-page="premium"]'));
    const nav=await pg.locator(".sidebar nav").evaluate(n=>[...n.children].map(c=>c.dataset.page||c.textContent.trim()));
    // The AI homework draft joined Workspace between them (#289, 13 Nov 2026),
    // and Plan sessions before it (PLANDAY1, 14 Nov 2026).
    ok("…and sits in Workspace, after Caseload, Plan sessions and the homework draft",JSON.stringify(nav.slice(0,6))===JSON.stringify(["Workspace","today","caseload","plan-day","homework-draft","premium"]),nav.join(","));
    // Two plans since 17 Nov 2026, so the page is "Your plan", not one plan's name.
    ok("…with its own crumb: Your plan",(await pg.locator("#pageCrumb").textContent())==="Your plan"&&(await pg.locator('[data-page="premium"]').innerText()).trim()==="Your plan");
    ok("…and Your clinic stays out of the menu for anyone but a Sona Clinic owner",!await visible(pg,'[data-page="team"]'));
    const page=await pg.locator("#page-premium").innerText();
    ok("the offer names the plan and prints the server's price and free days",/Sona Pro/.test(page)&&/\$19\.99 a month · 14 days free/.test(page),page);
    // The shared promise avoids counting games that are still Coming soon.
    // The dashboard was free for every new account 13–17 Nov 2026 and left
    // off the list; it comes with the plan again (17 Nov 2026), so it is back.
    ok("…says what it includes: the dashboard, unlimited families with every game, their own phone",/Your dashboard, to plan sessions, draft homework and see who practiced at home/.test(page)&&/Unlimited families\. Every family who joins through your link gets every game, every sound/.test(page)&&/Every game on your own phone or tablet/.test(page),page);
    ok("…and that the free version stays free",/without Sona Pro, families who join through your link still get Sona's free version — daily practice and free games/.test(page)&&!/two games/.test(page),page);
    ok("…says the clinician never earns on their own caseload",/You never earn anything on your own caseload/.test(page));
    ok("…and how starting works: Stripe, no charge today, then the monthly price until cancelled, nothing if cancelled in the trial",
      /Secure checkout by Stripe\. No charge today: after your free trial, \$19\.99 a month until you cancel\. Cancel before the trial ends and you pay nothing\./.test(page),page);
    // The family price went with the caseload add-on (12 Nov 2026): with
    // Sona Pro every family on the link is covered, and the page asks
    // /api/charter for nothing.
    ok("…never a family price, a yearly figure or a spots-left number, and /api/charter is not asked",!/\$59\.99|\$99\.99|a year|spots? left/i.test(page)&&charterReads.length===0,page);
    // Sona Clinic sits beside it (17 Nov 2026); nothing is on, so nothing else shows.
    ok("only the two offer cards show, side by side",await visible(pg,"#proOffer")&&await visible(pg,"#clinicOffer")&&!await visible(pg,"#proOn")&&!await visible(pg,"#clinicOn")&&!await visible(pg,"#clinicMember")&&!await visible(pg,"#premiumPaid")&&!await visible(pg,"#premiumFree")&&!await visible(pg,"#proLocked")&&
      await pg.evaluate(()=>{const a=document.getElementById("proOffer").getBoundingClientRect(),b=document.getElementById("clinicOffer").getBoundingClientRect();return Math.abs(a.top-b.top)<2&&a.right<=b.left;}));
    ok("…with one free trial per clinician, for either plan",/One free trial per clinician, for either plan\./.test(page),page);
    for(const p of ["today","caseload","premium","settings","premium"]){await pg.locator('[data-page="'+p+'"]').click();await pg.waitForTimeout(60);}
    ok("viewing it sends no write: GETs only, until a button is pressed",writes.filter(w=>w.method!=="GET"&&w.method!=="HEAD").length===0,JSON.stringify(writes.filter(w=>w.method!=="GET")));
    ok("…and the plan is asked without a session id",planReads.length>0&&planReads.every(q=>q===""),JSON.stringify(planReads));
    ok("the button says the trial",(await pg.locator("#proBuy").innerText()).trim()==="Start my free trial");
    await pg.locator("#proBuy").click();
    await pg.waitForURL("**/stripe-checkout-fixture",{timeout:3000}).catch(()=>{});
    const buy=writes.filter(w=>w.path==="/api/slp/plan"&&w.method==="POST");
    ok("…posts once, for Sona Pro, and follows the checkout link the server returned",buy.length===1&&JSON.stringify(buy[0].body)===JSON.stringify({plan:"pro"})&&/\/stripe-checkout-fixture$/.test(pg.url()),pg.url()+" "+JSON.stringify(buy));
    ok("no runtime errors on the offer",errors.length===0,errors.join("; "));
    await ctx.close();
    // the trial already used: the same offer, charged from day one
    PLAN={...plan("none"),pro:{...PRO_OFF,trialAvailable:false}};
    const used=await open("#premium");await used.pg.waitForTimeout(150);
    const usedPage=await used.pg.locator("#proOffer").innerText();
    ok("trial already used: Get Sona Pro, charged today, no free days",(await used.pg.locator("#proBuy").innerText()).trim()==="Get Sona Pro"&&!/days free|No charge today/.test(usedPage)&&
      /Charged today, then every month until you cancel — cancel anytime\. If you cancel, your dashboard and your families keep every game to the end of the month you paid for\./.test(usedPage),usedPage);
    await used.ctx.close();
    // a yearly plan still renewing: Pro includes it, and the page says so
    PLAN=plan("none",SELF_PAID);
    const yr=await open("#premium");await yr.pg.waitForTimeout(150);
    ok("paying for a yearly plan still renewing: the offer says Sona Pro includes it, so they can cancel the yearly one",await visible(yr.pg,"#proHasYearly")&&/cancel the yearly plan in Manage billing/.test(await yr.pg.locator("#proHasYearly").innerText()));
    await yr.ctx.close();
  });
  await run("Sona Pro states",async()=>{
    PLAN=plan("trial");writes.length=0;
    let {ctx,pg}=await open("#premium");await pg.waitForTimeout(150);
    let page=await pg.locator("#page-premium").innerText();
    ok("trial: Sona Pro is on, until when, what follows, and that cancelling costs nothing",await visible(pg,"#proOn")&&!await visible(pg,"#proOffer")&&/Sona Pro is on/.test(page)&&
      /Free trial until Nov 26, 2026\. Then \$19\.99 a month until you cancel\. Cancel before then and you pay nothing\./.test(page),page);
    await pg.locator("#proManage").click();
    await pg.waitForURL("**/stripe-portal-fixture",{timeout:3000}).catch(()=>{});
    ok("…and Manage billing opens the billing portal the server returned",writes.some(w=>w.path==="/api/slp/plan/portal"&&w.method==="POST")&&/\/stripe-portal-fixture$/.test(pg.url()),pg.url());
    await ctx.close();
    for(const [state,want] of [["pro",/Renews Sep 24, 2027\./],["procancelling",/Ends Sep 24, 2027\. You and your families keep every game until then, then move to the free version\./],["pastdue",/Your last payment didn't go through\. Update your card in Manage billing to keep Sona Pro on\./]]){
      PLAN=plan(state);({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
      const when=await pg.locator("#proWhen").innerText();
      ok(state+": the card says "+want,want.test(when)&&await visible(pg,"#proManage"),when);
      await ctx.close();
    }
    PLAN=plan("paid");writes.length=0;({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    page=await pg.locator("#page-premium").innerText();
    ok("a yearly caseload plan still renewing: on, says when it renews, and nothing more to sell",await visible(pg,"#premiumPaid")&&!await visible(pg,"#proOffer")&&/Premium is on for your caseload/.test(page)&&/Renews Sep 24, 2027/.test(page),page);
    await pg.locator("#premiumManage").click();
    await pg.waitForURL("**/stripe-portal-fixture",{timeout:3000}).catch(()=>{});
    ok("…and Manage billing opens the billing portal",writes.some(w=>w.path==="/api/slp/plan/portal"&&w.method==="POST")&&/\/stripe-portal-fixture$/.test(pg.url()),pg.url());
    await ctx.close();
    PLAN=plan("cancelling");({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    page=await pg.locator("#premiumPaid").innerText();
    ok("…cancelled: says when it ends and that families keep every game until then",/Ends Sep 24, 2027/.test(page)&&/keep every game until then, then move to the free version/.test(page),page);
    await ctx.close();
    PLAN=plan("grandfathered");writes.length=0;({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    page=await pg.locator("#page-premium").innerText();
    ok("grandfathered: the promise, in its own words",await visible(pg,"#premiumFree")&&/Your caseload has Premium, free/.test(page)&&/You joined when Sona promised free for every family on your caseload, and that promise stands\./.test(page),page);
    ok("grandfathered: nothing to buy and no billing to manage",!await visible(pg,"#proBuy")&&!await visible(pg,"#proOffer")&&!await visible(pg,"#premiumManage")&&!/\$\d/.test(await pg.locator("#premiumFree").innerText()));
    await ctx.close();
  });
  await run("Sona Clinic offer",async()=>{
    DATA=fixture();failRoster=false;PLAN=plan("none");buyReply=null;ACCT=acct;writes.length=0;charterReads.length=0;
    let {ctx,pg,errors}=await open("#premium");await pg.waitForTimeout(150);
    let card=await pg.locator("#clinicOffer").innerText();
    ok("Sona Clinic prints the server's price, free days and seats",/Sona Clinic/i.test(card)&&/\$99 a month · 14 days free/.test(card)&&/up to 25, you included/.test(card),card);
    ok("…says what it is: Sona Pro for every clinician, their own dashboards and the app, and the owner's view — never a child",
      /Everything in Sona Pro, for every clinician at your practice/.test(card)&&/Each clinician gets their own dashboard and the Sona for SLPs app/.test(card)&&
      /Your clinic view: how many children each clinician has on Sona, and how many practiced in the last 7 days\. Never a child's name, initials, sounds or pass rate\./.test(card),card);
    ok("…and how starting works, as for Sona Pro: Stripe, no charge today, then $99 a month",/Secure checkout by Stripe\. No charge today: after your free trial, \$99 a month until you cancel\. Cancel before the trial ends and you pay nothing\./.test(card),card);
    ok("…never a rounded or per-clinician price, never 'unlimited'",!/\$100|\$99\.00|per clinician|unlimited/i.test(card),card);
    ok("…and its button says the trial",(await pg.locator("#clinicBuy").innerText()).trim()==="Start my free trial"&&!await visible(pg,"#clinicHasPro")&&!await visible(pg,"#clinicEnded"));
    await pg.locator("#clinicBuy").click();
    await pg.waitForURL("**/stripe-checkout-fixture",{timeout:3000}).catch(()=>{});
    const buy=writes.filter(w=>w.path==="/api/slp/plan"&&w.method==="POST");
    ok("…posts once, for Sona Clinic, and follows the checkout link",buy.length===1&&JSON.stringify(buy[0].body)===JSON.stringify({plan:"clinic"})&&/\/stripe-checkout-fixture$/.test(pg.url()),pg.url()+" "+JSON.stringify(buy));
    ok("no runtime errors on the two offers",errors.length===0,errors.join("; "));
    await ctx.close();
    // a Sona Pro holder: what they have first, then Sona Clinic as an upgrade,
    // charged from day one (one trial per clinician), with the cancel note
    PLAN=plan("pro");({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    card=await pg.locator("#clinicOffer").innerText();
    ok("Sona Pro on: Sona Clinic offered as an upgrade, with no free days, below the Sona Pro card",await visible(pg,"#proOn")&&await visible(pg,"#clinicOffer")&&!await visible(pg,"#proOffer")&&
      (await pg.locator("#clinicBuy").innerText()).trim()==="Get Sona Clinic"&&/Charged today, then every month until you cancel/.test(card)&&!/days free/.test(card)&&
      await pg.evaluate(()=>document.getElementById("proOn").getBoundingClientRect().top<document.getElementById("clinicOffer").getBoundingClientRect().top),card);
    ok("…and says to cancel Sona Pro once Sona Clinic is on, so nobody pays twice unawares",await visible(pg,"#clinicHasPro")&&/once Sona Clinic is on, cancel Sona Pro in Manage billing/.test(await pg.locator("#clinicHasPro").innerText()));
    await ctx.close();
    // a refusal is the server's own words
    PLAN=plan("none");buyReply={status:409,body:{ok:false,already:true,error:"You're on Dana Lee's Sona Clinic plan."}};
    ({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    await pg.locator("#clinicBuy").click();await pg.waitForTimeout(250);
    ok("a refused Clinic checkout shows the server's words beside its own button",/Dana Lee's Sona Clinic plan/.test(await pg.locator("#clinicBuyErr").innerText())&&!(await pg.locator("#proBuyErr").innerText()).trim()&&!await pg.locator("#clinicBuy").isDisabled());
    buyReply=null;await ctx.close();
    // the plans page's hint: the card they came for is outlined, once
    PLAN=plan("none");
    ({ctx,pg}=await open("#premium",390,false,false,"/slp.html","clinic"));await pg.waitForTimeout(250);
    const hint=await pg.evaluate(()=>({clinic:document.getElementById("clinicOffer").classList.contains("premium-wanted"),pro:document.getElementById("proOffer").classList.contains("premium-wanted"),left:localStorage.getItem("sona.slp.wantplan")}));
    ok("the plans page's pick (sona.slp.wantplan) outlines that card and is then forgotten",hint.clinic&&!hint.pro&&hint.left===null,JSON.stringify(hint));
    ok("…stacked on a phone, with nothing off the screen",await pg.evaluate(()=>{const a=document.getElementById("proOffer").getBoundingClientRect(),b=document.getElementById("clinicOffer").getBoundingClientRect();return b.top>=a.bottom&&document.documentElement.scrollWidth<=innerWidth+1;}));
    await ctx.close();
  });
  await run("Sona Clinic states",async()=>{
    PLAN=plan("clinic");writes.length=0;
    let {ctx,pg,errors}=await open("#premium");await pg.waitForTimeout(150);
    let page=await pg.locator("#page-premium").innerText();
    ok("owner: You're on Sona Clinic, when it renews, nothing more to sell",await visible(pg,"#clinicOn")&&/You're on Sona Clinic/.test(page)&&/Renews Sep 24, 2027\./.test(await pg.locator("#clinicWhen").innerText())&&
      !await visible(pg,"#proOffer")&&!await visible(pg,"#clinicOffer")&&!await visible(pg,"#premiumTop"),page);
    ok("…says, beside billing, that ending it ends it for the clinicians added",/If Sona Clinic ends, it ends for the clinicians you added too/.test(await pg.locator("#clinicOn").innerText()));
    ok("…with Your clinic in the menu, and a link to it",await visible(pg,'[data-page="team"]')&&(await pg.locator('[data-page="team"]').innerText()).trim()==="Your clinic"&&(await pg.locator("#clinicOpen").getAttribute("href"))==="#team"&&/Open your clinic/.test(await pg.locator("#clinicOpen").innerText()));
    await pg.locator("#clinicManage").click();
    await pg.waitForURL("**/stripe-portal-fixture",{timeout:3000}).catch(()=>{});
    ok("…and Manage billing opens the billing portal",writes.some(w=>w.path==="/api/slp/plan/portal"&&w.method==="POST")&&/\/stripe-portal-fixture$/.test(pg.url()),pg.url());
    ok("no runtime errors",errors.length===0,errors.join("; "));
    await ctx.close();
    for(const [state,want] of [["clinictrial",/Free trial until Nov 26, 2026\. Then \$99 a month until you cancel\. Cancel before then and you pay nothing\./],["cliniccancelling",/Ends Sep 24, 2027\. You, your clinicians and their families keep every game until then, then move to the free version\./]]){
      PLAN=plan(state);({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
      const when=await pg.locator("#clinicWhen").innerText();
      ok(state+": the card says "+want,want.test(when),when);
      await ctx.close();
    }
    // Pro and Clinic both on (an upgrade, before Pro is cancelled)
    PLAN={...plan("clinic"),pro:proOn({})};({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    ok("both on: the Clinic card says Sona Pro is still on, to cancel it",await visible(pg,"#clinicAlsoPro")&&await visible(pg,"#proOn"));
    await ctx.close();
    // a clinician on someone else's plan
    PLAN=plan("member");writes.length=0;({ctx,pg,errors}=await open("#premium"));await pg.waitForTimeout(150);
    const mem=await pg.locator("#clinicMember").innerText();
    ok("member: who added them, what the clinic covers, and what the owner sees — no price, no billing",await visible(pg,"#clinicMember")&&
      /Your clinic's plan covers you/.test(mem)&&/Dana Lee at Bright Steps added you to their Sona Clinic plan\./.test(mem)&&
      /What they see: how many children you have on Sona, and how many practiced in the last 7 days\. Never a child's name, initials, sounds or pass rate\./.test(mem)&&
      !/\$\d|Manage billing/.test(mem)&&!await visible(pg,"#proOffer")&&!await visible(pg,"#clinicOffer")&&!await visible(pg,'[data-page="team"]'),mem);
    ok("…and their own phone says it comes with Sona Clinic",/It comes with Sona Clinic\./.test(await pg.locator("#premiumSelf").innerText()));
    await pg.locator("#clinicLeave").click();await pg.waitForTimeout(250);
    const leave=writes.filter(w=>w.path==="/api/slp/team");
    const asked=await pg.evaluate(()=>window.__confirms.slice(-1)[0]||"");
    ok("…Leave this clinic asks first, then posts leave once",leave.length===1&&JSON.stringify(leave[0].body)===JSON.stringify({action:"leave"})&&/Leave your clinic\?/.test(asked),JSON.stringify(leave)+" "+asked);
    ok("no runtime errors",errors.length===0,errors.join("; "));
    await ctx.close();
    // the same member, in Settings: the card the clinicians' app can show
    PLAN=plan("member");writes.length=0;({ctx,pg}=await open("#settings"));await pg.waitForTimeout(200);
    const st=await pg.locator("#setTeam").innerText();
    ok("Settings, member: Your clinic, who added them, what they see, and Leave",await visible(pg,"#setTeam")&&/Dana Lee at Bright Steps added you to your clinic's Sona plan/.test(st)&&/Never a child's name/.test(st)&&await visible(pg,"#setTeamLeave")&&!/\$\d/.test(st),st);
    ok("…and the plan line says the clinic covers them, with nothing to buy",/Your clinic's Sona Clinic plan covers you/.test(await pg.locator("#setPremium").innerText())&&!await visible(pg,"#setProBuy")&&!await visible(pg,"#setManage"));
    await ctx.close();
    PLAN=plan("clinic");({ctx,pg}=await open("#settings"));await pg.waitForTimeout(200);
    ok("Settings, owner: Sona Clinic is on, with billing",/Sona Clinic is on\. Renews Sep 24, 2027\./.test(await pg.locator("#setPremium").innerText())&&await visible(pg,"#setManage")&&!await visible(pg,"#setTeam"));
    await ctx.close();
    PLAN=plan("none",SELF_OFF);({ctx,pg}=await open("#settings"));await pg.waitForTimeout(200);
    ok("Settings, nothing on: a pointer to Sona Clinic beside the Sona Pro offer",await visible(pg,"#setClinicLink")&&(await pg.locator("#setClinicLink a").getAttribute("href"))==="#premium");
    await ctx.close();
    // an owner whose plan has ended: offered again, and still the owner
    PLAN=plan("lapsed");({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    ok("lapsed owner: Sona Clinic offered again, saying it no longer covers their clinicians; Your clinic stays",await visible(pg,"#clinicOffer")&&await visible(pg,"#clinicEnded")&&!await visible(pg,"#clinicOn")&&await visible(pg,'[data-page="team"]')&&(await pg.locator("#clinicBuy").innerText()).trim()==="Get Sona Clinic");
    await ctx.close();
  });
  await run("Your clinic (the owner's view)",async()=>{
    PLAN=plan("clinic");TEAM=TEAM_OWNER;teamReply=null;writes.length=0;teamReads.length=0;
    let {ctx,pg,errors}=await open("#team");await pg.waitForTimeout(250);
    const today=await pg.evaluate(()=>isoToday());
    ok("the page asks for the team with this browser's own date, by GET only",teamReads.length>=1&&teamReads.every(q=>q==="?today="+today)&&writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(teamReads));
    const rows=await pg.evaluate(()=>[...document.querySelectorAll("#teamTable tbody tr")].map(r=>[...r.children].map(c=>c.innerText.replace(/\s+/g," ").trim())));
    ok("one row per seat, in the server's order — owner first, then by name, never by a number",rows.length===4&&/^Rachel K You/.test(rows[0][0])&&/^Ann Baker/.test(rows[1][0])&&/^Zed Young/.test(rows[2][0])&&/new@brightsteps\.example/.test(rows[3][0]),JSON.stringify(rows));
    ok("…two numbers each: children on Sona, and how many practiced in the last 7 days",rows[1][1]==="2"&&rows[1][2]==="2"&&rows[2][1]==="9"&&rows[2][2]==="0"&&rows[0][1]==="6"&&rows[0][2]==="3",JSON.stringify(rows));
    ok("…an invited seat says Not joined yet, and a clinician with no family link says so",rows[3][1]==="Not joined yet"&&/No family link yet/.test(rows[2][0]),JSON.stringify(rows));
    const page=await pg.locator("#page-team").innerText();
    ok("…the seats used, from the server",/4 of 25 seats used\./.test(page),page);
    ok("…and nothing about a child: no name, no sound, no pass rate, no percentage, no average or rank",!/Mia|Leo|Ava|%|average|rank|top|pass rate [0-9]/i.test(page.replace(/Never a child's name/g,"")),page);
    ok("…with Remove on every other seat, Resend on the invited one, and nothing on the owner's own",await pg.locator("#teamTable tbody tr").nth(0).locator("button").count()===0&&
      await pg.locator("[data-team-remove]").count()===3&&await pg.locator("[data-team-resend]").count()===1);
    // add
    await pg.locator("#teamEmail").fill("not-an-email");await pg.locator("#teamAdd").click();await pg.waitForTimeout(100);
    ok("a malformed address is caught on the page, before anything is sent",writes.filter(w=>w.path==="/api/slp/team").length===0&&/Enter their email/.test(await pg.locator("#teamErr").innerText()));
    await pg.locator("#teamEmail").fill("  Bo@BrightSteps.example ");await pg.locator("#teamAdd").click();await pg.waitForTimeout(250);
    let posts=writes.filter(w=>w.path==="/api/slp/team");
    ok("Send invite posts add once, with the address trimmed, and says it went",posts.length===1&&JSON.stringify(posts[0].body)===JSON.stringify({action:"add",email:"bo@brightsteps.example"})&&/Invite sent to bo@brightsteps\.example\./.test(await pg.locator("#teamDone").innerText())&&(await pg.locator("#teamEmail").inputValue())==="",JSON.stringify(posts));
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
      const fit=await pg.evaluate(()=>({over:document.documentElement.scrollWidth-innerWidth,head:getComputedStyle(document.querySelector("#teamTable thead")).display,label:getComputedStyle(document.querySelector("#teamTable td.num"),":before").content}));
      ok(width+"px: Your clinic stacks one block per clinician, labelled, with nothing off the screen",fit.over<=1&&fit.head==="none"&&/Children on Sona/.test(fit.label),JSON.stringify(fit));
      await ctx.close();
    }
    // the plan has ended: nothing to add, the numbers go, removing still works
    TEAM={...TEAM_OWNER,active:false,rows:TEAM_OWNER.rows.map(r=>r.you||r.state==="invited"?r:{...r,children:null,practicedWeek:null})};PLAN=plan("lapsed");writes.length=0;
    ({ctx,pg}=await open("#team"));await pg.waitForTimeout(250);
    ok("lapsed: says the plan isn't on, offers no invite, shows no numbers for others, and Remove still works",await visible(pg,"#teamLapsed")&&!await visible(pg,"#teamAddCard")&&
      await pg.locator("[data-team-remove]").count()===3&&await pg.locator("[data-team-resend]").count()===0&&/—/.test(await pg.locator("#teamTable tbody tr").nth(1).innerText()));
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
    ok("?joined=team says so once, in a toast, and leaves the address bar",/You've joined your clinic's Sona plan\./.test(await pg.locator("#toast").innerText())&&(await pg.evaluate(()=>location.pathname+location.search+location.hash))==="/slp.html#premium",await pg.evaluate(()=>location.href));
    ok("…on the plan page, which says the clinic covers them",await visible(pg,"#clinicMember"));
    ok("…by reading, never writing",writes.filter(w=>w.method!=="GET").length===0&&errors.length===0,JSON.stringify(writes)+errors.join(";"));
    await ctx.close();
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
    PLAN=plan("paid",SELF_ASK);writes.length=0;({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    const self=await pg.locator("#premiumSelf").innerText();
    ok("24–29 Sep free-mail address: says a work email is needed, and offers a request — no price",!await visible(pg,"#selfBuy")&&!/\$\d/.test(self)&&/Premium on your own phone or tablet needs a work email — your school or clinic address\./.test(self)&&await visible(pg,"#selfRequest")&&!await visible(pg,"#selfSend")&&!await visible(pg,"#selfPending"),self);
    await pg.locator("#selfRequest").click();await pg.waitForTimeout(150);
    // Was "Requested — we'll email you." until 24 Sep 2026, and nothing sends
    // that email: approval only flips a flag. So the card promises what the
    // approval changes, and shows the greyed-out button it turns on.
    const REQUESTED=/Requested — once we approve it, this button will work\./;
    const asked=await pg.locator("#premiumSelf").innerText();
    ok("…the request is one POST, then says what approval changes — and promises no email",writes.some(w=>w.path==="/api/slp/self"&&w.body.action==="request")&&REQUESTED.test(asked)&&!/we'll email you/i.test(asked)&&!await visible(pg,"#selfRequest"),asked);
    ok("…beside the button it will turn on, shown and greyed out",await visible(pg,"#selfPending")&&await pg.locator("#selfPending").isDisabled()&&(await pg.locator("#selfPending").innerText()).trim()==="Email me my Premium link");
    await ctx.close();
    PLAN=plan("none",{...SELF_ASK,requested:true});({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    ok("already requested: says so, with nothing to press",REQUESTED.test(await pg.locator("#premiumSelf").innerText())&&!await visible(pg,"#selfRequest")&&await pg.locator("#selfPending").isDisabled());
    await ctx.close();
  });
  await run("Your own phone, and Sona Pro from Settings",async()=>{
    // Nothing on (a 29 Sep – 12 Nov account): their own phone is part of
    // Sona Pro, so no separate card sells it.
    PLAN=plan("none",SELF_OFF);writes.length=0;buyReply=null;
    let {ctx,pg,errors}=await open("#premium");await pg.waitForTimeout(150);
    ok("own phone off: no separate card for it — the Sona Pro offer names it",!await visible(pg,"#premiumSelf")&&/Every game on your own phone or tablet/.test(await pg.locator("#proOffer").innerText()));
    await ctx.close();
    PLAN=plan("pro");writes.length=0;({ctx,pg,errors}=await open("#premium"));await pg.waitForTimeout(150);
    let self=await pg.locator("#premiumSelf").innerText();
    ok("with Sona Pro: their own phone is on, says it comes with Sona Pro, and offers the link — no second billing button",/Premium is on for you/.test(self)&&/It comes with Sona Pro\./.test(self)&&await visible(pg,"#selfSend")&&!await visible(pg,"#selfManage"),self);
    ok("no runtime errors",errors.length===0,errors.join("; "));
    await ctx.close();

    // SETTINGS carries the same plan (Travis, 29 Sep 2026: "an upsell
    // within the app, in like the SLP settings").
    PLAN=plan("none",SELF_OFF);writes.length=0;({ctx,pg,errors}=await open("#settings"));await pg.waitForTimeout(200);
    let card=await pg.locator("#setPremium").innerText();
    ok("Settings: a Sona Pro card — the server's price, the free days, what it does, and the trial button",
      /\$19\.99 a month, free for the first 14 days\. Every game for you and every family who joins through your link\./.test(card)&&await visible(pg,"#setProBuy")&&(await pg.locator("#setProBuy").innerText()).trim()==="Start my free trial"&&!await visible(pg,"#setManage"),card);
    ok("…showing it is a read, never a write",writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(writes));
    await pg.locator("#setProBuy").click();
    await pg.waitForURL("**/stripe-checkout-fixture",{timeout:3000}).catch(()=>{});
    const add=writes.filter(w=>w.path==="/api/slp/plan"&&w.method==="POST");
    ok("…and its button opens the same checkout: { plan: \"pro\" }, once",add.length===1&&JSON.stringify(add[0].body)===JSON.stringify({plan:"pro"})&&/\/stripe-checkout-fixture$/.test(pg.url()),JSON.stringify(add));
    await ctx.close();

    PLAN=plan("trial");({ctx,pg}=await open("#settings"));await pg.waitForTimeout(200);
    card=await pg.locator("#setPremium").innerText();
    ok("Settings, in the trial: on, until when, and billing — nothing to buy",/On\. Free trial until Nov 26, 2026\./.test(card)&&!await visible(pg,"#setProBuy")&&await visible(pg,"#setManage"),card);
    await ctx.close();

    PLAN=plan("grandfathered",{...SELF,source:"grandfathered"});({ctx,pg}=await open("#settings"));await pg.waitForTimeout(200);
    card=await pg.locator("#setPremium").innerText();
    ok("Settings, grandfathered: free, as promised — nothing to buy, no billing",
      /Your dashboard, your own phone and your caseload are free, as promised when you signed up\./.test(card)&&!await visible(pg,"#setProBuy")&&!await visible(pg,"#setManage")&&!/\$\d/.test(card),card);
    await ctx.close();

    PLAN=plan("none",SELF_PAID);({ctx,pg}=await open("#settings"));await pg.waitForTimeout(200);
    card=await pg.locator("#setPremium").innerText();
    ok("Settings, a yearly own-phone plan still renewing: Sona Pro offered, and billing for what they pay",await visible(pg,"#setProBuy")&&await visible(pg,"#setManage"),card);
    await ctx.close();

    failPlan=true;({ctx,pg}=await open("#settings"));await pg.waitForTimeout(200);
    ok("Settings, the plan didn't answer: no figure and no button, only 'Checking'",/Checking your plan/.test(await pg.locator("#setPremium").innerText())&&!await visible(pg,"#setProBuy"));
    failPlan=false;await ctx.close();
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
  await run("Sona Pro before a code",async()=>{
    PLAN=plan("none");ACCT={...acct,code:"",familyKey:""};writes.length=0;
    const {ctx,pg}=await open("#premium");await pg.waitForTimeout(150);
    ok("the page opens before the clinician has picked a code",await visible(pg,"#page-premium")&&!await visible(pg,"#page-onboarding"));
    // The dashboard is part of the plan (12 Nov 2026), and the family link is
    // made after: the trial does not wait for a code.
    ok("…and the trial can start before the family link exists",!await pg.locator("#proBuy").isDisabled()&&await visible(pg,"#proBuy"));
    ok("…as does the own-phone link",await pg.locator("#selfSend").isDisabled()&&await visible(pg,"#selfNeedLink"));
    await pg.evaluate(()=>location.hash="#caseload");await pg.waitForTimeout(80);
    ok("…while every other workspace page still starts at the one form",await visible(pg,"#page-onboarding"));
    ok("…with nothing written",writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(writes));
    ACCT=acct;await ctx.close();
  });
  await run("Premium errors are visible and retryable",async()=>{
    PLAN=plan("none");failPlan=true;
    const {ctx,pg}=await open("#premium");await pg.waitForTimeout(150);
    ok("a failed plan read shows an error and a retry, and no offer it cannot vouch for",await visible(pg,"#premiumError")&&await visible(pg,"#premiumRetry")&&!await visible(pg,"#proOffer"));
    failPlan=false;await pg.locator("#premiumRetry").click();await pg.waitForTimeout(200);
    ok("…and a retry that works clears it",!await visible(pg,"#premiumError")&&await visible(pg,"#proOffer"));
    buyReply={status:502,body:{ok:false,error:"Stripe didn't answer. Try again."}};
    await pg.locator("#proBuy").click();await pg.waitForTimeout(200);
    ok("a failed checkout says why and can be pressed again",/Stripe didn't answer/.test(await pg.locator("#proBuyErr").innerText())&&!await pg.locator("#proBuy").isDisabled()&&/\/slp\.html/.test(pg.url()));
    // A tab opened before 12 Nov 2026 is refused by the server as retired;
    // the page shows the server's words, which say to reload.
    buyReply={status:409,body:{ok:false,retired:true,error:"Sona's plan for speech therapists has changed. Reload this page to see Sona Pro."}};
    await pg.locator("#proBuy").click();await pg.waitForTimeout(200);
    ok("a retired-plan refusal is shown in the server's own words",/Reload this page to see Sona Pro/.test(await pg.locator("#proBuyErr").innerText()));
    buyReply=null;await ctx.close();
  });
  await run("Return from Stripe",async()=>{
    PLAN=plan("trial");planReads.length=0;writes.length=0;
    const {ctx,pg}=await open("#premium",1440,false,false,"/slp.html?plan_session=cs_test_a1B2c3D4e5F6g7");
    await pg.waitForTimeout(200);
    ok("the session id is sent to the server to check with Stripe, once",planReads.filter(q=>q==="?session=cs_test_a1B2c3D4e5F6g7").length===1,JSON.stringify(planReads));
    ok("…then taken off the address bar",await pg.evaluate(()=>location.pathname+location.search+location.hash)==="/slp.html#premium",await pg.evaluate(()=>location.href));
    ok("…and the page says the trial has started only because the server says Sona Pro is on",/Your free trial of Sona Pro has started\. Your dashboard is open/.test(await pg.locator("#premiumReturn").innerText())&&await visible(pg,"#proOn"));
    ok("…with no set-up link: this clinician already has their family link",!await visible(pg,"#premiumReturnSetup"));
    ok("…by reading, not writing",writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(writes));
    await ctx.close();
    PLAN=plan("none");planReads.length=0;
    const again=await open("#premium",1440,false,false,"/slp.html?plan_session=cs_test_unconfirmed0001");await again.pg.waitForTimeout(200);
    ok("an unconfirmed return says so, and offers to check again",/couldn't confirm that payment yet/.test(await again.pg.locator("#premiumReturn").innerText())&&await visible(again.pg,"#premiumCheck"));
    await again.ctx.close();
    // A 200 CAN SAY NO (24 Sep 2026). The route answers activated:false when
    // Stripe didn't answer or the payment hasn't settled; the page used to
    // drop the id on any 200, so Check again could only wait on Stripe's
    // search index while families joining meanwhile were told "not covered".
    // The id stays until the answer is yes, and Check again re-asks about it.
    const SID="cs_test_retryR3try0000042";
    planReads.length=0;writes.length=0;
    planQueue.push({...plan("none"),activated:false,retry:true},{...plan("pro"),activated:true,activatedPlan:"pro"});PLAN=plan("pro");
    const retry=await open("#premium",1440,false,false,"/slp.html?plan_session="+SID);await retry.pg.waitForTimeout(200);
    ok("activated:false: the page says it couldn't confirm yet",/couldn't confirm that payment yet/.test(await retry.pg.locator("#premiumReturn").innerText())&&await visible(retry.pg,"#premiumCheck"));
    ok("…and keeps the session id, in the address bar too",planReads.filter(q=>q==="?session="+SID).length===1&&(await retry.pg.evaluate(()=>location.search))==="?plan_session="+SID,await retry.pg.evaluate(()=>location.href));
    await retry.pg.locator("#premiumCheck").click();await retry.pg.waitForTimeout(250);
    ok("Check again asks Stripe about that same session",planReads.filter(q=>q==="?session="+SID).length===2,JSON.stringify(planReads));
    ok("…and on activated:true says thank you, then takes the id off the address bar",/Thank you\. Sona Pro is on/.test(await retry.pg.locator("#premiumReturn").innerText())&&!await visible(retry.pg,"#premiumCheck")&&(await retry.pg.evaluate(()=>location.pathname+location.search+location.hash))==="/slp.html#premium",await retry.pg.evaluate(()=>location.href));
    ok("…all of it by reading, never writing",writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(writes));
    planQueue.length=0;await retry.ctx.close();
    // A YEARLY CHECKOUT OPENED BEFORE 12 NOV 2026, finished after: still
    // activated by the server, and thanked for in its own words.
    planReads.length=0;
    planQueue.push({...plan("paid"),activated:true,activatedPlan:"caseload"});PLAN=plan("paid");
    const old=await open("#premium",1440,false,false,"/slp.html?plan_session=cs_test_yearlyOldTab0001");await old.pg.waitForTimeout(200);
    ok("a yearly plan finished from an old tab is thanked for as itself, never \"couldn't confirm\"",/Thank you\. Premium is on for your caseload/.test(await old.pg.locator("#premiumReturn").innerText())&&!await visible(old.pg,"#premiumCheck")&&!await visible(old.pg,"#premiumReturnSetup"),await old.pg.locator("#premiumReturn").innerText());
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
    await refused.pg.locator("#premiumCheck").click();await refused.pg.waitForTimeout(250);
    ok("…and Check again no longer sends it",planReads.filter(q=>q==="?session="+NO).length===1,JSON.stringify(planReads));
    planQueue.length=0;await refused.ctx.close();
    // SONA CLINIC (17 Nov 2026): thanked for as itself, pointing at the
    // clinic page where the clinicians are added — and, with no family link
    // yet, at setting that up too.
    planReads.length=0;ACCT={...acct,code:"",familyKey:""};
    planQueue.push({...plan("clinictrial"),activated:true,activatedPlan:"clinic"});PLAN=plan("clinictrial");
    const cl=await open("#premium",1440,false,false,"/slp.html?plan_session=cs_test_clinicTrial00001");await cl.pg.waitForTimeout(200);
    ok("a Sona Clinic trial: thanked for as itself, with Add your clinicians and Set up your family link",/Your free trial of Sona Clinic has started\./.test(await cl.pg.locator("#premiumReturn").innerText())&&
      await visible(cl.pg,"#premiumReturnTeam")&&(await cl.pg.locator("#premiumReturnTeam").getAttribute("href"))==="#team"&&await visible(cl.pg,"#premiumReturnSetup")&&await visible(cl.pg,"#clinicOn"),await cl.pg.locator("#premiumReturn").innerText());
    ACCT=acct;planQueue.length=0;await cl.ctx.close();
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
    for(const hash of ["#today","#caseload","#child/c1","#premium","#settings","#team"]){
      await pg.evaluate(hash=>{location.hash=hash;},hash);await pg.waitForTimeout(80);
      const dims=await pg.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
      ok(hash+" has no document horizontal overflow at "+width,dims.scroll<=dims.viewport+1&&dims.body<=dims.viewport+1,JSON.stringify(dims));
    }
    await ctx.close();
  });
} finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
console.log(JSON.stringify({checks,failures:fails}));
process.exitCode=fails?1:0;
