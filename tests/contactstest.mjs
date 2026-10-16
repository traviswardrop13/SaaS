// CONTACTS1: the email list is Resend's contacts (Travis, 16 Oct 2026: "I am
// done using Kit. I'm going to be using Resend", and "every new email goes
// into like a resend contact list"). Played against a fake Resend, a fake
// Kit and an in-memory store: every grown-up's email lands in the right
// segment, nobody is ever re-subscribed, unsubscribes travel both ways,
// Kit's leavers are copied before any older address is added, and nothing
// about a child reaches Resend.
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0, passes = 0;
const ok = (name, cond, info) => {
  if (cond) { passes++; console.log("PASS " + name); }
  else { fails++; console.log("FAIL " + name + (info === undefined ? "" : "  → " + JSON.stringify(info))); }
};
const read = (f) => readFileSync(path.join(REPO, f), "utf8");

// ── the store: the commands lib/contacts and lib/report use ──
function store() {
  const kv = new Map(), sets = new Map(), hashes = new Map();
  const set = (k) => { if (!sets.has(k)) sets.set(k, new Set()); return sets.get(k); };
  const db = {
    kv, sets, hashes, down: false, log: [],
    cmd: async (c) => {
      db.log.push(c);
      if (db.down) return undefined;
      const [op, k, ...a] = c;
      if (op === "GET") return kv.has(k) ? kv.get(k) : null;
      if (op === "SET") { kv.set(k, String(a[0])); return "OK"; }
      if (op === "DEL") { const had = kv.delete(k) || hashes.delete(k) || sets.delete(k); return had ? 1 : 0; }
      if (op === "SISMEMBER") return set(k).has(String(a[0])) ? 1 : 0;
      if (op === "SADD") { let n = 0; for (const v of a) if (!set(k).has(String(v))) { set(k).add(String(v)); n++; } return n; }
      if (op === "SREM") { let n = 0; for (const v of a) if (set(k).delete(String(v))) n++; return n; }
      if (op === "SMEMBERS") return [...set(k)];
      if (op === "HGETALL") { const h = hashes.get(k) || {}; return Object.entries(h).flat(); }
      if (op === "HSET") { const h = hashes.get(k) || {}; for (let i = 0; i + 1 < a.length; i += 2) h[a[i]] = String(a[i + 1]); hashes.set(k, h); return 1; }
      throw new Error("unexpected " + op);
    },
  };
  return db;
}

