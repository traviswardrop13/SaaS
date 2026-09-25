// CASELOAD1: "Sona Premium for your caseload" — the clinician's $79.99 plan,
// and every promise that rides on it (24 Sep 2026).
//
// What this suite exists to hold, in the order a clinician meets it:
//  - the plan is bought on the web, by a signed-in clinician, with no trial,
//    stamped `plan` + `slp` and NEVER `tier` (a tier is a family charter
//    spot, and lib/charter counts those);
//  - the success redirect's session id is a QUESTION for Stripe, never a
//    grant: another clinician's session, an unfinished one or a family's
//    stores nothing;
//  - the mirror of Stripe is re-read every ten minutes, and a Stripe outage
//    keeps the last answer — Premium is never taken away by a blip;
//  - covered = grandfathered (an account with no `terms` field: signed up
//    under "free forever") OR a live paid plan; every NEW account carries
//    `terms`, and no existing one ever gains it;
//  - a family device asks /api/slp/covered with its enrolment ticket, and
//    asking never counts as joining (no slpredeem INCR); a ticket past half
//    its life — or expired, if genuinely signed — gets the truth AND a fresh
//    ticket, so coverage never freezes at day 400;
//  - the redeem cap is 60, or 300 for a covered code — per code AND per
//    clinician, so claiming new codes does not multiply it;
//  - the caseload's billing page cancels at period end by its own
//    configuration, and the family portal refuses a clinician's receipt;
//  - the clinician's own phone needs a work email or the founder's approval,
//    and its link goes only to the ACCOUNT's own address, once;
//  - a parent's email typed into an invite is used for ONE send and kept
//    nowhere — not the store, not the log, not /api/lead, not Kit;
//  - restore-by-email and the charter count both ignore caseload plans.
//
// The routes are TypeScript. Like slpcommunityapi, this suite transpiles each
// module to CommonJS with the repo's own `typescript` and hands it a require
// that maps "@/x" to the repo file and "stripe" to a FAKE Stripe — so every
// route runs for real against a fake Stripe, a fake KV (behind the same
// fetch the real kvCmd makes) and a fake Resend, and the suite can read
// every command and every outbound call they made.
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { NextRequest } = require(path.join(ROOT, "node_modules/next/server"));

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };
const read = (rel) => (existsSync(path.join(ROOT, rel)) ? readFileSync(path.join(ROOT, rel), "utf8") : "");
// A "must not appear" check reads CODE, not the comment that explains the ban.
const noComments = (src) => src
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:"'])\/\/[^\n]*/g, "$1");

// ── env: a store, a signing secret, Stripe and Resend all "configured" ──
const ENV_KEYS = ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "SLP_AUTH_SECRET",
  "VERCEL_ENV", "STRIPE_SECRET_KEY", "STRIPE_PRICE_ID_SLP_CASELOAD", "STRIPE_PORTAL_CONFIG_CASELOAD", "RESEND_API_KEY", "FOUNDER_KEY", "KIT_API_KEY", "LEAD_WEBHOOK_URL", "NEXT_PUBLIC_SITE_URL"];
for (const k of ENV_KEYS) delete process.env[k];
const KV_URL = "https://kv.caseload.test.invalid";
process.env.KV_REST_API_URL = KV_URL;
process.env.KV_REST_API_TOKEN = "kv-test-token";
process.env.SLP_AUTH_SECRET = "caseload-test-secret";
process.env.STRIPE_SECRET_KEY = "sk_test_caseload";
process.env.RESEND_API_KEY = "re_test_caseload";
process.env.FOUNDER_KEY = "founder-key-for-tests";

// ── the fake store, spoken to through fetch exactly as kvCmd speaks ──
const KV = { K: new Map(), H: new Map(), TTL: new Map(), log: [], down: false };
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
    case "SCAN": {
      const pat = c[c.indexOf("MATCH") + 1] || "*";
      const re = new RegExp("^" + pat.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
      return ["0", [...KV.K.keys()].filter((k) => re.test(k))];
    }
    case "LRANGE": return [];
    default: throw new Error("fake kv does not speak " + op);
  }
}

// ── every other outbound call: Resend is faked, everything else recorded ──
const OUT = [];
const RESEND = { sent: [], status: 200, body: "{}" };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u === KV_URL) {
    const cmd = JSON.parse(init.body);
    KV.log.push(cmd.map(String));
    if (KV.down) return new Response("{}", { status: 503 });
    return Response.json({ result: kvExec(cmd) });
  }
  const body = init && init.body ? (() => { try { return JSON.parse(init.body); } catch { return init.body; } })() : null;
  OUT.push({ url: u, body });
  if (u === "https://api.resend.com/emails") {
    RESEND.sent.push(body);
    return new Response(RESEND.body, { status: RESEND.status });
  }
  if (u.endsWith("/api/lead")) return Response.json({ ok: true, captured: true });
  return new Response("{}", { status: 404 });
};

// ── the fake Stripe: every `new Stripe(key)` in a route gets this client ──
const S = { calls: [], down: false, subs: new Map(), sessions: new Map(), customers: [], searchNoise: [], cfgFail: false, badCfg: new Set() };
let csSeq = 0, cfgSeq = 0;
const stripeErr = (msg, code) => Object.assign(new Error(msg), { code });
const need = () => { if (S.down) throw new Error("stripe is down (test)"); };
const client = {
  checkout: { sessions: {
    create: async (p) => { S.calls.push(["checkout.sessions.create", p]); need(); const id = "cs_test_" + String(++csSeq).padStart(14, "0"); return { id, url: "https://checkout.stripe.test/c/" + id }; },
    retrieve: async (id, opts) => {
      S.calls.push(["checkout.sessions.retrieve", id, opts]); need();
      const s = S.sessions.get(id); if (!s) throw stripeErr("No such checkout.session", "resource_missing");
      const out = { ...s };
      if (opts && opts.expand && opts.expand.includes("subscription") && typeof s.subscription === "string") out.subscription = S.subs.get(s.subscription) || s.subscription;
      return out;
    },
  } },
  subscriptions: {
    retrieve: async (id) => { S.calls.push(["subscriptions.retrieve", id]); need(); const s = S.subs.get(id); if (!s) throw stripeErr("No such subscription", "resource_missing"); return s; },
    search: async ({ query }) => {
      S.calls.push(["subscriptions.search", query]); need();
      const m = /metadata\['slp'\]:'([^']*)'/.exec(query);
      const hits = [...S.subs.values()].filter((s) => m && s.metadata && s.metadata.slp === m[1]);
      return { data: [...hits, ...S.searchNoise], has_more: false, next_page: null };
    },
    list: async ({ customer }) => { S.calls.push(["subscriptions.list", customer]); need(); return { data: [...S.subs.values()].filter((s) => s.customer === customer) }; },
  },
  customers: { list: async ({ email }) => { S.calls.push(["customers.list", email]); need(); return { data: S.customers.filter((c) => c.email === email) }; } },
  billingPortal: {
    sessions: { create: async (p) => {
      S.calls.push(["billingPortal.sessions.create", p]); need();
      // a configuration Stripe no longer knows (deleted, or the other mode's) is refused on its `param`, as Stripe does
      if (p.configuration && S.badCfg.has(p.configuration)) throw Object.assign(new Error("No such configuration: '" + p.configuration + "'"), { code: "resource_missing", param: "configuration" });
      return { url: "https://billing.stripe.test/p/" + p.customer + (p.configuration ? "?cfg=" + p.configuration : "") };
    } },
    configurations: { create: async (p) => {
      S.calls.push(["billingPortal.configurations.create", p]); need();
      if (S.cfgFail) throw new Error("portal configuration refused (test)");
      return { id: "bpc_test_" + String(++cfgSeq).padStart(6, "0"), ...p };
    } },
  },
};
function FakeStripe() { return client; }
const nowS = () => Math.floor(Date.now() / 1000);
function mkSub(id, o = {}) {
  const metadata = {};
  if (o.plan !== null) metadata.plan = o.plan === undefined ? "slp-caseload" : o.plan;
  if (o.slp) metadata.slp = o.slp;
  if (o.tier) metadata.tier = o.tier;
  const s = {
    id, status: o.status || "active", customer: o.customer || "cus_" + id, metadata,
    cancel_at_period_end: !!o.cancel, cancel_at: null,
    items: { data: [{ current_period_end: o.periodEnd === undefined ? nowS() + 300 * 86400 : o.periodEnd, price: { unit_amount: 7999, recurring: { interval: o.interval || "year" } } }] },
  };
  S.subs.set(id, s);
  return s;
}

// ── the loader: TS → CJS, "@/x" → the repo, "stripe" → the fake ──
const cache = new Map();
function loadTs(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const req = (s) => s === "stripe" ? FakeStripe
    : s.startsWith("@/") ? loadTs(path.join(ROOT, s.slice(2) + (s.endsWith(".ts") ? "" : ".ts")))
    : s === "next/server" ? require(path.join(ROOT, "node_modules/next/server"))
    : require(s);
  new Function("require", "module", "exports", js)(req, mod, mod.exports);
  return mod.exports;
}
const L = (rel) => loadTs(path.join(ROOT, rel));

let A, C, W, F, CH, R = {};
try {
  A = L("lib/slpAuth.ts");
  C = L("lib/caseload.ts");
  W = L("lib/workEmail.ts");
  F = L("lib/founder.ts");
  CH = L("lib/charter.ts");
  for (const [k, rel] of Object.entries({
    plan: "app/api/slp/plan/route.ts", portal: "app/api/slp/plan/portal/route.ts", covered: "app/api/slp/covered/route.ts",
    self: "app/api/slp/self/route.ts", approve: "app/api/founders/approve/route.ts", redeem: "app/api/slp/redeem/route.ts",
    invite: "app/api/slp/invite/route.ts", request: "app/api/slp/auth/request/route.ts", verify: "app/api/slp/auth/verify/route.ts",
    account: "app/api/slp/account/route.ts", subscription: "app/api/subscription/route.ts", session: "app/api/checkout/session/route.ts",
    famPortal: "app/api/portal/route.ts",
  })) R[k] = L(rel);
} catch (e) {
  console.log("(could not load the modules: " + (e && e.stack) + ")");
}
ok("every caseload module and route loads", !!(A && C && W && F && CH && R.plan && R.covered && R.self && R.approve), Object.keys(R).join());
if (!C) { console.log(fails + " FAILURES"); process.exit(1); }

// ── request helper ──
let ip = 0;
const cookieFor = (email) => "slp_session=" + encodeURIComponent(A.signSession({ email, code: "", iat: Date.now(), exp: Date.now() + 600000 }));
async function call(route, method, url, o = {}) {
  ip++;
  const h = new Headers({ "content-type": "application/json", "x-real-ip": "10.9." + ((ip >> 8) & 255) + "." + (ip & 255), origin: "https://sona.test.invalid", ...(o.headers || {}) });
  if (o.as) h.set("cookie", cookieFor(o.as));
  const init = { method, headers: h };
  if (o.body !== undefined) init.body = typeof o.body === "string" ? o.body : JSON.stringify(o.body);
  const res = await route[method](new NextRequest("https://sona.test.invalid" + url, init));
  let json = null; try { json = await res.clone().json(); } catch { json = null; }
  return { status: res.status, json, location: res.headers.get("location") };
}
// console.error, captured: the suite stays readable, and can prove what was never logged
const ERRS = [];
const realErr = console.error;
console.error = (...a) => { ERRS.push(a.map(String).join(" ")); };

