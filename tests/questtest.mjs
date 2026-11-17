// QUEST1: the daily adventure (Travis, 12-13 Oct 2026: "a new quest or like
// daily activity that they complete every day. That is only showing up for
// that day ... a 14-day rotation"). One quest a day, one round of one game.
// Since 22 Oct 2026 the stories come first (STORY1, tests/storycoretest.mjs),
// and Home's card is homestorytest's to play. This suite pins the game of the
// day, the days a child spends on the 14 once the stories are finished (or on
// a phone that shows none):
//   - only a finished round of TODAY'S game finishes the day, once; tomorrow's
//     is shown dark and cannot be played early;
//   - a new day is a new game day, played or not (CAL1, 28 Oct 2026: Travis
//     wants it "different every day. Even if they didn't do the daily
//     practice the day prior"), counted from the last day finished, and day
//     14 goes back to day 1; a child's first day on the CAL1 build is the
//     next day in order, never a jump over the days before it;
//   - a sticker a day, two on days 7 and 14, and never a coin (COIN3);
//   - ages 3-4 get Feed Echo and Bubble Pop; a family without Premium is
//     never sent to a game it cannot open;
//   - every game the adventure can name finishes the quest from its end card;
//   - every save merges into the record, so the stories a child finished stay
//     finished.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

let fails = 0;
function ok(label, pass, detail = "") { if (!pass) fails++; console.log((pass ? "PASS " : "FAIL ") + label + (pass ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); }
async function section(label, run) { try { await run(); } catch (e) { ok(label + " completes", false, e.stack); } }

const posted = [];
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2", json: "application/json", webmanifest: "application/manifest+json" };
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__sona") { res.writeHead(200, { "content-type": "text/html" }); res.end('<!doctype html><title>Store</title><body></body><script src="/sona.js"></script>'); return; }
  if (url.pathname.startsWith("/api/")) {
    let body = ""; req.on("data", (c) => { body += c; });
    req.on("end", () => { posted.push({ path: url.pathname, body }); res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); });
    return;
  }
  const file = path.join(ROOT, url.pathname);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch(launchOpts());

