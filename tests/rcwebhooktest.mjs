// RCHOOK1: RevenueCat tells Sona (Travis, 16 Oct 2026: "build the revcat
// webhook"; then yes to the parent's email in RevenueCat, the sales emails
// stopped for buyers, "Your free days end soon" and "We miss you at Sona").
// Played against an in-memory Upstash behind the real
// kvCmd and a fake Resend, with nothing else stubbed:
//   - the route: only RevenueCat's own header gets in; a TEST, a type Sona
//     has no use for, Apple's sandbox and a message with no email change
//     nothing; the same message twice acts once; an older message never
//     overwrites a newer one; a store that does not answer is a 503, with
//     the message left undone, so RevenueCat's retry finishes it;
//   - what is kept: the state, when the plan ends and RevenueCat's time,
//     never the price, the country or a transaction id;
//   - the welcome series stops for a buyer (lib/nurture stopSeries), for good;
//   - "Your free days end soon": once, between 24 and 50 hours before the
//     free days end (a window every daily run lands in, however late Vercel
//     starts it), only while they are still on them, only to an address
//     that joined Sona's list and never left it; Resend turning it away for
//     a moment is tried again in the same run;
//   - a subscription that moves to another device's customer (TRANSFER):
//     its address is marked "moved" and gets no reminder;
//   - every message keeps a list member on the list (a new year), and never
//     adds one;
//   - "We miss you at Sona": a day after a plan ends, if it is still ended,
//     once a year an address;
//   - the house email rules, the founder page's Premium column, the daily
//     run's wiring, and the words on the privacy page and in NATIVE.md.
import { readFileSync, existsSync } from "node:fs";
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

// TS to CommonJS, "@/x" to the repo (reporttest's loader)
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
const KV_URL = "https://kv.rc.test.invalid";
const KV = { K: new Map(), T: new Map(), H: new Map(), Z: new Map(), S: new Map(), L: new Map(), log: [], down: false, failOn: null };
const zget = (k) => KV.Z.get(k) || new Map();
function kvExec([op, ...a]) {
  a = a.map((x) => (typeof x === "number" ? x : String(x)));
  switch (op) {
    case "SET": {
      const rest = a.slice(2).map((x) => String(x).toUpperCase());
      if (rest.includes("NX") && KV.K.has(a[0])) return null;
      KV.K.set(a[0], String(a[1]));
      const ex = rest.indexOf("EX");
      if (ex >= 0) KV.T.set(a[0], Number(a[2 + ex + 1])); else KV.T.delete(a[0]);
      return "OK";
    }
    case "GET": return KV.K.has(a[0]) ? KV.K.get(a[0]) : null;
    case "DEL": KV.T.delete(a[0]); return KV.K.delete(a[0]) ? 1 : 0;
    case "EXISTS": return KV.K.has(a[0]) ? 1 : 0;
    case "EXPIRE": if (!KV.K.has(a[0])) return 0; KV.T.set(a[0], Number(a[1])); return 1;
    case "SISMEMBER": return (KV.S.get(a[0]) || new Set()).has(a[1]) ? 1 : 0;
    case "SADD": { const s = KV.S.get(a[0]) || new Set(); a.slice(1).forEach((x) => s.add(x)); KV.S.set(a[0], s); return 1; }
    case "ZADD": { const z = zget(a[0]); z.set(String(a[2]), Number(a[1])); KV.Z.set(a[0], z); return 1; }
    case "ZREM": { const z = KV.Z.get(a[0]); return z && z.delete(String(a[1])) ? 1 : 0; }
    case "ZRANGEBYSCORE": {
      const max = a[2] === "+inf" ? Infinity : Number(a[2]);
      const withScores = a.includes("WITHSCORES");
      const rows = [...zget(a[0])].filter(([, s]) => s <= max).sort((x, y) => x[1] - y[1]);
      return withScores ? rows.flatMap(([m, s]) => [m, String(s)]) : rows.map(([m]) => m);
    }
    case "HGET": return (KV.H.get(a[0]) || new Map()).get(String(a[1])) ?? null;
    case "HSET": { const h = KV.H.get(a[0]) || new Map(); h.set(String(a[1]), String(a[2])); KV.H.set(a[0], h); return 1; }
    case "HGETALL": return [...(KV.H.get(a[0]) || new Map())].flat();
    case "LPUSH": { const l = KV.L.get(a[0]) || []; l.unshift(a[1]); KV.L.set(a[0], l); return l.length; }
    case "LTRIM": return "OK";
    case "EVAL": {
      const script = String(a[0]);
      if (/^-- rc:plan\n/.test(script)) {
        // the model of PLAN_SCRIPT: an older event never overwrites a newer one
        const [key, field, tsArg, json] = [a[2], a[3], a[4], a[5]];
        const h = KV.H.get(key) || new Map();
        const cur = h.get(String(field));
        if (cur) { const m = /"ts":(\d+)/.exec(cur); if (m && Number(m[1]) > Number(tsArg)) return 0; }
        h.set(String(field), String(json)); KV.H.set(key, h); return 1;
      }
      if (/^-- rc:moved\n/.test(script)) {
        // the model of MOVED_SCRIPT: keep the latest TRANSFER time
        const [key, tsArg, ex] = [a[2], a[3], a[4]];
        const cur = Number(KV.K.get(key) || 0);
        if (cur >= Number(tsArg)) return 0;
        KV.K.set(key, String(tsArg)); KV.T.set(key, Number(ex)); return 1;
      }
      if (/^-- rc:done\n/.test(script)) {
        // the model of DONE_SCRIPT: remove only if the score is unchanged
        const [key, member, score] = [a[2], String(a[3]), Number(a[4])];
        const z = KV.Z.get(key);
        if (z && z.has(member) && z.get(member) === score) { z.delete(member); return 1; }
        return 0;
      }
      if (/^-- rl:incr\n/.test(script)) { const k = a[2], n = Number(KV.K.get(k) || 0) + 1; KV.K.set(k, String(n)); return n; }
      throw new Error("no model for script " + script.slice(0, 30));
    }
    default: throw new Error("fake kv does not speak " + op);
  }
}
const SENT = [];
let resendStatus = 200, resendQueue = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u === KV_URL) {
    const cmd = JSON.parse(init.body); KV.log.push(cmd);
    if (KV.down || (KV.failOn && KV.failOn(cmd))) return new Response("{}", { status: 503 });
    return Response.json({ result: kvExec(cmd) });
  }
  if (u === "https://api.resend.com/emails") {
    const body = JSON.parse(init.body);
    const status = resendQueue.length ? resendQueue.shift() : resendStatus;
    SENT.push({ body, headers: init.headers, status });
    return new Response(JSON.stringify({ id: "re_" + SENT.length }), { status, headers: { "content-type": "application/json" } });
  }
  throw new Error("unexpected outbound call " + u);
};
const reset = () => { KV.K.clear(); KV.T.clear(); KV.H.clear(); KV.Z.clear(); KV.S.clear(); KV.L.clear(); KV.log.length = 0; KV.down = false; KV.failOn = null; SENT.length = 0; resendStatus = 200; resendQueue = []; };

const ENV_KEYS = ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "RESEND_API_KEY", "UNSUB_SECRET",
  "EMAIL_POSTAL", "NURTURE_FROM", "NURTURE_REPLY_TO", "REVENUECAT_WEBHOOK_AUTH", "REVENUECAT_WEBHOOK_AUTH_PREV", "REVENUECAT_SANDBOX", "SALE_ALERT_TO", "RESEND_FROM"];
