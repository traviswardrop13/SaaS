// STORY1, Days 4-14 (22 Oct 2026): the page that plays Codex's eleven physical
// games inside the daily story, /story-game.html?story=<id>. The games' own
// suites (daily-*test) play each game on the test host it was built on; this
// one holds the page families get to the same games, and the story around it:
//   - the source: one shell for both (the same body and the same host.css as
//     tests/fixtures/daily-adventure.html, the games' words one copy in
//     pages.js), ES5, nothing written, the hand-back and no Play again;
//   - the day list: every Days 4-14 day is a story day with a controller, a
//     page, words, a Home picture and scenes, and no key is anyone else's;
//   - every one of those pictures decodes, at the size it is laid out at;
//   - entitlement first: a family without the story, an address that names no
//     Days 4-14 story, or one with anything after it goes Home before the
//     game's own files are asked for, with no mic and no sound;
//   - every game boots at both ages (five moves for ages 3-4, eight for 5-8),
//     as its day's own key (Day 7's end card must finish Day 7), its
//     stylesheet before the shell's, and the first word earns its first job;
//   - Day 4 played through, the way a child does: the story's intro, "Let's
//     go!", the game with real words and a real finger, the end card's "See
//     what happens!", the ending and its one sticker, Back home.
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import { chromium, ROOT, launchOpts } from "./_env.mjs";
import { serve } from "./_phone.mjs";
import { fakeDevice } from "./_sayplaydevice.mjs";
import { advance, until, sayWord } from "./_sayplay-realgame.mjs";

let fails = 0, count = 0;
function ok(label, pass, detail = "") { count++; if (!pass) fails++; console.log((pass ? "PASS " : "FAIL ") + label + (pass ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 1500))); }
const ONLY = process.env.STORYGAME_PART || "";
async function section(label, run) { if (ONLY && !label.startsWith(ONLY)) return; try { await run(); } catch (e) { ok(label + " completes", false, e.stack); } }

