// REPWEEKS1: the week's reps (Travis, 28 Sep 2026). One count everywhere:
// Home's corner and Progress read the same voiced tries,
// never the number of sound checks, and legacy days that only hold sound
// checks add nothing. Since 23 Oct 2026 (FOUND1) the corner is the gift
// button: its ring is today toward the daily goal and its spoken label says
// the number; it only reads, and a tap opens the Trophy Road. Progress, behind
// the grown-ups check, keeps the week, the daily goal and what a rep is. Settings' "Reps, week by
// week" card went on 22 Oct 2026 (Travis: "simplify settings ... the minimum
// viable features"); the count it drew, Sona.repWeeks, is still pinned here at
// the source, edge by edge, and Settings is held to having no such card.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { chromium, ROOT, OUT, launchOpts } from "./_env.mjs";

let fails = 0, checks = 0;
function ok(label, pass, detail = "") { checks++; if (!pass) fails++; console.log((pass ? "PASS " : "FAIL ") + label + (pass ? "" : " → " + JSON.stringify(detail))); }
async function scenario(label, run) { try { await run(); } catch (e) { ok(label + " completes", false, e.stack); } }

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2", json: "application/json", webmanifest: "application/manifest+json" };
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__seed") { res.end("<!doctype html><title>Setup</title>"); return; }
  if (url.pathname.startsWith("/api/")) { res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); return; }
  const file = path.join(ROOT, url.pathname);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch(launchOpts());

// Time is frozen by a shift computed ONCE per context (momweek's pattern): a
// per-page freeze would snap back on every navigation, and the parent gate's
// clock-skew guard rightly rejects time that runs backward. window.__jump
// moves the clock forward inside a page, as a phone left overnight would.
async function fresh({ at, tz = "America/Denver", width = 375 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 812 }, timezoneId: tz });
  await context.route("**/*", (route) => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await context.addInitScript((SHIFT) => {
    const RealDate = Date;
    const now = () => RealDate.now() + SHIFT + (window.__jump || Number(sessionStorage.getItem("sona.test.clockJump")) || 0);
    class ShiftedDate extends RealDate {
      constructor(...a) { if (a.length === 0) super(now()); else super(...a); }
      static now() { return now(); }
    }
    window.Date = ShiftedDate;
  }, at - Date.now());
  const page = await context.newPage(); page.setDefaultTimeout(4000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/__seed");
  await page.evaluate(() => {
    ["", "2", "3", "4"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", n ? "done" : "post"));
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: "6", focusSounds: ["R"], onboarded: true, weeklyGoal: 3, volume: 0, voiceOn: false, soundOn: false }));
  });
  return { context, page, errors };
}
async function seed(page, out) { await page.evaluate((o) => { if (o) localStorage.setItem("sona.outcomes.v1", JSON.stringify(o)); else localStorage.removeItem("sona.outcomes.v1"); }, out); }
async function home(page) { await page.goto(origin + "/today.html"); await page.waitForFunction(() => window.Sona && document.getElementById("giftBtn") && /reps today/.test(document.getElementById("giftBtn").getAttribute("aria-label") || "")); await page.waitForTimeout(150); }
// Progress and Settings sit behind the grown-ups gate; the gate is passed here
// as it would be (passGate drives the real one below).
async function progress(page) { await page.evaluate(() => sessionStorage.setItem("sona.gate.v1", String(Date.now()))); await page.goto(origin + "/progress.html"); await page.waitForFunction(() => window.Sona && document.getElementById("storyLine").textContent && document.getElementById("dailyGoalPick").options.length); await page.waitForTimeout(150); }
async function settings(page, hash = "") { await page.evaluate(() => sessionStorage.setItem("sona.gate.v1", String(Date.now()))); await page.goto(origin + "/settings.html" + hash); await page.waitForFunction(() => window.Sona && document.getElementById("kidsCard")); await page.waitForTimeout(150); }
// Every part of the Settings card that went on 22 Oct 2026: the card, its
// heading, the week's number, its two lines, the chart and the days picker.
const NO_WEEK_CARD = () => !document.querySelector("#reps, #rwHead, #rwThis, #rwThisUnit, #rwLast, #rwBest, #rwBars, #rwDays, #goalDaysPick, #dailyGoalPick");
async function passGate(page) {
  const need = await page.evaluate(() => window.gateNeed);
  for (const d of need) await page.locator("#pad button", { hasText: new RegExp("^" + d + "$") }).click();
  await page.locator("#pad button", { hasText: "✓" }).click();
}
function overflow(page) { return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); }
// The week-by-week count at its source (what the Settings card drew until 22
// Oct 2026): this week, last week, the best finished week, whether this week
// beats it, the first counted week, and each week as "start:reps" ("★" the one
// week marked best, "*" this week).
function readWeeks(page) {
  return page.evaluate(() => {
    const r = Sona.repWeeks(8);
    return { now: r.thisWeek, last: r.lastWeek, best: r.best, newBest: r.newBest, since: r.since, bars: r.weeks.map((w) => (w.best ? "★" : "") + w.start + ":" + w.reps + (w.current ? "*" : "")).join(" ") };
  });
}
// Progress's own line for the week: practice tries, and last week beside them.
function readProgress(page) { return page.evaluate(() => ({ tries: document.getElementById("volReps").textContent, last: document.getElementById("volLast").textContent })); }

