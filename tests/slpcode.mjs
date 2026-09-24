// CODES1: the SLP family credential — code ("username") + family key
// ("password"), auto-created for the clinician, verified server-side before
// anything is granted. The old ?slp= honor system granted free access to ANY
// code; only a credential the server vouches for earns the enrolment ticket,
// and a wrong key genuinely doesn't. Assertions that depend on pricing run
// through the ?paid=1 seam, so they hold whichever way the switch points.
//
// WHAT A CREDENTIAL GRANTS CHANGED ON 24 SEP 2026 (Caseload Premium). A
// verified redemption used to write earlyAdopter — free forever, on the spot.
// Now Sona has a free version (daily practice + two games) for everyone, and
// a clinician's family gets PREMIUM through the clinician's coverage: the
// server answers /api/slp/covered for a device holding the ticket. Families
// who redeemed BEFORE this build are grandfathered by the era-four sweep. The
// pins below that said "a verified family never gates" were rewritten, not
// deleted — each one says, where it stands, what it asserts now and why.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

// mock API: one registered SLP (rachel-k4 / RACHELKEY) with real semantics
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp" };
const CRED = { code: "rachel-k4", key: "RACHELKEY", name: "Rachel W" };
// a second clinician whose caseload is NOT covered (no plan, not grandfathered)
const CRED2 = { code: "sam-p2", key: "SAMKEY22", name: "Sam P" };
const COVERED = new Set([CRED.code]);
let redeemCalls = 0;
const pilotPosts = [];
const redeemBodies = [];
const leadPosts = [];
let authRequests = 0;
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/slp/redeem" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      redeemCalls++;
      let j = {};
      try { j = JSON.parse(body); } catch {}
      redeemBodies.push(j);
      const code = String(j.code || "").trim().toLowerCase();
      const key = String(j.key || "").trim().toUpperCase();
      const cred = [CRED, CRED2].filter((c) => c.code === code && c.key === key)[0];
      const valid = !!cred;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, valid, name: valid ? cred.name : undefined, ticket: valid ? "TICKET:" + cred.code : undefined }));
    });
    return;
  }
  // the coverage question: answered only for a device holding that code's
  // ticket, exactly like the real route (401 otherwise)
  if (u.pathname === "/api/slp/covered" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let j = {};
      try { j = JSON.parse(body); } catch {}
      const code = String(j.code || "").trim().toLowerCase();
      // a ticket past half its life (":old") is still good, and the answer
      // carries a freshly signed one — exactly as the real route renews
      const old = j.ticket === "TICKET:" + code + ":old";
      const good = j.ticket === "TICKET:" + code || old;
      res.writeHead(good ? 200 : 401, { "content-type": "application/json" });
      res.end(JSON.stringify(good ? Object.assign({ ok: true, covered: COVERED.has(code) }, old ? { ticket: "TICKET:" + code } : {}) : { ok: false }));
    });
    return;
  }
  // the founding programme's verification: one real application, fam123
  if (u.pathname === "/api/founding") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, valid: u.searchParams.get("id") === "fam123" }));
    return;
  }
  if (u.pathname === "/api/lead" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => { try { leadPosts.push(JSON.parse(body)); } catch {} res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true, captured: true })); });
    return;
  }
  if (u.pathname === "/api/pilot" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => { try { pilotPosts.push(JSON.parse(body)); } catch {} res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true })); });
    return;
  }
  if (u.pathname === "/api/slp/auth/request" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => { authRequests++; res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true, sent: true })); });
    return;
  }
  if (u.pathname === "/api/founder" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let j = {};
      try { j = JSON.parse(body); } catch {}
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, valid: String(j.key || "") === "OWNER-SECRET-123" }));
    });
    return;
  }
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8155, r));

const browser = await chromium.launch(launchOpts());
let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

// ── 1. a VALID link (?slp=CODE&k=KEY) verifies, and coverage decides Premium ──
// REWRITTEN 24 Sep 2026. This was "verifies and unlocks, forever": it
// simulated onboarding writing earlyAdopter for a verified family and pinned
// that they never gated. Onboarding writes no grant now. A verified family on
// a COVERED caseload gets Premium through coverage — the server's answer to
// the ticket — and one on an uncovered caseload gets the free version, which
// never gates practice. Families who redeemed before this build are kept by
// the era-four sweep (4b-iii below), not by the credential.
for (const [cred, isCovered] of [[CRED, true], [CRED2, false]]) {
  const pg = await (await browser.newContext()).newPage();
  await pg.goto("http://localhost:8155/onboarding.html?slp=" + cred.code + "&k=" + cred.key);
  await pg.waitForTimeout(1100);
  const st = await pg.evaluate(() => ({
    ok: localStorage.getItem("sona.slpok"),
    code: localStorage.getItem("sona.slp"),
    ticket: localStorage.getItem("sona.slpticket"),
    verified: Sona.slpVerified(),
  }));
  ok("a valid link verifies against the server (" + cred.code + ")",
    st.ok === cred.code.toUpperCase() && st.verified && st.ticket === "TICKET:" + cred.code, JSON.stringify(st));
  // finish setup the way onboarding.html does — which no longer writes any
  // earlyAdopter, true or false — and then let every clock run out
  const granted = await pg.evaluate(() => {
    Sona.saveProfile({ childName: "Milo", childAge: "7", focusSounds: ["R"], onboarded: true, slpCode: Sona.slpCode() });
    sessionStorage.setItem("sona.paidui", "1");
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 10 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
    return { early: Sona.getProfile().earlyAdopter, covered: Sona.caseCovered(), premium: Sona.premium(),
      tiles: Sona.gameAccess("tiles").allowed, gated: Sona.gated(), practice: Sona.gated("practice") };
  });
  ok("a verified family is no longer written founding access (" + cred.code + ")", !granted.early, JSON.stringify(granted));
  if (isCovered) {
    ok("…on a covered caseload they hold Premium, through coverage, dead trial and all",
      granted.covered === true && granted.premium === true && granted.tiles === true && granted.gated === false, JSON.stringify(granted));
  } else {
    ok("…on an uncovered caseload they have the free version: Premium locked, practice open",
      granted.covered === false && granted.premium === false && granted.tiles === false && granted.gated === true && granted.practice === false, JSON.stringify(granted));
  }
  await pg.context().close();
}

// ── 2. a WRONG key does not unlock — the honor system is closed ──
{
  const pg = await (await browser.newContext()).newPage();
  await pg.goto("http://localhost:8155/onboarding.html?slp=rachel-k4&k=WRONGKEY1");
  await pg.waitForTimeout(900);
  const st = await pg.evaluate(() => ({
    ok: localStorage.getItem("sona.slpok"),
    verified: Sona.slpVerified(),
  }));
  ok("a wrong key never verifies", !st.ok && !st.verified, JSON.stringify(st));
  const gated = await pg.evaluate(() => {
    // What must stay true is that a wrong key buys no standing OF ITS OWN —
    // checked through the ?paid=1 seam so it holds in either pricing state.
    sessionStorage.setItem("sona.paidui", "1");
    Sona.saveProfile({ childName: "Ana", childAge: "6", focusSounds: ["S"], onboarded: true, earlyAdopter: false });
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 10 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
    return { premium: Sona.gated(), practice: Sona.gated("practice") };
  });
  // since 24 Sep 2026 "gates like anyone else" means Premium locked and
  // practice open — the free version is anyone else's too
  ok("wrong-key family meets Premium locked like anyone else, whenever pricing is on",
    gated.premium === true && gated.practice === false, JSON.stringify(gated));
  await pg.context().close();
}

// ── 3. a bare code with NO key (the old honor system) does not unlock ──
{
  const pg = await (await browser.newContext()).newPage();
  await pg.goto("http://localhost:8155/onboarding.html?slp=anything-i-typed");
  await pg.waitForTimeout(700);
  const st = await pg.evaluate(() => ({
    code: localStorage.getItem("sona.slp"),
    verified: Sona.slpVerified(),
  }));
  ok("a bare code still sticks for the roster", st.code === "ANYTHING-I-TYPED");
  ok("but grants nothing by itself", !st.verified);
  await pg.context().close();
}

