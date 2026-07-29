// STORY1 + CITY1: every HOUSE runs its own serial. Asserts the engine's
// contracts (a beat per round, a cliffhanger, one chapter per house per DAY,
// houses advancing independently), that the beat card appears and clears itself
// without a tap, that the hook renders on the finish overlay, and that the city
// street offers one door per game.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8151, r));

const browser = await chromium.launch(launchOpts(["--autoplay-policy=no-user-gesture-required"]));
const ctx = await browser.newContext({ permissions: ["microphone"], viewport: { width: 430, height: 932 } });
const page = await ctx.newPage();
let errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.addInitScript(() => {
  // a realistic SILENT mic: a bare `new MediaStream()` has no audio track, so
  // createMediaStreamSource throws once the round gets as far as the engine.
  // Gain 0 keeps it silent, so the VAD can't count phantom reps.
  navigator.mediaDevices.getUserMedia = () => {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const dst = ac.createMediaStreamDestination();
      const g = ac.createGain(); g.gain.value = 0; g.connect(dst);
      const osc = ac.createOscillator(); osc.connect(g); osc.start();
      return Promise.resolve(dst.stream);
    } catch (e) { return Promise.resolve(new MediaStream()); }
  };
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: "7", focusSounds: ["R"], onboarded: true, voiceOn: false }));
  localStorage.setItem("sona.micok", "1");
});
let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

// ── engine contracts ──
await page.goto("http://localhost:8151/today.html");
await page.waitForTimeout(700);
const eng = await page.evaluate(() => {
  const n = Sona.EPISODES.length;
  const shapes = Sona.EPISODES.map((e) => ({ beats: e.beats.length, hook: !!e.hook, open: !!e.open, t: !!e.t }));
  return {
    n,
    allShaped: shapes.every((s) => s.beats === 4 && s.hook && s.open && s.t),
    open: Sona.episodeBeat(0),
    b1: Sona.episodeBeat(1),
    b4: Sona.episodeBeat(4),
    beyond: Sona.episodeBeat(99),        // must not throw or return undefined
    hook: Sona.episodeHook(),
    chapter: Sona.episodeNum(),
  };
});
ok("episode library is populated", eng.n >= 8, `got ${eng.n}`);
ok("every episode has an opener, 4 beats and a cliffhanger", eng.allShaped);
ok("round 0 gets the chapter opener", !!eng.open && eng.open === eng.open);
ok("each round has its own beat", eng.b1 && eng.b4 && eng.b1 !== eng.b4);
ok("a round past the last beat still returns copy (no crash, no blank)", !!eng.beyond);
ok("cliffhanger names what happens next", /tomorrow/i.test(eng.hook));
ok("chapter number is 1-based", eng.chapter === 1);

// ── one chapter per DAY: a replayed run can't skip ahead ──
const adv = await page.evaluate(() => {
  const a = Sona.episodeNum();
  Sona.episodeAdvance();
  const b = Sona.episodeNum();
  Sona.episodeAdvance(); Sona.episodeAdvance();   // same local day
  const c = Sona.episodeNum();
  return { a, b, c };
});
ok("finishing a run advances one chapter", adv.b === adv.a + 1, JSON.stringify(adv));
ok("replaying the same day does NOT skip chapters", adv.c === adv.b, JSON.stringify(adv));

// ── CITY1: the street shows what is waiting behind every door ──
await page.evaluate(() => { localStorage.removeItem("sona.episode.v1"); localStorage.removeItem("sona.houses.v1"); });
await page.goto("http://localhost:8151/today.html");
await page.waitForTimeout(800);
const street = await page.evaluate(() => ({
  n: document.querySelectorAll("#street .house").length,
  engineN: Sona.HOUSES.length,
  today: document.querySelectorAll("#street .house.today").length,
  dots: document.querySelectorAll("#dots i").length,
  chaps: [...document.querySelectorAll("#street .house")].map((h) => ({
    key: h.dataset.key, chap: (h.querySelector(".hchap") || {}).textContent || "",
    game: (h.querySelector(".hgame") || {}).textContent || "",
  })),
  // every house key must resolve to a real arc, or a door opens on nothing
  arcs: Sona.HOUSES.map((h) => ({ key: h.key, len: Sona.houseArcLen(h.key), arc: Sona.houseArc(h.key) })),
}));
ok("street has one house per game", street.n === street.engineN && street.n >= 6, street.n + "/" + street.engineN);
ok("one house is today's stop", street.today === 1, String(street.today));
ok("a dot per house", street.dots === street.n, street.dots + "/" + street.n);
ok("every house names its game", street.chaps.every((c) => c.game.length > 3), JSON.stringify(street.chaps.filter((c) => c.game.length <= 3)));
ok("every house plate shows the chapter waiting inside",
  street.chaps.every((c) => /^Chapter 1 · .{4,}/.test(c.chap)),
  JSON.stringify(street.chaps.filter((c) => !/^Chapter 1 · .{4,}/.test(c.chap))));