// Thursday 15 Oct 2026, 10:00 in Idaho: this week is Mon 12 – Sun 18 Oct.
const THU = Date.UTC(2026, 9, 15, 16, 0, 0);
// This week 9+14+5 = 28 · last week 10+3+5 = 18 · the week of 28 Sep is empty
// · the week of 21 Sep counts 7 (its Monday is sound checks only) · 7 Sep's
// tries predate rep counting (a wrong clock) · 19 Oct is a wrong clock too.
const HISTORY = {
  R: { attempts: 40, passes: 23, days: {
    "2026-09-15": { a: 20, p: 10 },
    "2026-09-21": { a: 4, p: 2 },
    "2026-09-22": { a: 3, p: 2, tries: 7 },
    "2026-10-06": { a: 3, p: 2, tries: 10 },
    "2026-10-11": { a: 1, p: 1, tries: 3 },
    "2026-10-12": { a: 2, p: 1, tries: 9 },
    "2026-10-15": { a: 3, p: 2, tries: 14 },
    "2026-10-19": { a: 1, p: 1, tries: 50 },
  } },
  S: { attempts: 5, passes: 4, days: {
    "2026-09-07": { a: 2, p: 2, tries: 70 },
    "2026-10-08": { a: 2, p: 1, tries: 5 },
    "2026-10-14": { a: 1, p: 1, tries: 5 },
  } },
};
function only(days) { return { R: { attempts: 1, passes: 1, days } }; }

