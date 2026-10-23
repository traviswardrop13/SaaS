// THE PLANS THE IPHONE SELLS, AND EVERY SENTENCE ABOUT THEM (5 Oct 2026).
//
// Travis, 5 Oct 2026: "get rid of the annual option and update the copy so
// that it says three days free, then $9.99 a month". The app sold the monthly
// product alone; since 19 Oct 2026 ("go, yes to 1 2 3") the yearly one can be
// a second row beside it, ONLY when RevenueCat's current offering lists it
// and the store returns it (scenario 2b; anything else is the monthly row
// alone, exactly as before), and since 22 Oct 2026 the one payment (a
// non-consumable, "lifetime" to the store and never to a parent) a third row
// by the same rule (scenario 2c). Since 23 Oct 2026 the yearly row is not
// sold (IAP_SELL_YEARLY; Travis: "get rid of the yearly option"): the store
// is never asked for it, and its rules are played on a sona.js served with
// the switch on. Two functions in sona.js own everything a
// price screen may say about any of them:
//   Sona.storePlan()  turns the store's answers (the product, whether THIS
//                     buyer may still have the free days, whether this Apple
//                     ID already has Premium) into one of four states;
//   Sona.planWords()  holds every sentence Apple's card may show for a state.
// This suite plays both against a fake App Store (tests/_phone.mjs), with
// sona.js alone on a blank page, so no page's markup can hide a wrong answer:
//   - every store answer × every eligibility answer gives the stated plan,
//     and a store with no monthly product (or the yearly one answering in its
//     place) sells NOTHING and shows no figure;
//   - the time limits, on a paused clock;
//   - late answers repaint (onLate), and a paying family found by the one
//     purchase sync is never sold a second plan;
//   - the honesty of every sentence: no "free" on a pay-today plan, no figure
//     that is not the store's, no plain "nothing to pay today" when the phone
//     is not sure, and no promise of a message before the charge (since 16
//     Oct 2026 Sona sends one, "Your free days end soon", but only to a
//     parent who gave the app an email, so the card still promises none)
//     except the one heads-up line, on a free row, when the page says this
//     phone will show it (22 Oct 2026);
//   - the parent's email handed to RevenueCat (RCHOOK1), and nothing else;
//   - buyPlan's one purchase call and its error codes, on a plain bridge and
//     on one that answers every unknown method name;
//   - setup's helpers that live beside them: setupWall, the tab-only marker,
//     and the two answers that never leave the phone;
//   - Meta's pixel told not to read button taps on the page that asks.
import { readFileSync, existsSync, readdirSync } from "fs";
import vm from "vm";
import { chromium, ROOT, launchOpts } from "./_env.mjs";
import { phone, serve, open, STORES, IDS, ZONE, NOON, isOrange, isTeal } from "./_phone.mjs";

const APP = ROOT + "/..";
const { base, close, hits } = await serve();
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(detail))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, e.stack); } }
const flat = (s) => String(s).replace(/\u00a0/g, " ");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ONE fake phone for the whole suite, loaded fresh for each case: its storage
// is emptied and the case's config is left where the init script reads it.
// The clock is paused at local noon on Monday 5 October 2026 and moves only
// when a case says so, so "at 4,000 ms and not before 3,900" is exact.
const BLANK = base + "/__blank.html";
const PH = await open(browser, base, { app: "buy" });
const { context, page, errors, requests } = PH;
// The yearly row stopped selling on 23 Oct 2026 (IAP_SELL_YEARLY in sona.js;
// Travis: "get rid of the yearly option. I just want two payment options").
// Its code stays for the day it comes back, so the checks of its rules run on
// a sona.js served with the switch on: YEARLY_ON while they run, or
// cfg.sellYearly for one load.
let YEARLY_ON = false;
await page.clock.install({ time: new Date(NOON) });
await page.clock.pauseAt(new Date(NOON));
await page.goto(BLANK);
async function load(cfg = {}, path = "/__blank.html") {
  PH.sellYearly(YEARLY_ON || !!cfg.sellYearly);
  await page.evaluate((c) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("__phoneCfg", JSON.stringify(c)); }, cfg);
  await page.goto(base + path);
}
const again = (path = "/__blank.html") => page.goto(base + path);           // the next page in the same tab: storage kept
const tick = (ms) => page.clock.runFor(ms);
// start an ask; what it resolved with (null while it has not); every onLate so far
const ask = (opts = {}) => page.evaluate((o) => {
  window.__late = window.__late || [];
  window.__cb = window.__cb || ((p) => { window.__late.push(p); });
  window.__plan = null;
  Sona.storePlan({ fresh: !!o.fresh, onLate: window.__cb }).then((p) => { window.__plan = p; });
}, opts);
const got = () => page.evaluate(() => window.__plan);
const late = () => page.evaluate(() => window.__late || []);
const rec = () => page.evaluate(() => ({ asked: __phone.asked, types: __phone.types, bought: __phone.bought, eligAsked: __phone.eligAsked, eligIds: __phone.eligIds, syncs: __phone.syncs, restores: __phone.restores, infos: __phone.infos, unknown: __phone.unknown, offerings: __phone.offerings }));
const sub = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("sona.sub.v1") || "null"); } catch (e) { return null; } });
async function planFor(cfg, ms = 0) { await load(cfg); await ask(); if (ms) await tick(ms); return got(); }
const brief = (p) => p && { state: p.state, kind: p.kind, sure: p.sure, why: p.why, price: p.price, id: p.id, per: p.per, free: p.free && p.free.text };

