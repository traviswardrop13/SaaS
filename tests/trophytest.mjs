// TROPHY1 and COIN3 (Travis, 9 Oct 2026: "a currency so they can buy stuff
// like characters"; the lead's D1 and D2, refined 11 Oct 2026).
//
// Trophies follow the honest rep, and coins are what a child spends:
//   - a practice try (logAttempt, a miss the same as a pass), an accepted game
//     ask or an accepted book word (gameRep) earns trophies; silence, a tap, a
//     page load, a best or an arcade score never does;
//   - a day at the goal is always 30 trophies, whatever the goal: a grown-up's
//     goal of 100 cannot earn more, a speech therapist's 10 a day cannot earn
//     less. At the default goal of 30 that is one trophy a rep;
//   - they are never spent and never lost: the ledger pays only the difference
//     between today's derived count and what today has already paid, so a
//     double call, a reload or a goal change can never pay twice or take one
//     back; "Reset progress" leaves them; a backup carries them;
//   - a child already on Sona starts with what their real reps since 21 Sep
//     2026 earned, counted once;
//   - coins are no longer minted from reps, a finished story or an arcade
//     score (mintCoins and mintStoryBonus only read), are never sold, and the
//     wallet refuses a junk amount;
//   - none of it writes the speech ladder or the practice records.
// Game levels (LEVELS1, section 13) joined in step 3: Level 2 at 150 trophies
// and Level 3 at 750, per child, picked by a tap, held at Level 1 by a grown-
// up's cap, each level's own best. The buddies' painted poses (BUDDY2,
// section 14) joined in step 4: every picture BUDDY_ART names is on disk in
// its pose's frame, a missing pose falls back in one order, and reading them
// writes nothing. The daily chest, the Trophy Road and the month's path
// (CHEST1, ROAD1, MONTH1, sections 15 to 18) joined in step 6: one chest a
// day the goal is met, every fifth a Big Chest; numbered stops with fixed
// gifts by lifetime trophies; a small path by this month's, every ended
// month handed out once, only by the road page; nothing random, nothing
// lost. The Buddy Shop and the kept-buddies sweep (SHOP1, OWN1, section 19)
// joined in step 7: a household already on Sona keeps every buddy, hat and
// place it could pick (written into each child's profile, so a backup carries
// it), a new family starts with three buddies and buys the rest with coins at
// the catalog's price, a buy can be given back within 10 seconds, and nothing
// in it reads or writes practice.
//
// No browser: sona.js runs in node's vm with a stub window and a clock this
// suite sets (the gameasktest harness), so it is fast and binds no port.
import vm from "vm";
import { readFileSync, readdirSync, existsSync } from "fs";
import path from "path";
import { ROOT } from "./_env.mjs";

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (typeof extra === "string" ? extra : JSON.stringify(extra)))); };
// a section that throws (on code without these functions, say) is a FAIL, not a crash
const sec = (name, fn) => { try { fn(); } catch (e) { ok(name + ": runs without throwing", false, String(e && e.stack || e).split("\n").slice(0, 2).join(" ")); } };

// ── a page, minus the page: its own localStorage, sessionStorage and clock ──
// opts.local shares a store with an earlier boot: a reload, or a second tab.
function boot(opts = {}) {
  const local = opts.local || {}, session = {}, noop = () => {};
  const storage = (store) => ({ getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, key: (i) => Object.keys(store)[i] || null, get length() { return Object.keys(store).length; } });
  const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, setAttribute: noop, appendChild: noop, addEventListener: noop, remove: noop, querySelector: () => null, querySelectorAll: () => [] });
  const clock = opts.clock || { now: new Date(2026, 9, 20, 10, 0, 0).getTime() };
  const ctx = {
    localStorage: storage(local), sessionStorage: storage(session), console, setTimeout, clearTimeout, setInterval, clearInterval,
    document: { hidden: true, addEventListener: noop, removeEventListener: noop, createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: el(), head: el(), documentElement: el(), cookie: "", visibilityState: "hidden", referrer: "" },
    navigator: { userAgent: "node", mediaDevices: {} },
    location: { href: "http://x/charge.html", pathname: "/charge.html", search: "", hash: "", hostname: "x", origin: "http://x", replace: noop },
    addEventListener: noop, removeEventListener: noop, history: { replaceState: noop }, matchMedia: () => ({ matches: false, addEventListener: noop }),
    fetch: () => Promise.reject(new Error("offline")),
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  ctx.__clock = clock;
  vm.runInContext("(function(){var R=Date;function D(a,b,c,d,e,f,g){var n=arguments.length;return n===0?new R(__clock.now):n===1?new R(a):new R(a,b,c||1,d||0,e||0,f||0,g||0);}D.prototype=R.prototype;D.now=function(){return __clock.now;};D.parse=R.parse;D.UTC=R.UTC;Date=D;})();", ctx);
  if (!opts.local) {
    // main's seed rules: every era stamp, and the trial-first stamp
    ["", "2", "3", "4", "5"].forEach((n) => { local["sona.freeera" + n + ".v1"] = n ? "done" : "post"; });
    local["sona.freever.v1"] = "kept";
    if (opts.profile !== null) local["sona.profile.v1"] = JSON.stringify(Object.assign({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, voiceOn: false, soundOn: false, volume: 0 }, opts.profile || {}));
  }
  vm.runInContext(opts.src || readFileSync(ROOT + "/sona.js", "utf8"), ctx, { filename: "sona.js" });
  return { S: ctx.Sona, ctx, local, session, clock };
}
const DAY = 864e5;
const reps = (S, n, sound) => { for (let i = 0; i < n; i++) S.gameRep(sound || "R"); };
const ledger = (p) => JSON.parse(p.local[p.S.kkey("sona.trophy.v1")] || "null");
const homework = (p, over) => { p.local[p.S.kkey("sona.homework.v1")] = JSON.stringify({ hw: Object.assign({ id: "hw1", title: "t", note: "n", sounds: ["R"], pos: "i", repsPerDay: 10, words: null, start: "2000-01-01", due: "2999-01-01", by: "Rachel" }, over || {}), at: 1 }); };
const snap = (p) => JSON.stringify([p.local, p.session]);
const SRC = readFileSync(ROOT + "/sona.js", "utf8");

// ── 1. what earns a trophy, and what never does ──
sec("1a what earns a trophy, and what never does", () => {
  const p = boot(), { S } = p;
  ok("Sona exports trophyState(), trophies() and coinsNow()", typeof S.trophyState === "function" && typeof S.trophies === "function" && typeof S.coinsNow === "function");
  ok("a new child starts at no trophies", S.trophies() === 0 && JSON.stringify(S.trophyState()) === JSON.stringify({ total: 0, today: 0, month: 0, ym: "2026-10" }), S.trophyState());
  S.logAttempt({ sound: "R", word: "rabbit", pass: false, game: "practice" });
  ok("a voiced practice try that MISSED earns a trophy: effort, not accuracy", S.trophies() === 1 && S.trophyState().today === 1, S.trophyState());
  S.logAttempt({ sound: "R", word: "rabbit", pass: true, game: "practice" });
  ok("…and a pass earns exactly the same one", S.trophies() === 2);
  S.gameRep("R");
  ok("an accepted game ask (or book word) earns one too", S.trophies() === 3);
  const before = snap(p);
  S.logAttempt({ sound: "R", reps: 0 }); S.gameRep("X"); S.gameRep(""); S.gameRep();
  ok("silence (reps:0) and a sound Sona doesn't have earn nothing, and write nothing", S.trophies() === 3 && snap(p) === before);
  ok("the count lives in its own per-child ledger, never in the practice records",
    ledger(p).t === 3 && !/troph/i.test(p.local["sona.outcomes.v1"] + p.local["sona.attempts.v1"] + p.local["sona.gamereps.v1"]), ledger(p));
});

// ── 2. a day at the goal is always 30, whatever the goal ──
sec("2a a day at the goal is always 30, whatever the goal", () => {
  const p = boot(), { S } = p, seen = [];
  for (let i = 1; i <= 40; i++) { S.gameRep("R"); seen.push(S.trophies()); }
  ok("at the default goal of 30, one trophy a rep up to 30, then none", seen.every((n, i) => n === Math.min(30, i + 1)), seen);
});
sec("2b a day at the goal is always 30, whatever the goal", () => {
  const p = boot({ profile: { dailyGoal: 100 } }), { S } = p;
  reps(S, 50);
  const half = S.trophies();
  reps(S, 50);
  const full = S.trophies();
  reps(S, 20);
  ok("goal 100: 50 reps give 15 and 100 give 30, and a 120th rep adds nothing (a higher goal cannot earn more)", half === 15 && full === 30 && S.trophies() === 30, { half, full, after: S.trophies() });
});
sec("2c a day at the goal is always 30, whatever the goal", () => {
  const p = boot(); homework(p, { repsPerDay: 10 }); const { S } = p;
  ok("(the speech therapist's homework sets today's goal)", S.repGoal() === 10, S.repGoal());
  reps(S, 5);
  const half = S.trophies();
  reps(S, 5);
  const full = S.trophies();
  reps(S, 5);
  ok("homework of 10 a day: 5 reps give 15 and 10 give 30 (a low dose cannot earn less), then nothing", half === 15 && full === 30 && S.trophies() === 30, { half, full, after: S.trophies() });
});
sec("2d a day at the goal is always 30, whatever the goal", () => {
  const p = boot({ profile: { childAge: "4", dailyGoal: 20 } }), { S } = p;
  reps(S, 20);
  ok("goal 20 (Settings' lowest under age 5): 20 reps give 30", S.trophies() === 30, S.trophies());
});
sec("2e a day at the goal is always 30, whatever the goal", () => {
  const p = boot(), { S } = p, seen = [];
  reps(S, 20);
  const at20 = S.trophies();
  S.saveProfile({ dailyGoal: 100 });
  seen.push(S.trophies());
  for (let i = 0; i < 80; i++) { S.gameRep("R"); seen.push(S.trophies()); }
  ok("raising the goal mid-day never lowers the total (20 stays 20 until the new goal's share passes it), and the day still ends at 30",
    at20 === 20 && seen.every((n, i) => i === 0 || n >= seen[i - 1]) && seen[0] === 20 && seen[seen.length - 1] === 30 && Math.min(...seen) === 20, { at20, seen: seen.filter((_, i) => i % 10 === 0), last: seen[seen.length - 1] });
});
sec("2f a day at the goal is always 30, whatever the goal", () => {
  const p = boot({ profile: { dailyGoal: 100 } }), { S } = p;
  reps(S, 50);
  const at50 = S.trophies();
  S.saveProfile({ dailyGoal: 30 });
  S.gameRep("R");
  const after = S.trophies();
  reps(S, 30);
  ok("lowering the goal fills the day sooner (15 at 50 of 100, then 30 at the next rep against 30), but never past 30", at50 === 15 && after === 30 && S.trophies() === 30, { at50, after, end: S.trophies() });
});

// ── 3. history: a child already on Sona starts with what their real reps earned ──
sec("3a history: a child already on Sona starts with what their real reps earned", () => {
  const p = boot({ profile: { dailyGoal: 50 } }), { S } = p;
  p.local["sona.outcomes.v1"] = JSON.stringify({ R: { attempts: 9, passes: 0, days: {
    "2026-10-10": { tries: 45, a: 1, p: 0 },   // stamped: met a goal of 40 that day → 30
    "2026-10-01": { tries: 12, a: 1, p: 0 },   // before goal stamps existed (5 Oct): min(30, reps) → 12
    "2026-09-30": { tries: 50, a: 1, p: 0 },   // …capped → 30
    "2026-10-12": { tries: 40, a: 1, p: 0 },   // unstamped, after 5 Oct, goal 50 → floor(30×40÷50) = 24, never 30
    "2026-09-10": { tries: 99, a: 1, p: 0 },   // before REPS_SINCE (the week of 21 Sep) → 0
    "2026-10-25": { tries: 30, a: 1, p: 0 },   // dated after today (a wrong phone clock) → 0
  } } });
  p.local["sona.goaldays.v1"] = JSON.stringify({ "2026-10-10": 40 });
  const st = S.trophyState();
  ok("history: a stamped day is 30, a day before stamps pays min(30, reps), an unstamped day that fell short pays its share of max(30, goal), and days before 21 Sep or after today pay nothing",
    st.total === 30 + 12 + 30 + 24 && st.today === 0 && st.month === 30 + 12 + 24, st);
  const before = snap(p);
  for (let i = 0; i < 20; i++) S.trophyState();
  ok("…computed on read without writing anything (no ledger before the first rep)", snap(p) === before && !ledger(p));
  reps(S, 5);
  ok("the first rep after the build writes the ledger once: the history, plus today's share (5 of 50 → 3)",
    S.trophies() === 99 && ledger(p).t === 99 && ledger(p).dn === 3 && ledger(p).mn === 66 + 3 && S.trophyState().month === 69, ledger(p));
  // a past day is never paid again, whatever happens to its records later
  const o = JSON.parse(p.local["sona.outcomes.v1"]); o.R.days["2026-10-12"].tries = 400; p.local["sona.outcomes.v1"] = JSON.stringify(o);
  S.gameRep("R");
  ok("…and once the ledger exists a past day is never paid again (a changed old record moves nothing)", S.trophies() === 99, S.trophies());
});

// ── 4. paid once: a double call, a reload or a second tab ──
sec("4a paid once: a double call, a reload or a second tab", () => {
  const p = boot(), { S } = p;
  reps(S, 5);
  const q = boot({ local: p.local, clock: p.clock });   // the same phone, loaded again
  ok("a reload reads the same count and pays nothing for it", q.S.trophies() === 5 && ledger(p).t === 5);
  q.S.gameRep("R");
  ok("…and its next rep pays exactly one, seen from both tabs", q.S.trophies() === 6 && S.trophies() === 6 && ledger(p).dn === 6);
  // a rep already paid, paid again: today's tries say 6 and the ledger says 6 paid
  const o = JSON.parse(p.local["sona.outcomes.v1"] || "{}");
  const t = "2026-10-20"; o.R = o.R || { attempts: 0, passes: 0, days: {} }; o.R.days[t] = { tries: 2, a: 2, p: 0 }; p.local["sona.outcomes.v1"] = JSON.stringify(o);
  S.gameRep("R");   // 6 game reps + 2 tries written without a hook = 9 derived, 6 already paid
  ok("the ledger pays only the difference from today's derived count (6 paid, 9 earned → 9, not 15)", S.trophies() === 9 && ledger(p).dn === 9, ledger(p));
  reps(S, 40);
  ok("a full day stays 30 however many calls follow", S.trophies() === 30 && ledger(p).dn === 30);
});