const AUTH = "Bearer rc-test-secret-0123456789";
function env(over = {}) {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, { KV_REST_API_URL: KV_URL, KV_REST_API_TOKEN: "kv-test", RESEND_API_KEY: "re_test", UNSUB_SECRET: "s3cret",
    EMAIL_POSTAL: "851 NE 1st Ave, Unit 4103, Miami, FL 33132", REVENUECAT_WEBHOOK_AUTH: AUTH }, over);
}
env();
const logs = [];
for (const k of ["log", "error", "warn"]) { const real = console[k]; console[k] = (...a) => { logs.push(a.map(String).join(" ")); if (k === "log") real(...a); }; }

const ROUTE = path.join(REPO, "app/api/revenuecat/route.ts");
if (!existsSync(ROUTE) || !existsSync(path.join(REPO, "lib/revenuecat.ts"))) { ok("the webhook route and its library exist", false); process.exit(1); }
const cache = new Map();
const R = loadTs(path.join(REPO, "lib/revenuecat.ts"), {}, cache);
const N = loadTs(path.join(REPO, "lib/nurture.ts"), {}, cache);
const route = loadTs(ROUTE, {}, cache);
const kv = loadTs(path.join(REPO, "lib/slpAuth.ts"), {}, cache).kvCmd;

const HOUR = 3600e3, DAY = 24 * HOUR;
let evN = 0;
const ev = (o = {}) => Object.assign({
  id: "evt-" + (++evN), type: "INITIAL_PURCHASE", event_timestamp_ms: Date.now(), app_user_id: "$RCAnonymousID:0123456789abcdef0123456789abcdef",
  original_app_user_id: "$RCAnonymousID:0123456789abcdef0123456789abcdef", aliases: [], product_id: "com.speaksona.app.monthly", entitlement_ids: ["full"],
  period_type: "TRIAL", purchased_at_ms: Date.now(), expiration_at_ms: Date.now() + 3 * DAY, store: "APP_STORE", environment: "PRODUCTION",
  country_code: "US", currency: "USD", price: 0, price_in_purchased_currency: 0, transaction_id: "2000000123456789", original_transaction_id: "2000000123456789",
  subscriber_attributes: { $email: { value: "Mom@Example.com", updated_at_ms: Date.now() }, $displayName: { value: "Mia", updated_at_ms: 1 } },
}, o);
async function hook(event, o = {}) {
  const raw = o.raw !== undefined ? o.raw : JSON.stringify({ api_version: "1.0", event });
  const headers = Object.assign({ "content-type": "application/json" }, o.headers || {});
  if (o.auth !== null) headers.authorization = o.auth === undefined ? AUTH : o.auth;
  const r = await route.POST(new NextRequest("https://speaksona.com/api/revenuecat", { method: "POST", headers, body: raw }));
  let json = null; try { json = await r.clone().json(); } catch {}
  return { status: r.status, json };
}
const plan = (email = "mom@example.com") => { const v = (KV.H.get(R.PLANS_KEY) || new Map()).get(email); return v ? JSON.parse(v) : null; };
const zscore = (key, email = "mom@example.com") => zget(key).get(email);
const quiet = { sleep: async () => {} };
const joinList = (email = "mom@example.com", at = Date.now()) => KV.K.set("nurture:0:" + email, new Date(at).toISOString());

// ── 1. the door ──
await scenario("the door", async () => {
  reset();
  env({ REVENUECAT_WEBHOOK_AUTH: "" });
  let r = await hook(ev());
  ok("with no secret set, nothing gets in (503), and the store is never asked", r.status === 503 && KV.log.length === 0 && /REVENUECAT_WEBHOOK_AUTH/.test(r.json.error), r);
  env({ REVENUECAT_WEBHOOK_AUTH: "short-secret" });
  r = await hook(ev(), { auth: "short-secret" });
  ok("…nor with one shorter than 16 characters", r.status === 503 && KV.log.length === 0, r);
  env();
  r = await hook(ev(), { auth: "Bearer wrong-secret-0123456789" });
  ok("a wrong Authorization header: 401, and the store is never asked", r.status === 401 && KV.log.length === 0, r);
  r = await hook(ev(), { auth: null });
  ok("no header at all: 401", r.status === 401 && KV.log.length === 0, r);
  r = await hook(ev(), { auth: AUTH.slice(0, -1) + "8" });
  ok("…and a near miss is a miss (one character off)", r.status === 401 && KV.log.length === 0, r);
  r = await hook(ev(), { auth: AUTH.slice(7) });
  ok("…as is the secret without the word RevenueCat was given before it", r.status === 401, r);
  env({ REVENUECAT_WEBHOOK_AUTH: "Bearer the-new-secret-abcdefghij", REVENUECAT_WEBHOOK_AUTH_PREV: AUTH });
  r = await hook(ev({ subscriber_attributes: {} }));
  ok("while a new secret takes over, the previous one still gets in (REVENUECAT_WEBHOOK_AUTH_PREV)", r.status === 200, r);
  env();
  r = await hook(null, { raw: "{not json" });
  ok("a body that is not JSON: 400", r.status === 400, r);
  r = await hook(null, { raw: JSON.stringify({ api_version: "1.0" }) });
  ok("JSON with no event: 400", r.status === 400, r);
  r = await hook(null, { raw: JSON.stringify({ event: { id: "x y", type: "RENEWAL" } }) });
  ok("an id that is not an id: 400", r.status === 400, r);
  r = await hook(null, { raw: "x".repeat(70 * 1024), headers: { "content-length": String(70 * 1024) } });
  ok("a body over 64 KB: 413, never read", r.status === 413, r);
  r = await hook(null, { raw: JSON.stringify({ api_version: "1.0", event: ev({ pad: "x".repeat(70 * 1024) }) }) });
  ok("…also when it says nothing about its size", r.status === 413, r);
  const health = await (await route.GET()).json();
  ok("the health check says only whether things are set, never a value", health.auth === true && health.store === true && !JSON.stringify(health).includes("rc-test-secret"), health);
});

// ── 2. what is ignored, on purpose ──
await scenario("ignored", async () => {
  reset();
  let r = await hook(ev({ type: "TEST" }));
  ok("the dashboard's test event: 200, and nothing is kept", r.status === 200 && r.json.ignored === "test" && KV.log.length === 0, r);
  for (const t of ["TRANSFER", "TEMPORARY_ENTITLEMENT_GRANT", "SUBSCRIPTION_PAUSED", "INVOICE_ISSUANCE", "VIRTUAL_CURRENCY_TRANSACTION", "EXPERIMENT_ENROLLMENT", "SOMETHING_NEW"]) {
    r = await hook(ev({ type: t }));
    ok(t + ": 200, nothing kept", r.status === 200 && r.json.ignored === "type" && KV.log.length === 0, r);
  }
  r = await hook(ev({ environment: "SANDBOX" }));
  ok("Apple's sandbox (TestFlight, App Review, Travis's tests): 200, nothing kept", r.status === 200 && r.json.ignored === "sandbox" && KV.log.length === 0, r);
  r = await hook(ev({ environment: undefined }));
  ok("…and a message that does not say it is real counts as sandbox", r.status === 200 && r.json.ignored === "sandbox" && KV.log.length === 0, r);
  env({ REVENUECAT_SANDBOX: "1" });
  r = await hook(ev({ environment: "SANDBOX" }));
  ok("…unless REVENUECAT_SANDBOX=1 (for a test on a phone)", r.status === 200 && r.json.applied === true && plan() && plan().s === "trial", r);
  env(); reset();
  r = await hook(ev({ subscriber_attributes: { $displayName: { value: "Mia" } } }));
  ok("a family who gave the app no email: 200, nothing kept (RevenueCat only knows them by a random id)", r.status === 200 && r.json.ignored === "no email" && KV.log.length === 0, r);
  r = await hook(ev({ subscriber_attributes: { $email: { value: "not an email" } } }));
  ok("…and an email that is not an address, the same", r.status === 200 && r.json.ignored === "no email" && KV.log.length === 0, r);
  r = await hook(ev({ subscriber_attributes: { $email: "Flat@Example.com" } }));
  ok("an email sent flat (\"$email\": \"…\") is read too", r.status === 200 && r.json.applied === true && !!plan("flat@example.com"), r);
  reset();
  env({ KV_REST_API_URL: "", KV_REST_API_TOKEN: "" });
  r = await hook(ev());
  ok("no store connected: 503, so RevenueCat tries again later", r.status === 503, r);
  env();
});

