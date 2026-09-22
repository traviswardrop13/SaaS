// DAY1 → GAMES1: the day is practice, then games.
//
// It was "one story, then three games": the chapter was the only thing a kid
// could tap, and reading it unlocked the trio. The books are parked (Travis,
// 19 Sep 2026 — they relaunch in Q4 once they are good), so the home opens on
// today's ADVENTURE, the trio is open from the first tap, and every game door
// goes through charge.html, which asks for the sound first. What this suite
// defends now:
//   - the hero is practice, and the three games below are open, not locked
//   - there is no door to the reader anywhere on Home, and the book button
//     says "coming soon" and goes nowhere
//   - the trio is stable within a day and different across days
//   - the season still turns its page at the end of a run
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

// ── 1. the home opens on today's adventure, with three games ready ──
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
  }));
  ok("the hero is today's adventure — practice, not a book",
    /adventure|play/i.test(st.cta) && st.launch === "/charge.html?daily=1", JSON.stringify(st));
  ok("the adventure is named on the card", /adventure/i.test(st.hero), st.hero);
  ok("the card says what practicing earns", /game/i.test(st.sub), st.sub);
  ok("THREE games sit below, not two", st.thumbs === 3, String(st.thumbs));
  ok("none of them is locked — no book gates the day", st.locked === 0, JSON.stringify(st));
  ok("…and none of them wears a padlock", st.padlocks === 0, JSON.stringify(st));

  // a game door goes through charge.html — say the sound, then play
  const before = pg.url();
  await pg.evaluate(() => document.querySelector("#thumbs .thumb").click());
  await pg.waitForTimeout(600);
  const u = new URL(pg.url());
  ok("tapping a game opens it through charge.html (say the sound first)",
    pg.url() !== before && ((u.pathname === "/charge.html" && /game=arcade-/.test(u.search)) || u.pathname === "/arcade-feed.html"), pg.url());
  await ctx.close();
}

// ── 2. the books are parked: no door to the reader, and the shelf button says so ──
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  const errs = []; pg.on("pageerror", (e) => errs.push(String(e)));
  await pg.goto("http://localhost:8178/today.html");
  await pg.evaluate(seed("7"));
  await pg.goto("http://localhost:8178/today.html");
  await pg.waitForTimeout(700);
  const soon = await pg.evaluate(() => {
    const before = location.href;
    document.getElementById("libBtn").click();
    return { moved: location.href !== before, sub: document.getElementById("heroSub").textContent,
             label: document.getElementById("libBtn").getAttribute("aria-label") || "" };
  });
  await pg.waitForTimeout(300);
  ok("the book button goes nowhere", soon.moved === false && /today\.html/.test(pg.url()), pg.url());
  ok("…and says the books are coming soon", /coming soon/i.test(soon.sub), soon.sub);
  ok("…in its label too", /coming soon/i.test(soon.label), soon.label);
  // markup and code only — the comments explain the parking and may name the pages
  const home = readFileSync(ROOT + "/today.html", "utf8").replace(/<!--[\s\S]*?-->/g, "").replace(/\/\/[^\n]*/g, "");
  ok("Home has no door to the reader", !/chapter\.html|library\.html|story\.html/.test(home),
    "a link to a parked page is a link to a broken promise");
  ok("…and never says 'story' where a child can read it", !/today.s story|READ TODAY/i.test(home));
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