// ── 4. the paywall points at the ONE redemption surface ──
// The inline credential box used to be duplicated on trial.html and
// subscribe.html; three copies of the same fetch is three places the unlock
// semantics can drift, and only one of them asked about sharing progress.
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8155/today.html"); // real origin for storage
  await pg.evaluate(() => {
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Ben", childAge: "7", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 10 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
  });
  // ?paid=1 renders the paywall while Sona is free; without it trial.html
  // correctly bounces home and there is no paywall to point anywhere.
  await pg.goto("http://localhost:8155/trial.html?paid=1");
  await pg.waitForTimeout(600);
  const href = await pg.evaluate(() => {
    const a = document.getElementById("slpEntryLink");
    return a ? a.getAttribute("href") : null;
  });
  // The SLP side is hidden (Travis, 19 Sep 2026): the paywall no longer offers
  // the SLP route. A referred family arrives by the link their clinician hands
  // them, which is verified and honoured below exactly as before.
  ok("the paywall no longer offers the SLP route — the SLP side is hidden", href === null, String(href));
  ok("the trial page no longer runs its own copy of the redeem fetch",
    !/slpEnGo/.test(readFileSync(ROOT + "/trial.html", "utf8")),
    "duplicated unlock logic is how a paywall hole gets reopened by accident");
  ok("subscribe.html carries neither the SLP card nor its own copy of the redeem fetch",
    !/slpEntryCard/.test(readFileSync(ROOT + "/subscribe.html", "utf8")) && !/subSlpGo/.test(readFileSync(ROOT + "/subscribe.html", "utf8")));
  await ctx.close();
}

// ── 4b. /join.html: the one-tap family link verifies with NO key leak ──
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  const urls = [];
  pg.on("request", (r) => urls.push(r.url()));
  await pg.goto("http://localhost:8155/join.html?slp=rachel-k4&k=RACHELKEY");
  await pg.waitForTimeout(900);
  const st = await pg.evaluate(() => ({
    unlocked: localStorage.getItem("sona.slpunlock"),
    verified: Sona.slpVerified(),
    early: Sona.getProfile().earlyAdopter,
    covered: Sona.caseCovered(),
    pilot: Sona.isPilot(),
    consentShown: getComputedStyle(document.getElementById("jConsent")).display !== "none",
    msg: document.getElementById("jMsg").textContent,
    loc: location.href,
  }));
  ok("join.html verifies the link's credential and unlocks the device", st.unlocked === "1" && st.verified, JSON.stringify(st));
  ok("join.html strips ?k from the URL immediately", !/[?&]k=/.test(st.loc), st.loc);
  // ACCESS AND SURVEILLANCE ARE SEPARATE. Access is settled here; sharing
  // progress is a second, freely-refusable question.
  // REWRITTEN 24 Sep 2026: this pinned `early === true` — the link wrote
  // earlyAdopter before asking anything. Access for a new redemption is the
  // clinician's coverage now, asked of the server the moment the redeem
  // succeeds, and it still lands BEFORE the sharing answer.
  ok("access lands before the family is asked anything — coverage, not a founding grant",
    st.covered === true && !st.early, JSON.stringify(st));
  ok("…and a covered family is told every game is included", /every game/i.test(st.msg), st.msg);
  ok("but nothing is shared until they say so", st.pilot === false, JSON.stringify(st));
  ok("join.html asks the grown-up about sharing", st.consentShown, JSON.stringify(st));
  const yes = await pg.evaluate(() => {
    document.getElementById("jYes").click();
    return { pilot: Sona.isPilot(), code: (Sona.pilotInfo() || {}).code, share: Sona.getProfile().slpShare, gated: Sona.gated() };
  });
  ok("saying yes puts the child on the SLP's dashboard", yes.pilot === true && yes.code === "RACHEL-K4", JSON.stringify(yes));
  ok("saying yes records the consent on the profile", yes.share === true);
  ok("saying yes keeps the family unlocked", yes.gated === false);
  // THE OPTIONAL EMAIL, after the sharing answer and never as a condition.
  const box = await pg.evaluate(() => ({
    shown: getComputedStyle(document.getElementById("jEmail")).display !== "none",
    line: document.getElementById("jEmailLine").textContent,
    order: document.getElementById("jEmailLine").compareDocumentPosition(document.getElementById("jEmailInput")) & Node.DOCUMENT_POSITION_FOLLOWING,
    loc: location.pathname,
  }));
  ok("after the sharing answer, an optional email box appears — and nothing navigates away underneath it",
    box.shown && box.loc === "/join.html", JSON.stringify(box));
  ok("…with the list line in Travis's words, BEFORE the box",
    /We'll also send occasional tips from Rachel\. Unsubscribe anytime\./.test(box.line) && !!box.order, JSON.stringify(box));
  // what join.html itself requested, frozen before Continue hands the family
  // into the app (whose own pages are not under test here)
  const joinUrls = urls.slice();
  leadPosts.length = 0;
  // a pixel stub, so a "Lead" fired from here would be seen even though
  // join.html loads no pixel today — the rule is about what the page CALLS
  await pg.evaluate(() => { window.sonaTrack = function (ev) { const a = JSON.parse(sessionStorage.getItem("__tracked") || "[]"); a.push(ev); sessionStorage.setItem("__tracked", JSON.stringify(a)); }; });
  await pg.evaluate(() => { document.getElementById("jEmailInput").value = "parent@example.com"; document.getElementById("jEmailGo").click(); });
  await pg.waitForURL(/\/(today|onboarding)\.html/, { timeout: 15000 });
  await pg.waitForTimeout(300);
  const lead = leadPosts[0] || {};
  ok("a typed email goes to /api/lead as a parent who joined through their clinician",
    leadPosts.length === 1 && lead.email === "parent@example.com" && lead.source === "join" && lead.role === "parent" &&
    lead.summary === "Parent joined through their clinician", JSON.stringify(leadPosts));
  ok("…carrying nothing about the child or the clinician",
    !["child", "childName", "name", "age", "childAge", "code", "slp", "focus"].some((k) => k in lead), JSON.stringify(lead));
  // THE AFFILIATE RULE, ENFORCED ON THE WIRE (24 Sep 2026). Every family here
  // came through a clinician's caseload link, and a payout for such a family
  // must be structurally impossible — so this lead carries no attribution a
  // payout could ever key on: no campaign tags, no landing page, no referrer.
  ok("…and no attribution at all: no campaign tags, no landing page, no referrer",
    Object.keys(lead).every((k) => ["email", "source", "role", "summary"].includes(k)), JSON.stringify(lead));
  const tracked = await pg.evaluate(() => sessionStorage.getItem("__tracked") || "[]");
  ok("…and the page fires no ad-pixel Lead for it",
    !/sonaTrack\(/.test(readFileSync(ROOT + "/join.html", "utf8")) && tracked === "[]",
    "a clinician's family is not an ad conversion: " + tracked);
  // the family key must never appear in a request URL (pixel/analytics leak)
  // the initial navigation the family tapped carries the key (unavoidable);
  // the leak that matters is a SUBSEQUENT request (analytics/pixel/api) with it.
  const leaked = urls.filter((u) => /RACHELKEY/.test(u) && !u.startsWith("http://localhost:8155/join.html"));
  ok("the family key never rides a follow-on request URL", leaked.length === 0, leaked.join(" "));
  // join.html must not load the ad/analytics scripts at all
  ok("join.html loads no pixel or analytics", !joinUrls.some((u) => /pixel\.js|analytics\.js/.test(u)), joinUrls.filter((u) => /pixel|analytics/.test(u)).join(" "));
  await ctx.close();
}

// ── 4b-ii. declining consent shares NOTHING and costs the family NOTHING ──
// The whole reason consent is asked after the grant: a grown-up who doesn't
// want their child watched must not have to pay for that choice.
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8155/join.html?slp=rachel-k4&k=RACHELKEY");
  await pg.waitForTimeout(900);
  const no = await pg.evaluate(() => {
    document.getElementById("jNo").click();
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 40 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
    return { pilot: Sona.isPilot(), share: Sona.getProfile().slpShare, gated: Sona.gated(), covered: Sona.caseCovered() };
  });
  ok("saying no never enrols the child", no.pilot === false, JSON.stringify(no));
  ok("saying no records the refusal", no.share === false);
  // the clinician paid for their families' Premium, not for their data: a
  // covered caseload covers the family who declined sharing exactly the same
  ok("saying no still leaves the family unlocked, trial dead and all — coverage never asked for consent",
    no.gated === false && no.covered === true, JSON.stringify(no));
  // …and an empty email box is a complete answer: no lead, straight on
  leadPosts.length = 0;
  await pg.evaluate(() => document.getElementById("jEmailGo").click());
  await pg.waitForURL(/\/(today|onboarding)\.html/, { timeout: 15000 });
  ok("an empty email box sends nothing and goes straight into the app", leadPosts.length === 0, JSON.stringify(leadPosts));
  await ctx.close();
}

