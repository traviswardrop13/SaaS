// SLP1: the clinician's dashboard is built around ONE problem — carryover.
// A child goes home, practices, and the clinician can see that it happened
// and paste it into a note. What this suite defends, with a mock API and a
// real browser (the page is static ES5; nothing here needs KV):
//   - the first screen is live: who practiced this week, without a click
//   - the register: pass rate, practice, homework — never accuracy, score,
//     adherence, therapy, treatment, diagnosis, and no credential in an
//     example name
//   - one family door: every generated link is join.html?slp=&k= (+&inv=)
//   - the caseload sorts oldest-practiced first, and under SMALL_N attempts
//     a pass rate is "too few to read", never a percentage
//   - Copy note writes exactly the template a school SLP asked for
//   - remove really removes (the route is called, the row is gone) and the
//     dialog promises only what the routes deliver
//   - an invite carries initials, never a child's name, and its message
//     names nobody
//   - assign from the child page posts the assignment for that child
//   - (24 Sep 2026) what a family is promised follows the caseload's plan:
//     the free version always, Premium only while the caseload is covered,
//     and never "free forever" or "unlimited" again
//   - a parent's email typed into Add a child goes to the invite route once,
//     only when typed, and the page says whether the email really went
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp" };
const PORT = 8161;
const HTML = process.env.SLP_TEST_HTML || ROOT + "/slp.html";

// ── fixture: five children, one pending invite ──
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

// ── mock API: the shapes the routes answer with, and a log of every write ──
let DATA = fixture();
const log = [];
// GET /api/slp/plan, in the route's own shape (app/api/slp/plan). Not covered
// by default; section 9 flips it to see the family messages follow.
const PLAN_NONE = { ok: true, active: false, source: "none", periodEnd: null, cancelAtPeriodEnd: false, price: "$79.99", perMonth: "under $7 a month", self: { eligible: true, workEmail: true, approved: false, requested: false } };
let PLAN = PLAN_NONE;
const acct = { ok: true, email: "rachel@example.com", code: "rachel-k4", familyKey: "ABCD2345", name: "Rachel K", clinic: "Bright Steps", onboarded: true };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const json = (o, code = 200) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  let body = ""; req.on("data", (c) => (body += c));
  req.on("end", () => {
    let b = {}; try { b = body ? JSON.parse(body) : {}; } catch (e) {}
    if (u.pathname.startsWith("/api/")) log.push({ m: req.method, p: u.pathname + u.search, b });
    if (u.pathname === "/api/slp/auth/me") return json(acct);
    if (u.pathname === "/api/slp/account") return json(req.method === "POST" && b.rotateKey ? { ...acct, familyKey: "ROTATED99" } : acct);
    if (u.pathname === "/api/slp" && req.method === "GET") return json({ ok: true, configured: true, kids: DATA.kids, invites: DATA.invites });
    if (u.pathname === "/api/slp/homework") return json({ ok: true, hw: b.hw || null });
    if (u.pathname === "/api/slp/child" && req.method === "DELETE") { DATA.kids = DATA.kids.filter((k) => k.childId !== b.childId); return json({ ok: true, removed: b.childId }); }
    if (u.pathname === "/api/slp/plan" && req.method === "GET") return json(PLAN);
    if (u.pathname === "/api/slp/invite" && req.method === "POST") {
      const inv = { token: "NEWTOKEN1234", label: b.label, age: b.age, sounds: b.sounds, pos: b.pos, repsPerDay: b.repsPerDay, note: b.note, createdAt: new Date().toISOString(), expiresAt: day(-30) }; DATA.invites.push(inv);
      // the route's reply: emailed, plus its own reason when the send failed
      const mail = !b.parentEmail ? { emailed: false } : /bounce/.test(b.parentEmail) ? { emailed: false, emailError: "That's 30 emails today, the daily limit. Copy the link and send it yourself." } : { emailed: true };
      return json({ ok: true, invite: inv, link: "http://localhost:" + PORT + "/join.html?slp=RACHEL-K4&k=ABCD2345&inv=NEWTOKEN1234", ...mail });
    }
    if (u.pathname === "/api/slp/invite" && req.method === "DELETE") { DATA.invites = DATA.invites.filter((i) => i.token !== b.token); return json({ ok: true }); }
    if (u.pathname.startsWith("/api/")) return json({ ok: true });
    const p = u.pathname === "/slp.html" ? HTML : ROOT + u.pathname;
    if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
    res.end(readFileSync(p));
  });
});
await new Promise((r) => srv.listen(PORT, r));

