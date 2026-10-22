// NOTIFY1: one reminder the day before the free trial ends (22 Oct 2026).
//
// Travis: "can we add push notifications and have that be a step in the
// onboarding where we ask them to turn it on to notify them a day before
// their trial ends". It is a LOCAL notification set on the phone through
// Sona's own plugin (SonaSpeech: notifyStatus, notifyAsk, notifySchedule,
// notifyCancel, iOS 1.0.9). heartest holds the Swift; this plays sona.js
// against a fake of those four methods that keeps what iOS keeps between
// page loads (the permission, the waiting requests), on the shared fake
// phone's App Store (_phone.mjs) for RevenueCat's side:
//   1. nothing without the plugin: a browser, an older build, half a plugin;
//   2. iOS's permission: never asked, allowed, refused, quiet, a bridge that
//      refuses or never answers (setup is never held for good);
//   3. arming: a day before the end, never in the past or within the hour,
//      one request however often it is armed, the fixed words (no name);
//   4. the one hook in buyPlan: a trial purchase arms from RevenueCat's end
//      (or the store's own free time), nothing else arms, buyPlan never waits;
//   5. the daily check: arms a trial, cancels once none is on (paid, ended,
//      cancelled by the parent), once a day, never on a store that did not
//      answer, never asks the store for a family who did not allow it;
//   6. the key stays on this phone: never exported, never imported;
//   7. the source: nothing leaves the phone, nothing reads a child.
import { readFileSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";
import { serve, open } from "./_phone.mjs";

let fails = 0, passes = 0;
const ok = (n, p, extra) => { if (p) passes++; else fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (typeof extra === "string" ? extra : JSON.stringify(extra)))); };

const DAY = 86400000, HOUR = 3600000;
const ID = "sona-trial-end";

// The iPhone's side of the four methods, as SonaSpeechPlugin.swift answers
// them. For context.addInitScript, after _phone.mjs's phone(): SELF-CONTAINED
// (addInitScript ships only this function's text).
//   plugin   "none": no SonaSpeech at all (on an app phone)
//   methods  which notify methods the build has (default all four); "none"
//   perm     iOS's setting on a fresh phone: "prompt" | "granted" | "denied" | "provisional"
//   answer   what the parent taps in iOS's box: "allow" (default) | "deny"
//   ask, status, schedule   "ok" | "fail" (rejects) | "throw" (before any promise) | "hang"
//   rc       RevenueCat's "full" entitlement for getCustomerInfo and the
//            purchase: { periodType, expirationDateMillis, expirationDate,
//            willRenew } merged into an active entitlement; null: none.
//            Absent: _phone.mjs's own answer
//   rcInfo   "fail" | "hang": getCustomerInfo when rc is given
// window.__ios: set(patch) (kept for later loads), perm(p) (iOS's setting
// changed behind the app's back), state() { perm, pending, log, infos }.
function ios(cfg) {
  try { localStorage.getItem("__iosState"); } catch (e) { return; }
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const live = Object.assign({}, cfg || {}, read("__iosCfg", {}));
  const st = read("__iosState", null) || { perm: live.perm || "prompt", pending: {}, log: [], infos: 0 };
  const keep = () => write("__iosState", st);
  const log = (m, a) => { st.log.push({ m, a: a === undefined ? null : JSON.parse(JSON.stringify(a)), page: location.pathname }); keep(); };
  const waiters = [];
  const hold = async (field) => { while (live[field] === "hang") await new Promise((r) => waiters.push(r)); };
  window.__ios = {
    set(patch) { Object.assign(live, patch); write("__iosCfg", Object.assign(read("__iosCfg", {}), patch)); waiters.splice(0).forEach((w) => w()); return true; },
    perm(p) { st.perm = p; keep(); return true; },
    state: () => JSON.parse(JSON.stringify(st)),
  };
  if (live.plugin === "none" || !window.Capacitor) return;
  const C = window.Capacitor;
  const fail = (m, code) => Object.assign(new Error(m), { code });
  const N = {
    available: async () => ({ available: false, onDevice: false, authorized: false }),
    requestPermission: async () => ({ granted: false }),
    stop: async () => ({ text: "", onDevice: true }),
  };
  const call = (name, field, body) => function (a) {
    log(name, a);
    if (live[field] === "throw") throw new Error(name + " is broken on this bridge");
    return (async () => { await hold(field); if (live[field] === "fail") throw fail(name + " failed", "fail"); return body(a); })();
  };
  const NOTIFY = {
    notifyStatus: call("notifyStatus", "status", () => ({ status: st.perm, v: 1 })),
    notifyAsk: call("notifyAsk", "ask", () => {
      if (st.perm === "prompt" || st.perm === "provisional") { st.perm = live.answer === "deny" ? "denied" : "granted"; keep(); }
      return { granted: st.perm === "granted", v: 1 };
    }),
    notifySchedule: call("notifySchedule", "schedule", (a) => {
      const at = Number(a && a.at), ahead = at - Date.now();
      if (!a || !a.id || !a.title || !a.body) throw fail("a reminder needs an id, a title and words", "invalid");
      if (!(ahead > 60000) || ahead >= 400 * 86400000) throw fail("that moment is past or too far away", "past");
      if (st.perm !== "granted" && st.perm !== "provisional") return { scheduled: false, reason: "denied", v: 1 };
      st.pending[a.id] = { at, title: a.title, body: a.body }; keep();
      return { scheduled: true, at, v: 1 };
    }),
    notifyCancel: call("notifyCancel", "cancel", (a) => { delete st.pending[a && a.id]; keep(); return { cancelled: true, v: 1 }; }),
  };
  const want = Array.isArray(live.methods) ? live.methods : live.methods === "none" ? [] : Object.keys(NOTIFY);
  want.forEach((m) => { N[m] = NOTIFY[m]; });
  C.Plugins = C.Plugins || {};
  C.Plugins.SonaSpeech = N;
  const P = C.Plugins.Purchases;
  if (P) {
    const realInfo = P.getCustomerInfo, realBuy = P.purchaseStoreProduct;
    const ent = (r) => Object.assign({ identifier: "full", isActive: true }, r);
    P.getCustomerInfo = function () {
      st.infos++; keep();
      if (live.rc === undefined) return realInfo.apply(this, arguments);
      if (live.rcInfo === "fail") return Promise.reject(fail("Error performing request.", "10"));
      if (live.rcInfo === "hang") return new Promise(() => {});
      return Promise.resolve({ customerInfo: { entitlements: { active: live.rc ? { full: ent(live.rc) } : {}, all: {} } } });
    };
    P.purchaseStoreProduct = function () {
      return realBuy.apply(this, arguments).then((res) => {
        try { const f = res.customerInfo.entitlements.active.full; if (f && live.rc) Object.assign(f, live.rc); } catch (e) {}
        return res;
      });
    };
  }
}

