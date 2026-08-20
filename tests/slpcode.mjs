// CODES1: the SLP family credential — code ("username") + family key
// ("password"), auto-created for the clinician, verified server-side before
// anything unlocks. With pricing LIVE this is the wall between "typed a
// string" and "skips the paywall": the old ?slp= honor system granted free
// access to ANY code, so the thing under test here is that only a credential
// the server vouches for unlocks — and that a wrong key genuinely doesn't.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

// mock API: one registered SLP (rachel-k4 / RACHELKEY) with real semantics
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp" };
const CRED = { code: "rachel-k4", key: "RACHELKEY", name: "Rachel W" };
let redeemCalls = 0;
const pilotPosts = [];
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
      const code = String(j.code || "").trim().toLowerCase();
      const key = String(j.key || "").trim().toUpperCase();
      const valid = code === CRED.code && key === CRED.key;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, valid, name: valid ? CRED.name : undefined, ticket: valid ? "TESTTICKET" : undefined }));
    });
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

// ── 1. a VALID link (?slp=CODE&k=KEY) verifies and unlocks, forever ──
{
  const pg = await (await browser.newContext()).newPage();
  await pg.goto("http://localhost:8155/onboarding.html?slp=rachel-k4&k=RACHELKEY");
  await pg.waitForTimeout(900);
  const st = await pg.evaluate(() => ({
    ok: localStorage.getItem("sona.slpok"),
    code: localStorage.getItem("sona.slp"),
    verified: Sona.slpVerified(),
  }));
  ok("a valid link verifies against the server", st.ok === "RACHEL-K4" && st.verified, JSON.stringify(st));
  // finish onboarding as a parent: founding access sticks
  await pg.evaluate(() => {
    Sona.saveProfile({ childName: "Milo", childAge: "7", focusSounds: ["R"], onboarded: true });
  });
  // the link arrived BEFORE onboarding; finish() reads slpVerified — simulate
  // the exact grant the onboarding flow performs
  const granted = await pg.evaluate(() => {
    if (Sona.slpVerified()) Sona.saveProfile({ earlyAdopter: true, slpCode: Sona.slpCode() });
    // expire the trial hard: a founding family must never gate
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 10 * 86400000, days: 3 }));
    return { early: Sona.getProfile().earlyAdopter, gated: Sona.gated() };
  });
  ok("verified family gets founding access", granted.early === true);
  ok("founding family with a dead trial is never gated", granted.gated === false);
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
    // Sona is free, so nobody gates today. What must stay true is that a wrong
    // key buys no standing OF ITS OWN — checked through the ?paid=1 seam so an
    // unverified family is still ordinary on the day pricing returns.
    sessionStorage.setItem("sona.paidui", "1");
    Sona.saveProfile({ childName: "Ana", childAge: "6", focusSounds: ["S"], onboarded: true, earlyAdopter: false });
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 10 * 86400000, days: 3 }));
    return Sona.gated();
  });
  ok("wrong-key family gates like anyone else once pricing returns", gated === true);
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
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 10 * 86400000, days: 3 }));
  });
  // ?paid=1 renders the paywall while Sona is free; without it trial.html
  // correctly bounces home and there is no paywall to point anywhere.
  await pg.goto("http://localhost:8155/trial.html?paid=1");
  await pg.waitForTimeout(600);
  const href = await pg.evaluate(() => {
    const a = document.getElementById("slpEntryLink");
    return a ? a.getAttribute("href") : null;
  });
  ok("a gated family is offered the SLP route off the paywall", /join\.html/.test(href || ""), String(href));
  ok("the trial page no longer runs its own copy of the redeem fetch",
    !/slpEnGo/.test(readFileSync(ROOT + "/trial.html", "utf8")),
    "duplicated unlock logic is how a paywall hole gets reopened by accident");
  ok("subscribe.html routes to the same one surface",
    /join\.html/.test(readFileSync(ROOT + "/subscribe.html", "utf8")) && !/subSlpGo/.test(readFileSync(ROOT + "/subscribe.html", "utf8")));
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
    pilot: Sona.isPilot(),
    consentShown: getComputedStyle(document.getElementById("jConsent")).display !== "none",
    loc: location.href,
  }));
  ok("join.html verifies the link's credential and unlocks the device", st.unlocked === "1" && st.verified, JSON.stringify(st));
  ok("join.html strips ?k from the URL immediately", !/[?&]k=/.test(st.loc), st.loc);
  // ACCESS AND SURVEILLANCE ARE SEPARATE. The unlock is already granted here;
  // sharing progress is a second, freely-refusable question.
  ok("the unlock lands before the family is asked anything", st.early === true, JSON.stringify(st));
  ok("but nothing is shared until they say so", st.pilot === false, JSON.stringify(st));
  ok("join.html asks the grown-up about sharing", st.consentShown, JSON.stringify(st));
  const yes = await pg.evaluate(() => {
    document.getElementById("jYes").click();
    return { pilot: Sona.isPilot(), code: (Sona.pilotInfo() || {}).code, share: Sona.getProfile().slpShare, gated: Sona.gated() };
  });
  ok("saying yes puts the child on the SLP's dashboard", yes.pilot === true && yes.code === "RACHEL-K4", JSON.stringify(yes));
  ok("saying yes records the consent on the profile", yes.share === true);
  ok("saying yes keeps the family unlocked", yes.gated === false);
  // the family key must never appear in a request URL (pixel/analytics leak)
  // the initial navigation the family tapped carries the key (unavoidable);
  // the leak that matters is a SUBSEQUENT request (analytics/pixel/api) with it.
  const leaked = urls.filter((u) => /RACHELKEY/.test(u) && !u.startsWith("http://localhost:8155/join.html"));
  ok("the family key never rides a follow-on request URL", leaked.length === 0, leaked.join(" "));
  // join.html must not load the ad/analytics scripts at all
  ok("join.html loads no pixel or analytics", !urls.some((u) => /pixel\.js|analytics\.js/.test(u)), urls.filter((u) => /pixel|analytics/.test(u)).join(" "));
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
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 40 * 86400000, days: 3 }));
    return { pilot: Sona.isPilot(), share: Sona.getProfile().slpShare, gated: Sona.gated() };
  });
  ok("saying no never enrols the child", no.pilot === false, JSON.stringify(no));
  ok("saying no records the refusal", no.share === false);
  ok("saying no still leaves the family unlocked, trial dead and all", no.gated === false, JSON.stringify(no));
  await ctx.close();
}

