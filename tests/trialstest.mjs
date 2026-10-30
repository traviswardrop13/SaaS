// TRIAL1: the free-week report (Travis, 30 Oct 2026, of "most of them
// cancel": which families who start a free trial play on each of its days,
// and which of them pay). Played against an in-memory Upstash behind the
// real kvCmd, with nothing else stubbed:
//   - lib/trials.ts: a trial's start (never moved), its days with play (day 1
//     is the first 24 hours), and how it ended (paid stays paid, an end after
//     a cancellation stays a cancellation, a cancellation undone clears it, a
//     message older than the last one changes nothing, a purchase charged
//     today is no trial), and the report built from them;
//   - /api/track keeps "free trial started" ({ days }) and "played today"
//     (nothing else) and still relays them, with no other property;
//   - /api/revenuecat hears how a trial went by the anonymous id the phone
//     handed RevenueCat (`sona_fid`), with or without an email;
//   - /api/founders/trials answers only the founder key, and returns no id;
//   - the phone's side in sona.js and /leads.html's section.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { NextRequest } = require(path.join(REPO, "node_modules/next/server"));
let fails = 0, passes = 0;
const ok = (name, cond, info) => {
  if (cond) { passes++; console.log("PASS " + name); }
  else { fails++; console.log("FAIL " + name + (info === undefined ? "" : "  → " + JSON.stringify(info).slice(0, 600))); }
};
async function scenario(label, run) { try { await run(); } catch (e) { ok(label + " completes", false, e.stack); } }
const read = (f) => readFileSync(path.join(REPO, f), "utf8");

// TS to CommonJS, "@/x" to the repo (rcwebhooktest's loader)
function loadTs(file, stubs = {}, cache = new Map()) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const req = (s) => stubs[s] || (s.startsWith("@/") ? loadTs(path.join(REPO, s.slice(2) + ".ts"), stubs, cache)
    : s === "next/server" ? require(path.join(REPO, "node_modules/next/server")) : require(s));
  new Function("require", "module", "exports", js)(req, mod, mod.exports);
  return mod.exports;
}

// ── the store behind the real kvCmd: Upstash REST, POST [cmd, ...args] → {result} ──
const KV_URL = "https://kv.trials.test.invalid";
const KV = { K: new Map(), H: new Map(), Z: new Map(), T: new Map(), log: [] };
function kvExec([op, ...a]) {
  a = a.map((x) => (typeof x === "number" ? x : String(x)));
  const h = (k) => KV.H.get(k) || new Map();
  switch (op) {
    case "HSETNX": { const m = h(a[0]); if (m.has(a[1])) return 0; m.set(a[1], String(a[2])); KV.H.set(a[0], m); return 1; }
    case "HSET": { const m = h(a[0]); for (let i = 1; i + 1 < a.length; i += 2) m.set(String(a[i]), String(a[i + 1])); KV.H.set(a[0], m); return 1; }
    case "HGET": return h(a[0]).has(String(a[1])) ? h(a[0]).get(String(a[1])) : null;
    case "HDEL": return h(a[0]).delete(String(a[1])) ? 1 : 0;
    case "HGETALL": return [...h(a[0])].flat();
    case "EXPIRE": KV.T.set(a[0], Number(a[1])); return 1;
    case "ZADD": { const z = KV.Z.get(a[0]) || new Map(); z.set(String(a[2]), Number(a[1])); KV.Z.set(a[0], z); return 1; }
    case "ZRANGEBYSCORE": {
      const min = a[1] === "-inf" ? -Infinity : Number(a[1]), max = a[2] === "+inf" ? Infinity : Number(a[2]);
      return [...(KV.Z.get(a[0]) || new Map())].filter(([, s]) => s >= min && s <= max).sort((x, y) => x[1] - y[1]).map(([m]) => m);
    }
    case "ZREMRANGEBYSCORE": {
      const z = KV.Z.get(a[0]) || new Map(), min = a[1] === "-inf" ? -Infinity : Number(a[1]), max = Number(a[2]);
      let n = 0; for (const [m, s] of [...z]) if (s >= min && s <= max) { z.delete(m); n++; } return n;
    }
    case "EXISTS": return KV.K.has(a[0]) || KV.H.has(a[0]) ? 1 : 0;
    case "SET": KV.K.set(a[0], String(a[1])); return "OK";
    case "GET": return KV.K.has(a[0]) ? KV.K.get(a[0]) : null;
    default: throw new Error("fake kv does not speak " + op);
  }
}
const CAPTURED = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u === KV_URL) { const cmd = JSON.parse(init.body); KV.log.push(cmd); return Response.json({ result: kvExec(cmd) }); }
  if (u === "https://us.i.posthog.com/capture/") { CAPTURED.push(JSON.parse(init.body)); return Response.json({ status: 1 }); }
  if (u === "https://api.resend.com/emails") return Response.json({ id: "re_1" });
  throw new Error("unexpected outbound call " + u);
};
const reset = () => { KV.K.clear(); KV.H.clear(); KV.Z.clear(); KV.T.clear(); KV.log.length = 0; CAPTURED.length = 0; };
process.env.KV_REST_API_URL = KV_URL; process.env.KV_REST_API_TOKEN = "t";

