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
await page.goto("http://localhost:8129/onboarding.html?slp=RACHEL1");
await page.waitForTimeout(900);
// CODES1: founding access now requires the VERIFIED credential. sona.slpok is
// what a successful /api/slp/redeem writes — seeded post-load (about:blank has
// no localStorage) to simulate a family arriving through a valid CODE&k=KEY link.
await page.evaluate(() => { localStorage.setItem("sona.slpok", "RACHEL1"); localStorage.setItem("sona.slpunlock", "1"); });
const ob = await page.evaluate(() => ({
  betaStep: !!document.querySelector('[data-step="beta"]'),
  segs: document.querySelectorAll("#seg i").length,
  preselected: !!document.querySelector("#obBuddies .bopt.on"),
}));
ok("beta step removed", !ob.betaStep);
ok("10 progress segments (role + path steps)", ob.segs === 10);
ok("buddy preselected (Pip)", ob.preselected);
// real walk: click through every step to finish()
const clickNext = async () => { await page.evaluate(() => document.getElementById("nextBtn").click()); await page.waitForTimeout(250); };
await clickNext(); // welcome →
await page.evaluate(() => document.querySelector('#obRole .choice[data-val="parent"]').click());
await clickNext(); // role →
await page.evaluate(() => document.querySelector('#obPath .choice[data-val="speech"]').click());
await clickNext(); // path →
await page.evaluate(() => { document.getElementById("obName").value = "Milo"; });
await clickNext(); // name →
await clickNext(); // buddy →
await clickNext(); // interests →
await clickNext(); // sounds →
// the "building the plan" beat fires over the next step, named + non-blocking
const build = await page.evaluate(() => ({
  shown: !!document.querySelector("#obBuild.show"),
  txt: (document.getElementById("obBuild") || {}).textContent || "",
  passthru: getComputedStyle(document.getElementById("obBuild")).pointerEvents === "none",
}));
ok("sound-plan build beat shows (named, non-blocking)", build.shown && /Milo's sound plan/.test(build.txt) && build.passthru);
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

// ── email is the default ask but never a gate: "Skip for now" still finishes ──
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto("http://localhost:8129/onboarding.html"); await page.waitForTimeout(900);
const nameStep = await page.evaluate(() => document.querySelector('[data-step="name"]').textContent);
ok("name question carries justification microcopy", /cheers them on by name/.test(nameStep));
await clickNext(); // welcome →
await page.evaluate(() => document.querySelector('#obRole .choice[data-val="slp"]').click());
await clickNext(); // role → (this walk is an SLP — the play door is SKIPPED)
const slpSkip = await page.evaluate(() => ({
  onPath: document.querySelector('[data-step="path"]').classList.contains("on"),
  onName: document.querySelector('[data-step="name"]').classList.contains("on"),
}));
ok("an SLP never sees the play door", !slpSkip.onPath && slpSkip.onName, JSON.stringify(slpSkip));
await page.evaluate(() => { document.getElementById("obName").value = "Zoe"; });
await clickNext(); // name →
await clickNext(); // buddy →
await clickNext(); // interests →
// SOUNDS1: the picker is open for everyone (no SLP code) — add S next to R
const pickState = await page.evaluate(() => {
  const chips = [...document.querySelectorAll("#obSounds .sound")];
  chips.find((b) => b.textContent.trim() === "S").click();
  return { total: chips.length, soon: document.querySelectorAll("#obSounds .soon").length };
});
ok("every sound chip is open (no SOON)", pickState.total >= 15 && pickState.soon === 0);
await clickNext(); // sounds →
await page.evaluate(() => document.querySelector('#obGoal .choice[data-val="3"]').click());
await clickNext(); // goal →
await clickNext(); // slp →
// CODES1: an SLP can't skip email — the share credential IS the account
const slpSkipHidden = await page.evaluate(() => {
  const esk = document.getElementById("obEmailSkip");
  return getComputedStyle(esk.parentElement).display === "none";
});
ok("SLPs can't skip email (the credential needs it)", slpSkipHidden);
await page.evaluate(() => { document.getElementById("obEmail").value = "slp@example.com"; });
await page.evaluate(() => document.getElementById("nextBtn").click()); // email → finish()
await page.waitForTimeout(500);
const skipFin = await page.evaluate(() => ({
  achieveShown: document.querySelector('[data-step="achieve"]').classList.contains("on"),
  cred: !!document.getElementById("obSlpCred"),
  prof: JSON.parse(localStorage.getItem("sona.profile.v1") || "{}"),
}));
ok("SLP finish lands on the finale with the credential slot", skipFin.achieveShown && skipFin.cred && skipFin.prof.onboarded === true && skipFin.prof.childName === "Zoe");
ok("open sound picker: S saved next to R", (skipFin.prof.focusSounds || []).includes("S") && (skipFin.prof.focusSounds || []).includes("R"));
ok("role is captured (SLP)", skipFin.prof.role === "slp", JSON.stringify(skipFin.prof.role));

// ── PLAY1: the play door — no sound picker, every sound, easiest first ──
// The niece case: a kid who doesn't need speech help still gets the games.
// The picker IS the clinical framing, so the play path must never show it.
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto("http://localhost:8129/onboarding.html"); await page.waitForTimeout(900);
await clickNext(); // welcome →
await page.evaluate(() => document.querySelector('#obRole .choice[data-val="parent"]').click());
await clickNext(); // role →
await page.evaluate(() => document.querySelector('#obPath .choice[data-val="play"]').click());
await clickNext(); // path →
await page.evaluate(() => { document.getElementById("obName").value = "Nora"; });
await clickNext(); // name →
await clickNext(); // buddy →
await clickNext(); // interests → (sounds is SKIPPED; the build beat fires here)
const playSkip = await page.evaluate(() => ({
  onSounds: document.querySelector('[data-step="sounds"]').classList.contains("on"),
  onGoal: document.querySelector('[data-step="goal"]').classList.contains("on"),
  build: (document.getElementById("obBuild") || {}).textContent || "",
}));
ok("play path skips the sound picker entirely", !playSkip.onSounds && playSkip.onGoal, JSON.stringify(playSkip));
ok("the build beat says play list, not sound plan", /Nora's play list/.test(playSkip.build), playSkip.build);
await clickNext(); // goal →
await clickNext(); // slp →
// parents can still skip email — never a gate for families
const parentSkipShown = await page.evaluate(() => getComputedStyle(document.getElementById("obEmailSkip").parentElement).display !== "none");
ok("parents can still skip email (no gate)", parentSkipShown);
await page.evaluate(() => document.getElementById("obEmailSkip").click());
await page.waitForTimeout(500);
const playProf = await page.evaluate(() => JSON.parse(localStorage.getItem("sona.profile.v1") || "{}"));
ok("email skip still finishes onboarding", playProf.onboarded === true && playProf.email === "");
ok("play mode is recorded", playProf.mode === "play", playProf.mode);
ok("play rotation covers every sound", (playProf.focusSounds || []).length === 19, String((playProf.focusSounds || []).length));
ok("easiest sounds first, R last", playProf.focusSounds[0] === "P" && playProf.focusSounds[18] === "R", JSON.stringify([playProf.focusSounds[0], playProf.focusSounds[18]]));

// the home greeting drops the clinical framing, and the Sound Check nudge stays hidden
await page.goto("http://localhost:8129/today.html"); await page.waitForTimeout(700);
const playHome = await page.evaluate(() => ({
  sub: document.getElementById("subLine").textContent,
  nudge: getComputedStyle(document.getElementById("checkNudge")).display,
  firstSound: Sona.rotSound(),
}));
ok("play greeting talks about games, not a target sound", /talking games/i.test(playHome.sub), playHome.sub);
ok("the Sound Check nudge stays hidden in play mode", playHome.nudge === "none", playHome.nudge);
ok("the rotation starts on the easiest sound", playHome.firstSound === "P", playHome.firstSound);

// Settings: the play note shows, and hand-picking sounds moves to focus mode
await page.evaluate(() => { try { Sona.gateVerify(); } catch (e) {} });
await page.goto("http://localhost:8129/settings.html"); await page.waitForTimeout(700);
const noteShown = await page.evaluate(() => getComputedStyle(document.getElementById("playNote")).display !== "none");
ok("Settings shows the play-mode note", noteShown);
await page.evaluate(() => {
  const chips = [...document.querySelectorAll("#sounds .sound")];
  chips.filter((b) => !/^R\b/.test(b.textContent.trim())).slice(0, 18).forEach((b) => b.click()); // deselect all but one
  document.getElementById("save").click();
});
await page.waitForTimeout(300);
const flipped = await page.evaluate(() => JSON.parse(localStorage.getItem("sona.profile.v1") || "{}").mode);
ok("hand-picking sounds exits play mode", flipped === "speech", flipped);

// ── pulse: shows on 3rd visit for early adopters, chip-first, X cools 14d ──
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
// chip-first: note+Send stay hidden until a chip is picked, then chips+note post together
const preChip = await page.evaluate(() => ({
  chips: document.querySelectorAll("#pulseChips .pulseChip").length,
  moreHidden: document.getElementById("pulseMore").style.display === "none",
}));
ok("pulse offers chips with note hidden", preChip.chips >= 5 && preChip.moreHidden);
await page.evaluate(() => {
  const chips = [...document.querySelectorAll("#pulseChips .pulseChip")];
  chips.find((c) => c.textContent === "More games").click();
  document.getElementById("pulseText").value = "please add a dragon game";
  document.getElementById("pulseSend").click();
});
await page.waitForTimeout(500);
ok("pulse chips posted", fbPosts.length === 1 && fbPosts[0].src === "pulse" && fbPosts[0].q === "pulse.chips" && /More games/.test(fbPosts[0].text) && /dragon game/.test(fbPosts[0].text));
vis = await page.evaluate(() => document.getElementById("pulseOvl").classList.contains("show"));
ok("pulse closes after answer", !vis);
const coolSend = await page.evaluate(() => JSON.parse(localStorage.getItem("sona.pulse.v1")).cool || 0);
ok("send cools the auto-ask ~14d", coolSend > Date.now() + 13 * 24 * 3600 * 1000);
// banner
const banner = await page.evaluate(() => ({ show: getComputedStyle(document.getElementById("trialBanner")).display !== "none", txt: document.getElementById("trialMsg").textContent }));
ok("founding banner shows (kid-safe copy)", banner.show && /building Sona with us/.test(banner.txt) && !/\$/.test(banner.txt));
console.log("      banner:", banner.txt);
// banner tap opens pulse (force)
await page.evaluate(() => document.getElementById("trialBanner").click());
vis = await page.evaluate(() => document.getElementById("pulseOvl").classList.contains("show"));
ok("banner tap opens pulse", vis);
// X dismisses + cools the auto-ask for ~14 days
await page.evaluate(() => document.getElementById("pulseX").click());
vis = await page.evaluate(() => document.getElementById("pulseOvl").classList.contains("show"));
ok("X dismisses", !vis);
const coolX = await page.evaluate(() => JSON.parse(localStorage.getItem("sona.pulse.v1")).cool || 0);
ok("X cools future auto-asks ~14d", coolX > Date.now() + 13 * 24 * 3600 * 1000);
ok("today no pageerrors", errs.length === 0);

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
