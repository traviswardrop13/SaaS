// REPORT1: the weekly progress report (Travis, 15 Oct 2026: "i want the setup
// page to say get the weekly progress report", then "Build the real report").
// The phone half (sona.js REPORT1): only a household that asked for it sends,
// and what it sends is a few numbers a child, never a name, an age or a voice;
// at most every 30 minutes on a rep, once more when the page hides, never
// from Home, never again once the address unsubscribed. The server half
// (lib/report.ts, /api/report, the daily cron): what it keeps, for how long,
// and Monday's email, once an address a week, in Rachel's words and the house
// email rules.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0, passes = 0;
const ok = (name, cond, info) => {
  if (cond) { passes++; console.log("PASS " + name); }
  else { fails++; console.log("FAIL " + name + (info === undefined ? "" : "  → " + JSON.stringify(info).slice(0, 600))); }
};
async function scenario(label, run) { try { await run(); } catch (e) { ok(label + " completes", false, e.stack); } }

// ── the server half, transpiled as nurturetest does, its store a fake ──
const TSOPT = { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } };
function loadTs(file, stubs = {}, cache = new Map()) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const js = ts.transpileModule(readFileSync(file, "utf8"), TSOPT).outputText;
  const req = (s) => stubs[s] || (s.startsWith("@/") ? loadTs(path.join(REPO, s.slice(2) + ".ts"), stubs, cache) : s === "next/server" ? require(path.join(REPO, "node_modules/next/server")) : require(s));
  new Function("require", "module", "exports", js)(req, mod, mod.exports);
  return mod.exports;
}
// the commands the report uses, in memory; `down` makes every call go unanswered;
// with `clock` set (ms), a time limit on a plain key really ends it
function store(unsub = []) {
  const kv = new Map(), h = new Map(), sets = new Map([["email:unsub", new Set(unsub)]]), ttl = new Map(), at = new Map(), exp = new Map(), calls = [];
  const db = {
    kv, h, sets, ttl, at, calls, down: false, clock: 0,
    cmd: async (c) => {
      calls.push(c);
      if (db.down) return undefined;
      const [op, ...a] = c;
      if (db.clock && exp.has(a[0]) && db.clock >= exp.get(a[0])) { kv.delete(a[0]); exp.delete(a[0]); }
      if (op === "SET") { if (a.includes("NX") && kv.has(a[0])) return null; kv.set(a[0], String(a[1])); const ex = a.indexOf("EX"); if (ex > -1) { ttl.set(a[0], a[ex + 1]); if (db.clock) exp.set(a[0], db.clock + a[ex + 1] * 1000); } return "OK"; }
      if (op === "GET") return kv.has(a[0]) ? kv.get(a[0]) : null;
      if (op === "DEL") return kv.delete(a[0]) ? 1 : 0;
      if (op === "INCR" || op === "DECR") { const n = Number(kv.get(a[0]) || 0) + (op === "INCR" ? 1 : -1); kv.set(a[0], String(n)); return n; }
      if (op === "TTL") return !kv.has(a[0]) ? -2 : ttl.has(a[0]) ? ttl.get(a[0]) : -1;
      if (op === "SISMEMBER") return (sets.get(a[0]) || new Set()).has(a[1]) ? 1 : 0;
      if (op === "SADD") { const m = sets.get(a[0]) || new Set(); let n = 0; a.slice(1).forEach((x) => { if (!m.has(x)) { n++; m.add(x); } }); sets.set(a[0], m); return n; }
      if (op === "SREM") { const m = sets.get(a[0]); return m && m.delete(a[1]) ? 1 : 0; }
      if (op === "SMEMBERS") return [...(sets.get(a[0]) || [])];
      if (op === "HDEL") { const m = h.get(a[0]); return m && m.delete(a[1]) ? 1 : 0; }
      if (op === "HKEYS") return [...(h.get(a[0]) || new Map()).keys()];
      if (op === "HSET") { const m = h.get(a[0]) || new Map(); const isNew = !m.has(a[1]); m.set(a[1], a[2]); h.set(a[0], m); return isNew ? 1 : 0; }
      if (op === "HGETALL") { const m = h.get(a[0]); return m ? [...m].flat() : []; }
      if (op === "EXPIRE") { ttl.set(a[0], a[1]); if (db.clock) exp.set(a[0], db.clock + a[1] * 1000); return 1; }
      if (op === "EXPIREAT") { at.set(a[0], a[1]); return 1; }
      throw new Error("unexpected " + op);
    },
  };
  return db;
}
const outbox = [];
let resendStatus = 200;
const fakeFetch = async (u, init) => { outbox.push({ url: u, headers: init.headers, body: JSON.parse(init.body) }); return { ok: resendStatus === 200, status: resendStatus }; };
const noSleep = { sleeps: 0, fn: async () => { noSleep.sleeps++; } };

process.env.RESEND_API_KEY = "re_test"; process.env.UNSUB_SECRET = "s3cret"; process.env.EMAIL_POSTAL = "851 NE 1st Ave, Unit 4103, Miami, FL 33132";
let db = store();
const N = loadTs(path.join(REPO, "lib/nurture.ts"));
const R = loadTs(path.join(REPO, "lib/report.ts"), { "@/lib/slpAuth": { kvCmd: (c) => db.cmd(c), kvConfigured: () => true }, "@/lib/nurture": N });
const confirmed = (email, dev) => db.sets.set(R.confirmKey(R.mailHash(email, "s3cret")), new Set([...(db.sets.get(R.confirmKey(R.mailHash(email, "s3cret"))) || []), dev]));

const THU = Date.parse("2026-10-15T16:00:00Z"); // Thursday 15 Oct: this week is Mon 12, last week Mon 5
const MON = Date.parse("2026-10-19T16:00:00Z"); // the Monday after: the send is for the week of Mon 12
const DEV = "0123456789abcdef0123456789abcdef", DEV2 = "fedcba9876543210fedcba9876543210";
const kid = (o = {}) => Object.assign({ d: 3, g: 2, gw: 5, r: 40, p: 25, s: ["R"] }, o);

