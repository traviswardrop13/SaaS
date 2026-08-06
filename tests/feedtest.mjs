// Feed Echo (the littles game): Echo asks a word, kid taps the matching
// picture, Echo munches and GROWS — persistently. Verifies: the ask/cards
// agree, wrong taps never fail the round, 5 feeds finish it (rotation
// advances, sticker awarded, growth saved), scale persists across loads,
// deck placement leads for under-6, and the page carries zero tracking.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", woff2: "font/woff2" };
let ttsAsks = [];
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/tts" && req.method === "POST") {
    let b = ""; req.on("data", (c) => (b += c));
    req.on("end", () => { try { ttsAsks.push(JSON.parse(b).text); } catch (e) {} res.writeHead(500); res.end("{}"); });
    return;
  }
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8145, r));

const browser = await chromium.launch(launchOpts());
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
let errs = [];
page.on("pageerror", (e) => errs.push(e.message));
let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

// COPPA guard: the kid page must not carry any tracking script
const src = readFileSync(ROOT + "/arcade-feed.html", "utf8");
ok("kid page carries no tracking", !/pixel\.js|analytics\.js|fbevents|posthog/i.test(src));

await page.addInitScript(() => {
  // seed once — later tests mutate the profile and reload, so never clobber
  if (!localStorage.getItem("sona.profile.v1")) {
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Zoe", childAge: "4", focusSounds: ["R"], onboarded: true }));
  }
});
await page.goto("http://localhost:8145/arcade-feed.html"); await page.waitForTimeout(1000);

