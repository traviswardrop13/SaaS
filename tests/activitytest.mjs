// The play library offers every game, recommends a starting group by the
// active child's age, and never turns browsing into practice or a purchase.
import { createServer } from "http";
import { existsSync, readFileSync } from "fs";
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from "./_env.mjs";

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT;
const BASE = "http://localhost:8188";
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, BASE);
  if (u.pathname.startsWith("/api/")) { res.writeHead(503, { "content-type": "application/json" }); res.end("{}"); return; }
  const file = ROOT + u.pathname;
  if (!existsSync(file)) { res.writeHead(404, { "content-type": "text/plain" }); res.end("Not found"); return; }
  res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((resolve) => srv.listen(8188, resolve));
const browser = await chromium.launch(launchOpts());
let fails = 0;
function ok(name, passed, detail = "") {
  if (!passed) fails++;
  console.log((passed ? "PASS " : "FAIL ") + name + (passed ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail))));
}
async function section(name, fn) {
  try { await fn(); }
  catch (error) { ok(name + " completes without a browser/test exception", false, error.message); }
}
// The twenty Say & Play games (26 Sep 2026) open straight to their own page
// and never join the daily adventure, whose deck stays the five arcade games.
const sayLittle = ["balloon", "cake", "fishtank", "flower", "gifts", "puppy", "rocket", "snowman", "stars", "train"];
const sayBig = ["castle", "dino", "hoops", "monster", "pizza", "racecar", "robot", "soccer", "space", "treasure"];
const adventureKeys = ["glide", "run", "slice", "stack", "tiles"];
const simpleKeys = ["bubbles", "feed", "peekaboo", ...sayLittle].sort();
const arcadeKeys = [...adventureKeys, ...sayBig].sort();
const directKeys = ["bubbles", "feed", "peekaboo", ...sayLittle, ...sayBig];
const allKeys = [...simpleKeys, ...arcadeKeys].sort();
// COMING SOON (Travis, 26 Sep 2026): Bubble Pop and Peekaboo, and every Say &
// Play game until it is rebuilt as a real game ("put the 20 games as coming
// soon ... except for old ones ... that actually work. leave those"). Which
// Say & Play games are still parked is read from the catalog: each comes back
// one at a time by taking comingSoon off its own line in sona.js.
const SONA_SRC = readFileSync(ROOT + "/sona.js", "utf8");
const parkedSay = [...SONA_SRC.matchAll(/^\s{4}(\w+): \{[^\n]*\bsay: true, comingSoon: true\b/gm)].map((m) => m[1]);
// Bubble Pop came back on 30 Sep 2026 (Travis: "the two free games for
// younger kids"); Peekaboo is still parked.
const comingSoonKeys = ["peekaboo", ...parkedSay].sort();
let playableKeys = [], freeKeys = [], premiumKeys = [];
const sorted = (values) => [...values].sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Ordinary families use the restored free release. The paid seam rehearses
// future locks without changing the release or granting a real entitlement.
async function fixture({ age = "4", paid = false, premium = false, viewport = { width: 390, height: 844 }, path = "/activities.html", origin = BASE, catalog = null, now = null } = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (origin === BASE && !(url.pathname === "/sona.js" && (catalog || now !== null))) return route.continue();
    const file = ROOT + url.pathname;
    if (url.pathname.startsWith("/api/") || !existsSync(file)) return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    let body = readFileSync(file);
    if (url.pathname === "/sona.js" && (catalog || now !== null)) body = body.toString() + `
      (function(){
        var catalog=${JSON.stringify(catalog)};
        if(catalog)Object.keys(catalog).forEach(function(key){Object.assign(Sona.GAME_ACTS[key],catalog[key]);});
        var now=${JSON.stringify(now)},original=Sona.activityLibrary;
        if(now!==null)Sona.activityLibrary=function(options){return original(options||{now:now});};
      })();`;
    return route.fulfill({ contentType: MIME[file.split(".").pop()] || "application/octet-stream", body });
  });
  await ctx.addInitScript(({ age, paid, premium }) => {
    if (!localStorage.getItem("sona.test.librarySeed")) {
      localStorage.setItem("sona.test.librarySeed", "1");
      localStorage.setItem("sona.freeera.v1", "post");
      localStorage.setItem("sona.freeera2.v1", "done");
      localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done"); localStorage.setItem("sona.freeera5.v1", "done");
      const profile = { childName: "Mia", focusSounds: ["S"], onboarded: true, volume: 0, voiceOn: false, soundOn: false };
      if (premium) profile.earlyAdopter = true;
      if (age !== null) profile.childAge = age;
      localStorage.setItem("sona.profile.v1", JSON.stringify(profile));
      if (paid) {
        sessionStorage.setItem("sona.paidui", "1");
        localStorage.setItem("sona.demo.v1", JSON.stringify({ started: Date.now() - 100 * 3600000, done: Date.now() - 90000 }));
      }
    }
  }, { age, paid, premium });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(5000);
  const errors = [];
  pg.on("pageerror", (error) => errors.push(error.message));
  const response = await pg.goto(origin + path);
  return { ctx, pg, errors, response };
}
async function visibleGames(pg) {
  return pg.locator("#activityGroups button[data-game]:visible").evaluateAll((els) => els.map((el) => el.dataset.game));
}
async function visibleGroups(pg) {
  return pg.locator("#activityGroups [data-group]").evaluateAll((els) => els.map((el) => el.dataset.group));
}
async function state(pg) {
  return pg.evaluate(() => {
    const keys = Object.keys(localStorage).filter((key) => /^sona\.(?:profile|progress|tickets|charge|rotation|today|reps|coins|sub|trial|demo|slp|caseplan|founding|founder|pilot|rung|plan)/.test(key)).sort();
    return {
      local: keys.map((key) => [key, localStorage.getItem(key)]),
      paidUi: sessionStorage.getItem("sona.paidui"),
      run: sessionStorage.getItem("sona.run.v1"),
      token: sessionStorage.getItem("sona.play.token"),
      activeGame: sessionStorage.getItem("sona.play.active"),
    };
  });
}