const srv = await serve();
const { base } = srv;
const browser = await chromium.launch(launchOpts());

// a phone: _phone.mjs's cfg, then the iPhone's side (null: none at all)
async function phoneWith(pcfg, icfg, opts = {}) {
  const o = await open(browser, base, pcfg);
  if (icfg) await o.context.addInitScript(ios, icfg);
  if (opts.clock) await o.page.clock.install();
  await o.page.goto(base + (opts.path || "/__blank.html"));
  await o.page.waitForFunction(() => !!window.Sona);
  o.ios = () => o.page.evaluate(() => window.__ios ? window.__ios.state() : null);
  o.calls = async (m) => ((await o.ios()) || { log: [] }).log.filter((e) => !m || e.m === m);
  o.key = () => o.page.evaluate(() => { try { return JSON.parse(localStorage.getItem("sona.notify.v1")); } catch (e) { return "bad"; } });
  return o;
}
const settle = (page, ms = 400) => page.waitForTimeout(ms);
// the page's own clock: the reminder moment is read against it
const now = (page) => page.evaluate(() => Date.now());

// ── 1. nothing without the plugin ──
{
  const probe = (page) => page.evaluate(async () => ({
    available: Sona.notifyAvailable(), state: Sona.notifyState(), ask: await Sona.notifyAsk(), on: Sona.trialReminderOn(),
    arm: await Sona.trialReminderArm(Date.now() + 3 * 86400000), sync: await Sona.trialReminderSync(true),
    key: localStorage.getItem("sona.notify.v1"),
    api: ["notifyAvailable", "notifyState", "notifyAsk", "trialReminderOn", "trialReminderArm", "trialReminderSync"].every((n) => typeof Sona[n] === "function"),
  }));
  const none = (r) => r.available === false && r.state === "unavailable" && r.ask === "unavailable" && r.on === false && r.arm === false && r.sync === "unavailable" && r.key === null;

  const web = await phoneWith({}, null);
  const w = await probe(web.page);
  ok("the six names are on Sona, for every page", w.api, w);
  ok("a browser: no reminder, nothing asked, nothing written", none(w), w);
  await web.context.close();

  const old = await phoneWith({ app: "buy", stamp: "post", setUp: true }, { methods: "none", perm: "granted" });
  await settle(old.page, 1900);
  const o = await probe(old.page);
  ok("an app build whose plugin has none of the four methods (1.0.8 and before): exactly as before", none(o) && (await old.calls()).length === 0, [o, await old.calls()]);
  await old.context.close();

  const half = await phoneWith({ app: "buy", stamp: "post", setUp: true }, { methods: ["notifySchedule"], perm: "granted" });
  await settle(half.page, 1900);
  const h = await probe(half.page);
  ok("…and one with half of them is no build that can remind: nothing called", none(h) && (await half.calls()).length === 0, [h, await half.calls()]);
  await half.context.close();

  const bare = await phoneWith({ app: "buy", stamp: "post", setUp: true }, { plugin: "none" });
  const b = await probe(bare.page);
  ok("…and an app with no SonaSpeech at all", none(b), b);
  await bare.context.close();

  const nobuy = await phoneWith({ app: "nobuy", setUp: true }, { perm: "prompt" });
  const n = await nobuy.page.evaluate(async () => ({ available: Sona.notifyAvailable(), sync: await Sona.trialReminderSync(true) }));
  ok("a build that can remind but has no App Store (1.0.4's kind): the check is not run, nothing cancelled",
    n.available === true && n.sync === "unavailable" && (await nobuy.calls("notifyCancel")).length === 0, [n, await nobuy.calls()]);
  await nobuy.context.close();
}