// ── a fake Resend: contacts, segments and properties ──
function fakeResend() {
  const R = {
    contacts: new Map(), segments: [], props: [], calls: [], next: 1,
    exists: 409,          // the status Resend answers when the address is already a contact
    fail: new Map(),      // "METHOD /path-prefix" → status to answer once
    key: "re_full",
  };
  const res = (status, obj) => new Response(obj === undefined ? "" : JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
  R.fetch = async (url, init = {}) => {
    const u = new URL(String(url)), method = init.method || "GET", body = init.body ? JSON.parse(init.body) : undefined;
    if (u.host !== "api.resend.com") throw new Error("not Resend: " + url);
    R.calls.push({ method, path: u.pathname, query: u.search, body, auth: init.headers && init.headers.Authorization });
    for (const [k, st] of R.fail) {
      const [m, p] = k.split(" ");
      if (m === method && u.pathname.startsWith(p)) { R.fail.delete(k); return res(st, { message: "planned " + st }); }
    }
    if ((init.headers && init.headers.Authorization) !== "Bearer " + R.key) return res(401, { name: "restricted_api_key", message: "This API key is restricted to only send emails" });
    const page = (rows) => {
      const limit = Number(u.searchParams.get("limit") || 20), after = u.searchParams.get("after");
      const from = after ? rows.findIndex((r) => r.id === after) + 1 : 0;
      const data = rows.slice(from, from + limit);
      return res(200, { object: "list", data, has_more: from + limit < rows.length });
    };
    let m;
    if (u.pathname === "/segments" && method === "GET") return page(R.segments);
    if (u.pathname === "/segments" && method === "POST") { const s = { id: "seg_" + R.next++, name: body.name }; R.segments.push(s); return res(201, { object: "segment", id: s.id }); }
    if (u.pathname === "/contact-properties" && method === "GET") return page(R.props);
    if (u.pathname === "/contact-properties" && method === "POST") { R.props.push({ id: "prop_" + R.next++, key: body.key, type: body.type }); return res(201, {}); }
    if (u.pathname === "/contacts" && method === "GET") return page([...R.contacts.values()]);
    if (u.pathname === "/contacts" && method === "POST") {
      if (R.contacts.has(body.email)) return res(R.exists, { name: "validation_error", message: "Contact already exists" });
      for (const s of body.segments || []) if (!R.segments.some((x) => x.id === s.id)) return res(422, { message: "Segment not found" });
      const c = { id: "ct_" + R.next++, email: body.email, first_name: body.first_name || null, unsubscribed: body.unsubscribed === true, properties: { ...(body.properties || {}) }, segs: new Set((body.segments || []).map((s) => s.id)) };
      R.contacts.set(body.email, c);
      return res(201, { object: "contact", id: c.id });
    }
    if ((m = u.pathname.match(/^\/contacts\/([^/]+)\/segments\/([^/]+)$/)) && method === "POST") {
      const c = R.contacts.get(decodeURIComponent(m[1]));
      if (!c) return res(404, { message: "Contact not found" });
      if (!R.segments.some((x) => x.id === decodeURIComponent(m[2]))) return res(404, { message: "Segment not found" });
      c.segs.add(decodeURIComponent(m[2]));
      return res(201, {});
    }
    if ((m = u.pathname.match(/^\/contacts\/([^/]+)$/))) {
      const c = R.contacts.get(decodeURIComponent(m[1]));
      if (!c) return res(404, { message: "Contact not found" });
      if (method === "GET") return res(200, { object: "contact", ...c, segs: undefined });
      if (method === "PATCH") {
        if ("unsubscribed" in body) c.unsubscribed = body.unsubscribed;
        if (body.properties) Object.assign(c.properties, body.properties);
        return res(200, { object: "contact", id: c.id });
      }
    }
    return res(404, { message: "no route " + method + " " + u.pathname });
  };
  R.segOf = (name) => (R.segments.find((s) => s.name === name) || {}).id;
  R.inSeg = (email, name) => { const c = R.contacts.get(email); return !!c && c.segs.has(R.segOf(name)); };
  return R;
}

// ── a fake Kit v4: subscribers by status, paged ──
function fakeKit(byStatus) {
  const K = { calls: [], down: new Set() };
  K.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    K.calls.push({ path: u.pathname, query: Object.fromEntries(u.searchParams), key: init.headers && init.headers["X-Kit-Api-Key"] });
    const status = u.searchParams.get("status");
    if (K.down.has(status)) return new Response("{}", { status: 503 });
    const rows = byStatus[status] || [], per = 2, after = Number(u.searchParams.get("after") || 0);
    const slice = rows.slice(after, after + per);
    const more = after + per < rows.length;
    return new Response(JSON.stringify({ subscribers: slice, pagination: { has_next_page: more, end_cursor: more ? String(after + per) : null, per_page: per } }), { status: 200 });
  };
  return K;
}

// ── load lib/contacts.ts and lib/report.ts, with the store's door stubbed ──
let currentKv = async () => null;
const stubs = {
  "@/lib/slpAuth": { kvCmd: (c) => currentKv(c), kvConfigured: () => true, leadSig: () => "x" },
  "@/lib/founder": { readLeads: async () => founderLeads, readClinicians: async () => founderSlps },
};
let founderLeads = [], founderSlps = [];
const cache = new Map();
function loadTs(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const req = (s) => stubs[s] || (s.startsWith("@/") ? loadTs(path.join(REPO, s.slice(2) + ".ts")) : s === "next/server" ? require(path.join(REPO, "node_modules/next/server")) : require(s));
  new Function("require", "module", "exports", js)(req, mod, mod.exports);
  return mod.exports;
}
const C = loadTs(path.join(REPO, "lib/contacts.ts"));