const T = loadTs(path.join(REPO, "lib/trials.ts"));
const DAY = 86400000, HOUR = 3600000;
const FID = "fid_abcdef123456", FID2 = "fid_zzzzzz999999", FID3 = "fid_cccccc333333";
const trial = (fid) => Object.fromEntries(KV.H.get("trial:" + fid) || new Map());

// ── 1. the store ──
await scenario("the store", async () => {
  reset();
  const t0 = Date.UTC(2026, 9, 30, 18, 0, 0);
  await T.trialStart(FID, 7, t0);
  await T.trialStart(FID, 3, t0 + DAY);
  ok("a trial's start and length are kept, and never moved by a second start", trial(FID).s === String(t0) && trial(FID).n === "7", trial(FID));
  ok("…in the index, for 120 days", (KV.Z.get("trials:idx") || new Map()).get(FID) === t0 && KV.T.get("trial:" + FID) === 120 * 86400);
  await T.trialPlayed(FID, t0 + 2 * HOUR);
  await T.trialPlayed(FID, t0 + 2 * DAY + HOUR);
  await T.trialPlayed(FID2, t0);                     // no trial for this id: nothing kept
  await T.trialPlayed(FID, t0 - HOUR);               // before the start: nothing
  ok("a day with play is marked by its place from the start (day 1 = the first 24 hours)", trial(FID).p0 === "1" && trial(FID).p2 === "1" && !trial(FID).p1 && !KV.H.has("trial:" + FID2), trial(FID));
  await T.trialPlayed("bad id!", t0);
  ok("an id that is not one of the phone's is never kept", ![...KV.H.keys()].some((k) => /bad/.test(k)));

  await T.trialOutcome(FID, "cancelled", t0 + DAY, 0);
  ok("a cancellation is kept", trial(FID).o === "cancelled");
  await T.trialOutcome(FID, "trial", t0 + 1.5 * DAY, 7);
  ok("…undone (RevenueCat's UNCANCELLATION in the free days) clears it", !trial(FID).o && trial(FID).s === String(t0), trial(FID));
  await T.trialOutcome(FID, "cancelled", t0 + DAY, 0);
  ok("…and an older message landing after the newer changes nothing", !trial(FID).o, trial(FID));
  await T.trialOutcome(FID, "paid", t0 + 7 * DAY, 0);
  await T.trialOutcome(FID, "cancelled", t0 + 20 * DAY, 0);
  ok("paid stays paid: a later cancellation of a paid month is not how the trial ended", trial(FID).o === "paid", trial(FID));
  await T.trialStart(FID2, 3, t0);
  await T.trialOutcome(FID2, "cancelled", t0 + DAY, 0);
  await T.trialOutcome(FID2, "ended", t0 + 3 * DAY, 0);
  ok("an end after a cancellation stays a cancellation", trial(FID2).o === "cancelled", trial(FID2));
  await T.trialOutcome(FID3, "paid", t0, 0);
  ok("a purchase charged today (no trial kept for it) is no trial", !KV.H.has("trial:" + FID3));
  await T.trialOutcome(FID3, "trial", t0, 3);
  ok("RevenueCat's own word that a trial started starts one, with its length", trial(FID3).s === String(t0) && trial(FID3).n === "3", trial(FID3));
});

