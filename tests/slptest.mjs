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
//     and never "free forever"; "unlimited" only where it is true (Sona Pro,
//     12 Nov 2026: a covered caseload has no cap)
//   - (12 Nov 2026) a new clinician whose dashboard is Sona Pro's, and who
//     has not started it, is shown the plan in place of the caseload
//   - a parent's email typed into Add a child goes to the invite route once,
//     only when typed, and the page says whether the email really went
//   - (17 Nov 2026, SLPCLEAN1) the dashboard is five places, the AI planner
//     first; Community, Affiliate partnerships and the homework draft are
//     gone and their old addresses land somewhere real; the top bar's "Add a
//     family" makes a login and emails it, sending no child's name
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
// A clinician from 29 Sep – 12 Nov 2026: their dashboard is free (open), and
// nothing else is on, so Sona Pro is the offer, trial first. SELF_ON is a
// 24–29 Sep work email.
const SELF_OFF = { active: false, eligible: false, source: "none", periodEnd: null, cancelAtPeriodEnd: false, canRequest: false, workEmail: true, approved: false, requested: false };
const SELF_ON = { ...SELF_OFF, active: true, eligible: true, source: "work-email" };
const PRO_OFF = { active: false, status: "none", trialEnd: null, periodEnd: null, cancelAtPeriodEnd: false, trialAvailable: true, offer: true, name: "Sona Pro", price: "$19.99", per: "a month", trialDays: 14 };
const PLAN_NONE = { ok: true, active: false, source: "none", periodEnd: null, cancelAtPeriodEnd: false, self: SELF_OFF, pro: PRO_OFF, dashboard: { open: true }, grandfathered: false };
const PRO_ON = { ...PRO_OFF, active: true, status: "active", periodEnd: 1822000000, trialAvailable: false, offer: false };
const PLAN_PRO = { ...PLAN_NONE, active: true, source: "pro", periodEnd: 1822000000, self: { ...SELF_ON, source: "pro" }, pro: PRO_ON };
// 402 from the roster: a new account (from 12 Nov 2026) with no Sona Pro.
let LOCKED = false;
let PLAN = PLAN_NONE;
let CHECKOUT = null, NEW_ACCT = false;
const acct = { ok: true, email: "rachel@example.com", code: "rachel-k4", familyKey: "ABCD2345", name: "Rachel K", clinic: "Bright Steps", onboarded: true };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const json = (o, code = 200) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  let body = ""; req.on("data", (c) => (body += c));
  req.on("end", () => {
    let b = {}; try { b = body ? JSON.parse(body) : {}; } catch (e) {}
    if (u.pathname.startsWith("/api/")) log.push({ m: req.method, p: u.pathname + u.search, b });
    if (u.pathname === "/api/slp/auth/me") return json(NEW_ACCT ? { ...acct, code: "", familyKey: "", name: "", clinic: "", onboarded: false } : acct);
    if (u.pathname === "/api/slp/account") return json(req.method === "POST" && b.rotateKey ? { ...acct, familyKey: "ROTATED99" } : acct);
    if (u.pathname === "/api/slp" && req.method === "GET") return LOCKED ? json({ ok: false, needPlan: true, error: "Your dashboard comes with Sona Pro." }, 402) : json({ ok: true, configured: true, kids: DATA.kids, invites: DATA.invites });
    if (u.pathname === "/api/slp/homework") return json({ ok: true, hw: b.hw || null });
    if (u.pathname === "/api/slp/child" && req.method === "DELETE") { DATA.kids = DATA.kids.filter((k) => k.childId !== b.childId); return json({ ok: true, removed: b.childId }); }
    if (u.pathname === "/api/slp/plan" && req.method === "GET") return json(PLAN);
    // TRIALGO1: Sona Pro's checkout. CHECKOUT is the Stripe page's address, or
    // null for a server that refuses it.
    if (u.pathname === "/api/slp/plan" && req.method === "POST") return CHECKOUT ? json({ ok: true, url: CHECKOUT }) : json({ ok: false, error: "Couldn't open checkout just now." }, 502);
    if (u.pathname === "/fake-stripe") { res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><title>Stripe</title><p>Card page</p>"); return; }
    if (u.pathname === "/api/slp/invite" && req.method === "POST") {
      const inv = { token: "NEWTOKEN1234", label: b.label, age: b.age, sounds: b.sounds, pos: b.pos, repsPerDay: b.repsPerDay, note: b.note, createdAt: new Date().toISOString(), expiresAt: day(-30) }; DATA.invites.push(inv);
      // the route's reply: emailed, plus its own reason when the send failed
      const mail = !b.parentEmail ? { emailed: false } : /bounce/.test(b.parentEmail) ? { emailed: false, emailError: "That's 30 emails today, the daily limit. Copy the link and send it yourself." } : { emailed: true };
      return json({ ok: true, invite: inv, link: "http://localhost:" + PORT + "/join.html?slp=RACHEL-K4&k=ABCD2345&inv=NEWTOKEN1234", ...mail });
    }
    // ADD A FAMILY (SLPCLEAN1): the route's own shape, an invite with its login
    if (u.pathname === "/api/slp/family" && req.method === "POST") {
      const inv = { token: "FAMTOKEN2345", label: b.label || "New family", age: b.age || "", sounds: b.sounds || [], pos: "mix", repsPerDay: 20, note: "", createdAt: new Date().toISOString(), expiresAt: day(-30), login: { user: "otter4827", own: false } }; DATA.invites.push(inv);
      const mail = /bounce/.test(b.parentEmail || "") ? { emailed: false, emailError: "That's 30 emails today, the daily limit." } : { emailed: true };
      return json({ ok: true, invite: inv, link: "http://localhost:" + PORT + "/join.html?slp=RACHEL-K4&k=ABCD2345&inv=FAMTOKEN2345", user: "otter4827", password: "k7mpqx2a", ...mail });
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
  // Since 29 Sep 2026 the top bar carries the offer on every page (9b), but
  // Today's own cards still never sell.
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
  await pg.evaluate(()=>location.hash="#child/c1/homework");await pg.waitForTimeout(80);
  ok("remove is hidden on homework", !await pg.locator("#chRemove").isVisible());
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
  // 12 Nov 2026: a covered caseload has no cap, so "unlimited" is true — but
  // only in the Sona Pro offer, never in a promise to a family.
  ok("…and says 'unlimited' only in the Sona Pro offer, where it is true", (src.match(/unlimited/gi) || []).length === 1 && /<li><b>Unlimited families\.<\/b>/.test(src), (src.match(/[^.>"]*unlimited[^.<"]*/gi) || []).join(" | "));
  // Use the shared free-version promise without a fixed game count: parked
  // content must not be advertised as an available free game.
  ok("…and names the free version one way: free games, never 'two games'", !/two (free )?games/i.test(src) && (src.match(/daily practice and free games/g) || []).length >= 3, (src.match(/[^.>"]*two (free )?games[^.<"]*/i) || [""])[0]);

  for (const [label, plan] of [["not covered", PLAN_NONE], ["Sona Pro", PLAN_PRO], ["a yearly plan still renewing", { ...PLAN_NONE, active: true, source: "paid", periodEnd: 1822000000 }], ["grandfathered", { ...PLAN_NONE, active: true, source: "grandfathered", grandfathered: true }]]) {
    PLAN = plan; DATA = fixture(); log.length = 0;
    const { ctx, pg } = await open("#invite");
    await pg.waitForTimeout(200);
    const snip = await pg.evaluate(() => document.getElementById("snip").value);
    const settings = await pg.evaluate(() => { location.hash = "#settings"; return new Promise((r) => setTimeout(() => r(document.getElementById("page-settings").innerText), 150)); });
    if (plan.active) {
      ok(`${label}: the caseload message says Premium is included`, /free for your family/.test(snip) && /Premium is included/.test(snip) && /every game/.test(snip), snip);
      ok(`${label}: Settings says the families get every game`, /Your caseload has Premium, so they get every game too/.test(settings), settings);
    } else {
      ok(`${label}: the caseload message promises the free version and no Premium`, /free for your family: daily practice and free games\./.test(snip) && !/Premium/.test(snip), snip);
      ok(`${label}: Settings says what the free version is and where every game lives`, /daily practice and free games/.test(settings) && /With Sona Pro they get every game/.test(settings), settings);
    }
    // "trial" is Sona Pro's own free days, and Settings may name it; a
    // FAMILY's message never says trial, pilot or forever.
    ok(`${label}: never pilot, trial or forever to a family, nor pilot or forever in Settings`, !/pilot|trial|forever/i.test(snip) && !/pilot|forever/i.test(settings), snip);
    ok(`${label}: learning the plan is a read, never a write`, !log.some((l) => l.m !== "GET"), JSON.stringify(log.filter((l) => l.m !== "GET")));
    await ctx.close();
  }
  PLAN = PLAN_NONE;
}

// ── 9b. the offer in the top bar (Travis, 29 Sep 2026: "yes add the $80 button
//        to the first screen"; Sona Pro since 12 Nov 2026) ──
// A clinician lands on the planner and a returning one on Today; the
// price lived only on the plan page, which neither sees first. The offer
// follows them to every page: the server's price, only once the plan has
// answered, never once there is nothing to sell, and it fits a phone.
{
  const bar = (pg) => pg.evaluate(() => { const b = document.getElementById("premiumTop"); return { hidden: b.hidden || getComputedStyle(b).display === "none", text: b.innerText.replace(/\s+/g, " ").trim(), href: b.getAttribute("href") }; });
  for (const hash of ["#play", "#today", "#caseload"]) {
    PLAN = PLAN_NONE; DATA = fixture();
    const { ctx, pg } = await open(hash);
    const b = await bar(pg);
    ok(`nothing on yet: ${hash} offers Sona Pro's free trial with its price, and it opens the plan`, !b.hidden && /^Try Sona Pro free/.test(b.text) && /then \$19\.99 a month/.test(b.text) && b.href === "#premium", JSON.stringify(b));
    await ctx.close();
  }
  {
    PLAN = PLAN_NONE; DATA = fixture(); log.length = 0;
    const { ctx, pg } = await open("#today");
    await pg.click("#premiumTop"); await pg.waitForTimeout(250);
    const onPlan = await pg.evaluate(() => document.getElementById("page-premium").classList.contains("active"));
    ok("…a tap opens the plan page, where the bar stops repeating the offer", onPlan && (await bar(pg)).hidden);
    await pg.evaluate(() => { location.hash = "#caseload"; }); await pg.waitForTimeout(250);
    ok("…and it is back on the next page", !(await bar(pg)).hidden);
    ok("…and showing it is a read, never a write", !log.some((l) => l.m !== "GET"), JSON.stringify(log.filter((l) => l.m !== "GET")));
    await ctx.close();
  }
  {
    PLAN = { ...PLAN_NONE, pro: { ...PRO_OFF, price: "$24.99" } };  // the server's figure, whatever it is
    const { ctx, pg } = await open("#today");
    const b = await bar(pg);
    ok("the price is the server's, never typed into the page", /\$24\.99 a month/.test(b.text) && !/19\.99/.test(b.text), b.text);
    await ctx.close();
  }
  {
    // the trial already used: the offer stands, without the free days
    PLAN = { ...PLAN_NONE, pro: { ...PRO_OFF, trialAvailable: false } };
    const { ctx, pg } = await open("#today");
    const b = await bar(pg);
    ok("a clinician who has had the trial is offered Get Sona Pro, with no free days", !b.hidden && /^Get Sona Pro/.test(b.text) && !/free|then/.test(b.text) && /\$19\.99 a month/.test(b.text), JSON.stringify(b));
    await ctx.close();
  }
  for (const [label, plan] of [["Sona Pro on", PLAN_PRO], ["grandfathered", { ...PLAN_NONE, active: true, source: "grandfathered", grandfathered: true, self: { ...SELF_ON, source: "grandfathered" }, pro: { ...PRO_OFF, offer: false } }],
    ["paying for both yearly plans still renewing", { ...PLAN_NONE, active: true, source: "paid", self: { ...SELF_ON, source: "paid" }, pro: { ...PRO_OFF, offer: false } }], ["the plan didn't answer", { ok: false, error: "Couldn't check your plan just now." }]]) {
    PLAN = plan; DATA = fixture();
    const { ctx, pg } = await open("#today");
    ok(`${label}: no offer in the bar`, (await bar(pg)).hidden);
    await ctx.close();
  }
  PLAN = PLAN_NONE; DATA = fixture();
  for (const width of [390, 360]) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 } });
    const pg = await ctx.newPage();
    await pg.goto(U("#play")); await pg.waitForTimeout(900);
    const fit = await pg.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(); const t = r("premiumTop"), d = r("downloadApp"), c = r("addFamilyTop"); return { over: document.documentElement.scrollWidth - innerWidth, row: t.bottom <= d.top + 1 && t.bottom <= c.top + 1, inside: [t, d, c].every((q) => q.left >= 0 && q.right <= innerWidth && q.width > 0) }; });
    ok(`${width}px phone: the offer takes its own row and nothing runs off the screen`, fit.over <= 0 && fit.row && fit.inside, JSON.stringify(fit));
    await ctx.close();
  }
}

