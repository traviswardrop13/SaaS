// TRIAL FIRST (Travis, 3 Oct 2026): "lets add the paywall before they try
// anything in the app. and then they unlock everything. so fruit slice and
// piano tiles and feed echo and bubble pop are all part of paid or needing to
// start a trial", then, with ReciMe's onboarding screenshots (two screens
// about the free days, then the price): "something like this. yeah home
// locked". (Those two screens were built on 3 Oct and left on 5 Oct 2026:
// the price screen says what they said, in its own two rows.)
//
// This plays the rule and the flow on fake phones:
//   - who keeps the free version (Sona.freeVersion): a phone that cannot buy
//     (no purchase plugin, or a browser while the website does not sell), a
//     household already set up on the build's first load (the one-shot
//     "sona.freever.v1" sweep), a family who joined through their speech
//     therapist; nobody else;
//   - the price screen on the hand-off from setup (?setup=1) is ONE screen
//     since 5 Oct 2026: the two screens that stood before the price are gone,
//     and the card itself says what the store sells (the monthly plan, with
//     its free days when the store gives them, "charged today" when it does
//     not, and no price at all when the store does not answer);
//   - "Not now" goes to Home with every game and book locked;
//   - a purchase from setup goes back to setup, for the microphone and the
//     hand-off, when the tab still carries setup's marker; else Home.
// Setup's own half (ready, the marker being written, the microphone after the
// price) is played in setupbuytest and onboardingtest; here /onboarding.html
// is a stub, so this suite holds whatever that page is doing. Every size and
// every store state of the card is pricescreentest's.
import { chromium, launchOpts } from "./_env.mjs";
import { serve, open, calm, STORES } from "./_phone.mjs";

const { base: BASE, close } = await serve();
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(detail))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, e.stack); } }

// A phone: the shared fake (tests/_phone.mjs). cfg.app: "buy" (the app with
// the purchase plugin), "nobuy" (an app build without it, like the App
// Store's 1.0.4) or absent (a browser). cfg.stamp: what the free-version
// sweep already wrote ("kept"/"post"), or absent for a phone loading this
// build for the first time. cfg.setUp seeds a set-up child; cfg.slp a
// clinician's verified link; cfg.webSells the website selling (its test
// seam). What the store says of the monthly plan, the only one Apple's card
// offers: cfg.store (a STORES entry) or the older cfg.intro, "free3" (3 free
// days), "none" (charged today) or "hang" (never answers).
// /onboarding.html is a stub that only loads sona.js: a phone with no child
// set up is sent there by Home, and the rule checks below read Sona on
// whatever page they land on.
async function fresh(cfg = {}, viewport = { width: 390, height: 844 }) {
  const o = await open(browser, BASE, cfg, viewport);
  await o.context.route("**/onboarding.html", (r) => r.fulfill({ contentType: "text/html", body: '<!doctype html><title>setup</title><p>setup</p><script src="/sona.js"></script>' }));
  return o;
}
const FREE4 = ["slice", "tiles", "feed", "bubbles"];
const rule = (page) => page.evaluate((keys) => ({
  stamp: localStorage.getItem("sona.freever.v1"),
  free: Sona.freeVersion(), first: Sona.trialFirst(),
  open: keys.filter((k) => Sona.gameAccess(k).allowed),
  book: Sona.bookFree("Rory and the Rainbow") && !Sona.bookLocked("Rory and the Rainbow"),
  practice: !Sona.gated("practice"),
}), FREE4);

