// HOME PICKS: local-calendar choices are silent, read-only, relevant to the
// active child, and honest about which releases are new. Since 23 Oct 2026
// (Travis: "organize the arcade so that there are no books in there ... I
// only want either today's picks or limited time ... have 2 games listed
// there") the Arcade has ONE row above its shelves, Today's picks: two games
// of the child's own age group, never a book. What's new and Limited time are
// gone, and the books are behind Home's Books door alone.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from "./_env.mjs";
const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT;
const mime = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", webp: "image/webp", woff2: "font/woff2" };
const server = createServer((req, res) => {
  const pathname = new URL(req.url, "http://x").pathname, file = ROOT + pathname;
  if (pathname.startsWith("/api/") || !existsSync(file)) { res.writeHead(503); res.end("{}"); return; }
  res.writeHead(200, { "content-type": mime[file.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = "http://127.0.0.1:" + server.address().port;
let browser, fails = 0;
function ok(name, pass, detail) { if (!pass) fails++; console.log((pass ? "PASS " : "FAIL ") + name + (pass || detail === undefined ? "" : " " + JSON.stringify(detail))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + " completes", false, e.message); } }
async function fixture({ age = 8, sounds = ["R"], premium = true, free = false, mode, slot = "", homework, date = "2026-10-04T12:00:00Z" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: "reduce", timezoneId: "America/Boise" });
  await ctx.route("**/*", (r) => r.request().url().startsWith(origin) ? r.continue() : r.abort());
  await ctx.addInitScript(({ age, sounds, premium, free, mode, slot, homework }) => {
    if (localStorage.getItem("sona.homepick.seed")) return;
    localStorage.setItem("sona.homepick.seed", "1");
    ["sona.freeera.v1", "sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
    localStorage.setItem("sona.freever.v1", free ? "kept" : "post");
    // the offer from Home already shown here (13 Oct 2026): without it the
    // trial-first seed is the stuck household and Home opens the plan screen
    localStorage.setItem("sona.offerseen.v1", "1");
    localStorage.setItem("sona.fid.v1", "home-picks-fixture");
    localStorage.setItem("sona.pulse.v1", JSON.stringify({ cool: Date.now() + 365 * 86400000 }));
    sessionStorage.setItem("sona.paidui", "1"); sessionStorage.setItem("sona.websalesui", "1");
    const profile = { childName: "Milo", childAge: String(age), focusSounds: sounds, earlyAdopter: premium, mode, onboarded: true, volume: 0, voiceOn: false, soundOn: false };
    localStorage.setItem("sona.profile.v1" + (slot ? "@" + slot : ""), JSON.stringify(profile));
    if (slot) localStorage.setItem("sona.kids.v1", JSON.stringify({ active: slot, list: [{ slot: "", name: "First" }, { slot, name: "Sibling" }] }));
    if (homework) localStorage.setItem("sona.homework.v1" + (slot ? "@" + slot : ""), JSON.stringify({ hw: homework }));
  }, { age, sounds, premium, free, mode, slot, homework });
  const page = await ctx.newPage(); page.setDefaultTimeout(5000); await page.clock.setFixedTime(new Date(date));
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  // the picks row is in Home's Arcade since 22 Oct 2026 (STORY1)
  await page.goto(origin + "/today.html?view=arcade"); await page.waitForFunction(() => !!window.Sona); return { ctx, page, errors };
}
const keys = (a) => a.map((x) => x.key);
try {
  browser = await chromium.launch(launchOpts());
  const first = await fixture();
  const ready = await first.page.evaluate(() => typeof Sona.homePicks === "function" && !!Sona.activityLibrary().picks);
  ok("Home supplies its read-only calendar picks contract", ready);
  // the library hands Home its shelves and the one picks row, and no
  // "featured" rows any more (What's new and Limited time, gone 23 Oct 2026)
  const contract = await first.page.evaluate(() => { const lib = Sona.activityLibrary(); return { keys: Object.keys(lib).sort(), picks: { id: lib.picks.id, name: lib.picks.name, tag: lib.picks.tag } }; }).catch((e) => ({ error: e.message }));
  ok("the library is shelves plus one Today's picks row, with no What's new or Limited time", JSON.stringify(contract.keys) === JSON.stringify(["groups", "picks", "recommended"]) && contract.picks && contract.picks.id === "picks" && contract.picks.name === "Today's picks" && contract.picks.tag === "Changes daily", contract);
  await first.ctx.close();
  if (ready) {
    for (const config of [
      { name: "Premium R", sounds: ["R"] },
      { name: "free R", premium: false, free: true, sounds: ["R"] },
      { name: "free K", premium: false, free: true, sounds: ["K"] },
      { name: "trial-first S", premium: false, sounds: ["S"] },
      { name: "little P", age: 4, sounds: ["P"] },
      { name: "play mode", mode: "play", sounds: [] },
      { name: "sibling", slot: "k2", sounds: ["R"] },
    ]) await scenario(config.name, async () => {
      const { ctx, page, errors } = await fixture(config);
      try {
        // ages 2-4 are Simple play, everyone else the Arcade (Sona.playStyle)
        const group = (config.age || 8) < 5 ? "simple" : "arcade";
        const result = await page.evaluate(({ group }) => {
          const before = JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]));
          let stable = true, safe = true, relevant = true, useful = true, unique = true, varied = false, avoidsRepeat = true;
          let prior = [], priorJSON = ""; const seenGames = {}, lanes = [{}, {}], books = [];
          for (let i = 0; i < 400; i++) {
            const day = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10), picks = Sona.homePicks(day), second = Sona.homePicks(day);
            stable = stable && JSON.stringify(picks) === JSON.stringify(second);
            unique = unique && picks.length === 2 && picks[0].key !== picks[1].key;
            let locked = 0;
            picks.forEach((p, n) => {
              // a book (or anything the game catalog doesn't know) is never a pick
              const a = Sona.GAME_ACTS[p.key];
              if (p.kind === "book" || !a) { books.push(day + " " + p.key); return; }
              seenGames[p.key] = true; lanes[n][p.key] = true;
              safe = safe && !a.comingSoon && a.available !== false; relevant = relevant && a.group === group; locked += Sona.gameAccess(p.key).allowed ? 0 : 1;
            });
            useful = useful && locked <= 1;
            avoidsRepeat = avoidsRepeat && (!i || picks.every((p) => !prior.includes(p.key)));
            const current = JSON.stringify(picks.map((p) => p.key)); if (priorJSON && current !== priorJSON) varied = true; priorJSON = current; prior = picks.map((p) => p.key);
          }
          const after = JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]));
          // the child's own shelf as Home draws it: every finished game of the group
          const shelf = Sona.activityLibrary().groups.filter((g) => g.id === group)[0].games.filter((g) => !g.comingSoon && g.available !== false).map((g) => g.key).sort();
          return { stable, safe, relevant, useful, unique, varied, avoidsRepeat, readonly: before === after, books, games: Object.keys(seenGames).sort(), shelf, lanesApart: !Object.keys(lanes[0]).some((k) => lanes[1][k]) };
        }, { group });
        ok(config.name + ": same-day choices are stable and reading never saves state", result.stable && result.readonly, result);
        ok(config.name + ": two distinct games every day, never a book, changing from day to day", result.unique && !result.books.length && result.varied, result);
        ok(config.name + ": only finished games of the child's own age group", result.safe && result.relevant, result);
        if (config.premium !== false || config.free) ok(config.name + ": an open family never gets two grey choices", result.useful, result);
        if (config.premium !== false) {
          // 23 Oct 2026: both shelves are big enough now (13 little-kid games,
          // 16 big-kid), so the littles are held to this too
          ok(config.name + ": larger unlocked pools avoid yesterday's picks", result.avoidsRepeat, result);
          ok(config.name + ": every game on the child's own shelf takes its turn as a pick", JSON.stringify(result.games) === JSON.stringify(result.shelf), result);
        }
        // one pick from each half of the shelf, so the two never match; only
        // the free version's swap (neither choice opens) may cross the halves
        if (!config.free) ok(config.name + ": the two picks come from the two halves of the shelf", result.lanesApart, result);
        // What the child sees: one row of the two picks (no book card, no
        // Books card, no What's new or Limited time), then their own age
        // group's shelf first (Travis, 23 Oct 2026: "if they're young, 3 to 4,
        // have simple play show up higher, and vice versa").
        const seen = await page.evaluate(() => {
          const rows = Array.from(document.querySelectorAll("#featuredGroups > section"));
          return {
            rows: rows.map((r) => r.dataset.collection), cards: rows.length ? Array.from(rows[0].querySelectorAll(".game-card")).map((c) => c.dataset.game) : [],
            today: Sona.homePicks().map((p) => p.key), books: document.querySelectorAll(".book-card,#booksCard,#libraryBooksArt,#booksTag,#booksLine,#booksHeading").length,
            shelves: Array.from(document.querySelectorAll("#activityGroups .activity-group")).map((g) => g.dataset.group),
          };
        });
        ok(config.name + ": the Arcade shows one row of today's two games, no books, then the child's own shelf first", JSON.stringify(seen.rows) === '["picks"]' && JSON.stringify(seen.cards) === JSON.stringify(seen.today) && seen.cards.length === 2 && !seen.books && seen.shelves[0] === group && seen.shelves.length === 2, seen);
        ok(config.name + ": no Home page errors", !errors.length, errors);
      } finally { await ctx.close(); }
    });
    await scenario("anonymous family and child seeds", async () => {
      const { ctx, page } = await fixture();
      try {
        const got = await page.evaluate(() => {
          const series = () => Array.from({ length: 30 }, (_, i) => Sona.homePicks(new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10)).map((p) => p.key));
          const original = JSON.stringify(series()), profile = JSON.parse(localStorage.getItem("sona.profile.v1"));
          profile.childName = "A different child name"; localStorage.setItem("sona.profile.v1", JSON.stringify(profile));
          const nameIndependent = original === JSON.stringify(series());
          localStorage.setItem("sona.profile.v1@k2", JSON.stringify(profile));
          localStorage.setItem("sona.kids.v1", JSON.stringify({ active: "k2", list: [{ slot: "", name: "First" }, { slot: "k2", name: "Sibling" }] }));
          const siblingsDiffer = original !== JSON.stringify(series());
          localStorage.removeItem("sona.fid.v1");
          const before = JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]));
          series();
          const after = JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]));
          return { nameIndependent, siblingsDiffer, noIdCreated: !localStorage.getItem("sona.fid.v1") && before === after };
        });
        ok("names never seed picks, sibling slots do, and an absent family id stays absent", got.nameIndependent && got.siblingsDiffer && got.noIdCreated, got);
      } finally { await ctx.close(); }
    });
    // Sounds and homework only ever chose the BOOK pick (23 Oct 2026: the
    // picks are games now), so neither may move the two games, before or
    // after an assignment's due day, and neither may bring a book back.
    await scenario("sounds and homework never change the picks", async () => {
      const { ctx, page } = await fixture({ sounds: ["S"], homework: { sounds: ["R"], start: "2026-10-01", due: "2026-10-31" } });
      try {
        const got = await page.evaluate(() => {
          const series = () => Array.from({ length: 45 }, (_, i) => Sona.homePicks(new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10)));
          const flat = (s) => JSON.stringify(s.map((d) => d.map((p) => p.key)));
          const homework = series();
          localStorage.removeItem("sona.homework.v1");
          const sounds = series(), profile = JSON.parse(localStorage.getItem("sona.profile.v1"));
          profile.focusSounds = ["K", "L"]; localStorage.setItem("sona.profile.v1", JSON.stringify(profile));
          const others = series();
          const books = [homework, sounds, others].flat(2).filter((p) => p.kind === "book" || !Sona.GAME_ACTS[p.key]).map((p) => p.key);
          return { same: flat(homework) === flat(sounds) && flat(sounds) === flat(others), books, sample: JSON.parse(flat(homework)).slice(0, 3) };
        });
        ok("homework and the child's sounds never change the two games, and never bring a book", got.same && !got.books.length, got);
      } finally { await ctx.close(); }
    });
    await scenario("honest release dates", async () => {
      const { ctx, page } = await fixture();
      try {
        // the real catalog first, across the October book releases and the
        // Halloween season that used to fill What's new and Limited time: no
        // book ever, and New only on a game released 0-29 days before the day
        const real = await page.evaluate(() => Array.from({ length: 90 }, (_, i) => {
          const day = new Date(Date.UTC(2026, 8, 15 + i)).toISOString().slice(0, 10), at = Date.parse(day + "T00:00:00Z");
          return Sona.homePicks(day).map((p) => { const a = Sona.GAME_ACTS[p.key], r = a && a.releasedOn ? Date.parse(a.releasedOn + "T00:00:00Z") : NaN; return { day, key: p.key, book: p.kind === "book" || !a, isNew: p.isNew, due: r <= at && at - r < 30 * 86400000 }; });
        }).flat());
        ok("the October book releases and the Halloween season bring no book, and no game is called New without a real release date", real.length === 180 && real.every((p) => !p.book && p.isNew === p.due), real.filter((p) => p.book || p.isNew !== p.due));
        const got = await page.evaluate(() => {
          Object.keys(Sona.GAME_ACTS).forEach((key) => { if (!Sona.GAME_ACTS[key].comingSoon) Sona.GAME_ACTS[key].releasedOn = "2026-10-01"; });
          return { day29: Sona.homePicks("2026-10-30"), day30: Sona.homePicks("2026-10-31"), before: Sona.homePicks("2026-09-30") };
        });
        ok("New ends after day 29 and never labels a future release", got.day29.length === 2 && got.day29.every((p) => p.isNew) && got.day30.every((p) => !p.isNew) && got.before.every((p) => !p.isNew), got);
      } finally { await ctx.close(); }
      // Peekaboo carries the catalog's one real release date (21 Sep 2026):
      // a little one's pick of it is New through 20 Oct, then plain
      const little = await fixture({ age: 4, sounds: ["P"] });
      try {
        const peek = await little.page.evaluate(() => {
          const date = Sona.GAME_ACTS.peekaboo && Sona.GAME_ACTS.peekaboo.releasedOn;
          const seen = Array.from({ length: 60 }, (_, i) => { const day = new Date(Date.UTC(2026, 8, 21 + i)).toISOString().slice(0, 10); return Sona.homePicks(day).filter((p) => p.key === "peekaboo").map((p) => ({ day, isNew: p.isNew })); }).flat();
          return { date, recent: seen.filter((p) => p.day <= "2026-10-20"), later: seen.filter((p) => p.day > "2026-10-20") };
        });
        if (peek.date === "2026-09-21") ok("a real game release is New for its first 30 days and plain after", peek.recent.length > 0 && peek.recent.every((p) => p.isNew) && peek.later.length > 0 && peek.later.every((p) => !p.isNew), peek);
      } finally { await little.ctx.close(); }
    });
    // A free family's row at 320 px (23 Oct 2026: two games, no book cover
    // to square up against): the two cards sit side by side in one row with
    // the shelves' wide pictures, nothing scrolls sideways, and each label
    // says what a tap does.
    await scenario("320px row of two games and labels", async () => {
      const { ctx, page, errors } = await fixture({ premium: false, free: true });
      try {
        const measure = () => page.evaluate(() => {
          const el = document.querySelector('[data-collection="picks"]'), grid = el.querySelector(".featured-grid"), cards = Array.from(grid.querySelectorAll(".game-card"));
          const box = cards.map((c) => c.getBoundingClientRect()), row = el.getBoundingClientRect(), art = cards.map((c) => c.querySelector(".game-art").getBoundingClientRect());
          return {
            title: el.querySelector("h2").textContent, tag: el.querySelector(".shelf-tag").textContent, count: cards.length, book: cards.some((c) => c.classList.contains("book-card")),
            sideBySide: box.length === 2 && Math.abs(box[0].top - box[1].top) < 1 && box[0].right <= box[1].left && box[0].left >= row.left && box[1].right <= row.right,
            scrolls: grid.scrollWidth > grid.clientWidth + 1, overflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) > innerWidth + 1,
            arts: art.map((r) => ({ w: r.width, h: r.height, ratio: r.width / r.height })),
            labels: cards.map((c) => ({ key: c.dataset.game, name: Sona.GAME_ACTS[c.dataset.game] && Sona.GAME_ACTS[c.dataset.game].name, aria: c.getAttribute("aria-label"), access: c.querySelector(".game-access").textContent, locked: c.dataset.locked, allowed: Sona.gameAccess(c.dataset.game).allowed })),
          };
        });
        const wide = (s) => s.count === 2 && !s.book && s.sideBySide && !s.scrolls && !s.overflow && s.arts.every((r) => Math.abs(r.ratio - 1.8) < 0.05) && Math.abs(s.arts[0].w - s.arts[1].w) < 1;
        const shape = await measure();
        ok("320px picks are two games side by side, with the shelves' wide art and no sideways scroll", wide(shape), shape);
        // open: "Free" or "Included"; grey: "Premium", and the tap's promise
        const honest = (l) => !!l.name && l.aria.startsWith(l.name + ". ") && !/undefined|  /.test(l.aria) && (l.allowed ? /^(Free|Included)$/.test(l.access) && l.aria.includes(" " + l.access + ".") && l.locked === "false" : l.access === "Premium" && l.aria.includes("Premium. Ask a grown-up to unlock.") && l.locked === "true");
        ok("free and Premium badges and spoken labels are honest, with no undefined text", shape.title === "Today's picks" && shape.tag === "Changes daily" && shape.labels.every(honest) && shape.labels.some((l) => l.access === "Free"), shape);
        ok("the gift button keeps a full tap target", await page.locator("#giftBtn").evaluate((e) => e.getBoundingClientRect().height >= 44 && e.getBoundingClientRect().width >= 44));
        if (process.env.HOME_PICK_SHOT) await page.screenshot({ path: process.env.HOME_PICK_SHOT });
        // two across at every width, an iPad's too: never a sideways strip
        await page.setViewportSize({ width: 768, height: 1024 });
        const ipad = await measure();
        ok("on an iPad the picks are still two games side by side, with no sideways scroll", wide(ipad), ipad);
        ok("the picks row has no page errors", !errors.length, errors);
        // the books' one door now: Home's Books door, with the shelf's tag
        // (this family keeps the free version, so one book is free)
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto(origin + "/today.html"); await page.waitForFunction(() => !!window.Sona);
        const door = await page.evaluate(() => ({ tag: document.getElementById("homeBooksTag").textContent, card: !!document.getElementById("booksCard"), books: document.querySelectorAll(".book-card").length }));
        await page.locator("#homeBooksBtn").click(); await page.waitForURL("**/library.html", { waitUntil: "commit" });
        ok("Home's Books door is the way to the bookshelf, tagged 1 free book, with no Books card left", door.tag === "1 free book" && !door.card && !door.books && new URL(page.url()).pathname === "/library.html", { door, url: page.url() });
      } finally { await ctx.close(); }
    });
    // FOUND1 (23 Oct 2026): the daily count is the gift button's ring and
    // its spoken label (the pill that drew the number is gone)
    await scenario("daily rep ring", async () => {
      const { ctx, page, errors } = await fixture({ age: 4 });
      try {
        await page.evaluate(() => {
          Sona.saveProfile({ dailyGoal: 30 });
          localStorage.setItem("sona.gamereps.v1", JSON.stringify({ [Sona.localDay()]: { R: 12 } }));
          document.dispatchEvent(new Event("visibilitychange"));
        });
        const read = () => page.evaluate(() => ({ fill: document.getElementById("giftRing").style.getPropertyValue("--fill"), full: document.getElementById("giftBtn").classList.contains("full"), aria: document.getElementById("giftBtn").getAttribute("aria-label"), overflow: document.documentElement.scrollWidth > innerWidth + 1 }));
        let got = await read();
        ok("Home's ring is 12 of 30 before the goal", got.fill === "40" && !got.full && /12 of 30 reps today\.$/.test(got.aria) && !got.overflow, got);
        await page.evaluate(() => { for (let i = 0; i < 22; i++) Sona.gameRep("R"); document.dispatchEvent(new Event("visibilitychange")); });
        got = await read();
        ok("Home keeps counting to 34, a full ring, and says Goal met", got.fill === "100" && got.full && /34 of 30 reps today\. Goal met\./.test(got.aria) && !got.overflow, got);
        await page.evaluate(() => { Sona.saveProfile({ dailyGoal: 50 }); document.dispatchEvent(new Event("visibilitychange")); });
        got = await read();
        ok("raising the target keeps the earned full ring and Goal met", got.fill === "100" && got.full && /34 of 50 reps today.*Goal met/.test(got.aria), got);
        ok("the gift button opens the Trophy Road", (await page.locator("#giftBtn").getAttribute("href")) === "/road.html");
        ok("daily Home has no page errors", !errors.length, errors);
      } finally { await ctx.close(); }
    });
    await scenario("local midnight", async () => {
      const { ctx, page } = await fixture({ date: "2026-10-05T05:30:00Z" });
      try {
        const before = await page.locator('[data-collection="picks"] button').evaluateAll((els) => els.map((e) => e.dataset.game));
        await page.clock.setFixedTime(new Date("2026-10-05T06:30:00Z"));
        const navigation = page.waitForEvent("framenavigated"); await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await navigation;
        await page.waitForSelector('[data-collection="picks"] button');
        const after = await page.locator('[data-collection="picks"] button').evaluateAll((els) => els.map((e) => e.dataset.game));
        const expected = await page.evaluate(() => ({ day: Sona.activityLibrary().picks.day, keys: Sona.homePicks().map((p) => p.key) }));
        ok("Home left open overnight refreshes on the family's local date", expected.day === "2026-10-05" && JSON.stringify(after) === JSON.stringify(expected.keys) && JSON.stringify(after) !== JSON.stringify(before), { before, after, expected });
      } finally { await ctx.close(); }
    });
  }
} finally { await browser?.close(); await new Promise((r) => server.close(r)); }
console.log(fails ? fails + " FAILURES" : "ALL GREEN"); process.exit(fails ? 1 : 0);
