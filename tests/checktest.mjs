// Sound Check → plan loop: item selection (age-aware, stable words), grading,
// plan writing (focus sounds + rungs, never downgrading), the page flow with
// injected scores, and the parent-corner card + home nudge.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", png: "image/png", css: "text/css" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8137, r));
const browser = await chromium.launch(launchOpts(["--autoplay-policy=no-user-gesture-required"]));
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
await page.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = () => Promise.resolve(new MediaStream());
  if (!localStorage.getItem("sona.profile.v1")) localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: 5, focusSounds: ["R", "S"] }));
});
let fails = 0;
const ok = (n, p) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n); };

// ── engine: selection + grading + plan (pure logic on a real page) ──
await page.goto("http://localhost:8137/today.html"); await page.waitForTimeout(600);
let t = await page.evaluate(() => {
  const full = Sona.checkSounds("full"), items = Sona.checkItems("full");
  return {
    full, itemsOk: items.every((it) => it.words.length >= 1 && it.words.length <= 2),
    ordered: full.every((s, i) => i === 0 || (Sona.SOUND_NORM[full[i - 1]] || 9) <= (Sona.SOUND_NORM[s] || 9)),
    ageCapped: full.every((s) => (Sona.SOUND_NORM[s] || 9) <= 6 || ["R", "S"].includes(s)), // age 5 → norm ≤6, picked always in
    stable: JSON.stringify(Sona.checkItems("full")) === JSON.stringify(items), // same words every call = comparable weeks
    grades: [Sona.gradeSound([90, 85]), Sona.gradeSound([60, 70]), Sona.gradeSound([20, 40]), Sona.gradeSound([null, null])],
    nudge: getComputedStyle(document.getElementById("checkNudge")).display !== "none",
  };
});
ok("full sweep is age-aware + includes picked sounds", t.ageCapped && t.full.includes("R") && t.full.includes("S"));
ok("sweep ordered easiest-first", t.ordered);
ok("items have 1-2 stable words per sound", t.itemsOk && t.stable);
ok("grading: strong/emerging/needs/unknown", JSON.stringify(t.grades) === JSON.stringify(["strong", "emerging", "needs", "unknown"]));
ok("home shows first-check nudge", t.nudge);

// ── the page: run a mini check end-to-end with injected scores ──
await page.goto("http://localhost:8137/soundcheck.html?mode=mini"); await page.waitForTimeout(800);
t = await page.evaluate(() => ({ mode: window.__sc.mode, turns: window.__sc.turns.length, sounds: [...new Set(window.__sc.turns.map((x) => x.sound))] }));
ok("mini mode checks the focus sounds", t.mode === "mini" && t.sounds.join(",") === "R,S" && t.turns >= 2);
await page.evaluate(() => window.__scFinish({ R: [30, 40], S: [88, 92] })); // R needs work, S strong
await page.waitForTimeout(600);
t = await page.evaluate(() => ({
  done: document.getElementById("doneOvl").classList.contains("show"),
  check: Sona.lastCheck(), plan: Sona.getPlan(),
  profile: JSON.parse(localStorage.getItem("sona.profile.v1")),
}));
ok("done screen shows", t.done);
ok("check saved with statuses", t.check && t.check.statuses.R === "needs" && t.check.statuses.S === "strong");
ok("plan focuses the sound that needs work", t.plan && t.plan.focus.includes("R") && !t.plan.focus.includes("S"));
ok("profile focusSounds rewritten by the plan", t.profile.focusSounds.includes("R"));
ok("plan has the 12-week arc + created date", t.plan && t.plan.weeks.length === 4 && !!t.plan.created);

// ── never downgrade an earned rung ──
t = await page.evaluate(() => {
  const g = Sona.getProgress(); g.stage = g.stage || {}; g.stage.R = 3; localStorage.setItem("sona.progress.v1", JSON.stringify(g));
  Sona.saveCheck({ mode: "mini", results: { R: { words: ["rabbit", "red"], scores: [10, 20] } } });
  Sona.buildPlan();
  return Sona.getProgress().stage.R;
});
ok("bad check day never downgrades an earned rung", t === 3);

// ── parent corner card paints from the saved check ──
await page.goto("http://localhost:8137/today.html"); await page.waitForTimeout(600);
t = await page.evaluate(() => {
  paintPlan(); // direct: the gate flow calls this on open
  return {
    shown: document.getElementById("planCard").style.display !== "none",
    chips: document.getElementById("scChips").children.length,
    arc: document.getElementById("planArc").textContent,
    story: document.getElementById("storyBits").textContent,
    nudgeGone: getComputedStyle(document.getElementById("checkNudge")).display === "none",
  };
});
ok("plan card paints with chips", t.shown && t.chips >= 1);
ok("card shows the journey link", /Sound Journey — week/.test(t.arc));
ok("Sound Story narrates the week", /practiced/.test(t.story));
ok("nudge disappears after first check", t.nudgeGone);

// ── the Sound Journey: 13 slots, done weeks green, future weeks visible ──
await page.evaluate(async () => {
  // pin a tiny fake clip as this week's check recording
  await Sona.saveRecording({ sound: "R", word: "rabbit", level: "check", blob: new Blob([new Uint8Array(64)], { type: "audio/webm" }) });
});
await page.goto("http://localhost:8137/journey.html"); await page.waitForTimeout(900);
t = await page.evaluate(() => {
  const rows = [...document.querySelectorAll("#tl .wk")];
  return {
    rows: rows.length,
    wk1done: rows[0].classList.contains("done"),
    wk1chips: rows[0].querySelectorAll(".chip").length,
    wk1play: !!rows[0].querySelector(".play"),
    wk2future: rows[1].classList.contains("future"),
    futureLabeled: /Warm-ups/.test(rows[1].textContent),
    header: document.getElementById("wkNow").textContent,
    months: document.querySelectorAll(".month").length,
  };
});
ok("journey renders 13 week slots", t.rows === 13);
ok("this week is green-checked with grades", t.wk1done && t.wk1chips >= 1);
ok("pinned clip is playable on the done week", t.wk1play);
ok("future weeks visible with phase labels", t.wk2future && t.futureLabeled);
ok("header shows week 1 of 13", /Week 1 of 13/.test(t.header));
ok("month markers divide the timeline", t.months >= 2);

// ── plan card: arc text replaced by the journey link ──
await page.goto("http://localhost:8137/today.html"); await page.waitForTimeout(600);
t = await page.evaluate(() => { paintPlan(); return { arc: document.getElementById("planArc").textContent, html: document.getElementById("planArc").innerHTML }; });
ok("plan card links the journey instead of week paragraphs", /Sound Journey — week 1 of 13/.test(t.arc) && !/Weeks 7–10/.test(t.arc) && /journey\.html/.test(t.html));

// ── journey empty state for families with no plan yet ──
const page2 = await browser.newPage({ viewport: { width: 430, height: 932 } });
await page2.goto("http://localhost:8137/journey.html"); await page2.waitForTimeout(700);
t = await page2.evaluate(() => ({
  empty: getComputedStyle(document.getElementById("empty")).display !== "none",
  cta: /Sound Check/.test(document.getElementById("empty").textContent),
}));
ok("no plan → journey shows the first-check invitation", t.empty && t.cta);
await page2.close();

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
