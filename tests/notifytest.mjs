// NOTIFY1: one reminder before the free trial ends (22 Oct 2026): 30 hours
// before, so a cancel after it still counts (Apple's line is 24 hours).
//
// Travis: "can we add push notifications and have that be a step in the
// onboarding where we ask them to turn it on to notify them a day before
// their trial ends". It is a LOCAL notification set on the phone through
// Sona's own plugin (SonaSpeech: notifyStatus, notifyAsk, notifySchedule,
// notifyCancel, iOS 1.0.9). heartest holds the Swift; this plays sona.js
// against a fake of those four methods (_notify.mjs) that keeps what iOS
// keeps between page loads (the permission, the waiting requests), on the
// shared fake phone's App Store (_phone.mjs) for RevenueCat's side:
//   1. nothing without the plugin: a browser, an older build, half a plugin;
//   2. iOS's permission: never asked, allowed, refused, quiet, a bridge that
//      refuses or never answers (setup is never held for good), the real
//      answer setup can wait for (notifyRefresh), a bridge that answers
//      "not implemented" (no build that can remind, for the page), and the
//      fake added onto the fake microphone's plugin, never over it;
//   3. arming: 30 hours before the end, never in the past or within the hour,
//      one request however often it is armed, the fixed words (no name);
//      the price screen's promise only for a row SURE of its free days;
//   4. the one hook in buyPlan: a trial purchase arms AT ONCE, from the
//      purchase's own end (or the store's own free time), corrected from
//      RevenueCat's record when the purchase named none; nothing else arms,
//      buyPlan never waits; THE RACE: the page leaves 1.2 s after the sale
//      while the store hangs, and a check still waiting from before the sale
//      never takes the new reminder back;
//   4b. the price screen's line follows iOS's own answer once it comes;
//   4c. setup's reminder screen on the real block: only for a buyer the
//      store is SURE it gives free days (plan.sure, as the price line), on
//      a build that can, whom iOS has not asked;
//   4d. Ask to Buy approved, and Restore after "not-entitled": the reminder
//      is set before the price page leaves (Sona.trialReminderSold);
//   5. the daily check: arms a trial, cancels once none is on (paid, ended,
//      cancelled by the parent), once a day, never on a store that did not
//      answer or hangs (asked again at most once an hour), never asks the store for a
//      family who did not allow it, and never on Home (Home only reads);
//   6. the key stays on this phone: never exported, never imported;
//   7. the source: nothing leaves the phone, nothing reads a child.
import { readFileSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";
import { serve, open, STORES, setupWalk } from "./_phone.mjs";
import { iosNotify as ios } from "./_notify.mjs";
import { nativeMic } from "./_nativemic.mjs";

let fails = 0, passes = 0;
const ok = (n, p, extra) => { if (p) passes++; else fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (typeof extra === "string" ? extra : JSON.stringify(extra)))); };

const DAY = 86400000, HOUR = 3600000;
// the reminder's lead: 30 hours before the end, so a cancel after it still
// counts (Apple's line is 24 hours); sona.js's TRIAL_REMIND_LEAD_MS
const LEAD = 30 * HOUR;
const ID = "sona-trial-end";

const srv = await serve();
const { base } = srv;
const browser = await chromium.launch(launchOpts());

