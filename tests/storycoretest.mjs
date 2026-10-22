// STORY1, the rules under the daily story (22 Oct 2026; Travis chose both
// age groups, today's painted clay look, and the story is Premium). Home, the
// story's own page and the three games have suites of their own; this one
// holds the contract they are all built on:
//   - Sona.questToday() puts the stories before the game of the day, for
//     every child, and a child partway through the 14 days goes back to the
//     day they were on after the last story;
//   - questEnd(<the story's game>) finishes the day once, with one sticker,
//     its event and no banner; storyEnding() and storySeen() read and write
//     only what they say;
//   - the story is Premium by the books' rule: shown locked where the price
//     can open it, never on a phone that cannot buy, never by the
//     demonstration window;
//   - subscribe.html?from=adventure is the offer a locked story card opens;
//   - sayplay.js hands a story's game back to its story (G.exit, G.again).
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";
import { open as phoneOpen, serve, calm, STORES } from "./_phone.mjs";
import { fakeDevice } from "./_sayplaydevice.mjs";

let fails = 0, count = 0;
function ok(label, pass, detail = "") { count++; if (!pass) fails++; console.log((pass ? "PASS " : "FAIL ") + label + (pass ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); }
async function section(label, run) { try { await run(); } catch (e) { ok(label + " completes", false, e.stack); } }

const SONA = readFileSync(ROOT + "/sona.js", "utf8");
// Days 1-3 have their own game pages; Days 4-14 (22 Oct 2026) are Codex's
// games on one shared page, story-game.html (storygametest's). Day 7 is
// "frontdoor": Day 3 already owns "bridge".
const FIRST_IDS = ["lighthouse", "windup", "bridge"];
const LATER_IDS = ["waterwheel", "postboat", "bakery", "frontdoor", "lantern", "trainline", "kite", "nestlift", "concert", "rooftops", "observatory"];
const STORY_IDS = FIRST_IDS.concat(LATER_IDS);

// ── a plain server: public/, /api/* recorded (the voice service is down),
// and stubs for the pages a test only needs to land on ──
const posted = [];
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2", json: "application/json", webmanifest: "application/manifest+json" };
const stub = (title) => '<!doctype html><meta charset="utf-8"><title>' + title + "</title><body><h1>" + title + "</h1></body>";
// A Say & Play page for the exit check: the engine's own DOM, a played game
// that finishes its move the moment the word earns it, and one step, so the
// end card is a single word away. exit and again come from the address.
function exitPage(q) {
  const cfg = { key: q.get("key") || "lighthouse", title: "Light the Way", steps: [[]], finale: [], done: { title: "Every boat is home!", sub: "You lit the way through the fog." }, play: "__STUB__" };
  if (q.has("exit")) cfg.exit = { href: q.get("exit"), label: q.get("label") || undefined };
  if (q.get("again") === "false") cfg.again = false;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Story game</title></head><body data-phase="boot">
  <div id="app"><div id="top"><button id="close" aria-label="Back">✕</button><span id="dots"></span></div>
  <div id="stage"></div>
  <div id="turnPanel"><span id="pic"></span><div id="word"></div><button id="hear">Hear it</button>
  <img id="echoFace" src="/assets/crafted/echo-welcome.webp" alt=""><span id="micState"></span><span id="cheer"></span><button id="micBtn" hidden>mic</button></div></div>
  <div class="ovl" id="startOvl"><div class="ovlCard"><p id="startSound"></p><button id="startBtn">Let's play</button></div></div>
  <div class="ovl" id="primer"><div class="ovlCard"><p id="micPromise"></p><button id="primerYes">Yes</button><button id="primerNo">Not now</button></div></div>
  <div class="ovl" id="pauseOvl"><div class="ovlCard"><button id="resume">Keep playing</button></div></div>
  <div class="ovl" id="endOvl"><div class="ovlCard"><h2 id="endTitle"></h2><p id="endSub"></p><button class="btn" id="again">Play again</button><button class="ghost" id="goHome">Back home</button></div></div>
  <script src="/sona.js"></script><script src="/sayplay.js"></script>
  <script>window.Stub={init:function(api){this.api=api;},onWord:function(){var a=this.api;setTimeout(function(){a.done();},50);},pause:function(){},resume:function(){},finale:function(){},reset:function(){}};
  SayPlay.start(${JSON.stringify(cfg).replace('"__STUB__"', "window.Stub")});</script></body></html>`;
}
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__sona") { res.writeHead(200, { "content-type": "text/html" }); res.end('<!doctype html><title>Store</title><body></body><script src="/sona.js"></script>'); return; }
  if (url.pathname === "/today.html" || url.pathname === "/activities.html" || url.pathname === "/adventure.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(stub(url.pathname)); return; }
  if (url.pathname === "/_storygame.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(exitPage(url.searchParams)); return; }
  if (url.pathname.startsWith("/api/")) {
    let body = ""; req.on("data", (c) => { body += c; });
    req.on("end", () => {
      posted.push({ path: url.pathname, body });
      res.writeHead(url.pathname === "/api/tts" ? 503 : 200, { "content-type": "application/json" }); res.end("{}");
    });
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
// grandfathered and the paywall vanishes). premium: an early adopter, which
// opens everything. sell: this browser sells (the QA seam sona.websalesui),
// so a family without Premium is a family the price can open; stamp: what
// the free-version sweep wrote ("kept" keeps the free version, "post" owes
// the price). sona.paidui keeps the pricing switch on whatever it ships as.
// window.__shiftDays moves this page's calendar on (a test turns it).
function seed({ age = 7, premium = false, sell = false, stamp = "kept", quest = null, demo = false, trial = false, shift = 0 } = {}) {
  return `(() => {
    window.__shiftDays = ${shift};
    const R = Date, N = function (...a) { return a.length ? new R(...a) : new R(R.now() + window.__shiftDays * 86400000); };
    N.now = () => R.now() + window.__shiftDays * 86400000; N.UTC = R.UTC; N.parse = R.parse; N.prototype = R.prototype; window.Date = N;
    try { sessionStorage.setItem("sona.paidui", "1"); ${sell ? 'sessionStorage.setItem("sona.websalesui", "1");' : 'sessionStorage.setItem("sona.websalesui", "0");'} } catch (e) {}
    if (localStorage.getItem("__seeded")) return; localStorage.setItem("__seeded", "1");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "${age}", focusSounds: ["R"], onboarded: true, voiceOn: true, volume: 0.8${premium ? ", earlyAdopter: true" : ""} }));
    localStorage.setItem("sona.freeera.v1", "post");
    ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
    localStorage.setItem("sona.freever.v1", "${stamp}"); localStorage.setItem("sona.buddyset.v1", "kept");
    localStorage.setItem("sona.offerseen.v1", "1");
    ${quest ? `localStorage.setItem("sona.quest.v1", ${JSON.stringify(JSON.stringify(quest))});` : ""}
    ${demo ? 'localStorage.setItem("sona.demo.v1", JSON.stringify({ started: Date.now() - 3600000, done: 0 }));' : ""}
    ${trial ? 'localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 3600000 }));' : ""}
  })();`;
}
async function open(opts) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(seed(opts));
  const pg = await ctx.newPage(); const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(origin + "/__sona"); await pg.waitForFunction(() => window.Sona && Sona.questToday);
  return { ctx, pg, errors };
}
const record = (pg) => pg.evaluate(() => JSON.parse(localStorage.getItem("sona.quest.v1") || "null"));
const nextDay = (pg, n = 1) => pg.evaluate((n) => { window.__shiftDays += n; }, n);
const localYmd = (pg) => pg.evaluate(() => Sona.localDay());
const events = (since, name) => posted.slice(since).filter((p) => p.path === "/api/track").map((p) => { try { return JSON.parse(p.body); } catch (e) { return {}; } }).filter((b) => !name || b.e === name);

// ── 0. the day list and its keys ──
await section("the day list", async () => {
  const { ctx, pg, errors } = await open({ premium: true });
  const r = await pg.evaluate(() => ({
    days: Sona.STORY_DAYS.map((d) => ({ id: d.id, game: d.game, page: d.page, hero: d.hero, title: d.title, line: d.line })),
    fns: ["storyOpen", "storyShown", "storyEnding", "storySeen"].every((f) => typeof Sona[f] === "function"),
    notCatalog: ["adventure"].concat(Sona.STORY_DAYS.map((d) => d.id)).every((k) => Sona.gameKey(k) === "" && !Sona.GAME_ACTS[k]),
    words: { lighthouse: Sona.gameWords("lighthouse", "R").map((w) => w.w), windup: Sona.gameWords("windup", "K").map((w) => w.w), bridge: Sona.gameWords("bridge", "CH").map((w) => w.w) },
  }));
  ok("STORY_DAYS is the fourteen days in order, each with its game, page and Home picture",
    r.days.map((d) => d.id).join() === STORY_IDS.join() && r.days.every((d) => d.game === d.id && d.hero === d.id && d.page === (FIRST_IDS.includes(d.id) ? "/arcade-" + d.id + ".html" : "/story-game.html?story=" + d.id)), r.days);
  ok("…Days 1-3 titled as the spec names them, and every later day a short title of its own",
    r.days.slice(0, 3).map((d) => d.title).join("|") === "The Lighthouse Sneeze|Grandpa Bear's Sleepy Toys|The Puzzle Bridge" &&
    r.days.slice(3).every((d) => d.title.length > 5 && d.title.length <= 36) && new Set(r.days.map((d) => d.title)).size === 14, r.days.map((d) => d.title));
  ok("…each hook a line a parent reads: 120 characters at most, nothing about how to talk, no banned word",
    r.days.every((d) => d.line.length > 20 && d.line.length <= 120 && !/louder|slowly|strong|stretch|say it|score|points|correct|wrong|miss|fail|charge/i.test(d.line)), r.days.map((d) => d.line));
  ok("the four story readers are on Sona", r.fns);
  ok("no story key is a catalog game: no shelf, no picks row, no setup grid, no game count", r.notCatalog);
  ok("the three games have story words, read through the same reader as every game's",
    r.words.lighthouse.join() === "rock,rain" && r.words.windup.join() === "key,kite" && r.words.bridge.join() === "cherry,cheese", r.words);
  const relay = readFileSync(ROOT + "/../app/api/track/route.ts", "utf8");
  const allowed = (relay.match(/const EVENTS = new Set\(\[([\s\S]*?)\]\)/) || ["", ""])[1];
  ok("the relay takes the story's two events", allowed.includes('"adventure opened"') && allowed.includes('"adventure ending watched"'));
  ok("no page errors", errors.length === 0, errors);
  await ctx.close();
});

// ── 1. a new Premium child: story Day 1, finished by its game's round ──
await section("a new Premium child", async () => {
  const { ctx, pg, errors } = await open({ premium: true });
  const sent = posted.length;
  const r = await pg.evaluate(() => {
    const q0 = Sona.questToday(), acc = Sona.gameAccess("lighthouse"), card = Sona.gameAccess("adventure");
    const before = { coins: Sona.getCoins(), stk: Object.keys(Sona.stickersEarned()) };
    const endingBefore = Sona.storyEnding("lighthouse");
    const wrong = Sona.questEnd("slice");
    const right = Sona.questEnd("lighthouse");
    const again = Sona.questEnd("lighthouse"), early = Sona.questEnd("windup");
    const stk = Object.keys(Sona.stickersEarned()).filter((k) => before.stk.indexOf(k) < 0);
    return { q0, acc, card, endingBefore, wrong, right, again, early, stk, coins: Sona.getCoins() - before.coins,
      banner: !!document.getElementById("sonaQuestBanner"), q1: Sona.questToday(),
      ending: Sona.storyEnding("lighthouse"), endingNext: Sona.storyEnding("windup"), endingJunk: Sona.storyEnding("nope") };
  });
  ok("a new Premium child's adventure is story Day 1, the lighthouse, open",
    r.q0.kind === "story" && r.q0.state === "open" && r.q0.day === 1 && r.q0.game === "lighthouse" && r.q0.story && r.q0.story.id === "lighthouse" && r.q0.seen === false, r.q0);
  ok("…its card carries the story's hook and its Home picture", r.q0.line === r.q0.story.line && r.q0.story.pic === "/assets/crafted/home-lighthouse.webp" && r.q0.story.title === "The Lighthouse Sneeze", r.q0.story);
  ok("the story and its game are open to a Premium child, as Premium", r.acc.allowed && r.card.allowed && r.acc.tier === "premium" && r.acc.reason === "entitled", [r.acc, r.card]);
  ok("storyEnding refuses a story not yet finished", r.endingBefore.ok === false && r.endingBefore.got.length === 0, r.endingBefore);
  ok("a round of another game does not finish a story day", r.wrong === null, r.wrong);
  ok("the story's own game finishes Day 1", r.right && r.right.day === 1 && r.right.story === "lighthouse", r.right);
  ok("…with exactly one sticker, the next one", r.stk.length === 1 && r.right.stickers.length === 1 && r.right.stickers[0].id === r.stk[0], { stk: r.stk, got: r.right.stickers });
  ok("…no coins (COIN3), and no banner (the ending shows the sticker)", r.coins === 0 && r.banner === false, { coins: r.coins, banner: r.banner });
  ok("…once: a second round finishes nothing, and tomorrow's story cannot be played early", r.again === null && r.early === null, [r.again, r.early]);
  ok("the card now says Day 1 is done, with Day 2 (the toy shop) next, dark",
    r.q1.kind === "story" && r.q1.state === "done" && r.q1.day === 1 && r.q1.next && r.q1.next.kind === "story" && r.q1.next.day === 2 && r.q1.next.game === "windup" && r.q1.next.story.id === "windup", r.q1);
  ok("storyEnding now opens the lighthouse's ending, with the sticker today gave", r.ending.ok && r.ending.got.length === 1 && r.ending.got[0].id === r.stk[0] && r.ending.got[0].e && r.ending.got[0].name, r.ending);
  ok("…and still refuses the next story, and an id that is no story", !r.endingNext.ok && !r.endingJunk.ok, [r.endingNext, r.endingJunk]);
  const rec = await record(pg), day = await localYmd(pg);
  ok("the record: s=1, the last story 0, finished today, its sticker kept; the 14-day place untouched",
    rec.s === 1 && rec.ls === 0 && rec.lk === "story" && rec.done === day && JSON.stringify(rec.got) === JSON.stringify(r.stk) && rec.i === undefined && rec.last === undefined, rec);
  const ev = events(sent, "adventure day done");
  ok("one \"adventure day done\" event, carrying the game key only", ev.length === 1 && JSON.stringify(ev[0].p) === JSON.stringify({ game: "lighthouse" }), ev);
  ok("no page errors", errors.length === 0, errors);
  await ctx.close();
});

// ── 2. ages 3-4 get the same story (both age groups) ──
await section("a little one", async () => {
  const { ctx, pg } = await open({ age: 4, premium: true });
  const q = await pg.evaluate(() => Sona.questToday());
  ok("a four-year-old's Premium adventure is story Day 1 too (one game serves both ages)", q.kind === "story" && q.day === 1 && q.game === "lighthouse", q);
  await ctx.close();
});

// ── 3. day by day: fourteen stories, then back to the 14 days where they were ──
await section("fourteen stories, then day 8", async () => {
  const { ctx, pg, errors } = await open({ premium: true, quest: { i: 7, last: 6, done: "2026-01-01" } });
  const seen = [];
  for (const id of STORY_IDS) {
    const q = await pg.evaluate(() => Sona.questToday());
    seen.push(q.kind + ":" + q.state + ":" + q.day + ":" + q.game);
    await pg.evaluate((g) => Sona.questEnd(g), id);
    const rec = await record(pg);
    if (rec.i !== 7 || rec.last !== 6) seen.push("moved i: " + JSON.stringify(rec));
    await nextDay(pg);
  }
  ok("a child at day 8 of the 14 meets the stories first: Day 1 to Day 14, a day each",
    seen.join(" ") === STORY_IDS.map((id, n) => "story:open:" + (n + 1) + ":" + id).join(" "), seen);
  await nextDay(pg, -1);
  const doneLast = await pg.evaluate(() => Sona.questToday());
  const arcade = await pg.evaluate(() => Sona.QUEST_DAYS.arcade.map((d) => d.game));
  ok("the day Day 14 is finished, tomorrow is the game of the day, back on day 8",
    doneLast.kind === "story" && doneLast.state === "done" && doneLast.day === 14 && doneLast.next && doneLast.next.kind === "game" && doneLast.next.day === 8 && doneLast.next.game === arcade[7], doneLast);
  await nextDay(pg);
  const back = await pg.evaluate(() => Sona.questToday());
  ok("…and the next day it is day 8, with its own game and line", back.kind === "game" && back.state === "open" && back.day === 8 && back.game === arcade[7] && back.total === 14 && back.line.length > 0, back);
  const end = await pg.evaluate((g) => Sona.questEnd(g), back.game);
  const rec = await record(pg);
  ok("a game day finished after the stories moves on to day 9 and keeps the stories finished",
    end && end.day === 8 && rec.i === 8 && rec.last === 7 && rec.s === 14 && rec.lk === "game", { end, rec });
  await nextDay(pg);
  const nine = await pg.evaluate(() => Sona.questToday());
  ok("…then day 9", nine.kind === "game" && nine.day === 9, nine);
  ok("no page errors", errors.length === 0, errors);
  await ctx.close();
});

// ── 4. once a calendar day, and a missed day loses nothing ──
await section("one a day", async () => {
  {
    const { ctx, pg } = await open({ premium: true });
    await pg.evaluate(() => Sona.questEnd("lighthouse"));
    await nextDay(pg);
    const d2 = await pg.evaluate(() => Sona.questToday());
    ok("the next day opens Day 2", d2.kind === "story" && d2.state === "open" && d2.day === 2 && d2.game === "windup", d2);
    await nextDay(pg, 4);
    const later = await pg.evaluate(() => Sona.questToday());
    ok("missing four days loses nothing: still Day 2, open", later.kind === "story" && later.state === "open" && later.day === 2, later);
    await ctx.close();
  }
  {
    // a game day finished today (say before Premium was bought, or a record
    // from before the stories): today stays done, the story waits for tomorrow
    const { ctx, pg } = await open({ premium: true });
    const day = await localYmd(pg);
    await pg.evaluate((d) => localStorage.setItem("sona.quest.v1", JSON.stringify({ i: 3, last: 2, done: d })), day);
    const r = await pg.evaluate(() => ({ q: Sona.questToday(), end: Sona.questEnd("lighthouse") }));
    ok("a game day finished today (a record from before the stories) stays done today, with the story next",
      r.q.kind === "game" && r.q.state === "done" && r.q.day === 3 && r.q.next && r.q.next.kind === "story" && r.q.next.day === 1 && r.q.next.game === "lighthouse", r.q);
    ok("…so the story cannot be finished the same day", r.end === null, r.end);
    await nextDay(pg);
    const t = await pg.evaluate(() => Sona.questToday());
    ok("…and tomorrow it is story Day 1", t.kind === "story" && t.state === "open" && t.day === 1, t);
    await ctx.close();
  }
});

// ── 5. what the record holds, and what a broken one reads as ──
await section("the record", async () => {
  {
    const { ctx, pg } = await open({ premium: true, quest: { i: 4, last: 3, done: "2026-01-01", keep: "me" } });
    const before = await record(pg);
    const r = await pg.evaluate(() => ({ wrong: Sona.storySeen("windup"), right: Sona.storySeen("lighthouse"), q: Sona.questToday() }));
    const after = await record(pg), day = await localYmd(pg);
    ok("storySeen records today's story only", r.wrong === false && r.right === true, r);
    ok("…writing seen and nothing else", after.seen === day + "|lighthouse" && JSON.stringify(Object.assign({}, after, { seen: undefined })) === JSON.stringify(Object.assign({}, before, { seen: undefined })), { before, after });
    ok("…and questToday says today's intro was watched", r.q.kind === "story" && r.q.seen === true, r.q);
    await nextDay(pg);
    const tomorrow = await pg.evaluate(() => Sona.questToday());
    ok("…on that day only", tomorrow.seen === false, tomorrow);
    await pg.evaluate(() => Sona.questEnd("lighthouse"));
    const merged = await record(pg);
    ok("finishing the story merges into the record (nothing it did not write is lost)", merged.keep === "me" && merged.i === 4 && merged.last === 3 && merged.s === 1, merged);
    await ctx.close();
  }
  {
    const { ctx, pg } = await open({ premium: true });
    const day = await localYmd(pg);
    await pg.evaluate((d) => localStorage.setItem("sona.quest.v1", JSON.stringify({ i: 2, last: 1, done: d, s: "x", ls: 9, lk: "story", got: ["nope", 5], seen: "junk" })), day);
    const r = await pg.evaluate(() => ({ q: Sona.questToday(), e: Sona.storyEnding("lighthouse") }));
    ok("a broken story record reads as no story finished: today's finish was a game day, story Day 1 next",
      r.q.kind === "game" && r.q.state === "done" && r.q.next.kind === "story" && r.q.next.day === 1 && r.e.ok === false, r);
    await pg.evaluate(() => localStorage.setItem("sona.quest.v1", JSON.stringify({ i: 5, last: 4, done: "2026-01-01", s: 99 })));
    const all = await pg.evaluate(() => Sona.questToday());
    ok("more stories than this build knows (a newer backup) is every story finished: the game of the day", all.kind === "game" && all.state === "open" && all.day === 6, all);
    await ctx.close();
  }
});

// ── 6. a phone that can sell, without Premium: the story is shown, locked ──
await section("locked where the price can open it", async () => {
  for (const stamp of ["post", "kept"]) {
    const { ctx, pg, errors } = await open({ sell: true, stamp });
    const sent = posted.length;
    const r = await pg.evaluate(() => ({
      open: Sona.storyOpen(), shown: Sona.storyShown(), offer: Sona.offerOnLock(), q: Sona.questToday(),
      game: Sona.gameAccess("lighthouse"), card: Sona.gameAccess("adventure"), all: Sona.STORY_DAYS.slice(1).map((d) => Sona.gameAccess(d.game).allowed),
      end: Sona.questEnd("lighthouse"), stk: Object.keys(Sona.stickersEarned()).length,
    }));
    const label = stamp === "post" ? "a family who owes the price" : "a family who keeps the free version";
    ok(label + ": the story is shown (storyShown), locked (storyOpen is false)", r.shown && !r.open && r.offer, r);
    ok(label + ": today is story Day 1", r.q.kind === "story" && r.q.state === "open" && r.q.day === 1, r.q);
    ok(label + ": neither the card nor any story game is allowed, and each says Premium",
      !r.game.allowed && !r.card.allowed && r.all.every((a) => !a) && r.game.tier === "premium" && r.game.reason === "premium" && r.card.reason === "premium", [r.game, r.card, r.all]);
    ok(label + ": a round reached without the story finishes nothing", r.end === null && r.stk === 0 && (await record(pg)) === null && events(sent, "adventure day done").length === 0, r.end);
    ok(label + ": no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // a typed address to a story game, bounced: Home, never the Arcade's note
    const { ctx, pg } = await open({ sell: true, stamp: "post" });
    await pg.evaluate(() => Sona.gameBounce("windup"));
    await pg.waitForURL(/\/today\.html$/, { timeout: 4000 });
    ok("a story game's bounce goes to Home (/today.html), not /activities.html?locked=", new URL(pg.url()).pathname === "/today.html" && !/locked/.test(pg.url()), pg.url());
    await ctx.close();
  }
  {
    // a trial opens it
    const { ctx, pg } = await open({ sell: true, stamp: "post", trial: true });
    const r = await pg.evaluate(() => ({ open: Sona.storyOpen(), game: Sona.gameAccess("lighthouse") }));
    ok("a trial opens the story and its games", r.open && r.game.allowed && r.game.reason === "trial", r);
    await ctx.close();
  }
});

// ── 7. a phone that cannot buy, without Premium: the game of the day ──
await section("a phone that cannot buy", async () => {
  const { ctx, pg, errors } = await open({ sell: false, stamp: "post", quest: { i: 2, last: 1, done: "2026-01-01" } });
  const r = await pg.evaluate(() => ({ shown: Sona.storyShown(), open: Sona.storyOpen(), q: Sona.questToday(), stack: Sona.gameAccess("stack").allowed, game: Sona.gameAccess("lighthouse").allowed }));
  ok("no story is shown: a wall nobody can pass is a broken app", r.shown === false && r.open === false && r.game === false, r);
  ok("…the card is the game of the day (day 3), borrowing a game this phone can open", r.q.kind === "game" && r.q.state === "open" && r.q.day === 3 && r.stack === false && ["slice", "tiles"].includes(r.q.game) && r.q.line.length > 0, r.q);
  ok("no page errors", errors.length === 0, errors);
  await ctx.close();
});

// ── 8. the demonstration window opens no story ──
await section("the demonstration window", async () => {
  const { ctx, pg } = await open({ sell: true, stamp: "post", demo: true });
  const r = await pg.evaluate(() => ({ demoDone: Sona.demoDone(), open: Sona.storyOpen(), game: Sona.gameAccess("lighthouse").allowed, card: Sona.gameAccess("adventure").allowed, q: Sona.questToday(), end: Sona.questEnd("lighthouse") }));
  ok("(the demonstration window is open)", r.demoDone === false, r);
  ok("…and opens no story and no story game", !r.open && !r.game && !r.card && r.end === null, r);
  await ctx.close();
});

// ── 9. the source rules the QUEST1 block keeps, stories included ──
{
  const block = (SONA.match(/QUEST1: the daily adventure[\s\S]*?\/\/ ── Native audio capture/) || [""])[0];
  const code = block.replace(/\/\/.*$/gm, "");
  ok("the story code sits inside the QUEST1 block", /const STORY_DAYS = \[/.test(block) && /function storyOpen\(\)/.test(block) && /function storyEnding\(id\)/.test(block) && /function storySeen\(id\)/.test(block));
  ok("…which still mints no coins, asks for nothing new and picks nothing at random",
    block.length > 0 && !/addCoins|mintCoins|logAttempt|bumpReps|gameRep\(|recordRung|Math\.random|awardRandomSticker/.test(code));
  ok("…and whose lines say nothing about how to talk", !/louder|slowly|strong|stretch|say it/i.test((block.match(/const STORY_DAYS = \[[\s\S]*?\n  \];/) || [""])[0]));
  ok("storyOpen is the books' rule, and the founders' preview reads its own plan",
    /function storyOpen\(\) \{[\s\S]{0,200}libraryPreview\(\)\) return previewPlan\(\)\.state === "trial";[\s\S]{0,40}return isFree\(\) \|\| premium\(\) \|\| trialActive\(\);/.test(SONA)
    && /function storyShown\(\) \{ try \{ return storyOpen\(\) \|\| offerOnLock\(\);/.test(SONA));
  ok("gameAccess and gameBounce know the story keys before the catalog's check", /function gameAccess\(key, options\) \{[\s\S]{0,600}if \(_storyKey\(key\)\) \{[\s\S]{0,400}\}\s*key = gameKey\(key\);/.test(SONA) && /_storyKey\(key\) \? "\/today\.html"/.test(SONA));
  ok("the story readers are on the one-line export", /global\.Sona = \{[^\n]*\bSTORY_DAYS, storyOpen, storyShown, storyEnding, storySeen\b/.test(SONA));
}

// ── 10. subscribe.html?from=adventure: the offer a locked story card opens ──
await section("the story's offer", async () => {
  const { base, hits, close } = await serve({ pages: { "/today.html": stub("Home") } });
  try {
    for (const finished of [false, true]) {
      const cfg = { app: "buy", stamp: "post", setUp: true, noGate: true, store: STORES.monthlyFree };
      if (finished) cfg.local = { "sona.quest.v1": { i: 0, last: 13, done: "2026-01-01", s: 14, ls: 13, lk: "story" } };
      const { context, page, errors, requests } = await phoneOpen(browser, base, cfg);
      try {
        // REPLAY1: watch every call to SonaAnalytics.replay, whichever copy
        // (chained onto the fake phone's own watcher, which records events)
        await page.addInitScript(() => {
          window.__replays = []; let real; const prev = Object.getOwnPropertyDescriptor(window, "SonaAnalytics");
          Object.defineProperty(window, "SonaAnalytics", { configurable: true, get: () => (prev && prev.get ? prev.get() : real), set: (v) => {
            if (v && typeof v.replay === "function") { const r = v.replay; v.replay = function (on) { window.__replays.push(on); return r.apply(this, arguments); }; }
            if (prev && prev.set) prev.set(v); else real = v; } });
        });
        const sent = hits.length;
        await page.goto(base + "/subscribe.html?from=adventure");
        await page.waitForFunction(() => document.body.classList.contains("offer"), null, { timeout: 8000 });
        await page.waitForFunction(() => /^(free|paid)$/.test(document.getElementById("iapCard").getAttribute("data-state")), null, { timeout: 8000 });
        await page.waitForTimeout(300);
        const s = await page.evaluate(() => ({
          url: location.pathname + location.search, title: document.getElementById("offerTitle").textContent,
          art: [...document.querySelectorAll("#offerArt img")].map((i) => i.getAttribute("src")), solo: document.getElementById("offerArt").classList.contains("solo"),
          replays: window.__replays.slice(), events: ((window.__phone && window.__phone.events) || []).filter((e) => e.name === "paywall viewed").map((e) => e.props),
        }));
        if (!finished) {
          ok("?from=adventure shows the offer, with no grown-ups check in front of it", s.url === "/subscribe.html?from=adventure" && !requests.some((r) => /gate=1|gate\.html/.test(r.url)), { url: s.url });
          ok("…headed \"Unlock today's story, and every game\"", s.title === "Unlock today's story, and every game", s.title);
          ok("…with today's story picture and Echo, not the fan of games", s.solo && s.art.length === 2 && s.art[0] === "/assets/crafted/home-lighthouse.webp" && /echo-wave\.webp$/.test(s.art[1]), s.art);
          ok("…its impression names the story's door", s.events.length === 1 && s.events[0].source === "from-adventure", s.events);
          // the watcher is on the live object (so an empty list means something)
          const watched = await page.evaluate(() => { const n = window.__replays.length; try { SonaAnalytics.replay(false); } catch (e) {} return window.__replays.length === n + 1; });
          ok("…and nothing records it (REPLAY1: only ?setup=1 and ?first=1)", watched && !s.replays.includes(true), { watched, replays: s.replays });
          await calm(page);
          await page.locator("#declineLink").click();
          await page.waitForURL(/\/today\.html$/, { timeout: 6000 });
          ok("the X goes back to Home (/today.html)", new URL(page.url()).pathname === "/today.html");
          const gone = hits.slice(sent).filter((h) => h.path === "/api/track" && /"offer dismissed"/.test(h.body)).map((h) => JSON.parse(h.body));
          ok("…and \"offer dismissed\" names the story's surface", gone.length === 1 && gone[0].p.surface === "adventure", gone);
        } else {
          ok("with every story finished, ?from=adventure is the plain offer: it never names a story that is not there",
            s.title === "Unlock every game for Mia" && !s.art.includes("/assets/crafted/home-lighthouse.webp"), s);
        }
        ok("the story's offer: no page errors" + (finished ? " (every story finished)" : ""), errors.length === 0, errors);
      } finally { await context.close(); }
    }
  } finally { await close(); }
});

// ── 11. sayplay.js: a story's game hands back to its story ──
async function gamePage(query, cfg = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (route) => route.request().url().startsWith(origin + "/") ? route.continue() : route.abort());
  await context.addInitScript(fakeDevice, Object.assign({ age: "7", micok: true, permission: "granted", speechMs: 80 }, cfg));
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/_storygame.html?" + query);
  return { context, page, errors };
}
const until = (page, fn, ms) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true, () => false);
async function voice(page, ms) { await page.evaluate(() => { __quiet.voice = true; }); await page.waitForTimeout(ms); await page.evaluate(() => { __quiet.voice = false; }); }
async function sayTwice(page) {
  if (!(await until(page, () => window.__sayplay && window.__sayplay.listening === true, 8000))) return false;
  await page.waitForTimeout(80); await voice(page, 260);
  if (!(await until(page, () => window.__sayplay.said === 1 && window.__sayplay.listening === true, 3000))) return false;
  await page.waitForTimeout(320); await voice(page, 260);
  return true;
}
const endCard = (page) => page.evaluate(() => {
  const b = document.getElementById("goHome"), a = document.getElementById("again");
  return { text: b.textContent, cls: b.className, again: a.hidden };
});
const EXIT = "/adventure.html?part=end&story=lighthouse";

await section("the story game's end card", async () => {
  const { context, page, errors } = await gamePage("exit=" + encodeURIComponent(EXIT) + "&label=" + encodeURIComponent("See what happens!") + "&again=false");
  try {
    await page.locator("#startBtn").click();
    ok("the word is asked for", await sayTwice(page));
    ok("…and the round ends on the end card", await until(page, () => window.__sayplay && window.__sayplay.phase === "end", 8000), await page.evaluate(() => window.__sayplay));
    const c = await endCard(page);
    ok("G.exit: the end card's one button says \"See what happens!\" and is the teal main button", c.text === "See what happens!" && c.cls === "btn", c);
    ok("G.again === false: there is no Play again", c.again === true, c);
    const q = await page.evaluate(() => ({ q: Sona.questToday(), e: Sona.storyEnding("lighthouse") }));
    ok("the end card finished the story's day (questEnd from showEnd), so its ending opens", q.q.kind === "story" && q.q.state === "done" && q.q.day === 1 && q.e.ok, q);
    await page.locator("#goHome").click();
    await page.waitForURL((u) => u.pathname === "/adventure.html", { timeout: 6000 });
    const u = new URL(page.url());
    ok("…and its tap opens the story's ending", u.pathname + u.search === EXIT, page.url());
    ok("no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});
await section("the ✕ during a story game", async () => {
  const { context, page, errors } = await gamePage("exit=" + encodeURIComponent(EXIT) + "&again=false");
  try {
    const c = await endCard(page);
    ok("with no label, the button still says \"See what happens!\"", c.text === "See what happens!" && c.cls === "btn", c);
    await page.locator("#startBtn").click();
    await until(page, () => window.__sayplay && window.__sayplay.listening === true, 8000);
    await page.locator("#close").click();
    await page.waitForURL(/\/today\.html$/, { timeout: 6000 });
    ok("the ✕ during play still goes Home: a child who leaves mid-game wants out", new URL(page.url()).pathname === "/today.html");
    ok("no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});
await section("an exit that is not a story's ending", async () => {
  for (const bad of ["https://example.com/adventure.html?part=end&story=lighthouse", "/today.html?part=end&story=lighthouse", "/adventure.html?part=end&story=lighthouse&x=1", "/adventure.html?part=end&story=Light", "//adventure.html?part=end&story=a"]) {
    const { context, page, errors } = await gamePage("exit=" + encodeURIComponent(bad));
    try {
      const c = await endCard(page);
      ok("ignored: " + bad + " (the card keeps Back home and Play again)", c.text === "Back home" && c.cls === "ghost" && c.again === false, c);
      await page.evaluate(() => document.getElementById("goHome").click());
      await page.waitForURL(/\/today\.html$/, { timeout: 6000 });
      ok("…and its button goes Home", new URL(page.url()).pathname === "/today.html");
      ok("…no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  }
});
await section("a story game without Premium", async () => {
  const { context, page, errors } = await gamePage("exit=" + encodeURIComponent(EXIT) + "&again=false", { premium: false });
  try {
    await page.waitForURL(/\/today\.html$/, { timeout: 6000 });
    ok("the engine's own check bounces a story game Home before any mic or sound", (await page.evaluate(() => __quiet.requests)) === 0 && new URL(page.url()).pathname === "/today.html", page.url());
    ok("no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await browser.close(); server.close();
console.log(fails ? `\n${fails} of ${count} story checks failed` : `\nall ${count} story checks passed`);
process.exit(fails ? 1 : 0);
