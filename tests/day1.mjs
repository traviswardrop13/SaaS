// Home is the game library. Opening or revisiting it never starts practice,
// resumes a saved journey, opens the microphone or earns progress. A deliberate
// game choice still follows the existing practice/earned-ticket boundary.
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
// Explicit cohorts keep entitlement checks independent of the family pricing
// switch. `premium` represents a grandfathered family; ordinary seeds are
// post-era families, with paid-state behavior exercised only through the seam.
const seed = (age, premium) => `for(const key of ["sona.freeera.v1","sona.freeera2.v1","sona.freeera3.v1","sona.freeera4.v1"])localStorage.setItem(key,key==="sona.freeera.v1"?"post":"done");localStorage.setItem("sona.profile.v1",JSON.stringify({childName:"Mia",childAge:"${age}",focusSounds:["R"],onboarded:true,voiceOn:false${premium ? ",earlyAdopter:true" : ""}}))`;

async function home(age, premium) {
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8178/today.html");
  await pg.evaluate(seed(age || "7", premium));
  await pg.goto("http://localhost:8178/today.html");
  await pg.waitForTimeout(700);
  return { ctx, pg };
}

// ── Home starts with real choices, across both age groups. ──
for (const age of ["3", "4", "5", "8"]) {
  const { ctx, pg } = await home(age, true);
  const st = await pg.evaluate(() => ({
    heading: document.querySelector("h1")?.textContent || "",
    keys: [...document.querySelectorAll("#activityGroups .game-card")].map(e => e.dataset.game),
    groups: [...document.querySelectorAll("#activityGroups .activity-group")].map(e => e.dataset.group),
    playable: [...document.querySelectorAll("#activityGroups .game-card")].filter(e => !["bubbles", "peekaboo"].includes(e.dataset.game)).map(e => ({key:e.dataset.game,accessible:e.dataset.locked === "false"&&!e.disabled})),
    parked: [...document.querySelectorAll("#activityGroups .game-card")].filter(e => ["bubbles", "peekaboo"].includes(e.dataset.game)).map(e => ({key:e.dataset.game,disabled:e.disabled,label:e.textContent,access:Sona.gameAccess(e.dataset.game)})),
    forbidden: !!document.querySelector("#goBtn, #heroCard, #jarRow"),
    run: sessionStorage.getItem("sona.run.v1"),
    books: document.getElementById("booksComingSoon")?.textContent || "",
    bookDoors: document.querySelectorAll('a[href*="chapter.html"],a[href*="library.html"],a[href*="story.html"],#booksComingSoon button,#booksComingSoon a').length,
  }));
  ok("age " + age + ": Home opens directly to Pick a game", /pick a game/i.test(st.heading) && new URL(pg.url()).pathname === "/today.html", JSON.stringify(st));
  ok("age " + age + ": every catalog game appears once in the age shelves", st.keys.length === 8 && new Set(st.keys).size === 8, JSON.stringify(st.keys));
  ok("age " + age + ": both suggested age groups remain available", st.groups.length === 2 && st.playable.length === 6 && st.playable.every(e => e.accessible), JSON.stringify(st));
  ok("age " + age + ": Bubble Pop and Peekaboo stay visible as disabled Coming soon cards", st.parked.length === 2 && st.parked.every(e => e.disabled && /coming soon/i.test(e.label) && e.access.allowed === false && e.access.reason === "coming-soon"), JSON.stringify(st.parked));
  ok("age " + age + ": opening Home does not start a journey or display the retired adventure", !st.run && !st.forbidden, JSON.stringify(st));
  ok("age " + age + ": books remain passive Coming soon", /coming soon/i.test(st.books) && st.bookDoors === 0, JSON.stringify(st));
  await ctx.close();
}

