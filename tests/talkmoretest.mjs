// TALKMORE1 (25 Nov 2026): talking stories after Day 14. Travis: "how would
// you improve the kids app though? i got lots of tokens i need to start
// building", to "a new talking story every day, in the child's own sound".
// Once a child has finished all 14 STORY_DAYS stories, a child whose sound
// has later talking stories (sona.js STORY_TALK_MORE) meets one a day, in
// order, by CAL1's rule; only `ready` ones (pictures drawn, words read by
// Rachel) are ever offered. What this holds:
//   1. the list: one shape, ids that are no other story's or game's, every
//      sound one with a Day 1 talking story, scenes in talk-stories.js, and
//      picture prompts for each;
//   2. while no story is ready, nothing changes: after Day 14 the card is the
//      game of the day, as before, and no later id opens anything;
//   3. ready: Day 15 is the first of the child's sound, one a day, the next
//      after a finish, a skipped one comes back, the finish keeps its id
//      (`x`, `lx`, `lk` "talk"), one sticker, the ending opens, Home's "Your
//      games" plays it again, and after the last the game of the day comes
//      back; another sound's stories are never this child's;
//   4. a child before Day 14, a sound with no later stories, the talking
//      stories switched off ("sona.talkoff"): exactly as before;
//   5. a record an older page wrote, or a broken one, reads safely;
//   6. in a browser, the real Home and story player: Day 15 on Home's card,
//      the player telling it (Next with the mic off), the finish kept by id,
//      the sticker card, tomorrow's line, the replay; and with nothing ready,
//      no later story on Home or by address.
// Parts 1-5 run sona.js in node's vm with a stub window and a clock this
// suite sets (the trophytest harness).
import vm from "vm";
import { readFileSync, existsSync, statSync } from "fs";
import { createServer } from "node:http";
import path from "path";
import { ROOT, chromium, launchOpts } from "./_env.mjs";

let fails = 0, count = 0;
const ok = (n, p, extra) => { count++; if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (typeof extra === "string" ? extra : JSON.stringify(extra)))); };
const sec = (name, fn) => { try { fn(); } catch (e) { ok(name + ": runs without throwing", false, String(e && e.stack || e).split("\n").slice(0, 3).join(" ")); } };

const SRC0 = readFileSync(ROOT + "/sona.js", "utf8");
// every later story ready (the suite's copy only): what the app does once
// Rachel has read them and their pictures are drawn
const READY = SRC0.replace(/(\{ id: "[a-z]+", sound: "[A-Z]+", hero: "[a-z]+", name: "[^"]+", title: "[^"]+",\s*line: "[^"]+", ready: )false( \})/g, "$1true$2");

const DAY = 864e5;
const START = new Date(2026, 10, 2, 10, 0, 0).getTime();
function boot(opts = {}) {
  const local = opts.local || {}, session = opts.session || {}, noop = () => {};
  const storage = (store) => ({ getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, key: (i) => Object.keys(store)[i] || null, get length() { return Object.keys(store).length; } });
  const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, setAttribute: noop, appendChild: noop, addEventListener: noop, remove: noop, querySelector: () => null, querySelectorAll: () => [] });
  const clock = opts.clock || { now: START };
  const ctx = {
    localStorage: storage(local), sessionStorage: storage(session), console, setTimeout, clearTimeout, setInterval, clearInterval,
    document: { hidden: true, addEventListener: noop, removeEventListener: noop, createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: el(), head: el(), documentElement: el() },
    navigator: { userAgent: "node", mediaDevices: {} },
    location: { href: "http://x/charge.html", pathname: "/charge.html", search: "", hash: "", hostname: "x", origin: "http://x", replace: noop },
    addEventListener: noop, removeEventListener: noop, history: { replaceState: noop }, matchMedia: () => ({ matches: false, addEventListener: noop }),
    fetch: () => Promise.reject(new Error("offline")),
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  ctx.__clock = clock;
  vm.runInContext("(function(){var R=Date;function D(a,b,c,d,e,f,g){var n=arguments.length;return n===0?new R(__clock.now):n===1?new R(a):new R(a,b,c||1,d||0,e||0,f||0,g||0);}D.prototype=R.prototype;D.now=function(){return __clock.now;};D.UTC=R.UTC;D.parse=R.parse;Date=D;})();", ctx);
  if (!opts.local) {
    ["", "2", "3", "4", "5"].forEach((n) => { local["sona.freeera" + n + ".v1"] = n ? "done" : "post"; });
    local["sona.freever.v1"] = "kept";
    local["sona.buddyset.v1"] = "kept";
    local["sona.profile.v1"] = JSON.stringify(Object.assign({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, voiceOn: false, soundOn: false, volume: 0, earlyAdopter: true }, opts.profile || {}));
    if (opts.quest) local["sona.quest.v1"] = JSON.stringify(opts.quest);
  }
  vm.runInContext(opts.src || READY, ctx, { filename: "sona.js" });
  return { S: ctx.Sona, ctx, local, session, clock };
}
const ymd = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
// a child who finished all 14 stories, the last one yesterday
const ALL14 = (extra) => Object.assign({ f: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], s: 14, ls: 13, lk: "story", done: ymd(START - DAY), fd: ymd(START - DAY), a: ymd(START - 30 * DAY), sv: ymd(START - 30 * DAY), t1: "robo", i: 0, last: 13 }, extra || {});
const quest = (p) => JSON.parse(p.local["sona.quest.v1"] || "null");
const later = (S, sound) => S.STORY_TALK_MORE.filter((d) => d.sound === sound).map((d) => d.id);