// ── 4b-ii½. an UNCOVERED caseload: the free version, and "free" stays true ──
// A clinician who has neither bought "Sona Premium for your caseload" nor was
// grandfathered hands out a link that still works: the family verifies, may
// share progress, and gets what every family gets — daily practice and the
// free games. The consent card's promise, "Sona stays free for you", is true
// on this branch too, which is why it did not change.
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8155/join.html?slp=sam-p2&k=SAMKEY22");
  await pg.waitForTimeout(1000);
  const st = await pg.evaluate(() => {
    sessionStorage.setItem("sona.paidui", "1");
    localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
    return { verified: Sona.slpVerified(), covered: Sona.caseCovered(), premium: Sona.premium(), early: Sona.getProfile().earlyAdopter,
      practice: Sona.gated("practice"), tiles: Sona.gameAccess("tiles").allowed, slice: Sona.gameAccess("slice").allowed,
      promise: document.getElementById("jConsentBody").textContent, msg: document.getElementById("jMsg").textContent,
      title: document.getElementById("jTitle").textContent, tab: document.title, page: document.body.innerText };
  });
  ok("an uncovered clinician's family verifies, and is not covered", st.verified && st.covered === false && !st.early, JSON.stringify(st));
  ok("…so they have the free version: practice and free games open, Premium locked",
    st.practice === false && st.slice === true && st.tiles === false && st.premium === false, JSON.stringify(st));
  ok("…and every word on the page stays true: free, and no promise of every game",
    /Sona stays free for you/.test(st.promise) && !/every game/i.test(st.msg), JSON.stringify(st));
  // REWORDED 24 Sep 2026: this page said "Unlocking your free access…",
  // "gave you free access", "You're in — it's free!" and "Free access via Sam
  // P." — the grant a redemption used to BE. On an uncovered caseload it
  // grants nothing a plain download doesn't, so the page says what happened:
  // the family is connected, and what is free.
  ok("…and on an uncovered caseload the page says CONNECTED, and what is free — never a grant",
    /You're connected/.test(st.title) && /You're connected to Sam P\./.test(st.msg) && /Daily practice and four free games are free\./.test(st.msg) &&
    !/free access|gave you|unlock|it's free!/i.test(st.page + " " + st.tab), JSON.stringify({ title: st.title, msg: st.msg, tab: st.tab }));
  await ctx.close();
}

// ── 4b-ii¾. the clinician's own one-phone link carries its token to redeem ──
// /api/slp/self emails a clinician /join.html?slp=CODE&k=KEY&me=TOKEN. Only
// the server can tell whether the token is real; the page's whole job is to
// forward it with the credential — and to strip it from the address bar with
// the key, since it is single-use proof of an inbox.
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  const before = redeemBodies.length;
  await pg.goto("http://localhost:8155/join.html?slp=rachel-k4&k=RACHELKEY&me=SELFTOKEN_abc123XYZ");
  await pg.waitForTimeout(900);
  const sent = redeemBodies.slice(before)[0] || {};
  ok("join.html forwards the me= token to the redeem call", sent.me === "SELFTOKEN_abc123XYZ" && sent.code === "rachel-k4", JSON.stringify(sent));
  ok("…and strips it from the URL with the key", !/[?&]me=/.test(pg.url()), pg.url());
  await ctx.close();
}

// ── 4b-iii. a family who redeemed BEFORE this build is NOT locked out ──
// FREE1 wrote only "sona.slpok"; a device holding either key had been
// promised free access by its clinician's link. REWRITTEN 24 Sep 2026: this
// pinned that slpVerified() alone kept them ungated. The credential no longer
// grants anything by itself — so the promise is kept the way every free era's
// is: the era-four sweep reads slpok/slpunlock once, on this build's first
// load, and grandfathers the household for good. The counterpart below pins
// that a link redeemed AFTER this build earns nothing from the sweep.
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8155/today.html");
  await pg.evaluate(() => {
    localStorage.clear();
    // a device from the free windows: every earlier stamp, no era-four one yet
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Nia", childAge: "6", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.slpok", "RACHEL-K4");   // exactly what FREE1 left behind
  });
  await pg.reload(); await pg.waitForTimeout(600);     // first load of THIS build
  const res = await pg.evaluate(() => {
    sessionStorage.setItem("sona.paidui", "1");
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 40 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
    return { verified: Sona.slpVerified(), early: Sona.getProfile().earlyAdopter, gated: Sona.gated(), tiles: Sona.gameAccess("tiles").allowed };
  });
  ok("a free-window SLP family still counts as verified", res.verified === true, JSON.stringify(res));
  ok("and is grandfathered by the era-four sweep — never sent to a paywall",
    res.early === true && res.gated === false && res.tiles === true, JSON.stringify(res));

  // …while a link redeemed after the build earns nothing from the sweep: it
  // has only what coverage gives it (none here — no ticket was ever issued)
  await pg.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Ora", childAge: "6", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.slpok", "RACHEL-K4"); localStorage.setItem("sona.slpunlock", "1");
  });
  await pg.reload(); await pg.waitForTimeout(600);
  const late = await pg.evaluate(() => {
    sessionStorage.setItem("sona.paidui", "1");
    localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
    return { verified: Sona.slpVerified(), early: Sona.getProfile().earlyAdopter, premium: Sona.premium(), practice: Sona.gated("practice"), tiles: Sona.gated("tiles") };
  });
  ok("a credential redeemed after this build is verified, but is not Premium by itself",
    late.verified === true && !late.early && late.premium === false && late.tiles === true, JSON.stringify(late));
  ok("…and never costs the family practice", late.practice === false, JSON.stringify(late));
  await ctx.close();
}

// ── 4c. the caseload's coverage survives a kid switch (the caseload iPad) ──
// REWRITTEN 24 Sep 2026: this seeded sona.slpunlock and pinned that the bare
// device unlock kept every kid ungated. The unlock is no longer a grant; the
// DEVICE-WIDE grant a clinician's family holds now is coverage
// (sona.caseplan.v1, not per-kid), and the promise — a sibling added on the
// same iPad is not paywalled — must hold for it exactly as it did before.
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8155/today.html");
  const res = await pg.evaluate(() => {
    sessionStorage.setItem("sona.paidui", "1");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "A", childAge: "6", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.slpunlock", "1");
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 30 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
    const unlockOnly = Sona.gated();
    localStorage.setItem("sona.caseplan.v1", JSON.stringify({ active: true, code: "RACHEL-K4", checked: Date.now() }));
    const before = Sona.gated();
    Sona.addKid("Bee", "5"); // fresh profile, no earlyAdopter
    const afterSwitch = Sona.gated();
    // a household with no free-era grant gives its new child none: addKid
    // copies the household's promise, it never invents one
    const beeEarly = !!Sona.getProfile().earlyAdopter;
    return { unlockOnly, before, afterSwitch, beeEarly };
  });
  ok("a household without a free-era grant hands its new child none", res.beeEarly === false, JSON.stringify(res));
  ok("the bare device unlock is no longer a grant by itself", res.unlockOnly === true, JSON.stringify(res));
  ok("a covered caseload keeps every kid in Premium (survives a switch)", res.before === false && res.afterSwitch === false, JSON.stringify(res));
  await ctx.close();
}

// ── 4d. the founding grant belongs to the household, not one child ──
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8155/today.html");
  const res = await pg.evaluate(() => {
    Sona.saveProfile({ childName: "Kid One", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true });
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 40 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
    const first = Sona.gated();
    Sona.addKid("Kid Two", "5");                       // sibling on the same device
    const kid2 = Sona.kids().filter((k) => !k.active)[0] || Sona.kids()[1];
    Sona.switchKid(Sona.kids().filter((k) => k.name === "Kid Two")[0].slot);
    Sona.saveProfile({ childName: "Kid Two", childAge: "5", focusSounds: ["S"], onboarded: true });
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 40 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
    return { first, second: Sona.gated(), name: Sona.getProfile().childName, early2: Sona.getProfile().earlyAdopter, kid2: !!kid2 };
  });
  ok("the referred family's first child is free", res.first === false, JSON.stringify(res));
  // REWRITTEN 24 Sep 2026: this pinned that the sibling's own profile carried
  // NO grant, proving access was read household-wide. It still is — and the
  // sibling now also CARRIES the household's grant, copied by addKid, because
  // earlyAdopterAnyKid() only sees children still on the list: a family who
  // added a sibling and then removed the first child (the only one the sweep
  // ever marked) dropped to the free version. Copied, never invented — 4c
  // pins that a household with no grant gives its new child none.
  ok("the sibling's profile carries the household's grant, copied when they were added", res.early2 === true, JSON.stringify(res));
  ok("and the sibling is NOT paywalled — access is the household's", res.second === false, JSON.stringify(res));
  const removed = await pg.evaluate(() => {
    sessionStorage.setItem("sona.paidui", "1");
    Sona.removeKid("");                               // the one the sweep marked
    return { kids: Sona.kids().length, premium: Sona.premium(), tiles: Sona.gameAccess("tiles").allowed };
  });
  ok("removing the first child — the one the sweep marked — keeps the household's Premium",
    removed.kids === 1 && removed.premium === true && removed.tiles === true, JSON.stringify(removed));
  await ctx.close();
}