const iso = () => new Date().toISOString();
function seedAcct(email, o = {}) {
  const a = { email, name: o.name === undefined ? "Sam Rivera" : o.name, clinic: "", code: o.code || "", familyKey: o.familyKey || "", createdAt: iso() };
  if (o.terms !== false) a.terms = C.CASELOAD_TERMS;       // a NEW-era account unless told otherwise
  KV.K.set("slpacct:" + email, JSON.stringify(a));
  if (o.code) KV.K.set("slpcode:" + o.code, email);
  return a;
}
const storedPlan = (email) => { try { return JSON.parse(KV.K.get("slpplan:" + email)); } catch { return null; } };
const count = (pred) => S.calls.filter(pred).length;

// ═════════════════════════ constants and the work-email rule ═════════════════════════
{
  ok("the plan is $79.99 a year: 7999 cents, printed \"$79.99\"", C.CASELOAD_CENTS === 7999 && C.CASELOAD_PRICE === "$79.99");
  ok("…said per month as \"under $7 a month\" — true ($6.67 would imply $80.04), never a rounded figure",
    C.CASELOAD_PER_MONTH === "under $7 a month" && C.CASELOAD_CENTS / 12 < 700 && !/6\.6[67]/.test(read("lib/caseload.ts").replace(/\/\/[^\n]*/g, "")));
  ok("the Stripe stamp, the terms stamp and the name are the contract's", C.CASELOAD_PLAN === "slp-caseload" && C.CASELOAD_TERMS === "caseload-2026-09" && C.CASELOAD_NAME === "Sona Premium for your caseload");
  ok("a covered code may bring 300 families", C.COVERED_REDEEM_CAP === 300);
  ok("covered statuses are active, trialing and past_due — and only those",
    [...C.COVERED_STATUSES].sort().join() === "active,past_due,trialing");

  const blocked = ["amy@gmail.com", "AMY@GMAIL.COM", "a@googlemail.com", "a@yahoo.com", "a@yahoo.co.uk", "a@ymail.com", "a@rocketmail.com",
    "a@hotmail.com", "a@hotmail.fr", "a@outlook.com", "a@outlook.com.au", "a@live.com", "a@live.ca", "a@msn.com", "a@icloud.com", "a@me.com",
    "a@mac.com", "a@aol.com", "a@proton.me", "a@protonmail.com", "a@pm.me", "a@gmx.de", "a@gmx.net", "a@mail.com", "a@zoho.com",
    "a@yandex.ru", "a@hey.com", "a@fastmail.com", "a@comcast.net", "a@att.net", "a@sbcglobal.net", "a@verizon.net", "a@cox.net",
    "a@charter.net", "a@bellsouth.net", "a@earthlink.net", "a@frontier.com", "a@optonline.net", "a@gmail.com."];
  const wrongly = blocked.filter((e) => W.isWorkEmail(e));
  ok("every free-mail inbox on the list is refused, in any case and any country domain", wrongly.length === 0, wrongly.join(" "));
  const work = ["sam@riverside-schools.org", "sam@district.k12.ca.us", "sam@childrens.hospital.org", "sam@brightspeech.com", "sam@live.district.k12.ca.us", "sam@uw.edu"];
  const refused = work.filter((e) => !W.isWorkEmail(e));
  ok("an employer's domain passes — including one that merely contains a brand word", refused.length === 0, refused.join(" "));
  ok("a malformed address is never a work address", !W.isWorkEmail("") && !W.isWorkEmail("nobody") && !W.isWorkEmail("@clinic.org") && !W.isWorkEmail("a@clinic"));
  ok("the block list is exported as a Set", W.CONSUMER_MAIL_DOMAINS instanceof Set && W.CONSUMER_MAIL_DOMAINS.has("gmail.com"));
}

// ═════════════════════════ covered = grandfathered || paid (the library) ═════════════════════════
{
  const kv = async (cmd) => kvExec(cmd);
  seedAcct("old@clinic.org", { terms: false });
  S.calls.length = 0;
  let st = await C.planStatus("old@clinic.org", { kv, stripe: client });
  ok("an account WITHOUT `terms` is grandfathered: covered, forever, free", st.active && st.source === "grandfathered" && st.periodEnd === null, JSON.stringify(st));
  ok("…decided without asking Stripe anything", S.calls.length === 0, JSON.stringify(S.calls));
  ok("grandfathered() is structural: a missing account is not, an account with `terms` is not",
    C.grandfathered({ email: "x" }) && !C.grandfathered(null) && !C.grandfathered({ terms: C.CASELOAD_TERMS }) && !C.grandfathered({ terms: "" }));

  seedAcct("new@clinic.org");
  st = await C.planStatus("new@clinic.org", { kv, stripe: client });
  ok("an account WITH `terms` and no plan is not covered", !st.active && st.source === "none", JSON.stringify(st));
  const neg = storedPlan("new@clinic.org");
  // 24 Sep 2026: this pin read "cached with an expiry, so the next ten
  // minutes cost no Stripe search". Ten minutes of a remembered "no plan" was
  // ten minutes in which a clinician who had just paid (success redirect
  // lost) had every joining family told "not covered" — an answer the device
  // then keeps for six hours. A negative now lives a minute, in the store's
  // expiry AND in the freshness rule, so a lost redirect is found by the
  // next question after it.
  ok("…and the negative answer is cached for ONE MINUTE (store expiry 60s), not the ten a real mirror gets",
    neg && neg.sub === "" && neg.status === "none" && KV.TTL.get("slpplan:new@clinic.org") === 60 && C.NEGATIVE_MS === 60000, JSON.stringify(neg) + " ttl " + KV.TTL.get("slpplan:new@clinic.org"));
  S.calls.length = 0;
  await C.planStatus("new@clinic.org", { kv, stripe: client });
  ok("…inside that minute a second question costs no Stripe search", count((c) => c[0] === "subscriptions.search") === 0, JSON.stringify(S.calls));
  KV.K.set("slpplan:new@clinic.org", JSON.stringify({ ...neg, checkedAt: Date.now() - 61 * 1000 }));
  mkSub("sub_newlate", { slp: "new@clinic.org" });
  st = await C.planStatus("new@clinic.org", { kv, stripe: client });
  ok("…and past it, Stripe is asked again — a plan bought since is found, though ten minutes have not passed",
    st.active && st.source === "paid" && count((c) => c[0] === "subscriptions.search") === 1, JSON.stringify(st));
  S.subs.delete("sub_newlate"); KV.K.delete("slpplan:new@clinic.org");

  const t0 = Date.now();
  const cases = [["active", true], ["trialing", true], ["past_due", true], ["canceled", false], ["unpaid", false], ["incomplete", false], ["incomplete_expired", false], ["paused", false]];
  const wrong = cases.filter(([status, want]) =>
    C.recordActive({ sub: "s", customer: "c", status, periodEnd: nowS() + 1000, cancelAtPeriodEnd: false, checkedAt: t0 }) !== want);
  ok("a paid plan covers while Stripe says active, trialing or past_due (card-retry grace) — nothing else", wrong.length === 0, JSON.stringify(wrong));
  ok("a cancelled-at-period-end plan covers until the paid year ends",
    C.recordActive({ sub: "s", customer: "c", status: "active", periodEnd: nowS() + 86400, cancelAtPeriodEnd: true, checkedAt: t0 }));
  ok("…and not after — even while Stripe cannot be asked to confirm it",
    !C.recordActive({ sub: "s", customer: "c", status: "active", periodEnd: nowS() - 60, cancelAtPeriodEnd: true, checkedAt: t0 }));

  seedAcct("paid@clinic.org");
  mkSub("sub_paidlib", { slp: "paid@clinic.org" });
  KV.K.set("slpplan:paid@clinic.org", JSON.stringify({ sub: "sub_paidlib", customer: "cus_sub_paidlib", status: "active", periodEnd: nowS() + 86400, cancelAtPeriodEnd: false, checkedAt: Date.now() }));
  ok("covered(email) is true for a paid, live plan", (await C.covered("paid@clinic.org", { kv, stripe: client })) === true);

  KV.down = true;
  let threw = null;
  try { await C.planStatus("old@clinic.org", { kv: async (c) => { KV.log.push(c); return undefined; } }); } catch (e) { threw = e; }
  KV.down = false;
  ok("a store that does not answer is a THROW (StoreUnavailable), never \"not covered\"", threw instanceof C.StoreUnavailable, String(threw));
}