// ── 1. the list ──
sec("1 the list", () => {
  const p = boot({ src: SRC0 }), { S } = p;
  const M = S.STORY_TALK_MORE, T = S.STORY_TALK;
  ok("Sona exports STORY_TALK_MORE, a list of later talking stories", Array.isArray(M) && M.length >= 1, M && M.length);
  ok("…each with an id, a sound, a hero, a name, a title, a Home line and `ready`", M.every((d) => /^[a-z]+$/.test(d.id) && /^[A-Z]+$/.test(d.sound) && /^[a-z]+$/.test(d.hero) && d.name && d.title && d.line && typeof d.ready === "boolean"), M);
  const taken = new Set(S.STORY_DAYS.map((d) => d.id).concat(S.STORY_DAYS.map((d) => d.game), T.map((d) => d.id), Object.keys(S.GAME_ACTS)));
  ok("…ids that are no STORY_DAYS day, no Day 1 talking story and no catalog game, each once", M.every((d) => !taken.has(d.id)) && new Set(M.map((d) => d.id)).size === M.length, M.map((d) => d.id));
  ok("…every one in a sound that has a Day 1 talking story", M.every((d) => T.some((t) => t.sound === d.sound)));
  ok("…a Home line and a title as short and plain as Day 1's", M.every((d) => d.line.length <= 100 && d.title.length <= 32 && !/\b(say|sound|voice)\b/i.test(d.line)), M.filter((d) => d.line.length > 100));
  const win = { window: {} }; vm.runInNewContext(readFileSync(ROOT + "/talk-stories.js", "utf8"), win.window);
  const TS = win.window.SonaTalkStories;
  ok("…every one has its scenes in talk-stories.js, in its own sound", M.every((d) => TS[d.id] && TS[d.id].sound === d.sound), M.filter((d) => !TS[d.id]).map((d) => d.id));
  const P = JSON.parse(readFileSync(path.resolve(ROOT, "../tools/art/adventure-prompts.json"), "utf8"));
  ok("…and its picture prompts: a talking story's lineup, a Home card and twelve pages", M.every((d) => { const s = P.stories.find((x) => x.id === d.id); return s && s.talk === true && s.home && ["s01", "s02", "s03", "s04", "s05", "s06", "s07", "s08", "e01", "e02", "e03", "e04"].every((k) => s.scenes[k] && s.scenes[k].picture); }), M.map((d) => d.id));
});