// ── 4e. /pilot.html cannot self-serve a free unlock ──
// It called startPilot() straight off a URL parameter, and isPilot()
// short-circuits gated() — so the link was free-forever for anyone who had it.
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8155/pilot.html?code=rachel-k4");   // NO key
  await pg.waitForTimeout(700);
  const nokey = await pg.evaluate(() => {
    document.getElementById("cName").value = "Sneaky";
    document.getElementById("cAge").value = "7";
    document.querySelector(".snd").click();
    document.getElementById("consent").checked = true;
    document.getElementById("go").click();
    return { pilot: Sona.isPilot(), err: document.getElementById("err").textContent, loc: location.pathname };
  });
  ok("no key, no enrolment", nokey.pilot === false, JSON.stringify(nokey));
  ok("and the page says why instead of silently granting", /code and family key/i.test(nokey.err), nokey.err);
  ok("it never navigates into the app on an ungranted enrolment", nokey.loc === "/pilot.html", nokey.loc);
  await ctx.close();
}

// ── 4f. /pilot.html WITH a valid key: unlock yes, sharing only if ticked ──
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8155/pilot.html?code=rachel-k4&k=RACHELKEY");
  await pg.waitForTimeout(700);
  const st = await pg.evaluate(() => ({
    loc: location.href,
    keyPrefilled: (document.getElementById("cKey") || {}).value,
    shareOptional: !document.getElementById("shareSlp").checked,
  }));
  ok("pilot.html strips ?k from the URL too", !/[?&]k=/.test(st.loc), st.loc);
  ok("the key is carried into the form, not the address bar", st.keyPrefilled === "RACHELKEY", st.keyPrefilled);
  ok("sharing with the SLP is opt-IN, not pre-ticked", st.shareOptional);
  const done = await pg.evaluate(() => {
    document.getElementById("cName").value = "Mia";
    document.getElementById("cAge").value = "6";
    document.querySelector(".snd").click();
    document.getElementById("consent").checked = true;   // required box only
    document.getElementById("go").click();
    return true;
  });
  await pg.waitForTimeout(900);
  const after = await pg.evaluate(() => ({ verified: Sona.slpVerified(), pilot: Sona.isPilot(), share: Sona.getProfile().slpShare }));
  ok("a verified family is unlocked", done && after.verified === true, JSON.stringify(after));
  ok("leaving the share box unticked shares nothing", after.pilot === false && after.share === false, JSON.stringify(after));
  await ctx.close();
}

// ── 4g. source contracts on the two surfaces that used to give access away ──
{
  const pilot = readFileSync(ROOT + "/pilot.html", "utf8");
  ok("pilot.html only enrols behind slpRedeem",
    /slpRedeem\([\s\S]{0,600}r\.valid/.test(pilot) && !/^\s*if\(Sona\.startPilot\) Sona\.startPilot\(CODE\);/m.test(pilot),
    "startPilot() off a URL parameter is a free subscription for anyone with the link");
  ok("pilot.html separates the required recording consent from SLP sharing",
    /id="shareSlp"/.test(pilot) && /shareSlp[\s\S]{0,200}checked/.test(pilot));
  const dash = readFileSync(ROOT + "/slp.html", "utf8");
  ok("the dashboard's family link carries the key (an entitlement, not an honor system)",
    /familyKey[\s\S]{0,200}"&k="/.test(dash), "a keyless link unlocked Sona for anyone it was forwarded to");
  const succ = readFileSync(ROOT + "/../app/subscribe/success/page.tsx", "utf8");
  // ORDER, not distance. This measured character windows (900, then 200) and
  // a four-line comment added between the key and the flag pushed the grant
  // out of range — a green-to-red flip with no behaviour change, which is the
  // same brittleness that took down day1 and hwtest. What matters is that the
  // write happens AFTER the confirmation guard, and that is what it now asks.
  {
    const guard = succ.indexOf("if (!j || !j.ok) return;");
    const key = succ.indexOf('"sona.sub.v1",');
    const grant = succ.indexOf("active: true");
    ok("the success page grants NOTHING before Stripe confirms the session",
      guard > -1 && key > guard && grant > guard,
      "writing the entitlement on mount made the URL itself a free subscription");
  }
  ok("an unconfirmed load is told the truth instead of 'You're in!'",
    /fetched && !paid/.test(succ) && /couldn&apos;t confirm a purchase/i.test(succ));
  ok("conversion events fire only on a confirmed purchase",
    succ.indexOf('sonaTrack("Subscribe"') > succ.indexOf("if (!j || !j.ok) return;"),
    "reporting every stray page load to Meta as a sale poisons the optimiser");
}

// ── 4h. a backup code restores PRACTICE, never ACCESS ──
// importData() used to write any key starting "sona." verbatim, which made the
// backup box a paste-in paywall bypass: hand someone a string containing
// sona.sub.v1 and they were a subscriber.
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8155/today.html");
  const res = await pg.evaluate(() => {
    Sona.saveProfile({ childName: "Real", childAge: "7", focusSounds: ["R"], onboarded: true });
    const forged = JSON.stringify({ app: "sona", v: 1, data: {
      "sona.sub.v1": JSON.stringify({ active: true, email: "forger@example.com" }),
      "sona.slpunlock": "1",
      "sona.slpok": "STOLEN",
      "sona.founder": "1",
      "sona.paidui": "1",
      "sona.pilot.v1": JSON.stringify({ consent: true, code: "FAKE" }),
      "sona.trial.v1": JSON.stringify({ start: Date.now(), days: 999 }),
      // 24 Sep 2026: coverage is Premium, and the ticket is what earns it
      "sona.caseplan.v1": JSON.stringify({ active: true, code: "RACHEL-K4", checked: Date.now() }),
      "sona.slpticket": "TICKET:rachel-k4",
      "sona.profile.v1": JSON.stringify({ childName: "Restored", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true }),
      "sona.progress.v1": JSON.stringify({ totals: { coins: 99 }, stage: {}, sessions: [], missed: [] }),
    } });
    const r = Sona.importData(forged);
    return {
      r,
      subscribed: Sona.isSubscribed(), slp: Sona.slpVerified(), founder: Sona.isFounder(),
      pilot: Sona.isPilot(), early: Sona.getProfile().earlyAdopter,
      covered: Sona.caseCovered(), ticket: localStorage.getItem("sona.slpticket"), premium: Sona.premium(),
      unlock: localStorage.getItem("sona.slpunlock"),
      name: Sona.getProfile().childName, coins: Sona.getCoins(),
    };
  });
  ok("the import succeeds — a real family's backup still works", res.r.ok === true, JSON.stringify(res.r));
  ok("a forged backup buys no subscription", res.subscribed === false, JSON.stringify(res));
  // REWRITTEN 24 Sep 2026: these two pinned "no SLP unlock" (slpVerified()
  // false) and "no enrolment ticket" (null). The clinician codes and the
  // ticket now TRAVEL — the iOS app's storage is separate from Safari's, and
  // a backup is the only bridge a family who joined in Safari has (4h-ii).
  // They grant nothing here: slpVerified() is a label premium() never reads,
  // and a ticket is a question only the server answers. What must not travel
  // is the device unlock flag and the cached answer — pinned below.
  ok("…no device unlock flag, and a carried ticket is not Premium by itself",
    res.unlock === null && res.premium === false, JSON.stringify(res));
  ok("…no founder key", res.founder === false, JSON.stringify(res));
  ok("…no pilot enrolment", res.pilot === false, JSON.stringify(res));
  ok("…and no earlyAdopter smuggled inside the profile", !res.early, JSON.stringify(res));
  ok("…no cached caseload coverage — the answer never travels, only the question", res.covered === false, JSON.stringify(res));
  ok("…so the forged backup holds no Premium at all", res.premium === false, JSON.stringify(res));
  ok("but the child's real progress DOES restore", res.name === "Restored" && res.coins === 99, JSON.stringify(res));
  ok("the entitlement keys are reported as skipped, not silently dropped", (res.r.skipped | 0) >= 7, JSON.stringify(res.r));
  await ctx.close();
}