const sleeps = [];
const ioFor = (db, f) => ({ kv: db.cmd, f, sleep: async (ms) => { sleeps.push(ms); } });
const fresh = () => { const db = store(), R = fakeResend(); return { db, R, io: ioFor(db, R.fetch) }; };
const noUnsubFalse = (R) => R.calls.every((c) => !(c.body && c.body.unsubscribed === false));

process.env.RESEND_API_KEY = "re_full";
delete process.env.KIT_API_KEY;

// ── not configured: nothing is called ──
{
  const { R, io } = fresh();
  delete process.env.RESEND_API_KEY;
  const r = await C.upsertContact({ email: "mom@example.com", role: "parent" }, io);
  ok("with no Resend key, the list is simply not configured — nothing is called", !C.contactsConfigured() && r.ok === false && r.detail === "not configured" && R.calls.length === 0);
  process.env.RESEND_API_KEY = "re_full";
}

// ── one grown-up at a time ──
{
  const { db, R, io } = fresh();
  const r1 = await C.upsertContact({ email: " Mom@Example.com ", role: "parent", source: "parents", firstName: "Milo" }, io);
  const c1 = R.contacts.get("mom@example.com");
  ok("a parent becomes a contact: the address, lower-cased, in Parents", r1.ok && r1.detail === "added" && !!c1 && R.inSeg("mom@example.com", "Parents"), [r1, c1]);
  ok("…with no name at all: a parent's lead only ever carries a child's, so none goes", !!c1 && c1.first_name === null && !R.calls.some((c) => c.body && "first_name" in c.body));
  ok("…its role and where it was given as properties, and no plan", !!c1 && JSON.stringify(c1.properties) === JSON.stringify({ role: "parent", source: "parents" }), c1 && c1.properties);
  ok("…subscribed (never a word about it unless they left)", !!c1 && c1.unsubscribed === false && !("unsubscribed" in R.calls.find((c) => c.method === "POST" && c.path === "/contacts").body));
  ok("the four segments and three properties are made the first time, by name",
    JSON.stringify(R.segments.map((s) => s.name).sort()) === JSON.stringify(["Other", "Parents", "Speech therapists", "Started Premium"]) &&
    JSON.stringify(R.props.map((p) => p.key).sort()) === JSON.stringify(["plan", "role", "source"]) && R.props.every((p) => p.type === "string"));
  ok("…and the address is marked as in the list", db.sets.get(C.SYNCED).has("mom@example.com"));
  const n = R.calls.length;
  await C.upsertContact({ email: "sam@clinic.org", role: "slp", source: "for-slps", firstName: " Sam " }, io);
  ok("the second one uses the kept segment ids: one call, no lookups", R.calls.length === n + 1 && R.calls[n].path === "/contacts", R.calls.slice(n).map((c) => c.path));
  ok("a clinician goes with their own first name, in Speech therapists", R.contacts.get("sam@clinic.org").first_name === "Sam" && R.inSeg("sam@clinic.org", "Speech therapists"));
  await C.upsertContact({ email: "pat@example.com", role: "other" }, io);
  await C.upsertContact({ email: "check@example.com" }, io);
  ok("'Other' is Other; a lead with no role (the Speech Check) is a parent",
    R.inSeg("pat@example.com", "Other") && R.inSeg("check@example.com", "Parents") && !R.inSeg("pat@example.com", "Parents"));
  await C.upsertContact({ email: "buyer@example.com", role: "parent", source: "app-trial", plan: "trial" }, io);
  ok("a parent who started the free days: Parents AND Started Premium, plan trial",
    R.inSeg("buyer@example.com", "Parents") && R.inSeg("buyer@example.com", "Started Premium") && R.contacts.get("buyer@example.com").properties.plan === "trial");
  await C.upsertContact({ email: "odd@example.com", role: "parent", plan: "yearly" }, io);
  ok("…and only the words trial and paid are a plan", !R.inSeg("odd@example.com", "Started Premium") && !("plan" in R.contacts.get("odd@example.com").properties));

  // already a contact: the plan and the segment are added, nothing is lost
  const m = R.calls.length;
  const r2 = await C.upsertContact({ email: "mom@example.com", role: "parent", source: "app-paid", plan: "paid" }, io);
  const c2 = R.contacts.get("mom@example.com");
  ok("someone Resend already has: updated with the plan and Started Premium", r2.ok && /^updated/.test(r2.detail) && c2.properties.plan === "paid" && R.inSeg("mom@example.com", "Started Premium") && R.inSeg("mom@example.com", "Parents"), [r2, c2.properties]);
  ok("…without overwriting where they first came from", c2.properties.source === "parents");
  const patch = R.calls.slice(m).find((c) => c.method === "PATCH");
  ok("…and the update carries the plan alone: never a name, never 'subscribed'", !!patch && JSON.stringify(patch.body) === JSON.stringify({ properties: { plan: "paid" } }), patch && patch.body);
  for (const st of [422, 400]) {
    const { R: R2, io: io2 } = fresh();
    R2.exists = st;
    await C.upsertContact({ email: "a@example.com", role: "parent" }, io2);
    const r = await C.upsertContact({ email: "a@example.com", role: "parent" }, io2);
    ok(`…whatever status Resend says "already a contact" with (${st}), it reads as in the list`, r.ok && r.detail === "updated" && R2.calls.some((c) => c.method === "GET" && c.path === "/contacts/a%40example.com"), r);
  }
  ok("no call anywhere ever sets unsubscribed to false", noUnsubFalse(R));
  ok("an address that is not one is refused before any call", !(await C.upsertContact({ email: "not-an-email" }, io)).ok && !(await C.upsertContact({ email: "a@b.c".padStart(300, "x") }, io)).ok);
}

