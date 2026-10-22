// The play library offers every game, recommends a starting group by the
// active child's age, and never turns browsing into practice or a purchase.
import { createServer } from "http";
import { existsSync, readFileSync } from "fs";
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from "./_env.mjs";
import { open as phoneOpen } from "./_phone.mjs";
import { PARK, parkedSona, servePark } from "./_parked.mjs";

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
// Rise Up (9 Oct 2026) is a round game on the big kids' shelf, entered through
// its practice page like the five, but never in the adventure's deck.
const arcadeKeys = [...adventureKeys, "rise", ...sayBig].sort();
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
// younger kids"), and Peekaboo with the other seventeen on 22 Oct 2026
// (Travis: "turn on all 18 games"). The parked ones are read from the catalog.
const comingSoonKeys = [...SONA_SRC.matchAll(/^\s{4}(\w+): \{[^\n]*\bcomingSoon: true\b/gm)].map((m) => m[1]).sort();
// With none parked, the sections that pin what parking does park these
// again in the sona.js the browser is served (tests/_parked.mjs).
const parkKeys = [...PARK].sort();
// HIDDEN UNTIL IT OPENS (Travis, 19 Oct 2026, from a parent-funnel review:
// the greyed Coming soon cards cluttered Home). Home draws only these: every
// catalog game but the parked ones. The catalog itself still lists them all.
const homeKeys = allKeys.filter((key) => !comingSoonKeys.includes(key));
let playableKeys = [], freeKeys = [], premiumKeys = [];
const sorted = (values) => [...values].sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// unpark: catalog keys whose `comingSoon: true` is taken off their own line in
// the sona.js this browser is served, exactly the edit that opens a game.
function unparked(source, keys) {
  return keys.reduce((src, key) => {
    const next = src.replace(new RegExp("^(\\s{4}" + key + ": \\{[^\\n]*?)comingSoon: true, ", "m"), "$1");
    if (next === src) throw new Error("no parked line to open for " + key);
    return next;
  }, source);
}
// Ordinary families use the restored free release. The paid seam rehearses
// future locks without changing the release or granting a real entitlement.
async function fixture({ age = "4", paid = false, premium = false, viewport = { width: 390, height: 844 }, path = "/activities.html", origin = BASE, catalog = null, now = null, unpark = [], park = [] } = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const patch = url.pathname === "/sona.js" && (catalog || now !== null || unpark.length || park.length);
    if (origin === BASE && !patch) return route.continue();
    const file = ROOT + url.pathname;
    if (url.pathname.startsWith("/api/") || !existsSync(file)) return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    let body = readFileSync(file);
    if (url.pathname === "/sona.js" && park.length) body = parkedSona(body.toString(), park);
    if (url.pathname === "/sona.js" && unpark.length) body = unparked(body.toString(), unpark);
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
      // Home asks a grandfathered family for an idea on every third visit,
      // 0.9 s after it opens. The launch loop visits Home once per game, so a
      // slow machine met that sheet over a card (Soccer, 1 Oct 2026). It is
      // not this suite's subject: it starts already answered.
      localStorage.setItem("sona.pulse.v1", JSON.stringify({ cool: Date.now() + 365 * 24 * 3600 * 1000 }));
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
    const keys = Object.keys(localStorage).filter((key) => /^sona\.(?:profile|progress|tickets|charge|rotation|today|reps|coins|sub|trial|demo|slp|caseplan|founding|founder|pilot|rung|plan|trophy|road|chest|playlevel|board|buddyset)/.test(key)).sort();
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
  // the picker is Home's Arcade since 22 Oct 2026 (STORY1): Home leads with
  // today's story, and its Arcade door opens this (homestorytest)
  const { ctx, pg } = await fixture({ path: "/today.html?view=arcade" });
  try {
    hasContract = await pg.evaluate(() => typeof window.Sona?.activityLibrary === "function");
    ok("Sona provides the activity library content contract", hasContract);
    if (hasContract) {
      const games = await pg.evaluate(() => Sona.activityLibrary().groups.flatMap(group => group.games));
      playableKeys = games.filter(game => game.available && !game.comingSoon).map(game => game.key).sort();
      freeKeys = games.filter(game => game.available && !game.comingSoon && game.tier === "free").map(game => game.key).sort();
      premiumKeys = games.filter(game => game.available && !game.comingSoon && game.tier === "premium").map(game => game.key).sort();
      ok("Coming soon: exactly the catalog's parked lines (none since 22 Oct 2026)", same(games.filter(game => game.comingSoon).map(game => game.key).sort(), comingSoonKeys) && parkedSay.every((key) => sayLittle.includes(key) || sayBig.includes(key)), comingSoonKeys);
      ok("…so Peekaboo and every rebuilt Say & Play game is playable", ["peekaboo", ...sayLittle, ...sayBig].every((key) => playableKeys.includes(key)), playableKeys);
      ok("…and the six first games and Rise Up are never Coming soon", ["feed", ...adventureKeys, "rise"].every((key) => playableKeys.includes(key)), playableKeys);
    }
    ok("Home's Arcade presents the game picker, with a card for every game but the parked ones", await pg.getByRole("heading", {name:"Pick a game!",exact:true}).count() === 1 && await pg.locator("#activityGroups button[data-game]").count() === homeKeys.length, await pg.locator("#activityGroups button[data-game]").count());
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
        ok(label + ": the catalog still lists every game, the parked ones too", same(sorted(model.groups.flatMap((g) => g.games.map((game) => game.key))), allKeys));
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
      ok("Arcade contains the five earned arcade games, Rise Up and the ten Say & Play games for 5-8", same(sorted(arcade.games.map((g) => g.key)), arcadeKeys));
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
        ok("age " + age + ": Home shows every game but the parked ones", same(sorted(await visibleGames(pg)), homeKeys), await visibleGames(pg));
        const recommended = age === "4" ? "simple" : age == null ? null : "arcade";
        if (recommended) ok("age " + age + ": recommended cards render first", (await visibleGroups(pg))[0] === recommended);
        const games = await pg.evaluate(() => Sona.activityLibrary().groups.flatMap((g) => g.games));
        for (const game of games) {
          const button = pg.locator('#libraryApp button[data-game="' + game.key + '"]');
          const named = await pg.locator("#libraryApp").getByRole("button", { name: new RegExp(game.name, "i") }).count();
          if (game.comingSoon) ok("age " + age + ": " + game.name + ", Coming soon, has no card anywhere on Home", await button.count() === 0 && named === 0 && !(await pg.locator("#libraryApp").innerText()).includes(game.name));
          else ok("age " + age + ": " + game.name + " has one card, and it can be tapped",
            await pg.locator('#activityGroups button[data-game="' + game.key + '"]').count() === 1 && await pg.locator('#activityGroups button[data-game="' + game.key + '"]').isEnabled()
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
        const parked = await pg.evaluate(() => ({ disabled: document.querySelectorAll("#libraryApp button[data-game]:disabled").length,
          coming: /coming soon|coming [a-z]{3} \d/i.test(document.getElementById("libraryApp").innerText), shelves: document.querySelectorAll("#comingGroups,.coming-all,.coming-shelf,.coming-grid,.is-coming").length }));
        ok("age " + age + ": Home has no Coming soon section, label or greyed-out card", parked.disabled === 0 && !parked.coming && parked.shelves === 0, parked);
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
      // a Limited time row only ever holds something real (the Halloween book this October)
      ok("the catalog does not invent an empty seasonal shelf", Array.isArray(initial.featured) && initial.featured.filter((group) => group.id === "seasonal").every((group) => group.games.length > 0));
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
          Sona.GAME_ACTS.peekaboo.comingSoon = true;
          const comingSoon = snapshot();
          return { fresh, seasonal, start, end, expired, unavailable, comingSoon };
        } finally {
          const original = JSON.parse(saved);
          Object.keys(Sona.GAME_ACTS).forEach((key) => { Sona.GAME_ACTS[key] = original[key]; });
        }
      });
      const featuredKeys = (model, id) => sorted((model.featured || []).find((group) => group.id === id)?.games.map((game) => game.key) || []);
      ok("New includes today and day 29 but excludes day 30, future and invalid release dates", same(featuredKeys(samples.fresh, "new"), ["feed", "run"]), samples.fresh.featured);
      ok("Coming soon titles cannot appear as New or seasonal releases", samples.comingSoon.featured.flatMap(group => group.games).some(game => game.key === "bubbles") && !samples.comingSoon.featured.flatMap(group => group.games).some(game => game.key === "peekaboo"));
      ok("seasonal shelves include both date boundaries and omit future or expired seasons", same(featuredKeys(samples.seasonal, "seasonal"), ["feed", "run", "tiles"]), samples.seasonal.featured);
      ok("release and season dates use the same whole UTC day", same(samples.start.featured, samples.end.featured), { start: samples.start.featured, end: samples.end.featured });
      ok("an expired seasonal shelf disappears instead of remaining empty", !(samples.expired.featured || []).some((group) => group.id === "seasonal"), samples.expired.featured);
      ok("unavailable games cannot appear in either age groups or featured shelves", !samples.unavailable.groups.flatMap((group) => group.games).some((game) => game.key === "feed") && !(samples.unavailable.featured || []).flatMap((group) => group.games).some((game) => game.key === "feed"));
      ok("catalog date checks do not change family progress or access", same(await state(pg), before));
    } finally { await ctx.close(); }
  });

  // Parked games carried a Friday each from 9 Oct 2026 (three a week, 16 Oct
  // to 20 Nov). Since 15 Oct 2026 (Travis: "put coming soon") none does, and
  // since 19 Oct 2026 Home draws no parked game at all; since 22 Oct none is
  // parked, so this section parks four again (tests/_parked.mjs). The catalog
  // still lists them (a typed address to one bounces home with "<Game> is coming soon"),
  // and the day support stays as a label: a `comingOn` on one line makes that
  // note say "coming Nov 6" until the day. A day never opens anything, nor
  // draws a card: only taking comingSoon off does.
  await section("parked games stay off Home", async () => {
    const parkedLines = [...SONA_SRC.matchAll(/^\s{4}(\w+): \{[^\n]*\bcomingSoon: true\b[^\n]*/gm)].map((m) => ({ key: m[1], line: m[0] }));
    ok("no game is parked in the catalog since 22 Oct 2026, and none carries a day",
      parkedLines.length === 0 && same(comingSoonKeys, []) && !/^\s{4}\w+: \{[^\n]*\bcomingOn\b/m.test(SONA_SRC), parkedLines.map((p) => p.key));
    const rebuilt = [...SONA_SRC.matchAll(/^\s{4}(soccer|dino): \{ name: [^\n]*/gm)].map((m) => m[0]);
    ok("…and Soccer Goal and Dino Dig, rebuilt, carry no day and are not parked", rebuilt.length === 2 && rebuilt.every((line) => !/\bcomingSoon\b|\bcomingOn\b/.test(line)), rebuilt);
    const cardsAt = async (now, opts = {}) => {
      const { ctx, pg, errors } = await fixture({ now, park: PARK, ...opts });
      try {
        const got = await pg.evaluate((parkedKeys) => {
          const tag = (key) => { const b = document.querySelector('#activityGroups button[data-game="' + key + '"]'); return b ? { label: b.querySelector(".game-access").textContent, disabled: b.disabled } : null; };
          const lib = Sona.activityLibrary();
          return { cards: parkedKeys.filter((k) => document.querySelector('#libraryApp [data-game="' + k + '"]')),
            coming: /coming soon|coming [a-z]{3} \d/i.test(document.getElementById("libraryApp").innerText),
            catalog: lib.groups.flatMap((g) => g.games.filter((y) => y.comingSoon).map((y) => y.key)).sort(),
            soccer: tag("soccer"), dino: tag("dino"), access: Sona.gameAccess("peekaboo") };
        }, parkKeys);
        return { got, errors };
      } finally { await ctx.close(); }
    };
    for (const [when, now] of [["on 15 Oct", Date.UTC(2026, 9, 15, 12)], ["on 9 Oct", Date.UTC(2026, 9, 9, 12)], ["past 20 Nov", Date.UTC(2026, 10, 21, 12)]]) {
      for (const [who, opts] of [["the free version", {}], ["a family without Premium", { paid: true }], ["a family with Premium", { paid: true, premium: true }]]) {
        const r = await cardsAt(now, opts);
        ok(when + ", " + who + ": no parked game has a card on Home, and nothing says Coming soon", r.got.cards.length === 0 && !r.got.coming, r.got.cards);
        ok("…while the catalog still lists the parked ones, and none opens", same(r.got.catalog, parkKeys) && r.got.access.allowed === false && r.got.access.reason === "coming-soon", JSON.stringify([r.got.catalog.length, r.got.access]));
        ok("…and Soccer Goal and Dino Dig, rebuilt, are on Home with no day on them", [r.got.soccer, r.got.dino].every((g) => !!g && !g.disabled && !/Coming/.test(g.label)), JSON.stringify([r.got.soccer, r.got.dino]));
        ok("…with no page errors", r.errors.length === 0, r.errors);
      }
    }
    // a typed address to a parked game still lands on Home with its note
    for (const key of ["peekaboo", "racecar", "balloon"]) {
      const { ctx, pg } = await fixture({ path: "/arcade-" + key + ".html", park: PARK });
      try {
        await pg.waitForURL(/\/today\.html\?locked=/);
        const name = await pg.evaluate((k) => Sona.GAME_ACTS[k].name, key);
        const note = pg.locator("#libraryMessage");
        await note.waitFor({ state: "visible" });
        ok(key + ": a typed address bounces home with \"" + name + " is coming soon\", no unlock button and still no card",
          (await note.innerText()) === name + " is coming soon. Pick another game to play." && !(await pg.locator("#libraryUnlock").isVisible()) && await pg.locator('#libraryApp [data-game="' + key + '"]').count() === 0, await note.innerText());
      } finally { await ctx.close(); }
    }
    // the day support still works for a game given one on its own line: the
    // catalog's label, and the bounce note that reads it
    const { ctx, pg } = await fixture({ now: Date.UTC(2026, 9, 15, 12), park: PARK });
    try {
      const d = await pg.evaluate(() => {
        const saved = Sona.GAME_ACTS.puppy.comingOn;
        try {
          Sona.GAME_ACTS.puppy.comingOn = "2026-11-06";
          const pick = (lib) => { const g = lib.groups.find((x) => x.games.some((y) => y.key === "puppy")); const parked = g.games.filter((y) => y.comingSoon); return { label: parked.find((y) => y.key === "puppy").comingLabel, first: parked[0].key }; };
          return { before: pick(Sona.activityLibrary({ now: Date.UTC(2026, 9, 15, 12) })), after: pick(Sona.activityLibrary({ now: Date.UTC(2026, 10, 7, 12) })), access: Sona.gameAccess("puppy") };
        } finally { if (saved === undefined) delete Sona.GAME_ACTS.puppy.comingOn; else Sona.GAME_ACTS.puppy.comingOn = saved; }
      });
      ok("a day set on one line still shows (\"Coming Nov 6\", first of the parked games) until it comes, then \"Coming soon\"",
        d.before.label === "Coming Nov 6" && d.before.first === "puppy" && d.after.label === "Coming soon", JSON.stringify(d));
      ok("…and the day never opens it", d.access.allowed === false && d.access.reason === "coming-soon", JSON.stringify(d.access));
    } finally { await ctx.close(); }
    const dated = await fixture({ path: "/today.html?locked=puppy", catalog: { puppy: { comingOn: "2026-11-06" } }, now: Date.UTC(2026, 9, 15, 12), park: PARK });
    try {
      const note = dated.pg.locator("#libraryMessage");
      await note.waitFor({ state: "visible" });
      ok("…its bounce note says the day (\"Puppy Bath is coming Nov 6.\"), and still no card is drawn",
        (await note.innerText()) === "Puppy Bath is coming Nov 6. Pick another game to play." && await dated.pg.locator('#libraryApp [data-game="puppy"]').count() === 0, await note.innerText());
    } finally { await dated.ctx.close(); }
  });

  // Taking comingSoon off a game's own line opens it exactly as a rebuilt
  // game opened before: its card is back on its own shelf, in catalog order,
  // and a tap plays it (with Premium) or asks for it (without).
  await section("opening a parked game brings its card back", async () => {
    for (const [key, group] of [["racecar", "arcade"], ["balloon", "simple"]]) {
      const { ctx, pg, errors } = await fixture({ age: group === "simple" ? "4" : "8", premium: true, park: PARK, unpark: [key] });
      try {
        const got = await pg.evaluate((k) => {
          const b = document.querySelector('#activityGroups button[data-game="' + k + '"]');
          const shelf = b && b.closest("[data-group]");
          const order = shelf ? [...shelf.querySelectorAll("button[data-game]")].map((x) => x.dataset.game) : [];
          return { here: !!b, enabled: !!b && !b.disabled, group: shelf && shelf.dataset.group, label: b ? b.querySelector(".game-access").textContent : "",
            order, catalog: Sona.activityLibrary().groups.find((g) => g.id === (shelf && shelf.dataset.group)).games.filter((g) => !g.comingSoon).map((g) => g.key),
            access: Sona.gameAccess(k), coming: /coming soon/i.test(document.getElementById("libraryApp").innerText) };
        }, key);
        ok(key + " opened: its card is back on the " + group + " shelf, tappable, in the catalog's order, labelled like any game", got.here && got.enabled && got.group === group && same(got.order, got.catalog) && got.label === "Included" && got.access.allowed, JSON.stringify(got));
        ok("…while the other parked games stay off Home", await pg.evaluate((keys) => keys.filter((k) => document.querySelector('#libraryApp [data-game="' + k + '"]')), parkKeys.filter((k) => k !== key)).then((left) => left.length === 0));
        await ctx.route("**/arcade-" + key + ".html*", (route) => route.fulfill({ contentType: "text/html", body: "<p>" + key + "</p>" }));
        await pg.locator('#activityGroups button[data-game="' + key + '"]').click();
        await pg.waitForURL(new RegExp("/arcade-" + key + "\\.html"));
        ok("…and a tap plays it, by its own route", new URL(pg.url()).pathname === "/arcade-" + key + ".html", pg.url());
        ok("…with no page errors", errors.length === 0, errors);
      } finally { await ctx.close(); }
    }
  });

  await section("featured cards are extra working choices", async () => {
    const catalog = Object.fromEntries(allKeys.map((key) => [key, { releasedOn: "2000-01-01", season: null }]));
    catalog.feed.releasedOn = catalog.slice.releasedOn = "2028-04-30";
    const { ctx, pg } = await fixture({ catalog, now: Date.UTC(2028, 3, 30, 12) });
    try {
      const featured = pg.locator("#featuredGroups");
      ok("daily picks replace the New shelf without inventing releases", await featured.locator('[data-collection="picks"] button[data-game]').count() === 2 && await featured.locator('[data-collection="new"]').count() === 0);
      ok("featured cards leave every game Home shows once in the age groups", same(sorted(await visibleGames(pg)), homeKeys));
      const shelf = await featured.locator("button[data-game]").evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
      ok("daily picks share a horizontal shelf", shelf.length === 2 && Math.abs(shelf[0].y - shelf[1].y) < 2 && shelf[1].x > shelf[0].x, shelf);
      const button = featured.locator('button[data-game="feed"],button[data-game="bubbles"]').first();
      if (await button.count()) {
        await button.click();
        await pg.waitForURL(/\/arcade-(?:feed|bubbles)\.html(?:[?#]|$)/);
        ok("a featured game opens its existing route", /\/arcade-(?:feed|bubbles)\.html$/.test(new URL(pg.url()).pathname));
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
      ok("an older cached catalog still renders every game choice (and still no parked one)", same(sorted(await visibleGames(pg)), homeKeys));
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
      ok("the younger sibling can still browse every game Home shows", same(sorted(await visibleGames(pg)), homeKeys));
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
      ok("a gated family can still browse every game Home shows (no parked one)", same(sorted(await visibleGames(pg)), homeKeys));
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

  // Every shelf, measured: each row of cards runs from the shelf's left edge
  // to its right, so no row ends on an empty slot. Today's catalog, and the
  // day one parked game opens on each shelf (an odd count on a phone, one left
  // over on an iPad) or two on the big kids' (two left over on an iPad).
  async function shelfRows(pg) {
    return pg.evaluate(() => [...document.querySelectorAll("#activityGroups [data-group]")].map((section) => {
      const grid = section.querySelector(".game-grid"), g = grid.getBoundingClientRect();
      const rows = [];
      [...grid.querySelectorAll("button[data-game]")].forEach((el) => {
        const r = el.getBoundingClientRect(), art = el.querySelector(".game-art")?.getBoundingClientRect();
        let row = rows.find((x) => Math.abs(x.top - r.top) < 2);
        if (!row) { row = { top: r.top, cards: [] }; rows.push(row); }
        row.cards.push({ key: el.dataset.game, x: r.x, w: r.width, h: r.height, artW: art?.width, artH: art?.height });
      });
      return { group: section.dataset.group, left: g.left, right: g.right, rows: rows.map((row) => ({ left: Math.min(...row.cards.map((c) => c.x)), right: Math.max(...row.cards.map((c) => c.x + c.w)), cards: row.cards })) };
    }));
  }
  const fullRows = (shelves) => shelves.every((s) => s.rows.length > 0 && s.rows.every((r) => Math.abs(r.left - s.left) <= 1.5 && Math.abs(r.right - s.right) <= 1.5));
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
    await section("library fits " + viewport.width + "px", async () => {
      const { ctx, pg } = await fixture({ age: "8", viewport });
      try {
        const shelves = await shelfRows(pg);
        const tiles = shelves.flatMap((s) => s.rows.flatMap((r) => r.cards));
        // The crafted reference uses landscape scenes. Protect readable,
        // tappable cards without pinning decorative pixel values.
        ok(viewport.width + "px: every card has wide scene art", shelves.length === 2 && tiles.length === homeKeys.length && tiles.every(t => t.w >= 90 && t.h >= 44 && t.artW > t.artH * 1.3 && t.artW > 80), tiles);
        ok(viewport.width + "px: every row of every shelf is full, with no empty slot", fullRows(shelves), JSON.stringify(shelves.map((s) => ({ group: s.group, left: s.left, right: s.right, rows: s.rows.map((r) => [r.left, r.right, r.cards.map((c) => c.key).join(" ")]) }))));
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
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    for (const unpark of [["racecar"], ["balloon"], ["racecar", "treasure"]]) {
      // treasure is parked too here, so two can open on the big kids' shelf
      const park = [...PARK, "treasure"];
      await section("library fits " + viewport.width + "px with " + unpark.join(" and ") + " opened", async () => {
        const { ctx, pg } = await fixture({ age: "8", viewport, park, unpark });
        try {
          const shelves = await shelfRows(pg);
          const keys = shelves.flatMap((s) => s.rows.flatMap((r) => r.cards.map((c) => c.key)));
          ok(viewport.width + "px, " + unpark.join(" and ") + " opened: each is on its shelf, and every row is still full",
            unpark.every((k) => keys.includes(k)) && keys.length === homeKeys.length - park.length + unpark.length && fullRows(shelves), JSON.stringify(shelves.map((s) => s.rows.map((r) => [Math.round(r.left), Math.round(r.right), r.cards.map((c) => c.key).join(" ")]))));
        } finally { await ctx.close(); }
      });
    }
  }

  // The plan screen never offers a parked game either. A tap on a grey game
  // opens it as "Unlock <that game>, and every other game", with the game's
  // own picture; Home has no card for a parked game, and Premium does not
  // open one, so a typed ?from=<parked game> is Settings › Your plan instead.
  // On the iPhone app with the purchase plugin (the shared fake phone), for a
  // family who owes the price, beside a real grey game as the control.
  await section("the plan screen never offers a parked game", async () => {
    const look = async (from) => {
      const f = await phoneOpen(browser, BASE, { app: "buy", stamp: "post", setUp: true });
      try {
        await servePark(f.context, ROOT);
        await f.page.goto(BASE + "/subscribe.html?from=" + from);
        await f.page.waitForFunction(() => /\$/.test((document.getElementById("iapCard") || {}).innerText || ""), null, { timeout: 8000 });
        return await f.page.evaluate((key) => ({
          offer: document.body.classList.contains("offer"),
          title: (document.getElementById("offerTitle") || {}).textContent || "",
          art: [...document.querySelectorAll("#offerArt img")].map((i) => i.getAttribute("src")),
          name: Sona.GAME_ACTS[key].name,
          said: document.body.innerText,
          url: location.pathname,
        }), from).then((s) => Object.assign(s, { errors: f.errors }));
      } finally { await f.context.close(); }
    };
    const grey = await look("stack");
    ok("control: a grey game (?from=stack) opens the offer, named and pictured", grey.offer && grey.title.includes(grey.name) && grey.art.some((a) => /home-stack\.webp/.test(a)), JSON.stringify([grey.offer, grey.title, grey.art]));
    for (const key of ["racecar", "balloon", "peekaboo"]) {
      const s = await look(key);
      ok("a typed ?from=" + key + " is Settings › Your plan: no offer, the game named nowhere, its picture nowhere",
        s.url === "/subscribe.html" && !s.offer && !s.said.includes(s.name) && !s.art.some((a) => a.includes("home-" + key)), JSON.stringify([s.url, s.offer, s.title, s.art]));
      ok("…with no page errors", s.errors.length === 0, s.errors);
    }
  });
} else {
  console.log("Library interaction checks await the missing page/content contract; prerequisite failures above remain failures.");
}
await browser.close();
await new Promise((resolve) => srv.close(resolve));
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