// ── 4h-i. A DEVICE THAT KEEPS ASKING NEVER RUNS OUT OF PROOF ──
// Tickets expire (400 days) and only a redeem used to mint one, so a healthy
// device reached expiry, got 401s forever, and froze on its last answer —
// Premium kept after a clinician stopped paying, or never granted after they
// started. The server now hands back a renewed ticket with an authoritative
// answer, and caseRefresh keeps it (24 Sep 2026).
{
  const ctx = await browser.newContext(); const pg = await ctx.newPage();
  await pg.goto("http://localhost:8155/today.html"); await pg.waitForTimeout(400);
  const res = await pg.evaluate(async () => {
    localStorage.setItem("sona.slpok", "RACHEL-K4");
    localStorage.setItem("sona.slpticket", "TICKET:rachel-k4:old");
    const covered = await Sona.caseRefresh(true);
    const renewed = localStorage.getItem("sona.slpticket");
    // an answer WITHOUT a new ticket leaves the one the device holds
    const again = await Sona.caseRefresh(true);
    const kept = localStorage.getItem("sona.slpticket");
    // and a refused one (401) changes nothing at all — not the ticket, not coverage
    localStorage.setItem("sona.slpticket", "FORGED");
    const refused = await Sona.caseRefresh(true);
    return { covered, renewed, again, kept, refused, forged: localStorage.getItem("sona.slpticket") };
  });
  ok("an authoritative answer's renewed ticket replaces the ageing one", res.covered === true && res.renewed === "TICKET:rachel-k4", JSON.stringify(res));
  ok("…an answer without one keeps the ticket the device holds", res.again === true && res.kept === "TICKET:rachel-k4", JSON.stringify(res));
  ok("…and a refusal changes nothing", res.refused === true && res.forged === "FORGED", JSON.stringify(res));
  await ctx.close();
}

// ── 4h-ii. THE IPHONE BRIDGE: a ticket carried by a backup, verified again ──
// A family opens their clinician's link in Safari; the iOS app keeps separate
// storage, and the move-in code / a backup (importData) is the only thing
// that crosses. Until 24 Sep 2026 the ticket was blocked from import, so a
// covered family who installed the app landed on the free version with no
// way back. The ticket travels now — and grants nothing until the SERVER
// answers for that exact code, which the import asks at once.
{
  const backupFrom = async (cred) => {
    const c = await browser.newContext(); const p = await c.newPage();
    await p.goto("http://localhost:8155/join.html?slp=" + cred.code + "&k=" + cred.key);
    await p.waitForTimeout(900);
    const code = await p.evaluate(() => { Sona.saveProfile({ childName: "Iris", childAge: "6", focusSounds: ["S"], onboarded: true }); return Sona.exportString(); });
    await c.close();
    return code;
  };
  for (const [cred, covered] of [[CRED, true], [CRED2, false]]) {
    const backup = await backupFrom(cred);
    const ctx = await browser.newContext(); const pg = await ctx.newPage();
    await pg.goto("http://localhost:8155/today.html"); await pg.waitForTimeout(400);   // the app's first load: every sweep stamps it
    const st = await pg.evaluate(async (backup) => {
      sessionStorage.setItem("sona.paidui", "1");
      localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
      const r = Sona.importData(backup);
      const now = { premium: Sona.premium(), covered: Sona.caseCovered() };
      for (let i = 0; i < 40 && !localStorage.getItem("sona.caseplan.v1"); i++) await new Promise((res) => setTimeout(res, 50));
      return { r, now, ticket: localStorage.getItem("sona.slpticket"), slpok: localStorage.getItem("sona.slpok"),
        later: { premium: Sona.premium(), covered: Sona.caseCovered(), tiles: Sona.gameAccess("tiles").allowed } };
    }, backup);
    ok(cred.code + ": the backup carries the clinician code and the enrolment ticket across",
      st.r.ok && st.ticket === "TICKET:" + cred.code && st.slpok === cred.code.toUpperCase(), JSON.stringify(st));
    ok(cred.code + ": …which is not Premium the moment it lands", st.now.premium === false && st.now.covered === false, JSON.stringify(st.now));
    ok(cred.code + (covered ? ": the import asks the server, and a covered caseload's family gets Premium from its answer"
                            : ": the import asks the server, and an uncovered caseload's family keeps the free version"),
      st.later.covered === covered && st.later.premium === covered && st.later.tiles === covered, JSON.stringify(st.later));
    // …and the era-four sweep is not re-opened by a credential that arrived
    // AFTER this device's first load: it is one-shot and already stamped
    await pg.reload(); await pg.waitForTimeout(500);
    const swept = await pg.evaluate(() => ({ early: Sona.getProfile().earlyAdopter, stamp: localStorage.getItem("sona.freeera4.v1") }));
    ok(cred.code + ": an imported slpok never grandfathers the device on its next load", !swept.early && swept.stamp === "done", JSON.stringify(swept));
    await ctx.close();
  }
  // a forged backup cannot re-open a sweep by carrying an empty stamp
  const ctx = await browser.newContext(); const pg = await ctx.newPage();
  await pg.goto("http://localhost:8155/today.html"); await pg.waitForTimeout(400);
  await pg.evaluate(() => Sona.importData(JSON.stringify({ app: "sona", v: 1, data: {
    "sona.freeera.v1": "", "sona.freeera2.v1": "", "sona.freeera3.v1": "", "sona.freeera4.v1": "",
    "sona.slpok": "RACHEL-K4",
    "sona.profile.v1": JSON.stringify({ childName: "Forged", childAge: "6", focusSounds: ["S"], onboarded: true }),
  } })));
  await pg.reload(); await pg.waitForTimeout(500);
  const forged = await pg.evaluate(() => ({ early: Sona.getProfile().earlyAdopter, stamps: ["", "2", "3", "4"].map((n) => localStorage.getItem("sona.freeera" + n + ".v1")) }));
  ok("a backup cannot blank this device's free-era stamps and re-open a sweep",
    !forged.early && forged.stamps.every((v) => !!v), JSON.stringify(forged));
  await ctx.close();
}

// ── 4h-iii. a restore never erases the DESTINATION's own grandfathering ──
// importData strips earlyAdopter from what it imports (a backup must not
// forge the promise) — and until 24 Sep 2026 it then wrote that stripped
// profile over a profile this device's own sweep had marked, ending a promise
// the backup had nothing to do with. Both halves hold now.
{
  const ctx = await browser.newContext(); const pg = await ctx.newPage();
  await pg.goto("http://localhost:8155/today.html"); await pg.waitForTimeout(400);
  const res = await pg.evaluate(() => {
    sessionStorage.setItem("sona.paidui", "1");
    // this device was grandfathered here, by its own sweep
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Here", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true, freeEra: true, freeEra4: true }));
    const before = Sona.premium();
    // same key, stripped: the ordinary restore of this family's own backup
    const same = Sona.importData(JSON.stringify({ app: "sona", v: 1, data: {
      "sona.profile.v1": JSON.stringify({ childName: "Restored", childAge: "7", focusSounds: ["R"], onboarded: true }) } }));
    const afterSame = { premium: Sona.premium(), early: Sona.getProfile().earlyAdopter, name: Sona.getProfile().childName };
    // a backup whose child list no longer includes the marked profile
    Sona.importData(JSON.stringify({ app: "sona", v: 1, data: {
      "sona.kids.v1": JSON.stringify({ active: "k7", list: [{ slot: "k7", name: "Other" }] }),
      "sona.profile.v1@k7": JSON.stringify({ childName: "Other", childAge: "5", focusSounds: ["S"], onboarded: true, earlyAdopter: true }) } }));
    return { before, same: same.ok, afterSame, afterList: { premium: Sona.premium(), kids: Sona.kids().map((k) => k.slot), early: Sona.getProfile().earlyAdopter } };
  });
  ok("a restore keeps the grandfathering the destination device already held",
    res.before === true && res.same && res.afterSame.premium === true && res.afterSame.early === true && res.afterSame.name === "Restored", JSON.stringify(res));
  ok("…even when the backup's child list leaves the marked profile out — the grant is the household's",
    res.afterList.premium === true && res.afterList.kids.join() === "k7" && res.afterList.early === true, JSON.stringify(res));
  // and a device that was NOT grandfathered still gains nothing from a backup
  const plain = await pg.evaluate(() => {
    localStorage.removeItem("sona.kids.v1"); localStorage.removeItem("sona.profile.v1@k7");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "New", childAge: "7", focusSounds: ["R"], onboarded: true }));
    Sona.importData(JSON.stringify({ app: "sona", v: 1, data: {
      "sona.profile.v1": JSON.stringify({ childName: "Restored", childAge: "7", onboarded: true, earlyAdopter: true, freeEra4: true }) } }));
    return { premium: Sona.premium(), early: Sona.getProfile().earlyAdopter, era: Sona.getProfile().freeEra4 };
  });
  ok("…while a device that was never grandfathered gains nothing from one", plain.premium === false && !plain.early && !plain.era, JSON.stringify(plain));
  await ctx.close();
}