// ── 2. while none is ready, nothing changes ──
sec("2 none ready: as before", () => {
  const p = boot({ src: SRC0, quest: ALL14() }), { S } = p;
  const q = S.questToday();
  ok("with every later story not ready, after Day 14 the card is the game of the day, as before", q.kind === "game" && q.state === "open", q);
  ok("…and no later story's id is a day here, or a story the player may open", S.STORY_TALK_MORE.every((d) => S.storyDay(d.id) === null), S.STORY_TALK_MORE.filter((d) => S.storyDay(d.id)).map((d) => d.id));
  ok("…or a key the games' access rule opens, though this child has the stories", S.storyOpen() && S.STORY_TALK_MORE.every((d) => S.gameAccess(d.id).allowed === false && S.gameAccess(d.id).reason === "unknown"));
});

// ── 3. ready: the days after Day 14 ──
sec("3 ready: Day 15 on", () => {
  const p = boot({ quest: ALL14() }), { S } = p;
  const R = later(S, "R");
  let q = S.questToday();
  ok("(the child is Premium and on R; R has later stories)", S.storyOpen() && R.length >= 2, { open: S.storyOpen(), R });
  ok("the day after Day 14 is finished, the card is the first later R story, as Day 15, open", q.kind === "story" && q.state === "open" && q.story.id === R[0] && q.day === 15 && q.story.talk === true && q.story.more === true, q);
  ok("…with its Home picture and its again address", q.story.pic === "/assets/crafted/home-" + S.STORY_TALK_MORE[0].hero + ".webp" && q.story.again === "/adventure.html?again=1&story=" + R[0], q.story);
  ok("…the player finds it as a talking story", (() => { const d = S.storyDay(R[0]); return d && d.talk === true && d.page === "/adventure.html" && d.day === 15; })(), S.storyDay(R[0]));
  ok("…its ending does not open before it is finished", S.storyEnding(R[0]).ok === false);
  // an S child's story is never this child's
  const sid = later(S, "S")[0];
  ok("another sound's later story is no day for this child", sid && S.storyDay(sid) === null, sid);
  // finish it
  const end = S.questEnd(R[0]);
  const rec = quest(p);
  ok("the intro's last word finishes it: kept by its id, as the last story finished, with one sticker", end && end.story === R[0] && end.day === 15 && end.stickers.length === 1 && rec.x.join() === R[0] && rec.lx === R[0] && rec.lk === "talk" && rec.f.length === 14, { end, rec });
  ok("…a second finish gives nothing", S.questEnd(R[0]) === null);
  q = S.questToday();
  ok("…today's card shows it done, Day 15, with tomorrow the next R story (Day 16)", q.kind === "story" && q.state === "done" && q.story.id === R[0] && q.day === 15 && q.next.kind === "story" && q.next.story.id === R[1] && q.next.day === 16, q);
  ok("…its ending opens, with today's sticker", S.storyEnding(R[0]).ok === true && S.storyEnding(R[0]).got.length === 1, S.storyEnding(R[0]));
  const found = S.storyFound();
  ok("…Home's \"Your games\" has it last, after the 14, and it plays again", found.length === 15 && found[14].id === R[0] && S.storyReplay(R[0]) === true, found.map((d) => d && d.id));
  // the next day
  p.clock.now += DAY;
  q = S.questToday();
  ok("the next day the card is the next R story, open", q.kind === "story" && q.state === "open" && q.story.id === R[1] && q.day === 16, q);
  // skipped: two days later with nothing finished, the one after
  p.clock.now += DAY;
  q = S.questToday();
  ok("a day skipped: the next day is the one after it, as CAL1 rotates", q.kind === "story" && q.story.id === R[2], q.story && q.story.id);
  ok("…and the skipped one's page writes nothing (read only)", JSON.stringify(quest(p)) === JSON.stringify(rec) || quest(p).x.join() === R[0]);
});

