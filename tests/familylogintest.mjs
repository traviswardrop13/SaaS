// FAMLOGIN1: family logins (Travis, 14 Nov 2026). A clinician makes a
// username and password for a family on the SLP dashboard; the family types it
// into the Sona app (Log in, on setup's first screen) and is connected exactly
// as the clinician's link connects them, then asked the same sharing question.
// Travis's three calls, pinned here:
//   1. A login brings ACCESS + THE SLP LINK. Nothing about a child is stored
//      with it, and a new phone does not take over an old phone's child.
//   2. It is REUSABLE, and the PARENT CAN CHANGE the password in Settings;
//      from then on the clinician does not know it.
//   3. The dashboard is PHONE-FRIENDLY WEB, on the clinician's home screen
//      through its own manifest, opening in the browser (no App Store yet).
// And the walls the link already had: the same sign-up cap and counters, a
// ticket bound to the device's own child id, consent asked on the device,
// the clinician's code from the session, the password shown once and stored
// only as a salted scrypt hash.
//
// Part 1 runs the real routes (TypeScript, transpiled with the repo's own
// `typescript`, as caseloadtest does) against a fake store behind the same
// fetch kvCmd makes. Parts 2 and 3 drive the real pages against a mock API.
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
const KV_URL = "https://kv.famlogin.test.invalid";
process.env.KV_REST_API_URL = KV_URL;
process.env.KV_REST_API_TOKEN = "kv-test-token";
process.env.SLP_AUTH_SECRET = "famlogin-test-secret";
process.env.STRIPE_SECRET_KEY = "sk_test_famlogin";

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

const ERRS = [];
const realErr = console.error;
console.error = (...a) => { ERRS.push(a.map(String).join(" ")); };

let A, F, SU, C, R = {};
try {
  A = L("lib/slpAuth.ts"); F = L("lib/familyLogin.ts"); SU = L("lib/signups.ts"); C = L("lib/caseload.ts");
  for (const [k, rel] of Object.entries({
    login: "app/api/family/login/route.ts", password: "app/api/family/password/route.ts", slpLogin: "app/api/slp/login/route.ts",
    invite: "app/api/slp/invite/route.ts", claim: "app/api/slp/claim/route.ts", child: "app/api/slp/child/route.ts", roster: "app/api/slp/route.ts",
    family: "app/api/slp/family/route.ts",
  })) R[k] = L(rel);
} catch (e) {
  console.log("(could not load the modules: " + (e && e.stack) + ")");
}
ok("the login library, the sign-up rule and every route load", !!(A && F && SU && R.login && R.password && R.slpLogin && R.invite && R.claim && R.child && R.roster && R.family));

let ip = 0;
const cookieFor = (email) => "slp_session=" + encodeURIComponent(A.signSession({ email, code: "", iat: Date.now(), exp: Date.now() + 600000 }));
async function call(route, method, url, o = {}) {
  ip++;
  const h = new Headers({ "content-type": "application/json", "x-real-ip": "10.7." + ((ip >> 8) & 255) + "." + (ip & 255), origin: o.origin || "https://sona.test.invalid" });
  if (o.as) h.set("cookie", cookieFor(o.as));
  const init = { method, headers: h };
  if (o.body !== undefined) init.body = JSON.stringify(o.body);
  const res = await route[method](new NextRequest("https://sona.test.invalid" + url, init));
  let json = null; try { json = await res.clone().json(); } catch { json = null; }
  return { status: res.status, json };
}
const iso = () => new Date().toISOString();
function seedAcct(email, code, o = {}) {
  const a = { email, name: o.name || "Rachel K", clinic: o.clinic || "", code, familyKey: "ABCD2345", createdAt: iso() };
  if (o.terms) a.terms = o.terms;
  KV.K.set("slpacct:" + email, JSON.stringify(a));
  KV.K.set("slpcode:" + code, email);
}
const allStored = () => [...KV.K.values(), ...[...KV.H.values()].flatMap((m) => [...m.entries()].flat())].map(String);

