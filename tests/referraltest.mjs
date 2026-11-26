// REFER1 / CHAT1 (20 Nov 2026). Share & earn: every clinician's own link to
// send other speech therapists; $8 a month for each one who pays for Sona Pro
// (real cash, paid by hand from /leads.html). Only a brand-new account takes
// a code, never your own, never an existing account. And the dashboard's
// chat button: a plain text box (the keyboard's own dictation is the mic),
// to the same inbox as Talk to Rachel. No browser speech API anywhere.
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { runInNewContext } from "node:vm";
import path from "node:path";
import { chromium, ROOT, OUT, launchOpts } from "./_env.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const APP = ROOT.replace(/\/public$/, "");
const PUB = process.env.SONATEST_PUBLIC_ROOT || ROOT;
const { NextRequest } = require(path.join(APP, "node_modules/next/server"));

let checks = 0, fails = 0;
const ok = (n, p, extra) => { checks++; if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (typeof extra === "string" ? extra : JSON.stringify(extra)))); };
const read = (rel) => (existsSync(path.join(APP, rel)) ? readFileSync(path.join(APP, rel), "utf8") : "");
const noComments = (src) => src
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:"'])\/\/[^\n]*/g, "$1");
const REGISTER = /\b(accuracy|score|scores|adherence|therapy|treatment|diagnos\w*)\b/i;

// ═════════════════════════ part 1: the routes, for real ═════════════════════════
for (const k of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "SLP_AUTH_SECRET", "VERCEL_ENV", "STRIPE_SECRET_KEY", "RESEND_API_KEY", "GHL_API_TOKEN", "GHL_LOCATION_ID", "GHL_EMAIL_FROM"]) delete process.env[k];
const KV_URL = "https://kv.refer.test.invalid";
process.env.KV_REST_API_URL = KV_URL;
process.env.KV_REST_API_TOKEN = "kv-test-token";
process.env.SLP_AUTH_SECRET = "refer-test-secret";

const KV = { K: new Map(), H: new Map(), TTL: new Map(), log: [] };
const hash = (k) => { if (!KV.H.has(k)) KV.H.set(k, new Map()); return KV.H.get(k); };
function kvExec(cmd) {
  const c = cmd.map(String);
  const [op, key] = c;
  switch (op) {
    case "GET": return KV.K.has(key) ? KV.K.get(key) : null;
    case "SET": {
      const rest = c.slice(3);
      if (rest.includes("NX") && KV.K.has(key)) return null;
      KV.K.set(key, c[2]);
      const ex = rest.indexOf("EX"); if (ex >= 0) KV.TTL.set(key, Number(rest[ex + 1])); else KV.TTL.delete(key);
      return "OK";
    }
    case "GETDEL": { const v = KV.K.has(key) ? KV.K.get(key) : null; KV.K.delete(key); return v; }
    case "INCR": { const n = Number(KV.K.get(key) || 0) + 1; KV.K.set(key, String(n)); return n; }
    case "EVAL": {
      if (c[1].startsWith("-- slpacct:update\n")) return KV.K.get(c[3]) === c[4] ? kvExec(["SET", c[3], c[5]]) : null;
      if (!/^-- rl:incr\n/.test(c[1])) throw new Error("fake kv does not speak this script");
      const k = c[3], n = Number(KV.K.get(k) || 0) + 1; KV.K.set(k, String(n));
      if (!KV.TTL.has(k)) KV.TTL.set(k, Number(c[4]));
      return n;
    }
    case "EXPIRE": KV.TTL.set(key, Number(c[2])); return 1;
    case "DEL": return (KV.K.delete(key) ? 1 : 0) + (KV.H.delete(key) ? 1 : 0);
    case "MGET": return c.slice(1).map((k) => (KV.K.has(k) ? KV.K.get(k) : null));
    case "HSET": { let added = 0; for (let i = 2; i + 1 < c.length; i += 2) { if (!hash(key).has(c[i])) added++; hash(key).set(c[i], c[i + 1]); } return added; }
    case "HSETNX": { if (hash(key).has(c[2])) return 0; hash(key).set(c[2], c[3]); return 1; }
    case "HGET": return KV.H.has(key) && KV.H.get(key).has(c[2]) ? KV.H.get(key).get(c[2]) : null;
    case "HGETALL": return KV.H.has(key) ? [...KV.H.get(key)].flat() : [];
    case "HDEL": { let n = 0; for (const f of c.slice(2)) if (KV.H.has(key) && KV.H.get(key).delete(f)) n++; return n; }
    case "HEXISTS": return KV.H.has(key) && KV.H.get(key).has(c[2]) ? 1 : 0;
    case "HLEN": return KV.H.has(key) ? KV.H.get(key).size : 0;
    case "SADD": { if (!KV.S) KV.S = new Map(); if (!KV.S.has(key)) KV.S.set(key, new Set()); let n = 0; for (const m of c.slice(2)) if (!KV.S.get(key).has(m)) { KV.S.get(key).add(m); n++; } return n; }
    case "SMEMBERS": return KV.S && KV.S.has(key) ? [...KV.S.get(key)] : [];
    case "SCAN": return ["0", []];
    case "LRANGE": return [];
    default: throw new Error("fake kv does not speak " + op);
  }
}
const realFetch = globalThis.fetch;
// GoHighLevel, when a test turns it on (Add a family's one email): the
// contact upsert and the message, each kept to be read.
const GHL = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith("https://services.leadconnectorhq.com/")) {
    const body = JSON.parse(init.body);
    GHL.push({ path: u.slice("https://services.leadconnectorhq.com".length), body });
    return Response.json(u.endsWith("/contacts/upsert") ? { contact: { id: "ghl-contact-1" } } : { messageId: "ghl-message-1" });
  }
  if (u === KV_URL) {
    const cmd = JSON.parse(init.body);
    KV.log.push(cmd.map(String));
    return Response.json({ result: kvExec(cmd) });
  }
  if (/^http:\/\/127\.0\.0\.1:/.test(u)) return realFetch(url, init);
  return new Response("{}", { status: 404 });
};
// Stripe never has a plan for anyone here: coverage comes from the account
// stamps alone (no `terms` is grandfathered, and covered).
const stripe = { subscriptions: { search: async () => ({ data: [], has_more: false }), list: async () => ({ data: [] }), retrieve: async () => { throw new Error("none"); } }, customers: { list: async () => ({ data: [] }) } };
function FakeStripe() { return stripe; }