// ── 4b-iii. a family who redeemed during the free window is NOT locked out ──
// FREE1 wrote only "sona.slpok"; PRICE3 gates on the credential again. If
// slpVerified() read slpunlock alone these families would hit a paywall their
// clinician already paid the price of — and could not heal it by re-opening
// their own link, because auto-verify skips a code whose slpok already matches.
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8155/today.html");
  const res = await pg.evaluate(() => {
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Nia", childAge: "6", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.slpok", "RACHEL-K4");   // exactly what FREE1 left behind
    localStorage.removeItem("sona.slpunlock");
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 40 * 86400000, days: 3 }));
    return { verified: Sona.slpVerified(), gated: Sona.gated() };
  });
  ok("a free-window SLP family still counts as verified", res.verified === true, JSON.stringify(res));
  ok("and is never sent to the paywall", res.gated === false, JSON.stringify(res));
  await ctx.close();
}

// ── 4c. device unlock survives a kid switch (the caseload iPad) ──
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8155/today.html");
  const res = await pg.evaluate(() => {
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "A", childAge: "6", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.slpunlock", "1");
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 30 * 86400000, days: 3 }));
    const before = Sona.gated();
    Sona.addKid("Bee", "5"); // fresh profile, no earlyAdopter
    const afterSwitch = Sona.gated();
    return { before, afterSwitch };
  });
  ok("device SLP unlock keeps every kid free (survives a switch)", res.before === false && res.afterSwitch === false, JSON.stringify(res));
  await ctx.close();
}

// ── 4d. the founding grant belongs to the household, not one child ──
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8155/today.html");
  const res = await pg.evaluate(() => {
    Sona.saveProfile({ childName: "Kid One", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true });
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 40 * 86400000, days: 3 }));
    const first = Sona.gated();
    Sona.addKid("Kid Two", "5");                       // sibling on the same device
    const kid2 = Sona.kids().filter((k) => !k.active)[0] || Sona.kids()[1];
    Sona.switchKid(Sona.kids().filter((k) => k.name === "Kid Two")[0].slot);
    Sona.saveProfile({ childName: "Kid Two", childAge: "5", focusSounds: ["S"], onboarded: true });
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 40 * 86400000, days: 3 }));
    return { first, second: Sona.gated(), name: Sona.getProfile().childName, early2: Sona.getProfile().earlyAdopter, kid2: !!kid2 };
  });
  ok("the referred family's first child is free", res.first === false, JSON.stringify(res));
  ok("the sibling's own profile carries no grant (per-kid storage)", !res.early2, JSON.stringify(res));
  ok("but the sibling is NOT paywalled — access is the household's", res.second === false, JSON.stringify(res));
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
  ok("the success page grants NOTHING before Stripe confirms the session",
    /if \(!j \|\| !j\.ok\) return;[\s\S]{0,900}sona\.sub\.v1[\s\S]{0,200}active: true/.test(succ),
    "writing the entitlement on mount made the URL itself a free subscription");
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
      "sona.profile.v1": JSON.stringify({ childName: "Restored", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true }),
      "sona.progress.v1": JSON.stringify({ totals: { coins: 99 }, stage: {}, sessions: [], missed: [] }),
    } });
    const r = Sona.importData(forged);
    return {
      r,
      subscribed: Sona.isSubscribed(), slp: Sona.slpVerified(), founder: Sona.isFounder(),
      pilot: Sona.isPilot(), early: Sona.getProfile().earlyAdopter,
      name: Sona.getProfile().childName, coins: Sona.getCoins(),
    };
  });
  ok("the import succeeds — a real family's backup still works", res.r.ok === true, JSON.stringify(res.r));
  ok("a forged backup buys no subscription", res.subscribed === false, JSON.stringify(res));
  ok("…no SLP unlock", res.slp === false, JSON.stringify(res));
  ok("…no founder key", res.founder === false, JSON.stringify(res));
  ok("…no pilot enrolment", res.pilot === false, JSON.stringify(res));
  ok("…and no earlyAdopter smuggled inside the profile", !res.early, JSON.stringify(res));
  ok("but the child's real progress DOES restore", res.name === "Restored" && res.coins === 99, JSON.stringify(res));
  ok("the entitlement keys are reported as skipped, not silently dropped", (res.r.skipped | 0) >= 5, JSON.stringify(res.r));
  await ctx.close();
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
  ok("a verified redeem hands the device an enrolment ticket", held === "TESTTICKET", String(held));
  await pg.evaluate(() => document.getElementById("jYes").click());
  await pg.waitForTimeout(700);
  ok("the enrolment write carries the ticket",
    pilotPosts.length > 0 && pilotPosts.every((b) => b.ticket === "TESTTICKET"), JSON.stringify(pilotPosts.map((b) => b.ticket)));

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

