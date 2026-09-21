// COMPLETE1: finishing a daily adventure celebrates actual practice without
// turning an arcade score into a speech measure or a zero-word history row.
// Baseline runs can serve an exported public tree with SONATEST_PUBLIC_ROOT.
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const publicRoot = process.env.SONATEST_PUBLIC_ROOT || ROOT;
const origin = "http://localhost:8193";
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2" };
const server = createServer((req, res) => {
  const u = new URL(req.url, origin);
  if (u.pathname === "/__seed") { res.end("<!doctype html><title>Test setup</title>"); return; }
  if (u.pathname.startsWith("/api/")) { res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); return; }
  const file = path.join(publicRoot, u.pathname);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(8193, "127.0.0.1", resolve));
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, extra) {
  assertions++;
  if (!pass) failures++;
  console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + (typeof extra === "string" ? extra : JSON.stringify(extra))));
}
async function scenario(name, task) {
  try { await task(); } catch (error) { ok(name + " completes without a harness/page exception", false, error.stack); }
}
const games = ["slice", "stack", "tiles", "run", "glide"];
async function fresh({ paid = false, replay = false, sound = "R", width = 390, height = 844 } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    return u.origin === origin || u.hostname === "127.0.0.1" ? route.continue() : route.abort();
  });
  // These scenarios finish recorded runs; none should request a real mic.
  await context.addInitScript(() => {
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => new Promise(() => {});
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/__seed");
  await page.evaluate(({ paid, replay, sound, games }) => {
    localStorage.setItem("sona.freeera.v1", "post");
    localStorage.setItem("sona.freeera2.v1", "done");
    localStorage.setItem("sona.freeera3.v1", "done");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: [sound], onboarded: true, volume: 0, voiceOn: false, soundOn: false }));
    if (paid) sessionStorage.setItem("sona.paidui", "1");
    if (replay) localStorage.setItem("sona.demo.v1", JSON.stringify({ started: Date.now() - 1000, done: Date.now() }));
    sessionStorage.setItem("sona.run.v1", JSON.stringify({ active: true, round: 4, sum: 40, scores: [10, 10, 10, 10], pending: true, sound, level: 1, demo: replay, games }));
  }, { paid, replay, sound, games });
  return { context, page, errors };
}
async function finish(page) {
  await page.goto(origin + "/charge.html?daily=1&banked=17");
  await page.locator("#runOvl.show").waitFor();
}
async function evidence(page) {
  return page.evaluate(() => ({ progress: Sona.getProgress(), daily: Sona.dailyInfo(), reps: Sona.repsToday(), outcomes: Sona.outcomes(), run: JSON.parse(sessionStorage.getItem("sona.run.v1")) }));
}
async function showHistory(page) {
  await page.evaluate(() => Sona.gateVerify());
  await page.goto(origin + "/progress.html");
  const more = page.getByText("More details", { exact: false });
  if (await more.count()) await more.click();
  return page.locator("#recent").innerText();
}
async function reachable(page, selector) {
  return page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) return false;
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && (top === el || el.contains(top));
  }, selector);
}

