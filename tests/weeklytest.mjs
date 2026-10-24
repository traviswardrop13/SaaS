// WEEKLY1: the Monday email (Travis, 23 Oct 2026: "1 email a week that's
// kind of like the weekly progress report. And just send it to everybody ...
// if they're not signed up, it'll just say like what they could be
// monitoring"; then "Parents only" and "Yes, add the switch").
// The server half (lib/weekly.ts, the daily cron): every parent on the list,
// once a week, after their three welcome emails, never one who left, never a
// speech therapist, never anyone already getting the real report; the
// example is the real report's own lines with made-up numbers. The phone half
// (settings.html, sona.js reportSet / reportOff): the switch the example
// points to turns the real report on and off.
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
const read = (f) => readFileSync(path.join(REPO, f), "utf8");

const TSOPT = { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } };
function loadTs(file, stubs = {}, cache = new Map()) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const js = ts.transpileModule(readFileSync(file, "utf8"), TSOPT).outputText;
  const req = (s) => stubs[s] || (s.startsWith("@/") ? loadTs(path.join(REPO, s.slice(2) + ".ts"), stubs, cache) : s === "next/server" ? require(path.join(REPO, "node_modules/next/server")) : require(s));
  new Function("require", "module", "exports", js)(req, mod, mod.exports);
  return mod.exports;
}
// the commands the Monday email uses, in memory; `down` leaves every call unanswered
function store(unsub = []) {
  const kv = new Map(), sets = new Map([["email:unsub", new Set(unsub)]]), z = new Map(), calls = [];
  const db = {
    kv, sets, z, calls, h: new Map(), llen: 0, down: false,
    cmd: async (c) => {
      calls.push(c);
      if (db.down) return undefined;
      const [op, ...a] = c;
      if (op === "SET") { if (a.includes("NX") && kv.has(a[0])) return null; kv.set(a[0], String(a[1])); return "OK"; }
      if (op === "GET") return kv.has(a[0]) ? kv.get(a[0]) : null;
      if (op === "DEL") return kv.delete(a[0]) ? 1 : 0;
      if (op === "EXISTS") return kv.has(a[0]) ? 1 : 0;
      if (op === "SISMEMBER") return (sets.get(a[0]) || new Set()).has(a[1]) ? 1 : 0;
      if (op === "SCARD") return (sets.get(a[0]) || new Set()).size;
      if (op === "SMEMBERS") return [...(sets.get(a[0]) || [])];
      if (op === "ZSCORE") return z.has(a[1]) ? String(z.get(a[1])) : null;
      if (op === "SADD") { const m = sets.get(a[0]) || new Set(); let n = 0; a.slice(1).forEach((x) => { if (!m.has(x)) { n++; m.add(x); } }); sets.set(a[0], m); return n; }
      if (op === "SREM") { const m = sets.get(a[0]) || new Set(); const had = m.delete(a[1]); return had ? 1 : 0; }
      if (op === "HSET") { const m = db.h.get(a[0]) || new Map(); m.set(a[1], a[2]); db.h.set(a[0], m); return 1; }
      if (op === "HDEL") { const m = db.h.get(a[0]); return m && m.delete(a[1]) ? 1 : 0; }
      if (op === "HKEYS") return [...(db.h.get(a[0]) || new Map()).keys()];
      if (op === "HGETALL") { const m = db.h.get(a[0]); return m ? [...m].flat() : []; }
      if (op === "EXPIRE" || op === "EXPIREAT") return 1;
      if (op === "LLEN") return db.llen || 0;
      throw new Error("unexpected " + op);
    },
  };
  return db;
}
const outbox = [];
let resendStatus = 200;
const fakeFetch = async (u, init) => { outbox.push({ url: u, headers: init.headers, body: JSON.parse(init.body) }); return { ok: resendStatus === 200, status: resendStatus }; };
const noSleep = async () => {};

process.env.RESEND_API_KEY = "re_test"; process.env.UNSUB_SECRET = "s3cret"; process.env.EMAIL_POSTAL = "851 NE 1st Ave, Unit 4103, Miami, FL 33132";
let db = store();
const N = loadTs(path.join(REPO, "lib/nurture.ts"));
const stubs = {
  "@/lib/slpAuth": { kvCmd: (c) => db.cmd(c), kvConfigured: () => true },
  "@/lib/nurture": N,
  "@/lib/contacts": { KIT_DONE: "resend:kitunsub", everyone: async () => [] },
};
const cache = new Map();
const R = loadTs(path.join(REPO, "lib/report.ts"), stubs, cache);
stubs["@/lib/report"] = R;
const W = loadTs(path.join(REPO, "lib/weekly.ts"), stubs, cache);
const DAY = 86400000;

// Monday 26 Oct 2026, 16:00 UTC: the email is dated the week of Mon 19
const MON = Date.parse("2026-10-26T16:00:00Z"), TUE = MON + DAY, THU = MON + 3 * DAY, NEXT = MON + 7 * DAY;
const WK = "2026-10-19";
const joined = (email, ms) => db.kv.set("nurture:0:" + email, new Date(ms).toISOString());
const person = (email, role = "parent") => ({ email, firstName: "", role, source: "parents", plan: "" });
const to = (from = 0) => outbox.slice(from).map((m) => m.body.to[0]);
const run = (now, people, opts = {}) => W.runWeekly(db.cmd, fakeFetch, now, Object.assign({ sleep: noSleep, people: async () => people }, opts));

ok("the Kit mark is the one lib/contacts sets (the stub's name is the real one)", /export const KIT_DONE = "resend:kitunsub"/.test(read("lib/contacts.ts")));