// ═════════════════════════ POST /api/slp/plan — the checkout ═════════════════════════
{
  const r0 = await call(R.plan, "POST", "/api/slp/plan", {});
  ok("checkout needs a signed-in clinician (401)", r0.status === 401);

  seedAcct("gf@clinic.org", { terms: false, code: "gf-k4", familyKey: "GFKEY234" });
  S.calls.length = 0;
  let r = await call(R.plan, "POST", "/api/slp/plan", { as: "gf@clinic.org" });
  ok("a grandfathered clinician is never sold the plan: 409 already", r.status === 409 && r.json.already === true && r.json.ok === false, JSON.stringify(r));
  ok("…and no checkout session is created", count((c) => c[0] === "checkout.sessions.create") === 0);

  r = await call(R.plan, "POST", "/api/slp/plan", { as: "paid@clinic.org" });
  ok("a clinician already paying is refused too: 409 already", r.status === 409 && r.json.already === true, JSON.stringify(r.json));

  seedAcct("buyer@riverside-schools.org", { code: "buyer-k4", familyKey: "BUYKEY23" });
  S.calls.length = 0;
  r = await call(R.plan, "POST", "/api/slp/plan", { as: "buyer@riverside-schools.org", body: { email: "someone-else@x.org", plan: "family", tier: "charter" } });
  const made = S.calls.find((c) => c[0] === "checkout.sessions.create");
  const p = made && made[1];
  ok("an uncovered clinician gets a Stripe Checkout link", r.status === 200 && r.json.ok && /^https:\/\/checkout\.stripe\.test\//.test(r.json.url), JSON.stringify(r.json));
  ok("…a subscription", p && p.mode === "subscription");
  ok("…stamped plan + slp on the session AND the subscription — the email from the SESSION, not the body",
    p && JSON.stringify(p.metadata) === JSON.stringify({ plan: "slp-caseload", slp: "buyer@riverside-schools.org" }) &&
    JSON.stringify(p.subscription_data.metadata) === JSON.stringify({ plan: "slp-caseload", slp: "buyer@riverside-schools.org" }), JSON.stringify(p));
  ok("…and NEVER a tier, anywhere: only tier \"charter\" is a family charter spot", p && !/"tier"/.test(JSON.stringify(p)), JSON.stringify(p));
  ok("…with no trial", p && !("trial_period_days" in (p.subscription_data || {})) && !/trial/i.test(JSON.stringify(p)), JSON.stringify(p.subscription_data));
  ok("…$79.99 a year, in dollars", p && p.line_items.length === 1 && p.line_items[0].price_data.unit_amount === 7999 &&
    p.line_items[0].price_data.currency === "usd" && p.line_items[0].price_data.recurring.interval === "year" &&
    p.line_items[0].price_data.product_data.name === "Sona Premium for your caseload", JSON.stringify(p && p.line_items));
  ok("…to the signed-in address, referenced by the clinic code, promotion codes allowed",
    p && p.customer_email === "buyer@riverside-schools.org" && p.client_reference_id === "buyer-k4" && p.allow_promotion_codes === true);
  ok("…returning to the dashboard's Premium page with the session id for activation",
    p && p.success_url === "https://sona.test.invalid/slp.html?plan_session={CHECKOUT_SESSION_ID}#premium" && p.cancel_url === "https://sona.test.invalid/slp.html#premium",
    p && p.success_url);
  ok("…having asked Stripe afresh before selling (not the ten-minute mirror)", count((c) => c[0] === "subscriptions.search") >= 1);
  // 24 Sep 2026 — the activation race. That forced check is asked the moment
  // BEFORE the clinician pays, so its "no plan" is stale by design. Cached,
  // it hid the purchase that followed whenever the success redirect was
  // lost (tab closed, Stripe blip on activation): every family who asked in
  // the next ten minutes was told "not covered" and kept that for six hours.
  ok("…and that forced \"no plan\" is NOT remembered: no slpplan record is written",
    !KV.K.has("slpplan:buyer@riverside-schools.org"), KV.K.get("slpplan:buyer@riverside-schools.org"));
  {
    const racer = "racer@riverside-schools.org";
    seedAcct(racer, { code: "racer-k4", familyKey: "RACEKEY2" });
    const buy = await call(R.plan, "POST", "/api/slp/plan", { as: racer });
    mkSub("sub_racer", { slp: racer, customer: "cus_racer" });          // they paid; the redirect never came back
    const after = await call(R.plan, "GET", "/api/slp/plan", { as: racer });
    const fam = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "racer-k4", ticket: A.signTicket("racer-k4", 400, "kidR") } });
    ok("a clinician who pressed Buy, paid, and lost the redirect is covered on the very next question — not ten minutes later",
      buy.status === 200 && after.json.active === true && after.json.source === "paid" && fam.json.covered === true, JSON.stringify([after.json, fam.json]));
  }

  process.env.STRIPE_PRICE_ID_SLP_CASELOAD = "price_caseload_7999";
  S.calls.length = 0;
  await call(R.plan, "POST", "/api/slp/plan", { as: "buyer@riverside-schools.org" });
  const p2 = (S.calls.find((c) => c[0] === "checkout.sessions.create") || [])[1];
  ok("a configured Stripe Price is used when set", p2 && JSON.stringify(p2.line_items) === JSON.stringify([{ price: "price_caseload_7999", quantity: 1 }]), JSON.stringify(p2 && p2.line_items));
  delete process.env.STRIPE_PRICE_ID_SLP_CASELOAD;

  delete process.env.STRIPE_SECRET_KEY;
  r = await call(R.plan, "POST", "/api/slp/plan", { as: "buyer@riverside-schools.org" });
  ok("no Stripe key, no checkout — said plainly", r.status === 500 && /STRIPE_SECRET_KEY/.test(r.json.error));
  process.env.STRIPE_SECRET_KEY = "sk_test_caseload";

  // FREE_MODE is the FAMILY paywall switch; the clinician's plan must not
  // open or shut with it. It is a const, so this reads the source: the route
  // neither imports the pricing module nor names the switch in code.
  const src = read("app/api/slp/plan/route.ts");
  ok("the checkout deliberately does not read FREE_MODE (and says why)",
    !/FREE_MODE/.test(noComments(src)) && !/lib\/pricing/.test(src) && /DELIBERATELY NOT READING FREE_MODE/.test(src));
}

// ═════════════════════════ GET /api/slp/plan?session= — activation ═════════════════════════
{
  const me = "buyer@riverside-schools.org";
  const r0 = await call(R.plan, "GET", "/api/slp/plan");
  ok("the plan status needs a signed-in clinician (401)", r0.status === 401);

  let r = await call(R.plan, "GET", "/api/slp/plan", { as: me });
  ok("an unpaid clinician reads { active:false, source:\"none\" } with the price from lib/caseload",
    r.status === 200 && r.json.ok && r.json.active === false && r.json.source === "none" && r.json.periodEnd === null &&
    r.json.cancelAtPeriodEnd === false && r.json.price === "$79.99" && r.json.perMonth === "under $7 a month", JSON.stringify(r.json));
  ok("…and the own-phone block: a work email is eligible without asking",
    JSON.stringify(r.json.self) === JSON.stringify({ eligible: true, workEmail: true, approved: false, requested: false }), JSON.stringify(r.json.self));

  const end = nowS() + 365 * 86400;
  mkSub("sub_other", { slp: "someone@else.org", periodEnd: end });
  S.sessions.set("cs_test_otherclinician01", { id: "cs_test_otherclinician01", status: "complete", metadata: { plan: "slp-caseload", slp: "someone@else.org" }, subscription: "sub_other" });
  r = await call(R.plan, "GET", "/api/slp/plan?session=cs_test_otherclinician01", { as: me });
  ok("a session another clinician paid for stores NOTHING for this one", r.json.activated === false && r.json.active === false && !(storedPlan(me) || {}).sub, JSON.stringify(storedPlan(me)));

  mkSub("sub_open", { slp: me });
  S.subs.get("sub_open").metadata.slp = me;
  S.sessions.set("cs_test_notfinished0001", { id: "cs_test_notfinished0001", status: "open", metadata: { plan: "slp-caseload", slp: me }, subscription: "sub_open" });
  r = await call(R.plan, "GET", "/api/slp/plan?session=cs_test_notfinished0001", { as: me });
  ok("an unfinished checkout (status open) stores nothing", r.json.activated === false && !(storedPlan(me) || {}).sub);
  S.subs.delete("sub_open");

  mkSub("sub_family", { plan: null, tier: "charter" });
  S.sessions.set("cs_test_familypurchase1", { id: "cs_test_familypurchase1", status: "complete", metadata: { tier: "charter" }, subscription: "sub_family" });
  r = await call(R.plan, "GET", "/api/slp/plan?session=cs_test_familypurchase1", { as: me });
  ok("a family's purchase is not a caseload plan: nothing stored", r.json.activated === false && !(storedPlan(me) || {}).sub);

  S.calls.length = 0;
  r = await call(R.plan, "GET", "/api/slp/plan?session=not-a-session", { as: me });
  ok("a malformed id is refused without asking Stripe", r.json.activated === false && count((c) => c[0] === "checkout.sessions.retrieve") === 0);

  mkSub("sub_good", { slp: me, periodEnd: end, customer: "cus_buyer" });
  S.sessions.set("cs_test_goodcheckout001", { id: "cs_test_goodcheckout001", status: "complete", metadata: { plan: "slp-caseload", slp: me }, subscription: "sub_good" });
  r = await call(R.plan, "GET", "/api/slp/plan?session=cs_test_goodcheckout001", { as: me });
  const rec = storedPlan(me);
  ok("the clinician's own finished checkout activates the plan", r.json.activated === true && r.json.active === true && r.json.source === "paid", JSON.stringify(r.json));
  ok("…with the renewal date off the subscription ITEM (where Stripe now keeps it)", r.json.periodEnd === end && r.json.cancelAtPeriodEnd === false, JSON.stringify(r.json));
  ok("…mirrored under slpplan:<email> as { sub, customer, status, periodEnd, cancelAtPeriodEnd, checkedAt }",
    rec && Object.keys(rec).sort().join() === "cancelAtPeriodEnd,checkedAt,customer,periodEnd,status,sub" && rec.sub === "sub_good" && rec.customer === "cus_buyer" && rec.status === "active", JSON.stringify(rec));
  const acct = JSON.parse(KV.K.get("slpacct:" + me));
  ok("…and never on the account JSON (two routes rewrite that whole)", !("plan" in acct) && !("sub" in acct) && !("status" in acct), JSON.stringify(acct));
  ok("…nor written under any key starting slpacct: (lib/founder scans that prefix as the account list)",
    KV.log.filter((c) => c[0] === "SET" && c[1].startsWith("slpacct:")).every((c) => { try { return !("sub" in JSON.parse(c[2])) && !("periodEnd" in JSON.parse(c[2])); } catch { return false; } }));

  // 24 Sep 2026 — activation is RETRYABLE. A Stripe blip while reading the
  // session used to come back as a plain activated:false; the dashboard then
  // dropped the id, and "Check again" could only wait on the search index.
  const retrier = "retrier@riverside-schools.org";
  seedAcct(retrier, { code: "retry-k4", familyKey: "RETRYKY2" });
  mkSub("sub_retrier", { slp: retrier, customer: "cus_retrier" });
  S.sessions.set("cs_test_retrycheckout01", { id: "cs_test_retrycheckout01", status: "complete", metadata: { plan: "slp-caseload", slp: retrier }, subscription: "sub_retrier" });
  S.down = true;
  r = await call(R.plan, "GET", "/api/slp/plan?session=cs_test_retrycheckout01", { as: retrier });
  S.down = false;
  ok("a Stripe blip on activation answers activated:false WITH retry:true — and remembers no \"no plan\"",
    r.status === 200 && r.json.ok && r.json.activated === false && r.json.retry === true && !KV.K.has("slpplan:" + retrier), JSON.stringify(r.json));
  r = await call(R.plan, "GET", "/api/slp/plan?session=cs_test_retrycheckout01", { as: retrier });
  ok("…and the same session asked again activates the plan", r.json.activated === true && r.json.active === true && !("retry" in r.json), JSON.stringify(r.json));
  r = await call(R.plan, "GET", "/api/slp/plan?session=cs_test_otherclinician01", { as: retrier });
  ok("…while a REFUSAL (another clinician's session) never says retry", r.json.activated === false && !("retry" in r.json), JSON.stringify(r.json));
}

