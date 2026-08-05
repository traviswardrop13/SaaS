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
  if (u.pathname === "/api/slp/register" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let j = {};
      try { j = JSON.parse(body); } catch {}
      res.writeHead(200, { "content-type": "application/json" });
      if (String(j.email || "") === "taken@example.com") res.end(JSON.stringify({ ok: true, existing: true }));
      else res.end(JSON.stringify({ ok: true, code: "zoe-m7", familyKey: "NEWKEY99" }));
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

// ── 4. typed entry on the trial page unlocks with the right credential ──
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
  const entry = await pg.evaluate(() => {
    document.getElementById("slpEntryLink").click();
    return getComputedStyle(document.getElementById("slpEntry")).display !== "none";
  });
  ok("the trial page offers the SLP credential entry", entry);
  await pg.evaluate(() => {
    document.getElementById("slpEnCode").value = "rachel-k4";
    document.getElementById("slpEnKey").value = "RACHELKEY";
    document.getElementById("slpEnGo").click();
  });
  await pg.waitForTimeout(700);
  const after = await pg.evaluate(() => ({
    msg: document.getElementById("slpEnMsg").textContent,
    early: (JSON.parse(localStorage.getItem("sona.profile.v1") || "{}")).earlyAdopter,
  }));
  ok("typed credential unlocks and names the SLP", /free/i.test(after.msg) && /Rachel/.test(after.msg), after.msg);
  ok("the unlock is saved to the profile", after.early === true);
  // and the wrong key gets an honest no
  await pg.goto("http://localhost:8155/trial.html");
  await pg.waitForTimeout(500);
  await pg.evaluate(() => {
    localStorage.removeItem("sona.slpok");
    const p = JSON.parse(localStorage.getItem("sona.profile.v1")); p.earlyAdopter = false;
    localStorage.setItem("sona.profile.v1", JSON.stringify(p));
    document.getElementById("slpEntryLink").click();
    document.getElementById("slpEnCode").value = "rachel-k4";
    document.getElementById("slpEnKey").value = "NOPE12345";
    document.getElementById("slpEnGo").click();
  });
  await pg.waitForTimeout(700);
  const bad = await pg.evaluate(() => ({
    msg: document.getElementById("slpEnMsg").textContent,
    early: (JSON.parse(localStorage.getItem("sona.profile.v1") || "{}")).earlyAdopter,
  }));
  ok("a wrong key is told the truth and unlocks nothing", /don.t match/i.test(bad.msg) && bad.early === false, bad.msg);
  await ctx.close();
}

// ── 5. source contracts on the server side ──
{
  const redeem = readFileSync(ROOT + "/../app/api/slp/redeem/route.ts", "utf8");
  ok("redeem fails CLOSED without KV", /status: 503/.test(redeem), "no KV must never be a free pass");
  ok("redeem is rate limited per IP", /rateLimit\(req/.test(redeem));
  ok("redeem freezes a brute-forced code", /slpredeemfail:/.test(redeem) && /429/.test(redeem));
  ok("key comparison is constant-time", /safeEqualStr/.test(redeem));
  const reg = readFileSync(ROOT + "/../app/api/slp/register/route.ts", "utf8");
  ok("register never returns an existing SLP's credential",
    /existing: true \}\);/.test(reg) && reg.indexOf("familyKey") > reg.indexOf("existing: true"),
    "anyone knowing an SLP's email could steal their key otherwise");
  ok("register codes are auto-generated, never caller-chosen", !/body\.code/.test(reg));
  ok("register is rate limited", /rateLimit\(req/.test(reg));
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  ok("the funnel event fires only on a VALID redemption",
    /valid[\s\S]{0,600}track\("slp code redeemed"/.test(sona) && !/fresh\) \{ try \{ track\("slp code redeemed"/.test(sona),
    "counting unverified codes ranks garbage SLPs");
  const ob = readFileSync(ROOT + "/onboarding.html", "utf8");
  ok("onboarding grants founding only when verified", /earlyAdopter: _slpok/.test(ob));
}

ok("no unexpected redeem spam", redeemCalls <= 6, String(redeemCalls));
await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