// ── 5. days and months ──
sec("5a days and months", () => {
  const clock = { now: new Date(2026, 9, 31, 18, 0, 0).getTime() };
  const p = boot({ clock }), { S } = p;
  reps(S, 3);
  const oct = S.trophyState();
  clock.now += DAY;   // 1 November
  const nov0 = S.trophyState();
  ok("a new day starts at 0 today and a new month at 0 this month, and the total is kept", oct.today === 3 && oct.month === 3 && nov0.today === 0 && nov0.month === 0 && nov0.total === 3 && nov0.ym === "2026-11", { oct, nov0 });
  reps(S, 2);
  const l = ledger(p);
  ok("…the month's count rolls into the last active month (pm/pmn) at the first rep of the new one", l.m === "2026-11" && l.mn === 2 && l.pm === "2026-10" && l.pmn === 3 && l.t === 5 && l.d === "2026-11-01" && l.dn === 2, l);
  clock.now += 40 * DAY;   // 11 December, with no rep in between
  reps(S, 1);
  const l2 = ledger(p);
  ok("…and a skipped month leaves the last ACTIVE month in pm", l2.m === "2026-12" && l2.mn === 1 && l2.pm === "2026-11" && l2.pmn === 2 && l2.t === 6, l2);
});

// ── 6. per child, and nothing resets them ──
sec("6a per child, and nothing resets them", () => {
  const p = boot(), { S } = p;
  reps(S, 4);
  const slot = S.addKid("Leo", "6");
  S.saveProfile({ onboarded: true, focusSounds: ["S"] });
  ok("a brother or sister starts with none of their own", S.activeKid().slot === slot && S.trophies() === 0, { slot, active: S.activeKid(), t: S.trophies() });
  reps(S, 2, "S");
  ok("…earns their own, in their own key", S.trophies() === 2 && JSON.parse(p.local["sona.trophy.v1@" + slot]).t === 2);
  S.switchKid("");
  ok("…and the first child's are untouched", S.trophies() === 4 && JSON.parse(p.local["sona.trophy.v1"]).t === 4);
  S.removeKid(slot);
  ok("removing a child removes their trophies with them", !("sona.trophy.v1@" + slot in p.local));
});
sec("6b per child, and nothing resets them", () => {
  const p = boot(), { S } = p;
  reps(S, 5); S.addCoins(7);
  S.resetProgress();
  ok("\"Reset progress\" leaves trophies (and still resets coins, which live in the progress record)", S.trophies() === 5 && S.coinsNow() === 0, { t: S.trophies(), c: S.coinsNow() });
});
sec("6c per child, and nothing resets them", () => {
  const a = boot(); reps(a.S, 6);
  const code = a.S.exportString();
  ok("a backup carries the trophy ledger", /sona\.trophy\.v1/.test(code));
  const b = boot();
  const r = b.S.importData(code);
  ok("…and restoring it on a new phone brings the trophies", r.ok && b.S.trophies() === 6 && b.local["sona.trophy.v1"] === a.local["sona.trophy.v1"], { r, t: b.S.trophies() });
});

// ── 7. reading never writes ──
sec("7a reading never writes", () => {
  const p = boot(); const { S } = p;
  p.local["sona.outcomes.v1"] = JSON.stringify({ R: { attempts: 1, passes: 0, days: { "2026-10-12": { tries: 7, a: 1, p: 0 } } } });
  p.local["sona.progress.v1"] = JSON.stringify({ totals: { coins: 12 } });   // an old record: getProgress() would save its ladder migration
  let before = snap(p);
  for (let i = 0; i < 10; i++) { S.trophyState(); S.trophies(); S.coinsNow(); S.mintCoins(); S.mintStoryBonus(); }
  ok("trophyState, trophies, coinsNow, mintCoins and mintStoryBonus write no key before the first rep", snap(p) === before && S.coinsNow() === 12 && S.trophies() === 7);
  reps(S, 2);
  before = snap(p);
  for (let i = 0; i < 10; i++) { S.trophyState(); S.trophies(); S.coinsNow(); S.mintCoins(); S.mintStoryBonus(); }
  ok("…nor after it", snap(p) === before);
  p.clock.now += 3 * DAY;
  before = snap(p);
  S.trophyState(); S.trophies();
  ok("…nor on a new day (the day's and the month's rollover waits for a rep)", snap(p) === before && S.trophyState().today === 0 && S.trophies() === 9);
});
sec("7b reading never writes", () => {
  // Home used to create the progress record on every first load, through the
  // coin mint; with the mint retired, a page that only looks (a game a child
  // cannot open, bounced Home) must not create it either (freemiumtest's
  // "denied routes preserve real family state").
  const p = boot(), { S } = p;
  const before = snap(p);
  const g = S.getProgress(); S.getCoins(); S.coinsNow(); S.mintCoins(); S.stageOf("R"); S.rungOf("R"); S.momWeek(); S.trophyState();
  ok("on a phone with no progress record, reading progress, coins, a stage or the week creates none", snap(p) === before && !("sona.progress.v1" in p.local) && g.ladderV === 2, Object.keys(p.local));
  S.addCoins(4);
  const stored = JSON.parse(p.local["sona.progress.v1"] || "null");
  ok("…and the first real write stores it already migrated (the ladder flag rides along)", !!stored && stored.ladderV === 2 && stored.totals.coins === 4, stored);
  const q = boot(); q.local["sona.progress.v1"] = JSON.stringify({ stage: { R: 3 }, totals: {} });
  ok("a stored record from before the ladder change is still migrated and saved on its first read", q.S.getProgress().stage.R === 2 && JSON.parse(q.local["sona.progress.v1"]).ladderV === 2 && JSON.parse(q.local["sona.progress.v1"]).stage.R === 2);
});

// ── 8. coins: no more minting, a hardened wallet, never sold ──
sec("8a coins: no more minting, a hardened wallet, never sold", () => {
  const p = boot(), { S } = p;
  p.local["sona.progress.v1"] = JSON.stringify({ sessions: [], totals: { sessions: 0, words: 0, stars: 0, coins: 40 }, streak: { count: 0, lastDate: "" }, bySound: {}, stage: {}, chests: {}, missed: [], ladderV: 2 });
  for (let i = 0; i < 12; i++) S.logAttempt({ sound: "R", word: "rabbit", pass: true });
  S.bumpReps(12);
  const before = snap(p);
  const m = S.mintCoins(), sb = S.mintStoryBonus(); S.mintCoins(); S.mintStoryBonus();
  ok("mintCoins() and mintStoryBonus() pay nothing after 12 reps and change nothing; they answer the balance", m === 40 && sb === 40 && snap(p) === before && S.getCoins() === 40, { m, sb });
  S.markStoryRead();
  ok("finishing the daily chapter pays no coins", S.getCoins() === 40, S.getCoins());
  ok("the retired mint ledger is never written", !Object.keys(p.local).some((k) => /coinmint/.test(k)));
});
sec("8b coins: no more minting, a hardened wallet, never sold", () => {
  const p = boot(), { S } = p;
  const before = snap(p);
  [-5, NaN, undefined, 0, null, "x", Infinity, -Infinity, 1e9, {}, [], "0"].forEach((v) => S.addCoins(v));
  [undefined, -5, "x", 0, NaN, null, Infinity].forEach((v) => S.spendCoins(v));
  ok("addCoins(-5 | NaN | undefined | 0 | junk) and spendCoins(undefined | -5 | \"x\" | 0) change nothing, not even getProgress()'s migration", snap(p) === before && S.coinsNow() === 0);
  ok("…and a junk spend is refused", [undefined, -5, "x", 0].every((v) => S.spendCoins(v) === false));
  const r = S.addCoins("5");
  const stored = JSON.parse(p.local["sona.progress.v1"]).totals.coins;
  ok("addCoins(\"5\") adds the number 5 (never the string \"05\")", r === 5 && stored === 5 && typeof stored === "number", { r, stored });
  S.addCoins(2.9);
  ok("…a fraction is floored", S.coinsNow() === 7, S.coinsNow());
  ok("spendCoins takes an exact, affordable amount and refuses more than the balance", S.spendCoins(3) === true && S.coinsNow() === 4 && S.spendCoins(10) === false && S.coinsNow() === 4);
  const g = JSON.parse(p.local["sona.progress.v1"]); g.totals.coins = "40"; p.local["sona.progress.v1"] = JSON.stringify(g);
  ok("a balance saved as text (\"40\") plus 5 is 45, never \"405\"", S.addCoins(5) === 45 && JSON.parse(p.local["sona.progress.v1"]).totals.coins === 45);
  const g2 = JSON.parse(p.local["sona.progress.v1"]); g2.totals.coins = "junk"; p.local["sona.progress.v1"] = JSON.stringify(g2);
  ok("a corrupt balance reads as 0 and can never go NaN", S.coinsNow() === 0 && S.addCoins(5) === 5 && S.spendCoins(9) === false);
});
sec("8c coins: no more minting, a hardened wallet, never sold", () => {
  const pub = path.join(ROOT);
  const pages = readdirSync(pub).filter((f) => f.endsWith(".html"));
  // the Buddy Shop (customize.html) spends through Sona.buyItem, which takes
  // the price from the catalog; it is held to this rule like every page
  const payers = pages.filter((f) => /\b(addCoins|spendCoins)\(/.test(readFileSync(path.join(pub, f), "utf8")));
  ok("no page pays or takes coins itself: no addCoins( or spendCoins( in any public page (end cards, the daily run, Coach Call, the story, the Buddy Shop)", pages.length > 40 && payers.length === 0, payers);
  const engines = ["hoops.js", "soccer.js", "dino.js", "bubbles.js", "sayplay.js"].filter((f) => existsSync(path.join(pub, f)));
  ok("…nor any game engine", engines.length === 5 && engines.every((f) => !/addCoins|spendCoins|mintCoins/.test(readFileSync(path.join(pub, f), "utf8"))));
  ok("Home never mints coins on load", !/mintCoins|mintStoryBonus/.test(readFileSync(path.join(pub, "today.html"), "utf8")));
  const run = readFileSync(path.join(pub, "arcade-run.html"), "utf8");
  ok("Sound Sprint still declares the round's points (pts is read by its end card) without paying a coin share", /\n\s*var pts=score\(\);\n/.test(run) && /pts===0/.test(run) && !/cshare/.test(run));
  const call = readFileSync(path.join(pub, "coach-call.html"), "utf8");
  ok("Coach Call's end card promises no coins", !/coins/i.test(call.slice(call.indexOf("function endCall"), call.indexOf("function endCall") + 1400)));
  const iap = (SRC.match(/const IAP_PRODUCTS = \{[^}]*\}/) || [""])[0];
  ok("coins are never sold: IAP_PRODUCTS holds no coin product", iap.length > 20 && !/coin|gem|currency/i.test(iap), iap);
});

// ── 9. the speech ladder and the practice records are never written by any of it ──
sec("9a the speech ladder and the practice records are never written by any of it", () => {
  const p = boot(), { S } = p;
  p.local["sona.progress.v1"] = JSON.stringify(S.getProgress());   // a stored record, born migrated (a read alone stores none)
  p.local["sona.today.v1"] = JSON.stringify({ d: "2026-10-20", sound: "R" });
  p.local["sona.rotation.v1"] = JSON.stringify({ i: 2 });
  const g0 = JSON.parse(p.local["sona.progress.v1"]); g0.stage = { R: 2 }; g0.rungWins = { "R:2": 1 }; p.local["sona.progress.v1"] = JSON.stringify(g0);
  const pin = () => JSON.stringify({ stage: S.getProgress().stage, rungWins: S.getProgress().rungWins, today: p.local["sona.today.v1"], rot: p.local["sona.rotation.v1"], out: S.outcomes(), att: p.local["sona.attempts.v1"] || null, gr: p.local["sona.gamereps.v1"] || null });
  const before = pin();
  for (let i = 0; i < 50; i++) { S.trophyState(); S.trophies(); S.coinsNow(); S.addCoins(3); S.spendCoins(1); S.mintCoins(); S.mintStoryBonus(); }
  ok("50 rounds of trophy and coin reads, payments and spends leave the stage, rung wins, today's sound, the rotation, outcomes, attempts and game reps byte-identical", pin() === before && S.coinsNow() === 100);
});