// a phone: _phone.mjs's cfg, then (opts.nm) the fake microphone's
// SonaSpeech, then the iPhone's side of the reminder (null: none at all)
async function phoneWith(pcfg, icfg, opts = {}) {
  const o = await open(browser, base, pcfg);
  if (opts.nm) await o.context.addInitScript(nativeMic, Object.assign({ world: false }, opts.nm));
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
    available: Sona.notifyAvailable(), state: Sona.notifyState(), refresh: await Sona.notifyRefresh(), ask: await Sona.notifyAsk(), on: Sona.trialReminderOn(),
    arm: await Sona.trialReminderArm(Date.now() + 3 * 86400000), sync: await Sona.trialReminderSync(true),
    key: localStorage.getItem("sona.notify.v1"),
    api: ["notifyAvailable", "notifyState", "notifyRefresh", "notifyAsk", "trialReminderOn", "trialReminderArm", "trialReminderSync"].every((n) => typeof Sona[n] === "function"),
  }));
  const none = (r) => r.available === false && r.state === "unavailable" && r.refresh === "unavailable" && r.ask === "unavailable" && r.on === false && r.arm === false && r.sync === "unavailable" && r.key === null;

  const web = await phoneWith({}, null);
  const w = await probe(web.page);
  ok("the seven names are on Sona, for every page", w.api, w);
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

  // iOS holds an answer this page has not heard yet (site data cleared, or a
  // reinstall iOS remembers): notifyState() alone guesses "prompt", and setup
  // would show the reminder screen to a parent iOS already asked
  const known = await phoneWith({ app: "nobuy", setUp: true }, { perm: "denied", status: "hang" });
  const guess = await known.page.evaluate(() => Sona.notifyState());
  const real = await known.page.evaluate(async () => {
    const p = Sona.notifyRefresh();
    setTimeout(() => window.__ios.set({ status: "ok" }), 300);
    return [await p, Sona.notifyState()];
  });
  ok("notifyState() alone is a guess while iOS has not answered (\"prompt\"); Sona.notifyRefresh() waits for iOS's real answer (\"denied\")",
    guess === "prompt" && real[0] === "denied" && real[1] === "denied", [guess, real]);
  await known.context.close();
  const mute = await phoneWith({ app: "nobuy", setUp: true }, { perm: "granted", status: "hang" });
  const m0 = Date.now();
  const mr = await mute.page.evaluate(() => Sona.notifyRefresh());
  ok("…a bridge that never answers it: notifyRefresh() gives what was known within a few seconds, never a rejection", mr === "prompt" && Date.now() - m0 < 4500, [mr, Date.now() - m0]);
  await mute.context.close();

  // a bridge that answers a method the build does not have with "not implemented"
  const unimpl = await phoneWith({ app: "buy", stamp: "post", setUp: true }, { perm: "granted", status: "unimpl" });
  await settle(unimpl.page, 1900);
  const u = await unimpl.page.evaluate(async () => ({ available: Sona.notifyAvailable(), refresh: await Sona.notifyRefresh(), state: Sona.notifyState(), ask: await Sona.notifyAsk(),
    on: Sona.trialReminderOn(), arm: await Sona.trialReminderArm(Date.now() + 3 * 86400000), sync: await Sona.trialReminderSync(true) }));
  ok("notifyStatus answered \"not implemented\": no build that can remind, for the rest of the page (as the mic's broken mark)",
    u.available === false && u.refresh === "unavailable" && u.state === "unavailable" && u.ask === "unavailable" && u.on === false && u.arm === false && u.sync === "unavailable", u);
  ok("…asked once, as the page opened, and nothing called after it", (await unimpl.calls()).map((e) => e.m).join() === "notifyStatus", await unimpl.calls());
  await unimpl.context.close();
  const prox = await phoneWith({ app: "buy", stamp: "post", setUp: true }, { methods: "none", perm: "granted" }, { nm: { mode: "proxy" } });
  await settle(prox.page, 1900);
  const pr = await prox.page.evaluate(async () => ({ available: Sona.notifyAvailable(), refresh: await Sona.notifyRefresh(), state: Sona.notifyState(),
    sync: await Sona.trialReminderSync(true), key: localStorage.getItem("sona.notify.v1"), unknown: window.__nm.unknown.slice() }));
  ok("AN OLD BUILD BEHIND A BRIDGE THAT ANSWERS EVERY METHOD (nativemictest's proxy): one \"not implemented\" to notifyStatus, then no reminder offered, set or checked, and nothing written",
    pr.available === false && pr.refresh === "unavailable" && pr.state === "unavailable" && pr.sync === "unavailable" && pr.key === null
    && pr.unknown.filter((k) => /^notify/.test(k)).join() === "notifyStatus", pr);
  await prox.context.close();
  const both = await phoneWith({ app: "buy", stamp: "post", setUp: true }, { perm: "granted" }, { nm: { mode: "new" } });
  const bo = await both.page.evaluate(() => { const S = Capacitor.Plugins.SonaSpeech; return { mic: ["micPermission", "micOpen", "micClose"].every((m) => typeof S[m] === "function"), notify: Sona.notifyAvailable(), same: S === window.__nm.plugin }; });
  ok("the fake reminder (_notify.mjs) is added onto the fake microphone's SonaSpeech, never over it", bo.mic && bo.notify && bo.same, bo);
  await both.context.close();
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
  ok("a trial that ends in 3 days: one reminder, 30 hours before its end (a cancel after it still counts), to the millisecond", r === true && sched.length === 1 && a.at === end - LEAD, sched);
  ok("…its words are the fixed ones: \"Sona\" / \"Your free trial ends tomorrow.\"", a && a.title === "Sona" && a.body === "Your free trial ends tomorrow.", a);
  ok("…the request carries an id, a moment and those words, and nothing else", a && JSON.stringify(Object.keys(a).sort()) === JSON.stringify(["at", "body", "id", "title"]) && a.id === ID, a);
  ok("…NEVER A CHILD'S NAME: Mia's name is on this phone and in no part of it", a && !/Mia/.test(JSON.stringify(a)) && !/[\d$]/.test(a.title + a.body), a);
  ok("…iOS holds it, and the phone notes when and for which end", st.pending[ID] && st.pending[ID].at === end - LEAD && key.arm === end - LEAD && key.end === end, [st.pending, key]);
  const end2 = t0 + 7 * DAY;
  await p.page.evaluate((e) => Sona.trialReminderArm(e), end2);
  const st2 = await p.ios();
  ok("armed again for another end: still ONE request, the new one (the same id replaces it)",
    Object.keys(st2.pending).length === 1 && st2.pending[ID].at === end2 - LEAD, st2.pending);
  const edge = await p.page.evaluate((t) => Promise.all([
    Sona.trialReminderArm(t + 31 * 3600000 - 60000),  // the moment 59 minutes away
    Sona.trialReminderArm(t + 26 * 3600000),           // within the last 30 hours: the moment has gone
    Sona.trialReminderArm(t - 3600000),                // already over
    Sona.trialReminderArm(NaN), Sona.trialReminderArm("soon"), Sona.trialReminderArm(0), Sona.trialReminderArm(undefined),
    Sona.trialReminderArm(t + 500 * 86400000),         // not a trial: years away
  ]), t0);
  ok("never in the past and never within the hour: a moment under an hour away, past, or not a time sets nothing",
    edge.every((x) => x === false) && (await p.calls("notifySchedule")).length === 2, [edge, (await p.calls("notifySchedule")).length]);
  const ok25 = await p.page.evaluate((t) => Sona.trialReminderArm(t + 31 * 3600000 + 120000), await now(p.page));
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
    const unsure = Object.assign(free(3, "day"), { sure: false }), bare = free(3, "day"); delete bare.sure;
    return { none: Sona.trialReminderOn(), three: Sona.trialReminderOn(free(3, "day")), week: Sona.trialReminderOn(free(7, "day")), one: Sona.trialReminderOn(free(1, "day")),
      paid: Sona.trialReminderOn({ state: "paid", price: "$9.99", per: "month" }), nul: Sona.trialReminderOn(null),
      unsure: Sona.trialReminderOn(unsure), bare: Sona.trialReminderOn(bare), truthy: Sona.trialReminderOn(Object.assign(free(3, "day"), { sure: 1 })) };
  });
  ok("trialReminderOn(plan): a 3-day or 7-day trial yes; a 1-day trial (its moment gone at once), a charge today or no plan no",
    on.none === true && on.three === true && on.week === true && on.one === false && on.paid === false && on.nul === false, on);
  ok("…AND ONLY A ROW SURE OF ITS FREE DAYS (plan.sure === true): a row that only may be free (\"Only new subscribers get 3 days free. Otherwise Apple charges $9.99 today.\") promises no reminder",
    on.unsure === false && on.bare === false && on.truthy === false, on);
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
  // have Sona Premium" and sell nothing. patch: __ios.set() at that moment.
  // atOnce: what iOS had been handed by the time buyPlan answered (before any
  // page could leave); i0, i1: RevenueCat lookups before the sale and then.
  const buy = (o, patch) => o.page.evaluate(async (patch) => {
    const plan = await Sona.storePlan();
    if (patch) window.__ios.set(patch);
    const sched = () => window.__ios.state().log.filter((e) => e.m === "notifySchedule");
    const n0 = sched().length, i0 = window.__ios.state().infos;
    const t = Date.now();
    let res; try { res = await Sona.buyPlan(plan); } catch (e) { res = { err: e.code || e.message }; }
    const now = sched().slice(n0);
    return { res, ms: Date.now() - t, plan: { state: plan.state, sure: plan.sure }, t, i0, atOnce: now.length ? now[now.length - 1].a.at : null, armsAtOnce: now.length };
  }, patch);
  const armedAt = async (o, ms = 2500) => {
    await o.page.waitForTimeout(ms);
    const s = (await o.calls("notifySchedule")).slice(o.before);
    return s.length ? s[s.length - 1].a.at : null;
  };
  const near = (x, want) => !!x && Math.abs(x - want) < 15000;

  let o = await buyer({});
  const T = (await now(o.page)) + 3 * DAY + 7 * 60000;
  let b = await buy(o, { rc: { periodType: "TRIAL", expirationDateMillis: T, willRenew: true } });
  let at = await armedAt(o);
  ok("a purchase that starts the free trial arms the reminder AT ONCE (before buyPlan has even answered), for the end in the purchase's own record, 30 hours before it",
    b.res && b.res.ok === true && b.atOnce === T - LEAD && at === T - LEAD, [b, at]);
  ok("…once, and with no second lookup: the purchase named the end", (await o.calls("notifySchedule")).length - o.before === 1 && (await o.ios()).infos === b.i0, [await o.calls("notifySchedule"), (await o.ios()).infos, b.i0]);
  await o.context.close();

  o = await buyer({});
  const T2 = (await now(o.page)) + 3 * DAY + 5 * HOUR;
  b = await buy(o, { rcBuy: { periodType: "TRIAL", willRenew: true }, rc: { periodType: "TRIAL", expirationDateMillis: T2, willRenew: true } });
  at = await armedAt(o);
  ok("the purchase names the free days but no end: armed at once from the store's own free time (3 days)…", b.res.ok && near(b.atOnce, b.t + 3 * DAY - LEAD), [b, b.atOnce && (b.atOnce - b.t) / HOUR]);
  ok("…then corrected to RevenueCat's own end once its record answers", at === T2 - LEAD && (await o.ios()).infos === b.i0 + 1, [at, T2 - LEAD]);
  await o.context.close();

  o = await buyer({});
  b = await buy(o, { rc: { periodType: "TRIAL", willRenew: true } });
  at = await armedAt(o);
  ok("RevenueCat gives no end anywhere: the store's own free time from the purchase (3 days), 30 hours before",
    b.res.ok && near(b.atOnce, b.t + 3 * DAY - LEAD) && at === b.atOnce, [b, at && (at - b.t) / HOUR]);
  await o.context.close();

  o = await buyer({}, { store: { monthly: { price: "$9.99", free: "P1W" }, annual: { price: "$59.99", free: "P1W" } } });
  b = await buy(o, { rc: { periodType: "TRIAL", willRenew: true } });
  at = await armedAt(o);
  ok("…a week free (the 7-day trial approved on 19 Oct): six days after the purchase",
    b.res.ok && near(b.atOnce, b.t + 7 * DAY - LEAD) && at === b.atOnce, [b, at && (at - b.t) / HOUR]);
  await o.context.close();

  o = await buyer({});
  b = await buy(o, undefined);    // RevenueCat's answer names no period at all: the card sold free days
  at = await armedAt(o);
  ok("Apple's answer names no period: a card SURE it sold free days makes it a trial (as the list's plan post decides)",
    b.plan.sure === true && b.res.ok && near(b.atOnce, b.t + 3 * DAY - LEAD) && at === b.atOnce, [b, at]);
  await o.context.close();

  o = await buyer({}, { elig: "missing" });
  b = await buy(o, undefined);
  at = await armedAt(o);
  ok("…but a card that only MAY have sold free days (eligibility unknown) sets nothing on its own word, and RevenueCat names no period either: nothing armed",
    b.plan.state === "free" && b.plan.sure === false && b.res.ok && b.atOnce === null && at === null, [b, at]);
  await o.context.close();
  o = await buyer({}, { elig: "missing" });
  const T3 = (await now(o.page)) + 3 * DAY + 9 * 60000;
  b = await buy(o, { rcBuy: {}, rc: { periodType: "TRIAL", expirationDateMillis: T3, willRenew: true } });
  at = await armedAt(o);
  ok("…while RevenueCat's own record, saying TRIAL with an end, sets it", b.plan.sure === false && b.atOnce === null && at === T3 - LEAD, [b, at]);
  await o.context.close();

  o = await buyer({ rcInfo: "fail" });
  b = await buy(o, { rc: { periodType: "TRIAL", willRenew: true } });
  at = await armedAt(o);
  ok("RevenueCat's record does not answer after the purchase: still armed, from the store's free time",
    b.res.ok && near(b.atOnce, b.t + 3 * DAY - LEAD) && at === b.atOnce, [b, at]);
  await o.context.close();

  o = await buyer({}, { store: { monthly: { price: "$9.99" }, annual: { price: "$59.99" } } });
  b = await buy(o, { rc: { periodType: "NORMAL", expirationDateMillis: Date.now() + 30 * DAY, willRenew: true } });
  at = await armedAt(o);
  ok("charged today (no free days): nothing armed", b.plan.state === "paid" && b.res.ok && at === null, [b, at]);
  await o.context.close();

  o = await buyer({}, { buy: "cancel" });
  b = await buy(o, { rc: { periodType: "TRIAL", expirationDateMillis: Date.now() + 3 * DAY } });
  at = await armedAt(o, 1200);
  ok("a purchase the parent cancelled: nothing armed", b.res.err === "cancelled" && at === null, [b, at]);
  await o.context.close();

  o = await buyer({ perm: "denied" });
  b = await buy(o, { rc: { periodType: "TRIAL", expirationDateMillis: Date.now() + 3 * DAY } });
  at = await armedAt(o, 1200);
  ok("a trial for a family who did not allow notifications: nothing armed, nothing handed to iOS", b.res.ok && at === null && (await o.calls("notifySchedule")).length === 0, [b, at]);
  await o.context.close();

  o = await buyer({ schedule: "hang" });
  b = await buy(o, { rc: { periodType: "TRIAL", expirationDateMillis: Date.now() + 3 * DAY } });
  ok("buyPlan never waits on the reminder: a bridge that never answers it, and buyPlan has answered { ok: true } at once",
    b.res && b.res.ok === true && Object.keys(b.res).length === 1 && b.ms < 1500, b);
  await o.context.close();

  // ── THE RACE (review, 22 Oct 2026). subscribe.html leaves 1.2 s after a
  // sale (appleDone("bought", 1200)); RevenueCat's record can take up to 8 s.
  // The price page's own daily check ran 1.5 s after it opened ("no
  // Premium"), so it marked the day checked: without the purchase's own
  // arming and clearing that mark, no page would set the reminder for a day.
  const leave = (o, rc, extra) => o.page.evaluate(async ([rc, extra]) => {
    const plan = await Sona.storePlan();
    window.__ios.set(Object.assign({ rc, rcInfo: "hang" }, extra || {}));   // RevenueCat answers nothing for now
    const t = Date.now();
    await Sona.buyPlan(plan);
    setTimeout(() => location.replace("/__blank.html?after=sale"), 1200);
    return t;
  }, [rc, extra]);
  const arrive = async (o) => { await o.page.waitForURL(/after=sale/); await o.page.waitForFunction(() => !!window.Sona); };

  o = await buyer({});
  const k0 = await o.key();
  const T4 = (await now(o.page)) + 3 * DAY + 11 * 60000;
  await leave(o, { periodType: "TRIAL", expirationDateMillis: T4, willRenew: true });
  await arrive(o);
  let s1 = await o.ios(), k1 = await o.key();
  ok("THE PAGE LEAVES 1.2 s AFTER THE SALE WHILE THE STORE HANGS: iOS already holds the reminder, for the purchase's own end",
    k0 && k0.sync > 0 && s1.pending[ID] && s1.pending[ID].at === T4 - LEAD && k1.arm === T4 - LEAD, [k0, s1.pending, k1]);
  ok("…and the sale cleared the day's check mark, so the next page asks the store again", k1.sync == null, k1);
  await settle(o.page, 2000);                                   // the next page's check is waiting on the store
  await o.page.evaluate(() => window.__ios.set({ rcInfo: "ok" }));
  await settle(o.page, 600);
  s1 = await o.ios(); k1 = await o.key();
  ok("…which it does: RevenueCat's answer, when it comes, keeps the same one reminder and marks the day",
    k1.sync > 0 && Object.keys(s1.pending).length === 1 && s1.pending[ID].at === T4 - LEAD, [k1, s1.pending]);
  await o.context.close();

  o = await buyer({});
  const T5 = (await now(o.page)) + 3 * DAY + 5 * HOUR;
  const t5 = await leave(o, { periodType: "TRIAL", expirationDateMillis: T5, willRenew: true }, { rcBuy: { periodType: "TRIAL", willRenew: true } });
  await arrive(o);
  s1 = await o.ios();
  ok("…a purchase that named no end: iOS already holds it, from the store's own free time", s1.pending[ID] && near(s1.pending[ID].at, t5 + 3 * DAY - LEAD), [s1.pending, t5]);
  await settle(o.page, 2000);
  await o.page.evaluate(() => window.__ios.set({ rcInfo: "ok" }));
  await settle(o.page, 600);
  s1 = await o.ios();
  ok("…and the next page corrects it to RevenueCat's own end", Object.keys(s1.pending).length === 1 && s1.pending[ID].at === T5 - LEAD, s1.pending);
  await o.context.close();

  // the price page's own check is still waiting on the store when the parent buys
  o = await buyer({});
  const T6 = (await now(o.page)) + 3 * DAY + 13 * 60000;
  const race = await o.page.evaluate(async (T) => {
    const plan = await Sona.storePlan();
    const cancels = () => window.__ios.state().log.filter((e) => e.m === "notifyCancel").length;
    window.__ios.set({ rc: null, rcInfo: "hang" });           // RevenueCat: no Premium yet, and slow
    const early = Sona.trialReminderSync(true);               // the check asks now…
    await new Promise((r) => setTimeout(r, 300));
    window.__ios.set({ rc: { periodType: "TRIAL", expirationDateMillis: T, willRenew: true } });
    const c0 = cancels();
    const res = await Sona.buyPlan(plan);                     // …the parent buys while it waits
    const after = Sona.trialReminderSync(true);               // a check asked after the sale is a new one
    window.__ios.set({ rcInfo: "ok" });                       // the early answer arrives: "no Premium"
    return { res, early: await early, after: await after, cancelled: cancels() - c0, pending: window.__ios.state().pending, key: JSON.parse(localStorage.getItem("sona.notify.v1")) };
  }, T6);
  ok("A CHECK STILL WAITING FROM BEFORE THE SALE NEVER TAKES THE NEW REMINDER BACK: its \"no Premium\" is \"stale\", nothing cancelled",
    race.res.ok && race.early === "stale" && race.cancelled === 0 && race.pending[ID] && race.pending[ID].at === T6 - LEAD, race);
  ok("…while a check asked after the sale is its own, and its answer counts (\"armed\", the day marked)", race.after === "armed" && race.key.sync > 0 && race.key.arm === T6 - LEAD, race);
  await o.context.close();
}