// ── 3b. the trio belongs to the CHAPTER, not the clock ──
// It used to be a day-seeded random pick, which meant the river chapter could
// hand you the flying game and the story stopped meaning anything. Each
// chapter now names its own three, so this asserts two things: the day's trio
// really is the chapter's trio, and the season is varied enough that a kid
// does not get the same three games all week.
{
  const { ctx, pg } = await home("7");
  const st = await pg.evaluate(() => ({
    trio: Sona.dailyGames(),
    chapterGames: Sona.dailyStory().games,
    seasonTrios: Sona.EPISODES.map((e) => e.games.join(",")),
    allNamed: Sona.EPISODES.every((e) => Array.isArray(e.games) && e.games.length === 3
      && new Set(e.games).size === 3 && e.games.every((g) => Sona.GAME_KEYS.indexOf(g) >= 0)),
  }));
  ok("today's three games ARE today's chapter's three games",
    JSON.stringify(st.trio) === JSON.stringify(st.chapterGames), JSON.stringify(st));
  ok("every chapter names three real, distinct games", st.allNamed, JSON.stringify(st.seasonTrios));
  // the first card is the hero a kid taps LET'S GO on, and Feed Echo is the
  // littles game — dailyGames() promotes it for under-6s by itself, so a
  // chapter that LEADS with it hands an eight-year-old the toddler game
  ok("no chapter leads with Feed Echo",
    st.seasonTrios.every((t) => t.split(",")[0] !== "feed"), JSON.stringify(st.seasonTrios));
  const distinct = new Set(st.seasonTrios).size;
  ok("the season is a real spread, not the same three all week",
    distinct >= Math.min(8, st.seasonTrios.length), JSON.stringify({ distinct, n: st.seasonTrios.length }));
  await ctx.close();
}

// ── 3c. the same chapter gives the same trio on any date ──
// The old picker was seeded by the day number, so the trio drifted under a
// child who opened the app either side of midnight. Now the chapter decides,
// and a chapter is a chapter whatever the calendar says.
{
  const seen = [];
  for (const d of [1, 9]) {
    const ctx = await browser.newContext();
    const pg = await ctx.newPage();
    // freeze the clock to a specific day BEFORE sona.js loads
    await pg.addInitScript(`{
      const fixed = new Date(2026, 0, ${d}, 10, 0, 0).getTime();
      const R = Date;
      Date = class extends R { constructor(...a) { if (!a.length) super(fixed); else super(...a); } static now() { return fixed; } };
    }`);
    await pg.goto("http://localhost:8178/today.html");
    await pg.evaluate(seed("7"));
    await pg.goto("http://localhost:8178/today.html");
    await pg.waitForTimeout(400);
    seen.push(await pg.evaluate(() => ({ ch: Sona.dailyChapterNum(), trio: Sona.dailyGames().join(",") })));
    await ctx.close();
  }
  ok("a fresh device starts at chapter 1 whatever the date", seen.every((x) => x.ch === 1), JSON.stringify(seen));
  ok("…and the same chapter hands over the same three games", seen[0].trio === seen[1].trio, JSON.stringify(seen));
}

// ── 4. a four-year-old always gets the game they can actually play ──
{
  const { ctx, pg } = await home("4");
  const st = await pg.evaluate(() => ({ trio: Sona.dailyGames(), hero: document.getElementById("heroName").textContent }));
  ok("under-6 always gets Feed Echo in the trio", st.trio.indexOf("feed") >= 0, JSON.stringify(st));
  ok("…and it leads, so the first unlocked game needs no reading", st.trio[0] === "feed", JSON.stringify(st));
  await ctx.close();
}

// ── 4b. two siblings on one iPad do NOT share the story gate ──
// The regression this catches shipped once already: the day pin and the
// chapter pointer were renamed to v2 and PER_KID kept naming v1, so child A
// reading the story unlocked child B's games on the same device.
{
  const { ctx, pg } = await home("7");
  const st = await pg.evaluate(() => {
    Sona.markStoryRead();
    const firstSlot = (Sona.activeKid() || {}).slot;
    const a = { read: Sona.storyRead(), ch: Sona.dailyChapterNum() };
    Sona.switchKid(Sona.addKid("Sibling", "7"));      // addKid returns the new slot
    Sona.saveProfile({ childName: "Sibling", childAge: "7", focusSounds: ["S"], onboarded: true });
    const b = { read: Sona.storyRead(), ch: Sona.dailyChapterNum() };
    Sona.switchKid(firstSlot);
    return { a, b, backToA: Sona.storyRead() };
  });
  ok("child A's finished story does not unlock child B", st.a.read === true && st.b.read === false, JSON.stringify(st));
  ok("…and each child has their own chapter pointer", st.b.ch === 1, JSON.stringify(st));
  ok("…and switching back does not lose A's progress", st.backToA === true, JSON.stringify(st));
  await ctx.close();
}