// ── 3. what a message means, and what is kept ──
await scenario("states", async () => {
  reset();
  const t0 = Date.now(), exp = t0 + 3 * DAY;
  let r = await hook(ev({ event_timestamp_ms: t0, expiration_at_ms: exp }));
  const p = plan();
  ok("free days started: 200, kept as \"trial\" with when they end", r.status === 200 && r.json.applied === true && p && p.s === "trial" && p.exp === exp && p.ts === t0, [r, p]);
  ok("…keyed by the lowercased address, and only state, end, RevenueCat's time and when Sona heard",
    JSON.stringify(Object.keys(p).sort()) === JSON.stringify(["at", "exp", "s", "ts"]) && !KV.H.get(R.PLANS_KEY).has("Mom@Example.com"), p);
  const everything = JSON.stringify([...KV.K, ...[...KV.H].map(([k, h]) => [k, [...h]]), ...[...KV.Z].map(([k, z]) => [k, [...z]])]);
  ok("no price, country, currency, transaction id or child's name is kept anywhere",
    !/USD|"US"|2000000123456789|Mia|price|country/.test(everything), everything.slice(0, 400));
  const ANON = "$RCAnonymousID:0123456789abcdef0123456789abcdef";
  ok("…and RevenueCat's random customer id only as the link to its address, for 400 days",
    KV.K.get(R.uidKey(ANON)) === "mom@example.com" && KV.T.get(R.uidKey(ANON)) === 400 * 86400 &&
    [...KV.K].filter(([k, v]) => (k + v).includes("RCAnonymousID")).length === 1 && ![...KV.H].some(([, h]) => JSON.stringify([...h]).includes("RCAnonymousID")),
    [...KV.K.keys()]);
  ok("…the welcome series stops for the address (no more sales emails)", KV.K.get(N.stopKey("mom@example.com")) === "1");
  ok("…and \"Your free days end soon\" is queued for 50 hours before they end", zscore(R.REMIND_KEY) === exp - 50 * HOUR, zscore(R.REMIND_KEY));
  ok("…and its stop mark has no time limit", !KV.T.has(N.stopKey("mom@example.com")));
  const same = ev({ event_timestamp_ms: t0 + 5, expiration_at_ms: exp });
  r = await hook(same);
  const n = KV.log.length;
  r = await hook(same);
  ok("the same message twice (RevenueCat retries with the same id): the second does nothing", r.status === 200 && r.json.ignored === "dup" && KV.log.length === n + 1, r);
  {
    const fresh = ev({ event_timestamp_ms: t0 + 6, expiration_at_ms: exp }), from = KV.log.length;
    await hook(fresh);
    // the welcome (WELCOME1) runs after the message is marked done; it is not part of it
    const all = KV.log.slice(from), done = all.findLastIndex((c) => c[0] === "SET" && c[1] === R.evtKey(fresh.id));
    const cmds = all.slice(0, done + 1);
    ok("…and the welcome's own steps, after it, write nothing but its sent mark",
      all.slice(done + 1).every((c) => ["EXISTS", "HGET", "SISMEMBER", "GET"].includes(c[0]) || (c[0] === "SET" && String(c[1]).startsWith("rc:sent:welcome:"))), all.slice(done + 1).map((c) => c.slice(0, 2)));
    ok("…and the mark that a message is done is the last thing written, after a look that writes nothing",
      cmds[0][0] === "EXISTS" && cmds[0][1] === R.evtKey(fresh.id) && cmds.at(-1)[0] === "SET" && cmds.at(-1)[1] === R.evtKey(fresh.id) && !cmds.at(-1).includes("NX") &&
      cmds.filter((c) => String(c[1]) === R.evtKey(fresh.id)).length === 2, cmds.map((c) => c.slice(0, 2)));
  }

  const cases = [
    ["CANCELLATION", { cancel_reason: "UNSUBSCRIBE", period_type: "TRIAL" }, "cancelled"],
    ["UNCANCELLATION", { period_type: "TRIAL" }, "trial"],
    ["CANCELLATION", { cancel_reason: "BILLING_ERROR", period_type: "NORMAL" }, "billing"],
    ["BILLING_ISSUE", { period_type: "NORMAL" }, "billing"],
    ["RENEWAL", { period_type: "NORMAL", is_trial_conversion: true }, "paid"],
    ["CANCELLATION", { cancel_reason: "CUSTOMER_SUPPORT", period_type: "NORMAL", price: -9.99 }, "cancelled"],
    ["REFUND_REVERSED", { period_type: "NORMAL" }, "paid"],
    ["PRODUCT_CHANGE", { period_type: "NORMAL" }, "paid"],
    ["EXPIRATION", { expiration_reason: "UNSUBSCRIBE", period_type: "NORMAL" }, "ended"],
    ["INITIAL_PURCHASE", { period_type: "NORMAL" }, "paid"],
  ];
  let t = t0 + 10;
  for (const [type, extra, want] of cases) {
    t += 1000;
    r = await hook(ev(Object.assign({ type, event_timestamp_ms: t, expiration_at_ms: exp }, extra)));
    ok(type + (extra.cancel_reason ? " (" + extra.cancel_reason + ")" : "") + " → " + want, r.status === 200 && plan().s === want, [r, plan()]);
  }
  ok("a plan that ended is queued for \"We miss you at Sona\" a day later", typeof zscore(R.MISS_KEY) === "number" && zscore(R.MISS_KEY) >= t - 1000 + DAY, zscore(R.MISS_KEY));

  // RevenueCat sends in no particular order
  const newest = plan();
  r = await hook(ev({ type: "CANCELLATION", event_timestamp_ms: t0 - 1, expiration_at_ms: exp }));
  ok("an older message arriving late changes nothing", r.status === 200 && r.json.ignored === "stale" && JSON.stringify(plan()) === JSON.stringify(newest), [r, plan()]);
  ok("…though the series stays stopped whatever the order", KV.K.get(N.stopKey("mom@example.com")) === "1");
  ok("stateFor: a free trial is an INITIAL_PURCHASE in its TRIAL period", R.stateFor("INITIAL_PURCHASE", "TRIAL", "") === "trial" && R.stateFor("INITIAL_PURCHASE", "INTRO", "") === "paid" && R.stateFor("TEST", "TRIAL", "") === null);
});

