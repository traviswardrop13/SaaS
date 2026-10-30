// The first older-child adventure uses the real Fruit Slice round, while
// existing story indices, the younger child's day and ordinary Arcade stay put.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const before = process.env.SONATEST_PUBLIC_ROOT;
const mime = { html: "text/html", js: "text/javascript", css: "text/css", webp: "image/webp", svg: "image/svg+xml", woff2: "font/woff2", wav: "audio/wav" };
const server = createServer((req, res) => {
  const u = new URL(req.url, "http://local");
  if (u.pathname === "/__sona" || u.pathname === "/today.html") { res.writeHead(200, { "content-type": "text/html" }); res.end('<!doctype html><script src="/sona.js"></script>'); return; }
  if (u.pathname.startsWith("/api/")) { res.writeHead(503); res.end("{}"); return; }
  const old = before && path.join(before, u.pathname), file = old && existsSync(old) ? old : path.join(ROOT, u.pathname);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": mime[file.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch(launchOpts());
let failures = 0;
function ok(label, pass, detail) { if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + label + (!pass && detail ? " " + JSON.stringify(detail) : "")); }
async function open({ age = 7, fresh = true, premium = true, quest = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await ctx.route("**/*", (r) => r.request().url().startsWith(origin) ? r.continue() : r.abort());
  await ctx.addInitScript(({ age, fresh, premium, quest }) => {
    if (localStorage.getItem("__signatureSeed")) return;
    localStorage.setItem("__signatureSeed", "1");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: String(age), focusSounds: ["R"], onboarded: !fresh, earlyAdopter: premium, volume: 0, voiceOn: false }));
    localStorage.setItem("sona.freeera.v1", "post");
    [2, 3, 4, 5].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", "done"));
    localStorage.setItem("sona.freever.v1", "kept"); localStorage.setItem("sona.buddyset.v1", "kept");
    localStorage.setItem("sona.offerseen.v1", "1");
    if (quest) localStorage.setItem("sona.quest.v1", JSON.stringify(quest));
  }, { age, fresh, premium, quest });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
  const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(origin + "/__sona");
  if (fresh) await pg.evaluate(() => Sona.saveProfile({ onboarded: true }));
  return { ctx, pg, errors };
}
try {
  const { ctx, pg } = await open();
  const first = await pg.evaluate(() => ({ q: Sona.questToday(), rec: JSON.parse(localStorage.getItem("sona.quest.v1") || "{}"), access: Sona.gameAccess("slice") }));
  ok("a new older child starts with the picnic as Day 1", first.q.kind === "story" && first.q.day === 1 && first.q.story.id === "fruitpicnic", first.q);
  ok("the story still enters through Fruit Slice's five-saying practice page", first.q.story.page === "/charge.html?game=arcade-slice.html&story=fruitpicnic", first.q.story.page);
  ok("the ordinary free Fruit Slice game keeps its catalog access", first.access.allowed && first.access.tier === "free", first.access);
  if (first.q.story.id === "fruitpicnic") {
    const paths = await pg.evaluate(() => {
      const plain = Sona.questEnd("slice"), before = Sona.storyGame("fruitpicnic", "slice");
      return { plain, before, f: Sona.storyFound() };
    });
    ok("ordinary Arcade play cannot finish the picnic", paths.plain === null && paths.f.length === 0, paths);
    ok("a pasted story URL before the intro grants no story context", !paths.before, paths);
    await pg.goto(origin + "/adventure.html");
    await pg.locator("#startBtn").click();
    for (let i = 0; i < 2; i++) { await pg.waitForTimeout(650); await pg.locator("#nextBtn").click(); }
    await pg.waitForTimeout(650); await pg.locator("#goBtn").click();
    await pg.waitForURL("**/charge.html?game=arcade-slice.html&story=fruitpicnic");
    const warmup = await pg.evaluate(() => ({ game: GAME, need: NEED, valid: Sona.storyGame("fruitpicnic", "slice"), other: Sona.storyGame("fruitpicnic", "glide") }));
    ok("the short intro enters the real five-saying warm-up with verified context", warmup.game === "arcade-slice.html" && warmup.need === 5 && !!warmup.valid && !warmup.other, warmup);
    // The game page must retain the earned charge gate, in this story too.
    await pg.goto(origin + "/arcade-slice.html?from=charge&story=fruitpicnic");
    ok("a story URL without a practice ticket cannot play", await pg.evaluate(() => typeof tok !== "undefined" && !tok && document.getElementById("needOvl").classList.contains("show")));
    await pg.goto(origin + "/charge.html?game=arcade-slice.html&story=fruitpicnic");
    // The existing practice suites prove the five voiced tries. Here its
    // normal success callback must carry this new context through the real
    // token mint and microphone-close hand-off, not a test-created URL.
    await pg.evaluate(() => { booted = true; practicePaused = practiceClosed = practiceTerminal = false; anyReps = true; attemptsTotal = 5; lastVerdict = "pass"; launched = false; launchGame(); });
    await pg.waitForURL("**/arcade-slice.html?from=charge&story=fruitpicnic");
    await pg.waitForFunction(() => window.gameEntryAllowed && typeof endRound === "function");
    ok("the normal practice completion carries the story and earned ticket to the actual game", await pg.evaluate(() => tok && storyPlay.id === "fruitpicnic" && !document.getElementById("needOvl").classList.contains("show")));
    await pg.evaluate(() => { gameOver = true; finaleDone = false; score = 3; endRound(); });
    const loss = await pg.evaluate(() => ({ q: Sona.questToday(), f: Sona.storyFound(), button: document.getElementById("endCharge").textContent }));
    ok("a gameplay loss leaves the picnic open and offers another try", loss.q.state === "open" && loss.f.length === 0 && loss.button === "Play again", loss);
    await pg.evaluate(() => sessionStorage.setItem("sona.play.token", "arcade-slice.html"));
    await pg.reload(); await pg.waitForFunction(() => window.gameEntryAllowed && typeof endRound === "function");
    await pg.evaluate(() => { gameOver = false; finaleDone = true; score = 8; endRound(); });
    const win = await pg.evaluate(() => ({ q: Sona.questToday(), f: Sona.storyFound(), ending: Sona.storyEnding("fruitpicnic"), rec: JSON.parse(localStorage.getItem("sona.quest.v1")), button: document.getElementById("endCharge").textContent }));
    ok("the real round's completion earns one story and its sticker", win.q.state === "done" && win.q.day === 1 && win.ending.ok && win.f.length === 1 && win.rec.f.join() === "14" && win.ending.got.length === 1, win);
    ok("the ending button hands back to this picnic", win.button === "See what happens!", win.button);
    await pg.locator("#endCharge").click(); await pg.waitForURL("**/adventure.html?part=end&story=fruitpicnic");
    ok("the earned ending opens on Day 1", await pg.locator("#startDay").textContent() === "Day 1");
    await pg.goto(origin + "/__sona");
    const later = await pg.evaluate(() => { const r = JSON.parse(localStorage.getItem("sona.quest.v1")); const d = new Date(); d.setDate(d.getDate() - 1); const t = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); r.a = r.sv = r.fd = r.done = t; localStorage.setItem("sona.quest.v1", JSON.stringify(r)); return Sona.questToday(); });
    ok("tomorrow continues to the lighthouse as Day 2 without shifting its saved index", later.day === 2 && later.story.id === "lighthouse", later);
    const replay = await pg.evaluate(() => Sona.storyFound()[0].again);
    await pg.goto(origin + replay);
    ok("the found game's replay returns through practice with verified replay context", await pg.evaluate(() => storyPlay && storyPlay.replay && GAME === "arcade-slice.html"));
    await pg.evaluate(() => sessionStorage.setItem("sona.play.token", "arcade-slice.html"));
    await pg.goto(origin + "/arcade-slice.html?from=charge&story=fruitpicnic&again=1");
    await pg.waitForFunction(() => window.gameEntryAllowed && typeof endRound === "function");
    await pg.evaluate(() => { gameOver = false; finaleDone = true; score = 8; endRound(); });
    const again = await pg.evaluate(() => ({ q: Sona.questToday(), f: Sona.storyFound().length, button: document.getElementById("endCharge").textContent }));
    ok("replaying Fruit Slice finishes no new story and keeps Play again", again.q.state === "open" && again.q.story.id === "lighthouse" && again.f === 1 && again.button === "Play again", again);
    await pg.locator("#endCharge").click(); await pg.waitForURL("**/charge.html?game=arcade-slice.html&story=fruitpicnic&again=1");
    ok("another replay keeps the five-saying warm-up", await pg.evaluate(() => GAME === "arcade-slice.html" && NEED === 5 && storyPlay.replay));
  }
  await ctx.close();
  for (const opts of [{ age: 4 }, { fresh: false }, { fresh: false, quest: { s: 3, ls: 2, lk: "story", done: "2026-01-01" } }]) {
    const { ctx, pg } = await open(opts), q = await pg.evaluate(() => Sona.questToday());
    ok(opts.age === 4 ? "a new younger child keeps the lighthouse first" : "an existing child's story order remains unchanged", q.kind === "story" && q.story.id !== "fruitpicnic" && (opts.age !== 4 || q.day === 1), q);
    await ctx.close();
  }
  const { ctx: freeCtx, pg: freePg } = await open({ premium: false });
  const free = await freePg.evaluate(() => ({ s: Sona.gameAccess("slice"), p: Sona.gameAccess("fruitpicnic"), route: Sona.storyGame ? Sona.storyGame("fruitpicnic", "slice") : null }));
  ok("the new alias never locks the free Arcade game or opens a paid story", free.s.allowed && !free.p.allowed && !free.route, free);
  await freeCtx.close();
} finally { await browser.close(); await new Promise((r) => server.close(r)); }
console.log(failures ? failures + " signature adventure checks failed" : "All signature adventure checks passed");
process.exit(failures ? 1 : 0);
