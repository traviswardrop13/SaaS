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
      res.end(JSON.stringify({ ok: true, valid, name: valid ? CRED.name : undefined }));
    });
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
    Sona.saveProfile({ childName: "Ana", childAge: "6", focusSounds: ["S"], onboarded: true, earlyAdopter: false });
    localStorage.setItem(Sona.kkey("sona.trial.v1"), JSON.stringify({ start: Date.now() - 10 * 86400000, days: 3 }));
    return Sona.gated();
  });
  ok("wrong-key family gates like anyone else after the trial", gated === true);
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
  await pg.goto("http://localhost:8155/trial.html");
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
  ok("a wrong founder key unlocks nothing", !bad.valid && !bad.founder && bad.gated === true, JSON.stringify(bad));
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
  ok("pricing is live — FREE_MODE is the one switch and it is OFF",
    /const FREE_MODE = false;/.test(sona), "a stray true here silently makes the whole app free");
  ok("joining a caseload requires CONSENT and actually enrols (startPilot)",
    /function slpJoinCaseload[\s\S]{0,360}startPilot\(/.test(sona) && /sendProgress\("enroll"\)/.test(sona),
    "sendProgress() no-ops without consent — link-joined families were invisible to their own SLP");
  const joinSrc = readFileSync(ROOT + "/join.html", "utf8");
  ok("join.html grants the unlock BEFORE it asks about sharing",
    /r\.valid[\s\S]{0,300}earlyAdopter: true[\s\S]{0,200}askConsent\(/.test(joinSrc),
    "consent must never be the price of access");
  ok("join.html only enrols behind an explicit Yes",
    /jYes[\s\S]{0,200}slpJoinCaseload/.test(joinSrc) && /jNo/.test(joinSrc));
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
