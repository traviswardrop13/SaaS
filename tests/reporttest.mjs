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
// the commands the report uses, in memory; `down` makes every call go unanswered
function store(unsub = []) {
  const kv = new Map(), h = new Map(), ttl = new Map(), u = new Set(unsub), calls = [];
  const db = {
    kv, h, ttl, u, calls, down: false,
    cmd: async (c) => {
      calls.push(c);
      if (db.down) return undefined;
      const [op, ...a] = c;
      if (op === "SET") { if (a.includes("NX") && kv.has(a[0])) return null; kv.set(a[0], String(a[1])); const ex = a.indexOf("EX"); if (ex > -1) ttl.set(a[0], a[ex + 1]); return "OK"; }
      if (op === "GET") return kv.has(a[0]) ? kv.get(a[0]) : null;
      if (op === "DEL") return kv.delete(a[0]) ? 1 : 0;
      if (op === "SISMEMBER") return u.has(a[1]) ? 1 : 0;
      if (op === "HSET") { const m = h.get(a[0]) || new Map(); const isNew = !m.has(a[1]); m.set(a[1], a[2]); h.set(a[0], m); return isNew ? 1 : 0; }
      if (op === "HGETALL") { const m = h.get(a[0]); return m ? [...m].flat() : []; }
      if (op === "EXPIRE") { ttl.set(a[0], a[1]); return h.has(a[0]) || kv.has(a[0]) ? 1 : 0; }
      throw new Error("unexpected " + op);
    },
  };
  return db;
}
const outbox = [];
let resendOk = true;
const fakeFetch = async (u, init) => { outbox.push({ url: u, headers: init.headers, body: JSON.parse(init.body) }); return { ok: resendOk, status: resendOk ? 200 : 500 }; };

process.env.RESEND_API_KEY = "re_test"; process.env.UNSUB_SECRET = "s3cret"; process.env.EMAIL_POSTAL = "851 NE 1st Ave, Unit 4103, Miami, FL 33132";
let db = store();
const N = loadTs(path.join(REPO, "lib/nurture.ts"));
const R = loadTs(path.join(REPO, "lib/report.ts"), { "@/lib/slpAuth": { kvCmd: (c) => db.cmd(c), kvConfigured: () => true }, "@/lib/nurture": N });

const THU = Date.parse("2026-10-15T16:00:00Z"); // Thursday 15 Oct: this week is Mon 12, last week Mon 5
const MON = Date.parse("2026-10-19T16:00:00Z"); // the Monday after: the send is for the week of Mon 12
const DEV = "0123456789abcdef0123456789abcdef", DEV2 = "fedcba9876543210fedcba9876543210";
const kid = (o = {}) => Object.assign({ d: 3, g: 2, gw: 5, r: 40, p: 25, s: ["R"] }, o);