// ── 4h-iv. A FOUNDING FAMILY KEEPS PREMIUM when it joins a clinician ──
// Founding status lived in the per-child pilot code ("ff-…"), and "Yes, share
// progress" overwrites that code with the clinician's. A founding family who
// joined an UNCOVERED clinician lost every game; their second child never had
// them. It is the household's now, in sona.founding.v1, written by the
// verified ?ff= path — and a backup cannot carry it.
{
  const ctx = await browser.newContext(); const pg = await ctx.newPage();
  // onboarding, not Home: a brand-new device on Home is sent to setup at
  // once, and that navigation would cancel the verification mid-flight
  await pg.goto("http://localhost:8155/onboarding.html?ff=fam123"); await pg.waitForTimeout(900);
  const enrolled = await pg.evaluate(() => ({ mark: JSON.parse(localStorage.getItem("sona.founding.v1") || "null"), code: Sona.pilotInfo().code }));
  ok("the verified ?ff= link records founding status for the household",
    !!enrolled.mark && enrolled.mark.code === "ff-fam123" && enrolled.code === "ff-fam123", JSON.stringify(enrolled));
  await pg.goto("http://localhost:8155/join.html?slp=sam-p2&k=SAMKEY22"); await pg.waitForTimeout(1000);
  await pg.evaluate(() => document.getElementById("jYes").click());
  const joined = await pg.evaluate(() => {
    sessionStorage.setItem("sona.paidui", "1");
    const out = { code: Sona.pilotInfo().code, covered: Sona.caseCovered(), premium: Sona.premium(), tiles: Sona.gameAccess("tiles").allowed };
    Sona.addKid("Sib", "5");
    out.sibling = Sona.premium();
    return out;
  });
  ok("…and keeps Premium after 'Yes, share progress' with an uncovered clinician replaces the pilot code",
    joined.code === "SAM-P2" && joined.covered === false && joined.premium === true && joined.tiles === true, JSON.stringify(joined));
  ok("…for every child in the household", joined.sibling === true, JSON.stringify(joined));
  await ctx.close();
  const c2 = await browser.newContext(); const p2 = await c2.newPage();
  await p2.goto("http://localhost:8155/today.html"); await p2.waitForTimeout(400);
  const forged = await p2.evaluate(() => {
    sessionStorage.setItem("sona.paidui", "1");
    Sona.importData(JSON.stringify({ app: "sona", v: 1, data: {
      "sona.founding.v1": JSON.stringify({ code: "ff-stolen", at: "2026-09-24" }),
      "sona.profile.v1": JSON.stringify({ childName: "F", childAge: "6", onboarded: true }) } }));
    return { mark: localStorage.getItem("sona.founding.v1"), premium: Sona.premium() };
  });
  ok("…and a backup cannot forge it", forged.mark === null && forged.premium === false, JSON.stringify(forged));
  await c2.close();
}

// ── 4h-v. NO SURFACE STILL PROMISES THAT A LINK GRANTS ANYTHING ──
// Until 24 Sep 2026 a redemption WAS the grant, and the clinician-facing copy
// said so: "Sona is free for them — no trial, no paywall", "this link makes it
// free for you", "the code … so Sona is free for them", "it makes Sona free for
// the families you send it to". A clinician repeats those words to a family,
// and the app then shows that family a price. What a link does now is CONNECT;
// what is free is free for every family.
{
  const strip = (src) => src.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  const settings = strip(readFileSync(ROOT + "/settings.html", "utf8"));
  const onb = strip(readFileSync(ROOT + "/onboarding.html", "utf8"));
  const join = strip(readFileSync(ROOT + "/join.html", "utf8"));
  const pilot = strip(readFileSync(ROOT + "/pilot.html", "utf8"));
  const GRANT = /no trial, no paywall|makes it free for you|so Sona is free for them|makes Sona free for|gave you free access|Unlock free access|Unlocking your free access|free for their families|it's free!|Free access (via|unlocked)|free during the pilot/i;
  for (const [name, src] of [["settings.html", settings], ["onboarding.html", onb], ["join.html", join], ["pilot.html", pilot]]) {
    ok(name + " never says a clinician's link grants access", !GRANT.test(src), (src.match(GRANT) || [])[0]);
  }
  ok("the clinician's share card says what the link does, and what is free for every family",
    /it connects them to <b>your dashboard<\/b>/.test(settings) && /Daily practice and four free games are <b>free for every family<\/b>/.test(settings) &&
    /with <b>Sona Premium for your caseload<\/b> they get every game/.test(settings));
  ok("…and the message a clinician copies to a family says 'free' and what free means",
    /It\\u2019s free for your family: daily practice and four free games\. /.test(settings));
  ok("clinician setup says the code and key connect families to the dashboard",
    /the code and family key that connect families to your dashboard/.test(onb) && /it connects the families you send it to with your dashboard/.test(onb));
}

// ── 4i. a roster write requires the enrolment ticket ──
// /api/pilot used to accept any POST that named a code. The code travels in
// share links and is derived from the clinician's email stem, so anyone who
// had seen one could invent children, outcomes and streaks and watch them
// appear on a real therapist's dashboard as clinical fact.
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  pilotPosts.length = 0;
  await pg.goto("http://localhost:8155/join.html?slp=rachel-k4&k=RACHELKEY");
  await pg.waitForTimeout(900);
  const held = await pg.evaluate(() => localStorage.getItem("sona.slpticket"));
  ok("a verified redeem hands the device an enrolment ticket", held === "TICKET:rachel-k4", String(held));
  await pg.evaluate(() => document.getElementById("jYes").click());
  await pg.waitForTimeout(700);
  ok("the enrolment write carries the ticket",
    pilotPosts.length > 0 && pilotPosts.every((b) => b.ticket === "TICKET:rachel-k4"), JSON.stringify(pilotPosts.map((b) => b.ticket)));

  // …and a device that never passed the credential check writes nothing
  const ctx2 = await browser.newContext();
  const pg2 = await ctx2.newPage();
  pilotPosts.length = 0;
  await pg2.goto("http://localhost:8155/today.html");
  const forged = await pg2.evaluate(async () => {
    Sona.saveProfile({ childName: "Ghost", childAge: "7", focusSounds: ["R"], onboarded: true });
    localStorage.removeItem("sona.slpticket");
    Sona.startPilot("RACHEL-K4");          // knows the code, has no ticket
    Sona.sendProgress("enroll");
    await new Promise((r) => setTimeout(r, 400));
    return true;
  });
  await pg2.waitForTimeout(500);
  ok("knowing the code alone writes nothing to the roster", forged && pilotPosts.length === 0, JSON.stringify(pilotPosts));
  await ctx2.close();
  await ctx.close();
}

// ── 4b. SIBLINGS ARE SEPARATE CHILDREN TO THE CLINICIAN ──
// `sona.pilot.v1` held the clinician code, the reporting childId AND the
// grown-up's consent — and it sat OUTSIDE PER_KID. Two children on one iPad
// therefore reported under ONE childId: the roster row was overwritten by
// whichever sibling practiced last, so a clinician read one child's name
// against the other's outcomes, and homework assigned to one arrived on the
// other's profile. The sibling also inherited the sharing consent without
// anyone agreeing to it, which is the part that is not merely a bug.
//
// This asserts the OUTGOING payloads, not local progress — the earlier
// per-child work all passed while the wire still carried one id.
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  pilotPosts.length = 0;
  await pg.goto("http://localhost:8155/join.html?slp=rachel-k4&k=RACHELKEY");
  await pg.waitForTimeout(900);
  await pg.evaluate(() => document.getElementById("jYes").click());
  // join.html enrols, then — since 24 Sep 2026 — offers the optional email
  // box, and hands the family into the app when the grown-up taps Continue
  // (it used to go on an 1100ms timer). Tap it with the box empty, then wait
  // for the landing instead of guessing how long it takes: a navigation that
  // lands inside the next page.evaluate destroys its execution context.
  await pg.evaluate(() => document.getElementById("jEmailGo").click());
  await pg.waitForURL(/\/(today|onboarding)\.html/, { timeout: 15000 });
  await pg.waitForFunction(() => !!window.Sona, null, { timeout: 15000 });
  const first = pilotPosts.slice();
  ok("the enrolled child reports to the clinician", first.length > 0, JSON.stringify(first.length));

  // a sibling is added on the same device and practices
  pilotPosts.length = 0;
  const sib = await pg.evaluate(async () => {
    const slot = Sona.addKid("Sibling", "5");
    Sona.switchKid(slot);
    const inherited = Sona.isPilot();          // must be FALSE: nobody consented for them
    Sona.sendProgress("enroll");               // ...so this must send nothing
    await new Promise((r) => setTimeout(r, 400));
    return { slot, inherited };
  });
  await pg.waitForTimeout(400);
  ok("a sibling does NOT inherit the grown-up's sharing consent",
    sib.inherited === false, JSON.stringify(sib));
  ok("…and nothing about them reaches the clinician until someone enrols them",
    pilotPosts.length === 0, JSON.stringify(pilotPosts.map((b) => b.child)));

  // when the sibling IS enrolled, they must be a DIFFERENT row
  pilotPosts.length = 0;
  const two = await pg.evaluate(async () => {
    Sona.startPilot("RACHEL-K4");
    Sona.sendProgress("enroll");
    await new Promise((r) => setTimeout(r, 400));
    return Sona.pilotInfo().childId;
  });
  await pg.waitForTimeout(400);
  const firstId = (first[0] || {}).childId || "";
  ok("an enrolled sibling gets their OWN reporting identity",
    two && firstId && two !== firstId, JSON.stringify({ firstId, siblingId: two }));
  ok("…so the clinician receives two rows, not one overwritten one",
    pilotPosts.length > 0 && pilotPosts.every((b) => b.childId === two),
    JSON.stringify(pilotPosts.map((b) => ({ id: b.childId, child: b.child }))));

  // and switching back must not disturb the first child's identity
  const back = await pg.evaluate(() => { Sona.switchKid(""); return Sona.pilotInfo().childId; });
  ok("switching back restores the first child's identity, unchanged",
    back === firstId, JSON.stringify({ back, firstId }));
  await ctx.close();
}

