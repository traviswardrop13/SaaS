// SLPAPP1: the clinicians' own iPhone app, "Sona for SLPs" (Travis, 16 Nov
// 2026: "start building the SLP dashboard mobile app"; asked, he chose its own
// App Store app, and never selling in it). Pinned here:
//   1. SIGN-IN BY CODE. The sign-in email carries six digits; typed on the
//      sign-in screen they prove the inbox exactly as the link does, once,
//      five wrong tries at most, only a hash kept. App Review's door opens
//      only while both of its variables are set.
//   2. THE APP SHOWS THE DASHBOARD AND SELLS NOTHING. "SonaSLPApp/<n>" in the
//      user agent: the dashboard and its sign-in render (the family app is
//      still sent home), every other page goes to the dashboard, and no
//      price, offer, checkout or billing door is drawn.
//   3. DELETE MY ACCOUNT (Apple's rule; the web has it too). Everything about
//      the account goes, the code is kept closed so no family's sync is ever
//      written again, sessions end, and a plan that still renews blocks it.
//   4. BLOCK in the community (Apple's rule for posts people write): the
//      route still blocks; since SLPCLEAN1 (17 Nov 2026) the dashboard shows
//      no community at all, so the app carries no one else's posts.
//
// Part 1 runs the real routes (TypeScript, transpiled with the repo's own
// `typescript`, as familylogintest does) against a fake store behind the same
// fetch kvCmd makes. Part 2 drives the real pages against a mock API.
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { runInNewContext } from "node:vm";
import crypto from "node:crypto";
import path from "node:path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

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

// ═════════════════════════ part 1: the routes, for real ═════════════════════════
for (const k of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "SLP_AUTH_SECRET", "VERCEL_ENV", "STRIPE_SECRET_KEY", "RESEND_API_KEY", "SLP_REVIEW_EMAIL", "SLP_REVIEW_CODE", "SLP_COMMUNITY_MODERATOR_EMAILS"]) delete process.env[k];
const KV_URL = "https://kv.slpapp.test.invalid";
process.env.KV_REST_API_URL = KV_URL;
process.env.KV_REST_API_TOKEN = "kv-test-token";
process.env.SLP_AUTH_SECRET = "slpapp-test-secret";
process.env.STRIPE_SECRET_KEY = "sk_test_slpapp";

const KV = { K: new Map(), H: new Map(), S: new Map(), Z: new Map(), L: new Map(), TTL: new Map(), log: [] };
const hash = (k) => { if (!KV.H.has(k)) KV.H.set(k, new Map()); return KV.H.get(k); };
const set = (k) => { if (!KV.S.has(k)) KV.S.set(k, new Set()); return KV.S.get(k); };
const zset = (k) => { if (!KV.Z.has(k)) KV.Z.set(k, new Map()); return KV.Z.get(k); };
const globRe = (g) => new RegExp("^" + g.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
const allKeys = () => [...new Set([...KV.K.keys(), ...KV.H.keys(), ...KV.S.keys(), ...KV.Z.keys(), ...KV.L.keys()])];
function del(k) { let n = 0; for (const m of [KV.K, KV.H, KV.S, KV.Z, KV.L]) if (m.delete(k)) n = 1; KV.TTL.delete(k); return n; }
// The community's one Lua step on account deletion, in JS (lib/slpDelete).
function scrubCommunity(keys, id) {
  const posts = hash(keys[0]); let gone = 0;
  for (const [pid, raw] of [...posts]) {
    let p; try { p = JSON.parse(raw); } catch { continue; }
    if (p.authorId === id) { posts.delete(pid); zset(keys[1]).delete(pid); if (p.category) zset(keys[2] + p.category).delete(pid); gone++; }
    else if (Array.isArray(p.replies)) { const kept = p.replies.filter((r) => r.authorId !== id); if (kept.length !== p.replies.length) { gone += p.replies.length - kept.length; p.replies = kept; posts.set(pid, JSON.stringify(p)); } }
  }
  KV.L.set(keys[3], (KV.L.get(keys[3]) || []).filter((raw) => { try { return JSON.parse(raw).authorId !== id; } catch { return true; } }));
  del(keys[4]); del(keys[5]);
  return gone;
}
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
    case "DEL": { let n = 0; for (const k of c.slice(1)) n += del(k); return n; }
    case "MGET": return c.slice(1).map((k) => (KV.K.has(k) ? KV.K.get(k) : null));
    case "HSET": { let added = 0; for (let i = 2; i + 1 < c.length; i += 2) { if (!hash(key).has(c[i])) added++; hash(key).set(c[i], c[i + 1]); } return added; }
    case "HSETNX": { if (hash(key).has(c[2])) return 0; hash(key).set(c[2], c[3]); return 1; }
    case "HGET": return KV.H.has(key) && KV.H.get(key).has(c[2]) ? KV.H.get(key).get(c[2]) : null;
    case "HGETALL": return KV.H.has(key) ? [...KV.H.get(key)].flat() : [];
    case "HKEYS": return KV.H.has(key) ? [...KV.H.get(key).keys()] : [];
    case "HDEL": { let n = 0; for (const f of c.slice(2)) if (KV.H.has(key) && KV.H.get(key).delete(f)) n++; return n; }
    case "HEXISTS": return KV.H.has(key) && KV.H.get(key).has(c[2]) ? 1 : 0;
    case "HLEN": return KV.H.has(key) ? KV.H.get(key).size : 0;
    case "SADD": { let n = 0; for (const m of c.slice(2)) if (!set(key).has(m)) { set(key).add(m); n++; } return n; }
    case "SREM": { let n = 0; for (const m of c.slice(2)) if (KV.S.has(key) && KV.S.get(key).delete(m)) n++; return n; }
    case "SISMEMBER": return KV.S.has(key) && KV.S.get(key).has(c[2]) ? 1 : 0;
    case "SMEMBERS": return KV.S.has(key) ? [...KV.S.get(key)] : [];
    case "ZADD": zset(key).set(c[3], Number(c[2])); return 1;
    case "ZREM": return KV.Z.has(key) && KV.Z.get(key).delete(c[2]) ? 1 : 0;
    case "LRANGE": return KV.L.get(key) || [];
    case "LPUSH": { const l = KV.L.get(key) || []; l.unshift(...c.slice(2)); KV.L.set(key, l); return l.length; }
    case "SCAN": { const re = globRe(c[c.indexOf("MATCH") + 1] || "*"); return ["0", allKeys().filter((k) => re.test(k))]; }
    case "EVAL": {
      const script = c[1], n = Number(c[2]), keys = c.slice(3, 3 + n), argv = c.slice(3 + n);
      if (script.startsWith("-- slpacct:update\n")) return KV.K.get(keys[0]) === argv[0] ? kvExec(["SET", keys[0], argv[1]]) : null;
      if (/^-- rl:incr\n/.test(script) || /local n = redis.call\('INCR', KEYS\[1\]\)/.test(script)) {
        const k = keys[0], v = Number(KV.K.get(k) || 0) + 1; KV.K.set(k, String(v)); if (!KV.TTL.has(k)) KV.TTL.set(k, Number(argv[0] || 60)); return v;
      }
      if (script.startsWith("-- slpdelete:community")) return scrubCommunity(keys, argv[0]);
      if (/ZREVRANGEBYSCORE/.test(script)) {
        const z = [...(KV.Z.get(keys[0]) || new Map())].sort((a, b) => b[1] - a[1]).slice(0, Number(argv[1]));
        const rows = []; for (const [id, score] of z) { const p = KV.H.get(keys[1])?.get(id); if (p) rows.push(p, String(score)); } return rows;
      }
      if (/':seeded'/.test(script)) { if (!hash(keys[0]).has(argv[0] + ":seeded")) { hash(keys[0]).set(argv[0] + ":seeded", "1"); if (!hash(keys[0]).has(argv[0])) hash(keys[0]).set(argv[0], argv[1]); } return hash(keys[0]).get(argv[0]) || null; }
      throw new Error("fake kv does not speak this script: " + script.slice(0, 40));
    }
    default: throw new Error("fake kv does not speak " + op);
  }
}
const realFetch = globalThis.fetch;
const RESEND = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u === KV_URL) {
    const cmd = JSON.parse(init.body);
    KV.log.push(cmd.map(String));
    return Response.json({ result: kvExec(cmd) });
  }
  if (u.startsWith("https://api.resend.com/emails")) { RESEND.push(JSON.parse(init.body)); return Response.json({ id: "em_1" }); }
  if (/^http:\/\/127\.0\.0\.1:/.test(u)) return realFetch(url, init);
  return new Response("{}", { status: 404 });
};
// Stripe: a live plan only for the addresses in RENEWS (or cancelled, in CANCELLED).
const RENEWS = new Set(), CANCELLED = new Set();
const subFor = (email, cancel) => ({ id: "sub_" + email.length, customer: "cus_1", status: "active", cancel_at_period_end: cancel, current_period_end: Math.floor(Date.now() / 1000) + 86400 * 20, items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 * 20 }] }, metadata: { slp: email, plan: "slp-pro" } });
const stripe = {
  subscriptions: {
    search: async ({ query }) => {
      const m = /metadata\['slp'\]:'([^']+)' AND metadata\['plan'\]:'([^']+)'/.exec(query) || [];
      const email = m[1], plan = m[2];
      if (plan !== "slp-pro" || !(RENEWS.has(email) || CANCELLED.has(email))) return { data: [], has_more: false };
      return { data: [subFor(email, CANCELLED.has(email))], has_more: false };
    },
    list: async () => ({ data: [] }), retrieve: async () => { const e = new Error("none"); e.code = "resource_missing"; throw e; },
  },
  customers: { list: async () => ({ data: [] }) },
};
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

