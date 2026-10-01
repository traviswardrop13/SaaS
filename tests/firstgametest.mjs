// FIRST1: the first game, straight from setup (Travis, 27 Sep 2026): "upon
// completing the few steps inside the onboarding ... it will choose feed echo
// for the littles and fruit slice for ages five and up ... it'll literally go
// straight to the game", and after it, Home with every game greyed "except
// they can replay feed echo and ... fruit slice".
//
// FIRST2 (Travis, 30 Sep 2026, after playing it): the paywall no longer comes
// up when that game ends — "lets maybe have the second option be 'Go to Home'
// so the top stays as play again but then when they see home they see the
// other games they can play and that there are premium ones ... the flow was
// not good". The first game ends like any other, with no price; the offer
// waits for the end of the first full practice run (completiontest) and for a
// tap on a locked game, which now opens the plan screen on that game.
//
// Pricing is off today, so the paywall half is played through the ?paid=1 /
// sona.paidui seam, the way iaptest plays every purchase rail: nothing here
// pins the switch's value.
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from "./_env.mjs";

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT, BASE = "http://127.0.0.1:8268";
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2", mp3: "audio/mpeg", webmanifest: "application/manifest+json" };
const server = createServer((req, res) => {
  const u = new URL(req.url, BASE), f = path.join(ROOT, u.pathname);
  if (u.pathname.startsWith("/api/")) { res.writeHead(503); res.end("{}"); return; }
  if (!existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[f.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8268, "127.0.0.1", r));
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(detail))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, e.stack); } }

// a phone with no mic to speak of, and no sound: only where the pages go matters here
function phone(cfg) {
  navigator.mediaDevices && (navigator.mediaDevices.getUserMedia = () => new Promise(() => {}));
  if (cfg.paid) sessionStorage.setItem("sona.paidui", "1");
  // the grown-up passed the gate a moment ago, as setup does when pricing is on
  if (cfg.paid) sessionStorage.setItem("sona.gate.v1", String(Date.now()));
  if (cfg.profile && !localStorage.getItem("sona.test.seeded")) {
    localStorage.setItem("sona.test.seeded", "1");
    // every free-era sweep has run on this device, so it belongs to no free cohort
    localStorage.setItem("sona.freeera.v1", "post"); ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
    localStorage.setItem("sona.profile.v1", JSON.stringify(cfg.profile));
  }
  if (cfg.first) sessionStorage.setItem("sona.firstgame.v1", cfg.first);
  if (cfg.token) sessionStorage.setItem("sona.play.token", cfg.token);
}
async function open(url, cfg = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (r) => (r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort()));
  await context.addInitScript(phone, cfg);
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + url);
  return { context, page, errors };
}
const kid = (age) => ({ childName: "Mia", childAge: age, focusSounds: ["R"], onboarded: true, voiceOn: false, soundOn: false });

// ── which game is first ──
for (const [age, key] of [["3", "feed"], ["4", "feed"], ["5", "slice"], ["8", "slice"], ["", "slice"]]) {
  await scenario("first game at " + (age || "no age"), async () => {
    const { context, page } = await open("/today.html", { profile: kid(age) });
    try {
      const got = await page.evaluate(() => ({ key: Sona.firstGameKey(), go: Sona.firstGameStart(), flag: sessionStorage.getItem("sona.firstgame.v1") }));
      ok("age " + (age || "unknown") + ": the first game is " + key + ", opened the way Home opens it",
        got.key === key && got.flag === key && got.go === (key === "feed" ? "/arcade-feed.html" : "/charge.html?game=arcade-slice.html"), got);
    } finally { await context.close(); }
  });
}

