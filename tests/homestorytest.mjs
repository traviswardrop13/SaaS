// HOME (STORY1, 22 Oct 2026; Travis chose both age groups, today's painted
// clay look, and the story is Premium). Home is one big card, today's story,
// with two doors under it (Arcade: every game, as Home was; Books: the
// bookshelf) and the Trophy Road card. This suite pins what a child and a
// parent can see and do there:
//   - the story card in each state: open, locked with a "Premium" tag (a tap
//     opens the price at once, with no note), done with tomorrow's picture
//     dark, a game day after Day 3, the game of the day on a phone that
//     cannot buy; its tap is the game card's own tap (the handler pin);
//   - moving between Home and the Arcade: the doors switch views with no
//     reload, "‹ Home", Back and Forward, ?locked= opening the Arcade with its
//     note, activities.html's address rules, the page titles;
//   - Books: the door opens the bookshelf with the Books card's own tag;
//   - Home stays quiet: nothing written, sent or spoken, on load, on coming
//     back to the front, or moving between the views;
//   - the fit: the story's play button and both doors on the first screen at
//     five sizes, every button at least 44 px, no sideways scroll;
//   - Reduce Motion: nothing animates, and the fit is the same as without it
//     and holds still through re-fits (coming back to the front, ‹ Home);
//   - a story picture that has not landed is Echo on the story's wash.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

