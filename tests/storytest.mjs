// STORY1: the episode engine, now used for ONE thing — drawing the day's trio
// of games and turning its page at the end of a run (the cliffhanger on the
// win overlay went with the books, GAMES1, 19 Sep 2026). Asserts the engine's
// contracts (a beat per round, a hook, one chapter per DAY), that the home
// deck carries a card per game, that the win screen shows no cliffhanger, and
// — deliberately — that NO story card ever interrupts a round. The games are
// the games.
import { createServer } from "http";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", mp3: "audio/mpeg" };
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
    allShaped: shapes.every((s) => s.beats === 6 && s.hook && s.open && s.t),
    open: Sona.episodeBeat(0),
    b1: Sona.episodeBeat(1),
    b4: Sona.episodeBeat(4),
    beyond: Sona.episodeBeat(99),        // must not throw or return undefined
    hook: Sona.episodeHook(),
    chapter: Sona.episodeNum(),
  };
});
ok("episode library is populated", eng.n >= 10, `got ${eng.n}`);
ok("every episode has an opener, 6 beats and a cliffhanger", eng.allShaped);
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

// ── Home is the game library; the parked story engine stays off the menu ──
await page.evaluate(() => { localStorage.removeItem("sona.episode.v1"); });
await page.goto("http://localhost:8151/today.html");
await page.waitForTimeout(800);
const deck = await page.evaluate(() => ({
  title: document.querySelector(".library-intro h1").textContent,
  cards: [...document.querySelectorAll("#activityGroups .game-card[data-game]")].map(card => ({ k: card.dataset.game, n: card.querySelector(".game-name").textContent })),
  expected: Sona.activityLibrary().groups.flatMap(group => group.games.map(game => game.key)),
  chapPill: !!document.getElementById("chapPill"),
  bookLinks: [...document.querySelectorAll('a[href]')].filter(a => /\/(chapter|story|library)\.html/.test(a.getAttribute('href'))).length,
}));
ok("Home invites choosing a game", /pick a game/i.test(deck.title), deck.title);
ok("every catalog game has a named card in the age shelves", JSON.stringify(deck.cards.map(card => card.k)) === JSON.stringify(deck.expected) && deck.cards.every(card => card.n.length > 3), JSON.stringify(deck.cards));
ok("Home stays at the library until a game is chosen", /today\.html$/.test(page.url()), page.url());
ok("home screen carries no chapter furniture or reader links", !deck.chapPill && deck.bookLinks === 0);

// ── NO story card interrupts a round, daily or free play ──
// This is the point of the change. Beats used to open every round and a child
// had to sit through one before practicing. The engine survives for the win
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
    /await micPrimer\(\);\s*if\(!\(await acquirePracticeMic\(\)\)\)return;/.test(src)
    && /async function acquirePracticeMic\(\)[\s\S]*?navigator\.mediaDevices\.getUserMedia\(\{audio:true,video:false\}\)/.test(src),
    "anything between the primer tap and getUserMedia delays the browser dialog");
}