// ── 4b. the price screen's line follows iOS's own answer (review, 22 Oct
// 2026): the card can paint before iOS has answered the page, from what iOS
// said last time; once it answers, the line under the button follows ──
{
  const LINE = "We'll remind you the day before it ends.";
  const ahead = (page) => page.evaluate(() => { const e = document.getElementById("iapAhead"); return e && !e.hidden ? e.textContent : ""; });
  const priced = (page) => page.waitForFunction(() => { const c = document.getElementById("iapCard"); return c && c.getAttribute("data-state") === "free"; });
  for (const [label, was, now, before, after] of [
    ["iOS was allowed last time, and is off now (the parent turned it off in iOS Settings)", "granted", "denied", LINE, ""],
    ["iOS said no last time, and is allowed now", "denied", "granted", "", LINE],
  ]) {
    const o = await phoneWith({ app: "buy", stamp: "post", setUp: true, store: STORES.monthlyFree, local: { "sona.notify.v1": { state: was } } }, { perm: now, status: "hang" });
    await o.page.goto(base + "/subscribe.html?setup=1");
    await priced(o.page);
    await settle(o.page, 300);
    const b = await ahead(o.page);
    await o.page.evaluate(() => window.__ios.set({ status: "ok" }));
    await settle(o.page, 600);
    const a = await ahead(o.page);
    ok("THE PRICE SCREEN'S LINE FOLLOWS iOS'S ANSWER: " + label + ": painted from the last answer, then repainted once iOS answers", b === before && a === after, [b, a]);
    await o.context.close();
  }
}

