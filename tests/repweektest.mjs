// REPWEEKS1: the week's reps in Home's top corner, and week by week in
// Settings (Travis, 28 Sep 2026). One count everywhere: Home's corner, the
// parent corner, Progress and Settings all read the same voiced tries, never
// the number of sound checks, and legacy days that only hold sound checks add
// nothing. The corner only reads, sets no target, and a tap on it meets the
// grown-ups gate before landing on the Settings card.
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
    const now = () => RealDate.now() + SHIFT + (window.__jump || 0);
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
async function home(page) { await page.goto(origin + "/today.html"); await page.waitForFunction(() => window.Sona && document.getElementById("repPillN")); await page.waitForTimeout(150); }
async function settings(page, hash = "") { await page.evaluate(() => sessionStorage.setItem("sona.gate.v1", String(Date.now()))); await page.goto(origin + "/settings.html" + hash); await page.waitForFunction(() => window.Sona && document.getElementById("rwThis")); await page.waitForTimeout(150); }
async function passGate(page) {
  const need = await page.evaluate(() => window.gateNeed);
  for (const d of need) await page.locator("#pad button", { hasText: new RegExp("^" + d + "$") }).click();
  await page.locator("#pad button", { hasText: "✓" }).click();
}
function overflow(page) { return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); }
function readCard(page) {
  return page.evaluate(() => ({
    now: document.getElementById("rwThis").textContent, unit: document.getElementById("rwThisUnit").textContent,
    last: document.getElementById("rwLast").textContent, best: document.getElementById("rwBest").textContent,
    bars: [...document.querySelectorAll("#rwBars li")].map((li) => ({ cls: li.className.trim(), sr: li.querySelector(".sr").textContent, val: li.querySelector(".rw-val").textContent, star: !!li.querySelector(".rw-star"), h: li.querySelector(".rw-bar").getBoundingClientRect().height })),
  }));
}

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
  ok("the parent corner reads the same count, not the sound checks", r.wins === 28, r.wins);
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

