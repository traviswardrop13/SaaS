// Coach Call v0: ring → answer → scripted call runs to the end card; cap gates.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, OUT, launchOpts } from "./_env.mjs";
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", png: "image/png" };
let ttsPosts = [];
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/tts" && req.method === "POST") {
    let b = ""; req.on("data", (c) => (b += c));
    req.on("end", () => { try { ttsPosts.push(JSON.parse(b).text); } catch (e) {} res.writeHead(500); res.end(); });
    return;
  }
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8132, r));
const browser = await chromium.launch(launchOpts());
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
let errs = [];
page.on("pageerror", (e) => { if (!/MediaStream has no audio track/.test(e.message)) errs.push(e.message); });
await page.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = () => Promise.resolve(new MediaStream());
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", focusSounds: ["R"], character: "fox", volume: 0, voiceOn: true }));
});
let fails = 0;
const ok = (n, p) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n); };

// ring screen
await page.goto("http://localhost:8132/coach-call.html?dev=1");
await page.waitForTimeout(800);
ok("ring screen shows", await page.evaluate(() => getComputedStyle(document.getElementById("ringOvl")).display !== "none"));
await page.screenshot({ path: OUT + "/call-ring.png" });
// answer → call runs; VAD gets no audio so every ask falls to "couldn't hear" and continues
await page.evaluate(() => document.getElementById("answer").click());
await page.waitForTimeout(1200);
ok("greeting spoken first", /Well HI, Milo/.test(ttsPosts[0] || ""));
ok("call burns one weekly slot", await page.evaluate(() => window.SonaCallsLeft() === 2));
await page.screenshot({ path: OUT + "/call-live.png" });
// let the script play out (TTS 500s resolve fast; listens time out at 12s → "couldn't hear" path)
await page.waitForTimeout(60000);
const state = await page.evaluate(() => ({ step: window.__call.step, len: window.__call.script.length, done: document.getElementById("doneOvl").classList.contains("show") }));
console.log("      progressed to step", state.step, "of", state.len, "| done:", state.done);
ok("script advances past the asks", state.step >= 4);
// no sustained sounds ever sent to TTS
const bad = ttsPosts.filter((t) => /([a-z])\1\1/i.test(t));
ok("no sustained strings in TTS (" + ttsPosts.length + " lines)", bad.length === 0);
ok("no pageerrors", errs.length === 0);
if (errs.length) console.log("      err:", errs[0]);

// cap gate at 0 left
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("sona.call.v1")); s.used = 3; localStorage.setItem("sona.call.v1", JSON.stringify(s));
});
await page.goto("http://localhost:8132/coach-call.html?dev=1");
await page.waitForTimeout(700);
ok("cap overlay gates 4th call", await page.evaluate(() => document.getElementById("capOvl").classList.contains("show")));

// home card
await page.goto("http://localhost:8132/today.html");
await page.waitForTimeout(1200);
const card = await page.evaluate(() => {
  const t = [...document.querySelectorAll(".thumb b")].map((b) => b.textContent);
  return { heroOrThumb: t.concat([document.getElementById("heroName").textContent]) };
});
ok("Coach Call card in deck", card.heroOrThumb.some((x) => /Coach Call/.test(x)));
await page.evaluate(() => { [...document.querySelectorAll(".thumb")].find((th) => /Coach Call/.test(th.textContent))?.click(); });
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + "/call-card.png" });

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