// ── 4c. the roster key is canonical, and the child binding is enforced ──
// Server-side contracts for two findings that no browser test can reach.
{
  const APP = ROOT + "/..";
  const auth = readFileSync(APP + "/lib/slpAuth.ts", "utf8");
  const pilot = readFileSync(APP + "/app/api/pilot/route.ts", "utf8");
  const dash = readFileSync(APP + "/app/api/slp/route.ts", "utf8");
  const hw = readFileSync(APP + "/app/api/slp/homework/route.ts", "utf8");

  ok("there is ONE canonical roster key, and it lowercases",
    /export function rosterKey[\s\S]{0,160}toLowerCase\(\)/.test(auth),
    "the client uppercases the code and the dashboard reads lowercase — Redis keys are case-sensitive");
  for (const [name, src] of [["pilot write", pilot], ["dashboard read", dash], ["homework roster read", hw]]) {
    ok(`the ${name} goes through rosterKey()`,
      /rosterKey\(/.test(src) && !/"slp:" *\+/.test(src),
      "a hand-built key is how the write and the read drifted apart silently");
  }
  ok("families stranded under the old uppercase key are recovered on read",
    /healLegacyRoster/.test(auth) && /healLegacyRoster\(/.test(dash),
    "without this, everyone who enrolled while the keys mismatched stays invisible forever");
  ok("…and the recovery never clobbers a row written since the fix",
    /HSETNX/.test(auth));

  ok("the pilot route READS its ticket, so the child binding is visible",
    /readTicket\(/.test(pilot) && !/verifyTicket\(/.test(pilot),
    "verifyTicket is a clinic-wide boolean — it cannot tell you WHOSE row this is");
  ok("a ticket may only write the child it is bound to",
    /t\.cid \? t\.cid === childId : await ticketOwnsChild\(/.test(pilot),
    "otherwise one family on a caseload overwrites another child's name, outcomes and streak");
  ok("…and an unbound ticket binds to the first child it claims",
    /export async function ticketOwnsChild[\s\S]{0,700}"NX"/.test(auth),
    "legacy tickets keep working, but stay confined to one row");
  ok("…failing CLOSED when the store is unreachable",
    /export async function ticketOwnsChild[\s\S]{0,900}catch \{[\s\S]{0,200}return false;/.test(auth),
    "an unattributable roster write is the write this check exists to refuse");
}

// ── 5. founder access: the owners skip the paywall on any device ──
{
  const pg = await (await browser.newContext()).newPage();
  await pg.goto("http://localhost:8155/today.html");
  const good = await pg.evaluate(async () => {
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "T", childAge: "7", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 30 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
    const r = await Sona.founderUnlock("OWNER-SECRET-123");
    return { valid: r.valid, founder: Sona.isFounder(), gated: Sona.gated() };
  });
  ok("the founder key unlocks", good.valid && good.founder, JSON.stringify(good));
  ok("a founder with a month-dead trial is never gated", good.gated === false);
  const bad = await pg.evaluate(async () => {
    localStorage.removeItem("sona.founder");
    const r = await Sona.founderUnlock("WRONG");
    return { valid: r.valid, founder: Sona.isFounder(), gated: Sona.gated() };
  });
  ok("a wrong founder key unlocks nothing", !bad.valid && !bad.founder, JSON.stringify(bad));
  // the ?founder= URL path verifies too
  await pg.goto("http://localhost:8155/today.html?founder=OWNER-SECRET-123");
  await pg.waitForTimeout(600);
  const viaUrl = await pg.evaluate(() => Sona.isFounder());
  ok("?founder=KEY unlocks via the URL", viaUrl === true);
  await pg.context().close();
}

// ── 6. source contracts on the server side ──
{
  const redeem = readFileSync(ROOT + "/../app/api/slp/redeem/route.ts", "utf8");
  ok("redeem fails CLOSED without KV", /status: 503/.test(redeem), "no KV must never be a free pass");
  ok("redeem is rate limited per IP", /rateLimit\(req/.test(redeem));
  ok("key comparison is constant-time", /safeEqualStr/.test(redeem));
  ok("the unauthenticated register oracle is DELETED", !existsSync(ROOT + "/../app/api/slp/register/route.ts"),
    "it minted forever-shareable free access from any anonymous request");
  const account = readFileSync(ROOT + "/../app/api/slp/account/route.ts", "utf8");
  ok("the ONLY credential mint is behind the session (auth-gated account route)",
    /readSession\(req\)/.test(account) && /makeFamilyKey/.test(account));
  // 24 Sep 2026: the cap is no longer one number. A code whose caseload is
  // covered (the clinician pays for "Sona Premium for your caseload", or was
  // grandfathered from "free forever, every kid on your caseload") may bring
  // COVERED_REDEEM_CAP (300) families; every other code keeps REDEEM_CAP (60).
  // The promise this pin guards is unchanged — a leaked link still dies at N —
  // so it now asks that N is one of those two and nothing else.
  // tests/caseloadtest.mjs drives both caps against the real route.
  ok("redeem enforces a per-code redemption CAP (a leaked link dies at N)",
    /const REDEEM_CAP = 60;/.test(redeem) && /const cap = isCovered \? COVERED_REDEEM_CAP : REDEEM_CAP;/.test(redeem) && /n > cap\b/.test(redeem));
  ok("redeem no longer has the DoS-prone per-code failure freeze",
    !/slpredeemfail/.test(redeem), "a passer-by fat-fingering the key must not lock out the caseload");
  ok("redeem resolves the account even for an unknown code (timing-flat)",
    /slpacct: none/.test(redeem) || /acctKey = owner/.test(redeem));
  const rl = readFileSync(ROOT + "/../lib/rateLimit.ts", "utf8");
  ok("rate limiter prefers un-spoofable x-real-ip over client XFF",
    /x-real-ip[\s\S]{0,120}if \(real\) return real/.test(rl) && /fwd\[fwd\.length - 1\]/.test(rl));
  const ob2 = readFileSync(ROOT + "/onboarding.html", "utf8");
  ok("SLP onboarding fires the magic link, not an unauthenticated mint",
    /api\/slp\/auth\/request/.test(ob2) && !/api\/slp\/register/.test(ob2));
  ok("a child's name is never shipped to the CRM for an SLP signup",
    /isSlp[\s\S]{0,200}role:"slp"/.test(ob2) && /New SLP signup/.test(ob2));
  ok("SLP share links point at /join.html, never the analytics-loading '/'",
    /\/join\.html\?slp=/.test(readFileSync(ROOT + "/settings.html", "utf8")));
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  ok("the funnel event fires only on a VALID redemption",
    /valid[\s\S]{0,700}track\("slp code redeemed"/.test(sona),
    "counting unverified codes ranks garbage SLPs");
  // NO SWITCH-VALUE PIN HERE ANY MORE. It flipped three times in this file and
  // each flip was pure tax: the business decision is Travis's, and a test that
  // has to be hand-edited to record it guards nothing. What this suite
  // actually cares about is that the SLP promise survives the switch in either
  // direction.
  // REWRITTEN 24 Sep 2026. This pinned `if (slpVerified()) return false;` in
  // the gate: "a verified SLP referral clears the gate". The promise moved,
  // deliberately. A clinician's families get Premium because the SERVER says
  // their caseload is covered (a paid plan, or a clinician grandfathered from
  // "free forever"), and every device that redeemed before this build keeps
  // it through the era-four sweep. Pinned from both sides: the credential is
  // not Premium by itself, coverage is, and the sweep reads the credential.
  {
    const prem = (sona.match(/function premium\(\) \{[\s\S]*?\n  \}/) || [""])[0];
    const era4 = (sona.match(/function _grandfatherFreeEra4\(\) \{[\s\S]*?\n  \}/) || [""])[0];
    ok("a verified credential is not Premium by itself — coverage is",
      !!prem && !/slpVerified\(\)/.test(prem) && /caseCovered\(\)/.test(prem),
      "a link proves a family belongs to a caseload; whether the caseload includes Premium is the clinician's plan");
    ok("…and every device that redeemed before this build is kept by the era-four sweep",
      /sona\.slpok/.test(era4) && /sona\.slpunlock/.test(era4) && /earlyAdopter = true/.test(era4),
      "until this build a redemption WAS free-forever access — those families keep it");
    ok("coverage is asked of the server with the ticket, and only an answer changes it",
      /fetch\("\/api\/slp\/covered"/.test(sona) && /j\.ok === true && typeof j\.covered === "boolean"/.test(sona));
  }
  ok("every family from the free era keeps it free",
    /function _grandfatherFreeEra[\s\S]{0,700}earlyAdopter = true/.test(sona),
    "grandfathering is a promise to those families, not a growth tactic");
  ok("joining a caseload requires CONSENT and actually enrols (startPilot)",
    /function slpJoinCaseload[\s\S]{0,360}startPilot\(/.test(sona) && /sendProgress\("enroll"\)/.test(sona),
    "sendProgress() no-ops without consent — link-joined families were invisible to their own SLP");
  const joinSrc = readFileSync(ROOT + "/join.html", "utf8");
  const joinCode = joinSrc.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  // REWRITTEN 24 Sep 2026: this demanded `earlyAdopter: true` between the
  // valid redeem and the consent question. The ORDER is the promise and it
  // stands — access is settled before sharing is asked, and asking coverage
  // needs no consent — but the grant written there is gone.
  ok("join.html settles access BEFORE it asks about sharing, and writes no founding grant",
    /r\.valid[\s\S]{0,700}askConsent\(/.test(joinCode) && /Sona\.caseRefresh\(true\)/.test(joinCode) && !/earlyAdopter/.test(joinCode),
    "consent must never be the price of access");
  ok("join.html's email box is optional, after the sharing answer, and carries the list line",
    /jYes[\s\S]{0,400}askEmail\(\)/.test(joinCode) && /jNo[\s\S]{0,500}askEmail\(\)/.test(joinCode) &&
    /We'll also send occasional tips from Rachel\. Unsubscribe anytime\./.test(joinSrc));
  ok("join.html only enrols behind an explicit Yes",
    /jYes[\s\S]{0,200}slpJoinCaseload/.test(joinSrc) && /jNo/.test(joinSrc));
  // 24 Sep 2026: the profile strip now removes every free-era mark a sweep
  // writes (ERA_MARKS), not just earlyAdopter — same promise, whole set.
  ok("a backup can never carry entitlement",
    /const NO_IMPORT = \[/.test(sona) && /sona\.sub\.v1/.test(sona) && /const ERA_MARKS = \["earlyAdopter"/.test(sona) && /delete p\[m\]/.test(sona),
    "importData wrote any sona.* key verbatim — a backup code was a paste-in paywall bypass");
  {
    // REWRITTEN 24 Sep 2026: this pinned the ticket ON the list. It travels
    // now — the iOS app's separate storage has no other bridge (4h-ii) — so
    // the pin is the other half: the cached ANSWER, the unlock flag, the
    // founding mark and every free-era stamp stay off the list's far side,
    // and an import that carries a ticket asks the server straight away.
    const noImport = (sona.match(/const NO_IMPORT = \[[^\]]*\]/) || [""])[0];
    ok("…including cached caseload coverage, the unlock flag, the founding mark and every free-era stamp",
      ["sona.caseplan.v1", "sona.slpunlock", "sona.founding.v1", "sona.freeera.v1", "sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1"].every((k) => noImport.includes('"' + k + '"')), noImport);
    ok("…while the ticket travels, and is re-verified the moment it lands",
      !/"sona\.slpticket"/.test(noImport) && /if \(ticket\) \{ try \{ caseRefresh\(true\); \} catch/.test(sona), noImport);
  }
  const pilotSrc = readFileSync(ROOT + "/../app/api/pilot/route.ts", "utf8");
  // This used to pin `verifyTicket(ticket, code)` BY NAME, which quietly
  // locked in the weaker check: verifyTicket is a clinic-wide boolean and
  // cannot say whose row a write belongs to. The route now reads the ticket.
  // Pin the guarantee — an unauthenticated write is refused — not the helper.
  ok("the roster route authenticates the write",
    /readTicket\(ticket, code\)/.test(pilotSrc) && /status: 401/.test(pilotSrc),
    "any POST that named a code could invent a child on a real clinician's dashboard");
  ok("the roster route is rate limited", /rateLimit\(req/.test(pilotSrc));
  ok("a leaked credential can't invent a thousand children", /ROSTER_CAP/.test(pilotSrc) && /HEXISTS/.test(pilotSrc),
    "an UPDATE to a known child must still pass, or the cap freezes a real family");
  const authSrc = readFileSync(ROOT + "/../lib/slpAuth.ts", "utf8");
  ok("a clinician's session cookie can't be replayed as a family ticket",
    /t !== "enrol"/.test(authSrc) && /timingSafeEqual/.test(authSrc));
  // REWRITTEN 24 Sep 2026 (both). The gate honoured the bare device unlock,
  // and onboarding wrote earlyAdopter from slpVerified(). Neither grants now:
  // the device-wide grant is coverage (4c pins it surviving a kid switch), and
  // onboarding must write no earlyAdopter at all — true would grant what only
  // coverage may, false would revoke what the era-four sweep already gave.
  {
    const g = (sona.match(/function gated\(\w*\) \{[\s\S]*?\n  \}/) || [""])[0];
    ok("gated() no longer reads the SLP unlock — it asks premium()",
      !!g && !/slpVerified\(\)/.test(g) && /premium\(\)/.test(g), g.slice(0, 200));
  }
  const ob = readFileSync(ROOT + "/onboarding.html", "utf8");
  const obCode = ob.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  ok("onboarding writes no founding grant, in either direction",
    !/earlyAdopter\s*:/.test(obCode), (obCode.match(/[^\n]*earlyAdopter\s*:[^\n]*/) || [""])[0]);
  const founder = readFileSync(ROOT + "/../app/api/founder/route.ts", "utf8");
  ok("founder unlock fails CLOSED when unconfigured", /status: 503/.test(founder));
  ok("founder unlock is rate limited", /rateLimit\(req/.test(founder));
  ok("founder key comparison is constant-time", /timingSafeEqual/.test(founder));
}

// One more than before: the sibling block opens join.html to enrol a real
// family before adding the second child. The point of this cap is that no
// code path redeems in a loop, not the exact number. 24 Sep 2026: three more
// deliberate redemptions — section 1 now runs for a covered AND an uncovered
// clinician, plus the uncovered join and the clinician's own-phone link. And
// three more the same day: two source devices whose backups cross to the
// app (4h-ii), and the founding family who joins a clinician (4h-iv).
ok("no unexpected redeem spam", redeemCalls <= 14, String(redeemCalls));
// THE LIMIT MESSAGE HAS TO REACH THE FAMILY (24 Sep 2026). The redeem route
// answers a full link with "…ask your speech therapist to contact Sona" and a
// down store with "try again soon"; join and pilot used to print "That code
// and key don't match" for every failure, which sent a parent back to check a
// key that was right.
{
  const joinPage = readFileSync(ROOT + "/join.html", "utf8"), pilotPage = readFileSync(ROOT + "/pilot.html", "utf8");
  ok("join.html shows the server's own reason when it gave one, and 'don't match' only otherwise",
    /typeof r\.error === "string" && r\.error \? r\.error : "That code and key don't match/.test(joinPage));
  ok("pilot.html does the same",
    /typeof r\.error==="string"&&r\.error \? r\.error : "That code and key don’t match/.test(pilotPage));
}
await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