await scenario("who gets the Monday email", async () => {
  db = store(["gone@example.com", "mom@gmail.com"]);
  const after = MON - 6 * DAY; // signed up 20 Oct: after Resend took the list, series long done
  ["new@example.com", "norole@example.com", "series@example.com", "fresh@example.com", "gone@example.com", "m.o.m+sona@gmail.com",
    "report@example.com", "household@example.com", "slp@example.com", "other@example.com"].forEach((e) => joined(e, after));
  joined("fresh@example.com", MON - 1 * DAY);          // started Premium yesterday: the series stopped, but it is too soon
  joined("kitera@example.com", Date.parse("2026-10-10T12:00:00Z")); // joined while Kit held the list
  db.z.set("series@example.com", MON + DAY);            // the recast tip still to come
  db.kv.set(R.sentKey(WK, "report@example.com"), "1"); // this week's real report already went
  db.sets.set(R.confirmKey(R.mailHash("Household@Example.com", "s3cret")), new Set(["0123456789abcdef0123456789abcdef"])); // a confirmed phone, a quiet week
  const people = [
    person("new@example.com"), person("norole@example.com", ""), person("NEW@example.com"), person("series@example.com"), person("fresh@example.com"),
    person("gone@example.com"), person("m.o.m+sona@gmail.com"), person("report@example.com"), person("household@example.com"),
    person("slp@example.com", "slp"), person("other@example.com", "other"), person("kitera@example.com"), person("older@example.com"),
    person("x".repeat(120) + "@example.com"), person("not an address"),
  ];
  const m = outbox.length;
  const r = await run(THU, people);
  ok("not a send day (Thursday): nothing", r.week === null && r.sent === 0 && outbox.length === m, r);
  const r1 = await run(MON, people);
  ok("Monday: a parent and a lead with no role, once each (the same address twice is one)", JSON.stringify(to(m).sort()) === '["new@example.com","norole@example.com"]', to(m));
  ok("…never a speech therapist or someone who chose \"Other\"", !to(m).some((e) => /slp|other/.test(e)));
  ok("…not while their welcome series is on, nor in their first three days", !to(m).some((e) => /series|fresh/.test(e)));
  ok("…never an unsubscribed address, or its plain mailbox (Gmail dots and a +tag)", !to(m).some((e) => /gone|m\.o\.m/.test(e)));
  ok("…never anyone who gets the real report: sent this week, or a phone confirmed for it", !to(m).some((e) => /report|household/.test(e)));
  ok("…an address from before Resend took the list (or with no sign-up time) waits for Kit's leavers", !to(m).some((e) => /kitera|older/.test(e)) && r1.waiting === 2, r1);
  ok("…and an address the unsubscribe link cannot carry is never tried", !to(m).some((e) => /xxxx|not an/.test(e)));
  ok("the run says what it did: the week, the people, two sent", r1.week === WK && r1.sent === 2 && r1.people === 10, r1);
  const m2 = outbox.length;
  const r2 = await run(TUE, people);
  ok("Tuesday's catch-up sends nothing twice", r2.sent === 0 && outbox.length === m2, r2);
  db.kv.set("resend:kitunsub", JSON.stringify({ at: "x", added: 3 }));
  const r3 = await run(TUE + 1000, people);
  ok("…and once Kit's leavers are in, the older addresses get theirs that week", JSON.stringify(to(m2).sort()) === '["kitera@example.com","older@example.com"]' && r3.sent === 2, to(m2));
  const passed = db.calls.length; await run(TUE + 2000, people);
  ok("an address done (or not for this week) costs the catch-up one call", db.calls.length - passed <= people.length + 2, db.calls.length - passed);
  const m3 = outbox.length;
  db.z.delete("series@example.com");
  await run(NEXT, people);
  // report@ was sent last week's real report, with no phone confirmed for it now
  ok("next Monday: everyone again, the series now done (once a week, every week)", JSON.stringify(to(m3).sort()) === JSON.stringify(["fresh@example.com", "kitera@example.com", "new@example.com", "norole@example.com", "older@example.com", "report@example.com", "series@example.com"]), to(m3));
});

await scenario("what goes wrong", async () => {
  db = store(); const people = [person("a@example.com"), person("b@example.com")];
  ["a@example.com", "b@example.com"].forEach((e) => joined(e, MON - 6 * DAY));
  resendStatus = 500; const m = outbox.length;
  const r = await run(MON, people);
  ok("Resend refusing: nothing counted sent, and the mark is given back", r.sent === 0 && r.failed === 2 && !db.kv.has(W.weeklyKey(WK, "a@example.com")), r);
  resendStatus = 200;
  const r2 = await run(TUE, people);
  ok("…so the next run sends them", r2.sent === 2 && outbox.length - m === 4, r2);
  db = store(); ["a@example.com", "b@example.com"].forEach((e) => joined(e, MON - 6 * DAY));
  resendStatus = 429; const m2 = outbox.length;
  const r3 = await run(MON, people);
  resendStatus = 200;
  ok("a 429, and a 429 again after a longer pause: the run stops, nothing more tried, the mark given back", r3.stopped === "rate" && outbox.length - m2 === 2 && !db.kv.has(W.weeklyKey(WK, "a@example.com")), r3);
  db.down = true;
  const r4 = await run(MON, people);
  db.down = false;
  ok("the store not answering: nothing sent", r4.sent === 0, r4);
  const r5 = await run(MON, people, { deadline: Date.now() - 1 });
  ok("out of time: it stops before claiming anyone", r5.stopped === "time" && r5.sent === 0 && !db.kv.has(W.weeklyKey(WK, "a@example.com")), r5);
  const r6 = await W.runWeekly(db.cmd, fakeFetch, MON, { sleep: noSleep, people: async () => { throw new Error("list down"); } });
  ok("a list that cannot be read: nothing sent, and it says so", r6.sent === 0 && r6.stopped === "no list", r6);
  const r7 = await run(THU, people, { force: true });
  ok("a founder's manual run (?weekly=1) sends on any day, still once a week", r7.sent === 2 && (await run(THU + 1, people, { force: true })).sent === 0, r7);
  // at most WEEKLY_CAP a run; the next run carries on, and the order turns with the week
  db = store(); const many = [];
  for (let i = 0; i < W.WEEKLY_CAP + 10; i++) { const e = "p" + i + "@example.com"; joined(e, MON - 6 * DAY); many.push(person(e)); }
  const m3 = outbox.length;
  const r8 = await run(MON, many);
  const firstTail = new Set(many.map((p) => p.email).filter((e) => !to(m3).includes(e)));
  const r9 = await run(TUE, many);
  ok("at most " + W.WEEKLY_CAP + " a run, the rest the next day", r8.sent === W.WEEKLY_CAP && r8.stopped === "cap" && r9.sent === 10, [r8, r9]);
  db = store(); many.forEach((p) => joined(p.email, MON - 6 * DAY));
  const m4 = outbox.length; await run(NEXT, many);
  const nextTail = many.map((p) => p.email).filter((e) => !to(m4).includes(e));
  ok("…and a different ten wait the next week (the order turns with the week)", nextTail.length === 10 && nextTail.some((e) => !firstTail.has(e)), nextTail);
});