try {
  // ── 1. the rule table: every store answer × every eligibility answer ──
  await scenario("the rule table", async () => {
    const ELIG = [
      ["the store's own default", {}, "yes"],
      ["eligible (2)", { elig: { monthly: 2 } }, "yes"],
      ["eligible, by name", { elig: { monthly: 2 }, eligNames: true }, "yes"],
      ["ineligible (1)", { elig: { monthly: 1 } }, "no"],
      ["ineligible, by name", { elig: { monthly: 1 }, eligNames: true }, "no"],
      ["no offer on the product (3)", { elig: { monthly: 3 } }, "no"],
      ["no offer, by name", { elig: { monthly: 3 }, eligNames: true }, "no"],
      ["unknown (0)", { elig: { monthly: 0 } }, "unknown"],
      ["unknown, by name", { elig: { monthly: 0 }, eligNames: true }, "unknown"],
      // the same answers bare, not wrapped in { status }: which shape a real
      // phone sends is not known yet, and it decides "nothing to pay today"
      ["ineligible, a bare number", { elig: { monthly: 1 }, eligBare: true }, "no"],
      ["ineligible, a bare name", { elig: { monthly: 1 }, eligBare: true, eligNames: true }, "no"],
      ["eligible, a bare number", { elig: { monthly: 2 }, eligBare: true }, "yes"],
      ["eligible, a bare name", { elig: { monthly: 2 }, eligBare: true, eligNames: true }, "yes"],
      ["no offer, a bare number", { elig: { monthly: 3 }, eligBare: true }, "no"],
      ["unknown, a bare number", { elig: { monthly: 0 }, eligBare: true }, "unknown"],
      ["the call is missing", { elig: "missing" }, "unknown"],
      ["the call throws", { elig: "throw" }, "unknown"],
      ["the call never answers", { elig: "hang" }, "unknown"],
    ];
    for (const bridge of [null, "proxy"]) for (const [label, e, means] of ELIG) {
      const tag = (bridge ? "a bridge that answers every name, " : "") + label;
      // S1: monthly with free days
      let p = await planFor({ bridge, store: STORES.monthlyFree, ...e }, 1200);
      const want = means === "yes" ? { state: "free", sure: true } : means === "no" ? { state: "paid", sure: false } : { state: "free", sure: false };
      ok("monthly with 3 free days, " + tag + ": " + want.state + (want.state === "free" ? (want.sure ? ", sure" : ", not sure") : ""),
        !!p && p.state === want.state && p.kind === "monthly" && p.sure === want.sure && p.price === "$9.99" && p.id === IDS.monthly && p.per === "month" && p.why === "" &&
        (want.state === "free" ? same(p.free, { n: 3, unit: "day", text: "3 days" }) : p.free === null), brief(p));
      // S3: monthly with no free time: charged today whatever the buyer is, and eligibility is not waited for
      p = await planFor({ bridge, store: STORES.noFree, ...e });
      ok("monthly with no free days, " + tag + ": charged today, at once",
        !!p && p.state === "paid" && p.kind === "monthly" && p.sure === false && p.free === null && p.price === "$9.99" && p.id === IDS.monthly && p.per === "month", brief(p));
      // no monthly product: nothing is sold, and never the yearly plan in its place
      for (const [what, store, extra] of [["only the yearly product", STORES.yearOnly, {}], ["the yearly product under the monthly ask", STORES.yearOnly, { wrong: true }], ["nothing", STORES.empty, {}]]) {
        p = await planFor({ bridge, store, ...extra, ...e }, 1200);
        ok("a store that answers with " + what + ", " + tag + ": sells nothing and shows no figure",
          !!p && p.state === "none" && p.why === "no-product" && p.kind === "" && p.id === "" && p.price === "" && p.per === "" && p.free === null && p.sure === false, brief(p));
      }
    }
  });

  // ── 2. one plan: while RevenueCat's offering does not list the yearly
  // product, it is never asked for, and never offered ──
  await scenario("one plan", async () => {
    let p = await planFor({ store: STORES.monthlyFree, elig: { monthly: 1, annual: 0 } });
    ok("a buyer Apple calls ineligible is charged today on monthly, whatever is known of yearly", !!p && p.state === "paid" && p.kind === "monthly" && p.year === null, brief(p));
    p = await planFor({ store: STORES.noFree, elig: { monthly: 3, annual: 2 } });
    ok("yearly's free days are ignored: monthly with none is charged today, never the yearly plan with free days", !!p && p.state === "paid" && p.kind === "monthly" && p.free === null && p.year === null, brief(p));
    const r = await rec();
    ok("the store is asked for the monthly product alone", r.asked.length === 1 && same(r.asked[0], [IDS.monthly]), r.asked);
    ok("…and eligibility is asked about the monthly product alone, once", r.eligAsked === 1 && same(r.eligIds[0], [IDS.monthly]), r.eligIds);
    ok("…and RevenueCat's offering was read once (it lists the monthly package alone)", r.offerings === 1, r.offerings);
    const w = await page.evaluate(() => Sona.storePlan().then((plan) => JSON.stringify(Sona.planWords(plan, {}))));
    ok("…and no sentence of that plan names a year", !/year|annual/i.test(w), w);
  });

  // ── 2b. THE YEARLY ROW (19 Oct 2026): only when RevenueCat's current
  // offering lists the yearly product AND the store returns it ──
  await scenario("the yearly row, as shipped: never asked for", async () => {
    // an offering that lists the yearly product (and one that lists all
    // three): no yearly row, and the store is never asked for it. Read from
    // the switch, never pinned to its value: switched on, this is the
    // scenario below
    const off = /\n  const IAP_SELL_YEARLY = false;/.test(readFileSync(ROOT + "/sona.js", "utf8"));
    if (!off) ok("(IAP_SELL_YEARLY is on in sona.js: the yearly row is sold, as \"the yearly row\" plays)", true);
    else for (const offering of ["both", "all"]) {
      const p = await planFor({ store: STORES.monthlyFree, offering }), r = await rec();
      ok("as shipped, an offering that lists " + (offering === "both" ? "yearly and monthly" : "all three") + ": no yearly row, and the store is never asked for the yearly product nor about its free days",
        !!p && p.state === "free" && p.kind === "monthly" && p.year === null && (offering === "all") === !!p.life &&
        !r.asked.some((ids) => ids.indexOf(IDS.annual) > -1) && !r.eligIds.some((ids) => ids.indexOf(IDS.annual) > -1), [brief(p), r.asked, r.eligIds]);
    }
  });
  YEARLY_ON = true;
  await scenario("the yearly row", async () => {
    const yb = (p) => p && p.year ? { state: p.year.state, kind: p.year.kind, id: p.year.id, price: p.year.price, per: p.year.per, free: p.year.free && p.year.free.text, sure: p.year.sure, best: p.year.best } : null;
    let p = await planFor({ store: STORES.monthlyFree, offering: "both" });
    ok("the offering lists both: the monthly plan, carrying a yearly row from the yearly product's own answer",
      !!p && p.state === "free" && p.kind === "monthly" && p.sure === true && same(yb(p), { state: "free", kind: "annual", id: IDS.annual, price: "$59.99", per: "year", free: "3 days", sure: true, best: true }), [brief(p), yb(p)]);
    let r = await rec();
    ok("…the store was asked for monthly, then (once the offering listed it) for yearly, and eligibility for each on its own",
      same(r.asked, [[IDS.monthly], [IDS.annual]]) && same(r.eligIds, [[IDS.monthly], [IDS.annual]]) && r.offerings === 1, [r.asked, r.eligIds, r.offerings]);
    ok("…the yearly plan is frozen, keeps the store's product out of JSON, and carries no yearly row of its own",
      await page.evaluate(() => Sona.storePlan().then((plan) => { const y = plan.year; try { y.price = "$1"; } catch (e) {} return Object.isFrozen(y) && y.price === "$59.99" && !!y._p && y._p.identifier === "com.speaksona.app.annual" && Object.keys(y).indexOf("_p") === -1 && JSON.stringify(plan).indexOf("introPrice") === -1 && !("year" in y); })));
    let w = await page.evaluate(() => Sona.storePlan().then((plan) => ({ m: Sona.planWords(plan, {}), y: Sona.planWords(plan.year, {}) })));
    ok("the yearly row's words are its own: Yearly, its free trial, the store's yearly price, Best value, and its own small print",
      w.y.state === "free" && w.y.name === "Yearly" && w.y.sub === "3-day free trial" && w.y.amount === "$59.99/yr" && w.y.tag === "Best value" && w.y.button === "Start practicing!" &&
      flat(w.y.check) === "No payment today · Subscription auto-renews" && w.y.note === "3 days free, then $59.99 a year. Cancel anytime." && w.y.price === "3 days free, then $59.99 a year." && w.y.act === "buy", w.y);
    ok("…and the monthly row's are unchanged, with no tag", w.m.name === "Monthly" && w.m.amount === "$9.99/mo" && w.m.tag === "" && w.m.note === "3 days free, then $9.99 a month. Cancel anytime.", w.m);
    ok("…no sentence on either names a saving in dollars or a ratio", !/save|saving|%|half|\bx\d|×|per month|\/mo.*\/yr|119\.88|59\.89/i.test(JSON.stringify([w.m.tag, w.m.sub, w.m.check, w.m.note, w.y.tag, w.y.sub, w.y.check, w.y.note, w.y.price, w.y.button])), w.y);

    // 7 days free (Travis is setting the offer to a week in App Store Connect): the words follow the store
    p = await planFor({ store: { monthly: { price: "$9.99", free: "P1W" }, annual: { price: "$59.99", free: "P1W", unitsOnly: true } }, offering: "both" });
    w = await page.evaluate(() => Sona.storePlan().then((plan) => ({ m: Sona.planWords(plan, {}), y: Sona.planWords(plan.year, {}) })));
    ok("a week free on both products reads as 7 days on both rows, whatever shape the store sends it in",
      !!p && p.free.text === "7 days" && p.year.free.text === "7 days" && w.m.sub === "7-day free trial" && w.y.sub === "7-day free trial" && w.y.note === "7 days free, then $59.99 a year. Cancel anytime." && w.m.price === "7 days free, then $9.99 a month." && !/3.day|3 days/.test(JSON.stringify(w)), [w.m.sub, w.y.sub, w.y.note]);

    // a yearly product with no free days: charged today, its own words; and each row's eligibility is its own
    p = await planFor({ store: { monthly: { price: "$9.99", free: "P3D" }, annual: { price: "$59.99" } }, offering: "both" });
    w = await page.evaluate(() => Sona.storePlan().then((plan) => Sona.planWords(plan.year, {})));
    ok("a yearly product with no free days: the yearly row is charged today, and never says free", !!p && p.state === "free" && p.year.state === "paid" && p.year.free === null &&
      w.sub === "Charged today" && w.button === "Subscribe — $59.99 a year" && !/free/i.test(JSON.stringify(w)), [yb(p), w]);
    ok("…and no eligibility is asked for a yearly product with no offer", same((await rec()).eligIds, [[IDS.monthly]]), (await rec()).eligIds);
    p = await planFor({ store: STORES.monthlyFree, offering: "both", elig: { monthly: 2, annual: 1 } });
    ok("Apple says this buyer has used the yearly product's offer: the yearly row is charged today, the monthly row keeps its free days", !!p && p.state === "free" && p.sure === true && p.year.state === "paid", [brief(p), yb(p)]);
    p = await planFor({ store: STORES.monthlyFree, offering: "both", elig: { monthly: 2, annual: 0 } });
    ok("…eligibility unknown for yearly alone: the yearly row is free, not sure", !!p && p.sure === true && p.year.state === "free" && p.year.sure === false, yb(p));
    p = await planFor({ store: STORES.noFree, offering: "both" });
    ok("monthly charged today beside a yearly plan with free days: both rows, each its own", !!p && p.state === "paid" && p.year && p.year.state === "free" && p.year.sure === true, [brief(p), yb(p)]);

    // "Best value": only when the store's yearly price is below twelve monthly ones
    for (const [label, yp, want] of [["$59.99 a year against $9.99 a month", "$59.99", true], ["exactly twelve months ($119.88)", "$119.88", false], ["more than twelve months ($129.99)", "$129.99", false], ["$99.99 a year", "$99.99", true]]) {
      p = await planFor({ store: { monthly: { price: "$9.99", free: "P3D" }, annual: { price: yp, free: "P3D" } }, offering: "both" });
      w = await page.evaluate(() => Sona.storePlan().then((plan) => Sona.planWords(plan.year, {})));
      ok("Best value, " + label + ": " + (want ? "the tag" : "no tag"), !!p && !!p.year && p.year.best === want && w.tag === (want ? "Best value" : ""), [yb(p), w.tag]);
    }
    const rawYear = async (mExtra, yExtra) => {
      await load({ offering: "both" });
      return page.evaluate((x) => {
        const base = { monthly: { identifier: "com.speaksona.app.monthly", priceString: "$9.99", price: 9.99, currencyCode: "USD", introPrice: { price: 0, period: "P3D" } },
          annual: { identifier: "com.speaksona.app.annual", priceString: "$59.99", price: 59.99, currencyCode: "USD", introPrice: { price: 0, period: "P3D" } } };
        Object.assign(base.monthly, x.m); Object.assign(base.annual, x.y);
        Capacitor.Plugins.Purchases.getProducts = async (a) => ({ products: [a.productIdentifiers[0] === "com.speaksona.app.annual" ? base.annual : base.monthly] });
        return Sona.storePlan().then((plan) => ({ best: plan.year ? plan.year.best : null, tag: plan.year ? Sona.planWords(plan.year, {}).tag : null }));
      }, { m: mExtra, y: yExtra });
    };
    for (const [label, m, y] of [["two currencies", {}, { currencyCode: "EUR" }], ["no yearly number", {}, { price: null }], ["no monthly number", { price: "" }, {}], ["a yearly number that is not a number", {}, { price: "cheap" }]]) {
      const b = await rawYear(m, y);
      ok("no Best value with " + label, b.best === false && b.tag === "", b);
    }

    // SAFETY: anything but an offering that lists it, and a store that has it, is the monthly row alone, exactly as before
    for (const [label, cfg] of [
      ["the offering lists the monthly package alone (the fake's default)", {}],
      ["getOfferings is missing", { offering: "missing" }],
      ["getOfferings is missing on a bridge that answers every name", { offering: "missing", bridge: "proxy" }],
      ["getOfferings throws", { offering: "throw" }],
      ["getOfferings fails", { offering: "fail" }],
      ["there is no current offering", { offering: "none" }],
      ["the offering lists yearly, but the store has no yearly product", { offering: "both", store: { monthly: { price: "$9.99", free: "P3D" } } }],
      ["the offering lists yearly, and the store answers the yearly ask with the monthly product", { offering: "both", store: { monthly: { price: "$9.99", free: "P3D" } }, wrong: true }],
      ["the yearly product comes back with no identifier", { offering: "both", store: { monthly: { price: "$9.99", free: "P3D" }, annual: { price: "$59.99", free: "P3D", noId: true } } }],
      ["the yearly product has no price string", { offering: "both", store: { monthly: { price: "$9.99", free: "P3D" }, annual: { price: "$59.99", free: "P3D", noPriceString: true } } }],
      ["the yearly product's first year costs money", { offering: "both", store: { monthly: { price: "$9.99", free: "P3D" }, annual: { price: "$59.99", free: "P1M", paidIntro: true } } }],
    ]) {
      p = await planFor(Object.assign({ store: STORES.monthlyFree }, cfg));
      r = await rec();
      const quiet = !cfg.offering || cfg.offering === "missing" || cfg.offering === "throw" || cfg.offering === "fail" || cfg.offering === "none";
      ok(label + ": the monthly plan alone, as before" + (quiet ? ", and the yearly product is never asked for" : ""),
        !!p && p.state === "free" && p.kind === "monthly" && p.sure === true && p.year === null && (!quiet || (same(r.asked, [[IDS.monthly]]) && same(r.eligIds, [[IDS.monthly]]))), [brief(p), yb(p), r.asked, r.eligIds]);
    }
    p = await planFor({ store: STORES.yearOnly, offering: "both" });
    ok("no monthly product: nothing is sold, the yearly row included, even when the offering lists yearly", !!p && p.state === "none" && p.year === null, [brief(p), yb(p)]);
    p = await planFor({ store: STORES.monthlyFree, offering: "both", entitled: true });
    ok("this Apple ID already has Premium: owned, with no row at all", !!p && p.state === "owned" && p.year === null, brief(p));

    // the time limits: an offering that never answers holds the card back no longer than eligibility may
    await load({ store: STORES.monthlyFree, offering: "hang" }); await ask(); await tick(1199);
    ok("an offering that never answers: the card waits up to 1,199 ms after the product", await got() === null);
    await tick(1); p = await got();
    ok("…then the monthly row alone, at 1,200 ms", !!p && p.state === "free" && p.sure === true && p.year === null, brief(p));
    await page.evaluate(() => __phone.set({ offering: "both" })); await tick(2000);
    p = await page.evaluate(() => Sona.storePlan());
    r = await rec();
    ok("…and an offering that answers after that adds no row under a reading parent: no late call, no yearly ask", (await late()).length === 0 && p.year === null && same(r.asked, [[IDS.monthly]]), [brief(p), r.asked]);
    await ask({ fresh: true }); p = await got();
    ok("…a fresh ask (Try again, back at the front) may show it", !!p && !!p.year && p.year.state === "free", yb(p));
    await load({ store: STORES.monthlyFree, offering: "both", wait: { offering: 800 } }); await ask(); await tick(799);
    ok("an offering that answers within the limit: the card waits for it (nothing at 799 ms)", await got() === null);
    await tick(1); p = await got();
    ok("…and shows both rows at 800 ms", !!p && !!p.year && p.year.state === "free" && p.year.sure === true, yb(p));
    await load({ store: STORES.monthlyFree, offering: "both", wait: { products: 300 }, elig: { monthly: 2, annual: 2 } });
    await page.evaluate(() => { const P = Capacitor.Plugins.Purchases, real = P.checkTrialOrIntroductoryPriceEligibility; P.checkTrialOrIntroductoryPriceEligibility = (a) => a.productIdentifiers[0] === "com.speaksona.app.annual" ? new Promise((res) => setTimeout(() => res({ "com.speaksona.app.annual": { status: 1 } }), 3000)) : real(a); });
    await ask(); await tick(300 + 1200); p = await got();
    ok("the yearly row's eligibility still on its way at the limit: shown free, not sure (monthly is sure)", !!p && p.sure === true && p.year && p.year.state === "free" && p.year.sure === false, [brief(p), yb(p)]);
    await tick(2000); const l = await late();
    ok("…and when it says this buyer has used it, every onLate is told: the yearly row is now charged today", l.length === 1 && l[0].state === "free" && l[0].year && l[0].year.state === "paid", l.map(yb));

    // buying: the plan a screen hands back is the product bought
    for (const [which, want] of [["year", IDS.annual], ["month", IDS.monthly]]) {
      await load({ store: STORES.monthlyFree, offering: "both" });
      const b = await page.evaluate((k) => Sona.storePlan().then((plan) => Sona.buyPlan(k === "year" ? plan.year : plan)).then((x) => x, (e) => ({ err: e && e.code })), which);
      r = await rec();
      ok("buyPlan with the " + which + "ly row's plan buys " + want + ", once, with no second getProducts call", !!b && b.ok === true && same(r.bought, [want]) && r.asked.length === 2, [b, r.bought, r.asked]);
    }
  });

  // ── 2c. THE ONE-PAYMENT ROW (22 Oct 2026, Travis: "ok go build it all";
  // "i dont wanna say lifetime"): a non-consumable, offered only when
  // RevenueCat's current offering lists it AND the store returns it ──
  YEARLY_ON = false;
  await scenario("the one-payment row", async () => {
    const lb = (p) => p && p.life ? { state: p.life.state, kind: p.life.kind, id: p.life.id, price: p.life.price, per: p.life.per, free: p.life.free, sure: p.life.sure } : null;
    const LIFE = { state: "paid", kind: "lifetime", id: IDS.lifetime, price: "$59.99", per: "once", free: null, sure: false };
    let p = await planFor({ store: STORES.monthlyFree, offering: ["monthly", "lifetime"] });
    ok("the offering lists monthly and the one payment: the monthly plan, carrying a one-payment row from that product's own answer, charged once",
      !!p && p.state === "free" && p.kind === "monthly" && p.sure === true && p.year === null && same(lb(p), LIFE), [brief(p), lb(p)]);
    let r = await rec();
    ok("…the store was asked for monthly, then (once the offering listed it) for the one payment as a non-subscription; eligibility only for monthly; the offering read once",
      same(r.asked, [[IDS.monthly], [IDS.lifetime]]) && same(r.types, ["subs", "NON_SUBSCRIPTION"]) && same(r.eligIds, [[IDS.monthly]]) && r.offerings === 1, [r.asked, r.types, r.eligIds, r.offerings]);
    ok("…the one-payment plan is frozen, keeps the store's product out of JSON, and carries no row, tag or year of its own",
      await page.evaluate(() => Sona.storePlan().then((plan) => { const l = plan.life; try { l.price = "$1"; } catch (e) {} return Object.isFrozen(l) && l.price === "$59.99" && !!l._p && l._p.identifier === "com.speaksona.app.lifetime" && Object.keys(l).indexOf("_p") === -1 && !("year" in l) && !("life" in l) && !("best" in l) && JSON.stringify(plan).indexOf("productCategory") === -1; })));
    let w = await page.evaluate(() => Sona.storePlan().then((plan) => JSON.parse(JSON.stringify(Sona.planWords(plan.life, {})))));
    ok("its words, exactly: One payment, its one line, the store's price with no period, and for the pick a check line, the button and the small print",
      same(w, { state: "paid", title: "Get Sona Premium", tag: "", price: "One payment of $59.99.", what: "Daily practice, every game and every book.", rows: [], note: "One payment of $59.99. No subscription.", noteFirst: false, noteLast: true,
        name: "One payment", sub: "Yours to keep. No subscription.", amount: "$59.99", check: "One payment \u00b7 No subscription", button: "Get Sona Premium — $59.99", act: "buy", header: "Sona Premium: one payment of $59.99.", none: null, headsUp: "" }), w);
    const anyWay = await page.evaluate(() => Sona.storePlan().then((plan) => [{}, { headsUp: true }, { freeVersion: true }, { headsUp: true, freeVersion: true }].map((o) => JSON.stringify(Sona.planWords(plan.life, o)))));
    ok("…and never 'lifetime', 'free', 'Best value', a trial, a period or a renewal, in any field, whatever the page passes",
      anyWay.every((j) => !/lifetime|free|best value|trial|\/mo|\/yr|a month|a year|renew|subscribers/i.test(j)) && anyWay.every((j) => JSON.parse(j).headsUp === ""), anyWay);
    w = await page.evaluate(() => Sona.storePlan().then((plan) => Sona.planWords(plan, {})));
    ok("…and the monthly row beside it is word for word what it was alone", w.name === "Monthly" && w.amount === "$9.99/mo" && w.sub === "3-day free trial" && w.button === "Start practicing!" && w.tag === "", w);

    // all three, the yearly row switched back on
    YEARLY_ON = true;
    p = await planFor({ store: STORES.monthlyFree, offering: "all" });
    r = await rec();
    ok("the offering lists all three: a yearly row and a one-payment row beside monthly, each from its own product, the offering read once",
      !!p && p.state === "free" && !!p.year && p.year.kind === "annual" && p.year.state === "free" && same(lb(p), LIFE) && r.offerings === 1 &&
      same(r.asked.map((a) => a[0]).sort(), [IDS.annual, IDS.lifetime, IDS.monthly].sort()) && same(r.eligIds.map((a) => a[0]).sort(), [IDS.annual, IDS.monthly].sort()), [brief(p), lb(p), r.asked, r.eligIds]);
    // "Best value" compares twelve monthly prices; beside a one payment that
    // costs no more than the year, the tag would be a false comparison
    ok("…the one payment at the year's price: no Best value on the yearly row, and none on the one payment", await page.evaluate(() => Sona.storePlan().then((plan) => plan.year.best === false && Sona.planWords(plan.year, {}).tag === "" && Sona.planWords(plan.life, {}).tag === "")));
    p = await planFor({ store: Object.assign({}, STORES.monthlyFree, { lifetime: { price: "$149.99" } }), offering: "all" });
    ok("…a one payment dearer than the year leaves the yearly row its Best value", !!p && !!p.year && p.year.best === true && !!p.life && p.life.price === "$149.99", [brief(p), p && p.year && p.year.best]);
    p = await planFor({ store: Object.assign({}, STORES.monthlyFree, { lifetime: { price: "$39.99" } }), offering: "all" });
    ok("…and one cheaper than the year takes the tag away too", !!p && !!p.year && p.year.best === false && !!p.life, [brief(p), p && p.year && p.year.best]);
    p = await planFor({ store: STORES.monthlyFree, offering: ["monthly", "annual"] });
    ok("…while yearly and monthly alone keep Best value exactly as before", !!p && !!p.year && p.year.best === true && p.life === null, [brief(p), p && p.year && p.year.best]);
    YEARLY_ON = false;
    // the store's figure, verbatim
    p = await planFor({ store: { monthly: { price: "$9.99", free: "P3D" }, lifetime: { price: "US$1,299.00" } }, offering: ["monthly", "lifetime"] });
    w = await page.evaluate(() => Sona.storePlan().then((plan) => Sona.planWords(plan.life, {})));
    ok("the store's price string, verbatim, is every figure the one-payment row shows", !!p && p.life && p.life.price === "US$1,299.00" && w.amount === "US$1,299.00" && w.button === "Get Sona Premium — US$1,299.00" &&
      w.note === "One payment of US$1,299.00. No subscription." && w.price === "One payment of US$1,299.00." && (JSON.stringify(w).match(/(?:US)?\$[\d,.]*\d/g) || []).every((x) => x === "US$1,299.00"), w);
    // a charged-today monthly beside it: both charge today, each its own words
    p = await planFor({ store: STORES.noFree, offering: ["monthly", "lifetime"] });
    ok("monthly charged today beside the one payment: both rows, each its own", !!p && p.state === "paid" && same(lb(p), LIFE), [brief(p), lb(p)]);

    // SAFETY: anything but an offering that lists it, and a store that has it, is the card as before
    for (const [label, cfg] of [
      ["the offering lists the monthly package alone (the fake's default)", {}],
      ["the offering lists yearly and monthly only (the yearly row switched on)", { offering: "both", sellYearly: true }],
      ["getOfferings is missing", { offering: "missing" }],
      ["getOfferings is missing on a bridge that answers every name", { offering: "missing", bridge: "proxy" }],
      ["getOfferings throws", { offering: "throw" }],
      ["getOfferings fails", { offering: "fail" }],
      ["there is no current offering", { offering: "none" }],
      ["the offering lists it, but the store has no such product", { offering: ["monthly", "lifetime"], store: { monthly: { price: "$9.99", free: "P3D" } } }],
      ["the offering lists it, and the store answers its ask with the monthly product", { offering: ["monthly", "lifetime"], store: { monthly: { price: "$9.99", free: "P3D" } }, wrong: true }],
      ["the one payment comes back with no identifier", { offering: ["monthly", "lifetime"], store: { monthly: { price: "$9.99", free: "P3D" }, lifetime: { price: "$59.99", noId: true } } }],
      ["the one payment has no price string", { offering: ["monthly", "lifetime"], store: { monthly: { price: "$9.99", free: "P3D" }, lifetime: { price: "$59.99", noPriceString: true } } }],
      ["the one payment claims free days (no plan this card can describe)", { offering: ["monthly", "lifetime"], store: { monthly: { price: "$9.99", free: "P3D" }, lifetime: { price: "$59.99", free: "P3D" } } }],
    ]) {
      p = await planFor(Object.assign({ store: STORES.monthlyFree }, cfg));
      r = await rec();
      const quiet = !cfg.offering || cfg.offering === "both" || cfg.offering === "missing" || cfg.offering === "throw" || cfg.offering === "fail" || cfg.offering === "none";
      ok(label + ": no one-payment row" + (quiet ? ", and the one payment is never asked for" : ""),
        !!p && p.state === "free" && p.kind === "monthly" && p.sure === true && p.life === null && (cfg.offering === "both" ? !!p.year : p.year === null) &&
        (!quiet || !r.asked.some((a) => a.indexOf(IDS.lifetime) > -1)), [brief(p), lb(p), r.asked]);
    }
    p = await planFor({ store: STORES.yearOnly, offering: "all" });
    ok("no monthly product: nothing is sold, the one payment included, even when the offering lists it", !!p && p.state === "none" && p.life === null && p.year === null, [brief(p), lb(p)]);
    p = await planFor({ store: STORES.monthlyFree, offering: "all", entitled: true });
    ok("this Apple ID already has Premium (a one payment bought before included): owned, with no row at all", !!p && p.state === "owned" && p.life === null && p.year === null, brief(p));

    // the time limits: the one payment holds the card back no longer than the yearly row may
    const holdLife = (ms) => page.evaluate((ms) => {
      const P = Capacitor.Plugins.Purchases, real = P.getProducts;
      P.getProducts = (a) => a.productIdentifiers[0] === "com.speaksona.app.lifetime" ? (ms < 0 ? new Promise(() => {}) : new Promise((res) => setTimeout(() => res(real(a)), ms))) : real(a);
    }, ms);
    await load({ store: STORES.monthlyFree, offering: ["monthly", "lifetime"] }); await holdLife(-1); await ask(); await tick(1199);
    ok("a one-payment product that never answers: the card waits up to 1,199 ms after the monthly product", await got() === null);
    await tick(1); p = await got();
    ok("…then the monthly row alone, at 1,200 ms", !!p && p.state === "free" && p.sure === true && p.life === null, [brief(p), lb(p)]);
    await load({ store: STORES.monthlyFree, offering: ["monthly", "lifetime"] }); await holdLife(800); await ask(); await tick(799);
    ok("a one-payment product that answers within the limit: the card waits for it (nothing at 799 ms)", await got() === null);
    await tick(1); p = await got();
    ok("…and shows its row at 800 ms", !!p && same(lb(p), LIFE), lb(p));
    await load({ store: STORES.monthlyFree, offering: "hang" }); await ask(); await tick(1200);
    p = await got();
    await page.evaluate(() => __phone.set({ offering: ["monthly", "lifetime"] })); await tick(2000);
    p = await page.evaluate(() => Sona.storePlan());
    r = await rec();
    ok("an offering that answers after the limit adds no row under a reading parent: no late call, no ask for the one payment", (await late()).length === 0 && p.life === null && same(r.asked, [[IDS.monthly]]), [brief(p), r.asked]);
    await ask({ fresh: true }); p = await got();
    ok("…a fresh ask (Try again, back at the front) may show it", !!p && same(lb(p), LIFE), lb(p));

    // buying it: the non-consumable, through the one purchase call real phones use
    await load({ store: STORES.monthlyFree, offering: ["monthly", "lifetime"] });
    let b = await page.evaluate(() => Sona.storePlan().then((plan) => Sona.buyPlan(plan.life)).then((x) => x, (e) => ({ err: e && e.code })));
    r = await rec();
    ok("buyPlan with the one-payment row's plan buys the one-payment product, once, with no second getProducts call", !!b && b.ok === true && same(r.bought, [IDS.lifetime]) && r.asked.length === 2, [b, r.bought, r.asked]);
    let s = await sub();
    ok("…and once Apple's \"full\" entitlement is on, Premium is on, from Apple", !!s && s.active === true && s.source === "apple", s);
    await page.evaluate(() => { localStorage.removeItem("sona.sub.v1"); });
    const back = await page.evaluate(() => Sona.iapRestore().then((a) => a, () => "failed"));
    s = await sub();
    ok("Restore Purchases finds it again by the same entitlement (a reinstall, a new phone)", back === true && !!s && s.active === true && s.source === "apple", [back, s]);
    // an old plugin with no product API buys it by id, as the store's in-app type
    await load({ store: STORES.monthlyFree });
    const old = await page.evaluate(() => {
      const P = Capacitor.Plugins.Purchases; window.__pp = [];
      P.purchaseStoreProduct = undefined;
      P.purchaseProduct = async (a) => { window.__pp.push(JSON.parse(JSON.stringify(a))); localStorage.setItem("__ent", "1"); return { customerInfo: { entitlements: { active: { full: { identifier: "full", isActive: true } } } } }; };
      return Sona.iapPurchase("lifetime").then((x) => ({ x, pp: window.__pp }), (e) => ({ err: String(e && e.message), pp: window.__pp }));
    });
    ok("an old plugin with no product API: the one payment is bought by its id as an in-app purchase (never as a subscription)",
      !!old.x && old.x.ok === true && same(old.pp, [{ productIdentifier: IDS.lifetime, type: "inapp" }]), old);
    await load({ store: STORES.monthlyFree, offering: ["monthly", "lifetime"], buy: "owned" });
    b = await page.evaluate(() => Sona.storePlan().then((plan) => Sona.buyPlan(plan.life)).then((x) => x, (e) => ({ err: e && e.code })));
    ok("Apple's 'already purchased' for the one payment: a restore finds it, never a second sale", !!b && b.restored === true, b);
  });

  // ── 3. the time limits, on a paused clock ──
  await scenario("time limits", async () => {
    await load({ products: "hang" }); await ask(); await tick(3900);
    ok("products that never answer: still asking at 3,900 ms", await got() === null);
    await tick(100);
    let p = await got();
    ok("…and 'could not reach the store' at 4,000 ms", !!p && p.state === "none" && p.why === "timeout" && p.price === "", brief(p));

    await load({ configure: "hang" }); await ask(); await tick(3900);
    ok("a store that never finishes setting up: still asking at 3,900 ms (the clock started at the call)", await got() === null);
    await tick(100); p = await got();
    ok("…and 'could not reach the store' at 4,000 ms", !!p && p.state === "none" && p.why === "timeout", brief(p));

    p = await planFor({ products: "fail" });
    ok("products that fail (both tries): none, error, at once", !!p && p.state === "none" && p.why === "error", brief(p));
    ok("…after the one retry without the type", (await rec()).asked.length === 2);
    p = await planFor({ store: STORES.empty });
    ok("an empty store: none, no-product, at once", !!p && p.state === "none" && p.why === "no-product", brief(p));

    await load({ elig: "hang" }); await ask(); await tick(1199);
    ok("eligibility never answers: the free days wait for it, up to 1,199 ms", await got() === null);
    await tick(1); p = await got();
    ok("…then are shown as not sure, 1,200 ms after the product", !!p && p.state === "free" && p.sure === false, brief(p));

    await load({ elig: "hang", wait: { products: 500 } }); await ask(); await tick(500 + 1199);
    ok("the 1,200 ms run from the product's arrival, not from the call", await got() === null);
    await tick(1); p = await got();
    ok("…free, not sure, at 1,700 ms", !!p && p.state === "free" && p.sure === false, brief(p));

    p = await planFor({ store: STORES.noFree, elig: "hang" });
    ok("a product with no offer answers without waiting for a hung eligibility call", !!p && p.state === "paid", brief(p));

    await load({ info: "hang" }); await ask(); await tick(1199);
    ok("'already has it' never answers: held back up to 1,199 ms", await got() === null);
    await tick(1); p = await got();
    ok("…then the plan, 1,200 ms after the product", !!p && p.state === "free" && p.sure === true, brief(p));

    await load({ info: "hang", store: STORES.noFree }); await ask(); await tick(1199);
    const early = await got(); await tick(1); p = await got();
    ok("…and the same for a pay-today plan with no offer: 1,200 ms", early === null && !!p && p.state === "paid", brief(p));
    await load({ info: "hang", elig: { monthly: 3 } }); await ask(); await tick(1199);
    const early3 = await got(); await tick(1); p = await got();
    ok("…and when the store says the product has no offer for anyone (3): 1,200 ms", early3 === null && !!p && p.state === "paid", brief(p));

    // a buyer Apple calls ineligible has subscribed before and may be paying right now
    await load({ info: "hang", elig: { monthly: 1 } }); await ask(); await tick(2900);
    ok("ineligible and 'already has it' still unanswered: no pay-today price before 2,900 ms", await got() === null);
    await tick(100); p = await got();
    ok("…charged today at 3,000 ms after the product", !!p && p.state === "paid" && p.kind === "monthly", brief(p));
  });

  // ── 4. late answers count (R5) ──
  await scenario("late answers", async () => {
    await load({ elig: { monthly: 1 }, wait: { elig: 2000 } }); await ask(); await ask(); await tick(1200);
    let p = await got();
    ok("a 'not eligible' that is still on its way: free, not sure, at 1,200 ms", !!p && p.state === "free" && p.sure === false, brief(p));
    ok("…and nothing late yet", (await late()).length === 0);
    await tick(800);
    let l = await late();
    ok("…when it arrives, onLate is told once: charged today (the same function, registered twice, is called once)", l.length === 1 && l[0].state === "paid" && l[0].kind === "monthly" && l[0].free === null, l.map(brief));
    p = await page.evaluate(() => Sona.storePlan());
    ok("…and storePlan() now answers charged today", !!p && p.state === "paid", brief(p));
    ok("…with no second ask of the store", (await rec()).asked.length === 1);

    await load({ wait: { elig: 2000 } }); await ask(); await tick(1200);
    p = await got(); await tick(800); l = await late();
    ok("an 'eligible' that arrives late: not sure first, then onLate with sure", !!p && p.state === "free" && p.sure === false && l.length === 1 && l[0].state === "free" && l[0].sure === true, [brief(p), l.map(brief)]);

    await load({ wait: { products: 6000 } }); await ask(); await tick(4000);
    p = await got();
    ok("products that arrive at 6,000 ms: 'could not reach the store' at 4,000", !!p && p.state === "none" && p.why === "timeout", brief(p));
    await tick(2000); l = await late();
    ok("…then onLate with the priced plan", l.length === 1 && l[0].state === "free" && l[0].price === "$9.99" && l[0].sure === true, l.map(brief));
    p = await page.evaluate(() => Sona.storePlan());
    ok("…which is what storePlan() answers from then on", !!p && p.state === "free" && p.price === "$9.99", brief(p));
    const can = await page.evaluate(() => Sona.storePlan().then((plan) => Sona.buyPlan(plan)).then((r) => r, (e) => ({ code: e.code })));
    ok("…and that late plan can be bought", can && can.ok === true && (await rec()).bought[0] === IDS.monthly, can);

    // an ask that a fresh one replaced tells nobody anything
    await load({ elig: { monthly: 1 }, wait: { elig: 2000 } }); await ask(); await tick(1200);
    await page.evaluate(() => {
      __phone.set({ elig: { monthly: 2 }, wait: { elig: 0 } });
      window.__late2 = []; window.__plan2 = null;
      Sona.storePlan({ fresh: true, onLate: (pl) => { window.__late2.push(pl); } }).then((pl) => { window.__plan2 = pl; });
    });
    const second = await page.evaluate(() => window.__plan2);
    await tick(3000);
    const r4 = await page.evaluate(() => ({ late: window.__late, late2: window.__late2, now: null }));
    p = await page.evaluate(() => Sona.storePlan());
    ok("an ask replaced by { fresh: true } never calls onLate, and its late 'not eligible' changes nothing",
      !!second && second.state === "free" && second.sure === true && r4.late.length === 0 && r4.late2.length === 0 && p.state === "free" && p.sure === true, [brief(second), r4, brief(p)]);

    // …and whoever was still waiting on it gets the new ask's answer, not silence
    await load({ products: "hang" });
    await page.evaluate(() => {
      window.__a = null; window.__b = null;
      Sona.storePlan().then((pl) => { window.__a = pl; });
      Sona.storePlan({ fresh: true }).then((pl) => { window.__b = pl; });
      __phone.set({ products: "ok" });
    });
    const both = await page.evaluate(() => ({ a: window.__a, b: window.__b }));
    ok("a caller still waiting on a replaced ask is answered by the one that replaced it", !!both.a && !!both.b && both.a.state === "free" && same(both.a, both.b), both);
  });

  // ── 5. "already has it" wins, and a paying family is found by the one sync ──
  await scenario("owned", async () => {
    let p = await planFor({ entitled: true });
    ok("an Apple ID that already has Premium: owned, with no figure to sell", !!p && p.state === "owned" && p.kind === "" && p.price === "" && p.free === null && p.sure === false, brief(p));
    let s = await sub();
    ok("…and the subscription is written down, from Apple", !!s && s.active === true && s.source === "apple", s);
    ok("…with no purchase sync needed", (await rec()).syncs === 0);

    p = await planFor({ sync: "finds", elig: { monthly: 1 } });
    let r = await rec();
    ok("a reinstalled subscriber (the record says no, the sync finds the purchase): owned, never a pay-today price", !!p && p.state === "owned", brief(p));
    ok("…found by ONE purchase sync, and nothing was bought", r.syncs === 1 && r.bought.length === 0, r);
    ok("…and the finished sync is remembered for this app launch", await page.evaluate(() => sessionStorage.getItem("sona.iapsync.v1")) === "1");
    await again(); await ask();
    r = await rec();
    ok("a second page in the same launch sends no second sync", r.syncs === 1 && (await got()).state === "owned", r);
    // …which the record alone would also give (it now says yes). The flag is
    // what stops a sync that found NOTHING from being sent on every page:
    await load({}); await ask();
    r = await rec();
    ok("a sync that finds nothing is still a finished one: sent once, the record read before it and after it, and remembered",
      r.syncs === 1 && r.infos === 2 && (await got()).state === "free" && await page.evaluate(() => sessionStorage.getItem("sona.iapsync.v1")) === "1", r);
    await again(); await ask();
    r = await rec();
    ok("…so the next page of the same launch does not send it again: the record is read once, and the plan is the same",
      r.syncs === 1 && r.infos === 1 && r.bought.length === 0 && (await got()).state === "free" && (await got()).sure === true, r);
    await again(); await page.evaluate(() => { window.__wall = null; Sona.setupWall().then((v) => { window.__wall = { v }; }); });
    r = await rec();
    ok("…and nor does setup's own ask on a later page (it is the same ask)", r.syncs === 1 && r.infos === 1 && same(await page.evaluate(() => window.__wall), { v: true }), r);

    await load({ sync: "finds", wait: { sync: 5000 } }); await ask(); await tick(1200);
    p = await got();
    ok("a sync that takes 5 s: the free plan is shown first", !!p && p.state === "free", brief(p));
    await tick(3800);
    let l = await late();
    ok("…and the moment it finds the purchase, onLate says owned", l.length === 1 && l[0].state === "owned", l.map(brief));
    ok("…which is what storePlan() answers from then on", (await page.evaluate(() => Sona.storePlan())).state === "owned");

    await load({ sync: "finds", wait: { sync: 5000 } }); await ask(); await tick(1000);
    ok("a sync cut off by leaving the page is not remembered as done", await page.evaluate(() => sessionStorage.getItem("sona.iapsync.v1")) === null);
    await again(); await ask(); await tick(1000);
    ok("…so the next page sends it again", (await rec()).syncs === 2);

    for (const mode of ["missing", "fail"]) for (const bridge of [null, "proxy"]) {
      const before = errors.length;
      p = await planFor({ sync: mode, bridge });
      ok("a purchase sync that is " + (mode === "missing" ? "missing" : "failing") + (bridge ? " (a bridge that answers every name)" : "") + ": the plan is as if the call did not exist, and nothing throws",
        !!p && p.state === "free" && p.sure === true && errors.length === before, [brief(p), errors.slice(before)]);
      ok("…and it is not remembered as done", await page.evaluate(() => sessionStorage.getItem("sona.iapsync.v1")) === null);
    }
  });

  // ── 6. free lengths, and offers that are not free ──
  await scenario("free lengths", async () => {
    for (const [iso, text, unit, n, day] of [["P3D", "3 days", "day", 3, "Thursday, October 8"], ["P1D", "1 day", "day", 1, "Tuesday, October 6"], ["P1W", "7 days", "day", 7, "Monday, October 12"], ["P2W", "14 days", "day", 14, "Monday, October 19"], ["P1M", "1 month", "month", 1, "Thursday, November 5"], ["P2M", "2 months", "month", 2, "Saturday, December 5"], ["P1Y", "1 year", "year", 1, "Tuesday, October 5"]]) {
      for (const unitsOnly of [false, true]) {
        const p = await planFor({ store: { monthly: { price: "$9.99", free: iso, unitsOnly } } });
        const w = await page.evaluate(() => Sona.storePlan().then((plan) => Sona.planWords(plan, { now: new Date(2026, 9, 5, 12) })));
        ok("an offer of " + iso + (unitsOnly ? " (units only, no ISO period)" : "") + " reads as " + text + " free, billed " + day,
          !!p && p.state === "free" && same(p.free, { n, unit, text }) && w.tag === "" && w.button === "Start practicing!" && w.rows.length === 0 && w.sub === n + "-" + unit + " free trial" && JSON.stringify(w).indexOf(day) === -1, [brief(p), w.sub, w.rows]);
      }
    }
    for (const iso of ["P45D", "P13M", "P2Y", "P0D", "three days"]) {
      const p = await planFor({ store: { monthly: { price: "$9.99", free: iso } } });
      ok("an offer whose length cannot be read (" + iso + ") is never shown as free, and never as 'charged today' either", !!p && p.state === "none" && p.why === "no-product" && p.price === "", brief(p));
    }
    // the offer as a bridge might hand it over, shape by shape (the store's own object, not the fake's flags)
    const raw = async (product) => { await load({}); return page.evaluate((extra) => { Capacitor.Plugins.Purchases.getProducts = async () => ({ products: [Object.assign({ identifier: "com.speaksona.app.monthly", priceString: "$9.99", price: 9.99 }, extra)] }); return Sona.storePlan(); }, product); };
    for (const [label, product, text] of [
      ["a count that reads as nothing beside a good ISO period", { introPrice: { price: 0, periodNumberOfUnits: 0, periodUnit: "DAY", period: "P3D" } }, "3 days"],
      ["a lower-case ISO period", { introPrice: { price: 0, period: "p1w" } }, "7 days"],
      ["a count sent as text with a lower-case unit", { introPrice: { price: 0, periodNumberOfUnits: "3", periodUnit: "day" } }, "3 days"],
      ["a zero price sent as text", { introPrice: { price: "0", period: "P3D" } }, "3 days"],
      ["the offer under its other name (introductoryPrice)", { introductoryPrice: { price: 0, period: "P3D" } }, "3 days"],
    ]) {
      const p = await raw(product);
      ok(label + " still reads as " + text + " free", !!p && p.state === "free" && !!p.free && p.free.text === text, brief(p));
    }
    for (const [label, product] of [
      ["an offer with no price at all", { introPrice: { priceString: "$0.00", period: "P3D" } }],
      ["an offer whose price is null", { introPrice: { price: null, period: "P3D" } }],
      ["an offer with a count and no unit (iaptest's old fake)", { introPrice: { price: 0, periodNumberOfUnits: 3 } }],
      ["an offer at a discount", { introPrice: { price: 0.99, priceString: "$0.99", period: "P1M" } }],
    ]) {
      const p = await raw(product);
      ok(label + " is never called free, and no first charge is stated for it", !!p && p.state === "none" && p.why === "no-product" && p.price === "", brief(p));
    }
    const PAIDINTRO = { monthly: { price: "$9.99", free: "P1M", paidIntro: true }, annual: { price: "$59.99", free: "P3D" } };
    let p = await planFor({ store: PAIDINTRO });
    ok("an offer that costs money, for a buyer who may get it: nothing is sold (the first charge cannot be stated), and never the yearly plan's free days", !!p && p.state === "none" && p.why === "no-product", brief(p));
    p = await planFor({ store: PAIDINTRO, elig: { monthly: 0 } });
    ok("…the same when eligibility is unknown", !!p && p.state === "none" && p.why === "no-product", brief(p));
    p = await planFor({ store: PAIDINTRO, elig: { monthly: 3 } });
    ok("…but the store saying the product has no offer makes it charged today", !!p && p.state === "paid" && p.kind === "monthly" && p.price === "$9.99", brief(p));
    p = await planFor({ store: PAIDINTRO, elig: { monthly: 1 } });
    ok("…and so does a definite 'not eligible'", !!p && p.state === "paid" && p.kind === "monthly", brief(p));
  });

  // ── 7. hygiene ──
  await scenario("hygiene", async () => {
    let p = await planFor({ store: { monthly: { price: "$9.99", free: "P3D", noPriceString: true } } });
    ok("a product with no price string counts as not returned", !!p && p.state === "none" && p.why === "no-product", brief(p));
    p = await planFor({ store: { monthly: { price: "$9.99", free: "P3D", id: "com.speaksona.app.lifetime" } } });
    ok("a product with another identifier is ignored", !!p && p.state === "none" && p.why === "no-product", brief(p));
    p = await planFor({ store: { monthly: { price: "$9.99", free: "P3D", noId: true } } });
    const trusted = await page.evaluate(() => Sona.storePlan().then((plan) => Sona.buyPlan(plan)).then((r) => r, (e) => ({ code: e.code })));
    ok("a lone product with no identifier at all (an old plugin's answer) is taken on trust, as iapProduct always took it: priced under the monthly id, and it can be bought",
      !!p && p.state === "free" && p.id === IDS.monthly && p.price === "$9.99" && trusted && trusted.ok === true && (await rec()).bought.length === 1, [brief(p), trusted]);
    p = await planFor({ store: { monthly: { price: "US$1,299.00", free: "P3D" } } });
    const w = await page.evaluate(() => Sona.storePlan().then((plan) => Sona.planWords(plan, {})));
    ok("the store's price string comes back verbatim, and is the figure in the words", !!p && p.price === "US$1,299.00" && w.price === "3 days free, then US$1,299.00 a month." && w.amount === "US$1,299.00/mo" && flat(w.note).indexOf("3 days free, then US$1,299.00 a month.") === 0, [brief(p), w.price, w.amount, w.note]);

    await load({}); await ask();
    const first = await got();
    const twice = await page.evaluate(() => Promise.all([Sona.storePlan(), Sona.storePlan()]).then((a) => a[0] === a[1]));
    let r = await rec();
    ok("storePlan() again is the same answer and one getProducts call, for the monthly id alone", !!first && twice && r.asked.length === 1 && same(r.asked[0], [IDS.monthly]) && r.eligAsked === 1, r);
    ok("the store's own product object rides along for the purchase, out of sight of JSON and for-in",
      await page.evaluate(() => Sona.storePlan().then((plan) => !!plan._p && plan._p.identifier === plan.id && Object.keys(plan).indexOf("_p") === -1 && JSON.stringify(plan).indexOf("introPrice") === -1)));
    // one Plan is handed to every caller of the page load: a page that wrote to it would reprice the next one's card
    const wrote = await page.evaluate(() => Sona.storePlan().then((plan) => {
      const tried = (fn) => { try { fn(); } catch (e) {} };      // a write to a frozen object throws in strict code and is dropped in the rest
      tried(() => { plan.price = "$0.01"; }); tried(() => { plan.state = "paid"; }); tried(() => { plan.sure = false; });
      tried(() => { plan.free.text = "30 days"; }); tried(() => { plan.free = null; }); tried(() => { plan._p = { identifier: "com.speaksona.app.annual" }; });
      tried(() => { delete plan.price; }); tried(() => { plan.extra = "Mia"; });
      return Sona.storePlan().then((next) => { const w = Sona.planWords(next, {}); return { same: next === plan, frozen: Object.isFrozen(next) && Object.isFrozen(next.free), next: JSON.stringify(next), id: next._p.identifier, price: w.price, button: w.button }; });
    }));
    ok("a write to a plan changes nothing: storePlan()'s next answer, and the words built from it, are still the store's",
      wrote.same && wrote.frozen && wrote.next === JSON.stringify(first) && wrote.id === IDS.monthly && wrote.price === "3 days free, then $9.99 a month." && wrote.button === "Start practicing!", wrote);

    await load({ store: STORES.empty }); await ask();
    const none1 = await got();
    const none2 = await page.evaluate(() => Sona.storePlan());
    r = await rec();
    ok("after a 'none', storePlan() answers the same 'none' with no new call", !!none1 && none1.state === "none" && same(none1, none2) && r.asked.length === 1, [none1, none2, r.asked]);
    const noneWrote = await page.evaluate(() => Sona.storePlan().then((pl) => { try { pl.state = "paid"; pl.price = "$0.01"; pl.per = "month"; } catch (e) {} return Sona.storePlan().then((n) => [n.state, n.price, Sona.planWords(n, {}).act]); }));
    ok("…and a write cannot turn that 'none' into a price", same(noneWrote, ["none", "", "retry"]), noneWrote);
    const fresh = await page.evaluate((store) => { __phone.set({ store }); return Sona.storePlan({ fresh: true }); }, STORES.monthlyFree);
    r = await rec();
    ok("{ fresh: true } asks the store again", !!fresh && fresh.state === "free" && fresh.price === "$9.99" && r.asked.length === 2, [brief(fresh), r.asked]);

    for (const cfg of [{ app: "nobuy" }, { app: null }]) {
      p = await planFor(cfg);
      ok((cfg.app ? "an app build with no purchase plugin" : "a browser") + ": none, no-plugin, at once", !!p && p.state === "none" && p.why === "no-plugin" && p.price === "", brief(p));
    }
    // a bridge whose first call throws before it returns a promise
    const before = errors.length;
    await load({});
    p = await page.evaluate(() => { Capacitor.Plugins.Purchases.configure = () => { throw new Error("bridge is broken"); }; let threw = false, pr = null; try { pr = Sona.storePlan(); } catch (e) { threw = true; } return threw ? { threw } : pr; });
    ok("a bridge that throws outright: storePlan still resolves ('could not reach the store'), and nothing is thrown", !!p && p.state === "none" && p.why === "error" && errors.length === before, [p, errors.slice(before)]);
  });

  // ── 8. the honesty table: every sentence, in every state ──
  await scenario("the honesty table", async () => {
    await load({});
    const all = await page.evaluate(() => {
      const now = new Date(2026, 9, 5, 12);
      const label = (n, unit) => {
        let d;
        if (unit === "day") d = new Date(now.getTime() + n * 86400000);
        else { d = new Date(now.getTime()); d.setMonth(d.getMonth() + (unit === "year" ? 12 : 1) * n); }
        return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      };
      const FREES = [{ n: 3, unit: "day", text: "3 days" }, { n: 7, unit: "day", text: "7 days" }, { n: 1, unit: "month", text: "1 month" }, { n: 1, unit: "year", text: "1 year" }];
      const out = [];
      [true, false].forEach((freeVersion) => {
        const o = { freeVersion, now };
        out.push({ kind: "wait", freeVersion, w: Sona.planWords(null, o) });
        out.push({ kind: "wait", freeVersion, w: Sona.planWords(undefined, o) });
        out.push({ kind: "owned", freeVersion, w: Sona.planWords({ state: "owned", kind: "", id: "", price: "", per: "", free: null, sure: false, why: "" }, o) });
        ["timeout", "error", "no-product", "no-plugin"].forEach((why) => out.push({ kind: "none", why, freeVersion, w: Sona.planWords({ state: "none", kind: "", id: "", price: "", per: "", free: null, sure: false, why }, o) }));
        ["$59.99", "US$1,299.00"].forEach((price) => out.push({ kind: "once", price, freeVersion, w: Sona.planWords({ state: "paid", kind: "lifetime", id: "x", price, per: "once", free: null, sure: false, why: "" }, o) }));
        ["$9.99", "US$1,299.00"].forEach((price) => ["month", "year"].forEach((per) => {
          out.push({ kind: "paid", price, per, freeVersion, w: Sona.planWords({ state: "paid", kind: "monthly", id: "x", price, per, free: null, sure: false, why: "" }, o) });
          FREES.forEach((free) => [true, false].forEach((sure) => out.push({ kind: "free", price, per, free, sure, freeVersion, day: label(free.n, free.unit), w: Sona.planWords({ state: "free", kind: "monthly", id: "x", price, per, free, sure, why: "" }, o) })));
        }));
      });
      return out;
    });
    const bad = (pick, test) => all.filter(pick).filter((c) => !test(c, c.w, JSON.stringify(c.w))).map((c) => ({ kind: c.kind, price: c.price, per: c.per, free: c.free && c.free.text, sure: c.sure, why: c.why, fv: c.freeVersion, w: c.w })).slice(0, 2);
    const check = (name, pick, test) => { const b = bad(pick, test); ok(name, b.length === 0 && all.filter(pick).length > 0, b); };
    const any = () => true, is = (k) => (c) => c.kind === k;
    ok("the table covers every state", all.length === 2 * (2 + 1 + 4 + 2 + 2 * 2 * (1 + 4 * 2)), all.length);
    check("the state says which card it is (the one payment is charged today)", any, (c, w) => w.state === (c.kind === "once" ? "paid" : c.kind));
    check("the one payment never says 'free', 'lifetime', 'Best value', a period or a renewal, in any field", is("once"), (c, w, j) => !/free|lifetime|best value|trial|\/mo|\/yr|a month|a year|renew/i.test(j));
    check("the one payment: its name, its line, the store's price with no period, and its pick's words", is("once"), (c, w) => w.name === "One payment" && w.sub === "Yours to keep. No subscription." && w.amount === c.price &&
      w.button === "Get Sona Premium — " + c.price && w.check === "One payment \u00b7 No subscription" && w.note === "One payment of " + c.price + ". No subscription." && w.noteLast === true && w.tag === "" && w.act === "buy" && w.rows.length === 0);
    check("a pay-today plan never says 'free', in any field", is("paid"), (c, w, j) => !/free/i.test(j));
    check("'nothing to sell' never says 'free'", is("none"), (c, w, j) => !/free/i.test(j));
    check("'nothing to sell' shows no figure: no digit, no $", is("none"), (c, w, j) => !/[\d$]/.test(j));
    check("the waiting card shows no figure: no digit, no $", is("wait"), (c, w, j) => !/[\d$]/.test(j));
    check("an Apple ID that already has it is shown nothing to buy", is("owned"), (c, w) => w.button === "" && w.act === "" && w.price === "" && w.tag === "" && w.what === "" && w.rows.length === 0 && w.note === "" && w.header === "" && w.none === null);
    check("every $ figure on a priced card is the store's own string", (c) => c.kind === "paid" || c.kind === "free" || c.kind === "once", (c, w, j) => { const f = j.match(/(?:US)?\$[\d,.]*\d/g) || []; return f.length >= 3 && f.every((x) => x === c.price); });
    check("the button buys exactly when there is a priced plan", any, (c, w) => (w.act === "buy") === (c.kind === "free" || c.kind === "paid" || c.kind === "once") && (c.kind !== "none" || w.act === "retry") && (c.kind !== "wait" || w.act === "wait"));
    check("no dated rows on any card (Travis, 6 Oct 2026: no billing day, just the free days)", any, (c, w) => w.rows.length === 0 && !/(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,/.test(JSON.stringify(w)));
    check("a priced card is one row: the plan's name, the store's price with its period, and a check line that says it renews", (c) => c.kind === "free" || c.kind === "paid", (c, w) => w.name === (c.per === "month" ? "Monthly" : c.per === "year" ? "Yearly" : "Sona Premium") && w.amount.indexOf(c.price + "/") === 0 && /Subscription auto-renews$/.test(w.check));
    check("free: the tag, the tile's line and the button are built from the store's two answers", is("free"), (c, w) => w.tag === "" && w.price === c.free.text + " free, then " + c.price + " a " + c.per + "." && w.button === "Start practicing!");
    check("free, sure: 'No payment today', and the small print under the button names the price and 'Cancel anytime.'", (c) => c.kind === "free" && c.sure, (c, w) => w.check === "No payment today \u00b7 Subscription auto-renews" && w.noteFirst === false && w.noteLast === true && w.note === c.free.text + " free, then " + c.price + " a " + c.per + ". Cancel anytime." && w.title === "Start Sona Premium with " + c.free.text + " free" && w.header === "Sona Premium: " + c.free.text + " free, then " + c.price + " a " + c.per + ".");
    check("free, NOT sure: the note comes first, the row says 'new subscribers', and nothing says 'No payment today' as fact", (c) => c.kind === "free" && !c.sure, (c, w) => w.noteFirst === true && w.noteLast === false && /for new subscribers$/.test(w.sub) && w.check === "Subscription auto-renews" && !/No payment today|Nothing to pay today/.test(JSON.stringify(w)) && /new subscribers/.test(w.title) && /new subscribers/.test(w.header));
    check("free, NOT sure: the note says who gets the free time, what Apple charges otherwise, and that Apple shows the terms", (c) => c.kind === "free" && !c.sure, (c, w) => w.note === "Only new subscribers get " + c.free.text + " free. Otherwise Apple charges " + c.price + " today. Apple shows your exact terms before you confirm. Cancel anytime in Settings\u00a0→\u00a0Subscriptions.");
    check("only the not-sure card puts its note first", (c) => !(c.kind === "free" && !c.sure), (c, w) => w.noteFirst === false);
    check("paid: the tile's line, the note and the button say it is charged today", is("paid"), (c, w) => w.price === c.price + " a " + c.per + ", charged today." && flat(w.note) === "Charged to your Apple ID today, then every " + c.per + ". Renews unless canceled in Settings → Subscriptions." && w.button === "Subscribe — " + c.price + " a " + c.per && w.title === "Get Sona Premium" && w.tag === "" && w.header === "Sona Premium: " + c.price + " a " + c.per + ", charged today.");
    check("what Premium opens is said on every card that can sell or is asking, and follows the free version", (c) => c.kind === "wait" || c.kind === "free" || c.kind === "paid" || c.kind === "once", (c, w) => w.what === (c.freeVersion ? "Every game and every book." : "Daily practice, every game and every book."));
    check("nothing says 'until', and nothing says 'a day before'", any, (c, w, j) => !/until/i.test(j) && !/a day before/i.test(j));
    check("NO MESSAGE BEFORE THE CHARGE IS PROMISED: no field of any state says email, remind or notify (the page did not say this phone will show a heads-up)", any, (c, w, j) => !/e-?mail|remind|notif/i.test(j) && w.headsUp === "");
    check("no saving, no was-price, no web offer's words", any, (c, w, j) => !/119\.88|59\.89|save \$|half|charter|founding|spots/i.test(j));
    check("plain text only: no markup in any field", any, (c, w, j) => !/[<>]|&nbsp;|&amp;/.test(j));
    check("'could not reach' and 'cannot be bought' are told apart by why", is("none"), (c, w) => w.button === "Try again" && w.title === "Sona Premium" && w.header === w.none.title &&
      ((c.why === "timeout" || c.why === "error") ? (w.none.title === "We couldn't reach the App Store." && w.none.text === "Check your connection, then try again.") : (w.none.title === "Sona Premium can't be bought right now." && w.none.text === "Please try again in a little while.")));
    check("the waiting card: its button and its header", is("wait"), (c, w) => w.button === "Checking the App Store…" && w.title === "Sona Premium" && w.none === null && w.header === (c.freeVersion ? "Sona Premium: every game and every book." : "Sona Premium: daily practice, every game and every book."));
    // THE ONE HEADS-UP LINE (22 Oct 2026): the same table, with the page
    // saying this phone will show its own heads-up the day before the free
    // days end. Only a free card gains a line, exactly Travis's words, and
    // nothing else on any card changes.
    const ahead = await page.evaluate(() => {
      const now = new Date(2026, 9, 5, 12), out = [];
      const plans = [null, { state: "owned", kind: "", id: "", price: "", per: "", free: null, sure: false, why: "" }, { state: "none", kind: "", id: "", price: "", per: "", free: null, sure: false, why: "timeout" },
        { state: "paid", kind: "monthly", id: "x", price: "$9.99", per: "month", free: null, sure: false, why: "" }, { state: "paid", kind: "lifetime", id: "x", price: "$59.99", per: "once", free: null, sure: false, why: "" },
        { state: "free", kind: "monthly", id: "x", price: "$9.99", per: "month", free: { n: 3, unit: "day", text: "3 days" }, sure: true, why: "" },
        { state: "free", kind: "monthly", id: "x", price: "$9.99", per: "month", free: { n: 7, unit: "day", text: "7 days" }, sure: false, why: "" },
        { state: "free", kind: "annual", id: "x", price: "$59.99", per: "year", free: { n: 7, unit: "day", text: "7 days" }, sure: true, why: "" }];
      plans.forEach((pl) => [true, false].forEach((fv) => {
        const off = Sona.planWords(pl, { freeVersion: fv, now }), on = Sona.planWords(pl, { freeVersion: fv, now, headsUp: true }), junk = Sona.planWords(pl, { freeVersion: fv, now, headsUp: "yes" });
        const strip = (w) => { const c = JSON.parse(JSON.stringify(w)); delete c.headsUp; return JSON.stringify(c); };
        out.push({ state: pl ? pl.state : "wait", kind: pl ? pl.kind : "", off: off.headsUp, on: on.headsUp, junk: junk.headsUp, same: strip(off) === strip(on), onText: JSON.stringify(on) });
      }));
      return out;
    });
    ok("the heads-up line: a free card shows exactly \"We'll remind you the day before it ends.\" when the page says so, and only then",
      ahead.filter((a) => a.state === "free").length === 6 && ahead.filter((a) => a.state === "free").every((a) => a.on === "We'll remind you the day before it ends." && a.off === "" && a.junk === ""), ahead);
    ok("…every other card (asking, owned, none, charged today, the one payment) never shows it, whatever the page says",
      ahead.filter((a) => a.state !== "free").every((a) => a.on === "" && a.off === "" && a.junk === "" && !/remind|notif|e-?mail/i.test(a.onText)), ahead.filter((a) => a.state !== "free"));
    ok("…and the line changes nothing else on any card", ahead.every((a) => a.same), ahead.filter((a) => !a.same));
    ok("…and on a free card it is the only place the card speaks of a heads-up", ahead.filter((a) => a.state === "free").every((a) => (a.onText.match(/remind/gi) || []).length === 1 && !/notif|e-?mail/i.test(a.onText)), ahead);
    const broken = await page.evaluate(() => [{ state: "free", price: "$9.99", per: "month", free: null }, { state: "paid", price: "", per: "month" }, { state: "paid", price: "$9.99", per: "" }, { state: "nonsense" }, {}].map((pl) => Sona.planWords(pl, {})));
    ok("a plan too broken to describe is never priced: no figure, 'Try again'", broken.every((w) => w.state === "none" && w.act === "retry" && !/[\d$]/.test(JSON.stringify(w)) && !/free/i.test(JSON.stringify(w))), broken);

    // the exact words of the two cards the App Store can give today, on Monday 5 October 2026
    const real = async (cfg) => { await load(cfg); return page.evaluate(() => Sona.storePlan().then((plan) => { const w = Sona.planWords(plan, { now: new Date(2026, 9, 5, 12) }); return JSON.parse(JSON.stringify(w).replace(/\u00a0/g, " ")); })); };
    let w = await real({ store: STORES.monthlyFree });
    ok("the App Store today, a buyer who gets the free days: the exact card", same(w, {
      state: "free", title: "Start Sona Premium with 3 days free", tag: "", price: "3 days free, then $9.99 a month.", what: "Daily practice, every game and every book.",
      rows: [], note: "3 days free, then $9.99 a month. Cancel anytime.", noteFirst: false, noteLast: true,
      name: "Monthly", sub: "3-day free trial", amount: "$9.99/mo", check: "No payment today \u00b7 Subscription auto-renews", button: "Start practicing!", act: "buy", header: "Sona Premium: 3 days free, then $9.99 a month.", none: null, headsUp: "" }), w);
    w = await real({ store: STORES.monthlyFree, elig: "missing" });
    ok("…the same store when the phone cannot tell: the exact card", same(w, {
      state: "free", title: "Sona Premium: 3 days free for new subscribers", tag: "", price: "3 days free, then $9.99 a month.", what: "Daily practice, every game and every book.",
      rows: [], note: "Only new subscribers get 3 days free. Otherwise Apple charges $9.99 today. Apple shows your exact terms before you confirm. Cancel anytime in Settings → Subscriptions.", noteFirst: true, noteLast: false,
      name: "Monthly", sub: "3-day free trial for new subscribers", amount: "$9.99/mo", check: "Subscription auto-renews",
      button: "Start practicing!", act: "buy", header: "Sona Premium: 3 days free for new subscribers, then $9.99 a month.", none: null, headsUp: "" }), w);
    for (const [label, cfg] of [["a monthly product with no free days", { store: STORES.noFree }], ["a buyer Apple calls ineligible", { store: STORES.monthlyFree, elig: { monthly: 1 } }]]) {
      w = await real(cfg);
      ok(label + ": the exact charged-today card", same(w, {
        state: "paid", title: "Get Sona Premium", tag: "", price: "$9.99 a month, charged today.", what: "Daily practice, every game and every book.", rows: [],
        note: "Charged to your Apple ID today, then every month. Renews unless canceled in Settings → Subscriptions.", noteFirst: false, noteLast: false,
        name: "Monthly", sub: "Charged today", amount: "$9.99/mo", check: "Subscription auto-renews",
        button: "Subscribe — $9.99 a month", act: "buy", header: "Sona Premium: $9.99 a month, charged today.", none: null, headsUp: "" }), w);
    }
    w = await real({ store: STORES.yearOnly });
    ok("a store with only the yearly product: the exact 'cannot be bought' card, with no figure", same(w, {
      state: "none", title: "Sona Premium", tag: "", price: "", what: "", rows: [], note: "", noteFirst: false, noteLast: false, name: "", sub: "", amount: "", check: "", button: "Try again", act: "retry",
      header: "Sona Premium can't be bought right now.", none: { title: "Sona Premium can't be bought right now.", text: "Please try again in a little while." }, headsUp: "" }), w);
  });

  // ── 9. no reminder without a mailer ──
  {
    const src = readFileSync(ROOT + "/sona.js", "utf8");
    const a = src.indexOf("// PLAN-WORDS-BEGIN"), b = src.indexOf("// PLAN-WORDS-END");
    const block = a > -1 && b > a ? src.slice(a, b) : "";
    ok("every sentence Apple's card may show sits between the two markers", block.length > 2000 && /function planWords\(/.test(block) && /function planSay\(/.test(block) && /function planBillDate\(/.test(block) && src.indexOf("// PLAN-WORDS-BEGIN", a + 1) === -1, block.length);
    // since 22 Oct 2026 ONE sentence may (the heads-up line, on a free row,
    // when the page says this phone will show it): it is written once, as a
    // constant, and nothing else in the block, comments included, says it
    const HEADS = 'const PLAN_HEADS_UP = "We\'ll remind you the day before it ends.";';
    const rest = block.split(HEADS).join(" ");
    ok("…and that source says nothing of mail, a reminder or a notification, comments included, but for the one heads-up line, written once",
      block.split(HEADS).length === 2 && !/mail|remind|notif/i.test(rest), (rest.match(/.{0,40}(?:mail|remind|notif).{0,40}/i) || [""])[0]);
    // RevenueCat's webhook (app/api/revenuecat, 16 Oct 2026) now feeds a
    // "Your free days end soon" email, but only for a parent who gave the
    // app an email: a family who skipped it gets none. So the card still
    // promises no message and shows no dated rows, whatever routes exist.
    await load({});
    const rows = await page.evaluate(() => Sona.storePlan().then((plan) => Sona.planWords(plan, {}).rows.length));
    ok("the free card has no dated rows (a reminder reaches only a parent who gave an email, so the card promises none)", rows === 0, rows);
  }

  // ── 10. the billing day ──
  await scenario("planBillDate", async () => {
    await load({});
    const r = await page.evaluate(() => {
      const free = (n, unit) => ({ state: "free", price: "$9.99", per: "month", free: { n, unit, text: "" } });
      const day = (d) => d && [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours()].join("-");
      const oct5 = new Date(2026, 9, 5, 12), oct30 = new Date(2026, 9, 30, 12);
      return {
        h72: Sona.planBillDate(free(3, "day"), oct5).getTime() - oct5.getTime(),
        h72dst: Sona.planBillDate(free(3, "day"), oct30).getTime() - oct30.getTime(),
        dst: day(Sona.planBillDate(free(3, "day"), oct30)),
        feb: day(Sona.planBillDate(free(1, "month"), new Date(2027, 0, 31, 12))),
        leap: day(Sona.planBillDate(free(1, "month"), new Date(2028, 0, 31, 12))),
        plain: day(Sona.planBillDate(free(1, "month"), oct5)),
        year: day(Sona.planBillDate(free(1, "year"), new Date(2028, 1, 29, 12))),
        paid: Sona.planBillDate({ state: "paid", price: "$9.99", per: "month", free: null }, oct5),
        none: Sona.planBillDate({ state: "none" }, oct5), nul: Sona.planBillDate(null, oct5),
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    });
    ok("the checks run in " + ZONE, r.zone === ZONE, r.zone);
    ok("3 free days end exactly 72 hours later", r.h72 === 72 * 3600 * 1000, r.h72);
    ok("…across the 1 November clock change too (72 hours, so an hour earlier by the wall clock)", r.h72dst === 72 * 3600 * 1000 && r.dst === "2026-11-2-11", r);
    ok("1 month from 31 January is the last day of February", r.feb === "2027-2-28-12" && r.leap === "2028-2-29-12", r);
    ok("1 month from the 5th is the 5th, and 1 year from 29 February is 28 February", r.plain === "2026-11-5-12" && r.year === "2029-2-28-12", r);
    ok("a plan with no free time has no billing day to name", r.paid === null && r.none === null && r.nul === null, r);
  });

  // ── 11. buyPlan: one purchase call, and what each of Apple's answers becomes ──
  await scenario("buyPlan", async () => {
    const buy = () => page.evaluate(() => Sona.storePlan().then((plan) => Sona.buyPlan(plan).then((r) => ({ r, id: plan.id }), (e) => ({ code: e && e.code, cancelled: !!(e && e.cancelled), message: e && e.message, isError: e instanceof Error, id: plan.id }))));
    for (const bridge of [null, "proxy"]) {
      const on = bridge ? " (a bridge that answers every name)" : "";
      for (const [mode, code] of [["cancel", "cancelled"], ["pending", "pending"], ["notallowed", "not-allowed"], ["nogrant", "not-entitled"], ["offline", "offline"], ["fail", "failed"]]) {
        await load({ bridge, buy: mode });
        const b = await buy(), r = await rec();
        ok("Apple's '" + mode + "'" + on + " rejects with the code " + code, b.code === code && b.isError && b.message === code && b.cancelled === (code === "cancelled"), b);
        ok("…after exactly one purchase call, for the plan's own product, with no second fetch and no second method tried",
          r.bought.length === 1 && r.bought[0] === IDS.monthly && r.asked.length === 1 && r.unknown.indexOf("purchaseProduct") === -1, r);
        ok("…and nothing was unlocked", !(await sub() || {}).active);
      }
      await load({ bridge, buy: "owned" });
      let b = await buy(), r = await rec(), s = await sub();
      ok("Apple's 'already purchased'" + on + " runs a restore and resolves as restored, not as a new sale", !!b.r && b.r.ok === true && b.r.restored === true && r.restores === 1 && r.bought.length === 1 && !!s && s.active === true, [b, r]);
      await load({ bridge, buy: "owned", restore: "none" });
      b = await buy();
      ok("…and when that restore finds nothing" + on + ": not-entitled, never a silent success", b.code === "not-entitled", b);
      await load({ bridge, buy: "owned", restore: "fail" });
      b = await buy();
      ok("…or cannot be reached" + on + ": not-entitled", b.code === "not-entitled", b);

      await load({ bridge });
      b = await buy(); r = await rec(); s = await sub();
      ok("a purchase that goes through" + on + " resolves { ok: true } and unlocks from Apple", !!b.r && b.r.ok === true && !b.r.restored && !!s && s.active === true && s.source === "apple", [b, s]);
      ok("…having bought the plan's own product, once, with no second getProducts call", r.bought.length === 1 && r.bought[0] === b.id && b.id === IDS.monthly && r.asked.length === 1 && r.unknown.indexOf("purchaseProduct") === -1, r);

      await load({ bridge });
      const noPlan = await page.evaluate(() => Sona.storePlan().then((plan) => {
        const tries = [null, undefined, {}, { state: "none", why: "timeout" }, { state: "owned" }, JSON.parse(JSON.stringify(plan)), { state: "free", kind: "monthly" }];
        return Promise.all(tries.map((t) => Sona.buyPlan(t).then(() => "bought", (e) => e && e.code)));
      }));
      ok("nothing to buy" + on + ": a 'none' plan, an 'owned' one, or a copy without the store's product all reject no-plan, and Apple is never asked", noPlan.every((c) => c === "no-plan") && (await rec()).bought.length === 0, noPlan);

      // Apple's other codes, and the two shapes a cancel can take
      await load({ bridge });
      const codes = await page.evaluate(() => Sona.storePlan().then((plan) => {
        const P = Capacitor.Plugins.Purchases;
        const one = (err) => { P.purchaseStoreProduct = () => Promise.reject(err); return Sona.buyPlan(plan).then(() => "bought", (e) => e && e.code); };
        const E = (o) => Object.assign(new Error(o.message || "Something from Apple."), o);
        return [E({ code: "15" }), E({ code: "5" }), E({ code: "35" }), E({ code: 20 }), E({ userCancelled: true }), E({ code: "1", message: "The user closed the sheet." }), E({ code: "999" }), E({}), null]
          .reduce((chain, err) => chain.then((out) => one(err).then((c) => out.concat([c]))), Promise.resolve([]));
      }));
      ok("the other answers" + on + ": busy (15), unavailable (5), offline (35), a numeric 20, a cancel by flag, a cancel by code alone, and anything else is 'failed'",
        same(codes, ["busy", "unavailable", "offline", "pending", "cancelled", "cancelled", "failed", "failed", "failed"]), codes);

      // iapPurchase without the product in hand still fetches it, as it always did
      await load({ bridge });
      let alone = await page.evaluate(() => Sona.iapPurchase("annual").then((x) => x, (e) => ({ err: String(e && e.message) })));
      r = await rec();
      ok("iapPurchase('annual') with no second argument" + on + " still fetches the yearly product and buys it (the id is kept for the families who hold it)", alone && alone.ok === true && same(r.asked, [[IDS.annual]]) && same(r.bought, [IDS.annual]), [alone, r]);
      await load({ bridge });
      alone = await page.evaluate(() => Sona.iapPurchase("monthly").then((x) => x, (e) => ({ err: String(e && e.message) })));
      r = await rec();
      ok("iapPurchase('monthly') alone" + on + " fetches and buys monthly", alone && alone.ok === true && same(r.asked, [[IDS.monthly]]) && same(r.bought, [IDS.monthly]), [alone, r]);
      await load({ bridge });
      alone = await page.evaluate(() => Sona.iapProduct("annual").then((yearly) => Sona.iapPurchase("monthly", yearly)).then((x) => x, (e) => ({ err: String(e && e.message) })));
      r = await rec();
      ok("a product handed in that is not the id being bought" + on + " is never sold under it: the right one is fetched", alone && alone.ok === true && same(r.bought, [IDS.monthly]), [alone, r]);
      await load({ bridge, store: STORES.yearOnly });
      alone = await page.evaluate(() => Sona.iapPurchase("monthly").then((x) => x, (e) => ({ err: String(e && e.message) })));
      r = await rec();
      ok("…and a store with no monthly product" + on + " sells nothing under the monthly name", !!alone.err && r.bought.length === 0, [alone, r]);
    }
    await load({ buy: "hang" });
    await page.evaluate(() => { window.__buy = "open"; Sona.storePlan().then((plan) => Sona.buyPlan(plan)).then(() => { window.__buy = "done"; }, () => { window.__buy = "failed"; }); });
    await tick(120000);
    ok("Apple's own sheet has no time limit: two minutes on, the purchase is still open", await page.evaluate(() => window.__buy) === "open" && (await rec()).bought.length === 1);

    const says = await page.evaluate(() => { const o = {}; ["opening", "slow", "pending", "not-allowed", "not-entitled", "offline", "unavailable", "failed", "bought", "owned", "restoring", "restored", "no-purchases", "restore-failed", "cancelled", "busy", "no-plan", "nonsense", "", null, undefined, "toString", "constructor"].forEach((c) => { o[String(c)] = Sona.planSay(c); }); return o; });
    ok("planSay: the exact line for each code", same(says, {
      opening: "Opening the App Store…",
      slow: "Still waiting for the App Store. If its window has closed, tap Restore Purchases.",
      pending: "Waiting for approval. Sona Premium opens once the purchase is approved.",
      "not-allowed": "Purchases are turned off on this device. Check Screen Time in Settings.",
      "not-entitled": "Apple has your order, but Premium hasn't switched on yet. Tap Restore Purchases below.",
      offline: "We couldn't reach the App Store. Check your connection and try again.",
      unavailable: "Sona Premium can't be bought right now. Please try again in a little while.",
      failed: "That didn't go through. If Apple took a payment, tap Restore Purchases.",
      bought: "Sona Premium is on. Welcome to Sona!",
      owned: "You already have Sona Premium. Welcome back!",
      restoring: "Checking your purchases…",
      restored: "Restored ✓ — welcome back!",
      "no-purchases": "No purchases found on this Apple ID.",
      "restore-failed": "Couldn't reach the App Store — try again in a moment.",
      cancelled: "", busy: "", "no-plan": "", nonsense: "", "": "", null: "", undefined: "", toString: "", constructor: "" }), says);
    const lines = Object.values(says);
    ok("no line says 'nothing was charged': after a failure the phone does not know that", !lines.some((l) => /nothing was charged/i.test(l)), lines);
    ok("no line promises a message, names a figure, or says 'free'", !lines.some((l) => /e-?mail|remind|notif|[\d$]|free/i.test(l)), lines);
    ok("the line a new customer reads has no 'free', no digit and no $", says.bought === "Sona Premium is on. Welcome to Sona!" && !/free|[\d$]/i.test(says.bought));
  });

  // ── the email list hears which plan began (Travis, 5 Oct 2026: "yeah build
  // it"). Apple never tells Sona who bought, so after a purchase goes through
  // buyPlan tells /api/lead "trial" or "paid" for the parent's own email,
  // and the list files them under Started Premium. Only with an email, once per kind and address, never
  // anything about the child, and never for a restore or a failure.
  await scenario("the list hears", async () => {
    const leads = () => hits.filter((h) => h.path === "/api/lead").map((h) => { try { return JSON.parse(h.body); } catch (e) { return { raw: h.body }; } });
    const settle = () => page.waitForTimeout(150);
    const buy = () => page.evaluate(() => Sona.storePlan().then((plan) => Sona.buyPlan(plan)).then((r) => r, (e) => ({ code: e && e.code })));
    const seed = (o) => page.evaluate((o) => { Object.keys(o).forEach((k) => localStorage.setItem(k, typeof o[k] === "string" ? o[k] : JSON.stringify(o[k]))); }, o);
    const period = (t) => page.evaluate((t) => {
      const P = Capacitor.Plugins.Purchases, orig = P.purchaseStoreProduct;
      P.purchaseStoreProduct = async (a) => { const r = await orig(a); try { r.customerInfo.entitlements.active.full.periodType = t; } catch (e) {} return r; };
    }, t);
    const KID = { childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true };

    hits.length = 0;
    await load({});
    await seed({ "sona.profile.v1": Object.assign({ email: "mom@example.com", weeklyEmail: true }, KID) });
    let b = await buy(); await settle();
    let L = leads();
    ok("free days started, with an email from setup: the list is told 'trial' for that email, once",
      !!b && b.ok === true && L.length === 1 && L[0].email === "mom@example.com" && L[0].plan === "trial" && L[0].role === "parent" && L[0].source === "app-trial", L);
    ok("…and nothing about the child goes with it: no name, no age, no sounds",
      L.length === 1 && !/Mia|childName|"child"|childAge|focusSounds|"R"/.test(JSON.stringify(L[0])) && same(Object.keys(L[0]).sort(), ["email", "plan", "role", "source", "summary"]), L);
    hits.length = 0;
    await period("TRIAL");
    await page.evaluate(() => { localStorage.removeItem("sona.sub.v1"); localStorage.removeItem("__ent"); });
    b = await buy(); await settle();
    ok("the same kind for the same address on this phone is not told twice", leads().length === 0, leads());

    hits.length = 0;
    await load({});
    await seed({ "sona.profile.v1": Object.assign({ email: "dad@example.com" }, KID) });
    await period("NORMAL");
    await buy(); await settle();
    L = leads();
    ok("Apple's own word wins: a purchase it calls NORMAL (charged at once) is told 'paid', whatever the card said",
      L.length === 1 && L[0].plan === "paid" && L[0].source === "app-paid" && L[0].email === "dad@example.com", L);

    hits.length = 0;
    await load({ intro: "none" });
    await seed({ "sona.profile.v1": Object.assign({ email: "pat@example.com" }, KID) });
    await buy(); await settle();
    L = leads();
    ok("with no word from Apple, a pay-today plan is told 'paid'", L.length === 1 && L[0].plan === "paid", L);

    // the one payment (22 Oct 2026): charged once, today, so "paid", with or without Apple's word
    for (const t of [null, "NORMAL"]) {
      hits.length = 0;
      await load({ offering: ["monthly", "lifetime"] });
      await seed({ "sona.profile.v1": Object.assign({ email: "once@example.com" }, KID) });
      if (t) await period(t);
      b = await page.evaluate(() => Sona.storePlan().then((plan) => Sona.buyPlan(plan.life)).then((r) => r, (e) => ({ code: e && e.code })));
      await settle();
      L = leads();
      ok("the one payment bought" + (t ? ", Apple calling it " + t : ", with no word from Apple") + ": the list is told 'paid', once, and nothing about the child",
        !!b && b.ok === true && L.length === 1 && L[0].plan === "paid" && L[0].source === "app-paid" && L[0].email === "once@example.com" && same(Object.keys(L[0]).sort(), ["email", "plan", "role", "source", "summary"]) && !/Mia|lifetime/i.test(JSON.stringify(L[0])), [b, L]);
    }

    hits.length = 0;
    await load({});
    await seed({ "sona.kids.v1": { active: "k2", hi: 2, list: [{ slot: "", name: "Mia" }, { slot: "k2", name: "Leo" }] },
      "sona.profile.v1": Object.assign({ email: "first@example.com" }, KID), "sona.profile.v1@k2": { childName: "Leo", childAge: "5", onboarded: true } });
    await buy(); await settle();
    L = leads();
    ok("the email sits on the first child's profile while a brother is the one playing: it is still found",
      L.length === 1 && L[0].email === "first@example.com" && L[0].plan === "trial" && !/Leo|Mia/.test(JSON.stringify(L[0])), L);

    hits.length = 0;
    await load({});
    await seed({ "sona.profile.v1": KID });
    b = await buy(); await settle();
    ok("no email anywhere: the purchase goes through and nothing is sent", !!b && b.ok === true && leads().length === 0, leads());

    hits.length = 0;
    await load({ buy: "owned" });
    await seed({ "sona.profile.v1": Object.assign({ email: "back@example.com" }, KID) });
    b = await buy(); await settle();
    ok("a restore ('already purchased') is not a new trial: nothing is sent", !!b && b.restored === true && leads().length === 0, [b, leads()]);
    for (const mode of ["cancel", "pending", "fail", "nogrant"]) {
      hits.length = 0;
      await load({ buy: mode });
      await seed({ "sona.profile.v1": Object.assign({ email: "no@example.com" }, KID) });
      b = await buy(); await settle();
      ok("Apple's '" + mode + "': nothing is sent", !!b && !!b.code && leads().length === 0, [b, leads()]);
    }
    hits.length = 0;
    await load({});
    await seed({ "sona.profile.v1": Object.assign({ email: "not an email" }, KID) });
    await buy(); await settle();
    ok("an email that is not an address is not sent", leads().length === 0, leads());
  });

  // ── RevenueCat hears the parent's email (RCHOOK1, Travis, 16 Oct 2026:
  // "Yes, show emails"). Once the store is set up on a page, the household's
  // parent email goes to RevenueCat (setEmail), so its dashboard and its
  // webhook name the parent. Only that address; nothing without one; never
  // anything about the child; and a build without the call, or one that
  // throws or refuses, sells exactly as before.
  await scenario("RevenueCat hears the email", async () => {
    const KID = { childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true };
    const seed = (o) => page.evaluate((o) => { Object.keys(o).forEach((k) => localStorage.setItem(k, typeof o[k] === "string" ? o[k] : JSON.stringify(o[k]))); }, o);
    // a fresh phone with this household, then a page that sets the store up
    const visit = async (cfg, house) => {
      await load(cfg); await seed(house); await again();
      await page.evaluate(() => Sona.storePlan());
      await page.waitForTimeout(100);
      return page.evaluate(() => window.__phone.emails.slice());
    };
    let e = await visit({}, { "sona.profile.v1": Object.assign({ email: "Mom@Example.com", weeklyReport: true }, KID) });
    ok("a parent who gave setup an email: RevenueCat is handed exactly that address, once on the page", same(e, [{ email: "Mom@Example.com" }]), e);
    ok("…and nothing about the child goes with it", !/Mia|childName|childAge|"R"/.test(JSON.stringify(e)), e);
    await page.evaluate(() => Sona.storePlan({ fresh: true }));
    await page.waitForTimeout(50);
    e = await page.evaluate(() => window.__phone.emails.slice());
    ok("…and asking the store again on the same page does not hand it again", e.length === 1, e);

    e = await visit({}, { "sona.profile.v1": KID });
    ok("no email anywhere in the household: RevenueCat is handed nothing", e.length === 0, e);
    e = await visit({}, { "sona.profile.v1": Object.assign({ email: "not an email" }, KID) });
    ok("an email that is not an address: nothing", e.length === 0, e);
    e = await visit({}, { "sona.kids.v1": { active: "k2", hi: 2, list: [{ slot: "", name: "Mia" }, { slot: "k2", name: "Leo" }] },
      "sona.profile.v1": Object.assign({ email: "first@example.com" }, KID), "sona.profile.v1@k2": { childName: "Leo", childAge: "5", onboarded: true } });
    ok("the email sits on the first child's profile while a brother plays: it is still the one handed over", same(e, [{ email: "first@example.com" }]) && !/Leo|Mia/.test(JSON.stringify(e)), e);

    // before the purchase, so RevenueCat sends it with that very first message
    await visit({}, { "sona.profile.v1": Object.assign({ email: "early@example.com" }, KID) });
    const atBuy = await page.evaluate(() => {
      const P = Capacitor.Plugins.Purchases, orig = P.purchaseStoreProduct;
      let seen = -1;
      P.purchaseStoreProduct = async (a) => { seen = window.__phone.emails.length; return orig(a); };
      return Sona.storePlan().then((plan) => Sona.buyPlan(plan)).then((r) => ({ r, seen }), (err) => ({ err: String(err && err.code), seen }));
    });
    ok("the address is handed over before the purchase is asked for", !!atBuy.r && atBuy.r.ok === true && atBuy.seen === 1, atBuy);

    // never less able to sell: a build without the call, or one that breaks
    for (const mode of ["missing", "throw", "fail"]) {
      const before = errors.length;
      await load({ setEmail: mode }); await seed({ "sona.profile.v1": Object.assign({ email: "mom@example.com" }, KID) }); await again();
      const r = await page.evaluate(() => Sona.storePlan().then((plan) => Sona.buyPlan(plan)).then((x) => x, (err) => ({ code: err && err.code })));
      await page.waitForTimeout(50);
      ok("setEmail " + mode + ": the purchase goes through exactly as before, and nothing is thrown", !!r && r.ok === true && errors.length === before, [r, errors.slice(before)]);
    }
    {
      const before = errors.length;
      await load({ bridge: "proxy", setEmail: "missing" }); await seed({ "sona.profile.v1": Object.assign({ email: "mom@example.com" }, KID) }); await again();
      const r = await page.evaluate(() => Sona.storePlan().then((plan) => Sona.buyPlan(plan)).then((x) => x, (err) => ({ code: err && err.code })));
      await page.waitForTimeout(50);
      ok("a bridge that answers every unknown name with a refusal: the purchase still goes through", !!r && r.ok === true && errors.length === before, [r, errors.slice(before)]);
    }
  });

  // ── 12. setupWall: does this family still owe the price? ──
  await scenario("setupWall", async () => {
    const wall = (ms) => page.evaluate((m) => { window.__wall = null; (m == null ? Sona.setupWall() : Sona.setupWall(m)).then((v) => { window.__wall = { v }; }); }, ms);
    const walled = () => page.evaluate(() => window.__wall);
    for (const [label, cfg, seed] of [
      ["a browser", { app: null }, null],
      ["an app build with no purchase plugin", { app: "nobuy" }, null],
      ["a founder", { founder: true }, null],
      ["a household that already subscribes", {}, () => localStorage.setItem("sona.sub.v1", JSON.stringify({ active: true, email: "", since: 1, source: "stripe" }))],
      ["a family who joined through their speech therapist", { slp: true }, null],
      ["a household that kept the free version", { setUp: true }, null],
    ]) {
      await load(cfg);
      if (seed) await page.evaluate(seed);
      await wall();
      const w = await walled(), r = await rec();
      ok(label + ": no price is owed, said at once, and the store is never asked", !!w && w.v === false && r.infos === 0 && r.syncs === 0 && r.asked.length === 0, [w, r]);
    }
    for (const bridge of [null, "proxy"]) {
      const on = bridge ? " (a bridge that answers every name)" : "";
      await load({ bridge }); await wall();
      let w = await walled(), r = await rec();
      ok("a new phone that can buy" + on + " owes the price, after the record, one sync and the record again", !!w && w.v === true && r.infos === 2 && r.syncs === 1 && r.asked.length === 0 && r.bought.length === 0, [w, r]);

      await load({ bridge, entitled: true }); await wall();
      w = await walled(); let s = await sub();
      ok("an Apple ID that already has Premium" + on + " owes nothing, and the subscription is written down", !!w && w.v === false && !!s && s.active === true && s.source === "apple", [w, s]);

      await load({ bridge, sync: "finds" }); await wall();
      w = await walled(); r = await rec();
      ok("a reinstalled subscriber" + on + ": syncPurchases is called once and the answer is 'owes nothing'", !!w && w.v === false && r.syncs === 1 && r.bought.length === 0 && r.restores === 0, [w, r]);

      await load({ bridge, info: "hang" }); await wall(); await tick(2499);
      const early = await walled(); await tick(1); w = await walled();
      ok("a store that never answers" + on + ": still asking at 2,499 ms, 'owes the price' at 2,500", early === null && !!w && w.v === true, [early, w]);

      await load({ bridge, configure: "hang" }); await wall(); await tick(2499);
      const earlyC = await walled(); await tick(1); w = await walled();
      ok("a store that never finishes setting up" + on + ": 'owes the price' at 2,500 ms (the clock started at the call)", earlyC === null && !!w && w.v === true, [earlyC, w]);

      for (const mode of ["missing", "fail"]) {
        const before = errors.length;
        await load({ bridge, sync: mode }); await wall();
        w = await walled();
        ok("a purchase sync that is " + mode + on + " does not throw: the family owes the price", !!w && w.v === true && errors.length === before, [w, errors.slice(before)]);
      }
    }
    await load({ info: "hang" }); await wall(500); await tick(499);
    const e500 = await walled(); await tick(1);
    ok("the limit is the caller's when it gives one", e500 === null && (await walled()).v === true);
    await load({ sync: "finds", wait: { sync: 4000 } }); await wall(); await tick(2500);
    const slow = await walled();
    await ask(); await tick(1500);
    const shown = await got(), l = await late(), p = await page.evaluate(() => Sona.storePlan()), r = await rec();
    ok("a sync slower than setup's wait: setup goes to the price, whose own ask is the SAME sync (sent once): a price first, then owned by itself",
      !!slow && slow.v === true && !!shown && shown.state === "free" && l.length === 1 && l[0].state === "owned" && p.state === "owned" && r.syncs === 1 && r.bought.length === 0, [slow, brief(shown), l.map(brief), brief(p), r]);
    await load({ app: null, webSells: true }); await wall();
    ok("a browser where the website sells owes the price, at once (there is no store to ask)", (await walled() || {}).v === true);
  });

  // ── 13. the marker that brings a buyer back to setup ──
  await scenario("the marker", async () => {
    await load({});
    let r = await page.evaluate(() => ({ before: Sona.setupAfter(), marked: Sona.setupAfterMark(), after: Sona.setupAfter(), raw: sessionStorage.getItem("sona.setupafter.v1"), local: localStorage.getItem("sona.setupafter.v1") }));
    ok("with no set-up child the marker is written but picks nothing", r.before === false && r.marked === true && r.after === false && !!r.raw, r);
    ok("it lives in this tab only (sessionStorage), and holds a time and a child slot, nothing else", r.local === null && same(Object.keys(JSON.parse(r.raw)).sort(), ["at", "kid"]) && JSON.parse(r.raw).kid === "", r.raw);

    await load({ setUp: true, stamp: "post" });
    r = await page.evaluate(() => { const a = Sona.setupAfter(); Sona.setupAfterMark(); const b = Sona.setupAfter(), c = Sona.setupAfter(); return { a, b, c, raw: sessionStorage.getItem("sona.setupafter.v1"), owes: Sona.trialFirst(), open: Sona.gameAccess("slice").allowed }; });
    ok("for a set-up child: false before the mark, true after it, and asking twice removes nothing", r.a === false && r.b === true && r.c === true && !!r.raw, r);
    ok("IT PICKS A SCREEN AND GRANTS NOTHING: the family still owes the price and every game is still locked", r.owes === true && r.open === false, r);
    await page.clock.fastForward(2 * 60 * 60 * 1000 - 1);
    const justUnder = await page.evaluate(() => Sona.setupAfter());
    await page.clock.fastForward(1);
    r = await page.evaluate(() => ({ at2h: Sona.setupAfter(), still: !!sessionStorage.getItem("sona.setupafter.v1") }));
    ok("it lasts under two hours, and a stale one is not removed by being read", justUnder === true && r.at2h === false && r.still === true, [justUnder, r]);

    await load({ setUp: true, stamp: "post" });
    r = await page.evaluate(() => {
      Sona.setupAfterMark();
      const first = Sona.setupAfter();
      Sona.addKid("Ben", "6");
      const added = Sona.setupAfter();
      Sona.saveProfile(Object.assign(Sona.getProfile(), { onboarded: true, focusSounds: ["S"] }));
      const otherChild = Sona.setupAfter();
      Sona.switchKid("");
      const back = Sona.setupAfter();
      sessionStorage.setItem("sona.setupafter.v1", JSON.stringify({ at: Date.now() + 60000, kid: "" }));
      const future = Sona.setupAfter();
      const junk = ["not json", "null", "{}", "[]", JSON.stringify({ at: "soon", kid: "" }), JSON.stringify({ at: Date.now() })].map((v) => { sessionStorage.setItem("sona.setupafter.v1", v); return Sona.setupAfter(); });
      Sona.setupAfterMark(); const again = Sona.setupAfter();
      Sona.setupAfterClear();
      return { first, added, otherChild, back, future, junk, again, cleared: sessionStorage.getItem("sona.setupafter.v1"), afterClear: Sona.setupAfter() };
    });
    ok("it belongs to one child: another active child (even a set-up one) is not picked, and switching back is", r.first === true && r.added === false && r.otherChild === false && r.back === true, r);
    ok("a marker from the future, or one that does not parse, picks nothing", r.future === false && r.junk.every((v) => v === false), r);
    ok("setupAfterClear() removes it", r.again === true && r.cleared === null && r.afterClear === false, r);
  });

  // ── 14. the therapy answer stays on the phone ──
  // ONE question since 5 Oct 2026 ("Is <Name> in speech therapy?"): it took the
  // place of the two Travis did not like. The days-a-week pick asked beside it
  // is a real setting (profile.weeklyGoal) and is not kept here.
  await scenario("the answers", async () => {
    await load({ setUp: true });
    const r = await page.evaluate(() => {
      const KEY = "sona.setupasks.v1", out = {};
      out.list = Sona.SETUP_THERAPY;
      out.before = Sona.setupAsks();
      out.saved = Sona.setupAsksSave({ therapy: "t_yes" });
      out.after = Sona.setupAsks();
      out.raw = localStorage.getItem(KEY);
      out.session = sessionStorage.getItem(KEY);
      out.kkey = Sona.kkey(KEY);
      out.profile = JSON.stringify(Sona.getProfile()) + (localStorage.getItem("sona.profile.v1") || "");
      // a half-finished setup holds the same tap, for the first child and for a later one
      localStorage.setItem("sona.obdraft.v1", JSON.stringify({ childName: "Mia", therapy: "t_yes", goal: "5" }));
      localStorage.setItem("sona.obdraft.v1@k2", JSON.stringify({ childName: "Ben", therapy: "t_no" }));
      out.exported = Sona.exportString();
      out.exportKeys = Object.keys(Sona.exportData().data);
      // addKid copies nothing and moves nothing
      Sona.addKid("Ben", "6");
      out.afterKid = { raw: localStorage.getItem(KEY), suffixed: localStorage.getItem(KEY + "@k2"), asks: Sona.setupAsks(), kidProfile: JSON.stringify(Sona.getProfile()) };
      Sona.switchKid("");
      // only a listed id is kept
      Sona.setupAsksSave({ therapy: "<b>yes, a speech therapist</b>", extra: "Mia", name: "Mia", goal: "5" });
      out.strict = [localStorage.getItem(KEY), Sona.setupAsks()];
      Sona.setupAsksSave({});
      out.skipped = [localStorage.getItem(KEY), Sona.setupAsks()];
      Sona.setupAsksSave();
      out.nothing = Sona.setupAsks();
      localStorage.setItem(KEY, JSON.stringify({ v: 2, therapy: "nope" }));
      out.unknown = Sona.setupAsks();
      localStorage.setItem(KEY, "not json");
      out.garbage = Sona.setupAsks();
      // a family asked the OLD two questions (they were live for a day) is not asked again,
      // and the one old answer that was this question carries over
      localStorage.setItem(KEY, JSON.stringify({ v: 1, why: "w_therapist", home: "h_hard" }));
      out.oldYes = Sona.setupAsks();
      localStorage.setItem(KEY, JSON.stringify({ v: 1, why: "w_tricky", home: "h_most" }));
      out.oldOther = Sona.setupAsks();
      // a backup that carries either key is not let in
      localStorage.removeItem(KEY); localStorage.removeItem("sona.obdraft.v1"); localStorage.removeItem("sona.obdraft.v1@k2");
      const res = Sona.importData({ app: "sona", v: 1, data: {
        "sona.setupasks.v1": JSON.stringify({ v: 2, therapy: "t_no" }),
        "sona.obdraft.v1": JSON.stringify({ childName: "Zed", therapy: "t_no" }),
        "sona.obdraft.v1@k2": JSON.stringify({ childName: "Zed" }),
        "sona.profile.v1": JSON.stringify({ childName: "Zed", childAge: "7", focusSounds: ["S"], onboarded: true }) } });
      out.imported = { ok: res && res.ok, asks: localStorage.getItem(KEY), draft: localStorage.getItem("sona.obdraft.v1"), draft2: localStorage.getItem("sona.obdraft.v1@k2"), name: Sona.getProfile().childName, state: Sona.setupAsks() };
      return out;
    });
    ok("the list of answer ids is fixed: yes, no, or not yet", same(r.list, ["t_yes", "t_none", "t_no"]), r.list);
    ok("before setup nothing was asked", same(r.before, { asked: false, therapy: "" }), r.before);
    ok("after it, the answer is held and 'asked' is true", r.saved === true && same(r.after, { asked: true, therapy: "t_yes" }), r.after);
    ok("…in ONE household key in localStorage, holding one id and nothing else", same(JSON.parse(r.raw), { v: 2, therapy: "t_yes" }) && r.session === null && r.kkey === "sona.setupasks.v1", r.raw);
    ok("no profile holds a therapy field", !/"therapy"|t_yes|t_none|t_no/.test(r.profile) && !/"therapy"|t_yes|t_none|t_no/.test(r.afterKid.kidProfile), r.profile.slice(0, 200));
    ok("A BACKUP NEVER CARRIES IT: the export has no answers key, no setup draft, and no answer id", !/setupasks|obdraft|t_yes|t_none|t_no/.test(r.exported) && r.exportKeys.length > 3 && r.exportKeys.indexOf("sona.profile.v1") > -1, r.exportKeys);
    ok("…and a backup that does hold either key is not let in, while the practice beside it is", r.imported.ok === true && r.imported.asks === null && r.imported.draft === null && r.imported.draft2 === null && r.imported.name === "Zed" && same(r.imported.state, { asked: false, therapy: "" }), r.imported);
    ok("adding a child copies nothing and changes nothing: the key is the household's", r.afterKid.raw === r.raw && r.afterKid.suffixed === null && same(r.afterKid.asks, r.after), r.afterKid);
    ok("only a listed id is ever stored: anything else, a name or the days picked included, is dropped", same(JSON.parse(r.strict[0]), { v: 2, therapy: "" }) && same(r.strict[1], { asked: true, therapy: "" }), r.strict);
    ok("skipped: the key only records that the question was shown", same(JSON.parse(r.skipped[0]), { v: 2, therapy: "" }) && same(r.skipped[1], { asked: true, therapy: "" }) && same(r.nothing, { asked: true, therapy: "" }), r.skipped);
    ok("a stored value that is not on the list reads as ''", same(r.unknown, { asked: true, therapy: "" }) && same(r.garbage, { asked: true, therapy: "" }), [r.unknown, r.garbage]);
    ok("a family asked the two old questions is not asked again, and \"We see a speech therapist\" reads as yes", same(r.oldYes, { asked: true, therapy: "t_yes" }) && same(r.oldOther, { asked: true, therapy: "" }), [r.oldYes, r.oldOther]);
  });

  // ── 15. the source, and the fake itself ──
  {
    const src = readFileSync(ROOT + "/sona.js", "utf8"), analytics = readFileSync(ROOT + "/analytics.js", "utf8");
    ok("all three product ids are in sona.js: the yearly one restores the families who hold it, and the one payment is a non-consumable of its own",
      /const IAP_PRODUCTS = \{ annual: "com\.speaksona\.app\.annual", monthly: "com\.speaksona\.app\.monthly", lifetime: "com\.speaksona\.app\.lifetime" \};/.test(src));
    const sp = src.slice(src.indexOf("function storePlan("), src.indexOf("function buyPlan("));
    // since 19 Oct 2026 storePlan names the yearly product, and since 22 Oct
    // 2026 the one payment, but only behind RevenueCat's offering: nothing
    // about either comes before _offered(P), read once for both
    const behind = sp.indexOf("_offered(P)"), offers = src.slice(src.indexOf("function _offered("), src.indexOf("function _lifePlan("));
    ok("storePlan asks through iapProduct(\"monthly\"), the call real phones already use, with monthly's eligibility call unchanged, and names the yearly product and the one payment only after RevenueCat's offering listed them (the yearly one only while IAP_SELL_YEARLY is on: 23 Oct 2026)",
      /iapProduct\("monthly"\)/.test(sp) && !/getProducts|getOfferings/.test(sp) && /checkTrialOrIntroductoryPriceEligibility\(\{ productIdentifiers: \[id\] \}\)/.test(sp) &&
      behind > 0 && !/annual|lifetime/.test(sp.slice(0, behind)) && sp.split("_offered(P)").length === 2 && sp.indexOf('iapProduct("annual")') > behind && sp.indexOf('iapProduct("lifetime")') > behind &&
      /if \(!IAP_SELL_YEARLY \|\| !o\.annual \|\| a\.yr !== undefined\) return noYear\(\);/.test(sp) && /if \(!o\.lifetime \|\| a\.lf !== undefined\) return noLife\(\);/.test(sp), sp.slice(0, 200));
    ok("…and the offering counts only when its CURRENT offering lists each product among its packages (by the product's own id), and a broken one lists neither",
      /typeof P\.getOfferings !== "function"/.test(offers) && /r\.current/.test(offers) && /availablePackages/.test(offers) && /pk\.product\.identifier === id/.test(offers) &&
      /has\(IAP_PRODUCTS\.annual\)/.test(offers) && /has\(IAP_PRODUCTS\.lifetime\)/.test(offers) && /\(\) => \(\{ annual: false, lifetime: false \}\)\)/.test(offers), offers.slice(0, 300));
    const ip = (src.match(/function iapPurchase\(kind, product\) \{[\s\S]*?\n  \}/) || [""])[0];
    ok("iapPurchase picks ONE purchase method before it asks Apple anything: no list of attempts, no retry on a rejection",
      ip.length > 200 && !/attempts|\.catch\(fn\)/.test(ip) && (ip.match(/P\.purchaseStoreProduct\(/g) || []).length === 1 && (ip.match(/P\.purchaseProduct\(/g) || []).length === 1 &&
      /if \(prod && typeof P\.purchaseStoreProduct === "function"\) return P\.purchaseStoreProduct\(\{ product: prod \}\);/.test(ip), ip.slice(0, 300));
    ok("the new names are at the END of what pages can reach, after everything that was there",
      /global\.Sona = \{[^\n]*\bWEB_SALES, webSales\b[^\n]*soundMark, clipsSettled, storePlan, buyPlan, planWords, planSay, planBillDate, setupWall, setupAfterMark, setupAfter, setupAfterClear, setupAsks, setupAsksSave, SETUP_THERAPY \};/.test(src));
    const noExport = (src.match(/const NO_EXPORT = \[[^\]]*\]/) || [""])[0], noImport = (src.match(/const NO_IMPORT = \[[^\]]*\]/) || [""])[0];
    ok("the answers and the setup draft are on NO_EXPORT and on NO_IMPORT", /"sona\.setupasks\.v1"/.test(noExport) && /"sona\.obdraft\.v1"/.test(noExport) && /"sona\.setupasks\.v1"/.test(noImport) && /"sona\.obdraft\.v1"/.test(noImport), [noExport, noImport.slice(-80)]);
    const perKid = (src.match(/const PER_KID = new Set\(\[[\s\S]*?\]\);/) || [""])[0];
    ok("…and the answers are the household's: not a per-child key", perKid.length > 100 && !/setupasks/.test(perKid));
    const sendP = (src.match(/function sendProgress\(kind\) \{[\s\S]*?\n  \}/) || [""])[0];
    ok("what a clinician is sent never reads them", sendP.length > 200 && !/setupAsks|SETUPASKS|setupasks/.test(sendP));
    const allowed = (analytics.match(/var ALLOWED = \{([\s\S]*?)\};/) || ["", ""])[1];
    ok("analytics.js lets `step` through (a fixed code for which screen was reached, never an answer)", /\bstep: 1\b/.test(allowed), allowed);

    const text = phone.toString();
    ok("the fake phone names nothing outside its own body: neither IDS nor STORES", !/IDS/.test(text) && !/STORES/.test(text));
    // …and it really does stand alone: run from its text in a bare JavaScript world
    let alone = null, why = "";
    try {
      alone = await vm.runInNewContext(`
        class Storage { constructor() { this.m = {}; } getItem(k) { return Object.prototype.hasOwnProperty.call(this.m, k) ? this.m[k] : null; } setItem(k, v) { this.m[k] = String(v); } removeItem(k) { delete this.m[k]; } }
        class DOMException extends Error {}
        const window = globalThis, localStorage = new Storage(), sessionStorage = new Storage(), navigator = {}, location = { pathname: "/x", search: "" };
        (${text})({ app: "buy", bridge: "proxy", setUp: true, kids: 2, marker: true, firstgame: "slice", draft: { childName: "Ben" }, founder: true });
        const P = window.Capacitor.Plugins.Purchases;
        P.configure().then(() => Promise.all([
          P.getProducts({ productIdentifiers: ["com.speaksona.app.monthly", "com.speaksona.app.annual"] }),
          P.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: ["com.speaksona.app.monthly"] }),
          P.getCustomerInfo(), P.syncPurchases(), P.purchaseProduct().then(() => "answered", () => "not implemented"),
        ])).then((a) => {
          window.__phone.set({ entitled: true });
          return JSON.stringify({ products: a[0].products.map((p) => [p.identifier, p.priceString, p.introPrice && p.introPrice.period]), elig: a[1], unknown: a[4], gate: sessionStorage.getItem("sona.gate.v1") != null,
            marker: JSON.parse(sessionStorage.getItem("sona.setupafter.v1") || "{}").kid, kids: JSON.parse(localStorage.getItem("sona.kids.v1")).active, recs: [window.__phone.asked.length, window.__phone.eligAsked, window.__phone.infos, window.__phone.syncs, window.__phone.unknown] });
        });`, {});
      alone = JSON.parse(alone);
    } catch (e) { why = String(e && e.stack); }
    ok("…run from its own text alone it builds the store, the seeds and the recorders (it is handed to addInitScript, which ships nothing else)",
      !!alone && same(alone.products, [[IDS.monthly, "$9.99", "P3D"], [IDS.annual, "$59.99", "P3D"]]) && alone.elig[IDS.monthly].status === 2 && alone.unknown === "not implemented" && alone.gate === true && alone.marker === "k2" && alone.kids === "k2" && same(alone.recs, [1, 1, 1, 1, ["purchaseProduct"]]), alone || why);
    ok("the exported stores are the ones the suites name, and the default is the App Store since 5 Oct 2026",
      same(Object.keys(STORES), ["monthlyFree", "noFree", "yearOnly", "empty"]) && same(STORES.monthlyFree.monthly, { price: "$9.99", free: "P3D" }) && !STORES.noFree.monthly.free && !STORES.yearOnly.monthly &&
      same(STORES.monthlyFree.lifetime, { price: "$59.99" }) && same(STORES.noFree.lifetime, { price: "$59.99" }) && !STORES.yearOnly.lifetime &&
      same(IDS, { monthly: "com.speaksona.app.monthly", annual: "com.speaksona.app.annual", lifetime: "com.speaksona.app.lifetime" }) && ZONE === "America/Boise" && new Date(NOON).toISOString() === "2026-10-05T18:00:00.000Z");
    await load({ intro: "none" }); await ask();
    const legacy = [brief(await got())];
    await load({ intro: "free3" }); await ask(); legacy.push(brief(await got()));
    await load({ intro: "hang" }); await ask(); await tick(4000); legacy.push(brief(await got()));
    ok("the old `intro` switch still means what trialfirsttest's untouched lines pass it for", legacy[0].state === "paid" && legacy[1].state === "free" && legacy[2].state === "none" && legacy[2].why === "timeout", legacy);
    await load({ kids: 3, stamp: "post", marker: true, firstgame: "slice", draft: { childName: "Ben", kid: "k2" }, local: { "sona.sub.v1": { active: true, source: "stripe" }, "sona.plain": "as it is" }, session: { "sona.test.session": "1" } });
    const seeded = await page.evaluate(() => ({
      kids: Sona.kids().map((k) => [k.slot, k.name, k.active]), setUp: Sona.getProfile().onboarded, name: Sona.getProfile().childName,
      marker: JSON.parse(sessionStorage.getItem("sona.setupafter.v1") || "{}").kid, first: sessionStorage.getItem("sona.firstgame.v1"), draft: JSON.parse(localStorage.getItem("sona.obdraft.v1") || "{}").kid,
      sub: Sona.isSubscribed(), plain: localStorage.getItem("sona.plain"), session: sessionStorage.getItem("sona.test.session"), gate: Math.abs(Number(sessionStorage.getItem("sona.gate.v1")) - Date.now()) < 1000 }));
    ok("the fake's seeds: a household of three whose last child was just added, the marker for that child, the old page's mark, a draft, and whatever a suite hands it",
      same(seeded.kids, [["", "Mia", false], ["k2", "Ben", false], ["k3", "Cara", true]]) && seeded.setUp === false && seeded.name === "Cara" && seeded.marker === "k3" && seeded.first === "slice" && seeded.draft === "k2" && seeded.sub === true && seeded.plain === "as it is" && seeded.session === "1", seeded);
    ok("…and its time stamps are written by the page's own clock (a paused fake one here), whichever was installed first", seeded.gate === true, seeded);
    await page.evaluate(() => { sessionStorage.removeItem("sona.setupafter.v1"); localStorage.removeItem("sona.obdraft.v1"); });
    await again();
    ok("…and a seed a page has cleared is not put back by the next page", await page.evaluate(() => sessionStorage.getItem("sona.setupafter.v1") === null && localStorage.getItem("sona.obdraft.v1") === null && Sona.kids().length === 3));
    await load({ info: "hang", products: "hang", buy: "hang" });
    const live = await page.evaluate(async () => {
      // the clock is paused, so "a moment later" is a run of microtasks, never a timer
      const settle = async () => { for (let i = 0; i < 30; i++) await null; };
      const P = Capacitor.Plugins.Purchases, seen = [];
      P.getCustomerInfo().then((i) => seen.push("info:" + !!i.customerInfo.entitlements.active.full));
      P.getProducts({ productIdentifiers: ["com.speaksona.app.monthly"] }).then((r) => seen.push("price:" + r.products[0].priceString));
      await settle();
      const held = seen.length;
      __phone.set({ info: "ok", entitled: true });
      await settle();
      const afterInfo = seen.slice();
      __phone.set({ products: "ok", store: { monthly: { price: "$12.49" } } });
      await settle();
      return { held, afterInfo, seen, kept: JSON.parse(localStorage.getItem("__phoneCfg")) };
    });
    ok("the fake's answers can change mid-test: a hung call is let go by set() and answers from the NEW config, and the patch is kept for the next load",
      live.held === 0 && same(live.afterInfo, ["info:true"]) && same(live.seen, ["info:true", "price:$12.49"]) && live.kept.entitled === true && live.kept.store.monthly.price === "$12.49", live);
    await again();
    ok("…where the init script reads it first", await page.evaluate(() => __phone.cfg().entitled === true && __phone.cfg().store.monthly.price === "$12.49" && __phone.cfg().app === "buy"));
    // A suite may put its own function in ANY method's place, the two optional
    // calls included. An assignment the fake dropped without a word would
    // leave its default ("eligible", "the sync finds nothing") answering for
    // a case the suite believes it is playing.
    for (const bridge of [null, "proxy"]) {
      const on = bridge ? " (a bridge that answers every name)" : "";
      await load({ bridge });
      const mine = await page.evaluate(() => {
        const P = Capacitor.Plugins.Purchases, seen = [];
        P.checkTrialOrIntroductoryPriceEligibility = (a) => { seen.push("eligibility:" + a.productIdentifiers.join()); return Promise.resolve({ "com.speaksona.app.monthly": { status: 1 } }); };
        P.syncPurchases = () => { seen.push("sync"); return Promise.resolve({}); };
        return Sona.storePlan().then((plan) => ({ state: plan.state, seen: seen.sort(), fake: [__phone.eligAsked, __phone.syncs], done: sessionStorage.getItem("sona.iapsync.v1") }));
      });
      ok("the fake's two optional calls can be replaced by a suite's own" + on + ": its 'not eligible' is the answer, and the fake's are never called",
        mine.state === "paid" && same(mine.seen, ["eligibility:" + IDS.monthly, "sync"]) && same(mine.fake, [0, 0]) && mine.done === "1", mine);
      await load({ bridge });
      const gone = await page.evaluate(() => {
        const P = Capacitor.Plugins.Purchases;
        delete P.checkTrialOrIntroductoryPriceEligibility; P.syncPurchases = undefined;
        return Sona.storePlan().then((plan) => ({ state: plan.state, sure: plan.sure, fake: [__phone.eligAsked, __phone.syncs], types: [typeof P.checkTrialOrIntroductoryPriceEligibility, typeof P.syncPurchases], done: sessionStorage.getItem("sona.iapsync.v1") }));
      });
      ok("…and taken away by one" + on + ": the free days are shown as not sure, and no sync is remembered",
        gone.state === "free" && gone.sure === false && same(gone.fake, [0, 0]) && same(gone.types, bridge ? ["function", "function"] : ["undefined", "undefined"]) && gone.done === null, gone);
    }
    const shapes = [];
    for (const cfg of [{ elig: { monthly: 1 } }, { elig: { monthly: 1 }, eligNames: true }, { elig: { monthly: 1 }, eligBare: true }, { elig: { monthly: 1 }, eligBare: true, eligNames: true }]) {
      await load(cfg);
      shapes.push(await page.evaluate(() => Capacitor.Plugins.Purchases.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: ["com.speaksona.app.monthly"] }).then((r) => r["com.speaksona.app.monthly"])));
    }
    ok("the fake answers eligibility in each shape a phone might: under .status or bare, as a number or as RevenueCat's name",
      same(shapes, [{ status: 1, description: "INTRO_ELIGIBILITY_STATUS_INELIGIBLE" }, { status: "INTRO_ELIGIBILITY_STATUS_INELIGIBLE", description: "INTRO_ELIGIBILITY_STATUS_INELIGIBLE" }, 1, "INTRO_ELIGIBILITY_STATUS_INELIGIBLE"]), shapes);

    ok("isOrange knows the old orange dot", isOrange("linear-gradient(160deg, rgb(255, 199, 143), rgb(255, 138, 61))") === true);
    ok("…and lets the cream tag, its highlight and the white dot through", !isOrange("rgb(244, 221, 176)") && !isOrange("rgb(255, 248, 233)") && !isOrange("rgb(255, 253, 247)"));
    ok("…and teal is teal, never orange: the token, a gradient of it, a faint shadow of it", isTeal("rgb(20, 133, 141)") && !isOrange("rgb(20, 133, 141)") && isTeal("linear-gradient(160deg, rgb(31, 168, 173), rgb(20, 133, 141)) rgba(0, 0, 0, 0)") && isTeal("rgba(20, 133, 141, 0.18) 0px 6px 16px 0px") && !isTeal("rgb(255, 138, 61)") && !isTeal("rgba(0, 0, 0, 0)") && !isTeal(""));
  }

  // ── 16. Meta's pixel: told not to read button taps on the page that asks ──
  await scenario("the pixel", async () => {
    const ID = "28886011914332605";
    const queue = () => page.evaluate(() => typeof fbq === "function" ? Array.from(fbq.queue || []).map((a) => Array.from(a)) : null);
    await load({ app: null }, "/__pixel-off.html");
    let q = await queue();
    ok("a pixel tag with data-autoconfig=\"off\": Meta's automatic events are switched off BEFORE init, then init, then the page view",
      same(q, [["set", "autoConfig", false, ID], ["init", ID], ["track", "PageView"]]), q);
    const sent = await page.evaluate(() => { sonaTrack("Lead"); return Array.from(fbq.queue).map((a) => Array.from(a)).pop(); });
    ok("…and an explicit event still fires, with no parameters of its own", same(sent, ["track", "Lead", {}]), sent);
    await load({ app: null }, "/__pixel-on.html");
    q = await queue();
    ok("a plain pixel tag is untouched: no 'set' call", same(q, [["init", ID], ["track", "PageView"]]), q);
    const before = requests.length;
    await load({ app: "buy" }, "/__pixel-off.html");
    const inApp = await page.evaluate(() => ({ fbq: typeof window.fbq, track: typeof window.sonaTrack }));
    ok("in the app Meta's script is never loaded and fbq is never defined", inApp.fbq === "undefined" && inApp.track === "function" && !requests.slice(before).some((r) => /facebook/.test(r.url)), inApp);
    const tagged = readdirSync(ROOT).filter((f) => f.endsWith(".html")).filter((f) => {
      const tags = readFileSync(ROOT + "/" + f, "utf8").match(/<script\b[^>]*\bsrc="\/pixel\.js"[^>]*>/g) || [];
      return tags.some((t) => /data-autoconfig="off"/.test(t));
    });
    ok("no page other than setup carries the switch (the landing pages and the plan screen keep Meta's automatic events)", tagged.filter((f) => f !== "onboarding.html").length === 0, tagged);
    ok("setup's page carries it: onboarding.html is the one page whose pixel tag has data-autoconfig=\"off\"", same(tagged, ["onboarding.html"]), tagged);
  });

  ok("no page error in the whole run", errors.length === 0, errors.slice(0, 5));
  ok("nothing was asked of any other host but Meta's script on the two browser pixel pages", requests.filter((r) => !r.url.startsWith(base + "/")).every((r) => /connect\.facebook\.net/.test(r.url)), requests.filter((r) => !r.url.startsWith(base + "/")).map((r) => r.url).slice(0, 5));
} finally {
  await context.close(); await browser.close(); await close();
}
console.log(failures ? `\n${failures} FAILED of ${assertions}` : `\nALL GREEN — ${assertions} assertions`);
process.exit(failures ? 1 : 0);
