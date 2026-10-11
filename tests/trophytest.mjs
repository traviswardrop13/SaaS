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
// The daily chest, the Trophy Road, the shop and game levels are added to this
// suite by the steps that build them.
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
  vm.runInContext(readFileSync(ROOT + "/sona.js", "utf8"), ctx, { filename: "sona.js" });
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
  // customize.html still carries a buy branch that never runs (its shop sets
  // `var owned = true` for every item); the Buddy Shop rebuild replaces it, and
  // from then on it is held to this rule like every page.
  const deadShop = (f, src) => f === "customize.html" && /var owned = true; \/\/ beta/.test(src);
  const payers = pages.filter((f) => { const src = readFileSync(path.join(pub, f), "utf8"); return /\b(addCoins|spendCoins)\(/.test(deadShop(f, src) ? src.replace(/[^\n]*Sona\.spendCoins\(it\.cost\)[^\n]*/, "") : src); });
  ok("no page pays or takes coins itself: no addCoins( or spendCoins( in any public page (end cards, the daily run, Coach Call, the story)", pages.length > 40 && payers.length === 0, payers);
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
  S.getProgress();   // a brand-new child's first read saves the ladder migration once; that is not ours
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
  const block = SRC.slice(at, bests), code = block.replace(/\/\/[^\n]*/g, "");
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
    exp.length > 1000 && /trophyState, trophies, coinsNow, soundMark, clipsSettled, storePlan, buyPlan, planWords, planSay, planBillDate, setupWall, setupAfterMark, setupAfter, setupAfterClear, setupAsks, setupAsksSave, SETUP_THERAPY \};\n$/.test(exp) && /\bmintCoins, mintStoryBonus\b/.test(exp));
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

console.log(fails ? `\n${fails} FAILED` : "\nall trophy and coin checks passed");
process.exit(fails ? 1 : 0);
