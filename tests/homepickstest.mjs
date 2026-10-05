// HOME PICKS: local-calendar choices are silent, read-only, relevant to the
// active child, and honest about which releases are new.
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
  await page.goto(origin + "/today.html"); await page.waitForFunction(() => !!window.Sona); return { ctx, page, errors };
}
const keys = (a) => a.map((x) => x.key);
try {
  browser = await chromium.launch(launchOpts());
  const first = await fixture();
  const ready = await first.page.evaluate(() => typeof Sona.homePicks === "function" && !!Sona.activityLibrary().picks);
  ok("Home supplies its read-only calendar picks contract", ready);
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
        const result = await page.evaluate(({ age, sounds, premium, free }) => {
          const before = JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]));
          let stable = true, safe = true, relevant = true, useful = true, alternates = true, unique = true, varied = false, avoidsRepeat = true;
          let prior = [], priorJSON = ""; const seenBooks = {}, seenGames = {};
          for (let i = 0; i < 400; i++) {
            const day = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10), picks = Sona.homePicks(day), second = Sona.homePicks(day);
            stable = stable && JSON.stringify(picks) === JSON.stringify(second);
            unique = unique && picks.length === 2 && picks[0].key !== picks[1].key;
            const ordinal = Date.parse(day + "T00:00:00Z") / 86400000;
            alternates = alternates && (ordinal % 2 === 0 ? picks[0].kind === "book" : picks.every((p) => p.kind !== "book"));
            let locked = 0;
            picks.forEach((p) => {
              if (p.kind === "book") { seenBooks[p.key] = true; safe = safe && !/halloween/.test(p.slug); relevant = relevant && (!sounds.length || sounds.indexOf(p.sound) >= 0); locked += Sona.bookLocked(p.name) ? 1 : 0; }
              else { seenGames[p.key] = true; const a = Sona.GAME_ACTS[p.key]; safe = safe && !!a && !a.comingSoon && !a.season && a.available !== false; relevant = relevant && a.group === (age < 5 ? "simple" : "arcade"); locked += Sona.gameAccess(p.key).allowed ? 0 : 1; }
            });
            if (premium || free) useful = useful && locked <= 1;
            if (i && premium && age >= 5) avoidsRepeat = avoidsRepeat && picks.every((p) => !prior.includes(p.key));
            const current = JSON.stringify(picks.map((p) => p.key)); if (priorJSON && current !== priorJSON) varied = true; priorJSON = current; prior = picks.map((p) => p.key);
          }
          const after = JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]));
          return { stable, safe, relevant, useful, alternates, unique, varied, avoidsRepeat, readonly: before === after, books: Object.keys(seenBooks), games: Object.keys(seenGames) };
        }, { age: config.age || 8, sounds: config.sounds, premium: config.premium !== false, free: !!config.free });
        ok(config.name + ": same-day choices are stable and reading never saves state", result.stable && result.readonly, result);
        ok(config.name + ": two distinct choices alternate book/game and two games", result.unique && result.alternates && result.varied, result);
        ok(config.name + ": only finished, nonseasonal choices in the child's sounds and age group", result.safe && result.relevant, result);
        ok(config.name + ": an open family never gets two grey choices", result.useful, result);
        if (config.premium !== false && (config.age || 8) >= 5) ok(config.name + ": larger unlocked pools avoid yesterday's picks", result.avoidsRepeat, result);
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
    await scenario("sound and homework precedence", async () => {
      const { ctx, page } = await fixture({ sounds: ["S"], homework: { sounds: ["R"], start: "2026-10-01", due: "2026-10-31" } });
      try {
        const got = await page.evaluate(() => {
          const books = (start, count) => Array.from({ length: count }, (_, i) => Sona.homePicks(new Date(Date.UTC(2026, 9, start + i)).toISOString().slice(0, 10))).flat().filter((p) => p.kind === "book");
          return { active: books(1, 30).map((p) => p.sound), expired: books(32, 14).map((p) => p.sound) };
        });
        ok("active homework leads book picks, then the family's sounds return after its due day", got.active.length > 0 && got.active.every((s) => s === "R") && got.expired.length > 0 && got.expired.every((s) => s === "S"), got);
      } finally { await ctx.close(); }
    });
    await scenario("honest release dates", async () => {
      const { ctx, page } = await fixture();
      try {
        const got = await page.evaluate(() => {
          Object.keys(Sona.GAME_ACTS).forEach((key) => { if (!Sona.GAME_ACTS[key].comingSoon) Sona.GAME_ACTS[key].releasedOn = "2026-10-01"; });
          return { day29: Sona.homePicks("2026-10-30"), day30: Sona.homePicks("2026-10-31"), before: Sona.homePicks("2026-09-30") };
        });
        ok("New ends after day 29 and never labels a future release", got.day29.filter((p) => p.kind !== "book").every((p) => p.isNew) && got.day30.every((p) => !p.isNew) && got.before.every((p) => !p.isNew), got);
        const books = await page.evaluate(() => Array.from({ length: 90 }, (_, i) => {
          const day = new Date(Date.UTC(2026, 8, 15 + i)).toISOString().slice(0, 10);
          return Sona.homePicks(day).filter((p) => p.kind === "book").map((p) => ({ day, slug: p.slug, isNew: p.isNew }));
        }).flat());
        const dated = ["rosie-red-wagon", "ray-lost-ring"], recent = books.filter((b) => dated.includes(b.slug) && b.day >= "2026-10-01" && b.day <= "2026-10-30");
        ok("existing covers have no invented New badge and real book releases expire", recent.length > 0 && recent.every((b) => b.isNew) && books.filter((b) => !dated.includes(b.slug) || b.day >= "2026-10-31").every((b) => !b.isNew), books);
      } finally { await ctx.close(); }
    });
    await scenario("320px mixed row and labels", async () => {
      const { ctx, page, errors } = await fixture({ premium: false, free: true });
      try {
        const mixedDay = await page.evaluate(() => { for (let i = 1; i <= 10; i++) { const d = "2026-10-" + String(i).padStart(2, "0"); if (Sona.homePicks(d)[0].kind === "book" && Sona.homePicks(d)[0].name === "Rory and the Rainbow") return d; } return ""; });
        await page.clock.setFixedTime(new Date(mixedDay + "T12:00:00Z")); await page.reload();
        const row = page.locator('[data-collection="picks"]');
        const shape = await row.evaluate((el) => {
          const cards = Array.from(el.querySelectorAll(".game-card")), art = cards.map((c) => c.querySelector(".game-art").getBoundingClientRect());
          return { title: el.querySelector("h2").textContent, count: cards.length, book: cards[0].classList.contains("book-card"), label: cards[0].getAttribute("aria-label"), free: cards[0].querySelector(".game-access").textContent, arts: art.map((r) => ({ w: r.width, h: r.height })), overflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) > innerWidth + 1 };
        });
        ok("320px mixed picks use matching square art without sideways overflow", shape.count === 2 && shape.book && !shape.overflow && shape.arts.every((r) => Math.abs(r.w - r.h) < 2), shape);
        ok("free book badge and spoken label are useful, with no undefined text", shape.free === "Free" && !/undefined/.test(shape.label) && shape.title === "Today's picks", shape);
        ok("the daily rep pill keeps its grown-up tap target", await page.locator("#repPill").evaluate((e) => e.getBoundingClientRect().height >= 44));
        if (process.env.HOME_PICK_SHOT) await page.screenshot({ path: process.env.HOME_PICK_SHOT });
        ok("mixed Home has no page errors", !errors.length, errors);
      } finally { await ctx.close(); }
    });
    await scenario("daily rep pill", async () => {
      const { ctx, page, errors } = await fixture({ age: 4 });
      try {
        await page.evaluate(() => {
          Sona.saveProfile({ dailyGoal: 30 });
          localStorage.setItem("sona.gamereps.v1", JSON.stringify({ [Sona.localDay()]: { R: 12 } }));
          document.dispatchEvent(new Event("visibilitychange"));
        });
        const read = () => page.evaluate(() => ({ count: document.getElementById("repPillN").textContent, unit: document.getElementById("repPillUnit").textContent, aria: document.getElementById("repPill").getAttribute("aria-label"), overflow: document.documentElement.scrollWidth > innerWidth + 1 }));
        let got = await read();
        ok("Home shows 12/30 reps today before the goal", got.count === "12/30" && got.unit === "reps today" && /12 of 30 reps today/.test(got.aria) && !got.overflow, got);
        await page.evaluate(() => { for (let i = 0; i < 22; i++) Sona.gameRep("R"); document.dispatchEvent(new Event("visibilitychange")); });
        got = await read();
        ok("Home keeps counting to 34 and says Goal met", got.count === "34" && got.unit === "Goal met" && /34 of 30 reps today/.test(got.aria) && !got.overflow, got);
        await page.evaluate(() => { Sona.saveProfile({ dailyGoal: 50 }); document.dispatchEvent(new Event("visibilitychange")); });
        got = await read();
        ok("raising the target keeps the earned Goal met display", got.count === "34" && got.unit === "Goal met" && /34 of 50 reps today.*Goal met/.test(got.aria), got);
        await page.locator("#repPill").click();
        ok("the daily rep pill still opens the grown-up check", await page.locator("#gateOvl").evaluate((e) => e.classList.contains("show")));
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