ok("every house has a real arc behind it",
  street.arcs.every((a) => a.len >= 3 && a.arc.length > 6),
  JSON.stringify(street.arcs.filter((a) => !(a.len >= 3 && a.arc.length > 6))));

// ── house arcs advance INDEPENDENTLY, one chapter per house per day ──
const harc = await page.evaluate(() => {
  localStorage.removeItem("sona.houses.v1");
  const a = Sona.houseChapterNum("slice"), other0 = Sona.houseChapterNum("tiles");
  Sona.houseAdvance("slice");
  const b = Sona.houseChapterNum("slice"), other1 = Sona.houseChapterNum("tiles");
  Sona.houseAdvance("slice"); Sona.houseAdvance("slice");   // same local day
  const c = Sona.houseChapterNum("slice");
  return { a, b, c, other0, other1,
    beat0: Sona.houseBeat("slice", 0), beat1: Sona.houseBeat("slice", 1), beat4: Sona.houseBeat("slice", 4),
    beyond: Sona.houseBeat("slice", 99), hook: Sona.houseHook("slice"),
    unknown: Sona.houseBeat("nope", 0) };
});
ok("finishing a house advances that house one chapter", harc.b === harc.a + 1, JSON.stringify(harc));
ok("replaying the same day does NOT skip a house chapter", harc.c === harc.b, JSON.stringify(harc));
ok("one house's story never moves another's", harc.other1 === harc.other0, JSON.stringify(harc));
ok("round 0 gets the house chapter opener", !!harc.beat0);
ok("each round gets its own house beat", harc.beat1 && harc.beat4 && harc.beat1 !== harc.beat4);
ok("a round past the last house beat still returns copy", !!harc.beyond);
ok("house cliffhanger names what happens next", /(tomorrow|next time)/i.test(harc.hook), harc.hook);
ok("an unknown house returns nothing rather than throwing", harc.unknown === "");
await page.evaluate(() => localStorage.removeItem("sona.houses.v1"));

// ── the beat card opens the round and clears ITSELF ──
await page.goto("http://localhost:8151/charge.html?daily=1&house=slice&sound=R");
await page.waitForTimeout(900);
let card = await page.evaluate(() => ({
  shown: document.getElementById("storyCard").classList.contains("show"),
  ttl: document.getElementById("storyTtl").textContent,
  txt: document.getElementById("storyTxt").textContent,
}));
ok("a house round opens on that house's story beat", card.shown, JSON.stringify(card));
ok("round 1 names the chapter", /Chapter 1/.test(card.ttl), card.ttl);
ok("the beat is the FRUIT MARKET's, not some other house's",
  /fruit|pia/i.test(card.txt), card.txt);
ok("beat carries real story copy", card.txt.length > 20, card.txt);
// it must get out of the child's way on its own — no tap required
await page.waitForTimeout(4600);
card = await page.evaluate(() => document.getElementById("storyCard").classList.contains("show"));
ok("beat card clears itself (no tap needed)", !card);