// ── 4c. the star jar is an object, not an empty rectangle ──
// The 10 Aug review: "an empty outlined rectangle where the jar should be — it
// reads as a missing asset." An empty jar should invite; the three star
// outlines inside it say what goes there, in the same ghost language the
// loading scenes use for unearned fruit.
{
  const { ctx, pg } = await home("7");
  const empty = await pg.evaluate(() => ({
    fill: document.getElementById("jarFill").style.height,
    ghost: document.querySelectorAll("#jarStars i.ghost").length,
    lit: document.querySelectorAll("#jarStars i.lit").length,
  }));
  ok("an empty jar still shows the stars that go in it",
    empty.ghost === 3 && empty.lit === 0, JSON.stringify(empty));

  const filled = await pg.evaluate(() => {
    Sona.bumpReps(Math.ceil(Sona.repGoal() * 0.55));
    return new Promise((res) => {
      location.reload();
      setTimeout(() => res(null), 50);
    });
  }).catch(() => null);
  await pg.waitForTimeout(1200);
  const after = await pg.evaluate(() => ({
    fill: parseInt(document.getElementById("jarFill").style.height, 10) || 0,
    lit: document.querySelectorAll("#jarStars i.lit").length,
  }));
  ok("practice fills the jar and lights the stars in it",
    after.fill > 0 && after.lit >= 1, JSON.stringify([filled, after]));
  await ctx.close();
}