// ── 3b. THE ONE PAYMENT (22 Oct 2026, iOS 1.0.9): the non-consumable
// "com.speaksona.app.lifetime" in the "full" entitlement. RevenueCat tells of
// it as a NON_RENEWING_PURCHASE with no end; it is a purchase like any
// other: "paid", the series stops, and no note is ever queued for it ──
await scenario("the one payment", async () => {
  reset(); joinList();
  const t0 = Date.now();
  const once = (o = {}) => ev(Object.assign({ type: "NON_RENEWING_PURCHASE", product_id: "com.speaksona.app.lifetime", period_type: "NORMAL", expiration_at_ms: null,
    event_timestamp_ms: t0, price: 59.99, price_in_purchased_currency: 59.99 }, o));
  let r = await hook(once());
  let p = plan();
  ok("a one payment: 200, kept as \"paid\" with no end", r.status === 200 && r.json.applied === true && p && p.s === "paid" && p.exp === 0 && p.ts === t0, [r, p]);
  ok("…the welcome series stops for good, and neither note is queued (nothing ends)", KV.K.get(N.stopKey("mom@example.com")) === "1" && zscore(R.REMIND_KEY) === undefined && zscore(R.MISS_KEY) === undefined, [zscore(R.REMIND_KEY), zscore(R.MISS_KEY)]);
  const everything = JSON.stringify([...KV.K, ...[...KV.H].map(([k, h]) => [k, [...h]]), ...[...KV.Z].map(([k, z]) => [k, [...z]])]);
  ok("…and neither its price nor its product is kept anywhere", !/59\.99|lifetime|USD|2000000123456789/.test(everything), everything.slice(0, 300));
  ok("stateFor: a NON_RENEWING_PURCHASE is \"paid\" whatever period it names, or none", R.stateFor("NON_RENEWING_PURCHASE", "", "") === "paid" && R.stateFor("NON_RENEWING_PURCHASE", "NORMAL", "") === "paid" && R.stateFor("NON_RENEWING_PURCHASE", "TRIAL", "") === "paid");
  reset(); joinList();
  r = await hook(once({ period_type: undefined, expiration_at_ms: undefined }));
  ok("…also when the message names no period and no end at all", r.status === 200 && plan() && plan().s === "paid" && plan().exp === 0, [r, plan()]);
  // free days that were on, then the one payment: the reminder that was queued is never sent
  reset(); joinList();
  const S = Date.parse("2026-10-20T10:00:00Z"), E = S + 3 * DAY;
  await R.apply(R.readEvent({ event: ev({ event_timestamp_ms: S, expiration_at_ms: E }) }), kv, S);
  ok("free days on: the reminder is queued", zscore(R.REMIND_KEY) === E - 50 * HOUR, zscore(R.REMIND_KEY));
  await R.apply(R.readEvent({ event: once({ event_timestamp_ms: S + HOUR }) }), kv, S + HOUR);
  const res = await R.runRc(kv, fetch, Date.parse("2026-10-21T16:00:00Z"), quiet);
  ok("…then the one payment: the address is \"paid\", and the run sends no \"Your free days end soon\"", plan().s === "paid" && res.reminded === 0 && res.skipped === 1 && SENT.length === 0, [plan(), res]);
});

// ── 4. a store that does not answer ──
await scenario("store down", async () => {
  reset();
  const e1 = ev();
  KV.failOn = (c) => c[0] === "EVAL";
  let r = await hook(e1);
  ok("a store that fails mid-way: 503, so RevenueCat tries again", r.status === 503 && r.json.retry === true, r);
  ok("…and the message is not marked done, so the retry is not mistaken for a duplicate", !KV.K.has(R.evtKey(e1.id)), [...KV.K.keys()]);
  KV.failOn = null;
  r = await hook(e1);
  ok("the retry lands", r.status === 200 && r.json.applied === true && plan().s === "trial", r);
  reset();
  KV.failOn = (c) => c[0] === "SET" && String(c[1]).startsWith("nurture:stop:");
  r = await hook(ev());
  ok("a stop mark that did not take: 503 too, never a 200 for something not kept", r.status === 503 && ![...KV.K.keys()].some((k) => k.startsWith("rc:evt:")), r);
  reset();
  const e2 = ev();
  KV.failOn = (c) => c[0] === "SET" && String(c[1]).startsWith("rc:evt:");
  r = await hook(e2);
  ok("everything written but the done mark: 503, and the retry does it all again, harmlessly", r.status === 503 && plan().s === "trial", r);
  KV.failOn = null;
  r = await hook(e2);
  ok("…and lands", r.status === 200 && r.json.applied === true, r);
  ok("…with the reminder queued once", zget(R.REMIND_KEY).size === 1 && KV.K.has(R.evtKey(e2.id)));
  reset();
  KV.failOn = (c) => c[0] === "EXISTS";
  r = await hook(ev());
  ok("a store that cannot say whether a message was seen: 503, nothing written", r.status === 503 && KV.H.size === 0, r);
  KV.failOn = null;
  reset();
  KV.down = true;
  r = await hook(ev());
  ok("the whole store down: 503", r.status === 503, r);
  KV.down = false;
});

// ── 4b. the list keeps its members while RevenueCat talks about them ──
await scenario("list membership", async () => {
  reset();
  // the parent gave setup their email 400 days ago; nurture:0 had a year
  joinList("mom@example.com", Date.now() - 400 * DAY); KV.T.set("nurture:0:mom@example.com", 5);
  const before = KV.K.get("nurture:0:mom@example.com");
  await hook(ev({ type: "RENEWAL", period_type: "NORMAL" }));
  ok("a message about a list member starts its year again", KV.T.get("nurture:0:mom@example.com") === 365 * 86400);
  ok("…and changes nothing else about it (its sign-up time stays)", KV.K.get("nurture:0:mom@example.com") === before);
  await hook(ev({ subscriber_attributes: { $email: { value: "stranger@example.com" } } }));
  ok("an address RevenueCat names that never joined is never added", !KV.K.has("nurture:0:stranger@example.com"));
});

