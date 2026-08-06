// DAY1: the day is one story, then three games.
//
// The home screen is a GATE, not a menu. Today's chapter is the only thing a
// kid can tap; finishing it unlocks three games chosen fresh for that day.
// What this suite defends:
//   - the three cards are locked until the story is read, and a locked tap is
//     never a dead tap
//   - reading the story unlocks them, and the unlock survives a reload
//   - the trio is stable within a day and different across days
//   - tomorrow's chapter is queued the moment today's is finished
//   - a four-year-old is never handed a trio they can't play
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", mp3: "audio/mpeg" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  // TTS is stubbed empty so the reader falls back silently instead of hanging
  if (u.pathname.startsWith("/api/")) { res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8178, r));

const browser = await chromium.launch(launchOpts());
let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };
const seed = (age) => `localStorage.setItem("sona.profile.v1",JSON.stringify({childName:"Mia",childAge:"${age}",focusSounds:["R"],onboarded:true,voiceOn:false}))`;

async function home(age) {
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8178/today.html");
  await pg.evaluate(seed(age || "7"));
  await pg.goto("http://localhost:8178/today.html");
  await pg.waitForTimeout(700);
  return { ctx, pg };
}

// ── 1. the home opens on the story, with three locked games ──
{
  const { ctx, pg } = await home("7");
  const st = await pg.evaluate(() => ({
    cta: document.getElementById("goBtn").textContent.trim(),
    launch: document.getElementById("goBtn").dataset.launch,
    hero: document.getElementById("heroName").textContent,
    sub: document.getElementById("heroSub").textContent,
    thumbs: document.getElementById("thumbs").children.length,
    locked: [...document.getElementById("thumbs").children].filter((e) => e.classList.contains("locked")).length,
    padlocks: document.querySelectorAll("#thumbs .lock").length,
    read: Sona.storyRead(),
  }));
  ok("the hero is today's chapter, not a game", /story/i.test(st.cta) && st.launch === "/chapter.html", JSON.stringify(st));
  ok("the chapter is named on the card", st.hero.length > 4, st.hero);
  ok("the card says what reading it earns", /unlock/i.test(st.sub), st.sub);
  ok("THREE games sit below, not two", st.thumbs === 3, String(st.thumbs));
  ok("all three are locked before the story", st.locked === 3 && st.padlocks === 3, JSON.stringify(st));
  ok("nothing is marked read yet", st.read === false);

  // a locked tap must never be a dead tap
  const tapped = await pg.evaluate(() => {
    const before = location.href;
    document.querySelector("#thumbs .thumb").click();
    return { moved: location.href !== before, sub: document.getElementById("heroSub").textContent };
  });
  ok("tapping a locked game doesn't navigate", tapped.moved === false);
  ok("…it explains what unlocks it", /story/i.test(tapped.sub), tapped.sub);
  await ctx.close();
}

