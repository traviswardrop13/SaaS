// STORY1: the episode engine, now used for ONE thing — the cliffhanger on the
// win overlay. Asserts the engine's contracts (a beat per round, a hook, one
// chapter per DAY), that the home deck carries a card per game, that the hook
// renders when a run finishes, and — deliberately — that NO story card ever
// interrupts a round. The games are the games.
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

// ── the home deck: hero + two up-next, one card per game ──
await page.evaluate(() => { localStorage.removeItem("sona.episode.v1"); });
await page.goto("http://localhost:8151/today.html");
await page.waitForTimeout(800);
const deck = await page.evaluate(() => ({
  hero: document.getElementById("heroName").textContent,
  launch: document.getElementById("goBtn").dataset.launch,
  cta: document.getElementById("goBtn").textContent,
  thumbs: [...document.querySelectorAll("#thumbs .thumb")].map((t) => ({ k: t.dataset.key, n: t.querySelector("b").textContent })),
  chapPill: !!document.getElementById("chapPill"),
}));
ok("deck names the hero activity", deck.hero.length > 3, deck.hero);
// DAY1: the hero is today's CHAPTER until it's read — the day starts with the
// story, and the games are what reading it earns.
ok("hero card opens a real door", /^\/(chapter\.html|charge\.html\?game=|story\.html|arcade-feed\.html)/.test(deck.launch || ""), deck.launch);
ok("CTA offers the story first", /READ TODAY.S STORY/i.test(deck.cta), deck.cta);
ok("three named game cards sit below", deck.thumbs.length === 3 && deck.thumbs.every((t) => t.n.length > 3), JSON.stringify(deck.thumbs));
ok("home screen carries no chapter furniture", !deck.chapPill);

// ── NO story card interrupts a round, daily or free play ──
// This is the point of the change. Beats used to open every round and a child
// had to sit through one before practising. The engine survives for the win
// screen; nothing may render it mid-practice.
for (const url of ["/charge.html?daily=1&sound=R", "/charge.html?game=arcade-slice.html"]) {
  await page.goto("http://localhost:8151" + url);
  await page.waitForTimeout(1600);
  const quiet = await page.evaluate(() => ({
    card: !!document.getElementById("storyCard"),
    target: (document.getElementById("bTarget") || {}).textContent || "",
  }));
  ok("no story card on " + url, !quiet.card, "the storyCard element is still in the page");
  ok("the round goes straight to a practice target on " + url, quiet.target.length > 0, quiet.target);
}
{
  const src = readFileSync(ROOT + "/charge.html", "utf8");
  ok("charge.html has no story-beat code left", !/storyBeat|STORYHOUSE|houseBeat/.test(src),
    "a beat function left behind is a beat that comes back");
  ok("the mic primer hands straight to the OS prompt",
    /await micPrimer\(\);\s*\n\s*try\{ micStream=await navigator\.mediaDevices\.getUserMedia/.test(src),
    "anything between the primer tap and getUserMedia delays the browser dialog");
}

// ── regression guards that outlived the story beat ──
// ── the beat must FINISH SPEAKING before the round's prompt plays ──
{
  const src = readFileSync(ROOT + "/charge.html", "utf8");
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

// ── the cliffhanger lands on the finish overlay ──
await page.evaluate(() => {
  sessionStorage.setItem("sona.run.v1", JSON.stringify({ active: true, round: 5, sum: 40, scores: [8, 8, 8, 8, 8], sound: "R", level: 1, pending: false }));
});
await page.goto("http://localhost:8151/charge.html?daily=1&sound=R");
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