await scenario("a household that turns the report off", async () => {
  db = store(); joined("mom@example.com", MON - 6 * DAY);
  const DEV = "0123456789abcdef0123456789abcdef", DEV2 = "fedcba9876543210fedcba9876543210", h = R.confirmKey(R.mailHash("mom@example.com", "s3cret")), oh = R.offKey(R.mailHash("mom@example.com", "s3cret"));
  db.sets.set(h, new Set([DEV]));
  const kids = [{ i: "0123456789abcdef", d: 2, g: 1, r: 20, p: 10, s: ["R"] }];
  ok("(the phone, confirmed, sent its numbers)", (await R.store({ email: "mom@example.com", dev: DEV, weeks: [{ wk: WK, kids }] }, db.cmd, fakeFetch, MON - 2 * DAY)) === "ok" && db.h.get(R.weekKey(WK)).size === 1);
  // a week two back, posted last week (the phone sends this week and last),
  // and another phone's numbers, and this phone's under another spelling
  db.h.set(R.weekKey("2026-10-12"), new Map([["mom@example.com " + DEV, JSON.stringify(kids)], ["mom@example.com " + DEV2, JSON.stringify(kids)], ["mom+kids@example.com " + DEV, JSON.stringify(kids)]]));
  const snap = R.validate({ email: "mom@example.com", dev: DEV, weeks: [{ wk: WK, kids: [] }, { wk: "2026-10-26", kids: [] }], quiet: true, off: true }, MON);
  ok("Settings' Turn off is a report post the server takes (off, quiet)", !!snap && snap.off === true && snap.quiet === true, snap);
  const m = outbox.length;
  ok("…answered ok, with no email (never a confirm link)", (await R.store(snap, db.cmd, fakeFetch, MON)) === "ok" && outbox.length === m);
  ok("…the phone is marked off for the address, and every week of its numbers the server could hold is gone (not only the two the phone named), under any spelling of the inbox",
    db.sets.get(oh).has(DEV) && db.h.get(R.weekKey(WK)).size === 0 && JSON.stringify([...db.h.get(R.weekKey("2026-10-12")).keys()]) === JSON.stringify(["mom@example.com " + DEV2]), [...db.h.get(R.weekKey("2026-10-12")).keys()]);
  db.h.get(R.weekKey("2026-10-12")).delete("mom@example.com " + DEV2);
  const before = db.h.get(R.weekKey(WK)).size;
  const late = await R.store(R.validate({ email: "mom@example.com", dev: DEV, weeks: [{ wk: WK, kids }] }, MON), db.cmd, fakeFetch, MON);
  ok("a post that left the phone before the Turn off and lands after it keeps nothing, and the mark stays", late === "ok" && db.h.get(R.weekKey(WK)).size === before && db.sets.get(oh).has(DEV), [late, db.h.get(R.weekKey(WK)).size]);
  ok("…its confirmation stays (so an unsubscribed address still hears \"off\" when it is turned on again)", db.sets.get(h).has(DEV));
  // a numbers post that crossed the Turn off put them back
  db.h.get(R.weekKey(WK)).set("mom@example.com " + DEV, JSON.stringify(kids));
  const rep = await R.runReports(db.cmd, fakeFetch, MON, { sleep: noSleep });
  const wk = await run(MON, [person("mom@example.com")]);
  ok("…so Monday sends no report from that phone, even with numbers put back, and the Monday example comes instead", rep.sent === 0 && wk.sent === 1 && to(m).join() === "mom@example.com", [rep, wk, to(m)]);
  const real = await R.confirm("mom@example.com", DEV, db.cmd);
  ok("an old confirm link tapped after Turn off changes nothing (\"off\")", real === "off");
  await R.store(R.validate({ email: "mom@example.com", dev: DEV2, weeks: [{ wk: WK, kids: [] }], off: true }, MON), db.cmd, fakeFetch, MON);
  ok("…nor for a phone that was never confirmed and turned it off before tapping", (await R.confirm("mom@example.com", DEV2, db.cmd)) === "off" && !db.sets.get(h).has(DEV2));
  const cr = read("app/api/report/confirm/route.ts");
  ok("…and the link's page says the report is off on that phone, and where to turn it on", /done === "off"/.test(cr) && /The report is off on that phone/.test(cr) && /turn on Weekly progress report in Settings/.test(cr));
  const back = await R.store(R.validate({ email: "mom@example.com", dev: DEV, weeks: [{ wk: "2026-10-26", kids }], on: true }, MON), db.cmd, fakeFetch, MON);
  ok("turned on again: the phone's post saying so (on) lifts the mark, and its numbers are kept", back === "ok" && !db.sets.get(oh).has(DEV) && db.sets.get(oh).has(DEV2) && db.h.get(R.weekKey("2026-10-26")).size === 1, back);
  ok("…and the mark is kept at least as long as the confirmation (400 days, kept fresh with it)", R.OFF_KEEP_SEC === 400 * 86400 && db.calls.some((c) => c[0] === "EXPIRE" && c[1] === oh && c[2] === R.OFF_KEEP_SEC));
  const skew = R.validate({ email: "mom@example.com", dev: DEV, weeks: [{ wk: "2026-09-07", kids: [] }], off: true }, MON);
  ok("a Turn off from a phone whose clock is weeks wrong is still heard (the server picks the weeks)", !!skew && skew.off === true && skew.weeks.length === 0, skew);
  ok("…and needs no weeks at all, while an ordinary post still does", !!R.validate({ email: "mom@example.com", dev: DEV, off: true }, MON) && !R.validate({ email: "mom@example.com", dev: DEV }, MON));
  const m2 = outbox.length; await run(NEXT, [person("mom@example.com")]);
  ok("…and the Monday example stops again (the real report is theirs)", outbox.length === m2);
  // an unsubscribed address, its phone confirmed: off, then on, still hears "off"
  db = store(["gone@example.com"]); const gh = R.confirmKey(R.mailHash("gone@example.com", "s3cret"));
  db.sets.set(gh, new Set([DEV]));
  await R.store(R.validate({ email: "gone@example.com", dev: DEV, weeks: [{ wk: WK, kids: [] }], off: true }, MON), db.cmd, fakeFetch, MON);
  ok("an unsubscribed address turned off and on again is told \"off\" (never a link that will not come)", (await R.store(R.validate({ email: "gone@example.com", dev: DEV, weeks: [{ wk: WK, kids }], on: true }, MON), db.cmd, fakeFetch, MON)) === "off");
  db = store(); db.sets.set(h, new Set([DEV]));
  await R.store(R.validate({ email: "mom@example.com", dev: DEV2, weeks: [{ wk: WK, kids: [] }], off: true }, MON), db.cmd, fakeFetch, MON);
  ok("a Turn off names one phone: another phone of the household is not marked", !(db.sets.get(oh) || new Set()).has(DEV));
  db.down = true;
  ok("a store that does not answer a Turn off is an error (the phone keeps it owed)", (await R.store(snap, db.cmd, fakeFetch, MON)) === "error");
});

