// QUEST1: the daily adventure (Travis, 12-13 Oct 2026: "a new quest or like
// daily activity that they complete every day. That is only showing up for
// that day ... a 14-day rotation"). One quest a day, one round of one game.
// This suite pins the promises a child and a parent can see:
//   - Home shows today's quest and only reads: loading it writes nothing and
//     sends nothing (the Trophy Road card's rule);
//   - only a finished round of TODAY'S game finishes the day, once; tomorrow's
//     is shown dark and cannot be played early;
//   - a missed day loses nothing (the adventure waits), and day 14 goes back
//     to day 1;
//   - a sticker a day, two on days 7 and 14, and never a coin (COIN3);
//   - ages 3-4 get Feed Echo and Bubble Pop; a family without Premium is
//     never sent to a game it cannot open;
//   - every game the adventure can name finishes the quest from its end card.
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

// A set-up child with every era stamp (CLAUDE.md: a seed missing one is
// grandfathered and the paywall vanishes). `premium` opens every game;
// without it the phone keeps the free version (a browser cannot sell here).
function seedScript({ age, premium, quest, dayShift }) {
  return `(() => {
    const SHIFT = ${(dayShift || 0) * 86400000};
    if (SHIFT) { const R = Date; const N = function (...a) { return a.length ? new R(...a) : new R(R.now() + SHIFT); };
      N.now = () => R.now() + SHIFT; N.UTC = R.UTC; N.parse = R.parse; N.prototype = R.prototype; window.Date = N; }
    if (localStorage.getItem("__seeded")) return; localStorage.setItem("__seeded", "1");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "${age}", focusSounds: ["R"], onboarded: true, voiceOn: true, volume: 0.8${premium ? ', earlyAdopter: true' : ''} }));
    localStorage.setItem("sona.freeera.v1", "post");
    ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
    localStorage.setItem("sona.freever.v1", "kept"); localStorage.setItem("sona.buddyset.v1", "kept");
    ${quest ? `localStorage.setItem("sona.quest.v1", ${JSON.stringify(JSON.stringify(quest))});` : ""}
  })();`;
}
async function open(page, opts) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(seedScript(opts));
  const pg = await ctx.newPage(); const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(origin + page); await pg.waitForFunction(() => window.Sona && Sona.questToday);
  return { ctx, pg, errors };
}
const store = (pg) => pg.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });

// ── 1. Home shows today's quest, and only reads ──
await section("Home's adventure card", async () => {
  const { ctx, pg, errors } = await open("/today.html", { age: 7, premium: true });
  await pg.waitForSelector("#questCard:not([hidden])", { timeout: 8000 }).catch(() => {});
  const card = await pg.evaluate(() => { const c = document.getElementById("questCard"); return { hidden: c.hidden, day: c.querySelector("#questDay").textContent, line: c.querySelector("#questLine").textContent, img: (c.querySelector("img") || {}).src || "" }; });
  ok("a new child's Home shows day 1 of 14", !card.hidden && /Day 1 of 14/.test(card.day), card);
  ok("…with day 1's own line and its game's picture", /picnic/.test(card.line) && /home-fruit\.webp$/.test(card.img), card);
  const before = await store(pg), sent = posted.length;
  await pg.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await pg.waitForTimeout(300);
  const after = await store(pg);
  ok("loading Home writes no adventure state", !("sona.quest.v1" in after), Object.keys(after));
  ok("…and coming back to the front changes nothing either", JSON.stringify(before) === JSON.stringify(after));
  ok("…and sends no adventure event", !posted.slice(sent).some((p) => /adventure/.test(p.body)), posted.slice(sent));
  ok("Home has no page errors", errors.length === 0, errors);
  const src = readFileSync(ROOT + "/today.html", "utf8");
  ok("Home never finishes a quest (no questEnd in today.html)", !/questEnd/.test(src));
  ok("the card's tap is the game card's own tap (launch: access, price, levels)", /card\.onclick=function\(\)\{if\(done\)return;launch\(game\);\}/.test(src));
  await ctx.close();
});