// ── the ask and the cards agree ──
let t = await page.evaluate(() => ({
  cards: [...document.querySelectorAll("#grid .cardBtn")].map((b) => b.querySelector(".w").textContent),
  bubble: document.getElementById("bMain").textContent,
  fed: document.getElementById("plate").dataset.fed,
}));
ok("renders 2-4 picture cards", t.cards.length >= 2 && t.cards.length <= 4, JSON.stringify(t.cards));
const target1 = (t.bubble.match(/Where's the (.+)\?/) || [])[1];
ok("the asked word is one of the cards", !!target1 && t.cards.includes(target1), t.bubble);
ok("round starts 0/5", /0\/5/.test(t.fed));
ok("Echo speaks the ask", ttsAsks.some((x) => new RegExp("Where is the " + target1, "i").test(x)), JSON.stringify(ttsAsks));

// ── wrong tap: wobble + hint, never a fail, fed stays 0 ──
const wrongIdx = t.cards.findIndex((w) => w !== target1);
if (wrongIdx >= 0) {
  await page.evaluate((i) => document.querySelectorAll("#grid .cardBtn")[i].click(), wrongIdx);
  await page.waitForTimeout(300);
  t = await page.evaluate(() => ({
    fed: document.getElementById("plate").dataset.fed,
    hint: document.getElementById("bSub").textContent,
    cardsLeft: document.querySelectorAll("#grid .cardBtn").length,
  }));
  ok("wrong tap never fails the round", /0\/5/.test(t.fed) && t.cardsLeft >= 2 && /Almost/.test(t.hint));
}

// ── every bite VISIBLY grows Echo within the round ──
const scaleBefore = await page.evaluate(() => parseFloat((document.getElementById("echo").style.transform.match(/scale\(([\d.]+)\)/) || [])[1] || "1"));
await page.evaluate(() => {
  const m = document.getElementById("bMain").textContent.match(/Where's the (.+)\?/);
  const hit = [...document.querySelectorAll("#grid .cardBtn")].find((x) => x.querySelector(".w").textContent === m[1]);
  if (hit) hit.click();
});
await page.waitForTimeout(400);
const scaleAfter = await page.evaluate(() => parseFloat((document.getElementById("echo").style.transform.match(/scale\(([\d.]+)\)/) || [])[1] || "1"));
ok("Echo grows with the bite (visible, not just banked)", scaleAfter > scaleBefore + 0.04, scaleBefore + " → " + scaleAfter);

// ── feed the rest by always tapping the asked card ──
for (let i = 0; i < 5; i++) {
  await page.waitForTimeout(1100);
  const done = await page.evaluate(() => {
    const b = document.getElementById("bMain").textContent;
    const m = b.match(/Where's the (.+)\?/);
    if (!m) return false;
    const btns = [...document.querySelectorAll("#grid .cardBtn")];
    const hit = btns.find((x) => x.querySelector(".w").textContent === m[1]);
    if (hit) hit.click();
    return !!hit;
  });
  if (!done) break;
}
await page.waitForTimeout(1400);
t = await page.evaluate(() => ({
  end: document.getElementById("endOvl").classList.contains("show"),
  endSub: document.getElementById("endSub").textContent,
  fedStore: JSON.parse(localStorage.getItem("sona.feed.v1") || "{}").fed || 0,
  rot: window.Sona.rotRound(),
  ring: window.Sona.todayRing().n,
  stickers: Object.keys(window.Sona.stickersEarned ? window.Sona.stickersEarned() : {}).length,
}));
ok("5 feeds finish the round", t.end);
// ── the ukulele concert: strumming Echo + floating notes + real plucks fired ──
t = await page.evaluate(() => ({
  uke: !!document.querySelector("#concert .uke"),
  notes: document.querySelectorAll("#concert .note").length,
  played: window.__ukePlayed === true,
}));
ok("concert scene: Echo strums with floating notes", t.uke && t.notes >= 2);
ok("the ukulele actually plays (plucks scheduled)", t.played);
t = await page.evaluate(() => ({
  end: document.getElementById("endOvl").classList.contains("show"),
  endSub: document.getElementById("endSub").textContent,
  fedStore: JSON.parse(localStorage.getItem("sona.feed.v1") || "{}").fed || 0,
  rot: window.Sona.rotRound(),
  ring: window.Sona.todayRing().n,
  stickers: Object.keys(window.Sona.stickersEarned ? window.Sona.stickersEarned() : {}).length,
}));
ok("growth persisted (5 feeds banked)", t.fedStore === 5, "fed=" + t.fedStore);
ok("round advances the rotation + ring", t.rot >= 1 && t.ring >= 1, "rot=" + t.rot + " ring=" + t.ring);
ok("a sticker landed", t.stickers >= 1);
ok("win copy mentions growth or the goal", /grow|adventure/i.test(t.endSub), t.endSub);

// ── growth survives a reload (Echo visibly bigger) ──
await page.goto("http://localhost:8145/arcade-feed.html"); await page.waitForTimeout(900);
t = await page.evaluate(() => document.getElementById("echo").style.transform);
ok("Echo's size persists across visits", /scale\(1\.0[2-9]|scale\(1\.[1-9]/.test(t), t);

// ── the deck is age-aware. A little who can't read must open on Feed Echo
//    (tap-and-say), not on a card full of falling fruit — but every other
//    game is still one swipe away. ──
await page.goto("http://localhost:8145/today.html"); await page.waitForTimeout(900);
let deck = await page.evaluate(() => ({
  hero: document.getElementById("heroName").textContent,
  launch: document.getElementById("goBtn").dataset.launch,
  thumbs: [...document.querySelectorAll(".thumb")].map((t) => t.dataset.key),
  trio: Sona.dailyGames(),
}));
// DAY1: the home opens on today's chapter for everyone, so the age rule is
// about which games the story UNLOCKS — a four-year-old must never read a
// story and be handed three games none of which they can play.
ok("under-6: today's trio leads with Feed Echo", deck.trio[0] === "feed", JSON.stringify(deck));
ok("under-6: the day starts on the story like everyone else", /chapter\.html/.test(deck.launch || ""), deck.launch);
ok("under-6: three games are on offer once it's read", deck.thumbs.length === 3, JSON.stringify(deck.thumbs));
// read the story, and the first thing they can play needs no reading
await page.evaluate(() => Sona.markStoryRead());
await page.goto("http://localhost:8145/today.html"); await page.waitForTimeout(900);
deck = await page.evaluate(() => ({
  hero: document.getElementById("heroName").textContent,
  launch: document.getElementById("goBtn").dataset.launch,
}));
ok("under-6: the unlocked hero is Feed Echo", /Feed Echo/.test(deck.hero), JSON.stringify(deck));
ok("under-6: LET'S GO opens Feed Echo", /arcade-feed/.test(deck.launch || ""), deck.launch);
await page.evaluate(() => { const p = JSON.parse(localStorage.getItem("sona.profile.v1")); p.childAge = "8"; localStorage.setItem("sona.profile.v1", JSON.stringify(p)); });
await page.goto("http://localhost:8145/today.html"); await page.waitForTimeout(900);
deck = await page.evaluate(() => ({
  hero: document.getElementById("heroName").textContent,
  launch: document.getElementById("goBtn").dataset.launch,
}));
ok("age 8: the deck no longer opens on Feed Echo", !/Feed Echo/.test(deck.hero), JSON.stringify(deck));
ok("age 8: LET'S GO opens a practice game", /charge\.html\?game=/.test(deck.launch || ""), deck.launch);

ok("no pageerrors", errs.length === 0, errs.join(" | "));
await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