await scenario("the run says when the list is cut short", async () => {
  db = store(); joined("a@example.com", MON - 6 * DAY);
  db.llen = 9999;
  ok("a ledger under its cap: no warning", !(await run(MON, [person("a@example.com")])).full);
  db = store(); joined("a@example.com", MON - 6 * DAY); db.llen = W.LEDGER_CAP;
  ok("a full ledger: the run says so (the oldest parents are no longer in it)", (await run(MON, [person("a@example.com")])).full === true);
});

await scenario("the email", async () => {
  db = store(); joined("mom@example.com", MON - 6 * DAY);
  const m = outbox.length; await run(MON, [person("mom@example.com")]);
  const e = (outbox[m] || {}).body || {}, h = (outbox[m] || {}).headers || {};
  ok("from Rachel, replies to Rachel", /rachel@speaksona\.com/.test(e.from) && e.reply_to === "rachel@speaksona.com", e.from);
  ok("a working unsubscribe link (the token /api/email/unsub checks), in the body and the header",
    e.html.includes("/api/email/unsub?e=mom%40example.com&k=" + N.unsubToken("mom@example.com", "s3cret")) && /api\/email\/unsub/.test(e.headers["List-Unsubscribe"]) && e.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");
  ok("…and the mailing address, in html and text", e.html.includes("851 NE 1st Ave") && e.text.includes("851 NE 1st Ave"));
  ok("an Idempotency-Key with the week and no address in it", /^weekly-2026-10-19-[a-f0-9]{32}$/.test(h["Idempotency-Key"]) && !/mom/.test(h["Idempotency-Key"]), h["Idempotency-Key"]);
  ok("the subject and preview say what it is, never a count of reps (it is not their child's week)", e.subject === "Your child’s week on Sona, every Monday" && !/\d/.test(e.subject), e.subject);
  const lines = R.kidLines(W.EXAMPLE);
  ok("the example is the real report's own lines, marked Example and dated last week", lines.every((l) => e.text.includes("- " + l)) && e.text.includes("Example · Oct 19 to Oct 25") && lines.length === 4, lines);
  ok("…its numbers said to be made up", /These numbers are made up\. Yours would show your child’s own week\./.test(e.text));
  ok("…and how to get the real one, in the words Settings shows", /tap Grown-ups, and turn on Weekly progress report in Settings/.test(e.text) &&
    /<h2 id="reportTitle">Weekly progress report<\/h2>/.test(readFileSync(path.join(ROOT, "settings.html"), "utf8")));
  ok("…with the App Store link (it opens Sona where it is installed)", e.html.includes(N.APP_URL) && e.text.includes("Open Sona: " + N.APP_URL));
  ok("…what a rep is, and the practice-snapshot hedge", /Silence never counts/.test(e.text) && /a practice snapshot from your phone, not an evaluation/.test(e.text));
  const all = e.subject + e.html + e.text;
  ok("Rachel signs as MS, CF-SLP, never certified/CCC", /Rachel, MS, CF-SLP/.test(all) && !/\bCCC\b|certified/i.test(all));
  ok("practice, never therapy, treatment, diagnosis, a score or a pass rate", !/therapy|treatment|diagnos|score|accura|pass rate|percent|%/i.test(e.text.replace(/https?:\S+/g, "")));
  ok("no emoji, no dollar figure", !/\p{Extended_Pictographic}/u.test(all) && !/\$\d/.test(all));
  ok("no plan line (most families never pick one) and no \"Child 1\"", !/your plan|Child 1/.test(all));
});

ok("the daily cron sends it after the reports, within its time, and ?weekly=1 forces it only on a founder's run", (() => {
  const cron = read("app/api/cron/nurture/route.ts");
  const a = cron.indexOf("await runReports("), b = cron.indexOf("await runWeekly("), c = cron.indexOf("await backfill(");
  const d = Number((cron.slice(b).match(/deadline: started \+ (\d+)/) || [])[1]);
  return a > 0 && b > a && c > b && d > 0 && d < 280000 && /force: okManual && req\.nextUrl\.searchParams\.get\("weekly"\) === "1"/.test(cron) && /import \{ runWeekly \} from "@\/lib\/weekly"/.test(cron);
})());

// ── the phone half: Settings' switch ──
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2", json: "application/json", webmanifest: "application/manifest+json" };
let answer = { ok: true, pending: true };
const leads = [], reports = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__seed") { res.end("<!doctype html><title>Seed</title>"); return; }
  if (url.pathname === "/__page") { res.writeHead(200, { "content-type": "text/html" }); res.end('<!doctype html><title>Page</title><script src="/sona.js"></script>'); return; }
  if (url.pathname === "/api/report" || url.pathname === "/api/lead") {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", async () => {
      const body = JSON.parse(b); body.__at = Date.now();
      (url.pathname === "/api/lead" ? leads : reports).push(body);
      if (url.pathname === "/api/report" && answer.delay && !body.off) await new Promise((r) => setTimeout(r, answer.delay));
      const lead = url.pathname === "/api/lead";
      const reply = answer.off503 && body.off ? { status: 503 } : answer;
      res.writeHead(!lead && reply.status ? reply.status : 200, { "content-type": "application/json" });
      res.end(JSON.stringify(lead ? { ok: true } : reply.status ? { ok: false, retry: true } : { ok: reply.ok, pending: reply.pending, off: reply.off }));
    });
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
const MILO = { childName: "Milo", childAge: "6", focusSounds: ["R"], onboarded: true, volume: 0, voiceOn: false, soundOn: false };
async function fresh(seed) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (route) => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await context.addInitScript(() => { sessionStorage.setItem("sona.gate.v1", String(Date.now())); });
  const page = await context.newPage(); page.setDefaultTimeout(6000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/__seed");
  await page.evaluate((s) => {
    ["", "2", "3", "4", "5"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", "done"));
    localStorage.setItem("sona.freever.v1", "kept"); localStorage.setItem("sona.buddyset.v1", "kept");
    Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  }, seed);
  await page.goto(origin + "/settings.html"); await page.waitForSelector("#reportCard", { state: "attached" }); await page.waitForTimeout(300);
  return { context, page, errors };
}
const cardText = (page) => page.evaluate(() => { const c = document.getElementById("reportCard"); return { shown: !c.hidden && c.getBoundingClientRect().height > 0, text: c.innerText.replace(/\s+/g, " ").trim(), buttons: [...c.querySelectorAll("button")].map((b) => b.textContent.trim()) }; });
// 700 ms: past the card's 600 ms tap lock after it changes shape, as a hand would be
const tap = async (page, text) => { await page.locator("#reportCard button", { hasText: text }).first().click(); await page.waitForTimeout(700); };

await scenario("Settings turns the report on", async () => {
  leads.length = 0; reports.length = 0; answer = { ok: true, pending: true };
  const { context, page, errors } = await fresh({
    "sona.kids.v1": { active: "", list: [{ slot: "", name: "Milo" }, { slot: "k2", name: "Ava" }] },
    "sona.profile.v1": MILO, "sona.profile.v1@k2": Object.assign({}, MILO, { childName: "Ava", childAge: "4" }),
  });
  let c = await cardText(page);
  ok("a family phone with no report shows the switch: what it holds, a box, Turn on, and Travis's line", c.shown && /Every Monday, an email with last week's practice/.test(c.text) && /Never your child's name or voice/.test(c.text) && JSON.stringify(c.buttons) === '["Turn on"]' && /We'll also send occasional tips from Rachel\. Unsubscribe anytime\./.test(c.text), c);
  ok("…the box is labelled for a grown-up, an email box, empty with no address on the phone", await page.evaluate(() => { const i = document.getElementById("reportEmail"); return i && i.type === "email" && i.value === "" && document.querySelector('label[for="reportEmail"]').textContent === "Grown-up's email"; }));
  await tap(page, "Turn on");
  ok("Turn on with nothing typed asks for the address and sends nothing", /Type the grown-up's email first/.test((await cardText(page)).text) && leads.length === 0 && reports.length === 0);
  await page.fill("#reportEmail", "not-an-email"); await tap(page, "Turn on");
  ok("a wrong-looking address stays, with setup's line, and sends nothing", /That email doesn't look right\./.test((await cardText(page)).text) && leads.length === 0 && reports.length === 0 && await page.evaluate(() => !Sona.reportEmail()));
  await page.fill("#reportEmail", " Dad@Example.com ");
  await page.locator("#reportCard button", { hasText: "Turn on" }).click();
  // a double tap: the second lands where Turn on was, now Turn off, as soon as the card turns
  await page.waitForFunction(() => !!Sona.reportEmail() && document.querySelector("#reportCard button").textContent === "Turn off");
  const second = await page.evaluate(() => { document.querySelector("#reportCard button").click(); return !!Sona.reportEmail(); });
  await page.waitForTimeout(700);
  c = await cardText(page);
  ok("a real address: on, saying where it goes, waiting for the link", /On\. It goes to dad@example\.com every Monday\./.test(c.text) && /Check your email for Sona's link, and tap it to start\./.test(c.text) && /Check your email for the link to start it\./.test(c.text) && JSON.stringify(c.buttons) === '["Turn off"]', c);
  ok("…and a double tap's second tap, on the new Turn off, does nothing (the card changed shape under it)", second && await page.evaluate(() => !!Sona.reportEmail()) && c.buttons.join() === "Turn off");
  const prof = await page.evaluate(() => JSON.parse(localStorage.getItem("sona.profile.v1")));
  ok("…kept on the first child's profile, as setup keeps it (so reportEmail finds it)", prof.email === "dad@example.com" && prof.weeklyReport === true && prof.weeklyEmail === true && await page.evaluate(() => Sona.reportEmail()) === "dad@example.com", prof);
  ok("…the list hears it once, as an in-app lead from Settings, with no child in it", leads.length === 1 && leads[0].email === "dad@example.com" && leads[0].source === "app-settings" && leads[0].role === "parent" && !/Milo|Ava/.test(JSON.stringify(leads)), leads);
  ok("…claiming no purchase on a phone without Premium", !("premium" in leads[0]) && !leads[0].plan, leads[0]);
  ok("…and the phone posts at once, saying it was turned on, so the confirm email goes now, with no name in it", reports.length === 1 && reports[0].email === "dad@example.com" && reports[0].on === true && !reports[0].quiet && !/Milo|Ava|childName/.test(JSON.stringify(reports[0])), reports);
  // the link tapped in Mail, back to Settings: the server now says ok
  answer = { ok: true };
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(500);
  ok("back from Mail with the link tapped: the server is asked again and the wait line goes", reports.length === 2 && !/Check your email/.test((await cardText(page)).text), reports.length);
  ok("…and once the server has heard it was turned on, posts stop saying so", !("on" in reports[1]), reports[1]);
  await tap(page, "Turn off");
  c = await cardText(page);
  ok("Turn off: off on every profile, the switch back, \"Turned off.\"", /Turned off\./.test(c.text) && JSON.stringify(c.buttons) === '["Turn on"]' && await page.evaluate(() => !Sona.reportEmail() && JSON.parse(localStorage.getItem("sona.profile.v1")).weeklyReport === false), c);
  const last = reports.at(-1) || {};
  ok("…and the server is told this phone has it off (off, quiet: no link)", reports.length === 3 && last.off === true && last.quiet === true && last.dev === reports[0].dev && last.weeks.length === 2 && last.weeks.every((w) => w.kids.length === 0), last);
  ok("…which it took, so nothing is owed", await page.evaluate(() => !Sona.reportStatus().owed));
  ok("…the address stays on the phone for the box (and a purchase's plan post)", await page.evaluate(() => document.getElementById("reportEmail").value === "dad@example.com"));
  await page.evaluate(() => { Sona.gameRep("R"); Sona.reportSync(true); }); await page.waitForTimeout(400);
  ok("…and nothing more is sent", reports.length === 3, reports.length);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

const DEVP = "0123456789abcdef0123456789abcdef";
const offPosts = () => reports.filter((r) => r.off === true).map((r) => r.email);
const owed = (page) => page.evaluate(() => (JSON.parse(localStorage.getItem("sona.report.v1") || "{}").offs || []).map((o) => o.e));
await scenario("a Turn off made offline", async () => {
  leads.length = 0; reports.length = 0; answer = { ok: true };
  const { context, page, errors } = await fresh({ "sona.profile.v1": Object.assign({}, MILO, { email: "mom@example.com", weeklyReport: true }), "sona.report.v1": { dev: DEVP, at: 1 } });
  answer = { status: 503 };
  await tap(page, "Turn off");
  let c = await cardText(page);
  ok("the server not answering: off on the phone, owed, and Settings says it will finish", /Turned off\. Sona will finish this the next time it's online\./.test(c.text) && await page.evaluate(() => !Sona.reportEmail() && Sona.reportStatus().owed) && JSON.stringify(offPosts()) === '["mom@example.com"]', [c.text, reports.length]);
  answer = { ok: true };
  await page.reload(); await page.waitForSelector("#reportCard", { state: "attached" }); await page.waitForTimeout(500);
  ok("…Settings opened again sends it, and nothing is owed", JSON.stringify(offPosts()) === '["mom@example.com","mom@example.com"]' && (await owed(page)).length === 0, offPosts());
  answer = { ok: true, pending: true };
  await page.fill("#reportEmail", "mom@example.com"); await tap(page, "Turn on");
  c = await cardText(page);
  ok("turned on again after the server took the Turn off: it asks the address again, and says so", /Check your email for the link to start it\./.test(c.text), c.text);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("an owed Turn off, then Turn on again before it went", async () => {
  leads.length = 0; reports.length = 0; answer = { status: 503 };
  const { context, page, errors } = await fresh({ "sona.profile.v1": Object.assign({}, MILO, { email: "mom@example.com", weeklyReport: true }), "sona.report.v1": { dev: DEVP, at: 1, onFor: "mom@example.com" } });
  await tap(page, "Turn off");
  ok("(owed)", JSON.stringify(await owed(page)) === '["mom@example.com"]');
  answer = { ok: true, pending: true };
  await page.fill("#reportEmail", "mom@example.com"); await tap(page, "Turn on");
  ok("turned on again for the very same address: the owed Turn off is dropped, never sent after, and the post says it was turned on", (await owed(page)).length === 0 && offPosts().length === 1 && reports.at(-1).on === true, [await owed(page), offPosts()]);
  await page.reload(); await page.waitForSelector("#reportCard", { state: "attached" }); await page.waitForTimeout(500);
  ok("…nor on the next visit, so the report the parent just turned on stays on", offPosts().length === 1 && await page.evaluate(() => Sona.reportEmail() === "mom@example.com"));
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("an owed Turn off for another spelling of the inbox, then Turn on", async () => {
  leads.length = 0; reports.length = 0; answer = { status: 503 };
  const { context, page, errors } = await fresh({ "sona.profile.v1": Object.assign({}, MILO, { email: "d.ad+sona@gmail.com", weeklyReport: true }), "sona.report.v1": { dev: DEVP, at: 1, onFor: "d.ad+sona@gmail.com" } });
  await tap(page, "Turn off");
  answer = { ok: true, pending: true };
  await page.fill("#reportEmail", "dad@gmail.com"); await tap(page, "Turn on");
  ok("turned on for another spelling of the same Gmail inbox: the old spelling's Turn off stays owed (its numbers must go)", JSON.stringify(await owed(page)) === '["d.ad+sona@gmail.com"]', await owed(page));
  await page.evaluate(() => { const st = JSON.parse(localStorage.getItem("sona.report.v1")); st.onFor = "dad@gmail.com"; localStorage.setItem("sona.report.v1", JSON.stringify(st)); });
  const n = reports.length;
  await page.reload(); await page.waitForSelector("#reportCard", { state: "attached" }); await page.waitForTimeout(700);
  const after = reports.slice(n);
  ok("…once it is taken, the phone's next post says \"on\" again (the server now has it off for that inbox), so the report stays on",
    after.length === 2 && after[0].off === true && after[0].email === "d.ad+sona@gmail.com" && after[1].on === true && after[1].email === "dad@gmail.com" && await page.evaluate(() => Sona.reportStatus().sent), after.map((r) => [r.email, !!r.off, !!r.on]));
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("a Turn on the server never heard", async () => {
  leads.length = 0; reports.length = 0; answer = { status: 503 };
  const { context, page, errors } = await fresh({ "sona.profile.v1": MILO });
  await page.fill("#reportEmail", "mom@example.com"); await tap(page, "Turn on");
  ok("offline: on here, and Settings says the link comes once Sona is online", /Saved\. Sona will send the link the next time it's online\./.test((await cardText(page)).text) && await page.evaluate(() => Sona.reportStatus().on && !Sona.reportStatus().sent));
  answer = { ok: true, pending: true }; const n = reports.length;
  await page.reload(); await page.waitForSelector("#reportCard", { state: "attached" }); await page.waitForTimeout(500);
  ok("…Settings opened again online tries again, saying it was turned on", reports.length === n + 1 && reports.at(-1).on === true && await page.evaluate(() => Sona.reportStatus().sent), reports.length - n);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("two Turn offs owed for two addresses", async () => {
  leads.length = 0; reports.length = 0; answer = { status: 503 };
  const { context, page, errors } = await fresh({ "sona.profile.v1": Object.assign({}, MILO, { email: "mom@example.com", weeklyReport: true }), "sona.report.v1": { dev: DEVP, at: 1 } });
  await tap(page, "Turn off");
  await page.fill("#reportEmail", "dad@example.com"); await tap(page, "Turn on");
  ok("an owed Turn off for another address stays owed when a new one is turned on", JSON.stringify(await owed(page)) === '["mom@example.com"]');
  await tap(page, "Turn off");
  ok("…and a second Turn off is owed beside it, never in its place", JSON.stringify(await owed(page)) === '["mom@example.com","dad@example.com"]', await owed(page));
  answer = { ok: true }; reports.length = 0;
  await page.reload(); await page.waitForSelector("#reportCard", { state: "attached" }); await page.waitForTimeout(700);
  ok("…back online, both go, one after the other, and nothing is owed", JSON.stringify(offPosts()) === '["mom@example.com","dad@example.com"]' && (await owed(page)).length === 0, offPosts());
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("an owed Turn off goes from a practice page, and Settings coming back", async () => {
  leads.length = 0; reports.length = 0; answer = { ok: true, off503: true };
  const { context, page, errors } = await fresh({ "sona.profile.v1": Object.assign({}, MILO, { email: "mom@example.com" }), "sona.report.v1": { dev: DEVP, at: 1, offs: [{ e: "mom@example.com", d: DEVP }] } });
  // Settings' own load sent it once (the server did not take it)
  const n0 = offPosts().length;
  await page.goto(origin + "/__page"); await page.waitForFunction(() => window.Sona);
  await page.evaluate(() => { const st = JSON.parse(localStorage.getItem("sona.report.v1")); st.offs[0].at = 0; localStorage.setItem("sona.report.v1", JSON.stringify(st)); });
  await page.evaluate(() => Sona.gameRep("R")); await page.waitForTimeout(400);
  await page.evaluate(() => Sona.gameRep("R")); await page.waitForTimeout(400);
  ok("a rep on a practice or game page sends it, and a second rep inside five minutes does not", n0 === 1 && offPosts().length === 2, [n0, offPosts().length]);
  await page.evaluate(() => { const st = JSON.parse(localStorage.getItem("sona.report.v1")); st.offs[0].at = Date.now() - 6 * 60 * 1000; localStorage.setItem("sona.report.v1", JSON.stringify(st)); });
  await page.evaluate(() => Sona.gameRep("R")); await page.waitForTimeout(400);
  ok("…five minutes on, it tries again", offPosts().length === 3, offPosts().length);
  answer = { ok: true };
  await page.goto(origin + "/settings.html"); await page.waitForSelector("#reportCard", { state: "attached" }); await page.waitForTimeout(500);
  ok("…and Settings sends it as it opens; taken, nothing is owed", offPosts().length === 4 && (await owed(page)).length === 0, offPosts().length);
  await page.evaluate(() => { const st = JSON.parse(localStorage.getItem("sona.report.v1")); st.offs = [{ e: "mom@example.com", d: "0123456789abcdef0123456789abcdef" }]; localStorage.setItem("sona.report.v1", JSON.stringify(st)); });
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(500);
  ok("…and when Settings comes back to the front", offPosts().length === 5 && (await owed(page)).length === 0, offPosts().length);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("a Turn off waits for a post on its way", async () => {
  leads.length = 0; reports.length = 0; answer = { ok: true, delay: 500 };
  const { context, page, errors } = await fresh({ "sona.profile.v1": Object.assign({}, MILO, { email: "mom@example.com", weeklyReport: true }), "sona.report.v1": { dev: DEVP, at: 1 } });
  await page.evaluate(() => { Sona.reportSync(true); return Sona.reportOff(); });
  await page.waitForTimeout(300);
  const nums = reports.find((r) => !r.off), off = reports.find((r) => r.off);
  ok("the numbers post goes first, and the Turn off only once the server has answered it (so the off lands last)", !!nums && !!off && off.__at - nums.__at >= 450, [nums && nums.__at, off && off.__at]);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("removing the child who holds the address", async () => {
  leads.length = 0; reports.length = 0; answer = { ok: true };
  const { context, page, errors } = await fresh({
    "sona.kids.v1": { active: "", hi: 3, list: [{ slot: "", name: "Milo" }, { slot: "k2", name: "Ava" }] },
    "sona.profile.v1": MILO, "sona.profile.v1@k2": Object.assign({}, MILO, { childName: "Ava", email: "mom@example.com", weeklyReport: true }),
    "sona.report.v1": { dev: DEVP, at: 1 },
  });
  await page.evaluate(() => Sona.removeKid("k2"));
  ok("the report stops with them, and the server is owed that this phone has it off", await page.evaluate(() => !Sona.reportEmail()) && JSON.stringify(await owed(page)) === '["mom@example.com"]', await owed(page));
  await page.reload(); await page.waitForSelector("#reportCard", { state: "attached" }); await page.waitForTimeout(500);
  ok("…sent from Settings", JSON.stringify(offPosts()) === '["mom@example.com"]' && (await owed(page)).length === 0, offPosts());
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("a family with Premium turns it on", async () => {
  leads.length = 0; reports.length = 0; answer = { ok: true, pending: true };
  const { context, page, errors } = await fresh({ "sona.profile.v1": MILO, "sona.sub.v1": { active: true, source: "apple", since: 1 } });
  await page.fill("#reportEmail", "paid@example.com"); await tap(page, "Turn on");
  ok("the lead says the phone has every game open, so the series stops (and claims no purchase)", leads.length === 1 && leads[0].premium === true && !leads[0].plan, leads);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("one address for the household", async () => {
  leads.length = 0; reports.length = 0; answer = { ok: true, pending: true };
  const { context, page, errors } = await fresh({
    "sona.kids.v1": { active: "k2", list: [{ slot: "", name: "Milo" }, { slot: "k2", name: "Ava" }] },
    "sona.profile.v1": Object.assign({}, MILO, { email: "old@example.com", weeklyEmail: true }), // setup's email step before 15 Oct: tips, not a report
    "sona.profile.v1@k2": Object.assign({}, MILO, { childName: "Ava", childAge: "4", email: "two@example.com", weeklyReport: true }),
  });
  let c = await cardText(page);
  ok("a household with the report on (on any child's profile) shows where it goes", /It goes to two@example\.com/.test(c.text) && JSON.stringify(c.buttons) === '["Turn off"]', c);
  await tap(page, "Turn off");
  ok("…Turn off clears it", await page.evaluate(() => !Sona.reportEmail()));
  ok("…and the box offers the household's address", await page.evaluate(() => ["old@example.com", "two@example.com"].includes(document.getElementById("reportEmail").value)));
  await page.fill("#reportEmail", "new@example.com"); await tap(page, "Turn on");
  const profs = await page.evaluate(() => [JSON.parse(localStorage.getItem("sona.profile.v1")), JSON.parse(localStorage.getItem("sona.profile.v1@k2"))]);
  ok("turned on again: one child's profile holds it, and only one", profs.filter((x) => x.weeklyReport === true).length === 1 && await page.evaluate(() => Sona.reportEmail()) === "new@example.com", profs.map((x) => [x.email, x.weeklyReport]));
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("never for a clinician's own setup", async () => {
  const { context, page, errors } = await fresh({ "sona.profile.v1": { childName: "Clin", onboarded: true, role: "slp", volume: 0 } });
  ok("a phone with only a clinician's own setup has no switch", !(await cardText(page)).shown);
  ok("…and reportSet keeps nothing there", await page.evaluate(() => Sona.reportSet("a@example.com").then((r) => r === false && !Sona.reportEmail())));
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await scenario("the switch fits a small phone", async () => {
  const { context, page, errors } = await fresh({ "sona.profile.v1": MILO });
  await page.setViewportSize({ width: 320, height: 568 }); await page.waitForTimeout(200);
  const fit = await page.evaluate(() => { const c = document.getElementById("reportCard"), b = c.querySelector("button").getBoundingClientRect(), i = document.getElementById("reportEmail").getBoundingClientRect(); return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, b: b.height, bw: b.right <= innerWidth, iw: i.right <= innerWidth }; });
  ok("at 320 px: no sideways scroll, a 44 px button, the box inside the screen", fit.over <= 0 && fit.b >= 44 && fit.bw && fit.iw, fit);
  ok("no page errors", errors.length === 0, errors);
  await context.close();
});

await browser.close(); server.close();
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