try {
  // ── the rule: who keeps the free version ──
  await scenario("a new phone in the app that can buy", async () => {
    const { context, page, errors } = await fresh({ app: "buy" });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => window.Sona && Sona.freeVersion);
      const r = await rule(page);
      ok("a new phone in the app that can buy is stamped before it is set up, and has no free version", r.stamp === "post" && r.free === false, r);
      ok("…so Fruit Slice, Piano Tiles, Feed Echo and Bubble Pop are locked, with the free book and practice", r.open.length === 0 && !r.book && !r.practice, r);
      ok("…and its setup ends on the plan screen", r.first === true, r);
      ok("new phone: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  await scenario("a phone set up before this build", async () => {
    const { context, page, errors } = await fresh({ app: "buy", setUp: true });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => window.Sona && Sona.freeVersion);
      const r = await rule(page);
      ok("a phone already set up on its first load keeps the free version: the four games, the free book and practice", r.stamp === "kept" && r.free && r.open.length === 4 && r.book && r.practice && !r.first, r);
      ok("…and the mark is one-shot: a later load never re-judges it", await page.evaluate(() => { localStorage.removeItem("sona.profile.v1"); return true; }) &&
        await page.reload().then(() => page.waitForFunction(() => window.Sona && Sona.freeVersion)).then(() => page.evaluate(() => localStorage.getItem("sona.freever.v1") === "kept" && Sona.freeVersion())), "");
      ok("kept: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  for (const [label, cfg] of [
    ["an app build with no purchase plugin (the App Store's 1.0.4)", { app: "nobuy", stamp: "post", setUp: true }],
    ["a browser while the website does not sell", { stamp: "post", setUp: true }],
    ["a family who joined through their speech therapist", { app: "buy", stamp: "post", setUp: true, slp: true }],
  ]) await scenario(label, async () => {
    const { context, page, errors } = await fresh(cfg);
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => window.Sona && Sona.freeVersion);
      const r = await rule(page);
      ok(label + ": keeps the free version, so nobody meets a wall they cannot pass", r.free && r.open.length === 4 && r.book && r.practice && !r.first, r);
      ok(label + ": no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  await scenario("a browser while the website sells", async () => {
    const { context, page } = await fresh({ stamp: "post", setUp: true, webSells: true });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => window.Sona && Sona.freeVersion);
      const r = await rule(page);
      ok("a browser where the website sells is like the app: no free version for a family set up after the build", !r.free && r.open.length === 0 && r.first, r);
    } finally { await context.close(); }
  });
  await scenario("Premium", async () => {
    const { context, page } = await fresh({ app: "buy", stamp: "post", setUp: true });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => window.Sona && Sona.freeVersion);
      await page.evaluate(() => localStorage.setItem("sona.founder", "1"));
      const r = await page.evaluate((keys) => ({ premium: Sona.premium(), open: keys.filter((k) => Sona.gameAccess(k).allowed), first: Sona.trialFirst(), practice: !Sona.gated("practice") }), FREE4);
      ok("Premium from any source still opens all four games and practice, and setup never shows it a price", r.open.length === 4 && r.practice && !r.first, r);
    } finally { await context.close(); }
  });
  await scenario("a backup", async () => {
    const { context, page } = await fresh({ app: "buy", stamp: "post", setUp: true });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => window.Sona && Sona.importData);
      const r = await page.evaluate(() => { const res = Sona.importData({ app: "sona", v: 1, data: { "sona.freever.v1": "kept", "sona.profile.v1": JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true }) } });
        return { ok: res && res.ok !== false, stamp: localStorage.getItem("sona.freever.v1"), free: Sona.freeVersion() }; });
      ok("a pasted backup never brings the kept mark: the phone that loaded it stays as it was judged", r.stamp === "post" && r.free === false, r);
    } finally { await context.close(); }
  });

  // ── the price screen on the hand-off from setup ──
  // ONE screen (5 Oct 2026). What is painted, never the hidden attribute.
  const SEEN = (page) => page.evaluate(() => {
    const g = (id) => document.getElementById(id);
    const seen = (el) => { if (!el) return false; const cs = getComputedStyle(el), r = el.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0; };
    const text = (id) => (seen(g(id)) ? g(id).innerText.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim() : "");
    return {
      intro: ["trialIntro", "tiFree", "tiDate"].filter((id) => !!g(id)),
      state: g("iapCard").getAttribute("data-state"), card: seen(g("iapCard")), offer: document.body.classList.contains("offer"),
      header: seen(document.querySelector(".family-header")), tabs: seen(document.querySelector(".family-tabs")),
      title: text("offerTitle"), sub: text("offerSub"), check3: text("offerCheck3"),
      tag: text("iapTag"), price: text("iapAmt"), under: text("iapLine"), check: text("iapCheck"), what: text("iapWhat"), rows: seen(g("iapTL")) ? [...g("iapTL").children].map((li) => [li.querySelector("b").textContent, li.querySelector("p").textContent.replace(/\u00a0/g, " ")]) : [],
      note: text("iapNote"), none: text("iapNone"), btn: text("iapBuy"), act: g("iapBuy").getAttribute("data-act"), disabled: g("iapBuy").disabled,
      decline: text("declineLink"), declineShown: seen(g("declineRow")), freeCard: seen(g("freeTierCard")),
      line: g("planLine").textContent, cardText: seen(g("iapCard")) ? g("iapCard").innerText : "", body: document.body.innerText.replace(/\u00a0/g, " "),
      spent: localStorage.getItem("sona.planmoment.v1"), marker: sessionStorage.getItem("sona.setupafter.v1"),
      viewed: (window.__phone.events || []).filter((e) => e.name === "paywall viewed").length,
    };
  });
  const priced = (page) => page.waitForFunction(() => /^(free|paid)$/.test(document.getElementById("iapCard").getAttribute("data-state")));
  await scenario("the price screen from setup", async () => {
    const { context, page, errors } = await fresh({ app: "buy", stamp: "post", setUp: true, marker: true, intro: "free3" });
    try {
      await page.goto(BASE + "/subscribe.html?setup=1");
      await priced(page);
      if (process.env.TRIAL_SHOTS) { await page.waitForTimeout(400); await page.screenshot({ path: process.env.TRIAL_SHOTS + "/1-price.png" }); }
      const s = await SEEN(page);
      ok("the hand-off from setup opens on the price itself: the two screens that stood before it are gone from the page",
        s.intro.length === 0 && s.card && s.offer, s.intro);
      ok("…as the offer, with no header and no Settings tabs: the grown-up is still in setup", !s.header && !s.tabs, { header: s.header, tabs: s.tabs });
      ok("…its headline carries on from setup (\"Mia's practice is ready\"), with no second line under it",
        s.title === "Mia's practice is ready" && s.sub === "", [s.title, s.sub]);
      // the day the first charge falls: computed here, in the page's own
      // zone, exactly as a parent's phone would write it. Never a typed date.
      const day = await page.evaluate(() => new Date(Date.now() + 3 * 86400000).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
      ok("the store says the monthly plan starts with 3 free days, so the card says so: the row, the check line, and the button",
        s.state === "free" && s.under === "3-day free trial" && s.price === "$9.99/mo" && s.check === "No payment today · Subscription auto-renews" && s.btn === "Start 3 days free" && !/a year/i.test(s.body), [s.state, s.tag, s.price, s.btn]);
      ok("…with no dated rows and no date (" + day + " is nowhere), and one small line under the button: the price, and Cancel anytime",
        s.rows.length === 0 && s.body.indexOf(day) === -1 && s.note === "3 days free, then $9.99 a month. Cancel anytime.", [s.rows, s.note]);
      ok("…and no promise of a reminder: Sona sends none", !/remind|e-?mail|notif/i.test(s.body), (s.body.match(/[^\n]*(remind|e-?mail|notif)[^\n]*/i) || [""])[0]);
      ok("…\"Not now\" (not \"keep the free version\") under it, and no \"What stays free\"", s.declineShown && s.decline === "Not now" && !s.freeCard, [s.decline, s.freeCard]);
      ok("…and nothing on it says anything stays free", !/stays? free|free games|free version/i.test(s.body) && s.check3 === "No ads, ever" && !/free version/.test(s.line),
        (s.body.match(/[^\n]*(stays? free|free games|free version)[^\n]*/i) || [s.check3, s.line])[0]);
      ok("the price is counted as seen once it is really on the screen, and once", !!s.spent && s.viewed === 1, { spent: s.spent, viewed: s.viewed });
      ok("the price screen from setup: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  for (const [label, marker, want] of [
    ["with setup's marker in this tab, the buyer goes back to setup for the microphone and the hand-off", true, /\/onboarding\.html$/],
    ["without it (the app was closed and reopened on the way), Home", false, /\/today\.html$/],
  ]) await scenario("the free days start, " + (marker ? "marker" : "no marker"), async () => {
    const { context, page, errors } = await fresh({ app: "buy", stamp: "post", setUp: true, marker, intro: "free3" });
    try {
      await context.route("**/today.html", (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><title>home</title><p>home</p>" }));
      await page.goto(BASE + "/subscribe.html?setup=1");
      await priced(page); await calm(page);
      await page.locator("#iapBuy").click();
      await page.waitForFunction(() => document.getElementById("iapCard").getAttribute("data-state") === "done");
      const said = await page.evaluate(() => ({ msg: document.getElementById("iapMsg").innerText.trim(), decline: document.getElementById("declineRow").getBoundingClientRect().height }));
      ok("starting the free days says so on the card (\"Sona Premium is on. Welcome to Sona!\"), and \"Not now\" leaves with the price",
        said.msg === "Sona Premium is on. Welcome to Sona!" && said.decline === 0, said);
      await page.waitForURL(want, { timeout: 8000 });
      const got = await page.evaluate(() => ({ bought: localStorage.getItem("__bought"), ent: localStorage.getItem("__ent"), sub: JSON.parse(localStorage.getItem("sona.sub.v1") || "{}") }));
      ok("…it buys the product the store named, the monthly plan, and unlocks", got.bought === "com.speaksona.app.monthly" && got.ent === "1" && got.sub.active === true && got.sub.source === "apple", got);
      ok("…and " + label, want.test(page.url()), page.url());
      ok("free days started, " + (marker ? "marker" : "no marker") + ": no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  await scenario("Not now", async () => {
    const { context, page, errors } = await fresh({ app: "buy", stamp: "post", setUp: true, marker: true, intro: "free3" });
    try {
      await page.goto(BASE + "/subscribe.html?setup=1");
      await priced(page); await calm(page);
      ok("the marker is there while the price is being read", !!(await SEEN(page)).marker);
      await page.locator("#declineLink").click();
      await page.waitForURL(/\/today\.html/);
      await page.waitForFunction(() => document.querySelectorAll(".game-card").length > 0);
      if (process.env.TRIAL_SHOTS) { await page.waitForTimeout(600); await page.screenshot({ path: process.env.TRIAL_SHOTS + "/2-home.png" }); }
      ok("\"Not now\" ends the hand-off: setup's marker is cleared, so nothing later reopens the microphone step", await page.evaluate(() => sessionStorage.getItem("sona.setupafter.v1") === null));
      const h = await page.evaluate((keys) => keys.map((k) => { const b = document.querySelector('#activityGroups .game-card[data-game="' + k + '"]');
        return b ? { k, locked: b.dataset.locked, label: (b.querySelector(".game-access") || {}).textContent } : { k, missing: true }; }), FREE4);
      ok("\"Not now\" goes Home with Fruit Slice, Piano Tiles, Feed Echo and Bubble Pop locked, each marked Premium, none \"Free\"",
        h.every((c) => c.locked === "true" && c.label === "Premium"), h);
      const books = await page.evaluate(() => document.getElementById("booksTag").textContent);
      ok("…and the Books card says Premium, not \"1 free book\"", books === "Premium", books);
      // a grey game opens the price at once (Travis, 4 Oct 2026: "I want it
      // to open automatically if they click on a game that is grayed out")
      await page.locator('#activityGroups .game-card[data-game="slice"]').click();
      await page.waitForURL(/\/subscribe\.html\?from=slice$/);
      await page.waitForFunction(() => document.body.classList.contains("offer"));
      await priced(page);
      const o = await SEEN(page);
      ok("a tap on grey Fruit Slice opens the price at once, on that game, with \"Not now\" under it", /^Unlock Fruit Slice, and every other game$/.test(o.title) && o.card && o.decline === "Not now", [o.title, o.card, o.decline]);
      ok("…with no header there either: the small X is the way out", !o.header && o.sub === "", [o.header, o.sub]);
      ok("Not now: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  await scenario("the store sells the monthly plan with no free days", async () => {
    const { context, page, errors } = await fresh({ app: "buy", stamp: "post", setUp: true, marker: true, store: STORES.noFree });
    try {
      await page.goto(BASE + "/subscribe.html?setup=1");
      await priced(page);
      const s = await SEEN(page);
      ok("no free days in the store: the card charges today and says so, on the tile and on the button",
        s.state === "paid" && s.price === "$9.99/mo" && s.under === "Charged today" && s.btn === "Subscribe — $9.99 a month" && /Charged to your Apple ID today, then every month\./.test(s.note), [s.state, s.price, s.btn, s.note]);
      ok("…with no tag, no dated rows, and not one visible word \"free\" anywhere on the screen", !s.tag && s.rows.length === 0 && !/\bfree\b/i.test(s.body), (s.body.match(/[^\n]*\bfree\b[^\n]*/i) || [""])[0]);
      ok("no free days: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  for (const [label, cfg, title] of [
    ["the store never answers", { intro: "hang" }, "We couldn't reach the App Store."],
    ["the store has no monthly plan to sell", { store: STORES.empty }, "Sona Premium can't be bought right now."],
  ]) await scenario(label, async () => {
    const { context, page, errors } = await fresh(Object.assign({ app: "buy", stamp: "post", setUp: true, marker: true }, cfg));
    try {
      const t0 = Date.now();
      await page.goto(BASE + "/subscribe.html?setup=1");
      const first = await SEEN(page);
      if (cfg.intro === "hang") ok(label + ": while it waits the button says it is checking and takes no tap, and no price is on the screen",
        first.state === "wait" && first.btn === "Checking the App Store…" && first.disabled && !/\$|\d/.test(first.cardText), [first.state, first.btn, first.disabled]);
      await page.waitForFunction(() => document.getElementById("iapCard").getAttribute("data-state") === "none", null, { timeout: 9000 });
      const s = await SEEN(page), took = Date.now() - t0;
      // the words are the card's own (Sona.planWords), read back from it
      const w = await page.evaluate(() => Sona.storePlan().then((plan) => Sona.planWords(plan, { freeVersion: false })));
      ok(label + ": the card says \"" + title + "\", in Sona.planWords's own words, with Try again and Not now",
        w.none.title === title && s.none === w.none.title + " " + w.none.text && s.btn === "Try again" && s.act === "retry" && !s.disabled && s.declineShown && s.decline === "Not now", [s.none, s.btn, s.decline]);
      ok(label + ": no figure and no \"free\" on the card" + (cfg.intro === "hang" ? ", within about four seconds" : ", straight away"), !/\$|\d|free/i.test(s.cardText) && (cfg.intro !== "hang" || took < 7000), { card: s.cardText, took });
      ok(label + ": nothing is spent: no impression is counted and the one ask is still due", !s.spent && s.viewed === 0, { spent: s.spent, viewed: s.viewed });
      ok(label + ": no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });

  // ── a grey game or book, with no grown-up check this session ──
  await scenario("a grey game, no check", async () => {
    const { context, page, errors } = await fresh({ app: "buy", stamp: "post", setUp: true, intro: "free3", noGate: true });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => document.querySelectorAll(".game-card").length > 0);
      await page.locator('#activityGroups .game-card[data-game="stack"]').click();
      await page.waitForURL(/\/subscribe\.html\?from=stack$/);
      await page.waitForFunction(() => document.body.classList.contains("offer") && getComputedStyle(document.getElementById("iapCard")).display !== "none");
      await page.waitForTimeout(400);
      const v = await page.evaluate(() => ({ path: location.pathname + location.search, shown: getComputedStyle(document.documentElement).display !== "none" && getComputedStyle(document.documentElement).visibility !== "hidden",
        tabs: getComputedStyle(document.querySelector(".family-tabs")).display === "none", gate: !!sessionStorage.getItem("sona.gate.v1") }));
      ok("a grey game opens the price with no grown-up check in between, and opens nothing else of the grown-ups' pages", v.path === "/subscribe.html?from=stack" && v.shown && v.tabs && !v.gate, v);
      ok("grey game, no check: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  await scenario("a grey book", async () => {
    const { context, page, errors } = await fresh({ app: "buy", stamp: "post", setUp: true, intro: "free3", noGate: true });
    try {
      await page.goto(BASE + "/library.html"); await page.waitForFunction(() => document.querySelectorAll(".bookBtn.locked").length > 0);
      await page.locator(".bookBtn.locked").first().click();
      await page.waitForURL(/\/subscribe\.html\?from=library$/, { timeout: 6000 });
      ok("a grey book opens the price at once too", /\/subscribe\.html\?from=library$/.test(page.url()), page.url());
      ok("grey book: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  await scenario("a phone that cannot buy", async () => {
    const { context, page, errors } = await fresh({ app: "nobuy", stamp: "post", setUp: true });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => document.querySelectorAll(".game-card").length > 0);
      await page.locator('#activityGroups .game-card[data-game="stack"]').click();
      await page.waitForTimeout(500);
      const v = await page.evaluate(() => ({ path: location.pathname, notice: !document.getElementById("libraryNotice").hidden, msg: document.getElementById("libraryMessage").textContent }));
      ok("on a phone that cannot buy, a grey game still shows the grown-up note: there is nothing to open", v.path === "/today.html" && v.notice && /^Ask a grown-up to help open Block Stacker\./.test(v.msg), v);
      ok("cannot buy: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  await scenario("the plan page by address, with Premium", async () => {
    const { context, page } = await fresh({ app: "buy", stamp: "post", setUp: true, noGate: true });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => window.Sona && Sona.premium);
      await page.evaluate(() => localStorage.setItem("sona.founder", "1"));
      await page.goto(BASE + "/subscribe.html?from=stack");
      await page.waitForURL(/\/today\.html\?gate=1/, { timeout: 6000 }).catch(() => {});
      ok("a ?from= visit that shows no offer (this family has Premium) is Settings › Your plan, and asks the grown-up check", /\/today\.html\?gate=1/.test(page.url()), page.url());
    } finally { await context.close(); }
  });

  // ── a family who keeps the free version sees the page as it was ──
  await scenario("kept family, Settings view", async () => {
    const { context, page, errors } = await fresh({ app: "buy", setUp: true, intro: "free3" });
    try {
      await page.goto(BASE + "/subscribe.html");
      await page.waitForFunction(() => getComputedStyle(document.getElementById("iapCard")).display !== "none");
      await page.waitForFunction(() => /^(free|paid)$/.test(document.getElementById("iapCard").getAttribute("data-state")));
      const v = await page.evaluate(() => ({ line: document.getElementById("planLine").textContent, header: document.querySelector(".family-header").getBoundingClientRect().height > 0 }));
      ok("a family who kept the free version still reads \"Today: the free version\", in Settings › Your plan with its header", /^Today: the free version\. Sona Premium: 3 days free, then \$9\.99 a month\.$/.test(v.line) && v.header, v);
      ok("kept family: no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
  // ── the old daily run asks the practice gate too ──
  await scenario("the old daily run", async () => {
    const { context, page } = await fresh({ app: "buy", stamp: "post", setUp: true });
    try {
      await page.goto(BASE + "/charge.html?daily=1");
      await page.waitForURL((u) => !/\/charge\.html/.test(u.pathname), { timeout: 5000 }).catch(() => {});
      ok("a typed address to the old daily run sends a family without the free version Home, before any mic or sound", !/\/charge\.html/.test(new URL(page.url()).pathname), page.url());
    } finally { await context.close(); }
  });
  // ── the grown-ups check carries the hand-off ──
  await scenario("the gate", async () => {
    const { context, page } = await fresh({ app: "buy", stamp: "post", setUp: true });
    try {
      await page.goto(BASE + "/today.html"); await page.waitForFunction(() => window.Sona && Sona.gateDest);
      const d = await page.evaluate(() => [Sona.gateDest("/subscribe.html?setup=1"), Sona.gateDest("/subscribe.html?setup=2")]);
      ok("the grown-ups check carries ?setup=1 to the plan screen, and nothing else of it", d[0] === "/subscribe.html?setup=1" && d[1] === "/subscribe.html", d);
    } finally { await context.close(); }
  });
} finally { await browser.close(); await close(); }
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
