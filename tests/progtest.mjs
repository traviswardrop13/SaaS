// Progression: sound rotation (one letter per 5-round pass), per-round ladder
// climb capped at earned+1, daily-goal ring on Today, charge round label,
// pulse copy. Real pages; rotation advanced via the exported Sona API.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, OUT, launchOpts } from "./_env.mjs";
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", png: "image/png", css: "text/css" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8131, r));
const browser = await chromium.launch(launchOpts(["--autoplay-policy=no-user-gesture-required"]));
const ctx = await browser.newContext({ permissions: ["microphone"], viewport: { width: 430, height: 932 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = () => Promise.resolve(new MediaStream());
  if (!localStorage.getItem("sona.profile.v1")) localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", focusSounds: ["R", "S"] }));
});
let fails = 0;
const ok = (n, p) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n); };

// ── source tripwires (node-side) ──
const chargeSrc = readFileSync(ROOT + "/charge.html", "utf8");
const todaySrc = readFileSync(ROOT + "/today.html", "utf8");
ok("rung advance no longer daily-only", /if\(v==="pass" && useRung>=RUNG/.test(chargeSrc));
ok("free play climbs with the rotation", /Math\.min\(isDaily\?\(run\?run\.round:0\):ROTR, RUNG\+1\)/.test(chargeSrc));
ok('pulse placeholder drops "complaint"', !/complaint/i.test(todaySrc));

// ── today.html: fresh day, ring empty, rotation letter = R ──
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(700);
let t = await page.evaluate(() => ({
  ring: document.getElementById("ringTxt").textContent,
  sub: document.getElementById("subLine").textContent,
  sound: Sona.rotSound(), round: Sona.rotRound(),
  ph: (document.getElementById("pulseText") || {}).placeholder || "",
}));
ok("ring starts 0/5", t.ring === "0/5");
ok("subLine invites the R sound", /your R sound/.test(t.sub));
ok("rotation starts R round 0", t.sound === "R" && t.round === 0);

// ── charge free play: round 1 = isolation, label Game 1 of 5 ──
await page.goto("http://localhost:8131/charge.html?game=arcade-slice.html"); await page.waitForTimeout(700);
let c = await page.evaluate(() => ({ prompt: document.getElementById("prompt").textContent, lbl: document.getElementById("roundLbl").textContent }));
ok("round 1 practices isolation", /your R sound/.test(c.prompt));
ok('label "Game 1 of 5 today · R sound"', /Game 1 of 5 today/.test(c.lbl) && /R sound/.test(c.lbl));

// ── ?sound= override beats the rotation (SLP/deep-link escape hatch) ──
await page.goto("http://localhost:8131/charge.html?game=arcade-slice.html&sound=T"); await page.waitForTimeout(700);
c = await page.evaluate(() => document.getElementById("prompt").textContent);
ok("?sound=T overrides rotation", /your T sound/.test(c));

// ── one finished round → syllables (stretch = earned 0 + 1) ──
await page.evaluate(() => Sona.rotAdvance());
await page.goto("http://localhost:8131/charge.html?game=arcade-tiles.html"); await page.waitForTimeout(700);
c = await page.evaluate(() => ({ prompt: document.getElementById("prompt").textContent, lbl: document.getElementById("roundLbl").textContent }));
ok("round 2 climbs to syllables", /^r(ah|ee|oo|oh|ay)$/i.test(c.prompt.trim()));
ok('label "Game 2 of 5 today"', /Game 2 of 5 today/.test(c.lbl));

// ── rounds 3-4 stay CAPPED at syllables while the rung is unearned ──
await page.evaluate(() => { Sona.rotAdvance(); Sona.rotAdvance(); });
await page.goto("http://localhost:8131/charge.html?game=arcade-run.html"); await page.waitForTimeout(700);
c = await page.evaluate(() => document.getElementById("prompt").textContent);
ok("round 4 capped at earned+1 (still syllables)", /^r(ah|ee|oo|oh|ay)$/i.test(c.trim()));

// ── earned rung feeds the climb: stage.R=2 (words earned) → round 4 = phrase (2+1) ──
await page.evaluate(() => { const g = Sona.getProgress(); g.stage = g.stage || {}; g.stage.R = 2; localStorage.setItem("sona.progress.v1", JSON.stringify(g)); });
await page.goto("http://localhost:8131/charge.html?game=arcade-run.html"); await page.waitForTimeout(700);
c = await page.evaluate(() => document.getElementById("prompt").textContent);
ok("earned words → round 4 stretches to a phrase", c.trim().split(/\s+/).length >= 2);
await page.evaluate(() => { const g = Sona.getProgress(); g.stage.R = 0; localStorage.setItem("sona.progress.v1", JSON.stringify(g)); });

// ── ring mid-day on Today: 3 done → 3/5 + "2 more games" ──
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(700);
t = await page.evaluate(() => ({ ring: document.getElementById("ringTxt").textContent, sub: document.getElementById("subLine").textContent }));
ok("ring shows 3/5 after 3 rounds", t.ring === "3/5");
ok("subLine counts down the goal", /2 more games/.test(t.sub));
await page.evaluate(() => document.getElementById("ringBtn").click());
let toast = await page.evaluate(() => document.getElementById("toast").textContent);
ok("ring tap explains progress", /3 of 5 games done/.test(toast) && /R sound/.test(toast));
await page.screenshot({ path: OUT + "/prog-ring-mid.png" });

// ── finish the rotation: 5 rounds → next letter S, ring goes gold ──
await page.evaluate(() => { Sona.rotAdvance(); Sona.rotAdvance(); });
t = await page.evaluate(() => ({ sound: Sona.rotSound(), round: Sona.rotRound(), ring: Sona.todayRing() }));
ok("rotation flips to S at 5 rounds", t.sound === "S" && t.round === 0);
ok("todayRing done at 5", t.ring.n === 5 && t.ring.done === true);
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(700);
t = await page.evaluate(() => ({
  ring: document.getElementById("ringTxt").textContent,
  stroke: document.getElementById("ringArc").getAttribute("stroke"),
  sub: document.getElementById("subLine").textContent,
}));
ok("ring shows the gold star", t.ring === "★" && t.stroke === "#ffb300");
ok("subLine celebrates the goal", /Daily goal done/.test(t.sub));
await page.screenshot({ path: OUT + "/prog-ring-done.png" });

// ── bonus rounds practice the NEXT letter from isolation ──
await page.goto("http://localhost:8131/charge.html?game=arcade-glide.html"); await page.waitForTimeout(700);
c = await page.evaluate(() => ({ prompt: document.getElementById("prompt").textContent, lbl: document.getElementById("roundLbl").textContent }));
ok("next rotation practices the S sound", /your S sound/.test(c.prompt));
ok("charge label flips to bonus", /Goal done — bonus round!/.test(c.lbl));

// ── Echo's voice never counts as reps; no prices on the kid's home ──
ok("engine ignores mic while ANY app audio plays", /if\(speaking\|\|ttsPlaying\)\{ silent\+\+; voiced=0; inBurst=false;/.test(chargeSrc));
ok("no dollar pricing in kid-facing today.html", !/\$\d/.test(todaySrc));
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(700);
// this profile is NOT a founding family → trial banner path
let bn = await page.evaluate(() => ({
  shown: getComputedStyle(document.getElementById("trialBanner")).display !== "none",
  txt: document.getElementById("trialMsg").textContent,
}));
ok("trial banner is kid-neutral", !bn.shown || (!/\$/.test(bn.txt) && /Grown-ups/.test(bn.txt)));
if (bn.shown) {
  await page.evaluate(() => document.getElementById("trialBanner").click());
  const gate = await page.evaluate(() => document.getElementById("gateOvl").classList.contains("show"));
  ok("banner tap opens the parent gate (not checkout)", gate);
  await page.evaluate(() => document.getElementById("gateClose").click());
}

// ── retry ladder: Echo thinks while scoring; two misses step DOWN a rung ──
ok("Echo's thinking state while the scorer runs", /Echo's thinking…/.test(chargeSrc) && /leo\.think\{animation:think/.test(chargeSrc.replace(/#/g, "")));
ok("step-down retry offers an easier same-sound target", /Let's try something easier/.test(chargeSrc) && /ladderContent\(SOUND,useRung-1\)/.test(chargeSrc));

// ── voice revive: "keep playing" copy + family-aware trigger in all 5 games ──
{
  const { readFileSync: rf } = await import("fs");
  const games = ["arcade-slice", "arcade-tiles", "arcade-stack", "arcade-run", "arcade-glide"];
  const all = games.every((g) => {
    const src = rf(ROOT + "/" + g + ".html", "utf8");
    return src.includes("to keep playing!") && src.includes("famOK") && src.includes("Sona.frameShape");
  });
  ok("all 5 games: revive says 'keep playing' + family-checked", all);
  const sj = rf(ROOT + "/sona.js", "utf8");
  ok("sona.js exports the shape helpers", /soundFamily, frameShape,/.test(sj));
}

// ── pulse open box: placeholder reads clean ──
await page.evaluate(() => { try { window.showPulse && showPulse(true); } catch (e) {} });
t = await page.evaluate(() => (document.getElementById("pulseText") || {}).placeholder || "");
if (t) ok("pulse placeholder is the new copy", /A request, an idea, a problem to fix/.test(t));
else ok("pulse placeholder is the new copy (source)", /A request, an idea, a problem to fix/.test(todaySrc));

// ── comeback greeting: 3+ idle days → numberless "Echo missed you", once/day ──
await page.evaluate(() => {
  const g = Sona.getProgress(); g.practiceDays = { "2026-06-30": 1 }; g.streak = { lastDate: "2026-06-30", count: 1 };
  localStorage.setItem("sona.progress.v1", JSON.stringify(g));
  localStorage.removeItem("sona.comeback.v1");
});
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(700);
let cb = await page.evaluate(() => ({
  shown: document.getElementById("cbOvl").classList.contains("show"),
  txt: document.getElementById("cbOvl").textContent,
}));
ok("comeback greeting shows after 3+ days away", cb.shown);
ok("comeback is numberless (no day counts)", !/\d/.test(cb.txt.replace(/Let's play!/, "")));
await page.evaluate(() => document.getElementById("cbBtn").click());
cb = await page.evaluate(() => document.getElementById("cbOvl").classList.contains("show"));
ok("Let's play dismisses it", !cb);
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(600);
cb = await page.evaluate(() => document.getElementById("cbOvl").classList.contains("show"));
ok("shows at most once per day", !cb);

// ── mic primer: first-ever mic ask explains before the browser prompt ──
await page.addInitScript(() => {
  navigator.permissions = navigator.permissions || {};
  navigator.permissions.query = () => Promise.resolve({ state: "prompt" });
});
await page.evaluate(() => localStorage.removeItem("sona.micok")); // one-shot: fresh family
await page.goto("http://localhost:8131/charge.html?game=arcade-slice.html"); await page.waitForTimeout(900);
let mp = await page.evaluate(() => ({
  shown: document.getElementById("micPrime").classList.contains("show"),
  txt: document.getElementById("micPrime").textContent,
}));
ok("primer shows before the mic prompt", mp.shown);
ok("primer explains listening honestly", /only during practice/.test(mp.txt) && /doesn't keep them/.test(mp.txt));
await page.evaluate(() => document.getElementById("micPrimeBtn").click());
await page.waitForTimeout(500);
mp = await page.evaluate(() => ({
  gone: !document.getElementById("micPrime").classList.contains("show"),
  micok: localStorage.getItem("sona.micok"),
}));
ok("primer dismisses into the mic grant + remembers", mp.gone && mp.micok === "1");
await page.goto("http://localhost:8131/charge.html?game=arcade-slice.html"); await page.waitForTimeout(800);
mp = await page.evaluate(() => document.getElementById("micPrime").classList.contains("show"));
ok("primer never shows again after grant", !mp);

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
