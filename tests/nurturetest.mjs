// NURTURE1: the welcome series on Sona's own server (Travis, 6 Oct 2026):
// a new sign-up gets Rachel's welcome now and the 5-minute email the next
// day, once each, never after unsubscribing, always with an unsubscribe link
// and the mailing address — and nothing about a child.
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
ok("a new sign-up gets the first two emails right away, in order", await N.enroll(" Mom@Example.com ", s.cmd, fakeFetch, T) && sent.length === 2 && sent[0].to[0] === "mom@example.com" && sent[0].subject === N.CONTENT[0].subject && sent[1].subject === N.CONTENT[1].subject);
const w = sent[0];
ok("…from Rachel, replies to Rachel", /rachel@speaksona\.com/.test(w.from) && w.reply_to === "rachel@speaksona.com", w.from);
ok("…with a working unsubscribe link (the token /api/email/unsub checks) in the body and the header",
  w.html.includes("/api/email/unsub?e=mom%40example.com&k=" + N.unsubToken("mom@example.com", "s3cret")) && /api\/email\/unsub/.test(w.headers["List-Unsubscribe"]) && w.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");
ok("…and the mailing address, in html and text", w.html.includes("851 NE 1st Ave") && w.text.includes("851 NE 1st Ave"));
ok("…and links to the App Store", w.html.includes(N.APP_URL));
ok("a second sign-up with the same address sends nothing", !(await N.enroll("mom@example.com", s.cmd, fakeFetch, T + 1000)) && sent.length === 2);
ok("the sequence is two at sign-up, then day 2, 3, 5", JSON.stringify(N.CONTENT.map((c) => c.day)) === "[0,0,2,3,5]");
ok("nothing more before day 2", (await N.runDue(s.cmd, fakeFetch, T + 2 * N.DAY_MS - 1000)).sent === 0 && sent.length === 2);
// a daily run, an hour after each sign-up anniversary, for ten days
for (let d = 1; d <= 10; d++) await N.runDue(s.cmd, fakeFetch, T + d * N.DAY_MS + 3600e3);
ok("…then each email once, in order, and nothing after the last", JSON.stringify(sent.map((m) => m.subject)) === JSON.stringify(N.CONTENT.map((c) => c.subject)), sent.map((m) => m.subject));
ok("…and the day-5 email waited for day 5", s.z.size === 0);
ok("an unsubscribed address gets no first email", !(await N.enroll("gone@example.com", s.cmd, fakeFetch, T)) && sent.length === 5);
ok("…and nothing after it", (await N.runDue(s.cmd, fakeFetch, T + 9 * N.DAY_MS)).sent === 0 && sent.length === 5);
// someone enrolled by the two-email build: in the queue, no step number
const old = store(); await old.cmd(["SET", "nurture:0:old@example.com", new Date(T).toISOString()]); await old.cmd(["ZADD", N.DUE_KEY, T + N.DAY_MS, "old@example.com"]);
const before = sent.length;
await N.runDue(old.cmd, fakeFetch, T + N.DAY_MS + 1);
ok("someone signed up under the two-email build gets the 5-minute email next, then the rest", sent.length === before + 1 && sent.at(-1).subject === N.CONTENT[1].subject && old.z.has("old@example.com"));
// unsubscribing mid-way stops the rest
const mid = store(); await N.enroll("mid@example.com", mid.cmd, fakeFetch, T);
const n0 = sent.length;
mid.u = true; const mid2 = { ...mid, cmd: async (c) => (c[0] === "SISMEMBER" ? 1 : mid.cmd(c)) };
await N.runDue(mid2.cmd, fakeFetch, T + 2 * N.DAY_MS);
ok("unsubscribing mid-way stops every email after it", sent.length === n0 && mid.z.size === 0);
delete process.env.EMAIL_POSTAL;
ok("no mailing address configured → nothing sends at all", !(await N.enroll("new@example.com", store().cmd, fakeFetch, T)) && sent.length === n0);

// the words: Rachel's credential, the practice register, no price figure
const all = JSON.stringify(N.CONTENT) + readFileSync(path.join(REPO, "lib/nurture.ts"), "utf8").match(/render[\s\S]*?\n}\n/)[0];
ok("Rachel signs as MS, CF-SLP, never certified/CCC", /MS, CF-SLP/.test(all) && !/\bCCC\b|certified/i.test(all));
ok("practice, never therapy/treatment/diagnosis/score", !/therapy|treatment|diagnos|score/i.test(JSON.stringify(N.CONTENT)));
ok("no dollar figure, no \"correct\", no free-forever promise, no testimonial placeholder", !/correctly|forever|\[[A-Z]|CREDENTIALS/i.test(JSON.stringify(N.CONTENT)));
ok("no emoji anywhere (they pushed the first test into spam, 7 Oct 2026)", !/\p{Extended_Pictographic}/u.test(JSON.stringify(N.CONTENT)));
ok("no dollar figure", !/\$\d/.test(JSON.stringify(N.CONTENT)));

// the wiring
const lead = readFileSync(path.join(REPO, "app/api/lead/route.ts"), "utf8");
ok("/api/lead enrolls every new email once the app is out", /if \(APP_READY && kvConfigured\(\)\)[\s\S]{0,120}enroll\(email\)/.test(lead));
const cron = JSON.parse(readFileSync(path.join(REPO, "vercel.json"), "utf8")).crons;
ok("a daily cron sends what is due", cron.some((c) => c.path === "/api/cron/nurture" && /^\d+ \d+ \* \* \*$/.test(c.schedule)));

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