// ── 2. the report ──
await scenario("the report", async () => {
  reset();
  const now = Date.UTC(2026, 10, 20, 12);
  const mk = async (fid, startAgo, days, played, outcome) => {
    const s = now - startAgo;
    await T.trialStart(fid, days, s);
    for (const d of played) await T.trialPlayed(fid, s + (d - 1) * DAY + HOUR);
    if (outcome) await T.trialOutcome(fid, outcome, s + days * DAY, 0);
  };
  await mk("fid_aaaaaaaa0001", 10 * DAY, 3, [1, 2, 3], "paid");
  await mk("fid_aaaaaaaa0002", 10 * DAY, 3, [1], "cancelled");
  await mk("fid_aaaaaaaa0003", 10 * DAY, 3, [], "ended");
  await mk("fid_aaaaaaaa0004", 10 * DAY, 3, [1, 3], null);     // past its days, RevenueCat silent
  await mk("fid_aaaaaaaa0005", 1.5 * DAY, 3, [1], null);       // still on free days, day 2 under way
  await mk("fid_aaaaaaaa0006", 200 * DAY, 3, [1], "paid");     // older than the report's 90 days
  const r = await T.readTrials(now);
  ok("the report counts the last 90 days' trials and how each ended (open: still on free days, or RevenueCat silent)",
    r.total === 5 && r.outcomes.paid === 1 && r.outcomes.cancelled === 1 && r.outcomes.ended === 1 && r.outcomes.open === 2, r.outcomes);
  const d = Object.fromEntries(r.byDay.map((x) => [x.day, x]));
  ok("…each day's play, over only the trials that have reached that day",
    d[1].of === 5 && d[1].played === 4 && d[2].of === 5 && d[2].played === 1 && d[3].of === 4 && d[3].played === 2, r.byDay);
  const p = Object.fromEntries(r.byPlay.map((x) => [x.label, x]));
  ok("…and for finished trials, how many paid by how many days they played",
    p["Never played"].trials === 1 && p["Played 1 day"].trials === 1 && p["Played 2 days"].trials === 1 && p["Played 3+ days"].trials === 1 && p["Played 3+ days"].paid === 1 && p["Played 1 day"].paid === 0, r.byPlay);
  ok("…with no id anywhere in it", !JSON.stringify(r).includes("fid_"), JSON.stringify(r).slice(0, 300));
});

// ── 3. the routes ──
await scenario("the routes", async () => {
  reset();
  const track = loadTs(path.join(REPO, "app/api/track/route.ts"));
  const post = (body) => track.POST(new NextRequest("https://www.speaksona.com/api/track", { method: "POST", body: JSON.stringify(body) }));
  await post({ e: "free trial started", p: { days: 7, name: "Mia", plan: "monthly" }, fid: FID });
  await post({ e: "played today", p: { sound: "R" }, fid: FID });
  ok("/api/track keeps a trial's start and today's play under the anonymous id", trial(FID).s && trial(FID).n === "7" && trial(FID).p0 === "1", trial(FID));
  const cap = CAPTURED.map((c) => ({ e: c.event, p: Object.keys(c.properties).sort().join() }));
  ok("…and relays both, with only what the allow-list lets through (never a name)",
    cap.length === 2 && cap[0].e === "free trial started" && !/name/.test(cap[0].p) && /days/.test(cap[0].p) && cap[1].e === "played today", cap);

  const rc = loadTs(path.join(REPO, "app/api/revenuecat/route.ts"));
  process.env.REVENUECAT_WEBHOOK_AUTH = "rc-trials-secret-0123456789";
  const hook = (event) => rc.POST(new NextRequest("https://www.speaksona.com/api/revenuecat", {
    method: "POST", headers: { authorization: "rc-trials-secret-0123456789" }, body: JSON.stringify({ event }) }));
  const t0 = Date.now() - HOUR;
  const base = { app_user_id: "$RCAnonymousID:abc", environment: "PRODUCTION", subscriber_attributes: { sona_fid: { value: FID2, updated_at_ms: t0 } } };
  let res = await (await hook({ ...base, id: "evt-1", type: "INITIAL_PURCHASE", period_type: "TRIAL", purchased_at_ms: t0, expiration_at_ms: t0 + 7 * DAY, event_timestamp_ms: t0 })).json();
  ok("/api/revenuecat: a free trial starting, from a family who gave no email, still starts its row (and is otherwise ignored, as before)",
    trial(FID2).s === String(t0) && trial(FID2).n === "7" && res.ignored === "no email", [trial(FID2), res]);
  res = await (await hook({ ...base, id: "evt-2", type: "RENEWAL", period_type: "NORMAL", purchased_at_ms: t0 + 7 * DAY, expiration_at_ms: t0 + 37 * DAY, event_timestamp_ms: t0 + 7 * DAY })).json();
  ok("…its free days becoming a paid month mark it paid", trial(FID2).o === "paid", trial(FID2));
  const sandbox = await hook({ ...base, id: "evt-3", type: "CANCELLATION", period_type: "TRIAL", environment: "SANDBOX", subscriber_attributes: { sona_fid: { value: FID3 } }, event_timestamp_ms: t0 });
  ok("…Apple's sandbox changes nothing", sandbox.status === 200 && !KV.H.has("trial:" + FID3));
  const wrong = await hook({ ...base, id: "evt-4", type: "CANCELLATION", subscriber_attributes: { sona_fid: { value: "<script>" } }, event_timestamp_ms: t0 });
  ok("…an id that is not one of the phone's is never kept", wrong.status === 200 && ![...KV.H.keys()].some((k) => /script/.test(k)));

  const fr = loadTs(path.join(REPO, "app/api/founders/trials/route.ts"));
  process.env.FOUNDER_KEY = "founder-trials-0123456789";
  const get = (key) => fr.GET(new NextRequest("https://www.speaksona.com/api/founders/trials", { headers: key ? { "x-founder-key": key } : {} }));
  ok("/api/founders/trials answers only the founder key", (await get("")).status === 401 && (await get("wrong-key-0123456789x")).status === 401);
  const j = await (await get("founder-trials-0123456789")).json();
  ok("…with the report and no id", j.ok && j.total === 2 && j.outcomes.paid === 1 && !JSON.stringify(j).includes("fid_"), j);
});

