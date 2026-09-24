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
const simpleKeys = ["bubbles", "feed", "peekaboo"];
const arcadeKeys = ["glide", "run", "slice", "stack", "tiles"];
const allKeys = [...simpleKeys, ...arcadeKeys].sort();
const sorted = (values) => [...values].sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function fixture({ age = "4", paid = false, viewport = { width: 390, height: 844 }, path = "/activities.html", origin = BASE, catalog = null, now = null } = {}) {
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
  await ctx.addInitScript(({ age, paid }) => {
    if (!localStorage.getItem("sona.test.librarySeed")) {
      localStorage.setItem("sona.test.librarySeed", "1");
      localStorage.setItem("sona.freeera.v1", "post");
      localStorage.setItem("sona.freeera2.v1", "done");
      localStorage.setItem("sona.freeera3.v1", "done");
      const profile = { childName: "Mia", focusSounds: ["S"], onboarded: true, volume: 0, voiceOn: false, soundOn: false };
      if (age !== null) profile.childAge = age;
      localStorage.setItem("sona.profile.v1", JSON.stringify(profile));
      if (paid) {
        sessionStorage.setItem("sona.paidui", "1");
        localStorage.setItem("sona.demo.v1", JSON.stringify({ started: Date.now() - 100 * 3600000, done: Date.now() - 90000 }));
      }
    }
  }, { age, paid });
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
    const keys = Object.keys(localStorage).filter((key) => /^sona\.(?:profile|progress|tickets|charge|rotation|today|reps|coins|sub|trial|demo|slp|founder|pilot|rung|plan)/.test(key)).sort();
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
    const browse = pg.locator("#libBtn");
    const count = await browse.count();
    ok("Home offers a browse-games link", count === 1, count);
    if (count) {
      const href = await browse.getAttribute("href");
      ok("Home's browse link opens the play library", new URL(href, BASE).pathname === "/activities.html", href);
    }
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
        ok(label + ": all eight games remain available", same(sorted(model.groups.flatMap((g) => g.games.map((game) => game.key))), allKeys));
        ok(label + ": only the recommended group is marked",
          model.groups.every((g) => g.recommended === (g.id === recommended)), model.groups.map((g) => ({ id: g.id, recommended: g.recommended })));
        if (recommended) ok(label + ": the recommended group comes first", model.groups[0]?.id === recommended, model.groups.map((g) => g.id));
      }
      const model = await pg.evaluate(() => Sona.activityLibrary());
      const simple = model.groups.find((g) => g.id === "simple");
      const arcade = model.groups.find((g) => g.id === "arcade");
      ok("Simple play contains Feed Echo, Bubble Pop and Peekaboo", same(sorted(simple.games.map((g) => g.key)), simpleKeys));
      ok("the daily adventure remains five arcade games", same(sorted(await pg.evaluate(() => Sona.adventureGames())), arcadeKeys));
      ok("Arcade contains the five earned arcade games", same(sorted(arcade.games.map((g) => g.key)), arcadeKeys));
      ok("Simple play presents the suggested 3–4 range", simple.ageLabel === "Suggested ages 3–4", simple.ageLabel);
      ok("Arcade presents the suggested 5–8 range", arcade.ageLabel === "Suggested ages 5–8", arcade.ageLabel);
      ok("every game has explicit catalog metadata",
        model.groups.every((g) => g.games.every((game) => ["free", "premium"].includes(game.tier)
          && Object.hasOwn(game, "releasedOn") && (game.releasedOn === null || /^\d{4}-\d{2}-\d{2}$/.test(game.releasedOn)) && game.available === true)));
      ok("each suggested age group includes two proposed free games", model.groups.every((g) => g.games.filter((game) => game.tier === "free").length === 2));
      ok("the proposed free games are Feed Echo, Bubble Pop, Fruit Slice and Block Stacker",
        same(sorted(model.groups.flatMap((g) => g.games.filter((game) => game.tier === "free").map((game) => game.key))), ["bubbles", "feed", "slice", "stack"]));
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
        ok("age " + age + ": All games initially shows eight games", same(sorted(await visibleGames(pg)), allKeys));
        const recommended = age === "4" ? "simple" : age == null ? null : "arcade";
        if (recommended) ok("age " + age + ": recommended cards render first", (await visibleGroups(pg))[0] === recommended);
        const games = await pg.evaluate(() => Sona.activityLibrary().groups.flatMap((g) => g.games));
        for (const game of games) {
          const button = pg.locator('#activityGroups button[data-game="' + game.key + '"]');
          ok("age " + age + ": " + game.name + " has an accessible, enabled launch button",
            await button.count() === 1 && await button.isEnabled()
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
        const cards = await pg.locator("#activityGroups button[data-game]").allInnerTexts();
        const isFree = await pg.evaluate(() => Sona.isFree());
        if (isFree) ok("age " + age + ": normal free access is labeled Free on every card", cards.every((text) => /\bFree\b/.test(text) && !/\bPremium\b/.test(text)), cards);
        ok("age " + age + ": proposed tier preview stays hidden by default", !await pg.locator("#catalogPreviewNotice").isVisible());
        const books = pg.locator("#booksComingSoon");
        ok("age " + age + ": books have a visible Coming soon section", await books.isVisible() && /books/i.test(await books.innerText()) && /coming soon/i.test(await books.innerText()));
        ok("age " + age + ": parked books offer no action or reader link", await books.locator('a,button,[role="button"],input,select,textarea').count() === 0);
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
          Sona.GAME_ACTS.bubbles.releasedOn = "2028-04-01";
          Sona.GAME_ACTS.peekaboo.releasedOn = "2028-03-31";
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
          return { fresh, seasonal, start, end, expired, unavailable };
        } finally {
          const original = JSON.parse(saved);
          Object.keys(Sona.GAME_ACTS).forEach((key) => { Sona.GAME_ACTS[key] = original[key]; });
        }
      });
      const featuredKeys = (model, id) => sorted((model.featured || []).find((group) => group.id === id)?.games.map((game) => game.key) || []);
      ok("New includes today and day 29 but excludes day 30, future and invalid release dates", same(featuredKeys(samples.fresh, "new"), ["bubbles", "feed"]), samples.fresh.featured);
      ok("seasonal shelves include both date boundaries and omit future or expired seasons", same(featuredKeys(samples.seasonal, "seasonal"), ["feed", "run", "tiles"]), samples.seasonal.featured);
      ok("release and season dates use the same whole UTC day", same(samples.start.featured, samples.end.featured), { start: samples.start.featured, end: samples.end.featured });
      ok("an expired seasonal shelf disappears instead of remaining empty", !(samples.expired.featured || []).some((group) => group.id === "seasonal"), samples.expired.featured);
      ok("unavailable games cannot appear in either age groups or featured shelves", !samples.unavailable.groups.flatMap((group) => group.games).some((game) => game.key === "feed") && !(samples.unavailable.featured || []).flatMap((group) => group.games).some((game) => game.key === "feed"));
      ok("catalog date checks do not change family progress or access", same(await state(pg), before));
    } finally { await ctx.close(); }
  });

  await section("featured cards are extra working choices", async () => {
    const catalog = Object.fromEntries(allKeys.map((key) => [key, { releasedOn: "2000-01-01", season: null }]));
    catalog.bubbles.releasedOn = catalog.peekaboo.releasedOn = "2028-04-30";
    const { ctx, pg } = await fixture({ catalog, now: Date.UTC(2028, 3, 30, 12) });
    try {
      const featured = pg.locator("#featuredGroups");
      ok("the New shelf shows only the two current releases", same(sorted(await featured.locator("button[data-game]").evaluateAll((els) => els.map((el) => el.dataset.game))), ["bubbles", "peekaboo"]));
      ok("featured cards leave eight unique games in the age groups", same(sorted(await visibleGames(pg)), allKeys));
      const shelf = await featured.locator("button[data-game]").evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
      ok("featured cards share a horizontal shelf", shelf.length === 2 && Math.abs(shelf[0].y - shelf[1].y) < 2 && shelf[1].x > shelf[0].x, shelf);
      const button = featured.locator('button[data-game="peekaboo"]');
      if (await button.count()) {
        await button.click();
        await pg.waitForURL(/\/arcade-peekaboo\.html(?:[?#]|$)/);
        ok("a featured game opens its existing route", new URL(pg.url()).pathname === "/arcade-peekaboo.html");
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
        const cards = await pg.locator("#activityGroups button[data-game]").allInnerTexts();
        if (local) {
          const copy = await notice.count() ? await notice.innerText() : "";
          ok(origin + ": preview explains that purchases and game access do not change", /preview/i.test(copy) && /no purchases/i.test(copy) && /all games|available games/i.test(copy), copy);
          ok(origin + ": proposed Free and Premium labels appear without disabling cards", cards.filter((text) => /\bFree\b/.test(text)).length === 4 && cards.filter((text) => /\bPremium\b/.test(text)).length === 4 && await pg.locator("#activityGroups button[data-game]:disabled").count() === 0, cards);
        } else if (access.free) ok("a public host ignores the preview URL and keeps current Free labels", cards.every((text) => /\bFree\b/.test(text) && !/\bPremium\b/.test(text)), cards);
        ok(origin + ": the preview has no purchase link or button", await pg.locator('#libraryApp a[href*="subscribe"],#libraryApp a[href*="checkout"]').count() === 0 && await pg.getByRole("button", { name: /buy|subscribe|purchase|upgrade/i }).count() === 0);
        ok(origin + ": preview does not change current access decisions", same(await pg.evaluate(() => ({ free: Sona.isFree(), gated: Sona.gated("practice") })), access));
        ok(origin + ": preview creates no entitlement, plan impression or practice state", same(await state(pg), before), { before, after: await state(pg) });
        if (local && !access.gated) {
          await pg.locator('#activityGroups button[data-game="peekaboo"]').click();
          await pg.waitForURL(/\/arcade-peekaboo\.html(?:[?#]|$)/);
          ok(origin + ": a proposed Premium game remains playable with current access", new URL(pg.url()).pathname === "/arcade-peekaboo.html");
        }
      } finally { await ctx.close(); }
    });
  }

  await section("preview cannot bypass the existing paid gate", async () => {
    const { ctx, pg } = await fixture({ paid: true, path: "/activities.html?libraryPreview=1" });
    try {
      const before = await state(pg);
      ok("preview leaves an expired paid-state family gated", await pg.evaluate(() => Sona.gated("practice")) === true);
      await pg.locator('#activityGroups button[data-game="feed"]').click();
      ok("a proposed Free label cannot grant access through the preview", new URL(pg.url()).pathname === "/activities.html" && await pg.locator("#libraryMessage").isVisible());
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
      ok("an older cached catalog still renders all eight game choices", same(sorted(await visibleGames(pg)), allKeys));
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
      ok("the younger sibling can still choose every game", same(sorted(await visibleGames(pg)), allKeys));
      await pg.evaluate((slot) => Sona.switchKid(slot), firstSlot);
      await pg.reload();
      ok("switching back to an eight-year-old restores Arcade first", (await visibleGroups(pg))[0] === "arcade");
    } finally { await ctx.close(); }
  });

  await section("browse from Home without side effects", async () => {
    const { ctx, pg } = await fixture({ path: "/today.html" });
    try {
      const before = await state(pg);
      await pg.locator("#libBtn").click();
      await pg.waitForURL(/\/activities\.html(?:[?#]|$)/);
      await pg.locator("#activityGroups button[data-game]").last().scrollIntoViewIfNeeded();
      ok("browsing creates no practice, rewards, run, token or entitlement", same(await state(pg), before), { before, after: await state(pg) });
      const parked = await pg.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href")).filter((href) => /(?:chapter|story|library)\.html(?:[?#]|$)/.test(href)));
      ok("the play library has no parked reader links", parked.length === 0, parked);
    } finally { await ctx.close(); }
  });

  await section("existing game launch routes", async () => {
    const { ctx, pg } = await fixture({ age: "4" });
    try {
      for (const key of allKeys) {
        await pg.goto(BASE + "/activities.html");
        const button = pg.locator('#activityGroups button[data-game="' + key + '"]');
        if (!(await button.count())) { ok(key + ": launch card exists", false); continue; }
        await button.click();
        await pg.waitForURL(simpleKeys.includes(key) ? new RegExp("/arcade-" + key + "\\.html(?:[?#]|$)") : /\/charge\.html\?/);
        const url = new URL(pg.url());
        ok(key + ": launch follows the existing practice route",
          simpleKeys.includes(key) ? url.pathname === "/arcade-" + key + ".html"
            : url.pathname === "/charge.html" && url.searchParams.get("game") === "arcade-" + key + ".html"
              && url.searchParams.get("daily") !== "1", pg.url());
      }
    } finally { await ctx.close(); }
  });

  await section("paid-state browsing and child-safe gate", async () => {
    const { ctx, pg } = await fixture({ paid: true });
    try {
      ok("the expired-demo fixture really is gated", await pg.evaluate(() => Sona.gated("practice")) === true);
      const before = await state(pg);
      ok("a gated family can still browse all games", same(sorted(await visibleGames(pg)), allKeys));
      for (const key of allKeys) {
        const button = pg.locator('#activityGroups button[data-game="' + key + '"]');
        if (!(await button.count())) { ok(key + ": launch card exists", false); continue; }
        await button.click();
        await pg.waitForTimeout(50);
        const stayed = new URL(pg.url()).pathname === "/activities.html";
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

  await section("spoken choices stop safely when the app is hidden", async () => {
    const { ctx, pg } = await fixture();
    try {
      await ctx.route("**/sona.js", route=>route.fulfill({contentType:"text/javascript", body:readFileSync(ROOT+"/sona.js","utf8") + `
        window.__librarySpeech=[]; window.__voiceEnds=[];
        Sona.speak=function(text){__librarySpeech.push(text);return Promise.resolve();};
        Sona.speakNow=function(text){__librarySpeech.push(text);return new Promise(resolve=>__voiceEnds.push(resolve));};
        Object.defineProperty(document,'hidden',{configurable:true,get:function(){return !!window.__libraryHidden;}});
      `}));
      await pg.evaluate(()=>Sona.saveProfile({voiceOn:true,volume:0.5,soundOn:false}));
      await pg.reload();
      ok("Echo says the short library invitation", await pg.evaluate(()=>__librarySpeech.includes("Pick a game!")));
      const pick=pg.locator('#activityGroups button[data-game="bubbles"]');
      await pick.click();
      if(new URL(pg.url()).pathname!=='/activities.html'){ok("the spoken choice stays in the library until its voice finishes",false,pg.url());return;}
      ok("a tapped game speaks its name without child data", await pg.evaluate(()=>__librarySpeech.includes("Bubble Pop") && !__librarySpeech.some(t=>/Mia/.test(t))));
      await pg.evaluate(()=>{window.__libraryHidden=true;document.dispatchEvent(new Event('visibilitychange'));});
      await pg.waitForTimeout(1500);
      ok("backgrounding cancels the delayed launch", new URL(pg.url()).pathname==='/activities.html',pg.url());
      await pg.evaluate(()=>{window.__libraryHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
      await ctx.route('**/arcade-peekaboo.html',route=>route.fulfill({contentType:'text/html',body:'<p>Game destination</p>'}));
      await pg.locator('#activityGroups button[data-game="peekaboo"]').click();
      await pg.evaluate(()=>__voiceEnds.forEach(end=>end()));
      await pg.waitForURL(/arcade-peekaboo\.html/);
      ok("stale voice completion cannot override the latest choice", new URL(pg.url()).pathname==='/arcade-peekaboo.html');
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
            return { x: r.x, y: r.y, w: r.width, h: r.height, artW: art?.width, artH: art?.height };
          })));
        ok(viewport.width + "px: each age group uses the intended grid with square art", grids.length === 2 && grids.every(tiles =>
          tiles.filter(t => Math.abs(t.y - tiles[0].y) < 2).length === Math.min(tiles.length, viewport.width >= 600 ? 3 : 2)
          && tiles.every(t => Math.abs(t.artW - t.artH) < 2 && t.artW > 80)), grids);
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