const cache = new Map();
function loadTs(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const req = (s) => s === "stripe" ? FakeStripe
    : s.startsWith("@/") ? loadTs(path.join(APP, s.slice(2) + (s.endsWith(".ts") ? "" : ".ts")))
    : s === "next/server" ? require(path.join(APP, "node_modules/next/server"))
    : require(s);
  new Function("require", "module", "exports", js)(req, mod, mod.exports);
  return mod.exports;
}
const L = (rel) => loadTs(path.join(APP, rel));


const realErr = console.error; console.error = () => {};
let A, RF, R = {};
try {
  A = L("lib/slpAuth.ts"); RF = L("lib/referral.ts");
  for (const [k, rel] of Object.entries({
    request: "app/api/slp/auth/request/route.ts", verify: "app/api/slp/auth/verify/route.ts",
    referral: "app/api/slp/referral/route.ts", founders: "app/api/founders/referrals/route.ts",
  })) R[k] = L(rel);
} catch (e) { console.log("(could not load: " + (e && e.stack) + ")"); }
ok("the referral library and its routes load", !!(A && RF && R.request && R.verify && R.referral && R.founders));

let ip = 0;
const cookieFor = (email) => "slp_session=" + encodeURIComponent(A.signSession({ email, code: "", iat: Date.now(), exp: Date.now() + 600000 }));
async function call(route, method, url, o = {}) {
  ip++;
  const h = new Headers({ "content-type": "application/json", "x-real-ip": "10.9." + ((ip >> 8) & 255) + "." + (ip & 255), origin: "https://sona.test.invalid" });
  if (o.as) h.set("cookie", cookieFor(o.as));
  if (o.headers) for (const [k, v] of Object.entries(o.headers)) h.set(k, v);
  const init = { method, headers: h };
  if (o.body !== undefined) init.body = JSON.stringify(o.body);
  const res = await route[method](new NextRequest("https://sona.test.invalid" + url, init));
  let json = null; try { json = await res.clone().json(); } catch { json = null; }
  return { status: res.status, json };
}
async function signUp(email, ref) {
  const r = await call(R.request, "POST", "/api/slp/auth/request", { body: { flow: "trial", email, ...(ref !== undefined ? { ref } : {}) } });
  const link = r.json && r.json.devLink;
  if (!link) return r;
  const u = new URL(link);
  return call(R.verify, "POST", u.pathname + u.search);
}
const acct = (e) => JSON.parse(KV.K.get("slpacct:" + e) || "null");
const mirror = (e, status) => KV.K.set("slpplan-pro:" + e, JSON.stringify({ sub: "sub_" + e, customer: "cus", status, periodEnd: null, cancelAtPeriodEnd: false, checkedAt: Date.now() }));

