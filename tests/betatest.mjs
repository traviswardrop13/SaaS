// Beta feedback loop: onboarding survey step, pulse cadence, banner swap, API posts.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, OUT, launchOpts } from "./_env.mjs";
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", png: "image/png", css: "text/css" };
let fbPosts = [];
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/feedback" && req.method === "POST") {
    let b = ""; req.on("data", (c) => (b += c));
    req.on("end", () => { try { fbPosts.push(JSON.parse(b)); } catch (e) {} res.writeHead(200, { "content-type": "application/json" }); res.end('{"ok":true}'); });
    return;
  }
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8129, r));
const browser = await chromium.launch(launchOpts());
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
let errs = [];
page.on("pageerror", (e) => errs.push(e.message));
let fails = 0;
const ok = (n, p) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n); };

// ── onboarding: slim flow — 8 steps, Pip preselected, achieve as finale ──
await page.evaluate(() => localStorage.setItem("sona.slp", "RACHEL1")).catch(() => {});
await page.goto("http://localhost:8129/onboarding.html?slp=RACHEL1");
await page.waitForTimeout(900);
const ob = await page.evaluate(() => ({
  betaStep: !!document.querySelector('[data-step="beta"]'),
  segs: document.querySelectorAll("#seg i").length,
  preselected: !!document.querySelector("#obBuddies .bopt.on"),
}));
ok("beta step removed", !ob.betaStep);
ok("8 progress segments", ob.segs === 8);
ok("buddy preselected (Pip)", ob.preselected);
// real walk: click through every step to finish()
const clickNext = async () => { await page.evaluate(() => document.getElementById("nextBtn").click()); await page.waitForTimeout(250); };
await clickNext(); // welcome →
await page.evaluate(() => { document.getElementById("obName").value = "Milo"; });
await clickNext(); // name →
await clickNext(); // buddy →
await clickNext(); // interests →
await clickNext(); // sounds →
await page.evaluate(() => document.querySelector('#obGoal .choice[data-val="3"]').click());
await clickNext(); // goal →
await clickNext(); // slp →
await page.evaluate(() => { document.getElementById("obEmail").value = "mom@example.com"; });
await clickNext(); // email → finish()
await page.waitForTimeout(500);
const fin = await page.evaluate(() => ({
  achieveShown: document.querySelector('[data-step="achieve"]').classList.contains("on"),
  achName: document.getElementById("achName").textContent,
  cta: document.getElementById("nextBtn").textContent,
}));
ok("achieve finale shows after email", fin.achieveShown && fin.achName === "Milo");
ok("CTA says Let's practice", /Let's practice/.test(fin.cta));
const prof = await page.evaluate(() => JSON.parse(localStorage.getItem("sona.profile.v1") || "{}"));
ok("SLP-referred → founding access + weeklyGoal", prof.earlyAdopter === true && prof.slpCode === "RACHEL1" && prof.weeklyGoal === 3);
ok("onboarding no pageerrors", errs.length === 0);

// ── pulse: shows on 3rd visit for early adopters, X snoozes, answers post ──
fbPosts = []; errs = [];
await page.addInitScript(() => {
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", focusSounds: ["R"], earlyAdopter: true }));
});
await page.goto("http://localhost:8129/today.html"); await page.waitForTimeout(600); // visit 1
let vis = await page.evaluate(() => document.getElementById("pulseOvl").classList.contains("show"));
ok("no pulse on visit 1", !vis);
await page.goto("http://localhost:8129/today.html"); await page.waitForTimeout(600); // visit 2
await page.goto("http://localhost:8129/today.html"); await page.waitForTimeout(1500); // visit 3
vis = await page.evaluate(() => document.getElementById("pulseOvl").classList.contains("show"));
ok("pulse shows on visit 3", vis);
const q1 = await page.evaluate(() => document.getElementById("pulseQ").textContent);
console.log("      Q:", q1);
await page.screenshot({ path: OUT + "/beta-pulse.png" });
// type into the open box and send
await page.evaluate(() => { document.getElementById("pulseText").value = "please add a dragon game"; document.getElementById("pulseSend").click(); });
await page.waitForTimeout(500);
ok("pulse open-box posted", fbPosts.length === 1 && fbPosts[0].src === "pulse" && fbPosts[0].q === "pulse.open" && /dragon game/.test(fbPosts[0].text));
vis = await page.evaluate(() => document.getElementById("pulseOvl").classList.contains("show"));
ok("pulse closes after answer", !vis);
// banner
const banner = await page.evaluate(() => ({ show: getComputedStyle(document.getElementById("trialBanner")).display !== "none", txt: document.getElementById("trialMsg").textContent }));
ok("founding banner shows (kid-safe copy)", banner.show && /building Sona with us/.test(banner.txt) && !/\$/.test(banner.txt));
console.log("      banner:", banner.txt);
// banner tap opens pulse (force)
await page.evaluate(() => document.getElementById("trialBanner").click());
vis = await page.evaluate(() => document.getElementById("pulseOvl").classList.contains("show"));
ok("banner tap opens pulse", vis);
// X dismisses + snoozes
await page.evaluate(() => document.getElementById("pulseX").click());
vis = await page.evaluate(() => document.getElementById("pulseOvl").classList.contains("show"));
ok("X dismisses", !vis);
const snooze = await page.evaluate(() => JSON.parse(localStorage.getItem("sona.pulse.v1")).snooze);
ok("X snoozes future visits", snooze >= 8);
ok("today no pageerrors", errs.length === 0);

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