// ── 2. iOS's permission ──
{
  const fresh = await phoneWith({ app: "buy", stamp: "post", setUp: true }, { perm: "prompt" });
  await settle(fresh.page, 1900);
  ok("a fresh phone, iOS never asked: \"prompt\", read once as the page opened, kept on the phone",
    (await fresh.page.evaluate(() => Sona.notifyState())) === "prompt" && (await fresh.calls("notifyStatus")).length >= 1 && (await fresh.key()).state === "prompt", [await fresh.key(), await fresh.calls()]);
  ok("…the box is not shown by itself, and the store is not asked about a trial for a family who has not allowed reminders",
    (await fresh.calls("notifyAsk")).length === 0 && (await fresh.ios()).infos === 0 && (await fresh.calls("notifySchedule")).length === 0, await fresh.ios());
  const asked = await fresh.page.evaluate(async () => ({ r: await Sona.notifyAsk(), state: Sona.notifyState(), on: Sona.trialReminderOn(), key: JSON.parse(localStorage.getItem("sona.notify.v1")) }));
  ok("notifyAsk shows iOS's box once; Allow → \"granted\", kept, and reminders are on",
    asked.r === "granted" && asked.state === "granted" && asked.on === true && asked.key.state === "granted" && asked.key.asked > 0 && (await fresh.calls("notifyAsk")).length === 1, asked);
  await fresh.page.reload(); await fresh.page.waitForFunction(() => !!window.Sona);
  ok("…and the next page still knows, before iOS is asked again", (await fresh.page.evaluate(() => Sona.notifyState())) === "granted");
  await fresh.context.close();

  const deny = await phoneWith({ app: "nobuy", setUp: true }, { perm: "prompt", answer: "deny" });
  const d = await deny.page.evaluate(async () => ({ r: await Sona.notifyAsk(), state: Sona.notifyState(), on: Sona.trialReminderOn() }));
  ok("Don't Allow → \"denied\", and no reminder is promised", d.r === "denied" && d.state === "denied" && d.on === false, d);
  const again = await deny.page.evaluate(() => Sona.notifyAsk());
  ok("…asking again shows nothing new: iOS answers with the answer it has", again === "denied", again);
  await deny.context.close();

  for (const [perm, want] of [["granted", "granted"], ["denied", "denied"], ["provisional", "prompt"]]) {
    const p = await phoneWith({ app: "nobuy", setUp: true }, { perm });
    await settle(p.page);
    ok("iOS says " + perm + " on a phone that never told this page: notifyState() reads \"" + want + "\" once iOS has answered",
      (await p.page.evaluate(() => Sona.notifyState())) === want, await p.key());
    await p.context.close();
  }

  const broke = await phoneWith({ app: "nobuy", setUp: true }, { perm: "prompt", ask: "fail" });
  const br = await broke.page.evaluate(() => Sona.notifyAsk());
  ok("a bridge that refuses the ask: \"unavailable\" while iOS still says never asked, never a rejection", br === "unavailable", br);
  await broke.context.close();
  const thrown = await phoneWith({ app: "nobuy", setUp: true }, { perm: "granted", ask: "throw" });
  await settle(thrown.page);
  const th = await thrown.page.evaluate(() => Sona.notifyAsk());
  ok("…one that throws before any promise: what iOS says (\"granted\" here)", th === "granted", th);
  await thrown.context.close();

  // a bridge that never answers the box: setup is not held for good
  const hung = await phoneWith({ app: "nobuy", setUp: true }, { perm: "prompt", ask: "hang" }, { clock: true });
  await hung.page.evaluate(() => { window.__asked = "waiting"; Sona.notifyAsk().then((r) => { window.__asked = r; }); });
  await hung.page.clock.runFor(59000);
  const mid = await hung.page.evaluate(() => window.__asked);
  await hung.page.clock.runFor(1500);
  const late = await hung.page.evaluate(() => window.__asked);
  ok("an ask that never answers lets the screen go on after a minute (\"unavailable\"), not before",
    mid === "waiting" && late === "unavailable", [mid, late]);
  await hung.page.evaluate(() => window.__ios.set({ ask: "ok" }));
  await hung.page.clock.runFor(100);
  ok("…and the answer that comes late is still kept", (await hung.page.evaluate(() => Sona.notifyState())) === "granted", await hung.key());
  await hung.context.close();
}