// ── 4. the phone and the page ──
await scenario("the source", async () => {
  const src = read("public/sona.js");
  ok("the phone hands RevenueCat the anonymous family id (sona_fid), feature-checked, never waited on",
    /typeof P\.setAttributes === "function"\) \{ const id = fid\(\); if \(id\) _soon\(\(\) => P\.setAttributes\(\{ sona_fid: id \}\)\)\.catch\(\(\) => \{\}\); \}/.test(src));
  const told = (src.match(/\n  function _trialTold\(r, plan\) \{[\s\S]*?\n  \}\n/) || [""])[0];
  ok("\"free trial started\" is sent from buyPlan's success, only for free days (Apple's TRIAL, or a card sure it sold them), with their length and nothing else",
    /_trialRemindBought\(r, plan\); _trialTold\(r, plan\);/.test(src) && /track\("free trial started", days \? \{ days: days \} : \{\}\)/.test(told) && /plan\.sure === true/.test(told));
  const played = (src.match(/\n  function _playedToday\(\) \{[\s\S]*?\n  \}\n/) || [""])[0];
  ok("\"played today\" is sent once a local day, from the first counted rep (_goalCheck), with nothing in it",
    /track\("played today"\);/.test(played) && /if \(was === t\) return;/.test(played) && /function _goalCheck\(\) \{\s*try \{ _boardSendLeaves\(true\); \} catch \(e\) \{\}[^\n]*\n\s*try \{ _playedToday\(\); \} catch \(e\) \{\}/.test(src) && /function _playedToday\(\) \{\s*if \(_notifyHome\(\)\) return;/.test(src));
  const noExport = (src.match(/const NO_EXPORT = \[[^\]]*\]/) || [""])[0], noImport = (src.match(/const NO_IMPORT = \[[^\]]*\]/) || [""])[0];
  ok("sona.played.v1 is this phone's: on NO_EXPORT and NO_IMPORT", /"sona\.played\.v1"/.test(noExport) && /"sona\.played\.v1"/.test(noImport));
  const leads = read("public/leads.html");
  ok("/leads.html shows the Free trials section from /api/founders/trials, behind the founder key",
    /<h2>Free trials<\/h2>/.test(leads) && /fetch\("\/api\/founders\/trials", \{ headers: \{ "x-founder-key": key \}/.test(leads) && /loadTrials\(key\);/.test(leads));
  const track = read("app/api/track/route.ts");
  ok("/api/track's allow-list has the two events and the one property (days), and nothing about a child",
    /"free trial started",/.test(track) && /"played today",/.test(track) && /"cost", "days"\]\)/.test(track));
});

console.log(fails ? "\n" + passes + " passed, " + fails + " FAILURES" : "\nALL GREEN (" + passes + ")");
process.exit(fails ? 1 : 0);