let fails = 0, count = 0;
function ok(label, pass, detail = "") { count++; if (!pass) fails++; console.log((pass ? "PASS " : "FAIL ") + label + (pass ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); }
async function section(label, run) { try { await run(); } catch (e) { ok(label + " completes", false, e.stack); } }

const SRC = readFileSync(ROOT + "/today.html", "utf8");
const SONA = readFileSync(ROOT + "/sona.js", "utf8");
const STORY = [...SONA.matchAll(/\{ id: "(\w+)", game: "\w+", page: "[^"]+", hero: "\w+",\s*title: "([^"]+)",\s*line: "([^"]+)" \}/g)].map((m) => ({ id: m[1], title: m[2], line: m[3] }));

// ── a plain server: public/, /api/* recorded, and stubs for every page a tap
// on Home can lead to (each only needs to be landed on) ──
const asked = [];
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2", json: "application/json", webmanifest: "application/manifest+json" };
const STUB = /^\/(?:adventure|subscribe|library|charge|road|settings|premium|customize|arcade-[a-z]+)\.html$/;
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__sona") { res.writeHead(200, { "content-type": "text/html" }); res.end('<!doctype html><title>Store</title><body></body><script src="/sona.js"></script>'); return; }
  if (STUB.test(url.pathname)) { res.writeHead(200, { "content-type": "text/html" }); res.end('<!doctype html><meta charset="utf-8"><title>' + url.pathname + "</title><body><h1>" + url.pathname + "</h1></body>"); return; }
  if (url.pathname.startsWith("/api/")) {
    let body = ""; req.on("data", (c) => { body += c; });
    req.on("end", () => { asked.push({ path: url.pathname, body, from: (() => { try { return new URL(req.headers.referer || "").pathname; } catch (e) { return ""; } })() }); res.writeHead(url.pathname === "/api/tts" ? 503 : 200, { "content-type": "application/json" }); res.end("{}"); });
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
// grandfathered and the paywall vanishes). sub: Premium from a subscription
// (no founding banner); ea: an early adopter (Premium, and the website's
// founding banner, the tallest Home there is); sell: this browser sells (the
// QA seam sona.websalesui), so a family without Premium is one the price can
// open; stamp: what the free-version sweep wrote. quest: the adventure record,
// with "TODAY" read as this phone's own date. The idea sheet starts answered
// and the offer from Home already shown: neither is this suite's subject.
function seed({ age = 7, sub = false, ea = false, sell = false, stamp = "kept", quest = null } = {}) {
  return `(() => {
    try { sessionStorage.setItem("sona.paidui", "1"); sessionStorage.setItem("sona.websalesui", "${sell ? 1 : 0}"); } catch (e) {}
    const say = (t) => { if (String(t || "").trim()) { const a = JSON.parse(sessionStorage.getItem("test.speech") || "[]"); a.push(String(t)); sessionStorage.setItem("test.speech", JSON.stringify(a)); } return Promise.resolve(); };
    let sona; Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set: (v) => { sona = v; v.speak = say; v.speakNow = say; } });
    if (window.speechSynthesis) window.speechSynthesis.speak = (u) => say(u && u.text);
    if (localStorage.getItem("__seeded")) return; localStorage.setItem("__seeded", "1");
    const d = new Date(), p2 = (n) => String(n).padStart(2, "0"), TODAY = d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "${age}", focusSounds: ["R"], onboarded: true, voiceOn: true, volume: 0.8${ea ? ", earlyAdopter: true" : ""} }));
    localStorage.setItem("sona.freeera.v1", "post");
    ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
    localStorage.setItem("sona.freever.v1", "${stamp}"); localStorage.setItem("sona.buddyset.v1", "kept");
    localStorage.setItem("sona.offerseen.v1", "1");
    localStorage.setItem("sona.pulse.v1", JSON.stringify({ cool: Date.now() + 365 * 86400000 }));
    ${sub ? 'localStorage.setItem("sona.sub.v1", JSON.stringify({ active: true, since: Date.now(), source: "stripe" }));' : ""}
    ${quest ? `localStorage.setItem("sona.quest.v1", ${JSON.stringify(JSON.stringify(quest))}.replace(/TODAY/g, TODAY));` : ""}
  })();`;
}
async function open(opts = {}, page = "/today.html") {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, reducedMotion: opts.reduce ? "reduce" : "no-preference" });
  await ctx.route("**/*", (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));
  await ctx.addInitScript(seed(opts));
  const pg = await ctx.newPage(); pg.setDefaultTimeout(6000);
  const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
  if (page) await home(pg, page);
  return { ctx, pg, errors };
}
async function home(pg, page = "/today.html") {
  await pg.goto(origin + page);
  await pg.waitForFunction(() => window.Sona && !document.getElementById("libraryApp").hidden && document.querySelector("#activityGroups .game-card"));
  await pg.waitForTimeout(250);
}
// what the story card shows
const card = (pg) => pg.evaluate(() => {
  const c = document.getElementById("questCard"), $ = (id) => document.getElementById(id), vis = (e) => !!(e && e.offsetParent && !e.hidden);
  const im = $("questPic").querySelector("img"), art = $("questArt"), go = $("questGo").getBoundingClientRect(), r = c.getBoundingClientRect();
  return { shown: vis(c), chip: vis($("questChip")) ? $("questChip").textContent : null, lock: vis($("questLock")) ? $("questLock").textContent : null,
    title: $("questTitle").textContent, line: $("questLine").textContent, go: vis($("questGo")) ? { w: go.width, h: go.height } : null,
    done: c.classList.contains("done"), disabled: c.getAttribute("aria-disabled"), aria: c.getAttribute("aria-label"),
    img: im ? new URL(im.getAttribute("src"), location.href).pathname : null, fallback: art.classList.contains("fallback"), story: art.getAttribute("data-story"),
    dark: im ? getComputedStyle(im).filter : "", text: c.innerText, h: r.height };
});
const view = (pg) => pg.evaluate(() => document.getElementById("libraryApp").getAttribute("data-view"));
const store = (pg) => pg.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
const speech = (pg) => pg.evaluate(() => JSON.parse(sessionStorage.getItem("test.speech") || "[]"));
async function tapTo(pg, sel, re) {
  const went = pg.waitForURL(re, { timeout: 4000 }).then(() => true, () => false);
  await pg.locator(sel).click();
  return went;
}
const pathOf = (pg) => { const u = new URL(pg.url()); return u.pathname + u.search; };
// words a child must never read on Home
const BAD = /coming soon|\bscores?\b|\bpoints?\b|\$\s?\d|of 14\b/i;

ok("(the three story days are found in sona.js)", STORY.length === 3 && STORY.map((d) => d.id).join() === "lighthouse,windup,bridge", STORY);

// ── 1. the story card's states ──
await section("an open story", async () => {
  for (const age of [7, 4]) {
    const { ctx, pg, errors } = await open({ sub: true, age });
    const c = await card(pg), a = "age " + age + ": ";
    const top = await pg.evaluate(() => ({ h1: document.querySelector("h1").textContent, title: document.title, view: document.getElementById("libraryApp").getAttribute("data-view"), text: document.querySelector(".home-only").innerText }));
    ok(a + "Home opens on \"Today's adventure\", its first heading, titled \"Sona\"", top.h1 === "Today's adventure" && top.title === "Sona" && top.view === "home", top);
    ok(a + "the story card shows Day 1, its title and its hook (both age groups get the story)", c.shown && c.chip === "Day 1" && c.title === STORY[0].title && c.line === STORY[0].line, c);
    ok(a + "…with a big round play button (at least 64 px) and no Premium tag", c.go && c.go.w >= 64 && c.go.h >= 64 && c.lock === null && c.disabled === "false", c);
    ok(a + "…its picture is the story's own (or Echo on its wash until it lands)", c.story === "lighthouse" && (c.img === "/assets/crafted/home-lighthouse.webp" || (c.fallback && c.img === "/assets/crafted/echo-welcome.webp")), c);
    ok(a + "…and its label says it all for a screen reader", c.aria === "Today's adventure, day 1: " + STORY[0].title + ". " + STORY[0].line + " Play.", c.aria);
    ok(a + "nothing on Home says coming soon, score, points, a price or \"of 14\"", !BAD.test(top.text), top.text);
    ok(a + "a tap opens the story", await tapTo(pg, "#questCard", /\/adventure\.html$/), pg.url());
    ok(a + "no page errors", errors.length === 0, errors);
    await ctx.close();
  }
});

await section("a locked story", async () => {
  for (const stamp of ["post", "kept"]) {
    const { ctx, pg, errors } = await open({ sell: true, stamp });
    const c = await card(pg), w = stamp === "post" ? "a family who owes the price: " : "a family keeping the free version, where Sona sells: ";
    ok(w + "the story still shows, with a small Premium tag on its picture", c.shown && c.chip === "Day 1" && c.title === STORY[0].title && c.lock === "Premium", c);
    ok(w + "…the play button stays, and the label says Premium", c.go && c.go.w >= 64 && / Premium\.$/.test(c.aria), c);
    // the price's answer is held (204: the browser stays put), so what Home
    // did before leaving can still be read
    const navs = [];
    await ctx.route(/\/(?:subscribe|premium)\.html|[?&]gate=1/, (r) => { navs.push(new URL(r.request().url())); return r.fulfill({ status: 204, body: "" }); });
    await pg.locator("#questCard").click(); await pg.waitForTimeout(300);
    const left = await pg.evaluate(() => ({ notice: !document.getElementById("libraryNotice").hidden, gate: document.getElementById("gateOvl").classList.contains("show") }));
    ok(w + "a tap opens the price at once, on the story", navs.length === 1 && navs[0].pathname + navs[0].search === "/subscribe.html?from=adventure", navs.map((u) => u.pathname + u.search));
    ok(w + "…with no note and no grown-ups check in between", !left.notice && !left.gate, left);
    ok(w + "no page errors", errors.length === 0, errors);
    await ctx.close();
  }
});

await section("a story finished today", async () => {
  {
    const { ctx, pg, errors } = await open({ sub: true, quest: { i: 0, last: 13, s: 1, ls: 0, lk: "story", done: "TODAY", got: [] } });
    const c = await card(pg);
    ok("Day 1 done: \"Day 1 done!\" and \"Come back tomorrow for Day 2!\"", c.title === "Day 1 done!" && c.line === "Come back tomorrow for Day 2!" && c.done, c);
    ok("…with tomorrow's picture (Day 2's), shown dark", c.story === "windup" && (c.img === "/assets/crafted/home-windup.webp" || c.fallback) && /brightness\(0\.15\)/.test(c.dark), c);
    ok("…no play button, no chip, no tag, and aria-disabled", c.go === null && c.chip === null && c.lock === null && c.disabled === "true" && c.aria === "Day 1 done! Come back tomorrow for Day 2!", c);
    // (forced: Playwright itself refuses a tap on an aria-disabled button)
    await pg.locator("#questCard").click({ force: true }); await pg.waitForTimeout(300);
    ok("…and a tap does nothing: tomorrow is never playable early", pathOf(pg) === "/today.html", pg.url());
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    const { ctx, pg, errors } = await open({ sub: true, quest: { i: 4, last: 3, s: 3, ls: 2, lk: "story", done: "TODAY", got: [] } });
    const c = await card(pg);
    ok("Day 3 done: \"Day 3 done!\" and \"Come back tomorrow for a new adventure!\" (no Day 4 is promised)", c.title === "Day 3 done!" && c.line === "Come back tomorrow for a new adventure!" && c.done && c.go === null, c);
    ok("…with tomorrow's game picture, dark", c.img === "/assets/crafted/home-glide.webp" && /brightness\(0\.15\)/.test(c.dark) && !c.story, c);
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
});

await section("after the stories: the game of the day", async () => {
  {
    const { ctx, pg, errors } = await open({ sub: true, quest: { i: 3, last: 2, s: 3, ls: 2, lk: "story", done: "2026-01-01" } });
    const c = await card(pg);
    ok("a game day after Day 3: the day's game, its line and its picture", c.title === "Sound Sprint" && c.line === "Race Echo to the beach before the waves roll in!" && c.img === "/assets/crafted/home-run.webp" && !c.story, c);
    ok("…with no day chip and no \"Day N of 14\" anywhere", c.chip === null && !/\bday\b/i.test(c.text) && !/of 14/.test(c.aria), c);
    ok("…and a tap is that game's own tap (its practice page)", await tapTo(pg, "#questCard", /\/charge\.html\?game=arcade-run\.html$/), pg.url());
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    const { ctx, pg, errors } = await open({ sub: true, quest: { i: 4, last: 3, s: 3, ls: 2, lk: "game", done: "TODAY" } });
    const c = await card(pg);
    ok("a game day finished today: \"All done for today!\" and \"Come back tomorrow for a new adventure!\"", c.title === "All done for today!" && c.line === "Come back tomorrow for a new adventure!" && c.done && c.go === null && c.disabled === "true", c);
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // a phone that cannot buy, without Premium: no locked story, ever (a
    // wall nobody can pass is a broken app); day 3 is Block Stacker, which
    // this family cannot open, so the day borrows a game it can
    const { ctx, pg, errors } = await open({ sell: false, stamp: "post", quest: { i: 2, last: 1, done: "2026-01-01" } });
    const c = await card(pg);
    const titles = STORY.map((d) => d.title);
    ok("a phone that cannot buy: no story, the game of the day instead", c.shown && !titles.includes(c.title) && c.chip === null && !c.story, c);
    ok("…a game it can open (never Block Stacker, never a Premium tag)", ["Fruit Slice", "Piano Tiles"].includes(c.title) && c.lock === null && / Play\.$/.test(c.aria), c);
    ok("…and its tap opens that game", await tapTo(pg, "#questCard", /\/charge\.html\?game=arcade-(?:slice|tiles)\.html$/), pg.url());
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
});

// ── 2. the source: the card's tap is launch(), and Home only reads ──
{
  const code = SRC.replace(/<!--[\s\S]*?-->/g, " ").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  ok("the card's tap is the game card's own tap (launch: access, the price, levels)", (SRC.match(/card\.onclick=function\(\)\{if\(done\)return;launch\(game\);\}/g) || []).length === 1);
  ok("…on a story day the item is the story card itself, \"adventure\" to the rules, opening adventure.html",
    /var game=story\?\{kind:"story",key:"adventure",name:q\.story\.title,go:"\/adventure\.html",tier:"premium"\}/.test(SRC));
  ok("Home never finishes a quest (no questEnd anywhere in today.html, comments included)", !/questEnd/.test(SRC));
  ok("Home sends no event and opens no chest, road gift, month or board", !/\btrack\(|addCoins|mintCoins|chestOpen|roadOpen|monthOpen|roadSettle|board(?:Flush|View|Start|Claim|Leave|Nick)/.test(code));
  ok("…speaks nothing (only the empty speakNow that cancels a turn)", !/speakNow\("[^"]/.test(code) && !/\bspeak\(/.test(code));
  ok("…and names no price", !/\$\d/.test(SRC));
  ok("no door to a parked reader", !/story\.html|chapter\.html/.test(code));
  ok("the old Home's retired pieces stay gone", !/id="(?:goBtn|heroCard|jarRow|sheetOvl|goProgress|goSettings|goTalk|weekCard|wkWins|planCard|storyBits|shareWeek|thumbs)"/.test(SRC));
  ok("the pieces other suites read are where they were", ["function paintRoad(){", '<a id="roadCard"', '<div class="ovl" id="levelOvl"', "function openLevels(game){"].every((s) => SRC.includes(s)));
  ok("one book door in the source, shared by the Books card and Home's Books door", (code.match(/location\.href="\/library\.html"/g) || []).length === 1 && /booksCard\.onclick=openBooks;homeBooksBtn\.onclick=openBooks;/.test(SRC));
  ok("the offer-from-Home guard is untouched: ?view=arcade does not skip it", /!\/\[\?&\]\(gate\|locked\|libraryPreview\)=\/\.test\(q\)/.test(SRC) && /S\.homeOfferDue\(\)\)\{[\s\S]{0,300}return;\s*\}\s*app\.hidden=false;\s*setView\(viewOf\(\)\);/.test(SRC));
  {
    // Home's card and the story player show the same colour while a story's
    // picture loads (the card's wash, then the page's)
    const css = readFileSync(ROOT + "/crafted-home.css", "utf8"), adv = readFileSync(ROOT + "/adventures.js", "utf8");
    const wrong = ["lighthouse", "windup", "bridge"].filter((id) => {
      const home = (css.match(new RegExp('\\.quest-art\\[data-story="' + id + '"\\]\\{background:(#[0-9a-f]{6});')) || [])[1];
      const player = (adv.match(new RegExp("\\n    " + id + ": \\{\\n      wash: \"(#[0-9a-f]{6})\"")) || [])[1];
      return !home || home !== player;
    });
    ok("each story's wash is the same colour on Home's card and in the story player", wrong.length === 0, wrong);
  }
  ok("each view is hidden on its wrapper, never by a block's own hidden", /#libraryApp\[data-view="home"\] \.arcade-only,#libraryApp\[data-view="arcade"\] \.home-only\{display:none;\}/.test(readFileSync(ROOT + "/crafted-home.css", "utf8")));
}

// ── 3. moving between Home and the Arcade ──
await section("the views", async () => {
  const { ctx, pg, errors } = await open({ sub: true, viewport: { width: 320, height: 568 } });
  const hidden = await pg.evaluate(() => ({ pick: !!document.getElementById("arcadeTitle").offsetParent, cards: !!document.querySelector("#activityGroups .game-card").offsetParent, books: !!document.getElementById("booksCard").offsetParent }));
  ok("Home shows no shelf, no \"Pick a game!\" and no Books card: they are one tap away", !hidden.pick && !hidden.cards && !hidden.books && (await pg.getByRole("heading", { name: "Pick a game!", exact: true }).count()) === 0, hidden);
  await pg.evaluate(() => { window.__same = 1; window.scrollTo(0, 80); });
  const len0 = await pg.evaluate(() => history.length);
  await pg.locator("#arcadeBtn").click(); await pg.waitForTimeout(150);
  let s = await pg.evaluate(() => ({ same: window.__same, y: window.pageYOffset, focus: document.activeElement && document.activeElement.id, title: document.title, len: history.length, pick: !!document.getElementById("arcadeTitle").offsetParent, story: !!document.getElementById("questCard").offsetParent }));
  ok("the Arcade door switches to the Arcade at once, with no reload", s.same === 1 && (await view(pg)) === "arcade" && s.pick && !s.story, s);
  ok("…at its own address, /today.html?view=arcade (one more step in history)", pathOf(pg) === "/today.html?view=arcade" && s.len === len0 + 1, { url: pg.url(), s });
  ok("…scrolled to the top, focus on \"Pick a game!\", titled \"Sona — Play library\"", s.y === 0 && s.focus === "arcadeTitle" && s.title === "Sona — Play library", s);
  const back = await pg.locator("#homeBack").boundingBox();
  ok("\"‹ Home\" is a full-size button in the Arcade", back && back.height >= 44 && back.width >= 44, back);
  await pg.waitForTimeout(550); // past the half second Home ignores taps after a switch
  await pg.locator("#homeBack").click(); await pg.waitForTimeout(200);
  s = await pg.evaluate(() => ({ same: window.__same, focus: document.activeElement && document.activeElement.id, title: document.title, story: !!document.getElementById("questCard").offsetParent }));
  ok("\"‹ Home\" goes back to Home (the step the door added), with no reload", s.same === 1 && pathOf(pg) === "/today.html" && (await view(pg)) === "home" && s.story && s.title === "Sona" && s.focus === "homeTitle", { url: pg.url(), s });
  await pg.goForward(); await pg.waitForTimeout(200);
  ok("Forward opens the Arcade again, still with no reload", (await pg.evaluate(() => window.__same)) === 1 && (await view(pg)) === "arcade" && pathOf(pg) === "/today.html?view=arcade");
  await pg.goBack(); await pg.waitForTimeout(200);
  ok("…and Back comes Home", (await pg.evaluate(() => window.__same)) === 1 && (await view(pg)) === "home" && pathOf(pg) === "/today.html");
  ok("the views: no page errors", errors.length === 0, errors);
  await ctx.close();
});

// ── a double tap on a door that switches the view (22 Oct 2026: the second
// tap landed on whatever the new view put under the finger, Today's first
// pick, and opened a game the child never picked, or the price) ──
await section("a double tap", async () => {
  // at 430x932 the Arcade puts Today's picks where the door was. The spot is
  // found on the page, not assumed: a few pixels of font (CI's headless
  // Chromium) moved a gap under the door's middle.
  for (const vp of [{ width: 430, height: 932 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    const at = vp.width + "x" + vp.height + ": ";
    const { ctx, pg, errors } = await open({ sub: true, viewport: vp });
    const b = await pg.locator("#arcadeBtn").boundingBox();
    const spot = await pg.evaluate((r) => {
      const app = document.getElementById("libraryApp"); app.setAttribute("data-view", "arcade");
      let found = null;
      for (let i = 1; i <= 7 && !found; i++) for (let j = 1; j <= 7 && !found; j++) {
        const x = r.x + (r.width * j) / 8, y = r.y + (r.height * i) / 8, e = document.elementFromPoint(x, y), card = e && e.closest(".game-card, a, button");
        if (card) found = { x, y, under: card.id || card.className };
      }
      app.setAttribute("data-view", "home");
      return found || { x: r.x + r.width / 2, y: r.y + r.height / 2, under: null };
    }, b);
    const under = spot.under;
    if (vp.width === 430) ok(at + "(a game card sits where the door was, so this is the real case)", !!under, under);
    await pg.mouse.dblclick(spot.x, spot.y); await pg.waitForTimeout(700);
    ok(at + "a double tap on the Arcade door opens the Arcade and nothing under the finger (" + under + " sits there)", pathOf(pg) === "/today.html?view=arcade" && (await view(pg)) === "arcade" && (await pg.evaluate(() => document.getElementById("levelOvl") ? document.getElementById("levelOvl").hidden !== false || !document.getElementById("levelOvl").offsetParent : true)), { url: pg.url(), under });
    const card = pg.locator("#activityGroups .game-card:not([disabled])").first();
    await card.click(); await pg.waitForURL((u) => new URL(u).pathname !== "/today.html", { timeout: 3000 }).catch(() => {});
    ok(at + "…and a moment later a tap on a game opens it, as before", new URL(pg.url()).pathname !== "/today.html", pg.url());
    await home(pg, "/today.html?view=arcade");
    const h = await pg.locator("#homeBack").boundingBox();
    await pg.mouse.dblclick(h.x + h.width / 2, h.y + h.height / 2); await pg.waitForTimeout(700);
    ok(at + "a double tap on \"‹ Home\" comes Home and opens nothing", pathOf(pg) === "/today.html" && (await view(pg)) === "home", pg.url());
    ok(at + "no page errors", errors.length === 0, errors);
    await ctx.close();
  }
});

await section("addresses", async () => {
  {
    const { ctx, pg, errors } = await open({ sub: true }, "/today.html?view=arcade");
    const len0 = await pg.evaluate(() => history.length);
    ok("/today.html?view=arcade opens the Arcade, titled for the play library", (await view(pg)) === "arcade" && (await pg.title()) === "Sona — Play library");
    await pg.locator("#homeBack").click(); await pg.waitForTimeout(150);
    ok("there, \"‹ Home\" (nothing to go back to) replaces the address with /today.html", pathOf(pg) === "/today.html" && (await view(pg)) === "home" && (await pg.evaluate(() => history.length)) === len0, pg.url());
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // a typed address to a grey game: the Arcade, with its note (a phone that
    // cannot buy, so the note, not the price)
    const { ctx, pg, errors } = await open({ sell: false, stamp: "kept" }, "/today.html?locked=stack");
    const note = await pg.evaluate(() => ({ shown: !document.getElementById("libraryNotice").hidden, text: document.getElementById("libraryMessage").textContent }));
    ok("?locked= opens the Arcade with that game's note", (await view(pg)) === "arcade" && note.shown && /Block Stacker/.test(note.text), note);
    await pg.locator("#homeBack").click(); await pg.waitForTimeout(150);
    ok("…and going Home closes the note", (await view(pg)) === "home" && (await pg.evaluate(() => document.getElementById("libraryNotice").hidden)));
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    const { ctx, pg } = await open({ sub: true }, null);
    for (const [from, to] of [
      ["/activities.html", "/today.html?view=arcade"],
      ["/activities.html?libraryPreview=1#games", "/today.html?libraryPreview=1&view=arcade#games"],
      ["/activities.html?locked=stack#booksCard", "/today.html?locked=stack#booksCard"],
      ["/activities.html?view=home", "/today.html?view=home"],
    ]) {
      await pg.goto(origin + from); await pg.waitForURL(/\/today\.html/);
      const u = new URL(pg.url());
      ok("activities.html: " + from + " → " + to, u.pathname + u.search + u.hash === to, u.pathname + u.search + u.hash);
    }
    await pg.waitForFunction(() => window.Sona && !document.getElementById("libraryApp").hidden);
    ok("…and ?view=home is Home", (await view(pg)) === "home");
    await ctx.close();
  }
});

// ── 4. Books ──
await section("Books", async () => {
  for (const [label, opts, tag] of [["with Premium", { sub: true }, "Included"], ["keeping the free version", { sell: false, stamp: "kept" }, "1 free book"], ["owing the price", { sell: true, stamp: "post" }, "Premium"]]) {
    const { ctx, pg, errors } = await open(opts);
    const t = await pg.evaluate(() => ({ home: document.getElementById("homeBooksTag").textContent, card: document.getElementById("booksTag").textContent, word: document.querySelector("#homeBooksBtn .door-word").textContent }));
    ok(label + ": the Books door says \"" + tag + "\", the Books card's own tag", t.home === tag && t.card === tag && t.word === "Books", t);
    ok(label + ": …and opens the bookshelf", await tapTo(pg, "#homeBooksBtn", /\/library\.html$/), pg.url());
    ok(label + ": no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  const { ctx, pg } = await open({ sub: true });
  const a = await pg.evaluate(() => ({ word: document.querySelector("#arcadeBtn .door-word").textContent, sub: document.querySelector("#arcadeBtn .door-sub").textContent, pic: !!document.querySelector("#arcadePic img") }));
  ok("the Arcade door: a picture, \"Arcade\" and \"All the games\"", a.word === "Arcade" && a.sub === "All the games" && a.pic, a);
  await ctx.close();
});

// ── 5. Home stays quiet ──
await section("Home stays quiet", async () => {
  for (const [label, opts] of [["an open story", { sub: true }], ["a locked story", { sell: true, stamp: "post" }], ["a story done today", { sub: true, quest: { i: 0, last: 13, s: 1, ls: 0, lk: "story", done: "TODAY", got: [] } }]]) {
    const { ctx, pg, errors } = await open(opts, null);
    await pg.goto(origin + "/__sona"); await pg.waitForFunction(() => window.Sona && Sona.questToday);
    const before = await store(pg);
    asked.length = 0;
    await home(pg);
    const loaded = await store(pg);
    await pg.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
    await pg.waitForTimeout(250);
    await pg.locator("#arcadeBtn").click(); await pg.waitForTimeout(100);
    await pg.waitForTimeout(550); // past the half second Home ignores taps after a switch
    await pg.locator("#homeBack").click(); await pg.waitForTimeout(200);
    const after = await store(pg);
    ok(label + ": loading Home writes nothing", before === loaded, { before: before.length, loaded: loaded.length });
    ok(label + ": …nor does coming back to the front, or moving to the Arcade and back", loaded === after);
    const own = asked.filter((x) => x.from === "/today.html" && /^\/api\/(?:track|tts|board)\b/.test(x.path));
    ok(label + ": Home sends no event, asks no voice and no board", own.length === 0, own);
    ok(label + ": Home never spoke", (await speech(pg)).length === 0, await speech(pg));
    ok(label + ": no page errors", errors.length === 0, errors);
    await ctx.close();
  }
});

// ── 6. the fit ──
const SIZES = [[320, 568], [375, 667], [390, 844], [430, 932], [768, 1024]];
const STATES = [
  ["Day 1, open", { sub: true }],
  ["Day 2, the longest title", { sub: true, quest: { i: 0, last: 13, s: 1, ls: 0, lk: "story", done: "2026-01-01", got: [] } }],
  ["locked", { sell: true, stamp: "post" }],
  ["done", { sub: true, quest: { i: 0, last: 13, s: 1, ls: 0, lk: "story", done: "TODAY", got: [] } }],
  ["a game day", { sub: true, quest: { i: 3, last: 2, s: 3, ls: 2, lk: "story", done: "2026-01-01" } }],
  ["ages 3-4", { sub: true, age: 4 }],
  ["the founding banner", { ea: true }],
];
const measure = (pg) => pg.evaluate(() => {
  const box = (e) => { if (!e || !e.offsetParent) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
  const $ = (id) => document.getElementById(id), art = document.querySelector(".quest-art");
  const buttons = [...document.querySelectorAll(".home-only button, .home-only a[href], #libraryApp header button, #libraryApp header a")].filter((e) => e.offsetParent).map((e) => ({ id: e.id, w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height }));
  return { y: window.pageYOffset, ih: window.innerHeight, ox: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    go: box($("questGo")), card: box($("questCard")), arcade: box($("arcadeBtn")), books: box($("homeBooksBtn")), art: box(art), buttons,
    pics: [box($("arcadePic")), box($("homeBooksPic"))], words: [...document.querySelectorAll("#homeDoors .door-word")].map(box),
    hit: (() => { const out = {}; ["arcadeBtn", "homeBooksBtn", "questGo"].forEach((id) => { const e = $(id); if (!e || !e.offsetParent) return; const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); out[id] = !!h && (h === e || e.contains(h) || (id === "questGo" && $("questCard").contains(h))); }); return out; })() };
});
for (const [w, h] of SIZES) {
  await section("fit at " + w + "x" + h, async () => {
    for (const [label, opts] of STATES) {
      const { ctx, pg, errors } = await open({ ...opts, viewport: { width: w, height: h } });
      await pg.evaluate(() => document.fonts && document.fonts.ready); await pg.waitForTimeout(100);
      const m = await measure(pg), at = w + "x" + h + " " + label + ": ";
      const goOk = label === "done" ? m.go === null : !!m.go && m.go.w >= 64 && m.go.h >= 64 && m.go.b <= m.ih && m.go.t >= 0;
      ok(at + "the play button is on the first screen" + (label === "done" ? " (none when done)" : ", at least 64 px"), m.y === 0 && goOk, m.go);
      ok(at + "both doors are on the first screen, side by side, at least 88 px tall, and tappable", !!m.arcade && !!m.books && m.arcade.b <= m.ih && m.books.b <= m.ih && Math.abs(m.arcade.t - m.books.t) < 1 && m.arcade.r <= m.books.l && m.arcade.h >= 88 && m.books.h >= 88 && m.hit.arcadeBtn && m.hit.homeBooksBtn, { arcade: m.arcade, books: m.books, ih: m.ih, hit: m.hit });
      ok(at + "every button is at least 44 px, and nothing scrolls sideways", m.ox <= 1 && m.buttons.every((b) => b.w >= 44 && b.h >= 44), { ox: m.ox, small: m.buttons.filter((b) => b.w < 44 || b.h < 44) });
      ok(at + "the picture gives way but never goes (no flatter than 3:1)", !!m.art && m.art.h >= m.art.w / 3 - 1, m.art);
      // the Arcade's painting is Echo among the games' things, out at its
      // edges: a square crop kept Echo and dropped every game, so a child who
      // can't read saw two doors of Echo. Each door's picture is a wide band
      // (3:2 on an iPad, 2:1 to 5:2 on a phone), and the two words sit level.
      ok(at + "each door's picture is wide enough to show the games' things (3:2 to 5:2), and the two words sit level", m.pics.every((p) => p && p.w / p.h >= 1.45 && p.w / p.h <= 2.55) && m.words.length === 2 && Math.abs(m.words[0].t - m.words[1].t) < 1, { pics: m.pics, words: m.words });
      ok(at + "no page errors", errors.length === 0, errors);
      await ctx.close();
    }
  });
}

// ── 7. Reduce Motion ──
await section("Reduce Motion", async () => {
  const { ctx, pg, errors } = await open({ sub: true, reduce: true, viewport: { width: 320, height: 568 } });
  const still = () => pg.evaluate(() => {
    const moving = [];
    document.querySelectorAll("#libraryApp, #libraryApp *").forEach((e) => {
      if (!e.offsetParent && e.id !== "libraryApp") return;
      const cs = getComputedStyle(e), secs = (v) => Math.max(...v.split(",").map((x) => parseFloat(x) * (/ms/.test(x) ? 0.001 : 1)));
      if (cs.animationName !== "none" && secs(cs.animationDuration) > 0.00001) moving.push(e.id || e.className + " animation");
      if (cs.transitionProperty !== "none" && secs(cs.transitionDuration) > 0.00001) moving.push((e.id || e.className) + " transition " + cs.transitionDuration);
    });
    return { moving, running: document.getAnimations().filter((a) => a.playState === "running").length };
  });
  const s1 = await still();
  ok("under Reduce Motion nothing on Home moves: no animation, no transition", s1.moving.length === 0 && s1.running === 0, s1);
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const pressed = {};
  for (const sel of ["#questCard", "#arcadeBtn", "#homeBooksBtn"]) {
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: sel });
    await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["active"] });
    pressed[sel] = await pg.evaluate((s) => getComputedStyle(document.querySelector(s)).transform, sel);
    await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
  }
  ok("…and a press does not squash the story card or a door", Object.values(pressed).every((t) => t === "none"), pressed);
  await pg.locator("#arcadeBtn").click(); await pg.waitForTimeout(80);
  const s2 = await still();
  ok("…nor does the switch to the Arcade animate", s2.running === 0 && (await view(pg)) === "arcade", s2);
  ok("Reduce Motion: no page errors", errors.length === 0, errors);
  await ctx.close();
});

// ── 7b. Reduce Motion: the fit holds still ──
// sona.css gives every property a 0.01 ms transition under Reduce Motion, and
// a box mid-transition reports the size it WAS. The check above counts 0.01 ms
// as still, so it never saw this: with the fit's type and gaps left to
// transition, the fit measured step 2 as doing nothing (the story's picture
// shrank further than it needed), and every re-fit (fonts ready, coming back
// to the front, ‹ Home) read step 2's smaller boxes after taking it off,
// stopped early, and the doors grew back below the fold, flipping each time
// Home came back. So: every element a fit rule resizes has transition none
// (read from crafted-home.css's own rules, so a new rule is held too), and on
// the sizes where it flipped (a 4.7-inch iPhone in Safari, two iPads on their
// side, the founding banner), the fit under Reduce Motion is the one without
// it, and two quick returns to the front and a trip to the Arcade change
// nothing.
await section("Reduce Motion: the fit", async () => {
  {
    const { ctx, pg, errors } = await open({ sub: true, reduce: true, viewport: { width: 320, height: 568 } });
    const loose = await pg.evaluate(() => {
      const app = document.getElementById("libraryApp"), had = app.className, rules = [], out = [];
      const walk = (list) => { for (const r of list) { if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.selectorText && /#libraryApp\.fit\d/.test(r.selectorText)) rules.push(r); } };
      for (const sh of document.styleSheets) { if (!/crafted-home\.css/.test(sh.href || "")) continue; try { walk(sh.cssRules); } catch (e) { out.push("unreadable " + sh.href); } }
      for (let i = 1; i <= 9; i++) app.classList.add("fit" + i);
      rules.forEach((r) => {
        const inherits = /font|line-height|letter-spacing/.test(r.style.cssText);
        r.selectorText.split(",").forEach((sel) => {
          document.querySelectorAll(sel).forEach((e) => {
            [e, ...(inherits ? e.querySelectorAll("*") : [])].forEach((x) => { if (getComputedStyle(x).transitionProperty !== "none") out.push(sel.trim() + " → " + (x.id || x.className || x.tagName) + ": " + getComputedStyle(x).transitionProperty); });
          });
        });
      });
      app.className = had;
      return { rules: rules.length, out };
    });
    ok("every element a fit step resizes (each #libraryApp.fitN rule in crafted-home.css) never transitions", loose.rules >= 9 && loose.out.length === 0, loose);
    ok("…no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  const fitOf = (pg) => pg.evaluate(() => {
    const r = (id) => document.getElementById(id).getBoundingClientRect(), bar = document.getElementById("homeInset").offsetHeight;
    return { fit: [...document.getElementById("libraryApp").classList].filter((c) => /^fit\d$/.test(c)).join(","), doors: Math.round(r("homeDoors").bottom), go: Math.round(r("questGo").bottom), banner: !!document.getElementById("trialBanner").offsetHeight, room: window.innerHeight - bar, y: window.pageYOffset };
  });
  const settle = (pg) => pg.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
  for (const [w, h, label, opts] of [[375, 553, "an iPhone SE in Safari", { sub: true }], [1024, 768, "an iPad on its side", { sub: true }], [1133, 744, "an iPad mini on its side", { sub: true }], [375, 667, "the founding banner", { ea: true }]]) {
    const at = w + "x" + h + " (" + label + "), Reduce Motion: ";
    const plain = await open({ ...opts, viewport: { width: w, height: h } });
    await plain.pg.evaluate(() => document.fonts && document.fonts.ready); await settle(plain.pg);
    const want = await fitOf(plain.pg);
    await plain.ctx.close();
    const { ctx, pg, errors } = await open({ ...opts, reduce: true, viewport: { width: w, height: h } });
    await pg.evaluate(() => document.fonts && document.fonts.ready); await settle(pg);
    const first = await fitOf(pg);
    const onScreen = (m) => m.y === 0 && m.doors <= m.room && m.go <= m.room;
    ok(at + "the fit is the one without Reduce Motion, with the play button and both doors on screen", first.fit === want.fit && first.doors === want.doors && onScreen(first) && (label !== "the founding banner" || first.banner), { first, want });
    await pg.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); document.dispatchEvent(new Event("visibilitychange")); });
    await settle(pg);
    const back = await fitOf(pg);
    ok(at + "two quick returns to the front keep the same fit, the doors on screen", back.fit === first.fit && back.doors === first.doors && onScreen(back), { first, back });
    await pg.locator("#arcadeBtn").click(); await settle(pg);
    await pg.waitForTimeout(550); // past the half second Home ignores taps after a switch
    await pg.locator("#homeBack").click(); await pg.waitForFunction(() => document.getElementById("libraryApp").getAttribute("data-view") === "home"); await settle(pg);
    const trip = await fitOf(pg);
    ok(at + "…and so does the Arcade and ‹ Home", trip.fit === first.fit && trip.doors === first.doors && onScreen(trip), { first, trip });
    ok(at + "no page errors", errors.length === 0, errors);
    await ctx.close();
  }
});

// ── 8. pictures ──
await section("pictures", async () => {
  const fruit = readFileSync(ROOT + "/assets/crafted/home-fruit.webp");
  {
    const { ctx, pg } = await open({ sub: true }, null);
    await ctx.route(/\/assets\/crafted\/home-(?:lighthouse|arcade)\.webp$/, (r) => r.fulfill({ status: 404, body: "" }));
    await home(pg); await pg.waitForTimeout(200);
    const c = await card(pg);
    const wash = await pg.evaluate(() => getComputedStyle(document.getElementById("questArt")).backgroundColor);
    ok("a story picture that has not landed: Echo's welcome pose on the story's own wash (never a blank, never invented art)", c.fallback && c.img === "/assets/crafted/echo-welcome.webp" && wash === "rgb(43, 47, 94)", { c, wash });
    const door = await pg.evaluate(() => ({ fb: document.getElementById("arcadePic").classList.contains("fallback"), src: document.querySelector("#arcadePic img").getAttribute("src") }));
    ok("…and the Arcade door's picture falls back to Echo cheering", door.fb && door.src === "/assets/crafted/echo-cheer.webp", door);
    await ctx.close();
  }
  {
    const { ctx, pg } = await open({ sub: true }, null);
    await ctx.route(/\/assets\/crafted\/home-(?:lighthouse|arcade)\.webp$/, (r) => r.fulfill({ status: 200, contentType: "image/webp", body: fruit }));
    await home(pg); await pg.waitForTimeout(200);
    const c = await card(pg);
    const loaded = await pg.evaluate(() => { const i = document.querySelector("#questPic img"); return i.complete && i.naturalWidth > 0; });
    ok("once it lands, the story's own picture is shown", !c.fallback && c.img === "/assets/crafted/home-lighthouse.webp" && loaded, c);
    ok("…and the Arcade door's own", await pg.evaluate(() => !document.getElementById("arcadePic").classList.contains("fallback") && document.querySelector("#arcadePic img").getAttribute("src") === "/assets/crafted/home-arcade.webp"));
    await ctx.close();
  }
});

await browser.close(); server.close();
console.log(fails ? fails + " FAILURES / " + count + " checks" : "ALL GREEN — " + count + " checks");
process.exit(fails ? 1 : 0);