// ═════════════════════════ the mirror: ten minutes, and Stripe outages keep the answer ═════════════════════════
{
  const me = "buyer@riverside-schools.org";
  S.calls.length = 0;
  await call(R.plan, "GET", "/api/slp/plan", { as: me });
  ok("a fresh mirror (under ten minutes) costs no Stripe call", count((c) => c[0].startsWith("subscriptions.")) === 0, JSON.stringify(S.calls));

  const old = { ...storedPlan(me), checkedAt: Date.now() - 11 * 60 * 1000 };
  KV.K.set("slpplan:" + me, JSON.stringify(old));
  S.down = true;
  let r = await call(R.plan, "GET", "/api/slp/plan", { as: me });
  S.down = false;
  ok("a ten-minute-old mirror is re-checked — and when Stripe is DOWN the last status stands (still covered)",
    r.status === 200 && r.json.active === true && r.json.source === "paid", JSON.stringify(r.json));
  ok("…and the mirror is left exactly as it was", JSON.stringify(storedPlan(me)) === JSON.stringify(old));

  S.subs.get("sub_good").cancel_at_period_end = true;
  KV.K.set("slpplan:" + me, JSON.stringify({ ...old }));
  r = await call(R.plan, "GET", "/api/slp/plan", { as: me });
  ok("a clinician who cancels keeps covering families until the paid year ends", r.json.active === true && r.json.cancelAtPeriodEnd === true, JSON.stringify(r.json));

  S.subs.get("sub_good").status = "canceled";
  KV.K.set("slpplan:" + me, JSON.stringify({ ...old }));
  r = await call(R.plan, "GET", "/api/slp/plan", { as: me });
  ok("…and when Stripe says canceled, the caseload is no longer covered", r.json.active === false && r.json.source === "none" && storedPlan(me).status === "canceled", JSON.stringify(storedPlan(me)));
  S.subs.get("sub_good").status = "active"; S.subs.get("sub_good").cancel_at_period_end = false;
  r = await call(R.plan, "GET", "/api/slp/plan?session=cs_test_goodcheckout001", { as: me });
  ok("…and activating the same finished checkout again is harmless: covered once more", r.json.activated === true && r.json.active === true, JSON.stringify(r.json));

  // RECOVERY: paid, but the success redirect never came back
  const lost = "lost@riverside-schools.org";
  seedAcct(lost, { code: "lost-k4", familyKey: "LOSTKEY2" });
  mkSub("sub_lost", { slp: lost, customer: "cus_lost" });
  S.searchNoise = [JSON.parse(JSON.stringify({ ...S.subs.get("sub_other") }))];      // a search hit that is not theirs
  r = await call(R.plan, "GET", "/api/slp/plan", { as: lost });
  ok("a plan the dashboard never saw activate is recovered by searching Stripe for its stamps",
    r.json.active === true && r.json.source === "paid" && storedPlan(lost).sub === "sub_lost", JSON.stringify(r.json));
  const q = (S.calls.filter((c) => c[0] === "subscriptions.search").pop() || [])[1] || "";
  ok("…asking for exactly metadata slp + plan", q === "metadata['slp']:'lost@riverside-schools.org' AND metadata['plan']:'slp-caseload'", q);
  const nobody = "nobody@riverside-schools.org";
  seedAcct(nobody);
  r = await call(R.plan, "GET", "/api/slp/plan", { as: nobody });
  ok("…and a search hit stamped for ANOTHER clinician covers nobody", r.json.active === false, JSON.stringify(r.json));
  S.searchNoise = [];
}

// ═════════════════════════ POST /api/slp/plan/portal ═════════════════════════
{
  let r = await call(R.portal, "POST", "/api/slp/plan/portal", {});
  ok("the billing portal needs a signed-in clinician (401)", r.status === 401);
  S.calls.length = 0;
  r = await call(R.portal, "POST", "/api/slp/plan/portal", { as: "buyer@riverside-schools.org", body: { customer: "cus_someone_else" } });
  const made = (S.calls.find((c) => c[0] === "billingPortal.sessions.create") || [])[1];
  ok("a paying clinician gets their OWN billing portal — the customer from the mirror, never the body",
    r.status === 200 && r.json.ok && made && made.customer === "cus_buyer" && made.return_url === "https://sona.test.invalid/slp.html#premium", JSON.stringify(made));
  r = await call(R.portal, "POST", "/api/slp/plan/portal", { as: "nobody@riverside-schools.org" });
  ok("no plan, no portal: 404", r.status === 404 && r.json.ok === false);

  // 24 Sep 2026 — "if you cancel, your families keep Premium to the end of
  // the year you paid for" is written in the Terms, for-slps and the
  // dashboard. A portal opened on the account's DEFAULT settings made that a
  // dashboard toggle; the caseload portal now carries its own configuration.
  const cfgMade = S.calls.filter((c) => c[0] === "billingPortal.configurations.create");
  const cfg = cfgMade[0] && cfgMade[0][1];
  ok("the caseload portal is opened under its OWN configuration, created once",
    cfgMade.length === 1 && made && /^bpc_test_/.test(made.configuration || ""), JSON.stringify([cfgMade.length, made]));
  ok("…whose cancel button cancels AT PERIOD END — never immediately",
    cfg && JSON.stringify(cfg.features.subscription_cancel) === JSON.stringify({ enabled: true, mode: "at_period_end" }), JSON.stringify(cfg && cfg.features));
  ok("…with the card and the invoices on it too",
    cfg && cfg.features.payment_method_update.enabled === true && cfg.features.invoice_history.enabled === true, JSON.stringify(cfg && cfg.features));
  ok("…its id kept in the store under stripe:portalcfg:caseload (one field per Stripe mode)",
    (KV.H.get("stripe:portalcfg:caseload") || new Map()).get("test") === made.configuration, JSON.stringify([...(KV.H.get("stripe:portalcfg:caseload") || new Map())]));
  S.calls.length = 0;
  await call(R.portal, "POST", "/api/slp/plan/portal", { as: "buyer@riverside-schools.org" });
  const again = (S.calls.find((c) => c[0] === "billingPortal.sessions.create") || [])[1];
  ok("…and reused: a second press creates no second configuration",
    count((c) => c[0] === "billingPortal.configurations.create") === 0 && again && again.configuration === made.configuration, JSON.stringify(again));

  process.env.STRIPE_PORTAL_CONFIG_CASELOAD = "bpc_from_env_1";
  S.calls.length = 0;
  await call(R.portal, "POST", "/api/slp/plan/portal", { as: "buyer@riverside-schools.org" });
  const envd = (S.calls.find((c) => c[0] === "billingPortal.sessions.create") || [])[1];
  ok("STRIPE_PORTAL_CONFIG_CASELOAD, when set, is the configuration used", envd && envd.configuration === "bpc_from_env_1" && count((c) => c[0] === "billingPortal.configurations.create") === 0, JSON.stringify(envd));
  delete process.env.STRIPE_PORTAL_CONFIG_CASELOAD;

  // a configuration Stripe refuses (deleted in the dashboard): the portal still opens, and the stale id is forgotten
  S.badCfg.add(made.configuration);
  S.calls.length = 0; ERRS.length = 0;
  r = await call(R.portal, "POST", "/api/slp/plan/portal", { as: "buyer@riverside-schools.org" });
  const opens = S.calls.filter((c) => c[0] === "billingPortal.sessions.create").map((c) => c[1]);
  ok("a configuration Stripe refuses opens the default portal this once — never a dead Manage button — and says so in the log",
    r.status === 200 && r.json.ok && opens.length === 2 && !("configuration" in opens[1]) && ERRS.some((e) => /caseload billing-page configuration/.test(e)), JSON.stringify(opens));
  ok("…and the stale id is forgotten, so the next press makes a fresh one", !(KV.H.get("stripe:portalcfg:caseload") || new Map()).has("test"));
  S.calls.length = 0;
  await call(R.portal, "POST", "/api/slp/plan/portal", { as: "buyer@riverside-schools.org" });
  const fresh = (S.calls.find((c) => c[0] === "billingPortal.sessions.create") || [])[1];
  ok("…which it does", count((c) => c[0] === "billingPortal.configurations.create") === 1 && fresh && fresh.configuration && fresh.configuration !== made.configuration, JSON.stringify(fresh));

  // Stripe will not create one at all: fall back to the default, and log it
  KV.H.delete("stripe:portalcfg:caseload");
  S.cfgFail = true; S.calls.length = 0; ERRS.length = 0;
  r = await call(R.portal, "POST", "/api/slp/plan/portal", { as: "buyer@riverside-schools.org" });
  S.cfgFail = false;
  const dflt = (S.calls.find((c) => c[0] === "billingPortal.sessions.create") || [])[1];
  ok("if the configuration cannot be created, the account's default portal still opens — and the failure is logged",
    r.status === 200 && r.json.ok && dflt && !("configuration" in dflt) && ERRS.some((e) => /could not create the caseload billing-page configuration/.test(e)), JSON.stringify([r.json, dflt, ERRS]));
  ok("…and nothing is cached from a failure", !KV.H.has("stripe:portalcfg:caseload") || !(KV.H.get("stripe:portalcfg:caseload")).has("test"));
}

// ═════════════════════════ POST /api/portal — the FAMILY billing portal refuses a clinician's receipt ═════════════════════════
{
  // 24 Sep 2026: a clinician's checkout returns to slp.html?plan_session=cs_…,
  // so that id sits in their address bar and history. /api/portal turns a
  // session id into its customer's billing page with no sign-in — so a
  // caseload session is refused there; the clinician's own portal is behind
  // their dashboard session.
  S.sessions.get("cs_test_goodcheckout001").customer = "cus_buyer";       // a real customer: without the refusal it WOULD open
  S.calls.length = 0;
  let r = await call(R.famPortal, "POST", "/api/portal", { body: { session_id: "cs_test_goodcheckout001" } });
  ok("the family portal refuses a caseload checkout session (403) and opens nothing",
    r.status === 403 && r.json.ok === false && count((c) => c[0] === "billingPortal.sessions.create") === 0, JSON.stringify(r));
  S.sessions.get("cs_test_familypurchase1").customer = "cus_family1";
  r = await call(R.famPortal, "POST", "/api/portal", { body: { session_id: "cs_test_familypurchase1" } });
  const fam = (S.calls.find((c) => c[0] === "billingPortal.sessions.create") || [])[1];
  ok("…while a family's own session still opens the family portal", r.status === 200 && r.json.ok && fam && fam.customer === "cus_family1", JSON.stringify([r.json, fam]));
}