// ── 3. arming ──
{
  const p = await phoneWith({ app: "nobuy", setUp: true }, { perm: "granted" });
  await settle(p.page);
  const t0 = await now(p.page);
  const end = t0 + 3 * DAY;
  const r = await p.page.evaluate((e) => Sona.trialReminderArm(e), end);
  const sched = await p.calls("notifySchedule"), st = await p.ios(), key = await p.key();
  const a = sched[0] && sched[0].a;
  ok("a trial that ends in 3 days: one reminder, a day before its end, to the millisecond", r === true && sched.length === 1 && a.at === end - DAY, sched);
  ok("…its words are the fixed ones: \"Sona\" / \"Your free trial ends tomorrow.\"", a && a.title === "Sona" && a.body === "Your free trial ends tomorrow.", a);
  ok("…the request carries an id, a moment and those words, and nothing else", a && JSON.stringify(Object.keys(a).sort()) === JSON.stringify(["at", "body", "id", "title"]) && a.id === ID, a);
  ok("…NEVER A CHILD'S NAME: Mia's name is on this phone and in no part of it", a && !/Mia/.test(JSON.stringify(a)) && !/[\d$]/.test(a.title + a.body), a);
  ok("…iOS holds it, and the phone notes when and for which end", st.pending[ID] && st.pending[ID].at === end - DAY && key.arm === end - DAY && key.end === end, [st.pending, key]);
  const end2 = t0 + 7 * DAY;
  await p.page.evaluate((e) => Sona.trialReminderArm(e), end2);
  const st2 = await p.ios();
  ok("armed again for another end: still ONE request, the new one (the same id replaces it)",
    Object.keys(st2.pending).length === 1 && st2.pending[ID].at === end2 - DAY, st2.pending);
  const edge = await p.page.evaluate((t) => Promise.all([
    Sona.trialReminderArm(t + 25 * 3600000 - 60000),  // the moment 59 minutes away
    Sona.trialReminderArm(t + 20 * 3600000),           // within the last day: the moment has gone
    Sona.trialReminderArm(t - 3600000),                // already over
    Sona.trialReminderArm(NaN), Sona.trialReminderArm("soon"), Sona.trialReminderArm(0), Sona.trialReminderArm(undefined),
    Sona.trialReminderArm(t + 500 * 86400000),         // not a trial: years away
  ]), t0);
  ok("never in the past and never within the hour: a moment under an hour away, past, or not a time sets nothing",
    edge.every((x) => x === false) && (await p.calls("notifySchedule")).length === 2, [edge, (await p.calls("notifySchedule")).length]);
  const ok25 = await p.page.evaluate((t) => Sona.trialReminderArm(t + 25 * 3600000 + 120000), await now(p.page));
  ok("…one an hour and two minutes away is set", ok25 === true, ok25);

  // iOS's setting changed behind the app's back: iOS refuses, nothing is noted
  await p.page.evaluate((t) => { window.__ios.perm("denied"); return Sona.trialReminderArm(t); }, t0 + 5 * DAY);
  const k2 = await p.key();
  ok("iOS refusing the request (notifications turned off in Settings) notes nothing", k2.end !== t0 + 5 * DAY, k2);
  await p.context.close();

  for (const perm of ["denied", "prompt"]) {
    const q = await phoneWith({ app: "nobuy", setUp: true }, { perm });
    await settle(q.page);
    const rr = await q.page.evaluate(() => Sona.trialReminderArm(Date.now() + 3 * 86400000));
    ok("notifications " + (perm === "denied" ? "refused" : "never asked") + ": nothing is armed, iOS is not even handed a request",
      rr === false && (await q.calls("notifySchedule")).length === 0, await q.calls());
    await q.context.close();
  }

  const slow = await phoneWith({ app: "nobuy", setUp: true }, { perm: "granted", schedule: "hang" });
  await settle(slow.page);
  const t1 = Date.now();
  const sr = await slow.page.evaluate(() => Sona.trialReminderArm(Date.now() + 3 * 86400000));
  ok("a bridge that never answers the request: false within seconds, never a page held", sr === false && Date.now() - t1 < 6000, [sr, Date.now() - t1]);
  await slow.context.close();

  // trialReminderOn(plan): the price screen's line is true only for a trial it can remind about
  const pl = await phoneWith({ app: "nobuy", setUp: true }, { perm: "granted" });
  await settle(pl.page);
  const on = await pl.page.evaluate(() => {
    const free = (n, unit) => ({ state: "free", free: { n, unit, text: n + " " + unit + "s" }, price: "$9.99", per: "month", sure: true });
    return { none: Sona.trialReminderOn(), three: Sona.trialReminderOn(free(3, "day")), week: Sona.trialReminderOn(free(7, "day")), one: Sona.trialReminderOn(free(1, "day")),
      paid: Sona.trialReminderOn({ state: "paid", price: "$9.99", per: "month" }), nul: Sona.trialReminderOn(null) };
  });
  ok("trialReminderOn(plan): a 3-day or 7-day trial yes; a 1-day trial (its moment gone at once), a charge today or no plan no",
    on.none === true && on.three === true && on.week === true && on.one === false && on.paid === false && on.nul === false, on);
  await pl.context.close();
}