await scenario("the one count", async () => {
  const { context, page, errors } = await fresh({ at: THU });
  await seed(page, HISTORY); await home(page);
  const snap = () => page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
  const before = await snap();
  const r = await page.evaluate(() => ({ now: Sona.weekReps(0), last: Sona.weekReps(-1), empty: Sona.weekReps(-2), sep21: Sona.weekReps(-3), legacy: Sona.weekReps(-4), early: Sona.weekReps(-5), nowR: Sona.weekReps(0, "R"), nowS: Sona.weekReps(0, "S"), weeks: Sona.repWeeks(8), wins: Sona.weekWins().reps }));
  const after = await snap();
  ok("this week sums voiced tries across sounds, Monday to today", r.now === 28, r.now);
  ok("last week keeps its Sunday and loses nothing to the Monday boundary", r.last === 18, r.last);
  ok("a week with no practice is 0", r.empty === 0, r.empty);
  ok("a sound-check-only Monday adds nothing to its week", r.sep21 === 7, r.sep21);
  ok("days holding only sound checks add no reps", r.legacy === 0, r.legacy);
  ok("tries dated before reps were counted are a wrong clock, never a week", r.early === 0, r.early);
  ok("the count narrows to one sound for Progress's lead", r.nowR === 23 && r.nowS === 5, r);
  ok("weekWins reads the same count, not the sound checks", r.wins === 28, r.wins);
  ok("history starts at the first counted week and ends on this one", JSON.stringify(r.weeks.weeks) === JSON.stringify([
    { start: "2026-09-21", reps: 7, current: false, best: false },
    { start: "2026-09-28", reps: 0, current: false, best: false },
    { start: "2026-10-05", reps: 18, current: false, best: true },
    { start: "2026-10-12", reps: 28, current: true, best: false },
  ]), r.weeks.weeks);
  ok("best is the best finished week, and this week beats it", r.weeks.best && r.weeks.best.start === "2026-10-05" && r.weeks.best.reps === 18 && r.weeks.newBest === true, r.weeks);
  ok("a day after this week (a wrong clock) is never this week, last week or best", r.weeks.thisWeek === 28 && r.weeks.lastWeek === 18 && r.weeks.since === "2026-09-21", r.weeks);
  ok("reading the count writes nothing", before === after);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("Home's gift button", async () => {
  // FOUND1 (23 Oct 2026): the reps count in this corner became the gift
  // button's ring (today toward the daily goal, which opens today's chest);
  // the number is in its spoken label, and grown-ups read it on Progress.
  const { context, page, errors } = await fresh({ at: THU });
  await seed(page, HISTORY);
  const before = await page.evaluate(() => Object.keys(localStorage).filter((k) => /rep|week/i.test(k)));
  await home(page);
  const s = await page.evaluate(() => {
    const box = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, h: r.height, w: r.width }; };
    const btn = document.getElementById("giftBtn");
    return {
      aria: btn.getAttribute("aria-label"), fill: document.getElementById("giftRing").style.getPropertyValue("--fill"), inHeader: !!btn.closest(".library-header"), tag: btn.tagName, href: btn.getAttribute("href"),
      pill: box("giftBtn"), gear: box("parentBtn"), buddy: box("buddyBtn"), old: !!document.getElementById("repPill"),
      label: getComputedStyle(document.querySelector(".library-label")).display,
      firstH1: document.querySelector("h1").textContent,
    };
  });
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => /rep|week/i.test(k)));
  ok("the ring shows today toward the daily goal (14 of 30), and no count is drawn", s.fill === "47" && !s.old, s);
  ok("its name says the number: \"Trophy Road. 14 of 30 reps today.\" (then what waits on the road)", /^Trophy Road\. 14 of 30 reps today\.(?: |$)/.test(s.aria), s.aria);
  ok("it is a link to the Trophy Road with a full-size tap target", s.tag === "A" && s.href === "/road.html" && s.pill.h >= 44 && s.pill.w >= 44, s);
  ok("it sits in the header, between the buddy and the gear, touching neither", s.inHeader && s.pill.l >= s.buddy.r && s.pill.r <= s.gear.l, s);
  ok("on a phone the 'Sona' wordmark steps aside for the buttons", s.label === "none", s);
  ok("the page's first heading is Today's adventure", s.firstH1 === "Today's adventure", s.firstH1);
  ok("Home stores nothing new about reps or weeks", JSON.stringify(before) === JSON.stringify(keys), { before, keys });
  ok("no sideways scroll at 375px", (await overflow(page)) <= 1);
  await page.screenshot({ path: OUT + "/repweek-home-375.png" });
  for (const width of [320, 360, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 812 }); await page.waitForTimeout(100);
    const fit = await page.evaluate(() => {
      const p = document.getElementById("giftBtn").getBoundingClientRect(), g = document.getElementById("parentBtn").getBoundingClientRect(), b = document.getElementById("buddyBtn").getBoundingClientRect();
      const l = document.querySelector(".library-label");
      return { apart: p.left >= b.right && p.right <= g.left, inside: g.right <= document.documentElement.clientWidth, oneLine: p.height <= 49, label: getComputedStyle(l).display, clipped: l.scrollWidth > l.clientWidth + 1 };
    });
    ok(width + "px: the gift button, buddy and gear fit side by side on screen", fit.apart && fit.inside && fit.oneLine && (await overflow(page)) <= 1, fit);
    ok(width + "px: the 'Sona' wordmark is either whole or gone, never cut off", fit.label === "none" || !fit.clipped, fit);
    if (width === 320) await page.screenshot({ path: OUT + "/repweek-home-320.png" });
    if (width === 768) { ok("a wide screen has room for the wordmark too", fit.label !== "none" && !fit.clipped, fit); await page.screenshot({ path: OUT + "/repweek-home-768.png" }); }
  }
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("Monday morning", async () => {
  // Home opened late Sunday and left in the background; the parent comes back
  // after midnight. The count must be the new week's, not last week's.
  const { context, page, errors } = await fresh({ at: Date.UTC(2026, 9, 19, 5, 50) }); // Sun 18 Oct 23:50 MDT
  await seed(page, only({ "2026-10-12": { a: 2, p: 1, tries: 40 }, "2026-10-18": { a: 3, p: 2, tries: 80 } })); await home(page);
  ok("Sunday night shows today's 80 and goal met", await page.evaluate(() => (function(){var m=/(\d[\d,]*) of (\d[\d,]*) reps today\.( Goal met\.)?/.exec(document.getElementById("giftBtn").getAttribute("aria-label")||"");return m?(m[3]?m[1]:m[1]+"/"+m[2]):"";})() === "80"));
  await page.evaluate(() => { window.__jump = 20 * 60 * 1000; sessionStorage.setItem("sona.test.clockJump",String(window.__jump)); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForFunction(() => window.Sona && Sona.localDay() === "2026-10-19" && (function(){var m=/(\d[\d,]*) of (\d[\d,]*) reps today\.( Goal met\.)?/.exec(document.getElementById("giftBtn").getAttribute("aria-label")||"");return m?(m[3]?m[1]:m[1]+"/"+m[2]):"";})() === "0/30");
  const s = await page.evaluate(() => ({ n: (function(){var m=/(\d[\d,]*) of (\d[\d,]*) reps today\.( Goal met\.)?/.exec(document.getElementById("giftBtn").getAttribute("aria-label")||"");return m?(m[3]?m[1]:m[1]+"/"+m[2]):"";})(), day: Sona.localDay(), aria: document.getElementById("giftBtn").getAttribute("aria-label"), fill: document.getElementById("giftRing").style.getPropertyValue("--fill") }));
  ok("back in front after midnight, the ring starts the new day empty", s.day === "2026-10-19" && s.n === "0/30" && /^Trophy Road\. 0 of 30 reps today/.test(s.aria) && s.fill === "0", s);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("the Grown-ups button", async () => {
  const { context, page, errors } = await fresh({ at: THU });
  await seed(page, HISTORY); await home(page);
  // 29 Sep 2026: the pop-up stopped carrying the week (Travis) — no wins line,
  // no story, no "Reps, week by week" link. 30 Sep 2026: the pop-up itself
  // went, and the code leads straight to Settings (Travis: "go straight to
  // settings not have them choose"). Home's daily corner leads to Progress
  // (next scenario); Settings' week-by-week card went on 22 Oct 2026.
  // Sona.weekWins(), soundStory() and repWeeks() still exist, so their count
  // is checked at the source.
  ok("Home has no Grown-ups pop-up and no week card", await page.evaluate(() => !document.querySelector("#sheetOvl, #goProgress, #goSettings, #goTalk, #weekCard, #wkWins, #wkMore, #planCard, #storyBits, #shareWeek")));
  await page.click("#parentBtn"); await passGate(page);
  await page.waitForURL(/\/settings\.html$/);
  await page.waitForFunction(() => window.Sona && document.getElementById("kidsCard"));
  const s = await page.evaluate(() => ({ wins: Sona.weekWins().reps, story: Sona.soundStory().join(" "), weeks: Sona.repWeeks(8).thisWeek }));
  ok("the right code lands on Settings, not a menu", /\/settings\.html$/.test(page.url()), page.url());
  ok("weekWins says the same 28 reps", s.wins === 28, s.wins);
  ok("the week's story says the same 28 reps, not the sound checks", /28 reps, each one said out loud/.test(s.story) && !/sounds out loud/.test(s.story), s.story);
  ok("…and so does the week-by-week count (Sona.repWeeks)", s.weeks === 28, s.weeks);
  ok("Settings, where the code lands, has no week-by-week card any more", await page.evaluate(NO_WEEK_CARD));
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("a tap on the gift button, and the week on Progress", async () => {
  const { context, page, errors } = await fresh({ at: THU });
  await seed(page, HISTORY); await home(page);
  // FOUND1: the button is the child's way to the Trophy Road, with no check
  const said = await page.evaluate(() => document.getElementById("giftBtn").getAttribute("aria-label"));
  await page.click("#giftBtn");
  await page.waitForURL(/\/road\.html$/);
  ok("a tap on the gift button opens the Trophy Road, with no grown-ups check", /\/road\.html$/.test(page.url()), page.url());
  // the week's count is the grown-ups' (Progress, behind the check)
  await page.evaluate(() => sessionStorage.setItem("sona.gate.v1", String(Date.now())));
  await page.goto(origin + "/progress.html");
  await page.waitForFunction(() => window.Sona && document.getElementById("volReps").textContent === "28" && document.getElementById("dailyGoalPick").options.length);
  const s = await page.evaluate(() => ({ tries: document.getElementById("volReps").textContent, goal: document.getElementById("dailyGoalPick").value, days: !!document.querySelector("#wkGoalPick .gbtn.on"), note: !!document.querySelector("#weekCard .rw-note"), today: document.getElementById("goalToday").textContent, d: Sona.dayGoal() }));
  ok("Progress has the week's 28 tries, beside the days a week, the daily goal and what a rep is", s.tries === "28" && s.goal === "30" && s.days && s.note, s);
  // the corner has no number now: Progress is where a grown-up reads today's
  // count, and it is the gift button's own (one count everywhere)
  const m = /^Trophy Road\. (\d+) of (\d+) reps today\./.exec(said || "");
  ok("Progress shows today's count under the daily goal, the same number the gift button's label says", !!m && +m[1] === s.d.n && +m[2] === s.d.goal && s.today === (s.d.done ? "Today: " + s.d.n + " reps. Goal met." : "Today: " + s.d.n + " of " + s.d.goal + " reps."), { said, today: s.today, d: s.d });
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("the week on Progress, and no card on Settings", async () => {
  const { context, page, errors } = await fresh({ at: THU });
  await seed(page, HISTORY);
  // Settings: the "Reps, week by week" card, its chart and its two goal
  // pickers went on 22 Oct 2026. A link to it from a Home page cached before
  // then still carries #reps, and must open Settings, never an error.
  await settings(page, "#reps");
  const set = await page.evaluate(() => ({ url: location.pathname + location.hash, text: document.body.innerText }));
  ok("an old #reps link still opens Settings", set.url === "/settings.html#reps", set.url);
  ok("Settings has no week-by-week card, chart or goal picker", await page.evaluate(NO_WEEK_CARD));
  ok("…and none of its words: the week, the best week, what a rep is", !/Reps, week by week|reps this week|Best week|New best week|A rep is one time/.test(set.text), set.text);
  // Progress: the line saying what a rep is moved in with the daily goal.
  await progress(page);
  const s = await page.evaluate(() => {
    const card = document.getElementById("weekCard"), note = card.querySelector(".rw-note"), goal = card.querySelector(".goal-daily"), kids = [...card.children];
    const moved = [note, goal, document.getElementById("goalHelp"), document.getElementById("goalToday"), document.getElementById("wkGoalMsg")];
    return {
      who: document.getElementById("rwWho").textContent, note: note.innerText.trim(),
      order: kids.indexOf(document.getElementById("wkGoalPick")) < kids.indexOf(goal) && kids.indexOf(goal) < kids.indexOf(note),
      text: moved.map((el) => el.innerText).join(" | "),
      reds: moved.flatMap((el) => [el, ...el.querySelectorAll("*")]).filter((el) => { const c = getComputedStyle(el).color.match(/\d+/g).map(Number); return c[0] > 180 && c[1] < 90 && c[2] < 90; }).length,
    };
  });
  const p = await readProgress(page);
  // One short line (Travis, 30 Sep 2026): out loud, in practice or a game,
  // and never silence.
  ok("Progress says what a rep is, in one line, naming the child, and that silence never counts", s.who === "Milo" && /^A rep is one time Milo says their sound or word out loud, in practice, a game or a book\. Silence never counts\.$/.test(s.note), s.note);
  ok("it sits with what it explains: the days a week, then the daily goal, then the rep line", s.order, s);
  ok("Progress's week is the same 28, and ahead of last week it says up from it", p.tries === "28" && p.last === "Up from 18 tries last week", p);
  ok("no percentages, scores or grades in the goal and rep lines", !/%|score|accura|grade|diagnos/i.test(s.text), s.text);
  ok("nothing in them is red", s.reds === 0, s.reds);
  ok("no sideways scroll at 375px", (await overflow(page)) <= 1);
  await page.locator("#weekCard").screenshot({ path: OUT + "/repweek-progress-375.png" });
  await page.setViewportSize({ width: 320, height: 812 }); await page.waitForTimeout(100);
  const narrow = await page.evaluate(() => {
    const card = document.getElementById("weekCard").getBoundingClientRect();
    return ["#wkGoalPick", ".goal-daily", "#dailyGoalPick", "#goalHelp", "#weekCard .rw-note"].map((q) => { const r = document.querySelector(q).getBoundingClientRect(); return { q, inside: r.left >= card.left - 1 && r.right <= card.right + 1 }; });
  });
  ok("320px: the days, the daily goal and the rep line fit the card", narrow.every((n) => n.inside) && (await overflow(page)) <= 1, narrow);
  await page.locator("#weekCard").screenshot({ path: OUT + "/repweek-progress-320.png" });
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("behind, tied, one rep, brand new, and wrong clocks", async () => {
  // The card that put these weeks into words left Settings on 22 Oct 2026.
  // The count it read is Sona.repWeeks, pinned here edge by edge, with
  // Progress's own line for the week beside it.
  const { context, page, errors } = await fresh({ at: THU });
  const lastWeek = { "2026-10-06": { a: 3, p: 2, tries: 10 }, "2026-10-10": { a: 3, p: 2, tries: 8 } };

  await seed(page, only({ ...lastWeek, "2026-10-13": { a: 3, p: 2, tries: 10 } })); await progress(page);
  let s = await readWeeks(page), p = await readProgress(page);
  ok("behind last week: 10 this week against last week's 18, and not a new best", s.now === 10 && s.last === 18 && !s.newBest, s);
  ok("the best week is still named: 18 reps, the week of Oct 5", s.best && s.best.start === "2026-10-05" && s.best.reps === 18, s);
  ok("and it is the one week marked best", s.bars === "★2026-10-05:18 2026-10-12:10*", s.bars);
  ok("Progress names last week's number, never a drop", p.tries === "10" && p.last === "Last week: 18 tries" && !/down|less|fewer|behind|drop/i.test(p.last), p);

  await seed(page, only({ ...lastWeek, "2026-10-13": { a: 3, p: 2, tries: 18 } })); await progress(page);
  s = await readWeeks(page); p = await readProgress(page);
  ok("a tie with last week is not a new best", s.now === 18 && s.last === 18 && !s.newBest && s.best && s.best.reps === 18, s);
  ok("…and Progress does not call a tie 'up'", p.tries === "18" && p.last === "Last week: 18 tries", p);

  await seed(page, only({ "2026-10-13": { a: 1, p: 1, tries: 1 } })); await progress(page);
  s = await readWeeks(page);
  ok("one rep: a first counted week, this one, with no best yet", s.now === 1 && s.last === 0 && s.best === null && !s.newBest && s.since === "2026-10-12" && s.bars === "2026-10-12:1*", s);
  ok("…and Progress counts 1 try", (await readProgress(page)).tries === "1");
  await home(page);
  ok("Home's corner shows no reps today when the week's one was Tuesday", await page.evaluate(() => (function(){var m=/(\d[\d,]*) of (\d[\d,]*) reps today\.( Goal met\.)?/.exec(document.getElementById("giftBtn").getAttribute("aria-label")||"");return m?(m[3]?m[1]:m[1]+"/"+m[2]):"";})() === "0/30" && (/ Goal met\./.test(document.getElementById("giftBtn").getAttribute("aria-label")||"")?"Goal met":"reps today") === "reps today"));

  await seed(page, null); await progress(page);
  s = await readWeeks(page);
  ok("a brand-new child: 0, no best and no first counted week", s.now === 0 && s.last === 0 && s.best === null && s.since === null && !s.newBest, s);
  ok("…and Progress counts 0 tries", (await readProgress(page)).tries === "0");
  await home(page);
  ok("Home's corner shows 0 for a brand-new child", await page.evaluate(() => (function(){var m=/(\d[\d,]*) of (\d[\d,]*) reps today\.( Goal met\.)?/.exec(document.getElementById("giftBtn").getAttribute("aria-label")||"");return m?(m[3]?m[1]:m[1]+"/"+m[2]):"";})() === "0/30" && (/ Goal met\./.test(document.getElementById("giftBtn").getAttribute("aria-label")||"")?"Goal met":"reps today") === "reps today"));

  await seed(page, only({ "2026-09-15": { a: 20, p: 10 }, "2026-10-13": { a: 5, p: 3 } })); await progress(page);
  s = await readWeeks(page);
  ok("a family whose practice predates rep counting reads as not counted yet, never as weeks of nothing", s.now === 0 && s.best === null && s.since === null, s);

  await seed(page, only({ "2026-09-28": { a: 3, p: 2, tries: 30 }, "2026-10-13": { a: 3, p: 2, tries: 4 } })); await progress(page);
  s = await readWeeks(page);
  ok("a quiet last week after older practice reads 0, not a fresh start", s.last === 0 && s.best && s.best.start === "2026-09-28" && s.best.reps === 30 && s.bars === "★2026-09-28:30 2026-10-05:0 2026-10-12:4*", s);

  await seed(page, only({ "2025-10-06": { a: 1, p: 1, tries: 99 }, "2026-10-06": { a: 3, p: 2, tries: 30 }, "2026-10-13": { a: 3, p: 2, tries: 40 } })); await progress(page);
  s = await readWeeks(page);
  ok("a year-old date from a wrong clock is never the best week", s.newBest && s.best && s.best.start === "2026-10-05" && s.best.reps === 30 && s.bars === "★2026-10-05:30 2026-10-12:40*", s);

  await seed(page, only({ "2026-10-13": { a: 3, p: 2, tries: 1234 } })); await progress(page);
  s = await readWeeks(page);
  ok("a big week counts every rep", s.now === 1234, s);
  await home(page);
  ok("Home's corner keeps today separate from a large Tuesday count", await page.evaluate(() => (function(){var m=/(\d[\d,]*) of (\d[\d,]*) reps today\.( Goal met\.)?/.exec(document.getElementById("giftBtn").getAttribute("aria-label")||"");return m?(m[3]?m[1]:m[1]+"/"+m[2]):"";})() === "0/30"));
  // The thousands comma lives on in the one place a count that big is drawn
  // for a child's day: Home's corner, once the goal is met.
  await seed(page, only({ "2026-10-15": { a: 3, p: 2, tries: 1234 } })); await home(page);
  ok("a big day gets a thousands comma in Home's corner", await page.evaluate(() => (function(){var m=/(\d[\d,]*) of (\d[\d,]*) reps today\.( Goal met\.)?/.exec(document.getElementById("giftBtn").getAttribute("aria-label")||"");return m?(m[3]?m[1]:m[1]+"/"+m[2]):"";})() === "1,234" && (/ Goal met\./.test(document.getElementById("giftBtn").getAttribute("aria-label")||"")?"Goal met":"reps today") === "Goal met"));
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("Progress reads the same count", async () => {
  const { context, page, errors } = await fresh({ at: THU });
  // A sound-check-only day this week (old code still cached on some device)
  // beside counted tries: the lead and the weekly card must agree.
  await seed(page, { R: { attempts: 24, passes: 20, days: { "2026-10-13": { a: 24, p: 20 } } }, S: { attempts: 2, passes: 1, tries: 5, days: { "2026-10-14": { a: 2, p: 1, tries: 5 } } } });
  await page.evaluate(() => sessionStorage.setItem("sona.gate.v1", String(Date.now())));
  await page.goto(origin + "/progress.html"); await page.waitForFunction(() => window.Sona && document.getElementById("storyLine").textContent);
  const s = await page.evaluate(() => ({ vol: document.getElementById("volReps").textContent, lead: document.getElementById("storyLine").textContent }));
  ok("Progress's weekly card and its lead name the same number", s.vol === "5" && /S sound with 5 tries this week/.test(s.lead) && !/24/.test(s.lead), s);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("sounds said in games are reps too", async () => {
  // GAMEREPS1 (Travis, 29 Sep 2026: "yeah count as reps"): a sound a game
  // asked for and heard adds to the week, from its own ledger, never outcomes.
  const { context, page, errors } = await fresh({ at: THU });
  await seed(page, HISTORY);
  await page.evaluate(() => localStorage.setItem("sona.gamereps.v1", JSON.stringify({ "2026-10-15": { R: 3, S: 2 }, "2026-10-07": { R: 4 }, "2026-09-10": { R: 9 } })));
  await home(page);
  const before = await page.evaluate(() => localStorage.getItem("sona.outcomes.v1"));
  let r = await page.evaluate(() => ({ now: Sona.weekReps(0), last: Sona.weekReps(-1), s: Sona.weekReps(0, "S"), pill: (function(){var m=/(\d[\d,]*) of (\d[\d,]*) reps today\.( Goal met\.)?/.exec(document.getElementById("giftBtn").getAttribute("aria-label")||"");return m?(m[3]?m[1]:m[1]+"/"+m[2]):"";})() }));
  ok("the week counts 33 and Home's ring today counts 19 toward 30", r.now === 33 && r.pill === "19/30", r);
  ok("last week adds its game reps too; a date before reps were counted adds none", r.last === 22, r);
  ok("one sound's count includes its game reps", r.s === 7, r);
  await page.evaluate(() => { Sona.gameRep("r"); Sona.gameRep("R"); Sona.gameRep("X"); Sona.gameRep(""); });
  r = await page.evaluate(() => ({ now: Sona.weekReps(0), ledger: JSON.parse(localStorage.getItem("sona.gamereps.v1"))["2026-10-15"], outcomes: localStorage.getItem("sona.outcomes.v1") }));
  ok("Sona.gameRep adds one per heard sound, for real sounds only", r.now === 35 && r.ledger.R === 5 && r.ledger.S === 2, r);
  ok("…and never touches the practice records (pass rates, the clinician's view)", r.outcomes === before);
  await progress(page);
  const card = await page.evaluate(() => ({ games: document.getElementById("volGames").hidden ? null : document.getElementById("volGames").textContent, note: document.querySelector("#weekCard .rw-note").innerText }));
  ok("Progress counts them in all, and its rep line says a game counts too", card.games === "Plus 7 sounds said out loud in games and books: 35 reps in all." && /in practice, a game or a book/.test(card.note) && !/add none/.test(card.note), card);
  await page.evaluate(() => Sona.addKid("Ana", 4));
  ok("a second child's game reps start at 0", await page.evaluate(() => Sona.weekReps(0) === 0));
  await page.evaluate(() => Sona.gameRep("R"));
  await page.evaluate(() => Sona.switchKid(""));
  ok("…and a rep for the second child never lands on the first", await page.evaluate(() => Sona.weekReps(0) === 35));
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("a syllable or word card in a game is one rep too", async () => {
  // GAMEASK1 (Travis, 1 Oct 2026: "start with isolation then ree rah roh then
  // rot"): Fruit Slice's card between waves may now ask a syllable or a short
  // word. The card cannot tell "ree" from "rrrr", so a heard one counts as
  // what the bare sound always did: one rep in the game ledger, and nothing a
  // pass rate, a clinician or the earned level ever sees.
  const { context, page, errors } = await fresh({ at: THU });
  await context.route("**/api/tts", (route) => route.fulfill({ body: Buffer.alloc(4800), contentType: "application/octet-stream" }));
  await context.addInitScript(() => {
    window.__mic = 0;
    window.Audio = function (src) { const a = { src, play() { setTimeout(() => { if (a.onended) a.onended(); }, 20); return Promise.resolve(); }, pause() {}, removeAttribute() {}, load() {} }; return a; };
    // slicetest's fake phone: a mic that hears silence (the card's own success path is called below, as there)
    navigator.mediaDevices.getUserMedia = () => { window.__mic++; const t = { readyState: "live", stop() { this.readyState = "ended"; } }; return Promise.resolve({ getTracks: () => [t], getAudioTracks: () => [t] }); };
    const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
    const node = () => ({ gain: param(), frequency: param(), Q: param(), type: "", buffer: null, connect() {}, disconnect() {}, start() {}, stop() {} });
    function AC() { this.state = "running"; this.sampleRate = 48000; this.currentTime = 0; this.destination = {}; }
    AC.prototype = { resume() { return Promise.resolve(); }, suspend() { return Promise.resolve(); }, close() { return Promise.resolve(); },
      createGain: node, createOscillator: node, createBufferSource: node, createBiquadFilter: node,
      createBuffer(c, n, sr) { return { length: n, sampleRate: sr, duration: n / sr, getChannelData: () => new Float32Array(n) }; },
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; },
      createAnalyser() { return { fftSize: 2048, frequencyBinCount: 1024, connect() {}, disconnect() {}, getByteTimeDomainData(a) { a.fill(128); }, getByteFrequencyData(a) { a.fill(0); } }; } };
    window.AudioContext = window.webkitAudioContext = AC;
    sessionStorage.setItem("sona.play.token", "arcade-slice.html");
  });
  await seed(page, HISTORY);
  // The cards climb on what the child EARNED on the practice page: R at the
  // syllable step (stage 1), so they may go one past it, to the word. The
  // Settings picker that could set this by hand went on 22 Oct 2026, and a
  // pick saved from it is dropped: the "Just the sound" one seeded here would
  // once have held every card to the bare sound.
  await page.evaluate(() => { localStorage.setItem("sona.freeera5.v1", "done"); localStorage.setItem("sona.progress.v1", JSON.stringify({ ladderV: 2, stage: { R: 1 } })); const p = JSON.parse(localStorage.getItem("sona.profile.v1")); Object.assign(p, { childAge: "7", volume: 0.8, voiceOn: true, gameLevel: "isolation" }); localStorage.setItem("sona.profile.v1", JSON.stringify(p)); });
  await page.goto(origin + "/arcade-slice.html?from=charge");
  await page.waitForFunction(() => window.gameEntryAllowed === true && typeof startWave === "function");
  const snap = () => page.evaluate(() => ({ week: Sona.weekReps(0), practice: Sona.weekReps(0, null, true), outcomes: localStorage.getItem("sona.outcomes.v1"), attempts: localStorage.getItem("sona.attempts.v1"), stage: JSON.stringify(Sona.getProgress().stage), ledger: JSON.parse(localStorage.getItem("sona.gamereps.v1") || "{}")["2026-10-15"] || {} }));
  const before = await snap(), asked = [];
  for (const n of [1, 2]) {
    await page.evaluate(() => { waveGot = WAVES[wave].goal; });
    // Echo has said the ask, and the card's mic is open
    await page.waitForFunction((k) => document.getElementById("revOvl").classList.contains("show") && window.__mic === k && !!rv.st, n, { timeout: 12000 });
    asked.push(await page.evaluate(() => ({ rung: ASK.rung, text: ASK.text })));
    await page.evaluate(() => { closeReviveMic(); doRevive(); });
    await page.waitForFunction((k) => phase === "wave" && wave === k, n);
  }
  const after = await snap();
  ok("an old game-card pick from Settings is dropped, so nothing reads it", await page.evaluate(() => !("gameLevel" in Sona.getProfile())));
  ok("the two cards asked a syllable, then the short word, as earned", asked[0].rung === 1 && asked[1].rung === 2 && asked[1].text === "rot", asked);
  ok("each heard card is exactly one rep on the week's count, in the game ledger", after.week === before.week + 2 && after.ledger.R === 2, { before, after });
  ok("…and touches no practice record: not the tries, the pass-rate records, the attempts or the earned level",
    after.practice === before.practice && after.outcomes === before.outcomes && after.attempts === before.attempts && after.stage === before.stage, { before, after });
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("Progress keeps practice apart from game sounds", async () => {
  // What Progress hands a clinician (the summary and its card) says free play
  // is not included, so its tries stay the practice page's; the game sounds
  // get their own line, and the week still adds up to Home's reps.
  const { context, page, errors } = await fresh({ at: THU });
  await context.addInitScript(() => { window.__copies = []; Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t) => { window.__copies.push(t); } } }); });
  await seed(page, HISTORY);
  await page.evaluate(() => { localStorage.setItem("sona.gamereps.v1", JSON.stringify({ "2026-10-15": { R: 3, S: 2 } })); sessionStorage.setItem("sona.gate.v1", String(Date.now())); });
  await page.goto(origin + "/progress.html"); await page.waitForFunction(() => window.Sona && document.getElementById("storyLine").textContent);
  let p = await page.evaluate(() => ({ tries: document.getElementById("volReps").textContent, games: document.getElementById("volGames").hidden ? null : document.getElementById("volGames").textContent, lead: document.getElementById("storyLine").textContent }));
  ok("Progress's tries are the practice page's 28", p.tries === "28", p);
  ok("…with the 5 game sounds on their own line, adding up to Home's 33", p.games === "Plus 5 sounds said out loud in games and books: 33 reps in all.", p);
  ok("…and its lead counts practice only", /R sound with 23 tries this week — 28 tries in all/.test(p.lead), p.lead);
  await page.click("#copySummary"); await page.waitForTimeout(150);
  const copied = await page.evaluate(() => window.__copies[0] || "");
  ok("the summary for the clinician counts practice tries only, so 'free play is not included' stays true", /\b28 tries\b/.test(copied) && !/\b33\b/.test(copied) && /Free-play games are not included/.test(copied), copied);
  // A child who only played games this week.
  await seed(page, null);
  await page.evaluate(() => localStorage.setItem("sona.gamereps.v1", JSON.stringify({ "2026-10-15": { R: 7 } })));
  await page.goto(origin + "/progress.html"); await page.waitForFunction(() => window.Sona && document.getElementById("storyLine").textContent);
  p = await page.evaluate(() => ({ tries: document.getElementById("volReps").textContent, games: document.getElementById("volGames").textContent }));
  ok("a week of only game sounds: 0 practice tries, and the 7 said in games", p.tries === "0" && p.games === "Plus 7 sounds said out loud in games and books: 7 reps in all.", p);
  await home(page);
  const story = await page.evaluate(() => Sona.soundStory()[0]);
  ok("the week's story never says 'practiced 0 days' beside reps", story === "Milo said the practice sound out loud 7 times in games and books this week." && !/0 days/.test(story), story);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("each child keeps their own week", async () => {
  const { context, page, errors } = await fresh({ at: THU });
  await seed(page, HISTORY); await home(page);
  await page.evaluate(() => Sona.addKid("Ana", 4));
  await home(page);
  const second = await page.evaluate(() => ({ n: (function(){var m=/(\d[\d,]*) of (\d[\d,]*) reps today\.( Goal met\.)?/.exec(document.getElementById("giftBtn").getAttribute("aria-label")||"");return m?(m[3]?m[1]:m[1]+"/"+m[2]):"";})(), reps: Sona.weekReps(0) }));
  ok("a second child starts at 0, not the first child's 28", second.n === "0/30" && second.reps === 0, second);
  await progress(page);
  ok("Progress names the selected child, and her week starts at 0", await page.evaluate(() => document.getElementById("title").textContent === "Ana's progress" && document.getElementById("rwWho").textContent === "Ana" && document.getElementById("volReps").textContent === "0" && Sona.repWeeks(8).thisWeek === 0));
  await page.evaluate(() => Sona.switchKid(""));
  await home(page);
  ok("switching back shows the first child's 28 again", await page.evaluate(() => (function(){var m=/(\d[\d,]*) of (\d[\d,]*) reps today\.( Goal met\.)?/.exec(document.getElementById("giftBtn").getAttribute("aria-label")||"");return m?(m[3]?m[1]:m[1]+"/"+m[2]):"";})() === "14/30"));
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("week edges", async () => {
  // Late Sunday night still belongs to this week.
  let { context, page, errors } = await fresh({ at: Date.UTC(2026, 9, 5, 5, 30) }); // Sun 4 Oct 23:30 MDT
  await seed(page, only({ "2026-09-28": { a: 1, p: 1, tries: 4 }, "2026-10-04": { a: 1, p: 1, tries: 6 } })); await home(page);
  ok("23:30 on Sunday: Monday through Sunday are one week", await page.evaluate(() => Sona.weekReps(0) === 10 && Sona.localDay() === "2026-10-04"));
  ok("no page errors", errors.length === 0, errors);
  await context.close();
  // The night the clocks go back (US, Sun 1 Nov 2026) stays in its own week.
  ({ context, page, errors } = await fresh({ at: Date.UTC(2026, 10, 2, 5, 30), tz: "America/New_York" })); // Mon 2 Nov 00:30 EST
  await seed(page, only({ "2026-10-26": { a: 1, p: 1, tries: 5 }, "2026-11-01": { a: 1, p: 1, tries: 7 }, "2026-11-02": { a: 1, p: 1, tries: 2 } })); await home(page);
  let r = await page.evaluate(() => ({ day: Sona.localDay(), now: Sona.weekReps(0), last: Sona.weekReps(-1), weeks: Sona.repWeeks(8).weeks.map((w) => w.start + ":" + w.reps).join(" ") }));
  ok("across the clocks going back, Sunday stays last week and Monday starts this one", r.day === "2026-11-02" && r.now === 2 && r.last === 12 && r.weeks === "2026-10-26:12 2026-11-02:2", r);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
  // Southern hemisphere: the clocks go forward on Sun 4 Oct 2026 in Sydney.
  ({ context, page, errors } = await fresh({ at: Date.UTC(2026, 9, 4, 14, 30), tz: "Australia/Sydney" })); // Mon 5 Oct 01:30 AEDT
  await seed(page, only({ "2026-10-04": { a: 1, p: 1, tries: 3 }, "2026-10-05": { a: 1, p: 1, tries: 4 } })); await home(page);
  r = await page.evaluate(() => ({ day: Sona.localDay(), now: Sona.weekReps(0), last: Sona.weekReps(-1) }));
  ok("across the clocks going forward, the weeks split on Monday too", r.day === "2026-10-05" && r.now === 4 && r.last === 3, r);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
  // A week that crosses into a new year, and a best week from last year says its year.
  ({ context, page, errors } = await fresh({ at: Date.UTC(2027, 0, 1, 17, 0) })); // Fri 1 Jan 2027 10:00 MST
  await seed(page, only({ "2026-12-28": { a: 1, p: 1, tries: 3 }, "2027-01-01": { a: 1, p: 1, tries: 4 }, "2026-12-27": { a: 1, p: 1, tries: 9 } })); await home(page);
  ok("a week that crosses New Year's is still one week", await page.evaluate(() => Sona.weekReps(0) === 7 && Sona.weekReps(-1) === 9 && Sona.repWeeks(8).weeks[0].start === "2026-12-21"));
  const s = await readWeeks(page);
  ok("a best week from last year keeps its year: the week of 21 Dec 2026, 9 reps", s.best && s.best.start === "2026-12-21" && s.best.reps === 9 && s.bars === "★2026-12-21:9 2026-12-28:7*", s);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await browser.close(); server.close();
console.log(fails ? `\n${fails} of ${checks} CHECKS FAILED` : `\nALL ${checks} CHECKS GREEN`);
process.exit(fails ? 1 : 0);
