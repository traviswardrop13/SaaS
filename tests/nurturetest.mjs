// NURTURE1: the welcome series on Sona's own server (Travis, 6 Oct 2026),
// three emails since 23 Oct 2026 ("we send them one an email immediately, the
// next day, and then one more day ... So just 3"): once each, never after
// unsubscribing, always with an unsubscribe link and the mailing address —
// and nothing about a child.
import { readFileSync } from "node:fs";
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
const cache = new Map();
function loadTs(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const req = (s) => s.startsWith("@/") ? loadTs(path.join(REPO, s.slice(2) + ".ts")) : s === "next/server" ? require(path.join(REPO, "node_modules/next/server")) : require(s);
  new Function("require", "module", "exports", js)(req, mod, mod.exports);
  return mod.exports;
}
const N = loadTs(path.join(REPO, "lib/nurture.ts"));

// a tiny in-memory store with the commands the series uses
function store(unsub = []) {
  const kv = new Map(), z = new Map(), u = new Set(unsub);
  return {
    z, kv,
    cmd: async ([c, ...a]) => {
      if (c === "SET") { if (a.includes("NX") && kv.has(a[0])) return null; kv.set(a[0], String(a[1])); return "OK"; }
      if (c === "SISMEMBER") return u.has(a[1]) ? 1 : 0;
      if (c === "ZADD") { z.set(a[2], a[1]); return 1; }
      if (c === "GET") return kv.has(a[0]) ? kv.get(a[0]) : null;
      if (c === "DEL") return kv.delete(a[0]) ? 1 : 0;
      if (c === "ZREM") return z.delete(a[1]) ? 1 : 0;
      if (c === "ZRANGEBYSCORE") return [...z].filter(([, s]) => s <= a[2]).map(([e]) => e);
      throw new Error("unexpected " + c);
    },
  };
}
const sent = [];
const fakeFetch = async (_u, init) => { sent.push(JSON.parse(init.body)); return { ok: true, status: 200 }; };

process.env.RESEND_API_KEY = "re_test"; process.env.UNSUB_SECRET = "s3cret"; process.env.EMAIL_POSTAL = "851 NE 1st Ave, Unit 4103, Miami, FL 33132";
const T = Date.parse("2026-10-07T12:00:00Z");