// Baseline checks deliberately report missing page/contract as assertions,
// rather than throwing before the regression suite can say what is absent.
const present = existsSync(ROOT + "/activities.html");
ok("the play library is a shipped page", present);
let hasContract = false;
await section("library prerequisites", async () => {
  const { ctx, pg } = await fixture({ path: "/today.html" });
  try {
    hasContract = await pg.evaluate(() => typeof window.Sona?.activityLibrary === "function");
    ok("Sona provides the activity library content contract", hasContract);
    if (hasContract) {
      const games = await pg.evaluate(() => Sona.activityLibrary().groups.flatMap(group => group.games));
      playableKeys = games.filter(game => game.available && !game.comingSoon).map(game => game.key).sort();
      freeKeys = games.filter(game => game.available && !game.comingSoon && game.tier === "free").map(game => game.key).sort();
      premiumKeys = games.filter(game => game.available && !game.comingSoon && game.tier === "premium").map(game => game.key).sort();
      ok("Coming soon: Peekaboo and every Say & Play game not rebuilt yet", same(games.filter(game => game.comingSoon).map(game => game.key).sort(), comingSoonKeys) && parkedSay.every((key) => sayLittle.includes(key) || sayBig.includes(key)));
      ok("…and the six first games are never Coming soon", ["feed", ...adventureKeys].every((key) => playableKeys.includes(key)), playableKeys);
    }
    ok("Home itself presents the game picker", await pg.getByRole("heading", {name:"Pick a game!",exact:true}).count() === 1 && await pg.locator("#activityGroups button[data-game]").count() === allKeys.length);
  } finally { await ctx.close(); }
});