// ── 4. the one hook in buyPlan ──
{
  // a family who owes the price (post), notifications allowed at setup
  const buyer = async (icfg, pcfg) => {
    const o = await phoneWith(Object.assign({ app: "buy", stamp: "post", setUp: true }, pcfg || {}), Object.assign({ perm: "granted" }, icfg));
    await settle(o.page, 1900);            // the page's own daily check has run (nothing on yet)
    o.before = (await o.calls("notifySchedule")).length;
    return o;
  };
  // RevenueCat's record changes only once the price is on screen: a record
  // that already held Premium would make the price screen say "You already
  // have Sona Premium" and sell nothing
  const buy = (o, rc) => o.page.evaluate(async (rc) => {
    const plan = await Sona.storePlan();
    if (rc !== undefined) window.__ios.set({ rc });
    const t = Date.now();
    let res; try { res = await Sona.buyPlan(plan); } catch (e) { res = { err: e.code || e.message }; }
    return { res, ms: Date.now() - t, plan: { state: plan.state }, t };
  }, rc);
  const armedAt = async (o, ms = 2500) => {
    await o.page.waitForTimeout(ms);
    const s = (await o.calls("notifySchedule")).slice(o.before);
    return s.length ? s[s.length - 1].a.at : null;
  };

  let o = await buyer({});
  const T = (await now(o.page)) + 3 * DAY + 7 * 60000;
  let b = await buy(o, { periodType: "TRIAL", expirationDateMillis: T, willRenew: true });
  let at = await armedAt(o);
  ok("a purchase that starts the free trial arms the reminder for RevenueCat's own end, a day before it",
    b.res && b.res.ok === true && at === T - DAY, [b, at]);
  ok("…once", (await o.calls("notifySchedule")).length - o.before === 1, await o.calls("notifySchedule"));
  await o.context.close();

  o = await buyer({});
  b = await buy(o, { periodType: "TRIAL", willRenew: true });
  at = await armedAt(o);
  ok("RevenueCat gives no end: the store's own free time from the purchase (3 days), a day before",
    b.res.ok && at && Math.abs(at - (b.t + 3 * DAY - DAY)) < 15000, [b, at && (at - b.t) / HOUR]);
  await o.context.close();

  o = await buyer({}, { store: { monthly: { price: "$9.99", free: "P1W" }, annual: { price: "$59.99", free: "P1W" } } });
  b = await buy(o, { periodType: "TRIAL", willRenew: true });
  at = await armedAt(o);
  ok("…a week free (the 7-day trial approved on 19 Oct): six days after the purchase",
    b.res.ok && at && Math.abs(at - (b.t + 6 * DAY)) < 15000, [b, at && (at - b.t) / HOUR]);
  await o.context.close();

  o = await buyer({});
  b = await buy(o, undefined);    // RevenueCat's answer names no period at all: the card sold free days
  at = await armedAt(o);
  ok("Apple's answer names no period: the card sold free days, so it is a trial (as the list's plan post decides)",
    b.res.ok && at && Math.abs(at - (b.t + 2 * DAY)) < 15000, [b, at]);
  await o.context.close();

  o = await buyer({ rcInfo: "fail" });
  b = await buy(o, { periodType: "TRIAL", expirationDateMillis: Date.now() + 3 * DAY });
  at = await armedAt(o);
  ok("RevenueCat's record does not answer after the purchase: still armed, from the store's free time",
    b.res.ok && at && Math.abs(at - (b.t + 2 * DAY)) < 15000, [b, at]);
  await o.context.close();

  o = await buyer({}, { store: { monthly: { price: "$9.99" }, annual: { price: "$59.99" } } });
  b = await buy(o, { periodType: "NORMAL", expirationDateMillis: Date.now() + 30 * DAY, willRenew: true });
  at = await armedAt(o);
  ok("charged today (no free days): nothing armed", b.plan.state === "paid" && b.res.ok && at === null, [b, at]);
  await o.context.close();

  o = await buyer({}, { buy: "cancel" });
  b = await buy(o, { periodType: "TRIAL", expirationDateMillis: Date.now() + 3 * DAY });
  at = await armedAt(o, 1200);
  ok("a purchase the parent cancelled: nothing armed", b.res.err === "cancelled" && at === null, [b, at]);
  await o.context.close();

  o = await buyer({ perm: "denied" });
  b = await buy(o, { periodType: "TRIAL", expirationDateMillis: Date.now() + 3 * DAY });
  at = await armedAt(o, 1200);
  ok("a trial for a family who did not allow notifications: nothing armed, nothing handed to iOS", b.res.ok && at === null && (await o.calls("notifySchedule")).length === 0, [b, at]);
  await o.context.close();

  o = await buyer({ schedule: "hang" });
  b = await buy(o, { periodType: "TRIAL", expirationDateMillis: Date.now() + 3 * DAY });
  ok("buyPlan never waits on the reminder: a bridge that never answers it, and buyPlan has answered { ok: true } at once",
    b.res && b.res.ok === true && Object.keys(b.res).length === 1 && b.ms < 1500, b);
  await o.context.close();
}