// ── unsubscribes: Sona's list → Resend ──
{
  const { db, R, io } = fresh();
  await db.cmd(["SADD", "email:unsub", "gone@example.com", "johndoe@gmail.com"]);
  await C.upsertContact({ email: "gone@example.com", role: "parent" }, io);
  await C.upsertContact({ email: "John.Doe+sona@gmail.com", role: "parent" }, io);
  ok("someone who unsubscribed from Sona is added unsubscribed (so a broadcast skips them)",
    R.contacts.get("gone@example.com").unsubscribed === true && R.contacts.get("john.doe+sona@gmail.com").unsubscribed === true);
  R.contacts.set("late@example.com", { id: "ct_x", email: "late@example.com", unsubscribed: false, properties: {}, segs: new Set() });
  await db.cmd(["SADD", "email:unsub", "late@example.com"]);
  await C.upsertContact({ email: "late@example.com", role: "parent" }, io);
  ok("…and one Resend already had is switched to unsubscribed", R.contacts.get("late@example.com").unsubscribed === true);
  ok("…never the other way: still no call sets unsubscribed to false", noUnsubFalse(R));
  const before = R.calls.length;
  db.down = true;
  const r = await C.upsertContact({ email: "new@example.com", role: "parent" }, io);
  db.down = false;
  ok("the store not answering: nobody is added as subscribed on a guess, and Resend is not called", !r.ok && r.detail === "store did not answer" && R.calls.length === before, r);

  // Sona's unsubscribe link
  R.contacts.set("leave@example.com", { id: "ct_l", email: "leave@example.com", unsubscribed: false, properties: {}, segs: new Set() });
  ok("Sona's own unsubscribe link unsubscribes the contact in Resend", (await C.markUnsubscribed("Leave@Example.com", io)) && R.contacts.get("leave@example.com").unsubscribed === true);
  R.contacts.set("janedoe@gmail.com", { id: "ct_j", email: "janedoe@gmail.com", unsubscribed: false, properties: {}, segs: new Set() });
  await C.markUnsubscribed("jane.doe@gmail.com", io);
  ok("…and the plain mailbox's contact too (another spelling of the same Gmail inbox)", R.contacts.get("janedoe@gmail.com").unsubscribed === true);
  ok("…a contact Resend does not have yet is fine (it will be made unsubscribed)", await C.markUnsubscribed("nobody@example.com", io));
  R.fail.set("PATCH /contacts/", 500);
  ok("…and when Resend does not answer, the unsubscribe is owed", !(await C.markUnsubscribed("owed@example.com", io)) && db.sets.get(C.UNSUB_OWED).has("owed@example.com"));
  R.contacts.set("owed@example.com", { id: "ct_o", email: "owed@example.com", unsubscribed: false, properties: {}, segs: new Set() });
  process.env.KIT_API_KEY = "";
  const s = await C.syncContacts({ people: async () => [] }, io);
  ok("…and the daily run pays it", R.contacts.get("owed@example.com").unsubscribed === true && !db.sets.get(C.UNSUB_OWED).has("owed@example.com"), s);
}