// ── 5. "Your free days end soon" ──
await scenario("the reminder", async () => {
  // free days start at 10:00 UTC on day 0; the daily run is at 16:00 UTC
  const S = Date.parse("2026-10-20T10:00:00Z"), E = S + 3 * DAY, run = (d) => Date.parse("2026-10-20T16:00:00Z") + d * DAY;
  const start = async (email = "mom@example.com", o = {}) => {
    const e = ev(Object.assign({ event_timestamp_ms: S, expiration_at_ms: E, subscriber_attributes: { $email: { value: email } } }, o));
    return R.apply(Object.assign(R.readEvent({ event: e }), {}), kv, S);
  };
  reset(); joinList("mom@example.com", S - DAY);
  ok("free days started", (await start()) === "ok");
  let res = await R.runRc(kv, fetch, run(0), quiet);
  ok("day 0's run: not yet", res.reminded === 0 && SENT.length === 0, res);
  res = await R.runRc(kv, fetch, run(1), quiet);
  const m = SENT[0] && SENT[0].body;
  ok("day 1's run, 42 hours before they end: one email, to that parent", res.reminded === 1 && SENT.length === 1 && JSON.stringify(m.to) === '["mom@example.com"]', [res, SENT.length]);
  ok("…\"Your free days end soon\", from Rachel", m.subject === "Your free days end soon" && /rachel@speaksona\.com/.test(m.from) && m.reply_to === "rachel@speaksona.com", m.subject);
  ok("…with a working unsubscribe link in the body and the header, and the mailing address",
    m.html.includes("/api/email/unsub?e=mom%40example.com&k=" + N.unsubToken("mom@example.com", "s3cret")) && /api\/email\/unsub/.test(m.headers["List-Unsubscribe"]) && m.text.includes("851 NE 1st Ave"));
  ok("…how to cancel in time, and a button to the parent's own subscriptions", /at least 24 hours before/.test(m.text) && m.html.includes(R.SUBSCRIPTIONS_URL));
  ok("…and a Resend key with no address in it", /^rc-remind-[0-9a-f]{32}$/.test(SENT[0].headers["Idempotency-Key"]), SENT[0].headers["Idempotency-Key"]);
  for (let d = 2; d <= 6; d++) await R.runRc(kv, fetch, run(d), quiet);
  ok("…and once: no other run sends it again", SENT.length === 1);

  // Vercel starts a run a few seconds (or up to an hour) late: the window holds a run anyway
  reset(); joinList("drift@example.com");
  const S3 = Date.parse("2026-10-20T16:00:10Z"), E3 = S3 + 3 * DAY;
  await R.apply(R.readEvent({ event: ev({ event_timestamp_ms: S3, expiration_at_ms: E3, subscriber_attributes: { $email: { value: "drift@example.com" } } }) }), kv, S3);
  await R.runRc(kv, fetch, Date.parse("2026-10-20T16:00:02Z"), quiet);
  await R.runRc(kv, fetch, Date.parse("2026-10-21T16:00:02Z"), quiet);
  ok("free days that start seconds after a run: the next day's run (48 hours ahead) still sends it", SENT.length === 1 && SENT[0].body.to[0] === "drift@example.com", SENT.length);
  reset(); joinList("drift@example.com");
  await R.apply(R.readEvent({ event: ev({ event_timestamp_ms: S3, expiration_at_ms: E3, subscriber_attributes: { $email: { value: "drift@example.com" } } }) }), kv, S3);
  await R.runRc(kv, fetch, Date.parse("2026-10-21T16:59:00Z"), quiet);
  ok("…and so does a run that starts nearly an hour late", SENT.length === 1);
  {
    // free days starting at any minute of the day, and each day's run on time
    // or 59 minutes late, in every mix: some run is due and still in time
    let missed = 0;
    for (let m = 0; m < 24 * 60; m += 7) {
      const st = Date.parse("2026-10-20T00:00:00Z") + m * 60e3, en = st + 3 * DAY, q = en - R.REMIND_BEFORE_MS;
      for (let mix = 0; mix < 16; mix++) {
        const runs = [0, 1, 2, 3].map((d) => Date.parse("2026-10-20T16:00:00Z") + d * DAY + ((mix >> d) & 1 ? 59 * 60e3 : 0));
        if (!runs.some((t) => t >= q && en - t > R.REMIND_LATE_MS)) missed++;
      }
    }
    ok("for free days starting at any minute of the day, some run lands in the window, however late Vercel starts each", missed === 0, missed);
  }

  // free days that start late in the day: the run 28 hours before the end
  reset(); joinList("late@example.com");
  const S2 = Date.parse("2026-10-20T20:00:00Z"), E2 = S2 + 3 * DAY;
  await R.apply(R.readEvent({ event: ev({ event_timestamp_ms: S2, expiration_at_ms: E2, subscriber_attributes: { $email: { value: "late@example.com" } } }) }), kv, S2);
  await R.runRc(kv, fetch, run(1), quiet);
  ok("free days starting at 20:00: day 1's run is too early", SENT.length === 0);
  await R.runRc(kv, fetch, run(2), quiet);
  ok("…day 2's run, 28 hours before the end, sends it", SENT.length === 1 && SENT[0].body.to[0] === "late@example.com");

  // a message that arrives too late to give a day's warning
  reset(); joinList();
  await start();
  await R.runRc(kv, fetch, E - 20 * HOUR, quiet);
  ok("less than 24 hours left (Apple's line for a cancel to count): nothing is sent, and nothing stays queued", SENT.length === 0 && !zscore(R.REMIND_KEY));

  for (const [label, type, extra] of [["cancelled during the free days", "CANCELLATION", { cancel_reason: "UNSUBSCRIBE" }], ["already paying (they chose to pay early)", "RENEWAL", { period_type: "NORMAL" }]]) {
    reset(); joinList();
    await start();
    await R.apply(R.readEvent({ event: ev(Object.assign({ type, event_timestamp_ms: S + HOUR, expiration_at_ms: E }, extra)) }), kv, S + HOUR);
    const r = await R.runRc(kv, fetch, run(1), quiet);
    ok(label + ": no reminder", SENT.length === 0 && r.skipped === 1, r);
  }
  reset(); joinList();
  await start();
  await R.apply(R.readEvent({ event: ev({ type: "CANCELLATION", cancel_reason: "UNSUBSCRIBE", event_timestamp_ms: S + HOUR, expiration_at_ms: E }) }), kv, S + HOUR);
  await R.apply(R.readEvent({ event: ev({ type: "UNCANCELLATION", event_timestamp_ms: S + 2 * HOUR, expiration_at_ms: E }) }), kv, S + 2 * HOUR);
  await R.runRc(kv, fetch, run(1), quiet);
  ok("cancelled, then turned back on: the reminder comes after all", SENT.length === 1);

  reset();
  await start();
  let r = await R.runRc(kv, fetch, run(1), quiet);
  ok("an address that never joined Sona's list (no setup email): nothing, whatever RevenueCat was told", SENT.length === 0 && r.skipped === 1, r);
  for (const [label, gone] of [["unsubscribed", "mom@example.com"], ["unsubscribed under the plain Gmail mailbox", "momgmail@gmail.com"]]) {
    reset();
    const addr = gone === "momgmail@gmail.com" ? "mom.gmail+sona@gmail.com" : "mom@example.com";
    joinList(addr);
    KV.S.set("email:unsub", new Set([gone]));
    await start(addr);
    r = await R.runRc(kv, fetch, run(1), quiet);
    ok(label + ": nothing", SENT.length === 0 && r.skipped === 1, r);
  }

  // Resend busy, down, or refusing for good
  reset(); joinList();
  await start();
  resendQueue = [500];
  r = await R.runRc(kv, fetch, run(1), quiet);
  ok("Resend down for a moment: tried again in the same run, and sent", r.reminded === 1 && r.failed === 0 && SENT.length === 2 && SENT[1].status === 200, r);
  ok("…under the same Resend key, so it can never arrive twice", SENT[0].headers["Idempotency-Key"] === SENT[1].headers["Idempotency-Key"]);
  reset(); joinList();
  await start();
  resendQueue = [0, 503, 200];
  r = await R.runRc(kv, fetch, run(1), quiet);
  ok("…the third try is the last", r.reminded === 1 && SENT.length === 3, r);
  reset(); joinList();
  await start();
  resendQueue = [500, 500, 500];
  r = await R.runRc(kv, fetch, run(1), quiet);
  ok("Resend down all run: counted failed, the sent-mark released, and it goes back in the queue", r.failed === 1 && SENT.length === 3 && !KV.K.has(R.sentKey("remind", "mom@example.com", E)) && zscore(R.REMIND_KEY) === E - 50 * HOUR, r);
  r = await R.runRc(kv, fetch, run(2), quiet);
  ok("…and when the next run is less than 24 hours before the end, it is dropped, never sent late", r.reminded === 0 && SENT.length === 3 && !zscore(R.REMIND_KEY), r);
  {
    // free days that start at 17:00: two runs land in the window, so a bad day gets a second go
    reset(); joinList();
    const S4 = Date.parse("2026-10-20T17:00:00Z"), E4 = S4 + 3 * DAY;
    await R.apply(R.readEvent({ event: ev({ event_timestamp_ms: S4, expiration_at_ms: E4 }) }), kv, S4);
    resendQueue = [500, 500, 500];
    r = await R.runRc(kv, fetch, run(1), quiet);
    const r2 = await R.runRc(kv, fetch, run(2), quiet);
    ok("…but when the next run is still in time, it sends it", r.failed === 1 && r2.reminded === 1 && SENT.at(-1).status === 200, [r, r2]);
  }
  reset(); joinList();
  await start();
  resendQueue = [422];
  r = await R.runRc(kv, fetch, run(1), quiet);
  ok("refused for good (a bad address): dropped, not retried forever", r.failed === 1 && !zscore(R.REMIND_KEY), r);
  reset(); joinList();
  await start();
  resendQueue = [429, 429, 429];
  r = await R.runRc(kv, fetch, run(1), quiet);
  ok("Resend says slow down three times: the run stops and the note waits for the next one", r.stopped === "rate" && zscore(R.REMIND_KEY) === E - 50 * HOUR, r);

  reset(); joinList();
  await start();
  const realHget = KV.failOn;
  KV.failOn = (c) => c[0] === "HGET";
  r = await R.runRc(kv, fetch, run(1), quiet);
  KV.failOn = realHget;
  ok("a store that cannot say where the plan stands: nothing is sent, and the note waits", SENT.length === 0 && zscore(R.REMIND_KEY) === E - 50 * HOUR, r);
  // a store that stops answering part-way never loses the note: it stays
  // queued, untouched, until a run can settle it
  reset(); joinList();
  await start();
  KV.failOn = (c) => c[0] !== "ZRANGEBYSCORE";
  r = await R.runRc(kv, fetch, run(1), quiet);
  KV.failOn = null;
  ok("the store goes down right after the queue is read: nothing sent, and the note is still queued as it was", SENT.length === 0 && zscore(R.REMIND_KEY) === E - 50 * HOUR, [r, zscore(R.REMIND_KEY)]);
  r = await R.runRc(kv, fetch, run(1) + 2 * HOUR, quiet);
  ok("…so a later run in time sends it, and only then is it taken off the queue", r.reminded === 1 && SENT.length === 1 && !zscore(R.REMIND_KEY), r);
  reset(); joinList();
  await start();
  KV.failOn = (c) => { if (c[0] === "HGET") zget(R.REMIND_KEY).set("mom@example.com", E + DAY - 50 * HOUR); return false; };
  r = await R.runRc(kv, fetch, run(1), quiet);
  KV.failOn = null;
  ok("a note queued again (new free days) while the run handled the old one stays queued, at its new time",
    r.reminded === 1 && zscore(R.REMIND_KEY) === E + DAY - 50 * HOUR, [r, zscore(R.REMIND_KEY)]);
  reset(); joinList();
  await start();
  const n = SENT.length;
  delete process.env.EMAIL_POSTAL;
  r = await R.runRc(kv, fetch, run(1), quiet);
  ok("no mailing address set: nothing sends, nothing is claimed", SENT.length === n && zscore(R.REMIND_KEY) === E - 50 * HOUR, r);
  env();
});

