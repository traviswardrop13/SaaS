// HOME (STORY1, 22 Oct 2026; Travis chose both age groups, today's painted
// clay look, and the story is Premium). Home is one big card, today's story,
// with two doors under it (Arcade: every game, as Home was, and since 23 Oct
// 2026 only games; Books: the bookshelf, its one way in) and, since 23 Oct
// 2026 (FOUND1), "Your games": the games the child's finished stories left
// behind. This suite pins what a child and a parent can see and do there:
//   - the story card in each state: open, locked with a "Premium" tag (a tap
//     opens the price at once, with no note), done with tomorrow's picture
//     dark, a game day after Day 14, the game of the day on a phone that
//     cannot buy; its tap is the game card's own tap (the handler pin);
//   - Your games: no row before a story is finished or without the story's
//     rule, newest first, New! on today's, a tap plays the game again;
//   - moving between Home and the Arcade: the doors switch views with no
//     reload, "‹ Home", Back and Forward, ?locked= opening the Arcade with its
//     note, activities.html's address rules, the page titles; the Arcade
//     holds no book (23 Oct 2026);
//   - Books: Home's door is the one way to the bookshelf, with its own tag;
//   - Home stays quiet: nothing written, sent or spoken, on load, on coming
//     back to the front, or moving between the views;
//   - the day's reel (HOMECLIP1, 28 Oct 2026): the card's picture is a tall
//     3:4 clip of the game the day plays (/assets/home/reel/<game>.mp4,
//     muted, looping, inline), over its poster, over the picture the card had
//     before; never under Reduce Motion, never on a finished day (tomorrow's
//     poster, dark), held still on a hidden page and in the Arcade, and a
//     clip that cannot start leaves the poster as it is;
//   - the fit: the card's title and play button on the first screen at five
//     sizes, the doors right after the card, every button at least 44 px, no
//     sideways scroll;
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
const STORY = [...SONA.matchAll(/\{ id: "(\w+)", game: "\w+",(?: controller: "\w+",)? page: "[^"]+", hero: "\w+",(?: name: "[^"]+",)?\s*title: "([^"]+)",\s*line: "([^"]+)" \}/g)].map((m) => ({ id: m[1], title: m[2], line: m[3] }));

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
// Every page here stands in a phone that plays no H.264 (canPlayType says
// "" to an MP4), whatever this Chromium can do: a plain Chromium build plays
// none, but CI's newer one does, and the clip then played there (29 Oct
// 2026). "a phone that plays the clips" below stands in one that does.
function seed({ age = 7, sub = false, ea = false, sell = false, stamp = "kept", quest = null } = {}) {
  return `(() => {
    const cpt = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function (t) { return /mp4|avc1/i.test(String(t)) ? "" : cpt.call(this, t); };
    // TALK1: this suite plays the lighthouse as Day 1 (a child on a sound with no talking story still meets it); talkstorytest plays the talking ones
    try { sessionStorage.setItem("sona.talkoff", "1"); sessionStorage.setItem("sona.paidui", "1"); sessionStorage.setItem("sona.websalesui", "${sell ? 1 : 0}"); } catch (e) {}
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
// HOMECLIP1: the clip and its poster live here; until a key's poster has
// landed on disk the card shows the picture it had before (pic), and Echo if
// that has not landed either. The seed stands in a phone that plays no H.264,
// so it is always the poster here; "a phone that plays the clips" below
// stands in one that does.
const REEL = "/assets/home/reel/";
const onDisk = (p) => existsSync(ROOT + p);
const shows = (key, pic) => (onDisk(REEL + key + ".webp") ? REEL + key + ".webp" : pic && onDisk(pic) ? pic : "/assets/crafted/echo-welcome.webp");
// what the story card shows
const card = (pg) => pg.evaluate(() => {
  const c = document.getElementById("questCard"), $ = (id) => document.getElementById(id), vis = (e) => !!(e && e.offsetParent && !e.hidden);
  const im = $("questPic").querySelector("img"), art = $("questArt"), go = $("questGo").getBoundingClientRect(), r = c.getBoundingClientRect();
  return { shown: vis(c), chip: vis($("questChip")) ? $("questChip").textContent : null, lock: vis($("questLock")) ? $("questLock").textContent : null,
    title: $("questTitle").textContent, line: $("questLine").textContent, go: vis($("questGo")) ? { w: go.width, h: go.height } : null,
    done: c.classList.contains("done"), disabled: c.getAttribute("aria-disabled"), aria: c.getAttribute("aria-label"),
    img: im ? new URL(im.getAttribute("src"), location.href).pathname : null, fallback: art.classList.contains("fallback"), story: art.getAttribute("data-story"),
    dark: im ? getComputedStyle(im).filter : "", text: c.innerText, h: r.height,
    clip: (() => { const v = $("questClip"); return { hidden: v.hidden, src: v.getAttribute("src"), poster: v.getAttribute("poster"), on: v.classList.contains("on"), muted: v.muted }; })() };
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

ok("(the fourteen story days are found in sona.js)", STORY.length === 14 && STORY.slice(0, 3).map((d) => d.id).join() === "lighthouse,windup,bridge", STORY);
// the story with the longest title, for the fit (Home's card must hold it)
const LONGEST = STORY.reduce((n, d, i) => (d.title.length > STORY[n].title.length ? i : n), 0);

// ── 1. the story card's states ──
await section("an open story", async () => {
  for (const age of [7, 4]) {
    const { ctx, pg, errors } = await open({ sub: true, age });
    const c = await card(pg), a = "age " + age + ": ";
    const top = await pg.evaluate(() => ({ h1: document.querySelector("h1").textContent, title: document.title, view: document.getElementById("libraryApp").getAttribute("data-view"), text: document.querySelector(".home-only").innerText }));
    ok(a + "Home opens on \"Today's adventure\", its first heading, titled \"Sona\"", top.h1 === "Today's adventure" && top.title === "Sona" && top.view === "home", top);
    ok(a + "the story card shows Day 1, its title and its hook (both age groups get the story)", c.shown && c.chip === "Day 1" && c.title === STORY[0].title && c.line === STORY[0].line, c);
    ok(a + "…with a big round play button (at least 64 px) and no Premium tag", c.go && c.go.w >= 64 && c.go.h >= 64 && c.lock === null && c.disabled === "false", c);
    ok(a + "…its picture is the poster of the day's clip (until that lands, the story's own picture, or Echo on its wash)", c.story === "lighthouse" && c.img === shows("lighthouse", "/assets/crafted/home-lighthouse.webp"), c);
    ok(a + "…and on a phone that plays no H.264 (the seed's) the clip stays hidden and loads nothing", c.clip.hidden && !c.clip.src && !c.clip.on, c.clip);
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
    // (noWaitAfter: Playwright 1.64 waits for the held navigation to finish)
    await pg.locator("#questCard").click({ noWaitAfter: true }); await pg.waitForTimeout(300);
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
    ok("Day 1 done: \"Day 1 done!\" and \"Come back tomorrow for Day 2 and a new game!\"", c.title === "Day 1 done!" && c.line === "Come back tomorrow for Day 2 and a new game!" && c.done, c);
    ok("…with tomorrow's poster (Day 2's game), shown dark, and no clip", c.story === "windup" && c.img === shows("windup", "/assets/crafted/home-windup.webp") && /brightness\(0\.15\)/.test(c.dark) && c.clip.hidden && !c.clip.src, c);
    ok("…no play button, no chip, no tag, and aria-disabled", c.go === null && c.chip === null && c.lock === null && c.disabled === "true" && c.aria === "Day 1 done! Come back tomorrow for Day 2 and a new game!", c);
    // (forced: Playwright itself refuses a tap on an aria-disabled button)
    await pg.locator("#questCard").click({ force: true }); await pg.waitForTimeout(300);
    ok("…and a tap does nothing: tomorrow is never playable early", pathOf(pg) === "/today.html", pg.url());
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    const { ctx, pg, errors } = await open({ sub: true, quest: { i: 4, last: 3, s: 3, ls: 2, lk: "story", done: "TODAY", got: [] } });
    const c = await card(pg);
    ok("Day 3 done: \"Day 3 done!\" and \"Come back tomorrow for Day 4 and a new game!\"", c.title === "Day 3 done!" && c.line === "Come back tomorrow for Day 4 and a new game!" && c.done && c.go === null, c);
    ok("…with Day 4's poster, dark", c.story === STORY[3].id && c.img === shows(STORY[3].id, "/assets/crafted/home-" + STORY[3].id + ".webp") && !c.fallback && /brightness\(0\.15\)/.test(c.dark), c);
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    const { ctx, pg, errors } = await open({ sub: true, quest: { i: 4, last: 3, s: 14, ls: 13, lk: "story", done: "TODAY", got: [] } });
    const c = await card(pg);
    ok("Day 14 done: \"Day 14 done!\" and \"Come back tomorrow for a new adventure!\" (no Day 15 is promised)", c.title === "Day 14 done!" && c.line === "Come back tomorrow for a new adventure!" && c.done && c.go === null, c);
    ok("…with tomorrow's game's poster, dark", c.img === shows("glide", "/assets/crafted/home-glide.webp") && /brightness\(0\.15\)/.test(c.dark) && !c.story, c);
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // a family whose story is locked by tomorrow (free days cancelled, where
    // Sona sells): tomorrow's story is shown locked and brings no game, so
    // the card promises the day alone
    const { ctx, pg, errors } = await open({ sell: true, stamp: "post", quest: { i: 0, last: 13, s: 1, ls: 0, lk: "story", done: "TODAY", got: [] } });
    const c = await card(pg);
    ok("a story finished today on a phone whose stories are now locked: \"Come back tomorrow for Day 2!\", no new game promised", c.title === "Day 1 done!" && c.line === "Come back tomorrow for Day 2!" && c.done && c.go === null, c);
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
});

// ── FOUND1 (23 Oct 2026): every story leaves its game behind ──
const found = (pg) => pg.evaluate(() => {
  const row = document.getElementById("foundRow"), doors = document.getElementById("homeDoors").getBoundingClientRect();
  const r = row.getBoundingClientRect();
  return { shown: !row.hidden && r.height > 0, belowDoors: r.top >= doors.bottom - 1, h2: document.getElementById("foundTitle").textContent,
    tiles: [...row.querySelectorAll(".found-tile")].map((b) => { const q = b.getBoundingClientRect(), im = b.querySelector("img"); return { id: b.getAttribute("data-story"), name: b.querySelector(".found-name").textContent, aria: b.getAttribute("aria-label"), fresh: !!b.querySelector(".found-new"), img: im ? new URL(im.getAttribute("src"), location.href).pathname : null, h: q.height, w: q.width, game: b.hasAttribute("data-game") || b.classList.contains("game-card") }; }),
    scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
});
await section("Your games: the games the stories left", async () => {
  {
    const { ctx, pg, errors } = await open({ sub: true });
    const f = await found(pg);
    ok("a child who has finished no story: no row at all", !f.shown && f.tiles.length === 0, f);
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    const { ctx, pg, errors } = await open({ sub: true, quest: { i: 0, last: 13, s: 1, ls: 0, lk: "story", done: "TODAY", got: [] } });
    const before = await store(pg);
    const f = await found(pg);
    ok("Day 1 done today: \"Your games\" under the doors, with Light the Way, marked New!", f.shown && f.belowDoors && f.h2 === "Your games" && f.tiles.length === 1 && f.tiles[0].id === "lighthouse" && f.tiles[0].name === "Light the Way" && f.tiles[0].fresh, f);
    ok("…its picture is the story's Home picture, it is a full tap target, it is no game card, and its name is read out", f.tiles[0].img === "/assets/crafted/home-lighthouse.webp" && f.tiles[0].h >= 44 && f.tiles[0].w >= 44 && !f.tiles[0].game && f.tiles[0].aria === "Light the Way. New! Play again.", f.tiles[0]);
    ok("…and painting it wrote nothing", (await store(pg)) === before);
    ok("a tap plays the game again (its page's ?again=1)", await tapTo(pg, ".found-tile[data-story=lighthouse]", /\/arcade-lighthouse\.html\?again=1$/), pg.url());
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    const { ctx, pg, errors } = await open({ sub: true, quest: { i: 0, last: 13, s: 5, ls: 4, lk: "story", done: "2026-01-01", got: [] } });
    const f = await found(pg);
    ok("five stories finished, Day 6 open: five tiles, newest first, none New! (nothing found today)", f.shown && f.tiles.map((t) => t.id).join() === [4, 3, 2, 1, 0].map((n) => STORY[n].id).join() && f.tiles.every((t) => !t.fresh), f.tiles.map((t) => t.id));
    // the list scrolls sideways, so it clips at its padding: the keyboard's
    // focus ring (3 px, 4 px outside a tile) must fit inside it whole
    await pg.focus(".found-tile[data-story=" + STORY[4].id + "]"); await pg.keyboard.press("Shift+Tab"); await pg.keyboard.press("Tab");
    const ring = await pg.evaluate(() => {
      const t = document.activeElement, l = document.getElementById("foundList"), cs = getComputedStyle(t), lc = getComputedStyle(l);
      const out = parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset), a = t.getBoundingClientRect(), b = l.getBoundingClientRect();
      const bw = (k) => parseFloat(lc["border" + k + "Width"]) || 0;
      return { id: t.getAttribute("data-story"), style: cs.outlineStyle, out, inside: a.left - out >= b.left + bw("Left") - 0.5 && a.top - out >= b.top + bw("Top") - 0.5 && a.bottom + out <= b.bottom - bw("Bottom") + 0.5 && a.right + out <= b.right + 0.5 };
    });
    ok("a keyboard's focus ring on the first tile is whole: the sideways list never clips it", ring.style !== "none" && ring.out >= 6 && ring.inside, ring);
    ok("a Days 4-14 game plays again on the shared page", await tapTo(pg, ".found-tile[data-story=waterwheel]", /\/story-game\.html\?story=waterwheel&again=1$/), pg.url());
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // a family without the story, where the price can open it: the story card
    // is shown locked, and the row is not there (a grey tile would open the
    // price in front of a child)
    const { ctx, pg, errors } = await open({ sell: true, stamp: "post", quest: { i: 0, last: 13, s: 3, ls: 2, lk: "story", done: "2026-01-01", got: [] } });
    const f = await found(pg), c = await card(pg);
    ok("without Premium (the story shown locked): no row, never a grey tile", !f.shown && f.tiles.length === 0 && c.lock === "Premium", { f, c });
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    const { ctx, pg, errors } = await open({ stamp: "kept", quest: { i: 0, last: 13, s: 3, ls: 2, lk: "story", done: "2026-01-01", got: [] } });
    const f = await found(pg);
    ok("a phone that cannot buy, without Premium: no row", !f.shown && f.tiles.length === 0, f);
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  for (const vp of [{ width: 320, height: 568 }, { width: 768, height: 1024 }]) {
    const { ctx, pg, errors } = await open({ sub: true, age: 4, viewport: vp, quest: { i: 0, last: 13, s: 14, ls: 13, lk: "story", done: "TODAY", got: [] } });
    const f = await found(pg), at = vp.width + "px: ";
    ok(at + "all fourteen found (ages 3-4 too): the row scrolls on its own, the page never sideways", f.shown && f.tiles.length === 14 && f.tiles[0].fresh && f.tiles[0].id === STORY[13].id && f.scroll <= 1 && f.tiles.every((t) => t.h >= 44), { n: f.tiles.length, scroll: f.scroll });
    ok(at + "no page errors", errors.length === 0, errors);
    await ctx.close();
  }
});

await section("after the stories: the game of the day", async () => {
  {
    const { ctx, pg, errors } = await open({ sub: true, quest: { i: 3, last: 2, s: 14, ls: 13, lk: "story", done: "2026-01-01" } });
    const c = await card(pg);
    ok("a game day after Day 14: the day's game, its line and its picture", c.title === "Sound Sprint" && c.line === "Race Echo to the beach before the waves roll in!" && c.img === shows("run", "/assets/crafted/home-run.webp") && !c.story, c);
    ok("…with no day chip and no \"Day N of 14\" anywhere", c.chip === null && !/\bday\b/i.test(c.text) && !/of 14/.test(c.aria), c);
    ok("…and a tap is that game's own tap (its practice page)", await tapTo(pg, "#questCard", /\/charge\.html\?game=arcade-run\.html$/), pg.url());
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    const { ctx, pg, errors } = await open({ sub: true, quest: { i: 4, last: 3, s: 14, ls: 13, lk: "game", done: "TODAY" } });
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
  // HOMECLIP1: the day's reel is one video, in the card's picture
  ok("the day's clip: one muted, looping, inline video in the card's picture, the phone's own video buttons off, hidden from a screen reader",
    /<span class="quest-art" id="questArt" aria-hidden="true"><span class="quest-pic" id="questPic"><\/span><video class="quest-clip" id="questClip" muted loop playsinline autoplay preload="metadata" disablepictureinpicture disableremoteplayback x-webkit-airplay="deny" aria-hidden="true" hidden><\/video>/.test(SRC) && (SRC.match(/<video\b/g) || []).length === 1);
  ok("…its clip and poster are the day's game's, under /assets/home/reel/, and a finished day plays none",
    /var REEL="\/assets\/home\/reel\/"/.test(SRC) && /clip\.poster=REEL\+key\+"\.webp";clip\.src=REEL\+key\+"\.mp4";/.test(SRC) && /if\(done\)clipOff\(\);else clipOn\(q\.game\);/.test(SRC));
  ok("…muted again before every play, and never started under Reduce Motion or on a phone that cannot play it",
    /clip\.muted=true;var r=clip\.play\(\)/.test(SRC) && /if\(!clip\|\|!key\|\|calm\(\)\|\|!canClip\(\)\)\{clipOff\(\);return;\}/.test(SRC));
  ok("…on a story day the item is the story card itself, \"adventure\" to the rules, opening adventure.html",
    /var game=story\?\{kind:"story",key:"adventure",name:q\.story\.title,go:"\/adventure\.html",tier:"premium"\}/.test(SRC));
  ok("Home never finishes a quest (no questEnd anywhere in today.html, comments included)", !/questEnd/.test(SRC));
  ok("Home sends no event and opens no chest, road gift, month or board", !/\btrack\(|addCoins|mintCoins|chestOpen|roadOpen|monthOpen|roadSettle|board(?:Flush|View|Start|Claim|Leave|Nick)/.test(code));
  ok("…speaks nothing (only the empty speakNow that cancels a turn)", !/speakNow\("[^"]/.test(code) && !/\bspeak\(/.test(code));
  ok("…and names no price", !/\$\d/.test(SRC));
  ok("no door to a parked reader", !/story\.html|chapter\.html/.test(code));
  ok("the old Home's retired pieces stay gone", !/id="(?:goBtn|heroCard|jarRow|sheetOvl|goProgress|goSettings|goTalk|weekCard|wkWins|planCard|storyBits|shareWeek|thumbs)"/.test(SRC));
  ok("the pieces other suites read are where they were", ["function paintGift(){", '<a id="giftBtn"', "function paintFound(){", '<section id="foundRow"', '<div class="ovl" id="levelOvl"', "function openLevels(game){"].every((s) => SRC.includes(s)));
  // THE ARCADE IS GAMES ONLY (Travis, 23 Oct 2026: "organize the arcade so
  // that there are no books in there"): the Arcade's Books card is gone, so
  // Home's Books door is the one way to the bookshelf, with one handler, and
  // nothing in the markup or the code still builds the card or a book tile.
  ok("one book door in the source: Home's Books door, its one handler", (code.match(/location\.href="\/library\.html"/g) || []).length === 1 && (SRC.match(/homeBooksBtn\.onclick=openBooks;/g) || []).length === 1 && /function openBooks\(\)\{clearMessage\(\);location\.href="\/library\.html";\}/.test(SRC));
  ok("…and the Arcade's Books card is gone, from the markup and the code (no card, picture, tag, line or heading)", !/id="(?:booksCard|libraryBooksArt|booksTag|booksLine|booksHeading)"/.test(SRC) && !/\b(?:booksCard|libraryBooksArt|booksTag|booksLine|booksHeading)\b/.test(code), (code.match(/\b(?:booksCard|libraryBooksArt|booksTag|booksLine|booksHeading)\b/g) || []));
  ok("…and no row draws a book tile (no book card, no book access, no book launch)", !/book-card|bookAccess|kind==="book"\)\{|kind==="book"\?/.test(code));
  ok("the offer-from-Home guard is untouched: ?view=arcade does not skip it", /!\/\[\?&\]\(gate\|locked\|libraryPreview\)=\/\.test\(q\)/.test(SRC) && /S\.homeOfferDue\(\)\)\{[\s\S]{0,300}return;\s*\}\s*app\.hidden=false;\s*setView\(viewOf\(\)\);/.test(SRC));
  {
    // Home's card and the story player show the same colour while a story's
    // picture loads (the card's wash, then the page's)
    const css = readFileSync(ROOT + "/crafted-home.css", "utf8"), adv = readFileSync(ROOT + "/adventures.js", "utf8");
    const wrong = STORY.map((d) => d.id).filter((id) => {
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
  const hidden = await pg.evaluate(() => ({ pick: !!document.getElementById("arcadeTitle").offsetParent, cards: !!document.querySelector("#activityGroups .game-card").offsetParent, picks: !!(document.querySelector("#featuredGroups .game-card") || {}).offsetParent, door: !!document.getElementById("homeBooksBtn").offsetParent }));
  ok("Home shows no shelf, no Today's picks and no \"Pick a game!\": they are one tap away, and the Books door is Home's", !hidden.pick && !hidden.cards && !hidden.picks && hidden.door && (await pg.getByRole("heading", { name: "Pick a game!", exact: true }).count()) === 0, hidden);
  await pg.evaluate(() => { window.__same = 1; window.scrollTo(0, 80); });
  const len0 = await pg.evaluate(() => history.length);
  await pg.locator("#arcadeBtn").click(); await pg.waitForTimeout(150);
  let s = await pg.evaluate(() => ({ same: window.__same, y: window.pageYOffset, focus: document.activeElement && document.activeElement.id, title: document.title, len: history.length, pick: !!document.getElementById("arcadeTitle").offsetParent, story: !!document.getElementById("questCard").offsetParent }));
  ok("the Arcade door switches to the Arcade at once, with no reload", s.same === 1 && (await view(pg)) === "arcade" && s.pick && !s.story, s);
  ok("…at its own address, /today.html?view=arcade (one more step in history)", pathOf(pg) === "/today.html?view=arcade" && s.len === len0 + 1, { url: pg.url(), s });
  ok("…scrolled to the top, focus on \"Pick a game!\", titled \"Sona — Play library\"", s.y === 0 && s.focus === "arcadeTitle" && s.title === "Sona — Play library", s);
  // the Arcade is games only (Travis, 23 Oct 2026): no Books card, no book in
  // any row, no book cover anywhere in it, and the Books door stays Home's;
  // above the shelves, Today's picks alone, two games, then the shelves
  const arc = await pg.evaluate(() => {
    const vis = (e) => !!(e && e.offsetParent);
    return { card: !!document.getElementById("booksCard"), books: document.querySelectorAll("#libraryApp .book-card, #libraryApp [data-game^='book:']").length,
      covers: [...document.querySelectorAll(".arcade-only img")].filter((i) => /\/assets\/books\//.test(i.getAttribute("src") || "")).length,
      door: vis(document.getElementById("homeBooksBtn")), rows: [...document.querySelectorAll("#featuredGroups > section")].map((x) => x.getAttribute("data-collection")),
      picks: [...document.querySelectorAll('#featuredGroups > section[data-collection="picks"] .game-card')].filter(vis).map((b) => b.getAttribute("data-game")),
      heads: [...document.querySelectorAll(".arcade-only h2")].filter(vis).map((h) => h.textContent) };
  });
  ok("…and it holds no book: no Books card, no book tile, no cover, no Books door", !arc.card && arc.books === 0 && arc.covers === 0 && !arc.door, arc);
  ok("…one row above the shelves, Today's picks, with two different games (no What's new, no Limited time)", arc.rows.join() === "picks" && arc.picks.length === 2 && arc.picks[0] !== arc.picks[1] && arc.picks.every((k) => k && !/^book:/.test(k)) && !arc.heads.some((h) => /what's new|limited time|^books$/i.test(h)), arc);
  const back = await pg.locator("#homeBack").boundingBox();
  ok("\"‹ Home\" is a full-size button in the Arcade", back && back.height >= 44 && back.width >= 44, back);
  await pg.waitForTimeout(550); // past the half second Home ignores taps after a switch
  await pg.locator("#homeBack").click(); await pg.waitForTimeout(200);
  s = await pg.evaluate(() => ({ same: window.__same, y: window.pageYOffset, focus: document.activeElement && document.activeElement.id, title: document.title, story: !!document.getElementById("questCard").offsetParent }));
  ok("\"‹ Home\" goes back to Home (the step the door added), with no reload", s.same === 1 && pathOf(pg) === "/today.html" && (await view(pg)) === "home" && s.story && s.title === "Sona" && s.focus === "homeTitle", { url: pg.url(), s });
  // (the door sits below the fold here since HOMECLIP1, so the child had
  // scrolled down to it: the browser put that scroll back after the view's
  // own, and Home came back halfway down, its focused heading out of sight)
  ok("…at its top, the heading that has the focus in sight, not where the door was tapped", s.y === 0, s);
  await pg.goForward(); await pg.waitForTimeout(200);
  ok("Forward opens the Arcade again, still with no reload", (await pg.evaluate(() => window.__same)) === 1 && (await view(pg)) === "arcade" && pathOf(pg) === "/today.html?view=arcade");
  await pg.goBack(); await pg.waitForTimeout(200);
  ok("…and Back comes Home", (await pg.evaluate(() => window.__same)) === 1 && (await view(pg)) === "home" && pathOf(pg) === "/today.html");
  // the page's own scroll keeping is for its own two steps: Back from
  // another page (a game, the price) opens the Arcade where the child was
  await pg.waitForTimeout(550);
  await pg.locator("#arcadeBtn").click(); await pg.waitForTimeout(200);
  await pg.evaluate(() => window.scrollTo(0, 400)); await pg.waitForTimeout(100);
  const was = await pg.evaluate(() => window.pageYOffset);
  await pg.goto(origin + "/privacy.html"); await pg.waitForTimeout(150);
  await pg.goBack();
  await pg.waitForFunction(() => window.Sona && !document.getElementById("libraryApp").hidden && document.querySelector("#activityGroups .game-card"));
  await pg.waitForTimeout(400);
  const there = await pg.evaluate(() => ({ y: window.pageYOffset, view: document.getElementById("libraryApp").getAttribute("data-view") }));
  ok("Back from another page opens the Arcade where the child was, not at its top", was > 300 && there.view === "arcade" && Math.abs(there.y - was) < 40, { was, there });
  ok("the views: no page errors", errors.length === 0, errors);
  await ctx.close();
});

// ── midnight with Home in front (CAL1): the day's story moves on then,
// played or not, so Home reads the new day itself ──
await section("midnight", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route("**/*", (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));
  await ctx.addInitScript(seed({ sub: true }));
  await ctx.addInitScript(() => { sessionStorage.setItem("test.loads", String(Number(sessionStorage.getItem("test.loads") || 0) + 1)); });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
  const night = new Date(); night.setHours(23, 59, 0, 0);
  await pg.clock.install({ time: night });
  await home(pg);
  const before = await card(pg);
  await pg.clock.runFor(30 * 1000);
  const still = await pg.evaluate(() => Number(sessionStorage.getItem("test.loads")));
  await pg.clock.runFor(60 * 1000);
  const reloaded = await pg.waitForFunction(() => Number(sessionStorage.getItem("test.loads")) >= 2, null, { timeout: 8000 }).then(() => true, () => false);
  await pg.waitForFunction(() => window.Sona && !document.getElementById("libraryApp").hidden && document.querySelector("#activityGroups .game-card"));
  const after = await card(pg);
  ok("at 23:59 the card is Day 1, and Home does not reload before midnight", before.chip === "Day 1" && still === 1, { before: before.chip, still });
  ok("just past midnight Home reads the new day by itself: the card is Day 2", reloaded && after.chip === "Day 2" && after.title === STORY[1].title, { reloaded, after: after.chip, title: after.title });
  ok("midnight: no page errors", errors.length === 0, errors);
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
    // (on a small phone the doors sit below the fold since HOMECLIP1: a child
    // swipes up to them first, and the Arcade then opens at its top)
    await pg.locator("#arcadeBtn").scrollIntoViewIfNeeded();
    const b = await pg.locator("#arcadeBtn").boundingBox();
    const spot = await pg.evaluate((r) => {
      const app = document.getElementById("libraryApp"), y0 = window.pageYOffset; app.setAttribute("data-view", "arcade"); window.scrollTo(0, 0);
      let found = null;
      for (let i = 1; i <= 7 && !found; i++) for (let j = 1; j <= 7 && !found; j++) {
        const x = r.x + (r.width * j) / 8, y = r.y + (r.height * i) / 8, e = document.elementFromPoint(x, y), card = e && e.closest(".game-card, a, button");
        if (card) found = { x, y, under: card.id || card.className };
      }
      app.setAttribute("data-view", "home"); window.scrollTo(0, y0);
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
      // (its # part kept exactly; #booksCard was this fragment until 23 Oct
      // 2026, when the Arcade's Books card went)
      ["/activities.html?locked=stack#activityGroups", "/today.html?locked=stack#activityGroups"],
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
    // (the Arcade's Books card, which shared this tag, went on 23 Oct 2026:
    // the door is the one place a parent reads it)
    const t = await pg.evaluate(() => ({ home: document.getElementById("homeBooksTag").textContent, card: !!document.getElementById("booksCard") || !!document.getElementById("booksTag"), word: document.querySelector("#homeBooksBtn .door-word").textContent }));
    ok(label + ": the Books door says \"" + tag + "\", and no Books card in the Arcade says anything", t.home === tag && !t.card && t.word === "Books", t);
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
// HOMECLIP1 (28 Oct 2026): the day's card is Home's one big thing, a tall
// 3:4 reel, and the games and books sit lower. So the card's foot, with its
// title and its play button, is on the first screen at every size, and the
// doors come right after the card: on a small phone they (and "Your games")
// fall below the fold, one swipe away.
const SIZES = [[320, 568], [375, 667], [390, 844], [430, 932], [768, 1024]];
const STATES = [
  ["Day 1, open", { sub: true }],
  ["Day " + (LONGEST + 1) + ", the longest title", { sub: true, quest: { i: 0, last: 13, s: LONGEST, ls: Math.max(0, LONGEST - 1), lk: "story", done: "2026-01-01", got: [] } }],
  ["locked", { sell: true, stamp: "post" }],
  ["done", { sub: true, quest: { i: 0, last: 13, s: 1, ls: 0, lk: "story", done: "TODAY", got: [] } }],
  ["done, the founding banner", { ea: true, quest: { i: 0, last: 13, s: 1, ls: 0, lk: "story", done: "TODAY", got: [] } }],
  ["a game day", { sub: true, quest: { i: 3, last: 2, s: 14, ls: 13, lk: "story", done: "2026-01-01" } }],
  ["ages 3-4", { sub: true, age: 4 }],
  ["the founding banner", { ea: true }],
];
const measure = (pg) => pg.evaluate(() => {
  const box = (e) => { if (!e || !e.offsetParent) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
  const $ = (id) => document.getElementById(id), art = document.querySelector(".quest-art"), page = document.querySelector(".home-only").getBoundingClientRect();
  const buttons = [...document.querySelectorAll(".home-only button, .home-only a[href], #libraryApp header button, #libraryApp header a")].filter((e) => e.offsetParent).map((e) => ({ id: e.id, w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height }));
  // a tap at an element's middle reaches it (the clip and the words over the
  // picture never take the card's tap); a door below the fold is scrolled to
  // first, and the page put back where it was
  const reach = (id) => {
    const e = $(id); if (!e || !e.offsetParent) return null;
    const y0 = window.pageYOffset; let r = e.getBoundingClientRect();
    if (r.bottom > window.innerHeight || r.top < 0) { e.scrollIntoView({ block: "nearest" }); r = e.getBoundingClientRect(); }
    const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    window.scrollTo(0, y0);
    return !!h && (h === e || e.contains(h) || (id === "questGo" && $("questCard").contains(h)));
  };
  return { y: window.pageYOffset, ih: window.innerHeight, ox: document.documentElement.scrollWidth - document.documentElement.clientWidth, page: { l: page.left, r: page.right },
    go: box($("questGo")), card: box($("questCard")), title: box($("questTitle")), line: box($("questLine")), words: box(document.querySelector(".quest-body")), arcade: box($("arcadeBtn")), books: box($("homeBooksBtn")), art: box(art), buttons,
    found: box(document.querySelector("#foundRow:not([hidden])")), fresh: box(document.querySelector("#foundRow:not([hidden]) .found-tile.fresh")),
    pics: [box($("arcadePic")), box($("homeBooksPic"))], doorWords: [...document.querySelectorAll("#homeDoors .door-word")].map(box),
    hit: { questCard: reach("questCard"), questGo: reach("questGo"), arcadeBtn: reach("arcadeBtn"), homeBooksBtn: reach("homeBooksBtn") }, after: window.pageYOffset };
});
for (const [w, h] of SIZES) {
  await section("fit at " + w + "x" + h, async () => {
    for (const [label, opts] of STATES) {
      const { ctx, pg, errors } = await open({ ...opts, viewport: { width: w, height: h } });
      await pg.evaluate(() => document.fonts && document.fonts.ready); await pg.waitForTimeout(100);
      const m = await measure(pg), at = w + "x" + h + " " + label + ": ";
      const done = label.startsWith("done");
      const goOk = done ? m.go === null : !!m.go && m.go.w >= 64 && m.go.h >= 64 && m.go.b <= m.ih && m.go.t >= 0 && m.hit.questGo;
      ok(at + "the card's play button is on the first screen" + (done ? " (none when done)" : ", at least 64 px, and a tap there is the card's"), m.y === 0 && m.after === 0 && goOk, { go: m.go, hit: m.hit });
      ok(at + "…and so is its title, with the whole card above the home bar", !!m.title && m.title.t >= 0 && m.title.b <= m.ih && !!m.card && m.card.b <= m.ih && m.hit.questCard, { title: m.title, card: m.card, ih: m.ih });
      ok(at + "the words sit over the picture's foot, all on the picture", !!m.words && !!m.art && m.words.t >= m.art.t - 0.5 && m.words.b <= m.art.b + 0.5 && m.line && m.line.b <= m.art.b, { words: m.words, art: m.art, line: m.line });
      // a tall reel, 3:4, giving way on the shortest screens, never flatter
      // than 4:3; on a phone it spans the page, on an iPad it is a centred
      // card 480 px wide at most
      const ratio = m.art ? m.art.h / m.art.w : 0;
      ok(at + "the picture is the day's reel: 3:4 at its tallest, never flatter than 4:3", ratio <= 4 / 3 + 0.01 && ratio >= 0.75 - 0.01, { art: m.art, ratio });
      const across = w >= 600 ? m.card.w <= 480.5 && Math.abs((m.card.l - m.page.l) - (m.page.r - m.card.r)) < 1.5 : m.card.w >= m.page.r - m.page.l - 1;
      ok(at + (w >= 600 ? "on an iPad the card is centred, 480 px wide at most" : "the card spans the page"), across, { card: m.card, page: m.page });
      ok(at + "the doors come right after the card, side by side, at least 88 px tall, and a tap reaches each", !!m.arcade && !!m.books && m.arcade.t - m.card.b >= 8 && m.arcade.t - m.card.b <= 30 && Math.abs(m.arcade.t - m.books.t) < 1 && m.arcade.r <= m.books.l && m.arcade.h >= 88 && m.books.h >= 88 && m.hit.arcadeBtn && m.hit.homeBooksBtn, { card: m.card, arcade: m.arcade, books: m.books, hit: m.hit });
      ok(at + "every button is at least 44 px, and nothing scrolls sideways", m.ox <= 1 && m.buttons.every((b) => b.w >= 44 && b.h >= 44), { ox: m.ox, small: m.buttons.filter((b) => b.w < 44 || b.h < 44) });
      // FOUND1: the game a story left today waits in "Your games", under
      // the doors (it may fall below the first screen since HOMECLIP1)
      if (done) ok(at + "the game found today (New!) is in \"Your games\", after the doors", !!m.found && !!m.fresh && m.found.t >= m.arcade.b, { found: m.found, fresh: m.fresh, arcade: m.arcade });
      // the Arcade's painting is Echo among the games' things, out at its
      // edges: a square crop kept Echo and dropped every game, so a child who
      // can't read saw two doors of Echo. Each door's picture is a wide band
      // (3:2 on an iPad, 2:1 on a phone), and the two words sit level.
      ok(at + "each door's picture is wide enough to show the games' things (3:2 to 5:2), and the two words sit level", m.pics.every((p) => p && p.w / p.h >= 1.45 && p.w / p.h <= 2.55) && m.doorWords.length === 2 && Math.abs(m.doorWords[0].t - m.doorWords[1].t) < 1, { pics: m.pics, words: m.doorWords });
      ok(at + "no page errors", errors.length === 0, errors);
      await ctx.close();
    }
  });
}

// an iPhone SE on the website (375x553 under Safari's bars) and an iPad on
// its side, the shortest screens Home meets: the reel gives way (4:5 on the
// SE) so its title and play button stay on the first screen, and the day a
// story is finished the doors and the game it left follow below.
await section("fit on the shortest screens", async () => {
  for (const [w, h, label, opts] of [[375, 553, "an iPhone SE in Safari", { sub: true }], [375, 553, "an iPhone SE in Safari, a story finished today", { sub: true, quest: { i: 0, last: 13, s: 1, ls: 0, lk: "story", done: "TODAY", got: [] } }], [1024, 768, "an iPad on its side", { sub: true }], [1133, 744, "an iPad mini on its side", { sub: true }]]) {
    const { ctx, pg, errors } = await open({ ...opts, viewport: { width: w, height: h } });
    await pg.evaluate(() => document.fonts && document.fonts.ready); await pg.waitForTimeout(100);
    const m = await measure(pg), at = w + "x" + h + " (" + label + "): ", done = /finished/.test(label);
    const ratio = m.art.h / m.art.w;
    ok(at + "the card's title" + (done ? "" : " and play button") + " on the first screen, the picture no flatter than 4:3", m.y === 0 && m.title.b <= m.ih && m.card.b <= m.ih && (done ? m.go === null : !!m.go && m.go.b <= m.ih && m.go.h >= 64) && ratio >= 0.75 - 0.01 && ratio < 4 / 3, { title: m.title, go: m.go, card: m.card, ih: m.ih, ratio });
    ok(at + "the doors right after the card" + (done ? ", then the game found today" : ""), m.arcade.t >= m.card.b && m.hit.arcadeBtn && m.hit.homeBooksBtn && (!done || (!!m.fresh && m.fresh.t >= m.arcade.b)), { card: m.card, arcade: m.arcade, fresh: m.fresh });
    ok(at + "no page errors", errors.length === 0, errors);
    await ctx.close();
  }
});

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
// nothing. (Since HOMECLIP1 the fit holds the card's foot on screen, not the
// doors: the same rule, measured on the card.)
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
    return { fit: [...document.getElementById("libraryApp").classList].filter((c) => /^fit\d$/.test(c)).join(","), doors: Math.round(r("homeDoors").bottom), card: Math.round(r("questCard").bottom), go: Math.round(r("questGo").bottom), banner: !!document.getElementById("trialBanner").offsetHeight, room: window.innerHeight - bar, y: window.pageYOffset };
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
    // (the card's foot, its title and play button, above the home bar; the
    // doors come after it, wherever that is, and must not move either)
    const onScreen = (m) => m.y === 0 && m.card <= m.room && m.go <= m.room;
    ok(at + "the fit is the one without Reduce Motion, with the card's title and play button on screen", first.fit === want.fit && first.card === want.card && first.doors === want.doors && onScreen(first) && (label !== "the founding banner" || first.banner), { first, want });
    await pg.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); document.dispatchEvent(new Event("visibilitychange")); });
    await settle(pg);
    const back = await fitOf(pg);
    ok(at + "two quick returns to the front keep the same fit, the card's foot on screen", back.fit === first.fit && back.card === first.card && back.doors === first.doors && onScreen(back), { first, back });
    await pg.locator("#arcadeBtn").click(); await settle(pg);
    await pg.waitForTimeout(550); // past the half second Home ignores taps after a switch
    await pg.locator("#homeBack").click(); await pg.waitForFunction(() => document.getElementById("libraryApp").getAttribute("data-view") === "home"); await settle(pg);
    const trip = await fitOf(pg);
    ok(at + "…and so does the Arcade and ‹ Home", trip.fit === first.fit && trip.card === first.card && trip.doors === first.doors && onScreen(trip), { first, trip });
    ok(at + "no page errors", errors.length === 0, errors);
    await ctx.close();
  }
});

// ── 8. pictures ──
await section("pictures", async () => {
  const fruit = readFileSync(ROOT + "/assets/crafted/home-fruit.webp");
  {
    const { ctx, pg } = await open({ sub: true }, null);
    await ctx.route(/\/assets\/crafted\/home-(?:lighthouse|arcade)\.webp$|\/assets\/home\/reel\/lighthouse\.webp$/, (r) => r.fulfill({ status: 404, body: "" }));
    await home(pg); await pg.waitForTimeout(200);
    const c = await card(pg);
    const wash = await pg.evaluate(() => getComputedStyle(document.getElementById("questArt")).backgroundColor);
    ok("a story whose clip's poster and picture have not landed: Echo's welcome pose on the story's own wash (never a blank, never invented art)", c.fallback && c.img === "/assets/crafted/echo-welcome.webp" && wash === "rgb(43, 47, 94)", { c, wash });
    const door = await pg.evaluate(() => ({ fb: document.getElementById("arcadePic").classList.contains("fallback"), src: document.querySelector("#arcadePic img").getAttribute("src") }));
    ok("…and the Arcade door's picture falls back to Echo cheering", door.fb && door.src === "/assets/crafted/echo-cheer.webp", door);
    await ctx.close();
  }
  {
    const { ctx, pg } = await open({ sub: true }, null);
    await ctx.route(/\/assets\/crafted\/home-(?:lighthouse|arcade)\.webp$/, (r) => r.fulfill({ status: 200, contentType: "image/webp", body: fruit }));
    await ctx.route(/\/assets\/home\/reel\/lighthouse\.webp$/, (r) => r.fulfill({ status: 404, body: "" }));
    await home(pg); await pg.waitForTimeout(200);
    const c = await card(pg);
    const loaded = await pg.evaluate(() => { const i = document.querySelector("#questPic img"); return i.complete && i.naturalWidth > 0; });
    ok("once it lands (and while the clip's poster has not), the story's own picture is shown", !c.fallback && c.img === "/assets/crafted/home-lighthouse.webp" && loaded, c);
    ok("…and the Arcade door's own", await pg.evaluate(() => !document.getElementById("arcadePic").classList.contains("fallback") && document.querySelector("#arcadePic img").getAttribute("src") === "/assets/crafted/home-arcade.webp"));
    await ctx.close();
  }
});

// ── 9. the day's reel (HOMECLIP1, 28 Oct 2026) ──
// Travis: "the daily practice is taking up more of the screen ... like a 3
// second reel essentially of the game that the child will play". The seed's
// phone plays no H.264, so above the clip never starts. Here a phone that
// does is stood in: canPlayType says yes to an MP4, each play() is counted
// (with the address it plays and whether it is muted) and says "playing",
// each pause() is counted, and the clip's own request is held, as a phone
// still loading it would hold it. What it plays is read from the page's own
// Sona.questToday(), the day's game.
const PLAYS = () => {
  window.__clip = { play: [], pause: 0 };
  HTMLMediaElement.prototype.canPlayType = function (t) { return /mp4/.test(t) ? "probably" : ""; };
  HTMLMediaElement.prototype.play = function () { const el = this; window.__clip.play.push({ src: el.getAttribute("src"), muted: el.muted }); Promise.resolve().then(() => el.dispatchEvent(new Event("playing"))); return Promise.resolve(); };
  HTMLMediaElement.prototype.pause = function () { window.__clip.pause++; };
};
const REFUSES = () => {
  window.__clip = { play: [], pause: 0 };
  HTMLMediaElement.prototype.canPlayType = function (t) { return /mp4/.test(t) ? "probably" : ""; };
  HTMLMediaElement.prototype.play = function () { window.__clip.play.push({ src: this.getAttribute("src"), muted: this.muted }); return Promise.reject(new DOMException("Low Power Mode", "NotAllowedError")); };
  HTMLMediaElement.prototype.pause = function () { window.__clip.pause++; };
};
const posterBytes = readFileSync(ROOT + "/assets/crafted/home-fruit.webp");
async function phone(opts = {}, page = "/today.html", { init = PLAYS, clip = () => {}, poster = null, before = null } = {}) {
  const { ctx, pg, errors } = await open(opts, null);
  await ctx.addInitScript(init);
  // (the last route added is asked first)
  await ctx.route(/\/assets\/home\/reel\/\w+\.mp4$/, clip);
  if (poster) await ctx.route(/\/assets\/home\/reel\/\w+\.webp$/, poster);
  if (before) await before(ctx, pg);
  if (page) await home(pg, page);
  return { ctx, pg, errors };
}
const landed = (r) => r.fulfill({ status: 200, contentType: "image/webp", body: posterBytes });
const missing = (r) => r.fulfill({ status: 404, body: "" });
const reel = (pg) => pg.evaluate(() => {
  const v = document.getElementById("questClip"), q = Sona.questToday(), im = document.querySelector("#questPic img");
  return { kind: q.kind, state: q.state, game: q.game, next: q.next ? q.next.game : null, hidden: v.hidden, src: v.getAttribute("src"), poster: v.getAttribute("poster"), on: v.classList.contains("on"),
    opacity: getComputedStyle(v).opacity, events: getComputedStyle(v).pointerEvents, muted: v.muted, loop: v.loop, autoplay: v.autoplay, inline: v.playsInline, preload: v.preload, aria: v.getAttribute("aria-hidden"),
    img: im ? new URL(im.getAttribute("src"), location.href).pathname : null, played: window.__clip.play.slice(), paused: window.__clip.pause, view: document.getElementById("libraryApp").getAttribute("data-view") };
});
const getComputedStyle0 = (pg) => pg.evaluate(() => getComputedStyle(document.getElementById("questClip")).pointerEvents);
const hide = (pg, hidden) => pg.evaluate((h) => { Object.defineProperty(document, "hidden", { configurable: true, get: () => h }); document.dispatchEvent(new Event("visibilitychange")); }, hidden);
await section("the day's reel", async () => {
  {
    const { ctx, pg, errors } = await phone({ sub: true }, "/today.html", { poster: landed });
    await pg.waitForTimeout(450);
    const r = await reel(pg);
    ok("a story day: the clip is the story's game, /assets/home/reel/<game>.mp4, with its poster", r.kind === "story" && !!r.game && r.src === REEL + r.game + ".mp4" && r.poster === REEL + r.game + ".webp" && !r.hidden, r);
    ok("…muted, looping, inline, autoplaying, only its first frames asked for, and hidden from a screen reader", r.muted && r.loop && r.autoplay && r.inline && r.preload === "metadata" && r.aria === "true", r);
    ok("…it plays, muted, and is seen once it is really playing", r.played.length === 1 && r.played[0].src === r.src && r.played[0].muted && r.on && r.opacity === "1", r);
    ok("…over its poster (the clip's first frame), which shows until it plays", r.img === REEL + r.game + ".webp", r.img);
    const tap = await pg.evaluate(() => { const c = document.getElementById("questCard"), b = c.getBoundingClientRect(), h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height * 0.3); return { inCard: c.contains(h), isClip: h && h.id === "questClip" }; });
    ok("…and a tap on the moving picture is the card's: the clip takes no tap", tap.inCard && !tap.isClip && (await getComputedStyle0(pg)) === "none", tap);
    // hidden: it holds still; back in front it plays again, the same clip
    await hide(pg, true);
    let h = await reel(pg);
    ok("the page hidden (another app, a locked phone): the clip is paused", h.paused >= 1 && h.played.length === 1, h);
    await hide(pg, false); await pg.waitForTimeout(100);
    let v = await reel(pg);
    ok("…and back in front it plays again, the same clip, never loaded afresh", v.played.length === 2 && v.played[1].src === r.src && v.src === r.src && v.on, v);
    // the Arcade: it holds still; ‹ Home plays it again
    const p0 = v.paused;
    await pg.locator("#arcadeBtn").click(); await pg.waitForTimeout(100);
    h = await reel(pg);
    ok("the Arcade: the clip holds still behind it", h.view === "arcade" && h.paused > p0 && h.played.length === 2, h);
    await pg.waitForTimeout(550); // past the half second Home ignores taps after a switch
    await pg.locator("#homeBack").click(); await pg.waitForTimeout(150);
    v = await reel(pg);
    ok("…and back on Home it plays again", v.view === "home" && v.played.length === 3 && v.src === r.src, v);
    await pg.waitForTimeout(450); // past the half second Home ignores taps after a switch
    ok("…and a tap on the card still opens the story", await tapTo(pg, "#questCard", /\/adventure\.html$/), pg.url());
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // Home is still silent and writes nothing with the clip playing
    const { ctx, pg, errors } = await phone({ sub: true }, null, { poster: landed });
    await pg.goto(origin + "/__sona"); await pg.waitForFunction(() => window.Sona && Sona.questToday);
    const before = await store(pg);
    asked.length = 0;
    await home(pg); await pg.waitForTimeout(200);
    await hide(pg, true); await hide(pg, false); await pg.waitForTimeout(150);
    await pg.locator("#arcadeBtn").click(); await pg.waitForTimeout(600);
    await pg.locator("#homeBack").click(); await pg.waitForTimeout(200);
    const r = await reel(pg);
    ok("with the clip playing, Home writes nothing, sends nothing and says nothing", r.played.length >= 1 && (await store(pg)) === before && asked.filter((x) => x.from === "/today.html").length === 0 && (await speech(pg)).length === 0, { played: r.played.length, asked: asked.filter((x) => x.from === "/today.html") });
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // opened straight into the Arcade: the clip never starts behind it
    const { ctx, pg, errors } = await phone({ sub: true }, "/today.html?view=arcade", { poster: landed });
    await pg.waitForTimeout(200);
    const r = await reel(pg);
    ok("opened in the Arcade: the clip is never started behind it (and its autoplay is held off)", r.view === "arcade" && r.played.length === 0 && r.paused >= 1, r);
    await pg.locator("#homeBack").click(); await pg.waitForTimeout(150);
    const v = await reel(pg);
    ok("…until Home shows, then it plays", v.view === "home" && v.played.length === 1 && v.src === REEL + v.game + ".mp4", v);
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // a game day: today's game's clip
    const { ctx, pg, errors } = await phone({ sub: true, quest: { i: 3, last: 2, s: 14, ls: 13, lk: "story", done: "2026-01-01" } }, "/today.html", { poster: landed });
    await pg.waitForTimeout(150);
    const r = await reel(pg);
    ok("a game day: the clip is that game's (/assets/home/reel/<game>.mp4), playing", r.kind === "game" && r.state === "open" && r.src === REEL + r.game + ".mp4" && r.played.length === 1 && r.on, r);
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // a finished day: tomorrow's poster, dark, and no clip at all
    const { ctx, pg, errors } = await phone({ sub: true, quest: { i: 0, last: 13, s: 1, ls: 0, lk: "story", done: "TODAY", got: [] } }, "/today.html", { poster: landed });
    await pg.waitForTimeout(200);
    const r = await reel(pg), c = await card(pg);
    ok("a finished day: tomorrow's poster, dark", r.state === "done" && !!r.next && r.img === REEL + r.next + ".webp" && /brightness\(0\.15\)/.test(c.dark), { r, dark: c.dark });
    ok("…and nothing plays: no clip loaded, none started (tomorrow is never early)", r.hidden && !r.src && !r.poster && r.played.length === 0, r);
    await hide(pg, true); await hide(pg, false); await pg.waitForTimeout(100);
    const v = await reel(pg);
    ok("…not even after coming back to the front", v.hidden && !v.src && v.played.length === 0, v);
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // Reduce Motion: the poster, still; and switched on while Home is open,
    // the clip stops and goes
    const { ctx, pg, errors } = await phone({ sub: true, reduce: true }, "/today.html", { poster: landed });
    await pg.waitForTimeout(150);
    let r = await reel(pg);
    ok("under Reduce Motion no clip plays: the poster, still", r.hidden && !r.src && r.played.length === 0 && r.img === REEL + r.game + ".webp", r);
    await pg.emulateMedia({ reducedMotion: "no-preference" }); await pg.waitForTimeout(150);
    r = await reel(pg);
    ok("…Reduce Motion turned off while Home is open: the clip starts", !r.hidden && r.src === REEL + r.game + ".mp4" && r.played.length === 1, r);
    await pg.emulateMedia({ reducedMotion: "reduce" }); await pg.waitForTimeout(150);
    r = await reel(pg);
    ok("…and turned on again: it stops and goes, the poster stays", r.hidden && !r.src && !r.on && r.paused >= 1 && r.img === REEL + r.game + ".webp", r);
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // the data saver: the poster only, nothing downloaded
    const { ctx, pg, errors } = await phone({ sub: true }, "/today.html", { poster: landed, before: (c) => c.addInitScript(() => { Object.defineProperty(Navigator.prototype, "connection", { configurable: true, get: () => ({ saveData: true }) }); }) });
    await pg.waitForTimeout(150);
    const r = await reel(pg);
    ok("with the data saver on: the poster only, no clip asked for", r.hidden && !r.src && r.played.length === 0 && r.img === REEL + r.game + ".webp", r);
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
});

await section("the day's reel when something is missing", async () => {
  {
    // a clip that is missing (404): it goes, the poster stays
    const { ctx, pg, errors } = await phone({ sub: true }, "/today.html", { clip: missing, poster: landed });
    await pg.waitForFunction(() => document.getElementById("questClip").hidden, null, { timeout: 4000 }).catch(() => {});
    const r = await reel(pg);
    ok("a clip that is missing: it goes (hidden, nothing loading), and the poster stays", r.hidden && !r.src && !r.on && r.img === REEL + r.game + ".webp", r);
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // a phone that refuses to start it (Low Power Mode): never a black or
    // broken frame, the poster as it is, and no error
    const { ctx, pg, errors } = await phone({ sub: true }, "/today.html", { init: REFUSES, poster: landed });
    await pg.waitForTimeout(450);
    const r = await reel(pg);
    ok("a phone that refuses to start the clip (Low Power Mode): the clip is never seen, the poster shows", r.played.length === 1 && !r.on && r.opacity === "0" && r.img === REEL + r.game + ".webp", r);
    ok("…and nothing on the page goes wrong", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // the poster has not landed: the card's picture from before (the story's
    // painted Home picture), under a clip that plays as before
    const { ctx, pg, errors } = await phone({ sub: true }, "/today.html", { poster: missing });
    await pg.waitForTimeout(450);
    const r = await reel(pg), q = await pg.evaluate(() => Sona.questToday());
    ok("a poster that has not landed: the story's own painted picture under the clip", r.img === q.story.pic && !r.hidden && r.on, { r, pic: q.story.pic });
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // a game day whose poster has not landed: the game's Home card
    const { ctx, pg, errors } = await phone({ sub: true, quest: { i: 3, last: 2, s: 14, ls: 13, lk: "story", done: "2026-01-01" } }, "/today.html", { poster: missing });
    await pg.waitForTimeout(300);
    const r = await reel(pg), card0 = await pg.evaluate((k) => (Sona.CRAFTED_CARDS || {})[k], (await reel(pg)).game);
    ok("a game day whose poster has not landed: that game's Home card", r.kind === "game" && !!card0 && r.img === "/assets/crafted/home-" + card0 + ".webp", { r, card0 });
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
  {
    // a finished day whose tomorrow has no poster yet: tomorrow's painted
    // picture, dark, as before
    const { ctx, pg, errors } = await phone({ sub: true, quest: { i: 0, last: 13, s: 1, ls: 0, lk: "story", done: "TODAY", got: [] } }, "/today.html", { poster: missing });
    await pg.waitForTimeout(300);
    const r = await reel(pg), q = await pg.evaluate(() => Sona.questToday()), c = await card(pg);
    ok("a finished day whose tomorrow has no poster yet: tomorrow's painted picture, dark, and no clip", q.next && q.next.story && r.img === q.next.story.pic && /brightness\(0\.15\)/.test(c.dark) && r.hidden && r.played.length === 0, { r, next: q.next });
    ok("no page errors", errors.length === 0, errors);
    await ctx.close();
  }
});

await browser.close(); server.close();
console.log(fails ? fails + " FAILURES / " + count + " checks" : "ALL GREEN — " + count + " checks");
process.exit(fails ? 1 : 0);