const s = store(["gone@example.com"]);
const subj = (id) => N.mailOf(id).subject;
ok("a new sign-up gets one email right away: \"Here's Sona\"", await N.enroll(" Mom@Example.com ", s.cmd, fakeFetch, T) && sent.length === 1 && sent[0].to[0] === "mom@example.com" && sent[0].subject === subj("hello"));
const w = sent[0];
ok("…from Rachel, replies to Rachel", /rachel@speaksona\.com/.test(w.from) && w.reply_to === "rachel@speaksona.com", w.from);
ok("…with a working unsubscribe link (the token /api/email/unsub checks) in the body and the header",
  w.html.includes("/api/email/unsub?e=mom%40example.com&k=" + N.unsubToken("mom@example.com", "s3cret")) && /api\/email\/unsub/.test(w.headers["List-Unsubscribe"]) && w.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");
ok("…and the mailing address, in html and text", w.html.includes("851 NE 1st Ave") && w.text.includes("851 NE 1st Ave"));
ok("…and links to the App Store", w.html.includes(N.APP_URL));
ok("a second sign-up with the same address sends nothing", !(await N.enroll("mom@example.com", s.cmd, fakeFetch, T + 1000)) && sent.length === 1);
ok("the sequence is three emails: day 0, day 1, day 2 (Travis, 23 Oct 2026: \"So just 3\"), from the website and from the app alike",
  JSON.stringify(N.series("hello")) === '["hello","recast","answers"]' && JSON.stringify(N.series("trick")) === '["trick","recast","answers"]' &&
  JSON.stringify(N.series("hello").map((x) => N.mailOf(x).day)) === "[0,1,2]" && JSON.stringify(N.series("trick").map((x) => N.mailOf(x).day)) === "[0,1,2]");
ok("…\"The balloon problem\" is gone, and its \"Already started?\" line moved to the last email", !N.CONTENT.some((c) => /balloon/i.test(c.subject)) && N.CONTENT.length === 4 && /Already started\?/.test(N.mailOf("answers").ps || ""));
ok("nothing more before day 1", (await N.runDue(s.cmd, fakeFetch, T + 1 * N.DAY_MS - 1000)).sent === 0 && sent.length === 1);
// a daily run, an hour after each sign-up anniversary, for ten days
for (let d = 1; d <= 10; d++) await N.runDue(s.cmd, fakeFetch, T + d * N.DAY_MS + 3600e3);
ok("…then each email once, in order, and nothing after the third", JSON.stringify(sent.map((m) => m.subject)) === JSON.stringify(N.series("hello").map(subj)), sent.map((m) => m.subject));
ok("…and nothing is left queued after day 2", s.z.size === 0 && !s.kv.has(N.nextKey("mom@example.com")));
{
  // when each one went: a daily run an hour after each sign-up anniversary
  const q = store(), at = [];
  const clock = async (u, init) => { at.push(JSON.parse(init.body).subject); return fakeFetch(u, init); };
  await N.enroll("days@example.com", q.cmd, clock, T);
  const when = [0];
  for (let d = 1; d <= 6; d++) { const n = at.length; await N.runDue(q.cmd, clock, T + d * N.DAY_MS + 3600e3); if (at.length > n) when.push(d); }
  ok("…sent on day 0, day 1 and day 2", JSON.stringify(when) === "[0,1,2]", when);
}
const three = sent.length;
ok("an unsubscribed address gets no first email", !(await N.enroll("gone@example.com", s.cmd, fakeFetch, T)) && sent.length === three);
ok("…and nothing after it", (await N.runDue(s.cmd, fakeFetch, T + 9 * N.DAY_MS)).sent === 0 && sent.length === three);
// AN ADDRESS PART-WAY THROUGH THE FIVE-EMAIL BUILD on 23 Oct 2026: its kept
// step is a number, its place in the old list (0 Here's Sona, 1 the 5-minute
// trick, 2 the recast tip, 3 the balloon, 4 the quick answers)
for (const [kept, want] of [["2", ["recast", "answers"]], ["3", ["answers"]], ["4", ["answers"]], ["0", ["hello", "recast", "answers"]], ["1", ["trick", "recast", "answers"]], [null, ["recast", "answers"]]]) {
  const q = store(), e = "old" + kept + "@example.com", m = sent.length;
  await q.cmd(["SET", "nurture:0:" + e, new Date(T).toISOString()]); await q.cmd(["ZADD", N.DUE_KEY, T + N.DAY_MS, e]);
  if (kept !== null) await q.cmd(["SET", N.nextKey(e), kept]);
  for (let d = 1; d <= 9; d++) await N.runDue(q.cmd, fakeFetch, T + d * N.DAY_MS + 7200e3);
  ok("an address the five-email build left on step " + kept + " gets " + want.join(", ") + ", each once, then nothing",
    JSON.stringify(sent.slice(m).map((x) => x.subject)) === JSON.stringify(want.map(subj)) && q.z.size === 0, sent.slice(m).map((x) => x.subject));
}
// a purchase while a daily run is mid-send: the run puts the next email
// back, and the stop mark takes it off unsent the day after
{
  const r = store(); await N.enroll("race@example.com", r.cmd, fakeFetch, T);
  const m = sent.length;
  const racing = async (u, init) => { if (JSON.parse(init.body).to[0] === "race@example.com") await N.stopSeries("race@example.com", r.cmd); return fakeFetch(u, init); };
  await N.runDue(r.cmd, racing, T + 1 * N.DAY_MS + 1);
  ok("…(the run put the next email back, as it would)", r.z.has("race@example.com"));
  const after = sent.length;
  for (let d = 2; d <= 10; d++) await N.runDue(r.cmd, fakeFetch, T + d * N.DAY_MS + 1);
  ok("a purchase posted while the day-1 email is going out: that one goes, nothing after it", after === m + 1 && sent.length === after && r.z.size === 0 && !r.kv.has(N.nextKey("race@example.com")), { m, after, now: sent.length, z: [...r.z.keys()], next: r.kv.get(N.nextKey("race@example.com")) });
}
// someone who started Premium gives their email again years later (nurture:0
// long gone, the stop mark kept for good): day 0's tip alone, never "Here's
// Sona" selling free days Apple will not give twice, and nothing after it
{
  const back = store(); await N.stopSeries("again@example.com", back.cmd);
  const m = sent.length;
  ok("the stop mark has no time limit", back.kv.get(N.stopKey("again@example.com")) === "1");
  await N.enroll("again@example.com", back.cmd, fakeFetch, T);
  ok("a buyer enrolled again from the website gets \"The 5-minute trick\" alone, never \"Here's Sona\"",
    JSON.stringify(sent.slice(m).map((x) => x.subject)) === JSON.stringify([subj("trick")]), sent.slice(m).map((x) => x.subject));
  ok("…and nothing is scheduled after it", !back.z.has("again@example.com") && !back.kv.has(N.nextKey("again@example.com")));
}
// a day-0 email Resend turns away (busy: its two requests a second are
// shared with the contact list) goes with the next daily run, never lost
{
  const q = store(); let n = 0;
  // the in-app welcome meets 429 on its try and on the one retry
  const busy = async (u, init) => (++n <= 2 ? { ok: false, status: 429 } : fakeFetch(u, init));
  const m = sent.length;
  await N.enroll("burst@example.com", q.cmd, busy, T, { inApp: true });
  ok("a welcome Resend turns away at sign-up waits on the schedule, due now", sent.length === m && q.kv.get(N.nextKey("burst@example.com")) === "trick" && q.z.get("burst@example.com") === T, [sent.length - m, q.kv.get(N.nextKey("burst@example.com")), q.z.get("burst@example.com")]);
  await N.runDue(q.cmd, fakeFetch, T + 3600e3);
  ok("…and the next daily run sends it, then keeps the series to its days", sent.at(-1).subject === subj("trick") && sent.at(-1).to[0] === "burst@example.com" && q.z.get("burst@example.com") === T + 1 * N.DAY_MS && q.kv.get(N.nextKey("burst@example.com")) === "recast");
}
{
  // …and from the website ("Here's Sona", the App Store link)
  const q = store(); let n = 0;
  const busy = async (u, init) => (++n <= 2 ? { ok: false, status: 429 } : fakeFetch(u, init));
  const m = sent.length;
  await N.enroll("first@example.com", q.cmd, busy, T);
  ok("a first email Resend turns away at sign-up is kept by name, due now", sent.length === m && q.kv.get(N.nextKey("first@example.com")) === "hello" && q.z.get("first@example.com") === T);
  await N.runDue(q.cmd, fakeFetch, T + 3600e3);
  ok("…and the next daily run sends \"Here's Sona\" itself, then the recast tip next", sent.at(-1).subject === subj("hello") && q.kv.get(N.nextKey("first@example.com")) === "recast");
  for (let d = 1; d <= 10; d++) await N.runDue(q.cmd, fakeFetch, T + d * N.DAY_MS + 7200e3);
  ok("…then every email once, in order", JSON.stringify(sent.slice(m).map((x) => x.subject)) === JSON.stringify(N.series("hello").map(subj)), sent.slice(m).map((x) => x.subject));
}
// a run out of time claims nothing more: the rest are still due tomorrow
{
  const q = store(); await N.enroll("late1@example.com", q.cmd, fakeFetch, T); await N.enroll("late2@example.com", q.cmd, fakeFetch, T);
  const m = sent.length;
  const r = await N.runDue(q.cmd, fakeFetch, T + 1 * N.DAY_MS + 1, { deadline: Date.now() - 1 });
  ok("a daily run out of time sends nothing more and leaves both on the schedule", r.sent === 0 && r.left === 2 && sent.length === m && q.z.size === 2, r);
  const r2 = await N.runDue(q.cmd, fakeFetch, T + 1 * N.DAY_MS + 1, { deadline: Date.now() + 60000 });
  ok("…and the next run sends them", r2.sent === 2 && r2.left === 0, r2);
}
// unsubscribing mid-way stops the rest
const mid = store(); await N.enroll("mid@example.com", mid.cmd, fakeFetch, T);
const n0 = sent.length;
mid.u = true; const mid2 = { ...mid, cmd: async (c) => (c[0] === "SISMEMBER" ? 1 : mid.cmd(c)) };
await N.runDue(mid2.cmd, fakeFetch, T + 2 * N.DAY_MS);
ok("unsubscribing mid-way stops every email after it", sent.length === n0 && mid.z.size === 0);

// AN EMAIL GIVEN INSIDE THE APP (Travis, 13 Oct 2026: setup's email box moved
// before the price). They already have the app, so the App Store email
// ("Here's Sona") is swapped for the 5-minute email, still on day 0; days 1
// and 2 are the same for both.
ok("the website's first email is the App Store one: \"Here's Sona\", whose button is the App Store link",
  N.WEB_START === "hello" && subj("hello") === "Here\u2019s Sona" && /App Store/.test(N.mailOf("hello").button) && /iPhone or iPad/.test(N.mailOf("hello").paras.join(" ")) && N.render("hello", "u", "p").html.includes(N.APP_URL));
ok("…and an in-app lead starts at \"The 5-minute trick\", also day 0", N.IN_APP_START === "trick" && subj("trick") === "The 5-minute trick" && N.mailOf("trick").day === 0);
ok("in-app sources: setup's email step, Settings' report switch and a purchase's plan post, nothing else",
  ["app-setup", "app-settings", "app-trial", "app-paid"].every((x) => N.inAppSource(x)) &&
  ["onboarding", "join", "speech-check", "app-launch", "remindPledge", "landing", "", undefined, null, 1, ["app-setup"]].every((x) => !N.inAppSource(x)));
{
  const app = store(), mark = sent.length;
  ok("an in-app enroll sends one email now and says so", await N.enroll("App@Example.com", app.cmd, fakeFetch, T, { inApp: true }) && sent.length === mark + 1);
  ok("…the 5-minute email, never the App Store one", sent.at(-1).subject === subj("trick") && sent.at(-1).to[0] === "app@example.com" && !sent.slice(mark).some((m) => m.subject === subj("hello")));
  ok("…and the next one waits for day 1, as for everyone", app.kv.get(N.nextKey("app@example.com")) === "recast" && app.z.get("app@example.com") === T + 1 * N.DAY_MS, [app.kv.get(N.nextKey("app@example.com")), app.z.get("app@example.com")]);
  for (let d = 1; d <= 10; d++) await N.runDue(app.cmd, fakeFetch, T + d * N.DAY_MS + 3600e3);
  ok("…then days 1 and 2 in order: three emails in all, nothing left queued",
    JSON.stringify(sent.slice(mark).map((m) => m.subject)) === JSON.stringify(N.series("trick").map(subj)) && app.z.size === 0, sent.slice(mark).map((m) => m.subject));
  const n1 = sent.length;
  ok("a later sign-up on the website with the same address sends nothing", !(await N.enroll("app@example.com", app.cmd, fakeFetch, T + 9e6)) && sent.length === n1);
  const web = store();
  await N.enroll("web@example.com", web.cmd, fakeFetch, T);
  const n2 = sent.length;
  ok("…and a website sign-up first, then the app, sends nothing the second time", !(await N.enroll("web@example.com", web.cmd, fakeFetch, T + 1000, { inApp: true })) && sent.length === n2);
  const gone = store(["gone2@example.com"]);
  ok("an unsubscribed address still gets nothing from the app", !(await N.enroll("gone2@example.com", gone.cmd, fakeFetch, T, { inApp: true })) && sent.length === n2 && gone.z.size === 0);
}

const n9 = sent.length; delete process.env.EMAIL_POSTAL;
ok("no mailing address configured → nothing sends at all", !(await N.enroll("new@example.com", store().cmd, fakeFetch, T)) && sent.length === n9 && !(await N.enroll("new2@example.com", store().cmd, fakeFetch, T, { inApp: true })) && sent.length === n9);

// the words: Rachel's credential, the practice register, no price figure
const all = JSON.stringify(N.CONTENT) + readFileSync(path.join(REPO, "lib/nurture.ts"), "utf8").match(/render[\s\S]*?\n}\n/)[0];
ok("Rachel signs as MS, CF-SLP, never certified/CCC", /MS, CF-SLP/.test(all) && !/\bCCC\b|certified/i.test(all));
ok("practice, never therapy/treatment/diagnosis/score", !/therapy|treatment|diagnos|score/i.test(JSON.stringify(N.CONTENT)));
ok("no dollar figure, no \"correct\", no free-forever promise, no testimonial placeholder", !/correctly|forever|\[[A-Z]|CREDENTIALS/i.test(JSON.stringify(N.CONTENT)));
ok("no emoji anywhere (they pushed the first test into spam, 7 Oct 2026)", !/\p{Extended_Pictographic}/u.test(JSON.stringify(N.CONTENT)));
ok("no dollar figure", !/\$\d/.test(JSON.stringify(N.CONTENT)));

// the wiring
const lead = readFileSync(path.join(REPO, "app/api/lead/route.ts"), "utf8");
ok("/api/lead enrolls every new email but a speech therapist's once the app is out, an in-app one without the App Store email",
  /if \(APP_READY && kvConfigured\(\) && lead\.role !== "slp"\)[\s\S]{0,120}enroll\(email, kvCmd, fetch, Date\.now\(\), \{ inApp: inAppSource\(lead\.source\) \}\)/.test(lead) && /import \{ enroll, inAppSource, stopSeries \} from "@\/lib\/nurture"/.test(lead));
// …and played: /api/lead itself, against the in-memory store and a fake
// Resend, with only its neighbours (the store's door, the rate limit, the
// contact list and the launch switch) stubbed. The source the app posts is what picks the
// first email, as the route really reads it off the body.
{
  process.env.EMAIL_POSTAL = "851 NE 1st Ave, Unit 4103, Miami, FL 33132";
  const db = store(["gone-slp@example.org"]), base = db.cmd;
  db.cmd = async (c) => (c[0] === "LPUSH" || c[0] === "LTRIM" ? 1 : base(c));
  // The packet's email (17 Nov 2026) is played for real: lib/packet.ts on
  // this suite's nurture config and lib/mail, through the same fake Resend.
  const PK = loadTs(path.join(REPO, "lib/packet.ts"));
  const stubs = {
    "@/lib/slpAuth": { kvCmd: (c) => db.cmd(c), kvConfigured: () => true, leadSig: () => "not-a-signature" },
    "@/lib/rateLimit": { rateLimit: async () => null },
    "@/lib/contacts": { contactsConfigured: () => false, planWord: (p) => (p === "trial" || p === "paid" ? p : ""), upsertContact: async () => null },
    "@/lib/launch": { APP_READY: true, sendWelcomeEmail: async () => false },
    "@/lib/mail": { mailConfigured: () => true },
    "@/lib/nurture": N,
    "@/lib/packet": PK,
  };
  const rmod = { exports: {} };
  const rjs = ts.transpileModule(lead, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const rreq = (x) => stubs[x] || (x === "next/server" ? require(path.join(REPO, "node_modules/next/server")) : require(x));
  new Function("require", "module", "exports", rjs)(rreq, rmod, rmod.exports);
  const { NextRequest } = require(path.join(REPO, "node_modules/next/server"));
  const post = async (body) => {
    const real = globalThis.fetch, mark = sent.length;
    globalThis.fetch = fakeFetch;
    try {
      const r = await rmod.exports.POST(new NextRequest("https://speaksona.com/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
      return { status: r.status, json: await r.json(), subjects: sent.slice(mark).map((m) => m.subject) };
    } finally { globalThis.fetch = real; }
  };
  const fromApp = await post({ email: "setup@example.com", source: "app-setup", role: "parent", summary: "New parent" });
  ok("the route: setup's post (source app-setup) is welcomed with \"The 5-minute trick\" alone, never the App Store email",
    fromApp.status === 200 && fromApp.json.welcomed === true && JSON.stringify(fromApp.subjects) === JSON.stringify([subj("trick")]), fromApp);
  const fromBuy = await post({ email: "buyer@example.com", source: "app-trial", role: "parent", plan: "trial" });
  ok("…a purchase's plan post that is the first the server hears of the address, the same", JSON.stringify(fromBuy.subjects) === JSON.stringify([subj("trick")]), fromBuy);
  const fromSettings = await post({ email: "switch@example.com", source: "app-settings", role: "parent" });
  ok("…and Settings' report switch (source app-settings), the same", JSON.stringify(fromSettings.subjects) === JSON.stringify([subj("trick")]), fromSettings);
  ok("…and the rest of its series stays on the schedule", db.z.has("switch@example.com") && !db.kv.has(N.stopKey("switch@example.com")));
  const fromPremium = await post({ email: "premium@example.com", source: "app-settings", role: "parent", premium: true });
  ok("…but from a phone that already has every game open (premium: true), the tip alone: the series stops, with no purchase claimed",
    JSON.stringify(fromPremium.subjects) === JSON.stringify([subj("trick")]) && !db.z.has("premium@example.com") && db.kv.get(N.stopKey("premium@example.com")) === "1", fromPremium);
  const notTrue = await post({ email: "premium2@example.com", source: "app-settings", role: "parent", premium: "yes" });
  ok("…and only the value true says so", notTrue.subjects.length === 1 && db.z.has("premium2@example.com"));
  ok("…and nothing after it: a buyer's welcome emails stop (day 2 says \"Start your free trial\")",
    !db.z.has("buyer@example.com") && !db.kv.has(N.nextKey("buyer@example.com")) && db.kv.get(N.stopKey("buyer@example.com")) === "1");
  const later = await post({ email: "parent2@example.com", source: "app-setup", role: "parent" });
  ok("a parent who gave their email in setup is in the series…", later.subjects.length === 1 && db.z.has("parent2@example.com"));
  const bought = await post({ email: "Parent2@Example.com", source: "app-paid", role: "parent", plan: "paid" });
  ok("…until the phone says they started Premium: no email then, and none after", bought.subjects.length === 0 && !db.z.has("parent2@example.com") && !db.kv.has(N.nextKey("parent2@example.com")));
  const plain = await post({ email: "parent3@example.com", source: "app-setup", role: "parent", plan: "monthly" });
  ok("…and only the words trial and paid stop it", plain.subjects.length === 1 && db.z.has("parent3@example.com"));
  const fromSite = await post({ email: "site@example.com", source: "parents", role: "parent" });
  ok("…and the website's sign-up still gets \"Here's Sona\", alone",
    JSON.stringify(fromSite.subjects) === JSON.stringify([subj("hello")]), fromSite);
  // A speech therapist never gets the parents' series (audit B2, 13 Nov
  // 2026): "Here's Sona", the "wabbit" tip and "Quick answers" are for parents.
  const fromSlp = await post({ email: "therapist@example.org", source: "for-slps", role: "slp" });
  ok("…but a speech therapist's sign-up (role slp) is sent none of it and is never put on the schedule",
    fromSlp.status === 200 && fromSlp.subjects.length === 0 && !db.z.has("therapist@example.org") && !db.kv.has(N.nextKey("therapist@example.org")), fromSlp);
  const noSource = await post({ email: "check@example.com" });
  ok("…as does a post with no source (the Speech Check's default)", JSON.stringify(noSource.subjects) === JSON.stringify([subj("hello")]), noSource);

  // THE PACKET (17 Nov 2026): the clinicians' opt-in at speaksona.com/ posts
  // source "slp-packet", and that address is emailed the packet's link once.
  // Never the parents' series, never twice, never after unsubscribing, and
  // never for any other clinician lead (the for-slps post above got nothing).
  ok("the opt-in's source is lib/packet's, and the page posts it", PK.PACKET_SOURCE === "slp-packet" &&
    /var SOURCE = "slp-packet";/.test(readFileSync(path.join(REPO, "public/packet.html"), "utf8")));
  const mark = sent.length;
  const pk = await post({ email: " Packet@Clinic.org ", source: "slp-packet", role: "slp", utm_source: "fb" });
  const pm = sent[mark];
  ok("a clinician who asks for the packet is emailed it once, alone: no welcome series, never on the schedule",
    pk.status === 200 && JSON.stringify(pk.subjects) === JSON.stringify([PK.PACKET_SUBJECT]) && pm.to[0] === "packet@clinic.org" &&
    !db.z.has("packet@clinic.org") && !db.kv.has(N.nextKey("packet@clinic.org")) && db.kv.has(PK.packetKey("packet@clinic.org")), pk);
  ok("…the email links the packet (/packet) and the plans, signed by Rachel, MS, CF-SLP",
    pm.html.includes('href="' + PK.PACKET_URL + '"') && PK.PACKET_URL === "https://www.speaksona.com/packet" && pm.text.includes(PK.PACKET_URL) &&
    pm.html.includes(PK.PLANS_URL) && /Rachel, MS, CF-SLP/.test(pm.html) && /Rachel, MS, CF-SLP/.test(pm.text));
  ok("…with a working unsubscribe link (body and header) and the mailing address, like every list email",
    pm.html.includes("/api/email/unsub?e=packet%40clinic.org&k=" + N.unsubToken("packet@clinic.org", "s3cret")) && pm.text.includes("/api/email/unsub?e=packet%40clinic.org") &&
    /api\/email\/unsub/.test(pm.headers["List-Unsubscribe"]) && pm.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click" &&
    pm.html.includes("851 NE 1st Ave") && pm.text.includes("851 NE 1st Ave"));
  ok("…and no price, no score, no credential Rachel does not hold, no emoji",
    !/\$\d|\bscore|accuracy|diagnos|\bCCC\b|certified|free trial/i.test(pm.html + pm.text) && !/\p{Extended_Pictographic}/u.test(pm.html + pm.text));
  const again = await post({ email: "packet@clinic.org", source: "slp-packet", role: "slp" });
  ok("…asking again (a double tap, a second visit) sends nothing more", again.status === 200 && again.subjects.length === 0, again);
  const gone = await post({ email: "gone-slp@example.org", source: "slp-packet", role: "slp" });
  ok("…an unsubscribed address is sent nothing, and not marked", gone.status === 200 && gone.subjects.length === 0 && !db.kv.has(PK.packetKey("gone-slp@example.org")), gone);
  const parentish = await post({ email: "notslp@example.com", source: "slp-packet", role: "parent" });
  ok("…and the packet goes only to a clinician's opt-in: a parent posting the same source gets the parents' email, not the packet",
    JSON.stringify(parentish.subjects) === JSON.stringify([subj("hello")]) && !db.kv.has(PK.packetKey("notslp@example.com")), parentish);
  {
    // a refused send takes the mark back, so asking again tomorrow works
    const q = store(), refused = async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => "" });
    const r1 = await PK.sendPacketEmail("retry@clinic.org", q.cmd, refused);
    const n = sent.length, r2 = await PK.sendPacketEmail("retry@clinic.org", q.cmd, fakeFetch);
    ok("a refused send is not counted as sent: the mark goes, and the next ask sends it", r1 === "failed" && r2 === "sent" && sent.length === n + 1, [r1, r2]);
    const dead = { cmd: async () => undefined };
    ok("…a store that does not answer sends nothing (fail closed)", (await PK.sendPacketEmail("nostore@clinic.org", dead.cmd, fakeFetch)) === "failed" && sent.length === n + 1);
    const had = process.env.UNSUB_SECRET; delete process.env.UNSUB_SECRET;
    ok("…and without the unsubscribe set-up nothing sends, quietly (the page links the packet anyway)",
      (await PK.sendPacketEmail("nocfg@clinic.org", store().cmd, fakeFetch)) === "off" && sent.length === n + 1);
    process.env.UNSUB_SECRET = had;
  }
  ok("the route sends the packet only for a clinician with the opt-in's source, after the lead is kept, and never fails the visitor on it",
    /if \(lead\.role === "slp" && lead\.source === PACKET_SOURCE && kvConfigured\(\)\) \{\s*try \{ await sendPacketEmail\(email, kvCmd, fetch\); \} catch/.test(lead) &&
    lead.indexOf("sendPacketEmail(email") > lead.indexOf('"leads:all"'));
  delete process.env.EMAIL_POSTAL;
}
// the sources the app really posts are the ones the series knows
const ob = readFileSync(path.join(REPO, "public/onboarding.html"), "utf8"), sona = readFileSync(path.join(REPO, "public/sona.js"), "utf8");
const setupSrc = (ob.match(/function postParentLead[\s\S]*?source:"([^"]+)"/) || [])[1];
ok("setup's parent email post is an in-app source", !!setupSrc && N.inAppSource(setupSrc), setupSrc);
const tell = sona.slice(sona.indexOf("function _tellPlan"), sona.indexOf("function buyPlan"));
ok("…and so are both of a purchase's plan posts", /source: what === "trial" \? "app-trial" : "app-paid"/.test(tell) && N.inAppSource("app-trial") && N.inAppSource("app-paid"));
const cron = JSON.parse(readFileSync(path.join(REPO, "vercel.json"), "utf8")).crons;
ok("a daily cron sends what is due", cron.some((c) => c.path === "/api/cron/nurture" && /^\d+ \d+ \* \* \*$/.test(c.schedule)));

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