// ── 5b. the subscription moves to another device ──
await scenario("transfer", async () => {
  const S = Date.parse("2026-10-20T10:00:00Z"), E = S + 3 * DAY, run1 = Date.parse("2026-10-21T16:00:00Z");
  const A = "$RCAnonymousID:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", B = "$RCAnonymousID:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const move = (o = {}) => ev(Object.assign({ type: "TRANSFER", event_timestamp_ms: S + HOUR, transferred_from: [A], transferred_to: [B], app_user_id: B, original_app_user_id: B,
    subscriber_attributes: {}, period_type: undefined, expiration_at_ms: undefined }, o));
  reset(); joinList();
  let r = await hook(ev({ event_timestamp_ms: S, expiration_at_ms: E, app_user_id: A, original_app_user_id: A }));
  ok("the free days start on the parent's phone (customer A)", r.status === 200 && plan().s === "trial" && KV.K.get(R.uidKey(A)) === "mom@example.com", r);
  const t = move();
  r = await hook(t);
  ok("RevenueCat moves the subscription to the iPad's customer (no email): 200, the address is marked \"moved\"", r.status === 200 && r.json.applied === true && plan().s === "moved", [r, plan()]);
  ok("…its reminder is dropped", !zscore(R.REMIND_KEY));
  ok("…and the run sends nothing, though the free days are still on", (await R.runRc(kv, fetch, run1, quiet)).reminded === 0 && SENT.every((m) => m.body.subject === R.MAILS.welcome.subject));
  r = await hook(t);
  ok("the same TRANSFER again: nothing more", r.status === 200 && r.json.ignored === "dup", r);
  r = await hook(move({ transferred_from: ["$RCAnonymousID:cccccccccccccccccccccccccccccccc"] }));
  ok("a TRANSFER from a customer Sona never saw with an email: 200, nothing changed", r.status === 200 && r.json.ignored === "none" && plan().s === "moved", r);
  r = await hook(move({ transferred_from: [] }));
  ok("…or from no customer at all", r.status === 200 && r.json.ignored === "type", r);
  r = await hook(move({ environment: "SANDBOX" }));
  ok("…and Apple's sandbox, ignored as ever", r.status === 200 && r.json.ignored === "sandbox", r);
  // the parent's phone hears a newer message after all (same email, came back): the newest wins
  r = await hook(ev({ type: "UNCANCELLATION", event_timestamp_ms: S + 2 * HOUR, expiration_at_ms: E, app_user_id: A, original_app_user_id: A }));
  ok("a newer message about the address still wins over \"moved\"", plan().s === "trial", plan());
  r = await hook(move({ event_timestamp_ms: S + 90 * 60e3 }));
  ok("…and an older TRANSFER arriving late does not drop its reminder", plan().s === "trial" && zscore(R.REMIND_KEY) === E - 50 * HOUR, [plan(), zscore(R.REMIND_KEY)]);
  reset(); joinList();
  await hook(ev({ event_timestamp_ms: S, expiration_at_ms: E, app_user_id: A, original_app_user_id: A }));
  KV.failOn = (c) => c[0] === "GET" && String(c[1]).startsWith("rc:uid:");
  const t2 = move();
  r = await hook(t2);
  ok("a store that cannot say whose customer it was: 503, nothing marked done", r.status === 503 && !KV.K.has(R.evtKey(t2.id)) && plan().s === "trial", r);
  KV.failOn = null;
  r = await hook(t2);
  ok("…and the retry lands", r.status === 200 && plan().s === "moved", r);
  ok("/leads.html names it", /moved: "moved to another device"/.test(read("public/leads.html")) && /pMoved/.test(read("public/leads.html")));

  // RevenueCat sends in no particular order: the TRANSFER can arrive before
  // the purchase it moved (a retry of the purchase lands later)
  reset(); joinList();
  r = await hook(move());
  ok("a TRANSFER that comes before anything about its customer: 200, and its time is kept against that customer for 400 days",
    r.status === 200 && r.json.ignored === "none" && KV.K.get(R.movedKey(A)) === String(S + HOUR) && KV.T.get(R.movedKey(A)) === 400 * 86400, [r, [...KV.K]]);
  r = await hook(ev({ event_timestamp_ms: S, expiration_at_ms: E, app_user_id: A, original_app_user_id: A }));
  ok("…the late purchase message (from before the move) records the address as moved, as of the move, never on its free days",
    r.status === 200 && plan().s === "moved" && plan().ts === S + HOUR && !zscore(R.REMIND_KEY), [r, plan(), zscore(R.REMIND_KEY)]);
  ok("…while still stopping the welcome series and linking the address to the customer",
    KV.K.get(N.stopKey("mom@example.com")) === "1" && KV.K.get(R.uidKey(A)) === "mom@example.com");
  ok("…so no welcome (the plan had already moved), and the run sends no reminder", (await R.runRc(kv, fetch, run1, quiet)).reminded === 0 && SENT.length === 0, SENT.map((m) => m.body.subject));
  await hook(move({ event_timestamp_ms: S + 30 * 60e3 }));
  ok("an older TRANSFER arriving later never moves the kept time back", KV.K.get(R.movedKey(A)) === String(S + HOUR));
  r = await hook(ev({ type: "INITIAL_PURCHASE", event_timestamp_ms: S + 2 * HOUR, expiration_at_ms: E + 2 * HOUR, app_user_id: A, original_app_user_id: A }));
  ok("a message from after the move (the family bought again on that phone) counts as ever",
    r.status === 200 && plan().s === "trial" && zscore(R.REMIND_KEY) === E + 2 * HOUR - 50 * HOUR, [r, plan()]);
  reset(); joinList();
  KV.failOn = (c) => c[0] === "GET" && String(c[1]).startsWith("rc:moved:");
  const late = ev({ event_timestamp_ms: S, expiration_at_ms: E, app_user_id: A, original_app_user_id: A });
  r = await hook(late);
  ok("a store that cannot say whether the customer moved: 503, nothing written", r.status === 503 && KV.H.size === 0 && !KV.K.has(R.evtKey(late.id)), r);
  KV.failOn = null;
});

