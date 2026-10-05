// THE PRICE SCREEN IN THE APP: ONE PLAN, PAINTED FROM THE STORE'S ANSWER
// (5 Oct 2026).
//
// Travis, 5 Oct 2026: "get rid of the annual option and update the copy so
// that it says three days free, then $9.99 a month". Apple's card on
// subscribe.html sells the monthly product alone, and it ships EMPTY: every
// figure, free day and sentence on it is what Sona.planWords says for the
// answer Sona.storePlan got from the store (planwordstest holds those two).
// This suite plays the card itself, as the app that can sell, against the
// shared fake phone (tests/_phone.mjs):
//   - in every store state, from every door (setup, a grey game, a grey book,
//     a first run, Settings), the card says planWords's words and nothing
//     else: free days only when the store gives them and Apple does not say
//     this buyer has used them, "charged today" otherwise, and NO figure when
//     the store does not answer or has no monthly product (the yearly product
//     is never sold in its place);
//   - late answers repaint the card by themselves; a paying family is never
//     sold a second plan; nothing promises a reminder;
//   - every way a purchase can end, and the one line the card says after a
//     sale, with "Not now" gone;
//   - the hand-off from setup: no header, the headline, and the buyer going
//     back to setup when the tab carries setup's marker;
//   - the fit at six screen sizes, and that nothing moves under a finger;
//   - the safety net: if storePlan itself is missing or broken, the card
//     still sells the monthly product the old way.
// /onboarding.html, /today.html and /charge.html are stubs here: setup's own
// half is played in setupbuytest and onboardingtest.
import { readFileSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";
import { serve, open, calm, STORES, IDS, NOON, isOrange, isTeal } from "./_phone.mjs";

const STUB = (what) => "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>" + what + "</title></head><body><p id=\"stub\">" + what + "</p></body></html>";
const { base, hits, close } = await serve({ pages: { "/onboarding.html": STUB("setup"), "/today.html": STUB("home"), "/charge.html": STUB("game") } });
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(detail))); }
const flat = (s) => String(s == null ? "" : s).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ONE fake phone for most of the suite, loaded fresh for each case: its
// storage is emptied and the case's config is left where the init script
// reads it. Its clock starts at local noon on Monday 5 October 2026 and runs,
// so a wait the page makes (4 s for the store, 30 s on Apple's sheet, the
// 10 s watch for an approval) is skipped with clock.runFor, not sat through.
const A = await open(browser, base, { app: "buy" }, { width: 390, height: 844 });
const page = A.page, errors = A.errors;
await page.clock.install({ time: new Date(NOON) });
await page.goto(base + "/__blank.html");
async function load(cfg, url, viewport) {
  if (viewport) await page.setViewportSize(viewport);
  await page.evaluate((c) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("__phoneCfg", JSON.stringify(c)); }, cfg);
  await page.goto(base + url);
}
async function scenario(name, fn) {
  const before = errors.length;
  try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, e.stack); }
  ok(name + ": no page errors", errors.length === before, errors.slice(before));
  // leave nothing of this scenario's page running under the next one's load
  await page.goto(base + "/__blank.html").catch(() => {});
  await page.setViewportSize({ width: 390, height: 844 });
}
const tick = (ms) => page.clock.runFor(ms);
const until = (state, pg = page) => pg.waitForFunction((s) => document.getElementById("iapCard").getAttribute("data-state") === s, state);
const priced = (pg = page) => pg.waitForFunction(() => /^(free|paid)$/.test(document.getElementById("iapCard").getAttribute("data-state")));
// "offer dismissed" goes out as a beacon to /api/track just before the page
// leaves: read from the server's own list, a moment later
const dismissals = async (from) => { await new Promise((r) => setTimeout(r, 200)); return hits.slice(from).filter((h) => h.path === "/api/track" && /"offer dismissed"/.test(h.body)).map((h) => h.body); };

// What a parent can read, by what is PAINTED (computed display and a real
// box), never by the hidden attribute the page sets.
const SNAP = () => {
  const g = (id) => document.getElementById(id);
  const seen = (el) => { if (!el) return false; const cs = getComputedStyle(el), r = el.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0; };
  const tidy = (s) => String(s == null ? "" : s).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const text = (id) => (seen(g(id)) ? tidy(g(id).innerText) : "");
  const card = g("iapCard"), tl = g("iapTL"), note = g("iapNote");
  const after = (el) => { let n = el.nextElementSibling; while (n && !seen(n)) n = n.nextElementSibling; return n ? n.id || n.className : ""; };
  return {
    state: card.getAttribute("data-state"), shown: seen(card),
    title: tidy(g("iapTitle").textContent), titleSeen: seen(g("iapTitle")),
    tile: seen(g("iapPlan")), name: seen(g("iapPlan")) ? tidy(g("iapPlan").querySelector(".oneplan-name").textContent) : "",
    tag: text("iapTag"), price: text("iapPrice"), what: text("iapWhat"),
    rows: seen(tl) ? [...tl.children].map((li) => [li.querySelector("b").textContent, tidy(li.querySelector("p").textContent)]) : [],
    note: text("iapNote"), noteAbove: seen(note) && seen(tl) ? note.getBoundingClientRect().bottom <= tl.getBoundingClientRect().top : null,
    none: text("iapNone"), button: text("iapBuy"), act: g("iapBuy").getAttribute("data-act"), disabled: g("iapBuy").disabled, busy: g("iapBuy").getAttribute("aria-busy"),
    buttons: [...document.querySelectorAll("#iapCard button.go")].filter(seen).length,
    radiosInCard: document.querySelectorAll("#iapCard [role=radio], #iapCard [role=radiogroup]").length,
    radiosPainted: [...document.querySelectorAll("[role=radio]")].filter(seen).length,
    old: ["tiFree", "tiDate", "trialIntro", "iapPlanMo", "iapPlans", "iapMath", "iapMathMo"].filter((id) => !!g(id)),
    msg: text("iapMsg"), line: tidy(g("planLine").textContent), cancel: seen(g("planCancel")),
    decline: text("declineLink"), declineSeen: seen(g("declineLink")), restoreSeen: seen(g("iapRestore")),
    legal: seen(g("iapLegal")) ? tidy(g("iapLegal").innerText) : "", afterCard: after(card), afterDecline: seen(g("declineRow")) ? after(g("declineRow")) : "",
    header: seen(document.querySelector(".family-header")), tabs: seen(document.querySelector(".family-tabs")), offer: document.body.classList.contains("offer"),
    offerTitle: text("offerTitle"), offerSub: text("offerSub"), pill: text("offerPill"), pick: seen(g("pickCard")), freeCard: seen(g("freeTierCard")),
    settling: document.body.classList.contains("price-settling"),
    cardText: seen(card) ? card.innerText.replace(/\u00a0/g, " ") : "", body: document.body.innerText.replace(/\u00a0/g, " "),
    spent: localStorage.getItem("sona.planmoment.v1"), marker: sessionStorage.getItem("sona.setupafter.v1"),
    bought: window.__phone.bought.slice(), asked: window.__phone.asked.slice(), syncs: window.__phone.syncs, restores: window.__phone.restores, confetti: window.__phone.confetti,
    events: window.__phone.events.map((e) => [e.name, e.props]),
    sub: JSON.parse(localStorage.getItem("sona.sub.v1") || "{}"), path: location.pathname + location.search,
  };
};
const snap = (pg = page) => pg.evaluate(SNAP);
const viewed = (s) => s.events.filter((e) => e[0] === "paywall viewed").length;
const told = (s) => s.events.filter((e) => e[0] === "price state").map((e) => e[1].step);
// the same card, in Sona.planWords's own words for what the store answered
const words = (pg = page) => pg.evaluate(() => Sona.storePlan().then((plan) => Sona.planWords(plan, { freeVersion: Sona.freeVersion() })));
// field by field. An empty list means the card says exactly those words.
function differs(s, w) {
  const bad = [], priced = w.state === "free" || w.state === "paid", want = (k, got, exp) => { if (!same(got, exp)) bad.push(k + ": " + JSON.stringify(got) + " ≠ " + JSON.stringify(exp)); };
  want("state", s.state, w.state);
  want("title", s.title, flat(w.title));
  want("tile painted", s.tile, priced || w.state === "wait");
  want("name", s.name, s.tile ? "Sona Premium" : "");
  want("tag", s.tag, w.tag);
  want("price", s.price, s.tile ? w.price : "");
  want("what", s.what, s.tile ? w.what : "");
  want("rows", s.rows, w.rows.map((r) => [r.when, flat(r.text)]));
  want("note", s.note, flat(w.note));
  if (w.noteFirst) want("note above the rows", s.noteAbove, true);
  want("none", s.none, w.none ? w.none.title + " " + w.none.text : "");
  want("button", s.button, w.button);
  want("act", s.act, w.act);
  return bad;
}

// who is holding the phone
const POST = { stamp: "post", setUp: true };            // set up after trial-first: no free version
const KEPT = { stamp: "kept", setUp: true };            // set up before it: keeps the free version
// a practice run finished today, so ?first=1 has its "just practiced" line
const RECAP = { "sona.outcomes.v1": { R: { days: { "2026-10-05": { a: 12, p: 9 } } } }, "sona.reps.v1": { d: "2026-10-05", n: 12 } };
const DOORS = [
  ["setup (?setup=1)", "/subscribe.html?setup=1", Object.assign({ marker: true }, POST)],
  ["a grey game (?from=slice)", "/subscribe.html?from=slice", POST],
  ["a grey book (?from=library)", "/subscribe.html?from=library", POST],
  ["a first run (?first=1)", "/subscribe.html?first=1", Object.assign({ local: RECAP }, KEPT)],
  ["Settings › Your plan", "/subscribe.html", POST],
  ["Settings › Your plan, a family with the free version", "/subscribe.html", KEPT],
];
const SETUP = DOORS[0];
const at = (door, extra) => [Object.assign({}, door[2], extra || {}), door[1]];