// ── the end of the first game ──
await scenario("Feed Echo, free", async () => {
  const { context, page, errors } = await open("/arcade-feed.html", { profile: kid("4"), first: "feed" });
  try {
    await page.waitForFunction(() => typeof finish === "function");
    await page.evaluate(() => finish());
    await page.locator("#endOvl.show").waitFor();
    // Either state, no seam: the usual end card — another go, or Home.
    ok("the first game's end card is the usual one: Play again, then Back home",
      (await page.locator("#again").innerText()) === "Play again" && (await page.locator("#goHome").innerText()) === "Back home");
    ok("…and the first-game mark is spent, so it is only ever the first", await page.evaluate(() => sessionStorage.getItem("sona.firstgame.v1") === null));
    ok("Feed Echo free: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});
await scenario("Feed Echo, paying", async () => {
  const { context, page, errors } = await open("/arcade-feed.html", { profile: kid("4"), first: "feed", paid: true });
  const asked = [];
  page.on("request", (r) => { if (/\/subscribe\.html/.test(r.url())) asked.push(r.url()); });
  try {
    await page.waitForFunction(() => typeof finish === "function");
    ok("with pricing on, a new family is due the plan screen", await page.evaluate(() => Sona.planEligible()));
    await page.evaluate(() => finish());
    await page.locator("#endOvl.show").waitFor();
    ok("even when the plan screen is due, the first game ends with Play again on top and Back home under it",
      (await page.locator("#again").innerText()) === "Play again" && (await page.locator("#goHome").innerText()) === "Back home");
    ok("the one-time ask is still unspent, for the first practice run", await page.evaluate(() => Sona.planEligible()));
    const to = page.waitForRequest((r) => new URL(r.url()).pathname === "/today.html");
    await page.locator("#goHome").click();
    ok("…Back home goes Home", !!(await to));
    ok("…and nothing on the way asks for the plan screen", asked.length === 0, asked);
    ok("Feed Echo paying: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});
await scenario("Feed Echo, not the first game", async () => {
  const { context, page } = await open("/arcade-feed.html", { profile: kid("4"), paid: true });
  try {
    await page.waitForFunction(() => typeof finish === "function");
    await page.evaluate(() => finish());
    await page.locator("#endOvl.show").waitFor();
    ok("any later game ends the usual way, even when the plan screen is due", (await page.locator("#goHome").innerText()) === "Back home");
  } finally { await context.close(); }
});
await scenario("Fruit Slice, paying", async () => {
  const { context, page, errors } = await open("/arcade-slice.html?from=charge", { profile: kid("7"), first: "slice", paid: true, token: "arcade-slice.html" });
  try {
    await page.waitForFunction(() => window.gameEntryAllowed === true && typeof endRound === "function");
    await page.evaluate(() => { score = 20; finaleDone = true; endRound(); });
    await page.locator("#endOvl.show").waitFor();
    ok("Fruit Slice as the first game: Play again on top, Back home under it",
      (await page.locator("#endCharge").innerText()).toLowerCase() === "play again" && (await page.locator("#endHome").isVisible()) && (await page.locator("#endHome").innerText()) === "Back home");
    const to = page.waitForRequest((r) => { const u = new URL(r.url()); return u.pathname === "/charge.html" && u.searchParams.get("game") === "arcade-slice.html"; });
    await page.locator("#endCharge").click();
    ok("…and another go goes back through practice, as every Fruit Slice turn does", !!(await to));
    ok("Fruit Slice paying: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── Home after the plan screen, without Premium: only the free games open ──
await scenario("Home, paying, no Premium", async () => {
  const { context, page, errors } = await open("/today.html", { profile: kid("7"), paid: true });
  try {
    await page.waitForTimeout(400);
    const cards = await page.evaluate(() => [...document.querySelectorAll("#activityGroups button[data-game]")].filter((b) => !b.disabled)
      .map((b) => ({ key: b.dataset.game, locked: b.dataset.locked === "true", fade: getComputedStyle(b.querySelector(".game-art")).opacity })));
    const open = cards.filter((c) => !c.locked).map((c) => c.key).sort();
    // Travis, 30 Sep 2026: "the two free games for older kids, the two free games for younger kids"
    ok("only the free games are open: Bubble Pop, Feed Echo, Fruit Slice and Piano Tiles", JSON.stringify(open) === JSON.stringify(["bubbles", "feed", "slice", "tiles"]), open);
    ok("every other game is greyed out", cards.filter((c) => c.locked).length >= 4 && cards.filter((c) => c.locked).every((c) => Number(c.fade) < 0.7), cards);
    await page.locator('#activityGroups button[data-game="stack"]').click();
    ok("a greyed game still answers a tap: ask a grown-up", await page.locator("#libraryNotice").isVisible() && new URL(page.url()).pathname === "/today.html");
    ok("Home paying: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── the plan screen names the free games from the catalog ──
await scenario("the plan screen's free games", async () => {
  const { context, page } = await open("/subscribe.html?first=1", { profile: kid("7"), paid: true });
  try {
    const line = await page.locator("#freeGames").innerText();
    ok("the plan screen names the free games instead of a count that goes stale", line === "Fruit Slice, Piano Tiles, Feed Echo and Bubble Pop, free for every child", line);
    const book = await page.locator("#freeBooks").innerText();
    ok("…and the free book, from sona.js", book === "Rory and the Rainbow, a picture book Echo reads with you", book);
  } finally { await context.close(); }
});

// ── OFFER1: the plan screen as an offer (Travis, 30 Sep 2026: "this paywall is
// absolutely terrible") — the games in Home's art, one line, a headline, the
// plan, the button; Settings › Your plan, with no flag, is the page it was ──
await scenario("a locked game opens the plan screen on that game", async () => {
  const { context, page, errors } = await open("/premium.html?game=stack", { profile: kid("7"), paid: true });
  try {
    await page.waitForURL((u) => u.pathname === "/subscribe.html");
    ok("the locked-game page goes straight on to the plan screen, naming the game", new URL(page.url()).search === "?from=stack", page.url());
    await page.locator("body.offer").waitFor();
    const s = await page.evaluate(() => ({
      title: document.getElementById("offerTitle").textContent,
      pill: document.getElementById("offerPill").hidden ? "" : document.getElementById("offerPill").textContent,
      art: [...document.querySelectorAll("#offerArt .oc img")].map((i) => i.getAttribute("src")),
      tabs: getComputedStyle(document.querySelector(".family-tabs")).display,
      head: getComputedStyle(document.querySelector(".family-pagehead")).display,
      summary: getComputedStyle(document.getElementById("planCard")).display,
      buy: document.getElementById("buyLife").getBoundingClientRect().bottom,
      decline: getComputedStyle(document.getElementById("declineRow")).display,
      note: document.getElementById("declineNote").textContent,
      rachel: document.getElementById("offerRachel").textContent,
    }));
    ok("…opened on that game: its picture, its name in the headline", s.title === "Unlock Block Stacker, and every other game" && JSON.stringify(s.art) === '["/assets/crafted/home-stack.webp"]', s);
    ok("…and one line about the child who tapped it", s.pill === "🎮 Mia wants to play Block Stacker", s.pill);
    ok("the offer sheds the Settings furniture: tabs, page head and summary box", s.tabs === "none" && s.head === "none" && s.summary === "none", s);
    ok("the button is on the first screen of an iPhone", s.buy > 0 && s.buy <= 844, s.buy);
    ok("a stated way out, saying the free games are still there", s.decline !== "none" && s.note === "Your free games are still ready to play.", s);
    ok("Rachel's credential is still on the page, word for word", /Built with Rachel, MS, CF-SLP — licensed pediatric speech-language pathologist/.test(s.rachel), s.rachel);
    ok("locked game → plan screen: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});
await scenario("the plan screen after a first run", async () => {
  const { context, page, errors } = await open("/subscribe.html?first=1", { profile: kid("7"), paid: true });
  try {
    await page.locator("body.offer").waitFor();
    const s = await page.evaluate(() => ({
      title: document.getElementById("offerTitle").textContent,
      sub: document.getElementById("offerSub").textContent,
      pill: !document.getElementById("offerPill").hidden,
      art: document.querySelectorAll("#offerArt .oc img").length,
      open: Object.keys(Sona.GAME_ACTS).filter((k) => Sona.GAME_ACTS[k].tier !== "free" && !Sona.GAME_ACTS[k].comingSoon).length,
    }));
    ok("after a first run: every Premium game in Home's art, fanned, and the child's name in the headline", s.title === "Unlock every game for Mia" && s.art >= 2 && s.art <= 4, s);
    ok("the count is the catalog's, and no date is promised", s.sub === s.open + " more games today, and new ones on the way.", s);
    ok("nothing recorded on this device, so no line about what the child did", s.pill === false, s);
    ok("first run → plan screen: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});
await scenario("Settings › Your plan", async () => {
  const { context, page } = await open("/subscribe.html", { profile: kid("7"), paid: true });
  try {
    await page.locator("#pickCard").waitFor();
    const s = await page.evaluate(() => ({ offer: document.body.classList.contains("offer"), hero: document.getElementById("offerHero").hidden, tabs: getComputedStyle(document.querySelector(".family-tabs")).display }));
    ok("opened from Settings, the plan page is the page it was: no offer framing, tabs showing", !s.offer && s.hero && s.tabs !== "none", s);
  } finally { await context.close(); }
});
await scenario("the gate carries the game", async () => {
  const { context, page } = await open("/today.html", { profile: kid("7") });
  try {
    const d = await page.evaluate(() => [Sona.gateDest("/subscribe.html?from=hoops"), Sona.gateDest("/subscribe.html?from=library"), Sona.gateDest("/subscribe.html?from=evil"), Sona.gateDest("/subscribe.html?first=1&from=hoops")]);
    ok("the grown-up gate carries ?from= only as a game the catalog knows, or the library", JSON.stringify(d) === JSON.stringify(["/subscribe.html?from=hoops", "/subscribe.html?from=library", "/subscribe.html", "/subscribe.html?first=1"]), d);
  } finally { await context.close(); }
});

// ── onboarding's source: a clinician's own setup still ends on Home ──
{
  const ob = readFileSync(ROOT + "/onboarding.html", "utf8");
  ok("a parent's setup ends in the first game; a clinician's still on Home", /var first="\/today\.html";try\{if\(draft\.role!=="slp"&&Sona\.firstGameStart\)first=Sona\.firstGameStart\(\);\}catch\(e\)\{\}\s*location\.href=first;/.test(ob));
}

await browser.close(); await new Promise((r) => server.close(r));
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