// ── unsubscribes: Resend → Sona's list ──
{
  const { db, R, io } = fresh();
  for (let i = 0; i < 230; i++) R.contacts.set(`p${i}@example.com`, { id: "ct_" + i, email: `p${i}@example.com`, unsubscribed: i % 50 === 7, properties: {}, segs: new Set() });
  R.contacts.set("Jo.Ann+x@gmail.com", { id: "ct_jo", email: "Jo.Ann+x@gmail.com", unsubscribed: true, properties: {}, segs: new Set() });
  const u = await C.pullUnsubscribes(io);
  const unsub = db.sets.get("email:unsub");
  ok("everyone who unsubscribed in Resend (a broadcast's link) joins Sona's list, every page of them",
    u.ok && ["p7", "p57", "p107", "p157", "p207"].every((p) => unsub.has(p + "@example.com")) && !unsub.has("p8@example.com") && R.calls.filter((c) => c.path === "/contacts").length === 3, [u, [...unsub]]);
  ok("…with the plain mailbox, so every Gmail spelling of that inbox stops", unsub.has("jo.ann+x@gmail.com") && unsub.has("joann@gmail.com"));
  ok("…paced for Resend's two requests a second", sleeps.includes(550));
  ok("…and Sona's welcome emails and weekly report read that same list",
    /SISMEMBER", "email:unsub"/.test(read("lib/nurture.ts")) && /SISMEMBER", "email:unsub"/.test(read("lib/report.ts")));
}