// ── 6. "We miss you at Sona" ──
await scenario("we miss you", async () => {
  const T = Date.parse("2026-11-02T09:00:00Z"), run = (d) => Date.parse("2026-11-02T16:00:00Z") + d * DAY;
  const end = (email = "mom@example.com", at = T) => R.apply(R.readEvent({ event: ev({ type: "EXPIRATION", period_type: "NORMAL", expiration_reason: "UNSUBSCRIBE", event_timestamp_ms: at, expiration_at_ms: at, subscriber_attributes: { $email: { value: email } } }) }), kv, at);
  reset(); joinList();
  await end();
  await R.runRc(kv, fetch, run(0), quiet);
  ok("the day it ends: not yet", SENT.length === 0);
  let r = await R.runRc(kv, fetch, run(1), quiet);
  const m = SENT[0] && SENT[0].body;
  ok("a day later: one \"We miss you at Sona\", from Rachel", r.missed === 1 && SENT.length === 1 && m.subject === "We miss you at Sona" && /Rachel, MS, CF-SLP/.test(m.text), [r, m && m.subject]);
  ok("…its button opens Sona's App Store page, with the unsubscribe link", m.html.includes(N.APP_URL) && /api\/email\/unsub/.test(m.html));
  await R.apply(R.readEvent({ event: ev({ type: "RENEWAL", period_type: "NORMAL", event_timestamp_ms: T + 30 * DAY, expiration_at_ms: T + 60 * DAY }) }), kv, T + 30 * DAY);
  await end("mom@example.com", T + 60 * DAY);
  await R.runRc(kv, fetch, T + 62 * DAY, quiet);
  ok("back, then ended again within the year: no second one", SENT.length === 1);
  reset(); joinList();
  await end();
  await R.apply(R.readEvent({ event: ev({ type: "RENEWAL", period_type: "NORMAL", event_timestamp_ms: T + HOUR, expiration_at_ms: T + 31 * DAY }) }), kv, T + HOUR);
  r = await R.runRc(kv, fetch, run(1), quiet);
  ok("came back before the note went: no note", SENT.length === 0 && r.skipped === 1, r);
  reset();
  await end();
  r = await R.runRc(kv, fetch, run(1), quiet);
  ok("an address that never joined Sona's list: nothing", SENT.length === 0, r);
});

// ── 7. the words ──
await scenario("the words", async () => {
  const all = JSON.stringify(R.MAILS) + read("lib/revenuecat.ts").match(/export function renderMail[\s\S]*?\n}\n/)[0];
  ok("Rachel signs as MS, CF-SLP, never certified/CCC", /MS, CF-SLP/.test(all) && !/\bCCC\b|certified/i.test(all));
  ok("practice, never therapy/treatment/diagnosis/score", !/therapy|treatment|diagnos|score/i.test(JSON.stringify(R.MAILS)));
  ok("no dollar figure and no number of free days (both are the App Store's)", !/\$\d/.test(JSON.stringify(R.MAILS)) && !/\b(3|three)[- ]days?\b/i.test(JSON.stringify(R.MAILS)));
  ok("the miss note's inbox preview claims nothing about what is on a phone (the app may be gone)", !/practice|saved|still on your phone/i.test(R.MAILS.miss.preview), R.MAILS.miss.preview);
  ok("no emoji, no \"correct\", no \"forever\"", !/\p{Extended_Pictographic}/u.test(JSON.stringify(R.MAILS)) && !/correctly|forever/i.test(JSON.stringify(R.MAILS)));
  ok("nothing about a child but that their practice is on the phone (no name, no age, no sound, no placeholder)",
    !/\{\w*\}|child\u2019s name|\bage\b|\bsounds?\b/i.test(JSON.stringify(R.MAILS)));
  const r = R.renderMail("remind", "https://speaksona.com/api/email/unsub?e=a%40b.co&k=x", "PO Box <1>");
  ok("the mailing address is escaped in the html", r.html.includes("PO Box &lt;1&gt;") && !r.html.includes("PO Box <1>"));
  ok("no address reaches a log, ever", !logs.some((l) => /@example\.com|@gmail\.com/i.test(l)), logs.filter((l) => /@/.test(l)).slice(0, 3));
});