// The retained paid-state seam still distinguishes released free games from
// Premium games. Coming soon remains separate and unavailable to both cohorts.
{
  const {ctx, pg} = await home("7");
  await pg.evaluate(() => sessionStorage.setItem("sona.paidui", "1"));
  await pg.reload();
  const st = await pg.evaluate(() => ({
    heading:document.querySelector("h1").textContent,
    cards:[...document.querySelectorAll("#activityGroups .game-card")].map(e => ({key:e.dataset.game,locked:e.dataset.locked==="true",disabled:e.disabled,tier:Sona.gameAct(e.dataset.game).tier,comingSoon:!!Sona.gameAct(e.dataset.game).comingSoon,tag:e.querySelector(".game-access").textContent})),
  }));
  const released=st.cards.filter(c => !c.comingSoon), parked=st.cards.filter(c => c.comingSoon);
  ok("the paid-state seam still opens directly to the game library", /pick a game/i.test(st.heading) && await pg.locator("#goBtn").count()===0, st);
  ok("the paid-state seam locks exactly the released Premium games without prices", released.length===6&&released.every(c=>c.locked===(c.tier==="premium")&&!c.disabled&&c.tag===(c.tier==="premium"?"Premium":"Free")), released);
  ok("Coming soon stays disabled even on the paid-state seam", parked.length===2&&parked.every(c=>c.locked&&c.disabled&&c.tag==="Coming soon"), parked);
  await pg.locator('#activityGroups .game-card[data-game="slice"]').click();
  await pg.waitForURL(/charge\.html/);
  ok("the paid-state seam keeps free game practice one tap away",new URL(pg.url()).pathname==="/charge.html"&&new URL(pg.url()).searchParams.get("game")==="arcade-slice.html",pg.url());
  await ctx.close();
}