if (A && F && SU && R.login) {
  const RACHEL = "rachel@brightsteps.org", SAM = "sam@riverside-schools.org";
  seedAcct(RACHEL, "rachel-k4", { clinic: "Bright Steps" });                  // no terms: grandfathered, covered
  seedAcct(SAM, "sam-p2", { name: "Sam P", terms: C.CASELOAD_TERMS });        // the dashboard is open, the caseload is not covered

  // ── the credentials themselves ──
  const users = Array.from({ length: 300 }, () => F.makeUsername());
  ok("a username is a friendly word and four digits", users.every((u) => /^[a-z]+\d{4}$/.test(u) && F.LOGIN_WORDS.includes(u.replace(/\d+$/, ""))), users.slice(0, 4).join(" "));
  ok("…from words that are not common first names", !F.LOGIN_WORDS.some((w) => /^(daisy|iris|jade|robin|ruby|lily|rose|max|leo|river|willow|maple|sky)$/.test(w)), F.LOGIN_WORDS.join());
  const pws = Array.from({ length: 300 }, () => F.makePassword());
  ok("a made password is 8 characters of the family key's unambiguous alphabet, in lower case (no shift key on a phone)",
    F.PASS_ALPHABET === "abcdefghjkmnpqrstuvwxyz23456789" && pws.every((p) => p.length === 8 && [...p].every((ch) => F.PASS_ALPHABET.includes(ch))), pws.slice(0, 3).join(" "));
  ok("…and they do not repeat", new Set(pws).size === pws.length);
  const h = F.hashPassword("k7mpqx2a");
  ok("only a salted scrypt hash is kept", /scryptSync/.test(read("lib/familyLogin.ts")) && h.salt.length >= 16 && h.hash.length >= 32 && h.hash !== F.hashPassword("k7mpqx2a").hash);
  ok("a made password forgives case and spaces as a parent retypes it; one the family chose is exact",
    F.checkPassword("K7MP QX2A", { ...h, own: false }) && F.checkPassword("k7mp-qx2a", { ...h, own: false }) &&
    F.checkPassword("k7mpqx2a", { ...h, own: true }) && !F.checkPassword("K7MPQX2A", { ...h, own: true }) && !F.checkPassword("", { ...h, own: false }));

  // ── the clinician makes a login for a child they added ──
  let r = await call(R.invite, "POST", "/api/slp/invite", { as: RACHEL, body: { label: "MK", sounds: ["S"], pos: "i", repsPerDay: 20 } });
  const tok = r.json && r.json.invite && r.json.invite.token;
  ok("(a child is added: an invite)", r.status === 200 && !!tok, r);
  r = await call(R.slpLogin, "POST", "/api/slp/login", { body: { inv: tok } });
  ok("making a login needs the clinician signed in", r.status === 401, r);
  r = await call(R.slpLogin, "POST", "/api/slp/login", { as: SAM, body: { inv: tok } });
  ok("…and the clinic code comes from the session: another clinician cannot make a login for this invite", r.status === 404, r);
  r = await call(R.slpLogin, "POST", "/api/slp/login", { as: RACHEL, body: { inv: "ABCDEFGHJK99" } });
  ok("…nor for an invite that does not exist", r.status === 404, r);
  r = await call(R.slpLogin, "POST", "/api/slp/login", { as: RACHEL, body: { inv: tok } });
  const made = r.json || {};
  ok("the clinician gets a username and a password, once", r.status === 200 && /^[a-z]+\d{4}$/.test(made.user) && /^[a-z2-9]{8}$/.test(made.password) && made.reset === false, r);
  const rec0 = JSON.parse(KV.K.get("famlogin:" + made.user) || "null");
  ok("the login holds who and what it is for, and nothing about a child",
    !!rec0 && JSON.stringify(Object.keys(rec0).sort()) === JSON.stringify(["changedAt", "cid", "code", "createdAt", "hash", "inv", "own", "owner", "salt", "usedAt", "user", "v"]) &&
    rec0.code === "rachel-k4" && rec0.owner === RACHEL && rec0.inv === tok && rec0.cid === "" && rec0.own === false, rec0);
  ok("the password itself is stored nowhere", !allStored().some((v) => v.includes(made.password)));
  ok("an unused login lives no longer than its invite (30 days)", KV.TTL.get("famlogin:" + made.user) <= 30 * 86400 && KV.TTL.get("famlogin:" + made.user) > 29 * 86400, KV.TTL.get("famlogin:" + made.user));
  ok("the clinician's index ties it to the invite", KV.H.get("famlogins:rachel-k4")?.get("inv:" + tok) === made.user);
  r = await call(R.roster, "GET", "/api/slp", { as: RACHEL });
  const inv0 = (r.json && r.json.invites || []).find((i) => i.token === tok);
  ok("the dashboard lists the login's username with its invite, and never a password, salt or hash",
    !!inv0 && inv0.login && inv0.login.user === made.user && inv0.login.own === false && !/"(password|salt|hash)"/.test(JSON.stringify(r.json)), inv0);

  // ── the family logs in ──
  const before = { code: KV.K.get("slpredeem:rachel-k4"), owner: KV.K.get("slpredeem-owner:" + RACHEL) };
  r = await call(R.login, "POST", "/api/family/login", { body: { username: made.user, password: "wrongpass", childId: "phoneA1" } });
  ok("a wrong password is a plain no", r.status === 200 && r.json.ok === true && r.json.valid === false && !r.json.ticket, r);
  r = await call(R.login, "POST", "/api/family/login", { body: { username: "nobody1234", password: made.password, childId: "phoneA1" } });
  ok("…and an unknown username is the same no", r.status === 200 && r.json.ok === true && r.json.valid === false && Object.keys(r.json).length === 2, r);
  ok("(wrong tries do not count as sign-ups)", KV.K.get("slpredeem:rachel-k4") === before.code);
  r = await call(R.login, "POST", "/api/family/login", { body: { username: " " + made.user.toUpperCase() + " ", password: made.password.toUpperCase().slice(0, 4) + " " + made.password.toUpperCase().slice(4), childId: "phoneA1" } });
  const won = r.json || {};
  ok("the right username and password, typed loosely, connect the family", r.status === 200 && won.valid === true && won.user === made.user && won.code === "RACHEL-K4" && won.name === "Bright Steps", r);
  const tk = A.readTicket(won.ticket, "rachel-k4");
  ok("…with an enrolment ticket for the clinician's code, bound to THIS device's own child id", !!tk && tk.t === "enrol" && tk.cid === "phoneA1", tk);
  ok("…and the invite token, so a yes can claim the clinician's first target", won.inv === tok, won);
  ok("a login counts as a sign-up, on the same two counters as the link",
    KV.K.get("slpredeem:rachel-k4") === String(Number(before.code || 0) + 1) && KV.K.get("slpredeem-owner:" + RACHEL) === String(Number(before.owner || 0) + 1) && KV.TTL.get("slpredeem:rachel-k4") === 400 * 86400, [KV.K.get("slpredeem:rachel-k4"), KV.K.get("slpredeem-owner:" + RACHEL)]);
  const rec1 = JSON.parse(KV.K.get("famlogin:" + made.user));
  ok("a used login lives 400 days from its last use", !!rec1.usedAt && KV.TTL.get("famlogin:" + made.user) === F.LOGIN_TTL && F.LOGIN_TTL === 400 * 86400);

  // ── the walls ──
  for (let i = 0; i < 10; i++) await call(R.login, "POST", "/api/family/login", { body: { username: made.user, password: "nope" + i, childId: "x" } });
  r = await call(R.login, "POST", "/api/family/login", { body: { username: made.user, password: made.password, childId: "x" } });
  ok("ten wrong passwords in an hour lock the username for the hour, even against the right one", r.status === 429 && r.json.valid === false && /Too many tries/.test(r.json.error) && KV.TTL.get("famloginfail:" + made.user) === 3600, r);
  KV.K.delete("famloginfail:" + made.user);
  // the cap: a covered clinician has none; an uncovered one stops at 60, as the link does
  KV.K.set("slpredeem:rachel-k4", "100000");
  r = await call(R.login, "POST", "/api/family/login", { body: { username: made.user, password: made.password, childId: "phoneA1" } });
  ok("a covered clinician's families are never capped", r.status === 200 && r.json.valid === true, r);
  KV.K.set("slpredeem:rachel-k4", "1"); KV.K.set("slpredeem-owner:" + RACHEL, "1");
  r = await call(R.invite, "POST", "/api/slp/invite", { as: SAM, body: { label: "JT", sounds: ["R"], pos: "mix", repsPerDay: 20 } });
  const samTok = r.json.invite.token;
  r = await call(R.slpLogin, "POST", "/api/slp/login", { as: SAM, body: { inv: samTok } });
  const samMade = r.json;
  KV.K.set("slpredeem:sam-p2", "60");
  r = await call(R.login, "POST", "/api/family/login", { body: { username: samMade.user, password: samMade.password, childId: "phoneS1" } });
  ok("an uncovered clinician's 61st sign-up is refused with words that send the family to them",
    r.status === 429 && r.json.error === SU.CAPPED_LOGIN_ERROR && /ask them to contact Sona/.test(r.json.error) && !/new (login|password|link)/i.test(r.json.error), r);
  KV.K.set("slpredeem:sam-p2", "0"); KV.K.delete("slpredeem-owner:" + SAM);
  KV.K.set("slpcode:sam-p2", "someone-else@riverside-schools.org");
  r = await call(R.login, "POST", "/api/family/login", { body: { username: samMade.user, password: samMade.password, childId: "phoneS1" } });
  ok("a login whose clinician no longer holds the code connects nobody", r.status === 200 && r.json.valid === false, r);
  KV.K.set("slpcode:sam-p2", SAM);
  // the redeem route keeps its own copy of the rule: the two must agree
  const redeem = readFileSync(path.join(APP, "app/api/slp/redeem/route.ts"), "latin1");
  ok("the link and the login count against the same cap: the same 60, the same two counters, the same 400 days",
    SU.REDEEM_CAP === Number((redeem.match(/const REDEEM_CAP = (\d+);/) || [])[1]) && SU.SIGNUP_WINDOW_S === 400 * 86400 &&
    /"slpredeem:" \+ code/.test(redeem) && /"slpredeem-owner:"/.test(redeem) && /60 \* 60 \* 24 \* 400/.test(redeem) &&
    /"slpredeem:"/.test(read("lib/signups.ts")) && /"slpredeem-owner:"/.test(read("lib/signups.ts")) && /isCovered \? Infinity : REDEEM_CAP/.test(read("lib/signups.ts")));

  // ── the family says yes: the login becomes the child's ──
  r = await call(R.claim, "POST", "/api/slp/claim", { body: { code: "rachel-k4", ticket: won.ticket, childId: "phoneA1", inv: tok } });
  ok("(a yes claims the invite with the login's ticket)", r.status === 200 && r.json.claimed === true, r);
  const rec2 = JSON.parse(KV.K.get("famlogin:" + made.user));
  ok("the claim moves the login to the child: off the invite, onto the child, 400 days",
    rec2.inv === "" && rec2.cid === "phoneA1" && KV.H.get("famlogins:rachel-k4").get("cid:phoneA1") === made.user && !KV.H.get("famlogins:rachel-k4").has("inv:" + tok) && KV.TTL.get("famlogin:" + made.user) === F.LOGIN_TTL, rec2);
  r = await call(R.login, "POST", "/api/family/login", { body: { username: made.user, password: made.password, childId: "phoneB2" } });
  const tkB = A.readTicket(r.json.ticket, "rachel-k4");
  ok("the same login on a second phone connects it as its own device: its own child id, no invite to claim",
    r.json.valid === true && r.json.inv === "" && tkB && tkB.cid === "phoneB2", r.json);
  r = await call(R.roster, "GET", "/api/slp", { as: RACHEL });
  const kidA = (r.json.kids || []).find((k) => k.childId === "phoneA1");
  ok("the dashboard shows the login on the child it became", kidA && kidA.login && kidA.login.user === made.user && kidA.login.own === false, kidA);

  // ── the family makes the password their own ──
  r = await call(R.password, "POST", "/api/family/password", { body: { username: made.user, password: "wrongpass", newPassword: "our own words" } });
  ok("changing the password needs the current one", r.status === 403 && /current password/.test(r.json.error), r);
  r = await call(R.password, "POST", "/api/family/password", { body: { username: made.user, password: made.password, newPassword: "short" } });
  ok("…and a new one of at least 8 characters", r.status === 400 && /at least 8/.test(r.json.error), r);
  r = await call(R.password, "POST", "/api/family/password", { body: { username: made.user, password: made.password, newPassword: made.user } });
  ok("…that is not the username", r.status === 400, r);
  r = await call(R.password, "POST", "/api/family/password", { body: { username: made.user, password: made.password, newPassword: "Our Own Words 7" } });
  ok("the family changes it", r.status === 200 && r.json.ok === true, r);
  ok("…and now only they know it: the clinician's password no longer works, theirs does, exactly as typed",
    (await call(R.login, "POST", "/api/family/login", { body: { username: made.user, password: made.password, childId: "c" } })).json.valid === false &&
    (await call(R.login, "POST", "/api/family/login", { body: { username: made.user, password: "Our Own Words 7", childId: "c" } })).json.valid === true &&
    (await call(R.login, "POST", "/api/family/login", { body: { username: made.user, password: "our own words 7", childId: "c" } })).json.valid === false);
  ok("the new password is stored nowhere either", !allStored().some((v) => v.includes("Our Own Words 7")));
  r = await call(R.roster, "GET", "/api/slp", { as: RACHEL });
  ok("the dashboard says the family chose their own", (r.json.kids || []).find((k) => k.childId === "phoneA1").login.own === true);

  // ── a forgotten password: the clinician makes a new one ──
  r = await call(R.slpLogin, "POST", "/api/slp/login", { as: RACHEL, body: { childId: "phoneA1" } });
  ok("New password keeps the username and gives a fresh password the clinician knows again",
    r.status === 200 && r.json.user === made.user && r.json.reset === true && r.json.password !== made.password &&
    (await call(R.login, "POST", "/api/family/login", { body: { username: made.user, password: r.json.password, childId: "c" } })).json.valid === true &&
    (await call(R.login, "POST", "/api/family/login", { body: { username: made.user, password: "Our Own Words 7", childId: "c" } })).json.valid === false &&
    JSON.parse(KV.K.get("famlogin:" + made.user)).own === false, r);
  // a child who joined by link has no login, and gets none here (a second phone would be a second child)
  hash("slpmeta:rachel-k4").set("linkkid9", JSON.stringify({ joinedAt: iso() }));
  r = await call(R.slpLogin, "POST", "/api/slp/login", { as: RACHEL, body: { childId: "linkkid9" } });
  ok("a child who joined by link gets no new login from the child page", r.status === 400 && /Logins are made when you add a child/.test(r.json.error), r);

  // ── deletions take the login with them ──
  r = await call(R.child, "DELETE", "/api/slp/child", { as: RACHEL, body: { childId: "phoneA1" } });
  ok("removing the child deletes their login", r.status === 200 && !KV.K.has("famlogin:" + made.user) && !KV.H.get("famlogins:rachel-k4").has("cid:phoneA1"), r);
  r = await call(R.login, "POST", "/api/family/login", { body: { username: made.user, password: "anything8", childId: "c" } });
  ok("…so it no longer connects anyone", r.json.valid === false);
  r = await call(R.invite, "POST", "/api/slp/invite", { as: RACHEL, body: { label: "BB", sounds: [], repsPerDay: 20 } });
  const tok2 = r.json.invite.token;
  const made2 = (await call(R.slpLogin, "POST", "/api/slp/login", { as: RACHEL, body: { inv: tok2 } })).json;
  r = await call(R.invite, "DELETE", "/api/slp/invite", { as: RACHEL, body: { token: tok2 } });
  ok("cancelling an invite deletes the login made for it", r.status === 200 && !KV.K.has("famlogin:" + made2.user) && !KV.H.get("famlogins:rachel-k4").has("inv:" + tok2), r);
  const made3 = (await call(R.slpLogin, "POST", "/api/slp/login", { as: SAM, body: { inv: samTok } })).json;
  r = await call(R.slpLogin, "DELETE", "/api/slp/login", { as: SAM, body: { inv: samTok } });
  ok("Delete login deletes it (and works whatever the clinician pays)", r.status === 200 && !KV.K.has("famlogin:" + made3.user), r);
  r = await call(R.slpLogin, "DELETE", "/api/slp/login", { as: SAM, body: { inv: samTok } });
  ok("…once", r.status === 404, r);

  // ── a slow step in between never writes an old copy back ──
  const bigTries = KV.K.get("famloginfail:" + samMade.user);
  ok("a huge password is turned away before the slow hash, and is not a try",
    (await call(R.login, "POST", "/api/family/login", { body: { username: samMade.user, password: "x".repeat(5000), childId: "c" } })).json.valid === false &&
    KV.K.get("famloginfail:" + samMade.user) === bigTries && /pw\.length > 4 \* OWN_MAX/.test(read("lib/familyLogin.ts")));
  r = await call(R.invite, "POST", "/api/slp/invite", { as: RACHEL, body: { label: "CD", sounds: ["L"], repsPerDay: 20 } });
  const tok4 = r.json.invite.token;
  const made4 = (await call(R.slpLogin, "POST", "/api/slp/login", { as: RACHEL, body: { inv: tok4 } })).json;
  const stale = await F.readLogin(made4.user);
  await F.moveLoginToChild("rachel-k4", tok4, "phoneC3");   // the family's yes lands while a login waits on the cap's check
  await F.markUsed(stale);
  const rec4 = JSON.parse(KV.K.get("famlogin:" + made4.user));
  ok("marking a login used after a claim keeps the claim: it stays the child's", rec4.cid === "phoneC3" && rec4.inv === "" && !!rec4.usedAt, rec4);
  await F.deleteLogin("rachel-k4", { cid: "phoneC3" });
  ok("…and a login deleted in between stays deleted, used or given a new password",
    (await F.markUsed(stale), !KV.K.has("famlogin:" + made4.user)) &&
    (await F.setOwnPassword(stale, "a brand new one")) === false && !KV.K.has("famlogin:" + made4.user));

  // ── ADD A FAMILY (SLPCLEAN1, Travis, 17 Nov 2026: "automatically create a
  //    custom login username password for a parent with their email ...
  //    super easily share"): one step makes the invite, its login and ONE
  //    email to the parent, through GoHighLevel, tagged as the parent invite ──
  {
    const PAT = "pat@newclinic.org";
    seedAcct(PAT, "pat-n1", { name: "Pat N", terms: C.PRO_TERMS });          // made from 12 Nov 2026, no Sona Pro: the dashboard is closed
    process.env.GHL_API_TOKEN = "ghl-test-token"; process.env.GHL_LOCATION_ID = "loc-test";
    const famBody = { parentEmail: "  parent@example.com ", label: "JT", age: "6", sounds: ["r", "S"], child: "Mia", note: "private note", pos: "v", repsPerDay: 90 };
    r = await call(R.family, "POST", "/api/slp/family", { body: famBody });
    ok("Add a family needs the clinician signed in", r.status === 401, r);
    r = await call(R.family, "POST", "/api/slp/family", { as: RACHEL, body: famBody, origin: "https://elsewhere.example" });
    ok("…from the dashboard's own site", r.status === 403, r);
    r = await call(R.family, "POST", "/api/slp/family", { as: PAT, body: famBody });
    ok("…with the dashboard open: a closed dashboard (Sona Pro's, not on) adds no family", r.status === 402 && r.json.needPlan === true, r);
    // SLPPRO1 (17 Nov 2026): the 13 to 17 Nov free-dashboard signups were moved to the trial.
    const FRAN = "fran@freedash.org";
    seedAcct(FRAN, "fran-f1", { name: "Fran", terms: C.FREE_DASHBOARD_TERMS });
    KV.K.set("slpacct:" + FRAN, JSON.stringify({ ...JSON.parse(KV.K.get("slpacct:" + FRAN)), freeDashboard: true }));
    r = await call(R.family, "POST", "/api/slp/family", { as: FRAN, body: famBody });
    ok("…and a free-dashboard signup of 13 to 17 Nov adds none either (moved to the trial)", r.status === 402 && r.json.needPlan === true, r);
    r = await call(R.family, "POST", "/api/slp/family", { as: RACHEL, body: { label: "JT" } });
    ok("…and the parent's email: none, no family", r.status === 400 && /Add the parent's email/.test(r.json.error), r);
    r = await call(R.family, "POST", "/api/slp/family", { as: RACHEL, body: { parentEmail: "not an email" } });
    ok("…a wrong-looking one, no family", r.status === 400 && /doesn't look right/.test(r.json.error), r);
    ok("(nothing was made or sent for any of those)", GHL.length === 0 && !KV.log.some((c) => c.join(" ").includes("parent@example.com")));
    r = await call(R.family, "POST", "/api/slp/family", { as: RACHEL, body: famBody });
    const fam = r.json || {};
    ok("one step: a username and a password, once, and the family's link", r.status === 200 && /^[a-z]+\d{4}$/.test(fam.user) && /^[a-z2-9]{8}$/.test(fam.password) && fam.emailed === true &&
      new RegExp("/join\\.html\\?slp=RACHEL-K4&k=ABCD2345&inv=" + (fam.invite && fam.invite.token) + "$").test(fam.link || ""), r);
    ok("…the child added from the initials, age and sounds alone (a name, a note, a position or a count sent along is ignored)",
      !!fam.invite && fam.invite.label === "JT" && fam.invite.age === "6" && JSON.stringify(fam.invite.sounds) === '["R","S"]' && fam.invite.pos === "mix" && fam.invite.repsPerDay === 20 && fam.invite.note === "" && !("child" in fam.invite), fam.invite);
    const famRec = JSON.parse(KV.K.get("famlogin:" + fam.user) || "null");
    ok("…the login made for that invite, living no longer than it", !!famRec && famRec.inv === fam.invite.token && famRec.code === "rachel-k4" && KV.H.get("famlogins:rachel-k4")?.get("inv:" + fam.invite.token) === fam.user &&
      KV.TTL.get("famlogin:" + fam.user) <= 30 * 86400 && KV.TTL.get("famlogin:" + fam.user) > 29 * 86400, famRec);
    ok("…the password stored nowhere, only its hash", !allStored().some((v) => v.includes(fam.password)));
    ok("…and the parent's address and the child's name stored nowhere, in no store command", !allStored().some((v) => /parent@example\.com|Mia|private note/.test(v)) && !KV.log.some((c) => /parent@example\.com|Mia/.test(c.join(" "))));
    const upsert = GHL.filter((g) => g.path === "/contacts/upsert"), sentMsg = GHL.filter((g) => g.path === "/conversations/messages");
    ok("ONE email, through GoHighLevel, to the parent, tagged as the parent invite", upsert.length === 1 && sentMsg.length === 1 && upsert[0].body.email === "parent@example.com" &&
      JSON.stringify(upsert[0].body.tags) === '["sona-parent-invite"]' && sentMsg[0].body.emailTo === "parent@example.com", GHL);
    const mail = sentMsg[0] ? sentMsg[0].body : {};
    const both = String(mail.message || "") + "\n" + String(mail.html || "");
    ok("…with the App Store link, Open Sona and tap Log in, the username, the password and the web link",
      both.includes("https://apps.apple.com/us/app/sona-speech/id6785755867") && /Open Sona and tap Log in/.test(mail.message) && mail.message.includes("Username: " + fam.user) &&
      mail.message.includes("Password: " + fam.password) && mail.message.includes(fam.link) && /Rachel K set up Sona for your family/.test(mail.subject), mail.message);
    ok("…saying how to change the password, and the free version (Premium only because this caseload is covered)",
      /change the password in Sona's Settings, under Your login/.test(mail.message) && /daily practice and free games/.test(mail.message) && /Premium is included, on Rachel K\./.test(mail.message), mail.message);
    ok("…and nothing about the child: no initials, no name, no sound", !/\bJT\b|Mia|\bR\b sound|private note/.test(both), both.slice(0, 400));
    r = await call(R.login, "POST", "/api/family/login", { body: { username: fam.user, password: fam.password, childId: "phoneF1" } });
    ok("the emailed login connects the family, with the invite to claim on their yes", r.status === 200 && r.json.valid === true && r.json.inv === fam.invite.token, r);
    // the daily cap, shared with the invite's email: the login is made, the email is not sent
    GHL.length = 0;
    KV.K.set("slpinvmail:" + SAM + ":" + new Date().toISOString().slice(0, 10), "30");
    r = await call(R.family, "POST", "/api/slp/family", { as: SAM, body: { parentEmail: "other@example.com" } });
    ok("past the 30-a-day parent email cap: the login is still made, and the reply says the email did not go", r.status === 200 && !!r.json.user && r.json.emailed === false && /30 emails today, the daily limit/.test(r.json.emailError) && GHL.length === 0, r);
    ok("…with no initials given, the waiting family is called New family", r.json.invite && r.json.invite.label === "New family", r.json.invite);
    KV.K.delete("slpinvmail:" + SAM + ":" + new Date().toISOString().slice(0, 10));
    r = await call(R.family, "POST", "/api/slp/family", { as: SAM, body: { parentEmail: "third@example.com" } });
    const samMail = GHL.find((g) => g.path === "/conversations/messages");
    ok("an uncovered caseload's email promises the free version and no Premium", r.status === 200 && !!samMail && /daily practice and free games/.test(samMail.body.message) && !/Premium/.test(samMail.body.message), samMail && samMail.body.message);
    // SONA CLINIC (17 Nov 2026): a clinician who JOINED a live Clinic plan has
    // everything a Sona Pro clinician has, Add a family and its Premium line
    // included. The owner's plan is the mirror (no Stripe here: the last
    // answer stands), and the membership is both team keys agreeing.
    const OWNER = "olivia@brightsteps.example", MEMBER = "zoe@brightsteps.example";
    seedAcct(OWNER, "olivia-k4", { name: "Olivia", terms: C.PRO_TERMS });
    seedAcct(MEMBER, "zoe-k4", { name: "Zoe A", terms: C.PRO_TERMS });
    const clinicMirror = JSON.stringify({ sub: "sub_clinic1", customer: "cus_olivia", status: "active", periodEnd: Math.floor(Date.now() / 1000) + 30 * 86400, cancelAtPeriodEnd: false, checkedAt: Date.now() });
    GHL.length = 0;
    KV.K.set("slpteam-of:" + MEMBER, OWNER);
    hash("slpteam:" + OWNER).set(MEMBER, JSON.stringify({ state: "invited", addedAt: iso() }));
    KV.K.set("slpplan-clinic:" + OWNER, clinicMirror);
    r = await call(R.family, "POST", "/api/slp/family", { as: MEMBER, body: { parentEmail: "fourth@example.com" } });
    ok("a clinician only INVITED to a Sona Clinic plan adds no family (402)", r.status === 402 && r.json.needPlan === true && GHL.length === 0, r);
    hash("slpteam:" + OWNER).set(MEMBER, JSON.stringify({ state: "active", addedAt: iso(), acceptedAt: iso() }));
    r = await call(R.family, "POST", "/api/slp/family", { as: MEMBER, body: { parentEmail: "fourth@example.com" } });
    const zoeMail = GHL.find((g) => g.path === "/conversations/messages");
    ok("a clinician who JOINED a live Sona Clinic plan adds a family, and the email carries Premium (her caseload is covered)",
      r.status === 200 && !!r.json.user && r.json.emailed === true && !!zoeMail && /Premium is included, on Zoe A\./.test(zoeMail.body.message), r);
    KV.K.set("slpplan-clinic:" + OWNER, JSON.stringify({ ...JSON.parse(clinicMirror), status: "canceled" }));
    r = await call(R.family, "POST", "/api/slp/family", { as: MEMBER, body: { parentEmail: "fifth@example.com" } });
    ok("…and once the owner's plan has ended, she adds none (402)", r.status === 402 && r.json.needPlan === true, r);
    delete process.env.GHL_API_TOKEN; delete process.env.GHL_LOCATION_ID;
    const famSrc = noComments(read("app/api/slp/family/route.ts"));
    const at = (t) => famSrc.indexOf(t);
    ok("the route keeps every wall, in order, and never logs or takes the clinic code from the body",
      at("liveSession(readSession(req))") > 0 && at("foreignOrigin(req)") > at("liveSession(") && at('key: "slpinvite"') > at("foreignOrigin(") && at('key: "slplogin"') > at('key: "slpinvite"') &&
      at("dashboardGate(") > at('key: "slplogin"') && at("createInvite(") > at("dashboardGate(") && at("makeLogin(") > at("createInvite(") && at('bumpDaily("slpinvmail"') > at("makeLogin(") &&
      at("sendFamilyLoginEmail(") > at('bumpDaily("slpinvmail"') && !/console\.(log|error|warn)/.test(famSrc) && !/body\.code|searchParams/.test(famSrc) && !REGISTER.test(famSrc));
  }

  // ── what the code may never do ──
  ok("no password or hash reaches a log", !ERRS.some((e) => /k7mp|Our Own Words|"hash"|"salt"/.test(e)), ERRS.slice(0, 3));
  const srcs = ["lib/familyLogin.ts", "lib/signups.ts", "app/api/family/login/route.ts", "app/api/family/password/route.ts", "app/api/slp/login/route.ts"].map((f) => noComments(read(f)));
  ok("the new routes never log, and never take the clinic code from the request body",
    srcs.every((s) => !/console\.(log|error|warn)/.test(s)) && !/body\.code|searchParams/.test(srcs[4]) && /readSession\(req\)/.test(srcs[4]));
  ok("the login route mints a ticket only after the password and the cap", (() => { const s = srcs[2]; return s.indexOf("signTicket(") > s.indexOf("verifyLogin(") && s.indexOf("signTicket(") > s.indexOf("countSignup("); })());
  ok("no evaluation words in the new server code", srcs.every((s) => !REGISTER.test(s)));
}
console.error = realErr;

// ═════════════════════════ parts 2 and 3: the pages ═════════════════════════
const PORT = 8411, BASE = "http://127.0.0.1:" + PORT;
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", webp: "image/webp", woff2: "font/woff2", json: "application/json", webmanifest: "application/manifest+json", wav: "audio/wav", mp3: "audio/mpeg" };
const GOOD = { user: "otter4827", password: "k7mpqx2a" };
const APP_STORE_URL = "https://apps.apple.com/us/app/sona-speech/id6785755867";
let posts = [];
// the dashboard's data: slptest's own fixture, plus a login on one child and one invite
const slpSrc = read("tests/slptest.mjs");
const fixture = () => runInNewContext(slpSrc.slice(slpSrc.indexOf("const day ="), slpSrc.indexOf("// ── mock API:")) + "\nfixture();", { Date });
let DATA = fixture();
const ACCOUNT = { ok: true, email: "rachel@example.com", code: "rachel-k4", familyKey: "ABCD2345", name: "Rachel K", clinic: "Bright Steps", onboarded: true };
const server = createServer((req, res) => {
  const url = new URL(req.url, BASE); let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let j = {}; try { j = JSON.parse(body || "{}"); } catch {}
    const json = (v, status = 200) => { res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(v)); };
    if (url.pathname.startsWith("/api/")) {
      if (req.method !== "GET") posts.push({ path: url.pathname, method: req.method, body: j });
      if (url.pathname === "/api/family/login") {
        if (j.username === "locked1234") return json({ ok: false, valid: false, error: "Too many tries. Wait an hour, or ask your speech therapist for a new password." }, 429);
        const good = String(j.username || "").trim().toLowerCase() === GOOD.user && String(j.password || "").toLowerCase().replace(/[\s-]/g, "") === GOOD.password;
        return json(good ? { ok: true, valid: true, user: GOOD.user, code: "RACHEL-K4", name: "Rachel K", ticket: "TICKET:rachel-k4:" + j.childId, inv: "ABCDEFGHJK23" } : { ok: true, valid: false });
      }
      if (url.pathname === "/api/family/password") {
        if (j.password !== GOOD.password) return json({ ok: false, error: "That current password isn't right." }, 403);
        if (String(j.newPassword || "").length < 8) return json({ ok: false, error: "Use at least 8 characters." }, 400);
        return json({ ok: true });
      }
      if (url.pathname === "/api/slp/covered") return json({ ok: true, covered: true });
      if (url.pathname === "/api/slp/claim") return json({ ok: true, claimed: true, sounds: ["S"], pos: "i" });
      if (url.pathname === "/api/slp/auth/me" || url.pathname === "/api/slp/account") return json(ACCOUNT);
      if (url.pathname === "/api/slp" && req.method === "GET") return json({ ok: true, configured: true, kids: DATA.kids, invites: DATA.invites });
      if (url.pathname === "/api/slp/invite" && req.method === "POST") {
        const invite = { token: "NEWINVITE234", label: j.label, age: j.age || "", sounds: j.sounds || [], pos: j.pos || "mix", repsPerDay: j.repsPerDay || 20, note: "", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() };
        DATA.invites = [invite, ...DATA.invites];
        return json({ ok: true, invite, link: BASE + "/join.html?slp=RACHEL-K4&k=ABCD2345&inv=NEWINVITE234", emailed: false });
      }
      if (url.pathname === "/api/slp/login" && req.method === "POST") return json({ ok: true, user: j.childId ? "comet5150" : GOOD.user, password: GOOD.password, reset: !!j.childId });
      if (url.pathname === "/api/slp/login" && req.method === "DELETE") return json({ ok: true, removed: true });
      return json({ ok: true });
    }
    const file = path.join(PUB, url.pathname === "/" ? "/index.html" : url.pathname);
    if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
const browser = await chromium.launch(launchOpts());
const sent = (p) => posts.filter((x) => x.path === p);

async function family(o = {}) {
  const context = await browser.newContext({ viewport: o.viewport || { width: 390, height: 844 }, reducedMotion: "reduce", deviceScaleFactor: 2 });
  await context.addInitScript((seed) => {
    // Settings sits behind the grown-ups check (Sona.gateOk): a grown-up has answered it
    if (seed.gate) sessionStorage.setItem("sona.gate.v1", String(Date.now()));
    if (sessionStorage.getItem("__seeded")) return; sessionStorage.setItem("__seeded", "1");
    localStorage.setItem("sona.profile.v1", JSON.stringify(Object.assign({ voiceOn: false, soundOn: false, volume: 0.7 }, seed.profile || {})));
    for (const [k, v] of Object.entries(seed.ls || {})) localStorage.setItem(k, v);
  }, o);
  // destinations past the flow are stubs: nothing here plays a game or opens a mic
  await context.route("**/today.html", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>Home</p>" }));
  const page = await context.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page, errors };
}
async function section(name, fn) { posts = []; DATA = fixture(); try { await fn(); } catch (e) { ok(name + " completes", false, String(e && e.stack || e).slice(0, 400)); } }
const box = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom, right: r.right, shown: !e.hidden && getComputedStyle(e).display !== "none" && r.height > 0 }; }, sel);

try {
  // ── the first screen: Log in ──
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await section("the hello at " + viewport.width, async () => {
      const { context, page, errors } = await family({ viewport });
      await page.goto(BASE + "/onboarding.html");
      await page.waitForFunction(() => document.body.dataset.setupScreen === "welcome");
      await page.waitForTimeout(150);
      const tag = viewport.width + "x" + viewport.height + ": ";
      const link = await box(page, "#loginLink"), btn = await box(page, "#nextBtn"), art = await box(page, ".studio-welcome-art");
      const words = await page.evaluate(() => [".studio-kicker", ".welcome-brand"].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; }));
      const clear = (a, b) => a.right <= b.x + 0.5 || b.right <= a.x + 0.5 || a.bottom <= b.y + 0.5 || b.bottom <= a.y + 0.5;
      ok(tag + "the first screen offers Log in, at the top right, opening the login form",
        !!link && link.shown && (await page.locator("#loginLink").textContent()).trim() === "Log in" &&
        (await page.locator("#loginLink").getAttribute("href")) === "/join.html?login=1" &&
        link.y < art.y && link.right <= viewport.width + 0.5 && link.right >= viewport.width - 40, { link, art });
      ok(tag + "…a full touch target, on screen, over none of the hello's words, with nothing to scroll",
        link.h >= 44 && link.w >= 44 && link.y >= -0.5 && words.every((w) => clear(link, w)) && art.bottom <= btn.y + 0.5 &&
        await page.evaluate(() => { const ob = document.querySelector(".ob"); return ob.scrollHeight <= ob.clientHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }), { link, words, art, btn });
      ok(tag + "…and the hello is still one message with no question", (await page.locator('[data-step="welcome"]').innerText()).indexOf("?") < 0 && (await page.locator("#nextBtn").textContent()) === "Get started");
      await page.locator("#nextBtn").click();
      await page.waitForFunction(() => document.body.dataset.setupScreen === "name");
      ok(tag + "Log in belongs to the hello only", await page.locator("#loginLink").isHidden());
      // The footer's button is in the same place on every screen, Log in or
      // not, so a double tap on it moves one screen (onboardingtest).
      const btn2 = await box(page, "#nextBtn");
      ok(tag + "…and Get started sits at the height of the next screen's button (Back takes its left there): Log in moves nothing", Math.abs(btn2.y - btn.y) < 1 && Math.abs(btn2.bottom - btn.bottom) < 1, { btn, btn2 });
      if (viewport.width === 390) { await page.locator("#backBtn").click(); await page.waitForFunction(() => document.body.dataset.setupScreen === "welcome"); await page.screenshot({ path: path.join(OUT, "sona-login-hello.png") }); }
      ok(tag + "no page errors", errors.length === 0, errors);
      await context.close();
    });
  }
  await section("a connected device", async () => {
    const { context, page } = await family({ ls: { "sona.slpok": "RACHEL-K4", "sona.slpunlock": "1" } });
    await page.goto(BASE + "/onboarding.html");
    await page.waitForFunction(() => document.body.dataset.setupScreen === "welcome");
    ok("a device a speech therapist already connected is not offered Log in again", await page.locator("#loginLink").isHidden());
    await context.close();
  });

  // ── the login form ──
  await section("logging in", async () => {
    const { context, page, errors } = await family();
    await page.goto(BASE + "/onboarding.html");
    await page.waitForFunction(() => document.body.dataset.setupScreen === "welcome");
    await page.locator("#loginLink").click();
    await page.waitForFunction(() => location.pathname === "/join.html" && document.getElementById("jLogin").style.display === "block");
    ok("Log in opens the login form, with the address cleaned at once", (await page.evaluate(() => location.search)) === "" && (await page.locator("#jTitle").textContent()) === "Log in" && await page.locator("#jForm").isHidden());
    ok("…a username box and a password box, with nothing the phone would auto-correct",
      await page.evaluate(() => { const u = document.getElementById("jUser"), p = document.getElementById("jPass"); return u.autocomplete === "username" && u.getAttribute("autocapitalize") === "none" && p.type === "password" && p.autocomplete === "current-password"; }));
    await page.locator("#jUser").fill("otter4827"); await page.locator("#jPass").fill("wrong");
    await page.locator("#jLoginGo").click();
    await page.waitForFunction(() => /don't match/.test(document.getElementById("jLoginStatus").textContent));
    ok("a wrong password says so, and connects nothing", await page.evaluate(() => !localStorage.getItem("sona.slpok") && !localStorage.getItem("sona.login")));
    await page.locator("#jUser").fill(" Otter4827 "); await page.locator("#jPass").fill("K7MP QX2A");
    await page.screenshot({ path: path.join(OUT, "sona-login-form.png") });
    await page.locator("#jLoginGo").click();
    await page.waitForFunction(() => document.getElementById("jConsent").style.display === "block");
    const ls = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
    const loginPost = sent("/api/family/login").slice(-1)[0];
    const cid = JSON.parse(ls["sona.pilot.v1"] || "{}").childId;
    ok("the right login connects this device as the clinician's link would", ls["sona.slpok"] === "RACHEL-K4" && ls["sona.slpunlock"] === "1" && ls["sona.slp"] === "RACHEL-K4" && /^TICKET:rachel-k4:/.test(ls["sona.slpticket"] || ""), ls);
    ok("…with the ticket asked for THIS device's own child id", !!cid && loginPost.body.childId === cid && ls["sona.slpticket"] === "TICKET:rachel-k4:" + cid, { cid, body: loginPost.body });
    ok("…keeps the username for Settings, and the password nowhere on the device", ls["sona.login"] === "otter4827" && !Object.values(ls).some((v) => /k7mp\s*qx2a/i.test(String(v))));
    await page.screenshot({ path: path.join(OUT, "sona-login-share.png") });
    ok("…and then asks the same sharing question, naming the clinician", /Rachel K/.test(await page.locator("#jMsg").textContent()) && await page.locator("#jYes").isVisible() && await page.locator("#jNo").isVisible());
    ok("logging in is not saying yes: nothing is enrolled or claimed before the answer", sent("/api/slp/claim").length === 0 && sent("/api/pilot").length === 0);
    await page.locator("#jYes").click();
    await page.waitForFunction(() => document.getElementById("jEmail").style.display === "block");
    await page.waitForTimeout(300);
    const claim = sent("/api/slp/claim")[0];
    ok("a yes claims the invite the login was made for, with this device's ticket and child id",
      !!claim && claim.body.inv === "ABCDEFGHJK23" && claim.body.code === "RACHEL-K4" && claim.body.childId === cid && claim.body.ticket === "TICKET:rachel-k4:" + cid, claim);
    await page.locator("#jEmailGo").click();
    await page.waitForFunction(() => location.pathname === "/onboarding.html");
    await page.waitForFunction(() => document.body.dataset.setupScreen === "welcome");
    ok("then setup, as after the link, where Log in is no longer offered", await page.locator("#loginLink").isHidden());
    ok("no page errors", errors.length === 0, errors);
    await context.close();
  });
  await section("saying no", async () => {
    const { context, page } = await family();
    await page.goto(BASE + "/join.html?login=1");
    await page.locator("#jUser").fill("otter4827"); await page.locator("#jPass").fill("k7mpqx2a");
    await page.locator("#jPass").press("Enter");
    await page.waitForFunction(() => document.getElementById("jConsent").style.display === "block");
    await page.locator("#jNo").click();
    await page.waitForTimeout(200);
    ok("a logged-in family who says no shares nothing and claims nothing, and keeps the connection",
      sent("/api/slp/claim").length === 0 && await page.evaluate(() => JSON.parse(localStorage.getItem("sona.profile.v1")).slpShare === false && localStorage.getItem("sona.slpok") === "RACHEL-K4"));
    await context.close();
  });
  await section("a locked username", async () => {
    const { context, page } = await family();
    await page.goto(BASE + "/join.html?login=1");
    await page.locator("#jUser").fill("locked1234"); await page.locator("#jPass").fill("whatever1");
    await page.locator("#jLoginGo").click();
    await page.waitForFunction(() => /Too many tries/.test(document.getElementById("jLoginStatus").textContent));
    ok("too many tries is said in the server's words", /ask your speech therapist for a new password/.test(await page.locator("#jLoginStatus").textContent()));
    await context.close();
  });

  // ── Settings: Your login ──
  await section("settings", async () => {
    const profile = { onboarded: true, childName: "Ava", age: "6", sounds: ["S"] };
    let { context, page, errors } = await family({ profile, gate: true });
    await page.goto(BASE + "/settings.html");
    await page.waitForSelector("#acctCard");
    await page.waitForTimeout(300);
    ok("a device that never logged in shows no login card", (await page.locator("#loginCard").count()) === 1 && await page.locator("#loginCard").isHidden());
    await context.close();
    ({ context, page, errors } = await family({ profile, gate: true, ls: { "sona.login": "otter4827", "sona.slpok": "RACHEL-K4" } }));
    await page.goto(BASE + "/settings.html");
    await page.waitForSelector("#loginCard:not([hidden])");
    ok("a logged-in device shows its username, and no password", (await page.locator("#loginUser").textContent()) === "otter4827" && !/k7mp/i.test(await page.locator("#loginCard").innerText()));
    await page.locator("#loginCard").scrollIntoViewIfNeeded();
    await page.locator("#loginChange").click();
    await page.locator("#loginOld").fill("k7mpqx2a"); await page.locator("#loginNew").fill("short");
    await page.locator("#loginSave").click();
    ok("a new password under 8 characters is caught on the page", /at least 8/.test(await page.locator("#loginMsg").textContent()) && sent("/api/family/password").length === 0);
    await page.locator("#loginOld").fill("wrongpass"); await page.locator("#loginNew").fill("our new words");
    await page.locator("#loginSave").click();
    await page.waitForFunction(() => /isn't right/.test(document.getElementById("loginMsg").textContent));
    ok("a wrong current password is the server's answer", true);
    await page.locator("#loginOld").fill("k7mpqx2a");
    await page.locator("#loginSave").click();
    await page.waitForFunction(() => /Password changed/.test(document.getElementById("loginChange").textContent));
    const pw = sent("/api/family/password").slice(-1)[0];
    await page.locator("#loginCard").screenshot({ path: path.join(OUT, "sona-login-settings.png") });
    ok("the family changes it: the username from the device, the current and the new password", pw.body.username === "otter4827" && pw.body.password === "k7mpqx2a" && pw.body.newPassword === "our new words" && await page.locator("#loginBox").isHidden(), pw);
    ok("…and nothing of either password is kept on the device", !(await page.evaluate(() => Object.values(localStorage).some((v) => /k7mpqx2a|our new words/.test(String(v))))));
    ok("settings has no page errors", errors.length === 0, errors);
    await context.close();
  });

  // ── part 3: the dashboard ──
  async function dash(hash, width = 1280) {
    const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 1000 }, deviceScaleFactor: 2 }), page = await context.newPage(), errors = [];
    page.setDefaultTimeout(3000); page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => { window.__copied = []; Object.defineProperty(navigator, "clipboard", { value: { writeText: (s) => (window.__copied.push(s), Promise.resolve()) } }); window.confirm = () => true; });
    await page.goto(BASE + "/slp.html" + hash);
    await page.waitForFunction(() => document.getElementById("sidebarName").textContent === "Rachel K");
    await page.waitForTimeout(150);
    return { context, page, errors };
  }
  await section("make a login when adding a child", async () => {
    for (const width of [1280, 390]) {
      const { context, page, errors } = await dash("#caseload", width);
      const tag = width + "px: ";
      await page.evaluate(() => document.getElementById("clAdd").click());
      await page.waitForSelector("#invComposer", { state: "visible" });
      await page.locator("#invName").fill("MK");
      await page.locator("#invCreate").click();
      await page.waitForSelector("#invResult", { state: "visible" });
      ok(tag + "beside the new child's link: a login for the Sona app", await page.locator("#invMakeLogin").isVisible() && (await page.locator("#invMakeLogin").textContent()) === "Make a login");
      await page.locator("#invMakeLogin").click();
      await page.waitForSelector("#invLoginOut .login-cred");
      const post = sent("/api/slp/login").slice(-1)[0];
      ok(tag + "it asks for a login for exactly that invite", post && post.method === "POST" && JSON.stringify(post.body) === JSON.stringify({ inv: "NEWINVITE234" }), post);
      const panel = await page.locator("#invLoginOut").innerText(), msg = await page.locator("#invLoginOut .login-msg").inputValue();
      ok(tag + "the username and password are shown once, with a ready-to-send message",
        /otter4827/.test(panel) && /k7mpqx2a/.test(panel) && /shows only now/.test(panel) &&
        msg.includes("Username: otter4827") && msg.includes("Password: k7mpqx2a") && /tap Log in on the first screen/.test(msg) && msg.includes(APP_STORE_URL) && /say yes to sharing practice with me/.test(msg), msg);
      ok(tag + "…promising what is true (free, Premium only through a covered caseload), never pilot, trial, forever or unlimited",
        /free for your family/.test(msg) && !/pilot|trial|forever|unlimited/i.test(msg) && !REGISTER.test(msg), msg);
      await page.locator("#invLoginOut [data-copylogin]").click();
      ok(tag + "Copy login message copies that message", (await page.evaluate(() => window.__copied.slice(-1)[0])) === msg);
      ok(tag + "the button becomes New password", (await page.locator("#invMakeLogin").textContent()) === "New password");
      await page.locator("#invResult").screenshot({ path: path.join(OUT, "sona-slp-make-login-" + width + ".png") });
      ok(tag + "nothing spills sideways", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      ok(tag + "no page errors", errors.length === 0, errors);
      await context.close();
    }
  });
  await section("pending invites and the child page", async () => {
    DATA.invites[0].login = { user: "otter4827", own: false, createdAt: new Date().toISOString(), usedAt: "" };
    DATA.invites.push({ ...DATA.invites[0], token: "NOLOGIN23456", label: "JT", login: null });
    DATA.kids[0].login = { user: "comet5150", own: true, createdAt: new Date().toISOString(), usedAt: new Date().toISOString() };
    const { context, page, errors } = await dash("#caseload");
    await page.waitForSelector("#invList [data-login]");
    const rows = await page.locator("#invList .kid").allInnerTexts();
    const withLogin = rows.find((t) => /otter4827/.test(t)) || "", without = rows.find((t) => /JT/.test(t)) || "";
    ok("a waiting child with a login shows its username, New password and Delete login", /Login: otter4827/.test(withLogin) && /New password/.test(withLogin) && /Delete login/.test(withLogin) && !/k7mp/.test(withLogin), withLogin);
    ok("…one without offers Make a login", /Make a login/.test(without) && !/Delete login/.test(without), without);
    await page.locator('#invList [data-login="NOLOGIN23456"]').click();
    await page.waitForSelector('#invList [data-loginout="NOLOGIN23456"] .login-cred');
    ok("Make a login on a waiting child shows its login right there", sent("/api/slp/login").slice(-1)[0].body.inv === "NOLOGIN23456" && /k7mpqx2a/.test(await page.locator('#invList [data-loginout="NOLOGIN23456"]').innerText()));
    await page.locator('#invList [data-unlogin="' + DATA.invites[0].token + '"]').click();
    await page.waitForTimeout(200);
    ok("Delete login deletes that invite's login", sent("/api/slp/login").some((p) => p.method === "DELETE" && p.body.inv === DATA.invites[0].token));
    await page.evaluate((id) => { location.hash = "#child/" + id; }, DATA.kids[0].childId);
    await page.waitForSelector("#chLoginCard:not([hidden])");
    const line = await page.locator("#chLoginLine").innerText();
    ok("a child who joined with a login shows it on their page, and says when the family chose their own password",
      /comet5150/.test(line) && /chose their own password/.test(line) && /its own row/.test(line), line);
    await page.locator("#chLoginNew").click();
    await page.waitForSelector("#chLoginOut .login-cred");
    ok("New password on the child page asks for that child", sent("/api/slp/login").slice(-1)[0].body.childId === DATA.kids[0].childId);
    await page.evaluate((id) => { location.hash = "#child/" + id; }, DATA.kids[1].childId);
    await page.waitForTimeout(250);
    ok("a child without a login shows no login card", await page.locator("#chLoginCard").isHidden());
    const removeWords = await page.evaluate(() => document.getElementById("chRemoveDetails").textContent);
    ok("Remove says the login goes too, and still promises nothing on the device is touched",
      /their Sona login/.test(removeWords) && /stops sending you updates/.test(removeWords) && /keeps its own progress on their device/.test(removeWords), removeWords);
    ok("no page errors", errors.length === 0, errors);
    await context.close();
  });
  await section("the dashboard on a phone's home screen", async () => {
    const m = JSON.parse(read("public/slp.webmanifest"));
    ok("the dashboard has its own manifest: Sona SLP, opening the dashboard, in the browser (the sign-in link opens in Safari)",
      m.start_url === "/slp.html" && m.scope === "/slp" && m.display === "browser" && m.short_name === "Sona SLP" && m.icons.every((i) => existsSync(path.join(PUB, i.src.split("?")[0]))), m);
    for (const f of ["public/slp.html", "public/slp-login.html"]) {
      const s = noComments(read(f));
      ok(f + " uses it, with a home-screen icon, and never the full-screen switch",
        /<link rel="manifest" href="\/slp\.webmanifest"/.test(s) && !/href="\/manifest\.webmanifest"/.test(s) && /rel="apple-touch-icon"/.test(s) && !/apple-mobile-web-app-capable/.test(s));
    }
    ok("the family app keeps its own manifest, opening Home", JSON.parse(read("public/manifest.webmanifest")).start_url === "/today.html");
  });
  const loginCode = (noComments(read("public/slp.html")).match(/function loginMsg[\s\S]*?var LAST_INV/) || [""])[0];
  ok("the new copy on the dashboard uses no evaluation words", loginCode.length > 500 && !REGISTER.test(loginCode), loginCode.length);
  ok("the suite is registered in run-all", /"familylogintest\.mjs"/.test(read("tests/run-all.mjs")));
} finally {
  await browser.close();
  server.close();
}
console.log(checks + " checks; " + fails + " failures");
process.exit(fails ? 1 : 0);