// 1. what the phone may send, and what is kept of it
{
  const good = { email: " Mom@Example.com ", dev: DEV, weeks: [{ wk: "2026-10-05", kids: [kid()] }, { wk: "2026-10-12", kids: [kid({ r: 0, p: 0, d: 0, g: 0, s: [] })] }] };
  const v = R.validate(good, THU);
  ok("a report is an address (lowercased), a device id and this week and last", v && v.email === "mom@example.com" && v.dev === DEV && v.weeks.length === 2 && v.weeks[0].wk === "2026-10-05", v);
  const extra = R.validate({ email: "a@b.co", dev: DEV, weeks: [{ wk: "2026-10-12", kids: [Object.assign(kid(), { name: "Milo", childName: "Milo", age: 6, words: ["rabbit"] })] }] }, THU);
  ok("…each child is built field by field: a name, an age or a word in the body is never kept", extra && JSON.stringify(Object.keys(extra.weeks[0].kids[0]).sort()) === JSON.stringify(["d", "g", "gw", "p", "r", "s"]) && !/Milo|rabbit/.test(JSON.stringify(extra)), extra);
  const clamp = R.validate({ email: "a@b.co", dev: DEV, weeks: [{ wk: "2026-10-12", kids: [{ d: 9, g: -2, gw: 6, r: 50, p: 80, s: ["R", "Q", "S", "R", "<b>"] }] }] }, THU);
  ok("…numbers are clamped (days 0-7, practice never above reps, a plan of 3, 4, 5 or 7) and only real sounds kept, in order",
    clamp && JSON.stringify(clamp.weeks[0].kids[0]) === JSON.stringify({ d: 7, g: 0, gw: 4, r: 50, p: 50, s: ["S", "R"] }), clamp);
  const bad = {
    "no address": { dev: DEV, weeks: good.weeks },
    "a bad address": { email: "not an email", dev: DEV, weeks: good.weeks },
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

  db = store(["gone@example.com"]);
  ok("kept: one hash a week, \"<address> <device>\" to that phone's numbers, for three weeks", await R.store(v, db.cmd) === "ok" &&
    db.h.get("report:wk:2026-10-05").get("mom@example.com " + DEV) === JSON.stringify(v.weeks[0].kids) && db.ttl.get("report:wk:2026-10-05") === 1814400 && db.ttl.get("report:wk:2026-10-12") === 1814400, [...db.h.keys()]);
  ok("an address that unsubscribed is told \"off\", and nothing is kept", await R.store(R.validate(Object.assign({}, good, { email: "gone@example.com" }), THU), db.cmd) === "off" && ![...db.h.values()].some((m) => [...m.keys()].some((k) => k.startsWith("gone@"))));
  db.down = true;
  ok("a store that does not answer is an error, never \"ok\" or \"off\"", await R.store(v, db.cmd) === "error");
}

// 2. Monday's email
{
  db = store(["gone@example.com"]); outbox.length = 0; resendOk = true;
  const put = (email, dev, kids, wk = "2026-10-12") => { const m = db.h.get("report:wk:" + wk) || new Map(); m.set(email + " " + dev, JSON.stringify(kids)); db.h.set("report:wk:" + wk, m); };
  put("one@example.com", DEV, [kid({ d: 4, g: 5, gw: 5, r: 112, p: 40, s: ["R", "S"] })]);
  put("two@example.com", DEV, [kid({ s: ["R"] }), kid({ d: 1, g: 0, gw: 3, r: 6, p: 0, s: ["L"] })]);
  put("two@example.com", DEV2, [kid({ s: ["R"] }), kid({ d: 0, g: 0, gw: 3, r: 0, p: 0, s: [] })]); // the same child on a second phone, and one with nothing
  put("zero@example.com", DEV, [kid({ d: 0, g: 0, r: 0, p: 0, s: [] })]);
  put("gone@example.com", DEV, [kid()]);
  put("old@example.com", DEV, [kid()], "2026-10-05");

  const wed = await R.runReports(db.cmd, fakeFetch, Date.parse("2026-10-21T16:00:00Z"));
  ok("only Monday sends (and Tuesday, to catch up): Wednesday sends nothing", wed.week === null && outbox.length === 0, wed);
  const run = await R.runReports(db.cmd, fakeFetch, MON);
  const to = outbox.map((m) => m.body.to[0]).sort();
  ok("Monday sends last week's report (the week of Mon 12 Oct) to each address with reps, once", run.week === "2026-10-12" && JSON.stringify(to) === JSON.stringify(["one@example.com", "two@example.com"]) && run.sent === 2, [run, to]);
  ok("…never to an address that unsubscribed, never for a week with no reps, never from another week", !to.includes("gone@example.com") && !to.includes("zero@example.com") && !to.includes("old@example.com"));
  const one = outbox.find((m) => m.body.to[0] === "one@example.com").body, two = outbox.find((m) => m.body.to[0] === "two@example.com").body;
  const oneHead = outbox.find((m) => m.body.to[0] === "one@example.com").headers;
  ok("from Rachel, replies to Rachel, once per address and week even if Resend is asked twice",
    /rachel@speaksona\.com/.test(one.from) && one.reply_to === "rachel@speaksona.com" && oneHead["Idempotency-Key"] === "report-2026-10-12-one@example.com", [one.from, oneHead]);
  ok("…with a working unsubscribe link (the token /api/email/unsub checks) in the body and the header, and the mailing address",
    one.html.includes("/api/email/unsub?e=one%40example.com&k=" + N.unsubToken("one@example.com", "s3cret")) && /api\/email\/unsub/.test(one.headers["List-Unsubscribe"]) &&
    one.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click" && one.html.includes("851 NE 1st Ave") && one.text.includes("851 NE 1st Ave"));
  ok("one child: the subject counts the reps, and the body says the week, days practiced, goal days against the plan, the split and the sounds",
    one.subject === "Last week on Sona: 112 reps" && /Oct 12 to Oct 18/.test(one.text) && one.text.includes("- Practiced on 4 days") &&
    one.text.includes("- Reached the daily goal on 5 days (your plan: 5 days a week)") && one.text.includes("- 112 reps: 40 in practice, 72 in games and books") &&
    one.text.includes("- Sounds: S and R") && !/Child 1/.test(one.text), one.text);
  ok("…and a family that kept its plan hears so", one.text.includes("That’s the plan you set."));
  ok("two phones, one address: one email, each child once (the same numbers on two phones are one child), \"Child 1\", \"Child 2\", never a name",
    (two.text.match(/Child \d/g) || []).join() === "Child 1,Child 2,Child 3" && (two.text.match(/Practiced on/g) || []).length === 2 && /Child 2 · L\n- Practiced on 1 day\n/.test(two.text) &&
    two.text.includes("- 6 reps: all in games and books") && two.text.includes("(your plan: 3 days a week)") && two.text.includes("Every rep counts."), two.text);
  ok("…and the second phone's child with nothing that week: \"No practice last week.\"", /Child 3\n- No practice last week\./.test(two.text), two.text);
  const again = await R.runReports(db.cmd, fakeFetch, MON + 3600000), tue = await R.runReports(db.cmd, fakeFetch, MON + 24 * 3600000);
  ok("a second run that day, and Tuesday's, send nothing more", again.sent === 0 && tue.sent === 0 && outbox.length === 2, [again, tue]);

  // a refusal lets the next run try again; a store that does not answer sends nothing
  db = store(); outbox.length = 0; resendOk = false;
  db.h.set("report:wk:2026-10-12", new Map([["fail@example.com " + DEV, JSON.stringify([kid()])]]));
  const refused = await R.runReports(db.cmd, fakeFetch, MON);
  resendOk = true;
  const retried = await R.runReports(db.cmd, fakeFetch, MON + 24 * 3600000);
  ok("Resend refusing a send releases the week's mark, so Tuesday's run sends it", refused.failed === 1 && retried.sent === 1 && outbox.length === 2, [refused, retried]);
  db = store(); outbox.length = 0;
  db.h.set("report:wk:2026-10-12", new Map([["a@example.com " + DEV, JSON.stringify([kid()])]]));
  const realCmd = db.cmd;
  db.cmd = async (c) => (c[0] === "SISMEMBER" ? undefined : realCmd(c));
  const blind = await R.runReports(db.cmd, fakeFetch, MON);
  ok("…and when the unsubscribe list cannot be read, nobody is emailed (fail closed)", blind.sent === 0 && outbox.length === 0, blind);
  db = store(); outbox.length = 0;
  db.h.set("report:wk:2026-10-12", new Map([["a@example.com " + DEV, JSON.stringify([kid()])]]));
  const postal = process.env.EMAIL_POSTAL; delete process.env.EMAIL_POSTAL;
  const unset = await R.runReports(db.cmd, fakeFetch, MON);
  process.env.EMAIL_POSTAL = postal;
  ok("…nor without a mailing address in the settings (CAN-SPAM)", unset.week === null && outbox.length === 0);
  const forced = await R.runReports(db.cmd, fakeFetch, Date.parse("2026-10-21T16:00:00Z"), { force: true });
  ok("a founder's manual run sends on any day, still once a week", forced.sent === 1 && (await R.runReports(db.cmd, fakeFetch, Date.parse("2026-10-21T17:00:00Z"), { force: true })).sent === 0);
  db = store(); outbox.length = 0;
  const big = new Map(); for (let i = 0; i < R.SEND_CAP + 5; i++) big.set(`p${String(i).padStart(4, "0")}@example.com ${DEV}`, JSON.stringify([kid()]));
  db.h.set("report:wk:2026-10-12", big);
  const first = await R.runReports(db.cmd, fakeFetch, MON), rest = await R.runReports(db.cmd, fakeFetch, MON + 24 * 3600000);
  ok("a run sends at most " + R.SEND_CAP + "; the next run sends the rest", first.sent === R.SEND_CAP && rest.sent === 5, [first.sent, rest.sent]);
}

// 3. the words: Rachel's byline and the house email rules
{
  const u = "https://speaksona.com/api/email/unsub?e=x&k=y", P = "851 NE 1st Ave";
  const many = R.render("2026-10-12", [kid({ s: ["P", "B", "M", "N", "S", "R", "THV"] }), kid({ r: 0, p: 0, d: 0, g: 0, s: [] })], u, P);
  const solo1 = R.render("2026-10-12", [kid({ d: 1, g: 1, r: 1, p: 1, s: ["THV"] })], u, P);
  const all = [many, solo1].map((m) => m.subject + "\n" + m.html + "\n" + m.text).join("\n");
  ok("one rep is \"1 rep\", one day \"1 day\", all practice \"all in practice\", the voiced th \"TH (v)\"",
    solo1.subject === "Last week on Sona: 1 rep" && solo1.text.includes("- Practiced on 1 day") && solo1.text.includes("- 1 rep: all in practice") && solo1.text.includes("- Sound: TH (v)"), solo1.text);
  ok("more than five sounds: the first five, then how many more", many.text.includes("P, B, M, N, S and 2 more"), many.text);
  ok("a child with no reps that week: \"No practice last week.\"", many.text.includes("Child 2\n- No practice last week."), many.text);
  ok("signed \"Rachel, MS, CF-SLP\", with the practice-snapshot hedge and what a rep is", /Rachel, MS, CF-SLP<br>Sona co-founder/.test(many.html) && many.text.includes("A practice snapshot from your phone, not an evaluation.") && many.text.includes("Silence never counts."));
  ok("no clinical words, no grade, no promise, no price, no credential claim", !/therapy|treatment|diagnos|score|correctly|forever|accura|\bCCC\b|certified|\$\d/i.test(all), all.match(/therapy|treatment|diagnos|score|correctly|forever|accura|\bCCC\b|certified|\$\d/i));
  ok("no emoji (one sent the first test into spam)", !/\p{Extended_Pictographic}/u.test(all));
  ok("the html escapes what it prints", !/<b>|<script/.test(R.render("2026-10-12", [kid({ s: ["<b>"] })], u, "<script>").html.replace(/<\/?(p|div|br|a|html|body)[^>]*>/g, "")));
}

// 4. /api/report itself, with only its neighbours stubbed
{
  db = store(["gone@example.com"]);
  let configured = true;
  const route = loadTs(path.join(REPO, "app/api/report/route.ts"), {
    "@/lib/slpAuth": { kvCmd: (c) => db.cmd(c), kvConfigured: () => configured },
    "@/lib/rateLimit": { rateLimit: async () => null },
    "@/lib/report": R,
  });
  const { NextRequest } = require(path.join(REPO, "node_modules/next/server"));
  const post = async (body, origin = "https://speaksona.com") => {
    const raw = typeof body === "string" ? body : JSON.stringify(body);
    const r = await route.POST(new NextRequest("https://speaksona.com/api/report", { method: "POST", headers: Object.assign({ "content-type": "application/json" }, origin ? { origin } : {}), body: raw }));
    return { status: r.status, json: await r.json() };
  };
  const week = (wk) => ({ wk, kids: [kid()] });
  const thisWeek = R.mondayOf(Date.now()), lastWeek = R.mondayOf(Date.now() - 7 * 24 * 3600000);
  const body = { email: "mom@example.com", dev: DEV, weeks: [week(lastWeek), week(thisWeek)] };
  const r1 = await post(body);
  ok("the route keeps a good report and says ok", r1.status === 200 && r1.json.ok === true && !r1.json.off && db.h.get("report:wk:" + thisWeek).has("mom@example.com " + DEV), r1);
  ok("…refuses another site, or no Origin (a script)", (await post(body, "https://evil.example")).status === 403 && (await post(body, null)).status === 403);
  ok("…refuses a body that is not a report, and one too big", (await post({ email: "x" })).status === 400 && (await post("{bad")).status === 400 && (await post(Object.assign({}, body, { pad: "x".repeat(5000) }))).status === 413);
  const off = await post(Object.assign({}, body, { email: "gone@example.com" }));
  ok("…answers \"off\" to an address that unsubscribed, and keeps nothing for it", off.status === 200 && off.json.off === true && ![...db.h.get("report:wk:" + thisWeek).keys()].some((k) => k.startsWith("gone@")), off);
  configured = false;
  const down = await post(body);
  ok("…and with no store, 503 and retry (never a quiet ok)", down.status === 503 && down.json.retry === true, down);
  const src = readFileSync(path.join(REPO, "app/api/report/route.ts"), "utf8");
  ok("…rate limited per address, and never logs the address", /rateLimit\(req, \{ key: "report", limit: 40, windowSec: 3600 \}\)/.test(src) && !/console\./.test(src));
}

// 5. the wiring
{
  const cron = readFileSync(path.join(REPO, "app/api/cron/nurture/route.ts"), "utf8"), vercel = JSON.parse(readFileSync(path.join(REPO, "vercel.json"), "utf8")).crons;
  ok("the daily cron sends the report (it decides the day), and a cron runs it daily", /await runReports\(/.test(cron) && /import \{ runReports \} from "@\/lib\/report"/.test(cron) && vercel.some((c) => c.path === "/api/cron/nurture" && /^\d+ \d+ \* \* \*$/.test(c.schedule)));
  const sona = readFileSync(path.join(ROOT, "sona.js"), "utf8"), ob = readFileSync(path.join(ROOT, "onboarding.html"), "utf8");
  const noExport = (sona.match(/const NO_EXPORT = \[[^\]]*\]/) || [""])[0], noImport = (sona.match(/const NO_IMPORT = \[[^\]]*\]/) || [""])[0];
  ok("the phone's device id and last send are this phone's own: on NO_EXPORT and NO_IMPORT", /"sona\.report\.v1"/.test(noExport) && /"sona\.report\.v1"/.test(noImport));
  ok("setup asks for the report only with an address given on the email step", /if\(draft\.role!=="slp"&&draft\.email&&ORDER\.indexOf\("updates"\)>-1\)\{prof\.weeklyEmail=true;prof\.weeklyReport=true;\}/.test(ob));
  ok("the email step's heading is the ask", /<h1 class="qh" id="updTitle" tabindex="-1">Get the weekly progress report<\/h1>/.test(ob));
  const priv = readFileSync(path.join(ROOT, "privacy.html"), "utf8");
  ok("the privacy policy says what the report sends, keeps and for how long", priv.includes("<h2>The weekly progress report (only if a grown-up asks for it)</h2>") && /Never a name, an age, a word, a voice/.test(priv) && /three weeks/.test(priv));
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
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { posts.push(JSON.parse(b)); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(answer)); });
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
const AVA = { childName: "Ava", childAge: "4", focusSounds: ["L"], onboarded: true, weeklyGoal: 5, email: "", volume: 0, voiceOn: false, soundOn: false };
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
  ok("…last week, child by child: days with a rep, goal days, the plan, reps, practice tries, the sounds",
    JSON.stringify(last.kids) === JSON.stringify([{ d: 2, g: 1, gw: 3, r: 18, p: 15, s: ["R"] }, { d: 1, g: 0, gw: 5, r: 6, p: 0, s: ["L"] }]), last.kids);
  ok("…this week so far, today's rep in it", JSON.stringify(cur.kids) === JSON.stringify([{ d: 3, g: 0, gw: 3, r: 7, p: 4, s: ["S", "R"] }, { d: 0, g: 0, gw: 5, r: 0, p: 0, s: [] }]), cur.kids);
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
  ok("a backup never carries the device id", !/sona\.report\.v1/.test(backup));
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
  ok("no page errors", errors.length === 0, errors);
  answer = { ok: true };
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