// 1. what the phone may send, and what is kept of it
{
  const good = { email: " Mom@Example.com ", dev: DEV, weeks: [{ wk: "2026-10-05", kids: [kid({ i: "00112233aabbccdd" })] }, { wk: "2026-10-12", kids: [kid({ r: 0, p: 0, d: 0, g: 0, s: [] })] }] };
  const v = R.validate(good, THU);
  ok("a report is an address (lowercased), a device id and this week and last, each child with its random id", v && v.email === "mom@example.com" && v.dev === DEV && v.weeks.length === 2 && v.weeks[0].wk === "2026-10-05" && v.weeks[0].kids[0].i === "00112233aabbccdd" && !("i" in v.weeks[1].kids[0]), v);
  const extra = R.validate({ email: "a@b.co", dev: DEV, weeks: [{ wk: "2026-10-12", kids: [Object.assign(kid({ i: "Milo" }), { name: "Milo", childName: "Milo", age: 6, words: ["rabbit"] })] }] }, THU);
  ok("…each child is built field by field: a name, an age or a word in the body is never kept (nor a \"child id\" that is not a random one)", extra && JSON.stringify(Object.keys(extra.weeks[0].kids[0]).sort()) === JSON.stringify(["d", "g", "gw", "p", "r", "s"]) && !/Milo|rabbit/.test(JSON.stringify(extra)), extra);
  const clamp = R.validate({ email: "a@b.co", dev: DEV, weeks: [{ wk: "2026-10-12", kids: [{ d: 9, g: -2, gw: 6, r: 50, p: 80, s: ["R", "Q", "S", "R", "<b>"] }] }] }, THU);
  ok("…numbers are clamped (days 0-7, practice never above reps) and only real sounds kept, in order; a plan that is not 3, 4, 5 or 7 is no plan, never a made-up 4",
    clamp && JSON.stringify(clamp.weeks[0].kids[0]) === JSON.stringify({ d: 7, g: 0, r: 50, p: 50, s: ["S", "R"] }), clamp);
  // THE PLAN ONLY WHEN A GROWN-UP PICKED ONE (22 Oct 2026): setup no longer
  // asks the days a week, so a phone sends gw only for a child whose profile
  // holds a picked number, and the server keeps exactly what came
  const plans = R.validate({ email: "a@b.co", dev: DEV, weeks: [{ wk: "2026-10-12", kids: [{ d: 2, g: 1, r: 9, p: 3, s: ["R"] }, { d: 2, g: 1, gw: 4, r: 9, p: 3, s: ["R"] }, { d: 2, g: 1, gw: 7, r: 9, p: 3, s: ["R"] }] }] }, THU);
  ok("…a child sent with no plan is kept with none; a picked 4 or 7 is kept as it came",
    plans && !("gw" in plans.weeks[0].kids[0]) && plans.weeks[0].kids[1].gw === 4 && plans.weeks[0].kids[2].gw === 7, plans);
  const bad = {
    "no address": { dev: DEV, weeks: good.weeks },
    "a bad address": { email: "not an email", dev: DEV, weeks: good.weeks },
    "an address a mail header cannot carry": { email: "!中@x.co", dev: DEV, weeks: good.weeks },
    "a lone surrogate": { email: "a\ud800@x.co", dev: DEV, weeks: good.weeks },
    "an address longer than the unsubscribe link reads (120)": { email: "a".repeat(115) + "@x.com", dev: DEV, weeks: good.weeks },
    "no device id": { email: "a@b.co", weeks: good.weeks },
    "a short device id": { email: "a@b.co", dev: "abc", weeks: good.weeks },
    "a week that is not a Monday": { email: "a@b.co", dev: DEV, weeks: [{ wk: "2026-10-13", kids: [] }] },
    "a week three weeks back": { email: "a@b.co", dev: DEV, weeks: [{ wk: "2026-09-21", kids: [] }] },
    "next week": { email: "a@b.co", dev: DEV, weeks: [{ wk: "2026-10-19", kids: [] }] },
    "three weeks at once": { email: "a@b.co", dev: DEV, weeks: [{ wk: "2026-10-05", kids: [] }, { wk: "2026-10-12", kids: [] }, { wk: "2026-10-12", kids: [] }] },
    "the same week twice": { email: "a@b.co", dev: DEV, weeks: [{ wk: "2026-10-12", kids: [] }, { wk: "2026-10-12", kids: [] }] },
    "nine children": { email: "a@b.co", dev: DEV, weeks: [{ wk: "2026-10-12", kids: Array(9).fill(kid()) }] },
    "a list, not a report": [1, 2],
  };
  const passed = Object.entries(bad).filter(([, b]) => R.validate(b, THU) !== null).map(([k]) => k);
  ok("…and anything else is not a report: " + Object.keys(bad).join(", "), passed.length === 0, passed);
  ok("a phone far ahead of UTC may already be in next week's Monday (two days of slack)", R.validate({ email: "a@b.co", dev: DEV, weeks: [{ wk: "2026-10-19", kids: [] }] }, Date.parse("2026-10-18T12:00:00Z")) !== null);

  // nothing is kept until the address confirms this phone
  db = store(["gone@example.com"]); outbox.length = 0; resendStatus = 200;
  const first = await R.store(v, db.cmd, fakeFetch, THU);
  const ask = outbox[0] && outbox[0].body;
  ok("an unconfirmed phone: nothing kept, the answer is \"pending\", and the address is emailed a confirm link once", first === "pending" && db.h.size === 0 && outbox.length === 1 && ask.to[0] === "mom@example.com" && ask.subject === "Confirm your weekly progress report", [first, outbox.length]);
  const link = (ask && ask.html.match(/href="(https:\/\/speaksona\.com\/api\/report\/confirm\?[^"]+)"/) || [])[1] || "";
  const u = new URL(link.replace(/&amp;/g, "&") || "https://x/");
  ok("…the link names this phone and carries a token only the server can make", u.searchParams.get("d") === DEV && u.searchParams.get("k") === R.confirmToken("mom@example.com", DEV, "s3cret"), link);
  ok("…and the email says what the report holds and that ignoring it sends nothing, with no child in it", /how many days, how many reps and which sounds/.test(ask.text) && /ignore this email and nothing will be sent/.test(ask.text) && /Rachel, MS, CF-SLP/.test(ask.text) && ask.text.includes("851 NE 1st Ave") && /api\/email\/unsub/.test(ask.headers["List-Unsubscribe"]));
  await R.store(v, db.cmd, fakeFetch, THU + 3600000);
  ok("…asked at most once a week a phone (a phone posts every half hour)", outbox.length === 1, outbox.length);
  await R.store(Object.assign({}, v, { dev: DEV2 }), db.cmd, fakeFetch, THU + 7200000);
  ok("…a second phone (or a stranger's post) gets its own link: it never takes this phone's", outbox.length === 2 && outbox[1].body.html.includes("d=" + DEV2), outbox.length);
  // only a link Resend took counts; the 60-day count is a fixed window from the first link
  {
    const d2 = store(); const out0 = outbox.length; resendStatus = 500;
    const w = R.validate({ email: "late@example.com", dev: DEV, weeks: [{ wk: "2026-10-12", kids: [] }] }, THU);
    await R.store(w, d2.cmd, fakeFetch, THU);
    resendStatus = 200;
    await R.store(w, d2.cmd, fakeFetch, THU + 1800000);
    ok("a link Resend refused is not spent: the next post (half an hour on) sends it", outbox.length === out0 + 2 && outbox[out0 + 1].body.to[0] === "late@example.com", outbox.length - out0);
    const d3 = store(); const out1 = outbox.length;
    d3.kv.set("report:asks:2026-10-15", String(R.ASK_CAP));
    await R.store(R.validate({ email: "capped@example.com", dev: DEV, weeks: [{ wk: "2026-10-12", kids: [] }] }, THU), d3.cmd, fakeFetch, THU);
    await R.store(R.validate({ email: "capped@example.com", dev: DEV, weeks: [{ wk: "2026-10-12", kids: [] }] }, THU), d3.cmd, fakeFetch, THU + 86400000);
    ok("a day over the 300-link cap sends nothing and spends nothing: the next day's post sends the link", outbox.length === out1 + 1, outbox.length - out1);
    // twelve weeks of an unconfirmed phone posting every day: links in weeks 0-4, then
    // none (five in a fixed 180-day window; the phone itself gives up at eight weeks)
    const d4 = store(); const out2 = outbox.length; const perWeek = [];
    for (let day = 0; day < 84; day++) {
      const t = THU + day * 86400000, before = outbox.length;
      d4.clock = t;
      await R.store(R.validate({ email: "slow@example.com", dev: DEV, weeks: [{ wk: R.mondayOf(t), kids: [] }] }, t), d4.cmd, fakeFetch, t);
      perWeek[Math.floor(day / 7)] = (perWeek[Math.floor(day / 7)] || 0) + (outbox.length - before);
    }
    ok("at most " + R.ASKS_PER_MAILBOX + " links a mailbox in 180 days, the window fixed from the first link (a posting phone never pushes it on)",
      perWeek.join("") === "111110000000" && outbox.length - out2 === R.ASKS_PER_MAILBOX && d4.ttl.get("report:askn:" + R.mailHash("slow@example.com", "s3cret")) === 180 * 86400, perWeek.join(""));
    // forty posts at the same moment, each from a new phone: the limits are taken before the send
    const d5 = store(); const out3 = outbox.length;
    const slowSend = async (u, init) => { await new Promise((r) => setTimeout(r, 30)); return fakeFetch(u, init); };
    const devs = Array.from({ length: 40 }, (_, i) => i.toString(16).padStart(32, "a"));
    await Promise.all(devs.map((dv) => R.store(R.validate({ email: "burst@example.com", dev: dv, weeks: [{ wk: "2026-10-12", kids: [] }] }, THU), d5.cmd, slowSend, THU)));
    ok("forty posts at once from forty new phones send at most " + R.ASKS_PER_MAILBOX + " links (the limits are taken atomically, before the send)", outbox.length - out3 === R.ASKS_PER_MAILBOX, outbox.length - out3);
    // a lost INCR reply gives nothing back it never took: the day's count never goes below zero
    const d7 = store(); const out4 = outbox.length; let lose = true;
    const flaky = async (c) => { if (lose && c[0] === "INCR") { lose = false; return undefined; } return d7.cmd(c); };
    await R.store(R.validate({ email: "blip@example.com", dev: DEV, weeks: [{ wk: "2026-10-12", kids: [] }] }, THU), flaky, fakeFetch, THU);
    await R.store(R.validate({ email: "next@example.com", dev: DEV, weeks: [{ wk: "2026-10-12", kids: [] }] }, THU), flaky, fakeFetch, THU);
    await R.store(R.validate({ email: "blip@example.com", dev: DEV, weeks: [{ wk: "2026-10-12", kids: [] }] }, THU), flaky, fakeFetch, THU + 60000);
    ok("a store that drops one answer neither blocks the day (its count never goes below zero) nor the phone (its slot is freed)", Number(d7.kv.get("report:asks:2026-10-15")) === 2 && outbox.length - out4 === 2, [d7.kv.get("report:asks:2026-10-15"), outbox.length - out4]);
    // over the mailbox's five, nothing is counted that was not sent
    const d8 = store(); const box = "report:askn:" + R.mailHash("full@example.com", "s3cret");
    for (let i = 0; i < 7; i++) await R.store(R.validate({ email: "full@example.com", dev: i.toString(16).padStart(32, "c"), weeks: [{ wk: "2026-10-12", kids: [] }] }, THU), d8.cmd, fakeFetch, THU);
    ok("…and a mailbox over its five counts exactly the five sent", d8.kv.get(box) === "5", d8.kv.get(box));
    // a quiet check (a phone that stopped asking) never sends a link
    const d9 = store(); const out5 = outbox.length;
    ok("a quiet check from a phone that gave up is \"pending\" and sends no link", await R.store(R.validate({ email: "quiet@example.com", dev: DEV, quiet: true, weeks: [{ wk: "2026-10-12", kids: [] }] }, THU), d9.cmd, fakeFetch, THU) === "pending" && outbox.length === out5);
    const d6 = store(); d6.kv.set("report:askn:" + R.mailHash("lost@example.com", "s3cret"), "1");
    await R.store(R.validate({ email: "lost@example.com", dev: DEV, weeks: [{ wk: "2026-10-12", kids: [] }] }, THU), d6.cmd, fakeFetch, THU);
    ok("a count whose time limit was lost gets one back on its next step (never a mailbox blocked for good)", d6.ttl.get("report:askn:" + R.mailHash("lost@example.com", "s3cret")) === 180 * 86400);
  }
  const markGone = outbox.length;
  const goneAns = await R.store(R.validate(Object.assign({}, good, { email: "gone@example.com" }), THU), db.cmd, fakeFetch, THU);
  ok("an unsubscribed address posting from a phone it never confirmed gets the same \"pending\" and no email", goneAns === "pending" && outbox.length === markGone && db.h.size === 0);
  ok("the confirmation set is named by a keyed hash of the mailbox: no address in it", R.confirmKey(R.mailHash("Mom@Example.com", "s3cret")) === "report:dev:" + R.mailHash("mom@example.com", "s3cret") && !/mom/.test(R.confirmKey(R.mailHash("mom@example.com", "s3cret"))));
  ok("confirmOk: the right token for that address and phone, nothing else", !!R.confirmOk("mom@example.com", DEV, R.confirmToken("mom@example.com", DEV, "s3cret")) &&
    !R.confirmOk("mom@example.com", DEV2, R.confirmToken("mom@example.com", DEV, "s3cret")) && !R.confirmOk("dad@example.com", DEV, R.confirmToken("mom@example.com", DEV, "s3cret")) && !R.confirmOk("mom@example.com", DEV, "0".repeat(32)));
  ok("confirm() marks the phone, for 120 days", await R.confirm("mom@example.com", DEV, db.cmd) && db.sets.get(R.confirmKey(R.mailHash("mom@example.com", "s3cret"))).has(DEV) && db.ttl.get(R.confirmKey(R.mailHash("mom@example.com", "s3cret"))) === 120 * 86400);
  ok("confirmed: kept, one hash a week, \"<address> <device>\" to that phone's numbers, until three weeks after that Monday (a fixed end)", await R.store(v, db.cmd, fakeFetch, THU) === "ok" &&
    db.h.get("report:wk:2026-10-05").get("mom@example.com " + DEV) === JSON.stringify(v.weeks[0].kids) &&
    db.at.get("report:wk:2026-10-05") === Date.parse("2026-10-26T00:00:00Z") / 1000 && db.at.get("report:wk:2026-10-12") === Date.parse("2026-11-02T00:00:00Z") / 1000, [...db.at]);
  confirmed("gone@example.com", DEV); db.ttl.delete(R.confirmKey(R.mailHash("gone@example.com", "s3cret")));
  ok("a confirmed phone of an address that unsubscribed is told \"off\", nothing is kept, and its confirmation stays fresh (so it keeps hearing \"off\", never \"pending\")",
    await R.store(R.validate(Object.assign({}, good, { email: "gone@example.com" }), THU), db.cmd, fakeFetch, THU) === "off" && ![...db.h.values()].some((m) => [...m.keys()].some((k) => k.startsWith("gone@"))) &&
    db.ttl.get(R.confirmKey(R.mailHash("gone@example.com", "s3cret"))) === 120 * 86400);
  db.sets.get("email:unsub").add("victim@gmail.com"); confirmed("v.ictim+x@gmail.com", DEV);
  ok("…the same for a Gmail dot or +tag of an unsubscribed address", await R.store(R.validate(Object.assign({}, good, { email: "v.ictim+x@gmail.com" }), THU), db.cmd, fakeFetch, THU) === "off");
  db.down = true;
  ok("a store that does not answer is an error, never \"ok\", \"pending\" or \"off\"", await R.store(v, db.cmd, fakeFetch, THU) === "error");
}