const ERRS = [];
console.error = (...a) => { ERRS.push(a.map(String).join(" ")); };

let A, SI, D, AP, R = {};
try {
  A = L("lib/slpAuth.ts"); SI = L("lib/slpSignIn.ts"); D = L("lib/slpDelete.ts"); AP = L("lib/slpApp.ts");
  for (const [k, rel] of Object.entries({
    request: "app/api/slp/auth/request/route.ts", code: "app/api/slp/auth/code/route.ts", verify: "app/api/slp/auth/verify/route.ts",
    account: "app/api/slp/account/route.ts", pilot: "app/api/pilot/route.ts", community: "app/api/slp/community/route.ts",
  })) R[k] = L(rel);
} catch (e) {
  console.log("(could not load the modules: " + (e && e.stack) + ")");
}
ok("the sign-in, delete and app libraries and every route load", !!(A && SI && D && AP && R.request && R.code && R.verify && R.account && R.pilot && R.community));

let ip = 0;
const cookieFor = (email, iat = Date.now()) => "slp_session=" + encodeURIComponent(A.signSession({ email, code: "", iat, exp: iat + 600000 }));
async function call(route, method, url, o = {}) {
  ip++;
  const h = new Headers({ "content-type": "application/json", "x-real-ip": "10.9." + ((ip >> 8) & 255) + "." + (ip & 255), origin: o.origin || "https://sona.test.invalid" });
  if (o.as) h.set("cookie", cookieFor(o.as, o.iat));
  if (o.cookie) h.set("cookie", o.cookie);
  const init = { method, headers: h };
  if (o.body !== undefined) init.body = JSON.stringify(o.body);
  const res = await route[method](new NextRequest("https://sona.test.invalid" + url, init));
  let json = null; try { json = await res.clone().json(); } catch { json = null; }
  return { status: res.status, json, cookie: res.headers.get("set-cookie") || "", location: res.headers.get("location") || "" };
}
const iso = () => new Date().toISOString();
const acctOf = (email) => { try { return JSON.parse(KV.K.get("slpacct:" + email) || "null"); } catch { return null; } };
const sessionCookieFrom = (setCookie) => (setCookie.match(/slp_session=[^;]+/) || [""])[0];