// ── 4d. a sale buyPlan's answer did not carry (review, 22 Oct 2026): an Ask
// to Buy approved later, or Restore after Apple took the order and Premium
// did not switch on ("not-entitled"). The price page's own check at load
// marked the day checked; without Sona.trialReminderSold the reminder was
// never set and the next 24 hours of pages answered "later" ──
{
  const card = (page, st) => page.waitForFunction((st) => { const c = document.getElementById("iapCard"); return c && c.getAttribute("data-state") === st; }, st);
  const priced = async (pcfg) => {
    const o = await phoneWith(Object.assign({ app: "buy", stamp: "post", setUp: true, store: STORES.monthlyFree }, pcfg), { perm: "granted" });
    await o.page.goto(base + "/subscribe.html?setup=1");
    await card(o.page, "free");
    await settle(o.page, 2600);           // the page's own check has run (no Premium yet): the day marked
    o.k0 = await o.key();
    return o;
  };
  const near = (x, want) => !!x && Math.abs(x - want) < 15000;
  const after = async (o, t) => {
    await card(o.page, "done");
    await settle(o.page, 300);           // before the page leaves (1 s and more)
    const st = await o.ios(), k = await o.key();
    return { at: st.pending[ID] && st.pending[ID].at, k, t };
  };

  let o = await priced({ buy: "pending" });
  await o.page.locator("#iapBuy").click();
  await o.page.waitForFunction(() => /Waiting for approval/.test(document.getElementById("iapMsg").textContent));
  const t1 = await now(o.page);
  await o.page.evaluate(() => { window.__phone.set({ entitled: true }); document.dispatchEvent(new Event("visibilitychange")); });
  let r = await after(o, t1);
  ok("ASK TO BUY, APPROVED LATER: the free trial's reminder is set before the page leaves, and the day's check mark cleared",
    o.k0 && o.k0.sync > 0 && near(r.at, t1 + 3 * DAY - LEAD) && r.k && r.k.sync == null, [o.k0, r]);
  await o.context.close();

  o = await priced({ buy: "nogrant", restore: "finds" });
  await o.page.locator("#iapBuy").click();
  await o.page.waitForFunction(() => /Restore Purchases/.test(document.getElementById("iapMsg").textContent));
  await settle(o.page, 1100);            // Restore takes no tap for a second after the buy tap
  const t2 = await now(o.page);
  await o.page.locator("#iapRestore").click();
  r = await after(o, t2);
  ok("\"NOT-ENTITLED\", THEN RESTORE: the reminder is set from the plan that was bought, and the day's check mark cleared",
    o.k0 && o.k0.sync > 0 && near(r.at, t2 + 3 * DAY - LEAD) && r.k && r.k.sync == null, [o.k0, r]);
  await o.context.close();

  o = await priced({ restore: "finds" });
  await o.page.locator("#iapRestore").click();
  r = await after(o, 0);
  ok("…while a plain Restore (no sale on this screen) sets nothing from the card", !r.at, r);
  await o.context.close();
}