// 2. Monday's email
{
  db = store(["gone@example.com", "victim@gmail.com"]); outbox.length = 0; resendStatus = 200;
  const put = (email, dev, kids, wk = "2026-10-12") => { const m = db.h.get("report:wk:" + wk) || new Map(); m.set(email + " " + dev, JSON.stringify(kids)); db.h.set("report:wk:" + wk, m); };
  put("one@example.com", DEV, [kid({ i: "a1a1a1a1a1a1a1a1", d: 4, g: 5, gw: 5, r: 112, p: 40, s: ["R", "S"] })]);
  // the same child (its id) on two phones after a move: once, the fuller count; and two quiet brothers stay two
  put("two@example.com", DEV, [kid({ i: "b1b1b1b1b1b1b1b1", r: 30, p: 20, s: ["R"] }), kid({ i: "b2b2b2b2b2b2b2b2", d: 1, g: 0, gw: 3, r: 6, p: 0, s: ["L"] })]);
  put("two@example.com", DEV2, [kid({ i: "b1b1b1b1b1b1b1b1", r: 45, p: 30, s: ["R"] }), kid({ i: "b3b3b3b3b3b3b3b3", d: 0, g: 0, gw: 4, r: 0, p: 0, s: [] }), kid({ i: "b4b4b4b4b4b4b4b4", d: 0, g: 0, gw: 4, r: 0, p: 0, s: [] })]);
  put("zero@example.com", DEV, [kid({ d: 0, g: 0, r: 0, p: 0, s: [] })]);
  put("gone@example.com", DEV, [kid()]);
  put("v.ictim@gmail.com", DEV, [kid()]);
  put("old@example.com", DEV, [kid()], "2026-10-05");

  const thu = await R.runReports(db.cmd, fakeFetch, Date.parse("2026-10-22T16:00:00Z"), { sleep: noSleep.fn });
  ok("Monday sends (Tuesday and Wednesday catch up): Thursday sends nothing", thu.week === null && outbox.length === 0, thu);
  noSleep.sleeps = 0;
  const run = await R.runReports(db.cmd, fakeFetch, MON, { sleep: noSleep.fn });
  const to = outbox.map((m) => m.body.to[0]).sort();
  ok("Monday sends last week's report (the week of Mon 12 Oct) to each address with reps, once", run.week === "2026-10-12" && JSON.stringify(to) === JSON.stringify(["one@example.com", "two@example.com"]) && run.sent === 2, [run, to]);
  ok("…never to an unsubscribed address (nor its Gmail dot form), never for a week with no reps, never from another week", !to.includes("gone@example.com") && !to.includes("v.ictim@gmail.com") && !to.includes("zero@example.com") && !to.includes("old@example.com"));
  ok("…paced for Resend's rate limit: a pause before every send, the first too (the welcome series has just sent)", noSleep.sleeps === 2, noSleep.sleeps);
  const one = outbox.find((m) => m.body.to[0] === "one@example.com").body, two = outbox.find((m) => m.body.to[0] === "two@example.com").body;
  const oneHead = outbox.find((m) => m.body.to[0] === "one@example.com").headers;
  ok("from Rachel, replies to Rachel, once per address and week even if Resend is asked twice (an Idempotency-Key with no address in it)",
    /rachel@speaksona\.com/.test(one.from) && one.reply_to === "rachel@speaksona.com" && /^report-2026-10-12-[a-f0-9]{32}$/.test(oneHead["Idempotency-Key"]) && !/@/.test(oneHead["Idempotency-Key"]), [one.from, oneHead]);
  ok("…with a working unsubscribe link (the token /api/email/unsub checks) in the body and the header, and the mailing address",
    one.html.includes("/api/email/unsub?e=one%40example.com&k=" + N.unsubToken("one@example.com", "s3cret")) && /api\/email\/unsub/.test(one.headers["List-Unsubscribe"]) &&
    one.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click" && one.html.includes("851 NE 1st Ave") && one.text.includes("851 NE 1st Ave"));
  ok("one child: the subject counts the reps, and the body says the week, days said out loud, goal days against the plan, the split and the sounds",
    one.subject === "Last week on Sona: 112 reps" && /Oct 12 to Oct 18/.test(one.text) && one.text.includes("- Said their sound out loud on 4 days") &&
    one.text.includes("- Reached the daily goal on 5 days (your plan: 5 days a week)") && one.text.includes("- 112 reps: 40 in practice, 72 in games and books") &&
    one.text.includes("- Sounds: S and R") && !/Child 1/.test(one.text), one.text);
  ok("…and a family that kept its plan hears so", one.text.includes("That’s the plan you set."));
  ok("two phones, one address: one email; the same child (by its id) once, with the fuller count; two quiet brothers stay two; \"Child N\", never a name",
    (two.text.match(/Child \d/g) || []).join() === "Child 1,Child 2,Child 3,Child 4" && two.text.includes("Child 1 · R\n- Said their sound out loud on 3 days") && two.text.includes("- 45 reps: 30 in practice, 15 in games and books") &&
    /Child 2 · L\n- Said their sound out loud on 1 day\n/.test(two.text) && two.text.includes("- 6 reps: all in games and books") && /Child 3\n- No practice last week\.\n\nChild 4\n- No practice last week\./.test(two.text) &&
    two.subject === "Last week on Sona: 51 reps" && two.text.includes("Every rep counts."), two.text);
  const again = await R.runReports(db.cmd, fakeFetch, MON + 3600000, { sleep: noSleep.fn }), tue = await R.runReports(db.cmd, fakeFetch, MON + 24 * 3600000, { sleep: noSleep.fn });
  ok("a second run that day, and Tuesday's, send nothing more", again.sent === 0 && tue.sent === 0 && outbox.length === 2, [again, tue]);

  // a refusal lets the next run try again; a 429 stops the run; time runs out before the function does
  db = store(); outbox.length = 0; resendStatus = 500;
  db.h.set("report:wk:2026-10-12", new Map([["fail@example.com " + DEV, JSON.stringify([kid()])]]));
  const refused = await R.runReports(db.cmd, fakeFetch, MON, { sleep: noSleep.fn });
  resendStatus = 200;
  const retried = await R.runReports(db.cmd, fakeFetch, MON + 24 * 3600000, { sleep: noSleep.fn });
  ok("Resend refusing a send releases the week's mark, so Tuesday's run sends it", refused.failed === 1 && retried.sent === 1 && outbox.length === 2, [refused, retried]);
  db = store(); outbox.length = 0; resendStatus = 429;
  db.h.set("report:wk:2026-10-12", new Map([["a@example.com " + DEV, JSON.stringify([kid()])], ["b@example.com " + DEV, JSON.stringify([kid()])]]));
  const slow = await R.runReports(db.cmd, fakeFetch, MON, { sleep: noSleep.fn });
  resendStatus = 200;
  ok("a 429 (too fast) is tried once more after a longer pause; still 429, the run stops, the address is released, and the next run sends both", slow.stopped === "rate" && outbox.length === 2 && !db.kv.has(R.sentKey("2026-10-12", "a@example.com")) && (await R.runReports(db.cmd, fakeFetch, MON + 24 * 3600000, { sleep: noSleep.fn })).sent === 2, slow);
  db = store(); outbox.length = 0;
  db.h.set("report:wk:2026-10-12", new Map([["a@example.com " + DEV, JSON.stringify([kid()])]]));
  let once = true;
  const blip = await R.runReports(db.cmd, async (u, init) => { if (once) { once = false; outbox.push({ body: JSON.parse(init.body) }); return { ok: false, status: 429 }; } return fakeFetch(u, init); }, MON, { sleep: noSleep.fn });
  ok("…and one 429 then an ok is a sent report, not a lost week", blip.sent === 1 && !blip.stopped, blip);
  db = store(); outbox.length = 0;
  db.h.set("report:wk:2026-10-12", new Map([["a@example.com " + DEV, JSON.stringify([kid()])]]));
  const late = await R.runReports(db.cmd, fakeFetch, MON, { sleep: noSleep.fn, deadline: Date.now() - 1 });
  ok("past its time budget a run sends nothing and claims nothing (Wednesday picks it up)", late.stopped === "time" && outbox.length === 0 && db.kv.size === 0, late);
  const realCmd = db.cmd;
  db.cmd = async (c) => (c[0] === "SISMEMBER" ? undefined : realCmd(c));
  const blind = await R.runReports(db.cmd, fakeFetch, MON, { sleep: noSleep.fn });
  ok("…and when the unsubscribe list cannot be read, nobody is emailed (fail closed)", blind.sent === 0 && outbox.length === 0, blind);
  db = store(); outbox.length = 0;
  db.h.set("report:wk:2026-10-12", new Map([["a@example.com " + DEV, JSON.stringify([kid()])]]));
  const postal = process.env.EMAIL_POSTAL; delete process.env.EMAIL_POSTAL;
  const unset = await R.runReports(db.cmd, fakeFetch, MON, { sleep: noSleep.fn });
  ok("…nor without a mailing address in the settings (CAN-SPAM), and nothing is kept either", unset.week === null && outbox.length === 0 && await R.store(R.validate({ email: "a@b.co", dev: DEV, weeks: [{ wk: "2026-10-12", kids: [] }] }, THU), db.cmd, fakeFetch, THU) === "error");
  process.env.EMAIL_POSTAL = postal;
  const forced = await R.runReports(db.cmd, fakeFetch, Date.parse("2026-10-22T16:00:00Z"), { force: true, sleep: noSleep.fn });
  ok("a founder's manual run sends on any day, still once a week", forced.sent === 1 && (await R.runReports(db.cmd, fakeFetch, Date.parse("2026-10-22T17:00:00Z"), { force: true, sleep: noSleep.fn })).sent === 0);
  db = store(); outbox.length = 0;
  const big = new Map(); for (let i = 0; i < R.SEND_CAP + 5; i++) big.set(`p${String(i).padStart(4, "0")}@example.com ${DEV}`, JSON.stringify([kid()]));
  db.h.set("report:wk:2026-10-12", big);
  const firstRun = await R.runReports(db.cmd, fakeFetch, MON, { sleep: noSleep.fn }), rest = await R.runReports(db.cmd, fakeFetch, MON + 24 * 3600000, { sleep: noSleep.fn });
  ok("a run sends at most " + R.SEND_CAP + "; the next run sends the rest", firstRun.sent === R.SEND_CAP && rest.sent === 5, [firstRun.sent, rest.sent]);
}

// 3. the words: Rachel's byline and the house email rules
{
  const u = "https://speaksona.com/api/email/unsub?e=x&k=y", P = "851 NE 1st Ave";
  const many = R.render("2026-10-12", [kid({ s: ["P", "B", "M", "N", "S", "R", "THV"] }), kid({ r: 0, p: 0, d: 0, g: 0, s: [] })], u, P);
  const solo1 = R.render("2026-10-12", [kid({ d: 1, g: 1, r: 1, p: 1, s: ["THV"] })], u, P);
  const kept = R.render("2026-10-12", [kid({ g: 5, gw: 5 })], u, P);
  const keptButQuiet = R.render("2026-10-12", [kid({ g: 5, gw: 5 }), kid({ r: 0, p: 0, d: 0, g: 0, s: [] })], u, P);
  // a child whose days a week nobody picked (setup stopped asking on 22 Oct 2026)
  const noPlan = (o = {}) => { const k = kid(o); delete k.gw; return k; };
  const unplanned = R.render("2026-10-12", [noPlan({ d: 6, g: 6 })], u, P);
  const halfPlanned = R.render("2026-10-12", [kid({ g: 5, gw: 5 }), noPlan({ d: 6, g: 6 })], u, P);
  const ask = R.renderConfirm("https://speaksona.com/api/report/confirm?e=x&d=y&k=z", u, P);
  const all = [many, solo1, kept, keptButQuiet, ask].map((m) => m.subject + "\n" + m.html + "\n" + m.text).join("\n");
  ok("one rep is \"1 rep\", one day \"1 day\", all practice \"all in practice\", the voiced th \"TH (v)\"",
    solo1.subject === "Last week on Sona: 1 rep" && solo1.text.includes("- Said their sound out loud on 1 day") && solo1.text.includes("- 1 rep: all in practice") && solo1.text.includes("- Sound: TH (v)"), solo1.text);
  ok("more than five sounds: the first five, then how many more", many.text.includes("P, B, M, N, S and 2 more"), many.text);
  ok("a child with no reps that week: \"No practice last week.\"", many.text.includes("Child 2\n- No practice last week."), many.text);
  ok("\"Nice work keeping it going\" only when every child kept the plan, never under \"No practice last week.\"", kept.text.includes("That’s the plan you set.") && !keptButQuiet.text.includes("That’s the plan you set.") && keptButQuiet.text.includes("Every rep counts."));
  ok("a child whose days a week nobody picked: the goal days, with no \"(your plan: …)\", and never \"That’s the plan you set.\", however many days they kept",
    unplanned.text.includes("- Reached the daily goal on 6 days\n") && !/your plan|plan you set/.test(unplanned.text + unplanned.html) && unplanned.text.includes("Every rep counts."), unplanned.text);
  ok("…and beside a brother who kept his picked plan, his line names it and the cheer still waits for every child to have one",
    halfPlanned.text.includes("(your plan: 5 days a week)") && halfPlanned.text.includes("- Reached the daily goal on 6 days\n") && !halfPlanned.text.includes("That’s the plan you set."), halfPlanned.text);
  ok("signed \"Rachel, MS, CF-SLP\", with the practice-snapshot hedge and what a rep is", /Rachel, MS, CF-SLP<br>Sona co-founder/.test(many.html) && many.text.includes("A practice snapshot from your phone, not an evaluation.") && many.text.includes("Silence never counts."));
  ok("no clinical words, no grade, no promise, no price, no credential claim (the report and the confirm email)", !/therapy|treatment|diagnos|score|correctly|forever|accura|\bCCC\b|certified|\$\d/i.test(all), all.match(/therapy|treatment|diagnos|score|correctly|forever|accura|\bCCC\b|certified|\$\d/i));
  ok("no emoji (one sent the first test into spam)", !/\p{Extended_Pictographic}/u.test(all));
  ok("the html escapes what it prints", !/<b>|<script/.test(R.render("2026-10-12", [kid({ s: ["<b>"] })], u, "<script>").html.replace(/<\/?(p|div|br|a|html|body)[^>]*>/g, "")));
}

// 4. /api/report and its confirm link, with only their neighbours stubbed
{
  db = store(["gone@example.com"]); outbox.length = 0; resendStatus = 200;
  let configured = true;
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch;
  try {
    const R2 = loadTs(path.join(REPO, "lib/report.ts"), { "@/lib/slpAuth": { kvCmd: (c) => db.cmd(c), kvConfigured: () => configured }, "@/lib/nurture": N });
    const stubs = { "@/lib/slpAuth": { kvCmd: (c) => db.cmd(c), kvConfigured: () => configured }, "@/lib/rateLimit": { rateLimit: async () => null }, "@/lib/report": R2 };
    const route = loadTs(path.join(REPO, "app/api/report/route.ts"), stubs);
    const conf = loadTs(path.join(REPO, "app/api/report/confirm/route.ts"), stubs);
    const { NextRequest } = require(path.join(REPO, "node_modules/next/server"));
    const post = async (body, origin = "https://speaksona.com") => {
      const raw = typeof body === "string" ? body : JSON.stringify(body);
      const r = await route.POST(new NextRequest("https://speaksona.com/api/report", { method: "POST", headers: Object.assign({ "content-type": "application/json" }, origin ? { origin } : {}), body: raw }));
      return { status: r.status, json: await r.json() };
    };
    const week = (wk) => ({ wk, kids: [kid()] });
    const thisWeek = R2.mondayOf(Date.now()), lastWeek = R2.mondayOf(Date.now() - 7 * 24 * 3600000);
    const body = { email: "mom@example.com", dev: DEV, weeks: [week(lastWeek), week(thisWeek)] };
    const r0 = await post(body);
    ok("the route: a phone not yet confirmed is \"pending\", nothing kept, and the confirm email goes", r0.status === 200 && r0.json.pending === true && db.h.size === 0 && outbox.length === 1, r0);
    const link = new URL(outbox[0].body.text.match(/https:\/\/speaksona\.com\/api\/report\/confirm\?\S+/)[0]);
    const page = async (method, href) => { const r = await conf[method](new NextRequest(href, { method })); return { status: r.status, html: await r.text() }; };
    const g = await page("GET", link.href);
    ok("the confirm link's page asks with one button and changes nothing (a mail scanner opens links)", /Yes, send me the report/.test(g.html) && /<form method="post"/.test(g.html) && !db.sets.has(R2.confirmKey(R2.mailHash("mom@example.com", "s3cret"))), g.html.slice(0, 200));
    const bad = await page("POST", link.href.replace(/k=[a-f0-9]+/, "k=" + "0".repeat(32)));
    ok("…a forged link confirms nothing", /didn’t work/.test(bad.html) && !db.sets.has(R2.confirmKey(R2.mailHash("mom@example.com", "s3cret"))));
    const yes = await page("POST", link.href);
    ok("…the button confirms that phone", /all set/.test(yes.html) && db.sets.get(R2.confirmKey(R2.mailHash("mom@example.com", "s3cret"))).has(DEV));
    const r1 = await post(body);
    ok("then the route keeps the report and says ok", r1.status === 200 && r1.json.ok === true && !r1.json.pending && db.h.get("report:wk:" + thisWeek).has("mom@example.com " + DEV), r1);
    ok("…refuses another site, or no Origin (a browser always sends one)", (await post(body, "https://evil.example")).status === 403 && (await post(body, null)).status === 403);
    ok("…refuses a body that is not a report, and one too big", (await post({ email: "x" })).status === 400 && (await post("{bad")).status === 400 && (await post(Object.assign({}, body, { pad: "x".repeat(5000) }))).status === 413);
    const off = await post(Object.assign({}, body, { email: "gone@example.com" }));
    ok("…tells a stranger nothing about who unsubscribed: an unconfirmed phone of an unsubscribed address gets \"pending\" too", off.status === 200 && off.json.pending === true && !off.json.off, off);
    configured = false;
    const down = await post(body);
    ok("…and with no store, 503 and retry (never a quiet ok)", down.status === 503 && down.json.retry === true, down);
    db.sets.get("email:unsub").add("gone@example.com");
    const goneLink = new URL(`https://speaksona.com/api/report/confirm?e=gone%40example.com&d=${DEV}&k=${R2.confirmToken("gone@example.com", DEV, "s3cret")}`);
    const goneYes = await page("POST", goneLink.href);
    ok("…a confirm link for an address that has since unsubscribed says so, never \"all set\"", /unsubscribed/.test(goneYes.html) && !/all set/.test(goneYes.html), goneYes.html.slice(0, 300));
    // /api/email/unsub stops every spelling of the inbox: it keeps the plain mailbox too
    process.env.KV_REST_API_URL = "https://kv.test"; process.env.KV_REST_API_TOKEN = "t";
    globalThis.fetch = async (u, init) => ({ ok: true, json: async () => ({ result: await db.cmd(JSON.parse(init.body)) }) });
    const unsub = loadTs(path.join(REPO, "app/api/email/unsub/route.ts"), { "@/lib/report": R2 });
    const e = "j.smith+sona@gmail.com";
    await unsub.POST(new NextRequest(`https://speaksona.com/api/email/unsub?e=${encodeURIComponent(e)}&k=${N.unsubToken(e, "s3cret")}`, { method: "POST" }));
    ok("unsubscribing one spelling of a Gmail inbox stops them all (the plain mailbox is kept too)", db.sets.get("email:unsub").has(e) && db.sets.get("email:unsub").has("jsmith@gmail.com") && await R2.suppressed("jsmith@gmail.com", db.cmd) === true);
    globalThis.fetch = fakeFetch;
    const src = readFileSync(path.join(REPO, "app/api/report/route.ts"), "utf8");
    ok("…rate limited per IP (an IPv6 /64 counts as one), and never logs the address", /rateLimit\(req, \{ key: "report", limit: 40, windowSec: 3600, v6prefix: true \}\)/.test(src) && !/console\./.test(src));
  } finally { globalThis.fetch = realFetch; }
}

// 5. the wiring
{
  const cron = readFileSync(path.join(REPO, "app/api/cron/nurture/route.ts"), "utf8"), vercel = JSON.parse(readFileSync(path.join(REPO, "vercel.json"), "utf8")).crons;
  ok("the daily cron sends the report (it decides the day) with a time budget under maxDuration, and a cron runs it daily", /await runReports\([\s\S]{0,200}deadline: started \+ 200000/.test(cron) && /maxDuration = 300/.test(cron) && /import \{ runReports \} from "@\/lib\/report"/.test(cron) && vercel.some((c) => c.path === "/api/cron/nurture" && /^\d+ \d+ \* \* \*$/.test(c.schedule)));
  const sona = readFileSync(path.join(ROOT, "sona.js"), "utf8"), ob = readFileSync(path.join(ROOT, "onboarding.html"), "utf8");
  const noExport = (sona.match(/const NO_EXPORT = \[[^\]]*\]/) || [""])[0], noImport = (sona.match(/const NO_IMPORT = \[[^\]]*\]/) || [""])[0];
  ok("the phone's device id and last send are this phone's own: on NO_EXPORT and NO_IMPORT", /"sona\.report\.v1"/.test(noExport) && /"sona\.report\.v1"/.test(noImport));
  ok("setup asks for the report only with an address given on the email step, and posts once as it ends", /if\(draft\.role!=="slp"&&draft\.email&&ORDER\.indexOf\("updates"\)>-1\)\{prof\.weeklyEmail=true;prof\.weeklyReport=true;\}/.test(ob) && /postParentLead\(draft\.email\);\s*\/\/[^\n]*\n[^\n]*\n\s*try\{if\(Sona\.reportSync\)Sona\.reportSync\(true\);\}catch\(e\)\{\}/.test(ob));
  ok("the email step's heading is the ask", /<h1 class="qh" id="updTitle" tabindex="-1">Get the weekly progress report<\/h1>/.test(ob));
  const priv = readFileSync(path.join(ROOT, "privacy.html"), "utf8");
  ok("the privacy policy says what the report sends, that nothing is kept until confirmed, and for how long", priv.includes("<h2>The weekly progress report (only if a grown-up asks for it)</h2>") && /Never a name, an age, a word, a voice/.test(priv) && /Nothing is kept until you tap the confirm link/.test(priv) && /three weeks/.test(priv) && /120 days/.test(priv));
  ok("the plan screen no longer says a practice recap \"stays on this device\"", !/stays on this device/.test(readFileSync(path.join(ROOT, "subscribe.html"), "utf8")));
}