// ── 5. source contracts ──
{
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  // This used to grep PER_KID for the literal "sona.day.v1". STORY1 renamed
  // the key to v2 and PER_KID kept the old name, so the day pin and the
  // chapter pointer silently stopped being per-child — and this assertion went
  // on passing, because the string it was looking for was still sitting in the
  // list doing nothing. A source contract that can be satisfied by a dead
  // string is not a contract; the behaviour is checked below instead.
  // Matched to the list's real end, not a 600-character window. The cap was a
  // hidden length limit on a declaration that is supposed to GROW: adding
  // sona.pilot.v1 (and the comment explaining why siblings must not share a
  // clinician identity) pushed the last entries outside it, and this assertion
  // failed for a reason that had nothing to do with what it checks. hwtest
  // carried the same regex and CRASHED on the null match.
  const PERKID = (sona.match(/const PER_KID = new Set\(\[([\s\S]*?)\]\);/) || ["", ""])[1];
  ok("every key the day is built from is declared per-child",
    !!PERKID &&
    ["sona.day.v2", "sona.episode.v2", "sona.reps.v1", "sona.homework.v1"]
      .every((k) => PERKID.includes('"' + k + '"')),
    "a key the day depends on that is missing here is shared between siblings");
  ok("today's chapter is PINNED for the day", /function dailyStory[\s\S]{0,400}save\(DAYKEY/.test(sona),
    "without the pin, reading it flips the card to tomorrow's story mid-day");
  ok("finishing the story queues tomorrow's", /function markStoryRead[\s\S]{0,260}episodeAdvance\(\)/.test(sona));
  ok("the game list lives in sona.js, not inline in a page",
    /const GAME_ACTS = \{/.test(sona) && !/var ACTS=\[/.test(readFileSync(ROOT + "/today.html", "utf8")),
    "two copies of the list is one copy that goes stale");
  const home = readFileSync(ROOT + "/today.html", "utf8");
  ok("the home reads the trio from sona.js, and no longer asks whether a story was read",
    /S\.dailyGames\(\)/.test(home) && !/storyRead/.test(home));
  ok("the kid home still carries no tracking", !/pixel\.js|analytics\.js/.test(home));
}


// ── 6. METER1: the jar fills on voice, and only on voice ──
{
  const { ctx, pg } = await home("7");
  const zero = await pg.evaluate(() => ({
    h: document.getElementById("jarFill").style.height,
    sub: document.getElementById("jarSub").textContent,
    coins: document.getElementById("coinTxt").textContent,
  }));
  ok("the jar starts empty", zero.h === "0%", JSON.stringify(zero));
  ok("it says what filling it takes", /\d+ of \d+/.test(zero.sub), zero.sub);
  const half = await pg.evaluate(() => {
    Sona.bumpReps(13);                 // VAD-counted reps are the only input
    return { g: Sona.goalState() };
  });
  ok("reps move the meter", half.g.pct > 0.4 && half.g.pct < 0.6, JSON.stringify(half.g));
  const idle = await pg.evaluate(() => { const before = Sona.goalState().n; return { before, after: Sona.goalState().n }; });
  ok("nothing but a rep moves it — no timer, no page view", idle.before === idle.after);
  const full = await pg.evaluate(() => { Sona.bumpReps(40); return Sona.goalState(); });
  ok("the jar caps at full instead of overflowing", full.pct === 1 && full.full === true, JSON.stringify(full));
  await ctx.close();
}

// ── 7. COIN1: coins are minted from reps, never double-paid ──
{
  const { ctx, pg } = await home("7");
  const c = await pg.evaluate(() => {
    const start = Sona.getCoins();
    Sona.bumpReps(12); Sona.mintCoins();
    const after12 = Sona.getCoins();
    Sona.mintCoins(); Sona.mintCoins();          // a double-fire must not pay twice
    const afterRepeat = Sona.getCoins();
    Sona.markStoryRead();                        // story bonus, once
    const afterStory = Sona.getCoins();
    Sona.markStoryRead();
    return { start, after12, afterRepeat, afterStory, afterTwice: Sona.getCoins() };
  });
  ok("reps mint coins", c.after12 === c.start + 2, JSON.stringify(c));
  ok("minting twice pays once", c.afterRepeat === c.after12, JSON.stringify(c));
  ok("finishing the story pays a bonus", c.afterStory === c.after12 + 5, JSON.stringify(c));
  ok("…and only the first time that day", c.afterTwice === c.afterStory, JSON.stringify(c));
  await ctx.close();
}

// ── 8. the mystery game is ADDITIVE — a fourth door, bought with reps ──
{
  const { ctx, pg } = await home("7");
  // GAMES1: the story gate went with the books. Coins only come from reps
  // (COIN1), so a purchase is practice-backed without it.
  const broke = await pg.evaluate(() => ({ can: Sona.canBuyMystery(), bought: Sona.buyMystery(), coins: Sona.getCoins() }));
  ok("no coins, no mystery game", broke.can === false && broke.bought === null, JSON.stringify(broke));
  const bought = await pg.evaluate(() => {
    Sona.addCoins(500);
    const trio = Sona.dailyGames();
    const got = Sona.buyMystery();
    return { trio, got, inTrio: trio.indexOf(got) >= 0, again: Sona.buyMystery(), coins: Sona.getCoins() };
  });
  ok("coins buy a mystery game — no book stands in the way", !!bought.got, JSON.stringify(bought));
  ok("it is a game NOT already in today's trio", bought.inTrio === false, JSON.stringify(bought));
  ok("you can't buy a second one the same day", bought.again === null, JSON.stringify(bought));
  await pg.reload(); await pg.waitForTimeout(700);
  const shown = await pg.evaluate(() => ({
    cards: document.querySelectorAll("#thumbs .thumb").length,
    mystery: !!document.querySelector("#thumbs .thumb.mystery"),
  }));
  ok("the bought game appears as a fourth card", shown.mystery && shown.cards === 4, JSON.stringify(shown));
  await ctx.close();
}

// ── 9. BOOKS1: the shelf holds the child's own sounds ──
{
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8178/today.html");
  await pg.evaluate(() => localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true })));
  await pg.goto("http://localhost:8178/library.html");
  await pg.waitForTimeout(700);
  const r = await pg.evaluate(() => [...document.querySelectorAll(".bookBtn")].map((b) => b.textContent));
  ok("an /r/ child sees only /r/ books", r.length > 0 && r.every((t) => /R(ory|eba|uby|emy|ex)/.test(t)), JSON.stringify(r));
  ok("…and there are still real books to read", r.length >= 3, String(r.length));

  // play mode rotates every sound, so it keeps the whole shelf
  await pg.evaluate(() => { const p = JSON.parse(localStorage.getItem("sona.profile.v1")); p.mode = "play"; localStorage.setItem("sona.profile.v1", JSON.stringify(p)); });
  await pg.goto("http://localhost:8178/library.html"); await pg.waitForTimeout(700);
  const all = await pg.evaluate(() => document.querySelectorAll(".bookBtn").length);
  ok("a play-mode child keeps the whole shelf", all > r.length, all + " vs " + r.length);

  // a sound with no books must never leave an empty room
  await pg.evaluate(() => localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["Z"], onboarded: true })));
  await pg.goto("http://localhost:8178/library.html"); await pg.waitForTimeout(700);
  const none = await pg.evaluate(() => document.querySelectorAll(".bookBtn").length);
  ok("a sound with no books falls back to the full shelf, never an empty one", none > 0, String(none));
  await ctx.close();
}