// ── 8. the wiring, the founder page, and the words elsewhere ──
await scenario("wiring", async () => {
  const cron = read("app/api/cron/nurture/route.ts");
  ok("the daily run sends RevenueCat's notes after the unsubscribe check, with its start time as now, before the welcome series and the weekly report",
    /import \{ runRc \} from "@\/lib\/revenuecat"/.test(cron) && /await runRc\(undefined, undefined, started, \{ deadline: started \+ 100000 \}\)/.test(cron) &&
    cron.indexOf("await syncUnsubscribes(") < cron.indexOf("await runRc(") && cron.indexOf("await runRc(") < cron.indexOf("await runDue(") &&
    cron.indexOf("await runDue(") < cron.indexOf("await runReports("), cron.slice(cron.indexOf("const said")));
  const routeSrc = read("app/api/revenuecat/route.ts");
  ok("the route compares the header in constant time, reads the body as text (never formData), and logs nothing",
    /safeEqualStr\(given, w\)/.test(routeSrc) && /await req\.text\(\)/.test(routeSrc) && !/formData|console\./.test(routeSrc));
  ok("…and runs on Node (crypto)", /export const runtime = "nodejs";/.test(routeSrc));
  reset();
  KV.H.set(R.PLANS_KEY, new Map([["mom@example.com", JSON.stringify({ s: "paid", exp: 1, ts: 2, at: "x" })], ["bad@example.com", "{nope"], ["odd@example.com", JSON.stringify({ s: "vip" })]]));
  const plans = await R.readPlans(kv);
  ok("the founder page reads each address's last state, and skips a row it cannot read", JSON.stringify(Object.keys(plans)) === '["mom@example.com"]' && plans["mom@example.com"].s === "paid", plans);
  ok("…through the founder-only leads route", /readPlans\(\)/.test(read("app/api/founders/leads/route.ts")) && /const denied = founderGate\(req\);/.test(read("app/api/founders/leads/route.ts")));
  const page = read("public/leads.html");
  ok("/leads.html shows a Premium column and counts by state, from that answer, every value escaped",
    /\["premium", "Premium"\]/.test(page) && /pTrial/.test(page) && /pPaid/.test(page) && /pEnded/.test(page) && /j\.plans/.test(page) && /return "<td" \+ cls \+ ">" \+ esc\(v\)/.test(page));
  const sona = read("public/sona.js");
  const fn = sona.slice(sona.indexOf("function _rcEmail("), sona.indexOf("function _iapActive("));
  ok("the phone hands RevenueCat the parent's email only, optionally, never waited on",
    /typeof P\.setEmail !== "function"/.test(fn) && /const email = parentEmail\(\);/.test(fn) && /_soon\(\(\) => P\.setEmail\(\{ email: email \}\)\)\.catch\(/.test(fn) && !/childName|kidName|profile\./.test(fn), fn.slice(0, 300));
  ok("…once the store is set up, never on the purchase's own path", /_iapReady\.then\(\(\) => _rcEmail\(P\)\);/.test(sona) && !/_rcEmail/.test(sona.slice(sona.indexOf("function buyPlan("), sona.indexOf("function buyPlan(") + 1500)));
  const priv = read("public/privacy.html");
  ok("the privacy page says the app gives RevenueCat the parent's email, and what RevenueCat tells Sona",
    /the app also gives that\s+email to RevenueCat, and RevenueCat tells our server when your Premium starts, renews, is\s+cancelled or ends/.test(priv));
  ok("…the customer id link, and for how long", /with the random identifier\s+RevenueCat gave that phone/.test(priv) && /for 400 days after RevenueCat last mentioned it/.test(priv));
  ok("…that Upstash keeps RevenueCat's last word, and for how long", /what\s+RevenueCat last told us about their Premium/.test(priv) && /for a parent who gave the app their email, what RevenueCat last told us about their Premium, until you ask us to remove it/.test(priv));
  ok("…the two notes Resend delivers", /a note a day or two before Premium&rsquo;s free days\s+end \(only while they are still on them\) and one note after Premium ends/.test(priv));
  ok("…and no Kit, anywhere on it", !/\bKit\b/.test(priv));
  const native = read("NATIVE.md");
  ok("NATIVE.md says how to switch it on: the secret in Vercel, the URL and header in RevenueCat, production only",
    /REVENUECAT_WEBHOOK_AUTH/.test(native) && /URL\s+`https:\/\/www\.speaksona\.com\/api\/revenuecat`/.test(native) && /308/.test(native) && /Authorization header/i.test(native) && /Production/.test(native));
  ok("…and that a phone test takes both the sandbox switch in Vercel and the webhook's environment in RevenueCat",
    /`REVENUECAT_SANDBOX=1` in Vercel AND switch this webhook's environment\s+to Sandbox/.test(native));
  ok("…and the App Privacy answers it owes", /RevenueCat webhook/.test(native) && /Purchase History/.test(native));
});

// ── WELCOME1: the parent hears from Rachel the day the free days start ──
await scenario("welcome", async () => {
  const W = R.MAILS.welcome.subject, mine = (to = "mom@example.com") => SENT.filter((m) => m.body.subject === W && m.body.to[0] === to);
  reset(); env(); joinList();
  let r = await hook(ev({ expiration_at_ms: Date.UTC(2026, 9, 25, 18, 0) }));
  const w = mine()[0];
  ok("free days start for an address on Sona's list: one welcome, from Rachel, with the day they end",
    r.status === 200 && r.json.applied === true && mine().length === 1 && /Every game in Sona is open/.test(w.body.text) && /Your free days end on Sunday, October 25\./.test(w.body.text) && /Rachel, MS, CF-SLP/.test(w.body.text), w && w.body.text);
  ok("…with the unsubscribe link and header, and nothing about a child", /api\/email\/unsub\?e=/.test(w.body.text) && w.body.headers["List-Unsubscribe"] && !/\bMia\b/.test(w.body.text + w.body.html));
  r = await hook(ev({ expiration_at_ms: Date.now() + 3 * DAY }));
  ok("a second trial start the same year: no second welcome", r.status === 200 && mine().length === 1, mine().length);
  reset(); env();
  r = await hook(ev());
  ok("an address that never joined Sona's list gets none", r.status === 200 && r.json.applied === true && SENT.length === 0);
  reset(); env(); joinList(); KV.S.set("email:unsub", new Set(["mom@example.com"]));
  r = await hook(ev());
  ok("…nor one that unsubscribed", r.status === 200 && SENT.length === 0);
  reset(); env(); joinList();
  r = await hook(ev({ period_type: "NORMAL" }));
  ok("a plan charged today (no free days) gets no free-days welcome", r.status === 200 && SENT.length === 0);
  for (const type of ["RENEWAL", "UNCANCELLATION", "EXPIRATION"]) await hook(ev({ type, period_type: "TRIAL" }));
  ok("…nor does any other message", SENT.length === 0, SENT.map((m) => m.body.subject));
  reset(); env(); joinList(); resendStatus = 500;
  r = await hook(ev());
  ok("Resend failing on the welcome: the webhook still answers 200, and the mark is released", r.status === 200 && r.json.applied === true && !KV.K.has(R.sentKey("welcome", "mom@example.com", 0)), r);
  resendStatus = 200;
  ok("the privacy page names the welcome note", /a welcome note when Premium&rsquo;s free days start/.test(read("public/privacy.html")));
});

// ── SALEALERT1: Travis hears about each new trial or purchase ──
await scenario("sale alert", async () => {
  reset(); env();
  let r = await hook(ev());
  ok("with SALE_ALERT_TO unset, no note to Travis (only the store's own work)", r.status === 200 && SENT.length === 0 && !KV.log.some((c) => String(c[1]).startsWith("rc:alert:")), r);
  reset(); env({ SALE_ALERT_TO: "travis@example.com" });
  const first = ev({ expiration_at_ms: Date.UTC(2026, 9, 25, 18, 0) });
  r = await hook(first);
  const a = SENT.find((m) => m.body.to[0] === "travis@example.com");
  ok("a new trial emails Travis once: trial, plan, the parent's email and when the free days end",
    r.status === 200 && r.json.applied === true && a && a.body.subject === "New free trial on Sona" && /Plan: Monthly/.test(a.body.text) && /Parent email: mom@example\.com/.test(a.body.text) && /Free days end: Oct 25, 2026/.test(a.body.text), a && a.body);
  ok("…with nothing about a child in it", a && !/Mia/.test(a.body.text + a.body.html + a.body.subject), a && a.body.text);
  r = await hook(first);
  ok("the same message again (a RevenueCat retry) sends nothing more", r.status === 200 && SENT.filter((m) => m.body.to[0] === "travis@example.com").length === 1, SENT.length);
  reset(); env({ SALE_ALERT_TO: "travis@example.com" });
  r = await hook(ev({ period_type: "NORMAL", product_id: "com.speaksona.app.annual", subscriber_attributes: {} }));
  const b = SENT[0];
  ok("a plan charged today, from a family who gave no email, still reaches Travis, said as a purchase",
    r.status === 200 && r.json.ignored === "no email" && SENT.length === 1 && b.body.subject === "New Premium purchase on Sona" && /Plan: Yearly/.test(b.body.text) && /none given in the app/.test(b.body.text) && !/Free days end/.test(b.body.text), b && b.body);
  reset(); env({ SALE_ALERT_TO: "travis@example.com" });
  for (const type of ["RENEWAL", "CANCELLATION", "EXPIRATION"]) await hook(ev({ type, period_type: "NORMAL" }));
  await hook(ev({ environment: "SANDBOX" }));
  ok("renewals, cancellations, endings and Apple's sandbox never email Travis", SENT.length === 0, SENT.map((m) => m.body.subject));
  reset(); env({ SALE_ALERT_TO: "travis@example.com" }); resendStatus = 500;
  r = await hook(ev());
  ok("Resend failing on Travis's note never fails the webhook (no retry for a purchase over it)", r.status === 200 && r.json.applied === true && plan() && plan().s === "trial", r);
  resendStatus = 200; env();
});

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