// ── regression guards that outlived the story beat ──
// ── the beat must FINISH SPEAKING before the round's prompt plays ──
{
  const src = readFileSync(ROOT + "/charge.html", "utf8");
  // Rachel's RAW takes (/coach/say/) never play on any surface: what plays is
  // the set re-voiced into Echo's voice (/coach/say-echo/, tools/revoice.mjs),
  // switched ON on 25 Sep 2026 so the mirrored sounds can be heard in the app.
  // The switch stays shared: charge.html gating its own local copy is exactly
  // how coach-call.html kept playing her raw voice.
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  const call = readFileSync(ROOT + "/coach-call.html", "utf8");
  ok("the human-clip switch is shared, not per-page, and on",
    /const HUMAN_CLIPS = true;/.test(sona) && /humanClipsOn/.test(src) && /humanClipsOn/.test(call),
    "a local per-page flag lets other pages ship her raw voice anyway");
  {
    const pages = readdirSync(ROOT).filter((n) => /\.(html|js)$/.test(n));
    const raw = pages.filter((n) => /["']\/coach\/say\//.test(readFileSync(ROOT + "/" + n, "utf8")));
    ok("no page plays Rachel's raw takes from /coach/say/", raw.length === 0, raw.join(", "));
    ok("practice and Coach Call play the re-voiced set", /"\/coach\/say-echo\/"\+SOUND\+"\.mp3"/.test(src) && /"\/coach\/say-echo\/"\+SOUND\+"-demo\.mp3"/.test(call));
    const need = readdirSync(ROOT + "/coach/say").filter((n) => n.endsWith(".mp3"));
    const missing = need.filter((n) => !existsSync(ROOT + "/coach/say-echo/" + n) || statSync(ROOT + "/coach/say-echo/" + n).size < 5000);
    ok("every one of Rachel's " + need.length + " takes has a re-voiced twin", missing.length === 0, missing.join(", "));
    // Loudness (25 Sep 2026). /api/tts levels every generated line on the
    // server (-20 dB RMS over its spoken frames, no peak above -3 dB); a clip
    // plays as-is, so it was the one sound left that could jump — the set came
    // back from ElevenLabs 2–5 dB hotter than the lines around it, peaks at the
    // ceiling. tools/levelclips.mjs brings every clip to the route's level with
    // the route's own levelPcm; this holds it there, measured the way the route
    // measures. A clip whose peak cap won sits under -20 dB on purpose.
    const levels = await page.evaluate(async (names) => {
      const measure = (x, rate) => {
        const n = x.length; let peak = 0;
        for (let i = 0; i < n; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; }
        const F = Math.round(rate * 0.02), frames = [];
        for (let s = 0; s < n; s += F) { const e = Math.min(n, s + F); let sum = 0; for (let i = s; i < e; i++) sum += x[i] * x[i]; frames.push({ sum, len: e - s }); }
        const db = (a) => 20 * Math.log10(a || 1e-12), amp = (d) => Math.pow(10, d / 20);
        const spoken = frames.filter((f) => f.sum / f.len >= amp(-50) ** 2);
        let rms = 0;
        if (spoken.length) {
          const mean = spoken.reduce((t, f) => t + f.sum, 0) / spoken.reduce((t, f) => t + f.len, 0);
          const speech = spoken.filter((f) => f.sum / f.len >= mean * amp(-20) ** 2);
          rms = Math.sqrt(speech.reduce((t, f) => t + f.sum, 0) / speech.reduce((t, f) => t + f.len, 0));
        }
        return { peak: +db(peak).toFixed(1), rms: +db(rms).toFixed(1) };
      };
      const actx = new OfflineAudioContext(1, 1, 24000), out = {};
      for (const n of names) {
        try { const buf = await actx.decodeAudioData(await (await fetch("/coach/say-echo/" + n)).arrayBuffer()); out[n] = measure(buf.getChannelData(0), buf.sampleRate); }
        catch (e) { out[n] = { err: String(e).slice(0, 80) }; }
      }
      return out;
    }, need);
    const off = Object.entries(levels).filter(([, m]) => m.err || m.peak > -2.5 || (Math.abs(m.rms + 20) > 0.7 && !(m.rms < -20 && m.peak > -3.6)));
    ok("every re-voiced clip sits at the TTS level (-20 dB RMS, peaks under -3 dB)", off.length === 0, off.map(([n, m]) => n + " " + JSON.stringify(m)).join("; "));
  }
  // Locking the phone fires visibilitychange, NOT pagehide. Every page holding
  // a mic must release on both, or the recording indicator stays lit in a
  // pocket and game timers keep advancing.
  ok("sona.js exposes a shared onBackground()",
    /function onBackground\(/.test(sona) && /visibilitychange/.test(sona),
    "pagehide alone never fires on screen lock");
  for (const g of ["arcade-slice", "arcade-tiles", "arcade-stack", "arcade-run", "arcade-glide", "arcade-feed"]) {
    const gs = readFileSync(ROOT + "/" + g + ".html", "utf8");
    ok(g + " releases its mic when backgrounded", /onBackground/.test(gs),
      "this game holds its own keep-playing mic and only listened to pagehide");
  }
  ok("charge.html releases the mic when backgrounded", /onBackground/.test(src));

  ok("children aren't stuck at 30% volume",
    /volume: 0\.8/.test(sona) && !/volume: 0\.3/.test(sona),
    "DEFAULT_PROFILE volume 0.3 with no slider left every family inaudible");
}

// ── the finish overlay: no cliffhanger (the books are parked), and the season still turns ──
await page.evaluate(() => {
  sessionStorage.setItem("sona.run.v1", JSON.stringify({ active: true, round: 5, sum: 40, scores: [8, 8, 8, 8, 8], sound: "R", level: 1, pending: false }));
});
await page.goto("http://localhost:8151/charge.html?daily=1&sound=R");
await page.waitForTimeout(1200);
const fin = await page.evaluate(() => ({
  ovl: document.getElementById("runOvl").classList.contains("show"),
  hook: !!document.getElementById("runHook"),
}));
ok("finished run shows the win overlay", fin.ovl);
// GAMES1: the cliffhanger promised a chapter that no longer opens, so the win
// screen shows none — but the run still turns the season's page, which is
// what draws tomorrow a different trio (the engine half is pinned above).
ok("the win overlay carries no cliffhanger", fin.hook === false, JSON.stringify(fin));
{
  const src = readFileSync(ROOT + "/charge.html", "utf8");
  ok("…and the finish still turns the season's page", /episodeAdvance\(\)/.test(src) && !/episodeHook/.test(src));
}

ok("no pageerrors", errs.length === 0, errs.join(" | "));
// ── SCENE1: the story has pictures ────────────────────────────────────────
// The 10 Aug review's Priority 1, verbatim: "across five pages the illustration
// never changes — same Echo, same pose, same starfield; only the text swaps."
// For readers aged 3-8 the text was doing 100% of the storytelling. These pin
// that it cannot silently go back: every chapter has its own world, and Echo
// moves through it.
{
  const src = readFileSync(ROOT + "/sona.js", "utf8");
  const blk = src.slice(src.indexOf("const CHAPTER_SCENES"), src.indexOf("const POSE_SRC"));
  const ids = [...blk.matchAll(/\n    (\w+):\s*\{/g)].map((m) => m[1]);
  ok("every chapter in the season has a scene", ids.length >= 30, String(ids.length));
  const skies = new Set([...blk.matchAll(/sky: "(\w+)"/g)].map((m) => m[1]));
  ok("the season uses many worlds, not one", skies.size >= 10, [...skies].join(","));
  // decor hidden behind the story text is decor nobody sees — the star's own
  // glow was the first casualty, buried under the sentence describing it
  const buried = [...blk.matchAll(/D\.(?:glow|sun|moon)\("(\d+)%"/g)]
    .map((m) => +m[1]).filter((t) => t >= 44 && t <= 68);
  ok("no decor is parked behind the story text", buried.length === 0, JSON.stringify(buried));

  const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await pg.goto("http://localhost:8151/today.html");
  await pg.evaluate(() => {
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done");
    Sona.saveProfile({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true });
  });
  // two different chapters must not look the same
  const look = async (n) => {
    await pg.evaluate((k) => {
      localStorage.setItem(Sona.kkey("sona.episode.v2"), JSON.stringify({ i: k - 1, day: "" }));
      localStorage.removeItem(Sona.kkey("sona.day.v2"));
    }, n);
    await pg.goto("http://localhost:8151/chapter.html"); await pg.waitForTimeout(700);
    return pg.evaluate(() => ({
      sky: getComputedStyle(document.body).backgroundImage,
      pose: (document.getElementById("echo").getAttribute("src") || ""),
      decor: document.getElementById("scene").children.length,
      stars: getComputedStyle(document.getElementById("stars")).display,
    }));
  };
  const c1 = await look(1), c12 = await look(12), c18 = await look(18);
  ok("chapter 1 opens on its own world", c1.decor > 0 && /gradient/.test(c1.sky), JSON.stringify(c1));
  ok("a different chapter is a different world", c1.sky !== c12.sky, JSON.stringify([c1.sky.slice(0, 30), c12.sky.slice(0, 30)]));
  // the starfield belongs to the night chapters; underwater it reads as dirt
  ok("the starfield is not painted over every chapter", c18.stars === "none", c18.stars);

  // Echo acts: his pose changes as the pages turn
  await pg.evaluate((k) => {
    localStorage.setItem(Sona.kkey("sona.episode.v2"), JSON.stringify({ i: k - 1, day: "" }));
    localStorage.removeItem(Sona.kkey("sona.day.v2"));
  }, 1);
  await pg.goto("http://localhost:8151/chapter.html"); await pg.waitForTimeout(700);
  const poses = [];
  for (let k = 0; k < 6; k++) {
    poses.push(await pg.evaluate(() => document.getElementById("echo").getAttribute("src")));
    await pg.evaluate(() => document.getElementById("next").click());
    await pg.waitForTimeout(340);
  }
  ok("Echo is an actor, not a portrait — his pose changes across a chapter",
    new Set(poses).size >= 2, JSON.stringify(poses.map((p) => String(p).split("/").pop())));

  // the borrowed Duolingo green is gone from the story's primary action
  const cta = await pg.evaluate(() => getComputedStyle(document.getElementById("next")).backgroundImage);
  ok("the story CTA is Sona orange, not Duolingo green",
    /255, 138, 61|255, 160, 90/.test(cta) && !/88, 204, 2/.test(cta), cta.slice(0, 70));
  await pg.close();
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