// ═════════════════════════ POST /api/slp/covered — the family device's question ═════════════════════════
{
  seedAcct("unpaid@riverside-schools.org", { code: "unpaid-k4", familyKey: "UNPAIDK2" });
  seedAcct("gmailslp@gmail.com", { code: "gmail-k4", familyKey: "GMAILKY2" });
  const tk = (code, o) => A.signTicket(code, 400, "kid1", o);

  let r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "gf-k4", ticket: "not.a-ticket" } });
  ok("a bad ticket is refused: 401 { ok:false }", r.status === 401 && r.json.ok === false);
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "gf-k4", ticket: tk("unpaid-k4") } });
  ok("…so is a real ticket for ANOTHER clinician's code", r.status === 401);
  // 24 Sep 2026: this pin read "…and an expired one" → 401. It was the
  // freeze: redeem is the only mint, the device reads a 401 as "change
  // nothing", so at day 400 coverage stuck in its last state for good. An
  // expired ticket whose signature and code are good now gets the truth and
  // a new ticket (below); what stays a 401 is a FORGED one.
  const expired = A.signTicket("gf-k4", -1, "kid1");
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "gf-k4", ticket: expired.split(".")[0] + ".forged-signature-xyz" } });
  ok("…and an expired ticket with a forged signature", r.status === 401 && !("ticket" in (r.json || {})));
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "gf-k4", ticket: A.signTicket("unpaid-k4", -1, "kid1") } });
  ok("…and an expired ticket for another clinician's code", r.status === 401 && !("ticket" in (r.json || {})));
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "gf-k4" } });
  ok("…and none at all: knowing a code is not enough to learn whether a clinician pays", r.status === 401);

  const before = KV.log.length;
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "GF-K4", ticket: tk("gf-k4") } });
  ok("a family of a GRANDFATHERED clinician is covered (the code in any case)", r.status === 200 && r.json.ok && r.json.covered === true, JSON.stringify(r));
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "buyer-k4", ticket: tk("buyer-k4") } });
  ok("a family of a PAYING clinician is covered", r.json.covered === true, JSON.stringify(r.json));
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "unpaid-k4", ticket: tk("unpaid-k4") } });
  ok("a family of a clinician who neither pays nor was grandfathered is not — an authoritative 200", r.status === 200 && r.json.covered === false);
  const writes = KV.log.slice(before).filter((c) => !/^rl:/.test(c[1] || "") && /^(SET|INCR|HSET|HSETNX|DEL|GETDEL|HDEL)$/.test(c[0]) && !/^slpplan:/.test(c[1]));
  ok("asking is not joining: no slpredeem INCR, no roster write, nothing but the mirror",
    !KV.log.slice(before).some((c) => /^slpredeem:/.test(c[1] || "")) && writes.length === 0, JSON.stringify(writes));

  ok("a ticket in the first half of its life is answered with no replacement", !("ticket" in r.json), JSON.stringify(r.json));

  // ── an EXPIRED (but genuinely signed) ticket: the truth, and a fresh ticket ──
  const DAY = 86400000;
  const fresh = (j, code, cid, self) => {
    const t = j && j.ticket ? A.readTicket(j.ticket, code) : null;          // STRICT read: the new one must be good on every route
    return !!t && t.cid === cid && (self ? t.self === 1 : !("self" in t)) && Math.abs(t.exp - (Date.now() + 400 * DAY)) < 60000;
  };
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "gf-k4", ticket: A.signTicket("gf-k4", -30, "kidG") } });
  ok("an EXPIRED ticket from a GRANDFATHERED clinician's family: covered — and a fresh 400-day ticket, same code and child",
    r.status === 200 && r.json.covered === true && fresh(r.json, "gf-k4", "kidG", false), JSON.stringify(r.json));
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "buyer-k4", ticket: A.signTicket("buyer-k4", -30, "kidP") } });
  ok("…from a PAYING clinician's family: covered, and a fresh ticket (a clinician who started paying late reaches them)",
    r.status === 200 && r.json.covered === true && fresh(r.json, "buyer-k4", "kidP", false), JSON.stringify(r.json));
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "unpaid-k4", ticket: A.signTicket("unpaid-k4", -30, "kidU") } });
  ok("…from an UNPAID clinician's family: an authoritative \"not covered\" (a cancelled plan stops), and a fresh ticket",
    r.status === 200 && r.json.ok === true && r.json.covered === false && fresh(r.json, "unpaid-k4", "kidU", false), JSON.stringify(r.json));
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "gf-k4", ticket: A.signTicket("gf-k4", 150, "kidH") } });
  ok("a ticket past HALF its life (fewer than 200 days left) is renewed on a 200, before it ever expires",
    r.status === 200 && fresh(r.json, "gf-k4", "kidH", false), JSON.stringify(r.json));
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "gf-k4", ticket: A.signTicket("gf-k4", 250, "kidY") } });
  ok("…one with more than 200 days left is not", r.status === 200 && !("ticket" in r.json), JSON.stringify(r.json));
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "unpaid-k4", ticket: A.signTicket("unpaid-k4", -5, "phoneS", { self: true }) } });
  ok("an expired OWN-PHONE ticket keeps its self flag in the new one — renewal never widens or narrows the proof",
    r.status === 200 && r.json.covered === true && fresh(r.json, "unpaid-k4", "phoneS", true), JSON.stringify(r.json));
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "gone-k4", ticket: A.signTicket("gone-k4", -5, "kidZ") } });
  ok("a code nobody owns: \"not covered\", and no new ticket (no clinician left to prove anything to)",
    r.status === 200 && r.json.covered === false && !("ticket" in r.json), JSON.stringify(r.json));
  KV.down = true;
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "gf-k4", ticket: A.signTicket("gf-k4", -5, "kidD") } });
  KV.down = false;
  ok("…and a 503 hands out no ticket", r.status === 503 && !("ticket" in r.json));
  ok("the route reads tickets with ignoreExpiry (the date only) and mints with signTicket(t.code, 400, cid, { self })",
    /readTicket\(String\(body\.ticket \|\| ""\), code, \{ ignoreExpiry: true \}\)/.test(read("app/api/slp/covered/route.ts")) &&
    /signTicket\(t\.code, TICKET_DAYS, t\.cid \|\| "", \{ self: t\.self === 1 \}\)/.test(read("app/api/slp/covered/route.ts")) &&
    /const TICKET_DAYS = 400;/.test(read("app/api/slp/covered/route.ts")));
  ok("…and every route that WRITES still refuses an expired ticket (strict readTicket)",
    A.readTicket(A.signTicket("gf-k4", -1, "kid1"), "gf-k4") === null && !!A.readTicket(A.signTicket("gf-k4", -1, "kid1"), "gf-k4", { ignoreExpiry: true }) &&
    A.readTicket(expired.split(".")[0] + ".forged", "gf-k4", { ignoreExpiry: true }) === null);

  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "unpaid-k4", ticket: tk("unpaid-k4", { self: true }) } });
  ok("the clinician's OWN phone (a self ticket) is covered with a work email even when the caseload is not", r.json.covered === true, JSON.stringify(r.json));
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "gmail-k4", ticket: tk("gmail-k4", { self: true }) } });
  ok("…but not on a free-mail address nobody approved", r.json.covered === false, JSON.stringify(r.json));

  KV.down = true;
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "gf-k4", ticket: tk("gf-k4") } });
  KV.down = false;
  ok("when the store cannot answer: 503, so the device keeps what it had — never \"your Premium ended\"", r.status === 503 && r.json.ok === false);
  const good = tk("gf-k4");
  const sec = process.env.SLP_AUTH_SECRET;
  delete process.env.SLP_AUTH_SECRET; process.env.VERCEL_ENV = "production";
  r = await call(R.covered, "POST", "/api/slp/covered", { body: { code: "gf-k4", ticket: good } });
  process.env.SLP_AUTH_SECRET = sec; delete process.env.VERCEL_ENV;
  ok("…and a deployment that can verify no ticket at all (production, no secret) says 503, not \"your proof is bad\"", r.status === 503, JSON.stringify(r));
  const src = noComments(read("app/api/slp/covered/route.ts"));
  ok("the route reads the ticket with readTicket(ticket, code), is rate limited and asks for no sharing consent",
    /readTicket\(/.test(src) && /rateLimit\(req, \{ key: "slpcovered"/.test(src) && !/consent|slpredeem|readSession/.test(src));
}

// ═════════════════════════ POST /api/slp/redeem — 60, or 300 when covered; the own-phone token ═════════════════════════
{
  const redeem = (body) => call(R.redeem, "POST", "/api/slp/redeem", { body });
  KV.K.set("slpredeem:unpaid-k4", "60");
  let r = await redeem({ code: "unpaid-k4", key: "UNPAIDK2", childId: "kid9" });
  ok("an UNCOVERED code stops at 60 families", r.status === 429, JSON.stringify(r));
  KV.K.set("slpredeem:gf-k4", "60");
  r = await redeem({ code: "gf-k4", key: "GFKEY234", childId: "kid9" });
  ok("a COVERED code (grandfathered) goes past 60", r.status === 200 && r.json.valid === true, JSON.stringify(r));
  KV.K.set("slpredeem:buyer-k4", "150");
  r = await redeem({ code: "buyer-k4", key: "BUYKEY23", childId: "kid9" });
  ok("…and so does a paid one", r.status === 200 && r.json.valid === true, JSON.stringify(r));
  KV.K.set("slpredeem:gf-k4", "300");
  r = await redeem({ code: "gf-k4", key: "GFKEY234", childId: "kid9" });
  ok("…until 300, where even a covered link stops", r.status === 429, JSON.stringify(r));

  // the own-phone token: single use, bound to its clinician, spent only on success
  KV.K.set("slpself:unpaid-k4:TOKENabc123", "unpaid@riverside-schools.org");
  KV.K.set("slpredeem:unpaid-k4", "0");
  r = await redeem({ code: "unpaid-k4", key: "WRONGKEY", childId: "kid9", me: "TOKENabc123" });
  ok("a wrong key does not spend the clinician's link", r.json.valid === false && KV.K.has("slpself:unpaid-k4:TOKENabc123"));
  r = await redeem({ code: "unpaid-k4", key: "UNPAIDK2", childId: "phone1", me: "TOKENabc123" });
  const t1 = A.readTicket(r.json.ticket, "unpaid-k4");
  ok("the right key plus the token mints a ticket marked self: 1", t1 && t1.self === 1 && t1.cid === "phone1", JSON.stringify(t1));
  ok("…and the token is gone (GETDEL: it works once)", !KV.K.has("slpself:unpaid-k4:TOKENabc123"));
  r = await redeem({ code: "unpaid-k4", key: "UNPAIDK2", childId: "phone2", me: "TOKENabc123" });
  const t2 = A.readTicket(r.json.ticket, "unpaid-k4");
  ok("…so a second phone on the same link is an ordinary family ticket", r.json.valid && t2 && !("self" in t2), JSON.stringify(t2));
  KV.K.set("slpself:unpaid-k4:TOKENfor0ther", "someone@else.org");
  r = await redeem({ code: "unpaid-k4", key: "UNPAIDK2", childId: "phone3", me: "TOKENfor0ther" });
  ok("a token stored for anyone but this code's owner mints nothing", !("self" in (A.readTicket(r.json.ticket, "unpaid-k4") || {})));
  r = await redeem({ code: "unpaid-k4", key: "UNPAIDK2", childId: "phone4" });
  ok("an ordinary redeem is exactly what it was: valid, unbound to self", r.json.valid && !("self" in A.readTicket(r.json.ticket, "unpaid-k4")));

  // 24 Sep 2026 — the cap counts the CLINICIAN, not only the code. A code
  // can be renamed at will (/api/slp/account claims the new one, the old
  // keeps redeeming, and both share the one family key), so a per-code cap
  // alone was N × 300 for anyone who renamed N times.
  const LIMIT = "This link has reached its limit — ask your speech therapist to contact Sona.";
  const ren = "renamer@clinic.org";
  seedAcct(ren, { terms: false, code: "ren-a1", familyKey: "RENKEY23" });           // grandfathered: the 300 cap
  r = await redeem({ code: "ren-a1", key: "RENKEY23", childId: "kidA" });
  ok("a redeem counts against the owner too: slpredeem-owner:<email>, the same 400-day window",
    r.json.valid === true && KV.K.get("slpredeem-owner:" + ren) === "1" && KV.TTL.get("slpredeem-owner:" + ren) === 400 * 86400, KV.K.get("slpredeem-owner:" + ren));
  r = await call(R.account, "POST", "/api/slp/account", { as: ren, body: { code: "ren-a2" } });
  ok("(the clinician claims a second code — the first keeps redeeming)", r.status === 200 && r.json.code === "ren-a2" && KV.K.get("slpcode:ren-a1") === ren);
  KV.K.set("slpredeem-owner:" + ren, "300");
  r = await redeem({ code: "ren-a2", key: "RENKEY23", childId: "kidB" });
  ok("a covered clinician at 300 families is stopped on a BRAND-NEW code — renaming does not reset the cap",
    r.status === 429 && r.json.error === LIMIT && KV.K.get("slpredeem:ren-a2") === "1", JSON.stringify(r));
  r = await redeem({ code: "ren-a1", key: "RENKEY23", childId: "kidC" });
  ok("…nor does the old code", r.status === 429 && r.json.error === LIMIT);
  seedAcct("renamer2@riverside-schools.org", { code: "rn-b1", familyKey: "RNBKEY23" });   // uncovered: the 60 cap
  KV.K.set("slpredeem-owner:renamer2@riverside-schools.org", "60");
  r = await redeem({ code: "rn-b1", key: "RNBKEY23", childId: "kidD" });
  ok("an uncovered clinician's families stop at 60 across every code they hold", r.status === 429 && r.json.error === LIMIT, JSON.stringify(r));
  KV.K.set("slpredeem:unpaid-k4", "60");
  r = await redeem({ code: "unpaid-k4", key: "UNPAIDK2", childId: "kidE" });
  ok("the per-code limit says the same words: ask your speech therapist to contact Sona (a fresh link from them hits the same wall)",
    r.status === 429 && r.json.error === LIMIT, JSON.stringify(r));
  ok("…and the old \"fresh link\" advice is gone from the route", !/fresh link/.test(noComments(read("app/api/slp/redeem/route.ts"))));
}

// ═════════════════════════ POST /api/slp/self — the clinician's own phone ═════════════════════════
{
  const gm = "gmailslp@gmail.com";
  let r = await call(R.self, "POST", "/api/slp/self", { body: { action: "send" } });
  ok("the own-phone link needs a signed-in clinician (401)", r.status === 401);
  RESEND.sent.length = 0;
  r = await call(R.self, "POST", "/api/slp/self", { as: gm, body: { action: "send" } });
  ok("a free-mail clinician is refused: 403 { needWorkEmail:true }", r.status === 403 && r.json.needWorkEmail === true && r.json.ok === false, JSON.stringify(r));
  ok("…and nothing is sent or minted", RESEND.sent.length === 0 && ![...KV.K.keys()].some((k) => k.startsWith("slpself:gmail-k4:")));

  const acctBefore = KV.K.get("slpacct:" + gm);
  r = await call(R.self, "POST", "/api/slp/self", { as: gm, body: { action: "request" } });
  ok("\"Request access\" is recorded: { ok, requested:true }", r.status === 200 && r.json.requested === true);
  ok("…on slpaccess:<email> with a requestedAt, and the account JSON is untouched",
    /^\d{4}-/.test((KV.H.get("slpaccess:" + gm) || new Map()).get("requestedAt") || "") && KV.K.get("slpacct:" + gm) === acctBefore);
  r = await call(R.plan, "GET", "/api/slp/plan", { as: gm });
  ok("the dashboard reads it back: not eligible, not a work email, not approved, requested",
    JSON.stringify(r.json.self) === JSON.stringify({ eligible: false, workEmail: false, approved: false, requested: true }), JSON.stringify(r.json.self));

  // the founder's approval
  r = await call(R.approve, "POST", "/api/founders/approve", { body: { email: gm } });
  ok("approval needs the founder key: none → 401", r.status === 401);
  r = await call(R.approve, "POST", "/api/founders/approve", { body: { email: gm }, headers: { "x-founder-key": "founder-key-for-tests-WRONG" } });
  ok("…a wrong one → 401", r.status === 401);
  const fk = process.env.FOUNDER_KEY; delete process.env.FOUNDER_KEY;
  r = await call(R.approve, "POST", "/api/founders/approve", { body: { email: gm }, headers: { "x-founder-key": fk } });
  ok("…no FOUNDER_KEY configured → 503, never open", r.status === 503);
  process.env.FOUNDER_KEY = fk;
  r = await call(R.approve, "POST", "/api/founders/approve", { body: { email: "typo@gmial.com" }, headers: { "x-founder-key": fk } });
  ok("…an address with no account → 404, so a typo approves nobody", r.status === 404);
  r = await call(R.approve, "POST", "/api/founders/approve", { body: { email: " GmailSLP@Gmail.com " }, headers: { "x-founder-key": fk } });
  ok("…the right key approves the account (email normalised)", r.status === 200 && r.json.ok && (KV.H.get("slpaccess:" + gm) || new Map()).get("approved") === "1", JSON.stringify(r.json));
  await call(R.self, "POST", "/api/slp/self", { as: gm, body: { action: "request" } });
  ok("…and a request landing afterwards cannot un-approve them (separate hash fields)", (KV.H.get("slpaccess:" + gm) || new Map()).get("approved") === "1");

  RESEND.sent.length = 0;
  r = await call(R.self, "POST", "/api/slp/self", { as: gm, body: { action: "send", email: "attacker@evil.test", to: "attacker@evil.test" } });
  const mail = RESEND.sent[0] || {};
  ok("once approved, the link is sent: { ok, sent:true }", r.status === 200 && r.json.ok && r.json.sent === true, JSON.stringify(r));
  ok("…to the ACCOUNT's own address and nowhere else, whatever the body says", RESEND.sent.length === 1 && JSON.stringify(mail.to) === JSON.stringify([gm]), JSON.stringify(mail.to));
  const m = /\/join\.html\?slp=GMAIL-K4&k=GMAILKY2&me=([A-Za-z0-9_-]+)/.exec(mail.text || "");
  ok("…carrying the family link plus an own-phone token", !!m && (mail.html || "").includes("&amp;me=" + (m && m[1])), mail.text);
  // 24 Sep 2026: this email said "It works once, on one phone". Each link
  // works once, but three a day may be sent and nothing retires an earlier
  // device — so "one phone" was a limit the server does not keep (how many
  // devices is Travis's open call). It now says what IS kept, in the words
  // the dashboard and the Terms use.
  ok("…and never promises \"one phone\": your own phone or tablet, each link works once",
    !/one phone/i.test(mail.subject + mail.html + mail.text) && /your own phone or tablet/.test(mail.text) && /Each link works once and expires in 30 days\./.test(mail.text) &&
    /Each link works once and expires in 30 days\./.test(mail.html || ""), mail.subject + " | " + mail.text);
  const tokKey = m ? "slpself:gmail-k4:" + m[1] : "";
  ok("…stored as slpself:<code>:<token> → the clinician, for 30 days", KV.K.get(tokKey) === gm && KV.TTL.get(tokKey) === 30 * 86400, tokKey);
  ok("…and the link is never returned to the page on production-shaped config (it proves the inbox)", !("devLink" in r.json) && !JSON.stringify(r.json).includes(m && m[1]));

  seedAcct("nocode@riverside-schools.org");
  r = await call(R.self, "POST", "/api/slp/self", { as: "nocode@riverside-schools.org", body: { action: "send" } });
  ok("a work-email clinician with no code yet is told to finish their profile: 409", r.status === 409);
  RESEND.sent.length = 0;
  for (let i = 0; i < 3; i++) await call(R.self, "POST", "/api/slp/self", { as: "unpaid@riverside-schools.org", body: { action: "send" } });
  r = await call(R.self, "POST", "/api/slp/self", { as: "unpaid@riverside-schools.org", body: { action: "send" } });
  ok("a work email needs no approval — and the link is metered: three a day, then 429", RESEND.sent.length === 3 && r.status === 429, RESEND.sent.length + " " + r.status);
}

// ═════════════════════════ POST /api/slp/invite — the parent's email, used once, kept nowhere ═════════════════════════
{
  const PARENT = "parent.one@example.com";
  const mine = (from) => KV.log.slice(from);
  const touched = (from, needle) => mine(from).some((c) => c.some((a) => String(a).toLowerCase().includes(needle.toLowerCase())));
  let from = KV.log.length, outFrom = OUT.length;
  RESEND.sent.length = 0;
  let r = await call(R.invite, "POST", "/api/slp/invite", { as: "unpaid@riverside-schools.org", body: { label: "Q.Z.", sounds: ["R"], parentEmail: PARENT } });
  const mail = RESEND.sent[0] || {};
  ok("an invite with a parent's email is created and emailed: { ok, invite, link, emailed:true }",
    r.status === 200 && r.json.ok && r.json.emailed === true && !("emailError" in r.json) && /\/join\.html\?slp=UNPAID-K4&k=UNPAIDK2&inv=/.test(r.json.link), JSON.stringify(r.json));
  ok("…ONE email, to that parent", RESEND.sent.length === 1 && JSON.stringify(mail.to) === JSON.stringify([PARENT]));
  ok("…subject \"<clinician> invited you to practice with Sona\"", mail.subject === "Sam Rivera invited you to practice with Sona", mail.subject);
  ok("…one button, and it is the join link", (mail.html.match(/<a /g) || []).length === 1 && mail.html.includes('href="' + r.json.link.replace(/&/g, "&amp;") + '"') && mail.text.includes(r.json.link));
  // One phrase for the free version everywhere (24 Sep 2026), the email too.
  ok("…says the clinician uses Sona for practice at home, and what the free version is: daily practice and free games",
    /Sam Rivera uses Sona for speech practice at home/.test(mail.text) && mail.text.includes("Sona's free version (daily practice and free games) is free for your family.") && mail.html.includes("daily practice and free games"));
  ok("…with no Premium line, because this caseload is not covered", !/Premium/.test(mail.text + mail.html));
  ok("…and the footer: one email, asked for by the clinician, address not kept",
    mail.text.includes("You're getting this one email because Sam Rivera asked Sona to send it. We didn't keep your address."));
  ok("…with NO child data at all — not even the invite's label", !/Q\.Z\./.test(mail.subject + mail.html + mail.text) && !/\b(age|sound|practice target)\b:/i.test(mail.text));
  ok("the address is NEVER written to the store (no command carries it)", !touched(from, PARENT), JSON.stringify(mine(from).filter((c) => c.some((a) => a.includes("parent")))));
  ok("…never reaches /api/lead or Kit — the only outbound call is the one send",
    OUT.slice(outFrom).every((o) => o.url === "https://api.resend.com/emails") && OUT.slice(outFrom).length === 1, JSON.stringify(OUT.slice(outFrom).map((o) => o.url)));
  const tok = r.json.invite.token;
  const data = JSON.parse(KV.K.get("inv:unpaid-k4:" + tok));
  const idx = JSON.parse(KV.H.get("inv:unpaid-k4").get(tok));
  ok("…and the invite keeps its exact shape: label, age, sounds, pos, repsPerDay, note, token, createdAt, expiresAt",
    Object.keys(data).sort().join() === "age,createdAt,expiresAt,label,note,pos,repsPerDay,sounds,token" && Object.keys(r.json.invite).sort().join() === Object.keys(data).sort().join(), Object.keys(data).join());
  ok("…its index row too: createdAt, expiresAt", Object.keys(idx).sort().join() === "createdAt,expiresAt");
  ok("…and the response never echoes the address", !JSON.stringify(r.json).includes(PARENT));

  // covered clinician: the Premium line
  RESEND.sent.length = 0;
  r = await call(R.invite, "POST", "/api/slp/invite", { as: "gf@clinic.org", body: { label: "B.", parentEmail: "parent.two@example.com" } });
  ok("when the caseload IS covered, the email says Premium is included, on the clinician",
    r.json.emailed === true && (RESEND.sent[0] || {}).text.includes("Premium is included, on Sam Rivera."), (RESEND.sent[0] || {}).text);

  // a refusal from the mail provider: reported, invite kept, address not logged
  RESEND.status = 422; RESEND.body = JSON.stringify({ message: "Invalid `to`: parent.three@example.com" });
  ERRS.length = 0; from = KV.log.length;
  r = await call(R.invite, "POST", "/api/slp/invite", { as: "unpaid@riverside-schools.org", body: { label: "C.", parentEmail: "parent.three@example.com" } });
  RESEND.status = 200; RESEND.body = "{}";
  ok("a failed send is reported (emailed:false + emailError) and the invite still stands",
    r.status === 200 && r.json.ok && r.json.emailed === false && typeof r.json.emailError === "string" && r.json.emailError.length > 0 && !!r.json.invite, JSON.stringify(r.json));
  ok("…and the address never reaches the log, even when the provider's refusal quotes it",
    ERRS.length > 0 && !ERRS.some((e) => e.includes("parent.three")) && !touched(from, "parent.three"), JSON.stringify(ERRS));

  // bad address: nothing half-made
  const pending = KV.H.get("inv:unpaid-k4").size;
  r = await call(R.invite, "POST", "/api/slp/invite", { as: "unpaid@riverside-schools.org", body: { label: "D.", parentEmail: "not-an-email" } });
  ok("a malformed address is a 400 BEFORE the invite exists", r.status === 400 && KV.H.get("inv:unpaid-k4").size === pending);
  r = await call(R.invite, "POST", "/api/slp/invite", { as: "unpaid@riverside-schools.org", body: { label: "E.", parentEmail: "a@" + "x".repeat(250) + ".com" } });
  ok("…so is one longer than an address can be (254)", r.status === 400);
  RESEND.sent.length = 0;
  r = await call(R.invite, "POST", "/api/slp/invite", { as: "unpaid@riverside-schools.org", body: { label: "F.", parentEmail: "" } });
  ok("no address, no email: emailed:false and no error", r.status === 200 && r.json.emailed === false && !("emailError" in r.json) && RESEND.sent.length === 0);

  // the daily limit, counted per CLINICIAN
  const day = new Date().toISOString().slice(0, 10);
  const meter = "slpinvmail:unpaid@riverside-schools.org:" + day;
  ok("the meter is keyed on the clinician and the day — never the parent", KV.K.has(meter) && ![...KV.K.keys()].some((k) => /parent\./.test(k)), [...KV.K.keys()].filter((k) => k.startsWith("slpinvmail")).join());
  KV.K.set(meter, "30");
  RESEND.sent.length = 0;
  r = await call(R.invite, "POST", "/api/slp/invite", { as: "unpaid@riverside-schools.org", body: { label: "G.", parentEmail: "parent.four@example.com" } });
  ok("the 31st parent email in a day is not sent — the invite is, and the clinician is told why",
    r.status === 200 && r.json.emailed === false && /daily limit/.test(r.json.emailError || "") && RESEND.sent.length === 0 && !!r.json.invite, JSON.stringify(r.json));

  const src = noComments(read("app/api/slp/invite/route.ts"));
  ok("the invite route never calls the lead door, Kit or a logger with the address",
    !/\/api\/lead|kitSubscribe|lib\/kit/.test(src) && !/console\.(log|error|warn)\([^)]*parentEmail/.test(src));
  const auth = read("lib/slpAuth.ts");
  ok("the parent sender logs no body from the provider (logBody false) — the sign-in email keeps its own",
    /"parent invite", false\)/.test(auth) && /Resend refused the sign-in email/.test(auth));
}

// ═════════════════════════ restore-by-email and the charter count ignore the clinician's plan ═════════════════════════
{
  S.customers = [{ id: "cus_restore", email: "clinician@riverside-schools.org" }];
  mkSub("sub_restore_caseload", { customer: "cus_restore", slp: "clinician@riverside-schools.org" });
  let r = await call(R.subscription, "GET", "/api/subscription?email=clinician@riverside-schools.org");
  ok("restore-by-email does NOT unlock a device on a clinician's caseload plan", r.status === 200 && r.json.active === false, JSON.stringify(r.json));
  mkSub("sub_restore_family", { customer: "cus_restore", plan: null, tier: "charter" });
  r = await call(R.subscription, "GET", "/api/subscription?email=clinician@riverside-schools.org");
  ok("…while a family subscription on the same address still restores", r.json.active === true, JSON.stringify(r.json));
  S.subs.delete("sub_restore_family");

  CH._resetCharterMemo();
  const spots = await CH.charterSpots({ subscriptions: { search: async () => ({ data: [S.subs.get("sub_good"), S.subs.get("sub_lost")], has_more: false }) } });
  ok("a caseload subscription (no tier) is never counted as a charter spot", spots.taken === 0 && spots.source === "stripe", JSON.stringify(spots));
  CH._resetCharterMemo();
}

// ═════════════════════════ new accounts carry terms; old ones never gain it ═════════════════════════
{
  const fresh = "brand.new@riverside-schools.org";
  RESEND.sent.length = 0;
  let r = await call(R.request, "POST", "/api/slp/auth/request", { body: { email: fresh, name: "Robin" } });
  let a = JSON.parse(KV.K.get("slpacct:" + fresh) || "{}");
  ok("a NEW account from the sign-up route carries terms: \"caseload-2026-09\"", r.json.signedIn === true && a.terms === "caseload-2026-09", JSON.stringify(a));
  // 24 Sep 2026: the sign-in email said "it's free for you and for every
  // family on your caseload" — the very promise the grandfathered clinicians
  // hold, sent in writing to every NEW clinician, whose families get the
  // free version. It now says what is true for every clinician.
  const welcome = RESEND.sent.find((m) => m.subject === "Your Sona dashboard is ready") || {};
  const OLD_PROMISE = /free for you and for every family on your caseload/i;
  ok("the sign-in email says the dashboard is free and every family gets Sona's free version (HTML and text)",
    (welcome.html || "").includes("Your Sona dashboard is ready — it's free, and every family you send home gets Sona's free version.") &&
    (welcome.text || "").includes("Your Sona dashboard is ready - it's free, and every family you send home gets Sona's free version."), JSON.stringify(welcome.text));
  ok("…and the old \"free for you and for every family on your caseload\" never returns — not in the email, not in any server code",
    !OLD_PROMISE.test((welcome.html || "") + (welcome.text || "")) &&
    ["lib/slpAuth.ts", "app/api/slp/auth/request/route.ts", "app/api/slp/auth/verify/route.ts", "app/api/slp/self/route.ts", "app/api/slp/invite/route.ts"].every((f) => !OLD_PROMISE.test(noComments(read(f)))));
  ok("…nor does the own-phone email's \"one phone\", in the route or its sender",
    !/one phone/i.test(noComments(read("app/api/slp/self/route.ts"))) &&
    !/one phone/i.test(noComments(read("lib/slpAuth.ts").slice(read("lib/slpAuth.ts").indexOf("export async function sendSelfLinkEmail")))));
  ok("…still after the CRM stamp rewrites it", !!a.crmAt && a.terms === "caseload-2026-09");

  seedAcct("veteran@clinic.org", { terms: false, code: "vet-k4", familyKey: "VETKEY23" });
  r = await call(R.request, "POST", "/api/slp/auth/request", { body: { email: "veteran@clinic.org" } });
  a = JSON.parse(KV.K.get("slpacct:veteran@clinic.org"));
  ok("an EXISTING account signing in again never gains terms — it stays grandfathered", !("terms" in a) && a.code === "vet-k4" && C.grandfathered(a), JSON.stringify(a));

  const setsBefore = KV.log.filter((c) => c[0] === "SET" && c[1] === "slpacct:outage@clinic.org").length;
  seedAcct("outage@clinic.org", { terms: false, code: "out-k4", familyKey: "OUTKEY23" });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url) === KV_URL && JSON.parse(init.body)[0] === "GET" && JSON.parse(init.body)[1] === "slpacct:outage@clinic.org") { KV.log.push(["GET(down)"]); return new Response("{}", { status: 503 }); }
    return realFetch(url, init);
  };
  r = await call(R.request, "POST", "/api/slp/auth/request", { body: { email: "outage@clinic.org" } });
  globalThis.fetch = realFetch;
  a = JSON.parse(KV.K.get("slpacct:outage@clinic.org"));
  ok("a store blip on sign-in never rewrites an existing account as new (it would erase the grandfathering)",
    r.json.signedIn === false && !("terms" in a) && a.code === "out-k4" &&
    KV.log.filter((c) => c[0] === "SET" && c[1] === "slpacct:outage@clinic.org").length === setsBefore, JSON.stringify(a));

  const tok = "verify-token-123";
  KV.K.set("slptok:" + A.hashToken(tok), "via.link@riverside-schools.org");
  r = await call(R.verify, "GET", "/api/slp/auth/verify?token=" + tok);
  a = JSON.parse(KV.K.get("slpacct:via.link@riverside-schools.org") || "{}");
  ok("a NEW account from the magic link carries terms too", /\/slp\.html$/.test(r.location || "") && a.terms === "caseload-2026-09", JSON.stringify(a));
  KV.K.set("slptok:" + A.hashToken(tok + "2"), "veteran@clinic.org");
  await call(R.verify, "GET", "/api/slp/auth/verify?token=" + tok + "2");
  ok("…and an existing one verified again does not", !("terms" in JSON.parse(KV.K.get("slpacct:veteran@clinic.org"))));

  r = await call(R.account, "POST", "/api/slp/account", { as: "veteran@clinic.org", body: { name: "Vera" } });
  a = JSON.parse(KV.K.get("slpacct:veteran@clinic.org"));
  ok("a profile save rewrites the account whole — and a grandfathered one stays without terms", r.status === 200 && a.name === "Vera" && !("terms" in a) && a.code === "vet-k4", JSON.stringify(a));
  // 24 Sep 2026: the dashboard replaces its account with this answer after
  // every save, key rotation and first-time setup, and the own-phone card
  // names the inbox its link goes to — so the answer carries the email, as
  // GET and /api/slp/auth/me already did.
  ok("…and its answer carries the signed-in email (the dashboard shows it)", r.json.email === "veteran@clinic.org", JSON.stringify(r.json));
  r = await call(R.account, "POST", "/api/slp/account", { as: "veteran@clinic.org", body: { rotateKey: true } });
  ok("…after a key rotation too", r.status === 200 && r.json.email === "veteran@clinic.org" && r.json.familyKey && r.json.familyKey !== "VETKEY23", JSON.stringify(r.json));
  r = await call(R.account, "POST", "/api/slp/account", { as: "ghost@riverside-schools.org", body: { name: "Gus" } });
  a = JSON.parse(KV.K.get("slpacct:ghost@riverside-schools.org") || "{}");
  ok("an account the profile route has to CREATE carries terms", r.status === 200 && a.terms === "caseload-2026-09", JSON.stringify(a));
  const n0 = KV.log.filter((c) => c[0] === "SET" && c[1] === "slpacct:veteran@clinic.org").length;
  KV.down = true;
  r = await call(R.account, "POST", "/api/slp/account", { as: "veteran@clinic.org", body: { name: "Blip" } });
  KV.down = false;
  ok("…and when the store cannot be read, the profile route refuses (503) rather than writing a blank account",
    r.status === 503 && KV.log.filter((c) => c[0] === "SET" && c[1] === "slpacct:veteran@clinic.org").length === n0);

  // every place an slpacct is SET from a fresh object stamps terms
  for (const f of ["app/api/slp/auth/request/route.ts", "app/api/slp/auth/verify/route.ts", "app/api/slp/account/route.ts"]) {
    ok(`${f} stamps CASELOAD_TERMS from lib/caseload`, /import \{ CASELOAD_TERMS \} from "@\/lib\/caseload"/.test(read(f)) && /terms: CASELOAD_TERMS|\.terms = CASELOAD_TERMS/.test(read(f)));
  }
}