// ── 2. only today's game finishes the day, once, with a sticker and no coin ──
await section("finishing a quest", async () => {
  const { ctx, pg } = await open("/__sona", { age: 7, premium: true });
  const r = await pg.evaluate(() => {
    const coins0 = Sona.getCoins(), stk0 = Object.keys(Sona.stickersEarned()).length;
    const wrong = Sona.questEnd("tiles");                 // day 1 is Fruit Slice
    const right = Sona.questEnd("slice");
    const again = Sona.questEnd("slice");
    const q = Sona.questToday();
    return { wrong, right, again, q, coins: Sona.getCoins() - coins0, stk: Object.keys(Sona.stickersEarned()).length - stk0, banner: (document.getElementById("sonaQuestBanner") || {}).textContent || "" };
  });
  ok("another game's round does not finish the day", r.wrong === null, r.wrong);
  ok("a round of today's game finishes day 1", r.right && r.right.day === 1, r.right);
  ok("…once: a second round the same day finishes nothing", r.again === null, r.again);
  ok("the card now says day 1 is done and shows day 2 dark", r.q.state === "done" && r.q.day === 1 && r.q.next && r.q.next.day === 2 && r.q.next.game === "tiles", r.q);
  ok("one sticker for the day", r.stk === 1, r.stk);
  ok("no coins (they come from the chest and the road only)", r.coins === 0, r.coins);
  ok("a quiet note says so", /Day 1 adventure done!/.test(r.banner), r.banner);
  const tiles = await pg.evaluate(() => Sona.questEnd("tiles"));
  ok("tomorrow's game cannot be played early", tiles === null, tiles);
  await ctx.close();
});

// ── 3. the next day, a missed day, days 7 and 14 ──
await section("the days", async () => {
  const today = new Date(), p2 = (n) => String(n).padStart(2, "0");
  const ymd = (d) => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
  {
    const { ctx, pg } = await open("/__sona", { age: 7, premium: true, quest: { i: 1, last: 0, done: ymd(today) }, dayShift: 1 });
    const q = await pg.evaluate(() => Sona.questToday());
    ok("the next day opens day 2 (Piano Tiles)", q.state === "open" && q.day === 2 && q.game === "tiles", q);
    await ctx.close();
  }
  {
    const { ctx, pg } = await open("/__sona", { age: 7, premium: true, quest: { i: 1, last: 0, done: ymd(today) }, dayShift: 5 });
    const q = await pg.evaluate(() => Sona.questToday());
    ok("missing four days loses nothing: still day 2", q.state === "open" && q.day === 2, q);
    await ctx.close();
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

// ── 4. ages and access ──
await section("ages and access", async () => {
  {
    const { ctx, pg } = await open("/__sona", { age: 4, premium: true });
    const list = await pg.evaluate(() => Sona.QUEST_DAYS.simple.map((d) => d.game));
    const q = await pg.evaluate(() => Sona.questToday());
    ok("ages 3-4 get the little kids' adventure", q.game === "feed", q);
    ok("…made of Feed Echo and Bubble Pop only", list.length === 14 && list.every((g) => g === "feed" || g === "bubbles"), list);
    await ctx.close();
  }
  {
    const { ctx, pg } = await open("/__sona", { age: 7, premium: false, quest: { i: 2, last: 1, done: "2026-01-01" } });
    const r = await pg.evaluate(() => ({ q: Sona.questToday(), stack: Sona.gameAccess("stack").allowed, slice: Sona.gameAccess("slice").allowed }));
    ok("(a family without Premium cannot open Block Stacker here)", r.stack === false && r.slice === true, r);
    ok("…so day 3 sends them to a game they can open, with that game's line", r.q.day === 3 && r.q.game !== "stack" && ["slice", "tiles"].includes(r.q.game) && r.q.line.length > 0, r.q);
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

// ── 5. every game the adventure can name finishes it from its end card ──
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
  ok("its lines say nothing about HOW to talk (cueing is Rachel's)", !/louder|slowly|strong|stretch|say it/i.test(JSON.stringify((block.match(/const QUEST_DAYS = \{[\s\S]*?\n  \};/) || [""])[0])));
  const relay = readFileSync(ROOT + "/../app/api/track/route.ts", "utf8");
  ok("its event is allow-listed by the relay", relay.includes('"adventure day done"'));
  ok("the adventure is each child's own (PER_KID)", /"sona\.quest\.v1"/.test(sona.slice(sona.indexOf("const PER_KID"), sona.indexOf("const PER_KID") + 4000)));
}

await browser.close(); server.close();
console.log(fails ? `\n${fails} adventure check(s) failed` : "\nall adventure checks passed");
process.exit(fails ? 1 : 0);