const browser = await chromium.launch(launchOpts());
let fails = 0, checks = 0;
const ok = (n, p, extra) => { checks++; if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };
const U = (h) => "http://localhost:" + PORT + "/slp.html" + (h || "");
async function open(hash) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on("pageerror", (e) => errs.push(String(e)));
  // the clipboard and confirm() are captured, not exercised
  await pg.addInitScript(() => {
    window.__copied = []; window.__confirms = [];
    Object.defineProperty(navigator, "clipboard", { value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } });
    window.confirm = (m) => { window.__confirms.push(m); return true; };
  });
  await pg.goto(U(hash)); await pg.waitForTimeout(900);
  return { ctx, pg, errs };
}

// ── 1. the first screen is live, without a click ──
{
  const { ctx, pg, errs } = await open("#today");
  const txt = await pg.evaluate(() => document.getElementById("todayBody").textContent);
  ok("Today labels its rolling practice window as the last 7 days", /3 of 6 children practiced (?:in the )?last 7 days/i.test(txt), txt.slice(0, 240));
  const cards = pg.locator("#todayBody .card");
  const groups = await pg.locator("#todayBody .card h2").allTextContents();
  // The Premium offer has its own page (24 Sep 2026); Today answers who
  // practiced, and a price there would crowd out the one question it is for.
  ok("Today never sells: no price and no Premium card", !/\$\d|Premium/.test(txt), txt.slice(0, 240));
  ok("Today keeps three useful groups and pending invites", groups.length === 4 && /Gone quiet/.test(groups[0]) && /Homework ending .*or missed/.test(groups[1]) && /practiced.*last 7 days/i.test(groups[2]) && /Invited, not joined yet/.test(groups[3]), groups.join("|"));
  const quiet = cards.filter({has:pg.locator("h2",{hasText:"Gone quiet"})});
  const quietText = await quiet.textContent();
  ok("quiet rows show the practice fact without duplicating missed homework", /Ava/.test(quietText) && /no practice yet/.test(quietText) && !/Leo/.test(quietText), quietText);
  const hw = cards.filter({has:pg.locator("h2",{hasText:/Homework ending/})});
  const hwText = await hw.textContent();
  ok("missed homework keeps both facts on one actionable row", /Leo/.test(hwText) && /missed/i.test(hwText) && /no practice for 9 days/.test(hwText) && /Mia/.test(hwText) && /Re-assign/.test(hwText), hwText);
  const noteBtns = await pg.locator("#todayBody [data-note]").count();
  ok("practiced rows keep Copy note", noteBtns === 3, String(noteBtns));
  const checkin = quiet.getByRole("button",{name:"Copy check-in message",exact:true});
  ok("quiet children with a target offer a parent check-in", await checkin.count() === 1);
  if(await checkin.count()) {
    await checkin.click();
    const message = await pg.evaluate(() => window.__copied[0] || "");
    ok("check-in copies a parent message without practice statistics", /Sona/.test(message) && !/\d+ of \d+|%|streak/i.test(message), message);
  }
  const chooseSound = quiet.getByRole("button",{name:/Set their sound/});
  ok("unnamed family offers a sound selection", await chooseSound.count() === 1);
  if(await chooseSound.count()) {
    await chooseSound.click();await pg.waitForTimeout(100);
    ok("Set their sound opens this family's homework without assigning", await pg.locator("#quickHomework").isVisible() && await pg.evaluate(() => location.hash) === "#child/c6/homework" && !log.some(l=>l.m==="POST"&&l.p==="/api/slp/homework"));
  }
  ok("no pageerrors", errs.length === 0, errs.join(" | "));
  const badCalls = log.filter((l) => /\/api\/slp\?code=/.test(l.p));
  ok("the page never passes the clinic code in a query string", badCalls.length === 0, JSON.stringify(badCalls));
  await ctx.close();
}