// ── 5. the daily check ──
{
  const o = await phoneWith({ app: "buy", stamp: "post", setUp: true }, { perm: "granted" });
  await settle(o.page);
  const t0 = await now(o.page);
  const T = t0 + 5 * DAY;
  const sync = (rc, force = true) => o.page.evaluate(([rc, force]) => { if (rc !== "keep") window.__ios.set({ rc }); return Sona.trialReminderSync(force); }, [rc, force]);
  const pending = async () => (await o.ios()).pending[ID] || null;

  await o.page.evaluate((T) => { window.__ios.set({ rc: { periodType: "TRIAL", expirationDateMillis: T, willRenew: true } }); localStorage.removeItem("sona.notify.v1"); }, T);
  await o.page.reload(); await o.page.waitForFunction(() => !!window.Sona);
  await settle(o.page, 2300);
  const p1 = await pending(), k1 = await o.key(), infos1 = (await o.ios()).infos;
  ok("a page opens on a phone whose trial is on: the reminder is armed from RevenueCat's end, by itself",
    p1 && p1.at === T - DAY && k1.sync > 0 && k1.arm === T - DAY, [p1, k1]);
  await o.page.reload(); await o.page.waitForFunction(() => !!window.Sona);
  await settle(o.page, 2300);
  const later = await o.page.evaluate(() => Sona.trialReminderSync(false));
  ok("…ONCE A DAY: the next page asks the store nothing (\"later\")", later === "later" && (await o.ios()).infos === infos1, [later, (await o.ios()).infos, infos1]);
  await o.page.evaluate(() => { const k = JSON.parse(localStorage.getItem("sona.notify.v1")); k.sync = Date.now() - 25 * 3600000; localStorage.setItem("sona.notify.v1", JSON.stringify(k)); });
  await o.page.reload(); await o.page.waitForFunction(() => !!window.Sona);
  await settle(o.page, 2300);
  ok("…a day later it asks again, and iOS still holds one request", (await o.ios()).infos === infos1 + 1 && Object.keys((await o.ios()).pending).length === 1, await o.ios());
  // the app comes back to the front a day later, without a new page
  await o.page.evaluate(() => { const k = JSON.parse(localStorage.getItem("sona.notify.v1")); k.sync = Date.now() - 25 * 3600000; localStorage.setItem("sona.notify.v1", JSON.stringify(k)); document.dispatchEvent(new Event("visibilitychange")); });
  await settle(o.page, 600);
  ok("…and when the app comes back to the front on a later day", (await o.ios()).infos === infos1 + 2, (await o.ios()).infos);

  const iso = await sync({ periodType: "TRIAL", expirationDate: new Date(t0 + 4 * DAY).toISOString(), willRenew: true });
  ok("RevenueCat's end as a date string (no millis) is read too", iso === "armed" && (await pending()).at === t0 + 3 * DAY, [iso, await pending()]);

  const conv = await sync({ periodType: "NORMAL", expirationDateMillis: t0 + 30 * DAY, willRenew: true });
  ok("THE TRIAL BECAME A PAID PLAN: the reminder is taken back", conv === "cancelled" && (await pending()) === null && (await o.key()).arm == null, [conv, await pending(), await o.key()]);
  await sync({ periodType: "TRIAL", expirationDateMillis: T, willRenew: true });
  const gone = await sync({ periodType: "TRIAL", expirationDateMillis: T, willRenew: false });
  ok("…the parent already cancelled the trial: nothing left to tell, taken back", gone === "cancelled" && (await pending()) === null, gone);
  await sync({ periodType: "TRIAL", expirationDateMillis: T, willRenew: true });
  const ended = await sync(null);
  ok("…no Premium any more: taken back", ended === "cancelled" && (await pending()) === null, ended);

  await sync({ periodType: "TRIAL", expirationDateMillis: T, willRenew: true });
  const unsure = await sync({ willRenew: true });
  ok("Premium whose period RevenueCat does not name: what is set stays (\"kept\")", unsure === "kept" && (await pending()).at === T - DAY, unsure);
  const noEnd = await sync({ periodType: "TRIAL", willRenew: true });
  ok("…a trial with no end given: what is set stays", noEnd === "kept" && (await pending()).at === T - DAY, noEnd);

  // within the last day: the moment has gone
  const t1 = await now(o.page);
  await o.page.evaluate((t) => { const k = JSON.parse(localStorage.getItem("sona.notify.v1")); k.end = t + 20 * 3600000 + 600000; localStorage.setItem("sona.notify.v1", JSON.stringify(k)); }, t1);
  const near = await sync({ periodType: "TRIAL", expirationDateMillis: t1 + 20 * 3600000, willRenew: true });
  ok("the trial ends within the day, the reminder set for (minutes from) that end: \"near\", and it stays to be shown",
    near === "near" && (await pending()) !== null, [near, await pending()]);
  const moved = await sync({ periodType: "TRIAL", expirationDateMillis: t1 + 10 * 3600000, willRenew: true });
  ok("…a trial that moved to end hours sooner: the old reminder would name the wrong day, so it goes", moved === "near" && (await pending()) === null, [moved, await pending()]);

  await sync({ periodType: "TRIAL", expirationDateMillis: T, willRenew: true });
  const k3 = await o.key();
  await o.page.evaluate(() => window.__ios.set({ rcInfo: "fail" }));
  const err = await sync("keep");
  ok("the store does not answer: \"error\", nothing taken back, and the day is not counted as checked",
    err === "error" && (await pending()) !== null && (await o.key()).sync === k3.sync, [err, await o.key(), k3]);
  await o.page.evaluate(() => window.__ios.set({ rcInfo: "ok" }));

  // notifications turned off: the store is not asked at all
  await o.page.evaluate(() => window.__ios.perm("denied"));
  const i0 = (await o.ios()).infos;
  const off = await sync("keep");
  ok("notifications turned off in iOS Settings: \"off\", and the store is not asked", off === "off" && (await o.ios()).infos === i0, [off, (await o.ios()).infos, i0]);
  await o.context.close();
}