// ── the beat must FINISH SPEAKING before the round's prompt plays ──
// Regression: the beat used to fire say() un-awaited behind a fixed timer, so
// the story line and the prompt clip played on top of each other. Two voices.
{
  const src = readFileSync(ROOT + "/charge.html", "utf8");
  ok("story beat awaits its own speech before the round starts",
    /Promise\.all\(\[spoke,\s*minShow\]\)/.test(src),
    "a fixed timer that resolves while TTS is still playing overlaps the prompt");
  ok("story beat still has a hard cap so a stuck TTS can't hang the round",
    /cap\s*=\s*new Promise/.test(src));
  // Rachel's clips must be off on EVERY surface. charge.html gating its own
  // local copy is exactly how coach-call.html kept playing them.
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  const call = readFileSync(ROOT + "/coach-call.html", "utf8");
  ok("the human-clip switch is shared, not per-page",
    /const HUMAN_CLIPS = false;/.test(sona) && /humanClipsOn/.test(src),
    "a local per-page flag lets other pages ship her voice anyway");
  ok("coach-call.html gates its demo clips too",
    /humanClipsOn/.test(call),
    "playDemo() plays /coach/say/<SOUND>-demo.mp3 — Rachel's voice — and was ungated");
  // Locking the phone fires visibilitychange, NOT pagehide. Every page holding
  // a mic must release on both, or the recording indicator stays lit in a
  // pocket and game timers keep advancing.
  ok("sona.js exposes a shared onBackground()",
    /function onBackground\(/.test(sona) && /visibilitychange/.test(sona),
    "pagehide alone never fires on screen lock");
  for (const g of ["arcade-slice", "arcade-tiles", "arcade-stack", "arcade-run", "arcade-glide", "arcade-feed"]) {
    const gs = readFileSync(ROOT + "/" + g + ".html", "utf8");
    ok(g + " releases its mic when backgrounded", /onBackground/.test(gs),
      "this game holds its own boost mic and only listened to pagehide");
  }
  ok("charge.html releases the mic when backgrounded", /onBackground/.test(src));

  ok("children aren't stuck at 30% volume",
    /volume: 0\.8/.test(sona) && !/volume: 0\.3/.test(sona),
    "DEFAULT_PROFILE volume 0.3 with no slider left every family inaudible");
}

// ── CITY1: free play inside a house gets that house's story too. The
// unfinished thread IS the reason a child picks a door, so it cannot depend on
// arriving through the daily rail.
await page.evaluate(() => localStorage.removeItem("sona.houses.v1"));
await page.goto("http://localhost:8151/charge.html?game=arcade-tiles.html");
await page.waitForTimeout(1400);
const free = await page.evaluate(() => ({
  shown: document.getElementById("storyCard").classList.contains("show"),
  txt: document.getElementById("storyTxt").textContent,
}));
ok("free play in a house shows that house's beat", free.shown, JSON.stringify(free));
ok("the free-play beat belongs to the MUSIC HALL", /piano|mo\b/i.test(free.txt), free.txt);

// ── ?house= pins every round to that house's ONE game ──
// Without this the daily run rotates a different game each round, which is the
// behaviour the city replaced: a child who walks into the fruit market must not
// come out holding a piano.
{
  const src = readFileSync(ROOT + "/charge.html", "utf8");
  ok("a house session pins the game for every round",
    /HOUSEGAME\s*\|\|\s*\(isDaily/.test(src),
    "GAME must prefer the house's game over the per-round rotation");
  ok("the run remembers the house across the arcade round-trip",
    /run\.house/.test(src),
    "the arcade returns ?daily=1&banked=N with no house param");
  ok("the mic is settled BEFORE the story beat plays",
    src.indexOf("await micPrimer()") < src.indexOf("await storyBeat()"),
    "a story card between the primer tap and the OS prompt delays the dialog");
}

// ── the cliffhanger lands on the finish overlay ──
await page.evaluate(() => {
  sessionStorage.setItem("sona.run.v1", JSON.stringify({ active: true, round: 5, sum: 40, scores: [8, 8, 8, 8, 8], sound: "R", level: 1, pending: false }));
});
await page.goto("http://localhost:8151/charge.html?daily=1&house=slice&sound=R");
await page.waitForTimeout(1200);
const fin = await page.evaluate(() => ({
  ovl: document.getElementById("runOvl").classList.contains("show"),
  hookShown: document.getElementById("runHook").style.display === "block",
  hook: document.getElementById("runHookTxt").textContent,
}));
ok("finished run shows the win overlay", fin.ovl);
ok("win overlay carries the cliffhanger", fin.hookShown && fin.hook.length > 10, JSON.stringify(fin));

ok("no pageerrors", errs.length === 0, errs.join(" | "));
await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
