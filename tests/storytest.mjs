// STORY1: the daily run is an episode. Asserts the engine's contracts (a beat
// per round, a cliffhanger, one chapter per DAY), that the beat card appears
// and clears itself without a tap, that the hook renders on the finish
// overlay, and that free play stays story-free.
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
  navigator.mediaDevices.getUserMedia = () => Promise.resolve(new MediaStream());
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

// ── today.html surfaces the chapter before the kid taps in ──
await page.evaluate(() => localStorage.removeItem("sona.episode.v1"));
await page.goto("http://localhost:8151/today.html");
await page.waitForTimeout(800);
const pill = await page.evaluate(() => {
  const p = document.getElementById("chapPill");
  return { shown: !!p && p.classList.contains("show"), txt: (p || {}).textContent || "" };
});
ok("path shows the chapter ribbon", pill.shown && /Chapter 1/.test(pill.txt), pill.txt);

// ── the beat card opens the daily round and clears ITSELF ──
await page.goto("http://localhost:8151/charge.html?daily=1&sound=R");
await page.waitForTimeout(900);
let card = await page.evaluate(() => ({
  shown: document.getElementById("storyCard").classList.contains("show"),
  ttl: document.getElementById("storyTtl").textContent,
  txt: document.getElementById("storyTxt").textContent,
}));
ok("daily round opens on the story beat", card.shown, JSON.stringify(card));
ok("round 1 names the chapter", /Chapter 1/.test(card.ttl), card.ttl);
ok("beat carries real story copy", card.txt.length > 20, card.txt);
// it must get out of the child's way on its own — no tap required
await page.waitForTimeout(4600);
card = await page.evaluate(() => document.getElementById("storyCard").classList.contains("show"));
ok("beat card clears itself (no tap needed)", !card);

// ── free play has no story ──
await page.goto("http://localhost:8151/charge.html?game=arcade-slice.html");
await page.waitForTimeout(1100);
const free = await page.evaluate(() => document.getElementById("storyCard").classList.contains("show"));
ok("free play shows no story beat", !free);

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