if (present && hasContract) {
  await section("age recommendations", async () => {
    const { ctx, pg } = await fixture();
    try {
      const cases = [
        ["3", "simple"], ["4", "simple"], ["5", "arcade"], ["8", "arcade"], ["14", "arcade"],
        [null, null], ["", null], ["unknown", null], ["4 years", null], ["5.5", null], ["2", "simple"], ["15", null], ["-1", null],
      ];
      for (const [age, recommended] of cases) {
        const model = await pg.evaluate((age) => {
          const profile = Sona.getProfile();
          profile.childAge = age == null ? "" : age;
          Sona.saveProfile(profile);
          return Sona.activityLibrary();
        }, age);
        const label = "age " + JSON.stringify(age);
        ok(label + ": recommendation uses only a valid supported age", model.recommended === recommended, model.recommended);
        ok(label + ": both play groups remain available", same(sorted(model.groups.map((g) => g.id)), ["arcade", "simple"]), model.groups);
        ok(label + ": every catalog card remains visible", same(sorted(model.groups.flatMap((g) => g.games.map((game) => game.key))), allKeys));
        ok(label + ": only the recommended group is marked",
          model.groups.every((g) => g.recommended === (g.id === recommended)), model.groups.map((g) => ({ id: g.id, recommended: g.recommended })));
        if (recommended) ok(label + ": the recommended group comes first", model.groups[0]?.id === recommended, model.groups.map((g) => g.id));
      }
      const model = await pg.evaluate(() => Sona.activityLibrary());
      const simple = model.groups.find((g) => g.id === "simple");
      const arcade = model.groups.find((g) => g.id === "arcade");
      ok("Simple play contains Feed Echo, Bubble Pop, Peekaboo and the ten Say & Play games for 3-4", same(sorted(simple.games.map((g) => g.key)), simpleKeys));
      // Five rounds of the arcade games this family can open: all five with
      // Premium or while Sona is free, the free ones on the free version.
      const adventure = await pg.evaluate(() => Sona.adventureGames().map((key) => ({ key, open: Sona.gameAccess(key).allowed })));
      const everyGame = await pg.evaluate(() => Sona.isFree() || Sona.premium());
      ok("the daily adventure is five rounds of arcade games the family can open",
        adventure.length === 5 && adventure.every((g) => adventureKeys.includes(g.key) && g.open)
          && (!everyGame || same(sorted(adventure.map((g) => g.key)), adventureKeys)), adventure);
      ok("Arcade contains the five earned arcade games and the ten Say & Play games for 5-8", same(sorted(arcade.games.map((g) => g.key)), arcadeKeys));
      ok("Simple play presents the suggested 3–4 range", simple.ageLabel === "Suggested ages 3–4", simple.ageLabel);
      ok("Arcade presents the suggested 5–8 range", arcade.ageLabel === "Suggested ages 5–8", arcade.ageLabel);
      ok("every game has explicit catalog metadata",
        model.groups.every((g) => g.games.every((game) => ["free", "premium"].includes(game.tier)
          && Object.hasOwn(game, "releasedOn") && (game.releasedOn === null || /^\d{4}-\d{2}-\d{2}$/.test(game.releasedOn)) && game.available === true && typeof game.comingSoon === "boolean")));
      ok("each suggested age group retains a playable free game", model.groups.every((g) => g.games.some((game) => game.tier === "free" && !game.comingSoon)));
      // Travis, 30 Sep 2026: "the two free games for older kids, the two free games for younger kids"
      ok("the playable free games are two for each age group: Feed Echo and Bubble Pop, Fruit Slice and Piano Tiles", same(freeKeys, ["bubbles", "feed", "slice", "tiles"]), freeKeys);
      ok("every game has a usable name, description and destination",
        model.groups.every((g) => [g.name, g.ageLabel, g.description].every((v) => typeof v === "string" && v.trim())
          && g.games.every((game) => [game.name, game.sub, game.go, game.playDescription].every((v) => typeof v === "string" && v.trim()))));
    } finally { await ctx.close(); }
  });

  for (const age of ["4", "5", "8", null]) {
    await section("render and suggested groups, age " + age, async () => {
      const { ctx, pg, errors } = await fixture({ age });
      try {
        ok("age " + age + ": the browser title names the play library", /play library/i.test(await pg.title()), await pg.title());
        ok("age " + age + ": All games initially shows every game", same(sorted(await visibleGames(pg)), allKeys));
        const recommended = age === "4" ? "simple" : age == null ? null : "arcade";
        if (recommended) ok("age " + age + ": recommended cards render first", (await visibleGroups(pg))[0] === recommended);
        const games = await pg.evaluate(() => Sona.activityLibrary().groups.flatMap((g) => g.games));
        for (const game of games) {
          const button = pg.locator('#activityGroups button[data-game="' + game.key + '"]');
          ok("age " + age + ": " + game.name + " is accessible and disabled only when Coming soon",
            await button.count() === 1 && await button.isEnabled() === !game.comingSoon
              && await pg.locator("#activityGroups").getByRole("button", { name: new RegExp(game.name, "i") }).count() === 1);
        }
        ok("age " + age + ": Echo gives one simple invitation", await pg.getByRole("heading", {name:"Pick a game!", exact:true}).count() === 1);
        ok("age " + age + ": all games are visible without reading filters", await pg.locator("#libraryFilters").count() === 0);
        const groups = await pg.evaluate(() => Sona.activityLibrary().groups);
        for (const group of groups) {
          const section = pg.locator('#activityGroups [data-group="' + group.id + '"]');
          const heading = section.getByRole("heading", { name: group.name, exact: true });
          const readableHeading = await heading.count() === 1 && await heading.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 30 && r.height > 10 && getComputedStyle(el).visibility !== "hidden";
          });
          ok("age " + age + ": " + group.name + " has a visible section heading", readableHeading);
          ok("age " + age + ": " + group.ageLabel + " is visible", await section.getByText(group.ageLabel, { exact: true }).isVisible());
        }
        const cards = await pg.locator("#activityGroups button[data-game]:enabled").allInnerTexts();
        const isFree = await pg.evaluate(() => Sona.isFree());
        if (isFree) ok("age " + age + ": normal free access is labeled Free on every playable card", cards.every((text) => /\bFree\b/.test(text) && !/\bPremium\b/.test(text)), cards);
        const parked = await pg.locator("#activityGroups button[data-game]:disabled").allInnerTexts();
        ok("age " + age + ": every parked title says when it is coming: its Monday, or Coming soon", parked.length === comingSoonKeys.length && parked.every(text => /Coming (soon|[A-Z][a-z]{2} \d{1,2})\b/.test(text)), parked);
        ok("age " + age + ": proposed tier preview stays hidden by default", !await pg.locator("#catalogPreviewNotice").isVisible());
        // BOOKS ARE ON (Travis, 26 Sep 2026: "yes turn them on"): one card,
        // free while the app is free, that opens the bookshelf.
        const books = pg.locator("#booksCard");
        ok("age " + age + ": the Books card is visible, no longer Coming soon", await books.isVisible() && /books/i.test(await books.innerText()) && !/coming soon/i.test(await books.innerText()));
        if (isFree) ok("age " + age + ": while the app is free the Books card says Free", /\bFree\b/.test(await books.innerText()), await books.innerText());
        ok("age " + age + ": no runtime errors", errors.length === 0, errors);
      } finally { await ctx.close(); }
    });
  }

  await section("featured dates and catalog readiness", async () => {
    const { ctx, pg } = await fixture();
    try {
      const before = await state(pg);
      const initial = await pg.evaluate(() => Sona.activityLibrary());
      ok("featured shelves use an explicit array of nonempty groups", Array.isArray(initial.featured) && initial.featured.every((group) => ["new", "seasonal"].includes(group.id) && group.name?.trim() && group.games?.length > 0), initial.featured);
      ok("the catalog does not invent an empty seasonal shelf", Array.isArray(initial.featured) && !initial.featured.some((group) => group.id === "seasonal"));
      const samples = await pg.evaluate(() => {
        const saved = JSON.stringify(Sona.GAME_ACTS);
        const now = Date.UTC(2028, 3, 30, 12);
        const snapshot = (time = now) => Sona.activityLibrary({ now: time });
        try {
          Object.values(Sona.GAME_ACTS).forEach((game) => { game.releasedOn = "2000-01-01"; delete game.season; });
          Sona.GAME_ACTS.feed.releasedOn = "2028-04-30";
          Sona.GAME_ACTS.run.releasedOn = "2028-04-01";
          Sona.GAME_ACTS.glide.releasedOn = "2028-03-31";
          Sona.GAME_ACTS.stack.releasedOn = "2028-05-01";
          Sona.GAME_ACTS.tiles.releasedOn = "2028-04-31";
          Sona.GAME_ACTS.slice.releasedOn = "not-a-date";
          const fresh = snapshot();
          Sona.GAME_ACTS.feed.season = { startsOn: "2028-04-30", endsOn: "2028-04-30" };
          Sona.GAME_ACTS.run.season = { startsOn: "2028-04-01", endsOn: "2028-04-30" };
          Sona.GAME_ACTS.tiles.season = { startsOn: "2028-04-30", endsOn: "2028-05-02" };
          Sona.GAME_ACTS.stack.season = { startsOn: "2028-05-01", endsOn: "2028-05-02" };
          Sona.GAME_ACTS.glide.season = { startsOn: "2028-04-01", endsOn: "2028-04-29" };
          const seasonal = snapshot();
          const start = snapshot(Date.UTC(2028, 3, 30));
          const end = snapshot(Date.UTC(2028, 3, 30, 23, 59, 59));
          const expired = snapshot(Date.UTC(2028, 4, 3));
          Sona.GAME_ACTS.feed.available = false;
          const unavailable = snapshot();
          ["bubbles", "peekaboo"].forEach(key => { Sona.GAME_ACTS[key].releasedOn = "2028-04-30"; Sona.GAME_ACTS[key].season = { startsOn: "2028-04-30", endsOn: "2028-04-30" }; });
          const comingSoon = snapshot();
          return { fresh, seasonal, start, end, expired, unavailable, comingSoon };
        } finally {
          const original = JSON.parse(saved);
          Object.keys(Sona.GAME_ACTS).forEach((key) => { Sona.GAME_ACTS[key] = original[key]; });
        }
      });
      const featuredKeys = (model, id) => sorted((model.featured || []).find((group) => group.id === id)?.games.map((game) => game.key) || []);
      ok("New includes today and day 29 but excludes day 30, future and invalid release dates", same(featuredKeys(samples.fresh, "new"), ["feed", "run"]), samples.fresh.featured);
      ok("Coming soon titles cannot appear as New or seasonal releases", !samples.comingSoon.featured.flatMap(group => group.games).some(game => comingSoonKeys.includes(game.key)));
      ok("seasonal shelves include both date boundaries and omit future or expired seasons", same(featuredKeys(samples.seasonal, "seasonal"), ["feed", "run", "tiles"]), samples.seasonal.featured);
      ok("release and season dates use the same whole UTC day", same(samples.start.featured, samples.end.featured), { start: samples.start.featured, end: samples.end.featured });
      ok("an expired seasonal shelf disappears instead of remaining empty", !(samples.expired.featured || []).some((group) => group.id === "seasonal"), samples.expired.featured);
      ok("unavailable games cannot appear in either age groups or featured shelves", !samples.unavailable.groups.flatMap((group) => group.games).some((game) => game.key === "feed") && !(samples.unavailable.featured || []).flatMap((group) => group.games).some((game) => game.key === "feed"));
      ok("catalog date checks do not change family progress or access", same(await state(pg), before));
    } finally { await ctx.close(); }
  });

  // MONDAY DROPS (Travis, 30 Sep 2026: "games that aren't finished ... label
  // them ... coming October 8th or whatever", then "new ones each monday
  // dropping"). Each parked game carries a Monday; Home says it until that
  // day and "Coming soon" after, soonest first on its shelf, and the date
  // never opens anything: only taking comingSoon off does.
  await section("parked games say their Monday", async () => {
    const dated = [...SONA_SRC.matchAll(/^\s{4}(\w+): \{[^\n]*group: "(\w+)"[^\n]*\bcomingSoon: true, comingOn: "(\d{4}-\d{2}-\d{2})"/gm)].map((m) => ({ key: m[1], group: m[2], on: m[3] }));
    const perWeek = dated.reduce((n, d) => ((n[d.group + d.on] = (n[d.group + d.on] || 0) + 1), n), {});
    ok("every parked game has a Monday, one game per age group a week at most",
      same(sorted(dated.map((d) => d.key)), comingSoonKeys) && dated.every((d) => new Date(d.on + "T12:00:00Z").getUTCDay() === 1)
        && Object.values(perWeek).every((c) => c === 1), dated);
    const cardsAt = async (now) => {
      const { ctx, pg, errors } = await fixture({ now });
      try {
        const got = await pg.evaluate(() => {
          const tag = (key) => { const b = document.querySelector('#activityGroups button[data-game="' + key + '"]'); return b ? { label: b.querySelector(".game-access").textContent, disabled: b.disabled, aria: b.getAttribute("aria-label") } : null; };
          const firstParked = [...document.querySelectorAll("#activityGroups .coming-shelf")].map((g) => g.querySelector(".coming-grid button[data-game]")?.dataset.game)   // one Coming soon section since 1 Oct 2026;
          return { peekaboo: tag("peekaboo"), soccer: tag("soccer"), racecar: tag("racecar"), firstParked, access: Sona.gameAccess("peekaboo") };
        });
        return { got, errors };
      } finally { await ctx.close(); }
    };
    let r = await cardsAt(Date.UTC(2026, 9, 1, 12));
    ok("before its Monday a parked game says the day: Peekaboo and Soccer Goal \"Coming Oct 12\", Race Car \"Coming Oct 19\"",
      r.got.peekaboo.label === "Coming Oct 12" && r.got.soccer.label === "Coming Oct 12" && r.got.racecar.label === "Coming Oct 19"
        && r.got.peekaboo.disabled && /Coming Oct 12/.test(r.got.peekaboo.aria), JSON.stringify(r.got));
    ok("…each shelf's parked games soonest first", same(sorted(r.got.firstParked), ["peekaboo", "soccer"]), r.got.firstParked);
    ok("…with no page errors", r.errors.length === 0, r.errors);
    r = await cardsAt(Date.UTC(2026, 9, 13, 12));
    ok("past its Monday and still unfinished, a game goes back to \"Coming soon\", while the next one keeps its day",
      r.got.peekaboo.label === "Coming soon" && r.got.soccer.label === "Coming soon" && r.got.racecar.label === "Coming Oct 19", JSON.stringify(r.got));
    ok("…and the date never opens it", r.got.peekaboo.disabled && r.got.access.allowed === false && r.got.access.reason === "coming-soon", JSON.stringify(r.got));
  });

  await section("featured cards are extra working choices", async () => {
    const catalog = Object.fromEntries(allKeys.map((key) => [key, { releasedOn: "2000-01-01", season: null }]));
    catalog.feed.releasedOn = catalog.slice.releasedOn = "2028-04-30";
    const { ctx, pg } = await fixture({ catalog, now: Date.UTC(2028, 3, 30, 12) });
    try {
      const featured = pg.locator("#featuredGroups");
      ok("the New shelf shows only the two current releases", same(sorted(await featured.locator("button[data-game]").evaluateAll((els) => els.map((el) => el.dataset.game))), ["feed", "slice"]));
      ok("featured cards leave every game once in the age groups", same(sorted(await visibleGames(pg)), allKeys));
      const shelf = await featured.locator("button[data-game]").evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
      ok("featured cards share a horizontal shelf", shelf.length === 2 && Math.abs(shelf[0].y - shelf[1].y) < 2 && shelf[1].x > shelf[0].x, shelf);
      const button = featured.locator('button[data-game="feed"]');
      if (await button.count()) {
        await button.click();
        await pg.waitForURL(/\/arcade-feed\.html(?:[?#]|$)/);
        ok("a featured game opens its existing route", new URL(pg.url()).pathname === "/arcade-feed.html");
      } else ok("a featured game has a working launch button", false);
    } finally { await ctx.close(); }
  });

  for (const origin of [BASE, "http://127.0.0.1:8188", "http://[::1]:8188", "https://library.example.test"]) {
    await section("catalog preview host " + origin, async () => {
      const { ctx, pg } = await fixture({ origin });
      try {
        const before = await state(pg);
        const access = await pg.evaluate(() => ({ free: Sona.isFree(), gated: Sona.gated("practice") }));
        await pg.goto(origin + "/activities.html?libraryPreview=1");
        const local = origin !== "https://library.example.test";
        const notice = pg.locator("#catalogPreviewNotice");
        ok(origin + ": preview visibility is restricted to loopback hosts", await notice.isVisible() === local);
        const cards = await pg.locator("#activityGroups button[data-game]:enabled").allInnerTexts();
        if (local) {
          const copy = await notice.count() ? await notice.innerText() : "";
          ok(origin + ": preview identifies the local simulation and rules out real purchases", /preview/i.test(copy) && /no (?:real )?purchases|no charge|never charge|nothing is charged|purchases are off/i.test(copy), copy);
          ok(origin + ": playable cards have their Free or Premium labels", cards.filter((text) => /\bFree\b/.test(text)).length === freeKeys.length && cards.filter((text) => /\bPremium\b/.test(text)).length === premiumKeys.length, cards);
        } else if (access.free) ok("a public host ignores the preview URL and keeps current Free labels", cards.every((text) => /\bFree\b/.test(text) && !/\bPremium\b/.test(text)), cards);
        ok(origin + ": the preview has no purchase link or button", await pg.locator('#libraryApp a[href*="subscribe"],#libraryApp a[href*="checkout"]').count() === 0 && await pg.getByRole("button", { name: /buy|subscribe|purchase|upgrade/i }).count() === 0);
        ok(origin + ": preview does not change the real pricing switch or general practice gate", same(await pg.evaluate(() => ({ free: Sona.isFree(), gated: Sona.gated("practice") })), access));
        ok(origin + ": preview creates no entitlement, plan impression or practice state", same(await state(pg), before), { before, after: await state(pg) });
        if (local && !access.gated) {
          await pg.locator('#activityGroups button[data-game="stack"]').click();
          ok(origin + ": a Premium preview choice stays on Home with a parent invitation", new URL(pg.url()).pathname === "/today.html" && await pg.locator("#libraryNotice").isVisible());
          ok(origin + ": the preview keeps the playable free games open", same(await pg.evaluate(() => Object.keys(Sona.GAME_ACTS).filter(key => Sona.gameAccess(key).allowed).sort()), freeKeys));
        }
      } finally { await ctx.close(); }
    });
  }

  await section("preview preserves real paid state while offering its free games", async () => {
    const { ctx, pg } = await fixture({ paid: true, path: "/activities.html?libraryPreview=1" });
    try {
      const before = await state(pg);
      ok("preview leaves Premium locked while practice stays open", await pg.evaluate(() => Sona.gated("story") === true && Sona.gated("practice") === false));
      ok("free preview games are accessible without a real entitlement", await pg.evaluate(() => Sona.gameAccess("feed").allowed && !Sona.gameAccess("stack").allowed));
      await pg.locator('#activityGroups button[data-game="stack"]').click();
      ok("Premium stays behind the parent invitation in a paid-state preview", new URL(pg.url()).pathname === "/today.html" && await pg.locator("#libraryNotice").isVisible());
      ok("preview gate checks create no access or practice", same(await state(pg), before));
    } finally { await ctx.close(); }
  });

  await section("cached catalog without featured shelves", async () => {
    const { ctx, pg, errors } = await fixture();
    try {
      // A new page can arrive while the browser still holds the previous sona.js.
      await ctx.route("**/sona.js", route => route.fulfill({ contentType: "text/javascript", body: readFileSync(ROOT + "/sona.js", "utf8") + `
        (function(){
          var currentLibrary=Sona.activityLibrary;
          Sona.activityLibrary=function(){
            var library=currentLibrary();
            return {recommended:library.recommended,groups:library.groups};
          };
        })();`
      }));
      await pg.reload();
      ok("an older cached catalog still renders every game choice", same(sorted(await visibleGames(pg)), allKeys));
      ok("an older cached catalog causes no runtime errors", errors.length === 0, errors);
    } finally { await ctx.close(); }
  });

  await section("active child", async () => {
    const { ctx, pg } = await fixture({ age: "8" });
    try {
      const firstSlot = await pg.evaluate(() => Sona.activeKid().slot);
      await pg.evaluate(() => {
        Sona.addKid("Sibling", "4");
        Sona.saveProfile({ childName: "Sibling", childAge: "4", focusSounds: ["S"], onboarded: true, volume: 0, soundOn: false, voiceOn: false });
      });
      await pg.reload();
      ok("switching to a four-year-old recommends Simple play", (await visibleGroups(pg))[0] === "simple");
      ok("the younger sibling can still browse the full catalog", same(sorted(await visibleGames(pg)), allKeys));
      await pg.evaluate((slot) => Sona.switchKid(slot), firstSlot);
      await pg.reload();
      ok("switching back to an eight-year-old restores Arcade first", (await visibleGroups(pg))[0] === "arcade");
    } finally { await ctx.close(); }
  });

  await section("browse from Home without side effects", async () => {
    const { ctx, pg } = await fixture({ path: "/today.html" });
    try {
      const before = await state(pg);
      await pg.goto(BASE + "/activities.html");
      await pg.waitForURL(/\/today\.html(?:[?#]|$)/);
      await pg.locator("#activityGroups button[data-game]").last().scrollIntoViewIfNeeded();
      ok("browsing creates no practice, rewards, run, token or entitlement", same(await state(pg), before), { before, after: await state(pg) });
      // The books are on (26 Sep 2026); the adventure and chapter readers stay parked.
      const parked = await pg.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href")).filter((href) => /(?:chapter|story)\.html(?:[?#]|$)/.test(href)));
      ok("the play library has no parked reader links", parked.length === 0, parked);
    } finally { await ctx.close(); }
  });

  // every playable game's own route, so asked by a family with Premium: on
  // the free version a Premium card asks for a grown-up instead (below)
  await section("existing game launch routes", async () => {
    const { ctx, pg } = await fixture({ age: "4", premium: true });
    try {
      for (const key of playableKeys) {
        await pg.goto(BASE + "/activities.html");
        const button = pg.locator('#activityGroups button[data-game="' + key + '"]');
        if (!(await button.count())) { ok(key + ": launch card exists", false); continue; }
        await button.click();
        await pg.waitForURL(directKeys.includes(key) ? new RegExp("/arcade-" + key + "\\.html(?:[?#]|$)") : /\/charge\.html\?/);
        const url = new URL(pg.url());
        ok(key + ": launch follows the existing practice route",
          directKeys.includes(key) ? url.pathname === "/arcade-" + key + ".html"
            : url.pathname === "/charge.html" && url.searchParams.get("game") === "arcade-" + key + ".html"
              && url.searchParams.get("daily") !== "1", pg.url());
      }
    } finally { await ctx.close(); }
  });

  await section("paid-state browsing and child-safe gate", async () => {
    const { ctx, pg } = await fixture({ paid: true });
    try {
      // REWRITTEN 24 Sep 2026 (see the preview section): gated means Premium.
      ok("the expired-demo fixture really has Premium locked, and practice open",
        await pg.evaluate(() => Sona.gated("story") === true && Sona.gated("practice") === false && !Sona.premium()));
      const before = await state(pg);
      ok("a gated family can still browse all games", same(sorted(await visibleGames(pg)), allKeys));
      const locked = await pg.evaluate(() => Object.keys(Sona.GAME_ACTS).filter(key => !Sona.GAME_ACTS[key].comingSoon && !Sona.gameAccess(key).allowed));
      ok("the paid library keeps its playable free choices open", same(sorted(playableKeys.filter(key => !locked.includes(key))), freeKeys));
      for (const key of locked) {
        const button = pg.locator('#activityGroups button[data-game="' + key + '"]');
        if (!(await button.count())) { ok(key + ": launch card exists", false); continue; }
        await button.click();
        await pg.waitForTimeout(50);
        const stayed = new URL(pg.url()).pathname === "/today.html";
        ok(key + ": a gated click stays in the library instead of a paywall", stayed, pg.url());
        if (!stayed) { await pg.goto(BASE + "/activities.html"); continue; }
        const message = pg.locator("#libraryMessage");
        ok(key + ": a visible status tells the child a grown-up can help",
          await message.isVisible() && await message.getAttribute("role") === "status"
            && /grown[\s-]*up|parent|adult/i.test(await message.innerText()), await message.innerText());
      }
      ok("gated browsing does not grant access or create practice", same(await state(pg), before), { before, after: await state(pg) });
    } finally { await ctx.close(); }
  });

  // BOOKS ARE ON (Travis, 26 Sep 2026: "yes turn them on"), and since 30 Sep
  // 2026 the shelf opens for every family: "one book uh so like the letter r
  // book ... to be free and the rest is grayed out". The card always opens
  // it and says how many books are free; on the shelf a Premium book asks for
  // a grown-up (readtest plays that part).
  await section("the Books card", async () => {
    const free = await fixture();
    try {
      if (await free.pg.evaluate(() => Sona.isFree())) {
        await free.pg.locator("#booksCard").click();
        await free.pg.waitForURL(/\/library\.html(?:[?#]|$)/);
        ok("the Books card opens the bookshelf", new URL(free.pg.url()).pathname === "/library.html");
        ok("…which leads with the books: the adventure and Feed Echo tiles are hidden",
          await free.pg.locator("#shelf .bookBtn").count() > 0 && !await free.pg.locator("#advTile").isVisible() && !await free.pg.locator("#feedTile").isVisible());
      } else ok("the free release's Books test waits for a free release", true);
    } finally { await free.ctx.close(); }
    const { ctx, pg } = await fixture({ paid: true });
    try {
      const before = await state(pg);
      ok("a family without Premium sees how many books are free", /\b1 free book\b/.test(await pg.locator("#booksCard").innerText()), await pg.locator("#booksCard").innerText());
      await pg.locator("#booksCard").click();
      await pg.waitForURL(/\/library\.html(?:[?#]|$)/);
      await pg.waitForSelector("#shelf .bookBtn");
      const shelf = await pg.evaluate(() => [...document.querySelectorAll("#shelf .bookBtn")].map((b) => ({ t: b.querySelector(".bt").textContent, s: b.querySelector(".bs").textContent, locked: b.classList.contains("locked"), soon: b.classList.contains("soon") })));
      ok("…the card opens the bookshelf, where the free book reads and every other book that is out says Premium",
        shelf.some((b) => b.t === "Rory and the Rainbow" && !b.locked && !b.soon && b.s === "Free")
          && shelf.filter((b) => !b.soon && b.t !== "Rory and the Rainbow").length > 0
          && shelf.filter((b) => !b.soon && b.t !== "Rory and the Rainbow").every((b) => b.locked && b.s === "Premium"), JSON.stringify(shelf));
      ok("…without granting access or starting practice", same(await state(pg), before));
    } finally { await ctx.close(); }
    const owner = await fixture({ paid: true, premium: true });
    try {
      ok("a family with Premium sees the books Included", /Included/.test(await owner.pg.locator("#booksCard").innerText()), await owner.pg.locator("#booksCard").innerText());
    } finally { await owner.ctx.close(); }
  });

  await section("silent menus and immediate deliberate game choice", async () => {
    const { ctx, pg } = await fixture();
    try {
      await ctx.route("**/sona.js", route=>route.fulfill({contentType:"text/javascript", body:readFileSync(ROOT+"/sona.js","utf8") + `
        function menuSpeech(text){
          if(String(text||'').trim()){var calls=JSON.parse(sessionStorage.getItem('test.menuSpeech')||'[]');calls.push(String(text));sessionStorage.setItem('test.menuSpeech',JSON.stringify(calls));}
          return Promise.resolve();
        }
        Sona.speak=menuSpeech;Sona.speakNow=menuSpeech;
      `}));
      await pg.evaluate(()=>Sona.saveProfile({voiceOn:true,volume:0.5,soundOn:false}));
      await pg.reload();
      ok("the Home menu never narrates with voice enabled", await pg.evaluate(()=>JSON.parse(sessionStorage.getItem('test.menuSpeech')||'[]').length)===0);
      await ctx.route('**/arcade-feed.html',route=>route.fulfill({contentType:'text/html',body:'<p>Game destination</p>'}));
      await pg.locator('#activityGroups button[data-game="feed"]').click();
      await pg.waitForURL(/arcade-feed\.html/);
      ok("choosing a simple game opens its existing route directly", new URL(pg.url()).pathname==='/arcade-feed.html');
      ok("a game choice never speaks the card name in the menu", await pg.evaluate(()=>JSON.parse(sessionStorage.getItem('test.menuSpeech')||'[]').length)===0);
    }finally{await ctx.close();}
  });

  await section("the legacy library alias preserves navigation state", async () => {
    const {ctx,pg}=await fixture({path:'/activities.html?libraryPreview=1&locked=stack#games'});
    try {
      const url=new URL(pg.url());
      ok("the old library link resolves to Home with its full query and hash",url.pathname==='/today.html'&&url.searchParams.get('libraryPreview')==='1'&&url.searchParams.get('locked')==='stack'&&url.hash==='#games',url.href);
      ok("the redirected preview still explains the selected locked game",await pg.locator('#libraryNotice').isVisible()&&/Block Stacker/.test(await pg.locator('#libraryNotice').innerText()));
    }finally{await ctx.close();}
  });

  await section("keyboard browsing and launch", async () => {
    const { ctx, pg } = await fixture({ age: "8" });
    try {
      const first = pg.locator("#activityGroups button[data-game]").first();
      await first.focus(); await pg.keyboard.press("Tab");
      ok("Tab reaches the next game directly", await pg.locator("#activityGroups button[data-game]").nth(1).evaluate(el=>el===document.activeElement));
      const launch = pg.locator("#activityGroups button[data-game]:visible").first();
      const key = await launch.getAttribute("data-game");
      await launch.focus(); await pg.keyboard.press("Enter");
      await pg.waitForURL(/\/charge\.html\?/);
      ok("a focused game launches with Enter", new URL(pg.url()).searchParams.get("game") === "arcade-" + key + ".html", pg.url());
    } finally { await ctx.close(); }
  });

  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    await section("library fits " + viewport.width + "px", async () => {
      const { ctx, pg } = await fixture({ age: "8", viewport });
      try {
        const grids = await pg.locator("#activityGroups [data-group]").evaluateAll(groups => groups.map(group =>
          Array.from(group.querySelectorAll("button[data-game]")).map(el => {
            const r = el.getBoundingClientRect(), art = el.querySelector(".game-art")?.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height, artW: art?.width, artH: art?.height, parked: el.disabled };
          })));
        // The crafted reference uses landscape scenes and compact parked rows.
        // Protect readable/tappable cards without pinning decorative pixel values.
        ok(viewport.width + "px: playable cards have wide scene art and parked cards stay usable", grids.length === 2 && grids.every(tiles =>
          tiles.every(t => t.w >= 90 && t.h >= 44 && (t.parked ? t.artW >= 32 && t.artH >= 32 : t.artW > t.artH * 1.3 && t.artW > 80))), grids);
        const overflow = await pg.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
        ok(viewport.width + "px: library has no horizontal overflow", overflow <= 1, overflow);
        await pg.locator("#activityGroups button[data-game]:visible").last().scrollIntoViewIfNeeded();
        const last = await pg.locator("#activityGroups button[data-game]:visible").last().evaluate((el) => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { visible: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, reachable: hit === el || el.contains(hit) };
        });
        ok(viewport.width + "px: scrolling reaches the last game button", last.visible && last.reachable, last);
      } finally { await ctx.close(); }
    });
  }
} else {
  console.log("Library interaction checks await the missing page/content contract; prerequisite failures above remain failures.");
}
await browser.close();
await new Promise((resolve) => srv.close(resolve));
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