// ── 6. the key stays on this phone ──
{
  const o = await phoneWith({ app: "nobuy", setUp: true }, { perm: "granted" });
  await settle(o.page);
  await o.page.evaluate(() => Sona.trialReminderArm(Date.now() + 3 * 86400000));
  const ex = await o.page.evaluate(() => ({ key: localStorage.getItem("sona.notify.v1"), backup: Sona.exportString() }));
  ok("A BACKUP NEVER CARRIES IT: the phone holds sona.notify.v1, the backup does not", !!ex.key && !/sona\.notify/.test(ex.backup), ex.key);
  await o.context.close();
  const web = await phoneWith({}, null);
  const im = await web.page.evaluate((b) => {
    const data = JSON.parse(b).data;
    data["sona.notify.v1"] = JSON.stringify({ state: "granted", arm: Date.now() + 86400000, end: Date.now() + 2 * 86400000 });
    data["sona.notify.v1@k2"] = data["sona.notify.v1"];
    const r = Sona.importData({ app: "sona", v: 1, data });
    return { ok: r && r.ok !== false, key: localStorage.getItem("sona.notify.v1"), slot: localStorage.getItem("sona.notify.v1@k2"), name: (Sona.getProfile() || {}).childName };
  }, ex.backup);
  ok("…and a backup that holds one (hand-made) is let in without it: another phone's iOS answer, or a reminder iOS does not hold here, never arrives",
    im.ok && im.key === null && im.slot === null && im.name === "Mia", im);
  await web.context.close();
}