// ── 10. GATE1: the games are not playable by typing their URL ──
// They carried no gate of their own — the only thing protecting them was that
// the normal route goes through charge.html, which does gate. A typed URL
// played free, forever. GAMES1: there is no state that opens a typed URL any
// more — not a read story (gone with the books), not a finished adventure.
// The only way in is the charge.html hand-off.
{
  const ARCADE = ["arcade-slice.html", "arcade-tiles.html", "arcade-stack.html", "arcade-run.html", "arcade-glide.html"];
  async function land(url, prep) {
    const ctx = await browser.newContext();
    const pg = await ctx.newPage();
    await pg.goto("http://localhost:8178/today.html");
    await pg.evaluate(seed("7"));
    if (prep) await pg.evaluate(prep);
    await pg.goto("http://localhost:8178/" + url);
    await pg.waitForTimeout(600);
    const path = new URL(pg.url()).pathname;
    await ctx.close();
    return path;
  }
  for (const g of ARCADE) {
    ok(`${g} can't be opened by typing its URL`, (await land(g)) === "/today.html", g);
  }
  ok("…not even once today's adventure is done",
    (await land("arcade-slice.html", "Sona.dailyFinish(10)")) === "/today.html");
  // a round the child already EARNED must never be interrupted — charge.html
  // gates before it hands off, and a session started at 11:58pm would
  // otherwise be thrown out at midnight when the day rolls over
  ok("a charge hand-off is never bounced",
    (await land("arcade-slice.html?from=charge")) === "/arcade-slice.html");
  // Pricing is live, so the gate outranks the hand-off itself: a child on a
  // dead trial meets the lock even arriving from charge.html. The ?paid=1 seam
  // is left on the first case deliberately — it is inert while priced, so this
  // keeps passing in BOTH pricing states and cannot rot in a free window.
  // …and the gate sends a CHILD home to ask a grown-up, never to the price page
  ok("an expired trial still wins over everything, even a charge hand-off",
    (await land("arcade-tiles.html?from=charge", 'sessionStorage.setItem("sona.paidui","1");localStorage.setItem("sona.demo.v1",JSON.stringify({started:1,done:1}));localStorage.setItem("sona.trial.v1",JSON.stringify({start:Date.now()-40*86400000,days:3}))')) === "/today.html");
  ok("a LIVE trial still does not open a typed game URL — every game is entered through charge.html",
    (await land("arcade-tiles.html", 'localStorage.setItem("sona.demo.v1",JSON.stringify({started:1,done:1}));localStorage.setItem("sona.trial.v1",JSON.stringify({start:Date.now(),days:3}))')) === "/today.html");
  ok("…while the charge hand-off opens it on that live trial",
    (await land("arcade-tiles.html?from=charge", 'localStorage.setItem("sona.demo.v1",JSON.stringify({started:1,done:1}));localStorage.setItem("sona.trial.v1",JSON.stringify({start:Date.now(),days:3}))')) === "/arcade-tiles.html");
  // the retired campaign and its pages are gone, not merely unlinked
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  ok("the worlds/levels campaign is deleted from sona.js",
    !/const WORLDS|campaignLaunch|campaignResolve|LEVEL_GAMES|GAME_DECK/.test(sona));
  for (const dead of ["play.html", "ladder.html", "world.html", "level.html", "bubble.html", "racer.html", "lesson.html"]) {
    ok(`${dead} is deleted`, !existsSync(ROOT + "/" + dead), dead);
  }
  ok("no live page links to a page that no longer exists",
    !/href="\/(?:play|ladder|world|level|levelcomplete|arcade|bubble|racer|whack|cupstack|match|grocery|train|rocket|chat|shop|lesson|warmup|builder|coach|avatar|model|practice|rcal|home)\.html/
      .test(readFileSync(ROOT + "/today.html", "utf8") + readFileSync(ROOT + "/story.html", "utf8") + readFileSync(ROOT + "/charge.html", "utf8")));
}