// ── the phone half, in a browser ──
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2", json: "application/json", webmanifest: "application/manifest+json" };
let answer = { ok: true };
const posts = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__seed") { res.end("<!doctype html><title>Seed</title>"); return; }
  if (url.pathname === "/__page") { res.writeHead(200, { "content-type": "text/html" }); res.end('<!doctype html><title>Page</title><script src="/sona.js"></script>'); return; }
  if (url.pathname === "/api/report") {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { posts.push(JSON.parse(b)); res.writeHead(answer.status || 200, { "content-type": "application/json" }); res.end(JSON.stringify(answer.status ? { ok: false, retry: true } : answer)); });
    return;
  }
  if (url.pathname.startsWith("/api/")) { res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); return; }
  const file = path.join(ROOT, url.pathname);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch(launchOpts());

// Thursday 15 Oct 2026, 10:00 in Idaho: this week is Mon 12, last week Mon 5.
const AT = Date.UTC(2026, 9, 15, 16, 0, 0);
const MILO = { childName: "Milo", childAge: "6", focusSounds: ["R", "S"], onboarded: true, weeklyGoal: 3, email: "Parent@Example.com", weeklyEmail: true, weeklyReport: true, volume: 0, voiceOn: false, soundOn: false };
// Ava's days a week were never picked (set up after 22 Oct 2026: setup no longer asks them)
const AVA = { childName: "Ava", childAge: "4", focusSounds: ["L"], onboarded: true, email: "", volume: 0, voiceOn: false, soundOn: false };
const SEED = {
  "sona.kids.v1": { active: "", list: [{ slot: "", name: "Milo" }, { slot: "k2", name: "Ava" }, { slot: "k3", name: "Zed" }, { slot: "k4", name: "Clin" }] },
  "sona.profile.v1": MILO,
  "sona.outcomes.v1": { R: { attempts: 15, passes: 8, days: { "2026-10-05": { a: 10, p: 6, tries: 10 }, "2026-10-07": { a: 5, p: 2, tries: 5 } } }, S: { attempts: 4, passes: 1, days: { "2026-10-13": { a: 4, p: 1, tries: 4 } } } },
  "sona.gamereps.v1": { "2026-10-07": { R: 3 }, "2026-10-14": { S: 2 } },
  "sona.goaldays.v1": { "2026-10-05": 30 },
  "sona.profile.v1@k2": AVA,
  "sona.gamereps.v1@k2": { "2026-10-09": { L: 6 } },
  "sona.profile.v1@k3": { childName: "Zed", onboarded: false },          // not set up yet: not counted
  "sona.profile.v1@k4": { childName: "Clin", onboarded: true, role: "slp" }, // a clinician's own setup: not counted
};
async function fresh(seed = SEED) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "America/Denver" });
  await context.route("**/*", (route) => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await context.addInitScript((SHIFT) => {
    const RealDate = Date;
    const now = () => RealDate.now() + SHIFT + (window.__jump || Number(sessionStorage.getItem("sona.test.clockJump")) || 0);
    class ShiftedDate extends RealDate { constructor(...a) { if (a.length === 0) super(now()); else super(...a); } static now() { return now(); } }
    window.Date = ShiftedDate;
  }, AT - Date.now());
  const page = await context.newPage(); page.setDefaultTimeout(4000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/__seed");
  await page.evaluate((s) => {
    ["", "2", "3", "4", "5"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", "done"));
    localStorage.setItem("sona.freever.v1", "kept"); localStorage.setItem("sona.buddyset.v1", "kept");
    Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  }, seed);
  return { context, page, errors };
}
const settle = (page, ms = 400) => page.waitForTimeout(ms);

await scenario("the phone sends a few numbers, only when asked", async () => {
  posts.length = 0; answer = { ok: true };
  const { context, page, errors } = await fresh();
  await page.goto(origin + "/today.html"); await page.waitForFunction(() => window.Sona); await settle(page, 1200);
  ok("Home sends nothing and keeps no report state (it writes nothing)", posts.length === 0 && await page.evaluate(() => localStorage.getItem("sona.report.v1") === null));
  await page.goto(origin + "/__page"); await page.waitForFunction(() => window.Sona);
  ok("the address is the one whose setup asked for the report, lowercased", await page.evaluate(() => Sona.reportEmail()) === "parent@example.com");
  await page.evaluate(() => Sona.gameRep("R")); await settle(page);
  ok("a rep sends at once (the first in 30 minutes)", posts.length === 1, posts.length);
  const p = posts[0] || {};
  ok("…the address, a random device id, and last week then this week (local Mondays)", p.email === "parent@example.com" && /^[a-f0-9]{32}$/.test(p.dev) && JSON.stringify((p.weeks || []).map((w) => w.wk)) === '["2026-10-05","2026-10-12"]', p);
  const last = (p.weeks || [])[0] || {}, cur = (p.weeks || [])[1] || {};
  const noId = (kids) => JSON.stringify((kids || []).map(({ i, ...k }) => k));
  ok("…last week, child by child: days with a rep, goal days, the plan (only Milo's, the one a grown-up picked: never the default 4 for Ava), reps, practice tries, the sounds",
    noId(last.kids) === JSON.stringify([{ d: 2, g: 1, r: 18, p: 15, s: ["R"], gw: 3 }, { d: 1, g: 0, r: 6, p: 0, s: ["L"] }]), last.kids);
  ok("…this week so far, today's rep in it", noId(cur.kids) === JSON.stringify([{ d: 3, g: 0, r: 7, p: 4, s: ["S", "R"], gw: 3 }, { d: 0, g: 0, r: 0, p: 0, s: [] }]), cur.kids);
  const ids = await page.evaluate(() => [JSON.parse(localStorage.getItem("sona.profile.v1")).reportId, JSON.parse(localStorage.getItem("sona.profile.v1@k2")).reportId]);
  ok("…each child with its own random id, kept on its profile (so a backup carries it) and the same in both weeks",
    (last.kids || []).every((k) => /^[a-f0-9]{16}$/.test(k.i)) && last.kids[0].i === ids[0] && last.kids[1].i === ids[1] && ids[0] !== ids[1] && cur.kids[0].i === ids[0], [ids, last.kids]);
  ok("…never a name, an age, a word or a pass rate: only the children set up as a family's (not one being set up, not a clinician's)",
    !/Milo|Ava|Zed|Clin|childAge|"age"|rabbit|passes|"a":/.test(JSON.stringify(p)) && (last.kids || []).length === 2, JSON.stringify(p));
  await page.evaluate(() => { Sona.gameRep("R"); Sona.gameRep("R"); }); await settle(page);
  ok("more reps within 30 minutes send nothing more", posts.length === 1, posts.length);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); }); await settle(page);
  ok("…until the page goes to the background: then once, with those reps", posts.length === 2 && posts[1].weeks[1].kids[0].r === 9, posts.map((x) => x.weeks[1].kids[0].r));
  await page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("pagehide")); }); await settle(page);
  ok("…and a second hide with nothing new sends nothing", posts.length === 2, posts.length);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); window.__jump = 31 * 60 * 1000; Sona.gameRep("S"); }); await settle(page);
  ok("31 minutes later a rep sends again, from the same device id", posts.length === 3 && posts[2].dev === posts[0].dev, posts.length);
  const backup = await page.evaluate(() => Sona.exportString());
  ok("a backup never carries the device id, and does carry each child's id", !/sona\.report\.v1/.test(backup) && backup.includes(posts[0].weeks[0].kids[0].i));
  // a post that fails is tried again five minutes later, not thirty
  answer = { status: 503 };
  const before = posts.length;
  await page.evaluate(() => { window.__jump = 62 * 60 * 1000; Sona.gameRep("R"); }); await settle(page);
  await page.evaluate(() => { window.__jump = 64 * 60 * 1000; Sona.gameRep("R"); }); await settle(page);
  answer = { ok: true };
  await page.evaluate(() => { window.__jump = 68 * 60 * 1000; Sona.gameRep("R"); }); await settle(page);
  ok("a failed post (the server said 503) is tried again five minutes later, not thirty", posts.length === before + 2, posts.length - before);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("an address that unsubscribed stops the phone", async () => {
  posts.length = 0; answer = { ok: true, off: true };
  const { context, page, errors } = await fresh();
  await page.goto(origin + "/__page"); await page.waitForFunction(() => window.Sona);
  await page.evaluate(() => Sona.gameRep("R")); await settle(page);
  await page.evaluate(() => { window.__jump = 40 * 60 * 1000; Sona.gameRep("R"); }); await settle(page);
  await page.evaluate(() => Sona.reportSync(true)); await settle(page);
  ok("told \"off\", the phone sends nothing more, even when asked", posts.length === 1 && await page.evaluate(() => JSON.parse(localStorage.getItem("sona.report.v1")).off === "parent@example.com"), posts.length);
  await page.evaluate(() => { window.__jump = 31 * 24 * 3600000; Sona.gameRep("R"); }); await settle(page);
  ok("…and checks once a month whether the address is back, with no child's numbers", posts.length === 2 && posts[1].weeks.every((w) => w.kids.length === 0), posts[1] && posts[1].weeks);
  answer = { ok: true, pending: true };
  await page.evaluate(() => { window.__jump = 62 * 24 * 3600000; Sona.gameRep("R"); }); await settle(page);
  await page.evaluate(() => { window.__jump = 62 * 24 * 3600000 + 3600000; Sona.gameRep("R"); Sona.reportSync(true); }); await settle(page);
  ok("…and a \"pending\" answer never ends \"off\" (the phone does not start sending numbers again)", posts.length === 3 && posts[2].weeks.every((w) => w.kids.length === 0) && await page.evaluate(() => JSON.parse(localStorage.getItem("sona.report.v1")).off === "parent@example.com"), posts.length);
  ok("no page errors", errors.length === 0, errors);
  answer = { ok: true };
  await context.close();
});

