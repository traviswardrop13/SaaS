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
  const pg = await ctx.newPage(); pg.setDefaultTimeout(5000);
  const errors = [];
  pg.on("pageerror", (error) => errors.push(error.message));
  const response = await pg.goto(BASE + path);
  return { ctx, pg, errors, response };
}
async function visibleGames(pg) {
  return pg.locator("#activityGroups button[data-game]:visible").evaluateAll((els) => els.map((el) => el.dataset.game));
}
async function visibleGroups(pg) {
  return pg.locator("#activityGroups [data-group]").evaluateAll((els) => els.map((el) => el.dataset.group));
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
      ok("Arcade's age label presents the approved 5+ range", /5\s*(?:\+|and up)/.test(arcade.ageLabel), arcade.ageLabel);
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
        ok("age " + age + ": All games initially shows eight games", same(sorted(await visibleGames(pg)), allKeys));
        const recommended = age === "4" ? "simple" : age == null ? null : "arcade";
        if (recommended) ok("age " + age + ": recommended cards render first", (await visibleGroups(pg))[0] === recommended);
        const games = await pg.evaluate(() => Sona.activityLibrary().groups.flatMap((g) => g.games));
        for (const game of games) {
          const button = pg.locator('button[data-game="' + game.key + '"]');
          ok("age " + age + ": " + game.name + " has an accessible, enabled launch button",
            await button.count() === 1 && await button.isEnabled()
              && await pg.getByRole("button", { name: new RegExp(game.name, "i") }).count() === 1);
        }
        ok("age " + age + ": Echo gives one simple invitation", await pg.getByRole("heading", {name:"Pick a game!", exact:true}).count() === 1);
        ok("age " + age + ": all games are visible without reading filters", await pg.locator("#libraryFilters").count() === 0);
        const copy = await pg.locator("#libraryApp").innerText();
        ok("age " + age + ": child choices do not carry age labels or instructions", !/Ages |Suggested|Practise|Practice your|More movement|Take your time/.test(copy),copy);
        ok("age " + age + ": the picture cards show names without Play rows", await pg.locator(".game-description,.game-play,.game-arrow").count() === 0);
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
      await pg.locator("#libBtn").click();
      await pg.waitForURL(/\/activities\.html(?:[?#]|$)/);
      await pg.locator("#activityGroups button[data-game]").last().scrollIntoViewIfNeeded();
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
        const button = pg.locator('button[data-game="' + key + '"]');
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
        const button = pg.locator('button[data-game="' + key + '"]');
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
      const pick=pg.locator('button[data-game="bubbles"]');
      await pick.click();
      if(new URL(pg.url()).pathname!=='/activities.html'){ok("the spoken choice stays in the library until its voice finishes",false,pg.url());return;}
      ok("a tapped game speaks its name without child data", await pg.evaluate(()=>__librarySpeech.includes("Bubble Pop") && !__librarySpeech.some(t=>/Mia/.test(t))));
      await pg.evaluate(()=>{window.__libraryHidden=true;document.dispatchEvent(new Event('visibilitychange'));});
      await pg.waitForTimeout(1500);
      ok("backgrounding cancels the delayed launch", new URL(pg.url()).pathname==='/activities.html',pg.url());
      await pg.evaluate(()=>{window.__libraryHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
      await ctx.route('**/arcade-peekaboo.html',route=>route.fulfill({contentType:'text/html',body:'<p>Game destination</p>'}));
      await pg.locator('button[data-game="peekaboo"]').click();
      await pg.evaluate(()=>__voiceEnds.forEach(end=>end()));
      await pg.waitForURL(/arcade-peekaboo\.html/);
      ok("stale voice completion cannot override the latest choice", new URL(pg.url()).pathname==='/arcade-peekaboo.html');
    }finally{await ctx.close();}
  });

  await section("keyboard filters and launch", async () => {
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
        const tiles = await pg.locator("#activityGroups button[data-game]").evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:el.offsetTop,w:r.width,h:r.height};}));
        const columns=tiles.filter(t=>Math.abs(t.y-tiles[0].y)<2).length;
        ok(viewport.width + "px: large square pictures form the right grid", columns===(viewport.width>=600?3:2)&&tiles.every(t=>Math.abs(t.w-t.h)<2),tiles);
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