// ── 4c. setup's reminder screen on the real block (22 Oct 2026). setupscreenstest
// fakes Sona.notify* and storePlan to hold the screen's own rules; here the
// real NOTIFY1 and storePlan decide, on _phone.mjs's App Store and this file's
// iOS setting: the screen shows only for a buyer the store gives free days,
// on a build that can remind, whom iOS has not asked yet ──
{
  const walk = async (label, cfg, icfg, want) => {
    const o = await open(browser, base, Object.assign({ app: "buy", stamp: "post" }, cfg));
    try {
      await o.context.addInitScript(ios, icfg);
      await o.context.route("**/subscribe.html**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<p>price</p>" }));
      await o.page.goto(base + "/onboarding.html");
      const seen = await setupWalk(o.page, "remind", { name: "Mia" });
      const at = o.page.url();
      const got = seen[seen.length - 1] === "remind" && /onboarding/.test(at) ? "remind" : new URL(at).pathname;
      ok("SETUP'S REMINDER SCREEN, ON THE REAL BLOCK: " + label + ": " + (want === "remind" ? "the screen" : "straight to the price"), got === want && o.errors.length === 0, { got, seen, errors: o.errors });
    } catch (e) { ok("SETUP'S REMINDER SCREEN, ON THE REAL BLOCK: " + label + " completes", false, e.message); }
    finally { await o.context.close(); }
  };
  await walk("a new buyer the store gives free days, iOS never asked", {}, { perm: "prompt" }, "remind");
  await walk("both plans offered with free days, the monthly picked", { offering: "both" }, { perm: "prompt" }, "remind");
  await walk("an Apple ID Apple calls ineligible for the free days", { elig: { monthly: 1, annual: 1 } }, { perm: "prompt" }, "/subscribe.html");
  await walk("a phone that cannot tell whether this Apple ID gets the free days (plan.sure false: the price promises no reminder)", { elig: "missing" }, { perm: "prompt" }, "/subscribe.html");
  await walk("a monthly plan with no free days (charged today)", { store: STORES.noFree }, { perm: "prompt" }, "/subscribe.html");
  await walk("iOS already answered (allowed) before this page", {}, { perm: "granted" }, "/subscribe.html");
  await walk("a store that never gives the product", { products: "hang" }, { perm: "prompt" }, "/subscribe.html");
  await walk("a build without the reminder methods", {}, { methods: "none" }, "/subscribe.html");
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
    p1 && p1.at === T - LEAD && k1.sync > 0 && k1.arm === T - LEAD, [p1, k1]);
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
  ok("RevenueCat's end as a date string (no millis) is read too", iso === "armed" && (await pending()).at === t0 + 4 * DAY - LEAD, [iso, await pending()]);

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
  ok("Premium whose period RevenueCat does not name: what is set stays (\"kept\")", unsure === "kept" && (await pending()).at === T - LEAD, unsure);
  const noEnd = await sync({ periodType: "TRIAL", willRenew: true });
  ok("…a trial with no end given: what is set stays", noEnd === "kept" && (await pending()).at === T - LEAD, noEnd);

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
    err === "error" && (await pending()) !== null && (await o.key()).sync === k3.sync && (await o.key()).tried > 0, [err, await o.key(), k3]);
  // the day's mark is a day old, so only the hour after a silent store holds the check back
  const ageSync = () => o.page.evaluate(() => { const k = JSON.parse(localStorage.getItem("sona.notify.v1")); k.sync = Date.now() - 25 * 3600000; localStorage.setItem("sona.notify.v1", JSON.stringify(k)); });
  await ageSync();
  const ie = (await o.ios()).infos;
  const soon = await sync("keep", false);
  await o.page.reload(); await o.page.waitForFunction(() => !!window.Sona);
  await settle(o.page, 2300);
  ok("A STORE THAT DID NOT ANSWER IS ASKED AGAIN AT MOST ONCE AN HOUR, not on every page: \"later\", and a new page asks nothing",
    soon === "later" && (await o.ios()).infos === ie, [soon, (await o.ios()).infos, ie]);
  await o.page.evaluate(() => { const k = JSON.parse(localStorage.getItem("sona.notify.v1")); k.tried = Date.now() - 61 * 60000; localStorage.setItem("sona.notify.v1", JSON.stringify(k)); });
  const hour = await sync("keep", false);
  ok("…an hour on, it asks again (and, silent again, waits another hour)", hour === "error" && (await o.ios()).infos === ie + 1 && (await o.key()).tried > Date.now() - 60000, [hour, (await o.ios()).infos, ie]);
  await o.page.evaluate(() => window.__ios.set({ rcInfo: "ok" }));
  const back = await sync({ periodType: "TRIAL", expirationDateMillis: T, willRenew: true });
  ok("…and once the store answers, the hour's mark goes and the day's is set", back === "armed" && (await o.key()).tried == null && (await o.key()).sync > 0, [back, await o.key()]);
  // a store that HANGS (neither answers nor fails) on a page closed before its 8 s wait
  await ageSync();
  const ih = (await o.ios()).infos;
  await o.page.evaluate(() => { window.__ios.set({ rcInfo: "hang" }); Sona.trialReminderSync(false); });
  await settle(o.page, 600);
  const hungMark = (await o.key()).tried;
  await o.page.reload(); await o.page.waitForFunction(() => !!window.Sona);
  await settle(o.page, 2300);
  ok("A STORE THAT HANGS ON A SHORT PAGE IS ASKED AT MOST ONCE AN HOUR TOO: the hour's mark is written before the store is asked, so the next page asks nothing",
    hungMark > Date.now() - 60000 && (await o.ios()).infos === ih + 1, [hungMark, (await o.ios()).infos, ih]);
  await o.page.evaluate(() => { window.__ios.set({ rcInfo: "ok" }); const k = JSON.parse(localStorage.getItem("sona.notify.v1")); delete k.tried; localStorage.setItem("sona.notify.v1", JSON.stringify(k)); });
  const unhung = await sync({ periodType: "TRIAL", expirationDateMillis: T, willRenew: true });
  ok("…and a store that answers again sets the day's mark as before", unhung === "armed" && (await o.key()).tried == null, [unhung, await o.key()]);

  // notifications turned off: the store is not asked at all
  await o.page.evaluate(() => window.__ios.perm("denied"));
  const i0 = (await o.ios()).infos;
  const off = await sync("keep");
  ok("notifications turned off in iOS Settings: \"off\", and the store is not asked", off === "off" && (await o.ios()).infos === i0, [off, (await o.ios()).infos, i0]);
  await o.context.close();

  // HOME ONLY READS (CLAUDE.md: the daily adventure, the Trophy Road): Home
  // neither reads iOS's answer nor checks the trial, and writes nothing here.
  // RevenueCat is asked there by Home's own iapRefresh, as before; not by this.
  const end = Date.now() + 5 * DAY;
  const h = await phoneWith({ app: "buy", stamp: "post", setUp: true }, { perm: "granted", rc: { periodType: "TRIAL", expirationDateMillis: end, willRenew: true } }, { path: "/today.html" });
  await settle(h.page, 2300);
  await h.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await settle(h.page, 800);
  const onHome = (await h.calls()).filter((e) => e.page === "/today.html");
  ok("ON HOME: no call to iOS's reminder methods as it opens or comes back to the front, and sona.notify.v1 is not written",
    onHome.length === 0 && (await h.key()) === null && !(await h.ios()).pending[ID], [onHome, await h.key()]);
  await h.page.goto(base + "/__blank.html"); await h.page.waitForFunction(() => !!window.Sona);
  await settle(h.page, 2300);
  ok("…while the next page that is not Home checks the trial and sets the reminder", ((await h.ios()).pending[ID] || {}).at === end - LEAD && (await h.key()).sync > 0, [(await h.ios()).pending, await h.key()]);
  await h.context.close();
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