await scenario("a phone nobody confirmed checks in once a day after two weeks, and gives up after eight", async () => {
  posts.length = 0; answer = { ok: true, pending: true };
  const { context, page, errors } = await fresh();
  await page.goto(origin + "/__page"); await page.waitForFunction(() => window.Sona);
  await page.evaluate(() => Sona.gameRep("R")); await settle(page);
  await page.evaluate(() => { window.__jump = 40 * 60 * 1000; Sona.gameRep("R"); }); await settle(page);
  ok("pending: the phone keeps posting every 30 minutes at first (the parent may tap the link any minute)", posts.length === 2 && await page.evaluate(() => JSON.parse(localStorage.getItem("sona.report.v1")).pend > 0), posts.length);
  await page.evaluate(() => { window.__jump = 15 * 24 * 3600000; Sona.gameRep("R"); }); await settle(page);
  await page.evaluate(() => { window.__jump = 15 * 24 * 3600000 + 3600000; Sona.gameRep("R"); Sona.reportSync(true); }); await settle(page);
  ok("…two weeks on, at most once a day, even when a page hides or asks", posts.length === 3, posts.length);
  await page.evaluate(() => { window.__jump = 16 * 24 * 3600000 + 7200000; Sona.gameRep("R"); }); await settle(page);
  ok("…the next day, once more (a late tap on the link starts the report within a day)", posts.length === 4, posts.length);
  await page.evaluate(() => { window.__jump = 57 * 24 * 3600000; Sona.gameRep("R"); }); await settle(page);
  ok("…past eight weeks it asks once more, and still \"pending\", it stops asking", posts.length === 5 && await page.evaluate(() => JSON.parse(localStorage.getItem("sona.report.v1")).gaveUp === "parent@example.com"), posts.length);
  await page.evaluate(() => { window.__jump = 59 * 24 * 3600000; Sona.gameRep("R"); Sona.reportSync(true); }); await settle(page);
  ok("…then nothing for a month, even when a page hides or asks", posts.length === 5, posts.length);
  answer = { ok: true };
  await page.evaluate(() => { window.__jump = 88 * 24 * 3600000; Sona.gameRep("R"); }); await settle(page);
  ok("…a month on, one quiet check: no child's numbers, and marked quiet (the server never sends a link for it)", posts.length === 6 && posts[5].quiet === true && posts[5].weeks.every((w) => w.kids.length === 0), posts[5]);
  await page.evaluate(() => { window.__jump = 88 * 24 * 3600000 + 31 * 60 * 1000; Sona.gameRep("R"); }); await settle(page);
  ok("…and a late tap on the link (that check heard a plain ok) starts the report: numbers again, every 30 minutes", posts.length === 7 && !posts[6].quiet && posts[6].weeks[1].kids.length === 2 && await page.evaluate(() => !JSON.parse(localStorage.getItem("sona.report.v1")).gaveUp), posts.length);
  await context.close();
  // a late tap: back to every 30 minutes
  posts.length = 0; answer = { ok: true, pending: true };
  const second = await fresh();
  await second.page.goto(origin + "/__page"); await second.page.waitForFunction(() => window.Sona);
  await second.page.evaluate(() => Sona.gameRep("R")); await settle(second.page);
  answer = { ok: true };
  await second.page.evaluate(() => { window.__jump = 15 * 24 * 3600000; Sona.gameRep("R"); }); await settle(second.page);
  await second.page.evaluate(() => { window.__jump = 15 * 24 * 3600000 + 31 * 60 * 1000; Sona.gameRep("R"); }); await settle(second.page);
  ok("…once the link is tapped (a plain ok), back to every 30 minutes", posts.length === 3 && await second.page.evaluate(() => !JSON.parse(localStorage.getItem("sona.report.v1")).pend), posts.length);
  ok("no page errors", second.errors.length === 0, second.errors);
  await second.context.close();
  return;
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("a household that did not ask sends nothing", async () => {
  posts.length = 0;
  const noAsk = Object.assign({}, SEED, { "sona.profile.v1": Object.assign({}, MILO, { weeklyReport: undefined }) }); // the email step from before 15 Oct: tips, not a report
  const { context, page, errors } = await fresh(noAsk);
  await page.goto(origin + "/__page"); await page.waitForFunction(() => window.Sona);
  await page.evaluate(() => { Sona.gameRep("R"); Sona.reportSync(true); }); await settle(page);
  ok("an address given for tips (weeklyEmail alone) never sends a child's numbers", posts.length === 0 && await page.evaluate(() => Sona.reportEmail() === "" && localStorage.getItem("sona.report.v1") === null));
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await browser.close(); server.close();
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