await scenario("Home's corner", async () => {
  const { context, page, errors } = await fresh({ at: THU });
  await seed(page, HISTORY);
  const before = await page.evaluate(() => Object.keys(localStorage).filter((k) => /rep|week/i.test(k)));
  await home(page);
  const s = await page.evaluate(() => {
    const box = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, h: r.height }; };
    const pill = document.getElementById("repPill");
    return {
      n: document.getElementById("repPillN").textContent, unit: document.getElementById("repPillUnit").textContent,
      aria: pill.getAttribute("aria-label"), inHeader: !!pill.closest(".library-header"), tag: pill.tagName,
      pill: box("repPill"), gear: box("parentBtn"), buddy: box("buddyBtn"),
      label: getComputedStyle(document.querySelector(".library-label")).display,
      labelClipped: (() => { const l = document.querySelector(".library-label"); return l.scrollWidth > l.clientWidth + 1; })(),
      firstH1: document.querySelector("h1").textContent,
    };
  });
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => /rep|week/i.test(k)));
  ok("the corner shows this week's reps", s.n === "28" && s.unit === "reps this week", s);
  ok("its name says the number and where a grown-up can see more", /^28 reps this week\./.test(s.aria) && /For grown-ups/.test(s.aria), s.aria);
  ok("it is a real button with a full-size tap target", s.tag === "BUTTON" && s.pill.h >= 44, s);
  ok("it sits in the header, between the buddy and the gear, touching neither", s.inHeader && s.pill.l >= s.buddy.r && s.pill.r <= s.gear.l && s.pill.t >= s.gear.t - 1 && s.pill.b <= s.gear.b + 1, s);
  ok("on a phone the 'Sona' wordmark steps aside for the count and the Grown-ups button", s.label === "none", s);
  ok("the page's first heading is still Pick a game!", s.firstH1 === "Pick a game!", s.firstH1);
  ok("Home stores nothing new about reps or weeks", JSON.stringify(before) === JSON.stringify(keys), { before, keys });
  ok("no sideways scroll at 375px", (await overflow(page)) <= 1);
  await page.screenshot({ path: OUT + "/repweek-home-375.png" });
  for (const width of [320, 360, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 812 }); await page.waitForTimeout(100);
    const fit = await page.evaluate(() => {
      const p = document.getElementById("repPill").getBoundingClientRect(), g = document.getElementById("parentBtn").getBoundingClientRect(), b = document.getElementById("buddyBtn").getBoundingClientRect();
      const l = document.querySelector(".library-label");
      return { apart: p.left >= b.right && p.right <= g.left, inside: g.right <= document.documentElement.clientWidth, oneLine: p.height <= 45, label: getComputedStyle(l).display, clipped: l.scrollWidth > l.clientWidth + 1 };
    });
    ok(width + "px: the count, buddy and gear fit side by side on screen", fit.apart && fit.inside && fit.oneLine && (await overflow(page)) <= 1, fit);
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
  ok("Sunday night shows the week's 120", await page.evaluate(() => document.getElementById("repPillN").textContent === "120"));
  await page.evaluate(() => { window.__jump = 20 * 60 * 1000; document.dispatchEvent(new Event("visibilitychange")); });
  const s = await page.evaluate(() => ({ n: document.getElementById("repPillN").textContent, day: Sona.localDay(), aria: document.getElementById("repPill").getAttribute("aria-label") }));
  ok("back in front after midnight, the corner starts the new week at 0", s.day === "2026-10-19" && s.n === "0" && /^0 reps this week/.test(s.aria), s);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("the parent corner", async () => {
  const { context, page, errors } = await fresh({ at: THU });
  await seed(page, HISTORY); await home(page);
  await page.click("#parentBtn"); await passGate(page);
  await page.waitForSelector("#sheetOvl.show");
  const s = await page.evaluate(() => {
    const more = document.getElementById("wkMore"), r = more.getBoundingClientRect();
    return { wins: document.getElementById("wkWins").textContent, story: document.getElementById("storyBits").textContent, more: more.getAttribute("href"), h: r.height, sheetBtns: document.querySelectorAll(".sheetBtn").length };
  });
  ok("the parent corner says the same 28 reps", /\b28 reps this week\b/.test(s.wins), s.wins);
  ok("the week's story says the same 28 reps, not the sound checks", /28 reps, each one said out loud/.test(s.story) && !/sounds out loud/.test(s.story), s.story);
  ok("it links to the week-by-week card, without a third sheet button", s.more === "/settings.html#reps" && s.sheetBtns === 2, s);
  ok("the link is a full-size tap target", s.h >= 44, s.h);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("a tap on the corner", async () => {
  const { context, page, errors } = await fresh({ at: THU });
  await seed(page, HISTORY); await home(page);
  await page.click("#repPill");
  const gate = await page.evaluate(() => ({ shown: document.getElementById("gateOvl").classList.contains("show"), url: location.pathname }));
  ok("a tap meets the grown-ups gate and goes nowhere yet", gate.shown && gate.url === "/today.html", gate);
  await page.click("#gateClose");
  ok("Never mind leaves the child on Home", await page.evaluate(() => !document.getElementById("gateOvl").classList.contains("show") && location.pathname === "/today.html"));
  await page.click("#repPill"); await passGate(page);
  await page.waitForURL(/\/settings\.html#reps$/);
  await page.waitForFunction(() => window.Sona && document.getElementById("rwThis").textContent === "28");
  ok("the right answer lands on the week-by-week card", /\/settings\.html#reps$/.test(page.url()), page.url());
  // A family with a parent code: the pill asks for the code, and lands in the same place.
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem("sona.profile.v1")); p.parentPin = "2468"; localStorage.setItem("sona.profile.v1", JSON.stringify(p)); });
  await home(page); await page.click("#repPill");
  for (const d of "1111") await page.locator("#pad button", { hasText: new RegExp("^" + d + "$") }).click();
  await page.locator("#pad button", { hasText: "✓" }).click(); await page.waitForTimeout(200);
  ok("a wrong parent code keeps the child on Home", await page.evaluate(() => location.pathname === "/today.html" && document.getElementById("gateOvl").classList.contains("show")));
  for (const d of "2468") await page.locator("#pad button", { hasText: new RegExp("^" + d + "$") }).click();
  await page.locator("#pad button", { hasText: "✓" }).click();
  await page.waitForURL(/\/settings\.html#reps$/);
  ok("the parent code opens the same card", /\/settings\.html#reps$/.test(page.url()), page.url());
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("the Settings card", async () => {
  const { context, page, errors } = await fresh({ at: THU });
  await seed(page, HISTORY); await settings(page);
  const c = await readCard(page);
  const s = await page.evaluate(() => {
    const card = document.getElementById("reps");
    return {
      afterKids: document.getElementById("kidsCard").nextElementSibling === card,
      head: document.getElementById("rwHead").textContent, who: document.getElementById("rwWho").textContent,
      bestNew: document.getElementById("rwBest").classList.contains("new"),
      list: document.getElementById("rwBars").getAttribute("role"), items: [...document.querySelectorAll("#rwBars li")].every((li) => li.getAttribute("role") === "listitem" && !li.hasAttribute("aria-label") && li.lastElementChild.getAttribute("aria-hidden") === "true"),
      days: [...document.querySelectorAll("#rwDays span")].map((d) => d.innerText.replace(/\n/g, " ")),
      text: card.innerText,
      reds: [...card.querySelectorAll("*")].filter((el) => { const c = getComputedStyle(el).color.match(/\d+/g).map(Number); return c[0] > 180 && c[1] < 90 && c[2] < 90; }).length,
    };
  });
  ok("the card sits right under Kids, so it belongs to the selected child", s.afterKids);
  ok("it names the child", s.head === "Milo’s reps, week by week" && s.who === "Milo", s);
  ok("this week is the same 28 as Home's corner", c.now === "28" && c.unit === "reps this week", c);
  ok("ahead of last week says by how much", c.last === "10 reps more than last week’s 18.", c.last);
  ok("beating every finished week says so, with the week it beat", s.bestNew && c.best === "New best week! The last best was 18 reps, the week of Oct 5.", c.best);
  ok("four weeks: from the first counted week to this one", c.bars.length === 4 && s.days.join("|") === "Sep 21|Sep 28|Oct 5|This week", { c, days: s.days });
  ok("this week is marked as now and as the new best", /now/.test(c.bars[3].cls) && /best/.test(c.bars[3].cls) && c.bars[3].star && c.bars[3].val === "28" && c.bars[3].sr === "This week: 28 reps, best week", c.bars[3]);
  ok("one star only: the week it beat is no longer marked best", c.bars.filter((b) => b.star || /best/.test(b.cls)).length === 1 && c.bars[2].sr === "Week of Oct 5: 18 reps", c.bars[2]);
  ok("a week with no counted reps is a stub, never a gap in the list", c.bars[1].val === "0" && c.bars[1].h <= 3 && c.bars[1].sr === "Week of Sep 28: 0 reps", c.bars[1]);
  ok("bars scale to the tallest week", c.bars[3].h > c.bars[2].h && c.bars[2].h > c.bars[0].h, c.bars.map((b) => b.h));
  ok("a screen reader hears each week in words, from inside the item", s.list === "list" && s.items, s);
  ok("the card says what a rep is, that it is not a verdict, and that silence never counts", /says the practice sound or word out loud/.test(s.text) && /when a game asks for it/.test(s.text) && /whether or not it sounded right yet/.test(s.text) && /Silence never counts/.test(s.text) && /Monday to Sunday/.test(s.text), s.text);
  ok("no percentages, scores or grades on the card", !/%|score|accura|grade|diagnos/i.test(s.text), s.text);
  ok("nothing on the card is red", s.reds === 0, s.reds);
  ok("no sideways scroll at 375px", (await overflow(page)) <= 1);
  await page.locator("#reps").screenshot({ path: OUT + "/repweek-settings-375.png" });
  await page.setViewportSize({ width: 320, height: 812 }); await page.waitForTimeout(100);
  const narrow = await page.evaluate(() => {
    const bars = document.getElementById("rwBars").getBoundingClientRect(), card = document.getElementById("reps").getBoundingClientRect();
    const labels = [...document.querySelectorAll("#rwDays span")].every((d) => d.scrollWidth <= d.clientWidth + 1);
    const vals = [...document.querySelectorAll("#rwBars li")].every((li) => { const v = li.querySelector(".rw-val").getBoundingClientRect(), r = li.getBoundingClientRect(); return v.left >= r.left - 1 && v.right <= r.right + 1; });
    return { inside: bars.right <= card.right && bars.left >= card.left, labels, vals };
  });
  ok("320px: the chart, its numbers and its week labels fit the card", narrow.inside && narrow.labels && narrow.vals && (await overflow(page)) <= 1, narrow);
  await page.locator("#reps").screenshot({ path: OUT + "/repweek-settings-320.png" });
  // Arriving from Home's corner: the card, not the status bar, is on top.
  await settings(page, "#reps");
  const top = await page.evaluate(() => ({ top: document.getElementById("reps").getBoundingClientRect().top, y: scrollY }));
  ok("#reps scrolls to the card and leaves room above it", top.y > 0 && top.top >= 11, top);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("behind, tied, one rep, brand new, and wrong clocks", async () => {
  const { context, page, errors } = await fresh({ at: THU });
  const lastWeek = { "2026-10-06": { a: 3, p: 2, tries: 10 }, "2026-10-10": { a: 3, p: 2, tries: 8 } };

  await seed(page, only({ ...lastWeek, "2026-10-13": { a: 3, p: 2, tries: 10 } })); await settings(page);
  let s = await readCard(page);
  ok("behind last week says how many more reps beat it, never a drop", s.last === "9 more to beat last week’s 18." && !/down|less|fewer|behind|drop/i.test(s.last), s);
  ok("the best week is still named", s.best === "Best week: 18 reps, the week of Oct 5.", s);
  ok("and its bar carries the one star", s.bars.map((b) => (b.star ? "★" : "") + b.val).join(" ") === "★18 10", s.bars);

  await seed(page, only({ ...lastWeek, "2026-10-13": { a: 3, p: 2, tries: 18 } })); await settings(page);
  s = await readCard(page);
  ok("a tie says one more rep beats it, and is not a new best", s.last === "Tied with last week’s 18. One more rep beats it." && /^Best week: 18 reps/.test(s.best), s);

  await seed(page, only({ "2026-10-13": { a: 1, p: 1, tries: 1 } })); await settings(page);
  s = await readCard(page);
  ok("one rep reads 'rep', and a first week says it is the first", s.now === "1" && s.unit === "rep this week" && s.last === "The first week counted." && s.best === "" && s.bars.length === 1, s);
  await home(page);
  ok("Home's corner says 1 rep this week", await page.evaluate(() => document.getElementById("repPillN").textContent === "1" && document.getElementById("repPillUnit").textContent === "rep this week"));

  await seed(page, null); await settings(page);
  s = await readCard(page);
  ok("a brand-new child: 0, no chart, and what adds the first rep", s.now === "0" && s.bars.length === 0 && s.best === "" && s.last === "No reps counted yet. Milo’s next practice adds the first.", s);
  await home(page);
  ok("Home's corner shows 0 for a brand-new child", await page.evaluate(() => document.getElementById("repPillN").textContent === "0" && document.getElementById("repPillUnit").textContent === "reps this week"));

  await seed(page, only({ "2026-09-15": { a: 20, p: 10 }, "2026-10-13": { a: 5, p: 3 } })); await settings(page);
  s = await readCard(page);
  ok("a family whose practice predates rep counting is not told the child never practiced", s.now === "0" && s.bars.length === 0 && s.best === "" && s.last === "No reps counted yet. Milo’s next practice adds the first.", s);

  await seed(page, only({ "2026-09-28": { a: 3, p: 2, tries: 30 }, "2026-10-13": { a: 3, p: 2, tries: 4 } })); await settings(page);
  s = await readCard(page);
  ok("a quiet last week after older practice reads 0, not a fresh start", s.last === "Last week: 0 reps." && s.best === "Best week: 30 reps, the week of Sep 28." && s.bars.length === 3, s);

  await seed(page, only({ "2025-10-06": { a: 1, p: 1, tries: 99 }, "2026-10-06": { a: 3, p: 2, tries: 30 }, "2026-10-13": { a: 3, p: 2, tries: 40 } })); await settings(page);
  s = await readCard(page);
  ok("a year-old date from a wrong clock is never the best week", /^New best week! The last best was 30 reps/.test(s.best) && s.bars.length === 2, s);

  await seed(page, only({ "2026-10-13": { a: 3, p: 2, tries: 1234 } })); await settings(page);
  s = await readCard(page);
  ok("big weeks get a thousands comma, and a short label on the bar", s.now === "1,234" && s.bars[0].val === "1.2k", s);
  await home(page);
  ok("Home's corner uses the same comma", await page.evaluate(() => document.getElementById("repPillN").textContent === "1,234"));
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
  let r = await page.evaluate(() => ({ now: Sona.weekReps(0), last: Sona.weekReps(-1), s: Sona.weekReps(0, "S"), pill: document.getElementById("repPillN").textContent }));
  ok("this week adds the game's 5 to practice's 28, and Home's corner says 33", r.now === 33 && r.pill === "33", r);
  ok("last week adds its game reps too; a date before reps were counted adds none", r.last === 22, r);
  ok("one sound's count includes its game reps", r.s === 7, r);
  await page.evaluate(() => { Sona.gameRep("r"); Sona.gameRep("R"); Sona.gameRep("X"); Sona.gameRep(""); });
  r = await page.evaluate(() => ({ now: Sona.weekReps(0), ledger: JSON.parse(localStorage.getItem("sona.gamereps.v1"))["2026-10-15"], outcomes: localStorage.getItem("sona.outcomes.v1") }));
  ok("Sona.gameRep adds one per heard sound, for real sounds only", r.now === 35 && r.ledger.R === 5 && r.ledger.S === 2, r);
  ok("…and never touches the practice records (pass rates, the clinician's view)", r.outcomes === before);
  await settings(page);
  const card = await page.evaluate(() => ({ now: document.getElementById("rwThis").textContent, note: document.querySelector(".rw-note").innerText }));
  ok("Settings counts them, and says a game's asking counts", card.now === "35" && /when a game asks for it/.test(card.note) && !/add none/.test(card.note), card);
  await page.evaluate(() => Sona.addKid("Ana", 4));
  ok("a second child's game reps start at 0", await page.evaluate(() => Sona.weekReps(0) === 0));
  await page.evaluate(() => Sona.gameRep("R"));
  await page.evaluate(() => Sona.switchKid(""));
  ok("…and a rep for the second child never lands on the first", await page.evaluate(() => Sona.weekReps(0) === 35));
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("each child keeps their own week", async () => {
  const { context, page, errors } = await fresh({ at: THU });
  await seed(page, HISTORY); await home(page);
  await page.evaluate(() => Sona.addKid("Ana", 4));
  await home(page);
  const second = await page.evaluate(() => ({ n: document.getElementById("repPillN").textContent, reps: Sona.weekReps(0) }));
  ok("a second child starts at 0, not the first child's 28", second.n === "0" && second.reps === 0, second);
  await settings(page);
  ok("Settings names the selected child", await page.evaluate(() => document.getElementById("rwHead").textContent === "Ana’s reps, week by week" && document.getElementById("rwThis").textContent === "0"));
  await page.evaluate(() => Sona.switchKid(""));
  await home(page);
  ok("switching back shows the first child's 28 again", await page.evaluate(() => document.getElementById("repPillN").textContent === "28"));
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
  await settings(page);
  const s = await readCard(page);
  ok("a best week from last year names its year", s.best === "Best week: 9 reps, the week of Dec 21, 2026." && s.bars.length === 2, s);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await browser.close(); server.close();
console.log(fails ? `\n${fails} of ${checks} CHECKS FAILED` : `\nALL ${checks} CHECKS GREEN`);
process.exit(fails ? 1 : 0);