// ── Kit's leavers, once, before any older address is added ──
{
  const { db, io: io0 } = fresh();
  const K = fakeKit({
    cancelled: [{ email_address: "Left1@Example.com", state: "cancelled" }, { email_address: "left2@example.com", state: "cancelled" }, { email_address: "jim.bo@gmail.com", state: "cancelled" }],
    bounced: [{ email_address: "bounce@example.com", state: "bounced" }],
    complained: [{ email_address: "spam@example.com", state: "complained" }, { email_address: "fine@example.com", state: "active" }],
    inactive: [{ email_address: "unconfirmed@example.com", state: "inactive" }],
  });
  const io = { ...io0, f: async (u, i) => (String(u).startsWith("https://api.kit.com/") ? K.fetch(u, i) : io0.f(u, i)) };
  delete process.env.KIT_API_KEY;
  ok("without Kit's key there is nothing to import, and it is not done", !(await C.importKit(io)).ok && !db.kv.has(C.KIT_DONE));
  process.env.KIT_API_KEY = "kit_key";
  const k = await C.importKit(io);
  const unsub = db.sets.get("email:unsub");
  ok("Kit's unsubscribes, bounces and complaints all join Sona's list, every page",
    k.ok && ["left1@example.com", "left2@example.com", "bounce@example.com", "spam@example.com", "jim.bo@gmail.com", "jimbo@gmail.com"].every((e) => unsub.has(e)), [k, [...unsub]]);
  ok("…never someone Kit says is still active, nor one who never confirmed", !unsub.has("fine@example.com") && !unsub.has("unconfirmed@example.com") && !K.calls.some((c) => c.query.status === "inactive"));
  ok("…asked with Kit's own key, by status, a thousand a page", K.calls.every((c) => c.key === "kit_key" && c.query.per_page === "1000" && c.path === "/v4/subscribers"));
  ok("…and marked done, so it runs once", !!db.kv.get(C.KIT_DONE));
  const { db: db2, R: Rk, io: io2b } = fresh();
  const K2 = fakeKit({ cancelled: [{ email_address: "x@example.com", state: "cancelled" }] });
  K2.down.add("cancelled");
  const io2 = { ...io2b, f: async (u, i) => (String(u).startsWith("https://api.kit.com/") ? K2.fetch(u, i) : io2b.f(u, i)) };
  ok("if Kit does not answer for unsubscribes, it is not done", !(await C.importKit(io2)).ok && !db2.kv.has(C.KIT_DONE));
  const s = await C.syncContacts({ people: async () => [{ email: "old@example.com", role: "parent" }] }, io2);
  ok("…and the older addresses wait: not one is added", s.added === 0 && !s.detail.includes("done") && /wait for Kit/.test(s.detail) && !Rk.contacts.has("old@example.com"), s);
  delete process.env.KIT_API_KEY;
  const s2 = await C.syncContacts({ people: async () => [{ email: "old@example.com", role: "parent" }] }, io2);
  ok("…and with Kit's key gone they wait for good (a leaver put back on a list cannot be undone)", s2.added === 0 && /wait for Kit/.test(s2.detail), s2);
}