const PAGE = readFileSync(ROOT + "/story-game.html", "utf8");
const FIXTURE = readFileSync(ROOT + "/../tests/fixtures/daily-adventure.html", "utf8");
const SONA = readFileSync(ROOT + "/sona.js", "utf8");
const run = (file) => { const c = { window: {} }; vm.runInNewContext(readFileSync(ROOT + "/" + file, "utf8"), c); return c.window; };
const PAGES = run("daily-adventures/pages.js").DailyAdventurePages;
const RECORDS = run("daily-adventures/stories.js").DailyAdventureStories;
const A = run("adventures.js").SonaAdventures;
// the day list as sona.js writes it (each entry's own fields, read off the source)
const DAYS = [...((SONA.match(/const STORY_DAYS = \[([\s\S]*?)\n  \];/) || ["", ""])[1]).matchAll(/\{ id: "([a-z]+)", game: "([a-z]+)",(?: controller: "([a-z]+)",)? page: "([^"]+)", hero: "([a-z]+)",\s*title: ("[^"\n]*"),\s*line: ("[^"\n]*") \}/g)]
  .map((m) => ({ id: m[1], game: m[2], controller: m[3] || null, page: m[4], hero: m[5], title: JSON.parse(m[6]), line: JSON.parse(m[7]) }));
const LATER = DAYS.filter((d) => d.controller);
const CATALOG = [...((SONA.match(/const GAME_ACTS = \{([\s\S]*?)\n  \};/) || ["", ""])[1]).matchAll(/^\s{4}([a-z]+):/gm)].map((m) => m[1]);
const noComments = (s) => s.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");

// ── 0. the source ──
await section("source", async () => {
  // the body, tag by tag: what each element is (tag, id, class, role, type,
  // hidden, disabled), never its words, which the page fills from pages.js
  const shape = (html) => [...noComments((html.split(/<body[^>]*>/)[1] || "").split("<script")[0]).matchAll(/<([a-z0-9]+)((?:\s+[a-z-]+(?:="[^"]*")?)*)\s*\/?>/g)]
    .map((m) => { const a = (n) => { const v = new RegExp(`\\s${n}(?:="([^"]*)")?(?=\\s|$)`).exec(m[2]); return v ? n + "=" + (v[1] || "") : ""; }; return [m[1], a("id"), a("class"), a("role"), a("type"), / hidden(?=\s|$)/.test(m[2]) ? "hidden" : "", / disabled(?=\s|$)/.test(m[2]) ? "disabled" : ""].filter(Boolean).join(" "); });
  const mine = shape(PAGE), theirs = shape(FIXTURE);
  const diff = mine.map((t, i) => t === theirs[i] ? null : i + ": " + t + " / " + theirs[i]).filter(Boolean);
  ok("the page's body is the games' test host's, element for element (so every fit their suites measured is this page's)", mine.length > 40 && mine.length === theirs.length && !diff.length, diff.length ? diff : [mine.length, theirs.length]);
  const links = [...PAGE.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]), fixLinks = [...FIXTURE.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]);
  ok("…and the same stylesheets: fonts, Say & Play's, (the game's own, put in at load), then the shared shell host.css",
    JSON.stringify(links) === JSON.stringify(["/fonts.css", "/sayplay.css", "/daily-adventures/host.css"]) && JSON.stringify(fixLinks) === JSON.stringify(["/fonts.css", "/sayplay.css", "/daily-adventures/{{key}}.css", "/daily-adventures/host.css"]), [links, fixLinks]);
  ok("…the test host keeps no style of its own (the shell is host.css, one copy)", !/<style\b/i.test(FIXTURE) && !/<style\b/i.test(PAGE));
  const harness = readFileSync(ROOT + "/../tests/_daily-adventure.mjs", "utf8");
  ok("…and the games' words are one copy, pages.js, which the test host reads too", /daily-adventures\/pages\.js/.test(harness) && !/canvasLabel:'/.test(harness) && /<script src="\/daily-adventures\/pages\.js"><\/script>/.test(PAGE));
  const srcs = [...PAGE.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  ok("it loads sona.js, the words' pictures, the engine and the games' words, and nothing from another site", JSON.stringify(srcs) === JSON.stringify(["/sona.js", "/crafted-words.js", "/sayplay.js", "/daily-adventures/pages.js"]), srcs);
  const inline = [...PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]), code = noComments(inline.join("\n"));
  let parsed = inline.length === 1; try { new vm.Script(inline[0]); } catch (e) { parsed = false; }
  ok("one inline script, and it parses", parsed);
  ok("…in ES5: no arrow, let, const, class or template", !/=>|\blet\s|\bconst\s|\bclass\s|`/.test(code));
  const WRITES = ["gameRep", "logAttempt", "bumpReps", "addCoins", "mintCoins", "awardSticker", "awardNextSticker", "questEnd", "storySeen", "recordSession", "localStorage", "sessionStorage", "indexedDB", "saveProfile", "Math.random", "fetch("];
  ok("it writes nothing of its own: no rep, coin, sticker, quest end or storage (the engine's end card finishes the day)", WRITES.every((w) => !code.includes(w)), WRITES.filter((w) => code.includes(w)));
  ok("the address only picks the game: exactly ?story=<letters>, and only a day with a controller", /\/\^\\\?story=\(\[a-z\]\+\)\$\/\.exec\(location\.search\)/.test(code) && /d\.controller\) day = d/.test(code));
  ok("entitlement is asked before the game's files are put on the page", code.indexOf("gameAccess(day.game)") > 0 && code.indexOf("gameAccess(day.game)") < code.indexOf('document.createElement("script")'));
  ok("the end card hands back to the story's ending, and there is no Play again", /exit: \{ href: "\/adventure\.html\?part=end&story=" \+ day\.id, label: "See what happens!" \}/.test(code) && /again: false/.test(code));
  ok("the engine is given the day's own game key, so its end card finishes that day (Day 7's is frontdoor, never Codex's bridge, which is Day 3's)", /SayPlay\.start\(\{\s*key: day\.game,/.test(code) && !/key: day\.controller/.test(code));
  ok("five moves for ages 3-4, eight for 5-8 (the games' contract)", /S\.playStyle\(\) === "simple" \? 5 : 8/.test(code));
  ok("the body starts hidden, and the kid viewport meta (no zoom on a double tap)", /<body hidden data-phase="boot">/.test(PAGE) && /maximum-scale=1, user-scalable=no, viewport-fit=cover/.test(PAGE));
});

// ── 1. the day list ──
await section("days", async () => {
  ok("STORY_DAYS is fourteen days: Days 1-3, then Days 4-14 on this page", DAYS.length === 14 && DAYS.slice(0, 3).every((d) => !d.controller) && LATER.length === 11, DAYS.map((d) => d.id));
  ok("…Days 4-14 are Codex's eleven games, in their day order", LATER.map((d) => d.controller).join() === RECORDS.slice().sort((a, b) => a.day - b.day).map((r) => r.key).join(), LATER.map((d) => d.controller));
  ok("…the catalog read off sona.js is the real one (so \"none is a catalog game's\" below checks something)", CATALOG.length > 20 && CATALOG.includes("slice") && CATALOG.includes("bubbles"), CATALOG.length);
  const words = [];
  (function walk(v, at) { if (typeof v === "string") words.push([at, v]); else if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], at + "." + k); })(PAGES, "pages");
  const BAD = /\b(score|points?|correct|wrong|fail(?:ed|s)?|charge)\b/i;
  ok("every word pages.js gives a child (" + words.length + ") says none of score, points, correct, wrong, fail or charge", words.length > 100 && !words.some(([, t]) => BAD.test(t)), words.filter(([, t]) => BAD.test(t)));
  const ids = DAYS.map((d) => d.id), games = DAYS.map((d) => d.game);
  ok("every id and game key is its own: none repeats, none is a catalog game's (Day 7 is frontdoor: Day 3 owns bridge)", new Set(ids).size === 14 && new Set(games).size === 14 && !games.some((g) => CATALOG.includes(g)) && DAYS.find((d) => d.controller === "bridge").id === "frontdoor", { ids, games });
  for (const d of LATER) {
    const rec = RECORDS.find((r) => r.key === d.controller);
    const bad = [];
    if (d.id !== d.game || d.hero !== d.id) bad.push("id, game and hero are one name");
    if (d.page !== "/story-game.html?story=" + d.id) bad.push("page " + d.page);
    if (!existsSync(ROOT + "/daily-adventures/" + d.controller + ".js") || !existsSync(ROOT + "/daily-adventures/" + d.controller + ".css")) bad.push("its game's files");
    if (!PAGES[d.controller] || !["title", "intro", "startCopy", "helpText", "helpLabel", "canvasLabel", "banner", "progressLabel", "primerCopy", "pauseCopy", "helpCopy"].every((k) => typeof PAGES[d.controller][k] === "string" && PAGES[d.controller][k].length > 3) || !PAGES[d.controller].done || !PAGES[d.controller].done.title) bad.push("its words in pages.js");
    if (!rec || rec.ready !== true) bad.push("Codex's record marked ready (the game is connected and verified through this page)");
    if (!A[d.id] || A[d.id].intro.length !== 8 || A[d.id].ending.length !== 4) bad.push("its scenes in adventures.js");
    if (!existsSync(ROOT + "/assets/crafted/home-" + d.hero + ".webp")) bad.push("Home's picture home-" + d.hero + ".webp");
    for (const sc of A[d.id] ? A[d.id].intro.concat(A[d.id].ending) : []) if (!existsSync(ROOT + "/assets/adventure/" + d.id + "/" + sc.art + ".webp")) bad.push("the picture " + d.id + "/" + sc.art);
    if (!new RegExp('\\.quest-art\\[data-story="' + d.id + '"\\]\\{background:#[0-9a-f]{6};\\}', "i").test(readFileSync(ROOT + "/crafted-home.css", "utf8"))) bad.push("Home's wash for a picture still loading");
    ok("Day " + (DAYS.indexOf(d) + 1) + " (" + d.id + "): its page, game, words, scenes, pictures and record", !bad.length, bad);
  }
});

// ── the browser ──
const srv = await serve();
const browser = await chromium.launch(launchOpts());
async function phone(cfg = {}, viewport = { width: 393, height: 852 }) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await context.addInitScript(fakeDevice, { age: "7", micok: true, permission: "granted", speechMs: 100, ...cfg });
  const page = await context.newPage(), errors = [], reqs = [];
  page.on("pageerror", (e) => errors.push(e.message));
  context.on("request", (r) => reqs.push(new URL(r.url()).pathname + new URL(r.url()).search));
  await page.clock.install();
  return { context, page, errors, reqs };
}
async function landed(page, path) { await page.waitForURL((u) => new URL(u).pathname === path, { timeout: 8000 }).catch(() => {}); return new URL(page.url()).pathname === path; }

// ── 1b. every Days 4-14 picture decodes, at the size the player and Home lay out ──
await section("pictures", async () => {
  const { context, page } = await phone();
  await page.goto(srv.base + "/fonts.css");
  const list = LATER.flatMap((d) => A[d.id].intro.concat(A[d.id].ending).map((sc) => ["/assets/adventure/" + d.id + "/" + sc.art + ".webp", 800, 1200]).concat([["/assets/crafted/home-" + d.hero + ".webp", 768, 432]]));
  const got = await page.evaluate((list) => Promise.all(list.map(([src, w, h]) => new Promise((done) => { const im = new Image(); im.onload = () => done(im.naturalWidth === w && im.naturalHeight === h ? null : src + " is " + im.naturalWidth + "x" + im.naturalHeight); im.onerror = () => done(src + " does not load"); im.src = src; }))), list);
  ok("all " + list.length + " pictures of Days 4-14 (12 pages a day and Home's card) load at their size", list.length === 143 && got.every((g) => g === null), got.filter(Boolean));
  await context.close();
});

// ── 2. who may be here ──
await section("locked", async () => {
  const cases = [
    ["a family without Premium (the story is Premium)", { premium: false }, "/story-game.html?story=waterwheel"],
    ["an address that names no story", {}, "/story-game.html?story=nope"],
    ["Day 1's id (its game has its own page, not this one)", {}, "/story-game.html?story=lighthouse"],
    ["Codex's key for Day 7, which is no story id", {}, "/story-game.html?story=bridge"],
    ["anything after the story", {}, "/story-game.html?story=waterwheel&from=x"],
    ["no story at all", {}, "/story-game.html"],
  ];
  for (const [label, cfg, url] of cases) {
    const { context, page, errors, reqs } = await phone(cfg);
    await page.goto(srv.base + url).catch(() => {});
    const home = await landed(page, "/today.html");
    const q = await page.evaluate(() => ({ mics: window.__quiet ? __quiet.requests : -1, sounds: window.__quiet ? __quiet.soundsBefore + __quiet.sounds.length : -1 })).catch(() => ({}));
    ok(label + ": straight Home", home, page.url());
    ok("…before the game's own files are asked for, with no mic and no sound", !reqs.some((r) => /^\/daily-adventures\/(?!pages\.js|host\.css)[a-z]+\.(js|css)/.test(r)) && q.mics === 0 && q.sounds === 0, { reqs: reqs.filter((r) => /daily-adventures/.test(r)), q });
    ok("…and no page error", errors.length === 0, errors);
    await context.close();
  }
});

// ── 3. every game boots, at both ages ──
await section("boot", async () => {
  for (const d of LATER) for (const age of ["4", "7"]) {
    const { context, page, errors } = await phone({ age });
    // the key the page hands the engine (its end card finishes the day by it)
    await context.addInitScript(() => { let sp; Object.defineProperty(window, "SayPlay", { configurable: true, get: () => sp, set: (v) => { sp = v; const start = v && v.start; if (start) v.start = function (o) { window.__startKey = o && o.key; return start.apply(this, arguments); }; } }); });
    await page.goto(srv.base + d.page);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    const ready = await until(page, () => window.__sayplay && __sayplay.phase === "ready", 6000);
    ok(`${d.id}, age ${age}: the engine plays it as "${d.game}", the day's own key`, await page.evaluate(() => window.__startKey) === d.game, await page.evaluate(() => window.__startKey));
    const s = await page.evaluate(() => ({
      steps: window.__sayplay && __sayplay.steps, title: document.getElementById("startTitle").textContent, ttl: document.getElementById("ttl").textContent,
      start: document.getElementById("startCopy").textContent, label: document.getElementById("dailyCanvas").getAttribute("aria-label"),
      sheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => new URL(l.href).pathname), again: document.getElementById("again").hidden,
      exit: document.getElementById("goHome").textContent, hidden: document.body.hidden, doc: document.title }));
    const P = PAGES[d.controller], n = age === "4" ? 5 : 8;
    ok(`${d.id}, age ${age}: ready, with ${n} moves and the game's own words`, ready && s.steps === n && s.title === P.title && s.ttl === P.title && s.start === P.startCopy && s.label === P.canvasLabel && s.doc === "Sona — " + P.title && !s.hidden, s);
    ok(`…the game's stylesheet before the shell's (the order its suite measured)`, JSON.stringify(s.sheets) === JSON.stringify(["/fonts.css", "/sayplay.css", "/daily-adventures/" + d.controller + ".css", "/daily-adventures/host.css"]), s.sheets);
    ok(`…its end card: "See what happens!" and no Play again`, s.exit === "See what happens!" && s.again === true, s);
    await page.locator("#startBtn").click();
    const first = await sayWord(page);
    ok(`…the first word, said two times, earns the first job`, first && await page.evaluate(() => __sayplay.phase === "play" && Sona.weekReps(0) === 2), await page.evaluate(() => ({ phase: __sayplay.phase, reps: Sona.weekReps(0) })));
    ok(`…and no page error`, errors.length === 0, errors);
    await context.close();
  }
});

// ── 4. Day 4, played the way a child plays it ──
// The waterwheel's own moves, as daily-narrationtest plays them: pick each
// loose trough, turn it, drag it home, then open the gate (and split the
// stream on the last job).
async function placeRoute(page) {
  const ids = await page.evaluate(() => __dailyWaterwheel.pieces.filter((p) => !p.placed).map((p) => p.id));
  for (const id of ids) {
    let p = await page.evaluate((id) => __dailyWaterwheel.pieces.find((p) => p.id === id), id);
    await page.locator('[data-trough="' + id + '"]').click();
    const diff = Math.atan2(Math.sin(p.target.angle - p.angle), Math.cos(p.target.angle - p.angle));
    for (let i = 0; i < Math.abs(Math.round(diff / (Math.PI / 8))); i++) await page.getByRole("button", { name: diff < 0 ? "Turn selected trough left" : "Turn selected trough right", exact: true }).click();
    p = await page.evaluate((id) => __dailyWaterwheel.pieces.find((p) => p.id === id), id);
    const box = await page.locator("#dailyCanvas").boundingBox();
    await page.mouse.move(box.x + p.x * box.width, box.y + p.y * box.height); await page.mouse.down();
    await page.mouse.move(box.x + p.target.x * box.width, box.y + p.target.y * box.height, { steps: 8 }); await page.mouse.up();
  }
}
await section("play", async () => {
  const day4 = DAYS.findIndex((d) => d.id === "waterwheel");
  for (const age of ["4", "7"]) {
    const little = age === "4", n = little ? 5 : 8;
    // a Premium child who finished Days 1-3 on earlier days: today is Day 4
    const { context, page, errors } = await phone({ age, seed: { "sona.quest.v1": JSON.stringify({ i: 0, last: 13, done: "2026-01-01", s: day4, ls: day4 - 1, lk: "story" }) } });
    await page.goto(srv.base + "/adventure.html");
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    ok(`age ${age}: today's story is Day 4, the waterwheel`, await until(page, () => window.__adventure && __adventure.id === "waterwheel" && __adventure.mode === "intro", 4000), await page.evaluate(() => window.__adventure));
    await page.locator("#startBtn").click(); await advance(page, 700);
    const intro = await page.evaluate(() => ({ total: __adventure.total, art: __adventure.art }));
    ok(`…its intro: ${little ? 6 : 8} pages, Pelly's letter first`, intro.total === (little ? 6 : 8) && intro.art === "s01", intro);
    await page.locator("#skipBtn").click(); await advance(page, 700);
    ok("…the grown-ups' Skip lands on \"Let's go!\"", await page.evaluate(() => __adventure.idx === __adventure.total - 1 && !document.getElementById("goBtn").hidden));
    await page.locator("#goBtn").click();
    ok("…\"Let's go!\" opens the game on this page", await landed(page, "/story-game.html") && new URL(page.url()).search === "?story=waterwheel", page.url());
    ok("…and today's intro is marked seen (the one thing the story page writes)", await page.evaluate(() => /\|waterwheel$/.test(JSON.parse(localStorage.getItem("sona.quest.v1")).seen || "")));
    await until(page, () => window.__sayplay && __sayplay.phase === "ready", 6000);
    const coins0 = await page.evaluate(() => Sona.getCoins());
    await page.locator("#startBtn").click();
    for (let step = 0; step < n; step++) {
      if (!await sayWord(page)) { ok(`…word ${step + 1} is heard`, false, await page.evaluate(() => __sayplay)); break; }
      await placeRoute(page);
      if (step === n - 1) await page.locator(".waterwheel-share").click();
      await page.locator(".waterwheel-gate").click();
      if (!await until(page, (s) => __sayplay.step > s || __sayplay.phase === "end", 15000, step)) { ok(`…job ${step + 1}: the water reaches its bed`, false, await page.evaluate(() => ({ play: __sayplay, w: __dailyWaterwheel }))); break; }
    }
    ok(`…all ${n} jobs done by real words and a real finger: the end card`, await until(page, () => __sayplay.phase === "end", 6000), await page.evaluate(() => __sayplay.phase));
    const end = await page.evaluate(() => ({ q: JSON.parse(localStorage.getItem("sona.quest.v1")), e: Sona.storyEnding("waterwheel"), coins: Sona.getCoins(), reps: Sona.weekReps(0), out: Object.keys(Sona.outcomes()).length, exit: document.getElementById("goHome").textContent, again: document.getElementById("again").hidden }));
    ok("…the round finished Day 4: one more story, one sticker, no coins", end.q.s === day4 + 1 && end.q.ls === day4 && end.q.lk === "story" && end.e.ok && end.e.got.length === 1 && end.coins === coins0, { ...end, coins0 });
    ok("…every saying is a game rep, none is practice data", end.reps === n * 2 && end.out === 0, end);
    ok("…and its one button is \"See what happens!\"", end.exit === "See what happens!" && end.again === true, end);
    await page.locator("#goHome").click();
    ok("…which opens Day 4's ending", await landed(page, "/adventure.html") && new URL(page.url()).search === "?part=end&story=waterwheel", page.url());
    await until(page, () => window.__adventure && __adventure.mode === "end", 4000);
    await page.locator("#startBtn").click(); await advance(page, 700);
    ok(`…${little ? 3 : 4} ending pages`, await page.evaluate((t) => __adventure.total === t && __adventure.art === "e01", little ? 3 : 4));
    await page.locator("#skipBtn").click(); await advance(page, 700);
    const got = await page.evaluate(() => document.getElementById("gotList").textContent);
    ok("…then the sticker the round gave", /^You got .+!$/.test(got) && got.includes(end.e.got[0].name), got);
    await page.locator("#homeBtn").click();
    ok("…and Back home", await landed(page, "/today.html"));
    ok("…with no page error on the way", errors.length === 0, errors);
    await context.close();
  }
});

await browser.close(); await srv.close();
console.log(`\nstorygametest: ${count - fails}/${count} passed`);
process.exitCode = fails ? 1 : 0;