try {
  // ── 1. each store state, from each door: the card is planWords's words ──
  await scenario("each store state, from each door", async () => {
    const STATES = [
      ["free days, and Apple says this buyer gets them", { store: STORES.monthlyFree }, "free"],
      ["free days, but the phone cannot tell whether this buyer gets them", { store: STORES.monthlyFree, elig: "missing" }, "free"],
      ["no free days in the store", { store: STORES.noFree }, "paid"],
      ["free days in the store, but Apple says this buyer has used them", { store: STORES.monthlyFree, elig: { monthly: 1 } }, "paid"],
      ["the store cannot be reached", { products: "fail" }, "none"],
      ["the store has nothing to sell", { store: STORES.empty }, "none"],
      ["the store has only the yearly product", { store: STORES.yearOnly }, "none"],
      ["the store answers the monthly ask with the yearly product", { store: STORES.yearOnly, wrong: true }, "none"],
    ];
    for (const [stateName, storeCfg, want] of STATES) for (const door of DOORS) {
      await load(...at(door, storeCfg));
      await until(want);
      const s = await snap(), w = await words(), kept = door[2].stamp === "kept", tag = stateName + ", from " + door[0] + ": ";
      const bad = differs(s, w);
      ok(tag + "the card says what Sona.planWords says, field by field", bad.length === 0, bad);
      ok(tag + "one buy button, no radio in the card, none painted anywhere, and the two intro screens and the old boxes are not in the page",
        s.buttons === 1 && s.radiosInCard === 0 && s.radiosPainted === 0 && s.old.length === 0 && !s.pick, [s.buttons, s.radiosInCard, s.radiosPainted, s.old, s.pick]);
      ok(tag + "the header line is the same plan" + (kept ? ", after \"Today: the free version.\"" : ", with no word about a free version"),
        s.line === (kept ? "Today: the free version. " : "") + w.header && (kept || !/free version/.test(s.line)), s.line);
      ok(tag + "nothing on the screen says email, remind or notify", !/e-?mail|remind|notif/i.test(s.body), (s.body.match(/[^\n]*(e-?mail|remind|notif)[^\n]*/i) || [""])[0]);
      ok(tag + "nothing on the screen is about a year, and no saving is claimed", !/a year|\/yr|yearly|annual|59\.99|119\.88|59\.89|save \$|half/i.test(s.body), (s.body.match(/[^\n]*(a year|\/yr|yearly|annual|59\.99|save \$)[^\n]*/i) || [""])[0]);
      if (want === "none") {
        ok(tag + "no figure, no day count and no \"free\" on the card, and nothing counted as an offer",
          !/\$|\d|free/i.test(s.cardText) && !/\$|\d/.test(s.line.replace("Today: the free version. ", "")) && viewed(s) === 0 && !s.spent, { card: s.cardText, line: s.line, spent: s.spent });
      } else {
        ok(tag + "every figure on the screen is the store's own, and the offer is counted once", (s.body.match(/\$[\d.,]+/g) || []).every((x) => x === "$9.99") && /\$9\.99/.test(s.cardText) && viewed(s) === 1 && !!s.spent, { figures: s.body.match(/\$[\d.,]+/g), viewed: viewed(s), spent: s.spent });
      }
      if (want === "paid") ok(tag + "not one \"free\" on the card", !/free/i.test(s.cardText), s.cardText);
    }
    // the yearly product is never sold in the monthly plan's place: a tap asks again and buys nothing
    for (const [label, storeCfg] of [["only the yearly product", { store: STORES.yearOnly }], ["the yearly product under the monthly ask", { store: STORES.yearOnly, wrong: true }]]) {
      await load(...at(SETUP, storeCfg)); await until("none"); await calm(page);
      await page.locator("#iapBuy").click(); await until("none");
      const s = await snap();
      ok("a store with " + label + ": \"Try again\" asks the store again and buys nothing, and still shows no figure",
        s.bought.length === 0 && s.asked.length === 2 && s.asked.every((ids) => same(ids, [IDS.monthly])) && !/\$|\d|free/i.test(s.cardText), [s.bought, s.asked, s.cardText]);
    }
  });

  // ── 2. free days follow the store ──
  await scenario("free days follow the store", async () => {
    await load(...at(SETUP, { store: STORES.monthlyFree })); await until("free");
    let s = await snap();
    // one check against a label built in the page by the same formatter, one against the calendar
    const day = await page.evaluate(() => new Date(Date.now() + 3 * 86400000).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
    ok("the App Store today: \"3 days free, then $9.99 a month.\", the tag, the button, all from the store",
      s.tag === "3 DAYS FREE" && s.price === "3 days free, then $9.99 a month." && s.button === "Start 3 days free", [s.tag, s.price, s.button]);
    ok("…and two rows: Today, and the day the first charge falls, three exact days on (Thursday, October 8)",
      s.rows.length === 2 && s.rows[0][0] === "Today" && s.rows[1][0] === day && day === "Thursday, October 8", [s.rows, day]);
    ok("…that row says the price that starts, when to cancel by, that it renews, and where to cancel",
      s.rows[1][1] === "$9.99 a month starts, unless you cancel at least 24 hours before. Renews every month unless canceled in Settings → Subscriptions.", s.rows[1][1]);
    await calm(page); await page.locator("#iapBuy").click(); await until("done");
    s = await snap();
    ok("buying it opens Apple's sheet once, on the monthly product, with no second ask of the store", same(s.bought, [IDS.monthly]) && s.asked.length === 1, [s.bought, s.asked]);
    ok("…and the sale is reported once, as the monthly plan, from Apple",
      s.events.filter((e) => e[0] === "purchase completed").length === 1 && s.events.some((e) => e[0] === "purchase completed" && same(e[1], { source: "apple", plan: "monthly" })), s.events);
    await tick(1300); await page.waitForURL(/\/onboarding\.html$/);

    // another store: a week free, another price. Nothing on the card is ours.
    await load(...at(SETUP, { store: { monthly: { price: "$12.49", free: "P1W" }, annual: { price: "$59.99", free: "P3D" } } })); await until("free");
    s = await snap();
    ok("a store with a week free at $12.49 says 7 days and $12.49 everywhere: the tag, the line, the rows, the button",
      s.tag === "7 DAYS FREE" && s.price === "7 days free, then $12.49 a month." && s.button === "Start 7 days free" && s.rows[1][0] === "Monday, October 12" && /^\$12\.49 a month starts/.test(s.rows[1][1]) &&
      (s.body.match(/\$[\d.,]+/g) || []).every((x) => x === "$12.49") && !/\b3 days\b/i.test(s.body), [s.tag, s.price, s.button, s.rows]);
    await calm(page); await page.locator("#iapBuy").click(); await until("done");
    s = await snap();
    ok("…and buys that same product", same(s.bought, [IDS.monthly]), s.bought);
    await tick(1300); await page.waitForURL(/\/onboarding\.html$/);
  });

  // ── 3. charged today ──
  await scenario("charged today", async () => {
    for (const [label, cfg] of [["the store's plan has no free days", { store: STORES.noFree }], ["Apple says this buyer has used the free days", { store: STORES.monthlyFree, elig: { monthly: 1 } }]]) {
      await load(...at(SETUP, cfg)); await until("paid");
      const s = await snap();
      ok(label + ": the tile says \"$9.99 a month, charged today.\", the button \"Subscribe — $9.99 a month\"",
        s.price === "$9.99 a month, charged today." && s.button === "Subscribe — $9.99 a month" && !s.tag, [s.price, s.button, s.tag]);
      ok(label + ": the one line under the tile says it is charged today, every month, that it renews, and where to cancel",
        s.note === "Charged to your Apple ID today, then every month. Renews unless canceled in Settings → Subscriptions.", s.note);
      ok(label + ": no dated rows, and not one \"free\" on the card", s.rows.length === 0 && !/free/i.test(s.cardText), s.cardText);
      ok(label + ": for a family with no free version, the word \"free\" is nowhere on the whole screen", !/\bfree\b/i.test(s.body), (s.body.match(/[^\n]*\bfree\b[^\n]*/i) || [""])[0]);
      ok(label + ": told to the funnel as a charged-today card, once", same(told(s), ["paid"]), told(s));
    }
  });

  // ── 4. sure, and not sure ──
  await scenario("sure and not sure", async () => {
    for (const [label, cfg] of [["Apple answers \"unknown\"", { elig: { monthly: 0 } }], ["the phone has no way to ask (an older plugin)", { elig: "missing" }], ["the ask throws", { elig: "throw" }],
      ["a bridge that answers every unknown name with an error", { elig: "missing", sync: "missing", bridge: "proxy" }]]) {
      await load(...at(SETUP, Object.assign({ store: STORES.monthlyFree }, cfg))); await until("free");
      const s = await snap();
      ok(label + ": the free days are shown as the product reports them, for \"new subscribers\", with what happens otherwise",
        s.note === "Only new subscribers get 3 days free. Otherwise Apple charges $9.99 today. Apple shows your exact terms before you confirm." && s.button === "Start 3 days free", [s.note, s.button]);
      ok(label + ": that note sits directly under the tile, above the rows that name a day", s.noteAbove === true, s.noteAbove);
      ok(label + ": no row states \"nothing to pay today\" or a billing day as plain fact: both say \"new subscribers\"",
        s.rows.length === 2 && s.rows.every((r) => /new subscribers/i.test(r[1])) && !/Nothing to pay today/.test(s.cardText), s.rows);
      ok(label + ": told to the funnel as free days it is not sure of", same(told(s), ["free-unsure"]), told(s));
      await calm(page); await page.locator("#iapBuy").click(); await until("done");
      ok(label + ": and the button still buys the monthly plan", same((await snap()).bought, [IDS.monthly]));
      await tick(1300); await page.waitForURL(/\/onboarding\.html$/);
    }
    await load(...at(SETUP, { store: STORES.monthlyFree, elig: { monthly: 2 } })); await until("free");
    const s = await snap();
    ok("Apple says this buyer gets the free days: no note, and the rows say it plainly",
      !s.note && s.rows[0][1] === "Everything opens. Nothing to pay today." && !/new subscribers/i.test(s.cardText) && same(told(s), ["free-sure"]), [s.note, s.rows, told(s)]);
    // the two new store calls are optional: slow or broken, the card is as if they did not exist
    for (const [label, cfg, sure] of [["the \"can this buyer have free days\" ask never answers", { elig: "hang" }, false], ["the purchase sync never answers", { sync: "hang" }, true],
      ["the purchase sync fails", { sync: "fail" }, true], ["the customer record cannot be read", { info: "fail" }, true]]) {
      await load(...at(SETUP, Object.assign({ store: STORES.monthlyFree }, cfg)));
      await tick(1300); await until("free");
      const s2 = await snap();
      ok(label + ": the card is up with its price within the short grace, free days " + (sure ? "stated" : "for \"new subscribers\""), s2.button === "Start 3 days free" && !s2.disabled && !!s2.note === !sure, [s2.button, s2.disabled, s2.note]);
      await calm(page); await page.locator("#iapBuy").click(); await until("done");
      ok(label + ": and the button buys", same((await snap()).bought, [IDS.monthly]));
      await tick(1300); await page.waitForURL(/\/onboarding\.html$/);
    }
  });

  // ── 5. late answers repaint the card by themselves (R5) ──
  await scenario("late answers", async () => {
    await load(...at(SETUP, { store: STORES.monthlyFree, elig: { monthly: 1 }, wait: { elig: 2000 } }));
    await tick(1300); await until("free");
    let s = await snap();
    ok("Apple's \"not eligible\" is slow: the card first shows the free days for \"new subscribers\"", s.state === "free" && /new subscribers/.test(s.note) && s.button === "Start 3 days free", [s.state, s.note]);
    await tick(900); await until("paid");
    s = await snap();
    ok("…then, with no tap, repaints to charged today: no \"free\" left on the card", s.state === "paid" && s.button === "Subscribe — $9.99 a month" && !/free/i.test(s.cardText) && s.rows.length === 0, s.cardText);
    ok("…nothing was bought, the offer is counted once, and taps are held for a moment while the card changes under the finger",
      s.bought.length === 0 && viewed(s) === 1 && s.settling === true, [s.bought, viewed(s), s.settling]);
    ok("…and the funnel hears both cards a phone showed", same(told(s), ["free-unsure", "paid"]), told(s));

    await load(...at(SETUP, { store: STORES.monthlyFree, elig: { monthly: 2 }, wait: { elig: 2000 } }));
    await tick(1300); await until("free");
    s = await snap();
    const noteBefore = s.note;
    await tick(900);
    await page.waitForFunction(() => document.getElementById("iapNote").getBoundingClientRect().height === 0);
    s = await snap();
    ok("a late \"eligible\": the \"new subscribers\" note goes and the rows state the free days plainly", !!noteBefore && !s.note && s.rows[0][1] === "Everything opens. Nothing to pay today.", [noteBefore, s.note, s.rows]);

    // back at the front with the store out of reach: that is not news about the plan
    await load(...at(SETUP, { store: STORES.monthlyFree })); await until("free");
    await page.evaluate(() => { window.__phone.set({ products: "hang" }); document.dispatchEvent(new Event("visibilitychange")); });
    await tick(4200);
    s = await snap();
    ok("the app comes back to the front and the store cannot be reached: the price it gave a moment ago stays on the card",
      s.state === "free" && s.price === "3 days free, then $9.99 a month." && s.button === "Start 3 days free" && !s.disabled && s.asked.length === 2, [s.state, s.price, s.asked]);
    await calm(page); await page.locator("#iapBuy").click(); await until("done");
    s = await snap();
    ok("…and its button still goes to Apple with the product in hand", same(s.bought, [IDS.monthly]) && s.msg === "Sona Premium is on. Welcome to Sona!", [s.bought, s.msg]);
    await tick(1300); await page.waitForURL(/\/onboarding\.html$/);
    // …but "nothing to sell" is news, and is shown
    await load(...at(SETUP, { store: STORES.monthlyFree })); await until("free");
    await page.evaluate((store) => { window.__phone.set({ store }); document.dispatchEvent(new Event("visibilitychange")); }, STORES.yearOnly);
    await until("none");
    s = await snap();
    ok("the app comes back and the store no longer sells the monthly plan: the price goes, and nothing can be bought in its place", s.button === "Try again" && !/\$|\d|free/i.test(s.cardText) && s.bought.length === 0, s.cardText);

    // the product itself arrives after the four-second limit
    await load(...at(SETUP, { store: STORES.monthlyFree, wait: { products: 6000 } }));
    await tick(4100); await until("none");
    s = await snap();
    ok("the store is slower than four seconds: \"We couldn't reach the App Store.\", and no price", /^We couldn't reach the App Store\./.test(s.none) && !/\$|\d/.test(s.cardText) && viewed(s) === 0, s.none);
    await tick(2100); await until("free");
    s = await snap();
    ok("…and when its answer does arrive, the priced card appears by itself, and only then is the offer counted", s.price === "3 days free, then $9.99 a month." && viewed(s) === 1 && !!s.spent, [s.price, viewed(s)]);
  });

  // ── 6. could not reach the store ──
  await scenario("could not reach the store", async () => {
    for (const [label, cfg, title, code] of [
      ["the store never answers", { products: "hang" }, "We couldn't reach the App Store. Check your connection, then try again.", "none-timeout"],
      ["the store cannot even be set up", { configure: "hang" }, "We couldn't reach the App Store. Check your connection, then try again.", "none-timeout"],
      ["the store answers with an error", { products: "fail" }, "We couldn't reach the App Store. Check your connection, then try again.", "none-error"],
      ["the store has no monthly plan", { store: STORES.empty }, "Sona Premium can't be bought right now. Please try again in a little while.", "none-noproduct"],
    ]) for (const door of [SETUP, DOORS[1]]) {
      const from = hits.length, tag = label + ", from " + door[0] + ": ";
      await load(...at(door, cfg));
      await tick(4100); await until("none");
      const s = await snap();
      ok(tag + "the card says so, with Try again and Not now, and no tile", s.none === title && s.button === "Try again" && !s.disabled && s.decline === "Not now" && !s.tile, [s.none, s.button, s.decline]);
      ok(tag + "no \"$\", no digit and no \"free\" on the card", !/\$|\d|free/i.test(s.cardText), s.cardText);
      ok(tag + "it is not an offer: no impression is sent and the one ask is not spent", viewed(s) === 0 && !s.spent && same(told(s), [code]), [viewed(s), s.spent, told(s)]);
      await calm(page); await page.locator("#declineLink").click(); await page.waitForURL(/\/today\.html$/);
      ok(tag + "\"Not now\" there is not turning a price down: no \"offer dismissed\"" + (door === SETUP ? ", and it still clears setup's marker" : ""),
        (await dismissals(from)).length === 0 && await page.evaluate(() => sessionStorage.getItem("sona.setupafter.v1") === null));
    }
    // Try again, once the store is back
    await load(...at(SETUP, { store: STORES.empty })); await until("none");
    await page.evaluate((store) => window.__phone.set({ store }), STORES.monthlyFree);
    let s = await snap();
    ok("the store comes back, but nothing is painted until the parent asks again", s.state === "none" && viewed(s) === 0);
    await calm(page); await page.locator("#iapBuy").click(); await until("free");
    s = await snap();
    ok("Try again paints the free-days card, and only then is the offer counted, once", s.price === "3 days free, then $9.99 a month." && s.button === "Start 3 days free" && viewed(s) === 1 && !!s.spent && same(told(s), ["none-noproduct", "free-sure"]), [s.price, viewed(s), told(s)]);
  });

  // ── 7. waiting ──
  await scenario("waiting for the store", async () => {
    await load(...at(SETUP, { store: STORES.monthlyFree, wait: { products: 3000 } }));
    let s = await snap();
    ok("before the store answers the button says \"Checking the App Store…\" and is disabled", s.state === "wait" && s.button === "Checking the App Store…" && s.disabled && s.busy === "true", [s.state, s.button, s.disabled]);
    ok("…the tile names Sona Premium and what it opens, with no figure and no \"free\", and \"Not now\" is already there",
      s.name === "Sona Premium" && s.what === "Daily practice, every game and every book." && !s.price && !s.tag && !/\$|\d|free/i.test(s.cardText) && s.decline === "Not now", [s.name, s.what, s.cardText]);
    await page.evaluate(() => document.getElementById("iapBuy").click());
    await tick(500);
    s = await snap();
    ok("…a tap on it buys nothing, and a card still asking is not an offer", s.bought.length === 0 && s.state === "wait" && viewed(s) === 0 && !s.spent, [s.bought, s.state]);
    await tick(2600); await until("free");
    ok("…and then the price", (await snap()).button === "Start 3 days free");
    // the other two taps a waiting card takes are "Not now" (here) and Restore (under "outcomes")
    const from = hits.length;
    await load(...at(SETUP, { store: STORES.monthlyFree, products: "hang" }));
    s = await snap();
    await calm(page); await page.locator("#declineLink").click(); await page.waitForURL(/\/today\.html$/);
    ok("\"Not now\" while the card is still asking: Home, setup's marker cleared, and no \"offer dismissed\", since no price was shown to turn down",
      s.state === "wait" && (await dismissals(from)).length === 0 && await page.evaluate(() => sessionStorage.getItem("sona.setupafter.v1") === null), s.state);
  });

  // ── 8. the card ships empty, and promises no reminder ──
  {
    const raw = readFileSync(ROOT + "/subscribe.html", "utf8");
    const slice = raw.slice(raw.indexOf('id="iapCard"'), raw.indexOf('id="pickCard"'));
    ok("the source of Apple's card has no word about a reminder, a notification or an email", slice.length > 400 && !/remind|notif|e-?mail/i.test(slice), (slice.match(/[^\n]*(remind|notif|e-?mail)[^\n]*/i) || [""])[0]);
    const typed = slice.replace(/<!--[\s\S]*?-->/g, " ").replace(/<svg[\s\S]*?<\/svg>/gi, " ").replace(/<[^>]*>/g, " ");
    ok("…and with comments, the drawn icons and every tag taken out, what is left has no \"$\", no digit, no \"free\" and no \"day\": the card types nothing about money",
      !/\$|\d/.test(typed) && !/free|\bdays?\b/i.test(typed), (typed.match(/[^\n]*(\$|\d|free|\bdays?\b)[^\n]*/i) || [""])[0].trim());
    const script = raw.replace(/<!--[\s\S]*?-->/g, "").replace(/^\s*\/\/.*$/gm, "");
    ok("the page asks through Sona.storePlan, paints through Sona.planWords and Sona.planSay, and buys through Sona.buyPlan",
      /Sona\.storePlan\(/.test(script) && /Sona\.planWords\(/.test(script) && /Sona\.planSay\(/.test(script) && /Sona\.buyPlan\(/.test(script) && !/Sona\.iapPurchase\(/.test(script));
    ok("…and the two intro screens, their pictures and their event are gone from the file", !/trialIntro|tiFree|tiDate|INTRO_ART|introWait|introStart|afterIntro|trial intro viewed/.test(raw));
  }

  // ── 9. how a purchase can end ──
  await scenario("outcomes", async () => {
    const say = (code) => page.evaluate((c) => Sona.planSay(c), code);
    for (const [mode, code] of [["cancel", "cancelled"], ["pending", "pending"], ["notallowed", "not-allowed"], ["offline", "offline"], ["nogrant", "not-entitled"], ["fail", "failed"]]) {
      await load(...at(SETUP, { store: STORES.monthlyFree, buy: mode })); await until("free"); await calm(page);
      await page.locator("#iapBuy").click();
      await page.waitForFunction(() => !document.getElementById("iapBuy").disabled && window.__phone.bought.length === 1);
      const s = await snap(), line = flat(await say(code));
      ok("Apple's sheet ends \"" + mode + "\": " + (code === "cancelled" ? "no message at all" : "the card says \"" + line + "\""), s.msg === line && (code === "cancelled") === (line === ""), [s.msg, line]);
      ok("…the price stays, the button is live again, Restore and \"Not now\" are still there, and the marker is kept",
        s.state === "free" && s.button === "Start 3 days free" && !s.disabled && s.restoreSeen && s.declineSeen && !!s.marker && same(s.bought, [IDS.monthly]), [s.state, s.button, s.disabled, s.marker]);
      ok("…\"nothing was charged\" is never said, and no sale is counted", !/nothing was charged/i.test(s.body) && !s.events.some((e) => e[0] === "purchase completed"), s.msg);
    }
    // Apple's sheet never comes back
    await load(...at(SETUP, { store: STORES.monthlyFree, buy: "hang", restore: "finds" })); await until("free"); await calm(page);
    await page.locator("#iapBuy").click();
    await page.waitForFunction(() => window.__phone.bought.length === 1);
    let s = await snap();
    ok("while Apple's sheet is open: \"Opening the App Store…\", and the button is disabled", s.msg === "Opening the App Store…" && s.disabled && s.busy === "true", [s.msg, s.disabled]);
    await tick(30100);
    s = await snap();
    ok("after 30 seconds the card says it is still waiting and points at Restore, and the button stays disabled",
      s.msg === flat(await say("slow")) && /Restore Purchases/.test(s.msg) && s.disabled && s.declineSeen && s.restoreSeen, [s.msg, s.disabled]);
    await page.evaluate(() => document.getElementById("iapBuy").click());
    await tick(300);
    ok("…a second tap starts no second purchase: one in flight, ever", (await snap()).bought.length === 1);
    await calm(page); await page.locator("#iapRestore").click(); await until("done");
    s = await snap();
    ok("…and Restore still works while it waits: \"Restored ✓ — welcome back!\"", s.msg === "Restored ✓ — welcome back!" && s.restores === 1 && !s.events.some((e) => e[0] === "purchase completed"), [s.msg, s.restores]);
    await tick(1100); await page.waitForURL(/\/onboarding\.html$/);

    for (const [mode, line] of [["none", "No purchases found on this Apple ID."], ["fail", "Couldn't reach the App Store — try again in a moment."]]) {
      await load(...at(SETUP, { store: STORES.monthlyFree, restore: mode })); await until("free"); await calm(page);
      await page.locator("#iapRestore").click();
      await page.waitForFunction((l) => document.getElementById("iapMsg").textContent === l, line);
      s = await snap();
      ok("Restore, \"" + mode + "\": \"" + line + "\", and the card stays as it was", s.msg === line && s.state === "free" && !s.disabled && s.button === "Start 3 days free" && !!s.marker, [s.msg, s.state]);
    }
    // RESTORE, TAPPED WHILE THE CARD STILL SAYS "Checking the App Store…".
    // Restore is live from the first frame, and the parent most likely to tap
    // it early is a lapsed subscriber, for whom the store holds its answer
    // back longest. The price the card is waiting on must still arrive: this
    // once left "Checking…" up for good, with no price and a dead button.
    // (The store's call is held open and let go by hand, so the tap cannot
    // miss the waiting card on a slow machine. The lapsed subscriber's card
    // is first run past the short grace, 1.2 s, to show it is the longer hold
    // that is being tapped into; that hold then has 1.7 s left.)
    const NONE_FOUND = "No purchases found on this Apple ID.", NO_REACH = "Couldn't reach the App Store — try again in a moment.";
    for (const [label, cfg, line, letGo, want, button, how] of [
      ["the store has not answered, and Restore finds nothing", { store: STORES.monthlyFree, products: "hang", restore: "none" }, NONE_FOUND, { products: "ok" }, "free", "Start 3 days free", ""],
      ["the store has not answered, and Restore cannot reach it", { store: STORES.monthlyFree, products: "hang", restore: "fail" }, NO_REACH, { products: "ok" }, "free", "Start 3 days free", ""],
      ["a lapsed subscriber (Apple says not eligible, the purchase sync still out, past the short grace)", { store: STORES.monthlyFree, elig: { monthly: 1 }, sync: "hang", restore: "none" }, NONE_FOUND, { sync: null }, "paid", "Subscribe — $9.99 a month", "lapsed"],
      ["after \"Try again\", with the store slow this time", { products: "fail", restore: "none" }, NONE_FOUND, { products: "ok" }, "free", "Start 3 days free", "again"],
    ]) {
      await load(...at(SETUP, cfg));
      if (how === "again") {
        await until("none");
        await page.evaluate((store) => window.__phone.set({ products: "hang", store }), STORES.monthlyFree);
        await calm(page); await page.locator("#iapBuy").click(); await until("wait");
      }
      if (how === "lapsed") await tick(1300);
      const first = await snap();
      await calm(page); await page.locator("#iapRestore").click();
      await page.waitForFunction((l) => document.getElementById("iapMsg").textContent === l, line);
      const mid = await snap();
      ok(label + ": Restore is tapped while the button still says \"Checking the App Store…\", and answers \"" + line + "\" with the card still asking",
        first.state === "wait" && first.disabled && first.restoreSeen && mid.state === "wait" && mid.button === "Checking the App Store…" && mid.msg === line && mid.restores === 1, [first.state, first.restoreSeen, mid.state, mid.button, mid.msg, mid.restores]);
      await page.evaluate((patch) => window.__phone.set(patch), letGo);
      await until(want);
      s = await snap();
      ok(label + ": …and the price still arrives, with a live button, the message still there, and the offer counted once",
        s.state === want && s.button === button && !s.disabled && /\$9\.99 a month/.test(s.price) && s.msg === line && viewed(s) === 1 && s.bought.length === 0 && !!s.marker, [s.state, s.button, s.disabled, s.price, s.msg, viewed(s)]);
      await calm(page); await page.locator("#iapBuy").click(); await until("done");
      ok(label + ": …and that button buys", same((await snap()).bought, [IDS.monthly]));
      await tick(1300); await page.waitForURL(/\/onboarding\.html$/);
    }
    // …and a Restore that FINDS Premium while the card is still asking ends it
    // there: the store's answer, arriving after, paints no price over the welcome
    await load(...at(SETUP, { store: STORES.monthlyFree, products: "hang", restore: "finds" }));
    await calm(page); await page.locator("#iapRestore").click(); await until("done");
    await page.evaluate(() => { window.__phone.set({ products: "ok" }); return new Promise((r) => setTimeout(r, 60)); });
    s = await snap();
    ok("Restore finds Premium while the card is still asking: \"Restored ✓ — welcome back!\", and the store's answer, arriving after, paints no price over it",
      s.state === "done" && s.msg === "Restored ✓ — welcome back!" && !s.tile && !s.button && viewed(s) === 0 && s.bought.length === 0, [s.state, s.msg, s.tile, s.button, viewed(s)]);
    await tick(1100); await page.waitForURL(/\/onboarding\.html$/);
    // Apple answers the buy tap with "already purchased"
    await load(...at(SETUP, { store: STORES.monthlyFree, buy: "owned" })); await until("free"); await calm(page);
    await page.locator("#iapBuy").click(); await until("done");
    s = await snap();
    ok("Apple says \"already purchased\": the welcome-back line, a restore behind it, and it is NOT counted as a sale or celebrated",
      s.msg === "You already have Sona Premium. Welcome back!" && s.restores === 1 && !s.events.some((e) => e[0] === "purchase completed") && s.confetti === 0 && s.sub.active === true, [s.msg, s.restores, s.confetti]);
    await tick(1100); await page.waitForURL(/\/onboarding\.html$/);
  });

  // ── 10. after a sale the screen says so, and cannot be declined ──
  await scenario("after a sale", async () => {
    for (const [label, cfg, act, line, ms] of [
      ["a purchase", { store: STORES.monthlyFree }, "#iapBuy", "Sona Premium is on. Welcome to Sona!", 1200],
      ["a restore", { store: STORES.monthlyFree, restore: "finds" }, "#iapRestore", "Restored ✓ — welcome back!", 1000],
      ["an Apple ID that already has Premium", { entitled: true }, "", "You already have Sona Premium. Welcome back!", 1000],
    ]) {
      const from = hits.length;
      await load(...at(SETUP, cfg), { width: 375, height: 667 });
      if (act) { await priced(); await calm(page); await page.locator(act).click(); }
      await until("done");
      // all in one breath, before the hop: what is on screen, then a forced tap on the hidden "Not now"
      const v = await page.evaluate(() => {
        // a real box, or nothing: a link inside a row that is display:none has no box of its own
        const box = (id) => { const el = document.getElementById(id), r = el.getBoundingClientRect(), cs = getComputedStyle(el); return cs.display === "none" || cs.visibility === "hidden" || !r.width || !r.height ? null : { top: r.top, bottom: r.bottom, h: r.height }; };
        const msg = document.getElementById("iapMsg"), m = box("iapMsg");
        const out = { line: msg.innerText.trim(), inView: !!m && m.h > 0 && m.top >= 0 && m.bottom <= innerHeight, size: parseFloat(getComputedStyle(msg).fontSize),
          decline: box("declineLink"), declineRow: box("declineRow"), restore: box("iapRestore"), buy: box("iapBuy"), tile: box("iapPlan"), rows: box("iapTL"),
          card: document.getElementById("iapCard").innerText };
        document.getElementById("declineLink").click();
        out.path = location.pathname + location.search; out.marker = sessionStorage.getItem("sona.setupafter.v1");
        return out;
      });
      ok("after " + label + ": the card says \"" + line + "\", in large words, on the screen without scrolling", v.line === line && v.inView && v.size >= 18, [v.line, v.inView, v.size]);
      ok("after " + label + ": the price, the rows, the button, \"Not now\" and Restore have left the screen",
        !v.decline && !v.declineRow && !v.restore && !v.buy && !v.tile && !v.rows && !/\$|\bfree\b/i.test(v.card), v);
      ok("after " + label + ": a tap already on its way to \"Not now\" changes nothing: still here, marker kept", v.path === "/subscribe.html?setup=1" && !!v.marker, [v.path, v.marker]);
      await tick(ms + 100); await page.waitForURL(/\/onboarding\.html$/);
      ok("after " + label + ": then back to setup, the marker still set on arrival, and no \"offer dismissed\" was sent",
        await page.evaluate(() => !!sessionStorage.getItem("sona.setupafter.v1")) && (await dismissals(from)).length === 0);
    }
  });

  // ── 11. a paying family is never sold a second plan ──
  await scenario("already subscribed", async () => {
    await load(...at(DOORS[1], { entitled: true })); await until("done");
    let s = await snap();
    ok("this Apple ID already has Premium, from a grey game: \"You already have Sona Premium. Welcome back!\", no price, nothing bought, nothing counted as a sale or an offer",
      s.msg === "You already have Sona Premium. Welcome back!" && !s.price && !s.button && s.bought.length === 0 && viewed(s) === 0 && !s.spent && !s.events.some((e) => e[0] === "purchase completed") && same(told(s), ["owned"]), [s.msg, s.price, told(s)]);
    ok("…and the subscription is remembered, from Apple", s.sub.active === true && s.sub.source === "apple", s.sub);
    await tick(1100); await page.waitForURL(/\/today\.html$/);
    ok("…then Home", /\/today\.html$/.test(page.url()), page.url());

    await load(...at(DOORS[4], { entitled: true }));
    await page.waitForFunction(() => /Active/.test(document.getElementById("planLine").textContent));
    s = await snap();
    ok("the same in Settings › Your plan: \"Your plan: Active ✓\", how to cancel, and no card", /^Your plan: Active ✓ — thank you for backing Sona\.$/.test(s.line) && s.cancel && !s.shown && s.path === "/subscribe.html", [s.line, s.cancel, s.shown]);

    // a reinstall: the customer record says no, and only the one purchase sync finds them
    for (const door of [DOORS[1], SETUP, DOORS[4]]) {
      await load(...at(door, { sync: "finds" }));
      if (door === DOORS[4]) await page.waitForFunction(() => /Active/.test(document.getElementById("planLine").textContent)); else await until("done");
      s = await snap();
      ok("a paying family who reinstalled, from " + door[0] + ": found by one purchase sync, told \"You already have Sona Premium\", never left with a price",
        (door === DOORS[4] ? /Active ✓/.test(s.line) && !s.shown : s.msg === "You already have Sona Premium. Welcome back!") && s.syncs === 1 && s.bought.length === 0 && !s.price && !s.button && viewed(s) === 0, [s.msg, s.line, s.syncs, s.bought]);
      if (door !== DOORS[4]) { await tick(1100); await page.waitForURL(door === SETUP ? /\/onboarding\.html$/ : /\/today\.html$/); }
    }
    // Apple calls them "not eligible" (they subscribed before) and the sync is slow: no pay-today price meanwhile
    await load(...at(DOORS[1], { sync: "finds", elig: { monthly: 1 }, wait: { sync: 2000 } }));
    await tick(1300);
    s = await snap();
    const mid = [s.state, s.button];
    await tick(600);
    s = await snap();
    ok("a buyer Apple calls not eligible, while the sync is still out: the button keeps saying \"Checking the App Store…\", never \"Subscribe\"",
      mid[0] === "wait" && mid[1] === "Checking the App Store…" && s.state === "wait" && s.button === "Checking the App Store…", [mid, s.state, s.button]);
    await tick(300); await until("done");
    s = await snap();
    ok("…and when the sync answers: \"You already have Sona Premium\", with nothing bought", s.msg === "You already have Sona Premium. Welcome back!" && s.bought.length === 0, [s.msg, s.bought]);
    await tick(1100); await page.waitForURL(/\/today\.html$/);

    // ownership learned late, with a price already painted: it repaints by itself
    await load(...at(DOORS[1], { sync: "finds", wait: { sync: 5000 } }));
    await tick(1300); await until("free");
    await tick(3800); await until("done");
    s = await snap();
    ok("the sync answers after the price was painted: the card switches by itself to the welcome-back line", s.msg === "You already have Sona Premium. Welcome back!" && s.bought.length === 0 && s.syncs === 1, [s.msg, s.syncs]);
    await tick(1100); await page.waitForURL(/\/today\.html$/);

    // …and a buy tap that lands before the page was told: the tap checks the store's latest answer first
    await load(...at(DOORS[1], { store: STORES.monthlyFree })); await until("free");
    await page.evaluate(() => { window.__phone.set({ entitled: true, wait: { info: 800 } }); document.dispatchEvent(new Event("visibilitychange")); });
    await calm(page); await page.locator("#iapBuy").click();
    await tick(900); await until("done");
    s = await snap();
    ok("a buy tap while a fresh answer (\"already has it\") is on its way: no purchase, the welcome-back line, the same way on",
      s.bought.length === 0 && s.msg === "You already have Sona Premium. Welcome back!" && !s.events.some((e) => e[0] === "purchase completed"), [s.bought, s.msg]);
    await tick(1100); await page.waitForURL(/\/today\.html$/);
  });

  // ── 12. the hand-off from setup ──
  await scenario("the setup hand-off", async () => {
    await load(...at(SETUP, { store: STORES.monthlyFree })); await until("free");
    let s = await snap();
    ok("from setup the header is not on the screen, and the page is the offer", !s.header && !s.tabs && s.offer, [s.header, s.tabs, s.offer]);
    ok("…its headline is \"Mia's practice is ready\", the line under it \"Sona Premium opens it.\", and there is no pill", s.offerTitle === "Mia's practice is ready" && s.offerSub === "Sona Premium opens it." && !s.pill, [s.offerTitle, s.offerSub, s.pill]);
    ok("…\"Not now\" says just that, and nothing says anything stays free", s.decline === "Not now" && !s.freeCard && !/stays? free|free games|free version/i.test(s.body), s.decline);
    await load(...at(DOORS[1], { store: STORES.monthlyFree })); await until("free");
    s = await snap();
    ok("from a grey game the header is there, and the headline is the game's", s.header && s.offerTitle === "Unlock Fruit Slice, and every other game" && /^Games for /.test(s.offerSub) && /Mia wants to play Fruit Slice/.test(s.pill), [s.header, s.offerTitle, s.offerSub, s.pill]);
    // a family who tapped "Not sure? Explore all sounds", and one with no name
    await load(...at(SETUP, { store: STORES.monthlyFree, local: { "sona.profile.v1": { childName: "Mia", childAge: "7", focusSounds: [], mode: "play", pathReason: "unsure", onboarded: true, voiceOn: false, soundOn: false } } })); await until("free");
    s = await snap();
    ok("the headline is the same for a family exploring every sound, and it names no sound", s.offerTitle === "Mia's practice is ready" && !/\bsound/i.test(s.offerTitle + s.offerSub), [s.offerTitle, s.offerSub]);
    await load(...at(SETUP, { store: STORES.monthlyFree, local: { "sona.profile.v1": { childName: "", childAge: "7", focusSounds: ["R"], onboarded: true, voiceOn: false, soundOn: false } } })); await until("free");
    ok("…and with no name it is \"Practice is ready\"", (await snap()).offerTitle === "Practice is ready");
    // a family with the free version, sent here by setup (the website selling is the only way; in the app it reads the same)
    await load(...at(SETUP, Object.assign({}, KEPT, { store: STORES.monthlyFree }))); await until("free");
    s = await snap();
    ok("a family that keeps the free version reads the line about the games there, not \"Sona Premium opens it.\"", /^More games for /.test(s.offerSub) && s.what === "Every game and every book.", [s.offerSub, s.what]);

    // where a buyer goes next
    for (const [label, cfg, act, want] of [
      ["a purchase, with setup's marker", { marker: true }, "#iapBuy", /\/onboarding\.html$/],
      ["a restore, with setup's marker", { marker: true, restore: "finds" }, "#iapRestore", /\/onboarding\.html$/],
      ["a purchase, with no marker", { marker: false }, "#iapBuy", /\/today\.html$/],
      ["a restore, with no marker", { marker: false, restore: "finds" }, "#iapRestore", /\/today\.html$/],
      ["a purchase, with no marker but the old setup page's first-game mark", { marker: false, firstgame: "slice" }, "#iapBuy", /\/charge\.html\?game=arcade-slice\.html$/],
    ]) {
      await load(...at(SETUP, Object.assign({ store: STORES.monthlyFree }, cfg))); await until("free"); await calm(page);
      await page.locator(act).click(); await until("done");
      await tick(1300); await page.waitForURL(want);
      ok(label + ": lands on " + new URL(page.url()).pathname + new URL(page.url()).search, want.test(page.url()), page.url());
    }
    // a setup visit by a family that already has Premium is sent on at once
    for (const [label, cfg, want] of [
      ["with the marker (a reload between the purchase and the hop)", { marker: true, local: { "sona.sub.v1": { active: true, source: "apple", since: 1 } } }, /\/onboarding\.html$/],
      ["with no marker", { marker: false, founder: true }, /\/today\.html$/],
      ["with no marker but the old page's first-game mark", { marker: false, firstgame: "slice", founder: true }, /\/charge\.html\?game=arcade-slice\.html$/],
    ]) {
      await load(...at(SETUP, Object.assign({ store: STORES.monthlyFree }, cfg)));
      await page.waitForURL(want);
      ok("a ?setup=1 visit with Premium, " + label + ": forwarded to " + new URL(page.url()).pathname + ", never left on \"Your plan: Active\"", want.test(page.url()), page.url());
    }
    // "Not now"
    const from = hits.length;
    await load(...at(SETUP, { store: STORES.monthlyFree })); await until("free"); await calm(page);
    await page.locator("#declineLink").click(); await page.waitForURL(/\/today\.html$/);
    const gone = await dismissals(from);
    ok("\"Not now\" from setup: Home, the marker cleared, and one \"offer dismissed\" for the setup offer (a price was really shown)",
      await page.evaluate(() => sessionStorage.getItem("sona.setupafter.v1") === null) && gone.length === 1 && /"surface":"setup"/.test(gone[0]), gone);
  });

  // ── 13. order and furniture ──
  await scenario("order and furniture", async () => {
    for (const door of DOORS.slice(0, 4)) {
      await load(...at(door, { store: STORES.monthlyFree })); await until("free");
      const s = await snap();
      ok(door[0] + ": under the card comes \"Not now\", and under that Restore Purchases · Terms of Use · Privacy, all painted",
        s.afterCard === "declineRow" && s.afterDecline === "iapLegal" && s.restoreSeen && /Restore Purchases/.test(s.legal) && /Terms of Use/.test(s.legal) && /Privacy/.test(s.legal), [s.afterCard, s.afterDecline, s.legal]);
    }
    await load(...at(DOORS[4], { store: STORES.monthlyFree })); await until("free");
    const s = await snap(), inCard = await page.evaluate(() => document.getElementById("iapLegal").parentNode.id);
    ok("Settings › Your plan: no \"Not now\", the Restore row stays in the card, with the title, the header and the tabs", !s.declineSeen && inCard === "iapCard" && s.restoreSeen && s.titleSeen && s.header && s.tabs && !s.offer, [s.declineSeen, inCard, s.titleSeen]);
    const a11y = await page.evaluate(() => { const g = (id) => document.getElementById(id); return { msg: g("iapMsg").getAttribute("role"), live: g("iapMsg").getAttribute("aria-live"), none: g("iapNone").getAttribute("role"),
      by: g("iapBuy").getAttribute("aria-describedby"), tl: g("iapTL").tagName, label: g("iapTL").getAttribute("aria-label"), dots: [...g("iapTL").querySelectorAll(".tld")].every((d) => d.getAttribute("aria-hidden") === "true"), type: g("iapBuy").type }; });
    ok("for a screen reader: the status line and the \"couldn't reach\" box are role=status, the button is described by the note, the rows are an ordered list with a name, the dots are hidden from it",
      a11y.msg === "status" && a11y.live === "polite" && a11y.none === "status" && a11y.by === "iapNote" && a11y.tl === "OL" && a11y.label === "What happens when" && a11y.dots && a11y.type === "button", a11y);
  });

  // ── 14. colours: teal and cream, never orange or green ──
  await scenario("colours", async () => {
    await load(...at(SETUP, { store: STORES.monthlyFree })); await until("free");
    const c = await page.evaluate(() => {
      const paint = (el) => { const cs = getComputedStyle(el); return [cs.backgroundImage, cs.backgroundColor, cs.borderTopColor, cs.boxShadow].join(" "); };
      const tl = document.getElementById("iapTL");
      return { today: paint(tl.querySelector(".tli.now .tld")), bill: paint(tl.querySelector(".tli.bill .tld")), tile: paint(document.getElementById("iapPlan")), tag: paint(document.getElementById("iapTag")), rail: getComputedStyle(tl.querySelector(".tli.now"), "::after").backgroundImage };
    });
    // loadtest's own green list, as the browser reports a colour
    const GREEN = ["58cc02", "46a302", "6edd18", "6fd60e", "5fd216", "3c8c02", "7ee23a"].map((h) => "rgb(" + [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(", ") + ")");
    const green = (css) => GREEN.some((g) => css.indexOf(g) > -1);
    for (const [what, css] of Object.entries(c)) ok("the " + what + " is painted in no orange and no green", !isOrange(css) && !green(css), css);
    ok("…and the \"today\" dot is teal, with the billing day's dot a teal ring", isTeal(c.today) && isTeal(c.bill), [c.today, c.bill]);
  });

  // ── 15. the fit: six sizes × three priced shapes × two price strings × four doors ──
  {
    const SIZES = [[320, 568, 20, 0], [375, 667, 20, 0], [393, 852, 59, 34], [768, 1024, 20, 0], [1024, 768, 20, 0], [320, 768, 20, 0]];
    const SHAPES = (price) => [
      ["free days, sure", { store: { monthly: { price, free: "P3D" } } }, "free"],
      ["free days, not sure", { store: { monthly: { price, free: "P3D" } }, elig: "missing" }, "free"],
      ["charged today", { store: { monthly: { price } } }, "paid"],
    ];
    const MEASURE = (sb) => {
      const g = (id) => document.getElementById(id);
      const box = (el) => { if (!el) return null; const cs = getComputedStyle(el), r = el.getBoundingClientRect(); if (cs.display === "none" || cs.visibility === "hidden" || !r.width || !r.height) return null; return { top: r.top + scrollY, bottom: r.bottom + scrollY, width: r.width }; };
      const card = g("iapCard"), cs = getComputedStyle(card), size = (id) => parseFloat(getComputedStyle(g(id)).fontSize), guard = g("sonaPortraitGuard");
      return { fold: innerHeight - sb, scrollY, overX: document.documentElement.scrollWidth - innerWidth, fit: document.body.className.split(/\s+/).filter((c) => /^fit\d$/.test(c)).join(" "),
        inner: card.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth),
        head: box(g("offerTitle")), tile: box(g("iapPlan")), what: box(g("iapWhat")), note: box(g("iapNote")), tl: box(g("iapTL")), buy: box(g("iapBuy")), decline: box(g("declineLink")),
        fonts: { price: size("iapPrice"), buy: size("iapBuy"), tag: size("iapTag") }, guard: guard ? getComputedStyle(guard).display : "none" };
    };
    const results = await Promise.all(SIZES.map(async ([w, h, st, sb]) => {
      const { context, page: pg, errors: errs } = await open(browser, base, { app: "buy", safeArea: { top: st, bottom: sb } }, { width: w, height: h });
      const out = [];
      try {
        await pg.clock.install({ time: new Date(NOON) });
        await pg.goto(base + "/__blank.html");
        for (const door of DOORS.slice(0, 4)) for (const price of ["$9.99", "US$1,299.00"]) for (const [shape, storeCfg, want] of SHAPES(price)) {
          await pg.evaluate((c) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("__phoneCfg", JSON.stringify(c)); }, Object.assign({}, door[2], storeCfg));
          await pg.goto(base + door[1]);
          await until(want, pg);
          // the fonts, and one frame for the page's own last fit
          await pg.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => r()))));
          out.push({ door: door[0], price, shape, m: await pg.evaluate(MEASURE, sb) });
        }
      } catch (e) { out.push({ harness: String(e && e.stack || e) }); }
      await context.close();
      return { w, h, out, errs };
    }));
    for (const { w, h, out, errs } of results) {
      const size = w + "×" + h, small = w === 320 && h === 568;
      ok(size + ": the fit was measured in every shape, with no page errors", out.length === 24 && !out.some((o) => o.harness) && errs.length === 0, [out.filter((o) => o.harness), errs]);
      for (const door of DOORS.slice(0, 4)) {
        const mine = out.filter((o) => o.door === door[0]), whole = !small || door === SETUP, bad = [];
        for (const { price, shape, m } of mine) {
          const say = (what) => bad.push(shape + ", " + price + ": " + what + " " + JSON.stringify({ fit: m.fit, fold: m.fold, buy: m.buy, decline: m.decline }));
          if (!m.buy || !m.tile || !m.head || !m.decline) { say("something is not painted"); continue; }
          if (m.scrollY !== 0 || m.head.top < 0 || m.tile.top < 0) say("the top is cut off");
          if (m.buy.bottom > m.fold) say("the button ends below the first screen");
          if (whole && m.decline.bottom > m.fold) say("\"Not now\" ends below the first screen");
          if (!whole && m.decline.top > m.fold + 72) say("\"Not now\" starts more than 72 px below the first screen");
          if (m.overX > 0) say("the page scrolls sideways by " + m.overX);
          if (Math.abs(m.tile.width - m.inner) > 2) say("the tile is " + m.tile.width + " wide in a " + m.inner + " card");
          if (!m.what) say("the sentence saying what Premium opens is not painted");
          if (shape === "free days, not sure" && !(m.note && m.tl && m.note.bottom <= m.tl.top)) say("the not-sure note is not above the rows");
          if (shape !== "charged today" && !m.tl) say("the dated rows are not painted");
          if (!(m.fonts.price >= m.fonts.buy && m.fonts.price > m.fonts.tag)) say("the price is not the largest word about money " + JSON.stringify(m.fonts));
          if (m.guard !== "none") say("the rotate cover is showing");
        }
        ok(size + ", " + door[0] + ": in all three priced shapes, with $9.99 and with US$1,299.00, the button and every line above it are on the first screen" +
          (whole ? ", and \"Not now\" with them" : ", and \"Not now\" starts within 72 px of it") + "; no sideways scroll; the tile fills the card; what Premium opens is always said",
          mine.length === 6 && bad.length === 0, bad);
      }
    }
  }

  // ── 16. nothing moves under a finger (R6): real mouse clicks, no calm() ──
  await scenario("nothing moves under a finger", async () => {
    for (const [w, h] of [[320, 568], [375, 667], [393, 852]]) {
      const from = hits.length;
      await load(...at(SETUP, { store: STORES.monthlyFree, buy: "hang" }), { width: w, height: h });
      await until("free");
      await page.waitForFunction(() => !document.body.classList.contains("price-settling"));
      const b = await page.evaluate(() => { const r = document.getElementById("iapBuy").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top }; });
      await page.mouse.click(b.x, b.y);
      await page.waitForTimeout(150);
      await page.mouse.click(b.x, b.y);
      await page.waitForTimeout(250);
      const s = await snap(), top = await page.evaluate(() => document.getElementById("iapBuy").getBoundingClientRect().top);
      ok(w + "×" + h + ": a double tap on the buy button starts one purchase, and the second tap lands on the same, disabled button: it has not moved",
        s.bought.length === 1 && s.disabled && Math.abs(top - b.top) < 1, [s.bought, s.disabled, top, b.top]);
      ok(w + "×" + h + ": …still on the price screen, the marker still set, nothing dismissed", s.path === "/subscribe.html?setup=1" && !!s.marker && (await dismissals(from)).length === 0, [s.path, s.marker]);
    }
    // THE SECOND AFTER A TAP IS A WHOLE SECOND, whatever follows the tap. A
    // fast failure puts a message up and holds taps for 0.6 s of its own;
    // that shorter hold used to replace the tap's, and "Not now" and Restore
    // took a tap again about 0.6 s after the tap, on a page that had just
    // re-fitted. Both moments are read off the page's own clock, in the page.
    for (const [what, sel, cfg, line] of [
      ["the buy button, on a phone with purchases turned off", "#iapBuy", { buy: "notallowed" }, "Purchases are turned off on this device. Check Screen Time in Settings."],
      ["Restore, with the store out of reach", "#iapRestore", { restore: "fail" }, "Couldn't reach the App Store — try again in a moment."],
    ]) {
      await load(...at(SETUP, Object.assign({ store: STORES.monthlyFree }, cfg))); await until("free");
      await page.waitForFunction(() => !document.body.classList.contains("price-settling"));
      await page.evaluate((sel) => {
        const h = window.__hold = { from: 0, said: 0, to: 0 };
        document.querySelector(sel).addEventListener("click", () => { if (!h.from) h.from = Date.now(); }, true);
        new MutationObserver(() => { if (h.from && !h.said && document.getElementById("iapMsg").textContent && !/…$/.test(document.getElementById("iapMsg").textContent)) h.said = Date.now(); })
          .observe(document.getElementById("iapMsg"), { childList: true, characterData: true, subtree: true });
        new MutationObserver(() => { if (h.from && !h.to && !document.body.classList.contains("price-settling")) h.to = Date.now(); }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
      }, sel);
      await page.locator(sel).click();
      await page.waitForFunction((l) => document.getElementById("iapMsg").textContent === l, line);
      await tick(1100);
      await page.waitForFunction(() => window.__hold.to > 0);
      const h = await page.evaluate(() => window.__hold);
      ok("a tap on " + what + ": \"" + line + "\" is up well inside the second, and \"Not now\" and Restore still take no tap until a whole second after the tap (" + (h.to - h.from) + " ms)",
        h.said > 0 && h.said - h.from < 400 && h.to - h.from >= 990, h);
    }
    // The store answers while a finger is on its way to "Not now". Played in
    // the shape where it matters: on these two screens a charged-today card
    // puts the buy button exactly where "Not now" was while it was asking
    // (the scenario checks that first, so it cannot pass by aiming at nothing).
    for (const [w, h] of [[393, 852], [1024, 768]]) {
      const from = hits.length;
      await load(...at(SETUP, { store: STORES.noFree, wait: { products: 1000 } }), { width: w, height: h });
      await page.waitForFunction(() => !document.body.classList.contains("price-settling") && document.getElementById("declineLink").getBoundingClientRect().height > 0);
      const d = await page.evaluate(() => { const r = document.getElementById("declineLink").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      await priced();
      await page.mouse.click(d.x, d.y);
      const under = await page.evaluate((d) => { const r = document.getElementById("iapBuy").getBoundingClientRect(); return d.x > r.left && d.x < r.right && d.y > r.top && d.y < r.bottom; }, d);
      await page.waitForTimeout(250);
      const s = await snap();
      ok(w + "×" + h + ": the price arrives and the buy button is now where \"Not now\" was a moment before", under === true, d);
      ok(w + "×" + h + ": …a tap aimed at \"Not now\" in that moment buys nothing and leaves nothing: still here, the button untouched, marker kept",
        s.bought.length === 0 && !s.disabled && s.msg === "" && s.state === "paid" && s.path === "/subscribe.html?setup=1" && !!s.marker && (await dismissals(from)).length === 0, [s.bought, s.disabled, s.msg, s.path]);
    }
    // …and once the moment has passed, the same button works
    await page.waitForFunction(() => !document.body.classList.contains("price-settling"));
    const b = await page.evaluate(() => { const r = document.getElementById("iapBuy").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.click(b.x, b.y); await until("done");
    ok("…and about half a second later the button takes a tap as usual", same((await snap()).bought, [IDS.monthly]));
    await tick(1300); await page.waitForURL(/\/onboarding\.html$/);
  });

  // ── 17. Terms of Use, then Back ──
  await scenario("Terms, then Back", async () => {
    await load(...at(SETUP, { store: STORES.monthlyFree })); await until("free"); await calm(page);
    await page.locator('#iapLegal a[href="/terms"]').click(); await page.waitForURL(/\/terms$/);
    await page.locator("#back").click(); await page.waitForURL(/\/subscribe\.html\?setup=1$/);
    await until("free");
    const s = await snap();
    ok("Terms of Use and Back: the one price screen again at ?setup=1, the marker still set", s.path === "/subscribe.html?setup=1" && !!s.marker && s.button === "Start 3 days free" && !s.header && s.buttons === 1, [s.path, s.marker, s.button]);
    await calm(page); await page.locator("#iapBuy").click(); await until("done");
    await tick(1300); await page.waitForURL(/\/onboarding\.html$/);
    ok("…and a purchase there still goes back to setup", /\/onboarding\.html$/.test(page.url()), page.url());
  });

  // ── 18. Ask to Buy ──
  await scenario("Ask to Buy", async () => {
    const pend = async () => {
      await load(...at(SETUP, { store: STORES.monthlyFree, buy: "pending" })); await until("free"); await calm(page);
      await page.locator("#iapBuy").click();
      await page.waitForFunction(() => /Waiting for approval/.test(document.getElementById("iapMsg").textContent));
      // every state the card passes through from here on
      await page.evaluate(() => { window.__states = []; new MutationObserver(() => window.__states.push(document.getElementById("iapCard").getAttribute("data-state"))).observe(document.getElementById("iapCard"), { attributes: true, attributeFilter: ["data-state"] }); });
    };
    await pend();
    let s = await snap();
    ok("a purchase waiting for a parent's approval: \"Waiting for approval. Sona Premium opens once the purchase is approved.\", and the card stays",
      s.msg === "Waiting for approval. Sona Premium opens once the purchase is approved." && s.state === "free" && !s.disabled && !!s.marker, [s.msg, s.state]);
    await page.evaluate(() => { window.__phone.set({ entitled: true }); document.dispatchEvent(new Event("visibilitychange")); });
    await until("done");
    s = await snap();
    const states = await page.evaluate(() => window.__states);
    ok("approved, and the app comes back to the front: \"Sona Premium is on. Welcome to Sona!\", with no \"Checking…\" painted on the way",
      s.msg === "Sona Premium is on. Welcome to Sona!" && states.indexOf("wait") < 0, [s.msg, states]);
    ok("…counted as this screen's sale, once, and not bought twice", s.events.filter((e) => e[0] === "purchase completed").length === 1 && s.bought.length === 1 && s.confetti === 1, [s.events.filter((e) => e[0] === "purchase completed"), s.bought]);
    await tick(1300); await page.waitForURL(/\/onboarding\.html$/);

    await pend();
    await page.evaluate(() => window.__phone.set({ entitled: true }));
    await tick(10100); await until("done");
    s = await snap();
    ok("approved while the screen just sits there: it asks the store again within ten seconds and moves on by itself",
      s.msg === "Sona Premium is on. Welcome to Sona!" && s.events.filter((e) => e[0] === "purchase completed").length === 1, [s.msg]);
    await tick(1300); await page.waitForURL(/\/onboarding\.html$/);

    // a second tap while it waits, cancelled this time: the watch for the approval goes on
    await pend();
    await page.evaluate(() => window.__phone.set({ buy: "cancel" }));
    await calm(page); await page.locator("#iapBuy").click();
    await page.waitForFunction(() => window.__phone.bought.length === 2 && !document.getElementById("iapBuy").disabled);
    ok("…and the card goes on saying it is waiting for approval", (await snap()).msg === "Waiting for approval. Sona Premium opens once the purchase is approved.");
    await page.evaluate(() => window.__phone.set({ entitled: true }));
    await tick(10100); await until("done");
    s = await snap();
    ok("a second tap that the parent cancels does not end the watch: the approval is still noticed, and counted once",
      s.msg === "Sona Premium is on. Welcome to Sona!" && s.events.filter((e) => e[0] === "purchase completed").length === 1, [s.msg]);
    await tick(1300); await page.waitForURL(/\/onboarding\.html$/);

    // a fresh ask in flight when the button is tapped must not hop away under Apple's open sheet
    await load(...at(SETUP, { store: STORES.monthlyFree, buy: "hang" })); await until("free");
    await page.evaluate(() => { window.__phone.set({ entitled: true, wait: { info: 3000 } }); document.dispatchEvent(new Event("visibilitychange")); });
    await calm(page); await page.locator("#iapBuy").click();
    await tick(1300);
    await page.waitForFunction(() => window.__phone.bought.length === 1);
    await tick(2500);
    s = await snap();
    ok("an \"already has it\" that arrives while Apple's sheet is open does not hop away under it: still here, the purchase still open",
      s.path === "/subscribe.html?setup=1" && s.state === "free" && s.disabled && s.bought.length === 1, [s.path, s.state, s.disabled, s.bought]);
  });

  // ── the safety net: storePlan missing or broken still sells the monthly product ──
  await scenario("the safety net", async () => {
    const withSona = async (tail, fn) => {
      await page.route("**/sona.js", async (route) => { const res = await route.fetch(); await route.fulfill({ response: res, body: (await res.text()) + "\n;" + tail }); });
      try { await fn(); } finally { await page.unroute("**/sona.js"); }
    };
    for (const [label, tail, ms] of [
      ["storePlan is missing", "delete Sona.storePlan;", 0],
      ["storePlan throws", "Sona.storePlan = function () { throw new Error('boom'); };", 0],
      ["storePlan's promise rejects", "Sona.storePlan = function () { return Promise.reject(new Error('boom')); };", 0],
      ["storePlan's promise never settles", "Sona.storePlan = function () { return new Promise(function () {}); };", 8100],
    ]) await withSona(tail, async () => {
      await load(...at(SETUP, { store: STORES.monthlyFree }));
      if (ms) { ok(label + ": meanwhile the button says it is checking", (await snap()).state === "wait"); await tick(ms); }
      await until("free");
      let s = await snap();
      ok(label + ": the card still reaches the price, from the monthly product itself, with its free days for \"new subscribers\"",
        s.price === "3 days free, then $9.99 a month." && s.button === "Start 3 days free" && !s.disabled && /^Only new subscribers get 3 days free\./.test(s.note) && s.rows.every((r) => /new subscribers/i.test(r[1])) && same(s.asked, [[IDS.monthly]]), [s.price, s.button, s.note, s.asked]);
      await calm(page); await page.locator("#iapBuy").click(); await until("done");
      s = await snap();
      ok(label + ": and it buys that product, once, and says so", same(s.bought, [IDS.monthly]) && s.msg === "Sona Premium is on. Welcome to Sona!" && s.sub.active === true, [s.bought, s.msg]);
      await tick(1300); await page.waitForURL(/\/onboarding\.html$/);
    });
    await withSona("delete Sona.storePlan;", async () => {
      await load(...at(SETUP, { store: STORES.noFree })); await until("paid");
      let s = await snap();
      ok("storePlan missing, a product with no free days: \"charged today\", and not one \"free\"", s.button === "Subscribe — $9.99 a month" && !/free/i.test(s.cardText), s.cardText);
      for (const [what, cfg] of [["no monthly product", { store: STORES.yearOnly }], ["the yearly product under the monthly ask", { store: STORES.yearOnly, wrong: true }],
        ["a first period that costs money", { store: { monthly: { price: "$9.99", free: "P1M", paidIntro: true } } }]]) {
        await load(...at(SETUP, cfg)); await until("none");
        s = await snap();
        ok("storePlan missing, " + what + ": nothing is sold and no figure is shown", s.button === "Try again" && !/\$|\d|free/i.test(s.cardText) && viewed(s) === 0, s.cardText);
      }
      await load(...at(SETUP, { products: "hang" })); await tick(4100); await until("none");
      ok("storePlan missing, a store that never answers: \"We couldn't reach the App Store.\" after four seconds, not a blank card", /^We couldn't reach the App Store\./.test((await snap()).none));
    });
    // ONE READER OF A PRODUCT'S FREE TIME. storePlan reads it with sona.js's
    // planFree. When sona.js hands that reader out, the net reads through it
    // too, so the two cannot read one offer two ways. (The stand-ins below
    // answer what the page's own short copy never would for this store, so a
    // pass means the page asked sona.js.)
    await withSona("delete Sona.storePlan; Sona.planFree = function (p) { return (p && p.introPrice) ? { n: 1, unit: 'month', text: '1 month' } : 'none'; };", async () => {
      await load(...at(SETUP, { store: STORES.monthlyFree })); await until("free");
      const s = await snap();
      ok("storePlan missing, and sona.js hands out its own reader of the free time: the card says what THAT reader read, for \"new subscribers\"",
        s.tag === "1 MONTH FREE" && s.price === "1 month free, then $9.99 a month." && s.button === "Start 1 month free" && /^Only new subscribers get 1 month free\./.test(s.note) && !/\b3 days\b/i.test(s.cardText), [s.tag, s.price, s.button, s.note]);
    });
    for (const [what, answer] of [["a first period that costs money", "'paid'"], ["an offer it cannot read", "'odd'"], ["nothing it should", "undefined"], ["an error", "(function () { throw new Error('boom'); })()"]])
      await withSona("delete Sona.storePlan; Sona.planFree = function () { return " + answer + "; };", async () => {
        await load(...at(SETUP, { store: STORES.monthlyFree })); await until("none");
        const s = await snap();
        ok("storePlan missing, and that reader answers " + what + ": nothing is sold and no figure is shown", s.button === "Try again" && !s.disabled && !/\$|\d|free/i.test(s.cardText) && viewed(s) === 0 && s.bought.length === 0, s.cardText);
      });
    // a page newer than the sona.js beside it: no words to paint with
    await withSona("delete Sona.planWords; delete Sona.planSay; delete Sona.buyPlan; delete Sona.storePlan;", async () => {
      await load(...at(SETUP, { store: STORES.monthlyFree })); await until("none");
      const s = await snap();
      ok("an older sona.js with none of the plan functions: \"We couldn't reach the App Store.\" and Try again, with no figure typed by the page",
        s.none === "We couldn't reach the App Store. Check your connection, then try again." && s.button === "Try again" && s.act === "reload" && !/\$|\d|free/i.test(s.cardText) && s.asked.length === 0 && viewed(s) === 0, [s.none, s.button, s.act, s.cardText]);
    });
    await withSona("Sona.planWords = function () { throw new Error('boom'); };", async () => {
      await load(...at(SETUP, { store: STORES.monthlyFree })); await until("none");
      const s = await snap();
      ok("planWords itself throwing: the same plain card, never a blank one or a button stuck on \"Checking…\"", /^We couldn't reach the App Store\./.test(s.none) && s.button === "Try again" && !s.disabled && !/\$|\d|free/i.test(s.cardText), [s.none, s.button]);
    });
    await load(...at(SETUP, { store: STORES.monthlyFree })); await until("free");
    ok("…and with the real sona.js back, the same address sells again", (await snap()).button === "Start 3 days free");
  });

  // ── what is counted, and that nothing about the family rides along ──
  await scenario("what is counted", async () => {
    const from = hits.length, before = A.requests.length;
    await load(...at(DOORS[1], { store: STORES.monthlyFree, elig: "missing" })); await until("free");
    const s = await snap();
    const states = s.events.filter((e) => e[0] === "price state"), seen = s.events.filter((e) => e[0] === "paywall viewed");
    ok("the price card a phone showed is told once, as a fixed code with the door and the plan, and nothing else",
      states.length === 1 && same(states[0][1], { surface: "native", source: "from-game", plan: "monthly", step: "free-unsure" }), states);
    ok("…and the impression carries the door and the plan", seen.length === 1 && same(seen[0][1], { surface: "native", source: "from-game", plan: "monthly" }), seen);
    await calm(page); await page.locator("#declineLink").click(); await page.waitForURL(/\/today\.html$/);
    const gone = await dismissals(from);
    ok("…and \"Not now\" on a priced card from a grey game is one \"offer dismissed\", from-game", gone.length === 1 && /"surface":"from-game"/.test(gone[0]), gone);
    const sent = A.requests.slice(before).map((r) => r.url + " " + (r.body || "")).concat(hits.slice(from).map((h) => h.body)).join("\n");
    ok("no request from the price screen carries the child's name", !/Mia/.test(sent), (sent.match(/[^\n]*Mia[^\n]*/) || [""])[0]);
  });

  // ── 19. the website's own card is untouched ──
  {
    const { context, page: web, errors: werrs } = await open(browser, base, Object.assign({ webSells: true, marker: true }, POST), { width: 390, height: 844 });
    try {
      const from = hits.length;
      await web.goto(base + "/subscribe.html?setup=1");
      await web.waitForFunction(() => document.body.classList.contains("offer") && !document.getElementById("buyLife").disabled);
      const v = await web.evaluate(() => {
        const g = (id) => document.getElementById(id), seen = (el) => !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0;
        return { pick: seen(g("pickCard")), iap: seen(g("iapCard")), radios: [...document.querySelectorAll("#pickCard [role=radio]")].filter(seen).length, button: g("buyLife").textContent,
          header: seen(document.querySelector(".family-header")), title: g("offerTitle").textContent, spent: localStorage.getItem("sona.planmoment.v1"),
          events: window.__phone.events.map((e) => [e.name, e.props]), decline: g("declineLink").textContent, legalIn: g("iapLegal").parentNode.id };
      });
      ok("in a browser where the website sells, ?setup=1 shows the web card as it was: two radios, \"Start 3 days free\", and no Apple card",
        v.pick && !v.iap && v.radios === 2 && v.button === "Start 3 days free" && v.legalIn === "iapCard", v);
      ok("…its impression is counted as the web's, and the one ask is spent", v.events.some((e) => e[0] === "paywall viewed" && e[1].surface === "web" && e[1].source === "setup") && !!v.spent, [v.events, v.spent]);
      ok("…with setup's headline and no header there too", v.title === "Mia's practice is ready" && !v.header, [v.title, v.header]);
      await web.locator("#declineLink").click(); await web.waitForURL(/\/today\.html$/);
      const gone = await dismissals(from);
      ok("…and its \"Not now\" still logs \"offer dismissed\", and clears setup's marker", gone.length === 1 && /"surface":"setup"/.test(gone[0]) && await web.evaluate(() => sessionStorage.getItem("sona.setupafter.v1") === null), gone);
      ok("the web card: no page errors", werrs.length === 0, werrs);
    } catch (e) { ok("the web card has no harness/page exception", false, e.stack); }
    await context.close();
  }
} finally { await browser.close(); await close(); }
console.log(failures ? failures + " FAILURES / " + assertions + " assertions" : "ALL GREEN — " + assertions + " assertions");
process.exit(failures ? 1 : 0);
