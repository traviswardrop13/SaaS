// $20/mo pack: call variety+memory+first-call, wins card, buddy sprites, adventure tile.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, OUT, launchOpts } from "./_env.mjs";
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", png: "image/png", css: "text/css" };
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
await new Promise((r) => srv.listen(8134, r));
const browser = await chromium.launch(launchOpts());
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
let errs = [];
page.on("pageerror", (e) => { if (!/MediaStream has no audio track/.test(e.message)) errs.push(e.message); });
await page.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = () => Promise.resolve(new MediaStream());
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", focusSounds: ["R"], character: "dragon", interests: ["dragons"], volume: 0, voiceOn: true }));
});
let fails = 0;
const ok = (n, p) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n); };

// 1) first call: cap not burned, special greeting
await page.goto("http://localhost:8134/coach-call.html?first=1&dev=1");
await page.waitForTimeout(700);
await page.evaluate(() => document.getElementById("answer").click());
await page.waitForTimeout(1000);
ok("first call greeting", /I'm Echo! I've been waiting/.test(ttsPosts[0] || ""));
ok("first call is free (3 left)", await page.evaluate(() => window.SonaCallsLeft() === 3));

// 2) call #2 = fix-Echo variant with memory opener
await page.evaluate(() => localStorage.setItem("sona.callhist.v1", JSON.stringify({ n: 1, last: Date.now() - 3600000, lastPasses: 4, lastSound: "R" })));
await page.goto("http://localhost:8134/coach-call.html?dev=1");
await page.waitForTimeout(700);
const s2 = await page.evaluate(() => window.__call.script.map((s) => s.say || (s.ask && s.ask.line)).join(" | "));
ok("memory opener (brags to buddy)", /almost didn't believe me/.test(s2));
ok("fix-Echo variant", /Fix me!/.test(s2));
await page.evaluate(() => localStorage.setItem("sona.callhist.v1", JSON.stringify({ n: 2, last: Date.now(), lastPasses: 0, lastSound: "R" })));
await page.goto("http://localhost:8134/coach-call.html?dev=1");
await page.waitForTimeout(700);
const s3 = await page.evaluate(() => window.__call.script.map((s) => s.say || (s.ask && s.ask.line)).join(" | "));
ok("detective variant on call #3", /sound detectives/.test(s3));

// 3) parent corner wins card (seed outcomes: this week 70%, last week 50%)
await page.addInitScript(() => {
  const day = (off) => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const dow = (new Date().getDay() + 6) % 7;
  const days = {}; days[day(0)] = { a: 20, p: 14 }; days[day(-(dow + 2))] = { a: 20, p: 10 };
  localStorage.setItem("sona.outcomes.v1", JSON.stringify({ R: { attempts: 40, passes: 24, firstAt: day(-9), lastAt: day(0), days } }));
});
await page.goto("http://localhost:8134/today.html");
await page.waitForTimeout(1000);
const wins = await page.evaluate(() => ({ txt: document.getElementById("wkWins").textContent, share: getComputedStyle(document.getElementById("shareWeek")).display !== "none" }));
console.log("      wins:", wins.txt);
ok("wins line shows reps + delta", /sounds practiced/.test(wins.txt) && /%/.test(wins.txt));
ok("share button visible", wins.share);
await page.evaluate(() => { document.getElementById("sheetOvl").classList.add("show"); });
await page.screenshot({ path: OUT + "/pack-sheet.png" });

// 4) buddy sprite in glide (dragon buddy instead of fox emoji)
errs = [];
await page.evaluate(() => localStorage.setItem("sona.tickets.v1", JSON.stringify({ n: 5 })));
await page.goto("http://localhost:8134/arcade-glide.html");
await page.waitForTimeout(1500);
ok("glide loads clean with buddy sprite", errs.length === 0);
await page.screenshot({ path: OUT + "/pack-glide.png" });
errs = [];
await page.goto("http://localhost:8134/arcade-run.html");
await page.waitForTimeout(1500);
ok("run loads clean with buddy sprite", errs.length === 0);

// 5) library adventure tile personalized
errs = [];
await page.goto("http://localhost:8134/library.html");
await page.waitForTimeout(900);
const adv = await page.evaluate(() => ({ t: document.getElementById("advTitle").textContent, s: document.getElementById("advSub").textContent }));
ok("adventure tile personalized", adv.t === "Milo's Adventure" && /dragons story/.test(adv.s));
ok("library clean", errs.length === 0);

// 6) onboarding redirects into the first call
errs = [];
await page.goto("http://localhost:8134/onboarding.html");
await page.waitForTimeout(700);
const red = await page.evaluate(() => document.documentElement.outerHTML.includes("coach-call.html?first=1"));
ok("onboarding NOT wired to first call (coming soon)", !red);

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