// ── 10. where it lives in sona.js, and what it is allowed to touch ──
sec("10a where it lives in sona.js, and what it is allowed to touch", () => {
  const at = SRC.indexOf("// ── TROPHY1"), beacon = SRC.indexOf("function repsBeacon() {}"), bests = SRC.indexOf("// ── BESTS1:");
  ok("TROPHY1 sits after repsBeacon and before BESTS1", at > beacon && beacon > 0 && bests > at);
  // the block runs to the next block's header (LEVELS1 and the others the
  // later steps add sit between it and BESTS1, each checked on its own)
  const next = SRC.indexOf("\n  // ── ", at + 8);
  const block = SRC.slice(at, next > at && next < bests ? next : bests), code = block.replace(/\/\/[^\n]*/g, "");
  const saves = code.match(/\bsave\(\s*[A-Z_a-z]+/g) || [];
  ok("its only write is the trophy ledger", saves.length === 1 && saves[0].replace(/\s/g, "") === "save(TROPHYKEY", saves);
  ok("it never reads a pass, a verdict or a best, and never pays coins, sends or logs", !/\bpass|passes|hearVerdict|addCoins|spendCoins|sendProgress|track\(|fetch\(|sendBeacon|logAttempt|outcomes\(\)|setItem|sona\.bests|gameBest/.test(code), (code.match(/[^\n]*(\bpass|hearVerdict|addCoins|sendProgress|track\(|fetch\(|setItem)[^\n]*/) || [""])[0]);
  const calls = (SRC.match(/_trophyAdd\(\);/g) || []).length;
  const la = (SRC.match(/function logAttempt\(a\) \{[\s\S]*?\n  \}/) || [""])[0], gr = (SRC.match(/function gameRep\(sound\) \{[\s\S]*?\n  \}/) || [""])[0];
  ok("only the two rep writers pay: logAttempt (after the rep is saved, before the goal stamp) and gameRep",
    calls === 2 && /save\(OUTKEY, o\);[\s\S]*_trophyAdd\(\);\n\s*_goalCheck\(\);/.test(la) && /save\(GAMEREPKEY, gr\); _trophyAdd\(\); _goalCheck\(\);/.test(gr), { calls });
  ok("logAttempt still returns before any of it when a try had no voice", /if \(!reps\) return;[\s\S]*_trophyAdd/.test(la));
  // besttest's rule: the bests store is named only in its block, PER_KID and the export line
  const bblock = (SRC.match(/\/\/ ── BESTS1:[\s\S]*?\n {2}function gameBestOffer\(key, n\) \{[\s\S]*?\n {2}\}\n/) || [""])[0];
  const rest = SRC.replace(bblock, "").replace(/const PER_KID = new Set\(\[[\s\S]*?\]\);/, "").replace(/\n {2}global\.Sona = \{[^\n]*\n/, "");
  ok("no code or comment outside BESTS1 names the bests store", bblock.length > 400 && !/sona\.bests|BESTKEY|gameBest|_bestOf|_bests\(/.test(rest), (rest.match(/[^\n]*(sona\.bests|BESTKEY|gameBest|_bestOf|_bests\()[^\n]*/) || [""])[0]);
  const ga = SRC.indexOf("GAMEASK1"), wk = SRC.indexOf("the week, narrated", ga);
  ok("nothing saves between GAMEASK1 and \"the week, narrated\" (gameasktest's window)", ga > 0 && wk > ga && !/\bsave\(|setItem/.test(SRC.slice(ga, wk).replace(/\/\/[^\n]*/g, "")));
  const exp = (SRC.match(/\n {2}global\.Sona = \{[^\n]*\};\n/) || [""])[0];
  ok("the export line is still one line, keeps planwordstest's tail, and the new names sit just before soundMark, clipsSettled",
    exp.length > 1000 && /trophyState, trophies, coinsNow, (?:[\w$]+, )*soundMark, clipsSettled, storePlan, buyPlan, planWords, planSay, planBillDate, setupWall, setupAfterMark, setupAfter, setupAfterClear, setupAsks, setupAsksSave, SETUP_THERAPY \};\n$/.test(exp) && /\bmintCoins, mintStoryBonus\b/.test(exp));
  // pages this feature changes fire events through Sona.track(, which telemetrytest can see
  const changed = ["today.html", "arcade-slice.html", "arcade-tiles.html", "arcade-stack.html", "arcade-run.html", "arcade-glide.html", "charge.html", "coach-call.html", "story.html"];
  ok("no page this feature changes fires an event as S.track(\"…\") (invisible to telemetrytest)", changed.every((f) => !/\bS\.track\("/.test(readFileSync(path.join(ROOT, f), "utf8"))), changed.filter((f) => /\bS\.track\("/.test(readFileSync(path.join(ROOT, f), "utf8"))));
});

// ── 11. storage lists ──
sec("11a storage lists", () => {
  const perKid = (SRC.match(/const PER_KID = new Set\(\[([\s\S]*?)\]\);/) || ["", ""])[1];
  const NEW = ["sona.trophy.v1", "sona.chest.v1", "sona.road.v1", "sona.playlevel.v1"];
  ok("PER_KID holds the economy's four per-child keys", NEW.every((k) => perKid.includes('"' + k + '"')), NEW.filter((k) => !perKid.includes('"' + k + '"')));
  ok("…and PER_KID still holds the keys its other readers check (day1, hwtest, besttest)", ["sona.day.v2", "sona.homework.v1", "sona.bests.v1", "sona.pilot.v1", "sona.gamereps.v1"].every((k) => perKid.includes('"' + k + '"')));
  ok("no new key name matches /rep|week/i (Home may write no such key; repweektest)", NEW.every((k) => !/rep|week/i.test(k)));
  const noExport = (SRC.match(/const NO_EXPORT = \[[^\]]*\]/) || [""])[0], noImport = (SRC.match(/const NO_IMPORT = \[[\s\S]*?\];/) || [""])[0];
  ok("the trophy ledger travels in a backup: on neither NO_EXPORT nor NO_IMPORT", noExport.length > 10 && noImport.length > 10 && !/trophy/.test(noExport + noImport));
});

// ── 12. telemetry: never a count ──
sec("12a telemetry: never a count", () => {
  const route = readFileSync(path.resolve(ROOT, "..", "app/api/track/route.ts"), "utf8");
  const props = (route.match(/const PROPS = new Set\(\[([^\]]*)\]\)/) || ["", ""])[1];
  ok("the relay's PROPS holds no stop or step (a road stop is a lifetime trophy threshold) and no trophy or coin count", props.length > 10 && !/"(stop|step|trophies|trophy|coins|coin|balance)"/.test(props), props);
});

// ── 13. levels inside games (LEVELS1, step 3) ──
// Every game opens as before; inside nine of them Level 2 opens at 150
// trophies and Level 3 at 750, per child. A tap plays the level last picked,
// Home asks once per game per newly opened level, a grown-up can hold a child
// at Level 1, and Level 2 and 3 keep their own longest rows (Level 1's stays
// with Beat Your Best, untouched).
const seedTrophies = (p, t) => { p.local[p.S.kkey("sona.trophy.v1")] = JSON.stringify({ v: 1, t, d: "2026-10-20", dn: 0, m: "2026-10", mn: 0 }); };
const lvRec = (p) => JSON.parse(p.local[p.S.kkey("sona.playlevel.v1")] || "null");
sec("13a levels open with lifetime trophies", () => {
  const p = boot(), { S } = p;
  ok("Sona exports the levels' readers and writers", ["playLevelsOpen", "playLevel", "playLevelAsk", "setPlayLevel", "setPlayLevelCap", "playLevelInfo", "playBest", "playBestOffer"].every((f) => typeof S[f] === "function") && Array.isArray(S.PLAY_LEVEL_AT) && !!S.PLAY_LEVEL_LINES);
  ok("thresholds are 150 and 750 trophies", JSON.stringify(S.PLAY_LEVEL_AT) === "[0,150,750]");
  ok("nine released games have three levels each; Feed Echo and every parked game have none",
    JSON.stringify(Object.keys(S.PLAY_LEVEL_LINES).sort()) === JSON.stringify(["bubbles", "dino", "glide", "hoops", "run", "slice", "soccer", "stack", "tiles"]) && Object.values(S.PLAY_LEVEL_LINES).every((l) => l.length === 3)
    && Object.keys(S.PLAY_LEVEL_LINES).every((k) => S.GAME_ACTS[k] && !S.GAME_ACTS[k].comingSoon));
  const opens = [0, 149, 150, 749, 750, 5000].map((t) => { seedTrophies(p, t); return S.playLevelsOpen(); });
  ok("playLevelsOpen() is 1, 1, 2, 2, 3, 3 at 0, 149, 150, 749, 750, 5000 trophies", JSON.stringify(opens) === "[1,1,2,2,3,3]", opens);
  S.setPlayLevelCap(1);
  const capped = [0, 150, 750, 5000].map((t) => { seedTrophies(p, t); return S.playLevelsOpen(); });
  ok("with a grown-up's \"Level 1 only\" it is 1 at any count", capped.every((n) => n === 1) && lvRec(p).cap === 1, capped);
  S.setPlayLevelCap(0);
  ok("\"Open as earned\" lifts the cap", S.playLevelsOpen() === 3 && !("cap" in lvRec(p)));
});
sec("13b what a game page plays", () => {
  const p = boot(), { S } = p;
  seedTrophies(p, 149);
  ok("below 150 every game plays Level 1 and nothing can be picked", S.playLevel("slice") === 1 && S.setPlayLevel("slice", 2) === false && !lvRec(p));
  seedTrophies(p, 800);
  ok("with nothing picked a game plays Level 1 (a tap plays the level last picked)", S.playLevel("slice") === 1 && S.playLevel("hoops") === 1);
  ok("Feed Echo plays Level 1 at any count, and refuses a pick", S.playLevel("feed") === 1 && S.setPlayLevel("feed", 2) === false);
  ok("a parked game, an unknown key and a key off Object.prototype play Level 1 and refuse a pick",
    ["peekaboo", "balloon", "nope", "constructor", "__proto__", "", null, undefined].every((k) => S.playLevel(k) === 1 && S.setPlayLevel(k, 2) === false));
  ok("setPlayLevel saves an open level and the game plays it", S.setPlayLevel("slice", 3) === true && S.playLevel("slice") === 3 && lvRec(p).pick.slice === 3);
  ok("…per game", S.setPlayLevel("tiles", "2") === true && S.playLevel("tiles") === 2 && S.playLevel("slice") === 3 && S.playLevel("stack") === 1);
  ok("…and refuses 0, 4, junk", [0, 4, "x", NaN, -1].every((n) => S.setPlayLevel("stack", n) === false) && S.playLevel("stack") === 1);
  seedTrophies(p, 200);
  ok("after trophies drop (an older backup) a pick of 3 plays Level 2 and is kept", S.playLevel("slice") === 2 && lvRec(p).pick.slice === 3);
  ok("…and a locked level is refused", S.setPlayLevel("slice", 3) === false);
  S.setPlayLevelCap(1);
  ok("under \"Level 1 only\" every game plays Level 1 whatever was picked", S.playLevel("slice") === 1 && S.playLevel("tiles") === 1);
  const info = S.playLevelInfo("slice");
  ok("playLevelInfo says the cap, the pick and each level's line, threshold and lock", info.cap === true && info.pick === 1 && info.levels.length === 3 && info.levels[0].open && !info.levels[1].open && info.levels[2].at === 750 && info.levels[1].line === "Faster fruit!" && info.levels[2].have === 200, info);
  S.setPlayLevelCap(0);
  const i2 = S.playLevelInfo("slice");
  ok("…and without the cap, Level 1 and 2 open at 200 trophies, Level 3 locked at 750", !i2.cap && i2.pick === 2 && i2.levels.map((l) => l.open).join() === "true,true,false", i2);
  ok("Feed Echo's info lists no levels", S.playLevelInfo("feed").levels.length === 0);
});
sec("13c Home asks once per game per newly opened level", () => {
  const p = boot(), { S } = p;
  seedTrophies(p, 149);
  ok("below 150 Home never asks, and writes nothing", S.playLevelAsk("slice") === false && !lvRec(p));
  seedTrophies(p, 200);
  ok("at 200 the first tap on a game asks", S.playLevelAsk("slice") === true && lvRec(p).seen.slice === 2);
  ok("…then never again for that game", S.playLevelAsk("slice") === false && S.playLevelAsk("slice") === false);
  ok("…while another game asks once too", S.playLevelAsk("tiles") === true && S.playLevelAsk("tiles") === false);
  ok("Feed Echo and a parked game never ask", S.playLevelAsk("feed") === false && S.playLevelAsk("peekaboo") === false);
  seedTrophies(p, 800);
  ok("when Level 3 opens, the game asks once more", S.playLevelAsk("slice") === true && S.playLevelAsk("slice") === false && lvRec(p).seen.slice === 3);
  S.setPlayLevelCap(1);
  ok("under \"Level 1 only\" nothing asks", S.playLevelAsk("stack") === false);
});
sec("13d Level 2 and 3 keep their own longest rows", () => {
  const p = boot(), { S } = p;
  seedTrophies(p, 800);
  const bestsBefore = p.local[S.kkey("sona.bests.v1")];
  ok("a level never played has no best", S.playBest("tiles", 2) === 0 && S.playBest("tiles", 3) === 0);
  const a = S.playBestOffer("tiles", 3, 56);
  ok("a first row at Level 3 sets it: {best 56, prev 0, isNew}", a.best === 56 && a.prev === 0 && a.isNew === true && S.playBest("tiles", 3) === 56 && S.playBest("tiles", 2) === 0, a);
  const b = S.playBestOffer("tiles", 3, 40);
  ok("a lower row changes nothing and answers the best", b.best === 56 && b.prev === 56 && b.isNew === false && S.playBest("tiles", 3) === 56, b);
  const c = S.playBestOffer("tiles", 3, 56);
  ok("matching it is not new", c.isNew === false && c.best === 56);
  const d = S.playBestOffer("tiles", 3, 57);
  ok("beating it keeps the new row", d.isNew && d.best === 57 && d.prev === 56 && lvRec(p).best.tiles["3"].n === 57 && lvRec(p).best.tiles["3"].at === "2026-10-20");
  const junk = [0, -3, 2.5, NaN, "60", 100000, Infinity, null].map((n) => S.playBestOffer("tiles", 2, n));
  ok("only whole numbers from 1 to 99,999 count", junk.every((r) => !r.isNew && r.best === 0) && S.playBest("tiles", 2) === 0, junk);
  ok("Level 1 and unknown keys or levels are refused (Level 1's best stays with Beat Your Best)",
    [["tiles", 1], ["tiles", 4], ["feed", 2], ["nope", 2], ["constructor", 2]].every(([k, lv]) => !S.playBestOffer(k, lv, 30).isNew && S.playBest(k, lv) === 0));
  ok("Level 1's record is never touched", p.local[S.kkey("sona.bests.v1")] === bestsBefore && S.gameBest("tiles") === 0);
});
sec("13e per child, reads write nothing, the ladder untouched", () => {
  const p = boot(), { S } = p;
  seedTrophies(p, 800); S.setPlayLevel("slice", 3);
  S.addKid("Ben", "6");
  ok("a brother or sister starts with nothing picked and no trophies", S.playLevel("slice") === 1 && S.playLevelsOpen() === 1 && !p.local[S.kkey("sona.playlevel.v1")]);
  S.switchKid("");
  ok("…and the first child keeps theirs", S.playLevel("slice") === 3);
  const before = snap(p);
  for (let i = 0; i < 10; i++) { S.playLevel("slice"); S.playLevelsOpen(); S.playLevelInfo("tiles"); S.playBest("tiles", 2); S.playLevel("feed"); }
  ok("playLevel, playLevelsOpen, playLevelInfo and playBest write no key", snap(p) === before);
  p.local["sona.progress.v1"] = JSON.stringify(Object.assign(S.getProgress(), { stage: { R: 2 }, rungWins: { "R:2": 1 } }));
  p.local["sona.today.v1"] = JSON.stringify({ d: "2026-10-20", sound: "R" }); p.local["sona.rotation.v1"] = JSON.stringify({ i: 1 });
  const pin = () => JSON.stringify({ stage: S.getProgress().stage, rungWins: S.getProgress().rungWins, today: p.local["sona.today.v1"], rot: p.local["sona.rotation.v1"], out: S.outcomes(), att: p.local["sona.attempts.v1"] || null, gr: p.local["sona.gamereps.v1"] || null, coins: S.coinsNow(), t: S.trophies() });
  const was = pin();
  for (let i = 0; i < 50; i++) { S.setPlayLevel("slice", 1 + (i % 3)); S.playLevelAsk("tiles"); S.playBestOffer("stack", 2, i + 1); S.setPlayLevelCap(i % 2); S.playLevelInfo("run"); }
  ok("50 level picks, asks, bests and caps leave the stage, rung wins, today's sound, the rotation, outcomes, attempts, game reps, coins and trophies byte-identical", pin() === was);
  const r = S.exportData(), q = boot({ profile: null });
  ok("a backup carries the levels", JSON.stringify(r).includes("sona.playlevel.v1") && q.S.importData(r).ok && q.S.playBest("stack", 2) === 50, q.S.playBest("stack", 2));
});
sec("13f where LEVELS1 lives in sona.js, and what it touches", () => {
  const at = SRC.indexOf("// ── LEVELS1"), tr = SRC.indexOf("// ── TROPHY1"), bests = SRC.indexOf("// ── BESTS1:");
  ok("LEVELS1 sits after TROPHY1 and before BESTS1, outside the GAMEASK1 window", at > tr && tr > 0 && bests > at && at > SRC.indexOf("the week, narrated"));
  const next = SRC.indexOf("\n  // ── ", at + 8), block = SRC.slice(at, next > at ? next : bests), code = block.replace(/\/\/[^\n]*/g, "");
  const saves = code.match(/\bsave\(\s*[A-Z_a-z]+/g) || [];
  ok("its only write is the levels record", saves.length >= 1 && saves.every((x) => x.replace(/\s/g, "") === "save(PLAYLEVELKEY"), saves);
  ok("it never reads access, a pass or a verdict, never pays coins, sends, logs or writes practice",
    !/gameAccess|gated\(|premium\(|freeVersion|offerOnLock|trialFirst|\bpass\b|hearVerdict|addCoins|spendCoins|sendProgress|track\(|fetch\(|sendBeacon|logAttempt|gameRep\(|setItem|outcomes\(\)/.test(code), (code.match(/[^\n]*(gameAccess|track\(|fetch\(|setItem|addCoins)[^\n]*/) || [""])[0]);
  ok("its names keep clear of the say-it card's GAME_LEVELS and profile.gameLevel", !/GAME_LEVELS|gameLevel\b/.test(code));
  const perKid = (SRC.match(/const PER_KID = new Set\(\[([\s\S]*?)\]\);/) || ["", ""])[1];
  ok("the record is per child (PER_KID), and its name matches no /rep|week/ key Home may not write", perKid.includes('"sona.playlevel.v1"') && !/rep|week/i.test("sona.playlevel.v1"));
  const route = readFileSync(path.resolve(ROOT, "..", "app/api/track/route.ts"), "utf8");
  const events = (route.match(/const EVENTS = new Set\(\[([\s\S]*?)\]\)/) || ["", ""])[1], props = (route.match(/const PROPS = new Set\(\[([^\]]*)\]\)/) || ["", ""])[1];
  ok("the relay takes \"level played\" with a level, and still no stop, step or count", events.includes('"level played"') && props.includes('"level"') && !/"(stop|step|trophies|trophy|coins|coin)"/.test(props), props);
  const changed = ["today.html", "settings.html", "charge.html", "arcade-slice.html", "arcade-tiles.html", "arcade-stack.html", "arcade-run.html", "arcade-glide.html", "arcade-bubbles.html", "arcade-hoops.html", "arcade-soccer.html", "arcade-dino.html"];
  const codeOf = (f) => readFileSync(path.join(ROOT, f), "utf8").replace(/<!--[\s\S]*?-->/g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  ok("no page levels change fires an event as S.track(\"…\"); Home fires none at all, and Settings never \"level played\"",
    changed.every((f) => !/\bS\.track\("/.test(codeOf(f))) && !/\btrack\(/.test(codeOf("today.html")) && !/level played/.test(codeOf("settings.html")));
  const engines = ["hoops.js", "soccer.js", "dino.js", "bubbles.js"];
  ok("the four engines take the level from the page and never from storage", engines.every((f) => { const src = readFileSync(path.join(ROOT, f), "utf8"); return /setLevel: function \(n\) \{ level = \(n === 2 \|\| n === 3\) \? n : 1; \}/.test(src) && !/localStorage|sessionStorage|playlevel|playLevel/.test(src); }));
});

// ── 14. the buddies' painted poses (BUDDY2 art, step 4) ──
// "Play as your buddy" (Travis, 9 Oct 2026: "they actually BE the character in
// the game") draws each buddy in the pose a scene needs: running from behind
// in Sound Sprint, standing and cheering beside Echo, peeking over Fruit
// Slice's counter, sitting on Block Stacker's bench. BUDDY_ART lists only the
// pictures on disk (R15: no stand-in art), each cut to its pose's one frame
// so a game places any buddy with one set of numbers; the fox keeps its
// painted Fruit Slice and Block Stacker scenes, so it has no peek or sit.
// The size of a WebP is in its first 30 bytes; no decoder needed.
const webpSize = (file) => {
  const b = readFileSync(file);
  if (b.toString("latin1", 0, 4) !== "RIFF" || b.toString("latin1", 8, 12) !== "WEBP") return null;
  const kind = b.toString("latin1", 12, 16);
  if (kind === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === "VP8L") { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  if (kind === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  return null;
};
const onDisk = (src) => typeof src === "string" && src.startsWith("/assets/crafted/") && existsSync(path.join(ROOT, src));
const FRAME = { run: [480, 840], rest: [512, 512], cheer: [512, 512], sit: [512, 512], peek: [512, 384] };
sec("14a every painted pose BUDDY_ART names is on disk, in its pose's frame", () => {
  const p = boot(), { S } = p;
  const ids = S.CHARACTERS.map((c) => c.id);
  const lit = (SRC.match(/const BUDDY_ART = \{([\s\S]*?)\n  \};/) || ["", ""])[1].replace(/\/\/[^\n]*/g, "");
  const keys = [...lit.matchAll(/^\s*([a-z]+):\s*\{/gm)].map((m) => m[1]);
  ok("BUDDY_ART is one literal in sona.js, keyed by buddies the catalog has", keys.length >= 1 && keys.every((k) => ids.includes(k)), keys);
  const files = [...lit.matchAll(/"(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  ok("every picture it names is a painted WebP on disk under /assets/crafted/", files.length >= 1 && files.every((f) => /\.webp$/.test(f) && onDisk(f)), files.filter((f) => !onDisk(f)));
  const bad = [];
  for (const id of ids) for (const pose of ["run", "rest", "cheer", "peek", "sit"]) {
    const sp = S.buddySprite(id, pose);
    if (!sp) continue;
    if (!onDisk(sp.src)) { bad.push(id + " " + pose + " missing " + sp.src); continue; }
    const want = FRAME[pose === "cheer" || pose === "sit" ? sp.pose || pose : pose], got = webpSize(path.join(ROOT, sp.src));
    if (pose === "run" && sp.crop) { if (!(got && sp.crop[0] + sp.crop[2] <= got[0] && sp.crop[1] + sp.crop[3] <= got[1] && sp.crop[2] * 7 === sp.crop[3] * 4)) bad.push(id + " run crop " + sp.crop + " in " + got); }
    else if (!got || got[0] !== want[0] || got[1] !== want[1]) bad.push(id + " " + pose + " is " + got + ", wants " + want);
  }
  ok("each pose is cut to its frame: a runner 480x840 (or a 4:7 crop, the fox's), standing, cheering and sitting 512x512, peeking 512x384", bad.length === 0, bad);
  // The other way round: a picture that landed but has no line (or a line
  // under a misspelt pose, which buddySprite would quietly skip for the
  // fallback) is art a child never sees.
  const poseKeys = [...lit.matchAll(/\b([a-z]+):\s*[["]/g)].map((m) => m[1]);
  ok("BUDDY_ART names only the five poses", poseKeys.length >= 1 && poseKeys.every((k) => FRAME[k]), [...new Set(poseKeys)].filter((k) => !FRAME[k]));
  const unreached = [];
  for (const f of readdirSync(path.join(ROOT, "assets/crafted"))) {
    const m = /^buddy-([a-z]+)-(run|rest|cheer|peek|sit)\.webp$/.exec(f);
    if (!m || !ids.includes(m[1])) continue;
    const sp = S.buddySprite(m[1], m[2]);
    if (!sp || sp.src !== "/assets/crafted/" + f || (m[2] !== "run" && sp.pose !== m[2])) unreached.push(f);
  }
  ok("every buddy pose picture on disk is the one buddySprite answers for that pose", unreached.length === 0, unreached);
  ok("the fox runs as it always has, from its own picture's crop", JSON.stringify(S.buddySprite("fox", "run")) === JSON.stringify({ src: "/assets/crafted/fox-runner.webp", crop: [390, 205, 480, 840] }), S.buddySprite("fox", "run"));
  ok("the fox has no peek and no sit of its own: its painted Fruit Slice and Block Stacker scenes stay", S.buddySprite("fox", "peek") === null && (S.buddySprite("fox", "sit") === null || S.buddySprite("fox", "sit").pose === "rest"), [S.buddySprite("fox", "peek"), S.buddySprite("fox", "sit")]);
  const portraits = ids.map((id) => S.buddySprite(id, "portrait"));
  ok("every buddy's round badge is on disk at 288x288", portraits.every((f) => onDisk(f) && String(webpSize(path.join(ROOT, f))) === "288,288"), portraits.filter((f) => !onDisk(f)));
  const notes = readFileSync(path.resolve(ROOT, "..", "design/crafted-world/buddies-v3.md"), "utf8");
  const sprites = JSON.parse(readFileSync(path.resolve(ROOT, "..", "tools/art/game-sprites.json"), "utf8"));
  const drawn = files.filter((f) => !/fox-runner\.webp$/.test(f)).map((f) => path.basename(f, ".webp"));
  ok("every one has its drawing's entry in tools/art/game-sprites.json and its eye check in design/crafted-world/buddies-v3.md",
    drawn.every((n) => sprites.some((e) => e.name === n && (e.ref || e.refs)) && notes.includes(n)), drawn.filter((n) => !sprites.some((e) => e.name === n) || !notes.includes(n)));
});
sec("14b a missing pose falls back, in one order, and reading writes nothing", () => {
  const { S } = boot();
  ok("a pose answers {src, pose}; cheer and sit fall back to rest, peek and rest to nothing", (() => {
    for (const c of S.CHARACTERS) {
      const r = S.buddySprite(c.id, "rest"), ch = S.buddySprite(c.id, "cheer"), si = S.buddySprite(c.id, "sit"), pk = S.buddySprite(c.id, "peek");
      if (r && r.pose !== "rest") return false;
      if (ch && !(ch.pose === "cheer" || (ch.pose === "rest" && r && ch.src === r.src))) return false;
      if (!ch && r) return false;
      if (si && !(si.pose === "sit" || (si.pose === "rest" && r && si.src === r.src))) return false;
      if (!si && r) return false;
      if (pk && pk.pose !== "peek") return false;
    }
    return true;
  })(), S.CHARACTERS.map((c) => [c.id, S.buddySprite(c.id, "cheer"), S.buddySprite(c.id, "sit")]));
  ok("an unknown buddy or pose: the fox's picture, or nothing", JSON.stringify(S.buddySprite("leo", "run")) === JSON.stringify(S.buddySprite("fox", "run")) && S.buddySprite("fox", "wave") === null, S.buddySprite("leo", "run"));
  ok("the portrait is the round badge each buddy already has", S.buddySprite("bunny", "portrait") === "/assets/crafted/buddy-bunny-v2.webp" && S.buddySprite("nobody", "portrait") === "/assets/crafted/buddy-fox-v2.webp");
  ok("buddyId reads the child's buddy, and an old \"leo\" or a junk one is the fox", (() => {
    const a = S.buddyId(); S.saveProfile({ character: "panda" }); const b = S.buddyId();
    S.saveProfile({ character: "leo" }); const c = S.buddyId();
    return a === "fox" && b === "panda" && c === "fox";
  })(), S.buddyId());
  const q = boot(), was = snap(q);
  for (const c of q.S.CHARACTERS) for (const pose of ["run", "rest", "cheer", "peek", "sit", "portrait"]) q.S.buddySprite(c.id, pose);
  q.S.buddyId();
  ok("buddySprite and buddyId write no key", snap(q) === was);
});
sec("14c the Trophy Road's chests and the three scenes without the fox are on disk", () => {
  const want = { "road-chest": [512, 512], "road-chest-open": [512, 512], "road-bigchest": [512, 512], "road-bigchest-open": [512, 512],
    "fruit-stand-v2": [1440, 545], "stack-workshop-v3": [768, 1536], "stack-rocket-v3": [267, 400] };
  const was = { "fruit-stand-v2": "fruit-stand", "stack-workshop-v3": "stack-workshop-v2", "stack-rocket-v3": "stack-rocket-v2" };
  const bad = Object.entries(want).filter(([n, wh]) => { const f = path.join(ROOT, "assets/crafted/" + n + ".webp"); return !existsSync(f) || String(webpSize(f)) !== String(wh); });
  ok("each is a WebP of its size (the chests 512x512, a scene the size of the picture it stands in for)", bad.length === 0, bad.map(([n]) => n));
  ok("…and a scene without the fox is exactly as big as the one with it, so every number a game measures off it holds",
    Object.entries(was).every(([n, o]) => String(webpSize(path.join(ROOT, "assets/crafted/" + n + ".webp"))) === String(webpSize(path.join(ROOT, "assets/crafted/" + o + ".webp")))));
});
sec("14d where BUDDY2 lives in sona.js, and what it touches", () => {
  const at = SRC.indexOf("// ── BUDDY2"), chars = SRC.indexOf("const CHARACTERS = ["), ask = SRC.indexOf("GAMEASK1");
  ok("BUDDY2 sits next to CHARACTERS, well before the GAMEASK1 window", at > chars && chars > 0 && at < ask && at - chars < 20000, { at, chars });
  const next = SRC.indexOf("\n  // ── ", at + 8), code = SRC.slice(at, next).replace(/\/\/[^\n]*/g, "");
  ok("it only reads: no save, no storage, no network, no event", /function buddySprite\(/.test(code) && /function buddyId\(/.test(code) && !/save\(|setItem|removeItem|fetch\(|sendBeacon|track\(|addCoins|spendCoins/.test(code));
  const line = (SRC.match(/\n\s*global\.Sona = \{[^\n]*\};/) || [""])[0];
  ok("buddyId and buddySprite are exported on the one export line, before soundMark, clipsSettled", /\bbuddyId, buddySprite,[^\n]*\bsoundMark, clipsSettled\b/.test(line));
});

// ── 15. the daily chest (CHEST1, step 6) ──
sec("15a one chest a day, on a day the goal is met", () => {
  const p = boot(), { S } = p;
  ok("Sona exports chestState() and chestOpen()", typeof S.chestState === "function" && typeof S.chestOpen === "function");
  let st = S.chestState();
  ok("before the goal the chest is shut, and says what is inside: 10 coins", !st.ready && !st.opened && !st.big && st.coins === 10 && !st.sticker, st);
  const before = snap(p);
  ok("…and opening it does nothing, and writes nothing", S.chestOpen() === null && snap(p) === before);
  reps(S, 29);
  ok("29 reps of a goal of 30: still shut", !S.chestState().ready);
  S.gameRep("R");
  st = S.chestState();
  ok("the 30th rep meets the goal: the chest is ready", st.ready && !st.opened, st);
  const got = S.chestOpen();
  ok("opening it gives exactly 10 coins", JSON.stringify(got) === JSON.stringify([{ coins: 10 }]) && S.coinsNow() === 10, got);
  st = S.chestState();
  ok("…once: it reads opened, no longer ready, and a second open gives nothing", st.opened && !st.ready && S.chestOpen() === null && S.coinsNow() === 10, st);
  reps(S, 40);
  ok("more reps that day open no second chest", !S.chestState().ready && S.chestOpen() === null && S.coinsNow() === 10);
});
sec("15b every fifth chest is a Big Chest, and skipped days pile up nothing", () => {
  const p = boot(), { S } = p, seen = [];
  for (let d = 0; d < 4; d++) { reps(S, 30); seen.push(JSON.stringify(S.chestOpen())); p.clock.now += DAY; }
  p.clock.now += 3 * DAY;   // three days without the goal
  let st = S.chestState();
  ok("a day without the goal shows nothing missed: not ready, not opened", !st.ready && !st.opened, st);
  ok("the next chest (the 5th) says before it opens: 25 coins and a sticker", st.big && st.coins === 25 && st.sticker, st);
  reps(S, 30);
  const big = S.chestOpen();
  ok("the 5th chest gives 25 coins and the next sticker in the book, by name", big && big.length === 2 && big[0].coins === 25 && big[1].sticker === "star" && big[1].name === "Star" && S.hasSticker("star"), big);
  ok("the four before it were 10 coins each, and the skipped days added no chest", seen.every((g) => g === JSON.stringify([{ coins: 10 }])) && S.coinsNow() === 40 + 25 && JSON.parse(p.local["sona.chest.v1"]).n === 5, { seen, coins: S.coinsNow() });
  p.clock.now += DAY; reps(S, 30); st = S.chestState();
  ok("…and the 6th is an ordinary chest again", st.ready && !st.big && st.coins === 10, st);
});
sec("15c a full sticker book pays 20 coins, and the ledger is written first", () => {
  const p = boot(), { S } = p;
  p.local["sona.chest.v1"] = JSON.stringify({ n: 4, last: "2026-10-01" });
  const all = {}; S.STICKERS.forEach((s) => { all[s.id] = { at: 1 }; }); p.local["sona.stickers.v1"] = JSON.stringify(all);
  reps(S, 30);
  const got = S.chestOpen();
  ok("a Big Chest with every sticker collected pays 20 coins for the sticker", JSON.stringify(got) === JSON.stringify([{ coins: 25 }, { coins: 20, full: true }]) && S.coinsNow() === 45, got);
  const body = (SRC.match(/function chestOpen\(\) \{[\s\S]*?\n  \}/) || [""])[0];
  ok("chestOpen saves its ledger before it pays (a crash under-pays, never pays twice)", body.indexOf("save(CHESTKEY") > 0 && body.indexOf("save(CHESTKEY") < body.indexOf("addCoins("), body.slice(0, 160));
});
sec("15d the chest reads the goal stamp, per child", () => {
  const p = boot({ profile: { dailyGoal: 50 } }), { S } = p;
  reps(S, 30);
  ok("with a goal of 50, 30 reps leave it shut", !S.chestState().ready);
  p.local["sona.goaldays.v1"] = JSON.stringify({ "2026-10-20": 30 });
  ok("a day already stamped as met (before the goal was raised) keeps it ready", S.chestState().ready);
  S.chestOpen();
  S.addKid("Ben", "6");
  ok("a brother or sister has their own chest and their own coins", !S.chestState().opened && S.coinsNow() === 0 && !("sona.chest.v1@" + S.activeKid().slot in p.local));
});

sec("15e the chest the child opened today is the one the road shows", () => {
  const p = boot(), { S } = p;
  p.local["sona.chest.v1"] = JSON.stringify({ n: 3, last: "2026-10-01" });
  reps(S, 30); S.chestOpen();
  let st = S.chestState();
  ok("after the 4th chest (an ordinary one) today's opened chest is not big, though the next one is", st.opened && st.openedBig === false && st.big === true, st);
  p.clock.now += DAY; reps(S, 30); S.chestOpen(); st = S.chestState();
  ok("after the 5th (a Big Chest) today's opened chest is big, though the next one is not", st.opened && st.openedBig === true && st.big === false, st);
  p.clock.now += DAY; st = S.chestState();
  ok("…and on a day not opened yet, openedBig is false", !st.opened && st.openedBig === false, st);
});

// ── 16. the Trophy Road (ROAD1, step 6) ──
const setTrophies = (p, t) => { p.local[p.S.kkey("sona.trophy.v1")] = JSON.stringify({ v: 1, t, d: "2026-10-20", dn: 0, m: "2026-10", mn: 0 }); };
sec("16a the stop table", () => {
  const { S } = boot(), st = S.ROAD_STOPS;
  ok("28 stops numbered 1..28, each further than the last, at the trophies the table names",
    st.length === 28 && st.every((s, i) => s.n === i + 1 && (i === 0 || s.at > st[i - 1].at)) &&
    JSON.stringify(st.map((s) => s.at)) === JSON.stringify([30, 80, 150, 220, 300, 380, 460, 540, 640, 750, 850, 950, 1050, 1150, 1250, 1350, 1475, 1600, 1725, 1850, 1975, 2100, 2250, 2400, 2550, 2700, 2850, 3000]), st.map((s) => s.at));
  const lands = st.filter((s) => s.gift.some((g) => g.land)).map((s) => [s.n, s.gift.filter((g) => g.land)[0].land]);
  ok("the Big Chests are stops 5, 10, 16, 22 and 28, and each crosses into the next land", JSON.stringify(lands) === JSON.stringify([[5, "beach"], [10, "snow"], [16, "sea"], [22, "sky"], [28, "champ"]]) && st.filter((s) => s.big).map((s) => s.n).join() === "5,10,16,22,28", lands);
  ok("the lands begin where their Big Chests are", JSON.stringify(S.ROAD_LANDS.map((l) => [l.id, l.name, l.from])) === JSON.stringify([["meadow", "Sunny Meadow", 0], ["beach", "Beach Bay", 300], ["snow", "Snowy Peak", 750], ["sea", "Under the Sea", 1350], ["sky", "Starry Sky", 2100], ["champ", "Champion Trail", 3000]]) && S.ROAD_LANDS.every((l, i) => i === 0 || st.some((s) => s.at === l.from && s.big)));
  ok("Level 2 is the gift at 150 and Level 3 at 750, the trophies that open them", st[2].gift.some((g) => g.level === 2) && st[9].gift.some((g) => g.level === 3) && S.PLAY_LEVEL_AT[1] === 150 && S.PLAY_LEVEL_AT[2] === 750);
  ok("no stop opens empty: each gives coins, a sticker, a level or an item", st.every((s) => s.gift.some((g) => g.coins > 0 || g.sticker || g.level || g.buddy || g.hat || g.place)));
  const items = []; st.forEach((s) => s.gift.forEach((g) => ["buddy", "hat", "place"].forEach((k) => { if (g[k]) items.push([k, g[k]]); })));
  const lists = { buddy: S.CHARACTERS, hat: S.OUTFITS, place: S.BACKDROPS };
  const art = (k, it) => k === "buddy" ? (it.portrait || "/assets/crafted/buddy-" + it.id + "-v2.webp") : k === "hat" ? it.art : "/assets/crafted/customize-" + it.id + "-v2.webp";
  ok("every item a stop names is a road-only catalog entry whose painted art is on disk (an item joins its stop only with its art)",
    items.every(([k, id]) => { const it = lists[k].filter((x) => x.id === id)[0]; return it && it.source === "road" && art(k, it) && existsSync(path.join(ROOT, art(k, it))); }), items);
  ok("the Champion Trail's bonus stops come every 150 trophies, 30 coins and a sticker by turns",
    JSON.stringify([29, 30, 31, 32].map((n) => S.roadStop(n))) === JSON.stringify([{ n: 29, at: 3150, gift: [{ coins: 30 }] }, { n: 30, at: 3300, gift: [{ sticker: 1 }] }, { n: 31, at: 3450, gift: [{ coins: 30 }] }, { n: 32, at: 3600, gift: [{ sticker: 1 }] }]) && S.roadStop(0) === null && S.roadStop(3) === st[2]);
});
sec("16b opening a stop", () => {
  const p = boot(), { S } = p;
  setTrophies(p, 100);
  let r = S.roadState();
  ok("at 100 trophies stops 1 and 2 are reached and waiting, and the next is stop 3 at 150, Level 2",
    r.trophies === 100 && r.stop === 2 && r.waiting === 2 && r.lowestWaiting === 1 && r.next.n === 3 && r.next.at === 150 && r.next.gift.some((g) => g.level === 2) && r.land.id === "meadow" && r.land.name === "Sunny Meadow" && r.land.art === "customize-forest-v2", r);
  ok("a stop not reached refuses to open", JSON.stringify(S.roadOpen(3)) === JSON.stringify({ ok: false, reason: "not-yet" }) && S.coinsNow() === 0);
  const a = S.roadOpen(1);
  ok("stop 1 opens: 20 coins", a.ok && JSON.stringify(a.gifts) === JSON.stringify([{ coins: 20 }]) && S.coinsNow() === 20, a);
  ok("…once: opening it again is refused and pays nothing", JSON.stringify(S.roadOpen(1)) === JSON.stringify({ ok: false, reason: "opened" }) && S.coinsNow() === 20);
  const b = S.roadOpen(2);
  ok("stop 2 gives the next sticker, by name", b.ok && b.gifts.length === 1 && b.gifts[0].sticker === "star" && b.gifts[0].name === "Star" && S.hasSticker("star"), b);
  r = S.roadState();
  ok("then nothing waits", r.waiting === 0 && r.lowestWaiting === null && r.coins === 20, r);
  setTrophies(p, 160);
  const c = S.roadOpen(3);
  ok("stop 3 celebrates Level 2 (the trophies already opened it) and gives 20 coins", c.ok && JSON.stringify(c.gifts) === JSON.stringify([{ level: 2 }, { coins: 20 }]) && S.playLevelsOpen() === 2, c);
  setTrophies(p, 300);
  const d = S.roadOpen(5);
  ok("a Big Chest gives every gift on it, and welcomes the child to the next land", d.ok && d.gifts.length === 3 && d.gifts[0].coins === 40 && d.gifts[1].sticker && JSON.stringify(d.gifts[2]) === JSON.stringify({ land: "beach", name: "Beach Bay" }) && S.roadState().land.id === "beach", d);
  ok("a stop can be opened out of order, and the one before it still waits", S.roadState().lowestWaiting === 4 && S.roadOpen(4).ok && S.roadState().waiting === 0);
  ok("junk stop numbers are refused", ["x", 0, -1, null, undefined, 1.5e9].every((n) => S.roadOpen(n).ok === false));
  setTrophies(p, 2000);
  r = S.roadState();
  ok("with 2,000 trophies every reached stop waits, and the lowest is the first one not opened", r.stop === 21 && r.waiting === 21 - 5 && r.lowestWaiting === 6 && r.next.n === 22 && r.land.id === "sea", r);
});
// an art step lists items on stops: played by booting a sona.js whose table
// names them, on the same phone (a new build reaching a child who already
// passed the stop)
const WITH_ITEMS = SRC.replace("{ n: 4, at: 220, gift: [{ coins: 30 }] }", '{ n: 4, at: 220, gift: [{ buddy: "cat" }] }')
  .replace("{ n: 6, at: 380, gift: [{ coins: 50 }] }", '{ n: 6, at: 380, gift: [{ coins: 50 }, { hat: "sunhat" }] }')
  .replace('{ id: "party",  name: "Party",  emoji: "🥳", source: "shop", cost: 80 },', '$&\n    { id: "sunhat", name: "Sun hat", emoji: "👒", source: "road", cost: null },');
sec("16c a gift already owned, and an item listed after its stop was opened", () => {
  ok("(this test's table names a cat on stop 4 and the Sun hat on stop 6)", WITH_ITEMS !== SRC && /gift: \[\{ coins: 50 \}, \{ hat: "sunhat" \}\]/.test(WITH_ITEMS) && /buddy: "cat"/.test(WITH_ITEMS) && /id: "sunhat"/.test(WITH_ITEMS));
  const o = boot({ profile: { owned: { characters: ["cat"], outfits: ["sunhat"] } }, src: WITH_ITEMS });
  setTrophies(o, 400);
  const four = o.S.roadOpen(4);
  ok("a buddy the child already has pays 100 coins instead", JSON.stringify(four.gifts) === JSON.stringify([{ alt: { kind: "characters", id: "cat", name: "Mochi", coins: 100 } }]) && o.S.coinsNow() === 100, four);
  const six = o.S.roadOpen(6);
  ok("…and a hat already owned pays 50", six.ok && JSON.stringify(six.gifts[1]) === JSON.stringify({ alt: { kind: "outfits", id: "sunhat", name: "Sun hat", coins: 50 } }) && o.S.coinsNow() === 200, six);
  ok("an item handed over at its stop is never handed over again", o.S.roadSettle() === null && o.S.coinsNow() === 200);
  const n = boot({ src: WITH_ITEMS }); setTrophies(n, 400);
  const g = n.S.roadOpen(6);
  ok("an item the child doesn't have is theirs from the stop", g.ok && JSON.stringify(g.gifts[1]) === JSON.stringify({ item: { kind: "outfits", id: "sunhat", name: "Sun hat" } }) && n.S.owns("outfits", "sunhat") && JSON.parse(n.local["sona.road.v1"]).items["6:sunhat"] === 1, g);

  const p = boot(); setTrophies(p, 400);
  const first = p.S.roadOpen(6);
  ok("today stop 6 opens with its coins (the Sun hat's art is not on disk yet)", first.ok && JSON.stringify(first.gifts) === JSON.stringify([{ coins: 50 }]) && p.S.coinsNow() === 50, first);
  const q = boot({ local: p.local, src: WITH_ITEMS, clock: p.clock });
  ok("after the build that lists it, the hat counts as a gift waiting, before the road page loads", q.S.roadState().waiting === 5 + 1, q.S.roadState().waiting);
  const s1 = q.S.roadSettle();
  ok("the road page's settle hands over the Sun hat once, records it, and pays no coins",
    s1 && JSON.stringify(s1.late) === JSON.stringify([{ kind: "outfits", id: "sunhat", name: "Sun hat" }]) && q.S.owns("outfits", "sunhat") && JSON.parse(q.local["sona.road.v1"]).items["6:sunhat"] === 1 && q.S.coinsNow() === 50, s1);
  ok("…and a second settle gives nothing", q.S.roadSettle() === null && q.S.coinsNow() === 50 && q.S.roadState().waiting === 5);
  const r = boot(); setTrophies(r, 400); r.S.roadOpen(6); r.S.saveProfile({ owned: { outfits: ["sunhat"] } });
  const r2 = boot({ local: r.local, src: WITH_ITEMS, clock: r.clock });
  ok("an item listed late that the child already has is only recorded: no coins", r2.S.roadSettle() === null && r2.S.coinsNow() === 50 && JSON.parse(r2.local["sona.road.v1"]).items["6:sunhat"] === 1);
});

// ── 17. the month's path (MONTH1, step 6) ──
const OCT20 = () => { const days = {}; for (let d = 1; d <= 20; d++) days["2026-10-" + String(d).padStart(2, "0")] = { tries: 30, a: 1, p: 0 }; return JSON.stringify({ R: { attempts: 600, passes: 0, days } }); };
sec("17a this month's path", () => {
  const p = boot(), { S } = p;
  ok("eight steps at 40..600 trophies this month, the last a Big Chest", JSON.stringify(S.MONTH_STEPS.map((s) => s.at)) === "[40,100,180,260,340,420,500,600]" && S.MONTH_STEPS.filter((s) => s.big).map((s) => s.n).join() === "8");
  const coins = S.MONTH_STEPS.reduce((n, s) => n + s.gift.reduce((m, g) => m + (g.coins || 0), 0), 0);
  ok("its coins stay modest: 50 over the first seven steps, 30 in the Big Chest, and four stickers", coins === 80 && S.MONTH_STEPS[7].gift.some((g) => g.coins === 30) && S.MONTH_STEPS.filter((s) => s.gift.some((g) => g.sticker)).length === 4, coins);
  reps(S, 30); p.clock.now += DAY; reps(S, 30);
  let m = S.roadState().month;
  ok("it is named for the month, counts this month's trophies, and marks what is reached", m.name === "October" && m.ym === "2026-10" && m.count === 60 && m.steps[0].reached && !m.steps[0].got && !m.steps[1].reached, m);
  ok("a step not reached is refused", !S.monthOpen(2).ok && S.coinsNow() === 0);
  const a = S.monthOpen(1);
  ok("a reached step opens once: 5 coins", a.ok && JSON.stringify(a.gifts) === JSON.stringify([{ coins: 5 }]) && !S.monthOpen(1).ok && S.coinsNow() === 5, a);
  m = S.roadState().month;
  ok("…and reads opened", m.steps[0].got && S.roadState().waiting === 1 + 0, { m, w: S.roadState().waiting });
});
sec("17b the month's end: every ended month handed out once, by the road page", () => {
  const p = boot(), { S } = p;
  p.local["sona.outcomes.v1"] = OCT20();
  ok("(20 goal days in October: 600 trophies)", S.trophyState().month === 600 && S.trophies() === 600, S.trophyState());
  ok("inside the ship month a first visit hands out nothing (October is still going)", S.roadSettle() === null && JSON.parse(p.local["sona.road.v1"]).m === "2026-10" && S.roadState().month.steps.every((s) => s.reached && !s.got) && S.coinsNow() === 0);
  const q = boot(); q.local["sona.outcomes.v1"] = OCT20(); q.clock.now = new Date(2026, 10, 5, 10).getTime();
  const before = q.S.roadState();
  ok("a child whose first road visit is in November: October's eight steps count as waiting before it loads", before.month.name === "November" && before.month.count === 0 && before.waiting === 8 + 8 && before.rolled.length === 0, before);
  const s = q.S.roadSettle();
  ok("…and the visit hands out every October step: 80 coins and four stickers", s && s.rolled.length === 1 && s.rolled[0].m === "2026-10" && q.S.coinsNow() === 80 && Object.keys(JSON.parse(q.local["sona.stickers.v1"])).length === 4, s);
  const st = q.S.roadState();
  ok("the month moved on, and the notice waits for the page to say it was seen", JSON.parse(q.local["sona.road.v1"]).m === "2026-11" && st.rolled.length === 1 && st.rolled[0].m === "2026-10" && st.waiting === 8, st);
  ok("a second settle hands out nothing", q.S.roadSettle() === null && q.S.coinsNow() === 80);
  q.S.roadRolledSeen();
  ok("once seen, the notice is gone and the coins stay", q.S.roadState().rolled.length === 0 && q.S.coinsNow() === 80);
  const e = boot(); e.local["sona.outcomes.v1"] = JSON.stringify({ R: { attempts: 99, passes: 0, days: { "2026-09-25": { tries: 30, a: 1, p: 0 }, "2026-09-28": { tries: 30, a: 1, p: 0 } } } });
  ok("months before the ship month are never handed out", e.S.roadSettle() === null && e.S.coinsNow() === 0 && JSON.parse(e.local["sona.road.v1"]).m === "2026-10");
});
sec("17c a gap of two months settles both, once each", () => {
  const p = boot(), { S } = p;
  p.clock.now = new Date(2026, 11, 3, 10).getTime();   // 3 December
  p.local["sona.trophy.v1"] = JSON.stringify({ v: 1, t: 900, d: "2026-11-30", dn: 30, m: "2026-11", mn: 200, pm: "2026-10", pmn: 300 });
  p.local["sona.road.v1"] = JSON.stringify({ got: {}, items: {}, m: "2026-10", mgot: { 1: 1 } });
  ok("before the road page loads, both months' steps count as waiting (with the 11 stops 900 trophies reach)", S.roadState().waiting === 11 + 3 + 3, S.roadState().waiting);
  const s = S.roadSettle();
  // October 300: steps 1..4 reached, step 1 opened then → 2, 3, 4; November 200: 1, 2, 3
  ok("October gives the steps not opened then, November every reached step, and the notice lists both",
    s && JSON.stringify(s.rolled.map((x) => x.m)) === JSON.stringify(["2026-10", "2026-11"]) && S.coinsNow() === 10 + 5 + 10 && Object.keys(JSON.parse(p.local["sona.stickers.v1"])).length === 3 && JSON.stringify(S.roadState().rolled.map((x) => x.m)) === JSON.stringify(["2026-10", "2026-11"]), s);
  ok("…once each: the next call returns null", S.roadSettle() === null && S.coinsNow() === 25);
  const c = boot(); c.local["sona.road.v1"] = JSON.stringify({ got: {}, items: {}, m: "2026-12", mgot: { 1: 1 } });
  ok("a phone clock set back before the month last visited settles nothing and keeps what was opened", c.S.roadSettle() === null && JSON.parse(c.local["sona.road.v1"]).m === "2026-12" && JSON.parse(c.local["sona.road.v1"]).mgot[1] === 1);
  // reps made while the clock is behind fill a month the road can't open
  // (opening it would open a month twice), so nothing says "Open!" for it
  const k = boot(); k.local["sona.road.v1"] = JSON.stringify({ got: {}, items: {}, m: "2026-12", mgot: {} });
  k.local["sona.trophy.v1"] = JSON.stringify({ v: 1, t: 20, d: "2026-10-20", dn: 0, m: "2026-10", mn: 120 });
  const ks = k.S.roadState();
  ok("…and with this month's trophies past two steps, no step reads reached and none counts as waiting", k.S.trophyState().month === 120 && ks.month.steps.every((x) => !x.reached) && ks.waiting === 0 && k.S.monthOpen(1).ok === false && k.S.coinsNow() === 0, { month: ks.month.steps.map((x) => x.reached), w: ks.waiting });
});

// ── 18. reading writes nothing, the ladder is never touched, and where it lives ──
sec("18a reading the chest, the road and the month writes nothing", () => {
  const p = boot(), { S } = p;
  reps(S, 30);
  p.local["sona.road.v1"] = JSON.stringify({ got: {}, items: {}, m: "2026-09", mgot: {} });   // a stop waiting, and a month never settled
  const before = snap(p);
  for (let i = 0; i < 10; i++) { S.chestState(); S.roadState(); S.roadStop(3); S.roadStop(40); S.trophyState(); S.coinsNow(); }
  ok("chestState, roadState and roadStop write no key, with a chest ready and a month to settle", snap(p) === before && S.chestState().ready && S.roadState().waiting >= 1);
  const q = boot({ profile: null });
  const b2 = snap(q);
  q.S.chestState(); q.S.roadState();
  ok("…nor on a phone with no child and no records", snap(q) === b2);
});
sec("18b the chest, the road and the month never write the speech ladder or the practice records", () => {
  const p = boot(), { S } = p;
  p.local["sona.progress.v1"] = JSON.stringify(S.getProgress());
  p.local["sona.today.v1"] = JSON.stringify({ d: "2026-10-20", sound: "R" });
  p.local["sona.rotation.v1"] = JSON.stringify({ i: 2 });
  const g0 = JSON.parse(p.local["sona.progress.v1"]); g0.stage = { R: 2 }; g0.rungWins = { "R:2": 1 }; p.local["sona.progress.v1"] = JSON.stringify(g0);
  p.local["sona.outcomes.v1"] = OCT20();
  p.local["sona.goaldays.v1"] = JSON.stringify({ "2026-10-20": 30 });
  const pin = () => JSON.stringify({ stage: S.getProgress().stage, rungWins: S.getProgress().rungWins, today: p.local["sona.today.v1"], rot: p.local["sona.rotation.v1"], out: S.outcomes(), att: p.local["sona.attempts.v1"] || null, gr: p.local["sona.gamereps.v1"] || null, goals: p.local["sona.goaldays.v1"], tro: p.local["sona.trophy.v1"] || null });
  const before = pin();
  for (let i = 0; i < 50; i++) { S.chestState(); S.chestOpen(); S.roadState(); S.roadOpen(1 + (i % 12)); S.monthOpen(1 + (i % 8)); S.roadSettle(); S.roadRolledSeen(); S.playLevelInfo("slice"); }
  ok("50 rounds of chest, road and month opens, settles and reads leave the stage, rung wins, today's sound, the rotation, outcomes, attempts, game reps, goal stamps and trophies byte-identical",
    pin() === before && S.coinsNow() > 100, { coins: S.coinsNow() });
});
sec("18c where CHEST1 and ROAD1 live in sona.js, and what they touch", () => {
  const ch = SRC.indexOf("// ── CHEST1"), rd = SRC.indexOf("// ── ROAD1"), tr = SRC.indexOf("// ── TROPHY1"), lv = SRC.indexOf("// ── LEVELS1"), bests = SRC.indexOf("// ── BESTS1:");
  ok("CHEST1 and ROAD1 sit after TROPHY1, before LEVELS1 and BESTS1, outside the GAMEASK1 window", tr > 0 && tr < ch && ch < rd && rd < lv && lv < bests && ch > SRC.indexOf("the week, narrated"));
  const code = SRC.slice(ch, lv).replace(/\/\/[^\n]*/g, "");
  const saves = code.match(/\bsave\(\s*[A-Z_a-z]+/g) || [];
  ok("their only writes are their own two ledgers (coins through addCoins, stickers and items through their own writers)", saves.length >= 4 && saves.every((x) => /^save\((CHESTKEY|ROADKEY)$/.test(x.replace(/\s/g, ""))), saves);
  ok("they never read a pass, a verdict, a best or access, and never write practice or send anything but their three events",
    !/\bpass\b|passes|hearVerdict|sendProgress|fetch\(|sendBeacon|logAttempt|gameRep\(|_trophyAdd|setItem|removeItem|gameAccess|premium\(|gated\(|sona\.bests|gameBest/.test(code) &&
    JSON.stringify((code.match(/\btrack\([^)]*\)/g) || []).sort()) === JSON.stringify(['track("chest opened")', 'track("month gift opened")', 'track("road gift opened")']), (code.match(/[^\n]*(track\(|fetch\(|setItem|gameBest)[^\n]*/g) || []).slice(0, 5));
  const route = readFileSync(path.resolve(ROOT, "..", "app/api/track/route.ts"), "utf8");
  const events = (route.match(/const EVENTS = new Set\(\[([\s\S]*?)\]\)/) || ["", ""])[1];
  ok("the relay takes the three gift events (each carries nothing: no stop, step or count)", ["chest opened", "road gift opened", "month gift opened"].every((e) => events.includes('"' + e + '"')));
  const line = (SRC.match(/\n\s*global\.Sona = \{[^\n]*\};/) || [""])[0];
  ok("the chest's and the road's names are on the one export line, before soundMark, clipsSettled", /\bchestState, chestOpen, ROAD_LANDS, ROAD_STOPS, MONTH_STEPS, roadStop, roadState, roadOpen, monthOpen, roadSettle, roadRolledSeen, (?:[\w$]+, )*soundMark, clipsSettled\b/.test(line));
  const codeOf = (f) => readFileSync(path.join(ROOT, f), "utf8").replace(/<!--[\s\S]*?-->/g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  ok("Home never opens, settles or sends: no chestOpen, roadOpen, monthOpen, roadSettle, roadRolledSeen or track( in today.html", !/chestOpen|roadOpen|monthOpen|roadSettle|roadRolledSeen|\btrack\(/.test(codeOf("today.html")));
  ok("the road and sticker pages fire no event themselves (sona.js says them)", ["road.html", "stickers.html"].every((f) => existsSync(path.join(ROOT, f)) && !/\btrack\(/.test(codeOf(f))));
});
sec("18d the words a child can see on the road, the sticker book and Home's road card", () => {
  const strip = (t) => t.replace(/<!--[\s\S]*?-->/g, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/<[^>]+>/g, " ");
  const home = readFileSync(path.join(ROOT, "today.html"), "utf8");
  const card = (home.match(/<a id="roadCard"[\s\S]*?<\/a>/) || [""])[0] + (home.match(/function paintRoad\(\)\{[\s\S]*?\n {4}\}/) || [""])[0];
  ok("(Home's road card and its painter are found)", card.length > 400, card.length);
  const text = ["road.html", "stickers.html"].map((f) => strip(readFileSync(path.join(ROOT, f), "utf8"))).join(" ") + strip(card) + JSON.stringify((SRC.match(/const ROAD_LANDS = \[[\s\S]*?const _ROAD_KINDS/) || [""])[0].replace(/\/\/[^\n]*/g, ""));
  const bad = text.match(/\b(score|points?|high score|rare|epic|legendary|mystery|you're back|missed|lost|behind|hurry|ends in|last chance|streak|days left|countdown)\b|\$\d/gi);
  ok("no word a child must never see (score, points, rare, mystery, missed, hurry, ends in, streak…) and no price", !bad, bad);
});

// ── 19. the Buddy Shop and the kept buddies (SHOP1, OWN1, step 7) ──
const LEGACY = {
  characters: ["fox", "bunny", "dragon", "cat", "bee", "octopus", "dino", "panda"],
  outfits: ["none", "crown", "tophat", "cap", "shades", "bow", "party"],
  backdrops: ["sky", "jungle", "forest", "mountain", "space", "beach"] };
const KINDS = Object.keys(LEGACY);
// a phone seeded the way main's rules say, plus whatever this test adds before sona.js first loads
const seeded = (extra = {}, profile = {}, src) => {
  const local = {};
  ["", "2", "3", "4", "5"].forEach((n) => { local["sona.freeera" + n + ".v1"] = n ? "done" : "post"; });
  local["sona.freever.v1"] = "kept";
  if (profile !== null) local["sona.profile.v1"] = JSON.stringify(Object.assign({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, voiceOn: false, soundOn: false, volume: 0 }, profile));
  Object.assign(local, extra);
  return boot({ local, src });
};
const POST = { "sona.buddyset.v1": "post" };
const prof = (p, slot) => JSON.parse(p.local[slot ? "sona.profile.v1@" + slot : "sona.profile.v1"] || "null");
const wallet = (p, n) => { const g = p.S.getProgress(); g.totals.coins = n; p.local[p.S.kkey("sona.progress.v1")] = JSON.stringify(g); };
const ownsAll = (S, set) => KINDS.every((k) => set[k].every((id) => S.owns(k, id)));
sec("19a the catalog: how a new family gets each item, and its price", () => {
  const { S } = boot();
  const want = { characters: { fox: null, bunny: null, panda: null, cat: 100, bee: 100, dino: 120, dragon: 150, octopus: 150 },
    outfits: { none: null, cap: 40, bow: 40, tophat: 60, shades: 60, crown: 80, party: 80 },
    backdrops: { sky: null, jungle: 80, forest: 80, mountain: 120, beach: 120, space: 150 } };
  const lists = { characters: S.CHARACTERS, outfits: S.OUTFITS, backdrops: S.BACKDROPS };
  const got = {}; KINDS.forEach((k) => { got[k] = {}; lists[k].forEach((it) => { got[k][it.id] = [it.source, it.cost]; }); });
  ok("every entry says how a new family gets it: the starters (fox, bunny, panda, no hat, the sky) cost nothing, every other item its table price",
    KINDS.every((k) => Object.keys(want[k]).every((id) => got[k][id] && got[k][id][0] === (want[k][id] === null ? "starter" : "shop") && got[k][id][1] === want[k][id])), got);
  ok("…and every entry is a starter, a shop item or a road item, a shop item with a whole price", KINDS.every((k) => lists[k].every((it) => ["starter", "shop", "road"].indexOf(it.source) >= 0 && (it.source !== "shop" || (Number.isInteger(it.cost) && it.cost > 0)))));
  ok("nothing was renamed or reordered: the fox is still item 0 (byId's fallback), and the eight buddies, seven hats and six places keep their order",
    JSON.stringify(KINDS.map((k) => lists[k].slice(0, LEGACY[k].length).map((it) => it.id))) === JSON.stringify(KINDS.map((k) => (k === "characters" ? ["fox", "bunny", "dragon", "cat", "bee", "octopus", "dino", "panda"] : k === "outfits" ? ["none", "crown", "tophat", "cap", "shades", "bow", "party"] : ["sky", "jungle", "forest", "mountain", "space", "beach"]))) && S.characterById("leo").id === "fox");
  const lit = (SRC.match(/const LEGACY_SET = \{[\s\S]*?\};/) || [""])[0];
  ok("LEGACY_SET is a literal of exactly what every family could pick on 11 Oct 2026", lit && KINDS.every((k) => new RegExp(k + ': \\[' + LEGACY[k].map((id) => '"' + id + '"').join(", ") + "\\]").test(lit)), lit);
});
sec("19b the sweep: a household already set up keeps everything, a new phone starts with the starters", () => {
  const p = seeded();
  ok("an onboarded phone on its first load of this build is stamped \"kept\"", p.local["sona.buddyset.v1"] === "kept" && p.S.buddiesKept() === true);
  ok("…and that child's profile now lists every buddy, hat and place it could pick", KINDS.every((k) => LEGACY[k].every((id) => prof(p).owned[k].indexOf(id) >= 0)), prof(p).owned);
  ok("…so it owns all of them", ownsAll(p.S, LEGACY));
  const two = seeded({ "sona.kids.v1": JSON.stringify({ active: "", hi: 3, list: [{ slot: "", name: "Mia" }, { slot: "k2", name: "Leo" }, { slot: "k3", name: "" }] }),
    "sona.profile.v1@k2": JSON.stringify({ childName: "Leo", childAge: "5", onboarded: true, owned: { outfits: ["none", "crown"], backdrops: ["sky"] }, volume: 0 }),
    "sona.profile.v1@k3": JSON.stringify({ childName: "", onboarded: false, volume: 0 }) });
  ok("every set-up child gets the list, keeping what was there; a child never set up gets nothing",
    KINDS.every((k) => LEGACY[k].every((id) => prof(two, "k2").owned[k].indexOf(id) >= 0)) && prof(two, "k2").owned.outfits.filter((x) => x === "crown").length === 1 && !prof(two, "k3").owned, [prof(two, "k2").owned, prof(two, "k3")]);
  const fresh = seeded({}, null);
  ok("a phone with no child yet is stamped \"post\", and writes no profile", fresh.local["sona.buddyset.v1"] === "post" && fresh.S.buddiesKept() === false && !fresh.local["sona.profile.v1"]);
  const kept = seeded(POST);
  ok("an existing stamp is never touched: an onboarded seed stamped \"post\" stays post, its profile unchanged", kept.local["sona.buddyset.v1"] === "post" && !prof(kept).owned);
  ok("…and on it a new family owns the three starter buddies, no hat and the sky, and nothing else",
    ["fox", "bunny", "panda"].every((id) => kept.S.owns("characters", id)) && kept.S.owns("outfits", "none") && kept.S.owns("backdrops", "sky") &&
    ["dragon", "cat", "bee", "octopus", "dino"].every((id) => !kept.S.owns("characters", id)) && ["crown", "tophat", "cap", "shades", "bow", "party"].every((id) => !kept.S.owns("outfits", id)) &&
    ["jungle", "forest", "mountain", "space", "beach"].every((id) => !kept.S.owns("backdrops", id)));
  const other = seeded({ "sona.freever.v1": "post", "sona.freeera5.v1": "" });
  ok("it reads no other sweep's stamp: a trial-first phone already set up still keeps its buddies", other.local["sona.buddyset.v1"] === "kept" && ownsAll(other.S, LEGACY));
  const reload = boot({ local: kept.local, clock: kept.clock });
  ok("…and a second load changes nothing", reload.local["sona.buddyset.v1"] === "post" && !prof(reload).owned);
  ok("a stamp nobody can read is \"kept\" (fails open: nothing is taken away)", (() => { const q = seeded(); delete q.local["sona.buddyset.v1"]; return q.S.buddiesKept() === true; })());
  const sw = SRC.indexOf("function _keepFreeVersion()"), kb = SRC.indexOf("function _keepBuddies()"), boot2 = SRC.indexOf("try { _keepFreeVersion(); } catch (e) {}");
  ok("the sweep sits right after _keepFreeVersion and runs right after it on load", sw > 0 && kb > sw && kb - sw < 3000 && /try \{ _keepFreeVersion\(\); \} catch \(e\) \{\}\n[^\n]*\n\s*try \{ _keepBuddies\(\); \} catch \(e\) \{\}/.test(SRC.slice(boot2, boot2 + 300)));
  const code = (SRC.match(/function _keepBuddies\(\) \{[\s\S]*?\n {2}\}\n/) || [""])[0];
  ok("…reading no free-era, trial or founding stamp", code.length > 200 && !/FREEVER|freeera|FREEERA|GFKEY|founding|earlyAdopter/.test(code));
});
sec("19c a brother or sister, and a move to a new phone", () => {
  const p = seeded();
  p.S.addKid("Leo", "5");
  ok("addKid on a kept phone gives the new child the whole list in their own profile", p.S.kkey("sona.profile.v1") === "sona.profile.v1@k2" && KINDS.every((k) => LEGACY[k].every((id) => prof(p, "k2").owned[k].indexOf(id) >= 0)) && ownsAll(p.S, LEGACY));
  const q = seeded(POST);
  q.S.addKid("Leo", "5");
  ok("addKid on a post phone gives only the defaults", JSON.stringify(prof(q, "k2").owned) === JSON.stringify({ outfits: ["none"], backdrops: ["sky"] }) && !q.S.owns("characters", "dragon") && q.S.owns("characters", "bunny"));
  const backup = p.S.exportString();
  ok("the kept stamp is in a backup (it is not on NO_EXPORT)…", /sona\.buddyset\.v1/.test(backup));
  const fresh = seeded({}, null);
  ok("(the new phone is \"post\")", fresh.local["sona.buddyset.v1"] === "post");
  const r = fresh.S.importData(backup);
  ok("…but a restore never brings it: the new phone stays \"post\"", r.ok && r.skipped >= 1 && fresh.local["sona.buddyset.v1"] === "post", r);
  ok("…and the household still owns every buddy, hat and place, on both children, because the list rode in each profile",
    ownsAll(fresh.S, LEGACY) && fresh.S.switchKid("") && ownsAll(fresh.S, LEGACY));
  const lone = seeded(POST, { owned: { characters: ["cat"] } });
  const from = lone.S.exportString(), into = seeded({}, null); into.S.importData(from);
  ok("a backup from a post phone carries what that family bought, and nothing more", into.S.owns("characters", "cat") && !into.S.owns("characters", "dragon"));
  // a backup made BEFORE the Buddy Shop carries no stamp and no list: that
  // household could pick everything, and the Terms promise a backup never
  // takes away an item a child already has
  const pre = JSON.stringify({ app: "sona", v: 1, data: { "sona.profile.v1": JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, character: "dragon", owned: { outfits: ["none"], backdrops: ["sky"] } }),
    "sona.kids.v1": JSON.stringify({ active: "", hi: 2, list: [{ slot: "", name: "Mia" }, { slot: "k2", name: "Leo" }] }),
    "sona.profile.v1@k2": JSON.stringify({ childName: "Leo", childAge: "5", onboarded: true }) } });
  const old = seeded({}, null); const ro = old.S.importData(pre);
  ok("a backup made before the Buddy Shop (no stamp), restored on a post phone: every child keeps every legacy item, in their own profile",
    ro.ok && old.local["sona.buddyset.v1"] === "post" && ownsAll(old.S, LEGACY) && KINDS.every((k) => LEGACY[k].every((id) => prof(old).owned[k].indexOf(id) >= 0 && prof(old, "k2").owned[k].indexOf(id) >= 0)) && old.S.switchKid("k2") && ownsAll(old.S, LEGACY), [ro, prof(old), prof(old, "k2")]);
  // a kept phone whose child was set up after the sweep ran (mid-setup that
  // day) has a profile without the list; the backup's "kept" brings it
  const midway = seeded({ "sona.buddyset.v1": "kept" }, { onboarded: false, childName: "" });
  midway.S.saveProfile({ childName: "Ana", onboarded: true });
  const mb = JSON.parse(midway.S.exportString());
  const lacked = !(JSON.parse(mb.data["sona.profile.v1"]).owned || {}).characters, dest = seeded({}, null); dest.S.importData(mb);
  ok("a kept phone's backup gives the list to a child whose profile was saved without it", lacked && mb.data["sona.buddyset.v1"] === "kept" && ownsAll(dest.S, LEGACY) && dest.local["sona.buddyset.v1"] === "post", JSON.parse(dest.local["sona.profile.v1"]).owned);
  const postOnly = seeded({}, null); postOnly.S.importData({ app: "sona", v: 1, data: { "sona.buddyset.v1": "post", "sona.profile.v1": JSON.stringify({ childName: "Zoe", childAge: "6", onboarded: true }) } });
  ok("…while a backup stamped \"post\" brings no legacy item, and a profile never set up gets no list", !postOnly.S.owns("characters", "dragon") && !JSON.parse(postOnly.local["sona.profile.v1"]).owned &&
    (() => { const q = seeded({}, null); q.S.importData({ app: "sona", v: 1, data: { "sona.profile.v1": JSON.stringify({ childName: "", onboarded: false }) } }); return !JSON.parse(q.local["sona.profile.v1"]).owned; })());
  const noImport = (SRC.match(/const NO_IMPORT = \[[\s\S]*?\];/) || [""])[0], noExport = (SRC.match(/const NO_EXPORT = \[[^\]]*\]/) || [""])[0];
  ok("sona.buddyset.v1 is on NO_IMPORT, not NO_EXPORT, and its name is not a rep or week key", /"sona\.buddyset\.v1"/.test(noImport) && !/buddyset/.test(noExport) && !/rep|week/i.test("sona.buddyset.v1"));
});
sec("19d what the shop shows, and buying with coins", () => {
  const k = seeded();
  ok("on a kept phone every legacy item shows as owned, with no price", KINDS.every((kd) => LEGACY[kd].every((id) => { const it = k.S.shopItem(kd, id); return it.state === "owned" && it.kind === kd && it.id === id; })));
  ok("…and buying one is refused as already owned, for no coins", k.S.buyItem("characters", "dragon").reason === "owned" && k.S.coinsNow() === 0);
  const p = seeded(POST), { S } = p;
  const dr = S.shopItem("characters", "dragon");
  ok("on a post phone the dragon is for 150 coins, with its name and its painted badge", JSON.stringify(dr) === JSON.stringify({ kind: "characters", id: "dragon", name: "Ziggy", cost: 150, source: "shop", stop: null, at: null, art: "/assets/crafted/buddy-dragon-v2.webp", state: "buy" }), dr);
  ok("a hat's and a place's entries", S.shopItem("outfits", "crown").cost === 80 && S.shopItem("outfits", "crown").state === "buy" && S.shopItem("backdrops", "beach").art === "/assets/crafted/customize-beach-v2.webp" && S.shopItem("outfits", "none").state === "owned" && S.shopItem("outfits", "none").cost === null);
  ok("an unknown id is null (an old \"leo\" is no shop item), and so is an unknown kind", S.shopItem("characters", "leo") === null && S.shopItem("hats", "crown") === null && S.shopItem("constructor", "fox") === null && S.owns("characters", "leo") === false);
  const sent = []; p.ctx.fetch = (u, o) => { sent.push([u, o && o.body]); return Promise.reject(new Error("offline")); };
  wallet(p, 149);
  const short = S.buyItem("characters", "dragon");
  ok("one coin short: refused, with how many more it needs, and nothing changes", JSON.stringify(short) === JSON.stringify({ ok: false, reason: "short", need: 1 }) && S.coinsNow() === 149 && !S.owns("characters", "dragon") && sent.length === 0, short);
  wallet(p, 150);
  const got = S.buyItem("characters", "dragon");
  const lb = prof(p).lastBuy;
  ok("with exactly the price: the dragon is theirs, worn, and the coins go down by exactly 150", got.ok && got.coins === 0 && S.coinsNow() === 0 && S.owns("characters", "dragon") && prof(p).character === "dragon" && prof(p).owned.characters.indexOf("dragon") >= 0, got);
  ok("…and the buy is remembered for the undo: what, how much, what was worn before, when", lb && lb.kind === "characters" && lb.id === "dragon" && lb.cost === 150 && lb.prev === "fox" && lb.at === p.clock.now, lb);
  const ev = sent.map((x) => JSON.parse(x[1]));
  ok("one \"shop item got\" event, carrying the kind, the item and its price, and nothing about the child", sent.length === 1 && /\/api\/track/.test(sent[0][0]) && ev[0].e === "shop item got" && JSON.stringify(ev[0].p) === JSON.stringify({ kind: "characters", item: "dragon", cost: 150 }), ev);
  ok("buying it again is refused as owned", S.buyItem("characters", "dragon").reason === "owned");
  ok("junk is refused: an unknown id or kind", S.buyItem("characters", "leo").reason === "bad" && S.buyItem("nope", "x").reason === "bad" && S.buyItem().reason === "bad");
  const road = seeded(POST, {}, SRC.replace("{ n: 6, at: 380, gift: [{ coins: 50 }] }", '{ n: 6, at: 380, gift: [{ coins: 50 }, { hat: "sunhat" }] }')
    .replace('{ id: "party",  name: "Party",  emoji: "🥳", source: "shop", cost: 80 },', '$&\n    { id: "sunhat", name: "Sun hat", emoji: "👒", source: "road", cost: null },'));
  wallet(road, 999);
  const sh = road.S.shopItem("outfits", "sunhat");
  ok("(this test's table names the Sun hat on stop 6) a road item shows its stop and trophies, with no price", sh && sh.state === "road" && sh.stop === 6 && sh.at === 380 && sh.cost === null, sh);
  ok("…and can't be bought, whatever the wallet holds", JSON.stringify(road.S.buyItem("outfits", "sunhat")) === JSON.stringify({ ok: false, reason: "road" }) && road.S.coinsNow() === 999 && !road.S.owns("outfits", "sunhat"));
});
sec("19e giving it back within 10 seconds", () => {
  const p = seeded(POST), { S } = p;
  wallet(p, 200);
  S.buyItem("characters", "dragon");
  p.clock.now += 9000;
  const u = S.undoBuy();
  ok("within 10 s: the dragon goes, the 150 coins come back, the fox is worn again", u.ok && S.coinsNow() === 200 && !S.owns("characters", "dragon") && prof(p).character === "fox" && !prof(p).lastBuy, u);
  ok("…once: a second undo gives nothing", S.undoBuy().ok === false && S.coinsNow() === 200);
  S.buyItem("backdrops", "space");
  p.clock.now += 10001;
  ok("after 10 s it is refused and the place stays theirs", S.undoBuy().ok === false && S.owns("backdrops", "space") && S.coinsNow() === 50);
  S.buyItem("outfits", "cap"); S.equip("outfits", "none");
  ok("if the child has already put something else on, giving it back leaves that on", S.undoBuy().ok && prof(p).outfit === "none" && !S.owns("outfits", "cap") && S.coinsNow() === 50);
  p.clock.now += 60000;
  S.buyItem("outfits", "bow"); p.clock.now -= 5000;
  ok("a clock set back before the buy refuses the undo", S.undoBuy().ok === false && S.owns("outfits", "bow"));
  const f = seeded(POST, { owned: { characters: ["dragon"] }, character: "dragon", lastBuy: { kind: "characters", id: "dragon", cost: 99999, prev: "fox", at: new Date(2026, 9, 20, 10, 0, 0).getTime() } });
  const fu = f.S.undoBuy();
  ok("a forged undo never pays back more than the catalog price", fu.ok && f.S.coinsNow() === 150, fu);
  const g = seeded(POST, { lastBuy: { kind: "characters", id: "dragon", cost: 150, prev: "fox", at: new Date(2026, 9, 20, 10, 0, 0).getTime() } });
  ok("an undo for something the child doesn't have pays nothing", g.S.undoBuy().ok === false && g.S.coinsNow() === 0);
});
sec("19f wearing: only what is yours, and what you wear is yours", () => {
  const p = seeded(POST), { S } = p;
  ok("equip refuses what the child doesn't own", S.equip("characters", "dragon") === false && prof(p).character !== "dragon");
  ok("…and wears what they do", S.equip("characters", "panda") === true && prof(p).character === "panda" && S.equip("outfits", "none") && S.equip("backdrops", "sky"));
  ok("equip refuses an unknown kind or id", S.equip("hats", "crown") === false && S.equip("characters", "leo") === false);
  const w = seeded(POST, { character: "dragon", outfit: "crown" });
  ok("a buddy worn before the shop (a backup from before it, say) is owned while worn", w.S.owns("characters", "dragon") && w.S.shopItem("characters", "dragon").state === "owned" && w.S.owns("outfits", "crown"));
  ok("switching away writes it into the child's own list first, so it is never lost", w.S.equip("characters", "fox") && prof(w).owned.characters.indexOf("dragon") >= 0 && w.S.owns("characters", "dragon") && w.S.equip("characters", "dragon"));
  const leo = seeded(POST, { character: "leo" });
  ok("an old \"leo\" pick switches to a starter without inventing a buddy", leo.S.equip("characters", "bunny") && !(prof(leo).owned.characters || []).length && prof(leo).character === "bunny");
});
sec("19g the shop only reads when it shows, and never touches practice", () => {
  const p = seeded(POST), { S } = p;
  wallet(p, 500);
  const before = snap(p);
  for (let i = 0; i < 5; i++) KINDS.forEach((k) => (k === "characters" ? S.CHARACTERS : k === "outfits" ? S.OUTFITS : S.BACKDROPS).forEach((it) => { S.shopItem(k, it.id); S.owns(k, it.id); }));
  S.buddiesKept(); S.coinsNow();
  ok("shopItem, owns and buddiesKept write no key", snap(p) === before);
  p.local["sona.today.v1"] = JSON.stringify({ d: "2026-10-20", sound: "R" });
  p.local["sona.rotation.v1"] = JSON.stringify({ i: 2 });
  const g0 = JSON.parse(p.local["sona.progress.v1"]); g0.stage = { R: 2 }; g0.rungWins = { "R:2": 1 }; p.local["sona.progress.v1"] = JSON.stringify(g0);
  p.local["sona.outcomes.v1"] = OCT20();
  const pin = () => JSON.stringify({ stage: S.getProgress().stage, rungWins: S.getProgress().rungWins, today: p.local["sona.today.v1"], rot: p.local["sona.rotation.v1"], out: S.outcomes(), att: p.local["sona.attempts.v1"] || null, gr: p.local["sona.gamereps.v1"] || null, tro: p.local["sona.trophy.v1"] || null, goals: p.local["sona.goaldays.v1"] || null });
  const pinned = pin();
  for (let i = 0; i < 50; i++) { S.buyItem("characters", ["cat", "bee", "dino"][i % 3]); S.undoBuy(); S.equip("characters", ["fox", "bunny", "panda"][i % 3]); S.shopItem("backdrops", "beach"); S.buyItem("outfits", "cap"); }
  ok("50 rounds of buying, giving back and wearing leave the stage, rung wins, today's sound, the rotation, outcomes, attempts, game reps, trophies and goal stamps byte-identical", pin() === pinned, { coins: S.coinsNow() });
  const at = SRC.indexOf("const LEGACY_SET = {"), end = SRC.indexOf("function undoBuy()"), wal = SRC.indexOf("function spendCoins(n)"), ga = SRC.indexOf("GAMEASK1"), wk = SRC.indexOf("the week, narrated", ga);
  ok("SHOP1 sits next to owns, by the wallet, outside the GAMEASK1 window", at > wal && at - wal < 2000 && end > at && (at > wk || end < ga));
  const code = SRC.slice(at, SRC.indexOf("\n  }\n", end) + 4).replace(/\/\/[^\n]*/g, "");
  ok("its writes go only through the profile and the wallet, and it sends only \"shop item got\"",
    !/\bsave\(|setItem|removeItem|fetch\(|sendBeacon|logAttempt|gameRep\(|_trophyAdd|\bpass\b|hearVerdict|gameAccess|premium\(|sona\.bests|gameBest/.test(code) &&
    JSON.stringify(code.match(/\btrack\("[^"]*"/g)) === JSON.stringify(['track("shop item got"']), (code.match(/[^\n]*(save\(|setItem|track\()[^\n]*/g) || []).slice(0, 4));
  const line = (SRC.match(/\n\s*global\.Sona = \{[^\n]*\};/) || [""])[0];
  ok("the shop's names are on the one export line, before soundMark, clipsSettled, and owns, addOwned, the wallet and the catalogs keep theirs",
    /\bbuddiesKept, shopItem, buyItem, undoBuy, equip, (?:[\w$]+, )*soundMark, clipsSettled\b/.test(line) && /\bowns, addOwned\b/.test(line) && /\bgetCoins, addCoins, spendCoins\b/.test(line) && /\bCHARACTERS, OUTFITS, BACKDROPS\b/.test(line));
  const route = readFileSync(path.resolve(ROOT, "..", "app/api/track/route.ts"), "utf8");
  const events = (route.match(/const EVENTS = new Set\(\[([\s\S]*?)\]\)/) || ["", ""])[1], props = (route.match(/const PROPS = new Set\(\[([^\]]*)\]\)/) || ["", ""])[1];
  ok("the relay takes \"shop item got\" and its three props (kind, item, cost), and still no stop or step", events.includes('"shop item got"') && ['"kind"', '"item"', '"cost"'].every((x) => props.includes(x)) && !/"(stop|step)"/.test(props), props);
});
sec("19h the shop page", () => {
  const html = readFileSync(path.join(ROOT, "customize.html"), "utf8");
  const code = html.replace(/<!--[\s\S]*?-->/g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  ok("the dead beta branch is gone: no `var owned = true`, no undeclared coins or setCoinBal, no confirm or alert, no \"leo\" default", !/var owned = true|setCoinBal|\bconfirm\(|\balert\(|\|\|\s*"leo"/.test(code) && /S\.buddyId\(\)/.test(code));
  ok("it spends through Sona.buyItem and gives back through Sona.undoBuy, and sends no event itself", /\.buyItem\(/.test(code) && /\.undoBuy\(/.test(code) && !/\btrack\(/.test(code) && !/addOwned\(/.test(code));
  // what a child can read: the markup's text, and every sentence the script
  // writes (a string literal with a capital letter or ending like a sentence;
  // a state name like "buy" from sona.js is not copy)
  const markup = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  const said = [...code.replace(/[\s\S]*?<script>/, "").matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map((m) => m[1]).filter((t) => /[A-Z]|[.!?]$/.test(t) && !/^[A-Z_]+$|^\/|^[#.]|^\[|svg|\.webp/.test(t));
  const text = markup + " " + said.join(" | ");
  ok("(the page's sentences are found: \"Hold to get it!\", \"It's yours!\")", said.includes("Hold to get it!") && said.includes("It's yours!") && said.includes("Open chests to earn coins!"), said.slice(0, 12));
  const bad = text.match(/\b(score|points?|high score|rare|epic|legendary|mystery|you're back|missed|lost|behind|hurry|ends in|last chance|streak|countdown|buy|bought|purchase|price)\b|\$/gi);
  ok("no word a child must never see, and no buy, purchase or price, and no dollar sign", !bad, bad);
});

console.log(fails ? `\n${fails} FAILED` : "\nall trophy and coin checks passed");
process.exit(fails ? 1 : 0);