// ── 5. founder access: the owners skip the paywall on any device ──
{
  const pg = await (await browser.newContext()).newPage();
  await pg.goto("http://localhost:8155/today.html");
  const good = await pg.evaluate(async () => {
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "T", childAge: "7", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 30 * 86400000, days: 3 }));
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
  ok("redeem enforces a per-code redemption CAP (a leaked link dies at N)",
    /REDEEM_CAP/.test(redeem) && /n > REDEEM_CAP/.test(redeem));
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
  ok("Sona is free — FREE_MODE is the one switch and it is ON",
    /const FREE_MODE = true;/.test(sona), "a stray false here silently paywalls the whole app");
  ok("every family from the free era keeps it free",
    /function _grandfatherFreeEra[\s\S]{0,700}earlyAdopter = true/.test(sona),
    "grandfathering is a promise to those families, not a growth tactic");
  ok("joining a caseload requires CONSENT and actually enrols (startPilot)",
    /function slpJoinCaseload[\s\S]{0,360}startPilot\(/.test(sona) && /sendProgress\("enroll"\)/.test(sona),
    "sendProgress() no-ops without consent — link-joined families were invisible to their own SLP");
  const joinSrc = readFileSync(ROOT + "/join.html", "utf8");
  ok("join.html grants the unlock BEFORE it asks about sharing",
    /r\.valid[\s\S]{0,300}earlyAdopter: true[\s\S]{0,200}askConsent\(/.test(joinSrc),
    "consent must never be the price of access");
  ok("join.html only enrols behind an explicit Yes",
    /jYes[\s\S]{0,200}slpJoinCaseload/.test(joinSrc) && /jNo/.test(joinSrc));
  ok("a backup can never carry entitlement",
    /const NO_IMPORT = \[/.test(sona) && /sona\.sub\.v1/.test(sona) && /delete p\.earlyAdopter/.test(sona),
    "importData wrote any sona.* key verbatim — a backup code was a paste-in paywall bypass");
  const pilotSrc = readFileSync(ROOT + "/../app/api/pilot/route.ts", "utf8");
  ok("the roster route authenticates the write", /verifyTicket\(ticket, code\)/.test(pilotSrc) && /status: 401/.test(pilotSrc),
    "any POST that named a code could invent a child on a real clinician's dashboard");
  ok("the roster route is rate limited", /rateLimit\(req/.test(pilotSrc));
  ok("a leaked credential can't invent a thousand children", /ROSTER_CAP/.test(pilotSrc) && /HEXISTS/.test(pilotSrc),
    "an UPDATE to a known child must still pass, or the cap freezes a real family");
  const authSrc = readFileSync(ROOT + "/../lib/slpAuth.ts", "utf8");
  ok("a clinician's session cookie can't be replayed as a family ticket",
    /t !== "enrol"/.test(authSrc) && /timingSafeEqual/.test(authSrc));
  ok("gated() honors the device-wide SLP unlock",
    /if \(slpVerified\(\)\) return false;/.test(sona));
  const ob = readFileSync(ROOT + "/onboarding.html", "utf8");
  ok("onboarding grants founding only when verified", /earlyAdopter: _slpok/.test(ob));
  const founder = readFileSync(ROOT + "/../app/api/founder/route.ts", "utf8");
  ok("founder unlock fails CLOSED when unconfigured", /status: 503/.test(founder));
  ok("founder unlock is rate limited", /rateLimit\(req/.test(founder));
  ok("founder key comparison is constant-time", /timingSafeEqual/.test(founder));
}

ok("no unexpected redeem spam", redeemCalls <= 6, String(redeemCalls));
await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
