// The play library offers every game, recommends a starting group by the
// active child's age, and never turns browsing into practice or a purchase.
import { createServer } from "http";
import { existsSync, readFileSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

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
const allKeys = ["feed", "glide", "run", "slice", "stack", "tiles"];
const sorted = (values) => [...values].sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function fixture({ age = "4", paid = false, viewport = { width: 390, height: 844 }, path = "/activities.html" } = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route("**/*", (route) => route.request().url().startsWith(BASE + "/") ? route.continue() : route.abort());
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
  const pg = await ctx.newPage();
  const errors = [];
  pg.on("pageerror", (error) => errors.push(error.message));
  const response = await pg.goto(BASE + path);
  return { ctx, pg, errors, response };
}
async function visibleGames(pg) {
  return pg.locator("#activityGroups button[data-game]:visible").evaluateAll((els) => els.map((el) => el.dataset.game));
}
async function visibleGroups(pg) {
  return pg.locator("#activityGroups [data-group]:visible").evaluateAll((els) => els.map((el) => el.dataset.group));
}
function filter(pg, name) { return pg.locator("#libraryFilters").getByRole("button", { name, exact: true }); }
async function state(pg) {
  return pg.evaluate(() => {
    const keys = Object.keys(localStorage).filter((key) => /^sona\.(?:profile|progress|tickets|charge|rotation|today|reps|coins|sub|trial|demo|slp|founder|pilot|rung)/.test(key)).sort();
    return {
      local: keys.map((key) => [key, localStorage.getItem(key)]),
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
    const browse = pg.locator("#browseGames");
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
        [null, null], ["", null], ["unknown", null], ["4 years", null], ["5.5", null], ["2", null], ["15", null], ["-1", null],
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
        ok(label + ": all six games remain available", same(sorted(model.groups.flatMap((g) => g.games.map((game) => game.key))), allKeys));
        ok(label + ": only the recommended group is marked",
          model.groups.every((g) => g.recommended === (g.id === recommended)), model.groups.map((g) => ({ id: g.id, recommended: g.recommended })));
        if (recommended) ok(label + ": the recommended group comes first", model.groups[0]?.id === recommended, model.groups.map((g) => g.id));
      }
      const model = await pg.evaluate(() => Sona.activityLibrary());
      const simple = model.groups.find((g) => g.id === "simple");
      const arcade = model.groups.find((g) => g.id === "arcade");
      ok("Simple play contains Feed Echo", same(simple.games.map((g) => g.key), ["feed"]));
      ok("Arcade contains the five earned arcade games", same(sorted(arcade.games.map((g) => g.key)), allKeys.filter((key) => key !== "feed")));
      ok("Arcade's age label presents the suggested 5–8 range", /5\s*[–—-]\s*8/.test(arcade.ageLabel), arcade.ageLabel);
      ok("every game has a usable name, description and destination",
        model.groups.every((g) => [g.name, g.ageLabel, g.description].every((v) => typeof v === "string" && v.trim())
          && g.games.every((game) => [game.name, game.sub, game.go, game.playDescription].every((v) => typeof v === "string" && v.trim()))));
    } finally { await ctx.close(); }
  });

  for (const age of ["4", "5", "8", null]) {
    await section("render and filters, age " + age, async () => {
      const { ctx, pg, errors } = await fixture({ age });
      try {
        ok("age " + age + ": the browser title names the play library", /play library/i.test(await pg.title()), await pg.title());
        ok("age " + age + ": All games initially shows six games", same(sorted(await visibleGames(pg)), allKeys));
        const recommended = age === "4" ? "simple" : age == null ? null : "arcade";
        if (recommended) ok("age " + age + ": recommended cards render first", (await visibleGroups(pg))[0] === recommended);
        const games = await pg.evaluate(() => Sona.activityLibrary().groups.flatMap((g) => g.games));
        for (const game of games) {
          const button = pg.locator('button[data-game="' + game.key + '"]');
          ok("age " + age + ": " + game.name + " has an accessible, enabled launch button",
            await button.count() === 1 && await button.isEnabled()
              && await pg.getByRole("button", { name: new RegExp(game.name, "i") }).count() === 1);
        }
        ok("age " + age + ": All games exposes selected state", await filter(pg, "All games").getAttribute("aria-pressed") === "true");
        await filter(pg, "Simple play").click();
        ok("age " + age + ": Simple play filters to Feed Echo", same(await visibleGames(pg), ["feed"]));
        ok("age " + age + ": only Simple play is selected",
          await filter(pg, "Simple play").getAttribute("aria-pressed") === "true"
            && await filter(pg, "All games").getAttribute("aria-pressed") === "false"
            && await filter(pg, "Arcade").getAttribute("aria-pressed") === "false");
        await filter(pg, "Arcade").click();
        ok("age " + age + ": Arcade filters to all five arcade games", same(sorted(await visibleGames(pg)), allKeys.filter((key) => key !== "feed")));
        await filter(pg, "All games").click();
        ok("age " + age + ": All games restores every game", same(sorted(await visibleGames(pg)), allKeys));
        ok("age " + age + ": no runtime errors", errors.length === 0, errors);
      } finally { await ctx.close(); }
    });
  }

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
      await pg.locator("#browseGames").click();
      await pg.waitForURL(/\/activities\.html(?:[?#]|$)/);
      await filter(pg, "Simple play").click();
      await filter(pg, "Arcade").click();
      await filter(pg, "All games").click();
      ok("browsing/filtering creates no practice, rewards, run, token or entitlement", same(await state(pg), before), { before, after: await state(pg) });
      const parked = await pg.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href")).filter((href) => /(?:chapter|story|library)\.html(?:[?#]|$)/.test(href)));
      ok("the play library has no parked reader links", parked.length === 0, parked);
    } finally { await ctx.close(); }
  });

  await section("existing game launch routes", async () => {
    const { ctx, pg } = await fixture({ age: "4" });
    try {
      for (const key of allKeys) {
        await pg.goto(BASE + "/activities.html");
        await pg.locator('button[data-game="' + key + '"]').click();
        await pg.waitForURL(key === "feed" ? /\/arcade-feed\.html(?:[?#]|$)/ : /\/charge\.html\?/);
        const url = new URL(pg.url());
        ok(key + ": launch follows the existing practice route",
          key === "feed" ? url.pathname === "/arcade-feed.html"
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
        await pg.locator('button[data-game="' + key + '"]').click();
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

  await section("keyboard filters and launch", async () => {
    const { ctx, pg } = await fixture({ age: "8" });
    try {
      await filter(pg, "All games").focus();
      await pg.keyboard.press("Tab");
      ok("Tab reaches the next filter", await filter(pg, "Simple play").evaluate((el) => el === document.activeElement));
      await pg.keyboard.press("Enter");
      ok("Enter activates the Simple play filter", same(await visibleGames(pg), ["feed"]));
      await filter(pg, "Arcade").focus();
      await pg.keyboard.press("Space");
      ok("Space activates the Arcade filter", (await visibleGames(pg)).length === 5);
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
        const overflow = await pg.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
        ok(viewport.width + "px: library has no horizontal overflow", overflow <= 1, overflow);
        await pg.mouse.move(viewport.width / 2, viewport.height / 2);
        await pg.mouse.wheel(0, 10000);
        await pg.waitForTimeout(150);
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