// ── 9c. a closed dashboard (Travis, 12 Nov 2026: the price is "for the
//        dashboard"): an account made from 12 Nov 2026 with no Sona Pro on ──
// The server refuses the caseload (402 needPlan) and the plan says
// dashboard.open:false; the page shows the plan in place of Today, Caseload
// and a child's page, and leaves Settings and Talk to Rachel open.
{
  LOCKED = true; PLAN = { ...PLAN_NONE, dashboard: { open: false } }; DATA = fixture();
  for (const hash of ["", "#play", "#today", "#caseload", "#child/c1", "#invite"]) {
    const { ctx, pg, errs } = await open(hash);
    const st = await pg.evaluate(() => ({ active: [...document.querySelectorAll(".page.active")].map((p) => p.id), hash: location.hash,
      locked: !document.getElementById("proLocked").hidden, text: document.getElementById("proLocked").innerText, offer: !document.getElementById("proOffer").hidden,
      button: document.getElementById("proBuy").textContent, kids: document.body.innerText.includes("Mia"), err: !document.getElementById("loadError").hidden }));
    ok(`closed dashboard: ${hash} shows the plan instead — with why, and the free trial first`,
      st.active.join() === "page-premium" && st.hash === "#premium" && st.locked && /Your dashboard comes with Sona Pro\. Start your free trial below/.test(st.text) &&
      st.offer && st.button === "Start my free trial" && !st.kids && !st.err && errs.length === 0, JSON.stringify(st) + errs.join("|"));
    await ctx.close();
  }
  for (const hash of ["#settings", "#feedback"]) {
    const { ctx, pg } = await open(hash);
    const active = await pg.evaluate(() => [...document.querySelectorAll(".page.active")].map((p) => p.id).join());
    ok(`closed dashboard: ${hash} stays open`, active === "page-" + hash.slice(1), active);
    await ctx.close();
  }
  {
    // SLPPRO1: Add a family on a closed dashboard opens the plan, never the panel
    const { ctx, pg } = await open("#settings");
    await pg.click("#addFamilyTop"); await pg.waitForTimeout(250);
    const st = await pg.evaluate(() => ({ dialog: document.getElementById("famDialog").open, active: [...document.querySelectorAll(".page.active")].map((p) => p.id).join(), hash: location.hash }));
    ok("closed dashboard: Add a family opens the Sona Pro page with the trial, not the panel", !st.dialog && st.active === "page-premium" && st.hash === "#premium", st);
    ok("…and the web never shows the app's plain locked card", !(await pg.evaluate(() => document.getElementById("page-applock").classList.contains("active"))));
    await ctx.close();
  }
  {
    // the plan page's offer card reads the server's price, the trial length, and the trial's terms
    const { ctx, pg } = await open("#premium");
    const card = await pg.evaluate(() => document.getElementById("proOffer").innerText.replace(/\s+/g, " "));
    ok("the offer names Sona Pro, the server's price and the free days", /\$19\.99 a month · 14 days free/.test(card) && /Unlimited families/.test(card), card.slice(0, 200));
    ok("…and says, beside the button, no charge today and what follows", /No charge today: after your free trial, \$19\.99 a month until you cancel\. Cancel before the trial ends and you pay nothing\./.test(card), card);
    log.length = 0;
    await pg.click("#proBuy"); await pg.waitForTimeout(300);
    const buy = log.find((l) => l.m === "POST" && l.p === "/api/slp/plan");
    ok("…and its button asks the server for Sona Pro's checkout, by name", !!buy && JSON.stringify(buy.b) === JSON.stringify({ plan: "pro" }), JSON.stringify(buy));
    await ctx.close();
  }
  LOCKED = false; PLAN = PLAN_NONE;
}