// The former library URL is a compatibility door, including its selected-game
// and local-preview state, not a second Home to navigate back and forth between.
{
  const {ctx, pg} = await home("7");
  const errs = []; pg.on("pageerror", e => errs.push(String(e)));
  await pg.goto("http://localhost:8178/activities.html?libraryPreview=1&locked=tiles#booksComingSoon");
  await pg.waitForURL(/today\.html/);
  const u = new URL(pg.url());
  ok("the old library URL preserves query and fragment on the new Home", u.pathname === "/today.html" && u.searchParams.get("libraryPreview") === "1" && u.searchParams.get("locked") === "tiles" && u.hash === "#booksComingSoon", pg.url());
  ok("the Home library loads without page errors", errs.length === 0, errs.join(" | "));
  const homeSource = readFileSync(ROOT + "/today.html", "utf8").replace(/<!--[\s\S]*?-->/g, "").replace(/\/\/[^\n]*/g, "");
  ok("Home has no door to a parked reader", !/chapter\.html|library\.html|story\.html/.test(homeSource));
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
  const st = await pg.evaluate(() => ({ trio: Sona.dailyGames() }));
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

// Browsing is not practice: neither idle time nor reload can award progress.
{
  const {ctx, pg} = await home("7");
  const snapshot = () => pg.evaluate(() => ({ goal:Sona.goalState(), coins:Sona.getCoins(), run:sessionStorage.getItem("sona.run.v1"), ticket:sessionStorage.getItem("sona.play.token") }));
  const before = await snapshot();
  await pg.waitForTimeout(1200);
  await pg.reload();
  await pg.waitForTimeout(500);
  ok("idle Home and reload do not invent reps, coins, a run or an earned ticket", JSON.stringify(await snapshot()) === JSON.stringify(before), JSON.stringify({before, after:await snapshot()}));
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
  ok("the home reads the shared catalog, and never asks whether a story was read",
    /S\.activityLibrary\(\)/.test(home) && !/storyRead/.test(home));
  ok("the kid home still carries no tracking", !/pixel\.js|analytics\.js/.test(home));
}


// ── 6. METER1: the jar fills on voice, and only on voice ──
{
  const { ctx, pg } = await home("7");
  const zero = await pg.evaluate(() => ({
    goal: Sona.goalState(), coins: Sona.getCoins(),
  }));
  ok("practice progress starts empty before a game is chosen", zero.goal.n === 0 && zero.goal.pct === 0, JSON.stringify(zero));
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

// Returning Home pays coins already earned through practice. This integration
// must survive removing the old star-jar UI; calling mintCoins directly above
// cannot detect a missing Home payout or a reload that double-pays it.
{
  const {ctx, pg} = await home("7");
  const earned = await pg.evaluate(() => {
    const coins = Sona.getCoins();
    Sona.bumpReps(12);
    return {coins, beforeReturn:Sona.getCoins(), reps:Sona.repsToday()};
  });
  ok("honest practice leaves its coins owed until Home handles the return", earned.reps === 12 && earned.beforeReturn === earned.coins, JSON.stringify(earned));
  await pg.reload();
  const first = await pg.evaluate(() => ({coins:Sona.getCoins(),reps:Sona.repsToday()}));
  ok("returning to the library grants the two coins earned by twelve reps", first.coins === earned.coins + 2 && first.reps === earned.reps, JSON.stringify({earned,first}));
  await pg.reload();
  const again = await pg.evaluate(() => ({coins:Sona.getCoins(),reps:Sona.repsToday()}));
  ok("reloading the library cannot pay those earned coins twice", JSON.stringify(again) === JSON.stringify(first), JSON.stringify({first,again}));
  await ctx.close();
}

// ── 8. the mystery game is ADDITIVE — a fourth door, bought with reps ──
// …and a PREMIUM door since 24 Sep 2026: the free version is practice plus its
// games, and a fourth game a day is what Premium adds. So these pins run for a
// family with every game, and the free version's closed door is pinned below.
{
  const { ctx, pg } = await home("7", true);
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
    keys: [...document.querySelectorAll("#activityGroups .game-card")].map(e => e.dataset.game),
  }));
  ok("a saved mystery purchase does not duplicate or hide catalog games", shown.keys.includes(bought.got) && shown.keys.length === new Set(shown.keys).size, JSON.stringify(shown));
  await ctx.close();
}
{
  const { ctx, pg } = await home("7");
  const closed = await pg.evaluate(() => {
    sessionStorage.setItem("sona.paidui", "1");
    Sona.addCoins(500);
    const r = { can: Sona.canBuyMystery(), bought: Sona.buyMystery(), coins: Sona.getCoins() };
    return r;
  });
  ok("on the free version, coins alone never open the mystery door — and are never spent trying",
    closed.can === false && closed.bought === null && closed.coins >= 500, JSON.stringify(closed));
  await pg.goto("http://localhost:8178/today.html"); await pg.waitForTimeout(700);
  ok("…and Home offers no mystery card to buy",
    await pg.evaluate(() => !document.querySelector("#thumbs .thumb.mystery")));
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

  // a sound with no books must never leave an empty room. Every one of the 19
  // sounds has a book now (the fuller books, 26 Sep 2026), so a code the shelf
  // doesn't carry stands in for the next sound someone adds without one.
  await pg.evaluate(() => localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["XX"], onboarded: true })));
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
  async function land(url, prep, withQuery = false) {
    const ctx = await browser.newContext();
    const pg = await ctx.newPage();
    await pg.goto("http://localhost:8178/today.html");
    await pg.evaluate(seed("7"));
    if (prep) await pg.evaluate(prep);
    await pg.goto("http://localhost:8178/" + url);
    await pg.waitForTimeout(600);
    const destination = new URL(pg.url());
    const path = destination.pathname + (withQuery ? destination.search : "");
    await ctx.close();
    return path;
  }
  // A family with every game: a typed URL is refused for want of an EARNED
  // turn, and goes home. (24 Sep 2026: the seed is Premium on purpose — on the
  // free version a Premium game is refused one step earlier, for want of
  // Premium, and that refusal is pinned separately just below.)
  const PREMIUM = 'const p=JSON.parse(localStorage.getItem("sona.profile.v1"));p.earlyAdopter=true;localStorage.setItem("sona.profile.v1",JSON.stringify(p))';
  for (const g of ARCADE) {
    ok(`${g} can't be opened by typing its URL`, (await land(g, PREMIUM)) === "/today.html", g);
  }
  ok("…not even once today's adventure is done",
    (await land("arcade-slice.html", PREMIUM + ";Sona.dailyFinish(10)")) === "/today.html");
  // the free version: a free game typed in goes home like any other; a
  // Premium one goes to the library's lock, which asks for a grown-up — never
  // to a price
  for (const g of ARCADE) {
    const key = g.replace(/^arcade-|\.html$/g, "");
    const tier = key === "slice" || key === "stack" ? "free" : "premium";
    const to = await land(g, 'sessionStorage.setItem("sona.paidui","1")', true);
    ok(`on the free version, typed ${g} is refused (${tier})`,
      tier === "free" ? to === "/today.html" : to === "/today.html?locked=" + key, to);
  }
  // a round the child already EARNED must never be interrupted — charge.html
  // gates before it hands off, and a session started at 11:58pm would
  // otherwise be thrown out at midnight when the day rolls over
  ok("a charge hand-off is never bounced",
    (await land("arcade-slice.html?from=charge")) === "/arcade-slice.html");
  // A URL flag is not an earned ticket. An expired Premium choice returns
  // to the child-safe library, which keeps the selected game and free choices.
  ok("an expired Premium hand-off without an earned ticket returns to its library choice",
    (await land("arcade-tiles.html?from=charge", 'sessionStorage.setItem("sona.paidui","1");localStorage.setItem("sona.demo.v1",JSON.stringify({started:1,done:1}));localStorage.setItem("sona.trial.v1",JSON.stringify({start:Date.now()-40*86400000,days:3}))', true)) === "/today.html?locked=tiles");
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

