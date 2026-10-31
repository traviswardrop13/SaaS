// STORY1, the rules under the daily story (22 Oct 2026; Travis chose both
// age groups, today's painted clay look, and the story is Premium). Home, the
// story's own page and the three games have suites of their own; this one
// holds the contract they are all built on:
//   - Sona.questToday() puts the stories before the game of the day, for
//     every child, and a child partway through the 14 days goes back to the
//     day they were on after the last story;
//   - a new day is the next story, played or not (CAL1, 28 Oct 2026: Travis
//     wants it "different every day. Even if they didn't do the daily
//     practice the day prior"), and a story skipped comes back once the
//     others have had their day; each child's calendar starts the day they
//     are set up, or for a child set up before CAL1 the first day it runs;
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
// window.__shiftDays moves this page's calendar on (a test turns it), by
// whole local days at the same time of day, so a run near midnight or across
// a clock change never lands two steps on one date.
function seed({ age = 7, premium = false, sell = false, stamp = "kept", quest = null, demo = false, trial = false, shift = 0 } = {}) {
  return `(() => {
    window.__shiftDays = (() => { try { const v = sessionStorage.getItem("__shift"); if (v !== null) return Number(v); } catch (e) {} return ${shift}; })();
    const R = Date, at = () => { const r = new R(R.now()); return new R(r.getFullYear(), r.getMonth(), r.getDate() + window.__shiftDays, r.getHours(), r.getMinutes(), r.getSeconds(), r.getMilliseconds()).getTime(); };
    const N = function (...a) { return a.length ? new R(...a) : new R(at()); };
    N.now = at; N.UTC = R.UTC; N.parse = R.parse; N.prototype = R.prototype; window.Date = N;
    // TALK1: this suite plays the lighthouse as Day 1 (a child on a sound with no talking story still meets it); talkstorytest plays the talking ones
    try { sessionStorage.setItem("sona.talkoff", "1"); sessionStorage.setItem("sona.paidui", "1"); ${sell ? 'sessionStorage.setItem("sona.websalesui", "1");' : 'sessionStorage.setItem("sona.websalesui", "0");'} } catch (e) {}
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
const nextDay = (pg, n = 1) => pg.evaluate((n) => { window.__shiftDays += n; try { sessionStorage.setItem("__shift", String(window.__shiftDays)); } catch (e) {} }, n);
const reload = async (pg) => { await pg.reload(); await pg.waitForFunction(() => window.Sona && Sona.questToday); };
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
  ok("…the stories finished, in the order they were (f: [0]), the day of the last (fd), the day the calendar started and the day the stories first showed (a, sv: today, its first load)",
    JSON.stringify(rec.f) === "[0]" && rec.fd === day && rec.a === day && rec.sv === day, rec);
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

// ── 3b. FOUND1 (23 Oct 2026): every story leaves its game behind ──
await section("the games the stories leave behind", async () => {
  {
    const { ctx, pg, errors } = await open({ premium: true });
    const none = await pg.evaluate(() => ({ f: Sona.storyFound(), r: Sona.storyReplay("lighthouse") }));
    ok("a child who has finished no story has found nothing, and no replay opens", Array.isArray(none.f) && none.f.length === 0 && none.r === false, none);
    await pg.evaluate(() => Sona.questEnd("lighthouse"));
    const before = await record(pg);
    const one = await pg.evaluate(() => ({ f: Sona.storyFound(), r: [Sona.storyReplay("lighthouse"), Sona.storyReplay("windup"), Sona.storyReplay("nope"), Sona.storyReplay("")] }));
    const d = one.f[0] || {};
    ok("Day 1 finished: Light the Way is found, with its name, its Home picture and the address that plays it again",
      one.f.length === 1 && d.id === "lighthouse" && d.game === "lighthouse" && d.name === "Light the Way" && d.pic === "/assets/crafted/home-lighthouse.webp" && d.again === "/arcade-lighthouse.html?again=1" && d.day === 1, one.f);
    ok("…its replay opens; an unfinished story's, an unknown id and an empty one do not", one.r.join() === "true,false,false,false", one.r);
    ok("…and reading it wrote nothing", JSON.stringify(await record(pg)) === JSON.stringify(before));
    await pg.evaluate(() => { const f = Sona.storyFound(); f[0].again = "/evil.html"; f.push({ id: "x" }); });
    ok("…it hands out copies: changing what it gave changes nothing", (await pg.evaluate(() => Sona.storyFound().map((x) => x.again).join())) === "/arcade-lighthouse.html?again=1");
    await nextDay(pg);
    const replay = await pg.evaluate(() => ({ end: Sona.questEnd("lighthouse"), q: Sona.questToday() }));
    ok("a found game's round on another day finishes nothing (today's story is Day 2)", replay.end === null && replay.q.kind === "story" && replay.q.state === "open" && replay.q.day === 2, replay);
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    const { ctx, pg } = await open({ premium: true, quest: { i: 0, last: 13, s: 7, ls: 6, lk: "story", done: "2026-01-01" } });
    const f = await pg.evaluate(() => Sona.storyFound());
    ok("seven stories finished: their seven games, in story order", f.map((x) => x.id).join() === STORY_IDS.slice(0, 7).join(), f.map((x) => x.id));
    ok("…a Days 4-14 game plays again on the shared page, and Day 7 is frontdoor's, never Codex's bridge",
      f[3].again === "/story-game.html?story=waterwheel&again=1" && f[6].id === "frontdoor" && f[6].again === "/story-game.html?story=frontdoor&again=1", [f[3].again, f[6].again]);
    await ctx.close();
  }
  {
    // the story's rule decides, as it does for the story itself
    const { ctx, pg } = await open({ sell: true, stamp: "post", quest: { i: 0, last: 13, s: 3, ls: 2, lk: "story", done: "2026-01-01" } });
    const r = await pg.evaluate(() => ({ n: Sona.storyFound().length, r: Sona.storyFound().map((d) => Sona.storyReplay(d.id)) }));
    ok("without Premium (the story shown locked), three found but none plays again", r.n === 3 && r.r.every((x) => x === false), r);
    await ctx.close();
  }
  {
    const { ctx, pg } = await open({ premium: true, quest: { s: "x", ls: 99 } });
    const f = await pg.evaluate(() => Sona.storyFound());
    ok("a broken record has found nothing", f.length === 0, f);
    await pg.evaluate(() => localStorage.setItem("sona.quest.v1", JSON.stringify({ s: 2, ls: 1, lk: "story", done: "2026-01-01" })));
    await pg.evaluate(() => Sona.addKid("Ana", 4));
    const kid = await pg.evaluate(() => ({ f: Sona.storyFound().length }));
    ok("a brother or sister starts with nothing found (it is the child's own record)", kid.f === 0, kid);
    await ctx.close();
  }
  const names = await (async () => { const { ctx, pg } = await open({ premium: true }); const n = await pg.evaluate(() => Sona.STORY_DAYS.map((d) => d.name)); await ctx.close(); return n; })();
  ok("every story day names its game, short enough for a tile (16 characters at most)", names.length === STORY_IDS.length && names.every((n) => typeof n === "string" && n.length >= 4 && n.length <= 16), names);
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
    ok("a missed day moves it on (CAL1): four days missed, it is Day 6, open", later.kind === "story" && later.state === "open" && later.day === 6 && later.game === "bakery", later);
    await ctx.close();
  }
  {
    // a game day finished today (say before Premium was bought, or a record
    // from before the stories): today stays done, the story waits for tomorrow
    const { ctx, pg } = await open({ premium: true });
    const day = await localYmd(pg);
    // merged into the record the first load wrote: every phone has its `a`
    await pg.evaluate((d) => localStorage.setItem("sona.quest.v1", JSON.stringify(Object.assign(JSON.parse(localStorage.getItem("sona.quest.v1") || "{}"), { i: 3, last: 2, done: d }))), day);
    const r = await pg.evaluate(() => ({ q: Sona.questToday(), end: Sona.questEnd("lighthouse"), rec: JSON.parse(localStorage.getItem("sona.quest.v1")) }));
    ok("(the record keeps the calendar's start the first load wrote)", r.rec.a === day, r.rec);
    ok("a game day finished today (a record from before the stories) stays done today, with the story next",
      r.q.kind === "game" && r.q.state === "done" && r.q.day === 3 && r.q.next && r.q.next.kind === "story" && r.q.next.day === 1 && r.q.next.game === "lighthouse", r.q);
    ok("…so the story cannot be finished the same day", r.end === null, r.end);
    await nextDay(pg);
    const t = await pg.evaluate(() => Sona.questToday());
    ok("…and tomorrow it is story Day 1", t.kind === "story" && t.state === "open" && t.day === 1, t);
    await ctx.close();
  }
});

// ── 4b. CAL1: a new story every day, and a skipped one comes back ──
await section("a new story every day", async () => {
  {
    // never played: Day 1 on the calendar's first day, then one on each day
    const { ctx, pg, errors } = await open({ premium: true });
    const days = [];
    for (let n = 0; n < 16; n++) { days.push(await pg.evaluate(() => { const q = Sona.questToday(); return q.state + q.day; })); await nextDay(pg); }
    ok("a child who plays none sees Day 1, then Day 2, Day 3 and so on, one a day, and Day 1 again after Day 14",
      days.join() === "open1,open2,open3,open4,open5,open6,open7,open8,open9,open10,open11,open12,open13,open14,open1,open2", days);
    ok("…and reading the days wrote nothing but the calendar's first day and the stories' (a, sv)", Object.keys(await record(pg)).sort().join() === "a,sv", await record(pg));
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // Day 1 played, two days skipped, Day 4 played: the skipped two come back after Day 14
    const { ctx, pg, errors } = await open({ premium: true });
    const seen = [];
    const play = (p) => p.evaluate(() => { const q = Sona.questToday(); const e = Sona.questEnd(q.game); return "played" + (e && e.day); });
    const look = (p) => p.evaluate(() => { const q = Sona.questToday(); return q.state + q.day + (q.next ? ">" + q.next.day : ""); });
    for (let n = 0; n < 17; n++) {
      if (n === 0 || n === 3) { seen.push(await play(pg)); seen.push(await look(pg)); } else seen.push(await look(pg));
      await nextDay(pg);
    }
    ok("Day 1 played; Days 2 and 3 skipped; Day 4 played; then Days 5 to 14, then the skipped Day 2 and Day 3, then Day 5 again",
      seen.join() === "played1,done1>2,open2,open3,played4,done4>5,open5,open6,open7,open8,open9,open10,open11,open12,open13,open14,open2,open3,open5", seen);
    // back two days, to the day Day 2 came back, and play it then
    await nextDay(pg, -3);
    const back = await pg.evaluate(() => { const q = Sona.questToday(); const e = Sona.questEnd(q.game); return { day: q.day, e: e && e.day }; });
    ok("(the skipped Day 2, when it comes back, is played)", back.day === 2 && back.e === 2, back);
    const f = await pg.evaluate(() => Sona.storyFound().map((d) => d.id));
    ok("the stories found are in the order they were finished, a story that came back last (Home's row shows the newest first)", f.join() === "lighthouse,waterwheel,windup", f);
    const end = await pg.evaluate(() => ({ one: Sona.storyEnding("lighthouse").ok, four: Sona.storyEnding("waterwheel").ok, two: Sona.storyEnding("windup").ok, three: Sona.storyEnding("bridge").ok }));
    ok("…their endings open, and a skipped story's (Day 3, not played yet) does not", end.one && end.four && end.two && !end.three, end);
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // a story round that began before midnight and ends after it finishes the
    // story that was open when it began (by then the card shows the next one)
    const { ctx, pg, errors } = await open({ premium: true });
    await nextDay(pg);
    const r = await pg.evaluate(() => ({ before: Sona.questToday(), end: Sona.questEnd("lighthouse"), after: Sona.questToday(), again: Sona.questEnd("lighthouse"), ending: Sona.storyEnding("lighthouse") }));
    ok("after midnight, the card has moved on to Day 2", r.before.kind === "story" && r.before.state === "open" && r.before.day === 2, r.before);
    ok("…and the round of yesterday's story that ends now still finishes Day 1, with its sticker", r.end && r.end.day === 1 && r.end.story === "lighthouse" && r.end.stickers.length === 1, r.end);
    ok("…today is then done with Day 1, and Day 2 (today's, unplayed) is tomorrow's", r.after.kind === "story" && r.after.state === "done" && r.after.day === 1 && r.after.next && r.after.next.day === 2, r.after);
    ok("…once: a second round finishes nothing, and the ending opens with the sticker", r.again === null && r.ending.ok && r.ending.got.length === 1, r);
    await nextDay(pg);
    const t = await pg.evaluate(() => Sona.questToday());
    ok("…and the next day is Day 2", t.kind === "story" && t.state === "open" && t.day === 2, t);
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // only yesterday's story, only while nothing was finished since, and never
    // a game of the day (it is played from the Arcade too)
    const { ctx, pg } = await open({ premium: true });
    const zero = await pg.evaluate(() => ({ early: Sona.questEnd("windup") }));
    ok("on the calendar's first day there is no yesterday: another story's round finishes nothing", zero.early === null, zero);
    await nextDay(pg, 2);
    const r = await pg.evaluate(() => ({ day1: Sona.questEnd("lighthouse"), day2: Sona.questEnd("windup"), after: Sona.questToday() }));
    ok("two days on, Day 1 (open the day before yesterday) is not yesterday's: its round finishes nothing", r.day1 === null, r);
    ok("…but Day 2, yesterday's, is finished by its round", r.day2 && r.day2.day === 2 && r.after.state === "done" && r.after.day === 2, r);
    await ctx.close();
  }
  {
    const { ctx, pg } = await open({ premium: true, quest: { a: "2026-01-01", s: 14, ls: 13, lk: "story", done: "2026-01-01" } });
    const q0 = await pg.evaluate(() => Sona.questToday());
    await nextDay(pg);
    const r = await pg.evaluate((g) => ({ end: Sona.questEnd(g), q: Sona.questToday() }), q0.game);
    ok("a game of the day's round after midnight never finishes yesterday's game day", q0.kind === "game" && r.end === null && r.q.state === "open" && r.q.game !== q0.game, { q0, r });
    await ctx.close();
  }
  {
    // a record from before CAL1 (no `a`), its last story five days ago: the
    // first day on this build is the next story in order, then one a day
    const { ctx, pg } = await open({ premium: true, shift: 0, quest: { s: 2, ls: 1, lk: "story", done: "2026-01-01", got: [] } });
    const first = await pg.evaluate(() => Sona.questToday());
    const rec = await record(pg), day = await localYmd(pg);
    ok("a child set up before CAL1 starts the calendar on its first load: the next story in order (Day 3), never a jump", first.state === "open" && first.day === 3 && rec.a === day, { first, rec });
    await nextDay(pg);
    const second = await pg.evaluate(() => Sona.questToday());
    ok("…and the day after, unplayed, Day 4", second.state === "open" && second.day === 4, second);
    await ctx.close();
  }
  {
    // the sweep: every set-up child gets their own first day, once; a child
    // not set up gets none; a second load changes nothing
    const ctx = await browser.newContext();
    await ctx.addInitScript(`(() => {
      if (localStorage.getItem("__seeded")) return; localStorage.setItem("__seeded", "1");
      localStorage.setItem("sona.kids.v1", JSON.stringify({ list: [{ slot: "", name: "Mia" }, { slot: "k2", name: "Ana" }, { slot: "k3", name: "" }], active: "", hi: 3 }));
      localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", onboarded: true }));
      localStorage.setItem("sona.profile.v1@k2", JSON.stringify({ childName: "Ana", childAge: "4", onboarded: true }));
      localStorage.setItem("sona.quest.v1@k2", JSON.stringify({ a: "2026-10-01", s: 1, ls: 0, lk: "story", done: "2026-10-01" }));
      localStorage.setItem("sona.profile.v1@k3", JSON.stringify({ childName: "", onboarded: false }));
      ["sona.freeera.v1", "sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k, n) => localStorage.setItem(k, n ? "done" : "post"));
      localStorage.setItem("sona.freever.v1", "kept"); localStorage.setItem("sona.buddyset.v1", "kept");
    })();`);
    const pg = await ctx.newPage(); await pg.goto(origin + "/__sona"); await pg.waitForFunction(() => window.Sona && Sona.questToday);
    const read = () => pg.evaluate(() => ["sona.quest.v1", "sona.quest.v1@k2", "sona.quest.v1@k3"].map((k) => localStorage.getItem(k)));
    const one = await read(), day = await pg.evaluate(() => Sona.localDay());
    ok("the first load gives the first child their calendar's first day (today)", one[0] === JSON.stringify({ a: day }), one[0]);
    ok("…keeps the day a brother or sister already has, with their record untouched", one[1] === JSON.stringify({ a: "2026-10-01", s: 1, ls: 0, lk: "story", done: "2026-10-01" }), one[1]);
    ok("…and writes none for a child not set up yet", one[2] === null, one[2]);
    await pg.reload(); await pg.waitForFunction(() => window.Sona && Sona.questToday);
    ok("a second load writes nothing", JSON.stringify(await read()) === JSON.stringify(one));
    await ctx.close();
  }
  {
    // setup: the save that sets a child up starts their calendar, once
    const ctx = await browser.newContext();
    const pg = await ctx.newPage(); await pg.goto(origin + "/__sona"); await pg.waitForFunction(() => window.Sona && Sona.questToday);
    const r = await pg.evaluate(() => {
      const before = localStorage.getItem("sona.quest.v1");
      Sona.saveProfile({ childName: "Mia", childAge: "6" });
      const named = localStorage.getItem("sona.quest.v1");
      Sona.saveProfile({ onboarded: true });
      const setUp = JSON.parse(localStorage.getItem("sona.quest.v1") || "null");
      localStorage.setItem("sona.quest.v1", JSON.stringify({ a: "2026-10-02" }));
      Sona.saveProfile({ onboarded: true, childAge: "7" });
      const again = JSON.parse(localStorage.getItem("sona.quest.v1"));
      const slot = Sona.addKid("Ana", "4");
      Sona.saveProfile({ onboarded: true });
      return { before, named, setUp, again, kid: JSON.parse(localStorage.getItem("sona.quest.v1@" + slot) || "null"), first: JSON.parse(localStorage.getItem("sona.quest.v1")), day: Sona.localDay() };
    });
    ok("a profile saved before setup finishes starts no calendar", r.before === null && r.named === null, r);
    ok("the save that sets the child up starts it, today", r.setUp && r.setUp.a === r.day && Object.keys(r.setUp).join() === "a", r.setUp);
    ok("a later save of a child already set up (walking setup again) leaves it", r.again.a === "2026-10-02", r.again);
    ok("a brother or sister set up later starts their own, today, and the first child's is untouched", r.kid && r.kid.a === r.day && r.first.a === "2026-10-02", r);
    await ctx.close();
  }
  {
    // a phone that shows no story (it cannot buy, and no Premium): the card is
    // the game of the day, and the stories' Day 1 waits for the first day a
    // story is on the card, however long that takes
    const { ctx, pg, errors } = await open({ sell: false, stamp: "post" });
    const r0 = await pg.evaluate(() => ({ q: Sona.questToday(), rec: JSON.parse(localStorage.getItem("sona.quest.v1")) }));
    ok("(no story shown: the game of the day, and no stories' start day written)", r0.q.kind === "game" && r0.rec && r0.rec.a && !r0.rec.sv, r0);
    await nextDay(pg, 9);
    await pg.evaluate(() => { const p = JSON.parse(localStorage.getItem("sona.profile.v1")); p.earlyAdopter = true; localStorage.setItem("sona.profile.v1", JSON.stringify(p)); });
    await reload(pg);
    const r1 = await pg.evaluate(() => ({ q: Sona.questToday(), rec: JSON.parse(localStorage.getItem("sona.quest.v1")), day: Sona.localDay() }));
    ok("nine days later Premium opens the stories: the first one on the card is Day 1, and its day is written", r1.q.kind === "story" && r1.q.state === "open" && r1.q.day === 1 && r1.rec.sv === r1.day, r1);
    await nextDay(pg);
    const r2 = await pg.evaluate(() => Sona.questToday());
    ok("…and the next day is Day 2", r2.kind === "story" && r2.day === 2, r2);
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // a game day finished, then the stories open the same day: the story
    // waits for tomorrow, and tomorrow is Day 1 (a game day holds the story)
    const { ctx, pg } = await open({ sell: false, stamp: "post" });
    await nextDay(pg, 4);
    const g = await pg.evaluate(() => { const q = Sona.questToday(); return { q, e: Sona.questEnd(q.game) }; });
    await pg.evaluate(() => { const p = JSON.parse(localStorage.getItem("sona.profile.v1")); p.earlyAdopter = true; localStorage.setItem("sona.profile.v1", JSON.stringify(p)); });
    await reload(pg);
    const r = await pg.evaluate(() => Sona.questToday());
    ok("a game day finished, Premium the same day: today stays done, with story Day 1 tomorrow", g.e && r.kind === "game" && r.state === "done" && r.next && r.next.kind === "story" && r.next.day === 1, { g, r });
    await nextDay(pg);
    const t = await pg.evaluate(() => Sona.questToday());
    ok("…and tomorrow is Day 1", t.kind === "story" && t.state === "open" && t.day === 1, t);
    await ctx.close();
  }
  {
    // a brother or sister added in Settings: the next page (setup) starts
    // their calendar, and setup's save, days later, starts it again on the
    // day they are set up
    const { ctx, pg } = await open({ premium: true });
    const slot = await pg.evaluate(() => Sona.addKid("Ana", "6"));
    await reload(pg);
    const early = await pg.evaluate((k) => JSON.parse(localStorage.getItem("sona.quest.v1@" + k) || "null"), slot);
    ok("(the page Settings hands a new brother or sister to starts a calendar for them, named but not set up yet)", early && early.a, early);
    await nextDay(pg, 3);
    const r = await pg.evaluate((k) => { Sona.saveProfile({ onboarded: true }); return { rec: JSON.parse(localStorage.getItem("sona.quest.v1@" + k)), q: Sona.questToday(), day: Sona.localDay(), first: JSON.parse(localStorage.getItem("sona.quest.v1")) }; }, slot);
    ok("setup's save three days later starts it again that day: their first card is Day 1", r.rec.a === r.day && r.rec.sv === r.day && r.q.kind === "story" && r.q.day === 1, r);
    ok("…and the first child's calendar is untouched", r.first && r.first.a !== r.day, r.first);
    await ctx.close();
  }
  {
    // a day later than today (a phone clock that was ahead) never stops the card
    const { ctx, pg } = await open({ premium: true, quest: { a: "2099-01-01", sv: "2099-01-01" } });
    const r = await pg.evaluate(() => ({ q: Sona.questToday(), rec: JSON.parse(localStorage.getItem("sona.quest.v1")), day: Sona.localDay() }));
    ok("a calendar start after today is written again as today: Day 1 today", r.rec.a === r.day && r.rec.sv === r.day && r.q.day === 1, r);
    await nextDay(pg);
    ok("…and Day 2 tomorrow", (await pg.evaluate(() => Sona.questToday().day)) === 2);
    await ctx.close();
  }
  {
    const { ctx, pg } = await open({ premium: true, quest: { a: "2026-01-01", sv: "2026-01-01", f: [0], s: 1, ls: 0, lk: "story", done: "2099-01-01", got: [] } });
    const a = await pg.evaluate(() => Sona.questToday());
    await nextDay(pg);
    const b = await pg.evaluate(() => Sona.questToday());
    ok("a story finished on a day after today does not hold the card still: tomorrow is another story", a.kind === "story" && b.kind === "story" && a.state === "open" && b.state === "open" && a.day !== b.day, { a, b });
    await ctx.close();
  }
  {
    // a backup that brings a child but no quest record: that child starts
    // their own calendar, never the one of whoever sat in the slot here
    const { ctx, pg } = await open({ premium: true });
    await pg.evaluate(() => Sona.questEnd("lighthouse"));
    await nextDay(pg, 2);
    const r = await pg.evaluate(() => {
      const res = Sona.importData({ data: { "sona.profile.v1": JSON.stringify({ childName: "Leo", childAge: "6", focusSounds: ["R"], onboarded: true }) } });
      return { ok: res.ok, rec: localStorage.getItem("sona.quest.v1") };
    });
    ok("restoring a child with no quest record takes the slot's old record away", r.ok && r.rec === null, r);
    await reload(pg);
    const q = await pg.evaluate(() => ({ q: Sona.questToday(), found: Sona.storyFound().length, rec: JSON.parse(localStorage.getItem("sona.quest.v1")), day: Sona.localDay() }));
    ok("…and on the next page the restored child starts their own: Day 1 today, nothing found", q.q.kind === "story" && q.q.day === 1 && q.found === 0 && q.rec.a === q.day, q);
    const kept = await pg.evaluate(() => {
      Sona.importData({ data: { "sona.profile.v1": JSON.stringify({ childName: "Leo", onboarded: true }), "sona.quest.v1": JSON.stringify({ a: "2026-10-01", f: [2], s: 1, ls: 2, lk: "story", done: "2026-10-01" }) } });
      return JSON.parse(localStorage.getItem("sona.quest.v1"));
    });
    ok("a backup that brings its quest record keeps it", kept && kept.a === "2026-10-01" && JSON.stringify(kept.f) === "[2]", kept);
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
    const d2 = await pg.evaluate(() => { const q = Sona.questToday(); Sona.questEnd(q.game); return q.day; });
    const merged = await record(pg);
    ok("finishing the story merges into the record (nothing it did not write is lost)", d2 === 2 && merged.keep === "me" && merged.i === 4 && merged.last === 3 && merged.s === 1 && JSON.stringify(merged.f) === "[1]", { d2, merged });
    await ctx.close();
  }
  {
    const { ctx, pg } = await open({ premium: true });
    const day = await localYmd(pg);
    await pg.evaluate((d) => localStorage.setItem("sona.quest.v1", JSON.stringify(Object.assign(JSON.parse(localStorage.getItem("sona.quest.v1") || "{}"), { i: 2, last: 1, done: d, s: "x", ls: 9, lk: "story", got: ["nope", 5], seen: "junk" }))), day);
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
    const rec6 = await record(pg);
    ok(label + ": a round reached without the story finishes nothing (the record holds only the day the calendar and the stories started)", r.end === null && r.stk === 0 && rec6 && Object.keys(rec6).sort().join() === "a,sv" && events(sent, "adventure day done").length === 0, { end: r.end, rec6 });
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
        // TALK1: today's story is the lighthouse here (talkstorytest plays the talking ones)
        await page.addInitScript(() => { try { sessionStorage.setItem("sona.talkoff", "1"); } catch (e) {} });
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
  // TALK1: Day 1 is the lighthouse here (talkstorytest plays the talking ones)
  await context.addInitScript(() => { try { sessionStorage.setItem("sona.talkoff", "1"); } catch (e) {} });
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