// ── 2. the register, with comments stripped ──
{
  const src = readFileSync(HTML, "utf8")
    .replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const hits = src.match(/\b(accuracy|score|scores|adherence|therapy|treatment|diagnos\w*|CCC)\b/gi) || [];
  ok("never accuracy / score / adherence / therapy / treatment / diagnosis / CCC anywhere a clinician reads", hits.length === 0, hits.join(", "));
  ok("pass rate is defined on the page as what it is", /did that sound like this sound/.test(src));
  ok("the composer keeps the parent's-eye preview (hwtest pins it too)", /What the family sees/.test(src) && /pvTitle/.test(src));
  ok("the note-to-parent field says what must not go in it", /nothing you wouldn't write on a fridge note/.test(src));
  ok("the print view hides the norm warning and the missed badge", /@media print[\s\S]*?\.warn, \.pill\.missed/.test(src));
  ok("SMALL_N is one constant", /var SMALL_N=20;/.test(src));
}

// ── 3. one family door ──
{
  const { ctx, pg } = await open("#invite");
  if(await pg.locator("#generalInvite summary").count())await pg.locator("#generalInvite summary").click();
  ok("general family link and message share the invite panel", await pg.locator("#invComposer #famLink").isVisible() && await pg.locator("#invComposer #snip").isVisible());
  const link = await pg.evaluate(() => document.getElementById("famLink").value);
  ok("the caseload link is join.html?slp=CODE&k=KEY", /\/join\.html\?slp=RACHEL-K4&k=ABCD2345$/.test(link), link);
  const snip = await pg.evaluate(() => document.getElementById("snip").value);
  ok("the ready message says free, never pilot or trial", /free/i.test(snip) && !/pilot|trial/i.test(snip), snip);
  const inv = await pg.evaluate(() => inviteLink("TOK"));
  ok("a per-child link is the same door plus &inv=", /\/join\.html\?slp=RACHEL-K4&k=ABCD2345&inv=TOK$/.test(inv), inv);
  ok("no generated link points at pilot.html", !/pilot\.html/.test(link + inv + snip));
  await ctx.close();
}

// ── 4. the caseload: oldest-practiced first, and the small-n rule ──
{
  const { ctx, pg } = await open("#caseload");
  const rows = await pg.evaluate(() => [...document.querySelectorAll("#clTable tbody tr")].map((r) => ({ name: r.querySelector(".name").textContent, rate: r.children[5].textContent.trim() })));
  ok("rows sort by last practiced, the never-practiced children first", /^(Ava,New family|New family,Ava),Leo,Zoe,Sam,Mia$/.test(rows.map((r) => r.name).join(",")), rows.map((r) => r.name).join(","));
  // The invite carried initials; the claim threw them away; the name only
  // exists once the family types it. "Child" would read as a bug.
  ok("a family who tapped the link but has not practiced is named as that, not as a nameless Child",
    rows.some((r) => r.name === "New family") && !rows.some((r) => r.name === "Child"), rows.map((r) => r.name).join(","));
  const zoe = rows.find((r) => r.name === "Zoe"), sam = rows.find((r) => r.name === "Sam"), ava = rows.find((r) => r.name === "Ava");
  ok("19 attempts is too few to read — no percentage", /too few to read/.test(zoe.rate) && !/%/.test(zoe.rate), zoe.rate);
  ok("44 attempts shows the pass rate with its n", /84%/.test(sam.rate) && /n=44/.test(sam.rate), sam.rate);
  ok("no practice shows nothing, not 0%", ava.rate === "—", ava.rate);
  const btns = await pg.evaluate(() => document.querySelectorAll("#clTable [data-note]").length);
  ok("Copy note sits on every row", btns === 6, String(btns));
  // the note itself: the fixed template, from the current homework window
  await pg.evaluate(() => { [...document.querySelectorAll("#clTable tr")].find((r) => /Mia/.test(r.textContent)).querySelector("[data-note]").click(); });
  const note = await pg.evaluate(() => window.__copied[0] || "");
  ok("Copy note preserves the factual window, practice summary and qualification",
    /^Between \w+ \d+ and \w+ \d+, Mia practiced on 5 of 6 days \(15 tries a day\)\. R in the middle of words: 70% pass rate over 46 attempts\./.test(note) && /A practice snapshot from at-home listening on the family's device; not an evaluation\.$/.test(note), note);
  ok("progress note includes supported position rates with attempt counts", /(?:Beginning|beginning)[^%]*74% \(n=70\)/.test(note) && /[Mm]iddle[^%]*60% \(n=60\)/.test(note) && /[Ee]nd[^%]*53% \(n=30\)/.test(note), note);
  ok("…with no age and no score in it", !/age|score/i.test(note), note);
  await pg.evaluate(() => { [...document.querySelectorAll("#clTable tr")].find((r) => /Zoe/.test(r.textContent)).querySelector("[data-note]").click(); });
  const zn = await pg.evaluate(() => window.__copied[1] || "");
  ok("under SMALL_N the note says too few, never a percentage", /L: too few attempts to read yet \(19\)\./.test(zn) && !/%/.test(zn), zn);
  await ctx.close();
}

// ── 5. the child page: the note reads the homework window, and remove really removes ──
{
  DATA = fixture(); log.length = 0;
  const { ctx, pg } = await open("#child/c1");
  const head = await pg.evaluate(() => document.getElementById("chName").textContent + " · " + document.getElementById("chAvg").textContent);
  ok("the child page opens by deep link", /Mia, age 6/.test(head), head);
  ok("…and shows a weighted pass rate on the target for the last 14 days, with n", /68% \(n=94\)/.test(head), head);
  const sub = await pg.evaluate(() => document.getElementById("chNoteSub").textContent);
  ok("the note says which window it covers", /Covers the current homework window/.test(sub), sub);
  ok("remove is available on Overview", await pg.locator("#chRemove").isVisible());
  for(const view of ["homework","plan"]) {
    await pg.evaluate(view=>location.hash="#child/c1/"+view,view);await pg.waitForTimeout(80);
    ok("remove is hidden on "+view, !await pg.locator("#chRemove").isVisible());
  }
  await pg.evaluate(()=>location.hash="#child/c1");await pg.waitForTimeout(80);
  await pg.locator("#chRemove").click();
  await pg.waitForTimeout(700);
  const confirmMsg = await pg.evaluate(() => window.__confirms[0] || "");
  ok("the remove dialog promises only what the route delivers", /nothing on their device is deleted/.test(confirmMsg) && /stops sending you updates/.test(confirmMsg) && /Copy the progress note first/.test(confirmMsg), confirmMsg);
  const del = log.find((l) => l.m === "DELETE" && l.p === "/api/slp/child");
  ok("remove calls DELETE /api/slp/child with the child id", !!del && del.b.childId === "c1", JSON.stringify(del));
  const gone = await pg.evaluate(() => location.hash + " " + document.getElementById("clTable").textContent);
  ok("…and the caseload no longer lists them", /^#caseload/.test(gone) && !/Mia/.test(gone), gone.slice(0, 80));
  await ctx.close();
}

// ── 6. assign from the child page ──
{
  DATA = fixture(); log.length = 0;
  const { ctx, pg } = await open("#child/c3");
  await pg.evaluate(() => document.getElementById("chAssignBtn").click()); await pg.waitForTimeout(200);
  const shown = await pg.evaluate(() => document.getElementById("composer").style.display !== "none" && document.getElementById("hwHeading").textContent);
  ok("Assign opens the composer for this child", /New homework for Ava/.test(String(shown)), String(shown));
  await pg.evaluate(() => { document.getElementById("hwTitle").value = "TH at the start"; document.getElementById("hwSave").click(); });
  await pg.waitForTimeout(600);
  const post = log.find((l) => l.m === "POST" && l.p === "/api/slp/homework");
  ok("…and saving posts the assignment for that child, prefilled with their target", !!post && post.b.childId === "c3" && post.b.hw.sounds.join() === "TH" && post.b.hw.title === "TH at the start", JSON.stringify(post && post.b));
  await ctx.close();
}

// ── 7. an invite carries initials, never a name ──
{
  DATA = fixture(); log.length = 0;
  const { ctx, pg } = await open("#caseload");
  await pg.evaluate(() => document.getElementById("clAdd").click()); await pg.waitForTimeout(200);
  const label = await pg.evaluate(() => document.querySelector('label[for="invName"]').textContent);
  ok("the field asks for initials or a nickname, not a name", /Initials or a nickname/.test(label) && /not their name/.test(label), label);
  await pg.evaluate(() => { document.getElementById("invName").value = "M.K."; [...document.querySelectorAll("#invSounds button")].find((b) => b.textContent.trim().startsWith("S")).click(); document.getElementById("invCreate").click(); });
  await pg.waitForTimeout(600);
  const post = log.find((l) => l.m === "POST" && l.p === "/api/slp/invite");
  ok("the invite posts a label and never a child field", !!post && post.b.label === "M.K." && !("child" in post.b), JSON.stringify(post && post.b));
  ok("…and a blank parent's email sends no address at all", !!post && !("parentEmail" in post.b), JSON.stringify(post && post.b));
  ok("…nor claims an email went", await pg.evaluate(() => document.getElementById("invEmailed").hidden));
  const msg = await pg.evaluate(() => document.getElementById("invMsg").value);
  ok("the ready message names nobody and carries the per-child link", !/M\.K\./.test(msg) && /join\.html\?slp=RACHEL-K4&k=ABCD2345&inv=NEWTOKEN1234/.test(msg) && !/pilot|trial/i.test(msg), msg);
  const pend = await pg.evaluate(() => document.getElementById("invList").textContent);
  ok("pending invites say when they delete themselves", /deletes itself/.test(pend) && /M\.K\./.test(pend), pend.slice(0, 160));
  await ctx.close();
}

// ── 9. what a family is promised follows the plan (24 Sep 2026) ──
// Until this build every family message said "free forever". Every game is
// Premium now: the messages promise the free version, which stays free, and
// name Premium only while this caseload is covered (paid or grandfathered).
{
  const src = readFileSync(HTML, "utf8")
    .replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  ok("the dashboard no longer promises anything 'free forever'", !/free forever/i.test(src));
  ok("…and never says 'unlimited' — a covered caseload has a number, and the copy says every family", !/unlimited/i.test(src));
  // ONE PHRASE FOR THE FREE VERSION (24 Sep 2026): "daily practice and four
  // free games". It said "two games", but gameAccess() opens all four free
  // games to every child, and Home said four — a parent told "two" by her
  // clinician then read "four" in the app. Pinned wherever the dashboard says it.
  ok("…and names the free version one way: four free games, never 'two games'", !/two (free )?games/i.test(src) && (src.match(/daily practice and four free games/g) || []).length >= 3, (src.match(/[^.>"]*two (free )?games[^.<"]*/i) || [""])[0]);

  for (const [label, plan] of [["not covered", PLAN_NONE], ["paid", { ...PLAN_NONE, active: true, source: "paid", periodEnd: 1822000000 }], ["grandfathered", { ...PLAN_NONE, active: true, source: "grandfathered" }]]) {
    PLAN = plan; DATA = fixture(); log.length = 0;
    const { ctx, pg } = await open("#invite");
    await pg.waitForTimeout(200);
    const snip = await pg.evaluate(() => document.getElementById("snip").value);
    const settings = await pg.evaluate(() => { location.hash = "#settings"; return new Promise((r) => setTimeout(() => r(document.getElementById("page-settings").innerText), 150)); });
    if (plan.active) {
      ok(`${label}: the caseload message says Premium is included`, /free for your family/.test(snip) && /Premium is included/.test(snip) && /every game/.test(snip), snip);
      ok(`${label}: Settings says the families get every game`, /Your caseload has Premium, so they get every game too/.test(settings), settings);
    } else {
      ok(`${label}: the caseload message promises the free version and no Premium`, /free for your family: daily practice and four free games\./.test(snip) && !/Premium/.test(snip), snip);
      ok(`${label}: Settings says what the free version is and where Premium lives`, /daily practice and four free games/.test(settings) && /With Caseload Premium they get every game/.test(settings), settings);
    }
    ok(`${label}: never pilot, trial or forever`, !/pilot|trial|forever/i.test(snip + settings), snip);
    ok(`${label}: learning the plan is a read, never a write`, !log.some((l) => l.m !== "GET"), JSON.stringify(log.filter((l) => l.m !== "GET")));
    await ctx.close();
  }
  PLAN = PLAN_NONE;
}

// ── 10. a parent's email: typed only if the clinician wants, used once ──
{
  DATA = fixture(); log.length = 0;
  const { ctx, pg } = await open("#caseload");
  await pg.evaluate(() => document.getElementById("clAdd").click()); await pg.waitForTimeout(200);
  const help = await pg.evaluate(() => document.getElementById("invComposer").innerText);
  ok("the composer offers an optional parent's email and says what happens to it",
    /Parent's email/.test(help) && /\(optional\)/.test(help) && /We'll email them the link once\. We don't keep the address\./.test(help), help.slice(0, 200));
  ok("…and the browser is not invited to fill in the clinician's own address",
    await pg.evaluate(() => document.getElementById("invParentEmail").getAttribute("autocomplete") === "off" && document.getElementById("invParentEmail").type === "email"));

  // a typo is caught before an invite exists
  await pg.evaluate(() => { document.getElementById("invName").value = "J.T."; document.getElementById("invParentEmail").value = "not-an-email"; document.getElementById("invCreate").click(); });
  await pg.waitForTimeout(200);
  ok("a malformed email is refused in the composer, before any invite is made",
    !log.some((l) => l.m === "POST" && l.p === "/api/slp/invite") && /doesn't look right/.test(await pg.evaluate(() => document.getElementById("invErr").textContent)));

  await pg.evaluate(() => { document.getElementById("invParentEmail").value = "  parent@example.com "; document.getElementById("invCreate").click(); });
  await pg.waitForTimeout(600);
  const post = log.find((l) => l.m === "POST" && l.p === "/api/slp/invite");
  ok("the address goes with the invite, trimmed, as parentEmail", !!post && post.b.parentEmail === "parent@example.com" && post.b.label === "J.T.", JSON.stringify(post && post.b));
  ok("…to that one route and nowhere else", log.filter((l) => JSON.stringify(l).includes("parent@example.com")).length === 1, JSON.stringify(log.map((l) => l.p)));
  ok("…and the page says it was emailed", /Emailed to the parent/.test(await pg.evaluate(() => document.getElementById("invEmailed").textContent)) && !(await pg.evaluate(() => document.getElementById("invEmailed").hidden)));
  ok("…then lets go of the address", await pg.evaluate(() => document.getElementById("invParentEmail").value === ""));
  const msg = await pg.evaluate(() => document.getElementById("invMsg").value);
  ok("…while the ready message still carries the link to send by hand", /inv=NEWTOKEN1234/.test(msg) && !/parent@example\.com/.test(msg), msg);

  // a send that did not go says so, in the route's own words
  log.length = 0;
  await pg.evaluate(() => { document.getElementById("invName").value = "A.B."; document.getElementById("invParentEmail").value = "bounce@example.com"; document.getElementById("invCreate").click(); });
  await pg.waitForTimeout(600);
  const said = await pg.evaluate(() => ({ t: document.getElementById("invEmailed").textContent, bad: document.getElementById("invEmailed").classList.contains("bad") }));
  ok("an email that did not go shows the route's reason, never 'Emailed'", said.bad && /daily limit\. Copy the link and send it yourself/.test(said.t) && !/Emailed to the parent/.test(said.t), JSON.stringify(said));
  await ctx.close();
}

// ── 8. the empty caseload invites, it does not show three empty groups ──
{
  DATA = { kids: [], invites: [] };
  const { ctx, pg } = await open("#today");
  const txt = await pg.evaluate(() => document.getElementById("todayBody").textContent);
  ok("a new clinician is invited to send their first child home", /Send your first child home/.test(txt) && !/Gone quiet/.test(txt), txt.slice(0, 120));
  await ctx.close();
  DATA = fixture();
}

await browser.close(); srv.close();
console.log(JSON.stringify({checks, failures:fails}));
process.exit(fails ? 1 : 0);