// ── 7. the source ──
{
  const src = readFileSync(ROOT + "/sona.js", "utf8");
  const a = src.indexOf("// ── NOTIFY1"), z = src.indexOf("// PLAN-WORDS-BEGIN", a);
  const block = a > 0 && z > a ? src.slice(a, z) : "";
  const code = block.replace(/\/\/[^\n]*/g, "");
  ok("NOTIFY1 is one block, outside the plan words (whose sentences stay the card's alone)", block.length > 4000 && src.indexOf("// ── NOTIFY1", a + 1) === -1 && src.indexOf("// PLAN-WORDS-END") > z);
  ok("NOTHING LEAVES THE PHONE: no fetch, beacon, event or address in the block",
    !/fetch\(|sendBeacon|\btrack\(|XMLHttpRequest|parentEmail|\/api\//.test(code), (code.match(/[^\n]*(fetch\(|sendBeacon|\btrack\(|XMLHttpRequest|parentEmail|\/api\/)[^\n]*/) || [""])[0]);
  ok("…and it never reads a child: no name, profile, kids list or slot", !/childName|kidName|getProfile|_kids|profile|kkey|PKEY/.test(code), (code.match(/[^\n]*(childName|kidName|getProfile|_kids|profile|kkey|PKEY)[^\n]*/) || [""])[0]);
  ok("…its words are one fixed pair, handed to iOS as they are",
    /const TRIAL_REMIND = \{ title: "[^"$\d]+", body: "[^"$\d]+" \};/.test(code) && /title: TRIAL_REMIND\.title, body: TRIAL_REMIND\.body/.test(code) && (code.match(/P\.notifySchedule\(/g) || []).length === 1);
  const buy = (src.match(/\n  function buyPlan\(plan\) \{[\s\S]*?\n  \}\n/) || [""])[0];
  ok("buyPlan has ONE hook, on its success path, right after the list's plan post",
    (buy.match(/_trialRemindBought\(/g) || []).length === 1 && /_tellPlan\(r && r\.period, plan\); _trialRemindBought\(r && r\.period, plan\);/.test(buy)
    && (src.match(/_trialRemindBought\(/g) || []).length === 2, buy.slice(0, 400));
  const noExport = (src.match(/const NO_EXPORT = \[[^\]]*\]/) || [""])[0], noImport = (src.match(/const NO_IMPORT = \[[^\]]*\]/) || [""])[0];
  const perKid = (src.match(/const PER_KID = new Set\(\[[\s\S]*?\]\);/) || [""])[0];
  ok("sona.notify.v1 is on NO_EXPORT and NO_IMPORT, and is the phone's, not a child's", /"sona\.notify\.v1"/.test(noExport) && /"sona\.notify\.v1"/.test(noImport) && perKid.length > 100 && !/notify/.test(perKid));
  ok("the six names are on the export line", /global\.Sona = \{[^\n]*\bnotifyAvailable, notifyState, notifyAsk, trialReminderOn, trialReminderArm, trialReminderSync, [^\n]*\};/.test(src));
  ok("the daily check runs only where the plugin can remind (a browser never schedules a timer for it)",
    /if \(notifyAvailable\(\)\) \{\s*_notifyRefresh\(\);\s*setTimeout\(\(\) => \{ trialReminderSync\(false\); \}, 1500\);/.test(code));
}

await browser.close(); await srv.close();
console.log(fails ? "\n" + passes + " passed, " + fails + " FAILURES" : "\nALL GREEN (" + passes + ")");
process.exit(fails ? 1 : 0);
