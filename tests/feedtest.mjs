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
  bubble: document.getElementById("bubble").textContent,
  fed: document.getElementById("fedPill").textContent,
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
    fed: document.getElementById("fedPill").textContent,
    hint: document.getElementById("hint").textContent,
    cardsLeft: document.querySelectorAll("#grid .cardBtn").length,
  }));
  ok("wrong tap never fails the round", /0\/5/.test(t.fed) && t.cardsLeft >= 2 && /Almost/.test(t.hint));
}

// ── feed 5 times by always tapping the asked card ──
for (let i = 0; i < 5; i++) {
  await page.waitForTimeout(1100);
  const done = await page.evaluate(() => {
    const b = document.getElementById("bubble").textContent;
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
ok("growth persisted (5 feeds banked)", t.fedStore === 5, "fed=" + t.fedStore);
ok("round advances the rotation + ring", t.rot >= 1 && t.ring >= 1, "rot=" + t.rot + " ring=" + t.ring);
ok("a sticker landed", t.stickers >= 1);
ok("win copy mentions growth or the goal", /grow|adventure/i.test(t.endSub), t.endSub);

// ── growth survives a reload (Echo visibly bigger) ──
await page.goto("http://localhost:8145/arcade-feed.html"); await page.waitForTimeout(900);
t = await page.evaluate(() => document.getElementById("echo").style.transform);
ok("Echo's size persists across visits", /scale\(1\.0[2-9]|scale\(1\.[1-9]/.test(t), t);

// ── deck placement: under-6 leads with Feed Echo; older rides sixth ──
await page.goto("http://localhost:8145/today.html"); await page.waitForTimeout(800);
t = await page.evaluate(() => document.getElementById("heroName").textContent);
ok("under-6 deck leads with Feed Echo", t === "Feed Echo", t);
await page.evaluate(() => { const p = JSON.parse(localStorage.getItem("sona.profile.v1")); p.childAge = "8"; localStorage.setItem("sona.profile.v1", JSON.stringify(p)); });
await page.goto("http://localhost:8145/today.html"); await page.waitForTimeout(800);
t = await page.evaluate(() => document.getElementById("heroName").textContent);
ok("age 8 deck keeps the arcade first", t !== "Feed Echo", t);

ok("no pageerrors", errs.length === 0, errs.join(" | "));
await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