// How many stories this build tells (STORY1): a Premium child is seeded as
// having finished them all, so the game of the day is what this suite reads.
const STORY_LEN = ((readFileSync(ROOT + "/sona.js", "utf8").match(/const STORY_DAYS = \[[\s\S]*?\n  \];/) || [""])[0].match(/\bid: "/g) || []).length;
// A set-up child with every era stamp (CLAUDE.md: a seed missing one is
// grandfathered and the paywall vanishes). `premium` opens every game (and
// every story, which it is seeded as having finished); without it the phone
// keeps the free version (a browser cannot sell here), and shows no story.
// dayShift moves the page's calendar on by whole local days at the same time
// of day (never 24-hour steps, which a clock change can land on one date
// twice). "TODAY" in a seeded quest is the page's own day before the shift,
// so a run that crosses midnight never seeds one day and plays another.
function seedScript({ age, premium, quest, dayShift }) {
  if (premium) quest = Object.assign({ s: STORY_LEN, ls: STORY_LEN - 1, lk: "game" }, quest || {});
  return `(() => {
    const R = Date, SHIFT = ${dayShift || 0}, p2 = (n) => String(n).padStart(2, "0");
    const real = new R(R.now()), TODAY = real.getFullYear() + "-" + p2(real.getMonth() + 1) + "-" + p2(real.getDate());
    if (SHIFT) { const at = () => { const r = new R(R.now()); return new R(r.getFullYear(), r.getMonth(), r.getDate() + SHIFT, r.getHours(), r.getMinutes(), r.getSeconds(), r.getMilliseconds()).getTime(); };
      const N = function (...a) { return a.length ? new R(...a) : new R(at()); };
      N.now = at; N.UTC = R.UTC; N.parse = R.parse; N.prototype = R.prototype; window.Date = N; }
    if (localStorage.getItem("__seeded")) return; localStorage.setItem("__seeded", "1");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "${age}", focusSounds: ["R"], onboarded: true, voiceOn: true, volume: 0.8${premium ? ', earlyAdopter: true' : ''} }));
    localStorage.setItem("sona.freeera.v1", "post");
    ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
    localStorage.setItem("sona.freever.v1", "kept"); localStorage.setItem("sona.buddyset.v1", "kept");
    ${quest ? `localStorage.setItem("sona.quest.v1", ${JSON.stringify(JSON.stringify(quest))}.replace(/"TODAY"/g, JSON.stringify(TODAY)));` : ""}
  })();`;
}
async function open(page, opts) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(seedScript(opts));
  const pg = await ctx.newPage(); const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(origin + page); await pg.waitForFunction(() => window.Sona && Sona.questToday);
  return { ctx, pg, errors };
}

// (Home's adventure card, and its handler pin, are homestorytest's: Home is
// the daily story's card now. What stays here about Home is source-only,
// in section 4: it never finishes a quest.)

// ── 1. only today's game finishes the day, once, with a sticker and no coin ──
await section("finishing a quest", async () => {
  const { ctx, pg } = await open("/__sona", { age: 7, premium: true });
  const r = await pg.evaluate(() => {
    const q0 = Sona.questToday();
    const coins0 = Sona.getCoins(), stk0 = Object.keys(Sona.stickersEarned()).length;
    const wrong = Sona.questEnd("tiles");                 // day 1 is Fruit Slice
    const right = Sona.questEnd("slice");
    const again = Sona.questEnd("slice");
    const q = Sona.questToday();
    return { q0, wrong, right, again, q, coins: Sona.getCoins() - coins0, stk: Object.keys(Sona.stickersEarned()).length - stk0, banner: (document.getElementById("sonaQuestBanner") || {}).textContent || "", rec: JSON.parse(localStorage.getItem("sona.quest.v1") || "null") };
  });
  ok("with every story finished (" + STORY_LEN + "), today is the game of the day: day 1, Fruit Slice", r.q0.kind === "game" && r.q0.state === "open" && r.q0.day === 1 && r.q0.game === "slice" && r.q0.total === 14, r.q0);
  ok("another game's round does not finish the day", r.wrong === null, r.wrong);
  ok("a round of today's game finishes day 1", r.right && r.right.day === 1, r.right);
  ok("…once: a second round the same day finishes nothing", r.again === null, r.again);
  ok("the card now says day 1 is done and shows day 2 dark", r.q.kind === "game" && r.q.state === "done" && r.q.day === 1 && r.q.next && r.q.next.kind === "game" && r.q.next.day === 2 && r.q.next.game === "tiles", r.q);
  ok("the save merges: day 2 is next, finished today, and the stories finished stay finished", r.rec && r.rec.i === 1 && r.rec.last === 0 && r.rec.lk === "game" && r.rec.s === STORY_LEN && r.rec.gd === r.rec.done && r.rec.a === r.rec.done, r.rec);
  ok("one sticker for the day", r.stk === 1, r.stk);
  ok("no coins (they come from the chest and the road only)", r.coins === 0, r.coins);
  ok("a quiet note says so", /Day 1 adventure done!/.test(r.banner), r.banner);
  const tiles = await pg.evaluate(() => Sona.questEnd("tiles"));
  ok("tomorrow's game cannot be played early", tiles === null, tiles);
  await ctx.close();
});

// ── 2. the next day, a missed day, days 7 and 14 ──
await section("the days", async () => {
  {
    const { ctx, pg } = await open("/__sona", { age: 7, premium: true, quest: { i: 1, last: 0, done: "TODAY" }, dayShift: 1 });
    const q = await pg.evaluate(() => Sona.questToday());
    ok("the next day opens day 2 (Piano Tiles)", q.state === "open" && q.day === 2 && q.game === "tiles", q);
    await ctx.close();
  }
  {
    // the calendar started the day day 1 was finished (CAL1: `a`)
    const { ctx, pg } = await open("/__sona", { age: 7, premium: true, quest: { a: "TODAY", i: 1, last: 0, done: "TODAY" }, dayShift: 5 });
    const q = await pg.evaluate(() => Sona.questToday());
    ok("a missed day moves it on (CAL1): four days missed, five days on, it is day 6", q.state === "open" && q.day === 6 && q.game === "hoops", q);
    await ctx.close();
  }
  {
    // the same record on its first day of the CAL1 build: the calendar starts
    // that day (`a` is written as the page loads), so it is the next day in
    // order, not a jump over the days before it
    const { ctx, pg } = await open("/__sona", { age: 7, premium: true, quest: { i: 1, last: 0, done: "TODAY" }, dayShift: 5 });
    const r = await pg.evaluate(() => ({ q: Sona.questToday(), rec: JSON.parse(localStorage.getItem("sona.quest.v1")), day: Sona.localDay() }));
    ok("a record from before the calendar, first seen five days on: still day 2, and its calendar starts today", r.q.state === "open" && r.q.day === 2 && r.rec.a === r.day, r);
    await ctx.close();
  }
  {
    // never finished one: each day is the next, played or not
    const days = [];
    for (let shift = 0; shift < 16; shift++) {
      const { ctx, pg } = await open("/__sona", { age: 7, premium: true, quest: { a: "TODAY" }, dayShift: shift });
      days.push(await pg.evaluate(() => { const q = Sona.questToday(); return q.state + q.day; }));
      await ctx.close();
    }
    ok("with nothing played, the calendar's first day is day 1, then day 2, and so on, back to day 1 after day 14",
      days.join() === "open1,open2,open3,open4,open5,open6,open7,open8,open9,open10,open11,open12,open13,open14,open1,open2", days);
  }
  {
    const { ctx, pg } = await open("/__sona", { age: 7, premium: true, quest: { i: 6, last: 5, done: "2026-01-01" } });
    const r = await pg.evaluate(() => { const s0 = Object.keys(Sona.stickersEarned()).length; const q = Sona.questToday(); const e = Sona.questEnd(q.game); return { q, e, s: Object.keys(Sona.stickersEarned()).length - s0 }; });
    ok("day 7 gives two stickers", r.e && r.e.day === 7 && r.s === 2, r);
    await ctx.close();
  }
  {
    const { ctx, pg } = await open("/__sona", { age: 7, premium: true, quest: { i: 13, last: 12, done: "2026-01-01" } });
    const r = await pg.evaluate(() => { const s0 = Object.keys(Sona.stickersEarned()).length; const q = Sona.questToday(); const e = Sona.questEnd(q.game); return { q, e, s: Object.keys(Sona.stickersEarned()).length - s0, after: Sona.questToday() }; });
    ok("day 14 gives two stickers", r.e && r.e.day === 14 && r.s === 2, r);
    ok("…and after day 14 comes day 1 again", r.after.next && r.after.next.day === 1, r.after);
    await ctx.close();
  }
  {
    const { ctx, pg } = await open("/__sona", { age: 7, premium: true, quest: { i: 99, last: -3, done: 7 } });
    const q = await pg.evaluate(() => Sona.questToday());
    ok("a broken saved state reads as day 1, open", q.state === "open" && q.day === 1, q);
    await ctx.close();
  }
});

// ── 3. ages and access ──
await section("ages and access", async () => {
  {
    const { ctx, pg } = await open("/__sona", { age: 4, premium: true });
    const list = await pg.evaluate(() => Sona.QUEST_DAYS.simple.map((d) => d.game));
    const q = await pg.evaluate(() => Sona.questToday());
    ok("ages 3-4 get the little kids' adventure", q.kind === "game" && q.game === "feed", q);
    ok("…made of Feed Echo and Bubble Pop only", list.length === 14 && list.every((g) => g === "feed" || g === "bubbles"), list);
    await ctx.close();
  }
  {
    const { ctx, pg } = await open("/__sona", { age: 7, premium: false, quest: { i: 2, last: 1, done: "2026-01-01" } });
    const r = await pg.evaluate(() => ({ q: Sona.questToday(), stack: Sona.gameAccess("stack").allowed, slice: Sona.gameAccess("slice").allowed }));
    ok("(a family without Premium cannot open Block Stacker here)", r.stack === false && r.slice === true, r);
    ok("…so day 3 sends them to a game they can open, with that game's line", r.q.kind === "game" && r.q.day === 3 && r.q.game !== "stack" && ["slice", "tiles"].includes(r.q.game) && r.q.line.length > 0, r.q);
    await ctx.close();
  }
  {
    const { ctx, pg } = await open("/__sona", { age: 7, premium: true });
    const days = await pg.evaluate(() => Sona.QUEST_DAYS.arcade.map((d) => d.game));
    const acts = await pg.evaluate(() => Object.keys(Sona.QUEST_DAYS).reduce((o, k) => { Sona.QUEST_DAYS[k].forEach((d) => { o[d.game] = !!(Sona.GAME_ACTS[d.game] && !Sona.GAME_ACTS[d.game].comingSoon); }); return o; }, {}));
    ok("the big kids' adventure is 14 days", days.length === 14, days);
    ok("…never the same game two days running (day 14 to day 1 too)", days.every((g, i) => g !== days[(i + 1) % days.length]), days);
    ok("every game the adventure names can be played (none is Coming soon)", Object.values(acts).every(Boolean), acts);
    await ctx.close();
  }
});

// ── 4. every game the adventure can name finishes it from its end card ──
{
  const hooks = { slice: "arcade-slice.html", tiles: "arcade-tiles.html", stack: "arcade-stack.html", run: "arcade-run.html", glide: "arcade-glide.html", rise: "arcade-rise.html", feed: "arcade-feed.html" };
  for (const [key, file] of Object.entries(hooks)) {
    const src = readFileSync(ROOT + "/" + file, "utf8");
    ok(`${file} finishes the quest from its end card`, src.includes(`questEnd("${key}")`));
  }
  const engine = readFileSync(ROOT + "/sayplay.js", "utf8");
  ok("the Say & Play engine (Hoops, Soccer Goal, Dino Dig, Bubble Pop) does too, with its own key", /function showEnd\(\)[\s\S]{0,200}questEnd\(G\.key\)/.test(engine));
  // a game on the list with no hook would leave its day open for ever
  const days = readFileSync(ROOT + "/sona.js", "utf8").match(/const QUEST_DAYS = \{[\s\S]*?\n  \};/);
  const named = [...new Set(((days && days[0]) || "").match(/game: "(\w+)"/g).map((m) => m.slice(7, -1)))];
  const sayGames = ["hoops", "soccer", "dino", "bubbles"];
  ok("every game the adventure names has a way to finish its day", named.length >= 10 && named.every((g) => hooks[g] || sayGames.includes(g)), named);
  ok("Rise Up has a day of its own", named.includes("rise"), named);
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  const block = (sona.match(/QUEST1: the daily adventure[\s\S]*?\/\/ ── Native audio capture/) || [""])[0];
  ok("the adventure mints no coins and asks for nothing new", block.length > 0 && !/addCoins|mintCoins|logAttempt|bumpReps|gameRep\(|recordRung/.test(block.replace(/\/\/.*$/gm, "")));
  ok("its sticker is the next one, never random", /awardNextSticker\(\)/.test(block) && !/awardRandomSticker|Math\.random/.test(block.replace(/\/\/.*$/gm, "")));
  ok("its lines say nothing about HOW to talk (cueing is Rachel's), the stories' hooks included",
    !/louder|slowly|strong|stretch|say it/i.test(JSON.stringify((block.match(/const QUEST_DAYS = \{[\s\S]*?\n  \};/) || [""])[0]) + JSON.stringify((block.match(/const STORY_DAYS = \[[\s\S]*?\n  \];/) || [""])[0])));
  ok("Home never finishes a quest (no questEnd anywhere in today.html, comments included)", !/questEnd/.test(readFileSync(ROOT + "/today.html", "utf8")));
  const relay = readFileSync(ROOT + "/../app/api/track/route.ts", "utf8");
  ok("its event is allow-listed by the relay", relay.includes('"adventure day done"'));
  ok("the adventure is each child's own (PER_KID)", /"sona\.quest\.v1"/.test(sona.slice(sona.indexOf("const PER_KID"), sona.indexOf("const PER_KID") + 4000)));
}

await browser.close(); server.close();
console.log(fails ? `\n${fails} adventure check(s) failed` : "\nall adventure checks passed");
process.exit(fails ? 1 : 0);