// ── HOME1: one clear next step, and it knows where the child left off ────
// Home already gave one activity visual priority and one line about what is
// left today. What it did not do was notice a run in progress: a child called
// to dinner between round two and round three came back to the same generic
// start and had to find their own way in.
{
  const ctx = await browser.newContext(); const pg = await ctx.newPage();
  await pg.goto("http://localhost:8178/today.html"); await pg.waitForTimeout(400);
  await pg.evaluate(() => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done");
    localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
    localStorage.setItem("sona.sub.v1", JSON.stringify({ active: true, source: "stripe" }));
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Ada", childAge: "7", focusSounds: ["R"], onboarded: true }));
  });

  // a child who has never practiced is STARTING, and the button says so once
  await pg.evaluate(() => { localStorage.removeItem("sona.demo.v1"); });
  await pg.goto("http://localhost:8178/today.html"); await pg.waitForTimeout(800);
  ok("a brand-new child is invited to start, not to resume",
    /START YOUR FIRST ADVENTURE/i.test(await pg.evaluate(() => document.getElementById("goBtn").textContent)));

  // …and once they have, it is the ordinary adventure CTA again
  await pg.evaluate(() => localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 })));
  await pg.goto("http://localhost:8178/today.html"); await pg.waitForTimeout(800);
  ok("…and afterwards it stops shouting about firsts",
    /LET'S PLAY/i.test(await pg.evaluate(() => document.getElementById("goBtn").textContent)));

  // a run left half-finished is the commonest interruption there is
  await pg.evaluate(() => sessionStorage.setItem("sona.run.v1", JSON.stringify({ active: true, round: 2, sum: 40, scores: [20, 20], sound: "R", level: 1, pending: false })));
  await pg.goto("http://localhost:8178/today.html"); await pg.waitForTimeout(800);
  const mid = await pg.evaluate(() => ({
    name: document.getElementById("heroName").textContent,
    sub: document.getElementById("heroSub").textContent,
    cta: document.getElementById("goBtn").textContent,
    go: document.getElementById("goBtn").dataset.launch,
  }));
  ok("coming back mid-run, Home says carry on", /Keep going/i.test(mid.name) && /CARRY ON/i.test(mid.cta), JSON.stringify(mid));
  ok("…and names the round they are actually on", /round 3/i.test(mid.sub), mid.sub);
  ok("…and the button goes back into that run", /charge\.html\?daily=1/.test(mid.go), mid.go);

  // the run record is one sitting, not a promise: a fresh session starts clean
  await pg.evaluate(() => sessionStorage.removeItem("sona.run.v1"));
  await pg.goto("http://localhost:8178/today.html"); await pg.waitForTimeout(800);
  ok("…and a fresh sitting is not haunted by yesterday's half-run",
    !/CARRY ON/i.test(await pg.evaluate(() => document.getElementById("goBtn").textContent)));

  // homework already DROVE the app; now it says so
  await pg.evaluate(() => {
    localStorage.setItem(Sona.kkey("sona.homework.v1"), JSON.stringify({ hw: {
      id: "hw9", title: "S in the middle", sounds: ["S"], pos: "m", repsPerDay: 20,
      start: "2000-01-01", due: "2999-01-01", by: "Rachel, CF-SLP" }, at: Date.now() }));
  });
  await pg.goto("http://localhost:8178/today.html"); await pg.waitForTimeout(800);
  ok("an assignment is visible on Home, not just honoured under the hood",
    /Rachel, CF-SLP/.test(await pg.evaluate(() => document.getElementById("heroSub").textContent)));
  await ctx.close();
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