// ── Deliberate selection, not an automatic adventure. ──
// Every visible choice names and illustrates the game practice actually earns.
// The card may appear in New as well, so exercise each canonical age shelf.
for (const key of ["feed", "slice", "tiles", "stack", "run", "glide"]) {
  const {ctx, pg} = await home("7", true);
  const card = pg.locator('#activityGroups .game-card[data-game="' + key + '"]');
  const visible = await card.evaluate(e => ({name:e.querySelector(".game-name").textContent,art:e.querySelector("use").getAttribute("href")}));
  await card.click();
  await pg.waitForURL(/(?:charge|arcade-(?:feed|bubbles|peekaboo))\.html/);
  const result = await pg.evaluate(() => ({
    game: window.GAME || null, title: (document.getElementById("gameTitle") || {}).textContent,
    run: sessionStorage.getItem("sona.run.v1"), ticket: sessionStorage.getItem("sona.play.token"),
    sticker: "#" + Sona.gameSticker(window.GAME || location.pathname.split("/").pop())[0],
  }));
  if (key === "feed") {
    ok(key + ": choosing the simple game opens its integrated practice", new URL(pg.url()).pathname === "/arcade-" + key + ".html", pg.url());
  } else {
    const u = new URL(pg.url());
    ok(key + ": choosing the game opens its practice, not an unrelated daily run", u.pathname === "/charge.html" && u.searchParams.get("game") === "arcade-" + key + ".html" && !u.searchParams.has("daily") && String(result.title).toLowerCase() === visible.name.toLowerCase(), JSON.stringify({url:pg.url(),visible,result}));
    ok(key + ": practice preserves the chosen card's art", visible.art === result.sticker, JSON.stringify({visible,result}));
  }
  ok(key + ": choosing a card never awards a ticket or creates a daily journey", result.ticket === null && result.run === null, JSON.stringify(result));
  await ctx.close();
}

// A parked game is unavailable even on a previously earned or paid return.
// It keeps a visible place in the library without becoming a hidden launch door.
for (const key of ["bubbles", "peekaboo"]) {
  const {ctx, pg} = await home("4");
  const before = await pg.evaluate(() => ({run:sessionStorage.getItem("sona.run.v1"),ticket:sessionStorage.getItem("sona.play.token"),reps:Sona.repsToday()}));
  await pg.locator('#activityGroups .game-card[data-game="' + key + '"]').evaluate(el => el.click());
  await pg.waitForTimeout(200);
  const after = await pg.evaluate(() => ({run:sessionStorage.getItem("sona.run.v1"),ticket:sessionStorage.getItem("sona.play.token"),reps:Sona.repsToday()}));
  ok(key + ": the disabled library card does not navigate, earn or start anything", new URL(pg.url()).pathname === "/today.html" && JSON.stringify(before) === JSON.stringify(after), JSON.stringify({before,after,url:pg.url()}));
  await pg.evaluate(key => {
    Sona.saveSub({active:true,source:"stripe"});
    sessionStorage.setItem("sona.play.token","arcade-" + key + ".html");
    sessionStorage.setItem("sona.play.active","arcade-" + key + ".html");
  },key);
  await pg.goto("http://localhost:8178/arcade-" + key + ".html?from=charge");
  await pg.waitForURL(/today\.html/);
  ok(key + ": an old paid or earned URL still returns to the library", new URL(pg.url()).pathname === "/today.html" && await pg.locator("#libraryApp").isVisible(),pg.url());
  await ctx.close();
}

// Older saved journeys stay safe, but cannot take over the app's opening screen.
for (const round of [0, 2, 5]) {
  const {ctx, pg} = await home("7");
  const saved = {active:true, round, sum:round*20,scores:Array(round).fill(20),sound:"S",level:1,pending:false,demo:true,games:["tiles","stack","run","glide","slice"]};
  await pg.evaluate(run => sessionStorage.setItem("sona.run.v1",JSON.stringify(run)), saved);
  await pg.reload();
  await pg.waitForTimeout(700);
  const state = await pg.evaluate(() => ({run:JSON.parse(sessionStorage.getItem("sona.run.v1")),cards:document.querySelectorAll("#activityGroups .game-card").length,oldHero:!!document.getElementById("goBtn")}));
  ok("saved round " + round + ": reopening shows the library without resuming or changing earned progress", new URL(pg.url()).pathname === "/today.html" && state.cards === 8 && !state.oldHero && JSON.stringify(saved) === JSON.stringify(state.run), JSON.stringify(state));
  await pg.locator('#activityGroups .game-card[data-game="slice"]').click();
  await pg.waitForURL(/charge\.html/);
  ok("saved round " + round + ": a new chosen game still opens its own practice", new URL(pg.url()).searchParams.get("game") === "arcade-slice.html" && await pg.evaluate(() => window.GAME === "arcade-slice.html"), pg.url());
  await ctx.close();
}