// ═════════════════════════ the family success page refuses a clinician's receipt ═════════════════════════
{
  let r = await call(R.session, "GET", "/api/checkout/session?id=cs_test_goodcheckout001");
  ok("the session read-back names the plan: \"slp-caseload\" for a clinician's", r.status === 200 && r.json.plan === "slp-caseload", JSON.stringify(r.json));
  r = await call(R.session, "GET", "/api/checkout/session?id=cs_test_familypurchase1");
  ok("…and null for a family's", r.json.plan === null, JSON.stringify(r.json));
  const page = read("app/subscribe/success/page.tsx");
  const lit = (/const CASELOAD_PLAN_ID = "([^"]+)"/.exec(page) || [])[1];
  ok("the success page's copy of the plan id matches lib/caseload (it cannot import a server module)", lit === C.CASELOAD_PLAN, lit);
  const branch = page.indexOf("if (j.plan === CASELOAD_PLAN_ID)");
  ok("…and it refuses BEFORE anything is granted: no sona.sub.v1, no hand-off code, no purchase event",
    branch > 0 && branch < page.indexOf("localStorage.setItem(") && branch < page.indexOf("/api/pair") && branch < page.indexOf("purchase completed") &&
    /if \(j\.plan === CASELOAD_PLAN_ID\) \{\s*setCaseload\(true\);\s*return;\s*\}/.test(page), String(branch));
}