// ── 9d. STRAIGHT TO THE FREE TRIAL (TRIALGO1, 17 Nov 2026; Travis: email
//        link, then the card page, then the dashboard). The sign-in that made
//        the account lands on /slp.html?start=trial. ──
{
  const PLAN_LOCKED = { ...PLAN_NONE, dashboard: { open: false } };
  const go = async (o) => {
    LOCKED = o.locked; PLAN = o.plan; CHECKOUT = o.checkout; NEW_ACCT = o.fresh; DATA = fixture(); log.length = 0;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(String(e)));
    await pg.goto(U("?start=trial")); await pg.waitForTimeout(1100);
    const posts = log.filter((l) => l.m === "POST" && l.p === "/api/slp/plan");
    return { ctx, pg, errs, posts };
  };
  {
    const { ctx, pg, errs, posts } = await go({ locked: true, plan: PLAN_LOCKED, checkout: "http://localhost:" + PORT + "/fake-stripe", fresh: true });
    ok("a new account on a locked dashboard goes straight to Stripe's card page for Sona Pro, with no stop on the locked page",
      posts.length === 1 && JSON.stringify(posts[0].b) === JSON.stringify({ plan: "pro" }) && new URL(pg.url()).pathname === "/fake-stripe" && errs.length === 0, JSON.stringify({ url: pg.url(), posts, errs }));
    await pg.goBack(); await pg.waitForTimeout(1100);
    const back = await pg.evaluate(() => ({ search: location.search, active: [...document.querySelectorAll(".page.active")].map((p) => p.id).join(), loading: !document.getElementById("loadingState").hidden }));
    ok("…Back from Stripe lands on the locked page with its button, never checkout again", back.search === "" && back.active === "page-premium" && !back.loading &&
      log.filter((l) => l.m === "POST" && l.p === "/api/slp/plan").length === 1, JSON.stringify(back));
    await ctx.close();
  }
  {
    const { ctx, pg, errs, posts } = await go({ locked: true, plan: PLAN_LOCKED, checkout: null, fresh: true });
    const st = await pg.evaluate(() => ({ search: location.search, hash: location.hash, active: [...document.querySelectorAll(".page.active")].map((p) => p.id).join(),
      loading: !document.getElementById("loadingState").hidden, err: document.getElementById("proBuyErr").textContent, button: document.getElementById("proBuy").textContent }));
    ok("…a checkout that won't open leaves the locked page, the error beside its button, and a clean address",
      posts.length === 1 && st.search === "" && st.hash === "#premium" && st.active === "page-premium" && !st.loading && /Couldn't open checkout/.test(st.err) && st.button === "Start my free trial" && errs.length === 0, JSON.stringify(st));
    await ctx.close();
  }
  {
    const { ctx, posts } = await go({ locked: true, plan: { ...PLAN_LOCKED, pro: { ...PRO_OFF, trialAvailable: false } }, checkout: "http://localhost:" + PORT + "/fake-stripe", fresh: true });
    ok("…a trial already spent opens no checkout by itself (the locked page asks)", posts.length === 0, JSON.stringify(posts));
    await ctx.close();
  }
  {
    const { ctx, pg, posts } = await go({ locked: false, plan: PLAN_NONE, checkout: "http://localhost:" + PORT + "/fake-stripe", fresh: false });
    ok("…an open dashboard opens no checkout either, and drops ?start=trial from the address", posts.length === 0 && (await pg.evaluate(() => location.search)) === "", JSON.stringify(posts));
    await ctx.close();
  }
  LOCKED = false; PLAN = PLAN_NONE; CHECKOUT = null; NEW_ACCT = false;
}