// ── 4e. NUDGE1: a practice reminder each day of the free trial ──
{
  const buyer = async (consent, icfg) => {
    const o = await phoneWith({ app: "buy", stamp: "post", setUp: true }, Object.assign({ perm: "granted" }, icfg || {}));
    await settle(o.page, 1900);
    await o.page.evaluate((c) => {
      if (c) Sona.nudgeConsent();
      window.__beacons = [];
      navigator.sendBeacon = (u, b) => { try { window.__beacons.push(JSON.parse(b)); } catch (e) {} return true; };
    }, consent);
    return o;
  };
  const buy = (o, patch) => o.page.evaluate(async (patch) => {
    const plan = await Sona.storePlan();
    if (patch) window.__ios.set(patch);
    let res; try { res = await Sona.buyPlan(plan); } catch (e) { res = { err: e.code || e.message }; }
    return { res, t: Date.now() };
  }, patch);
  const nudgesIn = async (o) => Object.entries((await o.ios()).pending).filter(([id]) => /^sona-nudge-/.test(id)).map(([id, v]) => ({ id, at: v.at, body: v.body, title: v.title }));
  // the days the nudges belong on, worked out here on their own: each local
  // day after the start, before the last day, but the reminder's
  const expect = (o, start, end) => o.page.evaluate(({ start, end, LEAD }) => {
    const ymd = (ms) => { const d = new Date(ms); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
    const out = [], s = new Date(start);
    for (let k = 1; k < 30; k++) {
      const day = new Date(s.getFullYear(), s.getMonth(), s.getDate() + k, 12);
      if (ymd(day.getTime()) >= ymd(end)) break;
      if (ymd(day.getTime()) === ymd(end - LEAD)) continue;
      out.push("sona-nudge-" + ymd(day.getTime()));
    }
    return out;
  }, { start, end, LEAD });

  let o = await buyer(true);
  const T = (await now(o.page)) + 7 * DAY;
  let b = await buy(o, { rc: { periodType: "TRIAL", expirationDateMillis: T, willRenew: true } });
  await settle(o.page, 1500);
  let got = await nudgesIn(o), want = await expect(o, b.t, T);
  const clock = await o.page.evaluate((list) => list.map((n) => { const d = new Date(n.at); return d.getHours() * 60 + d.getMinutes(); }), got);
  ok("NUDGE1: a seven-day free trial, the parent said yes on setup's screen: one practice reminder on each day after the start, never on the reminder's day or the last day",
    b.res && b.res.ok && got.length === want.length && want.length >= 4 && want.every((id) => got.some((n) => n.id === id)), [got.map((n) => n.id), want]);
  ok("…all at one clock time, between 3:30 and 7:30 pm, with the fixed words and no name",
    clock.length > 0 && clock.every((m) => m === clock[0] && m >= 930 && m <= 1170) && got.every((n) => n.title === "Sona" && n.body === "Ready for 5 minutes of practice? Echo is waiting to play."), [clock, got[0]]);
  ok("…and the trial reminder is still set beside them", !!(await o.ios()).pending[ID], Object.keys((await o.ios()).pending));
  const started = await o.page.evaluate(() => window.__beacons.filter((x) => x.e === "free trial started"));
  ok("TRIAL1: the purchase says \"free trial started\" once, with the free days' length and the anonymous family id only",
    started.length === 1 && started[0].p.days === 7 && Object.keys(started[0].p).join() === "days" && /^[A-Za-z0-9_-]{8,40}$/.test(started[0].fid), started);

  // the first counted rep of a day takes that day's nudge back (seeded: the
  // real ones start tomorrow)
  const today = await o.page.evaluate(() => { const d = new Date(); const t = Date.now() + 2 * 3600000;
    const id = "sona-nudge-" + (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate());
    const k = JSON.parse(localStorage.getItem("sona.notify.v1")); k.nudges = (k.nudges || []).concat([{ id, at: t }]); localStorage.setItem("sona.notify.v1", JSON.stringify(k));
    localStorage.removeItem("sona.played.v1"); return id; });
  await o.page.evaluate(() => { Sona.gameRep("R"); Sona.gameRep("R"); });
  await settle(o.page, 600);
  const after = await o.page.evaluate(() => ({ played: window.__beacons.filter((x) => x.e === "played today"), mark: localStorage.getItem("sona.played.v1"), list: Sona.nudgeState().nudges.map((n) => n.id) }));
  const cancels = (await o.calls("notifyCancel")).filter((c) => c.a && c.a.id === today);
  ok("TRIAL1 / NUDGE1: the day's first counted rep says \"played today\" once (two reps, one beacon, nothing but the id) and takes today's reminder back",
    after.played.length === 1 && Object.keys(after.played[0].p).length === 0 && cancels.length === 1 && !after.list.includes(today) && after.list.length === want.length, [after, cancels]);
  // the trial became a paid month: every nudge goes
  await o.page.evaluate(() => window.__ios.set({ rc: { periodType: "NORMAL", expirationDateMillis: Date.now() + 30 * 86400000, willRenew: true } }));
  const r = await o.page.evaluate(() => Sona.trialReminderSync(true));
  await settle(o.page, 800);
  ok("…a trial that turned into a paid month takes every reminder back (the daily check)", r === "cancelled" && (await nudgesIn(o)).length === 0 && (await o.page.evaluate(() => Sona.nudgeState().nudges.length)) === 0, [r, await nudgesIn(o)]);
  await o.context.close();

  // a parent who allowed notifications under the old words ("One
  // notification, the day before.") was promised one: no nudge
  o = await buyer(false);
  const T2 = (await now(o.page)) + 7 * DAY;
  b = await buy(o, { rc: { periodType: "TRIAL", expirationDateMillis: T2, willRenew: true } });
  await settle(o.page, 1500);
  ok("…no yes on the new screen (allowed under the old one-reminder words): the trial reminder only, no daily one",
    b.res.ok && (await nudgesIn(o)).length === 0 && !!(await o.ios()).pending[ID], Object.keys((await o.ios()).pending));
  await o.context.close();

  // notifications refused: nothing, whatever the yes said
  o = await buyer(true, { perm: "denied" });
  b = await buy(o, { rc: { periodType: "TRIAL", expirationDateMillis: (await now(o.page)) + 7 * DAY, willRenew: true } });
  await settle(o.page, 1500);
  ok("…iOS's notifications turned off: none", (await nudgesIn(o)).length === 0, await nudgesIn(o));
  await o.context.close();

  // charged today: no free days, no nudge, and no "free trial started"
  o = await buyer(true);
  b = await buy(o, { rc: { periodType: "NORMAL", expirationDateMillis: (await now(o.page)) + 30 * DAY, willRenew: true } });
  await settle(o.page, 1500);
  const st2 = await o.page.evaluate(() => window.__beacons.filter((x) => x.e === "free trial started").length);
  ok("…a purchase charged today sets no daily reminder and says no free trial started", b.res.ok && (await nudgesIn(o)).length === 0 && st2 === 0, [await nudgesIn(o), st2]);
  await o.context.close();

  // a three-day trial: only the one day between that is not the reminder's
  o = await buyer(true);
  const T3 = (await now(o.page)) + 3 * DAY;
  b = await buy(o, { rc: { periodType: "TRIAL", expirationDateMillis: T3, willRenew: true } });
  await settle(o.page, 1500);
  got = await nudgesIn(o); want = await expect(o, b.t, T3);
  ok("…a three-day trial gets the days that rule leaves (" + want.length + "), never two notifications in a day",
    got.length === want.length && want.every((id) => got.some((n) => n.id === id)), [got.map((n) => n.id), want]);
  await o.context.close();
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
    /const TRIAL_REMIND = \{ title: "[^"$\d]+", body: "[^"$\d]+" \};/.test(code) && /title: TRIAL_REMIND\.title, body: TRIAL_REMIND\.body/.test(code) && (code.match(/P\.notifySchedule\(/g) || []).length === 2);
  ok("NUDGE1's words are one fixed pair too, the only other thing ever handed to iOS",
    /const NUDGE = \{ title: "[^"$]+", body: "[^"$]+" \};/.test(code) && /title: NUDGE\.title, body: NUDGE\.body/.test(code));
  const buy = (src.match(/\n  function buyPlan\(plan\) \{[\s\S]*?\n  \}\n/) || [""])[0];
  ok("buyPlan has ONE hook, on its success path, right after the list's plan post, handed the purchase's own answer",
    (buy.match(/_trialRemindBought\(/g) || []).length === 1 && /_tellPlan\(r && r\.period, plan\); _trialRemindBought\(r, plan\);/.test(buy)
    && (src.match(/_trialRemindBought\(/g) || []).length === 3, buy.slice(0, 400));
  ok("…and one more, the same step for a sale buyPlan did not answer (Ask to Buy approved, Restore after \"not-entitled\"), never throwing",
    /function trialReminderSold\(plan\) \{ try \{ _trialRemindBought\(\{\}, plan \|\| null\); \} catch \(e\) \{\} \}/.test(code));
  ok("THE LEAD IS 30 HOURS, one constant: a cancel after the reminder still counts (Apple's line is 24 hours)",
    /const TRIAL_REMIND_LEAD_MS = 30 \* 60 \* 60 \* 1000;/.test(code) && (code.match(/TRIAL_REMIND_LEAD_MS/g) || []).length === 4);
  const sub = readFileSync(ROOT + "/subscribe.html", "utf8");
  ok("subscribe.html calls it, feature-checked, from the Ask to Buy approval and the Restore after \"not-entitled\"",
    /typeof Sona\.trialReminderSold === "function"/.test(sub) && /soldElsewhere\(APPLE\.pendingPlan\); bought\(APPLE\.pendingKind\)/.test(sub) && /if \(APPLE\.unentPlan\) soldElsewhere\(APPLE\.unentPlan\); appleDone\("restored"/.test(sub));
  const ip = (src.match(/\n  function iapPurchase\(kind, product\) \{[\s\S]*?\n  \}\n/) || [""])[0];
  ok("…which carries the end from the purchase's own record (the price page leaves 1.2 s after a sale: no second lookup it may not live to hear)",
    /return \{ ok: true, period: _iapPeriod\(res\), end: _iapEnd\(res\) \};/.test(ip), ip.slice(0, 300));
  const hook = (block.match(/\n  function _trialRemindBought\(r, plan\) \{[\s\S]*?\n  \}\n/) || [""])[0].replace(/\/\/[^\n]*/g, "");
  ok("…counts the purchase and clears the day's mark before anything else, and sets the reminder before any lookup",
    /const gen = \+\+_notifyBuys;\s*if \(!notifyAvailable\(\)\) return;\s*_notifySave\(\{ sync: null, tried: null \}\);/.test(hook)
    && hook.indexOf("trialReminderArm(first)") > 0 && hook.indexOf("trialReminderArm(first)") < hook.indexOf("_trialNow()"), hook.slice(0, 500));
  const noExport = (src.match(/const NO_EXPORT = \[[^\]]*\]/) || [""])[0], noImport = (src.match(/const NO_IMPORT = \[[^\]]*\]/) || [""])[0];
  const perKid = (src.match(/const PER_KID = new Set\(\[[\s\S]*?\]\);/) || [""])[0];
  ok("sona.notify.v1 is on NO_EXPORT and NO_IMPORT, and is the phone's, not a child's", /"sona\.notify\.v1"/.test(noExport) && /"sona\.notify\.v1"/.test(noImport) && perKid.length > 100 && !/notify/.test(perKid));
  ok("the seven names are on the export line", /global\.Sona = \{[^\n]*\bnotifyAvailable, notifyState, notifyRefresh, notifyAsk, trialReminderOn, trialReminderArm, trialReminderSync, trialReminderSold, [^\n]*\};/.test(src));
  ok("the daily check runs only where the plugin can remind (a browser never schedules a timer for it), and never on Home",
    /if \(notifyAvailable\(\) && !_notifyHome\(\)\) \{\s*_notifyRefresh\(\);\s*setTimeout\(\(\) => \{ trialReminderSync\(false\); \}, 1500\);/.test(code)
    && /function _notifyHome\(\) \{ try \{ return \/\^\\\/today\(\\\.html\)\?\$\/i\.test\(location\.pathname\); \}/.test(code));
  ok("the price screen's promise reads plan.sure: a row that only may be free promises nothing",
    /if \(!plan \|\| plan\.state !== "free" \|\| plan\.sure !== true\) return false;/.test(code));
}

await browser.close(); await srv.close();
console.log(fails ? "\n" + passes + " passed, " + fails + " FAILURES" : "\nALL GREEN (" + passes + ")");
process.exit(fails ? 1 : 0);