// ── the daily backfill ──
{
  const { db, R, io } = fresh();
  await db.cmd(["SET", C.KIT_DONE, "{}"]);
  await db.cmd(["SADD", "email:unsub", "left@example.com"]);
  await db.cmd(["SADD", C.SYNCED, "already@example.com"]);
  await db.cmd(["SET", "slpacct:sam@clinic.org", JSON.stringify({ email: "sam@clinic.org", code: "SAM1" })]);
  founderLeads = [
    { email: "Mom@Example.com", role: "parent", source: "parents", first_name: "" },
    { email: "mom@example.com", role: "parent", source: "app-setup" },
    { email: "pat@example.com", role: "other", source: "for-slps" },
    { email: "left@example.com", role: "parent", source: "parents" },
    { email: "already@example.com", role: "parent" },
    { email: "buyer@example.com", role: "parent", source: "app-trial", plan: "trial" },
    { email: "sam@clinic.org", role: "slp", source: "for-slps", first_name: "Samantha" },
    { email: "junk", role: "parent" },
  ];
  founderSlps = [{ email: "sam@clinic.org", name: "Sam" }, { email: "lee@school.org", name: "Lee" }];
  db.log.length = 0;
  const people = await C.everyone();
  ok("everyone Sona holds: each address once, an account counted as a clinician with its own name",
    people.length === 7 && people.filter((p) => p.email === "mom@example.com").length === 1 && people.find((p) => p.email === "sam@clinic.org").firstName === "Sam" && people.find((p) => p.email === "lee@school.org").role === "slp", people);
  const s = await C.syncContacts({}, io);
  ok("the daily run adds everyone Resend does not have yet", s.ok && s.added === 6 && s.left === 0 && R.contacts.size === 6 && !R.contacts.has("already@example.com"), s);
  ok("…in their segments, the buyer in Started Premium, the clinicians as speech therapists",
    R.inSeg("mom@example.com", "Parents") && R.inSeg("pat@example.com", "Other") && R.inSeg("buyer@example.com", "Started Premium") && R.inSeg("lee@school.org", "Speech therapists") && R.contacts.get("sam@clinic.org").first_name === "Sam");
  ok("…someone who left, added unsubscribed", R.contacts.get("left@example.com").unsubscribed === true);
  ok("…paced, and each one marked so tomorrow skips it", sleeps.includes(600) && ["mom@example.com", "lee@school.org"].every((e) => db.sets.get(C.SYNCED).has(e)));
  ok("…without touching a clinician's account", db.kv.get("slpacct:sam@clinic.org") === JSON.stringify({ email: "sam@clinic.org", code: "SAM1" }) && !db.log.some((c) => c[0] === "SET" && String(c[1]).startsWith("slpacct:")));
  const n = R.calls.length;
  const again = await C.syncContacts({}, io);
  ok("a second run adds no one again", again.added === 0 && R.calls.slice(n).every((c) => c.method === "GET"), R.calls.slice(n).map((c) => c.method + " " + c.path));

  const { db: d2, R: R2, io: i2 } = fresh();
  await d2.cmd(["SET", C.KIT_DONE, "{}"]);
  const many = Array.from({ length: 20 }, (_, i) => ({ email: `b${i}@example.com`, role: "parent" }));
  const s3 = await C.syncContacts({ batch: 5, people: async () => many }, i2);
  ok("a batch a day: no more than the batch, the rest left for tomorrow", s3.added === 5 && s3.left === 15 && R2.contacts.size === 5, s3);
  R2.key = "re_send_only";
  const s4 = await C.syncContacts({ people: async () => many }, i2);
  ok("a key that can only send emails stops the run at once and says so in plain words",
    s4.added === 0 && /Full access/.test(s4.detail) && R2.calls.filter((c) => c.method === "POST" && c.path === "/contacts").length <= 5 + 1, s4);
  R2.key = "re_full";
  const s5 = await C.syncContacts({ deadline: Date.now() - 1, people: async () => many }, i2);
  ok("…and a run out of time adds nothing more", s5.added === 0, s5);
}

// ── Resend's limits and refusals ──
{
  const { R, io } = fresh();
  R.fail.set("POST /contacts", 429);
  const before = sleeps.length;
  const r = await C.upsertContact({ email: "busy@example.com", role: "parent" }, io);
  ok("a 'slow down' (429) is tried once more after a pause, and the second try counts", r.ok && R.contacts.has("busy@example.com") && sleeps.slice(before).includes(1100), r);
  R.key = "re_send_only";
  const r2 = await C.upsertContact({ email: "x@example.com", role: "parent" }, io);
  ok("a send-only key: not in the list, and the leads page says to give the key Full access", !r2.ok && /Full access/.test(r2.detail), r2);
  R.key = "re_full";
  R.fail.set("POST /contacts", 503);
  const r3 = await C.upsertContact({ email: "down@example.com", role: "parent" }, io);
  ok("Resend down: not counted as in the list (the daily run adds it later)", !r3.ok && !R.contacts.has("down@example.com"), r3);
  // Travis deletes a segment in Resend's dashboard: the kept id is stale
  R.segments = R.segments.filter((s) => s.name !== "Parents");
  const r4 = await C.upsertContact({ email: "stale@example.com", role: "parent" }, io);
  const r5 = await C.upsertContact({ email: "stale@example.com", role: "parent" }, io);
  ok("a segment deleted in Resend: that try fails, the next one makes it again and adds them", !r4.ok && r5.ok && R.inSeg("stale@example.com", "Parents"), [r4, r5]);
  ok("…and every call carries the key, sent as a Bearer header", R.calls.every((c) => /^Bearer re_/.test(c.auth)));
}

