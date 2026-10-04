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
//
// WEB1 (Travis, 1 Oct 2026: "i dont want them paying on the website"). This
// suite is a browser, and a browser shows the web card only while the website
// sells. So every paying scenario forces the web rails ON through the second
// seam (sessionStorage "sona.websalesui"), which keeps the web card played
// whichever way WEB_SALES ships; the scenarios at the end force it OFF and play
// the same doors: no offer, no price, and where Premium is bought instead.
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
  // the website selling, unless the scenario says otherwise (web: "0")
  if (cfg.paid) sessionStorage.setItem("sona.websalesui", cfg.web === "0" ? "0" : "1");
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
async function open(url, cfg = {}, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
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
    // where Sona can sell (this phone's website sells), a grey game opens the
    // price at once, on that game (Travis, 4 Oct 2026: "I want it to open
    // automatically if they click on a game that is grayed out")
    await page.locator('#activityGroups button[data-game="stack"]').click();
    await page.waitForURL(/\/subscribe\.html\?from=stack$/).catch(() => {});
    ok("a greyed game still answers a tap: it opens the price at once, on that game", /\/subscribe\.html\?from=stack$/.test(page.url()), page.url());
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
      declineText: document.getElementById("declineRow").innerText,
      noteShown: getComputedStyle(document.getElementById("declineNote")).display !== "none",
      rachel: document.getElementById("offerRachel").textContent,
    }));
    ok("…opened on that game: its picture, its name in the headline", s.title === "Unlock Block Stacker, and every other game" && JSON.stringify(s.art) === '["/assets/crafted/home-stack.webp"]', s);
    ok("…and one line about the child who tapped it", s.pill === "🎮 Mia wants to play Block Stacker", s.pill);
    ok("the offer sheds the Settings furniture: tabs, page head and summary box", s.tabs === "none" && s.head === "none" && s.summary === "none", s);
    ok("the button is on the first screen of an iPhone", s.buy > 0 && s.buy <= 844, s.buy);
    // the line that sat under it steps aside in the offer (Travis, 2 Oct 2026:
    // "there's still too much information"): the button names the free version
    ok("a stated way out, naming the free version, with nothing under it", s.decline !== "none" && /Not now — keep the free version/.test(s.declineText) && !s.noteShown, s);
    ok("Rachel's credential is still on the page, word for word", /Built with Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship/.test(s.rachel), s.rachel);
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
      pillSeen: getComputedStyle(document.getElementById("offerPill")).display !== "none",
      // who Premium's playable games are for, straight from the catalog
      groups: [...new Set(Object.keys(Sona.GAME_ACTS).filter((k) => Sona.GAME_ACTS[k].tier !== "free" && !Sona.GAME_ACTS[k].comingSoon).map((k) => Sona.GAME_ACTS[k].group))].sort(),
      littleSoon: Object.keys(Sona.GAME_ACTS).some((k) => Sona.GAME_ACTS[k].group === "simple" && Sona.GAME_ACTS[k].tier !== "free" && Sona.GAME_ACTS[k].comingSoon),
    }));
    ok("after a first run: every Premium game in Home's art, fanned, and the child's name in the headline", s.title === "Unlock every game for Mia" && s.art >= 2 && s.art <= 4, s);
    // Travis, 1 Oct 2026: "a different way to say 6 more games today, like
    // more games for littles and for bigs ... new ones on the way is fine".
    // The line names who the games are for, and only the age groups that have
    // a Premium game a child can open today: a parent of a three-year-old
    // must not read "more games for little kids" on a day there are none.
    const both = s.groups.includes("arcade") && s.groups.includes("simple");
    const want = both ? "More games for little kids and big kids, and new ones on the way."
      : s.groups.includes("arcade") ? "More games for big kids, and new ones " + (s.littleSoon ? "for little kids " : "") + "on the way." : null;
    ok("the line under the headline says who Premium's games are for, from the catalog, with no count and no date", want !== null && s.sub === want && !/\d/.test(s.sub), s);
    ok("nothing recorded on this device, so no line about what the child did — and no empty pill either", s.pill === false && s.pillSeen === false, s);
    ok("first run → plan screen: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});
// TWO WAYS TO PAY, IN THE OFFER (1 Oct 2026). The offer view hides the plan
// boxes' long descriptions, so this reads what is actually on the screen: the
// monthly box and its "charged today" must be visible there, and two boxes
// must not push the one button off the first screen — on a full-size iPhone
// or on a small one (CLAUDE.md promises 375×667).
//
// It is measured the way a real family meets it: with the CHARTER LINE in the
// yearly box (two more lines; the first version of this test had no price
// answer, so the line never showed and the test passed on a page whose button
// was cut off on every phone between 701 and 855 tall), from a locked game
// (the tall picture, a pill, a two-line headline), and at the heights in
// between — a 736, a 780 and an 812, not just the two ends. The page fits
// itself by measuring (fitOffer), so each size is checked, not assumed.
const CHARTER_OPEN = { ok: true, free: false, cap: 50, taken: 12, left: 38, open: true, source: "stripe", price: "$59.99", standard: "$99.99", label: "Charter", monthly: "$9.99" };
const answerCharter = (page, body, delayMs = 0) => page.route("**/api/charter", async (r) => { if (delayMs) await new Promise((res) => setTimeout(res, delayMs)); await r.fulfill({ contentType: "application/json", body: JSON.stringify(body) }).catch(() => {}); });
for (const [w, h] of [[375, 667], [360, 740], [414, 736], [360, 780], [375, 812], [390, 844], [430, 932]]) {
  const label = w + "×" + h;
  await scenario("two ways to pay in the offer, " + label, async () => {
    const context = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    await context.route("**/*", (r) => (r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort()));
    await context.addInitScript(phone, { profile: kid("7"), paid: true });
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await answerCharter(page, CHARTER_OPEN);
    try {
      await page.goto(BASE + "/subscribe.html?from=stack");
      await page.locator("body.offer").waitFor();
      await page.locator("#charterLine").waitFor({ state: "visible" });
      await page.waitForFunction(() => !document.getElementById("buyLife").disabled);
      const read = () => page.evaluate(() => {
        const g = (id) => document.getElementById(id);
        // by what is PAINTED, never by the hidden attribute the page sets
        const seen = (el) => !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0;
        const note = document.querySelector("#planMonth .paynote");
        return { year: seen(g("planLife")), month: seen(g("planMonth")), note: seen(note) ? note.innerText : "", yearPicked: g("planLife").getAttribute("aria-checked"),
          charter: seen(g("charterLine")) ? g("charterLine").innerText : "", button: g("buyLife").textContent,
          buy: Math.round(g("buyLife").getBoundingClientRect().bottom), monthBottom: Math.round(g("planMonth").getBoundingClientRect().bottom),
          payToday: seen(g("monthMath")), art: seen(g("offerArt")), wide: document.documentElement.scrollWidth > innerWidth, h: innerHeight, fit: document.body.className };
      });
      const s = await read();
      ok(label + ": both ways to pay are on screen in the offer, yearly picked, with the charter line a real family sees",
        s.year && s.month && s.yearPicked === "true" && /38 spots left/.test(s.charter), s);
      ok(label + ": the monthly box's 'charged today' is visible there, not hidden with the long descriptions", /charged today/i.test(s.note), s);
      ok(label + ": both boxes and the one button fit on the first screen, and nothing runs off the side", s.monthBottom < s.buy && s.buy > 0 && s.buy <= s.h && !s.wide, s);
      ok(label + ": 'charged today' is not under a button that starts free days", s.payToday === false && s.button === "Start 3 days free", s);
      if (h >= 667) ok(label + ": the game's picture is still there — the fit shrinks it before it would drop it", s.art, s);
      await page.locator("#planMonth").click();
      const b = await read();
      ok(label + ": picking monthly keeps the button on the first screen and names $9.99 a month", /\$9\.99 a month/.test(b.button) && b.buy <= b.h && b.payToday, b);
      ok(label + ": no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
}

// THE PRICE CHECK, ANSWERED FOR REAL (1 Oct 2026). Every browser suite
// answered /api/charter with an error, so no test had ever watched the plan
// screen take an answer — and a slow one, arriving after the 2.5 s the button
// waits, re-priced the yearly box to $99.99 and left "$59.99 a year" in the
// small print beneath it.
await scenario("a late answer from the price check, with the charter spots gone", async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (r) => (r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort()));
  await context.addInitScript(phone, { profile: kid("7"), paid: true });
  const page = await context.newPage(); page.setDefaultTimeout(9000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await answerCharter(page, { ...CHARTER_OPEN, taken: 50, left: 0, open: false }, 3300);
  try {
    await page.goto(BASE + "/subscribe.html");
    await page.locator("#pickCard").waitFor();
    const read = () => page.evaluate(() => { const g = (id) => document.getElementById(id); return { button: g("buyLife").textContent, disabled: g("buyLife").disabled, title: g("webTitle").innerText, renew: g("webRenew").innerText, bill: g("webTL").innerText, line: g("planLine").innerText, save: document.querySelector("#planLife .save").innerText, month: g("planMonth").innerText }; });
    let s = await read();
    ok("while the price check is out, the button waits and says so", s.disabled && /Checking today/.test(s.button), s);
    await page.waitForFunction(() => !document.getElementById("buyLife").disabled);   // 2.5 s: the button lets go
    s = await read();
    ok("after 2.5 s the button lets go at the price the page opened with", s.button === "Start 3 days free" && /\$59\.99/.test(s.title), s);
    await page.waitForFunction(() => /99\.99/.test(document.getElementById("webTitle").innerText));   // the late answer lands
    s = await read();   // NOTHING is tapped: a tap repaints, and would hide the stale small print this is here to catch
    ok("a late answer re-prices EVERY yearly figure with no tap: the title, the per-month line, the billing line, the small print and the header line",
      /\$99\.99\/yr/.test(s.title) && /under \$8\.50 a month, billed once a year/i.test(s.save) && /then \$99\.99 a year/.test(s.bill) && !/59\.99/.test(s.bill) && /renews at \$99\.99 a year/.test(s.renew) && !/59\.99/.test(s.renew) && /\$99\.99\/yr/.test(s.line) && !/59\.99/.test(s.line) && /under \$8\.50 a month/.test(s.line), s);
    ok("…and the monthly figure does not move with the charter", /\$9\.99\/mo/.test(s.month) && /\$9\.99 a month, charged today/.test(s.line), s);
    ok("late price answer: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});
await scenario("a pick made while the price check is out", async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (r) => (r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort()));
  await context.addInitScript(phone, { profile: kid("7"), paid: true });
  const page = await context.newPage(); page.setDefaultTimeout(9000);
  await answerCharter(page, { ...CHARTER_OPEN, taken: 50, left: 0, open: false }, 3300);
  try {
    await page.goto(BASE + "/subscribe.html");
    await page.locator("#pickCard").waitFor();
    await page.waitForFunction(() => document.getElementById("buyLife").disabled);
    await page.locator("#planMonth").click();                       // the parent picks monthly during the wait
    const waiting = await page.evaluate(() => ({ b: document.getElementById("buyLife").textContent, d: document.getElementById("buyLife").disabled }));
    ok("picking a plan during the wait does not let the button go early", waiting.d && /Checking today/.test(waiting.b), waiting);
    await page.waitForFunction(() => !document.getElementById("buyLife").disabled);
    const let1 = await page.evaluate(() => document.getElementById("buyLife").textContent);
    ok("the button comes back saying what the plan picked NOW does, not a label remembered from before the wait", let1 === "Subscribe — $9.99 a month", let1);
    await page.waitForFunction(() => /99\.99/.test(document.getElementById("webTitle").innerText));   // the late answer lands
    const after = await page.evaluate(() => ({ b: document.getElementById("buyLife").textContent, renew: document.getElementById("webRenew").innerText, tl: getComputedStyle(document.getElementById("webTL")).display }));
    ok("…and the late answer does not put yearly words back over the monthly pick", after.b === "Subscribe — $9.99 a month" && /\$9\.99 a month/.test(after.renew) && !/a year/.test(after.renew) && after.tl === "none", after);
  } finally { await context.close(); }
});
await scenario("Settings › Your plan", async () => {
  const { context, page } = await open("/subscribe.html", { profile: kid("7"), paid: true });
  try {
    await page.locator("#pickCard").waitFor();
    const s = await page.evaluate(() => ({ offer: document.body.classList.contains("offer"), hero: document.getElementById("offerHero").hidden, tabs: getComputedStyle(document.querySelector(".family-tabs")).display,
      rachel: [...document.querySelectorAll("#pickCard .proof, #offerRachel")].filter((e) => getComputedStyle(e).display !== "none").length,
      plans: [...document.querySelectorAll("#pickCard .plan")].filter((e) => getComputedStyle(e).display !== "none").length }));
    ok("opened from Settings, the plan page is the page it was: no offer framing, tabs showing", !s.offer && s.hero && s.tabs !== "none", s);
    // the offer's copy of Rachel's line carried a display rule that beat its
    // hidden attribute, so Settings showed her line twice
    ok("…Rachel's line shows once there, and both ways to pay", s.rachel === 1 && s.plans === 2, s);
  } finally { await context.close(); }
});

// ── WEB1: THE SAME DOORS, WHEN THE WEBSITE DOES NOT SELL ──
// The first game still ends the usual way, and nothing is due after it. Each
// door a grown-up can come through (a locked game, the end of a first run,
// Settings) opens the plan screen in its plain Settings shape: where Premium
// is bought, the way to the App Store, what stays free. No offer view, no
// price, no free days, no charter line, nothing to decline, and the server is
// asked for neither a checkout nor a price.
await scenario("Feed Echo, the website not selling", async () => {
  const { context, page, errors } = await open("/arcade-feed.html", { profile: kid("4"), first: "feed", paid: true, web: "0" });
  try {
    await page.waitForFunction(() => typeof finish === "function");
    ok("web sales off: a new family in a browser is not due the plan screen", (await page.evaluate(() => Sona.planEligible())) === false);
    await page.evaluate(() => finish());
    await page.locator("#endOvl.show").waitFor();
    ok("…and the first game ends as it always does: Play again, then Back home",
      (await page.locator("#again").innerText()) === "Play again" && (await page.locator("#goHome").innerText()) === "Back home");
    ok("Feed Echo, web sales off: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});
for (const [w, h] of [[390, 844], [375, 667]]) for (const [door, lands] of [["/premium.html?game=stack", "?from=stack"], ["/subscribe.html?first=1", "?first=1"], ["/subscribe.html", ""]]) {
  const label = "web sales off, " + w + "×" + h + ", " + door;
  await scenario(label, async () => {
    const context = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    await context.route("**/*", (r) => (r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort()));
    await context.addInitScript(phone, { profile: kid("7"), paid: true, web: "0" });
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    const errors = [], asked = []; page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => { if (/\/api\/(checkout|charter)/.test(r.url())) asked.push(new URL(r.url()).pathname); });
    // a real answer is waiting, so a page that asked would have a price to paint
    await answerCharter(page, CHARTER_OPEN);
    try {
      await page.goto(BASE + door);
      await page.waitForURL((u) => u.pathname === "/subscribe.html");
      ok(label + ": the door still leads to the plan screen", new URL(page.url()).search === lands, page.url());
      await page.locator("#appCard").waitFor({ state: "visible" });
      await page.waitForTimeout(400);   // long enough for a price check to have been sent, had one been
      const v = await page.evaluate(() => {
        const g = (id) => document.getElementById(id);
        const seen = (el) => !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0;
        const a = g("appStoreGo");
        return { offer: document.body.classList.contains("offer"), hero: seen(g("offerHero")), tabs: seen(document.querySelector(".family-tabs")), head: seen(document.querySelector(".family-pagehead")),
          pick: seen(g("pickCard")), buy: seen(g("buyLife")), iap: seen(g("iapCard")), decline: seen(g("declineRow")), rachel: seen(g("offerRachel")),
          title: g("appTitle").innerText, words: g("appCard").innerText, href: a.getAttribute("href"), button: a.innerText.trim(), tag: a.tagName, blank: a.target === "_blank" && /noopener/.test(a.rel),
          go: Math.round(a.getBoundingClientRect().bottom), free: seen(g("freeTierCard")), games: g("freeGames").innerText, line: g("planLine").innerText,
          body: document.body.innerText, wide: document.documentElement.scrollWidth > innerWidth, spent: localStorage.getItem("sona.planmoment.v1"), due: Sona.planEligible() };
      });
      ok(label + ": no offer view: the Settings tabs and 'Your plan' are showing, the pictures and the pitch are not", !v.offer && !v.hero && v.tabs && v.head && !v.rachel, v);
      ok(label + ": no web card, no Apple card, no buy button, nothing to decline", !v.pick && !v.buy && !v.iap && !v.decline, v);
      ok(label + ": the card says Sona Premium is in the iPhone and iPad app, bought there and opening there",
        v.title === "Sona Premium is in the iPhone and iPad app" && /You buy it there, through the App Store, and it opens there\./.test(v.words) && /Daily practice and the free games stay free here\./.test(v.words), v.words);
      ok(label + ": the way to the App Store is a real link, in a new tab, with nothing running off the side",
        v.tag === "A" && v.href === "https://apps.apple.com/us/app/sona-speech/id6785755867" && v.blank && v.button === "Get Sona on the App Store" && v.go > 0 && !v.wide, v);
      ok(label + ": someone who already paid on the website is told the plan keeps working", /Already paid on speaksona\.com\? Your plan keeps working\./.test(v.words), v.words);
      ok(label + ": what stays free is under it, named from the catalog", v.free && v.games === "Fruit Slice, Piano Tiles, Feed Echo and Bubble Pop, free for every child", v.games);
      ok(label + ": the header line says where Premium is bought, and never 'founding family'",
        v.line === "Today: the free version. Sona Premium is bought in the iPhone and iPad app.", v.line);
      ok(label + ": no dollar sign, free days, charter line or spots-left count anywhere on the page",
        !/\$/.test(v.body) && !/3 days free|free trial|charter|spots? left|charged today/i.test(v.body), (v.body.match(/\$[^\s]*|3 days free|free trial|charter|spots? left|charged today/i) || [])[0]);
      ok(label + ": the server is asked for no checkout and no price", asked.length === 0, asked);
      ok(label + ": the one-time ask is neither due nor spent", v.due === false && v.spent === null, { due: v.due, spent: v.spent });
      ok(label + ": no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
}
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
  // (since 3 Oct 2026 a family who starts with the trial goes to the plan
  // screen in between: trialfirsttest pins that line)
  ok("a parent's setup ends in the first game; a clinician's still on Home", /var first="\/today\.html";try\{if\(draft\.role!=="slp"&&Sona\.firstGameStart\)first=Sona\.firstGameStart\(\);\}catch\(e\)\{\}\s*var wall=false;[^\n]*\n\s*if\(wall\)\{[^\n]*\}\s*location\.href=first;/.test(ob));
}

await browser.close(); await new Promise((r) => server.close(r));
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