if (A && SI && R.request && R.code) {
  // ── 1. the code ──
  const codes = Array.from({ length: 400 }, () => SI.makeSignInCode());
  ok("a sign-in code is six digits, and they do not repeat much", codes.every((c) => /^\d{6}$/.test(c)) && new Set(codes).size > 390);
  ok("a typed code forgives spaces and a dash, and nothing else", SI.cleanSignInCode(" 482 913 ") === "482913" && SI.cleanSignInCode("482-913") === "482913" && SI.cleanSignInCode("48291") === "" && SI.cleanSignInCode("48291a") === "");

  const NEW = "new.slp@clinic.example";
  let r = await call(R.request, "POST", "/api/slp/auth/request", { body: { email: NEW, wantCode: true } });
  const code1 = r.json && r.json.devCode;
  ok("asked for a code, the sign-in route makes one (shown only where no email can be sent: a test server)", r.status === 200 && r.json.code === true && /^\d{6}$/.test(code1 || ""), r);
  const stored = KV.K.get("slpsignin:" + NEW) || "";
  ok("only a hash of the code is kept, beside the link it was sent with, for 15 minutes",
    !!stored && !stored.includes(code1) && JSON.parse(stored).h.length === 64 && /^slptok:/.test(JSON.parse(stored).k) && KV.TTL.get("slpsignin:" + NEW) === 900, stored);
  ok("…and nobody is signed in, and no account is made, by asking", !acctOf(NEW) && !r.cookie);
  r = await call(R.request, "POST", "/api/slp/auth/request", { body: { email: "plain@clinic.example" } });
  ok("a sign-in that did not ask for a code gets none (the homepage's link alone)", r.status === 200 && !r.json.code && !KV.K.has("slpsignin:plain@clinic.example"), r.json);

  r = await call(R.code, "POST", "/api/slp/auth/code", { body: { email: NEW, code: code1 }, origin: "https://evil.example" });
  ok("the code is typed on Sona's own page: another site's post is refused", r.status === 403, r);
  r = await call(R.code, "POST", "/api/slp/auth/code", { body: { email: NEW, code: "12345" } });
  ok("a code that is not six digits is refused before anything is counted", r.status === 400 && !KV.K.has("slpsignintry:" + NEW), r);
  const wrong = code1 === "000000" ? "000001" : "000000";
  r = await call(R.code, "POST", "/api/slp/auth/code", { body: { email: NEW, code: wrong } });
  ok("a wrong code says so, signs nobody in and counts one try", r.status === 400 && r.json.why === "wrong" && !r.cookie && KV.K.get("slpsignintry:" + NEW) === "1", r);
  r = await call(R.code, "POST", "/api/slp/auth/code", { body: { email: NEW, code: code1.slice(0, 3) + " " + code1.slice(3) } });
  const cookie1 = sessionCookieFrom(r.cookie);
  ok("the right code signs this screen in: a session cookie, and the account is made", r.status === 200 && r.json.ok && !!cookie1 && !!acctOf(NEW), r);
  ok("…on the sign-in page's terms (Sona Pro, as the link from that page)", acctOf(NEW) && acctOf(NEW).terms === "pro-2026-11-12", acctOf(NEW));
  ok("…and the code and its link are spent with it, and the tries are cleared",
    !KV.K.has("slpsignin:" + NEW) && !KV.K.has(JSON.parse(stored).k) && !KV.K.has("slpsignintry:" + NEW));
  r = await call(R.code, "POST", "/api/slp/auth/code", { body: { email: NEW, code: code1 } });
  ok("a code works once", r.status === 400 && r.json.why === "gone" && !r.cookie, r);

  // five wrong tries end the code
  r = await call(R.request, "POST", "/api/slp/auth/request", { body: { email: NEW, wantCode: true } });
  const code2 = r.json.devCode, bad = code2 === "999999" ? "999998" : "999999";
  for (let i = 0; i < 5; i++) await call(R.code, "POST", "/api/slp/auth/code", { body: { email: NEW, code: bad } });
  r = await call(R.code, "POST", "/api/slp/auth/code", { body: { email: NEW, code: code2 } });
  ok("after five wrong tries even the right code is refused, and the code is gone", r.status === 400 && r.json.why === "tries" && !KV.K.has("slpsignin:" + NEW) && !r.cookie, r);

  // the app's door: the free dashboard
  const APPDOC = "app.slp@school.example";
  r = await call(R.request, "POST", "/api/slp/auth/request", { body: { email: APPDOC, wantCode: true, flow: "free-dashboard" } });
  r = await call(R.code, "POST", "/api/slp/auth/code", { body: { email: APPDOC, code: r.json.devCode } });
  ok("the app's sign-in (the free-dashboard door, as the homepage's) makes a free-dashboard account", r.status === 200 && acctOf(APPDOC) && acctOf(APPDOC).terms === "free-dashboard-2026-11-13", acctOf(APPDOC));
  const PROERA = "pro.era@clinic.example";
  KV.K.set("slpacct:" + PROERA, JSON.stringify({ email: PROERA, name: "Pat", code: "", terms: "pro-2026-11-12", createdAt: iso() }));
  r = await call(R.request, "POST", "/api/slp/auth/request", { body: { email: PROERA, wantCode: true, flow: "free-dashboard" } });
  r = await call(R.code, "POST", "/api/slp/auth/code", { body: { email: PROERA, code: r.json.devCode } });
  ok("…and opens a locked Pro-era account's dashboard, as the homepage's link does (nothing locked meets a clinician in the app)", r.status === 200 && acctOf(PROERA).freeDashboard === true && acctOf(PROERA).terms === "pro-2026-11-12", acctOf(PROERA));

  // the link still works, and spends the code
  r = await call(R.request, "POST", "/api/slp/auth/request", { body: { email: "linker@clinic.example", wantCode: true } });
  const link = r.json.devLink, code3 = r.json.devCode;
  r = await call(R.verify, "GET", link.replace(/^https?:\/\/[^/]+/, ""));
  ok("the emailed link still signs in (to the dashboard) and spends its code", r.status === 307 && /\/slp\.html$/.test(r.location) && !!sessionCookieFrom(r.cookie) && !KV.K.has("slpsignin:linker@clinic.example"), r);
  r = await call(R.code, "POST", "/api/slp/auth/code", { body: { email: "linker@clinic.example", code: code3 } });
  ok("…so the code from that email no longer does", r.status === 400 && r.json.why === "gone", r);

  // the email
  process.env.RESEND_API_KEY = "re_test";
  r = await call(R.request, "POST", "/api/slp/auth/request", { body: { email: "mailed@clinic.example", wantCode: true } });
  const mail = RESEND[RESEND.length - 1] || {};
  const spaced = (mail.subject || "").replace(/^Your Sona sign-in code: /, "");
  ok("the email carries the code in its subject (a phone's notification shows it) and its body, in HTML and text",
    r.status === 200 && r.json.devCode === undefined && /^\d{3} \d{3}$/.test(spaced) && mail.html.includes(spaced) && mail.text.includes(spaced) && mail.text.includes("/api/slp/auth/verify?token="), mail.subject);
  ok("…which the server never sends back to the page when the email went", !JSON.stringify(r.json).includes(spaced.replace(" ", "")));
  delete process.env.RESEND_API_KEY;

  // App Review's door
  r = await call(R.request, "POST", "/api/slp/auth/request", { body: { email: "appreview@speaksona.com", wantCode: true } });
  ok("with no review variables set, the review address is an ordinary address", r.status === 200 && KV.K.has("slpsignin:appreview@speaksona.com"), r);
  r = await call(R.code, "POST", "/api/slp/auth/code", { body: { email: "appreview@speaksona.com", code: "246810" } });
  ok("…and no fixed code opens it", r.status === 400 && !r.cookie, r);
  process.env.SLP_REVIEW_EMAIL = "Review.Desk@Speaksona.com"; process.env.SLP_REVIEW_CODE = "135 790";
  const RV = "review.desk@speaksona.com";
  const mailsBefore = RESEND.length;
  r = await call(R.request, "POST", "/api/slp/auth/request", { body: { email: RV, wantCode: true } });
  ok("with both set, asking for the review address's code emails nothing and stores nothing", r.status === 200 && r.json.sent === true && !KV.K.has("slpsignin:" + RV) && RESEND.length === mailsBefore, r);
  r = await call(R.code, "POST", "/api/slp/auth/code", { body: { email: RV, code: "135791" } });
  ok("…a wrong code is still wrong", r.status === 400 && r.json.why === "wrong", r);
  r = await call(R.code, "POST", "/api/slp/auth/code", { body: { email: RV, code: "135790" } });
  ok("…and its fixed code signs App Review in, onto the free dashboard", r.status === 200 && !!sessionCookieFrom(r.cookie) && acctOf(RV) && acctOf(RV).terms === "free-dashboard-2026-11-13" && acctOf(RV).source === "app-review", acctOf(RV));
  r = await call(R.code, "POST", "/api/slp/auth/code", { body: { email: "someone.else@clinic.example", code: "135790" } });
  ok("…for that address only", r.status === 400 && !r.cookie, r);
  delete process.env.SLP_REVIEW_CODE;
  r = await call(R.code, "POST", "/api/slp/auth/code", { body: { email: RV, code: "135790" } });
  ok("…and unset either variable and the door is gone", r.status === 400 && !r.cookie, r);
  delete process.env.SLP_REVIEW_EMAIL;

  // ── 3. delete my account ──
  const RACH = "rachel@brightsteps.example", OTHER = "olive@riverside.example";
  const code = "rachel-k4";
  const seed = () => {
    KV.K.set("slpacct:" + RACH, JSON.stringify({ email: RACH, name: "Rachel K", clinic: "Bright Steps", code, familyKey: "ABCD2345", terms: "free-dashboard-2026-11-13", createdAt: iso() }));
    KV.K.set("slpcode:" + code, RACH);
    KV.K.set("slpacct:" + OTHER, JSON.stringify({ email: OTHER, name: "Olive", code: "olive-z2", familyKey: "WXYZ2345", createdAt: iso() }));
    KV.K.set("slpcode:olive-z2", OTHER);
    hash("slp:" + code).set("kid1", JSON.stringify({ childId: "kid1", child: "Milo" }));
    hash("slp:RACHEL-K4").set("kid9", JSON.stringify({ childId: "kid9", child: "Legacy" }));
    hash("hw:" + code).set("kid1", JSON.stringify({ hw: { title: "R words" } }));
    hash("slpmeta:" + code).set("kid1", JSON.stringify({ archived: false }));
    hash("slpgone:" + code).set("kid2", "1");
    hash("inv:" + code).set("TOKENAAAAAA2", JSON.stringify({ createdAt: iso(), expiresAt: iso() }));
    KV.K.set("inv:" + code + ":TOKENAAAAAA2", JSON.stringify({ label: "MK" }));
    KV.K.set("invclaim:" + code + ":TOKENAAAAAA2", "kid1");
    hash("famlogins:" + code).set("inv:TOKENAAAAAA2", "comet1234");
    KV.K.set("famlogin:comet1234", JSON.stringify({ user: "comet1234", code }));
    KV.K.set("famloginfail:comet1234", "2");
    KV.K.set("slpredeem:" + code, "4"); KV.K.set("slpredeem-owner:" + RACH, "4");
    KV.K.set("slp-feedback:" + code, "[]"); KV.K.set("slp-feedback:" + RACH, "[]");
    KV.K.set("slpself:" + code + ":tok1", RACH);
    KV.K.set("slpplan-pro:" + RACH, JSON.stringify({ sub: "", status: "none", checkedAt: 0 }));
    KV.K.set("slpaccess:" + RACH, "{}");
    const rid = D.communityId(RACH), oid = D.communityId(OTHER);
    const P = "{slp-community}:";
    hash(P + "posts").set("11111111-1111-4111-8111-111111111111", JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", authorId: rid, author: "Rachel", title: "Mine", category: "discussions", text: "my post", createdAt: iso(), replies: [{ id: "22222222-2222-4222-8222-222222222222", authorId: oid, author: "Olive", text: "reply on hers", createdAt: iso() }] }));
    hash(P + "posts").set("33333333-3333-4333-8333-333333333333", JSON.stringify({ id: "33333333-3333-4333-8333-333333333333", authorId: oid, author: "Olive", title: "Olive's", category: "discussions", text: "her post", createdAt: iso(), replies: [{ id: "44444444-4444-4444-8444-444444444444", authorId: rid, author: "Rachel", text: "rachel replies", createdAt: iso() }, { id: "55555555-5555-4555-8555-555555555555", authorId: oid, author: "Olive", text: "olive again", createdAt: iso() }] }));
    zset(P + "index").set("11111111-1111-4111-8111-111111111111", 1); zset(P + "index").set("33333333-3333-4333-8333-333333333333", 2);
    zset(P + "index:discussions").set("11111111-1111-4111-8111-111111111111", 1);
    KV.L.set(P + "reports", [JSON.stringify({ id: "r1", authorId: rid, text: "my post" }), JSON.stringify({ id: "r2", authorId: oid, text: "her post" })]);
    set(P + "blocks:" + rid).add(oid);
  };
  seed();
  const oldIat = Date.now() - 1000;
  r = await call(R.account, "DELETE", "/api/slp/account", { body: { confirm: RACH } });
  ok("deleting needs the clinician signed in", r.status === 401, r);
  r = await call(R.account, "DELETE", "/api/slp/account", { as: RACH, iat: oldIat, body: { confirm: "someone@else.example" } });
  ok("…and their own email typed back as the yes; anything else deletes nothing", r.status === 400 && !!acctOf(RACH), r);
  r = await call(R.account, "DELETE", "/api/slp/account", { as: RACH, iat: oldIat, body: { confirm: RACH }, origin: "https://evil.example" });
  ok("…from Sona's own page only", r.status === 403 && !!acctOf(RACH), r);

  RENEWS.add(RACH);
  r = await call(R.account, "DELETE", "/api/slp/account", { as: RACH, iat: oldIat, body: { confirm: RACH } });
  ok("a paid plan that still renews blocks it, says how to cancel, and deletes nothing", r.status === 409 && r.json.renews === true && /Cancel it first/.test(r.json.error) && !!acctOf(RACH) && KV.H.get("slp:" + code)?.has("kid1") && KV.K.get("slpcode:" + code) === RACH, r);
  RENEWS.delete(RACH); CANCELLED.add(RACH);
  r = await call(R.account, "DELETE", "/api/slp/account", { as: RACH, iat: oldIat, body: { confirm: " " + RACH.toUpperCase() + " " } });
  CANCELLED.delete(RACH);
  ok("a plan already cancelled (running out its paid month) does not; the typed email forgives case and spaces", r.status === 200 && r.json.deleted === true, r);
  ok("…the answer signs this screen out", /slp_session=;[^]*Max-Age=0/.test(r.cookie), r.cookie);
  const gone = ["slpacct:" + RACH, "slp:" + code, "slp:RACHEL-K4", "hw:" + code, "slpmeta:" + code, "slpgone:" + code, "inv:" + code, "inv:" + code + ":TOKENAAAAAA2",
    "invclaim:" + code + ":TOKENAAAAAA2", "famlogins:" + code, "famlogin:comet1234", "famloginfail:comet1234", "slpredeem:" + code, "slpredeem-owner:" + RACH,
    "slp-feedback:" + code, "slp-feedback:" + RACH, "slpself:" + code + ":tok1", "slpplan-pro:" + RACH, "slpaccess:" + RACH, "{slp-community}:blocks:" + D.communityId(RACH)];
  const left = gone.filter((k) => allKeys().includes(k));
  ok("the account and everything it held are gone: caseload, homework, notes, invites, family logins, counters, plan notes, messages, Premium links, block list", left.length === 0, left);
  ok("the clinic code is kept, closed for good", KV.K.get("slpcode:" + code) === D.DELETED_CODE && KV.TTL.get("slpcode:" + code) === undefined, KV.K.get("slpcode:" + code));
  const posts = KV.H.get("{slp-community}:posts");
  const herPost = JSON.parse(posts.get("33333333-3333-4333-8333-333333333333"));
  ok("their community posts go whole (with the replies on them), and their replies leave others' posts, which stay",
    !posts.has("11111111-1111-4111-8111-111111111111") && !KV.Z.get("{slp-community}:index").has("11111111-1111-4111-8111-111111111111") &&
    !KV.Z.get("{slp-community}:index:discussions").has("11111111-1111-4111-8111-111111111111") &&
    herPost.replies.length === 1 && herPost.replies[0].author === "Olive", herPost);
  ok("…and a report quoting them goes; one about someone else stays", KV.L.get("{slp-community}:reports").length === 1 && JSON.parse(KV.L.get("{slp-community}:reports")[0]).id === "r2");
  ok("the other clinician is untouched", !!acctOf(OTHER) && KV.K.get("slpcode:olive-z2") === OTHER);
  ok("every session from before the delete is over", (await A.liveSession({ email: RACH, iat: oldIat, exp: Date.now() + 9e5 })) === null && (await A.liveSession({ email: OTHER, iat: oldIat, exp: Date.now() + 9e5 })) !== null);
  ok("the address leaves Sona's email list", KV.S.get("email:unsub")?.has(RACH));

  // a family phone still holding a ticket for the deleted code
  const ticket = A.signTicket(code, 400, "kid1");
  r = await call(R.pilot, "POST", "/api/pilot", { body: { code, ticket, childId: "kid1", child: "Milo", outcomes: {}, at: iso() } });
  ok("a family's next sync to the deleted code answers ok and writes nothing back", r.status === 200 && !KV.H.get("slp:" + code)?.size, r);
  r = await call(R.account, "POST", "/api/slp/account", { as: OTHER, body: { code } });
  ok("…and nobody can claim the closed code", r.status === 409, r);
  r = await call(R.request, "POST", "/api/slp/auth/request", { body: { email: RACH, wantCode: true } });
  r = await call(R.code, "POST", "/api/slp/auth/code", { body: { email: RACH, code: r.json.devCode } });
  ok("the same email can sign up again later: a new, empty account", r.status === 200 && !!acctOf(RACH) && !acctOf(RACH).code, acctOf(RACH));
  ok("…signed in afresh (a session from after the delete is live)", !!(await A.liveSession({ email: RACH, iat: Date.now() + 5, exp: Date.now() + 9e5 })));

  // ── 4. block ──
  const OID = D.communityId(OTHER), P = "{slp-community}:";
  const BEN = "ben@clinic.example"; KV.K.set("slpacct:" + BEN, JSON.stringify({ email: BEN, name: "Ben", code: "", createdAt: iso() }));
  hash(P + "posts").set("66666666-6666-4666-8666-666666666666", JSON.stringify({ id: "66666666-6666-4666-8666-666666666666", authorId: D.communityId(BEN), author: "Ben", title: "Ben's", category: "discussions", text: "ben post", createdAt: iso(), replies: [{ id: "77777777-7777-4777-8777-777777777777", authorId: OID, author: "Olive", text: "olive on ben", createdAt: iso() }] }));
  zset(P + "index").set("66666666-6666-4666-8666-666666666666", 3);
  r = await call(R.community, "GET", "/api/slp/community", { as: BEN });
  ok("(the community lists Olive's post to Ben, with mine:false on it)", r.status === 200 && r.json.posts.some((p) => p.id === "33333333-3333-4333-8333-333333333333" && p.mine === false) && r.json.blocked === 0, r.json && r.json.posts);
  r = await call(R.community, "POST", "/api/slp/community", { as: BEN, body: { action: "block", postId: "66666666-6666-4666-8666-666666666666" } });
  ok("nobody blocks themselves", r.status === 400, r);
  r = await call(R.community, "POST", "/api/slp/community", { as: BEN, body: { action: "block", postId: "66666666-6666-4666-8666-666666666666", replyId: "77777777-7777-4777-8777-777777777777" }, origin: "https://evil.example" });
  ok("a block comes from Sona's own page only", r.status === 403, r);
  r = await call(R.community, "POST", "/api/slp/community", { as: BEN, body: { action: "block", postId: "66666666-6666-4666-8666-666666666666", replyId: "77777777-7777-4777-8777-777777777777" } });
  ok("Ben blocks Olive by one of her replies (the page never holds anyone's id)", r.status === 200 && KV.S.get(P + "blocks:" + D.communityId(BEN))?.has(OID) && KV.TTL.get(P + "blocks:" + D.communityId(BEN)) === 31536000, r);
  r = await call(R.community, "GET", "/api/slp/community", { as: BEN });
  const benSees = JSON.stringify(r.json && r.json.posts);
  ok("…and sees none of her posts or replies, on anyone's post, and how many he blocked", r.status === 200 && !/Olive/.test(benSees) && /Ben's/.test(benSees) && r.json.blocked === 1, r.json);
  r = await call(R.community, "GET", "/api/slp/community", { as: OTHER });
  ok("…for Ben alone: Olive, and everyone else, see everything, and are not told", r.status === 200 && /olive on ben/.test(JSON.stringify(r.json.posts)) && r.json.blocked === 0);
  r = await call(R.community, "POST", "/api/slp/community", { as: BEN, body: { action: "unblock-all" } });
  r = await call(R.community, "GET", "/api/slp/community", { as: BEN });
  ok("Show them again brings everyone back", /olive on ben/.test(JSON.stringify(r.json && r.json.posts)) && r.json.blocked === 0);

  ok("no route logged an error", !ERRS.some((e) => /TypeError|ReferenceError|is not a function/.test(e)), ERRS.slice(0, 3));
}

// ── the app's word, on the server ──
if (AP) {
  const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SonaSLPApp/1";
  ok("the app is known by SonaSLPApp/<n> in its user agent, and nothing else is", AP.slpAppRequest(UA) && !AP.slpAppRequest(UA.replace(" SonaSLPApp/1", "")) && !AP.slpAppRequest("SonaSLPApp") && !AP.slpAppRequest(""));
  ok("in it, the dashboard, its sign-in and privacy show; any other page goes to the dashboard",
    ["/slp.html", "/slp-login.html", "/privacy.html", "/api/x"].every(AP.slpAppPageAllowed) && !["/today.html", "/subscribe.html", "/for-slps.html", "/join.html"].some(AP.slpAppPageAllowed));
  const mw = noComments(read("middleware.ts"));
  ok("the middleware sends the app's requests for other pages to the dashboard, before the launch lock",
    /slpAppRequest\(req\.headers\.get\("user-agent"\)\)/.test(mw) && mw.indexOf("slpAppRequest(") < mw.indexOf("locked()") && /pathname = "\/slp\.html"/.test(mw));
  const cfg = JSON.parse(read("native/slp-ios/capacitor.config.json") || "{}");
  ok("the app's own shell: its own id, the word in its user agent, the dashboard as its first page, speaksona.com only",
    cfg.appId === "com.speaksona.slp" && cfg.appId !== JSON.parse(read("capacitor.config.json")).appId && /^SonaSLPApp\/\d+$/.test(cfg.appendUserAgent || "") &&
    cfg.server && cfg.server.url === "https://www.speaksona.com" && cfg.server.appStartPath === "/slp.html" && cfg.server.cleartext === false &&
    JSON.stringify(cfg.server.allowNavigation) === JSON.stringify(["speaksona.com", "www.speaksona.com"]) && existsSync(path.join(APP, "native/slp-ios/www", cfg.server.errorPath)), cfg);
  ok("the family app's shell does not carry the word", !/SonaSLPApp/.test(read("capacitor.config.json")));
  ok("its icon is a 1024 square with no transparency (App Store Connect refuses one with)", (() => { const b = readFileSync(path.join(APP, "native/slp-ios/assets/icon-1024.png")); return b.readUInt32BE(16) === 1024 && b.readUInt32BE(20) === 1024 && b[25] === 2; })());
  ok("the iOS project itself is never committed", /^\/ios$/m.test(read("native/slp-ios/.gitignore")));
}

// ═════════════════════════ part 2: the pages ═════════════════════════
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", json: "application/json", webmanifest: "application/manifest+json", woff2: "font/woff2" };
const PORT = 4000 + Math.floor(Math.random() * 2000), BASE = "http://127.0.0.1:" + PORT;
const APP_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SonaSLPApp/1";
const slpSrc = read("tests/slptest.mjs");
const fixture = () => runInNewContext(slpSrc.slice(slpSrc.indexOf("const day ="), slpSrc.indexOf("// ── mock API:")) + "\nfixture();", { Date });
let DATA = fixture(), posts = [];
const ACCOUNT = { ok: true, email: "rachel@example.com", code: "rachel-k4", familyKey: "ABCD2345", name: "Rachel K", clinic: "Bright Steps", onboarded: true };
const PRO_OFF = { active: false, status: "none", trialEnd: null, periodEnd: null, cancelAtPeriodEnd: false, trialAvailable: true, offer: true, name: "Sona Pro", price: "$19.99", per: "a month", trialDays: 14 };
const SELF_OFF = { active: false, eligible: false, source: "none", periodEnd: null, cancelAtPeriodEnd: false, canRequest: false, workEmail: true, approved: false, requested: false };
const PLAN = { ok: true, active: false, source: "none", periodEnd: null, cancelAtPeriodEnd: false, self: SELF_OFF, pro: PRO_OFF, dashboard: { open: true }, grandfathered: false };
let COMMUNITY = { ok: true, pinned: [], posts: [], nextCursor: null, blocked: 0 };
const server = createServer((req, res) => {
  const url = new URL(req.url, BASE); let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let j = {}; try { j = JSON.parse(body || "{}"); } catch {}
    const json = (v, status = 200) => { res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(v)); };
    if (url.pathname.startsWith("/api/")) {
      if (req.method !== "GET") posts.push({ path: url.pathname, method: req.method, body: j });
      if (url.pathname === "/api/slp/auth/request") return json({ ok: true, sent: true, signedIn: false, devLink: null, code: j.wantCode === true });
      if (url.pathname === "/api/slp/auth/code") return json(j.code === "246810" ? { ok: true } : { ok: false, error: "That code doesn't match. Check the email and try again." }, j.code === "246810" ? 200 : 400);
      if (url.pathname === "/api/slp/auth/me" || (url.pathname === "/api/slp/account" && req.method !== "DELETE")) return json(ACCOUNT);
      if (url.pathname === "/api/slp/account" && req.method === "DELETE") return json(j.confirm === ACCOUNT.email ? { ok: true, deleted: true } : { ok: false, error: "Type your account's email to confirm." }, j.confirm === ACCOUNT.email ? 200 : 400);
      if (url.pathname === "/api/slp/plan" && req.method === "GET") return json(PLAN);
      if (url.pathname === "/api/slp" && req.method === "GET") return json({ ok: true, configured: true, kids: DATA.kids, invites: DATA.invites });
      if (url.pathname === "/api/slp/community" && req.method === "GET") return json(COMMUNITY);
      return json({ ok: true });
    }
    const p = url.pathname === "/" ? "/for-slps.html" : url.pathname;
    const file = path.join(PUB, p);
    if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
const browser = await chromium.launch(launchOpts());
async function open(url, o = {}) {
  const context = await browser.newContext({ viewport: o.viewport || { width: 390, height: 844 }, deviceScaleFactor: 1, ...(o.app === false ? {} : { userAgent: APP_UA }) });
  await context.route("**/*", (r) => r.request().url().startsWith(BASE + "/") ? r.continue() : r.abort());
  await context.addInitScript((native) => {
    if (native) window.Capacitor = { isNativePlatform: () => true };
    window.__copied = []; window.confirm = () => true;
    try { Object.defineProperty(navigator, "clipboard", { value: { writeText: (s) => (window.__copied.push(s), Promise.resolve()) } }); } catch (e) {}
  }, o.native !== false);
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(4000); page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  return { context, page, errors };
}
async function section(name, fn) { posts = []; DATA = fixture(); try { await fn(); } catch (e) { ok(name + " completes", false, String(e && e.stack || e).slice(0, 400)); } }
// Every visible word on the page, and every visible link and button
const visibleText = (page) => page.evaluate(() => {
  const out = [];
  const walk = (el) => { const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden" || el.hidden) return; for (const n of el.childNodes) { if (n.nodeType === 3) out.push(n.textContent); else if (n.nodeType === 1) walk(n); } };
  walk(document.body); return out.join(" ").replace(/\s+/g, " ");
});
const SELLING = /\$\s?\d|Sona Pro|free trial|Start my free trial|Get Sona Pro|Manage billing|checkout|Get Premium|Subscribe|per month|a month/i;

try {
  await section("the sign-in screen in the app", async () => {
    const { context, page, errors } = await open("/slp-login.html");
    await page.waitForSelector("#send");
    ok("the app's sign-in renders (the family app's bounce is for the family app)", new URL(page.url()).pathname === "/slp-login.html" && await page.evaluate(() => document.documentElement.classList.contains("slp-app")));
    ok("…asks for a code, not a link, and sends no clinician to the homepage's sign-up",
      (await page.locator("#send").textContent()) === "Email me a code" && !(await page.locator('a[href="/#signup"]').isVisible()) && await page.locator(".app-only").isVisible());
    await page.locator("#email").fill("rachel@example.com");
    await page.locator("#send").click();
    await page.waitForSelector("#sentCard", { state: "visible" });
    const req = posts.find((p) => p.path === "/api/slp/auth/request");
    ok("…by the free-dashboard door, asking for a code", !!req && req.body.wantCode === true && req.body.flow === "free-dashboard", req);
    ok("…then the code box, focused, with the one-time-code hint (iOS offers the code from Mail)",
      await page.locator("#code").isVisible() && await page.evaluate(() => document.activeElement && document.activeElement.id === "code") && (await page.locator("#code").getAttribute("autocomplete")) === "one-time-code" && /6-digit code/.test(await page.locator("#sentMsg").textContent()));
    await page.locator("#code").fill("111111");
    await page.waitForFunction(() => /doesn't match/.test(document.getElementById("codeErr").textContent));
    ok("a wrong code says so and stays", new URL(page.url()).pathname === "/slp-login.html");
    await page.locator("#code").fill("246 810");
    await page.waitForURL("**/slp.html", { timeout: 4000 }).catch(() => {});
    ok("six digits sign in by themselves, then open the dashboard", new URL(page.url()).pathname === "/slp.html", page.url());
    ok("…with no page errors", errors.length === 0, errors);
    await context.close();
  });

  await section("the sign-in screen on the web", async () => {
    const { context, page, errors } = await open("/slp-login.html", { app: false, native: false });
    await page.waitForSelector("#send");
    ok("on the web the sign-in still sends a link, and keeps the homepage's sign-up", (await page.locator("#send").textContent()) === "Send my sign-in link" && await page.locator('a[href="/#signup"]').isVisible());
    await page.locator("#email").fill("rachel@example.com");
    await page.locator("#send").click();
    await page.waitForSelector("#sentCard", { state: "visible" });
    const req = posts.find((p) => p.path === "/api/slp/auth/request");
    ok("…and the same email carries a code, which the web may type too (the sign-in page's own door, not the free dashboard's)", !!req && req.body.wantCode === true && req.body.flow === undefined && /link and a 6-digit code/.test(await page.locator("#sentMsg").textContent()), req);
    ok("…with no page errors", errors.length === 0, errors);
    await context.close();
    const del = await open("/slp-login.html?deleted=1", { app: false, native: false });
    await del.page.waitForSelector("#send");
    ok("after a delete, the sign-in page says the account is deleted", /Your account is deleted/.test(await del.page.locator("#err").textContent()));
    await del.context.close();
  });

  for (const width of [390, 1280]) {
    await section("the dashboard in the app at " + width, async () => {
      const { context, page, errors } = await open("/slp.html#today", { viewport: { width, height: width < 500 ? 844 : 1000 } });
      await page.waitForFunction(() => document.getElementById("sidebarName").textContent === "Rachel K");
      await page.waitForTimeout(300);
      const tag = width + "px: ";
      ok(tag + "the dashboard renders in the clinicians' app", new URL(page.url()).pathname === "/slp.html");
      const seen = [];
      for (const hash of ["#plan", "#today", "#caseload", "#settings", "#feedback", "#add-family"]) {
        if (hash === "#add-family") { await page.evaluate(() => { location.hash = "#today"; }); await page.waitForTimeout(150); await page.evaluate(() => document.getElementById("addFamilyTop").click()); await page.waitForTimeout(250); }
        await page.evaluate((h) => { location.hash = h; }, hash);
        await page.waitForTimeout(150);
        if (width < 500) await page.evaluate(() => { const m = document.getElementById("menuBtn") || document.querySelector("[aria-controls='sidebar']"); if (m) m.click(); });
        const t = await visibleText(page);
        const hit = t.match(SELLING);
        if (hit) seen.push(hash + ": " + hit[0] + " … " + t.slice(Math.max(0, hit.index - 60), hit.index + 60));
      }
      ok(tag + "no price, plan offer, trial, checkout or billing door anywhere (the planner, Today, Caseload, Settings, Talk to Rachel, the Add a family panel, the menu)", seen.length === 0, seen);
      await page.evaluate(() => { const d = document.getElementById("famDialog"); if (d.open) d.close(); });
      ok(tag + "the Sona Pro menu item and the top bar's offer are not drawn", !(await page.locator('.nav-item[data-page="premium"]').isVisible()) && !(await page.locator("#premiumTop").isVisible()));
      await page.evaluate(() => { location.hash = "#premium"; });
      await page.waitForTimeout(200);
      ok(tag + "the plan page's address opens Settings instead", await page.locator("#page-settings").isVisible() && !(await page.locator("#page-premium").isVisible()));
      ok(tag + "Settings has Delete your account", await page.locator("#deleteCard").isVisible() && (await page.locator("#deleteOpen").textContent()) === "Delete my account…");
      ok(tag + "…and the caseload export shares a file there (an app cannot save a download)", (await page.locator("#exportCsv").textContent()) === "Share CSV");
      ok(tag + "…with no page errors", errors.length === 0, errors);
      await context.close();
    });
  }

  await section("the dashboard on the web still sells", async () => {
    const { context, page } = await open("/slp.html#today", { app: false, native: false, viewport: { width: 1280, height: 1000 } });
    await page.waitForFunction(() => document.getElementById("sidebarName").textContent === "Rachel K");
    await page.waitForTimeout(300);
    ok("on the web the Sona Pro menu item and the top bar's offer are still there", await page.locator('.nav-item[data-page="premium"]').isVisible() && await page.locator("#premiumTop").isVisible());
    ok("…and Settings has Delete your account too", await page.evaluate(() => !!document.getElementById("deleteCard")) && (await page.locator("#exportCsv").textContent()) === "Download CSV");
    await context.close();
  });

  await section("delete my account, on the page", async () => {
    const { context, page, errors } = await open("/slp.html#settings", { viewport: { width: 390, height: 844 } });
    await page.waitForFunction(() => document.getElementById("sidebarName").textContent === "Rachel K");
    await page.locator("#deleteOpen").click();
    ok("Delete asks for the account's email first, and offers Keep my account", await page.locator("#deleteEmail").isVisible() && await page.locator("#deleteCancel").isVisible() && !(await page.locator("#deleteOpen").isVisible()));
    await page.locator("#deleteCancel").click();
    ok("…Keep my account closes it, nothing sent", await page.locator("#deleteOpen").isVisible() && !posts.some((p) => p.method === "DELETE"));
    await page.locator("#deleteOpen").click();
    await page.locator("#deleteEmail").fill("wrong@example.com");
    await page.locator("#deleteGo").click();
    await page.waitForFunction(() => /Type your account/.test(document.getElementById("deleteErr").textContent));
    ok("a wrong email is refused by the server, in words", new URL(page.url()).pathname === "/slp.html");
    await page.locator("#deleteEmail").fill("rachel@example.com");
    await page.locator("#deleteGo").click();
    await page.waitForURL("**/slp-login.html?deleted=1", { timeout: 4000 }).catch(() => {});
    const del = posts.filter((p) => p.path === "/api/slp/account" && p.method === "DELETE");
    ok("the right one deletes, then lands on the sign-in page saying so", new URL(page.url()).pathname === "/slp-login.html" && del.length === 2 && del[1].body.confirm === "rachel@example.com", page.url());
    ok("…with no page errors", errors.length === 0, errors);
    await context.close();
  });

  await section("no community in the app", async () => {
    const { context, page, errors } = await open("/slp.html#community", { viewport: { width: 1280, height: 1000 } });
    await page.waitForFunction(() => document.getElementById("sidebarName").textContent === "Rachel K");
    await page.waitForTimeout(250);
    ok("the dashboard shows no one else's posts (SLPCLEAN1): #community opens Today, and the page asks the community for nothing",
      (await page.evaluate(() => location.hash)) === "#today" && await page.locator("#page-today").isVisible() && !(await page.locator("[data-community-block]").count()) && !posts.some((p) => /community/.test(p.path)));
    ok("…with no page errors", errors.length === 0, errors);
    await context.close();
  });

  await section("every other page sends the app to the dashboard", async () => {
    for (const pth of ["/", "/for-slps.html", "/parents.html", "/today.html", "/settings.html"]) {
      const { context, page } = await open(pth);
      await page.waitForURL("**/slp.html", { timeout: 3000 }).catch(() => {});
      ok("in the app, " + pth + " goes to the dashboard", new URL(page.url()).pathname === "/slp.html", page.url());
      await context.close();
    }
    const fam = await open("/slp.html", { app: false });
    await fam.page.waitForURL(/\/(today|onboarding)\.html/, { timeout: 3000 }).catch(() => {});
    ok("…and the FAMILY app (native, no word) is still sent home from the dashboard (to setup, with no child set up yet)", /^\/(today|onboarding)\.html$/.test(new URL(fam.page.url()).pathname), fam.page.url());
    await fam.context.close();
  });
} finally {
  await browser.close();
  server.close();
}

// ── the source, said once ──
const slpPage = noComments(read("public/slp.html"));
ok("every selling surface of the dashboard is marked, and the app hides what is marked",
  /html\.slp-app \[data-sells\] \{ display:none !important; \}/.test(read("public/slp.html")) &&
  ['data-page="premium" href="#premium" data-sells', 'id="premiumTop" href="#premium" hidden data-sells', 'id="page-premium" data-sells', 'id="setPremium" data-sells'].every((s) => slpPage.includes(s)));
ok("the dashboard's register holds in the new words (no score, therapy, treatment, diagnosis)",
  !/\b(accuracy|score|scores|adherence|therapy|treatment|diagnos\w*)\b/i.test(((read("public/slp.html").match(/<div class="card" id="deleteCard">[\s\S]*?<\/div>\s*<\/div>/) || [""])[0])));

console.log("\nSLP app: " + checks + " checks; " + fails + " failures");
process.exit(fails ? 1 : 0);
