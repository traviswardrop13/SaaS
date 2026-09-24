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
const plan = (state, self = SELF) => ({
  ok:true, price:"$79.99", perMonth:"under $7 a month", self,
  ...{ none:{ active:false, source:"none", periodEnd:null, cancelAtPeriodEnd:false },
       paid:{ active:true, source:"paid", periodEnd:PERIOD_END, cancelAtPeriodEnd:false },
       cancelling:{ active:true, source:"paid", periodEnd:PERIOD_END, cancelAtPeriodEnd:true },
       grandfathered:{ active:true, source:"grandfathered", periodEnd:null, cancelAtPeriodEnd:false } }[state],
});
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
  await run("Community and affiliate routes",async()=>{
    DATA=fixture();failRoster=false;writes.length=0;
    const {ctx,pg}=await open("#community");
    ok("community is available without preview injection", await visible(pg,"#page-community") && await visible(pg,'[data-page="community"]'));
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
    const preview=await open("#community",1440,false,true);
    for(const page of ["community","affiliate"]){
      await preview.pg.evaluate(page=>location.hash="#"+page,page);await preview.pg.waitForTimeout(80);
      ok(page+" remains available in injected local preview",await visible(preview.pg,"#page-"+page)&&await visible(preview.pg,'[data-page="'+page+'"]'));
    }
    await preview.ctx.close();
  });
  await run("Caseload Premium offer",async()=>{
    DATA=fixture();failRoster=false;PLAN=plan("none");CHARTER=CHARTER_OPEN;buyReply=null;ACCT=acct;writes.length=0;planReads.length=0;charterReads.length=0;
    const {ctx,pg,errors}=await open("#premium");
    await pg.waitForTimeout(150);
    ok("Caseload Premium is available without preview injection",await visible(pg,"#page-premium")&&await visible(pg,'[data-page="premium"]'));
    const nav=await pg.locator(".sidebar nav").evaluate(n=>[...n.children].map(c=>c.dataset.page||c.textContent.trim()));
    ok("…and sits in Workspace, right after Caseload",JSON.stringify(nav.slice(0,4))===JSON.stringify(["Workspace","today","caseload","premium"]),nav.join(","));
    ok("…with its own crumb",(await pg.locator("#pageCrumb").textContent())==="Caseload Premium");
    const page=await pg.locator("#page-premium").innerText();
    ok("the offer names the plan and prints the server's price and per-month reading",/Sona Premium for your whole caseload/.test(page)&&/\$79\.99 a year · under \$7 a month/.test(page),page);
    // The shared promise avoids counting games that are still Coming soon.
    ok("…says what families get, and that the free version stays free",/every game, every sound/i.test(page)&&/free version at home — daily practice and free games/.test(page)&&!/two games/.test(page),page);
    // With its conditions (24 Sep 2026): the bare "$59.99 a year" was true
    // only for the first fifty web buyers, and a clinician repeats it.
    ok("…prints the family price only as /api/charter answered it, with its conditions",/can buy Premium themselves — on the web, \$59\.99 a year for the first 50 families\./.test(page)&&charterReads.length>0,page);
    ok("…says the clinician never earns on their own caseload",/You never earn anything on your own caseload/.test(page));
    ok("…and how buying works: Stripe, no trial, cancel anytime, families keep it to the end of the paid year",/Secure checkout by Stripe/.test(page)&&/cancel anytime/.test(page)&&/keep Premium to the end of the year you paid for/.test(page)&&!/trial/i.test(page),page);
    ok("…never 'unlimited', never a spots-left number",!/unlimited|spots? left/i.test(page));
    ok("only the offer card shows",await visible(pg,"#premiumOffer")&&!await visible(pg,"#premiumPaid")&&!await visible(pg,"#premiumFree"));
    for(const p of ["today","caseload","premium","settings","premium"]){await pg.locator('[data-page="'+p+'"]').click();await pg.waitForTimeout(60);}
    ok("viewing it sends no write: GETs only, until a button is pressed",writes.filter(w=>w.method!=="GET"&&w.method!=="HEAD").length===0,JSON.stringify(writes.filter(w=>w.method!=="GET")));
    ok("…and the plan is asked without a session id",planReads.length>0&&planReads.every(q=>q===""),JSON.stringify(planReads));
    await pg.locator("#premiumBuy").click();
    await pg.waitForURL("**/stripe-checkout-fixture",{timeout:3000}).catch(()=>{});
    const buy=writes.filter(w=>w.path==="/api/slp/plan"&&w.method==="POST");
    ok("the buy button posts once and follows the checkout link the server returned",buy.length===1&&/\/stripe-checkout-fixture$/.test(pg.url()),pg.url()+" "+JSON.stringify(buy));
    ok("no runtime errors on the offer",errors.length===0,errors.join("; "));
    await ctx.close();
  });
  await run("Caseload Premium family price",async()=>{
    // Every figure and the cap are the route's: a cap of 40 prints 40, and a
    // charter answer with no usable cap prints no figure rather than the bare
    // launch price (24 Sep 2026).
    for(const [label,reply,want] of [
      ["unavailable",{ok:false},null],
      ["while families pay nothing",{ok:true,free:true,cap:50,taken:0,left:0,open:false,source:"free"},null],
      ["once the charter spots are gone",{...CHARTER_OPEN,open:false,left:0},/can buy Premium themselves — on the web, \$99\.99 a year\.$/],
      ["with the route's own cap",{...CHARTER_OPEN,cap:40},/can buy Premium themselves — on the web, \$59\.99 a year for the first 40 families\.$/],
      ["from a charter answer with no cap",{...CHARTER_OPEN,cap:undefined},null],
    ]){
      PLAN=plan("none");CHARTER=reply;
      const {ctx,pg}=await open("#premium");await pg.waitForTimeout(150);
      const line=await pg.locator("#premiumParentPrice").innerText();
      if(want)ok("family price "+label+": the route's figure, on the web, with its conditions",want.test(line),line);
      else ok("family price "+label+": the line stands with no figure",/can buy Premium themselves\.$/.test(line)&&!/\$/.test(line),line);
      await ctx.close();
    }
    CHARTER=CHARTER_OPEN;
  });
  await run("Caseload Premium states",async()=>{
    PLAN=plan("paid");writes.length=0;
    let {ctx,pg}=await open("#premium");await pg.waitForTimeout(150);
    let page=await pg.locator("#page-premium").innerText();
    ok("paid: Premium is on, and says when it renews",await visible(pg,"#premiumPaid")&&!await visible(pg,"#premiumOffer")&&/Premium is on for your caseload/.test(page)&&/Renews Sep 24, 2027/.test(page),page);
    await pg.locator("#premiumManage").click();
    await pg.waitForURL("**/stripe-portal-fixture",{timeout:3000}).catch(()=>{});
    ok("paid: Manage billing opens the billing portal the server returned",writes.some(w=>w.path==="/api/slp/plan/portal"&&w.method==="POST")&&/\/stripe-portal-fixture$/.test(pg.url()),pg.url());
    await ctx.close();
    PLAN=plan("cancelling");({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    page=await pg.locator("#premiumPaid").innerText();
    ok("cancelled: says when it ends and that families keep Premium until then",/Ends Sep 24, 2027/.test(page)&&/keep Premium until then, then move to the free version/.test(page),page);
    await ctx.close();
    PLAN=plan("grandfathered");writes.length=0;({ctx,pg}=await open("#premium"));await pg.waitForTimeout(150);
    page=await pg.locator("#page-premium").innerText();
    ok("grandfathered: the promise, in its own words",await visible(pg,"#premiumFree")&&/Your caseload has Premium, free/.test(page)&&/You joined when Sona promised free for every family on your caseload, and that promise stands\./.test(page),page);
    ok("grandfathered: nothing to buy and no billing to manage",!await visible(pg,"#premiumBuy")&&!await visible(pg,"#premiumManage")&&!/\$\d/.test(await pg.locator("#premiumFree").innerText()));
    ok("no state sends a write on view",writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(writes));
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
  await run("Premium before a code",async()=>{
    PLAN=plan("none");ACCT={...acct,code:"",familyKey:""};writes.length=0;
    const {ctx,pg}=await open("#premium");await pg.waitForTimeout(150);
    ok("the page opens before the clinician has picked a code",await visible(pg,"#page-premium")&&!await visible(pg,"#page-onboarding"));
    ok("…and the buy button says the family link comes first",await pg.locator("#premiumBuy").isDisabled()&&await visible(pg,"#premiumNeedLink")&&/Set up your family link first/.test(await pg.locator("#premiumNeedLink").innerText()));
    ok("…as does the own-phone link",await pg.locator("#selfSend").isDisabled()&&await visible(pg,"#selfNeedLink"));
    await pg.evaluate(()=>location.hash="#caseload");await pg.waitForTimeout(80);
    ok("…while every other workspace page still starts at the one form",await visible(pg,"#page-onboarding"));
    ok("…with nothing written",writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(writes));
    ACCT=acct;await ctx.close();
  });
  await run("Premium errors are visible and retryable",async()=>{
    PLAN=plan("none");failPlan=true;
    const {ctx,pg}=await open("#premium");await pg.waitForTimeout(150);
    ok("a failed plan read shows an error and a retry, and no offer it cannot vouch for",await visible(pg,"#premiumError")&&await visible(pg,"#premiumRetry")&&!await visible(pg,"#premiumOffer"));
    failPlan=false;await pg.locator("#premiumRetry").click();await pg.waitForTimeout(200);
    ok("…and a retry that works clears it",!await visible(pg,"#premiumError")&&await visible(pg,"#premiumOffer"));
    buyReply={status:502,body:{ok:false,error:"Stripe didn't answer. Try again."}};
    await pg.locator("#premiumBuy").click();await pg.waitForTimeout(200);
    ok("a failed checkout says why and can be pressed again",/Stripe didn't answer/.test(await pg.locator("#premiumBuyErr").innerText())&&!await pg.locator("#premiumBuy").isDisabled()&&/\/slp\.html/.test(pg.url()));
    buyReply=null;await ctx.close();
  });
  await run("Return from Stripe",async()=>{
    PLAN=plan("paid");planReads.length=0;writes.length=0;
    const {ctx,pg}=await open("#premium",1440,false,false,"/slp.html?plan_session=cs_test_a1B2c3D4e5F6g7");
    await pg.waitForTimeout(200);
    ok("the session id is sent to the server to check with Stripe, once",planReads.filter(q=>q==="?session=cs_test_a1B2c3D4e5F6g7").length===1,JSON.stringify(planReads));
    ok("…then taken off the address bar",await pg.evaluate(()=>location.pathname+location.search+location.hash)==="/slp.html#premium",await pg.evaluate(()=>location.href));
    ok("…and the page thanks them only because the server says Premium is on",/Premium is on for your caseload/.test(await pg.locator("#premiumReturn").innerText())&&await visible(pg,"#premiumPaid"));
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
    planQueue.push({...plan("none"),activated:false,retry:true},{...plan("paid"),activated:true});PLAN=plan("paid");
    const retry=await open("#premium",1440,false,false,"/slp.html?plan_session="+SID);await retry.pg.waitForTimeout(200);
    ok("activated:false: the page says it couldn't confirm yet",/couldn't confirm that payment yet/.test(await retry.pg.locator("#premiumReturn").innerText())&&await visible(retry.pg,"#premiumCheck"));
    ok("…and keeps the session id, in the address bar too",planReads.filter(q=>q==="?session="+SID).length===1&&(await retry.pg.evaluate(()=>location.search))==="?plan_session="+SID,await retry.pg.evaluate(()=>location.href));
    await retry.pg.locator("#premiumCheck").click();await retry.pg.waitForTimeout(250);
    ok("Check again asks Stripe about that same session",planReads.filter(q=>q==="?session="+SID).length===2,JSON.stringify(planReads));
    ok("…and on activated:true says thank you, then takes the id off the address bar",/Thank you\. Premium is on for your caseload/.test(await retry.pg.locator("#premiumReturn").innerText())&&!await visible(retry.pg,"#premiumCheck")&&(await retry.pg.evaluate(()=>location.pathname+location.search+location.hash))==="/slp.html#premium",await retry.pg.evaluate(()=>location.href));
    ok("…all of it by reading, never writing",writes.filter(w=>w.method!=="GET").length===0,JSON.stringify(writes));
    planQueue.length=0;await retry.ctx.close();
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