if (A && RF && R.referral) {
  const AMY = "amy@brightsteps.org";
  KV.K.set("slpacct:" + AMY, JSON.stringify({ email: AMY, name: "Amy", code: "amy-1", terms: "pro-2026-11-12", createdAt: new Date().toISOString() }));
  let r = await call(R.referral, "GET", "/api/slp/referral");
  ok("the link needs a signed-in clinician", r.status === 401, r);
  r = await call(R.referral, "GET", "/api/slp/referral", { as: AMY });
  const link = r.json && r.json.link || "";
  const code = (link.match(/\?ref=([a-z0-9]{8})$/) || [])[1];
  ok("a clinician gets one link to the trial page, ?ref=<8 letters>", r.status === 200 && !!code && link.startsWith("https://sona.test.invalid/?ref="), r);
  ok("…with nothing earned yet", r.json.signedUp === 0 && r.json.paying === 0 && r.json.monthly === "$0" && r.json.pay === "$8", r.json);
  ok("the code is kept on the account and points back to it", acct(AMY).refCode === code && KV.K.get("slpref:" + code) === AMY);
  r = await call(R.referral, "GET", "/api/slp/referral", { as: AMY });
  ok("asking again keeps the same link", r.json && r.json.link === link, r.json);

  await signUp("bo@riverside.org", code);
  ok("a new therapist who signs up with the link is Amy's referral", acct("bo@riverside.org") && acct("bo@riverside.org").referredBy === AMY, acct("bo@riverside.org"));
  await signUp("cy@riverside.org", code.toUpperCase());
  ok("…a code in capitals counts too", acct("cy@riverside.org") && acct("cy@riverside.org").referredBy === AMY);
  await signUp("di@riverside.org", "nosuch12");
  ok("an unknown code refers nobody", acct("di@riverside.org") && !acct("di@riverside.org").referredBy);
  r = await call(R.request, "POST", "/api/slp/auth/request", { body: { flow: "trial", email: "ed@riverside.org", ref: "<script>" } });
  ok("a malformed code is dropped, never an error", r.status === 200, r);
  // Amy, already an account, signs up again through her own link.
  await signUp(AMY, code);
  ok("your own link never refers you", !acct(AMY).referredBy);
  KV.K.set("slpacct:old@clinic.org", JSON.stringify({ email: "old@clinic.org", code: "old-1", createdAt: "2026-10-01" }));
  await signUp("old@clinic.org", code);
  ok("an existing account never takes a code", !acct("old@clinic.org").referredBy);

  mirror("bo@riverside.org", "active"); mirror("cy@riverside.org", "trialing");
  r = await call(R.referral, "GET", "/api/slp/referral", { as: AMY });
  ok("the counts: 2 signed up, 1 on trial, 1 paying, $8 a month", r.json && r.json.signedUp === 2 && r.json.trialing === 1 && r.json.paying === 1 && r.json.monthly === "$8", r.json);
  mirror("cy@riverside.org", "active");
  for (const e of ["f1@x.org", "f2@x.org"]) { await signUp(e, code); mirror(e, "active"); }
  mirror("f2@x.org", "past_due");
  r = await call(R.referral, "GET", "/api/slp/referral", { as: AMY });
  ok("three paying is $24 a month (a payment problem does not count)", r.json && r.json.paying === 3 && r.json.monthly === "$24", r.json);

  r = await call(R.founders, "GET", "/api/founders/referrals");
  ok("the founders' list needs the founder key", r.status !== 200, r);
  process.env.FOUNDER_KEY = "refer-founder-key-123";
  r = await call(R.founders, "GET", "/api/founders/referrals", { headers: { "x-founder-key": "refer-founder-key-123" } });
  ok("the founders' list says who earns what this month", r.status === 200 && r.json.owed === "$24" && r.json.rows.length === 1 && r.json.rows[0].email === AMY && r.json.rows[0].paying === 3, r.json);
}

// ── the pages ──
const slp = read("public/slp.html"), plans = read("public/for-slps.html"), leads = read("public/leads.html");
ok("the dashboard has Share & earn in its menu and its own page, both web only (data-sells)",
  /class="nav-item" data-page="refer" href="#refer" data-sells/.test(slp) && /id="page-refer" data-sells/.test(slp) && /refer:1/.test(slp));
ok("…it says $8 a month and that three paying therapists cover their own Sona Pro",
  /Earn \$8 a month for each therapist who pays/.test(slp) && /Three paying therapists cover your own Sona Pro/.test(slp));
ok("…and that families on the caseload never count", /Only speech therapists count, not the families on your caseload/.test(slp));
ok("the trial page keeps ?ref= for 60 days and sends it with the sign-up",
  /sona\.slp\.ref/.test(plans) && /REF_DAYS = 60/.test(plans) && /ref: ref \|\| undefined/.test(plans));
ok("/leads.html lists the referrals to pay", /id="rRows"/.test(leads) && /\/api\/founders\/referrals/.test(leads));
const live = noComments(slp);
ok("the chat button: a text box sent to the feedback inbox, Help / Idea / Problem",
  /id="chatFab"/.test(slp) && /id="chatText"/.test(slp) && /data-cat="question"[^>]*>Help/.test(slp) && /data-cat="feature"[^>]*>Idea/.test(slp) && /data-cat="bug"[^>]*>Problem/.test(slp) &&
  /fetch\("\/api\/slp\/feedback"[\s\S]{0,200}kind:"feedback",category:cat/.test(slp));
ok("…its mic is the keyboard's own dictation: no page listens itself", /tap the microphone on your keyboard/i.test(slp) &&
  !/SpeechRecognition|getUserMedia/.test(live));
ok("…shown once signed in, never in print", /\$\("chatFab"\)\.hidden=false/.test(slp) && /\.chat-fab, \.chat-panel/.test(slp));


console.log(`\n${checks} checks, ${fails} failure${fails === 1 ? "" : "s"}`);
process.exit(fails ? 1 : 0);