// ── 2. reading the story unlocks the day ──
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  const errs = []; pg.on("pageerror", (e) => errs.push(String(e)));
  await pg.goto("http://localhost:8178/today.html");
  await pg.evaluate(seed("7"));

  await pg.goto("http://localhost:8178/chapter.html");
  await pg.waitForTimeout(600);
  const open = await pg.evaluate(() => ({
    chip: document.getElementById("chip").textContent,
    title: document.getElementById("ttl").textContent,
    pips: document.getElementById("pips").children.length,
    text: document.getElementById("text").textContent,
  }));
  ok("the reader names the chapter", /chapter/i.test(open.chip) && open.title.length > 4, JSON.stringify(open));
  ok("the story is 5 pages (opening + 4 beats)", open.pips === 5, String(open.pips));
  ok("page one is the chapter's opening line", open.text.length > 10, open.text);

  // page through to the end
  for (let i = 0; i < 5; i++) { await pg.evaluate(() => document.getElementById("next").click()); await pg.waitForTimeout(120); }
  await pg.waitForTimeout(400);
  const fin = await pg.evaluate(() => ({
    done: getComputedStyle(document.getElementById("done")).display !== "none",
    unlocked: document.getElementById("unlocked").children.length,
    hook: document.getElementById("hook").textContent,
    read: Sona.storyRead(),
  }));
  ok("finishing the last page ends the story", fin.done, JSON.stringify(fin));
  ok("the finish beat shows the three games unlocking", fin.unlocked === 3, String(fin.unlocked));
  ok("it hooks tomorrow", /tomorrow/i.test(fin.hook), fin.hook);
  ok("the day is marked read", fin.read === true);

  // …and the home screen now lets the kid play
  await pg.goto("http://localhost:8178/today.html");
  await pg.waitForTimeout(700);
  const after = await pg.evaluate(() => ({
    locked: [...document.getElementById("thumbs").children].filter((e) => e.classList.contains("locked")).length,
    padlocks: document.querySelectorAll("#thumbs .lock").length,
    cta: document.getElementById("goBtn").textContent.trim(),
    launch: document.getElementById("goBtn").dataset.launch,
    lbl: document.getElementById("upNextLbl").textContent,
  }));
  ok("the unlock survives a reload", after.locked === 0 && after.padlocks === 0, JSON.stringify(after));
  ok("the hero becomes a playable game", /let.s go/i.test(after.cta) && /charge\.html|arcade-/.test(after.launch), JSON.stringify(after));
  ok("the label stops saying LOCKED", !/locked/i.test(after.lbl), after.lbl);
  ok("no pageerrors anywhere in the flow", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

// ── 3. the trio is stable within a day, and moves between days ──
{
  const { ctx, pg } = await home("7");
  const res = await pg.evaluate(() => {
    const a = Sona.dailyGames(), b = Sona.dailyGames();
    return { a, b, same: JSON.stringify(a) === JSON.stringify(b), n: a.length, uniq: new Set(a).size };
  });
  ok("today's trio is the same every time it's asked for", res.same, JSON.stringify(res));
  ok("it is exactly three games", res.n === 3, String(res.n));
  ok("with no duplicates", res.uniq === 3, JSON.stringify(res.a));
  await ctx.close();
}

// ── 3b. rotation is real: different days, different trios ──
// The picker is seeded by the day number, so the only honest way to test it is
// to move the clock. A "rotation" that returns the same three games all week
// is not a rotation, and a kid would notice before any test did.
{
  const trios = [];
  for (let d = 0; d < 10; d++) {
    const ctx = await browser.newContext();
    const pg = await ctx.newPage();
    // freeze the clock to a specific day BEFORE sona.js loads
    await pg.addInitScript(`{
      const fixed = new Date(2026, 0, ${1 + d}, 10, 0, 0).getTime();
      const R = Date;
      Date = class extends R { constructor(...a) { if (!a.length) super(fixed); else super(...a); } static now() { return fixed; } };
    }`);
    await pg.goto("http://localhost:8178/today.html");
    await pg.evaluate(seed("7"));
    await pg.goto("http://localhost:8178/today.html");
    await pg.waitForTimeout(400);
    trios.push(await pg.evaluate(() => Sona.dailyGames().join(",")));
    await ctx.close();
  }
  const distinct = new Set(trios).size;
  ok("ten consecutive days give a real spread of trios", distinct >= 5, JSON.stringify({ trios, distinct }));
  ok("consecutive days are not identical", trios[0] !== trios[1], JSON.stringify(trios.slice(0, 2)));
}

// ── 4. a four-year-old always gets the game they can actually play ──
{
  const { ctx, pg } = await home("4");
  const st = await pg.evaluate(() => ({ trio: Sona.dailyGames(), hero: document.getElementById("heroName").textContent }));
  ok("under-6 always gets Feed Echo in the trio", st.trio.indexOf("feed") >= 0, JSON.stringify(st));
  ok("…and it leads, so the first unlocked game needs no reading", st.trio[0] === "feed", JSON.stringify(st));
  await ctx.close();
}

// ── 5. source contracts ──
{
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  ok("the day's state is per-child", /"sona\.day\.v1"[\s\S]{0,120}"sona\.tickets\.v1"/.test(sona),
    "two siblings on one iPad must not share one story gate");
  ok("today's chapter is PINNED for the day", /function dailyStory[\s\S]{0,400}save\(DAYKEY/.test(sona),
    "without the pin, reading it flips the card to tomorrow's story mid-day");
  ok("finishing the story queues tomorrow's", /function markStoryRead[\s\S]{0,260}episodeAdvance\(\)/.test(sona));
  ok("the game list lives in sona.js, not inline in a page",
    /const GAME_ACTS = \{/.test(sona) && !/var ACTS=\[/.test(readFileSync(ROOT + "/today.html", "utf8")),
    "two copies of the list is one copy that goes stale");
  const home = readFileSync(ROOT + "/today.html", "utf8");
  ok("the home reads the trio from sona.js", /S\.dailyGames\(\)/.test(home) && /S\.storyRead\(\)/.test(home));
  ok("the kid home still carries no tracking", !/pixel\.js|analytics\.js/.test(home));
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