await scenario("a finished adventure and its history", async () => {
  const { context, page, errors } = await fresh();
  try {
    await finish(page);
    const ui = await page.locator("#runOvl").innerText();
    ok("completion celebrates the adventure", /Adventure complete!/i.test(ui), ui);
    ok("completion states the actual five completed rounds", /5 rounds completed/i.test(ui), ui);
    ok("completion recaps the practised sound", /You practised your R sound\./i.test(ui), ui);
    ok("the unchanged score is explicitly an arcade score", /Arcade score/i.test(ui) && await page.locator("#runScore").innerText() === "57", ui);
    ok("Done remains a clear finish for a free family", /^Done$/i.test(await page.locator("#runDone").innerText()), ui);
    const state = await evidence(page), session = state.progress.sessions[0];
    ok("the final arcade score is banked once", state.daily.score === 57 && state.run.round === 5 && state.run.active === false && state.run.scores.length === 5, state);
    ok("one history record describes the completed adventure", state.progress.sessions.length === 1 && session.activity === "adventure" && session.rounds === 5 && JSON.stringify(session.sounds) === '["R"]', session);
    ok("completion invents no words, stars, repetitions or accuracy", session.count === 0 && state.progress.totals.words === 0 && state.progress.totals.stars === 0 && Object.keys(state.progress.bySound).length === 0 && state.reps === 0 && Object.keys(state.outcomes).length === 0, state);
    await page.reload();
    const again = await evidence(page);
    ok("refresh records no second session or reward", JSON.stringify(again.progress) === JSON.stringify(state.progress) && again.daily.score === 57, { before: state, after: again });
    ok("refresh shows the existing completed-day screen", await page.locator("#playedOvl").evaluate((e) => e.classList.contains("show")));
    await page.locator("#playedArcade").click();
    await page.waitForLoadState("domcontentloaded");
    ok("completed-day Browse games opens the library", new URL(page.url()).pathname === "/activities.html", page.url());
    const history = await showHistory(page);
    ok("Progress explains rounds and sound instead of zero words", /5 rounds[\s·]*R/.test(history) && !/0 words/.test(history), history);
    const isolation = await page.evaluate(() => {
      const first = Sona.activeKid().slot;
      const before = Sona.getProgress().sessions;
      const sibling = Sona.addKid("Sibling", "5"); Sona.switchKid(sibling);
      Sona.saveProfile({ childName: "Sibling", childAge: "5", focusSounds: ["S"], onboarded: true, volume: 0 });
      const empty = Sona.getProgress().sessions;
      Sona.recordSession({ words: [], activity: "adventure", rounds: 3, sound: "S" });
      const own = Sona.getProgress().sessions;
      Sona.switchKid(first);
      return { before, empty, own, back: Sona.getProgress().sessions };
    });
    ok("siblings have separate adventure histories", isolation.empty.length === 0 && isolation.own.length === 1 && isolation.own[0].rounds === 3 && isolation.own[0].sounds[0] === "S" && JSON.stringify(isolation.before) === JSON.stringify(isolation.back), isolation);
    await page.evaluate(() => {
      Sona.recordSession({ words: [] });
      Sona.recordSession({ words: [{ word: "sun", sound: "S", ok: true }, { word: "sock", sound: "S", ok: false }] });
    });
    const mixed = await showHistory(page);
    ok("legacy empty history is described honestly", /Practice session/.test(mixed) && !/0 words/.test(mixed), mixed);
    ok("existing word sessions retain their count and sound", /2 words/.test(mixed) && /S/.test(mixed), mixed);
    const totals = await page.evaluate(() => Sona.getProgress().totals);
    ok("word-session accounting remains unchanged", totals.words === 2 && totals.stars === 1, totals);
    ok("completion and Progress have no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await scenario("completion navigation and small-screen access", async () => {
  const { context, page } = await fresh({ width: 320, height: 568, sound: "S" });
  try {
    await finish(page);
    ok("the recap uses this run's sound", /S sound/.test(await page.locator("#runOvl").innerText()));
    ok("the finish dialog has an accessible name", await page.locator("#runOvl").getAttribute("role") === "dialog" && await page.getByRole("dialog", { name: "Adventure complete!" }).count() === 1);
    ok("opening completion places focus within the dialog", await page.evaluate(() => document.querySelector("#runOvl").contains(document.activeElement)));
    ok("the 320px finish screen has no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector("#runOvl").scrollWidth <= innerWidth));
    await page.keyboard.press("Tab");
    ok("keyboard reaches Done from the recap", await page.evaluate(() => document.activeElement.id === "runDone"));
    await page.keyboard.press("Tab");
    ok("keyboard reaches Browse games", await page.evaluate(() => document.activeElement.id === "runArcade"));
    ok("the last action can be reached on a short phone", await reachable(page, "#runArcade"));
    ok("the last action is named Browse games", /Browse games/i.test(await page.locator("#runArcade").innerText()));
    await Promise.all([
      page.waitForURL(/\/activities\.html$/, { timeout: 3000 }).catch(() => null),
      page.keyboard.press("Enter"),
    ]);
    ok("completion Browse games opens the library", new URL(page.url()).pathname === "/activities.html", page.url());
  } finally { await context.close(); }
  const next = await fresh();
  try {
    await finish(next.page);
    await next.page.locator("#runDone").click(); await next.page.waitForLoadState("domcontentloaded");
    ok("Done returns a free family Home", new URL(next.page.url()).pathname === "/today.html", next.page.url());
  } finally { await next.context.close(); }
});

await scenario("the grown-up handoff remains reachable", async () => {
  const { context, page } = await fresh({ paid: true, width: 320, height: 568 });
  try {
    await finish(page);
    ok("eligible paid-state completion explains the grown-up handoff", /Show a grown-up/i.test(await page.locator("#runDone").innerText()) && await page.locator("#runHandoff").isVisible());
    await page.locator("#runDone").focus();
    ok("the grown-up action is reachable on a short phone", await reachable(page, "#runDone"));
    await page.mouse.move(160, 400); await page.mouse.wheel(0, 650); await page.waitForTimeout(150);
    ok("scrolling exposes the last button with the extra handoff copy", await reachable(page, "#runArcade"));
    await page.locator("#runDone").click(); await page.waitForLoadState("domcontentloaded");
    const destination = new URL(page.url());
    ok("Done retains the grown-up gate and intended plan destination", destination.pathname === "/today.html" && destination.searchParams.get("gate") === "1" && destination.searchParams.get("to") === "/subscribe.html?first=1", page.url());
    ok("arriving at the gate does not consume the plan offer", await page.evaluate(() => !localStorage.getItem("sona.planmoment.v1")));
  } finally { await context.close(); }
});

await scenario("demonstration replay earns no second reward", async () => {
  const { context, page } = await fresh({ replay: true });
  try {
    await finish(page);
    const state = await evidence(page);
    ok("a replay still shows its actual rounds and arcade score", /5 rounds completed/i.test(await page.locator("#runOvl").innerText()) && await page.locator("#runScore").innerText() === "57");
    ok("replay creates no history, coins, words or daily score", state.progress.sessions.length === 0 && state.progress.totals.sessions === 0 && state.progress.totals.coins === 0 && state.progress.totals.words === 0 && !state.daily.playedToday && state.daily.score === 0, state);
    const progress = JSON.stringify(state.progress);
    await page.reload();
    ok("refreshing replay completion creates no reward", JSON.stringify((await evidence(page)).progress) === progress);
  } finally { await context.close(); }
});

await scenario("human practice prompt respects sound settings", async () => {
  const { context, page } = await fresh();
  try {
    await finish(page);
    // Exercise the actual prompt function with human clips enabled locally.
    // Audio is a silent spy: no file or OS audio device is ever played.
    const results = await page.evaluate(async () => {
      const oldAudio = window.Audio, oldHuman = HUMANCLIPS, oldItem = ITEM, oldProfile = profile;
      const calls = [];
      window.Audio = class {
        constructor(src) { this.src = src; this.volume = 1; }
        play() { calls.push({ src: this.src, volume: this.volume }); queueMicrotask(() => this.onended && this.onended()); return Promise.resolve(); }
      };
      HUMANCLIPS = true; ITEM = { level: "isolation" };
      const results = [];
      try {
        for (const settings of [{ volume: 0, voiceOn: true }, { volume: 0.4, voiceOn: false }, { volume: 0.35, voiceOn: true }]) {
          profile = Object.assign({}, oldProfile, settings); calls.length = 0;
          await playPrompt(); results.push({ settings, calls: calls.slice() });
        }
      } finally { window.Audio = oldAudio; HUMANCLIPS = oldHuman; ITEM = oldItem; profile = oldProfile; }
      return results;
    });
    ok("zero volume never starts the human prompt", results[0].calls.length === 0, results[0]);
    ok("disabled voice never starts the human prompt", results[1].calls.length === 0, results[1]);
    ok("a human prompt honors the selected positive volume", results[2].calls.length === 1 && results[2].calls[0].volume === 0.35 && /\/coach\/say\/R\.mp3$/.test(results[2].calls[0].src), results[2]);
  } finally { await context.close(); }
});

await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log(`\n${assertions} assertions, ${failures} failures (${publicRoot})`);
process.exitCode = failures ? 1 : 0;