sec("3b after the last later story", () => {
  const p0 = boot({ quest: ALL14() }), R = later(p0.S, "R");
  const all = R.slice(0, -1);
  const p = boot({ quest: ALL14({ x: all, lx: all[all.length - 1], lk: "talk", done: ymd(START - DAY), fd: ymd(START - DAY) }) }), { S } = p;
  let q = S.questToday();
  ok("with one later story left, it is today's", q.kind === "story" && q.story.id === R[R.length - 1], q);
  S.questEnd(R[R.length - 1]);
  q = S.questToday();
  ok("…once it is finished, tomorrow is the game of the day again", q.kind === "story" && q.state === "done" && q.next.kind === "game", q);
  p.clock.now += DAY;
  q = S.questToday();
  ok("…and the day after, the game of the day is the card", q.kind === "game" && q.state === "open", q);
  ok("…while every story found still plays again", S.storyFound().length === 14 + R.length && R.every((id) => S.storyReplay(id)), S.storyFound().length);
});

// ── 4. exactly as before ──
sec("4 as before", () => {
  const before = boot({ quest: { f: [0, 1, 2], s: 3, ls: 2, lk: "story", done: ymd(START - DAY), fd: ymd(START - DAY), a: ymd(START - 5 * DAY), sv: ymd(START - 5 * DAY), t1: "robo" } });
  const q = before.S.questToday();
  ok("a child before Day 14 still meets the next of the 14", q.kind === "story" && q.day === 4 && !q.story.more, q);
  const p = boot({ quest: ALL14({}), profile: { focusSounds: ["P"] } });   // P: no talking story at all (TH has a later one since 25 Nov 2026)
  ok("a sound with no later stories: after Day 14 the game of the day, as before", p.S.questToday().kind === "game", p.S.questToday());
  const off = boot({ quest: ALL14(), session: { "sona.talkoff": "1" } });
  ok("the talking stories switched off: no later story either", off.S.questToday().kind === "game", off.S.questToday());
  const nb = boot({ quest: ALL14(), profile: { earlyAdopter: false } });
  ok("a family without the story (a phone that cannot buy): the game of the day, as before", !nb.S.storyShown() ? nb.S.questToday().kind === "game" : true, { shown: nb.S.storyShown(), q: nb.S.questToday() });
});

// ── 5. records read safely ──
sec("5 records", () => {
  const p = boot({ quest: ALL14({ x: ["nope", 7, null, "rosie", "rosie"], lx: "nope", lk: "talk" }) }), { S } = p;
  const q = S.questToday();
  ok("unknown or doubled ids in `x` are left out, and an unknown `lx` is no last story", q.kind === "story" && S.storyFound().filter((d) => d.more).map((d) => d.id).join() === "rosie", { q, found: S.storyFound().map((d) => d.id) });
  const o = boot({ quest: ALL14({ lk: "talk" }) });
  ok("`lk` \"talk\" with no `lx` reads as before (no later story finished)", o.S.questToday().kind === "story" && o.S.questToday().state === "open", o.S.questToday());
});