// ── /api/lead itself, against the fake Resend: nothing about a child goes ──
{
  const db = store(), R = fakeResend();
  currentKv = db.cmd;
  const routeStubs = {
    "@/lib/slpAuth": { kvCmd: (c) => (c[0] === "LPUSH" || c[0] === "LTRIM" ? Promise.resolve(1) : db.cmd(c)), kvConfigured: () => true, leadSig: () => "not-a-signature" },
    "@/lib/rateLimit": { rateLimit: async () => null },
    "@/lib/contacts": C,
    "@/lib/launch": { APP_READY: true, sendWelcomeEmail: async () => false },
    "@/lib/nurture": { enroll: async () => false, inAppSource: () => false, stopSeries: async () => {} },
  };
  const mod = { exports: {} };
  const js = ts.transpileModule(read("app/api/lead/route.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", js)((x) => routeStubs[x] || (x === "next/server" ? require(path.join(REPO, "node_modules/next/server")) : require(x)), mod, mod.exports);
  const { NextRequest } = require(path.join(REPO, "node_modules/next/server"));
  const post = async (body) => {
    const real = globalThis.fetch;
    globalThis.fetch = R.fetch;
    try {
      const r = await mod.exports.POST(new NextRequest("https://speaksona.com/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
      return { status: r.status, json: await r.json() };
    } finally { globalThis.fetch = real; }
  };
  const r = await post({ email: "parent@example.com", role: "parent", source: "app-setup", name: "Milo", child: "Milo", age: "6", practice: ["R"], report: "Milo practiced R", summary: "Milo's report" });
  ok("a parent's email from the app is captured into Resend's Parents", r.status === 200 && r.json.captured === true && R.inSeg("parent@example.com", "Parents"), r);
  ok("…and nothing about the child reaches Resend: no name, no age, no sound, no report",
    !/Milo|"age"|practice|report|summary/i.test(JSON.stringify(R.calls.map((c) => c.body))), R.calls.map((c) => c.body));
  const r2 = await post({ email: "sam@clinic.org", role: "slp", name: "Sam", source: "for-slps" });
  ok("a clinician's own name travels with them", r2.json.captured === true && R.contacts.get("sam@clinic.org").first_name === "Sam");
  R.key = "nope";
  const r3 = await post({ email: "lost@example.com", role: "parent" });
  ok("Resend refusing: the visitor still gets an answer, and captured is false", r3.status === 200 && r3.json.ok === true && r3.json.captured === false, r3);
  currentKv = async () => null;
}

// ── the wiring ──
{
  const cron = read("app/api/cron/nurture/route.ts"), unsub = read("app/api/email/unsub/route.ts"), founder = read("lib/founder.ts");
  ok("the daily run syncs the list first (so a broadcast's unsubscribes stop today's emails), within a minute, never stopping them",
    /try \{ list = await syncContacts\(\{ deadline: started \+ 60000 \}\); \} catch/.test(cron) && cron.indexOf("syncContacts({") < cron.indexOf("runDue()"));
  ok("Sona's unsubscribe link tells Resend after Sona's own list has it", unsub.indexOf('["SADD", "email:unsub"') < unsub.indexOf("markUnsubscribed(v.email)") && /try \{ await markUnsubscribed\(v\.email\); \} catch/.test(unsub));
  ok("the leads page's 'in the list' for a clinician reads the list's own mark", /const LIST_SYNCED = "resend:synced";/.test(founder) && C.SYNCED === "resend:synced" && /inCrm: inList \?/.test(founder));
  ok("Kit's code is gone", !existsSync(path.join(REPO, "lib/kit.ts")) && !existsSync(path.join(REPO, "app/api/founders/kit-sync/route.ts")));
  const src = read("lib/contacts.ts");
  ok("the list never re-subscribes anyone: 'unsubscribed' is only ever written as true", !/unsubscribed: false/.test(src) && (src.match(/unsubscribed: true/g) || []).length >= 2);
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
