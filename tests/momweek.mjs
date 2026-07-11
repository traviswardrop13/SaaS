// Mom-week verification: goal math, week streak, migration, and the three UIs.
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
await new Promise((r) => srv.listen(8128, r));
const browser = await chromium.launch(launchOpts());
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
let errs = [];
page.on("pageerror", (e) => errs.push(e.message));

let fails = 0;
const ok = (n, got, want) => { const p = JSON.stringify(got) === JSON.stringify(want); if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : `  got:${JSON.stringify(got)} want:${JSON.stringify(want)}`)); };

// seed: goal 3; practiced Mon+Tue this week; prior two weeks had 3+ days each
await page.goto("http://localhost:8128/today.html");
const r = await page.evaluate(() => {
  const day = (off) => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const now = new Date(); const dow = (now.getDay() + 6) % 7; // 0=Mon
  const pd = {};
  pd[day(-dow)] = 1; if (dow >= 1) pd[day(-dow + 1)] = 1; // Mon, Tue this week
  for (const w of [1, 2]) for (const i of [0, 2, 4]) pd[day(-dow - 7 * w + i)] = 1; // 3 days in each prior week
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", focusSounds: ["R"], weeklyGoal: 3 }));
  const g = JSON.parse(localStorage.getItem("sona.progress.v1") || "{}");
  g.practiceDays = pd; g.streak = { count: 1, lastDate: "" };
  localStorage.setItem("sona.progress.v1", JSON.stringify(g));
  const w = window.Sona.momWeek();
  return { goal: w.goal, done: w.done, hit: w.hit, weekStreak: w.weekStreak, dow };
});
// done = 2 unless today IS Monday (then only Mon seeded = 1)
const expDone = r.dow >= 1 ? 2 : 1;
ok("goal", r.goal, 3);
ok("done", r.done, expDone);
ok("hit(not yet)", r.hit, false);
ok("weekStreak(2 prior weeks)", r.weekStreak, 2);

// add a 3rd day this week → hit + streak 3
const r2 = await page.evaluate(() => {
  const day = (off) => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const g = JSON.parse(localStorage.getItem("sona.progress.v1"));
  g.practiceDays[day(0)] = 1; g.practiceDays[day(-1)] = 1; // today + yesterday (covers Monday edge)
  localStorage.setItem("sona.progress.v1", JSON.stringify(g));
  const w = window.Sona.momWeek();
  return { hit: w.hit, weekStreak: w.weekStreak, practicedToday: w.practicedToday };
});
ok("hit after 3rd day", r2.hit, true);
ok("weekStreak now 3", r2.weekStreak, 3);
ok("practicedToday", r2.practicedToday, true);

// UI: parent sheet card renders
await page.reload(); await page.waitForTimeout(900);
const sheet = await page.evaluate(() => {
  document.getElementById("sheetOvl").classList.add("show");
  // paintWeek runs on load; read what it rendered
  return { dots: document.getElementById("wkDots").children.length, msg: document.getElementById("wkMsg").textContent, streak: document.getElementById("wkStreak").textContent, sub: document.getElementById("subLine").textContent };
});
ok("sheet 7 dots", sheet.dots, 7);
console.log("      msg:", sheet.msg, "| streak:", sheet.streak, "| subLine:", sheet.sub);
await page.screenshot({ path: OUT + "/mom-sheet.png" });

// progress page
errs = [];
await page.goto("http://localhost:8128/progress.html"); await page.waitForTimeout(1000);
const prog = await page.evaluate(() => ({
  msg: document.getElementById("wkGoalMsg").textContent,
  on: document.querySelector("#wkGoalPick .gbtn.on") ? document.querySelector("#wkGoalPick .gbtn.on").dataset.g : null,
}));
ok("progress goal button on", prog.on, "3");
console.log("      progress msg:", prog.msg);
console.log(errs.length ? "FAIL progress pageerrors: " + errs[0] : "PASS progress no pageerrors");
if (errs.length) fails++;
await page.screenshot({ path: OUT + "/mom-progress.png" });

// onboarding goal step renders 3 choices
errs = [];
await page.goto("http://localhost:8128/onboarding.html"); await page.waitForTimeout(900);
const ob = await page.evaluate(() => document.querySelectorAll("#obGoal .choice").length);
ok("onboarding 3 cadence choices", ob, 3);
console.log(errs.length ? "FAIL onboarding pageerrors: " + errs[0] : "PASS onboarding no pageerrors");
if (errs.length) fails++;

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