// ── 6. the real Home and player, in a browser ──
{
  let serveSrc = READY;
  const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2", json: "application/json", mp4: "video/mp4", mp3: "audio/mpeg", wav: "audio/wav" };
  const PORTRAIT = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200"><rect width="800" height="1200" fill="#3a4f8a"/><circle cx="400" cy="360" r="160" fill="#ffe7a8"/></svg>';
  const stub = (t) => '<!doctype html><meta charset="utf-8"><title>' + t + "</title><body><h1>" + t + "</h1></body>";
  const server = createServer((req, res) => {
    const p = new URL(req.url, "http://x").pathname;
    req.resume();
    if (p === "/sona.js") { res.writeHead(200, { "content-type": "text/javascript" }); res.end(serveSrc); return; }
    if (p.startsWith("/api/")) { res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); return; }
    if (p === "/subscribe.html" || /^\/arcade-[a-z]+\.html$/.test(p) || p === "/charge.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(stub(p)); return; }
    const file = path.join(ROOT, p === "/" ? "/today.html" : p);
    if (/^\/assets\/adventure\/[a-z]+\/[se]\d\d\.webp$/.test(p) && !existsSync(file)) { res.writeHead(200, { "content-type": "image/svg+xml" }); res.end(PORTRAIT); return; }
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch(launchOpts());
  const day = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const now = Date.now();
  // a child on R, age 7, who finished the 14 stories yesterday; sound off
  // (captions only, nothing fetched) and the mic never asked
  const rec14 = (extra) => Object.assign({ f: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], s: 14, ls: 13, lk: "story", done: day(now - DAY), fd: day(now - DAY), a: day(now - 30 * DAY), sv: day(now - 30 * DAY), t1: "robo", i: 0, last: 13, got: [] }, extra || {});
  const seed = (q) => `(() => {
    if (localStorage.getItem("__seeded")) return; localStorage.setItem("__seeded", "1");
    try { sessionStorage.setItem("sona.paidui", "1"); sessionStorage.setItem("sona.websalesui", "0"); } catch (e) {}
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, voiceOn: false, volume: 0, earlyAdopter: true }));
    localStorage.setItem("sona.freeera.v1", "post");
    ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
    localStorage.setItem("sona.freever.v1", "kept"); localStorage.setItem("sona.buddyset.v1", "kept"); localStorage.setItem("sona.offerseen.v1", "1");
    localStorage.setItem("sona.quest.v1", ${JSON.stringify(JSON.stringify(q))});
  })();`;
  const errors = [];
  async function context(q) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await ctx.route((u) => !String(u).startsWith(origin), (r) => r.abort());
    await ctx.addInitScript(seed(q));
    const pg = await ctx.newPage(); pg.on("pageerror", (e) => errors.push(e.message));
    return { ctx, pg };
  }
  const home = async (pg) => {
    await pg.goto(origin + "/today.html");
    await pg.waitForFunction(() => { const t = document.getElementById("questTitle"); return t && t.textContent; }, null, { timeout: 9000 }).catch(() => {});
    return pg.evaluate(() => ({ title: document.getElementById("questTitle").textContent, chip: document.getElementById("questChip").hidden ? null : document.getElementById("questChip").textContent, line: document.getElementById("questLine").textContent }));
  };
  const player = async (pg, url) => {
    await pg.goto(origin + url);
    await pg.waitForFunction(() => window.__adventure || location.pathname !== "/adventure.html", null, { timeout: 9000 }).catch(() => {});
    return pg.evaluate(() => window.__adventure ? Object.assign({}, window.__adventure) : null);
  };
  const until = (pg, fn, arg, ms = 6000) => pg.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  const tap = (pg, id) => pg.evaluate((i) => document.getElementById(i).click(), id);
  // the mic declined (or missing): Next reads the story on
  async function nextMode(pg) {
    await until(pg, () => window.__adventure && (window.__adventure.primer || window.__adventure.bar === "next"));
    if (await pg.evaluate(() => window.__adventure.primer)) await tap(pg, "micNo");
    return until(pg, () => window.__adventure.bar === "next");
  }
  async function turn(pg, to) { await pg.waitForTimeout(650); await tap(pg, "nextBtn"); return until(pg, (n) => window.__adventure.idx === n || window.__adventure.mode !== "intro", to); }
  try {
    const R = later(boot({ src: SRC0 }).S, "R");
    let o = await context(rec14());
    try {
      const h = await home(o.pg);
      ok("browser: the day after Day 14, Home's card is the first later R story, Day 15, with its own line", h.title === "Rosie's Raft" && h.chip === "Day 15" && /Rosie the raccoon/.test(h.line), h);
      let a = await player(o.pg, "/adventure.html");
      const card = await o.pg.evaluate(() => ({ day: document.getElementById("startDay").textContent, title: document.getElementById("startTitle").textContent }));
      ok("…the player opens it as a talking story: eight pages, \"Day 15\" and its title on the start card", a && a.id === R[0] && a.talk === true && a.mode === "intro" && a.total === 8 && card.day === "Day 15" && card.title === "Rosie's Raft", { a, card });
      await tap(o.pg, "startBtn");
      ok("…its first page asks to be read (the mic declined: Next reads on)", await nextMode(o.pg), await o.pg.evaluate(() => window.__adventure));
      for (let i = 1; i < 8; i++) await turn(o.pg, i);
      a = await o.pg.evaluate(() => Object.assign({}, window.__adventure));
      ok("…Next turns page by page to the last", a.idx === 7 && a.mode === "intro", a);
      const before = await o.pg.evaluate(() => JSON.parse(localStorage.getItem("sona.quest.v1")));
      ok("…and nothing is finished before the last page is read", !(before.x || []).length, before);
      await nextMode(o.pg);
      await o.pg.waitForTimeout(650); await tap(o.pg, "nextBtn");
      ok("…the last page finishes the day and the ending plays straight on", await until(o.pg, () => window.__adventure.mode === "end" && window.__adventure.view === "scene"), await o.pg.evaluate(() => window.__adventure));
      const q = await o.pg.evaluate(() => JSON.parse(localStorage.getItem("sona.quest.v1")));
      ok("…the record keeps the story by its id (x, lx, lk \"talk\"), the 14 untouched, one sticker", JSON.stringify(q.x) === JSON.stringify([R[0]]) && q.lx === R[0] && q.lk === "talk" && q.f.length === 14 && Array.isArray(q.got) && q.got.length === 1, q);
      for (let i = 1; i <= 4; i++) { await nextMode(o.pg); await o.pg.waitForTimeout(650); await tap(o.pg, "nextBtn"); await until(o.pg, (n) => window.__adventure.idx === n || window.__adventure.view === "stickers", i, 3000); }
      ok("…the ending ends on the sticker card", await until(o.pg, () => window.__adventure.view === "stickers"), await o.pg.evaluate(() => window.__adventure));
      const end = await o.pg.evaluate(() => ({ got: document.getElementById("gotList").textContent, found: document.getElementById("foundText").textContent, shown: !document.getElementById("foundLine").hidden }));
      ok("…\"You got …!\" and \"On Home to read again: Rosie's Raft!\"", /You got /.test(end.got) && end.shown && end.found === "On Home to read again: Rosie's Raft!", end);
      const h2 = await home(o.pg);
      ok("Home after it: \"Day 15 done!\", and tomorrow's line promises Day 16 alone (a talking story brings no new game)", h2.title === "Day 15 done!" && h2.line === "Come back tomorrow for Day 16!", h2);
      const found = await o.pg.evaluate(() => Sona.storyFound().map((d) => d.id + " " + d.again));
      ok("…Home's \"Your games\" has it last, its replay address the player's", found.length === 15 && found[14] === R[0] + " /adventure.html?again=1&story=" + R[0], found.slice(-2));
      a = await player(o.pg, "/adventure.html?again=1&story=" + R[0]);
      ok("its replay tells the whole story, intro and ending (12 pages), and finishes nothing", a && a.mode === "again" && a.total === 12, a);
      a = await player(o.pg, "/adventure.html?again=1&story=" + R[1]);
      ok("…a later story not finished yet has no replay: Home", a === null && new URL(o.pg.url()).pathname === "/today.html", o.pg.url());
    } finally { await o.ctx.close(); }
    serveSrc = SRC0;
    o = await context(rec14({ x: [R[0]], lx: R[0], lk: "talk", done: day(now - 2 * DAY), fd: day(now - 2 * DAY) }));
    try {
      const h = await home(o.pg);
      ok("nothing ready (as shipped): after Day 14 Home's card is the game of the day, no later story", !/Rosie|Ruby|Rex|Remi|Rina|Ravi/.test(h.title) && h.chip === null, h);
      let a = await player(o.pg, "/adventure.html?again=1&story=" + R[0]);
      ok("…a later story is never opened by address, even one in the record", a === null && new URL(o.pg.url()).pathname === "/today.html", o.pg.url());
      a = await player(o.pg, "/adventure.html");
      ok("…and the player has no story to tell: Home", a === null && new URL(o.pg.url()).pathname === "/today.html", o.pg.url());
    } finally { await o.ctx.close(); }
    ok("browser: no page errors", errors.length === 0, errors);
  } catch (e) {
    ok("browser part completes", false, String(e && e.stack || e).split("\n").slice(0, 4).join(" "));
  } finally { await browser.close(); server.close(); }
}

console.log(`\n${count} checks, ${fails} failure${fails === 1 ? "" : "s"}`);
process.exit(fails ? 1 : 0);