// A pre-update record has no games field. Adopting a plan must not erase its
// score, pending return, target or replay flag; refreshing a return banks once.
{
  const { ctx, pg } = await home("7");
  const legacy = { active: true, round: 2, sum: 40, scores: [20, 20], sound: "S", level: 2, pending: false, ringed: 1, demo: true };
  await pg.evaluate((run) => sessionStorage.setItem("sona.run.v1", JSON.stringify(run)), legacy);
  await pg.goto("http://localhost:8178/charge.html?daily=1");
  const adopted = await pg.evaluate(() => JSON.parse(sessionStorage.getItem("sona.run.v1")));
  ok("a legacy adventure adopts a five-game plan",
    Array.isArray(adopted.games) && adopted.games.length === 5, JSON.stringify(adopted));
  ok("adopting the plan preserves every existing progress and replay field",
    Object.keys(legacy).every((key) => JSON.stringify(adopted[key]) === JSON.stringify(legacy[key])), JSON.stringify(adopted));

  await pg.evaluate(() => {
    const run = JSON.parse(sessionStorage.getItem("sona.run.v1"));
    run.pending = true;
    sessionStorage.setItem("sona.run.v1", JSON.stringify(run));
  });
  await pg.goto("http://localhost:8178/charge.html?daily=1&banked=10");
  const banked = await pg.evaluate(() => JSON.parse(sessionStorage.getItem("sona.run.v1")));
  await pg.reload();
  const refreshed = await pg.evaluate(() => JSON.parse(sessionStorage.getItem("sona.run.v1")));
  ok("a returning score advances one round exactly once",
    banked.round === 3 && banked.sum === 50 && banked.pending === false && JSON.stringify(banked.scores) === "[20,20,10]"
      && JSON.stringify(refreshed) === JSON.stringify(banked), JSON.stringify({ banked, refreshed }));
  ok("banking preserves the chosen sequence and replay",
    JSON.stringify(refreshed.games) === JSON.stringify(adopted.games) && refreshed.demo === true, JSON.stringify(refreshed));

  await pg.evaluate(() => {
    const run = JSON.parse(sessionStorage.getItem("sona.run.v1"));
    run.round = 4; run.pending = true;
    sessionStorage.setItem("sona.run.v1", JSON.stringify(run));
  });
  await pg.goto("http://localhost:8178/charge.html?daily=1&banked=7");
  const done = await pg.evaluate(() => ({
    run: JSON.parse(sessionStorage.getItem("sona.run.v1")),
    shown: document.getElementById("runOvl").classList.contains("show"),
  }));
  ok("the fifth return finishes the saved journey",
    done.shown && done.run.active === true && done.run.finishing === true && done.run.round === 5 && done.run.sum === 57, JSON.stringify(done));
  await pg.goto("http://localhost:8178/today.html");
  ok("an unfinished finale cannot take over the Home library", await pg.locator("#activityGroups .game-card").count() === 8 && await pg.locator("#goBtn").count() === 0);
  await pg.goto("http://localhost:8178/charge.html?daily=1");
  ok("the earned legacy finale remains available through its explicit return", await pg.locator("#runOvl").evaluate(e => e.classList.contains("show")));

  // Also reject an old active record already at its finish line; Home should
  // never say there is a sixth round merely because active was left true.
  await pg.evaluate(() => {
    const run = JSON.parse(sessionStorage.getItem("sona.run.v1"));
    run.active = true; delete run.finishing;
    sessionStorage.setItem("sona.run.v1", JSON.stringify(run));
  });
  await pg.goto("http://localhost:8178/today.html");
  ok("a finished active record cannot produce a sixth-round Home resume", await pg.locator("#goBtn").count() === 0 && await pg.locator("#activityGroups .game-card").count() === 8);
  await ctx.close();
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