// ── 10. a parent's email: typed only if the clinician wants, used once ──
{
  DATA = fixture(); log.length = 0;
  const { ctx, pg } = await open("#caseload");
  await pg.evaluate(() => document.getElementById("clAdd").click()); await pg.waitForTimeout(200);
  const help = await pg.evaluate(() => document.getElementById("invComposer").innerText);
  ok("the composer offers an optional parent's email and says what happens to it",
    /Parent's email/.test(help) && /\(optional\)/.test(help) && /We'll email them the link once\. Our email service, GoHighLevel, keeps their address as a contact\./.test(help), help.slice(0, 200));
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

// ── 11. the dashboard after SLPCLEAN1 (Travis, 17 Nov 2026: "a clean white,
//        simple look ... remove unnecessary features") ──
{
  PLAN = PLAN_NONE; DATA = fixture(); log.length = 0;
  const { ctx, pg, errs } = await open("");
  const st = await pg.evaluate(() => ({
    nav: [...document.querySelectorAll(".sidebar nav .nav-item")].map((a) => a.dataset.page),
    active: [...document.querySelectorAll(".page.active")].map((p) => p.id).join(),
    crumb: document.getElementById("pageCrumb").textContent,
  }));
  ok("the menu is five places, Session games first: Session games, Today, Caseload, Sona Pro, Settings", JSON.stringify(st.nav) === JSON.stringify(["play", "today", "caseload", "premium", "settings"]), st.nav.join(","));
  ok("…and a visit with no address lands on Session games", st.active === "page-play" && st.crumb === "Session games", JSON.stringify(st));
  for (const [from, to] of [["#plan", "#play"], ["#plan-day", "#play"], ["#homework-draft", "#play"], ["#community", "#today"], ["#affiliate", "#today"]]) {
    await pg.evaluate((h) => { location.hash = h; }, from); await pg.waitForTimeout(150);
    const at = await pg.evaluate(() => ({ hash: location.hash, active: [...document.querySelectorAll(".page.active")].map((p) => p.id).join() }));
    ok(`the old address ${from} lands on ${to}, never a dead end`, at.hash === to && at.active === "page-" + to.slice(1), JSON.stringify(at));
  }
  await pg.evaluate(() => { location.hash = "#nowhere"; }); await pg.waitForTimeout(150);
  ok("an unknown address opens Session games", await pg.evaluate(() => document.getElementById("page-play").classList.contains("active")));
  const gone = await pg.evaluate(() => ["page-community", "page-affiliate", "page-homework-draft", "page-plan-day", "page-plan", "planText", "sessionPlanner", "copyAppLink"].filter((id) => document.getElementById(id)));
  const src = readFileSync(HTML, "utf8");
  ok("Community, Affiliate partnerships, the homework draft, the old planners, Plan activities and Copy app link are gone from the page", gone.length === 0 && !/\/api\/slp\/(community|homework\/draft|sessions\/plan|activities)/.test(src), gone.join(","));
  ok("…and the page never asks the community route for anything", !log.some((l) => /community/.test(l.p)), JSON.stringify(log.map((l) => l.p)));
  await pg.evaluate(() => { location.hash = "#settings"; }); await pg.waitForTimeout(150);
  ok("Talk to Rachel is one link in Settings, not a menu item", !(await pg.locator('.nav-item[data-page="feedback"]').count()) && await pg.locator('#page-settings a[href="#feedback"]').isVisible() && /Talk to Rachel/.test(await pg.locator('#page-settings a[href="#feedback"]').innerText()));
  await pg.locator('#page-settings a[href="#feedback"]').click(); await pg.waitForTimeout(150);
  ok("…which opens the message form, with Settings still lit in the menu", await pg.locator("#page-feedback").isVisible() && await pg.evaluate(() => document.querySelector('.nav-item[data-page="settings"]').classList.contains("active")));
  await pg.evaluate(() => { location.hash = "#today"; }); await pg.waitForTimeout(150);
  const look = await pg.evaluate(() => {
    const bg = (el) => getComputedStyle(el).backgroundColor;
    return { body: bg(document.body), side: bg(document.getElementById("sidebar")), cards: [...document.querySelectorAll("#todayBody .card")].map(bg),
      tiles: [...document.querySelectorAll(".nav-item .icon")].map(bg), mascots: document.querySelectorAll(".page-header img, .heading-echo, .page-header .eyebrow").length,
      avatars: [...new Set([...document.querySelectorAll(".person-avatar")].map(bg))] };
  });
  const WHITE = "rgb(255, 255, 255)", CLEAR = "rgba(0, 0, 0, 0)";
  ok("the look is white: the page, the sidebar and every Today card (the week's summary too)", look.body === WHITE && look.side === WHITE && look.cards.length >= 4 && look.cards.every((c) => c === WHITE), JSON.stringify(look));
  ok("…with no coloured tile behind a menu icon, no mascot or eyebrow in a heading, and one neutral avatar colour", look.tiles.every((c) => c === CLEAR) && look.mascots === 0 && look.avatars.length === 1, JSON.stringify(look));
  // "a little more life" (Travis, same day): the real logo top left, a teal
  // bar on the lit menu item, and a greeting with the clinician's OWN name.
  const life = await pg.evaluate(() => {
    const logo = document.querySelector(".sidebar .brand img"), bar = document.querySelector(".mobile-bar .brand img");
    const lit = getComputedStyle(document.querySelector('.nav-item[data-page="today"]'), "::before");
    return { side: logo.getAttribute("src"), sideAlt: logo.getAttribute("alt"), h: logo.getBoundingClientRect().height, loaded: logo.complete && logo.naturalWidth > 0,
      bar: bar.getAttribute("src"), barAlt: bar.getAttribute("alt"), litBar: lit.content !== "none" && lit.backgroundColor, hi: document.getElementById("todayHi").textContent };
  });
  ok("the logo top left is Echo's own (alt empty beside the word Sona), about 38 px tall, in the sidebar and the phone bar",
    life.side === "/assets/brand/echo-logo.webp" && life.sideAlt === "" && life.h >= 34 && life.h <= 42 && life.loaded && life.bar === life.side && life.barAlt === "", JSON.stringify(life));
  ok("…the lit menu item carries a teal bar", life.litBar === "rgb(14, 124, 134)", JSON.stringify(life));
  ok("…and Today greets the clinician by their own first name, never a child's", /^Good (morning|afternoon|evening), Rachel$/.test(life.hi), life.hi);
  ok("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

// ── 12. Add a family (Travis, 17 Nov 2026: "top right, instead of copy app
//        link ... automatically create a custom login username password for
//        a parent with their email ... super easily share") ──
{
  const famText = (pg) => pg.evaluate(() => document.getElementById("famDialog").innerText);
  for (const hash of ["#play", "#today", "#caseload", "#child/c1", "#settings"]) {
    PLAN = PLAN_NONE; DATA = fixture();
    const { ctx, pg } = await open(hash);
    ok(`${hash}: the top bar offers Add a family, and no Copy app link`, await pg.locator("#addFamilyTop").isVisible() && (await pg.locator("#addFamilyTop").innerText()).trim() === "Add a family" && !(await pg.locator("#copyAppLink").count()));
    await ctx.close();
  }
  PLAN = PLAN_NONE; DATA = fixture(); log.length = 0;
  let { ctx, pg, errs } = await open("#today");
  await pg.click("#addFamilyTop"); await pg.waitForTimeout(200);
  const form = await famText(pg);
  ok("it opens a panel: the parent's email, initials or a nickname (not a name), age, sounds, and one button",
    await pg.evaluate(() => document.getElementById("famDialog").open) && /Parent's email/.test(form) && /initials or a nickname/i.test(form) && /not their name/.test(form) &&
    /Age/.test(form) && /Target sound/.test(form) && (await pg.locator("#famGo").innerText()).trim() === "Create login and email it" && await pg.evaluate(() => document.activeElement && document.activeElement.id === "famEmail"), form.slice(0, 300));
  ok("…and, with nothing covering the caseload, one line offers the free trial (never blocking the login)",
    await pg.locator("#famPro").isVisible() && /Families get the free version\. Start your free Sona Pro trial so they get every game\./.test(form) && (await pg.locator("#famProBuy").innerText()).trim() === "Start my free trial" && !(await pg.locator("#famGo").isDisabled()));
  await pg.click("#famGo"); await pg.waitForTimeout(150);
  ok("no email: nothing is sent, and the panel says what is missing", !log.some((l) => l.p === "/api/slp/family") && /Add the parent's email/.test(await pg.locator("#famErr").innerText()));
  await pg.fill("#famEmail", "not-an-email"); await pg.click("#famGo"); await pg.waitForTimeout(150);
  ok("a wrong-looking email: nothing is sent", !log.some((l) => l.p === "/api/slp/family") && /doesn't look right/.test(await pg.locator("#famErr").innerText()));
  await pg.fill("#famEmail", "  parent@example.com ");
  await pg.fill("#famLabel", "MK");
  await pg.selectOption("#famAge", "6");
  await pg.evaluate(() => [...document.querySelectorAll("#famSounds button")].find((b) => b.textContent.trim() === "R").click());
  await pg.click("#famGo");
  await pg.waitForSelector("#famDone:not([hidden])");
  const post = log.find((l) => l.m === "POST" && l.p === "/api/slp/family");
  ok("one POST: the parent's email, trimmed, with only the initials, age and sound given", !!post && JSON.stringify(post.b) === JSON.stringify({ parentEmail: "parent@example.com", label: "MK", age: "6", sounds: ["R"] }), JSON.stringify(post && post.b));
  ok("…never a child's name or anything from the caseload", !!post && !/Mia|Leo|Ava|Sam|Zoe|child/i.test(JSON.stringify(post.b)), JSON.stringify(post && post.b));
  ok("…and the address goes to that one route and nowhere else", log.filter((l) => JSON.stringify(l).includes("parent@example.com")).length === 1, JSON.stringify(log.map((l) => l.p)));
  const done = await famText(pg);
  const big = await pg.evaluate(() => parseFloat(getComputedStyle(document.getElementById("famUser")).fontSize));
  ok("the panel says where it went, and shows the username and password in big, readable text",
    /Sent to parent@example\.com\./.test(done) && (await pg.locator("#famUser").innerText()) === "otter4827" && (await pg.locator("#famPass").innerText()) === "k7mpqx2a" && big >= 20, done.slice(0, 300) + " " + big);
  const msg = await pg.locator("#famMsg").inputValue();
  ok("…with a ready-to-send message: the App Store, Log in, the username and password, and the web link",
    msg.includes("https://apps.apple.com/us/app/sona-speech/id6785755867") && /tap Log in/.test(msg) && msg.includes("Username: otter4827") && msg.includes("Password: k7mpqx2a") &&
    /inv=FAMTOKEN2345/.test(msg) && /free for your family/.test(msg) && !/pilot|trial|forever|unlimited/i.test(msg) && !/MK|parent@example/.test(msg), msg);
  await pg.click("#famCopy"); await pg.waitForTimeout(100);
  ok("Copy message copies exactly that", (await pg.evaluate(() => window.__copied.slice(-1)[0])) === msg);
  ok("…and the panel lets go of the parent's address", (await pg.inputValue("#famEmail")) === "");
  ok("Text it is for phones: not offered on a laptop", !(await pg.locator("#famText").isVisible()));
  ok("the new family waits in the list with its login", await pg.evaluate(() => typeof INVITES !== "undefined" && INVITES.some((i) => i.token === "FAMTOKEN2345")));
  await pg.click("#famAnother"); await pg.waitForTimeout(100);
  ok("Add another family starts a clean form", await pg.locator("#famForm").isVisible() && (await pg.inputValue("#famLabel")) === "" && !(await pg.locator("#famSounds button.on").count()));
  await pg.keyboard.press("Escape"); await pg.waitForTimeout(100);
  ok("Escape closes the panel and hands focus back to the button", !(await pg.evaluate(() => document.getElementById("famDialog").open)) && await pg.evaluate(() => document.activeElement && document.activeElement.id === "addFamilyTop"));
  ok("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();

  // an email that did not go: said plainly, and the copy and text options stay
  ({ ctx, pg, errs } = await open("#caseload"));
  await pg.click("#addFamilyTop"); await pg.waitForTimeout(150);
  await pg.fill("#famEmail", "bounce@example.com"); await pg.click("#famGo");
  await pg.waitForSelector("#famDone:not([hidden])");
  const bad = await pg.evaluate(() => ({ t: document.getElementById("famSent").textContent, bad: document.getElementById("famSent").classList.contains("bad"), msg: document.getElementById("famMsg").value }));
  ok("an email that did not go says so in plain words, never 'Sent', and the message is still there to copy",
    bad.bad && /daily limit/.test(bad.t) && /Copy the message below or text it instead/.test(bad.t) && !/Sent to/.test(bad.t) && /Username: otter4827/.test(bad.msg), JSON.stringify(bad));
  ok("…with no initials given, the post carries the email alone", JSON.stringify(log.filter((l) => l.p === "/api/slp/family").slice(-1)[0].b) === JSON.stringify({ parentEmail: "bounce@example.com" }));
  await ctx.close();

  // on a phone: Text it, as an sms: link carrying the message
  {
    const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const ppg = await pctx.newPage();
    await ppg.addInitScript(() => { window.__copied = []; Object.defineProperty(navigator, "clipboard", { value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } }); });
    await ppg.goto(U("#play")); await ppg.waitForTimeout(900);
    const fits = await ppg.evaluate(() => { const r = document.getElementById("addFamilyTop").getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth; });
    ok("390px phone: Add a family is in the top bar, on screen", fits);
    await ppg.click("#addFamilyTop"); await ppg.waitForTimeout(150);
    const panel = await ppg.evaluate(() => { const r = document.getElementById("famDialog").getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, over: document.documentElement.scrollWidth - innerWidth }; });
    ok("…its panel fits the phone", panel.l >= 0 && panel.r <= panel.w && panel.over <= 0, JSON.stringify(panel));
    await ppg.fill("#famEmail", "parent@example.com"); await ppg.click("#famGo");
    await ppg.waitForSelector("#famDone:not([hidden])");
    const href = await ppg.getAttribute("#famText", "href");
    ok("…and Text it opens the phone's messages with the whole message", await ppg.locator("#famText").isVisible() && /^sms:/.test(href) && decodeURIComponent(href).includes("Username: otter4827") && decodeURIComponent(href).includes("Password: k7mpqx2a"), href);
    await pctx.close();
  }

  // covered (Sona Pro on): nothing to offer
  PLAN = PLAN_PRO; DATA = fixture();
  ({ ctx, pg } = await open("#today"));
  await pg.click("#addFamilyTop"); await pg.waitForTimeout(200);
  ok("with Sona Pro on, the panel offers no trial", !(await pg.locator("#famPro").isVisible()) && !/trial/i.test(await famText(pg)));
  await ctx.close();
  PLAN = PLAN_NONE;
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