// ═════════════════════════ the founder's view ═════════════════════════
{
  const list = await F.readClinicians();
  const by = Object.fromEntries(list.map((c) => [c.email, c]));
  ok("readClinicians says who has a work email", by["gmailslp@gmail.com"].workEmail === "no" && by["unpaid@riverside-schools.org"].workEmail === "yes");
  ok("…who asked for access, and whether it was approved",
    /^\d{4}-/.test(by["gmailslp@gmail.com"].accessRequested) && by["gmailslp@gmail.com"].approved === "yes" && by["unpaid@riverside-schools.org"].accessRequested === "" && by["unpaid@riverside-schools.org"].approved === "no");
  ok("…and how the caseload is covered: paid, grandfathered or none",
    by["gf@clinic.org"].caseload === "grandfathered" && by["buyer@riverside-schools.org"].caseload === "paid" && by["unpaid@riverside-schools.org"].caseload === "none", JSON.stringify([by["gf@clinic.org"], by["buyer@riverside-schools.org"]].map((c) => c.caseload)));
  ok("…and never lists a plan mirror or an access record as if it were an account",
    !list.some((c) => /^slp(plan|access|self):/.test(c.email)) && list.every((c) => c.email.includes("@")));

  const page = read("public/leads.html");
  const code = noComments(page);
  ok("/leads.html shows Work email, Access requested, Own Premium and Caseload columns",
    /\["workEmail", "Work email"\]/.test(code) && /\["accessRequested", "Access requested"\]/.test(code) && /\["approve", "Own Premium"\]/.test(code) && /\["caseload", "Caseload"\]/.test(code));
  ok("…with an Approve button that calls /api/founders/approve with the founder key in a header",
    /data-approve=/.test(code) && /fetch\("\/api\/founders\/approve"/.test(code) && /"x-founder-key": \(\$\("key"\)\.value/.test(code));
  ok("…offered only to someone without a work email who is not yet approved",
    /if \(r\.workEmail === "yes"\) return/.test(code) && /if \(r\.approved === "yes"\) return/.test(code));
  ok("…and the page is still noindex and tracker-free", /name="robots" content="noindex/.test(page) && !/pixel\.js|analytics\.js|fbevents|posthog/.test(page));
}

// ═════════════════════════ /leads.html in a browser: the Approve button ═════════════════════════
{
  let browser = null;
  try {
    const { chromium, launchOpts } = await import("./_env.mjs");
    browser = await chromium.launch(launchOpts());
    const page = await browser.newPage();
    const approvals = [];
    let loads = 0;
    const row = (o) => ({ name: "", clinic: "", createdAt: iso(), source: "", inCrm: "yes", accessRequested: "", approved: "no", ...o });
    await page.route("**/*", async (route) => {
      const u = new URL(route.request().url());
      const json = (o) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
      if (u.pathname === "/leads.html") return route.fulfill({ status: 200, contentType: "text/html", body: read("public/leads.html") });
      if (u.pathname === "/api/founders/leads") {
        loads++;
        return json({ ok: true, leads: [], clinicians: [
          row({ email: "asked@gmail.com", workEmail: "no", accessRequested: iso(), approved: loads > 1 ? "yes" : "no", caseload: "none" }),
          row({ email: "school@district.k12.ca.us", workEmail: "yes", caseload: "paid" }),
          row({ email: "early@clinic.org", workEmail: "yes", caseload: "grandfathered" }),
        ] });
      }
      if (u.pathname === "/api/founders/approve") {
        approvals.push({ key: route.request().headers()["x-founder-key"], body: route.request().postDataJSON() });
        return json({ ok: true, email: "asked@gmail.com", approved: true });
      }
      return route.fulfill({ status: 404, body: "" });
    });
    await page.goto("http://leads.test.invalid/leads.html");
    await page.fill("#key", "founder-key-for-tests");
    await page.click("#go");
    await page.waitForSelector("#tSlp button[data-approve]", { timeout: 5000 });
    const heads = await page.$$eval("#tSlp th", (ths) => ths.map((t) => t.textContent));
    const buttons = await page.$$eval("#tSlp button[data-approve]", (bs) => bs.map((b) => b.getAttribute("data-approve")));
    const cells = await page.$$eval("#tSlp tr", (trs) => trs.map((tr) => tr.textContent));
    ok("the clinicians table in the browser has Work email, Access requested, Own Premium and Caseload",
      ["Work email", "Access requested", "Own Premium", "Caseload"].every((h) => heads.includes(h)), heads.join("|"));
    ok("…an Approve button only for the free-mail clinician who is not yet approved", JSON.stringify(buttons) === JSON.stringify(["asked@gmail.com"]), JSON.stringify(buttons));
    ok("…and the caseload column reads paid / grandfathered / none", cells.some((c) => /paid/.test(c)) && cells.some((c) => /grandfathered/.test(c)) && cells.some((c) => /none/.test(c)));
    await page.click("#tSlp button[data-approve]");
    await page.waitForFunction(() => document.getElementById("approveMsg").textContent.indexOf("Approved") === 0, null, { timeout: 5000 });
    await page.waitForFunction(() => !document.querySelector("#tSlp button[data-approve]"), null, { timeout: 5000 });
    ok("pressing Approve posts { email } to /api/founders/approve with the founder key in the header",
      approvals.length === 1 && approvals[0].key === "founder-key-for-tests" && JSON.stringify(approvals[0].body) === JSON.stringify({ email: "asked@gmail.com" }), JSON.stringify(approvals));
    ok("…then reloads from the server, and the row reads approved", loads === 2 && (await page.$$eval("#tSlp td.ok", (tds) => tds.map((t) => t.textContent))).includes("approved"));
  } catch (e) {
    ok("the founder page runs in a browser", false, e && e.message);
  } finally {
    if (browser) await browser.close();
  }
}

// ═════════════════════════ source contracts ═════════════════════════
{
  const lib = noComments(read("lib/caseload.ts"));
  ok("the plan mirror lives under slpplan:, access under slpaccess:, own-phone tokens under slpself:",
    /"slpplan:" \+/.test(lib) && /"slpaccess:" \+/.test(lib) && /"slpself:" \+/.test(lib));
  ok("no caseload key is ever written under the slpacct: prefix", !/"SET", "slpacct:/.test(lib) && !/"slpacct:" \+ [^;]*"SET"/.test(lib));
  const plan = noComments(read("app/api/slp/plan/route.ts"));
  ok("the checkout never writes a tier and never offers a trial", !/\btier\b/.test(plan) && !/trial/i.test(plan));
  ok("the plan routes take the email from the SESSION, never the body or the query",
    [plan, noComments(read("app/api/slp/plan/portal/route.ts")), noComments(read("app/api/slp/self/route.ts"))].every((s) => /readSession\(req\)/.test(s) && !/body\.email|searchParams\.get\("email"\)/.test(s)));
  const restore = read("app/api/subscription/route.ts");
  ok("restore filters the caseload plan by its METADATA", /s\.metadata\?\.plan !== CASELOAD_PLAN/.test(restore));
  const redeem = noComments(read("app/api/slp/redeem/route.ts"));
  ok("redeem picks its cap from covered(owner): COVERED_REDEEM_CAP or REDEEM_CAP (60)",
    /const cap = isCovered \? COVERED_REDEEM_CAP : REDEEM_CAP;/.test(redeem) && /const REDEEM_CAP = 60;/.test(redeem) && /n > cap/.test(redeem));
  ok("…and spends the own-phone token with GETDEL only after the cap", redeem.indexOf('"GETDEL"') > redeem.indexOf("n > cap"));
  const register = (s) => !/\b(accuracy|score|adherence|therapy|treatment|diagnos\w*)\b/i.test(s);
  ok("no evaluation register in the new routes or the parent/own-phone emails",
    ["app/api/slp/plan/route.ts", "app/api/slp/plan/portal/route.ts", "app/api/slp/covered/route.ts", "app/api/slp/self/route.ts", "lib/caseload.ts"].every((f) => register(noComments(read(f)))) &&
    register(read("lib/slpAuth.ts").slice(read("lib/slpAuth.ts").indexOf("export async function sendParentInviteEmail"))));
  ok("copy says every family, never \"unlimited\"", !/unlimited/i.test(noComments(read("lib/slpAuth.ts")) + plan));
  ok("the suite is registered in run-all, beside the SLP API suite", /"caseloadtest\.mjs",/.test(read("tests/run-all.mjs")));
}

console.error = realErr;
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
